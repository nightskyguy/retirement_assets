// ============================================================================
// optimizer_core.js - pure simulation engine for the Retirement Optimizer.
//
// Contract: NO DOM, localStorage, or location access, at load time or runtime.
// Loaded three ways, all as a plain classic script sharing global scope:
//   1. retirement_optimizer.html (before optimizer_ui.js, after taxengine.js)
//   2. montecarlo/worker.js via importScripts (no DOM available there)
//   3. optimizer_core.tests.js via vm.runInContext (no DOM stubs needed)
// Depends on taxengine.js (calculateTaxes, calcIRMAA, TAXData, RMD_TABLE, ...) and on
// medicare_costs.js (medicareGrowthRate, medicareGrowthFactor).
//
// Shared globals owned by this file (optimizer_ui.js reads/writes cross-file):
//   STATEname       - set from inputs.STATEname on every simulate() call
//   simulationCount - incremented per simulate(); runOptimizer resets/reads it
//   SPEND_SEARCH_*  - MIN_DELTA is read by the UI spend banner
// ============================================================================
// medicare_costs.js is the one dependency this file fetches for itself, and only under node.
//
// The convention everywhere else is that the CALLER wires the globals before requiring this engine
// - that is how taxengine.js arrives, via Object.assign(globalThis, require('./taxengine.js')).
// But about twenty harnesses in .test_harnesses/ require this file directly, and a forgotten line
// in any one of them would be a runtime throw deep inside a simulation rather than at load. Since
// medicare_costs.js has zero dependencies of its own, self-installing costs nothing and cannot
// create a cycle.
//
// Inert in the browser and in the worker, where a preceding <script>/importScripts has already put
// the names in scope as bare globals.
if (typeof module !== 'undefined' && module.exports && typeof medicareGrowthFactor === 'undefined') {
    require('./medicare_costs.js');   // installs itself on globalThis
}

// Spend optimizer constants
const SPEND_SEARCH_CEILING   = 1.50;  // Binary search upper bound: 150% above baseline spend (2.5× input)
const SPEND_SEARCH_TOLERANCE = 0.005; // Stop binary search when bounds are within 0.5%
const SPEND_SEARCH_MIN_DELTA = 0.03;  // Minimum improvement to show "increase spending" banner
// Suggested-spend solver (suggestSustainableSpend). BUFFER_YEARS is the terminal cushion: the plan
// must end its last modeled year still holding at least this many years of portfolio-funded spend.
// Change it to make the suggestion more (higher) or less (lower) conservative.
const SUGGEST_BUFFER_YEARS = 5;
const SUGGEST_SCAN_STEPS   = 12;  // Coarse scan before the bisection refine. Never break early on a
                                  // fail: the pass/fail curve can dip across an ACA/IRMAA cliff, the
                                  // same non-unimodal hazard the bestConversionStopYear header documents.

// ── Rule defaults, tolerances and seeds ──────────────────────────────────────────────────────────
// Each of these was written at two or more sites, so each pair could drift apart silently.

// The Guardrails band and step behind `inputs.gkGuard` and `inputs.gkAdjPct`. The page's two number
// boxes carry the same pair in their `value=` attributes; every caller without a DOM reads it here.
const GK_DEFAULTS = Object.freeze({ guard: 0.20, adjPct: 0.10 });

// A year is FUNDED when delivered net income reaches this fraction of the year's target spend. The
// slack keeps a year landing a fraction of a percent under its target from being scored a failure,
// and it is not a licence to underfund, because the same test also requires the portfolio to cover
// the year's required draw. Annual Details shades its rows on the same fraction: a row shaded funded
// that the engine counted as a failure is the disagreement this exists to prevent. The charts mark a
// shortfall on a DIFFERENT and deliberately larger fraction - see CHART_SHORTFALL_FRACTION in
// optimizer_ui.js, which says why.
const FUNDED_TOLERANCE = 0.99;

// The IRA Goal draw aims the retained balance at the goal after the rest of the year's growth, then
// biases it this much under, because overshooting the goal is the worse error of the two.
const IRA_GOAL_UNDERSHOOT = 0.99;

// The cyclic harvest labels a year '⚠Brok' when the Brokerage balance is below this fraction of the
// gross draw the harvest needs.
const CYCLIC_DEPLETION_FRACTION = 0.5;

// BETR's per-year flag reads ▲ or ▼ only when the future rate differs from the break-even rate by
// more than this. Inside the band the two are reported as ≈.
const BETR_FLAG_BAND = 0.02;

// Brokerage and Cash weights for the gap fill when `inputs.gapFillWeights` (research only, no UI and
// no URL parameter) is absent or unusable.
const GAP_FILL_DEFAULT_WEIGHTS = Object.freeze([40, 60]);

// Year-0 tax rate, overwritten by the first calculateTaxes() call. It exists because the first year's
// draw has to be sized before any tax for that year has been computed.
const TAX_RATE_SEED = 0.20;

// The two ceiling rates every year starts with. A strategy that prices a limit overwrites both from
// `computeBracketCeiling`, so these survive only in a year no ceiling applies to - and they are still
// READ there, by the Brokerage rate the draw ordering uses (`applyWithdrawals`) and by the gap-fill
// tax estimate. They are assumptions, not measurements, which is why they carry names now.
const CEILING_RATE_PLACEHOLDERS = Object.freeze({ fed: 0.14, state: 0.07 });

// `inputs.ssFailYear` at or below this means no Social Security haircut is modeled at all. A year
// number is the switch and its own value, so the sentinel has to be a year no plan starts in.
const SS_FAIL_NEVER_BEFORE = 2000;

// Growth rate of last resort for the BETR estimate, when neither the year's own IRA growth nor
// `inputs.growth` is present. Matches the page's growth box default.
const GROWTH_FALLBACK = 0.06;

// Basis step-up fraction when the plan's state carries no `BasisStepUp`. UNREACHABLE from the page:
// all 38 selectable jurisdictions carry the key, the no-tax states included (theirs comes from
// NO_TAX_SHELL). It is here for a hand-edited plan naming a state that does not exist, and 0.50 is
// the common-law answer - the decedent's half only.
const BASIS_STEP_UP_FALLBACK = 0.50;

// ── Solver knobs: epsilons, search bounds and iteration caps ─────────────────────────────────────
// Six different epsilon VALUES live here, and they are six on purpose. A dollar comparison and a rate
// comparison cannot share a number, and folding them together would change results - which is why
// each one keeps its own value and its own name rather than collapsing into one EPS.

// A cent. Dollar amounts at or below it are nothing, and two dollar figures within it are the same
// figure. Read all through calculateWithdrawals, whose arithmetic is in dollars throughout.
const EPS_DOLLARS = 0.01;

// Floor on the (1 - taxRate) divisor that grosses a net draw up. It caps the gross at 100x the net
// rather than letting a tax rate at or above 100% produce a negative or infinite draw.
const NET_TO_GROSS_RATE_FLOOR = 0.01;

// |growth| at or below this takes the no-growth branch of the amortization, which exists because the
// general formula divides by the rate.
const EPS_GROWTH_ZERO = 1e-6;

// |real rate| below this takes the same branch for the real-dollar amortization.
const EPS_REAL_RATE_ZERO = 0.0001;

// Float equality for two figures that arithmetic should have made identical: a fee fully paid, a
// split vector already on the grid.
const EPS_EXACT = 1e-9;

// A conversion whose marginal tax share is below this earns no cash-funding credit; below it the
// credit rounds to nothing and the ratio t/(1-t) is unstable.
const EPS_TAX_SHARE = 0.0001;

// Two plans count as the same selection when each of their numbers is within this of the other's.
// A tenth of a percent: the numbers being compared are rates and weights, not dollars.
const EPS_SELECTION = 0.001;

// The heirs-rate search in breakEvenHeirsRate and lowestBreakEvenHeirsRate. `resolution` is the grid
// the answer is reported on, so it is also the smallest difference either can distinguish.
const BREAK_EVEN_SEARCH = Object.freeze({ minRate: 0.05, maxRate: 0.75, resolution: 0.01, coarseSteps: 4 });

// Fixed-point refinements. Each of these loops solves a net draw against the tax that draw causes,
// and converges in two passes on every household measured; the third is slack.
const GROSS_UP_REFINE_ITERS   = 3;   // net -> gross inside calculateWithdrawals
const REFUND_IRA_REFINE_ITERS = 3;   // cash-funded refund draw against its own tax

// The third pass's Brokerage leg. 'unbounded' is a research arm, which is why its cap is an order of
// magnitude larger: it is there to find out where the loop would stop on its own.
const THIRD_PASS_BROKERAGE_ITER_CAP = Object.freeze({ bounded: 6, unbounded: 200 });

// suggestSustainableSpend's ceiling: expand it by FACTOR up to EXPANSIONS times while the plan still
// passes, then stop and bisect. A rich plan needs the expansions; the cap stops a runaway.
const SUGGEST_CEILING_EXPANSIONS = 6;
const SUGGEST_CEILING_FACTOR     = 1.6;

// Guardrails shape memo: how many plans' shapes are kept before the oldest is dropped.
const GK_SHAPE_CACHE_MAX = 64;

// Sort sentinel for "this plan has no break-even year", so those rows sort last on a break-even
// column. A year number, deliberately far past any plan's horizon.
const BE_NEVER = 9999;

// The spend floor the Optimize Spend search starts from, and the floor the page reports when no
// spend at all passes. One function so the search and the message cannot disagree about it.
const SPEND_FLOOR_MIN      = 500;
const SPEND_FLOOR_FRACTION = 0.02;
function minSpendFloor(spendGoal) {
    return Math.max(SPEND_FLOOR_MIN, (spendGoal || 0) * SPEND_FLOOR_FRACTION);
}

// Baseline ranking weight: a dollar the household actually spends outranks a dollar bequeathed by
// 10%. Single source of truth shared by the optimizer table's `_baselineScore` (optimizer_ui.js) and
// the conversion sweep's 'baselineScore' metric (`baselineScoreOf` below) so the two cannot drift.
//
// The baseline score is real terminal after-tax net worth PLUS SPENDABLE_WEIGHT x lifetime spend in
// current dollars. Its PURPOSE is to prefer the plan that delivers MORE SPENDING when two plans are
// otherwise equal; without it a wealth-only score silently rewards an arm for spending less.
//
// Two things worth knowing before changing it:
//
//   1. `totals.spendCurrentDollars` ACCUMULATES over the horizon, so this multiplies LIFETIME spend
//      and not one year of it - about a third of the score on the default scenario, not a nudge.
//
//   2. It settles TIES, not trade-offs, and 1.10 is why. Sweeping the spend goal on a fixed arm, the
//      model gives up 1.4 to 3.3 dollars of real terminal wealth per extra dollar of lifetime
//      spending, so a value below that everywhere measured cannot make a genuinely higher-spending
//      plan win on score. Biasing REAL trade-offs toward spending would need a number above ~3.3,
//      and that is a preference decision rather than a modeling one.
const SPENDABLE_WEIGHT = 1.10;

/** TAX CONSTANTS **/
// Find these in taxengine.js

// The default state to use for STATE calculations.
let STATEname = 'CA'

// For DEBUGGING. Sprinkled throughout to catch NaN and undefined values hiding in the data.
function inspectForErrors(namedObjects) {
    let errorsFound = false;
    for (const [objName, inputs] of Object.entries(namedObjects)) {
        for (const [name, value] of Object.entries(inputs)) {
            // Skip objects, arrays, functions, and booleans
            if (value === undefined) {
                console.error(`❌ ${objName}.${name} is undefined`);
            } else if (isNaN(value)) {
                // This catches both NaN numbers AND strings that evaluate to NaN
                console.error(`❌ ${objName}.${name} is NaN (value: ${value}, type: ${typeof value})`);
                errorsFound = true;
            }
        }
    }
    if (errorsFound) debugger;
}

function getRMDPercentage(currentYear, birthYear) {
    // IRS uses "age attained during the year" = currentYear - birthYear (no +1).
    const age = currentYear - birthYear;
    if (age < rmdStartAge(birthYear)) return 0;
    return 1 / rmdDivisor(age);
}

// Tax-rate creep multiplier: bracket RATES escalate `rate` per year starting in `startYear`
// (bracket LIMITS are unaffected - those still track CPI, so every strategy's bracket/IRMAA/ACA
// ceiling is unchanged). A function of the CALENDAR YEAR only, never of realized inflation: Monte
// Carlo gives each path its own inflationSequence, and tax policy must not differ per path.
// Returns 1 when off or before the start year, so rate = 0 is a guaranteed no-op.
function taxCreepFactor(rate, currentYear, startYear) {
    if (!rate) return 1;
    return Math.pow(1 + rate, Math.max(0, currentYear - startYear));
}

// Property and other local taxes for the SALT itemizing test, in the simulation year's NOMINAL
// dollars. `calculateTaxes` computes min(stateTax + propTax, saltCap) against the standard
// deduction; without a caller passing `propTax`, SALT is state income tax alone and any household
// that would itemize is charged too much federal tax in every year.
//
// The amount is entered in today's dollars, like spendGoal, and `elapsed` is measured from the real
// current year rather than the plan's first year, so a plan starting in the future is inflated over
// the gap the same way spendGoal is.
//
// Three growth modes, because they are three genuinely different plans and the SALT cap turns the
// difference into a step rather than a smooth curve:
//   'inflation' (default) tracks the plan's general inflation rate. Uses `inputs.inflation`, NOT
//                         `inputs.cpi`: cpi indexes brackets, IRMAA tiers and COLA, and a property
//                         assessment is a household price, not a statutory threshold.
//   'flat'                a nominal-constant bill, which decays in real terms.
//   'custom'              an explicit rate, as a FRACTION like every other rate in this file - the
//                         Proposition 13 case (a 2% assessment cap) and the reassessment-heavy case.
//
// `inflationFactor` is `sim.inflation`, the REALIZED price level already compounded from the real
// current year, so the 'inflation' mode follows a Monte Carlo path as spendGoal does. 'flat' and
// 'custom' still compound from the base year and must: they are user POLICY rates, not the price
// level, so a path has nothing to say about them.
function propTaxFor(inputs, currentYear, baseYear, inflationFactor = null) {
    const base = +inputs.propTax || 0;
    if (base <= 0) return 0;                      // the default, and a guaranteed no-op
    const mode = inputs.propTaxGrowthMode || 'inflation';
    if (mode !== 'flat' && mode !== 'custom') {
        return base * (inflationFactor ?? Math.pow(1 + (+inputs.inflation || 0),
                                                   Math.max(0, currentYear - baseYear)));
    }
    const g = mode === 'flat' ? 0 : (+inputs.propTaxGrowthRate || 0);
    return base * Math.pow(1 + g, Math.max(0, currentYear - baseYear));
}

// The deepest one-year fall the model allows any inflation index to take.
//
// This is a COPY of INFLATION_FLOOR in montecarlo/prng.js, deliberately. That file clamps every
// DRAWN series with it - the synthetic AR(1) and all three bootstrap banks - so the record's real
// -10.3% years never reach this engine. The engine cannot import it: optimizer_core has no
// montecarlo dependency at all, and prng.js loads AFTER it in the page. Sharing one constant would
// drag the Monte Carlo data tables into the engine's load path, so it is duplicated and
// `P81: the engine floor matches the one the banks are drawn under` in optimizer_core.tests.js
// asserts the two are equal. That test is what makes the copy safe.
//
// NAMED DIFFERENTLY ON PURPOSE. montecarlo/worker.js importScripts taxengine.js, optimizer_core.js,
// prng.js, stats.js and mc_engine.js into ONE shared global scope, so two top-level `const
// INFLATION_FLOOR` declarations are a SyntaxError that kills the whole worker before it runs a
// single path. Node never sees it, because node modules have their own scope. Any new top-level
// name in this file has to be unique across all five.
const CPI_INDEX_FLOOR = -0.01;

// What a pension's cost-of-living adjustment is worth in a given year.
//
// Returns null for a pension that never rises, Infinity for one that tracks the index in full, or a
// decimal CAP - the plan pays the LESSER of that cap and the year's CPI, which is how a capped
// public plan reads. FERS pays a reduced COLA above 2% and most state and municipal plans cap at
// 2-3%, so an on/off switch would have to call all of those either uncapped or nothing, and
// 'uncapped' overstates every capped plan on exactly the high-inflation paths that decide an outcome.
//
// Accepts the old boolean as well as the strings, so saved plans, the sweep golden and existing
// tests keep their meaning without a migration: false is none, true is full.
//
// The cap is a MIN against the year's index rate, and that rate can be negative in a deflationary
// year. The zero floor that keeps a COLA from becoming a pay cut is applied where the factor
// advances (`endYear`), not here, so this returns the CAP alone and says nothing about the floor.
function pensionColaCap(inputs) {
    const v = inputs && inputs.pensionCola;
    if (v === true || v === 'full') return Infinity;
    if (v === false || v === 'none' || v === '' || v === undefined || v === null) return null;
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n / 100 : null;
}

// ── IRMAA targeting: this year's MAGI is judged two years from now ────────────────────────────
// IRMAA charges the premium in year Y against MAGI from year Y + LOOKBACK (LOOKBACK is -2), and SSA
// indexes the thresholds to the PREMIUM year. So a ceiling that caps THIS year's MAGI has to aim at
// the threshold published |LOOKBACK| years from now, not today's. The CHARGE side (`beginYear`'s
// calcIRMAA against magiHistory[-2]) has always been right; aiming at today's threshold under-fills
// every tier by (1+cpi)^2, which leaves conversion headroom unused rather than breaching a cliff.
//
// `irmaaMarginMode` chooses how much safety margin to hold back below that projected threshold. Two
// modes ('halfcpi', 'cpiminus1') express the margin by projecting at a SLOWER CPI rather than by
// subtracting dollars, so they live in the factor below; the rest get their dollars from
// `irmaaMarginDollars`. Every IRMAA-shaped ceiling in this file goes through both. Ordered
// strongest-setback first. A saved link or scenario carrying a retired mode falls through to
// IRMAA_MARGIN_DEFAULT below rather than erroring.
const IRMAA_MARGIN_MODES = ['halfcpi', 'cpiminus1', 'halfstep', 'flat2000', 'none'];

// Named rather than repeated, because it is asserted in the tests, read by the UI when the control
// is hidden, and relied on as the fallback for an unknown value - three places that must not drift.
// 'halfcpi' is the setting that saves surcharge across the widest range of CPI misses of the five,
// which is why it is the default.
const IRMAA_MARGIN_DEFAULT = 'halfcpi';

function irmaaMarginModeOf(inputs) {
    const m = inputs && inputs.irmaaMarginMode;
    return IRMAA_MARGIN_MODES.includes(m) ? m : IRMAA_MARGIN_DEFAULT;
}

// Multiplier that carries a threshold from today's indexing to the premium year that will judge this
// year's MAGI. Returns 1 at cpi = 0, so a zero-inflation run reproduces the un-projected numbers.
//
// Both haircut modes act on the PROJECTED INCREASE - the full |LOOKBACK|-year growth - rather than on
// the annual rate, so one sentence describes both: take half of it, or take one point off it.
//   full       (1+cpi)^2.                     3% -> +6.09%
//   halfcpi    half the increase.             3% -> +3.045%
//   cpiminus1  the increase, less one point.  3% -> +5.09%
//
// Subtracting the point from the ANNUAL rate and compounding that instead gives +4.04% at 3%, a far
// harsher haircut than "1% less" suggests and near-indistinguishable from halfcpi.
//
// Clamped at 1 so a low-CPI plan can never aim BELOW today's un-projected threshold, and so the
// cpi = 0 identity stays exact.
function irmaaFwdFactor(inputs) {
    const cpi = (inputs && inputs.cpi) || 0;
    const increase = Math.pow(1 + cpi, -TAXData.IRMAA.LOOKBACK) - 1;
    switch (irmaaMarginModeOf(inputs)) {
        case 'halfcpi':   return 1 + increase / 2;
        case 'cpiminus1': return Math.max(1, 1 + increase - 0.01);
        default:          return 1 + increase;
    }
}

// Dollar setback below `threshold`, which must ALREADY be forward-projected with `effCpiRate` as
// its multiplier. 'halfstep' asks calcIRMAA what crossing this exact boundary costs and holds back
// half of it, so the setback scales with the size of the cliff instead of being a guessed constant.
// The step is priced at THIS year's medicareRate rather than escalated to the premium year: that
// understates it by about two years of ANNUAL_INCREASE, on a figure already well under 1% of the
// threshold, which is not worth carrying an extra term for.
function irmaaMarginDollars(inputs, threshold, status, effCpiRate, medicareRate, onMedicareCount) {
    switch (irmaaMarginModeOf(inputs)) {
        case 'flat2000': return 2000;
        case 'halfstep': {
            const above = calcIRMAA(threshold,     status, effCpiRate, medicareRate, onMedicareCount);
            const below = calcIRMAA(threshold - 1, status, effCpiRate, medicareRate, onMedicareCount);
            return 0.5 * Math.max(0, above - below);
        }
        default: return 0;   // 'none', plus the two CPI-haircut modes already handled in irmaaFwdFactor
    }
}

// Filers who will be enrolled in Medicare by the time THIS year's MAGI is charged, i.e. who are
// already past ELIGIBILITY_AGE + LOOKBACK. Deliberately NOT yr.onMedicare: the tier ceiling switches
// on at 63, when nobody is enrolled yet, so pricing the margin off the current enrollment count would
// zero it out at exactly the ages the ceiling first bites.
// `enroll1`/`enroll2` default to true so the four-argument form still means "both enrolled", which
// is what every caller written before per-person enrollment existed meant. A person who is not
// enrolling owes no surcharge, so the ceiling must not be priced as though they will.
function onMedicareAtCharge(age1, age2, alive1, alive2, enroll1 = true, enroll2 = true) {
    const gate = TAXData.IRMAA.ELIGIBILITY_AGE + TAXData.IRMAA.LOOKBACK;
    return (alive1 && age1 >= gate && enroll1 ? 1 : 0) + (alive2 && age2 >= gate && enroll2 ? 1 : 0);
}

// Computes QCDs for the simulation year. Returns { qcd1, qcd2, totalQCD }.
// "Always" mode: donate up to qcdHHMax every eligible year.
// "As Needed" mode: donate only the minimum needed to drop below the current IRMAA tier cliff.
// Sourcing: larger eligible IRA first, then smaller if budget remains.
function computeAnnualQCDs(inputs, balance, simYear, qcdLimit, provisionalMAGI, cpiRate, alive1, alive2, status) {
    const elig1 = alive1 && isQCDEligible(inputs.birthyear1, inputs.birthmonth1, simYear);
    const elig2 = alive2 && isQCDEligible(inputs.birthyear2, inputs.birthmonth2, simYear);

    if (!elig1 && !elig2) return { qcd1: 0, qcd2: 0, totalQCD: 0 };
    if ((inputs.qcdHHMax || 0) <= 0) return { qcd1: 0, qcd2: 0, totalQCD: 0 };

    let qcdBudget = inputs.qcdHHMax;

    if (inputs.qcdMode === 'asneeded') {
        // Target: drop 2 IRMAA tiers, or escape all surcharges, whichever needs fewer QCDs. Returns
        // the MAGI ceiling of the target tier; 0 means already at the no-surcharge level.
        //
        // `effCpi`, not `cpiRate`: the MAGI being trimmed here is charged |LOOKBACK| years from now,
        // against the thresholds published for THAT year (see `irmaaFwdFactor`).
        //
        // THE FULL PROJECTION, AND NO MARGIN - deliberately, and unlike the tier ceiling, which is
        // why this asks `irmaaFwdFactor` for the 'none' factor rather than the user's. The margin
        // exists to guard a cliff the plan is deliberately aiming AT; on this arm the plan is already
        // aiming BELOW the threshold, and every dollar of margin is bought with a dollar that leaves
        // the household for charity. The asymmetry is structural - a surcharge is a few thousand a
        // year while the MAGI needed to clear a threshold is tens of thousands - so no setting could
        // pay for itself here.
        const effCpi = cpiRate * irmaaFwdFactor({ ...inputs, irmaaMarginMode: 'none' });
        const tierTarget = getIRMAATierTargetMAGI(provisionalMAGI, status, effCpi, 2);
        // 0 means the household is already clear of every surcharge, so there is nothing to escape
        // and donating anyway would be charity the tool never asked for.
        if (tierTarget === 0) return { qcd1: 0, qcd2: 0, totalQCD: 0 };
        const needed = provisionalMAGI - tierTarget;
        if (needed <= 0) return { qcd1: 0, qcd2: 0, totalQCD: 0 };
        qcdBudget = Math.min(inputs.qcdHHMax, needed);
    }

    if (qcdBudget <= 0) return { qcd1: 0, qcd2: 0, totalQCD: 0 };

    const avail1 = elig1 ? Math.min(balance.IRA1, qcdLimit) : 0;
    const avail2 = elig2 ? Math.min(balance.IRA2, qcdLimit) : 0;

    let qcd1 = 0, qcd2 = 0;
    if (avail1 >= avail2) {
        qcd1 = Math.min(qcdBudget, avail1);
        qcd2 = Math.min(Math.max(0, qcdBudget - qcd1), avail2);
    } else {
        qcd2 = Math.min(qcdBudget, avail2);
        qcd1 = Math.min(Math.max(0, qcdBudget - qcd2), avail1);
    }

    return { qcd1, qcd2, totalQCD: qcd1 + qcd2 };
}

// Calculate the withdrawal rate to reduce an account from currentIRA to targetIRA
// If the currentIRA is > targetIRA, withdraw enough to prevent targetIRA from being exceeded by growth.
function calculateAmortizedWithdrawal(currentIRA, targetIRA, years, growthRate) {
    if (years <= 0) return 0;

    // No growth special case (avoid divide by zero)
    if (Math.abs(growthRate) <= EPS_GROWTH_ZERO) {
        return (currentIRA - targetIRA) / years;
    }

    const factor = Math.pow(1 + growthRate, years);

    const numerator = currentIRA * factor - targetIRA;
    const denominator = (factor - 1) / growthRate;

    let withdrawal = numerator / denominator;

    if (withdrawal < 0) withdrawal = 0;

    return withdrawal;
}



/**
 * Calculate max IRA withdrawal that keeps MAGI within bracket limit.
 * @param {number} bracketTarget - MAGI ceiling (e.g., 100000 for 24% bracket)
 * @param {number} baseIncome - Fixed income components (pension + RMD + SS + interest/dividends + capital gains)
 * @returns {number} Maximum IRA withdrawal that keeps (baseIncome + IRA withdrawal) <= bracketTarget
 */
function calculateMaxIRAWithdrawalForBracket(bracketTarget, baseIncome) {
    return Math.max(0, bracketTarget - baseIncome);
}

///

/**
 * Calculate taxable capital gains from a brokerage account withdrawal.
 * Determines the proportional basis reduction and resulting capital gains
 * based on the withdrawal amount relative to total account balance.
 * 
 * @param {number} withdrawal - Requested withdrawal amount
 * @param {number} brokerageBalance - Current total brokerage account balance
 * @param {number} brokerageBasis - Current cost basis in the brokerage account
 * @returns {Object} Withdrawal calculation results
 * @returns {number} return.withdrawn - Actual amount withdrawn (limited by balance)
 * @returns {number} return.capitalGains - Amount subject to capital gains tax
 * @returns {number} return.basisChange - Reduction in cost basis (always positive)
 * @note Withdrawal is capped at available balance
 * @note Uses proportional basis reduction method
 */
function calculateBrokerageWithdrawal(withdrawal, brokerageBalance, brokerageBasis) {
    // Can't withdraw more than available balance
    const actualWithdrawal = Math.min(withdrawal, brokerageBalance);

    // Calculate proportion of account being withdrawn
    const proportion = brokerageBalance > 0 ? actualWithdrawal / brokerageBalance : 0;

    // Calculate basis reduction (proportional to withdrawal)
    const basisChange = brokerageBasis * proportion;

    // Amount subject to capital gains = withdrawal minus the basis portion
    const capitalGains = actualWithdrawal - basisChange;

    return {
        withdrawn: actualWithdrawal,           // Total amount withdrawn
        capitalGains: capitalGains,            // Amount subject to capital gains tax
        basisChange: basisChange               // Change in basis (positive = reduction)
    };
}

/**
 * Enforces the invariant BrokerageBasis <= Brokerage (P35f). You cannot hold more cost basis
 * than the account is worth; above it, `basis` is a paper loss, not basis.
 *
 * Every ordinary path already preserves this - surplus reinvestment and reinvested dividends
 * add the same dollars to value and to basis, and withdrawals reduce basis proportionally, so
 * the ratio is invariant. Only a NEGATIVE brokerage return can break it, by shrinking value
 * while basis stands still. That makes this a no-op for any run with non-negative brokerage
 * returns and a real correction under Monte Carlo, where down years are the point.
 *
 * @note Writes the unrealized loss down immediately. The engine models no capital-loss
 *       carryforward, so the loss is dropped rather than banked against a later gain; a plan
 *       that dips and recovers is taxed on the recovery. Understates nothing in the user's
 *       favor - it can only overstate the tax owed, never understate it.
 */
function clampBrokerageBasis(balance) {
    balance.BrokerageBasis = Math.min(balance.BrokerageBasis, Math.max(0, balance.Brokerage));
}

/**
 * Calculates withdrawal amounts from multiple accounts based on strategy, accounting for taxes
 * @param {Object} balances - Balances
 * @param {number} balances.IRA - IRA balance
 * @param {number} balances.Brokerage - Brokerage account balance
 * @param {number} balances.BrokerageBasis - Brokerage cost basis
 * @param {number} balances.Cash - Cash balance
 * @param {number} balances.Roth - Roth IRA balance
 * @param {number} gapAmount - Total NET amount needed (after taxes)
 * @param {Object} withdrawStrategy - Withdrawal strategy definition
 * @param {Array<string>} withdrawStrategy.order - Order of ALL accounts (including zero-weight)
 * @param {Array<number>} withdrawStrategy.weight - Relative weights for each account in order if null, weights are based on Balances.
 * @param {Array<number>} withdrawStrategy.taxrate - Tax rates for each account (0.0 to 1.0)
 * @returns {Object} Withdrawal amounts (gross), taxes paid, net amounts, and remaining shortfall
 */
function calculateWithdrawals(balances, gapAmount, withdrawStrategy) {
    // Initialize result structure
    const result = {
        totalTax: 0,
        netAmount: 0,
        shortfall: 0
    };

    // Check edge cases
    let errors = [];

    gapAmount == null || (gapAmount <= 0) && errors.push("gapAmount is null or <= 0");
    (withdrawStrategy == null || Object.keys(withdrawStrategy).length === 0) && errors.push("withdrawStrategy is null or empty");
    (balances == null || Object.keys(balances).length === 0) && errors.push("balances is null or empty");
    (withdrawStrategy?.order == null || Object.keys(withdrawStrategy.order).length === 0) && errors.push("withdrawal.order is null or empty");

    if (errors.length > 0) {
        result.errors = errors;
        return result;
    }

    const order = withdrawStrategy.order;
    const taxrates = withdrawStrategy.taxrate;
    const originalGapAmount = gapAmount;

    const { BrokerageBasis, ...rest } = balances;
    let totalFunds = Object.values(rest).reduce((sum, v) => sum + v, 0);

    let normalizedWeight;

    // Normalize the weights (if they exist - or create weights from balances if not.
    if (withdrawStrategy.weight?.length > 0) {
        const sum = withdrawStrategy.weight.reduce((a, b) => a + b, 0);
        normalizedWeight = withdrawStrategy.weight.map(w => w / sum);
    } else {
        const orderBalances = withdrawStrategy.order.map(acct => balances[acct]);
        const sum = orderBalances.reduce((a, b) => a + b, 0);
        normalizedWeight = orderBalances.map(bal => bal / sum);
    }	// withdrawStrategy.weight exists or not.	


    let netRemaining = gapAmount;

    // Phase 1: Process weighted accounts
    const netTargets = {};

    for (let i = 0; i < order.length; i++) {
        const account = order[i];
        const weight = normalizedWeight[i];
        netTargets[account] = weight > 0 ? (originalGapAmount * weight) : 0;
    }

    // Helper function to perform a withdrawal from an account
    function performWithdrawal(account, grossWithdrawal, accountIndex) {
        if (grossWithdrawal <= EPS_DOLLARS) return { netWithdrawal: 0, tax: 0 };

        const taxRate = taxrates[accountIndex] ?? 0;
        let netWithdrawal, tax;

        if (account === 'Brokerage') {
            // Use the brokerage-specific calculation
            const brokerageInfo = calculateBrokerageWithdrawal(
                grossWithdrawal,
                balances.Brokerage,
                balances.BrokerageBasis
            );

            // Tax only applies to capital gains
            tax = brokerageInfo.capitalGains * taxRate;
            netWithdrawal = grossWithdrawal - tax;

            // Track basis change
            if (!result.BrokerageBasis) result.BrokerageBasis = 0;
            result.BrokerageBasis += brokerageInfo.basisChange;

        } else {
            // For other accounts, simple calculation
            tax = grossWithdrawal * taxRate;
            netWithdrawal = grossWithdrawal - tax;
        }

        // Update result
        if (!result[account]) result[account] = 0;
        if (!result[account + 'Tax']) result[account + 'Tax'] = 0;

        result[account] += grossWithdrawal;
        result[account + 'Tax'] += tax;

        return { netWithdrawal, tax };
    }

    // Phase 1: Withdraw from weighted accounts up to their targets
    for (let i = 0; i < order.length; i++) {
        if (netRemaining <= EPS_DOLLARS) break;

        const account = order[i];
        const netTarget = netTargets[account];

        if (netTarget <= 0) continue; // Skip zero-weight accounts

        const available = balances[account] ?? 0;
        if (available <= EPS_DOLLARS) continue;

        // We need to solve for grossWithdrawal iteratively for brokerage
        // For simplicity, we'll use an approximation approach
        let grossWithdrawal;

        if (account === 'Brokerage') {
            // Iterative approach to find the right gross withdrawal
            // Start with an estimate
            const taxRate = taxrates[i] ?? 0;
            let estimate = netTarget / (1 - taxRate); // Initial estimate

            // Refine estimate (up to 3 iterations should be enough)
            for (let iter = 0; iter < GROSS_UP_REFINE_ITERS; iter++) {
                const testInfo = calculateBrokerageWithdrawal(estimate, balances.Brokerage, balances.BrokerageBasis);
                const testTax = testInfo.capitalGains * taxRate;
                const testNet = estimate - testTax;

                if (Math.abs(testNet - netTarget) < EPS_DOLLARS) break;

                // Adjust estimate
                const correction = netTarget - testNet;
                estimate += correction / (1 - taxRate * (testInfo.capitalGains / estimate));
            }

            grossWithdrawal = Math.min(estimate, available, netTarget / (1 - taxRate) * 2); // Safety cap
        } else {
            const taxRate = taxrates[i] ?? 0;
            const grossTarget = netTarget / (1 - taxRate);
            const grossNeeded = netRemaining / (1 - taxRate);
            grossWithdrawal = Math.min(grossTarget, available, grossNeeded);
        }

        grossWithdrawal = Math.min(grossWithdrawal, available);
        inspectForErrors({ available: available, grossWithdrawal: grossWithdrawal })

        const { netWithdrawal, tax } = performWithdrawal(account, grossWithdrawal, i);
        netRemaining -= netWithdrawal;
    }

    // Phase 2: If gap not satisfied, take from remaining balances in order
    if (netRemaining > EPS_DOLLARS) {
        for (let i = 0; i < order.length; i++) {
            if (netRemaining <= EPS_DOLLARS) break;

            const account = order[i];
            const alreadyWithdrawn = result[account] ?? 0;
            const available = (balances[account] ?? 0) - alreadyWithdrawn;

            if (available <= EPS_DOLLARS) continue;

            // Calculate how much gross we need to get the net we need
            let grossWithdrawal;

            if (account === 'Brokerage') {
                // Iterative approach for brokerage
                const taxRate = taxrates[i];
                let estimate = netRemaining / (1 - taxRate);

                for (let iter = 0; iter < GROSS_UP_REFINE_ITERS; iter++) {
                    const remainingBalance = balances.Brokerage - alreadyWithdrawn;
                    const remainingBasis = balances.BrokerageBasis - (result.BrokerageBasis ?? 0);

                    const testInfo = calculateBrokerageWithdrawal(estimate, remainingBalance, remainingBasis);
                    const testTax = testInfo.capitalGains * taxRate;
                    const testNet = estimate - testTax;

                    if (Math.abs(testNet - netRemaining) < EPS_DOLLARS) break;

                    const correction = netRemaining - testNet;
                    estimate += correction / (1 - taxRate * (testInfo.capitalGains / estimate));
                }

                grossWithdrawal = Math.min(estimate, available);
            } else {
                const taxRate = taxrates[i];
                const grossNeeded = netRemaining / (1 - taxRate);
                grossWithdrawal = Math.min(available, grossNeeded);
            }

            const { netWithdrawal, tax } = performWithdrawal(account, grossWithdrawal, i);
            netRemaining -= netWithdrawal;
        }
    }

    // Calculate totals
    let totalWithdrawals = Object.entries(result)
        .filter(([k]) => !k.endsWith('Tax') && !k.endsWith('Basis') && !k.includes('total') && k !== 'shortfall' && k !== 'netAmount' && k !== 'errors')
        .reduce((sum, [, v]) => sum + v, 0);

    result.totalTax = Object.entries(result)
        .filter(([k]) => k.endsWith('Tax'))
        .reduce((sum, [, v]) => sum + v, 0);

    result.netAmount = totalWithdrawals - result.totalTax;
    result.shortfall = Math.max(0, gapAmount - result.netAmount);

    // Round all results to 3 decimals
    Object.keys(result).forEach(k => {
        if (typeof result[k] === 'number') {
            result[k] = +result[k].toFixed(3);
        }
    });

    return result;
}


// Apply withdrawals  to the balances MUTATES balances!
function applyWithdrawals(balances, withdrawals) {
    for (const key in withdrawals) {
        if (key in balances) {
            balances[key] = Math.max(0, balances[key] - withdrawals[key]);
        }
    }
    return balances;  // Optional - for chaining/convenience
}

function accumulateWithdrawals(withdrawalsArray) {
    const totals = {};

    for (const withdrawals of withdrawalsArray) {
        for (const key in withdrawals) {
            if (key in totals) {
                totals[key] += withdrawals[key];
            } else {
                totals[key] = withdrawals[key];
            }
        } // for key in withdrawals
    } // for withdrawals
    return totals;
} // accumulateWithdrawals

// combines gains objects into one.
function combineGains(gains1, gains2) {
    const combined = {};
    const allKeys = new Set([...Object.keys(gains1), ...Object.keys(gains2)]);

    allKeys.forEach(key => {
        combined[key] = (gains1[key] ?? 0) + (gains2[key] ?? 0);
    });

    return combined;
}



/**
 * Growth factor for a FRACTION of a year, under the rate the inputs declare.
 *
 * The Growth input is a CAGR - its own tooltip says so and quotes historical CAGRs - so a part year
 * earns `(1 + rate)^(months/12)`, not `1 + rate*months/12`. The difference is not cosmetic: simple
 * proportional growth is not multiplicative, so cutting a year into segments MANUFACTURES growth,
 * and the excess peaks in the MIDDLE of the year. Every plan year here is split (preMonths is 1 or
 * 11), so that artifact landed squarely on the Early/Split/Late withdrawal-month comparison this
 * engine exists to let a user make. See findings.md, "Splitting a year into more growth segments
 * MANUFACTURES growth".
 *
 * Compounding is exactly multiplicative, so `f(a) * f(b) === f(a+b)` and a year may now be cut
 * into as many segments as the model needs with no excess at all.
 *
 * `months === 12` returns `1 + rate` rather than `Math.pow(1 + rate, 1)`: they differ in the last
 * bit (`(1+0.06)-1` is 0.06000000000000005, not 0.06), and full-year callers must stay exact.
 * A rate of -100% or worse wipes the balance rather than returning NaN from a fractional power of
 * a non-positive base.
 */
function growthFactor(rate, months) {
    if (months === 12) return 1 + rate;
    const base = 1 + rate;
    return base <= 0 ? 0 : Math.pow(base, months / 12);
}

/// Now allows specification of the number of months. Defaults to 12.
function applyGrowth(balances, growthRates, months = 12) {
    const gains = {}
    let gain = 0;

    for (const key in balances) {
        if (key in growthRates) {
            // Compound growth for the segment: balance * ((1 + rate)^(months/12) - 1).
            // The full-year case keeps the original expression so it stays bit-identical.
            gain = (months === 12)
                ? balances[key] * growthRates[key]
                : balances[key] * (growthFactor(growthRates[key], months) - 1);
            gains[key] = gain;
            balances[key] = Math.max(0, balances[key] + gain);
        }
        // If no matching rate, balance remains unchanged
    }
    return gains;  // Return the amounts gained/lost
}

/**
 * The three after-growth timing corrections (December tax settlement, conversion month, RMD month)
 * all move an amount from one part of the year to another AFTER `applyGrowth` has already run for
 * `postMonths`. Each is the same quantity:
 *
 *     shift = amount * (f(shiftMonths) - 1) * f(postMonths)
 *
 * the growth the amount earns over `shiftMonths`, itself compounded for the `postMonths` already
 * applied to the balance it is being added to.
 * were written `amount * rate * shiftMonths/12`, which is this expression's first-order term.
 *
 * `shiftMonths` may be negative - a conversion later in the year than the spending withdrawal -
 * and the factor is then below 1, so the shift reverses sign on its own.
 */
function timingShift(amount, rate, shiftMonths, postMonths) {
    return amount * (growthFactor(rate, shiftMonths) - 1) * growthFactor(rate, postMonths);
}


/////////////////////////////


// ============================================================================
// Social Security Survivor Benefit (SSA formula, FRA derived from birth year)
// ============================================================================

/**
 * Full Retirement Age in months, from TAXData.SOCIALSECURITY.FRA_MONTHS (the SSA schedule). Each
 * spouse has their own: the survivor benefit unwinds the deceased's claim against the deceased's
 * FRA and measures the survivor's early claim against the survivor's. A birth year that is not a
 * number gets the table's earliest row, 66.
 * @param {number} birthYear
 * @returns {number} FRA expressed in months
 */
function fraMonthsForBirthYear(birthYear) {
    const rows = TAXData.SOCIALSECURITY.FRA_MONTHS;
    const by = Math.round(+birthYear);
    const row = Number.isFinite(by) && rows.find(([from]) => by >= from);
    return (row || rows[rows.length - 1])[1];
}

/**
 * Fraction of a full year's Social Security actually paid in the year the person reaches their
 * claiming age. Ages in this engine are integers (age = year - birthyear), so the whole claim year
 * would otherwise be paid in full no matter which month the person was born in.
 *
 * A person born in month `bm` reaches their claiming age in month `bm` of that calendar year, so
 * `12 - bm` months of that year remain: December -> 0, June -> 0.5, January -> 11/12. December is
 * this app's DEFAULT birth month, so the default scenario books no Social Security at all in the
 * claim year. That is the correct answer for a December birthday and it is disclosed in the Start
 * Age tooltip; the default is deliberately not moved, because the birth month also drives QCD 70.5
 * eligibility (taxengine.js isQCDEligible).
 *
 * Not modeled: the mirror case at the other end, where benefits stop the month of death rather
 * than at the end of the death year.
 * @param {number} birthMonth 1-12; anything missing or out of range is treated as December.
 * @returns {number} 0..1
 */
function ssFirstYearFraction(birthMonth) {
    const bm = Number.isFinite(+birthMonth) ? Math.round(+birthMonth) : 12;
    if (bm < 1 || bm > 12) return 0;
    return (12 - bm) / 12;
}

/**
 * Returns the final monthly SS benefit for a surviving spouse.
 * @param {number} userAgeAtDeath       - Deceased's age at death
 * @param {number} userClaimAge         - Age the deceased claimed (or planned to claim) SS
 * @param {number} userMonthlyBenefit   - Deceased's monthly benefit at their claiming age
 * @param {number} spouseClaimAge       - Age the survivor claims their benefit
 * @param {number} spouseMonthlyBenefit - Survivor's own monthly benefit at their claiming age
 * @param {number} [userBirthYear]      - Deceased's birth year; sets THEIR FRA (default 1960+, i.e. 67)
 * @param {number} [spouseBirthYear]    - Survivor's birth year; sets THEIR FRA
 * @returns {number} Monthly dollar amount the survivor receives
 */
function calculateSurvivorBenefit(
    userAgeAtDeath, userClaimAge, userMonthlyBenefit,
    spouseClaimAge, spouseMonthlyBenefit,
    userBirthYear, spouseBirthYear
) {
    // Two different people, two different FRAs. The deceased's is what their own benefit at claim
    // age is unwound against; the survivor's is what their early-claim reduction is measured from.
    // The claiming rules themselves are TAXData.SOCIALSECURITY's.
    const SS = TAXData.SOCIALSECURITY;
    const userFRAMonths   = fraMonthsForBirthYear(userBirthYear   ?? 1960);
    const spouseFRAMonths = fraMonthsForBirthYear(spouseBirthYear ?? 1960);
    const userClaimMonths  = Math.round(userClaimAge  * 12);
    const userDeathMonths  = Math.round(userAgeAtDeath * 12);
    const spouseClaimMonths = Math.round(Math.max(spouseClaimAge, SS.SURVIVOR.MIN_AGE) * 12);

    // Step 1: Derive deceased's PIA at FRA from their benefit at claiming age
    let userPIA;
    if (userClaimMonths >= userFRAMonths) {
        const delayedMonths = userClaimMonths - userFRAMonths;
        userPIA = userMonthlyBenefit / (1 + delayedMonths * (SS.DELAYED_CREDIT_PER_YEAR / 12));
    } else {
        const reductionMonths = userFRAMonths - userClaimMonths;
        const E = SS.EARLY_REDUCTION;
        const reductionFactor = reductionMonths <= E.FIRST_MONTHS
            ? reductionMonths * E.FIRST_RATE
            : (E.FIRST_MONTHS * E.FIRST_RATE) + ((reductionMonths - E.FIRST_MONTHS) * E.LATER_RATE);
        userPIA = userMonthlyBenefit / (1 - reductionFactor);
    }

    // Step 2: Deceased's baseline for survivor purposes.
    // SS rules: if deceased claimed early, survivor is NOT penalized - baseline is PIA.
    // If deceased claimed late (delayed credits), survivor receives the full enhanced benefit.
    // Delayed credits stop at the claiming age (never accumulate past claim date or age 70).
    // So the baseline is simply the higher of PIA and the actual benefit at claiming age.
    const deceasedBaseline = Math.max(userPIA, userMonthlyBenefit);

    // Step 3: Apply survivor's early-claiming reduction if before FRA
    let rawSurvivorBenefit;
    if (spouseClaimMonths >= spouseFRAMonths) {
        rawSurvivorBenefit = deceasedBaseline;
    } else {
        // The maximum reduction is spread across the survivor's own span from the earliest claiming
        // age to FRA, so the span shortens with an earlier FRA: 84 months at FRA 67, 72 at FRA 66.
        const totalPossibleEarlyMonths = spouseFRAMonths - SS.SURVIVOR.MIN_AGE * 12;
        const earlyMonths = spouseFRAMonths - spouseClaimMonths;
        rawSurvivorBenefit = deceasedBaseline * (1 - (earlyMonths / totalPossibleEarlyMonths) * SS.SURVIVOR.MAX_REDUCTION);
    }

    // Step 4: Higher-of rule - survivor gets their own benefit if larger
    return Math.floor(Math.max(rawSurvivorBenefit, spouseMonthlyBenefit));
}

// Phase 21: Break-Even Tax Rate (Kitces formula, taxes paid from outside IRA).
// BETR = t_now × (1 + r_taxable)^n / (1 + r_ira)^n
// Derivation: at break-even, Roth outcome = IRA outcome.
// Roth: D grows tax-free → D×(1+r_ira)^n
// IRA (no-convert): D grows → D×(1+r_ira)^n×(1-t_future); taxable account keeps t_now×D → grows to t_now×D×(1+r_taxable)^n
// Solve for t_future that equalizes both paths.
// When r_taxable = r_ira: BETR = t_now (trivially break-even at same rate).
// When r_taxable < r_ira (taxable drag): BETR < t_now (conversion beneficial even at lower future rate).
function computeBETR(tNow, rIRA, rTaxable, n) {
    if (!tNow || n <= 0 || rIRA <= -1 || rTaxable <= -1) return null;
    return tNow * Math.pow(1 + rTaxable, n) / Math.pow(1 + rIRA, n);
}

// Returns how many LTCG dollars can stack above ordinaryIncome while staying in
// brackets with LTCG rate strictly below maxRate (e.g. 0.15 → only the 0% bracket).
function getLTCGBracketRoom(ordinaryIncome, status, maxRate, cpiRate) {
    const brackets = TAXData.FEDERAL.CAPITAL_GAINS[status]?.brackets ?? [];
    // Room spans ALL brackets whose rate is strictly below maxRate, combined into one continuous
    // span from $0 up to the last such bracket's ceiling (not just the single bracket ordinaryIncome
    // currently sits in) - e.g. maxRate=0.20 combines the 0% AND 15% brackets into one span.
    let ceiling = 0;
    for (const { l, r } of brackets) {
        if (r >= maxRate) break;
        ceiling = l * cpiRate;
    }
    return Math.max(0, ceiling - ordinaryIncome);
}

// Returns the LTCG rate (0, 0.15, or 0.20) of the bracket that (ordinaryIncome + totalGains)
// falls into - used by Cycle Brokerage to know which bracket a spend-forced harvest lands in.
function getLTCGBracketTopRate(ordinaryIncome, totalGains, status, cpiRate) {
    const brackets = TAXData.FEDERAL.CAPITAL_GAINS[status]?.brackets ?? [];
    const totalIncome = ordinaryIncome + totalGains;
    for (const { l, r } of brackets) {
        if (!isFinite(l) || totalIncome <= l * cpiRate) return r;
    }
    return brackets.length ? brackets[brackets.length - 1].r : 0;
}

// MAGI ceiling for bracket/aca strategies - shared by the normal per-year withdrawal sizing branch
// and Cycle Brokerage's LTCG top-off, so a brokerage harvest year still respects whatever
// IRMAA-tier, ACA-cliff or bracket ceiling the active strategy targets. `fedRateCreep` and
// `stateRateCreep` scale the RATES this reports, so they match what `calculateTaxes` will charge;
// the bracket LIMITS are deliberately left alone, since creep raises rates and not thresholds.

// The AVERAGE ("nominal") rate a jurisdiction charges at `limit` dollars of income: tax(limit)/limit.
// Used to price one account against another, so it has to return a rate at every limit the bracket
// ceiling can produce - and the bare division does not. Both ends of a bracket table break it, and
// both are reachable:
//
//   limit <= 0   0/0. The top federal bracket carries `l: Infinity`, and for a state whose table
//                runs out first `Math.min(stateLimit, limit)` collapses the ceiling to 0. Returns 0:
//                no income, no tax.
//   limit = Inf  Infinity/Infinity. The IRMAA branch has no state-min step, so an unbounded tier
//                ceiling stays infinite and lands here. Returns the jurisdiction's top marginal
//                rate, which tax(x)/x converges to as x grows, and 0 for a no-tax jurisdiction whose
//                single-row table has no rate to read.
//
// Neither is an invalid input: "the top of the 0% federal bracket is $0" and "a no-tax state imposes
// no ceiling" are both correct answers, and only the ratio taken from them was undefined. One
// definition for all three branches of `computeBracketCeiling`.
function nominalRateAtLimit(entity, status, limit, inflation, rateCreep = 1) {
    if (!(limit > 0)) return 0;
    if (!isFinite(limit)) {
        const brks = getRateBracket(entity, status);
        return (brks[brks.length - 1]?.r ?? 0) * rateCreep;
    }
    return calculateProgressive(entity, status, limit, inflation, rateCreep).cumulative / limit;
}

// The four rates a ceiling is described by, all read at ONE income - the rate basis. Both ceiling
// branches that derive at their own limit use this, and so does the schedule replay in
// planPrimaryWithdrawals, which derives at the basis a compiled year recorded.
//
// findUpperLimitByAmount reads the statutory rate straight off the bracket table and never passes
// through calculateProgressive, so the creep has to be applied here by hand; nominalRateAtLimit
// takes it as an argument and applies it itself.
function ratesAtLimit(basis, status, cpiRate, STATEname, fedRateCreep, stateRateCreep) {
    const fedAt = findUpperLimitByAmount('FEDERAL', status, basis, cpiRate);
    const stAt = findUpperLimitByAmount(STATEname, status, basis, cpiRate);
    return {
        marginalFedTaxRate: fedAt.rate * fedRateCreep,
        nominalFedTaxRateAtLimit: nominalRateAtLimit('FEDERAL', status, basis, cpiRate, fedRateCreep),
        marginalStateTaxRate: stAt.rate * stateRateCreep,
        nominalStateTaxAtLimit: nominalRateAtLimit(STATEname, status, basis, cpiRate, stateRateCreep),
        stateLimit: stAt.limit,
    };
}

// ONE bracket index, `cpiRate`, for both the ceiling and the average-rate lookups. They read the
// SAME bracket table, so handing them different clocks - `sim.inflation` for one, `sim.cpiRate` for
// the other - prices the strategy's accounts against brackets where the SPENDING clock put them and
// then pays tax on brackets where the STATUTORY clock put them. That is invisible whenever the two
// typed rates are equal, and the shipped defaults differ, so it is live for everyone.
//
// The invariant that catches this whole class, and the test that pins it: the average rate at a
// fixed ceiling is INVARIANT ACROSS YEARS. A ceiling names the same real position in the table every
// year, so its average rate cannot drift. It drifts only when two clocks disagree.
function computeBracketCeiling(inputs, status, cpiRate, STATEname, age1, age2, alive1, alive2, fedRateCreep = 1, stateRateCreep = 1, medicareRate = 1, dedAddBack = 0) {
    let limit, marginalFedTaxRate, marginalStateTaxRate, nominalFedTaxRateAtLimit, nominalStateTaxAtLimit, stateLimit;
    // The income level the RATE lookups were done at, which is not always the ceiling this function
    // returns. IRMAA and ACA derive their rates at the final limit; the federal branch derives at the
    // STATUTORY bracket top, before the deduction add-back lifts the limit and before the state min can
    // pull it down. Two different numbers on purpose - the ceiling is a MAGI target, the rate lookup
    // wants the bracket the plan is actually in. A schedule replay needs this one: without it a Fill
    // Bracket 22% year replays at the 24% marginal rate.
    let rateBasis;
    // P87c. WHICH of the three ceilings this is, decided here and returned, because callers need it
    // and the test they would otherwise write is not the same test. Reading `inputs.stratACAMultiple`
    // at a call site would miss that the IRMAA branch wins when both are set, and would also answer
    // 'aca' for a year whose ACA cap has lapsed. The branch that built the number is the only place
    // that knows. It matters because the three do not share an income definition: ACA MAGI counts
    // the WHOLE Social Security benefit, federal and IRMAA MAGI count at most 85% of it.
    let kind;

    if ((inputs.stratIRMAATier ?? -1) >= 0) {
        kind = 'irmaa';
        // IRMAA tier ceiling mode: fill MAGI up to the top of the chosen IRMAA tier - as that tier
        // will be indexed when THIS year's MAGI is actually charged, |LOOKBACK| years from now, less
        // whatever safety margin irmaaMarginMode asks for. See the irmaaFwdFactor block above.
        const IRMAABrks = getRateBracket('IRMAA', status);
        const effCpi = cpiRate * irmaaFwdFactor(inputs);
        const rawThreshold = IRMAABrks[inputs.stratIRMAATier + 1].l * effCpi;
        const maxAliveAge = Math.max(alive1 ? age1 : -1, alive2 ? age2 : -1);
        const IRMAARelevant = maxAliveAge >= TAXData.IRMAA.ELIGIBILITY_AGE + TAXData.IRMAA.LOOKBACK;
        if (IRMAARelevant) {
            limit = rawThreshold - irmaaMarginDollars(inputs, rawThreshold, status, effCpi, medicareRate,
                                                      onMedicareAtCharge(age1, age2, alive1, alive2,
                                                                         inputs.medicareEnroll1 !== false,
                                                                         inputs.medicareEnroll2 !== false)) - 1;
        } else {
            // Too young for the tier to mean anything yet, so degrade to the federal bracket holding
            // the same dollar figure. No IRMAA cliff is in play here, so no margin either.
            limit = findUpperLimitByAmount('FEDERAL', status, rawThreshold - 1, cpiRate).limit;
        }
        ({ marginalFedTaxRate, nominalFedTaxRateAtLimit, marginalStateTaxRate, nominalStateTaxAtLimit } =
            ratesAtLimit(limit, status, cpiRate, STATEname, fedRateCreep, stateRateCreep));
        rateBasis = limit;
    } else if ((inputs.stratACAMultiple ?? 0) > 0) {
        kind = 'aca';
        // ACA FPL cliff mode: fill MAGI up to a multiple of the Federal Poverty Level.
        // NO AGE TEST HERE, ON PURPOSE. The IRMAA branch above can degrade in place (drop the tier
        // ceiling, keep a federal one); this branch cannot, because every ACA row carries
        // stratRate: 0, so falling through to the federal branch would return the 10% bracket -
        // a TIGHTER ceiling than the cap it was meant to lift. The successor to a lapsed ACA cap
        // is "no ceiling strategy at all", which only a caller can express. Both callers gate on
        // `yr.isACAStrategy` (resolveSpendTarget), which is false once `yr.acaLapsed`. A new caller
        // must do the same or it will re-enforce a cap that ended at Medicare eligibility.
        // TAXData.FPL is the guideline a plan starting in its PLAN_YEAR is measured against (a 2026
        // plan year uses the 2025 guideline; the note there says why), so it applies as published
        // where cpiRate is 1 and cpiRate indexes it after that, with no extra year of CPI on top.
        // The Limit menu and the limit ladder in optimizer_ui.js compute the same figure.
        const fplBase = TAXData.FPL[status];
        limit = Math.round(fplBase * inputs.stratACAMultiple / 100 * cpiRate) - 1;
        ({ marginalFedTaxRate, nominalFedTaxRateAtLimit, marginalStateTaxRate, nominalStateTaxAtLimit } =
            ratesAtLimit(limit, status, cpiRate, STATEname, fedRateCreep, stateRateCreep));
        rateBasis = limit;
    } else {
        kind = 'federal';
        // Federal bracket ceiling mode (original logic)
        // stratRate names a bracket ("fill the 22% bracket"), which is a threshold concept - the
        // lookup stays on statutory rates so the ceiling doesn't move when rates creep.
        let fedLimit = findLimitByRate('FEDERAL', status, inputs.stratRate, cpiRate);
        limit = fedLimit.limit;
        nominalFedTaxRateAtLimit = nominalRateAtLimit('FEDERAL', status, limit, cpiRate, fedRateCreep);
        marginalFedTaxRate = fedLimit.rate * fedRateCreep;

        let stLimit = findUpperLimitByAmount(STATEname, status, fedLimit.limit, cpiRate);
        marginalStateTaxRate = stLimit.rate * stateRateCreep;
        stateLimit = stLimit.limit;
        nominalStateTaxAtLimit = nominalRateAtLimit(STATEname, status, limit, cpiRate, stateRateCreep);
        rateBasis = limit;   // the statutory top, captured BEFORE dedAddBack and the state min below

        // P92a. A federal bracket top is a TAXABLE-income threshold; every caller of this function
        // spends the result as a MAGI ceiling. Raising it by the year's deduction puts the two on
        // one basis, so "fill the 22% bracket" fills the 22% bracket instead of stopping one
        // deduction short of it. Measured at $32,200 short in 2026 and $70,876 by 2054 on one plan
        // (retired BRACKET_CEILING_BASIS report, section 1). `dedAddBack` is computed once a year in
        // resolveSpendTarget; it is 0 for every ceiling that is not a federal bracket top.
        //
        // Placed HERE, and the position matters: after the rate lookups, which want the statutory
        // bracket and not the ceiling; after the state lookup, which is keyed on the unmodified
        // federal limit so the state bracket selected cannot shift; before the state min, so a
        // state ceiling still binds on its own terms. The state limit is deliberately NOT lifted -
        // it carries the same basis error, and correcting it is a separate decision with its own
        // 51 tables to be right about.
        limit += dedAddBack;

        limit = Math.min(stateLimit, limit);
    }

    return { limit, marginalFedTaxRate, marginalStateTaxRate, nominalFedTaxRateAtLimit, nominalStateTaxAtLimit, stateLimit, kind, rateBasis };
}

/**
 * The year's MAGI **on the income definition the active ceiling is written in**, which is the only
 * quantity an overage against that ceiling may be measured with.
 *
 * `yr.tax.MAGI` is the SSA/IRMAA definition - federal AGI plus tax-exempt interest, where AGI
 * already carries only the TAXABLE share of Social Security, at most 85% and less in the two lower
 * statutory tiers. ACA MAGI is a different statutory quantity: it adds the whole benefit back,
 * taxable or not. So for an ACA cap and only for an ACA cap:
 *
 *     acaMAGI = MAGI + (totalSS - taxableSS)
 *
 * The SIZING side of an ACA cap is ACA-shaped already (`drawIRAToCeiling` subtracts the FULL benefit),
 * so measuring the overage against `tax.MAGI` would write the two halves of one cap in different
 * units. The error is one-directional - the overage can only read LOW - and it is not only a column:
 * `acaBreach` is set from this overage and feeds `totals.acaBreachYears`, which the Optimizer reads
 * to flag an ACA row untenable, so an ACA plan that cannot hold its cap could rank as though it
 * could.
 *
 * `tax.MAGI` ITSELF IS NOT TOUCHED, on purpose: IRMAA and NIIT read it and their definition is the
 * current one. This is a second, narrower quantity for the one ceiling that needs it.
 */
function ceilingMAGI(yr) {
    const magi = yr.tax?.MAGI ?? 0;
    // `isACAStrategy`, not `ceilingKind`, and not `inputs.strategy`: it is already false in a year
    // the cap has lapsed at Medicare eligibility, which is the same gate acaBreach uses two lines
    // below its own call site. A lapsed year has no ACA cap and no add-back to make.
    if (!yr.isACAStrategy) return magi;
    return magi + Math.max(0, (yr.fixedInc ?? 0) - (yr.tax?.taxableSS ?? 0));
}

let simulationCount = 0;

// ---- simulate() helper functions ----

function resolveOrderedSeq(seq, rates) {
    const { capGainsPercentage, capitalGainsRate, nominalStateTaxAtLimit, nominalTaxRate, marginalFedTaxRate, marginalStateTaxRate } = rates;
    const taxB = capGainsPercentage * (capitalGainsRate + nominalStateTaxAtLimit);
    const taxI = Math.max(nominalTaxRate, marginalFedTaxRate + marginalStateTaxRate);
    // Generated from the letters rather than looked up in a three-entry map (P30d). The map version
    // resolved CBIR, RIBC and BIRC and fell back to CBIR for everything else - including the other
    // 21 permutations of the same four accounts, which therefore ran a DIFFERENT sequence from the
    // one they named, silently. That is fine while nothing produces those strings (the UI offers
    // three, `grids.ordered` sweeps the same three) but it makes the other 21 unmeasurable, which
    // is what P30d needed, and it is a trap for anyone who reaches the input another way.
    //
    // The three shipped codes generate byte-identical sequences to the map they replace. Anything
    // that is not a permutation of the four letters still falls back to CBIR, so a typo is still a
    // no-op rather than a different plan - the same discipline gapFillWeights and rothGapFill use.
    // Deliberately case-SENSITIVE: 'ribc' fell back to CBIR before and still does.
    const ACCT = { C: 'Cash', B: 'Brokerage', I: 'IRA', R: 'Roth' };
    const RATE = { Cash: 0, Brokerage: taxB, IRA: taxI, Roth: 0 };
    const ok = typeof seq === 'string' && seq.length === 4
        && new Set(seq).size === 4 && [...seq].every(ch => ACCT[ch]);
    return [...(ok ? seq : 'CBIR')].map(ch => [ACCT[ch], RATE[ACCT[ch]]]);
}

function runOrderedWithdrawal(balances, need, seq, accumulate, applyFn) {
    let result = accumulate;
    let rem = need;
    for (const [acct, taxrate] of seq) {
        if (rem <= 1 || (balances[acct] ?? 0) <= 0) continue;
        const w = calculateWithdrawals(balances, rem, { order: [acct], weight: [1], taxrate: [taxrate] });
        result = accumulateWithdrawals([result, w]);
        applyFn(balances, w);
        rem = w.shortfall ?? 0;
        if (rem <= 1) break;
    }
    return result;
}

function computeYearGrowthRates(inputs, y) {
    const baseReturn = (inputs.returnSequence != null) ? inputs.returnSequence[y] : inputs.growth;
    const div = inputs.dividendRate ?? 0;
    const psa = inputs.returnSequencePerAccount;
    return {
        IRA:       (psa?.IRA1?.[y]      ?? baseReturn) + div,
        IRA1:      (psa?.IRA1?.[y]      ?? baseReturn) + div,
        IRA2:      (psa?.IRA2?.[y]      ?? baseReturn) + div,
        Brokerage:  psa?.Brokerage?.[y] ?? baseReturn,
        Cash:      inputs.cashYield,
        Roth1:     (psa?.Roth1?.[y]     ?? baseReturn) + div,
        Roth2:     (psa?.Roth2?.[y]     ?? baseReturn) + div,
    };
}

function buildSimYearLogRecord(p) {
    return {
        // Who
        year: p.currentYear,
        age1: p.alive1 ? p.age1 : '—',
        age2: p.alive2 ? p.age2 : '—',
        status: p.status,
        // Income
        SSincome: p.fixedInc,
        pension: p.pension,
        spendGoal: p.targetSpend,
        netIncome: p.netIncome,
        totalIncome: p.totalIncome,
        surplus: p.surplus.Total,
        shortfall: p.surplus.Shortfall,
        'RMDwd': p.totalRMD,
        'QCD1': p.qcd1,
        'QCD2': p.qcd2,
        'cashD+I': p.taxableDividends + p.taxableInterest,
        // Withdrawals
        // Voluntary IRA withdrawals = spending draw + Roth-conversion gross (per account),
        // EXCLUDING RMD (which is the involuntary draw, itemized separately below). IRAwd is their
        // sum, so a Roth conversion always shows as a withdrawal and rothConv <= IRAwd.
        'IRAwd': (p.iraVolSpend1 || 0) + (p.iraConvGross1 || 0) + (p.iraVolSpend2 || 0) + (p.iraConvGross2 || 0),
        'IRA1-': (p.iraVolSpend1 || 0) + (p.iraConvGross1 || 0),
        'IRA2-': (p.iraVolSpend2 || 0) + (p.iraConvGross2 || 0),
        // Hidden decomposition (leading '-' → no table column) for charts + the tax-planner handoff:
        // -iraVolSpend* = spending-funding draw per IRA; -iraConvGross* = gross converted per IRA.
        '-iraVolSpend1': p.iraVolSpend1 || 0,
        '-iraVolSpend2': p.iraVolSpend2 || 0,
        '-iraConvGross1': p.iraConvGross1 || 0,
        '-iraConvGross2': p.iraConvGross2 || 0,
        '-iraSpend': (p.iraVolSpend1 || 0) + (p.iraVolSpend2 || 0),
        '-iraConvGrossTot': (p.iraConvGross1 || 0) + (p.iraConvGross2 || 0),
        'RMD1-': p.rmd1,
        'RMD2-': p.rmd2,
        'Brokerage-': p.netWithdrawals.Brokerage,
        'RothWD': (p.netWithdrawals.Roth1 ?? 0) + (p.netWithdrawals.Roth2 ?? 0),
        'CashWD': p.netWithdrawals.Cash,
        // Three keys kept ADJACENT on purpose: rebuildGroupRow colSpans runs of consecutive same-group
        // columns, so a visible key dropped into the middle of another run shears the Annual Details
        // banner. Emitted unconditionally with ?? 0, because the _logSansTiming identity tests
        // stringify whole rows. The advisor-fee running total is a UI-computed column
        // (ANNUAL_RUNNING_TOTALS): a stored nominal sum-to-date divided by one row's factor is not a
        // Current-$ number.
        'AdvisorFee': p.advisorFee ?? 0,
        '-advisorFeeBasis': p.advisorFeeBasis ?? 0,
        '-advisorFeeFromIRA': p.advisorFeeFromIRA ?? 0,
        // DO NOT write a reframed figure here. `rothConv` is read back out of the log by the
        // NEXT year (beginYear: `log[y-1].rothConv > 1000` picks early-vs-late withdrawal timing),
        // so it is engine state wearing a display field's clothes. Reporting P28's unified figure
        // here flipped IRA Draw 6% from late to early timing and moved 780 money fields. A view
        // that wants the two legs separately has `-iraSpend` and `-iraConvGrossTot` above.
        'rothConv': p.totalConverted,
        'surplusCash': p.surplus.Cash,
        '-surplusToBrokerage': p.surplusToBrokerage ?? 0,   // Cash Reserve overflow reinvested (hidden)
        '-cashBreach': p.cashBreach ? 1 : 0,                // spending forced a draw into the reserve (hidden)
        // P108b. Growth credited because the income tax settled in December instead of leaving
        // with the withdrawal. 0 unless taxSettlement is 'december'. Hidden: a diagnostic for
        // harnesses and for anyone checking the option did what it says.
        '-taxCarryCredit': p.taxCarryCredit ?? 0,
        '-convTimingShift': p.convTimingShift ?? 0,
        'cashDividends': p.taxableDividends,
        'cashInterest': p.taxableInterest,
        // P115a. What the cash actually earned this year, and the running untaxed balance carried
        // into next year's `cashInterest`. Hidden: the pair exists so the true-up is auditable.
        '-cashInterestEarned': p.cashInterestEarned ?? 0,
        '-cashInterestCarry': p.cashInterestCarry ?? 0,
        // Taxes
        'FedRate%': p.tax.federalMarginalRate,
        'StateRate%': p.tax.stateMarginalRate,
        IRMAATier: p.IRMAATier,
        IRMAA: p.IRMAA,
        Medicare: p.medicareBase,
        totalTax: p.totalTax,
        FedTax: p.tax.federalTax,
        StateTax: p.tax.stateTax,
        'CapGains': p.capitalGains,
        // Chart-only helpers (leading '-' → excluded from the Annual Details table). capGainsTax
        // is the LTCG/qualified-div tax embedded in FedTax (split out for the Taxation chart);
        // cpiFactor is the cumulative CPI multiplier used to inflate bracket/IRMAA thresholds.
        '-capGainsTax': p.tax.capitalGainsTax,
        // All-in cost rate, surtax included: its only reader is afterTaxWealthOfLogRow, which
        // values a brokerage balance net of the tax a sale would owe. P117.
        '-capGainsRate': p.tax.capitalGainsRate + (p.tax.niitMarginalOnInvestment ?? 0),
        '-cpiFactor': p.cpiRate,
        // The two death-adjacent years, set in `resolveHousehold`. Hidden keys (a leading '-' is
        // what keeps a key out of the Annual Details columns) because they are a boundary, not a
        // figure. They are here so the off-by-one they exist to prevent is testable: the year
        // age === die is the LAST married one, and the first single year is the one after it.
        '-lastMFJ': !!p.isLastMFJYear,
        '-firstSGL': !!p.isFirstSingleYear,
        // P87a. The two federal quantities the bracket-ceiling basis question needs, and the
        // only ones of tax's that nothing else re-emitted. A federal bracket top bounds TAXABLE
        // income; the ceiling built from it is spent against MAGI, and fedDeduction is exactly
        // the gap between the two. It is the FULL deduction calculateTaxes() charged - standard
        // or itemized, plus the age-65 bumps and the senior deduction after its phase-out - not
        // the bare `std` field, so the name is narrower than the number.
        '-fedTaxableInc': p.tax.federalTaxableIncome,
        '-fedDeduction': p.tax.federalStdDeduction,
        // P87c. The other half of the same basis question. The sizing aggregate subtracts the FULL
        // benefit (`yr.fixedInc`) from a MAGI ceiling, but only this much of it ever reaches MAGI -
        // at most 85%, and less in the two lower tiers. The gap between this and `SSincome` is the
        // ceiling the plan is told to fill and then does not.
        '-taxableSS': p.tax.taxableSS,
        // P92a. The deduction the CEILING used, beside the one that was CHARGED. They differ by
        // whatever the two-pass estimate could not see coming, and keeping both is what makes that
        // residual auditable from a finished run instead of an argument. 0 for every ceiling that
        // is not a federal bracket top.
        '-ceilDedAddBack': p._ceilDedAddBack,
        // The ordinary TAXABLE income floor the LTCG bracket room was sized against, in a
        // harvest year. 0 in every other year. Its residual against `-fedTaxableInc` minus
        // realized gains is the one-pass estimate's error.
        '-ltcgFloor': p._ltcgFloor ?? 0,
        // The net dollars the RMD's own month moved: cash yield gained on the proceeds MINUS the
        // IRA growth given back. Negative whenever the IRA out-earns cash, which is the usual
        // case and is the real cost of taking the distribution early. 0 unless a mode moves it.
        '-rmdTimingShift': p.rmdTimingShift ?? 0,
        // Tax-rate creep multipliers actually applied this year (1 = today's statutory rates).
        '-fedRateCreep': p.fedRateCreep,
        '-stateRateCreep': p.stateRateCreep,
        // Leading '-' keeps these out of Annual Details (optimizer_ui.js filters on it). They mark
        // the first year Social Security money actually arrives, which computeMilestones turns into
        // chart markers. With the default December birth month this is the year AFTER the age
        // crossing, because the crossing year prorates to zero months.
        '-ssStart1': p.ssStart1,
        '-ssStart2': p.ssStart2,
        '-ssStartSurvivor': p.ssStartSurvivor,
        // What the spend rule (GK-style or risk-based) did to this year's goal, in dollars: negative
        // for a cut, positive for a raise, 0 when it held (or there is no rule). CPI and Spend Delta
        // are not in it. computeMilestones marks the cuts and the raises from this, not from the
        // label: a raise the ceiling trims back to the plan still moved spending up.
        '-ruleMove': p.ruleMove ?? 0,
        MAGI: p.tax.MAGI,
        // P87d. MAGI on the ACA statute's definition - the SSA one above plus the non-taxable share
        // of the benefit. Equal to `MAGI` for every ceiling that is not a live ACA cap, which is why
        // it is hidden rather than a column: on all but one strategy it would be a duplicate. It is
        // the number `BracketOverage` and `acaBreach` are decided on for an ACA plan, so a reader
        // auditing a breach needs it and cannot reconstruct it from `MAGI` and `SSincome` alone.
        '-acaMAGI': p.acaMAGI,
        'NominalRate%': p.nominalTaxRate,
        'FedCap': p.tax.fedLimit,
        'StateCap': p.tax.stLimit,
        'BracketTarget': p.bracketTarget,
        'RateBasis': p.rateBasis,          // P103b2: what the marginal-rate lookups were keyed on
        '-volIRAwd': p.volIRAwd ?? 0,      // P103b3: the voluntary IRA draw the strategy branch chose

        'BracketOverage': p.bracketOverage,
        // P88c. The share of BracketOverage caused by a voluntary conversion rather than by
        // spending that could not be funded inside the ceiling. Hidden ('-' prefix) because the
        // visible column is the total; this exists so the Optimizer's feasibility heuristic and any
        // future warning can tell a forced breach from a chosen one.
        '-overageFromConv': p.overageFromConv ?? 0,
        'ForcedIRA': p.forcedIRA,
        // A real column, as of P99. It was emitted as '-acaBreach', and a leading '-' means no table
        // column, while the note under an ACA limit told the reader to "See acaBreach in Annual
        // Details" - naming something that could not be shown. One of the two had to give.
        //
        // 'Yes'/'' rather than a boolean or 1/0, and all three consumers are why. The cell renderer
        // takes the numeric branch on `!isNaN(value)`, which a boolean passes: `true` would print as
        // 1 and then be DIVIDED by inflationFactor in the Current $ view, printing 0. And
        // analyzeColumnContent() asks `!isNaN(v) && parseFloat(v) !== 0`, where parseFloat(false) is
        // NaN and NaN !== 0, so an all-false column would count as having content and appear on
        // every plan that never touched ACA. A string falls to the untouched else branch in the
        // first, and to the `v !== ''` skip in the second. Truthiness is unchanged either way, which
        // is all the engine tests and the note's own filter read.
        'acaBreach': p.acaBreach ? 'Yes' : '',
        // Balances
        IRA1: p.balance.IRA1,
        IRA2: p.balance.IRA2,
        TotalIRA: p.balance.IRA1 + p.balance.IRA2,
        Cash: p.balance.Cash,
        CashReserve: p.cashReserve ?? 0,
        Roth: p.balance.Roth1 + p.balance.Roth2,
        Roth1: p.balance.Roth1,
        Roth2: p.balance.Roth2,
        Brokerage: p.balance.Brokerage,
        Basis: p.balance.BrokerageBasis,
        totalNetWealth: p.totalNetWealth,
        portfolioBalance: p.portfolioBalance,
        guaranteedIncome: p.guaranteedIncome,
        brokerageG: p.gains.Brokerage,
        // 11.1703: the two other ways money enters Brokerage, so the balance reconciles on screen:
        // Brokerage(t) = Brokerage(t-1) - Brokerage- + brokerageG + SurplusBrok. DRIP is the
        // reinvested-dividend part already inside brokerageG; SurplusBrok is surplus the Cash
        // Reserve rule routed here, which brokerageG does NOT include.
        DRIP: p.brokDRIP ?? 0,
        SurplusBrok: p.surplusToBrokerage ?? 0,
        cashG: p.gains.Cash,
        rothG: (p.gains.Roth1 || 0) + (p.gains.Roth2 || 0),
        // Chart-only (leading '-' → no table column): IRA investment earnings for the asset-flow view.
        '-iraG': (p.gains.IRA1 || 0) + (p.gains.IRA2 || 0),
        'RMD%': p.rmd1Pct,
        // Phase 24: Cyclic sub-cycle annotation
        subCycle: p.subCycleLabel,
        // Opportunity cost (Phase 20) + BETR signal (Phase 21) + extra conversion (Phase 23)
        convOC: p.convNetValue,
        excessOC: p.excessNetValue,
        convTax: p.incrementalConvTax,
        excessTax: p.incrementalExcessTax,
        'BETR%': p.yearBETR,
        betrFlag: p.yearBETRflag,
        extraConv: p.extraConvGross || null,
        // Cash-funded conversion bookkeeping (fundConversionWithCash). Leading '-' → no table
        // column; exposed for tests/debug only. grossUpIRA = additional IRA pulled by the
        // gross-up, grossUpTax = its tax paid from Cash, extraConvCashTax = Extra Conversion's
        // tax paid from Cash instead of being netted out of the conversion.
        '-grossUpIRA': p.grossUpIRA || 0,
        '-grossUpTax': p.grossUpTax || 0,
        '-extraConvCashTax': p.extraConvCashTax || 0,
        // ...and the VISIBLE total of the two, because between them they are the only way Cash can
        // fall without CashWD moving, and a reader trying to reconcile the Cash balance had no
        // column to find them in (user, 2026-09-01: "I don't see the cash being removed in the first
        // year"). On the plan that raised it, Cash went $72,000 -> $16,099 in year one with CashWD
        // reading 0, because $56,512 of it paid the conversion tax. Kept separate from `convTax`,
        // which is the whole conversion tax whether or not Cash funded any of it.
        'ConvTaxCash': (p.grossUpTax || 0) + (p.extraConvCashTax || 0),
        // ...and the TOTAL: every dollar that leaves Cash in a year, the spending draw plus the
        // conversion tax when cash funds it. Prior-year Cash minus ttlCashWD, plus interest and
        // growth, is this year's Cash balance. It lives in the Withdrawals band beside CashWD
        // rather than in Balances (user, 2026-09-01): Balances carries BALANCES, and a flow
        // column sitting among them is what made the missing outflow hard to find to begin with.
        'ttlCashWD': (p.netWithdrawals.Cash || 0) + (p.grossUpTax || 0) + (p.extraConvCashTax || 0),
        // Phase 27: inflows/outflows + withdrawal rate
        grossOut: p.grossOutflows,
        netOut: p.netOutflows,
        inflows: p.yearInflows,
        'wdRate%': p.wdRate,
        // Phase 12: per-year withdrawal timing
        // Conversion / withdrawal, per year. 'none' when the year converted nothing, which is a
        // fact about the year rather than about the setting. The required distribution, when there
        // is one, follows the FIRST of the two.
        timing: (p.convLabel ?? 'none') + '/' + (p.wdLabel ?? 'Late'),
        // The spend rule - Guardrails (GK-style) or Risk-based - filled whenever one is on, under
        // any strategy. One pair of columns for both: a year is adjusted by one rule or none.
        ruleSpend: (p.spendRule === SPEND_RULE.GK || p.spendRule === SPEND_RULE.RBG) ? p.spendGoal : null,
        ruleAdj:   (p.spendRule === SPEND_RULE.GK || p.spendRule === SPEND_RULE.RBG) ? (p.gkAdjLabel || '—') : null,
        // Where the rule has put spending against the plan's own path (the shape: the spend goal
        // with Spend Delta and every year's inflation, no rule): -0.10 is 10% under it.
        'vsPlan%': (p.spendRule === SPEND_RULE.GK || p.spendRule === SPEND_RULE.RBG) && p.shapeGoal > 0 ? p.spendGoal / p.shapeGoal - 1 : null,
        // What the year was actually handed: this year's inflation, the compounded inflation the
        // row's nominal dollars carry, and this year's market return. Constant in a deterministic
        // run and different every year under Monte Carlo, which is the point - a replayed path is
        // unreadable without them. Cumulative inflation is reported as the PERCENT the price level
        // has risen since the plan started, not as the raw multiplier, so the column formats like
        // every other '%' column; inflationFactor below still carries the multiplier itself.
        'infl%':     p.yearInflation,
        'inflCum%':  (p.inflation ?? 1) - 1,
        'return%':   p.baseReturn,
        // Internal
        inflationFactor: p.inflation,
        loopMs: p.loopMs
    };
}

/** SIMULATION PHASES **/
// Each function is one phase of a simulated year. `sim` carries loop-spanning state
// (see its construction in simulate()); `yr` is the per-year context created fresh
// each iteration. Phases communicate by mutating those two objects.

// True when an ACA FPL cap has nothing left to protect: every LIVING person in the plan is at or
// past Medicare eligibility. "Living" is the operative word - a survivor who is 66 has lapsed even
// if the deceased spouse never reached 65.
//
// NOT the IRMAA age test used elsewhere in this file, which adds TAXData.IRMAA.LOOKBACK because
// IRMAA charges this year's premium against MAGI from two years ago. ACA eligibility is a
// current-year test, so there is no lookback here. Pure; shared by beginYear (which decides the
// year-0 withdrawal month before ages are resolved) and resolveHousehold. Reads the constant on
// every call rather than closing over it, so a test can move it.
function acaCapLapsed(age1, age2, alive1, alive2) {
    const medAge = TAXData.IRMAA.ELIGIBILITY_AGE;
    const living = (alive1 ? 1 : 0) + (alive2 ? 1 : 0);
    const onMed  = (alive1 && age1 >= medAge ? 1 : 0) + (alive2 && age2 >= medAge ? 1 : 0);
    return living > 0 && onMed === living;
}

// Start-of-year setup: amortized IRA target, growth rates, withdrawal-timing auto-select, pre-withdrawal growth, and the withdrawal accumulators (netWithdrawals aliases withdrawals).
function beginYear(sim, yr) {
    // THE PRIOR DECEMBER 31 IRA BALANCE, captured before anything in this year touches it.
    //
    // 26 CFR 1.401(a)(9)-5 sets the year's required distribution as the prior December 31 balance
    // over the life-expectancy divisor. Nothing that happens during the year - growth, a withdrawal,
    // a conversion, a fee - can change the amount required for that year.
    //
    // At this point `balance` IS that position: last year's `growAndSettle` applied `postMonths` and
    // nothing has moved since. A few lines below, `applyGrowth` adds this year's pre-withdrawal
    // growth, so reading the balance AFTER that both overstates the RMD and - far worse - makes it
    // depend on `preMonths`, which is 1 or 11 depending on whether LAST year converted. Two
    // otherwise identical plans would get different RMDs because one of them converted.
    //
    // YEAR 0 IS NOT CLEAN and must not be described as though it were: the snapshot seeds from the
    // typed IRA balance, which is a December 31 balance only for a plan that starts in January. A
    // test pins that limitation rather than papering over it with a growth-based back-out.
    //
    // The advisor fee reads this same snapshot rather than `balance` at its own call site, because
    // ANYTHING computed off `balance` between `beginYear`'s growth call and `growAndSettle` inherits
    // the same 1-vs-11 `preMonths` dependency. One snapshot, captured once, read by both.
    sim.priorYearEnd = {
        IRA1: sim.balance.IRA1, IRA2: sim.balance.IRA2,
        Roth1: sim.balance.Roth1, Roth2: sim.balance.Roth2,
        Brokerage: sim.balance.Brokerage,
    };

    const { inputs, balance, log } = sim;
    const y = yr.y;
    yr.loopStart = performance.now();
    // Phase 24 interaction fix: cyclic brokerage "harvest" years draw $0 from the IRA
    // (the isBrokerageYear branch runs instead of the 'fixed' branch), so they consume a
    // calendar year of the N-year drawdown window without reducing the IRA. Amortizing over
    // remaining *calendar* years would then dump the deferred balance into the final year as
    // one balloon draw/conversion. Instead, amortize over the expected remaining *draw* years
    // (calendar years minus estimated brokerage years) so each IRA-draw year is sized to hit
    // the target on schedule. The cycle does ~1 brokerage year per cycN IRA years, where
    // cycN = round(IRA/Brokerage) (see line ~947), i.e. a 1/(cycN+1) fraction of years are skips.
    // Yearly re-amortization self-corrects any estimation drift.
    let amortYears = inputs.nYears - y;
    if (inputs.cyclicEnabled && balance.Brokerage > 0 && amortYears > 1) {
        const cycN = Math.max(1, Math.round((balance.IRA1 + balance.IRA2) / balance.Brokerage));
        const expectedSkips = amortYears / (cycN + 1);
        amortYears = Math.max(1, amortYears - expectedSkips);
    }
    // IRA Goal is entered in today's dollars, matching the today's-dollar "Suggested IRA Goal" hint
    // and the inflation-indexed tax, IRMAA and ACA thresholds the goal is meant to manage. It is
    // inflated to this year's nominal dollars with `cpiRate` - the same factor the ceilings use -
    // before being compared against nominal IRA balances.
    //
    // ON cpiRate AND NOT THE SPENDING CLOCK, deliberately. A balance target is wealth, which argues
    // for the spending clock; purpose wins. This goal exists to keep the IRA small enough that its
    // RMDs clear under a bracket, an IRMAA tier or an ACA cap, all of which move on `cpiRate`, and
    // indexing the goal on a faster clock than the ceilings it aims at would make it drift out from
    // under them.
    //
    // `?? 0` is load-bearing: an absent `iraBaseGoal` made this NaN, and the NaN propagated all the
    // way to `totalNetWealth` on the `bracket` and `fixed` strategies - a whole run silently
    // reporting NaN from one missing input. The page always sends the field, so only a node caller
    // can reach it. Absent means "no goal", which is what a caller that omits it intends.
    yr.iraGoalNominal = (inputs.iraBaseGoal ?? 0) * sim.cpiRate;
    sim.fixedWithdrawal = calculateAmortizedWithdrawal(balance.IRA1 + balance.IRA2, yr.iraGoalNominal, amortYears, inputs.growth)

    // Per-year growth rates. Monte Carlo supplies a return per year from the injected sequence;
    // otherwise the constant rate. Cash keeps its own yield, uncorrelated with the market. IRA and Roth
    // always reinvest dividends, so their effective return is appreciation + dividendRate; Brokerage
    // dividends are handled below, taxed first and then reinvested or sent to Cash. Sequences are read
    // by `ySeq`, the run's own index, which is what lets a resumed run sit partway through the plan at
    // the start of the future it was handed.
    yr.baseReturn    = (inputs.returnSequence != null) ? inputs.returnSequence[yr.ySeq] : inputs.growth;
    yr.yearInflation = inputs.inflationSequence?.[yr.ySeq] ?? inputs.inflation;
    yr.growthRates = computeYearGrowthRates(inputs, yr.ySeq);
    // P127. Only the Guardrails freeze reads it, so a run without the rule does not pay for it.
    if (_usesGKSpendRule(inputs)) {
        yr._portfolioReturn = portfolioReturnOf(balance, yr.growthRates, inputs.dividendRate);
    }

    // ── WHEN THE MONEY MOVES: one mode, three months ──────────────────────────────────────────
    //
    //     mode     RMD   conversion   spending
    //     early     1        1           1
    //     split     1        1          11        <- the default
    //     late     11       11          11
    //
    // The RMD and the conversion move together because they must: a conversion may not precede the
    // distribution, so the only way to convert in January is to distribute in January.
    //
    // Nothing is inferred from the strategy. A trigger that reads whether a year will convert has to
    // aim at the leg decided LATE - the conversion - because the spending month is fixed here, at
    // the top of the year, before anything about the year is known. Aim it at spending instead and
    // the only conversion figure in reach is last year's.
    //
    // Unknown or absent means SPLIT. A harness or a saved plan that names no mode gets the default,
    // not a silent third behavior.
    const _MODE_MONTHS = { early: [1, 1, 1], split: [1, 1, 11], late: [11, 11, 11] };
    const _modeM = _MODE_MONTHS[inputs.withdrawTiming] || _MODE_MONTHS.split;
    let preMonths      = _modeM[2];
    // ── ONE MODE, THREE MONTHS ────────────────────────────────────────────────────────────────
    // `withdrawTiming` names the whole year's shape rather than one leg of it:
    //
    //     mode     RMD   conversion   spending
    //     early     1        1           1
    //     split     1        1          11
    //     late     11       11          11
    //
    // Split is the one the two-select arrangement could not express. With a late spending draw the
    // RMD sat in month 11, and a conversion may not precede the distribution, so asking for a
    // January conversion was silently a no-op in every RMD year. Giving the distribution its own
    // month is what makes the mode reachable at all.
    //
    yr.postMonths   = 12 - preMonths;
    // THE RMD'S OWN MONTH, which may differ from the spending month: Split distributes and converts in
    // January and spends in November, and that is the only way to reach a January conversion in an RMD
    // year at all.
    yr.rmdMonth  = _modeM[0];
    yr.convMonth = _modeM[1];
    // For the Annual Details column. The conversion half is filled in by growAndSettle, which is
    // the only place that knows whether the year converted at all.
    yr._wdLabel   = preMonths === 1 ? 'Early' : 'Late';
    yr._convLabel = 'none';

    // Pre-withdrawal growth: portfolio earns for preMonths before withdrawal exits.
    yr.preGains = applyGrowth(balance, yr.growthRates, preMonths);
    clampBrokerageBasis(balance);   // P35f: a down half-year can leave basis above value

    yr.withdrawals = { IRA: 0, IRA1: 0, IRA2: 0, Roth: 0, Brokerage: 0, BrokerageBasis: 0, Cash: 0 };
    yr.netWithdrawals = yr.withdrawals;
}

// Ages, survivorship and filing status, IRMAA lookback charge, bracket limits, and the
// per-year accumulator initializations. Returns false when both spouses are deceased
// (the caller ends the simulation).
function resolveHousehold(sim, yr) {
    const { inputs, balance, totals, birthyear1, birthyear2 } = sim;
    // Age at December 31 of the simulation year - the IRS convention for RMD eligibility.
    // Everyone has had their birthday by Dec 31, so no birth-month adjustment is needed.
    yr.age1 = sim.currentYear - birthyear1;
    yr.age2 = sim.currentYear - birthyear2;
    yr.alive1 = yr.age1 <= inputs.die1;
    yr.alive2 = yr.age2 <= inputs.die2;
    if (!yr.alive1 && !yr.alive2) return false;

    // Tax-rate creep for THIS calendar year (1 = today's statutory rates, the default).
    yr.fedRateCreep   = taxCreepFactor(inputs.taxRateCreep,      sim.currentYear, sim.creepStartYear);
    yr.stateRateCreep = taxCreepFactor(inputs.taxRateCreepState, sim.currentYear, sim.creepStartYear);

    // OBBBA (P.L. 119-21) provisions, gated per calendar year. calculateTaxes defaults BOTH of these
    // to false and cannot gate them itself: it is handed `inflation` but never a tax year, and the
    // sunsetYear values in TAXData.OBBBA are declarative only, referenced by no code. So the caller
    // owns the gate, and until now no caller passed either flag - the senior deduction was
    // implemented and unit-tested but never reached a single simulated year, and the SALT cap always
    // used the $10k TCJA floor. Both made federal tax too HIGH for anyone 65+ (or itemizing in a
    // high-tax state) in 2025-2029.
    //   Senior deduction: $6,000 per filer aged 65+, phasing out above $150k MFJ / $75k single,
    //   tax years 2025-2028. SALT: the elevated $40k cap, 2025-2029, phasing down above $500k MAGI.
    // Both revert automatically the year after their sunset, which is what makes this safe to leave
    // on permanently rather than expose as a switch.
    yr.obbaOn   = sim.currentYear <= TAXData.OBBBA.SENIOR_DED.sunsetYear;
    yr.saltHigh = sim.currentYear <= TAXData.OBBBA.SALT.sunsetYear;
    // Same failure mode, same fix: propTax is the third parameter calculateTaxes accepts and no
    // caller here supplied. Zero by default, so a plan that does not enter one is unchanged.
    yr.propTax  = propTaxFor(inputs, sim.currentYear, sim.propTaxBaseYear, sim.inflation);
    // P64d. The SALT cap and its phase-out threshold step up 1%/yr from a 2025 base, so the engine
    // has to know which tax year it is pricing. Without it every year silently gets the 2025 figures.
    yr.taxYear  = sim.currentYear;

    totals.yearstested += 1;

    yr.status = (yr.alive1 && yr.alive2) ? 'MFJ' : 'SGL';

    // The two death-adjacent years, named apart because they are ONE YEAR APART and both exist.
    // yr.alive* is `age <= die`, so both spouses are alive through the whole year age === die:
    // that year is still MFJ and is the LAST one. The first SGL year is the year AFTER the death,
    // which is what the existing isDeathYear local (~line 1110) tests. Reusing isDeathYear for
    // "the last married year" inverts a feature silently, because both years produce numbers.
    yr.isLastMFJYear = yr.status === 'MFJ'
        && (yr.age1 === inputs.die1 || (birthyear2 > 0 && yr.age2 === inputs.die2));
    yr.isFirstSingleYear = yr.status === 'SGL' && birthyear2 > 0
        && (yr.age1 === inputs.die1 + 1 || yr.age2 === inputs.die2 + 1);

    // IRC 1014 basis step-up at the FIRST death. The brokerage cost basis resets to fair market
    // value - fully in a community-property state, on the decedent's half in a common-law one -
    // so the survivor owes capital-gains tax on far less of the same account. Applied at the top
    // of the first SINGLE year, before any of this year's brokerage draws, so those draws price
    // off the stepped-up basis.
    //   Basis is a single aggregate scalar with no owner attribution (balance.BrokerageBasis) and
    // that is sufficient here: 0.50 vs 1.00 IS the ownership model - common-law joint tenancy vs
    // community property - so no per-person brokerage split is needed to get the right answer.
    // The fraction is a per-jurisdiction field so a state cannot be added without declaring it;
    // see the BASIS STEP-UP AT DEATH block in taxengine.js.
    //   The SECOND death is not handled here: it is always a full reset regardless of state, and
    // it lands on the terminal row, applied in simulate()'s terminal block.
    if (yr.isFirstSingleYear && !sim.firstDeathStepUpDone) {
        sim.firstDeathStepUpDone = true;
        const stepFraction = TAXData[STATEname]?.BasisStepUp ?? BASIS_STEP_UP_FALLBACK;
        const unrealizedGain = Math.max(0, balance.Brokerage - balance.BrokerageBasis);
        balance.BrokerageBasis += stepFraction * unrealizedGain;
    }

    // IRMAA is already known since it is based on income from 2 years ago (MAGI lookback),
    // compared against thresholds inflated to THIS payment year (matches SSA indexing).
    // Only spouses actually on Medicare (living, at TAXData.IRMAA.ELIGIBILITY_AGE or older) pay
    // the surcharge - a 61-year-old household pays nothing no matter how large the conversion
    // income.
    const medicareAge = TAXData.IRMAA.ELIGIBILITY_AGE;
    // PER-PERSON ENROLLMENT. Not everyone 65+ is on Medicare: a person may be covered by a spouse's
    // employer plan, by the VA, or by retiree coverage, and in a couple that is often true of ONE
    // of them. Age alone therefore cannot decide who pays, and it decides two things at once - the
    // base premium AND the IRMAA surcharge - so both follow the same flag. Absent means enrolled,
    // which is what every existing plan and saved URL means.
    const enroll1 = inputs.medicareEnroll1 !== false;
    const enroll2 = inputs.medicareEnroll2 !== false;
    yr.onMedicare = (yr.alive1 && yr.age1 >= medicareAge && enroll1 ? 1 : 0)
                  + (yr.alive2 && yr.age2 >= medicareAge && enroll2 ? 1 : 0);
    yr.acaLapsed = acaCapLapsed(yr.age1, yr.age2, yr.alive1, yr.alive2);
    const magiLookback = balance.magiHistory[balance.magiHistory.length - 2];
    yr.IRMAA = calcIRMAA(magiLookback, yr.status, sim.cpiRate, sim.medicareRate, yr.onMedicare);
    // Tier for display and milestones. Same lookback MAGI and same age gate as the charge, and computed
    // BEFORE the year's MAGI push, which would otherwise show the tier a year early.
    yr.IRMAATier = yr.onMedicare > 0 ? getIRMAATier(magiLookback, yr.status, sim.cpiRate) : '-none-';
    // Base Medicare Part B + Part D premiums, on the Medicare clock from medicare_costs.js - not
    // CPI, and not the typed inflation rate.
    //
    // WHETHER THIS IS AN OUTFLOW IS A CHOICE, and it did not used to be one. The figure was tracked
    // and never deducted, on the assumption that it lives inside the spend goal - an assumption
    // nothing checked and nothing showed the user. A household that entered its spend goal net of
    // premiums was silently handed about $5,800 a year (2026 rates, a couple), and the gap WIDENS
    // every year because `medicareRate` compounds on the Medicare clock while the spend goal tracks
    // CPI alone. `medicarePremiumMode: 'added'` charges it as real money out instead. The default
    // stays 'in-spend', so no existing plan, golden or saved URL moves.
    //
    // The IRMAA surcharge is NOT part of this: it is already charged, inside `yr.totalTax`.
    yr.medicareBase = yr.onMedicare * (TAXData.IRMAA.standardPartB + TAXData.IRMAA.standardPartD) * 12 * sim.medicareRate;
    yr.medicareOutflow = (inputs.medicarePremiumMode === 'added') ? yr.medicareBase : 0;

    // Calculate the bracket limits based on: stated limit.
    // let tgtBracketLimit = findLimitByRate('FEDERAL',status,inputs.stratRate)

    // Find federal & state rates and limits by spending goal:
    yr.goalFedBracketLimit = findUpperLimitByAmount('FEDERAL', yr.status, sim.spendGoal, sim.cpiRate)
    yr.goalStateBracketLimit = findUpperLimitByAmount(STATEname, yr.status, sim.spendGoal, sim.cpiRate)
    yr.goalLimit = Math.min(yr.goalFedBracketLimit.limit, yr.goalStateBracketLimit.limit)
    yr._ceilDedAddBack = 0;   // P92a, set in resolveSpendTarget once the year's income is known
    yr.totalIncome = 0;
    yr.netIncome = 0;
    yr.capitalGains = 0;
    yr.limit = undefined;   // MAGI ceiling for bracket/aca strategies (see computeBracketCeiling)
    yr.stateLimit = undefined;
    yr.bracketTarget = 0;  // ceiling being targeted by bracket/aca strategies
    yr.bracketOverage = 0; // how far MAGI exceeded bracketTarget (0 when no bracket strategy).
                           // Set in the withdrawal phases, then re-decided by recomputeBracketOverage
                           // once the conversion paths have run (P88c).
    yr._overageFromConv = 0; // the part of the above a voluntary conversion is responsible for
    yr.forcedIRA = 0;      // soft-cap break: IRA drawn ABOVE the ceiling to fund mandatory spending
    yr.acaBreach = false;  // strict ACA cap could not fund spending → plan untenable this year
    yr.acaMAGI = 0;        // P87d: MAGI on the ACA statute's definition (see ceilingMAGI below)
    yr.rmdTimingShift = 0; // net effect of taking the RMD earlier than the spending draw
    yr._ltcgFloor = 0;     // the LTCG room's ordinary-taxable floor, set only in a harvest year

    // Soft caps (Fill Federal Bracket / IRMAA Tier / IRA Draw %): when spending can't be met
    // within the ceiling and Cash/Brokerage/Roth are exhausted, the 3rd-pass fallback draws
    // extra IRA above the ceiling to fund spending (recorded in `forcedIRA`; the bracket
    // overage is recomputed afterward). Strict cap (ACA): never breaches the FPL ceiling -
    // any unmet spending stays a shortfall and is flagged via `acaBreach`. The
    // isBracketInfeasible flag (~line 1503) summarizes overage across years.
    return true;
}

// Spousal IRA inheritance, Social Security and survivor benefits, pension, RMDs and QCDs.
function computeIncome(sim, yr) {
    const { inputs, balance, birthyear1, birthyear2 } = sim;
    // 1. Inherit IRA
    if (!yr.alive1 && balance.IRA1 > 0) { balance.IRA2 += balance.IRA1; balance.IRA1 = 0; }
    if (!yr.alive2 && balance.IRA2 > 0) { balance.IRA1 += balance.IRA2; balance.IRA2 = 0; }


    // 2. Base Income
    let ssReduction = (inputs.ssFailYear > SS_FAIL_NEVER_BEFORE && sim.currentYear >= inputs.ssFailYear) ? inputs.ssFailPct : 1;
    // Claim-year proration. Ages here are integers, so the first year a person qualifies is the one
    // where age === ceil(claimAge); only that year is scaled, every later year is paid in full.
    const firstYear1 = yr.age1 === Math.ceil(inputs.ss1Age);
    const firstYear2 = yr.age2 === Math.ceil(inputs.ss2Age);
    const ssFrac1 = firstYear1 ? ssFirstYearFraction(inputs.birthmonth1) : 1;
    const ssFrac2 = firstYear2 ? ssFirstYearFraction(inputs.birthmonth2) : 1;
    // sim.ssFactor, not sim.cpiRate: a benefit already being paid never falls. See `endYear`.
    let potentialS1 = (yr.age1 >= inputs.ss1Age) ? inputs.ss1 * sim.ssFactor * ssReduction * ssFrac1 : 0;
    let potentialS2 = (yr.age2 >= inputs.ss2Age) ? inputs.ss2 * sim.ssFactor * ssReduction * ssFrac2 : 0;
    yr.s1 = yr.alive1 ? potentialS1 : 0;
    yr.s2 = yr.alive2 ? potentialS2 : 0;
    yr.pension = (yr.age1 >= (inputs.pensionStartAge || 0))
        // P70d/P70i. The CPI clock, not the spending clock: a COLA is tied to a PUBLISHED index,
        // which is what the CPI input represents here, and Social Security has always ridden
        // cpiRate. sim.pensionFactor is that clock with this plan's cap applied year by year, so
        // an uncapped pension tracks cpiRate exactly and a capped one falls behind it.
        ? inputs.pensionAnnual * sim.pensionFactor
        : 0;

    // One is deceased (if both decease, it won't get here)
    if (!yr.alive1 || !yr.alive2) {
        let rawSurvivorMonthly;
        if (!yr.alive1) {
            // Person 2 (spouse) is survivor
            rawSurvivorMonthly = calculateSurvivorBenefit(
                inputs.die1, inputs.ss1Age, inputs.ss1 / 12,
                inputs.ss2Age, inputs.ss2 / 12,
                birthyear1, birthyear2
            );
            yr.pension = yr.pension * (inputs.survivorPct / 100);
        } else {
            // Person 1 (user) is survivor
            rawSurvivorMonthly = calculateSurvivorBenefit(
                inputs.die2, inputs.ss2Age, inputs.ss2 / 12,
                inputs.ss1Age, inputs.ss1 / 12,
                birthyear2, birthyear1
            );
        }
        const survivorAge      = yr.alive1 ? yr.age1 : yr.age2;
        const survivorStartAge = yr.alive1 ? inputs.ss1Age : inputs.ss2Age;
        const survivorBirthMo  = yr.alive1 ? inputs.birthmonth1 : inputs.birthmonth2;
        // Same claim-year proration for the survivor's own first paying year. A survivor who was
        // already collecting before the death is past their claim year and is unaffected.
        const survivorFirstYear = survivorAge === Math.ceil(survivorStartAge);
        const survivorFrac = survivorFirstYear ? ssFirstYearFraction(survivorBirthMo) : 1;
        const survivorPay = survivorAge >= survivorStartAge
            ? rawSurvivorMonthly * 12 * sim.ssFactor * ssReduction * survivorFrac
            : 0;

        // A single filer reaches this branch too (no spouse means alive2 is false from year one),
        // and for them yr.s1 is simply their OWN benefit -- calculateSurvivorBenefit's higher-of
        // rule returns it when the notional spouse's benefit is zero. Only flag a real widowing,
        // or a single filer's chart would say their survivor benefit had begun.
        yr.isSurvivorSS = birthyear2 > 0;

        // DEATH-YEAR BLEND. `alive` is `age <= die`, so someone is alive through the whole year they
        // reach `die` and the first survivor year is `age === die + 1`. The death falls in the
        // DECEASED's birth month: the months before it paid both spouses' own benefits, the months after
        // pay the survivor benefit. Paying the survivor amount for all twelve months understates the
        // year, because the survivor benefit is the higher of the two and never their sum.
        const deceasedIsP1  = !yr.alive1;
        const deceasedAge   = deceasedIsP1 ? yr.age1 : yr.age2;
        const deceasedDie   = deceasedIsP1 ? inputs.die1 : inputs.die2;
        const deceasedBirthMo = deceasedIsP1 ? inputs.birthmonth1 : inputs.birthmonth2;
        // birthyear2 > 0 keeps single filers out: their notional spouse is "not alive" from year one
        // and would otherwise look like a death in whichever year the arithmetic happened to line up.
        const isDeathYear = birthyear2 > 0 && deceasedAge === deceasedDie + 1;
        // ssFirstYearFraction is (12 - bm) / 12 -- here that is the share of the year AFTER the
        // death, exactly as it is the share after a claim in the claim-year case.
        const afterDeath  = isDeathYear ? ssFirstYearFraction(deceasedBirthMo) : 1;
        const beforeDeath = isDeathYear ? 1 - afterDeath : 0;

        yr.s1 = survivorPay * afterDeath + beforeDeath * (potentialS1 + potentialS2);
        yr.s2 = 0;
        // The milestone latch reads this rather than yr.s1: in a death year yr.s1 can be non-zero
        // purely from the before-death months while the survivor benefit itself has not started
        // (the survivor has not reached their own claiming age), and that is not a survivor start.
        yr._survivorPay = survivorPay * afterDeath;
    }

    // Milestone flags for the charts: the first year money actually ARRIVES, which with the default
    // December birth month is the year AFTER the age crossing (that year prorates to zero). Latched
    // on `sim` so only the first such year is marked. The survivor benefit is tracked separately
    // because the engine folds it into yr.s1 regardless of which spouse survived.
    // The latch stores the YEAR rather than a boolean because computeIncome runs more than once for
    // the same simulated year (the engine's later passes re-derive income). A boolean latch marks
    // the row on the first call and then clears it on the second, so nothing ever reaches the log.
    // yr.y > 0 for the same reason rmdCross requires a previous row: in the plan's first year there
    // is nothing to compare against, so "benefit appears" cannot be told apart from "benefit was
    // already being paid before the plan started". The app's own default spouse claimed years before
    // the start year, and without this guard their chart said their Social Security began in year 0.
    // The cost is that a plan starting exactly in someone's first paying year gets no marker, which
    // is the same trade the RMD markers already make.
    // The test is "was zero last year, is positive this year", not merely "is positive", so someone
    // already drawing benefits when the plan opens is not announced as starting in year 0 (or in
    // year 1, which a first-positive-year test would do instead).
    const own1 = yr.isSurvivorSS ? 0 : yr.s1;
    const own2 = yr.isSurvivorSS ? 0 : yr.s2;
    const surv = yr.isSurvivorSS ? (yr._survivorPay ?? yr.s1) : 0;
    if (yr.y > 0) {
        if (sim._ssStarted1 == null && own1 > 0 && !(sim._ssPrev1 > 0)) sim._ssStarted1 = sim.currentYear;
        if (sim._ssStarted2 == null && own2 > 0 && !(sim._ssPrev2 > 0)) sim._ssStarted2 = sim.currentYear;
        if (sim._ssStartedSurvivor == null && surv > 0 && !(sim._ssPrevSurv > 0)) sim._ssStartedSurvivor = sim.currentYear;
    }
    sim._ssPrev1 = own1;
    sim._ssPrev2 = own2;
    sim._ssPrevSurv = surv;
    yr['-ssStart1'] = sim._ssStarted1 === sim.currentYear;
    yr['-ssStart2'] = sim._ssStarted2 === sim.currentYear;
    yr['-ssStartSurvivor'] = sim._ssStartedSurvivor === sim.currentYear;
    yr.fixedInc = yr.s1 + yr.s2;					// Social Security
    yr.taxableInc = yr.pension;				// Pensions, W2, RMDs, IRA withdrawals, wdBrokerage

    // These will be APPROXIMATE worst case - no Withdrawals have been made.
    //
    // THE ESTIMATE IS TRUED UP THE FOLLOWING YEAR. Interest is taxed here, at the withdrawal point,
    // on the balance the cash has at that moment times the full-year yield, because that is the only
    // figure available before the year's withdrawals are sized. It is wrong in both directions: cash
    // that leaves during the year is taxed on interest it never earns, and cash that ARRIVES after
    // this point - a banked surplus, or the distribution Split takes in January - earns yield this
    // line never sees.
    //
    // `growAndSettle` knows what the cash actually earned once the year settles, and the difference
    // is carried into this line next year, so over a plan the interest taxed equals the interest
    // earned to within the final year's residual. Same-year exactness would need the tax passes to
    // know the post-withdrawal balance before the withdrawals exist, which is circular.
    //
    // The carry moves tax and nothing else, and it cannot make taxable interest negative: a carry
    // larger than the estimate zeroes the line and the unabsorbed remainder rolls forward again,
    // which is why the carry is recomputed from the ledger rather than reset.
    const _interestEstimate = balance.Cash * inputs.cashYield;
    yr._cashInterestCarryIn = sim.cashInterestCarry ?? 0;
    yr.taxableInterest = Math.max(0, _interestEstimate + yr._cashInterestCarryIn);
    yr.taxableDividends = balance.Brokerage * inputs.dividendRate


    // 3. RMDs and QCDs
    yr.rmd1Pct = getRMDPercentage(sim.currentYear, birthyear1);
    let rmd2Pct = getRMDPercentage(sim.currentYear, birthyear2);
    // Struck off the PRIOR DECEMBER 31 balance, not the current mid-year one. See the snapshot in
    // `beginYear` for the regulation and for what reading `balance` here costs.
    //
    // THE INHERITED BALANCE BELONGS TO THE SURVIVOR IN THE YEAR IT LANDS. Step 1 above moves the
    // decedent's IRA into the survivor's account at the top of this year, but the basis read here is
    // the prior December 31 SPLIT, in which that money was still the decedent's - and a dead person's
    // RMD is zeroed by the guard below, so charging the basis to them charges it to nobody and a
    // whole year of required distribution simply does not happen. The year after recovers on its own,
    // because by then the prior year-end split has the money in the right account, which is why
    // exactly one year goes missing per death.
    //
    // The survivor's own divisor and their own age, which is the treat-as-own election: under their
    // RMD age their percentage is 0 and the inherited money is correctly not distributed at all. The
    // added term self-extinguishes - once the decedent's account has been zero for a full year their
    // prior year-end balance is 0 and the sum is unchanged - so it cannot double-count later.
    const _pIRA1 = sim.priorYearEnd?.IRA1 ?? balance.IRA1;
    const _pIRA2 = sim.priorYearEnd?.IRA2 ?? balance.IRA2;
    yr.rmd1 = yr.alive1 ? (_pIRA1 + (yr.alive2 ? 0 : _pIRA2)) * yr.rmd1Pct || 0 : 0;
    yr.rmd2 = yr.alive2 ? (_pIRA2 + (yr.alive1 ? 0 : _pIRA1)) * rmd2Pct || 0 : 0;
    yr.rmd1Pct = Math.max(yr.rmd1Pct, rmd2Pct, 0);

    // QCDs: leave IRA tax-free to charity (age 70.5+). Satisfy RMDs without adding to taxable income/MAGI.
    // Provisional MAGI estimate (IRA withdrawals unknown here; uses pension+RMD+SS+interest/divs).
    // P70d. sim.cpiRate (a FACTOR), not inputs.cpi (a rate) re-raised to a power inside the
    // helper. TAXData.QCD.AMOUNT is stated in QCD.YEAR dollars and cpiRate is anchored at the
    // same real current year, so this is the identical exponent under a fixed rate and the only
    // correct one under a path. Same convention as every bracket lookup (`b.l * cpiRate`).
    const qcdLimit = getQCDLimit(sim.cpiRate);
    // The benefit enters at its largest possible taxable share, the top SOCIALSECURITY rate (85%).
    const ssMaxTaxable = TAXData.SOCIALSECURITY[yr.status].brackets[2].r;
    const provisionalMAGI = yr.taxableInc + yr.rmd1 + yr.rmd2 + ssMaxTaxable * (yr.s1 + yr.s2) + yr.taxableInterest + yr.taxableDividends;
    const _qcds = computeAnnualQCDs(inputs, balance, sim.currentYear, qcdLimit, provisionalMAGI, sim.cpiRate, yr.alive1, yr.alive2, yr.status);
    yr.qcd1 = _qcds.qcd1;
    yr.qcd2 = _qcds.qcd2;
    yr.totalQCD = _qcds.totalQCD;

    // QCDs leave the IRA first (charitable transfer, excluded from income). Every debit below floors at
    // zero, and totalRMD / taxableRMD are computed from what actually MOVED rather than from the
    // requirement: an IRA drained below the required amount must not be taxed on a distribution that
    // never happened, which a large QCD can produce. The pre-debit balances are captured so each leg
    // reports its realized outflow.
    const _preQcd1 = balance.IRA1, _preQcd2 = balance.IRA2;
    balance.IRA1 = Math.max(0, balance.IRA1 - yr.qcd1);
    balance.IRA2 = Math.max(0, balance.IRA2 - yr.qcd2);
    const _qcdOut1 = _preQcd1 - balance.IRA1, _qcdOut2 = _preQcd2 - balance.IRA2;

    // Remaining RMD (after QCD satisfies part/all) is taken as taxable IRA distribution
    const remainingRmd1 = Math.max(0, yr.rmd1 - yr.qcd1);
    const remainingRmd2 = Math.max(0, yr.rmd2 - yr.qcd2);
    const _preRmd1 = balance.IRA1, _preRmd2 = balance.IRA2;
    balance.IRA1 = Math.max(0, balance.IRA1 - remainingRmd1);
    balance.IRA2 = Math.max(0, balance.IRA2 - remainingRmd2);
    const _rmdOut1 = _preRmd1 - balance.IRA1, _rmdOut2 = _preRmd2 - balance.IRA2;
    yr.curIRA = Math.max(0, balance.IRA1 + balance.IRA2 - yr.iraGoalNominal);

    yr.totalRMD = _qcdOut1 + _rmdOut1 + _qcdOut2 + _rmdOut2;    // realized, not merely required
    yr.taxableRMD = _rmdOut1 + _rmdOut2;                        // taxable portion (excludes QCDs)
    // Per spouse, and split by DESTINATION rather than by tax treatment, because the RMD timing leg
    // in growAndSettle needs both halves and they do not go to the same place. Every distributed
    // dollar leaves the IRA and stops earning the IRA's rate; only the non-QCD part reaches the
    // household and can sit in Cash. A QCD goes to charity and earns the household nothing.
    yr._iraOut1 = _qcdOut1 + _rmdOut1;   yr._iraOut2 = _qcdOut2 + _rmdOut2;
    yr._toCash1 = _rmdOut1;              yr._toCash2 = _rmdOut2;
    yr.totalIRAForcedWithdrawals = _qcdOut1 + _rmdOut1 + _qcdOut2 + _rmdOut2; // actual IRA outflow
    yr.taxableInc += yr.taxableRMD;                                       // only non-QCD RMDs are income
    // SPENDABLE income only. Dividends and interest are taxable (they reach calculateTaxes through
    // qualifiedDiv and earnedIncome) but they are NOT counted here, because growAndSettle credits
    // them to a balance. See the totalIncome / spendableIncome note in resolveResidualAndForcedIRA.
    yr.possibleIncome = yr.taxableInc + yr.fixedInc;
}

// Strategy flags, Guyton-Klinger spend adjustment, target spend, marginal-rate seeds, and the working balance snapshot.
function resolveSpendTarget(sim, yr) {
    const { inputs, balance } = sim;
    const y = yr.y;
    // 4. Determine Target Spending amount based on Strategy
    // ACA is a STRICT-cap strategy: it shares the bracket strategy's ceiling math and
    // Cash→Brokerage→Roth gap-fill, but is excluded from the soft-cap forced-IRA fallback
    // (breaching an ACA FPL cap forfeits the premium subsidy - a cliff, not a tax bump).
    //
    // The cap LAPSES once every living spouse is on Medicare (yr.acaLapsed, resolveHousehold).
    // From that year the strategy stops being one: the branch chain in planPrimaryWithdrawals
    // matches nothing and falls through to the baseline `else`, which is Proportional 0% line for
    // line. RELEASING THE CEILING OUTRIGHT WAS CONSIDERED AND REJECTED, twice over: every ACA row
    // carries stratRate: 0, so falling into the federal-bracket branch would land on the 10%
    // bracket - TIGHTER than the cap it replaced - and an unbounded ceiling collapses
    // `IRAwd = Math.min(yr.curIRA, room)` to `yr.curIRA`, draining the whole above-goal IRA in the
    // crossing year. That is a cliff created by the fix, not a policy.
    yr.isACAStrategy = inputs.strategy === 'aca' && !yr.acaLapsed;
    // 'schedule' joins this set because it fills a ceiling exactly as the bracket families do: it takes
    // the same gap-fill cascade (Cash -> Brokerage -> Roth) and the same targetSpend treatment, or it
    // could not reproduce the family it was compiled from. WHICH cascade is a per-YEAR choice, because
    // it is the other thing a family decides: a scheduled year states it on its entry (default
    // 'cascade'), an unscheduled year inherits it from the fallback. Falling through to baseline
    // Proportional and then taking the bracket cascade would be half of each family.
    yr.isBracketStrategy = inputs.strategy === 'bracket' || inputs.strategy === 'fixedpct'
        || yr.isACAStrategy;
    if (inputs.strategy === 'schedule') {
        const _se = _schedulePlanFor(inputs, yr.y);
        yr.isBracketStrategy = _se ? _se.gapFill === 'cascade'
                                   : (inputs.scheduleFallback ?? 'none') !== 'baseline';
    }
    yr.isOrderedStrategy = inputs.strategy === 'ordered';

    // The deduction `computeBracketCeiling` adds back, so that "fill the 22% bracket" reaches the top
    // of the 22% bracket. A federal bracket top bounds TAXABLE income, the ceiling is spent against
    // MAGI, and the deduction is exactly the gap.
    //
    // WHICH DEDUCTION is asked for rather than worked out: `calculateTaxes` is the only thing that
    // decides standard or itemized, the age-65 bumps and the senior deduction after its phase-out,
    // so a second derivation here would be free to drift from the one charging the tax. What it is
    // asked ABOUT is a provisional year - this year's real fixed income plus an IRA draw large enough
    // to reach the bracket top.
    //
    // THE CIRCULARITY IS REAL AND THIS IS THE STEP AROUND IT: the senior deduction phases out against
    // federal AGI, which is what the ceiling determines, so the year's own deduction cannot be known
    // exactly before the ceiling is placed. What the estimate misses is logged beside what was
    // charged (`-ceilDedAddBack` against `-fedDeduction`), so the residual is auditable from a
    // finished run rather than argued. The rejected alternative, last year's charged deduction
    // re-indexed, is wrong by a whole deduction in a year the filing status changes.
    //
    // GATED to the case that uses it: the federal branch is reached only from a `bracket` strategy
    // with no IRMAA tier and no ACA multiple, and every other ceiling gets 0 here.
    if (inputs.strategy === 'bracket' && (inputs.stratIRMAATier ?? -1) < 0
                                      && (inputs.stratACAMultiple ?? 0) <= 0) {
        const _top = findLimitByRate('FEDERAL', yr.status, inputs.stratRate, sim.cpiRate).limit;
        const _fixed = yr.pension + yr.taxableRMD + yr.taxableInterest + yr.taxableDividends + yr.fixedInc;
        const _dedAt = income => {
            const _provIRA = Math.max(0, income - _fixed);
            return calculateTaxes(taxArgs(sim, yr, {
                IRMAAAnnualCost: 0, capGains: 0,
                earnedIncome: yr.pension + yr.taxableRMD + yr.taxableInterest + _provIRA,
                iraIncome: yr.taxableRMD + _provIRA,
            })).federalStdDeduction;
        };
        // TWO PASSES, and the second is not a refinement for its own sake. The first asks at the BRACKET
        // TOP, about one deduction below where the plan will land, so the senior deduction is
        // under-phased-out and comes back too large - and a ceiling raised by too much deduction
        // overshoots the bracket top rather than reaching it. The second asks at the ceiling the first
        // implies, which is where the income really lands. A third pass is not worth its call: the
        // phase-out rate is 6%, so each pass cuts the error by that factor.
        yr._ceilDedAddBack = _dedAt(_top + _dedAt(_top));
    }

    // Guyton-Klinger dynamic spend adjustment, run before the spend target is resolved.
    //
    // THE RULE IS SEPARABLE FROM THE STRATEGY. `spendRule: 'gk'` runs this adjustment under any
    // strategy, so a schedule can decide the DRAW while Guyton-Klinger decides the SPEND. That
    // separation is what makes the combination followable rather than a hindsight artifact: replaying
    // GK's recorded spend numbers under a different draw is not a policy anyone could follow, because
    // GK's own dynamics would have reacted to that draw.
    //
    // The rule measures what the PORTFOLIO funds - spending net of Social Security and pension - over
    // the portfolio it had, and compares that against the same ratio on the plan's own no-rule path
    // for the SAME year (`sim.gkShape`, `_gkShapeOf`). Measured against year 0 instead, the years
    // before a benefit starts drift toward the band and a cut lands in the very year the benefit
    // arrives. Against the plan's own ratio for the year, a benefit start moves the plan and the path
    // together and nothing fires; a market fall moves only the path, and the rule reacts.
    if (_usesGKSpendRule(inputs)) {
        if (y === 0) {
            sim.gkIWR = sim.spendGoal / sim.prevPortfolio;
            sim.gkAdjLabel = '';
            sim.gkShapeGoal = sim.spendGoal;
        } else {
            const _guard  = inputs.gkGuard  ?? GK_DEFAULTS.guard;
            const _adjP   = inputs.gkAdjPct ?? GK_DEFAULTS.adjPct;
            const labels  = [];
            // The shape takes CPI EVERY year, including a year the rule freezes the goal's raise.
            // It is the path the plan would have followed with the rule off, and the rule's own
            // reactions are exactly what it must not contain. Spend Delta is applied to it in
            // endYear, beside the goal's, so the two advance together.
            if (sim.gkShapeGoal != null) sim.gkShapeGoal *= (1 + yr.yearInflation);
            // This year's guaranteed income, and the plan's own ratio for the year: what its
            // portfolio funds this year over the portfolio it had at the end of the year before.
            const G = (yr.s1 ?? 0) + (yr.s2 ?? 0) + (yr.pension ?? 0);
            const shapeRow = sim.gkShape?.[y], shapePrev = sim.gkShape?.[y - 1];
            const ref = (shapeRow && shapePrev && shapePrev.portfolio > 0)
                ? (shapeRow.spend - shapeRow.guar) / shapePrev.portfolio : null;
            const ratio = goal => sim.prevPortfolio > 0 ? (goal - G) / sim.prevPortfolio : Infinity;
            // Inflation Rule: skip the raise after a year the PORTFOLIO lost money, while the draw is
            // above the plan's own. Otherwise raise by the year's inflation, never by more than 6%. The
            // shape above takes full inflation: it is what spending would have been with no rule.
            if (sim.gkPriorReturn < 0 && ref != null && ratio(sim.spendGoal) > ref) {
                labels.push('no-CPI');
            } else if (yr.yearInflation > GK_CPI_RAISE_CAP) {
                sim.spendGoal *= (1 + GK_CPI_RAISE_CAP);
                labels.push(`CPI≤${(GK_CPI_RAISE_CAP * 100).toFixed(0)}%`);
            } else {
                sim.spendGoal *= (1 + yr.yearInflation);
            }
            // Guardrail checks on the (possibly inflation-adjusted) draw. A year the plan's own
            // portfolio funds nothing (ref <= 0) has no band to sit outside of.
            const _preRule = sim.spendGoal;
            const _cwr = ratio(sim.spendGoal);
            const banded = ref != null && ref > 0;
            const high = banded && _cwr > ref * (1 + _guard);
            const low  = banded && _cwr < ref * (1 - _guard);
            // P127. No cut in the plan's last GK_NO_CUT_FINAL_YEARS years. `y` is the plan year, so a
            // resumed run counts from the same end the whole plan does. Labeled rather than silent,
            // because the reader of the ruleAdj column would otherwise see a year over the band and no cut.
            const _cutAllowed = (sim.planYears - y) > GK_NO_CUT_FINAL_YEARS;
            if (high && !_cutAllowed) {
                labels.push('no-cut');
            } else if (high) {
                sim.spendGoal *= (1 - _adjP);
                labels.push(`−${(_adjP * 100).toFixed(0)}%cap`);
            } else if (low) {
                sim.spendGoal *= (1 + _adjP);
                labels.push(`+${(_adjP * 100).toFixed(0)}%pros`);
            }
            // `gkShapeCeiling`, DEFAULT OFF. Holds the goal at the plan's own spending shape, so the
            // rule can undo its own cuts but never spend above what the household asked for.
            //
            // ONLY THE PROSPERITY RAISE CAN BREACH THE SHAPE, which is why this is a ceiling and not
            // a band: CPI moves the goal and the shape by the same factor, the freeze moves the goal
            // DOWN against the shape, and a cut moves it further down. The clamp therefore fires only
            // after a raise, making the rule asymmetric on purpose - cuts react to the portfolio,
            // raises can do no more than walk the goal back up to the plan.
            //
            // NOT WIRED to the page, the sweep or the Optimizer: turning it on changes the spending
            // of every plan that has Guardrails on. `research/RISK_BASED_GUARDRAILS.md` section 7
            // measures what it costs.
            if (inputs.gkShapeCeiling && sim.gkShapeGoal != null && sim.spendGoal > sim.gkShapeGoal) {
                sim.spendGoal = sim.gkShapeGoal;
                labels.push('@shape');
            }
            sim.gkAdjLabel = labels.join(' ') || '';
            yr['-ruleMove'] = sim.spendGoal - _preRule;
        }
    }

    // The risk-based rule (Tharp and Fitzpatrick). Spending takes CPI every year and is reset when
    // the plan's CHANCE OF SUCCESS crosses a rail, not when a withdrawal rate does. The chance is
    // never computed here: the rails solver found, along this plan, the spend-to-wealth ratio at
    // which the chance falls to the cut level, the one at which it reaches the raise level, and the
    // ratio each adjustment returns the plan to (`railsRuleTable`). A year compares its own spending
    // over the after-tax wealth it starts with - the same TotalNetWealth the rails are stated in.
    //
    // No freeze, no CPI cap, no suspension near the end: the published rule has none, and the horizon
    // is already inside the chance the rails were solved for. CPI is applied where the plan without a
    // rule applies it, at the END of the year from that year's inflation, and not - as GK does - at
    // the start of the next year from the next year's. The shape and the ceiling are GK's:
    // `gkShapeGoal` is the plan's own path and `gkShapeCeiling` holds the goal at it. A year with no
    // row - no table, or a table this plan was never solved for - is left on the shape and says so in
    // the label; the page never hands the rule a stale table.
    if (_usesRBGSpendRule(inputs)) {
        if (y === 0) {
            sim.gkAdjLabel = '';
            sim.gkShapeGoal = sim.spendGoal;
        } else {
            const labels = [];
            const _preRule = sim.spendGoal;
            const row = _rbgRowAt(inputs, y);
            const w = sim.prevNetWealth;
            if (!row) {
                labels.push('no rails');
            } else if (w > 0 && row.wealthReal > 0) {
                const pct = q => `${Math.round(q * 100)}%`;
                // What the portfolio has to fund: spending net of this year's Social Security and
                // pension, which computeIncome has already resolved. The table is in the same terms.
                const g = (yr.s1 ?? 0) + (yr.s2 ?? 0) + (yr.pension ?? 0);
                const r = (sim.spendGoal - g) / w;
                // The landing: the row's line for that chance, at this path's wealth as a multiple
                // of the spine's, both in today's dollars, back in this path's dollars, plus its
                // own guaranteed income.
                const wReal = w / sim.inflation;
                const m = wReal / row.wealthReal;
                // The line holds between the rail and the plan's wealth, where its two points were
                // solved. Beyond the rail - a path far under the cut rail, or far over the raise
                // rail - the rail's own spend-to-wealth ratio is held instead: the scale-free
                // reading, and a bound on a steep line that was landing at $0 (2026-09-20).
                // "Beyond" is the far side of the RAIL from the plan's wealth (multiple 1): under a
                // rail that sits below the plan, over one that sits above it.
                const beyondRail = mRail => mRail != null && mRail > 0 && (mRail < 1 ? m < mRail : m > mRail);
                const land = (a, b, mRail) => {
                    const share = beyondRail(mRail) ? (a + b * mRail) / mRail * m : a + b * m;
                    return g + share * row.wealthReal * sim.inflation;
                };
                if (row.cutAt != null && row.cutB != null && r > row.cutAt) {
                    sim.spendGoal = Math.max(0, land(row.cutA, row.cutB, row.cutM));
                    labels.push(`cut→${pct(inputs.rbgRails.cutTo)}`);
                } else if (row.raiseAt != null && row.raiseB != null && r < row.raiseAt) {
                    sim.spendGoal = Math.max(0, land(row.raiseA, row.raiseB, row.raiseM));
                    labels.push(`raise→${pct(inputs.rbgRails.target)}`);
                }
            }
            if (inputs.gkShapeCeiling && sim.gkShapeGoal != null && sim.spendGoal > sim.gkShapeGoal) {
                sim.spendGoal = sim.gkShapeGoal;
                labels.push('@shape');
            }
            sim.gkAdjLabel = labels.join(' ') || '';
            yr['-ruleMove'] = sim.spendGoal - _preRule;
        }
    }

    // P103b5. A schedule may set the year's spend outright, applied HERE for the same reason GK's
    // adjustment lives here: everything downstream - targetSpend, the gap fill, the surplus, the
    // per-year success test and the lifetime spend total - reads sim.spendGoal or what it resolves
    // to, so setting it at one point keeps them all consistent. Restored at the end of the year
    // (see the carry-forward) so a year's spend does not compound into the next.
    yr._spendOverride = null;
    if (inputs.strategy === 'schedule') {
        const _sp = _schedulePlanFor(inputs, y);
        if (_sp && _sp.spend !== undefined) {
            yr._spendOverride = sim.spendGoal;
            sim.spendGoal = _sp.spend;
        }
    }

    // A spend rule bypasses goalLimit (bracket ceiling) - spend is dynamically set by the rule
    const isGKStrategy = _usesSpendRule(inputs);
    const _schedSetSpend = yr._spendOverride != null;
    yr.targetSpend = (yr.isBracketStrategy || yr.isOrderedStrategy || isGKStrategy || _schedSetSpend)
        ? sim.spendGoal : Math.min(sim.spendGoal, yr.goalLimit);

    // Medicare premiums as real money out, when the user asked for it (`medicarePremiumMode`).
    // ADDED AFTER THE CEILING CAP, deliberately: `goalLimit` exists to hold DISCRETIONARY spending
    // inside a tax bracket, and a Part B bill is not discretionary. Capping it would model the
    // household dropping its health coverage to stay in the 22% bracket.
    //
    // THIS LINE ALONE IS NOT ENOUGH, and getting that wrong once is why this comment is here.
    // `targetSpend` sizes what the plan RAISES; `routeSurplusAndConvert` decides what it CONSUMES,
    // and it measures consumption against `sim.spendGoal`. Adding the premium here and nowhere else
    // drew the money, paid the tax on the draw, and banked the rest right back as surplus: a $5,805
    // premium moved total assets by $1,610 - exactly the extra tax - and the premium itself never
    // left the household. Money has to be taken out of BOTH, or it is not spent at all.
    yr.targetSpend += yr.medicareOutflow ?? 0;


    // Size the primary draw against income the household can actually SPEND. `yr.possibleIncome` is
    // GROSS - Social Security, pension and the taxable RMD before any tax is paid - so
    // subtracting it whole sized the draw as if that income arrived tax free, and the tax on it went
    // unfunded every year of the run. The later passes correct the draw's own tax, never this.
    //
    // The tax is COMPUTED, not estimated with a rate. possibleIncome mixes three things taxed
    // differently: Social Security (0-85% included), ordinary pension/RMD, and qualified dividends
    // (0/15/20%). Multiplying the whole by sim.nominalTaxRate overstates the tax on the SS and
    // qualified-dividend parts and over-draws, which is a plausible wrong answer rather than an
    // error. So calculateTaxes runs on the guaranteed-income base ALONE, with no discretionary IRA
    // draw and no capital gains, mirroring the argument shape used in the forced-IRA loop.
    // yr.IRMAA is added separately below and tax.totalTax excludes it, so there is no double count.
    yr.guaranteedIncomeTax = yr.possibleIncome > 0 ? calculateTaxes(taxArgs(sim, yr, {
        capGains: 0,
        earnedIncome: yr.pension + yr.taxableRMD + yr.taxableInterest,
        iraIncome: yr.taxableRMD,
    })).totalTax : 0;

    yr.additionalSpendNeeded = Math.max(0, yr.targetSpend + yr.IRMAA - (yr.possibleIncome - yr.guaranteedIncomeTax));

    // INCOMPLETE: marginalFedTaxRate and marginalStateTaxRate are set to the rates AT the
    // spendGoal bracket, not refined to the next lower IRMAA/state limit. To fix: after
    // finding goalFedBracketLimit, walk down findLimitByRate() to find the ceiling that
    // keeps MAGI below the next IRMAA threshold, then re-derive the state bracket ceiling.
    yr.marginalFedTaxRate = yr.goalFedBracketLimit.rate
    yr.marginalStateTaxRate = yr.goalStateBracketLimit.rate

    //	calculateProgressive('FEDERAL', status, amount, inflation=1, ratecreep=1)

    yr.nominalFedTaxRateAtLimit = CEILING_RATE_PLACEHOLDERS.fed;
    yr.nominalStateTaxAtLimit = CEILING_RATE_PLACEHOLDERS.state;
    yr.withdrawStrategy = { order: [], weight: [], taxrate: [] };

    yr.curBalances = { IRA: balance.IRA1 + balance.IRA2, Brokerage: balance.Brokerage, BrokerageBasis: balance.BrokerageBasis, Roth: balance.Roth1 + balance.Roth2, Cash: balance.Cash, IRA1: balance.IRA1, IRA2: balance.IRA2 };

    // Cash Reserve floor (P2): keep the target buffer (cashReserve is TODAY'S dollars, inflated to
    // this year's terms) out of reach of ordinary spending draws by hiding it from curBalances.Cash.
    // resolveResidualAndForcedIRA restores it as the LAST resort (after Cash/Brokerage/Roth/forced-
    // IRA are exhausted) and flags cashBreach. OFF (cashReserve == null) or Cyclic (no cash buffer
    // concept) -> nothing hidden, byte-identical to today.
    yr._reserveHidden = (inputs.CashReserve != null && !inputs.cyclicEnabled)
        ? Math.min(inputs.CashReserve * sim.inflation, Math.max(0, yr.curBalances.Cash))
        : 0;
    yr.curBalances.Cash -= yr._reserveHidden;

    yr.capGainsPercentage = balance.Brokerage !== 0
        ? (balance.Brokerage - balance.BrokerageBasis) / balance.Brokerage
        : 0;
}

// The two spend rules, and the absence of one. A rule owns the SPEND; a strategy owns the DRAW.
const SPEND_RULE = Object.freeze({
    NONE: '',      // the plan's own goal, no rule
    GK:   'gk',    // Guyton-Klinger: band and step, measured against the plan's own path (P132j)
    RBG:  'rbg',   // risk-based: spending follows the chance of success, off the rails table
});
const KNOWN_SPEND_RULES = Object.freeze(Object.values(SPEND_RULE));

// Where a Roth draw sits in the gap fill. Research-only, no UI and no URL parameter; the two
// names are validated at the site that reads them, because anything else has to mean "leave
// today's behavior alone" rather than silently pick the other position.
const ROTH_GAP_FILL = Object.freeze({
    CASH_FIRST: 'fillCashThenRoth',   // Cash, then Roth, then Brokerage
    ROTH_FIRST: 'fillRothThenCash',   // Roth ahead of Cash
});
// Same reasoning as assertKnownStrategy: an unrecognized rule used to mean "no rule", so a
// misspelled one ran the plan with its guardrails silently switched off - and a plan whose spending
// is supposed to react to the market, running without reacting, is a different plan.
function assertKnownSpendRule(inputs) {
    const r = inputs ? inputs.spendRule : undefined;
    if (r === undefined || r === null || KNOWN_SPEND_RULES.includes(r)) return;
    throw new Error(`unknown spendRule '${r}'`);
}

// P103b5b, P126. True when the Guyton-Klinger spend adjustment - Guardrails - governs this run's
// spend. It is only ever the rule, `spendRule: 'gk'`, under whatever strategy draws; that separation
// is what lets any strategy, a schedule included, own the DRAW while the rule owns the SPEND.
function _usesGKSpendRule(inputs) {
    return inputs.spendRule === SPEND_RULE.GK;
}
// P132j. The plan's own path for the GK-style rule to measure against: the same plan with no rule,
// on its assumed return and inflation (never a Monte Carlo path's), one row per plan year with the
// portfolio at its end, the spend goal and the guaranteed income. Memoized on the plan's inputs
// minus everything that is a path or a derived table, because a Monte Carlo run and a sweep hand
// simulate() hundreds of input objects that describe one plan.
const _GK_SHAPE_STRIP = ['gkShape', 'rbgRails', 'resume', 'captureResume', 'computeOC',
                         'returnSequence', 'inflationSequence', 'returnSequencePerAccount'];
const _gkShapeCache = new Map();
function _gkShapeOf(inputs) {
    const twin = { ...inputs, spendRule: '', computeOC: false, captureResume: false };
    for (const k of _GK_SHAPE_STRIP) delete twin[k];
    let key;
    try { key = JSON.stringify(twin); } catch (e) { key = null; }
    if (key != null && _gkShapeCache.has(key)) return _gkShapeCache.get(key);
    const shape = simulate(twin).log.map(r => ({ portfolio: r.portfolioBalance ?? 0, spend: r.spendGoal ?? 0, guar: r.guaranteedIncome ?? 0 }));
    if (key != null) {
        if (_gkShapeCache.size >= GK_SHAPE_CACHE_MAX) _gkShapeCache.delete(_gkShapeCache.keys().next().value);
        _gkShapeCache.set(key, shape);
    }
    return shape;
}
// P132. The risk-based rule: spending follows the chance of success, read off a table the rails
// solver produced for this plan (`inputs.rbgRails`, railsRuleTable in montecarlo/rails_engine.js).
function _usesRBGSpendRule(inputs) {
    return inputs.spendRule === SPEND_RULE.RBG;
}
// Either rule: the places that care only that SOMETHING other than the plan's own path sets the
// year's spending - the bracket ceiling bypass, the log columns, Spend Delta's timing, the search
// filter - read this one.
function _usesSpendRule(inputs) {
    return inputs.spendRule === SPEND_RULE.GK || inputs.spendRule === SPEND_RULE.RBG;
}
// The rule's row for plan year y, or null when the table has none (no table, a year before the
// first solve, or a year the page never solved for this plan).
function _rbgRowAt(inputs, y) {
    const t = inputs.rbgRails;
    if (!t || !Array.isArray(t.years)) return null;
    return t.years[y] ?? null;
}

// P127. Two of the published rule's limits, adopted by the user on 2026-09-16. The inflation raise
// never exceeds 6% in one year (Guyton and Klinger, 2006). The capital-preservation cut is
// suspended near the end of the plan: the paper suspends it for the final 15 years, because that
// close to the end the portfolio no longer has to last long, and the user set 8.
const GK_CPI_RAISE_CAP      = 0.06;
const GK_NO_CUT_FINAL_YEARS = 8;

// P127. The PORTFOLIO's return for the year, which is what the published inflation freeze reads.
// The rule used to read `baseReturn`, the market return before any account applies its own mix,
// dividend or yield - identical where every account takes the base return, and not otherwise:
// Cash earns its own yield, Brokerage pays its dividend out, and Historical mode hands each account
// its own blended sequence. One year in thirteen of Historical path-years disagreed in sign.
//
// Weighted by the balances at the start of the year, with each account at the rate the engine
// applies to it this year. Brokerage's dividend is added back because growthRates carries only its
// appreciation - the dividend is paid out separately, but it is still part of what the holding
// returned. An empty portfolio has no return of its own and reads the market's.
function portfolioReturnOf(balance, rates, dividendRate) {
    const parts = [
        [balance.IRA1, rates.IRA1], [balance.IRA2, rates.IRA2],
        [balance.Roth1, rates.Roth1], [balance.Roth2, rates.Roth2],
        [balance.Brokerage, (rates.Brokerage ?? 0) + (dividendRate ?? 0)],
        [balance.Cash, rates.Cash],
    ];
    let held = 0, earned = 0;
    for (const [bal, rate] of parts) {
        if (!(bal > 0)) continue;
        held += bal;
        earned += bal * (rate ?? 0);
    }
    return held > 0 ? earned / held : (rates.IRA1 ?? 0);
}

// P128. Risk-based guardrails: four published parameter sets, each a target probability of
// success, the probability at which spending is raised, and the probability at which it is cut. A
// triggered adjustment resets spending to what the target allows - except that a cut returns to
// `cutTo` where a set names one (P132: the 2024 article's rule cuts at 25% and returns only to 45%,
// while its raise returns to the 80% target). A set without `cutTo` returns to its target. Defined
// ONCE: the rails panel, montecarlo/rails_engine.js and the 'rbg' spend rule read this table.
//
// Loose and Paper raise at 99.5%, not the articles' 100% (user, 2026-09-16). "100%" can only mean
// "every sampled path survived", which climbs without limit as paths are added - a 1,000-path solve
// put it 37% to 44% above a 100-path one (research/RISK_BASED_RAILS_PRECISION.md, section 2). 99.5%
// is still the worst of 100 paths, and becomes a real percentile from 200 paths up. The research
// harness that studies the 2021 ARTICLE keeps its own 100% (.test_harnesses/rbg_harness.js).
const RAIL_PRESETS = Object.freeze({
    // Labels are the user's (2026-09-20): safety-first to risk-first, not the articles' names. Keys
    // stay: share links (rbp=) and saved plans carry them.
    tight: Object.freeze({
        key: 'tight', label: 'High Safety', target: 0.95, upper: 0.99, lower: 0.80,
        source: 'Tharp, "Using Probability-Of-Success-Driven Guardrails To Manage Safe Retirement Spending", Kitces.com',
    }),
    normal: Object.freeze({
        key: 'normal', label: 'Normal', target: 0.90, upper: 0.99, lower: 0.70,
        source: 'Tharp and Fitzpatrick, "The Retirement Distribution \'Hatchet\'", Kitces.com, 2021-11-24 - its implementation recipe',
    }),
    loose: Object.freeze({
        key: 'loose', label: 'More Tolerant', target: 0.80, upper: 0.995, lower: 0.40, cutTo: 0.70,
        source: 'Tharp and Fitzpatrick, "The Retirement Distribution \'Hatchet\'", Kitces.com, 2021-11-24 - its income-risk framing, read as probability of success, with its 0% risk (100%) raise read as 99.5%; a cut returns to 70% (user, 2026-09-20)',
    }),
    paper: Object.freeze({
        key: 'paper', label: 'More Risk', target: 0.80, upper: 0.995, lower: 0.25, cutTo: 0.45,
        source: 'Tharp and Fitzpatrick, "Why Guyton-Klinger Guardrails Are Too Risky For Most Retirees", Kitces.com, 2024-03-27 - its risk-based parameters: spend at 80%, raise at 100% (read as 99.5%) back to 80%, cut at 25% back to 45%',
    }),
});

// `strategy: 'schedule'` carries another strategy's per-year decisions. `inputs.schedulePlan` is
// indexed by plan year; an entry is null, or an object with exactly one of `ordTarget` or `iraDraw`
// plus optional fields:
//
//   ordTarget  the year's ceiling on realized ordinary income, nominal dollars - the quantity
//              computeBracketCeiling returns as `limit`. A TARGET, not a withdrawal: the engine
//              solves the draw against the year's own realized taxes.
//   iraDraw    an explicit voluntary IRA withdrawal, nominal dollars, for the families that take a
//              share of the IRA or amortize a balance and so have no income target to state.
//   spend      the year's spend goal, nominal dollars, FOR THAT YEAR ONLY. `sim.spendGoal` carries
//              forward compounded by spendDelta and inflation, so it is restored before the
//              carry-forward; an in-place override would compound into every later year.
//   convert    a cap, in after-tax dollars, on how much of the year's surplus convertExcessToRoth
//              routes to Roth; uncapped when absent. It picks Roth versus Cash for a surplus already
//              taxed on the way out, so it does NOT lower the gross conversion.
//   kind       which income definition the target is spent against: 'federal' | 'irmaa' | 'aca',
//              default 'federal'. ACA MAGI counts the WHOLE Social Security benefit and the other
//              two at most 85%, so one ordTarget means two different draws.
//
// An ABSENT entry means nothing was scheduled that year: no voluntary draw, and spending falls
// through to the gap-fill cascade, which is the Ordered convention. A PRESENT but malformed entry
// throws, so a typo in a research input is never read as a quiet year.
function _schedulePlanFor(inputs, y) {
    if (!Array.isArray(inputs.schedulePlan)) return null;
    const e = inputs.schedulePlan[y];
    if (e == null) return null;
    if (typeof e !== 'object') {
        throw new Error('schedulePlan[' + y + '] must be an object or null, got ' + typeof e);
    }
    const t = e.ordTarget, d = e.iraDraw;
    const hasT = t !== undefined, hasD = d !== undefined;
    if (hasT === hasD) {
        throw new Error('schedulePlan[' + y + '] needs exactly one of ordTarget or iraDraw');
    }
    if (hasT && (!Number.isFinite(t) || t <= 0)) {
        throw new Error('schedulePlan[' + y + '].ordTarget must be a finite positive number, got ' + t);
    }
    if (hasD && (!Number.isFinite(d) || d < 0)) {
        throw new Error('schedulePlan[' + y + '].iraDraw must be a finite non-negative number, got ' + d);
    }
    const conv = e.convert;
    if (conv !== undefined && (!Number.isFinite(conv) || conv < 0)) {
        throw new Error('schedulePlan[' + y + '].convert must be a finite non-negative number, got ' + conv);
    }
    const spend = e.spend;
    if (spend !== undefined && (!Number.isFinite(spend) || spend < 0)) {
        throw new Error('schedulePlan[' + y + '].spend must be a finite non-negative number, got ' + spend);
    }
    // gapFill has to be PER YEAR, not per plan, and ACA is the proof: its cap is live for the first
    // few years and lapses at Medicare eligibility, and the two halves take different cascades. A
    // plan-level switch cannot state that, which is why b2 could only replay 3 of 33 ACA years.
    const gf = e.gapFill ?? inputs.scheduleGapFill ?? 'cascade';
    if (gf !== 'cascade' && gf !== 'baseline') {
        throw new Error('schedulePlan[' + y + '].gapFill must be cascade|baseline, got ' + gf);
    }
    const kind = e.kind ?? 'federal';
    if (kind !== 'federal' && kind !== 'irmaa' && kind !== 'aca') {
        throw new Error('schedulePlan[' + y + '].kind must be federal|irmaa|aca, got ' + kind);
    }
    // rateBasis: the income level the marginal-rate lookups are keyed on, defaulting to the target.
    // They are the same number for an IRMAA or ACA ceiling and DIFFERENT for a federal bracket one,
    // whose rates are read at the statutory top while its ceiling is lifted by the deduction
    // add-back. A searcher never has to supply it; a compiler that wants exact replay does.
    if (hasD) return { iraDraw: d, kind, convert: conv, gapFill: gf, spend };
    const rb = e.rateBasis ?? t;
    if (!Number.isFinite(rb) || rb <= 0) {
        throw new Error('schedulePlan[' + y + '].rateBasis must be a finite positive number, got ' + rb);
    }
    return { ordTarget: t, kind, rateBasis: rb, convert: conv, gapFill: gf, spend };
}

// P103b2. Compile a finished run into the schedulePlan that reproduces it. One shared compiler,
// because a harness that rolled its own would drift from the accessor above and the drift would look
// like a modeling result. Give it the run and the inputs that produced it.
//
// WHAT IT CAN AND CANNOT CARRY, measured rather than assumed (research/PERFECT_FORESIGHT_ORACLE.md,
// P103b2). Exact, to the dollar, for the CEILING families - Fill Bracket at any rate, IRMAA at any
// tier - because their whole per-year decision IS the ceiling. It carries only the un-lapsed years
// of an ACA plan, since a lapsed year has no ceiling and falls through to baseline Proportional.
// And it carries NOTHING of IRA Draw, Proportional, Ordered, Guyton-Klinger or Reduce: their
// decision is a QUANTITY (a share of the IRA, a spending boost, an account sequence, an
// amortization), not an income target, so every year compiles to null and the replay draws nothing.
// That is the honest coverage of `ordTarget`, and it is what the next field has to fix.
function compileScheduleFromRun(res, srcInputs) {
    // Kind precedence mirrors computeBracketCeiling's own: IRMAA wins when both are set.
    const kind = (srcInputs.stratIRMAATier ?? -1) >= 0 ? 'irmaa'
        : (srcInputs.stratACAMultiple ?? 0) > 0 ? 'aca' : 'federal';
    // P103b3. A family that fills no ceiling is carried by its realized voluntary IRA draw instead,
    // which is the quantity lever. `-iraVolSpend` plus the converted gross is what actually left the
    // IRA by choice that year; RMDs are forced and are never part of a schedule.
    const quantity = (srcInputs.strategy === 'fixedpct' || srcInputs.strategy === 'fixed');
    // P103b5. A spend-adaptive family decides the SPEND, so that is what has to be carried. GK is the
    // whole reason this exists: its per-year decision is the spend goal, which is why it compiled to
    // nothing before this field and why it is excluded from the oracle's gap tables rather than
    // compared in them. `spendGoal` in the log is the year's realized target.
    // P103b5b: a spend-adaptive family hands over its DRAW here and its spend RULE via
    // scheduleOptionsForRun - never its realized spend numbers. Recorded numbers replay the past;
    // the rule can be followed forward, which is the difference between a hindsight artifact and a
    // policy someone could adopt.
    const spendAdaptive = _usesSpendRule(srcInputs);
    // Which cascade the source family took. `fixed` (Reduce) and `propwd` (Proportional) are not in
    // the bracket set, so they fill the gap from the [40,60] default branch instead. Plain
    // Proportional compiles to no entry at all; with Guardrails on it emits its draw, and this is
    // the cascade that draw took.
    const gapFill = (srcInputs.strategy === 'fixed' || srcInputs.strategy === 'propwd') ? 'baseline' : 'cascade';
    return (res.log || []).map(e => {
        const t = e['BracketTarget'] ?? 0;
        if (t > 0) {
            const rb = e['RateBasis'];
            return (rb > 0 && rb !== t) ? { ordTarget: t, kind, rateBasis: rb, gapFill } : { ordTarget: t, kind, gapFill };
        }
        if (spendAdaptive) {
            // The draw only. Spend comes from the rule, re-evaluated each year against whatever
            // portfolio this plan actually has. Emitted for every year, including zero-draw ones,
            // for the reason recorded under the quantity branch below.
            return { iraDraw: e['-volIRAwd'] ?? 0, kind, gapFill };
        }
        if (quantity) {
            // Emitted even when the draw is ZERO, and the zero years are the reason. A quantity
            // family whose amortization has ended still hands the tax passes { IRA: 0, netAmount: 0 };
            // an unscheduled year hands them {}. The two are not the same object downstream, and
            // treating "drew nothing" as "scheduled nothing" left IRA Draw 13 years and $39,117 short.
            // `-volIRAwd` is the branch's own decision, logged for exactly this purpose. Two
            // reconstructions from downstream fields were tried first and both were wrong in
            // different directions ($39,117 short, then $191,737 short), which is the argument for
            // logging the decision instead of inferring it.
            return { iraDraw: e['-volIRAwd'] ?? 0, kind, gapFill };
        }
        return null;                            // nothing this schedule can state
    });
}

// P103b3. The plan-level knobs that go WITH a compiled schedule. Separate from the per-year plan
// because they are not per-year decisions: they say what an unscheduled year means. An ACA plan is
// the case that forced them to exist - its cap lapses at Medicare eligibility and every later year
// falls through to baseline Proportional, which "draw nothing voluntarily" is not.
function scheduleOptionsForRun(srcInputs) {
    const lapses = (srcInputs.stratACAMultiple ?? 0) > 0 && srcInputs.strategy === 'aca';
    // A spend-adaptive source hands over its spend RULE, so the schedule re-evaluates it each year
    // against its own portfolio rather than replaying numbers the source produced under its own draw.
    if (_usesGKSpendRule(srcInputs)) {
        return { scheduleFallback: 'none', spendRule: 'gk',
                 gkGuard: srcInputs.gkGuard, gkAdjPct: srcInputs.gkAdjPct };
    }
    if (_usesRBGSpendRule(srcInputs)) {
        return { scheduleFallback: 'none', spendRule: 'rbg',
                 rbgPreset: srcInputs.rbgPreset, rbgCustom: srcInputs.rbgCustom, rbgRails: srcInputs.rbgRails };
    }
    // Proportional fills its gap from the baseline branch, not the bracket cascade, so a schedule carrying it
    // has to say so; `gapFill` on each entry does that, and the fallback matters only for years the
    // compiler emitted nothing for.
    return { scheduleFallback: lapses ? 'baseline' : 'none' };
}

// Per-year withdrawal-split override for the perfect-foresight oracle (research input: no UI,
// default off). `inputs.oracleWithdrawalPlan` is indexed by plan year; an absent, null or all-zero
// entry means the strategy's own branch runs. Three entry forms:
//
//   { IRA, Brokerage, Cash, Roth }  weights, in that fixed order
//   { prop: true }                  balance-proportional over Brokerage, Cash and Roth, IRA excluded
//   { seq: ['Cash','Roth',...] }    all from the first account, shortfall cascading through the
//                                   rest, so 'IRA' placed last is a true emergency backstop
//
// Returns an { order, weight } fragment for calculateWithdrawals, or null for no override.
//
// WEIGHTS, NEVER DOLLARS. A per-year dollar amount is chosen against the previous iteration's tax
// outcome, and taxes here are endogenous, so it stops being feasible; weights always are, and reuse
// the target-and-shortfall cascade unchanged. Conversions ride `extraConversionAmount` rather than a
// second conversion mechanism here.
function _oracleWithdrawalPlanFor(inputs, y) {
    if (!Array.isArray(inputs.oracleWithdrawalPlan)) return null;
    const e = inputs.oracleWithdrawalPlan[y];
    if (!e) return null;
    if (e.prop === true) {
        return { order: ['Brokerage', 'Cash', 'Roth'], weight: [] };   // [] = derive from balances
    }
    if (Array.isArray(e.seq) && e.seq.length > 0) {
        return { order: e.seq.slice(), weight: e.seq.map((_, i) => i === 0 ? 1 : 0) };
    }
    const w = [e.IRA || 0, e.Brokerage || 0, e.Cash || 0, e.Roth || 0];
    if (!(w[0] + w[1] + w[2] + w[3] > 0)) return null;
    return { order: ['IRA', 'Brokerage', 'Cash', 'Roth'], weight: w };
}
// Per-account tax rates for an oracle order, matching the conventions the family branches use.
function _oracleTaxratesFor(order, sim, yr) {
    return order.map(acct =>
        acct === 'IRA' ? sim.nominalTaxRate
        : acct === 'Brokerage' ? yr.capGainsPercentage * (sim.capitalGainsRate + yr.nominalStateTaxAtLimit)
        : 0);
}

// `strategy: 'split'` - the constant account split: the oracle's per-year weight path given a name
// and ONE vector for every year. It binds exactly where the oracle binds, the primary draw in
// `planPrimaryWithdrawals` and the gap fill in `fillSpendingGap`, and nowhere else, so the
// acceptance test is replay identity - `strategy: 'split'` with vector V must reproduce
// `propwd 0 + oracleWithdrawalPlan.fill(V)` to the dollar (research/PERFECT_FORESIGHT_ORACLE.md).
//
//   inputs.splitWeights   [IRA, Brokerage, Cash, Roth] RELATIVE weights, any non-negative scale with
//                         a positive sum; `calculateWithdrawals` normalizes. Never dollars, for the
//                         reason `_oracleWithdrawalPlanFor` gives. `[0, 0, 1, 0]` is NOT an all-cash
//                         plan: phase 2 of `calculateWithdrawals` walks the order for whatever the
//                         weighted phase left unfunded, so it is Cash, then IRA, then Brokerage,
//                         then Roth.
//
// Everything a split does not decide is the baseline's: `yr.isBracketStrategy` is false, so the
// forced-IRA fallback stays on and the [40, 60] gap branch is never reached; IRA Goal is ignored, as
// propwd and the baseline ignore it; there is no `+%` boost. Cyclic composes the way it composes
// with propwd - a harvest year preempts the split in both passes.
//
// A MALFORMED vector falls back to balance weights (the baseline draw) and sets
// `splitWeightsInvalid` on the result; it never throws. The schedule and oracle inputs throw because
// a typo in a research input must not be read as a quiet year, but a share link or a saved scenario
// can carry anything and a page that dies on load helps nobody. Validated to a SHAPE - four finite
// non-negative numbers with a positive sum - since [0, 0, 0, 0] would put NaN through every balance.
function _splitWeightsFor(inputs) {
    const w = inputs.splitWeights;
    if (!Array.isArray(w) || w.length !== 4) return null;
    if (!w.every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0)) return null;
    if (!(w[0] + w[1] + w[2] + w[3] > 0)) return null;
    return { order: ['IRA', 'Brokerage', 'Cash', 'Roth'], weight: w.slice() };
}

// Draw IRA up to the ceiling already on `yr`, and no further: the room left under the limit once
// the year's other income is counted. Any spending the draw does not cover is filled from
// Cash -> Brokerage -> Roth in the gap-fill pass. Both callers are ceiling strategies - the one
// that computes a ceiling and the one replaying a compiled schedule's recorded ceiling.
//
// P87c. How much of the Social Security benefit the ceiling counts is decided by its KIND, and
// nothing else may decide it. Federal-bracket and IRMAA ceilings are spent against `tax.MAGI`,
// which carries at most 85% of the benefit, so the room is found by INVERTING the MAGI relation -
// nonSSIncomeForMAGI answers "what non-SS income puts MAGI exactly on this limit". An ACA cap
// counts the WHOLE benefit, because ACA MAGI adds the non-taxable part back by statute. Subtracting
// the full benefit from a federal or IRMAA ceiling stops the plan short of the limit it was told to
// fill; inverting an ACA cap breaches it. `kind` is set inside computeBracketCeiling, the only
// place that knows which branch built the number, and a caller must not re-derive it from
// `inputs.stratACAMultiple`: the IRMAA branch wins when both are set, and an ACA cap that has
// lapsed at Medicare eligibility is no longer 'aca'.
function drawIRAToCeiling(yr) {
    const ssCeilRoom = (yr.ceilingKind === 'aca')
        ? yr.limit - yr.fixedInc
        : nonSSIncomeForMAGI(yr.status, yr.limit, yr.fixedInc);
    const iRAbracketRoom = Math.max(0, ssCeilRoom - yr.taxableInc - yr.taxableInterest - yr.taxableDividends);
    const IRAwd = Math.min(yr.curIRA, iRAbracketRoom);
    yr.withdrawals = { IRA: IRAwd, netAmount: IRAwd };
}

// Cyclic harvest-year decision plus the per-strategy primary withdrawal plan.
function planPrimaryWithdrawals(sim, yr) {
    const { inputs, balance } = sim;
    const y = yr.y;
    // Phase 24: Cyclic - determine if this is a brokerage harvest year.
    // N = ratio of IRA to Brokerage balances (min 1). After N IRA years, one brokerage year.
    yr.isBrokerageYear = false;
    yr.subCycleLabel = null;
    if (inputs.cyclicEnabled) {
        if (yr.curBalances.Brokerage > 0) {
            const _cycN = Math.max(1, Math.round(yr.curBalances.IRA / yr.curBalances.Brokerage));
            if (sim.subCycleIRAYears >= _cycN) {
                yr.isBrokerageYear = true;
                sim.subCycleIRAYears = 0;
            } else {
                sim.subCycleIRAYears++;
            }
        } else {
            sim.subCycleIRAYears++;   // Brokerage depleted; keep counting IRA years
        }
        yr.subCycleLabel = yr.isBrokerageYear ? 'Brok' : 'IRA';
    }

    // P51b: the oracle override preempts every strategy branch (the same preemption shape as the
    // cyclic harvest branch). Composition with cyclic is an explicit error, not a precedence rule.
    const _oracleW = _oracleWithdrawalPlanFor(inputs, y);
    if (_oracleW && inputs.cyclicEnabled) {
        throw new Error('oracleWithdrawalPlan cannot compose with cyclicEnabled (research inputs, pick one)');
    }
    // Same rule for the schedule: cyclic owns the withdrawal decision on its harvest years, so a
    // schedule composed with it would be silently ignored in exactly the years it mattered most.
    if (inputs.strategy === 'schedule' && inputs.cyclicEnabled) {
        throw new Error('strategy schedule cannot compose with cyclicEnabled (research inputs, pick one)');
    }
    if (_oracleW) {
        yr.withdrawStrategy.order = _oracleW.order;
        yr.withdrawStrategy.weight = _oracleW.weight;
        yr.withdrawStrategy.taxrate = _oracleTaxratesFor(_oracleW.order, sim, yr);
        yr.withdrawals = calculateWithdrawals(yr.curBalances, yr.additionalSpendNeeded, yr.withdrawStrategy);
    } else if (yr.isBrokerageYear) {
        // Brokerage harvest year: draw from Brokerage instead of IRA, and max out the selected LTCG
        // bracket rather than drawing only what spending needs - that realizes gains and steps up
        // basis even when spending does not need it. If spending forces realization beyond the
        // target, top off whichever LTCG bracket the forced amount lands in, but never past the
        // active ceiling's own MAGI limit if one is in effect this year.
        //
        // Two research inputs, both default to today's behavior, neither wired to any UI:
        //   cycleHarvestMode  'maxbracket' (default) | 'spendonly' - draw only what spending needs,
        //                     skipping the bracket top-off entirely.
        //   cycleCoexist      'off' (default) | 'bracketfill' - the harvest year ALSO runs the
        //                     family's own IRA sizing. The IRA draw is sized FIRST and the harvest
        //                     against the raised ordinary floor, so the draw's LTCG push-up is
        //                     respected by construction. A MAGI-shaped ceiling (IRMAA tier, ACA)
        //                     subtracts the planned harvest's realized LTCG through a two-pass fixed
        //                     point; a federal-bracket-rate ceiling is ordinary-income-shaped, LTCG
        //                     stacks ABOVE it and does not occupy it, so nothing is subtracted.
        const _baseOrdinaryInc = yr.taxableInc + yr.fixedInc + yr.taxableInterest + yr.taxableDividends;
        // nerdknob. The value IS an LTCG rate, read as the exclusive ceiling getLTCGBracketRoom()
        // wants: the middle rate targets the 0% bracket (default), the top rate the 15% bracket.
        const _cycleTargetRate = inputs.cycleLTCGTarget ?? TAXData.FEDERAL.CAPITAL_GAINS.CYCLE_TARGET_DEFAULT;
        const _harvestMode = inputs.cycleHarvestMode ?? 'maxbracket';
        // How much room a strategy ceiling still has above an ordinary-income floor, on the
        // ceiling's OWN income definition.
        //
        // `_baseOrdinaryInc` carries the FULL Social Security benefit, and every caller below
        // compares it against a MAGI ceiling. Federal-bracket and IRMAA ceilings are spent against
        // `tax.MAGI`, which carries at most 85% of the benefit, so a plain subtraction charges the
        // ceiling for income it never receives and the harvest stops short.
        //
        // ACA KEEPS THE FULL BENEFIT, for the same statutory reason it does elsewhere: ACA MAGI adds
        // non-taxable Social Security back, so the whole benefit really does occupy that cap. The
        // fork is on the ceiling's KIND, which is why `computeBracketCeiling`'s `kind` is read here
        // rather than `inputs.stratACAMultiple` - a lapsed ACA year is not an ACA ceiling.
        //
        // Filling the ceiling costs a little lifetime tax and a little ending net worth. That is a
        // consequence to disclose, not a reason to decline: a named ceiling is a contract to FILL,
        // and whether filling a 22% bracket is the better plan is the Optimizer ranking's job to
        // surface, not a license for the engine to under-deliver the strategy that was selected.
        // `harvestCeilSSBasis: 'full'` restores the old arm so the choice stays measurable.
        const _ceilRoomAbove = (ceil, ordFloor) => {
            if ((inputs.harvestCeilSSBasis ?? 'magi') !== 'magi' || ceil.kind === 'aca') {
                return ceil.limit - ordFloor;
            }
            // nonSSIncomeForMAGI answers "what NON-SS income puts MAGI exactly on this limit", so
            // the floor has to be reduced to its own non-SS part to be comparable. ordFloor always
            // contains yr.fixedInc exactly once, at both call sites.
            return nonSSIncomeForMAGI(yr.status, ceil.limit, yr.fixedInc) - (ordFloor - yr.fixedInc);
        };
        // Harvest sizing as a function of the ordinary-income floor. With `ordFloor` =
        // `_baseOrdinaryInc` this is byte-for-byte today's logic; `cycleCoexist` calls it with the
        // floor raised by the IRA draw.
        //
        // An LTCG bracket top is a TAXABLE-income threshold - gains stack on top of ordinary income
        // AFTER the deduction - and `_baseOrdinaryInc` is neither: it carries the FULL Social
        // Security benefit and has no deduction subtracted. Both errors push the floor up, so the
        // room comes back too small and the harvest stops short of the bracket it was told to fill.
        //
        // The two corrections are ASKED FOR rather than rebuilt: `calculateTaxes` already decides
        // the taxable share of the benefit and which deduction this household gets, and it is the
        // same call the ceiling's own deduction uses. Deriving either by hand here would be a second
        // source of truth, free to drift from the one charging the tax. `ordFloor`'s COMPOSITION is
        // deliberately untouched - only its BASIS is corrected.
        //
        // ASKED AT ZERO GAINS, on purpose. Capital gains do enter PROVISIONAL income for the Social
        // Security calculation, so this understates the taxable share slightly; re-asking at the
        // gains pass 1 implied was measured and was not worth its call. The residual that remains is
        // income the year gains AFTER the harvest is sized (a conversion, a forced draw), which no
        // estimate made at sizing time could know. `-ltcgFloor` is logged so that gap stays
        // auditable rather than assumed.
        const _ltcgFloor = (ordFloor) => {
            const _ss = yr.fixedInc;
            const _nonSS = Math.max(0, ordFloor - _ss);
            const _t = calculateTaxes(taxArgs(sim, yr, {
                totalSS: _ss, IRMAAAnnualCost: 0, capGains: 0,
                earnedIncome: yr.pension + yr.taxableRMD + yr.taxableInterest
                            + Math.max(0, _nonSS - yr.pension - yr.taxableRMD - yr.taxableInterest - yr.taxableDividends),
                iraIncome: yr.taxableRMD,
            }));
            const _untaxedBenefit = Math.max(0, _ss - (_t.taxableSS ?? 0));
            const _floor = Math.max(0, ordFloor - _untaxedBenefit - (_t.federalStdDeduction ?? 0));
            // Recorded so the estimate's residual is auditable from a finished run rather than
            // argued, the same way `-ceilDedAddBack` records P92a's.
            yr._ltcgFloor = _floor;
            return _floor;
        };
        const _sizeHarvest = (ordFloor) => {
            if (_harvestMode === 'spendonly') return yr.additionalSpendNeeded;
            // TWO FLOORS, and they are not interchangeable. `_ltcgOrd` is ordinary TAXABLE income,
            // which is what an LTCG bracket top bounds. `ordFloor` stays the gross MAGI-shaped
            // aggregate, which is what the strategy's own ceiling is measured against further down.
            // Collapsing them into one variable would feed a post-deduction figure to a MAGI ceiling
            // and undo the correction above.
            const _ltcgOrd = _ltcgFloor(ordFloor);
            // The strategy's own ceiling caps the harvest on EVERY path, not only the top-off one.
            // It used to be applied to the top-off branch alone, so a harvest that fitted inside the
            // LTCG target bracket was returned without ever being tested against the IRMAA tier or
            // ACA cap the plan was holding. That hole was unreachable only because the room was too
            // small to reach a threshold; correcting the floor above made it reachable, and a
            // coexist harvest year promptly crossed from no tier into IRMAA Tier 1.
            const _capToCeiling = (grossRoom) => {
                if (!(inputs.strategy === 'bracket' || yr.isACAStrategy)) return grossRoom;
                // This branch (isBrokerageYear) runs INSTEAD of the ceiling-computing branch this
                // year, so compute it fresh rather than reading a stale or undefined `limit`.
                // yr.isACAStrategy, not inputs.strategy: a lapsed ACA year has no ceiling to
                // respect, and computeBracketCeiling would still hand back the FPL cap if asked.
                const _ceil = computeBracketCeiling(inputs, yr.status, sim.cpiRate, STATEname, yr.age1, yr.age2, yr.alive1, yr.alive2, yr.fedRateCreep, yr.stateRateCreep, sim.medicareRate, yr._ceilDedAddBack);
                return Math.min(grossRoom, Math.max(0, _ceilRoomAbove(_ceil, ordFloor)));
            };
            const _targetRoom = _capToCeiling(getLTCGBracketRoom(_ltcgOrd, yr.status, _cycleTargetRate, sim.cpiRate));
            const _targetNetRoom = _targetRoom * (1 - yr.capGainsPercentage * sim.capitalGainsRate);
            if (yr.additionalSpendNeeded <= _targetNetRoom) {
                // Spend fits inside the target bracket - max it out anyway.
                return _targetNetRoom;
            }
            // Spend forces gains beyond the target bracket. Find which LTCG bracket the
            // forced realization lands in and top off to that bracket's own ceiling.
            const _spendGrossNeeded = yr.additionalSpendNeeded / Math.max(NET_TO_GROSS_RATE_FLOOR, 1 - yr.capGainsPercentage * sim.capitalGainsRate);
            const _landedRate = getLTCGBracketTopRate(_ltcgOrd, _spendGrossNeeded, yr.status, sim.cpiRate);
            const _ltcgRates = (TAXData.FEDERAL.CAPITAL_GAINS[yr.status]?.brackets ?? []).map(b => b.r);
            const _nextRate = _ltcgRates.find(r => r > _landedRate);
            let _room = (_nextRate !== undefined)
                ? getLTCGBracketRoom(_ltcgOrd, yr.status, _nextRate, sim.cpiRate)
                : _spendGrossNeeded;   // already in the top LTCG bracket - no higher ceiling to top off to
            _room = _capToCeiling(_room);
            return Math.max(yr.additionalSpendNeeded, _room * (1 - yr.capGainsPercentage * sim.capitalGainsRate));
        };

        // cycleCoexist: size the family's IRA draw FIRST (v1 families only), then harvest above it.
        let _coexistIRAwd = 0;
        if ((inputs.cycleCoexist ?? 'off') === 'bracketfill') {
            if (inputs.strategy === 'bracket' || yr.isACAStrategy) {
                // Same ceiling call and field assignments as the family's own branch below, so a
                // coexist harvest year looks to downstream passes like the family branch ran.
                // P87c4. `kind` is taken here too. The family branch below sets `yr.ceilingKind` and
                // a coexist harvest year is meant to look like that branch ran, but this destructure
                // dropped it - so the one field that says WHICH income definition the ceiling uses
                // was undefined in exactly the years this block decides a draw.
                ({ limit: yr.limit, marginalFedTaxRate: yr.marginalFedTaxRate, marginalStateTaxRate: yr.marginalStateTaxRate, nominalFedTaxRateAtLimit: yr.nominalFedTaxRateAtLimit, nominalStateTaxAtLimit: yr.nominalStateTaxAtLimit, stateLimit: yr.stateLimit, kind: yr.ceilingKind } =
                    computeBracketCeiling(inputs, yr.status, sim.cpiRate, STATEname, yr.age1, yr.age2, yr.alive1, yr.alive2, yr.fedRateCreep, yr.stateRateCreep, sim.medicareRate, yr._ceilDedAddBack));
                yr.bracketTarget = yr.limit;
                let _iraRoom = Math.max(0, _ceilRoomAbove({ limit: yr.limit, kind: yr.ceilingKind }, _baseOrdinaryInc));
                const _magiShaped = (inputs.stratIRMAATier ?? -1) >= 0 || yr.isACAStrategy;
                if (_magiShaped) {
                    // Pass 1 of the fixed point: harvest sized at IRAwd=0; its realized LTCG
                    // occupies MAGI room the IRA draw must not double-book.
                    const _net1 = _sizeHarvest(_baseOrdinaryInc);
                    const _gross1 = _net1 / Math.max(NET_TO_GROSS_RATE_FLOOR, 1 - yr.capGainsPercentage * sim.capitalGainsRate);
                    _iraRoom = Math.max(0, yr.limit - _baseOrdinaryInc - _gross1 * yr.capGainsPercentage);
                }
                _coexistIRAwd = Math.max(0, Math.min(yr.curIRA, _iraRoom));
            } else if (inputs.strategy === 'fixedpct') {
                // The 3-line target from the fixedpct branch below, verbatim.
                const pct = inputs.iraWithdrawPct ?? 0.05;
                const originalIRA = balance.IRA1 + balance.IRA2 + yr.totalIRAForcedWithdrawals;
                const targetTotal = originalIRA * pct;
                _coexistIRAwd = Math.max(0, Math.min(yr.curIRA, targetTotal - yr.totalIRAForcedWithdrawals));
            }
            // Other families (propwd/fixed/gk/ordered/baseline): deferred until v1 shows a win.
        }
        const _brokerageNetTarget = _sizeHarvest(_baseOrdinaryInc + _coexistIRAwd);
        if (_brokerageNetTarget > 1 && yr.curBalances.Brokerage > 0) {
            // Depletion check: warn if Brokerage < 50% of what we need
            const _grossNeeded = _brokerageNetTarget / Math.max(NET_TO_GROSS_RATE_FLOOR, 1 - yr.capGainsPercentage * sim.capitalGainsRate);
            if (yr.curBalances.Brokerage < _grossNeeded * CYCLIC_DEPLETION_FRACTION) {
                yr.subCycleLabel = '⚠Brok';
            }
            yr.withdrawals = calculateWithdrawals(yr.curBalances, _brokerageNetTarget,
                { order: ['Brokerage'], weight: [1], taxrate: [yr.capGainsPercentage * sim.capitalGainsRate] });
        } else {
            yr.withdrawals = {};
        }
        if (_coexistIRAwd > 0) {
            // Same face-value convention as the family branches ({ IRA: IRAwd, netAmount: IRAwd });
            // the tax passes and residual resolution price it exactly as they do for those branches.
            yr.withdrawals.IRA = (yr.withdrawals.IRA || 0) + _coexistIRAwd;
            yr.withdrawals.netAmount = (yr.withdrawals.netAmount || 0) + _coexistIRAwd;
        }
    } else if (inputs.strategy === 'fixed') {
        // In this strategy, we confine withdrawals to the IRA for the first round. 
        // We don't care about the tax implications.

        let remYears = Math.max(1, inputs.nYears - y);
        let amortized = Math.max(0, sim.fixedWithdrawal - yr.totalIRAForcedWithdrawals);

        // Withdraw the fixed amount left after RMDs, or whatever is left in IRAs after leaving room.
        // Intra-year growth correction: iraGoalNominal is an END-OF-YEAR target, but the
        // withdrawal happens mid-year and the retained balance still grows for postMonths
        // afterward (factor = (1 + rate)^(postMonths/12), the same one applyGrowth uses).
        // Drawing down to exactly the goal would leave goal*(1+growth) at year end - a
        // systematic ~one-year-of-growth overshoot. Instead draw down to goal/postGrowth so
        // the retained balance lands on the goal at year end; the ×0.99 biases it ~1% under
        // (preferred to overshooting). growthRates.IRA carries the actual per-year return,
        // including the Monte Carlo sequence, so this is correct under variable growth too.
        const postGrowthIRA = growthFactor(yr.growthRates.IRA ?? 0, yr.postMonths);
        const reduceFloor = (yr.iraGoalNominal / postGrowthIRA) * IRA_GOAL_UNDERSHOOT;
        const curIRAreduce = Math.max(0, balance.IRA1 + balance.IRA2 - reduceFloor);
        let IRAwd = Math.max(0, Math.min(curIRAreduce, amortized))
        yr.withdrawals = { IRA: IRAwd, netAmount: IRAwd }

    // yr.isACAStrategy rather than inputs.strategy === 'aca': once the cap has lapsed this chain
    // must NOT match, so the year falls through fixedpct/propwd/ordered (none of which name 'aca')
    // to the baseline `else` below - Proportional 0%, which is the intended successor.
    } else if (inputs.strategy === 'schedule') {
        // P103b2. The ceiling comes from the schedule instead of computeBracketCeiling; everything
        // downstream of the ceiling is the bracket branch's arithmetic, unchanged, so the P87c
        // Social Security basis fix applies here too.
        const _e = _schedulePlanFor(inputs, y);
        if (!_e) {
            // P103b3. What an UNSCHEDULED year does is now a choice, because b2 measured it as the
            // real coverage limit: an ACA plan replayed only the 3 years its cap was live, since a
            // lapsed cap falls through to baseline Proportional while an absent entry meant "draw
            // nothing voluntarily". Those are different statements and the schedule could only make
            // one of them. Default stays 'none' - the b2 behavior.
            if ((inputs.scheduleFallback ?? 'none') === 'baseline') {
                yr.withdrawStrategy.order = ['IRA', 'Brokerage', 'Cash'];
                yr.withdrawStrategy.taxrate = [sim.nominalTaxRate, yr.capGainsPercentage * (sim.capitalGainsRate + yr.nominalStateTaxAtLimit), 0, 0];
                yr.withdrawals = calculateWithdrawals(yr.curBalances, yr.additionalSpendNeeded, yr.withdrawStrategy);
            } else {
                yr.withdrawals = {};              // nothing scheduled: gap-fill handles spending
            }
        } else if (_e.iraDraw !== undefined) {
            // The quantity lever. Face-value voluntary draw, the same shape and the same convention
            // as the fixedpct and fixed branches below, so those families can be carried exactly.
            const IRAwd = Math.max(0, Math.min(yr.curIRA, _e.iraDraw));
            yr.withdrawals = { IRA: IRAwd, netAmount: IRAwd };
        } else {
            yr.limit = _e.ordTarget;
            yr.ceilingKind = _e.kind;
            // Rates are derived at rateBasis, which DEFAULTS to the target and is the same number
            // for an IRMAA or ACA ceiling. A federal-bracket ceiling is the odd one out: its rates
            // are read at the statutory bracket top while its limit is lifted by the P92a deduction
            // add-back, so deriving at the target picks the NEXT bracket up. Measured before it was
            // fixed: Fill Bracket 22% replayed at 24% and drifted $121 over 33 years, first visible
            // in year 8 at $0.34 and compounding.
            yr.rateBasis = _e.rateBasis;
            ({ marginalFedTaxRate: yr.marginalFedTaxRate, nominalFedTaxRateAtLimit: yr.nominalFedTaxRateAtLimit,
               marginalStateTaxRate: yr.marginalStateTaxRate, nominalStateTaxAtLimit: yr.nominalStateTaxAtLimit,
               stateLimit: yr.stateLimit } =
                ratesAtLimit(yr.rateBasis, yr.status, sim.cpiRate, STATEname, yr.fedRateCreep, yr.stateRateCreep));
            yr.bracketTarget = yr.limit;
            drawIRAToCeiling(yr);
        }

    } else if (inputs.strategy === 'bracket' || yr.isACAStrategy) {
        ({ limit: yr.limit, marginalFedTaxRate: yr.marginalFedTaxRate, marginalStateTaxRate: yr.marginalStateTaxRate, nominalFedTaxRateAtLimit: yr.nominalFedTaxRateAtLimit, nominalStateTaxAtLimit: yr.nominalStateTaxAtLimit, stateLimit: yr.stateLimit, kind: yr.ceilingKind, rateBasis: yr.rateBasis } =
            computeBracketCeiling(inputs, yr.status, sim.cpiRate, STATEname, yr.age1, yr.age2, yr.alive1, yr.alive2, yr.fedRateCreep, yr.stateRateCreep, sim.medicareRate, yr._ceilDedAddBack));

        yr.bracketTarget = yr.limit;
        drawIRAToCeiling(yr);

    } else if (inputs.strategy === 'fixedpct') {
        // Withdraw a fixed % of the original IRA balance (before RMDs) each year.
        // RMDs already taken count toward the target; any excess beyond RMDs is the
        // additional draw. Spending shortfall fills from Cash → Brokerage → Roth below.
        const pct = inputs.iraWithdrawPct ?? 0.05;
        const originalIRA = balance.IRA1 + balance.IRA2 + yr.totalIRAForcedWithdrawals;
        const targetTotal = originalIRA * pct;
        const IRAwd = Math.max(0, Math.min(yr.curIRA, targetTotal - yr.totalIRAForcedWithdrawals));
        yr.withdrawals = { IRA: IRAwd, netAmount: IRAwd };

    } else if (inputs.strategy === 'split') {
        // P104b1. The constant split: the oracle branch above with one vector for every year.
        // Same order, same rates, same call, so replay identity against the oracle input holds.
        const _sw = _splitWeightsFor(inputs);
        if (_sw) {
            yr.withdrawStrategy.order = _sw.order;
            yr.withdrawStrategy.weight = _sw.weight;
            yr.withdrawStrategy.taxrate = _oracleTaxratesFor(_sw.order, sim, yr);
        } else {
            // Malformed vector: the baseline draw, byte-for-byte, and the result is flagged.
            sim.splitWeightsInvalid = true;
            yr.withdrawStrategy.order = ['IRA', 'Brokerage', 'Cash'];
            yr.withdrawStrategy.taxrate = [sim.nominalTaxRate, yr.capGainsPercentage * (sim.capitalGainsRate + yr.nominalStateTaxAtLimit), 0, 0];
        }
        yr.withdrawals = calculateWithdrawals(yr.curBalances, yr.additionalSpendNeeded, yr.withdrawStrategy);

    } else if (inputs.strategy === 'propwd') {
        // Proportional +%: first withdraw proportionally for spending (same as baseline),
        // then add an IRA-only boost of propWithdraw × spendGoal strictly from IRA.
        // The after-tax surplus from the boost flows to Roth/Cash via step 7.
        yr.withdrawStrategy.order = ['IRA', 'Brokerage', 'Cash'];
        yr.withdrawStrategy.taxrate = [sim.nominalTaxRate, yr.capGainsPercentage * (sim.capitalGainsRate + yr.nominalStateTaxAtLimit), 0, 0];
        yr.withdrawals = calculateWithdrawals(yr.curBalances, yr.additionalSpendNeeded, yr.withdrawStrategy);
        const pct = inputs.propWithdraw ?? 0;
        if (pct > 0) {
            const remainingIRA = Math.max(0, yr.curBalances.IRA - (yr.withdrawals.IRA || 0));
            const boost = Math.min(sim.spendGoal * pct, remainingIRA);
            yr.withdrawals.IRA = (yr.withdrawals.IRA || 0) + boost;
        }

    } else if (inputs.strategy === 'ordered') {
        // Ordered strategy: all spending runs through the gap fill, because its whole meaning is the
        // sequence and the gap fill is where that sequence runs.
        yr.withdrawals = {};

    } else {
        /*********************/
        /* BASELINE Strategy */
        /*********************/
        // Withdraw enough proportionately to get to spendGoal - including taxes.
        //
        // GUYTON-KLINGER LANDS HERE. There is no 'gk' case above, so this is GK's draw, and it is
        // bit-identical to the propwd branch at propWithdraw 0 (same order, same rates, same call;
        // and neither family is in yr.isBracketStrategy, so they share the gap fill too). Verified
        // over 15 cells on every log field. Anything said about "GK's draw" is a statement about
        // this default, not about Guyton-Klinger - which is why P103d's result generalizes past GK.
        yr.withdrawStrategy.order = ['IRA', 'Brokerage', 'Cash']
        yr.withdrawStrategy.taxrate = [sim.nominalTaxRate, yr.capGainsPercentage * (sim.capitalGainsRate + yr.nominalStateTaxAtLimit), 0, 0]
        yr.withdrawals = calculateWithdrawals(yr.curBalances, yr.additionalSpendNeeded, yr.withdrawStrategy)

    }

    // P103b3. The VOLUNTARY IRA draw this year's branch just decided, captured here and nowhere
    // else, because here is the only point at which it is still the decision rather than an outcome.
    // Downstream it is merged with the forced withdrawal, split across IRA1/IRA2, netted against
    // conversions and adjusted by the shortfall cascade, and reconstructing it from those fields is
    // what a schedule compiler kept getting wrong - three different wrong answers before this field
    // existed. A carrier compiles from recorded DECISIONS, not from reconstructed outcomes.
    yr.volIRAwd = yr.withdrawals?.IRA ?? 0;
}

// The argument object every calculateTaxes() call in this file is built from: the year's filing
// status, ages, Social Security, rate creeps and state, plus the income the plan has drawn so far.
// `overrides` replaces whichever fields a caller prices differently - a shadow calculation drops
// the IRMAA charge and substitutes its own income, the guaranteed-income pass sets capGains to 0.
//
// The defaults read `yr.netWithdrawals` optionally because the two callers that run BEFORE the
// primary draw (the deduction probe in the ceiling search, and the guaranteed-income pass) have no
// withdrawals yet and override both income fields anyway.
function taxArgs(sim, yr, overrides) {
    return Object.assign({
        filingStatus: yr.status, ages: [yr.age1, yr.age2], birthyears: [sim.birthyear1, sim.birthyear2],
        totalSS: yr.s1 + yr.s2, IRMAAAnnualCost: yr.IRMAA,
        earnedIncome: yr.pension + yr.taxableRMD + (yr.netWithdrawals?.IRA ?? 0) + yr.taxableInterest,
        inflation: sim.cpiRate,
        pensionIncome: yr.pension, iraIncome: yr.taxableRMD + (yr.netWithdrawals?.IRA ?? 0),
        qualifiedDiv: yr.taxableDividends, capGains: yr.capitalGains, hsaContrib: 0,
        taxExemptInterest: 0, state: STATEname, fedRateCreep: yr.fedRateCreep,
        stateRateCreep: yr.stateRateCreep, obbaOn: yr.obbaOn, saltHigh: yr.saltHigh,
        propTax: yr.propTax, taxYear: yr.taxYear
    }, overrides);
}

// Re-price the year after a pass has drawn more money: the gains the Brokerage draws realized, the
// tax on the whole year's income, and the total the year owes. Called by the second pass, by both
// loops in the third pass and by the forced-IRA backstop.
//
// `rates` refreshes the marginal rates the NEXT gross-up prices against, and the sites that leave
// it off are the ones with no further draw to price. Both rates carry the NIIT surtax on top of the
// statutory rate, for the reason set out above the seed block in applyPrimaryAndTaxPass1.
function repriceYear(sim, yr, { rates = false } = {}) {
    yr.capitalGains = Math.max(0, (yr.netWithdrawals.Brokerage ?? 0) - (yr.netWithdrawals.BrokerageBasis ?? 0));
    yr.tax = calculateTaxes(taxArgs(sim, yr));
    yr.totalTax = yr.tax.totalTax + yr.IRMAA;
    if (rates) {
        yr.marginalFedTaxRate = yr.tax.federalMarginalRate + (yr.tax.niitMarginalOnOrdinary ?? 0);
        yr.marginalStateTaxRate = yr.tax.stateMarginalRate;
    }
}

// Apply the primary withdrawals, first tax pass, MAGI-history seeding and the year-0 IRMAA retro-correction.
function applyPrimaryAndTaxPass1(sim, yr) {
    const { balance } = sim;
    applyWithdrawals(yr.curBalances, yr.withdrawals)
    inspectForErrors(yr.curBalances, yr.withdrawals)

    yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, yr.withdrawals])
    yr.capitalGains = Math.max(0, (yr.netWithdrawals.Brokerage ?? 0) - (yr.netWithdrawals.BrokerageBasis ?? 0));

    // 5. Tax Calc (Including IRMAA lag)
    // NOTE: This first tax pass may undercount income if the IRA accounts are exhausted
    // and Cash/Brokerage/Roth must backfill (handled ~line 884). The second tax pass
    // (~line 922) recalculates with updated withdrawals. If that second pass introduces
    // a bracket crossing, a third pass would be needed for accuracy. Current two-pass
    // approach is an accepted approximation.

    inspectForErrors({ fixedInc: yr.fixedInc, totalRMD: yr.totalRMD, taxableInterest: yr.taxableInterest, capitalGains: yr.capitalGains, taxableDividends: yr.taxableDividends, age1: yr.age1, age2: yr.age2, cpiRate: sim.cpiRate })


    yr.tax = calculateTaxes(taxArgs(sim, yr))
    inspectForErrors(yr.tax)  // See if any numbers look fishy.

    // P117. Both seeds carry the 3.8% NIIT surtax on top of the statutory rate, because both are
    // used ONLY to price the cost of a dollar - which account is cheapest to draw, what a
    // brokerage sale nets, what terminal wealth is worth after tax. Every consumer of
    // `sim.capitalGainsRate` is such a site; the two functions that ask "which LTCG bracket am I
    // in" (getLTCGBracketRoom, getLTCGBracketTopRate) read TAXData directly and are unaffected.
    // The two surtax terms are NOT the same number: see the derivation above STEP 9 in
    // taxengine.js. An IRA dollar is ordinary and often escapes the surtax entirely; a brokerage
    // dollar is investment income and never does once MAGI is over the threshold. Adding one flat
    // rate to both would have made conversions look more expensive than they are.
    yr.marginalFedTaxRate = yr.tax.federalMarginalRate + (yr.tax.niitMarginalOnOrdinary ?? 0);
    yr.marginalStateTaxRate = yr.tax.stateMarginalRate;
    sim.capitalGainsRate = yr.tax.capitalGainsRate + (yr.tax.niitMarginalOnInvestment ?? 0);

    //!!! Assume MAGI for prior to years is the same as this year. Should allow this to be entered

    let magiHistoryLength = balance.magiHistory.length
    if (magiHistoryLength < 1) {
        balance.magiHistory.push(yr.tax.MAGI);
        balance.magiHistory.push(yr.tax.MAGI);
        // Year 0 read undefined MAGI at the lookback above (no history existed yet), forcing
        // IRMAA to $0/'-none-' regardless of actual income. Retroactively correct THIS year's
        // charge now that tax.MAGI is known - steady-state assumption per the comment above,
        // still "computed once at charge time" (doesn't reintroduce the prior tier-lag bug).
        yr.IRMAA = calcIRMAA(yr.tax.MAGI, yr.status, sim.cpiRate, sim.medicareRate, yr.onMedicare);
        yr.IRMAATier = yr.onMedicare > 0 ? getIRMAATier(yr.tax.MAGI, yr.status, sim.cpiRate) : '-none-';
        yr.tax.IRMAAAnnualCost = yr.IRMAA;
        yr.tax.IRMAARate = yr.tax.MAGI > 0 ? yr.IRMAA / yr.tax.MAGI : 0;
        yr.tax.nominalRate = yr.tax.federalNominalRate + yr.tax.stateNominalRate + yr.tax.IRMAARate;
    }

    yr.totalTax = yr.tax.totalTax + yr.IRMAA;
}

// Cash-flow gap fill (strategy-dependent supplemental withdrawals) and second tax pass.
function fillSpendingGap(sim, yr) {
    const { inputs } = sim;
    // 6. Cash Flow Gap
    // taxableInc includes pension, RMDs
    yr.possibleIncome = yr.taxableInc + yr.fixedInc + yr.netWithdrawals.IRA +
        yr.capitalGains + (yr.netWithdrawals.BrokerageBasis ?? 0);

    // `possibleIncome` is INCOME - what the tax passes are computed on - and a Cash or Roth
    // withdrawal is not income. But this gap is about what the household can SPEND, and a dollar
    // drawn from Cash or Roth in `planPrimaryWithdrawals` is exactly as spendable as one drawn from
    // the IRA. Leave those two draws out here and a year the primary pass funded from Cash or Roth is
    // funded AGAIN by this pass: the remaining Cash drains, the rest spills into the IRA, and the
    // year-end surplus routine refunds the over-draw - or, with Max Conversion on, CONVERTS it, so a
    // Proportional +0% plan with no boost converts money it should not.
    //
    // `resolveResidualAndForcedIRA`'s `incomeAfterGapFill` counts all four accounts, and this line
    // agrees with it.
    let netSpendable = yr.possibleIncome - yr.totalTax
        + (yr.netWithdrawals.Cash ?? 0) + (yr.netWithdrawals.Roth ?? 0);
    let gap = yr.targetSpend - netSpendable;

    inspectForErrors({ netSpendable: netSpendable, gap: gap, totalTax: yr.totalTax });

    // `rothGapFill` moves Roth out of last place in the gap fill:
    //
    //     (unset)             Cash, then Brokerage, then Roth as a last resort
    //     'fillCashThenRoth'  Cash, then ROTH, then Brokerage
    //     'fillRothThenCash'  ROTH first, ahead of everything
    //
    // `ordered` is excluded: its entire meaning is the account sequence the user picked. Named for
    // where Roth is inserted rather than given a four-letter order code, because the non-bracket
    // branch below draws Brokerage and Cash PROPORTIONALLY and there is no full sequence to name.
    //
    // Roth pays off only when it displaces a TAXABLE draw. Displacing Cash is a loss: both are
    // tax-free to withdraw, but Roth compounds tax-free at the growth rate while Cash earns
    // cashYield and pays tax on the interest, so spending Roth to preserve Cash keeps the worse
    // asset. Neither position is safe to recommend, which is why this ships as a swept dimension
    // and not a default (research/CONSTANT_SPLIT.md).
    //
    // VALIDATED AGAINST THE KNOWN VALUES, not for truthiness: with `|| null` a typo such as
    // 'fillCashThenRother' fell through to the Roth-first branch and silently modeled the other
    // mode. Anything unrecognized means "leave today's behavior alone".
    const _rothPos = (inputs.rothGapFill === ROTH_GAP_FILL.CASH_FIRST || inputs.rothGapFill === ROTH_GAP_FILL.ROTH_FIRST)
        ? inputs.rothGapFill : null;
    const _preDraw = (acct, amt) => {
        if (amt <= 1 || !(yr.curBalances[acct] > 0)) return amt;
        const wd = calculateWithdrawals(yr.curBalances, amt, { order: [acct], weight: [1], taxrate: [0] });
        yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, wd]);
        applyWithdrawals(yr.curBalances, wd);
        return wd.shortfall ?? 0;
    };
    if (gap > 1.00 && _rothPos && !yr.isOrderedStrategy) {
        if (_rothPos === ROTH_GAP_FILL.CASH_FIRST) gap = _preDraw('Cash', gap);
        gap = _preDraw('Roth', gap);
    }

    // P51b mirror: the oracle's year weights govern the SECOND pass too, so the plan's split is
    // in force for the whole spending need, not just the primary draw. Phase-2 spill inside
    // calculateWithdrawals (IRA -> Brokerage -> Cash -> Roth) is the shortfall cascade.
    // P104b1: the split's one vector binds here too, in every year it governed the primary draw -
    // so not on a cyclic harvest year, where the default branch applies as it does for propwd. A
    // malformed vector took the baseline draw above and takes the baseline gap branch here.
    const _oracleWGap = _oracleWithdrawalPlanFor(inputs, yr.y)
        ?? (inputs.strategy === 'split' && !yr.isBrokerageYear ? _splitWeightsFor(inputs) : null);
    if (gap > 1.00) {
        if (_oracleWGap) {
            const wd = calculateWithdrawals(yr.curBalances, gap, {
                order: _oracleWGap.order,
                weight: _oracleWGap.weight,
                taxrate: _oracleTaxratesFor(_oracleWGap.order, sim, yr),
            });
            yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, wd]);
            applyWithdrawals(yr.curBalances, wd);
        } else if (yr.isBracketStrategy) {
            // Bracket and IRMAA strategies supplement spending from Cash first, then Brokerage, then
            // Roth, which keeps supplemental draws out of taxable income as far as possible.
            //
            // `inputs.bracketGapOrder` (research only, no UI, no URL param) swaps the first two. The
            // two accounts are not symmetric, which is why the order is a question rather than a
            // preference: Cash is tax-free to withdraw but earns `cashYield` taxed as ordinary
            // income, while Brokerage realizes capital gains on the way out and steps up its basis.
            //
            // Written as a SEQUENCE rather than nested ifs so the arm is the order of a list. It is
            // bit-identical to the ifs it replaces: each account draws only the shortfall the one
            // before it left, the chain stops at $1, and Roth is reached only when both leave
            // something over.
            const _bgo = inputs.bracketGapOrder === 'brokerageFirst' ? 'brokerageFirst' : 'cashFirst';
            const _brokRate = yr.capGainsPercentage * (sim.capitalGainsRate + yr.nominalStateTaxAtLimit);
            const _bSeq = _bgo === 'brokerageFirst'
                ? [['Brokerage', _brokRate], ['Cash', 0]]
                : [['Cash', 0], ['Brokerage', _brokRate]];
            let _bNeed = gap;
            for (const [_acct, _rate] of _bSeq) {
                const wd = calculateWithdrawals(yr.curBalances, _bNeed,
                    { order: [_acct], weight: [1], taxrate: [_rate] });
                yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, wd]);
                applyWithdrawals(yr.curBalances, wd);
                _bNeed = wd.shortfall ?? 0;
                if (_bNeed <= 1) break;
            }

            if (_bNeed > 1 && yr.curBalances.Roth > 0) {
                const rothWithdrawals = calculateWithdrawals(yr.curBalances, _bNeed, { order: ['Roth'], weight: [1], taxrate: [0] });
                yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, rothWithdrawals]);
                applyWithdrawals(yr.curBalances, rothWithdrawals);
            }
        } else if (yr.isOrderedStrategy) {
            const seq = resolveOrderedSeq(inputs.orderedSeq, { capGainsPercentage: yr.capGainsPercentage, capitalGainsRate: sim.capitalGainsRate, nominalStateTaxAtLimit: yr.nominalStateTaxAtLimit, nominalTaxRate: sim.nominalTaxRate, marginalFedTaxRate: yr.marginalFedTaxRate, marginalStateTaxRate: yr.marginalStateTaxRate });
            yr.netWithdrawals = runOrderedWithdrawal(yr.curBalances, gap, seq, yr.netWithdrawals, applyWithdrawals);

        } else {
            // Default: Brokerage and Cash proportional, then Roth as a fallback.
            //
            // `inputs.gapFillWeights` (research only, no UI, no URL param) replaces the [40, 60].
            // The weights are RELATIVE, normalized by `calculateWithdrawals`, so [1, 1] and [50, 50]
            // are the same split; percentages are used only because that is how the original read.
            //
            // Validated to a known SHAPE rather than tested for truthiness, for the reason the
            // `rothGapFill` comment above records: a malformed value must mean "leave today's
            // behavior alone", never "model something else silently". Two finite non-negative numbers
            // with a positive sum - the sum is the one that matters, because [0, 0] would divide by
            // zero in the normalizer and put NaN through every downstream balance.
            //
            // The ENDPOINTS are legal and meaningful: [0, 100] is all-Cash and [100, 0] all-Brokerage,
            // and both still spill to the other account through the shortfall cascade rather than
            // stopping short. That is what makes a 0-to-100 sweep a sweep of one policy.
            const _gfw = inputs.gapFillWeights;
            const _gfwOK = Array.isArray(_gfw) && _gfw.length === 2
                && _gfw.every(w => Number.isFinite(w) && w >= 0) && (_gfw[0] + _gfw[1]) > 0;
            yr.withdrawStrategy.order = ['Brokerage', 'Cash'];
            yr.withdrawStrategy.weight = _gfwOK ? [_gfw[0], _gfw[1]] : [...GAP_FILL_DEFAULT_WEIGHTS];
            yr.withdrawStrategy.taxrate = [yr.capGainsPercentage * (sim.capitalGainsRate + yr.nominalStateTaxAtLimit), 0];
            yr.withdrawals = calculateWithdrawals(yr.curBalances, gap, yr.withdrawStrategy);
            yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, yr.withdrawals]);
            applyWithdrawals(yr.curBalances, yr.withdrawals);

            if ((yr.withdrawals.shortfall ?? 0) > 1 && yr.curBalances.Roth > 0) {
                const rothWd = { order: ['Roth'], taxrate: [0], weight: null };
                const rothWithdrawals = calculateWithdrawals(yr.curBalances, yr.withdrawals.shortfall, rothWd);
                yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, rothWithdrawals]);
                applyWithdrawals(yr.curBalances, rothWithdrawals);
            }
        }
    }

    // Recheck tax calculations due to possible additional withdrawals - and we now have a more
    // accurate income picture. The rates are refreshed here so the third pass grosses up at the
    // bracket the year actually landed in.
    repriceYear(sim, yr, { rates: true });
    inspectForErrors(yr.tax)  // See if any numbers look fishy.
    yr.acaMAGI = ceilingMAGI(yr);   // P87d
    yr.bracketOverage = yr.bracketTarget > 0 ? Math.max(0, yr.acaMAGI - yr.bracketTarget) : 0;
}

// Third tax pass for residual shortfall, soft-cap forced-IRA convergence, and the year's income/overage finalization.
function resolveResidualAndForcedIRA(sim, yr) {
    const { inputs, totals } = sim;
    // Two inputs that make the Brokerage exclusions in this function falsifiable rather than
    // asserted. They were measured together and came out opposite ways, so they ship differently.
    //
    //   thirdPassBrokerage       'bounded' (DEFAULT) | 'off' | 'unbounded' - allow a Brokerage leg
    //                            in the third pass, drawn AFTER Cash and BEFORE the Roth fallback,
    //                            then re-drawn against whatever residual the realized gains re-open.
    //                            'bounded' caps the re-draw at the same 6 iterations the forced-IRA
    //                            backstop below uses; 'unbounded' raises the cap to 200 and records
    //                            the iterations consumed, so a real cap-gains spiral shows up as a
    //                            run that keeps needing passes instead of one that converges. 'off'
    //                            restores the pre-default behavior so the measurement stays
    //                            reproducible. Ordered is excluded either way - it runs the user's
    //                            own sequence in this pass.
    //   forcedIRAAllowBrokerage  'off' (DEFAULT) | 'brokerageFirst' - let the funding backstop spend
    //                            Brokerage before it forces IRA above the ceiling. The theory was
    //                            sound (forced IRA is ordinary income at the marginal rate; a
    //                            Brokerage dollar may be LTCG at 0%) and measurement refuted it: it
    //                            wins the same cells the third-pass arm wins while leaving orders of
    //                            magnitude more spending unfunded, because it spends Brokerage early
    //                            and has none left later. A research flag only; do not wire it to
    //                            any UI.
    const _tpBrokArm = inputs.thirdPassBrokerage ?? 'bounded';   // P32h: was 'off' until v11.15e3
    const _fibArm = inputs.forcedIRAAllowBrokerage ?? 'off';
    const _brokTaxRate = yr.capGainsPercentage * (sim.capitalGainsRate + (yr.nominalStateTaxAtLimit ?? 0));
    // Third pass: if second-pass taxes created a residual shortfall, withdraw more and recalc once.
    // This handles cases where the gap fill (brokerage cap gains) raised taxes above the initial estimate.
    // Compute gross income inline (totalIncome is still 0 here; it's assigned below at line 813).
    const incomeAfterGapFill = yr.fixedInc + yr.netWithdrawals.IRA + yr.pension +
        yr.netWithdrawals.Roth + yr.netWithdrawals.Cash + yr.netWithdrawals.Brokerage + yr.taxableRMD;
    const residualGap = yr.targetSpend - (incomeAfterGapFill - yr.totalTax);
    if (residualGap > 1) {
        const thirdPassStart = performance.now();
        if (yr.isOrderedStrategy) {
            const seq = resolveOrderedSeq(inputs.orderedSeq, { capGainsPercentage: yr.capGainsPercentage, capitalGainsRate: sim.capitalGainsRate, nominalStateTaxAtLimit: yr.nominalStateTaxAtLimit, nominalTaxRate: sim.nominalTaxRate, marginalFedTaxRate: yr.marginalFedTaxRate, marginalStateTaxRate: yr.marginalStateTaxRate });
            yr.netWithdrawals = runOrderedWithdrawal(yr.curBalances, residualGap, seq, yr.netWithdrawals, applyWithdrawals);
        } else {
            // This pass draws Cash, then Brokerage, then Roth. Brokerage is allowed here even though
            // it realizes gains: the feedback is convergent, because SS inclusion stops at 85% and
            // LTCG tops out at 20%, so each pass recovers a shrinking fraction and no year has ever
            // wanted a seventh. Barring it strands spending the plan promised, in IRMAA Ceiling
            // plans above all, where Brokerage is the only money left.
            //
            // `rothGapFill` does NOT reach this pass, in either position. It is already Cash then
            // Roth, which is the 'fillCashThenRoth' order; and 'fillRothThenCash' drains Roth in the
            // SECOND pass, so a year that gets this far has either no Roth left or no residual to
            // fund with it. A Roth-first branch here was measured as unreachable-with-effect and
            // removed in 11.18e4.
            const thirdWd = calculateWithdrawals(yr.curBalances, residualGap,
                { order: ['Cash'], weight: [1], taxrate: [0] });
            yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, thirdWd]);
            applyWithdrawals(yr.curBalances, thirdWd);
            let _remShort = thirdWd.shortfall ?? 0;
            // Brokerage after Cash, ahead of the Roth fallback. Same gross-up convention as the
            // second-pass gap fill in `fillSpendingGap`, so both passes price a Brokerage dollar alike.
            if (_remShort > 1 && _tpBrokArm !== 'off' && (yr.curBalances.Brokerage ?? 0) > 0) {
                const brokWd3 = calculateWithdrawals(yr.curBalances, _remShort,
                    { order: ['Brokerage'], weight: [1], taxrate: [_brokTaxRate] });
                yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, brokWd3]);
                applyWithdrawals(yr.curBalances, brokWd3);
                _remShort = brokWd3.shortfall ?? 0;
            }
            // Roth fallback if Cash ran out (still no cap gains)
            if (_remShort > 1 && yr.curBalances.Roth > 0) {
                const rothWd3 = calculateWithdrawals(yr.curBalances, _remShort,
                    { order: ['Roth'], weight: [1], taxrate: [0] });
                yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, rothWd3]);
                applyWithdrawals(yr.curBalances, rothWd3);
                _remShort = rothWd3.shortfall ?? 0;
            }
            // Strict ACA: Cash+Roth couldn't cover and the FPL cap forbids drawing more IRA
            // (breaching it forfeits the subsidy) → leave the shortfall and flag it untenable.
            // Soft caps fund the residual from IRA in the convergence loop below.
            if (_remShort > 1 && yr.isACAStrategy) yr.acaBreach = true;
        }
        repriceYear(sim, yr);
        // P32c arm: the spiral test itself. The recalc above just priced the Brokerage leg's
        // realized gains; if that re-opened the residual, draw Brokerage again and reprice, and
        // count the passes. A converging year uses one or two; a genuine spiral hits the cap.
        // Counters are attached lazily so an 'off' run's totals object keeps today's exact shape.
        if (_tpBrokArm !== 'off' && !yr.isOrderedStrategy) {
            const _cap = THIRD_PASS_BROKERAGE_ITER_CAP[_tpBrokArm === 'unbounded' ? 'unbounded' : 'bounded'];
            // Exit reasons are counted separately because Q2 asks a question only one of them
            // answers. A year that stops improving while Brokerage still holds a balance has hit
            // the account's own arithmetic (dust, or a draw whose tax eats the draw), NOT the
            // cap-gains spiral; without this guard those years silently consumed the whole cap and
            // would have read as divergence. Only `Capped` years are spiral candidates.
            let _it = 0, _stalled = false, _prevRes = Infinity;
            for (; _it < _cap; _it++) {
                const _inc = yr.fixedInc + yr.netWithdrawals.IRA + yr.pension +
                    yr.netWithdrawals.Roth + yr.netWithdrawals.Cash + yr.netWithdrawals.Brokerage + yr.taxableRMD;
                const _res = yr.targetSpend - (_inc - yr.totalTax);
                if (_res <= 1 || (yr.curBalances.Brokerage ?? 0) <= 0) break;
                if (_prevRes - _res < 1) { _stalled = true; break; }
                _prevRes = _res;
                const _bw = calculateWithdrawals(yr.curBalances, _res,
                    { order: ['Brokerage'], weight: [1], taxrate: [_brokTaxRate] });
                yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, _bw]);
                applyWithdrawals(yr.curBalances, _bw);
                repriceYear(sim, yr, { rates: true });
            }
            if (_it > 0) totals.thirdPassBrokerIters = (totals.thirdPassBrokerIters ?? 0) + _it;
            if (_stalled) totals.thirdPassBrokerStalled = (totals.thirdPassBrokerStalled ?? 0) + 1;
            else if (_it >= _cap) totals.thirdPassBrokerCapped = (totals.thirdPassBrokerCapped ?? 0) + 1;
        }
        totals.thirdPassCount += 1;
        totals.thirdPassTime += performance.now() - thirdPassStart;
    }

    // Funding backstop: when Cash/Brokerage/Roth are exhausted but the IRA still has funds, draw
    // extra IRA to fund MANDATORY spending. Bounded convergence: forcing IRA raises taxes (SS
    // phase-in, IRMAA), which can re-open a small residual - a few iterations fully fund spending
    // while the IRA lasts. For the soft-cap strategies (Fill Federal Bracket / IRMAA Tier / IRA
    // Draw %) this draw is ABOVE their ceiling, which is what makes those caps soft.
    //
    // The gate names only the two strategies that must stay out, and deliberately does not name the
    // ones it serves: a gate written the other way silently excludes every strategy added later.
    // `fixed`, `propwd` and the baseline all need it, because they size their draw against
    // `yr.possibleIncome`, which is GROSS - as if Social Security, pensions and RMDs arrived tax
    // free. The tax on that guaranteed income is otherwise never funded, and neither the gap fill
    // nor the third pass has a route back to the IRA, so the shortfall simply strands.
    //
    // Still excluded, and for reasons that are about the strategy rather than about plumbing:
    //   - Strict ACA, while the cap is LIVE. An IRA dollar is taxable income and crossing the FPL
    //     cap forfeits the entire premium subsidy - a cliff, not a tax bump. A shortfall there is
    //     the correct answer and means the goal could not be met from non-taxable sources. Once
    //     the cap lapses at Medicare (yr.acaLapsed) there is nothing left to protect, the year
    //     falls through to the baseline branch, and it is backstopped like any other.
    //   - Ordered, which has its own user-chosen sequence and runs it in the third pass above.
    if (!yr.isACAStrategy && !yr.isOrderedStrategy) {
        // Iteration cap raised 4 -> 6 when OBBBA was switched on. Lowering the tax bill changes the
        // convergence path, and `fixedpct` 2% started finishing 2027 with $21 still unfunded while
        // the IRA held $2.16M - the 4th iteration was simply one short. 6 clears it; 8 is identical,
        // so it has converged rather than merely been papered over. Costs nothing in the common
        // case: the loop breaks the moment the residual drops under $1, so the extra iterations only
        // run in the years that actually need them.
        for (let _i = 0; _i < 6; _i++) {
            const _inc = yr.fixedInc + yr.netWithdrawals.IRA + yr.pension +
                yr.netWithdrawals.Roth + yr.netWithdrawals.Cash + yr.netWithdrawals.Brokerage + yr.taxableRMD;
            const _res = yr.targetSpend - (_inc - yr.totalTax);
            // P32c arm: with 'brokerageFirst' the backstop spends Brokerage while it lasts, so the
            // loop must also survive an empty IRA - today's break would end it one account early.
            const _useBrok = _fibArm === 'brokerageFirst' && (yr.curBalances.Brokerage ?? 0) > 0;
            if (_res <= 1 || (!_useBrok && (yr.curBalances.IRA ?? 0) <= 0)) break;
            const iraTop = _useBrok
                ? calculateWithdrawals(yr.curBalances, _res,
                    { order: ['Brokerage'], weight: [1], taxrate: [_brokTaxRate] })
                : calculateWithdrawals(yr.curBalances, _res,
                    { order: ['IRA'], weight: [1], taxrate: [yr.marginalFedTaxRate + yr.marginalStateTaxRate] });
            yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, iraTop]);
            applyWithdrawals(yr.curBalances, iraTop);
            yr.forcedIRA += (iraTop.IRA ?? 0);
            repriceYear(sim, yr, { rates: true });
        }
    }

    // Cash Reserve floor (P2), last resort: restore the buffer hidden in resolveSpendTarget and,
    // only if spending is STILL unfunded after Cash/Brokerage/Roth/forced-IRA, break into it. A
    // Cash draw is tax-free, so no tax recompute is needed; it must land before totalIncome below.
    if (yr._reserveHidden > 0) {
        yr.curBalances.Cash += yr._reserveHidden;
        const _incNow = yr.fixedInc + yr.netWithdrawals.IRA + yr.pension +
            yr.netWithdrawals.Roth + yr.netWithdrawals.Cash + yr.netWithdrawals.Brokerage + yr.taxableRMD;
        const _lastResort = yr.targetSpend - (_incNow - yr.totalTax);
        if (_lastResort > 1 && yr.curBalances.Cash > 0) {
            const _rWd = calculateWithdrawals(yr.curBalances, _lastResort, { order: ['Cash'], weight: [1], taxrate: [0] });
            yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, _rWd]);
            applyWithdrawals(yr.curBalances, _rWd);
            yr.cashBreach = true;
        }
    }

    // Recompute overage after any 3rd-pass forced IRA draw (soft caps may now exceed the
    // ceiling). For the strict ACA strategy, a MAGI above the FPL cap - whether from a
    // forced draw (blocked) or unavoidable income (RMDs/SS) - flags the plan untenable.
    yr.acaMAGI = ceilingMAGI(yr);   // P87d
    yr.bracketOverage = yr.bracketTarget > 0 ? Math.max(0, yr.acaMAGI - yr.bracketTarget) : 0;
    if (yr.isACAStrategy && yr.bracketOverage > 1) yr.acaBreach = true;
    if (yr.acaBreach) totals.acaBreachYears += 1;
    totals.forcedIRATotal += yr.forcedIRA;


    // TWO income figures, and the difference between them is load-bearing.
    //
    // totalIncome is what a tax return would show: dividends and interest are income and belong
    // here. It is the reported figure and the tax basis.
    //
    // spendableIncome is what can FUND spending this year, and it deliberately excludes dividends
    // and interest. Those were already credited to a balance in growAndSettle - interest via the
    // Cash growth rate (computeYearGrowthRates), dividends to Cash or, under DRIP, to Brokerage.
    // Counting them here as well would spend the same dollar twice: once as income that shrinks the
    // withdrawal the plan needs, and once as a balance that is never debited. That is exactly the
    // defect this split fixes. The money is still fully available - it is sitting in Cash (or
    // Brokerage), and the withdrawal strategy draws it like any other balance, which is what makes
    // the STRATEGY decide whether a dividend is spent or banked, and what pays the tax on it.
    yr.totalIncome = Math.max(1, yr.fixedInc + yr.netWithdrawals.IRA + yr.pension +
        yr.taxableDividends + yr.taxableInterest + yr.netWithdrawals.Roth + yr.netWithdrawals.Cash +
        yr.netWithdrawals.Brokerage + yr.taxableRMD);
    yr.spendableIncome = Math.max(1, yr.fixedInc + yr.netWithdrawals.IRA + yr.pension +
        yr.netWithdrawals.Roth + yr.netWithdrawals.Cash +
        yr.netWithdrawals.Brokerage + yr.taxableRMD);

    inspectForErrors({ totalIncome: yr.totalIncome });

    sim.nominalTaxRate = yr.tax.nominalRate;
}

// True once the user's public Conversion End Year (calendar) has passed for year-index y.
// convEndYear is the LAST year conversions still run, so suppression begins the year AFTER it.
// Unset (every existing caller) -> false, zero behavior change.
function _convEndReached(inputs, y) {
    if (inputs.convEndYear == null) return false;
    // `y` is the PLAN year. A resumed run (P128) starts `resume.planYear` years into the plan, so the
    // plan's own first calendar year is that many years before the run's.
    const startYr = (inputs.startInYear || new Date().getFullYear()) - (inputs.resume?.planYear ?? 0);
    return (startYr + y) > inputs.convEndYear;
}

// Route the year's surplus: refund unneeded Roth draws, convert IRA-sourced surplus to
// True if the SURPLUS conversion path (convertExcessToRoth) should be suppressed for year y --
// the existing all-years counterfactual flag, the from-year-onward cutoff used by
// diagnoseConvBreakEvenFailure / bestConversionStopYear to test truncated schedules, the
// before-year cutoff that is its mirror (P85), or the user's public Conversion End Year when the
// End Year stops ALL conversions (convEndMode !== 'extra'). Purely additive: with all four unset
// (every existing caller), this is exactly !!inputs._cfSuppressConversions, zero behavior change.
//
// _cfSuppressConversionsBeforeYear is research-only and has no UI, no URL key and no getInputs()
// entry, exactly like _cfSuppressConversionsFromYear beside it. It exists because the engine could
// express "stop converting in year k" but not "start converting in year k", so a delayed-conversion
// arm was inexpressible for the bracket and ACA families -- their conversions come out of the
// surplus branch, not out of extraConversionAmount, whose per-year array form can already carry any
// shape. P85 needs both ends to ask whether WHEN a conversion happens matters.
function _convSuppressedThisYear(inputs, y) {
    return !!inputs._cfSuppressConversions
        || (inputs._cfSuppressConversionsFromYear != null && y >= inputs._cfSuppressConversionsFromYear)
        || (inputs._cfSuppressConversionsBeforeYear != null && y < inputs._cfSuppressConversionsBeforeYear)
        || (inputs.convEndMode !== 'extra' && _convEndReached(inputs, y));
}

// True if the EXTRA conversion path (extraConversionAmount) should be suppressed for year y.
// Superset of _convSuppressedThisYear: the End Year always stops the extra conversion, in BOTH
// 'all' mode (via _convSuppressedThisYear) and 'extra' mode (extra stops, surplus keeps firing).
function _extraConvSuppressedThisYear(inputs, y) {
    return _convSuppressedThisYear(inputs, y) || _convEndReached(inputs, y);
}

// The extra conversion actually SCHEDULED for year y: array element or scalar, zeroed by any
// active suppression. Single source for both the withdrawal-timing trigger (Early/Late) and the
// conversion itself, so a per-year array and the equivalent scalar + convEndYear can no longer
// disagree. Pure (inputs + y), safe to call from the early per-year setup phase.
function _extraConvAmountFor(inputs, y) {
    if (_extraConvSuppressedThisYear(inputs, y)) return 0;
    return Array.isArray(inputs.extraConversionAmount)
        ? (inputs.extraConversionAmount[y] ?? 0)
        : (inputs.extraConversionAmount ?? 0);
}

// Roth (convertExcessToRoth), replace excess Cash draws, apply withdrawals to balances, and
// reinvest whatever remains (Brokerage under Cyclic, otherwise Cash).
function routeSurplusAndConvert(sim, yr) {
    const { inputs, balance } = sim;
    // 7. Updates

    // SPENDABLE, not total. Surplus is money left over to bank, and banking a dividend that
    // growAndSettle already credited to Cash would deposit it a second time. yr.totalIncome stays
    // the reported/tax figure; see the note where both are set.
    yr.netIncome = yr.spendableIncome - yr.totalTax;
    // What the household actually CONSUMES this year. The premium is money out on top of the spend
    // goal when `medicarePremiumMode` is 'added', and this is the line that makes it leave: surplus
    // is measured here, so a dollar not subtracted here is a dollar banked. Zero in the default
    // mode, where the premium is assumed to already sit inside the spend goal.
    const _consumed = sim.spendGoal + (yr.medicareOutflow ?? 0);
    yr.surplus = {
        Total: Math.max(0, yr.netIncome - _consumed), Roth: 0, Cash: 0, Brokerage: 0,
        Shortfall: Math.min(0, yr.netIncome - _consumed)
    };

    //!!! Remove withdrawals proportionately. RMDs have already been withdrawn.
    yr.ira1_ratio = (balance.IRA1 / (balance.IRA1 + balance.IRA2 || 1))
    yr.netWithdrawals.IRA1 = Math.max(0, yr.netWithdrawals.IRA * yr.ira1_ratio);
    yr.netWithdrawals.IRA2 = Math.max(0, yr.netWithdrawals.IRA * (1 - yr.ira1_ratio));


    // If we took money from Roth unnecessarily, refund it back.
    let rothRefund = Math.min(yr.surplus.Total, yr.netWithdrawals.Roth);
    yr.netWithdrawals.Roth -= rothRefund;
    yr.surplus.Total -= rothRefund;

    // convertExcessToRoth: route the IRA-sourced surplus to Roth instead of Cash.
    // Roth1 receives conversions funded by IRA1 withdrawals; Roth2 by IRA2 withdrawals.
    // Each conversion is capped by the respective IRA withdrawal so we never convert
    // more from an account than was actually withdrawn from it.
    // NOTE: this is a pure REALLOCATION - the IRA dollars are already being withdrawn (for
    // spending, per the strategy), their tax is already fully in yr.totalTax regardless of
    // destination, and conv1/conv2 just chooses Roth-vs-Cash for the leftover. Nothing is
    // netted out for tax here (yr.surplus is already after-tax). The separate opt-in mechanism
    // that pulls ADDITIONAL IRA and funds its tax from Cash is applyConversionGrossUp(), called
    // right after this function in the phase sequence (gated on fundConversionWithCash).
    yr.surplus.Roth1 = 0;
    yr.surplus.Roth2 = 0;

    if (inputs.convertExcessToRoth && !_convSuppressedThisYear(inputs, yr.y)) {
        // P103b3. A schedule may cap how much of the surplus is reallocated to Roth. Whatever the
        // cap leaves behind stays in yr.surplus.Total and banks as Cash or Brokerage below, which is
        // the whole content of the lever: the IRA dollars are already withdrawn and already taxed.
        let _pool = yr.surplus.Total;
        if (inputs.strategy === 'schedule') {
            const _sc = _schedulePlanFor(inputs, yr.y);
            if (_sc && _sc.convert !== undefined) _pool = Math.min(_pool, _sc.convert);
        }
        const conv1 = Math.min(_pool * yr.ira1_ratio,       yr.netWithdrawals.IRA1 || 0);
        const conv2 = Math.min(_pool * (1 - yr.ira1_ratio), yr.netWithdrawals.IRA2 || 0);
        yr.surplus.Roth1 = conv1;
        yr.surplus.Roth2 = conv2;
        yr.surplus.Total -= (conv1 + conv2);
    } else if (inputs.convertExcessToRoth && _convSuppressedThisYear(inputs, yr.y)) {
        // Counterfactual: the surplus that would have converted stays in the IRA instead.
        cfRefundIRA(sim, yr, yr.surplus.Total);
    }

    // Per-account conversion accounting (accurate Annual Details / tax-planner handoff).
    // conv1/conv2 (the convertExcessToRoth reallocation) are the ONLY conversion in surplus.Roth1/2
    // at this point; applyConversionGrossUp and applyExtraConversion add their prefer-larger splits
    // to yr.iraConvGross1/2 later. iraVolSpend_n = the part of each IRA's voluntary draw that funded
    // spending (i.e. was NOT reallocated to Roth).
    yr.iraConvGross1 = yr.surplus.Roth1;
    yr.iraConvGross2 = yr.surplus.Roth2;
    yr.iraVolSpend1 = Math.max(0, (yr.netWithdrawals.IRA1 || 0) - yr.iraConvGross1);
    yr.iraVolSpend2 = Math.max(0, (yr.netWithdrawals.IRA2 || 0) - yr.iraConvGross2);

    // Do not re-route spending through the Roth to make every voluntary IRA dollar read as a
    // conversion. The round trip is arithmetic, not a shortcut - draw gross X, pay tax T, fund
    // spending S, and Roth gains X - T - S either way - so it can only re-label. A view that wants
    // the two legs told apart has `-iraSpend` and `-iraConvGrossTot` in every log row.

    // If there is still a surplus, replace any excess Cash withdrawal.
    yr.surplus.Cash = Math.min(yr.surplus.Total, yr.netWithdrawals.Cash);
    yr.netWithdrawals.Cash -= yr.surplus.Cash;
    yr.surplus.Total -= yr.surplus.Cash;

    // Split the Roth withdrawal proportionally between Roth1 and Roth2 before applying.
    const rothWdTotal = balance.Roth1 + balance.Roth2;
    const roth1Share = rothWdTotal > 0 ? balance.Roth1 / rothWdTotal : 0.5;
    yr.netWithdrawals.Roth1 = (yr.netWithdrawals.Roth || 0) * roth1Share;
    yr.netWithdrawals.Roth2 = (yr.netWithdrawals.Roth || 0) * (1 - roth1Share);
    delete yr.netWithdrawals.Roth;

    // Decrement the proposed withdrawals from the balance(s).
    applyWithdrawals(balance, yr.netWithdrawals)

    // Unchanged by every P28 flag, on purpose. This feeds attributeIncrementalTaxes, _netOutflows
    // and the `rothConv` log field, and `rothConv` is read back by the NEXT year to pick withdrawal
    // timing -- so it is engine state, not a display value. See the note in the flag block above.
    yr.totalConverted = yr.surplus.Roth1 + yr.surplus.Roth2;

    // Counterfactual: the surplus that would have been banked to Cash/Brokerage stays in
    // the IRA instead (RMD-driven surplus cannot be refunded and still flows out below).
    if (inputs._cfSuppressExcess && yr.surplus.Total > 1) cfRefundIRA(sim, yr, yr.surplus.Total);

    // If there is STILL a surplus, decide where it lands. Three regimes:
    //   Cyclic            -> all to Brokerage (unchanged; Cyclic subsumes the Cash Reserve routing).
    //   Cash Reserve OFF  -> all to Cash (inputs.CashReserve == null: today's legacy behavior).
    //   Cash Reserve set  -> top Cash up to the target buffer (cashReserve is TODAY'S dollars, so it
    //                        inflates by sim.inflation to this year's terms), reinvest the OVERFLOW
    //                        into Brokerage. cashReserve === 0 keeps no buffer -> reinvest everything.
    // Brokerage reinvestment steps up basis (after-tax dollars re-entering the LTCG regime), the
    // same convention as the Cyclic path.
    yr._reinvestedSurplus = yr.surplus.Total;
    let _toCash = yr.surplus.Total, _toBrokerage = 0;
    if (inputs.cyclicEnabled) {
        _toBrokerage = yr.surplus.Total; _toCash = 0;
    } else if (inputs.CashReserve != null) {
        const _reserveNominal = inputs.CashReserve * sim.inflation;
        _toCash = Math.max(0, Math.min(yr.surplus.Total, _reserveNominal - balance.Cash));
        _toBrokerage = yr.surplus.Total - _toCash;
    } else if (yr.isOrderedStrategy) {
        // Ordered: the fill follows the draw order. Bank surplus in whichever FUNDABLE account (Cash
        // or Brokerage) the chosen sequence draws FIRST, so next year's ordered pass pulls it back
        // first instead of stranding it in an account the sequence won't reach until everything else
        // is gone. Roth and the IRA are contribution-limited and cannot receive an arbitrary after-
        // tax surplus, so only Cash and Brokerage are candidates. Any Cash-first sequence is
        // unchanged from the legacy all-to-cash default; a Brokerage-first one routes there instead.
        // Only the account ORDER from resolveOrderedSeq is used here, so its tax-rate args are
        // placeholders. Brokerage deposits step up basis, the same convention as the Cyclic and
        // Cash-Reserve-overflow paths above.
        const _seq = resolveOrderedSeq(inputs.orderedSeq, { capGainsPercentage: 0, capitalGainsRate: 0, nominalStateTaxAtLimit: 0, nominalTaxRate: 0, marginalFedTaxRate: 0, marginalStateTaxRate: 0 });
        const _fundFirst = (_seq.find(([a]) => a === 'Cash' || a === 'Brokerage') || ['Cash'])[0];
        if (_fundFirst === 'Brokerage') { _toBrokerage = yr.surplus.Total; _toCash = 0; }
    }
    balance.Cash += _toCash;
    if (_toBrokerage > 0) {
        balance.Brokerage += _toBrokerage;
        balance.BrokerageBasis += _toBrokerage;
    }
    yr.surplus.Cash = _toCash;              // literal cash banked (feeds the surplusCash log field)
    yr.surplusToBrokerage = _toBrokerage;   // reinvested overflow (hidden log field for Annual Details)
    yr.surplus.Total = 0;
}

// Counterfactual-only helper (Opp. Cost / Break Even): undo up to `netTarget` after-tax
// dollars of discretionary IRA over-withdrawal by putting the gross amount back into the
// IRA(s) and re-running the tax engine. Fixed point on gross G: removing G lowers taxes
// by dT, so the net surplus removed is G − dT; iterate G = netTarget + dT until stable.
// RMDs are never refunded (netWithdrawals.IRA excludes them); amounts already earmarked
// for conversion (surplus.Roth1/2) are excluded from the refundable cap.
function cfRefundIRA(sim, yr, netTarget) {
    const _cap = Math.max(0, (yr.netWithdrawals.IRA1 ?? 0) + (yr.netWithdrawals.IRA2 ?? 0)
        - (yr.surplus.Roth1 ?? 0) - (yr.surplus.Roth2 ?? 0));
    if (netTarget <= 1 || _cap <= 1) return;
    let G = Math.min(netTarget, _cap);
    let t2 = yr.tax, dT = 0;
    for (let _i = 0; _i < REFUND_IRA_REFINE_ITERS; _i++) {
        t2 = calculateTaxes(taxArgs(sim, yr, {
            earnedIncome: yr.pension + yr.taxableRMD + Math.max(0, yr.netWithdrawals.IRA - G) + yr.taxableInterest,
            iraIncome: yr.taxableRMD + Math.max(0, yr.netWithdrawals.IRA - G),
        }));
        dT = Math.max(0, (yr.totalTax - yr.IRMAA) - t2.totalTax);
        const Gnext = Math.min(netTarget + dT, _cap);
        if (Math.abs(Gnext - G) < 1) { G = Gnext; break; }
        G = Gnext;
    }
    const _iraDraw = (yr.netWithdrawals.IRA1 ?? 0) + (yr.netWithdrawals.IRA2 ?? 0);
    const _r = _iraDraw > 0 ? (yr.netWithdrawals.IRA1 ?? 0) / _iraDraw : 0.5;
    yr.netWithdrawals.IRA1 -= G * _r;
    yr.netWithdrawals.IRA2 -= G * (1 - _r);
    yr.netWithdrawals.IRA -= G;
    yr.tax = t2;
    const _newTotalTax = t2.totalTax + yr.IRMAA;
    const _netRemoved = G - (yr.totalTax - _newTotalTax);
    yr.totalTax = _newTotalTax;
    yr.totalIncome = Math.max(1, yr.totalIncome - G);
    yr.netIncome -= _netRemoved;
    sim.nominalTaxRate = yr.tax.nominalRate;
    yr.marginalFedTaxRate = yr.tax.federalMarginalRate + (yr.tax.niitMarginalOnOrdinary ?? 0);  // P117: see the seed block above
    yr.marginalStateTaxRate = yr.tax.stateMarginalRate;
    yr.surplus.Total = Math.max(0, yr.surplus.Total - _netRemoved);
}

// Extra conversion: an additional IRA-to-Roth move, independent of the spending strategy.
// `extraConversionAmount[y]` (or a scalar) is the gross IRA to withdraw and convert. Taxes come from
// the IRA gross, the same convention `convertExcessToRoth` uses, so net Roth = gross - tax.

// THE INCOME BASIS OF A YEAR, and the list is explicit on purpose.
//
// Both additional-conversion paths - `applyConversionGrossUp` and `applyExtraConversion` - pull IRA
// dollars AFTER the year's main tax pass has run. Writing back only `federalTax` and `stateTax`
// leaves every income-BASIS field at its pre-conversion value, and that is not a display defect:
// `growAndSettle` pushes `yr.tax.MAGI` into `balance.magiHistory`, and `beginYear` charges IRMAA
// against `magiHistory[len-2]` two years later, so a household could convert every year and never
// be billed a cent of IRMAA on it. `bracketOverage` reads the same figure.
//
// WHY A NAMED LIST RATHER THAN `Object.assign(yr.tax, calc)`. The recomputed calc is made with
// `IRMAAAnnualCost: 0`, because this year's IRMAA is already known from the lookback and is added
// separately, so that result's `IRMAAAnnualCost`, `IRMAARate`, `nominalRate` and `totalTax` are all
// wrong for this year and copying them would introduce a different defect. Only the income basis
// moves; rates and totals stay with their existing owners. Anything added to `calculateTaxes`'s
// return that describes INCOME rather than tax belongs in this list.
const TAX_BASIS_FIELDS = Object.freeze([
    'MAGI', 'AGI', 'federalTaxableIncome', 'stateAGI', 'stateTaxableIncome',
    'taxableSS', 'provisionalIncome', 'taxableOrdinaryIncome', 'taxablePreferentialIncome',
    'ordinaryIncomeInAGI', 'preferentialIncomeInAGI',
    'federalStdDeduction', 'stateStdDeduction', 'seniorDeduction', 'useItemized',
]);
function adoptTaxBasis(yr, calc) {
    if (!yr.tax || !calc) return;
    for (const k of TAX_BASIS_FIELDS) if (calc[k] !== undefined) yr.tax[k] = calc[k];
}

// `bracketOverage` is computed inside the WITHDRAWAL phases, in `applyPrimaryAndTaxPass1` and
// `resolveResidualAndForcedIRA`, and both run before either additional-conversion path. So even with
// a corrected MAGI the column cannot see a conversion: it was decided before the conversion existed.
// This runs after both paths and re-decides it.
//
// TWO CAUSES, KEPT APART, because they mean opposite things to a reader. Spending that could not be
// funded inside the ceiling is the plan failing to respect its own limit; a user-typed Extra Annual
// Roth Conversion going over is the user choosing to. `_overageFromConv` carries the second so the
// first stays readable, and so `isBracketInfeasible` keeps meaning "this ceiling cannot fund this
// plan" rather than "you asked to convert past it".
//
// `acaBreach` is deliberately NOT re-decided here. It is set in `resolveResidualAndForcedIRA` off the
// spending-driven figure and means "the strict cap could not fund spending", which a voluntary
// conversion does not change.
function recomputeBracketOverage(yr) {
    if (!(yr.bracketTarget > 0)) { yr._overageFromConv = 0; return; }
    const fromSpending = yr.bracketOverage ?? 0;
    yr.acaMAGI = ceilingMAGI(yr);   // P87d
    yr.bracketOverage = Math.max(0, yr.acaMAGI - yr.bracketTarget);
    yr._overageFromConv = Math.max(0, yr.bracketOverage - fromSpending);
}

function applyExtraConversion(sim, yr) {
    const { inputs, balance } = sim;
    const y = yr.y;
    const _extraConvReq = _extraConvAmountFor(inputs, y);
    yr.extraConvGross = 0;
    yr.extraConvCashTax = 0;
    let incrementalExtraConvTax = 0;
    if (_extraConvReq > 0) {
        const _availIRA = balance.IRA1 + balance.IRA2;
        const _gross = Math.min(_extraConvReq, _availIRA);
        if (_gross > 0) {
            // Incremental tax on extra IRA withdrawal via marginal-method re-calc.
            // _extraIRAIncome: IRA income already added this year by applyConversionGrossUp
            // (not in netWithdrawals.IRA, but its tax is already in yr.totalTax). It must be in
            // this basis so the subtraction below stays like-for-like - otherwise this compares
            // tax(income WITHOUT the gross-up) against a yr.totalTax that INCLUDES the gross-up's
            // tax, and silently understates the extra conversion's own tax by that amount.
            const _priorIRAInc = (yr.netWithdrawals.IRA ?? 0) + (yr._extraIRAIncome ?? 0);
            const _baseEI = yr.pension + yr.taxableRMD + yr.taxableInterest + _priorIRAInc;
            const _exTaxCalc = calculateTaxes(taxArgs(sim, yr, {
                IRMAAAnnualCost: 0, earnedIncome: _baseEI + _gross,
                iraIncome: yr.taxableRMD + _priorIRAInc + _gross,
            }));
            incrementalExtraConvTax = Math.max(0, _exTaxCalc.totalTax - (yr.totalTax - yr.IRMAA));
            yr.extraConvGross = _gross;
            // fundConversionWithCash: pay this conversion's incremental tax from Cash (capped at
            // available Cash) instead of netting it out of the conversion, so more of _gross lands
            // in Roth. Blends gracefully - funds what Cash allows, nets the uncovered remainder.
            let _net;
            if (inputs.fundConversionWithCash && incrementalExtraConvTax > 0) {
                const _cashForTax = Math.min(incrementalExtraConvTax, Math.max(0, balance.Cash));
                balance.Cash -= _cashForTax;
                yr.extraConvCashTax = _cashForTax;
                _net = _gross - (incrementalExtraConvTax - _cashForTax);
            } else {
                _net = _gross - incrementalExtraConvTax;
            }
            // Prefer-larger sourcing: pull the gross from the larger IRA first. The net Roth credit
            // follows the same per-account source (net scaled to each account's gross share).
            const _ecSplit = splitPreferLarger(_gross, balance.IRA1, balance.IRA2);
            const _ec1 = _ecSplit.i1;
            const _ec2 = _ecSplit.i2;
            const _netFrac = _gross > 0 ? _net / _gross : 0;
            balance.IRA1 -= _ec1;
            balance.IRA2 -= _ec2;
            yr.surplus.Roth1 = (yr.surplus.Roth1 || 0) + _ec1 * _netFrac;
            yr.surplus.Roth2 = (yr.surplus.Roth2 || 0) + _ec2 * _netFrac;
            yr.iraConvGross1 = (yr.iraConvGross1 ?? 0) + _ec1;
            yr.iraConvGross2 = (yr.iraConvGross2 ?? 0) + _ec2;
            yr.totalConverted += _net;
            yr.totalTax += incrementalExtraConvTax;
            // Fed/State attribution: _exTaxCalc is the full with-conversion income-tax calc (it already
            // includes any gross-up income via _priorIRAInc), so its Fed/State split is exact and makes
            // FedTax + StateTax + IRMAA reconcile to totalTax. capGainsTax is unchanged (ordinary income).
            yr.tax.federalTax = _exTaxCalc.federalTax;
            yr.tax.stateTax   = _exTaxCalc.stateTax;
            // P88b. _exTaxCalc is the full with-conversion income picture - it already carries any
            // gross-up income via _priorIRAInc - so its income basis is the year's correct one. The
            // defect was that only the two tax numbers above were ever taken from it.
            adoptTaxBasis(yr, _exTaxCalc);
            yr._extraIRAIncome = (yr._extraIRAIncome ?? 0) + _gross;   // keep the basis consistent for any later consumer
        }
    }
}

// Prefer-larger IRA sourcing for the additional conversion pulls (extra conversion, gross-up):
// take the whole amount from the larger-balance IRA, spilling to the smaller only when the larger
// cannot cover it. Keeps a real-world-sensible plan (no converting a token slice out of a tiny IRA)
// and changes per-account balances, and so downstream per-spouse RMDs; combined totals unchanged.

// ── The annual advisor fee ───────────────────────────────────────────────────
// Named "advisor fee" and not "AUM fee": AUM describes the percentage arrangement only, and this
// models a flat annual fee just as happily. A 1% fee on $2M is ~$20,000 in year one and compounds
// for the whole horizon, which is larger than several of the levers this tool argues about.
//
// THE THREE THINGS THAT ARE EASY TO BREAK HERE, all load-bearing:
//
// 1. FEE DOLLARS TAKEN FROM AN IRA ARE NOT TAXABLE DISTRIBUTIONS. This function writes `balance`
//    and `yr.advisorFee*` and NEVER `yr.netWithdrawals`. `taxArgs` reads `yr.netWithdrawals.IRA` as
//    both earnedIncome and iraIncome, so a debit that never enters that accumulator cannot reach a
//    tax pass, a MAGI, or the TaxPlanner handoff - the same technique the QCD uses. Routing the fee
//    through netWithdrawals to keep the books tidy would silently make it a taxable distribution.
//
// 2. THE BASE IS THE PRIOR DECEMBER 31 SNAPSHOT, not the live balance. Advisors bill on
//    prior-period value, and reading `balance` here would inherit the 1-vs-11 `preMonths`
//    dependency, so the fee would move with whether last year converted. See the snapshot in
//    `beginYear`.
//
// 3. NO `_cfRun` GUARD, DELIBERATELY. The counterfactual runs spread the whole inputs object, so
//    both arms pay the same fee and the Opportunity Cost comparison stays purely about the
//    CONVERSION. A guard would make every OC number nonsense, and a test forbids it.
//
// Charged at the start of the year, before `computeIncome`, so the fee lands inside the withdrawal
// cascade and a plan can actually FAIL because of it.
const ADVISOR_FEE_MODES  = Object.freeze(['pct', 'flat']);

// Percent-vs-dollars is INFERRED from what you typed, not chosen from a second control. A real
// advisory fee is a fraction of a percent to about two percent; a real flat fee is thousands. The
// two ranges do not overlap anywhere near this threshold, so one number can carry both meanings.
//
// 20 is the boundary and it belongs to FLAT: `20` reads as $20 a year, which is a harmless number
// to model, where reading it as 20% would quietly destroy a plan. The asymmetry of being wrong is
// the whole reason the boundary sits on this side. An explicit '%' or '$' in the text always wins
// over the magnitude, so `50%` and `$15` both do what they say.
const ADVISOR_FEE_PCT_MAX = 20;

// `explicit` is 'pct' or 'flat' when the user (or a shared link) said so, and anything else means
// "work it out". Kept here rather than in the UI so the ENGINE is safe on its own: a URL carrying
// `af=20000` with no `afm` must not be read as a 20,000% fee.
function inferAdvisorFeeMode(amount, explicit) {
    if (explicit === 'pct' || explicit === 'flat') return explicit;
    return (+amount || 0) >= ADVISOR_FEE_PCT_MAX ? 'flat' : 'pct';
}
// 'none' is FIRST and is the DEFAULT: a plan charges no fee until you say which accounts it applies
// to. It is also the off switch for a comparison - leave the amount typed and flip the dropdown, so
// "with fee" and "without fee" differ by one control rather than by clearing and retyping a number.
const ADVISOR_FEE_SCOPES = Object.freeze(['none', 'brokerage', 'roths', 'iras', 'rothira', 'all', 'allfromira']);

// What the percentage is charged ON. Cash is in no row: it is the spending buffer the Cash Reserve
// protects, and billing it fights the reserve refill every single year.
const ADVISOR_FEE_BASIS = Object.freeze({
    none:       Object.freeze([]),
    brokerage:  Object.freeze(['Brokerage']),
    roths:      Object.freeze(['Roth1', 'Roth2']),
    iras:       Object.freeze(['IRA1', 'IRA2']),
    rothira:    Object.freeze(['IRA1', 'IRA2', 'Roth1', 'Roth2']),
    all:        Object.freeze(['IRA1', 'IRA2', 'Roth1', 'Roth2', 'Brokerage']),
    allfromira: Object.freeze(['IRA1', 'IRA2', 'Roth1', 'Roth2', 'Brokerage']),
});

// Where the money COMES FROM. Identical to the basis for five of the six; `allfromira` charges
// against everything but pays out of the larger IRA first, which is the whole reason it exists.
// Once the source is dry the remainder spills in this order. Roth last, matching fillSpendingGap.
// CASH IS NEVER A SOURCE, for the same reason it is never a basis.
const ADVISOR_FEE_SPILL = Object.freeze(['Brokerage', 'IRA1', 'IRA2', 'Roth1', 'Roth2']);

// Debit one account, returning what was actually taken. A brokerage debit cuts value and basis by
// the same fraction, so the basis/value ratio - and therefore yr.capGainsPercentage - is unchanged,
// and the fee cannot perturb an IRMAA/ACA/LTCG cliff or trip the third pass.
function _debitAdvisorFee(balance, acct, want) {
    if (!(want > 0)) return 0;
    const avail = Math.max(0, balance[acct] || 0);
    const paid = Math.min(want, avail);
    if (!(paid > 0)) return 0;
    if (acct === 'Brokerage') {
        balance.BrokerageBasis = Math.max(0, (balance.BrokerageBasis || 0) * (1 - paid / avail));
        balance.Brokerage = avail - paid;
        clampBrokerageBasis(balance);
    } else {
        balance[acct] = avail - paid;
    }
    return paid;
}

function applyAdvisorFee(sim, yr) {
    const { inputs, balance } = sim;
    // Emitted unconditionally, fee or no fee: the log record writes all four keys and the
    // _logSansTiming identity tests JSON.stringify whole rows, so a conditionally-present key breaks
    // them.
    yr.advisorFee = 0; yr.advisorFeeBasis = 0; yr.advisorFeeFromIRA = 0; yr.advisorFeeUnpaid = 0;

    const amount = +inputs.advisorFeeAmount || 0;
    if (!(amount > 0)) return;                      // amount 0 = OFF, bit-identical to no fee
    const mode  = inferAdvisorFeeMode(amount, inputs.advisorFeeMode);
    // DEFAULT IS 'none', so an unset or unrecognized scope charges NOTHING rather than quietly
    // billing everything. Returning here rather than leaning on ADVISOR_FEE_BASIS.none being empty:
    // the flat-mode branch never reads the basis at all, so an empty array would not stop it.
    const scope = ADVISOR_FEE_BASIS[inputs.advisorFeeScope] ? inputs.advisorFeeScope : 'none';
    if (scope === 'none') return;
    const prior = sim.priorYearEnd || balance;

    // The amount is stored RAW as typed and the engine does the /100, because a field whose meaning
    // switches between % and $ cannot live in the UI's x100 list - which list applies would depend
    // on a SECOND field. A flat fee is CPI-indexed, per the user's "indexed by CPI".
    let want;
    if (mode === 'flat') {
        want = amount * sim.cpiRate;
    } else {
        yr.advisorFeeBasis = ADVISOR_FEE_BASIS[scope].reduce((a, k) => a + Math.max(0, prior[k] || 0), 0);
        want = yr.advisorFeeBasis * (amount / 100);
    }
    if (!(want > 0)) return;

    const before1 = Math.max(0, balance.IRA1 || 0), before2 = Math.max(0, balance.IRA2 || 0);
    let paid = 0;

    if (scope === 'allfromira') {
        const sp = splitPreferLarger(want, Math.max(0, balance.IRA1), Math.max(0, balance.IRA2));
        paid += _debitAdvisorFee(balance, 'IRA1', sp.i1);
        paid += _debitAdvisorFee(balance, 'IRA2', sp.i2);
    } else {
        // Pro-rata across the source accounts: each pays the share of the fee its own balance
        // generated, which is what "the percentage comes out of the impacted accounts" means.
        const src = ADVISOR_FEE_BASIS[scope];
        const tot = src.reduce((a, k) => a + Math.max(0, balance[k] || 0), 0);
        if (tot > 0) for (const k of src) {
            paid += _debitAdvisorFee(balance, k, want * (Math.max(0, balance[k] || 0) / tot));
        }
    }
    // Spill whatever the source could not cover.
    for (const k of ADVISOR_FEE_SPILL) {
        if (paid >= want - EPS_EXACT) break;
        paid += _debitAdvisorFee(balance, k, want - paid);
    }

    yr.advisorFee = paid;
    // An unpayable remainder is DROPPED, never carried and never turned into a shortfall - the
    // floor-at-0 posture applyWithdrawals already takes.
    yr.advisorFeeUnpaid = Math.max(0, want - paid);
    yr.advisorFeeFromIRA = Math.max(0, before1 - Math.max(0, balance.IRA1 || 0))
                     + Math.max(0, before2 - Math.max(0, balance.IRA2 || 0));
}

function splitPreferLarger(amount, ira1Avail, ira2Avail) {
    if (ira1Avail >= ira2Avail) {
        const f1 = Math.min(amount, Math.max(0, ira1Avail));
        return { i1: f1, i2: Math.min(amount - f1, Math.max(0, ira2Avail)) };
    }
    const f2 = Math.min(amount, Math.max(0, ira2Avail));
    return { i1: Math.min(amount - f2, Math.max(0, ira1Avail)), i2: f2 };
}

// Cash-funded gross-up (fundConversionWithCash): pull an ADDITIONAL gross amount from the IRA
// on top of whatever routeSurplusAndConvert already reallocated to Roth (conv1+conv2, sitting
// in yr.surplus.Roth1/Roth2 at this point - nothing else has touched them yet), fund THIS NEW
// slice's own tax from Cash (never netted from the conversion), and credit the full additional
// amount to Roth. Must run AFTER routeSurplusAndConvert has fully settled balance.Cash/IRA1/IRA2
// for the year, and BEFORE applyExtraConversion (so `conversion` measures only conv1+conv2, and
// this mechanism gets first claim on Cash).
//
// Derivation: t = marginal rate on the conv1+conv2 slice (shadow calc removing `conversion`
// dollars of IRA income already being withdrawn; the tax drop is that top slice's marginal tax
// - same subtractive technique as attributeIncrementalTaxes/cfRefundIRA). Gross-up:
// increase = conversion * t/(1-t), so conversion + increase = conversion/(1-t), the flat-t
// gross-equivalent of the conversion. increase's own tax (increase*t) is paid from Cash;
// increase lands in Roth in full. Never partially funds an increase's tax - scales the whole
// increase down to what Cash/IRA availability allows instead.
function applyConversionGrossUp(sim, yr) {
    const { inputs, balance } = sim;
    yr.grossUpIRA = 0;
    yr.grossUpTax = 0;
    const conversion = (yr.surplus.Roth1 ?? 0) + (yr.surplus.Roth2 ?? 0);
    if (!inputs.fundConversionWithCash || conversion <= 1) return;

    const baseEI = yr.pension + yr.taxableRMD + yr.taxableInterest;
    const shadowIRA = Math.max(0, (yr.netWithdrawals.IRA ?? 0) - conversion);
    const shadowCalc = calculateTaxes(taxArgs(sim, yr, {
        IRMAAAnnualCost: 0, earnedIncome: baseEI + shadowIRA,
        iraIncome: yr.taxableRMD + shadowIRA,
    }));
    const dT = Math.max(0, (yr.totalTax - yr.IRMAA) - shadowCalc.totalTax);
    const t = Math.min(0.6, dT / conversion);   // 0.6 is a numeric safety guard, not a business rate
    if (t <= EPS_TAX_SHARE) return;

    const idealIncrease = conversion * t / (1 - t);
    const availCash = Math.max(0, balance.Cash);
    const availIRA  = Math.max(0, balance.IRA1 + balance.IRA2);
    const increase = Math.max(0, Math.min(idealIncrease, availCash / t, availIRA));
    if (increase <= 1) return;
    const taxCost = increase * t;

    // Prefer-larger sourcing: pull the whole gross-up from the larger IRA when it can cover it.
    const _guSplit = splitPreferLarger(increase, balance.IRA1, balance.IRA2);
    const increase1 = _guSplit.i1;
    const increase2 = _guSplit.i2;
    balance.IRA1 -= increase1;
    balance.IRA2 -= increase2;
    balance.Cash -= taxCost;

    yr.surplus.Roth1 = (yr.surplus.Roth1 ?? 0) + increase1;
    yr.surplus.Roth2 = (yr.surplus.Roth2 ?? 0) + increase2;
    yr.iraConvGross1 = (yr.iraConvGross1 ?? 0) + increase1;
    yr.iraConvGross2 = (yr.iraConvGross2 ?? 0) + increase2;
    yr.totalConverted += increase;
    yr.totalTax += taxCost;              // genuinely new tax, unlike conversion's (already counted)
    // Attribute this new tax across the Fed/State display split (marginal-rate proportional, sums to
    // taxCost) so FedTax + StateTax + IRMAA reconciles to totalTax. applyExtraConversion, if it runs
    // after, re-sets Fed/State exactly from its full tax calc (which already includes this income).
    { const fm = yr.tax.federalMarginalRate ?? 0, sm = yr.tax.stateMarginalRate ?? 0, tot = fm + sm;
      const fedFrac = tot > 0 ? fm / tot : 1;
      yr.tax.federalTax += taxCost * fedFrac;
      yr.tax.stateTax   += taxCost * (1 - fedFrac); }
    // This IRA income is NOT in yr.netWithdrawals.IRA (it's an extra draw applied straight to
    // balance), but its tax IS now in yr.totalTax. Any later mechanism that isolates its own
    // marginal tax by subtracting yr.totalTax must therefore include this in its income basis,
    // or it compares a with-this-tax baseline against a without-this-income shadow calc and
    // understates itself. applyExtraConversion reads this for exactly that reason.
    yr._extraIRAIncome = (yr._extraIRAIncome ?? 0) + increase;

    // P88b. The gross-up's own income basis. Unlike applyExtraConversion this function never had a
    // WITH-gross-up tax calc to copy from - `shadowCalc` above is the counterfactual WITHOUT the
    // conversion - so one is made here. It cannot be done by adding `increase` to MAGI by hand:
    // extra IRA income raises provisional income, which can raise the TAXABLE share of Social
    // Security, so AGI rises by more than the draw whenever that share is below its 85% cap.
    //
    // Argument shape is the main tax pass's (`yr.tax = calculateTaxes(...)`), with the gross-up's
    // IRA dollars added to both legs, and `IRMAAAnnualCost: 0` for the reason in adoptTaxBasis.
    // When applyExtraConversion runs afterward it recomputes over the same income plus its own
    // gross and adopts that instead, so the two never disagree - this call is what makes the basis
    // right for a plan that grosses up and has no extra conversion.
    adoptTaxBasis(yr, calculateTaxes(taxArgs(sim, yr, {
        IRMAAAnnualCost: 0,
        earnedIncome: baseEI + (yr.netWithdrawals.IRA ?? 0) + increase,
        iraIncome: yr.taxableRMD + (yr.netWithdrawals.IRA ?? 0) + increase,
    })));

    yr.grossUpIRA = increase;   // bookkeeping for grossOut
    yr.grossUpTax = taxCost;
}

// Phase 20 (reworked): per-year incremental tax attribution for the convTax / excessTax
// columns only. For each action (Roth conversion, excess withdrawal to Cash), compute the
// incremental tax attributable to that action by re-running calculateTaxes() without it.
// The Opp. Cost / Break Even values themselves come from the counterfactual run after the loop.
function attributeIncrementalTaxes(sim, yr) {
    yr.incrementalConvTax = 0;
    if (yr.totalConverted > 0) {
        const baseEI = yr.pension + yr.taxableRMD + yr.taxableInterest;
        const convShadowEI = baseEI + Math.max(0, (yr.netWithdrawals.IRA ?? 0) - yr.totalConverted);
        const shadowConvCalc = calculateTaxes(taxArgs(sim, yr, {
            IRMAAAnnualCost: 0, earnedIncome: convShadowEI,
            iraIncome: yr.taxableRMD + Math.max(0, (yr.netWithdrawals.IRA ?? 0) - yr.totalConverted),
        }));
        yr.incrementalConvTax = Math.max(0, (yr.totalTax - yr.IRMAA) - shadowConvCalc.totalTax);
    }

    yr.incrementalExcessTax = 0;
    const excessCashOC = yr.surplus.Cash;
    if (excessCashOC > 0 && (yr.netWithdrawals.IRA ?? 0) > 0) {
        const baseEI = yr.pension + yr.taxableRMD + yr.taxableInterest;
        const excessShadowEI = baseEI + Math.max(0, (yr.netWithdrawals.IRA ?? 0) - excessCashOC);
        const shadowExcessCalc = calculateTaxes(taxArgs(sim, yr, {
            IRMAAAnnualCost: 0, earnedIncome: excessShadowEI,
            iraIncome: yr.taxableRMD + Math.max(0, (yr.netWithdrawals.IRA ?? 0) - excessCashOC),
        }));
        yr.incrementalExcessTax = Math.max(0, (yr.totalTax - yr.IRMAA) - shadowExcessCalc.totalTax);
    }
}

// Apply post-withdrawal growth, dividends, and the year's totals accumulation.
function growAndSettle(sim, yr) {
    const { inputs, balance, totals } = sim;
    // Brokerage tax treatment is correct: dividends are taxed as qualifiedDiv in calculateTaxes()
    // (line ~864), liquidations are taxed as capGains above BrokerageBasis, and the growth
    // applied here is unrealized appreciation - not taxable until sold. The one valuation nuance:
    // unrealized gains are carried at face value during the simulation; totalNetWealth (line ~1091)
    // discounts them by nominalTaxRate, but year-by-year spendable wealth does not reserve for
    // deferred tax on gains that are never liquidated.

    // The conversion is credited HERE, before the post-withdrawal growth, so the converted dollars
    // compound for `postMonths` exactly as every other surplus destination does. Credited at the end
    // of this function instead, after `applyGrowth`, a converted dollar earns ZERO growth in the year
    // it converts while surplus routed to Cash or Brokerage - credited well above this point - earns
    // `postMonths` of it, which biases every conversion-versus-banking comparison against the Roth.
    //
    // The FRACTION is what makes it right, and a full year would be just as wrong: the converted
    // money already grew inside the IRA for `preMonths` as part of the pre-withdrawal balance, and
    // grows in the Roth for the remaining `postMonths`. Since preMonths + postMonths = 12 and IRA and
    // Roth carry the same rate, the conversion month is growth-neutral WITHIN a year, which is the
    // correct answer. Across YEARS, converting earlier still compounds tax-free sooner.
    //
    // Placed immediately above `applyGrowth` rather than done arithmetically, so the growth and the
    // gains bookkeeping (`yr.gains.Roth1`/`Roth2`, which feed the rothG column) stay in one place.
    balance.Roth1 += yr.surplus.Roth1;
    balance.Roth2 += yr.surplus.Roth2;

    // TAX SETTLEMENT DATE. `taxSettlement: 'december'` keeps the tax portion of the year's draw
    // invested until year end instead of letting it leave with the spending money. Withholding is
    // deemed paid ratably across the year whatever month it is withheld, so withholding on a
    // December distribution satisfies the whole year and needs no safe-harbor machinery.
    //
    // Implemented as a growth CREDIT, not a second cash flow: holding the tax dollars to December
    // leaves the same December 31 balance as paying at month m and crediting the growth they would
    // have earned, and that balance is what every downstream reader uses, next year's RMD basis
    // included. The credit is `T*(f(post) - 1)` on the already-grown balance, which is `timingShift`
    // for a shift of `post` months against a zero-month base.
    //
    // APPLIED AFTER `applyGrowth`, and the order is the constraint: above it the credited dollars
    // earn `postMonths` of growth on top of BEING that growth.
    //
    // Income tax only. `yr.tax.totalTax` excludes IRMAA, which `yr.totalTax` adds; Medicare premiums
    // are billed monthly, cannot be withheld from a distribution, and so cannot be deferred.
    //
    // The credit goes to the accounts the draw came from, in proportion, each at its own rate: the
    // household needed `spend + tax` in cash and deferred the tax part, so the dollars that stayed
    // invested are the ones it would otherwise have liquidated. A year with no voluntary withdrawal
    // has nothing to credit.

    // Post-withdrawal growth (Phase 12): remaining postMonths after withdrawal exits portfolio.
    yr.gains = applyGrowth(balance, yr.growthRates, yr.postMonths);
    inspectForErrors(yr.growthRates, balance, yr.gains);

    if (inputs.taxSettlement === 'december' && yr.postMonths > 0) {
        const _incomeTax = Math.max(0, (yr.tax?.totalTax ?? 0));
        const _nw = yr.netWithdrawals || {};
        const _src = ['IRA1', 'IRA2', 'Brokerage', 'Cash', 'Roth1', 'Roth2'];
        const _drawn = _src.reduce((t, k) => t + Math.max(0, _nw[k] ?? 0), 0);
        if (_incomeTax > 0 && _drawn > 0) {
            let _credited = 0;
            for (const k of _src) {
                const share = Math.max(0, _nw[k] ?? 0) / _drawn;
                if (share <= 0) continue;
                // Shift of `postMonths` against an already-grown balance, so the base is 0 months.
                const add = timingShift(_incomeTax * share, yr.growthRates[k] ?? 0, yr.postMonths, 0);
                balance[k] = (balance[k] ?? 0) + add;
                // BASIS DOES NOT MOVE. The credit is appreciation on shares already held - no shares
                // were bought - and basis rises only on a purchase; reinvested dividends are the case
                // where it genuinely does rise (the DRIP block below). Adding it to BrokerageBasis would
                // make the growth on the deferred tax dollars permanently untaxed and inflate the figure
                // the terminal step-up reads. It does belong in the gains the display columns read: it
                // sits below applyGrowth, so that call no longer sweeps it up, and leaving it out would
                // under-report brokerageG / cashG / rothG by exactly the credit.
                yr.gains[k] = (yr.gains[k] ?? 0) + add;
                _credited += add;
            }
            yr.taxCarryCredit = _credited;   // surfaced as the hidden '-taxCarryCredit' column
        }
    }

    // Conversion month, independent of the spending-withdrawal month, and implemented as a growth
    // TRANSFER: dollars converted at month m_c spend `(preMonths - m_c)` more months in the Roth and
    // that many fewer in the IRA, which is `timingShift` above. Credited to Roth_i at the ROTH's rate
    // and debited from IRA_i at the IRA's rate, because under Monte Carlo the two differ and the
    // household total moves with them; deterministically they are equal and only the SPLIT moves -
    // which still matters, since the December 31 IRA balance is next year's RMD basis.
    //
    // APPLIED AFTER `applyGrowth`, because this shift IS growth: adding it before the growth call
    // would grow it a second time.
    //
    // THE CONVERSION CANNOT PRECEDE THE RMD. In a year an RMD is distributed the first dollars out of
    // the IRA are deemed to satisfy it and an RMD may not be converted, so the month is floored at
    // `preMonths`, where the RMD is taken. Before RMD age the month moves freely.
    //
    // Only the conversion's GROWTH is relocated; the amount is whatever the strategy decided at the
    // withdrawal point. Exact for a ceiling family, which sizes the draw from income; approximate for
    // one that sizes off the balance (`fixedpct`, `fixed`, or `bracket` once the IRA Target binds),
    // where a genuinely earlier conversion would have changed the balance the sizing read.
    //
    // The month comes from the mode when one is set, otherwise from the standalone control.
    // `timingConvThreshold` (research only, no UI, no URL key) then pulls it to January when THIS
    // year's conversion exceeds it. Validated by SHAPE, not truthiness: 0 is a legal threshold
    // meaning any conversion at all pulls the month early, and a malformed value must leave the mode
    // alone rather than silently model something else.
    let _convTarget = yr.convMonth;
    const _thisConv = (yr.surplus.Roth1 ?? 0) + (yr.surplus.Roth2 ?? 0);
    const _tct = inputs.timingConvThreshold;
    if (Number.isFinite(_tct) && _tct >= 0 && _thisConv > _tct) _convTarget = 1;
    if (_thisConv > 0) {
        const _preMonths = 12 - yr.postMonths;
        const _rmdDue = (yr.totalRMD ?? 0) > 0;
        // Floored at THE RMD'S OWN MONTH when one is due; free otherwise. It was floored at
        // `_preMonths`, which is the spending month - correct only while the two legs were welded
        // together, and wrong the moment a mode takes the distribution in January and spends in
        // November. The rule was always about the distribution, never about the spending.
        const _mc = Math.max(_convTarget, _rmdDue ? yr.rmdMonth : 0);
        const _months = _preMonths - _mc;
        // The invariant is stated against the same quantity the floor is: a conversion may not sit
        // earlier in the year than the distribution it cannot precede. Testing `_months > 0` instead
        // asserted that the conversion may not precede the SPENDING, which is not a rule at all and
        // which fires on every legitimate Split year.
        if (_rmdDue && _mc < yr.rmdMonth) {
            throw new Error('withdrawTiming: RMD-year floor failed - a conversion cannot precede the RMD');
        }
        // The month the conversion ACTUALLY sat in, after the floor - not the one the mode asked
        // for. In an RMD year under a late mode those differ, and the column must report what
        // happened rather than what was requested.
        yr._convLabel = _mc === 1 ? 'Early' : 'Late';
        if (_months !== 0) {
            let _shifted = 0;
            for (const i of [1, 2]) {
                const X = yr.surplus['Roth' + i] ?? 0;
                if (X <= 0) continue;
                const toRoth = timingShift(X, yr.growthRates['Roth' + i] ?? 0, _months, yr.postMonths);
                const fromIRA = timingShift(X, yr.growthRates['IRA' + i] ?? 0, _months, yr.postMonths);
                // THE IRA MAY NOT HAVE IT TO GIVE, AND THEN THE ROTH MAY NOT RECEIVE IT. A conversion
                // is capped at the IRA balance AFTER the pre-withdrawal growth, so a conversion that
                // drains the IRA carried that growth into the Roth already - it is inside X. Taking
                // only what the balance can cover was always right; crediting the Roth the full
                // amount regardless was not. It counted the same ten months of growth twice and
                // manufactured X * g * 10/12 of wealth at identical tax: $38,156 on a $763k
                // conversion at 6%, and $631,051 of ending net worth on one bank household asked to
                // convert everything. Reachable by any "convert it all" candidate, which is exactly
                // what the conversion searches try. The Roth now receives the same FRACTION the IRA
                // surrendered. When the IRA's own rate is zero nothing was owed and nothing is
                // withheld, so the Roth keeps its full credit at its own rate.
                const take = Math.min(fromIRA, balance['IRA' + i] ?? 0);
                const credit = toRoth * (fromIRA > 0 ? take / fromIRA : 1);
                balance['Roth' + i] = (balance['Roth' + i] ?? 0) + credit;
                balance['IRA' + i] = (balance['IRA' + i] ?? 0) - take;
                yr.gains['Roth' + i] = (yr.gains['Roth' + i] ?? 0) + credit;
                yr.gains['IRA' + i] = (yr.gains['IRA' + i] ?? 0) - take;
                _shifted += credit;
            }
            yr.convTimingShift = _shifted;   // surfaced as the hidden '-convTimingShift' column
        }
    }

    // ── The RMD's own month ───────────────────────────────────────────────────────────────────
    // Sibling of the conversion shift above, and written the same way: an after-growth arithmetic
    // correction rather than a third call to `applyGrowth`.
    //
    // The distribution is subtracted in `resolveHousehold`, which runs after the pre-withdrawal
    // growth call, so the engine has already credited the IRA with `preMonths` of growth on money
    // that - in a mode taking the RMD early - left in month `rmdMonth`. Two entries correct it: take
    // back the IRA growth that did not happen, and credit the cash yield that did, for the months
    // the proceeds actually sat waiting to be spent.
    //
    // THE DESTINATION IS THE LOAD-BEARING CHOICE: Cash at the cash yield, never the surplus
    // destinations at their own rate. Crediting it back at the rate it left at would make an early
    // RMD cost exactly zero deterministically, and Split would arrive as a free lunch. An RMD taken
    // in January to unlock a January conversion really does sit in cash until November, and the gap
    // between the two rates is what that choice costs.
    //
    // The amount never moves: it is fixed off the prior December 31 balance and is
    // month-independent by regulation. Only its growth is relocated.
    //
    // CONDITIONAL ON THERE BEING A CONVERSION TO UNLOCK, which is the only reason to move it. The
    // distribution goes early so a conversion may follow it in the same month; a year that converts
    // nothing gains nothing and would simply pay the cost of holding the proceeds in cash.
    const _convertsThisYear = (yr.surplus.Roth1 ?? 0) > 0 || (yr.surplus.Roth2 ?? 0) > 0;
    const _rmdShiftMonths = _convertsThisYear ? (12 - yr.postMonths) - yr.rmdMonth : 0;
    if (_rmdShiftMonths > 0) {
        let _cashBase = 0, _pulled = 0, _owed = 0;
        for (const i of [1, 2]) {
            const _out = yr['_iraOut' + i] ?? 0;
            if (_out > 0) {
                const _giveBack = timingShift(_out, yr.growthRates['IRA' + i] ?? 0, _rmdShiftMonths, yr.postMonths);
                // Same clamp as the conversion leg, and the same rule below it: a drained IRA gives
                // what it has, and the household is credited only in that proportion.
                const _take = Math.min(_giveBack, balance['IRA' + i] ?? 0);
                balance['IRA' + i] = (balance['IRA' + i] ?? 0) - _take;
                yr.gains['IRA' + i] = (yr.gains['IRA' + i] ?? 0) - _take;
                _pulled += _take;
                _owed += _giveBack;
            }
            _cashBase += yr['_toCash' + i] ?? 0;
        }
        if (_cashBase > 0) {
            // Cash yield on the same FRACTION of the proceeds the IRA could give the growth back
            // on. When a conversion drains the IRA in the same year, the growth on the distribution
            // went to the Roth inside that conversion; crediting Cash for it as well counted it
            // twice, at identical tax. Nothing owed means nothing withheld.
            const _frac = _owed > 0 ? _pulled / _owed : 1;
            const _toCash = timingShift(_cashBase, yr.growthRates.Cash ?? 0, _rmdShiftMonths, yr.postMonths) * _frac;
            balance.Cash = (balance.Cash ?? 0) + _toCash;
            // Into yr.gains as well, or cashG under-reports it - the defect the tax-settlement
            // credit above records in its own comment.
            yr.gains.Cash = (yr.gains.Cash ?? 0) + _toCash;
            yr.rmdTimingShift = _toCash - _pulled;
        } else {
            yr.rmdTimingShift = -_pulled;
        }
    }

    // Merge pre-growth gains so annual display stats (brokerageG / cashG / rothG) reflect full year.
    for (const k in yr.preGains) yr.gains[k] = (yr.gains[k] ?? 0) + (yr.preGains[k] ?? 0);

    // Accrue dividends - reinvest into brokerage (basis steps up) or flow to cash
    if (inputs.dividendReinvest) {
        yr.gains.Brokerage = (yr.gains.Brokerage || 0) + yr.taxableDividends;
        balance.Brokerage += yr.taxableDividends;
        balance.BrokerageBasis += yr.taxableDividends;
    } else {
        yr.gains.Cash += yr.taxableDividends;
        balance.Cash += yr.taxableDividends;
    }
    // P115a. What the cash ACTUALLY earned this year, against what computeIncome taxed. Every credit
    // to Cash above arrived through yr.gains.Cash - both growth calls, the required distribution's
    // own month, the December settlement credit - except the dividends just deposited, which were
    // already taxed as dividends. The ledger: carry out = carry in + earned - taxed, and the carry
    // is next year's true-up. Both are logged so a reader can audit the residual rather than argue it.
    yr._cashInterestEarned = (yr.gains.Cash ?? 0) - (inputs.dividendReinvest ? 0 : yr.taxableDividends);
    sim.cashInterestCarry = yr._cashInterestCarryIn + yr._cashInterestEarned - yr.taxableInterest;
    yr._cashInterestCarry = sim.cashInterestCarry;
    // P35f: last point in the year that either brokerage value or basis moves, so the invariant
    // is re-established here before the balances are snapshotted into the log row.
    clampBrokerageBasis(balance);
    balance.magiHistory.push(yr.tax.MAGI);
    totals.tax += yr.totalTax;
    totals.medicare = (totals.medicare || 0) + yr.medicareBase;
    totals.gross += yr.totalIncome;
    totals.spend += (yr.targetSpend + yr.surplus.Shortfall);
    totals.taxCurrentDollars += yr.totalTax / sim.inflation;
    totals.spendCurrentDollars += (yr.targetSpend + yr.surplus.Shortfall) / sim.inflation;
    totals.rmd += yr.totalRMD;
    totals.rmdCurrentDollars += yr.totalRMD / sim.inflation;
    // Estimate tax attributable to RMDs proportionally (RMD / totalIncome × totalTax)
    totals.rmdTax += yr.totalIncome > 0 ? (yr.taxableRMD / yr.totalIncome) * yr.totalTax : 0;
    totals.qcd = (totals.qcd || 0) + yr.totalQCD;
    totals.qcdCurrentDollars = (totals.qcdCurrentDollars || 0) + yr.totalQCD / sim.inflation;
    totals.advisorFees = (totals.advisorFees || 0) + (yr.advisorFee || 0);
    totals.advisorFeesCurrentDollars = (totals.advisorFeesCurrentDollars || 0) + (yr.advisorFee || 0) / sim.inflation;
    totals.shortfall += yr.surplus.Shortfall;
}

// BETR signal, after-tax terminal valuation, solvency fail-check, withdrawal rate.
function evaluateYearOutcome(sim, yr) {
    const { inputs, balance, totals } = sim;
    // Opp. Cost NetValue (convOC/excessOC) is annotated after the loop by comparing this
    // run's after-tax wealth against the counterfactual run's, year by year.
    const _taxFuture = inputs.futureIRATaxRate ?? (yr.marginalFedTaxRate + yr.marginalStateTaxRate);
    // Capture the year-0 resolved future-IRA rate so the optimizer can value every
    // strategy's terminal IRA at one shared rate (comparable cross-strategy deltas). The run's own
    // first year, which for a resumed run (P128) is not plan year 0.
    if (yr.ySeq === 0) totals.futureIRARate = _taxFuture;

    // Phase 21: BETR per-year signal.
    // Computed when there was any conversion this year (standard or extra). BETR answers: "what future
    // marginal rate makes this conversion break-even?" Comparison to futureIRATaxRate gives ▲/▼ flag.
    yr.yearBETR = null;
    yr.yearBETRflag = null;
    if (yr.totalConverted > 0) {
        const _rIRA = yr.growthRates.IRA1 ?? inputs.growth ?? GROWTH_FALLBACK;
        // Qualified dividends are net investment income, so the drag they impose carries the
        // surtax too once MAGI is over the threshold. P117.
        const _drag = (inputs.dividendRate ?? 0) * ((yr.tax.capitalGainsRate ?? TAXData.FEDERAL.CAPITAL_GAINS.DEFAULT_RATE)
                                                   + (yr.tax.niitMarginalOnInvestment ?? 0));
        const _rTax = Math.max(0, (inputs.growth ?? _rIRA) - _drag);
        const _rmdAge1 = rmdStartAge(inputs.birthyear1 ?? 1960);
        const _yearsToRMD = Math.max(1, _rmdAge1 - yr.age1);
        yr.yearBETR = computeBETR(yr.tax.federalMarginalRate + (yr.tax.stateMarginalRate ?? 0), _rIRA, _rTax, _yearsToRMD);
        if (yr.yearBETR !== null) {
            const _futureRate = _taxFuture; // already resolved above
            yr.yearBETRflag = _futureRate > yr.yearBETR + BETR_FLAG_BAND ? '▲'
                         : _futureRate < yr.yearBETR - BETR_FLAG_BAND ? '▼' : '≈';
        }
    }

    // After-tax terminal valuation: IRA taxed at ordinary marginal (nominalTaxRate),
    // brokerage gains above basis taxed at the capital-gains rate (not ordinary),
    // Roth + Cash + returned basis at face.
    yr.totalNetWealth = netWealthOf(balance, sim);

    // Fail when the portfolio can't cover its required draw (spend minus guaranteed income).
    // This is strategy-agnostic and fires at the point of first real impairment.
    yr.guaranteedIncome = yr.s1 + yr.s2 + yr.pension;
    yr.portfolioBalance = balance.IRA1 + balance.IRA2 + balance.Roth1 + balance.Roth2 + balance.Brokerage + balance.Cash;
    const requiredPortfolioDraw = Math.max(0, sim.spendGoal - yr.guaranteedIncome);
    if (yr.netIncome < yr.targetSpend * FUNDED_TOLERANCE || yr.portfolioBalance < requiredPortfolioDraw) {
        totals.success = false;
        totals.failedInYear.push(sim.currentYear)
    } else {
        totals.yearsfunded += 1
    }

    inspectForErrors({ totalNetWealth: yr.totalNetWealth })  // See if any numbers look fishy.

    // Withdrawal rate = portfolio withdrawals / start-of-year portfolio balance.
    // SS and pension are NOT netted out of the numerator: the classic 4% rule measures what
    // leaves the portfolio, not what leaves it beyond guaranteed income (see the inflows column
    // for those). The denominator is the raw balance sum, matching the basis Guyton-Klinger
    // uses for its own guardrail rate, so the two rates in this tool are comparable.
    // Gross outflows: all account withdrawals incl. conversion-funding draws.
    yr._grossOutflows = (yr.netWithdrawals.IRA ?? 0) + yr.totalIRAForcedWithdrawals + yr.extraConvGross
        + (yr.grossUpIRA ?? 0) + (yr.grossUpTax ?? 0) + (yr.extraConvCashTax ?? 0)
        + (yr.netWithdrawals.Brokerage ?? 0)
        + (yr.netWithdrawals.Cash ?? 0)
        + (yr.netWithdrawals.Roth1 ?? 0)
        + (yr.netWithdrawals.Roth2 ?? 0);
    // Net outflows: the draws that actually funded spending and taxes. Roth conversions are a
    // reallocation, not a draw, and reinvested surplus went straight back into the portfolio.
    // Floored at zero: when guaranteed income exceeds spending the surplus being reinvested can
    // exceed everything withdrawn, and the remainder is new money going IN. That is a
    // contribution, not a negative withdrawal, so it belongs in avgNetDepletion rather than here.
    yr._netOutflows = Math.max(0, yr._grossOutflows - yr.totalConverted - yr._reinvestedSurplus);
    // Inflows: non-portfolio income applied to spending (SS + pension).
    yr._yearInflows = yr.fixedInc + yr.pension;
    yr._wdRate = (sim.prevPortfolio != null && sim.prevPortfolio > 0)
        ? yr._netOutflows / sim.prevPortfolio : null;
}

// Log the finished year and accumulate loop timing.
function logYear(sim, yr) {
    const { inputs, balance, log, totals } = sim;
    const loopMs = performance.now() - yr.loopStart;
    log.push(buildSimYearLogRecord({
        currentYear: sim.currentYear, alive1: yr.alive1, alive2: yr.alive2, age1: yr.age1, age2: yr.age2, status: yr.status,
        isLastMFJYear: yr.isLastMFJYear, isFirstSingleYear: yr.isFirstSingleYear,
        fixedInc: yr.fixedInc, pension: yr.pension, targetSpend: yr.targetSpend, netIncome: yr.netIncome, totalIncome: yr.totalIncome,
        surplus: yr.surplus, totalRMD: yr.totalRMD, qcd1: yr.qcd1, qcd2: yr.qcd2, taxableDividends: yr.taxableDividends, taxableInterest: yr.taxableInterest,
        netWithdrawals: yr.netWithdrawals, rmd1: yr.rmd1, rmd2: yr.rmd2, totalConverted: yr.totalConverted, tax: yr.tax, IRMAA: yr.IRMAA, IRMAATier: yr.IRMAATier, medicareBase: yr.medicareBase, cpiRate: sim.cpiRate,
        taxCarryCredit: yr.taxCarryCredit,
        cashInterestEarned: yr._cashInterestEarned, cashInterestCarry: yr._cashInterestCarry,
        convTimingShift: yr.convTimingShift,
        iraVolSpend1: yr.iraVolSpend1, iraVolSpend2: yr.iraVolSpend2, iraConvGross1: yr.iraConvGross1, iraConvGross2: yr.iraConvGross2,
        totalTax: yr.totalTax, capitalGains: yr.capitalGains, bracketTarget: yr.bracketTarget, rateBasis: yr.rateBasis, volIRAwd: yr.volIRAwd, bracketOverage: yr.bracketOverage, overageFromConv: yr._overageFromConv, forcedIRA: yr.forcedIRA, acaBreach: yr.acaBreach, acaMAGI: yr.acaMAGI, _ltcgFloor: yr._ltcgFloor, rmdTimingShift: yr.rmdTimingShift,
        balance: balance, nominalTaxRate: sim.nominalTaxRate, totalNetWealth: yr.totalNetWealth, portfolioBalance: yr.portfolioBalance, guaranteedIncome: yr.guaranteedIncome,
        gains: yr.gains, rmd1Pct: yr.rmd1Pct, subCycleLabel: yr.subCycleLabel, convNetValue: null, excessNetValue: null,
        incrementalConvTax: yr.incrementalConvTax, incrementalExcessTax: yr.incrementalExcessTax, yearBETR: yr.yearBETR, yearBETRflag: yr.yearBETRflag,
        extraConvGross: yr.extraConvGross,
        advisorFee: yr.advisorFee, advisorFeeBasis: yr.advisorFeeBasis, advisorFeeFromIRA: yr.advisorFeeFromIRA,
        surplusToBrokerage: yr.surplusToBrokerage, cashBreach: yr.cashBreach,
        // The part of year-end Cash that is the reserve: the smaller of the target in this year's
        // nominal dollars and the Cash actually held. Same two terms _reserveHidden uses at the top
        // of the year and the surplus router uses at the bottom; 0 when Off or under cyclic, where
        // the reserve is disabled. Shown in Annual Details as CashReserve (11.1702).
        cashReserve: (sim.inputs.CashReserve != null && !sim.inputs.cyclicEnabled)
            ? Math.min(sim.inputs.CashReserve * sim.inflation, Math.max(0, balance.Cash)) : 0,
        // Dividends reinvested into Brokerage this year (DRIP on), 0 when they went to Cash. Shown
        // in Annual Details as DRIP so brokerageG's growth-plus-DRIP total can be read apart.
        brokDRIP: sim.inputs.dividendReinvest ? (yr.taxableDividends ?? 0) : 0,
        grossUpIRA: yr.grossUpIRA, grossUpTax: yr.grossUpTax, extraConvCashTax: yr.extraConvCashTax,
        fedRateCreep: yr.fedRateCreep, stateRateCreep: yr.stateRateCreep,
        _ceilDedAddBack: yr._ceilDedAddBack,
        ssStart1: yr['-ssStart1'], ssStart2: yr['-ssStart2'], ssStartSurvivor: yr['-ssStartSurvivor'],
        ruleMove: yr['-ruleMove'],
        grossOutflows: yr._grossOutflows, netOutflows: yr._netOutflows,
        yearInflows: yr._yearInflows, wdRate: yr._wdRate,
        convLabel: yr._convLabel, wdLabel: yr._wdLabel,
        strategy: inputs.strategy, spendRule: inputs.spendRule, spendGoal: sim.spendGoal, gkAdjLabel: sim.gkAdjLabel, shapeGoal: sim.gkShapeGoal, inflation: sim.inflation,
        yearInflation: yr.yearInflation, baseReturn: yr.baseReturn, loopMs: loopMs
    }));
    totals.totalTime += log[log.length - 1].loopMs;
}

// The after-tax value of a set of balances at the household's current rates: TotalNetWealth on a
// log row, and the wealth the risk-based rule compares its spending against. ONE formula, because
// the rails are stated in the row's number and the rule reads the carried one.
function netWealthOf(balance, sim) {
    return (balance.IRA1 + balance.IRA2) * (1 - sim.nominalTaxRate)
        + Math.max(0, balance.Brokerage - balance.BrokerageBasis) * (1 - sim.capitalGainsRate)
        + balance.Roth1 + balance.Roth2 + balance.Cash + balance.BrokerageBasis;
}

// Carry wealth snapshots into next year, advance the spend goal, and compound rates.
function endYear(sim, yr) {
    const { inputs } = sim;
    // Raw balance sum (no tax discount). Feeds both the withdrawal rate and the GK guardrail
    // checks, so the two stay apples-to-apples and every year uses the same basis.
    sim.prevPortfolio = yr.portfolioBalance;
    // After-tax, for the risk-based rule: the year-end TotalNetWealth the next year starts with.
    sim.prevNetWealth = yr.totalNetWealth;
    // P103b5: undo a schedule's one-year spend override before the goal advances, so the next year
    // starts from the trajectory the plan would have had. Without this the override compounds.
    if (yr._spendOverride != null) sim.spendGoal = yr._spendOverride;

    // Advance spend goal: apply user's spend-change preference and inflation.
    // spendDelta is constant (1 + inputs.spendChange); moving this to end of loop
    // keeps year-0 spendGoal equal to the user's input in today's dollars.
    // Phase 22: GK handles inflation at the start of the next year via its own rules; only apply
    // spendDelta here. The risk-based rule takes CPI here like the plan without a rule, and so
    // does its shape.
    if (_usesGKSpendRule(inputs)) {
        sim.gkPriorReturn = yr._portfolioReturn;
        sim.spendGoal = sim.spendGoal * sim.spendDelta;
        // The shape is the goal's twin under Spend Delta; only CPI is applied elsewhere (the rule
        // applies it at the start of the next year, and the shape takes it there unconditionally).
        if (sim.gkShapeGoal != null) sim.gkShapeGoal = sim.gkShapeGoal * sim.spendDelta;
    } else if (_usesRBGSpendRule(inputs)) {
        sim.spendGoal = sim.spendGoal * sim.spendDelta * (1 + yr.yearInflation);
        if (sim.gkShapeGoal != null) sim.gkShapeGoal = sim.gkShapeGoal * sim.spendDelta * (1 + yr.yearInflation);
    } else {
        sim.spendGoal = sim.spendGoal * sim.spendDelta * (1 + yr.yearInflation);
    }

    sim.currentYear += 1;

    // Advance the two clocks for the following year. THIS is where the one-year indexation lag comes
    // from: brackets for year t+1 are set from the inflation realized in year t, which is what the IRS
    // and SSA do (a 12-month average ending August for brackets, Q3 CPI-W for COLA). Moving either
    // line to the top of the year would give the tax code a year of foresight.
    //
    // TWO clocks, separate inputs with separate meanings:
    //   sim.inflation  general, felt price inflation. Escalates spending.
    //   sim.cpiRate    the STATUTORY index. Places federal and state bracket limits, the standard
    //                  deduction, LTCG brackets, IRMAA thresholds, the ACA FPL multiple, the QCD
    //                  limit, Social Security COLA and a pension COLA.
    //
    // The statutory index runs below felt inflation, so it is an OFFSET and not a second random draw.
    // A Monte Carlo path supplies general inflation and the statutory index is that path less the
    // spread the user typed: `spread = inputs.cpi - inputs.inflation`, held constant, and
    // `cpi_t = i_t + spread`. Additive because the two input boxes mean a POINT gap and the tooltips
    // describe one. With no inflationSequence, i_t IS inputs.inflation, so cpi_t is inputs.cpi exactly
    // and every deterministic run stays byte-identical to the fixed-rate engine by construction.
    //
    // Medicare and IRMAA premium dollars grow at the statutory index PLUS a fixed excess-medical
    // spread, written `cpi_t + inputs.inflation` because that is the intent, though it reduces to
    // `i_t + inputs.cpi`. Keeping `inputs.inflation` rather than the path holds the excess at about
    // three points whatever the path does; making both terms path-following would turn a 12%
    // inflation year into about 24% premium growth.
    //
    // NOT on either clock, deliberately:
    //   - the gapYears pre-compounding in `simulate`, which precedes the simulation and so has no
    //     path to follow;
    //   - `irmaaFwdFactor` and the ACA one-year lookahead, where the plan is FORECASTING an index it
    //     cannot see, so they stay on inputs.cpi;
    //   - `taxCreepFactor`, a function of the calendar year only.
    //
    // `fixedTaxIndexing` pins BOTH statutory clocks to the typed rates while spending still follows
    // the path, so the difference between a run with it on and one with it off is what variable
    // inflation costs in tax alone. Freezing medicareRate too is deliberate: premiums inflating
    // against frozen thresholds would mix two effects that are known to diverge.
    const i_t    = inputs.fixedTaxIndexing ? inputs.inflation : yr.yearInflation;
    const spread = inputs.cpi - inputs.inflation;
    // Floored, because the spread is DERIVED and the floor upstream only guards the DRAW: i_t arrives
    // clamped at prng.js's INFLATION_FLOOR, but the default spread is NEGATIVE (cpi 2.8 against inflation
    // 3.0), so a year already sitting on the floor would be pushed straight through it. Applied HERE,
    // once, so cpiRate, medicareRate and pensionFactor all inherit it rather than each flooring
    // separately.
    const cpi_t  = Math.max(CPI_INDEX_FLOOR, i_t + spread);

    sim.inflation    *= (1 + yr.yearInflation);   // spending always follows the path
    sim.cpiRate      *= (1 + cpi_t);
    // Medicare dollars grow on their OWN clock, not the drawn path's. `sim.currentYear` was already
    // advanced above, so the rate carrying year Y into Y+1 is the one for Y: hence the -1.
    //
    // This line used to be `*= (1 + cpi_t + inputs.inflation)`, which tied premiums to the path's
    // CPI. That is now known to be backwards, not merely weak: premium growth has no measurable
    // relationship to CPI in any window, and hold harmless gives it the WRONG SIGN, because a small
    // COLA protects most beneficiaries and the whole increase lands on the minority who are not
    // protected. See research/MEDICARE_ESCALATION.md. The consequence here is that Medicare no
    // longer varies path to path under Monte Carlo, which slightly narrows the spread.
    sim.medicareRate *= (1 + medicareGrowthRate(sim.currentYear - 1 - MEDICARE_COSTS.ANCHOR_YEAR,
                                                inputs.medicareGrowth));
    // P81c. A COLA is an INCREASE, never a decrease, and the two instruments floor differently.
    //
    // Social Security rides a HIGH-WATER MARK of the index. 42 U.S.C. 415(i) measures each
    // increase from the last quarter that actually produced one, so a deflation year pays zero AND
    // the shortfall is absorbed on the way back up: CPI-W fell in 2009, benefits held flat through
    // 2010 and 2011, and the 3.6% paid in 2012 was measured against 2008, not against the trough.
    // A running max is exactly that rule, and it is the CHEAPER of the two readings - a per-year
    // max(0, .) would ratchet the benefit up permanently and overstate every deflating path.
    sim.ssFactor = Math.max(sim.ssFactor, sim.cpiRate);
    // A capped pension cannot use the high-water rule, because the cap already severs it from the
    // index LEVEL - that is what makes a capped COLA fall permanently behind (P70i). Plan language
    // grants an adjustment of the lesser of the cap and the year's CPI increase and never claws
    // back, so this floors PER YEAR. The cap is applied to this year's rate, not to the compounded
    // total, for the same reason.
    const colaCap = pensionColaCap(inputs);
    if (colaCap !== null) sim.pensionFactor *= (1 + Math.max(0, Math.min(colaCap, cpi_t)));
}

// One home for the eight strategy names the withdrawal dispatch recognizes. The enum is for code to
// READ (`STRATEGY.BRACKET` says which plan a branch is about); the derived array is what the dispatch and
// the sweep VALIDATE against, so a name can only be added in one place. A misspelled PROPERTY is
// undefined and compares false, which is why the guard below is what catches a bad key rather than the
// freeze - and without that guard a name outside the list falls through to the proportional baseline
// without a word, running a plan nobody chose. Unset stays legal: it is the baseline draw.
const STRATEGY = Object.freeze({
    PROPWD:   'propwd',    // proportional draw, the baseline
    FIXED:    'fixed',     // a fixed dollar IRA draw
    BRACKET:  'bracket',   // fill to a federal bracket or IRMAA tier
    ACA:      'aca',       // fill to a multiple of the Federal Poverty Level
    FIXEDPCT: 'fixedpct',  // a fixed percentage of the IRA
    ORDERED:  'ordered',   // one account at a time, in a named sequence
    SPLIT:    'split',     // a constant blend across accounts
    SCHEDULE: 'schedule',  // a per-year table, from a solver or a replay
});
const KNOWN_STRATEGIES = Object.freeze(Object.values(STRATEGY));
function assertKnownStrategy(inputs) {
    const s = inputs ? inputs.strategy : undefined;
    if (s === undefined || s === null || s === '' || KNOWN_STRATEGIES.includes(s)) return;
    if (s === 'gk') {
        throw new Error("strategy 'gk' is retired: Guyton-Klinger is the Guardrails spend rule now, "
            + "and the same plan is { strategy: 'propwd', propWithdraw: 0, spendRule: 'gk' }");
    }
    throw new Error(`unknown strategy '${s}'`);
}

// ── RESUME: continue a plan from the end of one of its own years ─────────────────────────────────
//
// Moving `startInYear` forward and copying the balances across is NOT the plan continued: every
// piece of state `simulate` carries year to year restarts - the N-year amortization clock, the cycle
// counter, the two-year MAGI history behind IRMAA, the tax-rate seeds, the inflation clocks, the
// Guardrails anchor, and the plan-year index that per-year arrays are read by. Spending goes wrong a
// second way, because the goal is an input in TODAY's dollars and a nominal goal handed to a later
// start year is inflated twice.
//
// So a run can be asked to record, on every log row, what the NEXT year needs (`captureResume`,
// stored under the internal key '-resume'), and a later run handed that record (`resume`) continues
// the plan with the same plan-year index, clocks and carried state. Market and inflation sequences
// are still read from their own index 0, so a resumed run takes a fresh future while keeping the
// plan's past. A test pins that a resumed run reproduces the plan's own later rows.
//
// Every field of `sim` is carried EXCEPT these. `prevPortfolio` and `prevNetWealth` are re-derived
// rather than copied: they are sums of the starting balances, and a caller that SCALES those
// balances - the rails solver does - needs them to follow.
const _RESUME_SKIP = new Set(['inputs', 'balance', 'log', 'totals', 'prevPortfolio', 'prevNetWealth']);

function snapshotResume(sim, planYear) {
    const carried = {};
    for (const k of Object.keys(sim)) {
        if (_RESUME_SKIP.has(k)) continue;
        const v = sim[k];
        carried[k] = (v && typeof v === 'object') ? { ...v } : v;
    }
    const b = sim.balance;
    return {
        planYear,
        sim: carried,
        magiHistory: b.magiHistory.slice(),
        balance: { IRA1: b.IRA1, IRA2: b.IRA2, Roth1: b.Roth1, Roth2: b.Roth2,
                   Brokerage: b.Brokerage, BrokerageBasis: b.BrokerageBasis, Cash: b.Cash },
        // The two fields per year that the terminal valuation reads from the WHOLE plan
        // (terminalIRARateFromLog), including the years before this run if it was itself resumed.
        priorRows: [...(sim.inputs.resume?.priorRows ?? []),
                    ...sim.log.map(r => ({ status: r.status, 'NominalRate%': r['NominalRate%'] }))],
    };
}

// simulate() inputs that continue `base` from a '-resume' record. `balanceScale` multiplies every
// account and the brokerage basis. `spendGoal`, when given, replaces the carried NOMINAL goal for
// the first resumed year, and Spend Delta and inflation carry on from it.
function resumeInputs(base, resume, { balanceScale = 1, spendGoal } = {}) {
    const b = resume.balance, s = balanceScale;
    const year = resume.sim.currentYear;
    return {
        ...base,
        startInYear: year, startYear: year,
        IRA1: b.IRA1 * s, IRA2: b.IRA2 * s, Roth: b.Roth1 * s, Roth2: b.Roth2 * s,
        Brokerage: b.Brokerage * s, BrokerageBasis: b.BrokerageBasis * s, Cash: b.Cash * s,
        captureResume: false,
        resume: spendGoal == null ? resume : { ...resume, sim: { ...resume.sim, spendGoal } },
    };
}

/** SIMULATION ENGINE **/
function simulate(inputs) {
    assertKnownStrategy(inputs);
    assertKnownSpendRule(inputs);
    if (!inputs.hasSpouse) {
        inputs = { ...inputs, birthyear2: 0, die2: 0, IRA2: 0, ss2: 0, Roth2: 0 };
    }
    // Cyclic mode forces dividend reinvestment (DRIP) to keep all brokerage proceeds
    // in the LTCG regime and prevent ordinary-income creep from dividends flowing to Cash.
    if (inputs.cyclicEnabled) {
        inputs = { ...inputs, dividendReinvest: true };
    }
    // P128. A resumed run (see snapshotResume) continues a plan: its clocks, its carried state and its
    // plan-year index come from the record, and only the balances come from the inputs.
    const resume = inputs.resume || null;
    const y0 = resume ? resume.planYear : 0;
    let balance = {
        IRA1: inputs.IRA1, IRA2: inputs.IRA2, Roth1: inputs.Roth, Roth2: inputs.Roth2 || 0,
        Brokerage: inputs.Brokerage, BrokerageBasis: inputs.BrokerageBasis, Cash: inputs.Cash,
        magiHistory: resume ? resume.magiHistory.slice() : []
    };
    simulationCount += 1;
    STATEname = inputs.STATEname;
    let log = [];
    let currentYear = resume ? resume.sim.currentYear : (inputs.startInYear || new Date().getFullYear());

    let birthyear1 = Math.floor(inputs.birthyear1);
    let birthmonth1 = inputs.birthmonth1 ?? 12;
    let birthyear2 = Math.floor(inputs.birthyear2);
    let birthmonth2 = inputs.birthmonth2 ?? 12;

    let maxYears = Math.max(inputs.birthyear1 + inputs.die1, inputs.birthyear2 + inputs.die2) - currentYear + 1;
    let totals = { tax: 0, gross: 0, spend: 0, yearsfunded: 0, success: true, yearstested: 0, failedInYear: [], shortfall: 0, taxCurrentDollars: 0, spendCurrentDollars: 0, rmd: 0, rmdCurrentDollars: 0, rmdTax: 0, thirdPassCount: 0, thirdPassTime: 0, totalTime: 0, acaBreachYears: 0, forcedIRATotal: 0 };

    // Pre-compound rates for any gap between today and the simulation start year.
    // This ensures brackets, SS COLA, and IRMAA are in the correct future-dollar terms
    // from year 1 of the loop, rather than starting from today's (1.0) base.
    const gapYears = Math.max(0, currentYear - new Date().getFullYear());
    let cpiRate      = Math.pow(1 + inputs.cpi,      gapYears);
    let inflation    = Math.pow(1 + inputs.inflation, gapYears);
    // Medicare and IRMAA DOLLARS, from medicare_costs.js. Compounded once a year in `endYear` and
    // handed to calcIRMAA and to `yr.medicareBase`. It never touches the THRESHOLDS, which index at
    // CPI on `cpiRate` above - two axes, and calcIRMAA takes them as two arguments.
    //
    // NOT `gapYears`, deliberately. Every other factor here is 1.0 at TODAY, but the premiums this
    // one scales are stated in TAXData.IRMAA.YEAR dollars, so it is anchored there instead. The two
    // agreed only while the wall clock happened to read 2026; a plan starting in 2030 was charging
    // 2026 premiums with no catch-up.
    //
    // A LOOP, not Math.pow: the rate changes every year, so there is no single rate to raise to a
    // power. This replaced `(1 + inputs.cpi + inputs.inflation)`, which was 5.8% on the page
    // defaults and had no source; research/MEDICARE_ESCALATION.md has the measured case for the
    // shape that replaced it.
    let medicareRate = medicareGrowthFactor(currentYear - MEDICARE_COSTS.ANCHOR_YEAR,
                                            inputs.medicareGrowth);
    // P70i. A capped COLA cannot be read off cpiRate, because the cap bites YEAR BY YEAR: a run
    // of 1% years followed by a 9% year is not the same as the average. So it carries its own
    // compounding factor, seeded over the gap years at the same capped rate.
    const _colaCap = pensionColaCap(inputs);
    let pensionFactor = _colaCap === null ? 1
                      : Math.pow(1 + Math.max(0, Math.min(_colaCap, inputs.cpi)), gapYears);
    // P81c. The Social Security clock: cpiRate's running maximum, so a benefit already being paid
    // never falls. Seeded off cpiRate because the gap years compound at the typed CPI and a rising
    // series is its own high-water mark; the max against 1 covers a typed NEGATIVE CPI, where the
    // same rule says the benefit holds flat rather than shrinking before the plan even starts.
    let ssFactor = Math.max(1, cpiRate);
    let fixedWithdrawal = 0;
    let spendDelta = 1 + inputs.spendChange;
    let spendGoal = inputs.spendGoal * Math.pow(1 + inputs.inflation, gapYears);
    let nominalTaxRate = TAX_RATE_SEED;
    // Year-0 seed, overwritten by the first calculateTaxes() call. The schedule's middle rate.
    let capitalGainsRate = TAXData.FEDERAL.CAPITAL_GAINS.DEFAULT_RATE;

    // Phase 20 (reworked): opportunity cost is now measured with a full counterfactual
    // simulation (see the end of simulate()) instead of per-dollar shadow deltas. During a
    // counterfactual run (_cfRun), discretionary IRA over-withdrawals that existed only to
    // fund conversions (_cfSuppressConversions) or excess-to-cash banking (_cfSuppressExcess)
    // are refunded back into the IRA with a fixed-point tax recomputation, so the larger IRA
    // then produces its own bigger RMDs, bracket stacking, and IRMAA in later years.



    /**************************************
     * PROCESS:
     *   Determine tax status.
     *   Determine SS & pension income.
     *   Determine withdrawal target and order based on strategy:
     *
     *   'fixed'    Reduce IRA in N Years. Amortizes the IRA over nYears, drawing that amount from
     *              the IRA only; RMDs count toward the target.
     *   'propwd'   Proportional Withdraw +%. Draws proportionally across IRA/Brokerage/Cash to meet
     *              the spend goal, plus an optional IRA boost of propWithdraw x spendGoal. At 0%
     *              this is the proportional baseline.
     *   'bracket'  Fill Federal Tax Bracket / IRMAA Ceiling / ACA Cliff. Draws IRA up to a ceiling.
     *   'fixedpct' IRA Draw %. Draws a fixed percentage of the starting-year IRA balance each year
     *              regardless of the spend goal; RMDs count toward the target.
     *
     *   Every one of them fills a spending shortfall from Cash -> Brokerage -> Roth.
     *
     *   spendRule='gk' is Guardrails, NOT a strategy: a SPEND rule layered on whichever strategy
     *   decides the draw. `simulate` rejects strategy='gk' outright; a plan saved that way loads as
     *   { strategy: 'propwd', propWithdraw: 0, spendRule: 'gk' } with the same numbers.
     *
     *   The (else) fallback is the proportional baseline. No strategy NAME reaches it - `simulate`
     *   throws on a name it does not dispatch - so only an unset strategy does.
     *************************************/

    // Phase 24: Cyclic - tracks consecutive IRA draw years before a brokerage harvest year.
    // brokerage-first: init to large value so year 0 immediately triggers a harvest.
    let subCycleIRAYears = inputs.cyclicOrder === 'brokerage-first' ? Infinity : 0;
    // Seed the withdrawal-rate and GK guardrail denominator with the starting portfolio total.
    // Uses raw sum (no tax discount) - closest to "assets in hand" before simulation starts,
    // and the same basis endYear() carries forward for every later year.
    let prevPortfolio = balance.IRA1 + balance.IRA2
        + balance.Roth1 + balance.Roth2
        + balance.Brokerage + balance.Cash;

    // Phase 22: Guyton-Klinger state
    let gkIWR = null;
    let gkPriorReturn = 0;
    let gkAdjLabel = '';
    // P127 prototype. The plan's OWN spending path - year-0 goal, carried forward by Spend Delta
    // and CPI and by nothing else - kept beside the goal the rule is adjusting. Null until the
    // rule's first year sets it, and only the rule maintains it, so a run without the rule pays
    // nothing for it. See the ceiling in resolveSpendTarget for what it is for.
    let gkShapeGoal = null;
    // P132j. The plan's own no-rule path, for the GK-style rule's per-year band. Derived, never
    // an identity field; a caller may hand it in (`inputs.gkShape`) to skip the twin run.
    const gkShape = _usesGKSpendRule(inputs) ? (inputs.gkShape ?? _gkShapeOf(inputs)) : null;

    // Sim-level state shared across years (and with the phase functions being split out of
    // this loop). Fields listed after `totals` are reassigned as the simulation advances, so
    // they must live here rather than as locals; inputs/balance/log/totals are never
    // reassigned (only mutated) and stay usable as bare locals inside simulate() itself.
    const sim = {
        inputs, balance, log, totals,
        birthyear1, birthmonth1, birthyear2, birthmonth2,
        currentYear, cpiRate, inflation, medicareRate, pensionFactor, ssFactor,
        fixedWithdrawal, spendDelta, spendGoal,
        nominalTaxRate, capitalGainsRate,
        subCycleIRAYears, prevPortfolio,
        gkIWR, gkPriorReturn, gkAdjLabel, gkShapeGoal, gkShape,
        // Tax-rate creep: blank/0 start year means the creep begins with the plan's first year.
        // Never advanced - resolveHousehold() derives each year's factor from the calendar year.
        creepStartYear: inputs.taxCreepStartYear > 0 ? inputs.taxCreepStartYear : currentYear,
        // P64a. Property tax is entered in today's dollars, so it compounds from the REAL current
        // year, not the plan's first year - the same base spendGoal's gapYears pre-inflation uses.
        propTaxBaseYear: currentYear - gapYears,
        // P115a. Cash interest earned but not yet taxed (negative: taxed but not earned), carried
        // from one year's settlement into the next year's taxable interest. See computeIncome.
        cashInterestCarry: 0,
    };
    if (resume) Object.assign(sim, resume.sim);
    // The plan's whole length in plan years, resumed or not: P127's cut suspension counts back from
    // its end, and a resumed run's maxYears is only what is left of it.
    sim.planYears = y0 + maxYears;
    // After the resume, so a resumed year values its (possibly scaled) balances at the rates the
    // plan had reached: the same number as the row it resumes from, times the scale.
    sim.prevNetWealth = netWealthOf(balance, sim);
    const resumeStart = inputs.captureResume ? snapshotResume(sim, y0) : null;

    // `y` is the PLAN year, which a resumed run starts partway through; `ySeq` is the index into
    // this run's own market and inflation sequences, which always start at 0.
    for (let y = y0; y < y0 + maxYears; y++) {
        // Per-year context: every value that crosses a phase boundary within the year
        // lives here; block-internal temporaries stay plain locals.
        const yr = { y, ySeq: y - y0 };
        beginYear(sim, yr);
        if (!resolveHousehold(sim, yr)) break;   // both spouses deceased
        // P84. After resolveHousehold because that can end the loop, and a fee must not debit a
        // year that never gets a log row. Before computeIncome so the fee is inside the withdrawal
        // cascade and can genuinely break a plan. Note it does NOT move this year's RMD: P84l keys
        // that off the prior December 31 balance, which is the legally correct answer and the
        // reason P84's original placement caveat (R11) was retired.
        applyAdvisorFee(sim, yr);
        computeIncome(sim, yr);
        resolveSpendTarget(sim, yr);
        planPrimaryWithdrawals(sim, yr);
        applyPrimaryAndTaxPass1(sim, yr);
        fillSpendingGap(sim, yr);
        resolveResidualAndForcedIRA(sim, yr);
        routeSurplusAndConvert(sim, yr);
        applyConversionGrossUp(sim, yr);
        applyExtraConversion(sim, yr);
        recomputeBracketOverage(yr);   // P88c: after BOTH conversion paths, never before
        attributeIncrementalTaxes(sim, yr);
        growAndSettle(sim, yr);
        evaluateYearOutcome(sim, yr);
        logYear(sim, yr);
        endYear(sim, yr);
        if (inputs.captureResume) log[log.length - 1]['-resume'] = snapshotResume(sim, y + 1);
    } // end for (let y = y0; y < y0 + maxYears; y++)

    // Phase 20 (reworked): Opp. Cost via full counterfactual simulation.
    // convOC[y] = this run's after-tax wealth minus the same plan re-simulated with conversions
    // suppressed (converted dollars stay in the IRA, no conversion tax, bigger RMDs later, each
    // taxed at that year's actual bracket/IRMAA conditions). excessOC[y] = same idea for excess
    // IRA withdrawals banked to Cash. Break Even = the earliest year OC stays non-negative all
    // the way to the LAST simulated year (a sustained crossing) - not just the first year that
    // happens to touch non-negative, since a plan can blip positive for a year on its way to a
    // permanently worse outcome. Reported only once the costed action has actually occurred by
    // that year; null if the plan never sustains a non-negative gap through its final year.
    // Valuation: row totalNetWealth (IRA at the run's own nominal rate, brokerage gains at the
    // cap-gains rate, Roth/Cash/basis at face) unless the user supplied futureIRATaxRate
    // (Marginal Heirs Tax Rate) - then both runs' IRAs are discounted at that shared rate.
    totals.convBEYear = null;
    totals.excessBEYear = null;
    if (inputs.computeOC && !inputs._cfRun) {
        const _atw = (r) => afterTaxWealthOfLogRow(r, inputs.futureIRATaxRate);
        const _annotate = (cfLog, key) => {
            const n = Math.min(log.length, cfLog.length);
            for (let i = 0; i < n; i++) log[i][key] = _atw(log[i]) - _atw(cfLog[i]);
        };
        // Break-Even year selector: the earliest index that is BOTH (a) the start of the
        // trailing run of rows whose `key` value is non-negative all the way to the log's last
        // row, and (b) at or after the point the cumulative action total first exceeds $1. Both
        // (a) and (b) are individually "upward-closed" (once true at an index, stays true for
        // every later index), so their intersection is the suffix starting at the LATER of the
        // two cutoffs, including the edge case where OC is trivially non-negative before the
        // action even starts. Returns null when the plan ends negative (no sustained crossing
        // exists) or the action never occurred.
        const _sustainedBEYear = (key, actionAmount) => sustainedBreakEvenYear(log, key, actionAmount);
        if (log.some(r => (r.rothConv ?? 0) > 1)) {
            // extraConversionAmount: 0 (not just the suppress flag) so conversion-driven
            // early-withdrawal timing (line ~1038) doesn't leak into the no-conversion plan.
            const cfConv = simulate({ ...inputs, _cfRun: true, _cfSuppressConversions: true, extraConversionAmount: 0, computeOC: false });
            _annotate(cfConv.log, 'convOC');
            totals.convBEYear = _sustainedBEYear('convOC', r => r.rothConv ?? 0);
        }
        if (log.some(r => (r.surplusCash ?? 0) > 1 && (r.IRAwd ?? 0) > 1)) {
            const cfExcess = simulate({ ...inputs, _cfRun: true, _cfSuppressExcess: true, computeOC: false });
            _annotate(cfExcess.log, 'excessOC');
            totals.excessBEYear = _sustainedBEYear('excessOC', r => Math.min(r.surplusCash ?? 0, r.IRAwd ?? 0));
        }
    }

    // Phase 21: average BETR across all years with conversions.
    const _betrYears = log.filter(r => r['BETR%'] !== null && r['BETR%'] !== undefined);
    totals.betrAvg = _betrYears.length > 0
        ? _betrYears.reduce((s, r) => s + r['BETR%'], 0) / _betrYears.length
        : null;

    // Withdrawal-rate summaries. Walked pairwise so each year can reach the prior row's
    // portfolio balance (the same denominator the per-year wdRate% used).
    //   avgWdRate - simple mean of the yearly rates; the headline stat.
    //   avgWdRateWeighted - dollar-weighted (Σ withdrawals ÷ Σ portfolios). Late high-balance
    //                       years stop counting as much as early ones under the simple mean.
    //   avgNetDepletion - withdrawal rate net of portfolio return. Negative when the portfolio
    //                       grows faster than it is drawn down. A different statistic from the
    //                       withdrawal rate, which can never go below zero.
    // `prevPortfolio` (the outer local) still holds the seed: endYear() advances sim.prevPortfolio,
    // never this binding, so it is year 0's denominator.
    let _wdSum = 0, _wdNum = 0, _wdDen = 0, _depSum = 0, _wdN = 0;
    for (let i = 0; i < log.length; i++) {
        const prevPort = i === 0 ? prevPortfolio : log[i - 1].portfolioBalance;
        if (log[i]['wdRate%'] == null || !(prevPort > 0)) continue;
        _wdSum  += log[i]['wdRate%'];
        _wdNum  += log[i].netOut;
        _wdDen  += prevPort;
        _depSum += -(log[i].portfolioBalance - prevPort) / prevPort;
        _wdN    += 1;
    }
    totals.avgWdRate         = _wdN > 0 ? _wdSum / _wdN : null;
    totals.avgWdRateWeighted = _wdDen > 0 ? _wdNum / _wdDen : null;
    totals.avgNetDepletion   = _wdN > 0 ? _depSum / _wdN : null;

    // IRC 1014 basis step-up at the SECOND (final) death. The simulation ends AT the last death
    // year, so the final log row is always a death - for a couple and for a single filer alike -
    // and the heirs take the brokerage account at fair market value. The unrealized gain sitting
    // in it is never taxed to anyone. Valuing it net of capital-gains tax charged heirs for a
    // liquidation that does not happen, and did so ONE-SIDEDLY: Roth and Cash are unaffected, so
    // the error ran consistently in favor of Roth conversions everywhere terminal wealth is
    // compared.
    //   Expressed as `Basis := Brokerage` rather than "drop the discount" because that is what
    // 1014 actually does, and it is correct in BOTH directions: basis steps DOWN to market too,
    // so an account under water hands its heirs no deductible loss.
    //
    // TWO PLACEMENT CONSTRAINTS, both load-bearing, both covered by tests:
    //   1. This must run AFTER the Break Even block above, which by decision still values every
    //      row - including this one - on the un-stepped-up liquidation basis. Moving it earlier
    //      silently changes convBEYear.
    //   2. It must be SKIPPED on counterfactual runs. A _cfRun completes fully, so without this
    //      guard its last row would arrive at the Break Even block already stepped up while the
    //      main log's row is not, and convOC's final year would be differencing two different
    //      valuations. Nothing outside that block reads a _cfRun's finalNW or totals.terminal,
    //      so leaving those un-stepped on a counterfactual costs nothing.
    if (!inputs._cfRun) {
        const _last = log[log.length - 1];
        const _gainAtDeath = Math.max(0, _last.Brokerage - _last.Basis);
        // Exactly inverts the cap-gains haircut in the totalNetWealth formula (evaluateYearOutcome):
        // old contribution was gain*(1-capG) + basis, new is basis + gain, so the difference is
        // gain*capG. Adding the delta rather than restating the whole formula keeps the IRA half
        // in one place, where it cannot drift from this.
        // Both pre-step-up values are kept. '-totalNetWealthPreStepUp' is the terminal row's
        // LIQUIDATION value - what the estate would net by selling instead of inheriting - and it
        // is the basis the Break Even series above is computed on. Keeping it makes the two bases
        // recoverable from a finished run rather than implicit, which is what lets the convOC
        // identity still be asserted and what a legacy-basis Break Even would build on.
        _last['-basisPreStepUp'] = _last.Basis;              // leading '-' -> no table column
        _last['-totalNetWealthPreStepUp'] = _last.totalNetWealth;
        _last.totalNetWealth += _gainAtDeath * sim.capitalGainsRate;
        _last.Basis = _last.Brokerage;

        // Re-discount the terminal IRA at a widow-scoped trailing average instead of the final
        // year's own marginal. See `terminalIRARateFromLog` for why that window and why not the
        // heirs' own rate.
        //
        // BOTH placement constraints above apply here, which is why this sits inside this guard
        // rather than in `evaluateYearOutcome`: it must land after the Break Even block, which values
        // every row including this one on the pre-step-up basis, and it must be skipped on
        // counterfactual runs or convOC's final year would difference a re-valued row against one
        // that is not.
        //
        // Applied as a DELTA against the rate the row was built with, the same idiom the step-up
        // above uses, so the formula stays in one place: the old IRA contribution was IRA*(1-old) and
        // the new is IRA*(1-new), a difference of IRA*(old-new). Only the TERMINAL row moves, because
        // a per-year net-worth series is a statement about that year, not about the estate.
        const _termIRA = (_last.IRA1 ?? 0) + (_last.IRA2 ?? 0);
        // A resumed run (P128) averages over the plan's years, not only its own: the widow years
        // before the resume point are part of the same window.
        const _termRate = terminalIRARateFromLog(resume ? [...resume.priorRows, ...log] : log);
        const _rowRate = _last['NominalRate%'] ?? 0;
        _last['-termIRARate'] = _termRate.rate;
        _last['-termIRARateMax'] = _termRate.max;
        _last['-termIRARateYears'] = _termRate.years;
        _last['-termIRARateBasis'] = _termRate.basis;
        _last['-totalNetWealthAtFinalYearRate'] = _last.totalNetWealth;
        _last.totalNetWealth += _termIRA * (_rowRate - _termRate.rate);
        // The conservative edge of the band, reported and never applied. A caller showing a range
        // reads this; nothing in the engine ranks on it.
        _last['-totalNetWealthAtMaxRate'] = _last.totalNetWealth - _termIRA * (_termRate.max - _termRate.rate);
    }

    // Baseline accounting: expose the terminal capital-gains rate + terminal balance
    // breakdown so the optimizer's after-tax net-worth helper can value every strategy
    // on a comparable footing (IRA at future rate, brokerage gains at cap-gains rate).
    totals.capGainsRate = sim.capitalGainsRate;
    // The step-up fraction this run actually used, plus the state it came from, so the chart's
    // death markers and their legend can report it without re-deriving it from the inputs. Read
    // from totals rather than from the State dropdown on purpose: the dropdown can be changed
    // after a run, and the marker has to describe the run it belongs to.
    totals.basisStepUpFraction = TAXData[STATEname]?.BasisStepUp ?? BASIS_STEP_UP_FALLBACK;
    totals.stateName = STATEname;
    const _lastLog = log[log.length - 1];
    totals.terminal = {
        ira:       _lastLog.IRA1 + _lastLog.IRA2,
        roth:      _lastLog.Roth1 + _lastLog.Roth2,
        cash:      _lastLog.Cash,
        brokerage: _lastLog.Brokerage,
        basis:     _lastLog.Basis
    };
    // P104b1. True when `strategy: 'split'` ran on a malformed splitWeights and took the baseline
    // draw instead. The page shows it; nothing in the engine reads it. See _splitWeightsFor.
    totals.splitWeightsInvalid = !!sim.splitWeightsInvalid;

    const out = { log, totals, finalNW: log[log.length - 1].totalNetWealth };
    // P128. The record BEFORE the first year, so resuming at the plan's own start is the same
    // operation as resuming anywhere else.
    if (resumeStart) out.resumeStart = resumeStart;
    return out;
}

///////////////////////////

// Diagnoses WHY a plan's Roth conversions never sustain a Break Even lead (totals.convBEYear
// === null) despite conversions having occurred. Isolates the specific conversion YEAR whose
// inclusion flips the plan from "would eventually break even" to "never does," by re-testing
// truncated versions of the plan that keep conversions only through each successive actual
// conversion year and suppress everything after (via _cfSuppressConversionsFromYear). Linear
// scan over conversion years only (not calendar years), exits as soon as the boundary is
// found. Deliberately not a binary search: nominalTaxRate is a discrete bracket-table step
// function, so the sustains(j) sequence isn't guaranteed monotonic near a boundary -- binary
// search could silently converge on the wrong year with no way to detect it.
// Only call when totals.convBEYear === null AND conversions occurred
// (log.some(r => (r.rothConv ?? 0) > 1)) -- same precondition simulate()'s own BE block uses.
// On-demand only (up to k simulate() calls, k = distinct conversion years) -- never call from
// a hot path.
function diagnoseConvBreakEvenFailure(inputs, actualLog) {
    const convYearIdxs = [];
    for (let i = 0; i < actualLog.length; i++) {
        if ((actualLog[i].rothConv ?? 0) > 1) convYearIdxs.push(i);
    }
    const k = convYearIdxs.length;
    if (k === 0) return null; // precondition violated by caller; nothing to diagnose

    let prevBEYear = null;
    for (let j = 1; j <= k; j++) {
        const cutoff = convYearIdxs[j - 1] + 1; // yr.y index; suppress this index and later
        const truncated = simulate({ ...inputs, computeOC: true, _cfSuppressConversionsFromYear: cutoff });
        const beYear = truncated.totals.convBEYear;
        if (beYear == null) {
            const breakIdx = convYearIdxs[j - 1];
            return {
                outcome: j === 1 ? 'neverSustains' : 'boundary',
                breakingYear: actualLog[breakIdx].year,
                breakingAmount: actualLog[breakIdx].rothConv,
                lastSustainableYear: j > 1 ? actualLog[convYearIdxs[j - 2]].year : null,
                lastSustainableBEYear: j > 1 ? prevBEYear : null,
                futureIRATaxRateUnset: inputs.futureIRATaxRate == null,
            };
        }
        prevBEYear = beYear;
    }
    return null; // unreachable given the precondition (j=k is numerically the real plan, already null)
}

// The SUSTAINED break-even year: the first year after which the opportunity-cost series never goes
// negative again, and never before the action being priced has actually happened.
//
// Lifted out of simulate() (P28jg) so it can be tested on a series directly. It was previously a
// closure, and the only test of it drove a whole household to manufacture the shape it cares about -
// "one non-negative year, then negative forever". That fixture stopped producing the shape the
// moment conversions started compounding correctly, and 225 knob combinations could not restore it,
// because the shape was partly an artifact of the defect. The logic is a pure function of a series;
// testing it as one cannot rot when the engine changes.
//
// Two guards, both load-bearing: a series that ends negative has NO sustained crossing and returns
// null (the old first-touch `.find()` reported an early blip instead), and the answer is never
// earlier than the year the action first occurs, so a plan cannot break even before it converts.
function sustainedBreakEvenYear(log, key, actionAmount) {
    let ocCutoff = log.length;
    for (let i = log.length - 1; i >= 0; i--) {
        const oc = log[i][key];
        if (oc == null || oc < 0) break;
        ocCutoff = i;
    }
    if (ocCutoff >= log.length) return null;
    let cum = 0, actionCutoff = -1;
    for (let i = 0; i < log.length; i++) {
        cum += actionAmount(log[i]);
        if (cum > 1) { actionCutoff = i; break; }
    }
    return actionCutoff < 0 ? null : log[Math.max(ocCutoff, actionCutoff)].year;
}

// The rate the TERMINAL IRA is discounted at, estimated from the plan's own late-life experience
// rather than from its single final year.
//
// NOT THE FINAL YEAR, because one year is one draw of an idiosyncratic process: a brokerage harvest
// year and a large-conversion year land in very different brackets, and two stop years the search
// could barely separate were discounted 7pp apart purely on which bracket each one's last year fell
// in. NOT THE HEIRS' OWN RATE either - heirs are plural, filing differently, resident in different
// states, and the rate would be a projection decades out, replacing measurable noise with noise
// nobody can see.
//
// SCOPED TO THE TERMINAL FILING STATUS. The jump at the first death is the largest single move in
// the series, so a flat trailing window straddles it and blends married-rate years into an estate a
// single filer will hold.
//
// MARGINAL, not effective: `NominalRate%` is the rate a further ordinary dollar meets, and an IRA
// withdrawal is an ordinary dollar. An effective ratio would mix in capital-gains tax and the
// untaxed share of Social Security.
//
// Returns { rate, max, years, basis }. `max` is the other edge of the band, the worst late-life rate
// the plan saw; it is reported and not applied, because on a short window it is a max of two draws
// and collapses differences the average preserves.
function terminalIRARateFromLog(log) {
    const rateOf = (r) => r['NominalRate%'] ?? 0;
    const last = log[log.length - 1];
    const termStatus = last.status;
    // Trailing run of rows sharing the terminal filing status. Contiguous from the end on purpose:
    // an earlier same-status stretch (a plan that somehow returned to MFJ) is not the widow regime.
    let i = log.length - 1;
    while (i > 0 && log[i - 1].status === termStatus) i--;
    let window = log.slice(i);
    let basis = 'status';
    if (window.length < 2) {
        // Death in the final year, or a single-row plan. Two points is the least that can average
        // anything, so fall back to calendar years rather than report a one-year "average".
        window = log.slice(Math.max(0, log.length - 3));
        basis = 'trailing3';
    }
    const rates = window.map(rateOf);
    return {
        rate: rates.reduce((a, b) => a + b, 0) / rates.length,
        max: Math.max(...rates),
        years: window.length,
        basis,
    };
}

// After-tax value of a single simulate() LOG ROW, in the Break Even valuation basis: the row's
// own totalNetWealth (IRA at that run's nominal rate) unless a Marginal Heirs Tax Rate is supplied,
// in which case the IRA is discounted at that shared rate and brokerage gains at the row's own
// cap-gains rate. Factored out of simulate()'s Break Even block so bestConversionStopYear scores
// on the identical basis -- the two can never drift.
function afterTaxWealthOfLogRow(r, futureIRATaxRate) {
    if (futureIRATaxRate == null) return r.totalNetWealth;
    return (r.IRA1 + r.IRA2) * (1 - futureIRATaxRate)
        + Math.max(0, r.Brokerage - r.Basis) * (1 - (r['-capGainsRate'] ?? TAXData.FEDERAL.CAPITAL_GAINS.DEFAULT_RATE))
        + r.Roth + r.Cash + r.Basis;
}

// Searches for the year that MAXIMIZES after-tax wealth by stopping Roth conversions after it.
//
// A LINEAR SCAN, and it has to be: the cutoff curve is not unimodal - step-function brackets and
// IRMAA tiers - so binary or ternary search converges wrong undetectably, the same reasoning
// `diagnoseConvBreakEvenFailure` documents. The Break Even diagnostic's boundary year is NOT this
// year either: it is the last cutoff that still breaks even at all, a far weaker condition than max
// wealth (research/CONVERSION_STOP_YEAR.md).
//
// mode 'all'   stop ALL conversion activity after the cutoff (surplus and extra), via the internal
//              `_cfSuppressConversionsFromYear` cutoff.
// mode 'extra' stop ONLY the Extra Annual Roth Conversion, leaving a bracket fill running, via the
//              public `convEndYear` + `convEndMode: 'extra'` pair. Empirically weaker.
//
// Scores each cutoff on `afterTaxWealthOfLogRow` of the final row, the same basis as Break Even
// (honoring the user's Marginal Heirs Tax Rate when set, else row totalNetWealth). Any stop-year the
// user has already set is stripped first, so the search always explores from a full-conversion
// baseline. The caller gates on conversions actually occurring, the same precondition as the Break
// Even diagnostic. Cost: n+1 cheap (no-OC) `simulate` calls plus one OC re-run at the winner, so
// on-demand only, never a hot path.
//
// Returns null if the plan is too short to have any conversion years; else:
//   { mode, stopYearCalendar, stopIndex, atnwStop, atnwNoStop, atnwNoConv,
//     gainVsFull, gainVsNone, beAtStop, convertsNothingIsBest, neverStopIsBest }
function bestConversionStopYear(inputs, opts) {
    const mode = (opts && opts.mode) || 'all';
    const rate = inputs.futureIRATaxRate;
    // Strip any stop-year the user already set: the search explores from full conversions.
    const base = { ...inputs, convEndYear: undefined, convEndMode: undefined,
                   _cfSuppressConversions: false, _cfSuppressConversionsFromYear: undefined };
    const probe = simulate({ ...base, computeOC: false });
    const n = probe.log.length;
    if (n === 0) return null;
    const start = probe.log[0].year;
    const scoreOf = (res) => afterTaxWealthOfLogRow(res.log[res.log.length - 1], rate);

    const runAtCutoff = (cut, computeOC) => {
        if (mode === 'all') {
            return simulate({ ...base, _cfSuppressConversionsFromYear: cut, computeOC });
        }
        // Cut via the PUBLIC convEndYear/convEndMode pair - the same representation the sidebar
        // holds and bestTimeLimitedConversion scores - so the plan scored here is the plan the
        // user gets. cut 0 -> start-1, suppressed from year 0; cut n -> never reached, exactly
        // the untruncated scalar plan. The array branch survives only for a caller that already
        // passed a per-year array (no UI path does); it is equivalent since _extraConvAmountFor.
        if (Array.isArray(base.extraConversionAmount)) {
            const arr = new Array(n + 2).fill(0).map((_, y) => y < cut ? (base.extraConversionAmount[y] ?? 0) : 0);
            return simulate({ ...base, extraConversionAmount: arr, computeOC });
        }
        return simulate({ ...base, convEndYear: start + cut - 1, convEndMode: 'extra', computeOC });
    };

    let bestCut = 0, bestATNW = -Infinity, atnwNoConv = 0, atnwNoStop = 0;
    for (let cut = 0; cut <= n; cut++) {
        const atnw = scoreOf(runAtCutoff(cut, false));
        if (cut === 0) atnwNoConv = atnw;
        if (cut === n) atnwNoStop = atnw;
        if (atnw > bestATNW) { bestATNW = atnw; bestCut = cut; }
    }
    // One OC re-run at the winner to report its Break Even year (the cheap sweep skips OC).
    const beAtStop = runAtCutoff(bestCut, true).totals.convBEYear;

    return {
        mode,
        // cut 0 = convert nothing (no last-conversion year); cut n = never stop (full plan).
        stopYearCalendar: (bestCut === 0 || bestCut >= n) ? null : start + bestCut - 1,
        stopIndex: bestCut,
        atnwStop: bestATNW,
        atnwNoStop,
        atnwNoConv,
        gainVsFull: bestATNW - atnwNoStop,
        gainVsNone: bestATNW - atnwNoConv,
        beAtStop,
        convertsNothingIsBest: bestCut === 0,
        neverStopIsBest: bestCut >= n,
    };
}

// Strategies whose withdrawal branch never reads `yr.curIRA` or `yr.iraGoalNominal`, so no value of
// the IRA Goal can change their outcome. The UI grays the IRA Goal field for exactly these.
//
// Sweep the goal as a MULTIPLE of the starting IRA, not in absolute dollars: an absolute grid tests
// whether the floor BINDS, not whether the strategy reads it, and a coarse one reports `bracket` as
// insensitive when it is not.
//   reads it and reaches it ....... 'fixed'  (the goal is its amortization target)
//   reads it, rarely reaches it ... 'bracket', 'fixedpct'  (a floor on the balance, so it binds only
//                                   once the draw brings the IRA near it)
//   never reads it ................ everything below
// 'bracket' covers the Fed, IRMAA-tier and ACA-multiple sub-modes, which are parameters on it rather
// than separate strategies. Pinned by a test; if a strategy starts honoring the goal, remove it here
// or the field grays out on a control that works.
const IRA_GOAL_BLIND_STRATEGIES = Object.freeze(['propwd', 'ordered', 'split']);

// When ALL strategies fail at baseline, searches downward across every strategy to find
// the highest spend goal where at least one strategy succeeds.
// Returns { result, optimizedSpend, strategyLabel, paramLabel, paramSortVal, overrides } or null.
function optimizeSpendDown(baseInputs, strategyOverridesList) {
    function bestPassingStrategy(spendGoal) {
        let best = null;
        for (const entry of strategyOverridesList) {
            const res = simulate(Object.assign({}, baseInputs, entry.overrides, { spendGoal }));
            // GK self-cuts so totals.success is trivially true - require the GK stability floor too,
            // or the "highest sustainable spend" would be one GK only holds via continuous cuts.
            if (res.totals.success && gkSpendStable(res, entry.overrides, baseInputs)) {
                if (!best || res.totals.spend > best.result.totals.spend) {
                    best = { result: res, ...entry };
                }
            }
        }
        return best;
    }

    // Phase 1: verify MIN_SPEND is viable - it's the floor for the binary search.
    const MIN_SPEND = minSpendFloor(baseInputs.spendGoal);
    const floorEntry = bestPassingStrategy(MIN_SPEND);
    if (!floorEntry) return null;

    // Phase 2: binary search from MIN_SPEND (passes) up to baseline (fails) - same logic as
    // optimizeSpend(). Converges to the highest spend where totals.success is true.
    let lo = MIN_SPEND;
    let hi = baseInputs.spendGoal;
    let bestEntry = floorEntry;
    while ((hi - lo) / baseInputs.spendGoal > SPEND_SEARCH_TOLERANCE) {
        const mid = (lo + hi) / 2;
        const entry = bestPassingStrategy(mid);
        if (entry) {
            lo = mid;
            bestEntry = entry;
        } else {
            hi = mid;
        }
    }
    return { optimizedSpend: lo, ...bestEntry };
}

// Guardrails (the Guyton-Klinger spend rule) self-adjust spendGoal downward, so a terminal-balance or
// `totals.success` check is trivially satisfied at almost any initial spend - the target just moves
// to whatever survives. This stability floor rejects runaway initial spends the rule can only hold
// for a year or two before slashing: the worst REAL delivered spend across the horizon must stay
// within one guard band of the plan's own spending for that year.
//
// Keyed on the rule as the run actually had it - base inputs with the overrides on top, the way every
// caller simulates - so it applies under any draw, and returns true when the rule is off. Shared by
// the forward spend search, the reverse no-solution search and the conversion searches, so none of
// them recommends a spend or a conversion held only by continuous annual cuts.
//
// "The plan's own spending for that year" is the SHAPE - year 0 carried forward by Spend Delta - and
// not year 0 itself. Measured against year 0, a planned decline reads as a slash and a declining plan
// can find no viable spend at all. At a flat Spend Delta the two baselines are the same number.
function gkSpendStable(res, overrides, baseInputs) {
    const ran = { ...(baseInputs || {}), ...(overrides || {}) };
    if (!_usesSpendRule(ran)) return true;
    const log = res.log;
    if (!log || !log.length) return true;
    const initialReal = log[0].spendGoal / (log[0].inflationFactor || 1);
    if (initialReal <= 0) return true;
    // Written as a product rather than a ratio on purpose: at a flat delta, pow() is exactly 1 and
    // the test is bit-for-bit the one it replaced, which matters for a plan sitting ON the floor.
    const delta = 1 + (ran.spendChange ?? 0);
    const guardBand = ran.gkGuard ?? GK_DEFAULTS.guard;
    for (let y = 0; y < log.length; y++) {
        const real = log[y].spendGoal / (log[y].inflationFactor || 1);
        if (real < initialReal * Math.pow(delta, y) * (1 - guardBand)) return false;
    }
    return true;
}

// ── Suggested spend: engine-calibrated, strategy-independent menu (P50) ───────────────────────
// The suggested spend goal is an INPUT the user sets before optimizing strategy, so it must not
// move when they flip strategies. Every engine-solved option runs against a FIXED reference
// strategy (proportional withdrawal), making the numbers stable and comparable. The research
// benchmark (Bengen) is a rate on the portfolio and is strategy-independent by construction.
//
// DETERMINISTIC single path at the plan's fixed growth. On average returns a genuine Bengen rate
// leaves a large balance (its safety margin exists to survive a BAD sequence, which this path does
// not simulate), so the Conservative option is a research BENCHMARK, not an engine-verified floor.
// Real sequence-of-returns safety lives on the Monte Carlo tab.
const SUGGEST_REFERENCE_STRATEGY = 'propwd';  // neutral drawdown the engine-solved options assume
const SUGGEST_MIDDLE_KEEP_REAL   = 0.50;      // Middle: end holding >= this share of REAL start portfolio
const SUGGEST_RISKY_BUFFER_YEARS = 5;         // Aggressive: end holding this many years of FULL spend

// Horizon-aware Bengen-family SAFEMAX (revised, multi-asset, ~50-75% equity, US historical). The
// safe INITIAL withdrawal rate falls as the horizon lengthens. Linearly interpolated between knots.
function bengenRate(years) {
    const K = [[15, 0.055], [20, 0.050], [25, 0.047], [30, 0.045], [35, 0.042], [40, 0.040]];
    if (years <= K[0][0]) return K[0][1];
    if (years >= K[K.length - 1][0]) return K[K.length - 1][1];
    for (let i = 1; i < K.length; i++) {
        if (years <= K[i][0]) {
            const [y0, r0] = K[i - 1], [y1, r1] = K[i];
            return r0 + (r1 - r0) * (years - y0) / (y1 - y0);
        }
    }
    // Only reachable for a non-finite `years`: every comparison above is then false. Returns
    // the 30-year knot rather than undefined, so a bad input cannot put NaN into a spend menu.
    return 0.045;
}

// Largest after-tax spendGoal (start-year dollars) under a fixed reference strategy for which the
// plan funds every year AND terminalOk(result) holds at the last modeled year. PMT-seeded coarse
// scan then bisect, never breaking early on a fail (the pass/fail curve can dip across an ACA/IRMAA
// cliff - the non-unimodal hazard the bestConversionStopYear header documents). Returns
// { spend, probe } or null if the plan is infeasible even at zero spend.
function solveMaxSpend(baseInputs, opts) {
    const strategy   = (opts && opts.strategy) || baseInputs.strategy;
    const terminalOk = opts.terminalOk;
    const run = (spend) => simulate(Object.assign({}, baseInputs, { strategy, spendGoal: spend, computeOC: false }));
    const passes = (res) => !!(res && res.totals && res.totals.success && terminalOk(res));

    const probe = run(baseInputs.spendGoal || 0);
    if (!probe || !probe.log || probe.log.length === 0) return null;
    if (!passes(run(0))) return null;

    const invested = (baseInputs.IRA1 || 0) + (baseInputs.IRA2 || 0) + (baseInputs.Roth || 0)
                   + (baseInputs.Roth2 || 0) + (baseInputs.Brokerage || 0);
    const realReturn = (1 + (baseInputs.growth || 0)) / (1 + (baseInputs.inflation || 0)) - 1;
    const naivePMT   = calculateAmortizedWithdrawal(invested, 0, probe.log.length, realReturn);
    const finalGuar  = probe.log[probe.log.length - 1].guaranteedIncome || 0;

    // Ceiling generous enough to fail; expand a few times for a rich plan, then cap.
    let hi = finalGuar + naivePMT * 2 + 1;
    for (let g = 0; g < SUGGEST_CEILING_EXPANSIONS && passes(run(hi)); g++) hi *= SUGGEST_CEILING_FACTOR;

    // Coarse scan for the HIGHEST passing step (never break early - see SUGGEST_SCAN_STEPS), then
    // bisect between it and the next step. lo is 0.
    const step = (i) => hi * i / SUGGEST_SCAN_STEPS;
    let bestI = 0;
    for (let i = 1; i <= SUGGEST_SCAN_STEPS; i++) {
        if (passes(run(step(i)))) bestI = i;
    }
    let a = step(bestI);
    let b = (bestI < SUGGEST_SCAN_STEPS) ? step(bestI + 1) : hi;
    while (hi > 0 && (b - a) / hi > SPEND_SEARCH_TOLERANCE) {
        const mid = (a + b) / 2;
        if (passes(run(mid))) a = mid; else b = mid;
    }
    return { spend: a, probe };
}

// Max spend leaving `bufferYears` of terminal portfolio-funded
// need, against the SELECTED strategy. Terminal need is in the last year's own (inflated) dollars
// (last.spendGoal - last.guaranteedIncome), matching last.portfolioBalance - the today's-dollars
// search value would understate it under inflation. Returns { spend, horizon, naivePMT, haircut }.
function suggestSustainableSpend(baseInputs, opts) {
    const bufferYears = (opts && opts.bufferYears != null) ? opts.bufferYears : SUGGEST_BUFFER_YEARS;
    const r = solveMaxSpend(baseInputs, {
        terminalOk: (res) => {
            const last = res.log[res.log.length - 1];
            const need = Math.max(0, (last.spendGoal || 0) - (last.guaranteedIncome || 0));
            return (last.portfolioBalance || 0) >= bufferYears * need;
        },
    });
    if (!r) return null;
    const invested = (baseInputs.IRA1 || 0) + (baseInputs.IRA2 || 0) + (baseInputs.Roth || 0)
                   + (baseInputs.Roth2 || 0) + (baseInputs.Brokerage || 0);
    const realReturn = (1 + (baseInputs.growth || 0)) / (1 + (baseInputs.inflation || 0)) - 1;
    const horizon  = r.probe.log.length;
    const guarNow  = r.probe.log[0].guaranteedIncome || 0;
    const naivePMT = calculateAmortizedWithdrawal(invested, 0, horizon, realReturn);
    return {
        spend: r.spend,
        horizon,
        naivePMT,
        haircut: naivePMT > 0 ? Math.max(0, r.spend - guarNow) / naivePMT : null,
    };
}

// The suggested-spend menu: three after-tax goals from conservative to aggressive, all computed
// against the FIXED reference strategy with Guardrails off, so they do not move when the user changes
// strategy or turns Guardrails on.
//   A Conservative - a horizon-aware Bengen rate on the invested portfolio (research benchmark;
//     the year-1 portfolio-funded draw is ~this rate of the portfolio). Strategy-independent.
//   D Middle       - engine-solved to end holding >= 50% of the REAL starting portfolio.
//   B Aggressive   - engine-solved to end holding 5 full years of (inflated) spending.
// Returns { horizon, referenceStrategy, options: [{key,label,spend,note}] } - spend may be null if
// a solve is infeasible - or null if the plan cannot be simulated at all.
function suggestSpendMenu(baseInputs) {
    const base  = Object.assign({}, baseInputs, { strategy: SUGGEST_REFERENCE_STRATEGY, spendRule: '' });
    const probe = simulate(Object.assign({}, base, { spendGoal: baseInputs.spendGoal || 0, computeOC: false }));
    if (!probe || !probe.log || probe.log.length === 0) return null;

    const horizon   = probe.log.length;
    const row0      = probe.log[0];
    const guar1     = row0.guaranteedIncome || 0;
    const realStart = (row0.portfolioBalance || 0) / (row0.inflationFactor || 1);
    const invested  = (baseInputs.IRA1 || 0) + (baseInputs.IRA2 || 0) + (baseInputs.Roth || 0)
                    + (baseInputs.Roth2 || 0) + (baseInputs.Brokerage || 0);

    // A - Conservative (Bengen). Year-1 portfolio-funded draw = swr x invested, plus year-1
    // guaranteed income. Strategy-independent; a research benchmark, not engine-verified.
    const swr    = bengenRate(horizon);
    const aSpend = guar1 + swr * invested;

    // D - Middle: leave >= 50% of the real starting portfolio at the end.
    const dRes = solveMaxSpend(base, {
        terminalOk: (res) => {
            const last = res.log[res.log.length - 1];
            const realTerm = (last.portfolioBalance || 0) / (last.inflationFactor || 1);
            return realTerm >= SUGGEST_MIDDLE_KEEP_REAL * realStart;
        },
    });

    // B - Aggressive: end holding SUGGEST_RISKY_BUFFER_YEARS full years of (inflated) spending.
    const bRes = solveMaxSpend(base, {
        terminalOk: (res) => {
            const last = res.log[res.log.length - 1];
            return (last.portfolioBalance || 0) >= SUGGEST_RISKY_BUFFER_YEARS * (last.spendGoal || 0);
        },
    });

    return {
        horizon,
        referenceStrategy: SUGGEST_REFERENCE_STRATEGY,
        options: [
            { key: 'A', label: 'Conservative', spend: aSpend,
              note: `Bengen ${(swr * 100).toFixed(1)}% rate over ${horizon} years - keeps the portfolio largely intact` },
            { key: 'D', label: 'Middle', spend: dRes ? dRes.spend : null,
              note: `ends holding about half your starting portfolio in today's dollars` },
            { key: 'B', label: 'Aggressive', spend: bRes ? bRes.spend : null,
              note: `ends with ${SUGGEST_RISKY_BUFFER_YEARS} years of spending left - spends the rest down` },
        ],
    };
}

// Returns the highest-spend simulation result where the portfolio can still fund its required
// draw (spendGoal minus guaranteed income) in the final year. `overrides` are the strategy
// overrides for this row, the same object passed to addResult.
function optimizeSpend(baseInputs, overrides) {
    function passes(res) {
        const last = res.log[res.log.length - 1];
        const required = Math.max(0, last.spendGoal - (last.guaranteedIncome ?? 0));
        if ((last.portfolioBalance ?? 0) < required) return false;
        // GK stability floor (see gkSpendStable) - rejects spends GK only holds by slashing.
        if (!gkSpendStable(res, overrides, baseInputs)) return false;
        return true;
    }

    const baseSpend = baseInputs.spendGoal;

    // Step 1: baseline must pass
    const baseRes = simulate(Object.assign({}, baseInputs, overrides));
    if (!passes(baseRes)) return null;

    // Step 2: try the ceiling (SPEND_SEARCH_CEILING above baseline)
    const ceilSpend = baseSpend * (1 + SPEND_SEARCH_CEILING);
    const ceilInputs = Object.assign({}, baseInputs, overrides, { spendGoal: ceilSpend });
    const ceilRes = simulate(ceilInputs);
    if (passes(ceilRes)) {
        return { result: ceilRes, optimizedSpend: ceilSpend, hitCeiling: true };
    }

    // Step 3: binary search between baseline and ceiling
    let lo = baseSpend, hi = ceilSpend;
    let bestResult = baseRes;
    while ((hi - lo) / baseSpend > SPEND_SEARCH_TOLERANCE) {
        const mid = (lo + hi) / 2;
        const res = simulate(Object.assign({}, baseInputs, overrides, { spendGoal: mid }));
        if (passes(res)) {
            lo = mid;
            bestResult = res;
        } else {
            hi = mid;
        }
    }
    return { result: bestResult, optimizedSpend: lo, hitCeiling: false };
}

// Real-dollar, spendable-weighted score for one simulate() result. Same value as the optimizer
// table's per-row `_baselineScore` (optimizer_ui.js), but computed from a result object so the
// conversion sweep can rank on it too. Note: the UI derives real-dollar after-tax NW as
// afterTaxNW * (finalNWCurrentDollars / finalNW); since finalNWCurrentDollars = totalNetWealth /
// inflationFactor and finalNW = totalNetWealth, that ratio IS 1/inflationFactor, so dividing here is
// algebraically identical and drops the finalNW===0 guard. futureIRARate MUST be the caller's
// SHARED rate across strategies -- passing a per-run rate reintroduces exactly the self-referential
// comparison this metric exists to remove (raw finalNW discounts each run's IRA at its own rate).
function baselineScoreOf(res, futureIRARate, spendableWeight = SPENDABLE_WEIGHT) {
    if (!res || !res.log || !res.log.length) return -Infinity;
    const last = res.log[res.log.length - 1];
    const defl = last.inflationFactor || 1;
    const atNW = afterTaxNetWorth(res.totals.terminal, futureIRARate, res.totals.capGainsRate);
    return atNW / defl + spendableWeight * (res.totals.spendCurrentDollars ?? 0);
}

// Pick the conversion-sweep candidate pool: the highest-scoring row from each strategy FAMILY,
// ranked, capped at `maxPool`. Ranking by ending wealth alone lets one family take every seat while
// the families that actually benefit from converting rank just below the cut and are never swept.
// Pure: reads only plain row fields, no DOM, no `simulate`. Rows must already carry `_baselineScore`.
//
//   Family key = strategyKey|cyclicKey:
//     strategyKey  `_strategy`, EXCEPT that 'bracket' splits on `_stratIRMAATier` (<0 fills a tax
//                  bracket, >=0 fills to an IRMAA tier ceiling). Those share strategy 'bracket' but
//                  answer different questions, so keying on `_strategy` alone silently drops one.
//     cyclicKey    `_cyclicEnabled ? 'cyc' : 'lin'`; ira-first and brokerage-first collapse to one
//                  bucket, keeping whichever scores better. Cyclic MUST be its own dimension, or
//                  cyclic rows crowd out the non-cyclic champion of the same strategy. The
//                  cash-funded arm is deliberately NOT a dimension; it rides along on the winning
//                  row's `_fundConversionWithCash`.
//
// Eligibility: successful, and not a no-conversion reference, infeasible-bracket, untenable-ACA or
// spend-optimized row. The last is excluded because its overrides are rebuilt without spendGoal or
// the cyclic, tier and cash fields, so it would be swept at the wrong spend under a mismatched label.
function selectConversionCandidates(rows, maxPool = 12) {
    const champions = new Map(); // familyKey -> best-scoring eligible row
    for (const r of (rows || [])) {
        if (!r || !r.totals || !r.totals.success) continue;
        // _isCurrentPlan: the user's own configured plan is a fixed reference row, not a family
        // representative -- letting it stand for its family would hide the family's best plan.
        if (r._isNoConv || r._isSpendOptimized || r._isBracketInfeasible || r._isACAUntenable
            || r._isCurrentPlan) continue;
        let strategyKey = r._strategy;
        if (strategyKey === 'bracket') strategyKey = (r._stratIRMAATier ?? -1) >= 0 ? 'bracket-irmaa' : 'bracket-rate';
        const familyKey = strategyKey + '|' + (r._cyclicEnabled ? 'cyc' : 'lin');
        const cur = champions.get(familyKey);
        if (!cur || (r._baselineScore ?? -Infinity) > (cur._baselineScore ?? -Infinity)) {
            champions.set(familyKey, r);
        }
    }
    return [...champions.values()]
        .sort((a, b) => (b._baselineScore ?? -Infinity) - (a._baselineScore ?? -Infinity))
        .slice(0, maxPool);
}

// PF13: the optimizer's "Optimize for" objectives. Pure ranking logic (no DOM, no OptimizerState)
// so it is unit-testable and shared by the table body order, the ⚓ baseline pick, and the Rank
// column. Labels live in optimizer_ui.js (OPT_OBJECTIVE_LABELS); this holds only the comparison.
//   metric(r, rate) -> a scalar sorted per `dir` ('desc' = bigger is better, 'asc' = smaller).
//   rank(rows, rate) -> optional custom full ordering (used instead of metric when present).
//   `rate` is the shared future-IRA (heirs) rate, passed in so this stays UI-free.
// The three after-tax buckets at end of plan (used by Tax Flexibility):
//   pre-tax IRA net = terminal.ira * (1 - rate); Roth = terminal.roth (face);
//   taxable net = cash + basis + max(0, brokerage - basis) * (1 - capGainsRate).
// As of the IRC 1014 step-up, the last term is always zero here: terminal.basis === terminal.
// brokerage because the final row is a death year, so the taxable bucket is simply cash +
// brokerage at face. The expression is left intact so it matches afterTaxNetWorth line for line.
function _afterTaxBuckets(r, rate) {
    const t = (r.totals && r.totals.terminal) || {};
    const capG = r.totals?.capGainsRate ?? TAXData.FEDERAL.CAPITAL_GAINS.DEFAULT_RATE;
    const preTax  = (t.ira ?? 0) * (1 - (rate ?? 0));
    const roth    = (t.roth ?? 0);
    const taxable = (t.cash ?? 0) + (t.basis ?? 0) + Math.max(0, (t.brokerage ?? 0) - (t.basis ?? 0)) * (1 - capG);
    return [preTax, roth, taxable];
}
// The Tax Flexibility spread, as a fraction of the total: 0 means the three after-tax buckets came
// out perfectly even, 1 means everything landed in one of them. Infinity when there is nothing left
// to split, so a plan that drained itself to zero can never look "perfectly balanced".
//
// Exported because the table shows this as its own Mix Spread column. Pulled out of the taxflex
// ranker rather than copied into the UI: the number the column prints and the number the ranking
// sorts on have to be the same number, or the top row will not obviously be the top row.
// _afterTaxBuckets itself stays private - it returns a positional 3-array whose meaning lives only
// in the comment above it, and exporting that shape would invite callers to index into it.
function afterTaxBucketSpread(r, rate) {
    const b = _afterTaxBuckets(r, rate);
    const tot = b[0] + b[1] + b[2];
    return tot > 0 ? (Math.max(...b) - Math.min(...b)) / tot : Infinity;
}
const OPTIMIZER_OBJECTIVES = {
    // Tax Flexibility (default): among the genuinely wealthy plans (after-tax NW within 10% of the
    // best), the one whose three after-tax buckets are closest to equal -- maximum freedom to draw
    // from whichever bucket is tax-advantaged each year. The wealth cutoff first stops a plan that
    // drains everything to near-zero from "winning" on trivial equality.
    taxflex: {
        dir: 'desc',
        rank: (rows, rate) => {
            if (!rows.length) return rows.slice();
            const nw = r => r.afterTaxNWCurrentDollars ?? -Infinity;
            const maxNW = Math.max(...rows.map(nw));
            const cutoff = maxNW - 0.10 * Math.abs(maxNW); // 10% band; correct for negative maxNW
            const spread = r => afterTaxBucketSpread(r, rate);
            const eligible = rows.filter(r => nw(r) >= cutoff).sort((a, b) => spread(a) - spread(b));
            const rest     = rows.filter(r => nw(r) <  cutoff).sort((a, b) => nw(b) - nw(a));
            return [...eligible, ...rest];
        },
    },
    networth: { dir: 'desc', metric: r => r.afterTaxNWCurrentDollars ?? -Infinity },
    // Avoid Widow & RMD Tax: RMD tax paid in life + the deferred tax a survivor/heir still owes on
    // the leftover pre-tax IRA. Both nominal. Smaller is better.
    widowrmd: { dir: 'asc',  metric: (r, rate) => (r.totals?.rmdTax ?? 0) + (r.totals?.terminal?.ira ?? 0) * (rate ?? 0) },
    mintax:   { dir: 'asc',  metric: r => r.totals?.taxCurrentDollars ?? Infinity },
    maxspend: { dir: 'desc', metric: r => r.totals?.spendCurrentDollars ?? -Infinity },
    maxroth:  { dir: 'desc', metric: r => r.totals?.terminal?.roth ?? -Infinity },
    balanced: { dir: 'desc', metric: r => r._baselineScore ?? -Infinity },
    // P100b3, user's own priority order for this objective (2026-08-31): when two plans save the
    // same tax by converting, the one that ends with more Roth is the better answer, then the one
    // that breaks even sooner, and only then the wealthier one. Net-wealth-first is the right
    // DEFAULT but a poor lead for a question about conversions.
    conveffect:{ dir: 'desc', metric: r => r._convSavings ?? -Infinity,
                 tiebreak: ['finalRoth', 'breakEven', 'netWealth', 'remainIRA', 'spread', 'lifeTax', 'spend'] },
    // Earliest Break Even: the year a strategy's conversions permanently overtake the same strategy
    // without them. Ties are common - the year is an integer and many strategies cross together -
    // and the user's order for them (2026-09-03) is the ROTH BALANCE left, then real-dollar
    // after-tax net wealth. Same lead as `conveffect`, for the same reason: this goal asks a
    // question about conversions, so the account the conversions built answers it better than the
    // wealth total every other goal already leads on. Rows with no break-even (null: no
    // conversions, or the lead never sustains) sort last via the 9999 sentinel and can never
    // outrank a row that actually has a year.
    //
    // A metric plus a NAMED CHAIN, not a custom ranker. The hand-written two-key sort this replaced
    // stopped at net wealth and left every row past that in results-array order, which is the
    // defect P100b3 exists to remove; compareByTiebreakChain carries the remaining keys and the
    // `_id` backstop, so the order is total.
    earliestbe:{ dir: 'asc', metric: r => r._convBEYear ?? BE_NEVER,
                 tiebreak: ['finalRoth', 'netWealth', 'remainIRA', 'spend', 'lifeTax', 'spread'] },
};

// ============================================================================
// WHICH COLUMNS EACH "Optimize for" GOAL SHOWS
// ============================================================================
// The results table used to render all of these at once. Twenty-one columns meant the two or three
// that answered the question you actually asked were somewhere off the right edge, next to eighteen
// that did not, and three goals ranked on numbers that had no column at all. Each goal now keeps the
// handful of columns that answer its own question. Nothing is computed away - "Show all columns"
// beside the selector turns the filter off entirely.
//
// This lives in core rather than beside the descriptors in optimizer_ui.js for one reason: the UI
// file has no module.exports and no window.* namespace, and the three node suites never load it, so
// data placed there cannot be asserted outside a browser. Column KEYS are structural identifiers,
// not display text; the labels stay in the descriptors, on the UI side of the line the file comments
// already drew.

// The full column set, in display order. This array is the CONTRACT between OPT_OBJECTIVE_COLUMNS,
// which names subsets of it, and getOptimizerColumns() in optimizer_ui.js, which builds the
// descriptors. Neither file can see the other, so the pairing is pinned by two tests instead: a node
// test that every goal's list is drawn from this array, and an in-page test that
// getOptimizerColumns(true) emits exactly this array in exactly this order.
const OPT_COLUMN_KEYS = Object.freeze([
    'compare', 'status', 'gap', 'strategy', 'param', 'rank', 'afterTaxNW', 'tax',
    'spendGoal', 'spend', 'finalIRA', 'finalRoth', 'mixSpread',
    // 'dNW' and 'dTax' were removed 2026-09-07: "Show as Differences" already turns every comparable
    // column into a difference from the same reference row, so two columns named for a delta were a
    // narrower second copy of it.
    'extraConv', 'rate', 'years', 'rmd', 'rmdtax', 'convBE', 'convSaved',
]);

// Never filtered out, whatever a goal's list says. `compare` because the Best summary table drops
// the leading column on the understanding that it is the ⚖ control, and ⚖ is the only way to start
// a head-to-head comparison; `gap` because it is the dead space that keeps a near-miss click off the
// wrong control; `rank` because it is the readout for the goal selector itself; the rest because a
// row with no strategy name on it is not a row.
const OPT_COLUMNS_PINNED = Object.freeze([
    'compare', 'status', 'gap', 'strategy', 'param', 'rank',
    // End Wealth and All Taxes are pinned for EVERY goal, directly after Rank. They are what any
    // two plans get compared on whatever question you came with, and letting each goal decide
    // whether to show them meant they slid to a different place, or vanished, as you switched
    // goals - so the two numbers you were tracking moved under you.
    'afterTaxNW', 'tax',
]);

// objKey -> the columns that answer the question that goal asks. Pure data: no DOM, no descriptors,
// no formatting. Every list is written in full, pinned columns included, so it reads as the literal
// column set rather than as a diff; the pinned six are re-unioned at render time as a backstop.
//
// Every goal shows the column its own ranking metric reads - a set that hid the very number it
// sorted the table on would be worse than showing everything. A node test enforces that.
// dNW and dTax are in no list: they are meaningful against a reference the reader chose, so the
// filter adds them back whenever a ⚖ row is pinned.
const OPT_OBJECTIVE_COLUMNS = Object.freeze({
    taxflex:    ['compare','status','gap','strategy','param','rank','afterTaxNW','tax','mixSpread','finalRoth','finalIRA'],
    networth:   ['compare','status','gap','strategy','param','rank','afterTaxNW','tax','spend'],
    widowrmd:   ['compare','status','gap','strategy','param','rank','afterTaxNW','tax','finalIRA','rmd','rmdtax'],
    mintax:     ['compare','status','gap','strategy','param','rank','afterTaxNW','tax','rate'],
    maxspend:   ['compare','status','gap','strategy','param','rank','afterTaxNW','tax','spend'],
    maxroth:    ['compare','status','gap','strategy','param','rank','afterTaxNW','tax','finalRoth','extraConv'],
    balanced:   ['compare','status','gap','strategy','param','rank','afterTaxNW','tax','spend'],
    conveffect: ['compare','status','gap','strategy','param','rank','afterTaxNW','tax','convBE','convSaved','extraConv','finalRoth'],
    // finalIRA and finalRoth are here because the tie keys are: a reader looking at two rows that
    // broke even in the same year needs the number that separated them on screen, and the pre-tax
    // balance beside it is what the conversions were drawn from.
    earliestbe: ['compare','status','gap','strategy','param','rank','afterTaxNW','tax','convBE','convSaved','extraConv','finalIRA','finalRoth'],
    // `extraConv` is on the three Roth-facing goals only. The ⇌ marker says a row converts extra;
    // without the amount beside it the only way to learn the number was to LOAD the row, which
    // replaces the plan you were comparing against. All Columns shows it everywhere else.
});

// The two conversion goals rank on numbers that only a CONVERTING row has. The ⚓ baseline is drawn
// from no-conversion rows, which by definition never break even and never save conversion tax, so
// under those goals every delta against it came out as a dash - a reference with nothing to
// compare is not a reference. Under these goals the baseline is instead the best row that actually
// carries the field, ranked by that same goal.
//
// Value is the ROW FIELD that must be present, not a column key: the pool is filtered before any
// column exists.
const OPT_BASELINE_REQUIRES = Object.freeze({
    earliestbe: '_convBEYear',
    conveffect: '_convSavings',
});

// Relative view: which columns can be shown as a difference from the reference row, and how to read
// that difference. A column absent from this map is never converted - Strategy and Param are text,
// Rank is already a comparison, and Conv Tax is measured against the same row's own conversion
// search rather than against another row, so a delta of it would be a delta of a delta.
//
//   dir   'higher' / 'lower' = which direction is better, and so which sign is green. 'neutral'
//         colors nothing: a bigger Final IRA is worse for a widow and better for a spender, and
//         the table should not pretend to know which one you are.
//   unit  'dollar' plain thousands, 'pp' percentage POINTS (the underlying value is a fraction),
//         'years' for the break-even year.
const OPT_DELTA_COLUMNS = Object.freeze({
    tax:        { dir: 'lower',   unit: 'dollar' },
    spend:      { dir: 'higher',  unit: 'dollar' },
    afterTaxNW: { dir: 'higher',  unit: 'dollar' },
    finalRoth:  { dir: 'higher',  unit: 'dollar' },
    finalIRA:   { dir: 'neutral', unit: 'dollar' },
    rmd:        { dir: 'neutral', unit: 'dollar' },
    mixSpread:  { dir: 'lower',   unit: 'pp' },
    rate:       { dir: 'lower',   unit: 'pp' },
    rmdtax:     { dir: 'lower',   unit: 'pp' },
    convBE:     { dir: 'lower',   unit: 'years' },
});

// One line per goal, saying what the row order actually means. Replaces a single generic sentence
// that described the SELECTOR rather than the choice, and so told a reader who had already made the
// choice nothing. Each names the column it ranks on, which is also the column
// OPT_OBJECTIVE_METRIC_COLUMN guarantees is on screen, so the sentence and the table agree.
// Pure data, in core, for the same reason the column sets are: node can assert it, the UI cannot.
const OPT_OBJECTIVE_BLURB = Object.freeze({
    taxflex:    'Rows are ranked by Mix Spread, how evenly the money ends up split across pre-tax, Roth and taxable, among the plans that also finish among the wealthiest. Lower is better.',
    networth:   'Rows are ranked by End Wealth, the after-tax value of everything left at the end of the plan.',
    widowrmd:   'Rows are ranked by the RMD tax paid in life plus the tax still owed on the IRA left behind. Lower is better.',
    mintax:     'Rows are ranked by All Taxes, the total tax paid over the whole plan. Lower is better.',
    maxspend:   'Rows are ranked by Spendable, the total after-tax money the plan lets you spend.',
    maxroth:    'Rows are ranked by Final Roth, the balance nobody pays tax on again, yours or your heirs.',
    balanced:   'Rows are ranked by End Wealth and Spendable together, so neither is bought at the expense of the other.',
    conveffect: 'Rows are ranked by Conv Tax, the lifetime tax the extra conversions saved. Only the conversion-optimized rows carry it.',
    earliestbe: 'Rows are ranked by Break Even, the year conversions permanently overtake not converting. Earlier is better. Two plans that break even in the same year are ordered by Final Roth, then End Wealth.',
});

// True when a goal's column list contains the column its own ranking metric reads. Exported so the
// node suite asserts the rule rather than restating the pairing, and so adding a goal fails loudly.
const OPT_OBJECTIVE_METRIC_COLUMN = Object.freeze({
    taxflex: 'mixSpread', networth: 'afterTaxNW', widowrmd: 'finalIRA', mintax: 'tax',
    maxspend: 'spend', maxroth: 'finalRoth', balanced: 'afterTaxNW',
    conveffect: 'convSaved', earliestbe: 'convBE',
});

// True when two plans select the SAME withdrawal strategy: same family, same family parameter, and
// the same cyclic / cash-funding modifiers. Both arguments use plain engine field names, so a
// buildVariations() variation, a getInputs() sidebar snapshot, and an optimizer row's recorded
// _selection can all be compared against each other. Pure.
// Used by Monte Carlo (to run Stress against the user's actual strategy) and by the Optimizer (to
// mark the swept row nearest the user's current plan).
// The fields sameStrategySelection() reads, copied off a plan and nothing else. ONE list, because
// the identity has to survive a transport: the Monte Carlo worker posts a summary of each variation
// back to the page, and a hand-kept field list there dropped orderedSeq, the IRMAA tier, the ACA
// multiple and the Guyton-Klinger guardrails. Nothing failed - the comparison just fell through to
// the `?? default` on the missing side, so an Ordered plan silently matched whichever sequence the
// grid happened to list first and every IRMAA, ACA and GK plan matched nothing at all. Pure.
const STRATEGY_SELECTION_FIELDS = Object.freeze([
    'strategy', 'cyclicEnabled', 'cyclicOrder', 'fundConversionWithCash', 'rothGapFill',
    'propWithdraw', 'nYears', 'stratRate', 'stratIRMAATier', 'stratACAMultiple',
    'iraWithdrawPct', 'orderedSeq', 'gkGuard', 'gkAdjPct', 'splitWeights', 'spendRule',
    'gkShapeCeiling', 'rbgPreset', 'rbgCustom',
]);
function selectionOf(p) {
    const o = {};
    if (!p) return o;
    for (const k of STRATEGY_SELECTION_FIELDS) if (p[k] !== undefined) o[k] = p[k];
    return o;
}

function sameStrategySelection(a, b) {
    if (!a || !b) return false;
    if (a.strategy !== b.strategy) return false;
    if (!!a.cyclicEnabled !== !!b.cyclicEnabled) return false;
    if (a.cyclicEnabled && (a.cyclicOrder ?? 'ira-first') !== (b.cyclicOrder ?? 'ira-first')) return false;
    // buildVariations() emits 💵 fundConversionWithCash clones of every non-cyclic row; without
    // this a first-match search would pair a cash-funding user with the non-cash-funded twin, a
    // materially different plan.
    if (!!a.fundConversionWithCash !== !!b.fundConversionWithCash) return false;
    // Same reason for the 🅡 clones: Roth drawn after Cash instead of last is a different plan,
    // not a different label. Anything the engine does not recognize means "leave today's behavior
    // alone", so every unrecognized value has to compare equal to unset.
    const rgf = x => (x === ROTH_GAP_FILL.CASH_FIRST || x === ROTH_GAP_FILL.ROTH_FIRST) ? x : '';
    if (rgf(a.rothGapFill) !== rgf(b.rothGapFill)) return false;
    const near = (x, y) => Math.abs((x ?? 0) - (y ?? 0)) < EPS_SELECTION;
    // Guardrails are part of the identity under every strategy: the sweep carries each draw with
    // and without the spend rule, and those are two plans. The band and the step matter only when on.
    const rule = x => (x === 'gk' || x === 'rbg') ? x : '';
    if (rule(a.spendRule) !== rule(b.spendRule)) return false;
    if (rule(a.spendRule) === 'gk'
        && !(near(a.gkGuard ?? GK_DEFAULTS.guard, b.gkGuard ?? GK_DEFAULTS.guard)
              && near(a.gkAdjPct ?? GK_DEFAULTS.adjPct, b.gkAdjPct ?? GK_DEFAULTS.adjPct))) return false;
    // P132. The risk-based rule's identity is its preset, and for a custom set its four numbers.
    // The rails table is NOT identity: it is derived from the plan, and two runs of the same plan
    // with tables from different solves are the same plan.
    if (rule(a.spendRule) === 'rbg') {
        if ((a.rbgPreset ?? 'normal') !== (b.rbgPreset ?? 'normal')) return false;
        if ((a.rbgPreset ?? 'normal') === 'custom') {
            const ca = a.rbgCustom ?? {}, cb = b.rbgCustom ?? {};
            for (const k of ['target', 'upper', 'lower', 'cutTo']) if (!near(ca[k], cb[k])) return false;
        }
    }
    // P127. The shape ceiling is part of the identity for the same reason the band is: with it on
    // the rule delivers different spending. Nothing sets it yet, so every shipped row compares
    // equal here - this exists so that stops being true safely.
    if (rule(a.spendRule) && !!a.gkShapeCeiling !== !!b.gkShapeCeiling) return false;
    switch (a.strategy) {
        case 'propwd':   return near(a.propWithdraw,   b.propWithdraw);
        case 'fixed':    return a.nYears === b.nYears;
        // An IRMAA-ceiling plan and a bracket-rate plan are different strategies even when both
        // report stratRate 0, so the tier (and the ACA multiple) are part of the identity.
        case 'bracket':  return near(a.stratRate, b.stratRate)
                             && (a.stratIRMAATier ?? -1) === (b.stratIRMAATier ?? -1)
                             && (a.stratACAMultiple ?? 0) === (b.stratACAMultiple ?? 0);
        case 'aca':      return (a.stratACAMultiple ?? 0) === (b.stratACAMultiple ?? 0);
        case 'fixedpct': return near(a.iraWithdrawPct, b.iraWithdrawPct);
        case 'ordered':  return (a.orderedSeq ?? 'CBIR') === (b.orderedSeq ?? 'CBIR');
        // P104b1. A split's identity is its NORMALIZED vector: [1, 1, 0, 0] and [50, 50, 0, 0]
        // are one plan. Element-wise, because a scalar compare reads two arrays as never equal and
        // every split row would then fail to match the user's own plan - the bug the field-list
        // comment records for orderedSeq. A malformed vector is an identity of its own (it runs as
        // the baseline draw): two malformed ones match, a malformed one never matches a valid one.
        case 'split': {
            const na = _splitWeightsFor(a), nb = _splitWeightsFor(b);
            if (!na || !nb) return !na && !nb;
            const sa = na.weight.reduce((s, x) => s + x, 0), sb = nb.weight.reduce((s, x) => s + x, 0);
            return na.weight.every((x, i) => Math.abs(x / sa - nb.weight[i] / sb) < EPS_SELECTION);
        }
        default:         return false;
    }
}

// The user's current family parameter as a sweep row, when it does NOT sit on that family's
// standard grid -- so a user at Proportional 7% or Reduce 18 yrs sees their own setting on the
// family's curve instead of only the neighboring steps. Returns null when the value is already on
// the grid, or the family has no numeric grid (ordered/gk/aca: gk already sweeps the user's own
// guardrails, ordered is a small fixed set). Shared by buildVariations() and the Optimizer's own
// sweep so the two cannot drift; the grids themselves are passed in because they differ (the
// Optimizer sweeps IRA Draw further out than Monte Carlo does). Pure.
function offGridParamFor(base, grids = {}) {
    if (!base) return null;
    const on = (arr, v) => (arr || []).some(x => Math.abs(x - v) < EPS_SELECTION);
    switch (base.strategy) {
        case 'propwd': {
            const pct = Math.round((base.propWithdraw ?? 0) * 100);
            if (on(grids.propwd, pct)) return null;
            return { family: 'Proportional', paramLabel: `${pct}%`, paramSortVal: pct,
                     overrides: { strategy: 'propwd', propWithdraw: base.propWithdraw } };
        }
        case 'fixed': {
            const n = base.nYears;
            if (!n || on(grids.fixed, n)) return null;
            return { family: 'Reduce', paramLabel: `${n} yrs`, paramSortVal: n,
                     overrides: { strategy: 'fixed', nYears: n } };
        }
        case 'bracket': {
            // Only the bracket-RATE arm has a grid; an IRMAA-ceiling selection is swept as its own
            // family (tiers 0-4), so there is no off-grid case for it.
            if ((base.stratIRMAATier ?? -1) >= 0 || (base.stratACAMultiple ?? 0) > 0) return null;
            const pct = Math.round((base.stratRate ?? 0) * 100);
            if (on((grids.bracket || []).map(r => Math.round(r * 100)), pct)) return null;
            return { family: 'Fill Bracket', paramLabel: `${pct}%`, paramSortVal: base.stratRate,
                     overrides: { strategy: 'bracket', stratRate: base.stratRate } };
        }
        case 'fixedpct': {
            const pct = Math.round((base.iraWithdrawPct ?? 0) * 100);
            if (on(grids.fixedpct, pct)) return null;
            return { family: 'IRA Draw', paramLabel: `${pct}%`, paramSortVal: pct,
                     overrides: { strategy: 'fixedpct', iraWithdrawPct: base.iraWithdrawPct } };
        }
        case 'split': {
            // Compared on the NORMALIZED vector, because the weights are relative: a user who typed
            // 90/10 and the grid's [0,9,1,0] are the same plan and must not produce two rows.
            const w = base.splitWeights;
            if (!Array.isArray(w) || w.length !== 4) return null;
            if (!(w.reduce((a, b) => a + (b || 0), 0) > 0)) return null;
            const mine = splitVectorSortVal(w);
            if ((grids.split || []).some(g => Math.abs(splitVectorSortVal(g) - mine) < EPS_EXACT)) return null;
            return { family: 'Fixed Split', paramLabel: splitVectorLabel(w), paramSortVal: mine,
                     overrides: { strategy: 'split', splitWeights: w.slice() } };
        }
        default: return null;
    }
}

// ── Strategy-column sort key ──────────────────────────────────────────────────────────────────────────
// Sorting the Strategy column used to sort `_strategyLabel`, the string the cell RENDERS. That
// string carries the modifier prefix (raw HTML for the cyclic IRA-first arm), the pinned-row marks
// and the trailing conversion/infeasible markers, so the comparison was localeCompare over markup
// and emoji: every clone was torn away from the family it clones, and the alphabet stopped halfway
// through, resumed after a block of symbol-prefixed rows.
//
// This reads the DATA instead. Order is family, then parameter, then modifier, then variant - so
// each family is one contiguous block and each parameter's arms sit together inside it.
//
// The key is a fixed-width string compared by CODE POINT, never localeCompare: locale collation
// treats punctuation and padding as ignorable at primary strength, which is exactly the kind of
// silent reordering this function exists to remove. Fields are padded rather than delimited for
// the same reason. Pure.
const OPT_MODIFIER_SORT = Object.freeze({ 'ira-first': 1, 'brokerage-first': 2, 'cash': 3, 'rothgap': 4 });
// Variant ranks: the live row first, then the rows derived from it, then the no-conversion
// reference sweep, which is a different question and reads better as a block of its own.
const OPT_VARIANT_SORT = Object.freeze({ main: 0, conv: 1, spend: 2, reverse: 3, noconv: 4 });
function strategySortKey(r) {
    if (!r) return '';
    const fam = String(r._family || r._strategy || '').padEnd(18).slice(0, 18);
    const p = r._paramSortVal;
    // Numeric parameters are offset and scaled so a negative one (the IRMAA tiers sit on half-steps,
    // the lowest at -0.5) still pads to a positive fixed-width integer. String parameters (the
    // Ordered account sequences) sort as themselves, which is what the Param column does with the
    // same field. A family never mixes the two, so the N/S tag only has to keep them apart.
    const param = (typeof p === 'number' && Number.isFinite(p))
        ? 'N' + String(Math.round((p + 1000) * 1000)).padStart(9, '0')
        : 'S' + String(p ?? '').padEnd(9).slice(0, 9);
    const mod = OPT_MODIFIER_SORT[r._modifier] ?? 0;
    const variant = r._isNoConv ? OPT_VARIANT_SORT.noconv
        : r._isReverseOptimized ? OPT_VARIANT_SORT.reverse
        : r._isSpendOptimized ? OPT_VARIANT_SORT.spend
        : r._isConvOptimized ? OPT_VARIANT_SORT.conv
        : OPT_VARIANT_SORT.main;
    return fam + param + mod + variant;
}

// P100b3. The SHARED secondary ranking, applied after whatever the objective ranks on.
//
// WHY IT EXISTS. An objective that cannot separate two rows used to leave them in whatever order the
// results array happened to hold, and the table printed that as a Rank. On a measured scenario 133
// of 136 successful rows scored IDENTICALLY under `conveffect` - only 12 rows are ever evaluated for
// it and only 3 produce a figure - so "rank 103" meant "position 100 of 133 rows that tied", and the
// row moved to 20th when the user adopted a different plan without anything about it being
// re-measured. See research/OPTIMIZER_RANK_STABILITY.md.
//
// ONE default list plus per-objective OVERRIDES, rather than a list per objective. Nine objectives
// times eight metrics is 72 ordering decisions to author and defend, which is the kind of table that
// rots; an objective that wants a different second key names one, and inherits the rest.
const OPT_TIEBREAK_KEYS = Object.freeze({
    netWealth: { dir: -1, get: r => r.afterTaxNWCurrentDollars ?? -Infinity },
    finalRoth: { dir: -1, get: r => r.totals?.terminal?.roth ?? -Infinity },
    spend:     { dir: -1, get: r => r.totals?.spendCurrentDollars ?? -Infinity },
    lifeTax:   { dir:  1, get: r => r.totals?.taxCurrentDollars ?? Infinity },
    // Pre-tax IRA left behind: the survivor's and the heirs' RMD exposure. Smaller is better.
    remainIRA: { dir:  1, get: r => r.totals?.terminal?.ira ?? Infinity },
    // Integer year, and absent on most rows - a row that never breaks even sorts last, never first.
    breakEven: { dir:  1, get: r => r._convBEYear ?? BE_NEVER },
    // How unequal the three after-tax buckets are. Smaller is more freedom to draw from whichever is
    // tax-advantaged in a given year, which is why `taxflex` ranks on it ascending.
    spread:    { dir:  1, get: (r, rate) => afterTaxBucketSpread(r, rate) },
});

// The default order, used by every objective that does not name its own.
const OPT_TIEBREAK_DEFAULT = Object.freeze(
    ['netWealth', 'finalRoth', 'spend', 'lifeTax', 'remainIRA', 'breakEven']);

// Compare two rows down a chain of key names, then by `_id` as the total-order backstop.
//
// `_id` IS NOT ONE OF THE KEYS, and that is not tidiness. The keys subtract, and buildVariations
// assigns a numeric `_id` - but a caller with a STRING id would make `a - b` produce NaN, which is
// falsy, so the backstop would silently do nothing and the ordering would fall back to input-array
// order: exactly the defect this exists to remove, one level down and invisible. A test that ranked
// rows keyed 'x'/'y'/'z' is what caught it. Compared with < / > here, total for numbers and strings.
function compareByTiebreakChain(a, b, rate = 0, chain = OPT_TIEBREAK_DEFAULT) {
    for (const name of chain) {
        const t = OPT_TIEBREAK_KEYS[name];
        if (!t) continue;                       // an unknown name is skipped, never a thrown sort
        const d = t.dir * (t.get(a, rate) - t.get(b, rate));
        if (d) return d;
    }
    const ia = a?._id ?? 0, ib = b?._id ?? 0;
    return ia < ib ? -1 : ia > ib ? 1 : 0;
}

// Rank rows best->worst under an objective. Successful rows ALWAYS outrank failed ones (a depleted
// plan can show inflated terminal wealth), then the objective's own order, then the shared secondary
// chain above. Pure.
function rankRowsByObjective(rows, objKey, rate = 0) {
    const obj = OPTIMIZER_OBJECTIVES[objKey] || OPTIMIZER_OBJECTIVES.taxflex;
    const chain = obj.tiebreak || OPT_TIEBREAK_DEFAULT;
    const succ = rows.filter(r => r.totals && r.totals.success);
    const fail = rows.filter(r => !(r.totals && r.totals.success));
    let orderedSucc;
    if (obj.rank) {
        // A custom ranker carries its own tie handling, so the chain is not imposed on it here:
        // `taxflex` runs a two-stage sort and a blanket re-sort would undo the thing that makes it
        // custom. It is the only one left. `earliestbe` was the other until it moved to a metric
        // plus a named chain, which is what makes its tie keys past the first one work at all.
        orderedSucc = obj.rank(succ, rate);
    } else {
        const sign = obj.dir === 'asc' ? 1 : -1;
        orderedSucc = [...succ].sort((a, b) =>
            (sign * (obj.metric(a, rate) - obj.metric(b, rate))) || compareByTiebreakChain(a, b, rate, chain));
    }
    // Failed rows are ordered too. They all rank below every successful row, but among themselves
    // the same argument applies: array order is not a ranking.
    return [...orderedSucc, ...[...fail].sort((a, b) => compareByTiebreakChain(a, b, rate, chain))];
}

// True when BOTH people are already on Medicare when the plan opens, which is when an ACA income
// cap stops meaning anything: `yr.acaLapsed` is then true in every year, the engine runs
// Proportional 0% throughout, and an ACA label describes nothing the row did. It gates the ACA
// family out of the Optimizer's sweep and flags the rows that reach the table anyway (a plan loaded
// from a URL, or the CURRENT PLAN row) as untenable.
//
// Do NOT reintroduce an OR-sibling that declares a row untenable as soon as ONE spouse is on
// Medicare: a 66/62 couple has real ACA years, and breach years are MEASURED through
// `totals.acaBreachYears` rather than assumed away on day one.

// THE PLAN'S FIRST YEAR, and there is exactly one definition of it.
//
// `startAge` is the user's real-world age, so the year they ARE that age is birthyear + startAge -
// but a simulation cannot start in the past, so that is CLAMPED to the current year, the same way
// `getInputs` clamps it when building `startInYear`, which is what the engine runs on. Re-deriving
// the year without the clamp answers about a year the plan does not start in.
//
// The clamp can only move the year forward, so the ages at start can only rise, so "both on
// Medicare" can only become more true. A change here that produces a flip in the other direction is
// a bug in the change.
//
// `currentYear` is a parameter rather than a `new Date()` call so this stays pure and a test can pin
// a year. Callers in the app omit it.
/**
 * The Retirement Start field takes an AGE or a CALENDAR YEAR, by the same rule Stop conversions after
 * uses: 1000 or more is a year, anything smaller is an age. Returns the AGE, or 0 when the value is
 * blank or cannot be resolved - and 0 already means "start this year" to planFirstYear.
 *
 * Typing 2025 used to be taken as an age. The plan's first year became birth year + 2025, about 3985,
 * and simulate() threw on its first balance lookup. A year is arguably the clearer thing to type, so
 * both are accepted rather than one being refused. A year earlier than the birth year is not a
 * negative age; it resolves to 0 like any other value that cannot be read.
 */
function resolveStartAge(value, by1) {
    const v = +value;
    if (!Number.isFinite(v) || v <= 0) return 0;
    if (v >= 1000) return (+by1 > 0) ? Math.max(0, v - +by1) : 0;
    return v;
}

// Resolves its own argument, so a caller holding the raw field value - a year - still gets the right
// first year. Every consumer of the start goes through here, which is why the fix belongs here.
function planFirstYear(by1, startAge, currentYear = new Date().getFullYear()) {
    const age = resolveStartAge(startAge, by1);
    const computed = age > 0 ? by1 + age : currentYear;
    return Math.max(computed, currentYear);
}

function bothOnMedicareAtStart(by1, startAge, hasSpouse, by2, currentYear = new Date().getFullYear()) {
    if (!by1 || !startAge) return false;
    const startYear  = planFirstYear(by1, startAge, currentYear);
    const medAge     = TAXData.IRMAA.ELIGIBILITY_AGE;
    // Both ages come from the START YEAR, not from startAge. `startAge >= medAge` was the same
    // unclamped assumption in a second place: it asks whether the age they TYPED reaches Medicare,
    // where the question is whether they have reached it by the year the plan begins.
    const p1Medicare = (startYear - by1) >= medAge;
    const p2Medicare = hasSpouse && by2 > 0 && (startYear - by2) >= medAge;
    return hasSpouse ? (p1Medicare && p2Medicare) : p1Medicare;
}

// Phase 23: find the extraConversionAmount (flat annual $) that maximizes a given metric for
// a fixed strategy. Sweeps from $0 to totalIRA in $25k steps; returns best amount found.
// metric: 'finalNW' (default), 'spend' (max spendable), 'minTax' (min lifetime taxes),
//   'baselineScore' (PF11: real-dollar after-tax NW + weighted spendable -- pass opts.futureIRARate
//   as the shared cross-strategy rate). baseInputs: inputs with a fixed strategy already set;
//   strategyOverrides layered on top. opts: { futureIRARate?, spendableWeight? } (baselineScore only).
function optimizeConversionAmount(baseInputs, strategyOverrides = {}, metric = 'finalNW', opts = {}) {
    const totalIRA = (baseInputs.IRA1 || 0) + (baseInputs.IRA2 || 0);
    if (totalIRA <= 0) return { optConv: 0, optResult: null };

    const STEP = OPTIMIZER_GRIDS.convStep;
    let bestScore = -Infinity, bestConv = 0, bestResult = null;

    const score = (res) => {
        if (metric === 'spend')   return res.totals.spend;
        if (metric === 'minTax')  return -res.totals.tax;
        if (metric === 'baselineScore') {
            // Fallback to the per-run rate only defends against a missing opts; the sole production
            // caller passes the shared rate. See baselineScoreOf's warning about per-run rates.
            return baselineScoreOf(res, opts.futureIRARate ?? res.totals.futureIRARate ?? 0,
                                   opts.spendableWeight ?? SPENDABLE_WEIGHT);
        }
        return res.finalNW; // default: finalNW
    };

    for (let conv = 0; conv <= totalIRA + STEP; conv += STEP) {
        const c = Math.min(conv, totalIRA);
        const res = simulate({ ...baseInputs, ...strategyOverrides, extraConversionAmount: c });
        // Guyton-Klinger can "afford" almost any conversion amount by continuously slashing
        // future spend via its own guardrails (finalNW rewards the under-spending, not the
        // conversion) -- same runaway-optimization failure mode gkSpendStable already guards
        // against for optimizeSpend/optimizeSpendDown. No-op when Guardrails are off.
        //
        // P127f (was P126f). Converting NOTHING is always admissible: the floor is a guard against
        // conversions the rule only affords by cutting, and $0 converts nothing. A floor that
        // rejected it forced a pick among the positive amounts, and on `ira-heavy-couple` under Fill
        // Bracket 24% that pick was $25,000/yr - $96,275 less end wealth and $7,445 less spent than $0.
        if (c === 0 || gkSpendStable(res, strategyOverrides, baseInputs)) {
            const s = score(res);
            if (s > bestScore) { bestScore = s; bestConv = c; bestResult = res; }
        }
        if (c >= totalIRA) break;
    }
    return { optConv: bestConv, optResult: bestResult };
}

// Does ANY conversion amount beat converting nothing, at one assumed future/heirs tax rate?
//
// Uses the SAME $25k grid as optimizeConversionAmount, exiting on the first amount that improves
// on $0. A coarser probe was tried first and rejected: at the threshold the winning amount is
// specific and the gain is marginal, so a grid of 8 points across the IRA missed real thresholds
// entirely (it reported "never pays" for the default scenario, where the $25k sweep finds 63%, and
// overstated the low-spend threshold as 25% against a true 15%). Both errors overstate the rate
// conversions need, which would wrongly talk a user out of a conversion that does pay.
//
// gkSpendStable is applied for the same reason optimizeConversionAmount applies it -- without it a
// Guyton-Klinger plan "affords" any conversion by starving future spend via its own guardrails --
// and, as there (P127f), never to $0, which is the comparison and not a candidate.
function _conversionHelpsAtRate(baseInputs, strategyOverrides, rate, spendableWeight) {
    const totalIRA = (baseInputs.IRA1 || 0) + (baseInputs.IRA2 || 0);
    if (totalIRA <= 0) return false;
    const scoreOf = (c) => {
        const res = simulate({ ...baseInputs, ...strategyOverrides, extraConversionAmount: c });
        if (c > 0 && !gkSpendStable(res, strategyOverrides, baseInputs)) return null;
        return baselineScoreOf(res, rate, spendableWeight);
    };
    const baseScore = scoreOf(0);
    const STEP = OPTIMIZER_GRIDS.convStep;
    for (let c = STEP; c <= totalIRA; c += STEP) {
        const s = scoreOf(Math.min(c, totalIRA));
        if (s != null && s > baseScore) return true;   // early exit: one winner is enough
    }
    return false;
}

// The lowest future/heirs tax rate at which converting more starts to improve this plan -- the
// number that turns "converting doesn't help" from a dead end into a testable assumption.
//
// Binary search is safe here ONLY because the predicate was verified monotonic in the rate first
// (measured across default / low-spend / large-IRA / reserve-on / high-growth scenarios at 2.5pp
// steps: once conversions start paying they never stop as the rate rises). This is the same
// hazard that forced bestConversionStopYear to scan linearly -- nominalTaxRate is a bracket STEP
// function, so monotonicity along a new axis must be measured, never assumed. If a future change
// makes this non-monotonic the search silently returns the wrong threshold, so the test suite
// pins the monotonicity property directly: `_conversionHelpsAtRate` is exported for that sweep,
// which is the only thing outside this file that reads it.
//
// Returns { rate, optConv, gain } with optConv/gain refined by the real $25k sweep at the found
// rate, or null when no rate up to maxRate makes conversions worthwhile (itself a real finding).
function breakEvenHeirsRate(baseInputs, strategyOverrides = {}, opts = {}) {
    const minRate    = opts.minRate ?? BREAK_EVEN_SEARCH.minRate;
    const maxRate    = opts.maxRate ?? BREAK_EVEN_SEARCH.maxRate;
    const resolution = opts.resolution ?? BREAK_EVEN_SEARCH.resolution;
    const weight     = opts.spendableWeight ?? SPENDABLE_WEIGHT;
    const helps = (r) => _conversionHelpsAtRate(baseInputs, strategyOverrides, r, weight);

    if (!helps(maxRate)) return null;          // never pays, even at an implausible rate
    let lo = minRate, hi = maxRate;
    if (helps(lo)) {
        hi = lo;                               // already worth it at the lowest rate considered
    } else {
        while (hi - lo > resolution) {
            const mid = (lo + hi) / 2;
            if (helps(mid)) hi = mid; else lo = mid;
        }
    }
    // Snap to the reporting resolution, then re-check with the real sweep. Rounding can land a
    // hair BELOW the true threshold, which would print a rate alongside a $0 conversion; nudge up
    // one step in that case so the reported rate and amount always agree.
    const snap = (r) => +(Math.round(r / resolution) * resolution).toFixed(6);
    let rate = snap(hi);
    const sweepAt = (r) => optimizeConversionAmount(baseInputs, strategyOverrides, 'baselineScore',
                                                    { futureIRARate: r, spendableWeight: weight });
    let swept = sweepAt(rate);
    if (swept.optConv === 0 && rate + resolution <= maxRate) {
        rate = snap(rate + resolution);
        swept = sweepAt(rate);
    }
    if (swept.optConv === 0) return null;
    const at = (c) => baselineScoreOf(simulate({ ...baseInputs, ...strategyOverrides,
                                                 extraConversionAmount: c }), rate, weight);
    return { rate, optConv: swept.optConv, gain: at(swept.optConv) - at(0) };
}

// Find a TIME-LIMITED conversion: an amount converted for the first N years and then stopped.
//
// optimizeConversionAmount only ever tests a flat amount applied for the whole plan, so a plan
// whose conversions pay early and lose later can only answer "convert nothing" -- the shape it
// wants is inexpressible. Measured on the default scenario, where the flat sweep finds $0 for
// every candidate: converting $225,000/yr and stopping after 4 years gains $9,906. That is the
// reported "found none where converting more improves the result" turning into a real answer.
//
// Cost is why this is coarse-then-refine and why the caller only invokes it when the flat sweep
// already came back empty: an exhaustive amount x cutoff grid measured 2.4s for FOUR candidates.
// Coarse amounts across the IRA x every cutoff, then a $25k refinement around the winner, brings a
// full 12-candidate pool to roughly a second. Scored on baselineScore with the caller's shared
// rate so the result is directly comparable to the flat sweep it is standing in for.
function bestTimeLimitedConversion(baseInputs, strategyOverrides = {}, opts = {}) {
    const totalIRA = (baseInputs.IRA1 || 0) + (baseInputs.IRA2 || 0);
    if (totalIRA <= 0) return null;
    const rate   = opts.futureIRARate ?? 0;
    const weight = opts.spendableWeight ?? SPENDABLE_WEIGHT;
    const coarse = opts.coarseSteps ?? BREAK_EVEN_SEARCH.coarseSteps;

    const probe = simulate({ ...baseInputs, ...strategyOverrides, extraConversionAmount: 0 });
    const n = probe.log.length;
    if (!n) return null;
    const startYear = probe.log[0].year;

    // Scored through convEndYear/convEndMode -- the SAME representation the sidebar holds -- so a ⇌
    // row and the plan the user gets when they click it are the same plan by construction (the PF8
    // failure mode, where the optimizer and the single-scenario tab silently scored two different
    // plans under one label). A per-year [amount x cut, then 0] array is now numerically equivalent
    // (_extraConvAmountFor made the year-0 timing trigger read the scheduled conversion instead of
    // the raw field); the loadable form is still the one to score, since it needs no translation.
    const scoreAt = (amount, cut) => {
        const res = simulate({ ...baseInputs, ...strategyOverrides,
                               extraConversionAmount: amount,
                               convEndYear: cut >= n ? undefined : startYear + cut - 1,
                               convEndMode: 'extra' });
        // Same runaway guard the flat sweep uses: without it Guyton-Klinger "affords" any
        // conversion by cutting future spend through its own guardrails.
        if (!gkSpendStable(res, strategyOverrides, baseInputs)) return null;
        return baselineScoreOf(res, rate, weight);
    };

    const zero = baselineScoreOf(probe, rate, weight);
    let best = { gain: 0, amount: 0, cut: 0 };
    const consider = (amount, cut) => {
        if (amount <= 0 || cut < 1 || cut > n) return;
        const s = scoreAt(amount, cut);
        if (s != null && s - zero > best.gain) best = { gain: s - zero, amount, cut };
    };

    // Fractions of the IRA to probe, deliberately dense at the LOW end. An evenly-spaced grid was
    // tried first and missed every real winner: on the default scenario the paying amounts are
    // $225k-$250k out of a $1.4M IRA (~16%), which sits below the first sample of an even 4-step
    // grid, so the search reported "nothing" where an exhaustive grid found $9,906.
    const FRACTIONS = [1/16, 1/8, 3/16, 1/4, 3/8, 1/2, 3/4, 1];
    const cutStride = n > 12 ? 2 : 1;   // coarse cutoff pass; refined around the winner below
    for (const f of FRACTIONS) {
        const amount = Math.round(totalIRA * f);
        for (let cut = 1; cut <= n; cut += cutStride) consider(amount, cut);
        consider(amount, n);
    }
    if (best.gain <= 0) return null;

    // Refine on the real $25k grid around the winner, re-testing neighboring cutoffs since the
    // best cutoff shifts as the amount moves.
    const span = Math.max(OPTIMIZER_GRIDS.convStep, Math.round(totalIRA * OPTIMIZER_GRIDS.convRefineFraction));
    const coarseBest = { ...best };
    const lo = Math.max(OPTIMIZER_GRIDS.convStep, coarseBest.amount - span);
    const hi = Math.min(totalIRA, coarseBest.amount + span);
    for (let a = Math.ceil(lo / OPTIMIZER_GRIDS.convStep) * OPTIMIZER_GRIDS.convStep; a <= hi; a += OPTIMIZER_GRIDS.convStep) {
        for (let cut = Math.max(1, coarseBest.cut - cutStride); cut <= Math.min(n, coarseBest.cut + cutStride); cut++) {
            consider(a, cut);
        }
    }
    return {
        amount: best.amount,
        stopIndex: best.cut,
        // null when conversions run to the end of the plan: there is no "stop year" to report.
        stopYearCalendar: best.cut >= n ? null : startYear + best.cut - 1,
        gain: best.gain
    };
}

// Lowest break-even heirs rate across a set of candidate strategies -- the one number the
// "converting doesn't help" banner needs ("conversions start paying above X%"), since the
// best-SCORING strategy is often not the one most willing to convert (on the default scenario the
// top-ranked Guyton-Klinger row never pays at any rate, while another pool member pays at 48%).
//
// Cost control, measured: searching every candidate independently took 1.3s on the default
// scenario and 3.3s at a $3.3M IRA, past this project's 2.5s budget. The prune that fixes it
// without changing the answer: once some candidate yields a threshold T, later candidates only get
// searched if they beat T -- one predicate call at T minus one step, instead of a full binary
// search. Candidates are visited largest-terminal-IRA first only as a heuristic to land a low T
// early, which prunes the rest hardest.
//
// Deliberately does NOT skip candidates that end with a drained IRA. That filter was tried and it
// silently lost the right answer (a $3.3M scenario reported 25% against a true 5%): a plan that
// spends its IRA down still benefits from converting EARLIER, since that moves the growth into the
// Roth rather than avoiding a terminal tax bill. "No IRA left at the end" does not mean "no
// conversion opportunity."
function lowestBreakEvenHeirsRate(baseInputs, candidates = [], opts = {}) {
    const resolution = opts.resolution ?? BREAK_EVEN_SEARCH.resolution;
    const weight = opts.spendableWeight ?? SPENDABLE_WEIGHT;
    const usable = [...candidates].sort((a, b) => (b.terminalIRA ?? 0) - (a.terminalIRA ?? 0));

    let best = null;
    for (const c of usable) {
        if (best && !_conversionHelpsAtRate(baseInputs, c.overrides, best.rate - resolution, weight)) continue;
        const r = breakEvenHeirsRate(baseInputs, c.overrides,
                                     { ...opts, maxRate: best ? best.rate : opts.maxRate });
        if (r && (!best || r.rate < best.rate)) best = { ...r, overrides: c.overrides, label: c.label };
    }
    return best;
}

// ── Ordered account sequences ────────────────────────────────────────────────────────────────────────
// The six account sequences the Ordered strategy offers. ONE list, shared by both sweeps and by
// the sidebar dropdown, in the order the dropdown lists them - so a sequence a user can pick is
// always a sequence the sweeps score, and vice versa.
//
// Four accounts permute 24 ways. These six are the ones that ever came out ahead in the P30d
// sweep (retired GAPFILL_SPLIT report, sections 10 and 15), ordered by how often each was
// the best of all 24 and, on a tie, by how much was at stake when it won. CBRI and CIBR win most
// and were not offered at all before v11.163F. RIBC and BIRC won nothing anywhere in that grid
// and are kept because they are the Roth-first and brokerage-first stress tests they were added
// for, not because the sweep argues for them.
const ORDERED_SEQS = ['CBRI', 'CBIR', 'CIBR', 'BCIR', 'RIBC', 'BIRC'];


// ── Strategy enumeration ──────────────────────────────────────────────────────────────────────
// The two sweeps do NOT sweep the same space, and the difference is deliberate. It is declared here
// as two pinned grids rather than left to drift between an inline block in the UI and this file.
// `bracket` is absent from both because its ladder is read from TAXData at call time.
//
// Monte Carlo is the narrower of the two: no IRMAA-ceiling family, no ACA family, and IRA Draw stops
// at 10% where the Optimizer runs to 20%. MC multiplies its row count by numPaths, so an arm costs
// it far more than it costs a single-pass table.

// The shipped Fixed Split grid: four fixed account-weight vectors, [IRA, Brokerage, Cash, Roth] in
// tenths. Each beat the shipped Proportional default at the MEDIAN in all three Monte Carlo return
// models with survival held; the evidence and the full table are in research/CONSTANT_SPLIT.md.
//
// All-Cash and all-Brokerage vectors are deliberately ABSENT: they won few cells and carried two of
// the four worst 10th-percentile floors in the study. A single-path argmax is not a shipping
// criterion here. The grid also needs no per-basis rows - basis moves the SIZE of the gain, not
// which vector wins.
const SPLIT_VECTORS = Object.freeze([
    Object.freeze([0, 9, 1, 0]),
    Object.freeze([0, 7, 1, 2]),
    Object.freeze([0, 6, 2, 2]),
    Object.freeze([5, 0, 4, 1]),
]);
const SPLIT_ACCOUNT_LABELS = ['IRA', 'Brok', 'Cash', 'Roth'];

// "Brok 90 / Cash 10". Percentages of the normalized vector, non-zero accounts only, in account
// order. Plain words rather than a code like B9C1: the research report can afford an abbreviation
// it defines up front, a table cell a user meets once cannot, and the Ordered family's CBIR
// already spends the reader's patience for cryptic parameters once.
function splitVectorLabel(v) {
    const sum = (v || []).reduce((a, b) => a + (b || 0), 0);
    if (!(sum > 0)) return 'balances';
    return v.map((x, i) => [SPLIT_ACCOUNT_LABELS[i], Math.round((x / sum) * 100)])
            .filter(([, pct]) => pct > 0)
            .map(([name, pct]) => name + ' ' + pct)
            .join(' / ');
}
// Sort value for the Param column: the normalized percentages packed most-significant-account
// first, then scaled DOWN so the number stays in the same magnitude as every other family's sort
// value. strategySortKey pads a numeric param to 9 characters, so a value that needed 12 would
// sort after every shorter one and scatter the family - the reason this is /1e6 and not a plain
// integer pack.
function splitVectorSortVal(v) {
    const sum = (v || []).reduce((a, b) => a + (b || 0), 0);
    if (!(sum > 0)) return 0;
    const p = v.map(x => Math.round((x / sum) * 100));
    return (p[0] * 1e6 + p[1] * 1e4 + p[2] * 1e2 + p[3]) / 1e6;
}

// ONE grid. Monte Carlo's Compare All used to sweep a grid of its own, with its own gates, so it ran
// rows the Optimizer never shows and missed rows it does (user, 2026-09-14: "Monte Carlo should be
// checking all the paths the optimizer creates, not more, not less"). Both now enumerate through
// buildStrategyFamilies(base, sweepOptions(base, flags)).
const OPTIMIZER_GRIDS = {
    propwd:   [0, 5, 10, 20, 50],
    // Five steps rather than sixteen, and deliberately. Reduce was 37% of the table on a 16-step grid,
    // for a family whose neighboring years differ by very little, and every row is paid for several
    // times over once the 🗘/🔄 and 🅡 clone passes and the no-conversion baseline have had it. A user
    // sitting between steps still gets their own value as a row: offGridParamFor adds it.
    fixed:    [3, 7, 11, 17, 23],
    // Odd steps, 5 through 13. A user above 13% still gets scored: offGridParamFor adds their own
    // percentage as its own row.
    fixedpct: [5, 7, 9, 11, 13],
    ordered:  ORDERED_SEQS,
    // Reaching a row also needs `splitFamily: true` - the grid holds the data, sweepOptions decides
    // whether anyone sees it.
    split:    SPLIT_VECTORS,
    irmaaTiers:   [0, 1, 2, 3, 4],
    // The conversion search's own grid: the step optimizeConversionAmount walks, and the fraction of
    // the IRA the time-limited refine spans around its coarse winner.
    convStep:            25000,
    convRefineFraction:  1 / 16,
    acaMultiples: [200, 250, 300, 400],
};

const IRMAA_TIER_LABELS = ['Below IRMAA', 'Tier 1 ceil', 'Tier 2 ceil', 'Tier 3 ceil', 'Tier 4 ceil'];
const ACA_LABELS = { 200: '200% FPL', 250: '250% FPL', 300: '300% FPL', 400: '400% FPL' };

// Family-name prefixes for the modifier clones. The 🗘 is red only in the HTML form; MC keeps a
// plain-text twin for its `_label`, which is why `modifier` is returned alongside the decorated
// `strategyLabel` instead of callers having to parse the prefix back off.
const MODIFIER_PREFIX = {
    'ira-first':       '<span style="color:#cc0000">\u{1F5D8}</span> ',
    'brokerage-first': '\u{1F504} ',
    'cash':            '\u{1F4B5} ',
    'rothgap':         '\u{1F161} ',
};
// Marks the one row with Guardrails on that the table has to point out: the user's own plan run with
// the switch the other way around (planRuleTwin). Plain text, so it serves the HTML label and MC's plain
// `_label` alike.
const GUARDRAILS_PREFIX = '\u{1F6E1}️ ';

// Strategies the Roth-clone pass skips. Two, and both are ones `fillSpendingGap` itself excludes:
// Ordered runs the account sequence the user chose, so a clone would be a twin; and a split carries
// Roth inside its own vector, which governs the gap fill as well as the primary draw, so there is no
// Roth position left for a clone to move.
//
// Every other family is in, Guyton-Klinger included: it has no ordering logic of its own - its only
// special handling is the spend adjustment above - so it falls into the same default gap-fill branch
// as everything else. Its gain arrives as delivered SPENDING rather than terminal wealth, because
// the guardrail converts a healthier portfolio into a higher spend, and `baselineScoreOf` counts
// that on purpose.
const ROTH_GAP_EXCLUDED = new Set(['ordered', 'split']);

/**
 * Enumerate the strategy arms of a sweep. Pure: no DOM, no simulate(), no TAXData beyond the federal
 * bracket ladder. Returns one entry per row, in emitted order:
 *
 *   { family, modifier, strategyLabel, paramLabel, paramSortVal, overrides }
 *
 * `family` is undecorated and `modifier` is null | 'ira-first' | 'brokerage-first' | 'cash', so a
 * caller can build its own label shape; `strategyLabel` is the prefixed HTML form the Optimizer table
 * uses. The Optimizer and Monte Carlo pass the same options from sweepOptions(); research harnesses
 * pass their own:
 *   grids            OPTIMIZER_GRIDS
 *   irmaaFamily      sweep the 5 IRMAA ceiling tiers as their own family
 *   acaFamily        sweep the 4 ACA FPL cliffs. The CALLER applies the gate - sweepOptions passes
 *                    bothOnMedicareAtStart, an ACA cap being pointless once both are on Medicare
 *   bracketResetsIRMAATier  write stratIRMAATier:-1 onto Fill Bracket rows, so a sidebar tier
 *                    selection cannot leak into them
 *   markCashFunding  write fundConversionWithCash:false onto every un-cloned row, so a user who
 *                    already has it on gets an A/B against the 💵 clones. Needs cashClones
 *   cashClones       append the 💵 clones. Gate on Cash > 0: at $0 Cash they are identical twins
 *   rothClones       append the 🅡 clones (Roth drawn after Cash instead of last) for every family
 *                    except ROTH_GAP_EXCLUDED, and write rothGapFill:'' onto the un-cloned rows for
 *                    the reason markCashFunding exists. Gate on Roth > 0
 *   offGridLast      put the user's own off-grid parameter last among the base rows, after Ordered
 *                    and Fixed Split, rather than straight after IRA Draw
 *
 * No row sets `spendRule`, so every row follows the user's Guardrails switch. The one row run both
 * ways is the user's own plan, which the callers add from `planRuleTwin`.
 *
 * Pinned against `sweep_golden.js`.
 */
function buildStrategyFamilies(base, opts = {}) {
    const {
        grids = OPTIMIZER_GRIDS,
        irmaaFamily = false,
        acaFamily = false,
        bracketResetsIRMAATier = false,
        markCashFunding = false,
        cashClones = false,
        rothClones = false,
        offGridLast = false,
        // P104b3. Fixed Split is new, so it is opt-IN per caller and nerdknob-gated in the one
        // caller that can gate anything. Default false means no sweep grows a family by accident,
        // and the node suites and harnesses that call this directly keep their existing row counts
        // unless they ask.
        splitFamily = false,
    } = opts;

    const bracketRates = TAXData.FEDERAL.MFJ.brackets.slice(0, -1).map(b => b.r);
    const convOn = true;
    const rows = [];

    const push = (family, paramLabel, paramSortVal, overrides) => {
        let ov = overrides;
        if (markCashFunding) ov = { ...ov, fundConversionWithCash: false };
        if (rothClones)      ov = { ...ov, rothGapFill: '' };
        rows.push({
            family,
            modifier: null,
            strategyLabel: family,
            paramLabel,
            paramSortVal,
            overrides: ov,
        });
    };

    for (const pct of grids.propwd)
        push('Proportional', `${pct}%`, pct,
            { strategy: 'propwd', propWithdraw: pct / 100, convertExcessToRoth: convOn });

    for (const n of grids.fixed)
        push('Reduce', `${n} yrs`, n,
            { strategy: 'fixed', nYears: n, convertExcessToRoth: convOn });

    for (const rate of bracketRates) {
        const ov = { strategy: 'bracket', stratRate: rate };
        if (bracketResetsIRMAATier) ov.stratIRMAATier = -1;
        ov.convertExcessToRoth = convOn;
        push('Fill Bracket', `${Math.round(rate * 100)}%`, rate, ov);
    }

    if (irmaaFamily) {
        // Sort values sit on half-steps so an IRMAA tier never collides with a bracket rate.
        for (const tier of grids.irmaaTiers)
            push('IRMAA Ceil', IRMAA_TIER_LABELS[tier], tier - 0.5,
                { strategy: 'bracket', stratRate: 0, stratIRMAATier: tier, stratACAMultiple: 0,
                  convertExcessToRoth: convOn });
    }

    if (acaFamily) {
        for (const pct of grids.acaMultiples)
            push('ACA Cliff', ACA_LABELS[pct], 50 + pct / 100,
                { strategy: 'aca', stratRate: 0, stratIRMAATier: -1, stratACAMultiple: pct,
                  convertExcessToRoth: convOn });
    }

    for (const pct of grids.fixedpct)
        push('IRA Draw', `${pct}%`, pct,
            { strategy: 'fixedpct', iraWithdrawPct: pct / 100, convertExcessToRoth: convOn });

    // The user's own family parameter when it falls between the standard steps, so their setting
    // appears on the family's curve. Shared rule, but each sweep matches it against ITS OWN grid:
    // IRA Draw 15% is off-grid for Monte Carlo and on-grid for the Optimizer.
    const addOffGrid = () => {
        const offGrid = offGridParamFor(base, { ...grids, bracket: bracketRates });
        if (!offGrid) return;
        // A gated-off family must not reappear through this door. `strategy: 'split'` is reachable
        // from a share link even while no menu offers it, and without this a non-nerdknob user
        // holding such a link would get a Fixed Split row in a table that has no Fixed Split family.
        if (offGrid.overrides.strategy === 'split' && !splitFamily) return;
        const ov = { ...offGrid.overrides, convertExcessToRoth: convOn };
        if (bracketResetsIRMAATier && offGrid.overrides.strategy === 'bracket') ov.stratIRMAATier = -1;
        push(offGrid.family, offGrid.paramLabel, offGrid.paramSortVal, ov);
    };
    if (!offGridLast) addOffGrid();

    for (const seq of grids.ordered)
        push('Ordered', seq, seq, { strategy: 'ordered', orderedSeq: seq, convertExcessToRoth: convOn });

    // Fixed Split. Placed after Ordered because it answers the same question - which account funds
    // the year. 'split' is in ROTH_GAP_EXCLUDED, so the Roth-gap clone pass skips it: Roth is
    // already a weight in the vector, and a Roth-gap clone of a vector that names Roth would be a
    // twin of it.
    if (splitFamily) {
        for (const v of grids.split || [])
            push('Fixed Split', splitVectorLabel(v), splitVectorSortVal(v),
                { strategy: 'split', splitWeights: v.slice(), convertExcessToRoth: convOn });
    }

    if (offGridLast) addOffGrid();

    // Snapshot BEFORE either clone pass. The cyclic clones cover the off-grid row like any other
    // family; the 💵 clones cover the non-cyclic rows only - cyclic reinvests surplus into
    // Brokerage rather than Cash, so there is proportionally less for that mechanism to act on,
    // and crossing all three dimensions would balloon the row count.
    const unmodified = rows.slice();

    for (const r of unmodified) {
        for (const order of ['ira-first', 'brokerage-first'])
            rows.push({
                family: r.family,
                modifier: order,
                strategyLabel: MODIFIER_PREFIX[order] + r.family,
                paramLabel: r.paramLabel,
                paramSortVal: r.paramSortVal,
                overrides: { ...r.overrides, cyclicEnabled: true, cyclicOrder: order },
            });
    }

    if (cashClones) {
        for (const r of unmodified)
            rows.push({
                family: r.family,
                modifier: 'cash',
                strategyLabel: MODIFIER_PREFIX.cash + r.family,
                paramLabel: r.paramLabel,
                paramSortVal: r.paramSortVal,
                overrides: { ...r.overrides, fundConversionWithCash: true },
            });
    }

    if (rothClones) {
        // Only 'fillCashThenRoth' is swept. The other position the engine accepts, Roth ahead of
        // everything, is the dominated one: measured on the v11.162B engine it is the worse of the
        // two in 54 of 60 cells and bottoms out at -$1,136,213 against this one's -$633,605, so
        // sweeping it would spend rows on an arm already known to lose. It stays reachable as an
        // input for the harnesses.
        for (const r of unmodified) {
            if (ROTH_GAP_EXCLUDED.has(r.overrides.strategy)) continue;
            rows.push({
                family: r.family,
                modifier: 'rothgap',
                strategyLabel: MODIFIER_PREFIX.rothgap + r.family,
                paramLabel: r.paramLabel,
                paramSortVal: r.paramSortVal,
                overrides: { ...r.overrides, rothGapFill: ROTH_GAP_FILL.CASH_FIRST },
            });
        }
    }

    return rows;
}

/**
 * The options every user-facing sweep hands buildStrategyFamilies. The Optimizer table and Monte Carlo's
 * Compare All both build from this one call, so they run exactly the same rows. The page-level gates
 * arrive as flags, because this file never reads the DOM: `nerdKnobs` (?nerdknob) and `splitFeature`
 * (?nerdknob=split). `year` pins the ACA age gate for tests; the page leaves it to today.
 */
function sweepOptions(base, { nerdKnobs = false, splitFeature = false, year } = {}) {
    const acaDisabled = bothOnMedicareAtStart(base.birthyear1, base.startAge, !!base.hasSpouse,
        base.hasSpouse ? (base.birthyear2 || 0) : 0, year);
    return {
        grids: OPTIMIZER_GRIDS,
        irmaaFamily: true,
        // ACA cliff arms are swept for everyone; the age gate is the only thing that removes them, and
        // it removes them for a reason about the plan rather than the audience - once both people are on
        // Medicare at start an income cap protects nothing.
        acaFamily: !acaDisabled,
        // A Fill Bracket row must not inherit a sidebar IRMAA-tier selection; the tiers are their own family.
        bracketResetsIRMAATier: true,
        // The nerdknob sweeps cash funding as its own dimension (the 💵 rows), so the rows it clones must
        // read false rather than inherit the sidebar, or a user who already has it on gets two identical
        // arms instead of an A/B.
        markCashFunding: nerdKnobs,
        cashClones: nerdKnobs && base.Cash > 0,
        // The 🅡 arm is swept for everyone - P28 measured it worth up to +$3.56M and found no heuristic
        // that predicts when. Gated on Roth, because with none to draw the clone is a bit-identical twin.
        rothClones: (base.Roth > 0 || base.Roth2 > 0),
        // P104b3. Fixed Split is on probation behind ?nerdknob=split, NOT the plain nerdknob; see
        // SPLIT_FEATURE in optimizer_ui.js for why, and for the removal manifest.
        splitFamily: splitFeature,
        offGridLast: true,
    };
}

// A plan's family and parameter as the sweep names them, for rows the enumeration does not produce:
// the user's own plan, and its Guardrails twin. Pure, and shared by the Optimizer and Monte Carlo.
function describeSelection(p) {
    const pct = v => `${Math.round((v ?? 0) * 100)}%`;
    switch (p.strategy) {
        case 'propwd':   return { family: 'Proportional', paramLabel: pct(p.propWithdraw), paramSortVal: Math.round((p.propWithdraw ?? 0) * 100) };
        case 'fixed':    return { family: 'Reduce', paramLabel: `${p.nYears} yrs`, paramSortVal: p.nYears ?? 0 };
        case 'fixedpct': return { family: 'IRA Draw', paramLabel: pct(p.iraWithdrawPct), paramSortVal: Math.round((p.iraWithdrawPct ?? 0) * 100) };
        case 'ordered':  return { family: 'Ordered', paramLabel: p.orderedSeq ?? 'CBIR', paramSortVal: p.orderedSeq ?? 'CBIR' };
        case 'split':    return { family: 'Fixed Split', paramLabel: splitVectorLabel(p.splitWeights), paramSortVal: splitVectorSortVal(p.splitWeights) };
        case 'aca':      return { family: 'ACA Cliff', paramLabel: `${p.stratACAMultiple ?? 0}% FPL`, paramSortVal: 50 + (p.stratACAMultiple ?? 0) / 100 };
        case 'bracket':
            if ((p.stratACAMultiple ?? 0) > 0)
                return { family: 'ACA Cliff', paramLabel: `${p.stratACAMultiple}% FPL`, paramSortVal: 50 + p.stratACAMultiple / 100 };
            if ((p.stratIRMAATier ?? -1) >= 0)
                return { family: 'IRMAA Ceil', paramLabel: IRMAA_TIER_LABELS[p.stratIRMAATier] ?? `Tier ${p.stratIRMAATier}`, paramSortVal: p.stratIRMAATier - 0.5 };
            return { family: 'Fill Bracket', paramLabel: pct(p.stratRate), paramSortVal: p.stratRate ?? 0 };
        default:         return { family: p.strategy ?? 'Plan', paramLabel: '', paramSortVal: 0 };
    }
}

// P126, user 2026-09-14: "only the current settings get swept both ways". Every swept row follows the
// Guardrails switch, and this is the one extra row - the user's own plan with the switch the other way
// round. Returns that row's rule and labels; each caller runs it with the rest of the plan exactly as it
// runs its own current-plan row, so the Optimizer table and Compare All carry the same extra row.
function planRuleTwin(plan) {
    // A plan with either rule on gets the plan with no rule; a plan with none gets GK-style.
    const on = !_usesSpendRule(plan);
    const d = describeSelection(plan);
    return {
        spendRule: on ? 'gk' : '',
        family: d.family,
        strategyLabel: (on ? GUARDRAILS_PREFIX : '') + d.family,
        paramLabel: [d.paramLabel, on ? 'Guardrails on' : 'Guardrails off'].filter(Boolean).join(', '),
        paramSortVal: d.paramSortVal,
    };
}

// Monte Carlo's Compare All sweep: the Optimizer's rows, as runnable variations. No simulate() and no
// DOM; `flags` are the page gates sweepOptions takes.
function buildVariations(base, flags = {}) {
    const families = buildStrategyFamilies(base, sweepOptions(base, flags));

    // MC's label shape: `_strategyFamily` takes the HTML prefix the builder already applied, while
    // `_label` needs the PLAIN-text twin - it is read into chart legends and CSV, where markup would
    // show through. Keyed by modifier, and a modifier missing from it would lose its prefix silently.
    const PLAIN_PREFIX = { 'ira-first': '\u{1F5D8} ', 'brokerage-first': '\u{1F504} ', 'cash': '\u{1F4B5} ', 'rothgap': '\u{1F161} ' };

    return families.map(f => ({
        ...base,
        // The fields the Optimizer strips from its own sweep base. No enumerated row sets them, so the
        // sidebar's values would otherwise ride along into every row: the Extra Conversion (e.g. left
        // over from loading a ⇌ row) and the conversion stop year. Non-mutating: `base` is the SAME
        // object callers keep as _mcBase / the "Current Plan" stress fallback, which must keep them.
        extraConversionAmount: 0,
        convEndYear: undefined,
        convEndMode: 'all',
        ...f.overrides,
        _label: (f.modifier ? PLAIN_PREFIX[f.modifier] : '')
                + `${f.family} ${f.paramLabel}${f.overrides.convertExcessToRoth ? ' ✓' : ''}`,
        _strategyFamily: f.strategyLabel,
        _paramLabel:     f.paramLabel,
        _paramSortVal:   f.paramSortVal,
    }));
}

/**
 * After-tax terminal net worth for cross-strategy comparison.
 * Values each asset on a comparable footing:
 *   Roth + Cash + returned basis → at face (already after-tax)
 *   Brokerage gains above basis  → discounted by the capital-gains rate
 *   Traditional IRA              → discounted by the expected future liquidation rate
 * Unlike the per-year `totalNetWealth` (which uses the current-year ordinary marginal for the
 * IRA), this uses a single shared `futureIRARate` so deltas between strategies are fair.
 * @param {{ira:number,roth:number,cash:number,brokerage:number,basis:number}} t terminal balances (totals.terminal)
 * @param {number} futureIRARate expected future tax rate on IRA distributions (decimal)
 * @param {number} capGainsRate terminal capital-gains rate (decimal)
 * @returns {number} after-tax net worth
 * @note The capital-gains term is INERT for any `t` produced by simulate(). The final log row is
 *       always a death year, so IRC 1014 has already stepped basis to market there (see the
 *       terminal block in simulate()) and totals.terminal arrives with basis === brokerage,
 *       making max(0, brokerage - basis) exactly zero. The term is kept because this is a
 *       general valuation helper that also serves hand-built inputs in tests and harnesses,
 *       where a genuine unrealized gain can exist. If it ever contributes on a simulate()
 *       result, the step-up did not run - that is what the terminal-basis test guards.
 */
function afterTaxNetWorth(t, futureIRARate, capGainsRate) {
    if (!t) return 0;
    return t.roth + t.cash + t.basis
        + Math.max(0, t.brokerage - t.basis) * (1 - (capGainsRate ?? 0))
        + t.ira * (1 - (futureIRARate ?? 0));
}

/*calculateInflationAdjustedWithdrawal:
* given the parameters, determines the first year withdrawal (subsequent years are
* adjusted for inflation).  At that rate, the asset would reach zero in *years*
*/
function calculateInflationAdjustedWithdrawal(principal, growthRate, inflationRate, years) {
    // Calculate real growth rate
    const realRate = growthRate - inflationRate;

    // Special case: principal is negative.
    if (principal <= 0) return 0;

    // Special case: when real growth is zero
    if (Math.abs(realRate) < EPS_REAL_RATE_ZERO) {
        return principal / years;
    }

    // General case: first year withdrawal in today's dollars
    const denominator = 1 - Math.pow(1 + realRate, -years);
    const firstYearWithdrawal = principal * (realRate / denominator);

    return firstYearWithdrawal;
}

// Compress a numeric string to its shortest equivalent that DisplayHelpers.parseShorthand
// decodes back exactly (k/m/b suffix or scientific). Self-contained - no DisplayHelpers
// dependency - so it is unit-testable in the node vm context. Returns the raw string when
// no shorter form round-trips (e.g. non-round numbers) or for 0 / non-finite input.
function compactNum(numStr) {
    const n = Number(numStr);
    if (!isFinite(n) || n === 0) return String(numStr);
    let best = String(n);
    const tryc = (c) => {
        const s = String(c).toLowerCase(); let m = 1, b = s; const last = s.slice(-1);
        if (last === 'b') { m = 1e9; b = s.slice(0, -1); }
        else if (last === 'm') { m = 1e6; b = s.slice(0, -1); }
        else if (last === 'k') { m = 1e3; b = s.slice(0, -1); }
        if (parseFloat(b) * m === n && c.length < best.length) best = c;
    };
    tryc(String(n / 1e3) + 'k'); tryc(String(n / 1e6) + 'm');
    tryc(String(n / 1e9) + 'b'); tryc(n.toExponential().replace('e+', 'e'));
    return best;
}

// ============================================================================
// SAVED-PLAN SUMMARY - what a scenario records about the run that produced it
// ============================================================================
//
// A saved plan used to record its inputs and nothing else, so it could never report that it had gone
// stale. The changelog for 11.1766 had to warn in prose that "a saved plan or shared link will report
// a different ending Roth and End Wealth than it did before this release", because the tool had no
// way to notice. These four functions are the pure half of fixing that; the DOM half lives in
// optimizer_ui.js, per the no-DOM contract at the top of this file.
//
// summarizeRun exists because there was NO function returning the summary numbers as data. updateStats
// computed them as locals and wrote them straight into innerText, so the tiles and anything else that
// wanted the same figures were two derivations that could drift. updateStats now consumes this.

// The fields a saved summary carries, their labels, and how far each may move before it counts as a
// difference. The table is the single definition: summarizeRun fills it, diffSummaries walks it, and
// the Info panel labels from it, so a field cannot be recorded and then not compared.
const SUMMARY_FIELDS = Object.freeze([
    { key: 'yearsFunded', label: 'Funded Yrs',       eps: 0.5,    kind: 'count' },
    { key: 'taxRate',     label: 'Tax Rate',         eps: 0.0001, kind: 'rate'  },
    { key: 'tax',         label: 'All Taxes',        eps: 1,      kind: 'money' },
    { key: 'rmd',         label: 'All RMDs',         eps: 1,      kind: 'money' },
    { key: 'advisorFees', label: 'Advisor Fees',     eps: 1,      kind: 'money' },
    { key: 'spend',       label: 'Spendable',        eps: 1,      kind: 'money' },
    { key: 'endWealth',   label: 'End Wealth',       eps: 1,      kind: 'money' },
    { key: 'convBEYear',  label: 'Break Even',       eps: 0.5,    kind: 'year'  },
    { key: 'avgWdRate',   label: 'Withdrawal Rate',  eps: 0.0001, kind: 'rate'  },
]);

// Terminal balances are compared too, because "does the IRA survive to the end" is the fact that
// decides what a saved plan can and cannot be used to measure. A household that drains its IRA to
// zero cannot answer an ending-IRA question, and the Info panel should be able to say so.
const SUMMARY_TERMINAL_FIELDS = Object.freeze([
    { key: 'ira',       label: 'Ending IRA',       eps: 1, kind: 'money' },
    { key: 'roth',      label: 'Ending Roth',      eps: 1, kind: 'money' },
    { key: 'brokerage', label: 'Ending Brokerage', eps: 1, kind: 'money' },
    { key: 'cash',      label: 'Ending Cash',      eps: 1, kind: 'money' },
]);

/**
 * Snapshot the numbers a run produced, as plain data.
 *
 * `finalNW` and `finalNWCurrentDollars` are arguments rather than totals fields because simulate()
 * does not return the current-dollar twin - the UI derives it from the last log row's own
 * inflationFactor (optimizer_ui.js), and optimizer rows carry their own copy.
 *
 * `meta` carries what the engine does not know: which strategy and objective were in force. Optional,
 * so a harness can call this with two arguments and still get every number.
 */
function summarizeRun(totals, finalNW, finalNWCurrentDollars, meta = {}) {
    if (!totals) return null;
    const num = v => (Number.isFinite(v) ? v : null);
    return {
        tiles: {
            yearsFunded:              num(totals.yearsfunded),
            yearsTested:              num(totals.yearstested),
            success:                  !!totals.success,
            // The displayed rate is a nominal ratio and is deliberately NOT switched to current
            // dollars anywhere, so there is no twin to record.
            taxRate:                  totals.gross > 0 ? totals.tax / totals.gross : null,
            tax:                      num(totals.tax),
            taxCurrentDollars:        num(totals.taxCurrentDollars),
            rmd:                      num(totals.rmd),
            rmdCurrentDollars:        num(totals.rmdCurrentDollars),
            advisorFees:              num(totals.advisorFees),
            advisorFeesCurrentDollars: num(totals.advisorFeesCurrentDollars),
            spend:                    num(totals.spend),
            spendCurrentDollars:      num(totals.spendCurrentDollars),
            endWealth:                num(finalNW),
            endWealthCurrentDollars:  num(finalNWCurrentDollars ?? finalNW),
            convBEYear:               num(totals.convBEYear),
            avgWdRate:                num(totals.avgWdRate),
        },
        terminal: totals.terminal ? { ...totals.terminal } : null,
        strategy:  meta.strategy  ?? null,
        objective: meta.objective ?? null,
    };
}

/**
 * Compare a recorded summary against a fresh one. Returns only the fields that actually moved.
 *
 * Returns [] when there is nothing to compare - a plan saved before summaries existed, or one saved
 * without ever being run. An empty result means "no difference to report", never "not checked"; the
 * caller distinguishes those by testing whether `saved` exists at all.
 */
function diffSummaries(saved, fresh) {
    if (!saved || !fresh) return [];
    const out = [];
    const walk = (fields, aObj, bObj) => {
        if (!aObj || !bObj) return;
        for (const f of fields) {
            const was = aObj[f.key], now = bObj[f.key];
            if (!Number.isFinite(was) || !Number.isFinite(now)) continue;
            const delta = now - was;
            if (Math.abs(delta) < f.eps) continue;
            out.push({
                key: f.key, label: f.label, kind: f.kind, was, now, delta,
                pct: was !== 0 ? delta / Math.abs(was) : null,
            });
        }
    };
    walk(SUMMARY_FIELDS, saved.tiles, fresh.tiles);
    walk(SUMMARY_TERMINAL_FIELDS, saved.terminal, fresh.terminal);
    return out;
}

// Windows rejects < > : " / \ | ? * and control characters in a filename, and also trailing dots or
// spaces. The blank-name path produces a timestamp containing colons, so the unsanitized
// `${name}.json` this replaces could not be saved on Windows at all.
const _WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Strip a trailing extension. `.replace('.json','')` removed the FIRST match anywhere, so
 *  `my.json.backup.json` became `my.backup.json`. This removes only a real trailing extension. */
function stripFileExtension(name) {
    const s = String(name ?? '');
    return s.replace(/\.[A-Za-z0-9]{1,8}$/, '');
}

function safeExportFilename(name, ext = '.json') {
    // Built without regex escapes on purpose: an earlier version wrote LITERAL control bytes into
    // this source instead of the escape sequence, which made the class a control-character range
    // and turned the file binary to grep. Spaces are legal on Windows and are deliberately kept.
    let s = Array.from(String(name ?? '').trim())
        .filter(ch => ch.charCodeAt(0) >= 32)          // drop control characters
        .join('')
        .replace(/[<>:"/\\|?*]/g, '-')                 // illegal on Windows
        .replace(/[. ]+$/, '')                        // trailing dot or space
        .replace(/-{2,}/g, '-');
    if (!s || _WIN_RESERVED.test(s)) s = s ? s + '-plan' : 'retirement-plan';
    if (s.length > 120) s = s.slice(0, 120);
    return s + ext;
}

/**
 * The two names a plan carries, and which one to offer where.
 *
 * A plan has a NAME (its key in the browser's store) and, if it came from a file, a FILE NAME. They
 * are different things and neither was remembered: Import used the filename as a prompt default and
 * then discarded it. Preference order is the plan's own name, then the file it arrived in.
 */
function planNameDefaults({ lastPlanName, lastFileName } = {}) {
    const plan = String(lastPlanName ?? '').trim();
    const file = stripFileExtension(String(lastFileName ?? '').trim());
    const saveName = plan || file || '';
    return { saveName, exportName: saveName };
}

// ============================================================================
// INITIALIZATION - Call on page load
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { simulate, summarizeRun, diffSummaries, safeExportFilename, stripFileExtension, planNameDefaults, SUMMARY_FIELDS, SUMMARY_TERMINAL_FIELDS, IRA_GOAL_BLIND_STRATEGIES, terminalIRARateFromLog, sustainedBreakEvenYear, compileScheduleFromRun, scheduleOptionsForRun, ADVISOR_FEE_MODES, ADVISOR_FEE_SCOPES, ADVISOR_FEE_BASIS, ADVISOR_FEE_PCT_MAX, inferAdvisorFeeMode, pensionColaCap, CPI_INDEX_FLOOR, optimizeSpend, suggestSustainableSpend, suggestSpendMenu, bengenRate, SUGGEST_BUFFER_YEARS, SUGGEST_RISKY_BUFFER_YEARS, SUGGEST_MIDDLE_KEEP_REAL, getLTCGBracketRoom, nominalRateAtLimit, compactNum, afterTaxNetWorth, afterTaxWealthOfLogRow, computeBETR, diagnoseConvBreakEvenFailure, bestConversionStopYear, optimizeConversionAmount, breakEvenHeirsRate, _conversionHelpsAtRate, lowestBreakEvenHeirsRate, bestTimeLimitedConversion, baselineScoreOf, selectConversionCandidates, SPENDABLE_WEIGHT, OPTIMIZER_OBJECTIVES, rankRowsByObjective, OPT_TIEBREAK_KEYS, OPT_TIEBREAK_DEFAULT, compareByTiebreakChain, afterTaxBucketSpread, OPT_DELTA_COLUMNS, OPT_BASELINE_REQUIRES, OPT_OBJECTIVE_BLURB, OPT_OBJECTIVE_METRIC_COLUMN, OPT_OBJECTIVE_COLUMNS, OPT_COLUMNS_PINNED, OPT_COLUMN_KEYS, bothOnMedicareAtStart, taxCreepFactor, IRMAA_MARGIN_MODES, IRMAA_MARGIN_DEFAULT, irmaaMarginModeOf, irmaaFwdFactor, irmaaMarginDollars, onMedicareAtCharge, planFirstYear, buildVariations, buildStrategyFamilies, sweepOptions, describeSelection, planRuleTwin, OPTIMIZER_GRIDS, ORDERED_SEQS, SPLIT_VECTORS, splitVectorLabel, splitVectorSortVal, ROTH_GAP_EXCLUDED, strategySortKey, sameStrategySelection, selectionOf, STRATEGY_SELECTION_FIELDS, offGridParamFor, resolveOrderedSeq, ssFirstYearFraction, fraMonthsForBirthYear, calculateSurvivorBenefit, growthFactor, applyGrowth, combineGains, applyWithdrawals, calculateWithdrawals, calculateAmortizedWithdrawal, getRMDPercentage, calculateInflationAdjustedWithdrawal, optimizeSpendDown, timingShift, resolveStartAge, gkSpendStable, KNOWN_STRATEGIES, assertKnownStrategy, GK_DEFAULTS, FUNDED_TOLERANCE, minSpendFloor, BASIS_STEP_UP_FALLBACK, BE_NEVER, BREAK_EVEN_SEARCH, STRATEGY, SPEND_RULE, KNOWN_SPEND_RULES, assertKnownSpendRule, ROTH_GAP_FILL, RAIL_PRESETS, GK_CPI_RAISE_CAP, GK_NO_CUT_FINAL_YEARS, portfolioReturnOf, snapshotResume, resumeInputs };
} else if (typeof window !== 'undefined') {
    // Same list, for the browser tier of the test suite. The page does not need it - the engine
    // is a classic script and the page calls these as bare globals. But that reachability is
    // uneven and the unevenness is silent: `function simulate` becomes a property of globalThis,
    // while `const OPTIMIZER_GRIDS` is a global LEXICAL binding and is not.
    // A test reading them off globalThis would get undefined and fail somewhere downstream
    // instead of at the mistake. One namespace object removes the guesswork.
    window.OptimizerCore = { simulate, summarizeRun, diffSummaries, safeExportFilename, stripFileExtension, planNameDefaults, SUMMARY_FIELDS, SUMMARY_TERMINAL_FIELDS, IRA_GOAL_BLIND_STRATEGIES, terminalIRARateFromLog, sustainedBreakEvenYear, compileScheduleFromRun, scheduleOptionsForRun, ADVISOR_FEE_MODES, ADVISOR_FEE_SCOPES, ADVISOR_FEE_BASIS, ADVISOR_FEE_PCT_MAX, inferAdvisorFeeMode, pensionColaCap, CPI_INDEX_FLOOR, optimizeSpend, suggestSustainableSpend, suggestSpendMenu, bengenRate, SUGGEST_BUFFER_YEARS, SUGGEST_RISKY_BUFFER_YEARS, SUGGEST_MIDDLE_KEEP_REAL, getLTCGBracketRoom, nominalRateAtLimit, compactNum, afterTaxNetWorth, afterTaxWealthOfLogRow, computeBETR, diagnoseConvBreakEvenFailure, bestConversionStopYear, optimizeConversionAmount, breakEvenHeirsRate, _conversionHelpsAtRate, lowestBreakEvenHeirsRate, bestTimeLimitedConversion, baselineScoreOf, selectConversionCandidates, SPENDABLE_WEIGHT, OPTIMIZER_OBJECTIVES, rankRowsByObjective, OPT_TIEBREAK_KEYS, OPT_TIEBREAK_DEFAULT, compareByTiebreakChain, afterTaxBucketSpread, OPT_DELTA_COLUMNS, OPT_BASELINE_REQUIRES, OPT_OBJECTIVE_BLURB, OPT_OBJECTIVE_METRIC_COLUMN, OPT_OBJECTIVE_COLUMNS, OPT_COLUMNS_PINNED, OPT_COLUMN_KEYS, bothOnMedicareAtStart, taxCreepFactor, IRMAA_MARGIN_MODES, IRMAA_MARGIN_DEFAULT, irmaaMarginModeOf, irmaaFwdFactor, irmaaMarginDollars, onMedicareAtCharge, planFirstYear, buildVariations, buildStrategyFamilies, sweepOptions, describeSelection, planRuleTwin, OPTIMIZER_GRIDS, ORDERED_SEQS, SPLIT_VECTORS, splitVectorLabel, splitVectorSortVal, ROTH_GAP_EXCLUDED, strategySortKey, sameStrategySelection, selectionOf, STRATEGY_SELECTION_FIELDS, offGridParamFor, resolveOrderedSeq, ssFirstYearFraction, fraMonthsForBirthYear, calculateSurvivorBenefit, growthFactor, applyGrowth, combineGains, applyWithdrawals, calculateWithdrawals, calculateAmortizedWithdrawal, getRMDPercentage, calculateInflationAdjustedWithdrawal, optimizeSpendDown, timingShift, resolveStartAge, gkSpendStable, KNOWN_STRATEGIES, assertKnownStrategy, GK_DEFAULTS, FUNDED_TOLERANCE, minSpendFloor, BASIS_STEP_UP_FALLBACK, BE_NEVER, BREAK_EVEN_SEARCH, STRATEGY, SPEND_RULE, KNOWN_SPEND_RULES, assertKnownSpendRule, ROTH_GAP_FILL, RAIL_PRESETS, GK_CPI_RAISE_CAP, GK_NO_CUT_FINAL_YEARS, portfolioReturnOf, snapshotResume, resumeInputs };
}


