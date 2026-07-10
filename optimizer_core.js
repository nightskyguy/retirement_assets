// CONFIGURATION CONSTANTS
// ============================================================================

// Version constant - increment this when data structure changes
const SCENARIO_VERSION = 4;

// New storage key for current version scenarios
const STORAGE_KEY = 'SLCRetireOptimizeScenario';

// Old storage key from previous version
const OLD_STORAGE_KEY = 'retirementScenarios';

// Spend optimizer constants
const SPEND_SEARCH_CEILING   = 1.50;  // Binary search upper bound: 150% above baseline spend (2.5× input)
const SPEND_SEARCH_TOLERANCE = 0.005; // Stop binary search when bounds are within 0.5%
const SPEND_SEARCH_MIN_DELTA = 0.03;  // Minimum improvement to show "increase spending" banner

// Feature flags
// NERD_KNOBS: shows advanced controls (Monte Carlo params, optimizer objective/score, ACA, etc.).
// Enabled via ?nerdknob URL param, OR flipped at runtime by the hidden Documentation-page checkbox
// (see setNerdKnob / applyNerdKnobVisibility). Therefore a `let`, not a `const` — it can change
// after load. The runtime flip is NOT persisted to the URL.
let NERD_KNOBS = new URLSearchParams(location.search).has('nerdknob');

// Optimizer UI state — replaces window.optimizer* globals.
const OptimizerState = {
    results: null,
    baseline: null,
    sortState: { colKey: 'afterTaxNW', direction: 'desc' },
    showInfeasible: false,
    showFailed: false,
    objective: 'balanced',
    perfStats: null,
    noSolutionFloor: null,
};

// Optimizer "what do you want to maximize?" objectives (nerd-mode only, item 9).
// Each maps to a per-row metric + direction. 'balanced' is the default weighted Score and keeps
// the historical baseline-pick behavior; the others re-rank candidates AND re-pick the ⚓ baseline
// under that single metric. metric(r) returns a comparable number; higher `dir` wins when desc.
const OPT_OBJECTIVES = {
    balanced:  { label: 'Balanced (default)',          metric: r => r._baselineScore ?? -Infinity,                 dir: 'desc' },
    legacy:    { label: 'Maximum Legacy',              metric: r => r.afterTaxNWCurrentDollars ?? -Infinity,       dir: 'desc' },
    spend:     { label: 'Maximum Spend',               metric: r => r.totals?.spendCurrentDollars ?? -Infinity,    dir: 'desc' },
    mintax:    { label: 'Minimal Taxes',               metric: r => r.totals?.taxCurrentDollars ?? Infinity,       dir: 'asc'  },
    roth:      { label: 'Maximum Roth',                metric: r => r.totals?.terminal?.roth ?? -Infinity,         dir: 'desc' },
    conveffect:{ label: 'Roth Conversion Effectiveness', metric: r => r._convSavings ?? -Infinity,                 dir: 'desc' },
};

// Returns rows ranked best→worst under an objective. Successful rows always outrank failed ones
// (a depleted plan can show inflated terminal wealth), matching the table sort tiebreak.
function rankRowsByObjective(rows, objKey) {
    const obj = OPT_OBJECTIVES[objKey] || OPT_OBJECTIVES.balanced;
    const sign = obj.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
        const sa = a.totals?.success ? 1 : 0, sb = b.totals?.success ? 1 : 0;
        if (sa !== sb) return sb - sa;
        return sign * (obj.metric(a) - obj.metric(b));
    });
}

// Flip the nerd-knob at runtime and re-apply every gated UI surface. Called by the hidden
// Documentation-page checkbox. Not persisted to the URL.
function setNerdKnob(on) {
    NERD_KNOBS = !!on;
    applyNerdKnobVisibility();
}

// Re-runs all NERD_KNOBS-gated UI so toggling at runtime matches a fresh ?nerdknob load.
function applyNerdKnobVisibility() {
    // Avg BETR summary stat (Kitces metric)
    const betrWrap = document.getElementById('stat-betr-wrap');
    if (betrWrap) betrWrap.style.display = NERD_KNOBS ? '' : 'none';
    // Optimizer objective selector
    const objWrap = document.getElementById('opt-objective-wrap');
    if (objWrap) objWrap.style.display = NERD_KNOBS ? '' : 'none';
    // Cycle Brokerage LTCG bracket target (0%/15%)
    const cycleLTCGWrap = document.getElementById('cycleLTCGTarget-wrap');
    if (cycleLTCGWrap) cycleLTCGWrap.style.display = NERD_KNOBS ? '' : 'none';
    // Docs: ACA Cliff strategy discussion paragraph (nerd-only strategy)
    const docAcaCliff = document.getElementById('doc-aca-cliff');
    if (docAcaCliff) docAcaCliff.style.display = NERD_KNOBS ? '' : 'none';
    // Monte Carlo nerd panels (initMCTab reads _mcNerdMode() → NERD_KNOBS)
    if (typeof initMCTab === 'function') initMCTab();
    // Strategy panel (GK params gated) + bracket dropdown (ACA options gated, item 12)
    if (typeof toggleStrategyUI === 'function') toggleStrategyUI();
    if (typeof refreshStratRateOptions === 'function') refreshStratRateOptions();
    // Re-render optimizer table if a run exists (adds/removes Score, Rank, objective re-rank)
    if (OptimizerState.results && typeof renderOptimizerTable === 'function') {
        renderOptimizerTable(OptimizerState.results);
    }
    // Keep the hidden checkbox in sync (e.g. when ?nerdknob set it true at load)
    const cb = document.getElementById('secret-nerdknob');
    if (cb) cb.checked = NERD_KNOBS;
}

// Optimizer objective setter — wired to the nerd-mode <select id="opt-objective">.
function setOptObjective(key) {
    OptimizerState.objective = OPT_OBJECTIVES[key] ? key : 'balanced';
    if (OptimizerState.results) {
        recomputeBaselineForObjective();
        renderOptimizerTable(OptimizerState.results);
    }
}

// Picks the ⚓ baseline (best no-conversion / no-cyclic successful row) under the active objective,
// then recomputes every row's Δ columns against it. 'balanced' reproduces the historical pick
// (highest weighted Score). Called by runOptimizer and whenever the objective changes.
function recomputeBaselineForObjective() {
    const results = OptimizerState.results;
    if (!results) return;
    const noConvSuccesses = results.filter(r => r._isNoConv && r.totals.success);
    OptimizerState.baseline = noConvSuccesses.length > 0
        ? rankRowsByObjective(noConvSuccesses, OptimizerState.objective)[0]
        : null;
    const baselineRow = OptimizerState.baseline;
    for (const r of results) {
        r._dNW  = baselineRow ? (r.afterTaxNW   - baselineRow.afterTaxNW)   : null;
        r._dTax = baselineRow ? (baselineRow.totals.tax - r.totals.tax)     : null;
        r._dNWCurrent  = baselineRow ? (r.afterTaxNWCurrentDollars - baselineRow.afterTaxNWCurrentDollars) : null;
        r._dTaxCurrent = baselineRow ? (baselineRow.totals.taxCurrentDollars - r.totals.taxCurrentDollars) : null;
    }
}



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
        const iraGoalNominal = inputs.iraBaseGoal * cpiRate;
        fixedWithdrawal = calculateAmortizedWithdrawal(balance.IRA1 + balance.IRA2, iraGoalNominal, amortYears, inputs.growth)

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
        let age1 = currentYear - birthyear1;
        let age2 = currentYear - birthyear2;
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
        let IRMAA = calcIRMAA(magiLookback, status, cpiRate, medicareRate, onMedicare);
        // Tier for display/milestones — same lookback MAGI and same age gate as the charge
        // (the log row used to recompute this AFTER the year's MAGI push, showing the tier a
        // year early).
        let IRMAATier = onMedicare > 0 ? getIRMAATier(magiLookback, status, cpiRate) : '-none-';
        // Base Medicare Part B + Part D premiums (informational — tracked, not deducted from
        // spendable; assumed to live inside the spend goal). Grows at CPI + Inflation (user inputs),
        // not CPI alone.
        const medicareBase = onMedicare * (TAXData.IRMAA.standardPartB + TAXData.IRMAA.standardPartD) * 12 * medicareRate;

        // Calculate the bracket limits based on: stated limit.
        // let tgtBracketLimit = findLimitByRate('FEDERAL',status,inputs.stratRate)

        // Find federal & state rates and limits by spending goal:
        let goalFedBracketLimit = findUpperLimitByAmount('FEDERAL', status, spendGoal, cpiRate)
        let goalStateBracketLimit = findUpperLimitByAmount(STATEname, status, spendGoal, cpiRate)
        let goalLimit = Math.min(goalFedBracketLimit.limit, goalStateBracketLimit.limit)
        let IRMAABracket = findUpperLimitByAmount('IRMAA', status, goalLimit, cpiRate)
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
        let ssReduction = (inputs.ssFailYear > 2000 && currentYear >= inputs.ssFailYear) ? inputs.ssFailPct : 1;
        let potentialS1 = (age1 >= inputs.ss1Age) ? inputs.ss1 * cpiRate * ssReduction : 0;
        let potentialS2 = (age2 >= inputs.ss2Age) ? inputs.ss2 * cpiRate * ssReduction : 0;
        let s1 = alive1 ? potentialS1 : 0;
        let s2 = alive2 ? potentialS2 : 0;
        let pension = (age1 >= (inputs.pensionStartAge || 0))
            ? inputs.pensionAnnual * (inputs.pensionCola ? inflation : 1)
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
                ? rawSurvivorMonthly * 12 * cpiRate * ssReduction
                : 0;
            s2 = 0;
        }
        let fixedInc = s1 + s2;					// Social Security
        let taxableInc = pension;				// Pensions, W2, RMDs, IRA withdrawals, wdBrokerage

        // These will be APPROXIMATE worst case - no Withdrawals have been made.
        let taxableInterest = balance.Cash * inputs.cashYield
        let taxableDividends = balance.Brokerage * inputs.dividendRate


        // 3. RMDs and QCDs
        let rmd1Pct = getRMDPercentage(currentYear, birthyear1);
        let rmd2Pct = getRMDPercentage(currentYear, birthyear2);
        let rmd1 = alive1 ? balance.IRA1 * rmd1Pct || 0 : 0;
        let rmd2 = alive2 ? balance.IRA2 * rmd2Pct || 0 : 0;
        rmd1Pct = Math.max(rmd1Pct, rmd2Pct, 0);
        rmd1Pct = Math.max(rmd1Pct, rmd2Pct, 0);

        // QCDs: leave IRA tax-free to charity (age 70.5+). Satisfy RMDs without adding to taxable income/MAGI.
        // Provisional MAGI estimate (IRA withdrawals unknown here; uses pension+RMD+SS+interest/divs).
        const qcdLimit = getQCDLimit(currentYear, inputs.cpi);
        const provisionalMAGI = taxableInc + rmd1 + rmd2 + 0.85 * (s1 + s2) + taxableInterest + taxableDividends;
        const { qcd1, qcd2, totalQCD } = computeAnnualQCDs(inputs, balance, currentYear, qcdLimit, provisionalMAGI, cpiRate, alive1, alive2, status);

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
                gkIWR = spendGoal / gkPrevPortfolio;
                gkAdjLabel = '';
            } else {
                const _guard  = inputs.gkGuard  ?? 0.20;
                const _adjP   = inputs.gkAdjPct ?? 0.10;
                const labels  = [];
                // Inflation Rule: skip CPI if prior return negative AND already over IWR
                if (gkPriorReturn < 0 && spendGoal / gkPrevPortfolio > gkIWR) {
                    labels.push('no-CPI');
                } else {
                    spendGoal *= (1 + yearInflation);
                }
                // Guardrail checks on (possibly inflation-adjusted) spend
                const _cwr = spendGoal / gkPrevPortfolio;
                if (_cwr > gkIWR * (1 + _guard)) {
                    spendGoal *= (1 - _adjP);
                    labels.push(`−${(_adjP * 100).toFixed(0)}%cap`);
                } else if (_cwr < gkIWR * (1 - _guard)) {
                    spendGoal *= (1 + _adjP);
                    labels.push(`+${(_adjP * 100).toFixed(0)}%pros`);
                }
                gkAdjLabel = labels.join(' ') || '';
            }
        }

        // GK bypasses goalLimit (bracket ceiling) — spend is dynamically set by GK rules
        const isGKStrategy = inputs.strategy === 'gk';
        let targetSpend = (isBracketStrategy || isOrderedStrategy || isGKStrategy) ? spendGoal : Math.min(spendGoal, goalLimit);
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
                if (subCycleIRAYears >= _cycN) {
                    isBrokerageYear = true;
                    subCycleIRAYears = 0;
                } else {
                    subCycleIRAYears++;
                }
            } else {
                subCycleIRAYears++;   // Brokerage depleted; keep counting IRA years
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
            const _targetRoom = getLTCGBracketRoom(_baseOrdinaryInc, status, _cycleTargetRate, cpiRate);
            const _targetNetRoom = _targetRoom * (1 - capGainsPercentage * capitalGainsRate);
            let _brokerageNetTarget;
            if (additionalSpendNeeded <= _targetNetRoom) {
                // Spend fits inside the target bracket — max it out anyway.
                _brokerageNetTarget = _targetNetRoom;
            } else {
                // Spend forces gains beyond the target bracket. Find which LTCG bracket the
                // forced realization lands in and top off to that bracket's own ceiling.
                const _spendGrossNeeded = additionalSpendNeeded / Math.max(0.01, 1 - capGainsPercentage * capitalGainsRate);
                const _landedRate = getLTCGBracketTopRate(_baseOrdinaryInc, _spendGrossNeeded, status, cpiRate);
                const _ltcgRates = (TAXData.FEDERAL.CAPITAL_GAINS[status]?.brackets ?? []).map(b => b.r);
                const _nextRate = _ltcgRates.find(r => r > _landedRate);
                let _room = (_nextRate !== undefined)
                    ? getLTCGBracketRoom(_baseOrdinaryInc, status, _nextRate, cpiRate)
                    : _spendGrossNeeded;   // already in the top LTCG bracket — no higher ceiling to top off to
                if (inputs.strategy === 'bracket' || inputs.strategy === 'minlimit' || inputs.strategy === 'aca') {
                    // Don't let the LTCG top-off push total realized income past the active
                    // strategy's own ceiling (IRMAA tier / ACA cliff / bracket ceiling). This
                    // branch (isBrokerageYear) runs INSTEAD of the ceiling-computing branch this
                    // year, so compute it fresh here rather than reading a stale/undefined `limit`.
                    const _ceil = computeBracketCeiling(inputs, status, cpiRate, inflation, STATEname, age1, age2, alive1, alive2, IRMAALimit).limit;
                    _room = Math.min(_room, Math.max(0, _ceil - _baseOrdinaryInc));
                }
                _brokerageNetTarget = Math.max(additionalSpendNeeded, _room * (1 - capGainsPercentage * capitalGainsRate));
            }
            if (_brokerageNetTarget > 1 && curBalances.Brokerage > 0) {
                // Depletion check: warn if Brokerage < 50% of what we need
                const _grossNeeded = _brokerageNetTarget / Math.max(0.01, 1 - capGainsPercentage * capitalGainsRate);
                if (curBalances.Brokerage < _grossNeeded * 0.5) {
                    subCycleLabel = '⚠Brok';
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
            let amortized = Math.max(0, fixedWithdrawal - totalIRAForcedWithdrawals);

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
                computeBracketCeiling(inputs, status, cpiRate, inflation, STATEname, age1, age2, alive1, alive2, IRMAALimit));

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
            filingStatus: status, ages: [age1, age2], birthyears: [birthyear1, birthyear2],
            totalSS: s1 + s2, IRMAAAnnualCost: IRMAA,
            earnedIncome: pension + taxableRMD + netWithdrawals.IRA + taxableInterest, inflation: cpiRate,
            pensionIncome: pension, iraIncome: taxableRMD + netWithdrawals.IRA,
            qualifiedDiv: taxableDividends, capGains: capitalGains, hsaContrib: 0,
            taxExemptInterest: 0, state: STATEname
        })
        inspectForErrors(tax)  // See if any numbers look fishy.

        marginalFedTaxRate = tax.federalMarginalRate;
        marginalStateTaxRate = tax.stateMarginalRate;
        capitalGainsRate = tax.capitalGainsRate;

        //!!! Assume MAGI for prior to years is the same as this year. Should allow this to be entered

        let magiHistoryLength = balance.magiHistory.length
        if (magiHistoryLength < 1) {
            balance.magiHistory.push(tax.MAGI);
            balance.magiHistory.push(tax.MAGI);
            // Year 0 read undefined MAGI at the lookback above (no history existed yet), forcing
            // IRMAA to $0/'-none-' regardless of actual income. Retroactively correct THIS year's
            // charge now that tax.MAGI is known — steady-state assumption per the comment above,
            // still "computed once at charge time" (doesn't reintroduce the prior tier-lag bug).
            IRMAA = calcIRMAA(tax.MAGI, status, cpiRate, medicareRate, onMedicare);
            IRMAATier = onMedicare > 0 ? getIRMAATier(tax.MAGI, status, cpiRate) : '-none-';
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
                const seq = resolveOrderedSeq(inputs.orderedSeq, { capGainsPercentage, capitalGainsRate, nominalStateTaxAtLimit, nominalTaxRate, marginalFedTaxRate, marginalStateTaxRate });
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
            filingStatus: status, ages: [age1, age2], birthyears: [birthyear1, birthyear2],
            totalSS: s1 + s2, IRMAAAnnualCost: IRMAA,
            earnedIncome: pension + taxableRMD + netWithdrawals.IRA + taxableInterest, inflation: cpiRate,
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
                const seq = resolveOrderedSeq(inputs.orderedSeq, { capGainsPercentage, capitalGainsRate, nominalStateTaxAtLimit, nominalTaxRate, marginalFedTaxRate, marginalStateTaxRate });
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
                earnedIncome: pension + taxableRMD + netWithdrawals.IRA + taxableInterest, inflation: cpiRate,
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
                    earnedIncome: pension + taxableRMD + netWithdrawals.IRA + taxableInterest, inflation: cpiRate,
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

        cumulativeTaxes += totalTax;


        totalIncome = Math.max(1, fixedInc + netWithdrawals.IRA + pension + taxableDividends +
            taxableInterest + netWithdrawals.Roth + netWithdrawals.Cash +
            netWithdrawals.Brokerage + taxableRMD);

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
                    earnedIncome: pension + taxableRMD + Math.max(0, netWithdrawals.IRA - G) + taxableInterest, inflation: cpiRate,
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
            cumulativeTaxes -= (totalTax - _newTotalTax);
            const _netRemoved = G - (totalTax - _newTotalTax);
            totalTax = _newTotalTax;
            totalIncome = Math.max(1, totalIncome - G);
            netIncome -= _netRemoved;
            nominalTaxRate = tax.nominalRate;
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
                    IRMAAAnnualCost: 0, earnedIncome: _baseEI + _gross, inflation: cpiRate,
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
                cumulativeTaxes += incrementalExtraConvTax;
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
                IRMAAAnnualCost: 0, earnedIncome: convShadowEI, inflation: cpiRate,
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
                IRMAAAnnualCost: 0, earnedIncome: excessShadowEI, inflation: cpiRate,
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
        totals.taxCurrentDollars += totalTax / inflation;
        totals.spendCurrentDollars += (targetSpend + surplus.Shortfall) / inflation;
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
        let totalWealth = (balance.IRA1 + balance.IRA2) * (1 - nominalTaxRate)
            + Math.max(0, balance.Brokerage - balance.BrokerageBasis) * (1 - capitalGainsRate)
            + balance.Roth1 + balance.Roth2 + balance.Cash + balance.BrokerageBasis

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
        const _wdRate = (prevTotalWealth != null && prevTotalWealth > 0)
            ? (_netOutflows - _yearInflows) / prevTotalWealth : null;

        const loopMs = performance.now() - loopStart;
        log.push(buildSimYearLogRecord({
            currentYear, alive1, alive2, age1, age2, status,
            fixedInc, pension, targetSpend, netIncome, totalIncome,
            surplus, totalRMD, qcd1, qcd2, taxableDividends, taxableInterest,
            netWithdrawals, rmd1, rmd2, totalConverted, tax, IRMAA, IRMAATier, medicareBase, cpiRate,
            totalTax, capitalGains, cumulativeTaxes, bracketTarget, bracketOverage, forcedIRA, acaBreach,
            balance, nominalTaxRate, totalWealth, portfolioBalance, guaranteedIncome,
            totalsSpend: totals.spend,
            gains, rmd1Pct, subCycleLabel, convNetValue: null, excessNetValue: null,
            incrementalConvTax, incrementalExcessTax, yearBETR, yearBETRflag,
            extraConvGross,
            grossOutflows: _grossOutflows, netOutflows: _netOutflows,
            yearInflows: _yearInflows, wdRate: _wdRate,
            useEarly: _useEarly, timingReason,
            strategy: inputs.strategy, spendGoal, gkAdjLabel, inflation, loopMs
        }));
        totals.totalTime += log[log.length - 1].loopMs;
        prevTotalWealth = totalWealth;
        gkPrevPortfolio = portfolioBalance;  // raw sum; keep GK checks apples-to-apples
        // Advance spend goal: apply user's spend-change preference and inflation.
        // spendDelta is constant (1 + inputs.spendChange); moving this to end of loop
        // keeps year-0 spendGoal equal to the user's input in today's dollars.
        // Phase 22: GK handles inflation at start of next year via its own rules; only apply spendDelta here.
        if (inputs.strategy === 'gk') {
            gkPriorReturn = baseReturn;
            spendGoal = spendGoal * spendDelta;
        } else {
            spendGoal = spendGoal * spendDelta * (1 + yearInflation);
        }

        currentYear += 1;

        // Adjust inflation rates for subsequent rounds.
        cpiRate *= (1 + inputs.cpi);
        inflation *= (1 + yearInflation);
        medicareRate *= (1 + inputs.cpi + inputs.inflation)
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
    totals.capGainsRate = capitalGainsRate;
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
    const _strat = (() => {
        const raw = val('stratRate') ?? '';
        if (/^irmaa/i.test(raw)) {
            return { stratRate: 0, stratIRMAATier: +raw.replace(/irmaa/i, ''), stratACAMultiple: 0 };
        }
        if (raw.startsWith('aca')) {
            return { stratRate: 0, stratIRMAATier: -1, stratACAMultiple: +raw.replace('aca', '') };
        }
        return { stratRate: +raw / 100.0, stratIRMAATier: -1, stratACAMultiple: 0 };
    })();
    // ACA is a STRICT-cap strategy internally. The UI keeps ACA as a "Fill Bracket" sub-option
    // (stratRate=aca<N>), so derive strategy='aca' whenever an ACA multiple is selected. This
    // also makes legacy scenarios/URLs (strategy=bracket + aca<N>) load with strict semantics.
    let _strategy = val('strategy');
    if (_strat.stratACAMultiple > 0 && (_strategy === 'bracket' || _strategy === 'minlimit')) {
        _strategy = 'aca';
    }
    return {
        STATEname: val('STATEname'),
        strategy: _strategy,
        orderedSeq: val('orderedSeq') || 'CBIR',
        nYears: +val('nYears'),
        ..._strat,
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
        pensionStartAge: +val('pensionStartAge') || 0,
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
        cycleLTCGTarget: +(val('cycleLTCGTarget') ?? 0.15),
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
        qcdHHMax: +val('qcdHHMax') || 0,
        qcdMode: valChecked('qcdAlways') ? 'always' : 'asneeded',
        gkGuard:  +val('gkGuard')  / 100 || 0.20,
        gkAdjPct: +val('gkAdjPct') / 100 || 0.10,
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
    const growthRate = (+val('growth') / 100) || 0.06;

    function ageInfo(birthYear, birthMonth, iraBalance) {
        if (!birthYear) return null;
        const age = currentYear - birthYear - (currentMonth <= birthMonth ? 1 : 0);
        const rmdAge = birthYear >= 1960 ? 75 : 73;
        let rmdStr = `RMD starts ${rmdAge}`;
        if (iraBalance > 0) {
            const yearsTo = rmdAge - age;
            let firstRMD;
            if (yearsTo <= 0) {
                const factor = RMD_TABLE[Math.min(age, 120)] ?? 2.0;
                firstRMD = iraBalance / factor;
            } else {
                const projIRA = iraBalance * Math.pow(1 + growthRate, yearsTo);
                const factor = RMD_TABLE[rmdAge] ?? 26.5;
                firstRMD = projIRA / factor;
            }
            rmdStr += ` | ~$${Math.round(firstRMD).toLocaleString()}/yr`;
        }
        return `Age ${age} | ${rmdStr}`;
    }

    const el1 = document.getElementById('age-display-1');
    if (el1) el1.textContent = ageInfo(+val('birthyear1'), +val('birthmonth1') || 12, +val('IRA1') || 0) ?? '';

    const el2 = document.getElementById('age-display-2');
    if (el2) el2.textContent = ageInfo(+val('birthyear2'), +val('birthmonth2') || 12, +val('IRA2') || 0) ?? '';
    updateACAWarning();
}

// IRA Goal suggestion — IRA balance today whose RMDs ≈ the spend goal at age 84.
// Mirrors the After-Tax Spend ⓘ pattern (computeSuggestedSpend / applySuggestSpend).
let _priorIraGoal = null;

function computeSuggestedIraGoal() {
    try {
        const age1 = new Date().getFullYear() - (+val('birthyear1'));
        const growth = +val('growth') / 100;
        const spendGoal = +val('spendGoal');
        const targetAge = 84;
        const yearsUntil = targetAge - age1;
        if (yearsUntil <= 0 || spendGoal <= 0 || !RMD_TABLE[targetAge]) return null;
        const rmdPctAtTarget = 1 / RMD_TABLE[targetAge];   // RMD fraction at target age
        const targetAtAge = spendGoal / rmdPctAtTarget;    // balance whose RMD = spend goal
        const targetNow = targetAtAge / Math.pow(1 + growth, yearsUntil);  // discount to today
        return { value: Math.round(targetNow), targetAge, rmdPctAtTarget, yearsUntil, growth };
    } catch (e) { return null; }
}

// Keep the existing name — runSimulation() already calls this. Now drives the ⓘ icon, not a hint div.
function updateIRAGoalHint() {
    const icon = document.getElementById('suggest-ira-icon');
    if (!icon) return;
    const sug = computeSuggestedIraGoal();
    if (!sug) { icon.style.display = 'none'; return; }
    icon.style.display = '';
    icon.title = _priorIraGoal !== null
        ? `Restore: $${Math.round(_priorIraGoal).toLocaleString()}`
        : `Suggested IRA Goal: $${sug.value.toLocaleString()} — IRA balance today whose RMDs ≈ your spend goal at age ${sug.targetAge} (${(sug.rmdPctAtTarget * 100).toFixed(2)}% RMD, ${sug.yearsUntil} yrs at ${(sug.growth * 100).toFixed(1)}% growth). Click to apply.`;
}

function applySuggestIraGoal() {
    if (_priorIraGoal !== null) {
        DisplayHelpers.setDollarValue('iraBaseGoal', Math.round(_priorIraGoal));
        _priorIraGoal = null;
    } else {
        const sug = computeSuggestedIraGoal();
        if (!sug) return;
        const el = document.getElementById('iraBaseGoal');
        _priorIraGoal = parseFloat((el?.dataset?.numVal) || (el?.value || '').replace(/[^\d.-]/g, '') || '0');
        DisplayHelpers.setDollarValue('iraBaseGoal', sug.value);
    }
    updateIRAGoalHint();
    runSimulation();
}

function runSimulation() {
    refreshStratRateOptions();   // keep bracket dropdown labels in sync with CPI + filing status
    // computeOC: single-scenario runs also produce the Opp. Cost counterfactual (Break Even).
    let res = simulate({ ...getInputs(), computeOC: true });
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
    if (OptimizerState.results) renderOptimizerTable(OptimizerState.results);
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

let _lastOptimizerHash = null;

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

function runOptimizer() {
    const base = getInputs();
    const currentHash = JSON.stringify(base)
        + ';optimizeSpend=' + (document.getElementById('optimizeSpend')?.checked ?? false)
        + ';convOpt=' + (document.getElementById('includeConvOpt')?.checked ?? false);
    if (currentHash === _lastOptimizerHash && OptimizerState.results) {
        renderOptimizerTable(OptimizerState.results);
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

    function addResult(strategyLabel, paramLabel, paramSortVal, overrides, noConv = false) {
        const inputs = Object.assign({}, base, overrides);
        const res = simulate(inputs);
        const lastEntry = res.log[res.log.length - 1];
        const totalYears = res.log.length;
        const ovYears = res.log.filter(e => (e['BracketOverage'] ?? 0) > 0).length;
        const bracketOveragePct = totalYears > 0 ? ovYears / totalYears : 0;
        const isBracketInfeasible = overrides.strategy === 'bracket' && bracketOveragePct > 0.5;
        // ACA is strict: any year its FPL cap can't fund spending makes the plan untenable
        // (the subsidy is forfeited rather than the cap being broken).
        const acaBreachYears = res.totals?.acaBreachYears ?? 0;
        const isACAUntenable = overrides.strategy === 'aca' && acaBreachYears > 0;
        const row = {
            _id: results.length,
            _isNoConv: noConv,
            _strategyLabel: strategyLabel + (overrides.maxConversion ? ' ✓' : '') + (noConv ? ' (no conv)' : '') + ((isBracketInfeasible || isACAUntenable) ? ' ⚠️' : ''),
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
            _isACAUntenable: isACAUntenable,
            _acaBreachYears: acaBreachYears,
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
    const IRMAATierLabels = ['Below IRMAA', 'Tier 1 ceil', 'Tier 2 ceil', 'Tier 3 ceil', 'Tier 4 ceil'];
    for (let tier = 0; tier <= 4; tier++) {
        addResult('IRMAA Ceil', IRMAATierLabels[tier], tier - 0.5, { strategy: 'bracket', stratRate: 0, stratIRMAATier: tier, stratACAMultiple: 0, maxConversion: maxConv });
    }

    // Fill bracket — ACA FPL cliffs. Nerd-mode only (item 12): the ACA cliff model is rough, so it
    // is excluded from the optimizer sweep unless ?nerdknob is on. Also skipped when both persons
    // are 65+ at retirement start (on Medicare → ACA income limits are irrelevant).
    const acaDisabled = bothOnMedicareAtStart(base.birthyear1, base.startAge, !!base.hasSpouse,
        base.hasSpouse ? (base.birthyear2 || 0) : 0);
    if (NERD_KNOBS && !acaDisabled) {
        const acaMultiples = [200, 250, 300, 400];
        const acaLabels = { 200: '200% FPL', 250: '250% FPL', 300: '300% FPL', 400: '400% FPL ⚠️' };
        for (const pct of acaMultiples) {
            addResult('ACA Cliff', acaLabels[pct], 50 + pct / 100, { strategy: 'aca', stratRate: 0, stratIRMAATier: -1, stratACAMultiple: pct, maxConversion: maxConv });
        }
    }

    // IRA Draw — fixed % of IRA balance each year
    for (const pct of [5, 6, 7, 8, 10, 12, 15, 20]) {
        addResult('IRA Draw', `${pct}%`, pct, { strategy: 'fixedpct', iraWithdrawPct: pct / 100, maxConversion: maxConv });
    }

    // Ordered — strict account sequence
    for (const seq of ['CBIR', 'RIBC', 'BIRC']) {
        addResult('Ordered', seq, seq, { strategy: 'ordered', orderedSeq: seq, maxConversion: maxConv });
    }

    // Guyton-Klinger — label shows the actual guard/adjust knobs, e.g. "Grd:20 Adj:10".
    const gkOptLabel = `Grd:${Math.round((base.gkGuard ?? 0.20) * 100)} Adj:${Math.round((base.gkAdjPct ?? 0.10) * 100)}`;
    addResult('Guyton-Klinger', gkOptLabel, 0, { strategy: 'gk', gkGuard: base.gkGuard, gkAdjPct: base.gkAdjPct, maxConversion: maxConv });

    // Snapshot the non-cyclic strategy families before the cyclic pass appends to the list.
    // Reused below to build the no-conversion baseline sweep over the same families.
    const baseFamilies = strategyOverridesList.slice();

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
    OptimizerState.noSolutionFloor = null;
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
                OptimizerState.noSolutionFloor = Math.max(500, base.spendGoal * 0.02);
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

    // Baseline accounting — no-conversion / no-cyclic sweep over the same families.
    // These rows force conversions off (maxConversion=false, extraConversionAmount=0) and
    // cyclic brokerage maneuvering off, so the best of them is the honest "do it without
    // Roth or brokerage antics" reference every other strategy is measured against.
    for (const fam of baseFamilies) {
        addResult(fam.strategyLabel, fam.paramLabel, fam.paramSortVal,
            { ...fam.overrides, maxConversion: false, cyclicEnabled: false, extraConversionAmount: 0, qcdHHMax: 0 }, true);
    }

    // After-tax net worth for every row, using one shared future-IRA rate so deltas are fair.
    const sharedFutureIRARate = base.futureIRATaxRate ?? (results[0]?.totals.futureIRARate ?? 0);
    for (const r of results) {
        r.afterTaxNW = afterTaxNetWorth(r.totals.terminal, sharedFutureIRARate, r.totals.capGainsRate);
        // Current-dollars variant: scale by the same deflation factor as raw final wealth.
        const _defl = (r.finalNW && r.finalNW !== 0) ? (r.finalNWCurrentDollars / r.finalNW) : 1;
        r.afterTaxNWCurrentDollars = r.afterTaxNW * _defl;
    }

    // Baseline score = after-tax terminal wealth (bequest) + lifetime money actually spent
    // (spendable weighted +10%, since a dollar enjoyed in retirement outranks a dollar bequeathed).
    // Both in current (real) dollars so the stock (NW) and the spend flow share one basis. Ranking
    // on this — instead of NW alone — stops a spend-cutting strategy (e.g. GK) from "winning" by
    // hoarding: under-spending lifts terminal NW but loses weighted spendable. (Tax is already
    // netted out — afterTaxNW and spendable are both after-tax — so it is not subtracted again.)
    const SPENDABLE_WEIGHT = 1.10;
    for (const r of results) {
        r._baselineScore = (r.afterTaxNWCurrentDollars ?? 0)
            + SPENDABLE_WEIGHT * (r.totals.spendCurrentDollars ?? 0);
    }

    // Pick the ⚓ baseline (best no-conv successful row) under the active objective, and compute
    // every row's Δ columns against it. 'balanced' (default) reproduces the historical weighted-score
    // pick; a nerd-mode objective (item 9) re-picks the baseline under that single metric.
    OptimizerState.results = results;
    recomputeBaselineForObjective();

    // Update top-bar stats using the 0% propwd/no-maxConv row (first result, equivalent to baseline)
    const baseline = results[0];
    if (baseline) {
        updateStats(baseline.totals, baseline.finalNW, baseline.finalNWCurrentDollars);
    }

    OptimizerState.perfStats = { totalMs: performance.now() - optimizerStart, runsCount: simulationCount };
    OptimizerState.sortState = { colKey: 'afterTaxNW', direction: 'desc' };
    renderOptimizerTable(results);
    renderSpendOptimizerBanner(results, base.spendGoal);
    showTab('tab-opt');
}

function renderSpendOptimizerBanner(results, baseSpendGoal) {
    const el = document.getElementById('opt-spend-banner');
    if (!el) return;

    // No-solution case: reverse search ran but even the floor (10% of baseline) failed
    if (OptimizerState.noSolutionFloor != null) {
        const floor = Math.round(OptimizerState.noSolutionFloor).toLocaleString();
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
        // innerHTML (not textContent) so the strategy label's markup (e.g. the red 🗘 cyclic span,
        // ✦/▼ glyphs) renders; the label is app-generated, not user input. Make it clickable to load.
        const label = `<span style="cursor:pointer;text-decoration:underline;" title="Click to load this strategy" onclick="loadOptimizerResult(${reverseRow._id})">${reverseRow._strategyLabel}</span>`;
        el.style.background = '#f8d7da';
        el.style.borderColor = '#f5c6cb';
        el.style.color = '#721c24';
        el.innerHTML = `⚠️ No strategy can fund your current spend goal. The highest sustainable spending found is $${amt}/yr, with all years fully funded. (Strategy: ${label})`;
        el.style.display = 'block';
        return;
    }

    const optimized = results
        .filter(r => r._isSpendOptimized && r.totals.success)
        .sort((a, b) => b._spendGoal - a._spendGoal);
    const best = optimized[0];
    if (best && (best._spendGoal / baseSpendGoal - 1) >= SPEND_SEARCH_MIN_DELTA) {
        const amt = Math.round(best._spendGoal).toLocaleString();
        // innerHTML + clickable (see reverse branch above).
        const label = `<span style="cursor:pointer;text-decoration:underline;" title="Click to load this strategy" onclick="loadOptimizerResult(${best._id})">${best._strategyLabel}</span>`;
        el.style.background = '#fff3cd';
        el.style.borderColor = '#ffc107';
        el.style.color = '#856404';
        el.innerHTML = `💡 It appears you can increase your spending to $${amt}/yr with all years fully funded. (Strategy: ${label})`;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

// Column definitions (shared between render and sort)
function getOptimizerColumns() {
    const inC = () => document.getElementById('show-current-dollars')?.checked;
    const cols = [
        {
            key: 'status', label: '✓',
            title: 'Plan outcome. 🟢 = every year of the plan was fully funded. 🚨 = the portfolio ran out before the end (the plan failed). Failed plans always sort below successful ones.',
            getValue: r => r.totals.success ? '🟢' : '🚨',
            getSortValue: r => r.totals.success ? 1 : 0
        },
        {
            key: 'strategy', label: 'Strategy',
            title: 'Withdrawal strategy. ✓ = Maximize Conversions on. (no conv) = baseline variant with conversions and brokerage cycling off. 🗘/🔄 = cyclic IRA-first / brokerage-first. ⇌ = Optimize Conversions row. ✦ = Optimize Spend. ⚠️ = bracket target unreachable. Click any row to load it.',
            getValue: r => r._strategyLabel,
            getSortValue: r => r._strategyLabel
        },
        {
            key: 'param', label: 'Param',
            title: 'The strategy parameter: bracket/IRMAA/ACA ceiling, IRA draw %, amortization years, proportional boost %, or account order (CBIR/RIBC/BIRC).',
            getValue: r => r._paramLabel,
            getSortValue: r => r._paramSortVal
        },
        {
            key: 'spendGoal', label: 'Spend Goal',
            title: 'Annual after-tax spending this strategy targets (today\'s dollars). Normally your input; Optimize Spend (✦) rows show a higher sustainable figure found by search.',
            getValue: r => Math.round(r._spendGoal).toLocaleString(),
            getSortValue: r => r._spendGoal
        },
        {
            key: 'tax', label: 'Lifetime Tax',
            title: 'Total tax paid over the whole plan: federal (ordinary + capital gains + NIIT), state, and Medicare IRMAA surcharges. Toggle Future $/Current $ to switch between nominal and today\'s-dollar totals.',
            getValue: r => Math.round(inC() ? r.totals.taxCurrentDollars : r.totals.tax).toLocaleString(),
            getSortValue: r => inC() ? r.totals.taxCurrentDollars : r.totals.tax
        },
        {
            key: 'spend', label: 'Total Spendable',
            title: 'Total after-tax money available to spend over the whole plan (gross income minus tax). Toggle Future $/Current $ for nominal vs today\'s dollars.',
            getValue: r => Math.round(inC() ? r.totals.spendCurrentDollars : r.totals.spend).toLocaleString(),
            getSortValue: r => inC() ? r.totals.spendCurrentDollars : r.totals.spend
        },
        {
            key: 'afterTaxNW', label: 'NetWealth',
            title: 'After-tax terminal net worth: IRA × (1 − your expected future IRA rate), brokerage gains × (1 − cap-gains rate), Roth + Cash + basis at face. Uses ONE shared future-IRA rate across all rows so strategies compare on a level footing. This is the ranking metric. Toggle Future $/Current $ for nominal vs today\'s dollars.',
            getValue: r => Math.round(inC() ? (r.afterTaxNWCurrentDollars ?? 0) : (r.afterTaxNW ?? 0)).toLocaleString(),
            getSortValue: r => inC() ? (r.afterTaxNWCurrentDollars ?? 0) : (r.afterTaxNW ?? 0)
        },
        {
            key: 'dNW', label: 'ΔNetWealth',
            title: 'NetWealth minus the baseline (the strongest plan with no Roth conversions and no cyclic brokerage maneuvering). Positive (green) = this strategy ends wealthier after tax than that baseline; negative (red) = it ends behind it.',
            getValue: r => {
                const d = inC() ? r._dNWCurrent : r._dNW;
                if (d == null) return '—';
                const v = Math.round(d);
                const c = v > 0 ? '#1a7f37' : v < 0 ? '#cf222e' : '#57606a';
                return `<span style="color:${c}">${v > 0 ? '+' : ''}${v.toLocaleString()}</span>`;
            },
            getSortValue: r => (inC() ? r._dNWCurrent : r._dNW) ?? -Infinity
        },
        {
            key: 'dTax', label: 'ΔTax',
            title: 'Baseline lifetime tax minus this strategy\'s lifetime tax (each = federal incl. NIIT + state + IRMAA). Positive (green) = this strategy pays less total tax than the baseline; negative (red) = it pays more.',
            getValue: r => {
                const d = inC() ? r._dTaxCurrent : r._dTax;
                if (d == null) return '—';
                const v = Math.round(d);
                const c = v > 0 ? '#1a7f37' : v < 0 ? '#cf222e' : '#57606a';
                return `<span style="color:${c}">${v > 0 ? '+' : ''}${v.toLocaleString()}</span>`;
            },
            getSortValue: r => (inC() ? r._dTaxCurrent : r._dTax) ?? -Infinity
        },
        {
            key: 'rate', label: 'Tax Rate',
            title: 'Lifetime tax as a percentage of lifetime gross income (total tax ÷ total income). A blended effective rate across the whole plan.',
            getValue: r => `${(r.totals.tax / r.totals.gross * 100).toFixed(1)}%`,
            getSortValue: r => r.totals.tax / r.totals.gross
        },
        {
            key: 'years', label: 'Yrs Funded',
            title: 'Years fully funded out of years tested. Less than the full count means the plan fell short in some years (a failure).',
            getValue: r => `${r.totals.yearsfunded}/${r.totals.yearstested}`,
            getSortValue: r => r.totals.yearsfunded
        },
        {
            key: 'rmd', label: 'Total RMDs',
            title: 'Total Required Minimum Distributions forced out of traditional IRAs over the plan. Lower means the strategy drew down or converted the IRA earlier, shrinking later forced withdrawals.',
            getValue: r => Math.round(r.totals.rmd).toLocaleString(),
            getSortValue: r => r.totals.rmd
        },
        {
            key: 'rmdtax', label: 'RMD Tax%',
            title: 'Share of lifetime tax attributable to RMDs. High means forced IRA distributions are driving the tax bill — a signal that earlier conversions might help.',
            getValue: r => r.totals.tax > 0 ? `${(r.totals.rmdTax / r.totals.tax * 100).toFixed(0)}%` : '—',
            getSortValue: r => r.totals.rmdTax / (r.totals.tax || 1)
        },
        {
            key: 'betrAvg', label: 'Avg BETR',
            title: 'Average Break-Even Tax Rate across conversion years. If your expected future marginal rate exceeds this, conversions were advantageous on average. Appears for Optimize Conversions rows (⇌) and standard rows with conversions.',
            getValue: r => r.totals.betrAvg != null ? `${(r.totals.betrAvg * 100).toFixed(1)}%` : '—',
            getSortValue: r => r.totals.betrAvg ?? 999
        },
        {
            key: 'convSavings', label: 'Conv Savings',
            title: 'Lifetime tax savings from the additional IRA→Roth conversions run by Optimize Conversions, vs the same strategy with no extra conversions. Positive = converting more reduces your total lifetime tax bill.',
            getValue: r => r._convSavings != null ? '$' + Math.round(r._convSavings).toLocaleString() : '—',
            getSortValue: r => r._convSavings ?? -Infinity
        }
    ];
    // Nerd-only: expose the raw baseline-ranking score so the pinned ⚓ pick can be inspected.
    // Score = after-tax NetWealth + 1.1 × Total Spendable (today's dollars, real). Inserted right
    // after NetWealth since it is derived from NetWealth + Spendable.
    if (NERD_KNOBS) {
        const i = cols.findIndex(c => c.key === 'afterTaxNW');
        const objKey   = OptimizerState.objective || 'balanced';
        const objLabel = (OPT_OBJECTIVES[objKey] || OPT_OBJECTIVES.balanced).label;
        // Keep the raw weighted Score column (item 10), and add a Rank column that numbers rows
        // 1 (best) … N by the currently-selected objective (item 9). Rank is looked up from the
        // per-render map on OptimizerState; failed rows get '—'.
        cols.splice(i + 1, 0,
            {
                key: 'score', label: 'Score',
                title: 'Baseline-ranking score = after-tax NetWealth + 1.1 × Total Spendable (today\'s dollars). The pinned ⚓ baseline is the no-conversion strategy with the highest score; spending is weighted 10% above bequest. Always in current dollars. Nerd-mode column.',
                getValue: r => Math.round(r._baselineScore ?? 0).toLocaleString(),
                getSortValue: r => r._baselineScore ?? -Infinity
            },
            {
                key: 'rank', label: 'Rank',
                title: `Rank under the selected objective — "${objLabel}". 1 = best, N = worst among successful plans (failed plans show —). Change the objective with the "Optimize for" selector above. Nerd-mode column.`,
                getValue: r => (OptimizerState._rankMap && OptimizerState._rankMap[r._id]) ? OptimizerState._rankMap[r._id] : '—',
                getSortValue: r => (OptimizerState._rankMap && OptimizerState._rankMap[r._id]) ? OptimizerState._rankMap[r._id] : Infinity
            }
        );
    }
    return cols;
}

function renderOptimizerTable(results) {
    if (!results || results.length === 0) return;
    const columns = getOptimizerColumns();
    // Default: sort by After-Tax NW descending; Spendable descending as tiebreaker
    const sortState = OptimizerState.sortState ?? { colKey: 'afterTaxNW', direction: 'desc' };

    // Rank map (item 10): number successful rows 1 (best) … N under the active objective. Looked up
    // by the nerd-mode Rank column; failed rows are left unranked ('—').
    const _ranked = rankRowsByObjective(results.filter(r => r.totals.success), OptimizerState.objective);
    OptimizerState._rankMap = {};
    _ranked.forEach((r, idx) => { OptimizerState._rankMap[r._id] = idx + 1; });

    // Sort a copy; preserve original _id for click handlers.
    // Pull the baseline out of the body — it is rendered as a pinned reference row on top.
    const baselineRow = OptimizerState.baseline ?? null;
    // Infeasible (bracket-unreachable) rows are hidden by default — toggled via the legend.
    const showInfeasible = !!OptimizerState.showInfeasible;
    const showFailed = !!OptimizerState.showFailed;
    const infeasibleCount = results.filter(r => r._isBracketInfeasible || r._isACAUntenable).length;
    // Failed = the portfolio ran out of money (success===false). Hidden by default (item 11).
    const failedCount = results.filter(r => !r.totals.success).length;
    let display = results.filter(r => !(baselineRow && r._id === baselineRow._id));
    if (!showInfeasible) display = display.filter(r => !(r._isBracketInfeasible || r._isACAUntenable));
    if (!showFailed) display = display.filter(r => r.totals.success);
    const afterTaxCol = columns.find(c => c.key === 'afterTaxNW');
    const spendCol = columns.find(c => c.key === 'spend');
    const col   = columns.find(c => c.key === sortState.colKey);
    if (col) {
        display.sort((a, b) => {
            // Failed plans never outrank successful ones, whatever the sort column — a strategy
            // that runs out of money can show inflated terminal wealth (it left needs unfunded).
            const sa = a.totals.success ? 1 : 0, sb = b.totals.success ? 1 : 0;
            if (sa !== sb) return sb - sa;
            const av = col.getSortValue(a), bv = col.getSortValue(b);
            const cmp = (typeof av === 'string') ? av.localeCompare(bv) : (av - bv);
            const primary = sortState.direction === 'asc' ? cmp : -cmp;
            // Tiebreakers: NetWealth → Spendable desc; Spendable → NetWealth desc
            if (primary === 0 && sortState.colKey === 'afterTaxNW' && spendCol) {
                return spendCol.getSortValue(b) - spendCol.getSortValue(a);
            }
            if (primary === 0 && sortState.colKey === 'spend' && afterTaxCol) {
                return afterTaxCol.getSortValue(b) - afterTaxCol.getSortValue(a);
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
        const w5 = pick(successes, r => r.totals.rmdTax / (r.totals.tax || 1), false);
        const w6 = pick(successes, r => r.afterTaxNW ?? -Infinity, true);
        [w1, w2, w3, w5, w6].forEach(w => bestIds.add(w._id));
        colWinners.tax        = w1._id;
        colWinners.rate       = w2._id;
        colWinners.spend      = w3._id;
        colWinners.rmdtax     = w5._id;
        colWinners.afterTaxNW = w6._id;
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
        const isFailed = !r.totals.success;
        const isInfeasible = (r._isBracketInfeasible || r._isACAUntenable) && !isWinner;
        const rowTitle = isFailed
            ? 'Failed — the portfolio ran out of money before the end of the plan (a real shortfall)'
            : isInfeasible
            ? (r._isACAUntenable
                ? `ACA subsidy cliff: spending cannot be met within the FPL cap in ${r._acaBreachYears} year(s) — plan untenable at this spend (strict ACA never breaches the cap)`
                : 'Bracket target exceeded in >50% of years — income sources already push MAGI above this ceiling')
            : 'Click to load this strategy';
        const cells = columns.map(col => {
            const cellWin = (col.key === 'tax'    && r._id === colWinners.tax)
                         || (col.key === 'rate'   && r._id === colWinners.rate)
                         || (col.key === 'spend'  && r._id === colWinners.spend)
                         || (col.key === 'afterTaxNW' && r._id === colWinners.afterTaxNW)
                         || (col.key === 'rmdtax' && r._id === colWinners.rmdtax);
            const bg = cellWin    ? '#4CAF5080'
                     : isFailed   ? '#fde0e0'
                     : isInfeasible ? '#e8e8e8'
                     : isWinner   ? '#90EE90'
                     : r._isReverseOptimized ? '#fde8d8'
                     : r._isConvOptimized    ? '#e8f5e9'
                     : r._isSpendOptimized   ? '#dbeafe' : '';
            const extra = isFailed ? 'opacity:0.75;'
                        : isInfeasible ? 'text-decoration:line-through;opacity:0.55;'
                        : isWinner     ? 'font-weight:bold;'
                        : (r._isReverseOptimized || r._isConvOptimized || r._isSpendOptimized) ? 'font-style:italic;' : '';
            const bgCss = bg ? `background-color:${bg};` : '';
            return `<div style="padding:4px 8px;cursor:pointer;${bgCss}${extra}" onclick="loadOptimizerResult(${r._id})" title="${rowTitle}">${col.getValue(r)}</div>`;
        }).join('');
        return `<div style="display:contents;">${cells}</div>`;
    }).join('');

    // Pinned baseline reference row — best no-conversion / no-cyclic plan. Light-blue tint,
    // sticky under the header; its Δ columns read 0 by definition.
    let baselineRowHtml = '';
    if (baselineRow) {
        const _bCell = 'padding:4px 8px;cursor:pointer;background-color:#dbeafe;font-weight:bold;position:sticky;top:30px;z-index:1;';
        const bTitle = 'BASELINE — the strongest plan with no Roth conversions and no cyclic brokerage maneuvering. Every other row\'s Δ columns are measured against this. Click to load it.';
        baselineRowHtml = '<div style="display:contents;">' + columns.map(col => {
            let v;
            if (col.key === 'strategy')      v = '⚓ BASELINE — ' + baselineRow._strategyLabel;
            else if (col.key === 'dNW' || col.key === 'dTax') v = '0';
            else v = col.getValue(baselineRow);
            return `<div style="${_bCell}" onclick="loadOptimizerResult(${baselineRow._id})" title="${bTitle}">${v}</div>`;
        }).join('') + '</div>';
    }

    const optTableEl = document.getElementById('opt-table');
    optTableEl.style.gridTemplateColumns = columns.map(() => 'max-content').join(' ');
    optTableEl.innerHTML = headerHtml + baselineRowHtml + rowsHtml;

    // Legend — make the "Infeasible" item a click toggle (rows hidden by default).
    const legendInfeasEl = document.getElementById('opt-legend-infeasible');
    if (legendInfeasEl) {
        const swatch = '<span style="display:inline-block;width:14px;height:14px;background:#e8e8e8;opacity:0.8;border:1px solid #ccc;vertical-align:middle;margin-right:4px;border-radius:2px;text-decoration:line-through;"></span>';
        if (infeasibleCount > 0) {
            const action = showInfeasible ? `click to hide ${infeasibleCount}` : `click to show ${infeasibleCount} hidden`;
            const tip = `Infeasible = the strategy's bracket/IRMAA/ACA target is exceeded in more than half its years (existing income already pushes MAGI above the ceiling). Hidden by default — ${showInfeasible ? 'click to hide them again' : 'click to reveal them'}.`;
            legendInfeasEl.innerHTML = `<span onclick="toggleInfeasibleRows()" title="${tip}" style="cursor:pointer;text-decoration:underline;color:#0969da;">${swatch}Infeasible — ${action}</span>`;
        } else {
            legendInfeasEl.innerHTML = `${swatch}Infeasible — none in this run`;
        }
    }

    // Legend — "Failed" item (rows where the portfolio ran out of money). Hidden by default,
    // click toggles (item 11). Mirrors the Infeasible legend toggle.
    const legendFailedEl = document.getElementById('opt-legend-failed');
    if (legendFailedEl) {
        const swatch = '<span style="display:inline-block;width:14px;height:14px;background:#fde0e0;opacity:0.9;border:1px solid #ccc;vertical-align:middle;margin-right:4px;border-radius:2px;"></span>';
        if (failedCount > 0) {
            const action = showFailed ? `click to hide ${failedCount}` : `click to show ${failedCount} hidden`;
            const tip = `Failed = the portfolio ran out of money before the end of the plan (a real shortfall, 🚨). Hidden by default — ${showFailed ? 'click to hide them again' : 'click to reveal them'}.`;
            legendFailedEl.innerHTML = `<span onclick="toggleFailedRows()" title="${tip}" style="cursor:pointer;text-decoration:underline;color:#0969da;">${swatch}🚨 Failed — ${action}</span>`;
        } else {
            legendFailedEl.innerHTML = `${swatch}🚨 Failed — none in this run`;
        }
    }

    // Best summary table — unique winner rows labeled by what they won
    const bestEl = document.getElementById('opt-best');
    if (bestEl) {
        if (successes.length > 0) {
            const winnerDefs = [
                { key: 'afterTaxNW', label: '💎 Most NetWealth',    id: colWinners.afterTaxNW },
                { key: 'spend',  label: '🏆 Most Spendable',   id: colWinners.spend  },
                { key: 'tax',    label: '📉 Lowest Tax',        id: colWinners.tax    },
                { key: 'rate',   label: '📊 Lowest Tax Rate',   id: colWinners.rate   },
                { key: 'rmdtax', label: '📋 Lowest RMD Tax%',   id: colWinners.rmdtax },
                ...(OptimizerState.baseline ? [{ key: 'afterTaxNW', label: '⚓ Best w/o Conv', id: OptimizerState.baseline._id }] : []),
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
                const labelCell = `<div style="background:#A5D6A7;color:#14532d;font-weight:bold;font-size:0.78em;white-space:nowrap;padding:2px 6px;cursor:pointer;" onclick="loadOptimizerResult(${r._id})" title="${w.label} — click to load">${w.label}</div>`;
                const dataCells = columns.slice(1).map(col => {
                    const cellWin = col.key === w.key;
                    const bg = cellWin ? '#4CAF5080' : '#90EE90';
                    return `<div style="padding:4px 8px;background-color:${bg};font-weight:bold;cursor:pointer;" onclick="loadOptimizerResult(${r._id})" title="${w.label} — click to load">${col.getValue(r)}</div>`;
                }).join('');
                return `<div style="display:contents;">${labelCell}${dataCells}</div>`;
            }).join('');
            const bestHeader = columns.map((col, i) => {
                const lbl = i === 0 ? 'Best' : col.label;
                const titleText = i === 0
                    ? 'Each row is the strategy that wins one metric (the highlighted cell shows which). Click a row to load that strategy.'
                    : (col.title || '');
                const tip = titleText ? ` title="${titleText.replace(/"/g, '&quot;')}"` : '';
                return `<div style="${_bHdrStyle}"${tip}>${lbl}</div>`;
            }).join('');
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
            noteEl.textContent = 'ℹ️ All strategies show the same Total Spendable — this means every strategy fully funds your spending goal. Differentiate by Lifetime Tax, NetWealth, or Yrs Funded.';
            noteEl.style.display = 'block';
        } else {
            noteEl.style.display = 'none';
        }
    }

    // Optimizer performance: total time + number of strategy runs (always shown).
    const perfEl = document.getElementById('opt-perf');
    if (perfEl) {
        const perf = OptimizerState.perfStats;
        if (perf) {
            perfEl.textContent = `⏱ ${perf.totalMs.toFixed(0)}ms · ${perf.runsCount} runs`;
            perfEl.style.display = 'block';
        } else {
            perfEl.style.display = 'none';
        }
    }
}

// Toggle visibility of infeasible (bracket-unreachable) optimizer rows; re-render in place.
function toggleInfeasibleRows() {
    OptimizerState.showInfeasible = !OptimizerState.showInfeasible;
    if (OptimizerState.results) renderOptimizerTable(OptimizerState.results);
}

function toggleFailedRows() {
    OptimizerState.showFailed = !OptimizerState.showFailed;
    if (OptimizerState.results) renderOptimizerTable(OptimizerState.results);
}

function sortOptimizerBy(colKey) {
    const s = OptimizerState.sortState ?? { colKey: null, direction: 'asc' };
    if (s.colKey === colKey) {
        s.direction = s.direction === 'asc' ? 'desc' : 'asc';
    } else {
        s.colKey = colKey;
        s.direction = 'asc';
    }
    OptimizerState.sortState = s;
    if (OptimizerState.results) renderOptimizerTable(OptimizerState.results);
}

// Restore inputs from an optimizer row and re-run simulation
function loadOptimizerResult(id) {
    const result = (OptimizerState.results ?? []).find(r => r._id === id);
    if (!result) return;

    // ACA is a strict strategy internally, but the UI keeps it as a "Fill Bracket" sub-option
    // (stratRate=aca<N>) — map it back to the bracket dropdown + ACA stratRate.
    const _isACA = result._strategy === 'aca' || (result._stratACAMultiple ?? 0) > 0;
    document.getElementById('strategy').value = _isACA ? 'bracket' : result._strategy;

    if (result._strategy === 'fixed' && result._nYears != null) {
        document.getElementById('nYears').value = result._nYears;
    } else if (_isACA) {
        document.getElementById('stratRate').value = `aca${result._stratACAMultiple}`;
    } else if (result._strategy === 'bracket' && (result._stratIRMAATier ?? -1) >= 0) {
        document.getElementById('stratRate').value = `IRMAA${result._stratIRMAATier}`;
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
    'year': ['Summary', 'Taxation', 'Balances', 'Income', 'Spending', 'IRA Δ', 'Roth Δ', 'Brokerage Δ', 'Cash Δ', 'Opp. Cost'],
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
    'Medicare': ['Taxation'],
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
    'ForcedIRA': ['Taxation', 'IRA Δ'],

    // IRA Changes - withdrawals, RMDs, and conversions
    'IRA1-': ['IRA Δ', 'Spending'],
    'IRA2-': ['IRA Δ', 'Spending'],
    'IRAwd': ['IRA Δ', 'Income'],
    'RMD%': ['IRA Δ'],
    'RMD1-': ['IRA Δ', 'Spending'],
    'RMD2-': ['IRA Δ', 'Spending'],
    'RMDwd': ['IRA Δ', 'Income'],
    'QCD1': ['IRA Δ', 'Spending'],
    'QCD2': ['IRA Δ', 'Spending'],
    'rothConv': ['IRA Δ', 'Roth Δ', 'Spending'],  // Conversion comes from IRA

    // Roth Changes - balance, withdrawals, growth, conversions
    'Roth1': ['Balances', 'Roth Δ'],
    'Roth2': ['Balances', 'Roth Δ'],
    'RothWD': ['Roth Δ', 'Income', 'Spending'],
    'rothG': ['Roth Δ'],

    // Brokerage Changes - balance, withdrawals, gains, growth
    'Brokerage-': ['Brokerage Δ', 'Income', 'Spending'],
    'brokerageG': ['Brokerage Δ'],

    // Cash Changes - balance, withdrawals, growth
    'CashWD': ['Cash Δ', 'Income', 'Spending'],
    'cashG': ['Cash Δ'],
    'surplusCash': ['Cash Δ', 'Income', 'Spending'],
    // Phase 27: inflows/outflows + withdrawal rate
    'grossOut': ['Summary', 'Withdrawals'],
    'netOut':   ['Summary', 'Withdrawals'],
    'inflows':  ['Summary', 'Withdrawals', 'Spending'],
    'wdRate%':  ['Summary', 'IRA Δ'],

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
    // Phase 12: Withdrawal timing
    'timing':    ['Summary', 'Withdrawals'],
    // Phase 22: Guyton-Klinger
    'gkSpend':   ['Summary', 'Income'],
    'gkAdj':     ['Summary', 'Income'],
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
    'IRMAA': 'Taxes', 'Medicare': 'Taxes', 'totalTax': 'Taxes', 'FedTax': 'Taxes', 'StateTax': 'Taxes',
    'CapGains': 'Taxes', 'MAGI': 'Taxes', 'NominalRate%': 'Taxes',
    'FedCap': 'Taxes', 'StateCap': 'Taxes', 'SumTaxes': 'Taxes',
    'BracketTarget': 'Taxes', 'BracketOverage': 'Taxes', 'ForcedIRA': 'Withdrawals',
    'IRA1': 'Balances', 'IRA2': 'Balances', 'TotalIRA': 'Balances',
    'Roth1': 'Balances', 'Roth2': 'Balances',
    'Cash': 'Balances', 'Roth': 'Balances', 'Brokerage': 'Balances',
    'Basis': 'Balances', 'totalWealth': 'Balances', 'Spendable': 'Balances',
    'brokerageG': 'Balances', 'cashG': 'Balances', 'rothG': 'Balances', 'RMD%': 'Balances',
    'convOC': 'Opp. Cost', 'excessOC': 'Opp. Cost', 'convTax': 'Opp. Cost', 'excessTax': 'Opp. Cost',
    'BETR%': 'Opp. Cost', 'betrFlag': 'Opp. Cost', 'extraConv': 'Opp. Cost',
    'subCycle': 'Withdrawals',
    'grossOut': 'Withdrawals',
    'netOut': 'Withdrawals',
    'inflows': 'Withdrawals',
    'wdRate%': 'Withdrawals',
    'timing': 'Withdrawals',
    'gkSpend': 'Income', 'gkAdj': 'Income',
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
    if (document.getElementById('cat-spending')?.checked) categories.push('Spending');
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
    syncTopScroll();
}

// Phase P21: isolate the "Spending" category (unchecks all other cat-* boxes)
function showSpendingOnly() {
    const catIds = ['cat-summary', 'cat-income', 'cat-balances', 'cat-taxation',
        'cat-ira', 'cat-roth', 'cat-brokerage', 'cat-cash', 'cat-oppcost'];
    catIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });
    const showAll = document.getElementById('show-all');
    if (showAll) showAll.checked = false;
    const spending = document.getElementById('cat-spending');
    if (spending) spending.checked = true;
    updateColumnVisibility();
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
        'QCD1': 'Qualified Charitable Distribution from Your IRA. Satisfies RMD requirement and is excluded from taxable income/MAGI (reduces IRMAA exposure). Age 70½+ only.',
        'QCD2': 'Qualified Charitable Distribution from Spouse IRA. Satisfies Spouse RMD requirement and is excluded from taxable income/MAGI (reduces IRMAA exposure). Age 70½+ only.',
        'RMD%': 'The highest percentage RMD required for IRA1 or IRA2.',
        'Brokerage': 'Year end Brokerage balance',
        'Brokerage-': 'Withdrawals from Brokerage account (asset sales/cash withdrawal)',
        'Basis': 'The amount in brokerage which can be withdrawn tax free.',
        'IRA1-': 'Withdrawals from IRA1',
        'IRA2-': 'Withdrawals from IRA2',
        'CapGains': 'Amount of gains from withdrawing brokerage assets.',
        'IRMAA': 'Annual IRMAA surcharge based on MAGI from 2 years prior. Charged only for spouses 65+ (Medicare age).',
        'IRMAATier': 'IRMAA tier (e.g. Tier 1–6) derived from MAGI 2 years ago. Shows -none- until a spouse reaches 65 (Medicare age).',
        'Medicare': 'Base cost for Medicare Parts B + D for spouses 65+ (grows ~5.6%/yr). Illustration only — not deducted from spendable income; assumed inside the spend goal. Excludes IRMAA (separate column).',
        'FedCap': 'Upper boundary of the current federal tax bracket.',
        'StateCap': 'Upper boundary of the current state tax bracket.',
        'BracketTarget': 'MAGI ceiling targeted by the bracket/IRMAA strategy this year (0 for other strategies).',
        'BracketOverage': 'Amount MAGI exceeded the bracket target. Non-zero means spending needs pushed above the ceiling.',
        'ForcedIRA': 'Extra IRA withdrawn ABOVE the bracket/IRMAA ceiling to fund mandatory spending after Cash/Brokerage/Roth were exhausted (soft-cap break). The strict ACA strategy never does this — it leaves a shortfall instead.',
        'spendGoal': 'This amount increases by inflation less Spend Delta%.',
        'Roth': 'Combined Roth balance at year end.',
        'Roth1': "Person 1's Roth balance at year end.",
        'Roth2': "Person 2's Roth balance at year end.",
        'RothG': 'Growth in the Roth (added to Roth account)',
        'RothConv': 'Amount moved from IRA to Roth (converted)',
        'CashWD': 'Tax free withdrawals from Cash',
        'surplusCash': 'Cash left over after spending and taxes were covered — routed back into the Cash account (or on to Roth conversion if Max Conversion is enabled).',
        'cashD+I': 'Dividends (from brokerage) and interest from Cash (deposits)',
        'MAGI': 'Modified Adjusted Gross Income - determines future IRMAA',
        'totalTax': 'Federal, State, IRMAA, NIIT, and CapGains taxes — in total.',
        'SumTaxes': 'Running total of Federal, State, IRMAA, NIIT, and CapGains taxes.',
        'shortfall': 'How much income is missing, that is: spendGoal - (totalIncome - totalTax). Likely due to errors in the calculation or unexpected bracket changes - or running out of assets.',
        'totalIncome': 'Funds from all sources, taxable and tax-free.',
        'NominalRate%': 'TotalTax/TotalGrossIncome for all taxes - Fed, State, IRMAA',
        'convOC': 'Roth Conversion Opportunity Cost: this plan\'s after-tax total wealth minus the same plan re-simulated with no conversions (the dollars stay in the IRA, no conversion tax is paid, and the bigger IRA pays its own larger RMD taxes and IRMAA later). Positive = the conversions have paid off by this year. The first non-negative year is the Break Even stat.',
        'excessOC': 'Excess Withdrawal Opportunity Cost: same comparison as Conv OC but for surplus IRA withdrawals banked to Cash. The no-action plan keeps those dollars in the IRA. Positive = having the extra cash out early beat leaving it in the IRA.',
        'convTax': 'Incremental federal + state tax attributable to this year\'s Roth conversion (true marginal method: re-runs tax calculation without the conversion and takes the difference). Does not include IRMAA.',
        'excessTax': 'Incremental federal + state tax attributable to this year\'s excess IRA withdrawal routed to Cash (same method as Conv Tax).',
        'BETR%': 'Break-Even Tax Rate (Kitces formula): t_now × (1 + r_taxable)^n / (1 + r_ira)^n. The future marginal rate at which converting now is tax-neutral vs leaving in IRA. If your expected future rate (Future IRA Tax %) exceeds BETR → conversion advantageous (▲). When r_taxable < r_ira (taxable drag), BETR falls below current rate, making conversion even more compelling.',
        'betrFlag': '▲ = expected future rate exceeds BETR by >2pp → conversion beneficial. ▼ = expected future rate is below BETR → conversion costly. ≈ = within 2pp either way (marginal).',
        'extraConv': 'Gross IRA amount additionally withdrawn and converted to Roth by the Phase 23 conversion optimizer, independent of spending strategy. Taxes come from IRA gross; net Roth credit = extraConv − incremental tax.',
        'subCycle': 'Cyclic sub-cycle marker. Brok = brokerage harvest year (spending drawn from Brokerage; IRA free for conversions). IRA = IRA draw year (normal IRA withdrawal). ⚠Brok = brokerage harvest year but balance was below 50% of target — fell back to partial IRA draw.',
        'grossOut': 'Gross outflows: all account withdrawals this year (IRA + RMD + Brokerage + Cash + Roth), including amounts converted to Roth.',
        'netOut': 'Net outflows: portfolio draws funding spending/taxes. Gross outflows minus Roth conversions and reinvested surplus.',
        'inflows': 'Non-portfolio income applied to spending: Social Security + pension.',
        'wdRate%': 'Withdrawal rate: (net outflows − inflows) ÷ start-of-year total wealth. Conversions excluded. Negative = income exceeded spending. The classic "4% rule" targets ~4%.',
        'timing': 'Withdrawal timing auto-selected each year. Early(Conv) = conversion year (withdrawal in 1st quarter, ideally January — maximizes Roth compounding). Late(Spend) = spending-only year (withdrawal in last quarter, ideally December — full portfolio compounds before withdrawal exits, gaining D×r per year).',
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
        const IRMAATierColors = {
            'Tier 1': ['#E8F4FF', '#000'], 'Tier 2': ['#BDD9FF', '#000'], 'Tier 3': ['#90BBFF', '#000'],
            'Tier 4': ['#6090FF', '#000'], 'Tier 5': ['#3366FF', '#fff'], 'Tier 6 (TOP)': ['#0000FF', '#fff'],
        };
        const tierEntry = IRMAATierColors[row['IRMAATier']];
        const _IRMAACols = ['year', 'IRMAATier', 'totalIncome', 'IRMAA', 'totalTax'];

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

                if (tierEntry && !incomeShortfall && _IRMAACols.includes(key)) {
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

    syncTopScroll();
    return table;
}

// #2 — keep the mirror scrollbar above the Annual Details table sized and toggled correctly.
// Sets the spacer width to the table's scrollWidth and hides the strip when nothing overflows.
function syncTopScroll() {
    const table  = document.getElementById('main-table');
    const top    = document.getElementById('tbl-top-scroll');
    const inner  = document.getElementById('tbl-top-scroll-inner');
    const bottom = document.getElementById('tbl-scroll');
    if (!table || !top || !inner || !bottom) return;
    const w = table.scrollWidth;
    inner.style.width = w + 'px';
    top.style.display = w > bottom.clientWidth + 1 ? '' : 'none';
}

// Wire bidirectional scroll sync between the mirror strip and the table scroller. Called once.
let _topScrollWired = false;
function setupTopScrollSync() {
    if (_topScrollWired) return;
    const top    = document.getElementById('tbl-top-scroll');
    const bottom = document.getElementById('tbl-scroll');
    if (!top || !bottom) return;
    let syncing = false;
    top.addEventListener('scroll', () => {
        if (syncing) return; syncing = true; bottom.scrollLeft = top.scrollLeft; syncing = false;
    });
    bottom.addEventListener('scroll', () => {
        if (syncing) return; syncing = true; top.scrollLeft = bottom.scrollLeft; syncing = false;
    });
    window.addEventListener('resize', syncTopScroll);
    _topScrollWired = true;
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
    if (rmdPctEl) {
        const rmdPctStr = totals.tax > 0 ? `${((totals.rmdTax ?? 0) / totals.tax * 100).toFixed(0)}% of taxes` : '';
        const qcdStr = (totals.qcd ?? 0) > 0 ? ` | QCD $${Math.round(totals.qcd).toLocaleString()}` : '';
        rmdPctEl.innerText = rmdPctStr + qcdStr;
    }
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
        avgSpendEl.innerText = (totals.avgWdRate != null)
            ? (totals.avgWdRate * 100).toFixed(1) + '%' : '—';
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

// #7 — milestone overlay. Draws labeled vertical lines at significant plan events. Shared by both
// charts; reads module-level `showMilestones` (toggle) and `_chartMilestones` (computed per run).
// On by default.
let showMilestones = true;
let _chartMilestones = [];
// #8 Taxation view — overlay federal-bracket / IRMAA-tier threshold lines that MAGI actually crosses.
// On by default.
let showTaxThresholds = true;

const milestonePlugin = {
    id: 'milestones',
    afterDatasetsDraw(chart) {
        if (!showMilestones || !_chartMilestones.length) return;
        // Milestones come from the last single-strategy run. The main charts show all of them;
        // the Monte Carlo fan aggregates many strategies/paths, so only deterministic death
        // markers apply there (IRMAA/GK/shortfall/break-even differ per path). All other
        // charts (MC input fans, etc.) get none.
        const canvasId = chart.canvas?.id || '';
        let milestones = _chartMilestones;
        if (canvasId === 'mc-chart') milestones = milestones.filter(m => m.label.includes('Passing'));
        else if (canvasId !== 'chartAssets' && canvasId !== 'chartIncomeSources') return;
        if (!milestones.length) return;
        const xScale = chart.scales.x;
        if (!xScale) return;
        const { top, bottom, left, right } = chart.chartArea;
        const mid = (left + right) / 2;
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = '600 10px sans-serif';
        milestones.forEach((m, i) => {
            const px = xScale.getPixelForValue(m.x);
            if (px == null || isNaN(px)) return;
            ctx.beginPath();
            ctx.moveTo(px, top);
            ctx.lineTo(px, bottom);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = m.color;
            ctx.setLineDash([5, 3]);
            ctx.stroke();
            // Label hugs the line, flipping side near the right edge; staggered to limit overlap.
            ctx.setLineDash([]);
            ctx.fillStyle = m.color;
            const onRight = px > mid;
            ctx.textAlign = onRight ? 'right' : 'left';
            ctx.fillText(m.label, px + (onRight ? -3 : 3), top + 10 + (i % 3) * 12);
        });
        ctx.restore();
    }
};

// Chart series colors — single source of truth for anything IRMAA/Medicare colored
// (cost bars on both charts and the IRMAA milestone marker). Bars append 'C0' alpha
// (~75%) to match the other stacked cost series.
const IRMAA_COLOR    = '#E75480';
const MEDICARE_COLOR = '#008080';

// Legend hover hint for the Medicare series (browser-native tooltip via canvas title).
const MEDICARE_LEGEND_TIP = 'Base Cost for Medicare B+D - not deducted from spendable. Illustration only.';
const medicareLegendHover = {
    onHover: (e, item, legend) => { legend.chart.canvas.title = item.text === 'Medicare' ? MEDICARE_LEGEND_TIP : ''; },
    onLeave: (e, item, legend) => { legend.chart.canvas.title = ''; },
};

// Combine multiple {onHover,onLeave} legend-hover handler objects so several independent
// behaviors (e.g. the Medicare tooltip hint + dataset dimming below) all fire on the same
// event, instead of one silently overwriting the other via object spread key collision.
function composeLegendHover(...handlers) {
    return {
        onHover: (e, item, legend) => handlers.forEach(h => h.onHover?.(e, item, legend)),
        onLeave: (e, item, legend) => handlers.forEach(h => h.onLeave?.(e, item, legend)),
    };
}

// Shared color-dimming helper — fades a hex/rgba color to 15% opacity for the "not hovered /
// not isolated" state. Used by both datasetHoverHighlight() and makeChartLegendInteraction().
function dimColor(color) {
    if (!color || color === 'transparent') return color;
    let m = String(color).match(/^rgba?\((\d+),(\d+),(\d+)/);
    if (!m) {
        const h = String(color).match(/^#([0-9a-f]{6})/i);
        if (h) { const n = parseInt(h[1], 16); m = [null, (n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    }
    return m ? `rgba(${m[1]},${m[2]},${m[3]},0.15)` : color;
}

// Generic legend-hover highlight: dims every dataset except the hovered legend item's group,
// restoring on leave. `groupSize` lets one legend entry map to several consecutive datasets
// (e.g. the MC percentile-band chart uses 5 datasets — p5/p95/p25/p75/median — per strategy).
// NOTE: chart.update() (not 'none') — 'none' mode is a known Chart.js bug (chartjs/Chart.js#11507)
// that skips redrawing bar/point fill colors even though the dataset's color property updates
// correctly in the data model.
function datasetHoverHighlight(groupSize = 1) {
    return {
        onHover: (e, legendItem, legend) => {
            const chart = legend.chart, groupIdx = Math.floor(legendItem.datasetIndex / groupSize);
            chart.data.datasets.forEach((ds, i) => {
                // Bar datasets often have no borderColor at all (legitimately undefined) — use a
                // dedicated marker to track "cached", not `_origBorder !== undefined`, or those
                // datasets would never be recognized as cached and onLeave would skip restoring them.
                if (!ds._hoverHighlightCached) { ds._hoverHighlightCached = true; ds._origBorder = ds.borderColor; ds._origBg = ds.backgroundColor; }
                const inGroup = Math.floor(i / groupSize) === groupIdx;
                ds.borderColor = inGroup ? ds._origBorder : dimColor(ds._origBorder);
                ds.backgroundColor = inGroup ? ds._origBg : dimColor(ds._origBg);
            });
            chart.update();
        },
        onLeave: (e, legendItem, legend) => {
            const chart = legend.chart;
            chart.data.datasets.forEach(ds => {
                if (ds._hoverHighlightCached) { ds.borderColor = ds._origBorder; ds.backgroundColor = ds._origBg; }
            });
            chart.update();
        },
    };
}

// Combined hover-dim + click-isolate controller for mixed bar+line charts (Taxation, Inflows vs
// Outflows, Earnings vs W/D, combined Income & Expenses view). Bar legend items: click isolates
// (dims every other dataset, keeps the clicked bar full-color) — sticky until a DOUBLE-CLICK on
// any bar legend item restores everyone. Hover-dim is suppressed while a bar isolation is active
// (avoids two competing dim states). Line legend items are untouched — hover-dim still applies
// normally, and click keeps Chart.js's default toggle-hide/show (unlike bars, a single click on a
// line item DOES remove/restore that series, same as always).
function makeChartLegendInteraction(groupSize = 1) {
    let isolatedKey = null;
    const cache = (ds) => { if (!ds._hoverHighlightCached) { ds._hoverHighlightCached = true; ds._origBorder = ds.borderColor; ds._origBg = ds.backgroundColor; } };
    const restoreAll = (chart) => chart.data.datasets.forEach(ds => { if (ds._hoverHighlightCached) { ds.borderColor = ds._origBorder; ds.backgroundColor = ds._origBg; } });
    return {
        onHover: (e, legendItem, legend) => {
            if (isolatedKey !== null) return; // a bar isolation is active — hover-dim suppressed
            const chart = legend.chart, groupIdx = Math.floor(legendItem.datasetIndex / groupSize);
            chart.data.datasets.forEach((ds, i) => {
                cache(ds);
                const inGroup = Math.floor(i / groupSize) === groupIdx;
                ds.borderColor = inGroup ? ds._origBorder : dimColor(ds._origBorder);
                ds.backgroundColor = inGroup ? ds._origBg : dimColor(ds._origBg);
            });
            chart.update();
        },
        onLeave: (e, legendItem, legend) => {
            if (isolatedKey !== null) return; // stay on the isolated state
            restoreAll(legend.chart);
            legend.chart.update();
        },
        onClick: (e, legendItem, legend) => {
            const chart = legend.chart;
            const ds = chart.data.datasets[legendItem.datasetIndex];
            if (ds.type !== 'bar') {
                // Line item: native toggle-hide/show, unaffected by any bar isolation state.
                Chart.defaults.plugins.legend.onClick(e, legendItem, legend);
                return;
            }
            // MouseEvent.detail === 2 on the SECOND click of a genuine double-click (browser/OS
            // native double-click detection — resets to 1 if clicks are too far apart in time or
            // position, so accidentally clicking two different legend entries quickly won't trigger this).
            if (e.native?.detail === 2) {
                restoreAll(chart);
                isolatedKey = null;
                chart.update();
                return;
            }
            const key = `ds${legendItem.datasetIndex}`;
            chart.data.datasets.forEach((d, i) => {
                cache(d);
                const keep = i === legendItem.datasetIndex;
                d.backgroundColor = keep ? d._origBg : dimColor(d._origBg);
                d.borderColor = keep ? d._origBorder : dimColor(d._origBorder);
            });
            isolatedKey = key;
            chart.update();
        },
    };
}

// Compute milestone markers from the simulation log:
//  1. First death — labelled "Your Passing" / "Spouse Passing" (filing status flips; the deceased's
//     age becomes '—').
//  2. Every Guyton-Klinger guardrail spending CUT (gkAdj contains a "cap" adjustment).
//  3. Every year the IRMAA tier INCREASES over the prior year (e.g. Tier 1→Tier 2), labelled with
//     the new tier ("IRMAA Tier 2"). Same-or-lower tiers are not marked.
//  4. Every year net income falls short of the spend goal by more than 10%.
//  5. Roth conversion break-even — the first year the converting plan overtakes the no-conversion
//     shadow (totals.convBEYear).
function computeMilestones(log) {
    const ms = [];
    // Numeric IRMAA tier from the string field ("-none-"/"-"→0, "Tier 3 (TOP)"→3).
    const tierNum = t => { const m = String(t ?? '').match(/(\d+)/); return m ? +m[1] : 0; };
    const beYear = (typeof lastTotals !== 'undefined' && lastTotals) ? lastTotals.convBEYear : null;
    let prevStatus = null, deathDone = false, prevTier = 0, beDone = false;
    for (let i = 0; i < log.length; i++) {
        const r = log[i];
        const status = r.status;
        // 1. Death — first filing-status flip; name who passed (their age shows '—').
        if (!deathDone && prevStatus && status && status !== prevStatus) {
            const youGone = (r.age1 == null || r.age1 === '—');
            ms.push({ x: i, label: youGone ? 'Your Passing' : 'Spouse Passing', color: '#7b1fa2' });
            deathDone = true;
        }
        if (status) prevStatus = status;
        // 4. Net income shortfall > 10% of the spend goal — every such year. (Computed first so a
        // shortfall year suppresses the GK-cut marker below — a shortfall is the more important note.)
        const sg = r.spendGoal ?? r.SpendGoal;
        const ni = r.netIncome ?? r.NetIncome;
        const isShort = (sg > 0 && ni != null && ni < sg * 0.90);
        // 2. GK guardrail cut — gkAdj like "−10%cap" (may be combined with "no-CPI"). Skipped when
        // the same year is already flagged as a shortfall.
        if (!isShort && String(r.gkAdj ?? '').includes('cap')) {
            ms.push({ x: i, label: 'GK cut', color: '#d35400' });
        }
        // 3. IRMAA tier increase over the prior year.
        const tier = tierNum(r.IRMAATier);
        if (tier > prevTier && tier > 0) {
            ms.push({ x: i, label: 'IRMAA ' + String(r.IRMAATier), color: IRMAA_COLOR });
        }
        prevTier = tier;
        if (isShort) {
            ms.push({ x: i, label: 'Shortfall', color: '#c0392b' });
        }
        // 5. Roth conversion break-even year.
        if (!beDone && beYear != null && r.year === beYear) {
            ms.push({ x: i, label: 'Roth Break Even', color: '#16a085' });
            beDone = true;
        }
    }
    _chartMilestones = ms;
}

// Toggle handler for the "Show milestones" checkbox; redraws both charts in place.
function toggleMilestones(cb) {
    showMilestones = !!cb.checked;
    assetChart?.update('none');
    incomeChart?.update('none');
}

// #8 Taxation view — build federal-bracket and IRMAA-tier threshold series for the years MAGI
// actually CROSSES the boundary (a boundary always above or always below MAGI is omitted, so the
// always-exceeded low brackets and never-reached high brackets don't clutter the chart). Each
// boundary inflates per year by the cumulative CPI factor and uses that year's filing status.
function computeTaxThresholdSeries(log, adj) {
    if (!log.length) return [];
    const magi = log.map(r => r.MAGI ?? 0);
    // A boundary series is "crossed" iff MAGI sits below it in some year and at/above it in another.
    const crosses = series => {
        let below = false, atOrAbove = false;
        for (let i = 0; i < series.length; i++) {
            const v = series[i];
            if (v == null || !isFinite(v)) continue;
            if (magi[i] >= v) atOrAbove = true; else below = true;
        }
        return below && atOrAbove;
    };
    // Inflated per-year boundary value for table[status].brackets[idx].l (null if non-finite).
    const boundary = (table, idx) => log.map(r => {
        const brks = table?.[r.status]?.brackets;
        const l = brks?.[idx]?.l;
        return (l == null || !isFinite(l)) ? null : l * (r['-cpiFactor'] ?? 1);
    });
    const out = [];

    // Federal: each bracket lower bound is where a new marginal rate begins. Label with that rate.
    const fb = TAXData?.FEDERAL, fedShades = ['#f5cba7', '#f0b27a', '#eb984e', '#e67e22', '#ca6f1e', '#a04000'];
    if (fb?.MFJ) {
        const nFed = fb.MFJ.brackets.length;
        const rawFed = Array.from({ length: nFed }, (_, j) => boundary(fb, j));
        const crossedFed = new Set();
        for (let j = 0; j < nFed; j++) {
            if (!crosses(rawFed[j])) continue;
            crossedFed.add(j);
            const rate = Math.round((fb.MFJ.brackets[j].r ?? 0) * 100);
            out.push({ label: `${rate}% Limit`, color: fedShades[j % fedShades.length],
                       data: rawFed[j].map((v, k) => v == null ? null : v * adj(log[k])),
                       group: 'fed' });
        }
        // Next bracket above current MAGI — not already crossed.
        const nextFedCounts = {};
        for (let y = 0; y < magi.length; y++) {
            for (let j = 0; j < nFed; j++) {
                const v = rawFed[j][y];
                if (v != null && magi[y] < v) {
                    if (!crossedFed.has(j)) nextFedCounts[j] = (nextFedCounts[j] || 0) + 1;
                    break;
                }
            }
        }
        for (const [jStr] of Object.entries(nextFedCounts)) {
            const j = +jStr;
            const rate = Math.round((fb.MFJ.brackets[j].r ?? 0) * 100);
            out.push({ label: `${rate}% Limit`, color: fedShades[j % fedShades.length],
                       data: rawFed[j].map((v, k) => v == null ? null : v * adj(log[k])),
                       dash: [5, 4], group: 'fed', isNext: true });
        }
    }

    // IRMAA: each tier's MAGI entry threshold (skip the no-surcharge floor at index 0).
    const ib = TAXData?.IRMAA, IRMAAShades = ['#aed6f1', '#7fb3d5', '#5499c7', '#2e86c1', '#2471a3', '#1a5276'];
    if (ib?.MFJ) {
        const nIR = ib.MFJ.brackets.length;
        const rawIR = Array.from({ length: nIR }, (_, t) => boundary(ib, t));
        const crossedIR = new Set();
        for (let t = 1; t < nIR; t++) {
            if (!crosses(rawIR[t])) continue;
            crossedIR.add(t);
            const tier = (ib.MFJ.brackets[t].tier || `Tier ${t}`).replace(/\s*\(TOP\)/, '');
            out.push({ label: `IRMAA ${tier}`, color: IRMAAShades[(t - 1) % IRMAAShades.length],
                       data: rawIR[t].map((v, k) => v == null ? null : v * adj(log[k])), dash: [3, 3],
                       group: 'IRMAA' });
        }
        // Next IRMAA tier above current MAGI — not already crossed.
        const nextIRCounts = {};
        for (let y = 0; y < magi.length; y++) {
            for (let t = 1; t < nIR; t++) {
                const v = rawIR[t][y];
                if (v != null && magi[y] < v) {
                    if (!crossedIR.has(t)) nextIRCounts[t] = (nextIRCounts[t] || 0) + 1;
                    break;
                }
            }
        }
        for (const [tStr] of Object.entries(nextIRCounts)) {
            const t = +tStr;
            const tier = (ib.MFJ.brackets[t].tier || `Tier ${t}`).replace(/\s*\(TOP\)/, '');
            out.push({ label: `IRMAA ${tier}`, color: IRMAAShades[(t - 1) % IRMAAShades.length],
                       data: rawIR[t].map((v, k) => v == null ? null : v * adj(log[k])),
                       dash: [5, 4], group: 'IRMAA', isNext: true });
        }
    }
    return out;
}

// Toggle handler for the Taxation view's "Show thresholds" checkbox; rebuilds the chart.
function toggleTaxThresholds(cb) {
    showTaxThresholds = !!cb.checked;
    if (lastSimulationLog) updateCharts(lastSimulationLog);
}

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
    if (typeof Chart !== 'undefined') Chart.register(crosshairPlugin, milestonePlugin);
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

// #8 — which view the lower (Income & Expenses) chart shows.
let incomeChartView = 'combined';

function setIncomeChartView(v) {
    incomeChartView = v;
    ['combined', 'tax', 'net', 'flows', 'assetflows'].forEach(k => {
        const btn = document.getElementById(`chartView_${k}`);
        if (btn) btn.classList.toggle('active', k === v);
    });
    // "Show thresholds" applies only to the Taxation view.
    const thr = document.getElementById('chk-thresholds-wrap');
    if (thr) thr.style.display = v === 'tax' ? 'inline-flex' : 'none';
    // After-tax note applies only to the combined (Income & Expenses) view — it's the
    // only view where income-source bars are scaled down by the year's effective tax rate.
    const aftertaxNote = document.getElementById('income-aftertax-note');
    if (aftertaxNote) aftertaxNote.style.display = v === 'combined' ? '' : 'none';
    if (lastSimulationLog) updateCharts(lastSimulationLog);
}

// #8 — build the lower chart for the non-default views. `combined` stays inline in updateCharts.
// Receives the closures it needs (adj, sharedTooltip, mkLine, visibleSum) so it shares the exact
// dollar-adjustment and tooltip styling of the main charts.
function buildAltIncomeChart(ctxI, log, adj, sharedTooltip, mkLine, visibleSum) {
    const labels = log.map(r => r.year);
    const legendLabels = { usePointStyle: true, pointStyle: 'circle', boxWidth: 10, boxHeight: 10, padding: 16 };
    const dollarTicks = { callback: v => Math.round(v).toLocaleString() };

    if (incomeChartView === 'net') {
        // Income vs Net (spendable) income vs the spend goal.
        incomeChart = new Chart(ctxI, {
            type: 'line',
            data: { labels, datasets: [
                mkLine('Total Income',    '#2980b9', r => (r.totalIncome ?? 0) * adj(r)),
                mkLine('Net (Spendable)', '#27ae60', r => (visibleSum(r) - r.totalTax) * adj(r)),
                { ...mkLine('Spend Goal', '#e67e22', r => (r.spendGoal ?? 0) * adj(r)), borderDash: [6, 4], pointRadius: 0 },
            ]},
            options: { ...sharedTooltip,
                scales: { y: { ticks: dollarTicks } },
                plugins: { ...sharedTooltip.plugins, legend: { labels: legendLabels, ...datasetHoverHighlight() } } }
        });
    } else if (incomeChartView === 'tax') {
        // Taxation: stacked tax components are the headline number → LEFT (primary) axis.
        // MAGI and (optionally) the federal-bracket / IRMAA thresholds it crosses → RIGHT axis.
        // order: bars high (drawn first = behind), lines low (drawn last = on top) so the MAGI and
        // threshold lines are never hidden behind the stacked tax bars.
        const mkTax = (label, color, fn) => ({ label, type: 'bar', backgroundColor: color, stack: 'tax',
            yAxisID: 'y', order: 3, data: log.map(r => Math.max(0, fn(r)) * adj(r)) });
        const datasets = [
            mkTax('Federal',   '#c0392b', r => (r.FedTax ?? 0) - (r['-capGainsTax'] ?? 0)),
            mkTax('Cap Gains', '#e74c3c', r => r['-capGainsTax'] ?? 0),
            mkTax('State',     '#f39c12', r => r.StateTax ?? 0),
            mkTax('IRMAA',     IRMAA_COLOR + 'C0', r => r.IRMAA ?? 0),
            // Base Part B+D premiums (informational cost — not part of totalTax).
            mkTax('Medicare',  MEDICARE_COLOR + 'C0', r => r.Medicare ?? 0),
            { ...mkLine('MAGI', '#111827', r => (r.MAGI ?? 0) * adj(r)), type: 'line', yAxisID: 'y1', pointRadius: 0, borderWidth: 2.5, order: 1 },
        ];
        if (showTaxThresholds) {
            for (const s of computeTaxThresholdSeries(log, adj)) {
                datasets.push({ label: s.label, data: s.data, type: 'line', yAxisID: 'y1', order: 0,
                    borderColor: s.color, backgroundColor: s.color, pointRadius: 0, borderWidth: 2.5,
                    borderDash: s.dash || [6, 4], fill: false, spanGaps: true,
                    _thGroup: s.group, _thNext: s.isNext });
            }
        }
        // Threshold lines stay on the chart for visual context, but are dropped from the tooltip.
        // Instead the tooltip answers "what rate am I paying now?" via an afterBody footer with the
        // federal + state marginal rate and the highest IRMAA tier crossed (all already in the log row).
        const taxThresholdFilter = (item) => !item.dataset._thGroup;   // bars + MAGI only
        // Enrich two of the bar rows: IRMAA row shows its tier ("IRMAA Tier 4: 16,000"); the Cap Gains
        // row shows the effective cap-gains rate and the underlying gains ("Cap Gains: 81,835 (~21% on 392,932)").
        const taxLabelCb = (ctx) => {
            const r = log[ctx.dataIndex];
            const val = Math.round(ctx.parsed.y).toLocaleString();
            const lbl = ctx.dataset.label;
            if (lbl === 'IRMAA' && ctx.parsed.y > 0) {
                const tier = r?.IRMAATier;
                if (tier && tier !== '-none-' && tier !== '-') return `IRMAA ${tier}: ${val}`;
            }
            if (lbl === 'Cap Gains' && ctx.parsed.y > 0 && (r?.CapGains || 0) > 0) {
                const rate = Math.round((r['-capGainsTax'] || 0) / r.CapGains * 100);
                return `Cap Gains: ${val} (~${rate}% on ${Math.round(r.CapGains * adj(r)).toLocaleString()})`;
            }
            return lbl + ': ' + val;
        };
        // Footer reports the marginal rate on ORDINARY income (cap gains shown separately above).
        const taxRateFooter = (items) => {
            const r = log[items[0]?.dataIndex];
            if (!r) return [];
            const out = [`Fed ordinary marginal: ${Math.round((r['FedRate%'] || 0) * 100)}%`];
            if ((r['StateRate%'] || 0) > 0) out.push(`State marginal: ${((r['StateRate%']) * 100).toFixed(1)}%`);
            return out;
        };
        incomeChart = new Chart(ctxI, {
            type: 'bar',
            data: { labels, datasets },
            options: { ...sharedTooltip,
                scales: {
                    x:  { stacked: true },
                    y:  { position: 'left',  stacked: true,  title: { display: true, text: 'Tax ($)' },    ticks: dollarTicks },
                    y1: { position: 'right', stacked: false, min: 0, grid: { drawOnChartArea: false }, title: { display: true, text: 'Income ($)' }, ticks: dollarTicks },
                },
                plugins: { ...sharedTooltip.plugins,
                    tooltip: { ...sharedTooltip.plugins.tooltip, filter: taxThresholdFilter,
                        callbacks: { ...sharedTooltip.plugins.tooltip.callbacks, label: taxLabelCb, afterBody: taxRateFooter } },
                    legend: (() => { const li = makeChartLegendInteraction(); return { labels: legendLabels, ...composeLegendHover(medicareLegendHover, li), onClick: li.onClick }; })() } }
        });
    } else if (incomeChartView === 'flows') {
        // Inflows (up) vs outflows (down): where spending money comes from and where it goes.
        const mkUp = (label, color, fn) => ({ label, type: 'bar', backgroundColor: color, stack: 'flow',
            data: log.map(r =>  Math.max(0, fn(r)) * adj(r)) });
        const mkDn = (label, color, fn) => ({ label, type: 'bar', backgroundColor: color, stack: 'flow',
            data: log.map(r => -Math.max(0, fn(r)) * adj(r)) });
        // Portfolio Draw (= netOut + conversion gross) split by source account, using the asset-chart
        // colors. Per-account gross withdrawals are scaled so their sum equals the portfolio total,
        // which keeps the up/down sides balanced (reinvested surplus is netted out pro-rata).
        const _grossDraw = r => Math.max(0, r.IRAwd ?? 0) + Math.max(0, r['Brokerage-'] ?? 0)
            + Math.max(0, r.CashWD ?? 0) + Math.max(0, r.RothWD ?? 0);
        const _acctScale = r => { const g = _grossDraw(r); return g > 0 ? ((r.netOut ?? 0) + (r.rothConv ?? 0)) / g : 0; };
        incomeChart = new Chart(ctxI, {
            type: 'bar',
            data: { labels, datasets: [
                // IRA draw includes the gross IRA→Roth conversion (the converted dollars are drawn from
                // the IRA up, and land in Roth on the down side via "Conversions → Roth").
                // Spending is the amount actually CONSUMED (inflows + portfolio draw − taxes); using
                // netIncome here would balloon in conversion years because totalIncome includes the
                // converted amount, double-counting it against the separate Conversions bar.
                mkUp('Guaranteed (SS+Pension)', '#3498dbB0', r => r.inflows  ?? 0),
                mkUp('IRA draw',                '#e67e22B0', r => (r.IRAwd ?? 0)      * _acctScale(r)),
                mkUp('Brokerage draw',          '#4F4FDC', r => (r['Brokerage-'] ?? 0) * _acctScale(r)),
                mkUp('Cash draw',               '#27ae60B0', r => (r.CashWD ?? 0)     * _acctScale(r)),
                mkUp('Roth draw',               '#8e44adB0', r => (r.RothWD ?? 0)     * _acctScale(r)),
                mkDn('Taxes',                   '#A30000C0', r => r.totalTax ?? 0),
                mkDn('Spending',                '#1abc9cB0', r => (r.inflows ?? 0) + (r.netOut ?? 0) - (r.totalTax ?? 0)),
                mkDn('Conversions → Roth',      '#8e44adB0', r => r.rothConv ?? 0),
            ]},
            options: { ...sharedTooltip,
                scales: { x: { stacked: true }, y: { stacked: true, ticks: dollarTicks } },
                plugins: { ...sharedTooltip.plugins,
                    // Hide rows that round to $0 (e.g. no Brokerage draw this year) — declutters the tip.
                    tooltip: { ...sharedTooltip.plugins.tooltip, filter: (item) => Math.round(item.parsed.y) !== 0 },
                    legend: (() => { const li = makeChartLegendInteraction(); return { labels: legendLabels, onHover: li.onHover, onLeave: li.onLeave, onClick: li.onClick }; })() } }
        });
    } else if (incomeChartView === 'assetflows') {
        // Asset-level cash flow: investment EARNINGS (up, stacked by account) vs WITHDRAWALS that
        // leave the portfolio to fund spending/taxes (down). Roth conversions are excluded (IRA→Roth
        // is internal). The "Net change" line = earnings − withdrawals shows whether the portfolio
        // grew (above 0) or was drawn down (below 0) that year.
        const earn = r => (r['-iraG'] ?? 0) + (r.rothG ?? 0) + (r.brokerageG ?? 0) + (r.cashG ?? 0);
        const mkE = (label, color, fn) => ({ label, type: 'bar', backgroundColor: color, stack: 'flow',
            order: 2, data: log.map(r => (fn(r) ?? 0) * adj(r)) });
        incomeChart = new Chart(ctxI, {
            type: 'bar',
            data: { labels, datasets: [
                mkE('IRA earnings',       '#e67e22B0', r => r['-iraG']),
                mkE('Roth earnings',      '#8e44adB0', r => r.rothG),
                mkE('Brokerage earnings', '#4F4FDC', r => r.brokerageG),
                mkE('Cash earnings',      '#27ae60B0', r => r.cashG),
                { label: 'Withdrawals', type: 'bar', backgroundColor: '#c0392bC0', stack: 'flow', order: 2,
                  data: log.map(r => -Math.max(0, r.netOut ?? 0) * adj(r)) },
                { ...mkLine('Net change', '#111827', r => (earn(r) - Math.max(0, r.netOut ?? 0)) * adj(r)),
                  type: 'line', order: 0, pointRadius: 0, borderWidth: 2 },
            ]},
            options: { ...sharedTooltip,
                scales: { x: { stacked: true }, y: { stacked: true, ticks: dollarTicks } },
                plugins: { ...sharedTooltip.plugins, legend: (() => { const li = makeChartLegendInteraction(); return { labels: legendLabels, onHover: li.onHover, onLeave: li.onLeave, onClick: li.onClick }; })() } }
        });
    }
}

function updateCharts(log) {
    const inCurrentDollars = document.getElementById('show-current-dollars')?.checked;
    const adj = r => inCurrentDollars ? 1 / (r.inflationFactor || 1) : 1;
    computeMilestones(log);   // #7 — markers drawn by milestonePlugin when the toggle is on

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
                mkLine('Brokerage',   '#4F4FDC', r => r.Brokerage   * adj(r)),
                mkLine('Cash',        '#27ae60', r => r.Cash        * adj(r)),
                mkLine('TotalWealth', '#555555', r => r.totalWealth * adj(r))
            ]
        },
        options: {
            ...sharedTooltip,
            plugins: {
                ...sharedTooltip.plugins,
                legend: { labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 10, boxHeight: 10, padding: 16 }, ...datasetHoverHighlight() }
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

    if (incomeChartView !== 'combined') {
        buildAltIncomeChart(ctxI, log, adj, sharedTooltip, mkLine, visibleSum);
        return;
    }

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
                mkInc('Brokerage',       '#4F4FDC', r => basisReturn(r)),
                // Visual separator between spending and expense legend items
                { label: '│', type: 'bar', data: log.map(() => 0), backgroundColor: 'transparent', borderWidth: 0, stack: 'income', order: 2 },
                // Expenses stack on top of the Spendable Income line (unscaled absolute amounts)
                mkAbs('Fed Tax',        '#A30000C0', r => r.FedTax),
                mkAbs('State Tax',      '#FF2E2EC0', r => r.StateTax),
                mkAbs('IRMAA',          IRMAA_COLOR + 'C0', r => r.IRMAA),
                // Base Part B+D premiums (informational — not deducted from Net Income).
                mkAbs('Medicare',       MEDICARE_COLOR + 'C0', r => r.Medicare ?? 0),
                mkAbs('Roth Conv',      '#8e44ad80', r => r.rothConv),
                mkAbs('QCD',            '#99999980', r => (r.QCD1 ?? 0) + (r.QCD2 ?? 0)),
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
                            const lines = [
                                `${r.year}  |  You: ${a1}  Spouse: ${a2}  |  Tax: ${taxPct}`,
                                `Total Income: ${totalFmt}`
                            ];
                            if (parts.length > 0) lines.push(`Untaxed: ${parts.join(' + ')}`);
                            return lines;
                        }
                    },
                    filter: item => item.dataset.label !== '│' && Math.abs(Math.round(item.parsed.y)) > 0
                },
                legend: (() => {
                    const li = makeChartLegendInteraction();
                    return {
                        onClick: (e, item, legend) => {
                            if (item.text === '│') return;   // zero-width separator dataset — not isolatable
                            li.onClick(e, item, legend);
                        },
                        ...composeLegendHover(medicareLegendHover, li),
                        labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 10, boxHeight: 10, padding: 16 }
                    };
                })()
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

    // Annual Details table width can only be measured while its tab is visible (#2).
    if (id === 'tab-tbl') syncTopScroll();
}


// ── Small-screen UX helpers ─────────────────────────────────────────────────
// The app's contextual help lives in title= attributes, which touch devices cannot hover.
// On hover-less devices a tap on any titled (non-interactive) element shows a dismissible
// popover instead; the title is moved to data-tip on first tap so no native tooltip doubles up.
// Also: on phones, fold the sidebar input sections so results are one short scroll away, and
// add a floating jump button that hops between inputs and results.
// Test hook: add ?touchtips to the URL to force the tap-tooltip behavior on a mouse device.
function setupSmallScreenUX() {
    const touch = (window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches)
        || location.search.includes('touchtips');
    if (touch) {
        const pop = document.createElement('div');
        pop.id = 'touch-tooltip';
        document.body.appendChild(pop);
        let anchor = null;
        const hide = () => { pop.style.display = 'none'; anchor = null; };
        document.addEventListener('click', (e) => {
            // Interactive elements keep their normal behavior (typing, tab switch, toggle).
            if (e.target.closest && e.target.closest('button, a, select, input, textarea')) { hide(); return; }
            const el = e.target.closest ? e.target.closest('[title], [data-tip]') : null;
            if (!el) { hide(); return; }
            if (el.getAttribute('title')) { el.dataset.tip = el.getAttribute('title'); el.removeAttribute('title'); }
            const tip = el.dataset.tip;
            if (!tip || el === anchor) { hide(); return; }
            anchor = el;
            pop.textContent = tip;
            pop.style.display = 'block';
            pop.style.left = '0px'; pop.style.top = '0px';   // reset before measuring
            const margin = 8;
            const r = el.getBoundingClientRect();
            const w = Math.min(pop.offsetWidth, window.innerWidth - 2 * margin);
            const left = Math.min(Math.max(margin, r.left), window.innerWidth - w - margin);
            let top = r.bottom + 6;
            if (top + pop.offsetHeight > window.innerHeight - margin) {
                top = Math.max(margin, r.top - pop.offsetHeight - 6);
            }
            pop.style.left = left + 'px';
            pop.style.top = top + 'px';
        });
        window.addEventListener('scroll', hide, { passive: true });
    }
    // innerWidth can read 0 in hidden/prerendered contexts — don't fold the desktop sidebar then.
    if (window.innerWidth > 0 && window.innerWidth < 768) {
        document.querySelectorAll('.sidebar details.section[open]').forEach(d => d.removeAttribute('open'));
    }
    // Floating jump button — display is CSS-gated to small screens.
    const jump = document.createElement('button');
    jump.id = 'mobile-jump';
    jump.type = 'button';
    jump.setAttribute('aria-label', 'Jump between inputs and results');
    jump.textContent = '⇅';
    jump.addEventListener('click', (e) => {
        e.stopPropagation();
        const main = document.querySelector('.main');
        const atInputs = window.scrollY + 10 < (main?.offsetTop ?? 0);
        (atInputs ? main : document.querySelector('.sidebar'))?.scrollIntoView({ behavior: 'smooth' });
    });
    document.body.appendChild(jump);
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
        pensionAnnual: 'Pension', pensionStartAge: 'Pension Age', survivorPct: 'Survivor%', pensionCola: 'Pension COLA',
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
    document.getElementById('ui-gk').classList.toggle('hidden', m !== 'gk' || !NERD_KNOBS);
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
    pensionAnnual:'pa', pensionStartAge:'psa', pensionCola:'pc', survivorPct:'sur', dividendRate:'div',
    STATEname:'s', ssFailYear:'sfy', ssFailPct:'sfp',
    growth:'g', cashYield:'cy', inflation:'inf', cpi:'cpi', futureIRATaxRate:'fitr',
    comp_IRA1_ratio:'c1r', comp_IRA1_intl:'c1x',
    comp_IRA2_ratio:'c2r', comp_IRA2_intl:'c2x',
    comp_Brokerage_ratio:'cbr', comp_Brokerage_intl:'cbx',
    comp_Roth1_ratio:'cr1r', comp_Roth1_intl:'cr1x',
    comp_Roth2_ratio:'cr2r', comp_Roth2_intl:'cr2x',
    'show-current-dollars':'cd', optimizeSpend:'opt', includeConvOpt:'copt',
    cyclicEnabled:'cyc',
    qcdHHMax:'qm', qcdAlways:'qa',
    gkGuard:'gkg', gkAdjPct:'gka',
};

const OPT_SHORT_TO_LONG = Object.fromEntries(
    Object.entries(OPT_LONG_TO_SHORT).map(([l, s]) => [s, l])
);

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

// Pristine default snapshot — captured once at init BEFORE loadFromURL mutates any field.
// Single source of truth for default-omission: buildShareURL omits a param when its current
// value equals this snapshot, and loadFromURL leaves absent params at their (default) markup
// value, so the two stay symmetric.
const OPT_DEFAULTS = {};
function captureDefaults() {
    document.querySelectorAll('.sidebar input, .sidebar select').forEach(el => {
        if (!el.id) return;
        if (el.type === 'checkbox') {
            OPT_DEFAULTS[el.id] = { c: el.checked };
        } else {
            // Normalize dollars numerically so the comparison is robust to formatting.
            const num = DisplayHelpers.parseShorthand(el.value);   // null for non-numeric (selects/strings)
            OPT_DEFAULTS[el.id] = { v: el.value, n: num };
        }
    });
}

function buildShareURL() {
    const params = new URLSearchParams();
    document.querySelectorAll('.sidebar input, .sidebar select').forEach(el => {
        if (!el.id) return;
        const def = OPT_DEFAULTS[el.id];
        const short = OPT_LONG_TO_SHORT[el.id] ?? el.id;
        if (el.type === 'checkbox') {
            if (def && el.checked === def.c) return;                 // omit default
            params.set(short, el.checked ? '1' : '0');
        } else if (el.dataset.numVal !== undefined) {               // dollar field
            const cur = Number(el.dataset.numVal);
            if (def && def.n !== null && cur === def.n) return;     // omit default
            params.set(short, compactNum(el.dataset.numVal));
        } else {
            if (def && el.value === def.v) return;                  // omit default
            params.set(short, el.value);
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

if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
        const panel = document.getElementById('share-panel');
        if (panel && panel.style.display === 'block' &&
            !panel.contains(e.target) &&
            !e.target.closest('[onclick="toggleSharePanel()"]')) {
            panel.style.display = 'none';
        }
    });
}

function loadFromURL() {
    const raw = new URLSearchParams(location.search);
    if (!raw.size) return;
    const params = new URLSearchParams();
    raw.forEach((v, k) => params.set(OPT_SHORT_TO_LONG[k] ?? k, v));
    params.forEach((value, key) => {
        const el = document.getElementById(key);
        if (!el) return;
        if (el.type === 'checkbox') {
            el.checked = (value === '1' || value === 'true');   // new '1'/'0' + legacy 'true'/'false'
        } else {
            const decoded = DisplayHelpers.parseShorthand(value);
            if (decoded !== null && (el.type === 'text' || el.type === '')) {
                el.dataset.numVal = String(decoded);
                el.value = DisplayHelpers.formatDollar(decoded);
            } else {
                el.value = value;
                if (el.tagName === 'SELECT' && el.selectedIndex === -1) {
                    // Legacy case-mismatch (e.g. old shared links using 'irmaa2' before the
                    // IRMAA-casing cleanup renamed dropdown values to 'IRMAA2') — a native
                    // <select> silently deselects on a case-sensitive miss, so fall back to a
                    // case-insensitive option match to keep old URLs working.
                    const match = Array.from(el.options).find(o => o.value.toLowerCase() === value.toLowerCase());
                    if (match) el.value = match.value;
                }
            }
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
        if (el) el.value = `IRMAA${data.stratIRMAATier}`;
    } else if ((data.stratACAMultiple ?? 0) > 0) {
        const el = document.getElementById('stratRate');
        if (el) el.value = `aca${data.stratACAMultiple}`;
    }

    // 'aca' is an internal strict strategy; the dropdown represents it as 'bracket' + ACA
    // stratRate (set above). Map it back so the (option-less) strategy dropdown stays valid.
    if (data.strategy === 'aca') {
        const el = document.getElementById('strategy');
        if (el) el.value = 'bracket';
    }

    // qcdMode is stored as 'always'/'asneeded' string but the UI element is qcdAlways checkbox
    if (data.qcdMode !== undefined) {
        const el = document.getElementById('qcdAlways');
        if (el) el.checked = (data.qcdMode === 'always');
    }

    for (const [key, value] of Object.entries(data)) {
        // stratIRMAATier has no standalone form element; handled above via stratRate dropdown
        if (key === 'stratIRMAATier') continue;
        if (key === 'stratACAMultiple') continue;
        // strategy='aca' has no dropdown option; mapped to 'bracket' above
        if (key === 'strategy' && value === 'aca') continue;
        // qcdMode maps to qcdAlways checkbox; handled above
        if (key === 'qcdMode') continue;
        const element = document.getElementById(key);
        if (element) {
            // Handle percentage values (multiply by 100 for display). getInputs() stores these as
            // decimals (e.g. gkGuard 20% → 0.20), so they MUST be scaled back ×100 on load or the
            // field shows 0.2 and the next getInputs() re-divides to 0.002 (GK then reads guard=0).
            if (['spendChange', 'inflation', 'cpi', 'growth',
                'cashYield', 'dividendRate', 'ssFailPct',
                'propWithdraw', 'iraWithdrawPct',
                'gkGuard', 'gkAdjPct', 'futureIRATaxRate'].includes(key)) {
                element.value = (value * 100).toFixed(3);
            } else if (key === 'stratRate' && ((data.stratIRMAATier ?? -1) >= 0 || (data.stratACAMultiple ?? 0) > 0)) {
                // Already set the dropdown above (IRMAA or ACA); skip numeric override
            } else if (key === 'stratRate') {
                element.value = (value * 100).toFixed(3);
            } else {
                if (['maxConversion', 'pensionCola', 'dividendReinvest', 'cyclicEnabled'].includes(key)) {
                    element.checked = !!value;
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

    // Refresh derived/display fields that normally update via oninput handlers. Setting .value
    // programmatically does NOT fire those handlers, so the "Real Growth" line, age/RMD readouts,
    // bracket dropdown, and other hints would otherwise show stale values after a scenario load.
    if (typeof updateGrowthDisplay === 'function') updateGrowthDisplay();      // Real Growth under Growth field (uses growth, inflation, dividendRate)
    if (typeof syncMCMuFromGrowth === 'function') syncMCMuFromGrowth();        // MC μ tracks Growth
    if (typeof updateProfileAgeDisplay === 'function') updateProfileAgeDisplay(); // ages / RMD start / projected RMD
    if (typeof refreshStratRateOptions === 'function') refreshStratRateOptions(); // bracket/IRMAA labels (CPI + filing status)
    if (typeof updateBracketFeedback === 'function') updateBracketFeedback();
    if (typeof updateSuggestSpendTooltip === 'function') updateSuggestSpendTooltip();
    if (typeof updateIRAGoalHint === 'function') updateIRAGoalHint();
    if (typeof updateCompAdvisory === 'function') updateCompAdvisory();

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
                    // Apply immediately so Import also loads into the form (not just stages to
                    // localStorage). scenario.data is the field map; fall back to scenario for
                    // legacy flat exports without a .data wrapper.
                    applyScenario(scenario.data ?? scenario);
                    showMessage(`Scenario "${name}" imported and loaded!`, 'success');
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
 * Shows real (after-inflation) growth and flags unusually high/low nominal rates.
 * Called from growth and inflation oninput handlers and on DOMContentLoaded.
 */
function updateGrowthDisplay() {
    const el = document.getElementById('growth-info');
    if (!el) return;
    const growth    = parseFloat(document.getElementById('growth')?.value);
    const inflation = parseFloat(document.getElementById('inflation')?.value);
    if (isNaN(growth) || isNaN(inflation)) { el.innerHTML = ''; return; }

    // Fisher equation: real = (1+g)/(1+d)/(1+i) - 1, including dividend yield
    const div = parseFloat(document.getElementById('dividendRate')?.value) || 0;
    const realPct = ((1 + growth / 100) * (1 + div / 100) / (1 + inflation / 100) - 1) * 100;
    const sign = realPct >= 0 ? '+' : '';
    const totalNominal = growth + div;
    let html = `Real growth: <strong>${sign}${realPct.toFixed(1)}%</strong>`
             + ` <span style="color:#888;">(${totalNominal.toFixed(1)}% nominal [${growth}% price + ${div}% div] &minus; ${inflation}% inflation)</span>`;

    if (growth > 10) {
        html += `<br><span style="color:#b45309;">⚠ Optimistic — S&amp;P 500 long-run nominal CAGR is ~10%; diversified portfolios typically 6–9%.</span>`;
    } else if (growth < 3) {
        html += `<br><span style="color:#b45309;">⚠ Pessimistic — below typical equity range (6–10% nominal). Appropriate only for very conservative (mostly-bond) allocations.</span>`;
    }

    el.innerHTML = html;
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

    // Federal bracket containing the selected ceiling — useful when the strategy is an IRMAA/ACA
    // tier (whose label shows no federal rate). bracketLimit is already CPI-adjusted current-$.
    const fedRate = federalBracketRateAt(bracketLimit);
    const fedNote = fedRate != null ? ` <span style="color:#888;">(${fedRate}% federal bracket)</span>` : '';

    // Estimate max feasible spend (simplified: bracket limit is approx max MAGI)
    // In reality this depends on tax rates and account composition, but this gives a rough indicator
    const estimatedMaxSpend = Math.round(bracketLimit * 0.95); // Slight buffer for estimation error

    if (spendGoal <= estimatedMaxSpend) {
        // Within bracket
        feedbackEl.innerHTML = `✓ Bracket allows ~$${estimatedMaxSpend.toLocaleString()} / year${fedNote}`;
        feedbackEl.style.color = '#4a7c4e';
    } else {
        // Over bracket — clicking adjusts spendGoal down to the bracket max
        const shortfall = Math.round(spendGoal - estimatedMaxSpend);
        feedbackEl.innerHTML = `<span style="cursor:pointer;text-decoration:underline;text-decoration-style:dotted;"
            title="Click to set After-Tax Spend to bracket maximum"
            onclick="DisplayHelpers.setDollarValue('spendGoal',${estimatedMaxSpend});runSimulation();"
            >⚠ Over bracket by ~$${shortfall.toLocaleString()} / year — click to adjust</span>${fedNote}`;
        feedbackEl.style.color = '#d4811f';
    }
    updateSuggestSpendTooltip();
}

// Federal marginal-rate % for a given CPI-adjusted (current-year $) income, or null. Mirrors the
// CPI compounding in generateStratRateOptions so the boundary lines up with the dropdown limits.
function federalBracketRateAt(income) {
    if (!isFinite(income) || income <= 0) return null;
    const cpi = (+document.getElementById('cpi')?.value || 2.8) / 100;
    const cpiAdj = Math.pow(1 + cpi, Math.max(0, new Date().getFullYear() - TAX_DATA_BASE_YEAR));
    const status = getDropdownStatus();
    const brks = (status === 'MFJ' ? TAXData.FEDERAL.MFJ : TAXData.FEDERAL.SGL).brackets;
    for (const b of brks) {
        if (income <= b.l * cpiAdj) return Math.round(b.r * 100);
    }
    return Math.round(brks[brks.length - 1].r * 100);
}

// Prior spendGoal value before user clicked the suggest icon (null = not in suggest mode).
let _priorSpendGoal = null;

function computeSuggestedSpend() {
    const inp = getInputs();
    const totalAssets = (inp.IRA1||0) + (inp.IRA2||0) + (inp.Roth||0) + (inp.Roth2||0) + (inp.Brokerage||0) + (inp.Cash||0);
    const portfolioWd  = 0.05 * totalAssets;
    const gross        = (inp.ss1||0) + (inp.ss2||0) + (inp.pensionAnnual||0) + portfolioWd;

    const status    = inp.hasSpouse ? 'MFJ' : 'SGL';
    const retireAge = inp.startAge || (new Date().getFullYear() - (inp.birthyear1||1960));
    const spAge     = inp.hasSpouse ? (retireAge + (inp.birthyear1||1960) - (inp.birthyear2||1960)) : 0;
    const ages      = inp.hasSpouse ? [retireAge, spAge] : [retireAge];
    const birthyears = inp.hasSpouse ? [inp.birthyear1||0, inp.birthyear2||0] : [inp.birthyear1||0];

    const taxes = calculateTaxes({
        filingStatus: status,
        totalSS:      (inp.ss1||0) + (inp.ss2||0),
        earnedIncome: (inp.pensionAnnual||0) + portfolioWd,
        pensionIncome:(inp.pensionAnnual||0), iraIncome: portfolioWd,
        state:        inp.STATEname || 'CA',
        ages,
        birthyears,
        inflation:    1.0,
    });

    const afterTax = Math.max(0, gross - (taxes.totalTax || 0));
    return { gross, afterTax };
}

function updateSuggestSpendTooltip() {
    const icon = document.getElementById('suggest-spend-icon');
    if (!icon) return;
    const { afterTax } = computeSuggestedSpend();
    icon.style.display = afterTax > 0 ? '' : 'none';
    if (_priorSpendGoal !== null) {
        icon.title = `Restore: $${Math.round(_priorSpendGoal).toLocaleString()}`;
    } else {
        icon.title = `Suggested goal: $${Math.round(afterTax).toLocaleString()}`;
    }
}

function applySuggestSpend() {
    if (_priorSpendGoal !== null) {
        DisplayHelpers.setDollarValue('spendGoal', Math.round(_priorSpendGoal));
        _priorSpendGoal = null;
    } else {
        const el = document.getElementById('spendGoal');
        const raw = parseFloat((el?.dataset?.numVal) || (el?.value || '').replace(/[^\d.-]/g, '') || '0');
        _priorSpendGoal = raw;
        const { afterTax } = computeSuggestedSpend();
        DisplayHelpers.setDollarValue('spendGoal', Math.round(afterTax));
    }
    updateSuggestSpendTooltip();
    updateBracketFeedback();
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
    updateACAWarning();
}

/**
 * Shows/hides the ACA Medicare warning based on retirement-start ages.
 * - Both persons ≥65 at retirement start → disable ACA options + "grayed" note.
 * - Exactly one person ≥65                → advisory warning, options still active.
 * Called from updateProfileAgeDisplay(), refreshStratRateOptions(), and startAge oninput.
 */
// True when both persons (or the sole person) are 65+ at retirement start — i.e. on Medicare,
// so ACA income-limit strategies are irrelevant. Pure; shared by the UI warning + optimizer.
function bothOnMedicareAtStart(by1, startAge, hasSpouse, by2) {
    if (!by1 || !startAge) return false;
    const startYear  = by1 + startAge;
    const p1Medicare = startAge >= 65;
    const p2Medicare = hasSpouse && by2 > 0 && (startYear - by2) >= 65;
    return hasSpouse ? (p1Medicare && p2Medicare) : p1Medicare;
}

function updateACAWarning() {
    const sel     = document.getElementById('stratRate');
    const warnEl  = document.getElementById('aca-age-warn');
    if (!sel || !warnEl) return;

    // No ACA options present (nerd mode off, item 12) → nothing to warn about.
    if (![...sel.options].some(o => o.value.startsWith('aca'))) { warnEl.style.display = 'none'; return; }

    const by1       = +val('birthyear1') || 0;
    const startAge  = +val('startAge')   || 0;
    const hasSpouse = !!valChecked('hasSpouse');
    const by2       = hasSpouse ? (+val('birthyear2') || 0) : 0;

    if (!by1 || !startAge) { warnEl.style.display = 'none'; return; }

    const startYear    = by1 + startAge;
    const p1Medicare   = startAge >= 65;
    const p2Medicare   = hasSpouse && by2 > 0 && (startYear - by2) >= 65;
    const bothMedicare = bothOnMedicareAtStart(by1, startAge, hasSpouse, by2);
    const oneMedicare  = hasSpouse && (p1Medicare !== p2Medicare);

    // Disable / re-enable ACA <option>s
    for (const opt of sel.options) {
        if (!opt.value.startsWith('aca')) continue;
        opt.disabled = bothMedicare;
        opt.style.color = bothMedicare ? '#aaa' : '';
    }
    // If a now-disabled ACA option is selected, switch to first enabled option
    if (bothMedicare && sel.value.startsWith('aca')) {
        const first = [...sel.options].find(o => !o.disabled);
        if (first) { sel.value = first.value; updateBracketFeedback(); }
    }

    if (bothMedicare) {
        warnEl.textContent = '⚠ Both persons will be on Medicare at retirement start (age 65+) — ACA options are unavailable.';
        warnEl.style.display = 'block';
    } else if (oneMedicare) {
        const who = p1Medicare ? 'You' : 'Spouse';
        warnEl.textContent = `⚠ ${who} will already be on Medicare at retirement start — ACA income limits apply only to the other person.`;
        warnEl.style.display = 'block';
    } else {
        warnEl.style.display = 'none';
    }
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
    for (let i = 0; i < fedBrks.length; i++) {
        const ratePct = Math.round(fedBrks[i].r * 100);
        const isTop   = !isFinite(fedBrks[i].l);   // 37% bracket — unbounded, shown for reference
        const limit   = isTop ? Infinity : Math.round(fedBrks[i].l * cpiAdj);
        options.push({
            value: String(ratePct),
            label: isTop ? `${ratePct}% Fed  ·  no limit` : `${ratePct}% Fed  ·  $${limit.toLocaleString()}`,
            limit,
            defaultSelected: false
        });
    }

    // ── IRMAA tier ceilings (tiers 0-4) ───────────────────────────────────────
    // Ceiling = start of NEXT tier - 1. IRMAA thresholds also grow at CPI.
    const IRMAABrks = isMFJ
        ? TAXData.IRMAA.MFJ.brackets
        : TAXData.IRMAA.SGL.brackets;
    const IRMAALabels = [
        'Below IRMAA',
        'IRMAA Tier 1',
        'IRMAA Tier 2',
        'IRMAA Tier 3',
        'IRMAA Tier 4'
    ];
    for (let i = 0; i < 5; i++) {
        const limit = Math.round((IRMAABrks[i + 1].l - 1) * cpiAdj);
        options.push({
            value: `IRMAA${i}`,
            label: `${IRMAALabels[i]}  ·  $${limit.toLocaleString()}`,
            limit,
            defaultSelected: i === 0
        });
    }

    // ── ACA FPL cliffs ────────────────────────────────────────────────────────
    // Nerd-mode only (item 12): the ACA cliff model is rough, so these options are hidden from the
    // bracket dropdown unless ?nerdknob is on (or the hidden runtime toggle is enabled).
    // FPL base (2025): 2-person $20,440; 1-person $15,060. CPI-approx for future years.
    const FPL_BASE_YEAR = 2025;
    const fplBase = isMFJ ? 20440 : 15060;
    const fplCpiAdj = Math.pow(1 + cpi, Math.max(0, currentYear - FPL_BASE_YEAR + 1));
    const acaEntries = NERD_KNOBS ? [
        { pct: 200, label: 'ACA 200% FPL' },
        { pct: 250, label: 'ACA 250% FPL' },
        { pct: 300, label: 'ACA 300% FPL' },
        { pct: 400, label: 'ACA 400% FPL ⚠️' },
    ] : [];
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


