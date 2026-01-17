
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
	
    // Test 1: Single account with positive growth
	let startSituation = { Cash: 100 };
    assertEqual(
        applyGrowth(startSituation, { IRA: 0.04, Brokerage: -0.01, Cash: 0.035 } ),
        { Cash: 3.5 },
        'applyGrowth: Single account with 3.5% growth'
    );
	assertEqual( startSituation, { Cash: 103.5 },
		'applyGrowth: Single account with 3.5% growth (realized)'
    );	
    
    // Test 2: Multiple accounts with mixed growth
	startSituation = { Cash: 100, Brokerage: 100 };
    assertEqual(
        applyGrowth( startSituation, { IRA: 0.04, Brokerage: -0.01, Cash: 0.035 } ),
        { Cash: 3.5, Brokerage: -1 },
        'applyGrowth: Multiple accounts with positive and negative growth'
    );
    
    // Test 3: All accounts with positive growth
    assertEqual(
        applyGrowth(
            { IRA: 1000000, Roth: 500000, Brokerage: 200000, Cash: 50000 },
            { IRA: 0.07, Roth: 0.07, Brokerage: 0.05, Cash: 0.04 }
        ),
        {   "IRA": 70000,
  "Roth": 35000,
  "Brokerage": 10000,
  "Cash": 2000 },
        'applyGrowth: All accounts with positive growth rates'
    );
    
    // Test 4: Negative growth (market downturn)
	startSituation = { IRA: 1000000, Cash: 50000 };
    assertEqual(
        applyGrowth( startSituation, { IRA: -0.20, Cash: 0.02 } ),
        { "IRA": -200000, "Cash": 1000 },
        'applyGrowth: Negative growth rate (20% loss)'
    );	
	assertEqual( startSituation, {"IRA": 800000, "Cash": 51000}, 
		'applyGrowth: Negative growth rate (20% loss) realized');
	
	
    // Test 1: Basic withdrawal from IRA
    assertEqual(
        applyWithdrawals(
            { Brokerage: 0, BrokerageBasis: 0, Cash: 0, IRA: 2000000, Roth: 0 },
            { IRA: 116250, IRATax: 23250, netAmount: 93000, shortfall: 0, totalTax: 23250 }
        ),
        { Brokerage: 0, BrokerageBasis: 0, Cash: 0, IRA: 1883750, Roth: 0 },
        'applyWithdrawals: Basic IRA withdrawal'
    );
    
    // Test 2: Multiple account withdrawals
    assertEqual(
        applyWithdrawals(
            { Brokerage: 50000, Cash: 10000, IRA: 500000, Roth: 100000 },
            { Brokerage: 5000, IRA: 50000, Roth: 10000 }
        ),
        { Brokerage: 45000, Cash: 10000, IRA: 450000, Roth: 90000 },
        'applyWithdrawals: Multiple account withdrawals'
    );
    
    // Test 3: Withdrawal exceeds balance (should floor at 0)
    assertEqual(
        applyWithdrawals(
            { IRA: 10000, Roth: 5000 },
            { IRA: 15000, Roth: 6000 }
        ),
        { IRA: 0, Roth: 0 },
        'applyWithdrawals: Withdrawal exceeds balance - floor at zero'
    );
    
    // Test 4: Withdrawal keys don't match balance keys (should be ignored)
    assertEqual(
        applyWithdrawals(
            { IRA: 100000, Roth: 50000 },
            { Brokerage: 10000, Cash: 5000, totalTax: 1000 }
        ),
        { IRA: 100000, Roth: 50000 },
        'applyWithdrawals: Non-matching withdrawal keys ignored'
    );
    
    // Test 5: Empty withdrawals object
    assertEqual(
        applyWithdrawals(
            { IRA: 100000, Roth: 50000 },
            {}
        ),
        { IRA: 100000, Roth: 50000 },
        'applyWithdrawals: Empty withdrawals object - no change'
    );
    
    // Test 6: Zero withdrawals
    assertEqual(
        applyWithdrawals(
            { IRA: 100000, Roth: 50000 },
            { IRA: 0, Roth: 0 }
        ),
        { IRA: 100000, Roth: 50000 },
        'applyWithdrawals: Zero withdrawals - no change'
    );
    
    // Test 7: Mix of matching and non-matching keys
    assertEqual(
        applyWithdrawals(
            { Brokerage: 100000, IRA: 200000, Roth: 50000 },
            { IRA: 25000, Cash: 10000, netAmount: 15000, Roth: 5000 }
        ),
        { Brokerage: 100000, IRA: 175000, Roth: 45000 },
        'applyWithdrawals: Mix of matching and non-matching keys'
    );
    
    // Test 8: Exact withdrawal (balance becomes zero)
    assertEqual(
        applyWithdrawals(
            { IRA: 50000, Roth: 25000 },
            { IRA: 50000, Roth: 25000 }
        ),
        { IRA: 0, Roth: 0 },
        'applyWithdrawals: Exact withdrawal - balance to zero'
    );
    
    // Test 9: All accounts with various withdrawal scenarios
    assertEqual(
        applyWithdrawals(
            { Brokerage: 100000, BrokerageBasis: 60000, Cash: 50000, IRA: 500000, Roth: 200000 },
            { Brokerage: 10000, BrokerageBasis: 6000, Cash: 100000, IRA: 50000, taxAmount: 15000 }
        ),
        { Brokerage: 90000, BrokerageBasis: 54000, Cash: 0, IRA: 450000, Roth: 200000 },
        'applyWithdrawals: Complex scenario with all account types'
    );
    
    // Test 10: Negative withdrawal (shouldn't happen, but test behavior)
    assertEqual(
        applyWithdrawals(
            { IRA: 100000 },
            { IRA: -10000 }
        ),
        { IRA: 110000 },
        'applyWithdrawals: Negative withdrawal adds to balance (edge case)'
    );

	

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
    'calculateWithdrawals: Pass wrong/null/empty values.'
);


//  Test with balances as weight.
assertEqual(
    calculateWithdrawals(
        { IRA: 2000, Brokerage: 1000, BrokerageBasis: 360, Cash: 5000, Roth: 5000 },
        1000,
        { order: ['Brokerage', 'IRA'], weight: [1000, 2000], taxrate: [0.10, 0.20] }
    ),
    {
  "totalTax": 189.459,
  "netAmount": 1000,
  "shortfall": 0,
  "BrokerageBasis": 128.205,
  "Brokerage": 356.125,
  "BrokerageTax": 22.792,
  "IRA": 833.333,
  "IRATax": 166.667
    },
    'calculateWithdrawals: Use balances as weight.'
);

//  Test with with NO weights.
assertEqual(
    calculateWithdrawals(
        { IRA: 2000, Brokerage: 1000, BrokerageBasis: 360, Cash: 5000, Roth: 5000 },
        1000,
        { order: ['Brokerage', 'IRA'], taxrate: [0.10, 0.20] }
    ),
    {
  "totalTax": 189.459,
  "netAmount": 1000,
  "shortfall": 0,
  "BrokerageBasis": 128.205,
  "Brokerage": 356.125,
  "BrokerageTax": 22.792,
  "IRA": 833.333,
  "IRATax": 166.667
    },
    'calculateWithdrawals: Weights are missing no shortfall.'
);


//  Test with with NO weights, and a shortfall - should not touch Roth or Cash. Note Rates is a short array.
assertEqual(
    calculateWithdrawals(
        { IRA: 2000, Brokerage: 1000, BrokerageBasis: 360, Cash: 5000, Roth: 5000 },
        5000,
        { order: ['Brokerage', 'IRA'], taxrate: [0.10, 0.20] }
    ),
    {
  "totalTax": 464,
  "netAmount": 2536,
  "shortfall": 2464,
  "BrokerageBasis": 360,
  "Brokerage": 1000,
  "BrokerageTax": 64,
  "IRA": 2000,
  "IRATax": 400
    },
    'calculateWithdrawals: Weights are missing, with shortfall, no change to Roth or Cash.'
);


//  Test with with NO weights, and a shortfall - should not touch Roth. NOTE taxrate is missing last rate.
assertEqual(
    calculateWithdrawals(
        { IRA: 2000, Brokerage: 1000, BrokerageBasis: 360, Cash: 5000, Roth: 5000 },
        5000,
        { order: ['Brokerage', 'IRA', 'Cash'], taxrate: [0.10, 0.20] }
    ),
    {
  "totalTax": 355.235,
  "netAmount": 5000,
  "shortfall": 0,
  "BrokerageBasis": 240.385,
  "Brokerage": 667.735,
  "BrokerageTax": 42.735,
  "IRA": 1562.5,
  "IRATax": 312.5,
  "Cash": 3125,
  "CashTax": 0
    },
    'calculateWithdrawals: Weights are missing, taxrate is short. Shortfall filled by IRA, no change to Roth.'
);


// Test: Your example - 50/50 split with different tax rates

assertEqual(
    calculateWithdrawals(
        { IRA: 1000, Brokerage: 600, BrokerageBasis: 360, Cash: 5000, Roth: 5000 },
        1000,
        { order: ['Brokerage', 'IRA', 'Cash', 'Roth'], weight: [50, 50, 0, 0], taxrate: [0.15, 0.25, 0, 0] }
    ),
    {
  "totalTax": 198.582,
  "netAmount": 1000,
  "shortfall": 0,
  "BrokerageBasis": 319.149,
  "Brokerage": 531.915,
  "BrokerageTax": 31.915,
  "IRA": 666.667,
  "IRATax": 166.667
    },
    'calculateWithdrawals: 50/50 split with tax rates 0.15 and 0.25'
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
  "BrokerageBasis": 300,
  "Brokerage": 500,
  "BrokerageTax": 0
    },
    'calculateWithdrawals: Normal 50/50 split with no taxes'
);

// Test: High tax rate causing insufficient gross funds and a shorfall.
assertEqual(
    calculateWithdrawals(
        { IRA: 1000, Brokerage: 1000, BrokerageBasis: 200, Cash: 1000, Roth: 1000 },
        4000,
        { order: ['Brokerage', 'IRA', 'Cash', 'Roth'], weight: [50, 50, 0, 0], taxrate: [0.50, 0.5, 0, 0] }
    ),
    {
  "totalTax": 900,
  "netAmount": 3100,
  "shortfall": 900,
  "BrokerageBasis": 200,
  "Brokerage": 1000,
  "BrokerageTax": 400,
  "IRA": 1000,
  "IRATax": 500,
  "Cash": 1000,
  "CashTax": 0,
  "Roth": 1000,
  "RothTax": 0
    },
    'calculateWithdrawals: High tax rates causing shortfall'
);

// Test: Account depletion with fallback and taxes
assertEqual(
    calculateWithdrawals(
        { Cash: 1000, Brokerage: 1000, BrokerageBasis: 200, IRA: 10000, Roth: 5000 },
        4000,
        { order: ['Cash', 'Brokerage', 'IRA', 'Roth'], weight: [50, 50, 0, 0], taxrate: [0, 0.10, 0.25, 0] }
    ),
    {
  "totalTax": 773.333,
  "netAmount": 4000,
  "shortfall": 0,
  "Cash": 1000,
  "CashTax": 0,
  "BrokerageBasis": 200,
  "Brokerage": 1000,
  "BrokerageTax": 80,
  "IRA": 2773.333,
  "IRATax": 693.333
    },
    'calculateWithdrawals: Weighted accounts depleted, fallback to IRA with 25% tax'
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
    'calculateWithdrawals: 100% from Roth (tax-free)'
);

assertEqual(
    calculateWithdrawals(
        { IRA: 100000, Brokerage: 3000, BrokerageBasis: 1800, Cash: 3000, Roth: 25000 },
        8000,
        { order: ['Cash', 'Brokerage', 'IRA', 'Roth'], weight: [50, 50, 0, 0], taxrate: [0, 0.20, 0.30, 0] }
    ),
    {
  "totalTax": 1200,
  "netAmount": 8000,
  "shortfall": 0,
  "Cash": 3000,
  "CashTax": 0,
  "BrokerageBasis": 1800,
  "Brokerage": 3000,
  "BrokerageTax": 240,
  "IRA": 3200,
  "IRATax": 960 
    },
    'calculateWithdrawals: Mixed tax rates with depletion and fallback to IRA'
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
    'calculateWithdrawals: Zero gap amount'
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
  "shortfall": 5000
    },
    'calculateWithdrawals: All accounts empty'
);

// Test: Different order with taxes
assertEqual(
    calculateWithdrawals(
        { IRA: 10000, Brokerage: 10000, BrokerageBasis: 6000, Cash: 10000, Roth: 10000 },
        12000,
        { order: ['Roth', 'IRA', 'Brokerage', 'Cash'], weight: [40, 40, 20, 0], taxrate: [0, 0.25, 0.15, 0] }
    ),
    {
  "totalTax": 1753.191,
  "netAmount": 12000,
  "shortfall": 0,
  "Roth": 4800,
  "RothTax": 0,
  "IRA": 6400,
  "IRATax": 1600,
  "BrokerageBasis": 1531.915,
  "Brokerage": 2553.191,
  "BrokerageTax": 153.191
    },
    'calculateWithdrawals: Different order - Roth and IRA prioritized with taxes'
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
  "IRA1": 1000000,
  "IRA2": 400000,
  "Roth": 50000,
  "Brokerage": 100000,
  "BrokerageBasis": 100000,
  "Cash": 50000,
  "ss1": 48000,
  "ss1Age": 70,
  "ss2": 24000,
  "ss2Age": 70,
  "pensionAnnual": 15000,
  "survivorPct": 75,
  "spendGoal": 150000,
  "spendChange": 0.99,
  "iraBaseGoal": 350000,
  "inflation": 0.03,
  "cpi": 0.028,
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

