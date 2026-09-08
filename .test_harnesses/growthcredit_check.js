'use strict';
/**
 * growthcredit_check.js -- does the P108b growth-credit trick carry to P28jk?
 *
 * Run:  node .test_harnesses/growthcredit_check.js
 *
 * TWO QUESTIONS, one arithmetic and one against the engine.
 *
 * Q1. P28jk wants "conversion at month 1, SPENDING withdrawal at month 11". Today the year has
 *     exactly two growth segments (preMonths, postMonths) and one withdrawal point. The real
 *     structure needs THREE segments (1, 10, 1) and two withdrawal points. P108b faced a similar
 *     re-sequencing and avoided it with a growth CREDIT applied to the two-segment year. Does the
 *     same trick reproduce the three-segment result, and if not, by how much is it wrong?
 *
 * Q2. Found while reading P108b's implementation (optimizer_core.js, the taxSettlement block).
 *     The credit is added to `balance[k]` BEFORE `applyGrowth(balance, rates, postMonths)`, so the
 *     credited dollars themselves then grow for postMonths. If the intent is that the December 31
 *     balance match a plan that really held the tax until December, the credit belongs AFTER that
 *     growth call. Algebra says the difference is a second-order over-credit of T*r^2*(post/12)^2.
 *     Measured here against the engine rather than asserted.
 *
 * `applyGrowth` is simple proportional (optimizer_core.js:701): factor = 1 + rate*months/12.
 * Everything below uses that, never compounding.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
const PLANS = require('../plans');
const { simulate } = core;

const money = n => (n < 0 ? '-' : '') + '$' + (Math.round(Math.abs(n) * 100) / 100).toLocaleString();

// ===========================================================================================
// Q1. Three-segment truth vs two-segment + credit, for an early conversion.
// ===========================================================================================
console.log('='.repeat(78));
console.log('Q1  Can a growth credit reproduce "convert at month 1, spend at month 11"?');
console.log('='.repeat(78));

function q1(B, X, W, g) {
    const a = 1 + g / 12;          // 1 month
    const c = 1 + 10 * g / 12;     // 10 months
    const b = 1 + 11 * g / 12;     // 11 months

    // TRUTH: three segments. IRA grows 1mo, conversion X out, grows 10mo, spending W out, grows 1mo.
    const truthIRA  = ((B * a - X) * c - W) * a;
    const truthRoth = X * b;                       // converted at month 1, grows 11 months

    // BASELINE: today's engine, pinned LATE. Everything leaves at month 11.
    const baseIRA  = (B * b - X - W) * a;
    const baseRoth = X * a;

    // CREDIT FORM: take the baseline and credit the growth the relocation would have produced.
    // Roth is short the 10 months the converted dollars did not spend in it: X*(b - a) = X*10g/12.
    // The IRA is correspondingly long by the same amount, because those dollars sat there instead.
    // Both credits are applied at Dec 31, i.e. AFTER the year's growth, so they do not re-grow.
    const shift = X * (10 * g / 12);
    const credIRA  = baseIRA - shift;
    const credRoth = baseRoth + shift;

    // Closed form for the IRA residual. The first draft of this predicted -B*(10g^2/144)*a and the
    // run disagreed, which is why it is computed here rather than asserted: the X term was missing.
    //   resid = a*[B*(b - a*c) + X*(c - 1)] - X*(10g/12),  with b - a*c = -10g^2/144, c - 1 = 10g/12
    //         = (10g^2/144) * (X - a*B)
    return { truthIRA, truthRoth, baseIRA, baseRoth, credIRA, credRoth,
             residIRA: credIRA - truthIRA, residRoth: credRoth - truthRoth,
             predicted: (10 * g * g / 144) * (X - a * B) };
}

const CASES = [
    { B: 3000000, X: 200000, W: 200000, g: 0.06 },
    { B: 3000000, X: 800000, W: 100000, g: 0.06 },   // large conversion, modest spend
    { B: 1000000, X:  50000, W: 300000, g: 0.06 },   // small conversion, large spend
    { B: 3000000, X: 200000, W: 200000, g: 0.10 },   // g^2 term is quadratic: should quadruple-ish
    { B: 3000000, X: 200000, W: 200000, g: 0.00 },   // no growth: everything must agree exactly
];

console.log('\nresidual = (credit form) - (three-segment truth). Roth first, then IRA.\n');
for (const cs of CASES) {
    const r = q1(cs.B, cs.X, cs.W, cs.g);
    console.log(`B=${money(cs.B)}  X=${money(cs.X)}  W=${money(cs.W)}  g=${(cs.g * 100).toFixed(0)}%`);
    console.log(`   Roth: truth ${money(r.truthRoth)}  credit ${money(r.credRoth)}  residual ${money(r.residRoth)}`);
    console.log(`   IRA : truth ${money(r.truthIRA)}  credit ${money(r.credIRA)}  residual ${money(r.residIRA)}`);
    console.log(`   closed form (10g^2/144)*(X - a*B) = ${money(r.predicted)}` +
                `   match: ${Math.abs(r.residIRA - r.predicted) < 0.01 ? 'YES' : 'NO'}`);
    console.log(`   residual as a share of the IRA balance: ${(Math.abs(r.residIRA) / cs.B * 10000).toFixed(2)} bp`);
    console.log('');
}
console.log('READ: the Roth leg is EXACT - the credit reproduces it with no residual at all.');
console.log('The IRA leg carries a residual of exactly (10g^2/144)*(X - a*B): quadratic in g, linear');
console.log('in the balance and the conversion, INDEPENDENT of the spending draw, and about 2 bp of');
console.log('the balance at 6%. It is a pure artifact of splitting simple proportional growth into');
console.log('three segments instead of two, it is NOT an economic difference, and because it has a');
console.log('closed form it can be subtracted off to make the credit exact.');

// ===========================================================================================
// Q2. Where P108b puts its credit, measured against the engine.
// ===========================================================================================
console.log('\n' + '='.repeat(78));
console.log('Q2  P108b: is the credit applied before or after the post-withdrawal growth?');
console.log('='.repeat(78));

// P112. The household is `high-spend-large-ira` in the plan bank, not a literal copied into
// this file. Its card records what it exercises, what its measured viability is, and what it
// CANNOT show: low-bracket behaviour of any kind - it never visits the bottom of the ladder.
// Read plans/high-spend-large-ira.js before reading a verdict off this harness.
const BASE = { ...PLANS.get("high-spend-large-ira").inputs };

const off = simulate({ ...BASE });
const on  = simulate({ ...BASE, taxSettlement: 'december' });
const r0off = off.log[0], r0on = on.log[0];

const credit = r0on['-taxCarryCredit'] ?? 0;
const postMonths = 12 - 11;                       // pinned late -> preMonths 11, postMonths 1
const g = BASE.growth;
const grow = 1 + g * postMonths / 12;

const iraOff = (r0off.IRA1 ?? 0) + (r0off.IRA2 ?? 0);
const iraOn  = (r0on.IRA1  ?? 0) + (r0on.IRA2  ?? 0);
const brokOff = r0off.Brokerage ?? 0, brokOn = r0on.Brokerage ?? 0;
const cashOff = r0off.Cash ?? 0, cashOn = r0on.Cash ?? 0;
const rothOff = (r0off.Roth1 ?? 0) + (r0off.Roth2 ?? 0);
const rothOn  = (r0on.Roth1  ?? 0) + (r0on.Roth2  ?? 0);

const deltaAll = (iraOn - iraOff) + (brokOn - brokOff) + (cashOn - cashOff) + (rothOn - rothOff);

console.log(`\nyear 0, pinned LATE so postMonths = ${postMonths}, growth ${(g * 100).toFixed(0)}%`);
console.log(`  reported '-taxCarryCredit' (the pre-growth credit) : ${money(credit)}`);
console.log(`  actual year-0 Dec 31 balance delta, all accounts   : ${money(deltaAll)}`);
console.log('');
console.log(`  if the credit is applied AFTER growth, delta should be credit          = ${money(credit)}`);
console.log(`  if the credit is applied BEFORE growth, delta should be credit*${grow.toFixed(4)} = ${money(credit * grow)}`);
const dAfter = Math.abs(deltaAll - credit), dBefore = Math.abs(deltaAll - credit * grow);
console.log('');
console.log(`  |delta - credit|        = ${money(dAfter)}`);
console.log(`  |delta - credit*grow|   = ${money(dBefore)}`);
console.log('');
console.log(dBefore < dAfter
    ? '  => APPLIED BEFORE GROWTH. The credited dollars grow again, so the December 31 balance\n' +
      '     exceeds a plan that really held the tax to December by T*r^2*(post/12)^2.'
    : '  => APPLIED AFTER GROWTH, or the difference is below the noise of this fixture.');
console.log(`  over-credit at this postMonths: ${money(credit * (grow - 1))}` +
            `  (${(credit * (grow - 1) / Math.max(1, credit) * 100).toFixed(2)}% of the credit)`);
console.log('\nNOTE: postMonths is 1 under a pinned LATE, which is the SMALLEST this term can be.');
console.log('An Early year has postMonths 11 and the term is 11x larger. Re-run with');
console.log("forceWithdrawTiming: 'early' to see it.");

const onEarly  = simulate({ ...BASE, forceWithdrawTiming: 'early', taxSettlement: 'december' });
const offEarly = simulate({ ...BASE, forceWithdrawTiming: 'early' });
const e0on = onEarly.log[0], e0off = offEarly.log[0];
const creditE = e0on['-taxCarryCredit'] ?? 0;
const growE = 1 + g * 11 / 12;
const deltaE = ((e0on.IRA1 ?? 0) + (e0on.IRA2 ?? 0) + (e0on.Brokerage ?? 0) + (e0on.Cash ?? 0) +
                (e0on.Roth1 ?? 0) + (e0on.Roth2 ?? 0))
             - ((e0off.IRA1 ?? 0) + (e0off.IRA2 ?? 0) + (e0off.Brokerage ?? 0) + (e0off.Cash ?? 0) +
                (e0off.Roth1 ?? 0) + (e0off.Roth2 ?? 0));
console.log(`\n  EARLY year (postMonths 11): credit ${money(creditE)}, actual delta ${money(deltaE)}`);
console.log(`     credit*${growE.toFixed(4)} = ${money(creditE * growE)}   over-credit ${money(creditE * (growE - 1))}`);
