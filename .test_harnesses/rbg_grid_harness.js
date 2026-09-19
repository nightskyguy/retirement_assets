'use strict';
/**
 * rbg_grid_harness.js -- what the risk-based spend rule (`spendRule: 'rbg'`, P132) delivers at
 * several Target / Raise / Cut / Cut-returns-to settings, on the households most likely to be cut,
 * through the worst historical starts and under Monte Carlo.
 *
 * Run:  node .test_harnesses/rbg_grid_harness.js               (4 households; about 10 minutes on 4
 *                                                                processes)
 *       node .test_harnesses/rbg_grid_harness.js --quick       (1 household, fewer sets, ~2 minutes)
 *       node .test_harnesses/rbg_grid_harness.js --plan soft-cap-underfunded --paths 200
 *       node .test_harnesses/rbg_grid_harness.js --from <dir>  (re-print a finished run)
 * Report: research/RBG_RULE_THRESHOLDS.md. Every number that report quotes is printed here.
 *
 * WHY (user, 2026-09-19): "Given the paper is showing a much lower PoS floor, it seems it would make
 * sense to run trials against a worst case plan at several Target/Cut/Raise thresholds."
 *
 * WHAT RUNS. For each household ONE rails job solves every set at once (the order-statistic solver
 * answers extra thresholds almost free), then each set's table drives the cheap rule through the five
 * historical starts the validator used (research/RBG_RULE_VALIDATION.md) and through N Monte Carlo
 * paths on the page's default model. Beside every set: the plan with no rule and with GK-style.
 * Never above plan is ON for every risk-based arm, the page's default with the rule, and the run
 * says so; --no-ceiling turns it off.
 *
 * WHAT IS SCORED, per household x set x sequence: trough against the plan's own shape, years below
 * it, the first decade's real spending, lifetime real spending at 0/3/5% discount (section 8 of
 * research/RISK_BASED_GUARDRAILS.md: early spending is worth more), ending wealth, adjustments,
 * funded. Under Monte Carlo: the share of paths funded, and the median of each of those.
 */

globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
Object.assign(globalThis, require('../taxengine.js'));
const core = require('../optimizer_core.js');
Object.assign(globalThis, core);
Object.assign(globalThis, require('../montecarlo/prng.js'));
Object.assign(globalThis, require('../montecarlo/stats.js'));
Object.assign(globalThis, require('../montecarlo/historical_returns.js'));
const mc = require('../montecarlo/mc_engine.js');
const rails = require('../montecarlo/rails_engine.js');
const PLANS = require('../plans');
const { simulate, RAIL_PRESETS } = core;
const H = globalThis.HISTORICAL_RETURNS;
const ENGINE = fs.readFileSync(path.join(__dirname, '..', 'retirement_optimizer.html'), 'utf8')
    .match(/<title>[^<]*?([\d.]+\w*)<\/title>/)?.[1] ?? '?';

// ---- knobs -----------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const QUICK = argv.includes('--quick');
const FROM = opt('--from', null);
const PATHS = Number(opt('--paths', 100));          // behind the table
const MC_PATHS = Number(opt('--mc-paths', QUICK ? 100 : 400));
const METHOD = opt('--method', 'gbm');
const SEED = Number(opt('--seed', 42));
const CADENCE = Number(opt('--cadence', 3));
const CEILING = !argv.includes('--no-ceiling');
const STARTS = opt('--starts', '1929,1937,1966,1973,2000').split(',').map(Number);
const BANK_IDS = argv.includes('--plan') ? [opt('--plan')] : QUICK
    ? ['soft-cap-underfunded']
    : ['soft-cap-underfunded', 'mixed-portfolio-couple', 'modest-balances-little-surplus', 'long-widowhood'];
for (const id of BANK_IDS) PLANS.get(id);
const JOBS = Number(process.env.JOBS) || Math.max(1, Math.min(BANK_IDS.length, os.cpus().length - 4));
const DISCOUNTS = [0, 0.03, 0.05];

// The sets. The four published ones, then a grid: cut at 25 / 35 / 50 crossed with target 70 / 80 /
// 90, each returning to its target and to 35 points under it (floored at cut + 5), raise at 99.5%.
function railSets() {
    const sets = { ...RAIL_PRESETS };
    const cuts = QUICK ? [0.25, 0.50] : [0.25, 0.35, 0.50];
    const targets = QUICK ? [0.80] : [0.70, 0.80, 0.90];
    for (const t of targets) {
        for (const c of cuts) {
            if (c >= t) continue;
            // Rounded, or 0.80 - 0.35 is 0.45000000000000007 and asks the solver for one path more
            // than 0.45 does.
            const backs = [t, Math.round(Math.max(c + 0.05, t - 0.35) * 100) / 100];
            for (const b of new Set(backs)) {
                const key = `t${Math.round(t * 100)}c${Math.round(c * 100)}b${Math.round(b * 100)}`;
                sets[key] = { key, label: key, target: t, upper: 0.995, lower: c, cutTo: b };
            }
        }
    }
    return sets;
}

// ---- the model (as rbg_playback_harness.js has it) --------------------------------------------
function household(id) {
    const inputs = PLANS.get(id).inputs;
    const base = { ...inputs, computeOC: false, captureResume: false, resume: undefined, spendRule: '', rbgRails: undefined };
    return { id, base, n: simulate(base).log.length };
}
function modelCfg(h, numPaths) {
    return { simulationMode: METHOD, seed: SEED, numPaths, mu: h.base.growth, sigma: 0.12, bearFraction: 25,
             inflationRate: h.base.inflation };
}
function historicalPath(h, start, years) {
    const n = H.equity.length, i0 = start - H.equityStartYear;
    const off = H.intlStartYear - H.equityStartYear;
    const rows = { scenario: [], equity: [], bonds: [], intl: [], inflation: [] };
    for (let y = 0; y < years; y++) {
        const idx = (i0 + y) % n;
        rows.equity.push(H.equity[idx]); rows.scenario.push(H.equity[idx]); rows.bonds.push(H.bonds[idx]);
        rows.intl.push((idx - off >= 0 && idx - off < H.intl.length) ? H.intl[idx - off] : H.equity[idx]);
        rows.inflation.push(Math.max(-0.01, H.inflation[idx]));
    }
    return mc.pathInputsFromBankRows(rows, h.base, 'bootstrap');
}
function rowsOf(res) {
    return res.log.map(r => ({ year: r.year, spend: r.spendGoal, infl: r.inflationFactor, wealthEnd: r.totalNetWealth,
                               label: r.gkAdj && r.gkAdj !== '—' ? r.gkAdj : '', ruined: mc.yearIsRuined(r) }));
}
function score(rows, shape) {
    const real = rows.map(r => r.spend / (r.infl || 1)), shapeReal = shape.map(r => r.spend / (r.infl || 1));
    let trough = Infinity, below = 0;
    for (let y = 0; y < real.length && y < shapeReal.length; y++) {
        const x = real[y] / shapeReal[y];
        if (x < trough) trough = x;
        if (x < 1 - 1e-9) below++;
    }
    const life = {};
    for (const d of DISCOUNTS) life[d] = real.reduce((s, v, y) => s + v / Math.pow(1 + d, y), 0);
    return { trough: trough === Infinity ? null : trough, below, decade: real.slice(0, 10).reduce((s, v) => s + v, 0), life,
             endWealth: rows[rows.length - 1]?.wealthEnd ?? null, ruined: rows.some(r => r.ruined),
             adjustments: rows.filter(r => r.label).length };
}
const median = xs => { const a = xs.filter(Number.isFinite).sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : null; };

// ---- one task: one household, every set --------------------------------------------------------
async function runTask(task) {
    const h = household(task.plan);
    const t0 = performance.now();
    const sets = railSets();
    const msg = await rails.runRailsJob({ base: h.base, cadence: CADENCE, presets: sets, ...modelCfg(h, PATHS) });
    const arms = [{ key: 'off', over: {} }, { key: 'gk', over: { spendRule: 'gk', gkShapeCeiling: CEILING } }];
    for (const key of Object.keys(sets)) {
        arms.push({ key, over: { spendRule: 'rbg', rbgPreset: key, gkShapeCeiling: CEILING, rbgRails: rails.railsRuleTable(msg, key) } });
    }
    // Historical starts.
    const hist = {};
    for (const start of STARTS) {
        const pi = historicalPath(h, start, h.n + rails.RAILS_EXTRA_YEARS);
        const shape = rowsOf(simulate({ ...h.base, ...pi }));
        hist[start] = {};
        for (const a of arms) hist[start][a.key] = score(rowsOf(simulate({ ...h.base, ...a.over, ...pi })), shape);
    }
    // Monte Carlo: the same paths for every arm.
    const years = h.n + rails.RAILS_EXTRA_YEARS;
    const banks = mc.buildBanks({ ...modelCfg(h, MC_PATHS), years, baseInputs: h.base }, mulberry32(SEED + 1), METHOD);
    const paths = [];
    for (let p = 0; p < banks.numPaths; p++) paths.push(mc.buildPathInputs(banks, p, years, h.base, METHOD));
    const monte = {};
    for (const a of arms) {
        const s = [];
        for (const pi of paths) {
            const shape = a.key === 'off' ? null : rowsOf(simulate({ ...h.base, ...pi }));
            const rows = rowsOf(simulate({ ...h.base, ...a.over, ...pi }));
            s.push(score(rows, shape ?? rows));
        }
        monte[a.key] = {
            funded: s.filter(x => !x.ruined).length / s.length,
            trough: median(s.map(x => x.trough)), below: median(s.map(x => x.below)),
            decade: median(s.map(x => x.decade)), life0: median(s.map(x => x.life[0])), life3: median(s.map(x => x.life[0.03])),
            endWealth: median(s.map(x => x.endWealth)), adjustments: median(s.map(x => x.adjustments)),
            // The tenth percentile of lifetime real spending: the bad-path experience.
            life0p10: (() => { const a2 = s.map(x => x.life[0]).sort((p, q) => p - q); return a2[Math.floor(a2.length * 0.1)]; })(),
        };
    }
    return { kind: 'grid', engine: ENGINE, plan: task.plan, n: h.n, paths: PATHS, mcPaths: banks.numPaths, method: METHOD,
             ceiling: CEILING, sets: Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, { target: v.target, upper: v.upper, lower: v.lower, cutTo: v.cutTo ?? v.target }])),
             hist, monte, jobMs: msg.cost.totalMs, jobRuns: msg.cost.runs, ms: performance.now() - t0 };
}

if (argv[0] === '--child') {
    const task = JSON.parse(argv[1]);
    runTask(task).then(res => { fs.writeFileSync(task.out, JSON.stringify(res)); process.exit(0); },
                       err => { console.error(err && err.stack || err); process.exit(1); });
    return;
}

function runChildren(tasks) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rbg-grid-'));
    console.log(`Per-task results: ${dir} (re-print with --from <that directory>).\n`);
    let next = 0, done = 0;
    const results = new Array(tasks.length);
    const pass = argv.filter(a => a !== '--child');
    return new Promise((resolve, reject) => {
        const launch = () => {
            if (next >= tasks.length) return;
            const i = next++;
            const task = { ...tasks[i], out: path.join(dir, `t${i}.json`) };
            const child = spawn(process.execPath, [__filename, '--child', JSON.stringify(task), ...pass],
                                { stdio: ['ignore', 'ignore', 'pipe'], env: process.env });
            let err = '';
            child.stderr.on('data', d => { err += d; });
            child.on('exit', code => {
                if (code !== 0) { reject(new Error(`${task.plan}: ${err}`)); return; }
                results[i] = JSON.parse(fs.readFileSync(task.out, 'utf8'));
                done++;
                process.stderr.write(`[${done}/${tasks.length}] ${task.plan} ${(results[i].ms / 1000).toFixed(0)}s\n`);
                if (done === tasks.length) resolve(results); else launch();
            });
        };
        for (let j = 0; j < Math.min(JOBS, tasks.length); j++) launch();
    });
}

// ---- printing --------------------------------------------------------------------------------
const money = v => v == null ? '-' : '$' + Math.round(v).toLocaleString('en-US');
const pct = (v, d = 0) => v == null ? '-' : (v * 100).toFixed(d) + '%';
const signed = (v, d = 0) => v == null ? '-' : (v >= 0 ? '+' : '') + (v * 100).toFixed(d) + '%';
const setLabel = (key, s) => key === 'off' ? 'no rule' : key === 'gk' ? 'GK-style'
    : `${key}: ${pct(s.target)} / ${pct(s.upper, 1)} / ${pct(s.lower)} back to ${pct(s.cutTo)}`;

function printAll(results) {
    const r0 = results[0];
    console.log(`# rbg_grid_harness.js - engine ${r0.engine}, table ${r0.paths} paths, Monte Carlo ${r0.mcPaths} paths, ${r0.method}, ${r0.ceiling ? 'Never above plan ON' : 'no ceiling'}\n`);
    console.log('Set columns read target / raise at / cut at, back to.\n');
    for (const r of results) {
        console.log(`## ${r.plan} (${r.n} years; table job ${(r.jobMs / 1000).toFixed(1)} s, ${r.jobRuns.toLocaleString()} runs)\n`);
        console.log(`### Monte Carlo, ${r.mcPaths} paths: medians across paths\n`);
        console.log('| set | funded | trough vs shape | years below | first decade | lifetime real 0% | 3% | p10 lifetime | ending wealth | adjustments |');
        console.log('|---|---|---|---|---|---|---|---|---|---|');
        for (const key of Object.keys(r.monte)) {
            const m = r.monte[key], s = r.sets[key] ?? {};
            console.log(`| ${setLabel(key, s)} | ${pct(m.funded, 1)} | ${m.trough == null ? '-' : signed(m.trough - 1)} | ${m.below} | ${money(m.decade)} | ${money(m.life0)} | ${money(m.life3)} | ${money(m.life0p10)} | ${money(m.endWealth)} | ${m.adjustments} |`);
        }
        console.log(`\n### Historical starts: trough vs shape / lifetime real 0% / funded\n`);
        const starts = Object.keys(r.hist);
        console.log('| set | ' + starts.join(' | ') + ' |');
        console.log('|---|' + starts.map(() => '---').join('|') + '|');
        for (const key of Object.keys(r.monte)) {
            const s = r.sets[key] ?? {};
            const cells = starts.map(st => { const x = r.hist[st][key]; return `${x.trough == null ? '-' : signed(x.trough - 1)} / ${money(x.life[0])} / ${x.ruined ? 'NO' : 'yes'}`; });
            console.log(`| ${setLabel(key, s)} | ${cells.join(' | ')} |`);
        }
        console.log('');
    }
}

async function main() {
    let results;
    if (FROM) {
        results = fs.readdirSync(FROM).filter(f => /^t\d+\.json$/.test(f)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
            .map(f => JSON.parse(fs.readFileSync(path.join(FROM, f), 'utf8')));
    } else {
        results = await runChildren(BANK_IDS.map(plan => ({ plan })));
    }
    printAll(results);
}
main().catch(e => { console.error(e && e.stack || e); process.exit(1); });
