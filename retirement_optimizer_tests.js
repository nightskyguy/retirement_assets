
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
	
	assertEqual(
		combineGains(
			{IRA1: 100, Roth: 200, Cash: 50},
			{IRA1: 150, Roth: 100, Cash: 25}
		),
		{IRA1: 250, Roth: 300, Cash: 75},
		"combineGains: overlapping keys should sum correctly"
	);

	// Test 2: Non-overlapping keys
	assertEqual(
		combineGains(
			{IRA1: 100, Roth: 200},
			{Brokerage: 300, Cash: 150}
		),
		{IRA1: 100, Roth: 200, Brokerage: 300, Cash: 150},
		"combineGains: non-overlapping keys should all be included"
	);

	// Test 3: Partial overlap
	assertEqual(
		combineGains(
			{IRA1: 100, Roth: 200, Cash: 50},
			{Roth: 100, Brokerage: 300}
		),
		{IRA1: 100, Roth: 300, Cash: 50, Brokerage: 300},
		"combineGains: partial overlap should combine overlapping and preserve unique keys"
	);

	// Test 4: Empty first object
	assertEqual(
		combineGains(
			{},
			{IRA1: 100, Roth: 200}
		),
		{IRA1: 100, Roth: 200},
		"combineGains: empty first object should return second object values"
	);

	// Test 5: Empty second object
	assertEqual(
		combineGains(
			{IRA1: 100, Roth: 200},
			{}
		),
		{IRA1: 100, Roth: 200},
		"combineGains: empty second object should return first object values"
	);

	// Test 6: Both empty
	assertEqual(
		combineGains({}, {}),
		{},
		"combineGains: both empty objects should return empty object"
	);

	// Test 7: Negative values (losses)
	assertEqual(
		combineGains(
			{IRA1: -50, Roth: 100},
			{IRA1: -25, Roth: -30}
		),
		{IRA1: -75, Roth: 70},
		"combineGains: should handle negative values (losses) correctly"
	);

	// Test 8: Zero values
	assertEqual(
		combineGains(
			{IRA1: 0, Roth: 100},
			{IRA1: 50, Roth: 0}
		),
		{IRA1: 50, Roth: 100},
		"combineGains: should handle zero values correctly"
	);
	

	// Test 1: 3 months growth with non-standard account names
	let balances1 = {TreasuryBonds: 10000, MuniBonds: 5000, Checking: 2000};
	let rates1 = {TreasuryBonds: 0.08, MuniBonds: 0.08, Checking: 0.04};
	let gains1 = applyGrowth(balances1, rates1, 3);
	assertEqual(
		gains1,
		{TreasuryBonds: 200, MuniBonds: 100, Checking: 20},
		"applyGrowth: 3 months with custom account names"
	);
	assertEqual(
		balances1,
		{TreasuryBonds: 10200, MuniBonds: 5100, Checking: 2020},
		"applyGrowth: balances updated for custom account names"
	);

	// Test 2: 6 months growth with mixed standard and custom names
	let balances2 = {IRA1: 10000, CryptoAccount: 5000, RealEstate: 20000};
	let rates2 = {IRA1: 0.06, CryptoAccount: 0.20, RealEstate: 0.04};
	let gains2 = applyGrowth(balances2, rates2, 6);
	assertEqual(
		gains2,
		{IRA1: 300, CryptoAccount: 500, RealEstate: 400},
		"applyGrowth: 6 months with mixed standard and custom account names"
	);

	// Test 3: 1 month growth with unique account name
	let balances3 = {HighYieldSavings: 12000};
	let rates3 = {HighYieldSavings: 0.048};
	let gains3 = applyGrowth(balances3, rates3, 1);
	assertEqual(
		gains3,
		{HighYieldSavings: 48},
		"applyGrowth: 1 month with unique account name"
	);

	// Test 4: 9 months growth with completely custom names
	let balances4 = {Portfolio_A: 10000, Portfolio_B: 8000, EmergencyFund: 5000};
	let rates4 = {Portfolio_A: 0.08, Portfolio_B: 0.08, EmergencyFund: 0.03};
	let gains4 = applyGrowth(balances4, rates4, 9);
	assertEqual(
		gains4,
		{Portfolio_A: 600, Portfolio_B: 480, EmergencyFund: 112.5},
		"applyGrowth: 9 months with completely custom account names"
	);

	// Test 5: Negative growth with custom account name
	let balances5 = {HedgeFund: 50000, Commodities: 30000};
	let rates5 = {HedgeFund: -0.12, Commodities: -0.08};
	let gains5 = applyGrowth(balances5, rates5, 4);
	assertEqual(
		gains5,
		{HedgeFund: -2000, Commodities: -800},
		"applyGrowth: 4 months negative rate with custom account names"
	);
	assertEqual(
		balances5,
		{HedgeFund: 48000, Commodities: 29200},
		"applyGrowth: balances decreased for custom accounts"
	);

		// Test 6: Combined scenario with custom names - 3 months then 9 months
		let balances6 = {SEP_IRA: 10000, HSA: 5000};
		let rates6 = {SEP_IRA: 0.12, HSA: 0.05};
		let gainsFirst3 = applyGrowth(balances6, rates6, 3);
		let gainsLast9 = applyGrowth(balances6, rates6, 9);
		let totalGains6 = combineGains(gainsFirst3, gainsLast9);
		assertEqual(
			gainsFirst3,
			{SEP_IRA: 300, HSA: 62.5},
			"applyGrowth: first 3 months with custom account names"
		);
		assertEqual(
			gainsLast9,
			{SEP_IRA: 927, HSA: 189.84375},
			"applyGrowth: last 9 months with custom account names"
		);
		assertEqual(
			totalGains6,
			{SEP_IRA: 1227, HSA: 252.34375},
			"applyGrowth: combined gains with custom account names"
		);

		// Test 7: Account names with special characters
		let balances7 = {"401k_Main": 25000, "529_College": 15000, "IRA-Spouse": 10000};
		let rates7 = {"401k_Main": 0.10, "529_College": 0.07, "IRA-Spouse": 0.08};
		let gains7 = applyGrowth(balances7, rates7, 6);
		assertEqual(
			gains7,
			{"401k_Main": 1250, "529_College": 525, "IRA-Spouse": 400},
			"applyGrowth: 6 months with special characters in account names"
		);



	
	
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

    assertEqual(findUpperLimitByAmount('TEST', 'SGL', 998, 1), {"limit": 999,"rate": 0.1, "nominalRate": 0.1}, 
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
  "spendChange": -0.01,
  "iraBaseGoal": 750000,
  "inflation": 0.03,
  "cpi": 0.028,
  "growth": 0.06,
  "cashYield": 0.03,
  "dividendRate": 0.005,
  "ssFailYear": 2033,
  "ssFailPct": 0.773,
  "maxConversion": false,
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
    let rmd73 = getRMDPercentage(1952+72, 1952);
    assertEqual(rmd73 > 0.037 && rmd73 < 0.038, true,
                    'RMD: Age 73 should be ~3.77% (divisor 26.5)');

	assertEqual(getRMDPercentage(1960+73, 1960), 0,
			'getRMDPercentage for age 74, birth year 1960 correct (0)');	

	assertEqual(getRMDPercentage(1950+75, 1950), 0.042,
			'getRMDPercentage for age 76, birth year 1950 correct (4.2%)');

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

	// ============================================================================
	// TEST CASE 1: Simple - Only SS income, below taxability threshold
	// ============================================================================
	function testCase1_OnlySSBelowThreshold() {
		console.log('\n=== Test Case 1: Only SS Income, Below Threshold ===');
		
		const result = calculateTaxes({
			filingStatus: 'SGL',
			ages: [67],
			earnedIncome: 0,
			ss1: 20000,
			ss2: 0,
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
	} // testCase1_OnlySSBelowThreshold()

	// ============================================================================
	// TEST CASE 2: SS with 50% taxability (between thresholds)
	// ============================================================================
	function testCase2_SS50PercentTaxable() {
		console.log('\n=== Test Case 2: SS 50% Taxable (MFJ) ===');
		
		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [64, 62],  // Under 65, no age bump
			earnedIncome: 20000,
			ss1: 15000,
			ss2: 15000,
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
	} // testCase2_SS50PercentTaxable()

	// ============================================================================
	// TEST CASE 3: SS with 85% taxability (above second threshold)
	// ============================================================================
	function testCase3_SS85PercentTaxable() {
		console.log('\n=== Test Case 3: SS 85% Taxable (MFJ) ===');
		
		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [70, 68],  // Both over 65, get age bumps
			earnedIncome: 50000,
			ss1: 20000,
			ss2: 20000,
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
	} // testCase3_SS85PercentTaxable()

	// ============================================================================
	// TEST CASE 4: Large Capital Gains (testing preferential rates)
	// ============================================================================
	function testCase4_LargeCapitalGains() {
		console.log('\n=== Test Case 4: Large Capital Gains ===');
		
		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [55, 53],
			earnedIncome: 60000,
			ss1: 0,
			ss2: 0,
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
		assertEqual(result.federalTax, 25025, 'Total Federal Tax');
	} // testCase4_LargeCapitalGains()

	// ============================================================================
	// TEST CASE 5: Complex - Multiple income types with HSA
	// ============================================================================
	function testCase5_ComplexMultipleIncomes() {
		console.log('\n=== Test Case 5: Complex Multiple Income Types ===');
		
		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [67, 65],  // Both get age bump
			earnedIncome: 80000,
			ss1: 25000,
			ss2: 18000,
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
		assertEqual(result.irmaaMagi, 146550, 'IRMAA MAGI');
		
		// Federal std deduction = 32200 + 1650 + 1650 = 35,500
		assertEqual(result.federalStdDeduction, 35500, 'Federal Std Deduction');
		
		// State AGI (TEST state allows HSA deduction, no SS tax)
		// = (80000 - 10000) + 0 + 8000 + 12000 + 15000 = 105,000
		assertEqual(result.stateAGI, 105000, 'State AGI (TEST state)');
	} // testCase5_ComplexMultipleIncomes()

	// ============================================================================
	// TEST CASE 6: High income testing NIIT inclusion in capital gains
	// ============================================================================
	function testCase6_HighIncomeNIIT() {
		console.log('\n=== Test Case 6: High Income with NIIT ===');
		
		const result = calculateTaxes({
			filingStatus: 'MFJ',
			ages: [45, 43],
			earnedIncome: 300000,
			ss1: 0,
			ss2: 0,
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
		
		// Capital gains start at position 287,800 (well past 0% and 15% brackets)
		// Position 287,800 to 613,700 = 325,900 @ 18.8% = 61,269.20
		// Position 613,700 to 737,800 = 124,100 @ 23.8% = 29,535.80
		// Total cap gains tax = 90,805
		assertEqual(result.capitalGainsTax, 90805, 'Capital Gains Tax (with NIIT)');
	} // testCase6_HighIncomeNIIT()

	// ============================================================================
	// TEST CASE 7: Single filer with inflation adjustment
	// ============================================================================
	function testCase7_SingleWithInflation() {
		console.log('\n=== Test Case 7: Single Filer with Inflation ===');
		
		const result = calculateTaxes({
			filingStatus: 'SGL',
			ages: [68],  // Gets age bump
			earnedIncome: 50000,
			ss1: 30000,
			ss2: 0,
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
		
		// SS thresholds with inflation: $25,000 * 1.1 = 27,500; $34,000 * 1.1 = 37,400
		// Provisional 67,000 > 37,400 (inflated second threshold)
		// Tier 1: 0.5 * (37400 - 27500) = 4,950
		// Tier 2: 0.85 * (67000 - 37400) = 25,160
		// Total: 30,110, max is 0.85 * 30000 = 25,500
		assertEqual(result.taxableSS, 25500, 'Taxable SS (85% max)');
		
		// Federal std deduction = (16100 + 2050) * 1.1 = 19,965
		assertEqual(result.federalStdDeduction, 19965, 'Federal Std Deduction (inflated)');
	} // testCase7_SingleWithInflation()

	// ============================================================================
	// TEST CASE 8: Edge case - exactly at 50% threshold
	// ============================================================================
	function testCase8_ExactlyAt50PercentThreshold() {
		console.log('\n=== Test Case 8: Exactly at 50% Threshold ===');
		
		const result = calculateTaxes({
			filingStatus: 'SGL',
			ages: [66],
			earnedIncome: 10000,
			ss1: 30000,
			ss2: 0,
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
	} // testCase8_ExactlyAt50PercentThreshold()

	// ============================================================================
	// Run all tests
	// ============================================================================
	function runAllTaxTests() {
		console.log('╔════════════════════════════════════════════════════╗');
		console.log('║     RUNNING calculateTaxes() TEST SUITE            ║');
		console.log('╚════════════════════════════════════════════════════╝');
		
		testCase1_OnlySSBelowThreshold();
		testCase2_SS50PercentTaxable();
		testCase3_SS85PercentTaxable();
		testCase4_LargeCapitalGains();
		testCase5_ComplexMultipleIncomes();
		testCase6_HighIncomeNIIT();
		testCase7_SingleWithInflation();
		testCase8_ExactlyAt50PercentThreshold();
		
		console.log('\n╔════════════════════════════════════════════════════╗');
		console.log('║     TEST SUITE COMPLETE                            ║');
		console.log('╚════════════════════════════════════════════════════╝');
		console.log(`\nResults: ${passed} passed, ${failed} failed`);
	} // runAllTaxTests()

	// Run the test suite
	runAllTaxTests();

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

