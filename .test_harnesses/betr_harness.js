'use strict';
/**
 * betr_harness.js -- audits the Break-Even Tax Rate (BETR) signal in optimizer_core.js.
 *
 * Run:  node .test_harnesses/betr_harness.js
 *
 * WHAT IT TESTS
 * The tool shows a per-conversion-year BETR ("what future marginal rate makes this conversion
 * break even?") via computeBETR(tNow, rIRA, rTaxable, n). The closed-form is the standard Kitces
 * taxes-paid-from-outside form and is algebraically correct:
 *     BETR = tNow * (1+rTaxable)^n / (1+rIRA)^n
 * Two things about how it is USED are suspect:
 *   (1) HORIZON. The code sets n = years-to-RMD (max(1, rmdAge - age)). Kitces' n is the holding
 *       period until the money is consumed / bequeathed -- normally the full remaining life. Since
 *       (1+rTax)/(1+rIRA) < 1, too-small n pushes BETR too HIGH (understates the benefit).
 *   (2) SECOND-ORDER TAXES. The closed form models only "IRA grows then taxed once." It ignores
 *       that a smaller pre-tax IRA also means smaller RMDs -> less IRMAA, less SS taxation, less
 *       bracket stacking, less forced-taxable drag every year. Those make real conversions pay off
 *       at far lower future rates than the closed form predicts.
 *
 * GROUND TRUTH
 * BETR is inherently a LEGACY metric: it only has a finite answer when the IRA is still standing at
 * the horizon (a plan that drains the IRA either way has no "future rate on the remaining IRA").
 * So these scenarios deliberately leave a large terminal IRA. For each, we run the plan WITH its
 * conversions and WITHOUT (a plain no-conversion run -- extraConversionAmount 0, convertExcessToRoth
 * off -- so no excess withdrawal happens at all; audited fair 2026-07-23), then value both terminal
 * states at a heirs tax rate t:
 *     afterTaxNW(t) = nonIRA_after_tax + ira * (1 - t)              (linear in t)
 *     gain(t) = afterTaxNW_convert(t) - afterTaxNW_noconvert(t)
 *             = [C_conv - C_noconv] + [ira_noconv - ira_conv] * t   (increasing in t)
 * The EMPIRICAL break-even t* is where gain(t*) = 0:
 *     t* = (C_noconv - C_conv) / (ira_noconv - ira_conv)
 * Reading t*: convert wins whenever the true heirs/future rate exceeds t*. If t* <= 0, converting
 * wins at EVERY non-negative rate ("convert regardless"). We also print gain($) at concrete heirs
 * rates so the verdict needs no interpretation.
 *
 * VERDICT
 * Compare the tool's BETR (the rate it tells you that you must exceed) against the empirical t*.
 * If the tool says e.g. 25% but gain(t) is already positive at 15% or even 0%, the tool is telling
 * users NOT to convert in cases where converting clearly wins -- understating the benefit.
 */

// ── Bootstrap the engine exactly like optimizer_core.tests.js ────────────────────────────────
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
const PLANS = require('../plans');
require('../displayhelpers.js');
const { simulate, afterTaxNetWorth, computeBETR } = core;

// ── Scenarios: legacy plans (big IRA, modest spend) so a large terminal IRA survives ─────────
// P112. The household is `single-filer-long-horizon` in the plan bank, not a literal copied into
// this file. Its card records what it exercises, what its measured viability is, and what it
// CANNOT show: the widow penalty, or anything about a change of filing status - there is one person.
// Read plans/single-filer-long-horizon.js before reading a verdict off this harness.
const BASE = { ...PLANS.get("single-filer-long-horizon").inputs };

function mkLump(amt) { const a = new Array(45).fill(0); a[0] = amt; return a; }

const SCENARIOS = [
    { label: 'lump $500k yr0, g6% die90',  over: { extraConversionAmount: mkLump(500000) } },
    { label: 'lump $500k yr0, g8% die90',  over: { growth: 0.08, extraConversionAmount: mkLump(500000) } },
    { label: 'lump $500k yr0, g6% die85',  over: { die1: 85, extraConversionAmount: mkLump(500000) } },
    { label: 'annual $80k extra, g6%',     over: { extraConversionAmount: 80000 } },
    { label: 'annual $80k extra, g8%',     over: { growth: 0.08, extraConversionAmount: 80000 } },
    { label: 'bracket-fill 24%, convExc',  over: { strategy: 'bracket', stratRate: 0.24, convertExcessToRoth: true } },
];

const HEIRS_SAMPLES = [0, 0.15, 0.24, 0.32];

// ── Metrics ─────────────────────────────────────────────────────────────────────────────────
function afterTaxNW0AndIra(res) {
    const t = res.totals.terminal, cg = res.totals.capGainsRate ?? 0.15;
    return { C: afterTaxNetWorth(t, 0, cg), ira: t.ira, cg };  // C = NW valuing IRA at face (t=0)
}

function analyze(inputs) {
    const conv = simulate({ ...inputs, computeOC: false });
    // Plain no-conversion baseline: turn BOTH conversion mechanisms off. No excess withdrawal
    // occurs, so nothing needs refunding -- the fairest, most literal "did not convert" run.
    const noconv = simulate({ ...inputs, extraConversionAmount: 0, convertExcessToRoth: false, computeOC: false });

    const c = afterTaxNW0AndIra(conv), n = afterTaxNW0AndIra(noconv);
    const dIra = n.ira - c.ira;                                   // >0: converting shrank the IRA
    const tStar = Math.abs(dIra) < 1 ? null : (n.C - c.C) / dIra; // empirical break-even heirs rate
    const gainAt = (t) => afterTaxNetWorth(conv.totals.terminal, t, c.cg)
                        - afterTaxNetWorth(noconv.totals.terminal, t, n.cg);

    // The tool's own signal + the closed form recomputed at two horizons (same tNow/rates, only n differs).
    const first = conv.log.find(r => (r.rothConv ?? 0) > 1);
    const rmdAge = inputs.birthyear1 >= 1960 ? 75 : 73;
    const nRMD = Math.max(1, rmdAge - (first ? first.age1 : rmdAge));
    const nFull = conv.log[conv.log.length - 1].year - (first ? first.year : conv.log[0].year) + 1;
    const tNow = first ? (first['FedRate%'] ?? 0) + (first['StateRate%'] ?? 0) : 0;
    const rIRA = inputs.growth;
    const rTax = Math.max(0, inputs.growth - (inputs.dividendRate ?? 0) * (first ? (first['-capGainsRate'] ?? 0.15) : 0.15));

    return {
        convertedTotal: conv.log.reduce((s, r) => s + (r.rothConv ?? 0), 0),
        iraConv: c.ira, iraNoconv: n.ira,
        codeBETR: conv.totals.betrAvg,
        cfRMD: computeBETR(tNow, rIRA, rTax, nRMD),
        cfFull: computeBETR(tNow, rIRA, rTax, nFull),
        nRMD, nFull, tNow, tStar,
        gains: HEIRS_SAMPLES.map(gainAt),
    };
}

// ── Run ─────────────────────────────────────────────────────────────────────────────────────
const pct = (x) => (x == null ? '   -- ' : (x * 100).toFixed(1).padStart(5) + '%');
const tStarStr = (t) => t == null ? ' (drained)' : t <= 0 ? '<=0 (convert always)' : (t * 100).toFixed(1) + '%';
const k = (x) => (x >= 0 ? '+' : '') + Math.round(x / 1000) + 'k';

console.log('\nBETR AUDIT — the tool\'s BETR vs the TRUE simulated break-even heirs rate\n');
console.log('scenario                   | conv$k | codeBETR | CF@RMD | CF@full | n_RMD n_full | empirical t*');
console.log('-'.repeat(104));
const rows = [];
for (const s of SCENARIOS) {
    const r = analyze({ ...BASE, ...s.over });
    rows.push({ s, r });
    console.log(
        s.label.padEnd(26) + ' | ' + String(Math.round(r.convertedTotal / 1000)).padStart(5) + '  | ' +
        pct(r.codeBETR) + '  | ' + pct(r.cfRMD) + ' | ' + pct(r.cfFull) + ' | ' +
        String(r.nRMD).padStart(4) + '  ' + String(r.nFull).padStart(5) + ' | ' + tStarStr(r.tStar));
}

console.log('\nConcrete after-tax gain from converting, by heirs tax rate (positive = convert wins):');
console.log('scenario                   |  @0%   |  @15%  |  @24%  |  @32%  | tool says "need > ' + '"');
console.log('-'.repeat(104));
for (const { s, r } of rows) {
    console.log(
        s.label.padEnd(26) + ' | ' +
        r.gains.map(g => k(g).padStart(6)).join(' | ') + ' | need > ' + pct(r.codeBETR));
}

console.log('\nReading:');
console.log('  codeBETR = totals.betrAvg, the rate the tool tells you your future rate must EXCEED to convert.');
console.log('  CF@RMD / CF@full = the same closed form at years-to-RMD vs the full remaining horizon.');
console.log('  empirical t* = the heirs rate where converting actually ties not-converting in the full sim.');
console.log('  If the gain is already POSITIVE at rates below codeBETR, the tool is discouraging conversions');
console.log('  that in fact win -- i.e. BETR is overstated (benefit understated). Compare CF@RMD vs CF@full to');
console.log('  see how much of the gap is the horizon, and codeBETR vs empirical for the full error incl.');
console.log('  the RMD/IRMAA/SS second-order taxes the closed form omits entirely.\n');
// ── Reserve sensitivity: does reinvesting surplus (Cash Reserve / P2) change the verdict? ─────
// The whole audit turns on where surplus goes. Re-run each scenario with Cash Reserve OFF (legacy:
// all surplus to 3% Cash) vs a positive buffer (reinvest overflow to Brokerage) and show the
// empirical break-even t*. If t* moves from "<=0 / low" to "high," the surplus routing -- not BETR
// -- was driving the conversion verdict.
function empiricalTStar(inputs) {
    const conv = simulate({ ...inputs, computeOC: false });
    const nc = simulate({ ...inputs, extraConversionAmount: 0, convertExcessToRoth: false, computeOC: false });
    const tc = conv.totals.terminal, tn = nc.totals.terminal;
    const Cc = afterTaxNetWorth(tc, 0, conv.totals.capGainsRate ?? 0.15);
    const Cn = afterTaxNetWorth(tn, 0, nc.totals.capGainsRate ?? 0.15);
    const dIra = tn.ira - tc.ira;
    const t = Math.abs(dIra) < 1 ? null : (Cn - Cc) / dIra;
    const gainAt0 = afterTaxNetWorth(tc, 0, conv.totals.capGainsRate ?? 0.15) - afterTaxNetWorth(tn, 0, nc.totals.capGainsRate ?? 0.15);
    return { t, gainAt0 };
}
const tStr = (t) => t == null ? '(drained)' : t <= 0 ? '<=0 (convert always)' : (t * 100).toFixed(0) + '%';
console.log('\nReserve sensitivity — empirical break-even t* with surplus in Cash (OFF) vs reinvested:\n');
console.log('scenario                   | reserve OFF                | reserve $200k              ');
console.log('-'.repeat(80));
for (const s of SCENARIOS.slice(0, 5)) {
    const off = empiricalTStar({ ...BASE, ...s.over });
    const on = empiricalTStar({ ...BASE, ...s.over, CashReserve: 200000 });
    console.log(s.label.padEnd(26) + ' | ' +
        ('t* ' + tStr(off.t) + ' (@0% ' + k(off.gainAt0) + ')').padEnd(26) + ' | ' +
        ('t* ' + tStr(on.t) + ' (@0% ' + k(on.gainAt0) + ')'));
}
console.log('\nIf the OFF column says "convert always" while the reserve column says a high rate, the');
console.log('cash-drag (not BETR) was making conversions look good. See findings.md 2026-07-23 (P2).\n');

console.log('Caveats:');
console.log('  - The last row (bracket-fill + convExc) also over-withdraws in the no-conversion run and banks');
console.log('    that surplus to low-yield Cash, so part of its gap is the Cash-drag issue (audit Q2), not BETR.');
console.log('    The fixed-strategy lump/annual rows do NOT over-withdraw when not converting, so they isolate');
console.log('    the conversion decision -- but their no-conversion run still banks forced-RMD surplus to Cash,');
console.log('    which amplifies the empirical gain. Read the empirical t* as "this simulator rewards conversion');
console.log('    far below the rate BETR names," not as a clean real-world number.\n');

// ═════════════════════════════════════════════════════════════════════════════════════════════
// P116, 2026-09-10: THE SAME AUDIT ACROSS A REAL MIX OF HOUSEHOLDS.
//
// WHY THIS SECTION EXISTS. Everything above runs on ONE household with six overrides on it, so it
// measures six variations of a single shape - a single filer, long horizon, big IRA - and cannot
// tell a property of BETR apart from a property of that household. The published claim ("BETR is
// unreliable in BOTH directions") is a claim about the METRIC, and a one-household study is not
// entitled to it.
//
// WHAT IS HELD AND WHAT VARIES. Each household runs on ITS OWN inputs, unmodified except for the
// two conversion switches the comparison needs. No override ladder: the point is the spread of real
// shapes - state, filing status, horizon, IRA-to-taxable ratio, survivor window.
//
// THE VERDICT IS READ OFF THE GAIN CURVE, NOT OFF t*, AND THAT IS A CORRECTION.
// t* = (C_noconv - C_conv) / (ira_noconv - ira_conv) is only "the rate you must EXCEED" while the
// denominator is POSITIVE, i.e. while converting SHRANK the terminal IRA. That is the normal case
// and it is what the header above assumes - but it is not universal: on `age-gap-ira-heavy-ca` the
// converting run ends with the LARGER IRA, the denominator flips sign, and "exceeds t*" silently
// becomes "stays below t*". Read naively that household scores t* = 148.8% and looks like a plan
// that must never convert, while its actual gain is +$1.87M at a 0% heirs rate. So the verdict here
// is taken from the sign of the gain at each sampled rate, which cannot invert, and t* is printed
// beside it as a diagnostic with its direction stated.
//
// WHO IS EXCLUDED, AND SAID OUT LOUD RATHER THAN DROPPED. BETR is a LEGACY metric: it answers "what
// future rate on the REMAINING IRA makes this worth it", so it has no finite answer when the IRA is
// gone at the horizon, and none at all when the plan never converts. Both exclusions are printed
// with their reason and counted, because a scorer that silently skips households shrinks its sample
// without saying so (plans/README.md, and the `viable()` note in plans/index.js).
const HH_RATES = [0, 0.15, 0.24, 0.32];
const hhRows = [], hhSkipped = [];

for (const plan of PLANS.list()) {
    const inputs = { ...plan.inputs };
    let conv;
    try { conv = simulate({ ...inputs, computeOC: false }); }
    catch (e) { hhSkipped.push([plan.id, 'threw: ' + e.message]); continue; }

    const converted = conv.log.reduce((s, r) => s + (r.rothConv ?? 0), 0);
    if (converted < 1) { hhSkipped.push([plan.id, 'converts nothing - BETR is undefined']); continue; }
    if (!conv.totals.success) { hhSkipped.push([plan.id, 'does not fund every year - not a plan to rank']); continue; }

    const r = analyze(inputs);
    if (r.tStar === null) { hhSkipped.push([plan.id, 'IRA drained at the horizon - no remaining IRA to tax']); continue; }
    hhRows.push({ id: plan.id, r, converted, shrank: r.iraNoconv - r.iraConv > 0 });
}

console.log('\n' + '='.repeat(112));
console.log('THE SAME AUDIT ACROSS THE PLAN BANK  (P116, one row per household, no overrides)');
console.log('='.repeat(112) + '\n');
console.log('household                        | conv$k | codeBETR | CF@RMD | CF@full | converting at 0-32% | tool vs reality');
console.log('-'.repeat(120));

let over = 0, under = 0, agree = 0;
for (const h of hhRows) {
    const { id, r, converted } = h;
    const wins = r.gains.map(g => g > 0);
    const allWin = wins.every(Boolean), allLose = wins.every(w => !w);
    // The tool says "convert only if your future rate exceeds codeBETR". If converting already wins
    // at every rate in the sampled band INCLUDING rates below codeBETR, the tool named a hurdle the
    // plan did not have to clear: it is OVERSTATED, and a user following it declines a win.
    let shape = allWin ? 'wins at every rate' : allLose ? 'loses at every rate' : 'flips inside the band';
    let verdict;
    if (allWin && r.codeBETR != null && r.codeBETR > 0.02) { verdict = 'OVERSTATED  (declines a win)'; over++; }
    else if (allLose && r.codeBETR != null && r.codeBETR < 0.32) { verdict = 'understated (accepts a loss)'; under++; }
    else { verdict = 'consistent'; agree++; }
    h.shape = shape; h.verdict = verdict;
    console.log(
        id.padEnd(32) + ' | ' + String(Math.round(converted / 1000)).padStart(5) + '  | ' +
        pct(r.codeBETR) + '  | ' + pct(r.cfRMD) + ' | ' + pct(r.cfFull) + ' | ' +
        shape.padEnd(19) + ' | ' + verdict);
}

console.log('\nhouseholds scored: ' + hhRows.length + '   overstated: ' + over
    + '   understated: ' + under + '   consistent: ' + agree);
console.log('\nExcluded, with the reason (never silently dropped):');
for (const [id, why] of hhSkipped) console.log('  ' + id.padEnd(32) + ' ' + why);

console.log('\nAfter-tax gain from converting, by heirs rate (positive = convert wins):');
console.log('household                        |    @0%   |   @15%   |   @24%   |   @32%   | tool: need > | t* (direction)');
console.log('-'.repeat(120));
for (const { id, r, shrank } of hhRows) {
    const dir = shrank ? 'exceed' : 'stay below';
    console.log(id.padEnd(32) + ' | ' + r.gains.map(g => k(g).padStart(8)).join(' | ')
        + ' | ' + pct(r.codeBETR) + '      | ' + tStarStr(r.tStar) + ' (' + dir + ')');
}

// ── the confound, carried into the household sweep because it decides how far this generalizes ──
// The caveat above applies to every row here: the no-conversion run banks its surplus - forced RMDs
// included - into low-yield Cash, and that drag alone makes converting look good. Re-run each scored
// household with a Cash Reserve set, which reinvests the overflow into the Brokerage instead, and
// see whether the verdict survives. Any household that flips was measuring the routing, not BETR.
console.log('\nCash-drag control - the same households with surplus reinvested (CashReserve $200k):');
console.log('household                        | @0% reserve OFF | @0% reinvested | did the control bite?');
console.log('-'.repeat(120));
let held = 0, flipped = 0, noop = 0;
for (const { id, r } of hhRows) {
    const plan = PLANS.get(id);
    const on = empiricalTStar({ ...plan.inputs, CashReserve: 200000 });
    const offGain = r.gains[0], onGain = on.gainAt0;
    // A household ALREADY routing its surplus away from Cash cannot be tested this way: Cyclic
    // sends every surplus dollar to the Brokerage regardless, so the reserve arm IS the same run.
    // Counting those as "the verdict held" would report a control that never ran - the same
    // discipline the exclusion list above follows. Detected by the OUTCOME rather than by reading
    // the flag, so a household whose routing is fixed for some other reason is caught too.
    const bit = Math.abs(onGain - offGain) > 1;
    const same = (offGain > 0) === (onGain > 0);
    let note;
    if (!bit) { note = 'no-op - surplus already leaves Cash (' + (plan.inputs.cyclicEnabled ? 'Cyclic' : 'reserve set') + ')'; noop++; }
    else if (same) { note = 'BIT, sign holds (' + Math.round(100 * (1 - onGain / offGain)) + '% smaller)'; held++; }
    else { note = 'BIT and FLIPS - the routing, not BETR'; flipped++; }
    console.log(id.padEnd(32) + ' | ' + k(offGain).padStart(15) + ' | ' + k(onGain).padStart(14) + ' | ' + note);
}
console.log('\ncontrol bit on ' + (held + flipped) + ' of ' + hhRows.length + ' households: sign held on '
    + held + ', flipped on ' + flipped + '. It could not run on ' + noop + ' (surplus already reinvested).');
console.log('Where it bit and held, the SIZE of the gain still fell sharply - so the routing inflates');
console.log('the magnitude even where it does not decide the sign. On the single household at the top');
console.log('of this file the same control flips EVERY scenario, which is why one household was never');
console.log('enough to make a claim about the metric.\n');
