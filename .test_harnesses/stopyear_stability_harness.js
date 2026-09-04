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
 * `futureIRATaxRate` is UNDEFINED on the canonical scenario. `afterTaxWealthOfLogRow()` returns raw
 * `r.totalWealth` when it is null, so the search is maximizing GROSS wealth, which prices a dollar
 * inside the IRA the same as a dollar inside the Roth. Every conversion is then a pure cost to the
 * scored quantity. Predictions A7 and A8 exist because of that reading.
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
        rows.push({
            cut,
            lastConvYear: cut === 0 ? null : start + cut - 1,
            score: afterTaxWealthOfLogRow(last, heirsRate),
            totalWealth: last.totalWealth,
            conv: res.log.reduce((s, r) => s + (r.rothConv ?? 0), 0),
            spend: res.totals.spend,
            tax: res.totals.tax,
            roth: (last.Roth ?? 0),
            ira: (last.IRA1 ?? 0) + (last.IRA2 ?? 0),
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
