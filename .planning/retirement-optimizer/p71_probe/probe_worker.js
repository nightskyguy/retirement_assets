// P71a A/B probe. Loads a repo's montecarlo/worker.js under a worker shim and hashes the results
// of a fixed-seed run in every mode. Two roots must print identical hashes.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');

const root = path.resolve(process.argv[2]);
const mcDir = path.join(root, 'montecarlo');

const sandbox = {};
sandbox.globalThis = sandbox;
sandbox.self = { location: { search: '' } };
sandbox.performance = { now: () => 0 };
sandbox.console = console;
sandbox.window = undefined;
sandbox.module = undefined;
const msgs = [];
sandbox.postMessage = m => { if (m.type === 'results') msgs.push(m); };
sandbox.self.postMessage = sandbox.postMessage;
sandbox.importScripts = function (...files) {
    for (const f of files) {
        const rel = f.split('?')[0];
        const p = path.resolve(mcDir, rel);
        vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: p });
    }
};
const ctx = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(mcDir, 'worker.js'), 'utf8'), ctx,
                { filename: 'worker.js' });

const { SWEEP_BASES } = require(path.join(root, 'sweep_golden.js'));
const baseName = Object.keys(SWEEP_BASES)[0];
const base = SWEEP_BASES[baseName];
const variations = ctx.buildVariations(base).slice(0, 3);

function round(x) { return (typeof x === 'number' && isFinite(x)) ? x.toPrecision(17) : x; }

// The worker's onmessage is async since P71b (runJob returns a promise), so a result may land a
// microtask after the call returns. Poll rather than assume synchrony; the pre-P71b worker resolves
// on the first check.
const settle = () => new Promise(r => setImmediate(r));

(async () => {
    const out = {};
    for (const mode of ['gbm', 'aam', 'bootstrap']) {
        msgs.length = 0;
        ctx.self.onmessage({ data: {
            variations, years: 30, numPaths: 25, seed: 42, simulationMode: mode,
            mu: 0.07, sigma: 0.15, inflationRate: 0.03, runStress: false,
        }});
        for (let i = 0; i < 100 && !msgs.length; i++) await settle();
        const r = msgs[msgs.length - 1];
        if (!r) { out[mode] = 'ERROR no result message'; continue; }
        if (r.error) { out[mode] = 'ERROR ' + r.error; continue; }
        out[mode] = JSON.stringify(r, (k, v) => {
            if (v instanceof Float64Array || v instanceof Float32Array) return Array.from(v).map(round);
            return typeof v === 'number' ? round(v) : v;
        });
    }
    for (const mode of Object.keys(out)) {
        const v = out[mode];
        console.log(mode.padEnd(10),
            v.startsWith('ERROR') ? v : crypto.createHash('sha256').update(v).digest('hex').slice(0, 32)
            + '  len=' + v.length);
    }
})();
