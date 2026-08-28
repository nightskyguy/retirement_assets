'use strict';
/**
 * rmdbasis_harness.js -- P84k / P84n. How wrong is the RMD basis, and did fixing it move what the
 * characterization said it would?
 *
 * Run:  node .test_harnesses/rmdbasis_harness.js
 *
 * THE DEFECT. 26 CFR 1.401(a)(9)-5 sets a year's required distribution as the PRIOR DECEMBER 31
 * account balance over the life-expectancy divisor. Nothing that happens during the year can change
 * it. The engine struck it off `balance.IRA1` at `optimizer_core.js:1557`, which by then has had
 * THIS year's pre-withdrawal growth applied at `beginYear:1288`.
 *
 * That is two errors and the second is the serious one:
 *   1. a systematic overstatement of roughly `preMonths/12 x growth`;
 *   2. **the RMD is coupled to the withdrawal-timing rule.** `preMonths` is 1 or 11, chosen from
 *      `yr._useEarly`, which is set from whether LAST year converted more than $1,000. So two
 *      otherwise identical plans get different RMDs because one of them converted -- a dependency
 *      with no basis in the regulation, and the same coupling P28j is scoped against surfacing in a
 *      second place.
 *
 * WHY THIS HARNESS EXISTS SEPARATELY FROM THE FIX (risk R12). `P84l` moves numbers in almost every
 * suite. A genuinely broken assertion can then be "fixed" by accepting whatever new value appears.
 * So the size and DIRECTION of every expected move is recorded here BEFORE the change, and each
 * moved number is checked against a prediction rather than accepted because it moved.
 *
 * Run it on `main` and after the fix; section 4 states what must be true afterwards, and the same
 * script scores it. Results in `research/RMDBASIS_RESULTS.md`.
 *
 * PREDICTIONS, stated before the fix:
 *   R1  Lifetime RMDs FALL for every plan that takes any RMD at all. Direction is certain (the
 *       basis loses a growth stub); the size should sit near (1+g)^(preMonths/12) - 1.
 *   R2  The RMD BASIS is timing-independent: for each year, RMD divided by the PRIOR YEAR-END
 *       balance of the SAME account equals that spouse's life-expectancy divisor, identically on
 *       both timing arms. This is the coupling test and the one that fails on main.
 *
 *       R2 WAS FIRST WRITTEN WRONG, and the wrong version is instructive. It said "pinning timing
 *       early vs late changes LIFETIME RMDs; after the fix it changes them by $0". That is false
 *       and would have stayed false after a perfectly correct fix: timing legitimately changes the
 *       balance PATH, so next year's December 31 balance -- and therefore next year's perfectly
 *       legal RMD -- differs. Run against the fixed engine it reported 30 of 30 plans still
 *       "violating", worse than the 22 of 30 it found before the fix, and the fix was right.
 *       The regulation constrains the BASIS, not the trajectory.
 *
 *       The second version was also wrong, more subtly: it took (rmd1+rmd2) over the COMBINED
 *       prior balance. Each spouse carries their own divisor, so that ratio is a blend weighted by
 *       the IRA1/IRA2 split -- and the split itself moves between arms. It reported a 2.3e-4
 *       discrepancy that was entirely the blend. Per account, the agreement is 7e-18.
 *       Two rounds of testing the nearest convenient statistic instead of the quantity claimed.
 *   R3  Terminal IRA RISES, because less was forced out.
 *   R4  IRMAA breach years fall or stay equal, never rise.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
Object.assign(globalThis, require('../taxengine.js'));
const core = require('../optimizer_core.js');
require('../displayhelpers.js');
const { simulate } = core;

// COMMON copied verbatim from gapfill_harness.js, per the rule in phased_harness.js -- except
// iraBaseGoal, which is the SHIPPED DEFAULT here rather than 0. A plan with no IRA floor drains the
// IRA to nothing under several families and then takes no RMDs at all, which is precisely the
// regime in which an RMD-basis harness measures nothing.
const COMMON = {
    STATEname: 'CA', nYears: 20,
    birthyear1: 1962, birthmonth1: 6, die1: 92,
    birthyear2: 1964, birthmonth2: 3, die2: 94, hasSpouse: true,
    ss1: 45000, ss1Age: 70, ss2: 24000, ss2Age: 67,
    pensionAnnual: 0, pensionStartAge: 0, survivorPct: 0, pensionCola: false,
    spendChange: 0, iraBaseGoal: 750000,
    inflation: 0.025, cpi: 0.025, growth: 0.06,
    cashYield: 0.03, dividendRate: 0.02,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: true, propWithdraw: 0.10, iraWithdrawPct: 0.06,
    extraConversionAmount: 0, fundConversionWithCash: false,
    startAge: 64, startInYear: 2026, dividendReinvest: true,
    gkGuard: 0.20, gkAdjPct: 0.10, cycleLTCGTarget: 0.15,
    qcdHHMax: 0, qcdMode: 'asneeded', computeOC: false,
};

const SCENARIOS = [
    { key: 'defaults',   label: 'shipped defaults (IRA-heavy)',
      over: { IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000,
              Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000 } },
    { key: 'defaults3x', label: 'defaults x3',
      over: { IRA1: 3000000, IRA2: 1200000, Roth: 150000, Roth2: 60000,
              Brokerage: 300000, BrokerageBasis: 150000, Cash: 150000 } },
    { key: 'round1',     label: 'round-1 scenario',
      over: { IRA1: 1800000, IRA2: 700000, Roth: 250000, Roth2: 100000,
              Brokerage: 900000, BrokerageBasis: 500000, Cash: 150000 } },
    { key: 'thirds',     label: 'balanced thirds',
      over: { IRA1: 1000000, IRA2: 400000, Roth: 1000000, Roth2: 400000,
              Brokerage: 1400000, BrokerageBasis: 700000, Cash: 150000 } },
    { key: 'brokheavy',  label: 'brokerage-heavy',
      over: { IRA1: 700000, IRA2: 300000, Roth: 400000, Roth2: 200000,
              Brokerage: 2800000, BrokerageBasis: 1200000, Cash: 150000 } },
];
const FAMILIES = [
    { key: 'propwd',  label: 'Proportional 10%', over: { strategy: 'propwd', propWithdraw: 0.10 } },
    { key: 'bracket', label: 'Fill Bracket 24%', over: { strategy: 'bracket', stratRate: 0.24,
                                                         stratIRMAATier: -1, stratACAMultiple: 0 } },
    { key: 'draw',    label: 'IRA Draw 6%',      over: { strategy: 'fixedpct', iraWithdrawPct: 0.06 } },
];
const SPEND_RATES = [0.04, 0.06];
const totalOf = (o) => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;

const money = (n) => (n == null || Number.isNaN(n)) ? '      -     '
    : (n < 0 ? '-' : ' ') + '$' + Math.round(Math.abs(n)).toLocaleString().padStart(11);
const pad = (s, n) => String(s).padEnd(n);
const pct = (r) => (r * 100).toFixed(0) + '%';

let simCount = 0;
function run(over) {
    const res = simulate(over);
    simCount++;
    return {
        rmd: res.totals.rmd ?? 0,
        rmdTax: res.totals.rmdTax ?? 0,
        ira: res.totals.terminal.ira,
        tax: res.totals.taxCurrentDollars ?? 0,
        irmaaYears: res.log.filter(r => (r.IRMAA || 0) > 0).length,
        magi: res.log.reduce((a, r) => a + (r.totalIncome || 0), 0),
        // Year 0's RMD basis, for the P84o year-0 guard: the typed balance is only a December 31
        // balance for a January-start plan, and that limitation is pinned rather than papered over.
        firstRmdRow: res.log.find(r => ((r['RMD1-'] || 0) + (r['RMD2-'] || 0)) > 0) || null,
        success: res.totals.success,
        log: res.log,
    };
}

const cells = [];
for (const s of SCENARIOS) for (const f of FAMILIES) for (const rate of SPEND_RATES) {
    cells.push({ s, f, rate, base: { ...COMMON, ...s.over, ...f.over,
                                     spendGoal: Math.round(totalOf(s.over) * rate) } });
}

console.log('='.repeat(112));
console.log('P84k / P84n -- the RMD basis. How wrong, and did the fix move what was predicted?');
console.log('='.repeat(112));
console.log('');
console.log(`Grid: ${SCENARIOS.length} mixes x ${FAMILIES.length} families x ${SPEND_RATES.length} spend rates`
    + ` = ${cells.length} plans, each run on both pinned timing arms and unpinned.`);
console.log('iraBaseGoal is the SHIPPED DEFAULT $750,000, not 0: with no IRA floor several families');
console.log('drain the IRA to nothing and take no RMDs at all, and an RMD harness would measure air.');
console.log('');

// -- 1. The coupling. This is the defect that has no basis in the regulation. -------------------
console.log('1. THE COUPLING -- does the WITHDRAWAL TIMING RULE change the RMD BASIS?\n');
console.log('   Measured PER ACCOUNT: RMD in year y over the SAME account\'s year y-1 closing');
console.log('   balance. That quotient is the life-expectancy divisor and depends only on age, so');
console.log('   it must be identical on both timing arms. It is NOT the lifetime total: timing');
console.log('   legitimately changes the balance path, so later RMDs may legally differ in level.');
console.log('   Nor is it the combined ratio, which is a blend of two divisors weighted by the');
console.log('   IRA1/IRA2 split. Both of those were tried first and both were wrong.\n');

const ratiosOf = (log) => {
    const out = [];
    for (let y = 1; y < log.length; y++) {
        const a = log[y]['RMD1-'] || 0, prior = log[y - 1].IRA1 || 0;
        if (a > 1 && prior > 1) out.push(a / prior);
    }
    return out;
};
console.log('   ' + pad('plan', 42) + pad('yrs', 6) + pad('max |late-early| divisor gap', 32)
    + 'lifetime RMD late');
const coupling = [];
for (const c of cells) {
    const late  = run({ ...c.base, forceWithdrawTiming: 'late' });
    const early = run({ ...c.base, forceWithdrawTiming: 'early' });
    if (late.rmd <= 0 && early.rmd <= 0) continue;
    const L = ratiosOf(late.log), E = ratiosOf(early.log);
    const n = Math.min(L.length, E.length);
    let gap = 0;
    for (let i = 0; i < n; i++) gap = Math.max(gap, Math.abs(L[i] - E[i]));
    coupling.push({ c, late, early, n, gap });
}
for (const r of coupling.slice(0, 14)) {
    console.log('   ' + pad(`${r.c.s.key}/${r.c.f.key}/${pct(r.c.rate)}`, 42)
        + pad(r.n, 6) + pad(r.gap.toExponential(3), 32) + money(r.late.rmd));
}
if (coupling.length > 14) console.log(`   ... ${coupling.length - 14} more rows not shown.`);
const nonzero = coupling.filter(r => r.gap > 1e-12);
console.log('');
console.log(`   ${nonzero.length} of ${coupling.length} plans have a timing-dependent RMD BASIS.`);
console.log(`   For reference, an 11-month 6% growth stub in the basis would show as roughly `
    + `${((Math.pow(1.06, 10 / 12) - 1)).toExponential(2)} x the divisor.`);
console.log('');
console.log(`   VERDICT: ${nonzero.length === 0
    ? 'the RMD basis is timing-independent. R2 SATISFIED -- this is the post-fix state.'
    : 'the RMD BASIS DEPENDS ON WITHDRAWAL TIMING. R2 VIOLATED -- this is the pre-fix state.'}`);
console.log('');

// -- 2. The conversion path, which is how the coupling is actually reached in a real plan. ------
console.log('2. HOW A REAL PLAN REACHES IT -- convert vs do not, timing UNPINNED\n');
console.log('   `_useEarly` is set from whether last year converted more than $1,000, so a');
console.log('   conversion silently re-bases the FOLLOWING year\'s RMD. Timing is left unpinned');
console.log('   here precisely so that path is live.\n');
console.log('   ' + pad('plan', 42) + pad('RMD no-conv', 15) + pad('RMD conv', 15)
    + pad('difference', 15) + 'Early yrs');
let convRows = 0;
for (const c of cells) {
    const noconv = run({ ...c.base, convertExcessToRoth: false, extraConversionAmount: 0 });
    const conv   = run({ ...c.base, convertExcessToRoth: false, extraConversionAmount: 60000 });
    if (noconv.rmd <= 0 && conv.rmd <= 0) continue;
    if (convRows++ >= 12) continue;
    const early = conv.log.filter(r => String(r.timing || '').startsWith('Early')).length;
    console.log('   ' + pad(`${c.s.key}/${c.f.key}/${pct(c.rate)}`, 42)
        + pad(money(noconv.rmd), 15) + pad(money(conv.rmd), 15)
        + pad(money(conv.rmd - noconv.rmd), 15) + early);
}
console.log('');
console.log('   The difference here is NOT all coupling -- a conversion genuinely shrinks the IRA,');
console.log('   which genuinely shrinks later RMDs. Section 1 is the clean measurement; this');
console.log('   section only shows that the coupling path is reachable without pinning anything.');
console.log('');

// -- 3. The levels that will move when the basis is fixed. -------------------------------------
console.log('3. WHAT THE FIX WILL MOVE  (pinned late, the P85 configuration)\n');
console.log('   ' + pad('plan', 42) + pad('lifetime RMD', 15) + pad('terminal IRA', 15)
    + pad('lifetime tax', 15) + 'IRMAA yrs');
const levels = [];
for (const c of cells) {
    const r = run({ ...c.base, forceWithdrawTiming: 'late' });
    levels.push({ c, r });
}
for (const { c, r } of levels.slice(0, 14)) {
    console.log('   ' + pad(`${c.s.key}/${c.f.key}/${pct(c.rate)}`, 42)
        + pad(money(r.rmd), 15) + pad(money(r.ira), 15) + pad(money(r.tax), 15) + r.irmaaYears);
}
if (levels.length > 14) console.log(`   ... ${levels.length - 14} more rows not shown.`);
const withRMD = levels.filter(x => x.r.rmd > 0);
console.log('');
console.log(`   ${withRMD.length} of ${levels.length} plans take any RMD at all.`);
console.log(`   totals: lifetime RMD ${money(levels.reduce((a, x) => a + x.r.rmd, 0))}`
    + `   terminal IRA ${money(levels.reduce((a, x) => a + x.r.ira, 0))}`
    + `   IRMAA years ${levels.reduce((a, x) => a + x.r.irmaaYears, 0)}`);
console.log('');

// -- 4. Year 0, the limitation P84o pins rather than fixes. -------------------------------------
console.log('4. YEAR 0 -- the limitation that is declared, not fixed\n');
console.log('   The prior-Dec-31 snapshot seeds from the typed IRA balance, which IS a December 31');
console.log('   balance only for a plan starting in January. For a mid-year start it is not, and');
console.log('   the first RMD is estimated. P72 owns startMonth and therefore owns the fix; the');
console.log('   deliverable here is that the limitation is pinned by a test and stated in the UI.');
console.log('');

// -- 5. Predictions. ---------------------------------------------------------------------------
console.log('5. PREDICTIONS  (scored by re-running this file after the fix)\n');
console.log(`   R1  lifetime RMDs FALL for every plan taking any RMD      -- ${withRMD.length} plans in scope`);
console.log(`   R2  timing arms give an IDENTICAL RMD BASIS               -- violated in `
    + `${nonzero.length} of ${coupling.length}`);
console.log('   R3  terminal IRA RISES');
console.log('   R4  IRMAA breach years fall or stay equal, never rise');
console.log('');
console.log(`${simCount} simulations.`);
console.log('='.repeat(112));
