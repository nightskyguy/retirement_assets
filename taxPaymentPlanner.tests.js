'use strict';
/**
 * taxPaymentPlanner.tests.js
 * Run with: node taxPaymentPlanner.tests.js
 *
 * TEST COUNTS ARE PINNED OUTSIDE THIS FILE. Adding or removing a test here means updating, in the
 * same commit:
 *   1. `TestTiers.EXPECTED` in optimizer_tests.js - ONE object holding the count of EVERY node
 *      suite, so the file you have to edit is usually not the tool you are working on.
 *   2. the suite table in .githooks/README.md
 * Measure, never guess: run this file and use the printed total. The staleness guard is page-wide,
 * so a test added to ANY suite turns the retirement_optimizer.html self-check badge red until all
 * of those counts match - which is exactly what a Tax Payment Planner release did on 2026-08-17.
 *
 * Covers:
 *   1. No IRA operations — all quarterly
 *   2. RMD only — full tax coverage from IRA draw
 *   3. Conversion only — no RMD (60-day replace auto-analysis, month from todayDate),
 *      plus both December branches: withholding fires when coverage misses safe harbor,
 *      and stays off when safe harbor is already met
 *   4. Insufficient IRA withdrawal — partial coverage + quarterly shortfall
 *   5. Dual-IRA cross-optimizer — later IRA carries all withholding
 *   6. IRA-exempt state — state tax forced to quarterly
 *   7. Replacement analysis — December conversion with draws covering everything, so
 *      nothing is withheld and there is nothing to replace
 *   8. Replacement analysis — early-year conversion has a large first-year gain,
 *      plus 8b, the regression guard: both sides of the trade share ONE period
 *   9. RMD + conversion same IRA — ordering rule enforced (February todayDate → nextMonth=Mar)
 *  10. Zero taxes — no actions generated
 */

// Everything below is wrapped in an IIFE for the browser's sake. Two classic scripts cannot both
// declare a top-level `const TaxPaymentPlanner` — that is one global lexical scope and a duplicate
// declaration there is a SyntaxError, so without the wrapper the whole test file silently fails to
// parse once the engine is already on the page. The wrapper also keeps `test`, `assert`, `BASE` and
// friends out of the app's global scope, which matters now that this file loads into a live page.
(() => {

// Dual-mode: node `require`, or the global the engine sets when loaded by a <script> tag.
// Mirrors the export guard at the bottom of taxPaymentPlanner.js.
const TaxPaymentPlanner = (typeof module !== 'undefined' && module.exports)
  ? require('./taxPaymentPlanner.js')
  : window.TaxPaymentPlanner;

const T = TaxPaymentPlanner.ACTION_TYPES;

let passed = 0, failed = 0;

// test() REGISTERS rather than runs. Everything below is top-level, and running on registration
// would mean the browser could only ever get the results as a side effect of loading the file.
// Registering instead lets runTaxPlannerTests() be called on demand, and keeps the file
// otherwise unchanged — no reindenting 600 lines into a wrapper function.
const TESTS = [];

function test(name, fn) {
  TESTS.push([name, fn]);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function near(a, b, tol) {
  tol = tol || 2;
  return Math.abs(a - b) <= tol;
}

function assertNear(a, b, msg, tol) {
  if (!near(a, b, tol)) throw new Error(`${msg}: expected ~${b}, got ${a}`);
}

// Shared date that puts us in May 2026 — Q1 federal payment has already passed
const TODAY = new Date(2026, 4, 21); // May 21, 2026

const BASE = {
  taxYear: 2026,
  state: 'TX',          // no state income tax — simplifies state assertions
  federalTax: 20000,
  stateTax: 0,
  priorYearFedTax: 19000,
  priorYearStateTax: 0,
  highIncomeFiler: false,
  portfolioRate: 0.07,
  hysaGross: 0.038,
  marginalOrdRate: 0.30,
  cgRateBlended: 0.20,
  appreciationPct: 0.40,
  todayDate: TODAY,
};

// ── 1. No IRA operations ──────────────────────────────────────────────────
test('No IRA — strategy is all_quarterly', () => {
  const plan = TaxPaymentPlanner.computePaymentPlan({ ...BASE, federalTax: 20000 });
  assert(plan.strategy === 'all_quarterly', `Expected all_quarterly, got ${plan.strategy}`);
  const qActions = plan.actions.filter(a => a.type === T.Q_FED);
  assert(qActions.length === 4, `Expected 4 quarterly federal actions, got ${qActions.length}`);
  const totalQ = qActions.reduce((s, a) => s + a.federalWithholding, 0);
  assertNear(totalQ, 20000, 'Total quarterly federal coverage');
  assert(plan.summary.shortfall === 0 || plan.summary.shortfall < 5, 'No shortfall expected');
});

// ── 2. RMD only — full coverage ───────────────────────────────────────────
test('RMD only — full coverage, ye_ira_full strategy', () => {
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1Rmd: 25000,
    todayDate: new Date(2026, 10, 15), // November 15 → nextMonth = December
  });
  assert(
    plan.strategy === 'ye_ira_full' || plan.strategy === 'ye_ira_partial',
    `Expected IRA strategy, got ${plan.strategy}`
  );
  const rmdActions = plan.actions.filter(a => a.type === T.RMD);
  assert(rmdActions.length >= 1, 'Expected at least one RMD action');
  assert(rmdActions[0].amount === 25000, `Expected RMD amount 25000, got ${rmdActions[0].amount}`);
  // All federal tax should be covered via IRA withholding
  const iraWithheld = plan.actions
    .filter(a => a.type === T.RMD)
    .reduce((s, a) => s + a.federalWithholding, 0);
  assertNear(iraWithheld, 20000, 'Federal tax covered by RMD withholding');
  assert(plan.summary.shortfall === 0, `Expected zero shortfall, got ${plan.summary.shortfall}`);
  assert(rmdActions[0].date.month === 12, 'RMD should be in December');
});

// ── 3. Conversion only — no RMD ───────────────────────────────────────────
test('Conversion only — 60-day replace recommended for June conversion', () => {
  // TODAY = May 21 → nextMonth = June; 6 months Roth growth >> 60-day HYSA cost → withhold
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1RothConversion: 80000,
    federalTax: 15000,
  });
  const convAction = plan.actions.find(a => a.type === T.ROTH_CONV);
  assert(convAction, 'Expected a Roth conversion action');
  assert(convAction.date.month === 6, `Expected conversion in June (nextMonth), got month ${convAction.date.month}`);
  // With 6 months remaining at 7% portfolio rate vs. tiny 60-day HYSA cost → should withhold
  assert(plan.summary.ira1.doWithhold === true, '60-day replace should be recommended for June');
  assert(convAction.federalWithholding > 0, 'Expected federal withholding on conversion');
});

test('December conversion — withholds when coverage would miss safe harbor', () => {
  // November todayDate → nextMonth = December → 0 months of Roth growth remaining.
  // No draws, so nothing covers the tax and safe harbor (prior-year $19,000) is missed.
  // Withholding is deemed paid across all four due dates (IRC 6654(g)), so it fires here
  // even though there is no Roth growth left to capture.
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1RothConversion: 80000,
    federalTax: 15000,
    todayDate: new Date(2026, 10, 15), // November 15 → nextMonth = December
  });
  assert(plan.summary.ira1.doWithhold === true, 'December withholding should fire when safe harbor is missed');
  const convAction = plan.actions.find(a => a.type === T.ROTH_CONV);
  assert(convAction.date.month === 12, `Expected December conversion, got month ${convAction.date.month}`);
  assert(convAction.federalWithholding > 0, 'Expected federal withholding on the December conversion');
  const restore = plan.actions.find(a => a.type === T.CASH_RESTORE);
  assert(restore, 'Expected a restore-cash action alongside the withholding');
  // The substantive reversal from the duration fix: replacing is still right in December.
  // yearsRem is 0 because the money does not land until January, so the first-year gain is
  // $0, but the Roth-vs-cash spread applies every year afterward. The old formula returned
  // recommended=false here only because a phantom 60-day cost survived a zeroed-out benefit.
  const rep = plan.summary.ira1.replacement;
  assert(rep.withheld > 0, 'Expected the replacement analysis to see the withheld amount');
  assert(rep.gain === 0, `Expected first-year gain=0 for a December restore, got ${rep.gain}`);
  assert(rep.recommended === true, 'December replacement should still be recommended');
  assert(rep.restoreDate.year === 2027, `Expected the restore to land in 2027, got ${rep.restoreDate.year}`);
});

test('December conversion — no withholding when safe harbor is already met', () => {
  // Prior-year federal tax $10,000 → safe harbor $10,000. Draws cover $12,000 of the
  // $20,000 liability, so safe harbor is satisfied and the $8,000 remainder can ride to
  // quarterly estimates penalty-free. No reason to touch the December conversion.
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1Rmd: 12000,
    ira1RothConversion: 20000,
    federalTax: 20000,
    priorYearFedTax: 10000,
    todayDate: new Date(2026, 10, 15), // November 15 → nextMonth = December
  });
  assert(plan.summary.ira1.doWithhold === false, 'Safe harbor already met — December withholding should stay off');
  const convAction = plan.actions.find(a => a.type === T.ROTH_CONV);
  assert(convAction.federalWithholding === 0, 'Expected no withholding on the December conversion');
  assert(plan.summary.shortfall > 0, 'Expected the remainder to flow to quarterly estimates');
});

// ── 4. Insufficient IRA withdrawal ───────────────────────────────────────
test('Insufficient IRA — partial coverage + quarterly shortfall', () => {
  // IRA draw of $8K, tax of $20K → $12K shortfall → quarterly estimates
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1Rmd: 8000,
    federalTax: 20000,
  });
  assert(
    plan.strategy === 'ye_ira_partial',
    `Expected ye_ira_partial, got ${plan.strategy}`
  );
  assert(plan.summary.shortfall > 0, 'Expected a shortfall');
  assertNear(plan.summary.shortfall, 12000, 'Shortfall should be ~12000', 100);
  // Should have both IRA draw action AND quarterly federal actions
  const qActions = plan.actions.filter(a => a.type === T.Q_FED);
  assert(qActions.length > 0, 'Expected quarterly federal estimates for shortfall');
  const totalCovered = plan.summary.totalCovered;
  assertNear(totalCovered, 20000, 'Total coverage should equal tax due', 5);
});

// ── 5. Dual-IRA cross-optimizer ───────────────────────────────────────────
test('Dual-IRA — later-month IRA carries all withholding', () => {
  // IRA1: already-taken draw → prevMonth (April), $10K — earlier, no withholding
  // IRA2: not yet taken     → nextMonth (June),   $25K — later, carries all $20K
  // TODAY = May 21, so prevMonth=April(4), nextMonth=June(6); IRA2 (6) > IRA1 (4)
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1Rmd: 10000, ira1RmdTaken: true,   // places IRA1 RMD in April (prevMonth)
    ira2Rmd: 25000,                        // places IRA2 draw in June  (nextMonth)
    federalTax: 20000,
  });
  assert(plan.strategy !== 'all_quarterly', 'Should use IRA strategy with two draws');
  const ira1Actions = plan.actions.filter(a => a.iraNum === 1 && a.type === T.RMD);
  const ira2Actions = plan.actions.filter(a => a.iraNum === 2 && a.type === T.RMD);
  assert(ira1Actions.length > 0, 'Expected IRA 1 RMD action');
  assert(ira2Actions.length > 0, 'Expected IRA 2 RMD action');
  const ira1Withheld = ira1Actions.reduce((s, a) => s + a.federalWithholding, 0);
  const ira2Withheld = ira2Actions.reduce((s, a) => s + a.federalWithholding, 0);
  assert(ira1Withheld === 0, `IRA1 (April / earlier) should have zero withholding; got ${ira1Withheld}`);
  assert(ira2Withheld > 0, `IRA2 (June / later) should carry all withholding; got ${ira2Withheld}`);
  assertNear(ira2Withheld, 20000, 'IRA2 should cover full federal tax', 5);
});

// ── 6. IRA-exempt state ───────────────────────────────────────────────────
test('IRA-exempt state (IL) — state tax via quarterly only', () => {
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    state: 'IL',
    ira1Rmd: 30000,
    federalTax: 20000,
    stateTax: 5000,
  });
  assert(plan.stateInfo.iraExempt, 'IL should be IRA-exempt');
  // State withholding on IRA draws should be zero
  const iraActions = plan.actions.filter(a => a.type === T.RMD);
  iraActions.forEach(a => {
    assert(a.stateWithholding === 0,
      `IL IRA draw should have zero state withholding; got ${a.stateWithholding}`);
  });
  // State tax should be covered by quarterly estimates
  const stateQActions = plan.actions.filter(a => a.type === T.Q_STATE);
  assert(stateQActions.length > 0, 'Expected quarterly state estimate actions for IL');
  const totalStateQ = stateQActions.reduce((s, a) => s + a.stateWithholding, 0);
  assertNear(totalStateQ, 5000, 'State quarterly estimates should cover state tax', 5);
});

// ── 7. Replacement analysis — December, nothing withheld ──────────────────
test('Replacement analysis — December conversion, draws cover everything', () => {
  // November todayDate → nextMonth = December → monthsRem = 12-12 = 0.
  // `recommended` scores the Roth-growth economics only. It is no longer the sole gate on
  // December withholding — see the safe-harbor tests above — but with draws covering the
  // full liability here there is no shortfall to close, so nothing is withheld either way.
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1Rmd: 30000,
    ira1RothConversion: 20000,
    federalTax: 20000,
    todayDate: new Date(2026, 10, 15), // November 15 → nextMonth = December
  });
  const r = plan.summary.ira1.replacement;
  assert(r, 'Expected replacement analysis on summary');
  assert(r.monthsRem === 0, `Expected monthsRem=0, got ${r.monthsRem}`);
  assert(r.withheld === 0, `Draws cover the liability, so nothing is withheld; got ${r.withheld}`);
  assert(r.gain === 0, `Expected first-year gain=0, got ${r.gain}`);
  // Not recommended here because there is nothing to replace, NOT because December is a bad
  // month to replace in. The withholding case is covered in test 3c above.
  assert(r.recommended === false, 'Nothing withheld means nothing to replace');
  assert(r.spread > 0, `Roth-vs-cash spread should still be positive, got ${r.spread}`);
});

// ── 8. Replacement analysis — early-year conversion ───────────────────────
test('Replacement analysis — early-year conversion has a large first-year gain', () => {
  // January 1 todayDate → nextMonth = February → monthsRem = 12-2 = 10
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1RothConversion: 50000,
    federalTax: 8000,
    todayDate: new Date(2026, 0, 1), // January 1 → nextMonth = February
  });
  const r = plan.summary.ira1.replacement;
  assert(r.monthsRem === 10, `Expected monthsRem=10 (Feb conversion), got ${r.monthsRem}`);
  assert(r.withheld > 0, 'Expected withholding on an early-year conversion');
  assert(r.gain > 0, `Expected a positive first-year gain, got ${r.gain}`);
  assert(r.recommended === true, 'Early-year replacement should be recommended');
  // Growth accrues from the restore date, not the conversion date, so the period is short of
  // the full 10 months remaining.
  assert(r.yearsRem < 10 / 12, `yearsRem (${r.yearsRem}) should start at the restore date, not the conversion`);
});

// ── 8b. Regression guard — both sides of the trade share ONE period ───────
test('Replacement gain = withheld x spread x yearsRem, at two conversion months', () => {
  // This is the defect this test exists to catch. The Roth side and the cash side must be
  // weighted by the SAME period. The previous implementation used monthsRem/12 for the Roth
  // and 60/365 for the cash, which inflated the gain by 20-50% and went negative in December.
  // BASE uses the module defaults: portfolioRate 0.07, hysaGross 0.038, marginalOrdRate 0.30.
  const hysaNet = 0.038 * (1 - 0.30);
  const spread  = 0.07 - hysaNet;

  [
    ['February', new Date(2026, 0, 1)],
    ['June',     new Date(2026, 4, 21)],
  ].forEach(([label, todayDate]) => {
    const plan = TaxPaymentPlanner.computePaymentPlan({
      ...BASE,
      ira1RothConversion: 80000,
      federalTax: 15000,
      todayDate,
    });
    const r = plan.summary.ira1.replacement;
    assertNear(r.spread, spread, `${label}: spread should be portfolioRate minus hysaNet`, 1e-9);
    assertNear(r.altRate, hysaNet, `${label}: altRate should be the after-tax HYSA rate`, 1e-9);
    assertNear(r.gain, r.withheld * spread * r.yearsRem,
      `${label}: gain must be one differential over one period`, 0.01);
    // And the old shape must be gone, so a future edit cannot quietly resurrect it.
    assert(r.cost60 === undefined, `${label}: cost60 should no longer exist`);
    assert(r.benefit === undefined, `${label}: benefit should no longer exist`);
  });
});

// ── 9. RMD + conversion same IRA — ordering rule ──────────────────────────
test('RMD + conversion same IRA — ordering rule moves RMD before conversion', () => {
  // February 15 todayDate → nextMonth = March.  Both draw and conv default to March.
  // cm(3) <= rm(3) with convFuture=true → hasConflict=true → RMD pulled to March (conv month).
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1Rmd: 15000,
    ira1RothConversion: 20000,
    federalTax: 10000,
    todayDate: new Date(2026, 1, 15), // February 15 → nextMonth = March
  });
  assert(plan.summary.ira1.hasConflict === true, 'Expected ordering conflict');
  // RMD should be co-scheduled in March (same as conversion month)
  assert(plan.summary.ira1.planARmdMonth === 3,
    `RMD should be in March, got month ${plan.summary.ira1.planARmdMonth}`);
});

// ── 10. Zero taxes ────────────────────────────────────────────────────────
test('Zero taxes — no payment actions generated', () => {
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    federalTax: 0,
    stateTax: 0,
    ira1Rmd: 10000,
  });
  const paymentActions = plan.actions.filter(a =>
    a.type === T.Q_FED || a.type === T.Q_STATE ||
    (a.type === T.RMD && a.federalWithholding > 0)
  );
  assert(paymentActions.length === 0,
    `Expected no payment actions with zero tax; got ${paymentActions.length}`);
});

// ── 11. Coverage invariant ────────────────────────────────────────────────
// Both Plan A and Plan B must always satisfy: totalCovered + shortfall === totalTaxDue
// Regression for scenario where Plan A plugs gap via conversion withholding but
// Plan B skips 60-day withholding (December → not recommended), exposing a shortfall.
test('Coverage invariant: totalCovered + shortfall === totalTaxDue for both plans', () => {
  // Set todayDate to January so nextMonth=February and prevMonth=January—stable across time
  const plan = TaxPaymentPlanner.computePaymentPlan({
    state: 'CA',
    federalTax: 35000,
    stateTax: 12000,
    priorYearFedTax: 33000,
    priorYearStateTax: 11500,
    ira1Rmd: 5000,
    ira1Voluntary: 30000,
    ira1RothConversion: 20000,
    ira2Rmd: 9500,
    ssIncome: 20000,
    pensionIncome: 15000,
    interest: 5000,
    qualifiedDivs: 8000,
    capitalGains: 10000,
    portfolioRate: 0.07,
    hysaGross: 0.038,
    marginalOrdRate: 0.30,
    todayDate: new Date(2026, 0, 15),  // Jan 15 — stable, nextMonth=Feb
  });

  const totalTax = plan.summary.totalTaxDue;

  // The decomposition is withholding + shortfall, NOT totalCovered + shortfall.
  // totalCovered means everything the plan pays, quarterly estimates included, so adding
  // shortfall to it double-counts the gap. This test used to read the gap off totalCovered,
  // which only worked because the comparison plans skipped building their estimates.
  const aWithheld  = plan.summary.iraWithholdingUsed;
  const aShortfall = plan.summary.shortfall;
  assertNear(aWithheld + aShortfall, totalTax,
    `Plan A: withholding(${aWithheld}) + shortfall(${aShortfall}) should equal tax(${totalTax})`, 2);

  // Every plan the matrix produced, not just two: D and Q are held to the same invariant.
  Object.entries(plan.plans).filter(([, v]) => v).forEach(([k, obj]) => {
    const w  = obj.summary.iraWithholdingUsed;
    const sf = obj.summary.shortfall;
    if (obj.strategy === 'all_quarterly') {
      // Plan Q has no withholding SHORTFALL to report: paying by estimates is the plan, not a
      // gap in it, so summary.shortfall is 0 by construction. The decomposition that applies to
      // it is the payment reconciliation immediately below, which every plan has to satisfy.
      assert(w === 0, `Plan ${k} pays by estimates, so it must withhold nothing; got ${w}`);
    } else {
      assertNear(w + sf, totalTax,
        `Plan ${k}: withholding(${w}) + shortfall(${sf}) should equal tax(${totalTax})`, 2);
    }
    // No exceptions: withholding plus scheduled estimates is the whole liability.
    const paid = obj.actions.reduce((sum, a) => sum + a.federalWithholding + a.stateWithholding, 0);
    assertNear(paid, totalTax, `Plan ${k} pays ${paid} of ${totalTax}`, 2);
  });

  const cShortfall = plan.plans.C.summary.shortfall;

  // Plan C (everything in December) specifically should have a shortfall here because a December
  // conversion skips 60-day withholding (0 months of Roth growth → not worth the cost), leaving
  // draws ($44,500) short of total tax ($47,000).
  assert(cShortfall > 0,
    `Plan C should show a shortfall when draws < total tax and conv withholding is skipped; got ${cShortfall}`);

  // Plan A should have no shortfall — conversion withholding plugs the gap.
  assert(aShortfall === 0,
    `Plan A should fully cover taxes via conversion withholding; shortfall was ${aShortfall}`);
});

// ── 11b. Draw-only timing comparison (no conversion) ──────────────────────
// Regression guard: the Early-vs-December comparison used to be gated behind
// `hasAnyConversion`, so a draw-only plan only ever showed the single early plan and never
// computed the December-deferred alternative. A not-yet-taken draw is deferrable, so the
// comparison must now appear. Under the P56 lettering the plans are A (early), C (December),
// D (early spending draws with a December tax holdback) and Q (quarterly estimates); B is the one
// that cannot exist without a conversion. C must win at rates where year-end IRA beats cash.
test('Draw-only — the December plan appears and wins, and B is omitted with a reason', () => {
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1Rmd: 30000,          // covers the $20,000 federal tax with room to spare
    federalTax: 20000,
    todayDate: new Date(2026, 4, 21), // May → nextMonth = June (Plan B); Plan C = December
  });

  // A (early) is the parent, C (December) is computed, and the hybrid B is NOT: there is no
  // conversion to pull early, so it would duplicate C.
  assert(plan.plans !== null, 'Draw-only plan must build the plan matrix');
  assert(plan.plans.C !== null, 'Draw-only plan must compute the December plan (C)');
  assert(plan.plans.B === null, 'Draw-only plan must NOT compute the hybrid (B)');
  assert(plan.plans.Q !== null, 'Draw-only plan must offer the quarterly plan (Q)');

  const cc = plan.comparison;
  assert(cc !== null, 'Draw-only plan must build a comparison');
  assert(cc.hasConversion === false, 'Comparison should be flagged draw-only');
  assert(!cc.letters.includes('B'), `B must not be a column; got ${cc.letters.join('')}`);
  assert(cc.best === 'C', `December (Plan C) should win; got ${cc.best}`);
  assert(cc.perPlan.A.total > cc.perPlan.C.total,
    `Early draws should cost more than December; A ${cc.perPlan.A.total} vs C ${cc.perPlan.C.total}`);
  assert(cc.perPlan.A.rothGrowth === 0 && cc.perPlan.C.rothGrowth === 0,
    'No conversion means no Roth growth credit anywhere');

  // The plans actually schedule the draw where they claim to.
  const cDraw = plan.plans.C.actions.find(a => a.type === T.RMD);
  const aDraw = plan.actions.find(a => a.type === T.RMD);
  assert(cDraw && cDraw.date.month === 12, `Plan C draw should be December, got ${cDraw && cDraw.date.month}`);
  assert(aDraw && aDraw.date.month === 6, `Plan A draw should be June, got ${aDraw && aDraw.date.month}`);

  // "Plan A" is a legitimate column under the new lettering, so its ABSENCE is no longer the
  // thing to assert. What must not happen is a column vanishing with no explanation, which is
  // the complaint this phase exists to fix.
  assert(/Plan B \(hybrid\) is not shown/.test(plan.text), 'Text must explain why B is absent');
  assert(/Plan B \(hybrid\) is not shown/.test(plan.html), 'HTML must explain why B is absent');
  assert(!/Plan B —/.test(plan.text), 'Draw-only text must not render a Plan B section');
  assert(/Plan A — Early/.test(plan.text) && /Plan C — Late/.test(plan.text),
    'Both surviving plans should be labelled by what they do');
});

// An already-taken draw is locked to its actual month and offers no timing choice, so it must
// NOT trigger the comparison on its own.
test('Draw-only — an already-taken draw does not trigger a comparison', () => {
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1Rmd: 30000,
    ira1RmdTaken: true,      // locked to a past month — nothing left to defer
    federalTax: 20000,
    todayDate: new Date(2026, 4, 21),
  });
  assert(plan.plans === null, 'A locked (already-taken) draw must not build the plan matrix');
  assert(plan.comparison === null, 'A locked draw must not build a comparison');
});

// ── 12. Business-day helpers ──────────────────────────────────────────────
const {
  isBusinessDay, nextBusinessDay, firstMondayAfter, dueDateFor, ORDERING_BUFFER_DAYS,
} = TaxPaymentPlanner;

test('isBusinessDay — weekends, the two holidays, and their observance shifts', () => {
  assert(isBusinessDay(new Date(2026, 6, 15)) === true,  'Wed Jul 15 2026 is a business day');
  assert(isBusinessDay(new Date(2026, 6, 18)) === false, 'Sat Jul 18 2026 is not');
  assert(isBusinessDay(new Date(2026, 6, 19)) === false, 'Sun Jul 19 2026 is not');
  // Jan 1 2026 is a Thursday, Dec 25 2026 is a Friday — both fall on their actual dates.
  assert(isBusinessDay(new Date(2026, 0,  1)) === false, "New Year's Day 2026 is not");
  assert(isBusinessDay(new Date(2026, 11, 25)) === false, 'Christmas 2026 is not');
  // 5 USC 6103(b): Christmas 2027 is a Saturday, so it is observed Friday Dec 24.
  assert(isBusinessDay(new Date(2027, 11, 24)) === false, 'Christmas observed Fri Dec 24 2027 is not');
  // Jan 1 2028 is a Saturday, so it is observed Friday Dec 31 2027.
  assert(isBusinessDay(new Date(2027, 11, 31)) === false, "New Year's observed Fri Dec 31 2027 is not");
  // Jan 1 2033 is a Saturday -> observed Fri Dec 31 2032; Jan 1 2034 is a Sunday -> observed Mon Jan 2.
  assert(isBusinessDay(new Date(2034, 0, 2)) === false, "New Year's observed Mon Jan 2 2034 is not");
});

test('nextBusinessDay — rolls forward off weekends and across year end', () => {
  const iso = d => d.toISOString().slice(0, 10);
  assert(iso(nextBusinessDay(new Date(2026, 6, 17))) === '2026-07-17', 'a Friday stays put');
  assert(iso(nextBusinessDay(new Date(2026, 6, 18))) === '2026-07-20', 'Saturday rolls to Monday');
  // Dec 31 2026 is a Thursday, but Jan 1 2027 is a Friday holiday, so a Jan 1 target
  // must land on Monday Jan 4.
  assert(iso(nextBusinessDay(new Date(2027, 0, 1))) === '2027-01-04', "New Year's Day 2027 rolls to Mon Jan 4");
});

test('firstMondayAfter — the January draw target, every year 2026 to 2032', () => {
  for (let y = 2026; y <= 2032; y++) {
    const m = firstMondayAfter(y, 1, 1);
    assert(m.getDay() === 1, `${y}: expected a Monday, got day ${m.getDay()}`);
    assert(m > new Date(y, 0, 1), `${y}: must be strictly after New Year's Day`);
    assert(m.getMonth() === 0, `${y}: must still be in January`);
  }
});

// ── 13. The January 1 regression ──────────────────────────────────────────
test('Future tax year with RMD + conversion no longer schedules January 1', () => {
  // nextMonth is forced to January for any future tax year, and the same-month split used
  // to be day 1 / day 8. For 2028 that produced Jan 1 (New Year's Day AND a Saturday) and
  // Jan 8 (also a Saturday). Now: first Monday after New Year's, plus the ordering buffer.
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    taxYear: 2028,
    ira1Rmd: 30000,
    ira1RothConversion: 40000,
    federalTax: 20000,
    todayDate: new Date(2026, 6, 29),
  });
  const rmd  = plan.actions.find(a => a.type === T.RMD);
  const conv = plan.actions.find(a => a.type === T.ROTH_CONV);
  assert(rmd.date.month === 1 && rmd.date.day === 3,  `Expected RMD on Jan 3 2028, got ${rmd.date.month}/${rmd.date.day}`);
  assert(conv.date.month === 1 && conv.date.day === 10, `Expected conversion on Jan 10 2028, got ${conv.date.month}/${conv.date.day}`);
  const gap = (new Date(2028, 0, conv.date.day) - new Date(2028, 0, rmd.date.day)) / 86400000;
  assert(gap >= ORDERING_BUFFER_DAYS, `Ordering buffer must survive the nudge; gap was ${gap} days`);
});

// ── 13b. The sweep — the real guard ───────────────────────────────────────
test('No action lands on a non-business day, tax years 2026 to 2035', () => {
  // Catches any future emission point that forgets to nudge.
  const offenders = [];
  for (let y = 2026; y <= 2035; y++) {
    // Two shapes: RMD and conversion in the same month (the split path), and draws only
    // (the day-15 path). Run a state with its own schedule so state due dates are covered.
    [{ ira1Rmd: 30000, ira1RothConversion: 40000 },
     { ira1Rmd: 25000, ira1Voluntary: 15000 }].forEach(shape => {
      const plan = TaxPaymentPlanner.computePaymentPlan({
        ...BASE, ...shape,
        taxYear: y,
        state: 'VA',              // May 1 Q1 deadline, hits a Saturday in 2027 and 2032
        federalTax: 20000,
        stateTax: 6000,
        priorYearStateTax: 5000,
        todayDate: new Date(2026, 6, 29),
      });
      // Every plan in the matrix, not only the parent's. D synthesises a December tranche date
      // and Q emits a full estimate schedule, and neither of those emission points existed when
      // this sweep was written.
      const lists = plan.plans
        ? Object.entries(plan.plans).filter(([, v]) => v)
        : [['A', plan]];
      lists.forEach(([k, obj]) => {
        obj.actions.filter(a => a.date).forEach(a => {
          const d = new Date(a.date.year, a.date.month - 1, a.date.day);
          if (!isBusinessDay(d)) offenders.push(`${y} Plan ${k} ${a.type} ${d.toDateString()}`);
        });
      });
    });
  }
  assert(offenders.length === 0, `Non-business-day actions:\n       ${offenders.join('\n       ')}`);
});

// ── 14. IRC 7503 on due dates ─────────────────────────────────────────────
test('IRC 7503 — a due date on a weekend moves to the next business day', () => {
  // April 15 2028 is a Saturday.
  const d = dueDateFor({ month: 4, day: 15, w: 0.25, label: 'Q1', nextYear: false }, 2028);
  assert(d.shifted === true, 'Apr 15 2028 falls on a Saturday and should shift');
  assert(d.date.month === 4 && d.date.day === 17, `Expected Apr 17 2028, got ${d.date.month}/${d.date.day}`);
  // April 15 2026 is a Wednesday and must not move.
  const same = dueDateFor({ month: 4, day: 15, w: 0.25, label: 'Q1', nextYear: false }, 2026);
  assert(same.shifted === false, 'Apr 15 2026 is a Wednesday and should not shift');
});

test('IRC 7503 — the shifted date drives the past-due check, not the statutory one', () => {
  // April 15 2029 is a Sunday, so the real deadline is Monday April 16. Under the old
  // code the tool compared today against Sunday the 15th and flagged the installment past
  // due a day early.
  const onMonday = TaxPaymentPlanner.computePaymentPlan({
    ...BASE, taxYear: 2029, federalTax: 20000, todayDate: new Date(2029, 3, 16),
  });
  const q1 = onMonday.actions.find(a => a.type === T.Q_FED && a.date.month === 4);
  assert(q1, 'Expected a Q1 federal estimate');
  assert(q1.date.day === 16, `Expected the deadline shown as Apr 16 2029, got day ${q1.date.day}`);
  assert(!/PAST DUE/.test(q1.description), 'On Apr 16 2029 the deadline has not passed, so not past due');
  assert(q1.notes.some(n => n.includes('IRC 7503')), 'Expected the shift to be explained in a note');
  // One day later it is past due.
  const after = TaxPaymentPlanner.computePaymentPlan({
    ...BASE, taxYear: 2029, federalTax: 20000, todayDate: new Date(2029, 3, 17),
  });
  const q1b = after.actions.find(a => a.type === T.Q_FED && a.date.month === 4);
  assert(/PAST DUE/.test(q1b.description), 'Apr 17 2029 is after the shifted deadline');
});

// ── 15. Conversion withholding can never exceed the conversion ────────────
test('Gap fill caps withholding at the conversion amount (the 497% bug)', () => {
  // Reported case: 2027 CA, $67,000 total tax, $30,000 of draws, and a $5,000 conversion.
  // The gap fill sized withholding off the $37,000 shortfall without ever looking at the
  // conversion, producing $24,851 federal (497% of the conversion) and $12,149 state (243%).
  const plan = TaxPaymentPlanner.computePaymentPlan({
    taxYear: 2027, state: 'CA',
    federalTax: 45000, stateTax: 22000,
    priorYearFedTax: 33000, priorYearStateTax: 11500,
    ira1Rmd: 15000, ira1Voluntary: 10000, ira1RothConversion: 5000, ira2Rmd: 5000,
    ssIncome: 20000, pensionIncome: 15000, interest: 5000, qualifiedDivs: 8000, capitalGains: 10000,
    todayDate: new Date(2026, 6, 29),
  });
  const c = plan.actions.find(a => a.type === T.ROTH_CONV);
  const withheld = c.federalWithholding + c.stateWithholding;
  assert(withheld <= c.amount,
    `Withholding (${withheld}) must not exceed the conversion (${c.amount})`);
  assert(withheld === 5000, `Expected the full $5,000 cap to be used, got ${withheld}`);
  // The uncovered remainder has to become quarterly estimates, not vanish.
  assert(plan.summary.shortfall > 0, 'Expected the unabsorbed gap to become a shortfall');
  assert(plan.actions.some(a => a.type === T.Q_FED), 'Expected quarterly federal estimates');
  assert(c.notes.some(n => n.includes('too small to carry')), 'Expected the cap to be explained');
});

test('Property: withholding never exceeds the conversion, across a grid', () => {
  // The class of bug, not just the one instance. Sweeps conversion size against tax size so
  // the gap fill is forced to want far more than the conversion can carry.
  const offenders = [];
  [1000, 5000, 25000, 100000].forEach(conv => {
    [10000, 67000, 200000].forEach(fed => {
      ['CA', 'TX', 'IL'].forEach(state => {           // IL is IRA-exempt
        const plan = TaxPaymentPlanner.computePaymentPlan({
          taxYear: 2027, state,
          federalTax: fed, stateTax: state === 'TX' ? 0 : Math.round(fed * 0.4),
          priorYearFedTax: Math.round(fed * 0.8), priorYearStateTax: 0,
          ira1Rmd: 15000, ira1Voluntary: 10000, ira1RothConversion: conv,
          ira2Rmd: 5000, ira2RothConversion: Math.round(conv / 2),
          todayDate: new Date(2026, 6, 29),
        });
        plan.actions.filter(a => a.type === T.ROTH_CONV).forEach(a => {
          const w = a.federalWithholding + a.stateWithholding;
          if (w > a.amount) offenders.push(`conv=${conv} fed=${fed} ${state}: withheld ${w} on ${a.amount}`);
          // An IRA-exempt state cannot withhold state tax from an IRA distribution at all.
          if (state === 'IL' && a.stateWithholding > 0) {
            offenders.push(`conv=${conv} fed=${fed} IL: state withholding ${a.stateWithholding} in an IRA-exempt state`);
          }
        });
        // And federal withholding must never exceed the federal liability.
        const fedW = plan.actions.reduce((s, a) => s + (a.type === T.Q_FED ? 0 : a.federalWithholding), 0);
        if (fedW > fed + 2) offenders.push(`conv=${conv} fed=${fed} ${state}: federal withheld ${fedW} > liability ${fed}`);
      });
    });
  });
  assert(offenders.length === 0, `Over-withholding:\n       ${offenders.join('\n       ')}`);
});

// ── 16. Replacing sooner is worth something, and the tool says so ─────────
test('Earlier replacement always beats the 45-day target, never the reverse', () => {
  // gain = withheld x spread x yearsFromRestoreToYearEnd, so pulling the restore date
  // earlier is strictly positive whenever the portfolio outgrows the cash rate. The 45-day
  // target is a deadline buffer; presenting it as a goal silently leaves this on the table.
  const B = { state: 'TX', stateTax: 0, priorYearFedTax: 19000, priorYearStateTax: 0,
              federalTax: 15000, ira1RothConversion: 80000, taxYear: 2026 };
  [['February', new Date(2026, 0, 1)], ['June', new Date(2026, 4, 21)]].forEach(([label, todayDate]) => {
    const r = TaxPaymentPlanner.computePaymentPlan({ ...B, todayDate }).summary.ira1.replacement;
    assert(r.withheld > 0, `${label}: expected withholding`);
    assert(r.gainIfEarliest > r.gain, `${label}: earliest (${r.gainIfEarliest}) should beat 45-day (${r.gain})`);
    assert(r.earlyBonus > 0, `${label}: expected a positive early bonus, got ${r.earlyBonus}`);
    // The bonus is exactly the spread over the days saved, nothing more.
    const daysSaved = (new Date(r.restoreDate.year, r.restoreDate.month - 1, r.restoreDate.day)
                     - new Date(r.earliestDate.year, r.earliestDate.month - 1, r.earliestDate.day)) / 86400000;
    assertNear(r.earlyBonus, r.withheld * r.spread * daysSaved / 365,
      `${label}: early bonus must be the spread over the days saved`, 0.5);
  });
});

test('December is where the 45-day target costs the most, proportionally', () => {
  // A December conversion restores in late January, so at the 45-day target the first-year
  // gain is exactly $0. Replacing before December 31 recovers all of it. This is the case
  // where treating 45 days as a goal rather than a ceiling does real damage.
  const r = TaxPaymentPlanner.computePaymentPlan({
    state: 'TX', stateTax: 0, priorYearFedTax: 19000, priorYearStateTax: 0,
    federalTax: 15000, ira1RothConversion: 80000, taxYear: 2026,
    todayDate: new Date(2026, 10, 15),
  }).summary.ira1.replacement;
  assert(r.gain === 0, `Expected $0 at the 45-day target, got ${r.gain}`);
  assert(r.restoreDate.year === 2027, 'The 45-day restore should land next year');
  assert(r.earliestDate.year === 2026, 'The earliest restore should still be in the tax year');
  assert(r.gainIfEarliest > 0, `Expected a positive gain from replacing before year end, got ${r.gainIfEarliest}`);
  assert(r.earlyBonus === r.gainIfEarliest, 'With a $0 baseline the whole gain is the early bonus');
});

// ── 17. Missing the 60-day deadline is spelled out, and spelled out correctly ──
test('Restore action states the consequences of blowing the deadline', () => {
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE, ira1RothConversion: 80000, federalTax: 15000,
  });
  const restore = plan.actions.find(a => a.type === T.CASH_RESTORE);
  assert(restore, 'Expected a restore-cash action');
  const all = restore.notes.join(' ');
  assert(/IF YOU MISS THE 60 DAYS/.test(all), 'Expected an explicit missed-deadline note');
  assert(all.includes('IRC 4973'), 'Expected the 6% excess-contribution excise cited');
  assert(all.includes('Rev. Proc. 2020-46'), 'Expected the self-certification route cited');
  assert(all.includes('IRC 408(d)(3)'), 'Expected the 60-day statute cited');
  // The precision that generic advice gets wrong: for a CONVERSION the gross is taxable
  // either way, so missing the deadline costs Roth space and possibly the 10% penalty,
  // NOT extra income tax. The note must not claim the withheld amount "becomes taxable".
  assert(all.includes('Your income tax does not change'),
    'The note must say income tax is unchanged, since the gross was taxable either way');
  assert(!/becomes taxable/i.test(all), 'Must not imply the withheld amount newly becomes taxable');
});

// ── 18. EVERY displayed plan pays the whole liability ─────────────────────
// The one that matters. All three plans are complete action lists a user is meant to
// follow, so each must add up to the full tax due. Two of them used to skip building
// their quarterly estimates entirely, so 25k of draws and a 10k conversion against a
// 72k liability produced 35k of payments and no estimates in the displayed Plan A and
// Plan C. Nothing caught it, because the old invariant read the gap off totalCovered
// and therefore depended on those estimates being absent.
test('Every plan pays 100% of the tax due, to within $1', () => {
  const paidBy = acts => acts.reduce((s, a) => s + a.federalWithholding + a.stateWithholding, 0);
  const offenders = [];

  // The reported case, both tax years, plus shapes that stress each funding path:
  // withholding covers everything, withholding covers nothing, and no conversion at all.
  const scenarios = [];
  [2026, 2027].forEach(taxYear => {
    ['CA', 'TX', 'IL', 'VA'].forEach(state => {          // incl. an IRA-exempt and an odd schedule
      [
        { label: 'reported case',    ira1Rmd: 5000,  ira1Voluntary: 15000, ira1RothConversion: 10000, ira2Rmd: 5000 },
        { label: 'draws cover all',  ira1Rmd: 60000, ira1Voluntary: 30000, ira1RothConversion: 10000 },
        { label: 'nothing to draw',  ira1RothConversion: 5000 },
        { label: 'no conversion',    ira1Rmd: 5000,  ira1Voluntary: 5000 },
        { label: 'dual IRA conv',    ira1Rmd: 5000,  ira1RothConversion: 8000, ira2Rmd: 4000, ira2RothConversion: 6000 },
      ].forEach(shape => scenarios.push({ taxYear, state, ...shape }));
    });
  });

  scenarios.forEach(sc => {
    const { label, ...inputs } = sc;
    const plan = TaxPaymentPlanner.computePaymentPlan({
      federalTax: 45000, stateTax: sc.state === 'TX' ? 0 : 27000,
      priorYearFedTax: 33000, priorYearStateTax: sc.state === 'TX' ? 0 : 11500,
      ssIncome: 20000, pensionIncome: 15000, interest: 5000,
      qualifiedDivs: 8000, capitalGains: 10000,
      todayDate: new Date(2026, 6, 29),
      ...inputs,
    });
    const due = plan.summary.totalTaxDue;
    // Every plan the matrix produced. Iterating the map extends this invariant to D and Q for
    // free, which is the point: a plan that does not pay the whole liability is not a plan.
    const variants = plan.plans
      ? Object.entries(plan.plans).filter(([, v]) => v)
      : [['A', plan]];
    variants.forEach(([name, obj]) => {
      const paid = paidBy(obj.actions);
      if (Math.abs(paid - due) > 1) {
        offenders.push(`${sc.taxYear} ${sc.state} "${label}" Plan ${name}: paid ${paid} of ${due} (short ${due - paid})`);
      }
    });
  });

  assert(offenders.length === 0,
    `Plans that do not pay the full liability:\n       ${offenders.join('\n       ')}`);
});

// ── 19. A plan must not claim taxes are covered while scheduling estimates ─
// The reported confusion. Plan C converts in December, so the gap fill declines to withhold from
// the conversion (no Roth growth left AND safe harbor already met), and the residual goes to
// quarterly estimates. The conversion step nevertheless asserted "Taxes covered by December draws"
// and "Taxes funded by IRA draws", flatly contradicting the estimate schedule printed below it.
const REPORTED = {
  taxYear: 2026, state: 'CA', federalTax: 35000, stateTax: 22000,
  priorYearFedTax: 33000, priorYearStateTax: 11500,
  ira1Rmd: 15000, ira1Voluntary: 30000, ira1RothConversion: 10000, ira2Rmd: 5000,
  ssIncome: 20000, pensionIncome: 15000, interest: 5000, qualifiedDivs: 8000, capitalGains: 10000,
  todayDate: new Date(2026, 6, 29),
};

test('A no-withholding conversion never claims the draws cover taxes they do not', () => {
  const plan = TaxPaymentPlanner.computePaymentPlan(REPORTED);
  const variants = Object.entries(plan.plans).filter(([, v]) => v);
  const offenders = [];

  variants.forEach(([name, obj]) => {
    const shortfall = obj.summary.shortfall;
    obj.actions
      .filter(a => a.type === T.ROTH_CONV && a.federalWithholding === 0 && a.stateWithholding === 0)
      .forEach(a => {
        const all = a.description + ' ' + a.notes.join(' ');
        if (shortfall > 0) {
          // Must not assert full coverage...
          if (/covers? all taxes|[Tt]axes covered by|[Tt]axes funded (?:by|entirely)/.test(all)) {
            offenders.push(`Plan ${name}: claims full coverage while ${shortfall} goes to estimates`);
          }
          // ...and must own up to the part that does not come from withholding.
          if (!all.includes('quarterly estimates')) {
            offenders.push(`Plan ${name}: shortfall of ${shortfall} never mentioned on the conversion step`);
          }
        }
      });
  });

  assert(offenders.length === 0, offenders.join('\n       '));

  // Guard the specific case, so the test fails if Plan C stops exercising this path at all.
  assert(plan.plans.C.summary.shortfall === 7000,
    `Expected Plan C to route 7000 to estimates, got ${plan.plans.C.summary.shortfall}`);
});

// ── 20. Penalty-free is a claim that has to be checked ────────────────────
// The missed-payment alert used to branch on `usesIraWithholding` alone — "am I withholding at
// all" — and then told the user no action was required. In the reported scenario the federal share
// of the withholding is 30,702 against a 31,500 required annual payment, so it is 798 short and a
// penalty does accrue, while California is comfortably covered. The two schedules disagree, and the
// alert has to say so rather than reassure.
test('Missed-payment alert only claims penalty-free when withholding actually covers', () => {
  const plan = TaxPaymentPlanner.computePaymentPlan(REPORTED);

  const alertOf = obj => obj.actions.find(a => a.type === T.ALERT
    && /installment dates have passed|installment/i.test(a.description));

  // Plan C: federal short, state covered.
  const c = alertOf(plan.plans.C);
  assert(c, 'Expected a missed-installment alert on Plan C');
  const cAll = c.description + ' ' + c.notes.join(' ');
  assert(!/No action is required/.test(c.description),
    'Plan C withholding is 798 short on the federal schedule — must not say no action is required');
  assert(/does not fully cover/.test(c.description), 'Alert should name the uncovered schedule');
  assert(/federal/.test(c.description), 'Alert should identify FEDERAL as the short schedule');
  assert(/California/.test(cAll), 'Alert should credit California as covered rather than lumping them together');

  // Plans A and B withhold the full liability, so both schedules clear and the reassurance is true.
  [['A', plan.plans.A], ['B', plan.plans.B]].forEach(([name, obj]) => {
    const a = alertOf(obj);
    assert(a, `Expected a missed-installment alert on Plan ${name}`);
    assert(/No action is required/.test(a.description),
      `Plan ${name} covers both schedules, so the alert should say so`);
    assert(a.notes.some(n => /Checked, not assumed/.test(n)),
      `Plan ${name} should show the figures the claim rests on`);
  });

  // Per-installment wording must agree with the alert, which is where the contradiction showed.
  const qFed   = plan.plans.C.actions.filter(a => a.type === T.Q_FED   && a.date && new Date(a.date.year, a.date.month - 1, a.date.day) < REPORTED.todayDate);
  const qState = plan.plans.C.actions.filter(a => a.type === T.Q_STATE && a.date && new Date(a.date.year, a.date.month - 1, a.date.day) < REPORTED.todayDate);
  assert(qFed.length > 0 && qState.length > 0, 'Expected elapsed installments on both schedules');
  qFed.forEach(a => assert(/PAST DUE/.test(a.description),
    'Federal is genuinely late here, so the urgent wording is correct'));
  qState.forEach(a => {
    assert(!/PAST DUE/.test(a.description),
      'California withholding covers its schedule, so its elapsed installments are not PAST DUE');
    assert(a.notes.some(n => /does not create an underpayment penalty/.test(n)),
      'Covered state installments should say plainly that no penalty arises');
  });
});

// ── 21a. Advisory notes must actually render ──────────────────────────────
// T.NOTE was the only action type whose `notes` array was dropped by both renderers: buildHtml's
// isNote branch returned before the bullet loop, and buildText pushed only the description. The
// QCD alternative had therefore never reached a reader in either output.
test('T.NOTE actions render their notes, not just the description', () => {
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE, federalTax: 40000, stateTax: 12000,
    ira1Rmd: 20000, ira1RothConversion: 30000,
    ira2Rmd: 10000, ira2RothConversion: 15000,
  });

  const noteActions = plan.actions.filter(a => a.type === T.NOTE && a.notes.length > 0);
  assert(noteActions.length > 0, 'Expected at least one advisory note carrying sub-notes');

  const missingText = [], missingHtml = [];
  noteActions.forEach(a => a.notes.forEach(n => {
    // Compare on a prefix: the renderers wrap the text, they do not alter it.
    const probe = n.slice(0, 50);
    if (!plan.text.includes(probe)) missingText.push(probe);
    if (!plan.html.includes(probe)) missingHtml.push(probe);
  }));
  assert(missingText.length === 0,  `Notes absent from plan.text:\n       ${missingText.join('\n       ')}`);
  assert(missingHtml.length === 0,  `Notes absent from plan.html:\n       ${missingHtml.join('\n       ')}`);

  // The specific guidance that was invisible, named so this cannot silently regress.
  assert(/QCD alternative/.test(plan.text) && /QCD alternative/.test(plan.html),
    'The QCD alternative must appear in both outputs');
  assert(/Only the balance beyond the RMD can be converted/.test(plan.text),
    'The RMD-conversion eligibility note must appear in the text output');
});

// ── 21b. Brokerage position in dollars drives the unrealized-gain fraction ─
// appreciationPct is a FRACTION OF VALUE, not a growth rate, and the single "Brokerage
// Appreciation (%)" input it used to sit behind read as a rate — a user reasonably took 40 to mean
// 40%/yr and asked for it to be lowered to 5, which would have understated the cost of selling
// brokerage by roughly 8x. It is now derived from the two dollar amounts the caller actually has.
test('brokerageValue/brokerageBasis derive appreciationPct, and clamp sanely', () => {
  const run = extra => TaxPaymentPlanner.computePaymentPlan({
    ...BASE, federalTax: 35000, stateTax: 22000,
    ira1Rmd: 15000, ira1Voluntary: 30000, ira2Rmd: 5000, ...extra,
  });

  assertNear(run({ brokerageValue: 100000, brokerageBasis: 60000 }).params.appreciationPct,
    0.40, 'value 100k / basis 60k is a 40% gain share', 1e-9);
  assertNear(run({ brokerageValue: 99378, brokerageBasis: 39318 }).params.appreciationPct,
    0.6044, 'the real optimizer row works out to 60.4%', 0.0005);
  assertNear(run({ brokerageValue: 100000, brokerageBasis: 0 }).params.appreciationPct,
    1.00, 'all gain when there is no basis', 1e-9);

  // A loss position has no representation here: extraCg() would go negative and start crediting a
  // refund against the cost of selling, so it clamps to zero rather than inverting the sign.
  assertNear(run({ brokerageValue: 100000, brokerageBasis: 150000 }).params.appreciationPct,
    0, 'basis above value clamps to 0, not negative', 1e-9);
  assert(run({ brokerageValue: 100000, brokerageBasis: 150000 }).comparison.brokerage.cg === 0,
    'a clamped loss position must not produce a negative capital-gains cost');

  // Blank/absent dollars keep the documented default, and zero value cannot give a ratio.
  assertNear(run({}).params.appreciationPct, 0.40, 'no dollars supplied keeps the 0.40 default', 1e-9);
  assertNear(run({ brokerageValue: 0, brokerageBasis: 0 }).params.appreciationPct,
    0.40, 'a zero-value position cannot give a ratio, so the default stands', 1e-9);
  assertNear(run({ appreciationPct: 0.604 }).params.appreciationPct,
    0.604, 'the raw fraction is still honoured for legacy ?ap= links', 1e-9);

  // The direction that matters: a higher gain share must cost more to sell, monotonically.
  const cgOf = ap => run({ brokerageValue: 100000, brokerageBasis: 100000 * (1 - ap) })
    .comparison.brokerage.cg;
  const costs = [0, 0.25, 0.5, 0.75, 1].map(cgOf);
  for (let i = 1; i < costs.length; i++) {
    assert(costs[i] > costs[i - 1],
      `capital-gains cost must rise with the gain share: ${costs.join(' -> ')}`);
  }
});

// ── 21. The cumulative test, on a weighted schedule ───────────────────────
// Not reachable through a whole-plan assertion: California is 30/40/30, so ratable withholding
// equal to the FULL annual requirement still misses the second due date. cumReq after two dates is
// 70% of the requirement while a uniform credit has only delivered two thirds of it.
test('withholdingCoversSchedule is cumulative, not a total-versus-total test', () => {
  const covers = TaxPaymentPlanner._withholdingCoversSchedule;
  const even   = [{ w: 0.25 }, { w: 0.25 }, { w: 0.25 }, { w: 0.25 }];
  const ca     = [{ w: 0.30 }, { w: 0.40 }, { w: 0.30 }];

  assert(covers(1000, 1000, even) === true,  'Even schedule: exactly the requirement clears every date');
  // The check carries a deliberate $1-per-date tolerance to match splitExact's rounding, so a
  // shortfall has to exceed that before it counts. 990 is 2.50 short at the first date.
  assert(covers(999,  1000, even) === true,  'Even schedule: inside the $1 rounding tolerance');
  assert(covers(990,  1000, even) === false, 'Even schedule: a real shortfall fails');
  assert(covers(1000, 1000, ca)   === false,
    'Weighted schedule: meeting the annual total is NOT enough — 2/3 credited vs 70% required at date 2');
  assert(covers(1050, 1000, ca)   === true,
    '1050 across three dates delivers 700 by date 2, which is the 70% required');
  assert(covers(0, 0, even) === true,       'No requirement, nothing to miss');
  assert(covers(0, 5000, []) === true,      'No schedule means nothing to be late for');
});


// ══ P56: the five-plan matrix ═════════════════════════════════════════════
// The scenario the phase was written against: California, tax year 2028, no conversions, run in
// August OF the tax year so "early" is September and the anchors below are stable.
const P56 = {
  taxYear: 2028, federalTax: 18286, stateTax: 6545,
  priorYearFedTax: 18188, priorYearStateTax: 6566,
  ssIncome: 25363, pensionIncome: 15000, interest: 2783,
  qualifiedDivs: 527, capitalGains: 3788,
  ira1Rmd: 0, ira1Voluntary: 91288, ira2Rmd: 15657, ira2Voluntary: 32237,
  marginalOrdRate: 0.30, brokerageValue: 99398, brokerageBasis: 41696, cgRateBlended: 0.23,
  state: 'CA', portfolioRate: 0.06, hysaGross: 0.03,
  todayDate: new Date(2028, 7, 18),
};
const p56 = extra => TaxPaymentPlanner.computePaymentPlan({ ...P56, ...extra });
const drawsOf = obj => obj.actions.filter(a => a.type === T.RMD || a.type === T.IRA_VOL);
const withheldOn = a => (a.federalWithholding || 0) + (a.stateWithholding || 0);

// ── P56-1. Plan D: the tranche arithmetic ────────────────────────────────
// D takes the SPENDING part of each draw early and holds the TAX part back to December, withheld
// up to 100% (Form W-4R). The trap it must never fall into is funding the holdback with an extra
// distribution: the tax inputs are pre-calculated, so a supplemental draw would create income
// they do not include and the plan would under-pay by construction.
test('Plan D — the December tranche is a holdback, not an extra draw', () => {
  const plan  = p56();
  const d     = plan.plans.D;
  assert(d, 'Plan D should exist: there are deferrable draws and tax to hold back');

  const draws = drawsOf(d);
  const inputTotal = P56.ira1Rmd + P56.ira1Voluntary + P56.ira2Rmd + P56.ira2Voluntary;
  assertNear(draws.reduce((s, a) => s + a.amount, 0), inputTotal,
    'D must draw exactly the amounts entered, no more', 1);

  const tax   = draws.filter(a => a.tranche === 'tax');
  const spend = draws.filter(a => a.tranche === 'spend');
  assert(tax.length > 0, 'D must emit a December tax tranche');
  assert(tax.every(a => a.date.month === 12), 'the tranche is a DECEMBER holdback');
  assert(tax.every(a => withheldOn(a) <= a.amount + 0.5),
    'withholding cannot exceed 100% of the tranche it comes out of');
  assertNear(tax.reduce((s, a) => s + withheldOn(a), 0), P56.federalTax + P56.stateTax,
    'the tranche withholds the whole liability here', 2);
  assert(spend.every(a => withheldOn(a) === 0), 'spending parts carry no withholding');

  // The user gets the same spending cash as Plan A: only its route to the IRS differs.
  const netOf = obj => drawsOf(obj).reduce((s, a) => s + a.amount - withheldOn(a), 0);
  assertNear(netOf(d), netOf(plan.plans.A), 'D leaves the same net cash as A', 2);

  // Only a group that actually gave up a share may claim one was held back.
  drawsOf(d).forEach(a => {
    const claims = /tax share/.test(a.description + ' ' + a.notes.join(' '));
    if (claims) assert(a.tranche === 'spend', 'only a split draw may talk about a held-back share');
  });
  assert(/Form W-4R/.test(plan.text), 'the 0% to 100% election has to be cited somewhere');
});

// ── P56-2. Plan D: ordering, and when it must not be offered ─────────────
// An RMD has to clear before a conversion in the same IRA, so it cannot be deferred to December
// to host the tranche. When nothing else is eligible, D is a duplicate of A and is dropped with
// a stated reason rather than silently.
test('Plan D — a locked RMD never hosts the tranche, and a degenerate D is explained', () => {
  const converting = p56({ ira2RothConversion: 40000 });
  const d = converting.plans.D;
  assert(d, 'voluntary draws are still eligible here, so D survives');
  const convMonth = d.actions.find(a => a.type === T.ROTH_CONV && a.iraNum === 2).date.month;
  drawsOf(d).filter(a => a.iraNum === 2 && a.type === T.RMD).forEach(a => {
    assert(a.date.month <= convMonth,
      `IRA 2's RMD must precede its conversion; RMD ${a.date.month} vs conv ${convMonth}`);
    assert(a.tranche !== 'tax', "a converting IRA's RMD must not be deferred into the tranche");
  });

  // Single IRA, RMD only, and it converts: nothing is eligible, so D collapses onto A.
  const degenerate = p56({
    ira1Rmd: 0, ira1Voluntary: 0, ira2Voluntary: 0, ira2Rmd: 40000, ira2RothConversion: 20000,
  });
  assert(degenerate.plans.D === null, 'a degenerate D must not be offered');
  assert(/Plan D \(split\) is not shown/.test(degenerate.text),
    'and the reason must be printed, not left to the reader');
  assert(/no draw is available to host/.test(degenerate.comparison.dNote),
    'the reason should name the actual cause');

  // Draws already taken are locked to the month they happened. With nothing deferrable and no
  // conversion there is no timing choice at all, so the matrix itself is not built.
  const taken = p56({ ira1VolTaken: true, ira2RmdTaken: true, ira2VolTaken: true });
  assert(taken.plans === null, 'nothing deferrable and no conversion means no matrix');
  const takenWithConv = p56({
    ira1VolTaken: true, ira2RmdTaken: true, ira2VolTaken: true, ira1RothConversion: 30000,
  });
  assert(takenWithConv.plans !== null, 'a conversion still gives the timing lever something to move');
  assert(takenWithConv.plans.D === null, 'but no draw is free to host the tranche, so D is dropped');
});

// ── P56-3. Plan D in an IRA-exempt state ─────────────────────────────────
// Illinois does not tax IRA distributions, so no state tax can be withheld from one. The
// December tranche covers federal only and the state liability rides quarterly estimates.
test('Plan D — in an IRA-exempt state the tranche is federal only', () => {
  const plan = p56({ state: 'IL', stateTax: 4200, priorYearStateTax: 4000 });
  const d = plan.plans.D;
  assert(d, 'D should still be built');
  const tax = drawsOf(d).filter(a => a.tranche === 'tax');
  assert(tax.length > 0 && tax.every(a => (a.stateWithholding || 0) === 0),
    'no state withholding is possible from an IRA distribution in IL');
  assertNear(tax.reduce((s, a) => s + a.federalWithholding, 0), P56.federalTax,
    'the tranche carries the federal liability', 2);
  const stEst = d.actions.filter(a => a.type === T.Q_STATE).reduce((s, a) => s + a.amount, 0);
  assertNear(stEst, 4200, 'the whole Illinois liability rides estimates', 2);
});

// ── P56-4. Plan Q: shape ─────────────────────────────────────────────────
// Q is C's twin on everything except the payment mechanism. Its draws are real and the user has
// to execute them; they simply carry no withholding. The draw-action block used to be gated on
// "does this plan withhold", which dropped every one of them.
test('Plan Q — December draws with no withholding, and a full estimate schedule', () => {
  const plan = p56();
  const q = plan.plans.Q;
  assert(q, 'Q should exist whenever there is tax to pay');
  assert(q.strategy === 'all_quarterly', `Q must be all_quarterly, got ${q.strategy}`);

  const draws = drawsOf(q);
  assert(draws.length > 0, 'Q must still emit its draw actions');
  assertNear(draws.reduce((s, a) => s + a.amount, 0),
    P56.ira1Voluntary + P56.ira2Rmd + P56.ira2Voluntary, 'Q draws the full amounts', 1);
  assert(draws.every(a => a.date.month === 12), 'Q draws in December');
  assert(draws.every(a => withheldOn(a) === 0), 'Q withholds nothing, anywhere');

  const fed = q.actions.filter(a => a.type === T.Q_FED);
  const st  = q.actions.filter(a => a.type === T.Q_STATE);
  assert(fed.length === 4, `four federal installments, got ${fed.length}`);
  assert(st.length === 3, `California pays in three, got ${st.length}`);
  assertNear(fed.reduce((s, a) => s + a.amount, 0), P56.federalTax, 'federal estimates total', 2);
  assertNear(st.reduce((s, a) => s + a.amount, 0), P56.stateTax, 'California estimates total', 2);

  // A user-level forceStrategy must not be able to turn the quarterly plan into a withholding one.
  const forced = p56({ forceStrategy: 'ye_ira' });
  assert(forced.plans.Q.strategy === 'all_quarterly',
    'forceStrategy propagates to children and must not capture Q');
});

// ── P56-5. The one cost table ────────────────────────────────────────────
// Anchors from the phase spec, all four computed by hand on the April 15 frame:
//   A 24,831 x 6% x 7/12 = 869 withholding, plus 15,657 x 6% x 30% x 3/12 = 70 RMD deferral.
//   C the same withholding in December: 24,831 x 6% x 4/12 = 497.
//   D C's December tranche (497) plus A's early RMD deferral (70).
//   Q 18,286 x 3.9% x 8/12 = 475 federal carry, 6,545 x 3.9% x 8.5/12 = 181 California.
test('Plan comparison — the anchors, and every plan reconciles to the liability', () => {
  const plan = p56();
  const cc = plan.comparison;
  const tax = P56.federalTax + P56.stateTax;

  assertNear(cc.perPlan.A.total, 940, 'Plan A first-year cost', 5);
  assertNear(cc.perPlan.C.total, 497, 'Plan C first-year cost', 5);
  assertNear(cc.perPlan.D.total, 567, 'Plan D first-year cost', 5);
  assertNear(cc.perPlan.Q.total, 656, 'Plan Q first-year cost', 5);
  assert(cc.best === 'C', `C is the cheapest here; got ${cc.best}`);
  assert(!cc.allTie, 'these plans are genuinely different in August');

  // The identity the old pair of tables could violate: what a plan withholds plus what it
  // schedules as estimates is the liability, and the cost table is built from those same actions.
  cc.letters.forEach(k => {
    const c = cc.perPlan[k];
    assertNear(c.paid, tax, `Plan ${k} pays ${c.paid} of ${tax}`, 2);
  });

  // The verdict the user reported as contradictory: December withholding beats quarterly cash
  // whenever the HYSA net rate is below half the portfolio rate, and the table must agree.
  assert(cc.yeIraWins, 'hysaNet 2.1% is below the 3.0% break-even, so withholding should win');
  assert(cc.perPlan.C.total < cc.perPlan.Q.total,
    'and the priced table has to say the same thing, not the opposite');
});

// ── P56-6. A column never vanishes without a reason ──────────────────────
test('Plan comparison — an omitted plan is explained in both outputs', () => {
  const drawOnly = p56();
  assert(drawOnly.comparison.bNote, 'B is absent here and needs a note');
  assert(/identical to Plan C/.test(drawOnly.comparison.bNote), 'the note should say WHY');
  assert(/Plan B \(hybrid\) is not shown/.test(drawOnly.text), 'text carries it');
  assert(/Plan B \(hybrid\) is not shown/.test(drawOnly.html), 'html carries it');

  // With a conversion, B exists and the note disappears.
  const converting = p56({ ira1RothConversion: 40000 });
  assert(converting.plans.B, 'a conversion gives B something to do');
  assert(converting.comparison.bNote === null, 'and the absence note must go away');
  assert(converting.comparison.letters.join('') === 'ABCDQ',
    `all five columns; got ${converting.comparison.letters.join('')}`);

  // A conversion large enough that its Roth growth outweighs the costs drives the totals
  // NEGATIVE, and a negative total is a net gain. fmt$ takes the absolute value of everything it
  // is given, which is right for an amount and silently wrong for a signed total: the winning
  // plan printed as "$2,503 ★", which reads as the most expensive one winning.
  const cc = converting.comparison;
  assert(cc.anyNegative, 'a $40,000 January conversion should outweigh the timing costs');
  assert(cc.perPlan[cc.best].total < 0, 'and the best plan is the most negative');
  const totalLine = converting.text.split('\n').find(l => /TOTAL first-year cost/.test(l));
  assert(/-\$/.test(totalLine), `a negative total must print its sign: ${totalLine}`);
  assert(/−\$/.test(converting.html), 'and so must the HTML table');
  assert(/negative total is a net gain/i.test(converting.text) &&
         /negative total is a net gain/i.test(converting.html),
    'both outputs must say what a negative total means');
});

// ── P56-7. Brokerage is a funding footnote, not a plan ───────────────────
// It used to be a full row in the cost table, which invited reading it as a fourth plan with
// steps. It funds Plan Q's estimates by selling shares, so it is priced once, below the table.
test('Plan comparison — brokerage funding is one footnote, with no plan section', () => {
  const plan = p56();
  const b = plan.comparison.brokerage;
  assert(b && b.total > 0, 'the footnote should be priced');
  assertNear(b.cg, (24831 / (1 - 0.580514698 * 0.23)) * 0.580514698 * 0.23,
    'capital gains on the grossed-up sale', 2);
  assert(b.oc > plan.comparison.perPlan.Q.estimateOC,
    'selling shares gives up the full portfolio rate, not the rate less HYSA');

  assert(!plan.comparison.letters.includes('BROK'), 'it is not a plan letter');
  const footnotes = plan.html.match(/Funding source footnote/g) || [];
  assert(footnotes.length === 1, `exactly one footnote, got ${footnotes.length}`);
  assert(!/plan-section-brok/.test(plan.html), 'and it gets no plan section of its own');
});

// ── P56-8. Late in the year every plan is the same plan ──────────────────
// A November run makes "early" December, so A, C and D collapse onto the same dates. Calling one
// of them a winner on a rounding difference would be noise dressed as advice.
test('Plan comparison — a December run reports a tie instead of a phantom winner', () => {
  const plan = p56({ todayDate: new Date(2028, 10, 20) });
  const cc = plan.comparison;
  assert(cc.allTie, 'the timing plans land on the same dates this late');
  ['A', 'C', 'D'].filter(k => cc.letters.includes(k)).forEach(k => {
    assert(cc.bestSet.includes(k), `Plan ${k} ties for cheapest, so it must be starred too`);
  });
  // Q is not part of that collapse: it differs by payment mechanism, not by timing.
  assert(!cc.bestSet.includes('Q'), 'Q still costs more than withholding here');
  assert(cc.perPlan.Q.total > cc.perPlan[cc.best].total + 1, 'and by a real amount');
  assert(/timing plans are identical this late in the year/.test(plan.text),
    'the text should say why every column reads the same');
  assert(/Plans A, C tie/.test(plan.text),
    'the winner line should name the tie rather than pick one');
  // D is correctly GONE this late: "early" is already December, so a split plan would be Plan C
  // under another name. It says so rather than offering a duplicate.
  assert(!cc.letters.includes('D'), 'D cannot be distinct once early is December');
  assert(/identical to Plan C/.test(cc.dNote), `D's absence must name the real reason: ${cc.dNote}`);
});


// ══ P57: one plan per statement, and no free lunches ══════════════════════
// Every defect below was found by an adversarially-verified audit after P56 shipped, and every one
// of them is the same shape: a sentence that was true when the tool computed ONE plan.

// ── P57-1. The header stops describing Plan A ────────────────────────────
// The top-level summary IS Plan A's (r.summary === r.plans.A.summary). The header printed its
// Strategy, IRA coverage, per-IRA draw and conversion months and effective withholding month
// directly above a Winner badge naming a different plan.
test('Header carries no value that belongs to one plan', () => {
  const plan = p56({ ira1RothConversion: 10000 });
  assert(plan.summary === plan.plans.A.summary,
    'the premise: the top-level summary is literally Plan A\'s');

  const header = plan.text.split('PLAN COMPARISON')[0];
  assert(!/^Strategy/m.test(header), 'the Strategy label is Plan A\'s and must not head the page');
  assert(!/Effective withhold/.test(header), 'so is the effective withholding month');
  assert(!/IRA 1    : draw/.test(header), 'and so are the per-IRA draw months');
  // What stays is true of the page, plus the winner and its own one-line description.
  assert(/State    : California/.test(header), 'state stays');
  assert(/Total tax: \$24,831/.test(header), 'the liability stays');
  assert(/Winner   : Plan/.test(header), 'the winner stays');

  const htmlHead = plan.html.split('Plan comparison')[0];
  assert(!/Strategy:/.test(htmlHead), 'same in HTML: no Strategy badge');
  assert(!/IRA Coverage:/.test(htmlHead), 'no page-level IRA Coverage badge');
  assert(!/Effective withhold:/.test(htmlHead), 'no page-level withholding month');
  assert(!/year-end IRA for simplicity/.test(plan.html),
    'and the banner that asserted Plan A\'s mechanism is gone');
});

// ── P57-2. A gain is not a cost ──────────────────────────────────────────
// fmt$ is Math.abs by design. The winner line and the badge quoted the total through it, so a plan
// whose Roth growth outweighs its costs printed "first-year cost $15,394" twelve lines above the
// table's own "-$15,394 star".
test('A negative winner total prints as a gain in the header, not a cost', () => {
  const plan = p56({ ira1RothConversion: 200000, federalTax: 20000, stateTax: 9000,
                     priorYearFedTax: 19000, priorYearStateTax: 8000, todayDate: new Date(2028, 0, 15) });
  const cc = plan.comparison;
  assert(cc.perPlan[cc.best].total < -0.5, 'this scenario should produce a net gain');
  const line = plan.text.split('\n').find(l => /^Winner/.test(l));
  assert(/net GAIN/.test(line) && /-\$/.test(line), `winner line must not call a gain a cost: ${line}`);
  assert(/First-year net gain/.test(plan.html), 'the badge has to say the same thing');
  assert(!/First-year cost: \$/.test(plan.html.split('Plan comparison')[0]),
    'and must not also print it as a cost');
});

// ── P57-3. "No penalty applies" is a claim about the recommended plan ────
// The reassurance was gated on Plan A's strategy label, so a plan that withholds heavily and still
// misses an installment printed it anyway, above its own PAST DUE steps.
test('The past-due reassurance is checked against the winning plan', () => {
  const plan = TaxPaymentPlanner.computePaymentPlan(REPORTED);
  const rec  = plan.plans[plan.comparison.best].summary;
  const head = plan.text.split('PLAN COMPARISON')[0];
  if (!(rec.fedTimelyByWithholding && rec.stateTimelyByWithholding)) {
    assert(/does not fully cover/.test(head),
      'the winner misses a schedule here, so the header must not reassure');
    assert(!/no penalty applies/.test(head), 'and must not claim penalty-free');
  } else {
    assert(/no penalty applies/.test(head), 'when it does cover, say so');
  }
  // A plan that withholds NOTHING must not be praised or blamed for its withholding. The original
  // code skipped the sentence for an all-quarterly plan; the rewrite of this gate initially blamed
  // "withholding under Plan A" on a plan with none, which is the same class of false statement in
  // the other direction.
  const quarterlyOnly = TaxPaymentPlanner.computePaymentPlan({
    ...BASE, state: 'CA', federalTax: 35000, stateTax: 22000,
    priorYearFedTax: 33000, priorYearStateTax: 11500,
    portfolioRate: 0.02, hysaGross: 0.05, todayDate: new Date(2027, 6, 10), taxYear: 2027,
  });
  const qHead = quarterlyOnly.text.split('PLAN COMPARISON')[0];
  assert(quarterlyOnly.summary.iraWithholdingUsed === 0, 'the premise: this plan withholds nothing');
  assert(/QUARTERLY INSTALLMENT\(S\) PAST DUE/.test(qHead), 'and it does have past-due installments');
  assert(!/[Ww]ithholding under/.test(qHead), 'so it must not blame withholding it does not have');
  assert(/an estimate counts on the day you/.test(qHead),
    'and must say what actually decides lateness for it');

  // The flags the claim rests on are now on every plan's summary, not closure locals.
  Object.values(plan.plans).filter(Boolean).forEach(o => {
    assert(typeof o.summary.fedTimelyByWithholding === 'boolean',
      'every plan reports whether its own withholding clears the federal schedule');
    assert(typeof o.summary.stateTimelyByWithholding === 'boolean', 'and the state one');
  });
});

// ── P57-4. The coverage table is a checklist, so it is per plan ──────────
// Rendered once from Plan A's summary it showed conversion withholding of $7,000 and no estimates,
// while the recommended plan withheld nothing on the conversion and owed seven estimated payments.
test('Each plan section carries its own Tax Coverage Summary', () => {
  const plan = p56({ ira1RothConversion: 10000 });
  const n = (plan.html.match(/Tax Coverage Summary/g) || []).length;
  assert(n === plan.comparison.letters.length,
    `one table per plan: expected ${plan.comparison.letters.length}, got ${n}`);
  assert(plan.html.indexOf('Tax Coverage Summary') > plan.html.indexOf('plan-section-a'),
    'and none of them page-level, above the plan sections');

  // The composition really does differ, which is why one shared table was wrong.
  const compo = k => {
    const cs = plan.plans[k].summary.coverageSummary;
    return Object.keys(cs).filter(n2 => cs[n2].fed + cs[n2].state > 0).sort().join(',');
  };
  assert(compo('A') !== compo('Q'), `A and Q must not share a composition: ${compo('A')} vs ${compo('Q')}`);
});

// ── P57-5. Every label reads its own plan's actions ──────────────────────
// Plan B's said "draws and withholding in December" while an IRA that both converts and has an RMD
// has that RMD pulled forward, so Plan B withheld in the early month.
test('Plan labels name the months that plan actually uses', () => {
  const plan = p56({ ira1Rmd: 20000, ira1RothConversion: 30000 });
  const cc = plan.comparison;
  const monthsIn = (k, types) => Array.from(new Set(plan.plans[k].actions
    .filter(a => types.includes(a.type) && a.date).map(a => a.date.month))).sort((x, y) => x - y);
  const drawMonths = k => monthsIn(k, [T.RMD, T.IRA_VOL]);
  [['A', cc.labels.A], ['B', cc.labels.B], ['C', cc.labels.C]].forEach(([k, label]) => {
    if (!plan.plans[k]) return;
    drawMonths(k).forEach(m => {
      const name = ['January','February','March','April','May','June','July','August','September',
                    'October','November','December'][m - 1];
      assert(label.includes(name), `Plan ${k} draws in ${name} but its label says: ${label}`);
    });
  });
});

// ── P57-6. Plan D must not be Plan C under another name ─────────────────
// When the tax portion consumes every eligible dollar, D keeps no early leg: same dates, same
// amounts, same cost as C, while its label promised early spending draws.
test('Plan D is dropped when nothing is left to draw early', () => {
  const plan = p56({ ira1Rmd: 0, ira1Voluntary: 20000, ira2Rmd: 0, ira2Voluntary: 0 });
  assert(plan.plans.D === null, 'D would be identical to C here, so it must not be offered');
  assert(/identical to Plan C/.test(plan.comparison.dNote),
    `and the note must say why: ${plan.comparison.dNote}`);
  const sections = plan.html.slice(plan.html.indexOf('plan-section-a'), plan.html.indexOf('Rules and sources'));
  assert(!/tax-holdback tranche/.test(sections),
    'no tranche STEP should survive for a plan that was not offered (the W-4R citation may still explain it)');

  // The child still computes; it is the parent that declines to show it.
  const child = p56({ ira1Rmd: 0, ira1Voluntary: 20000, ira2Rmd: 0, ira2Voluntary: 0, _variant: 'D' });
  assert(child.summary.dNoEarlyLeg === true, 'the child reports the reason');
  assert(child.summary.dDegenerate === true, 'and counts it as degenerate');
});

// ── P57-7. Say what the plan hands you, and when ─────────────────────────
// The old footnote claimed voluntary draws were "not free to move" while every plan but A moved
// them to December and priced the move at zero.
test('Each plan states the cash it delivers, and the footnote gives the real reason', () => {
  const plan = p56();
  assert(!/not free to move/.test(plan.text) && !/not free to move/.test(plan.html),
    'the inverted reasoning must be gone from both renderers');
  assert(/does not know when you actually spend the money/.test(plan.text),
    'and replaced by the reason the deferral is not priced');
  assert(/comes from somewhere else|does not arrive until December/.test(plan.text),
    'plus the consequence of a December draw');

  // Per plan, in that plan's own dollars.
  const q = plan.plans.Q.summary;
  assert(q.netCashMonths.length === 1 && q.netCashMonths[0] === 12,
    'Plan Q delivers only in December');
  assertNear(q.netCashByMonth[12], 139182, 'and it delivers the whole draw, with nothing withheld', 1);
  const a = plan.plans.A.summary;
  assert(a.netCashMonths[0] < 12, 'Plan A delivers early');
  assert(/Net IRA cash to you/.test(plan.text), 'the line is rendered in text');
  assert(/Net IRA cash to you/.test(plan.html), 'and in HTML');
});

// ── P57-8. Money the tax figures never saw ──────────────────────────────
// The brokerage footnote priced $4,957 of capital gains tax and never said it sits outside the
// liability every plan is sized against. The tool is GIVEN the tax; it does not compute it.
test('The brokerage footnote says its capital gains tax is outside the liability', () => {
  const plan = p56();
  const cg = plan.comparison.brokerage.cg;
  assert(cg > 0, 'the scenario should price a gain');
  [['text', plan.text], ['html', plan.html]].forEach(([which, out]) => {
    assert(/not part of the/i.test(out), `${which}: must say the gain tax is not part of the liability`);
    assert(/Tax figures are inputs/.test(out), `${which}: and must cite the concept note`);
  });
  // The concept note itself, rendered in both outputs.
  assert(/Anything that raises your income after the plan is built/.test(plan.text),
    'the note is in the text Rules and sources panel');
  assert(/Anything that raises your income after the plan is built/.test(plan.html),
    'and in the HTML one');
  // The old sentence that called this a small second-order effect is gone.
  assert(!/These are typically small second-order effects/.test(plan.html),
    'the income-variation note must no longer lump the gains tax in with dividends');
});

// ── P57-9. The safe-harbor box describes the number above it ────────────
// California printed "110% of prior-year (high-income filer)" over a figure computed at 100%, and
// Maryland printed "110% (MD rule, always)" over one that was 90% of the current year.
test('Safe-harbor wording matches the multiplier each figure used', () => {
  const ca = TaxPaymentPlanner.computePaymentPlan({
    ...BASE, state: 'CA', federalTax: 35000, stateTax: 22000,
    priorYearFedTax: 33000, priorYearStateTax: 11500, highIncomeFiler: true,
    ira1Rmd: 15000, ira1Voluntary: 30000,
  });
  const box = ca.html.match(/Safe Harbor[\s\S]{0,900}/)[0];
  assertNear(ca.summary.safeHarborState, 11500, 'CA state figure is 100% of prior year', 1);
  assert(ca.summary.safeHarborStateMult === 1.00, 'and the multiplier says so');
  assert(/California: \$11,500 \(100% of prior-year\)/.test(box),
    `the state line must not borrow the federal 110% sentence: ${box.replace(/<[^>]+>/g, ' ').slice(0, 240)}`);
  assert(/Federal: \$36,300 \(110% of prior-year \(high-income filer\)\)/.test(box),
    'while the federal line, which really is 110%, says 110%');
  assert(/UNDERSTATES/.test(box) && /not given your AGI/.test(box),
    'and the AGI threshold caveat states the direction of the error');

  const md = TaxPaymentPlanner.computePaymentPlan({
    ...BASE, state: 'MD', federalTax: 35000, stateTax: 22000,
    priorYearFedTax: 33000, priorYearStateTax: null, ira1Rmd: 15000, ira1Voluntary: 30000,
  });
  const mdBox = md.html.match(/Safe Harbor[\s\S]{0,900}/)[0];
  assertNear(md.summary.safeHarborState, 19800, 'with no prior state tax it is 90% of this year', 1);
  assert(/Maryland: \$19,800 \(estimated at 90% of this year/.test(mdBox),
    `Maryland must not claim 110% over a 90% number: ${mdBox.replace(/<[^>]+>/g, ' ').slice(0, 240)}`);
  assert(!/high earners/.test(mdBox), 'and a state that applies 110% to everyone has no threshold to describe');
});


// ══ P58: you cannot elect withholding after the fact ══════════════════════
// The cross-IRA optimizer sorted every draw group by month and gave withholding to the latest
// first. That set included groups flagged ALREADY TAKEN, so a plan could put thousands of dollars
// of withholding on a distribution received months ago and then report itself fully covered. The
// gap fill did the same to a conversion marked already done, and because it sizes off the gap it
// could take the WHOLE conversion.
const P58 = {
  taxYear: 2027, state: 'CA', federalTax: 35000, stateTax: 22000,
  priorYearFedTax: 33000, priorYearStateTax: 11500,
  ira1Rmd: 8000, ira1RmdTaken: true, ira1Voluntary: 20000,
  ssIncome: 20000, pensionIncome: 15000, todayDate: new Date(2027, 6, 10),
};
const p58 = extra => TaxPaymentPlanner.computePaymentPlan({ ...P58, ...extra });
const paidBy58 = acts => acts.reduce((s, a) => s + (a.federalWithholding || 0) + (a.stateWithholding || 0), 0);

test('A draw already taken carries only the withholding you report', () => {
  const silent = p58();
  const takenOf = plan => plan.actions
    .filter(a => (a.type === T.RMD || a.type === T.IRA_VOL) && a.date.month === 6);

  // Nothing stated: nothing credited, in EVERY plan, not just the one that happens to be shown.
  Object.entries(silent.plans).filter(([, v]) => v).forEach(([k, plan]) => {
    const w = paidBy58(takenOf(plan));
    assert(w === 0, `plan ${k} invented ${w} of withholding on a distribution already taken`);
    assertNear(paidBy58(plan.actions), 57000, `plan ${k} still pays the whole liability`, 2);
  });

  // Stated: credited exactly, and the rest of the liability still gets scheduled.
  const stated = p58({ ira1RmdWithheld: 1600 });
  Object.entries(stated.plans).filter(([, v]) => v).forEach(([k, plan]) => {
    assertNear(paidBy58(takenOf(plan)), 1600, `plan ${k} credits the reported withholding`, 1);
    assertNear(paidBy58(plan.actions), 57000, `plan ${k} still pays the whole liability`, 2);
  });

  // A stated amount cannot exceed the distribution it came out of.
  const absurd = p58({ ira1RmdWithheld: 999999 });
  assert(paidBy58(takenOf(absurd.plans.A)) <= 8000 + 0.5,
    'withholding cannot exceed the gross of the draw it was taken from');
});

test('The already-taken disclosure appears in every plan and names the direction of the error', () => {
  const silent = p58();
  const noteOf = plan => plan.actions.find(a => a.type === T.NOTE && /already moved/.test(a.description));
  silent.comparison.letters.forEach(k => {
    const n = noteOf(silent.plans[k]);
    assert(n, `plan ${k} relies on the assumption and must carry the disclosure`);
    const all = n.notes.join(' ');
    assert(/no withholding assumed/.test(all), `plan ${k}: the note must say nothing was assumed`);
    assert(/OVERSTATES what you still owe/.test(all), `plan ${k}: and which way the error runs`);
  });
  // Once reported, it reads as a fact rather than a warning.
  const stated = p58({ ira1RmdWithheld: 1600 });
  const n = stated.plans.A.actions.find(a => a.type === T.NOTE && /Already completed/.test(a.description));
  assert(n, 'a reported figure gets the factual heading');
  assert(/you reported \$1,600 withheld/.test(n.notes.join(' ')), 'and states what was reported');
});

test('A conversion already done cannot have withholding elected on it either', () => {
  const base = {
    taxYear: 2027, state: 'CA', federalTax: 35000, stateTax: 22000,
    priorYearFedTax: 33000, priorYearStateTax: 11500,
    ira1Rmd: 0, ira1Voluntary: 5000, ira1RothConversion: 40000, ira1ConvDone: true,
    ssIncome: 20000, pensionIncome: 15000, todayDate: new Date(2027, 6, 10),
  };
  const silent = TaxPaymentPlanner.computePaymentPlan(base);
  const convOf = plan => plan.actions.filter(a => a.type === T.ROTH_CONV);
  Object.entries(silent.plans).filter(([, v]) => v).forEach(([k, plan]) => {
    const w = paidBy58(convOf(plan));
    assert(w === 0, `plan ${k} withheld ${w} on a conversion that already happened`);
    assertNear(paidBy58(plan.actions), 57000, `plan ${k} still pays the whole liability`, 2);
  });
  // The old behaviour took the entire conversion, which would have left nothing in the Roth.
  assert(convOf(silent.plans.A).every(a => (a.federalWithholding || 0) < 40000),
    'and certainly not the whole conversion');

  const stated = TaxPaymentPlanner.computePaymentPlan({ ...base, ira1ConvWithheld: 4000 });
  assertNear(paidBy58(convOf(stated.plans.A)), 4000, 'a reported figure is credited exactly', 1);

  // An explicit ira1RothWithhold override must not resurrect the election either.
  const overridden = TaxPaymentPlanner.computePaymentPlan({ ...base, ira1RothWithhold: true });
  assert(paidBy58(convOf(overridden.plans.A)) === 0,
    'an override cannot re-elect withholding on a completed conversion');
});

test('A plan forced to quarterly pays the liability once, not twice', () => {
  // The gap fill withheld on the conversion and the forced strategy then scheduled the WHOLE
  // liability as estimates on top of it: $64,000 against a $57,000 bill.
  const forced = TaxPaymentPlanner.computePaymentPlan({
    taxYear: 2027, state: 'CA', federalTax: 35000, stateTax: 22000,
    priorYearFedTax: 33000, priorYearStateTax: 11500,
    ira1Rmd: 15000, ira1Voluntary: 30000, ira1RothConversion: 10000, ira2Rmd: 5000,
    ssIncome: 20000, pensionIncome: 15000, todayDate: new Date(2027, 6, 10),
    forceStrategy: 'quarterly',
  });
  Object.entries(forced.plans).filter(([, v]) => v).forEach(([k, plan]) => {
    assertNear(paidBy58(plan.actions), 57000, `plan ${k} must pay 57000 exactly`, 2);
    assert(plan.strategy === 'all_quarterly', `plan ${k} should honour the forced strategy`);
  });
});


// ══ P59: how each plan pays, and whether that clears safe harbor ══════════
// The comparison priced the plans but never said which of them needed quarterly estimates, how
// much, or whether the resulting schedule actually satisfied the installment rules. Those are the
// questions that decide whether the cheapest plan carries a penalty the cost table does not price.
const P59 = {
  taxYear: 2027, state: 'CA', federalTax: 35000, stateTax: 22000,
  priorYearFedTax: 33000, priorYearStateTax: 11500,
  ira1Rmd: 15000, ira1Voluntary: 30000, ira1RothConversion: 10000, ira2Rmd: 5000,
  ssIncome: 20000, pensionIncome: 15000, interest: 5000, qualifiedDivs: 8000, capitalGains: 10000,
  marginalOrdRate: 0.30, portfolioRate: 0.06, hysaGross: 0.03,
};
const p59 = extra => TaxPaymentPlanner.computePaymentPlan({ ...P59, ...extra });

test('Withholding cures a passed quarter and an estimate cannot', () => {
  // Run in July: Q1 and Q2 have gone by. Withholding is credited across every due date
  // [IRC 6654(g)], so a December-withholding plan still clears Q1. An estimate counts on the day it
  // is paid, so a plan that leans on estimates cannot make those quarters timely however it tries.
  const late = p59({ todayDate: new Date(2027, 6, 10) });
  const sh = k => late.plans[k].summary.safeHarbor;
  assert(sh('A').federal.met, 'Plan A withholds the whole liability, so it clears the passed quarters');
  assert(sh('B').federal.met, 'and so does Plan B');
  assert(!sh('Q').federal.met, 'Plan Q pays entirely by estimates, which cannot be back-dated');
  assert(sh('Q').federal.missedAt === 'Q1 (Jan–Mar)', `and it first misses at Q1: ${sh('Q').federal.missedAt}`);
  assert(sh('Q').federal.shortBy > 1000, `by a real amount: ${sh('Q').federal.shortBy}`);

  // Same plans, run before anything is due: everything clears.
  const early = p59({ todayDate: new Date(2027, 0, 5) });
  ['A', 'B', 'C', 'D', 'Q'].filter(k => early.plans[k]).forEach(k => {
    assert(early.plans[k].summary.safeHarbor.met,
      `Plan ${k} should clear safe harbor when no installment has passed`);
  });
});

test('The safe-harbor test names the rule that actually binds', () => {
  // 90% of this year (31,500) is less than 100% of last year (33,000), so the federal bar is the
  // current-year test; California's prior year (11,500) is less than 90% of this year (19,800), so
  // there the prior-year test binds. Both appear on the same run, which is the point.
  const r = p59({ todayDate: new Date(2027, 6, 10) });
  const sh = r.plans.A.summary.safeHarbor;
  assert(/90% of this year/.test(sh.federal.rule), `federal rule: ${sh.federal.rule}`);
  assertNear(sh.federal.required, 31500, 'federal requirement is 90% of this year', 1);
  assert(/100% of last year/.test(sh.state.rule), `state rule: ${sh.state.rule}`);
  assertNear(sh.state.required, 11500, 'California requirement is last year in full', 1);

  // A high earner in a state that applies 110% to everyone gets told so.
  const md = TaxPaymentPlanner.computePaymentPlan({
    ...P59, state: 'MD', highIncomeFiler: true, priorYearFedTax: 20000, priorYearStateTax: 9000,
    todayDate: new Date(2027, 0, 5),
  });
  assert(/110% of last year/.test(md.plans.A.summary.safeHarbor.federal.rule),
    `a high earner whose prior year binds should see 110%: ${md.plans.A.summary.safeHarbor.federal.rule}`);

  // With no prior year supplied there is only one test left, and it says so.
  const noPrior = TaxPaymentPlanner.computePaymentPlan({
    ...P59, priorYearFedTax: null, priorYearStateTax: null, todayDate: new Date(2027, 0, 5),
  });
  assert(/not supplied/.test(noPrior.plans.A.summary.safeHarbor.federal.rule),
    'and it admits the prior-year figure is missing');
});

test('The comparison shows how each plan pays, and flags a cheapest plan that misses', () => {
  const r = p59({ todayDate: new Date(2027, 6, 10) });
  const cc = r.comparison;

  // The split the table was missing: withheld versus scheduled as estimates, per plan.
  cc.letters.forEach(k => {
    const c = cc.perPlan[k];
    assertNear(c.withheldTotal + c.estimatesTotal, 57000,
      `plan ${k} splits the whole liability between withholding and estimates`, 2);
  });
  assert(cc.perPlan.Q.withheldTotal === 0 && cc.perPlan.Q.estimatesTotal > 0,
    'Plan Q is entirely estimates');
  assert(cc.perPlan.A.estimatesTotal === 0 && cc.perPlan.A.withheldTotal > 0,
    'Plan A is entirely withholding');

  ['Withheld from IRA', 'Quarterly estimates', 'Safe harbor'].forEach(label => {
    assert(r.text.includes(label), `text table needs a "${label}" row`);
    assert(r.html.includes(label), `html table needs a "${label}" row`);
  });

  // The star ranks on first-year cost, which does not price an underpayment penalty. When the
  // cheapest plan misses, saying so is the whole point.
  assert(!cc.safeHarbor[cc.best].met, 'this scenario is chosen because the cheapest plan misses');
  assert(/cheapest plan MISSES safe harbor/.test(r.text), 'the text winner block must say so');
  assert(/MISSED by the cheapest plan/.test(r.html), 'and the HTML badge must too');
  assert(/short \$/.test(r.text) && /short \$/.test(r.html), 'and both must quantify the gap');
});


// ══ P60: a verdict of "met" has to say which bar it cleared ═══════════════
// Meeting 100% of last year when 110% was the real requirement is the expensive way to be wrong,
// and the 110% bar turns on PRIOR-year AGI, which this planner is never given.
test('The safe-harbor verdict names its multiplier and flags what it cannot verify', () => {
  const base = {
    taxYear: 2026, state: 'CA', federalTax: 35000, stateTax: 22000,
    priorYearFedTax: 20000, priorYearStateTax: 38000,
    ira1Rmd: 15000, ira2Rmd: 5000, marginalOrdRate: 0.30,
    portfolioRate: 0.06, hysaGross: 0.03, todayDate: new Date(2026, 6, 10),
  };

  // Modest income: the 100% bar binds, and the planner says plainly that it cannot check the
  // threshold that would raise it to 110%.
  const modest = TaxPaymentPlanner.computePaymentPlan({ ...base, ira1Voluntary: 5000 });
  const shM = modest.plans.A.summary.safeHarbor;
  assert(shM.federal.tag === '100%', `federal bar should be 100%: ${shM.federal.tag}`);
  assert(shM.provisional, 'a 100% verdict is provisional, because the AGI test cannot be checked');
  assertNear(shM.federal.required, 20000, 'and the requirement is last year in full', 1);
  assert(/Safe harbor \(100%/.test(modest.text), `the row must name the bar: ${modest.text.split('\n').find(l => /Safe harbor \(/.test(l))}`);
  assert(/rests on the 100% bar/.test(modest.text) && /rests on the 100% bar/.test(modest.html),
    'both outputs must carry the caveat');

  // Income comfortably over the threshold: infer the 110% bar rather than assume the cheaper one.
  // 15,000 RMD + 5,000 RMD + 150,000 voluntary = 170,000, clear of the $150,000 line.
  const high = TaxPaymentPlanner.computePaymentPlan({ ...base, ira1Voluntary: 150000 });
  const shH = high.plans.A.summary.safeHarbor;
  assert(shH.highIncomeInferred, 'the 110% bar should be inferred from the income entered');
  assert(shH.federal.tag === '110%', `and named: ${shH.federal.tag}`);
  assertNear(shH.federal.required, 22000, '110% of last year, not 100%', 1);
  assert(!shH.provisional, 'at the higher bar there is nothing left to warn about');
  assert(/110% bar was applied because the income entered/.test(high.text),
    'and the inference must be explained, since it rests on THIS year as a proxy');

  // An explicit flag still wins, and the requirement moves with it.
  const stated = TaxPaymentPlanner.computePaymentPlan({ ...base, ira1Voluntary: 5000, highIncomeFiler: true });
  assert(stated.plans.A.summary.safeHarbor.highIncomeStated, 'an explicit flag is honoured');
  assertNear(stated.plans.A.summary.safeHarbor.federal.required, 22000, 'and raises the bar', 1);
});

test('With no prior-year tax the fallback states the direction of its error', () => {
  const r = TaxPaymentPlanner.computePaymentPlan({
    taxYear: 2026, state: 'CA', federalTax: 35000, stateTax: 22000,
    priorYearFedTax: null, priorYearStateTax: null,
    ira1Rmd: 15000, ira1Voluntary: 30000, ira2Rmd: 5000,
    marginalOrdRate: 0.30, portfolioRate: 0.06, hysaGross: 0.03, todayDate: new Date(2026, 6, 10),
  });
  const sh = r.plans.A.summary.safeHarbor;
  assert(sh.priorYearMissing, 'the gap is recorded');
  assert(sh.federal.tag === '90%', 'and the fallback is 90% of this year');
  assertNear(sh.federal.required, 31500, 'which is 90% of the current federal tax', 1);
  // Substituting this year for last year cannot change the answer: the lesser-of rule always
  // picks 90% of the current year, since 90% is below both 100% and 110% of the same figure.
  // What it CAN do is overstate, when last year was genuinely lower.
  assert(/can only be too HIGH/.test(r.text) && /can only be too HIGH/.test(r.html),
    'both outputs must say which way the fallback errs');
  assert(/Enter last year/.test(r.text), 'and ask for the figure that settles it');
});

// ── Runner ────────────────────────────────────────────────────────────────
// Returns the counts instead of setting process.exitCode, so the browser can render them.
// The node entry point below is what still sets the exit code.
function runTaxPlannerTests() {
  passed = 0;
  failed = 0;
  console.log('\ntaxPaymentPlanner.tests.js\n' + '─'.repeat(60));
  const failures = [];
  TESTS.forEach(([name, fn]) => {
    try {
      fn();
      console.log(`  ✓  ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ✗  ${name}`);
      console.log(`       ${e.message}`);
      failures.push(`${name}: ${e.message}`);
      failed++;
    }
  });
  console.log('');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(failed > 0 ? '\n*** SOME TESTS FAILED ***' : 'All tests passed.');
  return { passed, failed, total: TESTS.length, failures };
}

if (typeof module !== 'undefined' && module.exports) {
  const r = runTaxPlannerTests();
  if (r.failed > 0) process.exitCode = 1;
  module.exports = { runTaxPlannerTests, TEST_COUNT: TESTS.length };
} else {
  window.runTaxPlannerTests = runTaxPlannerTests;
  // Published for the staleness guard in optimizer_tests.js, which asserts that the number of
  // node-side tests it knows about still matches what is actually on disk.
  window.TAXPLANNER_TEST_COUNT = TESTS.length;
}

})();
