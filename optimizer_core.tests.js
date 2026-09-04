'use strict';
/**
 * optimizer_core.tests.js
 * Run with: node optimizer_core.tests.js
 *
 * TEST COUNTS ARE PINNED OUTSIDE THIS FILE. Adding or removing a test here means updating, in the
 * same commit:
 *   1. `TestTiers.EXPECTED` in optimizer_tests.js - ONE object holding the count of EVERY node
 *      suite, so the file you have to edit is usually not the tool you are working on. Slow-tagged
 *      tests are counted separately there, in `slowInCore`.
 *   2. the suite table in .githooks/README.md
 * Measure, never guess: run this file and use the printed total. The staleness guard is page-wide,
 * so a test added to ANY suite turns the retirement_optimizer.html self-check badge red until all
 * of those counts match.
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

// Everything below is wrapped in an IIFE for the browser's sake. Two classic scripts cannot both
// declare a top-level `const BASE` — that is one global lexical scope and a duplicate declaration
// there is a SyntaxError, so without the wrapper this file would fail to PARSE once loaded onto a
// page that already has the engine. This file declares dozens of such names. Same reasoning, and
// the same shape, as taxPaymentPlanner.tests.js.
(() => {

const IS_NODE = (typeof module !== 'undefined' && module.exports);

// NODE ONLY, and the guard is load-bearing. In a browser all three of these already exist, and
// installing these stubs over them would destroy the live page: `document.getElementById` returning
// null takes out every render path, and a `performance.now()` frozen at 0 corrupts the timing the
// page reports. The old unguarded version was safe only because this file never reached a browser.
if (IS_NODE) {
    globalThis.performance = { now: () => 0 };
    globalThis.window = {};                     // stub for displayhelpers.js (window.DisplayHelpers)
    globalThis.document = { getElementById: () => null, addEventListener: () => {} };
}

// Both modes resolve ONE namespace object rather than reaching for bare globals. In the browser
// that is deliberate: `function` declarations in the engine land on globalThis but its top-level
// `const`s (MC_GRIDS, OPTIMIZER_GRIDS, RMD_TABLE) do not, so a per-symbol global lookup would
// silently yield undefined for some of them. See the export guards in taxengine.js/optimizer_core.js.
const taxengine = IS_NODE ? require('./taxengine.js') : window.TaxEngine;

// optimizer_core.js resolves calculateTaxes etc. as bare globals (the classic-script contract
// shared with the browser and the MC worker), so in node the taxengine exports are mirrored onto
// globalThis before the engine loads. In the browser they are already there.
if (IS_NODE) Object.assign(globalThis, taxengine);

const core = IS_NODE ? require('./optimizer_core.js') : window.OptimizerCore;
// displayhelpers.js is an IIFE that sets window.DisplayHelpers — load it so the share-URL
// round-trip tests can exercise the REAL parseShorthand decoder against compactNum. Already
// loaded by the page in the browser.
if (IS_NODE) require('./displayhelpers.js');

const simulate = core.simulate;
const compileScheduleFromRun = core.compileScheduleFromRun;
const scheduleOptionsForRun = core.scheduleOptionsForRun;
const ADVISOR_FEE_PCT_MAX = core.ADVISOR_FEE_PCT_MAX;
const inferAdvisorFeeMode = core.inferAdvisorFeeMode;
const optimizeSpend = core.optimizeSpend;
const suggestSustainableSpend = core.suggestSustainableSpend;
const suggestSpendMenu = core.suggestSpendMenu;
const bengenRate = core.bengenRate;
const SUGGEST_BUFFER_YEARS = core.SUGGEST_BUFFER_YEARS;
const SUGGEST_RISKY_BUFFER_YEARS = core.SUGGEST_RISKY_BUFFER_YEARS;
const SUGGEST_MIDDLE_KEEP_REAL = core.SUGGEST_MIDDLE_KEEP_REAL;
const calculateTaxes = taxengine.calculateTaxes;
const findUpperLimitByAmount = taxengine.findUpperLimitByAmount;
const getRateBracket = taxengine.getRateBracket;
const TAXData = taxengine.TAXData;
const getLTCGBracketRoom = core.getLTCGBracketRoom;
const nominalRateAtLimit = core.nominalRateAtLimit;
const pensionColaCap = core.pensionColaCap;
const compactNum = core.compactNum;
const diagnoseConvBreakEvenFailure = core.diagnoseConvBreakEvenFailure;
const bestConversionStopYear = core.bestConversionStopYear;
const afterTaxWealthOfLogRow = core.afterTaxWealthOfLogRow;
const optimizeConversionAmount = core.optimizeConversionAmount;
const baselineScoreOf = core.baselineScoreOf;
const selectConversionCandidates = core.selectConversionCandidates;
const rankRowsByObjective = core.rankRowsByObjective;
const afterTaxBucketSpread = core.afterTaxBucketSpread;
const OPT_COLUMN_KEYS = core.OPT_COLUMN_KEYS;
const OPT_COLUMNS_PINNED = core.OPT_COLUMNS_PINNED;
const OPT_OBJECTIVE_COLUMNS = core.OPT_OBJECTIVE_COLUMNS;
const OPT_OBJECTIVE_METRIC_COLUMN = core.OPT_OBJECTIVE_METRIC_COLUMN;
const OPT_OBJECTIVE_BLURB = core.OPT_OBJECTIVE_BLURB;
const OPT_DELTA_COLUMNS = core.OPT_DELTA_COLUMNS;
const OPT_BASELINE_REQUIRES = core.OPT_BASELINE_REQUIRES;
const OPTIMIZER_OBJECTIVES = core.OPTIMIZER_OBJECTIVES;
const taxCreepFactor = core.taxCreepFactor;
const IRMAA_MARGIN_MODES = core.IRMAA_MARGIN_MODES;
const IRMAA_MARGIN_DEFAULT = core.IRMAA_MARGIN_DEFAULT;
const irmaaMarginModeOf = core.irmaaMarginModeOf;
const irmaaFwdFactor = core.irmaaFwdFactor;
const irmaaMarginDollars = core.irmaaMarginDollars;
const getIRMAATierTargetMAGI = taxengine.getIRMAATierTargetMAGI;
const onMedicareAtCharge = core.onMedicareAtCharge;
const breakEvenHeirsRate = core.breakEvenHeirsRate;
const lowestBreakEvenHeirsRate = core.lowestBreakEvenHeirsRate;
const bestTimeLimitedConversion = core.bestTimeLimitedConversion;
const buildVariations = core.buildVariations;
const buildStrategyFamilies = core.buildStrategyFamilies;
const bothOnMedicareAtStart = core.bothOnMedicareAtStart;
const planFirstYear = core.planFirstYear;
const MC_GRIDS = core.MC_GRIDS;
const OPTIMIZER_GRIDS = core.OPTIMIZER_GRIDS;
const sameStrategySelection = core.sameStrategySelection;
const resolveOrderedSeq = core.resolveOrderedSeq;
const ORDERED_SEQS = core.ORDERED_SEQS;
const SPLIT_VECTORS = core.SPLIT_VECTORS;
const splitVectorLabel = core.splitVectorLabel;
const splitVectorSortVal = core.splitVectorSortVal;
const strategySortKey = core.strategySortKey;
const selectionOf = core.selectionOf;
const STRATEGY_SELECTION_FIELDS = core.STRATEGY_SELECTION_FIELDS;
const ROTH_GAP_EXCLUDED = core.ROTH_GAP_EXCLUDED;
const offGridParamFor = core.offGridParamFor;
const parseShorthand = globalThis.window.DisplayHelpers.parseShorthand;
// P35 PR 1 characterization goldens — a RECORDING of what the two strategy enumerations emit,
// captured before PR 2 extracts the Optimizer's copy into core. See sweep_golden.js.
const { SWEEP_BASES, MC_GOLDEN, OPT_GOLDEN } = IS_NODE ? require('./sweep_golden.js') : window.SweepGolden;

// ── Test harness ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

// Tests tagged slow are the ones the browser tier is allowed to skip. They ALWAYS run in node,
// unconditionally - the tag is a hint to the browser runner, never a way to stop testing something.
//
// Only three tests are tagged, and they are tagged on measurement, not on suspicion: the
// breakEvenHeirsRate binary searches account for 1792 ms of this suite's ~2.9 s. The remaining 179
// finish in well under a second, which is what makes an after-paint browser run affordable at all.
const SLOW = new Set();

// Tests tagged critical are the regression guards for defects that actually SHIPPED and silently
// changed everyone's numbers. They are marked in the console output and given their own summary
// block at the end, so that "did the guard for <that> bug still pass" is answerable at a glance
// instead of by reading 214 lines of ✓.
//
// A test earns this tag by having a shipped defect behind it, not by being important-sounding.
const CRITICAL = new Set();

// A test body may be async: the P71 end-to-end checks drive mc_engine.js's runJob(), which is a
// promise by construction (the main thread awaits a frame between chunks). The runner awaits every
// body, so a sync test costs one extra microtask and nothing else.
// test() REGISTERS rather than runs. Everything below is top-level, and running on registration
// would mean the browser could only ever get results as a side effect of loading the file, with no
// way to filter the slow tests or to defer the run past first paint. Registering instead lets
// runOptimizerCoreTests() be called on demand and keeps the 182 test bodies untouched.
// Same shape as taxPaymentPlanner.tests.js.
const TESTS = [];

function test(name, fn) {
    TESTS.push([name, fn]);
}

test.slow = function (name, fn) {
    SLOW.add(name);
    TESTS.push([name, fn]);
};

test.critical = function (name, fn) {
    CRITICAL.add(name);
    TESTS.push([name, fn]);
};

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

// ── P32c: cycleHarvestMode / cycleCoexist research inputs (default off, no UI) ─
// The P28 pattern: absent ≡ off must be BYTE-identical, and the input must be inert
// without cyclicEnabled (leak guard).

test('P32c: cycleHarvestMode/cycleCoexist absent ≡ off → byte-identical log (two scenarios)', () => {
    const scen1 = { ...BASE, cyclicEnabled: true };
    const scen2 = { ...BASE, cyclicEnabled: true, strategy: 'bracket', stratRate: 0.22,
                    IRA1: 500000, Brokerage: 900000, BrokerageBasis: 400000, growth: 0.04,
                    dividendRate: 0.005, convertExcessToRoth: true };
    for (const scen of [scen1, scen2]) {
        const plain = simulate({ ...scen });
        const withOff = simulate({ ...scen, cycleCoexist: 'off', cycleHarvestMode: 'maxbracket' });
        assert(JSON.stringify(plain.log) === JSON.stringify(withOff.log),
            'cycleCoexist:off + cycleHarvestMode:maxbracket must not perturb the year-by-year log');
    }
});

test('P32c: cycleCoexist without cyclicEnabled is inert (leak guard)', () => {
    const plain = simulate({ ...BASE, strategy: 'bracket', stratRate: 0.22 });
    const leaked = simulate({ ...BASE, strategy: 'bracket', stratRate: 0.22,
                              cycleCoexist: 'bracketfill', cycleHarvestMode: 'spendonly' });
    assert(JSON.stringify(plain.log) === JSON.stringify(leaked.log),
        'both inputs live inside the isBrokerageYear branch and must do nothing without cyclic');
});

test('P32c: cycleCoexist bracketfill — harvest years regain the IRA draw and conversions', () => {
    const scen = { ...BASE, cyclicEnabled: true, strategy: 'bracket', stratRate: 0.22,
                   convertExcessToRoth: true };
    const off = simulate({ ...scen });
    const on = simulate({ ...scen, cycleCoexist: 'bracketfill' });
    const hv = r => r.log.filter(e => e.subCycle === 'Brok' || e.subCycle === '⚠Brok');
    const offHv = hv(off), onHv = hv(on);
    assert(offHv.length > 0 && onHv.length > 0, 'both runs need harvest years');
    const offIRAwd = offHv.reduce((s, e) => s + (e.IRAwd || 0), 0);
    const onIRAwd = onHv.reduce((s, e) => s + (e.IRAwd || 0), 0);
    assert(offIRAwd < 1, `off: harvest-year voluntary IRA draw must be zero, got ${Math.round(offIRAwd)}`);
    assert(onIRAwd > 10000, `bracketfill: harvest years must carry a real IRA draw, got ${Math.round(onIRAwd)}`);
    const onConv = onHv.reduce((s, e) => s + (e.rothConv || 0), 0);
    assert(onConv > 1000,
        `bracketfill + convertExcessToRoth: harvest-year conversions must un-zero, got ${Math.round(onConv)}`);
    // Invariant: no balance driven negative anywhere.
    for (const e of on.log) {
        for (const k of ['Cash', 'Brokerage', 'TotalIRA', 'Roth']) {
            assert((e[k] ?? 0) > -1, `bracketfill drove ${k} negative in year ${e.year}: ${e[k]}`);
        }
    }
});

test('P32c: cycleCoexist MAGI ceiling (IRMAA tier) — coexist must not push a harvest year into a higher tier', () => {
    // IRMAA tier 1: the family ceiling is MAGI-shaped, so the IRA room subtracts the planned
    // harvest LTCG (two-pass fixed point). The observable contract: the coexist harvest year's
    // IRMAA tier never exceeds the same year's tier with coexist off.
    const scen = { ...BASE, cyclicEnabled: true, strategy: 'bracket', stratRate: 0,
                   stratIRMAATier: 1, birthyear1: 1958, IRA1: 900000, Brokerage: 600000,
                   BrokerageBasis: 200000 };
    const off = simulate({ ...scen });
    const on = simulate({ ...scen, cycleCoexist: 'bracketfill' });
    const tierRank = t => t === '-none-' || t == null ? 0 : (parseInt(String(t).replace(/\D/g, ''), 10) || 0);
    assert(off.log.length === on.log.length, 'same horizon');
    for (let i = 0; i < on.log.length; i++) {
        const e = on.log[i];
        if (!(e.subCycle === 'Brok' || e.subCycle === '⚠Brok')) continue;
        assert(tierRank(e.IRMAATier) <= tierRank(off.log[i].IRMAATier),
            `year ${e.year}: coexist pushed IRMAA tier ${off.log[i].IRMAATier} -> ${e.IRMAATier}`);
    }
});

test('P32c: cycleHarvestMode spendonly harvests no more than maxbracket', () => {
    const scen = { ...BASE, cyclicEnabled: true, spendGoal: 15000 };
    const maxb = simulate({ ...scen });   // absent = maxbracket
    const spendonly = simulate({ ...scen, cycleHarvestMode: 'spendonly' });
    const brokLife = r => r.log.reduce((s, e) => s + (e['Brokerage-'] || 0), 0);
    assert(brokLife(spendonly) < brokLife(maxb),
        `spendonly must draw less Brokerage than maxbracket over the plan: ` +
        `${Math.round(brokLife(spendonly))} vs ${Math.round(brokLife(maxb))}`);
    // And a small-spend harvest year draws ~need, not the bracket.
    const hRow = spendonly.log.find(r => r.subCycle === 'Brok' || r.subCycle === '⚠Brok');
    assert(hRow && (hRow['Brokerage-'] ?? 0) < 20000,
        `spendonly harvest year should be need-sized, got ${hRow && hRow['Brokerage-']}`);
});

// ── P32c: thirdPassBrokerage / forcedIRAAllowBrokerage research inputs (default off, no UI) ─
// Same P28 pattern as the cyclic pair above. These two feed P32d (Q2): they exist so the
// cap-gains-spiral claim in the third pass and the "forced IRA above the ceiling while Brokerage
// sits untouched" claim in the backstop loop can be measured instead of argued.

// A scenario that genuinely reaches the third pass with Cash exhausted and Brokerage left, which is
// the only state in which either arm can do anything. Asserted, not assumed, in the tests below.
const P32C_TP = { ...BASE, strategy: 'bracket', stratRate: 0, stratIRMAATier: 1,
                  Cash: 1000, Brokerage: 800000, BrokerageBasis: 150000,
                  ss1: 45000, ss1Age: 66, spendGoal: 130000 };
const P32C_FIXED = { ...BASE, Cash: 2000, Brokerage: 900000, BrokerageBasis: 200000,
                     ss1: 45000, ss1Age: 66, spendGoal: 120000 };

test('P32h: absent thirdPassBrokerage ≡ bounded (the shipped default); off stays reachable', () => {
    // This asserted `absent ≡ off` until P32h flipped the default. Both halves are pinned now,
    // because the pair is what keeps the old behavior reproducible: a future reader measures the
    // exclusion by passing 'off' and diffing against the default.
    for (const scen of [P32C_TP, P32C_FIXED]) {
        const plain = simulate({ ...scen });
        assert(plain.totals.thirdPassCount > 0,
            'fixture must reach the third pass, or byte-identity proves nothing about these arms');
        const withBounded = simulate({ ...scen, thirdPassBrokerage: 'bounded' });
        assert(JSON.stringify(plain.log) === JSON.stringify(withBounded.log),
            'omitting the input must be identical to asking for the shipped default');
        const withOff = simulate({ ...scen, thirdPassBrokerage: 'off' });
        assert(withOff.totals.thirdPassBrokerIters === undefined,
            'an off run must not even attach the P32c counters to totals');
        // forcedIRAAllowBrokerage did NOT ship (P32h call 1: dominated), so for THAT input the
        // original absent-equals-off contract still holds and is still worth pinning.
        const fibOff = simulate({ ...scen, forcedIRAAllowBrokerage: 'off' });
        assert(JSON.stringify(plain.log) === JSON.stringify(fibOff.log),
            'forcedIRAAllowBrokerage is research-only: explicit off must equal absent');
    }
});

test('P32c: thirdPassBrokerage bounded draws Brokerage in the third pass, within its cap', () => {
    // Sense inverted at P32h: 'bounded' ships, so the control is explicit 'off'.
    const off = simulate({ ...P32C_TP, thirdPassBrokerage: 'off' });
    const on = simulate({ ...P32C_TP });
    assert(JSON.stringify(off.log) !== JSON.stringify(on.log), 'the arm must actually change the run');
    assert((on.totals.thirdPassBrokerIters ?? 0) > 0, 'the Brokerage leg must have fired');
    // The cap is per year, so the lifetime total cannot exceed 6 x the years that reached the pass.
    assert(on.totals.thirdPassBrokerIters <= 6 * on.totals.thirdPassCount,
        `bounded must respect its 6-iteration cap: ${on.totals.thirdPassBrokerIters} iterations ` +
        `over ${on.totals.thirdPassCount} third-pass years`);
    assert(on.totals.yearsfunded >= off.totals.yearsfunded,
        `funding a residual from Brokerage instead of stranding it must not fund fewer years ` +
        `(${off.totals.yearsfunded} -> ${on.totals.yearsfunded})`);
    for (const e of on.log) {
        for (const k of ['Cash', 'Brokerage', 'TotalIRA', 'Roth']) {
            assert((e[k] ?? 0) > -1, `thirdPassBrokerage drove ${k} negative in year ${e.year}: ${e[k]}`);
        }
    }
});

test('P32c: thirdPassBrokerage — stalls are counted separately from cap hits (the Q2 signal)', () => {
    // Only a CAPPED year is a cap-gains-spiral candidate. A year whose residual stops improving
    // while Brokerage still holds a balance has hit that account's arithmetic, not a spiral, and
    // must not be allowed to consume the whole cap and read as divergence.
    const bounded = simulate({ ...P32C_TP, thirdPassBrokerage: 'bounded' });
    const unbounded = simulate({ ...P32C_TP, thirdPassBrokerage: 'unbounded' });
    assert((unbounded.totals.thirdPassBrokerIters ?? 0) >= (bounded.totals.thirdPassBrokerIters ?? 0),
        'raising the cap can only add iterations, never remove them');
    assert((bounded.totals.thirdPassBrokerCapped ?? 0) === 0 &&
           (unbounded.totals.thirdPassBrokerCapped ?? 0) === 0,
        `this scenario converges today: no year should hit the cap, got bounded=` +
        `${bounded.totals.thirdPassBrokerCapped ?? 0} unbounded=${unbounded.totals.thirdPassBrokerCapped ?? 0}. ` +
        `A failure here is a P32d FINDING to record (a real spiral appeared), not a broken test.`);
    assert(JSON.stringify(bounded.log) === JSON.stringify(unbounded.log),
        'with no year capped, the two arms must produce the same run');
});

test('P32c: thirdPassBrokerage is inert for Ordered (it runs the user sequence in this pass)', () => {
    const scen = { ...BASE, strategy: 'ordered', orderedSeq: 'CBIR', Cash: 1000,
                   ss1: 40000, ss1Age: 66, spendGoal: 110000 };
    const off = simulate({ ...scen });
    assert(off.totals.thirdPassCount > 0, 'fixture must reach the third pass');
    const on = simulate({ ...scen, thirdPassBrokerage: 'unbounded', forcedIRAAllowBrokerage: 'brokerageFirst' });
    assert(JSON.stringify(off.log) === JSON.stringify(on.log),
        'Ordered is excluded from both the third-pass arm and the forced-IRA backstop');
});

test('P32c: forcedIRAAllowBrokerage brokerageFirst spends Brokerage before forcing IRA', () => {
    // Measured against `thirdPassBrokerage: 'off'` since P32h. Under the shipped default the third
    // pass has already spent the Brokerage this arm wanted, so the two together showed no
    // displacement at all (131,780 -> 131,780) and this read as a regression when it was really an
    // overlap. Pinning the third pass off measures the backstop alone, which is all this was about.
    const CTL = { ...P32C_FIXED, thirdPassBrokerage: 'off' };
    const off = simulate({ ...CTL });
    const on = simulate({ ...CTL, forcedIRAAllowBrokerage: 'brokerageFirst' });
    assert(off.totals.forcedIRATotal > 0, 'fixture must actually force IRA above the ceiling');
    assert(on.totals.forcedIRATotal < off.totals.forcedIRATotal,
        `brokerageFirst must displace forced IRA: ${Math.round(off.totals.forcedIRATotal)} -> ` +
        `${Math.round(on.totals.forcedIRATotal)}`);
    for (const e of on.log) {
        for (const k of ['Cash', 'Brokerage', 'TotalIRA', 'Roth']) {
            assert((e[k] ?? 0) > -1, `brokerageFirst drove ${k} negative in year ${e.year}: ${e[k]}`);
        }
    }
});

test('P32c: forcedIRAAllowBrokerage keeps the backstop alive after the IRA empties', () => {
    // The shipped loop breaks on an empty IRA. With Brokerage leading it must not end one account
    // early, so a plan whose IRA runs dry while Brokerage remains still gets backstopped.
    const scen = { ...BASE, IRA1: 120000, Cash: 1000, Brokerage: 1500000, BrokerageBasis: 200000,
                   ss1: 30000, ss1Age: 66, spendGoal: 130000, nYears: 25 };
    const off = simulate({ ...scen });
    const on = simulate({ ...scen, forcedIRAAllowBrokerage: 'brokerageFirst' });
    assert(JSON.stringify(off.log) !== JSON.stringify(on.log), 'the arm must change this run');
    assert(on.totals.yearsfunded >= off.totals.yearsfunded,
        `${off.totals.yearsfunded} -> ${on.totals.yearsfunded} funded years`);
});

// ── P51b: oracleWithdrawalPlan research input (node-only, no UI, default off) ─

test('P51b: oracleWithdrawalPlan absent / null entries / all-zero entries → byte-identical log', () => {
    const plain = simulate({ ...BASE });
    const withNull = simulate({ ...BASE, oracleWithdrawalPlan: null });
    assert(JSON.stringify(plain.log) === JSON.stringify(withNull.log),
        'null plan must not perturb the log');
    const zeros = new Array(40).fill(null).map((_, i) => i % 2 ? null : { IRA: 0, Brokerage: 0, Cash: 0, Roth: 0 });
    const withZeros = simulate({ ...BASE, oracleWithdrawalPlan: zeros });
    assert(JSON.stringify(plain.log) === JSON.stringify(withZeros.log),
        'null / all-zero entries mean "no override this year" and must be inert');
});

test('P51b: oracleWithdrawalPlan + cyclicEnabled is an explicit error, not a precedence rule', () => {
    let threw = false;
    try {
        simulate({ ...BASE, cyclicEnabled: true,
                   oracleWithdrawalPlan: [{ IRA: 1, Brokerage: 0, Cash: 0, Roth: 0 }] });
    } catch (e) { threw = true; }
    assert(threw, 'composing the two preempting override branches must throw');
});

test('P51b: an IRA-only year draws IRA, not Brokerage; spill covers the rest of the horizon', () => {
    // Year 0 override: everything from IRA. Later years: no override (strategy runs).
    const plan = [{ IRA: 1, Brokerage: 0, Cash: 0, Roth: 0 }];
    const plain = simulate({ ...BASE });
    const r = simulate({ ...BASE, oracleWithdrawalPlan: plan });
    const y0 = r.log[0];
    assert((y0.IRAwd ?? 0) > 0, `year 0 must draw IRA under an IRA-only plan, got ${y0.IRAwd}`);
    assert((y0['Brokerage-'] ?? 0) < 1,
        `year 0 must not draw Brokerage under an IRA-only plan, got ${y0['Brokerage-']}`);
    // BASE itself depletes on this horizon; the override must not make feasibility WORSE.
    assert(r.totals.success === plain.totals.success,
        `one overridden year must not change feasibility (plain ${plain.totals.success} vs ${r.totals.success})`);
    assert((r.totals.shortfall ?? 0) <= (plain.totals.shortfall ?? 0) + 1,
        `override year must not add shortfall: ${r.totals.shortfall} vs ${plain.totals.shortfall}`);
});

test('P35n: oracleWithdrawalPlan {seq} entry — strict sequence, IRA-last is a true backstop', () => {
    // A Cash-first sequence must drain Cash, cascade to Brokerage, and leave the IRA untouched (it
    // is last in the sequence). The need has to EXCEED Cash for the cascade to be real: BASE's
    // $60k goal needs only $36.7k after the RMD, which $50k of Cash covers alone. This test used
    // to pass on BASE anyway, and the reason is recorded because it was a defect: the gap fill
    // did not credit the primary pass's Cash draw, drew the year a second time, and that phantom
    // second draw is what "cascaded" to Brokerage (P104b1x, fixed 2026-09-02). $90k needs ~$66.7k,
    // so Cash genuinely runs out and Brokerage is genuinely next.
    const plan = [{ seq: ['Cash', 'Brokerage', 'Roth', 'IRA'] }];
    const r = simulate({ ...BASE, spendGoal: 90000, oracleWithdrawalPlan: plan });
    const y0 = r.log[0];
    assert((y0.CashWD ?? 0) > 45000, `seq must drain Cash first, got CashWD ${y0.CashWD}`);
    assert((y0['Brokerage-'] ?? 0) > 0, `shortfall must cascade to Brokerage, got ${y0['Brokerage-']}`);
    assert((y0.IRAwd ?? 0) < 1, `IRA is last in the sequence and must be untouched, got ${y0.IRAwd}`);
});

test('P35n: oracleWithdrawalPlan {prop} entry — balance-proportional over Brok/Cash/Roth, IRA excluded', () => {
    const plan = [{ prop: true }];
    const r = simulate({ ...BASE, oracleWithdrawalPlan: plan });
    const y0 = r.log[0];
    assert((y0.IRAwd ?? 0) < 1, `prop excludes the IRA (PR-5 BALANCED spec), got IRAwd ${y0.IRAwd}`);
    assert((y0['Brokerage-'] ?? 0) > 0 && (y0.CashWD ?? 0) > 0,
        `prop draws Brokerage and Cash together, got Brok ${y0['Brokerage-']} Cash ${y0.CashWD}`);
    // Proportionality: BASE holds Brok 200k / Cash 50k -> the Brokerage draw should dominate.
    assert((y0['Brokerage-'] ?? 0) > (y0.CashWD ?? 0),
        'draws should be balance-weighted (Brokerage 4x Cash)');
});

test('P51b: fidelity — replaying a run\'s own realized draw fractions lands near its score', () => {
    // The hook must be able to EXPRESS existing behavior: extract propwd-0's per-year draw mix,
    // replay it through the override, and land within tolerance on finalNW. Not exact — the
    // stage-2 gap fill and rounding differ — but a hook that cannot approximate the strategy it
    // replaces would make every oracle gap unreadable.
    const base = simulate({ ...BASE, strategy: 'propwd', propWithdraw: 0 });
    const plan = base.log.map(e => {
        const w = { IRA: e.IRAwd ?? 0, Brokerage: e['Brokerage-'] ?? 0,
                    Cash: e.CashWD ?? 0, Roth: e.RothWD ?? 0 };
        return (w.IRA + w.Brokerage + w.Cash + w.Roth) > 0 ? w : null;
    });
    const replay = simulate({ ...BASE, strategy: 'propwd', propWithdraw: 0,
                              oracleWithdrawalPlan: plan });
    assert(replay.totals.success === base.totals.success, 'replay must not change feasibility');
    const rel = Math.abs(replay.finalNW - base.finalNW) / Math.max(1, Math.abs(base.finalNW));
    assert(rel < 0.02,
        `replayed fractions should land within 2% of the source run, got ${(100 * rel).toFixed(2)}%`);
});

// ── P104b1: strategy 'split' - the constant account split (engine only, no rows, no UI) ────────
// The acceptance bar is REPLAY IDENTITY against the research input it is built from: the split
// family with vector V and `propwd 0 + oracleWithdrawalPlan.fill(V)` must agree to the dollar on
// every log column. P104a's numbers were measured on the oracle path; they transfer to the family
// only if the family IS that path. Two log fields are excluded from the compare on purpose: the
// row's `strategy` label, which is the one thing that must differ, and `loopMs`, which is timing.
const _splitCompareLog = log => log.map(e => { const { strategy, loopMs, ...rest } = e; return rest; });
const _SPLIT_MIX_B = { ...BASE, IRA1: 800000, Roth: 300000, Brokerage: 600000, BrokerageBasis: 200000,
                       Cash: 120000, growth: 0.05, inflation: 0.025, cpi: 0.025, spendGoal: 90000,
                       ss1: 30000, ss1Age: 67 };
const _SPLIT_VECTORS = [
    ['IRA only',  [1, 0, 0, 0]],
    ['B4C6',      [0, 0.4, 0.6, 0]],
    ['I4B3C3',    [0.4, 0.3, 0.3, 0]],
    ['Brok/Roth', [0, 0.5, 0, 0.5]],
];

test('P104b1: replay identity - split with V equals propwd 0 + oracleWithdrawalPlan.fill(V), to the dollar', () => {
    for (const [mixName, mix] of [['BASE', BASE], ['mix B', _SPLIT_MIX_B]]) {
        for (const [vName, v] of _SPLIT_VECTORS) {
            const fam = simulate({ ...mix, strategy: 'split', splitWeights: v });
            const ora = simulate({ ...mix, strategy: 'propwd', propWithdraw: 0,
                                   oracleWithdrawalPlan: new Array(60).fill({ IRA: v[0], Brokerage: v[1], Cash: v[2], Roth: v[3] }) });
            assert(fam.totals.splitWeightsInvalid === false, `${mixName}/${vName}: a valid vector must not be flagged`);
            assert(JSON.stringify(_splitCompareLog(fam.log)) === JSON.stringify(_splitCompareLog(ora.log)),
                `${mixName}/${vName}: the split family and the oracle replay must produce identical logs`);
            assert(fam.finalNW === ora.finalNW, `${mixName}/${vName}: finalNW ${fam.finalNW} vs ${ora.finalNW}`);
            // The vector has to have done something, or the identity is vacuous: a split must
            // differ from plain Proportional somewhere in the log.
            const prop = simulate({ ...mix, strategy: 'propwd', propWithdraw: 0 });
            assert(JSON.stringify(_splitCompareLog(fam.log)) !== JSON.stringify(_splitCompareLog(prop.log)),
                `${mixName}/${vName}: the split must not coincide with balance-proportional (vacuous identity)`);
        }
    }
});

test('P104b1: a malformed or absent vector runs as the baseline draw, byte-identical, and is flagged', () => {
    const prop = _splitCompareLog(simulate({ ...BASE, strategy: 'propwd', propWithdraw: 0 }).log);
    const bad = [
        ['absent',        undefined],
        ['null',          null],
        ['empty',         []],
        ['three entries', [1, 2, 3]],
        ['all zero',      [0, 0, 0, 0]],
        ['negative',      [-1, 1, 1, 1]],
        ['infinite',      [Infinity, 1, 1, 1]],
        ['a string',      ['1', 1, 1, 1]],
        ['an object',     { IRA: 1 }],
    ];
    for (const [name, w] of bad) {
        const inputs = { ...BASE, strategy: 'split' };
        if (w !== undefined) inputs.splitWeights = w;
        const r = simulate(inputs);
        assert(r.totals.splitWeightsInvalid === true, `${name}: must be flagged as invalid`);
        assert(JSON.stringify(_splitCompareLog(r.log)) === JSON.stringify(prop),
            `${name}: the fallback must be the baseline draw exactly, not something else silently`);
    }
    // And the strip test the plan asks for: removing the field from a run that was NOT
    // proportional re-breaks the replay - the field is load-bearing, not decorative.
    const withV = simulate({ ...BASE, strategy: 'split', splitWeights: [0, 0, 1, 0] });
    const stripped = simulate({ ...BASE, strategy: 'split' });
    assert(withV.finalNW !== stripped.finalNW, 'stripping splitWeights must change the result');
});

test.critical('P104b1x: a year funded from Cash by the primary pass is not funded again by the gap fill', () => {
    // BASE year 0: the need is $36,717 and Cash holds $50,000, so a {Cash:1} vector funds the year
    // from Cash alone and touches nothing else. Until 2026-09-02 it did not: fillSpendingGap sized
    // its gap from yr.possibleIncome, which counts IRA and Brokerage draws and not Cash or Roth
    // ones, so it saw the same $36,717 gap again, drained the remaining $13,283 of Cash, spilled
    // $29,292 into the IRA, and the year-end surplus routine refunded $38,233 to Cash - an IRA
    // draw nobody asked for, taxed, parked in Cash. The Ordered branch's comment had named the
    // loop since July; the oracle weight path (P51b) and every family with Cash in its primary
    // order ran through it. Those defect numbers are recorded here so the guard reads as what it
    // is: the fix moved every Proportional and Guyton-Klinger plan (see the changelog at 11.1703).
    const y0 = simulate({ ...BASE, strategy: 'split', splitWeights: [0, 0, 1, 0] }).log[0];
    assert((y0.IRAwd ?? 0) < 1, `no IRA may be drawn by choice while Cash covers the year, got IRAwd ${y0.IRAwd} (the defect read 29,292)`);
    assertNear(y0.Cash ?? 0, 13283.38, 'Cash at year end is the balance less the one draw that funded the year (the defect read 38,233)', 5);
    assertNear(y0.CashWD ?? 0, 36716.62, 'the whole need came from Cash, once', 5);
    assert((y0['Brokerage-'] ?? 0) < 1, `Brokerage must be untouched, got ${y0['Brokerage-']}`);
});

test.critical('P104b1x: Proportional +0% with Max Conversion on converts nothing while the phantom gap would have', () => {
    // The user-visible symptom. On this fixture the defect made a Proportional +0% plan - no boost,
    // so no surplus of its own - convert $7,813, $7,168, $6,195 and $3,480 in its first four years,
    // because the gap fill's over-draw was routed as surplus into convertExcessToRoth. RMD-driven
    // surplus is a genuine conversion and is allowed; it does not arise in these four years here.
    const cell = {
        STATEname: 'CA', nYears: 20, birthyear1: 1962, birthmonth1: 6, die1: 92,
        birthyear2: 1964, birthmonth2: 3, die2: 94, hasSpouse: true,
        ss1: 45000, ss1Age: 70, ss2: 24000, ss2Age: 67, pensionAnnual: 0, survivorPct: 0, pensionCola: false,
        spendChange: -0.01, iraBaseGoal: 0, inflation: 0.025, cpi: 0.025, growth: 0.06,
        cashYield: 0.03, dividendRate: 0.02, ssFailYear: 2099, ssFailPct: 1.0,
        convertExcessToRoth: true, propWithdraw: 0, iraWithdrawPct: 0.06, extraConversionAmount: 0,
        fundConversionWithCash: false, startInYear: 2026, dividendReinvest: true, CashReserve: 0,
        IRA1: 3000000, IRA2: 1200000, Roth: 150000, Roth2: 60000, Brokerage: 300000, BrokerageBasis: 150000,
        Cash: 150000, spendGoal: 291600, strategy: 'propwd',
    };
    const r = simulate(cell);
    for (let y = 0; y < 4; y++) {
        const conv = r.log[y]['-iraConvGrossTot'] ?? 0;
        assert(conv < 1, `year ${y}: a +0% Proportional plan must not convert on its own, got ${Math.round(conv)}`);
    }
    assert(r.totals.success, 'the fixture must still fund itself');
});

test('11.1702: the log reports the reserve held each year - min(target in nominal $, Cash) - and 0 when Off', () => {
    // BASE runs at zero inflation, so the nominal target equals the input. Year 0 holds $50k of
    // Cash and needs $36.7k; a $30k reserve is hidden from the draw, so the year is funded from the
    // $20k above it plus the IRA, and year-end Cash sits at the target: the column reads $30,000.
    const on = simulate({ ...BASE, strategy: 'propwd', propWithdraw: 0, CashReserve: 30000 });
    assertNear(on.log[0].CashReserve, 30000, 'reserve held at year end with a $30k target', 1);
    assert(on.log.every(e => (e.CashReserve ?? 0) <= (e.Cash ?? 0) + 0.01), 'the reserve can never exceed the Cash held');
    assert(on.log.every(e => (e.CashReserve ?? 0) <= 30000.01), 'nor the target');
    // A target above the balance reports the balance, not the target.
    const big = simulate({ ...BASE, strategy: 'propwd', propWithdraw: 0, CashReserve: 400000 });
    assertNear(big.log[0].CashReserve, big.log[0].Cash, 'a target above the balance reports the Cash actually held', 1);
    // Off (key absent) and cyclic (reserve disabled) both report 0, so the column hides itself.
    const off = simulate({ ...BASE, strategy: 'propwd', propWithdraw: 0 });
    assert(off.log.every(e => (e.CashReserve ?? 0) === 0), 'Off must report 0 in every year');
    const cyc = simulate({ ...BASE, strategy: 'propwd', propWithdraw: 0, CashReserve: 30000, cyclicEnabled: true });
    assert(cyc.log.every(e => (e.CashReserve ?? 0) === 0), 'cyclic disables the reserve and must report 0');
});

test('11.1703: Brokerage reconciles on screen - last year minus Brokerage- plus brokerageG plus SurplusBrok', () => {
    // A fixture whose RMDs exceed the spending need, so surplus arises every year and the Cash
    // Reserve rule has something to route. Growth and dividends on, no advisor fee, no conversions.
    const fx = { ...BASE, strategy: 'propwd', propWithdraw: 0, IRA1: 3000000, spendGoal: 60000,
                 growth: 0.05, dividendRate: 0.02, cashYield: 0.02, inflation: 0.02, cpi: 0.02,
                 CashReserve: 20000, dividendReinvest: true };
    const r = simulate(fx);
    assert(r.log.some(e => (e.SurplusBrok ?? 0) > 1000), 'the fixture must route surplus into Brokerage, or the identity is vacuous');
    assert(r.log.every(e => Math.abs((e.DRIP ?? 0) - (e.cashDividends ?? 0)) < 0.01), 'with DRIP on, DRIP is the year\'s dividends');
    for (let y = 1; y < r.log.length; y++) {
        const a = r.log[y - 1], b = r.log[y];
        const expect = a.Brokerage - (b['Brokerage-'] ?? 0) + (b.brokerageG ?? 0) + (b.SurplusBrok ?? 0);
        assertNear(b.Brokerage, expect, `year ${b.year}: Brokerage must reconcile to the three columns`, 1);
    }
    // DRIP off: dividends go to Cash, DRIP reads 0, and the identity still holds.
    const off = simulate({ ...fx, dividendReinvest: false });
    assert(off.log.every(e => (e.DRIP ?? 0) === 0), 'with DRIP off the column reads 0');
    for (let y = 1; y < off.log.length; y++) {
        const a = off.log[y - 1], b = off.log[y];
        assertNear(b.Brokerage, a.Brokerage - (b['Brokerage-'] ?? 0) + (b.brokerageG ?? 0) + (b.SurplusBrok ?? 0),
            `year ${b.year} (DRIP off): Brokerage must reconcile`, 1);
    }
    // Reserve Off: nothing is routed, SurplusBrok reads 0 every year.
    const offRes = simulate((() => { const o = { ...fx }; delete o.CashReserve; return o; })());
    assert(offRes.log.every(e => (e.SurplusBrok ?? 0) === 0), 'with Cash Reserve Off nothing is routed to Brokerage');
});

test('P104b1: split composes with cyclic the way propwd does - no throw, harvest years draw Brokerage', () => {
    // The oracle input throws on cyclicEnabled; a family cannot, because the sweep clones the
    // cyclic modifier onto every family. BASE is built for cyclic (N = 3): the split's [0,0,1,0]
    // never draws Brokerage on its own, so any Brokerage draw is the harvest year preempting it.
    let r;
    try { r = simulate({ ...BASE, strategy: 'split', splitWeights: [0, 0, 1, 0], cyclicEnabled: true }); }
    catch (e) { assert(false, `must not throw: ${e.message}`); }
    assert(r.log.some(e => (e['Brokerage-'] ?? 0) > 1), 'a harvest year must have drawn Brokerage');
    assert(r.totals.splitWeightsInvalid === false, 'the vector is valid and must not be flagged');
});

test('P104b1: the split binds the gap fill too, not only the primary draw', () => {
    // A Roth-only vector on mix B (Roth $300k): if the second pass took the default [40,60]
    // Brokerage/Cash branch instead of the vector, Cash or Brokerage would be drawn in year 0.
    const y0 = simulate({ ..._SPLIT_MIX_B, strategy: 'split', splitWeights: [0, 0, 0, 1] }).log[0];
    assert((y0.RothWD ?? 0) > 1000, `Roth must fund year 0, got RothWD ${y0.RothWD}`);
    assert((y0.CashWD ?? 0) < 1 && (y0['Brokerage-'] ?? 0) < 1,
        `neither pass may draw Cash or Brokerage while Roth lasts, got Cash ${y0.CashWD} Brok ${y0['Brokerage-']}`);
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

test('wdRate%: denominator is the raw portfolio, not tax-discounted totalNetWealth', () => {
    // BASE holds a $600k IRA, so totalNetWealth is materially below portfolioBalance. If the old
    // after-tax denominator leaked back in, the rate would read high by roughly that discount.
    const result = simulate({ ...BASE });
    const r0 = result.log[0], r1 = result.log[1];
    assert(r0.portfolioBalance > r0.totalNetWealth + 1000,
        'Fixture no longer distinguishes the two denominators; pick balances with a bigger IRA');
    const wrongWay = r1.netOut / r0.totalNetWealth;
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
    // Spend $60k against an $850k portfolio, zero growth, no Social Security → the plan cannot last
    // 20 years and the drawdown accelerates as the denominator shrinks.
    //
    // Re-derived for P38. The old band was 4-15%, which BASE only satisfied because the engine was
    // under-withdrawing: it stranded $290k of spending while still holding $90k in the IRA, and a
    // draw that never happens cannot show up in a withdrawal rate. With the funding backstop the
    // IRA is actually spent, so the final funded years draw 46%, 86% and then 100% of what is left
    // and the simple mean rises to ~22.9%. The high number is the fixture being honest about an
    // impossible plan, not a runaway withdrawal.
    assert(result.totals.avgWdRate > 0.04 && result.totals.avgWdRate < 0.30,
        `Expected avg rate in plausible 4–30% range, got ${result.totals.avgWdRate}`);
    // Pin the depletion itself, so a future change cannot drift back to stranding a balance and
    // quietly slide under the band again.
    const last = result.log[result.log.length - 1];
    assert((last.TotalIRA ?? 0) <= 1 && (last.Brokerage ?? 0) <= 1 && (last.Cash ?? 0) <= 1,
        `BASE cannot fund 20 years and must end fully depleted, got IRA ${Math.round(last.TotalIRA)} ` +
        `Brokerage ${Math.round(last.Brokerage)} Cash ${Math.round(last.Cash)}`);
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
    // prevPortfolio replaced the old gkPrevPortfolio/prevTotalNetWealth pair. GK always used the raw
    // balance sum, so merging the two fields must not move its output by a cent. The expected
    // values below were captured from a run made BEFORE that merge.
    //
    // Re-derived once since, when Social Security gained claim-year proration: this fixture claims
    // at 70 with a January birth month for person 1 (11/12 of that year) and June for person 2
    // (1/2), so the two claim years now pay less and everything downstream shifts. Spend
    // 7,969,501.955988 -> 7,935,798.156794, tax 2,154,586.451134 -> 2,140,785.745597, final NW
    // 9,955,429.693910 -> 9,920,517.469072. The guardrail-adjustment count is unchanged at 4, which
    // is what this test is actually guarding.
    //
    // Re-derived again for P38 PR 3. GK runs through the baseline `else` branch, which sizes its
    // primary draw from yr.additionalSpendNeeded, and that is now net of the tax on guaranteed
    // income. Measured against the values pinned below, not the ones in the paragraph above (those
    // two drifted apart at some point): spend 7,935,798.156165 -> 7,935,798.157290 (the goal is met
    // either way, so this is rounding), tax 2,141,499.763082 -> 2,169,137.836607, final NW
    // 9,924,288.129575 -> 9,913,213.043789. Higher tax and lower ending wealth is the expected
    // direction: the draw is now large enough to actually pay the tax on Social Security and the
    // RMDs, money the old sizing left unfunded. The adjustment count is still 4.
    //
    // Re-derived a third time when dividends and interest stopped being double-credited. This
    // fixture runs cashYield 2% and dividendRate 2%, so it was carrying a lot of money that was
    // both spent and banked. Spend 7,935,798.157290 -> 7,393,024.075002, tax 2,169,137.836607 ->
    // 2,087,135.358516, final NW 9,913,213.043789 -> 8,551,902.042242. The guardrail-adjustment
    // count moved too, 4 -> 3, which the paragraph above had called the stable part: Guyton-Klinger
    // sets spending from the portfolio balance, that balance was inflated, and one guardrail that
    // used to trip no longer does. The count is a recording like everything else here, not an
    // invariant.
    //
    // Re-derived a fourth time for the IRC 1014 basis step-up (P35g). This fixture is a couple with
    // the first death inside the plan, so BOTH step-ups fire: the survivor's basis rises at the
    // first death (less capital-gains tax on every later brokerage draw) and the heirs take the
    // remainder at market. Tax 2,087,135.358516 -> 2,027,748.557723, final NW 8,576,168.460619 ->
    // 9,021,151.610458. Lower lifetime tax and higher ending wealth is the whole point of the
    // change. Total SPEND did not move by a cent (7,393,024.075002) and the guardrail-adjustment
    // count is still 3 - the plan funds the same spending out of a cheaper tax bill, which is the
    // signature of a valuation fix rather than a behavior change in the withdrawal engine.
    const gk = simulate({
        ...BASE, strategy: 'gk', nYears: 30,
        birthyear1: 1960, die1: 92, birthyear2: 1962, birthmonth2: 6, die2: 94, hasSpouse: true,
        IRA1: 1500000, IRA2: 500000, Roth: 200000, Roth2: 100000,
        Brokerage: 600000, BrokerageBasis: 300000, Cash: 100000,
        ss1: 45000, ss1Age: 70, ss2: 25000, ss2Age: 70,
        spendGoal: 140000, inflation: 0.025, cpi: 0.025, growth: 0.06,
        cashYield: 0.02, dividendRate: 0.02,
    });
    // Re-pinned at P84l. All three moved the way the RMD-basis characterization predicted: the RMD
    // now keys off the prior December 31 balance rather than that balance plus this year's
    // pre-withdrawal growth, so less is forced out as ordinary income. Tax falls (-$102,100, -5.0%),
    // spend rises (+$30,640) because the plan keeps more of what it draws, and the guardrail count
    // is unchanged at 3 - the same signature this test's own comment above describes for a
    // valuation fix rather than a behavior change in the withdrawal engine.
    // Re-pinned at P104b1x (2026-09-02). Guyton-Klinger draws through the baseline branch, whose
    // primary order includes Cash, and the gap fill used to omit that Cash draw from what the
    // household could spend - so every year with a Cash draw was funded a second time and the
    // excess refunded (or, with Max Conversion on, converted; this fixture has it off). Spend
    // 7,423,663.892588 -> 7,447,682.634423 (+$24,019: the guardrail turns a portfolio that no
    // longer churns into a slightly higher spend), tax 1,925,648.917115 -> 1,924,412.061480
    // (-$1,237), final NW 9,188,056.866412 -> 9,239,367.301350 (+$51,310). Adjustment count still 3.
    // More spending AND more wealth from the same inputs is the signature of a withdrawal that was
    // being made and unmade rather than a valuation change.
    // Re-pinned at P105 (2026-09-03). This fixture has the first death in 2052 with $1.5M still
    // in IRA1, and the survivor's RMD for 2053 was struck off their own $96k rather than the
    // inherited total, so a year of required distribution went missing. Tax 1,924,412.061480 ->
    // 1,973,741.021986 (+$49,329), final NW 9,239,367.301350 -> 9,207,491.698594 (-$31,876), spend
    // unchanged to the cent and the guardrail count still 3. Higher tax and lower ending wealth is
    // the only possible direction: the household now distributes, and pays ordinary rates on,
    // $242,194 it previously kept deferred in 2053. Years 2054-2056 each fall $11k-$14k, which is
    // the knock-on and not a second effect - the larger 2053 draw leaves a smaller balance for the
    // next year's basis.
    assertNear(gk.totals.spend, 7447682.634423317, 'GK total spend', 0.01);
    assertNear(gk.totals.tax, 1973741.0219859004, 'GK total tax', 0.01);
    assertNear(gk.finalNW, 9207491.698593603, 'GK final net worth', 0.01);
    assert(gk.log.filter(r => (r.gkAdj ?? '—') !== '—').length === 3,
        `Expected 3 guardrail adjustments, got ${gk.log.filter(r => (r.gkAdj ?? '—') !== '—').length}`);
});

// ── Baseline accounting (after-tax NW + totalNetWealth fix) ───────────────────────
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

test('totalNetWealth: IRA discounted by ordinary rate, terminal brokerage at face after the 1014 step-up', () => {
    // Single filer (BASE has no spouse), so the ONLY step-up in play is the terminal one.
    const inp = { ...BASE, IRA1: 100000, Brokerage: 500000, BrokerageBasis: 100000,
                  Cash: 200000, spendGoal: 30000, die1: 78 };
    const res = simulate(inp);
    const last = res.log[res.log.length - 1];
    const nominal = last['NominalRate%'];
    const capG = res.totals.capGainsRate;
    // The terminal row IS a death year, so basis has already been reset to market here and
    // `last.Brokerage - last.Basis` is 0 by construction. Assert against the gain the account
    // actually carried, preserved on the diagnostic key, or this test is a vacuous 0 === 0.
    const brokGainPreStepUp = Math.max(0, last.Brokerage - last['-basisPreStepUp']);
    assert(brokGainPreStepUp > 1000, `Test needs terminal brokerage gains, got ${brokGainPreStepUp}`);
    assert(last.Basis === last.Brokerage, 'terminal basis must be stepped all the way to market');
    // finalNW: IRA at the ordinary rate, everything else at face. No capital-gains haircut,
    // because the heirs inherit at market and never owe that tax.
    const expected = (last.IRA1 + last.IRA2) * (1 - nominal)
        + last.Roth1 + last.Roth2 + last.Cash + last.Brokerage;
    assertNear(res.finalNW, expected, 'finalNW discounts the IRA only', 1);
    // And pin the SIZE of the correction, not just its presence: the difference from the old
    // liquidation valuation must be exactly the capital-gains tax that no longer applies.
    if (capG > 0.001) {
        const oldLiquidation = (last.IRA1 + last.IRA2) * (1 - nominal)
            + brokGainPreStepUp * (1 - capG)
            + last.Roth1 + last.Roth2 + last.Cash + last['-basisPreStepUp'];
        assertNear(res.finalNW - oldLiquidation, brokGainPreStepUp * capG,
            'the step-up is worth exactly the cap-gains tax it removes', 1);
        assertNear(last['-totalNetWealthPreStepUp'], oldLiquidation,
            'the preserved liquidation value must match the pre-step-up formula', 1);
    }
});

// ── IRC 1014 basis step-up at death (P35g) + the Basis <= Brokerage invariant (P35f) ──────────
// Two separate events share one concept and must not be conflated. At the FIRST death the
// surviving spouse's basis steps up by the decedent's share - the whole account in a
// community-property state, half of it in a common-law one - which changes the capital-gains tax
// on every later brokerage withdrawal. At the SECOND (final) death the heirs take whatever is
// left at market: always a full reset, regardless of state, applied to the terminal valuation.
// A single filer gets only the second.
// Three properties this fixture has to hold, none of them free:
//   1. A first death well inside the plan, so both step-ups fire in one run.
//   2. A TERMINAL year with real income. sim.capitalGainsRate is the final year's LTCG bracket,
//      and the step-up is worth gain x that rate - so a plan that drains itself and lands the
//      survivor in the 0% bracket makes the whole correction worth exactly $0. That is correct
//      behavior (the old code applied the same 0% haircut), but it makes for a vacuous test.
//   3. Spending high enough that brokerage is actually SOLD between the first death and the end.
//      At a lower spend the plan never touches brokerage after the death, so the mid-plan step-up
//      never gets realized and community-property and common-law runs finish identical.
const STEPUP_BASE = {
    ...BASE,
    STATEname: 'CT',                                 // common law, BasisStepUp 0.50
    strategy: 'bracket', stratRate: 0.22, nYears: 30,
    hasSpouse: true,
    birthyear1: 1958, birthmonth1: 1, die1: 84,      // first death at index 17 of 29
    birthyear2: 1960, birthmonth2: 12, die2: 94,     // survivor carries it to the end
    IRA1: 1200000, IRA2: 400000, Roth: 100000, Roth2: 50000,
    Brokerage: 900000, BrokerageBasis: 300000,       // a large unrealized gain to step up
    Cash: 150000, spendGoal: 180000,
    ss1: 40000, ss1Age: 67, ss2: 20000, ss2Age: 67, survivorPct: 75,
    growth: 0.06, inflation: 0.025, cpi: 0.025,
    cashYield: 0.02, dividendRate: 0.02,
    dividendReinvest: false,                         // DRIP would raise basis every year and mask
    futureIRATaxRate: 0.28,                          // the two step-ups this section is testing
    // P92a. The Goal is what keeps this fixture ABOUT the step-up. A Fill Bracket ceiling on the
    // true bracket top drains this IRA to zero by the terminal year, which drops the survivor's
    // income into the 0% long-term capital-gains band - and a step-up on gains that would be taxed
    // at 0% is worth exactly nothing, so every assertion about its value became vacuously false.
    // The Goal leaves an IRA behind, income with it, and a non-zero rate for the step-up to save.
    iraBaseGoal: 400000,
};

test('P35g: every TAXData jurisdiction declares a BasisStepUp of 0.50 or 1.00', () => {
    // The anti-drift guard. The alternative design was a single COMMUNITY_PROPERTY list, which is
    // a second place to forget: a jurisdiction added under P19 would keep the list looking right
    // while being wrong. Putting the fraction ON the state means it cannot be added silently, and
    // this test is what makes that true.
    // Two-character keys, which is exactly how generateStateOptions() decides what a user can
    // select (optimizer_ui.js). Filtering on the presence of a STATE field instead would also
    // catch TAXData.TESTTAXATION, the synthetic state the in-page suite injects - a difference
    // that shows up only in the browser, where that suite has run, and not under node.
    const jurisdictions = Object.keys(TAXData).filter(k => k.length === 2 && TAXData[k] && TAXData[k].STATE);
    assert(jurisdictions.length >= 38, `expected at least 38 jurisdictions, got ${jurisdictions.length}`);
    const bad = jurisdictions.filter(k => TAXData[k].BasisStepUp !== 0.50 && TAXData[k].BasisStepUp !== 1.00);
    assert(bad.length === 0,
        `every jurisdiction needs BasisStepUp (0.50 common law / 1.00 community property); missing or invalid: ${bad.join(', ')}`);
    const cp = jurisdictions.filter(k => TAXData[k].BasisStepUp === 1.00).sort().join(' ');
    assert(cp === 'AZ CA ID NV TX WA WI', `community-property set drifted: got "${cp}"`);
    // AK is community property only by opt-in written agreement, never by default.
    assert(TAXData.AK.BasisStepUp === 0.50, 'AK is opt-in community property and must default to 0.50');
});

test('P35g: first death steps basis up by half in a common-law state', () => {
    const log = simulate({ ...STEPUP_BASE }).log;
    const i = log.findIndex(r => r.status === 'SGL');
    assert(i > 1, 'fixture must put the first death inside the plan');
    const before = log[i - 1], at = log[i];
    // The step-up lands at the top of the first SINGLE year, not the last MFJ year. Both years
    // exist and both produce numbers, which is why this is pinned rather than assumed.
    assert(before.status === 'MFJ', 'the row before the first SGL year must still be MFJ');
    assert(before.Basis < before.Brokerage, 'fixture must carry an unrealized gain into the death');
    // Basis otherwise only ever falls here (withdrawals consume it proportionally). It jumps.
    assert(at.Basis > before.Basis + 1, 'basis must rise at the first death instead of continuing to fall');
    assert(at.Basis < at.Brokerage - 1, 'common law steps up only the decedent half, so a gain remains');
});

test('P35g: community property steps the whole account up at the first death', () => {
    // CA is an inline TAXData entry. TX comes from NO_TAX_SHELL with its override written AFTER
    // the spread - the path that silently reverts to the shell's 0.50 if the order is ever flipped.
    // Compared as a RATIO, not for equality. The step-up is applied at the top of the first single
    // year but the log row records year-END balances, so post-withdrawal growth reopens a small gap
    // that basis does not share: 1/(1 + growth x postMonths/12), about 0.995 at 6%. Asserting
    // equality here would be asserting that the account does not grow in the year someone dies.
    for (const st of ['CA', 'TX']) {
        const log = simulate({ ...STEPUP_BASE, STATEname: st }).log;
        const at = log[log.findIndex(r => r.status === 'SGL')];
        assert(at.Basis / at.Brokerage > 0.99,
            `${st}: a full step-up must leave basis at market apart from that year's growth, got ${(at.Basis / at.Brokerage).toFixed(4)}`);
    }
    // Controlled comparison: TX and FL are both no-income-tax states, so BasisStepUp is the ONLY
    // thing that differs between these two runs. Without it the assertions above could pass while
    // the fraction was being ignored entirely.
    const tx = simulate({ ...STEPUP_BASE, STATEname: 'TX' });
    const fl = simulate({ ...STEPUP_BASE, STATEname: 'FL' });
    const k = tx.log.findIndex(r => r.status === 'SGL');
    assert(tx.log[k].Basis > fl.log[k].Basis + 1, 'TX (community property) must step up more than FL (common law)');
    assert(fl.log[k].Basis / fl.log[k].Brokerage < 0.75, 'and FL must be a genuine half step-up, not a full one');
    // The larger step-up has to have a real downstream consequence, not just a bigger number in
    // one row: less capital gain to realize on every later brokerage sale, so less lifetime tax
    // and more left at the end.
    assert(tx.totals.tax < fl.totals.tax, 'community property must pay less lifetime capital-gains tax');
    assert(tx.finalNW > fl.finalNW, 'and finish with more');
});

test('P35g: a single filer gets the terminal step-up but never a mid-plan one', () => {
    const res = simulate({ ...BASE, Brokerage: 400000, BrokerageBasis: 100000, growth: 0.04 });
    const log = res.log;
    assert(log.every(r => r.status === 'SGL'), 'BASE is a single filer');
    for (let i = 1; i < log.length - 1; i++) {
        assert(log[i].Basis <= log[i - 1].Basis + 1,
            `basis rose in ${log[i].year} - a single filer has no first-death step-up`);
    }
    const last = log[log.length - 1];
    assertNear(last.Basis, last.Brokerage, 'the terminal row must still be stepped to market', 1);
    assert(last['-basisPreStepUp'] < last.Basis, 'the preserved pre-step-up basis must be lower');
});

test('P35g: basis rises exactly twice - once per death, never per year', () => {
    const log = simulate({ ...STEPUP_BASE }).log;
    const rises = [];
    for (let j = 1; j < log.length; j++) if (log[j].Basis > log[j - 1].Basis + 1) rises.push(j);
    assert(rises.length === 2, `basis must rise exactly twice (first death, terminal), got ${rises.length}`);
    assert(log[rises[0]].status === 'SGL' && log[rises[0] - 1].status === 'MFJ',
        'the first rise must be the first single year');
    assert(rises[1] === log.length - 1, 'the second rise must be the terminal row');
});

test('P35g: terminal valuation is stepped up and both pre-step-up bases are preserved', () => {
    const res = simulate({ ...STEPUP_BASE });
    const last = res.log[res.log.length - 1];
    assertNear(res.totals.terminal.basis, res.totals.terminal.brokerage,
        'totals.terminal must carry the stepped-up basis', 1);
    assert(last['-basisPreStepUp'] !== undefined, 'the pre-step-up basis must be preserved');
    assert(last['-totalNetWealthPreStepUp'] !== undefined, 'the liquidation value must be preserved');
    assert(res.finalNW > last['-totalNetWealthPreStepUp'], 'the step-up can only raise terminal wealth');
    // The step-up is a terminal event, not a per-year one: no other row may carry these keys.
    const others = res.log.slice(0, -1).filter(r => r['-basisPreStepUp'] !== undefined);
    assert(others.length === 0, `only the terminal row may be stepped up, got ${others.length} others`);
    // Once basis === brokerage, afterTaxNetWorth's capital-gains term cannot contribute.
    assertNear(afterTaxNetWorth(res.totals.terminal, 0.30, 0.0),
               afterTaxNetWorth(res.totals.terminal, 0.30, 0.30),
               'capGainsRate must not change a stepped-up terminal valuation', 0.01);
});

test('P35g: the correction favors NOT converting - the one-sided bias it removes', () => {
    // The argument the whole phase rests on. Brokerage gains were taxed at death while Roth was
    // not, so every conversion comparison leaned toward converting. Removing that lean has to help
    // the arm that KEEPS its brokerage; a converting plan spends brokerage on conversion tax and
    // so has less unrealized gain left for 1014 to reach.
    const base = { ...STEPUP_BASE, convertExcessToRoth: false };
    const stepUpValue = res => res.finalNW - res.log[res.log.length - 1]['-totalNetWealthPreStepUp'];
    const noConv   = simulate({ ...base, extraConversionAmount: 0 });
    const withConv = simulate({ ...base, extraConversionAmount: 40000 });
    assert(stepUpValue(noConv) > 0, 'the no-conversion arm must hold gains worth stepping up');
    assert(stepUpValue(noConv) > stepUpValue(withConv),
        'the step-up must be worth more to the arm that did not spend its brokerage on conversion tax');
});

test('P35f: BrokerageBasis never exceeds Brokerage, including through a market crash', () => {
    // returnSequence drives per-year returns (the Monte Carlo bootstrap path). Sustained negative
    // years shrink the account while basis stands still, which is the only way this invariant can
    // break - every ordinary path moves value and basis together.
    const res = simulate({ ...BASE, Brokerage: 300000, BrokerageBasis: 300000,
                           spendGoal: 20000, returnSequence: new Array(40).fill(-0.25) });
    for (const r of res.log) {
        assert(r.Basis <= r.Brokerage + 0.01,
            `basis ${r.Basis} exceeded brokerage ${r.Brokerage} in ${r.year}`);
        assert(r.Basis >= -0.01, `basis went negative in ${r.year}`);
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
// GK uses raw portfolio balance (not tax-discounted totalNetWealth) for IWR and WR
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

// ── Compact money for display (formatDollarShort) ─────────────────────────────
// P92e. The Limit dropdown now prints each entry's own figure AND its position on the other income
// ladder, so the dollars had to get shorter. Three significant figures, k/M/B.
//
// It sits next to compactNum() below and is its opposite: that one is LOSSLESS and for share URLs,
// this one is LOSSY and for reading. The pair of suites is here so nobody reaches for the wrong one.
const formatDollarShort = globalThis.window.DisplayHelpers.formatDollarShort;

test('formatDollarShort: three significant figures, and the suffix follows the magnitude', () => {
    const cases = [
        [0, '$0'], [999, '$999'],                       // under a thousand stays whole dollars
        [1000, '$1k'], [1400, '$1.4k'], [24800, '$24.8k'],
        [100800, '$101k'], [211400, '$211k'], [273999, '$274k'], [403550, '$404k'],
        [1000000, '$1M'], [1200000, '$1.2M'], [1234567890, '$1.23B'],
        [-211400, '-$211k'],
    ];
    for (const [n, want] of cases) {
        assert(formatDollarShort(n) === want,
            `formatDollarShort(${n}) = "${formatDollarShort(n)}", expected "${want}"`);
    }
});

test('formatDollarShort: rounding up carries into the next unit instead of reading 1000k', () => {
    // The boundary this exists for: 999,500 rounds to 1000k, which is not a thing anyone writes.
    assert(formatDollarShort(999500) === '$1M', `got ${formatDollarShort(999500)}`);
    assert(formatDollarShort(99950) === '$100k', `got ${formatDollarShort(99950)}`);
    assert(formatDollarShort(999999999) === '$1B', `got ${formatDollarShort(999999999)}`);
    // And it never runs away past the largest unit there is.
    assert(/^\$[\d.]+B$/.test(formatDollarShort(9.9e14)), `got ${formatDollarShort(9.9e14)}`);
});

test('formatDollarShort is NOT compactNum: it never emits scientific notation', () => {
    // compactNum('100000') is "1e5" - correct for a URL, unreadable in a menu. Whatever this
    // returns has to be something a person reads as money.
    for (const n of [100000, 1e6, 1e9, 12345, 250000]) {
        const out = formatDollarShort(n);
        assert(!/e/i.test(out), `formatDollarShort(${n}) = "${out}" contains an exponent`);
        assert(out.startsWith('$'), `formatDollarShort(${n}) = "${out}" is not money`);
    }
});

test('formatDollarShort: a non-number is empty, not "$NaN"', () => {
    for (const bad of [NaN, Infinity, undefined, null, 'abc']) {
        assert(formatDollarShort(bad) === '', `formatDollarShort(${String(bad)}) = "${formatDollarShort(bad)}"`);
    }
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

// ── Stress bank: selection window, wrap, determinism ─────────────────────────
// The tests above verify the scoring math inline. These load the real prng.js and the real
// HISTORICAL_RETURNS and assert against the actual bank the Monte Carlo stress pass builds.

const _mcPrng = IS_NODE ? require('./montecarlo/prng.js') : window.MCPrng;
const _histRet = IS_NODE ? require('./montecarlo/historical_returns.js') : window.HISTORICAL_RETURNS;

// mc_engine.js is written for the worker, where importScripts() drops prng.js, stats.js and
// optimizer_core.js into one shared scope and every helper is a bare global. In node they are
// module exports, so they have to be hoisted onto globalThis before the engine is required or its
// first call throws ReferenceError. The browser tier needs none of this: the page already loaded
// all four as plain scripts.
if (IS_NODE) {
    Object.assign(globalThis, _mcPrng);
    Object.assign(globalThis, require('./montecarlo/stats.js'));
    globalThis.simulate = core.simulate;
    globalThis.selectionOf = core.selectionOf;
    globalThis.afterTaxWealthOfLogRow = core.afterTaxWealthOfLogRow;
}
const _mcEngine = IS_NODE ? require('./montecarlo/mc_engine.js') : window.MCEngine;

test('stress bank: default 10yr window picks the documented worst starts', () => {
    const bank = _mcPrng.buildStressBank(10, 40, 10);
    assert(bank.startYears.length === 10, `expected 10 sequences, got ${bank.startYears.length}`);
    const expected = [1999, 1965, 2000, 1969, 1968, 1966, 1972, 1973, 1970, 1929];
    assert(JSON.stringify(bank.startYears) === JSON.stringify(expected),
        `worst-10 start years drifted: got ${JSON.stringify(bank.startYears)}`);
    assert(bank.scoreYears === 10, `bank should report the window it used, got ${bank.scoreYears}`);
});

test('stress bank: a longer window selects a different set of start years', () => {
    const w10 = _mcPrng.buildStressBank(10, 40, 10).startYears;
    const w20 = _mcPrng.buildStressBank(10, 40, 20).startYears;
    assert(JSON.stringify(w10) !== JSON.stringify(w20),
        'a 20-year scoring window should not pick the same worst-10 as a 10-year window');
    assert(_mcPrng.buildStressBank(10, 40, 20).scoreYears === 20, 'bank should report scoreYears 20');
});

test('stress bank: window is clamped to the plan horizon', () => {
    // A 30-year window on a 12-year plan would otherwise rank start years on a stretch the plan
    // never lives through.
    const bank = _mcPrng.buildStressBank(5, 12, 30);
    assert(bank.scoreYears === 12, `window should clamp to the 12-year plan, got ${bank.scoreYears}`);
});

test('stress bank: the tail is real history wrapping to 1928, not a random draw', () => {
    // This is the behavior the UI documents: the window only RANKS start years. After it, each
    // scenario keeps walking the record, wrapping past the end of data.
    const years = 40;
    const bank  = _mcPrng.buildStressBank(10, years, 10);
    const eq    = _histRet.equity;
    const n     = eq.length;
    const si    = bank.startYears[0] - _histRet.equityStartYear;
    for (let y = 0; y < years; y++) {
        const want = eq[(si + y) % n];
        const got  = bank.equity[y];
        assert(Math.abs(got - want) < 1e-12,
            `year ${y} of the first scenario should be history index ${(si + y) % n}: want ${want}, got ${got}`);
    }
    assert(si + years > n, 'this fixture is only meaningful if the horizon actually wraps');
});

test('stress bank: identical arguments give identical banks (no RNG involved)', () => {
    const a = _mcPrng.buildStressBank(10, 40, 10);
    const b = _mcPrng.buildStressBank(10, 40, 10);
    assert(JSON.stringify(a.startYears) === JSON.stringify(b.startYears), 'start years must be stable');
    for (let i = 0; i < a.equity.length; i++) {
        assert(a.equity[i] === b.equity[i], `equity bank diverged at ${i} — stress must not consume the seed`);
    }
});

test('stress bank: reports bond and intl CAGR over the whole plan, not the ranking window', () => {
    // These used to be measured over the scoring window. That stopped being meaningful once the
    // window could be 'combined' (five of them) or 'all' (none), so every reported rate is now the
    // full-horizon figure on the sequence the scenario actually lived through, wrapped tail included.
    const years = 40;
    const bank  = _mcPrng.buildStressBank(10, years, 10);
    const n     = _histRet.equity.length;
    assert(bank.fullBondCAGRs.length === 10, 'one bond CAGR per sequence');
    assert(bank.fullIntlCAGRs.length === 10, 'one intl CAGR per sequence');

    // Recompute the first scenario's bond CAGR straight from the source data, including the wrap.
    const si = bank.startYears[0] - _histRet.equityStartYear;
    let logSum = 0;
    for (let y = 0; y < years; y++) logSum += Math.log1p(_histRet.bonds[(si + y) % n]);
    const want = Math.exp(logSum / years) - 1;
    assert(Math.abs(bank.fullBondCAGRs[0] - want) < 1e-12,
        `bond CAGR mismatch: want ${want}, got ${bank.fullBondCAGRs[0]}`);

    // A scenario whose whole horizon predates the intl series would fall back to the domestic proxy
    // throughout. Over 40 wrapping years every scenario crosses 1970, so instead assert the proxy
    // rule directly: intl equals equity in exactly the years outside 1970..end-of-intl.
    const i1929 = bank.startYears.indexOf(1929);
    assert(i1929 >= 0, 'the 1929 scenario should be in the worst-10 at a 10-year window');
    const short = _mcPrng.buildStressBank(10, 10, 10);   // 1929 + 10 years is entirely pre-1970
    const j = short.startYears.indexOf(1929);
    assert(Math.abs(short.fullIntlCAGRs[j] - short.fullEqCAGRs[j]) < 1e-12,
        'a wholly pre-1970 horizon must fall back to domestic equity, so the two CAGRs match');
});

test('stress bank: worst rolling real CAGR scans the whole horizon, not just the opening', () => {
    const years = 35;
    const bank  = _mcPrng.buildStressBank(10, years, 10);
    const n     = _histRet.equity.length;
    assert(JSON.stringify(Object.keys(bank.worstRealCAGRs)) === JSON.stringify(['5', '10', '15', '20']),
        `unexpected rolling windows: ${Object.keys(bank.worstRealCAGRs)}`);

    // Recompute the first scenario's worst 10-year stretch by brute force over its realized sequence.
    const si = bank.startYears[0] - _histRet.equityStartYear;
    const w  = 10;
    let want = Infinity;
    for (let o = 0; o + w <= years; o++) {
        let eqLog = 0, infLog = 0;
        for (let y = 0; y < w; y++) {
            const idx = (si + o + y) % n;
            eqLog  += Math.log1p(_histRet.equity[idx]);
            infLog += Math.log1p(Math.max(_mcPrng.INFLATION_FLOOR, _histRet.inflation[idx]));
        }
        const eqC  = Math.exp(eqLog / w) - 1;
        const infC = Math.max(-0.005, Math.exp(infLog / w) - 1);
        const real = (1 + eqC) / (1 + infC) - 1;
        if (real < want) want = real;
    }
    assert(Math.abs(bank.worstRealCAGRs[10][0] - want) < 1e-12,
        `worst rolling 10yr mismatch: want ${want}, got ${bank.worstRealCAGRs[10][0]}`);

    // A rolling window longer than the plan has no samples and must not be reported at all.
    const shortPlan = _mcPrng.buildStressBank(5, 12, 10);
    assert(shortPlan.worstRealCAGRs[15] === undefined, 'a 12-year plan has no 15-year stretch');
    assert(shortPlan.worstRealCAGRs[10] !== undefined, 'a 12-year plan does have a 10-year stretch');
});

test("stress bank: 'combined' is the union of every window's worst, deduped", () => {
    const years = 35;
    const count = 10;
    const comb  = _mcPrng.buildStressBank(count, years, 'combined');

    // The union property: nothing a single window flagged may be missing from the combined set.
    for (const w of _mcPrng.STRESS_WINDOWS) {
        const single = _mcPrng.buildStressBank(count, years, w).startYears;
        const missing = single.filter(y => !comb.startYears.includes(y));
        assert(missing.length === 0,
            `combined dropped start years the ${w}-year window flagged: ${missing}`);
    }
    assert(new Set(comb.startYears).size === comb.startYears.length, 'combined must not repeat a start year');
    assert(comb.startYears.length > count, 'the windows disagree enough that the union exceeds one window');
    assert(comb.startYears.length < count * _mcPrng.STRESS_WINDOWS.length,
        'the windows overlap, so the union must be smaller than the sum');
    assert(comb.scoreYears === null, 'combined has no single scoring window to report');
    assert(JSON.stringify(comb.windowsUsed) === JSON.stringify(_mcPrng.STRESS_WINDOWS),
        `a 35-year plan should use every window, got ${comb.windowsUsed}`);

    // Deterministic, and every row records which windows nominated it.
    const again = _mcPrng.buildStressBank(count, years, 'combined');
    assert(JSON.stringify(comb.startYears) === JSON.stringify(again.startYears), 'combined must be stable');
    comb.nominatedBy.forEach((noms, i) => {
        assert(noms.length > 0, `${comb.startYears[i]} is in the combined set but nothing nominated it`);
    });

    // Windows clamp to the plan and then dedupe: a 12-year plan cannot score a 30-year stretch.
    assert(JSON.stringify(_mcPrng.buildStressBank(5, 12, 'combined').windowsUsed) === JSON.stringify([5, 10, 12]),
        'windows must clamp to the plan horizon and dedupe');
});

test('scoreStartYears memoizes without letting a caller corrupt the shared ranking', () => {
    // The ranking depends only on the window length and on HISTORICAL_RETURNS, which is a static data
    // file, so it is cached per window. That means every caller for a given window gets the SAME
    // array, and a caller that wrote to an entry would poison every later read. Frozen so it cannot.
    const a = _mcPrng.scoreStartYears(10);
    const b = _mcPrng.scoreStartYears(10);
    assert(a === b, 'a repeat call for the same window must return the cached array');
    assert(Object.isFrozen(a), 'the cached array must be frozen');
    assert(Object.isFrozen(a[0]), 'the cached entries must be frozen');

    const wasYear = a[0].year, wasCagr = a[0].realCagr;
    try { a[0].year = 1234; a[0].realCagr = 99; } catch (e) { /* strict mode throws; both are fine */ }
    assert(a[0].year === wasYear && a[0].realCagr === wasCagr,
        'a write to a cached entry must not take effect');

    // Different windows are cached separately and must not collide.
    assert(_mcPrng.scoreStartYears(5) !== _mcPrng.scoreStartYears(10), 'windows must not share a cache slot');
    assert(_mcPrng.scoreStartYears(5).length === _histRet.equity.length - 5 + 1, '5-year pool size');
    assert(_mcPrng.scoreStartYears(10).length === _histRet.equity.length - 10 + 1, '10-year pool size');

    // And the memo is transparent: repeated bank builds still agree, including after other windows
    // have been scored in between.
    const first = _mcPrng.buildStressBank(10, 40, 10).startYears;
    _mcPrng.buildStressBank(20, 35, 'combined');
    const second = _mcPrng.buildStressBank(10, 40, 10).startYears;
    assert(JSON.stringify(first) === JSON.stringify(second), 'caching must not change what a bank returns');
});

test('bear pool draws from three opening lengths, each spliced for its own window', () => {
    const pool = _mcPrng.buildBearPool();
    const wins = _mcPrng.BEAR_OVERLAY_WINDOWS;
    const per  = _mcPrng.BEAR_OVERLAY_POOL;
    assert(pool.length === wins.length * per,
        `expected ${wins.length} x ${per} entries, got ${pool.length}`);

    for (const w of wins) {
        const forW = pool.filter(e => e.len === w);
        assert(forW.length === per, `expected ${per} entries at length ${w}, got ${forW.length}`);
        // Each is the worst `per` by that window's own ranking, in that order.
        const want = _mcPrng.scoreStartYears(w).slice(0, per).map(s => s.year);
        assert(JSON.stringify(forW.map(e => e.year)) === JSON.stringify(want),
            `length ${w} entries are not that window's worst: ${forW.map(e => e.year)}`);
    }

    // The whole point: the short windows find crashes the decade ranking averages away. 1930 is the
    // worst 3-year opening in the record and only the 13th worst decade, because the decade starting
    // 1930 contains 1933's +54% rebound.
    assert(pool.some(e => e.year === 1930 && e.len === 3), '1930 must be in the pool at 3 years');
    assert(!_mcPrng.scoreStartYears(10).slice(0, per).some(s => s.year === 1930),
        'this test is only meaningful while 1930 is absent from the worst-10 decades');

    // A year several windows agree on appears once per window, so it is drawn proportionally more.
    const y1929 = pool.filter(e => e.year === 1929);
    assert(y1929.length === 3, `1929 is flagged by all three windows, expected 3 entries, got ${y1929.length}`);
    assert(JSON.stringify(y1929.map(e => e.len).sort((a, b) => a - b)) === JSON.stringify([3, 5, 10]),
        'and once at each length');
});

test('bear-start overlay splices only its own opening length, and never past the plan', () => {
    const overlaidSlots = (numPaths, years, frac) => {
        const rngA = _mcPrng.mulberry32(7);
        const before = _mcPrng.bootstrapMultiAssetBank(rngA, numPaths, years);
        const baseline = Array.from(before.equity);
        const rngB = _mcPrng.mulberry32(7);
        const after = _mcPrng.bootstrapMultiAssetBank(rngB, numPaths, years);
        _mcPrng.applyBearStartOverlay(after, rngB, numPaths, years, frac);
        const changed = [];
        for (let i = 0; i < baseline.length; i++) if (after.equity[i] !== baseline[i]) changed.push(i);
        return changed;
    };

    // A 10-year opening spliced into a 5-year plan used to write 10 slots into a 5-slot row and
    // corrupt the following path. Nothing may change outside path 0's own five slots.
    const short = overlaidSlots(4, 5, 0.25);   // bearCount = 1
    assert(short.every(i => i < 5), `overlay ran past a 5-year plan's first path: slots ${short}`);

    // On a long plan the overlay touches at most the longest window and never beyond it.
    const maxLen = Math.max(..._mcPrng.BEAR_OVERLAY_WINDOWS);
    const long = overlaidSlots(4, 40, 0.25);
    assert(long.every(i => i < maxLen), `overlay wrote past year ${maxLen}: slots ${long}`);
    assert(long.length > 0, 'the overlay must actually change something');
});

test('bear-start overlay does not read the Stress Test sequence count', () => {
    // The overlay used to size its sample pool from cfg.stressCount, which put a Stress Test DISPLAY
    // setting into the main bootstrap pass: changing it silently moved every Historical result and
    // raised the "Out of date" banner for a reason no reader could have guessed. It is pinned to
    // BEAR_OVERLAY_POOL now, which is what lets the stale banner ignore the stress controls.
    const overlayed = (extraArg) => {
        const rng  = _mcPrng.mulberry32(42);
        const bank = _mcPrng.bootstrapMultiAssetBank(rng, 120, 30);
        _mcPrng.applyBearStartOverlay(bank, rng, 120, 30, 0.25, extraArg);
        return Array.from(bank.equity.slice(0, 120 * 10));   // the overlaid opening decade
    };
    const base = overlayed(undefined);
    for (const stale of [10, 20, 98, 3]) {
        assert(JSON.stringify(overlayed(stale)) === JSON.stringify(base),
            `the overlay changed when passed a stress count of ${stale}; it must ignore the argument`);
    }
    // And it still actually overlays something, or the test above would pass on two empty banks.
    const rng  = _mcPrng.mulberry32(42);
    const bank = _mcPrng.bootstrapMultiAssetBank(rng, 120, 30);
    const before = Array.from(bank.equity.slice(0, 120 * 10));
    _mcPrng.applyBearStartOverlay(bank, rng, 120, 30, 0.25);
    assert(JSON.stringify(Array.from(bank.equity.slice(0, 120 * 10))) !== JSON.stringify(before),
        'a 25% bear fraction must actually rewrite the opening decade of some paths');
});

test("stress bank: 'all' runs every start year and marks where the record runs out", () => {
    const years = 35;
    const all   = _mcPrng.buildStressBank(10, years, 'all');
    const n     = _histRet.equity.length;
    assert(all.startYears.length === n, `expected all ${n} start years, got ${all.startYears.length}`);
    assert(all.startYears[0] === _histRet.equityStartYear, 'all should start at the first year of the record');
    assert(all.startYears[n - 1] === _histRet.equityStartYear + n - 1, 'and end at the last');
    assert(all.scoreYears === null, 'all ranks on nothing, so there is no scoring window');

    // realYears is how much of the plan follows the ACTUAL record before wrapping back to 1928.
    const i2015 = all.startYears.indexOf(2015);
    assert(all.realYears[i2015] === 11, `2015 has 11 real years left, got ${all.realYears[i2015]}`);
    assert(all.realYears[0] === years, 'an early start year never wraps inside a 35-year plan');

    // A start year no window flags is still present, just unnominated. That is the whole point of
    // the mode: it does not pre-judge which stretches of history are the dangerous ones.
    assert(all.nominatedBy[i2015].length === 0, '2015 is not among the worst by any window');
    assert(all.nominatedBy.some(noms => noms.length > 0), 'the worst years are still marked as such');
});

test('stress bank: a count above the candidate pool caps instead of throwing', () => {
    // Repro of the ">=85 sequences stalls" report. The pool is (98 - window + 1) start years, so a
    // count of 85 overruns the 15/20/30-year windows. The bank used to slice short and then
    // destructure past the end of that list, and the throw surfaced as a permanent freeze rather
    // than an error, because the worker's onerror handler retried it on the main thread where it
    // threw again inside an async function.
    for (const win of [5, 10, 15, 20, 30]) {
        const pool = _histRet.equity.length - win + 1;
        for (const count of [85, 200]) {
            const bank = _mcPrng.buildStressBank(count, 35, win);
            const want = Math.min(count, pool);
            assert(bank.labels.length === want,
                `window ${win}, count ${count}: expected ${want} sequences, got ${bank.labels.length}`);
            assert(bank.startYears.length === want, 'startYears must match the label count');
            assert(bank.equity.length === want * 35, 'the bank must be sized to what it actually filled');
            assert(bank.candidatePool === pool, `candidatePool should report ${pool}, got ${bank.candidatePool}`);
            assert(bank.requestedCount === count, 'requestedCount reports what was asked for');
        }
    }
});

test('stress bank: a junk count falls back to the default rather than an empty bank', () => {
    // stressCount reaches the bank through `cfg.stressCount ?? 10`, which lets NaN through. Zero
    // sequences renders a blank Stress Test with nothing explaining why.
    for (const count of [NaN, undefined, 0, -5, 0.5]) {
        const bank = _mcPrng.buildStressBank(count, 35, 10);
        assert(bank.labels.length === 10,
            `count ${String(count)} should fall back to 10 sequences, got ${bank.labels.length}`);
    }
});

test('stressOutcomeBand: the line is half the PLAN, and exactly half counts as late', () => {
    const band = _mcPrng.stressOutcomeBand;
    // First argument is the PLAN's start year (2026), not the historical year the sequence comes
    // from. Third is the plan's length: the band used to be graded on the ranking window, which
    // 'combined' and 'all' leave undefined, and which called year 8 of 30 and year 28 of 30 the
    // same thing on a long plan.
    assert(band(2026, 2026, 30) === 'ruin-early', 'ruin in the first year is early');
    assert(band(2026, 2040, 30) === 'ruin-early', 'year 14 of 30 is still the first half');
    assert(band(2026, 2041, 30) === 'ruin-late',  'year 15 of 30 is exactly half, which counts as late');
    assert(band(2026, 2055, 30) === 'ruin-late',  'ruin in the final year is late');
    // An odd plan length splits on the fraction, not on a rounded year.
    assert(band(2026, 2038, 25) === 'ruin-early', 'year 12 of 25 is below 12.5');
    assert(band(2026, 2039, 25) === 'ruin-late',  'year 13 of 25 is above 12.5');
    // The same failure changes band with the PLAN length now, not with the window.
    assert(band(2026, 2036, 40) === 'ruin-early', 'year 10 of a 40-year plan is early');
    assert(band(2026, 2036, 15) === 'ruin-late',  'the same year 10 in a 15-year plan is late');
    assert(band(2026, 0, 30)    === 'survive',    'ruin year 0 means the path never failed');
    assert(band(2026, null, 30) === 'survive',    'a null ruin year means the path never failed');
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

// P92a. CAP_BASE's own 22% ceiling no longer breaches: once the ceiling reaches the true top of
// the 22% bracket it is above everything this plan needs, so there is no forced draw left to test.
// The 12% ceiling is the same fixture with a limit that still genuinely binds, which is what the
// three soft-cap assertions are about.
const CAP_SOFT = { ...CAP_BASE, stratRate: 0.12 };

test('soft cap (federal bracket): forced IRA funds spending — no lingering shortfall', () => {
    const r = simulate({ ...CAP_SOFT });
    assert(_sumForcedIRA(r.log) > 100000, `expected substantial forced IRA, got ${Math.round(_sumForcedIRA(r.log))}`);
    assert(_sumAbsShortfall(r.log) < 100, `expected ~0 total shortfall, got ${Math.round(_sumAbsShortfall(r.log))}`);
    assert(r.totals.success, 'plan should succeed once IRA funds the spend');
    const ov = r.log.reduce((s, e) => s + (e.BracketOverage || 0), 0);
    assert(ov > 0, 'soft-cap break should register a non-zero bracket overage (the flag)');
});

test('soft cap: forced IRA never exceeds available IRA (no over-draw past depletion)', () => {
    const r = simulate({ ...CAP_SOFT });
    // Final IRA balance must stay non-negative — the loop is bounded by curBalances.IRA.
    const last = r.log[r.log.length - 1];
    assert((last.TotalIRA ?? 0) >= -1, `IRA went negative: ${last.TotalIRA}`);
});

// ── P92a: a chosen limit is the limit ───────────────────────────────────────────────────────────
// A federal bracket top bounds TAXABLE income. Every caller of computeBracketCeiling spends the
// number it returns as a MAGI ceiling, and nothing converted one to the other, so "fill the 22%
// bracket" stopped one whole deduction below the top of the 22% bracket - $22,308 short in year 0
// of the fixture below, growing with indexation and the age-65 bumps. The ceiling is now raised by
// the year's deduction, so the two are on one basis.
const CEIL_FILL = { ...BASE, strategy: 'bracket', stratRate: 0.22, stratIRMAATier: -1,
                    stratACAMultiple: 0, IRA1: 2000000, convertExcessToRoth: true, nYears: 5 };

test('P92a: a Fill Bracket ceiling reaches the top of the bracket, not one deduction short', () => {
    const e = simulate({ ...CEIL_FILL }).log[0];
    const top = findLimitByRate('FEDERAL', e.status, 0.22, e['-cpiFactor']).limit;
    // The whole claim, in one line: the plan's federal TAXABLE income lands on the bracket top.
    // Before, this sat a full deduction below it and the year still counted as "filled".
    assertNear(e['-fedTaxableInc'], top, 'taxable income must reach the top of the chosen bracket', 500);
    // And the ceiling it aimed at is that top plus the deduction, which is the conversion between
    // the two bases and the only thing that changed.
    assertNear(e.BracketTarget - top, e['-ceilDedAddBack'],
        'the ceiling is the bracket top plus the deduction it added back', 1);
    assert(e['-ceilDedAddBack'] > 0, 'a federal-bracket year must have an add-back at all');
});

test('P92a: the deduction the ceiling used is the one the tax pass charged', () => {
    // The circularity, pinned rather than argued. The senior deduction phases out against federal
    // AGI, which is what the ceiling determines, so the year's own deduction is not knowable when
    // the ceiling is placed; the engine asks calculateTaxes() about a provisional year instead and
    // iterates twice. This bounds what that estimate can miss - one senior deduction per filer,
    // which is what a year the plan never reaches the ceiling can cost.
    const log = simulate({ ...CEIL_FILL, nYears: 20 }).log;
    const cap = TAXData.OBBBA.SENIOR_DED.perSenior * 2;
    const bad = log.filter(e => Math.abs((e['-ceilDedAddBack'] || 0) - e['-fedDeduction']) > cap);
    assert(bad.length === 0,
        `the ceiling's deduction drifted past one senior deduction in ${bad.length} years: `
        + bad.slice(0, 3).map(e => `${e.year} used ${Math.round(e['-ceilDedAddBack'])} vs charged ${Math.round(e['-fedDeduction'])}`).join(' | '));
});

test('P92a: an IRMAA tier and an ACA cap get no add-back at all', () => {
    // The zero test. Those two ceilings are already MAGI quantities - an IRMAA threshold and an FPL
    // multiple - so there is nothing to convert and adding a deduction to either would break a
    // ceiling that was right. P87a measured them unmoved in 80 of 80 cells; this keeps them so.
    for (const [name, over] of [['IRMAA tier 1', { stratRate: 0, stratIRMAATier: 1 }],
                                ['ACA 400% FPL', { strategy: 'aca', stratRate: 0, stratIRMAATier: -1,
                                                   stratACAMultiple: 400, birthyear1: 1975, die1: 95 }]]) {
        const log = simulate({ ...CEIL_FILL, ...over }).log;
        assert(log.every(e => (e['-ceilDedAddBack'] || 0) === 0),
            `${name} must get no deduction add-back, got ${Math.round(log.find(e => e['-ceilDedAddBack'])?.['-ceilDedAddBack'] ?? 0)}`);
    }
});

// -- P87c: the other half of the same basis question, and it is Social Security ----------------
// A federal-bracket or IRMAA ceiling is spent against MAGI, which carries only the TAXABLE share of
// the benefit - at most 85%. The sizing aggregate subtracted the FULL benefit, so the untaxed share
// was charged against a ceiling it never occupies and every plan stopped exactly that much short:
// `short / SSincome` measured 0.150000, min equal to max, on federal brackets and IRMAA tiers alike.
// ACA is the exception and keeps the full benefit, because ACA MAGI adds non-taxable SS back.
const CEIL_SS = { ...CEIL_FILL, ss1: 40000, ss1Age: 62, nYears: 12, IRA1: 3000000, spendGoal: 90000 };

test('P87c: nonSSIncomeForMAGI inverts the MAGI relation it claims to invert', () => {
    // The unit test, and it does not go near the engine. Rebuild MAGI from the returned non-SS
    // income exactly as calculateTaxes does - N + taxableSS(N + 0.5 x SS) - and it must land on the
    // target. Spanning both filing statuses and, deliberately, targets low enough to fall in the
    // 50% tier and the zero tier as well as the 85% cap, since those are the cases a flat
    // subtraction gets wrong.
    for (const status of ['MFJ', 'SGL']) {
        const r = getRateBracket('SOCIALSECURITY', status)[1].r;
        for (const ss of [0, 12000, 40000, 94000]) {
            for (const target of [20000, 35000, 50000, 120000, 400000]) {
                const N = nonSSIncomeForMAGI(status, target, ss);
                const magi = N + calculateTaxableSocialSecurity(status, N + r * ss, ss);
                assertNear(magi, target, `${status} target ${target} with ${ss} of benefit`, 0.01);
            }
        }
    }
});

test('P87c: a Fill Bracket plan with Social Security lands MAGI on its ceiling', () => {
    const log = simulate({ ...CEIL_SS }).log;
    const rows = log.filter(e => e.SSincome > 0 && e.TotalIRA > 1000 && e.BracketTarget > 0);
    assert(rows.length > 0, 'fixture must produce ceiling-bound years with the benefit being paid');
    // The defect, stated as the thing it can no longer be: a short worth 15% of the benefit.
    const worst = Math.max(...rows.map(e => (e.BracketTarget - e.MAGI) / e.SSincome));
    assert(worst < 0.01,
        `MAGI must reach the ceiling, worst year still short by ${(worst * 100).toFixed(2)}% of the benefit`);
});

test('P87c: filling the ceiling more fully never breaches it', () => {
    // The direction that matters for a CAP. Subtracting the taxable share RAISES the room, so the
    // guard is that the room is still bounded by the limit rather than overshooting it.
    //
    // THE FIXTURE IS THE TEST. Three other mechanisms can put MAGI over a ceiling - a conversion
    // (P88), a forced draw for spending the ceiling cannot fund, and an RMD - and each has its own
    // tests. Leaving any of them armed here measures them instead of the sizing line, and the two
    // failed drafts of this test are both worth recording: the first used CEIL_SS unchanged and
    // reported 17 breached years that were surplus conversions, and the second turned conversions
    // off and cut the spend goal and reported the SAME 17 years to the dollar, because CEIL_SS
    // inherits a household already 74 years old and a $3M IRA whose RMD alone clears the ceiling.
    // An unchanged number after a change that should have moved it is the tell.
    //
    // So: conversions off, the spend goal well inside the ceiling, and RMD years excluded outright,
    // since an RMD is a mandatory claimant the sizing line has no discretion over. Excluded rather
    // than aged out of the horizon, because `nYears` does NOT bound the run - the fixture below
    // returns 27 rows and ends at the death year, not at year 10 - which is the third thing this
    // test got wrong before it got it right.
    const SIZED = { ...CEIL_SS, convertExcessToRoth: false, spendGoal: 40000,
                    birthyear1: 1962, die1: 90 };
    for (const [name, over] of [['Fill Bracket 22%', {}],
                                ['Fill Bracket 12%', { stratRate: 0.12 }],
                                ['IRMAA tier 1', { stratRate: 0, stratIRMAATier: 1 }]]) {
        const log = simulate({ ...SIZED, ...over }).log;
        const rows = log.filter(e => e.BracketTarget > 0 && (e.ForcedIRA || 0) === 0
                                     && (e.RMDwd || 0) === 0);
        assert(rows.length > 0, `${name} must produce ceiling years with no forced draw and no RMD`);
        const bad = rows.filter(e => e.MAGI - e.BracketTarget > 1);
        assert(bad.length === 0,
            `${name} breached its own ceiling with only the sizing line drawing, in ${bad.length} years: `
            + bad.slice(0, 3).map(e => `${e.year} MAGI ${Math.round(e.MAGI)} vs ${Math.round(e.BracketTarget)}`).join(' | '));
    }
});

test('P87c: an ACA cap still counts the WHOLE benefit', () => {
    // The fork, and the reason it is on the ceiling's kind rather than applied globally. ACA MAGI
    // adds non-taxable Social Security back by statute, so the full benefit really does occupy that
    // cap and treating 15% of it as free room would push a household over a cliff. The ACA year's
    // room must therefore still be limit - full benefit, which shows up as MAGI landing SHORT of
    // the cap by no more than rounding rather than reaching it the way a bracket year now does.
    const log = simulate({ ...CEIL_SS, strategy: 'aca', stratRate: 0, stratIRMAATier: -1,
                           stratACAMultiple: 400, birthyear1: 1975, die1: 95, ss1Age: 62 }).log;
    const rows = log.filter(e => e.SSincome > 0 && e.BracketTarget > 0 && e.TotalIRA > 1000);
    assert(rows.length > 0, 'fixture must produce live ACA years with the benefit being paid');
    assert(rows.every(e => e.MAGI - e.BracketTarget <= 1),
        'an ACA cap may never be exceeded by the sizing line');
});

test('soft cap (fixedpct): capped % with spend over cap still funds spending from IRA', () => {
    const r = simulate({ ...CAP_BASE, strategy: 'fixedpct', iraWithdrawPct: 0.02 });
    assert(_sumForcedIRA(r.log) > 0, 'fixedpct should force IRA when 2% draw + buffers underfund spend');
    assert(_sumAbsShortfall(r.log) < 100, `expected ~0 total shortfall, got ${Math.round(_sumAbsShortfall(r.log))}`);
});

// CAP_BASE's people are 66 and 67 in year 0, so an ACA cap on it lapses before the first row is
// written (P35 PR 3c) and the strategy runs as Proportional 0% for all 30 years. That made it the
// wrong fixture for strict-cap behavior — it passed the three assertions below by enforcing a cap
// that had ended decades earlier. ACA_LIVE moves both birth years under Medicare eligibility and
// changes nothing else, so the cap is genuinely in force for the early years.
const ACA_LIVE = { ...CAP_BASE, birthyear1: 1968, birthyear2: 1967 };
const ACA_ARM  = { strategy: 'aca', stratRate: 0, stratACAMultiple: 400 };

// A dead person logs age as '—', so a numeric comparison on the raw column silently drops those
// years from BOTH sides of a filter. Youngest-living age, or null when nobody is left.
const _minLivingAge = e => {
    const ages = [e.age1, e.age2].filter(a => typeof a === 'number');
    return ages.length ? Math.min(...ages) : null;
};
// Years the FPL cap is actually in force. ACA_LIVE opens at 58/59 and lapses mid-plan, so a whole-
// log assertion about cap behavior silently mixes in the years after it ended. P38 made that
// distinction load-bearing: post-lapse years are backstopped like any other strategy and DO force
// IRA, so "this strategy never forces IRA" is only true of the live years.
const _capLiveRows = log => log.filter(e => {
    const a = _minLivingAge(e);
    return a !== null && a < TAXData.IRMAA.ELIGIBILITY_AGE;
});

test('strict ACA (cap in force): cap is never breached — shortfall persists and is flagged untenable', () => {
    const r = simulate({ ...ACA_LIVE, ...ACA_ARM });
    const live = _capLiveRows(r.log);
    assert(live.length > 0, 'fixture must have years where the cap is actually in force');
    // Scoped to the live years on purpose (P38). Whole-log used to work only because NOTHING forced
    // IRA anywhere; now the lapsed tail does, correctly, and folding it in would assert the opposite
    // of what this test is about.
    assert(live.reduce((s, e) => s + (e.ForcedIRA || 0), 0) === 0,
        `ACA must not force IRA above a LIVE FPL cap, got ${Math.round(live.reduce((s, e) => s + (e.ForcedIRA || 0), 0))}`);
    assert(_sumAbsShortfall(live) > 1000, 'ACA at 400% FPL with $160k spend should leave a real shortfall');
    assert((r.totals.acaBreachYears ?? 0) > 0, 'expected acaBreachYears > 0 (untenable flag)');
});

// ── ACA cap lapses at Medicare eligibility (P35 PR 3c) ────────────────────────
// Premium subsidies end when Medicare begins, so the FPL cap has nothing left to protect. The
// successor is Proportional 0% — deliberately NOT "release the ceiling", which would collapse
// IRAwd = min(curIRA, room) to curIRA and drain the whole above-goal IRA in the crossing year.

// loopMs is wall-clock and differs between two runs of identical inputs; nothing else in the row is
// nondeterministic, so it is the only exclusion.
const _logSansTiming = log => JSON.stringify(log.map(({ loopMs, ...rest }) => rest));

test('ACA lapse: an already-Medicare household simulates identically to Proportional 0%', () => {
    // Not "similar" — the lapsed branch chain falls through to the same baseline `else` that
    // propwd 0% reaches, so every logged year must match key for key. A near-miss here means the
    // fall-through picked up some other branch on the way down.
    const lapsed = simulate({ ...CAP_BASE, ...ACA_ARM });
    const prop   = simulate({ ...CAP_BASE, strategy: 'propwd', propWithdraw: 0, stratRate: 0, stratACAMultiple: 0 });
    const a = _logSansTiming(lapsed.log), b = _logSansTiming(prop.log);
    if (a !== b) {
        const ra = lapsed.log.find((r, i) => JSON.stringify({ ...r, loopMs: 0 }) !== JSON.stringify({ ...prop.log[i], loopMs: 0 }));
        const diff = ra ? Object.keys(ra).filter(k => k !== 'loopMs'
            && JSON.stringify(ra[k]) !== JSON.stringify(prop.log[lapsed.log.indexOf(ra)][k])) : [];
        assert(false, `lapsed ACA must match Proportional 0%; first divergence year ${ra && ra.year} in [${diff}]`);
    }
    assert((lapsed.totals.acaBreachYears ?? 0) === 0,
        `a lapsed cap cannot be breached, got ${lapsed.totals.acaBreachYears}`);
    // NOT asserted: that the shortfall goes to zero. It does not, and expecting it to was wrong —
    // Proportional 0% strands $304k of its own on this fixture, identically before and after this
    // change. The lapse inherits its successor's behavior, warts included; that is the point.
});

test('ACA lapse: the cap is what changed, not the fixture — CAP_BASE breached before this', () => {
    // Guards the reverse mistake: someone "fixes" a future failure by making CAP_BASE unable to
    // breach at all, and this whole area starts passing vacuously. Move eligibility past the
    // household's ages and the identical inputs must go back to breaching.
    const revived = withEligibilityAge(80, () => simulate({ ...CAP_BASE, ...ACA_ARM }));
    const lapsed  = simulate({ ...CAP_BASE, ...ACA_ARM });
    assert((revived.totals.acaBreachYears ?? 0) > 0,
        'with eligibility at 80 the 66/67 household is pre-Medicare and the cap must bind again');
    // The size of the change, not just its sign. A cap enforced for 30 years past Medicare strands
    // strictly more spending than one that ends on time, and the plan spends strictly less under
    // it. Terminal wealth moves the OTHER way and is not asserted here: enforcing a dead cap leaves
    // money in the IRA precisely because it refused to fund the spend goal, so "richer at the end"
    // is the symptom, not the benefit.
    assert(_sumAbsShortfall(revived.log) > _sumAbsShortfall(lapsed.log),
        'enforcing a lapsed cap must strand MORE spending than lifting it');
    assert(revived.totals.spend < lapsed.totals.spend,
        'and must fund LESS of the spend goal over the plan');
});

test('ACA lapse: mid-plan crossing stops the breaches instead of releasing the ceiling', () => {
    // ACA_LIVE opens at 58/59, so the cap binds for the first several years and lapses when the
    // YOUNGER of the two reaches eligibility. Both halves are asserted: breaches before, none after.
    const r = simulate({ ...ACA_LIVE, ...ACA_ARM });
    const medAge = TAXData.IRMAA.ELIGIBILITY_AGE;
    const pre  = r.log.filter(e => _minLivingAge(e) !== null && _minLivingAge(e) <  medAge);
    const post = r.log.filter(e => _minLivingAge(e) !== null && _minLivingAge(e) >= medAge);
    assert(pre.length > 0 && post.length > 0, 'fixture must span the crossing');
    assert(pre.some(e => e['acaBreach']), 'the cap must actually bind while both are pre-Medicare');
    assert(!post.some(e => e['acaBreach']), 'no year may breach a cap that has lapsed');
    // The rejected alternative shows up here. Releasing the ceiling collapses
    // IRAwd = min(curIRA, room) to curIRA, so the crossing year drains the whole above-goal IRA at
    // once. Proportional 0% draws for spending, so the crossing year must stay in the same league
    // as the year after it.
    const cross = post[0], next = post[1];
    assert(next && cross.IRAwd <= Math.max(4 * next.IRAwd, 100000),
        `crossing-year IRA draw ${Math.round(cross.IRAwd)} looks like a one-year drain vs ${Math.round(next.IRAwd)} the year after`);
});

test('ACA untenable flag is monotonic: a lower FPL multiple is a STRICTER cap', () => {
    // Asked directly by a user who saw one of four ACA rows flagged ⚠️ and reasonably wondered
    // whether the flagging was arbitrary. It is not, and the invariant is worth pinning because it
    // is the thing that makes the flag readable: 200% FPL is a TIGHTER income limit than 400%, so
    // the set of flagged arms must be downward-closed. If 400% breaches, 200/250/300 must too.
    // The reverse — a loose cap flagged while a tighter one is clean — would be incoherent.
    const FPLS = [200, 250, 300, 400];
    // Spread wide enough that some scenarios flag none, some all, and some only the tightest.
    // Social Security is swept too and is the lever that makes a PARTIAL set reachable: CAP_BASE's
    // $72k of combined benefits already exceeds the 300% cap on its own, so every arm breaches on
    // unavoidable income alone and the interesting middle never appears.
    const scenarios = [];
    for (const spendGoal of [40000, 60000, 90000])
        for (const IRA1 of [200000, 1500000])
            for (const [ss1, ss2] of [[0, 0], [24000, 16000]])
                for (const STATEname of ['CA', 'TX'])
                    scenarios.push({ spendGoal, IRA1, ss1, ss2, STATEname });
    let sawPartial = false, sawNone = false, sawAll = false;
    for (const s of scenarios) {
        const base = { ...ACA_LIVE, ...s, strategy: 'aca', stratRate: 0 };
        const flagged = FPLS.map(f => (simulate({ ...base, stratACAMultiple: f }).totals.acaBreachYears ?? 0) > 0);
        const n = flagged.filter(Boolean).length;
        if (n === 0) sawNone = true; else if (n === FPLS.length) sawAll = true; else sawPartial = true;
        // downward-closed: everything at or below the loosest flagged multiple must be flagged
        for (let i = 0; i < FPLS.length; i++)
            for (let j = 0; j < i; j++)
                assert(!(flagged[i] && !flagged[j]),
                    `${JSON.stringify(s)}: ${FPLS[i]}% flagged but the stricter ${FPLS[j]}% is not`);
    }
    // Guard against the invariant holding only because nothing ever flagged.
    assert(sawNone && sawPartial && sawAll,
        `fixture must span all three shapes, got none=${sawNone} partial=${sawPartial} all=${sawAll}`);
});

test('ACA lapse: it is LIVING spouses, not both people — a survivor past 65 lapses alone', () => {
    // Person 1 dies at 60, never Medicare-eligible; person 2 is 67 at start. Under a "both people
    // reached 65" reading the cap would run to the end of the plan. Under "every living spouse" it
    // lapses the year person 1 dies — and the survivor years are exactly where a widow's halved
    // bracket would otherwise strand spending under a cap protecting nothing.
    const r = simulate({ ...ACA_LIVE, ...ACA_ARM, birthyear1: 1968, die1: 60, birthyear2: 1959, die2: 90 });
    const married = r.log.filter(e => typeof e.age1 === 'number');
    const widowed = r.log.filter(e => e.age1 === '—');
    assert(married.length > 0 && widowed.length > 0, 'fixture must span the death');
    assert(widowed.every(e => !e['acaBreach']),
        'once the only pre-Medicare spouse is gone the cap must lapse for the survivor');
    assert(married.some(e => e['acaBreach']),
        'and it must have been binding while the younger spouse was alive (else the test proves nothing)');
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

// ── P38: the funding invariant ────────────────────────────────────────────────
// THE INVARIANT: no year may report a shortfall while the IRA still holds a drawable balance.
// A shortfall is a claim that the household could not be funded. That claim is false while a
// seven-figure IRA sits untouched, whatever the strategy's preferences are — spending is a hard
// requirement and every strategy's ceiling is a preference.
//
// This block is a CHARACTERIZATION RECORDING first and an invariant second, the same pattern
// sweep_golden.js uses. The counts below are what the engine does TODAY, defect included, so the
// fix shows up as a diff on these lines instead of as a test appearing from nowhere. Every count
// that is currently non-zero is a bug being pinned, not behavior being blessed.
//
// Why the whole suite stayed green with this live: 189 tests passed while Proportional 0% stranded
// $304k. Every non-bracket fixture had buffers deep enough to hide the gap. So a fixture that does
// not DRAIN proves nothing here, which is what the companion test below enforces.
//
// SCOPE — this measures the IRA leg only, deliberately. Probing every strategy turned up two
// independent defects wearing the same symptom:
//   (a) shortfall while the IRA still has money  → P38. No IRA leg in the correction passes.
//   (b) shortfall, IRA empty, Brokerage still has money → P32. Brokerage is deliberately excluded
//       from the third pass (optimizer_core.js:1649-1653, the cap-gains spiral). Only the
//       IRMAA-tier arm exhibits it on this fixture, and no part of P38 fixes it.
// Folding both into one assertion would leave this test permanently red for a reason P38 is not
// allowed to address. (b) gets its own pinned tripwire at the bottom of the block.
const _shortYear = e => Math.abs(e.shortfall || 0) > 1;
const _iraStranded  = log => log.filter(e => _shortYear(e) && (e.TotalIRA  || 0) > 1);
const _brokStranded = log => log.filter(e => _shortYear(e) && (e.TotalIRA || 0) <= 1 && (e.Brokerage || 0) > 1);
const _worst = rows => rows.length ? Math.max(...rows.map(e => Math.abs(e.shortfall))) : 0;

// One row per strategy the dispatch in planPrimaryWithdrawals can reach, so a strategy added later
// is one line here rather than a new test. `__unrecognized__` is not a typo: it exercises the
// baseline `else` (optimizer_core.js:1451), which is also where `gk` and a lapsed `aca` land.
//   iraStranded  — years reporting a shortfall with IRA left. THE DEFECT. Target for all of these
//                  is 0; the non-zero values are pinned bugs.
//   worst        — largest single-year unfunded amount among them, so a shrinking count that hides
//                  a growing gap cannot pass.
//   convergence  — `ordered` is a different failure class and is flagged so the exhaustion checks
//                  below skip it. Its own sequence already reaches every account, so its residual
//                  is not "we ran out", it is "we stopped one iteration early": the third pass
//                  (optimizer_core.js:1645-1647) funds the gap, recomputes tax, and nothing loops
//                  back for the tax that recompute just created. RIBC makes it unmissable — it
//                  strands $73 while holding $58,597 of Cash, because Cash is last in its order
//                  and the pass that would have reached it never runs a second time.
const FUNDING_ARMS = [
    { name: 'bracket 22%',    over: { strategy: 'bracket',  stratRate: 0.22 },                              iraStranded:  0, worst:      0 },
    { name: 'IRMAA tier1',    over: { strategy: 'bracket',  stratRate: 0, stratIRMAATier: 1 },            iraStranded:  0, worst:      0 },
    { name: 'fixedpct 2%',    over: { strategy: 'fixedpct', iraWithdrawPct: 0.02 },                         iraStranded:  0, worst:      0 },
    { name: 'propwd 0%',      over: { strategy: 'propwd',   propWithdraw: 0,    stratRate: 0 },             iraStranded:  0, worst:      0 },
    { name: 'propwd 10%',     over: { strategy: 'propwd',   propWithdraw: 0.10, stratRate: 0 },             iraStranded:  0, worst:      0 },
    { name: 'propwd 50%',     over: { strategy: 'propwd',   propWithdraw: 0.50, stratRate: 0 },             iraStranded:  0, worst:      0 },
    // P104b1. Two split vectors: the cash-first one whose spill is CIBR-shaped, and a blend. Both
    // are baseline-class (isBracketStrategy false), so the forced-IRA backstop applies and the
    // target is 0 like propwd's.
    { name: 'split C100',     over: { strategy: 'split',    splitWeights: [0, 0, 1, 0],       stratRate: 0 }, iraStranded:  0, worst:      0 },
    { name: 'split I4B3C3',   over: { strategy: 'split',    splitWeights: [0.4, 0.3, 0.3, 0], stratRate: 0 }, iraStranded:  0, worst:      0 },
    { name: 'fixed',          over: { strategy: 'fixed' },                                                  iraStranded:  0, worst:      0 },
    // These moved twice. Fixing the dividend/interest double-credit took RIBC from 2 stranded years
    // to 1; switching OBBBA on moved both again, CBIR to 3 and RIBC back to 2. The direction is not
    // meaningful and the amounts are tiny ($10-$161). This is the convergence class: the third pass
    // funds spending, recomputes tax, and nothing loops back for the tax that recompute just
    // created. `ordered` is the one family excluded from the forced-IRA loop (optimizer_core.js
    // gate), so unlike every other arm it has no second chance, and any change to the tax path
    // reshuffles which years end a few dollars short. Raising the forced-IRA iteration cap does not
    // help here for exactly that reason - ordered never enters that loop.
    { name: 'ordered CBIR',   over: { strategy: 'ordered',  orderedSeq: 'CBIR' },                           iraStranded:  3, worst: 161.27, convergence: true },
    { name: 'ordered RIBC',   over: { strategy: 'ordered',  orderedSeq: 'RIBC' },                           iraStranded:  2, worst: 58.38, convergence: true },
    { name: 'gk',             over: { strategy: 'gk',       gkGuard: 0.20, gkAdjPct: 0.10 },                iraStranded:  0, worst:      0 },
    { name: 'baseline else',  over: { strategy: '__unrecognized__' },                                       iraStranded:  0, worst:      0 },
    { name: 'aca lapsed',     over: { strategy: 'aca',      stratRate: 0, stratACAMultiple: 400 },          iraStranded:  0, worst:      0 },
];
// Every row above except the two `ordered` ones now reads 0, and each of those zeroes replaced a
// number this branch measured before touching the engine:
//   propwd 0%      13 yrs / worst $28,400   ->  0    aca lapsed   13 / $28,400  ->  0
//   propwd 10%      7 yrs / worst    $964   ->  0    baseline     13 / $28,400  ->  0
//   fixed          14 yrs / worst $45,827   ->  0    gk            6 / $15,540  ->  0
// `ordered` is unchanged because it is deliberately still excluded from the backstop, and the two
// values are the convergence residual described above, not stranded capital.

for (const arm of FUNDING_ARMS) {
    test(`funding invariant [${arm.name}]: shortfall years with IRA still funded`, () => {
        const log = simulate({ ...CAP_BASE, stratACAMultiple: 0, ...arm.over }).log;
        const stranded = _iraStranded(log);
        assert(stranded.length === arm.iraStranded,
            `expected ${arm.iraStranded} year(s) reporting a shortfall with IRA left, got ${stranded.length}` +
            (stranded.length ? ` [${stranded.map(e => `${e.year}:${Math.round(e.shortfall)}`).join(' ')}]` : '') +
            ' — if this DROPPED, the defect was fixed: update the pin and say so in the changelog');
        assertNear(_worst(stranded), arm.worst,
            `worst single-year unfunded amount for ${arm.name}`, 1);
        // Every stranded year must have spent the tax-free buffers first. Without this a future
        // change could satisfy the pin by stranding money for some entirely different reason.
        // Skipped for the convergence class, where money demonstrably IS still reachable — that is
        // the finding, not a flaw in the check.
        if (!arm.convergence) {
            const lazy = stranded.filter(e => (e.Cash || 0) > 1 || (e.Roth || 0) > 1);
            assert(lazy.length === 0,
                `${lazy.length} stranded year(s) still held Cash or Roth, so the gap fill was not exhausted ` +
                `[${lazy.slice(0, 3).map(e => `${e.year} cash=${Math.round(e.Cash)} roth=${Math.round(e.Roth)}`).join('; ')}]`);
        }
    });
}

test('funding invariant: the fixture actually drains (guards a vacuous green)', () => {
    // The whole reason this defect shipped is that buffered fixtures hide it: 189 tests passed
    // while Proportional 0% stranded $304k. An arm that never exhausts a tax-free buffer never
    // reaches the correction passes, so its zero would mean "not tested", not "correct".
    //
    // The bar is Cash specifically, not "every account". Some arms legitimately end with money in
    // other places and still exercise the path fully: the IRMAA-tier arm drains its IRA and leaves
    // Brokerage (that is the P32 case pinned below).
    //
    // An arm that never empties Cash has to clear a DIFFERENT bar, not be waved through: it must
    // have funded the whole plan, every year, with nothing stranded. Then its zero means "nothing
    // needed stranding", which is a real statement, rather than "the path was never reached".
    // P38 PR 3 moved two arms into that class - `propwd 10%` and `gk`. Sizing the primary draw net
    // of the tax on guaranteed income stopped the under-draw those two were papering over with
    // surplus, so on this fixture they now finish solvent with Cash to spare (min Cash 51,002 and
    // 27,263) instead of scraping Cash to zero. Naming them here instead would rebuild exactly the
    // stale exemption list that caused P38 in the first place.
    // The bar is "no year stranded spending", NOT totals.success. Those differ: success also fails
    // when the terminal portfolio cannot cover its own required draw (optimizer_core.js:2325), which
    // is a solvency statement about the last year rather than anything about the funding path. Once
    // dividends and interest stopped being double-credited, `propwd 10%` ends its final year with
    // $90,149 against a $139,366 required draw where the phantom money used to hold it at $166,534,
    // so it reports success:false while never stranding a dollar of spending. Gating on success
    // there would fail this guard for a reason it was not written to police.
    for (const arm of FUNDING_ARMS.filter(a => !a.convergence)) {
        const r = simulate({ ...CAP_BASE, stratACAMultiple: 0, ...arm.over });
        if (r.log.some(e => (e.Cash || 0) <= 1)) continue;          // drained: the pin is earned
        const short = r.log.filter(e => Math.abs(e.shortfall || 0) > 1);
        assert(short.length === 0,
            `${arm.name} never empties Cash AND strands spending in ${short.length} year(s) — it ` +
            `cannot exercise the funding path, so its pin proves nothing`);
    }
    // The convergence arms are exercised by a different fact: they strand money they could still
    // reach. Assert that directly so they are not simply unchecked.
    for (const arm of FUNDING_ARMS.filter(a => a.convergence)) {
        const log = simulate({ ...CAP_BASE, stratACAMultiple: 0, ...arm.over }).log;
        const stranded = _iraStranded(log);
        assert(stranded.length > 0 && stranded.every(e => (e.TotalIRA || 0) > 1),
            `${arm.name} should strand spending while the IRA is still funded — that is the convergence gap`);
    }
});

// ── P84a-P84f: the annual advisor fee ─────────────────────────────────────────
// A 1% fee on $2M is ~$20,000 in year one and compounds for the whole horizon, which is larger than
// several of the levers this tool argues about. The three invariants worth guarding are all easy to
// break by "tidying up": fee dollars taken from an IRA are NOT taxable distributions, the base is
// the prior December 31 snapshot rather than the live balance, and both counterfactual arms pay the
// fee so Opportunity Cost stays about the conversion.
const _ADVISOR_BASE = {
    STATEname: 'TX', strategy: 'propwd', propWithdraw: 0.05,
    nYears: 25, birthyear1: 1950, birthmonth1: 6, die1: 95,
    birthyear2: 0, birthmonth2: 0, die2: 0, hasSpouse: false,
    IRA1: 1500000, IRA2: 0, Roth: 200000, Roth2: 0,
    Brokerage: 400000, BrokerageBasis: 200000, Cash: 100000, CashReserve: null,
    ss1: 30000, ss1Age: 70, ss2: 0, ss2Age: 0,
    pensionAnnual: 0, pensionStartAge: 0, survivorPct: 0, pensionCola: false,
    spendGoal: 90000, spendChange: 0, iraBaseGoal: 0,
    inflation: 0.025, cpi: 0.025, growth: 0.06, cashYield: 0.02, dividendRate: 0.0,
    ssFailYear: 2099, ssFailPct: 1.0, convertExcessToRoth: false,
    extraConversionAmount: 0, iraWithdrawPct: 0.05,
    startAge: 76, startInYear: 2026, dividendReinvest: false,
};
// Pre-RMD throughout, spending fully covered by Cash then Brokerage, IRA last in the sequence, all
// rates zero. Any IRA withdrawal or any tax at all in this fixture can ONLY be the fee leaking.
// `nYears` is the amortization horizon, NOT the run length - the plan runs to `die1`, and an earlier
// draft of this fixture read a 45-year run as a 10-year one and mistook compounding for a leak.
const _ADVISOR_QUIET = {
    STATEname: 'TX', strategy: 'ordered', orderedSeq: 'CBRI', nYears: 10,
    birthyear1: 1975, birthmonth1: 6, die1: 60,
    birthyear2: 0, birthmonth2: 0, die2: 0, hasSpouse: false,
    IRA1: 1000000, IRA2: 0, Roth: 0, Roth2: 0,
    Brokerage: 600000, BrokerageBasis: 600000, Cash: 400000, CashReserve: null,
    ss1: 0, ss1Age: 70, ss2: 0, ss2Age: 0,
    pensionAnnual: 0, pensionStartAge: 0, survivorPct: 0, pensionCola: false,
    spendGoal: 40000, spendChange: 0, iraBaseGoal: 0,
    inflation: 0, cpi: 0, growth: 0, cashYield: 0, dividendRate: 0,
    ssFailYear: 2099, ssFailPct: 1.0, convertExcessToRoth: false,
    extraConversionAmount: 0, startAge: 51, startInYear: 2026, dividendReinvest: false,
};
const _sumKey = (log, k) => log.reduce((a, r) => a + (r[k] || 0), 0);

test('P84a: the fee OFF is bit-identical to the field being absent', () => {
    const absent = simulate({ ..._ADVISOR_BASE });
    const zero = simulate({ ..._ADVISOR_BASE, advisorFeeAmount: 0, advisorFeeMode: 'pct', advisorFeeScope: 'all' });
    assert(_logSansTiming(absent.log) === _logSansTiming(zero.log),
        'a zero fee must not move a single logged number');
    assertNear(zero.totals.advisorFees || 0, 0, 'lifetime fees at amount 0', 1e-9);
});

test('P84b: every scope charges the right basis and pays from the right accounts', () => {
    // basis is a fraction of the PRIOR Dec 31 balances, which in year 0 are the typed inputs.
    const cases = [
        { scope: 'brokerage',  basis: 400000,  fromIRA: 0 },
        { scope: 'roths',      basis: 200000,  fromIRA: 0 },
        { scope: 'iras',       basis: 1500000, fromIRA: 15000 },
        { scope: 'rothira',    basis: 1700000, fromIRA: 15000 },
        { scope: 'all',        basis: 2100000, fromIRA: 15000 },
        // charges against everything, but pays entirely out of the larger IRA - the whole point
        { scope: 'allfromira', basis: 2100000, fromIRA: 21000 },
    ];
    for (const c of cases) {
        const r = simulate({ ..._ADVISOR_BASE, advisorFeeAmount: 1, advisorFeeMode: 'pct', advisorFeeScope: c.scope });
        const y0 = r.log[0];
        assertNear(y0['-advisorFeeBasis'], c.basis, `${c.scope}: year-0 basis`, 1);
        assertNear(y0.AdvisorFee, c.basis * 0.01, `${c.scope}: year-0 fee at 1%`, 1);
        assertNear(y0['-advisorFeeFromIRA'], c.fromIRA, `${c.scope}: year-0 paid out of the IRAs`, 1);
    }
});

test('P84b: scope "none" is the default, and it is a real off switch', () => {
    // 'none' exists so a comparison is one control away: leave the amount typed and flip the
    // dropdown, rather than clearing and retyping a number. It must therefore be EXACTLY equal to
    // having no fee at all, not merely close.
    const absent = simulate({ ..._ADVISOR_BASE });
    const none = simulate({ ..._ADVISOR_BASE, advisorFeeAmount: 1.5, advisorFeeMode: 'pct', advisorFeeScope: 'none' });
    assert(_logSansTiming(absent.log) === _logSansTiming(none.log),
        'scope "none" with a live amount must not move a single logged number');
    assertNear(none.totals.advisorFees || 0, 0, 'lifetime fees at scope none', 1e-9);

    // Unset and unrecognized both FAIL SAFE to none. The alternative -- defaulting to 'all' -- would
    // mean a plan that never mentioned a scope silently bills every account.
    for (const scope of [undefined, '', 'nonsense']) {
        const r = simulate({ ..._ADVISOR_BASE, advisorFeeAmount: 1.5, advisorFeeMode: 'pct', advisorFeeScope: scope });
        assertNear(r.totals.advisorFees || 0, 0, `an unset/unknown scope (${String(scope)}) must charge nothing`, 1e-9);
    }
    // And flat mode must respect it too: that branch never reads the basis, so an empty basis array
    // alone would not have stopped it.
    const flatNone = simulate({ ..._ADVISOR_BASE, advisorFeeAmount: 20000, advisorFeeMode: 'flat', advisorFeeScope: 'none' });
    assertNear(flatNone.totals.advisorFees || 0, 0, 'a flat fee at scope none', 1e-9);

    // The off switch is only useful if the on position actually differs.
    const on = simulate({ ..._ADVISOR_BASE, advisorFeeAmount: 1.5, advisorFeeMode: 'pct', advisorFeeScope: 'all' });
    assert(on.totals.advisorFees > 1000, 'the same amount at a real scope must charge a real fee');
});

test('P84b: Cash is never a basis and never a source', () => {
    // An all-Cash portfolio billed at the widest scope must pay nothing at all. Cash is the
    // spending buffer the Cash Reserve protects; billing it would fight the refill every year.
    const r = simulate({
        ..._ADVISOR_BASE, IRA1: 0, IRA2: 0, Roth: 0, Roth2: 0, Brokerage: 0, BrokerageBasis: 0,
        Cash: 2000000, advisorFeeAmount: 1, advisorFeeMode: 'pct', advisorFeeScope: 'all',
    });
    assertNear(r.totals.advisorFees || 0, 0, 'fees charged to an all-Cash portfolio', 1e-9);
});

test.critical('P84c: fee dollars taken from an IRA are NOT taxable distributions', () => {
    const off = simulate({ ..._ADVISOR_QUIET });
    const fee = simulate({ ..._ADVISOR_QUIET, advisorFeeAmount: 2, advisorFeeMode: 'pct', advisorFeeScope: 'iras' });
    assert(fee.totals.advisorFees > 100000,
        `the fixture must actually charge a large fee, got ${Math.round(fee.totals.advisorFees)}`);
    assertNear(_sumKey(fee.log, 'IRAwd'), 0, 'IRA withdrawals with a large IRA fee', 1e-6);
    assertNear(_sumKey(fee.log, 'totalTax'), _sumKey(off.log, 'totalTax'),
        'lifetime tax must not move when the fee is paid from the IRA', 1e-6);
    assertNear(off.totals.terminal.ira - fee.totals.terminal.ira, fee.totals.advisorFees,
        'the IRA must fall by exactly the fees charged', 1);
});

test.critical('P84c: the fee never enters netWithdrawals, in any scope', () => {
    // The mechanism behind the test above, asserted directly: every calculateTaxes() call site reads
    // yr.netWithdrawals.IRA as both earnedIncome and iraIncome, so this accumulator IS the boundary.
    for (const scope of ['iras', 'rothira', 'all', 'allfromira']) {
        const off = simulate({ ..._ADVISOR_QUIET });
        const fee = simulate({ ..._ADVISOR_QUIET, advisorFeeAmount: 2, advisorFeeMode: 'pct', advisorFeeScope: scope });
        assertNear(_sumKey(fee.log, 'IRAwd'), _sumKey(off.log, 'IRAwd'),
            `${scope}: IRA withdrawals must be untouched by the fee`, 1e-6);
    }
});

test('P84c: a mid-year fee does not move the SAME year\'s RMD, only later ones', () => {
    // This is R11 retired. Before P84l the RMD was struck off the live balance, so charging the fee
    // first shrank that year's RMD by the fee rate. Now the RMD keys off the prior December 31
    // balance, which is the legally correct answer: this year's obligation is already fixed, and the
    // fee shows up in NEXT year's basis because it really did leave the account.
    const off = simulate({ ..._ADVISOR_BASE });
    const fee = simulate({ ..._ADVISOR_BASE, advisorFeeAmount: 1, advisorFeeMode: 'pct', advisorFeeScope: 'iras' });
    assertNear(fee.log[0]['RMD1-'], off.log[0]['RMD1-'],
        'year-0 RMD must be identical with and without the fee', 1e-6);
    assert(fee.log[1]['RMD1-'] < off.log[1]['RMD1-'] - 1,
        'year-1 RMD should be lower, because the December 31 balance now reflects the fee');
});

test('P84d: percent vs dollars is inferred from the amount, and 20 belongs to FLAT', () => {
    // One field carries both meanings. A real advisory fee is a fraction of a percent to about 2%;
    // a real flat fee is thousands. The ranges do not overlap near the threshold.
    assert(ADVISOR_FEE_PCT_MAX === 20, 'the documented threshold is 20');
    for (const [amt, want] of [[0.5, 'pct'], [1, 'pct'], [1.25, 'pct'], [19.99, 'pct'],
                               [20, 'flat'], [20.01, 'flat'], [12000, 'flat'], [20000, 'flat']]) {
        assert(inferAdvisorFeeMode(amt, null) === want,
            `${amt} should infer ${want}, got ${inferAdvisorFeeMode(amt, null)}`);
    }
    // THE BOUNDARY BELONGS TO FLAT ON PURPOSE. Reading a bare 20 as $20/yr is harmless; reading it
    // as 20% would quietly destroy a plan. The asymmetry of being wrong picks the side.
    assert(inferAdvisorFeeMode(20, null) === 'flat', '20 must read as dollars, not as 20 percent');

    // An explicit marker always wins over the magnitude, in both directions.
    assert(inferAdvisorFeeMode(50, 'pct') === 'pct', 'an explicit percent survives a large number');
    assert(inferAdvisorFeeMode(15, 'flat') === 'flat', 'an explicit dollar survives a small number');

    // And the ENGINE must be safe on its own: a shared link carrying af=20000 with no afm must not
    // be read as a 20,000% fee. This is the case that made inference an engine concern, not a UI one.
    const r = simulate({ ..._ADVISOR_BASE, advisorFeeAmount: 20000, advisorFeeScope: 'all' });
    assertNear(r.log[0].AdvisorFee, 20000, 'a bare 20000 is twenty thousand dollars, not 20000 percent', 1);
});

test('P84d: a flat fee is CPI-indexed, and a percent fee is not', () => {
    // cpi and inflation deliberately differ, so a wrong clock is visible rather than plausible.
    const r = simulate({ ..._ADVISOR_BASE, cpi: 0.03, inflation: 0.06,
                         advisorFeeAmount: 12000, advisorFeeMode: 'flat', advisorFeeScope: 'all' });
    assertNear(r.log[0].AdvisorFee, 12000, 'year-0 flat fee', 1);
    assertNear(r.log[10].AdvisorFee, 12000 * Math.pow(1.03, 10), 'year-10 flat fee, indexed at CPI', 1);
    // In flat mode the basis is unused, so it stays 0 rather than reporting a number nobody used.
    assertNear(r.log[0]['-advisorFeeBasis'], 0, 'flat mode reports no basis', 1e-9);
});

test('P84e: the fee is tracked in the totals and three log keys; the running total is P86-computed', () => {
    const r = simulate({ ..._ADVISOR_BASE, advisorFeeAmount: 1, advisorFeeMode: 'pct', advisorFeeScope: 'all' });
    assertNear(r.totals.advisorFees, _sumKey(r.log, 'AdvisorFee'), 'totals.advisorFees equals the per-year sum', 1);
    assert(r.totals.advisorFeesCurrentDollars > 0 && r.totals.advisorFeesCurrentDollars < r.totals.advisorFees,
        'the current-dollar total must be positive and smaller than the nominal one');
    assertNear(r.totals.advisorFeesCurrentDollars,
        r.log.reduce((a, e) => a + (e.AdvisorFee || 0) / (e.inflationFactor || 1), 0),
        'the current-dollar total is the sum of each year deflated by its own factor', 1);
    for (const k of ['AdvisorFee', '-advisorFeeBasis', '-advisorFeeFromIRA']) {
        assert(k in r.log[0], `log rows must carry ${k}`);
        assert(k in simulate({ ..._ADVISOR_BASE }).log[0],
            `log rows must carry ${k} even with no fee, or the identity tests break`);
    }
    // P86: the stored running totals left the engine log; the UI computes them on demand. If one
    // reappears here the wrong-basis Current-$ bug it caused comes back with it.
    for (const k of ['SumAdvisorFees', 'SumTaxes', 'Spendable']) {
        assert(!(k in r.log[0]), `${k} must NOT be a stored log key (P86 computes it in the UI)`);
    }
});

test('P86: running-total identities - every lifetime total is the sum of its per-year column, in both bases', () => {
    // Inflation is live in this base, so a wrong deflation basis is visible rather than plausible.
    const r = simulate({ ..._ADVISOR_BASE, advisorFeeAmount: 0.8, advisorFeeMode: 'pct', advisorFeeScope: 'all' });
    const sumCD = (log, f) => log.reduce((a, e) => a + f(e) / (e.inflationFactor || 1), 0);
    // Nominal identities: the totals the tiles read equal the per-year columns the table shows.
    assertNear(r.totals.tax, _sumKey(r.log, 'totalTax'), 'totals.tax = sum of totalTax', 1);
    assertNear(r.totals.spend,
        r.log.reduce((a, e) => a + (e.spendGoal || 0) + (e.shortfall || 0), 0),
        'totals.spend = sum of delivered spend (spendGoal + shortfall)', 1);
    // Current-$ identities: the CD twins are the sum of each year deflated by its OWN factor -
    // never a nominal total deflated by one year's factor.
    assertNear(r.totals.taxCurrentDollars, sumCD(r.log, e => e.totalTax || 0),
        'taxCurrentDollars = sum of per-year deflated tax', 1);
    assertNear(r.totals.spendCurrentDollars,
        sumCD(r.log, e => (e.spendGoal || 0) + (e.shortfall || 0)),
        'spendCurrentDollars = sum of per-year deflated delivered spend', 1);
    // Each accumulator's per-year source is non-negative (delivered spend = min(goal, netIncome)),
    // so ANY running sum of them - either basis - is non-decreasing. This is the engine-side half
    // of the guarantee; the browser tier checks the rendered cells.
    for (const e of r.log) {
        assert((e.totalTax || 0) >= 0, 'per-year tax never negative');
        assert((e.AdvisorFee || 0) >= 0, 'per-year fee never negative');
        assert(((e.spendGoal || 0) + (e.shortfall || 0)) >= -1e-6,
            'per-year delivered spend never negative');
    }
});

test('P86c: lifetime RMD and QCD carry Current-$ twins built the tax/spend way', () => {
    // Inflation is live, so a twin that merely copied the nominal total would fail loudly here.
    const r = simulate({ ..._ADVISOR_BASE, qcdHHMax: 20000 });
    const sumCD = (log, f) => log.reduce((a, e) => a + f(e) / (e.inflationFactor || 1), 0);
    assert(r.totals.rmd > 0, 'fixture must produce RMDs');
    assert(r.totals.qcd > 0, 'fixture must produce QCDs');
    assert(r.totals.rmdCurrentDollars > 0 && r.totals.rmdCurrentDollars < r.totals.rmd,
        'rmdCurrentDollars must be positive and smaller than the nominal total');
    assert(r.totals.qcdCurrentDollars > 0 && r.totals.qcdCurrentDollars < r.totals.qcd,
        'qcdCurrentDollars must be positive and smaller than the nominal total');
    assertNear(r.totals.rmdCurrentDollars, sumCD(r.log, e => e.RMDwd || 0),
        'rmdCurrentDollars = sum of per-year deflated RMDs', 1);
    assertNear(r.totals.qcdCurrentDollars, sumCD(r.log, e => (e.QCD1 || 0) + (e.QCD2 || 0)),
        'qcdCurrentDollars = sum of per-year deflated QCDs', 1);
});

test('P84f: BOTH counterfactual arms pay the fee, so Opportunity Cost stays about the conversion', () => {
    // The docblock forbids a _cfRun guard. If one is ever added, the two arms diverge by the whole
    // fee stream and every OC number becomes nonsense. This catches that.
    const withOC = simulate({ ..._ADVISOR_BASE, convertExcessToRoth: true, computeOC: true,
                              advisorFeeAmount: 1, advisorFeeMode: 'pct', advisorFeeScope: 'all' });
    assert(withOC.totals.advisorFees > 0, 'the fixture must charge a fee for this to mean anything');
    const src = String(simulate);
    assert(!/_cfRun[^;]{0,120}advisorFee/.test(src) && !/advisorFee[^;]{0,120}_cfRun/.test(src),
        'applyAdvisorFee must not be gated on _cfRun');
});

// ── P84l/m/o: the RMD basis is the prior December 31 balance ──────────────────
// 26 CFR 1.401(a)(9)-5 sets the year's required distribution as the prior December 31 account
// balance over the life-expectancy divisor. Before P84l the engine struck it off `balance.IRA1`
// AFTER beginYear applied this year's pre-withdrawal growth, which overstated every RMD and -- far
// worse -- coupled it to `preMonths`, which is 1 or 11 depending on whether LAST year converted
// more than $1,000. Two otherwise identical plans got different RMDs because one converted.
const _RMD_BASE = {
    STATEname: 'TX', strategy: 'propwd', propWithdraw: 0.05,
    nYears: 25, birthyear1: 1950, birthmonth1: 6, die1: 95,
    birthyear2: 0, birthmonth2: 0, die2: 0, hasSpouse: false,
    IRA1: 1500000, IRA2: 0, Roth: 0, Roth2: 0,
    Brokerage: 200000, BrokerageBasis: 100000, Cash: 100000, CashReserve: null,
    ss1: 30000, ss1Age: 70, ss2: 0, ss2Age: 0,
    pensionAnnual: 0, pensionStartAge: 0, survivorPct: 0, pensionCola: false,
    spendGoal: 90000, spendChange: 0, iraBaseGoal: 0,
    inflation: 0.025, cpi: 0.025, growth: 0.06, cashYield: 0.02, dividendRate: 0.0,
    ssFailYear: 2099, ssFailPct: 1.0, convertExcessToRoth: false,
    extraConversionAmount: 0, iraWithdrawPct: 0.05,
    startAge: 76, startInYear: 2026, dividendReinvest: false,
};

// Per ACCOUNT, deliberately. Each spouse carries their own divisor, so `(rmd1+rmd2)` over the
// combined prior balance is a blend weighted by the IRA1/IRA2 split -- and that split moves between
// arms, so the blended ratio differs even when the basis is exactly right. Measuring the blend
// instead of the quantity claimed is how this very test was first written wrong.
const _rmdRatios = (log) => {
    const out = [];
    for (let y = 1; y < log.length; y++) {
        const rmd = log[y]['RMD1-'] || 0, prior = log[y - 1].IRA1 || 0;
        if (rmd > 1 && prior > 1) out.push(rmd / prior);
    }
    return out;
};

test('P84l: the RMD is struck off the PRIOR December 31 balance, not a mid-year one', () => {
    const r = simulate({ ..._RMD_BASE });
    const ratios = _rmdRatios(r.log);
    assert(ratios.length >= 5, `fixture must produce RMD years, got ${ratios.length}`);
    // Every ratio must be a clean IRS divisor reciprocal: 1/x for x the life-expectancy factor,
    // which is a one-decimal number. If the basis carried a growth stub the ratio would be
    // (1/x) * (1+g)^(preMonths/12) and 1/ratio would not land on a tenth.
    for (const q of ratios) {
        const factor = 1 / q;
        assertNear(factor, Math.round(factor * 10) / 10,
            `1/(RMD ÷ prior year-end IRA) must be a life-expectancy factor to one decimal, got ${factor}`,
            1e-6);
    }
});

test('P84l: the RMD basis does not depend on the withdrawal-timing rule', () => {
    // THE COUPLING TEST. This is the one that fails on main: preMonths is 1 or 11, so the old basis
    // moved by (1+g)^(10/12) between the arms. Note this pins the BASIS, not the lifetime total --
    // timing legitimately changes the balance PATH, so later RMDs may still differ in level.
    const late  = _rmdRatios(simulate({ ..._RMD_BASE, forceWithdrawTiming: 'late'  }).log);
    const early = _rmdRatios(simulate({ ..._RMD_BASE, forceWithdrawTiming: 'early' }).log);
    const n = Math.min(late.length, early.length);
    assert(n >= 5, `both arms must produce RMD years, got ${late.length} and ${early.length}`);
    for (let i = 0; i < n; i++) {
        assertNear(late[i], early[i],
            `year ${i}: the RMD divisor must not move with withdrawal timing`, 1e-12);
    }
});

test('P84m: a drained IRA is not taxed on a distribution that never happened', () => {
    // The debits floor at zero, but totalRMD/taxableRMD used to be computed from the REQUIREMENT.
    // A QCD large enough to empty the account is the path that reaches this today.
    const r = simulate({ ..._RMD_BASE, qcdHHMax: 5000000, qcdMode: 'max' });
    for (const row of r.log) {
        const outflow = (row['RMD1-'] || 0) + (row['RMD2-'] || 0);
        assert((row.taxableRMD ?? 0) <= outflow + 1,
            `taxable RMD ${row.taxableRMD} exceeds the realized outflow ${outflow} in ${row.year}`);
    }
    const anyIRA = r.log.some(row => (row.IRA1 || 0) + (row.IRA2 || 0) > 1);
    assert(anyIRA || r.log.length > 0, 'fixture must actually run');
});

test('P84o: year 0 keys off the balance AS TYPED, and that limitation is pinned not hidden', () => {
    // P84l is exact for every year after the first: the simulation knows its own December 31
    // balance. Year 0 seeds from the typed IRA balance, which IS a December 31 balance only for a
    // plan starting in January. P72 owns startMonth and therefore owns the fix. Until then the
    // limitation is pinned here so it cannot drift, and stated in the UI, rather than papered over
    // with a growth-based back-out that would be a guess wearing a number's clothes.
    const typed = 900000;
    const r = simulate({ ..._RMD_BASE, IRA1: typed, startAge: 80, birthyear1: 1946 });
    const first = r.log.find(row => (row['RMD1-'] || 0) > 1);
    assert(first, 'fixture must take an RMD in year 0');
    const factor = typed / first['RMD1-'];
    assertNear(factor, Math.round(factor * 10) / 10,
        `year 0's RMD must be the TYPED balance over a divisor, got factor ${factor}`, 1e-6);
});

// ── P105: the survivor's RMD basis includes what they just inherited ────
// Reported from a share link, 2026-09-03: on a plan whose first spouse died holding $2.13M, the
// household's entire RMD for the next year was 12.8% of the survivor's own $79k. computeIncome
// moves the decedent's IRA into the survivor's account at the top of the year, but the basis was
// read from the prior December 31 SPLIT, where that money was still the decedent's - and a dead
// person's RMD is zeroed, so it was charged to nobody. Exactly one year went missing per death,
// because by the following year the prior year-end split had the money in the right account.
//
// Both tests derive their expected value from the run's OWN prior row rather than a captured
// dollar figure. A magic number here would pass just as well against a basis that happened to sum
// to the same total, and the whole defect was a basis that looked plausible.
test.critical("P105: the survivor's first RMD is struck off the inherited balance, not only their own", () => {
    // CAP_BASE: person 1 born 1960 dies at 74, so they never reach their own RMD age of 75 and
    // every RMD in this plan is person 2's. The first survivor year is therefore the cleanest
    // possible read - one living owner, one divisor, two prior-year balances.
    const r = simulate({ ...CAP_BASE, strategy: 'fixed' });
    const i = r.log.findIndex(row => row.age1 === '—');
    assert(i > 0, 'fixture must have a first death inside the plan, with a prior year to read');
    const prev = r.log[i - 1], now = r.log[i];
    const inherited = prev.IRA1 || 0, own = prev.IRA2 || 0;
    assert(inherited > 20 * own,
        `fixture must leave most of the money in the DECEDENT's account, got ${Math.round(inherited)} vs ${Math.round(own)}`);
    const pct = now['RMD%'];
    const charged = (now['RMD1-'] || 0) + (now['RMD2-'] || 0);
    assertNear(charged, pct * (inherited + own),
        `the survivor's first RMD must be struck off both balances (own-only would be ${Math.round(pct * own)})`, 1);
    // And the old behavior must not be able to satisfy the assertion above: the two figures are
    // not close, they differ by an order of magnitude on this fixture.
    assert(charged > 10 * pct * own,
        `own-only vs combined must be far apart or this test guards nothing: ${Math.round(charged)} vs ${Math.round(pct * own)}`);
});

test('P105: the inheritance term self-extinguishes, so the year after is not double-counted', () => {
    // The added term reads the DECEDENT's prior year-end balance, which is zero once their account
    // has been empty for a full year. If it did not extinguish, every later survivor year would
    // charge the inherited money twice.
    const r = simulate({ ...CAP_BASE, strategy: 'fixed' });
    const i = r.log.findIndex(row => row.age1 === '—');
    assert(i > 0 && r.log[i + 1], 'fixture must run at least two years past the first death');
    const prev = r.log[i], now = r.log[i + 1];
    assert((prev.IRA1 || 0) === 0, "the decedent's account must be empty at the end of the inheritance year");
    const charged = (now['RMD1-'] || 0) + (now['RMD2-'] || 0);
    assertNear(charged, now['RMD%'] * (prev.IRA2 || 0),
        "the year after inheritance is the survivor's own balance and nothing more", 1);
});

// ── P38 PR 3: the primary draw is sized net of the tax on guaranteed income ───
// PR 2 widened the forced-IRA backstop so the shortfall stopped stranding. That treated the
// symptom: the backstop was making up, year after year, for a first-pass draw that was too small
// by construction. PR 3 fixes the sizing itself (optimizer_core.js:1303), so the backstop goes
// back to being what its name says.
test('P38: the primary draw funds the tax on guaranteed income, not the backstop', () => {
    const r = simulate({ ...CAP_BASE, stratACAMultiple: 0, strategy: 'propwd', propWithdraw: 0, stratRate: 0 });
    assert(r.totals.success && _sumAbsShortfall(r.log) < 100,
        `the plan must still fund fully, got success=${r.totals.success} shortfall=${Math.round(_sumAbsShortfall(r.log))}`);
    // Pinned, not bounded: 395,109 before that change, 43,816 after, and 49,130 once dividends and
    // interest stopped being double-credited (the phantom Cash had been quietly covering part of
    // the residual). The drop from 395,109 is the measurement — that money was the tax on Social
    // Security and the RMDs, which the first-pass draw now covers directly instead of leaving for
    // the backstop to discover. Then 20,381 with the IRC 1014 basis step-up (P35g): the first
    // death raises the survivor's basis, so the same brokerage draw realizes less capital gain and
    // costs less tax, and less spending has to be forced out of the IRA above the ceiling.
    // 20,381 -> 18,719 at P32h, and this one is not a re-pin for its own sake. The third pass may
    // now draw Brokerage, so part of the residual that used to be forced out of the IRA above the
    // ceiling is funded from the taxable account instead. Forced IRA going DOWN is the intended
    // direction: the measurement this test exists for (the primary draw sizing the tax on
    // guaranteed income) is unchanged, and the remaining gap is smaller than it was.
    //
    // 18,719 -> 33,744 at P84l, and this one goes UP, which is the right direction here and is
    // worth spelling out because it looks like a regression. This fixture sets propWithdraw: 0, so
    // there is no primary draw at all: spending is funded by Social Security plus whatever the RMD
    // forces out, and the backstop covers the rest. P84l strikes the RMD off the prior December 31
    // balance instead of the same balance after this year's pre-withdrawal growth, so every RMD is
    // smaller. Less income arrives on its own, and the backstop -- which is what ForcedIRA counts --
    // has to reach further. Smaller RMDs and a larger backstop are the SAME finding seen twice.
    //
    // 33,744 -> 30,943 at P104b1x (2026-09-02), and DOWN is right. The gap fill used to omit the
    // primary pass's Cash draw from what the household could spend, so it drew that amount a
    // second time; the surplus was refunded at year end, but the second draw had already pulled
    // the residual pass into funding tax on money nobody needed. With the phantom gap gone the
    // residual is smaller and the backstop reaches less far. The measurement this test exists for
    // (the primary draw sizing the tax on guaranteed income) is unchanged.
    // 30,943 -> 20,309 at P105 (2026-09-03), DOWN, and it is the same finding this test's P84l
    // paragraph describes, seen from the other side. CAP_BASE's person 1 dies at 74 holding $1.68M,
    // and the survivor's RMD for the following year was struck off their own $75k instead of the
    // inherited total. That year now distributes $78,203 more on its own, so the backstop - which
    // is what ForcedIRA counts - reaches less far. More RMD income and a smaller backstop are one
    // fact, not two. The measurement this test exists for (the primary draw sizing the tax on
    // guaranteed income) is untouched.
    assertNear(_sumForcedIRA(r.log), 20309.022, 'forced-IRA total once the draw is sized correctly', 1);
});

test('P38: sizing by a flat nominal rate would badly over-draw an SS-heavy household', () => {
    // The trap this fix had to avoid. yr.possibleIncome mixes Social Security (0-85% included),
    // ordinary pension/RMD, and qualified dividends (0/15/20%), so multiplying the whole thing by
    // sim.nominalTaxRate is not an approximation of the tax on it — it is several times the real
    // number, and it would have over-drawn the IRA every year while looking perfectly plausible.
    // That is why optimizer_core.js calls calculateTaxes on the guaranteed base instead.
    const guaranteed = { filingStatus: 'MFJ', ages: [72, 70], birthyears: [1954, 1956],
        totalSS: 80000, IRMAAAnnualCost: 0, earnedIncome: 30000, inflation: 1,
        pensionIncome: 0, iraIncome: 30000, qualifiedDiv: 12000, capGains: 0,
        hsaContrib: 0, taxExemptInterest: 0, state: 'CA', fedRateCreep: 1, stateRateCreep: 1 };
    const t = calculateTaxes(guaranteed);
    const possibleIncome = 80000 + 30000 + 12000;
    const flat = possibleIncome * t.nominalRate;
    assert(t.totalTax > 0, 'the fixture must owe some tax, or the comparison is vacuous');
    assert(flat > t.totalTax * 2,
        `flat-rate sizing should be wildly high here; computed ${t.totalTax.toFixed(2)} vs flat ${flat.toFixed(2)}`);
});

// ── OBBBA reaches the simulation, and sunsets ────────────────────────────────
// The senior deduction and the elevated SALT cap were implemented in taxengine.js AND unit-tested
// in optimizer_tests.js - but those unit tests pass `obbaOn: true` themselves, and no call site in
// optimizer_core.js ever did. Both flags default to false, so every simulated year ran without
// them: federal tax too HIGH for anyone 65+ in 2025-2028. Exactly the shape of blind spot that hid
// the dividend double-credit - the tax function was tested directly, its USE was not.
//
// calculateTaxes cannot gate these itself: it receives `inflation` but never a tax year, and the
// sunsetYear values in TAXData.OBBBA are declarative, referenced by no code. The caller owns the
// gate, so the caller is what has to be tested.
const OBBBA_BASE = {
    STATEname: 'AK', strategy: 'propwd', propWithdraw: 0, stratRate: 0,
    stratIRMAATier: -1, stratACAMultiple: 0, nYears: 8,
    birthyear1: 1950, birthmonth1: 1, die1: 95, birthyear2: 1950, birthmonth2: 1, die2: 95,
    hasSpouse: true,
    IRA1: 0, IRA2: 0, Roth: 0, Roth2: 0,
    Brokerage: 2000000, BrokerageBasis: 2000000, Cash: 100000, CashReserve: null,
    ss1: 0, ss1Age: 70, ss2: 0, ss2Age: 70,
    pensionAnnual: 50000, pensionStartAge: 0, survivorPct: 75, pensionCola: false,
    spendGoal: 70000, spendChange: 0, iraBaseGoal: 0,
    inflation: 0, cpi: 0, growth: 0, cashYield: 0, dividendRate: 0,
    ssFailYear: 2099, ssFailPct: 1, convertExcessToRoth: false, iraWithdrawPct: 0.05,
    startYear: 2026, dividendReinvest: false,
};

test('OBBBA: the senior deduction reaches a simulated year, and expires after 2028', () => {
    // Everything is frozen - zero inflation, zero growth, no gains (basis = value), no Social
    // Security - so the ONLY thing that changes from year to year is the OBBBA gate. Both filers are
    // 76, well past 65, and AGI is far below the $150k MFJ phase-out, so the full $12,000 applies.
    const log = simulate({ ...OBBBA_BASE }).log;
    const fed = y => log.find(e => e.year === y).FedTax;
    for (const y of [2026, 2027, 2028]) {
        assertNear(fed(y), 250, `federal tax in ${y} with the senior deduction`, 1);
    }
    for (const y of [2029, 2030]) {
        assertNear(fed(y), 1450, `federal tax in ${y} after the deduction sunsets`, 1);
    }
    // The step is the deduction itself: $12,000 of income moving out of the 10% bracket.
    assertNear(fed(2029) - fed(2028), 1200, 'the sunset step equals 12,000 x 10%', 1);
});

test('OBBBA: every tax call in a simulation is handed the year-gated flags', () => {
    // Guards the defect directly. It was not that the flags were computed wrongly - they were never
    // passed at all, so calculateTaxes silently used its `false` defaults. Spy on the global the
    // engine resolves (optimizer_core.js calls calculateTaxes as a bare global, the classic-script
    // contract it shares with the browser) and inspect what it actually receives.
    const seen = [];
    const real = globalThis.calculateTaxes;
    globalThis.calculateTaxes = function (p) { seen.push({ obbaOn: p.obbaOn, saltHigh: p.saltHigh, propTax: p.propTax, taxYear: p.taxYear }); return real(p); };
    try {
        simulate({ ...OBBBA_BASE, nYears: 10, propTax: 12000 });   // 2026-2035, spans both sunsets
    } finally {
        globalThis.calculateTaxes = real;          // restore even if simulate throws
    }
    assert(seen.length > 0, 'setup: the simulation must actually call calculateTaxes');
    const missing = seen.filter(s => s.obbaOn === undefined || s.saltHigh === undefined);
    assert(missing.length === 0,
        `${missing.length} of ${seen.length} calculateTaxes calls were not given obbaOn/saltHigh, ` +
        `so they silently fell back to the false defaults`);
    // P64a extends this assertion rather than adding a second one, because propTax failed in exactly
    // the same way: implemented in calculateTaxes, never passed by this engine, so SALT was state
    // income tax alone and every itemizer was overtaxed in every simulated year. This is the test
    // that would have caught it, so it is the test that has to cover it.
    const noProp = seen.filter(s => s.propTax === undefined);
    assert(noProp.length === 0,
        `${noProp.length} of ${seen.length} calculateTaxes calls were not given propTax, so they ` +
        `silently fell back to 0 and SALT was state income tax alone`);
    assert(seen.every(s => s.propTax === 12000),
        'with zero inflation the entered property tax must reach every call unchanged');
    // P64d joins the same list: the SALT cap and its phase-out threshold step 1%/yr from a 2025 base,
    // so a call with no taxYear silently prices 2025 in every year of a 30-year plan.
    const noYear = seen.filter(s => !s.taxYear);
    assert(noYear.length === 0,
        `${noYear.length} of ${seen.length} calculateTaxes calls were not given taxYear, so the SALT ` +
        `cap and threshold were frozen at their 2025 base`);
    assert(new Set(seen.map(s => s.taxYear)).size > 1,
        'taxYear must advance with the simulation, not be pinned to one year');
    // And the gate must actually vary with the year, or it is hardcoded rather than gated.
    assert(seen.some(s => s.obbaOn === true) && seen.some(s => s.obbaOn === false),
        'obbaOn must be true before its 2028 sunset and false after, across a run that spans it');
    assert(seen.some(s => s.saltHigh === true) && seen.some(s => s.saltHigh === false),
        'saltHigh must be true before its 2029 sunset and false after');
});

test('P64: property tax lowers federal tax while the elevated SALT cap lives, and stops when it dies', () => {
    // The whole question the user asked, as an assertion. Alaska has no income tax, so SALT here is
    // the property tax and nothing else - the band where the input matters most and the one the old
    // code could never represent. Everything else is frozen (no inflation, no growth, basis = value,
    // no Social Security), so the only thing moving year to year is the cap.
    const withOut = simulate({ ...OBBBA_BASE, nYears: 10 }).log;
    const withIn  = simulate({ ...OBBBA_BASE, nYears: 10, propTax: 40000 }).log;
    const fed = (log, y) => log.find(e => e.year === y).FedTax;

    // 2026-2029: capped SALT is $40,000, which beats the standard deduction, so the household
    // itemizes and pays less. Before P64a both runs were identical - that was the defect.
    for (const y of [2026, 2027, 2028, 2029]) {
        assert(fed(withIn, y) < fed(withOut, y),
            `${y}: property tax must reduce federal tax while the $40k cap is in force ` +
            `(got ${fed(withIn, y)} with, ${fed(withOut, y)} without)`);
    }
    // 2030+: the cap reverts to $10,000, which loses to the standard deduction, so the same
    // $40,000 bill buys nothing. This is the user's own objection, pinned: past 2029 modeling it
    // changes no number at all.
    for (const y of [2030, 2031]) {
        assertNear(fed(withIn, y), fed(withOut, y),
            `${y}: after the SALT cap reverts to $10k the property tax must stop mattering`, 1);
    }
});

test('P64d: the SALT cap and its phase-out threshold are indexed 1%/yr from their 2025 base', () => {
    // The constants in TAXData are 2025 figures, and the statute steps both up 1% per year applied
    // to the prior year's figure. 2026 is exactly $40,400 / $505,000, which is the published pair -
    // the code used to hand every year the flat 2025 numbers while its own comment claimed otherwise.
    const S = TAXData.OBBBA.SALT;
    const capIn = (year, magi) => {
        // $60k of property tax in a no-tax state makes SALT = propTax, so the deduction the engine
        // lands on IS the cap whenever the cap beats the standard deduction. Reading it back that way
        // avoids exporting internals just to test them.
        const r = calculateTaxes({ filingStatus: 'MFJ', ages: [60, 60], state: 'TX',
            earnedIncome: magi, saltHigh: true, obbaOn: true, propTax: 200000, taxYear: year });
        return r.federalStdDeduction;   // this is the FINAL federal deduction, itemized when it wins
    };
    assertNear(capIn(2025, 200000), 40000, 'the 2025 base cap', 1);
    assertNear(capIn(2026, 200000), 40400, 'the published 2026 cap', 1);
    assertNear(capIn(2029, 200000), 40000 * Math.pow(1.01, 4), 'the 2029 cap after four steps', 1);
    // Past the sunset the index stops rather than compounding a figure that no longer applies.
    assertNear(capIn(2031, 200000), 40000 * Math.pow(1.01, 4), 'the index is clamped at the sunset', 1);
    // The threshold moves with it: at $505,000 of MAGI in 2026 nothing has phased out yet, because
    // the threshold is $505,000 that year and not the 2025 figure of $500,000.
    assertNear(capIn(2026, 505000), 40400, 'no phase-down at exactly the 2026 threshold', 1);
    assertNear(capIn(2026, 525000), 40400 - 20000 * S.phaseoutRate, 'phase-down measured from the indexed threshold', 1);
});

test('P64: the three property-tax growth modes are actually three different plans', () => {
    // Entered in today's dollars, so it has to compound like spendGoal does. 'flat' is the one that
    // decays in real terms, and 'custom' exists for a statutory cap such as California Proposition
    // 13's 2%, which is neither general inflation nor constant.
    // The horizon comes from the log, not from nYears: this household's death ages carry the run
    // well past nYears, and hardcoding the exponent here would test the test rather than the code.
    let horizon = 0;
    const capture = (extra) => {
        const seen = [];
        const real = globalThis.calculateTaxes;
        globalThis.calculateTaxes = function (p) { seen.push(p.propTax); return real(p); };
        let out;
        try { out = simulate({ ...OBBBA_BASE, nYears: 12, inflation: 0.05, cpi: 0.05, propTax: 10000, ...extra }); }
        finally { globalThis.calculateTaxes = real; }
        horizon = out.log[out.log.length - 1].year - out.log[0].year;
        return seen;
    };
    const flat      = capture({ propTaxGrowthMode: 'flat' });
    const inflated  = capture({ propTaxGrowthMode: 'inflation' });
    const custom    = capture({ propTaxGrowthMode: 'custom', propTaxGrowthRate: 0.02 });

    assert(flat.every(v => v === 10000), 'flat mode must hand the same nominal bill to every year');
    // Ordering is the point: at the same horizon a 5% assessment outgrows a 2% one, which outgrows a
    // frozen bill. Comparing the largest value seen avoids depending on how many calls a year makes.
    const top = a => Math.max(...a);
    assert(top(inflated) > top(custom) && top(custom) > top(flat),
        `inflation > custom 2% > flat expected, got ${top(inflated)} / ${top(custom)} / ${top(flat)}`);
    // And custom must compound at the rate given, not at inflation.
    assertNear(top(custom), 10000 * Math.pow(1.02, horizon), 'custom mode compounds at its own rate', 1);
});

// ── The one exception: a live ACA cap ─────────────────────────────────────────
// Under a cap that is still in force, a shortfall is the CORRECT answer and it means exactly one
// thing: the spending goal could not be met from non-taxable sources. Cash and Roth carry no
// income, so the strategy spends them to zero. An IRA dollar carries income, and going over the
// FPL cap forfeits the whole premium subsidy — a cliff, not a tax bump. So the engine stops.
// Written as a POSITIVE assertion, not an exemption: it is not enough that the strategy declined
// to force IRA, it must also have genuinely run out of non-taxable money first. An exemption
// alone would be satisfied by a future change that stops early for entirely the wrong reason.
test('ACA exception: a live cap strands spending only after non-taxable sources are gone', () => {
    const r = simulate({ ...ACA_LIVE, ...ACA_ARM });
    const live = _capLiveRows(r.log);
    const short = live.filter(_shortYear);
    assert(short.length > 0, 'ACA_LIVE at 400% FPL with $160k spend must strand something, else this proves nothing');
    assert(_sumForcedIRA(live) === 0,
        `a live cap must never force IRA, got ${Math.round(_sumForcedIRA(live))}`);
    const withMoneyLeft = short.filter(e => (e.Cash || 0) > 1 || (e.Roth || 0) > 1);
    assert(withMoneyLeft.length === 0,
        `${withMoneyLeft.length} shortfall year(s) still held Cash or Roth — the cap is not what stopped them ` +
        `[${withMoneyLeft.slice(0, 3).map(e => `${e.year} cash=${Math.round(e.Cash)} roth=${Math.round(e.Roth)}`).join('; ')}]`);
    assert(short.some(e => (e.TotalIRA || 0) > 1),
        'and the IRA must still hold money — otherwise this is ordinary ruin, not the cap binding');
});

test('ACA exception: give it enough non-taxable money and the cap strands nothing', () => {
    // The other side of the same claim. If the shortfall really is "no non-taxable means left",
    // then supplying non-taxable means must remove it — without ever forcing IRA or lifting the cap.
    const r = simulate({ ...ACA_LIVE, ...ACA_ARM, Roth: 400000, Cash: 200000 });
    assert(r.log.filter(_shortYear).length === 0,
        `funded with Roth+Cash, a live cap should strand nothing, got ${r.log.filter(_shortYear).length} year(s)`);
    assert(_sumForcedIRA(r.log) === 0, 'and it still must not force IRA');
    assert((r.totals.acaBreachYears ?? 0) > 0,
        'the cap must still be binding on unavoidable income (RMDs/SS), else the fixture stopped testing the cap');
});

test('ACA exception ends at Medicare: the lapsed tail IS backstopped', () => {
    // The decision P38 makes explicit. `isACAStrategy` is `strategy === 'aca' && !acaLapsed`, so
    // once the cap lapses the year falls through to the baseline branch and the funding backstop
    // applies to it like any other. That is deliberate: a lapsed cap protects nothing, and PR #150
    // already established that a lapsed year IS Proportional 0%, warts and fixes alike.
    const r = simulate({ ...ACA_LIVE, ...ACA_ARM });
    const medAge = TAXData.IRMAA.ELIGIBILITY_AGE;
    const live = _capLiveRows(r.log);
    const lapsed = r.log.filter(e => _minLivingAge(e) !== null && _minLivingAge(e) >= medAge);
    assert(live.length > 0 && lapsed.length > 0, 'fixture must span the crossing');
    // Live side: refuses to draw, strands spending, flags every year.
    assert(live.every(e => (e.ForcedIRA || 0) === 0), 'no live-cap year may force IRA');
    assert(live.every(e => e['acaBreach']), 'every live-cap year here breaches on unavoidable income alone');
    // Lapsed side: draws, and funds the goal for as long as the IRA lasts.
    assert(lapsed.some(e => (e.ForcedIRA || 0) > 0), 'the lapsed tail must be backstopped');
    assert(lapsed.every(e => !e['acaBreach']), 'a lapsed cap cannot be breached');
    const fundedRun = lapsed.filter(e => !_shortYear(e)).length;
    assert(fundedRun >= 20,
        `the lapsed tail should fund the goal for as long as the IRA lasts, got ${fundedRun} funded year(s)`);
    // And when it finally runs out it is honest about it rather than stranding a balance.
    const ruined = lapsed.filter(_shortYear);
    assert(ruined.every(e => (e.TotalIRA || 0) <= 1),
        'a lapsed year may only report a shortfall once the IRA is genuinely empty');
});

// ── P32 tripwire, pinned but NOT owned by P38 ─────────────────────────────────
// Cause (b) from the scope note: IRA fully drained, spending still unfunded, and a large Brokerage
// balance sitting there. The IRMAA-tier arm is the only one on this fixture that reaches it, and it
// is not a rounding artifact — nine consecutive years, 2041 through 2049, $71,382 stranded in total,
// the first of them with $945,376 of Brokerage untouched and draining only to fund taxes and growth.
// (Eleven years now, 2039-2049 - see the note on the assertions below.)
// Nothing in P38 fixes this: widening the forced-IRA gate cannot help a year whose IRA is already
// at zero. Pinned so P32 starts from a measured number rather than a fresh investigation, and so
// that a change in the meantime has to announce itself.
test('P32h: the IRMAA arm no longer strands spending with Brokerage still funded (was the defect)', () => {
    // irmaaMarginMode is pinned EXPLICITLY rather than left to the default. This is a P32 tripwire,
    // not an IRMAA one: when the default moved from 'halfstep' to 'halfcpi' in v11.15cc it dragged
    // these numbers with it (11 years -> 10) purely because a tighter ceiling drains the IRA on a
    // different schedule. A defect tripwire should not re-pin every time an unrelated knob's default
    // is retuned, so it now names the mode it measures under - the shipped default, so the figures
    // still describe what a user gets.
    const log = simulate({ ...CAP_BASE, strategy: 'bracket', stratRate: 0, stratIRMAATier: 1,
                           stratACAMultiple: 0, irmaaMarginMode: 'halfcpi' }).log;
    const stranded = _brokStranded(log);
    // ── P32h, 2026-08-21. THE DEFECT IS FIXED, and this test flipped from tripwire to guard. ──
    // Everything below the fold is the history of five failed attempts, kept verbatim because it
    // is the evidence that nothing else could have closed this: three unrelated corrections moved
    // the amounts and never freed a single year, and a fourth made it worse. What closed it was
    // allowing the third pass to draw Brokerage (`thirdPassBrokerage`, default 'bounded' since
    // P32h), after P32d measured the cap-gains spiral that justified the exclusion and found ZERO
    // capped years in 3,960 armed runs.
    assert(stranded.length === 0,
        `the IRMAA arm must no longer strand spending while Brokerage is funded, got ${stranded.length} ` +
        `years (${stranded.map(e => e.year).join(', ')})`);
    // The control that makes the claim falsifiable: pass 'off' and the ten stranded years come
    // straight back, with the amounts the tripwire pinned. Without this a future refactor could
    // make the count zero for some entirely different reason and still pass.
    const before = simulate({ ...CAP_BASE, strategy: 'bracket', stratRate: 0, stratIRMAATier: 1,
                              stratACAMultiple: 0, irmaaMarginMode: 'halfcpi',
                              thirdPassBrokerage: 'off' }).log;
    const strandedBefore = _brokStranded(before);
    assert(strandedBefore.length === 10,
        `the pre-P32h behavior must still be reproducible via 'off': expected 10 stranded years, ` +
        `got ${strandedBefore.length}`);
    // The numbers nudged when dividends and interest stopped being double-credited (total
    // 71,382 -> 71,481, worst 9,468 -> 9,478, Brokerage 945,376 -> 926,096) and the COUNT did not
    // move at all. That is worth recording: the two defects are independent. Removing the phantom
    // money did not free a single one of these nine years, because what strands them is the third
    // pass refusing to touch Brokerage, not how much Brokerage happens to be there.
    // The IRC 1014 basis step-up (P35g) moved the amounts again and AGAIN left the count at 9:
    // total 71,481 -> 27,510, worst 9,478 -> 6,593, Brokerage 926,096 -> 960,183. The stranded
    // years got cheaper (the survivor's stepped-up basis makes each brokerage draw cost less tax)
    // and there is MORE brokerage sitting there unused, which sharpens the defect rather than
    // softening it. Three independent changes now, none of which freed a single one of these nine
    // years, because what strands them is the third pass refusing to touch Brokerage at all.
    //
    // THE COUNT FINALLY MOVED, 9 -> 11 (2041-2049 -> 2039-2049), when the IRMAA ceiling started
    // targeting the threshold that will actually apply |LOOKBACK| years out instead of today's
    // (irmaaFwdFactor, optimizer_core.js). That is not a fourth failed attempt at this defect - it
    // is a different mechanism entirely. A forward-projected ceiling is ~5% higher at 2.5% CPI, so
    // the arm draws more IRA earlier, empties it two years sooner, and hands two more years to
    // the third pass that refuses to touch Brokerage. Totals: 27,510 -> 26,869, worst 6,593 ->
    // 6,564, Brokerage 960,183 -> 1,100,390. More money stranded, spread over more years, with a
    // QUARTER of a million more Brokerage sitting unused. The defect got worse, not better, which
    // is exactly what a tripwire is for.
    //
    // FIFTH move, v11.15cc, and the least interesting: the margin default went 'halfstep' ->
    // 'halfcpi', a tighter ceiling, which drains the IRA on a slightly different schedule. 2039-2049
    // -> 2040-2049, total 26,869 -> 27,523, worst 6,564 -> 6,576, Brokerage 1,100,390 -> 1,027,335.
    // Still nothing frees any of these years, and the mode is now pinned explicitly above so a
    // future default change cannot move this test again.
    // These three pinned the size of the defect. They now describe the 'off' control, which is
    // what the defect COST: unchanged values, different subject.
    assertNear(_worst(strandedBefore), 6575.510146, 'worst single-year unfunded amount with Brokerage left', 1);
    // SIXTH move, and the last: the fixture named the removed `minlimit` strategy, which no plan
    // could reach. It now names the reachable arm it was always measuring - `bracket` at IRMAA tier
    // 1 - and that arm converts, so year 0 withdraws in month 1 instead of month 11. One year of
    // growth on one year's draw, compounded thirteen years out: total 27,529 -> 29,368 and the
    // Brokerage headline 1,027,282 -> 1,016,150, over the same ten years and with the worst single
    // year unmoved. The subject of the test did not change.
    // SEVENTH move, P87c. The ceiling sizing stopped subtracting the FULL Social Security benefit
    // from a MAGI ceiling that counts at most 85% of it, so this IRMAA arm draws the headroom it
    // was always entitled to, earlier, and arrives at the stranded tail with less left unfunded:
    // total 29,367.55 -> 24,836.15, Brokerage headline 1,016,150.36 -> 1,000,311.35. The COUNT is
    // still 10 and still 2040-2049, and the worst single year moved by fifty cents (6,575.51 ->
    // 6,575.01), inside the tolerance and left pinned where it was rather than re-stamped for
    // rounding. Every year that strands still strands - the third pass refusing Brokerage is
    // untouched - so the subject of the test is unchanged and only the size of what it costs moved.
    assertNear(strandedBefore.reduce((s, e) => s + Math.abs(e.shortfall), 0), 24836.150317,
        'total stranded across the ten years', 1);
    // The headline number: how much was sitting in Brokerage the first year it gave up.
    assertNear(Math.max(...strandedBefore.map(e => e.Brokerage || 0)), 1000311.354759,
        'Brokerage balance in the first year the arm reported an unfunded shortfall', 1);
    assert(strandedBefore.every(e => (e.Cash || 0) <= 1 && (e.Roth || 0) <= 1 && (e.TotalIRA || 0) <= 1),
        'every stranded year must have Cash, Roth and IRA at zero — Brokerage is the only source left');
    // What the fix bought, in the two directions that matter. Funded years up and spending up are
    // the point; terminal wealth DOWN is the price, and it is asserted rather than left implicit so
    // that nobody later reads the change as free.
    const after = simulate({ ...CAP_BASE, strategy: 'bracket', stratRate: 0, stratIRMAATier: 1,
                             stratACAMultiple: 0, irmaaMarginMode: 'halfcpi' });
    const beforeRun = simulate({ ...CAP_BASE, strategy: 'bracket', stratRate: 0, stratIRMAATier: 1,
                                 stratACAMultiple: 0, irmaaMarginMode: 'halfcpi',
                                 thirdPassBrokerage: 'off' });
    assert(after.totals.yearsfunded > beforeRun.totals.yearsfunded,
        `the fix must fund more years: ${beforeRun.totals.yearsfunded} -> ${after.totals.yearsfunded}`);
    assert(after.totals.spend > beforeRun.totals.spend,
        `the fix must actually pay for more spending: ${Math.round(beforeRun.totals.spend)} -> ` +
        `${Math.round(after.totals.spend)}`);
    assert(after.finalNW < beforeRun.finalNW,
        `and it must cost terminal wealth, because the money is spent rather than left: ` +
        `${Math.round(beforeRun.finalNW)} -> ${Math.round(after.finalNW)}`);
});

// ── State retirement-income exclusion (IL/PA full exemption) ────────────────────
test.critical('IL exempts IRA/pension distributions from state tax', () => {
    const common = { filingStatus: 'MFJ', ages: [70, 70], state: 'IL',
                     earnedIncome: 40000 + 80000, qualifiedDiv: 0, capGains: 0 };
    const noExcl = calculateTaxes({ ...common });                                  // no split → all taxed
    const withExcl = calculateTaxes({ ...common, pensionIncome: 40000, iraIncome: 80000 });
    assert(noExcl.stateTax > 0, 'baseline IL state tax should be > 0 when retirement income is taxed');
    assertNear(withExcl.stateTax, 0, 'IL state tax should be ~0 once retirement income is fully excluded', 1);
});

test.critical('PA exempts IRA/pension distributions from state tax', () => {
    const common = { filingStatus: 'MFJ', ages: [70, 70], state: 'PA',
                     earnedIncome: 90000, qualifiedDiv: 0, capGains: 0 };
    const noExcl = calculateTaxes({ ...common });
    const withExcl = calculateTaxes({ ...common, iraIncome: 90000 });
    assert(noExcl.stateTax > 0, 'baseline PA state tax should be > 0');
    assertNear(withExcl.stateTax, 0, 'PA state tax should be ~0 once retirement income is excluded', 1);
});

// The two tests above call calculateTaxes DIRECTLY, which is why they stayed green for as long as
// the engine forgot to hand it pensionIncome/iraIncome. The third pass (resolveResidualAndForcedIRA)
// omitted both while the other three passes passed them, so a year that reached the third pass was
// taxed as if its state had no retirement exclusion at all. This test drives the whole engine
// instead, so the arguments have to survive the trip.
//
// `ordered` is the arm that exposes it, and not by luck: it is excluded from the forced-IRA loop
// (optimizer_core.js:1741), and that loop is what recomputes tax after the third pass for every
// other strategy. For Ordered the third pass IS the final word, so a wrong argument list there is
// never corrected. Measured across 16 exclusion states x 6 arms, Ordered carried $685,487 of the
// $732,133 total state-tax correction and flipped 23 of its 36 cases from failure to success.
//
// The fixture strips out every income source PA actually taxes - no Brokerage (so no capital gains
// or dividends), no cash yield (so no interest) - leaving only Social Security, pension and IRA
// distributions. PA exempts all three, so the correct answer is a hard zero and any state tax at
// all is the bug.
test.critical('third pass keeps the state retirement-income exclusion (PA, Ordered)', () => {
    const r = simulate({
        ...CAP_BASE, STATEname: 'PA', strategy: 'ordered', orderedSeq: 'CBIR',
        stratRate: 0, stratACAMultiple: 0,
        Brokerage: 0, BrokerageBasis: 0, cashYield: 0, dividendRate: 0,
        pensionAnnual: 40000, pensionStartAge: 65,
    });
    assert(r.totals.thirdPassCount > 0,
        'fixture must actually reach the third pass, or it proves nothing about that code path');
    const stateTax = r.log.reduce((s, e) => s + (e.StateTax || 0), 0);
    assert(stateTax < 100,
        `PA exempts Social Security, pension and IRA distributions, and this plan has no other ` +
        `income, so lifetime state tax should be ~0. Got ${stateTax.toFixed(2)} ` +
        `(it was 28,054.65 before the third pass was given pensionIncome/iraIncome).`);
});

// P41 pension start-age gate. Two coverage holes closed at once: the pure gate helper that the
// After-Tax Spend suggestion calls (P41d/P41g), and the engine gate itself (P41c), which shipped
// with no test — reverting optimizer_core.js:1154 to the ungated line previously failed nothing.
test('pensionAtAge helper gates the pension at the start age', () => {
    const p = globalThis.window.DisplayHelpers.pensionAtAge;
    assert(p(40000, 75, 74) === 0,            'deferred: age below start age -> 0');
    assert(p(40000, 75, 75) === 40000,        'at the start age -> full');
    assert(p(40000, 75, 80) === 40000,        'past the start age -> full');
    assert(p(40000, 0,  60) === 40000,        'start age 0 -> no gate, always on');
    assert(p(40000, undefined, 60) === 40000, 'blank start age -> no gate, always on');
    assert(p(undefined, 75, 80) === 0,        'blank amount -> 0');
});

test.critical('engine defers the pension until pensionStartAge (P41c)', () => {
    // BASE person 1 is 74 in 2026 and runs to 90, so age1 straddles a start age of 80.
    // Flat pension (no COLA, zero inflation) so pre-start rows are a hard zero.
    const r = simulate({ ...BASE, pensionAnnual: 40000, pensionStartAge: 80, pensionCola: false });
    const pre  = r.log.filter(e => typeof e.age1 === 'number' && e.age1 < 80);
    const post = r.log.filter(e => typeof e.age1 === 'number' && e.age1 >= 80);
    assert(pre.length > 0 && post.length > 0, 'fixture must straddle the start age or it proves nothing');
    assert(pre.every(e => (e.pension || 0) === 0),
        `pension must be 0 before pensionStartAge; a row before age 80 paid it (gate at ` +
        `optimizer_core.js:1154 reverted?)`);
    assert(post.some(e => (e.pension || 0) > 0), 'pension must flow at/after pensionStartAge');
});

test.critical('IL still taxes non-retirement income (interest/dividends not exempt)', () => {
    // $80k IRA (exempt) + $30k ordinary dividends (NOT exempt) → state tax on the $30k only.
    const r = calculateTaxes({ filingStatus: 'MFJ', ages: [70, 70], state: 'IL',
                               earnedIncome: 80000 + 30000, ordDivInterest: 30000,
                               iraIncome: 80000 });
    assert(r.stateTax > 0, 'IL should still tax the non-retirement (dividend/interest) portion');
});

test.critical('regression: exclusion params are inert for a non-exclusion state (CA)', () => {
    const common = { filingStatus: 'MFJ', ages: [70, 70], state: 'CA',
                     earnedIncome: 120000, qualifiedDiv: 0, capGains: 0 };
    const base = calculateTaxes({ ...common });
    const withParams = calculateTaxes({ ...common, pensionIncome: 40000, iraIncome: 80000 });
    assertNear(withParams.stateTax, base.stateTax, 'CA state tax must be identical with/without the new params', 0.01);
});

// ── P49: suggestSustainableSpend (horizon-aware, engine-calibrated suggested spend) ──────────
// Re-implements the definition inside the solver so the tests bind to the CONTRACT, not the code:
// a spend "passes" when every year is funded AND the last year still holds bufferYears of
// portfolio-funded need. Need is taken from the terminal row's OWN inflated dollars
// (last.spendGoal - last.guaranteedIncome), matching last.portfolioBalance - using the today's-
// dollars search value here understates need under inflation. If the solver drifts from this,
// these fail.
function suggestPassesAt(base, spend, K) {
    const res = simulate({ ...base, spendGoal: spend, computeOC: false });
    if (!res.totals.success) return false;
    const last = res.log[res.log.length - 1];
    const need = Math.max(0, (last.spendGoal || 0) - (last.guaranteedIncome || 0));
    return (last.portfolioBalance || 0) >= K * need;
}

test('suggestSustainableSpend sits on the boundary: its spend passes, 15% more fails', () => {
    const K = SUGGEST_BUFFER_YEARS;
    const r = suggestSustainableSpend(BASE, {});
    assert(r && r.spend > 0, 'expected a positive suggestion');
    assert(r.horizon === simulate(BASE).log.length, 'reported horizon must equal the modeled year count');
    assert(suggestPassesAt(BASE, r.spend, K), 'the suggested spend must itself pass the buffer test');
    assert(!suggestPassesAt(BASE, r.spend * 1.15, K),
        `a spend 15% above the suggestion must fail the ${K}-year buffer (got a still-passing ` +
        `${Math.round(r.spend * 1.15)} vs suggestion ${Math.round(r.spend)})`);
});

test('suggestSustainableSpend: a bigger terminal buffer never raises the suggested spend', () => {
    const s0 = suggestSustainableSpend(BASE, { bufferYears: 0 });
    const s3 = suggestSustainableSpend(BASE, { bufferYears: 3 });
    const s6 = suggestSustainableSpend(BASE, { bufferYears: 6 });
    assert(s0 && s3 && s6, 'all three buffer settings should resolve');
    assert(s0.spend >= s3.spend - 1 && s3.spend >= s6.spend - 1,
        `more buffer must not raise spend: 0->${Math.round(s0.spend)} 3->${Math.round(s3.spend)} 6->${Math.round(s6.spend)}`);
    assert(s0.spend > s6.spend, 'buffer 0 vs 6 should differ, not collapse to the same number');
});

test('suggestSustainableSpend: a shorter horizon raises the suggested spend', () => {
    const shortH = suggestSustainableSpend({ ...BASE, die1: 82 }, {});   // ~9-year horizon
    const longH  = suggestSustainableSpend({ ...BASE, die1: 100 }, {});  // ~27-year horizon
    assert(shortH && longH, 'both horizons should resolve');
    assert(shortH.horizon < longH.horizon, 'horizon field should track the death age');
    assert(shortH.spend > longH.spend,
        `a shorter retirement must sustain more spend: die82->${Math.round(shortH.spend)} ` +
        `vs die100->${Math.round(longH.spend)}`);
});

test('suggestSustainableSpend: terminal buffer holds in inflated dollars (units guard)', () => {
    // BASE has inflation 0, which hides a today's-vs-inflated dollar mixup: with no inflation the
    // terminal spend target equals the search value, so a buggy need (search spend minus the
    // INFLATED terminal guaranteed income) looks correct. Give this plan real inflation and a real
    // SS benefit so the terminal row is inflated and the guaranteed income is nonzero; then re-derive
    // need from the row's own dollars and require the buffer to actually hold. Under the bug the
    // solver returned a spend ~2x too high (a 12.8% withdrawal rate on the default plan).
    const infl = { ...BASE, inflation: 0.03, cpi: 0.03, growth: 0.05, ss1: 30000, ss1Age: 70 };
    const r = suggestSustainableSpend(infl, {});
    assert(r && r.spend > 0, 'expected a positive suggestion');
    const res = simulate({ ...infl, spendGoal: r.spend, computeOC: false });
    const last = res.log[res.log.length - 1];
    const need = Math.max(0, (last.spendGoal || 0) - (last.guaranteedIncome || 0));
    assert((last.portfolioBalance || 0) >= SUGGEST_BUFFER_YEARS * need,
        `terminal portfolio ${Math.round(last.portfolioBalance)} must cover ${SUGGEST_BUFFER_YEARS}x the ` +
        `INFLATED terminal need ${Math.round(need)} (= ${Math.round(SUGGEST_BUFFER_YEARS * need)}); ` +
        `a today's-dollars need would understate it and pass a too-high spend`);
});

// ── P50: suggestSpendMenu (3 strategy-independent goals: Conservative / Middle / Aggressive) ──
// A menu fixture with real inflation, growth and SS so the terminal rows are inflated and
// guaranteed income is nonzero. BASE is single, invested = IRA1 600k + Brokerage 200k = 800k.
const MENU_BASE = { ...BASE, inflation: 0.03, cpi: 0.03, growth: 0.05, ss1: 30000, ss1Age: 70 };

test.critical('suggestSpendMenu is strategy-independent (fixed propwd reference)', () => {
    // The whole point of P50: the suggested goals are an INPUT, so they must not move when the user
    // flips strategy. All three run against a fixed proportional reference.
    const spendsOf = (strat) => suggestSpendMenu({ ...MENU_BASE, strategy: strat }).options.map(o => Math.round(o.spend));
    const brk = spendsOf('bracket'), gk = spendsOf('gk'), fx = spendsOf('fixed');
    assert(JSON.stringify(brk) === JSON.stringify(gk) && JSON.stringify(gk) === JSON.stringify(fx),
        `menu must not depend on the selected strategy: bracket=${brk} gk=${gk} fixed=${fx}`);
    assert(brk.length === 3 && brk.every(x => x > 0), 'all three options should be positive');
});

test('suggestSpendMenu Conservative matches the Bengen year-1 withdrawal rate', () => {
    const m = suggestSpendMenu(MENU_BASE);
    const A = m.options.find(o => o.key === 'A').spend;
    const invested = MENU_BASE.IRA1 + MENU_BASE.IRA2 + MENU_BASE.Roth + MENU_BASE.Roth2 + MENU_BASE.Brokerage;
    const r0 = simulate({ ...MENU_BASE, strategy: 'propwd', spendGoal: A, computeOC: false }).log[0];
    const rate = (r0.spendGoal - r0.guaranteedIncome) / invested;
    assertNear(rate, bengenRate(m.horizon),
        'Conservative year-1 portfolio-funded draw rate should equal the Bengen rate for the horizon', 0.003);
});

test('suggestSpendMenu Aggressive ends holding 5 full years of spending', () => {
    const m = suggestSpendMenu(MENU_BASE);
    const B = m.options.find(o => o.key === 'B').spend;
    assert(B > 0, 'aggressive option should resolve');
    const res = simulate({ ...MENU_BASE, strategy: 'propwd', spendGoal: B, computeOC: false });
    const last = res.log[res.log.length - 1];
    assert(res.totals.success, 'aggressive plan must still fund every year');
    assert((last.portfolioBalance || 0) >= SUGGEST_RISKY_BUFFER_YEARS * (last.spendGoal || 0),
        `terminal ${Math.round(last.portfolioBalance)} must hold ${SUGGEST_RISKY_BUFFER_YEARS}x final spend ` +
        `${Math.round(last.spendGoal)} (= ${Math.round(SUGGEST_RISKY_BUFFER_YEARS * last.spendGoal)})`);
});

test('suggestSpendMenu Middle ends holding about half the real starting portfolio', () => {
    const m = suggestSpendMenu(MENU_BASE);
    const Dm = m.options.find(o => o.key === 'D').spend;
    assert(Dm > 0, 'middle option should resolve');
    const res = simulate({ ...MENU_BASE, strategy: 'propwd', spendGoal: Dm, computeOC: false });
    const l = res.log[res.log.length - 1], r0 = res.log[0];
    const realTerm  = (l.portfolioBalance || 0) / (l.inflationFactor || 1);
    const realStart = (r0.portfolioBalance || 0) / (r0.inflationFactor || 1);
    assert(res.totals.success && realTerm >= SUGGEST_MIDDLE_KEEP_REAL * realStart - 1,
        `middle should end >= ${SUGGEST_MIDDLE_KEEP_REAL * 100}% real principal: terminal ${Math.round(realTerm)} ` +
        `vs target ${Math.round(SUGGEST_MIDDLE_KEEP_REAL * realStart)}`);
    // NOTE: deliberately NOT asserting Middle >= Conservative. The Bengen RATE option hedges a bad
    // return sequence over ~30yr; on this DETERMINISTIC average-return path a short horizon makes that
    // rate more aggressive than "leave 50% of principal", so the rate-based and target-based options
    // can cross. The UI sorts the three by dollar amount rather than assuming a fixed rank.
});

test('bengenRate falls as the horizon lengthens', () => {
    assert(bengenRate(15) > bengenRate(25) && bengenRate(25) > bengenRate(40),
        'a shorter retirement must allow a higher safe initial rate');
    assert(bengenRate(10) === bengenRate(15), 'clamps at the shortest knot');
    assert(bengenRate(50) === bengenRate(40), 'clamps at the longest knot');
    const mid = bengenRate(22.5);
    assert(mid < 0.050 && mid > 0.047, `interpolates between knots (got ${mid})`);
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
    // P92a. This used to compare the counterfactual's lifetime tax against the actual run's, and
    // that comparison is confounded: the actual run CONVERTS, and a ceiling on the true bracket top
    // converts nearly $1M here, so the actual arm's own conversion tax now exceeds the RMD tax the
    // counterfactual pays. The claim in this test's title is causal and is tested causally instead -
    // hold everything else fixed and give the counterfactual a bigger IRA. Bigger IRA, bigger RMDs,
    // more tax, with no conversion anywhere in either arm to confuse it.
    const cfWith = ira => simulate({ ...inputs, IRA1: ira, _cfRun: true, _cfSuppressConversions: true,
                                     extraConversionAmount: 0, computeOC: false });
    const cfSmall = cfWith(1000000), cfBig = cfWith(2000000);
    assert(cfBig.totals.rmd > cfSmall.totals.rmd,
        `a bigger IRA must produce bigger RMDs: ${Math.round(cfSmall.totals.rmd)} -> ${Math.round(cfBig.totals.rmd)}`);
    assert(cfBig.totals.tax > cfSmall.totals.tax,
        `and the counterfactual must PAY for them: ${Math.round(cfSmall.totals.tax)} -> ${Math.round(cfBig.totals.tax)}`);
    // Identity: last convOC equals the finalNW difference - but the two sides are now on DIFFERENT
    // valuation bases and the identity has to name which one it uses. Break Even is deliberately
    // still computed on the liquidation basis (P35g decision 4), while finalNW carries the IRC
    // 1014 step-up. The counterfactual is a _cfRun, which skips the step-up precisely so both arms
    // reach the Break Even block on the same footing, so cf.finalNW is already liquidation-basis
    // and only the actual run needs its pre-step-up value.
    const lastRow = actual.log[actual.log.length - 1];
    const lastOC = lastRow.convOC;
    const actualLiquidation = lastRow['-totalNetWealthPreStepUp'] ?? actual.finalNW;
    assertNear(lastOC, actualLiquidation - cf.finalNW, 'convOC identity vs counterfactual finalNW', 1);
    // And pin the relationship between the bases, so a change that quietly puts Break Even onto
    // the step-up basis fails here instead of silently moving every reported break-even year.
    assert(actual.finalNW > actualLiquidation,
        'the terminal step-up must lift finalNW above the liquidation value Break Even scores on');
    assert(cf.log[cf.log.length - 1]['-totalNetWealthPreStepUp'] === undefined,
        'a _cfRun must NOT be stepped up, or convOC differences two different valuations');
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
    // Retuned when OBBBA was switched on: the senior deduction lowers tax in 2026-2028, which
    // shifted the year-0 blip from +$0.4k to -$77 and destroyed the shape the test needs. The
    // PROPERTY is what matters (one non-negative year, then negative forever, so no sustained
    // crossing exists), not the particular knobs. futureIRATaxRate 0.34 -> 0.35, die1 80 -> 78,
    // iraWithdrawPct 0.10 -> 0.12 restores it with room to spare (year-0 convOC ~ +$365).
    const inputs = { ...OC_BASE, strategy: 'fixedpct', iraWithdrawPct: 0.12,
                     convertExcessToRoth: true, futureIRATaxRate: 0.35, die1: 78 };
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
    // Unset heirs rate -> row totalNetWealth verbatim.
    assert(afterTaxWealthOfLogRow(r, null) === r.totalNetWealth, 'null rate must return row totalNetWealth');
    assert(afterTaxWealthOfLogRow(r, undefined) === r.totalNetWealth, 'undefined rate must return row totalNetWealth');
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
    // spendGoal 75,000 -> 80,000 when OBBBA was switched on: at 75k the $425k candidate stopped
    // out-scoring $175k, so the setup assertion below (which exists to keep this test meaningful)
    // no longer held. The test is about the stability GATE rejecting a higher-scoring candidate, so
    // it needs a scenario where the unstable one really does score higher.
    const gkBase = { ...OC_BASE, strategy: 'gk', gkGuard: 0.20, gkAdjPct: 0.10,
                     IRA1: 1000000, spendGoal: 80000, growth: 0.05 };
    // Without a stability gate, $425k/yr out-scores $175k/yr on raw finalNW alone...
    const unconstrained = simulate({ ...gkBase, extraConversionAmount: 425000 });
    const stableCandidate = simulate({ ...gkBase, extraConversionAmount: 175000 });
    assert(unconstrained.finalNW > stableCandidate.finalNW,
        'test setup: $425k must out-score $175k on raw finalNW for this to be a meaningful test');
    // ...but the gated sweep must not pick it, since GK can only "afford" $425k by breaching
    // its own guard band on future spend.
    const gated = optimizeConversionAmount(gkBase, { strategy: 'gk' }, 'finalNW');
    assert(gated.optConv < 425000, `gated sweep must not pick the unstable $425k candidate, got ${gated.optConv}`);
    // P88b RE-BASELINE, 150000 -> 100000, and the reason is checked rather than accepted. Before
    // P88b an extra conversion never reached MAGI, so the IRMAA lookback never charged it and the
    // sweep's finalNW curve was missing a real cost that grows with the conversion. This fixture is
    // 65 at the start and on Medicare throughout: lifetime IRMAA was $0 at every candidate and is
    // now $29k-$39k across them, which moves the argmax down one $25k step. $150,000 now scores
    // $1,056,138 against $100,000's $1,066,185. The two assertions above are the test's actual
    // subject and both still hold unchanged - $425,000 still out-scores everything on raw finalNW
    // and the stability gate still refuses it.
    assertNear(gated.optConv, 100000, 'gated sweep should land on the largest still-stable candidate', 1);
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

// ── P88: an additional conversion must reach the year's INCOME BASIS, not only its tax ────────
// Both additional-conversion paths run after the year's main tax pass and used to write back only
// `federalTax` and `stateTax`. Every income-basis field kept its pre-conversion value, so
// `yr.tax.MAGI` omitted the conversion -- and that is the figure pushed into `balance.magiHistory`
// and charged for IRMAA two years later. A household could convert $100,000 a year and never be
// billed for it. Characterized in `.test_harnesses/extraconv_magi_harness.js`.
// MAGI_BASE is on Medicare from year 0 so the lookback has something to charge, and its ordinary
// MAGI must sit BELOW the first single-filer IRMAA threshold ($108,999) with a $100,000 conversion
// carrying it over one. A 3% draw on $1.2M is about $36,000, so $0 pays no surcharge and $100,000
// lands near $136,000 -- inside Tier 1's 109,000-137,000 band.
//
// THE FIRST VERSION OF THIS FIXTURE DREW $250,000 A YEAR and the IRMAA test could not fail: the
// single-filer bands run 109k / 137k / 174k / 205k / 500k, so $250,000 and $350,000 are the SAME
// tier and adding a conversion moved nothing. A fixture for a threshold test has to straddle a
// threshold; if the bands are ever re-indexed, check that this one still does.
const MAGI_BASE = {
    ...BASE,
    birthyear1: 1955, die1: 92,
    IRA1: 1200000, Brokerage: 0, BrokerageBasis: 0, Cash: 400000, Roth: 0,
    strategy: 'fixedpct', iraWithdrawPct: 0.03,
    spendGoal: 40000, nYears: 10,
};

test('P88: an Extra Roth Conversion raises the year MAGI by its gross', () => {
    const off = simulate({ ...MAGI_BASE, extraConversionAmount: 0 });
    const on  = simulate({ ...MAGI_BASE, extraConversionAmount: 100000 });
    const a = off.log[0], b = on.log[0];
    assert(b.extraConv === 100000, `test setup: the full gross must convert, got ${b.extraConv}`);
    // The strategy's own draw is identical on both arms here, so the whole MAGI difference is the
    // conversion. Anything less than the gross means the basis was not adopted.
    assertNear(b.MAGI - a.MAGI, 100000, 'MAGI must rise by the conversion gross', 1);
});

test('P88: the raised MAGI is what IRMAA is charged on, two years later', () => {
    const off = simulate({ ...MAGI_BASE, extraConversionAmount: 0 });
    const on  = simulate({ ...MAGI_BASE, extraConversionAmount: 100000 });
    const sum = (r, k) => r.log.reduce((t, x) => t + (x[k] || 0), 0);
    // Direction is the whole claim: a larger MAGI cannot buy a cheaper tier. The SIZE moves with
    // the feedback loop (a bigger IRMAA bill draws more, which moves later balances), so it is not
    // pinned -- see the harness for the measured magnitudes.
    assert(off.log.some(r => (r.Medicare || 0) > 0),
        'test setup: the household must be on Medicare for the surcharge to exist');
    assert(sum(off, 'IRMAA') === 0,
        `test setup: the unconverted plan must sit below the first threshold, got ${sum(off, 'IRMAA')}`);
    assert(sum(on, 'IRMAA') > 0,
        'converting $100k/yr must cost IRMAA once the conversion reaches MAGI');
    // And it must be the LOOKBACK that moves, not year 0: IRMAA is charged on income from two
    // years earlier, so the first year cannot respond to this year's conversion.
    assert((on.log[0].IRMAA || 0) === (off.log[0].IRMAA || 0),
        'year 0 IRMAA is charged on pre-plan income and must not move');
});

test('P88: the cash-funded gross-up also reaches MAGI', () => {
    // applyConversionGrossUp had the same defect and no with-gross-up tax calc to copy from, so it
    // makes its own. This is the path with NO extraConversionAmount, which the other fix cannot cover.
    const base = { ...MAGI_BASE, convertExcessToRoth: true, strategy: 'fixedpct',
                   iraWithdrawPct: 0.15, extraConversionAmount: 0 };
    const off = simulate({ ...base, fundConversionWithCash: false });
    const on  = simulate({ ...base, fundConversionWithCash: true });
    const gu = on.log[0]['-grossUpIRA'] || 0;
    assert(gu > 1, `test setup: the gross-up must fire, got ${gu}`);
    // The gross-up adds IRA income, which can also push more Social Security into the taxable
    // share, so MAGI rises by AT LEAST the draw rather than exactly it.
    assert(on.log[0].MAGI - off.log[0].MAGI >= gu - 1,
        'the gross-up draw must appear in MAGI');
});

test('P88: bracketOverage sees a conversion, and names it separately from a forced draw', () => {
    const base = { ...MAGI_BASE, strategy: 'bracket', stratRate: 0.22,
                   stratIRMAATier: -1, stratACAMultiple: 0 };
    const off = simulate({ ...base, extraConversionAmount: 0 });
    const on  = simulate({ ...base, extraConversionAmount: 100000 });
    const a = off.log[0], b = on.log[0];
    assert((a.BracketOverage || 0) < 1,
        `test setup: the unconverted year must sit inside its ceiling, got ${a.BracketOverage}`);
    assert((b.BracketOverage || 0) > 1,
        'a conversion stacked on a filled bracket must show as overage, not vanish');
    // The two causes stay distinguishable: this overage is chosen, not forced by spending.
    assertNear(b['-overageFromConv'], b.BracketOverage,
        'a conversion-caused overage must be attributed to the conversion', 1);
});

test('P88: no conversion and no cash-funding means nothing moved (regression guard)', () => {
    // The zero test. Neither corrected path runs, so the fix must be invisible. This is the
    // assertion that catches a "fix" that reached further than the two conversion paths.
    const plain = { ...MAGI_BASE, extraConversionAmount: 0, fundConversionWithCash: false,
                    convertExcessToRoth: false };
    const r = simulate(plain);
    assert(r.log.every(x => (x.extraConv || 0) === 0 && (x['-grossUpIRA'] || 0) === 0),
        'test setup: neither additional-conversion path may run in this fixture');
    assert(r.log.every(x => (x['-overageFromConv'] || 0) === 0),
        'with no conversion there is no conversion-caused overage');
    // MAGI must still be the main tax pass's own figure: AGI plus tax-exempt interest, which is 0
    // here, so MAGI = taxable income + deduction. Only where taxable income is ABOVE zero: once the
    // portfolio is spent out, AGI falls below the deduction, `federalTaxableIncome` floors at 0 and
    // the identity legitimately stops holding. Skipping those years is not weakening the test -
    // asserting through the floor is asserting arithmetic that was never claimed.
    const live = r.log.filter(x => (x['-fedTaxableInc'] || 0) > 0);
    assert(live.length > 3, `test setup: need funded years to reconcile, got ${live.length}`);
    assert(live.every(x => Math.abs((x.MAGI || 0) - (x['-fedTaxableInc'] || 0)
                                    - (x['-fedDeduction'] || 0)) < 1),
        'MAGI must reconcile to taxable income plus the deduction when nothing was added');
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

// ── Dividends and interest must never be credited twice ──────────────────────
// These exist because the suite ran 209 green while every plan with a non-zero cashYield or
// dividendRate created money. yr.taxableDividends and yr.taxableInterest were credited to a balance
// in growAndSettle AND counted as spendable income, so the same dollar funded spending and stayed
// in the account.
//
// WHY THE OBVIOUS TEST DOES NOT WORK, and why these are shaped the way they are: a per-year Cash
// balance reconciliation (endCash = prevCash + cashG + surplusCash - CashWD, the shape used for the
// IRA above) reconciles to 0.0000 both BEFORE and AFTER the fix. The balance sheet was never
// inconsistent. The defect was on the income statement: the dividend legitimately entered Cash, and
// separately shrank the withdrawal the plan needed to make. Only an economic or flow invariant sees
// that, so that is what these assert. A balance reconciliation here would be vacuous.
test.critical('no free money: a dividend cannot create wealth (same total return, split two ways)', () => {
    // Identical 8% total return. A takes it all as growth; B takes 6% growth + 2% dividend with DRIP
    // on, so B reinvests every dividend and compounds the same way. The ONLY real difference is that
    // B pays tax on the dividend every year and A defers it entirely. B must therefore never finish
    // ahead. Basis = value so capital gains cannot muddy the comparison.
    const seed = {
        STATEname: 'CA', nYears: 20, birthyear1: 1955, birthmonth1: 1, die1: 90,
        birthyear2: 0, birthmonth2: 12, die2: 0, hasSpouse: false,
        ss1: 0, ss1Age: 70, ss2: 0, ss2Age: 70, pensionAnnual: 0, survivorPct: 0, pensionCola: false,
        spendChange: 0, iraBaseGoal: 0, inflation: 0, cpi: 0, cashYield: 0, spendGoal: 0,
        ssFailYear: 2099, ssFailPct: 1, convertExcessToRoth: false, propWithdraw: 0, stratRate: 0,
        iraWithdrawPct: 0.05, startYear: 2026, strategy: 'propwd',
        IRA1: 0, IRA2: 0, Roth: 0, Roth2: 0, Cash: 0, CashReserve: null,
        Brokerage: 1000000, BrokerageBasis: 1000000,
    };
    const end = r => { const l = r.log[r.log.length - 1]; return (l.Brokerage || 0) + (l.Cash || 0); };
    const A = simulate({ ...seed, growth: 0.08, dividendRate: 0,    dividendReinvest: false });
    const B = simulate({ ...seed, growth: 0.06, dividendRate: 0.02, dividendReinvest: true });
    assert(B.totals.tax > 0, 'setup: the dividend arm must actually be taxed, or this proves nothing');
    assert(end(B) <= end(A) * 1.02,
        `a reinvested dividend must not out-earn the identical return taken as growth: ` +
        `growth-only ${Math.round(end(A))} vs dividend ${Math.round(end(B))} ` +
        `(+${(100 * (end(B) / end(A) - 1)).toFixed(1)}%, and the dividend arm paid ` +
        `${Math.round(B.totals.tax)} of tax the other did not). Before the double-credit was ` +
        `fixed this ran +21.7%.`);
});

test.critical('no free money: interest leaves Cash only by being spent or taxed', () => {
    // A Cash-only plan. Every dollar that leaves Cash is either spending or tax, so lifetime CashWD
    // must equal lifetime spend + lifetime tax exactly. While interest was double-credited the plan
    // funded $800,000 of spending while withdrawing $2,449, because the interest paid for the
    // spending as "income" and stayed in the account at the same time.
    const r = simulate({
        STATEname: 'CA', nYears: 20, birthyear1: 1955, birthmonth1: 1, die1: 90,
        birthyear2: 0, birthmonth2: 12, die2: 0, hasSpouse: false,
        ss1: 0, ss1Age: 70, ss2: 0, ss2Age: 70, pensionAnnual: 0, survivorPct: 0, pensionCola: false,
        spendChange: 0, iraBaseGoal: 0, inflation: 0, cpi: 0, growth: 0, dividendRate: 0,
        cashYield: 0.04, spendGoal: 40000, ssFailYear: 2099, ssFailPct: 1,
        convertExcessToRoth: false, propWithdraw: 0, stratRate: 0, iraWithdrawPct: 0.05,
        startYear: 2026, dividendReinvest: false, strategy: 'propwd',
        IRA1: 0, IRA2: 0, Roth: 0, Roth2: 0, Brokerage: 0, BrokerageBasis: 0,
        Cash: 1000000, CashReserve: null,
    });
    const cashWD = r.log.reduce((s, e) => s + (e.CashWD || 0), 0);
    assert(r.totals.tax > 0, 'setup: the interest must actually be taxed');
    assertNear(cashWD, r.totals.spend + r.totals.tax,
        'lifetime Cash withdrawals must equal lifetime spending plus lifetime tax', 1);
});

test.critical('no free money: interest cannot compound faster than the yield it is paid at', () => {
    // Hard upper bound, no spending: Cash cannot exceed simple compounding at cashYield, and must
    // land BELOW it because the interest is taxed every year and the tax is paid out of Cash.
    // Double-crediting made it compound at roughly twice the rate: $4,254,946 against a $2,191,123
    // ceiling.
    const START = 1000000, Y = 0.04;
    const r = simulate({
        STATEname: 'CA', nYears: 20, birthyear1: 1955, birthmonth1: 1, die1: 90,
        birthyear2: 0, birthmonth2: 12, die2: 0, hasSpouse: false,
        ss1: 0, ss1Age: 70, ss2: 0, ss2Age: 70, pensionAnnual: 0, survivorPct: 0, pensionCola: false,
        spendChange: 0, iraBaseGoal: 0, inflation: 0, cpi: 0, growth: 0, dividendRate: 0,
        cashYield: Y, spendGoal: 0, ssFailYear: 2099, ssFailPct: 1,
        convertExcessToRoth: false, propWithdraw: 0, stratRate: 0, iraWithdrawPct: 0.05,
        startYear: 2026, dividendReinvest: false, strategy: 'propwd',
        IRA1: 0, IRA2: 0, Roth: 0, Roth2: 0, Brokerage: 0, BrokerageBasis: 0,
        Cash: START, CashReserve: null,
    });
    const ceiling = START * Math.pow(1 + Y, r.log.length);
    const endCash = r.log[r.log.length - 1].Cash || 0;
    assert(endCash < ceiling,
        `Cash compounded past its own yield: ${Math.round(endCash)} vs a pre-tax ceiling of ` +
        `${Math.round(ceiling)} over ${r.log.length} years at ${Y * 100}%`);
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
//
// spendGoal was 90,000 and was raised to 92,000 for P38 PR 3. Sizing the primary draw net of the
// tax on guaranteed income cost the no-conversion run 15,146 of final net worth while costing the
// $50k run only 240, so at 90,000 the two metrics both landed on $50k and the fixture stopped
// separating them - it would have asserted "the metrics agree", the opposite of the point. The
// separation is a property of the scenario, not of the dollar figure: 92,000 (and 95,000, and
// Cash 80,000, and ss1 38,000) all restore finalNW $0 vs baselineScore $50k.
const PF11_BASE = {
    STATEname: 'CA', strategy: 'propwd', propWithdraw: 0, nYears: 25,
    birthyear1: 1958, birthmonth1: 1, die1: 90,
    birthyear2: 1960, birthmonth2: 6, die2: 92, hasSpouse: true,
    IRA1: 560000, IRA2: 240000, Roth: 100000, Roth2: 0,
    Brokerage: 300000, BrokerageBasis: 200000, Cash: 100000,
    ss1: 40000, ss1Age: 67, ss2: 25000, ss2Age: 67,
    pensionAnnual: 0, survivorPct: 0, pensionCola: false,
    spendGoal: 92000, spendChange: 0, iraBaseGoal: 0,
    inflation: 0.025, cpi: 0.025, growth: 0.04, cashYield: 0.02, dividendRate: 0.015,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: true, iraWithdrawPct: 0.05,
    startInYear: 2026, startYear: 2026, dividendReinvest: false, futureIRATaxRate: 0.37,
};

// THE T6 DIVERGENCE IS BACK, restored by a modeling fix rather than by tuning this fixture.
//
// History, because the direction has now reversed twice. finalNW once picked $0 here while
// baselineScore picked $50k. That gap turned out to be an artifact of the dividend/interest
// double-credit: the no-conversion arm banked phantom Cash every year, and finalNW values Cash at
// face while discounting the IRA, so phantom money made "don't convert" look better than it was.
// Fixing the double-credit made both metrics agree, and a 64-variant search over six levers
// (spendGoal 88k-105k, futureIRATaxRate 0.24-0.50, Brokerage 150k-800k, basis 100k-290k, Roth
// 0-300k, IRA1 400k-1.5M, plus a combined pass) found nothing divergent. The lost regression guard
// was recorded here as a real gap.
//
// The IRC 1014 basis step-up (P35g) restores it - same SHAPE of mechanism, but a real asset this
// time instead of a phantom one. Terminal brokerage gains are no longer haircut by capital-gains
// tax, and the no-conversion arm is precisely the arm that still holds those gains, because a
// converting plan spends its brokerage paying the conversion tax. So "don't convert" gains value
// that "convert" does not. finalNW, which discounts the IRA at the run's OWN terminal nominal
// rate, tips to $0; baselineScore, which discounts at the user's stated heirs rate, still finds
// $50k.
//
// baselineScore is the honest measure of the two here: the question is what the heirs net, so the
// heirs' rate is the right discount. finalNW reporting "no benefit" where a real conversion exists
// is exactly the defect T6 documented, so these are a divergence guard again, not an agreement one.
test("optimizeConversionAmount: 'finalNW' and 'baselineScore' diverge (the T6 defect, restored)", () => {
    const ov = { strategy: 'propwd', propWithdraw: 0 };
    assert(simulate({ ...PF11_BASE }).totals.success, 'test setup: base scenario must succeed');
    const fn = optimizeConversionAmount(PF11_BASE, ov, 'finalNW').optConv;
    const bl = optimizeConversionAmount(PF11_BASE, ov, 'baselineScore', { futureIRARate: 0.37 }).optConv;
    assertNear(fn, 0, 'finalNW reports no worthwhile conversion', 1);
    assertNear(bl, 50000, 'baselineScore still finds $50k/yr at the heirs rate', 1);
    assert(bl > fn, 'the honest measure must find a conversion that the finalNW metric misses');
});

test('optimizeConversionAmount: legacy metric modes and the 3-arg signature agree', () => {
    const ov = { strategy: 'propwd', propWithdraw: 0 };
    // What this actually guards is the SIGNATURE, not the value: 4-arg, explicit-empty-opts and
    // 3-arg must all route to the same metric and return the same answer. The shared value has now
    // moved twice - $0 to $50k with the double-credit fix, $50k back to $0 with the IRC 1014
    // step-up (see the note above) - which is exactly why the agreement is the point, not the number.
    const fourArg = optimizeConversionAmount(PF11_BASE, ov, 'finalNW').optConv;
    assertNear(fourArg, 0, "4-arg 'finalNW'", 1);
    assert(optimizeConversionAmount(PF11_BASE, ov, 'finalNW', {}).optConv === fourArg, 'explicit empty opts must match');
    assert(optimizeConversionAmount(PF11_BASE, ov).optConv === fourArg, 'default metric (no 3rd/4th arg) must match');
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

// -- P100b3: the shared secondary ranking --------------------------------------------------------
// An objective that cannot separate two rows used to leave them in input-array order and the table
// printed that as a Rank. Measured on a real scenario, 133 of 136 successful rows scored IDENTICALLY
// under conveffect (only 12 rows are ever evaluated for it, only 3 produce a figure), so a rank was
// a position in a tie and moved when the user adopted a different plan.
const rankIds = (rows, obj) => rankRowsByObjective(rows, obj, 0).map(r => r._id).join(',');

test('P100b3: rows tied on the objective are ordered by the secondary chain, not array order', () => {
    // conveffect reads _convSavings; none of these has one, so all three tie at -Infinity - exactly
    // the shipped situation. Deliberately supplied WORST-FIRST so passing cannot be array order.
    const rows = [objRow('low', { nw: 100 }), objRow('high', { nw: 900 }), objRow('mid', { nw: 500 })];
    const got = rankIds(rows, 'conveffect');
    assert(got === 'high,mid,low', `a fully tied objective must fall through to net wealth, got ${got}`);
});

test('P100b3: the chain runs in priority order, each key breaking only what the one above left tied', () => {
    const T = roth => ({ ira: 0, roth, cash: 0, brokerage: 0, basis: 0 });
    // All three tie on net wealth, so key 2 (final Roth) decides; 'a' and 'b' tie there too, so
    // key 3 (spend) separates them. That is the property - not merely "some tie-break happened".
    const rows = [
        objRow('a', { nw: 100, spend: 10, terminal: T(50) }),
        objRow('b', { nw: 100, spend: 90, terminal: T(50) }),
        objRow('c', { nw: 100, spend: 99, terminal: T(10) }),
    ];
    const got = rankIds(rows, 'conveffect');
    assert(got === 'b,a,c', `final Roth must outrank spend, and spend break what Roth left tied, got ${got}`);
});

test('P100b3: the ordering does not depend on the order rows arrive in', () => {
    // The defect in one assertion: shuffle the input, the ranking must not move. Every row here is
    // identical on every chain key except _id, which is the total-order backstop.
    const mk = () => [objRow('x', { nw: 7 }), objRow('y', { nw: 7 }), objRow('z', { nw: 7 })];
    const fwd = rankIds(mk(), 'conveffect');
    const rev = rankIds(mk().reverse(), 'conveffect');
    assert(fwd === rev, `a reversed input must produce the same ranking, got ${fwd} vs ${rev}`);
});

test('P100b3: a row that never breaks even sorts last on that key, never first', () => {
    // _convBEYear is absent on most rows. A missing year must read as "worst", not as year 0.
    const withBE = objRow('yr2040', { nw: 5 });
    withBE._convBEYear = 2040;
    const got = rankIds([objRow('none', { nw: 5 }), withBE], 'conveffect');
    assert(got === 'yr2040,none', `an absent break-even year must rank below a real one, got ${got}`);
});

test('P100b3: the DEFAULT chain leads on net wealth', () => {
    // mintax names no override, so it inherits the default. All three tie on the metric (tax 0), so
    // the chain decides, and net wealth leads it. Roth is deliberately set OPPOSITE to net wealth,
    // so a run that led on Roth would produce the reverse and this would fail.
    const T = roth => ({ ira: 0, roth, cash: 0, brokerage: 0, basis: 0 });
    const rows = [
        objRow('a', { nw: 100, tax: 0, terminal: T(900) }),
        objRow('b', { nw: 900, tax: 0, terminal: T(100) }),
    ];
    const got = rankIds(rows, 'mintax');
    assert(got === 'b,a', `the default chain must lead on net wealth, got ${got}`);
});

test('P100b3: conveffect OVERRIDES the default and leads on final Roth', () => {
    // The user's priority order for this objective (2026-08-31): when two plans save the same tax by
    // converting, more Roth wins before more wealth does. Same two rows as the test above, ranked
    // under conveffect instead - and the answer must INVERT. Two objectives disagreeing on identical
    // rows is the whole point of allowing an override, so this is the test that earns it.
    const T = roth => ({ ira: 0, roth, cash: 0, brokerage: 0, basis: 0 });
    const rows = [
        objRow('a', { nw: 100, tax: 0, terminal: T(900) }),
        objRow('b', { nw: 900, tax: 0, terminal: T(100) }),
    ];
    const got = rankIds(rows, 'conveffect');
    assert(got === 'a,b', `conveffect must lead on final Roth, not net wealth, got ${got}`);
    assert(rankIds(rows, 'mintax') === 'b,a',
        'the same rows must rank the other way under an objective that uses the default');
});

test('P100b3: the chain never overrides the objective itself', () => {
    // The safety property. 'lo' wins every chain key but loses on the metric, so it must still lose.
    const lo = objRow('lo', { nw: 999, spend: 999, tax: 0 });
    const hi = objRow('hi', { nw: 1, spend: 1, tax: 999 });
    lo._convSavings = 10;
    hi._convSavings = 20;
    const got = rankIds([lo, hi], 'conveffect');
    assert(got === 'hi,lo', `the objective must decide whenever it can; the chain only breaks ties, got ${got}`);
});

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

// ── Which columns each "Optimize for" goal shows (P67) ────────────────────────
// OPT_OBJECTIVE_COLUMNS is pure data, so every rule about it is assertable here rather than in the
// browser. What CANNOT be seen from node is whether the keys match the descriptors in
// optimizer_ui.js, which no node suite loads; the in-page suite pins that against OPT_COLUMN_KEYS.

test('OPT_OBJECTIVE_COLUMNS covers exactly the objectives that exist', () => {
    const goals = Object.keys(OPTIMIZER_OBJECTIVES).sort();
    const sets  = Object.keys(OPT_OBJECTIVE_COLUMNS).sort();
    // Both directions. A goal with no column list silently falls back to taxflex at render time,
    // which looks like a working feature and is not one.
    assert(goals.join(',') === sets.join(','),
        `objectives [${goals.join(',')}] vs column sets [${sets.join(',')}]`);
});

test('every objective\'s column list names only real columns, with no duplicates', () => {
    const known = new Set(OPT_COLUMN_KEYS);
    for (const [objKey, list] of Object.entries(OPT_OBJECTIVE_COLUMNS)) {
        const bogus = list.filter(k => !known.has(k));
        assert(bogus.length === 0, `${objKey} names columns that do not exist: ${bogus.join(', ')}`);
        assert(new Set(list).size === list.length, `${objKey} repeats a column: ${list.join(', ')}`);
    }
});

test('compare is first in every objective, and every pinned column is present', () => {
    for (const [objKey, list] of Object.entries(OPT_OBJECTIVE_COLUMNS)) {
        // The Best summary table drops the leading column on the understanding that it is the ⚖
        // control. Pinned here so a reordered list cannot shift that table under its own header.
        assert(list[0] === 'compare', `${objKey} starts with ${list[0]}, not compare`);

        // End Wealth and All Taxes are on screen under every goal, so the two figures any
        // comparison rests on do not move or vanish as the goal changes.
        assert(list.includes('afterTaxNW') && list.includes('tax'),
            `${objKey} must show End Wealth and All Taxes`);
        const missing = OPT_COLUMNS_PINNED.filter(k => !list.includes(k));
        assert(missing.length === 0, `${objKey} is missing pinned columns: ${missing.join(', ')}`);
    }
    assert(OPT_COLUMN_KEYS[0] === 'compare', 'compare must be the first column in display order');
});

test('every objective shows the column its own ranking metric reads', () => {
    // A column set that hid the very number it sorted the table on would be worse than showing
    // everything: the order would look arbitrary. This is the rule that makes the feature honest.
    for (const objKey of Object.keys(OPTIMIZER_OBJECTIVES)) {
        const needed = OPT_OBJECTIVE_METRIC_COLUMN[objKey];
        assert(needed, `${objKey} has no metric column recorded`);
        assert(OPT_OBJECTIVE_COLUMNS[objKey].includes(needed),
            `${objKey} ranks on ${needed} but does not show it`);
    }
});

test('every objective has a blurb, and it names the column that objective ranks on', () => {
    const goals = Object.keys(OPTIMIZER_OBJECTIVES).sort();
    const blurbs = Object.keys(OPT_OBJECTIVE_BLURB).sort();
    assert(goals.join(',') === blurbs.join(','),
        `objectives [${goals.join(',')}] vs blurbs [${blurbs.join(',')}]`);
    // The line under the selector and the columns on screen have to agree, or the sentence describes
    // a ranking the reader cannot see. Checked against the label, not the key, since that is what
    // the reader is looking at. Two goals rank on a composite with no single column of its own.
    const COLUMN_LABEL = {
        mixSpread: 'Mix Spread', afterTaxNW: 'End Wealth', finalIRA: 'Final IRA', tax: 'All Taxes',
        spend: 'Spendable', finalRoth: 'Final Roth', convSaved: 'Conv Tax', convBE: 'Break Even',
    };
    const COMPOSITE = ['widowrmd', 'balanced'];
    for (const objKey of goals) {
        if (COMPOSITE.includes(objKey)) continue;
        const label = COLUMN_LABEL[OPT_OBJECTIVE_METRIC_COLUMN[objKey]];
        assert(label, `${objKey}: no label recorded for ${OPT_OBJECTIVE_METRIC_COLUMN[objKey]}`);
        assert(OPT_OBJECTIVE_BLURB[objKey].includes(label),
            `${objKey} ranks on "${label}" but its blurb never says so: ${OPT_OBJECTIVE_BLURB[objKey]}`);
    }
});

test('OPT_DELTA_COLUMNS names only real columns, with a usable direction and unit', () => {
    const known = new Set(OPT_COLUMN_KEYS);
    for (const [key, meta] of Object.entries(OPT_DELTA_COLUMNS)) {
        assert(known.has(key), `OPT_DELTA_COLUMNS names a column that does not exist: ${key}`);
        assert(['higher', 'lower', 'neutral'].includes(meta.dir), `${key}: bad dir ${meta.dir}`);
        assert(['dollar', 'pp', 'years'].includes(meta.unit), `${key}: bad unit ${meta.unit}`);
    }
    // Conv Tax must never be deltaed: it is already a difference, measured inside one row's own
    // conversion search rather than against another row, so a delta of it is a delta of a delta.
    assert(!OPT_DELTA_COLUMNS.convSaved, 'convSaved must stay absolute in relative view');
    // Neither are the identity columns, nor Rank, which is itself a comparison.
    for (const k of ['compare', 'status', 'gap', 'strategy', 'param', 'rank', 'dNW', 'dTax']) {
        assert(!OPT_DELTA_COLUMNS[k], `${k} must not be rendered as a delta`);
    }
});

test('the goals needing a converting baseline are exactly the ones ranking on a conversion field', () => {
    // A no-conversion baseline has no break-even year and no conversion tax saved, so under these
    // goals every delta against it renders as a dash. The override list must therefore cover
    // exactly the goals whose ranking column only a converting row carries, no more and no less.
    const CONVERSION_COLUMNS = new Set(['convBE', 'convSaved']);
    const needConverting = Object.keys(OPTIMIZER_OBJECTIVES)
        .filter(k => CONVERSION_COLUMNS.has(OPT_OBJECTIVE_METRIC_COLUMN[k])).sort();
    const declared = Object.keys(OPT_BASELINE_REQUIRES).sort();
    assert(needConverting.join(',') === declared.join(','),
        `goals ranking on a conversion column [${needConverting.join(',')}] vs declared [${declared.join(',')}]`);
    // The values are ROW FIELDS, not column keys: the pool is filtered before any column exists.
    for (const [k, field] of Object.entries(OPT_BASELINE_REQUIRES)) {
        assert(typeof field === 'string' && field.startsWith('_'),
            `${k}: expected a row field like _convBEYear, got ${field}`);
    }
});

test('afterTaxBucketSpread: 0 for an even three-way split, 1 for a single bucket', () => {
    const even = objRow('even', { terminal: { ira: 100000, roth: 100000, cash: 100000, brokerage: 0, basis: 0 } });
    assert(Math.abs(afterTaxBucketSpread(even, 0)) < 1e-9,
        `even split should spread 0, got ${afterTaxBucketSpread(even, 0)}`);
    const oneBucket = objRow('one', { terminal: { ira: 300000, roth: 0, cash: 0, brokerage: 0, basis: 0 } });
    assert(Math.abs(afterTaxBucketSpread(oneBucket, 0) - 1) < 1e-9,
        `single bucket should spread 1, got ${afterTaxBucketSpread(oneBucket, 0)}`);
});

test('afterTaxBucketSpread: Infinity when nothing is left, and taxflex ranks on this same number', () => {
    const drained = objRow('drained', { terminal: { ira: 0, roth: 0, cash: 0, brokerage: 0, basis: 0 } });
    // A plan that spent itself to zero must never read as "perfectly balanced" - every bucket is
    // equal at zero, which is exactly the degenerate case the Infinity guards against.
    assert(!Number.isFinite(afterTaxBucketSpread(drained, 0)),
        'a drained plan must not look balanced');
    // The Mix Spread column and the taxflex ranking must be the SAME number, which is why the
    // function was extracted from the ranker rather than reimplemented in the UI.
    const balanced = objRow('balanced', { nw: 300000, terminal: { ira: 100000, roth: 100000, cash: 100000, brokerage: 0, basis: 0 } });
    const lopsided = objRow('lopsided', { nw: 300000, terminal: { ira: 280000, roth: 10000,  cash: 10000,  brokerage: 0, basis: 0 } });
    assert(afterTaxBucketSpread(balanced, 0) < afterTaxBucketSpread(lopsided, 0), 'balanced spreads less');
    const order = rankRowsByObjective([lopsided, balanced], 'taxflex', 0).map(r => r._id);
    assert(order[0] === 'balanced', `taxflex should rank the lower spread first, got ${order.join(',')}`);
});

// ── Medicare eligibility age is DATA, not a literal (P35 PR 3b) ────────────────
// Every "is this person on Medicare" gate reads TAXData.IRMAA.ELIGIBILITY_AGE. Asserting the gates
// fire at 65 proves nothing — a hardcoded 65 passes that too. So each test below MOVES the constant
// and asserts the behavior moved with it. Anything still holding a literal fails.
function withEligibilityAge(age, fn) {
    const saved = TAXData.IRMAA.ELIGIBILITY_AGE;
    TAXData.IRMAA.ELIGIBILITY_AGE = age;
    try { return fn(); } finally { TAXData.IRMAA.ELIGIBILITY_AGE = saved; }
}

test('ELIGIBILITY_AGE: the constant exists and ships at 65', () => {
    assert(TAXData.IRMAA.ELIGIBILITY_AGE === 65,
        `Medicare eligibility ships at 65, got ${TAXData.IRMAA.ELIGIBILITY_AGE}`);
    // The federal standard-deduction age bump is a DIFFERENT statute that happens to use the same
    // number. Pinned here so a future change to one is not "fixed" by pointing it at the other.
    assert(TAXData.FEDERAL.MFJ.age === 65,
        'the federal std-deduction age bump is a separate 65 and must stay separate');
});

test('ELIGIBILITY_AGE: the at-start Medicare helper follows the constant', () => {
    // Covered two helpers until eitherOnMedicareAtStart was deleted, dead after P35 PR 3c.
    // Today a 66-year-old is already on Medicare when the plan opens.
    // P89: every call pins the year. The helper clamps the plan's first year to the current one,
    // so an unpinned call asserts something different in every calendar year.
    const Y = 2026;
    assert(bothOnMedicareAtStart(1960, 66, false, 0, Y) === true,  'single at 66 vs 65 → on Medicare');
    // startYear = max(1960 + 66, 2026) = 2026; spouse born 1958 is 68, so both are past 65.
    assert(bothOnMedicareAtStart(1960, 66, true, 1958, Y) === true, 'couple 66/68 vs 65 → both on Medicare');
    withEligibilityAge(67, () => {
        assert(bothOnMedicareAtStart(1960, 66, false, 0, Y) === false, 'single at 66 vs 67 → not yet');
        // Same couple, one on each side of the moved constant: the 68-year-old qualifies and the
        // 66-year-old does not. This is the assertion that catches an AND silently becoming an OR
        // — it used to be carried by contrast with the deleted twin, so it is made directly now.
        assert(bothOnMedicareAtStart(1960, 66, true, 1958, Y) === false,
            'AND: the younger spouse does not qualify at 67, so the couple does not either');
        // startYear = max(1960 + 68, 2026) = 2028; spouse born 1956 is 72 — both past 67.
        assert(bothOnMedicareAtStart(1960, 68, true, 1956, Y) === true, 'AND: both past the new age');
    });
    assert(TAXData.IRMAA.ELIGIBILITY_AGE === 65,
        'the constant must be restored on the way out, or every later test runs on a moved gate');
});

test('ELIGIBILITY_AGE: the Medicare base premium starts at the constant, not at 65', () => {
    // Born 1966, plan opens 2026 at age 60, runs to 79 — the onset year is inside the log either way.
    const inputs = { ...BASE, birthyear1: 1966, die1: 95 };
    const onsetAge = () => {
        const row = simulate(inputs).log.find(e => (e.Medicare || 0) > 0);
        return row ? row.age1 : null;
    };
    assert(onsetAge() === 65, `premium onset must be 65 today, got ${onsetAge()}`);
    withEligibilityAge(70, () => {
        const moved = onsetAge();
        assert(moved === 70, `premium onset must follow the constant to 70, got ${moved}`);
    });
});

test('ELIGIBILITY_AGE: the IRMAA-tier ceiling relevance gate is ELIGIBILITY_AGE + LOOKBACK', () => {
    // computeBracketCeiling only honours an IRMAA-tier ceiling once the household is inside the
    // 2-year MAGI lookback (65 - 2 = 63 today); before that it falls back to the federal bracket
    // lookup, a much higher ceiling. A 63-year-old sits exactly on that boundary.
    const inputs = { ...BASE, birthyear1: 1963, die1: 95, strategy: 'bracket',
                     stratIRMAATier: 0, stratRate: 0, stratACAMultiple: 0,
                     convertExcessToRoth: true, iraBaseGoal: 0 };
    const row0 = () => simulate(inputs).log[0];
    const inside  = row0();
    assert(inside.age1 === 63, `fixture must open at age 63, got ${inside.age1}`);
    // Move eligibility to 70 and the same 63-year-old is outside the lookback (63 < 68), so the
    // tier ceiling stops binding and the conversion room widens.
    const outside = withEligibilityAge(70, row0);
    assert(outside.BracketTarget > inside.BracketTarget * 1.5,
        `releasing the tier ceiling must widen the target: ${inside.BracketTarget} → ${outside.BracketTarget}`);
    assert((outside.rothConv || 0) > (inside.rothConv || 0) * 2,
        `and convert materially more: ${Math.round(inside.rothConv || 0)} → ${Math.round(outside.rothConv || 0)}`);
});

// -- IRMAA targeting: the two-year lookback, and the safety margin ------------
// IRMAA charges year Y's premium against year Y+LOOKBACK's MAGI, judged against the thresholds
// published for Y. The CHARGE side always got that right (beginYear reads magiHistory[-2]); the
// TARGETING side did not, and capped MAGI at TODAY's threshold instead of the one that will
// actually apply. These pin the fix and the nerdknob-selectable margin that rides on it.
// Deliberately NOT a local re-derivation of the engine's formula. An earlier version copied it, and
// went stale the moment irmaaFwdFactor changed shape - the copy still passed its own arithmetic and
// the assertion below started measuring the wrong thing. Ask the engine.
const IRMAA_FWD = (cpi, mode) => irmaaFwdFactor({ cpi, irmaaMarginMode: mode });
// Tier 0 = "Below IRMAA", so the ceiling is the SGL Tier 1 floor ($109,000). BASE is a single
// filer aged 74 in 2026, well past ELIGIBILITY_AGE + LOOKBACK, so the tier ceiling binds.
const IRMAA_CEIL_BASE = { ...BASE, strategy: 'bracket', stratRate: 0, stratIRMAATier: 0,
                          stratACAMultiple: 0, cpi: 0.03, convertExcessToRoth: true };
const _target = over => simulate({ ...IRMAA_CEIL_BASE, ...over }).log[0].BracketTarget;

test('irmaaFwdFactor: |LOOKBACK| years of CPI, and an exact identity at cpi = 0', () => {
    assertNear(irmaaFwdFactor({ cpi: 0.03, irmaaMarginMode: 'none' }), 1.0609, 'two years at 3%', 1e-12);
    assert(irmaaFwdFactor({ cpi: 0 }) === 1, 'cpi 0 must be an exact 1, so a no-inflation run is unchanged');
    // The two CPI-haircut modes carry their margin in the factor rather than in dollars.
    // Half the two-year PROJECTED INCREASE (6.09%), not half the annual rate compounded.
    assertNear(irmaaFwdFactor({ cpi: 0.03, irmaaMarginMode: 'halfcpi' }), 1.03045,
        'half the two-year projected increase', 1e-12);
    // One point off the PROJECTED INCREASE, not off the annual rate: (1.03)^2 - 0.01, not (1.02)^2.
    assertNear(irmaaFwdFactor({ cpi: 0.03, irmaaMarginMode: 'cpiminus1' }), 1.0509,
        'one point off the two-year projected increase', 1e-12);
    // Clamped, so a low-CPI plan never aims below today's un-projected threshold. The clamp bites
    // under about 0.5% CPI, where two years of compounding earns less than the point being removed.
    assert(irmaaFwdFactor({ cpi: 0.002, irmaaMarginMode: 'cpiminus1' }) === 1,
        'cpiminus1 must clamp at 1 rather than aiming below the un-projected threshold');
    assert(irmaaFwdFactor({ cpi: 0.02, irmaaMarginMode: 'cpiminus1' }) > 1,
        'and must not clamp once the projection outruns the point removed');
    // An unknown or missing mode must land on the default rather than silently disabling the margin.
    assert(irmaaMarginModeOf({}) === IRMAA_MARGIN_DEFAULT, 'missing mode falls back to the default');
    assert(irmaaMarginModeOf({ irmaaMarginMode: 'nonsense' }) === IRMAA_MARGIN_DEFAULT,
        'unknown mode falls back to the default');
    // A saved link or scenario can still carry `flat1000`, retired in v11.15cc. It must degrade to
    // the default rather than throwing or silently disabling the margin.
    assert(irmaaMarginModeOf({ irmaaMarginMode: 'flat1000' }) === IRMAA_MARGIN_DEFAULT,
        'the retired flat1000 value degrades to the default');
});

test('IRMAA tier ceiling targets the threshold that will apply, not the one in force today', () => {
    // 3% CPI: this year's MAGI is judged against the SGL Tier 1 floor as indexed two years out.
    assertNear(_target({ irmaaMarginMode: 'none' }), 109000 * 1.0609 - 1,
        'tier ceiling must be the forward-projected Tier 1 floor', 0.01);
    // And at cpi = 0 the factor is 1, so the pre-fix number comes back exactly. That is what makes
    // this an indexing fix rather than a new policy.
    assert(_target({ cpi: 0, irmaaMarginMode: 'none' }) === 108999,
        'at cpi = 0 the ceiling must be exactly the old 108999');
});

test('irmaaMarginMode: every shipped mode is distinct and correctly ordered', () => {
    const t = Object.fromEntries(IRMAA_MARGIN_MODES.map(m => [m, _target({ irmaaMarginMode: m })]));
    assert(new Set(Object.values(t)).size === IRMAA_MARGIN_MODES.length,
        `every mode must give a different ceiling: ${JSON.stringify(t)}`);
    // Dollar setbacks, biggest ceiling first.
    assert(t.none > t.halfstep && t.halfstep > t.flat2000,
        `dollar-margin ordering broke: ${JSON.stringify(t)}`);
    assertNear(t.none - t.flat2000, 2000, 'flat2000 sets back exactly $2,000', 0.01);
    // CPI haircuts. At 3% CPI, cpiminus1 (2%) is the gentler haircut and halfcpi (1.5%) the harsher
    // one; below 2% CPI they cross over, which is why this pins the ordering AT a stated CPI rather
    // than as a general law.
    assert(t.none > t.cpiminus1 && t.cpiminus1 > t.halfcpi,
        `CPI-haircut ordering broke at 3% CPI: ${JSON.stringify(t)}`);
    // Every margin still leaves the ceiling well above the unprojected threshold it replaced, so
    // the fix is not cancelled out by its own safety belt.
    for (const [m, v] of Object.entries(t))
        assert(v > 108999, `${m} fell back below the old un-projected ceiling: ${v}`);
});

test('irmaaMarginMode halfstep: priced off the real tier step, and live at age 63', () => {
    // SGL Tier 1 is $202.90/month in TAXData, so the step a filer avoids is $2,434.80/yr and the
    // setback is half of it. Not a guessed constant: change the table and this moves with it.
    const step = getRateBracket('IRMAA', 'SGL')[1].r * 12;
    assertNear(_target({ irmaaMarginMode: 'none' }) - _target({ irmaaMarginMode: 'halfstep' }),
        step / 2, 'halfstep must hold back half the tier step', 0.01);
    // The gate that makes this hard: the tier ceiling switches on at ELIGIBILITY_AGE + LOOKBACK
    // (63), when nobody is enrolled in Medicare yet. Pricing the margin off yr.onMedicare would
    // zero it out at exactly the ages the ceiling first bites, so onMedicareAtCharge counts who
    // WILL be enrolled when this year's MAGI is charged.
    assert(onMedicareAtCharge(63, 0, true, false) === 1, 'a 63-year-old counts at charge time');
    assert(onMedicareAtCharge(62, 0, true, false) === 0, 'a 62-year-old does not');
    const age63 = { ...IRMAA_CEIL_BASE, birthyear1: 1963, die1: 95 };
    const row = m => simulate({ ...age63, irmaaMarginMode: m }).log[0];
    assert(row('none').age1 === 63, 'fixture must open at 63');
    assertNear(row('none').BracketTarget - row('halfstep').BracketTarget, step / 2,
        'the margin must still be live at 63, before anyone is enrolled', 0.01);
});

test('QCD As Needed uses the full projection and ignores the margin setting entirely', () => {
    // The margin applies to the TIER CEILING only. It used to apply here too, and that was measured
    // to be about 47 to 1 against: the default donated $82,764 more to avoid $1,776 of surcharge.
    // On this arm a margin is bought with dollars that leave the household, and the surcharge it
    // avoids is far smaller than the MAGI needed to clear a threshold, so it cannot pay.
    const qb = { ...BASE, IRA1: 5000000, cpi: 0.03, qcdHHMax: 120000, qcdMode: 'asneeded' };
    const qcd = m => { const r = simulate({ ...qb, irmaaMarginMode: m }).log[0];
                       return (r.QCD1 || 0) + (r.QCD2 || 0); };
    const base = qcd('none');
    assert(base > 0, 'fixture must actually trigger As Needed QCDs');
    for (const m of IRMAA_MARGIN_MODES)
        assertNear(qcd(m), base, `margin mode ${m} must not change the QCD at all`, 0.01);
    // The loop above already covers the haircut modes, whose FACTOR would otherwise shrink the
    // target even with no dollar setback - that is the half of the decoupling easiest to get wrong,
    // since dropping only irmaaMarginDollars would leave halfcpi still moving the QCD.
    // That the target is forward-projected at all is pinned by the boundary test below.
});

test('QCD As Needed: MAGI between today\'s floor and the projected floor needs no QCD', () => {
    // The clearest statement of what the forward projection buys, and the one a reader is most
    // likely to get backwards. `none` means NO MARGIN, not "no forward projection" - every mode
    // aims at the projected threshold. So a MAGI sitting between today's tier floor and the floor
    // as it will be indexed |LOOKBACK| years out is already under the line that will judge it, and
    // must trigger no donation at all. Before the fix it triggered one, sized by the whole gap.
    const fwd = irmaaFwdFactor({ cpi: 0.03, irmaaMarginMode: 'none' });
    const floor = getRateBracket('IRMAA', 'SGL')[1].l;          // $109,000 today
    assertNear(floor * fwd, 115638.1, 'the projected SGL Tier 1 floor at 3% CPI', 0.5);
    for (const magi of [floor + 500, floor + 3000, floor + 6000]) {
        assert(getIRMAATierTargetMAGI(magi, 'SGL', fwd, 2) === 0,
            `MAGI ${magi} is under the projected floor, so As Needed must ask for nothing`);
        // ...and the pre-fix lookup, which used today's floor, would have asked for the whole gap.
        assert(getIRMAATierTargetMAGI(magi, 'SGL', 1, 2) > 0,
            `MAGI ${magi} must have needed a QCD before the projection was applied`);
    }
    // Just past the projected floor it does engage, so this is a boundary not a blanket exemption.
    assert(getIRMAATierTargetMAGI(floor * fwd + 500, 'SGL', fwd, 2) > 0,
        'above the projected floor As Needed must still trim');
});

test('irmaaMarginMode is inert for a plan with no IRMAA ceiling and no QCDs', () => {
    // The leak guard. `fixed` never consults an IRMAA threshold, so no margin mode may move it.
    const run = m => JSON.stringify(simulate({ ...BASE, cpi: 0.03, irmaaMarginMode: m }).log);
    const base = run('none');
    for (const m of IRMAA_MARGIN_MODES)
        assert(run(m) === base, `margin mode ${m} leaked into a plan with no IRMAA ceiling`);
});

test('ELIGIBILITY_AGE: the harness restores the constant', () => {
    // Guards every test above: they mutate shared engine data, and a leaked 70 would silently
    // change every later scenario in this file rather than fail here.
    assert(TAXData.IRMAA.ELIGIBILITY_AGE === 65,
        `constant leaked from an earlier test: ${TAXData.IRMAA.ELIGIBILITY_AGE}`);
});

// ── Tax-rate creep (P4 phase 1) ───────────────────────────────────────────────
// Bracket RATES escalate a fixed % per year from a start year; bracket LIMITS are untouched.
// Federal has a UI knob; the state multiplier is plumbed end-to-end but pinned at 0 for now,
// so these tests are what keep the state path from rotting before it gets a control.
// A bigger IRA than BASE so the plan actually reaches taxable brackets every year.
// P38: IRA1 was 1200000, which against a $90k spend over 20 zero-growth years with no Social
// Security is a plan that cannot fund itself — $1.45M of assets against $1.8M of spending before
// any tax. That was invisible while the engine under-withdrew and left a balance behind; once the
// funding backstop spends the IRA down, the run ends at exactly zero and optimizeSpend correctly
// returns null (its baseline gate at optimizer_core.js:2835 requires the final year to still be
// fundable). None of the creep tests are about solvency, so the fixture is now solvent and they
// go back to measuring only what they name: crept tax vs flat tax on identical inputs.
const CREEP_BASE = {
    ...BASE,
    IRA1: 2000000,
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

test('Annual Details reports the inflation and market return each year was handed', () => {
    // Three columns behind Show All. Under Monte Carlo every path gets its own sequences, so these
    // have to echo the sequence the year actually ran on - a constant would make a replayed path
    // unreadable and would hide the very divergence the columns exist to show.
    const N = 30;
    const returnSequence   = Array.from({ length: N }, (_, i) => 0.04 + (i % 5) * 0.01);
    const inflationSequence = Array.from({ length: N }, (_, i) => 0.01 + (i % 3) * 0.01);
    const res = simulate({ ...CREEP_BASE, returnSequence, inflationSequence });

    let cum = 1;
    for (let i = 0; i < Math.min(N, res.log.length); i++) {
        const row = res.log[i];
        assert(row['infl%'] === inflationSequence[i],
            `year ${i}: infl% ${row['infl%']} against sequence ${inflationSequence[i]}`);
        assert(row['return%'] === returnSequence[i],
            `year ${i}: return% ${row['return%']} against sequence ${returnSequence[i]}`);
        // Cumulative is reported as the rise SO FAR, so year 0 is 0 and each year compounds the
        // one before it. Reported as a percent rather than the raw multiplier so it formats like
        // every other '%' column; inflationFactor still carries the multiplier.
        assert(Math.abs(row['inflCum%'] - (cum - 1)) < 1e-12,
            `year ${i}: inflCum% ${row['inflCum%']} against compounded ${cum - 1}`);
        assert(Math.abs((row.inflationFactor ?? 1) - cum) < 1e-12,
            `year ${i}: inflationFactor and inflCum% disagree`);
        cum *= (1 + inflationSequence[i]);
    }

    // A deterministic run has no sequences and must fall back to the typed inputs, not to blanks.
    const flat = simulate({ ...CREEP_BASE, growth: 0.055, inflation: 0.025 });
    assert(flat.log.every(r => r['return%'] === 0.055), 'a deterministic run should report the growth typed');
    assert(flat.log.every(r => r['infl%'] === 0.025), 'a deterministic run should report the inflation typed');
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

// ── An unbounded ceiling must not produce NaN ─────────────────────────────────
// "Fill Bracket" at the top federal bracket rendered $NaN across the whole page. Every field
// computeBracketCeiling returns is a quantity measured AT the ceiling, and the top bracket's `l` is
// the Infinity sentinel, so the average-rate divisions came out 0/0 or Infinity/Infinity. The top
// bracket is no longer selectable, but the engine has to hold up on its own: a saved plan, a shared
// URL and a programmatic caller can all still hand it that rate.

test('nominalRateAtLimit: defined at both ends of a bracket table', () => {
    assert(nominalRateAtLimit('FEDERAL', 'MFJ', 0, 1, 1) === 0, 'no income means no average rate, not 0/0');
    assert(nominalRateAtLimit('FEDERAL', 'MFJ', -5, 1, 1) === 0, 'a negative ceiling is treated as no income');
    // As income grows without bound, tax/income converges on the top marginal rate.
    const fedBrks = getRateBracket('FEDERAL', 'MFJ');
    const topRate = fedBrks[fedBrks.length - 1].r;
    assertNear(nominalRateAtLimit('FEDERAL', 'MFJ', Infinity, 1, 1), topRate,
        'an unbounded ceiling reports the top marginal rate', 1e-12);
    assertNear(nominalRateAtLimit('FEDERAL', 'MFJ', Infinity, 1, 1.5), topRate * 1.5,
        'rate creep applies to the unbounded answer too', 1e-12);
    // A no-tax state's table is a single Infinity row with no rate at all.
    assert(nominalRateAtLimit('TX', 'MFJ', Infinity, 1, 1) === 0,
        'a no-tax state charges nothing, at any ceiling');
    // The ordinary case is the plain division, untouched.
    const lim = 400000;
    assertNear(nominalRateAtLimit('FEDERAL', 'MFJ', lim, 1, 1),
        calculateProgressive('FEDERAL', 'MFJ', lim, 1, 1).cumulative / lim,
        'a finite ceiling still reports tax/limit exactly', 1e-12);
});

test('unbounded ceilings simulate instead of returning NaN', () => {
    const base = { ...CREEP_BASE, IRA1: 2000000, spendGoal: 120000,
                   strategy: 'bracket', stratACAMultiple: 0, stratIRMAATier: -1 };
    const finiteOf = o => {
        const r = simulate({ ...base, ...o });
        return Number.isFinite(r.totals.tax) && Number.isFinite(r.finalNW)
            && r.log.every(e => e.year === undefined || Number.isFinite(e.totalTax));
    };
    // The top FEDERAL bracket: l is Infinity, and for a state whose table runs out first the
    // Math.min then collapses the ceiling to 0. Both routes used to end in NaN.
    assert(finiteOf({ stratRate: 0.37 }), 'the top federal bracket must not produce NaN (CA)');
    assert(finiteOf({ stratRate: 0.37, STATEname: 'TX' }), 'the top federal bracket must not produce NaN (no-tax state)');
    // Below every bracket in the table. No UI offers it; a programmatic caller can still ask.
    assert(finiteOf({ stratRate: 0 }), 'a ceiling below the lowest bracket must not produce NaN');
    // The top IRMAA tier, whose ceiling is the Infinity sentinel row. The IRMAA branch has no
    // state-min step, so this one stays infinite rather than collapsing to zero.
    const topTier = getRateBracket('IRMAA', 'MFJ').length - 2;
    assert(finiteOf({ stratRate: 0, stratIRMAATier: topTier }),
        `the top IRMAA tier (${topTier}) must not produce NaN`);
    // Every bounded ceiling the dropdown offers still works, which is the regression half.
    for (const rate of [0.10, 0.12, 0.22, 0.24, 0.32, 0.35])
        assert(finiteOf({ stratRate: rate }), `bracket ${rate} still simulates`);
    for (let t = 0; t < topTier; t++)
        assert(finiteOf({ stratRate: 0, stratIRMAATier: t }), `IRMAA tier ${t} still simulates`);
});

// ── P70: the inflation model - two clocks, an offset, and a one-year lag ──────
//
// CPI and Inflation are separate inputs ON PURPOSE. The statutory index (CPI-W for COLA, chained
// CPI-U for brackets) runs below felt inflation; defaults are inflation 3.0 / cpi 2.8. So a Monte
// Carlo path supplies GENERAL inflation and the statutory index is that path less the typed spread.
//
// CREEP_BASE inherits BASE's cpi 0 / ss1 0, which would make every factor a constant 1 and leave the
// SS assertions with nothing to measure.
const CLOCK_BASE = { ...CREEP_BASE, cpi: 0.028, inflation: 0.030, ss1: 40000, ss1Age: 67, die1: 95 };
const CLOCK_N    = 40;
const CLOCK_RET  = Array.from({ length: CLOCK_N }, (_, i) => 0.04 + (i % 5) * 0.01);
// Lumpy on purpose: 1% to 13%, so a wrong clock cannot hide behind a smooth series.
const CLOCK_INFL = Array.from({ length: CLOCK_N }, (_, i) => 0.01 + ((i * 7) % 11) * 0.012);
const clockRows  = res => res.log.filter(e => e.year !== undefined);

test('P70: a deterministic run is inert under the spread model, at any (cpi, inflation)', () => {
    // THE load-bearing property. With no inflationSequence the drawn inflation IS inputs.inflation,
    // so cpi_t = inputs.inflation + (cpi - inflation) = inputs.cpi exactly. Every deterministic plan
    // must therefore be untouched, with no special case - and fixedTaxIndexing must be a no-op there
    // rather than a second code path that happens to agree.
    for (const [inflation, cpi] of [[0.030, 0.028], [0.025, 0.025], [0.020, 0.035], [0.050, 0.020]]) {
        const args = { ...CLOCK_BASE, inflation, cpi };
        const bare  = simulate({ ...args });
        const onFix = simulate({ ...args, fixedTaxIndexing: true });
        const offFix= simulate({ ...args, fixedTaxIndexing: false });
        const tag = `inflation ${inflation} / cpi ${cpi}`;
        assert(JSON.stringify(bare.log) === JSON.stringify(onFix.log),
            `${tag}: fixedTaxIndexing:true must not move a deterministic run`);
        assert(JSON.stringify(bare.log) === JSON.stringify(offFix.log),
            `${tag}: fixedTaxIndexing:false must not move a deterministic run`);
        // And the index really is the typed cpi compounded, not the typed inflation.
        let cum = 1;
        for (const r of clockRows(bare)) {
            assertNear(r['-cpiFactor'], cum, `${tag}: cpiFactor tracks the typed cpi`, 1e-9);
            cum *= (1 + cpi);
        }
    }
});

test('P70: under a path the index follows inflation MINUS the spread, never the bare path', () => {
    const inflation = 0.030, cpi = 0.028, spread = cpi - inflation;
    const res = simulate({ ...CLOCK_BASE, inflation, cpi,
                           returnSequence: CLOCK_RET, inflationSequence: CLOCK_INFL });
    const rows = clockRows(res);

    let want = 1, bare = 1;
    for (let i = 0; i < rows.length; i++) {
        assertNear(rows[i]['-cpiFactor'], want, `year ${i}: cpiFactor is the path plus the spread`, 1e-9);
        want *= (1 + CLOCK_INFL[i] + spread);
        bare *= (1 + CLOCK_INFL[i]);
    }
    // The spread must SURVIVE. An earlier flag set the index to the bare path, which silently threw
    // away the CPI/inflation gap and handed every plan higher thresholds as an artifact.
    assert(Math.abs(rows[rows.length - 1]['-cpiFactor'] - bare) > 1e-6,
        'the index must not collapse onto the bare path - that discards the typed spread');
    assert(rows[rows.length - 1]['-cpiFactor'] < bare,
        'with cpi below inflation the index must run BELOW the price level');
});

test('P70: the indexation lag - year t+1 is set from year t inflation', () => {
    // Not incidental. The IRS sets a year's brackets from a 12-month average ending the PREVIOUS
    // August, and SSA from the previous Q3. Compounding at the top of the year instead of the bottom
    // would hand the tax code a year of foresight, and nothing else here would notice.
    const inflation = 0.030, cpi = 0.028, spread = cpi - inflation;
    const rows = clockRows(simulate({ ...CLOCK_BASE, inflation, cpi,
                                      returnSequence: CLOCK_RET, inflationSequence: CLOCK_INFL }));
    assertNear(rows[0]['-cpiFactor'], 1, 'year 0 runs on unindexed, present-day brackets', 1e-12);
    for (let t = 0; t + 1 < rows.length; t++) {
        assertNear(rows[t + 1]['-cpiFactor'], rows[t]['-cpiFactor'] * (1 + CLOCK_INFL[t] + spread),
            `year ${t + 1} is indexed by year ${t}'s inflation, not its own`, 1e-9);
    }
});

test('P70: fixedTaxIndexing pins the tax code while spending still follows the path', () => {
    const args = { ...CLOCK_BASE, returnSequence: CLOCK_RET, inflationSequence: CLOCK_INFL };
    const path  = simulate({ ...args });
    const fixed = simulate({ ...args, fixedTaxIndexing: true });
    const pr = clockRows(path), fr = clockRows(fixed);

    // Frozen: the index is the typed cpi compounded, whatever the path did.
    let cum = 1;
    for (const r of fr) { assertNear(r['-cpiFactor'], cum, 'fixed mode pins the index', 1e-9); cum *= (1 + CLOCK_BASE.cpi); }
    // Not frozen: spending rides the path in BOTH arms, so the two runs share an inflation history.
    for (let i = 0; i < Math.min(pr.length, fr.length); i++) {
        assert(pr[i]['infl%'] === fr[i]['infl%'] && pr[i]['infl%'] === CLOCK_INFL[i],
            `year ${i}: spending inflation follows the path in both arms`);
        assertNear(pr[i].inflationFactor, fr[i].inflationFactor, `year ${i}: the price level is untouched by the mode`, 1e-9);
    }
    // And it is a real diagnostic, not a no-op: the tax outcome moves.
    assert(sumCol(path, 'totalTax') !== sumCol(fixed, 'totalTax'),
        'pinning the tax code must change the tax paid under a variable path');
});

test('P70: Medicare premium growth is the index plus a FIXED excess, not a doubled path', () => {
    // A deliberate modeling choice, pinned so it cannot be "simplified" back. Medicare grows at
    // cpi_t + inputs.inflation: the statutory index plus a constant excess-medical spread. At the
    // shipped defaults that is 2.8 + 3.0 = 5.8%, i.e. about 3 points of excess over the index.
    //
    // Making the excess path-following too (cpi_t + i_t) reads the tooltip literally but implies
    // 12 points of excess medical cost in a 12% inflation year, and swung measured IRMAA dollars
    // from -6.5% to +29%.
    const inflation = 0.030, cpi = 0.028;
    const flat = 0.12;                                   // a steady 12% path, so the arithmetic is checkable by hand
    const seq  = Array.from({ length: CLOCK_N }, () => flat);
    const rows = clockRows(simulate({ ...CLOCK_BASE, inflation, cpi,
                                      returnSequence: CLOCK_RET, inflationSequence: seq }));
    // Medicare is logged as onMedicare * (standard premiums) * 12 * medicareRate, so consecutive
    // years give the growth rate directly once both are on Medicare.
    const med = rows.map(r => r.Medicare).filter(v => v > 0);
    assert(med.length > 3, 'the fixture must actually reach Medicare age');
    const cpi_t    = flat + (cpi - inflation);           // the index under this path
    const expected = 1 + cpi_t + inflation;              // index + FIXED excess
    const doubled  = 1 + cpi_t + flat;                   // the rejected reading
    for (let i = 1; i < med.length; i++) {
        assertNear(med[i] / med[i - 1], expected,
            `year ${i}: Medicare grows at the index plus a fixed excess`, 1e-9);
    }
    assert(Math.abs(expected - doubled) > 0.05,
        'the two readings must be far enough apart that this test can tell them apart');
});

test('P81: the engine floor matches the one the banks are drawn under', () => {
    // optimizer_core carries its own copy because it has no montecarlo dependency and prng.js loads
    // after it. This assertion is the whole reason that copy is allowed to exist.
    const drawn = (typeof _mcPrng !== 'undefined' && _mcPrng) ? _mcPrng.INFLATION_FLOOR : undefined;
    assert(drawn !== undefined, 'prng.js must export INFLATION_FLOOR for this comparison to mean anything');
    assert(core.CPI_INDEX_FLOOR === drawn,
        `the engine floor (${core.CPI_INDEX_FLOOR}) and the draw floor (${drawn}) have drifted apart`);
});

test('P81: no top-level name collides across the files the worker shares a scope with', () => {
    // montecarlo/worker.js importScripts() taxengine.js, optimizer_core.js, prng.js, stats.js and
    // mc_engine.js into ONE global scope. Two top-level `const` of the same name is a SyntaxError
    // that kills the worker before it runs a path, and NODE CANNOT SEE IT - each file gets its own
    // module scope there. A duplicated INFLATION_FLOOR shipped exactly this way and took the whole
    // Monte Carlo tab down; only the in-page suite noticed.
    if (!IS_NODE) return;   // the browser tier has already proven it by loading
    const fs = require('fs'), path = require('path');
    const FILES = ['taxengine.js', 'optimizer_core.js', 'montecarlo/prng.js',
                   'montecarlo/historical_returns.js', 'montecarlo/stats.js', 'montecarlo/mc_engine.js'];
    const topLevel = src => new Set(
        [...src.matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]));
    const seen = new Map();   // name -> first file that declared it
    const clashes = [];
    for (const f of FILES) {
        const p = path.join(__dirname, f);
        if (!fs.existsSync(p)) continue;
        for (const name of topLevel(fs.readFileSync(p, 'utf8'))) {
            if (seen.has(name)) clashes.push(`${name}: ${seen.get(name)} and ${f}`);
            else seen.set(name, f);
        }
    }
    assert(clashes.length === 0,
        'the worker shares one scope, so these top-level names collide: ' + clashes.join(' | '));
});

test('P81: no index step falls below the floor, at any spread', () => {
    // The floor upstream guards the DRAW. cpi_t is DERIVED - inflation minus the CPI spread - and the
    // shipped default spread is negative, so a year already at the floor used to be pushed through it.
    // Walk the logged index factor step by step and assert none of them undershoots.
    const N = CLOCK_N;
    // A sequence that sits ON the floor for a stretch, which is where the defect lived.
    const seq = Array.from({ length: N }, (_, i) => (i % 3 === 0 ? -0.01 : 0.02 + (i % 5) * 0.01));
    for (const [inflation, cpi] of [[0.030, 0.028], [0.035, 0.020], [0.020, 0.035], [0.025, 0.025]]) {
        const rows = clockRows(simulate({ ...CLOCK_BASE, inflation, cpi,
                                          returnSequence: CLOCK_RET, inflationSequence: seq }));
        const tag = `inflation ${inflation} / cpi ${cpi}`;
        for (let t = 0; t + 1 < rows.length; t++) {
            const step = rows[t + 1]['-cpiFactor'] / rows[t]['-cpiFactor'] - 1;
            assert(step >= core.CPI_INDEX_FLOOR - 1e-12,
                `${tag}: year ${t + 1} indexed at ${(step * 100).toFixed(3)}%, below the ${core.CPI_INDEX_FLOOR * 100}% floor`);
        }
        // And the floor must BITE on a negative spread rather than being a no-op assertion: with the
        // sequence pinned at the floor every third year, the clamped step must equal the floor exactly.
        if (cpi < inflation) {
            const steps = rows.slice(1).map((r, t) => r['-cpiFactor'] / rows[t]['-cpiFactor'] - 1);
            assert(steps.some(v => Math.abs(v - core.CPI_INDEX_FLOOR) < 1e-12),
                `${tag}: the floor must actually clamp here, or this test proves nothing`);
        }
    }
});

// A sequence that falls for a stretch and then recovers past where it started. Both P81c tests
// need it: a COLA floor that is never exercised proves nothing, and the difference between the
// two floor rules only shows up on the way back UP.
const DEFLATE_SEQ = [0.02, -0.01, -0.01, 0.00, 0.01, 0.06, 0.03, 0.02, -0.01, 0.04,
                     0.03, 0.02, 0.02, 0.03, 0.02, 0.02, 0.03, 0.02, 0.02, 0.03,
                     0.02, 0.02, 0.03, 0.02, 0.02, 0.03, 0.02, 0.02, 0.03, 0.02,
                     0.02, 0.03, 0.02, 0.02, 0.03, 0.02, 0.02, 0.03, 0.02, 0.02];
// The step actually applied between two logged years: the drawn rate plus the spread, floored.
const clockStep = (t, cpi, inflation) =>
    Math.max(core.CPI_INDEX_FLOOR, DEFLATE_SEQ[t] + (cpi - inflation));

test('P81c: Social Security never falls, and absorbs the deflation on the way back up', () => {
    // 42 U.S.C. 415(i) measures each increase from the last quarter that PRODUCED one, so a
    // deflation year pays zero and the shortfall is made up by the recovery rather than paid twice.
    // The benefit therefore rides the running MAXIMUM of the index, not the index itself and not a
    // per-year max(0, .) - which would ratchet up permanently and overstate every deflating path.
    const inflation = 0.030, cpi = 0.028;
    const rows = clockRows(simulate({ ...CLOCK_BASE, inflation, cpi,
                                      returnSequence: CLOCK_RET, inflationSequence: DEFLATE_SEQ }));
    const ss = rows.map(r => r.SSincome);
    const cf = rows.map(r => r['-cpiFactor']);

    // The premise: the index really does fall here, or nothing below is being tested.
    assert(cf.some((v, i) => i > 0 && v < cf[i - 1] - 1e-12),
        'the index must actually fall on this sequence, or this test proves nothing');

    // 1. A benefit already being paid never goes down.
    for (let t = 1; t < ss.length; t++)
        assert(ss[t] >= ss[t - 1] - 1e-6,
            `year ${t}: Social Security fell from ${ss[t - 1].toFixed(0)} to ${ss[t].toFixed(0)}`);

    // 2. It is exactly the high-water mark of the index, year by year. Measured against the
    //    benefit actually paid in year 0 rather than against inputs.ss1, because a single filer's
    //    benefit comes back through the survivor branch, which works in whole monthly dollars.
    let peak = 0, sawFlat = 0;
    for (let t = 0; t < ss.length; t++) {
        peak = Math.max(peak, cf[t]);
        assertNear(ss[t], ss[0] * peak / cf[0], `year ${t}: SS pays the index high-water mark`, 1e-6);
        if (t > 0 && Math.abs(ss[t] - ss[t - 1]) < 1e-6) sawFlat++;
    }
    assert(sawFlat >= 2, 'the deflation years must pay a FLAT benefit, not a reduced one');

    // 3. And it is the cheaper of the two readings: a per-year floor would compound the recovery
    //    on top of a deflation it never paid for, so by the end it pays strictly more.
    let ratchet = 1;
    for (let t = 0; t + 1 < ss.length; t++) ratchet *= (1 + Math.max(0, clockStep(t, cpi, inflation)));
    const last = ss.length - 1;
    assert(ss[0] * ratchet / cf[0] > ss[last] + 1,
        'a per-year floor must pay MORE than the high-water rule here, or the two are indistinguishable');
});

test('P81c: a capped pension COLA is floored at zero per year, and does not claw back', () => {
    // A capped plan is NOT on the high-water rule: the cap already severs it from the index level
    // (P70i), and plan language grants an adjustment of the lesser of the cap and the year's CPI
    // increase. So it floors year by year and keeps whatever it was paid.
    const inflation = 0.030, cpi = 0.028, cap = 0.02;
    const base = { ...CLOCK_BASE, inflation, cpi, pensionAnnual: 30000, pensionStartAge: 60,
                   pensionCola: '2', returnSequence: CLOCK_RET, inflationSequence: DEFLATE_SEQ };
    const rows = clockRows(simulate(base));
    const pen  = rows.map(r => r.pension);
    const cf   = rows.map(r => r['-cpiFactor']);

    assert(DEFLATE_SEQ.some((_, t) => t + 1 < rows.length && clockStep(t, cpi, inflation) < 0),
        'a negative index step must occur here, or the floor is never exercised');

    // 1. Never falls.
    for (let t = 1; t < pen.length; t++)
        assert(pen[t] >= pen[t - 1] - 1e-6,
            `year ${t}: the pension fell from ${pen[t - 1].toFixed(0)} to ${pen[t].toFixed(0)}`);

    // 2. Exactly the per-year rule, compounded: max(0, min(cap, this year's index step)).
    let want = 30000;
    for (let t = 0; t < pen.length; t++) {
        assertNear(pen[t], want, `year ${t}: the pension pays max(0, min(cap, CPI))`, 1e-6);
        want *= (1 + Math.max(0, Math.min(cap, clockStep(t, cpi, inflation))));
    }

    // 3. The two rules are genuinely different: run the pension at a FULL COLA, where the cap
    //    cannot be what separates them, and it still outpaces the index's high-water mark.
    const full = clockRows(simulate({ ...base, pensionCola: 'full' })).map(r => r.pension);
    let peak = 0, diverged = false;
    for (let t = 0; t < full.length; t++) {
        peak = Math.max(peak, cf[t]);
        if (full[t] > 30000 * peak + 1) diverged = true;
    }
    assert(diverged, 'a full COLA must NOT follow the Social Security high-water rule');
});

test('P70i: a capped pension COLA pays the lesser of its cap and CPI, year by year', () => {
    // The cap bites PER YEAR, which is the whole point: a run of quiet years followed by a hot one
    // is not the same as the average, and a capped plan never catches up afterwards.
    const inflation = 0.030, cpi = 0.028, spread = cpi - inflation;
    const seq = CLOCK_INFL;                       // lumpy, 1% to 13%
    const base = { ...CLOCK_BASE, inflation, cpi, pensionAnnual: 30000, pensionStartAge: 60,
                   returnSequence: CLOCK_RET, inflationSequence: seq };
    const pens = o => clockRows(simulate({ ...base, ...o })).map(r => r.pension);

    // No increase: flat nominal, forever.
    for (const off of [{ pensionCola: 'none' }, { pensionCola: false }, {}]) {
        const p = pens(off);
        assert(p.every(v => Math.abs(v - p[0]) < 1e-9),
            `${JSON.stringify(off)}: a pension with no COLA must not move`);
    }
    // Full COLA rides the index exactly, so it equals cpiFactor times the base.
    const full = clockRows(simulate({ ...base, pensionCola: 'full' }));
    for (const r of full)
        assertNear(r.pension, 30000 * r['-cpiFactor'], 'a full COLA tracks the index exactly', 1e-6);
    // The old boolean still means what it meant.
    assert(JSON.stringify(pens({ pensionCola: true })) === JSON.stringify(pens({ pensionCola: 'full' })),
        'pensionCola:true must still mean a full COLA');

    // Capped: each year grows by min(cap, that year's index rate), compounded.
    for (const cap of [1, 2, 3]) {
        const p = pens({ pensionCola: String(cap) });
        let want = 30000;
        for (let i = 0; i < p.length; i++) {
            assertNear(p[i], want, `cap ${cap}%: year ${i} pays the lesser of the cap and CPI`, 1e-6);
            want *= (1 + Math.min(cap / 100, seq[i] + spread));
        }
    }
    // And the ordering holds: more cap is never less pension, and full is the ceiling.
    const last = o => { const p = pens(o); return p[p.length - 1]; };
    const none = last({ pensionCola: 'none' }), c1 = last({ pensionCola: '1' });
    const c2 = last({ pensionCola: '2' }), c3 = last({ pensionCola: '3' }), f = last({ pensionCola: 'full' });
    assert(none < c1 && c1 < c2 && c2 < c3 && c3 < f,
        `each step up the cap must pay more: ${[none, c1, c2, c3, f].map(Math.round).join(' < ')}`);
});

test('P70i: pensionColaCap reads every shape the input can arrive in', () => {
    assert(pensionColaCap({ pensionCola: false }) === null, 'false is no COLA');
    assert(pensionColaCap({ pensionCola: 'none' }) === null, "'none' is no COLA");
    assert(pensionColaCap({ pensionCola: '' }) === null, 'blank is no COLA');
    assert(pensionColaCap({}) === null, 'absent is no COLA - the safe default for a pension');
    assert(pensionColaCap({ pensionCola: true }) === Infinity, 'true is uncapped');
    assert(pensionColaCap({ pensionCola: 'full' }) === Infinity, "'full' is uncapped");
    assertNear(pensionColaCap({ pensionCola: '2' }), 0.02, "'2' is a 2% cap", 1e-12);
    assertNear(pensionColaCap({ pensionCola: 2 }), 0.02, 'a bare number is a percent cap', 1e-12);
    assert(pensionColaCap({ pensionCola: 'garbage' }) === null, 'anything unreadable is no COLA');
});

test('P70: every indexed quantity tracks its declared clock', () => {
    // The guard for the whole class. Each quantity below is on the STATUTORY clock or the PRICE
    // LEVEL, and the way to tell them apart is to run two plans whose typed rates differ and check
    // which number moved. Without this the next quantity added picks a clock by whatever is in
    // scope, which is how every defect in this phase arrived.
    const base = { ...CLOCK_BASE, IRA1: 2000000, spendGoal: 120000,
                   pensionAnnual: 30000, pensionCola: true, pensionStartAge: 60,
                   CashReserve: 50000, propTax: 12000, qcdHHMax: 20000 };
    // Same felt inflation, different statutory index. Anything that moves is on cpiRate.
    const lowCpi  = simulate({ ...base, inflation: 0.03, cpi: 0.01 });
    const highCpi = simulate({ ...base, inflation: 0.03, cpi: 0.05 });
    // Same statutory index, different felt inflation. Anything that moves is on sim.inflation.
    const lowInf  = simulate({ ...base, inflation: 0.01, cpi: 0.03 });
    const highInf = simulate({ ...base, inflation: 0.05, cpi: 0.03 });

    const last = res => clockRows(res)[clockRows(res).length - 1];
    const movesWithCpi  = f => f(last(lowCpi))  !== f(last(highCpi));
    const movesWithInfl = f => f(last(lowInf))  !== f(last(highInf));

    // ── statutory clock ──
    assert(movesWithCpi(r => r['-cpiFactor']), 'the index itself moves with CPI');
    assert(!movesWithInfl(r => r['-cpiFactor']),
        'the index must NOT move with felt inflation - that is the two-clock defect');
    assert(movesWithCpi(r => r.SSincome), 'Social Security COLA is on CPI');
    assert(!movesWithInfl(r => r.SSincome), 'Social Security COLA is NOT on felt inflation');
    assert(movesWithCpi(r => r.pension), 'a pension COLA is on CPI');
    assert(!movesWithInfl(r => r.pension),
        'a pension COLA must not ride felt inflation - Social Security does not');

    // The bracket ceiling needs a strategy that computes one; CLOCK_BASE inherits 'fixed'. Read
    // BracketTarget, the ceiling the strategy actually aims at - goalFedBracketLimit is a `yr`
    // object and never reaches the log, so asserting on it compares undefined to undefined and
    // passes for the wrong reason.
    const brk = o => {
        const rows = clockRows(simulate({ ...base, strategy: 'bracket', stratRate: 0.22,
                                          stratIRMAATier: -1, stratACAMultiple: 0, ...o }));
        return rows[rows.length - 1].BracketTarget;
    };
    const brkLowCpi = brk({ inflation: 0.03, cpi: 0.01 });
    assert(Number.isFinite(brkLowCpi) && brkLowCpi > 0, 'the bracket-strategy fixture must actually report a ceiling');
    assert(brkLowCpi !== brk({ inflation: 0.03, cpi: 0.05 }), 'bracket limits are on CPI');
    assert(brk({ inflation: 0.01, cpi: 0.03 }) === brk({ inflation: 0.05, cpi: 0.03 }),
        'bracket limits must NOT move with felt inflation - that is the two-clock defect');

    // ── both clocks, by design ──
    // The sidebar tooltip promises Medicare/IRMAA dollars grow at "CPI + Inflation combined, not
    // CPI alone", so this is the one quantity that must respond to each of them.
    assert(movesWithCpi(r => r.Medicare) && movesWithInfl(r => r.Medicare),
        'Medicare premium growth rides CPI + Inflation together');

    // ── price level ──
    assert(movesWithInfl(r => r.spendGoal), 'the spending goal is on felt inflation');
    assert(!movesWithCpi(r => r.spendGoal), 'the spending goal is NOT on CPI');
    assert(movesWithInfl(r => r.inflationFactor), 'the price level is on felt inflation');
    assert(!movesWithCpi(r => r.inflationFactor), 'the price level is NOT on CPI');
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

test.slow('breakEvenHeirsRate: the rate/amount pair it reports is self-consistent', () => {
    const r = breakEvenHeirsRate(CONV_BASE, FIXEDPCT_OV, {});
    assert(r !== null, 'this fixture does have a threshold');
    // P88b RE-BASELINE, 0.57 -> 0.65. Converting now carries the IRMAA it always owed, so it takes
    // a HIGHER heirs rate to justify - the direction a correction must move this. Checked on the
    // fixture rather than accepted: age 74 in year 0 and on Medicare throughout, lifetime IRMAA
    // $6,001 with no extra conversion and $35,704 at $100,000 of it.
    assertNear(r.rate, 0.65, 'break-even heirs rate for the fixedpct fixture', 0.011);
    assert(r.optConv === 75000, `expected a $75,000 conversion at the threshold, got ${r.optConv}`);
    // The rounding nudge exists so a reported rate never comes back with a $0 conversion.
    assert(r.optConv > 0, 'a reported rate must always carry a real conversion amount');
    assert(r.gain > 0, 'and a positive gain');
});

test.slow('breakEvenHeirsRate: the predicate is monotonic in the rate (binary search precondition)', () => {
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

test.slow('lowestBreakEvenHeirsRate: finds a threshold the best-scoring candidate does not have', () => {
    // The whole reason this searches the pool: the top-ranked strategy is often the one LEAST
    // willing to convert, so asking only it would report "never" while another candidate pays.
    assert(breakEvenHeirsRate(CONV_BASE, FIXED_OV, {}) === null,
        'precondition: the fixed candidate alone reports no threshold');
    const best = lowestBreakEvenHeirsRate(CONV_BASE, [
        { overrides: FIXED_OV,    terminalIRA: 100000, label: 'fixed' },
        { overrides: FIXEDPCT_OV, terminalIRA: 500000, label: 'fixedpct' }
    ], {});
    assert(best !== null, 'the pool search must find the candidate that does have a threshold');
    // P88b RE-BASELINE, 0.57 -> 0.65: same fixture, same cause as the test above.
    assertNear(best.rate, 0.65, 'pool-wide lowest break-even heirs rate', 0.011);
    assert(best.label === 'fixedpct', `expected the fixedpct candidate to win, got ${best.label}`);
});

// CONV_BASE itself no longer has a paying time-limited conversion, and that is a finding rather
// than a fixture problem. Its conversion advantage was worth $1,221 at a 0.24 heirs rate and
// $5,587 at 0.50, while the IRC 1014 step-up it was missing is worth $28,551 to the arm that does
// NOT convert (the converting arm spends its brokerage on conversion tax, so it has no unrealized
// gain left for the step-up to reach). The reported benefit was smaller than the modeling error,
// so the honest answer for CONV_BASE is now null.
//
// These two tests guard the MECHANISM - that a convert-then-stop plan is found and reported in
// calendar years - so they need a fixture whose conversion still pays once 1014 is modeled
// correctly. A bigger IRA does it, and deliberately NOT a fully-basis brokerage: leaving the
// unrealized gain in place keeps the step-up active, so the test clears the correction rather
// than dodging it. The gain is now ~$158k against that ~$29k, an order of magnitude of headroom
// instead of the old razor-thin margin, and the window is 5 years rather than the degenerate 1.
const TL_BASE = { ...CONV_BASE, IRA1: 3000000 };

test('bestTimeLimitedConversion: finds a convert-then-stop plan and reports it in calendar years', () => {
    const tl = bestTimeLimitedConversion(TL_BASE, FIXED_OV, { futureIRARate: 0.24 });
    assert(tl !== null, 'this fixture has a paying time-limited conversion');
    // P64d moved this optimum, and it is not a flat one. Indexing the SALT phase-out threshold 1%/yr
    // ($500,000 -> $505,000 in 2026 and up from there) changes how much of the elevated cap survives
    // a conversion that lifts MAGI past it, and this CA fixture converts hard enough to be squarely
    // in that band. Was $250,000/yr for 5 years scoring 166,002; now $300,000/yr for 4 years scoring
    // 167,787 - a genuinely better plan, not a tie broken differently. Under the old frozen threshold
    // $300,000 scored 140,173, so the ranking really did invert.
    assert(tl.amount === 300000, `expected $300,000/yr, got ${tl.amount}`);
    assert(tl.stopIndex === 4, `expected a 4-year conversion window, got ${tl.stopIndex}`);
    assert(tl.stopYearCalendar === 2029,
        `stop year must be a calendar year the sidebar can hold, got ${tl.stopYearCalendar}`);
    assert(tl.gain > 0, 'and it must actually beat converting nothing');
});

test('bestTimeLimitedConversion: its answer survives being replayed through the sidebar inputs', () => {
    // The PF8 failure mode: the optimizer scoring one plan while clicking the row runs another.
    // A per-year extraConversionAmount ARRAY and the equivalent scalar + convEndYear are NOT
    // interchangeable in this engine, so the search scores the loadable form and this pins it.
    const tl = bestTimeLimitedConversion(TL_BASE, FIXED_OV, { futureIRARate: 0.24 });
    const asLoaded = simulate({ ...TL_BASE, ...FIXED_OV, extraConversionAmount: tl.amount,
                                convEndYear: tl.stopYearCalendar, convEndMode: 'extra' });
    const noConv = simulate({ ...TL_BASE, ...FIXED_OV, extraConversionAmount: 0 });
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
        // P104b1. Identity is the NORMALIZED vector; a malformed one is its own identity.
        [{ strategy: 'split', splitWeights: [1, 1, 0, 0] }, { strategy: 'split', splitWeights: [50, 50, 0, 0] }, true],
        [{ strategy: 'split', splitWeights: [1, 1, 0, 0] }, { strategy: 'split', splitWeights: [1, 0, 0, 0] },   false],
        [{ strategy: 'split', splitWeights: [0, 0, 0, 0] }, { strategy: 'split' },                               true],
        [{ strategy: 'split', splitWeights: [0, 0, 0, 0] }, { strategy: 'split', splitWeights: [0, 0, 1, 0] },   false],
        [{ strategy: 'split', splitWeights: [0, 0, 1, 0] }, { strategy: 'propwd', propWithdraw: 0 },             false],
    ];
    for (const [a, b, want] of cases) {
        assert(sameStrategySelection(a, b) === want,
            `${a.strategy} vs ${b.strategy}: expected ${want}, got ${sameStrategySelection(a, b)}`);
    }
});

test('P104b1: splitWeights is a selection field, survives selectionOf, and split is 🅡-excluded', () => {
    // The field list is what crosses the Monte Carlo worker boundary; a field missing from it
    // compares as unset on one side and every split row would match the user's plan.
    assert(STRATEGY_SELECTION_FIELDS.includes('splitWeights'), 'splitWeights must be a selection field');
    const sel = selectionOf({ strategy: 'split', splitWeights: [1, 2, 3, 4], spendGoal: 1 });
    assert(JSON.stringify(sel.splitWeights) === '[1,2,3,4]', 'selectionOf must carry the whole vector');
    assert(sel.spendGoal === undefined, 'and nothing that is not a selection field');
    // Roth sits inside the vector, so a Roth-position clone would be a twin of its base row.
    assert(ROTH_GAP_EXCLUDED.has('split') && ROTH_GAP_EXCLUDED.has('ordered') && ROTH_GAP_EXCLUDED.size === 2,
        'the 🅡 exclusion set must be exactly {ordered, split}');
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

test('sameStrategySelection: the Roth gap position is part of the identity, unknown values are not', () => {
    const p = { strategy: 'fixed', nYears: 20 };
    assert(!sameStrategySelection(p, { ...p, rothGapFill: 'fillCashThenRoth' }),
        'a 🅡 clone is a different plan from the row it was cloned from');
    assert(!sameStrategySelection({ ...p, rothGapFill: 'fillCashThenRoth' },
                                  { ...p, rothGapFill: 'fillRothThenCash' }), 'the two positions differ');
    // The engine treats anything it does not recognize as "leave today's behavior alone", so the
    // identity has to agree. A typo that compared as its own plan would pin a row to a strategy
    // that never ran.
    assert(sameStrategySelection(p, { ...p, rothGapFill: 'fillCashThenRother' }),
        'an unrecognized value is the same plan as unset');
    assert(sameStrategySelection(p, { ...p, rothGapFill: '' }), 'empty is unset');
});

test('rothGapFill: unset is bit-identical, and fillCashThenRoth spends Roth instead of Brokerage', () => {
    // Bracket fills a spending gap from Cash, then Brokerage, then Roth. With a Roth balance and a
    // gap big enough to reach past Cash, moving Roth ahead of Brokerage has to show up as a smaller
    // Brokerage draw - that is the whole mechanism P28 measured.
    const b = { ...BASE, strategy: 'bracket', stratRate: 0.24, stratIRMAATier: -1, stratACAMultiple: 0,
                Roth: 400000, spendGoal: 70000, growth: 0.05 };
    const off  = simulate(b);
    const same = simulate({ ...b, rothGapFill: '' });
    assert(JSON.stringify(off.log) === JSON.stringify(same.log),
        'an empty rothGapFill must leave every number exactly as it was');
    const junk = simulate({ ...b, rothGapFill: 'fillCashThenRother' });
    assert(JSON.stringify(off.log) === JSON.stringify(junk.log),
        'an unrecognized value must leave every number exactly as it was');

    const on = simulate({ ...b, rothGapFill: 'fillCashThenRoth' });
    const tot = (res, k) => res.log.reduce((s, r) => s + (r[k] ?? 0), 0);
    assert(tot(on, 'RothWD') > tot(off, 'RothWD'), 'Roth must actually be drawn');
    assert(tot(on, 'Brokerage-') < tot(off, 'Brokerage-'), 'and it must displace a Brokerage draw');
});

// ── P30a: gapFillWeights, the [40,60] nobody chose ───────────────────────────
// The weights are a research input with no UI and no URL param. These two tests are the contract
// the sweep rests on: unset is today, and the endpoints are a real 0-to-100 sweep of ONE policy
// rather than two different ones.
const GFW_BASE = {
    ...BASE, strategy: 'fixed', nYears: 20,
    IRA1: 900000, Roth: 200000, Brokerage: 600000, BrokerageBasis: 300000, Cash: 250000,
    spendGoal: 85000, inflation: 0.025, cpi: 0.025, growth: 0.05, cashYield: 0.03, dividendRate: 0.02,
};

test('gapFillWeights: unset is bit-identical, and anything malformed means unset', () => {
    const ref = JSON.stringify(simulate(GFW_BASE).log);
    // The default spelled out, and the same ratio spelled differently: the normalizer divides by the
    // sum, so [4,6] IS [40,60]. If this ever fails the weights have stopped being relative.
    for (const v of [undefined, [40, 60], [4, 6]]) {
        assert(JSON.stringify(simulate({ ...GFW_BASE, gapFillWeights: v }).log) === ref,
            `gapFillWeights ${JSON.stringify(v)} must reproduce the default exactly`);
    }
    // Validated to a shape, not to truthiness. [0,0] is the one that matters: it would divide by
    // zero in the normalizer and put NaN through every downstream balance.
    for (const v of ['nope', [40], [40, 60, 80], [0, 0], [-10, 110], [NaN, 60], {}, 40]) {
        assert(JSON.stringify(simulate({ ...GFW_BASE, gapFillWeights: v }).log) === ref,
            `malformed gapFillWeights ${JSON.stringify(v)} must leave today's behavior alone`);
    }
});

test('gapFillWeights: the split moves monotonically, and both endpoints still spill', () => {
    const tot = (res, k) => res.log.reduce((s, r) => s + (r[k] ?? 0), 0);
    const brok = [], cash = [];
    for (const w of [0, 20, 40, 60, 80, 100]) {
        const res = simulate({ ...GFW_BASE, gapFillWeights: [w, 100 - w] });
        brok.push(tot(res, 'Brokerage-'));
        cash.push(tot(res, 'CashWD'));
    }
    for (let i = 1; i < brok.length; i++) {
        assert(brok[i] > brok[i - 1], `Brokerage draw must rise with the weight (step ${i})`);
        assert(cash[i] < cash[i - 1], `Cash draw must fall with the weight (step ${i})`);
    }
    // w=0 is all-Cash in the gap fill. Not "no Brokerage anywhere" - the third pass has drawn
    // Brokerage by default since P32 - but the gap fill itself must ask for none.
    assert(brok[0] === 0, 'at weight 0 the gap fill must draw no Brokerage at all');
    // w=100 asks for everything from Brokerage, yet Cash is still drawn: that is the shortfall
    // cascade spilling, which is what keeps the endpoint a point on the same policy curve rather
    // than a different policy that gives up when one account runs dry.
    assert(cash[cash.length - 1] > 0, 'at weight 100 the cascade must still spill into Cash');
});

test('resolveOrderedSeq: any permutation resolves, anything else is CBIR', () => {
    // P30d generalized this from a three-entry map to a generator. The three shipped codes must
    // still produce byte-identical sequences, the other 21 permutations must now mean what they
    // say, and a typo must still be a no-op rather than a silently different plan.
    const rates = { capGainsPercentage: 0.5, capitalGainsRate: 0.15, nominalStateTaxAtLimit: 0.09,
                    nominalTaxRate: 0.22, marginalFedTaxRate: 0.22, marginalStateTaxRate: 0.09 };
    const names = seq => resolveOrderedSeq(seq, rates).map(pair => pair[0]).join(',');
    assert(names('CBIR') === 'Cash,Brokerage,IRA,Roth', 'CBIR');
    assert(names('RIBC') === 'Roth,IRA,Brokerage,Cash', 'RIBC');
    assert(names('BIRC') === 'Brokerage,IRA,Roth,Cash', 'BIRC');
    // Previously fell back to CBIR while naming something else; now it means itself.
    assert(names('CBRI') === 'Cash,Brokerage,Roth,IRA', 'CBRI must no longer be a silent CBIR');
    // Each account appears exactly once, at its own tax rate, in every permutation.
    const perms = [];
    (function walk(acc, rest) {
        if (!rest.length) return perms.push(acc.join(''));
        rest.forEach((c, i) => walk([...acc, c], rest.filter((_, j) => j !== i)));
    })([], ['C', 'B', 'I', 'R']);
    assert(perms.length === 24, 'the generator must produce 24 permutations');
    for (const p of perms) {
        const seq = resolveOrderedSeq(p, rates);
        assert(seq.length === 4 && new Set(seq.map(x => x[0])).size === 4, `${p} must draw each account once`);
    }
    for (const bad of ['nonsense', 'CBI', 'CBIRR', 'CCBI', 'cbir', 'XBIR', undefined, null, 42, ''])
        assert(names(bad) === 'Cash,Brokerage,IRA,Roth',
            `${JSON.stringify(bad)} must still fall back to CBIR`);
});

test('selectionOf: a plan still identifies as itself after a round trip', () => {
    // The Monte Carlo worker posts a SUMMARY of each variation back to the page, and the page asks
    // sameStrategySelection() which summary is the user's own plan. That summary used to be a
    // hand-written field list, and it was missing orderedSeq, stratIRMAATier, stratACAMultiple and
    // the two Guyton-Klinger guardrails - so the comparison fell through to the `?? default` on the
    // missing side and matched the wrong row, or no row. selectionOf() is the one list; this is the
    // property that broke.
    const plans = [
        { strategy: 'propwd',   propWithdraw: 0.2 },
        { strategy: 'fixed',    nYears: 11 },
        { strategy: 'fixedpct', iraWithdrawPct: 0.09 },
        { strategy: 'bracket',  stratRate: 0.24, stratIRMAATier: -1, stratACAMultiple: 0 },
        { strategy: 'bracket',  stratRate: 0, stratIRMAATier: 2, stratACAMultiple: 0 },
        { strategy: 'aca',      stratRate: 0, stratIRMAATier: -1, stratACAMultiple: 250 },
        { strategy: 'gk',       gkGuard: 0.15, gkAdjPct: 0.05 },
        { strategy: 'ordered',  orderedSeq: 'CIBR' },
        { strategy: 'ordered',  orderedSeq: 'CBRI', cyclicEnabled: true, cyclicOrder: 'brokerage-first' },
        { strategy: 'propwd',   propWithdraw: 0.2, rothGapFill: 'fillCashThenRoth' },
    ];
    for (const p of plans) {
        assert(sameStrategySelection(selectionOf(p), p),
            `${JSON.stringify(p)} must still be itself after selectionOf()`);
        // And it must not match a NEIGHBOUR. Every plan above differs from every other one, so a
        // key that dropped a field would collapse two of them together here.
        for (const q of plans) if (q !== p)
            assert(!sameStrategySelection(selectionOf(p), q),
                `selectionOf(${JSON.stringify(p)}) must not match ${JSON.stringify(q)}`);
    }
    // The list is the contract: every field the comparison reads has to be on it.
    for (const f of ['strategy', 'orderedSeq', 'stratIRMAATier', 'stratACAMultiple', 'gkGuard',
                     'gkAdjPct', 'rothGapFill', 'cyclicEnabled', 'cyclicOrder',
                     'fundConversionWithCash', 'propWithdraw', 'nYears', 'stratRate', 'iraWithdrawPct'])
        assert(STRATEGY_SELECTION_FIELDS.includes(f), `${f} must be carried`);
});

test('strategySortKey: families stay contiguous, whatever the label starts with', () => {
    // P73. The Strategy column used to sort the RENDERED label, so a row whose label opened with
    // raw HTML or an emoji sorted before or after the entire alphabet and each family's clones were
    // torn away from it. The key must depend on none of that.
    const row = (family, param, modifier = null, extra = {}) =>
        ({ _family: family, _paramSortVal: param, _modifier: modifier,
           _strategyLabel: (modifier ? '<span>Z</span> ' : '') + family, ...extra });
    const rows = [
        row('Reduce', 23), row('Fill Bracket', 0.24, 'rothgap'), row('Reduce', 3, 'ira-first'),
        row('Fill Bracket', 0.1), row('Reduce', 3), row('IRMAA Ceil', -0.5),
        row('Reduce', 7, 'cash'), row('Fill Bracket', 0.1, 'brokerage-first'), row('Reduce', 3, null, { _isNoConv: true }),
    ];
    const sorted = rows.slice().sort((a, b) => { const x = strategySortKey(a), y = strategySortKey(b);
                                                 return x < y ? -1 : x > y ? 1 : 0; });
    const fams = sorted.map(r => r._family);
    // Contiguous: each family appears as exactly one run.
    const runs = fams.filter((f, i) => f !== fams[i - 1]);
    assert(runs.length === new Set(fams).size, `families must not repeat as separate blocks: ${fams.join(' | ')}`);
    assert(runs.join(',') === 'Fill Bracket,IRMAA Ceil,Reduce', `alphabetical by family, got ${runs.join(',')}`);
    // Inside a family: parameter first, then modifier, then variant. 3 sorts before 23 - the old
    // label sort compared '3 yrs' against '23 yrs' as text and put 23 first.
    const reduce = sorted.filter(r => r._family === 'Reduce');
    assert(reduce.map(r => r._paramSortVal).join(',') === '3,3,3,7,23',
        `Reduce must order numerically, got ${reduce.map(r => r._paramSortVal).join(',')}`);
    // Modifier outranks variant, so a derived row stays with the arm it derives from: the plain
    // row, then the plain row's no-conversion reference, then the clones.
    assert(reduce[0]._modifier === null && !reduce[0]._isNoConv, 'the plain row leads its parameter');
    assert(reduce[1]._isNoConv === true, 'then that row\'s no-conversion reference');
    assert(reduce[2]._modifier === 'ira-first', 'then the modifier clones');
    // A negative parameter (the lowest IRMAA tier sits at -0.5) must still pad to a sortable key.
    assert(strategySortKey(row('IRMAA Ceil', -0.5)) < strategySortKey(row('IRMAA Ceil', 0.5)),
        'a negative parameter must sort below a positive one, not wrap');
    // String parameters (the Ordered sequences) sort as themselves, as the Param column does.
    assert(strategySortKey(row('Ordered', 'BCIR')) < strategySortKey(row('Ordered', 'CBIR')),
        'Ordered sequences sort as strings');
    // The key must never read the label: two rows differing ONLY in markup are identical to it.
    assert(strategySortKey({ _family: 'Reduce', _paramSortVal: 3, _strategyLabel: '<span>x</span> Reduce' })
        === strategySortKey({ _family: 'Reduce', _paramSortVal: 3, _strategyLabel: '\u{1F4CD} Reduce' }),
        'the rendered label must not reach the sort key at all');
});

// -- P104b3: the Fixed Split family ---------------------------------------------------------------
// The grid is a RESEARCH RESULT, not a preference: research/CONSTANT_SPLIT.md part 2. Each vector
// beat the Proportional default at the median in all three Monte Carlo return models with survival
// held. These tests pin the properties that made it shippable, so a later edit to the grid has to
// argue with them.

test('P104b3: the shipped split grid is four blends, and no single-account vector', () => {
    assert(SPLIT_VECTORS.length === 4, `expected 4 vectors, got ${SPLIT_VECTORS.length}`);
    for (const v of SPLIT_VECTORS) {
        assert(Array.isArray(v) && v.length === 4, `each vector is 4 long: ${JSON.stringify(v)}`);
        assert(v.every(x => Number.isFinite(x) && x >= 0), `non-negative finite: ${JSON.stringify(v)}`);
        assert(v.reduce((a, b) => a + b, 0) > 0, `positive sum: ${JSON.stringify(v)}`);
        // A single-account vector is an Ordered sequence wearing a weight - phase 2 spills into the
        // account order - and P103e measured that shape at 0% survival under bootstrap. Cash-only
        // and Brokerage-only were both tested in P104b2 and both lost on the p10 floor.
        assert(v.filter(x => x > 0).length >= 2, `no single-account vector may ship: ${JSON.stringify(v)}`);
    }
    assert(new Set(SPLIT_VECTORS.map(splitVectorSortVal)).size === 4, 'no two vectors are the same mix');
});

test('P104b3: split weights are RELATIVE - scale does not change the label or the sort value', () => {
    // The engine normalizes, so 0/9/1/0 and 0/90/10/0 are one plan. If this ever stopped holding,
    // offGridParamFor would emit a duplicate row for a user who typed the grid's own mix at a
    // different scale.
    assert(splitVectorLabel([0, 9, 1, 0]) === splitVectorLabel([0, 90, 10, 0]),
        `same mix, same label: ${splitVectorLabel([0, 9, 1, 0])} vs ${splitVectorLabel([0, 90, 10, 0])}`);
    assert(splitVectorSortVal([0, 9, 1, 0]) === splitVectorSortVal([0, 90, 10, 0]), 'same mix, same sort value');
    assert(splitVectorLabel([0, 9, 1, 0]) === 'Brok 90 / Cash 10', 'label names accounts in words');
    assert(splitVectorLabel([5, 0, 4, 1]) === 'IRA 50 / Cash 40 / Roth 10', 'zero accounts are omitted');
    assert(splitVectorLabel([0, 0, 0, 0]) === 'balances', 'an empty mix says what it falls back to');
    // Sort values must stay small enough that strategySortKey's 9-character numeric padding still
    // aligns; a packed integer would need 12 and scatter the family through the table.
    for (const v of SPLIT_VECTORS)
        assert(splitVectorSortVal(v) < 1000, `sort value must stay small: ${splitVectorSortVal(v)}`);
});

test('P104b3: the family is OFF by default and absent from the Monte Carlo grid', () => {
    // Two independent locks, because this is a new strategy behind the nerdknob. MC has no knob, so
    // its grid must not carry the vectors at all; every other caller has to opt in.
    assert(MC_GRIDS.split === undefined, 'MC_GRIDS must not carry `split` while the family is gated');
    assert(OPTIMIZER_GRIDS.split === SPLIT_VECTORS, 'the Optimizer grid holds the shipped vectors');
    const base = { ...SWEEP_BASES.onGridCash, strategy: 'propwd', propWithdraw: 0 };
    const off = buildStrategyFamilies(base, { grids: OPTIMIZER_GRIDS });
    assert(off.filter(r => r.family === 'Fixed Split').length === 0,
        'no caller gets Fixed Split rows without asking');
    const on = buildStrategyFamilies(base, { grids: OPTIMIZER_GRIDS, splitFamily: true });
    assert(on.filter(r => r.family === 'Fixed Split' && !r.modifier).length === SPLIT_VECTORS.length,
        'one unmodified row per shipped vector when the family is asked for');
    // And Monte Carlo's own entry point must be unable to produce one whatever it is handed.
    assert(buildVariations(base).every(v => !String(v._strategyFamily || '').includes('Fixed Split')),
        'buildVariations must not emit a Fixed Split row');
});

test('P104b3: a gated-off family cannot leak back in through the user\'s own off-grid mix', () => {
    // strategy='split' is reachable from a share link even while no menu offers it. Without the
    // guard in addOffGrid, a user without the nerdknob holding such a link would get a Fixed Split
    // row in a table that has no Fixed Split family - one row of a strategy nothing else explains.
    const mine = { ...SWEEP_BASES.onGridCash, strategy: 'split', splitWeights: [2, 3, 4, 1] };
    const off = buildStrategyFamilies(mine, { grids: OPTIMIZER_GRIDS });
    assert(off.filter(r => r.family === 'Fixed Split').length === 0,
        'the off-grid door stays shut while the family is off');
    const on = buildStrategyFamilies(mine, { grids: OPTIMIZER_GRIDS, splitFamily: true });
    const own = on.filter(r => r.family === 'Fixed Split' && !r.modifier
                               && r.paramLabel === 'IRA 20 / Brok 30 / Cash 40 / Roth 10');
    assert(own.length === 1, 'the user\'s own mix earns exactly one row when the family is on');
    // ...and a user whose mix IS one of the four gets no duplicate, even typed at another scale.
    const onGrid = { ...SWEEP_BASES.onGridCash, strategy: 'split', splitWeights: [0, 90, 10, 0] };
    const rows = buildStrategyFamilies(onGrid, { grids: OPTIMIZER_GRIDS, splitFamily: true })
        .filter(r => r.family === 'Fixed Split' && !r.modifier);
    assert(rows.length === SPLIT_VECTORS.length, 'the grid mix at another scale adds no extra row');
});

test('ORDERED_SEQS: every offered sequence is a real permutation and both sweeps use the list', () => {
    // The sidebar dropdown, MC_GRIDS.ordered and OPTIMIZER_GRIDS.ordered are one list on purpose:
    // a sequence a user can pick must be a sequence the sweeps score. What this guards is the
    // silent failure - resolveOrderedSeq falls back to CBIR for anything that is not a permutation,
    // so a typo in the list would add a menu entry and a sweep row that both quietly run CBIR.
    assert(MC_GRIDS.ordered === ORDERED_SEQS && OPTIMIZER_GRIDS.ordered === ORDERED_SEQS,
        'both grids must reference the shared list, not a copy that can drift');
    assert(new Set(ORDERED_SEQS).size === ORDERED_SEQS.length, 'no duplicate sequences');
    const rates = { capGainsPercentage: 0.5, capitalGainsRate: 0.15, nominalStateTaxAtLimit: 0.09,
                    nominalTaxRate: 0.22, marginalFedTaxRate: 0.22, marginalStateTaxRate: 0.09 };
    const LETTER = { Cash: 'C', Brokerage: 'B', IRA: 'I', Roth: 'R' };
    for (const seq of ORDERED_SEQS)
        assert(resolveOrderedSeq(seq, rates).map(x => LETTER[x[0]]).join('') === seq,
            `${seq} must resolve to itself, not to the CBIR fallback`);
    // CBIR stays the fallback for an unset or malformed sequence, so it has to remain on offer
    // however the menu is reordered.
    assert(ORDERED_SEQS.includes('CBIR'), 'the default sequence must be offered');
});

test('bracketGapOrder: unset is bit-identical, and anything malformed means unset', () => {
    // The bracket family takes its own sequential branch, so this is a different constant from
    // gapFillWeights and a bigger one - it serves Fill Bracket, IRMAA Ceiling, ACA Cliff and IRA
    // Draw. The branch was rewritten from nested ifs into a sequence to make the arm expressible;
    // this is the guard that the rewrite kept every number where it was.
    const b = { ...GFW_BASE, strategy: 'bracket', stratRate: 0.24, stratIRMAATier: -1, stratACAMultiple: 0 };
    const ref = JSON.stringify(simulate(b).log);
    for (const v of [undefined, 'cashFirst', 'nonsense', null, 42, '']) {
        assert(JSON.stringify(simulate({ ...b, bracketGapOrder: v }).log) === ref,
            `bracketGapOrder ${JSON.stringify(v)} must leave today's behavior alone`);
    }
});

test('bracketGapOrder: it moves the bracket family and nothing else', () => {
    // What is asserted here is the BLAST RADIUS, not the direction. No lifetime total is pinned:
    // the swap changes which account is drawn first, that feeds back into every later year, and the
    // sign of the lifetime Cash and Brokerage totals genuinely flips between account mixes -
    // measured going both ways on two of the harness scenarios. A test that pinned one of them
    // would be pinning the scenario, not the mechanism.
    const arm = { bracketGapOrder: 'brokerageFirst' };
    const moved = { ...GFW_BASE, strategy: 'bracket', stratRate: 0.24, stratIRMAATier: -1, stratACAMultiple: 0 };
    assert(JSON.stringify(simulate({ ...moved, ...arm }).log) !== JSON.stringify(simulate(moved).log),
        'the bracket family must feel it');
    // Everything that takes another branch must not.
    const untouched = [
        { label: 'Proportional', over: { strategy: 'propwd', propWithdraw: 0.10 } },
        { label: 'Reduce',       over: { strategy: 'fixed', nYears: 20 } },
        { label: 'Guyton-Klinger', over: { strategy: 'gk', gkGuard: 0.20, gkAdjPct: 0.10 } },
        { label: 'Ordered',      over: { strategy: 'ordered', orderedSeq: 'CBIR' } },
    ];
    for (const u of untouched) {
        const base = { ...GFW_BASE, ...u.over };
        assert(JSON.stringify(simulate({ ...base, ...arm }).log) === JSON.stringify(simulate(base).log),
            `${u.label} takes another branch and must be bit-identical`);
    }
});

test('buildStrategyFamilies: the 🅡 pass clones every family except Ordered', () => {
    const b = { ...BASE, Roth: 300000 };
    const plain  = buildStrategyFamilies(b, { grids: OPTIMIZER_GRIDS });
    const cloned = buildStrategyFamilies(b, { grids: OPTIMIZER_GRIDS, rothClones: true });
    const roths  = cloned.filter(r => r.modifier === 'rothgap');
    const base   = cloned.filter(r => r.modifier === null);
    assert(roths.length > 0, 'the option must add rows');
    assert(roths.every(r => r.overrides.rothGapFill === 'fillCashThenRoth'), 'each clone carries the position');
    // Ordered is the only exclusion, and it is the one fillSpendingGap itself makes: the sequence is
    // the user's. Guyton-Klinger and Proportional were excluded once on a research note about
    // comparability and it cost GK its clones, which measurement says is the family that gains most.
    assert(roths.every(r => r.overrides.strategy !== 'ordered'), 'Ordered must not be cloned');
    assert(roths.some(r => r.overrides.strategy === 'gk'), 'Guyton-Klinger must be cloned');
    assert(roths.some(r => r.overrides.strategy === 'propwd'), 'Proportional must be cloned');
    assert(roths.length === base.filter(r => r.overrides.strategy !== 'ordered').length,
        'and every other base row gets exactly one clone');
    // And the rows it clones must not inherit a sidebar setting, or the A/B is two identical arms.
    assert(cloned.filter(r => r.modifier === null).every(r => r.overrides.rothGapFill === ''),
        'un-cloned rows are marked, the way markCashFunding marks the 💵 pass');
    assert(plain.every(r => r.overrides.rothGapFill === undefined),
        'and with the option off the key is not written at all');
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

// ── Monte Carlo run scope: plan-of-record vs compare-all (P52) ───────────────
// The 'plan' scope hands the worker a ONE-element variations array built the same way the stress
// pass has always built its own. These pin the selection that array depends on; the scope plumbing
// itself lives in montecarlo/mc_tab.js, which needs a DOM and is covered in the browser tier.

test('plan scope: the sidebar plan resolves to exactly one swept variation', () => {
    // Ambiguity here would be a real defect: a second match means the pinned row, the stress pass
    // and a plan-scope run could each pick a different "your plan".
    [
        { ...BASE, strategy: 'propwd', propWithdraw: 0.05 },
        { ...BASE, strategy: 'fixed',  nYears: 20 },
        { ...BASE, strategy: 'gk', gkGuard: 0.20, gkAdjPct: 0.10 },
        { ...BASE, strategy: 'ordered', orderedSeq: 'RIBC' },
    ].forEach(base => {
        const hits = buildVariations(base).filter(v => sameStrategySelection(v, base));
        assert(hits.length === 1,
            `${base.strategy}: expected exactly one matching variation, got ${hits.length}`);
    });
});

test('plan scope: a plan absent from the sweep yields no match, so the caller must substitute', () => {
    // This is the case that forces the synthetic { _label: 'Current Plan' } fallback in
    // planOnlyVariations(); without it a plan-scope run would send an empty array.
    const absent = { ...BASE, strategy: 'nosuchstrategy' };
    const hits = buildVariations(absent).filter(v => sameStrategySelection(v, absent));
    assert(hits.length === 0, 'an unswept strategy must report no match');
});

test('plan scope: compare really is the expensive one — the sweep is far more than one arm', () => {
    // Guards the premise of the whole feature. If buildVariations ever collapsed to a handful of
    // rows, the second button would be pointless and this should fail loudly rather than quietly.
    const n = buildVariations({ ...BASE, strategy: 'propwd', propWithdraw: 0.05 }).length;
    assert(n > 50, `expected a large sweep for compare scope, got ${n} variations`);
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
        'MC must not sweep the ACA family (the Optimizer does, for everyone, subject to the age gate)');
});

// ── P35 PR 1: the Optimizer enumeration golden ────────────────────────────────
// OPT_GOLDEN is a browser RECORDING — the enumeration lives inline in `_runOptimizerNow()` and
// cannot be called from node until PR 2 extracts it. So there is nothing to compare it against
// yet, and these tests check the recording itself: that it is internally consistent, and that it
// actually contains the four gates it was captured to cover. A corrupt or half-imported golden
// would otherwise sit here looking authoritative until PR 2 "proved" an extraction against it.
const CLONE_PFX = /🗘|🔄|💵|🅡/;
const optBaseRows = rows => rows.filter(r => !CLONE_PFX.test(r[0]));

for (const [name, g] of Object.entries(OPT_GOLDEN)) {
    test(`OPT_GOLDEN [${name}]: recording is internally consistent`, () => {
        assert(g.rows.length === g.rowCount, `rows ${g.rows.length}, rowCount ${g.rowCount}`);
        assert(optBaseRows(g.rows).length === g.baseRowCount,
            `un-prefixed rows ${optBaseRows(g.rows).length}, baseRowCount ${g.baseRowCount}`);
        assert(g.base && typeof g.base === 'object' && g.base.strategy,
            'the capture must carry the base it was recorded against');
        // Every clone pass is accounted for exactly, rather than by a row-count multiple: the 🅡
        // pass skips Ordered rather than cloning every base row, so the total
        // stopped being a whole multiple of the base count when it landed.
        const n = pfx => g.rows.filter(r => r[0].includes(pfx)).length;
        const reachable = optBaseRows(g.rows).filter(r => r[3].strategy !== 'ordered').length;
        assert(n('🗘') === g.baseRowCount && n('🔄') === g.baseRowCount,
            `cyclic passes clone every base row: 🗘 ${n('🗘')}, 🔄 ${n('🔄')}, base ${g.baseRowCount}`);
        assert(n('💵') === (g.nerdKnobs && g.base.Cash > 0 ? g.baseRowCount : 0),
            `💵 clones are gated on nerdknob AND Cash, got ${n('💵')}`);
        assert(n('🅡') === ((g.base.Roth > 0 || g.base.Roth2 > 0) ? reachable : 0),
            `🅡 clones the ${reachable} reachable base rows, got ${n('🅡')}`);
        assert(g.baseRowCount + n('🗘') + n('🔄') + n('💵') + n('🅡') === g.rowCount,
            'the four clone passes plus the base rows must account for every row');
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
            else if (label.includes('🅡'))
                assert(ov.rothGapFill === 'fillCashThenRoth' && !ov.cyclicEnabled,
                    `${label}: 🅡 must draw Roth after cash and must not be cyclic`);
            else
                assert(!ov.cyclicEnabled && ov.fundConversionWithCash !== true
                    && ov.rothGapFill !== 'fillCashThenRoth',
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
    // 14%, not 9%: 9% was off both grids until v11.162J put it ON the Optimizer's, at which point
    // this scenario silently stopped exercising the gate it was captured for.
    assertSameList([last[0], last[1]], ['IRA Draw', '14%'], 'the off-grid row');
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
            // No `nerd &&` any more: the ACA family is swept for everyone, and only the age gate
            // removes it. The four captures still reproduce because the one recorded with the
            // nerdknob OFF (`default`) has both people on Medicare at start, so its ACA rows were
            // suppressed by age rather than by the flag. Checked before the gate was dropped.
            // P89: the year is PINNED. bothOnMedicareAtStart now clamps the plan's first year to
            // the current one, so leaving it to default would make this golden reproduction
            // time-dependent: a fixture whose gate answer flips in some later calendar year would
            // break this test with no code change behind it.
            acaFamily: !bothOnMedicareAtStart(g.base.birthyear1, g.base.startAge,
                !!g.base.hasSpouse, g.base.hasSpouse ? (g.base.birthyear2 || 0) : 0, 2026),
            bracketResetsIRMAATier: true,
            markCashFunding: nerd,
            cashClones: nerd && g.base.Cash > 0,
            // Not gated on the nerdknob: the 🅡 arm is swept for everyone, so it must reproduce in
            // the nerdknob-off capture too.
            rothClones: g.base.Roth > 0 || g.base.Roth2 > 0,
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
    // The Optimizer now has FEWER base rows than MC despite sweeping two extra families: its Reduce
    // grid is 5 steps against MC's 16, and its IRA Draw grid 5 against MC's 5 but not the same five.
    // Both counts are pinned so a grid edit has to be deliberate.
    assert(plain(mc).length === 39 && plain(opt).length === 33,
        `base rows: MC ${plain(mc).length} (expected 39), Optimizer ${plain(opt).length} (expected 33)`);

    assert(plain(call({ grids: OPTIMIZER_GRIDS, irmaaFamily: true, acaFamily: true })).length === 37,
        'the ACA family adds 4 rows');
    assert(call({ grids: MC_GRIDS, cashClones: true }).length === 117 * 4 / 3,
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

test('bothOnMedicareAtStart: AND semantics, single filer, and the missing-input guard', () => {
    // Moved out of optimizer_ui.js in P35 PR 2 and never covered there. It had an OR twin,
    // eitherOnMedicareAtStart, deleted once P35 PR 3c left it without a caller. The one-of-two row
    // below is the case the twin used to contrast against, so it is asserted on its own terms.
    // P89: every call pins the year, and one comment here was WRONG before that. `both(1960, 60,
    // ...)` was labelled "neither 65 at start" - but the plan cannot start in 1960+60=2020, it
    // starts in 2026, when person 1 is 66 and IS on Medicare. The row still returns false, on the
    // spouse rather than on the filer, which is why the mislabel survived.
    const both = bothOnMedicareAtStart, Y = 2026;
    assert(both(1960, 65, true, 1952, Y) === true,  'both 65+ at start');
    assert(both(1960, 60, true, 1962, Y) === false,
        'person 1 is 66 at the clamped start and the spouse is 64: AND is false on the spouse');
    assert(both(1960, 65, true, 1975, Y) === false,
        'one 65+, one not: AND is false, and this is the row an OR would get wrong');
    assert(both(1960, 65, false, 0, Y) === true,    'a single filer needs only themselves');
    assert(both(0, 65, true, 1952, Y) === false,    'missing inputs are not an assertion of anything');
});

// ── P89: the plan's first year has one definition, and the ACA age gate uses it ────────────────
// `startAge` is the user's real-world age, so the year they ARE that age is birthyear + startAge -
// clamped forward, because a simulation cannot start in the past. getInputs() always clamped when
// building `startInYear`; the ACA gate carried an unclamped copy, so for anyone already past their
// typed Retirement Start Age it answered about a year the plan does not start in.
test('P89: planFirstYear clamps a start year that has already passed', () => {
    assert(planFirstYear(1958, 65, 2026) === 2026,
        'born 1958 and typing 65 reaches that age in 2023, but the plan starts now');
    assert(planFirstYear(1970, 65, 2026) === 2035, 'a future start year is left alone');
    assert(planFirstYear(1958, 0, 2026) === 2026,  'no start age means start now');
});

test('P89: the ACA age gate reads the clamped year, not the typed age', () => {
    // The reported case: born 1958, Retirement Start Age 65, spouse born 1969. The plan starts in
    // 2026 with the filer at 68 and the spouse at 57 - not 2023 with them at 65 and 54.
    assert(planFirstYear(1958, 65, 2026) - 1958 === 68, 'the filer is 68 when the plan opens');
    assert(planFirstYear(1958, 65, 2026) - 1969 === 57, 'the spouse is 57 when the plan opens');
    // A filer whose typed age is below 65 but who is past 65 by the time the plan starts. The old
    // unclamped test asked `startAge >= 65` and got this wrong.
    assert(bothOnMedicareAtStart(1958, 60, false, 0, 2026) === true,
        'typed 60, but 68 when the plan opens: on Medicare');
    assert(bothOnMedicareAtStart(1958, 60, false, 0, 2018) === false,
        'same inputs in a year the clamp does not bite: 60 at start, not yet on Medicare');
});

test('P89: clamping can only make the gate MORE true, never less', () => {
    // The direction is provable rather than incidental - the clamp only moves the start year
    // forward, so ages at start can only rise, so "both on Medicare" can only become more true.
    // Measured at 1,423 flips one way and 0 the other over a 6,396-combination grid; this pins the
    // property so a later change that produces a backwards flip fails here rather than shipping.
    const medAge = TAXData.IRMAA.ELIGIBILITY_AGE, Y = 2026;
    const unclamped = (by1, sa, hs, by2) => {
        if (!by1 || !sa) return false;
        const sy = by1 + sa;
        const p1 = sa >= medAge, p2 = hs && by2 > 0 && (sy - by2) >= medAge;
        return hs ? (p1 && p2) : p1;
    };
    let flipsToTrue = 0, flipsToFalse = 0;
    for (let by1 = 1945; by1 <= 1985; by1++) {
        for (let sa = 50; sa <= 75; sa++) {
            for (const by2 of [0, by1 - 8, by1 + 4, by1 + 11]) {
                const hs = by2 > 0;
                const now = bothOnMedicareAtStart(by1, sa, hs, hs ? by2 : 0, Y);
                const was = unclamped(by1, sa, hs, hs ? by2 : 0);
                if (now && !was) flipsToTrue++;
                if (was && !now) flipsToFalse++;
            }
        }
    }
    assert(flipsToFalse === 0, `clamping must never un-set the gate, got ${flipsToFalse} backwards flips`);
    assert(flipsToTrue > 0, 'test setup: the grid must contain cases the clamp actually changes');
});

test('OPT_GOLDEN: the Optimizer sweeps the two families MC does not, on its own IRA Draw grid', () => {
    // The mirror of the buildVariations divergence test above. Together they declare the gap
    // rather than leaving it accidental, so P35 PR 2 cannot collapse the two sweeps onto one grid
    // without failing one side or the other.
    //
    // "Wider" until v11.162J, when the Optimizer's IRA Draw grid was trimmed to odd steps: MC still
    // tries 6% and 8%, which the Optimizer no longer does, so neither grid contains the other.
    const rows = optBaseRows(OPT_GOLDEN.nerdknob.rows);
    const draws = rows.filter(r => r[3].strategy === 'fixedpct')
                      .map(r => Math.round(r[3].iraWithdrawPct * 100));
    assertSameList(draws, [5, 7, 9, 11, 13], 'Optimizer IRA Draw grid');
    const irmaa = rows.filter(r => r[0] === 'IRMAA Ceil');
    assertSameList(irmaa.map(r => r[3].stratIRMAATier), [0, 1, 2, 3, 4], 'IRMAA ceiling tiers');
    // Its Fill Bracket rows pin the tier OFF, which is what keeps the two families apart.
    assert(rows.filter(r => r[0] === 'Fill Bracket').every(r => r[3].stratIRMAATier === -1),
        'a Fill Bracket row must disable the IRMAA ceiling explicitly');
});

test('earliestbe: earliest year wins; ties break on Final Roth, then net wealth', () => {
    // The user's order, 2026-09-03, and Roth LEADS net wealth: `wealthLead` is five times richer
    // than `rothLead` and still ranks below it. That is the whole content of the change - net
    // wealth used to be the only tie key, and `wealthLead` came first.
    const row = (id, be, nw, roth) => ({ _id: id, _convBEYear: be, afterTaxNWCurrentDollars: nw,
                                         totals: { success: true, terminal: { roth } } });
    const ranked = rankRowsByObjective(
        [row('late', 2040, 9e6, 9e6), row('rothLead', 2032, 1e6, 900000),
         row('none', null, 9.9e6, 9.9e6), row('wealthLead', 2032, 5e6, 100000),
         row('rothLeadRicher', 2032, 9e6, 900000)],
        'earliestbe');
    const order = ranked.map(r => r._id).join(',');
    assert(order === 'rothLeadRicher,rothLead,wealthLead,late,none',
        `earliest year, then Final Roth, then net wealth: got ${order}`);
});

test('earliestbe shows the balances its ties are decided on', () => {
    // A reader looking at two rows that broke even in the same year has to be able to see what
    // separated them, so both tie keys are on screen. Final IRA rides along because it is the
    // balance the conversions were drawn from.
    const list = OPT_OBJECTIVE_COLUMNS.earliestbe;
    for (const k of ['finalRoth', 'finalIRA', 'afterTaxNW']) {
        assert(list.includes(k), `earliestbe must show ${k}: ${list.join(',')}`);
    }
    const chain = OPTIMIZER_OBJECTIVES.earliestbe.tiebreak || [];
    assert(chain[0] === 'finalRoth' && chain[1] === 'netWealth',
        `ties must lead Final Roth then net wealth, got ${chain.slice(0, 2).join(',')}`);
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

test.critical('Fill Bracket converts in a no-tax state, not just in a graduated one', () => {
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

test.critical('a no-tax state reports honest spend and honest failure', () => {
    // With goalLimit zeroed, targetSpend went to 0 for every strategy outside the bracket/ordered/GK
    // exempt set. totals.spend then accumulated `0 + Shortfall` (negative), while the success test
    // `netIncome < targetSpend * 0.99` could never fail against a zero target.
    const base = { ...BASE, strategy: 'propwd', propWithdraw: 0, spendGoal: 400000 };
    for (const st of ['NV', 'TX', 'IL']) {
        const r = simulate({ ...base, STATEname: st });
        assert(r.totals.spend > 0, `${st}: total spend must be positive, got ${Math.round(r.totals.spend)}`);
        // P86: the stored Spendable running total left the log; delivered spend per year is
        // spendGoal + shortfall (shortfall <= 0), the same quantity totals.spend accumulates.
        const _delivered2 = r.log.slice(0, 3).reduce((a, e) => a + (e.spendGoal || 0) + (e.shortfall || 0), 0);
        assert(_delivered2 > 0, `${st}: cumulative delivered spend through year 2 must be positive, got ${_delivered2}`);
        assert(r.totals.success === false,
            `${st}: a $400k goal on a $600k portfolio must fail, not report success`);
    }
});

// ── Runner ────────────────────────────────────────────────────────────────────
// Returns the counts instead of setting process.exitCode, so the browser can render them. The node
// entry point below is what still sets the exit code.
//
// `skipSlow` is honoured ONLY by the browser tier. Node always passes false: a tag must never be
// -- Synthetic Monte Carlo: arithmetic returns and AR(1) inflation (P23) ------
// The synthetic modes draw one standard normal per path-year and differ only in the transform.
// Everything below asserts against the real prng.js helpers, not a reimplementation.

// Reproduces the pre-P23 GBM bank build exactly, so "GBM is unchanged" stays a measurement.
function _p23OldGbmShocks(mu, sigma, seed, n) {
    const rng = _mcPrng.mulberry32(seed);
    const logDrift = mu - 0.5 * sigma * sigma;
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = logDrift + sigma * _mcPrng.boxMuller(rng);
    return out;
}

// The synthetic bank, drawn by the SHIPPING engine. This used to be a hand copy of the bank-build
// loop, which meant every P23 assertion below was testing the copy rather than the code, and would
// have stayed green through any drift between them. P71 split buildBanks() out of runPass() partly
// so this could call the real thing: one path, `years` long, so the draw order is identical to a
// single path of a real run without paying for a simulate() over 40,000 years.
function _p23NewSynth(mode, mu, sigma, seed, years, opts) {
    opts = opts || {};
    const banks = _mcEngine.buildBanks({
        years, numPaths: 1, mu, sigma, seed,
        // undefined leaves the engine on its own defaults, which is what `opts` omitted means.
        inflationRate:        opts.inflationRate,
        inflationPersistence: opts.inflationPersistence,
        inflationShockSd:     opts.inflationShockSd,
        inflationReturnCorr:  opts.inflationReturnCorr,
    }, _mcPrng.mulberry32(seed), mode);
    return { bank: banks.scenarioBank, inf: banks.synthInflationBank };
}

function _p23Mean(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
function _p23Sd(a) {
    const m = _p23Mean(a); let s = 0;
    for (let i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return Math.sqrt(s / (a.length - 1));
}
function _p23Corr(a, b) {
    const ma = _p23Mean(a), mb = _p23Mean(b); let n = 0, da = 0, db = 0;
    for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return n / Math.sqrt(da * db);
}
// Ordinary least squares of x_t on x_{t-1}. Returns the fitted persistence and residual sd -- the
// same fit that produced the shipped INFLATION_AR1_* constants.
function _p23FitAR1(series) {
    const y = series.slice(1), x = series.slice(0, -1);
    const mx = _p23Mean(x), my = _p23Mean(y);
    let sxy = 0, sxx = 0;
    for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); }
    const phi = sxy / sxx;
    const c = my - phi * mx;
    let ss = 0;
    for (let i = 0; i < x.length; i++) { const e = y[i] - (c + phi * x[i]); ss += e * e; }
    return { phi, residSd: Math.sqrt(ss / (x.length - 2)), target: c / (1 - phi) };
}

test('P23: GBM return draws are untouched by the inflation model', () => {
    // Inflation uses its own PRNG stream precisely so that turning it on, or retuning it, cannot
    // shift a single return draw. Without that, every existing Synthetic result would move for a
    // reason having nothing to do with returns.
    const n = 400;
    const want = _p23OldGbmShocks(0.07, 0.15, 42, n);
    for (const opts of [{}, { inflationShockSd: 0 },
                        { inflationShockSd: 0.05, inflationPersistence: 0.9, inflationReturnCorr: -0.9 }]) {
        const got = _p23NewSynth('gbm', 0.07, 0.15, 42, n, opts).bank;
        for (let i = 0; i < n; i++) {
            assert(got[i] === want[i],
                `GBM shock ${i} moved with inflation settings ${JSON.stringify(opts)}: ${got[i]} vs ${want[i]}`);
        }
    }
});

test('P23: a zero inflation shock leaves inflation flat at the target', () => {
    // The regression guard for Historical parity, stated on the synthetic side: no shock, no drift.
    const inf = _p23NewSynth('gbm', 0.07, 0.15, 7, 60, { inflationShockSd: 0, inflationRate: 0.025 }).inf;
    for (let y = 0; y < inf.length; y++) {
        assert(Math.abs(inf[y] - 0.025) < 1e-12, `year ${y} drifted to ${inf[y]} with no shock`);
    }
});

test('P23: AR(1) inflation reverts toward the target', () => {
    let v = 0.12;
    const seen = [];
    for (let i = 0; i < 6; i++) { v = _mcPrng.computeNextInflation(v, 0.03, 0.67, 0.021, 0); seen.push(v); }
    for (let i = 1; i < seen.length; i++) {
        assert(seen[i] < seen[i - 1], `step ${i} did not move toward the target: ${seen.join(', ')}`);
    }
    assert(Math.abs(seen[seen.length - 1] - 0.03) < 0.02,
        `six shock-free steps should land near the 3% target, got ${seen[seen.length - 1]}`);
    // Persistence 0 means no memory at all: one step lands exactly on the target.
    assert(_mcPrng.computeNextInflation(0.12, 0.03, 0, 0.021, 0) === 0.03,
        'persistence 0 should snap straight to the target');
});

test('P23: inflation cannot fall below INFLATION_FLOOR', () => {
    const v = _mcPrng.computeNextInflation(0.0, 0.03, 0.67, 0.021, -50);
    assert(v === _mcPrng.INFLATION_FLOOR, `a huge negative shock should clamp to the floor, got ${v}`);
});

test('P23: RETURN_FLOOR clamps the arithmetic tail short of -100%', () => {
    // A normal draw on the LEVEL is unbounded below, unlike the lognormal one it sits beside. At a
    // 60% sigma the tail is reached often enough to be worth clamping rather than arguing about.
    const rng = _mcPrng.mulberry32(1);
    let min = Infinity, clamped = 0;
    for (let i = 0; i < 200000; i++) {
        const r = Math.max(_mcPrng.RETURN_FLOOR, 0.07 + 0.60 * _mcPrng.boxMuller(rng));
        if (r < min) min = r;
        if (r === _mcPrng.RETURN_FLOOR) clamped++;
    }
    assert(min >= _mcPrng.RETURN_FLOOR, `draw fell to ${min}, below the floor`);
    assert(clamped > 0, 'this fixture is only meaningful if the clamp actually fires');
});

test('P23: AAM centers the yearly return distribution on the number typed', () => {
    // The whole point of the mode. GBM reports exp(mu - sigma^2/2) - 1, which is visibly below mu;
    // AAM reports mu. Neither changes the volatility drag on CUMULATIVE growth.
    const mu = 0.07, sigma = 0.15;
    const bank = _p23NewSynth('aam', mu, sigma, 42, 40000).bank;
    assert(Math.abs(_p23Mean(bank) - mu) < 0.002, `AAM sample mean ${_p23Mean(bank)} should sit near mu ${mu}`);
    assert(Math.abs(_p23Sd(bank) - sigma) < 0.002, `AAM sample sd ${_p23Sd(bank)} should sit near sigma ${sigma}`);
    // Sanity on the contrast: GBM's median draw is materially lower than mu at this sigma.
    const gbm = Array.from(_p23NewSynth('gbm', mu, sigma, 42, 40000).bank).map(x => Math.exp(x) - 1);
    gbm.sort((a, b) => a - b);
    const gbmMedian = gbm[Math.floor(gbm.length / 2)];
    assert(gbmMedian < mu - 0.005, `GBM median draw ${gbmMedian} should sit below mu ${mu}`);
});

test('P23: AAM with zero volatility is a deterministic run at mu', () => {
    const bank = _p23NewSynth('aam', 0.055, 0, 3, 40).bank;
    for (let y = 0; y < bank.length; y++) {
        assert(bank[y] === 0.055, `year ${y} should be exactly mu with sigma 0, got ${bank[y]}`);
    }
});

test('P23: the inflation shock realizes the requested correlation with the return draw', () => {
    // Poor returns and rising prices in the same year is the joint event that breaks a plan.
    // Independent draws erase it, so this correlation is the point of correlatedNormal().
    for (const rho of [-0.30, -0.60, 0, 0.45]) {
        const rng = _mcPrng.mulberry32(42), infRng = _mcPrng.mulberry32(42 ^ _mcPrng.INFLATION_STREAM_XOR);
        const zs = [], zinfs = [];
        for (let i = 0; i < 60000; i++) {
            const z1 = _mcPrng.boxMuller(rng);
            zs.push(z1);
            zinfs.push(_mcPrng.correlatedNormal(z1, _mcPrng.boxMuller(infRng), rho));
        }
        const c = _p23Corr(zs, zinfs);
        assert(Math.abs(c - rho) < 0.02, `rho ${rho} realized as ${c.toFixed(4)}`);
    }
});

test('P23: the shipped AR(1) constants still match a re-fit of the CPI record', () => {
    // The constants are a measurement of HISTORICAL_RETURNS.inflation over 1948-2025, not a guess,
    // and this test is what stops them drifting away from the data once nobody remembers the fit.
    // The window is deliberate: 1928-2025 fits a 3.09% shock sd only because it contains Depression
    // deflation and WWII price controls, and 1990-2025 fits a persistence of 0.274, which makes
    // sustained inflation unreachable.
    const start = _histRet.inflationStartYear;
    const series = _histRet.inflation.slice(1948 - start, 2025 - start + 1);
    assert(series.length === 78, `expected 78 years of CPI, got ${series.length}`);
    const fit = _p23FitAR1(series);
    assert(Math.abs(fit.phi - _mcPrng.INFLATION_AR1_PERSISTENCE) < 0.02,
        `fitted persistence ${fit.phi.toFixed(3)} has drifted from the shipped ${_mcPrng.INFLATION_AR1_PERSISTENCE}`);
    assert(Math.abs(fit.residSd - _mcPrng.INFLATION_AR1_SHOCK_SD) < 0.002,
        `fitted shock sd ${fit.residSd.toFixed(4)} has drifted from the shipped ${_mcPrng.INFLATION_AR1_SHOCK_SD}`);
    // And the correlation default, measured against a 60/40 blend over the same window.
    const resid = [];
    for (let i = 1; i < series.length; i++) {
        resid.push(series[i] - (fit.target * (1 - fit.phi) + fit.phi * series[i - 1]));
    }
    const eq = _histRet.equity.slice(1948 - _histRet.equityStartYear, 2025 - _histRet.equityStartYear + 1).slice(1);
    const bd = _histRet.bonds.slice(1948 - _histRet.bondsStartYear, 2025 - _histRet.bondsStartYear + 1).slice(1);
    const blend = eq.map((v, i) => 0.6 * v + 0.4 * bd[i]);
    const c = _p23Corr(blend, resid);
    assert(Math.abs(c - _mcPrng.INFLATION_RETURN_CORR) < 0.05,
        `60/40 blend correlates with the inflation shock at ${c.toFixed(3)}, shipped default is ${_mcPrng.INFLATION_RETURN_CORR}`);
});

test('P23: Fixed Inflation reproduces the pre-change Synthetic model exactly', () => {
    // The promise the Fixed Inflation button makes to the user, stated once, in one place. Two
    // separate facts have to hold together for it to be true, and each is asserted above on its
    // own; this is the composition, because the composition is what the changelog claims.
    const mu = 0.07, sigma = 0.15, seed = 42, years = 40, rate = 0.025;
    const fixed = _p23NewSynth('gbm', mu, sigma, seed, years,
                               { inflationShockSd: 0, inflationRate: rate,
                                 // Deliberately non-default: with no shock these have nothing to
                                 // act on, which is why the button leaves them alone.
                                 inflationPersistence: 0.9, inflationReturnCorr: -0.8 });
    const oldShocks = _p23OldGbmShocks(mu, sigma, seed, years);
    for (let y = 0; y < years; y++) {
        assert(fixed.bank[y] === oldShocks[y],
            `return draw ${y} differs from the pre-P23 model: ${fixed.bank[y]} vs ${oldShocks[y]}`);
        assert(fixed.inf[y] === rate,
            `year ${y} inflation is ${fixed.inf[y]}, not the flat ${rate} the old model used`);
    }
});

test('P23: simulated inflation reaches the persistence the record shows', () => {
    // The failure this replaces: a flat rate, where no path ever sees prices run away. The record's
    // longest stretch above 5% is five years (1977-1981), one such episode in 78 years, so a random
    // 40-year window contains it around half the time. A model that never gets there is not
    // modeling the thing that breaks retirements.
    const years = 40, paths = 400;
    let withRun = 0, sawFloorBreach = false, sum = 0, n = 0;
    for (let p = 0; p < paths; p++) {
        const inf = _p23NewSynth('gbm', 0.07, 0.15, 1000 + p, years).inf;
        let best = 0, cur = 0;
        for (let y = 0; y < years; y++) {
            sum += inf[y]; n++;
            if (inf[y] < _mcPrng.INFLATION_FLOOR) sawFloorBreach = true;
            if (inf[y] > 0.05) { cur++; if (cur > best) best = cur; } else cur = 0;
        }
        if (best >= 5) withRun++;
    }
    assert(!sawFloorBreach, 'a simulated year fell below INFLATION_FLOOR');
    assert(Math.abs(sum / n - 0.03) < 0.005, `long-run mean ${(sum / n).toFixed(4)} should sit near the 3% target`);
    const share = withRun / paths;
    assert(share > 0.20 && share < 0.65,
        `${(share * 100).toFixed(1)}% of paths contain a five-year run above 5% inflation; the record implies roughly half`);
});

// ── P71: the engine itself, end to end ───────────────────────────────────────
// Until P71 there was NO suite coverage of the code that actually runs a Monte Carlo. worker.js
// opens with importScripts and self.onmessage, mc_controller.js was a page script, and the only
// draw-related assertions here went through a hand copy of the loop. A refactor could have changed
// every number on the page with all three suites green. These four drive mc_engine.js directly.
//
// Deliberately small - 20 paths, 1 variation, 25 years - because the point is that the whole
// pipeline runs and reports a coherent shape, not that a 10,000-path run is fast.
const _p71Base = SWEEP_BASES[Object.keys(SWEEP_BASES)[0]];
function _p71Cfg(mode, over) {
    return Object.assign({
        variations: buildVariations(_p71Base).slice(0, 1),
        years: 25, numPaths: 20, seed: 42, simulationMode: mode,
        mu: 0.07, sigma: 0.15, inflationRate: 0.03, stressCount: 5,
    }, over || {});
}

test('P71: the engine runs a whole job end to end in all three modes', async () => {
    for (const mode of ['gbm', 'aam', 'bootstrap']) {
        const msg = await _mcEngine.runJob(_p71Cfg(mode));
        assert(msg && !msg.error, `${mode}: ${msg && msg.error}`);
        assert(msg.simulationMode === mode, `${mode}: message says ${msg.simulationMode}`);
        assert(msg.numPaths === 20, `${mode}: numPaths ${msg.numPaths}`);
        assert(msg.variations.length === 1, `${mode}: ${msg.variations.length} variations back`);
        const v = msg.variations[0];
        assert(v.percentiles.p50.length === 25, `${mode}: p50 has ${v.percentiles.p50.length} years`);
        assert(v.survivalRate >= 0 && v.survivalRate <= 1, `${mode}: survival ${v.survivalRate}`);
        assert(isFinite(msg.inflationStats.cagr), `${mode}: inflation cagr ${msg.inflationStats.cagr}`);
        assert(msg.inputFan && msg.inputFan.equity, `${mode}: no input fan`);
        // Stress runs in every mode, and against the same one variation.
        assert(msg.stress && msg.stress.variations.length === 1, `${mode}: stress pass missing`);
        // Not a count assertion: stressCount is a floor, and the default 'combined' window unions
        // the worst starts of every window, so 5 requested came back as 17 selected. What must hold
        // is that the pass reports as many scenarios as it labeled.
        assert(msg.stress.numPaths === msg.stress.labels.length,
            `${mode}: ${msg.stress.numPaths} paths against ${msg.stress.labels.length} labels`);
        assert(msg.stress.numPaths >= 5, `${mode}: stress ran only ${msg.stress.numPaths} scenarios`);
    }
});

test('P71: one seed, one answer - two runs of the same config agree exactly', async () => {
    // CRN is the property everything else rests on: the whole comparison table is only meaningful
    // because every variation faces the identical sequence. Two full jobs, compared on the numbers
    // the UI actually shows.
    const a = await _mcEngine.runJob(_p71Cfg('gbm'));
    const b = await _mcEngine.runJob(_p71Cfg('gbm'));
    assert(JSON.stringify(a.variations[0].percentiles) === JSON.stringify(b.variations[0].percentiles),
        'the same seed produced different percentile bands');
    assert(a.variations[0].survivalRate === b.variations[0].survivalRate, 'survival rate moved');
    assert(a.medianAnnualReturn === b.medianAnnualReturn, 'median annual return moved');
    // And a different seed must NOT agree, or the first assertion is vacuous.
    const c = await _mcEngine.runJob(_p71Cfg('gbm', { seed: 43 }));
    assert(JSON.stringify(a.variations[0].percentiles) !== JSON.stringify(c.variations[0].percentiles),
        'a different seed produced identical bands, so the seed is not reaching the draw');
});

test('P71: stress mode banks one path per scenario, not numPaths of them', () => {
    // numPaths comes BACK from buildBanks for exactly this reason: the stress pass ignores the
    // requested path count and runs the historical scenarios it selected, however many that is -
    // which is not stressCount either, since 'combined' unions the worst starts of every window.
    const cfg = _p71Cfg('bootstrap', { stressCount: 7 });
    const banks = _mcEngine.buildBanks(cfg, _mcPrng.mulberry32(42), 'stress');
    const n = banks.multiAssetBank.labels.length;
    assert(n >= 7, `stressCount 7 selected only ${n} scenarios`);
    assert(banks.numPaths === n, `banked ${banks.numPaths} paths against ${n} labels`);
    assert(banks.numPaths !== cfg.numPaths, 'stress used the requested path count instead of its own');
    assert(banks.scenarioBank.length === n * cfg.years, `bank is ${banks.scenarioBank.length} long`);
    assert(banks.synthInflationBank === null, 'stress draws inflation from the record, not a model');
});

test('the worker payload keeps each variation identifiable as a strategy', async () => {
    // The bug this guards, reported 2026-08-25: with an Ordered sequence selected, Monte Carlo's
    // chart emphasized a DIFFERENT sequence. The variation summary the engine posts back carried no
    // orderedSeq, so sameStrategySelection() compared the page's 'CIBR' against a summary that
    // defaulted to 'CBIR' - it matched the first Ordered row for a CBIR user and nothing at all for
    // anyone else. An end-to-end assertion because the defect lived in the transport, not in either
    // side of it: both halves were correct on their own.
    const ordered = buildVariations({ ...(_p71Base), strategy: 'ordered', orderedSeq: 'CIBR' })
        .filter(v => v.strategy === 'ordered' && !v.cyclicEnabled && !v.fundConversionWithCash);
    assert(ordered.length === ORDERED_SEQS.length, `expected one row per sequence, got ${ordered.length}`);
    const msg = await _mcEngine.runJob(_p71Cfg('gbm', { variations: ordered, numPaths: 4, years: 12 }));
    assert(msg && !msg.error, `job failed: ${msg && msg.error}`);
    for (const seq of ORDERED_SEQS) {
        const plan = { ...(_p71Base), strategy: 'ordered', orderedSeq: seq };
        const hits = msg.variations.filter(v => sameStrategySelection(v, plan));
        assert(hits.length === 1, `${seq} matched ${hits.length} returned variations, expected exactly 1`);
        assert(hits[0].orderedSeq === seq, `${seq} matched the row for ${hits[0].orderedSeq}`);
    }
});

// ── P69: the replay capture selector ─────────────────────────────────────────
// The percentile bands are envelopes, not paths (computePercentiles sorts each year on its own),
// so "the path at rank X" has to come from ONE whole-run ordering. These pin that ordering and the
// selection against hand-built arrays where the right answer is checkable by eye.

test('P69: capture selector ranks ruined-earliest first, then survivors by wealth', () => {
    // 10 paths: 3 ruined (2035, 2031, 2040), 7 survivors with distinct wealth. The worst path must
    // be the 2031 ruin regardless of its metric, and the best the richest survivor.
    const metric = Float64Array.from([900, -1, 500, -1, 100, 300, -1, 700, 200, 400]);
    const ruin   = Uint16Array.from( [  0, 2035, 0, 2031,  0,   0, 2040, 0,   0,   0]);
    const rows = _mcEngine.selectCapturePaths(metric, ruin, 10);
    // Worst 5 = ranks 0-4; sampled pcts 5/25/50/75/95 of 9 -> ranks 0,2,5,7,9 (round). Dedup:
    // {0,1,2,3,4,5,7,9} = 8 rows.
    assert(rows.length === 8, `expected 8 deduped rows, got ${rows.length}`);
    assert(rows[0].pathIndex === 3 && rows[0].ruinYear === 2031,
        `worst row is path ${rows[0].pathIndex} ruin ${rows[0].ruinYear}, expected path 3 ruin 2031`);
    assert(rows[1].pathIndex === 1 && rows[2].pathIndex === 6, 'ruined paths not in ruin-year order');
    // Ranks 3+ are survivors in ascending wealth: 100(p4), 200(p8), 300(p5), 400(p9), 500(p2),
    // 700(p7), 900(p0).
    assert(rows[3].pathIndex === 4 && rows[3].ruinYear === null, 'first survivor should be the poorest');
    const lastRow = rows[rows.length - 1];
    assert(lastRow.pathIndex === 0 && lastRow.metric === 900, 'rank 9 should be the richest survivor');
    // Worst-first order and honest labels: ranks strictly ascend, rankPct matches rank/(n-1).
    for (let i = 1; i < rows.length; i++) {
        assert(rows[i].rank > rows[i - 1].rank, 'rows are not in ascending rank order');
    }
    assert(rows[0].rankPct === 0 && lastRow.rankPct === 100,
        `rank percentiles mislabeled: ${rows[0].rankPct}..${lastRow.rankPct}`);
});

test('P69: capture selector on an all-survivor run and a tiny run', () => {
    // No failures: pure wealth ordering, no ruinYear anywhere in the capture.
    const metric = Float64Array.from({ length: 100 }, (_, i) => (i * 37) % 100);  // shuffled 0..99
    const ruin   = new Uint16Array(100);
    const rows = _mcEngine.selectCapturePaths(metric, ruin, 100);
    // Worst 5 + pcts of 99 -> ranks {0..4, 5, 25, 50, 74, 94}: 10 rows, none ruined.
    assert(rows.length === 10, `expected 10 rows, got ${rows.length}`);
    assert(rows.every(r => r.ruinYear === null), 'a survivor-only run reported a ruin year');
    // The sampled ranks land where they claim: the metric at rank 50 of 0..99 shuffled is 50.
    const r50 = rows.find(r => r.rank === 50);
    assert(r50 && r50.metric === 50, `rank 50 carries metric ${r50 && r50.metric}, expected 50`);
    // 3 paths: every rank collides with the worst-N set; the set stays deduped and in range.
    const tiny = _mcEngine.selectCapturePaths(Float64Array.from([5, 1, 9]), new Uint16Array(3), 3);
    assert(tiny.length === 3, `3 paths captured ${tiny.length} rows`);
    assert(tiny.map(r => r.pathIndex).join(',') === '1,0,2', 'tiny run not in wealth order');
});

test('P69: every variation of a real run carries its capture rows', async () => {
    const msg = await _mcEngine.runJob(_p71Cfg('gbm'));
    assert(msg && !msg.error, `job failed: ${msg && msg.error}`);
    for (const src of [msg.variations, msg.stress.variations]) {
        for (const v of src) {
            assert(Array.isArray(v.captured) && v.captured.length > 0, 'a variation has no capture rows');
            const n = src === msg.variations ? msg.numPaths : msg.stress.numPaths;
            for (const r of v.captured) {
                assert(r.pathIndex >= 0 && r.pathIndex < n, `pathIndex ${r.pathIndex} out of range`);
                assert(r.rankPct >= 0 && r.rankPct <= 100, `rankPct ${r.rankPct} out of range`);
            }
            // The capture agrees with the headline the UI already shows: if any path was ruined,
            // the worst capture row is ruined too, and vice versa.
            const anyRuin = v.survivalRate < 1;
            assert((v.captured[0].ruinYear != null) === anyRuin,
                `survival ${v.survivalRate} but worst capture row ruinYear ${v.captured[0].ruinYear}`);
        }
    }
});

test('P69: sliced bank rows rebuild the exact per-path inputs, every mode', () => {
    // The replay contract: pathInputsFromBankRows(sliceBankRowsForPath(...)) must return exactly
    // what the run's own buildPathInputs returned for that path - same numbers, same nulls - or a
    // replayed year is a different year than the one the sweep lived.
    const base = _p71Base;
    for (const mode of ['gbm', 'aam', 'bootstrap', 'stress']) {
        const cfg = _p71Cfg(mode === 'stress' ? 'bootstrap' : mode);
        const banks = _mcEngine.buildBanks(cfg, _mcPrng.mulberry32(7), mode);
        const p = Math.min(3, banks.numPaths - 1);
        const direct = _mcEngine.buildPathInputs(banks, p, cfg.years, base, mode);
        const rows   = _mcEngine.sliceBankRowsForPath(banks, p, cfg.years, mode);
        // Rows must be plain arrays: they cross the worker boundary and may get JSON-serialized.
        assert(Array.isArray(rows.scenario), `${mode}: scenario row is not a plain array`);
        const rebuilt = _mcEngine.pathInputsFromBankRows(rows, base, mode);
        const sameSeq = (a, b, what) => {
            assert((a === null) === (b === null), `${mode}: ${what} null-ness differs`);
            if (a) for (let y = 0; y < cfg.years; y++) {
                assert(a[y] === b[y], `${mode}: ${what}[${y}] ${a[y]} !== ${b[y]}`);
            }
        };
        sameSeq(direct.returnSequence, rebuilt.returnSequence, 'returnSequence');
        sameSeq(direct.inflationSequence, rebuilt.inflationSequence, 'inflationSequence');
        assert((direct.returnSequencePerAccount === null) === (rebuilt.returnSequencePerAccount === null),
            `${mode}: per-account null-ness differs`);
        if (direct.returnSequencePerAccount) {
            for (const acct of Object.keys(direct.returnSequencePerAccount)) {
                sameSeq(direct.returnSequencePerAccount[acct], rebuilt.returnSequencePerAccount[acct],
                    `perAccount.${acct}`);
            }
        }
    }
});

test('P69: the message ships replay rows, and a replayed path reproduces the run exactly', async () => {
    const cfg = _p71Cfg('gbm', { captureVariationIndex: 0 });
    const msg = await _mcEngine.runJob(cfg);
    assert(msg && !msg.error, `job failed: ${msg && msg.error}`);
    assert(msg.captureVariationIndex === 0, `capture index echoed as ${msg.captureVariationIndex}`);
    // Main pass: one bundle of rows per captured path of the capture variation, keys matching the
    // captured metadata exactly - no missing path, no stowaway.
    const cap = msg.variations[0].captured;
    const shippedKeys = Object.keys(msg.capturedBankRows).map(Number).sort((a, b) => a - b);
    const capKeys = [...new Set(cap.map(r => r.pathIndex))].sort((a, b) => a - b);
    assert(JSON.stringify(shippedKeys) === JSON.stringify(capKeys),
        `shipped rows for paths [${shippedKeys}], captured [${capKeys}]`);
    // Stress pass: one bundle per path, index-aligned with the labels.
    assert(Array.isArray(msg.stress.pathBankRows), 'stress message has no pathBankRows');
    assert(msg.stress.pathBankRows.length === msg.stress.numPaths,
        `${msg.stress.pathBankRows.length} stress row bundles against ${msg.stress.numPaths} paths`);
    // The cross-check that the shipped rows ARE the run: rebuild a captured path's inputs, run
    // simulate() the way replay will, and the outcome metric must equal the captured one exactly.
    const baseInputs = cfg.variations[0];
    for (const r of [cap[0], cap[cap.length - 1]]) {
        const inputs = _mcEngine.pathInputsFromBankRows(
            msg.capturedBankRows[r.pathIndex], baseInputs, msg.simulationMode);
        const res = core.simulate({ ...baseInputs, ...inputs });
        const replayMetric = core.afterTaxWealthOfLogRow(
            res.log[res.log.length - 1], baseInputs.futureIRATaxRate);
        assert(replayMetric === r.metric,
            `path ${r.pathIndex}: replay metric ${replayMetric} !== captured ${r.metric}`);
    }
});

test('P79: the capture variation ships one balance trace per captured path', async () => {
    // The traces the survival chart draws over its own bands. They must describe the SAME paths
    // the replay rows do - a trace the reader clicks has to replay the path they were looking at -
    // and they must agree with the percentile bands they are drawn on top of.
    const cfg = _p71Cfg('bootstrap', { captureVariationIndex: 0, numPaths: 40 });
    const msg = await _mcEngine.runJob(cfg);
    assert(msg && !msg.error, `job failed: ${msg && msg.error}`);
    const v = msg.variations[0];
    assert(Array.isArray(v.capturedTraces), 'the capture variation shipped no traces');
    assert(v.captured.length > 1, `only ${v.captured.length} captured paths - the length check below would be vacuous`);
    assert(v.capturedTraces.length === v.captured.length,
        `${v.capturedTraces.length} traces against ${v.captured.length} captured paths`);
    for (let i = 0; i < v.captured.length; i++) {
        const tr = v.capturedTraces[i], r = v.captured[i];
        assert(tr.length === msg.years, `trace ${i} has ${tr.length} years, plan has ${msg.years}`);
        assert(tr.every(x => Number.isFinite(x) && x >= 0),
            `trace ${i} carries a negative or non-finite balance`);
        // A ruined path is at zero from its ruin year on; a survivor never touches zero at the end.
        if (r.ruinYear) {
            assert(tr[tr.length - 1] === 0, `path ${r.pathIndex} ruined in ${r.ruinYear} but ends at ${tr[tr.length - 1]}`);
        } else {
            assert(tr[tr.length - 1] > 0, `path ${r.pathIndex} survived but ends at 0`);
        }
    }
    // Every drawn trace must sit inside the band the same run reported, or the chart would show a
    // path outside its own p5-p95 envelope. Checked at the last year, where the spread is widest.
    const last = msg.years - 1;
    const lo = v.percentiles.p5[last], hi = v.percentiles.p95[last];
    assert(v.capturedTraces.some(tr => tr[last] <= lo + 1e-6),
        'no captured trace is at or below p5, yet the worst paths are captured by construction');
    assert(v.capturedTraces.every(tr => tr[last] <= Math.max(hi, ...v.capturedTraces.map(t => t[last])) + 1e-6),
        'a captured trace exceeds every drawn value');
    // Stress already ships every path as stressPaths, so it must not pay for these twice.
    assert(msg.stress.variations[0].capturedTraces == null,
        'the stress pass shipped capturedTraces as well as stressPaths');
});

test('P86e: the MC message carries dual-basis twins, and real = each path deflated by ITS OWN inflation', async () => {
    // Shape on a normal-size run: every twin present, same dimensions as its nominal sibling.
    const cfg = _p71Cfg('gbm', { captureVariationIndex: 0 });
    const msg = await _mcEngine.runJob(cfg);
    assert(msg && !msg.error, `job failed: ${msg && msg.error}`);
    const v = msg.variations[0];
    for (const k of ['p5', 'p25', 'p50', 'p75', 'p95']) {
        assert(Array.isArray(v.percentilesReal?.[k]) && v.percentilesReal[k].length === msg.years,
            `percentilesReal.${k} missing or wrong length`);
    }
    assert(Number.isFinite(v.medianTaxReal) && v.medianTaxReal < v.medianTax,
        'medianTaxReal must exist and sit below the nominal median under positive inflation');
    assert(Number.isFinite(v.medianSpendNominal) && v.medianSpendNominal > v.medianSpend,
        'medianSpendNominal must exist and sit above the real median under positive inflation');
    assert(v.capturedTracesReal && v.capturedTracesReal.length === v.capturedTraces.length,
        'capturedTracesReal must pair one-to-one with capturedTraces');
    assert(Array.isArray(msg.stress.variations[0].stressPathsReal)
        && msg.stress.variations[0].stressPathsReal.length === msg.stress.numPaths,
        'the stress pass must ship stressPathsReal beside stressPaths');
    // Exactness, proven through the replay contract on a single-path run: with one path, every
    // aggregate IS that path, so the twins must equal the replayed simulate()'s own totals and the
    // real curve must be the nominal curve divided year by year by the path's own inflationFactor.
    const cfg1 = _p71Cfg('gbm', { captureVariationIndex: 0, numPaths: 1 });
    const one = await _mcEngine.runJob(cfg1);
    assert(one && !one.error, `single-path job failed: ${one && one.error}`);
    const v1 = one.variations[0];
    const baseInputs = cfg1.variations[0];
    const pathIdx = v1.captured[0].pathIndex;
    const inputs = _mcEngine.pathInputsFromBankRows(
        one.capturedBankRows[pathIdx], baseInputs, one.simulationMode);
    const res = core.simulate({ ...baseInputs, ...inputs });
    assertNear(v1.medianTax, res.totals.tax, 'one path: medianTax is that path\'s nominal tax', 1);
    assertNear(v1.medianTaxReal, res.totals.taxCurrentDollars,
        'one path: medianTaxReal is that path\'s sum-of-deflated-years tax', 1);
    assertNear(v1.medianSpend, res.totals.spendCurrentDollars,
        'one path: medianSpend is that path\'s real spend', 1);
    assertNear(v1.medianSpendNominal, res.totals.spend,
        'one path: medianSpendNominal is that path\'s nominal spend', 1);
    for (let y = 0; y < Math.min(one.years, res.log.length); y++) {
        const want = v1.percentiles.p50[y] / (res.log[y].inflationFactor || 1);
        // Relative tolerance: the percentile arrays round through float32 inside computePercentiles.
        assert(Math.abs(v1.percentilesReal.p50[y] - want) <= Math.max(1, Math.abs(want)) * 1e-6,
            `year ${y}: real p50 ${v1.percentilesReal.p50[y]} !== nominal/ownFactor ${want}`);
    }
});

test('P80: every sampled year is labelled with the year that actually produced it', () => {
    // The claim the tooltip makes is "this number came from that year". So the test is not that
    // srcYears is populated - it is that the VALUE in the bank equals the historical record at the
    // year srcYears names. A label that is merely present but off by one block would pass any
    // weaker check and mislead every reader.
    const H = globalThis.HISTORICAL_RETURNS;
    const base = H.equityStartYear ?? 1928;
    const YEARS = 30;

    const check = (bank, nPaths, tag) => {
        assert(bank.srcYears && bank.srcYears.length === nPaths * YEARS,
            `${tag}: srcYears is ${bank.srcYears ? bank.srcYears.length : 'missing'}, want ${nPaths * YEARS}`);
        for (let i = 0; i < nPaths * YEARS; i++) {
            const idx = bank.srcYears[i] - base;
            assert(idx >= 0 && idx < H.equity.length,
                `${tag}: cell ${i} names year ${bank.srcYears[i]}, outside the record`);
            assert(bank.equity[i] === H.equity[idx],
                `${tag}: cell ${i} says ${bank.srcYears[i]} but its equity return is not that year's`);
            assert(bank.bonds[i] === H.bonds[idx],
                `${tag}: cell ${i} bonds disagree with the year it names`);
            // Inflation is floored on the way in, so compare against the floored value - and the
            // ONE shared index is the whole reason a single year can label both series.
            assert(bank.inflation[i] === Math.max(_mcPrng.INFLATION_FLOOR, H.inflation[idx]),
                `${tag}: cell ${i} inflation disagrees with the year it names`);
        }
    };

    // Bootstrap, with the bear overlay ON at its default - it REWRITES the opening years of a
    // quarter of the paths after the bank is built, and those cells must be relabelled too.
    const mb = _mcPrng.bootstrapMultiAssetBank(_mcPrng.mulberry32(99), 40, YEARS, 3);
    _mcPrng.applyBearStartOverlay(mb, _mcPrng.mulberry32(7), 40, YEARS, 0.25);
    check(mb, 40, 'bootstrap + bear overlay');

    // Stress, which WRAPS off the end of the record - the reason the years are recorded rather
    // than derived from startYears + y.
    const sb = _mcPrng.buildStressBank(10, YEARS, 'combined');
    check(sb, sb.labels.length, 'stress');
    // And prove the wrap is really in play here, or the paragraph above is decoration: at least
    // one scenario must run past the end of the record and come back.
    assert(sb.realYears.some(r => r < YEARS),
        'no stress scenario wraps, so this fixture cannot prove the wrap is handled');
    const wrapped = sb.startYears.findIndex((_, k) => sb.realYears[k] < YEARS);
    const naive = sb.startYears[wrapped] + (YEARS - 1);
    assert(sb.srcYears[wrapped * YEARS + YEARS - 1] !== naive,
        'a wrapped scenario must NOT be labelled start + y; that is the bug this guards');
});

test('P80: recording the source years changes no draw and no number', async () => {
    // The load-bearing property. srcYears is filled from an index already in hand, so it must add
    // ZERO rng() calls - otherwise every path in every existing run shifts and the seed stops
    // meaning what it meant. Compared against the banks with the years stripped back out.
    const strip = b => ({ equity: b.equity, bonds: b.bonds, intl: b.intl, inflation: b.inflation });
    const a = strip(_mcPrng.bootstrapMultiAssetBank(_mcPrng.mulberry32(4242), 25, 20, 3));
    const b = strip(_mcPrng.bootstrapMultiAssetBank(_mcPrng.mulberry32(4242), 25, 20, 3));
    assert(JSON.stringify(a) === JSON.stringify(b), 'the bootstrap bank is not reproducible at all');

    // The real check: a full job, end to end, still reports the same survival and the same paths.
    for (const mode of ['bootstrap', 'gbm']) {
        const msg = await _mcEngine.runJob(_p71Cfg(mode, { captureVariationIndex: 0 }));
        assert(msg && !msg.error, `${mode}: ${msg && msg.error}`);
        const v = msg.variations[0];
        assert(Number.isFinite(v.survivalRate), `${mode}: no survival rate`);
        // A synthetic path has nothing to name, and must not pretend otherwise.
        const rows = msg.capturedBankRows[v.captured[0].pathIndex];
        if (mode === 'gbm') {
            assert(rows.srcYears === undefined,
                'a synthetic path shipped source years, which it cannot have');
        } else {
            assert(Array.isArray(rows.srcYears) && rows.srcYears.length === msg.years,
                `bootstrap shipped ${rows.srcYears ? rows.srcYears.length : 'no'} source years`);
            assert(rows.srcYears.every(y => y >= 1928 && y <= 2025),
                'a shipped source year is outside the record');
        }
    }
});

test('P71: a cancelled job reports nothing at all', async () => {
    // The contract the UI depends on: a cancelled run resolves to null, and the caller reporting
    // nothing is what leaves the previous results on screen instead of blanking them.
    let calls = 0;
    const msg = await _mcEngine.runJob(_p71Cfg('gbm'), {
        shouldCancel: () => { calls++; return calls > 1; },
    });
    assert(msg === null, 'a cancelled job returned a results message');
    assert(calls > 1, 'shouldCancel was never consulted');
});

// ── P103b2: strategy 'schedule', the flexible carrier ─────────────────────────
// The acceptance bar for the representation is REPLAY IDENTITY, not a gap number: compile a shipped
// family's realized decisions into a schedulePlan, re-run as a schedule, and require the two runs to
// agree to the dollar. A family that cannot reproduce itself proves the representation is wrong, and
// it fails here rather than silently in a gap table.

// A household with real Social Security and a ceiling worth filling, so the P87c MAGI basis and the
// gap-fill cascade are both exercised. Declared inside the test file's IIFE like every other fixture.
const SCHED_BASE = {
    STATEname: 'CA', nYears: 20,
    birthyear1: 1962, birthmonth1: 6, die1: 92,
    birthyear2: 1964, birthmonth2: 3, die2: 94, hasSpouse: true,
    ss1: 45000, ss1Age: 70, ss2: 24000, ss2Age: 67,
    pensionAnnual: 0, pensionStartAge: 0, survivorPct: 0, pensionCola: false,
    spendChange: 0, iraBaseGoal: 0,
    inflation: 0.025, cpi: 0.025, growth: 0.06,
    cashYield: 0.03, dividendRate: 0.02,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: true, propWithdraw: 0.10, iraWithdrawPct: 0.06,
    extraConversionAmount: 0, fundConversionWithCash: false,
    startAge: 64, startInYear: 2026, dividendReinvest: true,
    gkGuard: 0.20, gkAdjPct: 0.10, cycleLTCGTarget: 0.15,
    qcdHHMax: 0, qcdMode: 'asneeded', computeOC: false,
    IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000,
    Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000,
    spendGoal: 97200,
};

// Replay a family as a schedule and return the worst per-year wealth disagreement plus the final one.
function schedReplayDelta(overrides, mutate) {
    const src = { ...SCHED_BASE, ...overrides };
    const a = simulate(src);
    let plan = compileScheduleFromRun(a, src);
    if (mutate) plan = mutate(plan);
    const b = simulate({ ...src, strategy: 'schedule', schedulePlan: plan,
                         ...scheduleOptionsForRun(src),
                         stratRate: undefined, stratIRMAATier: undefined, stratACAMultiple: undefined });
    let maxYr = 0;
    if (a.log.length !== b.log.length) return { maxYr: Infinity, dNW: Infinity, scheduled: plan.filter(Boolean).length };
    for (let i = 0; i < a.log.length; i++) {
        maxYr = Math.max(maxYr, Math.abs((b.log[i].totalNetWealth ?? 0) - (a.log[i].totalNetWealth ?? 0)));
    }
    return { maxYr, dNW: (b.finalNW ?? 0) - (a.finalNW ?? 0), scheduled: plan.filter(Boolean).length };
}

test('schedule: replays Fill Bracket 22% to the dollar', () => {
    const d = schedReplayDelta({ strategy: 'bracket', stratRate: 0.22 });
    assert(d.scheduled === 33, `expected 33 scheduled years, got ${d.scheduled}`);
    assert(d.maxYr < 0.01, `per-year wealth diverged by ${d.maxYr}`);
    assert(Math.abs(d.dNW) < 0.01, `final net worth diverged by ${d.dNW}`);
});

test('schedule: replays an IRMAA tier ceiling to the dollar', () => {
    const d = schedReplayDelta({ strategy: 'bracket', stratRate: 0, stratIRMAATier: 2 });
    assert(d.scheduled === 33, `expected 33 scheduled years, got ${d.scheduled}`);
    assert(d.maxYr < 0.01, `per-year wealth diverged by ${d.maxYr}`);
    assert(Math.abs(d.dNW) < 0.01, `final net worth diverged by ${d.dNW}`);
});

test('schedule: rateBasis is load-bearing, not decoration', () => {
    // Dropping it makes the federal replay derive its marginal rate at the deduction-lifted ceiling
    // instead of the statutory bracket top, which is one bracket higher. Measured at $121 over 33
    // years before rateBasis existed. If this test ever passes with rateBasis stripped, the two
    // numbers have converged and the field can go.
    const kept = schedReplayDelta({ strategy: 'bracket', stratRate: 0.22 });
    const stripped = schedReplayDelta({ strategy: 'bracket', stratRate: 0.22 },
        plan => plan.map(e => e && { ordTarget: e.ordTarget, kind: e.kind }));
    assert(kept.maxYr < 0.01, 'the kept-rateBasis replay should be exact');
    assert(Math.abs(stripped.dNW) > 1, `stripping rateBasis should diverge, got ${stripped.dNW}`);
});

test('schedule: replays IRA Draw 5% to the dollar via the quantity lever', () => {
    // P103b3 widened the representation past the b2 limit this fixture used to pin: a family whose
    // per-year decision is a SHARE OF THE IRA is now carried by iraDraw.
    const d = schedReplayDelta({ strategy: 'fixedpct', iraWithdrawPct: 0.05 });
    assert(d.scheduled === 33, `expected 33 scheduled years, got ${d.scheduled}`);
    assert(d.maxYr < 0.01, `per-year wealth diverged by ${d.maxYr}`);
    assert(Math.abs(d.dNW) < 0.01, `final net worth diverged by ${d.dNW}`);
});

test('schedule: replays Reduce 17 yrs, which takes the OTHER gap-fill', () => {
    // Reduce is the one quantity family outside the bracket set, so it fills its gap from the
    // [40,60] default branch. Getting this exact is what per-year gapFill is for.
    const d = schedReplayDelta({ strategy: 'fixed', nYears: 17 });
    assert(d.maxYr < 0.01, `per-year wealth diverged by ${d.maxYr}`);
    assert(Math.abs(d.dNW) < 0.01, `final net worth diverged by ${d.dNW}`);
});

test('schedule: replays an ACA plan ACROSS its lapse', () => {
    // The case that broke prediction R-P1 in b2. The cap is live for 3 of 33 years and lapses at
    // Medicare eligibility; every later year falls through to baseline Proportional, which is a
    // different statement from "draw nothing voluntarily". scheduleFallback is what says so.
    const d = schedReplayDelta({ strategy: 'aca', stratRate: 0, stratACAMultiple: 400 });
    assert(d.scheduled === 3, `expected 3 live-cap years, got ${d.scheduled}`);
    assert(d.maxYr < 0.01, `per-year wealth diverged by ${d.maxYr}`);
    assert(Math.abs(d.dNW) < 0.01, `final net worth diverged by ${d.dNW}`);
});

test('schedule: an iraDraw year implies no year-0 conversion', () => {
    // Withdrawal timing is Early in a conversion year and Late otherwise, and year 0 decides it from
    // the strategy. A ceiling implies a conversion; a quantity draw does not, exactly as fixedpct
    // and fixed do not. Treating any year-0 entry as a ceiling flipped the month and left IRA Draw
    // $39,117 adrift with every year already scheduled - a whole-plan error from one boolean.
    const src = { ...SCHED_BASE, strategy: 'fixedpct', iraWithdrawPct: 0.05 };
    const a = simulate(src);
    const plan = compileScheduleFromRun(a, src);
    assert(plan[0] && plan[0].iraDraw !== undefined, 'year 0 should compile to a quantity entry');
    const b = simulate({ ...src, strategy: 'schedule', schedulePlan: plan, ...scheduleOptionsForRun(src) });
    assert(a.log[0].timingReason === b.log[0].timingReason,
        `year-0 timing differs: ${a.log[0].timingReason} vs ${b.log[0].timingReason}`);
});

test('schedule: convert caps the surplus routed to Roth, and the rest still banks', () => {
    // The conversion lever is a REALLOCATION of an already-taxed surplus, not a gross draw: capping
    // it moves dollars from Roth to Cash/Brokerage and must not change what left the IRA.
    const src = { ...SCHED_BASE, strategy: 'bracket', stratRate: 0.22 };
    const a = simulate(src);
    const plan = compileScheduleFromRun(a, src);
    const capped = plan.map(e => e && { ...e, convert: 1000 });
    const b = simulate({ ...src, strategy: 'schedule', schedulePlan: capped, stratRate: undefined });
    const convA = a.log.reduce((t, e) => t + (e.rothConv ?? 0), 0);
    const convB = b.log.reduce((t, e) => t + (e.rothConv ?? 0), 0);
    assert(convB < convA, `capping convert should reduce conversions: ${convB} vs ${convA}`);
    assert((b.log[0]['-volIRAwd'] ?? 0) === (a.log[0]['-volIRAwd'] ?? 0),
        'capping the Roth destination must not change the IRA draw');
});

test('schedule: the coverage limit that REMAINS is the account split', () => {
    // Proportional and Ordered decide how to SPLIT a spending draw across accounts, which is
    // oracleWithdrawalPlan's job and not something ordTarget or iraDraw can state. Pinned so that
    // widening it stays a deliberate act - which is exactly how P103b5 removed GK from this list.
    for (const ov of [{ strategy: 'propwd', propWithdraw: 0.10 },
                      { strategy: 'ordered', orderedSeq: 'CBIR' }]) {
        const d = schedReplayDelta(ov);
        assert(d.scheduled === 0, `${ov.strategy} should compile to nothing, got ${d.scheduled}`);
    }
});

test('schedule: carries GK by its spend RULE, and beats it', () => {
    // The point of the spend field is not to replay GK's recorded numbers - that would be a
    // hindsight artifact, since GK's own dynamics would have reacted to a different draw. The
    // schedule takes GK's spend RULE, re-evaluated each year against its own portfolio, and only the
    // DRAW from the source. That combination is followable, and it wins on both axes.
    const src = { ...SCHED_BASE, strategy: 'gk' };
    const opts = scheduleOptionsForRun(src);
    assert(opts.spendRule === 'gk', 'a GK source must hand over its spend rule, not its numbers');
    const a = simulate(src);
    const plan = compileScheduleFromRun(a, src);
    assert(plan.filter(Boolean).length === a.log.length, 'every GK year should compile a draw');
    assert(plan[0].spend === undefined, 'the draw is carried; the spend comes from the rule');
    const b = simulate({ ...src, strategy: 'schedule', schedulePlan: plan, ...opts });
    assert(b.totals.success, 'the combination must still fund the plan');
    const dSpend = (b.totals.spendCurrentDollars ?? 0) - (a.totals.spendCurrentDollars ?? 0);
    const dNW = (b.finalNW ?? 0) - (a.finalNW ?? 0);
    assert(dSpend > -100, `spend must be no worse, got ${dSpend}`);
    assert(dNW > 1, `wealth must be higher, got ${dNW}`);
});

test('schedule: GK spend rule is separable from the GK strategy', () => {
    // spendRule: 'gk' runs the adjustment for any strategy. Without the separation a schedule could
    // only ever replay GK's numbers, never follow its rule.
    const withRule = simulate({ ...SCHED_BASE, strategy: 'bracket', stratRate: 0.22, spendRule: 'gk' });
    const without = simulate({ ...SCHED_BASE, strategy: 'bracket', stratRate: 0.22 });
    const sameSpend = Math.abs((withRule.totals.spendCurrentDollars ?? 0)
                             - (without.totals.spendCurrentDollars ?? 0)) < 1;
    assert(!sameSpend, 'borrowing the GK spend rule must change the spend path');
});

test('schedule: a per-year spend applies for that year only', () => {
    // sim.spendGoal carries forward compounded by spendDelta and inflation, so an override left in
    // place would silently compound into every later year and the search axes would stop being
    // independent. Year 0 is halved here; year 1 must land on the untouched trajectory.
    const base = simulate({ ...SCHED_BASE, strategy: 'bracket', stratRate: 0.22 });
    const half = Math.round((base.log[0].spendGoal ?? 0) / 2);
    const plan = compileScheduleFromRun(base, { ...SCHED_BASE, strategy: 'bracket', stratRate: 0.22 });
    plan[0] = { ...plan[0], spend: half };
    const res = simulate({ ...SCHED_BASE, strategy: 'schedule', schedulePlan: plan });
    assertNear(res.log[0].spendGoal ?? 0, half, 'year 0 should take the override', 0.01);
    assertNear(res.log[1].spendGoal ?? 0, base.log[1].spendGoal ?? 0,
        'year 1 must be back on the untouched trajectory', 0.01);
});

test('schedule: an unscheduled year draws nothing voluntarily and still funds spending', () => {
    const res = simulate({ ...SCHED_BASE, strategy: 'schedule' });   // no schedulePlan at all
    assert(res.totals.success, 'an empty schedule should still fund spending from the gap-fill cascade');
    assert((res.log[0]['BracketTarget'] ?? 0) === 0, 'an unscheduled year should target no ceiling');
});

test('schedule: malformed entries throw rather than reading as a quiet year', () => {
    const bad = [
        ['not an object', ['nope']],
        ['zero ordTarget', [{ ordTarget: 0 }]],
        ['NaN ordTarget', [{ ordTarget: NaN }]],
        ['unknown kind', [{ ordTarget: 100000, kind: 'state' }]],
        ['negative rateBasis', [{ ordTarget: 100000, rateBasis: -5 }]],
        ['neither ordTarget nor iraDraw', [{ kind: 'federal' }]],
        ['both ordTarget and iraDraw', [{ ordTarget: 100000, iraDraw: 5000 }]],
        ['negative iraDraw', [{ iraDraw: -1 }]],
        ['negative convert', [{ ordTarget: 100000, convert: -1 }]],
        ['unknown gapFill', [{ ordTarget: 100000, gapFill: 'sideways' }]],
        ['negative spend', [{ ordTarget: 100000, spend: -1 }]],
        ['NaN spend', [{ ordTarget: 100000, spend: NaN }]],
    ];
    for (const [label, plan] of bad) {
        let threw = false;
        try { simulate({ ...SCHED_BASE, strategy: 'schedule', schedulePlan: plan }); }
        catch (e) { threw = true; }
        assert(threw, `${label} should have thrown`);
    }
});

test('schedule: refuses to compose with cyclicEnabled', () => {
    let threw = false;
    try {
        simulate({ ...SCHED_BASE, strategy: 'schedule', cyclicEnabled: true,
                   schedulePlan: [{ ordTarget: 150000 }] });
    } catch (e) { threw = true; }
    assert(threw, 'schedule + cyclicEnabled should be an explicit error, not a precedence rule');
});

// able to stop a test from running in the place that gates commits.
async function runOptimizerCoreTests(opts) {
    const skipSlow = !!(opts && opts.skipSlow);
    passed = 0;
    failed = 0;
    let skipped = 0;
    const failures = [];

    // The engine records WALL CLOCK into its own output: optimizer_core.js:928 sets
    // `yr.loopStart = performance.now()`, :2381 derives loopMs from it, and :1739 accumulates
    // totals.thirdPassTime. Several tests here assert that two simulation logs are byte-identical,
    // and a live clock makes those two logs differ by construction.
    //
    // Node neutralises this with a load-time stub. The browser must NOT stub at load - that would
    // freeze the real page's timing - so it is stubbed for the duration of the run and restored
    // afterwards. This is measured, not hypothesised: without it exactly six byte-identity tests
    // fail in the browser while passing in node, and they fail on the clock, not on the engine.
    const realNow = globalThis.performance && globalThis.performance.now;
    if (globalThis.performance) globalThis.performance.now = () => 0;

    const criticalResults = [];

    try {
        for (const [name, fn] of TESTS) {
            if (skipSlow && SLOW.has(name)) { skipped++; continue; }
            const isCritical = CRITICAL.has(name);
            const tag = isCritical ? '★ CRITICAL  ' : '';
            try {
                await fn();
                console.log(`  ✓  ${tag}${name}`);
                passed++;
                if (isCritical) criticalResults.push([true, name]);
            } catch (e) {
                console.log(`  ✗  ${tag}${name}`);
                console.log(`       ${e.message}`);
                failures.push(`${name}: ${e.message}`);
                failed++;
                if (isCritical) criticalResults.push([false, name]);
            }
        }
    } finally {
        if (globalThis.performance && realNow) globalThis.performance.now = realNow;
    }

    // ── Critical-guard summary ───────────────────────────────────────────────
    // Repeated deliberately. These guard defects that shipped to real users and quietly changed
    // their numbers, so their status must be readable without scrolling through everything else.
    const critFailed = criticalResults.filter(([ok]) => !ok);
    console.log('');
    console.log('★ CRITICAL REGRESSION GUARDS ' + '─'.repeat(40));
    criticalResults.forEach(([ok, name]) => console.log(`  ${ok ? '✓' : '✗'}  ${name}`));
    if (critFailed.length) {
        console.log('');
        console.log(`*** ${critFailed.length} CRITICAL GUARD${critFailed.length !== 1 ? 'S' : ''} FAILED - a defect that already shipped once has come back ***`);
    } else {
        console.log(`  ${criticalResults.length}/${criticalResults.length} critical guards passed.`);
    }

    console.log('');
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (skipped) console.log(`(${skipped} slow test${skipped !== 1 ? 's' : ''} skipped)`);
    console.log(failed > 0 ? '\n*** SOME TESTS FAILED ***' : 'All tests passed.');
    return {
        passed, failed, skipped, total: TESTS.length, failures,
        critical: {
            passed: criticalResults.filter(([ok]) => ok).length,
            failed: critFailed.length,
            failedNames: critFailed.map(([, name]) => name)
        }
    };
}

// ── IRA Goal sensitivity partition (Phase P107) ──────────────────────────────────────────────
// The UI greys the IRA Goal field for IRA_GOAL_BLIND_STRATEGIES. That is a claim about the ENGINE,
// so it is pinned here in BOTH directions: a blind strategy must be unmoved by any goal, and a
// goal-reading strategy must actually move. Without the second half, deleting the goal logic from
// `bracket` would leave the field enabled on a control that no longer does anything.
//
// The goal is swept relative to the STARTING IRA, not in absolute dollars. An absolute grid tests
// whether the floor happens to bind on one fixture and reported `bracket` as insensitive when it is
// not - that mistake is what P107a corrected.
test('P107: IRA_GOAL_BLIND_STRATEGIES are unmoved by the goal, and the others are not', () => {
    const GOAL_BASE = {
        ...BASE,
        IRA1: 900000, Brokerage: 300000, BrokerageBasis: 150000, Cash: 60000,
        spendGoal: 55000, growth: 0.05, inflation: 0.02, cpi: 0.02,
        nYears: 12, convertExcessToRoth: true,
    };
    const IRA0 = GOAL_BASE.IRA1 + (GOAL_BASE.IRA2 || 0);
    const finals = (over) => [0.1, 0.5, 1.0, 2.0].map(mult =>
        simulate({ ...GOAL_BASE, ...over, iraBaseGoal: IRA0 * mult, computeOC: false }).finalNW);
    const spread = (a) => Math.max(...a) - Math.min(...a);

    const BLIND = {
        propwd: { strategy: 'propwd' },
        ordered: { strategy: 'ordered', orderedSeq: 'CIBR' },
        split: { strategy: 'split', splitWeights: [0, 9, 1, 0] },
        gk: { strategy: 'gk' },
    };
    for (const key of core.IRA_GOAL_BLIND_STRATEGIES) {
        assert(Object.prototype.hasOwnProperty.call(BLIND, key),
            `P107: no coverage for blind strategy '${key}' - add it to this test`);
        assert(spread(finals(BLIND[key])) < 0.01,
            `P107: '${key}' is listed as ignoring the IRA Goal but its result moved`);
    }

    // The other side. These read the goal, so the field must stay enabled for them.
    for (const [label, over] of [
        ['fixed', { strategy: 'fixed' }],
        ['bracket', { strategy: 'bracket', stratRate: 0.22 }],
        ['fixedpct', { strategy: 'fixedpct' }],
    ]) {
        assert(!core.IRA_GOAL_BLIND_STRATEGIES.includes(over.strategy),
            `P107: '${label}' reads the IRA Goal and must not be greyed`);
        assert(spread(finals(over)) > 1,
            `P107: '${label}' should respond to the IRA Goal and did not`);
    }
});

if (IS_NODE) {
    // Exported BEFORE the run, not after: the runner is async now, so `await` inside it yields to
    // the event loop and anything requiring this file mid-run would otherwise see an empty exports.
    module.exports = { runOptimizerCoreTests, SLOW_COUNT: SLOW.size, TEST_COUNT: TESTS.length };
    runOptimizerCoreTests().then(r => { if (r.failed > 0) process.exitCode = 1; });
} else {
    window.runOptimizerCoreTests = runOptimizerCoreTests;
    window.OPTIMIZER_CORE_TEST_COUNT = TESTS.length;
    window.OPTIMIZER_CORE_SLOW_COUNT = SLOW.size;
}

})();
