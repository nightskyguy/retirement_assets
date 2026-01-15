
// ===== UNIT TESTS =====
function runTests() {
    console.log('========================================');
    console.log('   RUNNING UNIT TESTS');
    console.log('========================================\n');
    
    let passed = 0;
    let failed = 0;
	
	/**
	 * Converts all numeric values in an object/array to fixed decimal places
	 * @param {*} obj - The object, array, or primitive to process
	 * @param {number} decimals - Number of decimal places (default: 3)
	 * @returns {*} New object/array/value with numbers rounded
	 */
	function fixDecimals(obj, decimals = 3) {
		// Handle null and undefined
		if (obj == null) {
			return obj;
		}
		
		// Handle numbers
		if (typeof obj === 'number') {
			if (isNaN(obj)) return NaN;
			if (!isFinite(obj)) return obj; // Keep Infinity and -Infinity as-is
			return parseFloat(obj.toFixed(decimals));
		}
		
		// Handle arrays
		if (Array.isArray(obj)) {
			return obj.map(item => fixDecimals(item, decimals));
		}
		
		// Handle objects  (Do not need recursion here...)
		if (typeof obj === 'object') {
			const result = {};
			for (const [key, value] of Object.entries(obj)) {
				result[key] = fixDecimals(value, decimals);
			}
			return result;
		}
		
		// Handle primitives (strings, booleans, etc.)
		return obj;
	}	
    
    // Helper function to assert equality
    function assertEqual(actual, expected, testName) {
		const error = new Error();
		const stack = error.stack.split('\n');
		const callerLine = stack[2]; // The line that called this function
		const fixed_actual = fixDecimals(actual)
		
		const pretty = obj => JSON.stringify(obj, null, 2);
		const fixed_expected = fixDecimals(expected)

        if (JSON.stringify(fixed_actual) === JSON.stringify(fixed_expected) || 
			JSON.stringify(actual) === JSON.stringify(expected)) {
            console.log(`✅ PASS: ${testName}`);
            passed++;
        } else {
            console.log(`❌ FAIL @ ${callerLine.split('/').pop()}:  ${testName} `);
            console.log(`   Expected:`, pretty(fixed_expected));
            console.log(`   Got:`, pretty(fixed_actual));
            failed++;
        }
    }
	
	
	// NEW FUNCTIONS

// Boundary conditions
assertEqual(
    calculateWithdrawals(
        { },
        1000,
        { taxrate: [0.10, 0.20] }
    ),
    {
  "totalTax": 0,
  "netAmount": 0,
  "shortfall": 0,
  "errors": [
    "balances is null or empty",
    "withdrawal.order is null or empty"
  ]
    },
    'Test: Pass wrong/null/empty values.'
);


//  Test with balances as weight.
assertEqual(
    calculateWithdrawals(
        { IRA: 2000, Brokerage: 1000, BrokerageBasis: 360, Cash: 5000, Roth: 5000 },
        1000,
        { order: ['Brokerage', 'IRA'], weight: [1000, 2000], taxrate: [0.10, 0.20] }
    ),
    {
  "totalTax": 203.704,
  "netAmount": 1000,
  "shortfall": 0,
  "Brokerage": 370.37,
  "BrokerageTax": 37.037,
  "BrokerageBasis": 133.333,
  "IRA": 833.333,
  "IRATax": 166.667
    },
    'Test: Use balances as weight.'
);

//  Test with with NO weights.
assertEqual(
    calculateWithdrawals(
        { IRA: 2000, Brokerage: 1000, BrokerageBasis: 360, Cash: 5000, Roth: 5000 },
        1000,
        { order: ['Brokerage', 'IRA'], taxrate: [0.10, 0.20] }
    ),
    {
  "totalTax": 203.704,
  "netAmount": 1000,
  "shortfall": 0,
  "Brokerage": 370.37,
  "BrokerageTax": 37.037,
  "BrokerageBasis": 133.333,
  "IRA": 833.333,
  "IRATax": 166.667
    },
    'Test: Weights are missing no shortfall.'
);


//  Test with with NO weights, and a shortfall - should not touch Roth or Cash.
assertEqual(
    calculateWithdrawals(
        { IRA: 2000, Brokerage: 1000, BrokerageBasis: 360, Cash: 5000, Roth: 5000 },
        5000,
        { order: ['Brokerage', 'IRA'], taxrate: [0.10, 0.20] }
    ),
    {
  "totalTax": 500,
  "netAmount": 2500,
  "shortfall": 2500,
  "Brokerage": 1000,
  "BrokerageTax": 100,
  "BrokerageBasis": 360,
  "IRA": 2000,
  "IRATax": 400
    },
    'Test: Weights are missing, with shortfall, no change to Roth or Cash.'
);


//  Test with with NO weights, and a shortfall - should not touch Roth.
assertEqual(
    calculateWithdrawals(
        { IRA: 2000, Brokerage: 1000, BrokerageBasis: 360, Cash: 5000, Roth: 5000 },
        5000,
        { order: ['Brokerage', 'IRA', 'Cash'], taxrate: [0.10, 0.20] }
    ),
    {
  "totalTax": 500,
  "netAmount": 5000,
  "shortfall": 0,
  "Brokerage": 1000,
  "BrokerageTax": 100,
  "BrokerageBasis": 360,
  "IRA": 2000,
  "IRATax": 400,
  "Cash": 2500,
  "CashTax": 0
    },
    'Test: Weights are missing, with shortfall filled by IRA, no change to Roth.'
);


// Test: Your example - 50/50 split with different tax rates

assertEqual(
    calculateWithdrawals(
        { IRA: 1000, Brokerage: 600, BrokerageBasis: 360, Cash: 5000, Roth: 5000 },
        1000,
        { order: ['Brokerage', 'IRA', 'Cash', 'Roth'], weight: [50, 50, 0, 0], taxrate: [0.15, 0.25, 0, 0] }
    ),
    {
  "totalTax": 254.902,
  "netAmount": 1000,
  "shortfall": 0,
  "Brokerage": 588.235,
  "BrokerageTax": 88.235,
  "BrokerageBasis": 352.941,
  "IRA": 666.667,
  "IRATax": 166.667
    },
    'Test: 50/50 split with tax rates 0.15 and 0.25'
);

// Test: Scenario A - Normal operation with no taxes
assertEqual(
    calculateWithdrawals(
        { IRA: 100000, Brokerage: 50000, BrokerageBasis: 30000, Cash: 10000, Roth: 25000 },
        1000,
        { order: ['Cash', 'Brokerage', 'IRA', 'Roth'], weight: [50, 50, 0, 0], taxrate: [0, 0, 0, 0] }
    ),
    {
  "totalTax": 0,
  "netAmount": 1000,
  "shortfall": 0,
  "Cash": 500,
  "CashTax": 0,
  "Brokerage": 500,
  "BrokerageTax": 0,
  "BrokerageBasis": 300
    },
    'Test: Normal 50/50 split with no taxes'
);

// Test: High tax rate causing insufficient gross funds and a shorfall.
assertEqual(
    calculateWithdrawals(
        { IRA: 1000, Brokerage: 1000, BrokerageBasis: 200, Cash: 1000, Roth: 1000 },
        4000,
        { order: ['Brokerage', 'IRA', 'Cash', 'Roth'], weight: [50, 50, 0, 0], taxrate: [0.50, 0.5, 0, 0] }
    ),
    {
  "totalTax": 1000,
  "netAmount": 3000,
  "shortfall": 1000,
  "Brokerage": 1000,
  "BrokerageTax": 500,
  "BrokerageBasis": 200,
  "IRA": 1000,
  "IRATax": 500,
  "Cash": 1000,
  "CashTax": 0,
  "Roth": 1000,
  "RothTax": 0
    },
    'Test calculateWithdrawals: High tax rates causing shortfall'
);

// Test: Account depletion with fallback and taxes
assertEqual(
    calculateWithdrawals(
        { Cash: 1000, Brokerage: 1000, BrokerageBasis: 200, IRA: 10000, Roth: 5000 },
        4000,
        { order: ['Cash', 'Brokerage', 'IRA', 'Roth'], weight: [50, 50, 0, 0], taxrate: [0, 0.10, 0.25, 0] }
    ),
    {
  "totalTax": 800,
  "netAmount": 4000,
  "shortfall": 0,
  "Cash": 1000,
  "CashTax": 0,
  "Brokerage": 1000,
  "BrokerageTax": 100,
  "BrokerageBasis": 200,
  "IRA": 2800,
  "IRATax": 700
    },
    'Test: Weighted accounts depleted, fallback to IRA with 25% tax'
);

// Test: All Roth (tax-free)
assertEqual(
    calculateWithdrawals(
        { IRA: 100000, Brokerage: 50000, BrokerageBasis: 30000, Cash: 10000, Roth: 25000 },
        5000,
        { order: ['Roth', 'Cash', 'Brokerage', 'IRA'], weight: [100, 0, 0, 0], taxrate: [0, 0, 0.15, 0.25] }
    ),
    {
  "totalTax": 0,
  "netAmount": 5000,
  "shortfall": 0,
  "Roth": 5000,
  "RothTax": 0
    },
    'Test: 100% from Roth (tax-free)'
);

assertEqual(
    calculateWithdrawals(
        { IRA: 100000, Brokerage: 3000, BrokerageBasis: 1800, Cash: 3000, Roth: 25000 },
        8000,
        { order: ['Cash', 'Brokerage', 'IRA', 'Roth'], weight: [50, 50, 0, 0], taxrate: [0, 0.20, 0.30, 0] }
    ),
    {
  "totalTax": 1714.286,
  "netAmount": 8000,
  "shortfall": 0,
  "Cash": 3000,
  "CashTax": 0,
  "Brokerage": 3000,
  "BrokerageTax": 600,
  "BrokerageBasis": 1800,
  "IRA": 3714.286,
  "IRATax": 1114.286  
    },
    'Test: Mixed tax rates with depletion and fallback to IRA'
);

// Test: Zero gap amount
assertEqual(
    calculateWithdrawals(
        { IRA: 100000, Brokerage: 50000, BrokerageBasis: 30000, Cash: 10000, Roth: 25000 },
        0,
        { order: ['Cash', 'Brokerage', 'IRA', 'Roth'], weight: [50, 50, 0, 0], taxrate: [0, 0.15, 0.25, 0] }
    ),
    {
  "totalTax": 0,
  "netAmount": 0,
  "shortfall": 0,
  "errors": [
    "gapAmount is null or <= 0"
  ]
    },
    'Test: Zero gap amount'
);

// Test: All accounts empty with taxes
assertEqual(
    calculateWithdrawals(
        { IRA: 0, Brokerage: 0, BrokerageBasis: 0, Cash: 0, Roth: 0 },
        5000,
        { order: ['Cash', 'Brokerage', 'IRA', 'Roth'], weight: [50, 50, 0, 0], taxrate: [0, 0.15, 0.25, 0] }
    ),
    {
  "totalTax": 0,
  "netAmount": 0,
  "shortfall": 5000,
  "Cash": 0,
  "Brokerage": 0,
  "IRA": 0,
  "Roth": 0
    },
    'Test: All accounts empty'
);

// Test: Different order with taxes
assertEqual(
    calculateWithdrawals(
        { IRA: 10000, Brokerage: 10000, BrokerageBasis: 6000, Cash: 10000, Roth: 10000 },
        12000,
        { order: ['Roth', 'IRA', 'Brokerage', 'Cash'], weight: [40, 40, 20, 0], taxrate: [0, 0.25, 0.15, 0] }
    ),
    {
  "totalTax": 2023.529,
  "netAmount": 12000,
  "shortfall": 0,
  "Roth": 4800,
  "RothTax": 0,
  "IRA": 6400,
  "IRATax": 1600,
  "Brokerage": 2823.529,
  "BrokerageTax": 423.529,
  "BrokerageBasis": 1694.118
    },
    'Test: Different order - Roth and IRA prioritized with taxes'
);

	// These use TEST data and should NOT need to be changed.
    assertEqual(findLimitByRate('TEST', 'MFJ', 0.2, 1), {limit: 2000, rate: 0.2}, 
                'findLimitByRate: TEST MFJ 20% rate correct');
    
    assertEqual(findLimitByRate('TEST', 'SGL', 0.2, 3), {limit: 3000, rate: 0.2}, 
                'findLimitByRate: TEST SGL 20% rate w/ 300% inflation');	

    assertEqual(findLimitByRate('TEST', 'SGL', 0.9, 1), {limit: 20000, rate: 0.8}, 
                'findLimitByRate: TEST SGL 90% - finds lower rate: 80%');	
    
    assertEqual(findLimitByRate('TEST', 'SGL', 0.05, 1), {limit: 0, rate: 0}, 
                'findLimitByRate: TEST SGL 5% finds no limit or rate (0)');	

    assertEqual(findUpperLimitByAmount('TEST', 'SGL', 998, 1), {limit: 999, rate: 0.1}, 
                'findUpperLimitByAmount: TEST SGL 998 finds limit: 999, rate: 0.1');
				
	assertEqual(getInputs(), 
{
  "STATEname": "CA",
  "strategy": "baseline",
  "nYears": 10,
  "stratRate": 0.24,
  "birthyear1": 1960,
  "die1": 88,
  "birthyear2": 1952,
  "die2": 98,
  "ira1": 2000000,
  "ira2": 400000,
  "roth": 200000,
  "brokerage": 400000,
  "basis": 200000,
  "cash": 100000,
  "ss1": 48000,
  "ss1Age": 70,
  "ss2": 24000,
  "ss2Age": 70,
  "pensionAnnual": 15000,
  "survivorPct": 75,
  "spendGoal": 180000,
  "spendChange": 0.99,
  "iraBaseGoal": 350000,
  "inflation": 0,
  "cpi": 0,
  "growth": 0.06,
  "cashYield": 0.03,
  "dividendRate": 0.005,
  "ssFailYear": 2033,
  "ssFailPct": 0.773,
  "startInYear": null
},
		'getInputs()')
		

// Example: $1M IRA, want to get down to $200K over 10 years, 6% growth
	assertEqual(calculateAmortizedWithdrawal(1000000, 200000, 10, 0.06), 108694.367,
		'calculateAmortizedWithdrawal(1000000, 200000, 10, 0.06) = 108694.367');

// calculateBrokerageWithdrawalForNet REMOVED.
				
	// 😭😭😭 NOTE NOTE NOTE: All of the following tests are sensitive to the real TAXData. 😭😭😭

    assertEqual(findLimitByRate('FEDERAL', 'MFJ', 0.24, 1), {limit: 403550, rate: 0.24}, 
                '😭findLimitByRate: FEDERAL MFJ 24% bracket');
	
    assertEqual(findLimitByRate('CA', 'SGL', 0.06, 1), { limit: 54081, rate: 0.06 }, 
                '😭findLimitByRate: State SGL 6% bracket');

		
	assertEqual(calculateProgressive('SOCIALSECURITY', 'MFJ', 55000).marginal, 
		0.85,
		'😭calculateProgressive(SOCIALSECURITY, MFJ, 55000) CHANGES with SOCIALSECURITY data.')

	// RMD Percentages.  First should be 0, second should match.
    // RMD percentage lookup
    if (typeof getRMDPercentage !== 'undefined') {
        let rmd73 = getRMDPercentage(73, 1952);
        assertEqual(rmd73 > 0.037 && rmd73 < 0.038, true,
                    'RMD: Age 73 should be ~3.77% (divisor 26.5)');
    }

	assertEqual(getRMDPercentage(74, 1960), 0,
			'getRMDPercentage for age 74, birth year 1960 correct (0)');	

	assertEqual(getRMDPercentage(74, 1950), 0.0392156862745098,
			'getRMDPercentage for age 76, birth year 1950 correct (4.2%)');

	assertEqual(calcIRMAA(100, 'SGL', 1), 0,
				'😭calcIRMAA  0 for SGL at 100 income');

	assertEqual(calcIRMAA(109001, 'SGL', 1), 12 * 202.9,
				'😭calcIRMAA  202.9 for 109001 SGL income');

	assertEqual(calcIRMAA(273999, 'MFJ', 1), (12 * 2 * 202.90),
				'😭calcIRMAA  (2 * 202.90) for 273999 MFJ income');    

	assertEqual(calcIRMAA(274000, 'MFJ', 1), 12 * 2 * (284.10 + 14.50),
				'😭calcIRMAA  2 * (284.10 + 14.50) for 274000 MFJ income');

	assertEqual(calculateProgressive('TEST','MFJ',72000), 
		{cumulative: 30700, total: 30700, marginal: 0.8, limit: 40000}, 
		'calculateProgressive(TEST, MFJ, 72000) ok')	

	assertEqual(calculateProgressive('TEST','SGL',72000), 
		{cumulative: 15350, total: 15350, marginal: 0.8, limit: 20000}, 
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
		
	assertEqual(Math.round(calculateInflationAdjustedWithdrawal(1000000, 0.07, 0.03, 30),0), 57830,
		'calculateInflationAdjustedWithdrawal(1000000, 0.07, 0.03, 30) (growth > inflation)')

	assertEqual(Math.round(calculateInflationAdjustedWithdrawal(1000000, 0.03, 0.03, 30),0), 33333,
		'calculateInflationAdjustedWithdrawal(1000000, 0.03, 0.03, 30) (growth=inflation)')

	assertEqual(Math.round(calculateInflationAdjustedWithdrawal(1000000, 0.03, -0.03, 30),0), 72649,
		'calculateInflationAdjustedWithdrawal(1000000, 0.03, -0.03, 30) (Deflation)')	

	assertEqual(Math.round(calculateInflationAdjustedWithdrawal(1000000, -0.03, 0.00, 30),0), 20084,
		'calculateInflationAdjustedWithdrawal(1000000, -0.03, 0.00, 30) (growth is negative)')

	assertEqual(Math.round(calculateInflationAdjustedWithdrawal(-1000, -0.03, 0.00, 30),0), 0,
		'calculateInflationAdjustedWithdrawal(-1000, 0.07, 0.03, 30) (principal < 0)')		

/*
    assertEqual(findRequiredWithdrawals(150000, { yearOffset: 0, filingStatus: 'MFJ', ages: [65, 63], ss1: 30000, ss2: 20000,
					ordDivInterest: 5000, qualifiedDiv: 3000, taxExemptInterest: 0, 
					pensionIncome: 0, hsaContrib: 0, cpi: 0.03 },
					500000,  // $500k brokerage balance
					250000   // $250k cost basis (50% gains)
				),   
			{},
			'findRequiredWithdrawals(complicated arguments)!')
*/	
	
    console.log('\n========================================');
    console.log(`   RESULTS: ${passed} passed, ${failed} failed`);
	console.log(`   chart.js version ${Chart.version}`);
    console.log('========================================');
	
    const statusElement = document.getElementById('testsFailed');
    if (failed === 0) {
        statusElement.textContent = '🟢';
		statusElement.title = `All ${failed+passed} tests passed`;
    } else {
        statusElement.textContent = '❌ tests failed';
		statusElement.title = `${failed} test${failed !== 1 ? 's' : ''} failed out of ${failed+passed}.`;
    }
    return failed === 0;
}

