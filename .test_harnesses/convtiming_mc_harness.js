/**
 * convtiming_mc_harness.js -- P28ji. Is "early conversion, late spend+tax" worth a restructure?
 *
 * THE QUESTION. The third withdrawal-timing mode a user asked for moves the CONVERSION to January
 * while spending and its tax stay in November. Building it means splitting the year into two
 * withdrawal events with growth staged between them, because today the conversion is the RESIDUAL of
 * a single draw rather than an event of its own. That is a real restructure, so the payoff is
 * measured first.
 *
 * DETERMINISTICALLY IT IS EXACTLY NOTHING, and that is proven rather than estimated.
 * `computeYearGrowthRates` hands the IRA and the Roth the same rate when there is no per-account
 * sequence, and preMonths + postMonths = 12, so a converted dollar earns the same twelve months
 * whichever month it moves in. Verified to the cent in P28jg: pinned early and pinned late both
 * total $1,696,440 of IRA plus Roth on a conversion-only fixture.
 *
 * UNDER MONTE CARLO IT IS NOT NOTHING, and the reason is narrow enough to state exactly.
 * `buildPathInputs` (montecarlo/mc_engine.js) gives every account its own sequence blended from the
 * SAME equity / intl / bond draws, weighted by that account's own composition. So two accounts
 * differ in a year only insofar as their ALLOCATIONS differ. On the reference household the IRA is
 * 65% equity and the Roth is 90%, so the Roth carries about 25 points more equity and the two
 * genuinely diverge. Move a conversion ten months earlier and those dollars ride the Roth's mix
 * instead of the IRA's for that stretch.
 *
 * Only `bootstrap` and `stress` build a per-account bank at all. Under `gbm` there is none, so the
 * mode is exactly neutral there too.
 *
 * WHAT THIS MEASURES, AND WHAT IT DOES NOT. For each path it prices the FIRST-ORDER difference:
 *
 *     delta_y = conversion_y x (rothRate_y - iraRate_y) x 10/12
 *
 * compounded forward at the Roth's own realized rates to the end of the plan. That is the money the
 * converted dollars earn on the Roth's mix instead of the IRA's for the ten months in question.
 *
 * It does NOT model the feedback: a larger Roth changes later withdrawals, which changes later
 * balances and taxes. So this is an ESTIMATE of the mode's value and not a simulation of it. It is
 * the right shape for a build/no-build decision - if the first-order effect is negligible the
 * feedback on it cannot rescue the restructure - and the wrong shape for a headline number.
 *
 * RUN:  node .test_harnesses/convtiming_mc_harness.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const R = path.join(__dirname, '..') + path.sep;
Object.assign(globalThis, require(R + 'taxengine.js'));
require(R + 'displayhelpers.js');
const core = require(R + 'optimizer_core.js');
const { simulate } = core;

// mc_engine.js is written for the worker, where importScripts drops everything into one scope.
// In node the helpers have to be hoisted onto globalThis before it is required, the same shim
// optimizer_core.tests.js installs.
const prng = require(R + 'montecarlo/prng.js');
Object.assign(globalThis, prng);
Object.assign(globalThis, require(R + 'montecarlo/stats.js'));
globalThis.HISTORICAL_RETURNS = require(R + 'montecarlo/historical_returns.js');
globalThis.simulate = core.simulate;
globalThis.selectionOf = core.selectionOf;
globalThis.afterTaxWealthOfLogRow = core.afterTaxWealthOfLogRow;
const mc = require(R + 'montecarlo/mc_engine.js');

function loadFixture(name) {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
    const meta = raw.__meta; delete raw.__meta;
    for (const k of (meta.undefinedKeys || [])) raw[k] = undefined;
    return raw;
}
const BASE = loadFixture('p106_canonical.json');
const NUM_PATHS = 200;

const money = (v) => (v < 0 ? '-' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
const pct = (v, d = 2) => (v * 100).toFixed(d) + '%';
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

console.log('\nP28ji - what would "early conversion, late spend+tax" be worth under Monte Carlo?');
console.log('='.repeat(100));
console.log('IRA equity ' + BASE.comp_IRA1_ratio + '% (intl ' + BASE.comp_IRA1_intl + '%)   '
    + 'Roth equity ' + BASE.comp_Roth1_ratio + '% (intl ' + BASE.comp_Roth1_intl + '%)   '
    + 'spread ' + (BASE.comp_Roth1_ratio - BASE.comp_IRA1_ratio) + ' points of equity');
console.log('Deterministic answer is exactly $0 (same rate both accounts). Only bootstrap/stress');
console.log('build a per-account bank, so only they can differ at all.');
console.log('-'.repeat(100));

const probe = simulate({ ...BASE, forceWithdrawTiming: 'late', computeOC: false });
const YEARS = probe.log.length;

// TWO COMPARISONS, both legitimate, answering different questions. An earlier version of this
// harness ran only the second and then read it as though the first were the "real" one, which was
// wrong: the allocation gap is not a confound to be equalized away, it is a fact about the
// household.
//   EQUALIZED  - Roth composition forced to the IRA's. Isolates conversion TIMING itself, with no
//                allocation difference for the move to pick up. This is the fair comparison.
//   ACTUAL     - the household's real 65%/90% split. What the mode would really do for THIS plan,
//                timing and allocation together. This is the real comparison.
const ALLOC_ARMS = [
    { key: 'EQUALIZED', over: { comp_Roth1_ratio: BASE.comp_IRA1_ratio, comp_Roth1_intl: BASE.comp_IRA1_intl,
                                comp_Roth2_ratio: BASE.comp_IRA1_ratio, comp_Roth2_intl: BASE.comp_IRA1_intl } },
    { key: 'ACTUAL', over: {} },
];

for (const alloc of ALLOC_ARMS) {
for (const mode of ['bootstrap', 'gbm']) {
    const cfg = { years: YEARS, numPaths: NUM_PATHS, bearFraction: 25 };
    const rng = prng.makeRNG ? prng.makeRNG(12345) : (prng.mulberry32 ? prng.mulberry32(12345) : Math.random);
    let banks;
    try { banks = mc.buildBanks(cfg, rng, mode); }
    catch (e) { console.log('\n' + mode + ': could not build banks - ' + e.message); continue; }

    const deltas = [], terminals = [], rateGaps = [];
    for (let p = 0; p < NUM_PATHS; p++) {
        const pi = mc.buildPathInputs(banks, p, YEARS, { ...BASE, ...alloc.over }, mode);
        const inp = { ...BASE, ...alloc.over, forceWithdrawTiming: 'late', computeOC: false,
                      returnSequence: pi.returnSequence,
                      returnSequencePerAccount: pi.returnSequencePerAccount,
                      inflationSequence: pi.inflationSequence };
        let r;
        try { r = simulate(inp); } catch (e) { continue; }
        const psa = pi.returnSequencePerAccount;
        const div = BASE.dividendRate ?? 0;
        const iraR = (y) => (psa ? psa.IRA1[y] : pi.returnSequence[y]) + div;
        const rothR = (y) => (psa ? psa.Roth1[y] : pi.returnSequence[y]) + div;

        let total = 0;
        for (let y = 0; y < r.log.length; y++) {
            const c = r.log[y].rothConv ?? 0;
            if (c <= 0) continue;
            if (psa) rateGaps.push(rothR(y) - iraR(y));
            let d = c * (rothR(y) - iraR(y)) * (10 / 12);
            for (let k = y + 1; k < r.log.length; k++) d *= (1 + rothR(k));
            total += d;
        }
        const last = r.log[r.log.length - 1];
        deltas.push(total / (last.inflationFactor || 1));
        terminals.push(r.finalNW / (last.inflationFactor || 1));
    }

    if (!deltas.length) { console.log('\n' + alloc.key + '/' + mode + ': no feasible paths'); continue; }    const med = quant(deltas, 0.5), medNW = quant(terminals, 0.5);
    console.log('\n' + alloc.key + ' allocation / ' + mode.toUpperCase() + '   (' + deltas.length + ' paths)');
    if (!rateGaps.length) {
        // No per-account bank means both accounts read the same rate, so every delta is identically
        // zero by construction. Printing a distribution of zeros (or of NaN, if the bank config for
        // this mode is incomplete) would invite reading noise as a result.
        console.log('  per-account bank : NO - both accounts read the same rate.');
        console.log('  estimated mode3 - mode2: EXACTLY $0, by construction rather than by measurement.');
        continue;
    }
    console.log('  per-account bank : YES');
    {
        console.log('  Roth minus IRA rate in converting years: median ' + pct(quant(rateGaps, 0.5))
            + '   p10 ' + pct(quant(rateGaps, 0.10)) + '   p90 ' + pct(quant(rateGaps, 0.90)));
    }
    console.log('  estimated mode3 - mode2, real dollars:');
    console.log('     p10 ' + money(quant(deltas, 0.10)).padStart(12)
        + '   median ' + money(med).padStart(12)
        + '   p90 ' + money(quant(deltas, 0.90)).padStart(12));
    console.log('     share of paths where the mode HELPS: ' + pct(deltas.filter(d => d > 0).length / deltas.length, 1));
    console.log('     median as a share of median terminal net worth (' + money(medNW) + '): ' + pct(med / medNW, 3));
}
console.log('\n' + '='.repeat(100));
}
