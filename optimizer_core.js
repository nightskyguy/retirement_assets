// ============================================================================
// optimizer_core.js - pure simulation engine for the Retirement Optimizer.
//
// Contract: NO DOM, localStorage, or location access, at load time or runtime.
// Loaded three ways, all as a plain classic script sharing global scope:
//   1. retirement_optimizer.html (before optimizer_ui.js, after taxengine.js)
//   2. montecarlo/worker.js via importScripts (no DOM available there)
//   3. optimizer_core.test.js via vm.runInContext (no DOM stubs needed)
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
        const tierTarget = getIRMAATierTargetMAGI(provisionalMAGI, status, cpiRate, 2);
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
    // Room spans ALL brackets whose rate is strictly below maxRate, combined into one continuous
    // span from $0 up to the last such bracket's ceiling (not just the single bracket ordinaryIncome
    // currently sits in) — e.g. maxRate=0.20 combines the 0% AND 15% brackets into one span.
    let ceiling = 0;
    for (const { l, r } of brackets) {
        if (r >= maxRate) break;
        ceiling = l * cpiRate;
    }
    return Math.max(0, ceiling - ordinaryIncome);
}

// Returns the LTCG rate (0, 0.15, or 0.20) of the bracket that (ordinaryIncome + totalGains)
// falls into — used by Cycle Brokerage to know which bracket a spend-forced harvest lands in.
function getLTCGBracketTopRate(ordinaryIncome, totalGains, status, cpiRate) {
    const brackets = TAXData.FEDERAL.CAPITAL_GAINS[status]?.brackets ?? [];
    const totalIncome = ordinaryIncome + totalGains;
    for (const { l, r } of brackets) {
        if (!isFinite(l) || totalIncome <= l * cpiRate) return r;
    }
    return brackets.length ? brackets[brackets.length - 1].r : 0;
}

// MAGI ceiling for bracket/minlimit/aca strategies — shared by the normal per-year withdrawal
// sizing branch and Cycle Brokerage's LTCG top-off logic (Item 4), so a brokerage harvest year
// still respects whatever IRMAA-tier/ACA-cliff/bracket ceiling the active strategy targets.
function computeBracketCeiling(inputs, status, cpiRate, inflation, STATEname, age1, age2, alive1, alive2, IRMAALimit) {
    let limit, marginalFedTaxRate, marginalStateTaxRate, nominalFedTaxRateAtLimit, nominalStateTaxAtLimit, stateLimit;

    if ((inputs.stratIRMAATier ?? -1) >= 0) {
        // IRMAA tier ceiling mode: fill MAGI up to the top of the chosen IRMAA tier.
        const IRMAABrks = getRateBracket('IRMAA', status);
        limit = IRMAABrks[inputs.stratIRMAATier + 1].l * cpiRate - 1;
        const maxAliveAge = Math.max(alive1 ? age1 : -1, alive2 ? age2 : -1);
        const IRMAARelevant = maxAliveAge >= 65 + TAXData.IRMAA.LOOKBACK;
        if (!IRMAARelevant) {
            limit = findUpperLimitByAmount('FEDERAL', status, limit, cpiRate).limit;
        }
        const fedAtLimit = findUpperLimitByAmount('FEDERAL', status, limit, cpiRate);
        marginalFedTaxRate = fedAtLimit.rate;
        nominalFedTaxRateAtLimit = calculateProgressive('FEDERAL', status, limit, inflation).cumulative / (limit || 1);
        const stAtLimit = findUpperLimitByAmount(STATEname, status, limit, cpiRate);
        marginalStateTaxRate = stAtLimit.rate;
        nominalStateTaxAtLimit = calculateProgressive(STATEname, status, limit, inflation).cumulative / (limit || 1);
    } else if ((inputs.stratACAMultiple ?? 0) > 0) {
        // ACA FPL cliff mode: fill MAGI up to a multiple of the Federal Poverty Level.
        const FPL_2025 = status === 'MFJ' ? 20440 : 15060;
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
            const maxAliveAge = Math.max(alive1 ? age1 : -1, alive2 ? age2 : -1);
            if (maxAliveAge >= 65 + TAXData.IRMAA.LOOKBACK) {
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
        'IRAwd': p.netWithdrawals.IRA,
        'IRA1-': p.netWithdrawals.IRA1,
        'IRA2-': p.netWithdrawals.IRA2,
        'RMD1-': p.rmd1,
        'RMD2-': p.rmd2,
        'Brokerage-': p.netWithdrawals.Brokerage,
        'RothWD': (p.netWithdrawals.Roth1 ?? 0) + (p.netWithdrawals.Roth2 ?? 0),
        'CashWD': p.netWithdrawals.Cash,
        'rothConv': p.totalConverted,
        'surplusCash': p.surplus.Cash,
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
        MAGI: p.tax.MAGI,
        'NominalRate%': p.nominalTaxRate,
        'FedCap': p.tax.fedLimit,
        'StateCap': p.tax.stLimit,
        'SumTaxes': p.cumulativeTaxes,
        'BracketTarget': p.bracketTarget,
        'BracketOverage': p.bracketOverage,
        'ForcedIRA': p.forcedIRA,
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
        // Internal
        inflationFactor: p.inflation,
        loopMs: p.loopMs
    };
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
    let currentTaxableGuess = 0;
    let spendDelta = 1 + inputs.spendChange;
    let spendGoal = inputs.spendGoal * Math.pow(1 + inputs.inflation, gapYears);
    let cumulativeTaxes = 0;
    let nominalTaxRate = 0.20; // Just a guess.
    let marginalTaxRate = 0.33; // Just a guess.
    let capitalGainsRate = 0.15; // A guess.
    let tax = {};

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

    // Phase 22: Guyton-Klinger state
    let gkIWR = null;
    let gkPriorReturn = 0;
    let gkAdjLabel = '';
    // GK uses raw portfolio (not tax-discounted totalWealth) so IWR and WR checks are apples-to-apples.
    let gkPrevPortfolio = prevTotalWealth;

    // Sim-level state shared across years (and with the phase functions being split out of
    // this loop). Fields listed after `totals` are reassigned as the simulation advances, so
    // they must live here rather than as locals; inputs/balance/log/totals are never
    // reassigned (only mutated) and stay usable as bare locals inside simulate() itself.
    const sim = {
        inputs, balance, log, totals,
        birthyear1, birthmonth1, birthyear2, birthmonth2,
        currentYear, cpiRate, inflation, medicareRate,
        fixedWithdrawal, spendGoal, cumulativeTaxes,
        nominalTaxRate, capitalGainsRate,
        subCycleIRAYears, prevTotalWealth,
        gkIWR, gkPriorReturn, gkAdjLabel, gkPrevPortfolio,
    };

    for (let y = 0; y < maxYears; y++) {
        const loopStart = performance.now();
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
        const iraGoalNominal = inputs.iraBaseGoal * sim.cpiRate;
        sim.fixedWithdrawal = calculateAmortizedWithdrawal(balance.IRA1 + balance.IRA2, iraGoalNominal, amortYears, inputs.growth)

        // Phase 12: growthRates moved here (from below withdrawal block) to enable pre-withdrawal growth.
        // Monte Carlo uses per-year return from injected sequence if provided; else constant rate.
        // Cash keeps its own yield regardless (not market-correlated).
        // IRA and Roth always reinvest dividends (tax-deferred / tax-free); effective return = appreciation + dividendRate.
        // Brokerage dividends handled separately below (taxed first, then reinvested or sent to Cash).
        // Bootstrap MC passes per-year sampled inflation; GBM and deterministic use the fixed rate.
        const baseReturn    = (inputs.returnSequence != null) ? inputs.returnSequence[y] : inputs.growth;
        const yearInflation = inputs.inflationSequence?.[y] ?? inputs.inflation;
        let growthRates = computeYearGrowthRates(inputs, y);

        // Withdrawal timing auto-selection (Phase 12): Early (Jan) for conversion years; Late (Dec) otherwise.
        // Early: preMonths=1, postMonths=11. Late: preMonths=11, postMonths=1.
        // Year 0: use strategy flag (bracket or explicit extraConv). Year 1+: prior year's actual conversion amount.
        // Do NOT use maxConversion as a trigger — it is hardcoded true in the optimizer and does not guarantee a conversion fires.
        const _stratImpliesConversion = inputs.strategy === 'bracket' || inputs.strategy === 'aca' || (inputs.extraConversionAmount ?? 0) > 0;
        const _prevConv    = y > 0 ? (log[y - 1].rothConv ?? 0) : 0;
        const _useEarly    = y === 0 ? _stratImpliesConversion : (_prevConv > 1000);
        const yearTiming   = _useEarly ? 'early' : 'late';
        const timingReason = _useEarly ? 'Conv'  : 'Spend';
        const preMonths    = yearTiming === 'early' ? 1 : 11;
        const postMonths   = 12 - preMonths;

        // Pre-withdrawal growth: portfolio earns for preMonths before withdrawal exits.
        const preGains = applyGrowth(balance, growthRates, preMonths);

        let withdrawals = { IRA: 0, IRA1: 0, IRA2: 0, Roth: 0, Brokerage: 0, BrokerageBasis: 0, Cash: 0 };
        let netWithdrawals = withdrawals;

        // Age at December 31 of the simulation year — the IRS convention for RMD eligibility.
        // Everyone has had their birthday by Dec 31, so no birth-month adjustment is needed.
        let age1 = sim.currentYear - birthyear1;
        let age2 = sim.currentYear - birthyear2;
        let alive1 = age1 <= inputs.die1;
        let alive2 = age2 <= inputs.die2;
        if (!alive1 && !alive2) break;

        totals.yearstested += 1;

        let status = (alive1 && alive2) ? 'MFJ' : 'SGL';
        // IRMAA is already known since it is based on income from 2 years ago (MAGI lookback),
        // compared against thresholds inflated to THIS payment year (matches SSA indexing).
        // Only spouses actually on Medicare (living, 65+) pay the surcharge — a 61-year-old
        // household pays nothing no matter how large the conversion income.
        const onMedicare = (alive1 && age1 >= 65 ? 1 : 0) + (alive2 && age2 >= 65 ? 1 : 0);
        const magiLookback = balance.magiHistory[balance.magiHistory.length - 2];
        let IRMAA = calcIRMAA(magiLookback, status, sim.cpiRate, sim.medicareRate, onMedicare);
        // Tier for display/milestones — same lookback MAGI and same age gate as the charge
        // (the log row used to recompute this AFTER the year's MAGI push, showing the tier a
        // year early).
        let IRMAATier = onMedicare > 0 ? getIRMAATier(magiLookback, status, sim.cpiRate) : '-none-';
        // Base Medicare Part B + Part D premiums (informational — tracked, not deducted from
        // spendable; assumed to live inside the spend goal). Grows at CPI + Inflation (user inputs),
        // not CPI alone.
        const medicareBase = onMedicare * (TAXData.IRMAA.standardPartB + TAXData.IRMAA.standardPartD) * 12 * sim.medicareRate;

        // Calculate the bracket limits based on: stated limit.
        // let tgtBracketLimit = findLimitByRate('FEDERAL',status,inputs.stratRate)

        // Find federal & state rates and limits by spending goal:
        let goalFedBracketLimit = findUpperLimitByAmount('FEDERAL', status, sim.spendGoal, sim.cpiRate)
        let goalStateBracketLimit = findUpperLimitByAmount(STATEname, status, sim.spendGoal, sim.cpiRate)
        let goalLimit = Math.min(goalFedBracketLimit.limit, goalStateBracketLimit.limit)
        let IRMAABracket = findUpperLimitByAmount('IRMAA', status, goalLimit, sim.cpiRate)
        let IRMAALimit = Math.min(goalLimit, IRMAABracket.limit);
        let totalIncome = 0;
        let netIncome = 0;
        let capitalGains = 0;
        let limit;              // MAGI ceiling for bracket/minlimit/aca strategies (see computeBracketCeiling)
        let stateLimit;
        let bracketTarget = 0;  // ceiling being targeted by bracket/minlimit/aca strategies
        let bracketOverage = 0; // how far MAGI exceeded bracketTarget (0 when no bracket strategy)
        let forcedIRA = 0;      // soft-cap break: IRA drawn ABOVE the ceiling to fund mandatory spending
        let acaBreach = false;  // strict ACA cap could not fund spending → plan untenable this year

        // Soft caps (Fill Federal Bracket / IRMAA Tier / IRA Draw %): when spending can't be met
        // within the ceiling and Cash/Brokerage/Roth are exhausted, the 3rd-pass fallback draws
        // extra IRA above the ceiling to fund spending (recorded in `forcedIRA`; the bracket
        // overage is recomputed afterward). Strict cap (ACA): never breaches the FPL ceiling —
        // any unmet spending stays a shortfall and is flagged via `acaBreach`. The
        // isBracketInfeasible flag (~line 1503) summarizes overage across years.

        // 1. Inherit IRA
        if (!alive1 && balance.IRA1 > 0) { balance.IRA2 += balance.IRA1; balance.IRA1 = 0; }
        if (!alive2 && balance.IRA2 > 0) { balance.IRA1 += balance.IRA2; balance.IRA2 = 0; }


        // 2. Base Income
        let ssReduction = (inputs.ssFailYear > 2000 && sim.currentYear >= inputs.ssFailYear) ? inputs.ssFailPct : 1;
        let potentialS1 = (age1 >= inputs.ss1Age) ? inputs.ss1 * sim.cpiRate * ssReduction : 0;
        let potentialS2 = (age2 >= inputs.ss2Age) ? inputs.ss2 * sim.cpiRate * ssReduction : 0;
        let s1 = alive1 ? potentialS1 : 0;
        let s2 = alive2 ? potentialS2 : 0;
        let pension = (age1 >= (inputs.pensionStartAge || 0))
            ? inputs.pensionAnnual * (inputs.pensionCola ? sim.inflation : 1)
            : 0;

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
                ? rawSurvivorMonthly * 12 * sim.cpiRate * ssReduction
                : 0;
            s2 = 0;
        }
        let fixedInc = s1 + s2;					// Social Security
        let taxableInc = pension;				// Pensions, W2, RMDs, IRA withdrawals, wdBrokerage

        // These will be APPROXIMATE worst case - no Withdrawals have been made.
        let taxableInterest = balance.Cash * inputs.cashYield
        let taxableDividends = balance.Brokerage * inputs.dividendRate


        // 3. RMDs and QCDs
        let rmd1Pct = getRMDPercentage(sim.currentYear, birthyear1);
        let rmd2Pct = getRMDPercentage(sim.currentYear, birthyear2);
        let rmd1 = alive1 ? balance.IRA1 * rmd1Pct || 0 : 0;
        let rmd2 = alive2 ? balance.IRA2 * rmd2Pct || 0 : 0;
        rmd1Pct = Math.max(rmd1Pct, rmd2Pct, 0);
        rmd1Pct = Math.max(rmd1Pct, rmd2Pct, 0);

        // QCDs: leave IRA tax-free to charity (age 70.5+). Satisfy RMDs without adding to taxable income/MAGI.
        // Provisional MAGI estimate (IRA withdrawals unknown here; uses pension+RMD+SS+interest/divs).
        const qcdLimit = getQCDLimit(sim.currentYear, inputs.cpi);
        const provisionalMAGI = taxableInc + rmd1 + rmd2 + 0.85 * (s1 + s2) + taxableInterest + taxableDividends;
        const { qcd1, qcd2, totalQCD } = computeAnnualQCDs(inputs, balance, sim.currentYear, qcdLimit, provisionalMAGI, sim.cpiRate, alive1, alive2, status);

        // QCDs leave the IRA first (charitable transfer, excluded from income)
        balance.IRA1 = Math.max(0, balance.IRA1 - qcd1);
        balance.IRA2 = Math.max(0, balance.IRA2 - qcd2);

        // Remaining RMD (after QCD satisfies part/all) is taken as taxable IRA distribution
        const remainingRmd1 = Math.max(0, rmd1 - qcd1);
        const remainingRmd2 = Math.max(0, rmd2 - qcd2);
        balance.IRA1 = Math.max(0, balance.IRA1 - remainingRmd1);
        balance.IRA2 = Math.max(0, balance.IRA2 - remainingRmd2);
        let curIRA = Math.max(0, balance.IRA1 + balance.IRA2 - iraGoalNominal);

        let totalRMD = rmd1 + rmd2;                                    // required distributions (for stats)
        const taxableRMD = remainingRmd1 + remainingRmd2;              // taxable portion (excludes QCDs)
        const totalIRAForcedWithdrawals = qcd1 + remainingRmd1 + qcd2 + remainingRmd2; // actual IRA outflow
        taxableInc += taxableRMD;                                       // only non-QCD RMDs are income
        let possibleIncome = taxableInc + taxableDividends + taxableInterest + fixedInc;

        // 4. Determine Target Spending amount based on Strategy
        // ACA is a STRICT-cap strategy: it shares the bracket strategy's ceiling math and
        // Cash→Brokerage→Roth gap-fill, but is excluded from the soft-cap forced-IRA fallback
        // (breaching an ACA FPL cap forfeits the premium subsidy — a cliff, not a tax bump).
        const isACAStrategy = inputs.strategy === 'aca';
        const isBracketStrategy = inputs.strategy === 'bracket' || inputs.strategy === 'minlimit' || inputs.strategy === 'fixedpct' || isACAStrategy;
        const isOrderedStrategy = inputs.strategy === 'ordered';

        // Phase 22: Guyton-Klinger dynamic spend adjustment (runs before targetSpend resolution)
        if (inputs.strategy === 'gk') {
            if (y === 0) {
                sim.gkIWR = sim.spendGoal / sim.gkPrevPortfolio;
                sim.gkAdjLabel = '';
            } else {
                const _guard  = inputs.gkGuard  ?? 0.20;
                const _adjP   = inputs.gkAdjPct ?? 0.10;
                const labels  = [];
                // Inflation Rule: skip CPI if prior return negative AND already over IWR
                if (sim.gkPriorReturn < 0 && sim.spendGoal / sim.gkPrevPortfolio > sim.gkIWR) {
                    labels.push('no-CPI');
                } else {
                    sim.spendGoal *= (1 + yearInflation);
                }
                // Guardrail checks on (possibly inflation-adjusted) spend
                const _cwr = sim.spendGoal / sim.gkPrevPortfolio;
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

        // GK bypasses goalLimit (bracket ceiling) — spend is dynamically set by GK rules
        const isGKStrategy = inputs.strategy === 'gk';
        let targetSpend = (isBracketStrategy || isOrderedStrategy || isGKStrategy) ? sim.spendGoal : Math.min(sim.spendGoal, goalLimit);
        let additionalSpendNeeded = Math.max(0, targetSpend + IRMAA - possibleIncome);

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
                if (sim.subCycleIRAYears >= _cycN) {
                    isBrokerageYear = true;
                    sim.subCycleIRAYears = 0;
                } else {
                    sim.subCycleIRAYears++;
                }
            } else {
                sim.subCycleIRAYears++;   // Brokerage depleted; keep counting IRA years
            }
            subCycleLabel = isBrokerageYear ? 'Brok' : 'IRA';
        }

        if (isBrokerageYear) {
            // Brokerage harvest year: draw from Brokerage instead of IRA. Always max out the
            // nerd-knob-selected LTCG bracket (0% or 15% top) rather than only drawing to meet
            // spend — this realizes gains + steps up basis even when spend doesn't need it.
            // If spend needs force realization beyond the target, top off whichever LTCG bracket
            // the forced amount actually lands in (capture the room in the bracket you're already
            // paying for) — but never past the active bracket/minlimit/aca strategy's own MAGI
            // ceiling (`limit`), if one is in effect this year.
            const _baseOrdinaryInc = taxableInc + fixedInc + taxableInterest + taxableDividends;
            const _cycleTargetRate = inputs.cycleLTCGTarget ?? 0.15;   // nerd knob: 0.15=target 0% bracket (default), 0.20=target 15% bracket
            const _targetRoom = getLTCGBracketRoom(_baseOrdinaryInc, status, _cycleTargetRate, sim.cpiRate);
            const _targetNetRoom = _targetRoom * (1 - capGainsPercentage * sim.capitalGainsRate);
            let _brokerageNetTarget;
            if (additionalSpendNeeded <= _targetNetRoom) {
                // Spend fits inside the target bracket — max it out anyway.
                _brokerageNetTarget = _targetNetRoom;
            } else {
                // Spend forces gains beyond the target bracket. Find which LTCG bracket the
                // forced realization lands in and top off to that bracket's own ceiling.
                const _spendGrossNeeded = additionalSpendNeeded / Math.max(0.01, 1 - capGainsPercentage * sim.capitalGainsRate);
                const _landedRate = getLTCGBracketTopRate(_baseOrdinaryInc, _spendGrossNeeded, status, sim.cpiRate);
                const _ltcgRates = (TAXData.FEDERAL.CAPITAL_GAINS[status]?.brackets ?? []).map(b => b.r);
                const _nextRate = _ltcgRates.find(r => r > _landedRate);
                let _room = (_nextRate !== undefined)
                    ? getLTCGBracketRoom(_baseOrdinaryInc, status, _nextRate, sim.cpiRate)
                    : _spendGrossNeeded;   // already in the top LTCG bracket — no higher ceiling to top off to
                if (inputs.strategy === 'bracket' || inputs.strategy === 'minlimit' || inputs.strategy === 'aca') {
                    // Don't let the LTCG top-off push total realized income past the active
                    // strategy's own ceiling (IRMAA tier / ACA cliff / bracket ceiling). This
                    // branch (isBrokerageYear) runs INSTEAD of the ceiling-computing branch this
                    // year, so compute it fresh here rather than reading a stale/undefined `limit`.
                    const _ceil = computeBracketCeiling(inputs, status, sim.cpiRate, sim.inflation, STATEname, age1, age2, alive1, alive2, IRMAALimit).limit;
                    _room = Math.min(_room, Math.max(0, _ceil - _baseOrdinaryInc));
                }
                _brokerageNetTarget = Math.max(additionalSpendNeeded, _room * (1 - capGainsPercentage * sim.capitalGainsRate));
            }
            if (_brokerageNetTarget > 1 && curBalances.Brokerage > 0) {
                // Depletion check: warn if Brokerage < 50% of what we need
                const _grossNeeded = _brokerageNetTarget / Math.max(0.01, 1 - capGainsPercentage * sim.capitalGainsRate);
                if (curBalances.Brokerage < _grossNeeded * 0.5) {
                    subCycleLabel = '⚠Brok';
                }
                withdrawals = calculateWithdrawals(curBalances, _brokerageNetTarget,
                    { order: ['Brokerage'], weight: [1], taxrate: [capGainsPercentage * sim.capitalGainsRate] });
            } else {
                withdrawals = {};
            }
        } else if (inputs.strategy === 'fixed') {
            // In this strategy, we confine withdrawals to the IRA for the first round. 
            // We don't care about the tax implications.

            let remYears = Math.max(1, inputs.nYears - y);
            let amortized = Math.max(0, sim.fixedWithdrawal - totalIRAForcedWithdrawals);

            // Withdraw the fixed amount left after RMDs, or whatever is left in IRAs after leaving room.
            // Intra-year growth correction: iraGoalNominal is an END-OF-YEAR target, but the
            // withdrawal happens mid-year and the retained balance still grows for postMonths
            // afterward (applyGrowth is simple proportional: factor = 1 + rate*postMonths/12).
            // Drawing down to exactly the goal would leave goal*(1+growth) at year end — a
            // systematic ~one-year-of-growth overshoot. Instead draw down to goal/postGrowth so
            // the retained balance lands on the goal at year end; the ×0.99 biases it ~1% under
            // (preferred to overshooting). growthRates.IRA carries the actual per-year return,
            // including the Monte Carlo sequence, so this is correct under variable growth too.
            const postGrowthIRA = 1 + (growthRates.IRA ?? 0) * (postMonths / 12);
            const reduceFloor = (iraGoalNominal / postGrowthIRA) * 0.99;
            const curIRAreduce = Math.max(0, balance.IRA1 + balance.IRA2 - reduceFloor);
            let IRAwd = Math.max(0, Math.min(curIRAreduce, amortized))
            withdrawals = { IRA: IRAwd, netAmount: IRAwd }

        } else if (inputs.strategy === 'bracket' || inputs.strategy === 'minlimit' || inputs.strategy === 'aca') {
            ({ limit, marginalFedTaxRate, marginalStateTaxRate, nominalFedTaxRateAtLimit, nominalStateTaxAtLimit, stateLimit } =
                computeBracketCeiling(inputs, status, sim.cpiRate, sim.inflation, STATEname, age1, age2, alive1, alive2, IRMAALimit));

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
            const originalIRA = balance.IRA1 + balance.IRA2 + totalIRAForcedWithdrawals;
            const targetTotal = originalIRA * pct;
            const IRAwd = Math.max(0, Math.min(curIRA, targetTotal - totalIRAForcedWithdrawals));
            withdrawals = { IRA: IRAwd, netAmount: IRAwd };

        } else if (inputs.strategy === 'propwd') {
            // Proportional +%: first withdraw proportionally for spending (same as baseline),
            // then add an IRA-only boost of propWithdraw × spendGoal strictly from IRA.
            // The after-tax surplus from the boost flows to Roth/Cash via step 7.
            withdrawStrategy.order = ['IRA', 'Brokerage', 'Cash'];
            withdrawStrategy.taxrate = [sim.nominalTaxRate, capGainsPercentage * (sim.capitalGainsRate + nominalStateTaxAtLimit), 0, 0];
            withdrawals = calculateWithdrawals(curBalances, additionalSpendNeeded, withdrawStrategy);
            const pct = inputs.propWithdraw ?? 0;
            if (pct > 0) {
                const remainingIRA = Math.max(0, curBalances.IRA - (withdrawals.IRA || 0));
                const boost = Math.min(sim.spendGoal * pct, remainingIRA);
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
            withdrawStrategy.taxrate = [sim.nominalTaxRate, capGainsPercentage * (sim.capitalGainsRate + nominalStateTaxAtLimit), 0, 0]
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

        inspectForErrors({ fixedInc: fixedInc, totalRMD: totalRMD, taxableInterest: taxableInterest, capitalGains: capitalGains, taxableDividends: taxableDividends, age1: age1, age2: age2, cpiRate: sim.cpiRate })


        let tax = calculateTaxes({
            filingStatus: status, ages: [age1, age2], birthyears: [birthyear1, birthyear2],
            totalSS: s1 + s2, IRMAAAnnualCost: IRMAA,
            earnedIncome: pension + taxableRMD + netWithdrawals.IRA + taxableInterest, inflation: sim.cpiRate,
            pensionIncome: pension, iraIncome: taxableRMD + netWithdrawals.IRA,
            qualifiedDiv: taxableDividends, capGains: capitalGains, hsaContrib: 0,
            taxExemptInterest: 0, state: STATEname
        })
        inspectForErrors(tax)  // See if any numbers look fishy.

        marginalFedTaxRate = tax.federalMarginalRate;
        marginalStateTaxRate = tax.stateMarginalRate;
        sim.capitalGainsRate = tax.capitalGainsRate;

        //!!! Assume MAGI for prior to years is the same as this year. Should allow this to be entered

        let magiHistoryLength = balance.magiHistory.length
        if (magiHistoryLength < 1) {
            balance.magiHistory.push(tax.MAGI);
            balance.magiHistory.push(tax.MAGI);
            // Year 0 read undefined MAGI at the lookback above (no history existed yet), forcing
            // IRMAA to $0/'-none-' regardless of actual income. Retroactively correct THIS year's
            // charge now that tax.MAGI is known — steady-state assumption per the comment above,
            // still "computed once at charge time" (doesn't reintroduce the prior tier-lag bug).
            IRMAA = calcIRMAA(tax.MAGI, status, sim.cpiRate, sim.medicareRate, onMedicare);
            IRMAATier = onMedicare > 0 ? getIRMAATier(tax.MAGI, status, sim.cpiRate) : '-none-';
            tax.IRMAAAnnualCost = IRMAA;
            tax.IRMAARate = tax.MAGI > 0 ? IRMAA / tax.MAGI : 0;
            tax.nominalRate = tax.federalNominalRate + tax.stateNominalRate + tax.IRMAARate;
        }

        let totalTax = tax.totalTax + IRMAA;

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
                        { order: ['Brokerage'], weight: [1], taxrate: [capGainsPercentage * (sim.capitalGainsRate + nominalStateTaxAtLimit)] });
                    netWithdrawals = accumulateWithdrawals([netWithdrawals, brokerWd]);
                    applyWithdrawals(curBalances, brokerWd);

                    if ((brokerWd.shortfall ?? 0) > 1 && curBalances.Roth > 0) {
                        const rothWithdrawals = calculateWithdrawals(curBalances, brokerWd.shortfall, { order: ['Roth'], weight: [1], taxrate: [0] });
                        netWithdrawals = accumulateWithdrawals([netWithdrawals, rothWithdrawals]);
                        applyWithdrawals(curBalances, rothWithdrawals);
                    }
                }
            } else if (isOrderedStrategy) {
                const seq = resolveOrderedSeq(inputs.orderedSeq, { capGainsPercentage: capGainsPercentage, capitalGainsRate: sim.capitalGainsRate, nominalStateTaxAtLimit: nominalStateTaxAtLimit, nominalTaxRate: sim.nominalTaxRate, marginalFedTaxRate: marginalFedTaxRate, marginalStateTaxRate: marginalStateTaxRate });
                netWithdrawals = runOrderedWithdrawal(curBalances, gap, seq, netWithdrawals, applyWithdrawals);

            } else {
                // Default: Brokerage + Cash proportional, then Roth fallback.
                withdrawStrategy.order = ['Brokerage', 'Cash'];
                withdrawStrategy.weight = [40, 60];
                withdrawStrategy.taxrate = [capGainsPercentage * (sim.capitalGainsRate + nominalStateTaxAtLimit), 0];
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
            filingStatus: status, ages: [age1, age2], birthyears: [birthyear1, birthyear2],
            totalSS: s1 + s2, IRMAAAnnualCost: IRMAA,
            earnedIncome: pension + taxableRMD + netWithdrawals.IRA + taxableInterest, inflation: sim.cpiRate,
            pensionIncome: pension, iraIncome: taxableRMD + netWithdrawals.IRA,
            qualifiedDiv: taxableDividends, capGains: capitalGains, hsaContrib: 0,
            taxExemptInterest: 0, state: STATEname
        })
        inspectForErrors(tax)  // See if any numbers look fishy.

        // Now we have the "real tax"
        totalTax = tax.totalTax + IRMAA;
        bracketOverage = bracketTarget > 0 ? Math.max(0, tax.MAGI - bracketTarget) : 0;
        // Update marginal rates so the third pass grosses up correctly at actual bracket.
        marginalFedTaxRate = tax.federalMarginalRate;
        marginalStateTaxRate = tax.stateMarginalRate;

        // Third pass: if second-pass taxes created a residual shortfall, withdraw more and recalc once.
        // This handles cases where the gap fill (brokerage cap gains) raised taxes above the initial estimate.
        // Compute gross income inline (totalIncome is still 0 here; it's assigned below at line 813).
        const incomeAfterGapFill = fixedInc + netWithdrawals.IRA + pension + taxableDividends +
            taxableInterest + netWithdrawals.Roth + netWithdrawals.Cash + netWithdrawals.Brokerage + taxableRMD;
        const residualGap = targetSpend - (incomeAfterGapFill - totalTax);
        if (residualGap > 1) {
            const thirdPassStart = performance.now();
            if (isOrderedStrategy) {
                const seq = resolveOrderedSeq(inputs.orderedSeq, { capGainsPercentage: capGainsPercentage, capitalGainsRate: sim.capitalGainsRate, nominalStateTaxAtLimit: nominalStateTaxAtLimit, nominalTaxRate: sim.nominalTaxRate, marginalFedTaxRate: marginalFedTaxRate, marginalStateTaxRate: marginalStateTaxRate });
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
                let _remShort = thirdWd.shortfall ?? 0;
                // Roth fallback if Cash ran out (still no cap gains)
                if (_remShort > 1 && curBalances.Roth > 0) {
                    const rothWd3 = calculateWithdrawals(curBalances, _remShort,
                        { order: ['Roth'], weight: [1], taxrate: [0] });
                    netWithdrawals = accumulateWithdrawals([netWithdrawals, rothWd3]);
                    applyWithdrawals(curBalances, rothWd3);
                    _remShort = rothWd3.shortfall ?? 0;
                }
                // Strict ACA: Cash+Roth couldn't cover and the FPL cap forbids drawing more IRA
                // (breaching it forfeits the subsidy) → leave the shortfall and flag it untenable.
                // Soft caps fund the residual from IRA in the convergence loop below.
                if (_remShort > 1 && isACAStrategy) acaBreach = true;
            }
            capitalGains = Math.max(0, (netWithdrawals.Brokerage ?? 0) - (netWithdrawals.BrokerageBasis ?? 0));
            tax = calculateTaxes({
                filingStatus: status, ages: [age1, age2], birthyears: [birthyear1, birthyear2],
                totalSS: s1 + s2, IRMAAAnnualCost: IRMAA,
                earnedIncome: pension + taxableRMD + netWithdrawals.IRA + taxableInterest, inflation: sim.cpiRate,
                qualifiedDiv: taxableDividends, capGains: capitalGains, hsaContrib: 0,
                taxExemptInterest: 0, state: STATEname
            });
            totalTax = tax.totalTax + IRMAA;
            totals.thirdPassCount += 1;
            totals.thirdPassTime += performance.now() - thirdPassStart;
        }

        // Soft-cap break (Fill Federal Bracket / IRMAA Tier / IRA Draw %): when Cash/Brokerage/
        // Roth are exhausted but the IRA still has funds, draw extra IRA ABOVE the ceiling to
        // fund MANDATORY spending. Bounded convergence: forcing IRA raises taxes (SS phase-in,
        // IRMAA), which can re-open a small residual — a few iterations fully fund spending while
        // the IRA lasts. Excluded: strict ACA (subsidy cliff), ordered (own sequence), and
        // fixed/propwd/baseline/gk (already draw IRA for spending — left unchanged).
        if (isBracketStrategy && !isACAStrategy) {
            for (let _i = 0; _i < 4; _i++) {
                const _inc = fixedInc + netWithdrawals.IRA + pension + taxableDividends +
                    taxableInterest + netWithdrawals.Roth + netWithdrawals.Cash + netWithdrawals.Brokerage + taxableRMD;
                const _res = targetSpend - (_inc - totalTax);
                if (_res <= 1 || (curBalances.IRA ?? 0) <= 0) break;
                const iraTop = calculateWithdrawals(curBalances, _res,
                    { order: ['IRA'], weight: [1], taxrate: [marginalFedTaxRate + marginalStateTaxRate] });
                netWithdrawals = accumulateWithdrawals([netWithdrawals, iraTop]);
                applyWithdrawals(curBalances, iraTop);
                forcedIRA += (iraTop.IRA ?? 0);
                capitalGains = Math.max(0, (netWithdrawals.Brokerage ?? 0) - (netWithdrawals.BrokerageBasis ?? 0));
                tax = calculateTaxes({
                    filingStatus: status, ages: [age1, age2], birthyears: [birthyear1, birthyear2], totalSS: s1 + s2, IRMAAAnnualCost: IRMAA,
                    earnedIncome: pension + taxableRMD + netWithdrawals.IRA + taxableInterest, inflation: sim.cpiRate,
                    pensionIncome: pension, iraIncome: taxableRMD + netWithdrawals.IRA,
                    qualifiedDiv: taxableDividends, capGains: capitalGains, hsaContrib: 0,
                    taxExemptInterest: 0, state: STATEname
                });
                totalTax = tax.totalTax + IRMAA;
                marginalFedTaxRate = tax.federalMarginalRate;
                marginalStateTaxRate = tax.stateMarginalRate;
            }
        }

        // Recompute overage after any 3rd-pass forced IRA draw (soft caps may now exceed the
        // ceiling). For the strict ACA strategy, a MAGI above the FPL cap — whether from a
        // forced draw (blocked) or unavoidable income (RMDs/SS) — flags the plan untenable.
        bracketOverage = bracketTarget > 0 ? Math.max(0, tax.MAGI - bracketTarget) : 0;
        if (isACAStrategy && bracketOverage > 1) acaBreach = true;
        if (acaBreach) totals.acaBreachYears += 1;
        totals.forcedIRATotal += forcedIRA;

        sim.cumulativeTaxes += totalTax;


        totalIncome = Math.max(1, fixedInc + netWithdrawals.IRA + pension + taxableDividends +
            taxableInterest + netWithdrawals.Roth + netWithdrawals.Cash +
            netWithdrawals.Brokerage + taxableRMD);

        inspectForErrors({ totalIncome: totalIncome });

        sim.nominalTaxRate = tax.nominalRate;

        // 7. Updates

        netIncome = totalIncome - totalTax;
        let surplus = {
            Total: Math.max(0, netIncome - sim.spendGoal), Roth: 0, Cash: 0, Brokerage: 0,
            Shortfall: Math.min(0, netIncome - sim.spendGoal)
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

        // Counterfactual-only helper (Opp. Cost / Break Even): undo up to `netTarget` after-tax
        // dollars of discretionary IRA over-withdrawal by putting the gross amount back into the
        // IRA(s) and re-running the tax engine. Fixed point on gross G: removing G lowers taxes
        // by dT, so the net surplus removed is G − dT; iterate G = netTarget + dT until stable.
        // RMDs are never refunded (netWithdrawals.IRA excludes them); amounts already earmarked
        // for conversion (surplus.Roth1/2) are excluded from the refundable cap.
        const _cfRefundIRA = (netTarget) => {
            const _cap = Math.max(0, (netWithdrawals.IRA1 ?? 0) + (netWithdrawals.IRA2 ?? 0)
                - (surplus.Roth1 ?? 0) - (surplus.Roth2 ?? 0));
            if (netTarget <= 1 || _cap <= 1) return;
            let G = Math.min(netTarget, _cap);
            let t2 = tax, dT = 0;
            for (let _i = 0; _i < 3; _i++) {
                t2 = calculateTaxes({
                    filingStatus: status, ages: [age1, age2], birthyears: [birthyear1, birthyear2],
                    totalSS: s1 + s2, IRMAAAnnualCost: IRMAA,
                    earnedIncome: pension + taxableRMD + Math.max(0, netWithdrawals.IRA - G) + taxableInterest, inflation: sim.cpiRate,
                    pensionIncome: pension, iraIncome: taxableRMD + Math.max(0, netWithdrawals.IRA - G),
                    qualifiedDiv: taxableDividends, capGains: capitalGains, hsaContrib: 0,
                    taxExemptInterest: 0, state: STATEname
                });
                dT = Math.max(0, (totalTax - IRMAA) - t2.totalTax);
                const Gnext = Math.min(netTarget + dT, _cap);
                if (Math.abs(Gnext - G) < 1) { G = Gnext; break; }
                G = Gnext;
            }
            const _iraDraw = (netWithdrawals.IRA1 ?? 0) + (netWithdrawals.IRA2 ?? 0);
            const _r = _iraDraw > 0 ? (netWithdrawals.IRA1 ?? 0) / _iraDraw : 0.5;
            netWithdrawals.IRA1 -= G * _r;
            netWithdrawals.IRA2 -= G * (1 - _r);
            netWithdrawals.IRA -= G;
            tax = t2;
            const _newTotalTax = t2.totalTax + IRMAA;
            sim.cumulativeTaxes -= (totalTax - _newTotalTax);
            const _netRemoved = G - (totalTax - _newTotalTax);
            totalTax = _newTotalTax;
            totalIncome = Math.max(1, totalIncome - G);
            netIncome -= _netRemoved;
            sim.nominalTaxRate = tax.nominalRate;
            marginalFedTaxRate = tax.federalMarginalRate;
            marginalStateTaxRate = tax.stateMarginalRate;
            surplus.Total = Math.max(0, surplus.Total - _netRemoved);
        };

        if (inputs.maxConversion && !inputs._cfSuppressConversions) {
            const conv1 = Math.min(surplus.Total * ira1_ratio,       netWithdrawals.IRA1 || 0);
            const conv2 = Math.min(surplus.Total * (1 - ira1_ratio), netWithdrawals.IRA2 || 0);
            surplus.Roth1 = conv1;
            surplus.Roth2 = conv2;
            surplus.Total -= (conv1 + conv2);
        } else if (inputs.maxConversion && inputs._cfSuppressConversions) {
            // Counterfactual: the surplus that would have converted stays in the IRA instead.
            _cfRefundIRA(surplus.Total);
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

        // Counterfactual: the surplus that would have been banked to Cash/Brokerage stays in
        // the IRA instead (RMD-driven surplus cannot be refunded and still flows out below).
        if (inputs._cfSuppressExcess && surplus.Total > 1) _cfRefundIRA(surplus.Total);

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
        const _extraConvReq = inputs._cfSuppressConversions ? 0
            : Array.isArray(inputs.extraConversionAmount)
                ? (inputs.extraConversionAmount[y] ?? 0)
                : (inputs.extraConversionAmount ?? 0);
        let extraConvGross = 0, incrementalExtraConvTax = 0;
        if (_extraConvReq > 0) {
            const _availIRA = balance.IRA1 + balance.IRA2;
            const _gross = Math.min(_extraConvReq, _availIRA);
            if (_gross > 0) {
                // Incremental tax on extra IRA withdrawal via marginal-method re-calc
                const _baseEI = pension + taxableRMD + taxableInterest + (netWithdrawals.IRA ?? 0);
                const _exTaxCalc = calculateTaxes({
                    filingStatus: status, ages: [age1, age2], birthyears: [birthyear1, birthyear2], totalSS: s1 + s2,
                    IRMAAAnnualCost: 0, earnedIncome: _baseEI + _gross, inflation: sim.cpiRate,
                    pensionIncome: pension, iraIncome: taxableRMD + (netWithdrawals.IRA ?? 0) + _gross,
                    qualifiedDiv: taxableDividends, capGains: capitalGains,
                    hsaContrib: 0, taxExemptInterest: 0, state: STATEname
                });
                incrementalExtraConvTax = Math.max(0, _exTaxCalc.totalTax - (totalTax - IRMAA));
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
                sim.cumulativeTaxes += incrementalExtraConvTax;
            }
        }

        // Phase 20 (reworked): per-year incremental tax attribution for the convTax / excessTax
        // columns only. For each action (Roth conversion, excess withdrawal to Cash), compute the
        // incremental tax attributable to that action by re-running calculateTaxes() without it.
        // The Opp. Cost / Break Even values themselves come from the counterfactual run below.
        let incrementalConvTax = 0;
        if (totalConverted > 0) {
            const baseEI = pension + taxableRMD + taxableInterest;
            const convShadowEI = baseEI + Math.max(0, (netWithdrawals.IRA ?? 0) - totalConverted);
            const shadowConvCalc = calculateTaxes({
                filingStatus: status, ages: [age1, age2], birthyears: [birthyear1, birthyear2], totalSS: s1 + s2,
                IRMAAAnnualCost: 0, earnedIncome: convShadowEI, inflation: sim.cpiRate,
                pensionIncome: pension, iraIncome: taxableRMD + Math.max(0, (netWithdrawals.IRA ?? 0) - totalConverted),
                qualifiedDiv: taxableDividends, capGains: capitalGains,
                hsaContrib: 0, taxExemptInterest: 0, state: STATEname
            });
            incrementalConvTax = Math.max(0, (totalTax - IRMAA) - shadowConvCalc.totalTax);
        }

        let incrementalExcessTax = 0;
        const excessCashOC = surplus.Cash;
        if (excessCashOC > 0 && (netWithdrawals.IRA ?? 0) > 0) {
            const baseEI = pension + taxableRMD + taxableInterest;
            const excessShadowEI = baseEI + Math.max(0, (netWithdrawals.IRA ?? 0) - excessCashOC);
            const shadowExcessCalc = calculateTaxes({
                filingStatus: status, ages: [age1, age2], birthyears: [birthyear1, birthyear2], totalSS: s1 + s2,
                IRMAAAnnualCost: 0, earnedIncome: excessShadowEI, inflation: sim.cpiRate,
                pensionIncome: pension, iraIncome: taxableRMD + Math.max(0, (netWithdrawals.IRA ?? 0) - excessCashOC),
                qualifiedDiv: taxableDividends, capGains: capitalGains,
                hsaContrib: 0, taxExemptInterest: 0, state: STATEname
            });
            incrementalExcessTax = Math.max(0, (totalTax - IRMAA) - shadowExcessCalc.totalTax);
        }

        // Brokerage tax treatment is correct: dividends are taxed as qualifiedDiv in calculateTaxes()
        // (line ~864), liquidations are taxed as capGains above BrokerageBasis, and the growth
        // applied here is unrealized appreciation — not taxable until sold. The one valuation nuance:
        // unrealized gains are carried at face value during the simulation; totalWealth (line ~1091)
        // discounts them by nominalTaxRate, but year-by-year spendable wealth does not reserve for
        // deferred tax on gains that are never liquidated.

        // Post-withdrawal growth (Phase 12): remaining postMonths after withdrawal exits portfolio.
        let gains = applyGrowth(balance, growthRates, postMonths);
        inspectForErrors(growthRates, balance, gains);
        // Merge pre-growth gains so annual display stats (brokerageG / cashG / rothG) reflect full year.
        for (const k in preGains) gains[k] = (gains[k] ?? 0) + (preGains[k] ?? 0);

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
        totals.medicare = (totals.medicare || 0) + medicareBase;
        totals.gross += totalIncome;
        totals.spend += (targetSpend + surplus.Shortfall);
        totals.taxCurrentDollars += totalTax / sim.inflation;
        totals.spendCurrentDollars += (targetSpend + surplus.Shortfall) / sim.inflation;
        totals.rmd += totalRMD;
        // Estimate tax attributable to RMDs proportionally (RMD / totalIncome × totalTax)
        totals.rmdTax += totalIncome > 0 ? (taxableRMD / totalIncome) * totalTax : 0;
        totals.qcd = (totals.qcd || 0) + totalQCD;
        balance.Roth1 += surplus.Roth1;
        balance.Roth2 += surplus.Roth2;
        totals.shortfall += surplus.Shortfall;

        // Opp. Cost NetValue (convOC/excessOC) is annotated after the loop by comparing this
        // run's after-tax wealth against the counterfactual run's, year by year.
        const _taxFuture = inputs.futureIRATaxRate ?? (marginalFedTaxRate + marginalStateTaxRate);
        // Capture the year-0 resolved future-IRA rate so the optimizer can value every
        // strategy's terminal IRA at one shared rate (comparable cross-strategy deltas).
        if (y === 0) totals.futureIRARate = _taxFuture;

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
            yearBETR = computeBETR(tax.federalMarginalRate + (tax.stateMarginalRate ?? 0), _rIRA, _rTax, _yearsToRMD);
            if (yearBETR !== null) {
                const _futureRate = _taxFuture; // already resolved above
                yearBETRflag = _futureRate > yearBETR + 0.02 ? '▲'
                             : _futureRate < yearBETR - 0.02 ? '▼' : '≈';
            }
        }

        // After-tax terminal valuation: IRA taxed at ordinary marginal (nominalTaxRate),
        // brokerage gains above basis taxed at the capital-gains rate (not ordinary),
        // Roth + Cash + returned basis at face.
        let totalWealth = (balance.IRA1 + balance.IRA2) * (1 - sim.nominalTaxRate)
            + Math.max(0, balance.Brokerage - balance.BrokerageBasis) * (1 - sim.capitalGainsRate)
            + balance.Roth1 + balance.Roth2 + balance.Cash + balance.BrokerageBasis

        // Fail when the portfolio can't cover its required draw (spend minus guaranteed income).
        // This is strategy-agnostic and fires at the point of first real impairment.
        const guaranteedIncome = s1 + s2 + pension;
        const portfolioBalance = balance.IRA1 + balance.IRA2 + balance.Roth1 + balance.Roth2 + balance.Brokerage + balance.Cash;
        const requiredPortfolioDraw = Math.max(0, sim.spendGoal - guaranteedIncome);
        if (netIncome < targetSpend * 0.99 || portfolioBalance < requiredPortfolioDraw) {
            totals.success = false;
            totals.failedInYear.push(sim.currentYear)
        } else {
            totals.yearsfunded += 1
        }

        inspectForErrors({ totalWealth: totalWealth })  // See if any numbers look fishy.

        // Phase 27: Withdrawal rate = (net outflows − inflows) / start-of-year wealth.
        // Gross outflows: all account withdrawals incl. conversion-funding draws.
        const _grossOutflows = (netWithdrawals.IRA ?? 0) + totalIRAForcedWithdrawals + extraConvGross
            + (netWithdrawals.Brokerage ?? 0)
            + (netWithdrawals.Cash ?? 0)
            + (netWithdrawals.Roth1 ?? 0)
            + (netWithdrawals.Roth2 ?? 0);
        // Net outflows: excludes Roth conversions (IRA→Roth reallocation) and reinvested surplus.
        const _netOutflows = _grossOutflows - totalConverted - _reinvestedSurplus;
        // Inflows: non-portfolio income applied to spending (SS + pension).
        const _yearInflows = fixedInc + pension;
        const _wdRate = (sim.prevTotalWealth != null && sim.prevTotalWealth > 0)
            ? (_netOutflows - _yearInflows) / sim.prevTotalWealth : null;

        const loopMs = performance.now() - loopStart;
        log.push(buildSimYearLogRecord({
            currentYear: sim.currentYear, alive1: alive1, alive2: alive2, age1: age1, age2: age2, status: status,
            fixedInc: fixedInc, pension: pension, targetSpend: targetSpend, netIncome: netIncome, totalIncome: totalIncome,
            surplus: surplus, totalRMD: totalRMD, qcd1: qcd1, qcd2: qcd2, taxableDividends: taxableDividends, taxableInterest: taxableInterest,
            netWithdrawals: netWithdrawals, rmd1: rmd1, rmd2: rmd2, totalConverted: totalConverted, tax: tax, IRMAA: IRMAA, IRMAATier: IRMAATier, medicareBase: medicareBase, cpiRate: sim.cpiRate,
            totalTax: totalTax, capitalGains: capitalGains, cumulativeTaxes: sim.cumulativeTaxes, bracketTarget: bracketTarget, bracketOverage: bracketOverage, forcedIRA: forcedIRA, acaBreach: acaBreach,
            balance: balance, nominalTaxRate: sim.nominalTaxRate, totalWealth: totalWealth, portfolioBalance: portfolioBalance, guaranteedIncome: guaranteedIncome,
            totalsSpend: totals.spend,
            gains: gains, rmd1Pct: rmd1Pct, subCycleLabel: subCycleLabel, convNetValue: null, excessNetValue: null,
            incrementalConvTax: incrementalConvTax, incrementalExcessTax: incrementalExcessTax, yearBETR: yearBETR, yearBETRflag: yearBETRflag,
            extraConvGross: extraConvGross,
            grossOutflows: _grossOutflows, netOutflows: _netOutflows,
            yearInflows: _yearInflows, wdRate: _wdRate,
            useEarly: _useEarly, timingReason: timingReason,
            strategy: inputs.strategy, spendGoal: sim.spendGoal, gkAdjLabel: sim.gkAdjLabel, inflation: sim.inflation, loopMs: loopMs
        }));
        totals.totalTime += log[log.length - 1].loopMs;
        sim.prevTotalWealth = totalWealth;
        sim.gkPrevPortfolio = portfolioBalance;  // raw sum; keep GK checks apples-to-apples
        // Advance spend goal: apply user's spend-change preference and inflation.
        // spendDelta is constant (1 + inputs.spendChange); moving this to end of loop
        // keeps year-0 spendGoal equal to the user's input in today's dollars.
        // Phase 22: GK handles inflation at start of next year via its own rules; only apply spendDelta here.
        if (inputs.strategy === 'gk') {
            sim.gkPriorReturn = baseReturn;
            sim.spendGoal = sim.spendGoal * spendDelta;
        } else {
            sim.spendGoal = sim.spendGoal * spendDelta * (1 + yearInflation);
        }

        sim.currentYear += 1;

        // Adjust inflation rates for subsequent rounds.
        sim.cpiRate *= (1 + inputs.cpi);
        sim.inflation *= (1 + yearInflation);
        sim.medicareRate *= (1 + inputs.cpi + inputs.inflation)
    } // end for (let y = 0; y < maxYears; y++)

    // Phase 20 (reworked): Opp. Cost via full counterfactual simulation.
    // convOC[y] = this run's after-tax wealth minus the same plan re-simulated with conversions
    // suppressed (converted dollars stay in the IRA, no conversion tax, bigger RMDs later, each
    // taxed at that year's actual bracket/IRMAA conditions). excessOC[y] = same idea for excess
    // IRA withdrawals banked to Cash. Break Even = first year the difference goes non-negative,
    // reported only when the action actually occurred by that year.
    // Valuation: row totalWealth (IRA at the run's own nominal rate, brokerage gains at the
    // cap-gains rate, Roth/Cash/basis at face) unless the user supplied futureIRATaxRate
    // (Marginal Heirs Tax Rate) — then both runs' IRAs are discounted at that shared rate.
    totals.convBEYear = null;
    totals.excessBEYear = null;
    if (inputs.computeOC && !inputs._cfRun) {
        const _atw = (r) => inputs.futureIRATaxRate == null ? r.totalWealth
            : (r.IRA1 + r.IRA2) * (1 - inputs.futureIRATaxRate)
              + Math.max(0, r.Brokerage - r.Basis) * (1 - (r['-capGainsRate'] ?? 0.15))
              + r.Roth + r.Cash + r.Basis;
        const _annotate = (cfLog, key) => {
            const n = Math.min(log.length, cfLog.length);
            for (let i = 0; i < n; i++) log[i][key] = _atw(log[i]) - _atw(cfLog[i]);
        };
        if (log.some(r => (r.rothConv ?? 0) > 1)) {
            // extraConversionAmount: 0 (not just the suppress flag) so conversion-driven
            // early-withdrawal timing (line ~1038) doesn't leak into the no-conversion plan.
            const cfConv = simulate({ ...inputs, _cfRun: true, _cfSuppressConversions: true, extraConversionAmount: 0, computeOC: false });
            _annotate(cfConv.log, 'convOC');
            let _cumConv = 0;
            totals.convBEYear = log.find(r =>
                (_cumConv += (r.rothConv ?? 0)) > 1 && (r.convOC ?? -1) >= 0)?.year ?? null;
        }
        if (log.some(r => (r.surplusCash ?? 0) > 1 && (r.IRAwd ?? 0) > 1)) {
            const cfExcess = simulate({ ...inputs, _cfRun: true, _cfSuppressExcess: true, computeOC: false });
            _annotate(cfExcess.log, 'excessOC');
            let _cumExcess = 0;
            totals.excessBEYear = log.find(r =>
                (_cumExcess += Math.min(r.surplusCash ?? 0, r.IRAwd ?? 0)) > 1 && (r.excessOC ?? -1) >= 0)?.year ?? null;
        }
    }

    // Phase 21: average BETR across all years with conversions.
    const _betrYears = log.filter(r => r['BETR%'] !== null && r['BETR%'] !== undefined);
    totals.betrAvg = _betrYears.length > 0
        ? _betrYears.reduce((s, r) => s + r['BETR%'], 0) / _betrYears.length
        : null;

    // Phase 27: average withdrawal rate across all simulated years.
    const _wdRateYears = log.filter(r => r['wdRate%'] != null);
    totals.avgWdRate = _wdRateYears.length > 0
        ? _wdRateYears.reduce((s, r) => s + r['wdRate%'], 0) / _wdRateYears.length
        : null;

    // Baseline accounting: expose the terminal capital-gains rate + terminal balance
    // breakdown so the optimizer's after-tax net-worth helper can value every strategy
    // on a comparable footing (IRA at future rate, brokerage gains at cap-gains rate).
    totals.capGainsRate = sim.capitalGainsRate;
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

// When ALL strategies fail at baseline, searches downward across every strategy to find
// the highest spend goal where at least one strategy succeeds.
// Returns { result, optimizedSpend, strategyLabel, paramLabel, paramSortVal, overrides } or null.
function optimizeSpendDown(baseInputs, strategyOverridesList) {
    function bestPassingStrategy(spendGoal) {
        let best = null;
        for (const entry of strategyOverridesList) {
            const res = simulate(Object.assign({}, baseInputs, entry.overrides, { spendGoal }));
            // GK self-cuts so totals.success is trivially true — require the GK stability floor too,
            // or the "highest sustainable spend" would be one GK only holds via continuous cuts.
            if (res.totals.success && gkSpendStable(res, entry.overrides, baseInputs)) {
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
function optimizeSpend(baseInputs, overrides) {
    function passes(res) {
        const last = res.log[res.log.length - 1];
        const required = Math.max(0, last.spendGoal - (last.guaranteedIncome ?? 0));
        if ((last.portfolioBalance ?? 0) < required) return false;
        // GK stability floor (see gkSpendStable) — rejects spends GK only holds by slashing.
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

    // Phase 22: Guyton-Klinger — single entry using user's guardrail settings.
    // Label shows the actual guard/adjust knobs, e.g. "Grd:20 Adj:10".
    const gkLabel = `Grd:${Math.round((base.gkGuard ?? 0.20) * 100)} Adj:${Math.round((base.gkAdjPct ?? 0.10) * 100)}`;
    push('Guyton-Klinger', gkLabel, 0,
        { strategy: 'gk', gkGuard: base.gkGuard, gkAdjPct: base.gkAdjPct, maxConversion: maxConv });

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
// decodes back exactly (k/m/b suffix or scientific). Self-contained — no DisplayHelpers
// dependency — so it is unit-testable in the node vm context. Returns the raw string when
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
    module.exports = { simulate, optimizeSpend, getLTCGBracketRoom, compactNum, afterTaxNetWorth };
}


