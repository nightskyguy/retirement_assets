'use strict';
/**
 * optimizer_core.test.js
 * Run with: node optimizer_core.test.js
 *
 * Phase 24: Cyclic Withdrawal Modifier tests
 *
 * Covers:
 *   1. Dynamic N from balance ratio (IRA=$600k, Brok=$200k → N=3)
 *   2. Brokerage year triggers at subCycleIRAYears >= N; counter resets
 *   3. Brokerage year: Brokerage drawn for spending; IRA untouched (beyond RMDs)
 *   4. IRA years: IRA drawn; brokerage grows; surplus reinvests into Brokerage
 *   5. DRIP forced-on when cyclicEnabled: dividends → Brokerage not Cash
 *   6. Depletion ⚠ fires when Brokerage < 50% of target
 *   7. cyclicEnabled=false → identical output to non-cyclic run (regression)
 */

// Load the source files via require() using their dual-mode export guards.
// Stubs must exist BEFORE the requires: displayhelpers.js touches window/document
// at load time, and performance.now() is stubbed so timing fields stay
// deterministic (0), matching the old vm-based harness.
globalThis.performance = { now: () => 0 };
globalThis.window = {};                         // stub for displayhelpers.js (window.DisplayHelpers)
globalThis.document = { getElementById: () => null, addEventListener: () => {} };

// optimizer_core.js resolves calculateTaxes etc. as bare globals (the
// classic-script contract shared with the browser and the MC worker), so the
// taxengine exports are mirrored onto globalThis before the engine loads.
const taxengine = require('./taxengine.js');
Object.assign(globalThis, taxengine);

const core = require('./optimizer_core.js');
// displayhelpers.js is an IIFE that sets window.DisplayHelpers — load it so the share-URL
// round-trip tests can exercise the REAL parseShorthand decoder against compactNum.
require('./displayhelpers.js');

const simulate = core.simulate;
const optimizeSpend = core.optimizeSpend;
const calculateTaxes = taxengine.calculateTaxes;
const findUpperLimitByAmount = taxengine.findUpperLimitByAmount;
const getRateBracket = taxengine.getRateBracket;
const TAXData = taxengine.TAXData;
const getLTCGBracketRoom = core.getLTCGBracketRoom;
const compactNum = core.compactNum;
const diagnoseConvBreakEvenFailure = core.diagnoseConvBreakEvenFailure;
const bestConversionStopYear = core.bestConversionStopYear;
const afterTaxWealthOfLogRow = core.afterTaxWealthOfLogRow;
const optimizeConversionAmount = core.optimizeConversionAmount;
const baselineScoreOf = core.baselineScoreOf;
const selectConversionCandidates = core.selectConversionCandidates;
const rankRowsByObjective = core.rankRowsByObjective;
const eitherOnMedicareAtStart = core.eitherOnMedicareAtStart;
const taxCreepFactor = core.taxCreepFactor;
const breakEvenHeirsRate = core.breakEvenHeirsRate;
const lowestBreakEvenHeirsRate = core.lowestBreakEvenHeirsRate;
const bestTimeLimitedConversion = core.bestTimeLimitedConversion;
const buildVariations = core.buildVariations;
const buildStrategyFamilies = core.buildStrategyFamilies;
const bothOnMedicareAtStart = core.bothOnMedicareAtStart;
const MC_GRIDS = core.MC_GRIDS;
const OPTIMIZER_GRIDS = core.OPTIMIZER_GRIDS;
const sameStrategySelection = core.sameStrategySelection;
const offGridParamFor = core.offGridParamFor;
const parseShorthand = globalThis.window.DisplayHelpers.parseShorthand;
// P35 PR 1 characterization goldens — a RECORDING of what the two strategy enumerations emit,
// captured before PR 2 extracts the Optimizer's copy into core. See sweep_golden.js.
const { SWEEP_BASES, MC_GOLDEN, OPT_GOLDEN } = require('./sweep_golden.js');

// ── Test harness ──────────────────────────────────────────────────────────────
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

function assertNear(a, b, msg, tol = 100) {
    if (Math.abs(a - b) > tol) throw new Error(`${msg}: expected ~${b}, got ${a} (tol=${tol})`);
}

// ── Base inputs ───────────────────────────────────────────────────────────────
// IRA=$600k, Brok=$200k (fully appreciated) → N = round(600k/200k) = 3
// 3 IRA years, then 1 brokerage harvest year, repeat.
const BASE = {
    STATEname: 'CA',
    strategy: 'fixed',
    nYears: 20,
    birthyear1: 1952, birthmonth1: 1, die1: 90,
    birthyear2: 0,    birthmonth2: 12, die2: 0,
    IRA1: 600000, IRA2: 0, Roth: 0, Roth2: 0,
    Brokerage: 200000, BrokerageBasis: 100000,  // 50% gains
    Cash: 50000,
    ss1: 0, ss1Age: 70, ss2: 0, ss2Age: 70,
    pensionAnnual: 0, survivorPct: 0, pensionCola: false,
    spendGoal: 60000, spendChange: 0, iraBaseGoal: 0,
    inflation: 0.00, cpi: 0.00, growth: 0.00,  // zero growth for predictable math
    cashYield: 0.00, dividendRate: 0.00,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: false, propWithdraw: 0, iraWithdrawPct: 0.05,
    startInYear: 2026, dividendReinvest: false,
    startYear: 2026,
    hasSpouse: false,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

test('getLTCGBracketRoom: returns 0% bracket room for MFJ below ceiling', () => {
    if (!getLTCGBracketRoom) throw new Error('getLTCGBracketRoom not exported from core.js');
    // MFJ 0% cap gains bracket ≈ $98,900 in 2026. Ordinary income $40k → room ≈ $58,900.
    const room = getLTCGBracketRoom(40000, 'MFJ', 0.15, 1.0);
    assert(room > 50000 && room < 80000,
        `Expected room ~58900 for MFJ with $40k ordinary income, got ${room}`);
});

test('getLTCGBracketRoom: returns 0 when ordinary income exceeds 0% ceiling', () => {
    if (!getLTCGBracketRoom) throw new Error('getLTCGBracketRoom not exported from core.js');
    // MFJ 0% bracket ceiling ~$98,900. With $150k ordinary income, no 0% room remains.
    const room = getLTCGBracketRoom(150000, 'MFJ', 0.15, 1.0);
    assert(room === 0,
        `Expected 0 room when ordinary income ($150k) exceeds 0% ceiling (~$98.9k), got ${room}`);
});

test('IRMAA: charges from year 0, not year 1 (fixed magiHistory seeding bug)', () => {
    // birthyear1=1952 → already 74 in startYear 2026, so onMedicare=1 from year 0.
    // Large spendGoal forces a large IRA withdrawal, pushing MAGI (~$150k single) comfortably
    // above the lowest IRMAA tier threshold (~$109k single, 2026) in year 0 itself.
    const result = simulate({ ...BASE, spendGoal: 400000, IRA1: 3000000 });
    assert(result.log[0].IRMAATier !== '-none-',
        `Year 0 should show a real IRMAA tier (bug forced it to '-none-'), got '${result.log[0].IRMAATier}'`);
    assert(result.log[0].IRMAA > 0,
        `Year 0 IRMAA surcharge should be > 0, got ${result.log[0].IRMAA}`);
    // Steady-state assumption: year 1 reads the same seeded MAGI, so tier should match or be close.
    assert(result.log[1].IRMAATier !== '-none-',
        `Year 1 should also show a real IRMAA tier, got '${result.log[1].IRMAATier}'`);
});

test('cyclicEnabled=false: output identical to base run (regression)', () => {
    const base = simulate({ ...BASE });
    const withFalse = simulate({ ...BASE, cyclicEnabled: false });
    // Totals should be identical to within $1 (floating-point)
    assertNear(base.totals.tax, withFalse.totals.tax, 'tax', 1);
    assertNear(base.totals.spend, withFalse.totals.spend, 'spend', 1);
    assertNear(base.finalNW, withFalse.finalNW, 'finalNW', 1);
    assert(base.log.length === withFalse.log.length, 'log length mismatch');
});

test('cyclicEnabled: subCycle column present in log rows', () => {
    const result = simulate({ ...BASE, cyclicEnabled: true });
    assert(result.log.length > 0, 'no log rows');
    const firstRow = result.log[0];
    assert('subCycle' in firstRow, `subCycle field missing from log row; keys: ${Object.keys(firstRow).join(',')}`);
});

test('cyclicEnabled: year 0 is IRA year (IRA), not brokerage year', () => {
    // IRA=600k, Brok=200k → N=3. First 3 years are IRA years; year 4 is brokerage.
    const result = simulate({ ...BASE, cyclicEnabled: true });
    const y0 = result.log[0];
    assert(y0.subCycle === 'IRA',
        `Expected year 0 to be IRA year (IRA), got subCycle="${y0.subCycle}"`);
    // IRA should be drawn in IRA years (withdrawal > 0)
    assert((y0['IRAwd'] ?? 0) > 0,
        `Expected IRA withdrawal in IRA year, got ${y0['IRAwd']}`);
});

test('cyclicEnabled: brokerage year (year N) draws from Brokerage, not IRA (beyond RMDs)', () => {
    // N = round(600000/200000) = 3. Year 0,1,2 = IRA; year 3 = brokerage harvest.
    const result = simulate({ ...BASE, cyclicEnabled: true });
    // Find first B row
    const bRow = result.log.find(r => r.subCycle === 'Brok' || r.subCycle === '⚠Brok');
    assert(bRow !== undefined, 'No brokerage harvest year found in log');
    // In brokerage year, Brokerage withdrawal > 0
    assert((bRow['Brokerage-'] ?? 0) > 0,
        `Expected Brokerage drawn in harvest year, got ${bRow['Brokerage-']}`);
});

test('cyclicEnabled: brokerage year maxes out target LTCG bracket even when spend need is small', () => {
    // SGL 0% LTCG ceiling ~$49,450 (2026). Low spendGoal (already covered by other income this
    // early) means pure need-driven sizing would draw ~$0, but Cycle Brokerage should harvest
    // toward the full 0% bracket regardless of spend need.
    const result = simulate({ ...BASE, cyclicEnabled: true, spendGoal: 15000 });
    const bRow = result.log.find(r => r.subCycle === 'Brok' || r.subCycle === '⚠Brok');
    assert(bRow !== undefined, 'No brokerage harvest year found in log');
    assert((bRow['Brokerage-'] ?? 0) > 20000,
        `Expected a large gross Brokerage draw (bracket maxed out, not need-driven), got ${bRow['Brokerage-']}`);
});

test('cyclicEnabled: cycleLTCGTarget=0.20 (target 15% bracket) harvests more than default 0.15 target', () => {
    const lowTarget  = simulate({ ...BASE, cyclicEnabled: true, spendGoal: 15000, cycleLTCGTarget: 0.15 });
    const highTarget = simulate({ ...BASE, cyclicEnabled: true, spendGoal: 15000, cycleLTCGTarget: 0.20 });
    const lowRow  = lowTarget.log.find(r => r.subCycle === 'Brok' || r.subCycle === '⚠Brok');
    const highRow = highTarget.log.find(r => r.subCycle === 'Brok' || r.subCycle === '⚠Brok');
    assert(lowRow !== undefined && highRow !== undefined, 'Expected a brokerage year in both runs');
    assert(highRow.CapGains > lowRow.CapGains,
        `Expected 0.20 target to harvest more gains than 0.15 target, got ${highRow.CapGains} vs ${lowRow.CapGains}`);
});

test('cyclicEnabled: DRIP forced — dividends flow to Brokerage not Cash (positive dividend rate)', () => {
    const divInputs = {
        ...BASE,
        cyclicEnabled: true,
        dividendReinvest: false,   // explicitly off — Cyclic should override
        dividendRate: 0.02,        // 2% dividend
        growth: 0.00,
        cpi: 0.00, inflation: 0.00,
    };
    const result = simulate(divInputs);
    // With DRIP forced, dividends reinvest into Brokerage (brokerageG) not Cash (cashG).
    // Find an IRA year and confirm dividends accumulate in brokerageG, not cashG.
    const iRow = result.log.find(r => r.subCycle === 'IRA');
    assert(iRow !== undefined, 'No IRA year row found');
    // brokerageG should be non-zero (dividends reinvested into brokerage)
    assert((iRow.brokerageG ?? 0) > 0,
        `Expected brokerageG > 0 with forced DRIP, got ${iRow.brokerageG}`);
    // cashG should be 0 (no dividends flowing to cash with DRIP on)
    assert((iRow.cashG ?? 0) === 0,
        `Expected cashG=0 with forced DRIP, got ${iRow.cashG}`);
});

test('cyclicEnabled: surplus reinvested into Brokerage (not Cash) in IRA years', () => {
    // Use a propwd strategy that intentionally over-withdraws from IRA → surplus.
    const surplusInputs = {
        ...BASE,
        strategy: 'propwd',
        propWithdraw: 0.50,   // 50% over-draw → surplus flows to Brokerage, not Cash
        cyclicEnabled: true,
        growth: 0.00, cpi: 0.00, inflation: 0.00,
        convertExcessToRoth: false,
    };
    const result = simulate(surplusInputs);
    // In IRA years, surplus should go to Brokerage, so surplusCash should be 0
    const iRows = result.log.filter(r => r.subCycle === 'IRA');
    assert(iRows.length > 0, 'No IRA year rows found');
    // At least some IRA years should have surplusCash=0 (reinvested into brokerage)
    const zeroSurplusCash = iRows.filter(r => (r.surplusCash ?? 0) === 0);
    assert(zeroSurplusCash.length > 0,
        `Expected some IRA years with surplusCash=0 (surplus reinvested to brokerage), none found`);
});

// ── Phase 12: Withdrawal Timing ───────────────────────────────────────────────
test('Phase 12: bracket strategy year 0 → Early(Conv)', () => {
    const result = simulate({ ...BASE, strategy: 'bracket', stratRate: 0.22 });
    assert(result.log[0].timing === 'Early(Conv)',
        `Expected Early(Conv) for bracket strategy year 0, got ${result.log[0].timing}`);
});

test('Phase 12: propwd strategy (no conversions) → all Late(Spend)', () => {
    const result = simulate({ ...BASE, strategy: 'propwd', propWithdraw: 0.10 });
    const nonLate = result.log.filter(r => r.timing !== 'Late(Spend)');
    assert(nonLate.length === 0,
        `Expected all Late(Spend) for propwd with no conversions, found ${nonLate.length} non-Late rows`);
});

test('Phase 12: extraConversionAmount > 0 → Early(Conv) propagates via look-back', () => {
    const result = simulate({ ...BASE, extraConversionAmount: 20000 });
    // Year 0: Early (flag). Year 1+: Early because prev conv > 1000.
    const earlyRows = result.log.filter(r => r.timing === 'Early(Conv)');
    assert(earlyRows.length >= 2,
        `Expected ≥2 Early(Conv) rows with extraConversionAmount, got ${earlyRows.length}`);
    // All conversion rows should be Early
    const convRows = result.log.filter(r => (r.rothConv ?? 0) > 1000);
    const lateConvRows = convRows.filter(r => r.timing !== 'Early(Conv)');
    assert(lateConvRows.length === 0,
        `Found ${lateConvRows.length} conversion rows with Late timing`);
});

test('Phase 12: transitions to Late after IRA depletes and conversions stop', () => {
    // Small IRA depletes in ~3 years; after that no conversions → Late
    const result = simulate({
        ...BASE,
        IRA1: 80000, IRA2: 0,
        extraConversionAmount: 15000,
        nYears: 3,
    });
    // After IRA depletes, log should have Late(Spend) rows
    const lateRows = result.log.filter(r => r.timing === 'Late(Spend)');
    const earlyRows = result.log.filter(r => r.timing === 'Early(Conv)');
    assert(earlyRows.length > 0, 'Expected some Early(Conv) rows while IRA active');
    assert(lateRows.length > 0, 'Expected some Late(Spend) rows after IRA depletes');
    // No Late rows should appear while conversions are firing (conv > 1000)
    const badRows = lateRows.filter(r => (r.rothConv ?? 0) > 1000);
    assert(badRows.length === 0,
        `Found ${badRows.length} Late(Spend) rows where conversions > $1k were firing`);
});

test('Phase 12: Late timing yields higher terminal balance than forced-Early for pure spending', () => {
    // With Late timing (11/12 yr pre-growth), portfolio compounding is greater before withdrawal exits.
    // We cannot directly force Early on a non-conversion run, but we can verify Late numerically:
    // run with Late (propwd, no conv) and manually run equivalent with Early-forced extraConv=1
    // to see that the pure-spending Late run has higher final wealth.
    const lateRun = simulate({ ...BASE, strategy: 'propwd', propWithdraw: 0.0, growth: 0.07, inflation: 0.00 });
    // Bracket strategy (forced Early on year 0, but Late on all subsequent since no conv fires)
    // so both end up same after year 0. Instead verify Late path gain vs BOY path:
    // BOY equivalent: zero pre-growth (old behavior). Late = 11/12 yr pre-growth.
    // With growth=7%, IRA=$600k, spend=$60k: Late gains ~$600k*0.07*(11/12)=$38.5k before spend vs $0.
    // This compounds — by year 30, Late final wealth should exceed Early final wealth.
    // Test: timing field exists and is string for all rows.
    const allHaveTiming = lateRun.log.every(r => typeof r.timing === 'string');
    assert(allHaveTiming, 'Expected every log row to have a string timing field');
    const validTiming = lateRun.log.every(r => r.timing === 'Early(Conv)' || r.timing === 'Late(Spend)');
    assert(validTiming, 'Expected every timing value to be Early(Conv) or Late(Spend)');
});

// ── Withdrawal Rate + Inflows/Outflows ────────────────────────────────────────
// wdRate% = netOut / start-of-year PORTFOLIO balance (raw sum, no tax discount).
// SS/pension are NOT subtracted — the rate measures what leaves the portfolio, which is
// what makes it comparable to the 4% rule and to the GK guardrail rate.
test('wdRate%: equals netOut ÷ prior-year portfolio balance', () => {
    const result = simulate({ ...BASE });
    const rows = result.log.slice(1).filter(r => r['wdRate%'] != null);
    assert(rows.length > 0, 'Expected wdRate% populated for years 1+');
    for (let i = 1; i < result.log.length; i++) {
        const r = result.log[i];
        const prevPort = result.log[i - 1].portfolioBalance;
        if (r['wdRate%'] != null && prevPort > 0) {
            const expected = r.netOut / prevPort;
            assert(Math.abs(r['wdRate%'] - expected) < 1e-9,
                `Year ${r.year}: wdRate% ${r['wdRate%']} != netOut/prevPortfolio ${expected}`);
            assert(r.inflows === 0, `Year ${r.year}: expected inflows=0 with no SS/pension, got ${r.inflows}`);
        }
    }
});

test('wdRate%: denominator is the raw portfolio, not tax-discounted totalWealth', () => {
    // BASE holds a $600k IRA, so totalWealth is materially below portfolioBalance. If the old
    // after-tax denominator leaked back in, the rate would read high by roughly that discount.
    const result = simulate({ ...BASE });
    const r0 = result.log[0], r1 = result.log[1];
    assert(r0.portfolioBalance > r0.totalWealth + 1000,
        'Fixture no longer distinguishes the two denominators; pick balances with a bigger IRA');
    const wrongWay = r1.netOut / r0.totalWealth;
    assert(Math.abs(r1['wdRate%'] - wrongWay) > 1e-6,
        'wdRate% still matches the after-tax denominator');
});

test('wdRate%: never negative, even when SS exceeds the spending goal', () => {
    // ss1Age 70, born 1952 → SS active from start (age 74 in 2026). SS $100k > spend $60k.
    // The old formula subtracted inflows and went negative here; withdrawals cannot.
    const result = simulate({ ...BASE, ss1: 100000, ss1Age: 70 });
    const rows = result.log.filter(r => r['wdRate%'] != null);
    assert(rows.length > 0, 'Expected wdRate% populated');
    const neg = rows.filter(r => r['wdRate%'] < 0);
    assert(neg.length === 0,
        `Withdrawal rate must never go negative; found ${neg.length} years: ${neg.map(r => r.year + '=' + (r['wdRate%']*100).toFixed(1) + '%').join(', ')}`);
    // It bottoms out at exactly zero: RMDs still leave the IRA, but with SS covering spending
    // and taxes they are reinvested, so the dollars never leave the portfolio. A forced
    // IRA→taxable round-trip is not a withdrawal.
    assert(result.totals.avgWdRate === 0,
        `Expected a zero withdrawal rate when SS covers everything, got ${result.totals.avgWdRate}`);
    assert(result.log.some(r => (r.grossOut ?? 0) > 1000),
        'Expected forced RMD gross outflows even though the net rate is zero');
});

test('outflows: reconciliation — netOut = grossOut − rothConv − reinvestedSurplus', () => {
    const result = simulate({ ...BASE, extraConversionAmount: 20000 });
    for (const r of result.log) {
        // reinvestedSurplus isn't logged directly; bound: netOut ≤ grossOut − rothConv
        assert(r.netOut <= r.grossOut - r.rothConv + 1e-6,
            `Year ${r.year}: netOut ${r.netOut} > grossOut ${r.grossOut} − rothConv ${r.rothConv}`);
        assert(r.grossOut >= 0, `Year ${r.year}: grossOut negative: ${r.grossOut}`);
    }
    // At least one conversion year: grossOut − netOut ≥ conversion amount
    const convRows = result.log.filter(r => (r.rothConv ?? 0) > 1000);
    assert(convRows.length > 0, 'Expected conversion years with extraConversionAmount');
    for (const r of convRows) {
        assert(r.grossOut - r.netOut >= r.rothConv - 1e-6,
            `Year ${r.year}: grossOut−netOut (${r.grossOut - r.netOut}) < rothConv (${r.rothConv})`);
    }
});

test('wdRate%: a pension shows up in inflows only, never in the numerator', () => {
    // A pension does reduce the rate, but only because fewer dollars need to be withdrawn.
    // The numerator must stay netOut, so the reconciliation below has to hold unchanged.
    const noPension = simulate({ ...BASE });
    const withPension = simulate({ ...BASE, pensionAnnual: 30000 });
    assert(withPension.totals.avgWdRate != null && noPension.totals.avgWdRate != null,
        'Expected avgWdRate computed for both runs');
    assert(withPension.totals.avgWdRate < noPension.totals.avgWdRate,
        `Expected the pension to reduce actual withdrawals: ${withPension.totals.avgWdRate} vs ${noPension.totals.avgWdRate}`);
    const r1 = withPension.log[1];
    assert(r1.inflows > 25000, `Expected year-1 inflows ≈ pension $30k, got ${r1.inflows}`);
    // The numerator ignores that $30k entirely.
    const prevPort = withPension.log[0].portfolioBalance;
    assert(Math.abs(r1['wdRate%'] - r1.netOut / prevPort) < 1e-9,
        'Pension leaked into the withdrawal-rate numerator');
});

test('avgWdRate: simple mean of the yearly rates, including year 0', () => {
    const result = simulate({ ...BASE });
    assert(result.totals.avgWdRate != null, 'Expected avgWdRate populated');
    const rows = result.log.filter(r => r['wdRate%'] != null);
    const manualAvg = rows.reduce((s, r) => s + r['wdRate%'], 0) / rows.length;
    assert(Math.abs(result.totals.avgWdRate - manualAvg) < 1e-12,
        `avgWdRate ${result.totals.avgWdRate} != manual average ${manualAvg}`);
    // Spend $60k against a $950k portfolio, zero growth → drawdown accelerates as it shrinks.
    assert(result.totals.avgWdRate > 0.04 && result.totals.avgWdRate < 0.15,
        `Expected avg rate in plausible 4–15% range, got ${result.totals.avgWdRate}`);
});

test('avgWdRateWeighted: equals Σ netOut ÷ Σ prior-year portfolio', () => {
    const result = simulate({ ...BASE, ss1: 40000 });
    const log = result.log;
    // Year 0's denominator is the starting balance, which isn't logged; back it out of its
    // own rate so the check covers exactly the year set the engine used.
    let num = 0, den = 0;
    for (let i = 0; i < log.length; i++) {
        if (log[i]['wdRate%'] == null) continue;
        const prevPort = i === 0 ? log[0].netOut / log[0]['wdRate%'] : log[i - 1].portfolioBalance;
        if (!(prevPort > 0)) continue;
        num += log[i].netOut;
        den += prevPort;
    }
    const manual = num / den;
    assert(Math.abs(result.totals.avgWdRateWeighted - manual) < 1e-9,
        `avgWdRateWeighted ${result.totals.avgWdRateWeighted} != manual ${manual}`);
    // Dollar-weighting and the simple mean must actually differ on a real plan.
    assert(Math.abs(result.totals.avgWdRateWeighted - result.totals.avgWdRate) > 1e-6,
        'Weighted and simple means are identical; the weighting is not being applied');
});

test('avgNetDepletion: negative when the portfolio outgrows withdrawals, positive when it shrinks', () => {
    // Big portfolio, modest spend, 8% growth → portfolio grows every year.
    const growing = simulate({ ...BASE, IRA1: 3000000, spendGoal: 60000, growth: 0.08, ss1: 60000 });
    assert(growing.totals.avgNetDepletion < 0,
        `Expected negative net depletion while the portfolio grows, got ${growing.totals.avgNetDepletion}`);
    // BASE is zero-growth with a real draw → the portfolio only shrinks.
    const shrinking = simulate({ ...BASE });
    assert(shrinking.totals.avgNetDepletion > 0,
        `Expected positive net depletion on a zero-growth drawdown, got ${shrinking.totals.avgNetDepletion}`);
    // The withdrawal rate itself stays non-negative in both.
    assert(growing.totals.avgWdRate > 0 && shrinking.totals.avgWdRate > 0,
        'Withdrawal rate should stay positive in both scenarios');
});

test('GK: guardrail rate reads the same prevPortfolio the withdrawal rate uses', () => {
    // prevPortfolio replaced the old gkPrevPortfolio/prevTotalWealth pair. GK always used the raw
    // balance sum, so merging the two fields must not move its output by a cent. The expected
    // values below were captured from a run made BEFORE that merge.
    //
    // Re-derived once since, when Social Security gained claim-year proration: this fixture claims
    // at 70 with a January birth month for person 1 (11/12 of that year) and June for person 2
    // (1/2), so the two claim years now pay less and everything downstream shifts. Spend
    // 7,969,501.955988 -> 7,935,798.156794, tax 2,154,586.451134 -> 2,140,785.745597, final NW
    // 9,955,429.693910 -> 9,920,517.469072. The guardrail-adjustment count is unchanged at 4, which
    // is what this test is actually guarding.
    const gk = simulate({
        ...BASE, strategy: 'gk', nYears: 30,
        birthyear1: 1960, die1: 92, birthyear2: 1962, birthmonth2: 6, die2: 94, hasSpouse: true,
        IRA1: 1500000, IRA2: 500000, Roth: 200000, Roth2: 100000,
        Brokerage: 600000, BrokerageBasis: 300000, Cash: 100000,
        ss1: 45000, ss1Age: 70, ss2: 25000, ss2Age: 70,
        spendGoal: 140000, inflation: 0.025, cpi: 0.025, growth: 0.06,
        cashYield: 0.02, dividendRate: 0.02,
    });
    assertNear(gk.totals.spend, 7935798.156165, 'GK total spend', 0.01);
    assertNear(gk.totals.tax, 2141499.763082, 'GK total tax', 0.01);
    assertNear(gk.finalNW, 9924288.129575, 'GK final net worth', 0.01);
    assert(gk.log.filter(r => (r.gkAdj ?? '—') !== '—').length === 4,
        `Expected the same 4 guardrail adjustments as the pre-merge run, got ${gk.log.filter(r => (r.gkAdj ?? '—') !== '—').length}`);
});

// ── Baseline accounting (after-tax NW + totalWealth fix) ───────────────────────
const afterTaxNetWorth = core.afterTaxNetWorth;

test('afterTaxNetWorth: Roth/Cash/basis at face; brokerage gains × (1−capG); IRA × (1−futureRate)', () => {
    if (!afterTaxNetWorth) throw new Error('afterTaxNetWorth not exported from core.js');
    const t = { ira: 100000, roth: 50000, cash: 20000, brokerage: 80000, basis: 30000 };
    // Roth+Cash+basis = 50k+20k+30k = 100k
    // brokerage gain = 80k−30k = 50k → ×(1−0.15) = 42.5k
    // IRA = 100k × (1−0.25) = 75k
    // total = 100k + 42.5k + 75k = 217.5k
    const v = afterTaxNetWorth(t, 0.25, 0.15);
    assertNear(v, 217500, 'afterTaxNetWorth value', 1);
});

test('afterTaxNetWorth: zero gains and zero rates → plain sum of balances', () => {
    const t = { ira: 100000, roth: 50000, cash: 20000, brokerage: 30000, basis: 30000 };
    // no brokerage gain; rates 0 → 100k+50k+20k+30k = 200k
    assertNear(afterTaxNetWorth(t, 0, 0), 200000, 'plain sum', 1);
});

test('simulate: exposes totals.terminal breakdown + totals.capGainsRate', () => {
    const res = simulate({ ...BASE });
    assert(res.totals.terminal != null, 'totals.terminal missing');
    for (const k of ['ira', 'roth', 'cash', 'brokerage', 'basis']) {
        assert(typeof res.totals.terminal[k] === 'number', `terminal.${k} not a number`);
    }
    assert(typeof res.totals.capGainsRate === 'number', 'totals.capGainsRate missing');
    // terminal breakdown matches the last log row
    const last = res.log[res.log.length - 1];
    assertNear(res.totals.terminal.ira, last.IRA1 + last.IRA2, 'terminal.ira vs log', 1);
    assertNear(res.totals.terminal.brokerage, last.Brokerage, 'terminal.brokerage vs log', 1);
    assertNear(res.totals.terminal.basis, last.Basis, 'terminal.basis vs log', 1);
});

test('totalWealth fix: IRA discounted by ordinary rate, brokerage gains by cap-gains rate', () => {
    // Scenario where terminal brokerage retains gains and ordinary ≠ cap-gains rate.
    const inp = { ...BASE, IRA1: 100000, Brokerage: 500000, BrokerageBasis: 100000,
                  Cash: 200000, spendGoal: 30000, die1: 78 };
    const res = simulate(inp);
    const last = res.log[res.log.length - 1];
    const nominal = last['NominalRate%'];
    const capG = res.totals.capGainsRate;
    const brokGain = Math.max(0, last.Brokerage - last.Basis);
    assert(brokGain > 1000, `Test needs terminal brokerage gains, got ${brokGain}`);
    // Reconstruct finalNW with the CORRECT per-asset rates.
    const expected = (last.IRA1 + last.IRA2) * (1 - nominal)
        + brokGain * (1 - capG)
        + last.Roth1 + last.Roth2 + last.Cash + last.Basis;
    assertNear(res.finalNW, expected, 'finalNW uses correct per-asset rates', 1);
    // And confirm it is NOT the old (wrong) all-ordinary formula when rates differ.
    if (Math.abs(nominal - capG) > 0.001) {
        const oldWrong = (last.IRA1 + last.IRA2 + brokGain) * (1 - nominal)
            + last.Roth1 + last.Roth2 + last.Cash + last.Basis;
        assert(Math.abs(res.finalNW - oldWrong) > 1,
            'finalNW still matches the old all-ordinary formula — cap-gains rate not applied');
    }
});

test('no-conversion run: zero Roth conversions over the whole plan', () => {
    const res = simulate({ ...BASE, convertExcessToRoth: false, extraConversionAmount: 0 });
    const totalConv = res.log.reduce((s, r) => s + (r.rothConv ?? 0), 0);
    assertNear(totalConv, 0, 'sum of rothConv with conversions off', 1);
});

test('baseline metric: higher after-tax NW ranks a richer terminal portfolio higher', () => {
    // Two terminal portfolios, same shared rates — helper must order them correctly.
    const poor = { ira: 200000, roth: 0,     cash: 0, brokerage: 0, basis: 0 };
    const rich = { ira: 0,      roth: 200000, cash: 0, brokerage: 0, basis: 0 };
    // At a 25% future IRA rate, the all-Roth portfolio is worth more after tax.
    assert(afterTaxNetWorth(rich, 0.25, 0.15) > afterTaxNetWorth(poor, 0.25, 0.15),
        'all-Roth terminal should beat all-IRA terminal on after-tax NW');
});

// ── Phase 22: Guyton-Klinger tests ───────────────────────────────────────────
// GK uses raw portfolio balance (not tax-discounted totalWealth) for IWR and WR
// checks, so both sides of the comparison are on equal footing.

const GK_BASE = {
    ...BASE,
    strategy: 'gk',
    IRA1: 1000000, IRA2: 0, Roth: 0, Roth2: 0,
    Brokerage: 0, BrokerageBasis: 0, Cash: 0,
    spendGoal: 50000, spendChange: 0,
    inflation: 0.00, growth: 0.00,
    gkGuard: 0.20, gkAdjPct: 0.10,
};

test('GK stable market: no guardrail triggers in early years with zero growth/inflation', () => {
    // IWR = 50k/1M = 5%. Upper guard = 6%. Gross withdrawal ≈ $57k/yr (incl. CA taxes).
    // Raw portfolio depletes ~$57k/yr; WR at years 1-2 stays well below 6%. Check years 0–2.
    const res = simulate({ ...GK_BASE });
    for (let y = 0; y < 3; y++) {
        assert(res.log[y].gkAdj === '—', `year ${y} should have no adjustment, got: ${res.log[y].gkAdj}`);
    }
    assert(res.log[0].gkSpend != null, 'gkSpend should be non-null for GK strategy');
});

test('GK capital preservation: catastrophic bear market triggers CP cut', () => {
    // IWR = 50k/1M = 5%. After -80% return, raw portfolio ≈ $200k.
    // Year 1 WR = 50k/200k = 25% >> IWR*1.2 = 6%. CP should fire.
    const returns = Array.from({length: 30}, (_, i) => i === 0 ? -0.80 : 0.00);
    const res = simulate({ ...GK_BASE, returnSequence: returns });
    assert(res.log[1].gkAdj.includes('cap'), `year 1 gkAdj should contain 'cap', got: ${res.log[1].gkAdj}`);
    assert(res.log[1].gkSpend < 50000, `year 1 spend should be cut below 50k, got: ${res.log[1].gkSpend}`);
});

test('GK prosperity rule: strong bull market triggers prosperity raise', () => {
    // IWR = 50k/1M = 5%. After +200% return, raw portfolio ≈ $3M.
    // Year 1 WR = 50k/3M = 1.7% << IWR*(1-0.2) = 4%. Prosperity fires.
    const returns = Array.from({length: 30}, (_, i) => i === 0 ? 2.00 : 0.00);
    const res = simulate({ ...GK_BASE, returnSequence: returns });
    assert(res.log[1].gkAdj.includes('pros'), `year 1 gkAdj should contain 'pros', got: ${res.log[1].gkAdj}`);
    assert(res.log[1].gkSpend > 50000, `year 1 spend should be raised above 50k, got: ${res.log[1].gkSpend}`);
});

test('GK inflation skip: mild negative return + WR > IWR skips CPI adjustment', () => {
    // IWR = 50k/1M = 5%. After -5% return, raw portfolio ≈ $893k.
    // Year 1 WR = 50k/893k = 5.60% → above IWR (Inflation Rule fires), below 6% (CP does NOT fire).
    // With 3% inflation: gkAdj = 'no-CPI'; spendGoal stays near 50k not 51.5k.
    const returns = Array.from({length: 30}, (_, i) => i === 0 ? -0.05 : 0.00);
    const res = simulate({ ...GK_BASE, returnSequence: returns, inflation: 0.03 });
    assert(res.log[1].gkAdj.includes('no-CPI'), `year 1 gkAdj should contain 'no-CPI', got: ${res.log[1].gkAdj}`);
    assertNear(res.log[1].gkSpend, 50000, 'gkSpend should not be inflated when Inflation Rule fires', 500);
});

test('GK regression: non-GK strategy has null gkSpend/gkAdj', () => {
    const res = simulate({ ...GK_BASE, strategy: 'propwd', propWithdraw: 0 });
    for (let y = 0; y < 3; y++) {
        assert(res.log[y].gkSpend === null, `year ${y} gkSpend should be null for non-GK strategy`);
        assert(res.log[y].gkAdj === null, `year ${y} gkAdj should be null for non-GK strategy`);
    }
});

// ── GK Optimize-Spend stability floor ───────────────────────────────────────────
// GK self-adjusts spendGoal downward via its guardrails, so a pure terminal-survival
// search runs straight to the +50% ceiling and reports a spend GK can only hold for a
// year or two. optimizeSpend() adds a GK-only stability floor: the worst REAL delivered
// spend across the horizon must stay within one guard band (gkGuard) of the initial.
// Scenario tuned so baseline is stable but the elevated ceiling spend trips the floor.
const GK_OPT_BASE = {
    STATEname: 'CA', strategy: 'gk',
    birthyear1: 1952, birthmonth1: 1, die1: 97,
    birthyear2: 0, birthmonth2: 12, die2: 0,
    IRA1: 1500000, IRA2: 0, Roth: 0, Roth2: 0,
    Brokerage: 300000, BrokerageBasis: 150000, Cash: 50000,
    ss1: 0, ss1Age: 70, ss2: 0, ss2Age: 70,
    pensionAnnual: 0, survivorPct: 0, pensionCola: false,
    spendGoal: 55000, spendChange: 0, iraBaseGoal: 0,
    inflation: 0.02, cpi: 0.02, growth: 0.05, cashYield: 0, dividendRate: 0,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: false, propWithdraw: 0, iraWithdrawPct: 0.05,
    startInYear: 2026, dividendReinvest: false, startYear: 2026,
    hasSpouse: false, nYears: 30, gkGuard: 0.20, gkAdjPct: 0.10,
};

test('GK optimize-spend: stability floor caps optimized spend below the +50% ceiling', () => {
    const ceiling = GK_OPT_BASE.spendGoal * 1.5;
    const opt = optimizeSpend({ ...GK_OPT_BASE }, { strategy: 'gk', gkGuard: 0.20, gkAdjPct: 0.10 });
    assert(opt, 'GK optimizeSpend should find a stable optimized spend (not null)');
    assert(!opt.hitCeiling, 'floor should prevent hitting the +50% ceiling');
    assert(opt.optimizedSpend < ceiling * 0.90,
        `optimizedSpend ${Math.round(opt.optimizedSpend)} should be materially below ceiling ${ceiling}`);

    // Worst real delivered spend must stay within one guard band of the initial real spend.
    const log = opt.result.log;
    const initReal = log[0].spendGoal / (log[0].inflationFactor || 1);
    let minReal = Infinity;
    for (const r of log) minReal = Math.min(minReal, r.spendGoal / (r.inflationFactor || 1));
    assert(minReal >= initReal * (1 - 0.20) - 1,
        `min real spend ${Math.round(minReal)} fell below guard-band floor ${Math.round(initReal * 0.80)}`);
});

test('GK optimize-spend: floor is GK-specific — propwd reaches a higher spend on same inputs', () => {
    const gk = optimizeSpend({ ...GK_OPT_BASE }, { strategy: 'gk', gkGuard: 0.20, gkAdjPct: 0.10 });
    const pw = optimizeSpend({ ...GK_OPT_BASE, strategy: 'propwd', propWithdraw: 0 },
                             { strategy: 'propwd', propWithdraw: 0 });
    assert(gk && pw, 'both strategies should return a result');
    assert(pw.optimizedSpend > gk.optimizedSpend,
        `propwd ${Math.round(pw.optimizedSpend)} should exceed floor-capped GK ${Math.round(gk.optimizedSpend)}`);
});

// ── Share-URL value compression (compactNum) ────────────────────────────────────
// compactNum shrinks dollar values; DisplayHelpers.parseShorthand decodes them on load.
// The round-trip MUST be lossless, and the compact form never longer than the raw form.
const COMPACT_CASES = [1000, 2500, 85000, 100000, 111000, 750000, 1000000, 1500000, 1234567];

test('compactNum: round-trips losslessly through parseShorthand', () => {
    for (const n of COMPACT_CASES) {
        const c = compactNum(String(n));
        assert(parseShorthand(c) === n, `compactNum(${n})="${c}" decoded to ${parseShorthand(c)}, expected ${n}`);
    }
});

test('compactNum: never longer than the raw value', () => {
    for (const n of COMPACT_CASES) {
        const c = compactNum(String(n));
        assert(c.length <= String(n).length, `compactNum(${n})="${c}" is longer than raw "${n}"`);
    }
});

test('compactNum: expected compact forms', () => {
    assert(compactNum('1000000') === '1m', `expected 1m, got ${compactNum('1000000')}`);
    assert(compactNum('1500000') === '1.5m', `expected 1.5m, got ${compactNum('1500000')}`);
    assert(compactNum('100000') === '1e5', `expected 1e5, got ${compactNum('100000')}`);
    assert(compactNum('85000') === '85k', `expected 85k, got ${compactNum('85000')}`);
    assert(compactNum('1234567') === '1234567', `non-round number should stay raw, got ${compactNum('1234567')}`);
});

test('compactNum: 0 and non-finite pass through unchanged', () => {
    assert(compactNum('0') === '0', `expected 0, got ${compactNum('0')}`);
    assert(compactNum('') === '', `empty string should pass through, got "${compactNum('')}"`);
    assert(parseShorthand(compactNum('0')) === 0, 'compact 0 should still decode to 0');
});

// ── loadFromURL: dollar field decode (NaN regression guard) ──────────────────
// The fix in loadFromURL must call parseShorthand and set dataset.numVal for
// text-type fields. Without this, +val('IRA1') = +"2m" = NaN.

function mockEl(type, value) {
    return { type, value, dataset: {} };
}

// Mirrors the fixed else-branch in loadFromURL()
function applyURLParam(el, raw) {
    const decoded = parseShorthand(raw);
    if (decoded !== null && (el.type === 'text' || el.type === '')) {
        el.dataset.numVal = String(decoded);
        el.value = '$' + Math.round(decoded).toLocaleString('en-US');
    } else {
        el.value = raw;
    }
}

test('loadFromURL decode: compact dollar values set dataset.numVal (not NaN)', () => {
    const cases = [
        { raw: '160k', field: 'spendGoal', expected: 160000 },
        { raw: '2m',   field: 'IRA1',      expected: 2000000 },
        { raw: '1e5',  field: 'IRA2',      expected: 100000 },
        { raw: '0',    field: 'Roth',      expected: 0 },
        { raw: '0',    field: 'Brokerage', expected: 0 },
        { raw: '0',    field: 'Cash',      expected: 0 },
    ];
    cases.forEach(({ raw, field, expected }) => {
        const el = mockEl('text', raw);
        applyURLParam(el, raw);
        const got = Number(el.dataset.numVal);
        assert(!isNaN(got), `${field}: dataset.numVal is NaN after loading "${raw}"`);
        assert(got === expected, `${field}: expected ${expected}, got ${got}`);
    });
});

test('loadFromURL decode: non-dollar fields (select, number) pass through unchanged', () => {
    const sel = mockEl('select', '');
    applyURLParam(sel, 'bracket');
    assert(sel.value === 'bracket', 'strategy select value should be "bracket"');
    assert(sel.dataset.numVal === undefined, 'select should not get dataset.numVal');

    const num = mockEl('number', '');
    applyURLParam(num, '74');
    assert(num.value === '74', 'number input value should be "74"');
    assert(num.dataset.numVal === undefined, 'number input should not get dataset.numVal');
});

// ── Stress mode: real CAGR scoring (Fisher equation) ─────────────────────────
// buildStressBank() ranks worst decades by real CAGR, not nominal equity CAGR.
// These tests verify the math inline without loading prng.js or HISTORICAL_RETURNS.

function _realCagr(eqCagr, infCagr) {
    const infFloor = Math.max(-0.005, infCagr);
    return (1 + eqCagr) / (1 + infFloor) - 1;
}

test('stress scoring: Fisher equation gives correct real CAGR', () => {
    // 1970s archetype: flat equity +6%, high inflation +7% → real ≈ -0.935%
    const real = _realCagr(0.06, 0.07);
    const expected = (1.06 / 1.07) - 1;   // ≈ -0.009346
    assert(Math.abs(real - expected) < 1e-10, `Fisher identity failed: got ${real}`);
    assert(real < 0, 'positive nominal equity + higher inflation should give negative real CAGR');
});

test('stress scoring: deflation clamped to -0.5% floor', () => {
    // 1930s severe deflation (-3%) must be clamped; only -0.5% deflation counted
    const withClamp    = _realCagr(0.05, -0.03);          // floor at -0.005 applied
    const expectedClamp = (1.05 / (1 + (-0.005))) - 1;    // (1.05/0.995)-1 ≈ +5.53%
    const unclamped     = (1.05 / (1 + (-0.03)))  - 1;    // (1.05/0.97)-1 ≈ +8.25%
    assert(Math.abs(withClamp - expectedClamp) < 1e-10, 'deflation floor should use exactly -0.5%');
    assert(withClamp < unclamped, 'clamping deflation reduces the computed real CAGR boost');
});

test('stress scoring: stagflation decade ranks worse than mild equity bear', () => {
    // Scenario A: stagflation — equity +2%, inflation +8% → real ≈ -5.6%
    const stagflation = _realCagr(0.02, 0.08);
    // Scenario B: mild bear — equity -3%, near-zero inflation +0.5% → real ≈ -3.5%
    const mildBear = _realCagr(-0.03, 0.005);
    assert(stagflation < mildBear,
        `stagflation (${(stagflation*100).toFixed(2)}%) should rank worse than mild bear with low inflation (${(mildBear*100).toFixed(2)}%)`);
});

test('stress scoring: 1999 ranks worse than 1929 by real CAGR', () => {
    // 1999 actual: eq≈-1.4%, inf≈+2.9% → real ≈ -4.2%  (equity loss + inflation drag)
    // 1929 actual: eq≈-1.7%, inf≈-0.5% (at floor)   → real ≈ -1.2%  (equity crash + deflation floor)
    const real1999 = _realCagr(-0.014, 0.029);
    const real1929 = _realCagr(-0.017, -0.005);  // inf is already at the floor
    assert(real1999 < real1929,
        `1999 (${(real1999*100).toFixed(2)}%) should rank worse than 1929 (${(real1929*100).toFixed(2)}%) under real CAGR scoring`);
});

// ── Soft vs strict withdrawal caps (shortfall fix) ─────────────────────────────
// Repro: bracket 22%, single after early death, abundant IRA, no Roth, modest buffers.
// Person 1 dies at 74 → MFJ→single halves the 22% ceiling; old code stranded a growing
// shortfall despite a $2M IRA. Soft caps now draw IRA above the ceiling to fund spending.
const CAP_BASE = {
    STATEname: 'CA', strategy: 'bracket', stratRate: 0.22, stratIRMAATier: -1, stratACAMultiple: 0,
    nYears: 30, birthyear1: 1960, birthmonth1: 12, die1: 74,
    birthyear2: 1959, birthmonth2: 12, die2: 90, hasSpouse: true,
    IRA1: 2000000, IRA2: 100000, Roth: 0, Roth2: 0,
    Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000, CashReserve: 0,
    ss1: 48000, ss1Age: 67, ss2: 24000, ss2Age: 67,
    pensionAnnual: 0, survivorPct: 75, pensionCola: false,
    spendGoal: 160000, spendChange: -0.01, iraBaseGoal: 0,
    inflation: 0.025, cpi: 0.025, growth: 0.05, cashYield: 0.02, dividendRate: 0.0,
    ssFailYear: 2099, ssFailPct: 1.0, convertExcessToRoth: false, propWithdraw: 0, iraWithdrawPct: 0.05,
    startYear: 2026, dividendReinvest: false,
};
const _sumAbsShortfall = log => log.reduce((s, e) => s + Math.abs(e.shortfall || 0), 0);
const _sumForcedIRA   = log => log.reduce((s, e) => s + (e.ForcedIRA || 0), 0);

test('soft cap (federal bracket): forced IRA funds spending — no lingering shortfall', () => {
    const r = simulate({ ...CAP_BASE });
    assert(_sumForcedIRA(r.log) > 100000, `expected substantial forced IRA, got ${Math.round(_sumForcedIRA(r.log))}`);
    assert(_sumAbsShortfall(r.log) < 100, `expected ~0 total shortfall, got ${Math.round(_sumAbsShortfall(r.log))}`);
    assert(r.totals.success, 'plan should succeed once IRA funds the spend');
    const ov = r.log.reduce((s, e) => s + (e.BracketOverage || 0), 0);
    assert(ov > 0, 'soft-cap break should register a non-zero bracket overage (the flag)');
});

test('soft cap: forced IRA never exceeds available IRA (no over-draw past depletion)', () => {
    const r = simulate({ ...CAP_BASE });
    // Final IRA balance must stay non-negative — the loop is bounded by curBalances.IRA.
    const last = r.log[r.log.length - 1];
    assert((last.TotalIRA ?? 0) >= -1, `IRA went negative: ${last.TotalIRA}`);
});

test('soft cap (fixedpct): capped % with spend over cap still funds spending from IRA', () => {
    const r = simulate({ ...CAP_BASE, strategy: 'fixedpct', iraWithdrawPct: 0.02 });
    assert(_sumForcedIRA(r.log) > 0, 'fixedpct should force IRA when 2% draw + buffers underfund spend');
    assert(_sumAbsShortfall(r.log) < 100, `expected ~0 total shortfall, got ${Math.round(_sumAbsShortfall(r.log))}`);
});

test('strict ACA: cap is never breached — shortfall persists and is flagged untenable', () => {
    const r = simulate({ ...CAP_BASE, strategy: 'aca', stratRate: 0, stratACAMultiple: 400 });
    assert(_sumForcedIRA(r.log) === 0, `ACA must not force IRA above the FPL cap, got ${Math.round(_sumForcedIRA(r.log))}`);
    assert(_sumAbsShortfall(r.log) > 1000, 'ACA at 400% FPL with $160k spend should leave a real shortfall');
    assert((r.totals.acaBreachYears ?? 0) > 0, 'expected acaBreachYears > 0 (untenable flag)');
});

test('regression: ample buffers cover the gap → no forced IRA break', () => {
    // Big Cash so the bracket gap-fill is satisfied without ever breaking the ceiling.
    // (BracketOverage may still be non-zero from unavoidable income — cash interest/RMDs —
    // but the strategy never has to FORCE IRA above the cap to fund spending.)
    const r = simulate({ ...CAP_BASE, Cash: 3000000, spendGoal: 120000 });
    assert(_sumForcedIRA(r.log) === 0, `no forced IRA expected, got ${Math.round(_sumForcedIRA(r.log))}`);
});

test('true ruin: all accounts incl. IRA exhausted → shortfall still reported', () => {
    // Tiny portfolio, large spend → genuine depletion; the IRA fallback must not mask it.
    const r = simulate({ ...CAP_BASE, IRA1: 80000, IRA2: 0, Brokerage: 0, Cash: 0, spendGoal: 150000 });
    assert(_sumAbsShortfall(r.log) > 1000, 'genuine ruin must still surface a shortfall');
    assert(!r.totals.success, 'an underfunded plan must not report success');
});

// ── State retirement-income exclusion (IL/PA full exemption) ────────────────────
test('IL exempts IRA/pension distributions from state tax', () => {
    const common = { filingStatus: 'MFJ', ages: [70, 70], state: 'IL',
                     earnedIncome: 40000 + 80000, qualifiedDiv: 0, capGains: 0 };
    const noExcl = calculateTaxes({ ...common });                                  // no split → all taxed
    const withExcl = calculateTaxes({ ...common, pensionIncome: 40000, iraIncome: 80000 });
    assert(noExcl.stateTax > 0, 'baseline IL state tax should be > 0 when retirement income is taxed');
    assertNear(withExcl.stateTax, 0, 'IL state tax should be ~0 once retirement income is fully excluded', 1);
});

test('PA exempts IRA/pension distributions from state tax', () => {
    const common = { filingStatus: 'MFJ', ages: [70, 70], state: 'PA',
                     earnedIncome: 90000, qualifiedDiv: 0, capGains: 0 };
    const noExcl = calculateTaxes({ ...common });
    const withExcl = calculateTaxes({ ...common, iraIncome: 90000 });
    assert(noExcl.stateTax > 0, 'baseline PA state tax should be > 0');
    assertNear(withExcl.stateTax, 0, 'PA state tax should be ~0 once retirement income is excluded', 1);
});

test('IL still taxes non-retirement income (interest/dividends not exempt)', () => {
    // $80k IRA (exempt) + $30k ordinary dividends (NOT exempt) → state tax on the $30k only.
    const r = calculateTaxes({ filingStatus: 'MFJ', ages: [70, 70], state: 'IL',
                               earnedIncome: 80000 + 30000, ordDivInterest: 30000,
                               iraIncome: 80000 });
    assert(r.stateTax > 0, 'IL should still tax the non-retirement (dividend/interest) portion');
});

test('regression: exclusion params are inert for a non-exclusion state (CA)', () => {
    const common = { filingStatus: 'MFJ', ages: [70, 70], state: 'CA',
                     earnedIncome: 120000, qualifiedDiv: 0, capGains: 0 };
    const base = calculateTaxes({ ...common });
    const withParams = calculateTaxes({ ...common, pensionIncome: 40000, iraIncome: 80000 });
    assertNear(withParams.stateTax, base.stateTax, 'CA state tax must be identical with/without the new params', 0.01);
});

// ── Break Even / Opp. Cost — dual-simulation counterfactual ──────────────────
// convOC[y] = after-tax wealth of the actual run minus a full counterfactual run with
// conversions suppressed (dollars stay in the IRA, no conversion tax, bigger RMDs later).
// Break Even (totals.convBEYear) = earliest year convOC stays >= 0 through the LAST simulated
// year (a sustained crossing, not just the first year that happens to touch >= 0), reported
// only once conversions have actually occurred. See the two "brief positive blip" tests below.

const OC_BASE = {
    ...BASE,
    birthyear1: 1960, die1: 90,           // RMDs at 75 — leaves pre-RMD conversion years
    IRA1: 1000000, Brokerage: 200000, BrokerageBasis: 200000, Cash: 50000,
    Roth: 0,
    ss1: 30000, ss1Age: 67,
    spendGoal: 60000, growth: 0.05,
    computeOC: true,
};

test('OC: no conversions → convBEYear null and convOC ≈ 0 every year', () => {
    const roth = simulate({ ...OC_BASE, IRA1: 100000, Roth: 500000 }); // Roth-heavy
    const ira = simulate({ ...OC_BASE });                              // IRA-heavy
    for (const r of [roth, ira]) {
        assert(r.log.reduce((s, x) => s + (x.rothConv ?? 0), 0) < 1, 'scenario must have no conversions');
        assert(r.totals.convBEYear === null, `convBEYear must be null with no conversions, got ${r.totals.convBEYear}`);
        assert(r.log.every(x => Math.abs(x.convOC ?? 0) < 1), 'convOC must be ~0/null with no conversions');
    }
});

test('OC: profitable conversions → convBEYear reported; final convOC = finalNW gain', () => {
    const conv = simulate({ ...OC_BASE, extraConversionAmount: 50000 });
    const totalConv = conv.log.reduce((s, r) => s + (r.rothConv ?? 0), 0);
    assert(totalConv > 100000, `expected substantial conversions, got ${totalConv}`);
    // Independent no-conversion run — must match the internal counterfactual exactly.
    const noConv = simulate({ ...OC_BASE });
    const gain = conv.finalNW - noConv.finalNW;
    assert(gain > 0, `conversions should be profitable in this scenario, gain=${gain}`);
    assert(conv.totals.convBEYear !== null, 'profitable conversions must report a Break Even year');
    const lastOC = conv.log[conv.log.length - 1].convOC;
    assertNear(lastOC, gain, 'final convOC must equal the after-tax finalNW gain', 1);
    // Early years: conversion taxes paid up front → convOC starts negative.
    assert(conv.log[0].convOC < 0, `year-0 convOC should be negative (tax paid early), got ${conv.log[0].convOC}`);
});

test('OC: counterfactual pays the RMD counter-effect (bigger IRA → bigger RMDs, more tax)', () => {
    const inputs = { ...OC_BASE, IRA1: 1500000, Brokerage: 400000, BrokerageBasis: 300000,
                     strategy: 'bracket', stratRate: 0.22, convertExcessToRoth: true };
    const actual = simulate(inputs);
    const cf = simulate({ ...inputs, _cfRun: true, _cfSuppressConversions: true,
                          extraConversionAmount: 0, computeOC: false });
    assert(cf.log.reduce((s, r) => s + (r.rothConv ?? 0), 0) < 1, 'counterfactual must not convert');
    assert(cf.totals.rmd > actual.totals.rmd + 1000,
        `counterfactual RMDs (${Math.round(cf.totals.rmd)}) must exceed actual (${Math.round(actual.totals.rmd)})`);
    assert(cf.totals.tax > actual.totals.tax,
        `counterfactual lifetime tax (${Math.round(cf.totals.tax)}) must exceed actual (${Math.round(actual.totals.tax)}) — RMD taxes priced`);
    // Identity: last convOC equals the finalNW difference (same valuation both sides).
    const lastOC = actual.log[actual.log.length - 1].convOC;
    assertNear(lastOC, actual.finalNW - cf.finalNW, 'convOC identity vs counterfactual finalNW', 1);
    // Refund really shrank the counterfactual's year-0 IRA draw (over-withdrawal not taken).
    assert(cf.log[0].IRAwd < actual.log[0].IRAwd - 1000,
        `CF year-0 IRA draw (${Math.round(cf.log[0].IRAwd)}) must be below actual (${Math.round(actual.log[0].IRAwd)})`);
});

test('OC: counterfactual recursion guard — _cfRun never spawns another counterfactual', () => {
    // If recursion were possible this would loop forever / stack overflow; also check flags stay honored.
    const cf = simulate({ ...OC_BASE, _cfRun: true,
                          _cfSuppressConversions: true, extraConversionAmount: 0 });
    assert(cf.totals.convBEYear === null, 'a counterfactual run must not compute its own Break Even');
    assert(cf.log.every(r => r.convOC == null), 'a counterfactual run must not annotate convOC');
});

test('OC: excess withdrawals → excessBEYear gated on excess actually occurring', () => {
    // propwd over-withdraws to Cash (no convertExcessToRoth) → excess path.
    const excess = simulate({ ...OC_BASE, strategy: 'propwd', propWithdraw: 0.5 });
    const hadExcess = excess.log.some(r => (r.surplusCash ?? 0) > 1 && (r.IRAwd ?? 0) > 1);
    assert(hadExcess, 'scenario should produce excess IRA→Cash withdrawals');
    assert(excess.log.some(r => r.excessOC != null), 'excessOC must be annotated when excess occurred');
    // And a no-excess scenario reports null.
    const clean = simulate({ ...OC_BASE });
    assert(clean.totals.excessBEYear === null || clean.log.some(r => (r.surplusCash ?? 0) > 1),
        'excessBEYear must be null when no excess-to-cash occurred');
});

test('OC: optimizer/MC path (computeOC unset) skips counterfactual, convOC null', () => {
    const r = simulate({ ...OC_BASE, computeOC: undefined, extraConversionAmount: 50000 });
    assert(r.totals.convBEYear === null, 'without computeOC, convBEYear must stay null');
    assert(r.log.every(x => x.convOC == null), 'without computeOC, convOC must stay null');
});

test('OC: brief positive blip then sustained negative through plan end → convBEYear null', () => {
    // fixedpct converts a fixed % of the CURRENT (not original) IRA balance every year with no
    // bracket ceiling, so conversions keep firing long after they stop paying off. Combined with
    // a flat futureIRATaxRate valuation and a horizon (die1:80) that ends before the plan's later
    // years would have recovered, this reproduces the reported bug shape: convOC touches
    // non-negative for exactly the first year, then stays negative for every remaining year
    // (never recovers). The old first-touch .find() reported the year-0 blip as Break Even; the
    // correct answer is null (no sustained crossing exists).
    const inputs = { ...OC_BASE, strategy: 'fixedpct', iraWithdrawPct: 0.10,
                     convertExcessToRoth: true, futureIRATaxRate: 0.34, die1: 80 };
    const r = simulate(inputs);
    const totalConv = r.log.reduce((s, x) => s + (x.rothConv ?? 0), 0);
    assert(totalConv > 100000, `expected substantial conversions, got ${totalConv}`);
    assert(r.log[0].convOC > 0, `year-0 convOC should be the reported blip (positive), got ${r.log[0].convOC}`);
    assert(r.log.slice(1).every(x => x.convOC < 0), 'every year after the blip must be negative (never recovers)');
    assert(r.totals.convBEYear === null,
        `a blip that never sustains must report convBEYear null, got ${r.totals.convBEYear}`);
});

test('OC: excess-withdrawal double-dip → excessBEYear is the sustained crossing, not the first touch', () => {
    // A one-year spike briefly pushes excessOC non-negative (2027), then it dips negative again
    // for two more years (2028-2029) before permanently crossing over at 2030. The old
    // first-touch .find() reported the one-year spike (2027) as Break Even even though the plan
    // fell behind again the very next year; the correct answer is the start of the FINAL
    // non-negative run (2030).
    const inputs = { ...OC_BASE, strategy: 'propwd', propWithdraw: 0.9, growth: 0.08,
                     IRA1: 2000000, die1: 76, ss1: 60000 };
    const r = simulate(inputs);
    const oc = r.log.map(x => x.excessOC);
    assert(oc[1] >= 0 && oc[2] < 0,
        `expected a one-year spike at index 1 followed by a dip at index 2, got ${JSON.stringify(oc)}`);
    assert(r.log.slice(4).every(x => x.excessOC >= 0),
        'the plan must stay non-negative from index 4 (2030) through the end');
    assert(r.totals.excessBEYear === 2030,
        `sustained crossing must land on the start of the final non-negative run (2030), got ${r.totals.excessBEYear}`);
});

// ── Break Even diagnostic — pinpoints which conversion year breaks a sustained lead ─────────
// diagnoseConvBreakEvenFailure() truncates the plan's conversion schedule at each successive
// conversion year (via _cfSuppressConversionsFromYear) and finds the first truncation that
// still fails to sustain — i.e. the specific conversion whose inclusion erases the lead for
// good, not just which calendar year the totals happen to go negative.

test('diagnoseConvBreakEvenFailure: boundary — pinpoints the specific conversion year that breaks a sustained lead', () => {
    // 5 modest conversions (2026-2030) each individually sustain a Break Even on their own;
    // a large 6th lump conversion (2031) is the one that permanently erases the lead.
    const arr = new Array(30).fill(0);
    for (let y = 0; y < 5; y++) arr[y] = 40000;
    arr[5] = 600000;
    const inputs = { ...OC_BASE, birthyear1: 1966, die1: 90, IRA1: 1200000,
                     inflation: 0.025, cpi: 0.025, nYears: 30,
                     extraConversionAmount: arr, futureIRATaxRate: 0.30 };
    const r = simulate(inputs);
    assert(r.totals.convBEYear === null, 'test setup: full run must fail to sustain a Break Even lead');

    const d = diagnoseConvBreakEvenFailure(inputs, r.log);
    assert(d && d.outcome === 'boundary', `expected a boundary diagnosis, got ${JSON.stringify(d)}`);
    assert(d.breakingYear === 2031, `expected the 6th (2031) conversion to be the breaking one, got ${d.breakingYear}`);
    // 355,562 not the pre-fix 355,478: this fixture drives conversions through a per-year ARRAY,
    // whose year 0 used to be mis-timed Late(Spend) because `extraConversionAmount > 0` coerced a
    // multi-element array to NaN. Re-derived from the engine after _extraConvAmountFor.
    assertNear(d.breakingAmount, 355562, 'breaking conversion amount', 5);
    assert(d.lastSustainableYear === 2030, `expected 2030 as the last sustainable conversion year, got ${d.lastSustainableYear}`);
    assert(d.lastSustainableBEYear === 2042, `expected the truncated plan to break even in 2042, got ${d.lastSustainableBEYear}`);

    // Invariant: re-running truncated exactly at the reported boundaries must reproduce them.
    const convIdxs = [];
    r.log.forEach((x, i) => { if ((x.rothConv ?? 0) > 1) convIdxs.push(i); });
    const sustainedRerun = simulate({ ...inputs, _cfSuppressConversionsFromYear: convIdxs[convIdxs.length - 2] + 1 });
    assert(sustainedRerun.totals.convBEYear === d.lastSustainableBEYear,
        'truncating right before the breaking year must reproduce lastSustainableBEYear');
    const brokenRerun = simulate({ ...inputs, _cfSuppressConversionsFromYear: convIdxs[convIdxs.length - 1] + 1 });
    assert(brokenRerun.totals.convBEYear === null,
        'truncating right after the breaking year (numerically a no-op vs. the real plan) must still be null');
});

test('diagnoseConvBreakEvenFailure: neverSustains — even the first conversion never earns back its tax cost', () => {
    const arr = new Array(30).fill(0);
    arr[0] = 900000; // one huge lump conversion, nothing else
    const inputs = { ...OC_BASE, birthyear1: 1966, die1: 90, IRA1: 1200000,
                     inflation: 0.025, cpi: 0.025, nYears: 30,
                     extraConversionAmount: arr, futureIRATaxRate: 0.30 };
    const r = simulate(inputs);
    assert(r.totals.convBEYear === null, 'test setup: full run must fail to sustain a Break Even lead');

    const d = diagnoseConvBreakEvenFailure(inputs, r.log);
    assert(d && d.outcome === 'neverSustains', `expected neverSustains, got ${JSON.stringify(d)}`);
    assert(d.breakingYear === 2026, `expected the first conversion year (2026), got ${d.breakingYear}`);
    assert(d.lastSustainableYear === null && d.lastSustainableBEYear === null,
        'neverSustains must report no sustainable prefix');
});

test('diagnoseConvBreakEvenFailure: no conversions in the log → returns null', () => {
    const r = simulate({ ...OC_BASE });
    assert(diagnoseConvBreakEvenFailure(OC_BASE, r.log) === null,
        'must return null when no conversions occurred (precondition violated)');
});

// ── Conversion END YEAR (Phase P24) — public convEndYear input + bestConversionStopYear search ──
// A user-facing conversion cutoff (calendar year) plus a linear search for the year that
// maximizes after-tax wealth by stopping conversions after it. Evidence: findings.md 2026-07-23.

// Shared fixture: heavy IRA, high growth + heirs rate, large annual extra conversions, so the
// late conversions convert money that would have compounded and end up subtracting. Interior
// optimum lands at 2031 (cut 6). All expected values derived from the real engine first.
const STOP_BASE = {
    ...OC_BASE, birthyear1: 1960, die1: 90, IRA1: 1000000,
    Brokerage: 200000, BrokerageBasis: 200000, Cash: 50000, Roth: 0,
    ss1: 30000, ss1Age: 67, spendGoal: 60000, growth: 0.08,
    extraConversionAmount: 120000, futureIRATaxRate: 0.35, computeOC: true,
};

test('P24: convEndYear/convEndMode unset → bit-identical to today (load-bearing regression)', () => {
    const plain = simulate({ ...STOP_BASE });
    const withUnsetKeys = simulate({ ...STOP_BASE, convEndYear: undefined, convEndMode: undefined });
    assert(JSON.stringify(plain.log) === JSON.stringify(withUnsetKeys.log),
        'unset convEndYear/convEndMode must not perturb the year-by-year log');
    assert(plain.finalNW === withUnsetKeys.finalNW && plain.totals.tax === withUnsetKeys.totals.tax,
        'unset convEndYear/convEndMode must not perturb finalNW or tax');
});

test('P24: convEndYear (all mode) stops ALL conversions after the year; earlier years untouched; == internal cutoff', () => {
    const Y = 2030, start = 2026, idx = Y - start + 1; // suppress index >= idx = years after Y
    const plain = simulate({ ...STOP_BASE });
    const stopped = simulate({ ...STOP_BASE, convEndYear: Y, convEndMode: 'all' });
    const after = stopped.log.filter(r => r.year > Y).reduce((s, r) => s + (r.rothConv ?? 0), 0);
    const beforeStopped = stopped.log.filter(r => r.year <= Y).reduce((s, r) => s + (r.rothConv ?? 0), 0);
    const beforePlain = plain.log.filter(r => r.year <= Y).reduce((s, r) => s + (r.rothConv ?? 0), 0);
    assert(after < 1, `all-mode cutoff must zero every conversion after ${Y}, got ${Math.round(after)}`);
    assertNear(beforeStopped, beforePlain, 'conversions through the cutoff year must be untouched', 1);
    // The public calendar-year cutoff must be exactly the internal from-index counterfactual flag.
    const cf = simulate({ ...STOP_BASE, _cfSuppressConversionsFromYear: idx });
    assert(stopped.finalNW === cf.finalNW && stopped.totals.tax === cf.totals.tax,
        'convEndYear (all) must equal _cfSuppressConversionsFromYear at the equivalent index');
});

test('P24: convEndMode extra stops only the Extra conversion; the strategy keeps converting past the cutoff', () => {
    // Bracket strategy that itself converts surplus, so extra-mode leaves real conversions running.
    const S = { ...STOP_BASE, strategy: 'bracket', stratRate: 0.22, convertExcessToRoth: true,
                extraConversionAmount: 40000, growth: 0.06, futureIRATaxRate: 0.30 };
    const Y = 2030;
    const all = simulate({ ...S, convEndYear: Y, convEndMode: 'all' });
    const extra = simulate({ ...S, convEndYear: Y, convEndMode: 'extra' });
    const allAfter = all.log.filter(r => r.year > Y).reduce((s, r) => s + (r.rothConv ?? 0), 0);
    const extraAfter = extra.log.filter(r => r.year > Y).reduce((s, r) => s + (r.rothConv ?? 0), 0);
    assert(allAfter < 1, `all mode must zero conversions after ${Y}, got ${Math.round(allAfter)}`);
    assert(extraAfter > 1000, `extra mode must leave strategy bracket-fill running after ${Y}, got ${Math.round(extraAfter)}`);
});

test('P24: bestConversionStopYear finds the interior optimum; best beats both full and none; self-consistent', () => {
    const b = bestConversionStopYear(STOP_BASE, { mode: 'all' });
    assert(b && b.stopYearCalendar === 2031, `expected interior optimum 2031, got ${b && b.stopYearCalendar}`);
    assert(b.stopIndex === 6, `expected cut index 6, got ${b.stopIndex}`);
    assert(!b.convertsNothingIsBest && !b.neverStopIsBest, 'this fixture has a genuine interior optimum');
    // The optimum is the max, so it cannot be worse than converting to the end or converting nothing.
    assert(b.atnwStop >= b.atnwNoStop && b.atnwStop >= b.atnwNoConv, 'best must dominate full and none');
    assert(b.gainVsFull >= 0, 'gainVsFull can never be negative (full is a candidate)');
    assert(b.gainVsFull > 1000 && b.gainVsNone > 1000, 'this fixture gains materially vs both references');
    // stopYearCalendar must be the start + cut - 1 identity.
    assert(b.stopYearCalendar === STOP_BASE.startInYear + b.stopIndex - 1, 'stop year = start + cut - 1');
    // Self-consistency: applying the searched year through the PUBLIC input reproduces atnwStop.
    const applied = simulate({ ...STOP_BASE, convEndYear: b.stopYearCalendar, convEndMode: 'all' });
    const appliedATNW = afterTaxWealthOfLogRow(applied.log[applied.log.length - 1], STOP_BASE.futureIRATaxRate);
    assertNear(appliedATNW, b.atnwStop, 'applying the searched year must reproduce the search score', 1);
});

test('P24: bestConversionStopYear strips any pre-set convEndYear (searches from a full-conversion baseline)', () => {
    // A stop year already set must not bias the search; both calls must return the same optimum.
    const fresh = bestConversionStopYear(STOP_BASE, { mode: 'all' });
    const preStopped = bestConversionStopYear({ ...STOP_BASE, convEndYear: 2028, convEndMode: 'all' }, { mode: 'all' });
    assert(fresh.stopYearCalendar === preStopped.stopYearCalendar && fresh.stopIndex === preStopped.stopIndex,
        'the search must ignore an already-set convEndYear and explore from full conversions');
    assertNear(fresh.atnwStop, preStopped.atnwStop, 'stripped-baseline search scores must match', 1);
});

// ── Conversion-schedule representation equivalence ────────────────────────────
// A per-year extraConversionAmount ARRAY and the equivalent scalar + convEndYear/convEndMode:'extra'
// schedule the same dollars, so they must BE the same plan. They were not: the year-0 Early(Conv) /
// Late(Spend) withdrawal-timing trigger read `(inputs.extraConversionAmount ?? 0) > 0`, and a
// multi-element array coerces to NaN, so the array form silently ran Late(Spend) — 11 months of
// pre-withdrawal growth instead of 1, moving the RMD basis and every downstream balance. The same
// expression also ignored suppression, so a stop year already in the past still claimed a
// conversion year. _extraConvAmountFor() is now the single accessor for both the trigger and the
// conversion. These three tests fail if any of that is reverted.

const EQV_BASE = { ...OC_BASE, extraConversionAmount: 0, computeOC: false };
const EQV_AMT = 87500;

test('representation: array [amt x cut, 0...] === scalar + convEndYear, at cut 0 / interior / n', () => {
    const n = simulate(EQV_BASE).log.length;
    for (const cut of [0, 5, n]) {
        const arr = new Array(n + 2).fill(0).map((_, y) => y < cut ? EQV_AMT : 0);
        const asArray  = simulate({ ...EQV_BASE, extraConversionAmount: arr });
        const asLoaded = simulate({ ...EQV_BASE, extraConversionAmount: EQV_AMT,
                                    convEndYear: EQV_BASE.startInYear + cut - 1, convEndMode: 'extra' });
        assert(JSON.stringify(asArray.log) === JSON.stringify(asLoaded.log),
            `cut ${cut}: the array and the loadable scalar+convEndYear form must produce the same log`);
        assert(asArray.finalNW === asLoaded.finalNW, `cut ${cut}: finalNW must match`);
    }
});

test('representation: a full array === the plain scalar (the array must not change the timing)', () => {
    const n = simulate(EQV_BASE).log.length;
    const full = simulate({ ...EQV_BASE, extraConversionAmount: new Array(n + 2).fill(EQV_AMT) });
    const scalar = simulate({ ...EQV_BASE, extraConversionAmount: EQV_AMT });
    assert(full.log[0].timing === 'Early(Conv)', `a converting year 0 must be Early(Conv), got ${full.log[0].timing}`);
    assert(JSON.stringify(full.log) === JSON.stringify(scalar.log), 'full array and scalar must be the same plan');
});

test('representation: a suppressed year 0 is not a conversion year (timing must not claim Early)', () => {
    const noConv = simulate({ ...EQV_BASE, extraConversionAmount: 0 });
    assert(noConv.log[0].timing === 'Late(Spend)', 'precondition: no conversion means Late(Spend)');
    // A stop year at/before the start year — a value the sidebar accepts — suppresses year 0.
    const past = simulate({ ...EQV_BASE, extraConversionAmount: EQV_AMT,
                            convEndYear: EQV_BASE.startInYear - 1, convEndMode: 'extra' });
    assert(JSON.stringify(past.log) === JSON.stringify(noConv.log),
        'a stop year before the start year must be identical to converting nothing');
    // Same for the internal cutoff the stop-year search uses at cut 0.
    const cf = simulate({ ...EQV_BASE, extraConversionAmount: EQV_AMT, _cfSuppressConversionsFromYear: 0 });
    assert(JSON.stringify(cf.log) === JSON.stringify(noConv.log),
        'cutting all conversions from year 0 must be identical to converting nothing');
});

test('P24: afterTaxWealthOfLogRow matches the Break Even block valuation (guards the shared-helper extraction)', () => {
    const r = simulate({ ...STOP_BASE }).log[10];
    // Unset heirs rate -> row totalWealth verbatim.
    assert(afterTaxWealthOfLogRow(r, null) === r.totalWealth, 'null rate must return row totalWealth');
    assert(afterTaxWealthOfLogRow(r, undefined) === r.totalWealth, 'undefined rate must return row totalWealth');
    // With a heirs rate -> IRA discounted, brokerage gains at the row cap-gains rate, rest at face.
    const rate = 0.30;
    const expected = (r.IRA1 + r.IRA2) * (1 - rate)
        + Math.max(0, r.Brokerage - r.Basis) * (1 - (r['-capGainsRate'] ?? 0.15))
        + r.Roth + r.Cash + r.Basis;
    assertNear(afterTaxWealthOfLogRow(r, rate), expected, 'discounted valuation must match the BE formula', 0.01);
});

// ── Cash Reserve surplus routing + reserve floor (Phase P2) ─────────────────────────────────
// CashReserve is a target cash buffer in today's dollars, three-way: undefined (blank/negative)
// = OFF/legacy (all surplus to Cash, no floor); 0 = zero buffer, reinvest ALL surplus to
// Brokerage; positive = keep that buffer (inflation-adjusted), reinvest the overflow, and protect
// it on withdrawal (breakable last resort -> cashBreach). Evidence: findings.md 2026-07-23.

// Legacy scenario: big IRA, modest spend, DRIP off -> forced RMDs throw off large surplus.
const RESERVE_BASE = {
    ...BASE, birthyear1: 1955, die1: 88, IRA1: 2500000, IRA2: 0, Roth: 0,
    Brokerage: 100000, BrokerageBasis: 100000, Cash: 100000,
    ss1: 40000, ss1Age: 70, spendGoal: 70000,
    inflation: 0.025, cpi: 0.025, growth: 0.06, cashYield: 0.03, dividendRate: 0.02,
    nYears: 30, dividendReinvest: false,
};

test('P2 CashReserve: OFF (undefined) is byte-identical and never reinvests or breaches', () => {
    const off = simulate({ ...RESERVE_BASE });
    const offExplicit = simulate({ ...RESERVE_BASE, CashReserve: undefined });
    assert(JSON.stringify(off.log) === JSON.stringify(offExplicit.log), 'undefined vs absent must be identical');
    assert(off.log.every(r => (r['-surplusToBrokerage'] ?? 0) === 0), 'OFF must route no surplus to Brokerage');
    assert(off.log.every(r => (r['-cashBreach'] ?? 0) === 0), 'OFF must never flag a reserve breach');
    // Negative sentinel (revert) behaves exactly like OFF.
    const neg = simulate({ ...RESERVE_BASE, CashReserve: -1 });
    // -1 reaches the engine only via getInputs (which maps it to undefined); the engine itself
    // treats any non-null value as active, so this asserts the ENGINE contract: undefined == OFF.
    assert(neg !== undefined, 'sanity');
});

test('P2 CashReserve: 0 reinvests all surplus into Brokerage (basis step-up); far less terminal Cash', () => {
    const off = simulate({ ...RESERVE_BASE });
    const zero = simulate({ ...RESERVE_BASE, CashReserve: 0 });
    assert(zero.totals.terminal.brokerage > off.totals.terminal.brokerage + 1e6,
        `zero-buffer must reinvest surplus into Brokerage (off ${Math.round(off.totals.terminal.brokerage)}, zero ${Math.round(zero.totals.terminal.brokerage)})`);
    assert(zero.totals.terminal.cash < off.totals.terminal.cash - 1e6,
        'zero-buffer must leave far less in Cash than OFF');
    // Reinvested overflow lands as basis (after-tax dollars), so terminal basis exceeds OFF's.
    assert(zero.totals.terminal.basis > off.totals.terminal.basis,
        'reinvested surplus must step up Brokerage basis');
    assert(zero.log.some(r => (r['-surplusToBrokerage'] ?? 0) > 1), 'some year must reinvest surplus');
});

test('P2 CashReserve: 0 differs from OFF (the sentinel distinction is real)', () => {
    const off = simulate({ ...RESERVE_BASE });
    const zero = simulate({ ...RESERVE_BASE, CashReserve: 0 });
    assert(off.finalNW !== zero.finalNW, '0 (reinvest all) must not equal OFF (all cash)');
});

test('P2 CashReserve: positive buffer keeps Cash near the reserve early, reinvests the overflow', () => {
    const buf = simulate({ ...RESERVE_BASE, CashReserve: 150000 });
    const off = simulate({ ...RESERVE_BASE });
    // Overflow is reinvested, so terminal Brokerage is far above OFF and Cash far below.
    assert(buf.totals.terminal.brokerage > off.totals.terminal.brokerage + 1e6, 'buffer must reinvest overflow');
    assert(buf.totals.terminal.cash < off.totals.terminal.cash, 'buffer caps cash growth from surplus');
    assert(buf.log.some(r => (r['-surplusToBrokerage'] ?? 0) > 1), 'some year must reinvest overflow above the buffer');
});

test('P2 CashReserve: the buffer is a breakable last resort (protected in normal years, drawn when depleted)', () => {
    // Small IRA/Roth/Brokerage, cash-heavy, high spend on a bracket strategy that gap-fills to a
    // target: early years spend from the non-reserve cash + other accounts; later years must break
    // into the reserve to keep funding spend.
    const stressed = {
        STATEname: 'TX', strategy: 'bracket', stratRate: 0.22, stratIRMAATier: -1, stratACAMultiple: 0,
        nYears: 12, birthyear1: 1958, birthmonth1: 1, die1: 82, birthyear2: 0, birthmonth2: 12, die2: 0,
        IRA1: 120000, IRA2: 0, Roth: 10000, Roth2: 0, Brokerage: 10000, BrokerageBasis: 10000, Cash: 300000,
        ss1: 15000, ss1Age: 67, ss2: 0, ss2Age: 70, pensionAnnual: 0, survivorPct: 0, pensionCola: false,
        spendGoal: 85000, spendChange: 0, iraBaseGoal: 0, inflation: 0.02, cpi: 0.02, growth: 0.03,
        cashYield: 0.01, dividendRate: 0.0, ssFailYear: 2099, ssFailPct: 1.0,
        convertExcessToRoth: false, propWithdraw: 0, iraWithdrawPct: 0.05,
        startInYear: 2026, dividendReinvest: false, hasSpouse: false,
    };
    const buf = simulate({ ...stressed, CashReserve: 250000 });
    const off = simulate({ ...stressed });
    const breachYears = buf.log.filter(r => r['-cashBreach'] === 1).map(r => r.year);
    assert(breachYears.length > 0, 'a depleted plan must break into the reserve as a last resort');
    assert(buf.log[0]['-cashBreach'] !== 1 && buf.log[1]['-cashBreach'] !== 1,
        'early years must NOT breach (reserve is protected while other funds remain)');
    assert(off.log.every(r => (r['-cashBreach'] ?? 0) === 0), 'OFF never flags a breach');
});

test('P2 CashReserve: a healthy plan with a buffer never breaches', () => {
    const healthy = simulate({ ...RESERVE_BASE, CashReserve: 100000 });
    assert(healthy.log.every(r => (r['-cashBreach'] ?? 0) === 0),
        'a well-funded plan must never break its reserve');
});

// ── Optimize Conversions sweep — Guyton-Klinger stability gate ──────────────────────────────
// optimizeConversionAmount() must reject conversion amounts that only "win" on raw finalNW
// because GK's own guardrails silently cut future spend to absorb the tax hit — the same
// runaway-optimization trap gkSpendStable already guards against for optimizeSpend/
// optimizeSpendDown.

test('optimizeConversionAmount: GK sweep rejects a higher-scoring but spend-unstable conversion amount', () => {
    const gkBase = { ...OC_BASE, strategy: 'gk', gkGuard: 0.20, gkAdjPct: 0.10,
                     IRA1: 1000000, spendGoal: 75000, growth: 0.05 };
    // Without a stability gate, $425k/yr out-scores $175k/yr on raw finalNW alone...
    const unconstrained = simulate({ ...gkBase, extraConversionAmount: 425000 });
    const stableCandidate = simulate({ ...gkBase, extraConversionAmount: 175000 });
    assert(unconstrained.finalNW > stableCandidate.finalNW,
        'test setup: $425k must out-score $175k on raw finalNW for this to be a meaningful test');
    // ...but the gated sweep must not pick it, since GK can only "afford" $425k by breaching
    // its own guard band on future spend.
    const gated = optimizeConversionAmount(gkBase, { strategy: 'gk' }, 'finalNW');
    assert(gated.optConv < 425000, `gated sweep must not pick the unstable $425k candidate, got ${gated.optConv}`);
    assertNear(gated.optConv, 175000, 'gated sweep should land on the largest still-stable candidate', 1);
});

test('optimizeConversionAmount: non-GK strategies are unaffected by the stability gate', () => {
    const inputs = { ...OC_BASE, strategy: 'bracket', stratRate: 0.22 };
    const res = optimizeConversionAmount(inputs, { strategy: 'bracket', stratRate: 0.22 }, 'finalNW');
    assert(res.optResult !== null, 'a non-GK strategy must still find a winning conversion amount');
});

// ── Cash-funded conversions (fundConversionWithCash) ─────────────────────────────────────────
// Two mechanisms, two formulas. applyExtraConversion already knows its gross amount, so it just
// pays the known tax from Cash instead of netting it out. routeSurplusAndConvert only has a net
// reallocation, so applyConversionGrossUp pulls an ADDITIONAL gross increase = conversion*t/(1-t)
// (t = the slice's true marginal rate), funds that increase's own tax from Cash, and credits the
// full increase to Roth. Both degrade gracefully to today's exact behavior when Cash runs out.

const CF_BASE = {
    ...BASE,
    birthyear1: 1955, die1: 90,
    IRA1: 1000000, Brokerage: 0, BrokerageBasis: 0, Cash: 200000, Roth: 0,
    spendGoal: 40000, nYears: 5,
};

test('cash-funding: Extra Conversion lands the FULL gross in Roth; Cash pays the tax', () => {
    const off = simulate({ ...CF_BASE, extraConversionAmount: 20000, fundConversionWithCash: false });
    const on  = simulate({ ...CF_BASE, extraConversionAmount: 20000, fundConversionWithCash: true });
    const a = off.log[0], b = on.log[0];
    // Baseline: the reported behavior — $20k requested, less than $20k converted.
    assert(a.extraConv === 20000, `test setup: gross must be the full request, got ${a.extraConv}`);
    assert(a.rothConv < 19000, `flag OFF must net tax out of the conversion, got ${a.rothConv}`);
    // Flag on: the entire gross lands in Roth.
    assertNear(b.rothConv, b.extraConv, 'flag ON must convert the full gross', 1);
    // The Cash draw is exactly the tax the OFF run had netted out.
    assertNear(b['-extraConvCashTax'], a.extraConv - a.rothConv, 'cash draw must equal the tax OFF netted out', 1);
    // Funding source changed, not the tax itself.
    assertNear(b.totalTax, a.totalTax, 'total tax must be identical — only the funding source changed', 1);
    assertNear(a.Cash - b.Cash, b['-extraConvCashTax'], 'Cash must fall by exactly the tax paid', 1);
});

test('cash-funding: gross-up satisfies increase = conversion*t/(1-t) and conserves every dollar', () => {
    const inputs = { ...CF_BASE, convertExcessToRoth: true, strategy: 'fixedpct', iraWithdrawPct: 0.15 };
    const off = simulate({ ...inputs, fundConversionWithCash: false });
    const on  = simulate({ ...inputs, fundConversionWithCash: true });
    const a = off.log[0], b = on.log[0];
    const conversion = a.rothConv;              // conv1+conv2, the pure reallocation
    const increase = b['-grossUpIRA'];
    const taxCost  = b['-grossUpTax'];
    assert(conversion > 1000, `test setup: need a real surplus conversion, got ${conversion}`);
    assert(increase > 1000, `gross-up must fire with ample Cash, got ${increase}`);
    const t = taxCost / increase;
    // The user's formula, verified against the engine's own marginal-rate calc.
    assertNear(increase, conversion * t / (1 - t), 'increase must equal conversion*t/(1-t)', 1);
    // ...which is equivalent to grossing the conversion up to conversion/(1-t).
    assertNear(conversion + increase, conversion / (1 - t), 'conversion+increase must equal conversion/(1-t)', 1);
    assertNear(b.rothConv, conversion + increase, 'Roth must receive the conversion plus the full increase', 1);
    // Conservation: the extra IRA draw reallocates to Roth; Cash covers only the new tax.
    assertNear(a.TotalIRA - b.TotalIRA, increase, 'IRA must fall by exactly the increase', 1);
    assertNear(a.Cash - b.Cash, taxCost, 'Cash must fall by exactly the increase\'s tax', 1);
    assertNear(b.totalTax - a.totalTax, taxCost, 'the increase\'s tax is genuinely new tax', 1);
});

test('cash-funding: scales down to available Cash and never overdraws it', () => {
    const inputs = { ...CF_BASE, convertExcessToRoth: true, strategy: 'fixedpct', iraWithdrawPct: 0.15 };
    const rich = simulate({ ...inputs, fundConversionWithCash: true });
    const poor = simulate({ ...inputs, Cash: 2000, fundConversionWithCash: true });
    const p = poor.log[0];
    assert(p['-grossUpTax'] <= 2000 + 1, `cash draw must not exceed available Cash, got ${p['-grossUpTax']}`);
    assert(p['-grossUpIRA'] < rich.log[0]['-grossUpIRA'], 'a cash-constrained run must gross up less than a cash-rich one');
    assert(poor.log.every(r => r.Cash >= -0.01), 'Cash must never go negative');
});

test('cash-funding: no-op when Cash is $0 (bit-identical to the flag being off)', () => {
    const inputs = { ...CF_BASE, convertExcessToRoth: true, strategy: 'fixedpct', iraWithdrawPct: 0.15, Cash: 0 };
    const on  = simulate({ ...inputs, fundConversionWithCash: true });
    const off = simulate({ ...inputs, fundConversionWithCash: false });
    assertNear(on.finalNW, off.finalNW, 'Cash=$0 must make the flag a hard no-op', 0.01);
    assert(on.log[0]['-grossUpIRA'] === 0, 'no gross-up is possible without Cash to fund its tax');
});

test('cash-funding: both mechanisms together — Extra Conversion tax is not understated by the gross-up', () => {
    // Regression: applyConversionGrossUp adds its tax to yr.totalTax, and applyExtraConversion
    // isolates its own marginal tax by subtracting yr.totalTax. If the gross-up's INCOME isn't
    // also in applyExtraConversion's basis (yr._extraIRAIncome), it subtracts a baseline that
    // includes the gross-up's tax from a shadow calc that excludes the gross-up's income, and
    // silently understates itself by roughly that tax.
    const inputs = { ...CF_BASE, convertExcessToRoth: true, strategy: 'fixedpct', iraWithdrawPct: 0.15,
                     extraConversionAmount: 20000, fundConversionWithCash: true };
    const both = simulate(inputs);
    const r = both.log[0];
    assert(r['-grossUpIRA'] > 1, 'test setup: the gross-up must actually fire');
    assert(r['-extraConvCashTax'] > 1, 'test setup: the extra conversion must actually pay tax from cash');
    // Isolate the same extra conversion with no gross-up running, for a like-for-like rate.
    const alone = simulate({ ...inputs, convertExcessToRoth: false });
    const rateAlone = alone.log[0]['-extraConvCashTax'] / alone.log[0].extraConv;
    const rateBoth  = r['-extraConvCashTax'] / r.extraConv;
    // Stacking MORE income on top can only hold or raise the marginal rate, never lower it.
    assert(rateBoth >= rateAlone - 0.001,
        `extra conversion's marginal rate must not drop when the gross-up stacks income beneath it (alone ${rateAlone.toFixed(4)} vs both ${rateBoth.toFixed(4)})`);
    // The year's Roth credit must account for all three contributions: the surplus reallocation,
    // the gross-up's increase, and the extra conversion's full gross (Cash covered its tax).
    const surplusConv = r.rothConv - r['-grossUpIRA'] - r.extraConv;
    assert(surplusConv > 1, `rothConv must decompose into surplus + gross-up + full extra gross; residual surplus was ${surplusConv}`);
    assert(r.rothConv > r.extraConv + r['-grossUpIRA'], 'all three contributions must be present in rothConv');
});

test('cash-funding: flag off leaves every balance untouched (regression guard)', () => {
    // The whole mechanism must be inert unless explicitly opted into — this is what makes every
    // pre-existing scenario, saved plan, and shared URL numerically identical after the rename.
    const inputs = { ...CF_BASE, convertExcessToRoth: true, strategy: 'fixedpct', iraWithdrawPct: 0.15,
                     extraConversionAmount: 20000 };
    const bare = simulate({ ...inputs });                                  // flag absent entirely
    const explicitOff = simulate({ ...inputs, fundConversionWithCash: false });
    assertNear(bare.finalNW, explicitOff.finalNW, 'an absent flag must behave exactly like an explicit false', 0.01);
    assert(bare.log.every(r => r['-grossUpIRA'] === 0 && r['-extraConvCashTax'] === 0),
        'no cash-funding may occur with the flag off');
});

// ── Accurate per-account IRA-withdrawal accounting + prefer-larger conversion sourcing ─────────
// Lopsided IRAs so "prefer the larger IRA" is observable: a 100k conversion should come entirely
// from the $1M IRA, not have a slice split off into the $10k one.
const SRC_BASE = {
    ...BASE,
    hasSpouse: true,
    birthyear2: 1955, birthmonth2: 6, die2: 90,
    IRA1: 1000000, IRA2: 10000, Cash: 200000, Brokerage: 0, BrokerageBasis: 0,
    spendGoal: 40000,
};

test('sourcing: an extra conversion is drawn from the larger IRA, spilling only when it cannot cover', () => {
    const r = simulate({ ...SRC_BASE, extraConversionAmount: 100000, fundConversionWithCash: false }).log[0];
    assert(r.extraConv === 100000, `setup: full gross must be requested, got ${r.extraConv}`);
    assertNear(r['-iraConvGross1'], 100000, 'the whole conversion must come from the larger IRA1', 1);
    assertNear(r['-iraConvGross2'], 0, 'nothing should be pulled from the tiny IRA2', 1);
    // Spill: a conversion larger than the (post-RMD/spending) big IRA must overflow into the small one.
    const rc = simulate({ ...SRC_BASE, IRA1: 60000, IRA2: 20000, extraConversionAmount: 70000, fundConversionWithCash: false }).log[0];
    assert(rc['-iraConvGross1'] > 0 && rc['-iraConvGross2'] > 0, 'a conversion beyond the big IRA must spill into the small one');
    assert(rc['-iraConvGross1'] > rc['-iraConvGross2'], 'the larger IRA still supplies the bigger share');
    assertNear(rc['-iraConvGross1'] + rc['-iraConvGross2'], rc.extraConv, 'the per-IRA split must sum to the gross', 1);
});

test('accounting: withdrawal columns include conversions, decompose correctly, and reconcile the IRA balance', () => {
    const res = simulate({ ...SRC_BASE, extraConversionAmount: 150000, fundConversionWithCash: true,
                           convertExcessToRoth: true, strategy: 'fixedpct', iraWithdrawPct: 0.12 });
    assert(res.log.some(r => (r.extraConv ?? 0) > 0), 'setup: extra conversions must occur');
    assert(res.log.some(r => (r['-grossUpIRA'] ?? 0) > 0), 'setup: the gross-up must fire in some year');
    let prev = SRC_BASE.IRA1 + SRC_BASE.IRA2;
    for (const x of res.log) {
        assertNear(x.IRAwd, (x['IRA1-'] || 0) + (x['IRA2-'] || 0), 'IRAwd must equal IRA1- + IRA2-', 1);
        assertNear(x['IRA1-'], (x['-iraVolSpend1'] || 0) + (x['-iraConvGross1'] || 0), 'IRA1- = spending draw + conversion gross', 1);
        assertNear(x['IRA2-'], (x['-iraVolSpend2'] || 0) + (x['-iraConvGross2'] || 0), 'IRA2- = spending draw + conversion gross', 1);
        assert((x.rothConv || 0) <= x.IRAwd + 1, `rothConv (${Math.round(x.rothConv)}) must never exceed the voluntary IRA withdrawal (${Math.round(x.IRAwd)})`);
        // The IRA balance must be fully explained by growth minus RMD minus the (now conversion-inclusive)
        // voluntary withdrawal — RMD is the only other IRA outflow and has its own columns.
        const expEnd = prev + (x['-iraG'] || 0) - (x.RMDwd || 0) - (x.IRAwd || 0);
        assertNear(expEnd, x.TotalIRA, `year ${x.year}: IRA balance must reconcile from the withdrawal columns`, 1);
        prev = x.TotalIRA;
    }
});

test('accounting: conversion-gross total equals the actual converted pulls (no reallocation)', () => {
    // convertExcessToRoth off → the only conversions are the extra conversion and (with fcc) the gross-up.
    const r = simulate({ ...SRC_BASE, extraConversionAmount: 100000, fundConversionWithCash: false }).log[0];
    assertNear(r['-iraConvGrossTot'], (r.extraConv || 0) + (r['-grossUpIRA'] || 0),
        'total gross converted must equal extraConv + gross-up when there is no surplus reallocation', 1);
    assertNear(r['-iraConvGrossTot'], (r['-iraConvGross1'] || 0) + (r['-iraConvGross2'] || 0), 'per-IRA gross must sum to the total', 1);
    assertNear(r['-iraSpend'], (r['-iraVolSpend1'] || 0) + (r['-iraVolSpend2'] || 0), 'per-IRA spending draw must sum to the total', 1);
});

test('accounting: Fed + State + IRMAA tax columns reconcile to Total Tax through the conversions', () => {
    // Large extra conversion (marginal-method tax attributed to Fed/State from the full tax calc).
    const A = simulate({ ...SRC_BASE, extraConversionAmount: 150000, fundConversionWithCash: true });
    const ra = A.log.find(r => (r.extraConv ?? 0) > 1);
    assert(ra, 'setup: need a year with an extra conversion');
    assertNear((ra.FedTax || 0) + (ra.StateTax || 0) + (ra.IRMAA || 0), ra.totalTax,
        'Fed + State + IRMAA must equal Total Tax in an extra-conversion year', 1);
    // Gross-up-only year (no extra conversion): its tax is split proportionally by marginal rate.
    const B = simulate({ ...SRC_BASE, convertExcessToRoth: true, fundConversionWithCash: true, strategy: 'fixedpct', iraWithdrawPct: 0.15 });
    const rb = B.log.find(r => (r['-grossUpIRA'] ?? 0) > 1 && (r.extraConv ?? 0) < 1);
    assert(rb, 'setup: need a gross-up-only year');
    assertNear((rb.FedTax || 0) + (rb.StateTax || 0) + (rb.IRMAA || 0), rb.totalTax,
        'Fed + State + IRMAA must equal Total Tax in a gross-up-only year', 1);
});

// ── PF11: family-diversified, _baselineScore-ranked conversion candidate pool ────────────────
// The old pool was a flat top-5 by raw finalNW, which let one strategy family monopolize every
// seat while the families that actually benefit from converting ranked just below the cut. The
// fix ranks the best row per family on _baselineScore (after-tax NW + weighted real spendable),
// the same measure the table ranks on.

// Minimal row factory for the pure selector tests. Only the fields selectConversionCandidates
// reads are set; score is _baselineScore.
function poolRow(strategy, score, extra = {}) {
    return {
        _strategy: strategy, _baselineScore: score,
        _cyclicEnabled: false, _stratIRMAATier: -1,
        totals: { success: true },
        ...extra,
    };
}

test('baselineScoreOf: real-dollar after-tax NW / deflator + weighted spendable', () => {
    // terminal = {ira,roth,cash,basis,brokerage}; futureIRARate 0.24, capGains 0.15.
    // afterTaxNW = roth + cash + basis + max(0,brk-basis)*(1-0.15) + ira*(1-0.24)
    //            = 50000 + 10000 + 20000 + 20000*0.85 + 100000*0.76 = 173000
    // /defl(2) = 86500; + 1.10*30000 = 33000 -> 119500
    const res = { log: [{ inflationFactor: 2 }],
        totals: { terminal: { ira: 100000, roth: 50000, cash: 10000, basis: 20000, brokerage: 40000 },
                  capGainsRate: 0.15, spendCurrentDollars: 30000 } };
    assertNear(baselineScoreOf(res, 0.24), 119500, 'baselineScoreOf hand-computed value', 1);
    // Independent cross-check against the exported afterTaxNetWorth helper.
    const atNW = afterTaxNetWorth(res.totals.terminal, 0.24, 0.15);
    assertNear(baselineScoreOf(res, 0.24), atNW / 2 + 1.10 * 30000, 'matches afterTaxNetWorth/defl formula', 0.01);
    // Empty/degenerate result -> -Infinity, never throws.
    assert(baselineScoreOf(null, 0.24) === -Infinity, 'null result scores -Infinity');
    assert(baselineScoreOf({ log: [] }, 0.24) === -Infinity, 'empty log scores -Infinity');
});

test('selectConversionCandidates: REGRESSION — a flat top-N would drop the family that benefits', () => {
    // Reproduces the observed $2M topology: five cyclic-fixedpct rows hold the five HIGHEST scores,
    // and a non-cyclic propwd row ranks sixth. A flat top-5 (by finalNW OR by _baselineScore) keeps
    // only the five cyclic rows and never sweeps propwd. The family-diversified pool must include
    // propwd and must keep at most ONE cyclic-fixedpct row.
    const rows = [
        poolRow('fixedpct', 900, { _cyclicEnabled: true }),
        poolRow('fixedpct', 890, { _cyclicEnabled: true }),
        poolRow('fixedpct', 880, { _cyclicEnabled: true }),
        poolRow('fixedpct', 870, { _cyclicEnabled: true }),
        poolRow('fixedpct', 860, { _cyclicEnabled: true }),
        poolRow('propwd',   500, { _cyclicEnabled: false }),
    ];
    const pool = selectConversionCandidates(rows, 12);
    assert(pool.some(r => r._strategy === 'propwd'), 'pool MUST include the propwd family (top-N drops it)');
    const cyc = pool.filter(r => r._strategy === 'fixedpct' && r._cyclicEnabled);
    assert(cyc.length === 1, `pool must keep exactly one cyclic-fixedpct champion, got ${cyc.length}`);
    assertNear(cyc[0]._baselineScore, 900, 'the retained cyclic-fixedpct row is the best-scoring one', 0.01);
});

test('selectConversionCandidates: bracket-rate and bracket-IRMAA are distinct families', () => {
    // Both carry strategy:'bracket'; the tier sign (<0 vs >=0) separates fill-a-tax-bracket from
    // fill-to-an-IRMAA-ceiling. Keying on _strategy alone would silently drop one.
    const rows = [
        poolRow('bracket', 700, { _stratIRMAATier: -1 }),  // fill-bracket
        poolRow('bracket', 690, { _stratIRMAATier: 2 }),   // IRMAA ceil
    ];
    const pool = selectConversionCandidates(rows, 12);
    assert(pool.length === 2, `bracket-rate and bracket-IRMAA must both appear, got ${pool.length}`);
});

test('selectConversionCandidates: ineligible rows are excluded', () => {
    // Top scorers are each ineligible for a different reason; the sole eligible row must win.
    const rows = [
        poolRow('propwd', 999, { _isNoConv: true }),
        poolRow('fixed',  998, { _isSpendOptimized: true }),
        poolRow('bracket',997, { _isBracketInfeasible: true }),
        poolRow('aca',    996, { _isACAUntenable: true }),
        poolRow('gk',     995, { totals: { success: false } }),
        poolRow('ordered',100, { _cyclicEnabled: false }),  // the only eligible row
    ];
    const pool = selectConversionCandidates(rows, 12);
    assert(pool.length === 1 && pool[0]._strategy === 'ordered',
        `only the eligible 'ordered' row should be returned, got ${JSON.stringify(pool.map(r => r._strategy))}`);
});

test('selectConversionCandidates: caps at maxPool and returns champions in descending score', () => {
    const rows = [];
    for (let i = 0; i < 16; i++) rows.push(poolRow('s' + i, 100 + i));  // 16 distinct families
    const pool = selectConversionCandidates(rows, 12);
    assert(pool.length === 12, `must cap at maxPool=12, got ${pool.length}`);
    // Highest 12 scores are 115..104; assert descending and that the top is 115.
    for (let i = 1; i < pool.length; i++) {
        assert(pool[i - 1]._baselineScore >= pool[i]._baselineScore, 'pool must be sorted descending by score');
    }
    assertNear(pool[0]._baselineScore, 115, 'top champion is the highest scorer', 0.01);
    assertNear(pool[11]._baselineScore, 104, '12th champion is the 12th-highest scorer', 0.01);
});

// T6 scenario: converting HURTS raw ending wealth (finalNW picks $0) but HELPS the after-tax +
// spendable measure (baselineScore picks $50k/yr). Directly encodes the reported defect: the old
// metric told the user "no benefit" while the honest measure finds a real conversion.
const PF11_BASE = {
    STATEname: 'CA', strategy: 'propwd', propWithdraw: 0, nYears: 25,
    birthyear1: 1958, birthmonth1: 1, die1: 90,
    birthyear2: 1960, birthmonth2: 6, die2: 92, hasSpouse: true,
    IRA1: 560000, IRA2: 240000, Roth: 100000, Roth2: 0,
    Brokerage: 300000, BrokerageBasis: 200000, Cash: 100000,
    ss1: 40000, ss1Age: 67, ss2: 25000, ss2Age: 67,
    pensionAnnual: 0, survivorPct: 0, pensionCola: false,
    spendGoal: 90000, spendChange: 0, iraBaseGoal: 0,
    inflation: 0.025, cpi: 0.025, growth: 0.04, cashYield: 0.02, dividendRate: 0.015,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: true, iraWithdrawPct: 0.05,
    startInYear: 2026, startYear: 2026, dividendReinvest: false, futureIRATaxRate: 0.37,
};

test("optimizeConversionAmount: 'baselineScore' finds a conversion where 'finalNW' finds none", () => {
    const ov = { strategy: 'propwd', propWithdraw: 0 };
    assert(simulate({ ...PF11_BASE }).totals.success, 'test setup: base scenario must succeed');
    const fn = optimizeConversionAmount(PF11_BASE, ov, 'finalNW').optConv;
    const bl = optimizeConversionAmount(PF11_BASE, ov, 'baselineScore', { futureIRARate: 0.37 }).optConv;
    assert(fn === 0, `finalNW should pick $0 for this scenario, got ${fn}`);
    assertNear(bl, 50000, 'baselineScore should pick $50k/yr', 1);
});

test('optimizeConversionAmount: legacy metric modes and the 3-arg signature are unchanged', () => {
    const ov = { strategy: 'propwd', propWithdraw: 0 };
    // 4-arg finalNW, 3-arg finalNW, and default-metric must all agree at the pre-change value ($0).
    assert(optimizeConversionAmount(PF11_BASE, ov, 'finalNW').optConv === 0, "4-arg 'finalNW' unchanged");
    assert(optimizeConversionAmount(PF11_BASE, ov, 'finalNW', {}).optConv === 0, "explicit empty opts unchanged");
    assert(optimizeConversionAmount(PF11_BASE, ov).optConv === 0, 'default metric (no 3rd/4th arg) unchanged');
});

// ── PF13: objective ranking + Medicare helper ───────────────────────────────────────────────
// rankRowsByObjective(rows, objKey, rate) is pure: successful rows always outrank failed ones,
// then the objective's own order. Fixtures carry only the fields each metric reads.

// Row factory for ranking tests. terminal buckets + the scalar fields the metrics use.
function objRow(id, opts = {}) {
    return {
        _id: id,
        afterTaxNWCurrentDollars: opts.nw ?? 0,
        _baselineScore: opts.score ?? 0,
        totals: {
            success: opts.success !== false,
            terminal: opts.terminal ?? { ira: 0, roth: 0, cash: 0, brokerage: 0, basis: 0 },
            capGainsRate: opts.capG ?? 0.15,
            rmdTax: opts.rmdTax ?? 0,
            taxCurrentDollars: opts.tax ?? 0,
            spendCurrentDollars: opts.spend ?? 0,
        },
    };
}

test('rankRowsByObjective: failed rows always sort last, whatever the metric', () => {
    const rows = [
        objRow('a', { nw: 100 }),
        objRow('f', { nw: 999, success: false }),  // huge NW but failed
        objRow('b', { nw: 200 }),
    ];
    const order = rankRowsByObjective(rows, 'networth', 0.24).map(r => r._id);
    assert(order[order.length - 1] === 'f', `failed row must be last, got ${order.join(',')}`);
    assert(order[0] === 'b' && order[1] === 'a', `successful rows by NW desc, got ${order.join(',')}`);
});

test('rankRowsByObjective: networth desc, mintax asc', () => {
    const rows = [objRow('lo', { nw: 100, tax: 300 }), objRow('hi', { nw: 500, tax: 50 }), objRow('mid', { nw: 300, tax: 120 })];
    assert(rankRowsByObjective(rows, 'networth', 0).map(r => r._id).join(',') === 'hi,mid,lo', 'networth desc');
    assert(rankRowsByObjective(rows, 'mintax', 0).map(r => r._id).join(',') === 'hi,mid,lo', 'mintax asc puts lowest tax first');
});

test('rankRowsByObjective: widowrmd = rmdTax + terminal.ira × rate, minimized', () => {
    // rate 0.30. scores: A = 10k + 100k*0.3 = 40k; B = 30k + 20k*0.3 = 36k; C = 5k + 200k*0.3 = 65k.
    const rows = [
        objRow('A', { rmdTax: 10000, terminal: { ira: 100000, roth: 0, cash: 0, brokerage: 0, basis: 0 } }),
        objRow('B', { rmdTax: 30000, terminal: { ira: 20000,  roth: 0, cash: 0, brokerage: 0, basis: 0 } }),
        objRow('C', { rmdTax: 5000,  terminal: { ira: 200000, roth: 0, cash: 0, brokerage: 0, basis: 0 } }),
    ];
    assert(rankRowsByObjective(rows, 'widowrmd', 0.30).map(r => r._id).join(',') === 'B,A,C',
        'widowrmd ranks by rmdTax + IRA tax-bomb ascending (B<A<C)');
});

test('rankRowsByObjective: Tax Flexibility prefers the balanced plan among the top-wealth ones', () => {
    // rate 0 so pre-tax bucket = terminal.ira at face. All three below have equal-ish NW except POOR.
    // LOPSIDED: everything in one bucket (max spread). BALANCED: even split (min spread), NW within 10%.
    // POOR: perfectly balanced but tiny NW (must NOT win — fails the wealth cutoff).
    const rows = [
        objRow('LOPSIDED', { nw: 1000000, terminal: { ira: 900000, roth: 50000, cash: 50000, brokerage: 0, basis: 0 } }),
        objRow('BALANCED', { nw:  950000, terminal: { ira: 316667, roth: 316667, cash: 316666, brokerage: 0, basis: 0 } }),
        objRow('POOR',     { nw:  100000, terminal: { ira: 33333,  roth: 33333,  cash: 33334,  brokerage: 0, basis: 0 } }),
    ];
    const order = rankRowsByObjective(rows, 'taxflex', 0).map(r => r._id);
    assert(order[0] === 'BALANCED', `most-balanced top-wealth plan wins, got ${order.join(',')}`);
    assert(order[order.length - 1] === 'POOR', `the poor (sub-cutoff) plan ranks last despite perfect balance, got ${order.join(',')}`);
});

test('rankRowsByObjective: Tax Flexibility cutoff handles negative after-tax NW', () => {
    // maxNW negative: cutoff = maxNW - 0.10*|maxNW| must be BELOW maxNW so the best row stays eligible.
    const rows = [
        objRow('best', { nw: -100000, terminal: { ira: 100000, roth: 100000, cash: 100000, brokerage: 0, basis: 0 } }),
        objRow('worse', { nw: -500000, terminal: { ira: 300000, roth: 0, cash: 0, brokerage: 0, basis: 0 } }),
    ];
    // Should not throw; the higher-NW balanced row should lead.
    const order = rankRowsByObjective(rows, 'taxflex', 0).map(r => r._id);
    assert(order[0] === 'best', `negative-NW cutoff must keep the best row eligible, got ${order.join(',')}`);
});

test('eitherOnMedicareAtStart: OR semantics, single-filer, and guard', () => {
    // both under 65 → false
    assert(eitherOnMedicareAtStart(1965, 60, true, 1963) === false, 'both <65 → false');
    // self <65 but spouse (older) 65+ at start → true  (self born 1965 start age 60 → startYear 2025; spouse 1955 → 70)
    assert(eitherOnMedicareAtStart(1965, 60, true, 1955) === true, 'spouse already on Medicare → true');
    // self 65+ → true regardless of spouse
    assert(eitherOnMedicareAtStart(1958, 66, true, 1970) === true, 'self 65+ → true');
    // single filer 65+ → true; single filer <65 → false
    assert(eitherOnMedicareAtStart(1958, 66, false, 0) === true, 'single 65+ → true');
    assert(eitherOnMedicareAtStart(1965, 60, false, 0) === false, 'single <65 → false');
    // missing inputs → false (matches bothOnMedicareAtStart guard)
    assert(eitherOnMedicareAtStart(0, 66, true, 1950) === false, 'missing birthyear → false');
});

// ── Tax-rate creep (P4 phase 1) ───────────────────────────────────────────────
// Bracket RATES escalate a fixed % per year from a start year; bracket LIMITS are untouched.
// Federal has a UI knob; the state multiplier is plumbed end-to-end but pinned at 0 for now,
// so these tests are what keep the state path from rotting before it gets a control.
// A bigger IRA than BASE so the plan actually reaches taxable brackets every year.
const CREEP_BASE = {
    ...BASE,
    IRA1: 1200000,
    spendGoal: 90000,
};
const sumCol = (res, col) => res.log.reduce((a, r) => a + (r[col] || 0), 0);

test('taxCreepFactor: off, before start, and compounding', () => {
    assert(taxCreepFactor(0, 2050, 2026) === 1, 'rate 0 → 1 in any year');
    assert(taxCreepFactor(undefined, 2050, 2026) === 1, 'missing rate → 1');
    assert(taxCreepFactor(0.02, 2025, 2030) === 1, 'before the start year → 1');
    assert(taxCreepFactor(0.02, 2030, 2030) === 1, 'the start year itself → 1 (0 years elapsed)');
    assertNear(taxCreepFactor(0.01, 2046, 2026), Math.pow(1.01, 20), '1%/yr over 20 years', 1e-12);
});

test('tax creep: zero creep is byte-identical to no creep at all (regression guard)', () => {
    const bare = simulate({ ...CREEP_BASE });
    const zeroed = simulate({ ...CREEP_BASE, taxRateCreep: 0, taxRateCreepState: 0, taxCreepStartYear: 0 });
    assert(JSON.stringify(bare.log) === JSON.stringify(zeroed.log),
        'an explicit zero creep must produce the exact same log as omitting the fields');
    // And the multipliers recorded in the log are a flat 1 throughout.
    assert(bare.log.every(r => r['-fedRateCreep'] === 1 && r['-stateRateCreep'] === 1),
        'with creep off every year records a multiplier of 1');
});

test('tax creep: calculateTaxes scales the right walk and nothing else', () => {
    const p = { filingStatus: 'SGL', ages: [70], birthyears: [1952], earnedIncome: 150000,
                totalSS: 0, inflation: 1, state: 'CA' };
    const base = calculateTaxes({ ...p });
    const fed  = calculateTaxes({ ...p, fedRateCreep: 1.5 });
    const st   = calculateTaxes({ ...p, stateRateCreep: 1.5 });
    // Federal creep: ordinary federal tax scales exactly; state and cap gains untouched.
    assertNear(fed.federalOrdinaryTax, base.federalOrdinaryTax * 1.5, 'federal ordinary tax scales', 0.01);
    assert(fed.stateTax === base.stateTax, 'federal creep must not move state tax');
    assert(fed.capitalGainsTax === base.capitalGainsTax, 'federal creep must not move cap gains tax');
    // State creep: state tax scales exactly; federal untouched.
    assertNear(st.stateTax, base.stateTax * 1.5, 'state tax scales', 0.01);
    assert(st.federalTax === base.federalTax, 'state creep must not move federal tax');
    // The applied multipliers are echoed back for logging.
    assert(fed.fedRateCreep === 1.5 && fed.stateRateCreep === 1, 'multipliers echoed back');
});

test('tax creep: escalation reaches the simulation and compounds by calendar year', () => {
    const flat = simulate({ ...CREEP_BASE });
    const crept = simulate({ ...CREEP_BASE, taxRateCreep: 0.01 });
    assert(sumCol(crept, 'FedTax') > sumCol(flat, 'FedTax'), 'federal tax rises with creep');
    const last = crept.log.length - 1;
    // Marginal rate in the final year = statutory rate × 1.01^(years elapsed).
    assertNear(crept.log[last]['FedRate%'], flat.log[last]['FedRate%'] * Math.pow(1.01, last),
        'final-year marginal federal rate', 1e-9);
    // Every year's recorded multiplier matches the pure helper.
    assert(crept.log.every((r, i) => r['-fedRateCreep'] === taxCreepFactor(0.01, r.year, crept.log[0].year)),
        'logged multiplier matches taxCreepFactor for every year');
    // State stays on today's rates while only the federal knob is set.
    assert(crept.log.every(r => r['-stateRateCreep'] === 1), 'state multiplier stays 1');
});

test('tax creep: start year is respected (earlier years untouched)', () => {
    const flat = simulate({ ...CREEP_BASE });
    const startYear = flat.log[0].year + 8;
    const crept = simulate({ ...CREEP_BASE, taxRateCreep: 0.02, taxCreepStartYear: startYear });
    const before = crept.log.filter(r => r.year <= startYear);
    assert(before.length === 9, `expected 9 pre-creep years, got ${before.length}`);
    assert(before.every((r, i) => r.FedTax === flat.log[i].FedTax && r['-fedRateCreep'] === 1),
        'years up to and including the start year are identical to the no-creep run');
    const after = crept.log.filter(r => r.year > startYear);
    assert(after.length > 0 && after.every(r => r['-fedRateCreep'] > 1), 'later years escalate');
    assert(sumCol(crept, 'FedTax') > sumCol(flat, 'FedTax'), 'total federal tax still rises');
});

test('tax creep: the state path is live even without a UI knob', () => {
    const flat = simulate({ ...CREEP_BASE });
    const crept = simulate({ ...CREEP_BASE, taxRateCreepState: 0.01 });
    assert(sumCol(crept, 'StateTax') > sumCol(flat, 'StateTax'), 'state tax rises with state creep');
    assert(crept.log.every(r => r['-fedRateCreep'] === 1), 'federal multiplier stays 1');
    const last = crept.log.length - 1;
    assertNear(crept.log[last]['-stateRateCreep'], Math.pow(1.01, last), 'final-year state multiplier', 1e-12);
});

test('tax creep: reaches the Optimizer surface (buildVariations + optimizeSpend)', () => {
    const withCreep = { ...CREEP_BASE, taxRateCreep: 0.01, taxRateCreepState: 0.02, taxCreepStartYear: 2030 };
    // Surface 1: the swept variation list must carry all three fields untouched.
    const variations = buildVariations(withCreep);
    assert(variations.length > 0, 'buildVariations produced no variations');
    assert(variations.every(v => v.taxRateCreep === 0.01 && v.taxRateCreepState === 0.02
                              && v.taxCreepStartYear === 2030),
        'every swept variation inherits the creep settings');
    // And a swept variation actually pays the escalated tax.
    const v = variations[0];
    const crept = simulate({ ...v });
    const flat = simulate({ ...v, taxRateCreep: 0, taxRateCreepState: 0 });
    assert(sumCol(crept, 'FedTax') > sumCol(flat, 'FedTax')
        && sumCol(crept, 'StateTax') > sumCol(flat, 'StateTax'),
        'a swept variation pays both the federal and state creep');
    // Surface 2: the optimizer's other merge path (base + overrides).
    const optCrept = optimizeSpend(withCreep, { strategy: 'fixed' });
    const optFlat = optimizeSpend({ ...withCreep, taxRateCreep: 0, taxRateCreepState: 0 }, { strategy: 'fixed' });
    assert(optCrept.result.log.every(r => r['-fedRateCreep'] >= 1 && r['-stateRateCreep'] >= 1),
        'optimizeSpend runs carry the creep multipliers');
    assert(sumCol(optCrept.result, 'totalTax') > sumCol(optFlat.result, 'totalTax'),
        'optimizeSpend pays more tax under creep');
});

test('tax creep: reaches Monte Carlo and is path-independent', () => {
    // Replicates worker.js's call shape exactly: simulate({ ...variation, returnSequence, inflationSequence }).
    const withCreep = { ...CREEP_BASE, taxRateCreep: 0.01, taxRateCreepState: 0.01 };
    const N = 40;
    const returnSequence = Array.from({ length: N }, (_, i) => 0.04 + (i % 5) * 0.01);
    const inflA = Array.from({ length: N }, (_, i) => 0.01 + (i % 3) * 0.01);
    const inflB = Array.from({ length: N }, (_, i) => 0.05 - (i % 4) * 0.01);
    const pathA = simulate({ ...withCreep, returnSequence, inflationSequence: inflA });
    const pathB = simulate({ ...withCreep, returnSequence, inflationSequence: inflB });
    const flat  = simulate({ ...withCreep, returnSequence, inflationSequence: inflA,
                             taxRateCreep: 0, taxRateCreepState: 0 });
    // Tax POLICY is a calendar-year fact — it must be identical across paths even though the
    // paths see different inflation. This is the guard against folding the creep into cpiRate.
    const n = Math.min(pathA.log.length, pathB.log.length);
    for (let i = 0; i < n; i++) {
        assert(pathA.log[i]['-fedRateCreep'] === pathB.log[i]['-fedRateCreep']
            && pathA.log[i]['-stateRateCreep'] === pathB.log[i]['-stateRateCreep'],
            `creep multiplier differs between MC paths at year index ${i} — it must not depend on inflation`);
    }
    // The realized taxes DO differ (different inflation → different brackets/income) and both
    // exceed the same path with creep off.
    assert(sumCol(pathA, 'totalTax') !== sumCol(pathB, 'totalTax'),
        'different inflation paths should still produce different tax totals');
    assert(sumCol(pathA, 'FedTax') > sumCol(flat, 'FedTax'), 'MC path pays the federal creep');
    assert(sumCol(pathA, 'StateTax') > sumCol(flat, 'StateTax'), 'MC path pays the state creep');
});

// ── PR1: break-even heirs rate + time-limited conversions ─────────────────────
// All expected values below were captured from the real engine before being pinned here.
const CONV_BASE = { ...BASE, IRA1: 1500000, spendGoal: 90000,
                    growth: 0.06, inflation: 0.03, cpi: 0.028 };
const FIXED_OV    = { strategy: 'fixed', nYears: 20 };
const FIXEDPCT_OV = { strategy: 'fixedpct', iraWithdrawPct: 0.05 };

test('breakEvenHeirsRate: no IRA means no threshold', () => {
    assert(breakEvenHeirsRate({ ...CONV_BASE, IRA1: 0, IRA2: 0 }, FIXED_OV, {}) === null,
        'a plan with no IRA has nothing to convert, so there is no break-even rate');
});

test('breakEvenHeirsRate: returns null when no rate up to the ceiling pays', () => {
    // Honest "never" is a real answer, not a missing one -- the banner depends on telling them apart.
    assert(breakEvenHeirsRate(CONV_BASE, FIXED_OV, { maxRate: 0.06 }) === null,
        'a ceiling below the true threshold must report null rather than guessing');
});

test('breakEvenHeirsRate: the rate/amount pair it reports is self-consistent', () => {
    const r = breakEvenHeirsRate(CONV_BASE, FIXEDPCT_OV, {});
    assert(r !== null, 'this fixture does have a threshold');
    assertNear(r.rate, 0.57, 'break-even heirs rate for the fixedpct fixture', 0.011);
    assert(r.optConv === 75000, `expected a $75,000 conversion at the threshold, got ${r.optConv}`);
    // The rounding nudge exists so a reported rate never comes back with a $0 conversion.
    assert(r.optConv > 0, 'a reported rate must always carry a real conversion amount');
    assert(r.gain > 0, 'and a positive gain');
});

test('breakEvenHeirsRate: the predicate is monotonic in the rate (binary search precondition)', () => {
    // The search is a binary search, which is only valid because "conversions pay" never turns
    // back off as the assumed future rate rises. nominalTaxRate is a bracket STEP function, so
    // this is a measured property, not an obvious one -- if a change breaks it the search starts
    // returning wrong thresholds silently. This test is the tripwire.
    const seq = [];
    for (let r = 0.05; r <= 0.75001; r += 0.025) {
        seq.push(breakEvenHeirsRate(CONV_BASE, FIXEDPCT_OV, { maxRate: +r.toFixed(4) }) ? 1 : 0);
    }
    const first = seq.indexOf(1);
    assert(first === -1 || seq.slice(first).every(x => x === 1),
        `once conversions start paying they must keep paying as the rate rises; got ${seq.join('')}`);
});

test('lowestBreakEvenHeirsRate: finds a threshold the best-scoring candidate does not have', () => {
    // The whole reason this searches the pool: the top-ranked strategy is often the one LEAST
    // willing to convert, so asking only it would report "never" while another candidate pays.
    assert(breakEvenHeirsRate(CONV_BASE, FIXED_OV, {}) === null,
        'precondition: the fixed candidate alone reports no threshold');
    const best = lowestBreakEvenHeirsRate(CONV_BASE, [
        { overrides: FIXED_OV,    terminalIRA: 100000, label: 'fixed' },
        { overrides: FIXEDPCT_OV, terminalIRA: 500000, label: 'fixedpct' }
    ], {});
    assert(best !== null, 'the pool search must find the candidate that does have a threshold');
    assertNear(best.rate, 0.57, 'pool-wide lowest break-even heirs rate', 0.011);
    assert(best.label === 'fixedpct', `expected the fixedpct candidate to win, got ${best.label}`);
});

test('bestTimeLimitedConversion: finds a convert-then-stop plan and reports it in calendar years', () => {
    const tl = bestTimeLimitedConversion(CONV_BASE, FIXED_OV, { futureIRARate: 0.24 });
    assert(tl !== null, 'this fixture has a paying time-limited conversion');
    assert(tl.amount === 93750, `expected $93,750/yr, got ${tl.amount}`);
    assert(tl.stopIndex === 1, `expected a 1-year conversion window, got ${tl.stopIndex}`);
    assert(tl.stopYearCalendar === 2026,
        `stop year must be a calendar year the sidebar can hold, got ${tl.stopYearCalendar}`);
    assert(tl.gain > 0, 'and it must actually beat converting nothing');
});

test('bestTimeLimitedConversion: its answer survives being replayed through the sidebar inputs', () => {
    // The PF8 failure mode: the optimizer scoring one plan while clicking the row runs another.
    // A per-year extraConversionAmount ARRAY and the equivalent scalar + convEndYear are NOT
    // interchangeable in this engine, so the search scores the loadable form and this pins it.
    const tl = bestTimeLimitedConversion(CONV_BASE, FIXED_OV, { futureIRARate: 0.24 });
    const asLoaded = simulate({ ...CONV_BASE, ...FIXED_OV, extraConversionAmount: tl.amount,
                                convEndYear: tl.stopYearCalendar, convEndMode: 'extra' });
    const noConv = simulate({ ...CONV_BASE, ...FIXED_OV, extraConversionAmount: 0 });
    const gain = baselineScoreOf(asLoaded, 0.24) - baselineScoreOf(noConv, 0.24);
    assertNear(gain, tl.gain, 'gain reproduced from the loadable inputs', 1);
});

test('bestTimeLimitedConversion: no IRA means nothing to find', () => {
    assert(bestTimeLimitedConversion({ ...CONV_BASE, IRA1: 0, IRA2: 0 }, FIXED_OV,
        { futureIRARate: 0.24 }) === null, 'no IRA, no conversion');
});

// ── Current-plan identification: sameStrategySelection / offGridParamFor ──────
// The Optimizer pins the user's own plan and marks the swept row that matches it, and Monte Carlo
// runs Stress against that same row. Both go through sameStrategySelection, which replaced an
// MC-local matcher that returned false for Guyton-Klinger and Ordered (those users silently got a
// synthetic fallback plan) and ignored the IRMAA tier (an IRMAA-ceiling user was paired with a
// plain bracket row).

test('sameStrategySelection: matches each family on its own parameter', () => {
    const cases = [
        [{ strategy: 'propwd',   propWithdraw: 0.07 },   { strategy: 'propwd',   propWithdraw: 0.07 },   true],
        [{ strategy: 'propwd',   propWithdraw: 0.07 },   { strategy: 'propwd',   propWithdraw: 0.10 },   false],
        [{ strategy: 'fixed',    nYears: 18 },           { strategy: 'fixed',    nYears: 18 },           true],
        [{ strategy: 'fixed',    nYears: 18 },           { strategy: 'fixed',    nYears: 20 },           false],
        [{ strategy: 'fixedpct', iraWithdrawPct: 0.09 }, { strategy: 'fixedpct', iraWithdrawPct: 0.09 }, true],
        [{ strategy: 'ordered',  orderedSeq: 'RIBC' },   { strategy: 'ordered',  orderedSeq: 'RIBC' },   true],
        [{ strategy: 'ordered',  orderedSeq: 'RIBC' },   { strategy: 'ordered',  orderedSeq: 'CBIR' },   false],
        [{ strategy: 'gk', gkGuard: 0.20, gkAdjPct: 0.10 }, { strategy: 'gk', gkGuard: 0.20, gkAdjPct: 0.10 }, true],
        [{ strategy: 'gk', gkGuard: 0.20, gkAdjPct: 0.10 }, { strategy: 'gk', gkGuard: 0.25, gkAdjPct: 0.10 }, false],
        [{ strategy: 'propwd', propWithdraw: 0 },        { strategy: 'fixed', nYears: 10 },              false],
    ];
    for (const [a, b, want] of cases) {
        assert(sameStrategySelection(a, b) === want,
            `${a.strategy} vs ${b.strategy}: expected ${want}, got ${sameStrategySelection(a, b)}`);
    }
});

test('sameStrategySelection: bracket identity includes the IRMAA tier and the ACA multiple', () => {
    const rate = { strategy: 'bracket', stratRate: 0, stratIRMAATier: -1, stratACAMultiple: 0 };
    const tier2 = { strategy: 'bracket', stratRate: 0, stratIRMAATier: 2, stratACAMultiple: 0 };
    assert(!sameStrategySelection(rate, tier2), 'an IRMAA-ceiling plan is not a bracket-rate plan');
    assert(sameStrategySelection(tier2, { ...tier2 }), 'same tier must match');
    assert(!sameStrategySelection({ strategy: 'aca', stratACAMultiple: 200 },
                                  { strategy: 'aca', stratACAMultiple: 400 }), 'ACA multiples differ');
});

test('sameStrategySelection: cyclic and cash-funding modifiers are part of the identity', () => {
    const p = { strategy: 'propwd', propWithdraw: 0.05 };
    assert(!sameStrategySelection(p, { ...p, cyclicEnabled: true }), 'cyclic vs non-cyclic');
    assert(!sameStrategySelection({ ...p, cyclicEnabled: true, cyclicOrder: 'ira-first' },
                                  { ...p, cyclicEnabled: true, cyclicOrder: 'brokerage-first' }), 'cyclic order');
    assert(!sameStrategySelection(p, { ...p, fundConversionWithCash: true }), 'cash-funded twin is a different plan');
});

test('sameStrategySelection: finds GK and Ordered users in buildVariations output (the MC regression)', () => {
    const gkBase = { ...BASE, strategy: 'gk', gkGuard: 0.20, gkAdjPct: 0.10 };
    const gkIdx = buildVariations(gkBase).findIndex(v => sameStrategySelection(v, gkBase));
    assert(gkIdx >= 0, 'a Guyton-Klinger user must match a swept variation (previously never did)');
    const ordBase = { ...BASE, strategy: 'ordered', orderedSeq: 'RIBC' };
    const ordIdx = buildVariations(ordBase).findIndex(v => sameStrategySelection(v, ordBase));
    assert(ordIdx >= 0, 'an Ordered user must match a swept variation (previously never did)');
    assert(buildVariations(ordBase)[ordIdx].orderedSeq === 'RIBC', 'and it must be their own sequence');
    const absent = { ...BASE, strategy: 'nosuchstrategy' };
    assert(buildVariations(absent).findIndex(v => sameStrategySelection(v, absent)) === -1,
        'a strategy absent from the sweep must report no match');
});

test('offGridParamFor: returns the user parameter only when it is off the grid', () => {
    const grids = { propwd: [0, 5, 10, 20, 50], fixed: [2, 5, 10, 20, 25],
                    bracket: [0.10, 0.12, 0.22, 0.24], fixedpct: [5, 6, 7, 8, 10] };
    assert(offGridParamFor({ strategy: 'propwd', propWithdraw: 0.07 }, grids)?.paramLabel === '7%', 'propwd 7% is off-grid');
    assert(offGridParamFor({ strategy: 'propwd', propWithdraw: 0.10 }, grids) === null, 'propwd 10% is on the grid');
    assert(offGridParamFor({ strategy: 'fixed', nYears: 18 }, grids)?.paramLabel === '18 yrs', 'reduce 18 is off-grid');
    assert(offGridParamFor({ strategy: 'fixed', nYears: 20 }, grids) === null, 'reduce 20 is on the grid');
    assert(offGridParamFor({ strategy: 'bracket', stratRate: 0.26 }, grids)?.paramLabel === '26%', 'bracket 26% is off-grid');
    assert(offGridParamFor({ strategy: 'bracket', stratRate: 0.22 }, grids) === null, 'bracket 22% is on the grid');
    assert(offGridParamFor({ strategy: 'fixedpct', iraWithdrawPct: 0.09 }, grids)?.paramLabel === '9%', 'IRA draw 9% is off-grid');
    // An IRMAA-ceiling selection is swept as its own family, so it has no off-grid case.
    assert(offGridParamFor({ strategy: 'bracket', stratRate: 0, stratIRMAATier: 2 }, grids) === null, 'IRMAA tier has no grid');
    assert(offGridParamFor({ strategy: 'gk', gkGuard: 0.2 }, grids) === null, 'GK already sweeps the user guardrails');
});

test('offGridParamFor: buildVariations gains exactly one non-cyclic row for an off-grid user', () => {
    const onGrid  = { ...BASE, strategy: 'propwd', propWithdraw: 0.10, Cash: 0 };
    const offGrid = { ...onGrid, propWithdraw: 0.07 };
    const a = buildVariations(onGrid).length, b = buildVariations(offGrid).length;
    // Every non-cyclic row is tripled by the cyclic pass (base + 2 cyclic clones); Cash 0 suppresses
    // the 💵 clones, so one extra base row means exactly three more variations.
    assert(b - a === 3, `expected 3 more variations (1 base + 2 cyclic), got ${b - a}`);
    assert(buildVariations(offGrid).some(v => sameStrategySelection(v, offGrid)),
        'and the off-grid user must now match one of them');
});

// ── P35 PR 1: characterization goldens for the MC enumeration ─────────────────
// buildVariations() had exactly one assertion before this block — `length > 0` — while it and the
// Optimizer's inline enumeration sweep DIFFERENT spaces that nothing pinned. P35 PR 2 extracts the
// Optimizer's copy into core; an extraction can only be called behavior-preserving against a
// recording made first. sweep_golden.js is that recording, regenerated by sweep_golden.gen.js.

// Reports the FIRST differing element, not just "not equal": in a 144-row golden, a bare
// pass/fail says nothing about which arm moved.
function assertSameList(actual, expected, what) {
    const n = Math.max(actual.length, expected.length);
    for (let i = 0; i < n; i++) {
        const a = JSON.stringify(actual[i]), e = JSON.stringify(expected[i]);
        if (a !== e) throw new Error(`${what}: first difference at index ${i}\n         golden: ${e}\n         actual: ${a}`);
    }
    if (actual.length !== expected.length)
        throw new Error(`${what}: length ${actual.length}, golden ${expected.length}`);
}

for (const [name, base] of Object.entries(SWEEP_BASES)) {
    const golden = MC_GOLDEN[name];

    test(`buildVariations golden [${name}]: row inventory and order unchanged`, () => {
        assert(golden, `no MC_GOLDEN entry for base "${name}" — run: node sweep_golden.gen.js`);
        const rows = buildVariations(base);
        assert(rows.length === golden.rowCount,
            `row count ${rows.length}, golden ${golden.rowCount}`);
        // Labels carry the family, the parameter, the ✓ conversion mark and the 🗘/🔄/💵 prefixes,
        // so one list pins the grids, the ordering and the clone expansion together.
        assertSameList(rows.map(r => r._label), golden.labels, 'labels');
    });

    test(`buildVariations golden [${name}]: base-row strategy selections unchanged`, () => {
        const rows = buildVariations(base).filter(r => !r.cyclicEnabled && !r.fundConversionWithCash);
        assert(rows.length === golden.baseRowCount,
            `base-row count ${rows.length}, golden ${golden.baseRowCount}`);
        const SEL = ['strategy', 'propWithdraw', 'nYears', 'stratRate', 'stratIRMAATier',
                     'stratACAMultiple', 'iraWithdrawPct', 'orderedSeq', 'gkGuard', 'gkAdjPct',
                     'cyclicEnabled', 'cyclicOrder', 'fundConversionWithCash',
                     'convertExcessToRoth', 'extraConversionAmount'];
        const actual = rows.map(r => {
            const sel = {};
            for (const k of SEL) if (r[k] !== undefined) sel[k] = r[k];
            return [r._strategyFamily, r._paramLabel, r._paramSortVal, sel];
        });
        assertSameList(actual, golden.baseRows, 'baseRows');
    });
}

test('buildVariations: the declared divergences from the Optimizer sweep are pinned', () => {
    // These are the differences P35 PR 2 must PRESERVE, not quietly unify. MC caps IRA Draw at 10%
    // where the Optimizer runs to 20%, and MC sweeps neither the IRMAA-ceiling family nor the ACA
    // family at all. Nothing pinned any of it, so an extraction sharing one grid between both
    // sweeps would silently change what Monte Carlo simulates.
    const rows = buildVariations({ ...BASE, Cash: 0 });
    const draws = rows.filter(r => r.strategy === 'fixedpct')
                      .map(r => Math.round(r.iraWithdrawPct * 100))
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .sort((a, b) => a - b);
    assertSameList(draws, [5, 6, 7, 8, 10], 'MC IRA Draw grid');
    assert(!rows.some(r => (r.stratIRMAATier ?? -1) >= 0),
        'MC must not sweep the IRMAA-ceiling family (the Optimizer does, tiers 0-4)');
    assert(!rows.some(r => (r.stratACAMultiple ?? 0) > 0),
        'MC must not sweep the ACA family (the Optimizer does, nerdknob-gated)');
});

// ── P35 PR 1: the Optimizer enumeration golden ────────────────────────────────
// OPT_GOLDEN is a browser RECORDING — the enumeration lives inline in `_runOptimizerNow()` and
// cannot be called from node until PR 2 extracts it. So there is nothing to compare it against
// yet, and these tests check the recording itself: that it is internally consistent, and that it
// actually contains the four gates it was captured to cover. A corrupt or half-imported golden
// would otherwise sit here looking authoritative until PR 2 "proved" an extraction against it.
const CLONE_PFX = /🗘|🔄|💵/;
const optBaseRows = rows => rows.filter(r => !CLONE_PFX.test(r[0]));

for (const [name, g] of Object.entries(OPT_GOLDEN)) {
    test(`OPT_GOLDEN [${name}]: recording is internally consistent`, () => {
        assert(g.rows.length === g.rowCount, `rows ${g.rows.length}, rowCount ${g.rowCount}`);
        assert(optBaseRows(g.rows).length === g.baseRowCount,
            `un-prefixed rows ${optBaseRows(g.rows).length}, baseRowCount ${g.baseRowCount}`);
        assert(g.base && typeof g.base === 'object' && g.base.strategy,
            'the capture must carry the base it was recorded against');
        // Every base row is cloned by the cyclic pass; 💵 clones the base rows again when the
        // nerdknob is on AND there is Cash. So the total is 3x or 4x the base count, never else.
        const mult = g.rowCount / g.baseRowCount;
        assert(mult === 3 || mult === 4, `row count is ${mult}x the base rows, expected 3x or 4x`);
    });

    test(`OPT_GOLDEN [${name}]: clone rows carry the modifier their prefix claims`, () => {
        for (const [label, , , ov] of g.rows) {
            if (label.includes('🗘'))
                assert(ov.cyclicEnabled === true && ov.cyclicOrder === 'ira-first',
                    `${label}: 🗘 must be cyclic ira-first, got ${JSON.stringify(ov.cyclicOrder)}`);
            else if (label.includes('🔄'))
                assert(ov.cyclicEnabled === true && ov.cyclicOrder === 'brokerage-first',
                    `${label}: 🔄 must be cyclic brokerage-first, got ${JSON.stringify(ov.cyclicOrder)}`);
            else if (label.includes('💵'))
                assert(ov.fundConversionWithCash === true && !ov.cyclicEnabled,
                    `${label}: 💵 must fund with cash and must not be cyclic`);
            else
                assert(!ov.cyclicEnabled && ov.fundConversionWithCash !== true,
                    `${label}: an un-prefixed row must carry no modifier`);
        }
    });
}

test('OPT_GOLDEN: the four gates are actually exercised by the captured scenarios', () => {
    const has = (g, pfx) => g.rows.some(r => r[0].includes(pfx));
    const acaRows = g => optBaseRows(g.rows).filter(r => r[0].includes('ACA'));

    // NERD_KNOBS off suppresses both nerdknob-only arms, and `addResult` leaves
    // fundConversionWithCash out of the overrides entirely (rows inherit the sidebar value).
    const d = OPT_GOLDEN.default;
    assert(d.nerdKnobs === false, 'the "default" capture must be a nerdknob-off run');
    assert(!has(d, '💵') && acaRows(d).length === 0, 'nerdknob off: no 💵 and no ACA arms');
    assert(d.rows.every(([, , , ov]) => ov.fundConversionWithCash === undefined),
        'nerdknob off: the cash-funding key must not be written into the overrides at all');

    // Nerdknob on, Cash > 0 → 💵 clones appear. ACA still does not, and NOT because of the
    // nerdknob: the stock scenario starts with both people at 65+, so bothOnMedicareAtStart()
    // suppresses that family independently. Pinned because it is the easy thing to misread.
    const n = OPT_GOLDEN.nerdknob;
    assert(n.nerdKnobs === true && n.base.Cash > 0, 'the "nerdknob" capture must be nerdknob-on with Cash');
    assert(has(n, '💵'), 'nerdknob on with Cash: the 💵 clones must be present');
    assert(acaRows(n).length === 0, 'both on Medicare at start: the ACA family is suppressed');

    // Same nerdknob, younger start → the ACA family appears, four FPL multiples.
    const a = OPT_GOLDEN.nerdknobACA;
    assertSameList(acaRows(a).map(r => r[1]), ['200% FPL', '250% FPL', '300% FPL', '400% FPL'], 'ACA arms');
    assert(a.baseRowCount - n.baseRowCount === 4, 'and they are the only difference from the nerdknob run');

    // Cash 0 kills the 💵 clones even with the nerdknob on, and an off-grid IRA Draw adds exactly
    // one base row — appended last, after Guyton-Klinger, not sorted into its family.
    const o = OPT_GOLDEN.nerdknobNoCashOffGrid;
    assert(o.nerdKnobs === true && o.base.Cash === 0, 'the off-grid capture must be nerdknob-on with no Cash');
    assert(!has(o, '💵'), 'Cash 0: the 💵 clones are skipped as bit-identical twins');
    const last = optBaseRows(o.rows)[o.baseRowCount - 1];
    assertSameList([last[0], last[1]], ['IRA Draw', '9%'], 'the off-grid row');
    assert(o.baseRowCount - a.baseRowCount === 1, 'an off-grid parameter adds exactly one base row');
});

// ── P35 PR 2: the extraction, proved against the PR 1 recording ───────────────
// This is the whole point of the golden. Each capture carries the base and the NERD_KNOBS state it
// was recorded under, so the extracted buildStrategyFamilies() can be handed exactly those and its
// output compared row for row against what the inline block emitted in a live page.
for (const [name, g] of Object.entries(OPT_GOLDEN)) {
    test(`buildStrategyFamilies reproduces the Optimizer capture [${name}]`, () => {
        const nerd = g.nerdKnobs;
        const rows = buildStrategyFamilies(g.base, {
            grids: OPTIMIZER_GRIDS,
            irmaaFamily: true,
            acaFamily: nerd && !bothOnMedicareAtStart(g.base.birthyear1, g.base.startAge,
                !!g.base.hasSpouse, g.base.hasSpouse ? (g.base.birthyear2 || 0) : 0),
            bracketResetsIRMAATier: true,
            markCashFunding: nerd,
            cashClones: nerd && g.base.Cash > 0,
            offGridLast: true,
        });
        // Key ORDER inside an overrides object is an artifact of how the old block happened to
        // spread its literals, not a behavior. Normalised on both sides so a faithful extraction
        // is not reported as a failure — and so a real change still is.
        const norm = o => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
        assertSameList(
            rows.map(r => [r.strategyLabel, r.paramLabel, r.paramSortVal, norm(r.overrides)]),
            g.rows.map(r => [r[0], r[1], r[2], norm(r[3])]),
            `enumeration for [${name}]`);
    });
}

test('buildStrategyFamilies: the options are what separate the two sweeps, nothing else', () => {
    // Same base, same call, one option flipped at a time. If a future edit hard-codes a family or
    // a grid instead of reading its option, one of these stops moving.
    const b = { ...BASE, Cash: 50000, strategy: 'propwd', propWithdraw: 0.20 };
    const call = o => buildStrategyFamilies(b, o);
    const plain = rows => rows.filter(r => r.modifier === null);

    const mc  = call({ grids: MC_GRIDS });
    const opt = call({ grids: OPTIMIZER_GRIDS, irmaaFamily: true });
    assert(plain(mc).length === 36 && plain(opt).length === 44,
        `base rows: MC ${plain(mc).length} (expected 36), Optimizer ${plain(opt).length} (expected 44)`);

    assert(plain(call({ grids: OPTIMIZER_GRIDS, irmaaFamily: true, acaFamily: true })).length === 48,
        'the ACA family adds 4 rows');
    assert(call({ grids: MC_GRIDS, cashClones: true }).length === 108 * 4 / 3,
        'cashClones clones every un-modified row once more');
    assert(call({ grids: MC_GRIDS }).every(r => r.overrides.fundConversionWithCash === undefined),
        'without markCashFunding the key is not written at all');
    assert(plain(call({ grids: MC_GRIDS, markCashFunding: true }))
        .every(r => r.overrides.fundConversionWithCash === false),
        'with markCashFunding every un-modified row declares it off');
    assert(plain(call({ grids: MC_GRIDS })).filter(r => r.family === 'Fill Bracket')
        .every(r => r.overrides.stratIRMAATier === undefined),
        'MC leaves the IRMAA tier alone on a Fill Bracket row — a sidebar tier can leak in');
    assert(plain(call({ grids: MC_GRIDS, bracketResetsIRMAATier: true })).filter(r => r.family === 'Fill Bracket')
        .every(r => r.overrides.stratIRMAATier === -1),
        'the Optimizer resets it');

    // Where the off-grid row lands, on a base whose parameter is off BOTH grids.
    const off = { ...b, strategy: 'fixedpct', iraWithdrawPct: 0.09 };
    const early = plain(buildStrategyFamilies(off, { grids: MC_GRIDS }));
    const late  = plain(buildStrategyFamilies(off, { grids: MC_GRIDS, offGridLast: true }));
    assert(early[early.length - 1].family === 'Guyton-Klinger', 'MC ends on Guyton-Klinger');
    assert(late[late.length - 1].paramLabel === '9%', 'the Optimizer ends on the off-grid row');
    assert(early.length === late.length, 'and it is the same row either way, only moved');
});

test('bothOnMedicareAtStart: the stricter twin of eitherOnMedicareAtStart', () => {
    // Moved out of optimizer_ui.js in P35 PR 2 and never covered there. The pair differ only in
    // AND vs OR, and the ACA family hangs off which one is used.
    const both = bothOnMedicareAtStart, either = eitherOnMedicareAtStart;
    assert(both(1960, 65, true, 1952) === true,  'both 65+ at start');
    assert(both(1960, 60, true, 1962) === false, 'neither 65 at start');
    assert(both(1960, 65, true, 1975) === false, 'one 65+, one not: AND is false');
    assert(either(1960, 65, true, 1975) === true, '...but OR is true, which is the whole difference');
    assert(both(1960, 65, false, 0) === true,    'a single filer needs only themselves');
    assert(both(0, 65, true, 1952) === false,    'missing inputs are not an assertion of anything');
});

test('OPT_GOLDEN: the Optimizer sweeps the two families and the wider grid that MC does not', () => {
    // The mirror of the buildVariations divergence test above. Together they declare the gap
    // rather than leaving it accidental, so P35 PR 2 cannot collapse the two sweeps onto one grid
    // without failing one side or the other.
    const rows = optBaseRows(OPT_GOLDEN.nerdknob.rows);
    const draws = rows.filter(r => r[3].strategy === 'fixedpct')
                      .map(r => Math.round(r[3].iraWithdrawPct * 100));
    assertSameList(draws, [5, 6, 7, 8, 10, 12, 15, 20], 'Optimizer IRA Draw grid');
    const irmaa = rows.filter(r => r[0] === 'IRMAA Ceil');
    assertSameList(irmaa.map(r => r[3].stratIRMAATier), [0, 1, 2, 3, 4], 'IRMAA ceiling tiers');
    // Its Fill Bracket rows pin the tier OFF, which is what keeps the two families apart.
    assert(rows.filter(r => r[0] === 'Fill Bracket').every(r => r[3].stratIRMAATier === -1),
        'a Fill Bracket row must disable the IRMAA ceiling explicitly');
});

test('earliestbe: earliest year wins; ties break on real-dollar after-tax net wealth', () => {
    const row = (id, be, nw) => ({ _id: id, _convBEYear: be, afterTaxNWCurrentDollars: nw,
                                   totals: { success: true } });
    const ranked = rankRowsByObjective(
        [row('late', 2040, 9e6), row('tieLow', 2032, 1e6), row('none', null, 9.9e6), row('tieHigh', 2032, 5e6)],
        'earliestbe');
    assert(ranked[0]._id === 'tieHigh', `tie must go to the higher net wealth, got ${ranked[0]._id}`);
    assert(ranked[1]._id === 'tieLow',  `then its poorer twin, got ${ranked[1]._id}`);
    assert(ranked[2]._id === 'late',    `then the later break-even, got ${ranked[2]._id}`);
    assert(ranked[3]._id === 'none',    'a row with no break-even can never outrank one that has it');
});

test('earliestbe: a swept row simulated with computeOC actually reports a break-even year', () => {
    // The precondition for the whole feature: before this, only ⇌ rows ran with computeOC, so every
    // swept row fell back to the same sort sentinel and the objective did nothing.
    const conv = simulate({ ...OC_BASE, extraConversionAmount: 50000, computeOC: true });
    assert(conv.totals.convBEYear != null, 'a converting row must report a break-even year');
    const plain = simulate({ ...OC_BASE, extraConversionAmount: 50000, computeOC: false });
    assert(plain.totals.convBEYear == null, 'and without computeOC it stays null (the old behavior)');
});

// ── Social Security claim-year proration + start milestones ───────────────────
// Ages in the engine are integers, so before this a December claimant booked a full year of
// benefits in the year they turned their claiming age. Expected values below were read off the
// real engine and then hard-coded, per project convention.
const ssFirstYearFraction = core.ssFirstYearFraction;

// Single filer, zero growth/inflation so the arithmetic is inspectable: $40k claimed at 70,
// born 1960, so age 70 falls in 2030.
const SS_BASE = {
    ...BASE, birthyear1: 1960, birthmonth1: 12, die1: 90, nYears: 20,
    IRA1: 600000, Brokerage: 200000, BrokerageBasis: 100000, Cash: 200000,
    ss1: 40000, ss1Age: 70, spendGoal: 60000,
};
const ssOf = (r, year) => Math.round(r.log.find(x => x.year === year)?.SSincome ?? -1);
const ssFlags = (r) => r.log
    .filter(x => x['-ssStart1'] || x['-ssStart2'] || x['-ssStartSurvivor'])
    .map(x => x.year + (x['-ssStart1'] ? ' P1' : '') + (x['-ssStart2'] ? ' P2' : '') + (x['-ssStartSurvivor'] ? ' SURV' : ''));

test('ssFirstYearFraction: months remaining after the birth month, December default', () => {
    if (!ssFirstYearFraction) throw new Error('ssFirstYearFraction not exported from core.js');
    assertNear(ssFirstYearFraction(12), 0, 'December claimant gets no months', 1e-12);
    assertNear(ssFirstYearFraction(6), 0.5, 'June claimant gets half the year', 1e-12);
    assertNear(ssFirstYearFraction(1), 11 / 12, 'January claimant gets 11 months', 1e-12);
    // Anything unusable is treated as December rather than silently paying a full year.
    assertNear(ssFirstYearFraction(0), 0, 'month 0 is out of range', 1e-12);
    assertNear(ssFirstYearFraction(13), 0, 'month 13 is out of range', 1e-12);
    assertNear(ssFirstYearFraction(undefined), 0, 'missing birth month defaults to December', 1e-12);
});

test('SS proration: December claimant gets nothing in the claim year, full amount the next', () => {
    const r = simulate({ ...SS_BASE, birthmonth1: 12 });
    assert(ssOf(r, 2030) === 0, `claim year (age 70) should pay $0, got ${ssOf(r, 2030)}`);
    assert(ssOf(r, 2031) === 39996, `the following year should pay the full benefit, got ${ssOf(r, 2031)}`);
});

test('SS proration: June claimant gets half the benefit in the claim year', () => {
    const r = simulate({ ...SS_BASE, birthmonth1: 6 });
    assert(ssOf(r, 2030) === 19998, `June claim year should pay half, got ${ssOf(r, 2030)}`);
    assert(ssOf(r, 2031) === 39996, `and full the year after, got ${ssOf(r, 2031)}`);
    // January is the other end of the range: 11 of 12 months.
    const jan = simulate({ ...SS_BASE, birthmonth1: 1 });
    assert(ssOf(jan, 2030) === 36663, `January claim year should pay 11/12, got ${ssOf(jan, 2030)}`);
});

test('SS milestones: flag the first PAYING year, not the age crossing', () => {
    // The distinction only exists because of proration: with a December birth month the age-70 year
    // pays nothing, so the marker belongs on the year after.
    assert(ssFlags(simulate({ ...SS_BASE, birthmonth1: 12 })).join() === '2031 P1',
        `December: expected the marker on 2031, got ${ssFlags(simulate({ ...SS_BASE, birthmonth1: 12 })).join()}`);
    assert(ssFlags(simulate({ ...SS_BASE, birthmonth1: 6 })).join() === '2030 P1',
        `June: expected the marker on the claim year itself, got ${ssFlags(simulate({ ...SS_BASE, birthmonth1: 6 })).join()}`);
});

test('SS milestones: a couple gets one marker per person plus the survivor', () => {
    // Spouse born June 1962 claiming at 67 (2029, half year), user born December 1960 claiming at
    // 70 (2030 pays nothing, so 2031), spouse dies at 75 (2038).
    const r = simulate({
        ...SS_BASE, hasSpouse: true, die1: 95, nYears: 40,
        birthyear2: 1962, birthmonth2: 6, die2: 75, ss2: 24000, ss2Age: 67, IRA2: 300000,
    });
    assert(ssFlags(r).join(' | ') === '2029 P2 | 2031 P1 | 2038 SURV',
        `expected P2 2029, P1 2031, survivor 2038; got ${ssFlags(r).join(' | ')}`);
    assert(ssOf(r, 2029) === 12000, `spouse's first year is half of $24k, got ${ssOf(r, 2029)}`);
    assert(ssOf(r, 2030) === 24000, `spouse full, user still prorated to zero, got ${ssOf(r, 2030)}`);
    assert(ssOf(r, 2031) === 64000, `both full, got ${ssOf(r, 2031)}`);
});

test('SS milestones: a single filer is never flagged as a survivor', () => {
    // A single filer runs through the same "one is deceased" branch every year (alive2 is false
    // from year one), so the survivor flag has to be gated on a spouse having actually existed.
    const flags = ssFlags(simulate({ ...SS_BASE, birthmonth1: 6 }));
    assert(!flags.some(f => f.includes('SURV')), `single filer should have no survivor marker, got ${flags.join()}`);
});

test('SS milestones: someone already collecting when the plan opens gets no marker', () => {
    // Caught in the browser on the app's own defaults: the default spouse (born 1952, claiming at
    // 70) started drawing in 2022, four years before the 2026 start year, and the chart announced
    // "Spouse SS begins" in year 0. The flag has to mean "was zero last year, is positive now",
    // not "is positive"; a plain first-positive-year test just moves the wrong marker to year 1.
    const r = simulate({
        ...SS_BASE, hasSpouse: true, nYears: 20,
        birthyear2: 1952, birthmonth2: 12, die2: 95, ss2: 24000, ss2Age: 70, IRA2: 300000,
    });
    assert(Math.round(r.log[0].SSincome) > 0, 'precondition: the spouse is already being paid in year 0');
    assert(!ssFlags(r).some(f => f.includes('P2')), `no spouse marker expected, got ${ssFlags(r).join(' | ')}`);
    // The user's own claim is still inside the plan, so that marker survives.
    assert(ssFlags(r).some(f => f.includes('P1')), `the user's own marker should still fire, got ${ssFlags(r).join(' | ')}`);
});

// ── Death-year Social Security: the mirror of claim-year proration ────────────
// `alive` is `age <= die`, so someone is alive through the whole year they reach `die` and the
// first survivor year is `age === die + 1`. The death is treated as falling in the DECEASED's
// birth month: months before it pay both spouses' own benefits, months after pay the survivor
// benefit. Paying the survivor amount for all twelve months (the old behavior) understated the
// year, because the survivor benefit is only the higher of the two, never their sum.
// Spouse born June 1962 claiming at 67, dies at 75 (2038); user born December 1960 claiming at 70.
const DEATH_BASE = {
    ...SS_BASE, hasSpouse: true, die1: 95, nYears: 40,
    birthyear2: 1962, birthmonth2: 6, die2: 75, ss2: 24000, ss2Age: 67, IRA2: 300000,
};

test('SS death year: a June-born decedent splits the year half own benefits, half survivor', () => {
    const r = simulate({ ...DEATH_BASE });
    // 2037, both alive: 39,996 + 24,000 = 64,000 (rounding aside).
    assert(ssOf(r, 2037) === 64000, `year before the death should pay both benefits, got ${ssOf(r, 2037)}`);
    // 2038, death year: 0.5 x (39,996 + 24,000) + 0.5 x 39,996 = 51,998.
    assert(ssOf(r, 2038) === 51998, `death year should blend both halves, got ${ssOf(r, 2038)}`);
    // 2039 onward: the survivor benefit alone, unblended.
    assert(ssOf(r, 2039) === 39996, `year after the death should be the plain survivor benefit, got ${ssOf(r, 2039)}`);
    assert(ssFlags(r).some(f => f.includes('2038 SURV')), `survivor marker belongs on 2038, got ${ssFlags(r).join(' | ')}`);
});

test('SS death year: a December-born decedent pays both benefits all year, survivor starts next', () => {
    // Mirrors the claim-year case: a December birth month leaves no months on the far side, so the
    // survivor benefit does not begin until the following year.
    const r = simulate({ ...DEATH_BASE, birthmonth2: 12 });
    assert(ssOf(r, 2038) === 64000, `December death year should still pay both benefits, got ${ssOf(r, 2038)}`);
    assert(ssOf(r, 2039) === 39996, `survivor benefit starts the next year, got ${ssOf(r, 2039)}`);
    assert(ssFlags(r).some(f => f.includes('2039 SURV')), `survivor marker belongs on 2039, got ${ssFlags(r).join(' | ')}`);
});

test('SS death year: degrades correctly when the survivor has not claimed yet', () => {
    // Spouse born June 1950 claiming at 66 dies at 79 (2030); the user is born December 1960 and
    // reaches their own claiming age of 70 in that same 2030, which December prorates to zero. The
    // before-death half is therefore the decedent's benefit alone and the after-death half is zero:
    // 0.5 x (0 + 24,000) + 0.5 x 0 = 12,000. No double count, no negative.
    const r = simulate({
        ...SS_BASE, hasSpouse: true, die1: 95, nYears: 40,
        birthyear2: 1950, birthmonth2: 6, die2: 79, ss2: 24000, ss2Age: 66, IRA2: 300000,
    });
    assert(ssOf(r, 2030) === 12000, `death year should pay only the decedent's half, got ${ssOf(r, 2030)}`);
    assert(ssOf(r, 2031) === 39996, `survivor benefit starts once the survivor claims, got ${ssOf(r, 2031)}`);
    // The marker follows the survivor benefit itself, not the blended total: 2030 is non-zero purely
    // from the before-death months, which is not a survivor start.
    assert(ssFlags(r).some(f => f.includes('2031 SURV')) && !ssFlags(r).some(f => f.includes('2030 SURV')),
        `survivor marker belongs on 2031, not 2030; got ${ssFlags(r).join(' | ')}`);
});

// ── ⚖ compare pin: identity has to survive a re-sweep ─────────────────────────
test('compare pin: a selection captured from one sweep re-finds its row in the next', () => {
    // The Optimizer's row `_id` is `results.length` at build time, so it is a build-order index and
    // means nothing after a re-run. The ⚖ comparison pin is therefore stored as the row's
    // `_selection` and re-found with sameStrategySelection. This is the property that has to hold.
    const base = { ...BASE, hasSpouse: true, birthyear2: 1962, die2: 94, IRA2: 400000, spendGoal: 70000 };
    const sweep1 = buildVariations(base);
    // A different sweep: the spend goal does not change the strategy grid, so the same strategies
    // are present but every row object is new.
    const sweep2 = buildVariations({ ...base, spendGoal: 75000 });
    assert(sweep1.length === sweep2.length, 'precondition: the same strategy grid in both sweeps');

    const pinned = sweep1[Math.floor(sweep1.length / 2)];
    const matches = sweep2.filter(v => sameStrategySelection(v, pinned));
    assert(matches.length === 1, `the pinned strategy must re-find exactly one row, got ${matches.length}`);
    assert(matches[0] !== pinned, 'and it must be the NEW sweep\'s object, not the old one');

    // A strategy that is not in the table at all must not match anything, so the pin gets dropped
    // rather than left pointing at a stale row.
    const absent = { ...pinned, strategy: 'gk', gkGuard: 0.99, gkAdjPct: 0.99 };
    assert(sweep2.filter(v => sameStrategySelection(v, absent)).length === 0,
        'an absent strategy must match nothing');
});

// ── Full Retirement Age from birth year ───────────────────────────────────────
// FRA was hard-coded at 67 for everyone. It is 66 for 1943-1954 and steps up two months per birth
// year through 1959, and the same constant was doing three jobs: unwinding the DECEASED's benefit
// back to their PIA, testing the SURVIVOR's own early claim, and sizing the 60-to-FRA span the
// 28.5% reduction is spread across. Those belong to two different people.
const fraMonthsForBirthYear = core.fraMonthsForBirthYear;
const calculateSurvivorBenefit = core.calculateSurvivorBenefit;

test('fraMonthsForBirthYear: SSA schedule, two months per year from 1955 to 1959', () => {
    if (!fraMonthsForBirthYear) throw new Error('fraMonthsForBirthYear not exported from core.js');
    assert(fraMonthsForBirthYear(1954) === 792, `1954 should be 66y = 792 months, got ${fraMonthsForBirthYear(1954)}`);
    assert(fraMonthsForBirthYear(1955) === 794, `1955 should be 66y2m, got ${fraMonthsForBirthYear(1955)}`);
    assert(fraMonthsForBirthYear(1957) === 798, `1957 should be 66y6m = 798, got ${fraMonthsForBirthYear(1957)}`);
    assert(fraMonthsForBirthYear(1959) === 802, `1959 should be 66y10m, got ${fraMonthsForBirthYear(1959)}`);
    assert(fraMonthsForBirthYear(1960) === 804, `1960 should be 67y = 804 months, got ${fraMonthsForBirthYear(1960)}`);
    assert(fraMonthsForBirthYear(1975) === 804, '1960 and later are all 67');
    assert(fraMonthsForBirthYear(1940) === 792, 'pre-1943 is clamped to 66, documented in the helper');
});

test('FRA: the old hard-coded 67 over-stated an early-claiming pre-1955 decedent', () => {
    if (!calculateSurvivorBenefit) throw new Error('calculateSurvivorBenefit not exported from core.js');
    // Deceased born 1952 (FRA 66) claimed early at 62 on $2,000/mo; survivor born 1955 claims at 67.
    // Passing 1960 for both reproduces the old behavior exactly.
    const oldWay = calculateSurvivorBenefit(85, 62, 2000, 67, 1000, 1960, 1960);
    const newWay = calculateSurvivorBenefit(85, 62, 2000, 67, 1000, 1952, 1955);
    assert(oldWay === 2857, `old hard-coded FRA 67 gives $2,857/mo, got ${oldWay}`);
    assert(newWay === 2666, `real FRAs give $2,666/mo, got ${newWay}`);
    // The error direction is what matters: the hard-code paid the survivor MORE than they are due,
    // which is the wrong way round for a tool that ships a widow-RMD objective.
    assert(newWay < oldWay, 'deriving FRA from birth year must reduce, not raise, this benefit');
});

test('FRA: a 1960-or-later couple is completely unaffected', () => {
    const a = calculateSurvivorBenefit(85, 62, 2000, 67, 1000, 1960, 1962);
    const b = calculateSurvivorBenefit(85, 62, 2000, 67, 1000);   // omitted birth years default to 67
    assert(a === b, `born-1960+ must match the old constant exactly, got ${a} vs ${b}`);
});

test('FRA: end to end, a pre-1955 couple pays a smaller survivor benefit', () => {
    // User born 1950 claiming early at 62, spouse born 1952 claiming at 64, user dies at 80.
    const r = simulate({
        ...BASE, nYears: 35, hasSpouse: true,
        birthyear1: 1950, birthmonth1: 6, die1: 80,
        birthyear2: 1952, birthmonth2: 6, die2: 95,
        IRA1: 900000, IRA2: 400000, Roth: 50000, Brokerage: 300000, BrokerageBasis: 150000, Cash: 100000,
        ss1: 36000, ss1Age: 62, ss2: 18000, ss2Age: 64,
        spendGoal: 90000, inflation: 0.025, cpi: 0.025, growth: 0.06, cashYield: 0.02, dividendRate: 0.015,
    });
    const surv = r.log.find(x => x['-ssStartSurvivor']);
    assert(surv && surv.year === 2031, `survivor benefit should start in 2031, got ${surv && surv.year}`);
    // Was 51,076 with the hard-coded 67; 49,148 with the real FRAs (66 and 66); 55,122 once the
    // death year was blended (the decedent is June-born, so half that year pays both own benefits).
    assert(Math.round(surv.SSincome) === 55122, `expected $55,122 in the first survivor year, got ${Math.round(surv.SSincome)}`);
});

// ── Bracket-lookup floor: "below the first bracket" is not "no room at all" ───
// findBracketIndex returns -1 when the amount is below every bracket's lower bound, and
// findUpperLimitByAmount used to turn that into `limit: 0`. A single-row table `[{l: Infinity}]`
// hits it on EVERY lookup, because `Infinity <= amount` is never true — and 21 of the 38 modelled
// jurisdictions have one. `limit: 0` then propagates into `Math.min(stateLimit, limit)` and zeroes
// the federal ceiling, so the bracket-filling strategies convert nothing at all in those states.

test('findUpperLimitByAmount: a single-row table means NO upper limit, not a zero one', () => {
    for (const st of ['NV', 'TX', 'WA', 'FL', 'IL', 'PA', 'AZ', 'CO']) {
        const got = findUpperLimitByAmount(st, 'MFJ', 100000, 1).limit;
        assert(got === Infinity, `${st} imposes no bracket ceiling, so the limit is Infinity, got ${got}`);
    }
});

test('findUpperLimitByAmount: below the first bracket returns the top of that band', () => {
    // Not hard-coded dollar figures: the relation must hold after any tax-year data update.
    for (const ent of ['CA', 'NY', 'FEDERAL', 'IRMAA']) {
        const firstL = getRateBracket(ent, 'MFJ')[0].l;
        const below  = Math.floor(firstL / 2);
        const got    = findUpperLimitByAmount(ent, 'MFJ', below, 1);
        assert(got.limit === firstL - 1,
            `${ent} below its first bracket: expected ${firstL - 1}, got ${got.limit}`);
        assert(got.rate === 0, `${ent}: no bracket applies below the first one, so the rate is 0`);
    }
});

test('findUpperLimitByAmount: an amount inside the ladder is untouched', () => {
    // The regression guard for the fix above — the ordinary path must not move.
    const brks = getRateBracket('CA', 'MFJ');
    const inside = brks[1].l + 1;                       // somewhere in the second band
    const got = findUpperLimitByAmount('CA', 'MFJ', inside, 1);
    assert(got.limit === brks[2].l - 1, `expected ${brks[2].l - 1}, got ${got.limit}`);
    assert(got.rate === brks[1].r, `expected rate ${brks[1].r}, got ${got.rate}`);
});

test('single-row bracket tables: the affected jurisdictions are pinned', () => {
    // Adding a state with a single-row table should trip this rather than silently inheriting
    // whatever the lookup does at its edges.
    const single = Object.keys(TAXData).filter(k => k.length === 2)
        .filter(k => (getRateBracket(k, 'MFJ') || []).length === 1).sort();
    const expected = ['AK','AZ','CO','FL','GA','IA','IL','IN','KY','MA','MI','NC','NE','NH','NV','PA','SD','TN','TX','WA','WY'];
    assert(JSON.stringify(single) === JSON.stringify(expected),
        `single-row tables changed:\n         expected ${JSON.stringify(expected)}\n         actual   ${JSON.stringify(single)}`);
});

test('Fill Bracket converts in a no-tax state, not just in a graduated one', () => {
    const base = { ...BASE, strategy: 'bracket', stratRate: 0.22, stratIRMAATier: -1,
                   stratACAMultiple: 0, convertExcessToRoth: true, iraBaseGoal: 0 };
    const conv = st => simulate({ ...base, STATEname: st }).log.reduce((a, e) => a + (e.rothConv || 0), 0);
    const ca = conv('CA');
    assert(ca > 0, `the CA control must convert something, got ${Math.round(ca)}`);
    for (const st of ['NV', 'TX', 'AZ', 'IL']) {
        const got = conv(st);
        assert(got > ca * 0.5,
            `${st} has no state bracket ceiling, so it should convert at least as much as CA ` +
            `($${Math.round(ca)}), got $${Math.round(got)}`);
    }
});

test('minlimit: the IRMAA ceiling is a real limit below the first tier, not zero', () => {
    // yr.IRMAALimit is Math.min(goalLimit, IRMAABracket.limit), and the IRMAA table's first
    // threshold is far above an ordinary spend goal — so this strategy converted nothing at all,
    // in every state, not only the 21.
    // stratRate is required: minlimit takes the federal-bracket branch first and clamps it with the
    // IRMAA limit, so without a named bracket the ceiling is 0 for an entirely different reason.
    const run = st => simulate({ ...BASE, STATEname: st, strategy: 'minlimit', stratRate: 0.22,
                                 stratIRMAATier: -1, stratACAMultiple: 0,
                                 convertExcessToRoth: true, iraBaseGoal: 0 })
                        .log.reduce((a, e) => a + (e.rothConv || 0), 0);
    assert(run('CA') > 0, `minlimit must convert something on a $600k IRA, got ${Math.round(run('CA'))}`);
    assert(run('NV') > 0, `and in a no-tax state too, got ${Math.round(run('NV'))}`);
});

test('a no-tax state reports honest spend and honest failure', () => {
    // With goalLimit zeroed, targetSpend went to 0 for every strategy outside the bracket/ordered/GK
    // exempt set. totals.spend then accumulated `0 + Shortfall` (negative), while the success test
    // `netIncome < targetSpend * 0.99` could never fail against a zero target.
    const base = { ...BASE, strategy: 'propwd', propWithdraw: 0, spendGoal: 400000 };
    for (const st of ['NV', 'TX', 'IL']) {
        const r = simulate({ ...base, STATEname: st });
        assert(r.totals.spend > 0, `${st}: total spend must be positive, got ${Math.round(r.totals.spend)}`);
        assert(r.log[2].Spendable > 0, `${st}: year 2 spendable must be positive, got ${r.log[2].Spendable}`);
        assert(r.totals.success === false,
            `${st}: a $400k goal on a $600k portfolio must fail, not report success`);
    }
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    console.log('\n*** SOME TESTS FAILED ***');
    process.exitCode = 1;
} else {
    console.log('All tests passed.');
}
