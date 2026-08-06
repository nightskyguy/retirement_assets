'use strict';
/**
 * taxPaymentPlanner.tests.js
 * Run with: node taxPaymentPlanner.tests.js
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

  assert(plan.planB !== null, 'Expected Plan B to exist (conversion present)');
  const bWithheld  = plan.planB.summary.iraWithholdingUsed;
  const bShortfall = plan.planB.summary.shortfall;
  assertNear(bWithheld + bShortfall, totalTax,
    `Plan B: withholding(${bWithheld}) + shortfall(${bShortfall}) should equal tax(${totalTax})`, 2);

  // Plan B specifically should have a shortfall here because December conversion
  // skips 60-day withholding (0 months of Roth growth → not worth the cost),
  // leaving draws ($44,500) short of total tax ($47,000).
  assert(bShortfall > 0,
    `Plan B should show a shortfall when draws < total tax and conv withholding is skipped; got ${bShortfall}`);

  // Plan A should have no shortfall — conversion withholding plugs the gap.
  assert(aShortfall === 0,
    `Plan A should fully cover taxes via conversion withholding; shortfall was ${aShortfall}`);
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
      plan.actions.filter(a => a.date).forEach(a => {
        const d = new Date(a.date.year, a.date.month - 1, a.date.day);
        if (!isBusinessDay(d)) offenders.push(`${y} ${a.type} ${d.toDateString()}`);
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
    // planC is displayed as Plan A, the main object as Plan B, planB as Plan C.
    const variants = [['A', plan.planC], ['B', plan], ['C', plan.planB]].filter(v => v[1]);
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
  const variants = [['A', plan.planC], ['B', plan], ['C', plan.planB]].filter(v => v[1]);
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
  assert(plan.planB.summary.shortfall === 7000,
    `Expected Plan C to route 7000 to estimates, got ${plan.planB.summary.shortfall}`);
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
  const c = alertOf(plan.planB);
  assert(c, 'Expected a missed-installment alert on Plan C');
  const cAll = c.description + ' ' + c.notes.join(' ');
  assert(!/No action is required/.test(c.description),
    'Plan C withholding is 798 short on the federal schedule — must not say no action is required');
  assert(/does not fully cover/.test(c.description), 'Alert should name the uncovered schedule');
  assert(/federal/.test(c.description), 'Alert should identify FEDERAL as the short schedule');
  assert(/California/.test(cAll), 'Alert should credit California as covered rather than lumping them together');

  // Plans A and B withhold the full liability, so both schedules clear and the reassurance is true.
  [['A', plan.planC], ['B', plan]].forEach(([name, obj]) => {
    const a = alertOf(obj);
    assert(a, `Expected a missed-installment alert on Plan ${name}`);
    assert(/No action is required/.test(a.description),
      `Plan ${name} covers both schedules, so the alert should say so`);
    assert(a.notes.some(n => /Checked, not assumed/.test(n)),
      `Plan ${name} should show the figures the claim rests on`);
  });

  // Per-installment wording must agree with the alert, which is where the contradiction showed.
  const qFed   = plan.planB.actions.filter(a => a.type === T.Q_FED   && a.date && new Date(a.date.year, a.date.month - 1, a.date.day) < REPORTED.todayDate);
  const qState = plan.planB.actions.filter(a => a.type === T.Q_STATE && a.date && new Date(a.date.year, a.date.month - 1, a.date.day) < REPORTED.todayDate);
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
  assert(run({ brokerageValue: 100000, brokerageBasis: 150000 })
    .analysis.strategies.find(s => s.id === 'all_brokerage').cg === 0,
    'a clamped loss position must not produce a negative capital-gains cost');

  // Blank/absent dollars keep the documented default, and zero value cannot give a ratio.
  assertNear(run({}).params.appreciationPct, 0.40, 'no dollars supplied keeps the 0.40 default', 1e-9);
  assertNear(run({ brokerageValue: 0, brokerageBasis: 0 }).params.appreciationPct,
    0.40, 'a zero-value position cannot give a ratio, so the default stands', 1e-9);
  assertNear(run({ appreciationPct: 0.604 }).params.appreciationPct,
    0.604, 'the raw fraction is still honoured for legacy ?ap= links', 1e-9);

  // The direction that matters: a higher gain share must cost more to sell, monotonically.
  const cgOf = ap => run({ brokerageValue: 100000, brokerageBasis: 100000 * (1 - ap) })
    .analysis.strategies.find(s => s.id === 'all_brokerage').cg;
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
  module.exports = { runTaxPlannerTests };
} else {
  window.runTaxPlannerTests = runTaxPlannerTests;
}

})();
