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
require('../displayhelpers.js');
const { simulate, afterTaxNetWorth, computeBETR } = core;

// ── Scenarios: legacy plans (big IRA, modest spend) so a large terminal IRA survives ─────────
const BASE = {
    STATEname: 'CA', strategy: 'fixed', nYears: 40,
    birthyear1: 1965, birthmonth1: 1, die1: 90,
    birthyear2: 0, birthmonth2: 12, die2: 0,
    IRA1: 3000000, IRA2: 0, Roth: 0, Roth2: 0,
    Brokerage: 300000, BrokerageBasis: 300000, Cash: 200000,
    ss1: 40000, ss1Age: 70, ss2: 0, ss2Age: 70,
    pensionAnnual: 0, survivorPct: 0, pensionCola: false,
    spendGoal: 90000, spendChange: 0, iraBaseGoal: 0,
    inflation: 0.025, cpi: 0.025, growth: 0.06,
    cashYield: 0.03, dividendRate: 0.02,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: false, propWithdraw: 0, iraWithdrawPct: 0.05,
    startInYear: 2026, dividendReinvest: true, startYear: 2026, hasSpouse: false,
};

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
