// P71a A/B probe, main-thread half: _runMCMainThread() in mc_controller.js.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const root = path.resolve(process.argv[2]);
const mcDir = path.join(root, 'montecarlo');
const sandbox = {};
sandbox.globalThis = sandbox;
sandbox.console = console;
sandbox.performance = { now: () => 0 };
sandbox.setTimeout = setTimeout;
sandbox.window = { location: { protocol: 'https:' } };
sandbox.Worker = undefined;
const ctx = vm.createContext(sandbox);
const load = p => vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p });
// mc_engine.js is loaded only if the root has one: the pre-P71c staging copy does not, and the
// probe must run against both roots to be an A/B at all.
const files = ['../taxengine.js', '../optimizer_core.js', 'prng.js', 'stats.js',
               'historical_returns.js', 'mc_engine.js', 'mc_controller.js'];
for (const f of files) {
    const abs = path.resolve(mcDir, f);
    if (f === 'mc_engine.js' && !fs.existsSync(abs)) continue;
    load(abs);
}

const { SWEEP_BASES } = require(path.join(root, 'sweep_golden.js'));
const base = SWEEP_BASES[Object.keys(SWEEP_BASES)[0]];
const variations = ctx.buildVariations(base).slice(0, 3);
const round = x => (typeof x === 'number' && isFinite(x)) ? x.toPrecision(17) : x;

(async () => {
    for (const mode of ['gbm', 'aam', 'bootstrap']) {
        const res = await new Promise((resolve, reject) => {
            try {
                ctx._runMCMainThread({ variations, years: 30, numPaths: 25, seed: 42,
                    simulationMode: mode, mu: 0.07, sigma: 0.15, inflationRate: 0.03,
                    runStress: false }, () => {}, resolve);
            } catch (e) { reject(e); }
        });
        const s = JSON.stringify(res, (k, v) => {
            if (v instanceof Float64Array || v instanceof Float32Array) return Array.from(v).map(round);
            return typeof v === 'number' ? round(v) : v;
        });
        console.log(mode.padEnd(10),
            crypto.createHash('sha256').update(s).digest('hex').slice(0, 32) + '  len=' + s.length);
    }
})().catch(e => { console.log('FAILED:', e.message); process.exit(1); });
