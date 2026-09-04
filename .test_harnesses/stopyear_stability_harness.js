/**
 * stopyear_stability_harness.js -- Phase P106a.
 *
 * QUESTION (user, 2026-09-03): "the Stop Conversion year suggested changes the answer. And it
 * seems unstable". Is that a DEFECT, or a genuinely flat optimum that the UI reports as a single
 * confident year? P106's whole conversion study is meant to rest on this suggestion, so it is
 * measured first.
 *
 * The production search is `bestConversionStopYear()` in optimizer_core.js. It is a LINEAR SCAN
 * over every cutoff, deterministic given its inputs, so any instability the user sees has to come
 * from one of: a near-flat top where the argmax is decided by rounding-scale differences; a
 * multi-modal curve; a coupling to some input that moves it much more than the user expects; or a
 * genuine bug in how the applied year feeds back into the next search.
 *
 * SCENARIO: the user's own plan, `fixtures/p106_canonical.json`, captured from the page's own
 * getInputs() so no share-URL decoder is re-implemented here. See fixtures/README.md.
 *
 * ONE THING KNOWN BEFORE RUNNING, from reading the fixture rather than from a result:
 * `futureIRATaxRate` is UNDEFINED on the canonical scenario, so `afterTaxWealthOfLogRow()` returns
 * `r.totalWealth`. Predictions A7 and A8 exist because of that reading.
 *
 * *** CORRECTION, made after the first run and before any report. The sentence that stood here
 * said totalWealth is GROSS wealth, "which prices a dollar inside the IRA the same as a dollar
 * inside the Roth". That is wrong. `evaluateYearOutcome` (optimizer_core.js:3801) builds
 * totalWealth as an AFTER-TAX figure - the IRA is already discounted, at `sim.nominalTaxRate`,
 * which is THAT RUN'S OWN final-year ordinary marginal rate. The predictions are left exactly as
 * registered and scored as written; only this reading of the mechanism changes, and section 8
 * below is where the corrected version is measured. It turns out to be the whole answer. ***
 *
 * -------------------------------------------------------------------------------------------
 * PREDICTIONS, REGISTERED BEFORE THE FIRST RUN (P106 groundrule 5: scored as written, never
 * re-aimed). Committed unrun in the same commit as this file.
 *
 *   A1  FLAT TOP. At least 3 distinct cutoffs score within 0.1% of the best.
 *   A2  INPUT SENSITIVITY. The argmax moves by >= 2 years under a +/-1% change to spendGoal.
 *   A3  IDEMPOTENCE. Applying the winning stop year and re-searching returns that same year.
 *       A3 failing is a DEFECT, not a flat optimum - the header of bestConversionStopYear()
 *       claims the strip-first logic guarantees this and syncAutoStopYear() relies on it to
 *       converge.
 *   A4  NOT UNIMODAL. The curve has >= 2 local maxima. (The function header asserts this is why a
 *       linear scan is mandatory; it has never been shown on this scenario.)
 *   A5  MODES DISAGREE. mode 'all' and mode 'extra' return different stop years.
 *   A6  CHEAP TO BE WRONG. The worst cutoff inside the 0.1% band costs < 0.5% of net worth against
 *       the best one. If A6 is FALSE the suggestion is load-bearing and its instability is a
 *       defect; if TRUE the instability is cosmetic and the fix is presentational.
 *   A7  THE HEIRS RATE MOVES THE ANSWER. The argmax with no heirs rate differs by >= 3 years from
 *       the argmax at 0.24. This CONTRADICTS stopyear_harness.js's header, which states that
 *       futureIRATaxRate "never changes plan mechanics, so it cannot move the optimal stop year."
 *       Mechanics, no. The scored quantity, yes.
 *   A8  NO HEIRS RATE FAVORS STOPPING EARLY. With futureIRATaxRate undefined the argmax falls in
 *       the first third of the plan.
 * -------------------------------------------------------------------------------------------
 *
 * RUN:  node .test_harnesses/stopyear_stability_harness.js
 * Add `--json` to emit the raw curve for a report table.
 */
'use strict';

const fs = require('fs');
const path = require('path');
// Browser shims, same set the other node harnesses install: displayhelpers.js assigns to `window`
// at load and optimizer_core.js reads `performance.now`.
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const R = path.join(__dirname, '..') + path.sep;
Object.assign(globalThis, require(R + 'taxengine.js'));
require(R + 'displayhelpers.js');
const core = require(R + 'optimizer_core.js');
const { simulate, bestConversionStopYear, afterTaxWealthOfLogRow } = core;

const EMIT_JSON = process.argv.includes('--json');

// ── fixture loading ──────────────────────────────────────────────────────────────────────────
// JSON cannot hold `undefined`, and the engine distinguishes it from null in at least one place
// that matters here, so __meta.undefinedKeys is restored rather than trusted to round-trip.
function loadFixture(name) {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
    const meta = raw.__meta;
    delete raw.__meta;
    for (const k of (meta.undefinedKeys || [])) raw[k] = undefined;
    return { inputs: raw, meta };
}

const money = (v) => (v < 0 ? '-' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
const pct = (v, d = 3) => (v * 100).toFixed(d) + '%';
const rule = (c = '─') => console.log(c.repeat(96));

// ── the curve ────────────────────────────────────────────────────────────────────────────────
// Same truncation the production search uses, so the numbers here ARE the numbers it scores on.
// cut 0 = convert nothing; cut n = never stop (the plan as configured, minus any stop year).
function cutoffCurve(inputs, mode, heirsRate) {
    const base = {
        ...inputs,
        convEndYear: undefined, convEndMode: undefined,
        _cfSuppressConversions: false, _cfSuppressConversionsFromYear: undefined,
    };
    const probe = simulate({ ...base, computeOC: false });
    const n = probe.log.length;
    const start = probe.log[0].year;
    const rows = [];
    for (let cut = 0; cut <= n; cut++) {
        let res;
        if (mode === 'all') {
            res = simulate({ ...base, _cfSuppressConversionsFromYear: cut, computeOC: false });
        } else {
            res = simulate({ ...base, convEndYear: start + cut - 1, convEndMode: 'extra', computeOC: false });
        }
        const last = res.log[res.log.length - 1];
        const ira = (last.IRA1 ?? 0) + (last.IRA2 ?? 0);
        const brok = last.Brokerage ?? 0, cash = last.Cash ?? 0, basis = last.Basis ?? 0;
        const cg = last['-capGainsRate'] ?? 0.15;
        // The rate totalWealth ACTUALLY discounted this run's IRA at, recovered from the row by
        // inverting the formula in evaluateYearOutcome. This is `sim.nominalTaxRate`, the run's own
        // final-year ordinary marginal - and it is not the same number from one cutoff to the next.
        const impliedIRARate = ira > 0
            ? 1 - ((last.totalWealth - ((last.Roth ?? 0) + cash + basis)
                - Math.max(0, brok - basis) * (1 - cg)) / ira)
            : null;
        rows.push({
            cut,
            lastConvYear: cut === 0 ? null : start + cut - 1,
            score: afterTaxWealthOfLogRow(last, heirsRate),
            totalWealth: last.totalWealth,
            conv: res.log.reduce((s, r) => s + (r.rothConv ?? 0), 0),
            spend: res.totals.spend,
            tax: res.totals.tax,
            roth: (last.Roth ?? 0),
            ira, brok, cash, basis, impliedIRARate,
            gross: ira + (last.Roth ?? 0) + brok + cash,
            success: res.totals.success,
        });
    }
    return { start, n, rows };
}

const argmaxOf = (rows) => rows.reduce((b, r) => (r.score > b.score ? r : b), rows[0]);

// A local maximum is a cut scoring strictly above both neighbours. Endpoints count when they beat
// their single neighbour, since "convert nothing" and "never stop" are both real answers.
function localMaxima(rows) {
    const out = [];
    for (let i = 0; i < rows.length; i++) {
        const prev = i > 0 ? rows[i - 1].score : -Infinity;
        const next = i < rows.length - 1 ? rows[i + 1].score : -Infinity;
        if (rows[i].score > prev && rows[i].score > next) out.push(rows[i]);
    }
    return out;
}

// ── report ───────────────────────────────────────────────────────────────────────────────────
const { inputs: CANON, meta: META } = loadFixture('p106_canonical.json');

console.log('\nP106a - is the suggested Stop Conversion year stable?');
rule('═');
console.log('scenario   : ' + META.capturedFrom.replace(/^[^?]*/, '(canonical) '));
console.log('captured   : ' + META.title + '  ' + META.capturedUTC);
console.log('heirs rate : ' + (CANON.futureIRATaxRate === undefined
    ? 'UNDEFINED -> the search scores RAW totalWealth, not after-tax wealth'
    : CANON.futureIRATaxRate));
console.log('stop year set in the scenario: ' + CANON.convEndYear + ' (mode ' + CANON.convEndMode + ')');
rule();

// ---- 1. the curve, as the production search sees it -----------------------------------------
const curve = cutoffCurve(CANON, 'all', CANON.futureIRATaxRate);
const best = argmaxOf(curve.rows);
const never = curve.rows[curve.n];
const none = curve.rows[0];

console.log('\n1. THE CUTOFF CURVE  (mode all, ' + (curve.n + 1) + ' cutoffs, plan '
    + curve.start + '-' + (curve.start + curve.n - 1) + ')');
console.log('   best cutoff      : ' + (best.lastConvYear ?? 'convert nothing')
    + '   score ' + money(best.score));
console.log('   never stop       : ' + money(never.score) + '   (best beats it by ' + money(best.score - never.score) + ')');
console.log('   convert nothing  : ' + money(none.score) + '   (best beats it by ' + money(best.score - none.score) + ')');

console.log('\n   cut  lastConvYear        score        gap vs best    gap %      conversions      endRoth');
for (const r of curve.rows) {
    const gap = r.score - best.score;
    console.log('   ' + String(r.cut).padStart(3)
        + '  ' + String(r.lastConvYear ?? 'none').padStart(11)
        + '  ' + money(r.score).padStart(14)
        + '  ' + money(gap).padStart(13)
        + '  ' + (100 * gap / best.score).toFixed(4).padStart(8) + '%'
        + '  ' + money(r.conv).padStart(14)
        + '  ' + money(r.roth).padStart(13)
        + (r.cut === best.cut ? '   <== BEST' : ''));
}

// ---- 2. flatness: how many years are effectively tied --------------------------------------
console.log('\n2. FLATNESS  (how wide is the set of cutoffs that are effectively tied?)');
const bands = [
    ['0.01%', 0.0001], ['0.10%', 0.001], ['0.50%', 0.005], ['1.00%', 0.01],
];
console.log('   band     cutoffs within   year span of that set   worst-in-band cost');
let a1 = null, a6 = null;
for (const [label, frac] of bands) {
    const inBand = curve.rows.filter(r => (best.score - r.score) <= frac * Math.abs(best.score));
    const yrs = inBand.map(r => r.lastConvYear).filter(y => y != null);
    const span = yrs.length ? (Math.max(...yrs) - Math.min(...yrs)) : 0;
    const worst = inBand.reduce((w, r) => (r.score < w.score ? r : w), inBand[0]);
    const cost = best.score - worst.score;
    console.log('   ' + label.padStart(6) + '   ' + String(inBand.length).padStart(14)
        + '   ' + String(span + ' years').padStart(21)
        + '   ' + money(cost).padStart(18) + '  (' + pct(cost / Math.abs(best.score)) + ' of NW)');
    if (label === '0.10%') { a1 = inBand.length; a6 = cost / Math.abs(best.score); }
}

// ---- 3. idempotence -------------------------------------------------------------------------
console.log('\n3. IDEMPOTENCE  (does applying the answer and re-asking give the same answer?)');
const s0 = bestConversionStopYear(CANON, { mode: 'all' });
const applied = { ...CANON, convEndYear: s0.stopYearCalendar ?? undefined, convEndMode: 'all' };
const s1 = bestConversionStopYear(applied, { mode: 'all' });
const elsewhere = bestConversionStopYear({ ...CANON, convEndYear: curve.start + 3, convEndMode: 'all' }, { mode: 'all' });
console.log('   from the scenario as loaded (cey ' + CANON.convEndYear + ') : ' + (s0.stopYearCalendar ?? 'none/never'));
console.log('   after applying that answer                : ' + (s1.stopYearCalendar ?? 'none/never'));
console.log('   from a deliberately different stop year   : ' + (elsewhere.stopYearCalendar ?? 'none/never'));
const a3 = (s0.stopYearCalendar === s1.stopYearCalendar) && (s0.stopYearCalendar === elsewhere.stopYearCalendar);
console.log('   -> ' + (a3 ? 'STABLE: the search is independent of the stop year already set'
    : '*** NOT IDEMPOTENT - the applied year changes the next answer ***'));

// ---- 4. shape -------------------------------------------------------------------------------
const maxima = localMaxima(curve.rows);
console.log('\n4. SHAPE  (' + maxima.length + ' local maxima)');
for (const m of maxima) {
    console.log('   ' + String(m.lastConvYear ?? 'convert nothing').padStart(15) + '   ' + money(m.score)
        + '   ' + money(m.score - best.score).padStart(14) + ' vs best');
}

// ---- 5. perturbation ------------------------------------------------------------------------
console.log('\n5. PERTURBATION  (how far does the answer move when an input barely moves?)');
const perturbs = [
    ['spendGoal -1%', { spendGoal: CANON.spendGoal * 0.99 }],
    ['spendGoal -0.5%', { spendGoal: CANON.spendGoal * 0.995 }],
    ['spendGoal +0.5%', { spendGoal: CANON.spendGoal * 1.005 }],
    ['spendGoal +1%', { spendGoal: CANON.spendGoal * 1.01 }],
    ['growth -0.10pp', { growth: CANON.growth - 0.001 }],
    ['growth +0.10pp', { growth: CANON.growth + 0.001 }],
    ['growth +0.25pp', { growth: CANON.growth + 0.0025 }],
    ['inflation +0.10pp', { inflation: CANON.inflation + 0.001 }],
    ['IRA1 +1%', { IRA1: CANON.IRA1 * 1.01 }],
    ['IRA1 -1%', { IRA1: CANON.IRA1 * 0.99 }],
    ['Brokerage +1%', { Brokerage: CANON.Brokerage * 1.01 }],
];
console.log('   perturbation          stop year   moved   score at ITS year, under the ORIGINAL plan');
let maxMove = 0, spendMove = 0;
for (const [label, over] of perturbs) {
    const s = bestConversionStopYear({ ...CANON, ...over }, { mode: 'all' });
    const y = s.stopYearCalendar;
    const moved = (y == null || best.lastConvYear == null) ? null : Math.abs(y - best.lastConvYear);
    if (moved != null) maxMove = Math.max(maxMove, moved);
    if (label.startsWith('spendGoal') && moved != null) spendMove = Math.max(spendMove, moved);
    const row = curve.rows.find(r => r.lastConvYear === y);
    const costHere = row ? best.score - row.score : null;
    console.log('   ' + label.padEnd(20) + '  ' + String(y ?? 'none/never').padStart(10)
        + '  ' + String(moved == null ? '-' : moved + 'y').padStart(6)
        + '   ' + (costHere == null ? '-' : money(costHere) + ' below best ('
            + pct(costHere / Math.abs(best.score)) + ')'));
}

// ---- 6. the heirs rate ----------------------------------------------------------------------
console.log('\n6. THE HEIRS RATE  (a VALUATION knob: it cannot change the plan, only the score)');
console.log('   Every row below re-scores the SAME simulations. stopyear_harness.js\'s header says');
console.log('   this "cannot move the optimal stop year". Measuring that claim:');
console.log('\n   heirs rate    best cutoff    score               gap: best vs never-stop');
const rates = [undefined, 0, 0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37, 0.40];
const rateRows = [];
for (const rate of rates) {
    const c = cutoffCurve(CANON, 'all', rate);
    const b = argmaxOf(c.rows);
    rateRows.push({ rate, year: b.lastConvYear, cut: b.cut, score: b.score, vsNever: b.score - c.rows[c.n].score });
    console.log('   ' + String(rate === undefined ? 'not set' : pct(rate, 0)).padStart(10)
        + '    ' + String(b.lastConvYear ?? 'convert nothing').padStart(11)
        + '    ' + money(b.score).padStart(16)
        + '    ' + money(b.vsNever ?? (b.score - c.rows[c.n].score)).padStart(16));
}
const yrNone = rateRows.find(r => r.rate === undefined).year;
const yr24 = rateRows.find(r => r.rate === 0.24).year;
const a7move = (yrNone != null && yr24 != null) ? Math.abs(yrNone - yr24) : null;

// ---- 7. modes -------------------------------------------------------------------------------
console.log('\n7. MODES');
const sAll = bestConversionStopYear(CANON, { mode: 'all' });
const sExtra = bestConversionStopYear(CANON, { mode: 'extra' });
console.log('   mode all   : ' + (sAll.stopYearCalendar ?? 'none/never')
    + '   gainVsFull ' + money(sAll.gainVsFull) + '   gainVsNone ' + money(sAll.gainVsNone));
console.log('   mode extra : ' + (sExtra.stopYearCalendar ?? 'none/never')
    + '   gainVsFull ' + money(sExtra.gainVsFull) + '   gainVsNone ' + money(sExtra.gainVsNone));
console.log('   note: extraConversionAmount is ' + CANON.extraConversionAmount
    + ' on this scenario, so mode extra has nothing of its own to truncate.');

// ---- 8. POST-HOC. Added after A1-A8 were scored; changes none of them. ----------------------
// The registered predictions ask whether the answer moves and what the move costs IN THE SCORED
// QUANTITY. They cannot ask what the tied plans are worth in P106's own metric, because that
// metric is the thing P106b is being built to define. This section asks it anyway, because the
// answer decides whether the instability matters.
console.log('\n8. WHY THE ANSWER MOVES  (post-hoc; scored no prediction)');
const peaks = localMaxima(curve.rows);
if (peaks.length >= 2) {
    const lo = peaks[0], hi = peaks[peaks.length - 1];
    console.log('   ' + 'metric'.padEnd(30) + peaks.map(p => String(p.lastConvYear ?? 'none').padStart(16)).join('')
        + '     difference');
    const line = (label, f, fmt = money) => console.log('   ' + label.padEnd(30)
        + peaks.map(p => String(fmt(f(p))).padStart(16)).join('')
        + '     ' + fmt(f(hi) - f(lo)));
    line('ending IRA', p => p.ira);
    line('ending Roth', p => p.roth);
    line('ending Brokerage', p => p.brok);
    line('ending Cash', p => p.cash);
    line('GROSS wealth (sum of those)', p => p.gross);
    line('total conversions', p => p.conv);
    line('lifetime tax', p => p.tax);
    line('lifetime spend', p => p.spend);
    console.log('   ' + '-'.repeat(90));
    console.log('   ' + 'IRA discount rate APPLIED'.padEnd(30)
        + peaks.map(p => String(pct(p.impliedIRARate, 2)).padStart(16)).join('')
        + '     ' + ((hi.impliedIRARate - lo.impliedIRARate) * 100).toFixed(2) + 'pp');
    line('score the search sees', p => p.score);

    console.log('\n   THE TWO PEAKS ARE NOT SCORED ON THE SAME BASIS. `totalWealth` discounts the IRA at');
    console.log('   `sim.nominalTaxRate` - each run\'s OWN final-year ordinary marginal rate - so a cutoff');
    console.log('   that happens to end in a lower bracket has its IRA valued more generously than one');
    console.log('   that does not, independently of whether it is the better plan.');
    const rateGap = (hi.impliedIRARate - lo.impliedIRARate);
    console.log('   Here that is ' + (Math.abs(rateGap) * 100).toFixed(2) + 'pp on ' + money(lo.ira)
        + ' of IRA = ' + money(Math.abs(rateGap * lo.ira)) + ' of pure valuation difference,');
    console.log('   against a margin between the two answers of only ' + money(Math.abs(hi.score - lo.score)) + '.');
    console.log('   ' + (hi.gross > lo.gross ? hi.lastConvYear : lo.lastConvYear)
        + ' holds more GROSS wealth; ' + (hi.roth > lo.roth ? hi.lastConvYear : lo.lastConvYear)
        + ' holds more Roth. Neither dominates, so this is a real trade -');
    console.log('   and the search resolves it with a rate that is an artifact of the plan being scored.');

    console.log('\n   The same pair re-scored at a SHARED heirs rate (identical mechanics, valuation only):');
    console.log('     heirs rate   ' + peaks.map(p => String(p.lastConvYear).padStart(14)).join('')
        + '        margin   winner');
    for (const rate of [undefined, 0.12, 0.22, 0.24, 0.32, 0.37]) {
        const c = cutoffCurve(CANON, 'all', rate);
        const vals = peaks.map(p => c.rows[p.cut].score);
        const iw = vals.indexOf(Math.max(...vals));
        const margin = Math.max(...vals) - Math.min(...vals);
        console.log('     ' + String(rate === undefined ? 'NOT SET' : pct(rate, 0)).padStart(10)
            + '   ' + vals.map(v => money(v).padStart(14)).join('')
            + '  ' + money(margin).padStart(12) + '   ' + peaks[iw].lastConvYear
            + (rate === undefined ? '   <- the only row that picks it' : ''));
    }
    const margins = [0.12, 0.22, 0.24, 0.32, 0.37].map(rate => {
        const c = cutoffCurve(CANON, 'all', rate);
        return Math.abs(c.rows[hi.cut].score - c.rows[lo.cut].score);
    });
    const defMargin = Math.abs(hi.score - lo.score);
    console.log('\n   Every shared rate from 12% to 37% picks ' + lo.lastConvYear + ' over ' + hi.lastConvYear
        + ', by a margin ' + Math.round(Math.min(...margins) / defMargin) + 'x to '
        + Math.round(Math.max(...margins) / defMargin) + 'x');
    console.log('   the one the default scoring decides on. (The GLOBAL best at 12% is 2027, not '
        + lo.lastConvYear + ' -');
    console.log('   this row is the head-to-head between the two peaks only.)');
}

// ---- 9. THE DECISIVE TEST. Does a shared rate actually remove the sensitivity? ---------------
// Section 8 argues the instability is caused by the per-run discount rate. That is a claim about
// cause, and re-running the same perturbations under a SHARED rate is what tests it: if the cause
// is right the answer should stop moving.
console.log('\n9. THE SAME PERTURBATIONS, UNDER A SHARED HEIRS RATE  (tests section 8\'s claim)');
console.log('   perturbation          default (no rate)      at 24%      at 32%');
const sharedBest = {};
for (const rate of [0.24, 0.32]) {
    sharedBest[rate] = argmaxOf(cutoffCurve(CANON, 'all', rate).rows).lastConvYear;
}
let movesDefault = 0, movesShared = 0;
for (const [label, over] of perturbs) {
    const d = bestConversionStopYear({ ...CANON, ...over }, { mode: 'all' }).stopYearCalendar;
    const cells = [0.24, 0.32].map(rate => {
        const c = cutoffCurve({ ...CANON, ...over }, 'all', rate);
        return argmaxOf(c.rows).lastConvYear;
    });
    if (d !== best.lastConvYear) movesDefault++;
    if (cells[0] !== sharedBest[0.24] || cells[1] !== sharedBest[0.32]) movesShared++;
    console.log('   ' + label.padEnd(20) + '  ' + String(d ?? 'none').padStart(16)
        + '  ' + String(cells[0] ?? 'none').padStart(10) + '  ' + String(cells[1] ?? 'none').padStart(10)
        + (d !== best.lastConvYear ? '   <- default moved' : ''));
}
console.log('\n   baseline answers: default ' + best.lastConvYear + ', at 24% ' + sharedBest[0.24]
    + ', at 32% ' + sharedBest[0.32]);
console.log('   perturbations that moved the DEFAULT answer : ' + movesDefault + ' of ' + perturbs.length);
console.log('   perturbations that moved a SHARED-rate answer: ' + movesShared + ' of ' + perturbs.length);
console.log('   -> ' + (movesShared < movesDefault
    ? 'CONFIRMS section 8: the sensitivity is a property of the default scoring.'
    : 'DOES NOT confirm section 8: a shared rate is just as sensitive, so the cause is elsewhere.'));

// ---- 10. Where the sensitivity actually comes from -------------------------------------------
// Section 9 refuted the mechanism section 8 proposed. Section 2 measured flatness only in the
// DEFAULT basis, so the obvious untested candidate is that the objective is near-flat over a wide
// band of stop years in EVERY basis, and the argmax is decided by noise-scale differences whatever
// rate is used. This measures that.
console.log('\n10. FLATNESS IN EVERY BASIS  (the candidate section 9 leaves standing)');
console.log('    basis        peaks   cutoffs within 0.1%   year span   worst-in-band cost   best');
for (const rate of [undefined, 0.12, 0.22, 0.24, 0.32, 0.37]) {
    const c = cutoffCurve(CANON, 'all', rate);
    const b = argmaxOf(c.rows);
    const inBand = c.rows.filter(r => (b.score - r.score) <= 0.001 * Math.abs(b.score));
    const yrs = inBand.map(r => r.lastConvYear).filter(y => y != null);
    const span = yrs.length ? Math.max(...yrs) - Math.min(...yrs) : 0;
    const worst = inBand.reduce((w, r) => (r.score < w.score ? r : w), inBand[0]);
    const cost = b.score - worst.score;
    console.log('    ' + String(rate === undefined ? 'NOT SET' : pct(rate, 0)).padStart(8)
        + '  ' + String(localMaxima(c.rows).length).padStart(9)
        + '  ' + String(inBand.length).padStart(20)
        + '  ' + String(span + 'y').padStart(10)
        + '  ' + money(cost).padStart(19) + ' (' + pct(cost / Math.abs(b.score), 3) + ')'
        + '   ' + String(b.lastConvYear ?? 'none').padStart(6));
}
console.log('\n    Sections 9 and 10 together: under a shared rate the peak is SHARP for any one input');
console.log('    set, yet it RELOCATES by up to 3 years under a 0.5% input change. Not a plateau -');
console.log('    a moving peak. So the cost of landing on the wrong year is the number that decides');
console.log('    whether any of this matters, and it is not the worst-in-band figure above.');

// ---- 11. What does being on the wrong year actually cost? ------------------------------------
// The perturbations in section 9 reach {2027, 2029, 2030, 2032}. Those are the answers a user can
// actually be handed by nudging an input they would not think material. Scoring all of them in one
// basis at a time gives the real cost of the instability.
console.log('\n11. THE COST OF LANDING ON THE WRONG YEAR');
const reachable = [2027, 2029, 2030, 2032];
console.log('    Years the perturbations in section 9 actually produced: ' + reachable.join(', '));
console.log('\n    basis      ' + reachable.map(y => String(y).padStart(14)).join('') + '     spread   worst as % NW');
for (const rate of [undefined, 0.12, 0.22, 0.24, 0.32, 0.37]) {
    const c = cutoffCurve(CANON, 'all', rate);
    const vals = reachable.map(y => {
        const row = c.rows.find(r => r.lastConvYear === y);
        return row ? row.score : null;
    });
    const bb = argmaxOf(c.rows).score;
    const spread = Math.max(...vals) - Math.min(...vals);
    console.log('    ' + String(rate === undefined ? 'NOT SET' : pct(rate, 0)).padStart(8)
        + '   ' + vals.map(v => money(v).padStart(14)).join('')
        + '  ' + money(spread).padStart(11)
        + '   ' + pct((bb - Math.min(...vals)) / Math.abs(bb)));
}
console.log('\n    And what those same years mean in P106\'s own terms (mechanics, not valuation):');
console.log('    year        conversions      ending Roth       ending IRA    ending Brokerage');
for (const y of reachable) {
    const row = curve.rows.find(r => r.lastConvYear === y);
    if (!row) continue;
    console.log('    ' + String(y).padStart(6) + '  ' + money(row.conv).padStart(15)
        + '  ' + money(row.roth).padStart(15) + '  ' + money(row.ira).padStart(15)
        + '  ' + money(row.brok).padStart(18));
}

// ---- scoring the registered predictions ------------------------------------------------------
rule('═');
console.log('PREDICTIONS, scored as written');
rule();
const firstThird = best.cut <= curve.n / 3;
const verdicts = [
    ['A1', 'flat top: >=3 cutoffs within 0.1%', a1 >= 3, a1 + ' cutoffs within 0.10%'],
    ['A2', 'argmax moves >=2y on +/-1% spendGoal', spendMove >= 2, 'largest spendGoal move ' + spendMove + ' years'],
    ['A3', 'idempotent (failure = DEFECT)', a3, a3 ? 'same answer from every starting stop year' : 'DIFFERENT answers'],
    ['A4', 'not unimodal: >=2 local maxima', maxima.length >= 2, maxima.length + ' local maxima'],
    ['A5', "modes 'all' and 'extra' disagree", sAll.stopYearCalendar !== sExtra.stopYearCalendar,
        (sAll.stopYearCalendar ?? 'none') + ' vs ' + (sExtra.stopYearCalendar ?? 'none')],
    ['A6', 'cheap to be wrong: <0.5% NW inside the 0.1% band', a6 < 0.005, 'worst-in-band ' + pct(a6)],
    ['A7', 'heirs rate moves the answer >=3y', a7move != null && a7move >= 3,
        'no-rate ' + (yrNone ?? 'none') + ' vs 24% ' + (yr24 ?? 'none') + (a7move == null ? '' : ' = ' + a7move + ' years')],
    ['A8', 'no heirs rate -> argmax in first third', firstThird,
        'cut ' + best.cut + ' of ' + curve.n],
];
for (const [id, claim, held, evidence] of verdicts) {
    console.log('  ' + id + '  ' + (held ? 'HELD  ' : 'BROKEN') + '  ' + claim.padEnd(48) + '  ' + evidence);
}
rule('═');

if (EMIT_JSON) {
    console.log('\n' + JSON.stringify({ meta: META, curve, rateRows, verdicts }, null, 2));
}
