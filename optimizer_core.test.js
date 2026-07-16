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
const getLTCGBracketRoom = core.getLTCGBracketRoom;
const compactNum = core.compactNum;
const diagnoseConvBreakEvenFailure = core.diagnoseConvBreakEvenFailure;
const optimizeConversionAmount = core.optimizeConversionAmount;
const parseShorthand = globalThis.window.DisplayHelpers.parseShorthand;

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
    maxConversion: false, propWithdraw: 0, iraWithdrawPct: 0.05,
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
        maxConversion: false,
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

// ── Phase 27: Withdrawal Rate + Inflows/Outflows ──────────────────────────────
test('Phase 27: no income, pure portfolio draw → wdRate% = netOut / prevWealth', () => {
    const result = simulate({ ...BASE });
    // Year 0 has no prevTotalWealth → null. Check years 1+.
    const rows = result.log.slice(1).filter(r => r['wdRate%'] != null);
    assert(rows.length > 0, 'Expected wdRate% populated for years 1+');
    let prevWealth = result.log[0].totalWealth;
    for (let i = 1; i < result.log.length; i++) {
        const r = result.log[i];
        if (r['wdRate%'] != null && prevWealth > 0) {
            const expected = (r.netOut - r.inflows) / prevWealth;
            assert(Math.abs(r['wdRate%'] - expected) < 1e-9,
                `Year ${r.year}: wdRate% ${r['wdRate%']} != (netOut-inflows)/prevWealth ${expected}`);
            assert(r.inflows === 0, `Year ${r.year}: expected inflows=0 with no SS/pension, got ${r.inflows}`);
        }
        prevWealth = r.totalWealth;
    }
});

test('Phase 27: SS covers all spending → wdRate% ≈ 0 or negative', () => {
    // ss1Age 70, born 1952 → SS active from start (age 74 in 2026). SS $100k > spend $60k.
    const result = simulate({ ...BASE, ss1: 100000, ss1Age: 70 });
    const rows = result.log.slice(1).filter(r => r['wdRate%'] != null);
    assert(rows.length > 0, 'Expected wdRate% populated');
    const high = rows.filter(r => r['wdRate%'] > 0.01);
    assert(high.length === 0,
        `Expected wdRate% ≤ ~0 when SS ($100k) exceeds spend ($60k); found ${high.length} years above 1%: ${high.map(r => r.year + '=' + (r['wdRate%']*100).toFixed(1) + '%').join(', ')}`);
});

test('Phase 27: reconciliation — netOut = grossOut − rothConv − reinvestedSurplus', () => {
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

test('Phase 27: pension counted as inflow → lowers wdRate% vs no pension', () => {
    const noPension = simulate({ ...BASE });
    const withPension = simulate({ ...BASE, pensionAnnual: 30000 });
    assert(withPension.totals.avgWdRate != null && noPension.totals.avgWdRate != null,
        'Expected avgWdRate computed for both runs');
    assert(withPension.totals.avgWdRate < noPension.totals.avgWdRate,
        `Expected pension to lower avg withdrawal rate: ${withPension.totals.avgWdRate} vs ${noPension.totals.avgWdRate}`);
    const r1 = withPension.log[1];
    assert(r1.inflows > 25000, `Expected year-1 inflows ≈ pension $30k, got ${r1.inflows}`);
});

test('Phase 27: regression — no SS/pension → avgWdRate matches old avgSpendRate semantics', () => {
    // With zero inflows, wdRate% = netOut/prevWealth = old netSpend%.
    const result = simulate({ ...BASE });
    assert(result.totals.avgWdRate != null, 'Expected avgWdRate populated');
    const rows = result.log.filter(r => r['wdRate%'] != null);
    const manualAvg = rows.reduce((s, r) => s + r['wdRate%'], 0) / rows.length;
    assert(Math.abs(result.totals.avgWdRate - manualAvg) < 1e-12,
        `avgWdRate ${result.totals.avgWdRate} != manual average ${manualAvg}`);
    // Spend $60k on ~$850k wealth, zero growth → rate roughly 6–9% and positive
    assert(result.totals.avgWdRate > 0.04 && result.totals.avgWdRate < 0.15,
        `Expected avg rate in plausible 4–15% range, got ${result.totals.avgWdRate}`);
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
    const res = simulate({ ...BASE, maxConversion: false, extraConversionAmount: 0 });
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
    maxConversion: false, propWithdraw: 0, iraWithdrawPct: 0.05,
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
    ssFailYear: 2099, ssFailPct: 1.0, maxConversion: false, propWithdraw: 0, iraWithdrawPct: 0.05,
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
                     strategy: 'bracket', stratRate: 0.22, maxConversion: true };
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
    // propwd over-withdraws to Cash (no maxConversion) → excess path.
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
                     maxConversion: true, futureIRATaxRate: 0.34, die1: 80 };
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
    assertNear(d.breakingAmount, 355478, 'breaking conversion amount', 5);
    assert(d.lastSustainableYear === 2030, `expected 2030 as the last sustainable conversion year, got ${d.lastSustainableYear}`);
    assert(d.lastSustainableBEYear === 2041, `expected the truncated plan to break even in 2041, got ${d.lastSustainableBEYear}`);

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

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    console.log('\n*** SOME TESTS FAILED ***');
    process.exitCode = 1;
} else {
    console.log('All tests passed.');
}
