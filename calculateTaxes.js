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
 * @param {boolean} params.obbaOn - Enable OBBBA provisions (senior deduction + elevated SALT cap). Default false.
 * @param {boolean} params.saltHigh - Use $40k SALT cap (OBBBA); false = $10k (TCJA). Only relevant when obbaOn=true. Default false.
 * @param {number}  params.propTax - Annual property + local taxes paid (used for SALT itemizing comparison). Default 0.
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
        state = 'CA',
        obbaOn = false,
        saltHigh = false,
        propTax = 0
    } = params;

    // Normalize filing status to match TAXData keys
    const status = filingStatus ?? "MFJ";

    // ========================================================================
    // STEP 1: Calculate Federal Deduction (standard + age bumps, vs SALT itemized)
    // ========================================================================
    const federalStdBase = TAXData.FEDERAL[status].std;
    const federalAgeThreshold = TAXData.FEDERAL[status].age;
    const federalAgeBump = TAXData.FEDERAL[status].stdbump;

    // Count seniors (age ≥ 65) for age bump and OBBBA senior deduction
    const nSeniors = (ages[0] >= federalAgeThreshold ? 1 : 0) +
                     (status === 'MFJ' && ages.length > 1 && ages[1] >= federalAgeThreshold ? 1 : 0);

    let federalStdDeduction = (federalStdBase + federalAgeBump * nSeniors) * inflation;

    // OBBBA senior deduction: $4,000 per senior, phases out at 6% above AGI threshold
    // Computed after AGI is known (Step 3); placeholder set here, applied in Step 1b below.
    const OBBBA_PER_SENIOR = 4000;
    const OBBBA_PHASEOUT_AGI = { MFJ: 150000, SGL: 75000 };
    const OBBBA_PHASEOUT_RATE = 0.06;

    // SALT itemizing: compare standard deduction vs capped state+local taxes
    // State tax is not known until Step 8; we use a forward-reference approach —
    // the caller may pass stateTaxPaid, or we skip itemizing (conservative default).
    // For now, SALT comparison is deferred to Step 1b after state tax is computed.
    const saltCap = obbaOn ? (saltHigh ? 40000 : 10000) : 10000;

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
	// SS thresholds are NOT indexed to inflation (statutory since 1984)
	if (provisionalIncome <= ssBrackets[0].l) {
		// Below first threshold - no SS is taxable
		taxableSS = 0;
	} else if (provisionalIncome <= ssBrackets[2].l) {
		// Between first and second threshold - taxable at tier 1 rate
		const threshold1 = ssBrackets[1].l;
		const tier1Rate = ssBrackets[1].r;
		const excessOver1 = provisionalIncome - threshold1;
		taxableSS = Math.min(tier1Rate * totalSS, tier1Rate * excessOver1);
	} else {
		// Above second threshold - taxable at tier 2 rate (with tier 1 portion)
		const threshold1 = ssBrackets[1].l;
		const threshold2 = ssBrackets[2].l;
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
    // STEP 3: Calculate Federal AGI (pre-deduction)
    // ========================================================================
    const federalAGI = (earnedIncome - hsaContrib) + taxableSS + ordDivInterest +
                       qualifiedDiv + capGains;

    // ========================================================================
    // STEP 4: Calculate State AGI and State Tax
    // (Must precede federal deduction finalization for SALT itemizing)
    // ========================================================================
    const stateData = TAXData[state];
    const stateSSTaxRate = stateData.SSTaxation || 0;
    const stateTaxableSS = totalSS * stateSSTaxRate;

    // CA does not allow HSA deduction at state level
    let stateAGI;
    if (state === 'CA') {
        stateAGI = earnedIncome + stateTaxableSS + ordDivInterest + qualifiedDiv + capGains;
    } else {
        stateAGI = earnedIncome - hsaContrib + stateTaxableSS + ordDivInterest + qualifiedDiv + capGains;
    } // state AGI calculation

    const stateStdDeduction = stateData[status].std * inflation;
    const stateTaxableIncome = Math.max(0, stateAGI - stateStdDeduction);
    const stateResult = calculateProgressive(state, status, stateTaxableIncome, inflation);
    const stateTax = stateResult.total;
    const stateMarginalRate = stateResult.marginal;

    // Compute state ordinary tax (without CG) to enable stacked breakdown in callers
    const stateAGIOrdOnly = stateAGI - capGains;
    const stateTaxableOrdOnly = Math.max(0, stateAGIOrdOnly - stateStdDeduction);
    const stateOrdinaryTax = calculateProgressive(state, status, stateTaxableOrdOnly, inflation).total;
    const stateCapGainsTax = stateTax - stateOrdinaryTax;

    // ========================================================================
    // STEP 5: Finalize Federal Deduction (SALT itemizing + OBBBA senior deduction)
    // ========================================================================
    // SALT itemizing: choose whichever is larger — standard deduction or capped SALT
    const saltItemized = Math.min(stateTax + propTax, saltCap);
    const useItemized = saltItemized > federalStdDeduction;
    let federalDeduction = useItemized ? saltItemized : federalStdDeduction;

    // OBBBA senior deduction: $4,000/senior, phases out at 6% above threshold
    let seniorDeduction = 0;
    if (obbaOn && nSeniors > 0) {
        const rawSenDed = OBBBA_PER_SENIOR * nSeniors;
        const phaseoutExcess = Math.max(0, federalAGI - OBBBA_PHASEOUT_AGI[status]);
        seniorDeduction = Math.max(0, rawSenDed - phaseoutExcess * OBBBA_PHASEOUT_RATE);
    } // OBBBA senior deduction
    federalDeduction += seniorDeduction;

    // ========================================================================
    // STEP 6: Separate Ordinary and Preferentially-Taxed Income
    // ========================================================================
    const federalTaxableIncome = Math.max(0, federalAGI - federalDeduction);

    const ordinaryIncomeInAGI = (earnedIncome - hsaContrib) + taxableSS + ordDivInterest;
    const preferentialIncomeInAGI = qualifiedDiv + capGains;

    const taxableOrdinaryIncome = Math.max(0, Math.min(federalTaxableIncome,
                                            ordinaryIncomeInAGI - federalDeduction));
    const taxablePreferentialIncome = Math.max(0, federalTaxableIncome - taxableOrdinaryIncome);

    // ========================================================================
    // STEP 7: Calculate Federal Ordinary Income Tax
    // ========================================================================
    const federalOrdinaryResult = calculateProgressive('FEDERAL', status,
                                                       taxableOrdinaryIncome, inflation);
    const federalOrdinaryTax = federalOrdinaryResult.total;
    const federalMarginalRate = federalOrdinaryResult.marginal;

    // ========================================================================
    // STEP 8: Calculate Federal Capital Gains Tax (including NIIT)
    // ========================================================================
    const capGainsBrackets = TAXData.FEDERAL.CAPITAL_GAINS[status].brackets;
    let federalCapGainsTax = 0;
    let remainingPreferential = taxablePreferentialIncome;
    let currentPosition = taxableOrdinaryIncome;
	let capitalGainsRate = 0;

    for (let i = 0; i < capGainsBrackets.length; i++) {
        const bracket = capGainsBrackets[i];
        const bracketLimit = bracket.l * inflation;
        const rate = bracket.r;
        if (currentPosition >= bracketLimit) continue;
        capitalGainsRate = rate;
        const roomInBracket = bracketLimit - currentPosition;
        const amountInBracket = Math.min(remainingPreferential, roomInBracket);
        federalCapGainsTax += amountInBracket * rate;
        remainingPreferential -= amountInBracket;
        currentPosition += amountInBracket;
        if (remainingPreferential <= 0) break;
    } // capital gains bracket loop

    const federalTax = federalOrdinaryTax + federalCapGainsTax;

    // ========================================================================
    // STEP 9: IRMAA MAGI and totals
    // ========================================================================
    const irmaaMagi = federalAGI + taxExemptInterest;
    const totalTax = federalTax + stateTax;
    const federalNominalRate = federalOrdinaryResult.nominalRate || 0;
    const stateNominalRate = stateResult.nominalRate || 0;
    const irmaaRate = federalAGI > 0 ? irmaaAnnualCost / federalAGI : 0;
    const nominalRate = federalNominalRate + stateNominalRate + irmaaRate;

    return {
        nominalRate,
        federalNominalRate,
        stateNominalRate,
        irmaaRate,
        irmaaAnnualCost,
        totalTax,
        federalTax,
        stateTax,
		state: stateTax,
        stateOrdinaryTax,
        stateCapGainsTax,
        capitalGainsRate,
        capitalGainsTax: federalCapGainsTax,
        niitTax: 0,
        AGI: federalAGI,
        irmaaMagi,
        MAGI: irmaaMagi,

        federalOrdinaryTax,
        federalMarginalRate,
		fedRate: federalMarginalRate,
        stateMarginalRate,
		stRate: stateMarginalRate,
		fedLimit: federalOrdinaryResult.limit,
		stLimit: stateResult.limit,

        taxableSS,
        provisionalIncome,
        federalTaxableIncome,
        stateTaxableIncome,
        stateAGI,
        stagi: stateAGI,

        federalStdDeduction: federalDeduction,
        stateStdDeduction,
        useItemized,
        seniorDeduction,

        ordinaryIncomeInAGI,
        preferentialIncomeInAGI,
        taxableOrdinaryIncome,
        taxablePreferentialIncome
    }; // return object
} // calculateTaxes()