'use strict';
/**
 * rails_precision_harness.js -- is the live risk-based rails solve (P128) steady enough at the
 * settings a person would run, can its 99% and 100% raise rails be reached at all, and is an
 * After-Tax Spend answer from the same job (P129) worth building?
 *
 * Run:  node .test_harnesses/rails_precision_harness.js              (everything; about 50 minutes
 *                                                                     on 16 processes)
 *       node .test_harnesses/rails_precision_harness.js --quick      (a smoke test, about 2 minutes)
 *       JOBS=8 node .test_harnesses/rails_precision_harness.js       (child processes at once)
 *       USER_PLAN=plan.json node .test_harnesses/rails_precision_harness.js
 *           adds one household read from a file holding `{ inputs, mc }`: the page's getInputs()
 *           and its Monte Carlo settings. Kept out of the repository on purpose; its rows print
 *           as "page plan".
 *       node .test_harnesses/rails_precision_harness.js --from <dir> --no-timing
 *           re-prints every table from a finished run's per-task files (the run names the
 *           directory near its top: "Per-task results: ...") in seconds, without the timing
 *           section, which is measured live. Pass the same USER_PLAN the run had.
 *       node .test_harnesses/rails_precision_harness.js --timing-only
 *           runs section 4 alone, on the engine as it is now (a few minutes).
 * Report: research/RISK_BASED_RAILS_PRECISION.md. Every number that report quotes is printed here.
 *
 * WHY (user, 2026-09-16): "Running 100 paths every 3 years is sufficient - including one extra pass
 * for the After-Tax spend calculation ... before doing any of that, it will be useful to run some
 * heavy testing to see whether it's worth the effort. For example, one issue I worry about is if
 * the MC synthetic testing invariably produces a number below 100% the 99% and 100% success rates
 * may need adjustment."
 *
 * FOUR QUESTIONS, one part each.
 *   1. REACH. At the first full year, how much more wealth would each household need before a
 *      given share of market paths survives - and is there a share no amount of wealth reaches?
 *   2. PRECISION. How far a rail or a target spend solved from 100 paths lands from the same answer
 *      solved from many, and whether it is merely noisy or also biased. The 99% and 100% raise
 *      rails are the suspects: from a finite sample, "99%" is decided by the second-worst path in a
 *      hundred and "100%" by the very worst, so their answers may move with the path count itself.
 *      2b runs the job a person would run, seed after seed; 2c prices a path-count correction of the
 *      count the solver asks for, on the same slices (a comparison - the solver does not use it).
 *   3. CADENCE. How far the lines drawn between solved years sit from what solving that year
 *      would have said, at every 2, 3 and 5 years.
 *   4. COST. What 100 paths every 3 years takes, with and without the After-Tax Spend pass, and
 *      what a higher-precision run would.
 *
 * HOW PARTS 1 AND 2 ARE MEASURED WITHOUT RUNNING THE SOLVER THOUSANDS OF TIMES. Survival on one
 * market path is (almost) monotone in wealth and in spending, so each path has ONE number that
 * decides it: the smallest wealth multiple it survives at (`s`), and the largest spending multiple
 * it survives at (`m`). A pool of 6,000 paths, each bisected for both, gives the whole distribution.
 * Any solve's answer is then an order statistic of that pool: the rail for "q of N paths survive" is
 * the c-th smallest `s` among the N, with c the least count for which c / N >= q - the same
 * comparison the solver makes. Disjoint slices of the pool are independent N-path samples, so the
 * spread across slices is the spread a person would see run to run. The monotonicity this rests on
 * is CHECKED on every pool, not assumed: the count of paths that survive at one wealth and fail at a
 * higher one is printed.
 *
 * Historical mode needs care: the bear-start overlay rewrites the opening of the FIRST quarter of a
 * bank's paths (applyBearStartOverlay), so a run of N paths always holds floor(N/4) of them. Slices
 * are therefore stratified the same way. Consecutive slices would have handed the first slices all
 * the bear starts.
 *
 * PART 3 runs the solver itself, every year, and derives every-c-years from it. That is exact, not
 * an approximation: a solved year depends only on the bank and the year, and the bank depends only
 * on the seed, the path count and the plan length - so a job at cadence c IS the cadence-1 job's
 * years 1, 1+c, ... The harness checks that identity on one household before relying on it.
 *
 * THE MODEL is the page's own, as the rails panel reads it: the Monte Carlo tab's defaults, with
 * mu taken from the plan's Growth (the page copies one into the other), sigma 12%, seed 42,
 * bear-start 25%, and the fitted inflation model. Three methods: Historical (bootstrap, the tab's
 * default until 11.1859), Synthetic lognormal (gbm, the default since) and Synthetic arithmetic (aam).
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
const mc = require('../montecarlo/mc_engine.js');
const rails = require('../montecarlo/rails_engine.js');
const PLANS = require('../plans');
const { simulate, resumeInputs, RAIL_PRESETS } = core;
// The version the page on disk declares. Recorded in every task's result, because a re-print can
// happen after the engine has moved on.
const ENGINE = fs.readFileSync(path.join(__dirname, '..', 'retirement_optimizer.html'), 'utf8')
    .match(/<title>[^<]*?([\d.]+\w*)<\/title>/)?.[1] ?? '?';

// ---- knobs -----------------------------------------------------------------------------------
const QUICK = process.argv.includes('--quick');
// Re-print from a finished run's per-task files (the directory the first line of a run names)
// instead of running the tasks again. Pass the same USER_PLAN the run had, so the task list lines up.
const FROM = process.argv.includes('--from') ? process.argv[process.argv.indexOf('--from') + 1] : null;
const NO_TIMING = process.argv.includes('--no-timing');
// Only the timing pass, on the engine as it is now: after a solver change, the one part that moves.
const TIMING_ONLY = process.argv.includes('--timing-only');
const POOL_PATHS = QUICK ? 400 : 6000;
const SLICE_SIZES = QUICK ? [50, 100] : [100, 200, 500, 1000];
const THRESHOLDS = [0.40, 0.70, 0.80, 0.90, 0.95, 0.99, 1.00];
const METHODS = ['bootstrap', 'gbm', 'aam'];
const CADENCE_METHODS = ['bootstrap', 'gbm'];
const CADENCE_PATHS = QUICK ? 60 : 400;
const CADENCES = [2, 3, 5];
const SEEDS = QUICK ? [1, 2] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SEED_PATHS = QUICK ? 40 : 100;
const SEED_CADENCE = 3;
const START_PATHS_HIGH = QUICK ? 100 : 500;
const TIMING_REPEATS = QUICK ? 1 : 3;
const JOBS = Number(process.env.JOBS) || Math.max(2, Math.min(16, os.cpus().length - 6));
// Per-path searches. Much wider than the solver's own brackets, so that "beyond the solver's
// reach" and "beyond ANY reach" can be told apart.
const S_RANGE = [0.05, 64];
const M_RANGE = [0.02, 16];
const PATH_STEPS = 12;                       // log bisection: ~0.2% on `s`, ~0.2% on `m`
// Where the solver of the first run (11.1857) stopped looking, which the clamp columns measure; the
// per-path solver of 11.1859 looks to 16x wealth and 16x spending, and the reach table prints that too.
const LIVE_S_HI = 4;
const LIVE_M_HI = 4;
const LIVE_M_LO = 0.1;
const NEW_S_HI = rails.RAILS_SCALE_RANGE[1];
const NEVER = 1e9;                           // JSON has no Infinity
const MONO_GRID = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 8, 16, 32, 64];
const MONO_PATHS = QUICK ? 30 : 150;

// Households. Each is resolved through the bank so a typo fails at startup, and so which_plan.js
// can find this harness by its `PLANS.get('...')` calls.
const BANK_IDS = [
    PLANS.get('bracket-filler-texas').id,
    PLANS.get('mixed-portfolio-couple').id,
    PLANS.get('long-widowhood').id,
    PLANS.get('age-gap-ira-heavy-ca').id,
    PLANS.get('modest-balances-little-surplus').id,
    PLANS.get('high-spend-large-ira').id,
    PLANS.get('single-filer-long-horizon').id,
    PLANS.get('soft-cap-underfunded').id,
];
const USER_PLAN = process.env.USER_PLAN || null;
const PAGE_PLAN_ID = 'page-plan';
const HOUSEHOLDS = QUICK ? BANK_IDS.slice(0, 2) : BANK_IDS.concat(USER_PLAN ? [PAGE_PLAN_ID] : []);

// ---- the model -------------------------------------------------------------------------------
const _households = new Map();
function household(id) {
    if (_households.has(id)) return _households.get(id);
    let inputs, pageMc = null, label = id;
    if (id === PAGE_PLAN_ID) {
        const doc = JSON.parse(fs.readFileSync(USER_PLAN, 'utf8'));
        inputs = doc.inputs;
        pageMc = doc.mc || null;
        label = 'page plan';
    } else {
        inputs = PLANS.get(id).inputs;
    }
    // Exactly what runRailsJob does with the page's inputs.
    const base = { ...inputs, computeOC: false, captureResume: false, resume: undefined };
    const ruleOn = base.spendRule === 'gk';
    const solveBase = { ...base, spendRule: '' };
    const spine = simulate({ ...base, captureResume: true });
    const h = { id, label, inputs, base, solveBase, ruleOn, spine, n: spine.log.length, pageMc };
    _households.set(id, h);
    return h;
}

// The Monte Carlo settings the rails panel sends, at the tab's defaults.
function modelCfg(h, method, seed, numPaths) {
    const m = h.pageMc;
    return {
        simulationMode: method, seed, numPaths,
        mu: (m?.mu != null ? m.mu / 100 : h.base.growth),
        sigma: (m?.sigma ?? 12) / 100,
        bearFraction: m?.bear ?? 25,
        inflationRate: h.base.inflation,
        inflationPersistence: m?.infl?.inflationPersistence ?? 0.67,
        inflationShockSd: m?.infl?.inflationShockSd ?? 0.021,
        inflationReturnCorr: m?.infl?.inflationReturnCorr ?? -0.3,
    };
}

function pathBank(h, method, seed, numPaths) {
    const years = h.n + rails.RAILS_EXTRA_YEARS;
    const cfg = { ...modelCfg(h, method, seed, numPaths), years, baseInputs: h.solveBase };
    const banks = mc.buildBanks(cfg, mulberry32(seed), method);
    const P = banks.numPaths;
    const inputs = new Array(P);
    for (let p = 0; p < P; p++) inputs[p] = mc.buildPathInputs(banks, p, years, h.solveBase, method);
    const bearCount = method === 'bootstrap' ? Math.floor(P * cfg.bearFraction / 100) : 0;
    return { inputs, P, bearCount, bearFraction: cfg.bearFraction };
}

// The solve's starting point for plan year k: the record the plan hands year k, and the spending
// the plan itself has in year k, as runRailsJob reads them. k = 0 is the plan's own start, which is
// what an After-Tax Spend answer starts from.
function solvePoint(h, k) {
    const rec = k === 0 ? h.spine.resumeStart : h.spine.log[k - 1]['-resume'];
    const planSpend = (k > 0 && h.ruleOn) ? h.spine.log[k].gkSpend : rec.sim.spendGoal;
    const at = (scale, mult) => resumeInputs(h.solveBase, rec, { balanceScale: scale, spendGoal: planSpend * mult });
    return { rec, planSpend, at, wealth: k > 0 ? h.spine.log[k - 1].totalNetWealth : null,
             year: h.spine.log[k].year };
}

let RUNS = 0, CRASHES = 0;
function survives(inp, pathIn) {
    RUNS++;
    let r;
    try { r = simulate({ ...inp, ...pathIn }); }
    catch (e) { CRASHES++; return false; }      // a crashed run is a failed path, as in the solver
    return !r.log.some(mc.yearIsRuined);
}

// Smallest wealth multiple this path survives at, the plan's own spending held.
function scaleNeeded(at, pathIn) {
    const [LO, HI] = S_RANGE;
    if (!survives(at(HI, 1), pathIn)) return NEVER;
    if (survives(at(LO, 1), pathIn)) return LO;
    let lo = Math.log(LO), hi = Math.log(HI);          // lo fails, hi survives
    for (let i = 0; i < PATH_STEPS; i++) {
        const mid = (lo + hi) / 2;
        if (survives(at(Math.exp(mid), 1), pathIn)) hi = mid; else lo = mid;
    }
    return Math.exp(hi);
}

// Largest spending multiple this path survives at, the plan's own wealth held.
function spendAffordable(at, pathIn) {
    const [LO, HI] = M_RANGE;
    if (!survives(at(1, LO), pathIn)) return 0;
    if (survives(at(1, HI), pathIn)) return HI;
    let lo = Math.log(LO), hi = Math.log(HI);          // lo survives, hi fails
    for (let i = 0; i < PATH_STEPS; i++) {
        const mid = (lo + hi) / 2;
        if (survives(at(1, Math.exp(mid)), pathIn)) lo = mid; else hi = mid;
    }
    return Math.exp(lo);
}

// Why a path that no wealth saves fails: its first ruined year, at the top of the search.
function whyNever(at, pathIn) {
    const r = simulate({ ...at(S_RANGE[1], 1), ...pathIn });
    const row = r.log.find(mc.yearIsRuined);
    if (!row) return null;
    const ret = Array.from(pathIn.returnSequence.slice(0, r.log.length));
    const inf = pathIn.inflationSequence ? Array.from(pathIn.inflationSequence.slice(0, r.log.length)) : [];
    return { year: row.year, spendGoal: row.spendGoal, guaranteedIncome: row.guaranteedIncome ?? 0,
             portfolioBalance: row.portfolioBalance, worstReturn: Math.min(...ret),
             worstInflation: inf.length ? Math.max(...inf) : null };
}

// The Normal preset's answers from a solve, in either message shape: the one-preset solver (runs
// before 11.1859, which --from can still re-print) put them on the year itself; the per-path solver
// puts every preset under `presets`.
function normalOf(y) {
    const p = y.presets ? y.presets.normal : y;
    return { upperScale: p.upperScale, lowerScale: p.lowerScale, spendTarget: p.spendTarget,
             spendAtUpper: p.spendAtUpper, spendAtLower: p.spendAtLower, clamped: p.clamped ?? {} };
}

// ---- part 1 and 2: the pools ----------------------------------------------------------------
function midK(n) {
    const half = Math.floor(n / 2);
    return 1 + SEED_CADENCE * Math.floor((half - 1) / SEED_CADENCE);
}

function poolTask({ plan, method }) {
    const h = household(plan);
    const t0 = performance.now();
    const bank = pathBank(h, method, 42, POOL_PATHS);
    const ks = [0, 1, midK(h.n)].filter((k, i, a) => k < h.n && a.indexOf(k) === i);
    const points = [];
    for (const k of ks) {
        const sp = solvePoint(h, k);
        const s = [], m = [], atPlan = [];
        let nonMonoS = 0, nonMonoM = 0;
        const never = [];
        for (let p = 0; p < bank.P; p++) {
            const pi = bank.inputs[p];
            atPlan.push(survives(sp.at(1, 1), pi) ? 1 : 0);
            m.push(spendAffordable(sp.at, pi));
            if (k > 0) {
                const sv = scaleNeeded(sp.at, pi);
                s.push(sv);
                if (sv === NEVER && never.length < 3) never.push({ path: p, ...whyNever(sp.at, pi) });
            }
            if (p < MONO_PATHS) {
                // Survival along a wealth grid, then along a spending grid: once it survives, more
                // wealth must keep it surviving, and once it fails, more spending must keep it failing.
                if (k > 0) {
                    let seen = false;
                    for (const g of MONO_GRID) {
                        const ok = survives(sp.at(g, 1), pi);
                        if (seen && !ok) { nonMonoS++; break; }
                        seen = seen || ok;
                    }
                }
                let failed = false;
                for (const g of MONO_GRID.filter(x => x <= M_RANGE[1])) {
                    const ok = survives(sp.at(1, g), pi);
                    if (failed && ok) { nonMonoM++; break; }
                    failed = failed || !ok;
                }
            }
        }
        points.push({ k, year: sp.year, wealth: sp.wealth, planSpend: sp.planSpend,
                      s, m, atPlan, nonMonoS, nonMonoM, monoChecked: Math.min(MONO_PATHS, bank.P), never });
    }
    return { kind: 'pool', engine: ENGINE, plan, method, n: h.n, P: bank.P, bearCount: bank.bearCount,
             bearFraction: bank.bearFraction, points, runs: RUNS, crashes: CRASHES, ms: performance.now() - t0 };
}

// ---- part 3: every year solved, once ------------------------------------------------------------
async function cadenceTask({ plan, method }) {
    const h = household(plan);
    const t0 = performance.now();
    const msg = await rails.runRailsJob({ base: h.inputs, cadence: 1,
                                          ...modelCfg(h, method, 42, CADENCE_PATHS) });
    const log = h.spine.log.map(r => ({ year: r.year, inflationFactor: r.inflationFactor,
                                        totalNetWealth: r.totalNetWealth }));
    let identity = null;
    if (plan === BANK_IDS[0] && method === 'bootstrap') {
        // The claim part 3 rests on: a job at cadence 3 is the cadence-1 job's every-third year.
        const c3 = await rails.runRailsJob({ base: h.inputs, cadence: 3,
                                             ...modelCfg(h, method, 42, CADENCE_PATHS) });
        const strip = y => JSON.stringify({ ...y, ms: 0 });
        const want = msg.years.filter(y => (y.k - 1) % 3 === 0);
        identity = { years: c3.years.length,
                     same: c3.years.length === want.length && c3.years.every((y, i) => strip(y) === strip(want[i])) };
    }
    return { kind: 'cadence', engine: ENGINE, plan, method, n: h.n, years: msg.years, log, cost: msg.cost, identity,
             ms: performance.now() - t0 };
}

// ---- part 2b and 4: the job a person would run, seed after seed --------------------------------
// The After-Tax Spend pass as P129 plans it: from the plan's own start, on the job's own paths, one
// estimate at the plan as it stands and nine halvings of the spending multiple.
function startSolve(h, method, seed, numPaths, target) {
    const t0 = performance.now();
    const runs0 = RUNS;
    const bank = pathBank(h, method, seed, numPaths);
    const sp = solvePoint(h, 0);
    const pos = mult => {
        let ok = 0;
        const inp = sp.at(1, mult);
        for (let p = 0; p < bank.P; p++) if (survives(inp, bank.inputs[p])) ok++;
        return ok / bank.P;
    };
    const pos0 = pos(1);
    let lo, hi, movedLo = false, movedHi = false;
    const up = pos0 >= target;
    [lo, hi] = up ? [1, LIVE_M_HI] : [LIVE_M_LO, 1];
    for (let i = 0; i < 9; i++) {
        const mid = (lo + hi) / 2;
        if (pos(mid) >= target) { lo = mid; movedLo = true; } else { hi = mid; movedHi = true; }
    }
    const mult = (lo + hi) / 2;
    return { pos0, mult, spendGoal: h.base.spendGoal * mult,
             clamped: up ? !movedHi : !movedLo,
             runs: RUNS - runs0, ms: performance.now() - t0 };
}

async function seedsTask({ plan, method }) {
    const h = household(plan);
    const t0 = performance.now();
    const target = RAIL_PRESETS.normal.target;
    const out = [];
    for (const seed of SEEDS) {
        const msg = await rails.runRailsJob({ base: h.inputs, cadence: SEED_CADENCE,
                                              ...modelCfg(h, method, seed, SEED_PATHS) });
        out.push({
            seed,
            years: msg.years.map(y => ({ k: y.k, year: y.year, pos: y.pos, wealth: y.wealth, planSpend: y.planSpend,
                                         ...normalOf(y) })),
            engine400: msg.start ? msg.start.answers.normal : null,
            start: startSolve(h, method, seed, SEED_PATHS, target),
            startHigh: startSolve(h, method, seed, START_PATHS_HIGH, target),
        });
    }
    return { kind: 'seeds', engine: ENGINE, plan, method, n: h.n, spendGoal: h.base.spendGoal, seeds: out,
             ms: performance.now() - t0 };
}

// ---- child mode -------------------------------------------------------------------------------
async function runTask(task) {
    if (task.kind === 'pool') return poolTask(task);
    if (task.kind === 'cadence') return cadenceTask(task);
    if (task.kind === 'seeds') return seedsTask(task);
    throw new Error('unknown task ' + task.kind);
}

if (process.argv[2] === '--child') {
    const task = JSON.parse(process.argv[3]);
    runTask(task).then(res => {
        fs.writeFileSync(task.out, JSON.stringify(res));
        process.exit(0);
    }, err => {
        console.error(err && err.stack || err);
        process.exit(1);
    });
    return;
}

// ---- the driver -------------------------------------------------------------------------------
function runChildren(tasks) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rails-precision-'));
    console.log(`Per-task results: ${dir} (re-print with --from <that directory>).\n`);
    let next = 0, done = 0;
    const results = new Array(tasks.length);
    const t0 = Date.now();
    return new Promise((resolve, reject) => {
        const launch = () => {
            if (next >= tasks.length) return;
            const i = next++;
            const task = { ...tasks[i], out: path.join(dir, `t${i}.json`) };
            const child = spawn(process.execPath, [__filename, '--child', JSON.stringify(task),
                                                   ...(QUICK ? ['--quick'] : [])],
                                { stdio: ['ignore', 'ignore', 'pipe'], env: process.env });
            let err = '';
            child.stderr.on('data', d => { err += d; });
            child.on('exit', code => {
                if (code !== 0) { reject(new Error(`${task.kind} ${task.plan} ${task.method}: ${err}`)); return; }
                results[i] = JSON.parse(fs.readFileSync(task.out, 'utf8'));
                done++;
                process.stderr.write(`  [${done}/${tasks.length}] ${task.kind} ${task.plan} ${task.method}`
                    + ` ${(results[i].ms / 1000).toFixed(0)}s (elapsed ${((Date.now() - t0) / 60000).toFixed(1)} min)\n`);
                if (done === tasks.length) resolve(results); else launch();
            });
        };
        for (let j = 0; j < Math.min(JOBS, tasks.length); j++) launch();
    });
}

// ---- statistics ---------------------------------------------------------------------------------
// The least count of surviving paths that the solver's own test (`ok / numPaths >= q`) accepts.
function countFor(N, q) {
    let c = 0;
    while (c < N && !(c / N >= q)) c++;
    return c;
}
// Rail: the smallest wealth multiple at which at least that count of the N paths survive.
function railOf(sAsc, q) {
    const c = countFor(sAsc.length, q);
    return c === 0 ? 0 : sAsc[c - 1];
}
// Target: the largest spending multiple at which at least that count survive.
function targetOf(mDesc, q) {
    const c = countFor(mDesc.length, q);
    return c === 0 ? Infinity : mDesc[c - 1];
}

// A CORRECTED count, for comparison only - the solver does not use it. The c-th smallest of N draws
// sits, on average, at the c / (N + 1) point of the distribution it came from, so asking for
// c = q x (N + 1) survivors puts the answer at q whatever N is. The solver's own rule asks for
// c = q x N, which lands lower, and lower still the fewer the paths. Capped at N: a q that needs more
// survivors than there are paths cannot be met at that N, and the cap then answers with the worst
// path - which is what `reachable` reports.
function correctedCount(N, q) {
    return Math.min(N, Math.ceil(q * (N + 1) - 1e-9));
}
function correctedReachable(N, q) {
    return q * (N + 1) - 1e-9 <= N;
}
function railOfCorrected(sAsc, q) {
    const c = correctedCount(sAsc.length, q);
    return c === 0 ? 0 : sAsc[c - 1];
}
function targetOfCorrected(mDesc, q) {
    const c = correctedCount(mDesc.length, q);
    return c === 0 ? Infinity : mDesc[c - 1];
}

// Disjoint N-path slices of a pool, stratified the way a Historical bank of N is.
function slices(P, bearCount, bearFraction, N) {
    const a = bearCount > 0 ? Math.floor(N * bearFraction / 100) : 0;
    const b = N - a;
    const count = Math.min(a > 0 ? Math.floor(bearCount / a) : Infinity, Math.floor((P - bearCount) / b));
    const out = [];
    for (let i = 0; i < count; i++) {
        const idx = [];
        for (let j = 0; j < a; j++) idx.push(i * a + j);
        for (let j = 0; j < b; j++) idx.push(bearCount + i * b + j);
        out.push(idx);
    }
    return out;
}

const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = xs => {
    if (xs.length < 2) return 0;
    const m = mean(xs);
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1));
};
const median = xs => {
    const a = xs.slice().sort((x, y) => x - y);
    return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : NaN;
};
const quantile = (xs, q) => {
    const a = xs.slice().sort((x, y) => x - y);
    return a[Math.min(a.length - 1, Math.max(0, Math.round(q * (a.length - 1))))];
};

// ---- printing -----------------------------------------------------------------------------------
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const pct = (x, d = 1) => Number.isFinite(x) ? (x * 100).toFixed(d) + '%' : '-';
const times = x => x >= NEVER ? 'never' : (Number.isFinite(x) ? x.toFixed(2) + 'x' : '-');
const money = x => Number.isFinite(x) ? '$' + Math.round(x).toLocaleString('en-US') : '-';
const METHOD_LABEL = { bootstrap: 'Historical', gbm: 'Synth GBM', aam: 'Synth AAM' };
const labelOf = id => id === PAGE_PLAN_ID ? 'page plan' : id;
function table(head, rows) {
    const w = head.map((h, i) => Math.max(String(h).length, ...rows.map(r => String(r[i]).length)));
    const line = cells => cells.map((c, i) => i === 0 ? pad(c, w[i]) : rpad(c, w[i])).join('  ');
    console.log(line(head));
    console.log(w.map(x => '-'.repeat(x)).join('  '));
    for (const r of rows) console.log(line(r));
    console.log('');
}

function printReach(pools) {
    console.log('== 1. REACH, at the first full year (pool of ' + POOL_PATHS + ' paths, seed 42) ==');
    console.log('How much of today\'s TotalNetWealth each share of paths needs, the plan\'s own spending held.');
    console.log('"never" = some path fails even at ' + S_RANGE[1] + 'x. The first run\'s solver stopped looking at '
        + LIVE_S_HI + 'x; the solver since 11.1859 looks to ' + NEW_S_HI + 'x.\n');
    const rows = [];
    for (const r of pools) {
        const pt = r.points.find(x => x.k === 1);
        if (!pt) continue;
        const s = pt.s.slice().sort((a, b) => a - b);
        const neverShare = s.filter(x => x >= NEVER).length / s.length;
        rows.push([labelOf(r.plan), METHOD_LABEL[r.method],
            pct(mean(pt.atPlan)), pct(s.filter(x => x > LIVE_S_HI).length / s.length, 2),
            pct(s.filter(x => x > NEW_S_HI).length / s.length, 2),
            pct(neverShare, 2),
            times(railOf(s, 0.70)), times(railOf(s, 0.90)), times(railOf(s, 0.99)),
            times(quantile(s, 0.999)), times(s[s.length - 1])]);
    }
    table(['household', 'method', 'PoS now', 'need >4x', 'need >16x', 'never', '70% at', '90% at', '99% at', '99.9% at', 'all ' + POOL_PATHS + ' at'], rows);
}

function sliceStats(r, pt, N, q, field) {
    const sl = slices(r.P, r.bearCount, r.bearFraction, N);
    const vals = [];
    for (const idx of sl) {
        if (field === 's') vals.push(railOf(idx.map(i => pt.s[i]).sort((a, b) => a - b), q));
        else vals.push(targetOf(idx.map(i => pt.m[i]).sort((a, b) => b - a), q));
    }
    return vals;
}

function printPrecision(pools) {
    console.log('== 2. PRECISION: an answer from N paths against the same answer from the whole pool ==');
    console.log('Per household and method, over disjoint N-path slices of the ' + POOL_PATHS + '-path pool. "bias" is the mean');
    console.log('slice answer over the pool answer, less 1; "spread" is the slices\' standard deviation over the pool answer.');
    console.log('Medians across households; a household whose pool answer is out of reach is left out of that cell.\n');

    const cell = (field, k, q, N, method) => {
        const bias = [], spread = [], clamp = [];
        for (const r of pools.filter(x => x.method === method)) {
            const pt = r.points.find(x => x.k === k);
            if (!pt || (field === 's' && !pt.s.length)) continue;
            const all = field === 's' ? railOf(pt.s.slice().sort((a, b) => a - b), q)
                                      : targetOf(pt.m.slice().sort((a, b) => b - a), q);
            const vals = sliceStats(r, pt, N, q, field);
            if (field === 's') clamp.push(vals.filter(v => v > LIVE_S_HI).length / vals.length);
            else clamp.push(vals.filter(v => v > LIVE_M_HI || v < LIVE_M_LO).length / vals.length);
            if (!(all > 0) || all >= NEVER || vals.some(v => v >= NEVER || !Number.isFinite(v))) continue;
            bias.push(mean(vals) / all - 1);
            spread.push(sd(vals) / all);
        }
        return { bias: median(bias), spread: median(spread), clamp: median(clamp), households: bias.length };
    };

    for (const method of METHODS) {
        console.log(`-- ${METHOD_LABEL[method]}: wealth rails at the first full year (the solve's "upperScale"/"lowerScale") --`);
        const rows = [];
        for (const q of THRESHOLDS) {
            const row = [pct(q, 0)];
            for (const N of SLICE_SIZES) {
                const c = cell('s', 1, q, N, method);
                row.push(`${pct(c.bias)} / ${pct(c.spread)}`);
            }
            const c1 = cell('s', 1, q, SLICE_SIZES[0], method);
            row.push(pct(c1.clamp, 0), String(c1.households));
            rows.push(row);
        }
        table(['survive', ...SLICE_SIZES.map(N => `N=${N} bias/spread`), `>4x at N=${SLICE_SIZES[0]}`, 'households'], rows);

        console.log(`-- ${METHOD_LABEL[method]}: target spending ("Spend at target"), first full year and plan start --`);
        const rows2 = [];
        for (const k of [1, 0]) {
            for (const q of [0.80, 0.90, 0.95]) {
                const row = [k === 0 ? `start ${pct(q, 0)}` : `year 1 ${pct(q, 0)}`];
                for (const N of SLICE_SIZES) {
                    const c = cell('m', k, q, N, method);
                    row.push(`${pct(c.bias)} / ${pct(c.spread)}`);
                }
                rows2.push(row);
            }
        }
        table(['answer', ...SLICE_SIZES.map(N => `N=${N} bias/spread`)], rows2);
    }

    console.log('-- What "99%" and "100%" become at each path count, as the pool percentile of `s` they land on --');
    console.log('(the share of the pool that needs no more wealth than the N-path answer; medians across households)\n');
    const rows3 = [];
    for (const method of METHODS) {
        for (const q of [0.99, 1.00]) {
            const row = [METHOD_LABEL[method], pct(q, 0)];
            for (const N of SLICE_SIZES) {
                const got = [];
                for (const r of pools.filter(x => x.method === method)) {
                    const pt = r.points.find(x => x.k === 1);
                    if (!pt) continue;
                    const sAsc = pt.s.slice().sort((a, b) => a - b);
                    if (sAsc[sAsc.length - 1] >= NEVER && q === 1) continue;
                    const vals = sliceStats(r, pt, N, q, 's');
                    got.push(mean(vals.map(v => sAsc.filter(x => x <= v).length / sAsc.length)));
                }
                row.push(pct(median(got), 2));
            }
            rows3.push(row);
        }
    }
    table(['method', 'asked', ...SLICE_SIZES.map(N => `N=${N} lands on`)], rows3);

    console.log('-- Monotonicity the pools rest on (paths checked along a ' + MONO_GRID.length + '-point grid) --');
    const rows4 = [];
    for (const r of pools) {
        for (const pt of r.points) {
            if (!pt.nonMonoS && !pt.nonMonoM) continue;
            rows4.push([labelOf(r.plan), METHOD_LABEL[r.method], pt.k, pt.monoChecked, pt.nonMonoS, pt.nonMonoM]);
        }
    }
    const checked = pools.reduce((a, r) => a + r.points.reduce((b, pt) => b + pt.monoChecked, 0), 0);
    console.log(`${checked} path checks; ${rows4.length} household/method/year combinations with any non-monotone path.`);
    if (rows4.length) table(['household', 'method', 'k', 'checked', 'wealth: survive then fail', 'spend: fail then survive'], rows4);
    else console.log('');

    console.log('-- Paths no wealth saves (first full year), and why --');
    let any = false;
    for (const r of pools) {
        const pt = r.points.find(x => x.k === 1);
        if (!pt || !pt.never.length) continue;
        any = true;
        const count = pt.s.filter(x => x >= NEVER).length;
        console.log(`${labelOf(r.plan)} / ${METHOD_LABEL[r.method]}: ${count} of ${pt.s.length}. First: `
            + pt.never.map(x => `path ${x.path} ruined in ${x.year} (needs ${money(x.spendGoal - x.guaranteedIncome)}, `
                + `holds ${money(x.portfolioBalance)}, worst return ${pct(x.worstReturn)}, `
                + `worst inflation ${pct(x.worstInflation)})`).join('; '));
    }
    if (!any) console.log('None.');
    console.log('');
}

// The raise rails, answered two ways from the same slices: the solver's rule and the corrected count.
// Printed as the pool percentile each lands on (what the answer MEANS) and its spread (how far one
// run's answer sits from another's), because a rule can fix the first and do nothing for the second.
function printCorrection(pools) {
    console.log('== 2c. A PATH-COUNT CORRECTION for the raise rails, measured on the same slices ==');
    console.log('"as solved" is the rule the live solve uses (the least count c with c / N >= q). "corrected" asks for');
    console.log('c = q x (N + 1), capped at N; "-" where q cannot be met at that N. Each cell: the pool percentile the');
    console.log('answer lands on / the spread of the answer. Medians across households, first full year.\n');
    const qs = [0.99, 0.995, 1.00];
    const rows = [];
    for (const method of METHODS) {
        for (const q of qs) {
            for (const rule of ['as solved', 'corrected']) {
                const row = [METHOD_LABEL[method], pct(q, 1), rule];
                for (const N of SLICE_SIZES) {
                    if (rule === 'corrected' && !correctedReachable(N, q)) { row.push('-'); continue; }
                    const lands = [], spreads = [];
                    for (const r of pools.filter(x => x.method === method)) {
                        const pt = r.points.find(x => x.k === 1);
                        if (!pt) continue;
                        const sAsc = pt.s.slice().sort((a, b) => a - b);
                        const vals = slices(r.P, r.bearCount, r.bearFraction, N).map(idx => {
                            const sub = idx.map(i => pt.s[i]).sort((a, b) => a - b);
                            return rule === 'corrected' ? railOfCorrected(sub, q) : railOf(sub, q);
                        });
                        if (vals.some(v => v >= NEVER)) continue;
                        lands.push(mean(vals.map(v => sAsc.filter(x => x <= v).length / sAsc.length)));
                        spreads.push(sd(vals) / mean(vals));
                    }
                    row.push(lands.length ? `${pct(median(lands), 2)} / ${pct(median(spreads))}` : 'n/a');
                }
                rows.push(row);
            }
        }
    }
    table(['method', 'asked', 'rule', ...SLICE_SIZES.map(N => `N=${N} lands / spread`)], rows);

    console.log('-- The same correction on the target spend ("Spend at target"), first full year: bias / spread --\n');
    const rows2 = [];
    for (const method of METHODS) {
        for (const q of [0.80, 0.90, 0.95]) {
            for (const rule of ['as solved', 'corrected']) {
                const row = [METHOD_LABEL[method], pct(q, 0), rule];
                for (const N of SLICE_SIZES) {
                    const bias = [], spread = [];
                    for (const r of pools.filter(x => x.method === method)) {
                        const pt = r.points.find(x => x.k === 1);
                        if (!pt) continue;
                        const mDesc = pt.m.slice().sort((a, b) => b - a);
                        const all = targetOf(mDesc, q);
                        const vals = slices(r.P, r.bearCount, r.bearFraction, N).map(idx => {
                            const sub = idx.map(i => pt.m[i]).sort((a, b) => b - a);
                            return rule === 'corrected' ? targetOfCorrected(sub, q) : targetOf(sub, q);
                        });
                        if (!(all > 0) || !Number.isFinite(all) || vals.some(v => !Number.isFinite(v))) continue;
                        bias.push(mean(vals) / all - 1);
                        spread.push(sd(vals) / all);
                    }
                    row.push(`${pct(median(bias))} / ${pct(median(spread))}`);
                }
                rows2.push(row);
            }
        }
    }
    table(['method', 'asked', 'rule', ...SLICE_SIZES.map(N => `N=${N}`)], rows2);
}

function interpolate(years, log, cadence) {
    const solved = years.filter(y => (y.k - 1) % cadence === 0);
    const rows = rails.railsRowFields({ years: solved }, log);
    return rows;
}

function printCadence(cadences) {
    console.log('== 3. CADENCE: the lines between solved years, against solving that year (Normal, '
        + CADENCE_PATHS + ' paths, seed 42) ==');
    console.log('Error of each interpolated value against the every-year solve, as a share of that row\'s own');
    console.log('TotalNetWealth (the two wealth rails) or of the plan\'s spending that year (the three spending lines).');
    console.log('Median and 90th percentile of |error| over every interpolated row.\n');
    const ident = cadences.find(r => r.identity);
    if (ident) console.log(`Identity check (${labelOf(ident.plan)}, Historical): a cadence-3 job `
        + `${ident.identity.same ? 'IS' : 'is NOT'} the every-year job's every third year (${ident.identity.years} solves).\n`);
    // Each column, the solve field whose clamp flag governs it.
    const keys = [['railUpper', 'w', 'upper'], ['railLower', 'w', 'lower'], ['railSpend', 's', 'target'],
                  ['railSpendUp', 's', 'spendUp'], ['railSpendDn', 's', 'spendDn']];
    const rows = [];
    for (const method of CADENCE_METHODS) {
        for (const c of CADENCES) {
            const errs = Object.fromEntries(keys.map(([k]) => [k, []]));
            let clampedRows = 0;
            for (const r of cadences.filter(x => x.method === method)) {
                const full = rails.railsRowFields({ years: r.years }, r.log);
                const part = interpolate(r.years, r.log, c);
                // Solves by the year they solve for. A wealth rail on row i belongs to the solve for
                // the year after; a spending line on row i to the solve for that row's own year.
                const byYear = new Map(r.years.map(y => [y.year, y]));
                const solvedC = r.years.filter(y => (y.k - 1) % c === 0);
                for (let i = 0; i < r.log.length; i++) {
                    const a = full[i], b = part[i];
                    if (!a || !b) continue;
                    for (const [k, unit, flag] of keys) {
                        if (a[k] == null || b[k] == null) continue;
                        const interpWealth = unit === 'w' && String(b.railBasis).startsWith('interp');
                        // A spending line's basis is on the row above it.
                        const interpSpend = unit === 's' && i > 0 && part[i - 1] && String(part[i - 1].railBasis).startsWith('interp');
                        if (!interpWealth && !interpSpend) continue;
                        const solveYear = r.log[i].year + (unit === 'w' ? 1 : 0);
                        const own = byYear.get(solveYear);
                        // An answer at the edge of its search is a bound, not a value: leave out any row
                        // whose own solve, or either solve it was interpolated from, hit the edge.
                        const before = solvedC.filter(y => y.year < solveYear).pop();
                        const after = solvedC.find(y => y.year > solveYear);
                        if ([own, before, after].some(y => y && normalOf(y).clamped[flag])) { clampedRows++; continue; }
                        const denom = unit === 'w' ? r.log[i].totalNetWealth : own?.planSpend;
                        if (!(denom > 0)) continue;
                        errs[k].push(Math.abs(b[k] - a[k]) / denom);
                    }
                }
            }
            rows.push([METHOD_LABEL[method], `every ${c}`,
                ...keys.map(([k]) => errs[k].length ? `${pct(median(errs[k]))} / ${pct(quantile(errs[k], 0.9))}` : '-'),
                String(errs.railUpper.length + errs.railSpend.length), String(clampedRows)]);
        }
    }
    table(['method', 'cadence', 'raise rail', 'cut rail', 'spend at target', 'spend at raise', 'spend at cut',
           'rows', 'skipped (clamped)'], rows);

    console.log('-- The same job solved every year, cost --');
    const rows2 = cadences.map(r => [labelOf(r.plan), METHOD_LABEL[r.method], r.n, r.years.length,
        r.cost.runs.toLocaleString('en-US'), (r.cost.solveMs / 1000).toFixed(0) + ' s',
        (r.cost.msPerRun).toFixed(2), r.years.filter(y => Object.values(normalOf(y).clamped).some(Boolean)).length]);
    table(['household', 'method', 'years', 'solves', 'runs', 'solve time (loaded)', 'ms/run', 'solves with a clamp'], rows2);
}

function printSeeds(seedRuns) {
    console.log('== 2b. THE JOB A PERSON WOULD RUN: Normal, ' + SEED_PATHS + ' paths, every ' + SEED_CADENCE
        + ' years, seeds ' + SEEDS[0] + '-' + SEEDS[SEEDS.length - 1] + ' ==');
    console.log('Spread across seeds (standard deviation over the mean) at the first full year and at every solved year,');
    console.log('and how often each answer hit the edge of its search.\n');
    const fields = [['upperScale', 'raise rail'], ['lowerScale', 'cut rail'], ['spendTarget', 'spend at target'],
                    ['spendAtUpper', 'spend at raise'], ['spendAtLower', 'spend at cut']];
    const rows = [];
    for (const r of seedRuns) {
        const first = fields.map(([f]) => {
            const vals = r.seeds.map(s => s.years[0]?.[f]).filter(Number.isFinite);
            return pct(sd(vals) / mean(vals));
        });
        const everyYear = fields.map(([f]) => {
            const per = r.seeds[0].years.map((_, j) => {
                const vals = r.seeds.map(s => s.years[j]?.[f]).filter(Number.isFinite);
                return sd(vals) / mean(vals);
            });
            return pct(median(per));
        });
        const pos = r.seeds.map(s => s.years[0]?.pos);
        const clampShare = (() => {
            let n = 0, c = 0;
            for (const s of r.seeds) for (const y of s.years) { n++; if (y.clamped.upper) c++; }
            return c / n;
        })();
        rows.push([labelOf(r.plan), METHOD_LABEL[r.method],
            `${pct(mean(pos))} +/- ${pct(sd(pos))}`,
            ...first.map((f, i) => `${f} (${everyYear[i]})`), pct(clampShare, 0)]);
    }
    table(['household', 'method', 'PoS year 1', ...fields.map(([, l]) => l + ' yr1 (all)'), 'raise clamped'], rows);

    console.log('-- After-Tax Spend for a 90% chance, from the plan\'s start (P129 prototype) --');
    console.log('Mean and spread across seeds, at ' + SEED_PATHS + ' and ' + START_PATHS_HIGH + ' paths; the plan\'s own goal for scale.');
    console.log('"Page" is the answer the page itself shows, from the same jobs (its own 400 paths, rounded to $100');
    console.log('on the page); runs made before 11.1859 did not record it.\n');
    const rows2 = [];
    for (const r of seedRuns) {
        const lo = r.seeds.map(s => s.start), hi = r.seeds.map(s => s.startHigh);
        const g = v => v.map(x => x.spendGoal);
        const live = r.seeds.map(s => s.engine400?.spendGoal).filter(v => v != null);
        rows2.push([labelOf(r.plan), METHOD_LABEL[r.method], money(r.spendGoal),
            `${pct(mean(lo.map(x => x.pos0)))}`,
            `${money(mean(g(lo)))} +/- ${pct(sd(g(lo)) / mean(g(lo)))}`,
            `${money(Math.min(...g(lo)))}-${money(Math.max(...g(lo)))}`,
            `${money(mean(g(hi)))} +/- ${pct(sd(g(hi)) / mean(g(hi)))}`,
            live.length ? `${money(mean(live))} +/- ${pct(sd(live) / mean(live))}` : '-',
            `${lo.filter(x => x.clamped).length}/${hi.filter(x => x.clamped).length}`,
            `${Math.round(mean(lo.map(x => x.ms)))} ms / ${lo[0].runs}`]);
    }
    table(['household', 'method', 'plan goal', `PoS at goal (N=${SEED_PATHS})`, `N=${SEED_PATHS} answer`,
           `N=${SEED_PATHS} range`, `N=${START_PATHS_HIGH} answer`, 'page (400 paths)', 'clamped lo/hi',
           'cost (loaded), runs'], rows2);
}

async function printTiming() {
    console.log('== 4. COST, measured one job at a time on an otherwise idle process (Historical) ==');
    console.log(`Machine: ${os.cpus()[0].model.trim()}, node ${process.version}, page ${ENGINE}. Minimum of ${TIMING_REPEATS} runs where repeated.`);
    console.log('A job solves every preset at once and includes the After-Tax Spend answer on its own 400 paths. A');
    console.log('browser worker adds its own start-up and transfer, which the panel reports separately.\n');
    // Every household once; the first one repeated, which is what the spread line below reports.
    const rows = [];
    const repeats = [];
    for (const id of HOUSEHOLDS) {
        const h = household(id);
        const reps = id === HOUSEHOLDS[0] ? TIMING_REPEATS : 1;
        let c3 = null;
        for (let i = 0; i < reps; i++) {
            const msg = await rails.runRailsJob({ base: h.inputs, cadence: 3, ...modelCfg(h, 'bootstrap', 42, 100) });
            if (id === HOUSEHOLDS[0]) repeats.push(msg.cost.totalMs);
            if (!c3 || msg.cost.totalMs < c3.cost.totalMs) c3 = msg;
        }
        const pj = (cadence, paths) => rails.railsProjectMs(c3.cost, h.n, { cadence, numPaths: paths }).ms / 1000;
        const start = c3.start ? c3.start.ms : 0;
        rows.push([labelOf(id), h.n, c3.years.length, c3.cost.runs.toLocaleString('en-US'),
            (c3.cost.runsPerPathYear ?? 0).toFixed(1),
            (c3.cost.totalMs / 1000).toFixed(2) + ' s', `${Math.round(start)} ms`,
            pj(5, 200).toFixed(1) + ' s', pj(3, 500).toFixed(1) + ' s', pj(3, 1000).toFixed(1) + ' s',
            `${(c3.cost.totalMs * 3.5 / 1000).toFixed(1)}-${(c3.cost.totalMs * 6 / 1000).toFixed(1)} s`]);
    }
    table(['household', 'years', 'solves', 'runs (3y/100)', 'runs a path a year', 'every 3, 100 paths',
           'of it, After-Tax Spend', 'every 5, 200 (proj.)', 'every 3, 500 (proj.)', 'every 3, 1000 (proj.)',
           'every 3, 100, at 3.5-6x slower'], rows);
    if (repeats.length > 1) {
        console.log(`Repeat spread, ${labelOf(HOUSEHOLDS[0])}, every 3 at 100 paths: `
            + repeats.map(ms => (ms / 1000).toFixed(2) + ' s').join(', ') + '.');
    }

    // The projection is only as good as its check.
    const h = household(HOUSEHOLDS[0]);
    const c3 = await rails.runRailsJob({ base: h.inputs, cadence: 3, ...modelCfg(h, 'bootstrap', 42, 100) });
    const big = await rails.runRailsJob({ base: h.inputs, cadence: 3, ...modelCfg(h, 'bootstrap', 42, QUICK ? 200 : 500) });
    const pj = rails.railsProjectMs(c3.cost, h.n, { cadence: 3, numPaths: big.numPaths });
    console.log(`Projection check, ${labelOf(h.id)}: every 3 years at ${big.numPaths} paths projected `
        + `${(pj.ms / 1000).toFixed(2)} s from the 100-path run and took ${(big.cost.totalMs / 1000).toFixed(2)} s.\n`);

    // P129's premise: scaling the start record's goal is the same plan as typing the scaled goal.
    const sp = solvePoint(h, 0);
    const bank = pathBank(h, 'bootstrap', 42, 20);
    let same = 0, total = 0;
    for (const mult of [0.7, 1, 1.3]) {
        for (let p = 0; p < bank.P; p++) {
            total++;
            const a = survives(sp.at(1, mult), bank.inputs[p]);
            const b = survives({ ...h.solveBase, spendGoal: h.solveBase.spendGoal * mult }, bank.inputs[p]);
            if (a === b) same++;
        }
    }
    console.log(`Start-record check, ${labelOf(h.id)}: scaling the plan-start record's goal and typing the scaled `
        + `goal agree on ${same} of ${total} path runs.\n`);
}

(async () => {
    const t0 = Date.now();
    console.log(`rails_precision_harness${QUICK ? ' (--quick)' : ''}: ${HOUSEHOLDS.length} households, `
        + `pool ${POOL_PATHS} paths, ${JOBS} processes at once. Page on disk: ${ENGINE}.\n`);
    if (TIMING_ONLY) {
        await printTiming();
        console.log(`Done in ${((Date.now() - t0) / 60000).toFixed(1)} min.`);
        return;
    }
    const tasks = [];
    for (const plan of HOUSEHOLDS) {
        for (const method of METHODS) tasks.push({ kind: 'pool', plan, method });
        for (const method of METHODS) tasks.push({ kind: 'seeds', plan, method });
        for (const method of CADENCE_METHODS) tasks.push({ kind: 'cadence', plan, method });
    }
    const results = FROM
        ? tasks.map((t, i) => {
            const r = JSON.parse(fs.readFileSync(path.join(FROM, `t${i}.json`), 'utf8'));
            if (r.kind !== t.kind || r.plan !== t.plan || r.method !== t.method) {
                throw new Error(`--from: t${i}.json is ${r.kind} ${r.plan} ${r.method}, expected ${t.kind} ${t.plan} ${t.method}`
                    + ' (same USER_PLAN and --quick as the run?)');
            }
            return r;
        })
        : await runChildren(tasks);
    // A re-print describes the engine that RAN, not the page on disk now. Runs made before this field
    // existed (the first, 2026-09-16) did not record it; that run was on 11.1857.
    if (FROM) {
        const engines = [...new Set(results.map(r => r.engine ?? 'not recorded'))];
        console.log(`Re-printed from ${FROM}; the run's engine: ${engines.join(', ')}.\n`);
    }
    const pools = results.filter(r => r.kind === 'pool');
    const cadences = results.filter(r => r.kind === 'cadence');
    const seedRuns = results.filter(r => r.kind === 'seeds');
    const crashes = pools.reduce((a, r) => a + r.crashes, 0);
    const runs = pools.reduce((a, r) => a + r.runs, 0);
    console.log(`Pools: ${runs.toLocaleString('en-US')} engine runs, ${crashes} crashed.\n`);
    printReach(pools);
    printPrecision(pools);
    printCorrection(pools);
    printSeeds(seedRuns);
    printCadence(cadences);
    if (!NO_TIMING) await printTiming();
    console.log(`Done in ${((Date.now() - t0) / 60000).toFixed(1)} min.`);
})().catch(e => { console.error(e); process.exit(1); });
