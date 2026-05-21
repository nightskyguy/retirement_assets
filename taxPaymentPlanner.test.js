'use strict';
/**
 * taxPaymentPlanner.test.js
 * Run with: node taxPaymentPlanner.test.js
 *
 * Covers:
 *   1. No IRA operations — all quarterly
 *   2. RMD only — full tax coverage from IRA draw
 *   3. Conversion only — no RMD (60-day replace auto-analysis)
 *   4. Insufficient IRA withdrawal — partial coverage + quarterly shortfall
 *   5. Dual-IRA cross-optimizer — later IRA carries all withholding
 *   6. IRA-exempt state — state tax forced to quarterly
 *   7. 60-day replace — December conversion not recommended
 *   8. 60-day replace — January conversion recommended
 *   9. RMD + conversion same IRA — ordering rule enforced
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
    ira1RmdMonth: 12,
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
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1RothConversion: 80000,
    ira1ConvMonth: 6,
    federalTax: 15000,
  });
  const convAction = plan.actions.find(a => a.type === T.ROTH_CONV);
  assert(convAction, 'Expected a Roth conversion action');
  assert(convAction.date.month === 6, `Expected conversion in June, got month ${convAction.date.month}`);
  // With 6 months remaining at 7% portfolio rate vs. tiny 60-day HYSA cost → should withhold
  assert(plan.summary.ira1.doWithhold === true, '60-day replace should be recommended for June');
  assert(convAction.federalWithholding > 0, 'Expected federal withholding on conversion');
});

test('Conversion only — 60-day replace NOT recommended for December conversion', () => {
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1RothConversion: 80000,
    ira1ConvMonth: 12,
    federalTax: 15000,
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
    ira1RmdMonth: 12,
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
  // IRA1: January draw ($15K), IRA2: December draw ($15K), tax = $20K
  // Optimizer should assign all withholding to IRA2 (December = later month)
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1Rmd: 15000, ira1RmdMonth: 1,
    ira2Rmd: 15000, ira2RmdMonth: 12,
    federalTax: 20000,
  });
  assert(plan.strategy !== 'all_quarterly', 'Should use IRA strategy with two draws');
  const ira1Actions = plan.actions.filter(a => a.iraNum === 1 && a.type === T.RMD);
  const ira2Actions = plan.actions.filter(a => a.iraNum === 2 && a.type === T.RMD);
  assert(ira1Actions.length > 0, 'Expected IRA 1 RMD action');
  assert(ira2Actions.length > 0, 'Expected IRA 2 RMD action');
  const ira1Withheld = ira1Actions.reduce((s, a) => s + a.federalWithholding, 0);
  const ira2Withheld = ira2Actions.reduce((s, a) => s + a.federalWithholding, 0);
  assert(ira1Withheld === 0, `IRA1 (January) should have zero withholding; got ${ira1Withheld}`);
  assert(ira2Withheld > 0, `IRA2 (December) should carry all withholding; got ${ira2Withheld}`);
  assertNear(ira2Withheld, 20000, 'IRA2 should cover full federal tax', 5);
});

// ── 6. IRA-exempt state ───────────────────────────────────────────────────
test('IRA-exempt state (IL) — state tax via quarterly only', () => {
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    state: 'IL',
    ira1Rmd: 30000, ira1RmdMonth: 12,
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
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1Rmd: 30000, ira1RmdMonth: 12,
    ira1RothConversion: 20000, ira1ConvMonth: 12,
    federalTax: 20000,
  });
  const sda = plan.summary.ira1.sixtyDay;
  assert(sda, 'Expected sixtyDay analysis on summary');
  assert(sda.monthsRem === 0, `Expected monthsRem=0, got ${sda.monthsRem}`);
  assert(sda.benefit === 0, `Expected benefit=0, got ${sda.benefit}`);
  assert(sda.recommended === false, 'December conversion should NOT recommend 60-day replace');
});

// ── 8. 60-day analysis — January conversion ───────────────────────────────
test('60-day analysis — January conversion is strongly recommended', () => {
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1RothConversion: 50000, ira1ConvMonth: 1,
    federalTax: 8000,
    todayDate: new Date(2026, 0, 1), // simulate January 1 so month hasn't passed
  });
  const sda = plan.summary.ira1.sixtyDay;
  assert(sda.monthsRem === 11, `Expected monthsRem=11, got ${sda.monthsRem}`);
  assert(sda.benefit > sda.cost60, `Benefit (${sda.benefit.toFixed(0)}) should exceed cost60 (${sda.cost60.toFixed(0)})`);
  assert(sda.recommended === true, 'January conversion should recommend 60-day replace');
});

// ── 9. RMD + conversion same IRA — ordering rule ──────────────────────────
test('RMD + conversion same IRA — ordering rule moves RMD before conversion', () => {
  // Conversion month (January=1) before RMD month (December=12) → conflict
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    ira1Rmd: 15000, ira1RmdMonth: 12,
    ira1RothConversion: 20000, ira1ConvMonth: 3, // March conversion, December RMD → conflict
    federalTax: 10000,
    todayDate: new Date(2026, 0, 1),
  });
  assert(plan.summary.ira1.hasConflict === true, 'Expected ordering conflict');
  // RMD should be moved to conversion month (March)
  assert(plan.summary.ira1.planARmdMonth === 3,
    `RMD should be in March, got month ${plan.summary.ira1.planARmdMonth}`);
});

// ── 10. Zero taxes ────────────────────────────────────────────────────────
test('Zero taxes — no payment actions generated', () => {
  const plan = TaxPaymentPlanner.computePaymentPlan({
    ...BASE,
    federalTax: 0,
    stateTax: 0,
    ira1Rmd: 10000, ira1RmdMonth: 12,
  });
  const paymentActions = plan.actions.filter(a =>
    a.type === T.Q_FED || a.type === T.Q_STATE ||
    (a.type === T.RMD && a.federalWithholding > 0)
  );
  assert(paymentActions.length === 0,
    `Expected no payment actions with zero tax; got ${paymentActions.length}`);
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
