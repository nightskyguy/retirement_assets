'use strict';
/**
 * convtiming_harness.js -- P85. When conversions happen: is EARLIER better, and if it is, is RMD
 * suppression the reason?
 *
 * Run:  node .test_harnesses/convtiming_harness.js
 *
 * THE CLAIM UNDER TEST, as the user stated it: converting earlier beats converting later, for two
 * reasons -- (a) the converted dollars compound tax-free for longer, and (b) a smaller IRA grows
 * less, so lifetime RMDs and everything they drag along shrink. Direction and mechanism are
 * separate claims and this harness reports them separately, because "earlier is better" and
 * "earlier is better BECAUSE of RMDs" are not the same finding, and only the second one tells P5's
 * greedy schedule what to optimize.
 *
 * NOTHING IN THIS REPO ANSWERED IT. betr_harness.js asks convert-vs-not. stopyear_harness.js and
 * bestConversionStopYear() ask when to STOP -- and a later stop converts MORE in total, so a cutoff
 * sweep confounds timing with amount and cannot answer this. unifiedconv_harness.js and
 * oracle_harness.js ask different questions. RMD appears 1-2 times in twelve `research/*_RESULTS.md` files.
 *
 * THIS IS NOT P28j. P28j is the intra-year withdrawal MONTH (preMonths 1 vs 11,
 * optimizer_core.js:1275-1285), whose Early(Conv) / Late(Spend) column names invite exactly this
 * confusion. Different axis; P28j's finding says nothing about which YEAR a conversion lands in.
 *
 * THE CONFOUND, PINNED FIRST. P28ja measured the withdrawal-timing leg as LARGER than the
 * conversion leg in 29 of 54 cells. Any arm that moves conversions between years also moves which
 * years fire `_useEarly`, so an unpinned run measures P28j's defect and reports it as a conversion
 * finding. Every arm here runs forceWithdrawTiming:'late', and every arm is checked for a stray
 * Early year. If that check trips the run is void, not merely suspect.
 *
 * ARMS. Same lifetime GROSS conversion S, three shapes over an n-year horizon:
 *   FRONT  all of S spread evenly over the first k years
 *   LEVEL  S/n every year                                    <- the control
 *   BACK   all of S spread evenly over the last k years
 * plus DEFAULT, the plan's own unconstrained surplus behavior, printed for scale and never scored
 * against the three (it converts a different amount, by construction).
 *
 * GROSS, NOT NET, IS WHAT IS HELD EQUAL. `rothConv` on a log row is the NET Roth credit -- gross
 * minus the conversion's own tax (optimizer_core.js:2738). The gross is `-iraConvGrossTot`. A smoke
 * run of this grid showed FRONT netting $329,191 and BACK $291,309 off the SAME $420,000 gross
 * request: BACK pays more tax per dollar converted because RMDs and Social Security have already
 * filled its lower brackets. That spread is a RESULT, not a confound, so the arms hold gross equal
 * and let net fall where it falls. Holding net equal would have buried the finding inside the
 * normalization.
 *
 * DELIVERY IS VERIFIED, NOT ASSUMED. applyExtraConversion caps the year's gross at the available
 * IRA balance (optimizer_core.js:2694). A cell whose delivered gross misses the request is reported
 * as UNDELIVERED and excluded from scoring rather than silently compared at a smaller S.
 *
 * NORMALIZATIONS. Equal nominal gross is not neutral -- a dollar converted in year 0 removes a
 * larger share of the future IRA than the same dollar in year 10 -- so more than one is run, and
 * disagreement between them is itself a result:
 *   N1  equal lifetime GROSS converted        headline
 *   N2  equal lifetime TAX (current dollars)  "for the same tax bill, when?"
 *   N3  equal TERMINAL pre-tax IRA            isolates the RMD stock by construction
 * N2 and N3 bisect a scale factor on each arm's gross to hit the LEVEL arm's value.
 *
 * SCORING, and why the scorer is written and tested before the sweep runs. The last three research
 * sessions each found a scorer defect that printed a confident wrong verdict -- P83's P1 tested the
 * nearest convenient statistic, P30f's zero-predicate was vacuous, and P30h had two at once (ties
 * awarded to the first entry in the list, and a shared $1 epsilon applied to a metric measured in
 * fractions). Two of those flipped the recommendation. So: per-metric epsilon with an explicit
 * throw on an unregistered metric, and section 0 runs the scorer against cases whose answer is
 * known by construction BEFORE any sweep result is allowed to print.
 *
 * Delivered spend moves when the schedule moves, so wealth alone is meaningless -- the P29 / P28jd
 * rule. Cells are classified CLEAN (all three arms deliver equal spend) or not; clean cells are
 * scored on afterTaxNetWorth, the rest are excluded and counted rather than quietly averaged in.
 *
 * PREDICTIONS, stated before the run and scored in section 6:
 *   C1  FRONT beats BACK on after-tax net worth in a majority of clean cells.
 *   C2  FRONT has strictly lower totals.rmd in EVERY clean cell. This is the user's mechanism; a
 *       single counterexample localizes where the intuition breaks rather than merely denting it.
 *   C3  FRONT's advantage shrinks toward $0 as growth goes to zero. If it does NOT, something other
 *       than compounding is paying -- the same shape as P28ja's Q5 surprise, which is how that
 *       non-compounding residual was found in the first place.
 *   C4  N1 and N2 agree on direction.
 */

// -- Bootstrap the engine exactly like gapfill_harness.js / optimizer_core.tests.js -------------
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
require('../displayhelpers.js');
const { simulate, afterTaxNetWorth } = core;

// -- Axes --------------------------------------------------------------------------------------
// COMMON and SCENARIOS are copied from gapfill_harness.js VERBATIM, not imported: phased_harness.js
// states the rule and it is the right one -- a harness that imports another's fixture silently
// changes when that one is edited for its own reasons.
const COMMON = {
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
};

const N_YEARS = COMMON.nYears;
const SPEND_RATES = [0.04, 0.06, 0.08];
const STATES = ['CA', 'TX'];
const RESERVES = [{ key: 'off', label: 'reserve off', value: null },
                  { key: 'on',  label: 'reserve on',  value: 150000 }];

const SCENARIOS = [
    { key: 'defaults',   label: 'shipped defaults (IRA-heavy)',
      over: { IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000,
              Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000 } },
    { key: 'defaults3x', label: 'defaults x3 (same mix, bigger)',
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

// Two families, to test whether the answer is family-dependent. The shaped arms run with
// convertExcessToRoth off, so the family governs WITHDRAWALS only and the conversion schedule is
// entirely the explicit array -- which is the isolation this phase needs.
const FAMILIES = [
    { key: 'propwd',  label: 'Proportional 10%', over: { strategy: 'propwd', propWithdraw: 0.10 } },
    { key: 'bracket', label: 'Fill Bracket 24%', over: { strategy: 'bracket', stratRate: 0.24,
                                                         stratIRMAATier: -1, stratACAMultiple: 0 } },
];

// IRA GOAL. The first run of this harness inherited `iraBaseGoal: 0` from gapfill_harness.js's
// COMMON without asking whether it belonged, and it did not. **The shipped page default is
// $750,000** (`retirement_optimizer.html:210`), and the page also offers a computed suggestion --
// the IRA balance whose RMDs roughly equal the spend goal at a target age (`computeSuggestedIraGoal`,
// `optimizer_ui.js:665`). Zero is a value essentially no real plan carries.
//
// It is not a cosmetic axis. `yr.curIRA` (`optimizer_core.js:1584`) is the IRA-above-goal ceiling
// on voluntary IRA withdrawals, and it gates the bracket family (`:1914`), the coexist paths
// (`:1852`, `:1858`) and Reduce (`:1898`) -- not Reduce alone. Measured: Fill Bracket 24% at goal 0
// ends with a $0 IRA and takes **$0 of lifetime RMDs**; the same plan at $750,000 ends with
// $1,119,897 and takes **$1,824,266**. A harness asking what conversions do to RMDs, run at goal 0,
// was asking it of plans that have no RMDs.
//
// It is also why N3 failed the first time: "flat at zero, the IRA is exhausted with or without the
// conversion" in 48 of 60 arms is a statement about goal 0, not about conversions.
const IRA_GOALS = [
    { key: 'goal0',   label: 'IRA Goal 0 (drain allowed)', value: 0 },
    { key: 'goal750', label: 'IRA Goal $750k (shipped)',   value: 750000 },
];

// How much to convert, as a fraction of the STARTING pre-tax IRA. Two sizes, because a direction
// that only holds at one program size is an artifact of that size and should be reported as one.
const S_FRACS = [0.15, 0.30];
// Width of the front and back blocks. Three values so "front-load" is not one arbitrary shape.
// k=10 against n=20 makes FRONT and BACK complementary halves.
const K_VALUES = [3, 5, 10];

// -- Scorer ------------------------------------------------------------------------------------
// Per-metric epsilon, keyed by metric name, with a THROW on anything unregistered. The throw is the
// point: P30h's second defect was a shared $1 threshold reaching a metric measured in fractions,
// and a lookup that silently defaults cannot fail loudly enough to catch that. Every metric
// registered here is in dollars over a ~$1M-$20M range, so $1 is a real threshold rather than a
// rounding artifact; a future fractional metric MUST add its own entry or the scorer refuses.
const EPS = Object.freeze({
    atnw:  1,        // after-tax terminal net worth, dollars
    spend: 1,        // lifetime delivered spend in current dollars
    rmd:   1,        // lifetime required distributions, nominal dollars
    gross: 1,        // lifetime gross converted, nominal dollars
    tax:   1,        // lifetime tax in current dollars
    ira:   1,        // terminal pre-tax IRA, dollars
    roth:  1,        // terminal Roth, dollars
});
function epsFor(metric) {
    if (!Object.prototype.hasOwnProperty.call(EPS, metric)) {
        throw new Error(`convtiming: no epsilon registered for metric "${metric}". `
            + `Register one deliberately -- a shared default is how P30h shipped a wrong verdict.`);
    }
    return EPS[metric];
}
const tie = (a, b, metric) => Math.abs(a - b) <= epsFor(metric);

// Winner among named arms on one metric, higher-is-better. Returns 'tie' when the SPREAD across all
// arms is within epsilon -- not when the top two happen to be close, and never "the first entry in
// the list", which is the exact defect P30h shipped.
function winnerOf(entries, metric) {
    const vals = entries.map(e => e.v);
    const hi = Math.max(...vals), lo = Math.min(...vals);
    if (hi - lo <= epsFor(metric)) return 'tie';
    const best = entries.filter(e => e.v >= hi - epsFor(metric));
    return best.length === 1 ? best[0].k : 'tie';
}

// -- Running one arm ---------------------------------------------------------------------------
const sumLog = (log, f) => log.reduce((a, r) => a + (f(r) || 0), 0);
let simCount = 0;
let timingViolations = 0;

// Did this logged year withdraw in month 1? The log row carries `timing` as the rendered string
// 'Early(Conv)' / 'Late(Spend)' (optimizer_core.js:1168); `_useEarly` is engine state and never
// reaches the row. The first version of this harness read `r.useEarly`, which is undefined on every
// row, so the pin assertion was VACUOUSLY satisfied and would have reported HELD whatever the
// engine did -- the same defect class as P30f's zero-predicate. Hence the throw: if the field ever
// goes missing or is renamed, this fails loudly instead of quietly passing.
function isEarly(r) {
    if (typeof r.timing !== 'string') {
        throw new Error('convtiming: log row has no `timing` field -- the pin assertion would be '
            + 'vacuous. Re-check the log row shape before trusting any result.');
    }
    return r.timing.startsWith('Early');
}
const anyEarly = (log) => log.some(isEarly);

function scheduleFor(shape, k, n, S) {
    const a = new Array(n).fill(0);
    const kk = Math.max(1, Math.min(k, n));
    if (shape === 'FRONT') for (let i = 0; i < kk; i++) a[i] = S / kk;
    else if (shape === 'BACK') for (let i = n - kk; i < n; i++) a[i] = S / kk;
    else for (let i = 0; i < n; i++) a[i] = S / n;
    return a;
}

function runArm(cell, shape, k, S) {
    const sched = scheduleFor(shape, k, N_YEARS, S);
    const res = simulate({
        ...COMMON, ...cell.s.over, STATEname: cell.st, spendGoal: cell.spend,
        ...cell.f.over, CashReserve: cell.rsv.value, growth: cell.growth,
        dividendRate: cell.growth === 0 ? 0 : COMMON.dividendRate,
        cashYield:    cell.growth === 0 ? 0 : COMMON.cashYield,
        convertExcessToRoth: false, extraConversionAmount: sched,
        iraBaseGoal: cell.goal.value,
        forceWithdrawTiming: 'late',
    });
    simCount++;
    // Checked on EVERY arm rather than on a sample: if any year came out Early the pin failed and
    // every number downstream is a P28j measurement wearing this phase's label.
    if (anyEarly(res.log)) timingViolations++;
    return {
        res,
        requested: S,
        gross: sumLog(res.log, r => r['-iraConvGrossTot']),
        net:   sumLog(res.log, r => r.rothConv),
        spend: res.totals.spendCurrentDollars ?? 0,
        tax:   res.totals.taxCurrentDollars ?? 0,
        rmd:   res.totals.rmd ?? 0,
        rmdTax: res.totals.rmdTax ?? 0,
        ira:   res.totals.terminal.ira,
        roth:  res.totals.terminal.roth,
        irmaaYears: res.log.filter(r => (r.IRMAA || 0) > 0).length,
        success: res.totals.success,
        futureIRARate: res.totals.futureIRARate ?? 0,
        capGainsRate: res.totals.capGainsRate ?? 0,
    };
}

// The plan's own unconstrained behavior. Never scored against the shaped arms -- it converts a
// different amount by construction -- but it says how much a real plan converts, which is the only
// thing that makes S_FRACS readable as "a lot" or "a little".
function runDefault(cell) {
    const res = simulate({
        ...COMMON, ...cell.s.over, STATEname: cell.st, spendGoal: cell.spend,
        ...cell.f.over, CashReserve: cell.rsv.value, growth: cell.growth,
        iraBaseGoal: cell.goal.value,
        forceWithdrawTiming: 'late',
    });
    simCount++;
    if (anyEarly(res.log)) timingViolations++;
    return { gross: sumLog(res.log, r => r['-iraConvGrossTot']), rmd: res.totals.rmd ?? 0,
             success: res.totals.success };
}

// Bisect the gross request so `read(arm)` lands on `target`. The direction is MEASURED at the
// bracket ends rather than assumed: the first version hard-coded "lifetime tax rises with the
// conversion" and produced 0 of 30 usable N2 cells, because over a 20-year horizon it does not --
// an arm that converts nothing carries a bigger IRA into RMD age and can pay MORE lifetime tax than
// one that converts. Assuming the sign turned a real non-monotonicity into an empty table.
//
// Returns { arm } on success, or { reason } naming why the target was unreachable, so a failed
// normalization is reported as a fact about the plan rather than as a blank row.
function bisectTo(cell, shape, k, S0, read, target, metric) {
    const at = (S) => runArm(cell, shape, k, S);
    let lo = 0, hi = S0 * 4;
    const loArm = at(lo), hiArm = at(hi);
    const vLo = read(loArm), vHi = read(hiArm);
    const eps = epsFor(metric);
    if (Math.abs(vHi - vLo) <= eps) {
        return { reason: (Math.abs(vLo) <= eps && Math.abs(vHi) <= eps)
            ? 'flat at zero: the IRA is exhausted with or without the conversion'
            : 'flat: the metric does not move with the request' };
    }
    const dir = vHi > vLo ? +1 : -1;                       // measured, not assumed
    const min = Math.min(vLo, vHi), max = Math.max(vLo, vHi);
    if (target < min - eps) return { reason: 'target below the whole bracket' };
    if (target > max + eps) return { reason: 'target above the whole bracket' };
    let arm = null;
    for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        arm = at(mid);
        const v = read(arm);
        if (Math.abs(v - target) <= eps) return { arm };
        if ((dir > 0) === (v < target)) lo = mid; else hi = mid;
    }
    return { reason: 'did not converge in 24 steps (the metric is not monotone in the request)' };
}

// -- Section 0: scorer self-check, BEFORE any sweep result is allowed to print ------------------
console.log('='.repeat(112));
console.log('P85 -- when conversions happen. Is earlier better, and is RMD suppression why?');
console.log('='.repeat(112));
console.log('');
console.log('0. SCORER SELF-CHECK  (runs first; a failure here voids everything below)\n');

const selfChecks = [];
function check(name, pass, detail) {
    selfChecks.push({ name, pass });
    console.log(`   ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  --  ' + detail : ''}`);
}

// A. Three IDENTICAL arms must tie. This is the case P30h's "ties awarded to the first entry in the
//    list" defect got wrong, and it got it wrong while printing a landslide.
{
    const v = 1234567.89;
    const w = winnerOf([{ k: 'FRONT', v }, { k: 'LEVEL', v }, { k: 'BACK', v }], 'atnw');
    check('identical arms tie (not "first entry wins")', w === 'tie', `winner=${w}`);
}
// B. A known ordering must NOT tie, and must name the right arm.
{
    const w = winnerOf([{ k: 'FRONT', v: 2e6 }, { k: 'LEVEL', v: 1e6 }, { k: 'BACK', v: 5e5 }], 'atnw');
    check('a real $1M spread names the right winner', w === 'FRONT', `winner=${w}`);
}
// C. A spread INSIDE epsilon ties even though the values differ.
{
    const w = winnerOf([{ k: 'FRONT', v: 1e6 }, { k: 'LEVEL', v: 1e6 + 0.4 },
                        { k: 'BACK', v: 1e6 - 0.4 }], 'atnw');
    check('a sub-epsilon spread ties', w === 'tie', `winner=${w}`);
}
// D. An unregistered metric THROWS. The defect class this guards is P30h's second one: a shared
//    threshold silently reaching a metric it is the wrong size for.
{
    let threw = false;
    try { winnerOf([{ k: 'A', v: 0.1 }, { k: 'B', v: 0.9 }], 'someFractionalMetric'); }
    catch (e) { threw = /no epsilon registered/.test(e.message); }
    check('an unregistered metric throws instead of defaulting', threw);
}
// E. Two runs of identical INPUTS must produce identical metrics. Tests the measurement plumbing,
//    not the scorer: if the engine were nondeterministic here every win count below is noise.
{
    const cell = { s: SCENARIOS[0], st: 'CA', rsv: RESERVES[0], f: FAMILIES[0],
                   goal: IRA_GOALS[0], spend: 64000, growth: COMMON.growth };
    const a = runArm(cell, 'LEVEL', 5, 300000), b = runArm(cell, 'LEVEL', 5, 300000);
    const aN = afterTaxNetWorth(a.res.totals.terminal, a.futureIRARate, a.capGainsRate);
    const bN = afterTaxNetWorth(b.res.totals.terminal, b.futureIRARate, b.capGainsRate);
    check('identical inputs reproduce identical metrics',
        tie(aN, bN, 'atnw') && tie(a.spend, b.spend, 'spend') && tie(a.rmd, b.rmd, 'rmd'));
}
// F. The pin holds on a constructed arm, and the UNPINNED run of the same plan really would have
//    differed -- otherwise the pin is decoration and this section asserts nothing.
{
    const cell = { s: SCENARIOS[0], st: 'CA', rsv: RESERVES[0], f: FAMILIES[1],
                   goal: IRA_GOALS[0], spend: 64000, growth: COMMON.growth };
    const pinned = runArm(cell, 'FRONT', 5, 300000);
    const unpinned = simulate({
        ...COMMON, ...cell.s.over, spendGoal: cell.spend, ...cell.f.over, CashReserve: null,
        convertExcessToRoth: false, extraConversionAmount: scheduleFor('FRONT', 5, N_YEARS, 300000),
    });
    simCount++;
    check('pin holds, and the unpinned plan really does flip to Early',
        !anyEarly(pinned.res.log) && anyEarly(unpinned.log),
        `pinned Early years=${pinned.res.log.filter(isEarly).length}, `
        + `unpinned Early years=${unpinned.log.filter(isEarly).length}`);
}

if (selfChecks.some(c => !c.pass)) {
    console.log('\n   SCORER SELF-CHECK FAILED. Nothing below would be trustworthy; aborting.\n');
    process.exit(1);
}
console.log('');

// -- The sweep ---------------------------------------------------------------------------------
const SHAPES = ['FRONT', 'LEVEL', 'BACK'];
const cells = [];
for (const s of SCENARIOS) for (const rate of SPEND_RATES) for (const st of STATES)
    for (const rsv of RESERVES) for (const f of FAMILIES) for (const goal of IRA_GOALS) {
        const total = s.over.IRA1 + s.over.IRA2 + s.over.Roth + s.over.Roth2
                    + s.over.Brokerage + s.over.Cash;
        cells.push({ s, rate, st, rsv, f, goal, spend: Math.round(total * rate),
                     ira0: s.over.IRA1 + s.over.IRA2, growth: COMMON.growth });
    }

const cellKey = (c) => [c.s.key, c.rate, c.st, c.rsv.key, c.f.key, c.goal.key].join('|');
// Pairing key for the growth-6% and growth-0% grids: same cell AND same program size AND same
// block width. Pairing on the cell alone would have compared a k=3 arm against a k=10 one.
const armKey = (r) => [cellKey(r.cell), r.sf, r.k].join('|');
const scoreArms = (arms, refArm) => {
    for (const sh of SHAPES) {
        arms[sh].atnw = afterTaxNetWorth(arms[sh].res.totals.terminal,
                                         refArm.futureIRARate, refArm.capGainsRate);
    }
};
const spendClean = (arms) => tie(arms.FRONT.spend, arms.LEVEL.spend, 'spend')
                          && tie(arms.LEVEL.spend, arms.BACK.spend, 'spend');

// N1: equal lifetime GROSS.
const N1 = [];
for (const cell of cells) for (const sf of S_FRACS) for (const k of K_VALUES) {
    const S = Math.round(cell.ira0 * sf);
    const arms = {};
    for (const shape of SHAPES) arms[shape] = runArm(cell, shape, k, S);
    scoreArms(arms, arms.LEVEL);
    N1.push({ cell, sf, k, S, arms,
              delivered: SHAPES.every(sh => tie(arms[sh].gross, S, 'gross')),
              solvent:   SHAPES.every(sh => arms[sh].success),
              clean:     spendClean(arms),
              winner: winnerOf(SHAPES.map(sh => ({ k: sh, v: arms[sh].atnw })), 'atnw') });
}

// DEFAULT reference, one per cell.
const DEF = new Map();
for (const cell of cells) DEF.set(cell, runDefault(cell));

// C3: the same N1 question with growth, dividends and cash yield at zero, over the SAME shape of
// grid as N1 so the two can be paired cell for cell.
const ZERO = [];
for (const cell of cells) for (const sf of S_FRACS) for (const k of K_VALUES) {
    const zc = { ...cell, growth: 0 };
    const S = Math.round(cell.ira0 * sf);
    const arms = {};
    for (const shape of SHAPES) arms[shape] = runArm(zc, shape, k, S);
    scoreArms(arms, arms.LEVEL);
    ZERO.push({ cell, sf, k, S, arms,
                delivered: SHAPES.every(sh => tie(arms[sh].gross, S, 'gross')),
                solvent:   SHAPES.every(sh => arms[sh].success),
                clean:     spendClean(arms) });
}

// N2 / N3 on the CA / reserve-off slice at k=5, S=30%: bisection costs ~50x an N1 cell, and a slice
// that says it is a slice beats a full grid nobody can run.
const SLICE = cells.filter(c => c.st === 'CA' && c.rsv.key === 'off');
const N2 = [], N3 = [];
for (const cell of SLICE) {
    const S = Math.round(cell.ira0 * 0.30);
    const level = runArm(cell, 'LEVEL', 5, S);
    const n2 = { cell, S, arms: { LEVEL: level } };
    const n3 = { cell, S, arms: { LEVEL: level } };
    n2.why = []; n3.why = [];
    for (const shape of ['FRONT', 'BACK']) {
        const r2 = bisectTo(cell, shape, 5, S, a => a.tax, level.tax, 'tax');
        const r3 = bisectTo(cell, shape, 5, S, a => a.ira, level.ira, 'ira');
        n2.arms[shape] = r2.arm || null; if (r2.reason) n2.why.push(`${shape}: ${r2.reason}`);
        n3.arms[shape] = r3.arm || null; if (r3.reason) n3.why.push(`${shape}: ${r3.reason}`);
    }
    for (const rec of [n2, n3]) {
        rec.ok = SHAPES.every(sh => rec.arms[sh] && rec.arms[sh].success);
        if (!rec.ok) continue;
        scoreArms(rec.arms, level);
        rec.clean = spendClean(rec.arms);
        rec.winner = winnerOf(SHAPES.map(sh => ({ k: sh, v: rec.arms[sh].atnw })), 'atnw');
    }
    N2.push(n2); N3.push(n3);
}

// -- Output ------------------------------------------------------------------------------------
const money = (n) => (n == null || Number.isNaN(n)) ? '      -     '
    : (n < 0 ? '-' : ' ') + '$' + Math.round(Math.abs(n)).toLocaleString().padStart(11);
const pad = (s, n) => String(s).padEnd(n);
const pct = (r) => (r * 100).toFixed(0) + '%';
const med = (v) => v.length ? v.slice().sort((a, b) => a - b)[Math.floor(v.length / 2)] : null;

console.log(`Grid: ${SCENARIOS.length} mixes x ${SPEND_RATES.length} spend rates x ${STATES.length} states x `
    + `${RESERVES.length} reserve settings x ${FAMILIES.length} families x ${IRA_GOALS.length} IRA Goals `
    + `= ${cells.length} cells,`);
console.log(`      x ${S_FRACS.length} program sizes x ${K_VALUES.length} block widths x ${SHAPES.length} shapes `
    + `for N1 (${N1.length} comparisons), plus a zero-growth arm and a bisected CA/reserve-off slice.`);
console.log(`      ${simCount} simulations total.`);
console.log('');
console.log(`Timing pin: ${timingViolations === 0
    ? 'HELD -- every logged year of every arm came out Late.'
    : 'VIOLATED in ' + timingViolations + ' arms. THE RUN IS VOID.'}`);
console.log('');

// 1. Delivery and solvency, before any win is counted.
const undelivered = N1.filter(r => !r.delivered).length;
const insolvent   = N1.filter(r => r.delivered && !r.solvent).length;
const dirty       = N1.filter(r => r.delivered && r.solvent && !r.clean).length;
const live        = N1.filter(r => r.delivered && r.solvent && r.clean);
console.log('1. WHAT IS ACTUALLY COMPARABLE\n');
console.log(`   ${N1.length} N1 comparisons attempted.`);
console.log(`     undelivered (IRA balance capped the request)     : ${undelivered}`);
console.log(`     delivered but a plan ran out of money            : ${insolvent}`);
console.log(`     solvent but delivered spend differs across arms  : ${dirty}`);
console.log(`     CLEAN -- equal gross, equal spend, all solvent   : ${live.length}`);
console.log('');

// 2. The headline.
console.log('2. N1 -- EQUAL LIFETIME GROSS. Who wins, on after-tax terminal net worth?\n');
const tally = (rows) => {
    const t = { FRONT: 0, LEVEL: 0, BACK: 0, tie: 0 };
    for (const r of rows) t[r.winner]++;
    return t;
};
const tAll = tally(live);
console.log(`   over all ${live.length} clean cells:   FRONT ${tAll.FRONT}   LEVEL ${tAll.LEVEL}   `
    + `BACK ${tAll.BACK}   tie ${tAll.tie}`);
console.log('');
console.log('   ' + pad('slice', 26) + pad('FRONT', 7) + pad('LEVEL', 7) + pad('BACK', 7) + pad('tie', 7)
    + 'median FRONT-BACK');
const sliceRow = (label, rows) => {
    const t = tally(rows);
    console.log('   ' + pad(label, 26) + pad(t.FRONT, 7) + pad(t.LEVEL, 7) + pad(t.BACK, 7) + pad(t.tie, 7)
        + (rows.length ? money(med(rows.map(r => r.arms.FRONT.atnw - r.arms.BACK.atnw))) : '   -'));
};
for (const k of K_VALUES) sliceRow(`k = ${k} years`, live.filter(r => r.k === k));
for (const sf of S_FRACS) sliceRow(`S = ${pct(sf)} of IRA`, live.filter(r => r.sf === sf));
for (const g of IRA_GOALS) sliceRow(g.label, live.filter(r => r.cell.goal.key === g.key));
for (const f of FAMILIES) for (const g of IRA_GOALS) {
    sliceRow(`  ${f.key} @ ${g.key}`, live.filter(r => r.cell.f.key === f.key && r.cell.goal.key === g.key));
}
for (const st of STATES) sliceRow(`state ${st}`, live.filter(r => r.cell.st === st));
for (const rate of SPEND_RATES) sliceRow(`spend ${pct(rate)} of assets`, live.filter(r => r.cell.rate === rate));
console.log('');

// 3. The mechanism.
console.log('3. MECHANISM -- lifetime RMDs, net landed in Roth, IRMAA years  (clean N1 cells)\n');
const frontLowerRMD = live.filter(r => r.arms.FRONT.rmd < r.arms.BACK.rmd - epsFor('rmd')).length;
const backLowerRMD  = live.filter(r => r.arms.BACK.rmd < r.arms.FRONT.rmd - epsFor('rmd')).length;
const rmdTies       = live.length - frontLowerRMD - backLowerRMD;
console.log(`   lifetime RMD: FRONT lower in ${frontLowerRMD} of ${live.length}, `
    + `BACK lower in ${backLowerRMD}, within $1 in ${rmdTies}`);
for (const g of IRA_GOALS) {
    const sub = live.filter(r => r.cell.goal.key === g.key);
    const zeroBoth = sub.filter(r => r.arms.FRONT.rmd <= 1 && r.arms.BACK.rmd <= 1).length;
    console.log(`     ${pad(g.label, 34)} ${pad(sub.length + ' cells', 12)}`
        + `${zeroBoth} of them take NO RMD in either arm`);
}
if (live.length) {
    const rd = live.map(r => r.arms.BACK.rmd - r.arms.FRONT.rmd).sort((a, b) => a - b);
    console.log(`   BACK-minus-FRONT lifetime RMD:   min ${money(rd[0])}   median ${money(med(rd))}   max ${money(rd[rd.length - 1])}`);
    const nd = live.map(r => r.arms.FRONT.net - r.arms.BACK.net).sort((a, b) => a - b);
    console.log(`   FRONT-minus-BACK net into Roth off the SAME gross:`);
    console.log(`                                    min ${money(nd[0])}   median ${money(med(nd))}   max ${money(nd[nd.length - 1])}`);
    const rr = live.map(r => r.arms.FRONT.roth - r.arms.BACK.roth).sort((a, b) => a - b);
    console.log(`   FRONT-minus-BACK terminal Roth:   min ${money(rr[0])}   median ${money(med(rr))}   max ${money(rr[rr.length - 1])}`);
    const id = live.map(r => r.arms.FRONT.irmaaYears - r.arms.BACK.irmaaYears).sort((a, b) => a - b);
    console.log(`   FRONT-minus-BACK IRMAA years:     min ${id[0]}   median ${med(id)}   max ${id[id.length - 1]}`);
}
// WHERE C2 BREAKS. The first run of this harness found FRONT lower in 186 of 186 and called the
// RMD claim universal. That was measured at iraBaseGoal 0 and on the pre-P84l RMD basis; with the
// shipped goal and the corrected basis there are real counterexamples, and a bare count of them
// would hide which plans they are.
{
    const bad = live.filter(r => r.arms.BACK.rmd < r.arms.FRONT.rmd - epsFor('rmd'));
    console.log('');
    console.log(`   COUNTEREXAMPLES -- ${bad.length} cells where FRONT has the HIGHER lifetime RMD:`);
    const group = (label, keyOf) => {
        const m = new Map();
        for (const r of live) {
            const k2 = keyOf(r);
            if (!m.has(k2)) m.set(k2, { n: 0, bad: 0 });
            m.get(k2).n++;
        }
        for (const r of bad) m.get(keyOf(r)).bad++;
        const parts = [...m].map(([k2, v]) => `${k2} ${v.bad}/${v.n}`).join('   ');
        console.log(`     by ${pad(label, 14)} ${parts}`);
    };
    group('IRA Goal', r => r.cell.goal.key);
    group('family',   r => r.cell.f.key);
    group('spend',    r => pct(r.cell.rate));
    group('block k',  r => 'k' + r.k);
    group('program',  r => 'S' + pct(r.sf));
}
console.log('');

// 4. C3, the zero-growth arm.
console.log('4. C3 -- THE SAME QUESTION WITH GROWTH, DIVIDENDS AND CASH YIELD AT ZERO\n');
const zLive = ZERO.filter(r => r.delivered && r.solvent && r.clean);
const zByKey = new Map(zLive.map(r => [armKey(r), r]));
const PAIRED = live.map(r => ({ g: r, z: zByKey.get(armKey(r)) })).filter(p => p.z);
{
    const zU = ZERO.filter(r => !r.delivered).length;
    const zI = ZERO.filter(r => r.delivered && !r.solvent).length;
    console.log(`   zero-growth grid: ${ZERO.length} comparisons, ${zU} undelivered, `
        + `${zI} insolvent, ${zLive.length} clean.`);
    console.log('   At zero growth the IRA never replenishes, so the delivery cap bites much harder');
    console.log('   than it does at 6% -- which is itself worth knowing, and is why the comparison');
    console.log('   below is PAIRED rather than a median against a median.');
    console.log('');
    if (!PAIRED.length) {
        console.log('   no comparison is clean at both growth rates.');
    } else {
        const zPos = zLive.filter(r => r.arms.FRONT.atnw - r.arms.BACK.atnw > epsFor('atnw')).length;
        const zNeg = zLive.filter(r => r.arms.BACK.atnw - r.arms.FRONT.atnw > epsFor('atnw')).length;
        console.log(`   at growth 0%, over all ${zLive.length} clean: FRONT ahead in ${zPos}, `
            + `BACK ahead in ${zNeg}, within $1 in ${zLive.length - zPos - zNeg}`);
        console.log('');
        console.log(`   PAIRED on the ${PAIRED.length} comparisons clean at BOTH rates `
            + '(same cell, same S, same k):');
        console.log('     6% growth  median |FRONT-BACK| '
            + money(med(PAIRED.map(p => Math.abs(p.g.arms.FRONT.atnw - p.g.arms.BACK.atnw)))));
        console.log('     0% growth  median |FRONT-BACK| '
            + money(med(PAIRED.map(p => Math.abs(p.z.arms.FRONT.atnw - p.z.arms.BACK.atnw)))));
        const pf = PAIRED.filter(p => p.z.arms.FRONT.atnw - p.z.arms.BACK.atnw > epsFor('atnw')).length;
        console.log(`     of those ${PAIRED.length}, FRONT is still ahead at 0% growth in ${pf}.`);
    }
}
console.log('');

// 5. N2 and N3.
console.log('5. N2 (equal lifetime tax) and N3 (equal terminal IRA)  --  CA / reserve-off, k=5, S=30%\n');
const rep = (label, rows) => {
    const ok = rows.filter(r => r.ok && r.clean);
    const t = tally(ok);
    console.log(`   ${pad(label, 34)} usable ${pad(ok.length + '/' + rows.length, 8)}`
        + `FRONT ${pad(t.FRONT, 5)}LEVEL ${pad(t.LEVEL, 5)}BACK ${pad(t.BACK, 5)}tie ${pad(t.tie, 5)}`
        + `median FRONT-BACK ${ok.length ? money(med(ok.map(r => r.arms.FRONT.atnw - r.arms.BACK.atnw))) : '  -'}`);
};
const n1Slice = live.filter(r => r.k === 5 && r.sf === 0.30 && r.cell.st === 'CA' && r.cell.rsv.key === 'off')
                    .map(r => ({ ...r, ok: true }));
rep('N1  same slice, for comparison', n1Slice);
rep('N2  equal lifetime tax', N2);
rep('N3  equal terminal pre-tax IRA', N3);
const reasons = (rows, label) => {
    const tallyR = new Map();
    for (const r of rows) for (const w of (r.why || [])) {
        const key = w.replace(/^(FRONT|BACK): /, '');
        tallyR.set(key, (tallyR.get(key) || 0) + 1);
    }
    if (!tallyR.size) return;
    console.log(`   why ${label} lost arms:`);
    for (const [k2, n] of [...tallyR].sort((a, b) => b[1] - a[1])) console.log(`     ${n} x  ${k2}`);
};
reasons(N2, 'N2');
reasons(N3, 'N3');
console.log('');
console.log('   N3 is the decomposition: it holds the terminal pre-tax IRA -- the RMD stock -- equal by');
console.log('   construction. If FRONT keeps its lead there, compounding is paying. If the lead');
console.log('   collapses, RMD suppression is what FRONT was actually buying.');
console.log('');

// 6. Predictions.
console.log('6. PREDICTIONS, SCORED\n');
const verdicts = [];
const score = (id, text, held, evidence) => {
    verdicts.push({ id, held });
    console.log(`   ${id}  ${held ? 'HELD  ' : 'BROKEN'}  ${text}`);
    console.log(`         ${evidence}`);
};
const frontAhead = live.filter(r => r.arms.FRONT.atnw - r.arms.BACK.atnw > epsFor('atnw')).length;
score('C1', 'FRONT beats BACK on after-tax net worth in a majority of clean cells.',
    frontAhead * 2 > live.length,
    `FRONT ahead in ${frontAhead} of ${live.length} clean cells.`);
score('C2', 'FRONT has strictly lower lifetime RMDs in EVERY clean cell.',
    frontLowerRMD === live.length && live.length > 0,
    `FRONT lower in ${frontLowerRMD} of ${live.length}; BACK lower in ${backLowerRMD}; tied in ${rmdTies}.`);
{
    // PAIRED on the cells that are clean at BOTH growth rates. The first version took the median of
    // 29 six-percent cells against the median of 4 zero-percent cells -- two different samples,
    // which is P83's "nearest convenient statistic" defect: the ratio would have moved with which
    // cells happened to survive each arm rather than with growth.
    const paired = PAIRED;
    const gm = med(paired.map(p => Math.abs(p.g.arms.FRONT.atnw - p.g.arms.BACK.atnw))) ?? 0;
    const zm = med(paired.map(p => Math.abs(p.z.arms.FRONT.atnw - p.z.arms.BACK.atnw))) ?? 0;
    if (!paired.length) {
        console.log("   C3  UNTESTED  FRONT's advantage shrinks toward $0 as growth goes to zero.");
        console.log('         no cell is clean at both 6% and 0% growth; there is no paired comparison.');
    } else {
        score('C3', "FRONT's advantage shrinks toward $0 as growth goes to zero.",
            zm < gm * 0.25,
            `paired on the ${paired.length} cells clean at BOTH rates: median |FRONT-BACK| `
            + `${money(gm)} at 6% -> ${money(zm)} at 0%`
            + `  (${gm > 0 ? (zm / gm * 100).toFixed(1) + '% survives' : 'n/a'}).`);
    }
}
{
    // An even split is a TIE. The first version returned 'BACK' whenever FRONT failed to take a
    // strict majority, so a 4-4 slice printed as "favors BACK" -- the same species as P30h's
    // ties-go-to-the-first-entry, wearing the other arm's name.
    // A direction read off a handful of cells is not a direction. Below MIN_DIR usable cells the
    // answer is "not measured", which is a different sentence from "measured, and it disagreed".
    const MIN_DIR = 5;
    const dirOf = (rows) => {
        const ok = rows.filter(r => r.ok && r.clean);
        if (ok.length < MIN_DIR) return { dir: null, n: ok.length };
        const f = ok.filter(r => r.arms.FRONT.atnw - r.arms.BACK.atnw > epsFor('atnw')).length;
        const b = ok.filter(r => r.arms.BACK.atnw - r.arms.FRONT.atnw > epsFor('atnw')).length;
        return { dir: f > b ? 'FRONT' : b > f ? 'BACK' : 'tie', n: ok.length, f, b };
    };
    const d1 = dirOf(n1Slice), d2 = dirOf(N2);
    // A prediction with no data is UNTESTED, not BROKEN. Scoring it BROKEN would let an empty or
    // near-empty N2 table print as a refutation of the very thing it failed to measure. And two
    // TIES agreeing is not evidence that they agree about anything, so it is labelled as vacuous
    // rather than counted as a clean confirmation.
    if (d2.dir === null || d1.dir === null) {
        console.log('   C4  UNTESTED  N1 and N2 agree on direction.');
        console.log(`         needs ${MIN_DIR} usable cells a side; N1 slice has ${d1.n}, `
            + `N2 has ${d2.n}. No direction to compare.`);
    } else if (d1.dir === 'tie' && d2.dir === 'tie') {
        console.log('   C4  HELD (VACUOUS)  N1 and N2 agree on direction.');
        console.log(`         both are TIES (N1 ${d1.f}-${d1.b} of ${d1.n}, N2 ${d2.f}-${d2.b} of `
            + `${d2.n}). Two ties agree, and that is not evidence of anything.`);
    } else {
        score('C4', 'N1 and N2 agree on direction.', d1.dir === d2.dir,
            `N1 slice favors ${d1.dir} (${d1.f}-${d1.b} of ${d1.n}); `
            + `N2 favors ${d2.dir} (${d2.f}-${d2.b} of ${d2.n}).`);
    }
}
console.log('');
console.log(`   ${verdicts.filter(v => v.held).length} of ${verdicts.length} predictions held.`);
console.log('');

// 7. Context: what a plan converts when nobody constrains it.
console.log('7. FOR SCALE -- what these plans convert with no schedule imposed\n');
console.log('   ' + pad('mix', 32) + pad('family', 20) + pad('DEFAULT gross (median)', 26)
    + 'S at 15% / 30% of IRA');
for (const s of SCENARIOS) for (const f of FAMILIES) {
    const rows = cells.filter(c => c.s.key === s.key && c.f.key === f.key
                               && c.st === 'CA' && c.rsv.key === 'off');
    if (!rows.length) continue;
    console.log('   ' + pad(s.label, 32) + pad(f.label, 20)
        + pad(money(med(rows.map(c => DEF.get(c).gross))), 26)
        + money(rows[0].ira0 * 0.15) + ' /' + money(rows[0].ira0 * 0.30));
}
console.log('');
console.log('='.repeat(112));
