// CONFIGURATION CONSTANTS
// ============================================================================

// Version constant - increment this when data structure changes
const SCENARIO_VERSION = 4;

// New storage key for current version scenarios
const STORAGE_KEY = 'SLCRetireOptimizeScenario';

// Old storage key from previous version
const OLD_STORAGE_KEY = 'retirementScenarios';

// Spend optimizer constants
const SPEND_SEARCH_CEILING   = 0.50;  // Binary search upper bound: 50% above baseline spend
const SPEND_SEARCH_TOLERANCE = 0.005; // Stop binary search when bounds are within 0.5%
const SPEND_SEARCH_MIN_DELTA = 0.03;  // Minimum improvement to show "increase spending" banner

// Feature flags
// NERD_KNOBS: shows advanced controls (Monte Carlo params, etc.). Enabled via ?nerdknob URL param.
const NERD_KNOBS = new URLSearchParams(location.search).has('nerdknob');



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

function getRateBracket(entity, status) {
    let brks = TAXData?.[entity]?.[status]?.brackets;

    if (!brks) {
        console.error(`Invalid tax data: entity="${entity}", status="${status}"`);
        return null
    };

    return brks
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

/**
 * Find the income limit for a specified marginal tax rate within tax brackets.
 * Returns the highest bracket limit where the rate is less than or equal to the target rate.
 * Uses TAXdata structure to retrieve bracket information.
 * 
 * @param {string} entity - Tax entity identifier (e.g., 'federal', 'CA', 'IRMAA', 'SS')
 * @param {string} status - Filing status (e.g., 'single', 'joint', 'mfs', 'hoh')
 * @param {number} tgtrate - Target marginal tax rate to find limit for
 * @param {number} [inflation=1] - Inflation multiplier for bracket limits (default: 1)
 * @returns {Object} Bracket limit results
 * @returns {number} return.limit - Income limit at or below the target rate (0 if no match)
 * @returns {number} return.rate - Actual rate of the bracket found
 * @note Does not validate input parameters for reasonableness
 */
function findLimitByRate(entity, status, tgtrate, inflation = 1) {
    let brks = getRateBracket(entity, status)

    let limit = 0;
    let rate = 0;

    for (let b of brks) {
        if (b.r <= tgtrate) {
            limit = b.l * inflation;
            rate = b.r;
        } else break;
    }
    return { limit, rate: rate }
}


// We want to find the limit of the next bracket HIGHER than the amount given (that is the upper limit).
// For example if the limits are 10, 100, 1000 and the amount is 150 - we want the 1000 (less 1).
// If amount is 99, we want 100.
function findUpperLimitByAmount(entity, status, amount, inflation = 1) {
    let limit = 0;
    let rate = 0;
    let nominalRate = 0.0;
    let brks = getRateBracket(entity, status)

    for (let b of brks) {
        if (b.l * inflation <= amount) {
            rate = b.r;
            nominalRate = b.nr ?? 0;
        } else {
            limit = b.l * inflation - 1;
            break;
        }
    }
    return { limit, rate: rate, nominalRate: nominalRate }
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
// Social Security Survivor Benefit (SSA formula, FRA = 67)
// ============================================================================

/**
 * Returns the final monthly SS benefit for a surviving spouse.
 * @param {number} userAgeAtDeath       - Deceased's age at death
 * @param {number} userClaimAge         - Age the deceased claimed (or planned to claim) SS
 * @param {number} userMonthlyBenefit   - Deceased's monthly benefit at their claiming age
 * @param {number} spouseClaimAge       - Age the survivor claims their benefit
 * @param {number} spouseMonthlyBenefit - Survivor's own monthly benefit at their claiming age
 * @returns {number} Monthly dollar amount the survivor receives
 */
function calculateSurvivorBenefit(
    userAgeAtDeath, userClaimAge, userMonthlyBenefit,
    spouseClaimAge, spouseMonthlyBenefit
) {
    const FRA_MONTHS = 67 * 12;
    const userClaimMonths  = Math.round(userClaimAge  * 12);
    const userDeathMonths  = Math.round(userAgeAtDeath * 12);
    const spouseClaimMonths = Math.round(Math.max(spouseClaimAge, 60) * 12);

    // Step 1: Derive deceased's PIA at FRA from their benefit at claiming age
    let userPIA;
    if (userClaimMonths >= FRA_MONTHS) {
        const delayedMonths = userClaimMonths - FRA_MONTHS;
        userPIA = userMonthlyBenefit / (1 + delayedMonths * (0.08 / 12));
    } else {
        const reductionMonths = FRA_MONTHS - userClaimMonths;
        const reductionFactor = reductionMonths <= 36
            ? reductionMonths * (5 / 9 / 100)
            : (36 * (5 / 9 / 100)) + ((reductionMonths - 36) * (5 / 12 / 100));
        userPIA = userMonthlyBenefit / (1 - reductionFactor);
    }

    // Step 2: Deceased's baseline for survivor purposes.
    // SS rules: if deceased claimed early, survivor is NOT penalized — baseline is PIA.
    // If deceased claimed late (delayed credits), survivor receives the full enhanced benefit.
    // Delayed credits stop at the claiming age (never accumulate past claim date or age 70).
    // So the baseline is simply the higher of PIA and the actual benefit at claiming age.
    const deceasedBaseline = Math.max(userPIA, userMonthlyBenefit);

    // Step 3: Apply survivor's early-claiming reduction if before FRA
    let rawSurvivorBenefit;
    if (spouseClaimMonths >= FRA_MONTHS) {
        rawSurvivorBenefit = deceasedBaseline;
    } else {
        const totalPossibleEarlyMonths = FRA_MONTHS - 720; // 67→60 = 84 months
        const earlyMonths = FRA_MONTHS - spouseClaimMonths;
        rawSurvivorBenefit = deceasedBaseline * (1 - (earlyMonths / totalPossibleEarlyMonths) * 0.285);
    }

    // Step 4: Higher-of rule — survivor gets their own benefit if larger
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
    let prevLimit = 0;
    for (const { l, r } of brackets) {
        if (r >= maxRate) break;
        const limit = l * cpiRate;
        if (ordinaryIncome < limit) return limit - Math.max(ordinaryIncome, prevLimit);
        prevLimit = limit;
    }
    return 0;
}

let simulationCount = 0;
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
    let totals = { tax: 0, gross: 0, spend: 0, yearsfunded: 0, success: true, yearstested: 0, failedInYear: [], shortfall: 0, taxCurrentDollars: 0, spendCurrentDollars: 0, rmd: 0, rmdTax: 0, thirdPassCount: 0, thirdPassTime: 0, totalTime: 0 };

    // Pre-compound rates for any gap between today and the simulation start year.
    // This ensures brackets, SS COLA, and IRMAA are in the correct future-dollar terms
    // from year 1 of the loop, rather than starting from today's (1.0) base.
    const gapYears = Math.max(0, currentYear - new Date().getFullYear());
    let cpiRate      = Math.pow(1 + inputs.cpi,      gapYears);
    let inflation    = Math.pow(1 + inputs.inflation, gapYears);
    let medicareRate = Math.pow(1 + TAXData.IRMAA.ANNUAL_INCREASE, gapYears);
    let fixedWithdrawal = 0;
    let currentTaxableGuess = 0;
    let spendDelta = 1 + inputs.spendChange;
    let spendGoal = inputs.spendGoal * Math.pow(1 + inputs.inflation, gapYears);
    let cumulativeTaxes = 0;
    let nominalTaxRate = 0.20; // Just a guess.
    let marginalTaxRate = 0.33; // Just a guess.
    let capitalGainsRate = 0.15; // A guess.
    let tax = {};

    // Phase 20: opportunity cost shadow tracking.
    // convShadowDeltaIRA: cumulative gross conversion amounts that would have stayed in IRA (grown each year).
    // convShadowDeltaTaxable: cumulative conv taxes not paid from taxable (0 in current model; taxes come from IRA gross).
    // excessShadowDeltaIRA: cumulative gross excess-to-cash amounts that would have stayed in IRA.
    // excessShadowDeltaTaxable: negative — actual taxable has more cash from excess withdrawal; shadow has less.
    let convShadowDeltaIRA = 0, convShadowDeltaTaxable = 0;
    let excessShadowDeltaIRA = 0, excessShadowDeltaTaxable = 0;



    /**************************************
     * PROCESS:
     *   Determine tax status.
     *   Determine SS & pension income.
     *   Determine withdrawal target and order based on strategy:
     *
     *   strategy='fixed'    — "Reduce IRA in N Years"
     *       Amortizes the IRA over nYears. Each year withdraws the amortized
     *       amount from IRA only (RMDs count toward the target). Spending
     *       shortfall after IRA draw is filled from Cash → Brokerage → Roth.
     *       WithdrawalOrder = [IRA first, then gap-fill]
     *
     *   strategy='propwd'   — "Proportional Withdraw +%"
     *       Withdraws proportionally across IRA/Brokerage/Cash to meet the
     *       spend goal (original "baseline" behavior at 0%). An optional IRA
     *       boost of propWithdraw × spendGoal is added on top; the after-tax
     *       surplus flows to Roth conversion or Cash. At 0% this is the pure
     *       proportional baseline.
     *       WithdrawalOrder = [IRA, Brokerage, Cash] proportionally
     *
     *   strategy='bracket'  — "Fill Federal Tax Bracket" / "IRMAA Ceil" / "ACA Cliff"
     *       Draws IRA up to a ceiling (federal bracket top, an IRMAA tier, or
     *       an ACA FPL multiple). Spending shortfall fills from Cash →
     *       Brokerage → Roth. Also covers strategy='minlimit' (Lesser of
     *       IRMAA or Tax Bracket).
     *       WithdrawalOrder = [IRA up to ceiling, then gap-fill]
     *
     *   strategy='fixedpct' — "IRA Draw %"
     *       Withdraws a fixed percentage of the starting-year IRA balance each
     *       year regardless of spend goal. RMDs count toward the target.
     *       Spending shortfall fills from Cash → Brokerage → Roth.
     *       WithdrawalOrder = [IRA first, then gap-fill]
     *
     *   (else / fallback)   — legacy proportional baseline
     *       Same proportional logic as propwd at 0%, retained for backwards
     *       compatibility. No UI option currently routes here.
     *       WithdrawalOrder = [IRA, Brokerage, Cash] proportionally
     *
     *   NOTE — future strategy='baseline' (not yet implemented):
     *       A rigorous tax-efficient depletion order: RMD first, then taxable
     *       accounts (Brokerage, Cash) until exhausted, then IRA, then Roth.
     *       Intended as a comparison baseline that never voluntarily draws down
     *       tax-deferred assets ahead of taxable ones.
     *       WithdrawalOrder = [RMD → Brokerage/Cash → IRA → Roth]
     *
     *************************************/

    // Phase 24: Cyclic — tracks consecutive IRA draw years before a brokerage harvest year.
    // brokerage-first: init to large value so year 0 immediately triggers a harvest.
    let subCycleIRAYears = inputs.cyclicOrder === 'brokerage-first' ? Infinity : 0;
    // Seed year-1 spend rate denominator with starting portfolio total.
    // Uses raw sum (no tax discount) — closest to "assets in hand" before simulation starts.
    let prevTotalWealth = balance.IRA1 + balance.IRA2
        + balance.Roth1 + balance.Roth2
        + balance.Brokerage + balance.Cash;

    for (let y = 0; y < maxYears; y++) {
        const loopStart = performance.now();
        fixedWithdrawal = calculateAmortizedWithdrawal(balance.IRA1 + balance.IRA2, inputs.iraBaseGoal, inputs.nYears - y, inputs.growth)


        let withdrawals = { IRA: 0, IRA1: 0, IRA2: 0, Roth: 0, Brokerage: 0, BrokerageBasis: 0, Cash: 0 };
        let netWithdrawals = withdrawals;

        // Age at December 31 of the simulation year — the IRS convention for RMD eligibility.
        // Everyone has had their birthday by Dec 31, so no birth-month adjustment is needed.
        let age1 = currentYear - birthyear1;
        let age2 = currentYear - birthyear2;
        let alive1 = age1 <= inputs.die1;
        let alive2 = age2 <= inputs.die2;
        if (!alive1 && !alive2) break;

        totals.yearstested += 1;

        let status = (alive1 && alive2) ? 'MFJ' : 'SGL';
        // IRMAA is already known since it is based on income from 2 years ago.
        let irmaa = calcIRMAA(balance.magiHistory[balance.magiHistory.length - 2], status, cpiRate, medicareRate);

        // Calculate the bracket limits based on: stated limit.
        // let tgtBracketLimit = findLimitByRate('FEDERAL',status,inputs.stratRate)

        // Find federal & state rates and limits by spending goal:
        let goalFedBracketLimit = findUpperLimitByAmount('FEDERAL', status, spendGoal, cpiRate)
        let goalStateBracketLimit = findUpperLimitByAmount(STATEname, status, spendGoal, cpiRate)
        let goalLimit = Math.min(goalFedBracketLimit.limit, goalStateBracketLimit.limit)
        let irmaaBracket = findUpperLimitByAmount('IRMAA', status, goalLimit, cpiRate)
        let irmaLimit = Math.min(goalLimit, irmaaBracket.limit);
        let totalIncome = 0;
        let netIncome = 0;
        let capitalGains = 0;
        let bracketTarget = 0;  // ceiling being targeted by bracket/minlimit strategies
        let bracketOverage = 0; // how far MAGI exceeded bracketTarget (0 when no bracket strategy)

        // INCOMPLETE: if spendGoal > bracketTarget and non-taxable accounts (Cash/Roth) can't
        // cover the gap, the simulation proceeds anyway, silently overspending the bracket.
        // The isBracketInfeasible flag (~line 1503) partially handles this; a fuller fix would
        // display the per-year overage in the Annual Details table and/or warn at plan load.

        // 1. Inherit IRA
        if (!alive1 && balance.IRA1 > 0) { balance.IRA2 += balance.IRA1; balance.IRA1 = 0; }
        if (!alive2 && balance.IRA2 > 0) { balance.IRA1 += balance.IRA2; balance.IRA2 = 0; }


        // 2. Base Income
        let ssReduction = (inputs.ssFailYear > 2000 && currentYear >= inputs.ssFailYear) ? inputs.ssFailPct : 1;
        let potentialS1 = (age1 >= inputs.ss1Age) ? inputs.ss1 * cpiRate * ssReduction : 0;
        let potentialS2 = (age2 >= inputs.ss2Age) ? inputs.ss2 * cpiRate * ssReduction : 0;
        let s1 = alive1 ? potentialS1 : 0;
        let s2 = alive2 ? potentialS2 : 0;
        let pension = inputs.pensionAnnual * (inputs.pensionCola ? inflation : 1);

        // One is deceased (if both decease, it won't get here)
        if (!alive1 || !alive2) {
            let rawSurvivorMonthly;
            if (!alive1) {
                // Person 2 (spouse) is survivor
                rawSurvivorMonthly = calculateSurvivorBenefit(
                    inputs.die1, inputs.ss1Age, inputs.ss1 / 12,
                    inputs.ss2Age, inputs.ss2 / 12
                );
                pension = pension * (inputs.survivorPct / 100);
            } else {
                // Person 1 (user) is survivor
                rawSurvivorMonthly = calculateSurvivorBenefit(
                    inputs.die2, inputs.ss2Age, inputs.ss2 / 12,
                    inputs.ss1Age, inputs.ss1 / 12
                );
            }
            const survivorAge      = alive1 ? age1 : age2;
            const survivorStartAge = alive1 ? inputs.ss1Age : inputs.ss2Age;
            s1 = survivorAge >= survivorStartAge
                ? rawSurvivorMonthly * 12 * cpiRate * ssReduction
                : 0;
            s2 = 0;
        }
        let fixedInc = s1 + s2;					// Social Security
        let taxableInc = pension;				// Pensions, W2, RMDs, IRA withdrawals, wdBrokerage

        // These will be APPROXIMATE worst case - no Withdrawals have been made.
        let taxableInterest = balance.Cash * inputs.cashYield
        let taxableDividends = balance.Brokerage * inputs.dividendRate


        // 3. RMDs
        let rmd1Pct = getRMDPercentage(currentYear, birthyear1);
        let rmd2Pct = getRMDPercentage(currentYear, birthyear2);
        let rmd1 = alive1 ? balance.IRA1 * rmd1Pct || 0 : 0;
        let rmd2 = alive2 ? balance.IRA2 * rmd2Pct || 0 : 0;
        rmd1Pct = Math.max(rmd1Pct, rmd2Pct, 0);
        rmd1Pct = Math.max(rmd1Pct, rmd2Pct, 0);

        // Immediately remove RMDs from the respective IRAs because they MUST be taken first.
        // FUTURE FEATURE: QCDs (Qualified Charitable Distributions, age 70.5+, max ~$108k/person/yr)
        // satisfy RMDs without adding to taxable income or MAGI. Implementation:
        //   1. Add qcd1/qcd2 annual inputs to UI
        //   2. rmdRemaining = max(0, rmd - qcd); IRA balance unchanged for qcd portion
        //   3. taxableInc += rmdRemaining (not totalRMD) — reduces IRMAA exposure
        //   4. Log 'QCD1','QCD2' columns for visibility
        balance.IRA1 = Math.max(0, balance.IRA1 - rmd1);
        balance.IRA2 = Math.max(0, balance.IRA2 - rmd2);
        let curIRA = Math.max(0, balance.IRA1 + balance.IRA2 - inputs.iraBaseGoal);



        let totalRMD = rmd1 + rmd2;
        taxableInc += totalRMD
        let possibleIncome = taxableInc + taxableDividends + taxableInterest + fixedInc;

        // 4. Determine Target Spending amount based on Strategy
        const isBracketStrategy = inputs.strategy === 'bracket' || inputs.strategy === 'minlimit' || inputs.strategy === 'fixedpct';
        const isOrderedStrategy = inputs.strategy === 'ordered';

        function resolveOrderedSeq(seq) {
            const taxB = capGainsPercentage * (capitalGainsRate + nominalStateTaxAtLimit);
            const taxI = Math.max(nominalTaxRate, marginalFedTaxRate + marginalStateTaxRate);
            const map = {
                CBIR: [['Cash', 0], ['Brokerage', taxB], ['IRA', taxI], ['Roth', 0]],
                RIBC: [['Roth', 0], ['IRA', taxI], ['Brokerage', taxB], ['Cash', 0]],
                BIRC: [['Brokerage', taxB], ['IRA', taxI], ['Roth', 0], ['Cash', 0]],
            };
            return map[seq] ?? map['CBIR'];
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

        let targetSpend = (isBracketStrategy || isOrderedStrategy) ? spendGoal : Math.min(spendGoal, goalLimit);
        let additionalSpendNeeded = Math.max(0, targetSpend + irmaa - possibleIncome);

        // INCOMPLETE: marginalFedTaxRate and marginalStateTaxRate are set to the rates AT the
        // spendGoal bracket, not refined to the next lower IRMAA/state limit. To fix: after
        // finding goalFedBracketLimit, walk down findLimitByRate() to find the ceiling that
        // keeps MAGI below the next IRMAA threshold, then re-derive the state bracket ceiling.
        let marginalFedTaxRate = goalFedBracketLimit.rate
        let marginalStateTaxRate = goalStateBracketLimit.rate

        //	calculateProgressive('FEDERAL', status, amount, inflation=1, ratecreep=1)

        let nominalFedTaxRateAtLimit = 0.14;
        let nominalStateTaxAtLimit = 0.07
        let withdrawStrategy = { order: [], weight: [], taxrate: [] };

        let curBalances = { IRA: balance.IRA1 + balance.IRA2, Brokerage: balance.Brokerage, BrokerageBasis: balance.BrokerageBasis, Roth: balance.Roth1 + balance.Roth2, Cash: balance.Cash, IRA1: balance.IRA1, IRA2: balance.IRA2 };

        let capGainsPercentage = balance.Brokerage !== 0
            ? (balance.Brokerage - balance.BrokerageBasis) / balance.Brokerage
            : 0;

        // Phase 24: Cyclic — determine if this is a brokerage harvest year.
        // N = ratio of IRA to Brokerage balances (min 1). After N IRA years, one brokerage year.
        let isBrokerageYear = false;
        let subCycleLabel = null;
        if (inputs.cyclicEnabled) {
            if (curBalances.Brokerage > 0) {
                const _cycN = Math.max(1, Math.round(curBalances.IRA / curBalances.Brokerage));
                if (subCycleIRAYears >= _cycN) {
                    isBrokerageYear = true;
                    subCycleIRAYears = 0;
                } else {
                    subCycleIRAYears++;
                }
            } else {
                subCycleIRAYears++;   // Brokerage depleted; keep counting IRA years
            }
            subCycleLabel = isBrokerageYear ? 'B' : 'I';
        }

        if (isBrokerageYear) {
            // Brokerage harvest year: draw spending from Brokerage instead of IRA.
            // For bracket strategy, cap at 0%-rate LTCG headroom; for all others, draw to meet spend target.
            const _baseOrdinaryInc = taxableInc + fixedInc + taxableInterest + taxableDividends;
            let _brokerageNetTarget;
            if (isBracketStrategy) {
                const _ltcgRoom = getLTCGBracketRoom(_baseOrdinaryInc, status, 0.15, cpiRate);
                const _ltcgNetRoom = _ltcgRoom * (1 - capGainsPercentage * capitalGainsRate);
                _brokerageNetTarget = Math.min(additionalSpendNeeded, _ltcgNetRoom);
            } else {
                _brokerageNetTarget = additionalSpendNeeded;
            }
            if (_brokerageNetTarget > 1 && curBalances.Brokerage > 0) {
                // Depletion check: warn if Brokerage < 50% of what we need
                const _grossNeeded = _brokerageNetTarget / Math.max(0.01, 1 - capGainsPercentage * capitalGainsRate);
                if (curBalances.Brokerage < _grossNeeded * 0.5) {
                    subCycleLabel = '⚠B';
                }
                withdrawals = calculateWithdrawals(curBalances, _brokerageNetTarget,
                    { order: ['Brokerage'], weight: [1], taxrate: [capGainsPercentage * capitalGainsRate] });
            } else {
                withdrawals = {};
            }
        } else if (inputs.strategy === 'fixed') {
            // In this strategy, we confine withdrawals to the IRA for the first round. 
            // We don't care about the tax implications.

            let remYears = Math.max(1, inputs.nYears - y);
            let amortized = Math.max(0, fixedWithdrawal - totalRMD);

            // Withdraw the fixed amount left after RMDs, or whatever is left in IRAs after leaving room
            let IRAwd = Math.max(0, Math.min(curIRA, amortized))
            withdrawals = { IRA: IRAwd, netAmount: IRAwd }

        } else if (inputs.strategy === 'bracket' || inputs.strategy === 'minlimit') {
            let limit;

            if ((inputs.stratIRMAATier ?? -1) >= 0) {
                // IRMAA tier ceiling mode: fill MAGI up to the top of the chosen IRMAA tier.
                // Tier 0 = stay below Tier 1 threshold; Tier N = stay below Tier N+1 threshold.
                // IRMAA thresholds grow at CPI (see taxengine.js comment).
                const irmaaBrks = getRateBracket('IRMAA', status);
                limit = irmaaBrks[inputs.stratIRMAATier + 1].l * cpiRate - 1;
                // Approximate tax rates at this limit for downstream calcs
                const fedAtLimit = findUpperLimitByAmount('FEDERAL', status, limit, cpiRate);
                marginalFedTaxRate = fedAtLimit.rate;
                nominalFedTaxRateAtLimit = calculateProgressive('FEDERAL', status, limit, inflation).cumulative / (limit || 1);
                const stAtLimit = findUpperLimitByAmount(STATEname, status, limit, cpiRate);
                marginalStateTaxRate = stAtLimit.rate;
                nominalStateTaxAtLimit = calculateProgressive(STATEname, status, limit, inflation).cumulative / (limit || 1);
            } else if ((inputs.stratACAMultiple ?? 0) > 0) {
                // ACA FPL cliff mode: fill MAGI up to a multiple of the Federal Poverty Level.
                // FPL base values (2025): 2-person household $20,440; 1-person $15,060.
                // FPL is approximated as CPI-adjusted from 2025 (HHS updates annually).
                const FPL_2025 = status === 'MFJ' ? 20440 : 15060;
                // cpiRate at this point = (1+cpi)^y (year 0 = 2026). FPL adj from 2025 = (1+cpi)^(1+y).
                limit = Math.round(FPL_2025 * inputs.stratACAMultiple / 100 * cpiRate * (1 + inputs.cpi)) - 1;
                const fedAtLimit = findUpperLimitByAmount('FEDERAL', status, limit, cpiRate);
                marginalFedTaxRate = fedAtLimit.rate;
                nominalFedTaxRateAtLimit = calculateProgressive('FEDERAL', status, limit, inflation).cumulative / (limit || 1);
                const stAtLimit = findUpperLimitByAmount(STATEname, status, limit, cpiRate);
                marginalStateTaxRate = stAtLimit.rate;
                nominalStateTaxAtLimit = calculateProgressive(STATEname, status, limit, inflation).cumulative / (limit || 1);
            } else {
                // Federal bracket ceiling mode (original logic)
                let fedLimit = findLimitByRate('FEDERAL', status, inputs.stratRate, cpiRate);
                limit = fedLimit.limit;
                let fedTaxAtLimit = calculateProgressive('FEDERAL', status, limit, inflation);
                nominalFedTaxRateAtLimit = fedTaxAtLimit.cumulative / limit;
                marginalFedTaxRate = fedLimit.rate;

                let stLimit = findUpperLimitByAmount(STATEname, status, fedLimit.limit, cpiRate);
                marginalStateTaxRate = stLimit.rate;
                stateLimit = stLimit.limit;
                nominalStateTaxAtLimit = calculateProgressive(STATEname, status, limit, inflation).cumulative / limit;

                limit = Math.min(stateLimit, limit);

                if (inputs.strategy === 'minlimit') {
                    limit = Math.min(limit, irmaLimit);
                }
            }

            bracketTarget = limit;

            // Cap IRA draw at the bracket ceiling; any spending shortfall is filled from
            // Cash → Brokerage → Roth in the gap-fill pass below (bracket-strategy path).
            const iRAbracketRoom = Math.max(0, limit - taxableInc - fixedInc - taxableInterest - taxableDividends);
            const IRAwd = Math.min(curIRA, iRAbracketRoom);
            withdrawals = { IRA: IRAwd, netAmount: IRAwd };

        } else if (inputs.strategy === 'fixedpct') {
            // Withdraw a fixed % of the original IRA balance (before RMDs) each year.
            // RMDs already taken count toward the target; any excess beyond RMDs is the
            // additional draw. Spending shortfall fills from Cash → Brokerage → Roth below.
            const pct = inputs.iraWithdrawPct ?? 0.05;
            const originalIRA = balance.IRA1 + balance.IRA2 + totalRMD;
            const targetTotal = originalIRA * pct;
            const IRAwd = Math.max(0, Math.min(curIRA, targetTotal - totalRMD));
            withdrawals = { IRA: IRAwd, netAmount: IRAwd };

        } else if (inputs.strategy === 'propwd') {
            // Proportional +%: first withdraw proportionally for spending (same as baseline),
            // then add an IRA-only boost of propWithdraw × spendGoal strictly from IRA.
            // The after-tax surplus from the boost flows to Roth/Cash via step 7.
            withdrawStrategy.order = ['IRA', 'Brokerage', 'Cash'];
            withdrawStrategy.taxrate = [nominalTaxRate, capGainsPercentage * (capitalGainsRate + nominalStateTaxAtLimit), 0, 0];
            withdrawals = calculateWithdrawals(curBalances, additionalSpendNeeded, withdrawStrategy);
            const pct = inputs.propWithdraw ?? 0;
            if (pct > 0) {
                const remainingIRA = Math.max(0, curBalances.IRA - (withdrawals.IRA || 0));
                const boost = Math.min(spendGoal * pct, remainingIRA);
                withdrawals.IRA = (withdrawals.IRA || 0) + boost;
            }

        } else if (inputs.strategy === 'ordered') {
            // Ordered strategy: all spending handled in gap-fill to avoid surplus distortion.
            // Cash draws in the main block don't reduce possibleIncome, causing overdraw + refund loops.
            withdrawals = {};

        } else {
            /*********************/
            /* BASELINE Strategy */
            /*********************/
            // Withdraw enough proportionately to get to spendGoal - including taxes.
            withdrawStrategy.order = ['IRA', 'Brokerage', 'Cash']
            withdrawStrategy.taxrate = [nominalTaxRate, capGainsPercentage * (capitalGainsRate + nominalStateTaxAtLimit), 0, 0]
            withdrawals = calculateWithdrawals(curBalances, additionalSpendNeeded, withdrawStrategy)

        }


        applyWithdrawals(curBalances, withdrawals)
        inspectForErrors(curBalances, withdrawals)

        netWithdrawals = accumulateWithdrawals([netWithdrawals, withdrawals])
        capitalGains = Math.max(0, (netWithdrawals.Brokerage ?? 0) - (netWithdrawals.BrokerageBasis ?? 0));

        // 5. Tax Calc (Including IRMAA lag)
        // NOTE: This first tax pass may undercount income if the IRA accounts are exhausted
        // and Cash/Brokerage/Roth must backfill (handled ~line 884). The second tax pass
        // (~line 922) recalculates with updated withdrawals. If that second pass introduces
        // a bracket crossing, a third pass would be needed for accuracy. Current two-pass
        // approach is an accepted approximation.

        inspectForErrors({ fixedInc: fixedInc, totalRMD: totalRMD, taxableInterest: taxableInterest, capitalGains: capitalGains, taxableDividends: taxableDividends, age1: age1, age2: age2, cpiRate: cpiRate })


        let tax = calculateTaxes({
            filingStatus: status, ages: [age1, age2],
            totalSS: s1 + s2, irmaaAnnualCost: irmaa,
            earnedIncome: pension + totalRMD + netWithdrawals.IRA + taxableInterest, inflation: cpiRate,
            qualifiedDiv: taxableDividends, capGains: capitalGains, hsaContrib: 0,
            taxExemptInterest: 0, state: STATEname
        })
        inspectForErrors(tax)  // See if any numbers look fishy.

        marginalFedTaxRate = tax.fedRate;
        marginalStateTaxRate = tax.stRate;
        capitalGainsRate = tax.capitalGainsRate;

        //!!! Assume MAGI for prior to years is the same as this year. Should allow this to be entered

        let magiHistoryLength = balance.magiHistory.length
        if (magiHistoryLength < 1) {
            balance.magiHistory.push(tax.MAGI);
            balance.magiHistory.push(tax.MAGI);
        }

        let totalTax = tax.totalTax + irmaa;

        // 6. Cash Flow Gap
        // taxableInc includes pension, RMDs
        possibleIncome = taxableInc + taxableDividends + taxableInterest + fixedInc + netWithdrawals.IRA +
            capitalGains + (netWithdrawals.BrokerageBasis ?? 0);

        let netSpendable = possibleIncome - totalTax
        let gap = targetSpend - netSpendable;

        inspectForErrors({ netSpendable: netSpendable, gap: gap, totalTax: totalTax });

        if (gap > 1.00) {
            if (isBracketStrategy) {
                // Bracket/IRMAA strategies: supplement spending from Cash first, then Brokerage, then Roth.
                // This keeps supplemental draws out of taxable income as much as possible.
                const cashWd = calculateWithdrawals(curBalances, gap, { order: ['Cash'], weight: [1], taxrate: [0] });
                netWithdrawals = accumulateWithdrawals([netWithdrawals, cashWd]);
                applyWithdrawals(curBalances, cashWd);

                if ((cashWd.shortfall ?? 0) > 1) {
                    const brokerWd = calculateWithdrawals(curBalances, cashWd.shortfall,
                        { order: ['Brokerage'], weight: [1], taxrate: [capGainsPercentage * (capitalGainsRate + nominalStateTaxAtLimit)] });
                    netWithdrawals = accumulateWithdrawals([netWithdrawals, brokerWd]);
                    applyWithdrawals(curBalances, brokerWd);

                    if ((brokerWd.shortfall ?? 0) > 1 && curBalances.Roth > 0) {
                        const rothWithdrawals = calculateWithdrawals(curBalances, brokerWd.shortfall, { order: ['Roth'], weight: [1], taxrate: [0] });
                        netWithdrawals = accumulateWithdrawals([netWithdrawals, rothWithdrawals]);
                        applyWithdrawals(curBalances, rothWithdrawals);
                    }
                }
            } else if (isOrderedStrategy) {
                const seq = resolveOrderedSeq(inputs.orderedSeq);
                netWithdrawals = runOrderedWithdrawal(curBalances, gap, seq, netWithdrawals, applyWithdrawals);

            } else {
                // Default: Brokerage + Cash proportional, then Roth fallback.
                withdrawStrategy.order = ['Brokerage', 'Cash'];
                withdrawStrategy.weight = [40, 60];
                withdrawStrategy.taxrate = [capGainsPercentage * (capitalGainsRate + nominalStateTaxAtLimit), 0];
                withdrawals = calculateWithdrawals(curBalances, gap, withdrawStrategy);
                netWithdrawals = accumulateWithdrawals([netWithdrawals, withdrawals]);
                applyWithdrawals(curBalances, withdrawals);

                if ((withdrawals.shortfall ?? 0) > 1 && curBalances.Roth > 0) {
                    const rothWd = { order: ['Roth'], taxrate: [0], weight: null };
                    const rothWithdrawals = calculateWithdrawals(curBalances, withdrawals.shortfall, rothWd);
                    netWithdrawals = accumulateWithdrawals([netWithdrawals, rothWithdrawals]);
                    applyWithdrawals(curBalances, rothWithdrawals);
                }
            }
        }

        // Recheck tax calculations due to possible additional withdrawals - and we now
        // have a more accurate income picture.
        capitalGains = Math.max(0, (netWithdrawals.Brokerage ?? 0) - (netWithdrawals.BrokerageBasis ?? 0));


        tax = calculateTaxes({
            filingStatus: status, ages: [age1, age2],
            totalSS: s1 + s2, irmaaAnnualCost: irmaa,
            earnedIncome: pension + totalRMD + netWithdrawals.IRA + taxableInterest, inflation: cpiRate,
            qualifiedDiv: taxableDividends, capGains: capitalGains, hsaContrib: 0,
            taxExemptInterest: 0, state: STATEname
        })
        inspectForErrors(tax)  // See if any numbers look fishy.

        // Now we have the "real tax"
        totalTax = tax.totalTax + irmaa;
        bracketOverage = bracketTarget > 0 ? Math.max(0, tax.MAGI - bracketTarget) : 0;
        // Update marginal rates so the third pass grosses up correctly at actual bracket.
        marginalFedTaxRate = tax.fedRate;
        marginalStateTaxRate = tax.stRate;

        // Third pass: if second-pass taxes created a residual shortfall, withdraw more and recalc once.
        // This handles cases where the gap fill (brokerage cap gains) raised taxes above the initial estimate.
        // Compute gross income inline (totalIncome is still 0 here; it's assigned below at line 813).
        const incomeAfterGapFill = fixedInc + netWithdrawals.IRA + pension + taxableDividends +
            taxableInterest + netWithdrawals.Roth + netWithdrawals.Cash + netWithdrawals.Brokerage + totalRMD;
        const residualGap = targetSpend - (incomeAfterGapFill - totalTax);
        if (residualGap > 1) {
            const thirdPassStart = performance.now();
            if (isOrderedStrategy) {
                const seq = resolveOrderedSeq(inputs.orderedSeq);
                netWithdrawals = runOrderedWithdrawal(curBalances, residualGap, seq, netWithdrawals, applyWithdrawals);
            } else {
                // Always use Cash-only in the 3rd pass — adding more Brokerage here creates a
                // cap-gains spiral: more gains → higher SS taxation → bigger residual → repeat.
                // The 2nd-pass gap-fill already grossed up Brokerage; the 3rd pass handles the
                // leftover tax from SS phaseout and NIIT cliffs that the gross-up couldn't predict.
                // Cash (and Roth as fallback) carry no new cap gains, so they break the cycle.
                const thirdWd = calculateWithdrawals(curBalances, residualGap,
                    { order: ['Cash'], weight: [1], taxrate: [0] });
                netWithdrawals = accumulateWithdrawals([netWithdrawals, thirdWd]);
                applyWithdrawals(curBalances, thirdWd);
                // Roth fallback if Cash ran out (still no cap gains)
                if ((thirdWd.shortfall ?? 0) > 1 && curBalances.Roth > 0) {
                    const rothWd3 = calculateWithdrawals(curBalances, thirdWd.shortfall,
                        { order: ['Roth'], weight: [1], taxrate: [0] });
                    netWithdrawals = accumulateWithdrawals([netWithdrawals, rothWd3]);
                    applyWithdrawals(curBalances, rothWd3);
                }
            }
            capitalGains = Math.max(0, (netWithdrawals.Brokerage ?? 0) - (netWithdrawals.BrokerageBasis ?? 0));
            tax = calculateTaxes({
                filingStatus: status, ages: [age1, age2],
                totalSS: s1 + s2, irmaaAnnualCost: irmaa,
                earnedIncome: pension + totalRMD + netWithdrawals.IRA + taxableInterest, inflation: cpiRate,
                qualifiedDiv: taxableDividends, capGains: capitalGains, hsaContrib: 0,
                taxExemptInterest: 0, state: STATEname
            });
            totalTax = tax.totalTax + irmaa;
            totals.thirdPassCount += 1;
            totals.thirdPassTime += performance.now() - thirdPassStart;
        }

        cumulativeTaxes += totalTax;


        totalIncome = Math.max(1, fixedInc + netWithdrawals.IRA + pension + taxableDividends +
            taxableInterest + netWithdrawals.Roth + netWithdrawals.Cash +
            netWithdrawals.Brokerage + totalRMD);

        inspectForErrors({ totalIncome: totalIncome });

        nominalTaxRate = tax.nominalRate;

        // 7. Updates

        netIncome = totalIncome - totalTax;
        let surplus = {
            Total: Math.max(0, netIncome - spendGoal), Roth: 0, Cash: 0, Brokerage: 0,
            Shortfall: Math.min(0, netIncome - spendGoal)
        };

        //!!! Remove withdrawals proportionately. RMDs have already been withdrawn.
        const ira1_ratio = (balance.IRA1 / (balance.IRA1 + balance.IRA2 || 1))
        netWithdrawals.IRA1 = Math.max(0, netWithdrawals.IRA * ira1_ratio);
        netWithdrawals.IRA2 = Math.max(0, netWithdrawals.IRA * (1 - ira1_ratio));


        // If we took money from Roth unnecessarily, refund it back.
        let rothRefund = Math.min(surplus.Total, netWithdrawals.Roth);
        netWithdrawals.Roth -= rothRefund;
        surplus.Total -= rothRefund;

        // With MaxConversion: route the IRA-sourced surplus to Roth instead of Cash.
        // Roth1 receives conversions funded by IRA1 withdrawals; Roth2 by IRA2 withdrawals.
        // Each conversion is capped by the respective IRA withdrawal so we never convert
        // more from an account than was actually withdrawn from it.
        // TAX GAP: nominalTaxRate here is the effective rate on spending income, not the
        // marginal rate on the surplus being converted. The correct approach is a third
        // tax-recalculation pass: recalculate calculateTaxes() with (spendingIncome + surplus)
        // and apply only the incremental tax to the conversion. This could affect conversions
        // near bracket boundaries by several thousand dollars per year.
        surplus.Roth1 = 0;
        surplus.Roth2 = 0;
        if (inputs.maxConversion) {
            const conv1 = Math.min(surplus.Total * ira1_ratio,       netWithdrawals.IRA1 || 0);
            const conv2 = Math.min(surplus.Total * (1 - ira1_ratio), netWithdrawals.IRA2 || 0);
            surplus.Roth1 = conv1;
            surplus.Roth2 = conv2;
            surplus.Total -= (conv1 + conv2);
        }

        // If there is still a surplus, replace any excess Cash withdrawal.
        surplus.Cash = Math.min(surplus.Total, netWithdrawals.Cash);
        netWithdrawals.Cash -= surplus.Cash;
        surplus.Total -= surplus.Cash;

        // Split the Roth withdrawal proportionally between Roth1 and Roth2 before applying.
        const rothWdTotal = balance.Roth1 + balance.Roth2;
        const roth1Share = rothWdTotal > 0 ? balance.Roth1 / rothWdTotal : 0.5;
        netWithdrawals.Roth1 = (netWithdrawals.Roth || 0) * roth1Share;
        netWithdrawals.Roth2 = (netWithdrawals.Roth || 0) * (1 - roth1Share);
        delete netWithdrawals.Roth;

        // Decrement the proposed withdrawals from the balance(s).
        applyWithdrawals(balance, netWithdrawals)

        let totalConverted = surplus.Roth1 + surplus.Roth2;

        // If there is STILL a surplus, reinvest into Brokerage (Cyclic) or put in Cash.
        // Cyclic: stepping up brokerage basis on reinvestment keeps proceeds in the LTCG regime.
        const _reinvestedSurplus = surplus.Total;
        surplus.Cash = surplus.Total;
        if (inputs.cyclicEnabled && surplus.Cash > 0) {
            balance.Brokerage += surplus.Cash;
            balance.BrokerageBasis += surplus.Cash;
            surplus.Cash = 0;
        } else {
            balance.Cash += surplus.Cash;
        }
        surplus.Total = 0;

        // Phase 23: extra conversion — additional IRA→Roth independent of spending strategy.
        // extraConversionAmount[y] (or scalar $) = gross IRA to additionally withdraw and convert.
        // Taxes come from IRA gross (same convention as maxConversion surplus). Net Roth = gross - tax.
        const _extraConvReq = Array.isArray(inputs.extraConversionAmount)
            ? (inputs.extraConversionAmount[y] ?? 0)
            : (inputs.extraConversionAmount ?? 0);
        let extraConvGross = 0, incrementalExtraConvTax = 0;
        if (_extraConvReq > 0) {
            const _availIRA = balance.IRA1 + balance.IRA2;
            const _gross = Math.min(_extraConvReq, _availIRA);
            if (_gross > 0) {
                // Incremental tax on extra IRA withdrawal via marginal-method re-calc
                const _baseEI = pension + totalRMD + taxableInterest + (netWithdrawals.IRA ?? 0);
                const _exTaxCalc = calculateTaxes({
                    filingStatus: status, ages: [age1, age2], totalSS: s1 + s2,
                    irmaaAnnualCost: 0, earnedIncome: _baseEI + _gross, inflation: cpiRate,
                    qualifiedDiv: taxableDividends, capGains: capitalGains,
                    hsaContrib: 0, taxExemptInterest: 0, state: STATEname
                });
                incrementalExtraConvTax = Math.max(0, _exTaxCalc.totalTax - (totalTax - irmaa));
                extraConvGross = _gross;
                const _net = _gross - incrementalExtraConvTax;
                const _ec1 = _gross * ira1_ratio;
                const _ec2 = _gross * (1 - ira1_ratio);
                balance.IRA1 -= _ec1;
                balance.IRA2 -= _ec2;
                surplus.Roth1 = (surplus.Roth1 || 0) + _net * ira1_ratio;
                surplus.Roth2 = (surplus.Roth2 || 0) + _net * (1 - ira1_ratio);
                totalConverted += _net;
                totalTax += incrementalExtraConvTax;
                cumulativeTaxes += incrementalExtraConvTax;
            }
        }

        // Phase 20: opportunity cost shadow tracking.
        // For each action (Roth conversion, excess withdrawal to Cash), compute the incremental tax
        // attributable to that action by re-running calculateTaxes() without it, then derive the gross
        // (pre-tax) IRA over-withdrawal that would have stayed in the IRA in the shadow scenario.
        let incrementalConvTax = 0, grossConv = 0;
        if (totalConverted > 0) {
            const baseEI = pension + totalRMD + taxableInterest;
            const convShadowEI = baseEI + Math.max(0, (netWithdrawals.IRA ?? 0) - totalConverted);
            const shadowConvCalc = calculateTaxes({
                filingStatus: status, ages: [age1, age2], totalSS: s1 + s2,
                irmaaAnnualCost: 0, earnedIncome: convShadowEI, inflation: cpiRate,
                qualifiedDiv: taxableDividends, capGains: capitalGains,
                hsaContrib: 0, taxExemptInterest: 0, state: STATEname
            });
            incrementalConvTax = Math.max(0, (totalTax - irmaa) - shadowConvCalc.totalTax);
            grossConv = totalConverted + incrementalConvTax;
            convShadowDeltaIRA += grossConv;
            // convShadowDeltaTaxable += 0 — taxes came from IRA gross; taxable accounts unaffected
        }

        let incrementalExcessTax = 0, grossExcess = 0;
        const excessCashOC = surplus.Cash;
        if (excessCashOC > 0 && (netWithdrawals.IRA ?? 0) > 0) {
            const baseEI = pension + totalRMD + taxableInterest;
            const excessShadowEI = baseEI + Math.max(0, (netWithdrawals.IRA ?? 0) - excessCashOC);
            const shadowExcessCalc = calculateTaxes({
                filingStatus: status, ages: [age1, age2], totalSS: s1 + s2,
                irmaaAnnualCost: 0, earnedIncome: excessShadowEI, inflation: cpiRate,
                qualifiedDiv: taxableDividends, capGains: capitalGains,
                hsaContrib: 0, taxExemptInterest: 0, state: STATEname
            });
            incrementalExcessTax = Math.max(0, (totalTax - irmaa) - shadowExcessCalc.totalTax);
            grossExcess = excessCashOC + incrementalExcessTax;
            excessShadowDeltaIRA   += grossExcess;
            excessShadowDeltaTaxable -= excessCashOC; // actual taxable has more cash; shadow has less
        }

        // Brokerage tax treatment is correct: dividends are taxed as qualifiedDiv in calculateTaxes()
        // (line ~864), liquidations are taxed as capGains above BrokerageBasis, and the growth
        // applied here is unrealized appreciation — not taxable until sold. The one valuation nuance:
        // unrealized gains are carried at face value during the simulation; totalWealth (line ~1091)
        // discounts them by nominalTaxRate, but year-by-year spendable wealth does not reserve for
        // deferred tax on gains that are never liquidated.
        // Monte Carlo: use per-year return from injected sequence if provided; else constant rate.
        // Cash keeps its own yield regardless (not market-correlated).
        // IRA and Roth always reinvest dividends into the source account (tax-deferred / tax-free),
        // so their effective return = capital appreciation + dividendRate.
        // Brokerage dividends are handled separately below (taxed first, then reinvested or sent to Cash).
        const baseReturn    = (inputs.returnSequence != null) ? inputs.returnSequence[y] : inputs.growth;
        // Bootstrap MC passes per-year sampled inflation; GBM and deterministic use the fixed rate.
        const yearInflation = inputs.inflationSequence?.[y] ?? inputs.inflation;
        const div = inputs.dividendRate ?? 0;
        const psa = inputs.returnSequencePerAccount;
        let growthRates = {
            IRA:       (psa?.IRA1?.[y]      ?? baseReturn) + div,
            IRA1:      (psa?.IRA1?.[y]      ?? baseReturn) + div,
            IRA2:      (psa?.IRA2?.[y]      ?? baseReturn) + div,
            Brokerage:  psa?.Brokerage?.[y] ?? baseReturn,
            Cash:      inputs.cashYield,
            Roth1:     (psa?.Roth1?.[y]     ?? baseReturn) + div,
            Roth2:     (psa?.Roth2?.[y]     ?? baseReturn) + div,
        }

        // Grow Balances
        // FUTURE FEATURE: allow growth-before-withdrawals mode (models late-year liquidation).
        // Implementation: add inputs.growthTiming toggle ('early'|'late'), then conditionally
        // call applyGrowth() before or after the withdrawal block. ~15 lines core + 1 UI toggle.
        // Growth-first produces ~10-15% higher ending balances over 30 years at 7% growth.

        let gains = applyGrowth(balance, growthRates)
        inspectForErrors(growthRates, balance, gains)  // See if any numbers look fishy.

        // Grow shadow deltas at same rates as actual accounts (post-growth weights are close enough).
        {
            const _bt = balance.Brokerage + balance.Cash;
            const _bw = _bt > 0 ? balance.Brokerage / _bt : 0.5;
            const _taxableRate = _bw * (growthRates.Brokerage ?? 0) + (1 - _bw) * (inputs.cashYield ?? 0);
            convShadowDeltaIRA     *= (1 + growthRates.IRA);
            convShadowDeltaTaxable *= (1 + _taxableRate);
            excessShadowDeltaIRA   *= (1 + growthRates.IRA);
            excessShadowDeltaTaxable *= (1 + _taxableRate);
        }

        // Accrue dividends — reinvest into brokerage (basis steps up) or flow to cash
        if (inputs.dividendReinvest) {
            gains.Brokerage = (gains.Brokerage || 0) + taxableDividends;
            balance.Brokerage += taxableDividends;
            balance.BrokerageBasis += taxableDividends;
        } else {
            gains.Cash += taxableDividends;
            balance.Cash += taxableDividends;
        }
        balance.magiHistory.push(tax.MAGI);
        totals.tax += totalTax;
        totals.gross += totalIncome;
        totals.spend += (targetSpend + surplus.Shortfall);
        totals.taxCurrentDollars += totalTax / inflation;
        totals.spendCurrentDollars += (targetSpend + surplus.Shortfall) / inflation;
        totals.rmd += totalRMD;
        // Estimate tax attributable to RMDs proportionally (RMD / totalIncome × totalTax)
        totals.rmdTax += totalIncome > 0 ? (totalRMD / totalIncome) * totalTax : 0;
        balance.Roth1 += surplus.Roth1;
        balance.Roth2 += surplus.Roth2;
        totals.shortfall += surplus.Shortfall;

        // Phase 20: compute opportunity cost NetValue.
        // NetValue = (RothActual + TaxableActual) - (TradShadow + TaxableShadow - TaxLiability)
        // TaxLiability = TradShadow × TaxFuture
        // Positive = conversions/excess withdrawals have paid off vs the no-action shadow.
        const _taxFuture = inputs.futureIRATaxRate ?? (marginalFedTaxRate + marginalStateTaxRate);
        const _roth = balance.Roth1 + balance.Roth2;
        const _taxable = balance.Brokerage + balance.Cash;
        const _ira = balance.IRA1 + balance.IRA2;
        const convTradShadow    = _ira + convShadowDeltaIRA;
        const convTaxableShadow = _taxable + convShadowDeltaTaxable;
        const convNetValue  = (_roth + _taxable) - (convTradShadow + convTaxableShadow - convTradShadow * _taxFuture);
        const excessTradShadow    = _ira + excessShadowDeltaIRA;
        const excessTaxableShadow = _taxable + excessShadowDeltaTaxable;
        const excessNetValue = (_roth + _taxable) - (excessTradShadow + excessTaxableShadow - excessTradShadow * _taxFuture);

        // Phase 21: BETR per-year signal.
        // Computed when there was any conversion this year (standard or extra). BETR answers: "what future
        // marginal rate makes this conversion break-even?" Comparison to futureIRATaxRate gives ▲/▼ flag.
        let yearBETR = null, yearBETRflag = null;
        if (totalConverted > 0) {
            const _rIRA = growthRates.IRA1 ?? inputs.growth ?? 0.06;
            const _drag = (inputs.dividendRate ?? 0) * (tax.capitalGainsRate ?? 0.15);
            const _rTax = Math.max(0, (inputs.growth ?? _rIRA) - _drag);
            const _rmdAge1 = (inputs.birthyear1 ?? 1960) >= 1960 ? 75 : 73;
            const _yearsToRMD = Math.max(1, _rmdAge1 - age1);
            yearBETR = computeBETR(tax.fedRate + (tax.stRate ?? 0), _rIRA, _rTax, _yearsToRMD);
            if (yearBETR !== null) {
                const _futureRate = _taxFuture; // already resolved above
                yearBETRflag = _futureRate > yearBETR + 0.02 ? '▲'
                             : _futureRate < yearBETR - 0.02 ? '▼' : '≈';
            }
        }

        let totalWealth = (balance.IRA1 + balance.IRA2 + Math.max(0, balance.Brokerage - balance.BrokerageBasis)) * (1 - nominalTaxRate) + balance.Roth1 + balance.Roth2 + balance.Cash + balance.BrokerageBasis

        // Fail when the portfolio can't cover its required draw (spend minus guaranteed income).
        // This is strategy-agnostic and fires at the point of first real impairment.
        const guaranteedIncome = s1 + s2 + pension;
        const portfolioBalance = balance.IRA1 + balance.IRA2 + balance.Roth1 + balance.Roth2 + balance.Brokerage + balance.Cash;
        const requiredPortfolioDraw = Math.max(0, spendGoal - guaranteedIncome);
        if (netIncome < targetSpend * 0.99 || portfolioBalance < requiredPortfolioDraw) {
            totals.success = false;
            totals.failedInYear.push(currentYear)
        } else {
            totals.yearsfunded += 1
        }

        inspectForErrors({ totalWealth: totalWealth })  // See if any numbers look fishy.

        // Net asset draw: total withdrawn from all accounts minus amounts rebalanced (not spent).
        // Excludes: Roth conversions (IRA→Roth reallocation), reinvested surplus income.
        const _netAssetDraw = (netWithdrawals.IRA ?? 0) + totalRMD + extraConvGross
            + (netWithdrawals.Brokerage ?? 0)
            + (netWithdrawals.Cash ?? 0)
            + (netWithdrawals.Roth1 ?? 0)
            + (netWithdrawals.Roth2 ?? 0)
            - totalConverted
            - _reinvestedSurplus;
        const _netSpendPct = (prevTotalWealth != null && prevTotalWealth > 0)
            ? _netAssetDraw / prevTotalWealth : null;

        log.push({
            // Who
            year: currentYear,
            age1: alive1 ? age1 : '—',
            age2: alive2 ? age2 : '—',
            status: status,
            // Income
            SSincome: fixedInc,
            pension: pension,
            spendGoal: targetSpend,
            netIncome: netIncome,
            totalIncome: totalIncome,
            surplus: surplus.Total,
            shortfall: surplus.Shortfall,
            'RMDwd': totalRMD,
            'cashD+I': taxableDividends + taxableInterest,
            // Withdrawals
            'IRAwd': netWithdrawals.IRA,
            'IRA1-': netWithdrawals.IRA1,
            'IRA2-': netWithdrawals.IRA2,
            'RMD1-': rmd1,
            'RMD2-': rmd2,
            'Brokerage-': netWithdrawals.Brokerage,
            'RothWD': (netWithdrawals.Roth1 ?? 0) + (netWithdrawals.Roth2 ?? 0),
            'CashWD': netWithdrawals.Cash,
            'rothConv': totalConverted,
            'surplusCash': surplus.Cash,
            'cashDividends': taxableDividends,
            'cashInterest': taxableInterest,
            // Taxes
            'FedRate%': tax.fedRate,
            'StateRate%': tax.stRate,
            IRMAATier: getIRMAATier(balance.magiHistory[balance.magiHistory.length - 2], status, cpiRate),
            IRMAA: irmaa,
            totalTax: totalTax,
            FedTax: tax.federalTax,
            StateTax: tax.state,
            'CapGains': capitalGains,
            MAGI: tax.MAGI,
            'NominalRate%': nominalTaxRate,
            'FedCap': tax.fedLimit,
            'StateCap': tax.stLimit,
            'SumTaxes': cumulativeTaxes,
            'BracketTarget': bracketTarget,
            'BracketOverage': bracketOverage,
            // Balances
            IRA1: balance.IRA1,
            IRA2: balance.IRA2,
            TotalIRA: balance.IRA1 + balance.IRA2,
            Cash: balance.Cash,
            Roth: balance.Roth1 + balance.Roth2,
            Roth1: balance.Roth1,
            Roth2: balance.Roth2,
            Brokerage: balance.Brokerage,
            Basis: balance.BrokerageBasis,
            totalWealth: totalWealth,
            portfolioBalance: portfolioBalance,
            guaranteedIncome: guaranteedIncome,
            Spendable: totals.spend,
            brokerageG: gains.Brokerage,
            cashG: gains.Cash,
            rothG: (gains.Roth1 || 0) + (gains.Roth2 || 0),
            'RMD%': rmd1Pct,
            // Phase 24: Cyclic sub-cycle annotation
            subCycle: subCycleLabel,
            // Opportunity cost (Phase 20) + BETR signal (Phase 21) + extra conversion (Phase 23)
            convOC: convNetValue,
            excessOC: excessNetValue,
            convTax: incrementalConvTax,
            excessTax: incrementalExcessTax,
            'BETR%': yearBETR,
            betrFlag: yearBETRflag,
            extraConv: extraConvGross || null,
            'netSpend%': _netSpendPct,
            // Internal
            inflationFactor: inflation,
            loopMs: performance.now() - loopStart
        });
        totals.totalTime += log[log.length - 1].loopMs;
        prevTotalWealth = totalWealth;
        // Advance spend goal: apply user's spend-change preference and inflation.
        // spendDelta is constant (1 + inputs.spendChange); moving this to end of loop
        // keeps year-0 spendGoal equal to the user's input in today's dollars.
        spendGoal = spendGoal * spendDelta * (1 + yearInflation);

        currentYear += 1;

        // Adjust inflation rates for subsequent rounds.
        cpiRate *= (1 + inputs.cpi);
        inflation *= (1 + yearInflation);
        medicareRate *= (1 + TAXData.IRMAA.ANNUAL_INCREASE)
    } // end for (let y = 0; y < maxYears; y++)

    // Phase 20: find break-even years (first year NetValue goes non-negative).
    totals.convBEYear   = log.find(r => r.convOC  >= 0)?.year ?? null;
    totals.excessBEYear = log.find(r => r.excessOC >= 0)?.year ?? null;

    // Phase 21: average BETR across all years with conversions.
    const _betrYears = log.filter(r => r['BETR%'] !== null && r['BETR%'] !== undefined);
    totals.betrAvg = _betrYears.length > 0
        ? _betrYears.reduce((s, r) => s + r['BETR%'], 0) / _betrYears.length
        : null;

    // Average net asset spend rate across all simulated years.
    const _spendRateYears = log.filter(r => r['netSpend%'] != null);
    totals.avgSpendRate = _spendRateYears.length > 0
        ? _spendRateYears.reduce((s, r) => s + r['netSpend%'], 0) / _spendRateYears.length
        : null;

    return { log, totals, finalNW: log[log.length - 1].totalWealth };
}

/**
 * Calculate progressive tax on a given amount using tax brackets from TAXdata structure.
 * Iterates through brackets, applying rates to income ranges, with optional inflation
 * and rate creep adjustments for future year projections.
 * 
 * @param {string} entity - Tax entity identifier (e.g., 'federal', 'CA', 'IRMAA', 'SS')
 * @param {string} status - Filing status (e.g., 'single', 'joint', 'mfs', 'hoh')
 * @param {number} amount - Taxable amount to calculate tax on
 * @param {number} [inflation=1] - Inflation multiplier for bracket limits (default: 1)
 * @param {number} [ratecreep=1] - Rate adjustment multiplier (default: 1)
 * @returns {Object} Tax calculation results
 * @returns {number} return.cumulative - Total tax owed
 * @returns {number} return.total - Total tax owed (same as cumulative)
 * @returns {number} return.marginal - Marginal tax rate at this income level
 * @returns {number} return.limit - Upper limit of the bracket reached
 * @returns {number} return.nominalRate - Nominal rate if specified in bracket data
 * @returns {string} [return.error] - Error message if entity/status invalid
 */
function calculateProgressive(entity, status, amount, inflation = 1, ratecreep = 1) {

    let brks = getRateBracket(entity, status)
    if (!brks) {
        return { cumulative: 0, total: 0, marginal: 0, limit: 0, error: `Invalid entity (${entity}) or status (${status})` };
    }

    // States with INFLATION_INDEXED: false have statutory fixed bracket thresholds — never inflate them.
    const effectiveInflation = TAXData[entity]?.INFLATION_INDEXED === false ? 1 : inflation;

    let prevLimit = 0;
    let cumulative = 0;
    let marginalRate = 0;
    let nominalRate = 0;

    for (let b of brks) {
        let currentLimit = b.l * effectiveInflation;

        if (amount <= currentLimit) {
            cumulative += (amount - prevLimit) * b.r * ratecreep;
            marginalRate = b.r * ratecreep;
            nominalRate = b.nr ?? 0;
            prevLimit = currentLimit;
            break;
        } else {
            cumulative += (currentLimit - prevLimit) * b.r * ratecreep;
            marginalRate = b.r * ratecreep;
            nominalRate = b.nr ?? 0;
            prevLimit = currentLimit;
        }
    }

    return { cumulative, total: cumulative, marginal: marginalRate, limit: prevLimit, nominalRate: nominalRate }
}

///////////////////////////

/** UI CONTROLS **/
function getInputs() {
    // UI GAP: when spendChange (or BrokerageBasis) is out-of-range and corrected to 0 below,
    // the form field still shows the user's invalid value. Fix: call
    // DisplayHelpers.setValue('spendChange', '0') after correction so UI matches simulation.
    let spendChange = +val('spendChange')
    if (spendChange < -25 || spendChange > 25) {
        showMessage('Spend Delta: ' + spendChange + '% is unreasonable. Using 0% instead.', 'warning')
        spendChange = 0
    }
    let Brokerage = +val('Brokerage');
    let BrokerageBasis = +val('BrokerageBasis');
    if (Brokerage <= 0.01) basis = 0;
    if (BrokerageBasis > Brokerage) {
        showMessage('BrokerageBasis (' + BrokerageBasis + ') was greater than the Brokerage balance. BrokerageBasis in input is being ignored. Using ' + Brokerage + ' instead.', 'warning');
        BrokerageBasis = Brokerage;
    }
    return {
        STATEname: val('STATEname'),
        strategy: val('strategy'),
        orderedSeq: val('orderedSeq') || 'CBIR',
        nYears: +val('nYears'),
        ...(() => {
            const raw = val('stratRate') ?? '';
            if (raw.startsWith('irmaa')) {
                return { stratRate: 0, stratIRMAATier: +raw.replace('irmaa', ''), stratACAMultiple: 0 };
            }
            if (raw.startsWith('aca')) {
                return { stratRate: 0, stratIRMAATier: -1, stratACAMultiple: +raw.replace('aca', '') };
            }
            return { stratRate: +raw / 100.0, stratIRMAATier: -1, stratACAMultiple: 0 };
        })(),
        hasSpouse: !!valChecked('hasSpouse'),
        birthyear1: +val('birthyear1'),
        birthmonth1: +val('birthmonth1') || 12,
        die1: +val('die1'),
        birthyear2: +val('birthyear2'),
        birthmonth2: +val('birthmonth2') || 12,
        die2: +val('die2'),
        IRA1: +val('IRA1'),
        IRA2: +val('IRA2'),
        Roth: +val('Roth'),
        Roth2: +val('Roth2') || 0,
        CashReserve: +val('CashReserve') || 0, // stored, never drawn by simulation
        Brokerage: Brokerage,
        BrokerageBasis: BrokerageBasis,
        Cash: +val('Cash'),
        ss1: +val('ss1'),
        ss1Age: +val('ss1Age'),
        ss2: +val('ss2'),
        ss2Age: +val('ss2Age'),
        pensionAnnual: +val('pensionAnnual'),
        survivorPct: +val('survivorPct'),
        pensionCola: !!valChecked('pensionCola'),
        spendGoal: +val('spendGoal'),
        spendChange: (spendChange / 100.0),
        iraBaseGoal: +val('iraBaseGoal'),
        inflation: +val('inflation') / 100.0,
        cpi: +val('cpi') / 100.0,
        growth: +val('growth') / 100.0,
        cashYield: +val('cashYield') / 100.0,
        dividendRate: +val('dividendRate') / 100.0,
        ssFailYear: +val('ssFailYear'),
        ssFailPct: +val('ssFailPct') / 100.0,
        maxConversion: valChecked('maxConversion'),
        propWithdraw: +val('propWithdraw') / 100.0,
        iraWithdrawPct: +val('iraWithdrawPct') / 100.0,
        startAge: +val('startAge') || (new Date().getFullYear() - +val('birthyear1')),
        startInYear: (() => {
            const sa = +val('startAge');
            const by1 = +val('birthyear1');
            // startAge is the user's real-world age: the year they ARE that age = birthyear + startAge.
            // Clamp to the current calendar year — can't start a simulation in the past.
            const computed = sa > 0 ? by1 + sa : new Date().getFullYear();
            return Math.max(computed, new Date().getFullYear());
        })(),
        dividendReinvest: !!valChecked('dividendReinvest'),
        cyclicEnabled: !!valChecked('cyclicEnabled'),
        cyclicOrder:   val('cyclicOrder') ?? 'ira-first',
        // Account Composition (equity/bond ratio selects + intl equity % inputs)
        comp_IRA1_ratio: +val('comp_IRA1_ratio'),
        comp_IRA1_intl: +val('comp_IRA1_intl'),
        comp_IRA2_ratio: +val('comp_IRA2_ratio'),
        comp_IRA2_intl: +val('comp_IRA2_intl'),
        comp_Brokerage_ratio: +val('comp_Brokerage_ratio'),
        comp_Brokerage_intl: +val('comp_Brokerage_intl'),
        comp_Roth1_ratio: +val('comp_Roth1_ratio'),
        comp_Roth1_intl: +val('comp_Roth1_intl'),
        comp_Roth2_ratio: +val('comp_Roth2_ratio'),
        comp_Roth2_intl: +val('comp_Roth2_intl'),
        futureIRATaxRate: (() => { const v = val('futureIRATaxRate'); return (v && +v > 0) ? +v / 100.0 : undefined; })(),
    };
}

/*
 *
 *
 */
function updateProfileAgeDisplay() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    function ageInfo(birthYear, birthMonth) {
        if (!birthYear) return null;
        const age = currentYear - birthYear - (currentMonth <= birthMonth ? 1 : 0);
        const rmdStart = birthYear >= 1960 ? 75 : 73;
        return `Age ${age} | RMD starts ${rmdStart}`;
    }

    const el1 = document.getElementById('age-display-1');
    if (el1) el1.textContent = ageInfo(+val('birthyear1'), +val('birthmonth1') || 12) ?? '';

    const el2 = document.getElementById('age-display-2');
    if (el2) el2.textContent = ageInfo(+val('birthyear2'), +val('birthmonth2') || 12) ?? '';
}

function updateIRAGoalHint() {
    const hint = document.getElementById('ira-goal-hint');
    if (!hint) return;
    try {
        const birthyear1 = +val('birthyear1');
        const currentYear = new Date().getFullYear();
        const age1 = currentYear - birthyear1;
        const growth = +val('growth') / 100;
        const spendGoal = +val('spendGoal');
        const targetAge = 84;
        const yearsUntil = targetAge - age1;
        if (yearsUntil <= 0 || spendGoal <= 0 || !RMD_TABLE[targetAge]) { hint.textContent = ''; return; }
        // Target IRA at age 84: balance where RMD equals spend goal
        const rmdPctAtTarget = 1 / RMD_TABLE[targetAge];
        const targetAtAge = spendGoal / rmdPctAtTarget;
        // Discount back to today at growth rate
        const targetNow = targetAtAge / Math.pow(1 + growth, yearsUntil);
        const rounded = Math.round(targetNow);
        hint.textContent = `Suggested IRA Goal: $${rounded.toLocaleString()}`;
        hint.title = `IRA balance today that would produce RMDs ≤ your spend goal at age ${targetAge} (IRS table: ${(rmdPctAtTarget * 100).toFixed(2)}% RMD rate, ${yearsUntil} yrs at ${(growth * 100).toFixed(1)}% growth). Click to apply.`;
        hint.style.cursor = 'pointer';
        hint.onclick = () => { DisplayHelpers.setDollarValue('iraBaseGoal', rounded); runSimulation(); };
    } catch(e) {
        hint.textContent = '';
    }
}

function runSimulation() {
    refreshStratRateOptions();   // keep bracket dropdown labels in sync with CPI + filing status
    let res = simulate(getInputs());
    lastSimulationLog = res.log;
    lastTotals = res.totals;
    lastFinalNW = res.finalNW;
    const lastEntry = res.log[res.log.length - 1];
    lastFinalNWCurrentDollars = lastEntry.totalWealth / (lastEntry.inflationFactor || 1);
    updateTable(res.log);
    updateStats(res.totals, res.finalNW, lastFinalNWCurrentDollars);
    updateCharts(res.log);
    updateIRAGoalHint();
    // Show computed marginal rate in the auto label when futureIRATaxRate is blank
    const _autoRateEl = document.getElementById('future-ira-tax-auto');
    if (_autoRateEl) {
        const _blank = !val('futureIRATaxRate');
        if (_blank && res.log.length > 0) {
            const r0 = res.log[0];
            const autoRatePct = Math.round(((r0['FedRate%'] || 0) + (r0['StateRate%'] || 0)) * 100);
            _autoRateEl.textContent = autoRatePct > 0 ? `(auto: ${autoRatePct}%)` : '';
        } else {
            _autoRateEl.textContent = '';
        }
    }
    const spouseBtn = document.getElementById('chartPerson_spouse');
    if (spouseBtn) spouseBtn.style.display = getInputs().hasSpouse ? '' : 'none';
}

function updateCurrentDollarsView() {
    if (lastSimulationLog) {
        updateTable(lastSimulationLog);
        updateCharts(lastSimulationLog);
        updateStats(lastTotals, lastFinalNW, lastFinalNWCurrentDollars);
    }
    if (window.optimizerResults) renderOptimizerTable(window.optimizerResults);
    // Re-render MC chart so current-dollar deflation is applied (or removed).
    if (typeof _mcResults !== 'undefined' && _mcResults) {
        if (typeof renderMCChart === 'function') renderMCChart(_mcResults);
    }
}
// //////////////////////////////////////////////////////////////////

// When ALL strategies fail at baseline, searches downward across every strategy to find
// the highest spend goal where at least one strategy succeeds.
// Returns { result, optimizedSpend, strategyLabel, paramLabel, paramSortVal, overrides } or null.
function optimizeSpendDown(baseInputs, strategyOverridesList) {
    function bestPassingStrategy(spendGoal) {
        let best = null;
        for (const entry of strategyOverridesList) {
            const res = simulate(Object.assign({}, baseInputs, entry.overrides, { spendGoal }));
            if (res.totals.success) {
                if (!best || res.totals.spend > best.result.totals.spend) {
                    best = { result: res, ...entry };
                }
            }
        }
        return best;
    }

    // Phase 1: verify MIN_SPEND is viable — it's the floor for the binary search.
    const MIN_SPEND = Math.max(500, baseInputs.spendGoal * 0.02);
    const floorEntry = bestPassingStrategy(MIN_SPEND);
    if (!floorEntry) return null;

    // Phase 2: binary search from MIN_SPEND (passes) up to baseline (fails) — same logic as
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

// Returns the highest-spend simulation result where the portfolio can still fund
// its required draw (spendGoal minus guaranteed income) in the final year.
// baseInputs: full inputs object at baseline spendGoal
// overrides:  strategy overrides (same object passed to addResult for this row)
function optimizeSpend(baseInputs, overrides) {
    function passes(res) {
        const last = res.log[res.log.length - 1];
        const required = Math.max(0, last.spendGoal - (last.guaranteedIncome ?? 0));
        return (last.portfolioBalance ?? 0) >= required;
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

// Phase 23: find the extraConversionAmount (flat annual $) that maximizes a given metric for
// a fixed strategy. Sweeps from $0 to totalIRA in $25k steps; returns best amount found.
// metric: 'finalNW' (default), 'spend' (max spendable), 'minTax' (min lifetime taxes).
// baseInputs: inputs object with a fixed strategy already set; strategyOverrides layered on top.
function optimizeConversionAmount(baseInputs, strategyOverrides = {}, metric = 'finalNW') {
    const totalIRA = (baseInputs.IRA1 || 0) + (baseInputs.IRA2 || 0);
    if (totalIRA <= 0) return { optConv: 0, optResult: null };

    const STEP = 25000;
    let bestScore = -Infinity, bestConv = 0, bestResult = null;

    const score = (res) => {
        if (metric === 'spend')   return res.totals.spend;
        if (metric === 'minTax')  return -res.totals.tax;
        return res.finalNW; // default: finalNW
    };

    for (let conv = 0; conv <= totalIRA + STEP; conv += STEP) {
        const c = Math.min(conv, totalIRA);
        const res = simulate({ ...baseInputs, ...strategyOverrides, extraConversionAmount: c });
        const s = score(res);
        if (s > bestScore) { bestScore = s; bestConv = c; bestResult = res; }
        if (c >= totalIRA) break;
    }
    return { optConv: bestConv, optResult: bestResult };
}

// Build the full variation list (same parameter sweep as the optimizer) without running
// simulations. Used by both the optimizer and Monte Carlo module.
// base: result of getInputs() — no DOM access needed after this point.
function buildVariations(base) {
    const bracketRates = TAXData.FEDERAL.MFJ.brackets.slice(0, -1).map(b => b.r);
    const variations = [];

    const push = (family, paramLabel, paramSortVal, overrides) => {
        const conv = overrides.maxConversion;
        variations.push({
            ...base,
            ...overrides,
            _label:          `${family} ${paramLabel}${conv ? ' ✓' : ''}`,
            _strategyFamily: family,
            _paramLabel:     paramLabel,
            _paramSortVal:   paramSortVal,
        });
    };

    const maxConv = true;

    for (const pct of [0, 5, 10, 20, 50])
        push('Proportional', `${pct}%`, pct,
            { strategy: 'propwd', propWithdraw: pct / 100, maxConversion: maxConv });
    // Include user's current value if it isn't one of the standard Proportional steps
    const userPropPct = Math.round((base.propWithdraw ?? 0) * 100);
    if (base.strategy === 'propwd' && ![0, 5, 10, 20, 50].includes(userPropPct))
        push('Proportional', `${userPropPct}%`, userPropPct,
            { strategy: 'propwd', propWithdraw: base.propWithdraw, maxConversion: maxConv });

    for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25])
        push('Reduce', `${n} yrs`, n,
            { strategy: 'fixed', nYears: n, maxConversion: maxConv });
    // Include user's current value if it isn't one of the standard Reduce steps
    if (base.strategy === 'fixed' && ![2,3,4,5,6,7,8,9,10,11,12,13,14,15,20,25].includes(base.nYears))
        push('Reduce', `${base.nYears} yrs`, base.nYears,
            { strategy: 'fixed', nYears: base.nYears, maxConversion: maxConv });

    for (const rate of bracketRates) {
        const pct = Math.round(rate * 100);
        push('Fill Bracket', `${pct}%`, rate,
            { strategy: 'bracket', stratRate: rate, maxConversion: maxConv });
    }
    // Include user's current value if it isn't one of the standard Fill Bracket rates
    const userBracketPct = Math.round((base.stratRate ?? 0) * 100);
    if (base.strategy === 'bracket' && !bracketRates.map(r => Math.round(r * 100)).includes(userBracketPct))
        push('Fill Bracket', `${userBracketPct}%`, base.stratRate,
            { strategy: 'bracket', stratRate: base.stratRate, maxConversion: maxConv });

    for (const pct of [5, 6, 7, 8, 10])
        push('IRA Draw', `${pct}%`, pct,
            { strategy: 'fixedpct', iraWithdrawPct: pct / 100, maxConversion: maxConv });
    // Include user's current value if it isn't one of the standard IRA Draw steps
    const userDrawPct = Math.round((base.iraWithdrawPct ?? 0) * 100);
    if (base.strategy === 'fixedpct' && ![5, 6, 7, 8, 10].includes(userDrawPct))
        push('IRA Draw', `${userDrawPct}%`, userDrawPct,
            { strategy: 'fixedpct', iraWithdrawPct: base.iraWithdrawPct, maxConversion: maxConv });

    for (const seq of ['CBIR', 'RIBC', 'BIRC'])
        push('Ordered', seq, seq, { strategy: 'ordered', orderedSeq: seq, maxConversion: maxConv });

    // Phase 24: Cyclic variants for MC — IRA-first (🔄) and brokerage-first (🔄B).
    {
        const baseCount = variations.length;
        for (let i = 0; i < baseCount; i++) {
            const v = variations[i];
            for (const [plainPfx, htmlPfx, order] of [
                ['\u{1F5D8} ', '<span style="color:#cc0000">\u{1F5D8}</span> ', 'ira-first'],
                ['\u{1F504} ', '\u{1F504} ',                                   'brokerage-first'],
            ]) {
                variations.push({
                    ...v,
                    cyclicEnabled:   true,
                    cyclicOrder:     order,
                    _label:          plainPfx + v._label,
                    _strategyFamily: htmlPfx  + v._strategyFamily,
                    _paramLabel:     v._paramLabel,
                    _paramSortVal:   v._paramSortVal,
                });
            }
        }
    }

    return variations;
}

let _lastOptimizerHash = null;

function runOptimizer() {
    const base = getInputs();
    const currentHash = JSON.stringify(base)
        + ';optimizeSpend=' + (document.getElementById('optimizeSpend')?.checked ?? false)
        + ';convOpt=' + (document.getElementById('includeConvOpt')?.checked ?? false);
    if (currentHash === _lastOptimizerHash && window.optimizerResults) {
        renderOptimizerTable(window.optimizerResults);
        showTab('tab-opt');
        return;
    }
    _lastOptimizerHash = currentHash;

    const results = [];
    simulationCount = 0;
    const optimizerStart = performance.now();

    // Get all bracket rates from TAXData (skip the last Infinity bracket)
    const bracketRates = TAXData.FEDERAL.MFJ.brackets
        .slice(0, -1)
        .map(b => b.r);

    // strategyOverrides stored separately so the spend optimizer can reuse them
    const strategyOverridesList = [];

    function addResult(strategyLabel, paramLabel, paramSortVal, overrides) {
        const inputs = Object.assign({}, base, overrides);
        const res = simulate(inputs);
        const lastEntry = res.log[res.log.length - 1];
        const totalYears = res.log.length;
        const ovYears = res.log.filter(e => (e['BracketOverage'] ?? 0) > 0).length;
        const bracketOveragePct = totalYears > 0 ? ovYears / totalYears : 0;
        const isBracketInfeasible = overrides.strategy === 'bracket' && bracketOveragePct > 0.5;
        const row = {
            _id: results.length,
            _strategyLabel: strategyLabel + (overrides.maxConversion ? ' ✓' : '') + (isBracketInfeasible ? ' ⚠️' : ''),
            _paramLabel: paramLabel,
            _paramSortVal: paramSortVal,
            _maxConversion: overrides.maxConversion,
            _spendGoal: inputs.spendGoal,
            _strategy: overrides.strategy,
            _nYears: overrides.nYears ?? null,
            _stratRate: overrides.stratRate ?? null,
            _stratIRMAATier: overrides.stratIRMAATier ?? null,
            _stratACAMultiple: overrides.stratACAMultiple ?? 0,
            _propWithdraw: overrides.propWithdraw ?? null,
            _iraWithdrawPct: overrides.iraWithdrawPct ?? null,
            _cyclicEnabled: !!(overrides.cyclicEnabled),
            _cyclicOrder:   overrides.cyclicOrder ?? 'ira-first',
            _isSpendOptimized: false,
            _bracketOveragePct: bracketOveragePct,
            _isBracketInfeasible: isBracketInfeasible,
            totals: res.totals,
            finalNW: res.finalNW,
            finalNWCurrentDollars: lastEntry.totalWealth / (lastEntry.inflationFactor || 1)
        };
        results.push(row);
        strategyOverridesList.push({ strategyLabel, paramLabel, paramSortVal, overrides });
    }

    const maxConv = true;

    // Proportional +% — 0% is the pure baseline; 5/10/20/50% add IRA-only boost
    for (const pct of [0, 5, 10, 20, 50]) {
        addResult('Proportional', `${pct}%`, pct, { strategy: 'propwd', propWithdraw: pct / 100, maxConversion: maxConv });
    }

    // Reduce IRA over N years
    for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25]) {
        addResult('Reduce', `${n} yrs`, n, { strategy: 'fixed', nYears: n, maxConversion: maxConv });
    }

    // Fill bracket — one row per bracket level
    for (const rate of bracketRates) {
        const pct = Math.round(rate * 100);
        addResult('Fill Bracket', `${pct}%`, rate, { strategy: 'bracket', stratRate: rate, stratIRMAATier: -1, maxConversion: maxConv });
    }

    // Fill bracket — IRMAA tier ceilings (tiers 0=Below IRMAA through 4=Tier 4 ceiling)
    const irmaaTierLabels = ['Below IRMAA', 'Tier 1 ceil', 'Tier 2 ceil', 'Tier 3 ceil', 'Tier 4 ceil'];
    for (let tier = 0; tier <= 4; tier++) {
        addResult('IRMAA Ceil', irmaaTierLabels[tier], tier - 0.5, { strategy: 'bracket', stratRate: 0, stratIRMAATier: tier, stratACAMultiple: 0, maxConversion: maxConv });
    }

    // Fill bracket — ACA FPL cliffs
    const acaMultiples = [200, 250, 300, 400];
    const acaLabels = { 200: '200% FPL', 250: '250% FPL', 300: '300% FPL', 400: '400% FPL ⚠️' };
    for (const pct of acaMultiples) {
        addResult('ACA Cliff', acaLabels[pct], 50 + pct / 100, { strategy: 'bracket', stratRate: 0, stratIRMAATier: -1, stratACAMultiple: pct, maxConversion: maxConv });
    }

    // IRA Draw — fixed % of IRA balance each year
    for (const pct of [5, 6, 7, 8, 10]) {
        addResult('IRA Draw', `${pct}%`, pct, { strategy: 'fixedpct', iraWithdrawPct: pct / 100, maxConversion: maxConv });
    }

    // Ordered — strict account sequence
    for (const seq of ['CBIR', 'RIBC', 'BIRC']) {
        addResult('Ordered', seq, seq, { strategy: 'ordered', orderedSeq: seq, maxConversion: maxConv });
    }

    // Phase 24: Cyclic variants — IRA-first (🗘 red) and brokerage-first (🔄) for every baseline.
    {
        const _IRA_PFX  = '<span style="color:#cc0000">\u{1F5D8}</span> ';
        const _BRK_PFX  = '\u{1F504} ';
        const baselineCount = strategyOverridesList.length;
        for (let i = 0; i < baselineCount; i++) {
            const { strategyLabel, paramLabel, paramSortVal, overrides } = strategyOverridesList[i];
            addResult(_IRA_PFX + strategyLabel, paramLabel, paramSortVal,
                { ...overrides, cyclicEnabled: true, cyclicOrder: 'ira-first' });
            addResult(_BRK_PFX + strategyLabel, paramLabel, paramSortVal,
                { ...overrides, cyclicEnabled: true, cyclicOrder: 'brokerage-first' });
        }
    }

    // Spend optimizer second pass — only runs when user enabled the toggle
    window.optimizerNoSolutionFloor = null;
    if (document.getElementById('optimizeSpend')?.checked) {
        const anySuccess = results.some(r => r.totals.success);

        if (anySuccess) {
            // Forward mode: for each successful strategy, binary-search upward
            const baselineCount = results.length;
            for (let i = 0; i < baselineCount; i++) {
                const baseRow = results[i];
                if (!baseRow.totals.success) continue;
                const { strategyLabel, paramLabel, paramSortVal, overrides } = strategyOverridesList[i];
                const opt = optimizeSpend(base, overrides);
                if (!opt) continue;
                const lastEntry = opt.result.log[opt.result.log.length - 1];
                results.push({
                    _id: results.length,
                    _strategyLabel: (strategyLabel + (overrides.maxConversion ? ' ✓' : '')) + (opt.hitCeiling ? ' ✦+' : ' ✦'),
                    _paramLabel: paramLabel,
                    _paramSortVal: paramSortVal,
                    _maxConversion: overrides.maxConversion,
                    _spendGoal: opt.optimizedSpend,
                    _strategy: overrides.strategy,
                    _nYears: overrides.nYears ?? null,
                    _stratRate: overrides.stratRate ?? null,
                    _propWithdraw: overrides.propWithdraw ?? null,
                    _isSpendOptimized: true,
                    _isReverseOptimized: false,
                    _hitCeiling: opt.hitCeiling,
                    totals: opt.result.totals,
                    finalNW: opt.result.finalNW,
                    finalNWCurrentDollars: lastEntry.totalWealth / (lastEntry.inflationFactor || 1)
                });
            }
        } else {
            // Reverse mode: all strategies failed — find the highest spend that works
            const opt = optimizeSpendDown(base, strategyOverridesList);
            if (opt) {
                const lastEntry = opt.result.log[opt.result.log.length - 1];
                results.push({
                    _id: results.length,
                    _strategyLabel: (opt.strategyLabel + (opt.overrides.maxConversion ? ' ✓' : '')) + ' ▼',
                    _paramLabel: opt.paramLabel,
                    _paramSortVal: opt.paramSortVal,
                    _maxConversion: opt.overrides.maxConversion,
                    _spendGoal: opt.optimizedSpend,
                    _strategy: opt.overrides.strategy,
                    _nYears: opt.overrides.nYears ?? null,
                    _stratRate: opt.overrides.stratRate ?? null,
                    _propWithdraw: opt.overrides.propWithdraw ?? null,
                    _isSpendOptimized: true,
                    _isReverseOptimized: true,
                    _hitCeiling: false,
                    totals: opt.result.totals,
                    finalNW: opt.result.finalNW,
                    finalNWCurrentDollars: lastEntry.totalWealth / (lastEntry.inflationFactor || 1)
                });
            } else {
                // Reverse search also failed — report the lowest spend level that was tried
                window.optimizerNoSolutionFloor = Math.max(500, base.spendGoal * 0.02);
            }
        }
    }

    // Phase 23: Conversion Amount Optimizer — when checkbox enabled, sweep extraConversionAmount
    // for the top 5 successful strategies and add new rows showing the optimized conversion result.
    if (document.getElementById('includeConvOpt')?.checked) {
        const successes = results.filter(r => r.totals.success);
        const top5 = successes
            .slice().sort((a, b) => b.finalNW - a.finalNW)
            .slice(0, 5);
        for (const baseRow of top5) {
            const overrides = {
                strategy: baseRow._strategy,
                maxConversion: baseRow._maxConversion,
                ...(baseRow._stratRate   != null ? { stratRate:      baseRow._stratRate }   : {}),
                ...(baseRow._nYears      != null ? { nYears:         baseRow._nYears }      : {}),
                ...(baseRow._propWithdraw!= null ? { propWithdraw:   baseRow._propWithdraw }: {}),
                ...(baseRow._iraWithdrawPct != null ? { iraWithdrawPct: baseRow._iraWithdrawPct } : {}),
            };
            const { optConv, optResult } = optimizeConversionAmount(base, overrides, 'finalNW');
            if (!optResult || optConv === 0) continue;
            const lastEntry = optResult.log[optResult.log.length - 1];
            results.push({
                _id: results.length,
                _strategyLabel: baseRow._strategyLabel + ' ⇌',
                _paramLabel: baseRow._paramLabel,
                _paramSortVal: baseRow._paramSortVal,
                _maxConversion: baseRow._maxConversion,
                _spendGoal: base.spendGoal,
                _strategy: baseRow._strategy,
                _nYears: baseRow._nYears,
                _stratRate: baseRow._stratRate,
                _stratIRMAATier: baseRow._stratIRMAATier ?? null,
                _stratACAMultiple: baseRow._stratACAMultiple ?? 0,
                _propWithdraw: baseRow._propWithdraw ?? null,
                _iraWithdrawPct: baseRow._iraWithdrawPct ?? null,
                _isSpendOptimized: false,
                _isConvOptimized: true,
                _optConvAmt: optConv,
                _convSavings: (baseRow.totals.tax - optResult.totals.tax),
                totals: optResult.totals,
                finalNW: optResult.finalNW,
                finalNWCurrentDollars: lastEntry.totalWealth / (lastEntry.inflationFactor || 1)
            });
        }
    }

    // Update top-bar stats using the 0% propwd/no-maxConv row (first result, equivalent to baseline)
    const baseline = results[0];
    if (baseline) {
        updateStats(baseline.totals, baseline.finalNW, baseline.finalNWCurrentDollars);
    }

    window.optimizerResults = results;
    window.optimizerPerfStats = { totalMs: performance.now() - optimizerStart, runsCount: simulationCount };
    window.optimizerSortState = { colKey: 'spend', direction: 'desc' };
    renderOptimizerTable(results);
    renderSpendOptimizerBanner(results, base.spendGoal);
    showTab('tab-opt');
}

function renderSpendOptimizerBanner(results, baseSpendGoal) {
    const el = document.getElementById('opt-spend-banner');
    if (!el) return;

    // No-solution case: reverse search ran but even the floor (10% of baseline) failed
    if (window.optimizerNoSolutionFloor != null) {
        const floor = Math.round(window.optimizerNoSolutionFloor).toLocaleString();
        el.style.background = '#f8d7da';
        el.style.borderColor = '#f5c6cb';
        el.style.color = '#721c24';
        el.textContent = `⛔ No strategy could sustain your spending goal, and none could be found even at $${floor}/yr (the lowest level tried). Consider reducing your spend goal or increasing your portfolio.`;
        el.style.display = 'block';
        return;
    }

    const reverseRow = results.find(r => r._isReverseOptimized);
    if (reverseRow) {
        const amt = Math.round(reverseRow._spendGoal).toLocaleString();
        const label = reverseRow._strategyLabel;
        el.style.background = '#f8d7da';
        el.style.borderColor = '#f5c6cb';
        el.style.color = '#721c24';
        el.textContent = `⚠️ No strategy can fund your current spend goal. The highest sustainable spending found is $${amt}/yr, with all years fully funded. (Strategy: ${label})`;
        el.style.display = 'block';
        return;
    }

    const optimized = results
        .filter(r => r._isSpendOptimized && r.totals.success)
        .sort((a, b) => b._spendGoal - a._spendGoal);
    const best = optimized[0];
    if (best && (best._spendGoal / baseSpendGoal - 1) >= SPEND_SEARCH_MIN_DELTA) {
        const amt = Math.round(best._spendGoal).toLocaleString();
        const label = best._strategyLabel;
        el.style.background = '#fff3cd';
        el.style.borderColor = '#ffc107';
        el.style.color = '#856404';
        el.textContent = `💡 It appears you can increase your spending to $${amt}/yr with all years fully funded. (Strategy: ${label})`;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

// Column definitions (shared between render and sort)
function getOptimizerColumns() {
    const inC = () => document.getElementById('show-current-dollars')?.checked;
    const nerdknob = new URLSearchParams(location.search).has('nerdknob');
    const cols = [
        {
            key: 'status', label: '✓',
            getValue: r => r.totals.success ? '🟢' : '🚨',
            getSortValue: r => r.totals.success ? 1 : 0
        },
        {
            key: 'strategy', label: 'Strategy',
            getValue: r => r._strategyLabel,
            getSortValue: r => r._strategyLabel
        },
        {
            key: 'param', label: 'Param',
            getValue: r => r._paramLabel,
            getSortValue: r => r._paramSortVal
        },
        {
            key: 'spendGoal', label: 'Spend Goal',
            getValue: r => Math.round(r._spendGoal).toLocaleString(),
            getSortValue: r => r._spendGoal
        },
        {
            key: 'tax', label: 'Lifetime Tax',
            getValue: r => Math.round(inC() ? r.totals.taxCurrentDollars : r.totals.tax).toLocaleString(),
            getSortValue: r => inC() ? r.totals.taxCurrentDollars : r.totals.tax
        },
        {
            key: 'spend', label: 'Total Spendable',
            getValue: r => Math.round(inC() ? r.totals.spendCurrentDollars : r.totals.spend).toLocaleString(),
            getSortValue: r => inC() ? r.totals.spendCurrentDollars : r.totals.spend
        },
        {
            key: 'nw', label: 'Final Wealth',
            getValue: r => Math.round(inC() ? r.finalNWCurrentDollars : r.finalNW).toLocaleString(),
            getSortValue: r => inC() ? r.finalNWCurrentDollars : r.finalNW
        },
        {
            key: 'rate', label: 'Tax Rate',
            getValue: r => `${(r.totals.tax / r.totals.gross * 100).toFixed(1)}%`,
            getSortValue: r => r.totals.tax / r.totals.gross
        },
        {
            key: 'years', label: 'Yrs Funded',
            getValue: r => `${r.totals.yearsfunded}/${r.totals.yearstested}`,
            getSortValue: r => r.totals.yearsfunded
        },
        {
            key: 'rmd', label: 'Total RMDs',
            getValue: r => Math.round(r.totals.rmd).toLocaleString(),
            getSortValue: r => r.totals.rmd
        },
        {
            key: 'rmdtax', label: 'RMD Tax%',
            getValue: r => r.totals.tax > 0 ? `${(r.totals.rmdTax / r.totals.tax * 100).toFixed(0)}%` : '—',
            getSortValue: r => r.totals.rmdTax / (r.totals.tax || 1)
        },
        {
            key: 'betrAvg', label: 'Avg BETR',
            title: 'Average Break-Even Tax Rate across conversion years. If your expected future marginal rate exceeds this, conversions were advantageous on average. Appears for Conv Optimizer rows (⇌) and standard rows with conversions.',
            getValue: r => r.totals.betrAvg != null ? `${(r.totals.betrAvg * 100).toFixed(1)}%` : '—',
            getSortValue: r => r.totals.betrAvg ?? 999
        },
        {
            key: 'convSavings', label: 'Conv Savings',
            title: 'Lifetime tax savings from the additional IRA→Roth conversions run by Conv Optimizer, vs the same strategy with no extra conversions. Positive = converting more reduces your total lifetime tax bill.',
            getValue: r => r._convSavings != null ? '$' + Math.round(r._convSavings).toLocaleString() : '—',
            getSortValue: r => r._convSavings ?? -Infinity
        }
    ];
    if (nerdknob) {
        cols.push({
            key: 'simms', label: '⏱ms',
            getValue: r => r.totals.totalTime != null ? r.totals.totalTime.toFixed(1) : '—',
            getSortValue: r => r.totals.totalTime ?? 0
        });
    }
    return cols;
}

function renderOptimizerTable(results) {
    if (!results || results.length === 0) return;
    const columns = getOptimizerColumns();
    // Default: sort by Spendable descending; Final Wealth descending as tiebreaker
    const sortState = window.optimizerSortState ?? { colKey: 'spend', direction: 'desc' };

    // Sort a copy; preserve original _id for click handlers
    let display = results.slice();
    const nwCol = columns.find(c => c.key === 'nw');
    const col   = columns.find(c => c.key === sortState.colKey);
    if (col) {
        display.sort((a, b) => {
            const av = col.getSortValue(a), bv = col.getSortValue(b);
            const cmp = (typeof av === 'string') ? av.localeCompare(bv) : (av - bv);
            const primary = sortState.direction === 'asc' ? cmp : -cmp;
            // Tiebreaker: when sorting by Spendable and values are equal, sort by Final Wealth desc
            if (primary === 0 && sortState.colKey === 'spend' && nwCol) {
                return nwCol.getSortValue(b) - nwCol.getSortValue(a);
            }
            return primary;
        });
    }

    // Identify per-metric winners among successful rows
    const successes = results.filter(r => r.totals.success);
    const bestIds = new Set();
    const colWinners = {}; // key -> winning _id
    if (successes.length > 0) {
        const pick = (arr, fn, isMax) => arr.reduce((a, b) => isMax ? (fn(b) > fn(a) ? b : a) : (fn(b) < fn(a) ? b : a));
        const w1 = pick(successes, r => r.totals.tax, false);
        const w2 = pick(successes, r => r.totals.tax / r.totals.gross, false);
        const w3 = pick(successes, r => r.totals.spend, true);
        const w4 = pick(successes, r => r.finalNW, true);
        const w5 = pick(successes, r => r.totals.rmdTax / (r.totals.tax || 1), false);
        [w1, w2, w3, w4, w5].forEach(w => bestIds.add(w._id));
        colWinners.tax    = w1._id;
        colWinners.rate   = w2._id;
        colWinners.spend  = w3._id;
        colWinners.nw     = w4._id;
        colWinners.rmdtax = w5._id;
    }

    // Header — flat div cells for CSS grid
    const _hCellStyle = 'background:#f8f9fa;padding:6px 8px;border-bottom:2px solid #dee2e6;white-space:nowrap;font-weight:bold;cursor:pointer;user-select:none;position:sticky;top:0;z-index:1;';
    const headerHtml = columns.map(col => {
        const active = sortState.colKey === col.key;
        const arrow = active ? (sortState.direction === 'asc' ? ' ▲' : ' ▼') : '';
        const tip = col.title ? ` title="${col.title.replace(/"/g, '&quot;')}"` : '';
        return `<div style="${_hCellStyle}"${tip} onclick="sortOptimizerBy('${col.key}')">${col.label}${arrow}</div>`;
    }).join('');

    // Rows — display:contents wrapper; each cell carries row styling + onclick
    const rowsHtml = display.map(r => {
        const isWinner = bestIds.has(r._id);
        const isInfeasible = r._isBracketInfeasible && !isWinner;
        const rowTitle = isInfeasible
            ? 'Bracket target exceeded in >50% of years — income sources already push MAGI above this ceiling'
            : 'Click to load this strategy';
        const cells = columns.map(col => {
            const cellWin = (col.key === 'tax'    && r._id === colWinners.tax)
                         || (col.key === 'rate'   && r._id === colWinners.rate)
                         || (col.key === 'spend'  && r._id === colWinners.spend)
                         || (col.key === 'nw'     && r._id === colWinners.nw)
                         || (col.key === 'rmdtax' && r._id === colWinners.rmdtax);
            const bg = cellWin    ? '#4CAF5080'
                     : isInfeasible ? '#e8e8e8'
                     : isWinner   ? '#90EE90'
                     : r._isReverseOptimized ? '#fde8d8'
                     : r._isConvOptimized    ? '#e8f5e9'
                     : r._isSpendOptimized   ? '#dbeafe' : '';
            const extra = isInfeasible ? 'text-decoration:line-through;opacity:0.55;'
                        : isWinner     ? 'font-weight:bold;'
                        : (r._isReverseOptimized || r._isConvOptimized || r._isSpendOptimized) ? 'font-style:italic;' : '';
            const bgCss = bg ? `background-color:${bg};` : '';
            return `<div style="padding:4px 8px;cursor:pointer;${bgCss}${extra}" onclick="loadOptimizerResult(${r._id})" title="${rowTitle}">${col.getValue(r)}</div>`;
        }).join('');
        return `<div style="display:contents;">${cells}</div>`;
    }).join('');

    const optTableEl = document.getElementById('opt-table');
    optTableEl.style.gridTemplateColumns = columns.map(() => 'max-content').join(' ');
    optTableEl.innerHTML = headerHtml + rowsHtml;

    // Best summary table — unique winner rows labeled by what they won
    const bestEl = document.getElementById('opt-best');
    if (bestEl) {
        if (successes.length > 0) {
            const winnerDefs = [
                { key: 'spend',  label: '🏆 Most Spendable',   id: colWinners.spend  },
                { key: 'nw',     label: '💰 Most Wealth',       id: colWinners.nw     },
                { key: 'tax',    label: '📉 Lowest Tax',        id: colWinners.tax    },
                { key: 'rate',   label: '📊 Lowest Tax Rate',   id: colWinners.rate   },
                { key: 'rmdtax', label: '📋 Lowest RMD Tax%',   id: colWinners.rmdtax },
            ];
            // Deduplicate: a row can win multiple metrics; show it once under its first/best label
            const seen = new Set();
            const uniqueWinners = winnerDefs.filter(w => {
                if (seen.has(w.id)) return false;
                seen.add(w.id);
                return true;
            });
            const _bHdrStyle = 'background:#f8f9fa;padding:4px 8px;border-bottom:2px solid #dee2e6;font-weight:bold;white-space:nowrap;';
            const bestRows = uniqueWinners.map(w => {
                const r = results.find(x => x._id === w.id);
                if (!r) return '';
                const labelCell = `<div style="background:#4CAF50;color:#fff;font-size:0.78em;white-space:nowrap;padding:2px 6px;cursor:pointer;" onclick="loadOptimizerResult(${r._id})" title="${w.label} — click to load">${w.label}</div>`;
                const dataCells = columns.slice(1).map(col => {
                    const cellWin = col.key === w.key;
                    const bg = cellWin ? '#4CAF5080' : '#90EE90';
                    return `<div style="padding:4px 8px;background-color:${bg};font-weight:bold;cursor:pointer;" onclick="loadOptimizerResult(${r._id})" title="${w.label} — click to load">${col.getValue(r)}</div>`;
                }).join('');
                return `<div style="display:contents;">${labelCell}${dataCells}</div>`;
            }).join('');
            const bestHeader = columns.map((col, i) =>
                `<div style="${_bHdrStyle}">${i === 0 ? 'Best' : col.label}</div>`
            ).join('');
            const _bColsCss = columns.map(() => 'max-content').join(' ');
            bestEl.innerHTML = `<div style="display:grid;grid-template-columns:${_bColsCss};width:fit-content;margin-bottom:16px;border:1px solid #dee2e6;">${bestHeader}${bestRows}</div>`;
            bestEl.style.display = 'block';
        } else {
            bestEl.style.display = 'none';
        }
    }

    // Note when all spendable values are the same (fully-funded: every strategy hits the spend goal)
    const noteEl = document.getElementById('opt-note');
    if (noteEl) {
        const spendVals = results.map(r => r.totals.spend);
        const allSame = spendVals.every(v => v === spendVals[0]);
        if (allSame && results.length > 1) {
            noteEl.textContent = 'ℹ️ All strategies show the same Total Spendable — this means every strategy fully funds your spending goal. Differentiate by Lifetime Tax, Final Wealth, or Yrs Funded.';
            noteEl.style.display = 'block';
        } else {
            noteEl.style.display = 'none';
        }
    }

    // Nerdknob: show optimizer performance stats when URL contains ?nerdknob
    const perfEl = document.getElementById('opt-perf');
    if (perfEl) {
        const nerdknob = new URLSearchParams(location.search).has('nerdknob');
        const perf = window.optimizerPerfStats;
        if (nerdknob && perf) {
            const msPerRun = (perf.totalMs / perf.runsCount).toFixed(1);
            perfEl.textContent = `⏱ ${perf.totalMs.toFixed(0)}ms total · ${msPerRun}ms/run · ${perf.runsCount} runs`;
            perfEl.style.display = 'block';
        } else {
            perfEl.style.display = 'none';
        }
    }
}

function sortOptimizerBy(colKey) {
    const s = window.optimizerSortState ?? { colKey: null, direction: 'asc' };
    if (s.colKey === colKey) {
        s.direction = s.direction === 'asc' ? 'desc' : 'asc';
    } else {
        s.colKey = colKey;
        s.direction = 'asc';
    }
    window.optimizerSortState = s;
    if (window.optimizerResults) renderOptimizerTable(window.optimizerResults);
}

// Restore inputs from an optimizer row and re-run simulation
function loadOptimizerResult(id) {
    const result = (window.optimizerResults ?? []).find(r => r._id === id);
    if (!result) return;

    document.getElementById('strategy').value = result._strategy;

    if (result._strategy === 'fixed' && result._nYears != null) {
        document.getElementById('nYears').value = result._nYears;
    } else if (result._strategy === 'bracket' && (result._stratIRMAATier ?? -1) >= 0) {
        document.getElementById('stratRate').value = `irmaa${result._stratIRMAATier}`;
    } else if (result._strategy === 'bracket' && (result._stratACAMultiple ?? 0) > 0) {
        document.getElementById('stratRate').value = `aca${result._stratACAMultiple}`;
    } else if (result._strategy === 'bracket' && result._stratRate != null) {
        document.getElementById('stratRate').value = Math.round(result._stratRate * 100);
    } else if (result._strategy === 'propwd' && result._propWithdraw != null) {
        document.getElementById('propWithdraw').value = Math.round(result._propWithdraw * 100);
    } else if (result._strategy === 'fixedpct' && result._iraWithdrawPct != null) {
        document.getElementById('iraWithdrawPct').value = Math.round(result._iraWithdrawPct * 100);
    }

    document.getElementById('maxConversion').checked = result._maxConversion;
    const cyclicEl = document.getElementById('cyclicEnabled');
    if (cyclicEl) {
        cyclicEl.checked = !!(result._cyclicEnabled);
        onCyclicChange();
    }
    const cyclicOrderEl = document.getElementById('cyclicOrder');
    if (cyclicOrderEl) cyclicOrderEl.value = result._cyclicOrder ?? 'ira-first';
    // For spend-optimized rows, restore the optimized spend goal
    if (result._spendGoal != null) {
        DisplayHelpers.setDollarValue('spendGoal', Math.round(result._spendGoal));
    }
    toggleStrategyUI();
    runSimulation();
    showTab('tab-chart');
}

// //////////////////////////////////////////////////////////////////
// Column category mappings - each column can be in multiple categories
const columnCategories = {
    // Summary - high-level overview
    'year': ['Summary', 'Taxation', 'Balances', 'Income'],
    'age1': ['Summary'],
    'age2': ['Summary'],
    'status': ['Summary', 'Taxation'],
    'spendGoal': ['Summary', 'Income'],
    'netIncome': ['Summary', 'Income'],
    'totalWealth': ['Summary', 'Balances'],
    'totalTax': ['Summary', 'Taxation', 'Income'],
    'NominalRate%': ['Summary', 'Taxation'],
    'surplus': ['Summary', 'Income'],
    'shortfall': ['Summary', 'Income'],

    // Income Sources (could be its own category if you want)
    'SSincome': ['Summary', 'Income'],
    'pension': ['Summary', 'Income'],
    'totalIncome': ['Summary', 'Income'],
    'cashD+I': ['Cash Δ', 'Income'],

    // Balances - end-of-year balances
    'IRA1': ['Balances', 'IRA Δ'],
    'IRA2': ['Balances', 'IRA Δ'],
    'TotalIRA': ['Balances', 'IRA Δ'],
    'Cash': ['Balances', 'Cash Δ'],
    'Roth': ['Balances', 'Roth Δ'],
    'Brokerage': ['Balances', 'Brokerage Δ'],
    'Basis': ['Balances', 'Brokerage Δ'],
    'Spendable': ['Balances'],

    // Taxation
    'MAGI': ['Taxation'],
    'IRMAA': ['Taxation'],
    'IRMAATier': ['Taxation', 'Summary'],
    'FedTax': ['Taxation'],
    'StateTax': ['Taxation'],
    'CapGains': ['Taxation', 'Brokerage Δ', 'Income'],
    'SumTaxes': ['Taxation'],
    'FedRate%': ['Taxation', 'Summary'],
    'StateRate%': ['Taxation', 'Summary'],
    'FedCap': ['Taxation'],
    'StateCap': ['Taxation'],
    'BracketTarget': ['Taxation'],
    'BracketOverage': ['Taxation'],

    // IRA Changes - withdrawals, RMDs, and conversions
    'IRA1-': ['IRA Δ'],
    'IRA2-': ['IRA Δ'],
    'IRAwd': ['IRA Δ', 'Income'],
    'RMD%': ['IRA Δ'],
    'RMD1-': ['IRA Δ'],
    'RMD2-': ['IRA Δ'],
    'RMDwd': ['IRA Δ', 'Income'],
    'rothConv': ['IRA Δ', 'Roth Δ'],  // Conversion comes from IRA

    // Roth Changes - balance, withdrawals, growth, conversions
    'Roth1': ['Balances', 'Roth Δ'],
    'Roth2': ['Balances', 'Roth Δ'],
    'RothWD': ['Roth Δ', 'Income'],
    'rothG': ['Roth Δ'],

    // Brokerage Changes - balance, withdrawals, gains, growth
    'Brokerage-': ['Brokerage Δ', 'Income'],
    'brokerageG': ['Brokerage Δ'],

    // Cash Changes - balance, withdrawals, growth
    'CashWD': ['Cash Δ', 'Income'],
    'cashG': ['Cash Δ'],
    'surplusCash': ['Cash Δ', 'Income'],
    'netSpend%': ['Summary', 'IRA Δ'],

    // Debug / performance — only visible under Show All (no checkbox maps to 'Debug')
    'loopMs': ['Debug'],

    // Opportunity cost (Phase 20) + BETR signal (Phase 21) + extra conversion (Phase 23)
    'convOC':    ['Opp. Cost'],
    'excessOC':  ['Opp. Cost'],
    'convTax':   ['Opp. Cost'],
    'excessTax': ['Opp. Cost'],
    'BETR%':     ['Opp. Cost'],
    'betrFlag':  ['Opp. Cost'],
    'extraConv': ['Opp. Cost'],
    // Phase 24: Cyclic
    'subCycle':  ['Summary', 'Brokerage Δ'],
};

// Maps each column key to a visual group label for the group header row
const columnGroupDefs = {
    'year': 'Who', 'age1': 'Who', 'age2': 'Who', 'status': 'Who',
    'SSincome': 'Income', 'pension': 'Income', 'spendGoal': 'Income',
    'netIncome': 'Income', 'totalIncome': 'Income', 'surplus': 'Income',
    'shortfall': 'Income', 'RMDwd': 'Income', 'cashD+I': 'Income',
    'IRAwd': 'Withdrawals', 'IRA1-': 'Withdrawals', 'IRA2-': 'Withdrawals',
    'RMD1-': 'Withdrawals', 'RMD2-': 'Withdrawals',
    'Brokerage-': 'Withdrawals', 'RothWD': 'Withdrawals',
    'CashWD': 'Withdrawals', 'rothConv': 'Withdrawals', 'surplusCash': 'Withdrawals',
    'FedRate%': 'Taxes', 'StateRate%': 'Taxes', 'IRMAATier': 'Taxes',
    'IRMAA': 'Taxes', 'totalTax': 'Taxes', 'FedTax': 'Taxes', 'StateTax': 'Taxes',
    'CapGains': 'Taxes', 'MAGI': 'Taxes', 'NominalRate%': 'Taxes',
    'FedCap': 'Taxes', 'StateCap': 'Taxes', 'SumTaxes': 'Taxes',
    'BracketTarget': 'Taxes', 'BracketOverage': 'Taxes',
    'IRA1': 'Balances', 'IRA2': 'Balances', 'TotalIRA': 'Balances',
    'Roth1': 'Balances', 'Roth2': 'Balances',
    'Cash': 'Balances', 'Roth': 'Balances', 'Brokerage': 'Balances',
    'Basis': 'Balances', 'totalWealth': 'Balances', 'Spendable': 'Balances',
    'brokerageG': 'Balances', 'cashG': 'Balances', 'rothG': 'Balances', 'RMD%': 'Balances',
    'convOC': 'Opp. Cost', 'excessOC': 'Opp. Cost', 'convTax': 'Opp. Cost', 'excessTax': 'Opp. Cost',
    'BETR%': 'Opp. Cost', 'betrFlag': 'Opp. Cost', 'extraConv': 'Opp. Cost',
    'subCycle': 'Withdrawals',
    'netSpend%': 'Withdrawals',
};

// Get active categories based on checkbox state
function getActiveCategories() {
    const categories = [];
    if (document.getElementById('cat-summary')?.checked) categories.push('Summary');
    if (document.getElementById('cat-balances')?.checked) categories.push('Balances');
    if (document.getElementById('cat-income')?.checked) categories.push('Income');
    if (document.getElementById('cat-taxation')?.checked) categories.push('Taxation');
    if (document.getElementById('cat-ira')?.checked) categories.push('IRA Δ');
    if (document.getElementById('cat-roth')?.checked) categories.push('Roth Δ');
    if (document.getElementById('cat-brokerage')?.checked) categories.push('Brokerage Δ');
    if (document.getElementById('cat-cash')?.checked) categories.push('Cash Δ');
    if (document.getElementById('cat-oppcost')?.checked) categories.push('Opp. Cost');
    return categories;
}

// Check if a column should be visible based on category filters
function isColumnVisible(columnKey) {
    const showAll = document.getElementById('show-all')?.checked ?? false;

    if (showAll) {
        // Show all columns that are listed in at least one category
        return columnCategories.hasOwnProperty(columnKey);
    }

    const activeCategories = getActiveCategories();

    // Column is not categorized - hide it
    if (!columnCategories.hasOwnProperty(columnKey)) {
        return false;
    }

    // Check if column is in any active category
    const columnCats = columnCategories[columnKey];
    return columnCats.some(cat => activeCategories.includes(cat));
}

// Analyze which columns have content (non-zero, non-empty values)
function analyzeColumnContent(log) {
    if (!log || log.length === 0) return {};

    const keys = Object.keys(log[0]).filter(key => !key.startsWith('-'));
    const columnStatus = {};

    keys.forEach(key => {
        let hasNonZeroValue = false;

        for (const row of log) {
            const value = row[key];

            // Check if value exists and is non-zero
            if (value != null && value !== '' && value !== '—') {
                if (!isNaN(value) && parseFloat(value) !== 0) {
                    hasNonZeroValue = true;
                    break;
                } else if (isNaN(value) && value !== '—') {
                    // Non-numeric non-empty value
                    hasNonZeroValue = true;
                    break;
                }
            }
        }

        columnStatus[key] = hasNonZeroValue;
    });

    return columnStatus;
}

// Global variable to store column content analysis
let columnContentStatus = {};

// Update column visibility without rebuilding the entire table
function updateColumnVisibility() {
    const table = document.getElementById('main-table');
    if (!table) return;

    // Use the last thead row (column names), not the first (group header)
    const allHeaderRows = table.querySelectorAll('thead tr');
    const headerRow = allHeaderRows[allHeaderRows.length - 1];
    const bodyRows = table.querySelectorAll('tbody tr');

    if (!headerRow) return;

    const showEmpty = document.getElementById('show-empty-columns')?.checked ?? false;

    // Get column keys from header
    const headers = Array.from(headerRow.querySelectorAll('th'));

    headers.forEach((th, index) => {
        const columnKey = th.textContent;
        const visibleByCategory = isColumnVisible(columnKey);
        const isEmpty = th.classList.contains('empty-column');

        // Column is visible if it passes category filter AND (has content OR show-empty is checked)
        const visible = visibleByCategory && (showEmpty || !isEmpty);

        // Update header
        if (visible) {
            th.classList.remove('hidden-column');
        } else {
            th.classList.add('hidden-column');
        }

        // Update all body cells in this column
        bodyRows.forEach(row => {
            const cell = row.cells[index];
            if (cell) {
                if (visible) {
                    cell.classList.remove('hidden-column');
                } else {
                    cell.classList.add('hidden-column');
                }
            }
        });
    });

    rebuildGroupRow(table);
}

// Rebuild the group header row based on currently visible columns
function rebuildGroupRow(table) {
    const thead = table.tHead;
    if (!thead || thead.rows.length < 2) return;
    const groupRow = thead.rows[0];
    const headerRow = thead.rows[1];
    groupRow.innerHTML = '';

    const groupColors = {
        'Who':          '#e8eaf6',
        'Income':       '#e8f5e9',
        'Withdrawals':  '#fff3e0',
        'Taxes':        '#e3f2fd',
        'Balances':     '#e0f2f1',
    };

    let currentGroup = null;
    let currentSpan = 0;
    let currentCell = null;

    Array.from(headerRow.cells).forEach(th => {
        if (th.classList.contains('hidden-column')) return;
        const key = th.textContent.trim();
        const group = columnGroupDefs[key] ?? '';

        if (group !== currentGroup) {
            if (currentCell !== null) currentCell.colSpan = currentSpan;
            currentGroup = group;
            currentSpan = 1;
            currentCell = document.createElement('th');
            currentCell.textContent = group;
            const bg = groupColors[group] ?? '#f5f5f5';
            currentCell.style.cssText =
                `background:${bg};text-align:center;font-size:0.78em;font-weight:bold;` +
                `border-bottom:1px solid #bbb;padding:2px 4px;`;
            groupRow.appendChild(currentCell);
        } else {
            currentSpan++;
        }
    });
    if (currentCell !== null) currentCell.colSpan = currentSpan;
}

function updateTable(log) {
    const oldTable = document.getElementById('main-table');

    if (!log || log.length === 0) {
        if (oldTable) {
            oldTable.remove();
        }
        return null;
    }

    // Analyze which columns have content
    columnContentStatus = analyzeColumnContent(log);

    const table = document.createElement('table');
    table.border = '1';
    table.id = 'main-table';

    const keys = Object.keys(log[0]);

    // Create header — row 0 is the group banner, row 1 is the column names
    const thead = table.createTHead();
    thead.insertRow(); // group row placeholder — populated by rebuildGroupRow below
    const headerRow = thead.insertRow();

    const tooltips = {
        'year': 'When yellow, it indicates a single survivor. If the rest of the row is pink, it means the year was underfunded.',
        'age1': 'Age at end of year (Dec 31). Used for RMD eligibility. May differ from current age shown in Profile & Ages if birthday falls late in the year.',
        'age2': 'Spouse age at end of year (Dec 31). Used for RMD eligibility. May differ from current age shown in Profile & Ages if birthday falls late in the year.',
        'RMDwd': 'Total of all Required Minimum Distributions (RMDs)',
        'RMD%': 'The highest percentage RMD required for IRA1 or IRA2.',
        'Brokerage': 'Year end Brokerage balance',
        'Brokerage-': 'Withdrawals from Brokerage account (asset sales/cash withdrawal)',
        'Basis': 'The amount in brokerage which can be withdrawn tax free.',
        'IRA1-': 'Withdrawals from IRA1',
        'IRA2-': 'Withdrawals from IRA2',
        'CapGains': 'Amount of gains from withdrawing brokerage assets.',
        'IRMAA': 'Annual IRMAA surcharge based on MAGI from 2 years prior.',
        'IRMAATier': 'IRMAA tier (e.g. Tier 1–6) derived from MAGI 2 years ago.',
        'FedCap': 'Upper boundary of the current federal tax bracket.',
        'StateCap': 'Upper boundary of the current state tax bracket.',
        'BracketTarget': 'MAGI ceiling targeted by the bracket/IRMAA strategy this year (0 for other strategies).',
        'BracketOverage': 'Amount MAGI exceeded the bracket target. Non-zero means spending needs pushed above the ceiling.',
        'spendGoal': 'This amount increases by inflation less Spend Delta%.',
        'Roth': 'Combined Roth balance at year end.',
        'Roth1': "Person 1's Roth balance at year end.",
        'Roth2': "Person 2's Roth balance at year end.",
        'RothG': 'Growth in the Roth (added to Roth account)',
        'RothConv': 'Amount moved from IRA to Roth (converted)',
        'CashWD': 'Tax free withdrawals from Cash',
        'cashD+I': 'Dividends (from brokerage) and interest from Cash (deposits)',
        'MAGI': 'Modified Adjusted Gross Income - determines future IRMAA',
        'totalTax': 'Federal, State, IRMAA, NIIT, and CapGains taxes — in total.',
        'SumTaxes': 'Running total of Federal, State, IRMAA, NIIT, and CapGains taxes.',
        'shortfall': 'How much income is missing, that is: spendGoal - (totalIncome - totalTax). Likely due to errors in the calculation or unexpected bracket changes - or running out of assets.',
        'totalIncome': 'Funds from all sources, taxable and tax-free.',
        'NominalRate%': 'TotalTax/TotalGrossIncome for all taxes - Fed, State, IRMAA',
        'convOC': 'Roth Conversion Opportunity Cost. Formula: (RothActual + TaxableActual) − (TradShadow + TaxableShadow − TradShadow × TaxFuture). TradShadow = what the IRA would hold if no conversions had occurred (grows at IRA rate). Positive = actual portfolio outpaces the no-conversion shadow after taxes. Break-even year shown in the summary stat bar.',
        'excessOC': 'Excess Withdrawal Opportunity Cost. Same formula as Conv OC but applied to surplus IRA withdrawals routed to Cash rather than Roth. TaxableShadow is reduced by the after-tax excess cash (actual has more; shadow has less). Positive = having the extra cash outweighs the lost IRA growth.',
        'convTax': 'Incremental federal + state tax attributable to this year\'s Roth conversion (true marginal method: re-runs tax calculation without the conversion and takes the difference). Does not include IRMAA.',
        'excessTax': 'Incremental federal + state tax attributable to this year\'s excess IRA withdrawal routed to Cash (same method as Conv Tax).',
        'BETR%': 'Break-Even Tax Rate (Kitces formula): t_now × (1 + r_taxable)^n / (1 + r_ira)^n. The future marginal rate at which converting now is tax-neutral vs leaving in IRA. If your expected future rate (Future IRA Tax %) exceeds BETR → conversion advantageous (▲). When r_taxable < r_ira (taxable drag), BETR falls below current rate, making conversion even more compelling.',
        'betrFlag': '▲ = expected future rate exceeds BETR by >2pp → conversion beneficial. ▼ = expected future rate is below BETR → conversion costly. ≈ = within 2pp either way (marginal).',
        'extraConv': 'Gross IRA amount additionally withdrawn and converted to Roth by the Phase 23 conversion optimizer, independent of spending strategy. Taxes come from IRA gross; net Roth credit = extraConv − incremental tax.',
        'subCycle': 'Cyclic sub-cycle marker. B = brokerage harvest year (spending drawn from Brokerage; IRA free for conversions). I = IRA draw year (normal IRA withdrawal). ⚠B = brokerage harvest year but balance was below 50% of target — fell back to partial IRA draw.',
        'netSpend%': 'Net asset spend rate: fraction of prior year\'s total wealth consumed for spending. Excludes Roth conversions (IRA→Roth reallocation) and reinvested surplus income. The classic "4% rule" targets a ~4% spend rate.',
    };

    keys.forEach(key => {
        if (!key.startsWith('-')) {
            const th = document.createElement('th');
            const displayKey = key.endsWith('!') ? key.slice(0, -1) : key;
            th.textContent = displayKey;

            if (tooltips[key]) {
                th.title = tooltips[key];
            }

            // Apply visibility based on category filter AND empty column filter
            const visibleByCategory = isColumnVisible(displayKey);
            const hasContent = columnContentStatus[key];
            const showEmpty = document.getElementById('show-empty-columns')?.checked ?? false;

            if (!visibleByCategory || (!hasContent && !showEmpty)) {
                th.classList.add('hidden-column');
            }

            // Mark empty columns for styling
            if (!hasContent) {
                th.classList.add('empty-column');
            }

            headerRow.appendChild(th);
        }
    });

    // Create body
    const tbody = table.createTBody();
    let maritalStatus = 'MFJ';
    log.forEach((row, i) => {
        const tr = tbody.insertRow();

        // Check conditions for highlighting
        const spendGoal = row['SpendGoal'] ?? row['spendGoal'];
        const netIncome = row['NetIncome'] ?? row['netIncome'];
        const totalWealth = row['TotalWealth'] ?? row['totalWealth'];
        const age1 = row['Age1'] ?? row['age1'];
        const age2 = row['Age2'] ?? row['age2'];

        // Underfunded when income falls short, or portfolio can't cover its required draw.
        const rowGuaranteed = row['guaranteedIncome'] ?? 0;
        const rowPortfolio  = row['portfolioBalance'] ?? (totalWealth ?? 0);
        const rowRequired   = Math.max(0, spendGoal - rowGuaranteed);
        const incomeShortfall = (netIncome < spendGoal * 0.99) || (rowPortfolio < rowRequired);
        const deathOccurred = maritalStatus != row['status'];

        // IRMAA tier cell tint — blue scale (taxation theme), applied only to relevant columns
        const irmaaTierColors = {
            'Tier 1': ['#E8F4FF', '#000'], 'Tier 2': ['#BDD9FF', '#000'], 'Tier 3': ['#90BBFF', '#000'],
            'Tier 4': ['#6090FF', '#000'], 'Tier 5': ['#3366FF', '#fff'], 'Tier 6 (TOP)': ['#0000FF', '#fff'],
        };
        const tierEntry = irmaaTierColors[row['IRMAATier']];
        const _irmaaCols = ['year', 'IRMAATier', 'totalIncome', 'IRMAA', 'totalTax'];

        // Pink takes priority over tier color
        if (incomeShortfall) {
            tr.style.backgroundColor = '#ffb6c180';  // Light pink
            tr.style.color = '';  // reset to default dark text
        }

        // Apply cell-level yellow highlighting for death occurred
        const deathHighlightCols = ['year', 'age1', 'age2', 'status', 'SSincome'];

        keys.forEach(key => {
            if (!key.startsWith('-') && key !== 'inflationFactor') {
                const td = tr.insertCell();
                const value = row[key];

                if (tierEntry && !incomeShortfall && _irmaaCols.includes(key)) {
                    td.style.backgroundColor = tierEntry[0];
                    td.style.color = tierEntry[1];
                }
                if (deathOccurred && deathHighlightCols.includes(key.toLowerCase())) {
                    td.style.backgroundColor = '#ffff99';  // Light yellow
                    td.style.color = '';
                }
                if ((key === 'BracketOverage' || key === 'netIncome') && (row['BracketOverage'] ?? 0) > 0) {
                    td.style.backgroundColor = '#ff8c0099';  // Orange — MAGI exceeded bracket ceiling
                }
                if (key === 'totalTax' || key === 'year') {
                    td.style.cursor = 'pointer';
                    td.style.textDecoration = 'underline dotted';
                    td.title = 'Click to open Tax Payment Planner for this year';
                    td.onclick = () => openTaxPlanner(row, i > 0 ? log[i - 1] : null);
                }

                // Check if key indicates percentage
                const isPercent = key.toLowerCase().includes('%');
                const isYear = key.toLowerCase().includes('yr') || key.toLowerCase().includes('year');

                if (value != null && !isNaN(value)) {
                    if (isPercent) {
                        // Format as percentage (convert from decimal)
                        td.textContent = (value * 100).toFixed(2);
                    } else {
                        // Format as whole number
                        if (isYear) {
                            td.textContent = value;
                        } else {
                            const inCurrentDollars = document.getElementById('show-current-dollars')?.checked;
                            const displayValue = inCurrentDollars ? value / (row.inflationFactor || 1) : value;
                            td.textContent = Math.round(displayValue).toLocaleString();
                        }
                    }
                } else {
                    // Normalize IRMAATier base value for display
                    td.textContent = (key === 'IRMAATier' && (value === '-none-' || value === '-'))
                        ? '—'
                        : (value ?? '');
                }

                // Apply visibility based on category filter AND empty column filter
                const displayKey = key.endsWith('!') ? key.slice(0, -1) : key;
                const visibleByCategory = isColumnVisible(displayKey);
                const hasContent = columnContentStatus[key];
                const showEmpty = document.getElementById('show-empty-columns')?.checked ?? false;

                if (!visibleByCategory || (!hasContent && !showEmpty)) {
                    td.classList.add('hidden-column');
                }

                // Mark empty columns for styling
                if (!hasContent) {
                    td.classList.add('empty-column');
                }

                tr.appendChild(td);
            }
        });
    });

    rebuildGroupRow(table);

    if (oldTable) {
        oldTable.replaceWith(table);
    }

    return table;
}


function openTaxPlanner(row, prevRow) {
    const p = new URLSearchParams();

    const set = (k, v) => { if (v != null && v !== '' && !isNaN(v)) p.set(k, Math.round(v)); };
    const setF = (k, v) => { if (v != null && v !== '' && !isNaN(v)) p.set(k, v); };

    set('taxYear', row.year);
    set('federalTax', row.FedTax);
    set('stateTax', row.StateTax);
    if (prevRow) {
        set('priorYearFedTax', prevRow.FedTax);
        set('priorYearStateTax', prevRow.StateTax);
    }
    set('ssIncome', row.SSincome);
    set('pensionIncome', row.pension);
    set('interest', row.cashInterest);
    set('qualifiedDivs', row.cashDividends);
    set('capitalGains', row.CapGains);
    set('ira1Rmd', row['RMD1-']);
    set('ira2Rmd', row['RMD2-']);
    set('ira1Voluntary', Math.max(0, (row['IRA1-'] || 0) - (row['RMD1-'] || 0)));
    set('ira2Voluntary', Math.max(0, (row['IRA2-'] || 0) - (row['RMD2-'] || 0)));

    const rothConv = row.rothConv || 0;
    if (rothConv > 0) {
        if ((row.IRA1 || 0) >= (row.IRA2 || 0)) {
            set('ira1RothConversion', rothConv);
        } else {
            set('ira2RothConversion', rothConv);
        }
    }

    const marginalOrd = ((row['FedRate%'] || 0) + (row['StateRate%'] || 0)) * 100;
    if (marginalOrd > 0) setF('marginalOrdRate', marginalOrd.toFixed(1));

    const stateEl = document.getElementById('STATEname');
    if (stateEl?.value) p.set('state', stateEl.value);

    const growthEl = document.getElementById('growth');
    if (growthEl?.value) setF('portfolioRate', parseFloat(growthEl.value));

    const cashYieldEl = document.getElementById('cashYield');
    if (cashYieldEl?.value) setF('hysaGross', parseFloat(cashYieldEl.value));

    window.open('RetirementTaxPlanner.html?' + p.toString(), '_blank');
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


function updateStats(totals, finalNW, finalNWCurrentDollars = finalNW, minNetWorth = 100000) {
    const inCD = document.getElementById('show-current-dollars')?.checked;
    const dispTax   = inCD ? totals.taxCurrentDollars   : totals.tax;
    const dispSpend = inCD ? totals.spendCurrentDollars : totals.spend;
    const dispNW    = inCD ? finalNWCurrentDollars      : finalNW;
    const dispRate  = totals.tax / totals.gross;

    document.getElementById('stat-rate').innerText  = (dispRate * 100).toFixed(1) + '%';
    document.getElementById('stat-spend').innerText = '$' + Math.round(dispSpend).toLocaleString();
    document.getElementById('stat-tax').innerText   = '$' + Math.round(dispTax).toLocaleString();
    document.getElementById('stat-nw').innerText    = '$' + Math.round(dispNW).toLocaleString();
    const rmdEl = document.getElementById('stat-rmd');
    const rmdPctEl = document.getElementById('stat-rmd-pct');
    if (rmdEl) rmdEl.innerText = '$' + Math.round(totals.rmd ?? 0).toLocaleString();
    if (rmdPctEl) rmdPctEl.innerText = totals.tax > 0
        ? `${((totals.rmdTax ?? 0) / totals.tax * 100).toFixed(0)}% of taxes`
        : '';
    const yearsEl = document.getElementById('stat-years');
    if (yearsEl) {
        yearsEl.innerText = totals.yearsfunded + '/' + totals.yearstested;
        const fullyFunded = totals.yearsfunded >= totals.yearstested && finalNW > minNetWorth;
        yearsEl.style.color = fullyFunded ? '' : '#c0392b';
    }
    const changeEl = document.getElementById('stat-success');
    if (changeEl) changeEl.innerText = _lastChangedInputLabel ? '↺ ' + _lastChangedInputLabel : '';
    const convBEEl = document.getElementById('stat-conv-be');
    if (convBEEl) convBEEl.innerText = totals.convBEYear ?? '—';

    // Phase 21: BETR average display
    const betrAvgEl = document.getElementById('stat-betr-avg');
    if (betrAvgEl) {
        if (totals.betrAvg !== null && totals.betrAvg !== undefined) {
            betrAvgEl.innerText = (totals.betrAvg * 100).toFixed(1) + '%';
        } else {
            betrAvgEl.innerText = '—';
        }
    }

    const avgSpendEl = document.getElementById('stat-avg-spend-rate');
    if (avgSpendEl) {
        avgSpendEl.innerText = (totals.avgSpendRate != null)
            ? (totals.avgSpendRate * 100).toFixed(1) + '%' : '—';
    }

    // Phase 23: projected RMD stat (reads from DOM inputs directly)
    updateProjectedRMDStat();

    // Delta vs previous run
    if (_prevStatsTotals) {
        const pTax   = inCD ? _prevStatsTotals.taxCurrentDollars   : _prevStatsTotals.tax;
        const pSpend = inCD ? _prevStatsTotals.spendCurrentDollars : _prevStatsTotals.spend;
        const pNW    = inCD ? _prevStatsFinalNWCD                  : _prevStatsFinalNW;
        const pRate  = _prevStatsTotals.tax / _prevStatsTotals.gross;

        function fmtDelta(cur, prev, preferHigh) {
            const d = Math.round(cur - prev);
            if (d === 0) return '';
            const good = preferHigh ? d > 0 : d < 0;
            const clr = good ? '#1a7a1a' : '#c0392b';
            return `<span style="color:${clr}">${d > 0 ? '+' : ''}${d.toLocaleString()}</span>`;
        }
        function fmtDeltaPct(cur, prev, preferHigh) {
            const d = cur - prev;
            if (Math.abs(d) < 0.00005) return '';
            const good = preferHigh ? d > 0 : d < 0;
            const clr = good ? '#1a7a1a' : '#c0392b';
            return `<span style="color:${clr}">${d > 0 ? '+' : ''}${(d * 100).toFixed(2)}%</span>`;
        }

        const yD = document.getElementById('stat-years-delta');
        const rD = document.getElementById('stat-rate-delta');
        const tD = document.getElementById('stat-tax-delta');
        const sD = document.getElementById('stat-spend-delta');
        const nD = document.getElementById('stat-nw-delta');
        if (yD) yD.innerHTML = fmtDelta(totals.yearsfunded, _prevStatsTotals.yearsfunded, true);
        if (rD) rD.innerHTML = fmtDeltaPct(dispRate, pRate, false);
        if (tD) tD.innerHTML = fmtDelta(dispTax, pTax, false);
        if (sD) sD.innerHTML = fmtDelta(dispSpend, pSpend, true);
        if (nD) nD.innerHTML = fmtDelta(dispNW, pNW, true);
    }

    _prevStatsTotals    = { ...totals };
    _prevStatsFinalNW   = finalNW;
    _prevStatsFinalNWCD = finalNWCurrentDollars;
}

// Phase 23: update projected-RMD stats in the stats bar.
// RMD divisors come from RMD_TABLE in taxengine.js (full table, ages 72–120).
// Reads IRA balances, birth years, and growth rate from DOM inputs — no totals arg needed.
function updateProjectedRMDStat() {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    function calcRMDProjection(birthYear, birthMonth, iraBalance, growthRate) {
        if (!birthYear || !iraBalance || iraBalance <= 0) return null;
        const rmdAge = birthYear >= 1960 ? 75 : 73;
        const age = curYear - birthYear - (curMonth <= (birthMonth || 12) ? 1 : 0);
        const yearsTo = rmdAge - age;
        if (yearsTo <= 0) {
            // Already in RMD — estimate current RMD from current IRA balance
            const factor = RMD_TABLE[Math.min(age, 120)] ?? 2.0;
            return { rmdAge, rmdYear: curYear, projIRA: iraBalance, firstRMD: iraBalance / factor, alreadyRMD: true };
        }
        const projIRA = iraBalance * Math.pow(1 + growthRate, yearsTo);
        const factor = RMD_TABLE[rmdAge] ?? 26.5;
        return { rmdAge, rmdYear: curYear + yearsTo, projIRA, firstRMD: projIRA / factor, alreadyRMD: false };
    }

    const growthRate = (+val('growth') / 100) || 0.06;
    const ira1 = +val('IRA1') || 0;
    const ira2 = +val('IRA2') || 0;
    const by1 = +val('birthyear1');
    const bm1 = +val('birthmonth1') || 12;
    const by2 = +val('birthyear2');
    const bm2 = +val('birthmonth2') || 12;
    const hasSpouse = !!(by2 && ira2 > 0);

    const rmd1 = calcRMDProjection(by1, bm1, ira1, growthRate);
    const rmd2 = hasSpouse ? calcRMDProjection(by2, bm2, ira2, growthRate) : null;

    function fmtRMD(rmd, label) {
        if (!rmd) return '';
        const amt = '$' + Math.round(rmd.firstRMD).toLocaleString();
        return rmd.alreadyRMD
            ? `${label} RMD (est. now): ${amt}/yr`
            : `${label} RMD at ${rmd.rmdAge} (${rmd.rmdYear}): ~${amt}/yr`;
    }

    const el1 = document.getElementById('stat-proj-rmd1');
    const el2 = document.getElementById('stat-proj-rmd2');

    // When a simulation has run, use actual RMD values from the log (strategy-dependent).
    if (lastSimulationLog?.length > 0) {
        const row1 = lastSimulationLog.find(r => (r['RMD1-'] ?? 0) > 0);
        const row2 = lastSimulationLog.find(r => (r['RMD2-'] ?? 0) > 0);
        if (el1) {
            if (row1) {
                el1.textContent = `You RMD (${row1.year}): ~$${Math.round(row1['RMD1-']).toLocaleString()} (strategy)`;
                el1.title = `First actual RMD in simulation year ${row1.year}`;
                el1.style.display = '';
            } else {
                el1.style.display = 'none';
            }
        }
        if (el2) {
            if (row2) {
                el2.textContent = `Spouse RMD (${row2.year}): ~$${Math.round(row2['RMD2-']).toLocaleString()} (strategy)`;
                el2.title = `First actual RMD in simulation year ${row2.year}`;
                el2.style.display = '';
            } else {
                el2.style.display = 'none';
            }
        }
        return;
    }

    if (el1) {
        if (rmd1) {
            el1.innerText = fmtRMD(rmd1, 'You') + ' (projected)';
            el1.title = `IRA1 projected at age ${rmd1.rmdAge}: $${Math.round(rmd1.projIRA).toLocaleString()}`;
            el1.style.display = '';
        } else {
            el1.style.display = 'none';
        }
    }
    if (el2) {
        if (rmd2) {
            el2.innerText = fmtRMD(rmd2, 'Spouse') + ' (projected)';
            el2.title = `IRA2 projected at age ${rmd2.rmdAge}: $${Math.round(rmd2.projIRA).toLocaleString()}`;
            el2.style.display = '';
        } else {
            el2.style.display = 'none';
        }
    }
}

let lastSimulationLog = null;
let lastTotals = null, lastFinalNW = null, lastFinalNWCurrentDollars = null;
let _prevStatsTotals = null, _prevStatsFinalNW = null, _prevStatsFinalNWCD = null;
let _lastChangedInputLabel = null;
let assetChart, incomeChart;

// Crosshair plugin — vertical dashed line at the active x position
const crosshairPlugin = {
    id: 'crosshair',
    afterDraw(chart) {
        if (chart.tooltip?._active?.length) {
            const x = chart.tooltip._active[0].element.x;
            const { top, bottom } = chart.chartArea;
            const ctx = chart.ctx;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, bottom);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.restore();
        }
    }
};

function syncChart(source, target, event) {
    const pts = source.getElementsAtEventForMode(event, 'index', { intersect: false }, false);
    if (pts.length === 0) return;
    const idx = pts[0].index;
    const active = target.data.datasets.map((_, i) => ({ datasetIndex: i, index: idx }));
    target.setActiveElements(active);
    target.tooltip.setActiveElements(active, { x: 0, y: 0 });
    target.update('none');
}

function clearChartHighlight(chart) {
    chart.setActiveElements([]);
    chart.tooltip.setActiveElements([], { x: 0, y: 0 });
    chart.update('none');
}

function setupChartSync() {
    if (typeof Chart !== 'undefined') Chart.register(crosshairPlugin);
    const aCanvas = document.getElementById('chartAssets');
    const iCanvas = document.getElementById('chartIncomeSources');
    if (!aCanvas || !iCanvas) return;
    const syncOthers = (src, others, e) => others.forEach(c => { if (c) syncChart(src, c, e); });
    const clearOthers = charts => charts.forEach(c => { if (c) clearChartHighlight(c); });
    aCanvas.addEventListener('mousemove', e => syncOthers(assetChart,  [incomeChart], e));
    aCanvas.addEventListener('mouseleave', () => clearOthers([incomeChart]));
    iCanvas.addEventListener('mousemove', e => syncOthers(incomeChart, [assetChart], e));
    iCanvas.addEventListener('mouseleave', () => clearOthers([assetChart]));
}
let chartPersonView = 'both';

function setChartPersonView(v) {
    chartPersonView = v;
    ['both', 'mine', 'spouse'].forEach(k => {
        const btn = document.getElementById(`chartPerson_${k}`);
        if (btn) btn.classList.toggle('active', k === v);
    });
    if (lastSimulationLog) updateCharts(lastSimulationLog);
}

function updateCharts(log) {
    const inCurrentDollars = document.getElementById('show-current-dollars')?.checked;
    const adj = r => inCurrentDollars ? 1 / (r.inflationFactor || 1) : 1;

    const sharedTooltip = {
        interaction: { mode: 'index', intersect: false },
        plugins: {
            tooltip: {
                itemSort: (a, b) => b.parsed.y - a.parsed.y,
                callbacks: {
                    title: items => {
                        const r = log[items[0]?.dataIndex];
                        if (!r) return items[0]?.label ?? '';
                        const a1 = (r.age1 == null || r.age1 === '—') ? '--' : r.age1;
                        const a2 = (r.age2 == null || r.age2 === '—') ? '--' : r.age2;
                        const taxPct = r.totalIncome > 0
                            ? (r.totalTax / r.totalIncome * 100).toFixed(1) + '%'
                            : '--';
                        return `${r.year}  |  You: ${a1}  Spouse: ${a2}  |  Tax: ${taxPct}`;
                    },
                    label: ctx => ctx.dataset.label + ': ' + Math.round(ctx.parsed.y).toLocaleString()
                }
            }
        }
    };

    const mkLine = (label, color, dataFn) => ({
        label, data: log.map(dataFn),
        borderColor: color, backgroundColor: color,
        pointBackgroundColor: color, fill: false
    });

    const ctxA = document.getElementById('chartAssets').getContext('2d');
    (Chart.getChart(ctxA.canvas) ?? assetChart)?.destroy();
    const iraLabel  = chartPersonView === 'mine' ? 'My IRA'    : chartPersonView === 'spouse' ? 'Spouse IRA'  : 'IRAs';
    const rothLabel = chartPersonView === 'mine' ? 'My Roth'   : chartPersonView === 'spouse' ? 'Spouse Roth' : 'Roth';
    const iraData   = r => (chartPersonView === 'mine' ? r.IRA1 : chartPersonView === 'spouse' ? r.IRA2 : r.TotalIRA) * adj(r);
    const rothData  = r => (chartPersonView === 'mine' ? (r.Roth1 || 0) : chartPersonView === 'spouse' ? (r.Roth2 || 0) : r.Roth) * adj(r);

    assetChart = new Chart(ctxA, {
        type: 'line',
        data: {
            labels: log.map(r => r.year),
            datasets: [
                mkLine(iraLabel,      '#e67e22', iraData),
                mkLine(rothLabel,     '#8e44ad', rothData),
                mkLine('Brokerage',   '#2980b9', r => r.Brokerage   * adj(r)),
                mkLine('Cash',        '#27ae60', r => r.Cash        * adj(r)),
                mkLine('TotalWealth', '#555555', r => r.totalWealth * adj(r))
            ]
        },
        options: {
            ...sharedTooltip,
            plugins: {
                ...sharedTooltip.plugins,
                legend: { labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 10, boxHeight: 10, padding: 16 } }
            }
        }
    });

    // Income Sources chart
    // All income sources are scaled by (netIncome / visibleSum) ≈ (1 - effectiveTaxRate).
    // visibleSum = all income sources contributing to spending (including Cash WD and Basis Return).
    // This keeps each source proportional to its nominal value — a fixed pension stays
    // nearly fixed rather than inflating when Cash becomes the dominant income source.
    // Tax bands sit on top, reaching totalIncome. Spendable Income line at netIncome.
    const ctxI = document.getElementById('chartIncomeSources').getContext('2d');
    (Chart.getChart(ctxI.canvas) ?? incomeChart)?.destroy();

    // Brokerage basis return: the untaxed (return-of-basis) portion of brokerage withdrawals
    const basisReturn = r => Math.max(0, (r['Brokerage-'] ?? 0) - (r.CapGains ?? 0));

    // All income sources (including Cash WD and Basis Return). IRAwd excludes rothConv since
    // that is shown separately as a cost above the Spendable line.
    const visibleSum = r => r.SSincome + r.pension + r.RMDwd + Math.max(0, r.IRAwd - r.rothConv)
        + r.RothWD + r.CapGains + r.cashDividends + r.cashInterest
        + (r.CashWD ?? 0) + basisReturn(r);

    // scale = (1 - effectiveTaxRate) on post-refund income. Using r.netIncome is wrong in surplus
    // years because netIncome was computed with pre-refund cash withdrawals; the logged CashWD is
    // post-refund. Deriving scale from (visibleSum - totalTax) / visibleSum stays correct in both.
    const mkInc = (label, color, rawFn) => ({
        label, type: 'bar', backgroundColor: color, stack: 'income', order: 2,
        data: log.map(r => {
            const vsum = visibleSum(r);
            const scale = vsum > 0 ? (vsum - r.totalTax) / vsum : 1;
            return rawFn(r) * scale * adj(r);
        })
    });
    const mkAbs = (label, color, rawFn) => ({
        label, type: 'bar', backgroundColor: color, stack: 'income', order: 2,
        data: log.map(r => rawFn(r) * adj(r))
    });

    incomeChart = new Chart(ctxI, {
        type: 'bar',  // required for Chart.js 4.x mixed bar+line; per-dataset type overrides apply
        data: {
            labels: log.map(r => r.year),
            datasets: [
                // Income sources — all scaled by (1 - effectiveTaxRate) so they sum to (visibleSum - totalTax)
                mkInc('SS',              '#3498dbB0', r => r.SSincome),
                mkInc('Pension',         '#7f8c8dB0', r => r.pension),
                mkInc('IRA RMD',         '#e67e22B0', r => r.RMDwd),
                mkInc('Interest',        '#f1c40fB0', r => r.cashInterest),
                mkInc('IRA WD',          '#d35400B0', r => Math.max(0, r.IRAwd - r.rothConv)),
                mkInc('Roth WD',         '#8e44adB0', r => r.RothWD),
                mkInc('Gains+Div',       '#1abc9cB0', r => r.CapGains + r.cashDividends),
                mkInc('Cash WD',         '#27ae60B0', r => r.CashWD ?? 0),
                mkInc('Brokerage',       '#0000CCB0', r => basisReturn(r)),
                // Visual separator between spending and expense legend items
                { label: '│', type: 'bar', data: log.map(() => 0), backgroundColor: 'transparent', borderWidth: 0, stack: 'income', order: 2 },
                // Expenses stack on top of the Spendable Income line (unscaled absolute amounts)
                mkAbs('Fed Tax',        '#A30000C0', r => r.FedTax),
                mkAbs('State Tax',      '#FF2E2EC0', r => r.StateTax),
                mkAbs('IRMAA',          '#FFB8B8C0', r => r.IRMAA),
                mkAbs('Roth Conv',      '#8e44ad80', r => r.rothConv),
                // Spendable Income line sits exactly at the income/tax seam.
                // order:1 (lower than bars' order:2) ensures Chart.js draws this line
                // AFTER the bars so it appears on top. Higher order = drawn first = behind.
                {
                    label: 'Net Income',
                    data: log.map(r => (visibleSum(r) - r.totalTax) * adj(r)),
                    type: 'line', borderColor: '#27ae60', borderWidth: 2.5,
                    backgroundColor: '#27ae60', pointBackgroundColor: '#27ae60',
                    fill: false, order: 1
                }
            ]
        },
        options: {
            ...sharedTooltip,
            scales: {
                x: { stacked: true },
                y: { stacked: true, ticks: { callback: v => Math.round(v).toLocaleString() } }
            },
            plugins: {
                ...sharedTooltip.plugins,
                tooltip: {
                    ...sharedTooltip.plugins.tooltip,
                    callbacks: {
                        ...sharedTooltip.plugins.tooltip.callbacks,
                        title: items => {
                            const r = log[items[0]?.dataIndex];
                            if (!r) return items[0]?.label ?? '';
                            const a1 = (r.age1 == null || r.age1 === '—') ? '--' : r.age1;
                            const a2 = (r.age2 == null || r.age2 === '—') ? '--' : r.age2;
                            const taxPct = r.totalIncome > 0
                                ? (r.totalTax / r.totalIncome * 100).toFixed(1) + '%'
                                : '--';
                            const a = adj(r);
                            const totalFmt = Math.round(r.totalIncome * a).toLocaleString();
                            const cwd = (r.CashWD ?? 0) * a;
                            const br = basisReturn(r) * a;
                            const parts = [];
                            if (cwd > 0.5) parts.push(`Cash ${Math.round(cwd).toLocaleString()}`);
                            if (br  > 0.5) parts.push(`Brokerage ${Math.round(br).toLocaleString()}`);
                            const untaxedStr = parts.length > 0 ? `  |  Untaxed: ${parts.join(' + ')}` : '';
                            return [
                                `${r.year}  |  You: ${a1}  Spouse: ${a2}  |  Tax: ${taxPct}`,
                                `Total Income: ${totalFmt}${untaxedStr}`
                            ];
                        }
                    },
                    filter: item => item.dataset.label !== '│' && Math.abs(Math.round(item.parsed.y)) > 0
                },
                legend: {
                    onClick: (e, item, legend) => {
                        if (item.text === '│') return;
                        Chart.defaults.plugins.legend.onClick(e, item, legend);
                    },
                    labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 10, boxHeight: 10, padding: 16 }
                }
            }
        }
    });
}

function val(id) { const el = document.getElementById(id); if (!el) return undefined; return el.dataset.numVal !== undefined ? el.dataset.numVal : el.value; }
function valChecked(id) { return document.getElementById(id)?.checked; }


function showTab(id) {
    // 1. Hide all tab content cards
    document.querySelectorAll('.tab-content, .card').forEach(c => {
        if (c.id.startsWith('tab-')) c.classList.add('hidden');
    });
    // 2. Show the selected card
    document.getElementById(id).classList.remove('hidden');

    // 3. Update the active button styling (Fixed Selector)
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.tab-btn[onclick*="${id}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}


function setupAutoRecalc() {
    const LABELS = {
        spendGoal: 'Spend Goal', spendChange: 'Spend Δ%', strategy: 'Strategy',
        nYears: 'N Years', stratRate: 'Bracket', propWithdraw: 'Boost%',
        iraBaseGoal: 'IRA Goal', maxConversion: 'Max Conv',
        birthyear1: 'Your Birth', die1: 'Your Life Exp',
        birthyear2: 'Spouse Birth', die2: 'Spouse Life Exp',
        IRA1: 'Your IRA', IRA2: 'Spouse IRA',
        Brokerage: 'Brokerage', BrokerageBasis: 'Brok Basis',
        Roth: 'Roth', Cash: 'Cash',
        ss1: 'My SS', ss1Age: 'SS Age', ss2: 'Spouse SS', ss2Age: 'Spouse SS Age',
        pensionAnnual: 'Pension', survivorPct: 'Survivor%', pensionCola: 'Pension COLA',
        inflation: 'Inflation', cpi: 'CPI/COLA', growth: 'Growth', cashYield: 'Cash Yield',
        dividendRate: 'Dividends', STATEname: 'State Tax', ssFailYear: 'SS Fail Yr', ssFailPct: 'SS Payout%',
        birthmonth1: 'Your Birth Mo', birthmonth2: 'Spouse Birth Mo', dividendReinvest: 'Div Reinvest',
        cyclicEnabled: 'Cyclic',
        cyclicOrder:   'Cyclic Order'
    };
    let timer = null;
    function scheduleRecalc(el) {
        _lastChangedInputLabel = LABELS[el.id] || el.id;
        clearTimeout(timer);
        timer = setTimeout(() => {
            const tab = document.querySelector('.tab-btn.active')?.getAttribute('onclick') || '';
            if (tab.includes('tab-opt')) {
                runOptimizer();
            } else {
                runSimulation();
            }
        }, 400);
    }
    document.querySelectorAll('.sidebar input, .sidebar select').forEach(el => {
        if (el.type === 'checkbox' || el.tagName === 'SELECT') {
            el.addEventListener('change', () => scheduleRecalc(el));
        } else {
            el.addEventListener('blur', () => scheduleRecalc(el));
        }
    });
}


function onCyclicChange() {
    const on = !!valChecked('cyclicEnabled');
    const dripEl = document.getElementById('dividendReinvest');
    if (dripEl) {
        if (on) {
            dripEl.checked = true;
            dripEl.disabled = true;
        } else {
            dripEl.disabled = false;
        }
    }
}

function toggleSpouseUI() {
    const on = !!valChecked('hasSpouse');
    document.querySelectorAll('.spouse-field').forEach(el => el.classList.toggle('spouse-disabled', !on));
    if (typeof refreshStratRateOptions === 'function') refreshStratRateOptions();
}

function toggleStrategyUI() {
    let m = val('strategy');
    document.getElementById('ui-fixed').classList.toggle('hidden', m !== 'fixed');
    document.getElementById('ui-bracket').classList.toggle('hidden', m !== 'bracket' && m !== 'minlimit');
    document.getElementById('ui-propwd').classList.toggle('hidden', m !== 'propwd');
    document.getElementById('ui-fixedpct').classList.toggle('hidden', m !== 'fixedpct');
    document.getElementById('ui-ordered').classList.toggle('hidden', m !== 'ordered');
    // document.getElementById('ui-maximize').classList.toggle('hidden', !(m === 'baseline'));
}


// ============================================================================
// URL SHARE / LOAD
// ============================================================================

const OPT_LONG_TO_SHORT = {
    spendGoal:'sg', spendChange:'sc', strategy:'str', nYears:'ny',
    propWithdraw:'pw', stratRate:'sr', iraWithdrawPct:'iwp', orderedSeq:'os',
    maxConversion:'mc', iraBaseGoal:'ibg',
    birthyear1:'by1', birthmonth1:'bm1', die1:'d1', startAge:'sa',
    birthyear2:'by2', birthmonth2:'bm2', die2:'d2', hasSpouse:'hs',
    IRA1:'i1', IRA2:'i2', Roth:'ro', Roth2:'ro2',
    Brokerage:'bk', BrokerageBasis:'bb', dividendReinvest:'dr', Cash:'ca', CashReserve:'cr',
    ss1:'ss1', ss1Age:'ss1a', ss2:'ss2', ss2Age:'ss2a',
    pensionAnnual:'pa', pensionCola:'pc', survivorPct:'sur', dividendRate:'div',
    STATEname:'s', ssFailYear:'sfy', ssFailPct:'sfp',
    growth:'g', cashYield:'cy', inflation:'inf', cpi:'cpi', futureIRATaxRate:'fitr',
    comp_IRA1_ratio:'c1r', comp_IRA1_intl:'c1x',
    comp_IRA2_ratio:'c2r', comp_IRA2_intl:'c2x',
    comp_Brokerage_ratio:'cbr', comp_Brokerage_intl:'cbx',
    comp_Roth1_ratio:'cr1r', comp_Roth1_intl:'cr1x',
    comp_Roth2_ratio:'cr2r', comp_Roth2_intl:'cr2x',
    'show-current-dollars':'cd', optimizeSpend:'opt'
};

const OPT_SHORT_TO_LONG = Object.fromEntries(
    Object.entries(OPT_LONG_TO_SHORT).map(([l, s]) => [s, l])
);

function buildShareURL() {
    const params = new URLSearchParams();
    document.querySelectorAll('.sidebar input, .sidebar select').forEach(el => {
        if (!el.id) return;
        const short = OPT_LONG_TO_SHORT[el.id] ?? el.id;
        if (el.type === 'checkbox') {
            params.set(short, el.checked ? 'true' : 'false');
        } else {
            params.set(short, el.dataset.numVal !== undefined ? el.dataset.numVal : el.value);
        }
    });
    const base = location.href.split('?')[0].split('#')[0];
    return base + '?' + params.toString();
}

function toggleSharePanel() {
    const panel = document.getElementById('share-panel');
    const input = document.getElementById('share-url-input');
    const isOpen = panel.style.display === 'block';
    if (isOpen) { panel.style.display = 'none'; return; }
    input.value = buildShareURL();
    document.getElementById('share-status').textContent = '';
    panel.style.display = 'block';
    requestAnimationFrame(() => { input.select(); });
}

async function copyShareURL() {
    const input  = document.getElementById('share-url-input');
    const status = document.getElementById('share-status');
    input.select();
    try {
        await navigator.clipboard.writeText(input.value);
        status.textContent = '✓ Copied to clipboard';
        return;
    } catch {}
    try {
        document.execCommand('copy');
        status.textContent = '✓ Copied to clipboard';
    } catch {
        status.textContent = 'Select the URL above and press Ctrl+C / Cmd+C';
    }
}

document.addEventListener('click', e => {
    const panel = document.getElementById('share-panel');
    if (panel && panel.style.display === 'block' &&
        !panel.contains(e.target) &&
        !e.target.closest('[onclick="toggleSharePanel()"]')) {
        panel.style.display = 'none';
    }
});

function loadFromURL() {
    const raw = new URLSearchParams(location.search);
    if (!raw.size) return;
    const params = new URLSearchParams();
    raw.forEach((v, k) => params.set(OPT_SHORT_TO_LONG[k] ?? k, v));
    params.forEach((value, key) => {
        const el = document.getElementById(key);
        if (!el) return;
        if (el.type === 'checkbox') {
            el.checked = value === 'true';
        } else {
            el.value = value;
        }
    });
    toggleStrategyUI();
    runSimulation();
}


/* Save, Import and Export settings/Scenarios
*/
///////////////////////////////////////////////
// ============================================================================


// ============================================================================
// MESSAGE DISPLAY FUNCTIONS
// ============================================================================

/**
 * Displays a colored message in the scenario message area
 * @param {string} message - The text message to display
 * @param {string} type - Message type: 'success' (green), 'error' (red), or 'warning' (yellow)
 *                        Default is 'success'
 * Auto-hides the message after 5 seconds
 */
function showMessage(message, type = 'success') {
    const messageDiv = document.getElementById('popUpMessage');
    messageDiv.textContent = message;
    messageDiv.className = `scenario-message ${type}`;
    messageDiv.style.display = 'block';

    // Auto-hide after 15 seconds
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 15000);
}

/**
 * Manually clears and hides the message display area
 * No parameters
 */
function clearMessage() {
    const messageDiv = document.getElementById('popUpMessage');
    messageDiv.style.display = 'none';
}

// ============================================================================
// STORAGE ACCESS FUNCTIONS
// ============================================================================

/**
 * Retrieves all scenarios from the new storage key
 * No parameters
 * @returns {Object} Object containing scenario data keyed by scenario name
 *                   Returns empty object {} if no scenarios exist
 */
function getSavedScenarios() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
}

/**
 * Retrieves all scenarios from the old storage key (previous version)
 * No parameters
 * @returns {Object} Object containing old scenario data keyed by scenario name
 *                   Returns empty object {} if no old scenarios exist
 */
function getOldScenarios() {
    const oldSaved = localStorage.getItem(OLD_STORAGE_KEY);
    return oldSaved ? JSON.parse(oldSaved) : {};
}

/**
 * Retrieves and merges scenarios from both old and new storage locations
 * Old scenarios are marked with isOldStorage flag and version 1
 * No parameters
 * @returns {Object} Merged object containing all scenarios from both storage keys
 *                   Old scenarios have isOldStorage: true property added
 */
function getAllScenarios() {
    const newScenarios = getSavedScenarios();
    const oldScenarios = getOldScenarios();

    // Merge old scenarios, marking them as version 1
    const allScenarios = { ...newScenarios };

    for (const [name, scenario] of Object.entries(oldScenarios)) {
        // If scenario doesn't have a version property, it's from old version
        if (!scenario.version) {
            allScenarios[name] = {
                version: 1,
                data: scenario.data || scenario, // Handle different old formats
                savedAt: scenario.savedAt || 'Unknown',
                isOldStorage: true // Flag to identify old storage scenarios
            };
        }
    }

    return allScenarios;
}

// ============================================================================
// SCENARIO VALIDATION FUNCTIONS
// ============================================================================

/**
 * Checks if a scenario is compatible with the current version
 * @param {Object} scenario - Scenario object with version property
 * @returns {boolean} True if scenario.version matches SCENARIO_VERSION, false otherwise
 */
function isCompatibleScenario(scenario) {
    return scenario.version === SCENARIO_VERSION;
}

/**
 * Escapes single and double quotes in a string for safe use in HTML attributes
 * @param {string} str - String to escape
 * @returns {string} String with ' replaced by \' and " replaced by \"
 */
function escapeQuotes(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}


// ============================================================================
// MAIN USER ACTION FUNCTIONS
// ============================================================================

/**
 * Saves current form inputs as a named scenario to new storage
 * Uses scenario name from input field #scenarioName, or generates timestamp name if empty
 * Calls getInputs() to retrieve current form values
 * Displays success or error message
 * No parameters
 */
function saveScenario() {
    const inputs = getInputs();
    const scenarioName = document.getElementById('scenarioName').value.trim() ||
        `${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;

    try {
        const scenarios = getSavedScenarios();

        scenarios[scenarioName] = {
            version: SCENARIO_VERSION,
            data: inputs,
            savedAt: new Date().toISOString()
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));

        showMessage(`Scenario "${scenarioName}" saved successfully!`, 'success');
        document.getElementById('scenarioName').value = '';
    } catch (error) {
        showMessage(`Failed to save scenario: ${error.message}`, 'error');
    }
}

/**
 * Prompts user to select and load a compatible scenario
 * Filters out incompatible versions before displaying list
 * Shows error if no compatible scenarios exist
 * No parameters
 */
function loadScenario() {
    try {
        const scenarios = getSavedScenarios();
        const scenarioNames = Object.keys(scenarios);

        if (scenarioNames.length === 0) {
            showMessage('No saved scenarios found.', 'error');
            return;
        }

        const compatibleScenarios = scenarioNames.filter(name =>
            scenarios[name].version === SCENARIO_VERSION
        );

        if (compatibleScenarios.length === 0) {
            showMessage('No compatible scenarios found. All saved scenarios are from an older version.', 'error');
            return;
        }

        let selection = prompt('Enter scenario name to load:\n\n' + compatibleScenarios.join('\n'));

        if (selection && scenarios[selection]) {
            if (scenarios[selection].version !== SCENARIO_VERSION) {
                showMessage('This scenario is from an incompatible version and cannot be loaded.', 'error');
                return;
            }
            applyScenario(scenarios[selection].data);
            showMessage(`Scenario "${selection}" loaded successfully!`, 'success');
        } else if (selection) {
            showMessage('Scenario not found.', 'error');
        }
    } catch (error) {
        showMessage(`Failed to load scenario: ${error.message}`, 'error');
    }
}

/**
 * Applies scenario data to form input fields
 * Handles percentage conversions for specific fields (multiplies by 100 for display)
 * Triggers recalculate() function if it exists
 * @param {Object} data - Scenario data object with keys matching form input IDs
 */
const DOLLAR_INPUT_IDS = new Set([
    'spendGoal', 'iraBaseGoal', 'IRA1', 'IRA2', 'Roth', 'Roth2',
    'Brokerage', 'BrokerageBasis', 'Cash', 'CashReserve', 'ss1', 'ss2', 'pensionAnnual'
]);

function applyScenario(data) {
    // Handle IRMAA / ACA stratRate values that don't map to a plain numeric key
    if ((data.stratIRMAATier ?? -1) >= 0) {
        const el = document.getElementById('stratRate');
        if (el) el.value = `irmaa${data.stratIRMAATier}`;
    } else if ((data.stratACAMultiple ?? 0) > 0) {
        const el = document.getElementById('stratRate');
        if (el) el.value = `aca${data.stratACAMultiple}`;
    }

    for (const [key, value] of Object.entries(data)) {
        // stratIRMAATier has no standalone form element; handled above via stratRate dropdown
        if (key === 'stratIRMAATier') continue;
        if (key === 'stratACAMultiple') continue;
        const element = document.getElementById(key);
        if (element) {
            // Handle percentage values (multiply by 100 for display)
            if (['spendChange', 'inflation', 'cpi', 'growth',
                'cashYield', 'dividendRate', 'ssFailPct',
                'propWithdraw', 'iraWithdrawPct'].includes(key)) {
                element.value = (value * 100).toFixed(3);
            } else if (key === 'stratRate' && ((data.stratIRMAATier ?? -1) >= 0 || (data.stratACAMultiple ?? 0) > 0)) {
                // Already set the dropdown above (IRMAA or ACA); skip numeric override
            } else if (key === 'stratRate') {
                element.value = (value * 100).toFixed(3);
            } else {
                if (['maxConversion'].includes(key)) {
                    document.getElementById('maxConversion').checked = value
                } else if (DOLLAR_INPUT_IDS.has(key)) {
                    DisplayHelpers.setDollarValue(key, value);
                } else {
                    element.value = value;
                }
            }
        }
    }

    // Infer hasSpouse from data (explicit flag, or legacy: birthyear2 > 0)
    const hasSpouseEl = document.getElementById('hasSpouse');
    if (hasSpouseEl) {
        hasSpouseEl.checked = data.hasSpouse !== undefined ? !!data.hasSpouse : (data.birthyear2 > 0);
        if (typeof toggleSpouseUI === 'function') toggleSpouseUI();
    }

    // Sync strategy sub-UI to the newly loaded strategy value
    if (typeof toggleStrategyUI === 'function') toggleStrategyUI();

    // Sync MC mode UI (grays out μ/σ when bootstrap mode is restored from scenario)
    if (typeof updateMCModeUI === 'function') updateMCModeUI();

    // Trigger any recalculations your app needs
    if (typeof runSimulation === 'function') {
        runSimulation();
    }
}

// ============================================================================
// SCENARIO MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Opens modal dialog showing all scenarios from both storage locations
 * Displays table with Name, Saved Date, Version, Storage location, and Actions
 * Shows compatibility status with color coding (green=compatible, red=incompatible)
 * Shows bulk action buttons if incompatible or old scenarios exist
 * No parameters
 */
function manageScenarios() {
    const scenarios = getAllScenarios();
    const modal = document.getElementById('scenarioModal');
    const content = document.getElementById('scenarioListContent');

    if (Object.keys(scenarios).length === 0) {
        content.innerHTML = '<p>No saved scenarios.</p>';
    } else {
        let html = '<table style="width: 100%; border-collapse: collapse;">';
        html += '<tr><th style="text-align: left; padding: 8px; border-bottom: 2px solid #ddd;">Name</th>';
        html += '<th style="text-align: left; padding: 8px; border-bottom: 2px solid #ddd;">Saved</th>';
        html += '<th style="text-align: center; padding: 8px; border-bottom: 2px solid #ddd;">Version</th>';
        html += '<th style="text-align: center; padding: 8px; border-bottom: 2px solid #ddd;">Actions</th></tr>';

        for (const [name, scenario] of Object.entries(scenarios)) {
            const savedDate = scenario.savedAt !== 'Unknown'
                ? new Date(scenario.savedAt).toLocaleString()
                : 'Unknown';
            const version = scenario.version || 1;
            const isCurrent = version === SCENARIO_VERSION;
            const isOldStorage = scenario.isOldStorage || false;

            const versionBadge = isCurrent
                ? `<span style="color: green; font-weight: bold;">v${version} ✓</span>`
                : `<span style="color: red;">v${version} ✗</span>`;

            const storageBadge = isOldStorage
                ? `<span style="color: orange; font-size: 0.9em;">OLD</span>`
                : `<span style="color: blue; font-size: 0.9em;">NEW</span>`;

            const rowStyle = isCurrent ? '' : 'background-color: #ffeeee;';

            html += `<tr style="${rowStyle}">
                <td style="padding: 4px; border-bottom: 1px solid #eee;">${name}</td>
                <td style="padding: 4px; border-bottom: 1px solid #eee;">${savedDate}</td>
                <td style="padding: 4px; border-bottom: 1px solid #eee; text-align: center;">${versionBadge}</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">
					<button class="modal-btn" onclick="loadScenarioByName('${escapeQuotes(name)}')" ${!isCurrent ? 'disabled title="Incompatible version"' : ''}>Load</button>
					<button class="modal-btn" onclick="deleteScenario('${escapeQuotes(name)}')">Delete</button>
					<button class="modal-btn" onclick="exportScenario('${escapeQuotes(name)}')">Export</button>
                </td>
            </tr>`;
        }
        html += '</table>';

        const incompatibleCount = Object.values(scenarios).filter(s => !isCompatibleScenario(s)).length;
        const oldStorageCount = Object.values(scenarios).filter(s => s.isOldStorage).length;

        if (incompatibleCount > 0 || oldStorageCount > 0) {
            html += `<div style="margin-top: 15px; padding: 10px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">`;

            if (incompatibleCount > 0) {
                html += `<strong>⚠️ ${incompatibleCount} incompatible scenario(s) found</strong><br>`;
            }
            if (oldStorageCount > 0) {
                html += `<strong>📦 ${oldStorageCount} scenario(s) in old storage format</strong><br>`;
            }

            html += `<button onclick="deleteIncompatibleScenarios()" style="margin-top: 5px;">Delete All Incompatible Scenarios</button>`;

            html += `</div>`;
        }

        content.innerHTML = html;
    }

    modal.style.display = 'block';
}

/**
 * Loads a specific scenario by name from either storage location
 * Validates version compatibility before loading
 * Closes modal and shows success/error message
 * @param {string} name - Name of the scenario to load
 */
function loadScenarioByName(name) {
    try {
        const scenarios = getAllScenarios();
        if (scenarios[name]) {
            if (!isCompatibleScenario(scenarios[name])) {
                showMessage(`Scenario "${name}" is from an incompatible version (v${scenarios[name].version || 1}) and cannot be loaded. Current version: v${SCENARIO_VERSION}`, 'error');
                return;
            }
            applyScenario(scenarios[name].data);
            closeScenarioModal();
            showMessage(`Scenario "${name}" loaded successfully!`, 'success');
        }
    } catch (error) {
        showMessage(`Failed to load scenario: ${error.message}`, 'error');
    }
}

/**
 * Deletes a specific scenario from appropriate storage location
 * Determines whether scenario is in old or new storage and deletes from correct location
 * Prompts for confirmation before deletion
 * Updates the management view and shows message
 * @param {string} name - Name of the scenario to delete
 */
function deleteScenario(name) {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
        try {
            const allScenarios = getAllScenarios();
            const scenario = allScenarios[name];

            if (scenario.isOldStorage) {
                // Delete from old storage
                const oldScenarios = getOldScenarios();
                delete oldScenarios[name];
                if (Object.keys(oldScenarios).length > 0) {
                    localStorage.setItem(OLD_STORAGE_KEY, JSON.stringify(oldScenarios));
                } else {
                    localStorage.removeItem(OLD_STORAGE_KEY);
                }
            } else {
                // Delete from new storage
                const scenarios = getSavedScenarios();
                delete scenarios[name];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
            }

            manageScenarios();
            showMessage(`Scenario "${name}" deleted successfully.`, 'success');
        } catch (error) {
            showMessage(`Failed to delete scenario: ${error.message}`, 'error');
        }
    }
}

/**
 * Closes the scenario management modal dialog
 * No parameters
 */
function closeScenarioModal() {
    document.getElementById('scenarioModal').style.display = 'none';
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Deletes all scenarios that don't match SCENARIO_VERSION
 * Works across both old and new storage locations
 * Prompts for confirmation showing count and names of scenarios to delete
 * Removes old storage key if all old scenarios are deleted
 * Shows success/error message
 * No parameters
 */
function deleteIncompatibleScenarios() {
    const scenarios = getAllScenarios();
    const incompatibleNames = Object.keys(scenarios).filter(name =>
        !isCompatibleScenario(scenarios[name])
    );

    if (incompatibleNames.length === 0) {
        showMessage('No incompatible scenarios found.', 'warning');
        return;
    }

    if (confirm(`Delete ${incompatibleNames.length} incompatible scenario(s)?\n\n${incompatibleNames.join('\n')}`)) {
        try {
            const newScenarios = getSavedScenarios();
            const oldScenarios = getOldScenarios();

            // Delete from both storage locations
            incompatibleNames.forEach(name => {
                delete newScenarios[name];
                delete oldScenarios[name];
            });

            localStorage.setItem(STORAGE_KEY, JSON.stringify(newScenarios));

            // Only save old scenarios if there are any left
            if (Object.keys(oldScenarios).length > 0) {
                localStorage.setItem(OLD_STORAGE_KEY, JSON.stringify(oldScenarios));
            } else {
                localStorage.removeItem(OLD_STORAGE_KEY);
            }

            manageScenarios();
            showMessage(`${incompatibleNames.length} incompatible scenario(s) deleted.`, 'success');
        } catch (error) {
            showMessage(`Failed to delete scenarios: ${error.message}`, 'error');
        }
    }
}

// ============================================================================
// IMPORT/EXPORT FUNCTIONS
// ============================================================================

/**
 * Exports a single scenario to JSON file
 * Works with scenarios from either storage location
 * Downloads file with scenario name as filename
 * Shows success or error message
 * @param {string} name - Name of the scenario to export
 */
function exportScenario(name) {
    try {
        const scenarios = getAllScenarios();
        const scenario = scenarios[name];

        const dataStr = JSON.stringify(scenario, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${name}.json`;
        link.click();

        URL.revokeObjectURL(url);
        showMessage(`Scenario "${name}" exported successfully.`, 'success');
    } catch (error) {
        showMessage(`Failed to export scenario: ${error.message}`, 'error');
    }
}

/**
 * Opens file picker to import scenario from JSON file
 * Warns about version incompatibility if versions don't match
 * Prompts for scenario name (defaults to filename without extension)
 * Adds imported scenario to new storage location
 * Shows success, warning, or error message
 * No parameters
 */
function importScenario() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const scenario = JSON.parse(event.target.result);

                if (scenario.version && scenario.version !== SCENARIO_VERSION) {
                    if (!confirm(`Warning: This scenario is from version ${scenario.version}, current version is ${SCENARIO_VERSION}.\n\nIt may not load correctly. Continue anyway?`)) {
                        showMessage('Import cancelled.', 'warning');
                        return;
                    }
                }

                const name = prompt('Enter name for imported scenario:', file.name.replace('.json', ''));

                if (name) {
                    const scenarios = getSavedScenarios();
                    scenarios[name] = scenario;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
                    showMessage(`Scenario "${name}" imported successfully!`, 'success');
                } else {
                    showMessage('Import cancelled.', 'warning');
                }
            } catch (error) {
                showMessage(`Error importing scenario: ${error.message}`, 'error');
            }
        };

        reader.onerror = () => {
            showMessage('Failed to read file.', 'error');
        };

        reader.readAsText(file);
    };

    input.click();
}

/**
 * Exports all scenarios from new storage to single JSON file
 * Downloads with date-stamped filename (format: all-scenarios-YYYY-MM-DD.json)
 * Shows warning if no scenarios exist, otherwise shows success or error message
 * No parameters
 */
function exportAllScenarios() {
    try {
        const scenarios = getSavedScenarios();

        if (Object.keys(scenarios).length === 0) {
            showMessage('No scenarios to export.', 'warning');
            return;
        }

        const dataStr = JSON.stringify(scenarios, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `all-scenarios-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        URL.revokeObjectURL(url);
        showMessage(`All scenarios exported successfully.`, 'success');
    } catch (error) {
        showMessage(`Failed to export scenarios: ${error.message}`, 'error');
    }
}


// Scan the TAXData for state tax tables and add them to the choice list.
function generateStateOptions() {
    let html = '\n';

    const stateKeys = Object.keys(TAXData).filter(key => key.length === 2);
    stateKeys.sort();

    stateKeys.forEach(stateCode => {
        const stateData = TAXData[stateCode];

        let rates = stateData.MFJ.brackets.map(b => b.r);
        let lowestRate = (Math.min(...rates) * 100).toFixed(1) + '%';
        let highestRate = (Math.max(...rates) * 100).toFixed(1) + '%';
        let rateList = lowestRate === highestRate ? lowestRate : lowestRate + " to " + highestRate

        const selectedAttr = stateData.Default === true ? ' selected' : '';
        html += `<option value="${stateCode}"${selectedAttr}>${stateData.STATE}: ${rateList}</option>\n`;
    });

    return html;
}

// Base year of the TAXData bracket values. Used to CPI-adjust displayed limits.
const TAX_DATA_BASE_YEAR = 2025;

/**
 * Returns the filing status (MFJ or SGL) to use for the bracket dropdown.
 * MFJ if both spouses survive into the current calendar year, SGL otherwise.
 */
function getDropdownStatus() {
    if (!valChecked('hasSpouse')) return 'SGL';
    const currentYear = new Date().getFullYear();
    const die1Year = (+document.getElementById('birthyear1')?.value || 1960)
                   + (+document.getElementById('die1')?.value || 88);
    const die2Year = (+document.getElementById('birthyear2')?.value || 1952)
                   + (+document.getElementById('die2')?.value || 98);
    return (die1Year > currentYear && die2Year > currentYear) ? 'MFJ' : 'SGL';
}

/**
 * Update bracket constraint feedback display.
 * Shows current bracket limit and warns if desired spend exceeds feasible amount.
 */
function updateBracketFeedback() {
    const stratRateEl = document.getElementById('stratRate');
    const feedbackEl = document.getElementById('bracket-feedback');
    const spendGoalEl = document.getElementById('spendGoal');

    if (!stratRateEl || !feedbackEl || !spendGoalEl) return;

    const selectedOption = stratRateEl.options[stratRateEl.selectedIndex];
    if (!selectedOption) return;

    const spendGoalStr = (spendGoalEl.value || '140000').toString().replace(/[^\d.-]/g, '');
    const spendGoal = parseFloat(spendGoalStr) || 140000;
    const label = selectedOption.text; // e.g., "24% Fed  ·  $414,849"

    // Extract bracket limit from option text
    // Try multiple patterns: "$414,849", "$414849", etc.
    let bracketLimit = null;
    const limitMatches = label.match(/\$[\s]*(\d+(?:,\d{3})*|\d+)/g);
    if (limitMatches && limitMatches.length > 0) {
        // Get the last dollar amount (usually the limit)
        const lastMatch = limitMatches[limitMatches.length - 1];
        bracketLimit = parseInt(lastMatch.replace(/[^\d]/g, ''));
    }

    if (!bracketLimit || isNaN(bracketLimit)) {
        feedbackEl.innerHTML = '';
        return;
    }

    // Estimate max feasible spend (simplified: bracket limit is approx max MAGI)
    // In reality this depends on tax rates and account composition, but this gives a rough indicator
    const estimatedMaxSpend = Math.round(bracketLimit * 0.95); // Slight buffer for estimation error

    if (spendGoal <= estimatedMaxSpend) {
        // Within bracket
        feedbackEl.innerHTML = `✓ Bracket allows ~$${estimatedMaxSpend.toLocaleString()} / year`;
        feedbackEl.style.color = '#4a7c4e';
    } else {
        // Over bracket — clicking adjusts spendGoal down to the bracket max
        const shortfall = Math.round(spendGoal - estimatedMaxSpend);
        feedbackEl.innerHTML = `<span style="cursor:pointer;text-decoration:underline;text-decoration-style:dotted;"
            title="Click to set After-Tax Spend to bracket maximum"
            onclick="DisplayHelpers.setDollarValue('spendGoal',${estimatedMaxSpend});runSimulation();"
            >⚠ Over bracket by ~$${shortfall.toLocaleString()} / year — click to adjust</span>`;
        feedbackEl.style.color = '#d4811f';
    }
}

/**
 * Rebuilds the stratRate dropdown preserving the current selection.
 * Should be called whenever CPI or marital-status inputs change.
 */
function refreshStratRateOptions() {
    const sel = document.getElementById('stratRate');
    if (!sel) return;
    const saved = sel.value;                          // preserve current selection
    sel.innerHTML = generateStratRateOptions();
    // Restore if the option still exists in the new list
    if (saved && [...sel.options].some(o => o.value === saved)) {
        sel.value = saved;
    }
    updateBracketFeedback(); // Update feedback after options change
}

/**
 * Builds the bracket/IRMAA ceiling dropdown options.
 *
 * - All limits are CPI-adjusted from TAX_DATA_BASE_YEAR to the current calendar year
 *   so the displayed dollar amounts match approximately what the tool uses in year 1.
 * - Options are interleaved (federal + IRMAA) and sorted lowest → highest limit.
 * - Only the applicable filing-status limit is shown (MFJ or SGL from inputs).
 */
function generateStratRateOptions() {
    const cpi = (+document.getElementById('cpi')?.value || 2.8) / 100;
    const status = getDropdownStatus();
    const isMFJ = status === 'MFJ';

    // Compound CPI from TAX_DATA_BASE_YEAR to current year
    const currentYear = new Date().getFullYear();
    const yearsFromBase = Math.max(0, currentYear - TAX_DATA_BASE_YEAR);
    const cpiAdj = Math.pow(1 + cpi, yearsFromBase);

    const options = [];

    // ── Federal brackets (skip the top/Infinity bracket) ──────────────────────
    const fedBrks = isMFJ
        ? TAXData.FEDERAL.MFJ.brackets
        : TAXData.FEDERAL.SGL.brackets;
    for (let i = 0; i < fedBrks.length - 1; i++) {
        const ratePct = Math.round(fedBrks[i].r * 100);
        const limit   = Math.round(fedBrks[i].l * cpiAdj);
        options.push({
            value: String(ratePct),
            label: `${ratePct}% Fed  ·  $${limit.toLocaleString()}`,
            limit,
            defaultSelected: false
        });
    }

    // ── IRMAA tier ceilings (tiers 0-4) ───────────────────────────────────────
    // Ceiling = start of NEXT tier - 1. IRMAA thresholds also grow at CPI.
    const irmaaBrks = isMFJ
        ? TAXData.IRMAA.MFJ.brackets
        : TAXData.IRMAA.SGL.brackets;
    const irmaaLabels = [
        'Below IRMAA',
        'IRMAA Tier 1',
        'IRMAA Tier 2',
        'IRMAA Tier 3',
        'IRMAA Tier 4'
    ];
    for (let i = 0; i < 5; i++) {
        const limit = Math.round((irmaaBrks[i + 1].l - 1) * cpiAdj);
        options.push({
            value: `irmaa${i}`,
            label: `${irmaaLabels[i]}  ·  $${limit.toLocaleString()}`,
            limit,
            defaultSelected: i === 0
        });
    }

    // ── ACA FPL cliffs ────────────────────────────────────────────────────────
    // FPL base (2025): 2-person $20,440; 1-person $15,060. CPI-approx for future years.
    const FPL_BASE_YEAR = 2025;
    const fplBase = isMFJ ? 20440 : 15060;
    const fplCpiAdj = Math.pow(1 + cpi, Math.max(0, currentYear - FPL_BASE_YEAR + 1));
    const acaEntries = [
        { pct: 200, label: 'ACA 200% FPL' },
        { pct: 250, label: 'ACA 250% FPL' },
        { pct: 300, label: 'ACA 300% FPL' },
        { pct: 400, label: 'ACA 400% FPL ⚠️' },
    ];
    for (const { pct, label } of acaEntries) {
        const limit = Math.round(fplBase * pct / 100 * fplCpiAdj);
        options.push({ value: `aca${pct}`, label: `${label}  ·  $${limit.toLocaleString()}`, limit });
    }

    // ── Sort all options by income limit, lowest → highest ─────────────────────
    options.sort((a, b) => a.limit - b.limit);

    // ── Build HTML ─────────────────────────────────────────────────────────────
    const statusLabel  = isMFJ ? 'MFJ' : 'Single';
    const cpiLabel     = `${(cpi * 100).toFixed(1)}% CPI`;
    const yearLabel    = yearsFromBase > 0 ? ` · ~${currentYear}` : ` · ${TAX_DATA_BASE_YEAR}`;
    let html = `<optgroup label="${statusLabel} · ${cpiLabel}${yearLabel}">`;
    for (const opt of options) {
        const selected = opt.defaultSelected ? ' selected' : '';
        html += `<option value="${opt.value}"${selected}>${opt.label}</option>\n`;
    }
    html += '</optgroup>';

    return html;
}





// ============================================================================
// INITIALIZATION - Call on page load
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { simulate, getLTCGBracketRoom };
}


