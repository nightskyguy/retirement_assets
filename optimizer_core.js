// ============================================================================
// optimizer_core.js - pure simulation engine for the Retirement Optimizer.
//
// Contract: NO DOM, localStorage, or location access, at load time or runtime.
// Loaded three ways, all as a plain classic script sharing global scope:
//   1. retirement_optimizer.html (before optimizer_ui.js, after taxengine.js)
//   2. montecarlo/worker.js via importScripts (no DOM available there)
//   3. optimizer_core.tests.js via vm.runInContext (no DOM stubs needed)
// Depends on taxengine.js (calculateTaxes, calcIRMAA, TAXData, RMD_TABLE, ...).
//
// Shared globals owned by this file (optimizer_ui.js reads/writes cross-file):
//   STATEname       - set from inputs.STATEname on every simulate() call
//   simulationCount - incremented per simulate(); runOptimizer resets/reads it
//   SPEND_SEARCH_*  - MIN_DELTA is read by the UI spend banner
// ============================================================================
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

// Baseline ranking weight: a dollar the household actually spends outranks a dollar bequeathed
// by 10%. Single source of truth shared by the optimizer table's _baselineScore (optimizer_ui.js)
// and the conversion sweep's 'baselineScore' metric (baselineScoreOf below) so the two cannot drift.
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
            // if (typeof value === 'object' || typeof value === 'function' || 
            //     typeof value === 'boolean') {
            //     continue;
            // }

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
    const startAge = (birthYear >= 1960) ? 75 : 73;
    // IRS uses "age attained during the year" = currentYear - birthYear (no +1).
    const age = currentYear - birthYear;
    if (age < startAge) return 0;
    if (age > 120) return 1 / RMD_TABLE[120];
    return 1 / (RMD_TABLE[age]);
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

// P64a. Property + other local taxes for the SALT itemizing test, in the simulation year's NOMINAL
// dollars. calculateTaxes() has always accepted `propTax` and always computed
// min(stateTax + propTax, saltCap) against the standard deduction correctly - but no caller in this
// engine ever passed it, so SALT was state income tax alone and any household that would itemize was
// charged too much federal tax in every year. Exactly the shape of the obbaOn/saltHigh defect below.
//
// The amount is entered in today's dollars, like spendGoal, and `elapsed` is measured from the real
// current year rather than the plan's first year so a plan that starts in the future is inflated over
// the gap the same way spendGoal is.
//
// Three growth modes, because they are three genuinely different plans and the SALT cap turns the
// difference into a step rather than a smooth curve:
//   'inflation' (default) - tracks the plan's general inflation rate, like every other today's-dollars
//                           input. Uses inputs.inflation, NOT inputs.cpi: cpi here indexes brackets,
//                           IRMAA tiers and COLA, and a property assessment is a household price, not
//                           a statutory threshold.
//   'flat'                - nominal-constant bill, which decays in real terms.
//   'custom'              - an explicit rate, as a FRACTION like every other rate in this file. This is
//                           the California Proposition 13 case (2% assessment cap) and the
//                           reassessment-heavy case, neither of which is general inflation.
function propTaxFor(inputs, currentYear, baseYear) {
    const base = +inputs.propTax || 0;
    if (base <= 0) return 0;                      // the default, and a guaranteed no-op
    const mode = inputs.propTaxGrowthMode || 'inflation';
    const g = mode === 'flat'   ? 0
            : mode === 'custom' ? (+inputs.propTaxGrowthRate || 0)
            :                     (+inputs.inflation || 0);
    return base * Math.pow(1 + g, Math.max(0, currentYear - baseYear));
}

// ── IRMAA targeting: this year's MAGI is judged two years from now ────────────────────────────
// IRMAA charges the premium in year Y against MAGI from year Y + LOOKBACK (LOOKBACK is -2), and
// SSA indexes the thresholds to the PREMIUM year. So any ceiling that caps THIS year's MAGI has to
// aim at the threshold published |LOOKBACK| years from now, not today's. The CHARGE side
// (beginYear's calcIRMAA against magiHistory[-2]) was always right; only the TARGETING side was
// not, and it was wrong in the safe direction - it under-filled every tier by (1+cpi)^2, roughly
// 6% at 3% CPI, so plans left conversion headroom unused rather than breaching a cliff.
//
// irmaaMarginMode is a nerdknob (retirement_optimizer.html) choosing how much safety margin to
// hold back below that projected threshold. Two modes ('halfcpi', 'cpiminus1') express the margin
// by projecting at a SLOWER CPI rather than by subtracting dollars, so they live in the factor
// below; the rest return 0 from irmaaFwdFactor's point of view and get their dollars from
// irmaaMarginDollars(). Every IRMAA-shaped ceiling in this file goes through both.
// Ordered strongest-setback first. `flat1000` was dropped in v11.15cc: it is the wrong SHAPE (a
// fixed dollar setback decays to irrelevance as thresholds inflate) and it saved four to five times
// less surcharge than a rate haircut across 60 historical CPI-U windows. A saved link or scenario
// carrying the retired value falls through to IRMAA_MARGIN_DEFAULT below rather than erroring.
const IRMAA_MARGIN_MODES = ['halfcpi', 'cpiminus1', 'halfstep', 'flat2000', 'none'];

// Named rather than repeated, because it is asserted in the tests, read by the UI when the control
// is hidden, and relied on as the fallback for an unknown value - three places that must not drift.
// Moved from 'halfstep' to 'halfcpi' in v11.15cc: halfstep prevented 5 breaching years of 92 at a
// 1.5-point CPI miss where halfcpi prevented 21, and halfcpi saves surcharge in 59 of the 60
// windows measured, the best of any setting.
const IRMAA_MARGIN_DEFAULT = 'halfcpi';

function irmaaMarginModeOf(inputs) {
    const m = inputs && inputs.irmaaMarginMode;
    return IRMAA_MARGIN_MODES.includes(m) ? m : IRMAA_MARGIN_DEFAULT;
}

// Multiplier that carries a threshold from today's indexing to the premium year that will judge
// this year's MAGI. Returns 1 at cpi = 0, so a zero-inflation run reproduces the old numbers exactly.
// Both haircut modes act on the PROJECTED INCREASE - the full |LOOKBACK|-year growth - rather than
// on the annual rate. One sentence describes both: take half of it, or take one point off it.
//   full       (1+cpi)^2.            3% -> +6.09%
//   halfcpi    half the increase.    3% -> +3.045%
//   cpiminus1  the increase, less one point. 3% -> +5.09%
//
// v11.15cd corrected cpiminus1, which used to subtract the point from the ANNUAL rate and compound
// that: (1.02)^2 = +4.04%. That is a far harsher haircut than "1% less" suggests, and it sat almost
// on top of halfcpi - the two measured as near-duplicates, saving $48.5k and $37.2k of surcharge
// across 60 historical CPI windows. Corrected they separate roughly 2:1 ($48.5k vs $23.8k) and form
// a real ladder. halfcpi was restated the same way in the same release; at 3% CPI that moves it by
// 0.025 points, which is immaterial on its own and buys one consistent description of both.
//
// Clamped at 1 so a low-CPI plan can never aim BELOW today's un-projected threshold - a different
// and unintended thing - and so the cpi = 0 identity stays exact.
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
// on at 63, when nobody is enrolled yet, so pricing the margin off the current enrolment count would
// zero it out at exactly the ages the ceiling first bites.
function onMedicareAtCharge(age1, age2, alive1, alive2) {
    const gate = TAXData.IRMAA.ELIGIBILITY_AGE + TAXData.IRMAA.LOOKBACK;
    return (alive1 && age1 >= gate ? 1 : 0) + (alive2 && age2 >= gate ? 1 : 0);
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
        // Target: drop 2 IRMAA tiers (or escape all surcharges), whichever needs fewer QCDs.
        // Returns the MAGI ceiling of the target tier; 0 = already at no-surcharge level.
        // effCpi, not cpiRate: the MAGI being trimmed here is charged |LOOKBACK| years from now,
        // against the thresholds published for THAT year (see irmaaFwdFactor).
        //
        // THE FULL PROJECTION, AND NO MARGIN - deliberately, and unlike the tier ceiling. The
        // irmaaMarginMode haircuts and setbacks are not applied here at all, which is why this asks
        // irmaaFwdFactor for the 'none' factor rather than the user's.
        //   The margin exists to guard a cliff the plan is deliberately aiming AT. On this arm the
        // plan is already aiming BELOW the threshold, and every dollar of margin is bought with a
        // dollar that leaves the household for charity. Measured across the historical CPI record:
        // the default setting donated $82,764 more to avoid $1,776 of surcharge, about 47 to 1
        // against, and every other setting lost on the same trade. The asymmetry is structural - a
        // surcharge is a few thousand a year while the MAGI needed to clear a threshold is tens of
        // thousands - so no setting could ever pay for itself here.
        //   See .test_harnesses/IRMAA_DEFAULT_RESULTS.md.
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
    if (Math.abs(growthRate) <= 1e-6) {
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

    // Helper function to calculate effective tax rate for an account
    function getEffectiveTaxRate(account, grossWithdrawal) {
        if (account !== 'Brokerage') {
            // For non-brokerage accounts, use the full tax rate
            return taxrates[order.indexOf(account)] ?? 0;
        }

        // For brokerage, only tax the capital gains portion
        const brokerageInfo = calculateBrokerageWithdrawal(
            grossWithdrawal,
            balances.Brokerage,
            balances.BrokerageBasis
        );

        // Effective tax rate = (capital gains / total withdrawal) * tax rate
        const taxRate = taxrates[order.indexOf(account)] ?? 0;
        return grossWithdrawal > 0 ? (brokerageInfo.capitalGains / grossWithdrawal) * taxRate : 0;
    }

    // Helper function to perform a withdrawal from an account
    function performWithdrawal(account, grossWithdrawal, accountIndex) {
        if (grossWithdrawal <= 0.01) return { netWithdrawal: 0, tax: 0 };

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
        if (netRemaining <= 0.01) break;

        const account = order[i];
        const netTarget = netTargets[account];

        if (netTarget <= 0) continue; // Skip zero-weight accounts

        const available = balances[account] ?? 0;
        if (available <= 0.01) continue;

        // We need to solve for grossWithdrawal iteratively for brokerage
        // For simplicity, we'll use an approximation approach
        let grossWithdrawal;

        if (account === 'Brokerage') {
            // Iterative approach to find the right gross withdrawal
            // Start with an estimate
            const taxRate = taxrates[i] ?? 0;
            let estimate = netTarget / (1 - taxRate); // Initial estimate

            // Refine estimate (up to 3 iterations should be enough)
            for (let iter = 0; iter < 3; iter++) {
                const testInfo = calculateBrokerageWithdrawal(estimate, balances.Brokerage, balances.BrokerageBasis);
                const testTax = testInfo.capitalGains * taxRate;
                const testNet = estimate - testTax;

                if (Math.abs(testNet - netTarget) < 0.01) break;

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
    if (netRemaining > 0.01) {
        for (let i = 0; i < order.length; i++) {
            if (netRemaining <= 0.01) break;

            const account = order[i];
            const alreadyWithdrawn = result[account] ?? 0;
            const available = (balances[account] ?? 0) - alreadyWithdrawn;

            if (available <= 0.01) continue;

            // Calculate how much gross we need to get the net we need
            let grossWithdrawal;

            if (account === 'Brokerage') {
                // Iterative approach for brokerage
                const taxRate = taxrates[i];
                let estimate = netRemaining / (1 - taxRate);

                for (let iter = 0; iter < 3; iter++) {
                    const remainingBalance = balances.Brokerage - alreadyWithdrawn;
                    const remainingBasis = balances.BrokerageBasis - (result.BrokerageBasis ?? 0);

                    const testInfo = calculateBrokerageWithdrawal(estimate, remainingBalance, remainingBasis);
                    const testTax = testInfo.capitalGains * taxRate;
                    const testNet = estimate - testTax;

                    if (Math.abs(testNet - netRemaining) < 0.01) break;

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



/// Now allows specification of the number of months. Defaults to 12.
function applyGrowth(balances, growthRates, months = 12) {
    const gains = {}
    let gain = 0;
    const periodRate = months / 12;  // Fraction of year

    for (const key in balances) {
        if (key in growthRates) {
            // Apply proportional growth: balance * (rate * months/12)
            gain = balances[key] * growthRates[key] * periodRate;
            gains[key] = gain;
            balances[key] = Math.max(0, balances[key] + gain);
        }
        // If no matching rate, balance remains unchanged
    }
    return gains;  // Return the amounts gained/lost
}


function sumAccounts(obj, keys = ['IRA', 'IRA1', 'IRA2', 'Roth', 'Brokerage', 'Cash']) {
    return keys.reduce((sum, key) => sum + (obj[key] ?? 0), 0);
}

/////////////////////////////


// ============================================================================
// Social Security Survivor Benefit (SSA formula, FRA derived from birth year)
// ============================================================================

/**
 * Full Retirement Age in months, per the SSA schedule. FRA is 66 for anyone born 1943-1954, then
 * rises two months per birth year through 1959, and is 67 for 1960 and later.
 *
 * This used to be hard-coded at 67 for everyone, which over-states an early-claiming pre-1955
 * decedent's survivor benefit (the deceased's PIA is derived by dividing out an early-claim
 * reduction, and assuming a later FRA makes that reduction look bigger than it was). The app's own
 * default spouse is born in 1952, so the default scenario was affected.
 *
 * Birth years before 1943 are treated as 66. The real schedule steps down to 65 for 1937 and
 * earlier, but anyone in that range is over 89 today and cannot be a plan's starting spouse.
 * @param {number} birthYear
 * @returns {number} FRA expressed in months
 */
function fraMonthsForBirthYear(birthYear) {
    const by = Math.round(+birthYear);
    if (!Number.isFinite(by) || by <= 1954) return 66 * 12;
    if (by >= 1960) return 67 * 12;
    return 66 * 12 + (by - 1954) * 2;
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
 * Not modelled: the mirror case at the other end, where benefits stop the month of death rather
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
    // A single hard-coded 67 for both was wrong for anyone born before 1960 on either side.
    const userFRAMonths   = fraMonthsForBirthYear(userBirthYear   ?? 1960);
    const spouseFRAMonths = fraMonthsForBirthYear(spouseBirthYear ?? 1960);
    const userClaimMonths  = Math.round(userClaimAge  * 12);
    const userDeathMonths  = Math.round(userAgeAtDeath * 12);
    const spouseClaimMonths = Math.round(Math.max(spouseClaimAge, 60) * 12);

    // Step 1: Derive deceased's PIA at FRA from their benefit at claiming age
    let userPIA;
    if (userClaimMonths >= userFRAMonths) {
        const delayedMonths = userClaimMonths - userFRAMonths;
        userPIA = userMonthlyBenefit / (1 + delayedMonths * (0.08 / 12));
    } else {
        const reductionMonths = userFRAMonths - userClaimMonths;
        const reductionFactor = reductionMonths <= 36
            ? reductionMonths * (5 / 9 / 100)
            : (36 * (5 / 9 / 100)) + ((reductionMonths - 36) * (5 / 12 / 100));
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
        // The 28.5% maximum reduction is spread across the survivor's own 60-to-FRA span, so the
        // span shortens with an earlier FRA: 84 months at FRA 67, 72 at FRA 66.
        const totalPossibleEarlyMonths = spouseFRAMonths - 720;
        const earlyMonths = spouseFRAMonths - spouseClaimMonths;
        rawSurvivorBenefit = deceasedBaseline * (1 - (earlyMonths / totalPossibleEarlyMonths) * 0.285);
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

// MAGI ceiling for bracket/minlimit/aca strategies - shared by the normal per-year withdrawal
// sizing branch and Cycle Brokerage's LTCG top-off logic (Item 4), so a brokerage harvest year
// still respects whatever IRMAA-tier/ACA-cliff/bracket ceiling the active strategy targets.
// fedRateCreep/stateRateCreep scale the RATES this function reports (the seeds that drive
// withdrawal ordering) so they match what calculateTaxes() will actually charge. The bracket
// LIMITS are deliberately left alone - creep raises rates, not thresholds.
function computeBracketCeiling(inputs, status, cpiRate, inflation, STATEname, age1, age2, alive1, alive2, IRMAALimit, fedRateCreep = 1, stateRateCreep = 1, medicareRate = 1) {
    let limit, marginalFedTaxRate, marginalStateTaxRate, nominalFedTaxRateAtLimit, nominalStateTaxAtLimit, stateLimit;

    if ((inputs.stratIRMAATier ?? -1) >= 0) {
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
                                                      onMedicareAtCharge(age1, age2, alive1, alive2)) - 1;
        } else {
            // Too young for the tier to mean anything yet, so degrade to the federal bracket holding
            // the same dollar figure. No IRMAA cliff is in play here, so no margin either.
            limit = findUpperLimitByAmount('FEDERAL', status, rawThreshold - 1, cpiRate).limit;
        }
        const fedAtLimit = findUpperLimitByAmount('FEDERAL', status, limit, cpiRate);
        // findUpperLimitByAmount reads the statutory rate straight off the bracket table and never
        // passes through calculateProgressive, so the creep has to be applied here by hand.
        marginalFedTaxRate = fedAtLimit.rate * fedRateCreep;
        nominalFedTaxRateAtLimit = calculateProgressive('FEDERAL', status, limit, inflation, fedRateCreep).cumulative / (limit || 1);
        const stAtLimit = findUpperLimitByAmount(STATEname, status, limit, cpiRate);
        marginalStateTaxRate = stAtLimit.rate * stateRateCreep;
        nominalStateTaxAtLimit = calculateProgressive(STATEname, status, limit, inflation, stateRateCreep).cumulative / (limit || 1);
    } else if ((inputs.stratACAMultiple ?? 0) > 0) {
        // ACA FPL cliff mode: fill MAGI up to a multiple of the Federal Poverty Level.
        // NO AGE TEST HERE, ON PURPOSE. The IRMAA branch above can degrade in place (drop the tier
        // ceiling, keep a federal one); this branch cannot, because every ACA row carries
        // stratRate: 0, so falling through to the federal branch would return the 10% bracket -
        // a TIGHTER ceiling than the cap it was meant to lift. The successor to a lapsed ACA cap
        // is "no ceiling strategy at all", which only a caller can express. Both callers gate on
        // `yr.isACAStrategy` (resolveSpendTarget), which is false once `yr.acaLapsed`. A new caller
        // must do the same or it will re-enforce a cap that ended at Medicare eligibility.
        const FPL_2025 = status === 'MFJ' ? 20440 : 15060;
        limit = Math.round(FPL_2025 * inputs.stratACAMultiple / 100 * cpiRate * (1 + inputs.cpi)) - 1;
        const fedAtLimit = findUpperLimitByAmount('FEDERAL', status, limit, cpiRate);
        marginalFedTaxRate = fedAtLimit.rate * fedRateCreep;
        nominalFedTaxRateAtLimit = calculateProgressive('FEDERAL', status, limit, inflation, fedRateCreep).cumulative / (limit || 1);
        const stAtLimit = findUpperLimitByAmount(STATEname, status, limit, cpiRate);
        marginalStateTaxRate = stAtLimit.rate * stateRateCreep;
        nominalStateTaxAtLimit = calculateProgressive(STATEname, status, limit, inflation, stateRateCreep).cumulative / (limit || 1);
    } else {
        // Federal bracket ceiling mode (original logic)
        // stratRate names a bracket ("fill the 22% bracket"), which is a threshold concept - the
        // lookup stays on statutory rates so the ceiling doesn't move when rates creep.
        let fedLimit = findLimitByRate('FEDERAL', status, inputs.stratRate, cpiRate);
        limit = fedLimit.limit;
        let fedTaxAtLimit = calculateProgressive('FEDERAL', status, limit, inflation, fedRateCreep);
        nominalFedTaxRateAtLimit = fedTaxAtLimit.cumulative / limit;
        marginalFedTaxRate = fedLimit.rate * fedRateCreep;

        let stLimit = findUpperLimitByAmount(STATEname, status, fedLimit.limit, cpiRate);
        marginalStateTaxRate = stLimit.rate * stateRateCreep;
        stateLimit = stLimit.limit;
        nominalStateTaxAtLimit = calculateProgressive(STATEname, status, limit, inflation, stateRateCreep).cumulative / limit;

        limit = Math.min(stateLimit, limit);

        if (inputs.strategy === 'minlimit') {
            const maxAliveAge = Math.max(alive1 ? age1 : -1, alive2 ? age2 : -1);
            if (maxAliveAge >= TAXData.IRMAA.ELIGIBILITY_AGE + TAXData.IRMAA.LOOKBACK) {
                limit = Math.min(limit, IRMAALimit);
            }
        }
    }

    return { limit, marginalFedTaxRate, marginalStateTaxRate, nominalFedTaxRateAtLimit, nominalStateTaxAtLimit, stateLimit };
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
        // DO NOT write a reframed figure here. `rothConv` is read back out of the log by the
        // NEXT year (beginYear: `log[y-1].rothConv > 1000` picks early-vs-late withdrawal timing),
        // so it is engine state wearing a display field's clothes. Reporting P28's unified figure
        // here flipped IRA Draw 6% from late to early timing and moved 780 money fields. A view
        // that wants the two legs separately has `-iraSpend` and `-iraConvGrossTot` above.
        'rothConv': p.totalConverted,
        'surplusCash': p.surplus.Cash,
        '-surplusToBrokerage': p.surplusToBrokerage ?? 0,   // Cash Reserve overflow reinvested (hidden)
        '-cashBreach': p.cashBreach ? 1 : 0,                // spending forced a draw into the reserve (hidden)
        'cashDividends': p.taxableDividends,
        'cashInterest': p.taxableInterest,
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
        '-capGainsRate': p.tax.capitalGainsRate,
        '-cpiFactor': p.cpiRate,
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
        MAGI: p.tax.MAGI,
        'NominalRate%': p.nominalTaxRate,
        'FedCap': p.tax.fedLimit,
        'StateCap': p.tax.stLimit,
        'SumTaxes': p.cumulativeTaxes,
        'BracketTarget': p.bracketTarget,
        'BracketOverage': p.bracketOverage,
        'ForcedIRA': p.forcedIRA,
        // acaBreach has been passed into this builder since the strict-ACA strategy shipped and was
        // never emitted, so the year a cap actually bound was only ever visible as a total. Leading
        // '-' → no table column, same as '-iraG': this is a diagnostic, and the user-facing signal
        // for a breach year is already the red shortfall row.
        '-acaBreach': p.acaBreach,
        // Balances
        IRA1: p.balance.IRA1,
        IRA2: p.balance.IRA2,
        TotalIRA: p.balance.IRA1 + p.balance.IRA2,
        Cash: p.balance.Cash,
        Roth: p.balance.Roth1 + p.balance.Roth2,
        Roth1: p.balance.Roth1,
        Roth2: p.balance.Roth2,
        Brokerage: p.balance.Brokerage,
        Basis: p.balance.BrokerageBasis,
        totalWealth: p.totalWealth,
        portfolioBalance: p.portfolioBalance,
        guaranteedIncome: p.guaranteedIncome,
        Spendable: p.totalsSpend,
        brokerageG: p.gains.Brokerage,
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
        // Phase 27: inflows/outflows + withdrawal rate
        grossOut: p.grossOutflows,
        netOut: p.netOutflows,
        inflows: p.yearInflows,
        'wdRate%': p.wdRate,
        // Phase 12: per-year withdrawal timing
        timing: (p.useEarly ? 'Early' : 'Late') + '(' + p.timingReason + ')',
        // Phase 22: Guyton-Klinger
        gkSpend: p.strategy === 'gk' ? p.spendGoal : null,
        gkAdj:   p.strategy === 'gk' ? (p.gkAdjLabel || '—') : null,
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
    // IRA Goal is entered in today's dollars (matches the today's-dollar "Suggested IRA Goal"
    // hint and the inflation-indexed tax/IRMAA/ACA thresholds the goal is meant to manage).
    // Inflate it to this year's nominal dollars with cpiRate = (1+cpi)^(gapYears+y), the same
    // factor the bracket/IRMAA/ACA ceilings use, before comparing against nominal IRA balances.
    yr.iraGoalNominal = inputs.iraBaseGoal * sim.cpiRate;
    sim.fixedWithdrawal = calculateAmortizedWithdrawal(balance.IRA1 + balance.IRA2, yr.iraGoalNominal, amortYears, inputs.growth)

    // Phase 12: growthRates moved here (from below withdrawal block) to enable pre-withdrawal growth.
    // Monte Carlo uses per-year return from injected sequence if provided; else constant rate.
    // Cash keeps its own yield regardless (not market-correlated).
    // IRA and Roth always reinvest dividends (tax-deferred / tax-free); effective return = appreciation + dividendRate.
    // Brokerage dividends handled separately below (taxed first, then reinvested or sent to Cash).
    // Bootstrap MC passes per-year sampled inflation; GBM and deterministic use the fixed rate.
    yr.baseReturn    = (inputs.returnSequence != null) ? inputs.returnSequence[y] : inputs.growth;
    yr.yearInflation = inputs.inflationSequence?.[y] ?? inputs.inflation;
    yr.growthRates = computeYearGrowthRates(inputs, y);

    // Withdrawal timing auto-selection (Phase 12): Early (Jan) for conversion years; Late (Dec) otherwise.
    // Early: preMonths=1, postMonths=11. Late: preMonths=11, postMonths=1.
    // Year 0: use strategy flag (bracket or explicit extraConv). Year 1+: prior year's actual conversion amount.
    // Do NOT use convertExcessToRoth as a trigger - it is hardcoded true in the optimizer and does not guarantee a conversion fires.
    // Year 0 must be decided from the conversion SCHEDULED for year 0, never from the raw
    // extraConversionAmount field: the field has two shapes (scalar or per-year array - a
    // multi-element array coerces to NaN, so `> 0` silently reported "no conversion") and three
    // suppression flags can zero it (convEndYear, _cfSuppressConversions,
    // _cfSuppressConversionsFromYear). Reading it through the same accessor applyExtraConversion
    // uses is what makes a per-year array and the equivalent scalar + convEndYear the same plan.
    // Years 1+ read the prior year's realized conversion, which was already shape-safe.
    // 'aca' only implies a conversion while its cap is live: a lapsed ACA year never reaches the
    // ceiling branch that creates conversion room, so it implies one no more than Proportional
    // does. Ages are re-derived here rather than read off yr because resolveHousehold has not run
    // yet - this runs first, and only year 0 consults it. Singles carry birthyear2/die2 = 0
    // (simulate() normalizes them), which makes alive2 false.
    const _a1 = sim.currentYear - sim.birthyear1, _a2 = sim.currentYear - sim.birthyear2;
    const _acaLive = inputs.strategy === 'aca'
        && !acaCapLapsed(_a1, _a2, _a1 <= inputs.die1, _a2 <= inputs.die2);
    const _stratImpliesConversion =
          ((inputs.strategy === 'bracket' || _acaLive) && !_convSuppressedThisYear(inputs, 0))
       || _extraConvAmountFor(inputs, 0) > 0;
    const _prevConv    = y > 0 ? (log[y - 1].rothConv ?? 0) : 0;
    yr._useEarly    = y === 0 ? _stratImpliesConversion : (_prevConv > 1000);
    // Research override (no UI, default off): pin the timing to 'early' or 'late' for every year.
    // Exists because converting flips this rule, so any A/B of convertExcessToRoth silently compares
    // a month-1 withdrawal schedule against a month-11 one on top of the tax difference. Pinning it
    // is the only way to separate "where the surplus lands" from "when the money leaves".
    if (inputs.forceWithdrawTiming === 'early') yr._useEarly = true;
    else if (inputs.forceWithdrawTiming === 'late') yr._useEarly = false;
    const yearTiming   = yr._useEarly ? 'early' : 'late';
    yr.timingReason = yr._useEarly ? 'Conv'  : 'Spend';
    const preMonths    = yearTiming === 'early' ? 1 : 11;
    yr.postMonths   = 12 - preMonths;

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
    yr.propTax  = propTaxFor(inputs, sim.currentYear, sim.propTaxBaseYear);
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
        const stepFraction = TAXData[STATEname]?.BasisStepUp ?? 0.50;
        const unrealizedGain = Math.max(0, balance.Brokerage - balance.BrokerageBasis);
        balance.BrokerageBasis += stepFraction * unrealizedGain;
    }

    // IRMAA is already known since it is based on income from 2 years ago (MAGI lookback),
    // compared against thresholds inflated to THIS payment year (matches SSA indexing).
    // Only spouses actually on Medicare (living, at TAXData.IRMAA.ELIGIBILITY_AGE or older) pay
    // the surcharge - a 61-year-old household pays nothing no matter how large the conversion
    // income.
    const medicareAge = TAXData.IRMAA.ELIGIBILITY_AGE;
    yr.onMedicare = (yr.alive1 && yr.age1 >= medicareAge ? 1 : 0) + (yr.alive2 && yr.age2 >= medicareAge ? 1 : 0);
    yr.acaLapsed = acaCapLapsed(yr.age1, yr.age2, yr.alive1, yr.alive2);
    const magiLookback = balance.magiHistory[balance.magiHistory.length - 2];
    yr.IRMAA = calcIRMAA(magiLookback, yr.status, sim.cpiRate, sim.medicareRate, yr.onMedicare);
    // Tier for display/milestones - same lookback MAGI and same age gate as the charge
    // (the log row used to recompute this AFTER the year's MAGI push, showing the tier a
    // year early).
    yr.IRMAATier = yr.onMedicare > 0 ? getIRMAATier(magiLookback, yr.status, sim.cpiRate) : '-none-';
    // Base Medicare Part B + Part D premiums (informational - tracked, not deducted from
    // spendable; assumed to live inside the spend goal). Grows at CPI + Inflation (user inputs),
    // not CPI alone.
    yr.medicareBase = yr.onMedicare * (TAXData.IRMAA.standardPartB + TAXData.IRMAA.standardPartD) * 12 * sim.medicareRate;

    // Calculate the bracket limits based on: stated limit.
    // let tgtBracketLimit = findLimitByRate('FEDERAL',status,inputs.stratRate)

    // Find federal & state rates and limits by spending goal:
    yr.goalFedBracketLimit = findUpperLimitByAmount('FEDERAL', yr.status, sim.spendGoal, sim.cpiRate)
    yr.goalStateBracketLimit = findUpperLimitByAmount(STATEname, yr.status, sim.spendGoal, sim.cpiRate)
    yr.goalLimit = Math.min(yr.goalFedBracketLimit.limit, yr.goalStateBracketLimit.limit)
    // Forward-projected exactly like the tier ceiling in computeBracketCeiling: `minlimit` uses this
    // to cap THIS year's MAGI, which is charged against the thresholds published |LOOKBACK| years
    // from now.
    //   INERT, AND KNOWN TO BE. findUpperLimitByAmount returns the top of the band CONTAINING its
    // amount, so IRMAABracket.limit >= yr.goalLimit always and the Math.min below always selects
    // goalLimit. This site cannot change a result - it could not before the forward projection
    // either. The projection is kept rather than deleted so that the three IRMAA-targeting sites
    // stay written the same way, and so this one starts behaving correctly the moment a change to
    // the IRMAA ladder or to findUpperLimitByAmount makes it bind. A test pins the inertness
    // (optimizer_core.tests.js, "yr.IRMAALimit is inert"), so that day announces itself.
    const _irmaaEffCpi = sim.cpiRate * irmaaFwdFactor(inputs);
    let IRMAABracket = findUpperLimitByAmount('IRMAA', yr.status, yr.goalLimit, _irmaaEffCpi)
    const _irmaaMargin = irmaaMarginDollars(inputs, IRMAABracket.limit + 1, yr.status, _irmaaEffCpi,
                                            sim.medicareRate, onMedicareAtCharge(yr.age1, yr.age2, yr.alive1, yr.alive2));
    yr.IRMAALimit = Math.min(yr.goalLimit, IRMAABracket.limit - _irmaaMargin);
    yr.totalIncome = 0;
    yr.netIncome = 0;
    yr.capitalGains = 0;
    yr.limit = undefined;   // MAGI ceiling for bracket/minlimit/aca strategies (see computeBracketCeiling)
    yr.stateLimit = undefined;
    yr.bracketTarget = 0;  // ceiling being targeted by bracket/minlimit/aca strategies
    yr.bracketOverage = 0; // how far MAGI exceeded bracketTarget (0 when no bracket strategy)
    yr.forcedIRA = 0;      // soft-cap break: IRA drawn ABOVE the ceiling to fund mandatory spending
    yr.acaBreach = false;  // strict ACA cap could not fund spending → plan untenable this year

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
    let ssReduction = (inputs.ssFailYear > 2000 && sim.currentYear >= inputs.ssFailYear) ? inputs.ssFailPct : 1;
    // Claim-year proration. Ages here are integers, so the first year a person qualifies is the one
    // where age === ceil(claimAge); only that year is scaled, every later year is paid in full.
    const firstYear1 = yr.age1 === Math.ceil(inputs.ss1Age);
    const firstYear2 = yr.age2 === Math.ceil(inputs.ss2Age);
    const ssFrac1 = firstYear1 ? ssFirstYearFraction(inputs.birthmonth1) : 1;
    const ssFrac2 = firstYear2 ? ssFirstYearFraction(inputs.birthmonth2) : 1;
    let potentialS1 = (yr.age1 >= inputs.ss1Age) ? inputs.ss1 * sim.cpiRate * ssReduction * ssFrac1 : 0;
    let potentialS2 = (yr.age2 >= inputs.ss2Age) ? inputs.ss2 * sim.cpiRate * ssReduction * ssFrac2 : 0;
    yr.s1 = yr.alive1 ? potentialS1 : 0;
    yr.s2 = yr.alive2 ? potentialS2 : 0;
    yr.pension = (yr.age1 >= (inputs.pensionStartAge || 0))
        ? inputs.pensionAnnual * (inputs.pensionCola ? sim.inflation : 1)
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
            ? rawSurvivorMonthly * 12 * sim.cpiRate * ssReduction * survivorFrac
            : 0;

        // A single filer reaches this branch too (no spouse means alive2 is false from year one),
        // and for them yr.s1 is simply their OWN benefit -- calculateSurvivorBenefit's higher-of
        // rule returns it when the notional spouse's benefit is zero. Only flag a real widowing,
        // or a single filer's chart would say their survivor benefit had begun.
        yr.isSurvivorSS = birthyear2 > 0;

        // DEATH-YEAR BLEND. `alive` is `age <= die`, so someone is alive through the whole year they
        // reach `die` and the first survivor year is `age === die + 1`. Treat the death as falling
        // in the DECEASED's birth month of that year: the months before it paid both spouses' own
        // benefits, the months after pay the survivor benefit. Paying the survivor amount for all
        // twelve months (what this used to do) understates the year, because the survivor benefit is
        // only the higher of the two, never their sum.
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
    yr.taxableInterest = balance.Cash * inputs.cashYield
    yr.taxableDividends = balance.Brokerage * inputs.dividendRate


    // 3. RMDs and QCDs
    yr.rmd1Pct = getRMDPercentage(sim.currentYear, birthyear1);
    let rmd2Pct = getRMDPercentage(sim.currentYear, birthyear2);
    yr.rmd1 = yr.alive1 ? balance.IRA1 * yr.rmd1Pct || 0 : 0;
    yr.rmd2 = yr.alive2 ? balance.IRA2 * rmd2Pct || 0 : 0;
    yr.rmd1Pct = Math.max(yr.rmd1Pct, rmd2Pct, 0);
    yr.rmd1Pct = Math.max(yr.rmd1Pct, rmd2Pct, 0);

    // QCDs: leave IRA tax-free to charity (age 70.5+). Satisfy RMDs without adding to taxable income/MAGI.
    // Provisional MAGI estimate (IRA withdrawals unknown here; uses pension+RMD+SS+interest/divs).
    const qcdLimit = getQCDLimit(sim.currentYear, inputs.cpi);
    const provisionalMAGI = yr.taxableInc + yr.rmd1 + yr.rmd2 + 0.85 * (yr.s1 + yr.s2) + yr.taxableInterest + yr.taxableDividends;
    const _qcds = computeAnnualQCDs(inputs, balance, sim.currentYear, qcdLimit, provisionalMAGI, sim.cpiRate, yr.alive1, yr.alive2, yr.status);
    yr.qcd1 = _qcds.qcd1;
    yr.qcd2 = _qcds.qcd2;
    yr.totalQCD = _qcds.totalQCD;

    // QCDs leave the IRA first (charitable transfer, excluded from income)
    balance.IRA1 = Math.max(0, balance.IRA1 - yr.qcd1);
    balance.IRA2 = Math.max(0, balance.IRA2 - yr.qcd2);

    // Remaining RMD (after QCD satisfies part/all) is taken as taxable IRA distribution
    const remainingRmd1 = Math.max(0, yr.rmd1 - yr.qcd1);
    const remainingRmd2 = Math.max(0, yr.rmd2 - yr.qcd2);
    balance.IRA1 = Math.max(0, balance.IRA1 - remainingRmd1);
    balance.IRA2 = Math.max(0, balance.IRA2 - remainingRmd2);
    yr.curIRA = Math.max(0, balance.IRA1 + balance.IRA2 - yr.iraGoalNominal);

    yr.totalRMD = yr.rmd1 + yr.rmd2;                                    // required distributions (for stats)
    yr.taxableRMD = remainingRmd1 + remainingRmd2;              // taxable portion (excludes QCDs)
    yr.totalIRAForcedWithdrawals = yr.qcd1 + remainingRmd1 + yr.qcd2 + remainingRmd2; // actual IRA outflow
    yr.taxableInc += yr.taxableRMD;                                       // only non-QCD RMDs are income
    // SPENDABLE income only. Dividends and interest are taxable (they reach calculateTaxes through
    // qualifiedDiv and earnedIncome) but they are NOT counted here, because growAndSettle credits
    // them to a balance. See the totalIncome / spendableIncome note in resolveResidualAndForcedIRA.
    yr.possibleIncome = yr.taxableInc + yr.fixedInc;
}

// Strategy flags, Guyton-Klinger spend adjustment, target spend, marginal-rate seeds, and the working balance snapshot.
function resolveSpendTarget(sim, yr) {
    const { inputs, balance, birthyear1, birthyear2 } = sim;
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
    yr.isBracketStrategy = inputs.strategy === 'bracket' || inputs.strategy === 'minlimit' || inputs.strategy === 'fixedpct' || yr.isACAStrategy;
    yr.isOrderedStrategy = inputs.strategy === 'ordered';

    // Phase 22: Guyton-Klinger dynamic spend adjustment (runs before targetSpend resolution)
    if (inputs.strategy === 'gk') {
        if (y === 0) {
            sim.gkIWR = sim.spendGoal / sim.prevPortfolio;
            sim.gkAdjLabel = '';
        } else {
            const _guard  = inputs.gkGuard  ?? 0.20;
            const _adjP   = inputs.gkAdjPct ?? 0.10;
            const labels  = [];
            // Inflation Rule: skip CPI if prior return negative AND already over IWR
            if (sim.gkPriorReturn < 0 && sim.spendGoal / sim.prevPortfolio > sim.gkIWR) {
                labels.push('no-CPI');
            } else {
                sim.spendGoal *= (1 + yr.yearInflation);
            }
            // Guardrail checks on (possibly inflation-adjusted) spend
            const _cwr = sim.spendGoal / sim.prevPortfolio;
            if (_cwr > sim.gkIWR * (1 + _guard)) {
                sim.spendGoal *= (1 - _adjP);
                labels.push(`−${(_adjP * 100).toFixed(0)}%cap`);
            } else if (_cwr < sim.gkIWR * (1 - _guard)) {
                sim.spendGoal *= (1 + _adjP);
                labels.push(`+${(_adjP * 100).toFixed(0)}%pros`);
            }
            sim.gkAdjLabel = labels.join(' ') || '';
        }
    }

    // GK bypasses goalLimit (bracket ceiling) - spend is dynamically set by GK rules
    const isGKStrategy = inputs.strategy === 'gk';
    yr.targetSpend = (yr.isBracketStrategy || yr.isOrderedStrategy || isGKStrategy) ? sim.spendGoal : Math.min(sim.spendGoal, yr.goalLimit);

    // P38: size the primary draw against income the household can actually SPEND. yr.possibleIncome
    // (:1226) is GROSS - Social Security, pension and the taxable RMD before any tax is paid - so
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
    yr.guaranteedIncomeTax = yr.possibleIncome > 0 ? calculateTaxes({
        filingStatus: yr.status, ages: [yr.age1, yr.age2], birthyears: [birthyear1, birthyear2],
        totalSS: yr.s1 + yr.s2, IRMAAAnnualCost: yr.IRMAA,
        earnedIncome: yr.pension + yr.taxableRMD + yr.taxableInterest, inflation: sim.cpiRate,
        pensionIncome: yr.pension, iraIncome: yr.taxableRMD,
        qualifiedDiv: yr.taxableDividends, capGains: 0, hsaContrib: 0,
        taxExemptInterest: 0, state: STATEname, fedRateCreep: yr.fedRateCreep, stateRateCreep: yr.stateRateCreep, obbaOn: yr.obbaOn, saltHigh: yr.saltHigh, propTax: yr.propTax, taxYear: yr.taxYear
    }).totalTax : 0;

    yr.additionalSpendNeeded = Math.max(0, yr.targetSpend + yr.IRMAA - (yr.possibleIncome - yr.guaranteedIncomeTax));

    // INCOMPLETE: marginalFedTaxRate and marginalStateTaxRate are set to the rates AT the
    // spendGoal bracket, not refined to the next lower IRMAA/state limit. To fix: after
    // finding goalFedBracketLimit, walk down findLimitByRate() to find the ceiling that
    // keeps MAGI below the next IRMAA threshold, then re-derive the state bracket ceiling.
    yr.marginalFedTaxRate = yr.goalFedBracketLimit.rate
    yr.marginalStateTaxRate = yr.goalStateBracketLimit.rate

    //	calculateProgressive('FEDERAL', status, amount, inflation=1, ratecreep=1)

    yr.nominalFedTaxRateAtLimit = 0.14;
    yr.nominalStateTaxAtLimit = 0.07
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

// P51b research input (node-only, no UI, default off): a per-year withdrawal-split override for
// the perfect-foresight oracle. inputs.oracleWithdrawalPlan is an array indexed by plan year;
// each entry is { IRA, Brokerage, Cash, Roth } weights (any non-negative scale — they are
// normalized by calculateWithdrawals). Entry null/undefined or an all-zero entry = no override
// that year (the strategy's own branch runs). Fractions, not dollars: dollar plans desync from
// endogenous taxes/growth; weights are always feasible and reuse the existing target + shortfall
// cascade unchanged. Conversions ride extraConversionAmount[] — no second conversion mechanism.
// Three entry forms (P35n added the last two for the endgame tail bake-off):
//   { IRA, Brokerage, Cash, Roth }  weights, fixed order [IRA,Brokerage,Cash,Roth]
//   { prop: true }                  balance-proportional over [Brokerage,Cash,Roth] with the
//                                   IRA excluded — exactly the P35 PR-5 BALANCED fill spec
//   { seq: ['Cash','Roth',...] }    strict sequence: all from the first account, shortfall
//                                   cascades through the given order (weight [1,0,...]), so
//                                   'IRA' placed last is a true emergency backstop
// Returns a { order, weight } withdrawal-strategy fragment, or null for "no override".
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
    if (_oracleW) {
        yr.withdrawStrategy.order = _oracleW.order;
        yr.withdrawStrategy.weight = _oracleW.weight;
        yr.withdrawStrategy.taxrate = _oracleTaxratesFor(_oracleW.order, sim, yr);
        yr.withdrawals = calculateWithdrawals(yr.curBalances, yr.additionalSpendNeeded, yr.withdrawStrategy);
    } else if (yr.isBrokerageYear) {
        // Brokerage harvest year: draw from Brokerage instead of IRA. Always max out the
        // nerdknob-selected LTCG bracket (0% or 15% top) rather than only drawing to meet
        // spend - this realizes gains + steps up basis even when spend doesn't need it.
        // If spend needs force realization beyond the target, top off whichever LTCG bracket
        // the forced amount actually lands in (capture the room in the bracket you're already
        // paying for) - but never past the active bracket/minlimit/aca strategy's own MAGI
        // ceiling (`limit`), if one is in effect this year.
        //
        // P32c research inputs, BOTH default off / today's behavior, no UI sets either:
        //   cycleHarvestMode  'maxbracket' (default, today) | 'spendonly' - spendonly draws only
        //                     what spending needs, skipping the bracket top-off entirely (Q5).
        //   cycleCoexist      'off' (default, today) | 'bracketfill' - the harvest year ALSO runs
        //                     the family's own IRA sizing (v1: bracket/minlimit/aca + fixedpct).
        //                     The IRA draw is sized FIRST, then the harvest is sized against the
        //                     raised ordinary floor, so the draw's LTCG push-up is respected by
        //                     construction. For MAGI-shaped ceilings (IRMAA tier / ACA / minlimit)
        //                     the room subtracts the planned harvest's realized LTCG via a
        //                     one-iteration two-pass fixed point (pass 1 sizes the harvest at
        //                     IRAwd=0; pass 2 re-sizes it against the final floor). A pure
        //                     federal-bracket-rate ceiling is ordinary-income-shaped - LTCG stacks
        //                     ABOVE it and does not occupy it - so no subtraction there.
        //                     With IRAwd > 0, convertExcessToRoth's cap (netWithdrawals.IRA)
        //                     un-zeroes automatically: harvest years regain surplus conversions
        //                     with no second edit.
        const _baseOrdinaryInc = yr.taxableInc + yr.fixedInc + yr.taxableInterest + yr.taxableDividends;
        const _cycleTargetRate = inputs.cycleLTCGTarget ?? 0.15;   // nerdknob: 0.15=target 0% bracket (default), 0.20=target 15% bracket
        const _harvestMode = inputs.cycleHarvestMode ?? 'maxbracket';
        // Harvest sizing as a function of the ordinary-income floor. With ordFloor =
        // _baseOrdinaryInc this is byte-for-byte today's logic; cycleCoexist calls it with the
        // floor raised by the IRA draw.
        const _sizeHarvest = (ordFloor) => {
            if (_harvestMode === 'spendonly') return yr.additionalSpendNeeded;
            const _targetRoom = getLTCGBracketRoom(ordFloor, yr.status, _cycleTargetRate, sim.cpiRate);
            const _targetNetRoom = _targetRoom * (1 - yr.capGainsPercentage * sim.capitalGainsRate);
            if (yr.additionalSpendNeeded <= _targetNetRoom) {
                // Spend fits inside the target bracket - max it out anyway.
                return _targetNetRoom;
            }
            // Spend forces gains beyond the target bracket. Find which LTCG bracket the
            // forced realization lands in and top off to that bracket's own ceiling.
            const _spendGrossNeeded = yr.additionalSpendNeeded / Math.max(0.01, 1 - yr.capGainsPercentage * sim.capitalGainsRate);
            const _landedRate = getLTCGBracketTopRate(ordFloor, _spendGrossNeeded, yr.status, sim.cpiRate);
            const _ltcgRates = (TAXData.FEDERAL.CAPITAL_GAINS[yr.status]?.brackets ?? []).map(b => b.r);
            const _nextRate = _ltcgRates.find(r => r > _landedRate);
            let _room = (_nextRate !== undefined)
                ? getLTCGBracketRoom(ordFloor, yr.status, _nextRate, sim.cpiRate)
                : _spendGrossNeeded;   // already in the top LTCG bracket - no higher ceiling to top off to
            if (inputs.strategy === 'bracket' || inputs.strategy === 'minlimit' || yr.isACAStrategy) {
                // Don't let the LTCG top-off push total realized income past the active
                // strategy's own ceiling (IRMAA tier / ACA cliff / bracket ceiling). This
                // branch (isBrokerageYear) runs INSTEAD of the ceiling-computing branch this
                // year, so compute it fresh here rather than reading a stale/undefined `limit`.
                // yr.isACAStrategy, not inputs.strategy: a lapsed ACA year has no ceiling to
                // respect, and computeBracketCeiling would still hand back the FPL cap if asked.
                const _ceil = computeBracketCeiling(inputs, yr.status, sim.cpiRate, sim.inflation, STATEname, yr.age1, yr.age2, yr.alive1, yr.alive2, yr.IRMAALimit, yr.fedRateCreep, yr.stateRateCreep, sim.medicareRate).limit;
                _room = Math.min(_room, Math.max(0, _ceil - ordFloor));
            }
            return Math.max(yr.additionalSpendNeeded, _room * (1 - yr.capGainsPercentage * sim.capitalGainsRate));
        };
        // cycleCoexist: size the family's IRA draw FIRST (v1 families only), then harvest above it.
        let _coexistIRAwd = 0;
        if ((inputs.cycleCoexist ?? 'off') === 'bracketfill') {
            if (inputs.strategy === 'bracket' || inputs.strategy === 'minlimit' || yr.isACAStrategy) {
                // Same ceiling call and field assignments as the family's own branch below, so a
                // coexist harvest year looks to downstream passes like the family branch ran.
                ({ limit: yr.limit, marginalFedTaxRate: yr.marginalFedTaxRate, marginalStateTaxRate: yr.marginalStateTaxRate, nominalFedTaxRateAtLimit: yr.nominalFedTaxRateAtLimit, nominalStateTaxAtLimit: yr.nominalStateTaxAtLimit, stateLimit: yr.stateLimit } =
                    computeBracketCeiling(inputs, yr.status, sim.cpiRate, sim.inflation, STATEname, yr.age1, yr.age2, yr.alive1, yr.alive2, yr.IRMAALimit, yr.fedRateCreep, yr.stateRateCreep, sim.medicareRate));
                yr.bracketTarget = yr.limit;
                let _iraRoom = Math.max(0, yr.limit - _baseOrdinaryInc);
                const _magiShaped = (inputs.stratIRMAATier ?? -1) >= 0
                    || inputs.strategy === 'minlimit' || yr.isACAStrategy;
                if (_magiShaped) {
                    // Pass 1 of the fixed point: harvest sized at IRAwd=0; its realized LTCG
                    // occupies MAGI room the IRA draw must not double-book.
                    const _net1 = _sizeHarvest(_baseOrdinaryInc);
                    const _gross1 = _net1 / Math.max(0.01, 1 - yr.capGainsPercentage * sim.capitalGainsRate);
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
            const _grossNeeded = _brokerageNetTarget / Math.max(0.01, 1 - yr.capGainsPercentage * sim.capitalGainsRate);
            if (yr.curBalances.Brokerage < _grossNeeded * 0.5) {
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
        // afterward (applyGrowth is simple proportional: factor = 1 + rate*postMonths/12).
        // Drawing down to exactly the goal would leave goal*(1+growth) at year end - a
        // systematic ~one-year-of-growth overshoot. Instead draw down to goal/postGrowth so
        // the retained balance lands on the goal at year end; the ×0.99 biases it ~1% under
        // (preferred to overshooting). growthRates.IRA carries the actual per-year return,
        // including the Monte Carlo sequence, so this is correct under variable growth too.
        const postGrowthIRA = 1 + (yr.growthRates.IRA ?? 0) * (yr.postMonths / 12);
        const reduceFloor = (yr.iraGoalNominal / postGrowthIRA) * 0.99;
        const curIRAreduce = Math.max(0, balance.IRA1 + balance.IRA2 - reduceFloor);
        let IRAwd = Math.max(0, Math.min(curIRAreduce, amortized))
        yr.withdrawals = { IRA: IRAwd, netAmount: IRAwd }

    // yr.isACAStrategy rather than inputs.strategy === 'aca': once the cap has lapsed this chain
    // must NOT match, so the year falls through fixedpct/propwd/ordered (none of which name 'aca')
    // to the baseline `else` below - Proportional 0%, which is the intended successor.
    } else if (inputs.strategy === 'bracket' || inputs.strategy === 'minlimit' || yr.isACAStrategy) {
        ({ limit: yr.limit, marginalFedTaxRate: yr.marginalFedTaxRate, marginalStateTaxRate: yr.marginalStateTaxRate, nominalFedTaxRateAtLimit: yr.nominalFedTaxRateAtLimit, nominalStateTaxAtLimit: yr.nominalStateTaxAtLimit, stateLimit: yr.stateLimit } =
            computeBracketCeiling(inputs, yr.status, sim.cpiRate, sim.inflation, STATEname, yr.age1, yr.age2, yr.alive1, yr.alive2, yr.IRMAALimit, yr.fedRateCreep, yr.stateRateCreep, sim.medicareRate));

        yr.bracketTarget = yr.limit;

        // Cap IRA draw at the bracket ceiling; any spending shortfall is filled from
        // Cash → Brokerage → Roth in the gap-fill pass below (bracket-strategy path).
        const iRAbracketRoom = Math.max(0, yr.limit - yr.taxableInc - yr.fixedInc - yr.taxableInterest - yr.taxableDividends);
        const IRAwd = Math.min(yr.curIRA, iRAbracketRoom);
        yr.withdrawals = { IRA: IRAwd, netAmount: IRAwd };

    } else if (inputs.strategy === 'fixedpct') {
        // Withdraw a fixed % of the original IRA balance (before RMDs) each year.
        // RMDs already taken count toward the target; any excess beyond RMDs is the
        // additional draw. Spending shortfall fills from Cash → Brokerage → Roth below.
        const pct = inputs.iraWithdrawPct ?? 0.05;
        const originalIRA = balance.IRA1 + balance.IRA2 + yr.totalIRAForcedWithdrawals;
        const targetTotal = originalIRA * pct;
        const IRAwd = Math.max(0, Math.min(yr.curIRA, targetTotal - yr.totalIRAForcedWithdrawals));
        yr.withdrawals = { IRA: IRAwd, netAmount: IRAwd };

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
        // Ordered strategy: all spending handled in gap-fill to avoid surplus distortion.
        // Cash draws in the main block don't reduce possibleIncome, causing overdraw + refund loops.
        yr.withdrawals = {};

    } else {
        /*********************/
        /* BASELINE Strategy */
        /*********************/
        // Withdraw enough proportionately to get to spendGoal - including taxes.
        yr.withdrawStrategy.order = ['IRA', 'Brokerage', 'Cash']
        yr.withdrawStrategy.taxrate = [sim.nominalTaxRate, yr.capGainsPercentage * (sim.capitalGainsRate + yr.nominalStateTaxAtLimit), 0, 0]
        yr.withdrawals = calculateWithdrawals(yr.curBalances, yr.additionalSpendNeeded, yr.withdrawStrategy)

    }
}

// Apply the primary withdrawals, first tax pass, MAGI-history seeding and the year-0 IRMAA retro-correction.
function applyPrimaryAndTaxPass1(sim, yr) {
    const { balance, birthyear1, birthyear2 } = sim;
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


    yr.tax = calculateTaxes({
        filingStatus: yr.status, ages: [yr.age1, yr.age2], birthyears: [birthyear1, birthyear2],
        totalSS: yr.s1 + yr.s2, IRMAAAnnualCost: yr.IRMAA,
        earnedIncome: yr.pension + yr.taxableRMD + yr.netWithdrawals.IRA + yr.taxableInterest, inflation: sim.cpiRate,
        pensionIncome: yr.pension, iraIncome: yr.taxableRMD + yr.netWithdrawals.IRA,
        qualifiedDiv: yr.taxableDividends, capGains: yr.capitalGains, hsaContrib: 0,
        taxExemptInterest: 0, state: STATEname, fedRateCreep: yr.fedRateCreep, stateRateCreep: yr.stateRateCreep, obbaOn: yr.obbaOn, saltHigh: yr.saltHigh, propTax: yr.propTax, taxYear: yr.taxYear
    })
    inspectForErrors(yr.tax)  // See if any numbers look fishy.

    yr.marginalFedTaxRate = yr.tax.federalMarginalRate;
    yr.marginalStateTaxRate = yr.tax.stateMarginalRate;
    sim.capitalGainsRate = yr.tax.capitalGainsRate;

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
    const { inputs, birthyear1, birthyear2 } = sim;
    // 6. Cash Flow Gap
    // taxableInc includes pension, RMDs
    yr.possibleIncome = yr.taxableInc + yr.fixedInc + yr.netWithdrawals.IRA +
        yr.capitalGains + (yr.netWithdrawals.BrokerageBasis ?? 0);

    let netSpendable = yr.possibleIncome - yr.totalTax
    let gap = yr.targetSpend - netSpendable;

    inspectForErrors({ netSpendable: netSpendable, gap: gap, totalTax: yr.totalTax });

    // Move Roth OUT of last place in the gap fill. Shipped at P28f as the "Roth before Brokerage"
    // switch and as a sweep dimension (the 🅡 rows); it was a research input first,
    // and the half of the unified-conversion idea that could actually move money. `ordered` is
    // excluded by explicit instruction: its entire meaning is the account sequence the user picked.
    //
    //   inputs.rothGapFill
    //     (unset)             -- today: Cash, then Brokerage, then Roth as last resort
    //     'fillCashThenRoth'  -- Cash, then ROTH, then Brokerage
    //     'fillRothThenCash'  -- ROTH first, ahead of everything
    //
    // Named for what they control -- where Roth is inserted -- and NOT given Ordered-style letter
    // codes (CRBI / RCBI). Two reasons: today's default is already "CBRI", so a letter code invites
    // reading the wrong mode as the current one; and this input does not set a total ordering at all.
    // The non-bracket branch below draws Brokerage and Cash PROPORTIONALLY (40/60), so there is no
    // full sequence for a four-letter code to name.
    //
    // Two positions, because measurement showed the blunt one is wrong about half the time. Roth pays
    // off only when it displaces a TAXABLE draw (Brokerage, realizing gains). Displacing Cash is a
    // loss: both are tax-free to withdraw, but Roth compounds at the growth rate tax-free while Cash
    // earns cashYield and pays tax on the interest, so spending Roth to preserve Cash keeps the worse
    // asset. Measured on IRA Draw 6%, whose gap fill only ever touched Cash: $58k of substituted
    // withdrawals cost $137,062 of terminal value.
    //
    // Neither position is safe to recommend. Re-measured on the v11.162B engine, 'fillCashThenRoth'
    // ranges from +$470,977 to -$633,605 and is negative in 26 of 60 cells - a two-sided lever, not
    // the near-free win the 2026-07-30 run recorded. P32 letting the third pass draw Brokerage is the
    // likely cause: displacing a Brokerage draw IS this mechanism, so changing when Brokerage is
    // drawn changes both the size and the sign. That is why it ships as a swept dimension rather
    // than a default, and why the harness numbers in P28_RESULTS.md carry a re-run warning.
    // Validated against the known values rather than tested for truthiness: with `|| null` a typo
    // like 'fillCashThenRother' fell through to the Roth-first branch and silently modelled the
    // OTHER mode. Anything unrecognized now means "leave today's behavior alone".
    const _rothPos = (inputs.rothGapFill === 'fillCashThenRoth' || inputs.rothGapFill === 'fillRothThenCash')
        ? inputs.rothGapFill : null;
    const _preDraw = (acct, amt) => {
        if (amt <= 1 || !(yr.curBalances[acct] > 0)) return amt;
        const wd = calculateWithdrawals(yr.curBalances, amt, { order: [acct], weight: [1], taxrate: [0] });
        yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, wd]);
        applyWithdrawals(yr.curBalances, wd);
        return wd.shortfall ?? 0;
    };
    if (gap > 1.00 && _rothPos && !yr.isOrderedStrategy) {
        if (_rothPos === 'fillCashThenRoth') gap = _preDraw('Cash', gap);
        gap = _preDraw('Roth', gap);
    }

    // P51b mirror: the oracle's year weights govern the SECOND pass too, so the plan's split is
    // in force for the whole spending need, not just the primary draw. Phase-2 spill inside
    // calculateWithdrawals (IRA -> Brokerage -> Cash -> Roth) is the shortfall cascade.
    const _oracleWGap = _oracleWithdrawalPlanFor(inputs, yr.y);
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
            // Bracket/IRMAA strategies: supplement spending from Cash first, then Brokerage, then Roth.
            // This keeps supplemental draws out of taxable income as much as possible.
            //
            // P30c research input (no UI, no URL param): `inputs.bracketGapOrder` swaps the first
            // two. This is the OTHER constant nobody chose - the sibling of the default branch's
            // [40, 60], and a bigger one, because this branch serves Fill Bracket, IRMAA Ceiling,
            // ACA Cliff and IRA Draw where the weight reaches only three families.
            //
            // The two accounts are not symmetric, which is why the order is a question rather than a
            // preference. Cash is tax-free to withdraw but earns `cashYield` taxed as ordinary
            // income; Brokerage realizes capital gains on the way out and steps up its own basis.
            // "Keep supplemental draws out of taxable income" argues for Cash first and is what the
            // comment above has always said, but nothing measured it, and P30b found the analogous
            // constant in the other branch was not merely unchosen but wrong.
            //
            // Written as a SEQUENCE rather than nested ifs so the arm is the order of a list. The
            // control path is bit-identical to the ifs it replaces: each account still draws only
            // the shortfall the one before it left, the chain still stops at $1, and Roth is still
            // reached only when both leave something over.
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
            // Default: Brokerage + Cash proportional, then Roth fallback.
            //
            // P30a research input (no UI, no URL param): `inputs.gapFillWeights` replaces the
            // [40, 60]. Nobody chose that 40/60 - it has been a bare literal since the branch was
            // written - and P30 exists to find out whether it is load-bearing at all. The weights
            // are RELATIVE, normalized by calculateWithdrawals, so [1, 1] and [50, 50] are the same
            // split; percentages are used here only because that is how the original read.
            //
            // Validated to a known SHAPE rather than tested for truthiness, for the reason the
            // rothGapFill comment above records: a malformed value must mean "leave today's
            // behavior alone", never "model something else silently". Two finite non-negative
            // numbers with a positive sum - the sum is the one that matters, because a [0, 0] pair
            // would divide by zero in the normalizer and put NaN through every downstream balance.
            //
            // The ENDPOINTS are legal and meaningful: [0, 100] is all-Cash and [100, 0] is
            // all-Brokerage, both of which still spill to the other account through the shortfall
            // cascade rather than stopping short. That is what makes a 0-to-100 sweep a sweep of
            // this policy rather than of two different policies.
            const _gfw = inputs.gapFillWeights;
            const _gfwOK = Array.isArray(_gfw) && _gfw.length === 2
                && _gfw.every(w => Number.isFinite(w) && w >= 0) && (_gfw[0] + _gfw[1]) > 0;
            yr.withdrawStrategy.order = ['Brokerage', 'Cash'];
            yr.withdrawStrategy.weight = _gfwOK ? [_gfw[0], _gfw[1]] : [40, 60];
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

    // Recheck tax calculations due to possible additional withdrawals - and we now
    // have a more accurate income picture.
    yr.capitalGains = Math.max(0, (yr.netWithdrawals.Brokerage ?? 0) - (yr.netWithdrawals.BrokerageBasis ?? 0));


    yr.tax = calculateTaxes({
        filingStatus: yr.status, ages: [yr.age1, yr.age2], birthyears: [birthyear1, birthyear2],
        totalSS: yr.s1 + yr.s2, IRMAAAnnualCost: yr.IRMAA,
        earnedIncome: yr.pension + yr.taxableRMD + yr.netWithdrawals.IRA + yr.taxableInterest, inflation: sim.cpiRate,
        pensionIncome: yr.pension, iraIncome: yr.taxableRMD + yr.netWithdrawals.IRA,
        qualifiedDiv: yr.taxableDividends, capGains: yr.capitalGains, hsaContrib: 0,
        taxExemptInterest: 0, state: STATEname, fedRateCreep: yr.fedRateCreep, stateRateCreep: yr.stateRateCreep, obbaOn: yr.obbaOn, saltHigh: yr.saltHigh, propTax: yr.propTax, taxYear: yr.taxYear
    })
    inspectForErrors(yr.tax)  // See if any numbers look fishy.

    // Now we have the "real tax"
    yr.totalTax = yr.tax.totalTax + yr.IRMAA;
    yr.bracketOverage = yr.bracketTarget > 0 ? Math.max(0, yr.tax.MAGI - yr.bracketTarget) : 0;
    // Update marginal rates so the third pass grosses up correctly at actual bracket.
    yr.marginalFedTaxRate = yr.tax.federalMarginalRate;
    yr.marginalStateTaxRate = yr.tax.stateMarginalRate;
}

// Third tax pass for residual shortfall, soft-cap forced-IRA convergence, and the year's income/overage finalization.
function resolveResidualAndForcedIRA(sim, yr) {
    const { inputs, totals, birthyear1, birthyear2 } = sim;
    // Two inputs, one SHIPPED and one research-only. Both were added by P32c to make the Brokerage
    // exclusions in this function falsifiable rather than asserted; P32d then measured them over
    // 3,960 armed runs and they came out opposite ways, so they ship differently.
    //   thirdPassBrokerage       'bounded' (DEFAULT since P32h) | 'off' | 'unbounded' - allow a
    //                            Brokerage leg in the third pass, drawn AFTER Cash and BEFORE the
    //                            Roth fallback, then re-drawn against whatever residual the
    //                            realized gains re-open. 'bounded' caps the re-draw at the same 6
    //                            iterations the forced-IRA backstop below uses; 'unbounded' raises
    //                            the cap to 200 and records the iterations actually consumed, so a
    //                            real cap-gains spiral shows up as a run that keeps needing passes
    //                            instead of one that converges. 'off' restores the pre-P32h
    //                            behavior and is kept so the measurement stays reproducible.
    //                            Ordered is excluded either way - it runs the user's own sequence
    //                            in this pass.
    //   forcedIRAAllowBrokerage  'off' (DEFAULT, and P32h decided it stays that way) |
    //                            'brokerageFirst' - let the funding backstop spend Brokerage before
    //                            it forces IRA above the ceiling. The theory was sound (forced IRA
    //                            is ordinary income at the marginal rate; a Brokerage dollar may be
    //                            LTCG at 0%) and the measurement refuted it: across the P32d grid
    //                            it won the SAME 9 cells the third-pass arm wins - set-identical -
    //                            while leaving $27,860,186 of spending unfunded against that arm's
    //                            $1,711. It spends Brokerage early and has none left later. Kept as
    //                            a research flag only; do not wire it to any UI.
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
            // HISTORY, kept because the reasoning was plausible and wrong, and deleting it would
            // invite someone to re-derive it. This pass was Cash-only for years, justified as:
            // "adding more Brokerage here creates a cap-gains spiral - more gains -> higher SS
            // taxation -> bigger residual -> repeat". The 2nd-pass gap-fill already grossed up
            // Brokerage; the 3rd pass handles the leftover tax from SS phaseout and NIIT cliffs
            // that the gross-up couldn't predict, and Cash (and Roth as fallback) carry no new cap
            // gains, so they break the cycle.
            //
            // P32d MEASURED the spiral and it does not exist. 3,960 armed runs across 3 basis
            // fractions x 3 states x 2 dividend rates: ZERO capped years, and the 6-iteration and
            // 200-iteration caps produced identical counters everywhere, so no single year ever
            // wanted a 7th pass. The feedback is convergent, as the bounds predict - SS inclusion
            // stops at 85% and LTCG tops out at 20%, so each pass recovers a shrinking fraction.
            // Cost of the old behavior, on the same grid: $372,455 of spending the plan had
            // promised and could not pay, against $1,711 of new unfunded spending from allowing it.
            // Every scenario it rescued was an IRMAA Ceiling (`minlimit`) plan, the case this was
            // pinned on - Brokerage the only money left, and the engine refusing to touch it.
            // See `.test_harnesses/P32_RESULTS.md`, section Q2.
            // P28 flag: only 'fillRothThenCash' changes the third pass. The pass is already Cash then
            // Roth, which IS the 'fillCashThenRoth' order, so that mode leaves it untouched.
            // Neither carries cap gains, so this only picks which tax-free account drains first.
            let _thirdGap = residualGap;
            if (inputs.rothGapFill === 'fillRothThenCash' && yr.curBalances.Roth > 0) {
                const rothFirst3 = calculateWithdrawals(yr.curBalances, _thirdGap,
                    { order: ['Roth'], weight: [1], taxrate: [0] });
                yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, rothFirst3]);
                applyWithdrawals(yr.curBalances, rothFirst3);
                _thirdGap = rothFirst3.shortfall ?? 0;
            }
            const thirdWd = calculateWithdrawals(yr.curBalances, _thirdGap,
                { order: ['Cash'], weight: [1], taxrate: [0] });
            yr.netWithdrawals = accumulateWithdrawals([yr.netWithdrawals, thirdWd]);
            applyWithdrawals(yr.curBalances, thirdWd);
            let _remShort = thirdWd.shortfall ?? 0;
            // P32c arm: Brokerage after Cash, ahead of the Roth fallback. Same gross-up convention
            // as the second-pass gap fill (:1793), so the two passes price a Brokerage dollar alike.
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
        yr.capitalGains = Math.max(0, (yr.netWithdrawals.Brokerage ?? 0) - (yr.netWithdrawals.BrokerageBasis ?? 0));
        // pensionIncome/iraIncome split out the retirement-income share of earnedIncome. 16 of the
        // 38 modeled states exempt some or all of it (taxengine.js evaluateRetirementExclusion /
        // evaluateRetirementCredit), and without the split every dollar reads as ordinary wages.
        // This call used to omit both while the other three passes (:1504, :1638, :1753) passed
        // them, so any year that reached the third pass was taxed as though its state had no
        // exclusion at all - state tax overstated, spendable income understated.
        yr.tax = calculateTaxes({
            filingStatus: yr.status, ages: [yr.age1, yr.age2], birthyears: [birthyear1, birthyear2],
            totalSS: yr.s1 + yr.s2, IRMAAAnnualCost: yr.IRMAA,
            earnedIncome: yr.pension + yr.taxableRMD + yr.netWithdrawals.IRA + yr.taxableInterest, inflation: sim.cpiRate,
            pensionIncome: yr.pension, iraIncome: yr.taxableRMD + yr.netWithdrawals.IRA,
            qualifiedDiv: yr.taxableDividends, capGains: yr.capitalGains, hsaContrib: 0,
            taxExemptInterest: 0, state: STATEname, fedRateCreep: yr.fedRateCreep, stateRateCreep: yr.stateRateCreep, obbaOn: yr.obbaOn, saltHigh: yr.saltHigh, propTax: yr.propTax, taxYear: yr.taxYear
        });
        yr.totalTax = yr.tax.totalTax + yr.IRMAA;
        // P32c arm: the spiral test itself. The recalc above just priced the Brokerage leg's
        // realized gains; if that re-opened the residual, draw Brokerage again and reprice, and
        // count the passes. A converging year uses one or two; a genuine spiral hits the cap.
        // Counters are attached lazily so an 'off' run's totals object keeps today's exact shape.
        if (_tpBrokArm !== 'off' && !yr.isOrderedStrategy) {
            const _cap = _tpBrokArm === 'unbounded' ? 200 : 6;
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
                yr.capitalGains = Math.max(0, (yr.netWithdrawals.Brokerage ?? 0) - (yr.netWithdrawals.BrokerageBasis ?? 0));
                yr.tax = calculateTaxes({
                    filingStatus: yr.status, ages: [yr.age1, yr.age2], birthyears: [birthyear1, birthyear2],
                    totalSS: yr.s1 + yr.s2, IRMAAAnnualCost: yr.IRMAA,
                    earnedIncome: yr.pension + yr.taxableRMD + yr.netWithdrawals.IRA + yr.taxableInterest, inflation: sim.cpiRate,
                    pensionIncome: yr.pension, iraIncome: yr.taxableRMD + yr.netWithdrawals.IRA,
                    qualifiedDiv: yr.taxableDividends, capGains: yr.capitalGains, hsaContrib: 0,
                    taxExemptInterest: 0, state: STATEname, fedRateCreep: yr.fedRateCreep, stateRateCreep: yr.stateRateCreep, obbaOn: yr.obbaOn, saltHigh: yr.saltHigh, propTax: yr.propTax, taxYear: yr.taxYear
                });
                yr.totalTax = yr.tax.totalTax + yr.IRMAA;
                yr.marginalFedTaxRate = yr.tax.federalMarginalRate;
                yr.marginalStateTaxRate = yr.tax.stateMarginalRate;
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
    // P38: this used to be gated `yr.isBracketStrategy && !yr.isACAStrategy`, which excluded
    // fixed/propwd/baseline/gk on the stated grounds that they "already draw IRA for spending".
    // They do, but they SIZE that draw against yr.possibleIncome, which is GROSS (:1226) - as if
    // Social Security, pensions and RMDs arrived tax free. The tax on that guaranteed income is
    // never funded, and neither the gap fill nor the third pass has a route back to the IRA, so
    // the shortfall simply stranded: Proportional 0% left $304k unfunded next to an $894k IRA.
    // The justification was true and irrelevant. A gate that names the strategies it SERVES also
    // silently excludes every strategy added later, so this one now names only the two that must
    // genuinely stay out.
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
            yr.capitalGains = Math.max(0, (yr.netWithdrawals.Brokerage ?? 0) - (yr.netWithdrawals.BrokerageBasis ?? 0));
            yr.tax = calculateTaxes({
                filingStatus: yr.status, ages: [yr.age1, yr.age2], birthyears: [birthyear1, birthyear2], totalSS: yr.s1 + yr.s2, IRMAAAnnualCost: yr.IRMAA,
                earnedIncome: yr.pension + yr.taxableRMD + yr.netWithdrawals.IRA + yr.taxableInterest, inflation: sim.cpiRate,
                pensionIncome: yr.pension, iraIncome: yr.taxableRMD + yr.netWithdrawals.IRA,
                qualifiedDiv: yr.taxableDividends, capGains: yr.capitalGains, hsaContrib: 0,
                taxExemptInterest: 0, state: STATEname, fedRateCreep: yr.fedRateCreep, stateRateCreep: yr.stateRateCreep, obbaOn: yr.obbaOn, saltHigh: yr.saltHigh, propTax: yr.propTax, taxYear: yr.taxYear
            });
            yr.totalTax = yr.tax.totalTax + yr.IRMAA;
            yr.marginalFedTaxRate = yr.tax.federalMarginalRate;
            yr.marginalStateTaxRate = yr.tax.stateMarginalRate;
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
    yr.bracketOverage = yr.bracketTarget > 0 ? Math.max(0, yr.tax.MAGI - yr.bracketTarget) : 0;
    if (yr.isACAStrategy && yr.bracketOverage > 1) yr.acaBreach = true;
    if (yr.acaBreach) totals.acaBreachYears += 1;
    totals.forcedIRATotal += yr.forcedIRA;

    sim.cumulativeTaxes += yr.totalTax;


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
    const startYr = inputs.startInYear || new Date().getFullYear();
    return (startYr + y) > inputs.convEndYear;
}

// Route the year's surplus: refund unneeded Roth draws, convert IRA-sourced surplus to
// True if the SURPLUS conversion path (convertExcessToRoth) should be suppressed for year y --
// the existing all-years counterfactual flag, the from-year-onward cutoff used by
// diagnoseConvBreakEvenFailure / bestConversionStopYear to test truncated schedules, or (new)
// the user's public Conversion End Year when the End Year stops ALL conversions (convEndMode
// !== 'extra'). Purely additive: with all three unset (every existing caller), this is exactly
// !!inputs._cfSuppressConversions, zero behavior change.
function _convSuppressedThisYear(inputs, y) {
    return !!inputs._cfSuppressConversions
        || (inputs._cfSuppressConversionsFromYear != null && y >= inputs._cfSuppressConversionsFromYear)
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
    yr.surplus = {
        Total: Math.max(0, yr.netIncome - sim.spendGoal), Roth: 0, Cash: 0, Brokerage: 0,
        Shortfall: Math.min(0, yr.netIncome - sim.spendGoal)
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
        const conv1 = Math.min(yr.surplus.Total * yr.ira1_ratio,       yr.netWithdrawals.IRA1 || 0);
        const conv2 = Math.min(yr.surplus.Total * (1 - yr.ira1_ratio), yr.netWithdrawals.IRA2 || 0);
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

    // `unifiedConvRouting` used to sit here: a P28 research flag that called EVERY voluntary IRA
    // dollar a Roth conversion and drew spending back out of Roth. It was removed once measured.
    // The round trip is arithmetic, not a shortcut -- draw gross X, pay tax T, fund spending S, and
    // Roth gains X - T - S either way -- so it could only ever re-label, and 630 simulations
    // confirmed it: 0 money fields moved in 90 cells. A view that wants the two legs told
    // separately does not need an engine flag, because `-iraSpend` and `-iraConvGrossTot` are
    // already in every log row. Reasoning and measurements: .test_harnesses/P28_RESULTS.md.

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
    const { birthyear1, birthyear2 } = sim;
    const _cap = Math.max(0, (yr.netWithdrawals.IRA1 ?? 0) + (yr.netWithdrawals.IRA2 ?? 0)
        - (yr.surplus.Roth1 ?? 0) - (yr.surplus.Roth2 ?? 0));
    if (netTarget <= 1 || _cap <= 1) return;
    let G = Math.min(netTarget, _cap);
    let t2 = yr.tax, dT = 0;
    for (let _i = 0; _i < 3; _i++) {
        t2 = calculateTaxes({
            filingStatus: yr.status, ages: [yr.age1, yr.age2], birthyears: [birthyear1, birthyear2],
            totalSS: yr.s1 + yr.s2, IRMAAAnnualCost: yr.IRMAA,
            earnedIncome: yr.pension + yr.taxableRMD + Math.max(0, yr.netWithdrawals.IRA - G) + yr.taxableInterest, inflation: sim.cpiRate,
            pensionIncome: yr.pension, iraIncome: yr.taxableRMD + Math.max(0, yr.netWithdrawals.IRA - G),
            qualifiedDiv: yr.taxableDividends, capGains: yr.capitalGains, hsaContrib: 0,
            taxExemptInterest: 0, state: STATEname, fedRateCreep: yr.fedRateCreep, stateRateCreep: yr.stateRateCreep, obbaOn: yr.obbaOn, saltHigh: yr.saltHigh, propTax: yr.propTax, taxYear: yr.taxYear
        });
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
    sim.cumulativeTaxes -= (yr.totalTax - _newTotalTax);
    const _netRemoved = G - (yr.totalTax - _newTotalTax);
    yr.totalTax = _newTotalTax;
    yr.totalIncome = Math.max(1, yr.totalIncome - G);
    yr.netIncome -= _netRemoved;
    sim.nominalTaxRate = yr.tax.nominalRate;
    yr.marginalFedTaxRate = yr.tax.federalMarginalRate;
    yr.marginalStateTaxRate = yr.tax.stateMarginalRate;
    yr.surplus.Total = Math.max(0, yr.surplus.Total - _netRemoved);
}

// Phase 23: extra conversion - additional IRA→Roth independent of spending strategy.
// extraConversionAmount[y] (or scalar $) = gross IRA to additionally withdraw and convert.
// Taxes come from IRA gross (same convention as convertExcessToRoth surplus). Net Roth = gross - tax.
function applyExtraConversion(sim, yr) {
    const { inputs, balance, birthyear1, birthyear2 } = sim;
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
            const _exTaxCalc = calculateTaxes({
                filingStatus: yr.status, ages: [yr.age1, yr.age2], birthyears: [birthyear1, birthyear2], totalSS: yr.s1 + yr.s2,
                IRMAAAnnualCost: 0, earnedIncome: _baseEI + _gross, inflation: sim.cpiRate,
                pensionIncome: yr.pension, iraIncome: yr.taxableRMD + _priorIRAInc + _gross,
                qualifiedDiv: yr.taxableDividends, capGains: yr.capitalGains,
                hsaContrib: 0, taxExemptInterest: 0, state: STATEname, fedRateCreep: yr.fedRateCreep, stateRateCreep: yr.stateRateCreep, obbaOn: yr.obbaOn, saltHigh: yr.saltHigh, propTax: yr.propTax, taxYear: yr.taxYear
            });
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
            sim.cumulativeTaxes += incrementalExtraConvTax;
            yr._extraIRAIncome = (yr._extraIRAIncome ?? 0) + _gross;   // keep the basis consistent for any later consumer
        }
    }
}

// Prefer-larger IRA sourcing for the additional conversion pulls (extra conversion, gross-up):
// take the whole amount from the larger-balance IRA, spilling to the smaller only when the larger
// cannot cover it. Keeps a real-world-sensible plan (no converting a token slice out of a tiny IRA)
// and changes per-account balances (hence downstream per-spouse RMDs) - combined totals unchanged.
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
    const { inputs, balance, birthyear1, birthyear2 } = sim;
    yr.grossUpIRA = 0;
    yr.grossUpTax = 0;
    const conversion = (yr.surplus.Roth1 ?? 0) + (yr.surplus.Roth2 ?? 0);
    if (!inputs.fundConversionWithCash || conversion <= 1) return;

    const baseEI = yr.pension + yr.taxableRMD + yr.taxableInterest;
    const shadowIRA = Math.max(0, (yr.netWithdrawals.IRA ?? 0) - conversion);
    const shadowCalc = calculateTaxes({
        filingStatus: yr.status, ages: [yr.age1, yr.age2], birthyears: [birthyear1, birthyear2], totalSS: yr.s1 + yr.s2,
        IRMAAAnnualCost: 0, earnedIncome: baseEI + shadowIRA, inflation: sim.cpiRate,
        pensionIncome: yr.pension, iraIncome: yr.taxableRMD + shadowIRA,
        qualifiedDiv: yr.taxableDividends, capGains: yr.capitalGains,
        hsaContrib: 0, taxExemptInterest: 0, state: STATEname, fedRateCreep: yr.fedRateCreep, stateRateCreep: yr.stateRateCreep, obbaOn: yr.obbaOn, saltHigh: yr.saltHigh, propTax: yr.propTax, taxYear: yr.taxYear
    });
    const dT = Math.max(0, (yr.totalTax - yr.IRMAA) - shadowCalc.totalTax);
    const t = Math.min(0.6, dT / conversion);   // 0.6 is a numeric safety guard, not a business rate
    if (t <= 0.0001) return;

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
    sim.cumulativeTaxes += taxCost;
    // This IRA income is NOT in yr.netWithdrawals.IRA (it's an extra draw applied straight to
    // balance), but its tax IS now in yr.totalTax. Any later mechanism that isolates its own
    // marginal tax by subtracting yr.totalTax must therefore include this in its income basis,
    // or it compares a with-this-tax baseline against a without-this-income shadow calc and
    // understates itself. applyExtraConversion reads this for exactly that reason.
    yr._extraIRAIncome = (yr._extraIRAIncome ?? 0) + increase;

    yr.grossUpIRA = increase;   // bookkeeping for grossOut
    yr.grossUpTax = taxCost;
}

// Phase 20 (reworked): per-year incremental tax attribution for the convTax / excessTax
// columns only. For each action (Roth conversion, excess withdrawal to Cash), compute the
// incremental tax attributable to that action by re-running calculateTaxes() without it.
// The Opp. Cost / Break Even values themselves come from the counterfactual run after the loop.
function attributeIncrementalTaxes(sim, yr) {
    const { birthyear1, birthyear2 } = sim;
    yr.incrementalConvTax = 0;
    if (yr.totalConverted > 0) {
        const baseEI = yr.pension + yr.taxableRMD + yr.taxableInterest;
        const convShadowEI = baseEI + Math.max(0, (yr.netWithdrawals.IRA ?? 0) - yr.totalConverted);
        const shadowConvCalc = calculateTaxes({
            filingStatus: yr.status, ages: [yr.age1, yr.age2], birthyears: [birthyear1, birthyear2], totalSS: yr.s1 + yr.s2,
            IRMAAAnnualCost: 0, earnedIncome: convShadowEI, inflation: sim.cpiRate,
            pensionIncome: yr.pension, iraIncome: yr.taxableRMD + Math.max(0, (yr.netWithdrawals.IRA ?? 0) - yr.totalConverted),
            qualifiedDiv: yr.taxableDividends, capGains: yr.capitalGains,
            hsaContrib: 0, taxExemptInterest: 0, state: STATEname, fedRateCreep: yr.fedRateCreep, stateRateCreep: yr.stateRateCreep, obbaOn: yr.obbaOn, saltHigh: yr.saltHigh, propTax: yr.propTax, taxYear: yr.taxYear
        });
        yr.incrementalConvTax = Math.max(0, (yr.totalTax - yr.IRMAA) - shadowConvCalc.totalTax);
    }

    yr.incrementalExcessTax = 0;
    const excessCashOC = yr.surplus.Cash;
    if (excessCashOC > 0 && (yr.netWithdrawals.IRA ?? 0) > 0) {
        const baseEI = yr.pension + yr.taxableRMD + yr.taxableInterest;
        const excessShadowEI = baseEI + Math.max(0, (yr.netWithdrawals.IRA ?? 0) - excessCashOC);
        const shadowExcessCalc = calculateTaxes({
            filingStatus: yr.status, ages: [yr.age1, yr.age2], birthyears: [birthyear1, birthyear2], totalSS: yr.s1 + yr.s2,
            IRMAAAnnualCost: 0, earnedIncome: excessShadowEI, inflation: sim.cpiRate,
            pensionIncome: yr.pension, iraIncome: yr.taxableRMD + Math.max(0, (yr.netWithdrawals.IRA ?? 0) - excessCashOC),
            qualifiedDiv: yr.taxableDividends, capGains: yr.capitalGains,
            hsaContrib: 0, taxExemptInterest: 0, state: STATEname, fedRateCreep: yr.fedRateCreep, stateRateCreep: yr.stateRateCreep, obbaOn: yr.obbaOn, saltHigh: yr.saltHigh, propTax: yr.propTax, taxYear: yr.taxYear
        });
        yr.incrementalExcessTax = Math.max(0, (yr.totalTax - yr.IRMAA) - shadowExcessCalc.totalTax);
    }
}

// Apply post-withdrawal growth, dividends, and the year's totals accumulation.
function growAndSettle(sim, yr) {
    const { inputs, balance, totals } = sim;
    // Brokerage tax treatment is correct: dividends are taxed as qualifiedDiv in calculateTaxes()
    // (line ~864), liquidations are taxed as capGains above BrokerageBasis, and the growth
    // applied here is unrealized appreciation - not taxable until sold. The one valuation nuance:
    // unrealized gains are carried at face value during the simulation; totalWealth (line ~1091)
    // discounts them by nominalTaxRate, but year-by-year spendable wealth does not reserve for
    // deferred tax on gains that are never liquidated.

    // Post-withdrawal growth (Phase 12): remaining postMonths after withdrawal exits portfolio.
    yr.gains = applyGrowth(balance, yr.growthRates, yr.postMonths);
    inspectForErrors(yr.growthRates, balance, yr.gains);
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
    // Estimate tax attributable to RMDs proportionally (RMD / totalIncome × totalTax)
    totals.rmdTax += yr.totalIncome > 0 ? (yr.taxableRMD / yr.totalIncome) * yr.totalTax : 0;
    totals.qcd = (totals.qcd || 0) + yr.totalQCD;
    balance.Roth1 += yr.surplus.Roth1;
    balance.Roth2 += yr.surplus.Roth2;
    totals.shortfall += yr.surplus.Shortfall;
}

// BETR signal, after-tax terminal valuation, solvency fail-check, withdrawal rate.
function evaluateYearOutcome(sim, yr) {
    const { inputs, balance, totals } = sim;
    const y = yr.y;
    // Opp. Cost NetValue (convOC/excessOC) is annotated after the loop by comparing this
    // run's after-tax wealth against the counterfactual run's, year by year.
    const _taxFuture = inputs.futureIRATaxRate ?? (yr.marginalFedTaxRate + yr.marginalStateTaxRate);
    // Capture the year-0 resolved future-IRA rate so the optimizer can value every
    // strategy's terminal IRA at one shared rate (comparable cross-strategy deltas).
    if (y === 0) totals.futureIRARate = _taxFuture;

    // Phase 21: BETR per-year signal.
    // Computed when there was any conversion this year (standard or extra). BETR answers: "what future
    // marginal rate makes this conversion break-even?" Comparison to futureIRATaxRate gives ▲/▼ flag.
    yr.yearBETR = null;
    yr.yearBETRflag = null;
    if (yr.totalConverted > 0) {
        const _rIRA = yr.growthRates.IRA1 ?? inputs.growth ?? 0.06;
        const _drag = (inputs.dividendRate ?? 0) * (yr.tax.capitalGainsRate ?? 0.15);
        const _rTax = Math.max(0, (inputs.growth ?? _rIRA) - _drag);
        const _rmdAge1 = (inputs.birthyear1 ?? 1960) >= 1960 ? 75 : 73;
        const _yearsToRMD = Math.max(1, _rmdAge1 - yr.age1);
        yr.yearBETR = computeBETR(yr.tax.federalMarginalRate + (yr.tax.stateMarginalRate ?? 0), _rIRA, _rTax, _yearsToRMD);
        if (yr.yearBETR !== null) {
            const _futureRate = _taxFuture; // already resolved above
            yr.yearBETRflag = _futureRate > yr.yearBETR + 0.02 ? '▲'
                         : _futureRate < yr.yearBETR - 0.02 ? '▼' : '≈';
        }
    }

    // After-tax terminal valuation: IRA taxed at ordinary marginal (nominalTaxRate),
    // brokerage gains above basis taxed at the capital-gains rate (not ordinary),
    // Roth + Cash + returned basis at face.
    yr.totalWealth = (balance.IRA1 + balance.IRA2) * (1 - sim.nominalTaxRate)
        + Math.max(0, balance.Brokerage - balance.BrokerageBasis) * (1 - sim.capitalGainsRate)
        + balance.Roth1 + balance.Roth2 + balance.Cash + balance.BrokerageBasis

    // Fail when the portfolio can't cover its required draw (spend minus guaranteed income).
    // This is strategy-agnostic and fires at the point of first real impairment.
    yr.guaranteedIncome = yr.s1 + yr.s2 + yr.pension;
    yr.portfolioBalance = balance.IRA1 + balance.IRA2 + balance.Roth1 + balance.Roth2 + balance.Brokerage + balance.Cash;
    const requiredPortfolioDraw = Math.max(0, sim.spendGoal - yr.guaranteedIncome);
    if (yr.netIncome < yr.targetSpend * 0.99 || yr.portfolioBalance < requiredPortfolioDraw) {
        totals.success = false;
        totals.failedInYear.push(sim.currentYear)
    } else {
        totals.yearsfunded += 1
    }

    inspectForErrors({ totalWealth: yr.totalWealth })  // See if any numbers look fishy.

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
        fixedInc: yr.fixedInc, pension: yr.pension, targetSpend: yr.targetSpend, netIncome: yr.netIncome, totalIncome: yr.totalIncome,
        surplus: yr.surplus, totalRMD: yr.totalRMD, qcd1: yr.qcd1, qcd2: yr.qcd2, taxableDividends: yr.taxableDividends, taxableInterest: yr.taxableInterest,
        netWithdrawals: yr.netWithdrawals, rmd1: yr.rmd1, rmd2: yr.rmd2, totalConverted: yr.totalConverted, tax: yr.tax, IRMAA: yr.IRMAA, IRMAATier: yr.IRMAATier, medicareBase: yr.medicareBase, cpiRate: sim.cpiRate,
        iraVolSpend1: yr.iraVolSpend1, iraVolSpend2: yr.iraVolSpend2, iraConvGross1: yr.iraConvGross1, iraConvGross2: yr.iraConvGross2,
        totalTax: yr.totalTax, capitalGains: yr.capitalGains, cumulativeTaxes: sim.cumulativeTaxes, bracketTarget: yr.bracketTarget, bracketOverage: yr.bracketOverage, forcedIRA: yr.forcedIRA, acaBreach: yr.acaBreach,
        balance: balance, nominalTaxRate: sim.nominalTaxRate, totalWealth: yr.totalWealth, portfolioBalance: yr.portfolioBalance, guaranteedIncome: yr.guaranteedIncome,
        totalsSpend: totals.spend,
        gains: yr.gains, rmd1Pct: yr.rmd1Pct, subCycleLabel: yr.subCycleLabel, convNetValue: null, excessNetValue: null,
        incrementalConvTax: yr.incrementalConvTax, incrementalExcessTax: yr.incrementalExcessTax, yearBETR: yr.yearBETR, yearBETRflag: yr.yearBETRflag,
        extraConvGross: yr.extraConvGross,
        surplusToBrokerage: yr.surplusToBrokerage, cashBreach: yr.cashBreach,
        grossUpIRA: yr.grossUpIRA, grossUpTax: yr.grossUpTax, extraConvCashTax: yr.extraConvCashTax,
        fedRateCreep: yr.fedRateCreep, stateRateCreep: yr.stateRateCreep,
        ssStart1: yr['-ssStart1'], ssStart2: yr['-ssStart2'], ssStartSurvivor: yr['-ssStartSurvivor'],
        grossOutflows: yr._grossOutflows, netOutflows: yr._netOutflows,
        yearInflows: yr._yearInflows, wdRate: yr._wdRate,
        useEarly: yr._useEarly, timingReason: yr.timingReason,
        strategy: inputs.strategy, spendGoal: sim.spendGoal, gkAdjLabel: sim.gkAdjLabel, inflation: sim.inflation,
        yearInflation: yr.yearInflation, baseReturn: yr.baseReturn, loopMs: loopMs
    }));
    totals.totalTime += log[log.length - 1].loopMs;
}

// Carry wealth snapshots into next year, advance the spend goal, and compound rates.
function endYear(sim, yr) {
    const { inputs } = sim;
    // Raw balance sum (no tax discount). Feeds both the withdrawal rate and the GK guardrail
    // checks, so the two stay apples-to-apples and every year uses the same basis.
    sim.prevPortfolio = yr.portfolioBalance;
    // Advance spend goal: apply user's spend-change preference and inflation.
    // spendDelta is constant (1 + inputs.spendChange); moving this to end of loop
    // keeps year-0 spendGoal equal to the user's input in today's dollars.
    // Phase 22: GK handles inflation at start of next year via its own rules; only apply spendDelta here.
    if (inputs.strategy === 'gk') {
        sim.gkPriorReturn = yr.baseReturn;
        sim.spendGoal = sim.spendGoal * sim.spendDelta;
    } else {
        sim.spendGoal = sim.spendGoal * sim.spendDelta * (1 + yr.yearInflation);
    }

    sim.currentYear += 1;

    // Adjust inflation rates for subsequent rounds.
    sim.cpiRate *= (1 + inputs.cpi);
    sim.inflation *= (1 + yr.yearInflation);
    sim.medicareRate *= (1 + inputs.cpi + inputs.inflation)
}

/** SIMULATION ENGINE **/
function simulate(inputs) {
    if (!inputs.hasSpouse) {
        inputs = { ...inputs, birthyear2: 0, die2: 0, IRA2: 0, ss2: 0, Roth2: 0 };
    }
    // Cyclic mode forces dividend reinvestment (DRIP) to keep all brokerage proceeds
    // in the LTCG regime and prevent ordinary-income creep from dividends flowing to Cash.
    if (inputs.cyclicEnabled) {
        inputs = { ...inputs, dividendReinvest: true };
    }
    let balance = {
        IRA1: inputs.IRA1, IRA2: inputs.IRA2, Roth1: inputs.Roth, Roth2: inputs.Roth2 || 0,
        Brokerage: inputs.Brokerage, BrokerageBasis: inputs.BrokerageBasis, Cash: inputs.Cash,
        magiHistory: []
    };
    simulationCount += 1;
    STATEname = inputs.STATEname;
    let log = [];
    let currentYear = inputs.startInYear || new Date().getFullYear();

    let birthyear1 = Math.floor(inputs.birthyear1);
    let birthmonth1 = inputs.birthmonth1 ?? 12;
    let birthyear2 = Math.floor(inputs.birthyear2);
    let birthmonth2 = inputs.birthmonth2 ?? 12;

    let maxYears = Math.max(inputs.birthyear1 + inputs.die1, inputs.birthyear2 + inputs.die2) - currentYear + 1;
    let totals = { tax: 0, gross: 0, spend: 0, yearsfunded: 0, success: true, yearstested: 0, failedInYear: [], shortfall: 0, taxCurrentDollars: 0, spendCurrentDollars: 0, rmd: 0, rmdTax: 0, thirdPassCount: 0, thirdPassTime: 0, totalTime: 0, acaBreachYears: 0, forcedIRATotal: 0 };

    // Pre-compound rates for any gap between today and the simulation start year.
    // This ensures brackets, SS COLA, and IRMAA are in the correct future-dollar terms
    // from year 1 of the loop, rather than starting from today's (1.0) base.
    const gapYears = Math.max(0, currentYear - new Date().getFullYear());
    let cpiRate      = Math.pow(1 + inputs.cpi,      gapYears);
    let inflation    = Math.pow(1 + inputs.inflation, gapYears);
    let medicareRate = Math.pow(1 + inputs.cpi + inputs.inflation, gapYears);
    let fixedWithdrawal = 0;
    let spendDelta = 1 + inputs.spendChange;
    let spendGoal = inputs.spendGoal * Math.pow(1 + inputs.inflation, gapYears);
    let cumulativeTaxes = 0;
    let nominalTaxRate = 0.20; // Just a guess.
    let capitalGainsRate = 0.15; // A guess.

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
     *   strategy='fixed' - "Reduce IRA in N Years"
     *       Amortizes the IRA over nYears. Each year withdraws the amortized
     *       amount from IRA only (RMDs count toward the target). Spending
     *       shortfall after IRA draw is filled from Cash → Brokerage → Roth.
     *       WithdrawalOrder = [IRA first, then gap-fill]
     *
     *   strategy='propwd' - "Proportional Withdraw +%"
     *       Withdraws proportionally across IRA/Brokerage/Cash to meet the
     *       spend goal (original "baseline" behavior at 0%). An optional IRA
     *       boost of propWithdraw × spendGoal is added on top; the after-tax
     *       surplus flows to Roth conversion or Cash. At 0% this is the pure
     *       proportional baseline.
     *       WithdrawalOrder = [IRA, Brokerage, Cash] proportionally
     *
     *   strategy='bracket' - "Fill Federal Tax Bracket" / "IRMAA Ceil" / "ACA Cliff"
     *       Draws IRA up to a ceiling (federal bracket top, an IRMAA tier, or
     *       an ACA FPL multiple). Spending shortfall fills from Cash →
     *       Brokerage → Roth. Also covers strategy='minlimit' (Lesser of
     *       IRMAA or Tax Bracket).
     *       WithdrawalOrder = [IRA up to ceiling, then gap-fill]
     *
     *   strategy='fixedpct' - "IRA Draw %"
     *       Withdraws a fixed percentage of the starting-year IRA balance each
     *       year regardless of spend goal. RMDs count toward the target.
     *       Spending shortfall fills from Cash → Brokerage → Roth.
     *       WithdrawalOrder = [IRA first, then gap-fill]
     *
     *   (else / fallback) - legacy proportional baseline
     *       Same proportional logic as propwd at 0%, retained for backwards
     *       compatibility. No UI option currently routes here.
     *       WithdrawalOrder = [IRA, Brokerage, Cash] proportionally
     *
     *   NOTE - future strategy='baseline' (not yet implemented):
     *       A rigorous tax-efficient depletion order: RMD first, then taxable
     *       accounts (Brokerage, Cash) until exhausted, then IRA, then Roth.
     *       Intended as a comparison baseline that never voluntarily draws down
     *       tax-deferred assets ahead of taxable ones.
     *       WithdrawalOrder = [RMD → Brokerage/Cash → IRA → Roth]
     *
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

    // Sim-level state shared across years (and with the phase functions being split out of
    // this loop). Fields listed after `totals` are reassigned as the simulation advances, so
    // they must live here rather than as locals; inputs/balance/log/totals are never
    // reassigned (only mutated) and stay usable as bare locals inside simulate() itself.
    const sim = {
        inputs, balance, log, totals,
        birthyear1, birthmonth1, birthyear2, birthmonth2,
        currentYear, cpiRate, inflation, medicareRate,
        fixedWithdrawal, spendDelta, spendGoal, cumulativeTaxes,
        nominalTaxRate, capitalGainsRate,
        subCycleIRAYears, prevPortfolio,
        gkIWR, gkPriorReturn, gkAdjLabel,
        // Tax-rate creep: blank/0 start year means the creep begins with the plan's first year.
        // Never advanced - resolveHousehold() derives each year's factor from the calendar year.
        creepStartYear: inputs.taxCreepStartYear > 0 ? inputs.taxCreepStartYear : currentYear,
        // P64a. Property tax is entered in today's dollars, so it compounds from the REAL current
        // year, not the plan's first year - the same base spendGoal's gapYears pre-inflation uses.
        propTaxBaseYear: currentYear - gapYears,
    };

    for (let y = 0; y < maxYears; y++) {
        // Per-year context: every value that crosses a phase boundary within the year
        // lives here; block-internal temporaries stay plain locals.
        const yr = { y };
        beginYear(sim, yr);
        if (!resolveHousehold(sim, yr)) break;   // both spouses deceased
        computeIncome(sim, yr);
        resolveSpendTarget(sim, yr);
        planPrimaryWithdrawals(sim, yr);
        applyPrimaryAndTaxPass1(sim, yr);
        fillSpendingGap(sim, yr);
        resolveResidualAndForcedIRA(sim, yr);
        routeSurplusAndConvert(sim, yr);
        applyConversionGrossUp(sim, yr);
        applyExtraConversion(sim, yr);
        attributeIncrementalTaxes(sim, yr);
        growAndSettle(sim, yr);
        evaluateYearOutcome(sim, yr);
        logYear(sim, yr);
        endYear(sim, yr);
    } // end for (let y = 0; y < maxYears; y++)

    // Phase 20 (reworked): Opp. Cost via full counterfactual simulation.
    // convOC[y] = this run's after-tax wealth minus the same plan re-simulated with conversions
    // suppressed (converted dollars stay in the IRA, no conversion tax, bigger RMDs later, each
    // taxed at that year's actual bracket/IRMAA conditions). excessOC[y] = same idea for excess
    // IRA withdrawals banked to Cash. Break Even = the earliest year OC stays non-negative all
    // the way to the LAST simulated year (a sustained crossing) - not just the first year that
    // happens to touch non-negative, since a plan can blip positive for a year on its way to a
    // permanently worse outcome. Reported only once the costed action has actually occurred by
    // that year; null if the plan never sustains a non-negative gap through its final year.
    // Valuation: row totalWealth (IRA at the run's own nominal rate, brokerage gains at the
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
        const _sustainedBEYear = (key, actionAmount) => {
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
        };
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
        // Exactly inverts the cap-gains haircut in the totalWealth formula (evaluateYearOutcome):
        // old contribution was gain*(1-capG) + basis, new is basis + gain, so the difference is
        // gain*capG. Adding the delta rather than restating the whole formula keeps the IRA half
        // in one place, where it cannot drift from this.
        // Both pre-step-up values are kept. '-totalWealthPreStepUp' is the terminal row's
        // LIQUIDATION value - what the estate would net by selling instead of inheriting - and it
        // is the basis the Break Even series above is computed on. Keeping it makes the two bases
        // recoverable from a finished run rather than implicit, which is what lets the convOC
        // identity still be asserted and what a legacy-basis Break Even would build on.
        _last['-basisPreStepUp'] = _last.Basis;              // leading '-' -> no table column
        _last['-totalWealthPreStepUp'] = _last.totalWealth;
        _last.totalWealth += _gainAtDeath * sim.capitalGainsRate;
        _last.Basis = _last.Brokerage;
    }

    // Baseline accounting: expose the terminal capital-gains rate + terminal balance
    // breakdown so the optimizer's after-tax net-worth helper can value every strategy
    // on a comparable footing (IRA at future rate, brokerage gains at cap-gains rate).
    totals.capGainsRate = sim.capitalGainsRate;
    // The step-up fraction this run actually used, plus the state it came from, so the chart's
    // death markers and their legend can report it without re-deriving it from the inputs. Read
    // from totals rather than from the State dropdown on purpose: the dropdown can be changed
    // after a run, and the marker has to describe the run it belongs to.
    totals.basisStepUpFraction = TAXData[STATEname]?.BasisStepUp ?? 0.50;
    totals.stateName = STATEname;
    const _lastLog = log[log.length - 1];
    totals.terminal = {
        ira:       _lastLog.IRA1 + _lastLog.IRA2,
        roth:      _lastLog.Roth1 + _lastLog.Roth2,
        cash:      _lastLog.Cash,
        brokerage: _lastLog.Brokerage,
        basis:     _lastLog.Basis
    };

    return { log, totals, finalNW: log[log.length - 1].totalWealth };
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

// After-tax value of a single simulate() LOG ROW, in the Break Even valuation basis: the row's
// own totalWealth (IRA at that run's nominal rate) unless a Marginal Heirs Tax Rate is supplied,
// in which case the IRA is discounted at that shared rate and brokerage gains at the row's own
// cap-gains rate. Factored out of simulate()'s Break Even block so bestConversionStopYear scores
// on the identical basis -- the two can never drift.
function afterTaxWealthOfLogRow(r, futureIRATaxRate) {
    if (futureIRATaxRate == null) return r.totalWealth;
    return (r.IRA1 + r.IRA2) * (1 - futureIRATaxRate)
        + Math.max(0, r.Brokerage - r.Basis) * (1 - (r['-capGainsRate'] ?? 0.15))
        + r.Roth + r.Cash + r.Basis;
}

// Searches for the year that MAXIMIZES after-tax wealth by stopping Roth conversions after it.
// Evidence (2026-07-23, .planning/retirement-optimizer/findings.md) established that this is a
// real lever (spend is identical across every cutoff; stopping early never hurt across 23
// scenarios) and that the Break Even diagnostic's boundary year is NOT it -- the boundary year
// is the last cutoff that still breaks even at all, a far weaker condition than max wealth
// (off by $662k / 12 years in the recorded scenario). So this cannot be a heuristic (four
// candidate shortcut rules all failed) and must be a linear scan (the cutoff curve is not
// unimodal -- step-function brackets/IRMAA -- so binary/ternary search converges wrong
// undetectably, the same reasoning diagnoseConvBreakEvenFailure documents).
//
// mode 'all'   -> stop ALL conversion activity after the cutoff (surplus + extra), via the
//                 internal _cfSuppressConversionsFromYear cutoff.
// mode 'extra' -> stop ONLY the Extra Annual Roth Conversion (strategy bracket-fill keeps
//                 running), via the public convEndYear + convEndMode:'extra' pair. Empirically
//                 weaker. (Was a zero-tail extraConversionAmount array; that array mis-fired the
//                 year-0 Early/Late withdrawal-timing trigger, so every cutoff it scored was a
//                 differently-timed plan than the one the user could load.)
//
// Scores each cutoff on afterTaxWealthOfLogRow of the final row, the same basis as Break Even
// (honors the user's Marginal Heirs Tax Rate when set, else row totalWealth). Any stop-year the
// user has already set is stripped first, so the search always explores from a full-conversion
// baseline. Caller should gate on conversions actually occurring (log.some(rothConv > 1)), same
// precondition as the Break Even diagnostic. Cost: n+1 cheap (no-OC) simulate() calls plus one
// OC re-run at the winner -- on-demand only, never a hot path.
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
    const start = probe.log[0].year;
    if (n === 0) return null;
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
    const MIN_SPEND = Math.max(500, baseInputs.spendGoal * 0.02);
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

// Guyton-Klinger self-adjusts spendGoal downward via its guardrails, so a terminal-balance /
// totals.success check is trivially satisfied at almost any initial spend (the target just moves
// to whatever survives). This stability floor rejects runaway initial spends that GK can only hold
// for a year or two before slashing: the worst REAL delivered spend across the horizon must stay
// within one guard band of the initial real spend. Returns true for non-GK strategies. Shared by
// BOTH the forward spend search (optimizeSpend) and the reverse no-solution search (optimizeSpendDown)
// so neither recommends an artificially high GK spend held only via continuous annual cuts.
function gkSpendStable(res, overrides, baseInputs) {
    if (!overrides || overrides.strategy !== 'gk') return true;
    const log = res.log;
    if (!log || !log.length) return true;
    const initialReal = log[0].spendGoal / (log[0].inflationFactor || 1);
    if (initialReal <= 0) return true;
    let minReal = Infinity;
    for (const rec of log) {
        const real = rec.spendGoal / (rec.inflationFactor || 1);
        if (real < minReal) minReal = real;
    }
    const guardBand = overrides.gkGuard ?? baseInputs.gkGuard ?? 0.20;
    return minReal >= initialReal * (1 - guardBand);
}

// Returns the highest-spend simulation result where the portfolio can still fund
// its required draw (spendGoal minus guaranteed income) in the final year.
// baseInputs: full inputs object at baseline spendGoal
// overrides:  strategy overrides (same object passed to addResult for this row)
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
    for (let g = 0; g < 6 && passes(run(hi)); g++) hi *= 1.6;

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

// P49 primitive, kept for its tests: max spend leaving `bufferYears` of terminal portfolio-funded
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
// against the FIXED reference strategy so they do not move when the user changes strategy.
//   A Conservative - a horizon-aware Bengen rate on the invested portfolio (research benchmark;
//     the year-1 portfolio-funded draw is ~this rate of the portfolio). Strategy-independent.
//   D Middle       - engine-solved to end holding >= 50% of the REAL starting portfolio.
//   B Aggressive   - engine-solved to end holding 5 full years of (inflated) spending.
// Returns { horizon, referenceStrategy, options: [{key,label,spend,note}] } - spend may be null if
// a solve is infeasible - or null if the plan cannot be simulated at all.
function suggestSpendMenu(baseInputs) {
    const base  = Object.assign({}, baseInputs, { strategy: SUGGEST_REFERENCE_STRATEGY });
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

    // Step 2: try ceiling (50% above baseline)
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
// afterTaxNW * (finalNWCurrentDollars / finalNW); since finalNWCurrentDollars = totalWealth /
// inflationFactor and finalNW = totalWealth, that ratio IS 1/inflationFactor, so dividing here is
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

// PF11: pick the conversion-sweep candidate pool -- the best (highest _baselineScore) row from
// each strategy FAMILY, ranked, capped at maxPool. Ranking by ending wealth alone (the old flat
// top-5) let one family monopolize every seat while the families that actually benefit from
// converting ranked just below the cut and were never swept. Pure: reads only plain row fields,
// no DOM, no simulate(). Rows must already carry _baselineScore.
//   Family key = strategyKey|cyclicKey:
//     strategyKey = _strategy, EXCEPT 'bracket' splits on _stratIRMAATier (<0 = fill-a-tax-bracket,
//                   >=0 = fill-to-an-IRMAA-tier-ceiling) -- these share strategy:'bracket' but answer
//                   different questions, so keying on _strategy alone would silently drop one.
//     cyclicKey   = _cyclicEnabled ? 'cyc' : 'lin' (ira-first/brokerage-first collapse to one bucket;
//                   keep whichever scores better). Cyclic MUST be its own dimension -- the reported
//                   failure was five cyclic rows crowding out the non-cyclic champion of the same
//                   strategy. The 💵 cash-funded arm is deliberately NOT a dimension (nerd-only,
//                   Cash-gated); it rides along via the winning row's _fundConversionWithCash.
// Eligibility: successful, and not a no-conv reference / infeasible-bracket / untenable-ACA /
// spend-optimized row (the last is excluded because its overrides are rebuilt without spendGoal or
// the cyclic/tier/cash fields, so it would be swept at the wrong spend under a mismatched label --
// making ✦ rows eligible needs spendGoal threaded through and is a separate phase).
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
    const capG = r.totals?.capGainsRate ?? 0.15;
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
    conveffect:{ dir: 'desc', metric: r => r._convSavings ?? -Infinity },
    // Earliest Break Even: the year a strategy's conversions permanently overtake the same strategy
    // without them. Ties are common (the year is an integer and many strategies cross together), so
    // they break on real-dollar after-tax net wealth -- the same measure `networth` and the ⚓
    // baseline pick use, so "higher net wealth" means one thing everywhere in the table. Rows with
    // no break-even (null: no conversions, or the lead never sustains) sort last via the 9999
    // sentinel and can never outrank a row that actually has a year.
    earliestbe:{
        dir: 'asc',
        rank: (rows) => [...rows].sort((a, b) =>
            ((a._convBEYear ?? 9999) - (b._convBEYear ?? 9999))
            || ((b.afterTaxNWCurrentDollars ?? -Infinity) - (a.afterTaxNWCurrentDollars ?? -Infinity))),
    },
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
    'dNW', 'dTax', 'rate', 'years', 'rmd', 'rmdtax', 'convBE', 'convSaved',
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
    maxroth:    ['compare','status','gap','strategy','param','rank','afterTaxNW','tax','finalRoth'],
    balanced:   ['compare','status','gap','strategy','param','rank','afterTaxNW','tax','spend'],
    conveffect: ['compare','status','gap','strategy','param','rank','afterTaxNW','tax','convBE','convSaved','finalRoth'],
    earliestbe: ['compare','status','gap','strategy','param','rank','afterTaxNW','tax','convBE','convSaved'],
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
    earliestbe: 'Rows are ranked by Break Even, the year conversions permanently overtake not converting. Earlier is better.',
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
    const rgf = x => (x === 'fillCashThenRoth' || x === 'fillRothThenCash') ? x : '';
    if (rgf(a.rothGapFill) !== rgf(b.rothGapFill)) return false;
    const near = (x, y) => Math.abs((x ?? 0) - (y ?? 0)) < 0.001;
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
        case 'gk':       return near(a.gkGuard, b.gkGuard) && near(a.gkAdjPct, b.gkAdjPct);
        default:         return false;
    }
}

// The user's current family parameter as a sweep row, when it does NOT sit on that family's
// standard grid -- so a user at Proportional 7% or Reduce 18 yrs sees their own setting on the
// family's curve instead of only the neighbouring steps. Returns null when the value is already on
// the grid, or the family has no numeric grid (ordered/gk/aca: gk already sweeps the user's own
// guardrails, ordered is a small fixed set). Shared by buildVariations() and the Optimizer's own
// sweep so the two cannot drift; the grids themselves are passed in because they differ (the
// Optimizer sweeps IRA Draw further out than Monte Carlo does). Pure.
function offGridParamFor(base, grids = {}) {
    if (!base) return null;
    const on = (arr, v) => (arr || []).some(x => Math.abs(x - v) < 0.001);
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
        default: return null;
    }
}

// Rank rows best->worst under an objective. Successful rows ALWAYS outrank failed ones (a depleted
// plan can show inflated terminal wealth), then the objective's own order. Pure.
function rankRowsByObjective(rows, objKey, rate = 0) {
    const obj = OPTIMIZER_OBJECTIVES[objKey] || OPTIMIZER_OBJECTIVES.taxflex;
    const succ = rows.filter(r => r.totals && r.totals.success);
    const fail = rows.filter(r => !(r.totals && r.totals.success));
    let orderedSucc;
    if (obj.rank) {
        orderedSucc = obj.rank(succ, rate);
    } else {
        const sign = obj.dir === 'asc' ? 1 : -1;
        orderedSucc = [...succ].sort((a, b) => sign * (obj.metric(a, rate) - obj.metric(b, rate)));
    }
    return [...orderedSucc, ...fail];
}

// True when BOTH people are already on Medicare when the plan opens, which is when an ACA income
// cap stops meaning anything at all: yr.acaLapsed is then true in every year, the engine runs
// Proportional 0% throughout, and an ACA label describes nothing the row did. It gates the ACA
// family out of the Optimizer's sweep and flags the rows that reach the table anyway (a plan
// loaded from a URL, or the CURRENT PLAN row) as untenable.
// Lived in optimizer_ui.js until the strategy enumeration moved here and needed it.
//
// It had an OR-sibling, eitherOnMedicareAtStart, deleted after P35 PR 3c (v11.1462). That one
// declared a row untenable as soon as ONE spouse was on Medicare, on the reasoning that their
// RMDs/SS push household MAGI past any FPL cap. The reasoning was right and the conclusion was
// too broad: a 66/62 couple has real ACA years, and those breach years are now MEASURED through
// totals.acaBreachYears rather than assumed away on day one. Do not reintroduce it - the
// measurement is strictly better evidence than the predicate was.
function bothOnMedicareAtStart(by1, startAge, hasSpouse, by2) {
    if (!by1 || !startAge) return false;
    const startYear  = by1 + startAge;
    const medAge     = TAXData.IRMAA.ELIGIBILITY_AGE;
    const p1Medicare = startAge >= medAge;
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

    const STEP = 25000;
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
        // against for optimizeSpend/optimizeSpendDown. No-op for non-GK strategies.
        if (gkSpendStable(res, strategyOverrides, baseInputs)) {
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
// Guyton-Klinger plan "affords" any conversion by starving future spend via its own guardrails.
function _conversionHelpsAtRate(baseInputs, strategyOverrides, rate, spendableWeight) {
    const totalIRA = (baseInputs.IRA1 || 0) + (baseInputs.IRA2 || 0);
    if (totalIRA <= 0) return false;
    const scoreOf = (c) => {
        const res = simulate({ ...baseInputs, ...strategyOverrides, extraConversionAmount: c });
        if (!gkSpendStable(res, strategyOverrides, baseInputs)) return null;
        return baselineScoreOf(res, rate, spendableWeight);
    };
    const baseScore = scoreOf(0);
    if (baseScore == null) return false;
    const STEP = 25000;
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
// pins the monotonicity property directly.
//
// Returns { rate, optConv, gain } with optConv/gain refined by the real $25k sweep at the found
// rate, or null when no rate up to maxRate makes conversions worthwhile (itself a real finding).
function breakEvenHeirsRate(baseInputs, strategyOverrides = {}, opts = {}) {
    const minRate    = opts.minRate ?? 0.05;
    const maxRate    = opts.maxRate ?? 0.75;
    const resolution = opts.resolution ?? 0.01;
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
    const coarse = opts.coarseSteps ?? 4;

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

    // Refine on the real $25k grid around the winner, re-testing neighbouring cutoffs since the
    // best cutoff shifts as the amount moves.
    const span = Math.max(25000, Math.round(totalIRA / 16));
    const coarseBest = { ...best };
    const lo = Math.max(25000, coarseBest.amount - span);
    const hi = Math.min(totalIRA, coarseBest.amount + span);
    for (let a = Math.ceil(lo / 25000) * 25000; a <= hi; a += 25000) {
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
    const resolution = opts.resolution ?? 0.01;
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
// sweep (.test_harnesses/GAPFILL_RESULTS.md sections 10 and 15), ordered by how often each was
// the best of all 24 and, on a tie, by how much was at stake when it won. CBRI and CIBR win most
// and were not offered at all before v11.163F. RIBC and BIRC won nothing anywhere in that grid
// and are kept because they are the Roth-first and brokerage-first stress tests they were added
// for, not because the sweep argues for them.
const ORDERED_SEQS = ['CBRI', 'CBIR', 'CIBR', 'BCIR', 'RIBC', 'BIRC'];


// ── Strategy enumeration ──────────────────────────────────────────────────────────────────────
// The two sweeps do NOT sweep the same space, and the difference is deliberate. It is declared
// here as two pinned grids rather than left to drift between an inline block in the UI and this
// file. `bracket` is absent from both because its ladder is read from TAXData at call time.
//
// Monte Carlo is the narrower of the two: no IRMAA-ceiling family, no ACA family, and IRA Draw
// stops at 10% where the Optimizer runs to 20%. MC multiplies its row count by numPaths, so an
// arm costs it far more than it costs a single-pass table.
const MC_GRIDS = {
    propwd:   [0, 5, 10, 20, 50],
    fixed:    [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25],
    fixedpct: [5, 6, 7, 8, 10],
    ordered:  ORDERED_SEQS,
};
const OPTIMIZER_GRIDS = {
    propwd:   [0, 5, 10, 20, 50],
    // Coarser than MC's 16 steps, and deliberately. Reduce was 80 of the Optimizer's 218 rows -
    // 37% of the table - for a family whose neighbouring years differ by very little, and every
    // row is paid for four times over once the 🗘/🔄 and 🅡 clone passes and the no-conversion
    // baseline have had it. The endpoints are approximately preserved (3 for 2, 23 for 25), and a
    // user sitting between steps still gets their own value as a row: offGridParamFor adds it.
    fixed:    [3, 7, 11, 17, 23],
    // Odd steps, 5 through 13. NOT a superset of MC's [5, 6, 7, 8, 10] any more: the Optimizer no
    // longer tries 6% or 8%, and MC does not try 9%, 11% or 13%. The two sweeps have always
    // differed on purpose, but this is the first place where each has a value the other lacks, so
    // an IRA Draw row in one tab may have no twin in the other. A user above 13% still gets scored:
    // offGridParamFor adds their own percentage as its own row.
    fixedpct: [5, 7, 9, 11, 13],
    ordered:  ORDERED_SEQS,
    irmaaTiers:   [0, 1, 2, 3, 4],
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

// Strategies the 🅡 clone pass skips. Exactly one, and it is the one `fillSpendingGap` itself
// excludes: Ordered runs the account sequence the user chose, so a clone would be a twin.
//
// This started life as an allow-list of four families, on the strength of P28g's note that the
// effect is per-family and that Proportional and Guyton-Klinger are not comparable. That note is
// about what a RESEARCH cell can be read as, not about whether the lever reaches the strategy, and
// it should never have become a shipping gate. GK has no ordering logic of its own at all - its
// only special handling is the spend adjustment above - so it falls into the same default gap-fill
// branch as everything else, and measurement says it is the family that benefits most reliably:
// positive in all 15 of its harness cells, +$8,683 to +$195,107. Its gain simply arrives as
// delivered SPENDING rather than terminal wealth, because the guardrail converts a healthier
// portfolio into a higher spend - and baselineScoreOf counts that on purpose. Proportional is a
// weaker case, since planPrimaryWithdrawals usually funds spending directly, but "usually" is not
// "never": it reached +$11,959 in the larger default mix.
const ROTH_GAP_EXCLUDED = new Set(['ordered']);

/**
 * Enumerate the strategy arms of a sweep. Pure: no DOM, no simulate(), no TAXData beyond the
 * federal bracket ladder. Returns one entry per row, in emitted order:
 *
 *   { family, modifier, strategyLabel, paramLabel, paramSortVal, overrides }
 *
 * `family` is undecorated and `modifier` is null | 'ira-first' | 'brokerage-first' | 'cash', so a
 * caller can build its own label shape; `strategyLabel` is the prefixed HTML form the Optimizer
 * table uses, supplied because it is the common case.
 *
 * Every divergence between the two sweeps is an explicit option, so a reader can see at each call
 * site exactly what that sweep does and does not cover:
 *   grids            OPTIMIZER_GRIDS or MC_GRIDS
 *   irmaaFamily      sweep the 5 IRMAA ceiling tiers as their own family
 *   acaFamily        sweep the 4 ACA FPL cliffs. The CALLER applies its own gate - the Optimizer
 *                    passes bothOnMedicareAtStart, since an ACA cap is pointless once both are on
 *                    Medicare. MC does not sweep this family at all.
 *   bracketResetsIRMAATier  write stratIRMAATier:-1 onto Fill Bracket rows so a sidebar tier
 *                    selection cannot leak into them
 *   markCashFunding  write fundConversionWithCash:false onto every un-cloned row, so a user who
 *                    already has it on gets an A/B against the 💵 clones rather than two identical
 *                    arms. Only meaningful when cashClones is also on
 *   cashClones       append the 💵 clones. Caller gates on Cash > 0: at $0 Cash the mechanism is a
 *                    hard no-op and the clones would be bit-identical twins, pure wasted runs
 *   rothClones       append the 🅡 clones - the same strategy with Roth drawn after Cash instead of
 *                    last - for every family except the ones in ROTH_GAP_EXCLUDED. Also writes rothGapFill:''
 *                    onto every un-cloned row, for the reason markCashFunding exists: a user who
 *                    already set the control would otherwise get two identical arms instead of an
 *                    A/B. Caller gates on Roth > 0. Monte Carlo does NOT pass this - it pays
 *                    numPaths x variations, so a dimension is far more expensive there
 *   offGridLast      put the user's own off-grid parameter after Guyton-Klinger (the Optimizer)
 *                    rather than straight after IRA Draw (MC)
 *
 * Recorded before this function existed, and pinned against it: sweep_golden.js.
 */
function buildStrategyFamilies(base, opts = {}) {
    const {
        grids = MC_GRIDS,
        irmaaFamily = false,
        acaFamily = false,
        bracketResetsIRMAATier = false,
        markCashFunding = false,
        cashClones = false,
        rothClones = false,
        offGridLast = false,
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
        const ov = { ...offGrid.overrides, convertExcessToRoth: convOn };
        if (bracketResetsIRMAATier && offGrid.overrides.strategy === 'bracket') ov.stratIRMAATier = -1;
        push(offGrid.family, offGrid.paramLabel, offGrid.paramSortVal, ov);
    };
    if (!offGridLast) addOffGrid();

    for (const seq of grids.ordered)
        push('Ordered', seq, seq, { strategy: 'ordered', orderedSeq: seq, convertExcessToRoth: convOn });

    // Guyton-Klinger - a single row, labelled with the user's own guardrails, e.g. "Grd:20 Adj:10".
    push('Guyton-Klinger',
        `Grd:${Math.round((base.gkGuard ?? 0.20) * 100)} Adj:${Math.round((base.gkAdjPct ?? 0.10) * 100)}`,
        0,
        { strategy: 'gk', gkGuard: base.gkGuard, gkAdjPct: base.gkAdjPct, convertExcessToRoth: convOn });

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
                overrides: { ...r.overrides, rothGapFill: 'fillCashThenRoth' },
            });
        }
    }

    return rows;
}

// Build the full variation list (same parameter sweep as the optimizer) without running
// simulations. Used by both the optimizer and Monte Carlo module.
// base: result of getInputs() - no DOM access needed after this point.
function buildVariations(base) {
    // MC's slice of the shared enumeration. Everything it does NOT do is visible right here:
    // no IRMAA-ceiling family, no ACA family, no stratIRMAATier reset on the Fill Bracket rows,
    // and the off-grid row sits straight after IRA Draw rather than last. The 💵 clones are NOT
    // nerdknob-gated on this side - MC has no nerdknob - but they are still skipped at $0 Cash,
    // where the mechanism is a hard no-op and the clones would be bit-identical twins (MC runs
    // numPaths × variations.length trials, so a wasted arm is expensive here).
    const families = buildStrategyFamilies(base, {
        grids: MC_GRIDS,
        cashClones: base.Cash > 0,
    });

    // MC's label shape: `_strategyFamily` takes the HTML prefix the builder already applied,
    // while `_label` needs the PLAIN-text twin - it is read into chart legends and CSV, where
    // markup would show through.
    // 'rothgap' is here even though MC does not ask for those clones: the map is keyed by modifier,
    // and a modifier missing from it would lose its prefix silently rather than fail.
    const PLAIN_PREFIX = { 'ira-first': '\u{1F5D8} ', 'brokerage-first': '\u{1F504} ', 'cash': '\u{1F4B5} ', 'rothgap': '\u{1F161} ' };

    return families.map(f => ({
        ...base,
        // A swept variation must not silently inherit a leftover sidebar value (e.g. from
        // loading an Optimizer ⇌ row) - no overrides block in the enumeration sets this key.
        // Non-mutating (unlike runOptimizer()'s equivalent guard): `base` here is the SAME
        // object reference callers keep as _mcBase / the "Current Plan" stress fallback,
        // which must keep the real sidebar value.
        extraConversionAmount: 0,
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
 * Unlike the per-year `totalWealth` (which uses the current-year ordinary marginal for the
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
    if (Math.abs(realRate) < 0.0001) {
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
// INITIALIZATION - Call on page load
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { simulate, optimizeSpend, suggestSustainableSpend, suggestSpendMenu, bengenRate, SUGGEST_BUFFER_YEARS, SUGGEST_RISKY_BUFFER_YEARS, SUGGEST_MIDDLE_KEEP_REAL, getLTCGBracketRoom, compactNum, afterTaxNetWorth, afterTaxWealthOfLogRow, computeBETR, diagnoseConvBreakEvenFailure, bestConversionStopYear, optimizeConversionAmount, breakEvenHeirsRate, lowestBreakEvenHeirsRate, bestTimeLimitedConversion, baselineScoreOf, selectConversionCandidates, SPENDABLE_WEIGHT, OPTIMIZER_OBJECTIVES, rankRowsByObjective, afterTaxBucketSpread, OPT_DELTA_COLUMNS, OPT_BASELINE_REQUIRES, OPT_OBJECTIVE_BLURB, OPT_OBJECTIVE_METRIC_COLUMN, OPT_OBJECTIVE_COLUMNS, OPT_COLUMNS_PINNED, OPT_COLUMN_KEYS, bothOnMedicareAtStart, taxCreepFactor, IRMAA_MARGIN_MODES, IRMAA_MARGIN_DEFAULT, irmaaMarginModeOf, irmaaFwdFactor, irmaaMarginDollars, onMedicareAtCharge, buildVariations, buildStrategyFamilies, MC_GRIDS, OPTIMIZER_GRIDS, ORDERED_SEQS, sameStrategySelection, offGridParamFor, resolveOrderedSeq, ssFirstYearFraction, fraMonthsForBirthYear, calculateSurvivorBenefit };
} else if (typeof window !== 'undefined') {
    // Same list, for the browser tier of the test suite. The page does not need it - the engine
    // is a classic script and the page calls these as bare globals. But that reachability is
    // uneven and the unevenness is silent: `function simulate` becomes a property of globalThis,
    // while `const MC_GRIDS` and `const OPTIMIZER_GRIDS` are global LEXICAL bindings and are not.
    // A test reading them off globalThis would get undefined and fail somewhere downstream
    // instead of at the mistake. One namespace object removes the guesswork.
    window.OptimizerCore = { simulate, optimizeSpend, suggestSustainableSpend, suggestSpendMenu, bengenRate, SUGGEST_BUFFER_YEARS, SUGGEST_RISKY_BUFFER_YEARS, SUGGEST_MIDDLE_KEEP_REAL, getLTCGBracketRoom, compactNum, afterTaxNetWorth, afterTaxWealthOfLogRow, computeBETR, diagnoseConvBreakEvenFailure, bestConversionStopYear, optimizeConversionAmount, breakEvenHeirsRate, lowestBreakEvenHeirsRate, bestTimeLimitedConversion, baselineScoreOf, selectConversionCandidates, SPENDABLE_WEIGHT, OPTIMIZER_OBJECTIVES, rankRowsByObjective, afterTaxBucketSpread, OPT_DELTA_COLUMNS, OPT_BASELINE_REQUIRES, OPT_OBJECTIVE_BLURB, OPT_OBJECTIVE_METRIC_COLUMN, OPT_OBJECTIVE_COLUMNS, OPT_COLUMNS_PINNED, OPT_COLUMN_KEYS, bothOnMedicareAtStart, taxCreepFactor, IRMAA_MARGIN_MODES, IRMAA_MARGIN_DEFAULT, irmaaMarginModeOf, irmaaFwdFactor, irmaaMarginDollars, onMedicareAtCharge, buildVariations, buildStrategyFamilies, MC_GRIDS, OPTIMIZER_GRIDS, ORDERED_SEQS, sameStrategySelection, offGridParamFor, resolveOrderedSeq, ssFirstYearFraction, fraMonthsForBirthYear, calculateSurvivorBenefit };
}


