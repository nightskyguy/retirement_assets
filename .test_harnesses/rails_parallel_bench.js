'use strict';
/**
 * rails_parallel_bench.js -- how much faster the rails job (P128) gets when its solved years are
 * split across worker threads, and what that says about a compute server (P132f).
 *
 * Run:  node .test_harnesses/rails_parallel_bench.js                (bracket-filler-texas, 1/2/4/8/16 threads)
 *       node .test_harnesses/rails_parallel_bench.js --plan long-widowhood --threads 1,4,8
 *       node .test_harnesses/rails_parallel_bench.js --paths 200 --cadence 1
 *
 * WHY. A solved year resumes the plan from the spine and never reads another year's answer, so the
 * job is parallel across its solved years for free. The same split works in the browser with one
 * Web Worker per year on the page's own worker file. Measured here in node's worker_threads, which
 * is the same engine the page runs (the harness loads exactly the files the worker imports), so the
 * numbers are the browser's up to the page's fixed costs.
 *
 * WHAT IS PRINTED. Per thread count: wall time, the sum of the threads' own solve times, the speedup
 * against one thread, and whether the merged answers are identical to the single-thread job's (they
 * must be: each year is solved on the same paths whichever thread holds it). Then a projection for
 * the audience's machines, which are 3.5 to 6 times slower per core (research/RISK_BASED_RAILS_PRECISION.md)
 * and have 2 to 4 cores.
 */

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const path = require('path');
const fs = require('fs');

function loadEngine() {
    globalThis.window = {};
    globalThis.document = { getElementById: () => null, addEventListener: () => {} };
    Object.assign(globalThis, require('../taxengine.js'));
    const core = require('../optimizer_core.js');
    Object.assign(globalThis, core);
    Object.assign(globalThis, require('../montecarlo/prng.js'));
    Object.assign(globalThis, require('../montecarlo/stats.js'));
    Object.assign(globalThis, require('../montecarlo/historical_returns.js'));
    require('../montecarlo/mc_engine.js');
    return { core, rails: require('../montecarlo/rails_engine.js') };
}

if (!isMainThread) {
    const { rails } = loadEngine();
    const { cfg } = workerData;
    rails.runRailsJob(cfg).then(msg => parentPort.postMessage(msg), err => { throw err; });
    return;
}

const argv = process.argv.slice(2);
const opt = (name, d) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const PLAN = opt('--plan', 'bracket-filler-texas');
const PATHS = Number(opt('--paths', 100));
const CADENCE = Number(opt('--cadence', 3));
const THREADS = opt('--threads', '1,2,4,8,16').split(',').map(Number);
const REPEATS = Number(opt('--repeats', 2));

const { core, rails } = loadEngine();
const PLANS = require('../plans');
const ENGINE = fs.readFileSync(path.join(__dirname, '..', 'retirement_optimizer.html'), 'utf8')
    .match(/<title>[^<]*?([\d.]+\w*)<\/title>/)?.[1] ?? '?';

const inputs = PLANS.get(PLAN).inputs;
const base = { ...inputs, computeOC: false, captureResume: false, resume: undefined, spendRule: '' };
const n = core.simulate(base).log.length;
const solved = rails.railsSolvedYears(n, CADENCE);
const cfgOf = extra => ({ base, cadence: CADENCE, numPaths: PATHS, simulationMode: 'gbm', seed: 42, mu: base.growth, sigma: 0.12,
                          bearFraction: 25, inflationRate: base.inflation, ...extra });

function runInWorker(cfg) {
    return new Promise((resolve, reject) => {
        const w = new Worker(__filename, { workerData: { cfg } });
        w.once('message', resolve);
        w.once('error', reject);
    });
}

// The years dealt round-robin, so every thread gets a mix of long (early) and short (late) years;
// the start answer rides with the first thread.
async function runSplit(threads) {
    const buckets = Array.from({ length: threads }, () => []);
    solved.forEach((k, i) => buckets[i % threads].push(k));
    const t0 = performance.now();
    const msgs = await Promise.all(buckets.map((ks, i) => runInWorker(cfgOf({ solveYears: ks, skipStart: i > 0 }))));
    const wall = performance.now() - t0;
    const years = msgs.flatMap(m => m.years).sort((a, b) => a.k - b.k);
    const busy = msgs.reduce((s, m) => s + m.cost.totalMs, 0);
    return { wall, busy, years, start: msgs[0].start, runs: msgs.reduce((s, m) => s + m.cost.runs, 0) };
}

const sameAnswers = (a, b) => JSON.stringify(a.map(y => [y.k, y.pos, y.presets])) === JSON.stringify(b.map(y => [y.k, y.pos, y.presets]));

(async () => {
    console.log(`# rails_parallel_bench.js - engine ${ENGINE}, ${PLAN} (${n} years, ${solved.length} solved years at cadence ${CADENCE}), ${PATHS} paths, ${os.cpus().length} logical cores, node ${process.version}\n`);
    let ref = null;
    console.log('| threads | wall | sum of thread time | speedup | efficiency | runs | answers identical |');
    console.log('|---|---|---|---|---|---|---|');
    const rows = [];
    for (const t of THREADS) {
        let best = null;
        for (let r = 0; r < REPEATS; r++) {
            const res = await runSplit(t);
            if (!best || res.wall < best.wall) best = res;
        }
        if (t === 1) ref = best;
        const same = ref ? sameAnswers(ref.years, best.years) : true;
        rows.push({ t, ...best, same });
        console.log(`| ${t} | ${(best.wall / 1000).toFixed(2)} s | ${(best.busy / 1000).toFixed(2)} s | ${(ref.wall / best.wall).toFixed(2)}x | ${(ref.wall / best.wall / t * 100).toFixed(0)}% | ${best.runs.toLocaleString()} | ${same ? 'yes' : 'NO'} |`);
    }
    console.log('\nBest of ' + REPEATS + ' repeats. Efficiency is speedup over threads; below 100% is the longest year setting the wall, plus thread startup (engine load, bank build) paid once per thread.');
    console.log('\n## Projected on the audience\'s machines\n');
    console.log('Per-core speed 3.5x to 6x slower than this one (single-core is what a browser gets), with the cores it has.\n');
    console.log('| cores on the laptop | this bench at that thread count | projected wall, 3.5x slower | 6x slower |');
    console.log('|---|---|---|---|');
    for (const c of [1, 2, 4]) {
        const row = rows.find(r => r.t === c) ?? rows[0];
        console.log(`| ${c} | ${(row.wall / 1000).toFixed(1)} s | ${(row.wall * 3.5 / 1000).toFixed(0)} s | ${(row.wall * 6 / 1000).toFixed(0)} s |`);
    }
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
