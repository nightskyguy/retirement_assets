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
 * TESTTAXATION and TEST are synthetic jurisdictions with round-number brackets, installed into
 * TAXData for the duration of a run and removed again afterward, so a page that lists TAXData's
 * states never sees either. TEST moved here from taxengine.js's own tables in 11.18e4.
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
const getIRMAATiers = (...a) => _engine().getIRMAATiers(...a);
const netCapitalLosses = (...a) => _engine().netCapitalLosses(...a);
const isQCDEligible = (...a) => _engine().isQCDEligible(...a);
const rmdStartAge = (...a) => _engine().rmdStartAge(...a);
const rmdDivisor = (...a) => _engine().rmdDivisor(...a);
const calculateTaxableSocialSecurity = (...a) => _engine().calculateTaxableSocialSecurity(...a);
const getRateBracket = (...a) => _engine().getRateBracket(...a);
const getIRMAATier = (...a) => _engine().getIRMAATier(...a);
const getQCDLimit = (...a) => _engine().getQCDLimit(...a);

// medicare_costs.js is a SEPARATE file with no dependency on taxengine.js, and is covered here
// rather than in a suite of its own: a sixth suite would cost three permanent count pins for one
// data file. Resolved the same lazy dual-mode way as the engine above.
function _medicare() {
	const m = IS_NODE ? require('./medicare_costs.js') : window.MedicareCosts;
	if (!m) throw new Error('medicare_costs.js has not loaded yet');
	return m;
}
const medicareGrowthRate = (...a) => _medicare().medicareGrowthRate(...a);
const medicareGrowthFactor = (...a) => _medicare().medicareGrowthFactor(...a);

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

// The bracket-lookup fixture: round numbers chosen so findLimitByRate, findUpperLimitByAmount
// and calculateProgressive can be asserted by hand. It lived in taxengine.js's own tables until
// 11.18e4; every dropdown filtered it out by name length, which is not a guarantee anyone should
// have to rely on.
function installBracketFixture() {
	TAXData.TEST = {
		YEAR: 2026,
		SSTaxation: 0.50,
		MFJ: { std: 100,   brackets: [{ l: 1000,   r: 0.1, nr: 0.1 }, { l: 2000,   r: 0.2, nr: 0.15 }, { l: 40000,   r: 0.8, nr: 0.4  }] },
		SGL: { std: 100/2, brackets: [{ l: 1000/2, r: 0.1, nr: 0.1 }, { l: 2000/2, r: 0.2, nr: 0.15 }, { l: 40000/2, r: 0.8, nr: 0.45 }] },
	};
}
// The jurisdictions installTestState() adds. Tests that walk every state in TAXData skip these.
const SYNTHETIC_STATES = ['TESTTAXATION', 'TEST'];
function removeTestState() {
	for (const k of SYNTHETIC_STATES) delete TAXData[k];
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
	
    assertEqual(findLimitByRate('CA', 'SGL', 0.06, 1), { limit: 59498, rate: 0.06 },
                '😭findLimitByRate: State SGL 6% bracket');

		
	assertEqual(calculateProgressive('SOCIALSECURITY', 'MFJ', 55000).marginal, 
		0.85,
		'😭calculateProgressive(SOCIALSECURITY, MFJ, 55000) CHANGES with SOCIALSECURITY data.')
});

test('calcIRMAA: tiers, CPI, the Medicare rate and the per-person gate (sensitive to the real TAXData)', () => {
	assertEqual(calcIRMAA(100, 'SGL', 1), 0,
				'😭calcIRMAA  0 for SGL at 100 income');

	// Every figure below is the SURCHARGE alone, from the CMS 2026 fact sheet: the Part B
	// income-related adjustment plus the Part D IRMAA for that band. The base premium is NOT in
	// here - optimizer_core.js charges it separately as yr.medicareBase - and the amounts are
	// monthly, hence the * 12.
	const SGL_T1 = 81.20 + 14.50, SGL_T2 = 202.90 + 37.60;

	// 109,001 is the FIRST dollar of Tier 1; 109,000 itself is still no-surcharge.
	assertEqual(calcIRMAA(109000, 'SGL', 1, 1), 0,
				'😭calcIRMAA  the Tier 1 floor itself is below the band');

	assertEqual(calcIRMAA(109001, 'SGL', 1, 1), 12 * SGL_T1,
				'😭calcIRMAA  Tier 1 surcharge for 109001 SGL income');

	assertEqual(calcIRMAA(273999, 'MFJ', 1, 1.5), 1.5 * 2 * (12 * SGL_T1),
				'😭calcIRMAA no CPI, 1.5 medicareRate @ 273999 MFJ income');    

	assertEqual(calcIRMAA(274001, 'MFJ', 1, 1), 12 * 2 * SGL_T2,
				'😭calcIRMAA  2 * (284.10 + 14.50) for 274000 MFJ income');

	assertEqual(calcIRMAA(218000, 'MFJ', 2, 1), 0,
				'😭calcIRMAA  2 * (284.10 + 14.50) for 218000 MFJ income at 2');

	// Per-person Medicare gate (onMedicareCount param). MFJ bracket rates are household
	// (2x per-person) totals; count scales them to who is actually 65+.
	assertEqual(calcIRMAA(274001, 'MFJ', 1, 1, 1), 12 * SGL_T2,
				'😭calcIRMAA MFJ one spouse on Medicare = half the household surcharge');

	assertEqual(calcIRMAA(274001, 'MFJ', 1, 1, 0), 0,
				'😭calcIRMAA MFJ neither spouse 65+ = no surcharge');

	assertEqual(calcIRMAA(274001, 'MFJ', 1, 1, 2), 12 * 2 * SGL_T2,
				'😭calcIRMAA MFJ both on Medicare = full household surcharge');

	assertEqual(calcIRMAA(274001, 'MFJ', 1, 1, 3), 12 * 2 * SGL_T2,
				'😭calcIRMAA MFJ count clamps at 2 persons');

	assertEqual(calcIRMAA(109001, 'SGL', 1, 1, 1), 12 * SGL_T1,
				'😭calcIRMAA SGL on Medicare = full single surcharge');

	assertEqual(calcIRMAA(109001, 'SGL', 1, 1, 0), 0,
				'😭calcIRMAA SGL under 65 = no surcharge');
});

test('FPL: HHS figures for GUIDELINE_YEAR, the year before the coverage year the tables serve', () => {
	// An ACA coverage year is measured against the guideline HHS published the January before, so
	// TAXData.FPL runs one year behind TAXData.FEDERAL. Moving FEDERAL.YEAR without the FPL block
	// fails here, and so does a GUIDELINE_YEAR carrying another year's figures. When the block
	// moves, add that year's row below from HHS's published guidelines (1 person, 2 persons,
	// contiguous 48 states and DC).
	const HHS = { 2025: { SGL: 15650, MFJ: 21150 } };
	const fpl = TAXData.FPL;
	assertEqual(fpl.PLAN_YEAR, TAXData.FEDERAL.YEAR, 'FPL.PLAN_YEAR is the tax tables\' own year');
	assertEqual(fpl.GUIDELINE_YEAR, fpl.PLAN_YEAR - 1, 'FPL.GUIDELINE_YEAR is the year before PLAN_YEAR');
	assertEqual(fpl.GUIDELINE_YEAR in HHS, true, `this test lists HHS's ${fpl.GUIDELINE_YEAR} guideline`);
	assertEqual({ SGL: fpl.SGL, MFJ: fpl.MFJ }, HHS[fpl.GUIDELINE_YEAR],
				`TAXData.FPL holds HHS's ${fpl.GUIDELINE_YEAR} guideline`);
});

test('rmdStartAge and rmdDivisor: the start age by birth year, and the Uniform Lifetime Table clamped at both ends', () => {
	assertEqual([1948, 1950, 1951, 1959, 1960, 1975].map(y => rmdStartAge(y)), [72, 72, 73, 73, 75, 75],
				'72 before 1951, 73 from 1951, 75 from 1960');
	assertEqual([60, 72, 100, 101, 120, 125].map(a => rmdDivisor(a)), [27.4, 27.4, 6.4, 6.0, 2.0, 2.0],
				'the divisor for an age, clamped into the table');
});

test('isQCDEligible: 70½ falls in the year of the 70th birthday for a January-June birth, the next year otherwise', () => {
	// Born June 1955: 70½ in December 2025. Born July 1955: 70½ in January 2026. No birth month
	// counts as the later half.
	assertEqual([isQCDEligible(1955, 6, 2024), isQCDEligible(1955, 6, 2025)], [false, true], 'born June 1955');
	assertEqual([isQCDEligible(1955, 7, 2025), isQCDEligible(1955, 7, 2026)], [false, true], 'born July 1955');
	assertEqual([isQCDEligible(1955, 1, 2025), isQCDEligible(1955, 12, 2025), isQCDEligible(1955, 12, 2026)],
				[true, false, true], 'born January and December 1955');
	assertEqual([isQCDEligible(1955, undefined, 2025), isQCDEligible(1955, undefined, 2026)], [false, true],
				'no birth month');
});

test('calculateTaxableSocialSecurity: the 50% and 85% tiers, both thresholds, both statuses (worked by hand)', () => {
	// SGL: 50% of provisional income over $25,000, 85% over $34,000. MFJ: $32,000 and $44,000. The
	// first tier never takes more than half the benefit, and the total never more than 85% of it.
	const t = calculateTaxableSocialSecurity;
	assertEqual(t('SGL', 25000, 20000), 0, 'SGL at the first threshold');
	assertEqual(t('SGL', 30000, 20000), 2500, 'SGL, first tier: 50% of the $5,000 over');
	assertEqual(t('SGL', 33000, 4000), 2000, 'SGL, first tier capped at half the benefit');
	assertEqual(t('SGL', 40000, 20000), 9600, 'SGL, second tier: $4,500 + 85% of the $6,000 over $34,000');
	assertEqual(t('SGL', 100000, 20000), 17000, 'SGL, capped at 85% of the benefit');
	assertEqual(t('MFJ', 32000, 30000), 0, 'MFJ at the first threshold');
	assertEqual(t('MFJ', 38000, 30000), 3000, 'MFJ, first tier');
	assertEqual(t('MFJ', 44000, 30000), 6000, 'MFJ at the second threshold: first tier only');
	assertEqual(t('MFJ', 60000, 30000), 19600, 'MFJ, second tier: $6,000 + 85% of the $16,000 over $44,000');
	assertEqual(t('MFJ', 200000, 30000), 25500, 'MFJ, capped at 85% of the benefit');
});

test('HSA contributions: deductible federally and by the states that follow, but not by California', () => {
	const base = { filingStatus: 'MFJ', ages: [60, 58], earnedIncome: 150000, totalSS: 0, ordDivInterest: 0,
	               qualifiedDiv: 0, capGains: 0, inflation: 1.0 };
	const tax = (state, hsa) => calculateTaxes({ ...base, state, hsaContrib: hsa });
	assertEqual(tax('CA', 10000).AGI, tax('CA', 0).AGI - 10000, 'federal AGI falls by the contribution');
	assertEqual(tax('CA', 10000).stateTax, tax('CA', 0).stateTax, 'California taxes the contribution anyway');
	assertEqual(tax('NY', 10000).stateTax < tax('NY', 0).stateTax, true, 'a state that follows federal deducts it');
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

	// INFLATION_INDEXED: false - MT/AL/OH/SC brackets must NOT inflate regardless of passed inflation
	// value. North Dakota is deliberately NOT in this list: its thresholds move every year, so it is
	// checked on the indexed side below.
	const mtBase     = calculateProgressive('MT', 'MFJ', 50000, 1.0);
	const mtInflated = calculateProgressive('MT', 'MFJ', 50000, 1.1);
	assertEqual(mtBase.total, mtInflated.total,
		'MT (INFLATION_INDEXED:false) - bracket inflation ignored, tax same at inflation=1.1 vs 1.0')
	assertEqual(mtBase.marginal, mtInflated.marginal,
		'MT marginal rate unchanged with inflation=1.1')
	const scBase     = calculateProgressive('SC', 'SGL', 60000, 1.0);
	const scInflated = calculateProgressive('SC', 'SGL', 60000, 1.1);
	assertEqual(scBase.total, scInflated.total,
		'SC (INFLATION_INDEXED:false) - bracket inflation ignored')
	const ndBase     = calculateProgressive('ND', 'SGL', 60000, 1.0);
	const ndInflated = calculateProgressive('ND', 'SGL', 60000, 1.1);
	assertEqual(ndBase.total > ndInflated.total, true,
		'ND (indexed) - inflation=1.1 widens the 0% band, lowering tax')
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
	// TEST CASE 6f: a bare 20% LTCG rate is unreachable - the 20% band is always 23.8%
	//
	// The two boundaries are measured on different bases, which is what hides this. The LTCG
	// ceilings are TAXABLE income; the NIIT threshold is MAGI, larger by the deduction. On a
	// common MAGI footing the surtax starts roughly $400k BEFORE the 20% bracket opens, so every
	// dollar taxed at 20% also owes 3.8%.
	//
	// Worth pinning because it is the invariant the old data block got wrong: it carried the 15%
	// ceiling AS the NIIT threshold, trying to mark where the surtax starts, which both mis-valued
	// the bracket and baked a drifting boundary into a fixed table. A future edit that moves either
	// threshold, or that "helpfully" indexes the NIIT one, reopens exactly that gap.
	//
	// Nothing here hard-codes the answer: each boundary is found by bisecting the engine.
	// ============================================================================
	test('TEST CASE 6f: the 20% LTCG band always carries NIIT, so it is really 23.8%', () => {

		const at = (status, gains, inflation) => calculateTaxes({
			filingStatus: status, ages: status === 'MFJ' ? [55, 53] : [55],
			earnedIncome: 0, capGains: gains, inflation, state: 'TESTTAXATION'
		});

		// Smallest all-gains MAGI whose MARGINAL LTCG rate is the top one, i.e. where the 20%
		// band opens, expressed as MAGI so it is comparable with the NIIT threshold.
		const magiWhere20Opens = (status, f) => {
			let lo = 0, hi = 5000000;
			for (let i = 0; i < 60; i++) {
				const mid = (lo + hi) / 2;
				if (at(status, mid, f).capitalGainsRate === 0.20) hi = mid; else lo = mid;
			}
			return hi;
		};

		// A plan's cumulative CPI factor starts at 1.0 and compounds; optimizer_core.js floors the
		// yearly rate at -1%, so 60 years of maximum sustained deflation still only reaches 0.547.
		// This range therefore covers every factor any plan can actually reach, and then some.
		const REACHABLE_FLOOR = Math.pow(0.99, 60);
		const factors = [REACHABLE_FLOOR, 0.6, 0.8, 1.0, 1.5, 2.0, 3.0];

		for (const status of ['MFJ', 'SGL']) {
			const threshold = TAXData.FEDERAL.NIIT[status];
			for (const f of factors) {
				const opens = magiWhere20Opens(status, f);
				assertEqual(opens > threshold, true,
					`${status} @ inflation ${f.toFixed(3)}: the 20% band must open above the NIIT threshold ` +
					`(opens at MAGI ${Math.round(opens)}, threshold ${threshold})`);
			}
		}

		// And the consequence, swept directly: no combination of ordinary income, gains and
		// inflation puts a filer in the 20% band without the surtax on the next gain dollar.
		let in20 = 0;
		for (const status of ['MFJ', 'SGL']) {
			for (const f of [REACHABLE_FLOOR, 1.0, 2.0]) {
				for (let ord = 0; ord <= 900000; ord += 100000) {
					for (let g = 100000; g <= 1500000; g += 100000) {
						const r = calculateTaxes({
							filingStatus: status, ages: status === 'MFJ' ? [55, 53] : [55],
							earnedIncome: ord, capGains: g, inflation: f, state: 'TESTTAXATION'
						});
						if (r.capitalGainsRate !== 0.20) continue;
						in20++;
						assertEqual(r.niitMarginalOnInvestment, 0.038,
							`${status} @ inflation ${f.toFixed(3)}, ord ${ord}, gains ${g}: ` +
							`a 20% LTCG dollar must also owe NIIT`);
					}
				}
			}
		}
		assertEqual(in20 > 100, true, 'the sweep must actually reach the 20% band, not vacuously pass');

		// The 0% band is the mirror image: it always sits BELOW the threshold, so it is a true 0%
		// and not 3.8%. Same bisection, on the first rate boundary instead of the last.
		for (const status of ['MFJ', 'SGL']) {
			const zeroCeiling = TAXData.FEDERAL.CAPITAL_GAINS[status].brackets[0].l;
			const r = at(status, zeroCeiling, 1.0);   // all gains, sitting at the 0% ceiling
			assertEqual(r.capitalGainsRate, 0, `${status}: at the 0% ceiling the LTCG rate is 0`);
			assertEqual(r.niitMarginalOnInvestment, 0, `${status}: and the 0% band owes no NIIT`);
		}
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
		// Each person: 6000 - 50000*0.06 = 3000, so two seniors get 6000 (IRS Schedule 1-A, lines 35-37)
		assertEqual(result.AGI, 200000, 'AGI');
		assertEqual(result.seniorDeduction, 6000, 'Senior Deduction (partial phase-out, per person)');
	});

	// ============================================================================
	// TEST CASE 11b: the reduction is per person, so a couple reaches zero at $250,000
	// ============================================================================
	test('TEST CASE 11b: OBBBA senior deduction - per-person phase-out on a joint return', () => {
		const at = (ages, agi) => calculateTaxes({
			filingStatus: 'MFJ', ages, earnedIncome: agi, totalSS: 0, ordDivInterest: 0, qualifiedDiv: 0,
			capGains: 0, taxExemptInterest: 0, hsaContrib: 0, inflation: 1.0, state: 'TESTTAXATION', obbaOn: true
		}).seniorDeduction;

		const assertNear = (actual, expected, tol, name) =>
			assertEqual(Math.abs(actual - expected) <= tol, true, `${name}: ${actual} vs ${expected}`);

		// Schedule 1-A: 207,444 MAGI -> 6000 - 0.06*57,444 = 2,553.36 per person
		assertNear(at([66, 74], 207444), 5106.72, 0.01, 'Two seniors at 207,444 (the tax-plan case)');
		assertNear(at([66, 60], 207444), 2553.36, 0.01, 'One senior at 207,444 gets one person amount');
		assertEqual(at([66, 74], 250000), 0, 'Two seniors reach zero at 250,000');
		assertNear(at([66, 74], 249999), 0.12, 0.001, 'Two seniors are down to 12 cents one dollar under 250,000');
		assertEqual(at([66, 60], 250000), 0, 'One senior reaches zero at 250,000 as well');
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

		// AGI = 350000; phaseoutExcess = 200000; each person: max(0, 6000 - 200000*0.06) = 0
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

	// ============================================================================
	// TEST CASE 24: the Social Security taxation tiers, called directly
	// ============================================================================
	// Every other test here reaches these tiers through calculateTaxes, which means a change to
	// the thresholds or the two rates shows up only as a different total tax. This states the
	// statute itself: below the first threshold none of the benefit is taxable, between the two
	// thresholds half of the excess is, above the second 85% of the further excess is, and the
	// taxable share is capped at 85% of the benefit however large the income gets.
	test('TEST CASE 24: Social Security taxability - both thresholds, both rates, both statuses', () => {
		const ss = calculateTaxableSocialSecurity;
		// MFJ thresholds are $32,000 and $44,000; SGL $25,000 and $34,000. Benefit $40,000 MFJ.
		assertEqual(ss('MFJ', 30000, 40000), 0, 'MFJ below $32,000: none of the benefit is taxable');
		assertEqual(ss('MFJ', 32000, 40000), 0, 'MFJ exactly at the first threshold is still zero');
		// 0.50 x (40,000 - 32,000) = 4,000, which is under 0.50 x 40,000 so the excess rule binds.
		assertEqual(ss('MFJ', 40000, 40000), 4000, 'MFJ in the 50% band: half the excess over $32,000');
		// 0.50 x (44,000 - 32,000) = 6,000, then 0.85 x (60,000 - 44,000) = 13,600. Total 19,600.
		assertEqual(ss('MFJ', 60000, 40000), 19600, 'MFJ in the 85% band: the 50% band in full, then 85% of the rest');
		// The cap: 0.85 x 40,000 = 34,000, and no amount of income taxes more of the benefit.
		assertEqual(ss('MFJ', 200000, 40000), 34000, 'never more than 85% of the benefit itself');
		// The same provisional income, filed single, is taxable - which is the whole MFJ/SGL point.
		assertEqual(ss('SGL', 30000, 20000), 2500, 'SGL at $30,000: half the excess over $25,000');
		assertEqual(ss('SGL', 24999, 20000), 0, 'SGL below $25,000: none of it');
		// 0.50 x (34,000 - 25,000) = 4,500, then 0.85 x (50,000 - 34,000) = 13,600. Total 18,100,
		// which is above 0.85 x 20,000 = 17,000, so the cap is what is returned.
		assertEqual(ss('SGL', 50000, 20000), 17000, 'SGL: the 85% cap binds before the band arithmetic does');
	});

	// ============================================================================
	// TEST CASE 25: getIRMAATier and getQCDLimit
	// ============================================================================
	// Both are exported and neither had a direct test in any suite. getIRMAATier names the tier a
	// MAGI falls in; getQCDLimit indexes the per-person annual limit by the cumulative CPI factor.
	test('TEST CASE 25: the IRMAA tier LABEL names the band whose surcharge is charged', () => {
		// getIRMAATier and calcIRMAA read the same ladder through different helpers -
		// findBracketIndex and findUpperLimitByAmount - so an off-by-one in either would print a
		// tier beside a surcharge belonging to a different one. Walking every band, on both sides
		// of every floor, is what pins them together.
		for (const status of ['MFJ', 'SGL']) {
			const brks = getRateBracket('IRMAA', status);
			for (let i = 0; i < brks.length; i++) {
				if (!isFinite(brks[i].l)) continue;        // see TEST CASE 25c
				// Probe the floor and the middle of the band. NOT floor + a fixed amount: the
				// no-surcharge row's floor is one dollar under the first surcharge floor, so any
				// fixed step off it lands in the next band.
				const ceil = brks[i + 1] ? brks[i + 1].l : Infinity;
				const mid = isFinite(ceil) ? Math.floor((brks[i].l + ceil) / 2) : brks[i].l + 1e6;
				for (const magi of [brks[i].l, mid]) {
					assertEqual(getIRMAATier(magi, status, 1), brks[i].tier,
						`${status} MAGI ${magi} is in ${brks[i].tier}`);
					assertEqual(findUpperLimitByAmount('IRMAA', status, magi, 1).rate, brks[i].monthlyCost,
						`${status} MAGI ${magi} is charged the ${brks[i].tier} surcharge`);
				}
				if (i > 0) assertEqual(getIRMAATier(brks[i].l - 1, status, 1), brks[i - 1].tier,
					`${status}: a dollar under the ${brks[i].tier} floor is still ${brks[i - 1].tier}`);
			}
			// The floors index, so the same MAGI buys a lower tier once they have inflated.
			assertEqual(getIRMAATier(brks[1].l, status, 1.10), brks[0].tier,
				`${status}: with the floors 10% higher, a MAGI at last year's floor is back under the line`);
		}
	});

	test('TEST CASE 25c: the top tier has a floor and no ceiling, and the l:Infinity row is not a band', () => {
		// Counting these tiers wrongly is a standing trap, so the shape is pinned here as well as
		// described at the table (taxengine.js, TAXData.IRMAA). `-none-` is tier ZERO - no fee, no
		// tier - and there are five surcharge tiers after it. The final `{ l: Infinity }` row is
		// the last tier's ABSENT CEILING, the terminator every table in this file carries so that
		// "the ceiling of tier n" can be written brackets[n + 1].l for every n; `l` is a floor, so
		// no MAGI is ever in it. An income above the top floor is in tier 5 and pays tier 5.
		for (const status of ['MFJ', 'SGL']) {
			const brks = getRateBracket('IRMAA', status);
			assertEqual(brks[0].tier, '-none-', `${status}: the first row is the no-surcharge band`);
			assertEqual(brks[0].monthlyCost, 0, `${status}: and it charges nothing, which is why it is tier zero`);
			assertEqual(isFinite(brks[brks.length - 1].l), false,
				`${status}: the last row is the terminator, not a band`);
			const surcharge = brks.slice(1).filter(b => isFinite(b.l));
			assertEqual(surcharge.length, 5, `${status}: five surcharge tiers, numbered 1 to 5`);
			const top = surcharge[surcharge.length - 1];
			assertEqual(getIRMAATier(9e9, status, 1), top.tier,
				`${status}: an unbounded income is in the top tier, never in the terminator`);
			assertEqual(findUpperLimitByAmount('IRMAA', status, 9e9, 1).rate, top.monthlyCost,
				`${status}: and pays the top tier's surcharge`);
			// The consequence: asked for the ceiling of the top tier, the ladder has none to give.
			// Callers that aim at a ceiling must cope with Infinity rather than assume a number.
			assertEqual(brks[surcharge.length + 1].l, Infinity,
				`${status}: the ceiling of the top tier is Infinity, which is the thing to handle`);
		}
	});

	test('TEST CASE 25d: getIRMAATiers lists the five paying tiers and nothing else', () => {
		// The Income Tax Planner draws one reference line per entry. Each tier must carry a floor
		// and an annual dollar figure; a row that lost either would draw nothing, or draw at NaN.
		for (const status of ['MFJ', 'SGL']) {
			const brks = getRateBracket('IRMAA', status);
			const tiers = getIRMAATiers(status);
			assertEqual(tiers.length, 5, `${status}: five paying tiers, with no-surcharge and the terminator left out`);
			tiers.forEach((t, i) => {
				assertEqual(t.n, i + 1, `${status}: tiers are numbered 1 to 5`);
				assertEqual(t.tier, `Tier ${i + 1}`, `${status}: tier ${i + 1} carries the table's own label`);
				assertEqual(t.l, brks[i + 1].l, `${status}: tier ${i + 1} starts at the table's floor`);
				assertEqual(t.annualCost, brks[i + 1].monthlyCost * 12, `${status}: tier ${i + 1} annual cost is twelve months`);
				assertEqual(Number.isFinite(t.l) && t.annualCost > 0, true, `${status}: tier ${i + 1} has a floor and a charge`);
			});
			assertEqual(tiers[0].l, brks[0].l + 1, `${status}: tier 1 starts a dollar above the no-surcharge ceiling`);
			assertEqual(tiers.map(t => t.l).every((l, i, a) => i === 0 || l > a[i - 1]), true, `${status}: floors ascend`);
		}
	});

	test('TEST CASE 25e: netCapitalLosses nets the two baskets and keeps the gain\'s character', () => {
		const n = netCapitalLosses;
		const limit = TAXData.FEDERAL.CAPITAL_LOSS_LIMIT;
		assertEqual(limit, 3000, 'the annual net-loss offset is $3,000');
		// Gains only: nothing to net, each stays where it was.
		assertEqual(n(5000, 20000), { ordinary: 5000, longTerm: 20000, carryforward: 0 }, 'two gains pass through');
		// A short-term loss is absorbed by a long-term gain, and what is left is still long-term.
		assertEqual(n(-4000, 20000), { ordinary: 0, longTerm: 16000, carryforward: 0 }, 'a short-term loss reduces a long-term gain');
		// A long-term loss is absorbed by a short-term gain, and what is left is ordinary income.
		assertEqual(n(9000, -4000), { ordinary: 5000, longTerm: 0, carryforward: 0 }, 'a long-term loss reduces a short-term gain');
		// A loss larger than the gain that absorbs it is a net loss, capped at the limit.
		assertEqual(n(-10000, 2000), { ordinary: -3000, longTerm: 0, carryforward: 5000 }, 'net loss of 8,000: 3,000 offsets, 5,000 carries');
		assertEqual(n(-1000, 0), { ordinary: -1000, longTerm: 0, carryforward: 0 }, 'a small net loss offsets in full');
		assertEqual(n(-2000, -8000), { ordinary: -3000, longTerm: 0, carryforward: 7000 }, 'two losses are one net loss');
	});

	test('TEST CASE 25f: a capped net loss feeds the tax engine as ordinary income', () => {
		// The page hands calculateTaxes the netted pieces. A $10,000 net loss against nothing else
		// must lower AGI by the $3,000 the return allows, not by $10,000.
		const net = netCapitalLosses(-10000, 0);
		const r = calculateTaxes({ filingStatus: 'SGL', ages: [60], earnedIncome: 50000 + net.ordinary,
			capGains: net.longTerm, state: 'TX', inflation: 1, taxYear: 2026 });
		assertEqual(r.AGI, 47000, 'AGI falls by 3,000, the capped offset');
	});

	// The three kinds of interest that are not simply "income": municipal interest (federal MAGI only),
	// US-obligation interest (state-exempt), and tax-exempt interest a state taxes anyway.
	const interestBase = { filingStatus: 'SGL', ages: [65], earnedIncome: 80000, state: 'CA',
		inflation: 1, obbaOn: true, saltHigh: true, taxYear: 2026 };

	test('TEST CASE 25g: stateExemptInterest comes out of state income only', () => {
		const a = calculateTaxes(interestBase);
		const b = calculateTaxes({ ...interestBase, stateExemptInterest: 5000 });
		const c = calculateTaxes({ ...interestBase, earnedIncome: 75000 });
		assertEqual(b.federalTax, a.federalTax, 'federal tax does not move: the interest is still federal income');
		assertEqual(b.MAGI, a.MAGI, 'MAGI does not move either');
		assertEqual(b.stateTax, c.stateTax, 'state tax is that of 5,000 less income');
		assertEqual(b.stateTax < a.stateTax, true, 'and lower than without it');
	});

	test('TEST CASE 25h: stateTaxableExempt goes into state income only', () => {
		const a = calculateTaxes(interestBase);
		const muni = calculateTaxes({ ...interestBase, taxExemptInterest: 5000 });
		const taxed = calculateTaxes({ ...interestBase, taxExemptInterest: 5000, stateTaxableExempt: 5000 });
		const more = calculateTaxes({ ...interestBase, earnedIncome: 85000 });
		assertEqual(muni.stateTax, a.stateTax, 'municipal interest alone leaves state tax where it was');
		assertEqual(taxed.stateTax, more.stateTax, 'a state that taxes it charges what 5,000 more income would');
		assertEqual(taxed.federalTax, muni.federalTax, 'federal tax is unchanged by the state treatment');
		assertEqual(taxed.MAGI, muni.MAGI, 'and so is MAGI');
	});

	test('TEST CASE 25i: taxExemptInterest raises MAGI and Social Security taxability, not federal tax directly', () => {
		const ss = { ...interestBase, earnedIncome: 20000, totalSS: 24000 };
		const g = calculateTaxes(ss);
		const h = calculateTaxes({ ...ss, taxExemptInterest: 5000 });
		assertEqual(h.AGI - g.AGI, h.taxableSS - g.taxableSS, 'AGI moves only through the Social Security that becomes taxable');
		assertEqual(h.MAGI - h.AGI, 5000, 'MAGI is AGI plus the municipal interest');
		assertEqual(h.taxableSS > g.taxableSS, true, 'more of the benefit is taxable');
		const plain = calculateTaxes(interestBase);
		const withMuni = calculateTaxes({ ...interestBase, taxExemptInterest: 5000 });
		assertEqual(withMuni.federalTax, plain.federalTax, 'with no Social Security, federal tax does not move');
		assertEqual(withMuni.MAGI - plain.MAGI, 5000, 'but MAGI, which sets IRMAA, rises by the amount');
	});

	test('TEST CASE 25b: getQCDLimit is the table amount times the cumulative CPI factor', () => {
		// cpiFactor is the CUMULATIVE index, not a rate - the trap the function\'s own comment names.
		assertEqual(getQCDLimit(1), TAXData.QCD.AMOUNT, 'an unindexed year is the table amount');
		assertEqual(getQCDLimit(1.03), TAXData.QCD.AMOUNT * 1.03, 'one year at 3% is one multiplication');
		assertEqual(getQCDLimit(), TAXData.QCD.AMOUNT, 'a missing factor is 1, never NaN');
	});

	// ── medicare_costs.js ─────────────────────────────────────────────────────────────────────
	// The two-phase escalation model. Measured case: research/MEDICARE_ESCALATION.md.

	test('TEST CASE 26: MEDICARE_COSTS agrees with TAXData, which it is not allowed to read', () => {
		// medicare_costs.js has ZERO dependencies on purpose - standalone/FutureCost.html loads it
		// without taxengine.js - so it carries its own ANCHOR_YEAR and cannot check it. This test
		// IS the check. Same shape as the planner's SAFE_HARBOR pin: two files loaded by different
		// pages, duplication that only a test can hold together.
		const M = _medicare().MEDICARE_COSTS;
		assertEqual(M.ANCHOR_YEAR, TAXData.IRMAA.YEAR,
			'the anchor year is the year TAXData.IRMAA dollars are stated in');
		assertEqual(M.partB[M.ANCHOR_YEAR - M.partBStartYear], TAXData.IRMAA.standardPartB,
			'the series and the table state the same 2026 premium');
		assertEqual(M.partBStartYear + M.partB.length - 1 >= M.partBActualThrough, true,
			'the series reaches at least as far as the last actual year it claims');
	});

	test('TEST CASE 26b: the growth rate starts at g0 and decays toward gLong without reaching it', () => {
		const M = _medicare().MEDICARE_COSTS;
		assertEqual(medicareGrowthRate(0), M.g0, 't = 0 is the first projected year, so it is g0');
		// Strictly decreasing, and always still above the floor it is approaching. A model that
		// crossed gLong would be extrapolating past its own assumption.
		for (let t = 0; t < 60; t++) {
			assertEqual(medicareGrowthRate(t) > medicareGrowthRate(t + 1), true,
				`the rate falls every year (t = ${t})`);
			assertEqual(medicareGrowthRate(t) > M.gLong, true,
				`the rate never reaches gLong (t = ${t})`);
		}
		assertEqual(medicareGrowthRate(400), M.gLong, 'far enough out it is gLong to three decimals');
		// A negative or missing t is g0, never a division or a NaN that would spread silently.
		assertEqual(medicareGrowthRate(-5), M.g0, 'a negative elapsed year is g0');
	});

	test('TEST CASE 26c: the factor is exactly 1 at the anchor and equals the product of the rates', () => {
		assertEqual(medicareGrowthFactor(0), 1,
			'at the anchor year the published dollars pass through unchanged');
		// The two helpers are separate entry points onto one model. If they ever disagree, one
		// caller compounds differently from another and nothing else would catch it.
		for (const n of [1, 5, 9, 30]) {
			let prod = 1;
			for (let t = 0; t < n; t++) prod *= 1 + medicareGrowthRate(t);
			assertEqual(medicareGrowthFactor(n), prod, `factor(${n}) is the product of the rates`);
		}
		assertEqual(medicareGrowthFactor(-3), 1, 'a negative span is 1, never a reciprocal');
	});

	test('TEST CASE 26d: g0 re-derives from the shipped series, so the comment cannot drift', () => {
		// The series ships precisely so this is checkable. g0 is the Trustees' own 2026 to 2035
		// premium CAGR; if someone edits one without the other, this fails rather than the model
		// quietly disagreeing with the data it claims to come from.
		const M = _medicare().MEDICARE_COSTS;
		const at = y => M.partB[y - M.partBStartYear];
		const cagr = Math.pow(at(2035) / at(M.ANCHOR_YEAR), 1 / 9) - 1;
		assertEqual(cagr, M.g0, 'g0 is the 2026 to 2035 CAGR of the published premium path');
	});

	test('TEST CASE 26e: the model contains the flat one, so gLong = g0 is a constant rate', () => {
		// The cleanest possible proof that an override is live rather than ignored: set the two
		// ends equal and the two-phase model must reproduce compound interest exactly.
		const flat = { g0: 0.058, gLong: 0.058 };
		assertEqual(medicareGrowthRate(17, flat), 0.058, 'both ends equal means one rate');
		assertEqual(medicareGrowthFactor(25, flat), Math.pow(1.058, 25), '25 years of a flat 5.8%');
		// Overrides are per key: moving one leaves the other two at the shipped values.
		const M = _medicare().MEDICARE_COSTS;
		assertEqual(medicareGrowthRate(0, { gLong: 0.02 }), M.g0, 'g0 survives a gLong override');
		assertEqual(medicareGrowthFactor(40, { g0: 0, gLong: 0 }), 1, 'zero growth is flat forever');
	});

	test('TEST CASE 26f: calcIRMAA\'s medicareRate default is the identity, and grows nothing', () => {
		// It used to default to `1 + ANNUAL_INCREASE`, so a caller that forgot the argument got a
		// year of growth it never asked for. Every live caller passes it, which is exactly why the
		// trap could sit there. Pinned so the convenience is never re-added.
		const SGL_T1 = 12 * (81.20 + 14.50);
		assertEqual(calcIRMAA(109001, 'SGL', 1), SGL_T1, 'omitted medicareRate charges 2026 dollars');
		assertEqual(calcIRMAA(109001, 'SGL', 1), calcIRMAA(109001, 'SGL', 1, 1),
			'omitting it and passing 1 are the same thing');
		assertEqual(calcIRMAA(109001, 'SGL', 1, medicareGrowthFactor(0)), SGL_T1,
			'and medicareGrowthFactor(0) is that same identity, from the other file');
	});

	// ── TEST CASE 27: the four states corrected against their own 2026 forms ─────────────────────
	// Each figure below is PRINTED ON THE FORM, which is what makes this worth pinning: it is not an
	// engine output, it is the state's own arithmetic at a threshold the state chose. A table edited
	// from a summary rather than from the form fails here.
	test('TEST CASE 27: ND, NE, SC and GA reproduce the figures printed on their 2026 forms', () => {
		// North Dakota, 2026 Forms ND-1 and ND-EZ Tax Rate Schedules (Form ND-1ES, SFN 28709, 12-2025).
		// The base amounts at the top of each band are on the form; a 0% first band is the whole point.
		assertEqual(calculateProgressive('ND', 'SGL', 49575).total, 0,
			'ND single: the 0% band runs to 49,575');
		assertEqual(Math.round(calculateProgressive('ND', 'SGL', 250400).total * 100) / 100, 3916.09,
			'ND single: the form prints 3,916.09 at the top of the 1.95% band');
		assertEqual(Math.round(calculateProgressive('ND', 'MFJ', 304850).total * 100) / 100, 4329.98,
			'ND joint: the form prints 4,329.98 at the top of the 1.95% band');

		// Nebraska, 2026 Nebraska Tax Calculation Schedule (8-460-2026). Graduated, not flat.
		assertEqual(Math.round(calculateProgressive('NE', 'SGL', 39900).total * 100) / 100, 1514.58,
			'NE single: the schedule prints 1,514.58 at 39,900');
		assertEqual(Math.round(calculateProgressive('NE', 'MFJ', 79800).total * 100) / 100, 3029.16,
			'NE joint: the schedule prints 3,029.16 at 79,800');
		assertEqual(calculateProgressive('NE', 'MFJ', 8250).marginal, 0.0246,
			'NE joint: the first 8,250 is taxed at 2.46%, not at the 4.55% top rate');

		// South Carolina, H. 4216 from TY2026: the form states the upper band as "5.21% minus $966",
		// which must equal this schedule at every income above the threshold.
		for (const x of [30000, 50000, 120000, 400000]) {
			assertEqual(Math.round(calculateProgressive('SC', 'MFJ', x).total * 100) / 100,
				Math.round((x < 30000 ? 0.0199 * x : 0.0521 * x - 966) * 100) / 100,
				`SC joint at ${x}: matches the published 1.99% / 5.21%-minus-966 form`);
		}

		// The standard deductions these four states apply, from the 2026 figures each publishes.
		assertEqual([TAXData.GA.MFJ.std, TAXData.GA.SGL.std], [30000, 15000], 'GA std, HB 463 from TY2026');
		assertEqual([TAXData.NE.MFJ.std, TAXData.NE.SGL.std], [17700, 8850], 'NE std, 2026 rate chronology');
		assertEqual([TAXData.SC.MFJ.std, TAXData.SC.SGL.std], [30000, 15000], 'SC SCIAD replaces the federal figure');
		assertEqual([TAXData.NC.MFJ.std, TAXData.NC.SGL.std], [25500, 12750], 'NC std, unchanged and not indexed');
		assertEqual([TAXData.AZ.MFJ.std, TAXData.AZ.SGL.std], ['FEDERAL', 'FEDERAL'],
			'AZ tracks the federal standard deduction rather than restating it');
	});

	// ── TEST CASE 27b: the tables research/STATE_TAX_TABLE_YEARS.md found a year or more behind ────
	// Same rule as 27: the dollar figures are the state's own, printed on its 2026 schedule.
	test('TEST CASE 27b: CA, MD, OR, ME, MA, MI and MS carry their published 2026 figures', () => {
		const tax = (st, status, x) => Math.round(calculateProgressive(st, status, x).total * 100) / 100;
		const rate = (st, status, x) => calculateProgressive(st, status, x).marginal;
		// California, FTB 2026 Schedules X and Y: the "enter on line 31" base at the top of a band.
		assertEqual(tax('CA', 'SGL', 27157), 428.58, 'CA single: 428.58 at 27,157');
		assertEqual(tax('CA', 'SGL', 384109), 32039.70, 'CA single: 32,039.70 at 384,109');
		assertEqual(tax('CA', 'SGL', 768213), 74675.27, 'CA single: 74,675.27 at 768,213');
		assertEqual(tax('CA', 'MFJ', 150394), 6621.76, 'CA joint: 6,621.76 at 150,394');
		assertEqual(tax('CA', 'MFJ', 921854), 79903.90, 'CA joint: 79,903.90 at 921,854');
		// Above $1M the schedule's 12.3% gains the 1% Mental Health Services Act surcharge.
		assertEqual(tax('CA', 'SGL', 1200000), Math.round((74675.27 + 0.123 * (1200000 - 768213) + 0.01 * 200000) * 100) / 100,
			'CA single at 1.2M: the schedule plus 1% of the excess over $1M');
		assertEqual([TAXData.CA.MFJ.std, TAXData.CA.SGL.std], [11800, 5900], 'CA 2026 standard deduction');

		// Maryland, Tax Rate Schedules I and II: the joint schedule is NOT the single one, and every
		// band is a real band (the 6.25% rate was once a band one dollar wide).
		assertEqual(rate('MD', 'MFJ', 140000), 0.0475, 'MD joint: 4.75% runs to 150,000');
		assertEqual(rate('MD', 'MFJ', 200000), 0.0525, 'MD joint: 5.25% from 175,000 to 225,000');
		assertEqual(rate('MD', 'MFJ', 280000), 0.055, 'MD joint: 5.5% from 225,000 to 300,000');
		assertEqual(rate('MD', 'MFJ', 900000), 0.0625, 'MD joint: 6.25% from 600,000 to 1,200,000');
		assertEqual(rate('MD', 'SGL', 700000), 0.0625, 'MD single: 6.25% from 500,000 to 1,000,000');
		assertEqual(rate('MD', 'SGL', 1100000), 0.065, 'MD single: 6.5% above 1,000,000');
		assertEqual([TAXData.MD.MFJ.std, TAXData.MD.SGL.std], [6800, 3400], 'MD 2026 standard deduction');

		// Oregon, withholding formulas 150-206-436 (Rev. 12-31-25), which carry the 2026 schedule.
		assertEqual([rate('OR', 'SGL', 4500), rate('OR', 'SGL', 4600)], [0.0475, 0.0675], 'OR single: 4.75% to 4,550');
		assertEqual(rate('OR', 'SGL', 11000), 0.0675, 'OR single: 6.75% to 11,400');
		assertEqual(rate('OR', 'MFJ', 22000), 0.0675, 'OR joint: 6.75% to 22,800');
		assertEqual([TAXData.OR.MFJ.std, TAXData.OR.SGL.std], [5820, 2910], 'OR 2026 standard deduction');

		// Maine: its own standard deduction plus the 5,300 personal exemption, and the 2% surcharge.
		assertEqual([TAXData.ME.MFJ.std, TAXData.ME.SGL.std], [31400 + 2 * 5300, 15700 + 5300],
			'ME std is Maine\'s own deduction plus one exemption per person');
		assertEqual(rate('ME', 'MFJ', 1600000), 0.0915, 'ME joint: 7.15% + 2% over 1,500,000');
		assertEqual(rate('ME', 'SGL', 900000), 0.0715, 'ME single: no surcharge below 1,000,000');
		assertEqual(TAXData.ME.RETIREMENT_EXCLUSION.cap, 49824, 'ME 2026 pension deduction cap');

		// Massachusetts: 5%, and 9% (5% + the 4% surtax) above 1,107,750 on either filing status.
		for (const status of ['MFJ', 'SGL']) {
			assertEqual(rate('MA', status, 1000000), 0.05, `MA ${status}: 5% below the surtax line`);
			assertEqual(rate('MA', status, 1200000), 0.09, `MA ${status}: 9% above 1,107,750`);
		}

		// Michigan: no standard deduction, a 5,900 personal exemption per person. Mississippi: its own
		// standard deduction plus its personal exemption, never the federal figure.
		assertEqual([TAXData.MI.MFJ.std, TAXData.MI.SGL.std], [2 * 5900, 5900], 'MI exemption counts each spouse');
		assertEqual([TAXData.MS.MFJ.std, TAXData.MS.SGL.std], [4600 + 12000, 2300 + 6000],
			'MS std is its standard deduction plus its personal exemption');
	});

	// ── TEST CASE 28: every state figure names where it came from ──────────────────────────────
	// checkStateSources() is what keeps the tables current: rolling TAXData.FEDERAL.YEAR forward
	// fails every state figure not re-checked for the new year, unless it is marked pending.
	test('TEST CASE 28: every income-tax state sources its brackets and std, none of them stale', () => {
		const live = Object.fromEntries(Object.entries(_engine().TAXData)
			.filter(([k]) => !SYNTHETIC_STATES.includes(k)));
		const { errors, flagged } = _engine().checkStateSources(live);
		assertEqual(errors, [], 'no state figure is unsourced, malformed, or behind the federal year');
		// Not a failure, a to-do list: what is still waiting on a publication or a check.
		if (IS_NODE && flagged.length) console.log(`    not yet published or checked (${flagged.length}):\n      ` + flagged.join('\n      '));
	});

	test('TEST CASE 28b: checkStateSources rejects a missing, stale, or malformed source', () => {
		const fed = { FEDERAL: { YEAR: 2026 } };
		const st = (src, extra = {}) => ({ STATE: 'X', SOURCES: src, MFJ: { std: 1, brackets: [{ l: Infinity, r: 0.05 }] },
			SGL: { std: 1, brackets: [{ l: Infinity, r: 0.05 }] }, ...extra });
		const ok = { year: 2026, status: 'published', doc: 'form' };
		const errs = td => _engine().checkStateSources({ ...fed, ...td }).errors.length;
		assertEqual(errs({ A: st({ brackets: ok, std: ok }) }), 0, 'a fully sourced state passes');
		assertEqual(errs({ A: { ...st(undefined), SOURCES: undefined } }), 1, 'no SOURCES at all');
		assertEqual(errs({ A: st({ brackets: ok }) }), 1, 'std missing');
		assertEqual(errs({ A: st({ brackets: ok, std: { ...ok, year: 2025 } }) }), 1, 'a 2025 figure in a 2026 table');
		assertEqual(errs({ A: st({ brackets: ok, std: { ...ok, year: 2025, status: 'pending' } }) }), 0,
			'unless it is marked pending');
		assertEqual(errs({ A: st({ brackets: ok, std: { ...ok, status: 'guessed' } }) }), 1, 'an unknown status');
		assertEqual(errs({ A: st({ brackets: ok, std: { ...ok, doc: ' ' } }) }), 1, 'a blank doc');
		assertEqual(errs({ A: st({ brackets: ok, std: ok, RETIREMENT_EXCLUSION: ok }) }), 1,
			'a source for a field the state does not have');
		// A state with no income tax carries no figures, so it needs no sources.
		assertEqual(errs({ A: { STATE: 'X', MFJ: { std: 0, brackets: [{ l: Infinity, r: 0 }] },
			SGL: { std: 0, brackets: [{ l: Infinity, r: 0 }] } } }), 0, 'a no-tax state needs none');
	});

	// ── TEST CASE 28c: every bracket table is a well-formed schedule ────────────────────────────
	// Catches the transcription errors a year check cannot: a band one dollar wide, thresholds out of
	// order, a missing terminator, a rate typed as a percent.
	test('TEST CASE 28c: every state bracket table is increasing, ends at Infinity, and has no sliver bands', () => {
		for (const [code, st] of Object.entries(_engine().TAXData)) {
			if (SYNTHETIC_STATES.includes(code) || !st || !st.STATE || !st.MFJ) continue;
			for (const status of ['MFJ', 'SGL']) {
				const brks = st[status].brackets;
				assertEqual(brks[brks.length - 1].l, Infinity, `${code} ${status}: ends at Infinity`);
				brks.forEach((b, i) => {
					if (!(b.r >= 0 && b.r < 0.2)) throw new Error(`${code} ${status}: rate ${b.r} is not a fraction under 0.2`);
					if (i > 0 && isFinite(b.l) && !(b.l - brks[i - 1].l > 100))
						throw new Error(`${code} ${status}: band ending ${b.l} is ${b.l - brks[i - 1].l} wide`);
				});
			}
		}
	});

// ── Runner ───────────────────────────────────────────────────────────────────────────────────
// Returns the counts instead of setting process.exitCode, so the browser can render them.
// ============================================================================
// taxcalc_core.js (the Income Tax Planner's calculation) and taxcalc.js (its command line and local
// server). The core runs here in node and on the planner page, which loads it; on a page that does not
// (the Optimizer's ?runtests tier) these return early, so every environment reports the same count.
// The command-line half and the page-source check are node only.
// ============================================================================
const _core = () => IS_NODE ? require('./taxcalc_core.js') : (typeof window !== 'undefined' ? window.TaxCalc : undefined);
const _link = s => { const p = new URLSearchParams(s); return k => p.get(k); };
const _row = (s, over) => {
	const r = _core().run(_link(s), Object.assign({ header: true }, over));
	const [names, values] = r.csv.split('\n');
	return r.ok ? Object.fromEntries(names.split(',').map((n, i) => [n, values.split(',')[i]])) : r;
};

test('taxcalc_core: a link is read the way the page\'s controls would hold it (sliders snap and stop at their ends, bad keys are errors)', () => {
	const C = _core(); if (!C) return;
	const cfg = s => C.configFromParams(_link(s));
	const y0 = C.BASE_YEAR;
	assertEqual(cfg('yr=2099').cfg.year, y0 + 9, 'year stops at the last slider position');
	assertEqual(cfg('yr=1990').cfg.year, y0, 'and at the first');
	assertEqual(cfg('in=2.7').cfg.inflation, 2.5, 'inflation snaps to half a percent');
	assertEqual(cfg('in=0').cfg.inflation, 0.5, 'and stops at 0.5');
	assertEqual(cfg('cb=150').cfg.cgBasisPct, 100, 'basis percent stops at 100');
	assertEqual(cfg('pm=250000.7').cfg.prevMagi, 250001, 'prior-year MAGI is whole dollars');
	assertEqual(cfg('pm=-5').cfg.prevMagi, null, 'a negative prior-year MAGI is left out');
	assertEqual(cfg('ss=-5&cs=-7').cfg.ssIncome + cfg('ss=-5&cs=-7').cfg.cgSale, 0, 'Social Security and a sale are not negative');
	assertEqual(cfg('wg=80000.6').cfg.wages, 80001, 'an income entry is whole dollars');
	assertEqual(cfg('it=-4').cfg.interest, 0, 'an entry that cannot be negative is not');
	assertEqual(cfg('ot=-4').cfg.other, -4, 'one that can, is');
	assertEqual(cfg('wg=abc&ss=&it=').given.size, 0, 'a value that is not a number, or is blank, is not given');
	assertEqual(cfg('a1=0').cfg.ages[0], 40, 'an age of 0 is the page\'s 40');
	assertEqual(cfg('s=tx').cfg.state, 'TX', 'a state in any case');
	assertEqual(cfg('s=ZZ').errors, ['unknown state ZZ'], 'a state not in the tables is an error, not California');
	assertEqual(cfg('st=JOINT').errors, ['unknown filing status JOINT'], 'so is a filing status');
});

test('taxcalc_core: the default result line keeps its field order, and `all` is the inputs then the calculated fields, each after its marker', () => {
	const C = _core(); if (!C) return;
	// The output contract: other people's sheets read the default line by position. Add at the END, never reorder.
	assertEqual(C.RESULT_DEFAULT, ['ordinary', 'fedIncome', 'grossIncome', 'agi', 'magi', 'fedTax', 'stateTax', 'irmaa',
		'irmaaFuture', 'totalTax', 'effRate', 'fedMarginal', 'stateMarginal'], 'RESULT_DEFAULT');
	assertEqual(C.ALL_NAMES.length, new Set(C.ALL_NAMES).size, 'no field named twice');
	const at = n => C.ALL_NAMES.indexOf(n);
	assertEqual(at('inputs'), 0, 'the inputs marker opens the line');
	assertEqual(at('inputs') < at('st') && at('rw') < at('calculated') && at('calculated') < at('ordinary'), true,
		'inputs first, then the calculated marker, then the results');
	assertEqual(at('irmaaFutureTier') < at('bracketRoom'), true, 'the room fields are appended after the earlier results');
	assertEqual(C.run(_link('s=CA&wg=1000&return=fedTax,nonsense')).csv, 'ERROR: unknown field nonsense', 'a typo is an error, not a column of zeros');
	assertEqual(C.run(_link('s=ZZ')).csv, 'ERROR: unknown state ZZ', 'a bad link is one ERROR line');
});

test('taxcalc_core: a Roth conversion (rc) is ordinary income, the room fills to the edge, and the marker names are blank columns', () => {
	const C = _core(); if (!C) return;
	const base = _row('st=MFJ&s=TX&yr=2026&a1=67&a2=67&wg=60000&ri=40000&ss=40000&return=ordinary,bracketRoom,irmaaRoom,conversionTax');
	assertEqual(base.conversionTax, '0', 'no conversion adds no tax');
	assertEqual(+base.bracketRoom > 0 && +base.irmaaRoom > 0, true, 'there is room in the bracket and under the next IRMAA tier');
	// Converting exactly the room fills the bracket: the income sits on the edge, and the next dollar rises.
	const filled = _row('st=MFJ&s=TX&yr=2026&a1=67&a2=67&wg=60000&ri=40000&ss=40000&rc=' + base.bracketRoom + '&return=ordinary,fedMarginal,conversionTax,bracketRoom');
	assertEqual(+filled.ordinary, +base.ordinary + +base.bracketRoom, 'rc is ordinary income');
	assertEqual(+filled.conversionTax > 0, true, 'the conversion adds income tax');
	assertEqual(+filled.bracketRoom > 0, true, 'at the edge the next bracket up is offered');
	// The IRMAA room stops under the tier: MAGI one dollar past it reaches the tier, at the room it does not.
	const m = _row('st=MFJ&s=TX&yr=2026&a1=67&a2=67&wg=60000&ri=40000&ss=40000&rc=' + base.irmaaRoom + '&return=irmaaFutureTier');
	const over = _row('st=MFJ&s=TX&yr=2026&a1=67&a2=67&wg=60000&ri=40000&ss=40000&rc=' + (+base.irmaaRoom + 1) + '&return=irmaaFutureTier');
	assertEqual(+over.irmaaFutureTier, +m.irmaaFutureTier + 1, 'one dollar past the room reaches the next tier');
	const marked = C.run(_link('st=MFJ&s=TX&rc=10000&return=inputs,st,calculated,ordinary'), { header: true });
	assertEqual(marked.csv, 'inputs,st,calculated,ordinary\n,MFJ,,10000', 'the markers are blank columns carrying their names');
});

test('taxcalc_core: the IRA withdrawal that pays the tax includes the tax on the withdrawal itself, and asking again changes nothing', () => {
	const C = _core(); if (!C) return;
	const L = 'st=MFJ&s=CA&yr=2026&a1=67&a2=67&wg=60000&ri=40000&ss=40000';
	const base = _row(L + '&return=incomeTax,withdrawalForTax');
	const W = +base.withdrawalForTax, T0 = +base.incomeTax;
	assertEqual(W > T0, true, 'it is more than the tax now, because the withdrawal is taxed too');
	// Taking exactly W leaves the tax covered, and by no more than a dollar (W is rounded up to a dollar).
	const at = _row(L + '&rt=' + W + '&return=incomeTax,withdrawalForTax,rt,ordinary');
	assertEqual(+at.incomeTax <= W && W - +at.incomeTax < 1, true, 'W covers the tax with the withdrawal in it, to within a dollar');
	assertEqual(+at.ordinary, +_row(L + '&return=ordinary').ordinary + W, 'rt is ordinary income');
	assertEqual(+at.withdrawalForTax, W, 'asking again with rt set gives the same answer');
	assertEqual(+_row(L + '&rt=' + (W - 2) + '&return=incomeTax').incomeTax > W - 2, true, 'a withdrawal two dollars short does not cover it');
	assertEqual(_row('st=MFJ&s=TX&return=withdrawalForTax').withdrawalForTax, '0', 'no tax needs no withdrawal');
});

test('taxcalc_core: the conversion tax is its own, and the next step names the nearest line and the IRMAA tier it reaches', () => {
	const C = _core(); if (!C) return;
	// cs is tuned so the MAGI that includes the automatic withdrawal lands $1 under the IRMAA tier 1
	// foot. The withdrawal covers the tax, which depends on the senior deduction and on California's
	// table, so this number moves whenever either does.
	const L = 'st=MFJ&s=CA&yr=2026&a1=66&a2=66&ss=29400&cs=98167&cb=0&it=2000&nd=1900&ri=14810&rd=9500&qd=18800&rc=26147';
	const calcFor = q => { const p = new URLSearchParams(q); return C.run(k => p.get(k)).calc; };
	const off = calcFor(L), on = calcFor(L + '&ra=1');
	const alone = calcFor(L.replace('&rc=26147', '&rc=0'));
	const tax = c => { const d = c.resultFor(c.cfg.entOrdinary).d; return d.fedTax + d.fedCGTax + d.niit + d.stTaxOrd + d.stTaxCG; };
	assertEqual(Math.abs(off.conversionTax() - (tax(off) - tax(alone))) < 0.01, true, 'with no withdrawal it is the tax with the conversion less the tax without');
	assertEqual(Math.abs(on.conversionTax() - off.conversionTax()) < 0.01, true, 'and the automatic withdrawal that pays it does not change it');
	const cost = on.conversionCost();
	assertEqual(cost.withdrawal > 0 && Math.abs(cost.own + cost.withdrawal - cost.total) < 0.01, true, 'the tax on the extra withdrawal is shown apart, and the two make the total');
	const step = on.nextConversionStep();
	assertEqual(step.kind, 'bracket', 'the 12% bracket top is nearer than the IRMAA tier above the one it sits at');
	assertEqual(step.irmaaReached.to, 1, 'and getting there reaches IRMAA tier 1');
	assertEqual(step.tax > 0 && step.tax < step.room, true, 'with a tax that is part of the amount');
	assertEqual(on.irmaaRoom().tier, 2, 'sitting right under tier 1, the IRMAA room is the one to tier 2');
});

test('taxcalc_core: the RMD (rd) is ordinary income, and iraTotal adds the RMD, withdrawals, conversion and tax withdrawal', () => {
	const C = _core(); if (!C) return;
	const L = 'st=MFJ&s=TX&yr=2026&a1=75&a2=75&ss=30000';
	const none = _row(L + '&return=ordinary,iraTotal');
	assertEqual(none.iraTotal, '0', 'nothing taken, nothing in the total');
	const r = _row(L + '&rd=20000&ri=5000&rc=10000&rt=3000&return=ordinary,iraTotal,rd');
	assertEqual(r.rd, '20000', 'rd comes back as an input');
	assertEqual(+r.ordinary, 38000, 'all four are ordinary income');
	assertEqual(+r.iraTotal, 38000, 'and the total is their sum');
	assertEqual(+_row('st=MFJ&s=IL&ss=30000&rd=20000&return=totalTax').totalTax < +_row('st=MFJ&s=IL&ss=30000&ot=20000&return=totalTax').totalTax, true, 'an RMD is retirement income for a state that exempts it, other income is not');
});

test('taxcalc_core: with ra=1 the IRA withdrawal follows the tax, so the order of a conversion and the withdrawal does not matter', () => {
	const C = _core(); if (!C) return;
	const L = 'st=MFJ&s=CA&yr=2026&a1=67&a2=67&wg=60000&ri=40000&ss=40000';
	const off = _row(L + '&return=ordinary,withdrawalForTax,irmaaRoom,bracketRoom,ra');
	assertEqual(off.ra, '0', 'it is off unless the link turns it on');
	const on = _row(L + '&ra=1&rt=5&return=ordinary,rt,incomeTax,withdrawalForTax,ra');
	assertEqual(on.ra, '1', 'ra=1 turns it on');
	assertEqual(on.rt, off.withdrawalForTax, 'the withdrawal is the one that covers the tax, whatever rt the link carried');
	assertEqual(+on.ordinary, +off.ordinary + +off.withdrawalForTax, 'and it is in the ordinary income');
	// A conversion changes the tax, and the withdrawal follows it.
	const conv = _row(L + '&ra=1&rc=20000&return=rt,incomeTax,withdrawalForTax');
	assertEqual(+conv.rt > +on.rt && +conv.rt === +conv.withdrawalForTax, true, 'a conversion raises the withdrawal, and it stays the amount that covers the tax');
	assertEqual(+conv.incomeTax <= +conv.rt && +conv.rt - +conv.incomeTax < 1, true, 'covering it to within a dollar');
	// The room counts the withdrawal: converting the room leaves MAGI under the next IRMAA tier,
	// withdrawal included, and one dollar more reaches it.
	const room = _row(L + '&ra=1&return=irmaaRoom,irmaaFutureTier');
	assertEqual(+room.irmaaRoom > 0, true, 'there is room');
	assertEqual(+room.irmaaRoom < +off.irmaaRoom, true, 'less than without the withdrawal, which uses some of it');
	const at = _row(L + '&ra=1&rc=' + room.irmaaRoom + '&return=irmaaFutureTier');
	const over = _row(L + '&ra=1&rc=' + (+room.irmaaRoom + 1) + '&return=irmaaFutureTier');
	assertEqual(+over.irmaaFutureTier, +room.irmaaFutureTier + 1, 'one dollar past the room reaches the next tier');
	assertEqual(+at.irmaaFutureTier, +room.irmaaFutureTier, 'and the room itself does not');
	assertEqual(_row('st=MFJ&s=TX&ra=1&return=rt').rt, '0', 'no tax needs no withdrawal');
});

test('taxcalc_core: interest, non-qualified dividends and a short-term gain are investment income for NIIT, and nothing else moves', () => {
	const C = _core(); if (!C) return;
	// The 2026 tax-plan case: MAGI 392,444, so NIIT is 3.8% of the whole investment income:
	// 5,075 interest + 2,500 non-qualified + 7,950 qualified + 405 short-term + 100,220 long-term.
	const base = 'st=MFJ&s=CA&a1=66&a2=74&yr=2026&ss=29858&nd=2500&qd=7950&sg=405&cs=100220&cb=0&rd=9126&rc=240000';
	const f = 'return=agi,taxableSS,fedOrdinaryTax,fedCgTax,niit,stateTax';
	const asInterest = _row(base + '&ot=1789&it=5075&' + f), asOther = _row(base + '&ot=6864&' + f);
	assertEqual(Math.abs(+asInterest.niit - 0.038 * 116150) < 0.5, true, `NIIT counts every kind of investment income, got ${asInterest.niit}`);
	// The same dollars entered as other income are not investment income, and are taxed identically.
	for (const k of ['agi', 'taxableSS', 'fedOrdinaryTax', 'fedCgTax', 'stateTax'])
		assertEqual(asInterest[k], asOther[k], `${k} is the same whether the 5,075 is interest or other income`);
	assertEqual(+asInterest.niit - +asOther.niit > 190, true, 'only NIIT differs, by 3.8% of the interest');
	// A short-term loss never reduces investment income.
	const loss = _row('st=MFJ&s=TX&yr=2026&wg=400000&it=10000&sg=-3000&return=niit');
	assertEqual(Math.abs(+loss.niit - 0.038 * 10000) < 0.5, true, 'a capped short-term loss leaves NIIT on the full interest');
});

test('taxcalc_core: the pieces add up (fed + state + IRMAA = total; gross - total = net), and `pi` pins the ordinary income', () => {
	const C = _core(); if (!C) return;
	const r = _row('st=SGL&s=CA&wg=90000&it=3000&qd=2000&ss=20000&cs=50000&cb=40&pm=500000&return=all');
	assertEqual(Math.abs(+r.fedTax + +r.stateTax + +r.irmaa - +r.totalTax) < 0.02, true, 'tax parts sum to the total');
	assertEqual(Math.abs(+r.grossIncome - +r.totalTax - +r.netIncome) < 0.02, true, 'net income is gross less tax');
	assertEqual(+r.irmaa > 0 && +r.irmaaTier > 0, true, 'a prior-year MAGI over the first threshold is charged IRMAA');
	assertEqual(_row('st=SGL&s=CA&wg=90000&return=irmaa').irmaa, '0', 'and none is charged when none is entered');
	const pinned = _row('st=MFJ&s=IL&ri=40000&ot=5&pi=90000&return=ordinary,wg,ri,ot');
	assertEqual(pinned.ordinary, '90000', 'pi sets the ordinary income');
	assertEqual(pinned.ri, '40000', 'without touching the entries it did not name');
	assertEqual(pinned.ot, '50000', 'it is made up in Other ordinary income');
	assertEqual(+_row('st=MFJ&s=CA&yr=2030&in=3&wg=200000&return=totalTax').totalTax > 0, true, 'a later year with inflation calculates');
});

test('taxcalc.js: vary gives one line per value in order, equal to the same request made alone; header is printed once', () => {
	if (!IS_NODE) return;
	const T = require('./taxcalc.js');
	const one = wg => T.answer(new URLSearchParams(`st=SGL&s=CA&ss=24000&wg=${wg}&return=totalTax,fedTax`)).text;
	const r = T.answer(new URLSearchParams('st=SGL&s=CA&ss=24000&vary=wg:40000,60000,80000&return=totalTax,fedTax&header=1'));
	assertEqual(r.ok, true, 'ok');
	assertEqual(r.text.split('\n'), ['totalTax,fedTax', one(40000), one(60000), one(80000)], 'header, then a line per value');
	assertEqual(T.answer(new URLSearchParams('s=CA&vary=wg')).ok, false, 'vary needs key:values');
	assertEqual(T.answer(new URLSearchParams('s=CA&vary=wg:1,,2')).ok, false, 'and no empty value');
	assertEqual(T.answer(new URLSearchParams('s=ZZ&vary=wg:1,2')).text, 'ERROR: unknown state ZZ', 'one bad request is one ERROR line');
});

test('taxcalc.js: the format version is refused when it is not the one the tool writes', () => {
	if (!IS_NODE) return;
	const T = require('./taxcalc.js');
	assertEqual(T.answer(new URLSearchParams(`s=CA&wg=1&v=${T.FORMAT_VERSION}`)).ok, true, 'the current version');
	assertEqual(T.answer(new URLSearchParams('s=CA&wg=1&v=99')).text.startsWith('ERROR: this tool writes format version'), true, 'another');
});

test('taxcalc.js --csv: quoted cells, blank cells, extra columns, and the row an error is on', () => {
	if (!IS_NODE) return;
	const T = require('./taxcalc.js');
	assertEqual(T.parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n3,\r\n'), [['a', 'b'], ['x, y', 'say "hi"'], ['3', '']], 'RFC 4180 as a spreadsheet writes it');
	const text = 'label,st,s,wg,ss\n"2026 plan",SGL,CA,60000,24000\n2027,SGL,CA,60000,\n';
	const out = T.answerCsv(text, new URLSearchParams('return=totalTax&header=1'));
	assertEqual(out.text.split('\n').length, 3, 'a header and a row per scenario');
	assertEqual(out.text.split('\n')[1], T.answer(new URLSearchParams('st=SGL&s=CA&wg=60000&ss=24000&return=totalTax')).text, 'a row equals the same request alone');
	assertEqual(out.text.split('\n')[2], T.answer(new URLSearchParams('st=SGL&s=CA&wg=60000&return=totalTax')).text, 'a blank cell is absent, not zero');
	assertEqual(T.answerCsv('s,wg\nCA,1\nZZ,1\n', new URLSearchParams('')).text, 'ERROR: row 3: unknown state ZZ', 'the row is named');
});

test('taxcalc.js server: OPTIONS and HEAD are answered without calculating, GET carries the result, other methods are refused', () => {
	if (!IS_NODE) return;
	const T = require('./taxcalc.js');
	const handler = T.makeServer().listeners('request')[0];
	const call = (method, url) => {
		const got = { status: null, body: '' };
		handler({ method, url }, { writeHead: (s) => { got.status = s; }, end: (b) => { got.body = b || ''; } });
		return got;
	};
	assertEqual(call('OPTIONS', '/').status, 204, 'OPTIONS');
	assertEqual(call('HEAD', '/?s=ZZ').body, '', 'HEAD has no body');
	assertEqual(call('POST', '/').status, 405, 'POST');
	const g = call('GET', '/?st=SGL&s=CA&wg=60000&ss=24000&return=totalTax');
	assertEqual([g.status, g.body], [200, T.answer(new URLSearchParams('st=SGL&s=CA&wg=60000&ss=24000&return=totalTax')).text], 'GET');
	assertEqual(g.body.split(',').length === 1 && Number.isFinite(+g.body) && +g.body > 0, true, 'a bare number a cell can wrap in VALUE()');
	assertEqual(call('GET', '/?s=ZZ').body, 'ERROR: unknown state ZZ', 'an error is a 200 with an ERROR line, which Calc shows instead of #VALUE!');
});

test('IncomeTaxPlanner.html reads its link and calculates through taxcalc_core.js, with no second copy of either', () => {
	if (!IS_NODE) return;
	const html = require('fs').readFileSync(require('path').join(__dirname, 'standalone', 'IncomeTaxPlanner.html'), 'utf8');
	assertEqual(html.includes('<script src="../taxcalc_core.js'), true, 'the page loads the shared file');
	assertEqual(html.includes('TaxCalc.configFromParams('), true, 'loadFromURL reads the link with it');
	assertEqual(/function (calcAt|deriveRow|deriveIncome|resultFor)\(/.test(html), false, 'and does not define its own calculation');
});

function runTaxEngineTests() {
	passed = 0;
	failed = 0;
	const failures = [];
	installTestState();
	installBracketFixture();
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
