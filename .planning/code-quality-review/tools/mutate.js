'use strict';
// Mutation-testing driver. Works ONLY on sandbox copies of the repo, never on the repo itself.
//   node mutate.js <config.json>
// config = { repo, sandboxRoot, workers, seed, timeoutMs, target, suites:[...], skipTests:[...],
//            maxMutants, perFunctionMin, out, statementDeletion, onlyOps:[...]? , siteFilter? }
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { sites } = require('./mutsites.js');

const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const PASS = String.fromCharCode(0x2713), FAIL = String.fromCharCode(0x2717);
const STAR = String.fromCharCode(0x2605);

function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function prepareSandbox(dir) {
    const marker = path.join(dir, '.sandbox_ready');
    if (fs.existsSync(marker)) return;
    const files = cp.execSync('git ls-files', { cwd: cfg.repo, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean);
    for (const f of files) {
        if (/^(\.idea|\.planning|research)\//.test(f)) continue;
        const dst = path.join(dir, f);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(path.join(cfg.repo, f), dst);
    }
    // Sandbox-only patch: let a preload name tests to skip (the multi-second ones), so a mutant
    // costs ~3 s instead of ~17 s. The repo's own test file is untouched.
    const tf = path.join(dir, 'optimizer_core.tests.js');
    let src = fs.readFileSync(tf, 'utf8');
    const before = src;
    src = src.split('TESTS.push([name, fn]);').join('if (!(globalThis.__MUT_SKIP && globalThis.__MUT_SKIP.has(name))) TESTS.push([name, fn]);');
    if (src === before) throw new Error('sandbox patch did not apply');
    fs.writeFileSync(tf, src);
    fs.writeFileSync(path.join(dir, '__skip_preload.js'),
        "'use strict';\nconst fs=require('fs');\nconst f=process.env.MUT_SKIP_FILE;\nif(f&&fs.existsSync(f)) globalThis.__MUT_SKIP=new Set(JSON.parse(fs.readFileSync(f,'utf8')));\n");
    fs.writeFileSync(marker, 'ok');
}

function runSuite(dir, suite, timeoutMs, skipFile, extraEnv) {
    return new Promise(resolve => {
        const t0 = Date.now();
        const env = Object.assign({}, process.env, skipFile ? { MUT_SKIP_FILE: skipFile } : {}, extraEnv || {});
        const child = cp.spawn(process.execPath, ['-r', './__skip_preload.js', suite], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '', timedOut = false;
        child.stdout.on('data', d => { if (out.length < 8e6) out += d; });
        child.stderr.on('data', d => { if (out.length < 8e6) out += d; });
        const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
        child.on('close', code => {
            clearTimeout(timer);
            const passed = new Set(), failed = new Set();
            for (const raw of out.split(/\r?\n/)) {
                const m = /^\s*([^\s\w])\s+(.*)$/.exec(raw);
                if (!m) continue;
                let name = m[2];
                if (name.startsWith(STAR)) name = name.replace(/^\S+\s+CRITICAL\s+/, '');
                if (m[1] === PASS) passed.add(name); else if (m[1] === FAIL) failed.add(name);
            }
            for (const n of failed) passed.delete(n);
            resolve({ suite, code, timedOut, passed: [...passed], failed: [...failed], ms: Date.now() - t0, tail: out.slice(-400) });
        });
    });
}

(async () => {
    fs.mkdirSync(cfg.sandboxRoot, { recursive: true });
    const dirs = [];
    for (let w = 0; w < cfg.workers; w++) {
        const d = path.join(cfg.sandboxRoot, 'w' + w); prepareSandbox(d); dirs.push(d);
        fs.copyFileSync(path.join(__dirname, 'inpage_runner.js'), path.join(d, '__inpage_runner.js'));
    }
    const skipFile = path.join(cfg.sandboxRoot, 'skip_' + path.basename(cfg.out) + '.json');
    fs.writeFileSync(skipFile, JSON.stringify(cfg.skipTests || []));

    const original = fs.readFileSync(path.join(cfg.repo, cfg.target), 'utf8');
    for (const d of dirs) fs.writeFileSync(path.join(d, cfg.target), original);
    // baseline
    const base = {};
    for (const s of cfg.suites) {
        const r = await runSuite(dirs[0], s, cfg.timeoutMs * 3, skipFile, cfg.env);
        if (r.failed.length || r.timedOut || !r.passed.length) { console.error('BASELINE NOT GREEN for', s, r.failed.slice(0, 5), r.tail); process.exit(2); }
        base[s] = { n: r.passed.length, ms: r.ms };
        console.log('baseline', s, r.passed.length, 'tests', r.ms, 'ms');
    }

    let all = sites(original, { statementDeletion: cfg.statementDeletion !== false });
    if (cfg.onlyOps) all = all.filter(s => cfg.onlyOps.some(p => s.op.startsWith(p)));
    if (cfg.lineMin) all = all.filter(s => s.line >= cfg.lineMin);
    if (cfg.lineMax) all = all.filter(s => s.line <= cfg.lineMax);
    if (cfg.keysFile) {
        const keep = new Set(JSON.parse(fs.readFileSync(cfg.keysFile, 'utf8')));
        all = all.filter(s => keep.has(cfg.target + ':' + s.start + ':' + s.op));
    }
    const rng = mulberry32(cfg.seed || 12345);
    // stratified sample: every function gets perFunctionMin first, the rest uniformly
    const byFn = new Map();
    for (const s of all) { if (!byFn.has(s.fn)) byFn.set(s.fn, []); byFn.get(s.fn).push(s); }
    for (const arr of byFn.values()) for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    let chosen = [];
    const rest = [];
    for (const arr of byFn.values()) { chosen = chosen.concat(arr.slice(0, cfg.perFunctionMin || 2)); rest.push(...arr.slice(cfg.perFunctionMin || 2)); }
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    const max = cfg.maxMutants || all.length;
    if (chosen.length < max) chosen = chosen.concat(rest.slice(0, max - chosen.length)); else chosen = chosen.slice(0, max);
    chosen.sort((a, b) => a.start - b.start);
    console.log('sites', all.length, 'functions', byFn.size, 'chosen', chosen.length);

    // resume support
    const done = new Set();
    if (fs.existsSync(cfg.out)) for (const l of fs.readFileSync(cfg.out, 'utf8').split('\n')) { if (l.trim()) { try { done.add(JSON.parse(l).key); } catch (e) { } } }
    const outFd = fs.openSync(cfg.out, 'a');
    let next = 0, finished = 0, killed = 0, survived = 0;
    const t0 = Date.now();

    async function worker(dir) {
        const targetPath = path.join(dir, cfg.target);
        for (;;) {
            const idx = next++;
            if (idx >= chosen.length) return;
            const s = chosen[idx];
            const key = cfg.target + ':' + s.start + ':' + s.op;
            if (done.has(key)) { finished++; continue; }
            const mutated = original.slice(0, s.start) + s.replacement + original.slice(s.end);
            fs.writeFileSync(targetPath, mutated);
            const failed = {}; let ms = 0; const notes = [];
            let anyTimeout = false, anyCrash = false, anyFail = false;
            for (const suite of cfg.suites) {
                const r = await runSuite(dir, suite, cfg.timeoutMs, skipFile, cfg.env);
                ms += r.ms;
                if (r.failed.length) { failed[suite] = r.failed; anyFail = true; }
                if (r.timedOut) { anyTimeout = true; notes.push(suite + ':timeout'); continue; }
                const ran = r.passed.length + r.failed.length;
                if (ran === 0) { anyCrash = true; notes.push(suite + ':crash ' + r.tail.replace(/\s+/g, ' ').slice(-160)); }
                else if (ran < base[suite].n) { anyFail = true; notes.push(suite + ':incomplete ' + ran + '/' + base[suite].n); }
            }
            const status = anyTimeout ? 'timeout' : anyCrash ? 'crash' : anyFail ? 'killed' : 'survived';
            fs.writeFileSync(targetPath, original);
            if (status === 'killed') killed++; else if (status === 'survived') survived++;
            const rec = { key, target: cfg.target, line: s.line, fn: s.fn, op: s.op, status, failed, notes, ms,
                src: original.slice(original.lastIndexOf('\n', s.start) + 1, original.indexOf('\n', s.end) < 0 ? original.length : original.indexOf('\n', s.end)).trim().slice(0, 200) };
            fs.writeSync(outFd, JSON.stringify(rec) + '\n');
            finished++;
            if (finished % 50 === 0) console.log(`${finished}/${chosen.length} killed=${killed} survived=${survived} elapsed=${((Date.now() - t0) / 1000).toFixed(0)}s`);
        }
    }
    await Promise.all(dirs.map(d => worker(d)));
    for (const d of dirs) fs.writeFileSync(path.join(d, cfg.target), original);
    console.log(`DONE ${cfg.target}: ${finished} mutants, killed=${killed}, survived=${survived}, ${(Date.now() - t0) / 1000}s`);
})().catch(e => { console.error(e); process.exit(1); });
