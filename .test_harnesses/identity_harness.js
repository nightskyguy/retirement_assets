'use strict';
/**
 * identity_harness.js -- the byte-identity check a refactor has to pass.
 *
 * Run:  node .test_harnesses/identity_harness.js --out before.json
 *       ...refactor...
 *       node .test_harnesses/identity_harness.js --check before.json
 *
 *       --plans a,b,c   only these plan ids            --paths 100   Monte Carlo paths per mode
 *       --no-mc         skip the Monte Carlo section    --max-diff 20 how many differences to print
 *
 * WHAT IT IS FOR. A refactor that moves a literal into a named constant, or a string comparison onto
 * an enum, is supposed to change NOTHING a run produces. A green test suite does not prove that: the
 * suites assert invariants and a few hundred specific figures, and the engine emits tens of thousands
 * of numbers per plan. This walks the whole output and compares it field by field.
 *
 * WHAT IT WALKS, per household in `plans/`:
 *   1. `simulate()` - every field of every year's log row, plus totals and the summary.
 *   2. The two optimizers, `optimizeSpend` and `optimizeConversionAmount`, and the two solvers whose
 *      epsilons and search bounds step D touches: `breakEvenHeirsRate`, `suggestSustainableSpend`.
 *   3. The sweep: `buildVariations` for the plan, each variation simulated and summarized. Capped per
 *      plan (see SWEEP_CAP) because the full grid times 20 households is minutes, not seconds, and
 *      the variations past the cap exercise no code the first ones do not.
 *   4. Monte Carlo through `runJob`, in gbm, bootstrap and aam, with the stress pass on. Fixed seed,
 *      so every path is reproducible; the recorded numbers are the per-variation aggregates and the
 *      stress table, not the path arrays, which are megabytes of Float64Array per mode.
 *
 * WHY A HASH IS NOT ENOUGH. It reports WHICH field of WHICH year of WHICH household moved, and by how
 * much. A hash tells you only that something did, which is the answer you already had from suspicion.
 *
 * NON-FINITE NUMBERS ARE THE POINT, NOT AN EDGE CASE. `Infinity` is a legitimate value here - the top
 * bracket's absent ceiling reaches the ceiling-fillers as one - and `JSON.stringify` writes it as
 * `null`, which would hide exactly the kind of change this is guarding against. Both directions of
 * the conversion are done explicitly below.
 */

globalThis.performance = { now: () => Date.now() };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
Object.assign(globalThis, require('../taxengine.js'));
Object.assign(globalThis, require('../optimizer_core.js'));
Object.assign(globalThis, require('../montecarlo/prng.js'));
Object.assign(globalThis, require('../montecarlo/stats.js'));
require('../montecarlo/historical_returns.js');
const core = require('../optimizer_core.js');
const mc   = require('../montecarlo/mc_engine.js');
const plans = require('../plans');

const SWEEP_CAP = 8;          // variations simulated per household
const MC_MODES  = ['gbm', 'bootstrap', 'aam'];
const MC_SEED   = 42;

const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : dflt;
};
const OUT       = argOf('--out', null);
const CHECK     = argOf('--check', null);
const PATHS     = Number(argOf('--paths', 60));
const MAX_DIFF  = Number(argOf('--max-diff', 25));
const NO_MC     = argv.includes('--no-mc');
const ONLY      = argOf('--plans', null);

// ── Serializing a run ────────────────────────────────────────────────────────────────────────────
// Non-finite numbers become tagged strings so they survive the round trip, and typed arrays become
// plain arrays. Functions and undefined are dropped, which is what JSON does anyway.
const LARGE_ARRAY = 240;   // above this, a numeric array is folded (see foldNumbers)

// Clock reads the engine records alongside its results. They move between two runs of the SAME build,
// so a snapshot that kept them would report a difference on every check and teach the reader to
// ignore the output. Dropped when a snapshot is written, and skipped when comparing, so a snapshot
// taken before this list existed is still usable.
const TIMING_KEYS = new Set(['loopMs', 'totalTime', 'totalMs', 'thirdPassTime', 'elapsedMs', 'ms']);

// A Monte Carlo run carries numPaths x years balances per variation, which is megabytes and unreadable
// in a diff. Folded to figures that still move when any element moves: the count, the sum, the
// extremes, an index-weighted sum (so a REORDERING shows, which a plain sum would hide) and how many
// entries are not finite.
function foldNumbers(a) {
    let sum = 0, weighted = 0, min = Infinity, max = -Infinity, nonFinite = 0;
    for (let i = 0; i < a.length; i++) {
        const x = a[i];
        if (!Number.isFinite(x)) { nonFinite++; continue; }
        sum += x; weighted += x * (i + 1);
        if (x < min) min = x;
        if (x > max) max = x;
    }
    return { fold: a.length, sum, weighted, min: encode(min), max: encode(max), nonFinite };
}

function encode(v, depth = 0) {
    if (typeof v === 'number') {
        if (Number.isNaN(v)) return '#NaN';
        if (v === Infinity) return '#Inf';
        if (v === -Infinity) return '#-Inf';
        return v;
    }
    if (typeof v === 'function' || v === undefined) return undefined;
    if (v === null || typeof v !== 'object') return v;
    if (depth > 12) return '#deep';
    if (ArrayBuffer.isView(v)) {
        return v.length > LARGE_ARRAY ? foldNumbers(v) : Array.from(v, n => encode(n, depth + 1));
    }
    if (Array.isArray(v)) {
        if (v.length > LARGE_ARRAY && v.every(x => typeof x === 'number')) return foldNumbers(v);
        return v.map(x => encode(x, depth + 1));
    }
    const out = {};
    for (const k of Object.keys(v).sort()) {
        if (TIMING_KEYS.has(k)) continue;
        const e = encode(v[k], depth + 1);
        if (e !== undefined) out[k] = e;
    }
    return out;
}

// One plan's deterministic half: the run, the optimizers, the solvers, the sweep.
function deterministicSection(inputs) {
    const sec = {};
    sec.run = encode(core.simulate(inputs));
    sec.optimizeSpend = encode(core.optimizeSpend(inputs, {}));
    sec.optimizeConversionAmount = encode(core.optimizeConversionAmount(inputs));
    sec.breakEvenHeirsRate = encode(core.breakEvenHeirsRate(inputs));
    sec.suggestSustainableSpend = encode(core.suggestSustainableSpend(inputs, {}));

    const variations = core.buildVariations(inputs, {});
    sec.variationCount = variations.length;
    sec.sweep = variations.slice(0, SWEEP_CAP).map(v => {
        const r = core.simulate(v);
        return encode({
            selection: core.selectionOf ? core.selectionOf(v) : null,
            totals: r.totals,
            summary: core.summarizeRun(r.totals, r.finalNW, r.finalNWCurrentDollars, {}),
        });
    });
    return sec;
}

function mcPlanYears(base) {
    return Math.max(base.birthyear1 + base.die1, base.birthyear2 + base.die2)
         - (base.startYear ?? 2026) + 1;
}

// One plan's Monte Carlo half. The path arrays are deliberately left out: per-variation aggregates
// and the stress table are derived from every path, so a moved path shows up in them.
async function mcSection(inputs) {
    const years = mcPlanYears(inputs);
    const out = {};
    for (const mode of MC_MODES) {
        const res = await mc.runJob({
            variations: [inputs],
            numPaths: PATHS,
            mu: 0.07, sigma: 0.12, seed: MC_SEED,
            years, simulationMode: mode,
            stressCount: 10, stressWindow: 'combined', bearFraction: 0.25,
            inflationRate: inputs.inflation,
        }, null);
        // Everything the job returns, field names and all, so a field added to a variation is
        // covered without editing this harness. The clock reads drop out in encode (TIMING_KEYS).
        out[mode] = encode(res);
    }
    return out;
}

async function collect() {
    const ids = ONLY ? ONLY.split(',') : plans.list().map(p => p.id);
    const snap = { meta: { paths: PATHS, sweepCap: SWEEP_CAP, modes: NO_MC ? [] : MC_MODES }, plans: {} };
    for (const id of ids) {
        const plan = plans.get(id);
        if (!plan) throw new Error(`no such plan: ${id}`);
        process.stderr.write(`  ${id} ... `);
        const t0 = Date.now();
        const sec = deterministicSection(plan.inputs);
        if (!NO_MC) sec.mc = await mcSection(plan.inputs);
        snap.plans[id] = sec;
        process.stderr.write(`${Date.now() - t0} ms\n`);
    }
    return snap;
}

// ── Comparing two snapshots ──────────────────────────────────────────────────────────────────────
// Depth-first, reporting the first MAX_DIFF leaves that disagree, by path.
function diff(a, b, path, out) {
    if (out.length >= MAX_DIFF) return;
    if (a === b) return;
    const ta = a === null ? 'null' : Array.isArray(a) ? 'array' : typeof a;
    const tb = b === null ? 'null' : Array.isArray(b) ? 'array' : typeof b;
    if (ta !== tb) { out.push({ path, was: a, now: b, note: `type ${ta} -> ${tb}` }); return; }
    if (ta === 'array') {
        if (a.length !== b.length) out.push({ path, was: `len ${a.length}`, now: `len ${b.length}` });
        for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${path}[${i}]`, out);
        return;
    }
    if (ta === 'object') {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const k of [...keys].sort()) {
            if (TIMING_KEYS.has(k)) continue;
            if (!(k in a)) { out.push({ path: `${path}.${k}`, was: '(absent)', now: b[k] }); continue; }
            if (!(k in b)) { out.push({ path: `${path}.${k}`, was: a[k], now: '(absent)' }); continue; }
            diff(a[k], b[k], `${path}.${k}`, out);
        }
        return;
    }
    out.push({ path, was: a, now: b });
}

function countLeaves(v) {
    if (v === null || typeof v !== 'object') return 1;
    if (Array.isArray(v)) return v.reduce((n, x) => n + countLeaves(x), 0);
    return Object.keys(v).reduce((n, k) => n + countLeaves(v[k]), 0);
}

(async () => {
    if (!OUT && !CHECK) {
        console.error('usage: identity_harness.js --out <file> | --check <file>');
        process.exit(2);
    }
    const t0 = Date.now();
    process.stderr.write(`identity harness: ${ONLY || 'all'} plans, ${PATHS} paths, `
        + `${NO_MC ? 'no MC' : MC_MODES.join('/')}\n`);
    const snap = await collect();
    const leaves = countLeaves(snap);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);

    if (OUT) {
        require('fs').writeFileSync(OUT, JSON.stringify(snap));
        console.log(`wrote ${OUT}: ${leaves.toLocaleString()} values from `
            + `${Object.keys(snap.plans).length} households in ${secs}s`);
        return;
    }

    const prev = JSON.parse(require('fs').readFileSync(CHECK, 'utf8'));
    const out = [];
    diff(prev, snap, '', out);
    if (!out.length) {
        console.log(`IDENTICAL: ${leaves.toLocaleString()} values match ${CHECK} `
            + `(${Object.keys(snap.plans).length} households, ${secs}s)`);
        return;
    }
    console.log(`DIFFERENT: ${out.length}${out.length >= MAX_DIFF ? '+' : ''} of `
        + `${leaves.toLocaleString()} values moved\n`);
    for (const d of out) {
        console.log(`  ${d.path}\n      was ${JSON.stringify(d.was)}\n      now ${JSON.stringify(d.now)}`
            + (d.note ? `   (${d.note})` : ''));
    }
    process.exitCode = 1;
})();
