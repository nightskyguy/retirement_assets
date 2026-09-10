'use strict';
/**
 * taxengine.tests.js
 * Run with: node taxengine.tests.js
 *
 * TEST COUNTS ARE PINNED OUTSIDE THIS FILE. Adding or removing a test here means updating, in the
 * same commit:
 *   1. `TestTiers.EXPECTED` in optimizer_tests.js - ONE object holding the count of EVERY node
 *      suite, so the file you have to edit is usually not the tool you are working on.
 *   2. the suite table in .githooks/README.md
 * Measure, never guess: run this file and use the printed total.
 *
 * Covers taxengine.js on its own: calculateTaxes() across 23 income shapes (the Social Security
 * taxability tiers, capital gains and NIIT, the OBBBA senior deduction and its phase-out, the SALT
 * cap and its phase-out, state Social Security taxation, the state retirement-income exclusion
 * modes), findLimitByRate() and findUpperLimitByAmount(), calculateProgressive() including the
 * states whose brackets do not index, and calcIRMAA() with the per-person Medicare gate.
 *
 * MOVED OUT OF optimizer_tests.js in 11.17b0. These are pure function calls that need no DOM, and
 * until then they ran synchronously on every Optimizer page load, before first paint, and ONLY
 * there - no node suite covered the tax engine at all. They now run in the pre-commit hook, in the
 * browser under ?runtests, and on standalone/IncomeTaxPlanner.html, whose badge they drive.
 *
 * The bodies are kept as they were written. assertEqual() compares JSON after rounding every
 * number to three decimals, and the first mismatch inside a test is the failure it reports.
 *
 * TESTTAXATION is a synthetic state with round-number brackets, installed into TAXData for the
 * duration of a run and removed again afterwards, so a page that lists TAXData's states never
 * sees it.
 */

// Wrapped in an IIFE so the top-level names here do not collide with the page's own global
// lexical scope once this file is loaded by a <script> tag.
(() => {

const IS_NODE = (typeof module !== 'undefined' && module.exports);

// Dual-mode: node `require`, or the object taxengine.js sets for the browser. Resolved lazily so a
// page can load this file before taxengine.js without a module-scope throw.
function _engine() {
	const e = IS_NODE ? require('./taxengine.js') : window.TaxEngine;
	if (!e) throw new Error('taxengine.js has not loaded yet');
	return e;
}
const TAXData = new Proxy({}, {
	get: (_t, p) => _engine().TAXData[p],
	set: (_t, p, v) => { _engine().TAXData[p] = v; return true; },
	deleteProperty: (_t, p) => { delete _engine().TAXData[p]; return true; },
	has: (_t, p) => p in _engine().TAXData,
});
const calculateTaxes = (...a) => _engine().calculateTaxes(...a);
const findLimitByRate = (...a) => _engine().findLimitByRate(...a);
const findUpperLimitByAmount = (...a) => _engine().findUpperLimitByAmount(...a);
const calculateProgressive = (...a) => _engine().calculateProgressive(...a);
const calcIRMAA = (...a) => _engine().calcIRMAA(...a);

let passed = 0, failed = 0;

// test() REGISTERS rather than runs, the same shape as the other node suites, so the browser can
// call runTaxEngineTests() on demand.
const TESTS = [];
function test(name, fn) {
	TESTS.push([name, fn]);
}

/**
 * Rounds every number in an object/array to `decimals` places, recursively.
 */
function fixDecimals(obj, decimals = 3) {
	if (obj == null) return obj;
	if (typeof obj === 'number') {
		if (isNaN(obj)) return NaN;
		if (!isFinite(obj)) return obj;
		return parseFloat(obj.toFixed(decimals));
	}
	if (Array.isArray(obj)) return obj.map(item => fixDecimals(item, decimals));
	if (typeof obj === 'object') {
		const result = {};
		for (const [key, value] of Object.entries(obj)) result[key] = fixDecimals(value, decimals);
		return result;
	}
	return obj;
}

// Equal after rounding to three decimals, or exactly equal as given. Throws on the first mismatch.
function assertEqual(actual, expected, testName) {
	const fa = fixDecimals(actual), fe = fixDecimals(expected);
	if (JSON.stringify(fa) === JSON.stringify(fe) || JSON.stringify(actual) === JSON.stringify(expected)) return;
	throw new Error(`${testName}: expected ${JSON.stringify(fe)}, got ${JSON.stringify(fa)}`);
}

// The synthetic state the calculateTaxes cases run against. Installed by the runner for the
// duration of a run, not at load.
function installTestState() {

		// ============================================================================
		// Add TESTTAXATION state to TAXData for testing purposes
		// ============================================================================
		TAXData.TESTTAXATION = {
			STATE: 'Test State',
			YEAR: 2026,
			SSTaxation: 0.00,  // Does not tax Social Security
			MFJ: {
				std: 10000,  // Simple round number for testing
				brackets: [
					{ l: 50000, r: 0.05 },
					{ l: 100000, r: 0.10 },
					{ l: Infinity, r: 0.15 }
				]
			},
			SGL: {
				std: 5000,  // Simple round number for testing
				brackets: [
					{ l: 25000, r: 0.05 },
					{ l: 50000, r: 0.10 },
					{ l: Infinity, r: 0.15 }
				]
			}
		};
}
function removeTestState() {
	delete TAXData.TESTTAXATION;
}

// ── Bracket and limit lookups ────────────────────────────────────────────────────────────────

test('findLimitByRate and findUpperLimitByAmount on the TEST entity', () => {
	// These use TEST data and should NOT need to be changed.
    assertEqual(findLimitByRate('TEST', 'MFJ', 0.2, 1), {limit: 2000, rate: 0.2}, 
                'findLimitByRate: TEST MFJ 20% rate correct');
    
    assertEqual(findLimitByRate('TEST', 'SGL', 0.2, 3), {limit: 3000, rate: 0.2}, 
                'findLimitByRate: TEST SGL 20% rate w/ 300% inflation');	

    assertEqual(findLimitByRate('TEST', 'SGL', 0.9, 1), {limit: 20000, rate: 0.8}, 
                'findLimitByRate: TEST SGL 90% - finds lower rate: 80%');	
    
    assertEqual(findLimitByRate('TEST', 'SGL', 0.05, 1), {limit: 0, rate: 0}, 
                'findLimitByRate: TEST SGL 5% finds no limit or rate (0)');	

    assertEqual(findUpperLimitByAmount('TEST', 'SGL', 998, 1), {"limit": 999,"rate": 0.1, "nominalRate": 0.1}, 
                'findUpperLimitByAmount: TEST SGL 998 finds limit: 999, rate: 0.1');
});

test('findLimitByRate on FEDERAL and CA, and the Social Security 85% tier (sensitive to the real TAXData)', () => {
	// 😭😭😭 NOTE NOTE NOTE: All of the following tests are sensitive to the real TAXData. 😭😭😭

    assertEqual(findLimitByRate('FEDERAL', 'MFJ', 0.24, 1), {limit: 403550, rate: 0.24}, 
                '😭findLimitByRate: FEDERAL MFJ 24% bracket');
	
    assertEqual(findLimitByRate('CA', 'SGL', 0.06, 1), { limit: 55867, rate: 0.06 },
                '😭findLimitByRate: State SGL 6% bracket');

		
	assertEqual(calculateProgressive('SOCIALSECURITY', 'MFJ', 55000).marginal, 
		0.85,
		'😭calculateProgressive(SOCIALSECURITY, MFJ, 55000) CHANGES with SOCIALSECURITY data.')
});

test('calcIRMAA: tiers, CPI, the Medicare rate and the per-person gate (sensitive to the real TAXData)', () => {
	assertEqual(calcIRMAA(100, 'SGL', 1), 0,
				'😭calcIRMAA  0 for SGL at 100 income');

	assertEqual(calcIRMAA(109001, 'SGL', 1, 1), 12 * 202.9,
				'😭calcIRMAA  202.9 for 109001 SGL income');

	assertEqual(calcIRMAA(273999, 'MFJ', 1, 1.5), 1.5 * 2 * (12 * 202.90),
				'😭calcIRMAA no CPI, 1.5 medicareRate @ 273999 MFJ income');    

	assertEqual(calcIRMAA(274000, 'MFJ', 1, 1), 12 * 2 * (284.10 + 14.50),
				'😭calcIRMAA  2 * (284.10 + 14.50) for 274000 MFJ income');

	assertEqual(calcIRMAA(218000, 'MFJ', 2, 1), 0,
				'😭calcIRMAA  2 * (284.10 + 14.50) for 218000 MFJ income at 2');

	// Per-person Medicare gate (onMedicareCount param). MFJ bracket rates are household
	// (2x per-person) totals; count scales them to who is actually 65+.
	assertEqual(calcIRMAA(274000, 'MFJ', 1, 1, 1), 12 * (284.10 + 14.50),
				'😭calcIRMAA MFJ one spouse on Medicare = half the household surcharge');

	assertEqual(calcIRMAA(274000, 'MFJ', 1, 1, 0), 0,
				'😭calcIRMAA MFJ neither spouse 65+ = no surcharge');

	assertEqual(calcIRMAA(274000, 'MFJ', 1, 1, 2), 12 * 2 * (284.10 + 14.50),
				'😭calcIRMAA MFJ both on Medicare = full household surcharge');

	assertEqual(calcIRMAA(274000, 'MFJ', 1, 1, 3), 12 * 2 * (284.10 + 14.50),
				'😭calcIRMAA MFJ count clamps at 2 persons');

	assertEqual(calcIRMAA(109001, 'SGL', 1, 1, 1), 12 * 202.9,
				'😭calcIRMAA SGL on Medicare = full single surcharge');

	assertEqual(calcIRMAA(109001, 'SGL', 1, 1, 0), 0,
				'😭calcIRMAA SGL under 65 = no surcharge');
});

test('calculateProgressive: the TEST entity, invalid entities, and which states index their brackets', () => {
	assertEqual(calculateProgressive('TEST','MFJ',72000), 
		{"cumulative": 30700, "total": 30700, "marginal": 0.8, "limit": 40000, "nominalRate": 0.4}, 
		'calculateProgressive(TEST, MFJ, 72000) ok')	

	assertEqual(calculateProgressive('TEST','SGL',72000), 
		{"cumulative": 15350,"total": 15350,"marginal": 0.8,"limit": 20000,"nominalRate": 0.45}, 
		'calculateProgressive(TEST,SGL,72000) ok')
		
	assertEqual(calculateProgressive('NONEXISTENT','SGL',72000), 
		{  "cumulative": 0,
  "total": 0,
  "marginal": 0,
  "limit": 0,
  "error": "Invalid entity (NONEXISTENT) or status (SGL)"}, 
		'calculateProgressive(NONEXISTENT,...) ok')

	assertEqual(calculateProgressive('TEST','NONEXISTENT',72000),
		{  "cumulative": 0,
  "total": 0,
  "marginal": 0,
  "limit": 0,
  "error": "Invalid entity (TEST) or status (NONEXISTENT)"},
		'calculateProgressive(TEST,NONEXISTENT,...) ok')

	// INFLATION_INDEXED: false - MT/ND/AL/OH/SC brackets must NOT inflate regardless of passed inflation value.
	const mtBase     = calculateProgressive('MT', 'MFJ', 50000, 1.0);
	const mtInflated = calculateProgressive('MT', 'MFJ', 50000, 1.1);
	assertEqual(mtBase.total, mtInflated.total,
		'MT (INFLATION_INDEXED:false) - bracket inflation ignored, tax same at inflation=1.1 vs 1.0')
	assertEqual(mtBase.marginal, mtInflated.marginal,
		'MT marginal rate unchanged with inflation=1.1')
	const ndBase     = calculateProgressive('ND', 'SGL', 60000, 1.0);
	const ndInflated = calculateProgressive('ND', 'SGL', 60000, 1.1);
	assertEqual(ndBase.total, ndInflated.total,
		'ND (INFLATION_INDEXED:false) - bracket inflation ignored')
	// CA IS indexed - inflation=1.1 widens brackets → less tax at same income
	const caBase     = calculateProgressive('CA', 'MFJ', 200000, 1.0);
	const caInflated = calculateProgressive('CA', 'MFJ', 200000, 1.1);
	assertEqual(caBase.total > caInflated.total, true,
		'CA (indexed) - inflation=1.1 widens brackets, lowers tax vs inflation=1.0')
});

// ── calculateTaxes across 23 income shapes ───────────────────────────────────────────────────
	// ============================================================================
	// TEST CASE 1: Simple - Only SS income, below taxability threshold
	// ============================================================================
	test('TEST CASE 1: Simple - Only SS income, below taxability threshold', () => {
		
		const result = calculateTaxes({
			filingStatus: 'SGL',
			ages: [67],
			earnedIncome: 0,
			totalSS: 20000,
			ordDivInterest: 0,
			qualifiedDiv: 0,
			capGains: 0,
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.0,
			state: 'TESTTAXATION'
		});
		
		// Provisional income = 0 + 0.5 * 20000 = 10,000 (below $25,000 threshold)
		assertEqual(result.provisionalIncome, 10000, 'Provisional Income');
		assertEqual(result.taxableSS, 0, 'Taxable SS (should be 0)');
		assertEqual(result.AGI, 0, 'AGI (no taxable income)');
		assertEqual(result.federalTax, 0, 'Federal Tax');
		assertEqual(result.stateTax, 0, 'State Tax');
		assertEqual(result.totalTax, 0, 'Total Tax');
	});

	// ============================================================================
	// TEST CASE 2: SS with 50% taxability (between thresholds)
	// ============================================================================
	test('TEST CASE 2: SS with 50% taxability (between thresholds)', () => {
		
		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [64, 62],  // Under 65, no age bump
			earnedIncome: 20000,
			totalSS: 15000 + 15000,
			ordDivInterest: 0,
			qualifiedDiv: 0,
			capGains: 0,
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.0,
			state: 'TESTTAXATION'
		});
		
		// Provisional income = 20000 + 0.5 * 30000 = 35,000
		// Between $32,000 and $44,000 thresholds
		// Excess over $32,000 = 3,000
		// Taxable SS = min(0.5 * 30000, 0.5 * 3000) = min(15000, 1500) = 1,500
		assertEqual(result.provisionalIncome, 35000, 'Provisional Income');
		assertEqual(result.taxableSS, 1500, 'Taxable SS (50% tier)');
		assertEqual(result.AGI, 21500, 'AGI');
		assertEqual(result.federalTaxableIncome, 0, 'Federal Taxable Income (below std deduction)');
		assertEqual(result.federalTax, 0, 'Federal Tax');
	});

	// ============================================================================
	// TEST CASE 3: SS with 85% taxability (above second threshold)
	// ============================================================================
	test('TEST CASE 3: SS with 85% taxability (above second threshold)', () => {
		
		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [70, 68],  // Both over 65, get age bumps
			earnedIncome: 50000,
			totalSS: 20000 + 20000,
			ordDivInterest: 0,
			qualifiedDiv: 0,
			capGains: 0,
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.0,
			state: 'TESTTAXATION'
		});
		
		// Provisional income = 50000 + 0.5 * 40000 = 70,000 (above $44,000)
		assertEqual(result.provisionalIncome, 70000, 'Provisional Income');
		
		// Tier 1: 0.5 * (44000 - 32000) = 6,000
		// Tier 2: 0.85 * (70000 - 44000) = 22,100
		// Total: 28,100 (max would be 0.85 * 40000 = 34,000)
		assertEqual(result.taxableSS, 28100, 'Taxable SS (85% tier)');
		assertEqual(result.AGI, 78100, 'AGI');
		assertEqual(result.federalStdDeduction, 35500, 'Federal Std Deduction with age bumps');
		assertEqual(result.federalTaxableIncome, 42600, 'Federal Taxable Income');
		
		// Federal tax on 42,600:
		// First $24,800 @ 10% = 2,480
		// Remaining $17,800 @ 12% = 2,136
		// Total = 4,616
		assertEqual(result.federalTax, 4616, 'Federal Tax');
	});

	// ============================================================================
	// TEST CASE 4: Large Capital Gains (testing preferential rates)
	// ============================================================================
	test('TEST CASE 4: Large Capital Gains (testing preferential rates)', () => {
		
		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [55, 53],
			earnedIncome: 60000,
			totalSS: 0,
			ordDivInterest: 5000,
			qualifiedDiv: 10000,
			capGains: 200000,  // Large cap gains
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.0,
			state: 'TESTTAXATION'
		});
		
		// AGI = 60000 + 5000 + 10000 + 200000 = 275,000
		assertEqual(result.AGI, 275000, 'AGI');
		assertEqual(result.federalTaxableIncome, 242800, 'Federal Taxable Income');
		assertEqual(result.ordinaryIncomeInAGI, 65000, 'Ordinary Income in AGI');
		assertEqual(result.preferentialIncomeInAGI, 210000, 'Preferential Income in AGI');
		assertEqual(result.taxableOrdinaryIncome, 32800, 'Taxable Ordinary Income');
		assertEqual(result.taxablePreferentialIncome, 210000, 'Taxable Preferential Income');
		
		// Federal ordinary tax on 32,800:
		// First $24,800 @ 10% = 2,480
		// Remaining $8,000 @ 12% = 960
		// Total ordinary = 3,440
		assertEqual(result.federalOrdinaryTax, 3440, 'Federal Ordinary Tax');
		
		// Capital gains tax (position starts at 32,800):
		// From 32,800 to 98,900 = 66,100 @ 0% = 0
		// From 98,900 to 242,800 = 143,900 @ 15% = 21,585
		assertEqual(result.capitalGainsTax, 21585, 'Capital Gains Tax');
		// Highest CG bracket reached is 15% (gain ends at 242,800, below the 20% threshold)
		assertEqual(result.capitalGainsRate, 0.15, 'Capital Gains Rate');
		// NIIT: MAGI 275k - threshold 250k = 25k; NII 215k; 3.8% × 25k = 950
		assertEqual(result.niitTax, 950, 'NIIT');
		assertEqual(result.federalTax, 25975, 'Total Federal Tax');
	});

	// ============================================================================
	// TEST CASE 5: Complex - Multiple income types with HSA
	// ============================================================================
	test('TEST CASE 5: Complex - Multiple income types with HSA', () => {
		
		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [67, 65],  // Both get age bump
			earnedIncome: 80000,
			totalSS: 25000 + 18000,
			ordDivInterest: 8000,
			qualifiedDiv: 12000,
			capGains: 15000,
			taxExemptInterest: 5000,  // Tax-exempt interest
			hsaContrib: 10000,
			inflation: 1.0,
			state: 'TESTTAXATION'
		});
		
		// Provisional income = (80000 - 10000) + 8000 + 12000 + 15000 + 5000 + 0.5 * 43000
		// = 70000 + 8000 + 12000 + 15000 + 5000 + 21500 = 131,500
		assertEqual(result.provisionalIncome, 131500, 'Provisional Income');
		
		// Well above $44,000 threshold
		// Tier 1: 0.5 * (44000 - 32000) = 6,000
		// Tier 2: 0.85 * (131500 - 44000) = 74,375
		// Total: 80,375, but max is 0.85 * 43000 = 36,550
		assertEqual(result.taxableSS, 36550, 'Taxable SS (capped at 85%)');
		
		// Federal AGI = (80000 - 10000) + 36550 + 8000 + 12000 + 15000 = 141,550
		assertEqual(result.AGI, 141550, 'Federal AGI');
		
		// IRMAA MAGI = AGI + tax-exempt interest = 141550 + 5000 = 146,550
		assertEqual(result.MAGI, 146550, 'IRMAA MAGI');
		
		// Federal std deduction = 32200 + 1650 + 1650 = 35,500
		assertEqual(result.federalStdDeduction, 35500, 'Federal Std Deduction');
		
		// State AGI (TEST state allows HSA deduction, no SS tax)
		// = (80000 - 10000) + 0 + 8000 + 12000 + 15000 = 105,000
		assertEqual(result.stateAGI, 105000, 'State AGI (TEST state)');
	});

	// ============================================================================
	// TEST CASE 6: High income testing NIIT inclusion in capital gains
	// ============================================================================
	test('TEST CASE 6: High income testing NIIT inclusion in capital gains', () => {
		
		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [45, 43],
			earnedIncome: 300000,
			totalSS: 0,
			ordDivInterest: 20000,
			qualifiedDiv: 50000,
			capGains: 400000,  // Large cap gains triggering NIIT
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.0,
			state: 'TESTTAXATION'
		});
		
		// AGI = 300000 + 20000 + 50000 + 400000 = 770,000
		assertEqual(result.AGI, 770000, 'AGI');
		assertEqual(result.federalTaxableIncome, 737800, 'Federal Taxable Income');
		assertEqual(result.taxableOrdinaryIncome, 287800, 'Taxable Ordinary Income');
		assertEqual(result.taxablePreferentialIncome, 450000, 'Taxable Preferential Income');
		
		// Capital gains stack on top of ordinary income, starting at position 287,800:
		// From 287,800 to 613,700 = 325,900 @ 15% = 48,885
		// From 613,700 to 737,800 = 124,100 @ 20% = 24,820
		assertEqual(result.capitalGainsTax, 73705, 'Capital Gains Tax');
		// The gain ENDS in the 20% bracket, so that is the marginal rate, but it does not start
		// there: 613,700 is the MFJ 15%->20% ceiling. This assertion read 90,000 while that
		// ceiling was set to the NIIT threshold and the whole 450,000 was priced at 20%.
		assertEqual(result.capitalGainsRate, 0.20, 'Capital Gains Rate');
		// NIIT: MAGI 770k - threshold 250k = 520k; NII = 470k; 3.8% × min(470k, 520k) = 17,860
		assertEqual(result.niitTax, 17860, 'NIIT Tax');
	});

	// ============================================================================
	// TEST CASE 6b: the LTCG 15%->20% ceiling is the bracket ceiling, NOT the NIIT threshold
	//
	// Regression guard. The MFJ ceiling shipped as 250,000 and the SGL ceiling as 200,000 - the
	// NIIT MAGI thresholds, copied out of the wrong block - so gains between the real ceiling and
	// the NIIT threshold were charged 20% instead of 15%, and the reported marginal rate that
	// seeds withdrawal ordering in optimizer_core.js flipped to 0.20 hundreds of thousands of
	// dollars early. Both statuses are pinned because both were wrong, in different amounts.
	// ============================================================================
	test('TEST CASE 6b: LTCG 20% starts at the bracket ceiling, not the NIIT threshold', () => {

		// MFJ. Ordinary income parks the gain start well above the NIIT threshold but well below
		// the real 613,700 ceiling, so the ENTIRE gain must price at 15%.
		const mfj = calculateTaxes({
			filingStatus: 'MFJ', ages: [55, 53],
			earnedIncome: 342200,   // 342,200 - 32,200 std = 310,000 taxable ordinary
			capGains: 200000,
			inflation: 1.0, state: 'TESTTAXATION'
		});
		assertEqual(mfj.taxableOrdinaryIncome, 310000, 'MFJ taxable ordinary');
		// 310,000 -> 510,000 is entirely inside the 15% band (ceiling 613,700): 200,000 @ 15%
		assertEqual(mfj.capitalGainsTax, 30000, 'MFJ cap gains tax, all 15%');
		assertEqual(mfj.capitalGainsRate, 0.15, 'MFJ marginal LTCG rate is still 15%');

		// SGL. Same shape against the 545,500 ceiling, above the 200,000 NIIT threshold.
		const sgl = calculateTaxes({
			filingStatus: 'SGL', ages: [55],
			earnedIncome: 266100,   // 266,100 - 16,100 std = 250,000 taxable ordinary
			capGains: 200000,
			inflation: 1.0, state: 'TESTTAXATION'
		});
		assertEqual(sgl.taxableOrdinaryIncome, 250000, 'SGL taxable ordinary');
		// 250,000 -> 450,000 is entirely inside the 15% band (ceiling 545,500): 200,000 @ 15%
		assertEqual(sgl.capitalGainsTax, 30000, 'SGL cap gains tax, all 15%');
		assertEqual(sgl.capitalGainsRate, 0.15, 'SGL marginal LTCG rate is still 15%');

		// And the 20% band does still exist: push the MFJ gain past 613,700 and the top slice bites.
		const top = calculateTaxes({
			filingStatus: 'MFJ', ages: [55, 53],
			earnedIncome: 342200, capGains: 400000,
			inflation: 1.0, state: 'TESTTAXATION'
		});
		// 310,000 -> 613,700 = 303,700 @ 15% = 45,555; 613,700 -> 710,000 = 96,300 @ 20% = 19,260
		assertEqual(top.capitalGainsTax, 64815, 'MFJ cap gains tax spanning 15% and 20%');
		assertEqual(top.capitalGainsRate, 0.20, 'MFJ marginal LTCG rate reaches 20%');
	});

	// ============================================================================
	// TEST CASE 6c: tax-exempt interest is invisible to NIIT, both in MAGI and in NII
	//
	// Regression guard. NIIT MAGI was computed as `federalAGI + taxExemptInterest`, which is the
	// IRMAA definition (42 USC 1395r(i)(4)) rather than the NIIT one (IRC 1411(d) = AGI plus only
	// the section 911 exclusion). Municipal interest avoiding this surtax is the entire point of
	// holding munis, and the old formula charged it. This also pins the two places the add-back IS
	// correct, so a future "make the MAGIs consistent" edit has to break a test to do it.
	// ============================================================================
	test('TEST CASE 6c: tax-exempt interest does not create NIIT', () => {

		const base = { filingStatus: 'MFJ', ages: [55, 53], earnedIncome: 150000,
		               capGains: 80000, inflation: 1.0, state: 'TESTTAXATION' };

		// AGI 230,000, below the 250,000 NIIT threshold. No surtax.
		const without = calculateTaxes(base);
		assertEqual(without.AGI, 230000, 'AGI without muni interest');
		assertEqual(without.niitTax, 0, 'no NIIT below the threshold');

		// 60,000 of municipal interest is excluded from gross income, so it moves neither AGI nor
		// the NIIT base. The surtax must stay at zero.
		const with60k = calculateTaxes({ ...base, taxExemptInterest: 60000 });
		assertEqual(with60k.AGI, 230000, 'muni interest stays out of AGI');
		assertEqual(with60k.niitTax, 0, 'muni interest does not drag gains into NIIT');

		// Same check above the threshold: the surtax is driven by AGI and NII alone, so adding
		// muni interest must not move it by a cent.
		const highNoMuni = calculateTaxes({ ...base, earnedIncome: 300000 });
		const highMuni   = calculateTaxes({ ...base, earnedIncome: 300000, taxExemptInterest: 250000 });
		assertEqual(highMuni.niitTax, highNoMuni.niitTax, 'NIIT is unmoved by muni interest');

		// The two statutes that DO count it are unaffected by this fix. IRMAA MAGI - the `MAGI`
		// field on the result, which is the IRMAA one - adds it back...
		assertEqual(with60k.MAGI, without.MAGI + 60000, 'IRMAA MAGI still adds muni back');
		// ...and so does provisional income for Social Security, which is why 60k of munis makes
		// a benefit taxable that was not taxable without them.
		const ssBase = { filingStatus: 'MFJ', ages: [70, 68], earnedIncome: 0, totalSS: 40000,
		                 inflation: 1.0, state: 'TESTTAXATION' };
		const ssNoMuni = calculateTaxes(ssBase);
		const ssMuni   = calculateTaxes({ ...ssBase, taxExemptInterest: 60000 });
		assertEqual(ssNoMuni.taxableSS, 0, 'SS untaxed on benefits alone');
		assertEqual(ssMuni.taxableSS > 0, true, 'muni interest still raises provisional income');
	});

	// ============================================================================
	// TEST CASE 6d: the marginal NIIT rates are what a probe of calculateTaxes() actually measures
	//
	// These two fields seed the optimizer's withdrawal ordering, so they have to equal the real
	// derivative, not a plausible-looking constant. Rather than restate 0.038, each case MEASURES
	// d(niitTax)/d(income) by re-running the engine $100 higher and compares that to the declared
	// field. If the min(NII, MAGI - threshold) logic is ever rewritten, the probe moves with it and
	// the declared rate does not, and this fails.
	//
	// The rule being pinned: an INVESTMENT dollar raises NII and MAGI together, so the surtax
	// applies in full above the threshold. An ORDINARY dollar raises MAGI only, so it costs nothing
	// while NII is the smaller of the two terms. A flat add-on to both would be wrong.
	// ============================================================================
	test('TEST CASE 6d: declared marginal NIIT equals the measured derivative', () => {

		const STEP = 100;
		const probe = (base, key) => {
			const a = calculateTaxes(base);
			const b = calculateTaxes({ ...base, [key]: (base[key] ?? 0) + STEP });
			return (b.niitTax - a.niitTax) / STEP;
		};

		// [label, inputs, expected investment-dollar rate, expected ordinary-dollar rate]
		// earnedIncome is ordinary and is NOT net investment income; capGains is both.
		const cases = [
			['MFJ below threshold',     { filingStatus: 'MFJ', ages: [55, 53], earnedIncome: 100000, capGains:  40000 }, 0,     0    ],
			// excess 180,000 dwarfs NII 30,000, so NII binds: ordinary income is free.
			['MFJ above, NII binds',    { filingStatus: 'MFJ', ages: [55, 53], earnedIncome: 400000, capGains:  30000 }, 0.038, 0    ],
			// NII 400,000 dwarfs excess 250,000, so the excess binds: ordinary income is charged.
			['MFJ above, excess binds', { filingStatus: 'MFJ', ages: [55, 53], earnedIncome: 100000, capGains: 400000 }, 0.038, 0.038],
			['SGL below threshold',     { filingStatus: 'SGL', ages: [55],     earnedIncome:  80000, capGains:  40000 }, 0,     0    ],
			['SGL above, NII binds',    { filingStatus: 'SGL', ages: [55],     earnedIncome: 350000, capGains:  20000 }, 0.038, 0    ],
			['SGL above, excess binds', { filingStatus: 'SGL', ages: [55],     earnedIncome:  80000, capGains: 350000 }, 0.038, 0.038],
		];

		for (const [label, inputs, wantInv, wantOrd] of cases) {
			const base = { ...inputs, inflation: 1.0, state: 'TESTTAXATION' };
			const r = calculateTaxes(base);

			assertEqual(r.niitMarginalOnInvestment, wantInv, `${label}: declared investment rate`);
			assertEqual(r.niitMarginalOnOrdinary,   wantOrd, `${label}: declared ordinary rate`);

			// And the declared rates are the measured ones.
			assertEqual(probe(base, 'capGains'),     wantInv, `${label}: MEASURED investment rate`);
			assertEqual(probe(base, 'earnedIncome'), wantOrd, `${label}: MEASURED ordinary rate`);
		}
	});

	// ============================================================================
	// TEST CASE 6e: the NIIT threshold is a fixed dollar figure and never inflates
	//
	// The single most load-bearing NIIT behavior in a 30-year projection, and nothing pinned it
	// until now. The engine works in NOMINAL dollars: bracket ceilings are multiplied by the
	// `inflation` factor because the statute indexes them, and the NIIT threshold is NOT, because
	// its statute does not. That is what makes the surtax reach steadily further down the income
	// scale as a plan runs. A refactor that "made the thresholds consistent" would silently delete
	// most of the surtax from every long plan, and every other NIIT test here would still pass.
	//
	// Also covers the two coverage holes beside it: a single filer (the $200,000 threshold was
	// exercised by no test at all) and an explicit zero below the threshold.
	// ============================================================================
	test('TEST CASE 6e: NIIT threshold does not inflate, and SGL/below-threshold are covered', () => {

		// Single filer. The 200,000 threshold, previously untested.
		// AGI 250,000; excess 50,000; NII 150,000 -> 3.8% x 50,000 = 1,900.
		const sgl = calculateTaxes({ filingStatus: 'SGL', ages: [70], earnedIncome: 100000,
		                             capGains: 150000, inflation: 1.0, state: 'TESTTAXATION' });
		assertEqual(sgl.AGI, 250000, 'SGL AGI');
		assertEqual(sgl.niitTax, 1900, 'SGL NIIT at the 200,000 threshold');

		// Below the threshold there is no surtax at all, for either status.
		assertEqual(calculateTaxes({ filingStatus: 'SGL', ages: [70], earnedIncome: 100000,
		                             capGains: 50000, inflation: 1.0, state: 'TESTTAXATION' }).niitTax,
		            0, 'SGL below threshold owes no NIIT');
		assertEqual(calculateTaxes({ filingStatus: 'MFJ', ages: [70, 68], earnedIncome: 100000,
		                             capGains: 100000, inflation: 1.0, state: 'TESTTAXATION' }).niitTax,
		            0, 'MFJ below threshold owes no NIIT');

		// Now the invariance. Scale BOTH the income and the inflation factor by the same amount,
		// which is what a later year of a nominal projection looks like. A threshold that inflated
		// with everything else would hold the surtax proportional; the real one does not, so the
		// surtax grows FASTER than the income does.
		//
		// The mix is deliberately gain-heavy so that the MAGI excess is the binding term at BOTH
		// factors. That is what isolates the threshold: if NII binds instead, the surtax just
		// tracks NII and says nothing about whether the threshold moved.
		const at = f => calculateTaxes({ filingStatus: 'MFJ', ages: [70, 68],
		                                 earnedIncome: 50000 * f, capGains: 500000 * f,
		                                 inflation: f, state: 'TESTTAXATION' });
		const one = at(1.0), two = at(2.0);

		// Excess is MAGI - 250,000, and 250,000 never moves.
		//   f=1.0: MAGI   550,000 -> excess 300,000, NII   500,000. Excess binds.
		//   f=2.0: MAGI 1,100,000 -> excess 850,000, NII 1,000,000. Excess binds.
		assertEqual(one.niitTax, 0.038 * 300000, 'NIIT at inflation 1.0');
		assertEqual(two.niitTax, 0.038 * 850000, 'NIIT at inflation 2.0 - threshold held still');
		// Income doubled; the surtax rose 2.83x. Under an indexed threshold it would be exactly 2x.
		assertEqual(two.niitTax > 2 * one.niitTax, true,
		            'an un-indexed threshold makes the surtax grow FASTER than income');

		// The contrast that makes the point: the ordinary bracket the same filer sits in DOES
		// inflate, so their statutory marginal rate is unchanged by the doubling.
		assertEqual(one.federalMarginalRate, two.federalMarginalRate,
		            'bracket ceilings inflate, so the ordinary marginal rate holds');
	});

	// ============================================================================
	// TEST CASE 7: Single filer with inflation adjustment
	// ============================================================================
	test('TEST CASE 7: Single filer with inflation adjustment', () => {
		
		const result = calculateTaxes({
			filingStatus: 'SGL',
			ages: [68],  // Gets age bump
			earnedIncome: 50000,
			totalSS: 30000,
			ordDivInterest: 2000,
			qualifiedDiv: 0,
			capGains: 0,
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.10,  // 10% inflation
			state: 'TESTTAXATION'
		});
		
		// Provisional income = 50000 + 2000 + 0.5 * 30000 = 67,000
		assertEqual(result.provisionalIncome, 67000, 'Provisional Income');
		
		// SS thresholds are statutory (NOT inflation-indexed): t1=$25,000, t2=$34,000
		// Provisional 67,000 > 34,000 (second threshold)
		// Tier 1: 0.5 * (34000 - 25000) = 4,500
		// Tier 2: 0.85 * (67000 - 34000) = 28,050
		// Total: 32,550, max is 0.85 * 30000 = 25,500
		assertEqual(result.taxableSS, 25500, 'Taxable SS (85% max, thresholds not inflated)');
		
		// Federal std deduction = (16100 + 2050) * 1.1 = 19,965
		assertEqual(result.federalStdDeduction, 19965, 'Federal Std Deduction (inflated)');
	});

	// ============================================================================
	// TEST CASE 8: Edge case - exactly at 50% threshold
	// ============================================================================
	test('TEST CASE 8: Edge case - exactly at 50% threshold', () => {
		
		const result = calculateTaxes({
			filingStatus: 'SGL',
			ages: [66],
			earnedIncome: 10000,
			totalSS: 30000,
			ordDivInterest: 0,
			qualifiedDiv: 0,
			capGains: 0,
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.0,
			state: 'TESTTAXATION'
		});
		
		// Provisional income = 10000 + 0.5 * 30000 = 25,000 (exactly at first threshold)
		assertEqual(result.provisionalIncome, 25000, 'Provisional Income (exactly at threshold)');
		
		// At exactly $25,000, we're at the boundary
		// Should trigger 50% taxability for income above this
		assertEqual(result.taxableSS, 0, 'Taxable SS (at threshold boundary)');
	});

	// ============================================================================
	// TEST CASE 9: SS thresholds are NOT CPI-indexed (validates fix vs old bug)
	// ============================================================================
	test('TEST CASE 9: SS thresholds are NOT CPI-indexed (validates fix vs old bug)', () => {

		const result = calculateTaxes({
			filingStatus: 'SGL',
			ages: [66],
			earnedIncome: 8000,
			totalSS: 40000,
			ordDivInterest: 0,
			qualifiedDiv: 0,
			capGains: 0,
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.5,  // 50% inflation - old code would inflate thresholds
			state: 'TESTTAXATION'
		});

		// Provisional income = 8000 + 0.5 * 40000 = 28,000
		// SS thresholds are NOT inflated: t1=25,000, t2=34,000
		// 28,000 is in tier-1 band (25k–34k):
		//   excessOver1 = 28000 - 25000 = 3,000
		//   taxableSS = min(0.5 * 40000, 0.5 * 3000) = min(20000, 1500) = 1,500
		// (Old buggy code: inflated t1=37,500 → provisional 28,000 < 37,500 → taxableSS=0)
		assertEqual(result.provisionalIncome, 28000, 'Provisional Income');
		assertEqual(result.taxableSS, 1500, 'Taxable SS (SS thresholds not CPI-indexed)');
	});

	// ============================================================================
	// TEST CASE 10: OBBBA senior deduction - full (below phase-out)
	// ============================================================================
	test('TEST CASE 10: OBBBA senior deduction - full (below phase-out)', () => {

		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [70, 68],  // Both seniors
			earnedIncome: 50000,
			totalSS: 20000,
			ordDivInterest: 0,
			qualifiedDiv: 0,
			capGains: 0,
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.0,
			state: 'TESTTAXATION',
			obbaOn: true
		});

		// Provisional income = 50000 + 0.5*20000 = 60000 > 44000
		// Tier1=6000, Tier2=0.85*(60000-44000)=13600 → total=19600, max=0.85*20000=17000
		// taxableSS=17000, AGI=50000+17000=67000
		// OBBBA: 2 seniors, rawSenDed=12000, phaseoutExcess=max(0,67000-150000)=0
		assertEqual(result.AGI, 67000, 'AGI');
		assertEqual(result.seniorDeduction, 12000, 'Senior Deduction (full, below phase-out)');
		assertEqual(result.useItemized, false, 'Not itemizing (SALT < std deduction)');
	});

	// ============================================================================
	// TEST CASE 11: OBBBA senior deduction - partial phase-out
	// ============================================================================
	test('TEST CASE 11: OBBBA senior deduction - partial phase-out', () => {

		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [70, 68],
			earnedIncome: 200000,
			totalSS: 0,
			ordDivInterest: 0,
			qualifiedDiv: 0,
			capGains: 0,
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.0,
			state: 'TESTTAXATION',
			obbaOn: true
		});

		// AGI = 200000; phaseoutExcess = 200000-150000 = 50000
		// seniorDeduction = max(0, 12000 - 50000*0.06) = max(0, 12000-3000) = 9000
		assertEqual(result.AGI, 200000, 'AGI');
		assertEqual(result.seniorDeduction, 9000, 'Senior Deduction (partial phase-out)');
	});

	// ============================================================================
	// TEST CASE 12: OBBBA senior deduction - fully phased out
	// ============================================================================
	test('TEST CASE 12: OBBBA senior deduction - fully phased out', () => {

		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [70, 68],
			earnedIncome: 350000,
			totalSS: 0,
			ordDivInterest: 0,
			qualifiedDiv: 0,
			capGains: 0,
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.0,
			state: 'TESTTAXATION',
			obbaOn: true
		});

		// AGI = 350000; phaseoutExcess = 200000; reduction = 200000*0.06=12000 > 8000
		// seniorDeduction = max(0, 8000-12000) = 0
		assertEqual(result.AGI, 350000, 'AGI');
		assertEqual(result.seniorDeduction, 0, 'Senior Deduction (fully phased out)');
	});

	// ============================================================================
	// TEST CASE 13: SALT itemizing wins with OBBBA $40k cap
	// ============================================================================
	test('TEST CASE 13: SALT itemizing wins with OBBBA $40k cap', () => {

		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [55, 53],
			earnedIncome: 500000,
			totalSS: 0,
			ordDivInterest: 0,
			qualifiedDiv: 0,
			capGains: 0,
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.0,
			state: 'TESTTAXATION',
			obbaOn: true,
			saltHigh: true
		});

		// stateAGI=500000, std=10000, taxableState=490000
		// stateTax = 50000*0.05 + 50000*0.10 + 390000*0.15 = 2500+5000+58500 = 66000
		// SALT: min(66000+0, 40000)=40000; federalStd=32200 (no age bumps)
		// 40000 > 32200 → useItemized=true, federalDeduction=40000
		// federalAGI=500000; federalTaxableIncome=500000-40000=460000
		assertEqual(result.useItemized, true, 'SALT itemizing wins');
		assertEqual(result.federalStdDeduction, 40000, 'Federal deduction = SALT $40k cap');
		assertEqual(result.federalTaxableIncome, 460000, 'Federal taxable income with SALT deduction');
	});

	// ============================================================================
	// TEST CASE 14: SALT $10k cap never beats standard deduction
	// ============================================================================
	test('TEST CASE 14: SALT $10k cap never beats standard deduction', () => {

		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [55, 53],
			earnedIncome: 500000,
			totalSS: 0,
			ordDivInterest: 0,
			qualifiedDiv: 0,
			capGains: 0,
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.0,
			state: 'TESTTAXATION'
			// obbaOn defaults false → saltCap=$10k
		});

		// stateTax=66000; SALT=min(66000,10000)=10000 < federalStd=32200
		// → useItemized=false; federalDeduction=32200
		assertEqual(result.useItemized, false, 'SALT $10k cap does not beat std deduction');
		assertEqual(result.federalStdDeduction, 32200, 'Uses standard deduction');
	});

	// ============================================================================
	// TEST CASE 15: SALT cap mid-phase-out (MAGI $540k → cap reduced to $28k, below std ded)
	// ============================================================================
	test('TEST CASE 15: SALT cap mid-phase-out (MAGI $540k → cap reduced to $28k, below std ded)', () => {

		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [55, 53],
			earnedIncome: 540000,
			totalSS: 0,
			ordDivInterest: 0,
			qualifiedDiv: 0,
			capGains: 0,
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.0,
			state: 'TESTTAXATION',
			obbaOn: true,
			saltHigh: true
		});

		// saltMagi = 540000; excess = 540000-500000 = 40000
		// saltCap = max(10000, 40000 - 40000*0.30) = max(10000, 28000) = 28000
		// stateTax on 530000 (540000-10000 std) =
		//   50000*0.05 + 50000*0.10 + 430000*0.15 = 2500+5000+64500 = 72000
		// saltItemized = min(72000, 28000) = 28000 > federalStd=32200? No: 28000 < 32200
		// → useItemized=false (phased-out cap fell below standard deduction)
		assertEqual(result.useItemized, false, 'Phased-out SALT cap falls below std deduction');
		assertEqual(result.federalStdDeduction, 32200, 'Uses standard deduction after phase-out');
	});

	// ============================================================================
	// TEST CASE 16: SALT cap fully phased out (MAGI $550k → cap floors at $10k)
	// ============================================================================
	test('TEST CASE 16: SALT cap fully phased out (MAGI $550k → cap floors at $10k)', () => {

		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [55, 53],
			earnedIncome: 550000,
			totalSS: 0,
			ordDivInterest: 0,
			qualifiedDiv: 0,
			capGains: 0,
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.0,
			state: 'TESTTAXATION',
			obbaOn: true,
			saltHigh: true
		});

		// saltMagi = 550000; excess = 50000; cap = max(10000, 40000-50000) = 10000 (floor)
		// Behaves identically to saltHigh=false at this income level
		assertEqual(result.useItemized, false, 'Fully phased-out SALT cap floors at $10k');
		assertEqual(result.federalStdDeduction, 32200, 'Uses standard deduction (SALT floor = std ded)');
	});

	// ============================================================================
	// TEST CASE 17: CT state taxes SS at 25%
	// ============================================================================
	test('TEST CASE 17: CT state taxes SS at 25%', () => {

		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [67, 65],
			earnedIncome: 50000,
			totalSS: 40000,
			ordDivInterest: 0,
			qualifiedDiv: 0,
			capGains: 0,
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.0,
			state: 'CT'
		});

		// CT SSTaxation=0.25 → stateTaxableSS = 40000*0.25 = 10000
		// stateAGI = 50000 + 10000 + 0 + 0 + 0 = 60000
		// CT MFJ std = 24000 → stateTaxableIncome = 60000-24000 = 36000
		assertEqual(result.stateAGI, 60000, 'CT stateAGI includes 25% of SS');
		assertEqual(result.stateTaxableIncome, 36000, 'CT state taxable income');
	});

	// ============================================================================
	// TEST CASE 18: stateOrdinaryTax / stateCapGainsTax split
	// ============================================================================
	test('TEST CASE 18: stateOrdinaryTax / stateCapGainsTax split', () => {

		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [55, 53],
			earnedIncome: 100000,
			totalSS: 0,
			ordDivInterest: 0,
			qualifiedDiv: 0,
			capGains: 50000,
			taxExemptInterest: 0,
			hsaContrib: 0,
			inflation: 1.0,
			state: 'TESTTAXATION'
		});

		// stateAGI = 100000+50000 = 150000; std=10000; taxable=140000
		// stateTax = 50000*0.05 + 50000*0.10 + 40000*0.15 = 2500+5000+6000 = 13500
		// stateAGIOrdOnly = 150000-50000=100000; taxableOrdOnly=90000
		// stateOrdinaryTax = 50000*0.05 + 40000*0.10 = 2500+4000 = 6500
		// stateCapGainsTax = 13500-6500 = 7000
		assertEqual(result.stateTax, 13500, 'Total state tax');
		assertEqual(result.stateOrdinaryTax, 6500, 'State ordinary tax');
		assertEqual(result.stateCapGainsTax, 7000, 'State cap gains tax');
	});

	// ============================================================================
	// TEST CASE 19: IL / PA full retirement exclusion regression (unchanged by the
	// generalized RETIREMENT_EXCLUSION evaluator - mode:'full' behavior is untouched)
	// ============================================================================
	test('TEST CASE 19: IL / PA full retirement exclusion regression', () => {

		const il = calculateTaxes({
			filingStatus: 'MFJ', ages: [70, 68],
			earnedIncome: 50000, pensionIncome: 30000, iraIncome: 20000,
			totalSS: 0, ordDivInterest: 5000, qualifiedDiv: 0, capGains: 0,
			taxExemptInterest: 0, hsaContrib: 0, inflation: 1.0, state: 'IL'
		});
		// stateAGI = 50000 + 5000 - stateRetExcl(50000, all pension+ira) = 5000; std 5850 -> taxable 0
		assertEqual(il.stateAGI, 5000, 'IL stateAGI excludes all pension+IRA income');
		assertEqual(il.stateTaxableIncome, 0, 'IL state taxable income (below std deduction)');
		assertEqual(il.stateTax, 0, 'IL state tax');

		const pa = calculateTaxes({
			filingStatus: 'MFJ', ages: [70, 68],
			earnedIncome: 50000, pensionIncome: 30000, iraIncome: 20000,
			totalSS: 0, ordDivInterest: 5000, qualifiedDiv: 0, capGains: 0,
			taxExemptInterest: 0, hsaContrib: 0, inflation: 1.0, state: 'PA'
		});
		// stateAGI = 5000 (same); PA std=0 -> taxable=5000; flat 3.07%
		assertEqual(pa.stateAGI, 5000, 'PA stateAGI excludes all pension+IRA income');
		assertEqual(pa.stateTaxableIncome, 5000, 'PA state taxable income (no std deduction)');
		assertEqual(pa.stateTax, 153.5, 'PA state tax (5000 * 3.07%)');
	});

	// ============================================================================
	// TEST CASE 20: GA cap mode - per-person age-tiered cap (ageGateTiers)
	// ============================================================================
	test('TEST CASE 20: GA cap mode - per-person age-tiered cap (ageGateTiers)', () => {

		// Only one filer (age 65) qualifies for the $65,000 tier; the other (age 40) qualifies
		// for none, so the household cap is $65,000, not $130,000 or unlimited.
		const result = calculateTaxes({
			filingStatus: 'MFJ', ages: [65, 40],
			earnedIncome: 70000, pensionIncome: 70000, iraIncome: 0,
			totalSS: 0, ordDivInterest: 0, qualifiedDiv: 0, capGains: 0,
			taxExemptInterest: 0, hsaContrib: 0, inflation: 1.0, state: 'GA'
		});
		// stateRetExcl = min(70000, 65000 [one qualifying filer] + 0 [other filer]) = 65000
		// stateAGI = 70000 - 65000 = 5000
		assertEqual(result.stateAGI, 5000, 'GA stateAGI reflects one $65k qualifying-filer cap, not full exclusion');
	});

	// ============================================================================
	// TEST CASE 21: CT phaseout mode - graduated % exclusion by federal AGI
	// ============================================================================
	test('TEST CASE 21: CT phaseout mode - graduated % exclusion by federal AGI', () => {

		const result = calculateTaxes({
			filingStatus: 'MFJ', ages: [65, 63],
			earnedIncome: 50000, pensionIncome: 50000, iraIncome: 0,
			totalSS: 0, ordDivInterest: 55000, qualifiedDiv: 0, capGains: 0,
			taxExemptInterest: 0, hsaContrib: 0, inflation: 1.0, state: 'CT'
		});
		// federalAGI = 50000 + 55000 = 105000 -> CT MFJ tier at $105,000 = 85% excluded
		assertEqual(result.AGI, 105000, 'CT test setup: federal AGI lands exactly on the 85% tier');
		// stateRetExcl = 50000 * 0.85 = 42500; stateAGI = 50000+55000-42500 = 62500
		assertEqual(result.stateAGI, 62500, 'CT stateAGI reflects 85% (not 100%) retirement-income exclusion');
		assertEqual(result.stateTaxableIncome, 38500, 'CT state taxable income (62500 - 24000 std)');
	});

	// ============================================================================
	// TEST CASE 22: OH credit mode - post-tax dollar credit, tiered + MAGI-gated
	// ============================================================================
	test('TEST CASE 22: OH credit mode - post-tax dollar credit, tiered + MAGI-gated', () => {

		const underGate = calculateTaxes({
			filingStatus: 'SGL', ages: [70],
			earnedIncome: 60000, pensionIncome: 6000, iraIncome: 0,
			totalSS: 0, ordDivInterest: 0, qualifiedDiv: 0, capGains: 0,
			taxExemptInterest: 0, hsaContrib: 0, inflation: 1.0, state: 'OH'
		});
		// stateTaxableIncome = 60000-2400=57600; stateTax pre-credit = (57600-26050)*0.0275 = 867.625
		// $6,000 of retirement income received -> $130 credit tier -> stateTax = 867.625-130 = 737.625
		assertEqual(underGate.stateTax, 737.625, 'OH state tax reduced by $130 retirement-income credit');

		const overGate = calculateTaxes({
			filingStatus: 'SGL', ages: [70],
			earnedIncome: 150000, pensionIncome: 6000, iraIncome: 0,
			totalSS: 0, ordDivInterest: 0, qualifiedDiv: 0, capGains: 0,
			taxExemptInterest: 0, hsaContrib: 0, inflation: 1.0, state: 'OH'
		});
		// MAGI (150000) >= $100,000 gate -> credit is zero, stateTax unreduced
		const preCreditTax = ((150000 - 2400) - 26050) * 0.0275;
		assertEqual(overGate.stateTax, preCreditTax, 'OH credit is zero once MAGI >= $100,000 gate');
	});

	// ============================================================================
	// TEST CASE 23: AL array-of-rules - disjoint types, pension full-exempt + IRA capped
	// ============================================================================
	test('TEST CASE 23: AL array-of-rules - disjoint types, pension full-exempt + IRA capped', () => {

		const result = calculateTaxes({
			filingStatus: 'SGL', ages: [70],
			earnedIncome: 30000, pensionIncome: 20000, iraIncome: 10000,
			totalSS: 0, ordDivInterest: 0, qualifiedDiv: 0, capGains: 0,
			taxExemptInterest: 0, hsaContrib: 0, inflation: 1.0, state: 'AL'
		});
		// stateRetExcl = 20000 (pension, full) + min(10000,6000) (IRA, capped at 65+) = 26000
		// stateAGI = 30000 - 26000 = 4000; std 3000 -> taxable 1000
		assertEqual(result.stateAGI, 4000, 'AL stateAGI: pension fully excluded, IRA capped at $6,000');
		assertEqual(result.stateTax, 30, 'AL state tax on the remaining $1,000 taxable (2%*500 + 4%*500)');
	});

// ── Runner ───────────────────────────────────────────────────────────────────────────────────
// Returns the counts instead of setting process.exitCode, so the browser can render them.
function runTaxEngineTests() {
	passed = 0;
	failed = 0;
	const failures = [];
	installTestState();
	try {
		TESTS.forEach(([name, fn]) => {
			try {
				fn();
				console.log(`  ✓  ${name}`);
				passed++;
			} catch (e) {
				console.log(`  ✗  ${name}`);
				console.log(`       ${e.message}`);
				failures.push(`${name}: ${e.message}`);
				failed++;
			}
		});
	} finally {
		removeTestState();
	}
	console.log('');
	console.log(`Results: ${passed} passed, ${failed} failed`);
	console.log(failed > 0 ? '\n*** SOME TESTS FAILED ***' : 'All tests passed.');
	return { passed, failed, skipped: 0, total: TESTS.length, failures };
}

if (IS_NODE) {
	const r = runTaxEngineTests();
	if (r.failed > 0) process.exitCode = 1;
	module.exports = { runTaxEngineTests, TEST_COUNT: TESTS.length };
} else {
	window.runTaxEngineTests = runTaxEngineTests;
	window.TAXENGINE_TEST_COUNT = TESTS.length;
}

})();
