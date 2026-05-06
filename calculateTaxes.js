/**
 * Calculates Federal, State, Capital Gains (and NIIT) taxes with IRMAA.
 *
 * Inputs are as described below.
 * Outputs should include:
 *   totalTax, federalTax, stateTax, capitalGainsTax, niitTax, AGI, and
 *   the MAGI suitable for determining the IRMAA taxes in subsequent years.
 *
 * @param {Object} params - Input parameters
 * @param {string} params.filingStatus - 'MFJ' (Married Filing Jointly) or 'SGL' (Single).
 * @param {Array}  params.ages - Array of ages [age1, age2] or [age1] if single.
 * @param {number} params.earnedIncome - Total of W2, IRA/401k withdrawals, pensions and RMDs.
 * @param {number} params.totalSS - total social security income.
 * @param {number} params.ordDivInterest - Interest and Ordinary Dividends.
 * @param {number} params.qualifiedDiv - Qualified Dividends (taxed at lower rates Federally).
 * @param {number} params.capGains - Net Long Term Capital Gains.
 * @param {number} params.taxExemptInterest - Muni bond interest (non-taxable but used for SS/IRMAA/CA).
 * @param {number} params.hsaContrib - Total HSA contributions (deductible Fed, taxable CA).
 * @param {number} params.inflation - Inflation (CPI) multiplier for tax brackets (e.g., 1.025 for 2.5% cumulative).
 * @param {string} params.state - State abbreviation (e.g., 'CA', 'NONE').
 * @param {number} params.irmaaAnnualCost - Annual IRMAA premium cost (calculated externally from 2-year lookback MAGI)
 * @returns {Object} Comprehensive tax calculation results
 */
function calculateTaxes(params = {}) {
	// Destructure all parameters.
    const {
        irmaaAnnualCost = 0,
        filingStatus = 'MFJ',
        ages = [],
        earnedIncome = 0,
        totalSS = 0,
        ordDivInterest = 0,
        qualifiedDiv = 0,
        capGains = 0,
        taxExemptInterest = 0,
        hsaContrib = 0,
        inflation = 1.0,
        state = 'CA'
    } = params;

    // Normalize filing status to match TAXData keys
    const status = filingStatus ?? "MFJ";

    // ========================================================================
    // STEP 1: Calculate Federal Standard Deduction (including age adjustments)
    // ========================================================================
    const federalStdBase = TAXData.FEDERAL[status].std;
    const federalAgeThreshold = TAXData.FEDERAL[status].age;
    const federalAgeBump = TAXData.FEDERAL[status].stdbump;

    let federalStdDeduction = federalStdBase * inflation;

    // Add age-based additional standard deduction
    if (ages[0] >= federalAgeThreshold) {
        federalStdDeduction += federalAgeBump * inflation;
    } // ages[0] check

    if (status === 'MFJ' && ages.length > 1 && ages[1] >= federalAgeThreshold) {
        federalStdDeduction += federalAgeBump * inflation;
    } // ages[1] check for MFJ

	// ========================================================================
	// STEP 2: Calculate Social Security Taxability (Federal)
	// ========================================================================
	// Get SS taxability brackets using helper function
	const ssBrackets = getRateBracket('SOCIALSECURITY', status);
	if (!ssBrackets) {
		return { error: `Unable to retrieve Social Security brackets for status: ${status}` };
	} // SS brackets validation

	// Provisional Income = AGI (before SS) + Tax-Exempt Interest + [rate%] of SS
	// The rate for provisional income is the second bracket rate (index 1)
	const provisionalIncomeRate = ssBrackets[1].r ?? 0;
	const provisionalIncome = (earnedIncome - hsaContrib + ordDivInterest +
							  qualifiedDiv + capGains + taxExemptInterest +
							  provisionalIncomeRate * totalSS);

	let taxableSS = 0;

	// Determine taxable portion based on provisional income
	if (provisionalIncome <= ssBrackets[0].l * inflation) {
		// Below first threshold - no SS is taxable
		taxableSS = 0;
	} else if (provisionalIncome <= ssBrackets[2].l * inflation) {
		// Between first and second threshold - taxable at tier 1 rate
		const threshold1 = ssBrackets[1].l * inflation;
		const tier1Rate = ssBrackets[1].r;
		const excessOver1 = provisionalIncome - threshold1;
		taxableSS = Math.min(tier1Rate * totalSS, tier1Rate * excessOver1);
	} else {
		// Above second threshold - taxable at tier 2 rate (with tier 1 portion)
		const threshold1 = ssBrackets[1].l * inflation;
		const threshold2 = ssBrackets[2].l * inflation;
		const tier1Rate = ssBrackets[1].r;
		const tier2Rate = ssBrackets[2].r;
		const excessOver2 = provisionalIncome - threshold2;

		// Calculate tier 1 amount (difference between thresholds at tier 1 rate)
		const tier1Amount = tier1Rate * (threshold2 - threshold1);

		// Calculate tier 2 amount (excess over threshold 2 at tier 2 rate)
		const tier2Amount = tier2Rate * excessOver2;

		// Total taxable SS is limited to tier 2 rate * total SS
		taxableSS = Math.min(tier2Rate * totalSS, tier1Amount + tier2Amount);
	} // SS taxability calculation

    // ========================================================================
    // STEP 3: Calculate Federal AGI and Taxable Income
    // ========================================================================
    const federalAGI = (earnedIncome - hsaContrib) + taxableSS + ordDivInterest +
                       qualifiedDiv + capGains;

    const federalTaxableIncome = Math.max(0, federalAGI - federalStdDeduction);

    // ========================================================================
    // STEP 4: Separate Ordinary and Preferentially-Taxed Income
    // ========================================================================
    // Ordinary income components (taxed at regular rates)
    const ordinaryIncomeInAGI = (earnedIncome - hsaContrib) + taxableSS + ordDivInterest;

    // Preferentially-taxed income (qualified dividends + long-term cap gains)
    const preferentialIncomeInAGI = qualifiedDiv + capGains;

    // Determine how much of taxable income is ordinary vs. preferential
    // Standard deduction comes off ordinary income first
    const taxableOrdinaryIncome = Math.max(0, Math.min(federalTaxableIncome,
                                            ordinaryIncomeInAGI - federalStdDeduction));
    const taxablePreferentialIncome = Math.max(0, federalTaxableIncome - taxableOrdinaryIncome);

    // ========================================================================
    // STEP 5: Calculate Federal Ordinary Income Tax
    // ========================================================================
    const federalOrdinaryResult = calculateProgressive('FEDERAL', status,
                                                       taxableOrdinaryIncome, inflation);
    const federalOrdinaryTax = federalOrdinaryResult.total;
    const federalMarginalRate = federalOrdinaryResult.marginal;

    // ========================================================================
    // STEP 6: Calculate Federal Capital Gains Tax (including NIIT)
    // ========================================================================
    // Capital gains brackets are based on total taxable income position
    // We start applying cap gains rates where ordinary income ended
    const capGainsBrackets = TAXData.FEDERAL.CAPITAL_GAINS[status].brackets;
    let federalCapGainsTax = 0;
    let remainingPreferential = taxablePreferentialIncome;
    let currentPosition = taxableOrdinaryIncome; // Start where ordinary income left off
	let capitalGainsRate = 0;

    // Apply capital gains rates based on position in total taxable income
    for (let i = 0; i < capGainsBrackets.length; i++) {
        const bracket = capGainsBrackets[i];
        const bracketLimit = bracket.l * inflation;
        const rate = bracket.r;

        // Skip brackets we've already passed
        if (currentPosition >= bracketLimit) {
            continue;
        } // bracket already passed
        capitalGainsRate = rate;

        // Calculate how much preferential income fits in this bracket
        const roomInBracket = bracketLimit - currentPosition;
        const amountInBracket = Math.min(remainingPreferential, roomInBracket);

        // Apply the rate to this portion
        federalCapGainsTax += amountInBracket * rate;
        remainingPreferential -= amountInBracket;
        currentPosition += amountInBracket;

        // Exit if we've taxed all preferential income
        if (remainingPreferential <= 0) {
            break;
        } // all preferential income taxed
    } // capital gains bracket loop

    // Total federal tax
    const federalTax = federalOrdinaryTax + federalCapGainsTax;

    // ========================================================================
    // STEP 7: Calculate State AGI and Taxable Income
    // ========================================================================
    // State differences from Federal AGI:
    // - California: HSA contributions are NOT deductible (add back)
    // - California: Social Security is NOT taxable (use different SS amount)
    // - California: No preferential rates for cap gains (all ordinary income)

    const stateData = TAXData[state];
    const stateSSTaxRate = stateData.SSTaxation || 0;

    // Calculate state-specific taxable SS
    const stateTaxableSS = totalSS * stateSSTaxRate;

    // State AGI calculation (CA adds back HSA)
    let stateAGI;
    if (state === 'CA') {
        // California: HSA not deductible, use state SS taxation rate
        stateAGI = earnedIncome + stateTaxableSS + ordDivInterest +
                   qualifiedDiv + capGains;
    } else {
        // Other states: may follow federal treatment more closely
        stateAGI = earnedIncome - hsaContrib + stateTaxableSS + ordDivInterest +
                   qualifiedDiv + capGains;
    } // state AGI calculation

    // State standard deduction
    const stateStdDeduction = stateData[status].std * inflation;

    // State taxable income
    const stateTaxableIncome = Math.max(0, stateAGI - stateStdDeduction);

    // ========================================================================
    // STEP 8: Calculate State Tax
    // ========================================================================
    const stateResult = calculateProgressive(state, status, stateTaxableIncome, inflation);
    const stateTax = stateResult.total;
    const stateMarginalRate = stateResult.marginal;

    // ========================================================================
    // STEP 9: Calculate IRMAA MAGI (for future year IRMAA determination)
    // ========================================================================
    // IRMAA MAGI = Federal AGI + Tax-Exempt Interest
    const irmaaMagi = federalAGI + taxExemptInterest;

    // ========================================================================
    // STEP 10: Calculate Total Tax and Return Results
    // ========================================================================
    const totalTax = federalTax + stateTax;
    const federalNominalRate = federalOrdinaryResult.nominalRate || 0;
    const stateNominalRate = stateResult.nominalRate || 0;
    const irmaaRate = federalAGI > 0 ? irmaaAnnualCost / federalAGI : 0;

    const nominalRate = federalNominalRate + stateNominalRate + irmaaRate;

    return {
        // Primary outputs requested
        nominalRate: nominalRate,
        federalNominalRate: federalNominalRate,
        stateNominalRate: stateNominalRate,
        irmaaRate: irmaaRate,
        irmaaAnnualCost: irmaaAnnualCost,
        totalTax: totalTax,
        federalTax: federalTax,
        stateTax: stateTax,
		state: stateTax,
        capitalGainsRate: capitalGainsRate,
        capitalGainsTax: federalCapGainsTax,  // Includes NIIT
        niitTax: 0,  // Included in capitalGainsTax (combined brackets)
        AGI: federalAGI,
        irmaaMagi: irmaaMagi,
        MAGI: irmaaMagi,

        // Additional detailed breakdown
        federalOrdinaryTax: federalOrdinaryTax,
        federalMarginalRate: federalMarginalRate,
		fedRate: federalMarginalRate,

        stateMarginalRate: stateMarginalRate,
		stRate: stateMarginalRate,

		fedLimit: federalOrdinaryResult.limit,
		stLimit: stateResult.limit,

        // Income components
        taxableSS: taxableSS,
        provisionalIncome: provisionalIncome,
        federalTaxableIncome: federalTaxableIncome,
        stateTaxableIncome: stateTaxableIncome,
        stateAGI: stateAGI,
        stagi: stateAGI,

        // Standard deductions applied
        federalStdDeduction: federalStdDeduction,
        stateStdDeduction: stateStdDeduction,

        // Income breakdown for verification
        ordinaryIncomeInAGI: ordinaryIncomeInAGI,
        preferentialIncomeInAGI: preferentialIncomeInAGI,
        taxableOrdinaryIncome: taxableOrdinaryIncome,
        taxablePreferentialIncome: taxablePreferentialIncome
    }; // return object
} // calculateTaxes()