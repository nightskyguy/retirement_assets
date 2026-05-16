// CONFIGURATION CONSTANTS
// ============================================================================

// Version constant - increment this when data structure changes
const SCENARIO_VERSION = 4;

// New storage key for current version scenarios
const STORAGE_KEY = 'SLCRetireOptimizeScenario';

// Old storage key from previous version
const OLD_STORAGE_KEY = 'retirementScenarios';



/** TAX CONSTANTS **/
// Find these in retirement_optimizer_taxdata.js

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
    const age = currentYear - birthYear + 1;
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


let simulationCount = 0;
/** SIMULATION ENGINE **/
function simulate(inputs) {
    let balance = {
        IRA1: inputs.IRA1, IRA2: inputs.IRA2, Roth: inputs.Roth,
        Brokerage: inputs.Brokerage, BrokerageBasis: inputs.BrokerageBasis, Cash: inputs.Cash,
        magiHistory: []
    };
    simulationCount += 1;
    STATEname = inputs.STATEname;
    let log = [];
    //!!!TODO Remove hardcoded start year!
    let currentYear = inputs.startYear ?? 2026;

    let birthyear2 = Math.floor(inputs.birthyear1);
    let birthmonth2 = Math.max(1, Math.min(12, Math.round((inputs.birthyear1 - birthyear2) * 100) || 12));
    let birthyear1 = birthyear2;
    let birthmonth1 = birthmonth2;

    birthyear2 = Math.floor(inputs.birthyear2);
    birthmonth2 = Math.max(1, Math.min(12, Math.round((inputs.birthyear2 - birthyear2) * 100) || 12));

    let maxYears = Math.max(inputs.birthyear1 + inputs.die1, inputs.birthyear1 + inputs.die2) - currentYear + 1;
    let totals = { tax: 0, gross: 0, spend: 0, yearsfunded: 0, success: true, yearstested: 0, failedInYear: [], shortfall: 0, taxCurrentDollars: 0, spendCurrentDollars: 0 };

    let cpiRate = 1		// The rate that SS and Tax brackets increase.
    let inflation = 1	// The rate at which overall inflation increases.
    let medicareRate = 1	// The rate of increase in IRMAA tax and Medicare.
    let fixedWithdrawal = 0;
    let currentTaxableGuess = 0;
    let spendDelta = 1
    let spendGoal = inputs.spendGoal;
    let cumulativeTaxes = 0;
    let nominalTaxRate = 0.20; // Just a guess.
    let marginalTaxRate = 0.33; // Just a guess.
    let capitalGainsRate = 0.15; // A guess.
    let tax = {};



    /**************************************
     * PROCESS:
        Determine tax status 
        Determine SS & pension income.
        Determine targetIncome based on strategy:
            For fixed, use larger of amortization rate or spendGoal
                WithdrawalStrategy = [IRA:100, Cash:0, Brok:0]
            For baseline, use SpendGoal 
                WithdrawalStrategy = [IRA, Brok, Cash, Roth] by balance percent.
            For delay, use SpendGoal
                WithdrawalStrategy = [Brok: 100, IRA: 0, Cash: 0
            For bracket, use larger of bracket limit or spendGoal
                WithdrawalStrategy = [IRA:*, Brok:*, Cash:0]
                	
     *
     *************************************/

    for (let y = 0; y < maxYears; y++) {
        spendGoal = spendGoal * spendDelta * (1 + inputs.inflation);
        fixedWithdrawal = calculateAmortizedWithdrawal(balance.IRA1 + balance.IRA2, inputs.iraBaseGoal, inputs.nYears - y, inputs.growth)


        let withdrawals = { IRA: 0, IRA1: 0, IRA2: 0, Roth: 0, Brokerage: 0, BrokerageBasis: 0, Cash: 0 };
        let netWithdrawals = withdrawals;

        let age1 = currentYear - birthyear1 + 1;
        let age2 = currentYear - birthyear2 + 1;
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

        //!!! TODO: if strategy is "bracket" but spendGoal is > bracket limit
        //		    we likely have a problem unless non-taxable accounts can backfill.

        // 1. Inherit IRA
        if (!alive1 && balance.IRA1 > 0) { balance.IRA2 += balance.IRA1; balance.IRA1 = 0; }
        if (!alive2 && balance.IRA2 > 0) { balance.IRA1 += balance.IRA2; balance.IRA2 = 0; }


        // 2. Base Income
        let ssReduction = (inputs.ssFailYear > 2000 && currentYear >= inputs.ssFailYear) ? inputs.ssFailPct : 1;
        let s1 = (alive1 && age1 >= inputs.ss1Age) ? inputs.ss1 * cpiRate * ssReduction : 0;
        let s2 = (alive2 && age2 >= inputs.ss2Age) ? inputs.ss2 * cpiRate * ssReduction : 0;
        let pension = inputs.pensionAnnual;

        // One is deceased (if both decease, it won't get here)
        if (!alive1 || !alive2) {
            // Survivor Logic: Max of SS + Survivorship % of Pension
            s1 = Math.max(s1, s2);
            s2 = 0;
            if (!alive1) { pension = pension * (inputs.survivorPct / 100) }
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
        // TODO: Allow RMDs to go to QCDs one day!
        balance.IRA1 = Math.max(0, balance.IRA1 - rmd1);
        balance.IRA2 = Math.max(0, balance.IRA2 - rmd2);
        let curIRA = Math.max(0, balance.IRA1 + balance.IRA2 - inputs.iraBaseGoal);



        let totalRMD = rmd1 + rmd2;
        taxableInc += totalRMD
        let possibleIncome = taxableInc + taxableDividends + taxableInterest + fixedInc;

        // 4. Determine Target Spending amount based on Strategy
        let targetSpend = Math.min(spendGoal, goalLimit);
        let additionalSpendNeeded = Math.max(0, targetSpend + irmaa - possibleIncome);

        //!!! Find the income federal limit. TODO: use that limit, to refine down to the next lower IRMAA limit and next lower State Limit.
        let marginalFedTaxRate = goalFedBracketLimit.rate
        let marginalStateTaxRate = goalStateBracketLimit.rate

        //	calculateProgressive('FEDERAL', status, amount, inflation=1, ratecreep=1)

        let nominalFedTaxRateAtLimit = 0.14;
        let nominalStateTaxAtLimit = 0.07
        let withdrawStrategy = { order: [], weight: [], taxrate: [] };

        let curBalances = { IRA: balance.IRA1 + balance.IRA2, Brokerage: balance.Brokerage, BrokerageBasis: balance.BrokerageBasis, Roth: balance.Roth, Cash: balance.Cash, IRA1: balance.IRA1, IRA2: balance.IRA2 };

        let capGainsPercentage = balance.Brokerage !== 0
            ? (balance.Brokerage - balance.BrokerageBasis) / balance.Brokerage
            : 0;


        if (inputs.strategy === 'fixed') {
            // In this strategy, we confine withdrawals to the IRA for the first round. 
            // We don't care about the tax implications.

            let remYears = Math.max(1, inputs.nYears - y);
            let amortized = Math.max(0, fixedWithdrawal - totalRMD);

            // Withdraw the fixed amount left after RMDs, or whatever is left in IRAs after leaving room
            let IRAwd = Math.max(0, Math.min(curIRA, amortized))
            withdrawals = { IRA: IRAwd, netAmount: IRAwd }

        } else if (inputs.strategy === 'bracket' || inputs.strategy === 'minlimit') {
            //!!! This code has flaws.  Withdraws too much.
            let fedLimit = findLimitByRate('FEDERAL', status, inputs.stratRate, cpiRate);
            let limit = fedLimit.limit;
            let fedTaxAtLimit = calculateProgressive('FEDERAL', status, limit, inflation)
            nominalFedTaxRateAtLimit = fedTaxAtLimit.cumulative / limit
            marginalFedTaxRate = fedLimit.rate;

            //!!!TODO Find the state rate and limit that corresponds to the limit (fedLimit.fedLimit)
            //!!!TODO Find the IRMAA limit that corresponds to the fedLimit.fedLimit
            let stLimit = findUpperLimitByAmount(STATEname, status, fedLimit.limit, cpiRate);
            marginalStateTaxRate = stLimit.rate;
            stateLimit = stLimit.limit;
            nominalStateTaxAtLimit = calculateProgressive(STATEname, status, limit, inflation).cumulative / limit

            // pick whatever is smaller (state or Federal limit for the amount desired)
            limit = Math.min(stateLimit, limit)

            if (inputs.strategy === 'minlimit') {
                limit = Math.min(limit, irmaLimit)
            }

            currentTaxableGuess = limit - fixedInc - taxableInc - totalRMD;
            withdrawStrategy.order = ['IRA', 'Brokerage']
            withdrawStrategy.taxrate = [nominalTaxRate, capGainsPercentage * (capitalGainsRate + nominalStateTaxAtLimit)]
            withdrawals = calculateWithdrawals(curBalances, additionalSpendNeeded, withdrawStrategy)

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
        //!!! TODO: May be premature. We may need more $ to meet spend goal.  We may have exhausted the IRAs.

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
            // We need to do more withdrawals. First try Brokerage + Cash.
            withdrawStrategy.order = ['Brokerage', 'Cash'];
            withdrawStrategy.weight = [40, 60];
            withdrawStrategy.taxrate = [capGainsPercentage * (capitalGainsRate + nominalStateTaxAtLimit), 0];
            withdrawals = calculateWithdrawals(curBalances, gap, withdrawStrategy);
            netWithdrawals = accumulateWithdrawals([netWithdrawals, withdrawals]);
            applyWithdrawals(curBalances, withdrawals);

            // If still short, fall back to Roth (tax-free).
            if ((withdrawals.shortfall ?? 0) > 1 && curBalances.Roth > 0) {
                const rothWd = { order: ['Roth'], taxrate: [0], weight: null };
                const rothWithdrawals = calculateWithdrawals(curBalances, withdrawals.shortfall, rothWd);
                netWithdrawals = accumulateWithdrawals([netWithdrawals, rothWithdrawals]);
                applyWithdrawals(curBalances, rothWithdrawals);
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
        // This does NOT change how much was withdrawn — it only redirects where the
        // after-tax excess lands. Taxes were already paid on the full IRA withdrawal.
        // TODO: The tax used here (nominalTaxRate) was computed on the spending income,
        //       not on the incremental surplus being converted. The marginal rate on the
        //       surplus could be slightly higher if it pushes into a higher bracket.
        //       Correcting this would require a third tax-recalculation pass.
        surplus.Roth = 0;
        if (inputs.maxConversion) {
            surplus.Roth = Math.min(surplus.Total, netWithdrawals.IRA);
            surplus.Total -= surplus.Roth;
        }

        // If there is still a surplus, replace any excess Cash withdrawal.
        surplus.Cash = Math.min(surplus.Total, netWithdrawals.Cash);
        netWithdrawals.Cash -= surplus.Cash;
        surplus.Total -= surplus.Cash;

        // Decrement the proposed withdrawals from the balance(s).
        applyWithdrawals(balance, netWithdrawals)

        const totalConverted = surplus.Roth;

        // If there is STILL a surplus, put it in Cash.
        surplus.Cash = surplus.Total;
        balance.Cash += surplus.Cash
        surplus.Total = 0;

        //!!!TODO: Need to tax the growth of Cash and Brokerage!
        let growthRates = {
            IRA: inputs.growth, IRA1: inputs.growth, IRA2: inputs.growth,
            Brokerage: inputs.growth, Cash: inputs.cashYield, Roth: inputs.growth
        }

        // Grow Balances
        // TODO: Allow applying growth before and after withdrawals. 
        //       To simulate how things differ if withdrawals are done early or later in the year.

        let gains = applyGrowth(balance, growthRates)
        inspectForErrors(growthRates, balance, gains)  // See if any numbers look fishy.

        // Accrue dividends to cash
        gains.Cash += taxableDividends
        balance.Cash += taxableDividends;
        balance.magiHistory.push(tax.MAGI);
        totals.tax += totalTax;
        totals.gross += totalIncome;
        totals.spend += (targetSpend + surplus.Shortfall);
        totals.taxCurrentDollars += totalTax / inflation;
        totals.spendCurrentDollars += (targetSpend + surplus.Shortfall) / inflation;
        balance.Roth += totalConverted;  // surplus.Roth === totalConverted; surplus.Total is 0 here
        totals.shortfall += surplus.Shortfall;

        let totalWealth = (balance.IRA1 + balance.IRA2 + Math.max(0, balance.Brokerage - balance.BrokerageBasis)) * (1 - nominalTaxRate) + balance.Roth + balance.Cash + balance.BrokerageBasis

        if (netIncome < targetSpend * 0.99 || totalWealth < (targetSpend * 1.5)) {
            totals.success = false;
            totals.failedInYear.push(currentYear)
        } else {
            totals.yearsfunded += 1
        }

        inspectForErrors({ totalWealth: totalWealth })  // See if any numbers look fishy.

        log.push({
            year: currentYear,
            age1: alive1 ? age1 : '—',
            age2: alive2 ? age2 : '—',
            status: status,
            SSincome: fixedInc,
            pension: pension,
            spendGoal: targetSpend,
            MAGI: tax.MAGI,
            totalIncome: totalIncome,
            netIncome: netIncome,
            surplus: surplus.Total,
            shortfall: surplus.Shortfall,
            'RMD%': rmd1Pct,
            'RMD1-': rmd1,
            'RMD2-': rmd2,
            'RMDwd': totalRMD,
            'IRA1-': netWithdrawals.IRA1,
            'IRA2-': netWithdrawals.IRA2,
            'IRAwd': netWithdrawals.IRA,
            'Brokerage-': netWithdrawals.Brokerage,
            'CapGains': capitalGains,
            'RothWD': netWithdrawals.Roth,
            'CashWD': netWithdrawals.Cash,
            'cashD+I': taxableDividends + taxableInterest,
            'cashDividends': taxableDividends,
            'cashInterest': taxableInterest,
            IRMAA: irmaa,
            FedTax: tax.federalTax,
            StateTax: tax.state,
            totalTax: totalTax,
            'fedLimit': tax.fedLimit,
            'stateLimit': tax.stLimit,
            'FedRate%': tax.fedRate,
            'StateRate%': tax.stRate,
            'NominalRate%': nominalTaxRate,
            'SumTaxes': cumulativeTaxes,
            IRA1: balance.IRA1,
            IRA2: balance.IRA2,
            TotalIRA: balance.IRA1 + balance.IRA2,
            Cash: balance.Cash,
            Roth: balance.Roth,
            Brokerage: balance.Brokerage,
            Basis: balance.BrokerageBasis,
            totalWealth: totalWealth,
            Spendable: totals.spend,
            cashG: gains.Cash,
            brokerageG: gains.Brokerage,
            rothG: gains.Roth,
            rothConv: totalConverted,
            inflationFactor: inflation
        });
        currentYear += 1;

        // Adjust inflation rates for subsequent rounds.
        cpiRate *= (1 + inputs.cpi);
        inflation *= (1 + inputs.inflation);
        spendDelta = 1 + inputs.spendChange;
        medicareRate *= (1 + TAXData.IRMAA.ANNUAL_INCREASE)
    } // end for (let y = 0; y < maxYears; y++)

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

    let prevLimit = 0;
    let cumulative = 0;
    let marginalRate = 0;
    let nominalRate = 0;

    for (let b of brks) {
        let currentLimit = b.l * inflation;

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
    // TODO: If we override these values, we should update the UI 
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
        nYears: +val('nYears'),
        stratRate: +val('stratRate') / 100.0,
        birthyear1: +val('birthyear1'),
        die1: +val('die1'),
        birthyear2: +val('birthyear2'),
        die2: +val('die2'),
        IRA1: +val('IRA1'),
        IRA2: +val('IRA2'),
        Roth: +val('Roth'),
        Brokerage: Brokerage,
        BrokerageBasis: BrokerageBasis,
        Cash: +val('Cash'),
        ss1: +val('ss1'),
        ss1Age: +val('ss1Age'),
        ss2: +val('ss2'),
        ss2Age: +val('ss2Age'),
        pensionAnnual: +val('pensionAnnual'),
        survivorPct: +val('survivorPct'),
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
        startInYear: +val('startInYear')
    };
}

/*
 *
 *
 */
function runSimulation() {
    let res = simulate(getInputs());
    lastSimulationLog = res.log;
    lastTotals = res.totals;
    lastFinalNW = res.finalNW;
    const lastEntry = res.log[res.log.length - 1];
    lastFinalNWCurrentDollars = lastEntry.totalWealth / (lastEntry.inflationFactor || 1);
    updateTable(res.log);
    updateStats(res.totals, res.finalNW, lastFinalNWCurrentDollars);
    updateCharts(res.log);
}

function updateCurrentDollarsView() {
    if (lastSimulationLog) {
        updateTable(lastSimulationLog);
        updateCharts(lastSimulationLog);
        updateStats(lastTotals, lastFinalNW, lastFinalNWCurrentDollars);
    }
    if (window.optimizerResults) renderOptimizerTable(window.optimizerResults);
}
// //////////////////////////////////////////////////////////////////

function runOptimizer() {
    const base = getInputs();
    const results = [];

    // Get all bracket rates from TAXData (skip the last Infinity bracket)
    const bracketRates = TAXData.FEDERAL.MFJ.brackets
        .slice(0, -1)
        .map(b => b.r);

    function addResult(strategyLabel, paramLabel, paramSortVal, overrides) {
        const inputs = Object.assign({}, base, overrides);
        const res = simulate(inputs);
        const lastEntry = res.log[res.log.length - 1];
        results.push({
            _id: results.length,
            _strategyLabel: strategyLabel,
            _paramLabel: paramLabel,
            _paramSortVal: paramSortVal,
            _maxConversion: overrides.maxConversion,
            _strategy: overrides.strategy,
            _nYears: overrides.nYears ?? null,
            _stratRate: overrides.stratRate ?? null,
            _propWithdraw: overrides.propWithdraw ?? null,
            totals: res.totals,
            finalNW: res.finalNW,
            finalNWCurrentDollars: lastEntry.totalWealth / (lastEntry.inflationFactor || 1)
        });
    }

    for (const maxConv of [false, true]) {
        // Proportional +% — 0% is the pure baseline; 5/10/20/50% add IRA-only boost
        for (const pct of [0, 5, 10, 20, 50]) {
            addResult('Proportional', `${pct}%`, pct, { strategy: 'propwd', propWithdraw: pct / 100, maxConversion: maxConv });
        }

        // Fixed N years
        for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 25]) {
            addResult('Fixed', `${n} yrs`, n, { strategy: 'fixed', nYears: n, maxConversion: maxConv });
        }

        // Fill bracket — one row per bracket level
        for (const rate of bracketRates) {
            const pct = Math.round(rate * 100);
            addResult('Fill Bracket', `${pct}%`, rate, { strategy: 'bracket', stratRate: rate, maxConversion: maxConv });
        }
    }

    // Update top-bar stats using the 0% propwd/no-maxConv row (first result, equivalent to baseline)
    const baseline = results[0];
    if (baseline) {
        updateStats(baseline.totals, baseline.finalNW, baseline.finalNWCurrentDollars);
    }

    window.optimizerResults = results;
    window.optimizerSortState = { colKey: 'spend', direction: 'desc' };
    renderOptimizerTable(results);
    showTab('tab-opt');
}

// Column definitions (shared between render and sort)
function getOptimizerColumns() {
    const inC = () => document.getElementById('show-current-dollars')?.checked;
    return [
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
            key: 'maxConv', label: 'Max Conv',
            getValue: r => r._maxConversion ? '✓' : '',
            getSortValue: r => r._maxConversion ? 1 : 0
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
        }
    ];
}

function renderOptimizerTable(results) {
    if (!results || results.length === 0) return;
    const columns = getOptimizerColumns();
    const sortState = window.optimizerSortState ?? { colKey: null, direction: 'asc' };

    // Sort a copy; preserve original _id for click handlers
    let display = results.slice();
    if (sortState.colKey) {
        const col = columns.find(c => c.key === sortState.colKey);
        if (col) {
            display.sort((a, b) => {
                const av = col.getSortValue(a), bv = col.getSortValue(b);
                const cmp = (typeof av === 'string') ? av.localeCompare(bv) : (av - bv);
                return sortState.direction === 'asc' ? cmp : -cmp;
            });
        }
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
        [w1, w2, w3, w4].forEach(w => bestIds.add(w._id));
        colWinners.tax   = w1._id;
        colWinners.rate  = w2._id;
        colWinners.spend = w3._id;
        colWinners.nw    = w4._id;
    }

    // Header with sort arrows
    const headerHtml = '<tr>' + columns.map(col => {
        const active = sortState.colKey === col.key;
        const arrow = active ? (sortState.direction === 'asc' ? ' ▲' : ' ▼') : '';
        return `<th style="cursor:pointer;user-select:none;" onclick="sortOptimizerBy('${col.key}')">${col.label}${arrow}</th>`;
    }).join('') + '</tr>';

    // Rows — per-cell green for metric winners, full-row green if winner in any metric
    const rowsHtml = display.map(r => {
        const isWinner = bestIds.has(r._id);
        const rowStyle = isWinner ? 'background-color:#90EE90;font-weight:bold;cursor:pointer;' : 'cursor:pointer;';
        const cells = columns.map(col => {
            // Highlight the specific winning cell with a slightly deeper green
            const cellWin = (col.key === 'tax' && r._id === colWinners.tax)
                         || (col.key === 'rate' && r._id === colWinners.rate)
                         || (col.key === 'spend' && r._id === colWinners.spend)
                         || (col.key === 'nw'   && r._id === colWinners.nw);
            const cellStyle = cellWin ? ' style="background-color:#4CAF5080;"' : '';
            return `<td${cellStyle}>${col.getValue(r)}</td>`;
        }).join('');
        return `<tr style="${rowStyle}" onclick="loadOptimizerResult(${r._id})" title="Click to load this strategy">${cells}</tr>`;
    }).join('');

    document.querySelector('#opt-table thead').innerHTML = headerHtml;
    document.querySelector('#opt-table tbody').innerHTML = rowsHtml;
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
    } else if (result._strategy === 'bracket' && result._stratRate != null) {
        document.getElementById('stratRate').value = Math.round(result._stratRate * 100);
    } else if (result._strategy === 'propwd' && result._propWithdraw != null) {
        document.getElementById('propWithdraw').value = Math.round(result._propWithdraw * 100);
    }

    document.getElementById('maxConversion').checked = result._maxConversion;
    toggleStrategyUI();
    runSimulation();
    showTab('tab-tbl');
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
    'netIncome': ['Summary', 'Income', 'Taxation'],
    'totalWealth': ['Summary', 'Balances'],
    'totalTax': ['Summary', 'Taxation', 'Income'],
    'NominalRate%': ['Summary', 'Taxation'],
    'surplus': ['Summary', 'Income'],
    'shortfall': ['Summary', 'Income'],

    // Income Sources (could be its own category if you want)
    'SSincome': ['Summary', 'Income'],
    'pension': ['Summary', 'Income'],
    'totalIncome': ['Summary', 'Taxation', 'Income'],
    'cashD+I': ['Cash Δ', 'Taxation', 'Income'],

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
    'FedTax': ['Taxation'],
    'StateTax': ['Taxation'],
    'CapGains': ['Taxation', 'Brokerage Δ', 'Income'],
    'SumTaxes': ['Taxation'],
    'FedRate%': ['Taxation'],
    'StateRate%': ['Taxation'],
    'fedLimit': ['Taxation'],
    'stateLimit': ['Taxation'],

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
    'RothWD': ['Roth Δ', 'Income'],
    'rothG': ['Roth Δ'],

    // Brokerage Changes - balance, withdrawals, gains, growth
    'Brokerage-': ['Brokerage Δ', 'Income'],
    'brokerageG': ['Brokerage Δ'],

    // Cash Changes - balance, withdrawals, growth
    'CashWD': ['Cash Δ', 'Income'],
    'cashG': ['Cash Δ']
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

    const headerRow = table.querySelector('thead tr');
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

    // Create header
    const thead = table.createTHead();
    const headerRow = thead.insertRow();

    const tooltips = {
        'year': 'When yellow, it indicates a single survivor. If the rest of the row is pink, it means the year was underfunded.',
        'RMDwd': 'Total of all Required Minimum Distributions (RMDs)',
        'RMD%': 'The highest percentage RMD required for IRA1 or IRA2.',
        'Brokerage': 'Year end Brokerage balance',
        'Brokerage-': 'Withdrawals from Brokerage account (asset sales/cash withdrawal)',
        'Basis': 'The amount in brokerage which can be withdrawn tax free.',
        'IRA1-': 'Withdrawals from IRA1',
        'IRA2-': 'Withdrawals from IRA2',
        'CapGains': 'Amount of gains from withdrawing brokerage assets.',
        'IRMAA': 'First two years are presumed the same as the 3rd year on.',
        'spendGoal': 'This amount increases by inflation less Spend Delta%.',
        'Roth': 'Balance at Year End',
        'RothG': 'Growth in the Roth (added to Roth account)',
        'RothConv': 'Amount moved from IRA to Roth (converted)',
        'CashWD': 'Tax free withdrawals from Cash',
        'cashD+I': 'Dividends (from brokerage) and interest from Cash (deposits)',
        'MAGI': 'Modified Adjusted Gross Income - determines future IRMAA',
        'totalTax': 'Federal,IRMAA,NIIT,CapGains & IRMAA - in total.',
        'SumTaxes': 'Running total of Federal,IRMAA,NIIT,CapGains & IRMAA.',
        'shortfall': 'How much income is missing, that is: spendGoal - (totalIncome - totalTax). Likely due to errors in the calculation or unexpected bracket changes - or running out of assets.',
        'totalIncome': 'Funds from all sources, taxable and tax-free.',
        'NominalRate%': 'TotalTax/TotalGrossIncome for all taxes - Fed, State, IRMAA'
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
    log.forEach(row => {
        const tr = tbody.insertRow();

        // Check conditions for highlighting
        const spendGoal = row['SpendGoal'] ?? row['spendGoal'];
        const netIncome = row['NetIncome'] ?? row['netIncome'];
        const totalWealth = row['TotalWealth'] ?? row['totalWealth'];
        const age1 = row['Age1'] ?? row['age1'];
        const age2 = row['Age2'] ?? row['age2'];

        // Allow up to 1% shortfall before flagging as underfunded.
        const incomeShortfall = (netIncome < spendGoal * 0.99) || (totalWealth < spendGoal * 1.5);
        const deathOccurred = maritalStatus != row['status'];

        // Pink takes priority over yellow
        if (incomeShortfall) {
            tr.style.backgroundColor = '#ffb6c180';  // Light pink
        }

        // Apply cell-level yellow highlighting for death occurred
        const deathHighlightCols = ['year', 'age1', 'age2', 'status', 'SSincome'];

        keys.forEach(key => {
            if (!key.startsWith('-') && key !== 'inflationFactor') {
                const td = tr.insertCell();
                const value = row[key];

                if (deathOccurred && deathHighlightCols.includes(key.toLowerCase())) {
                    td.style.backgroundColor = '#ffff99';  // Light yellow
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
                    td.textContent = value ?? '';
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

    if (oldTable) {
        oldTable.replaceWith(table);
    }

    return table;
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
    const inCurrentDollars = document.getElementById('show-current-dollars')?.checked;
    const dispTax   = inCurrentDollars ? totals.taxCurrentDollars   : totals.tax;
    const dispSpend = inCurrentDollars ? totals.spendCurrentDollars : totals.spend;
    const dispNW    = inCurrentDollars ? finalNWCurrentDollars      : finalNW;
    document.getElementById('stat-rate').innerText = (totals.tax / totals.gross * 100).toFixed(1) + '%';
    document.getElementById('stat-spend').innerText = '$' + Math.round(dispSpend).toLocaleString();
    document.getElementById('stat-tax').innerText = '$' + Math.round(dispTax).toLocaleString();
    document.getElementById('stat-nw').innerText = '$' + Math.round(dispNW).toLocaleString();
    document.getElementById('stat-years').innerText = totals.yearsfunded + '/' + totals.yearstested;
    // document.getElementById('stat-yearsfunded').innerText = totals.yearsfunded;
    let indicator = '🛑 FAILED ';
    if (totals.yearsfunded >= totals.yearstested && finalNW > minNetWorth) {
        indicator = '🟢 SUCCESS ';
    }
    document.getElementById('stat-success').innerText = indicator;

}

let lastSimulationLog = null;
let lastTotals = null, lastFinalNW = null, lastFinalNWCurrentDollars = null;
let assetChart, taxChart, incomeChart;

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
    const tCanvas = document.getElementById('chartTaxSpend');
    if (!aCanvas || !tCanvas) return;
    aCanvas.addEventListener('mousemove', e => { if (assetChart && taxChart) syncChart(assetChart, taxChart, e); });
    aCanvas.addEventListener('mouseleave', () => { if (taxChart) clearChartHighlight(taxChart); });
    tCanvas.addEventListener('mousemove', e => { if (taxChart && assetChart) syncChart(taxChart, assetChart, e); });
    tCanvas.addEventListener('mouseleave', () => { if (assetChart) clearChartHighlight(assetChart); });
}
function updateCharts(log) {
    const inCurrentDollars = document.getElementById('show-current-dollars')?.checked;
    const adj = r => inCurrentDollars ? 1 / (r.inflationFactor || 1) : 1;
    const inclRoth = document.getElementById('include-roth-spendable')?.checked;

    const sharedTooltip = {
        interaction: { mode: 'index', intersect: false },
        plugins: {
            tooltip: {
                itemSort: (a, b) => b.parsed.y - a.parsed.y,
                callbacks: {
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
    assetChart = new Chart(ctxA, {
        type: 'line',
        data: {
            labels: log.map(r => r.year),
            datasets: [
                mkLine('IRAs',        '#e67e22', r => r.TotalIRA    * adj(r)),
                mkLine('Roth',        '#8e44ad', r => r.Roth        * adj(r)),
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

    const ctxT = document.getElementById('chartTaxSpend').getContext('2d');
    (Chart.getChart(ctxT.canvas) ?? taxChart)?.destroy();
    taxChart = new Chart(ctxT, {
        data: {
            labels: log.map(r => r.year),
            datasets: [
                {
                    label: 'Fed Tax',
                    data: log.map(r => r.FedTax * adj(r)),
                    type: 'bar', backgroundColor: '#e74c3c80', stack: 'taxes', order: 2
                },
                {
                    label: 'State Tax',
                    data: log.map(r => r.StateTax * adj(r)),
                    type: 'bar', backgroundColor: '#4BC0C0B3', stack: 'taxes', order: 2
                },
                {
                    label: 'IRMAA',
                    data: log.map(r => r.IRMAA * adj(r)),
                    type: 'bar', backgroundColor: '#000000D0', stack: 'taxes', order: 2
                },
                {
                    label: 'Roth Conv',
                    data: log.map(r => r.rothConv * adj(r)),
                    type: 'bar', backgroundColor: '#8e44ad80', stack: 'taxes', order: 2
                },
                {
                    label: 'Spendable Income',
                    data: log.map(r => (r.netIncome + (inclRoth ? r.rothConv : 0)) * adj(r)),
                    type: 'line', borderColor: '#27ae60', fill: false,
                    borderWidth: 3, order: 1
                }
            ]
        },
        options: {
            ...sharedTooltip,
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    ticks: { callback: v => Math.round(v).toLocaleString() }
                }
            },
            plugins: {
                ...sharedTooltip.plugins,
                legend: {
                    labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 10, boxHeight: 10, padding: 16 }
                }
            }
        }
    });

    // Income Sources chart — Option C+
    // Income source bars are scaled so they collectively sum to netIncome (spendable).
    // Tax bars (Fed, State, IRMAA) stack on top, reaching totalIncome.
    // Bar height = totalIncome; Spendable Income line sits at the income/tax seam.
    const ctxI = document.getElementById('chartIncomeSources').getContext('2d');
    (Chart.getChart(ctxI.canvas) ?? incomeChart)?.destroy();

    // Scale each source so visible bars collectively sum to netIncome.
    // Using visibleSum as denominator absorbs unlisted components (e.g. brokerage basis return).
    const visibleSum = r => r.SSincome + r.pension + r.RMDwd + r.IRAwd + r.RothWD + r.CapGains + r.cashDividends + r.cashInterest;
    const mkInc = (label, color, rawFn) => ({
        label, type: 'bar', backgroundColor: color, stack: 'income', order: 2,
        data: log.map(r => {
            const vsum = visibleSum(r);
            const scale = vsum > 0 ? r.netIncome / vsum : 1;
            return rawFn(r) * scale * adj(r);
        })
    });
    const mkTax = (label, color, rawFn) => ({
        label, type: 'bar', backgroundColor: color, stack: 'income', order: 2,
        data: log.map(r => rawFn(r) * adj(r))
    });

    incomeChart = new Chart(ctxI, {
        data: {
            labels: log.map(r => r.year),
            datasets: [
                // Income sources — each scaled proportionally so they sum to netIncome
                mkInc('Social Security',  '#3498dbB0', r => r.SSincome),
                mkInc('Pension',          '#9b59b6B0', r => r.pension),
                mkInc('IRA RMD',          '#e67e22B0', r => r.RMDwd),
                mkInc('IRA Withdrawal',   '#d35400B0', r => r.IRAwd),
                mkInc('Roth Withdrawal',  '#95a5a6B0', r => r.RothWD),
                mkInc('Cap Gains',        '#1abc9cB0', r => r.CapGains),
                mkInc('Dividends',        '#f39c12B0', r => r.cashDividends),
                mkInc('Interest',         '#f1c40fB0', r => r.cashInterest),
                // Tax causes stack on top (unscaled absolute amounts)
                mkTax('Fed Tax',   '#e74c3cC0', r => r.FedTax),
                mkTax('State Tax', '#c0392bC0', r => r.StateTax),
                mkTax('IRMAA',     '#922b21C0', r => r.IRMAA),
                // Spendable Income line sits exactly at the income/tax seam
                {
                    label: 'Spendable Income',
                    data: log.map(r => r.netIncome * adj(r)),
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
                legend: { labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 10, boxHeight: 10, padding: 16 } }
            }
        }
    });
}

function val(id) { return document.getElementById(id)?.value; }
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


function toggleStrategyUI() {
    let m = val('strategy');
    document.getElementById('ui-fixed').classList.toggle('hidden', m !== 'fixed');
    document.getElementById('ui-bracket').classList.toggle('hidden', m !== 'bracket' && m !== 'minlimit');
    document.getElementById('ui-propwd').classList.toggle('hidden', m !== 'propwd');
    // document.getElementById('ui-maximize').classList.toggle('hidden', !(m === 'baseline'));
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
function applyScenario(data) {
    for (const [key, value] of Object.entries(data)) {
        const element = document.getElementById(key);
        if (element) {
            // Handle percentage values (multiply by 100 for display)
            if (['stratRate', 'spendChange', 'inflation', 'cpi', 'growth',
                'cashYield', 'dividendRate', 'ssFailPct'].includes(key)) {
                element.value = (value * 100).toFixed(3);
            } else {
                if (['maxConversion'].includes(key)) {
                    document.getElementById('maxConversion').checked = value
                } else {
                    element.value = value;
                }
            }
        }
    }

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

// 
function generateStratRateOptions() {
    const federal = TAXData.FEDERAL;
    const mfjBrackets = federal.MFJ.brackets;
    const sglBrackets = federal.SGL.brackets;

    let html = '';

    // Skip the last bracket (Infinity)
    //!!! TODO: This logic assumes sgl and mfj brackets have the same number of elements, and the same rates. Probably safe, but not good practice.
    for (let i = 0; i < mfjBrackets.length - 1; i++) {
        const rate = Math.round(mfjBrackets[i].r * 100);
        const mfjLimit = Math.trunc(mfjBrackets[i].l).toLocaleString();

        // const mfjLimit = Math.floor(mfjBrackets[i].l / 1000);
        const sglLimit = Math.trunc(sglBrackets[i].l).toLocaleString();
        // const sglLimit = Math.floor(sglBrackets[i].l / 1000);

        // Mark 24% as selected (or choose a different default)
        const selected = (rate === 24) ? ' selected' : '';

        html += `<option value="${rate}"${selected}>${rate}%&nbsp;&nbsp; ${mfjLimit}/${sglLimit}</option>\n`;
    }

    return html;
}





// ============================================================================
// INITIALIZATION - Call on page load
// ============================================================================

// TODO: move this listener into retirement_optimizer.html (elements don't exist in other consumers)
// window.addEventListener('DOMContentLoaded', function () {
//     document.getElementById('stratRate').innerHTML = generateStratRateOptions();
//     document.getElementById('STATEname').innerHTML = generateStateOptions();
// });


