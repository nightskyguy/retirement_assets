'use strict';
/**
 * taxPaymentPlanner.test.js
 * Run with: node taxPaymentPlanner.test.js
 *
 * Covers:
 *   1. No IRA operations — all quarterly
 *   2. RMD only — full tax coverage from IRA draw
 *   3. Conversion only — no RMD (60-day replace auto-analysis, month from todayDate)
 *   4. Insufficient IRA withdrawal — partial coverage + quarterly shortfall
 *   5. Dual-IRA cross-optimizer — later IRA carries all withholding
 *   6. IRA-exempt state — state tax forced to quarterly
 *   7. 60-day replace — December conversion not recommended (November todayDate → nextMonth=Dec)
 *   8. 60-day replace — early-year conversion recommended (January todayDate → nextMonth=Feb)
 *   9. RMD + conversion same IRA — ordering rule enforced (February todayDate → nextMonth=Mar)
 *  10. Zero taxes — no actions generated
 */

const TaxPaymentPlanner = require('./taxPaymentPlanner.js');

const T = TaxPaymentPlanner.ACTION_TYPES;

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗  ${name}`);
    console.log(`       ${e.message}`);
    failed++;
  }
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

console.log('\ntaxPaymentPlanner.test.js\n' + '─'.repeat(60));

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

test('Conversion only — 60-day replace NOT recommended for December conversion', () => {
  // November todayDate → nextMonth = December → 0 months remaining → not recommended
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1RothConversion: 80000,
    federalTax: 15000,
    todayDate: new Date(2026, 10, 15), // November 15 → nextMonth = December
  });
  assert(plan.summary.ira1.doWithhold === false, '60-day replace should NOT be recommended for December');
  const convAction = plan.actions.find(a => a.type === T.ROTH_CONV);
  assert(convAction.federalWithholding === 0, 'Expected no withholding on December conversion');
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

// ── 7. 60-day analysis — December conversion ──────────────────────────────
test('60-day analysis — December conversion has monthsRem=0, net negative', () => {
  // November todayDate → nextMonth = December → monthsRem = 12-12 = 0 → not recommended
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1Rmd: 30000,
    ira1RothConversion: 20000,
    federalTax: 20000,
    todayDate: new Date(2026, 10, 15), // November 15 → nextMonth = December
  });
  const sda = plan.summary.ira1.sixtyDay;
  assert(sda, 'Expected sixtyDay analysis on summary');
  assert(sda.monthsRem === 0, `Expected monthsRem=0, got ${sda.monthsRem}`);
  assert(sda.benefit === 0, `Expected benefit=0, got ${sda.benefit}`);
  assert(sda.recommended === false, 'December conversion should NOT recommend 60-day replace');
});

// ── 8. 60-day analysis — early-year conversion ────────────────────────────
test('60-day analysis — early-year conversion is strongly recommended', () => {
  // January 1 todayDate → nextMonth = February → monthsRem = 12-2 = 10
  // 10 months of Roth growth >> 60-day HYSA cost → strongly recommended
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1RothConversion: 50000,
    federalTax: 8000,
    todayDate: new Date(2026, 0, 1), // January 1 → nextMonth = February
  });
  const sda = plan.summary.ira1.sixtyDay;
  assert(sda.monthsRem === 10, `Expected monthsRem=10 (Feb conversion), got ${sda.monthsRem}`);
  assert(sda.benefit > sda.cost60, `Benefit (${sda.benefit.toFixed(0)}) should exceed cost60 (${sda.cost60.toFixed(0)})`);
  assert(sda.recommended === true, 'Early-year conversion should recommend 60-day replace');
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

  // Plan A invariant
  const aCovered  = plan.summary.totalCovered;
  const aShortfall = plan.summary.shortfall;
  assertNear(aCovered + aShortfall, totalTax,
    `Plan A: covered(${aCovered}) + shortfall(${aShortfall}) should equal tax(${totalTax})`, 2);

  // Plan B must also satisfy invariant
  assert(plan.planB !== null, 'Expected Plan B to exist (conversion present)');
  const bCovered   = plan.planB.summary.totalCovered;
  const bShortfall = plan.planB.summary.shortfall;
  assertNear(bCovered + bShortfall, totalTax,
    `Plan B: covered(${bCovered}) + shortfall(${bShortfall}) should equal tax(${totalTax})`, 2);

  // Plan B specifically should have a shortfall here because December conversion
  // skips 60-day withholding (0 months of Roth growth → not worth the cost),
  // leaving draws ($44,500) short of total tax ($47,000).
  assert(bShortfall > 0,
    `Plan B should show a shortfall when draws < total tax and conv withholding is skipped; got ${bShortfall}`);

  // Plan A should have no shortfall — conversion withholding plugs the gap.
  assert(aShortfall === 0,
    `Plan A should fully cover taxes via conversion withholding; shortfall was ${aShortfall}`);
});

// ── Summary ───────────────────────────────────────────────────────────────
console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\n*** SOME TESTS FAILED ***');
  process.exitCode = 1;
} else {
  console.log('All tests passed.');
}
