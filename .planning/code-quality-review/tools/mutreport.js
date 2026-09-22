'use strict';
// Aggregates mutation results. node mutreport.js <outJson> <suiteName> <baselineNamesFile> <jsonl>...
//   suiteName: which suite's failures to analyze per test (e.g. optimizer_core.tests.js)
//   baselineNamesFile: TSV from timing_preload (ms, status, name) giving every test name of that suite
const fs = require('fs');
const [outJson, suiteName, baseFile] = process.argv.slice(2, 5);
const files = process.argv.slice(5);
const STAR = String.fromCharCode(0x2605);

const baseNames = [];
const seenB = new Set();
for (const l of fs.readFileSync(baseFile, 'utf8').split('\n').filter(Boolean)) {
    const parts = l.split('\t'); let name = parts[2]; const ms = Number(parts[0]);
    if (name.startsWith(STAR)) name = name.replace(/^\S+\s+CRITICAL\s+/, '');
    if (seenB.has(name)) continue; seenB.add(name); baseNames.push({ name, ms, critical: parts[2].startsWith(STAR) });
}

const recs = [];
for (const f of files) for (const l of fs.readFileSync(f, 'utf8').split('\n')) { if (l.trim()) { try { recs.push(JSON.parse(l)); } catch (e) { } } }

const perTarget = {};
const killsByTest = new Map(baseNames.map(b => [b.name, { kills: 0, unique: 0, targets: {} }]));
const killSets = [];   // for set cover: array of {id, tests:Set}
for (const r of recs) {
    const T = perTarget[r.target] = perTarget[r.target] || { total: 0, killed: 0, survived: 0, crash: 0, timeout: 0, byOp: {}, byFn: {}, killedOnlyByOther: 0 };
    T.total++; T[r.status]++;
    const opc = r.op.split(':')[0];
    const O = T.byOp[opc] = T.byOp[opc] || { total: 0, survived: 0 };
    O.total++; if (r.status === 'survived') O.survived++;
    const F = T.byFn[r.fn] = T.byFn[r.fn] || { total: 0, survived: 0, lines: [Infinity, 0] };
    F.total++; if (r.status === 'survived') F.survived++;
    F.lines[0] = Math.min(F.lines[0], r.line); F.lines[1] = Math.max(F.lines[1], r.line);
    const failed = (r.failed && r.failed[suiteName]) || [];
    if (r.status === 'killed' && failed.length) {
        const set = new Set(failed);
        killSets.push({ key: r.key, tests: set });
        for (const n of set) {
            if (!killsByTest.has(n)) killsByTest.set(n, { kills: 0, unique: 0, targets: {} });
            const k = killsByTest.get(n); k.kills++; k.targets[r.target] = (k.targets[r.target] || 0) + 1;
            if (set.size === 1) k.unique++;
        }
    } else if (r.status === 'killed') T.killedOnlyByOther++;
}

// greedy set cover over mutants killed by this suite
const remaining = new Map(killSets.map(k => [k.key, k.tests]));
const cover = [];
const testToMutants = new Map();
for (const [key, tests] of remaining) for (const t of tests) { if (!testToMutants.has(t)) testToMutants.set(t, new Set()); testToMutants.get(t).add(key); }
const alive = new Set(remaining.keys());
while (alive.size) {
    let best = null, bestN = 0;
    for (const [t, ms] of testToMutants) { let n = 0; for (const m of ms) if (alive.has(m)) n++; if (n > bestN) { bestN = n; best = t; } }
    if (!best) break;
    cover.push({ test: best, newlyCovered: bestN });
    for (const m of testToMutants.get(best)) alive.delete(m);
}

const zeroKill = baseNames.filter(b => (killsByTest.get(b.name) || { kills: 0 }).kills === 0);
const coverSet = new Set(cover.map(c => c.test));
const notInCover = baseNames.filter(b => !coverSet.has(b.name) && (killsByTest.get(b.name) || { kills: 0 }).kills > 0);
const out = {
    suite: suiteName, tests: baseNames.length, mutants: recs.length, perTarget,
    cover: { size: cover.length, first20: cover.slice(0, 20) },
    zeroKill: zeroKill.map(b => b.name),
    redundantButKilling: notInCover.map(b => ({ name: b.name, kills: killsByTest.get(b.name).kills })),
    perTest: baseNames.map(b => Object.assign({ name: b.name, ms: b.ms, critical: b.critical }, killsByTest.get(b.name) || { kills: 0, unique: 0 })),
    survivors: recs.filter(r => r.status === 'survived').map(r => ({ target: r.target, line: r.line, fn: r.fn, op: r.op, src: r.src })),
};
fs.writeFileSync(outJson, JSON.stringify(out, null, 1));
for (const [t, T] of Object.entries(perTarget)) {
    const score = (100 * (T.killed + T.crash + T.timeout) / Math.max(1, T.total)).toFixed(1);
    console.log(`\n${t}: mutants=${T.total} killed=${T.killed} crash=${T.crash} timeout=${T.timeout} survived=${T.survived}  score=${score}%  (killed only by another suite: ${T.killedOnlyByOther})`);
    console.log('  by operator:', Object.entries(T.byOp).map(([k, v]) => `${k} ${v.survived}/${v.total}`).join('  '));
}
console.log(`\n${suiteName}: ${baseNames.length} tests; zero-kill tests ${zeroKill.length}; greedy cover ${cover.length} tests kill every mutant this suite kills; killing-but-not-in-cover ${notInCover.length}`);
