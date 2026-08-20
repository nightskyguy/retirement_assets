'use strict';
/**
 * irmaa_margin_harness.js -- where does the IRMAA threshold forecast actually matter, and is any
 * safety-margin setting preferable across portfolio sizes and constructions?
 *
 * Run:  node .test_harnesses/irmaa_margin_harness.js
 *
 * WHAT CHANGED, AND WHY THIS EXISTS
 * IRMAA bills year Y's premium against year Y+LOOKBACK's MAGI, judged against the thresholds
 * published for Y. The engine's CHARGE side always had that right (beginYear reads
 * magiHistory[-2] against sim.cpiRate). Its TARGETING side did not: every ceiling that caps THIS
 * year's MAGI used THIS year's threshold, so it aimed about (1+cpi)^|LOOKBACK| too low - roughly
 * 6% at 3% CPI. Fixing that removed an accidental cushion; `irmaaMarginMode` replaces it with a
 * deliberate one, and nobody knows which setting is right.
 *
 * ROUND 2 (this file). Round 1 swept 36 cells of one household shape against the tier ceiling only.
 * Three things forced a rewrite:
 *
 *   1. CYCLE BROKERAGE SWAMPS EVERYTHING. A hand run with `cyc=1` showed `cpiminus1` worth +0.68%
 *      of final wealth, which looked like a real preference. It was not. Patching the margin into a
 *      continuous dollar knob showed after-tax wealth is a smooth function of the SETBACK IN
 *      DOLLARS alone, peaking around $5,750 for that plan; `cpiminus1` won only because its setback
 *      ($5,606) landed nearest that peak, and `halfcpi` ($7,833) lost only because it overshot. The
 *      peak moved between $1,000 and beyond $9,000 across seven portfolio variants, and with Cycle
 *      Brokerage OFF the whole effect collapsed to +0.002%. The gain was harvest timing, not IRMAA.
 *      So every cell here pins `cyclicEnabled: false`. Chasing the cyclic interaction is a P32
 *      question, deliberately left there.
 *
 *   2. ONE OF THE THREE "FIXED" SITES IS PROVABLY INERT. `yr.IRMAALimit` can never differ from
 *      `yr.goalLimit` (proof below), so `minlimit` cannot be an arm at all. QCD "As Needed" CAN,
 *      and is where the forecast should bite hardest, so it gets its own arm.
 *
 *   3. WEALTH ALONE SCORES QCD DISHONESTLY. A QCD leaves the household for charity, so any setting
 *      that donates less looks richer. Every row therefore reports `household+given` alongside
 *      after-tax wealth. Ranking QCD arms on wealth alone would just rank them by stinginess.
 *
 * THE SIX MODES (optimizer_core.js, irmaaFwdFactor / irmaaMarginDollars)
 *   halfstep    default. Hold back half the annual surcharge that crossing this exact tier costs.
 *   none        aim at the projected threshold, minus the traditional $1.
 *   flat1000    hold back $1,000 of MAGI.       flat2000   hold back $2,000.
 *   halfcpi     project forward at half the expected CPI instead.
 *   cpiminus1   project forward at CPI less one point.
 * Plus `legacy`: the PRE-FIX ceiling, reproduced by forcing LOOKBACK to 0 so the forward factor
 * collapses to 1. LOOKBACK also sets the age gate (ELIGIBILITY_AGE + LOOKBACK), so every fixture
 * opens well past 65 and the gate is satisfied either way.
 *
 * THE STANDING LIMIT ON ALL OF THIS, WHICH NO SWEEP CAN LIFT
 * `sim.cpiRate *= (1 + inputs.cpi)` (optimizer_core.js:2774) - CPI is CONSTANT. Monte Carlo gives
 * each path its own `inflationSequence`, but that drives SPENDING inflation only; the CPI that
 * indexes IRMAA thresholds never varies. There is no run in this codebase where the threshold two
 * years out is uncertain, so a safety margin has nothing to be safe against and this harness can
 * only ever measure its COST. Treat every "which margin is best" number below as a statement about
 * ceiling tuning, never about protection. Validating protection needs a realized-vs-assumed CPI,
 * which is an engine change, not a harness one.
 *
 * ── PREDICTIONS, recorded BEFORE the numbers were looked at ──────────────────────────────────────
 *   P1. With cyclic OFF, every mode lands within +/-0.5% of `none` on the tier-ceiling arms. Round
 *       1 saw up to +17.9%, but that grid let the ceiling change how much got converted; here the
 *       arms are narrower.
 *   P2. QCD "As Needed" is the arm where the forecast bites hardest, because the forward projection
 *       moves the target dollar-for-dollar and the QCD is sized off exactly that gap.
 *   P3. A HIGHER target means a SMALLER donation, so `legacy` (lowest target) donates the most and
 *       `none` (highest) the least, with the margin modes ordered in between by setback size.
 *   P4. On `household+given`, the QCD arm's modes converge: the money either stays or is donated,
 *       and the tax difference between those two paths is second-order.
 *   P5. Clean breaches stay identical across all six modes on every arm, as in round 1. If P5 holds
 *       twice on a wider grid, "the margin prevents nothing measurable" is settled for this engine.
 */

// ── Bootstrap the engine exactly like brokerage_harness.js / optimizer_core.tests.js ─────────────
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
const { simulate, afterTaxWealthOfLogRow, IRMAA_MARGIN_MODES } = core;
const { TAXData, getRateBracket } = taxengine;

const MODES = [...IRMAA_MARGIN_MODES, 'legacy'];
const FUTURE_IRA_RATE = 0.22;   // the rate the Optimizer's default objective discounts IRA money at

// ── Base household ───────────────────────────────────────────────────────────────────────────────
// Born 1955/1956: past Medicare, past 70.5, so both the tier ceiling and QCD eligibility are live
// from year 0 and no cell is measuring an age gate opening instead of the thing under test.
const BASE = {
    STATEname: 'CA', strategy: 'bracket', stratRate: 0, stratACAMultiple: 0, stratIRMAATier: -1,
    nYears: 25,
    birthyear1: 1955, birthmonth1: 3, die1: 92,
    birthyear2: 1956, birthmonth2: 3, die2: 95, hasSpouse: true,
    IRA1: 2500000, IRA2: 500000, Roth: 200000, Roth2: 0,
    Brokerage: 600000, BrokerageBasis: 300000, Cash: 150000, CashReserve: 0,
    ss1: 45000, ss1Age: 70, ss2: 24000, ss2Age: 70,
    pensionAnnual: 0, survivorPct: 75, pensionCola: false,
    spendGoal: 180000, spendChange: 0, iraBaseGoal: 0,
    inflation: 0.03, cpi: 0.03, growth: 0.06, cashYield: 0.02, dividendRate: 0.015,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: true, propWithdraw: 0, iraWithdrawPct: 0.05,
    startYear: 2026, dividendReinvest: false,
    qcdHHMax: 0, qcdMode: 'always',
    // PINNED, not defaulted. The margin's apparent value on a hand-run plan turned out to be a
    // Cycle Brokerage harvest-timing artifact worth up to +2.8%, an order of magnitude larger than
    // anything IRMAA does here. Leaving it off keeps this harness measuring IRMAA.
    cyclicEnabled: false,
};

// ── The arms where the forward projection can actually change a result ─────────────────────────────
// Each names the site it exercises, so a result can be attributed without reading the engine.
const ARMS = [
    { key: 'ceilT0',  label: 'IRMAA Ceil, below-tier',
      site: 'computeBracketCeiling', targetTier: 0,
      over: { strategy: 'bracket', stratIRMAATier: 0 } },
    { key: 'ceilT2',  label: 'IRMAA Ceil, Tier 2',
      site: 'computeBracketCeiling', targetTier: 2,
      over: { strategy: 'bracket', stratIRMAATier: 2 } },
    // No IRMAA ceiling at all: `propwd` never consults one, so the ONLY forward-projected mechanism
    // in this arm is the QCD target. That isolation is the point.
    { key: 'qcd',     label: 'QCD As Needed (no ceiling)',
      site: 'getIRMAATierTargetMAGI', targetTier: null,
      over: { strategy: 'propwd', propWithdraw: 0, stratRate: 0, stratIRMAATier: -1,
              qcdHHMax: 60000, qcdMode: 'asneeded' } },
];

// ── Portfolio sizes and constructions ────────────────────────────────────────────────────────────
const SHAPES = [
    { key: 'IRA 1.2M',    over: { IRA1: 1000000, IRA2: 200000, spendGoal: 120000 } },
    { key: 'IRA 3.0M',    over: {} },
    { key: 'IRA 6.0M',    over: { IRA1: 5000000, IRA2: 1000000, spendGoal: 240000 } },
    { key: 'brok-heavy',  over: { Brokerage: 2000000, BrokerageBasis: 800000 } },
    { key: 'brok-thin',   over: { Brokerage: 50000, BrokerageBasis: 25000, Cash: 40000 } },
    { key: 'roth-heavy',  over: { Roth: 1500000, Roth2: 500000 } },
    { key: 'single',      over: { hasSpouse: false, birthyear2: 0, die2: 0, IRA2: 0, ss2: 0,
                                  Roth2: 0, spendGoal: 130000 } },
];
const CPIS = [0.02, 0.03, 0.04];

const CELLS = [];
for (const arm of ARMS)
  for (const shape of SHAPES)
    for (const cpi of CPIS)
      CELLS.push({
          arm, shape: shape.key, cpi,
          label: `${arm.key} / ${shape.key} / cpi ${(cpi * 100).toFixed(0)}%`,
          inputs: { ...BASE, ...shape.over, ...arm.over, cpi, inflation: cpi },
      });

// ── yr.IRMAALimit is INERT, and that is provable rather than measurable ──────────────────────────
// `minlimit` was going to be the third arm. It cannot be: the quantity it consults can never differ
// from the one it is compared against.
//
//   yr.goalLimit  = min(federal band top, state band top) containing sim.spendGoal
//   IRMAABracket  = findUpperLimitByAmount('IRMAA', status, yr.goalLimit, effCpi)
//   yr.IRMAALimit = min(yr.goalLimit, IRMAABracket.limit)
//
// findUpperLimitByAmount returns the top of the band CONTAINING its amount, so its result is >=
// that amount by construction. The min() therefore always selects yr.goalLimit, and the IRMAA
// lookup contributes nothing -- before the forward projection was added and after it. Projecting
// that threshold forward is harmless and equally pointless.
//
// Asserted over the whole plausible domain rather than argued, so a future change to the bracket
// ladder or to findUpperLimitByAmount turns this back into a live site loudly instead of silently.
function proveIRMAALimitIsInert() {
    let checked = 0, violations = [];
    for (const status of ['MFJ', 'SGL'])
        for (let goal = 1000; goal <= 900000; goal += 997)
            for (const infl of [1, 1.0609, 1.5, 2.4]) {
                checked++;
                const band = findUpperLimitByAmount('IRMAA', status, goal, infl);
                if (Math.abs(Math.min(goal, band.limit) - goal) > 1e-9)
                    violations.push(`${status} goal ${goal} infl ${infl} -> band top ${band.limit}`);
            }
    return { checked, violations };
}

// ── Metrics ──────────────────────────────────────────────────────────────────────────────────────
// A breach only counts as a TARGETING failure if the year that produced the MAGI actually respected
// the ceiling. The tier ceiling is a SOFT cap: when spending cannot be funded inside it and Cash,
// Brokerage and Roth are gone, the third pass draws IRA above the ceiling anyway and records it in
// ForcedIRA / BracketOverage. A tier charged off one of those years was never the ceiling's
// decision, and no margin could have prevented it. Only the CLEAN kind is a margin's business.
const TIER_INDEX = status => {
    const m = new Map();
    getRateBracket('IRMAA', status).forEach((b, i) => m.set(b.tier, i));
    return m;
};
function measure(inputs, targetTier) {
    const r = simulate(inputs);
    const idx = TIER_INDEX(inputs.hasSpouse ? 'MFJ' : 'SGL');
    const rows = r.log.filter(e => e.year !== undefined);
    const bySrcYear = new Map(rows.map(e => [e.year, e]));
    const lookback = -TAXData.IRMAA.LOOKBACK;
    const charged = rows.slice(Math.max(1, lookback)).filter(e => (e.IRMAA || 0) > 0);
    let clean = 0, soft = 0, cleanEligible = 0;
    if (targetTier !== null) {
        for (const e of charged) {
            const src = bySrcYear.get(e.year - lookback);
            const broke = src ? ((src.ForcedIRA || 0) > 1 || (src.BracketOverage || 0) > 1) : false;
            if (!broke) cleanEligible += 1;
            if ((idx.get(e.IRMAATier) ?? 0) > targetTier) { if (broke) soft += 1; else clean += 1; }
        }
    }
    const last = rows[rows.length - 1];
    const wealth = afterTaxWealthOfLogRow(last, FUTURE_IRA_RATE);
    const given  = rows.reduce((a, e) => a + (e.QCD1 || 0) + (e.QCD2 || 0), 0);
    return {
        wealth,
        // A QCD leaves the household, so wealth alone rewards giving less. This is the number that
        // compares two settings without paying one of them for being stingy.
        householdPlusGiven: wealth + given,
        given,
        irmaa: rows.reduce((a, e) => a + (e.IRMAA || 0), 0),
        tax: r.totals.tax,
        cleanBreaches: clean, softBreaches: soft, cleanEligible,
        chargedYears: charged.length,
        success: !!r.totals.success,
    };
}

// `legacy` = the pre-fix ceiling. Restored in a finally: TAXData is shared mutable state and a leak
// would silently corrupt every later cell rather than fail.
function runMode(inputs, targetTier, mode) {
    if (mode !== 'legacy') return measure({ ...inputs, irmaaMarginMode: mode }, targetTier);
    const saved = TAXData.IRMAA.LOOKBACK;
    try {
        TAXData.IRMAA.LOOKBACK = 0;
        return measure({ ...inputs, irmaaMarginMode: 'none' }, targetTier);
    } finally {
        TAXData.IRMAA.LOOKBACK = saved;
    }
}

// ── Run ──────────────────────────────────────────────────────────────────────────────────────────
const money = n => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
const pct = n => (n >= 0 ? '+' : '') + (n * 100).toFixed(3) + '%';

const results = CELLS.map(cell => {
    const byMode = {};
    for (const m of MODES) byMode[m] = runMode(cell.inputs, cell.arm.targetTier, m);
    return { ...cell, byMode };
});

console.log('# IRMAA safety margin, round 2 -- wide portfolio sweep, Cycle Brokerage OFF\n');
console.log(`${ARMS.length} arms x ${SHAPES.length} shapes x ${CPIS.length} CPI rates = ${CELLS.length} cells`);
console.log(`x ${MODES.length} modes = ${CELLS.length * MODES.length} simulations.`);
console.log('Wealth is after-tax final net worth, IRA discounted at ' + (FUTURE_IRA_RATE * 100) + '%.');
console.log('household+given adds back cumulative QCDs so a stingier setting is not scored as richer.\n');

// ── Per-arm aggregates: the question is WHERE the forecast matters, so arm is the primary cut ────
function aggregate(rows, m) {
    const rel  = rows.map(r => r.byMode[m].wealth / r.byMode.none.wealth - 1);
    const relG = rows.map(r => r.byMode[m].householdPlusGiven / r.byMode.none.householdPlusGiven - 1);
    const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    return {
        meanRel: mean(rel), worstRel: Math.min(...rel), bestRel: Math.max(...rel),
        meanRelGiven: mean(relG),
        wins: rows.filter(r => m !== 'legacy' && r.byMode[m].wealth >=
                Math.max(...IRMAA_MARGIN_MODES.map(x => r.byMode[x].wealth)) - 0.5).length,
        given: rows.reduce((a, r) => a + r.byMode[m].given, 0),
        irmaa: rows.reduce((a, r) => a + r.byMode[m].irmaa, 0),
        clean: rows.reduce((a, r) => a + r.byMode[m].cleanBreaches, 0),
        soft:  rows.reduce((a, r) => a + r.byMode[m].softBreaches, 0),
        cleanEligible: rows.reduce((a, r) => a + r.byMode[m].cleanEligible, 0),
        failures: rows.filter(r => !r.byMode[m].success).length,
    };
}

const armAgg = {};
for (const arm of ARMS) {
    const rows = results.filter(r => r.arm.key === arm.key);
    armAgg[arm.key] = {};
    console.log(`## ${arm.label}   (site: ${arm.site}, ${rows.length} cells)\n`);
    console.log(['mode'.padEnd(11), 'mean vs none'.padStart(13), 'worst'.padStart(10),
                 'best'.padStart(10), '+given'.padStart(13), 'won'.padStart(5),
                 'CLEAN breach'.padStart(14), 'soft'.padStart(6), 'QCD given'.padStart(14),
                 'IRMAA paid'.padStart(14)].join(' '));
    for (const m of MODES) {
        const a = aggregate(rows, m);
        armAgg[arm.key][m] = a;
        console.log([m.padEnd(11), pct(a.meanRel).padStart(13), pct(a.worstRel).padStart(10),
                     pct(a.bestRel).padStart(10), pct(a.meanRelGiven).padStart(13),
                     (m === 'legacy' ? '-' : String(a.wins)).padStart(5),
                     (arm.targetTier === null ? '-'
                        : `${a.clean}/${a.cleanEligible}` + (a.cleanEligible ? ` ${Math.round(100*a.clean/a.cleanEligible)}%` : '')).padStart(14),
                     (arm.targetTier === null ? '-' : String(a.soft)).padStart(6),
                     money(a.given).padStart(14), money(a.irmaa).padStart(14)].join(' '));
    }
    console.log('');
}

// ── The QCD hypothesis, tested directly ──────────────────────────────────────────────────────────
// Claim under test: a more generous (higher) target reduces the QCD needed, because As Needed
// donates exactly provisionalMAGI - (tierTarget - margin). Ordering the modes by their setback and
// checking donations rise monotonically is the whole test.
console.log('## Does a more generous threshold reduce the QCD needed?\n');
const qcdRows = results.filter(r => r.arm.key === 'qcd');
// Ordered by MEASURED donation, then checked against measured setback. An earlier version
// hardcoded the order and reported a false NO: `halfstep` holds back half the tier STEP, which at
// the Tier 1 -> Tier 2 boundary is larger than the flat $2,000, so its position is not fixed.
const setbackOrder = [...MODES].sort((a, b) => aggregate(qcdRows, b).given - aggregate(qcdRows, a).given);
console.log('Modes ordered by donation, largest first (= lowest effective target first):\n');
console.log(['mode'.padEnd(11), 'QCD given'.padStart(14), 'vs none'.padStart(12),
             'wealth vs none'.padStart(15), 'household+given'.padStart(16)].join(' '));
const qNone = aggregate(qcdRows, 'none');
for (const m of setbackOrder) {
    const a = aggregate(qcdRows, m);
    console.log([m.padEnd(11), money(a.given).padStart(14),
                 money(a.given - qNone.given).padStart(12),
                 pct(a.meanRel).padStart(15), pct(a.meanRelGiven).padStart(16)].join(' '));
}
// The hypothesis: a MORE GENEROUS (higher) target needs a SMALLER donation. Test it where it is
// unambiguous -- `none` has the highest target of any mode and `legacy` the lowest.
const qLegacy = aggregate(qcdRows, 'legacy');
const monotone = qNone.given < qLegacy.given
    && IRMAA_MARGIN_MODES.every(m => aggregate(qcdRows, m).given >= qNone.given - 1);
console.log(`\nHighest target (none) donates least: ${qNone.given < qLegacy.given ? 'YES' : 'NO'}`);
console.log(`No margin mode donates less than none: ${IRMAA_MARGIN_MODES.every(m => aggregate(qcdRows, m).given >= qNone.given - 1) ? 'YES' : 'NO'}`);
console.log(`Forward projection alone saves ${money(qLegacy.given - qNone.given)} of donation across these cells.`);

const inert = proveIRMAALimitIsInert();
console.log(`\n## yr.IRMAALimit inertness\n`);
console.log(`min(goalLimit, IRMAAband.limit) !== goalLimit in ${inert.violations.length} of ${inert.checked} combinations.`);
console.log(inert.violations.length === 0
    ? 'The site cannot change a result. `minlimit` is not swept here for that reason.'
    : 'LIVE AGAIN -- the site can now bind, so it needs an arm:\n  ' + inert.violations.slice(0, 5).join('\n  '));

// ── Predictions ──────────────────────────────────────────────────────────────────────────────────
const all = m => aggregate(results, m);
const ceilRows = results.filter(r => r.arm.key.startsWith('ceil'));
const verdicts = [
    ['P1 tier-ceiling modes within +/-0.5% of none',
     IRMAA_MARGIN_MODES.every(m => Math.abs(aggregate(ceilRows, m).meanRel) < 0.005),
     IRMAA_MARGIN_MODES.map(m => `${m} ${pct(aggregate(ceilRows, m).meanRel)}`).join(', ')],
    ['P2 QCD is the arm where the forecast bites hardest',
     Math.max(...IRMAA_MARGIN_MODES.map(m => Math.abs(aggregate(qcdRows, m).meanRel))) >
     Math.max(...IRMAA_MARGIN_MODES.map(m => Math.abs(aggregate(ceilRows, m).meanRel))),
     `qcd max ${pct(Math.max(...IRMAA_MARGIN_MODES.map(m => Math.abs(aggregate(qcdRows, m).meanRel))))}, `
     + `ceil max ${pct(Math.max(...IRMAA_MARGIN_MODES.map(m => Math.abs(aggregate(ceilRows, m).meanRel))))}`],
    ['P3 a higher target means a smaller donation', monotone,
     `legacy ${money(aggregate(qcdRows, 'legacy').given)} -> none ${money(qNone.given)}`],
    ['P4 household+given converges on the QCD arm',
     Math.max(...MODES.map(m => Math.abs(aggregate(qcdRows, m).meanRelGiven))) <
     Math.max(...MODES.map(m => Math.abs(aggregate(qcdRows, m).meanRel))),
     MODES.map(m => `${m} ${pct(aggregate(qcdRows, m).meanRelGiven)}`).join(', ')],
    // Scored as a RATE. A margin moves years BETWEEN the clean and soft buckets (it makes the
    // ceiling tighter, so more years break it to fund spending), which moves the denominator. Raw
    // counts across modes are therefore not comparable and an earlier version of this line scored
    // the wrong thing.
    ['P5 clean-breach RATE identical across all six modes',
     new Set(IRMAA_MARGIN_MODES.map(m => all(m).cleanEligible ? Math.round(100 * all(m).clean / all(m).cleanEligible) : -1)).size === 1,
     IRMAA_MARGIN_MODES.map(m => `${m} ${all(m).clean}/${all(m).cleanEligible}`).join(', ')],
];
console.log('\n## Predictions\n');
for (const [name, ok, detail] of verdicts)
    console.log(`${ok ? 'HELD  ' : 'WRONG '} ${name.padEnd(46)} ${detail}`);
const wrong = verdicts.filter(v => !v[1]);
console.log(`\n${verdicts.length - wrong.length} of ${verdicts.length} predictions held.`);
if (wrong.length) console.log('Wrong: ' + wrong.map(v => v[0].split(' ')[0]).join(', '));
