/**
 * Comprehensive retirement projection with proper account tracking and growth rates
 */

/**
 * Main projection function - projects retirement year-by-year until last person dies
 * 
 * @param {Object} params - Configuration object
 * @param {number} params.currentYear - Starting year
 * @param {string} params.state - State abbreviation for taxes
 * 
 * @param {Array} params.persons - Array of person objects
 * @param {string} params.persons[].name - Name for reporting
 * @param {number} params.persons[].birthYear - Birth year
 * @param {number} params.persons[].birthMonth - Birth month (1-12)
 * @param {number} params.persons[].longevity - Age at death
 * @param {number} params.persons[].ira - Current IRA balance
 * @param {number} params.persons[].roth - Current Roth balance
 * @param {Object} params.persons[].socialSecurity - SS configuration
 * @param {Array} params.persons[].pensions - Array of pension objects
 * @param {Array} params.persons[].earnedIncome - Array of earned income objects
 * 
 * @param {Object} params.jointAccounts - Joint account balances
 * @param {number} params.jointAccounts.brokerage - Brokerage balance
 * @param {number} params.jointAccounts.brokerageBasis - Cost basis
 * @param {number} params.jointAccounts.cash - Cash balance
 * 
 * @param {Object} params.investmentRates - Yield rates as percentages of brokerage
 * @param {number} params.investmentRates.ordDivYield - Ordinary dividend yield (e.g., 0.0202 for 2.02%)
 * @param {number} params.investmentRates.qualDivYield - Qualified dividend yield
 * 
 * @param {Object} params.spending - Spending configuration
 * @param {number} params.spending.annual - Annual spending in current dollars
 * @param {number} params.spending.spendDelta - Real spending change (e.g., -0.01 for -1% real)
 * @param {number} params.spending.survivorSpendingPct - Survivor spending as % of couple (e.g., 0.70)
 * 
 * @param {Object} params.growthRates - Asset growth rates
 * @param {number} params.growthRates.ira - IRA growth rate
 * @param {number} params.growthRates.roth - Roth growth rate
 * @param {number} params.growthRates.brokerage - Brokerage growth rate (before dividends)
 * @param {number} params.growthRates.cashYield - Cash interest rate
 * @param {number} params.growthRates.inflation - General inflation
 * @param {number} params.growthRates.ssInflation - Social Security COLA
 * 
 * @param {Object} params.ssBenefitCut - Optional SS benefit cut
 * @param {number} params.ssBenefitCut.year - Year of cut (e.g., 2033)
 * @param {number} params.ssBenefitCut.factor - Remaining benefit (e.g., 0.77 for 23% cut)
 * 
 * @param {Function} params.strategy - Strategy function(yearData) => actions
 * 
 * @returns {Array} Array of yearly results with balances, income, taxes, metrics
 */
function projectRetirementYears(params) {
    const {
        currentYear,
        state,
        persons,
        jointAccounts,
        investmentRates,
        spending,
        growthRates,
        ssBenefitCut,
        strategy
    } = params;
    
    // ========================================================================
    // Initialize tracking variables
    // ========================================================================
    const results = [];
    
    // Mark everyone as initially alive
    persons.forEach(p => p.alive = true);
    
    // Determine projection length (until last person dies)
    const maxLongevity = Math.max(...persons.map(p => p.longevity));
    const youngestBirthYear = Math.min(...persons.map(p => p.birthYear));
    const projectionYears = maxLongevity - (currentYear - youngestBirthYear);
    
    // Initialize account balances
    let iras = persons.map(p => p.ira);
    let roths = persons.map(p => p.roth);
    let brokerage = jointAccounts.brokerage;
    let brokerageBasis = jointAccounts.brokerageBasis;
    let cash = jointAccounts.cash;
    
    // Initialize cumulative inflation trackers
    let cumulativeInflation = 1.0;
    let cumulativeSSInflation = 1.0;
    
    // ========================================================================
    // Year-by-year projection loop
    // ========================================================================
    for (let year = 0; year < projectionYears; year++) {
        const projYear = currentYear + year;
        
        // ====================================================================
        // STEP 1: Update who is alive
        // ====================================================================
        updateAliveStatus(persons, projYear);
        
        // Stop if everyone is dead
        if (!anyoneAlive(persons)) break;
        
        // Determine filing status based on who's alive
        const aliveCount = persons.filter(p => p.alive).length;
        const filingStatus = aliveCount >= 2 ? 'MFJ' : 'SGL';
        
        // ====================================================================
        // STEP 2: Update inflation factors
        // ====================================================================
        cumulativeInflation *= (1 + growthRates.inflation);
        cumulativeSSInflation *= (1 + growthRates.ssInflation);
        
        // ====================================================================
        // STEP 3: Calculate ages for all persons
        // ====================================================================
        const ages = persons.map(p => projYear - p.birthYear);
        
        // ====================================================================
        // STEP 4: Calculate RMDs for each person
        // ====================================================================
        const rmds = persons.map((person, i) => {
            if (!person.alive) return 0;
            return iras[i] * getRMDPercentage(projYear, person.birthYear);
        }); // rmds
        
        // ====================================================================
        // STEP 5: Calculate income components
        // ====================================================================
        // Social Security benefit cut factor
        let ssBenefitFactor = 1.0;
        if (ssBenefitCut && projYear >= ssBenefitCut.year) {
            ssBenefitFactor = ssBenefitCut.factor;
        } // SS benefit cut
        
        const totalSS = calculateTotalSocialSecurity(persons, projYear, 
            cumulativeSSInflation, ssBenefitFactor);
        const totalPension = calculateTotalPensions(persons, projYear, cumulativeInflation);
        const totalEarned = calculateTotalEarnedIncome(persons, projYear, cumulativeInflation);
        
        // Investment income from brokerage (as percentage of balance)
        const ordDivInterest = brokerage * investmentRates.ordDivYield;
        const qualifiedDiv = brokerage * investmentRates.qualDivYield;
        
        // Cash interest
        const cashInterest = cash * growthRates.cashYield;
        
        // ====================================================================
        // STEP 6: Calculate spending need
        // ====================================================================
        const spendingGrowthFactor = Math.pow(1 + growthRates.inflation + spending.spendDelta, year);
        const baseSpending = spending.annual * spendingGrowthFactor;
        const annualSpending = getAdjustedSpending(persons, baseSpending, spending.survivorSpendingPct);
        
        // ====================================================================
        // STEP 7: Prepare data for strategy function
        // ====================================================================
        const yearData = {
            year: projYear,
            ages: ages,
            personsAlive: persons.map(p => p.alive),
            filingStatus: filingStatus,
            
            balances: {
                iras: [...iras],  // Copy arrays
                roths: [...roths],
                brokerage: brokerage,
                brokerageBasis: brokerageBasis,
                cash: cash
            },
            
            income: {
                socialSecurity: totalSS,
                pension: totalPension,
                earnedIncome: totalEarned,
                ordDivInterest: ordDivInterest,
                qualifiedDiv: qualifiedDiv,
                cashInterest: cashInterest
            },
            
            rmds: [...rmds],
            
            spending: annualSpending,
            
            inflation: {
                cumulative: cumulativeInflation,
                ssCumulative: cumulativeSSInflation
            }
        }; // yearData
        
        // ====================================================================
        // STEP 8: Call strategy to determine actions
        // ====================================================================
        const actions = strategy(yearData);
        
        // ====================================================================
        // STEP 9: Validate and enforce constraints on actions
        // ====================================================================
        // Ensure withdrawals don't exceed balances
        const iraWithdrawals = actions.iraWithdrawals.map((amt, i) => 
            Math.min(amt || 0, iras[i])
        );
        
        const rothWithdrawals = actions.rothWithdrawals.map((amt, i) => 
            Math.min(amt || 0, roths[i])
        );
        
        const brokerageWithdraw = Math.min(actions.brokerageWithdraw || 0, brokerage);
        const cashWithdraw = Math.min(actions.cashWithdraw || 0, cash);
        
        // Conversions can't exceed IRA balance after withdrawals
        const rothConversions = actions.rothConversions.map((amt, i) => 
            Math.min(amt || 0, iras[i] - iraWithdrawals[i])
        );
        
        // Ensure RMDs are met
        persons.forEach((person, i) => {
            if (!person.alive) return;
            
            const totalIRAOut = iraWithdrawals[i] + rothConversions[i];
            if (totalIRAOut < rmds[i]) {
                const shortfall = rmds[i] - totalIRAOut;
                iraWithdrawals[i] += shortfall;
            } // RMD enforcement
        }); // RMD check loop
        
        // ====================================================================
        // STEP 10: Calculate capital gains from brokerage withdrawal
        // ====================================================================
        const brokerageResult = calculateBrokerageWithdrawal(
            brokerageWithdraw,
            brokerage,
            brokerageBasis
        );
        
        // ====================================================================
        // STEP 11: Calculate taxes
        // ====================================================================
        const totalIRAWithdrawals = iraWithdrawals.reduce((sum, amt) => sum + amt, 0);
        
        const taxParams = {
            filingStatus: filingStatus,
            ages: ages.filter((_, i) => persons[i].alive),
            earnedIncome: totalIRAWithdrawals + totalEarned + totalPension,
            ss1: persons[0]?.alive ? calculatePersonSS(persons[0], projYear, cumulativeSSInflation, ssBenefitFactor) : 0,
            ss2: persons[1]?.alive ? calculatePersonSS(persons[1], projYear, cumulativeSSInflation, ssBenefitFactor) : 0,
            ordDivInterest: ordDivInterest,
            qualifiedDiv: qualifiedDiv,
            capGains: brokerageResult.capitalGains,
            taxExemptInterest: 0,
            hsaContrib: 0,
            inflation: cumulativeInflation,
            state: state
        }; // taxParams
        
        const taxResult = calculateTaxes(taxParams);
        
        // ====================================================================
        // STEP 12: Calculate cash flows
        // ====================================================================
        const totalRothWithdrawals = rothWithdrawals.reduce((sum, amt) => sum + amt, 0);
        
        // Income available (before taxes)
        const totalIncome = totalSS + totalPension + totalEarned + 
                           totalIRAWithdrawals + totalRothWithdrawals +
                           brokerageWithdraw + cashWithdraw;
        
        // Taxes owed
        const taxesPaid = taxResult.totalTax;
        
        // After-tax income
        const afterTaxIncome = totalIncome - taxesPaid;
        
        // Surplus/deficit
        const surplus = afterTaxIncome - annualSpending;
        
        // ====================================================================
        // STEP 13: Accrue dividends and interest to cash
        // ====================================================================
        // Add investment income and cash interest to cash account
        cash += ordDivInterest + qualifiedDiv + cashInterest;
        
        // ====================================================================
        // STEP 14: Pay taxes and spending from cash/brokerage
        // ====================================================================
        const totalCashNeeded = taxesPaid + annualSpending;
        const availableCash = cash + cashWithdraw;
        
        let actualCashUsed = Math.min(totalCashNeeded, availableCash);
        let additionalBrokerageNeeded = Math.max(0, totalCashNeeded - availableCash);
        
        // If need to sell more brokerage for taxes/spending
        let additionalBrokerageResult = { withdrawn: 0, capitalGains: 0, basisChange: 0 };
        if (additionalBrokerageNeeded > 0) {
            additionalBrokerageResult = calculateBrokerageWithdrawal(
                additionalBrokerageNeeded,
                brokerage - brokerageWithdraw,
                brokerageBasis - brokerageResult.basisChange
            );
            
            // This creates additional capital gains - need to recalculate taxes (simplified)
            const additionalCapGainsTax = additionalBrokerageResult.capitalGains * 
                taxResult.federalMarginalRate * 1.15;  // Approximate with marginal rate
            
            // Might need even more brokerage to pay tax on cap gains
            if (additionalCapGainsTax > 0) {
                const extraBrokerageResult = calculateBrokerageWithdrawal(
                    additionalCapGainsTax,
                    brokerage - brokerageWithdraw - additionalBrokerageResult.withdrawn,
                    brokerageBasis - brokerageResult.basisChange - additionalBrokerageResult.basisChange
                );
                
                additionalBrokerageNeeded += extraBrokerageResult.withdrawn;
                additionalBrokerageResult.withdrawn += extraBrokerageResult.withdrawn;
                additionalBrokerageResult.capitalGains += extraBrokerageResult.capitalGains;
                additionalBrokerageResult.basisChange += extraBrokerageResult.basisChange;
            } // extra brokerage for cap gains tax
        } // additional brokerage needed
        
        // ====================================================================
        // STEP 15: Update account balances for end of year
        // ====================================================================
        // IRAs: subtract withdrawals and conversions, then grow
        iras = iras.map((balance, i) => 
            (balance - iraWithdrawals[i] - rothConversions[i]) * (1 + growthRates.ira)
        );
        
        // Roths: add conversions, subtract withdrawals, then grow
        roths = roths.map((balance, i) => 
            (balance + rothConversions[i] - rothWithdrawals[i]) * (1 + growthRates.roth)
        );
        
        // Brokerage: subtract withdrawals (including additional for taxes), then grow
        const totalBrokerageOut = brokerageWithdraw + additionalBrokerageNeeded;
        brokerage = (brokerage - totalBrokerageOut) * (1 + growthRates.brokerage);
        
        // Basis: reduce by total basis in withdrawals
        const totalBasisReduction = brokerageResult.basisChange + additionalBrokerageResult.basisChange;
        brokerageBasis = Math.max(0, brokerageBasis - totalBasisReduction);
        
        // Cash: add income, subtract withdrawals and spending/taxes not covered
        // Cash already has dividends/interest added
        cash = cash - actualCashUsed;
        
        // ====================================================================
        // STEP 16: Store results for this year
        // ====================================================================
        const totalAssets = iras.reduce((s, v) => s + v, 0) + 
                           roths.reduce((s, v) => s + v, 0) +
                           brokerage + cash;
        
        results.push({
            year: projYear,
            ages: [...ages],
            personsAlive: persons.map(p => p.alive),
            filingStatus: filingStatus,
            
            // Account balances (end of year)
            balances: {
                iras: [...iras],
                roths: [...roths],
                brokerage: brokerage,
                brokerageBasis: brokerageBasis,
                cash: cash,
                totalAssets: totalAssets
            },
            
            // Actions taken this year
            actions: {
                rmds: [...rmds],
                iraWithdrawals: [...iraWithdrawals],
                rothConversions: [...rothConversions],
                rothWithdrawals: [...rothWithdrawals],
                brokerageWithdraw: totalBrokerageOut,
                cashWithdraw: actualCashUsed
            },
            
            // Income breakdown
            income: {
                socialSecurity: totalSS,
                pension: totalPension,
                earnedIncome: totalEarned,
                ordDivInterest: ordDivInterest,
                qualifiedDiv: qualifiedDiv,
                cashInterest: cashInterest,
                capitalGains: brokerageResult.capitalGains + additionalBrokerageResult.capitalGains,
                totalIncome: totalIncome
            },
            
            // Spending and surplus
            spending: {
                annual: annualSpending,
                taxes: taxesPaid,
                afterTaxIncome: afterTaxIncome,
                surplus: surplus
            },
            
            // Tax metrics
            taxes: {
                federal: taxResult.federalTax,
                state: taxResult.stateTax,
                total: taxResult.totalTax,
                agi: taxResult.AGI,
                irmaaMagi: taxResult.irmaaMagi,
                federalMarginalRate: taxResult.federalMarginalRate,
                stateMarginalRate: taxResult.stateMarginalRate,
                effectiveRate: taxResult.totalTax / Math.max(1, totalIncome)
            },
            
            // Inflation tracking
            inflation: {
                cumulative: cumulativeInflation,
                ssCumulative: cumulativeSSInflation
            }
        }); // results.push
        
    } // year loop
    
    return results;
} // projectRetirementYears()

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate individual person's Social Security for the year
 */
function calculatePersonSS(person, currentYear, cumulativeSSInflation, ssBenefitFactor) {
    if (!person.alive || !person.socialSecurity) return 0;
    
    const age = currentYear - person.birthYear;
    const ssStartYear = person.birthYear + person.socialSecurity.startAge;
    
    if (currentYear < ssStartYear) return 0;
    
    // First year proration
    let prorationFactor = 1.0;
    if (currentYear === ssStartYear) {
        const monthsCollecting = 13 - person.birthMonth;
        prorationFactor = monthsCollecting / 12;
    } // first year proration
    
    return person.socialSecurity.annualAmount * 
           cumulativeSSInflation * 
           ssBenefitFactor * 
           prorationFactor;
} // calculatePersonSS()

/**
 * Calculate total Social Security across all persons
 */
function calculateTotalSocialSecurity(persons, currentYear, cumulativeSSInflation, ssBenefitFactor) {
    return persons.reduce((total, person) => {
        return total + calculatePersonSS(person, currentYear, cumulativeSSInflation, ssBenefitFactor);
    }, 0);
} // calculateTotalSocialSecurity()

/**
 * Calculate total pension income with survivorship
 */
function calculateTotalPensions(persons, currentYear, cumulativeInflation) {
    let totalPension = 0;
    
    persons.forEach(person => {
        const age = currentYear - person.birthYear;
        
        if (!person.pensions) return;
        
        person.pensions.forEach(pension => {
            // Check if pension has started
            if (age < pension.startAge) return;
            
            // Check if pension has ended
            if (pension.endAge && age > pension.endAge) return;
            
            // Calculate amount
            let amount = pension.annualAmount;
            
            // If person deceased, apply survivorship
            if (!person.alive) {
                const anyoneAlive = persons.some(p => p.alive && p !== person);
                if (!anyoneAlive) return;
                amount *= pension.survivorshipPct;
            } // survivorship
            
            // Apply inflation if pension has COLA
            if (pension.inflationAdjusted) {
                amount *= cumulativeInflation;
            } // inflation adjustment
            
            totalPension += amount;
        }); // pension loop
    }); // person loop
    
    return totalPension;
} // calculateTotalPensions()

/**
 * Calculate total earned income
 */
function calculateTotalEarnedIncome(persons, currentYear, cumulativeInflation) {
    let totalEarned = 0;
    
    persons.forEach(person => {
        if (!person.alive) return;
        
        const age = currentYear - person.birthYear;
        
        if (!person.earnedIncome) return;
        
        person.earnedIncome.forEach(income => {
            if (age < income.startAge || age > income.endAge) return;
            
            let amount = income.annualAmount;
            if (income.inflationAdjusted) {
                amount *= cumulativeInflation;
            } // inflation adjustment
            
            totalEarned += amount;
        }); // income loop
    }); // person loop
    
    return totalEarned;
} // calculateTotalEarnedIncome()

/**
 * Update alive status for each person
 */
function updateAliveStatus(persons, currentYear) {
    persons.forEach(person => {
        const age = currentYear - person.birthYear;
        person.alive = age <= person.longevity;
    }); // person loop
} // updateAliveStatus()

/**
 * Check if anyone is still alive
 */
function anyoneAlive(persons) {
    return persons.some(p => p.alive);
} // anyoneAlive()

/**
 * Adjust spending for survivor
 */
function getAdjustedSpending(persons, baseSpending, survivorSpendingPct) {
    const aliveCount = persons.filter(p => p.alive).length;
    
    if (aliveCount === 1 && persons.length > 1) {
        return baseSpending * survivorSpendingPct;
    } // survivor adjustment
    
    return baseSpending;
} // getAdjustedSpending()