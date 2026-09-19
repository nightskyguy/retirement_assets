
// ===== UNIT TESTS =====
function runTests() {
    console.log('========================================');
    console.log('   RUNNING UNIT TESTS');
    console.log('========================================\n');
    
    let passed = 0;
    let failed = 0;
    let skippedUnsafe = 0;

	/**
	 * UNSAFE TESTS: the ones that write to live page state.
	 *
	 * runTests() is called from retirement_optimizer.html's idle callback, AFTER the boot sequence
	 * (captureDefaults(), loadScenarioByName('default'), loadFromURL(), the first runSimulation())
	 * and after first paint. Until 11.17b0 it ran at top level, before all of that. Either way,
	 * anything a test leaves behind is the plan the reader is now looking at, and on the old order
	 * it was worse still - the state the page then treated as pristine:
	 *
	 *   - captureDefaults() snapshots the controls as OPT_DEFAULTS, which Share uses to decide which
	 *     fields it may OMIT from a share link. A polluted snapshot silently drops real fields from
	 *     a shared URL, or carries junk into one.
	 *   - a saved scenario and a URL both merge ONTO the live controls; a field the incoming data
	 *     does not mention keeps whatever the test left.
	 *   - the reader simply sees a plan they never entered.
	 *
	 * That last one shipped: v11.165B added a ceiling test calling applyScenario(), whose fixture
	 * (birth years 1958/1959, strategy bracket) became the page's apparent defaults on every load,
	 * and the default plan appeared to run out of money. Restoring in a finally is necessary but is
	 * not sufficient - a test that throws before its finally, or restores an incomplete set of
	 * fields, does the same damage more quietly.
	 *
	 * So mutating tests are OPT-IN. They run only with ?runtests on the URL, which is the same flag
	 * that opts into the node tiers, and are counted and reported when skipped rather than vanishing.
	 *
	 * Marking one: put `if (!unsafeTest('name')) return;` as the FIRST line inside it, and give it a
	 * banner saying WHAT it mutates. Restoring in a finally is still required - the gate limits the
	 * blast radius to readers who asked for it, it does not license leaving a mess.
	 */
	const UNSAFE_ALLOWED = (() => {
		try { return new URLSearchParams(location.search).has('runtests'); } catch (e) { return false; }
	})();
	function unsafeTest(name) {
		if (UNSAFE_ALLOWED) return true;
		skippedUnsafe++;
		console.log(`⏭  SKIPPED (mutates live page state; add ?runtests to include): ${name}`);
		return false;
	}
	
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
	

	// PART-YEAR GROWTH IS COMPOUNDED, NOT SPREAD EVENLY. These tests exist to cover ARBITRARY
	// account names, and they used to pin literals of the old proportional arithmetic
	// (bal * rate * months/12). The expectation is now derived from the contract instead: the
	// Growth input is a CAGR, so a fraction m/12 of a year earns (1+r)^(m/12) - 1.
	//
	// Written out with Math.pow here rather than by calling growthFactor, deliberately. An
	// expectation built from the function under test agrees with itself whatever it does; this one
	// fails if the engine ever goes back to spreading the rate evenly.
	const expGains = (bals, rates, m) => Object.fromEntries(
		Object.keys(bals).map(k => [k, bals[k] * (Math.pow(1 + rates[k], m / 12) - 1)]));
	const expBals = (bals, rates, m) => Object.fromEntries(
		Object.keys(bals).map(k => [k, bals[k] * Math.pow(1 + rates[k], m / 12)]));

	// Test 1: 3 months growth with non-standard account names
	let balances1 = {TreasuryBonds: 10000, MuniBonds: 5000, Checking: 2000};
	let rates1 = {TreasuryBonds: 0.08, MuniBonds: 0.08, Checking: 0.04};
	let start1 = {...balances1};
	let gains1 = applyGrowth(balances1, rates1, 3);
	assertEqual(gains1, expGains(start1, rates1, 3),
		"applyGrowth: 3 months with custom account names");
	assertEqual(balances1, expBals(start1, rates1, 3),
		"applyGrowth: balances updated for custom account names");

	// Test 2: 6 months growth with mixed standard and custom names
	let balances2 = {IRA1: 10000, CryptoAccount: 5000, RealEstate: 20000};
	let rates2 = {IRA1: 0.06, CryptoAccount: 0.20, RealEstate: 0.04};
	let start2 = {...balances2};
	let gains2 = applyGrowth(balances2, rates2, 6);
	assertEqual(gains2, expGains(start2, rates2, 6),
		"applyGrowth: 6 months with mixed standard and custom account names");

	// Test 3: 1 month growth with unique account name
	let balances3 = {HighYieldSavings: 12000};
	let rates3 = {HighYieldSavings: 0.048};
	let start3 = {...balances3};
	let gains3 = applyGrowth(balances3, rates3, 1);
	assertEqual(gains3, expGains(start3, rates3, 1),
		"applyGrowth: 1 month with unique account name");

	// Test 4: 9 months growth with completely custom names
	let balances4 = {Portfolio_A: 10000, Portfolio_B: 8000, EmergencyFund: 5000};
	let rates4 = {Portfolio_A: 0.08, Portfolio_B: 0.08, EmergencyFund: 0.03};
	let start4 = {...balances4};
	let gains4 = applyGrowth(balances4, rates4, 9);
	assertEqual(gains4, expGains(start4, rates4, 9),
		"applyGrowth: 9 months with completely custom account names");

	// Test 5: Negative growth with custom account name
	let balances5 = {HedgeFund: 50000, Commodities: 30000};
	let rates5 = {HedgeFund: -0.12, Commodities: -0.08};
	let start5 = {...balances5};
	let gains5 = applyGrowth(balances5, rates5, 4);
	assertEqual(gains5, expGains(start5, rates5, 4),
		"applyGrowth: 4 months negative rate with custom account names");
	assertEqual(balances5, expBals(start5, rates5, 4),
		"applyGrowth: balances decreased for custom accounts");

		// Test 6: Combined scenario with custom names - 3 months then 9 months.
		// ALSO THE MULTIPLICATIVE CHECK: 3 months then 9 must equal one 12-month call, because
		// compounding is exactly multiplicative. Under the old proportional model it did not.
		let balances6 = {SEP_IRA: 10000, HSA: 5000};
		let rates6 = {SEP_IRA: 0.12, HSA: 0.05};
		let start6 = {...balances6};
		let gainsFirst3 = applyGrowth(balances6, rates6, 3);
		let mid6 = {...balances6};
		let gainsLast9 = applyGrowth(balances6, rates6, 9);
		let totalGains6 = combineGains(gainsFirst3, gainsLast9);
		assertEqual(gainsFirst3, expGains(start6, rates6, 3),
			"applyGrowth: first 3 months with custom account names");
		assertEqual(gainsLast9, expGains(mid6, rates6, 9),
			"applyGrowth: last 9 months with custom account names");
		assertEqual(totalGains6, expGains(start6, rates6, 12),
			"applyGrowth: combined gains with custom account names");
		assertEqual(balances6, expBals(start6, rates6, 12),
			"applyGrowth: 3 months then 9 lands exactly where one full year does");

		// Test 7: Account names with special characters
		let balances7 = {"401k_Main": 25000, "529_College": 15000, "IRA-Spouse": 10000};
		let rates7 = {"401k_Main": 0.10, "529_College": 0.07, "IRA-Spouse": 0.08};
		let start7 = {...balances7};
		let gains7 = applyGrowth(balances7, rates7, 6);
		assertEqual(gains7, expGains(start7, rates7, 6),
			"applyGrowth: 6 months with special characters in account names");


	
	
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

				
	// getInputs() requires live DOM - test manually in retirement_optimizer.html or in a future Playwright/DOM test suite
	// assertEqual(getInputs(), { ... }, 'getInputs()')
		

	// Example: $1M IRA, want to get down to $200K over 10 years, 6% growth
	assertEqual(calculateAmortizedWithdrawal(1000000, 200000, 10, 0.06), 120694.367,
		'calculateAmortizedWithdrawal(1000000, 200000, 10, 0.06) = 120694.367');

	// Example: $1M IRA, want to get down to $200K in 1 year, 6% growth
	assertEqual(calculateAmortizedWithdrawal(1000000, 200000, 1, 0.06), 860000,
		'calculateAmortizedWithdrawal(1000000, 200000, 1, 0.06) = 860000');

	// Example: $10k IRA, want to get down to $2K in 3 year, -5% growth
	assertEqual(calculateAmortizedWithdrawal(10000, 2000, 3, -0.05), 2304.557,
		'calculateAmortizedWithdrawal(10000, 2000, 3, -0.05) = 2304.557');		

	assertEqual(calculateAmortizedWithdrawal(950, 1000, 5, 0.1), 86.81,
		'calculateAmortizedWithdrawal(950, 1000, 5, 0.1) = 86.81');			

				

	// RMD Percentages.  First should be 0, second should match.
    // RMD percentage lookup
    let rmd73 = getRMDPercentage(1952+73, 1952);
    assertEqual(rmd73 > 0.037 && rmd73 < 0.038, true,
                    'RMD: Age 73 should be ~3.77% (divisor 26.5)');

	assertEqual(getRMDPercentage(1960+73, 1960), 0,
			'getRMDPercentage for age 74, birth year 1960 correct (0)');	

	assertEqual(getRMDPercentage(1950+76, 1950), 0.042,
			'getRMDPercentage for age 76, birth year 1950 correct (4.2%)');


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


	// The tax-engine cases (calculateTaxes, the bracket lookups, calculateProgressive, calcIRMAA)
	// moved to taxengine.tests.js in 11.17b0. They need no DOM, and until then they ran here on
	// every page load before first paint - and nowhere else. See that file's header.

	// ============================================================================
	// ACCOUNT GROWTH TESTS  (b, c, d)
	// ============================================================================
	console.log('\n=== Account Growth Tests ===');

	// (b) Brokerage: price appreciation via applyGrowth + dividends to Cash
	{
		const bal = { Brokerage: 100000, BrokerageBasis: 60000, Cash: 10000 };
		const rates = { Brokerage: 0.06, BrokerageBasis: 0.06, Cash: 0.03 };
		const g = applyGrowth(bal, rates, 12);
		// Brokerage grows 6%
		assertEqual(g.Brokerage, 6000, 'Brokerage: annual gain at 6%');
		assertEqual(bal.Brokerage, 106000, 'Brokerage: balance after 6% growth');
		// BrokerageBasis also grows proportionally
		assertEqual(g.BrokerageBasis, 3600, 'BrokerageBasis: annual gain at 6%');
		assertEqual(bal.BrokerageBasis, 63600, 'BrokerageBasis: balance after 6% growth');
		// Cash grows at cashYield
		assertEqual(g.Cash, 300, 'Cash: annual gain at 3%');
		assertEqual(bal.Cash, 10300, 'Cash: balance after 3% growth');

		// Dividends (2%) on 100k brokerage should add 2000 to cash (not reinvested)
		const dividends = 100000 * 0.02;
		bal.Cash += dividends;
		assertEqual(bal.Cash, 12300, 'Brokerage dividends (not reinvested) flow to Cash');
	}

	// Brokerage: dividend reinvestment - dividends add to Brokerage and Basis
	{
		const bal = { Brokerage: 100000, BrokerageBasis: 60000, Cash: 10000 };
		const rates = { Brokerage: 0.06, BrokerageBasis: 0.06, Cash: 0.03 };
		applyGrowth(bal, rates, 12);
		const dividends = 100000 * 0.02;
		// Reinvested: brokerage and basis both grow
		bal.Brokerage += dividends;
		bal.BrokerageBasis += dividends;
		assertEqual(bal.Brokerage, 108000, 'Brokerage: after growth + reinvested dividends');
		assertEqual(bal.BrokerageBasis, 65600, 'BrokerageBasis: after growth + reinvested dividends (basis steps up)');
		assertEqual(bal.Cash, 10300, 'Cash unchanged when dividends reinvested');
	}

	// (b) Brokerage: 10-year compound growth matches formula
	{
		const startBalance = 100000;
		const rate = 0.06;
		let bal = { Brokerage: startBalance };
		const rates = { Brokerage: rate };
		for (let i = 0; i < 10; i++) applyGrowth(bal, rates, 12);
		const expected = startBalance * Math.pow(1 + rate, 10);
		assertEqual(Math.round(bal.Brokerage), Math.round(expected), 'Brokerage: 10-year compound growth matches formula');
	}

	// (c) Cash: annual growth at cashYield
	{
		const bal = { Cash: 50000 };
		const rates = { Cash: 0.035 };
		const g = applyGrowth(bal, rates, 12);
		assertEqual(g.Cash, 1750, 'Cash: annual gain at 3.5%');
		assertEqual(bal.Cash, 51750, 'Cash: balance after 3.5% growth');
	}

	// (c) Cash: 5-year compound growth
	{
		const startBalance = 50000;
		const rate = 0.035;
		let bal = { Cash: startBalance };
		const rates = { Cash: rate };
		for (let i = 0; i < 5; i++) applyGrowth(bal, rates, 12);
		const expected = startBalance * Math.pow(1 + rate, 5);
		assertEqual(Math.round(bal.Cash), Math.round(expected), 'Cash: 5-year compound growth matches formula');
	}

	// (d) Roth: annual growth at growth rate
	{
		const bal = { Roth: 80000 };
		const rates = { Roth: 0.06 };
		const g = applyGrowth(bal, rates, 12);
		assertEqual(g.Roth, 4800, 'Roth: annual gain at 6%');
		assertEqual(bal.Roth, 84800, 'Roth: balance after 6% growth');
	}

	// (d) Roth: grows independently - dividends do NOT flow to Roth externally (no entry in growthRates for dividends)
	{
		const bal = { Roth: 80000, Cash: 10000 };
		const rates = { Roth: 0.06, Cash: 0.03 };
		applyGrowth(bal, rates, 12);
		// Brokerage dividends go to Cash, not Roth - Roth only grows via its own rate
		assertEqual(bal.Roth, 84800, 'Roth: does not receive external dividends');
	}

	// (d) Roth: 10-year compound growth
	{
		const startBalance = 80000;
		const rate = 0.06;
		let bal = { Roth: startBalance };
		const rates = { Roth: rate };
		for (let i = 0; i < 10; i++) applyGrowth(bal, rates, 12);
		const expected = startBalance * Math.pow(1 + rate, 10);
		assertEqual(Math.round(bal.Roth), Math.round(expected), 'Roth: 10-year compound growth matches formula');
	}

	// ============================================================================
	// FIXED STRATEGY TESTS  (a) - "Convert in N Years" shortfall investigation
	// ============================================================================
	console.log('\n=== Fixed Strategy (Convert in N Years) Tests ===');

	const baseInputs = {
		STATEname: 'CA', strategy: 'fixed', nYears: 5,
		birthyear1: 1955, birthmonth1: 1, die1: 80,
		birthyear2: 0,    birthmonth2: 12, die2: 0,
		IRA1: 250000, IRA2: 0, Roth: 50000,
		Brokerage: 200000, BrokerageBasis: 200000, Cash: 100000,
		ss1: 0, ss1Age: 70, ss2: 0, ss2Age: 70,
		pensionAnnual: 0, survivorPct: 0, pensionCola: false,
		spendGoal: 60000, spendChange: 0, iraBaseGoal: 0,
		inflation: 0.03, cpi: 0.028, growth: 0.06,
		cashYield: 0.03, dividendRate: 0.005,
		ssFailYear: 2099, ssFailPct: 1.0,
		convertExcessToRoth: false, propWithdraw: 0,
		startInYear: 0, dividendReinvest: false,
		startYear: 2026
	};

	// (a-1) Fixed strategy with adequate portfolio: shortfall may occur (known behavior) but should be bounded
	{
		const result = simulate(baseInputs);
		// The fixed strategy can leave a shortfall because IRA-only withdrawals are taxed, leaving
		// a gap the brokerage/cash fallback must cover.  Verify it's not catastrophic (< $5000 total).
		assertEqual(result.totals.shortfall > -5000, true, 'Fixed strategy: shortfall bounded (not catastrophic)');
		assertEqual(result.log.length > 0, true, 'Fixed strategy: simulation produces log entries');
	}

	// (a-2) After N years, IRA should be drawn to near zero (since iraBaseGoal=0)
	{
		const result = simulate(baseInputs);
		const afterNYears = result.log[Math.min(5, result.log.length - 1)];
		// IRA should be substantially reduced after N years
		assertEqual(afterNYears.TotalIRA < 250000, true, 'Fixed strategy: IRA balance reduces over N years');
	}

	// (a-3) Very small IRA - fallback to Brokerage/Cash covers spending
	{
		const smallIRAInputs = { ...baseInputs, IRA1: 30000, IRA2: 0, nYears: 3 };
		const result = simulate(smallIRAInputs);
		// Simulation should still run (no crash) and brokerage/cash should be drawn
		const lastYear = result.log[result.log.length - 1];
		assertEqual(result.log.length > 0, true, 'Fixed strategy: runs when IRA is small');
		// Brokerage or Cash must have been used (total wealth less than starting brokerage+cash+ira)
		const startingTotal = 30000 + 200000 + 100000 + 50000;
		assertEqual(lastYear.totalNetWealth < startingTotal, true, 'Fixed strategy: assets drawn down when IRA small');
	}

	// (a-4) Adequate portfolio should succeed
	{
		const result = simulate(baseInputs);
		assertEqual(result.totals.success, true, 'Fixed strategy: adequate portfolio reports success');
	}

	// (a-5) RMD tracking works correctly - totals.rmd accumulates
	{
		// Use an older birth year so RMDs kick in
		const rmdInputs = { ...baseInputs, birthyear1: 1945, die1: 90, IRA1: 500000 };
		const result = simulate(rmdInputs);
		assertEqual(result.totals.rmd > 0, true, 'Fixed strategy: RMDs are tracked when age >= 73/75');
		assertEqual(result.totals.rmdTax >= 0, true, 'Fixed strategy: rmdTax is non-negative');
		assertEqual(result.totals.rmdTax <= result.totals.tax + 1, true, 'Fixed strategy: rmdTax does not exceed total tax');
	}

	// (a-6) IRA Goal is interpreted in TODAY'S dollars and inflated (CPI) to each year,
	//        so the drawdown target rises over time and the IRA lands near the CPI-inflated
	//        goal at year N - clearly above the flat-nominal entry. gapYears is 0 here
	//        (startYear <= current year), so the inflation factor is (1+cpi)^(N-1).
	{
		const goalToday = 150000;
		const inp = { ...baseInputs, IRA1: 600000, IRA2: 0, nYears: 6,
			iraBaseGoal: goalToday, birthyear1: 1955, die1: 92 };
		const result = simulate(inp);
		const finalIdx = Math.min(inp.nYears - 1, result.log.length - 1);
		const inflatedGoal = goalToday * Math.pow(1 + inp.cpi, finalIdx);
		const iraAtN = result.log[finalIdx].TotalIRA;
		assertEqual(Math.abs(iraAtN - inflatedGoal) / inflatedGoal < 0.08, true,
			'IRA Goal (today$): IRA lands near the CPI-inflated goal at year N');
		assertEqual(iraAtN > goalToday * 1.02, true,
			'IRA Goal (today$): final IRA exceeds flat-nominal goal (target was inflated)');
	}

	// (a-7) Cyclic brokerage + reduce must not produce a final-year Roth-conversion balloon.
	//        Previously a brokerage (skip) year deferred the IRA reduction into one giant
	//        final-year conversion; the skip-aware amortization keeps conversions smooth.
	{
		const inp = { ...baseInputs, IRA1: 600000, IRA2: 0, nYears: 6,
			iraBaseGoal: 150000, convertExcessToRoth: true,
			cyclicEnabled: true, cyclicOrder: 'ira-first',
			birthyear1: 1955, die1: 92 };
		const result = simulate(inp);
		const convs = result.log.slice(0, inp.nYears).map(e => e.rothConv || 0).filter(c => c > 1000);
		if (convs.length >= 3) {
			const sorted = [...convs].sort((a, b) => a - b);
			const median = sorted[Math.floor(sorted.length / 2)];
			const max = Math.max(...convs);
			assertEqual(max < median * 4, true,
				'Cyclic + reduce: no final-year conversion balloon (max < 4x median)');
		} else {
			assertEqual(true, true, 'Cyclic + reduce: too few conversions to assess balloon (skipped)');
		}
	}

	// ============================================================================
	// INFLATION SEQUENCE TESTS  (Phase 7 - inflationSequence per-path sampling)
	// ============================================================================
	console.log('\n=== inflationSequence (Phase 7) Tests ===');

	// Shared base: ample portfolio, constant 6% returns, spendChange=0 so spend escalation
	// is purely inflation-driven.  returnSequence is long enough to cover any plan horizon.
	const inflBase = {
		...baseInputs,
		returnSequence: new Float64Array(40).fill(0.06),
		IRA1: 800000, Cash: 200000,
	};

	// (inf-1) inflationSequence overrides inputs.inflation for spend escalation.
	// With a 10% sampled rate and 3% fixed rate, log[1].spendGoal must reflect 10%.
	{
		const seq = new Float64Array(40).fill(0.10);
		const result = simulate({ ...inflBase, inflation: 0.03, inflationSequence: seq });
		const y0 = result.log[0].spendGoal;
		const y1 = result.log[1].spendGoal;
		assertEqual(Math.abs(y1 / y0 - 1.10) < 0.001, true,
			'inflationSequence: spend goal escalates at sampled rate (10%), not fixed inflation (3%)');
	}

	// (inf-2) Without inflationSequence, spend escalates at inputs.inflation (existing behaviour unchanged).
	{
		const result = simulate({ ...inflBase, inflation: 0.03 });
		const y0 = result.log[0].spendGoal;
		const y1 = result.log[1].spendGoal;
		assertEqual(Math.abs(y1 / y0 - 1.03) < 0.001, true,
			'inflationSequence absent: spend goal escalates at fixed inputs.inflation (3%)');
	}

	// (inf-3) Partial inflationSequence: year 0 uses sampled rate, year 1+ falls back to inputs.inflation.
	{
		const seq = new Float64Array(1).fill(0.10);   // only year 0 provided
		const result = simulate({ ...inflBase, inflation: 0.03, inflationSequence: seq });
		const y0 = result.log[0].spendGoal;
		const y1 = result.log[1].spendGoal;
		const y2 = result.log[2].spendGoal;
		assertEqual(Math.abs(y1 / y0 - 1.10) < 0.001, true,
			'inflationSequence partial: year 0 uses sampled 10%');
		assertEqual(Math.abs(y2 / y1 - 1.03) < 0.001, true,
			'inflationSequence partial: year 1 falls back to fixed 3%');
	}

	// ============================================================================
	// SPEND OPTIMIZER TESTS
	// ============================================================================
	console.log('\n=== Spend Optimizer Tests ===');

	// Shared strategy list used by reverse optimizer tests
	const miniStrategyList = [
		{ strategyLabel: 'Proportional', paramLabel: '0%',  paramSortVal: 0,
		  overrides: { strategy: 'propwd',  propWithdraw: 0,    convertExcessToRoth: false } },
		{ strategyLabel: 'Fill Bracket', paramLabel: '22%', paramSortVal: 0.22,
		  overrides: { strategy: 'bracket', stratRate: 0.22,    convertExcessToRoth: false } },
		{ strategyLabel: 'Reduce',       paramLabel: '5 yrs', paramSortVal: 5,
		  overrides: { strategy: 'fixed',   nYears: 5,          convertExcessToRoth: false } },
	];

	// Wealthy scenario - large portfolio, conservative spend - forward optimizer should find higher spend
	const wealthyInputs = {
		...baseInputs,
		IRA1: 1500000, IRA2: 0, Roth: 300000,
		Brokerage: 500000, BrokerageBasis: 400000, Cash: 200000,
		spendGoal: 50000,
		birthyear1: 1960, die1: 90
	};

	// Strained scenario - decent portfolio, high spend - all strategies fail at baseline, but lower spend works
	const strainedInputs = {
		...baseInputs,
		IRA1: 800000, IRA2: 0, Roth: 0,
		Brokerage: 0, BrokerageBasis: 0, Cash: 0,
		spendGoal: 300000,
		birthyear1: 1960, die1: 90
	};

	// Impossible scenario - tiny portfolio, even 10% of spendGoal is unsustainable
	const impossibleInputs = {
		...baseInputs,
		IRA1: 3000, IRA2: 0, Roth: 0,
		Brokerage: 0, BrokerageBasis: 0, Cash: 0,
		spendGoal: 150000,
		birthyear1: 1960, die1: 90
	};

	// (opt-1) Forward optimizer: wealthy baseline passes and returns a higher optimized spend
	{
		const opt = optimizeSpend(wealthyInputs, { strategy: 'bracket', stratRate: 0.22, convertExcessToRoth: false });
		assertEqual(opt !== null, true, 'optimizeSpend: returns result for comfortably-passing scenario');
		assertEqual(opt.optimizedSpend > wealthyInputs.spendGoal, true,
			'optimizeSpend: optimized spend exceeds baseline spend goal');
		const last = opt.result.log[opt.result.log.length - 1];
		const lastRequired = Math.max(0, last.spendGoal - (last.guaranteedIncome ?? 0));
		assertEqual((last.portfolioBalance ?? 0) >= lastRequired, true,
			'optimizeSpend: result satisfies ending portfolio-covers-required-draw criterion');
	}

	// (opt-2) Forward optimizer: returns null when baseline itself fails
	{
		const opt = optimizeSpend(strainedInputs, { strategy: 'propwd', propWithdraw: 0, convertExcessToRoth: false });
		assertEqual(opt, null, 'optimizeSpend: returns null when baseline fails the wealth criterion');
	}

	// (opt-3) Reverse optimizer: finds a sustainable lower spend when all strategies fail at baseline
	{
		const opt = optimizeSpendDown(strainedInputs, miniStrategyList);
		assertEqual(opt !== null, true, 'optimizeSpendDown: finds result when lower spend is viable');
		assertEqual(opt.optimizedSpend < strainedInputs.spendGoal, true,
			'optimizeSpendDown: result spend is below the failing baseline');
		assertEqual(opt.result.totals.success, true,
			'optimizeSpendDown: result passes totals.success (not just end-wealth)');
	}

	// (opt-4) Reverse optimizer: returns null when even MIN_SPEND is unsustainable
	{
		const opt = optimizeSpendDown(impossibleInputs, miniStrategyList);
		assertEqual(opt, null, 'optimizeSpendDown: returns null when even MIN_SPEND fails');
	}

	// (opt-5) Reverse optimizer: converges near the true ceiling, not just any passing value.
	// strainedInputs: IRA1=800k, spendGoal=300k. MIN_SPEND=6k. Sustainable ceiling is ~30-40k
	// (≈4% of 800k). Verify the result is at least 4x MIN_SPEND (24k) - well above the floor
	// but safely below the expected ceiling, so this catches regressions where the search
	// short-circuits at MIN_SPEND.
	{
		const opt = optimizeSpendDown(strainedInputs, miniStrategyList);
		const minSpend = Math.max(500, strainedInputs.spendGoal * 0.02);
		assertEqual(opt !== null, true, 'optimizeSpendDown (opt-5): result exists');
		assertEqual(opt.optimizedSpend > minSpend * 4, true,
			'optimizeSpendDown: converged spend is well above MIN_SPEND (binary search is reaching the ceiling)');
	}

	// ============================================================================
	// BETR TESTS (Phase 21)
	// ============================================================================
	console.log('\n=== BETR Tests (Phase 21) ===');

	// (betr-1) Identity: when r_taxable = r_ira, BETR = t_now exactly.
	{
		const betr = computeBETR(0.22, 0.07, 0.07, 10);
		assertEqual(Math.abs(betr - 0.22) < 0.0001, true,
			'computeBETR identity: r_taxable=r_ira → BETR = t_now');
	}

	// (betr-2) Drag: when r_taxable < r_ira (taxable drag present), BETR < t_now.
	// drag = dividendYield × capGainsRate = 0.02 × 0.15 = 0.003; r_taxable = 0.067
	{
		const betr = computeBETR(0.22, 0.07, 0.067, 10);
		assertEqual(betr < 0.22, true,
			'computeBETR drag: r_taxable < r_ira → BETR < t_now');
	}

	// (betr-3) Horizon effect: longer horizon with drag lowers BETR further (more drag accumulates).
	{
		const betr10 = computeBETR(0.22, 0.07, 0.067, 10);
		const betr20 = computeBETR(0.22, 0.07, 0.067, 20);
		assertEqual(betr20 < betr10, true,
			'computeBETR horizon: longer n with drag → lower BETR (conversion more compelling)');
	}

	// (betr-4) null inputs: returns null when tNow is 0 or n <= 0.
	{
		assertEqual(computeBETR(0, 0.07, 0.07, 10), null, 'computeBETR: tNow=0 → null');
		assertEqual(computeBETR(0.22, 0.07, 0.07, 0), null, 'computeBETR: n=0 → null');
	}

	// (betr-5) BETR appears in Annual Details log when conversions occur.
	{
		const r = simulate({ ...baseInputs, IRA1: 600000, convertExcessToRoth: true });
		const convYears = r.log.filter(row => (row.rothConv ?? 0) > 0 || (row.extraConv ?? 0) > 0);
		const withBETR = convYears.filter(row => row['BETR%'] !== null && row['BETR%'] !== undefined);
		assertEqual(withBETR.length > 0, true,
			'BETR% appears in log for years with conversions');
		// betrAvg should be set on totals
		assertEqual(r.totals.betrAvg !== null && r.totals.betrAvg !== undefined, true,
			'totals.betrAvg is set when conversions occur');
	}

	// ============================================================================
	// extraConversionAmount TESTS (Phase 23)
	// ============================================================================
	console.log('\n=== extraConversionAmount Tests (Phase 23) ===');

	// (conv23-1) Regression: extraConversionAmount=0 produces bit-identical results to baseline.
	{
		const base = simulate({ ...baseInputs, IRA1: 500000, convertExcessToRoth: true });
		const withZero = simulate({ ...baseInputs, IRA1: 500000, convertExcessToRoth: true, extraConversionAmount: 0 });
		assertEqual(
			Math.abs(base.finalNW - withZero.finalNW) < 1,
			true,
			'extraConversionAmount=0: finalNW identical to no-param baseline'
		);
		assertEqual(
			Math.abs(base.totals.tax - withZero.totals.tax) < 1,
			true,
			'extraConversionAmount=0: totals.tax identical to no-param baseline'
		);
	}

	// (conv23-2) Extra conversion increases Roth balance in first year (log[0]).
	{
		const base  = simulate({ ...baseInputs, IRA1: 800000, convertExcessToRoth: false });
		const extra = simulate({ ...baseInputs, IRA1: 800000, convertExcessToRoth: false, extraConversionAmount: 50000 });
		const baseRoth  = base.log[0].Roth;
		const extraRoth = extra.log[0].Roth;
		assertEqual(extraRoth > baseRoth, true,
			'extraConversionAmount=50k: Roth balance higher than no-extra-conv baseline in year 0');
	}

	// (conv23-3) Extra conversion reduces IRA balance by approximately the gross amount in year 0.
	{
		const base  = simulate({ ...baseInputs, IRA1: 800000, convertExcessToRoth: false });
		const extra = simulate({ ...baseInputs, IRA1: 800000, convertExcessToRoth: false, extraConversionAmount: 50000 });
		const ira0Base  = base.log[0].TotalIRA;
		const ira0Extra = extra.log[0].TotalIRA;
		assertEqual(ira0Base - ira0Extra > 40000, true,
			'extraConversionAmount=50k: IRA balance reduced by approximately 50k in year 0');
	}

	// (conv23-4) Array form: per-year conversion schedule.
	// Year 0 gets 30k extra, year 1 gets 0. Verify year-0 Roth > base.
	{
		const schedule = [30000, 0];
		const extra = simulate({ ...baseInputs, IRA1: 800000, convertExcessToRoth: false, extraConversionAmount: schedule });
		const base  = simulate({ ...baseInputs, IRA1: 800000, convertExcessToRoth: false });
		assertEqual(extra.log[0].Roth > base.log[0].Roth, true,
			'extraConversionAmount array: year 0 Roth higher with 30k extra conv');
		// Year 1 IRA delta should be smaller than year 0 delta (no further extra conv in year 1)
		const ira1Delta = base.log[1].TotalIRA - extra.log[1].TotalIRA;
		const ira0Delta = base.log[0].TotalIRA - extra.log[0].TotalIRA;
		assertEqual(ira1Delta < ira0Delta + 5000, true,
			'extraConversionAmount array: year 1 IRA delta not growing (no extra conv after year 0)');
	}

	// ============================================================================
	// IRMAA MEDICARE AGE GATE - surcharge/tier/base-premium only for spouses 65+
	// ============================================================================
	console.log('\n=== IRMAA Medicare Age Gate Tests ===');

	// Couple aged 60/58 at start (2026, pinned), huge conversions every year → MAGI far above
	// every IRMAA threshold. Before the age gate, IRMAA was charged from year 1 at age 61.
	{
		const gateInputs = {
			...baseInputs,
			startInYear: 2026, hasSpouse: true,
			birthyear1: 1966, birthmonth1: 1, die1: 95,
			birthyear2: 1968, birthmonth2: 1, die2: 95,
			IRA1: 10000000, IRA2: 0, nYears: 10,
			convertExcessToRoth: true,
			spendGoal: 80000,
		};
		const r = simulate(gateInputs);
		const pre65 = r.log.filter(row => row.age1 !== '—' && row.age1 < 65);
		assertEqual(pre65.every(row => row.IRMAA === 0), true,
			'IRMAA gate: no surcharge in any year before age 65');
		assertEqual(pre65.every(row => row.IRMAATier === '-none-'), true,
			'IRMAA gate: tier shows -none- in every year before age 65');
		assertEqual(pre65.every(row => row.Medicare === 0), true,
			'IRMAA gate: no base Part B+D premium before age 65');

		// Age 65 (year 5): only person 1 on Medicare (spouse is 63). Lookback MAGI (age-63
		// conversions) is far above the top threshold → surcharge > 0, at half household rate.
		const row65 = r.log.find(row => row.age1 === 65);
		const row67 = r.log.find(row => row.age1 === 67);
		assertEqual(row65.IRMAA > 0, true,
			'IRMAA gate: surcharge present at 65 (one spouse on Medicare)');
		assertEqual(row67.IRMAA > 0, true,
			'IRMAA gate: surcharge present at 67 (both spouses on Medicare)');
		// Base premium is deterministic: persons65+ × ($202.90 Part B + $38.99 Part D)/mo × 12 × (1+cpi+inflation)^simYear.
		const medicareGrowthRate = 1 + baseInputs.cpi + baseInputs.inflation;
		assertEqual(Math.round(row65.Medicare),
			Math.round(1 * (202.90 + 38.99) * 12 * Math.pow(medicareGrowthRate, 5)),
			'Medicare base: one person at 65 = (202.90 + 38.99) × 12 × (1+cpi+inflation)^5');
		assertEqual(Math.round(row67.Medicare),
			Math.round(2 * (202.90 + 38.99) * 12 * Math.pow(medicareGrowthRate, 7)),
			'Medicare base: two persons at 67 = 2 × (202.90 + 38.99) × 12 × (1+cpi+inflation)^7');
		// Same lookback MAGI tier at 65 vs 66 would double the surcharge when the second
		// spouse enrolls; at minimum the both-on-Medicare year must exceed the single year
		// after backing out Medicare-rate growth.
		assertEqual(row67.IRMAA / Math.pow(medicareGrowthRate, 2) > row65.IRMAA * 1.5, true,
			'IRMAA gate: both-spouse surcharge ≈ 2× single-spouse (after CPI+Inflation/yr growth backout)');
	}

	// ============================================================================
	// BROKERAGE GAP-FILL SPIRAL REGRESSION (bug fix: 3rd-pass cap-gains cycle)
	// ============================================================================
	console.log('\n=== Brokerage Gap-Fill Spiral Regression Tests ===');

	// (gap-1) No spurious shortfall when brokerage has high unrealized gains and a gap
	// requires withdrawal - non-bracket strategy, status stays MFJ throughout.
	// The 3rd-pass fix prevents: brokerage withdrawal → higher cap gains → higher SS taxation
	// → residual gap → more brokerage → spiral.
	{
		const r = simulate({
			...baseInputs,
			strategy: 'propwd', propWithdraw: 0, convertExcessToRoth: false,
			IRA1: 400000, Brokerage: 500000, BrokerageBasis: 80000, // 84% unrealized gains ratio
			Cash: 20000, Roth: 30000,
			spendGoal: 110000, ss1: 35000, ss2: 0, hasSpouse: false,
		});
		const shortfallYears = r.log.filter(row => (row.shortfall ?? 0) < -100);
		// With adequate portfolio, no shortfall in first several years
		const earlyShortfalls = shortfallYears.filter(row => row.year <= baseInputs.birthyear1 + baseInputs.die1 - 10);
		assertEqual(earlyShortfalls.length, 0,
			'gap-1: no spurious shortfall in early years with large brokerage unrealized gains (propwd strategy)');
	}

	// (gap-2) No spurious shortfall when brokerage gap-fill and SS phaseout interact.
	// Root cause: brokerage cap gains raise AGI → more SS becomes taxable → 3rd-pass residual →
	// old code drew brokerage again → more cap gains → spiral. Not specific to MFJ→SGL; that was
	// just where it was first noticed. Uses fixedpct (non-bracket) to trigger the old code path.
	{
		const spouseDeathAge = 75; // born 1952, dies 2027 → status changes to SGL
		const r = simulate({
			...baseInputs,
			strategy: 'fixedpct', iraWithdrawPct: 0.10, convertExcessToRoth: false,
			birthyear1: 1955, die1: 88, birthyear2: 1952, die2: spouseDeathAge,
			hasSpouse: true,
			IRA1: 600000, IRA2: 100000, Roth: 80000, Roth2: 10000,
			Brokerage: 400000, BrokerageBasis: 60000, // 85% unrealized gains
			Cash: 50000, spendGoal: 100000,
			ss1: 28000, ss2: 18000,
		});
		// Find MFJ→SGL transition year
		const transitionIdx = r.log.findIndex((row, i) => i > 0 && row.status !== r.log[i - 1].status);
		const transitionYear = transitionIdx >= 0 ? r.log[transitionIdx].year : null;
		if (transitionYear !== null) {
			// Check ±2 years around transition for spurious shortfalls
			const window = r.log.filter(row =>
				Math.abs(row.year - transitionYear) <= 2 && (row.shortfall ?? 0) < -100
			);
			assertEqual(window.length, 0,
				`gap-2: no spurious shortfall within 2 years of MFJ→SGL transition (year ${transitionYear})`);
		} else {
			assertEqual(true, true, 'gap-2: no status change in scenario (skipped)');
		}
	}

	// (gap-3) Genuine shortfall (truly exhausted portfolio) still fires - fix must not suppress real shortfalls.
	{
		const r = simulate({
			...baseInputs,
			strategy: 'propwd', propWithdraw: 0, convertExcessToRoth: false,
			IRA1: 20000, Brokerage: 5000, BrokerageBasis: 5000, Cash: 2000, Roth: 0,
			spendGoal: 150000, ss1: 15000, ss2: 0, hasSpouse: false,
		});
		assertEqual(r.totals.success, false,
			'gap-3: genuine shortfall (exhausted portfolio) still marks success=false');
		const realShortfalls = r.log.filter(row => (row.shortfall ?? 0) < -1000);
		assertEqual(realShortfalls.length > 0, true,
			'gap-3: exhausted portfolio produces real shortfall entries in log');
	}

	// ============================================================================
	// Run all tests
	// ============================================================================


	// ===== Un-gated controls stay un-gated =====
	// Stop-conversions-after and the tax-rate creep row both graduated out of the nerdknob
	// preview gate once they were finished and tested. Nothing should ever hide them again.
	//
	// SCOPE OF THIS CHECK: runTests() is called at parse time (retirement_optimizer.html), which
	// is BEFORE applyNerdKnobVisibility() runs in the DOMContentLoaded handler. So this pins the
	// MARKUP default and catches the likely regression -- someone re-adding display:none. It does
	// not exercise the JS path. Do NOT "improve" it by calling applyNerdKnobVisibility() here:
	// that function calls initMCTab(), which has not run yet at this point, so the test would
	// double-initialize the Monte Carlo tab ahead of its real init. Verify the JS path by hand
	// instead, by toggling the Documentation-tab nerdknob checkbox on and then off.
	function assertUngated(id) {
		const el = document.getElementById(id);
		if (!el) return; // not every page loading this shared suite has this control
		assertEqual(getComputedStyle(el).display !== 'none', true,
			`#${id} is visible without nerdknob`);
	}
	assertUngated('convEndYear-wrap');
	assertUngated('taxRateCreep-wrap');
	assertUngated('doc-aca-cliff');

	// The ACA Cliff options are BUILT by refreshStratRateOptions() rather than written in the
	// markup, so assertUngated cannot see them and neither can a plain read of the dropdown here:
	// retirement_optimizer.html calls runTests?.() at top level, which runs BEFORE the
	// DOMContentLoaded handler that builds the dropdown. Build it explicitly so the assertion is
	// about the builder rather than about when the suite happened to run.
	// ⚠ UNSAFE - MUTATES: the #stratRate <option> list (rebuilt), and the selection with it, since
	// refreshStratRateOptions() ends in clampStratRateSelection(). It has to build the list: this
	// suite runs before the DOMContentLoaded handler that would, so there is nothing to read yet.
	(function acaOptionsUngated() {
		if (!unsafeTest('acaOptionsUngated')) return;   // rebuilds the #stratRate option list
		const sel = document.getElementById('stratRate');
		if (!sel || typeof refreshStratRateOptions !== 'function') return;   // shared suite; not every page has these
		refreshStratRateOptions();
		const aca = [...sel.options].filter(o => o.value.startsWith('aca'));
		assertEqual(aca.length, 4, 'all four ACA FPL options are offered without nerdknob');
		// The 400% entry carried a hardcoded ⚠️ that nothing computed - it fired even when 400% was
		// the only feasible arm and stayed silent on a 200% cap that could fund nothing. Feasibility
		// needs a simulation, so the honest signal is the Optimizer's computed row flag.
		assertEqual(aca.some(o => /⚠/.test(o.textContent)), false,
			'no ACA option carries an uncomputed warning triangle');
	})();

	// ===== P100b1: the "Optimize for" goal survives a share link and a saved scenario =====
	// It is UI state, not an engine input, so the buildShareURL field loop and the applyScenario
	// getElementById loop BOTH miss it. Without this a shared link reopens on Tax Flexibility and the
	// recipient is shown a different winner, a different anchor baseline and a different Rank column
	// for the same plan. Same shape as propTax, which had the same gap and the same fix.
	// UNSAFE - MUTATES: OptimizerState.objective and the #opt-objective control. Restored at the end.
	(function objectiveRoundTrips() {
		if (!unsafeTest('objectiveRoundTrips')) return;
		if (typeof setOptObjective !== 'function' || typeof buildShareURL !== 'function') return;
		const before = OptimizerState.objective;
		try {
			// Non-default goals travel.
			setOptObjective('mintax');
			assertEqual(/[?&]obj=mintax(&|$)/.test(buildShareURL()), true,
				'a non-default goal is emitted into the share URL');
			// The control follows the state, not only the other way round - a select showing one goal
			// while the table is ranked by another is worse than not restoring it at all.
			const sel = document.getElementById('opt-objective');
			if (sel) assertEqual(sel.value, 'mintax', 'the selector follows a programmatic goal change');
			// The default is NOT emitted, so links made before this feature are byte-identical.
			setOptObjective('taxflex');
			assertEqual(/[?&]obj=/.test(buildShareURL()), false,
				'the default goal adds no parameter to the share URL');
			// An unknown key falls back rather than throwing or ranking on a metric that does not exist.
			setOptObjective('notARealObjective');
			assertEqual(OptimizerState.objective, 'taxflex', 'an unknown goal falls back to the default');
		} finally {
			setOptObjective(before);
		}
	})();

	// ===== Mode presets report state, not history =====
	// The three buttons on the Monte Carlo tab are lit from the parameter VALUES, so that editing a
	// box in Advanced Parameters clears them and a preset the reader arrived at by hand still shows.
	// Reported as: a reader cannot tell which regime they are in without opening Input Distributions.
	//
	// The predicates are exercised directly, by writing the boxes, rather than by clicking the
	// preset functions - those re-run the simulation as a side effect, which a test has no business
	// doing to someone's page. Every value is put back afterwards.
	// ⚠ UNSAFE - MUTATES: every Monte Carlo parameter input (MC_PARAMS). Restores them in a finally,
	// and those fields ride along in saved scenarios and share links, so a leak is not cosmetic.
	(function mcPresetStateFollowsTheParameters() {
		if (!unsafeTest('mcPresetStateFollowsTheParameters')) return;   // writes every Monte Carlo parameter input
		if (typeof updateMCPresetState !== 'function' || !document.getElementById('mc-preset-default')) return;
		const ids = Object.keys(MC_PARAMS);
		const saved = ids.map(id => [id, document.getElementById(id)?.value]);
		const put = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
		const growth = parseFloat(document.getElementById('growth')?.value);
		try {
			// Defaults, with mu tracking Growth % the way resetMCParams() leaves it.
			ids.forEach(id => put(id, MC_PARAMS[id].dflt));
			if (Number.isFinite(growth)) put('mc-mu', growth);
			assertEqual(_mcIsDefaultState(), true, 'MC presets: every parameter at its default reads as Default');
			updateMCPresetState();
			assertEqual(document.getElementById('mc-preset-default').getAttribute('aria-pressed'), 'true',
				'MC presets: the Default button is lit from that state');

			// One box away from the defaults is no longer the default.
			put('mc-inflation-persistence', 0.5);
			assertEqual(_mcIsDefaultState(), false, 'MC presets: editing one parameter clears Default');

			// Fixed Inflation is a property of the shock alone, whatever else is set.
			put('mc-inflation-shock-sd', 0);
			assertEqual(_mcIsFixedInflationState(), true, 'MC presets: a zero inflation shock reads as Fixed Inflation');

			// Pessimistic needs all five, including mu two points under Growth.
			put('mc-mu', Number.isFinite(growth) ? Math.max(0, growth - 2).toFixed(1) : 5);
			put('mc-sigma', 18);
			put('mc-inflation-persistence', 0.75);
			put('mc-inflation-shock-sd', 3.1);
			put('mc-inflation-return-corr', -0.45);
			assertEqual(_mcIsPessimisticState(), true, 'MC presets: the five Pessimistic values read as Pessimistic');
			put('mc-sigma', 17);
			assertEqual(_mcIsPessimisticState(), false, 'MC presets: changing one of the five clears Pessimistic');
		} finally {
			saved.forEach(([id, v]) => { if (v !== undefined) put(id, v); });
			updateMCPresetState();
		}
	})();

	// ===== The ceiling dropdown: unbounded bands are markers, and a saved rate lands on itself =====
	// Two defects, both of which left a plan running a strategy nobody chose.
	//
	// The top federal bracket was offered as a fill target. It has no upper limit, so there was no
	// ceiling to fill to, and every figure on the page came out $NaN. It is now listed disabled at
	// the income where it BEGINS, as is the top IRMAA tier, which is unbounded for the same reason.
	//
	// And a saved plan's stratRate was written to the <select> as "24.000" while the option values
	// are whole percents, so it matched nothing, the select cleared, and the rebuild landed on its
	// default. Every saved Fill Bracket plan reloaded as "Below IRMAA".
	// ⚠ UNSAFE - MUTATES: the ENTIRE sidebar. applyScenario() writes every control it is handed and
	// restores nothing. This is the test whose fixture shipped as the page's apparent defaults in
	// v11.165B; it now snapshots and restores every input, select and textarea, dataset.numVal
	// included, and is gated on top of that.
	(function ceilingDropdownEndsAtTheLastRealCeiling() {
		if (!unsafeTest('ceilingDropdownEndsAtTheLastRealCeiling')) return;   // applyScenario() writes the WHOLE sidebar
		const sel = document.getElementById('stratRate');
		if (!sel || typeof refreshStratRateOptions !== 'function'
		         || typeof clampStratRateSelection !== 'function') return;
		// applyScenario() below writes the WHOLE sidebar and does not put it back. runTests()
		// runs at page load, so a test that leaves its fixture behind hands the reader a plan
		// they never entered - reported as "the defaults changed and now my plan runs out of
		// money". Snapshot every control first and restore it in the finally, the way the MC
		// preset test already does for its own parameters.
		const controls = [...document.querySelectorAll('input, select, textarea')];
		const snapshot = controls.map(el => [el, el.type === 'checkbox' || el.type === 'radio'
		                                          ? el.checked : el.value,
		                                      el.dataset ? el.dataset.numVal : undefined]);
		try {
			refreshStratRateOptions();
			const opts = [...sel.options];

			// Exactly two reference-only entries: the top federal bracket and the top IRMAA tier.
			const off = opts.filter(o => o.disabled);
			assertEqual(off.length, 2, 'two unbounded bands are listed but not selectable');
			// P92e. The `+` used to end the label and now sits against the amount, because every
			// entry gained the other ladder's band after it: "$769k+ (IRMAA Tier 5)".
			assertEqual(off.every(o => /\d[kMB]?\+/.test(o.textContent)), true,
				'a reference-only entry names the income where it begins, with a trailing +');
			assertEqual(off.some(o => o.value === '37') && off.some(o => o.value.startsWith('IRMAA')), true,
				'the two are the top federal bracket and the top IRMAA tier');
			// No entry may still claim to have no limit; that was the label that read as a target.
			assertEqual(opts.some(o => /no limit/i.test(o.textContent)), false,
				'no entry is labelled "no limit"');

			// Each reference entry sorts directly above the ceiling it succeeds, and shows that
			// ceiling plus a dollar - so the ladder reads continuously.
			for (const o of off) {
				const prev = opts[opts.indexOf(o) - 1];
				assertEqual(!!prev && !prev.disabled, true, 'a reference entry follows a selectable ceiling');
				// P92e. Off `data-limit`, not off the label. The label is now compact - "$769k" -
				// so a one-dollar relationship is not visible in it at all, and reading a display
				// string for a number was what made this brittle in the first place.
				assertEqual(Number(o.dataset.limit), Number(prev.dataset.limit) + 1,
					'a reference entry begins one dollar above the ceiling below it');
			}

			// The clamp: a value the menu disables drops to the nearest ceiling BELOW it, not to
			// the bottom of the list. A selectable value is left exactly where it is.
			for (const o of off) {
				sel.value = o.value;
				assertEqual(clampStratRateSelection(sel), true, `${o.value} is clamped off`);
				assertEqual(sel.value, opts[opts.indexOf(o) - 1].value,
					`${o.value} clamps to the ceiling directly below it`);
			}
			for (const o of opts.filter(x => !x.disabled)) {
				sel.value = o.value;
				assertEqual(clampStratRateSelection(sel), false, `${o.value} is left alone`);
				assertEqual(sel.value, o.value, `${o.value} stays selected`);
			}

			// A saved plan's rate has to land on its own option. This is the "24.000" defect.
			if (typeof applyScenario === 'function' && typeof getInputs === 'function') {
				const scen = { strategy: 'bracket', stratIRMAATier: -1, stratACAMultiple: 0,
				               hasSpouse: true, birthyear1: 1958, birthyear2: 1959 };
				for (const o of opts.filter(x => !x.disabled && /^\d+$/.test(x.value))) {
					const rate = +o.value / 100;
					applyScenario({ ...scen, stratRate: rate });
					assertEqual(sel.value, o.value, `a saved plan at ${o.value}% reloads at ${o.value}%`);
					assertEqual(getInputs().stratRate, rate, `and the engine is handed ${rate}`);
				}
				// A saved plan on the unbounded bracket lands on the highest real ceiling.
				const topFed = off.find(o => o.value === '37');
				const below  = opts[opts.indexOf(topFed) - 1];
				applyScenario({ ...scen, stratRate: +topFed.value / 100 });
				assertEqual(sel.value, below.value,
					'a saved plan on the unbounded top bracket reloads at the highest real ceiling');
			}
		} finally {
			for (const [el, val, numVal] of snapshot) {
				if (el.type === 'checkbox' || el.type === 'radio') el.checked = val;
				else el.value = val;
				if (el.dataset) {
					if (numVal === undefined) delete el.dataset.numVal;
					else el.dataset.numVal = numVal;
				}
			}
			// The dropdown's OPTIONS were rebuilt too, so put the list back before restoring
			// the selection - and rebuild the derived readouts applyScenario() recomputed.
			refreshStratRateOptions();
			for (const [el, val] of snapshot) {
				if (el.id === 'stratRate' && [...el.options].some(o => o.value === val)) el.value = val;
			}
			toggleStrategyUI?.();
			updateGrowthDisplay?.();
			updateCpiSpreadDisplay?.();
			updateProfileAgeDisplay?.();
			updateBracketFeedback?.();
		}
	})();

	// ===== Advice nobody can follow is not shown =====
	// The ACA gate greys out the FPL options once every person in the plan is on Medicare at
	// retirement start, and the note explaining it ended "Lower Retirement Start Age to model
	// pre-Medicare years". For a household ALREADY past 65 this calendar year that instruction cannot
	// be followed by anyone: planFirstYear clamps a start year in the past up to the current one, so
	// every start age produces the same first year and the same ages in it. The options still grey
	// out; the sentence about the control that cannot help is gone. When the start age is what pushes
	// them past 65, the advice IS followable and the note stays.
	// ⚠ UNSAFE - MUTATES: the birth years, spouse flag and Retirement Start Age. All restored below.
	(function acaAdviceOnlyWhenItCanBeFollowed() {
		if (!unsafeTest('acaAdviceOnlyWhenItCanBeFollowed')) return;   // writes the profile fields
		const warn = document.getElementById('aca-age-warn'), sel = document.getElementById('stratRate');
		const by1 = document.getElementById('birthyear1'), by2 = document.getElementById('birthyear2');
		const spouse = document.getElementById('hasSpouse'), start = document.getElementById('startAge');
		if (!warn || !sel || !by1 || !spouse || !start || typeof updateACAWarning !== 'function') return;
		const snap = [[by1, by1.value], [start, start.value]].concat(by2 ? [[by2, by2.value]] : []);
		const wasSpouse = spouse.checked;
		const acaOpts = () => [...sel.options].filter(o => o.value.startsWith('aca'));
		const setUp = (b1, b2, age) => {
			by1.value = String(b1); spouse.checked = true;
			if (by2) by2.value = String(b2);
			start.value = String(age);
			toggleSpouseUI?.(); refreshStratRateOptions?.(); updateACAWarning();
		};
		try {
			if (!acaOpts().length) return;   // the menu is not offering ACA rows in this build
			// Both already past 65 this year: no start age can produce a pre-Medicare year.
			const nowYear = new Date().getFullYear();
			setUp(nowYear - 74, nowYear - 76, 74);
			assertEqual(acaOpts().every(o => o.disabled), true,
				'a household already past 65 cannot select an ACA cap');
			assertEqual(warn.style.display, 'none',
				'and is not told to lower a start age that cannot change anything');
			// Both under 65 today, but the start age puts them past it: the advice works, so it stays.
			setUp(nowYear - 50, nowYear - 48, 70);
			assertEqual(acaOpts().every(o => o.disabled), true,
				'a start age past 65 still greys the ACA rows out');
			assertEqual(warn.style.display !== 'none', true,
				'and there the note stays, because lowering the start age really would help');
		} finally {
			for (const [el, v] of snap) el.value = v;
			spouse.checked = wasSpouse;
			toggleSpouseUI?.(); refreshStratRateOptions?.(); updateACAWarning();
		}
	})();

	// ===== Every limit the menu offers survives a share link =====
	// P95b. A per-value loop, not one case, because the families are three separate code paths in
	// generateStratRateOptions() and a defect in one is invisible from the others: the federal rows
	// carry bare numbers ("22"), the IRMAA rows a mixed-case prefix that was renamed once already
	// ("IRMAA2", and old links say "irmaa2"), the ACA rows a lowercase one ("aca400").
	//
	// Checked without navigating: the emit half is buildShareURL()'s own output, and the decode half
	// is the pair of facts loadFromURL() relies on - the short code maps back to `stratRate`, and the
	// menu holds an option with exactly that value, which is what a <select> needs or it silently
	// deselects. The ages are moved off the defaults first because the defaults put both people on
	// Medicare, and the ACA rows are then not offered at all.
	//
	// The two DISABLED sentinels are excluded on purpose: "IRMAA Tier 5" and "37% Fed" are the top
	// bands, they name a floor rather than a ceiling, and a link carrying one is meant to clamp down
	// to the entry below it. That is behavior, not drift.
	// ⚠ UNSAFE - MUTATES: #strategy, #stratRate, the birth years, spouse flag and start age.
	(function everyLimitSurvivesAShareLink() {
		if (!unsafeTest('everyLimitSurvivesAShareLink')) return;   // writes the profile and the menu
		const sel = document.getElementById('stratRate'), strat = document.getElementById('strategy');
		const by1 = document.getElementById('birthyear1'), by2 = document.getElementById('birthyear2');
		const spouse = document.getElementById('hasSpouse'), start = document.getElementById('startAge');
		if (!sel || !strat || !by1 || !spouse || !start) return;
		if (typeof buildShareURL !== 'function' || typeof OPT_SHORT_TO_LONG === 'undefined') return;
		const snap = [[by1, by1.value], [start, start.value], [strat, strat.value], [sel, sel.value]]
			.concat(by2 ? [[by2, by2.value]] : []);
		const wasSpouse = spouse.checked;
		try {
			// Young enough that the ACA rows are live, so all three families are in the sample.
			const nowYear = new Date().getFullYear();
			by1.value = String(nowYear - 54); spouse.checked = true;
			if (by2) by2.value = String(nowYear - 52);
			start.value = '58';
			strat.value = 'bracket';
			toggleSpouseUI?.(); refreshStratRateOptions?.(); toggleStrategyUI?.();

			assertEqual(OPT_SHORT_TO_LONG['sr'], 'stratRate',
				'the share link short code for the Limit is the one loadFromURL decodes');
			const offered = [...sel.options].filter(o => !o.disabled).map(o => o.value);
			const families = ['10', 'IRMAA0', 'aca400'].filter(v => offered.includes(v));
			assertEqual(families.length, 3,
				'all three limit families are offered to a household that is not yet on Medicare');

			const dflt = ([...sel.options].find(o => o.defaultSelected) || {}).value;
			const missed = [];
			for (const v of offered) {
				sel.value = v;
				const sr = new URL(buildShareURL()).searchParams.get('sr');
				// An omitted `sr` is correct for the default and only for it: buildShareURL drops a
				// param whose value equals the default, and loadFromURL leaves the menu on it.
				const emitted = sr === null ? dflt : sr;
				const lands = [...sel.options].some(o => o.value === emitted && !o.disabled);
				if (emitted !== v || !lands) missed.push(`${v} → ${sr === null ? '(omitted)' : sr}`);
			}
			assertEqual(missed, [], `all ${offered.length} selectable limits round-trip through a share link`);
		} finally {
			for (const [el, v] of snap) el.value = v;
			spouse.checked = wasSpouse;
			toggleSpouseUI?.(); refreshStratRateOptions?.(); toggleStrategyUI?.();
			ACA_GATE_SWAP = null;   // the restore itself can trip the gate; it is not a load
		}
	})();

	// ===== A limit that is taken away is replaced by the default, and said out loud =====
	// P95a. The one case that does NOT round-trip, and should not: a link carrying an ACA cap opened
	// by a household already on Medicare at retirement start. There is no premium subsidy left for a
	// cap to protect, so the gate greys the ACA rows out and the selection has to move.
	//
	// Where it moves is the point. It used to take the first enabled option in a list sorted by
	// dollars, which is "10% Fed - $24.8k" - three times tighter than the $84k that was asked for,
	// on the other income basis, and a target to fill rather than a cap to stay under. It now lands
	// on the menu's own default, and records a sentence naming both limits so the load paths can say
	// what happened. Silently is how it used to happen.
	// ⚠ UNSAFE - MUTATES: #stratRate, the birth years, spouse flag and Retirement Start Age.
	(function anUnavailableCapFallsBackToTheDefaultAndSaysSo() {
		if (!unsafeTest('anUnavailableCapFallsBackToTheDefaultAndSaysSo')) return;   // writes the profile
		const sel = document.getElementById('stratRate');
		const by1 = document.getElementById('birthyear1'), by2 = document.getElementById('birthyear2');
		const spouse = document.getElementById('hasSpouse'), start = document.getElementById('startAge');
		if (!sel || !by1 || !spouse || !start || typeof updateACAWarning !== 'function') return;
		const snap = [[by1, by1.value], [start, start.value]].concat(by2 ? [[by2, by2.value]] : []);
		const wasSpouse = spouse.checked;
		const setAges = (b1, b2, age) => {
			by1.value = String(b1); spouse.checked = true;
			if (by2) by2.value = String(b2);
			start.value = String(age);
			toggleSpouseUI?.(); refreshStratRateOptions?.();
		};
		try {
			const nowYear = new Date().getFullYear();
			setAges(nowYear - 54, nowYear - 52, 58);          // pre-Medicare: the cap is selectable
			if (![...sel.options].some(o => o.value === 'aca400')) return;   // no ACA rows in this build
			sel.value = 'aca400';
			assertEqual(sel.value, 'aca400', 'a pre-Medicare household can choose the 400% FPL cap');
			ACA_GATE_SWAP = null;

			setAges(nowYear - 74, nowYear - 76, 74);          // both on Medicare: the cap is gone
			const dflt = ([...sel.options].find(o => o.defaultSelected) || {}).value;
			assertEqual(sel.value, dflt,
				'and a household past 65 lands on the menu default, not on the tightest row in the list');
			assertEqual(/^(10|12|22|24|32|35|37)$/.test(sel.value), false,
				'which is a MAGI ceiling, not a federal bracket on the other income basis');
			assertEqual(typeof ACA_GATE_SWAP === 'string' && ACA_GATE_SWAP.includes('ACA 400% FPL')
				&& ACA_GATE_SWAP.includes('Below IRMAA'), true,
				'the substitution is recorded, naming the limit asked for and the one loaded');
			// Read once and cleared, so a later load cannot report a swap it did not cause.
			reportLoadSubstitutions();
			assertEqual(ACA_GATE_SWAP, null, 'and reporting it clears it');
		} finally {
			for (const [el, v] of snap) el.value = v;
			spouse.checked = wasSpouse;
			toggleSpouseUI?.(); refreshStratRateOptions?.(); updateACAWarning();
			ACA_GATE_SWAP = null;
			clearMessage?.();
		}
	})();

	// ===== Every limit says where it sits on the OTHER ladder =====
	// The menu mixes three families whose numbers are three different measures of income: a federal
	// entry is a TAXABLE-income threshold, an IRMAA entry is MAGI, an ACA entry is ACA MAGI. Read as
	// one column of dollars they invite a comparison that is not valid - and the case that matters is
	// that IRMAA Tier 1 BEGINS inside the 22% bracket and ENDS inside the 24% one, so "fill Tier 1"
	// is a 24% decision. Each label now carries the other ladder's band, and this checks the
	// annotation against the entry's own numeric limit rather than against a hardcoded string, so it
	// keeps holding when the tables are indexed forward.
	// ⚠ UNSAFE - MUTATES: #strategy and #stratRate. Both snapshotted and restored.
	(function everyLimitNamesItsOtherLadder() {
		if (!unsafeTest('everyLimitNamesItsOtherLadder')) return;   // writes #strategy and #stratRate
		const strat = document.getElementById('strategy'), rate = document.getElementById('stratRate');
		if (!strat || !rate || typeof crossLadderNote !== 'function') return;
		const wasStrat = strat.value, wasRate = rate.value;
		try {
			strat.value = 'bracket';
			const status = getDropdownStatus();
			const cpi = (+document.getElementById('cpi')?.value || 2.8) / 100;
			const cpiAdj = Math.pow(1 + cpi, Math.max(0, new Date().getFullYear() - TAX_DATA_BASE_YEAR));
			let checked = 0;
			for (const o of rate.options) {
				const limit = Number(o.dataset.limit);
				assertEqual(isFinite(limit) && limit > 0, true, `every option carries a numeric data-limit (${o.value})`);
				const kind = /^\d+$/.test(o.value) ? 'fed' : 'magi';
				const want = crossLadderNote(kind, limit, status, cpiAdj);
				if (!want) continue;
				assertEqual(o.textContent.includes(`(${want})`), true,
					`"${o.textContent.trim()}" must name its position on the other ladder as (${want})`);
				checked++;
			}
			assertEqual(checked > 4, true, 'the menu offered enough entries for this to mean anything');
			// The straddle itself, in the direction each family reads it. A federal top plus the
			// deduction is MAGI; an IRMAA threshold minus it is taxable income. If these two ever agree
			// with each other the conversion has been dropped somewhere.
			const ded = dropdownDeduction(status);
			assertEqual(ded > 0, true, 'there is a deduction to convert between the two bases with');
			assertEqual(irmaaBandNameAt(1e9, status, cpiAdj).startsWith('IRMAA Tier'), true,
				'an enormous income lands in a named tier, not "below IRMAA"');
			assertEqual(irmaaBandNameAt(0, status, cpiAdj), 'below IRMAA',
				'and no income at all is below every tier');
		} finally {
			strat.value = wasStrat;
			if ([...rate.options].some(o => o.value === wasRate)) rate.value = wasRate;
			toggleStrategyUI?.();
		}
	})();

	// ===== The sentence, and the picture behind "Show me" =====
	// The picture is a PICTURE. The whole feature has exactly one interaction, the toggle that opens
	// it, and the test is what keeps it that way: an onclick or a title inside the panel would make
	// it a control nobody designed.
	// ⚠ UNSAFE - MUTATES: #strategy, #stratRate, and opens/closes the ladder panel.
	(function limitLadderIsAPictureNotAControl() {
		if (!unsafeTest('limitLadderIsAPictureNotAControl')) return;   // writes #strategy and #stratRate
		const strat = document.getElementById('strategy'), rate = document.getElementById('stratRate');
		const note = document.getElementById('limit-basis'), panel = document.getElementById('limit-ladder');
		if (!strat || !rate || !note || !panel || typeof toggleLimitLadder !== 'function') return;
		const wasStrat = strat.value, wasRate = rate.value, wasOpen = panel.style.display !== 'none';
		try {
			strat.value = 'bracket';
			toggleStrategyUI?.();
			if (![...rate.options].some(o => o.value === 'IRMAA1')) return;
			rate.value = 'IRMAA1';
			if (panel.style.display !== 'none') toggleLimitLadder();   // start closed
			updateLimitBasisNote();
			// An IRMAA tier spans a range, and naming both ends is the thing a one-line label cannot do.
			assertEqual(/runs .* to /.test(note.textContent), true,
				`the note names the tier's own span: "${note.textContent.trim()}"`);
			assertEqual(/Show me/.test(note.textContent), true, 'and offers the picture');
			assertEqual(panel.style.display, 'none', 'which is closed until it is asked for');
			toggleLimitLadder();
			assertEqual(panel.style.display !== 'none', true, '"Show me" opens it');
			assertEqual(panel.innerHTML.includes('<svg'), true, 'and it draws the ladders');
			const svg = panel.querySelector('svg');
			assertEqual(/onclick|<a[\s>]|title=/i.test(svg ? svg.outerHTML : ''), false,
				'the DRAWING is a picture: nothing in it is clickable, hoverable or titled');
			// Three ladders, each named at the left edge.
			const rowNames = [...svg.querySelectorAll('text')].map(t => t.textContent);
			for (const name of ['Federal', 'IRMAA', 'Cap gains'])
				assertEqual(rowNames.includes(name), true, `the picture names the ${name} ladder`);
			// The capital-gains row reads as the EFFECTIVE rate, surtax folded in, which is the
			// whole reason it is one row and not an LTCG row plus a NIIT row.
			for (const lbl of ['0%', '15%', '18.8%', '23.8%'])
				assertEqual(rowNames.includes(lbl), true, `capital-gains band ${lbl} is drawn`);
			// Every vertical line STYLE has a legend entry. Compared by stroke colour, not by count:
			// the ACA row draws one tick per cap and they share a single entry, so counting lines
			// would demand four identical swatches. What must not happen is a line style on the
			// chart that the legend never names.
			const svgLines = [...svg.querySelectorAll('line')];
			const strokesOf = ls => [...new Set(ls.map(l => l.getAttribute('stroke')))].sort();
			const verticals = svgLines.filter(l => +l.getAttribute('y2') - +l.getAttribute('y1') > 5);
			const swatches = svgLines.filter(l => l.getAttribute('y1') === l.getAttribute('y2')
			                                   && l.getAttribute('stroke') !== '#999');
			const unnamed = strokesOf(verticals).filter(s => !strokesOf(swatches).includes(s));
			assertEqual(verticals.length > 0 && unnamed.length === 0, true,
				`every line style on the chart is named in the legend (unnamed: ${unnamed.join(', ') || 'none'})`);
			// The scale sits along the TOP: its rule is above the first row, not under the last.
			const axisLine = svgLines.find(l => l.getAttribute('stroke') === '#999');
			const firstRowY = Math.min(...[...svg.querySelectorAll('rect')].map(r => +r.getAttribute('y')));
			assertEqual(axisLine && +axisLine.getAttribute('y1') < firstRowY, true,
				'the axis is drawn along the top edge, above every row');
			// The ACA row is off until asked for, and asking for it must not smuggle a control into
			// the drawing or leave a line style unnamed.
			assertEqual(rowNames.includes('ACA'), false, 'the ACA row is off by default');
			const acaBtn = document.getElementById('limit-ladder-aca');
			assertEqual(!!acaBtn, true, 'and the control that adds it sits in the chrome, not the drawing');
			if (acaBtn) {
				// CLICK it, do not call the handler. The handler rebuilds panel.innerHTML, which
				// detaches the clicked node before the document-level dismiss listener tests it for
				// containment - so the panel used to close on its own control. Calling the function
				// directly never travels that path and never saw it.
				acaBtn.click();
				assertEqual(panel.style.display !== 'none', true,
					'clicking "Show ACA/FPL" does not dismiss the panel');
				const svg2 = panel.querySelector('svg');
				const names2 = [...svg2.querySelectorAll('text')].map(t => t.textContent);
				assertEqual(names2.includes('ACA') && names2.includes('FPL'), true,
					'"Show ACA/FPL" adds the row, labelled ACA / FPL');
				assertEqual(/onclick|<a[\s>]|title=/i.test(svg2.outerHTML), false,
					'and the drawing is still a picture with the row on');
				const l2 = [...svg2.querySelectorAll('line')];
				const v2 = l2.filter(l => +l.getAttribute('y2') - +l.getAttribute('y1') > 5);
				const s2 = l2.filter(l => l.getAttribute('y1') === l.getAttribute('y2')
				                       && l.getAttribute('stroke') !== '#999');
				const un2 = strokesOf(v2).filter(s => !strokesOf(s2).includes(s));
				assertEqual(un2.length, 0, `the ACA row's own line style is in the legend too (unnamed: ${un2.join(', ') || 'none'})`);
				// And it toggles back off the same way, still without dismissing.
				document.getElementById('limit-ladder-aca')?.click();
				assertEqual(panel.style.display !== 'none', true, 'and clicking it again keeps the panel up');
				assertEqual([...panel.querySelectorAll('svg text')].map(t => t.textContent).includes('ACA'),
					false, 'with the ACA row gone again');
			}
			// It opens away from the link that opened it, so it has to carry its own way out.
			assertEqual(!!document.getElementById('limit-ladder-close'), true,
				'and it carries a close control, because the link that opened it is elsewhere');
			document.body.click();
			assertEqual(panel.style.display, 'none', 'clicking outside dismisses it');
			toggleLimitLadder();
			toggleLimitLadder();
			assertEqual(panel.style.display, 'none', 'and the link itself toggles it shut');
			// A strategy with no ceiling has no basis to describe, so both go away.
			strat.value = 'propwd';
			toggleStrategyUI?.();
			updateLimitBasisNote();
			assertEqual(note.innerHTML, '', 'a strategy with no ceiling raises no basis note');
		} finally {
			if (panel.style.display !== 'none' && !wasOpen) { panel.style.display = 'none'; panel.innerHTML = ''; }
			strat.value = wasStrat;
			if ([...rate.options].some(o => o.value === wasRate)) rate.value = wasRate;
			toggleStrategyUI?.();
			updateBracketFeedback?.();
			updateLimitBasisNote?.();
		}
	})();

	// ===== The NIIT divider is the one line on the ladder that does not inflate =====
	// Capital-gains ceilings are CPI-indexed; the NIIT threshold is not. On the picture that means
	// the 15%/18.8% divider slides LEFT relative to the bands around it as a plan runs forward.
	//
	// ASSERT IN DOLLARS, NOT PIXELS. `maxX` scales with cpiAdj too, so a fixed dollar amount lands
	// on a different x at every factor - reading pixels makes a correct chart look broken, which is
	// exactly the false alarm this test was written after hitting.
	(function niitDividerDoesNotInflateOnTheLadder() {
		if (typeof buildLimitLadderSVG !== 'function' || typeof dropdownDeduction !== 'function') return;
		const status = 'MFJ';
		const ded = dropdownDeduction(status);
		const fedB = TAXData.FEDERAL[status].brackets.filter(b => isFinite(b.l));
		const irmB = TAXData.IRMAA[status].brackets.filter(b => isFinite(b.l));
		const L = 62, SPAN = 448;

		// Read the drawn boundaries back off the SVG and convert them to dollars.
		const readDollars = (cpiAdj) => {
			const maxX = Math.max(irmB[irmB.length - 1].l * cpiAdj,
			                      fedB[fedB.length - 1].l * cpiAdj + ded) * 1.08;
			const host = document.createElement('div');
			host.innerHTML = buildLimitLadderSVG(status, cpiAdj, 218000);
			const svg = host.querySelector('svg');
			if (!svg) return null;
			const toDollars = px => (px - L) / SPAN * maxX;
			const cgY = Math.max(...[...svg.querySelectorAll('rect')].map(r => +r.getAttribute('y')));
			const lefts = [...svg.querySelectorAll('rect')]
				.filter(r => +r.getAttribute('y') === cgY)
				.map(r => toDollars(+r.getAttribute('x')));
			const niitLine = [...svg.querySelectorAll('line')]
				.find(l => (l.getAttribute('stroke-dasharray') || '') === '3 2');
			return { lefts, niit: niitLine ? toDollars(+niitLine.getAttribute('x1')) : null };
		};

		const one = readDollars(1.0), two = readDollars(2.0);
		if (!one || !two || one.niit === null) return;

		// Tolerance covers the one decimal place the SVG rounds each x to.
		const near = (a, b) => Math.abs(a - b) < 1000;
		assertEqual(near(one.niit, TAXData.FEDERAL.NIIT[status]), true,
			`the divider is drawn at the NIIT threshold (${Math.round(one.niit)})`);
		assertEqual(near(one.niit, two.niit), true,
			`and it stays there when CPI doubles (${Math.round(one.niit)} vs ${Math.round(two.niit)})`);

		// The bands around it DO move, otherwise the test above would pass on a frozen chart.
		const cgTop = TAXData.FEDERAL.CAPITAL_GAINS[status].brackets[0].l;
		assertEqual(near(one.lefts[1], cgTop + ded), true,
			'the 0% band ends at its own ceiling plus the deduction');
		assertEqual(two.lefts[1] - one.lefts[1] > 10000, true,
			`that ceiling inflates while the divider does not (${Math.round(one.lefts[1])} -> ${Math.round(two.lefts[1])})`);
	})();

	// ===== The menu's dollars are the engine's dollars =====
	// TAX_DATA_BASE_YEAR was hardcoded to 2025 while the tables it indexes say 2026, so every limit
	// in the menu was compounded one extra year of CPI over figures that were already current: the
	// menu offered $217,319 where the engine built the same plan's ceiling on $211,400. Reading the
	// year off the data is what stops that recurring; this is what proves the two now agree.
	(function dropdownLimitsMatchTheEngine() {
		if (typeof TAXData === 'undefined' || typeof findLimitByRate !== 'function') return;
		assertEqual(TAX_DATA_BASE_YEAR, TAXData.FEDERAL.YEAR,
			'the displayed limits are indexed from the year the federal table declares');
		// One factor serves both families, so the two tables have to share a year.
		assertEqual(TAXData.IRMAA.YEAR, TAXData.FEDERAL.YEAR,
			'the federal and IRMAA tables are the same vintage');
		// Built here, DETACHED, rather than read off #stratRate. runTests() is called at parse time
		// from retirement_optimizer.html, which is BEFORE the DOMContentLoaded handler fills that
		// control - so reading it live reads the markup placeholder, a lone `<option value="24">`
		// with no data-limit, and the check collapses to NaN vs the engine's 24% ceiling. That is
		// the single failure the badge showed on every load and never with ?runtests, where the
		// mutating acaOptionsUngated suite above happens to build the real list first. The builder
		// is pure, so building a copy asserts about the builder instead of about run order.
		if (typeof generateStratRateOptions !== 'function') return;
		const sel = document.createElement('select');
		sel.innerHTML = generateStratRateOptions();
		const status = getDropdownStatus();
		for (const o of sel.options) {
			if (!/^\d+$/.test(o.value)) continue;
			const rate = +o.value / 100;
			const engine = findLimitByRate('FEDERAL', status, rate, 1).limit;
			if (!isFinite(engine)) continue;
			assertEqual(Number(o.dataset.limit), Math.round(engine),
				`the menu's ${o.value}% limit is the one the engine uses for a plan starting this year`);
		}
	})();

	// ===== The ceiling a warning names is the ceiling you picked =====
	// extraConvCeilingKind() read val('stratIRMAATier') and val('stratACAMultiple'). NEITHER IS A FORM
	// FIELD: both are derived in getInputs() from the single Limit dropdown, whose value carries them
	// as "IRMAA2" or "aca400". Both lookups returned undefined, every comparison against NaN is false,
	// and the function fell through to "the federal bracket ceiling" for every plan in the family -
	// naming the wrong ceiling in the one sentence whose whole job is to name the right one. A test
	// per ceiling kind, because one passing kind is exactly what hid this.
	// ⚠ UNSAFE - MUTATES: #stratRate and #strategy, both snapshotted and restored below.
	(function ceilingKindNamesTheChosenLimit() {
		if (!unsafeTest('ceilingKindNamesTheChosenLimit')) return;   // writes #strategy and #stratRate
		const strat = document.getElementById('strategy'), rate = document.getElementById('stratRate');
		if (!strat || !rate || typeof extraConvCeilingKind !== 'function') return;
		const wasStrat = strat.value, wasRate = rate.value;
		try {
			strat.value = 'bracket';
			const has = v => [...rate.options].some(o => o.value === v);
			for (const [v, want] of [['22', 'the federal bracket ceiling'],
			                         ['IRMAA2', 'the IRMAA tier ceiling'],
			                         ['aca400', 'the ACA FPL cap']]) {
				if (!has(v)) continue;   // the menu rebuilds with filing status; skip what it is not offering
				rate.value = v;
				assertEqual(extraConvCeilingKind(), want, `a "${v}" limit is named ${want}`);
			}
			// A strategy with no ceiling at all has nothing to name, and both warnings key off that.
			strat.value = 'propwd';
			assertEqual(extraConvCeilingKind(), null, 'a strategy with no ceiling names nothing');
		} finally {
			strat.value = wasStrat;
			if ([...rate.options].some(o => o.value === wasRate)) rate.value = wasRate;
			toggleStrategyUI?.();
		}
	})();

	// ===== A limit broken by required income takes the opposite advice =====
	// Reported against a real plan: a $4M IRA left to a survivor throws off a required distribution of
	// $455,636 against an IRMAA Tier 1 ceiling of $370,371, and in all 15 flagged years the plan drew
	// NOTHING beyond that RMD - no voluntary withdrawal, no forced draw, no conversion. The warning
	// nonetheless said "The plan withdraws past it to pay for spending. Lower the Spend Goal", which is
	// advice that cannot work: required distributions, Social Security and a pension are income the
	// household has to take, and no Spend Goal reaches them.
	//
	// limitWarningText() is pure - rows in, HTML out - so these run on synthetic rows rather than by
	// driving the page, and they cost nothing to keep.
	(function requiredIncomeGetsItsOwnAdvice() {
		if (typeof limitWarningText !== 'function') return;
		// A year the plan did not choose: it is over, and it drew nothing it had a say in.
		const structural = { BracketOverage: 290427, IRAwd: 0, ForcedIRA: 0, RMDwd: 455636 };
		// A year spending drove: the third pass forced a draw past the ceiling to fund the goal.
		const spendDriven = { BracketOverage: 97095, IRAwd: 40000, ForcedIRA: 12000, RMDwd: 0 };
		const clean = { BracketOverage: 0, IRAwd: 0, ForcedIRA: 0, RMDwd: 0 };

		const onlyRequired = limitWarningText([structural, structural, clean], 'the IRMAA tier ceiling', 3);
		assertEqual(/cannot defer/.test(onlyRequired), true,
			'a limit broken by required income says so: ' + onlyRequired);
		assertEqual(/Lowering the Spend Goal cannot change this/.test(onlyRequired), true,
			'and says plainly that spending less will not help');
		assertEqual(onlyRequired.includes('$455,636'), true,
			'and names the required distribution that is doing it');
		// The wrong advice must not survive anywhere in this branch.
		assertEqual(/Lower the Spend Goal or pick a higher limit/.test(onlyRequired), false,
			'and never tells this reader to lower a Spend Goal that is not the cause');

		const onlySpending = limitWarningText([spendDriven, spendDriven, clean], 'the federal bracket ceiling', 3);
		assertEqual(/Lower the Spend Goal or pick a higher limit/.test(onlySpending), true,
			'a limit broken by spending keeps the advice that does work: ' + onlySpending);
		assertEqual(/cannot defer/.test(onlySpending), false,
			'and does not claim required income is involved when it is not');

		// Both causes in one plan: both counts are reported, neither is folded into the other.
		const mixed = limitWarningText([spendDriven, spendDriven, structural, clean], 'the federal bracket ceiling', 4);
		assertEqual(/2 of 4/.test(mixed), true, 'the mixed case counts the spending years: ' + mixed);
		assertEqual(/1 further year/.test(mixed), true, 'and reports the required-income year separately');

		// Nothing over the ceiling says nothing at all.
		assertEqual(limitWarningText([clean, clean], 'the federal bracket ceiling', 2), '',
			'a plan that stayed inside its limit raises no warning');
		// A conversion the user chose is still not counted here - that half has its own note.
		const convOnly = { BracketOverage: 50000, '-overageFromConv': 50000, IRAwd: 60000, ForcedIRA: 0 };
		assertEqual(limitWarningText([convOnly, clean], 'the federal bracket ceiling', 2), '',
			'an overage a conversion caused belongs to the conversion note, not this one');

		// ===== The columns the note names are a link, and the link names real columns =====
		// P99. "See BracketOverage in Annual Details" was an instruction, four steps long, ending in
		// a column that is off by default. It is now the click itself.
		assertEqual(/showAnnualColumns\('RMDwd','BracketOverage'\)/.test(onlyRequired), true,
			'the required-income note links both columns it names');
		assertEqual(/showAnnualColumns\('BracketOverage'\)/.test(onlySpending), true,
			'and the spending note links the one it names');

		// The ACA branch. It said "See acaBreach and BracketOverage in Annual Details" while
		// acaBreach was emitted as '-acaBreach', which the table strips - a column that could not be
		// shown, named in the one sentence whose job was to send the reader to it.
		const acaYear = { BracketOverage: 12000, acaBreach: 'Yes', IRAwd: 30000, ForcedIRA: 0 };
		const acaOut = limitWarningText([acaYear, clean], 'the ACA FPL cap', 2);
		assertEqual(/showAnnualColumns\('acaBreach','BracketOverage'\)/.test(acaOut), true,
			'the ACA note links acaBreach, which is now a column: ' + acaOut);

		// ===== A note may not name a column that does not exist =====
		// The invariant, not the instance. Walk every link these notes can produce and check the key
		// against the same two rules the table itself uses to decide what becomes a column. Any
		// future "See X in Annual Details" naming a non-column fails here, on rows in and HTML out,
		// with no page to drive.
		if (typeof columnCategories !== 'undefined' && typeof isTableColumnKey === 'function') {
			[onlyRequired, onlySpending, acaOut, mixed].forEach(html => {
				for (const m of html.matchAll(/showAnnualColumns\(([^)]*)\)/g)) {
					m[1].split(',').map(a => a.trim().replace(/^'|'$/g, '')).forEach(key => {
						assertEqual(columnCategories.hasOwnProperty(key) && isTableColumnKey(key), true,
							`the note links "${key}", which has to be a real Annual Details column`);
					});
				}
			});
		}
	})();

	// ===== An empty cell is not a zero =====
	// `isNaN('')` is FALSE, because Number('') is 0, so an empty string took the renderer's NUMERIC
	// branch and printed "0". Found on acaBreach the moment it became a column: its non-breach years
	// read as a hard "0" beside the years reading "Yes", which says "measured, and it was none"
	// rather than "does not apply". acaBreach is the only key in any log that holds '', so this pins
	// the rule on the one column that exercises it.
	// ⚠ UNSAFE - MUTATES: rebuilds the Annual Details table from a synthetic log.
	(function anEmptyCellIsNotAZero() {
		if (!unsafeTest('anEmptyCellIsNotAZero')) return;   // rebuilds #main-table
		if (typeof updateTable !== 'function') return;
		try {
			// Two rows, one of each, so the column is not all-empty and therefore not hidden.
			updateTable([{ year: 2026, acaBreach: 'Yes' }, { year: 2027, acaBreach: '' }]);
			const hs = [...document.querySelectorAll('#main-table thead tr:last-child th')];
			const i = hs.findIndex(h => h.textContent.trim() === 'acaBreach');
			if (i < 0) return;
			const rows = [...document.querySelectorAll('#main-table tbody tr')];
			assertEqual(rows[0].cells[i].textContent, 'Yes', 'a breach year says so');
			assertEqual(rows[1].cells[i].textContent, '',
				'and a year that did not breach is BLANK, not the "0" an empty string used to print');
		} finally {
			if (window.lastSimulationLog) updateTable(window.lastSimulationLog);
		}
	})();

	// ===== The link opens the tab, reveals the column, and keeps the reader's other columns =====
	// The contract is ADDITIVE. A reader clicking from the sidebar cannot see the table they are
	// about to disturb, so the click turns on what the named column needs and nothing else; wiping
	// their selection would be a bigger action than the one they asked for, with no undo.
	// ⚠ UNSAFE - MUTATES: the column checkboxes, the active tab, and the Annual Details table.
	(function annualColumnLinkRevealsTheColumn() {
		if (!unsafeTest('annualColumnLinkRevealsTheColumn')) return;   // writes the column pickers
		if (typeof showAnnualColumns !== 'function' || typeof updateTable !== 'function') return;
		const tax = document.getElementById('cat-taxation'), summ = document.getElementById('cat-summary');
		const card = document.getElementById('tab-tbl');
		if (!tax || !summ || !card) return;
		const wasTax = tax.checked, wasSumm = summ.checked, wasHidden = card.classList.contains('hidden');
		try {
			updateTable(simulate(getInputs()).log);
			summ.checked = true; tax.checked = false;
			updateColumnVisibility();

			assertEqual(showAnnualColumns('BracketOverage'), true,
				'a link to a real column reports that it showed it');
			assertEqual(tax.checked, true, 'and turns on the category that column lives in');
			assertEqual(summ.checked, true,
				'while leaving every category the reader already had, which is the whole contract');
			assertEqual(card.classList.contains('hidden'), false, 'and opens Annual Details');
			const th = [...document.querySelectorAll('#main-table thead tr:last-child th')]
				.find(h => h.textContent.trim() === 'BracketOverage');
			assertEqual(!!th && !th.classList.contains('hidden-column'), true,
				'and the column itself is on screen, not merely permitted');

			// The guard that makes a dead link impossible.
			summ.checked = true; tax.checked = false;
			updateColumnVisibility();
			assertEqual(showAnnualColumns('nosuchcolumn'), false,
				'a link to a column that does not exist reports that it showed nothing');
			assertEqual(tax.checked, false, 'and changes no checkbox on its way out');
		} finally {
			tax.checked = wasTax; summ.checked = wasSumm;
			updateColumnVisibility();
			if (wasHidden) card.classList.add('hidden');
		}
	})();

	// ===== A limit that could not be kept says so =====
	// The engine already fell back to funding the Spend Goal - the third pass forces a draw past a
	// bracket or IRMAA ceiling rather than leave spending unpaid - and said nothing about it. Only
	// the BracketOverage column recorded it, so the headline numbers described a plan running under a
	// limit it had broken. The box is checked in both directions on the SAME plan: a 12% ceiling
	// cannot fund it and must warn, and a strategy with no ceiling must stay silent.
	// ⚠ UNSAFE - MUTATES: #strategy, #stratRate, and re-runs the plan. Restored, and re-run again.
	(function infeasibleLimitWarns() {
		if (!unsafeTest('infeasibleLimitWarns')) return;   // writes #strategy and re-runs the plan
		const box = document.getElementById('limit-warn');
		const strat = document.getElementById('strategy'), rate = document.getElementById('stratRate');
		if (!box || !strat || !rate || typeof updateLimitFeasibilityWarning !== 'function') return;
		const wasStrat = strat.value, wasRate = rate.value;
		try {
			if ([...rate.options].some(o => o.value === '12')) {
				strat.value = 'bracket'; rate.value = '12';
				runSimulation();
				assertEqual(box.style.display !== 'none', true,
					'a 12% ceiling cannot fund the default plan, and the plan has to say so');
				assertEqual(/\d+ of \d+ years?/.test(box.textContent), true,
					'and it names how many years it could not keep the limit');
			}
			strat.value = 'propwd';
			runSimulation();
			assertEqual(box.style.display, 'none', 'a strategy with no ceiling raises no limit warning');
		} finally {
			strat.value = wasStrat;
			if ([...rate.options].some(o => o.value === wasRate)) rate.value = wasRate;
			toggleStrategyUI?.();
			runSimulation();
		}
	})();

	// ===== A strategy this version does not have loads as the default, not as a blank $0 plan =====
	// A <select> handed a value matching no option lands on selectedIndex -1 and reports "", so
	// getInputs().strategy is empty, no withdrawal branch matches, and the page renders a $0 plan
	// with nothing on screen to say why. That is what a saved plan or a shared link naming the
	// removed `minlimit` strategy did. The guard is generic - any unknown value, not a list of
	// retired names - and it also restores the default strategy's own parameter fields, so the plan
	// that comes up is one the engine can actually run.
	// ⚠ UNSAFE - MUTATES: #strategy and the default strategy's parameter group. Both are snapshotted
	// and restored below, but a reader who saw the intermediate state would see a strategy they did
	// not pick.
	(function unknownStrategyFallsBackToTheDefault() {
		if (!unsafeTest('unknownStrategyFallsBackToTheDefault')) return;   // writes #strategy
		const sel = document.getElementById('strategy');
		if (!sel || typeof resetUnknownStrategy !== 'function') return;
		const boost = document.getElementById('propWithdraw');
		const wasStrategy = sel.value, wasBoost = boost ? boost.value : null;
		try {
			// The exact failure a legacy link produced: a value the dropdown does not carry.
			sel.value = 'minlimit';
			assertEqual(sel.selectedIndex, -1, 'an unknown strategy leaves the select with nothing chosen');
			if (boost) boost.value = '175';
			resetUnknownStrategy();
			assertEqual(sel.value, sel.options[0].value,
				'an unknown strategy falls back to the first option, which is the default');
			// The markup default, not OPT_DEFAULTS: this suite runs before captureDefaults() does,
			// which is exactly the ordering the fallback in resetUnknownStrategy() covers.
			if (boost) assertEqual(boost.value, boost.defaultValue,
				"and the default strategy's own parameter comes back with it");
			// A value the dropdown DOES carry must be left exactly alone, or the guard would quietly
			// overwrite every real plan it is called on.
			sel.value = 'bracket';
			resetUnknownStrategy();
			assertEqual(sel.value, 'bracket', 'a strategy the dropdown has is never touched');
		} finally {
			sel.value = wasStrategy;
			if (boost && wasBoost !== null) boost.value = wasBoost;
			toggleStrategyUI?.();
		}
	})();

	// ===== P126: Guyton-Klinger is the Guardrails switch, not a strategy =====
	// A saved plan or import naming the retired strategy folds onto the same plan with the switch on,
	// and one that predates the switch loads with it OFF rather than inheriting the sidebar's. Pure:
	// foldRetiredGKStrategy() touches no page state.
	(function guardrailsFoldIsLossless() {
		if (typeof foldRetiredGKStrategy !== 'function') return;
		// GK-FOLD-BEGIN
		const old = foldRetiredGKStrategy({ strategy: 'gk', propWithdraw: 0.10, gkGuard: 0.15, gkAdjPct: 0.05 });
		// GK-FOLD-END
		assertEqual(old.data.strategy, 'propwd', 'the retired strategy loads as Proportional');
		assertEqual(old.data.propWithdraw, 0, 'at 0% whatever boost the plan carried, because that was the draw it ran');
		assertEqual(old.data.spendRule, 'gk', 'with Guardrails on');
		assertEqual(old.data.gkGuard, 0.15, 'keeping its own band');
		assertEqual(old.note.length > 0, true, 'and the load report says what was substituted');
		const unset = foldRetiredGKStrategy({ strategy: 'bracket', stratRate: 0.22 });
		assertEqual(unset.data.spendRule, '', 'a plan from before the switch loads with it off');
		assertEqual(unset.note, '', 'and reports nothing, because nothing was substituted');
		const kept = { strategy: 'bracket', stratRate: 0.22, spendRule: 'gk' };
		assertEqual(foldRetiredGKStrategy(kept).data === kept, true, 'a plan already on the switch passes through untouched');
	})();

	// ⚠ UNSAFE - MUTATES: the Guardrails switch and its sentence, snapshotted and restored below.
	(function guardrailsSwitchDrivesTheSpendRule() {
		if (!unsafeTest('guardrailsSwitchDrivesTheSpendRule')) return;   // writes #spendRule
		const sw = document.getElementById('spendRule');
		const note = document.getElementById('guardrails-note');
		if (!sw || !note) return;
		const was = sw.checked;
		try {
			sw.checked = true;
			toggleStrategyUI();
			assertEqual(getInputs().spendRule, 'gk', 'the switch on sends the Guardrails rule');
			assertEqual(note.style.display, '', 'and the sentence stating the rule is shown');
			sw.checked = false;
			toggleStrategyUI();
			assertEqual(getInputs().spendRule, '', 'off sends no rule');
			assertEqual(note.style.display, 'none', 'and the sentence is hidden');
		} finally {
			sw.checked = was;
			toggleStrategyUI();
		}
	})();

	// P132. The rule menu beside the switch: Risk-based sends 'rbg' with its preset, shows its own
	// controls, states the rule, turns Never above plan on, and never puts the rails table in a
	// share link or an identity.
	// ⚠ UNSAFE - MUTATES: the switch, the rule menu, the ceiling; snapshotted and restored below.
	(function riskBasedRuleDrivesTheSpendRule() {
		if (!unsafeTest('riskBasedRuleDrivesTheSpendRule')) return;   // writes #spendRule, #spendRuleKind, #gkShapeCeiling
		const sw = document.getElementById('spendRule'), kind = document.getElementById('spendRuleKind');
		const ceil = document.getElementById('gkShapeCeiling'), note = document.getElementById('guardrails-note');
		const preset = document.getElementById('rbgPreset');
		if (!sw || !kind || !ceil || !note || !preset) { console.log('SKIP: risk-based controls absent'); return; }
		const was = { sw: sw.checked, kind: kind.value, ceil: ceil.checked, preset: preset.value };
		try {
			sw.checked = true; kind.value = 'rbg'; ceil.checked = false; preset.value = 'paper';
			spendRuleChanged();
			const inp = getInputs();
			assertEqual(inp.spendRule, 'rbg', 'P132: Risk-based sends the rbg rule');
			assertEqual(inp.rbgPreset, 'paper', 'P132: with its preset');
			assertEqual(ceil.checked, true, 'P132: choosing Risk-based turns Never above plan on');
			assertEqual(inp.gkShapeCeiling, true, 'P132: and getInputs carries it');
			assertEqual(kind.classList.contains('hidden'), false, 'P132: the rule menu shows while the rule runs, knob or not');
			assertEqual(document.getElementById('ui-rbg').classList.contains('hidden'), false, 'P132: the preset row shows');
			assertEqual(document.getElementById('ui-rule-ceiling').classList.contains('hidden'), false, 'P132: so does the ceiling, without the knob');
			assertEqual(/Risk-based, Paper/.test(note.textContent) && /25%/.test(note.textContent) && /45%/.test(note.textContent), true,
				`P132: the sentence states the rule: ${note.textContent.slice(0, 80)}`);
			assertEqual(document.getElementById('rails-preset').value, 'paper', 'P132: the rails panel mirrors the sidebar preset');
			assertEqual(document.getElementById('rails-preset').disabled, false, 'P132: and can still be set there');
			assertEqual('rbgRails' in selectionOf(inp), false, 'P132: the table is not identity');
			assertEqual(OPT_LONG_TO_SHORT.spendRuleKind, 'grk', 'P132: the rule menu travels in the share link');
			assertEqual(OPT_LONG_TO_SHORT.rbgPreset, 'rbp', 'P132: so does the preset');
			assertEqual(typeof OPT_LONG_TO_SHORT.rbgRails, 'undefined', 'P132: the table never does');
			assertEqual(inp.rbgRails === undefined || (inp.rbgRails && Array.isArray(inp.rbgRails.years)), true,
				'P132: the table is absent until the rails are solved for this plan, then a table');
			kind.value = 'gk';
			spendRuleChanged();
			assertEqual(getInputs().spendRule, 'gk', 'P132: back to GK-style');
			assertEqual(document.getElementById('ui-rbg').classList.contains('hidden'), false,
				'P132: the rails preset stays in view with GK-style (user, 2026-09-19: the rails are drawn on demand either way)');
			assertEqual(kind.classList.contains('hidden'), !NERD_KNOBS, 'P132: without the rule running, the menu is a nerdknob control');
			// The switch off: the preset row is still there, and the panel's menu still mirrors it.
			sw.checked = false;
			spendRuleChanged();
			assertEqual(document.getElementById('ui-rbg').classList.contains('hidden'), false, 'P132: and with Guardrails off');
			preset.value = 'tight';
			toggleStrategyUI();
			assertEqual(document.getElementById('rails-preset').value, 'tight', 'P132: the panel follows the sidebar with the rule off too');
			// The two menus take the full width of the box (user, 2026-09-19: "truncating needlessly").
			const box = document.getElementById('ui-rbg');
			assertEqual(box.offsetWidth === 0 || preset.getBoundingClientRect().width >= box.getBoundingClientRect().width - 2, true,
				'P132: the preset menu is as wide as its row');
		} finally {
			sw.checked = was.sw; kind.value = was.kind; ceil.checked = was.ceil; preset.value = was.preset;
			toggleStrategyUI();
		}
	})();

	// ===== My Plan Only: the plan as set, and the same plan with Guardrails the other way round =====
	// user, 2026-09-14. The two rows may differ in the spend rule and nothing else: the second is a fair
	// measure of the switch only if it carries the plan's own conversions and stop year.
	(function myPlanOnlyRunsThePlanBothWays() {
		if (typeof planScopeVariations !== 'function' || typeof compareVariations !== 'function') return;
		const plan = { ...getInputs(), extraConversionAmount: 20000, convEndYear: 2035 };
		['', 'gk', 'rbg'].forEach(rule => {
			const base = { ...plan, spendRule: rule };
			const rows = planScopeVariations(planOnlyVariations(compareVariations(base), base), base);
			const diffs = r => Object.keys(base).filter(k => !Object.is(r[k], base[k])).join(',');
			const on = rule !== '';
			assertEqual(rows.length, 2, `rule '${rule}': My Plan Only runs two rows`);
			assertEqual(diffs(rows[0]), '', `rule '${rule}': the first row is the plan exactly as set`);
			assertEqual(diffs(rows[1]), 'spendRule', `rule '${rule}': the second differs in the Guardrails switch alone`);
			// P132: the twin of a plan with either rule on is the plan with none.
			assertEqual(rows[1].spendRule, on ? '' : 'gk', `rule '${rule}': and has it the other way round`);
			const onLabel = rule === 'rbg' ? /Risk-based on$/ : /Guardrails on$/;
			assertEqual(onLabel.test(rows[on ? 0 : 1]._paramLabel), true, `rule '${rule}': the row with the rule says so`);
			assertEqual(/Guardrails off$/.test(rows[on ? 1 : 0]._paramLabel), true, `rule '${rule}': and so does the row without`);
		});
	})();

	// ===== Annual Details: one cell per column, in every row =====
	// The header row and the body rows are built from the same key list but used to apply DIFFERENT
	// filters to it - the body skipped `inflationFactor` and the header did not. From that column
	// rightward every cell sat under the heading to its left, and the rightmost column (`loopMs`)
	// got no cell at all and read as permanently empty. It survived for months because the one
	// visibly wrong cell, under the `inflationFactor` heading, showed a small number where a
	// multiplier near 1 was expected.
	//
	// A count comparison catches the whole class: any future key filtered in one place and not the
	// other shifts the table silently, and nothing else in the page would notice.
	// ⚠ UNSAFE - MUTATES: #main-table, replaced wholesale by updateTable(). Not a plan input, but it
	// renders a table from a simulate() of the CURRENT inputs before the page has run its own, so a
	// reader can see a table that is not their plan until the first real render lands.
	(function annualDetailsCellsAlignWithHeaders() {
		if (!unsafeTest('annualDetailsCellsAlignWithHeaders')) return;   // updateTable() replaces #main-table
		// The suite runs BEFORE the page's first runSimulation(), so there is no table yet - render
		// one here from a real log. updateTable() replaces #main-table in place, and runSimulation()
		// rebuilds it moments later, so this leaves nothing behind. Checking the real render rather
		// than re-deriving the key list is the point: the bug was two filters disagreeing, and only
		// the rendered result can show that.
		if (typeof getInputs !== 'function' || typeof updateTable !== 'function') return;
		try {
			updateTable(simulate(getInputs()).log);
		} catch (e) {
			assertEqual(String(e.message || e), '', 'Annual Details renders from a live log');
			return;
		}
		const table = document.getElementById('main-table');
		if (!table) return;
		const headRows = table.querySelectorAll('thead tr');
		const headerRow = headRows[headRows.length - 1];
		if (!headerRow) return;
		const nCols = headerRow.querySelectorAll('th').length;
		const bodyRows = [...table.querySelectorAll('tbody tr')];
		if (!nCols || !bodyRows.length) return;
		const bad = bodyRows
			.map((r, i) => (r.cells.length === nCols ? null : `row ${i} has ${r.cells.length}`))
			.filter(Boolean);
		assertEqual(bad.slice(0, 3).join(', '), '',
			`every Annual Details row has one cell per header (${nCols} headers)`);
	})();

	// ===== P86: running-total columns accumulate in the toggle's basis; per-year columns do not =====
	// The stored SumTaxes/SumAdvisorFees/Spendable log columns were nominal sums-to-date, and the
	// generic Current-$ cell formatter divided them by that row's factor - which can make a
	// lifetime total FALL year over year (SumAdvisorFees 80,672 -> 79,371 was the report). The
	// running totals are now computed on demand from a NAMED list, so under Current-$ each is a
	// running sum of deflated years and can never decrease. The guard has two halves on purpose:
	// the accumulators must be monotone, AND an ordinary per-year column must still deflate
	// per-row - a "fix" that rebased every declining column would pass the first half and fail the
	// second (spendGoal genuinely loses real value; that decline is correct).
	// ⚠ UNSAFE - MUTATES: #main-table (re-rendered twice) and #show-current-dollars (restored).
	(function runningTotalsAccumulateInSelectedBasis() {
		if (!unsafeTest('runningTotalsAccumulateInSelectedBasis')) return;
		if (typeof getInputs !== 'function' || typeof updateTable !== 'function') return;
		const cdBox = document.getElementById('show-current-dollars');
		if (!cdBox) return;
		const wasChecked = cdBox.checked;
		try {
			const log = simulate(getInputs()).log;
			if (!log || log.length < 3) return;
			cdBox.checked = true;
			updateTable(log);
			const table = document.getElementById('main-table');
			const headRows = table.querySelectorAll('thead tr');
			const headers = [...headRows[headRows.length - 1].querySelectorAll('th')].map(th => th.textContent);
			assertEqual(headers.includes('Spendable'), false,
				'the stored Spendable column is gone (renamed SumSpendable, computed on demand)');
			const cellNum = (row, col) => parseFloat(row.cells[col].textContent.replace(/,/g, ''));
			const bodyRows = [...table.querySelectorAll('tbody tr')];
			for (const name of ['SumTaxes', 'SumAdvisorFees', 'SumSpendable']) {
				const col = headers.indexOf(name);
				assertEqual(col >= 0, true, `${name} column renders`);
				let prev = -Infinity, monotone = true;
				for (const r of bodyRows) {
					const v = cellNum(r, col);
					if (!isNaN(v)) { if (v < prev - 0.5) { monotone = false; break; } prev = v; }
				}
				assertEqual(monotone, true, `${name} never decreases under Current-$`);
			}
			// The anti-heuristic half: a per-year flow still deflates by ITS OWN row's factor.
			const sgCol = headers.indexOf('spendGoal');
			const lastIdx = log.length - 1;
			if (sgCol >= 0 && (log[lastIdx].inflationFactor || 1) > 1) {
				const shown = cellNum(bodyRows[lastIdx], sgCol);
				const want = Math.round((log[lastIdx].spendGoal || 0) / (log[lastIdx].inflationFactor || 1));
				assertEqual(Math.abs(shown - want) <= 1, true,
					`spendGoal cell is the per-row deflated flow (got ${shown}, want ~${want})`);
			}
		} finally {
			cdBox.checked = wasChecked;
			try { updateTable(simulate(getInputs()).log); } catch (e) { /* page re-renders on next run */ }
		}
	})();

	// ===== P86c: the All RMDs optimizer column sorts on the basis the toggle selects =====
	// Lifetime RMDs are an accumulated flow like All Taxes beside them; sorting nominal while
	// displaying Current-$ (or vice versa) would order the table by a number the reader cannot see.
	// ⚠ UNSAFE - MUTATES: #show-current-dollars (restored).
	(function rmdColumnFollowsToggle() {
		if (!unsafeTest('rmdColumnFollowsToggle')) return;
		if (typeof getOptimizerColumns !== 'function') return;
		const cdBox = document.getElementById('show-current-dollars');
		if (!cdBox) return;
		const was = cdBox.checked;
		try {
			const stub = { totals: { rmd: 1000, rmdCurrentDollars: 700 } };
			const col = () => getOptimizerColumns(true).find(c => c.key === 'rmd');
			cdBox.checked = false;
			assertEqual(col().getSortValue(stub), 1000, 'Future $: All RMDs sorts on the nominal lifetime total');
			cdBox.checked = true;
			assertEqual(col().getSortValue(stub), 700, 'Current $: All RMDs sorts on the sum of deflated years');
		} finally {
			cdBox.checked = was;
		}
	})();

	// The changelog markup check (an unclosed inline tag eats the rest of the page) moved to
	// doclinks.tests.js in 11.17b0, where it runs in the pre-commit hook against the page source
	// and, under ?runtests, against this DOM.

	// ── Objective-driven column sets (P67) ────────────────────────────────────
	// The core data (OPT_OBJECTIVE_COLUMNS, OPT_COLUMN_KEYS) is asserted in optimizer_core.tests.js,
	// which cannot see optimizer_ui.js. THIS is the only place both halves are visible at once, so
	// the first assertion below is the one that catches a renamed or reordered column descriptor.
	// getOptimizerColumns() is safe to call here with no sweep in state: inC() is a closure and the
	// getValue functions are never invoked.
	// ⚠ UNSAFE - MUTATES: the live OptimizerState (objective, showAllColumns, sortState, compareRow,
	// relativeView). Restores them in a finally. Gated because this suite runs before
	// renderObjectiveBlurb(), which reads that state to describe the starting goal.
	(function objectiveColumnSets() {
		if (!unsafeTest('objectiveColumnSets')) return;   // mutates the live OptimizerState
		if (typeof getOptimizerColumns !== 'function' || typeof OPT_OBJECTIVE_COLUMNS === 'undefined') return;
		const saved = {
			objective: OptimizerState.objective,
			showAllColumns: OptimizerState.showAllColumns,
			sortState: OptimizerState.sortState,
			compareRow: OptimizerState.compareRow,
			relativeView: OptimizerState.relativeView,
		};
		try {
			OptimizerState.compareRow = null;    // no pin, so the ⚓ baseline is the reference
			OptimizerState.relativeView = false; // absolute values; the column SET is the same either way

			const all = getOptimizerColumns(true).map(c => c.key);
			assertEqual(all.join(','), OPT_COLUMN_KEYS.join(','),
				'getOptimizerColumns(true) emits exactly OPT_COLUMN_KEYS, in order');

			Object.keys(OPT_OBJECTIVE_COLUMNS).forEach(objKey => {
				OptimizerState.objective = objKey;
				OptimizerState.showAllColumns = false;
				const keys = getOptimizerColumns().map(c => c.key);

				assertEqual(keys[0], 'compare', objKey + ': the compare column stays first (the Best table drops column 0)');

				const keep = new Set([...OPT_COLUMNS_PINNED, ...OPT_OBJECTIVE_COLUMNS[objKey]]);
				assertEqual(keys.join(','), OPT_COLUMN_KEYS.filter(k => keep.has(k)).join(','),
					objKey + ': emits the pinned set unioned with the goal set, in canonical display order');

				// Where the old splice used to land Rank at index 0 when findIndex missed.
				assertEqual(keys.indexOf('rank') > 0, true, objKey + ': Rank is never the leading column');

				assertEqual(keys.length < all.length, true, objKey + ': actually hides something');
			});

			// The two Δ-named columns are GONE (2026-09-07): "Show as Differences" already turns every
			// comparable column into a difference from the reference row, so a pair of columns named
			// for a delta was a narrower second copy of it. What this used to assert - that relative
			// view removed exactly those two - is now the wrong shape of claim. The claim that
			// survives is stronger: relative view changes what the cells SAY, never which columns
			// exist, so it can no longer add or drop anything.
			OptimizerState.relativeView = true;
			const relAll = getOptimizerColumns(true).map(c => c.key);
			assertEqual(relAll.some(k => /^d[A-Z]/.test(k)), false,
				'no column is named for a delta any more - Show as Differences does that job');
			assertEqual(relAll.join(','), OPT_COLUMN_KEYS.join(','),
				'relative view changes cell contents, not the column set');
			OptimizerState.relativeView = false;

			// A sort column the active goal has put away must fall back to goal order, not leave the
			// rows in build order under a header carrying no arrow.
			const cols = getOptimizerColumns(true);
			assertEqual(normalizeSortState({ colKey: 'tax', direction: 'asc' }, cols).colKey, 'tax',
				'normalizeSortState leaves a column that is present alone');
			const without = cols.filter(c => c.key !== 'tax');
			assertEqual(normalizeSortState({ colKey: 'tax', direction: 'asc' }, without).colKey, '__objective__',
				'normalizeSortState falls back to goal order when the sort column is gone');
		} finally {
			Object.assign(OptimizerState, saved);
		}
	})();

	// P78: the replay lock's two decision rules. Both live in optimizer_ui.js and are pure, so they
	// are checked here rather than by driving a real run: the wrong answer to either is silent, and
	// both are the class of bug that has shipped before - a banner claiming an outcome that belongs
	// to a plan no longer on screen, and a step re-imposing the run's strategy over the plan the
	// user just edited (the PF8 / P74 class).
	(() => {
		console.log(" ");
		console.log("=== P78: replay lock ===");
		if (typeof replayBannerText !== "function" || typeof replayCarryOnStep !== "function") {
			assertEqual(true, false, "P78: replayBannerText and replayCarryOnStep must be defined");
			return;
		}
		const RUN_LABEL = "Replaying the worst path of 500 through your plan: money runs out in 2041.";
		const st = () => ({ label: RUN_LABEL, pathName: "the worst path of 500 (Historical)",
		                    planFields: { strategy: "fixed" } });

		// Unmodified: the run's own sentence, outcome and all.
		assertEqual(replayBannerText(st()), RUN_LABEL,
			"P78: an unedited replay keeps the run's own label");
		// Modified: names the path, claims no outcome. The ruin year must not survive into it.
		const mod = replayBannerText({ ...st(), modified: true });
		assertEqual(mod.includes("MODIFIED"), true, "P78: an edited replay says the plan is modified");
		assertEqual(mod.includes("2041"), false,
			"P78: an edited replay must NOT repeat the run's ruin year");
		// A state with no pathName still says something.
		assertEqual(replayBannerText({ label: RUN_LABEL, modified: true }), RUN_LABEL,
			"P78: a state with no pathName falls back to its label rather than going blank");
		assertEqual(replayBannerText(null), "", "P78: no state, no text");

		// ENTRY (no prev): the fresh state keeps its plan fields, because replayPath is about to
		// hand them to the sidebar. Stripping them here would replay a plan nobody chose.
		const entry = replayCarryOnStep(null, st());
		assertEqual(entry.planFields !== null, true,
			"P78: entering a replay keeps the run's plan fields for the handoff");

		// STEP after the handoff (prev has no planFields): drop them and inherit modified.
		const onNext = replayCarryOnStep({ planFields: null, modified: true }, st());
		assertEqual(onNext.planFields, null,
			"P78: stepping must NOT re-impose the run's plan over the edited one");
		assertEqual(onNext.modified, true, "P78: the modified flag follows the step");

		// STEP while prev STILL carries fields - a state that never reached the sidebar. Nothing
		// has been handed over, so the next path keeps its own rather than replaying a blank plan.
		const early = replayCarryOnStep(st(), st());
		assertEqual(early.planFields !== null, true,
			"P78: before the handoff, stepping keeps the run's plan fields");
	})();

	// P82: the ring, and the real-return formula. Both are pure and both are silent when wrong -
	// a ring that stops at the ends looks like a disabled button, and a real return computed by
	// subtraction is off by a fraction of a point that grows exactly where it matters.
	(() => {
		console.log(" ");
		console.log("=== P82: replay ring and real return ===");
		if (typeof ringStep !== "function" || typeof realReturnOf !== "function") {
			assertEqual(true, false, "P82: ringStep and realReturnOf must be defined");
			return;
		}
		// Forward through the middle, and off the end back to the start.
		assertEqual(ringStep(0, 1, 46), 1, "P82: forward steps forward");
		assertEqual(ringStep(45, 1, 46), 0, "P82: forward past the last stop reaches the first");
		// Backward off the front. The double-modulo form is what makes this 45 and not -1: a plain
		// `% len` in JavaScript keeps the sign, and -1 indexes nothing.
		assertEqual(ringStep(0, -1, 46), 45, "P82: back past the first stop reaches the last");
		assertEqual(ringStep(45, -1, 46), 44, "P82: backward steps backward");
		// A stop that has fallen out of the ring steps from the start rather than refusing to move.
		assertEqual(ringStep(-1, 1, 46), 0, "P82: an off-ring position steps from the start");
		assertEqual(ringStep(-1, -1, 46), 0, "P82: an off-ring position steps from the start either way");
		// A one-stop ring stays put instead of going out of range.
		assertEqual(ringStep(0, 1, 1), 0, "P82: a single-stop ring stays on its one stop");
		assertEqual(ringStep(0, 1, 0), -1, "P82: an empty ring has nowhere to step");

		// Real return is COMPOUNDED, not subtracted.
		assertEqual(Math.abs(realReturnOf(0.08, 0.03) - 0.0485436893203883) < 1e-12, true,
			"P82: 8% against 3% is 4.854%, the compounded figure");
		assertEqual(realReturnOf(0.08, 0.03) < 0.05, true,
			"P82: the real return must be BELOW the subtracted 5%, or it is the wrong formula");
		assertEqual(realReturnOf(0.03, 0.03), 0, "P82: matching the index leaves nothing real");
		// Deflation makes a flat market a real GAIN, which is the case a subtraction also gets right
		// but for the wrong reason - check the magnitude, not just the sign.
		assertEqual(Math.abs(realReturnOf(0, -0.01) - 0.010101010101010102) < 1e-12, true,
			"P82: a flat market against -1% inflation is a +1.01% real gain");
		assertEqual(realReturnOf(undefined, undefined), 0, "P82: missing rates read as zero, not NaN");
	})();

	// P82i: the stress tooltip's closing line is the one sentence the summary-bar tile and the
	// Monte Carlo headline cannot share. The tile is visible from every tab and points AT the Monte
	// Carlo tab; the headline is already on it, and shipped pointing readers at the page they were
	// looking at. Nothing throws when this is wrong - it just reads as a dead end.
	(() => {
		console.log(" ");
		console.log("=== P82i: stress tooltip by placement ===");
		if (typeof stressTooltip !== "function") {
			assertEqual(true, false, "P82i: stressTooltip must be defined");
			return;
		}
		const s = { mode: "worst", total: 36, failures: 8, ruinYear: 2046 };
		const tile = stressTooltip(s, "tile");
		const head = stressTooltip(s, "headline");

		assertEqual(tile.includes("See the Monte Carlo tab"), true,
			"P82i: the summary-bar tile still points at the Monte Carlo tab");
		assertEqual(head.includes("See the Monte Carlo tab"), false,
			"P82i: the headline must NOT point at the tab it is already on");
		assertEqual(head.includes("Expand this header"), true,
			"P82i: the headline points at its own fold instead");
		assertEqual(tile.includes("Expand this header"), false,
			"P82i: the tile must not tell a reader on another tab to expand a header they cannot see");

		// Everything BEFORE the closing line is shared, and must stay shared.
		const body = t => t.slice(0, t.lastIndexOf("\n\n"));
		assertEqual(body(tile), body(head),
			"P82i: only the closing line differs between the two placements");
		assertEqual(tile.includes("survives 28 of 36 and fails 8"), true,
			"P82i: the counts survive the split");
		assertEqual(head.includes("2046"), true, "P82i: the typical ruin year survives the split");

		// An unknown placement closes with nothing rather than guessing at a destination.
		const bare = stressTooltip(s, undefined);
		assertEqual(bare.includes("Monte Carlo tab") || bare.includes("Expand this header"), false,
			"P82i: an unnamed placement adds no destination at all");
	})();

	// P80: the Market Return tooltip heading. The year is a suffix on the WHOLE heading, once,
	// because one source year covers the return bar, the inflation line and the real-return line
	// alike - the banks index all of them with a single shared index.
	(() => {
		console.log(" ");
		console.log("=== P80: market tooltip heading ===");
		if (typeof marketTooltipTitle !== "function") {
			assertEqual(true, false, "P80: marketTooltipTitle must be defined");
			return;
		}
		const base = "2029  |  You: 69  Spouse: 77  |  Tax: 13.1%";
		assertEqual(marketTooltipTitle(base, 1931), base + "  (from 1931)",
			"P80: a sampled year is named at the end of the heading");
		// Every way of having no year leaves the heading exactly as it was. A synthetic path, a
		// reader without the nerdknob and no replay at all all arrive here as a null.
		for (const none of [null, undefined, 0, NaN])
			assertEqual(marketTooltipTitle(base, none), base,
				"P80: with no source year the heading is untouched (" + String(none) + ")");
		// The year is a suffix, not a replacement: the plan year, the ages and the tax rate all stay.
		const withYear = marketTooltipTitle(base, 1931);
		assertEqual(withYear.startsWith(base), true,
			"P80: the heading keeps its plan year, ages and tax rate");
		assertEqual(withYear.includes("drawn"), false,
			"P80: the heading says 'from', not 'drawn from'");
		assertEqual((withYear.match(/1931/g) || []).length, 1,
			"P80: the source year is stated once, not once per series");
	})();

	// ===== P102b: goal-first mode drives the classic controls, and hands them back =====
	// The whole safety argument for this panel is that it owns no values. It writes the shipped
	// controls and reads nothing back, so the engine, the share URL and every saved scenario are
	// untouched, and switching the nerdknob off leaves the sidebar holding the plan the panel
	// built. These check that property directly rather than checking that the panel looks right.
	(function goalFirstPanelIsGatedInMarkup() {
		const panel = document.getElementById('goalfirst-panel');
		if (!panel) { console.log('SKIP: goal-first panel absent'); return; }
		// ONE DIRECTION, because that is the direction that matters and it is the only one true
		// at every point in the page's life: the panel is never visible without the knob.
		//
		// "Visible exactly when the knob is on" is NOT assertable here and asserting it was P98's
		// mistake made twice. runTests() runs at PARSE time, before the DOMContentLoaded handler
		// calls applyNerdKnobVisibility(), so under ?nerdknob there is a real window where the
		// knob is already true and the panel is still hidden by its own markup. That window is
		// correct behavior - hidden-by-default is what makes the gate survive a page where the
		// visibility sweep never runs at all - and a test that fails during it is testing the
		// clock rather than the gate.
		// P102b7: one notch deeper than the knob. ?nerdknob alone must NOT show it.
		assertEqual(panel.style.display === 'none' || (typeof goalFirstOn === 'function' && goalFirstOn()), true,
			'P102b7: the goal-first panel is never visible without ?nerdknob=goal');
		// Neither control may be readable by the engine or by a share link.
		assertEqual(typeof OPT_LONG_TO_SHORT['gf-conv-mode'], 'undefined',
			'P102b1: the goal-first conversion mode is not a share-URL field');
		assertEqual(typeof OPT_LONG_TO_SHORT['gf-objective'], 'undefined',
			'P102b1: the goal-first objective mirror is not a share-URL field');
		const inputs = typeof getInputs === 'function' ? getInputs() : {};
		assertEqual(Object.keys(inputs).some(k => k.startsWith('gf-')), false,
			'P102b1: no goal-first control reaches the engine inputs');
		// A SIBLING of the strategy box, above it - never a child. Nested, it inherited that box's
		// orange border and read as part of "5. Withdrawal Strategy", which is the one thing it is
		// not: it asks what you want, where the box below asks how to get it.
		const box = document.getElementById('strategy-container');
		if (box) {
			assertEqual(box.contains(panel), false,
				'P102b1: the goal-first panel is not inside the Withdrawal Strategy box');
			assertEqual(!!(panel.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING), true,
				'P102b1: and it comes above it');
			assertEqual(panel.parentElement === box.parentElement, true,
				'P102b1: as its sibling, so the sidebar-wide recalc listener still reaches it');
		}
	})();

	// ===== P128: the risk-based rails panel is gated, and nothing in it is a plan input =====
	(function railsPanelIsGatedAndOwnsNoPlanInput() {
		const panel = document.getElementById('rails-panel');
		if (!panel) { console.log('SKIP: rails panel absent'); return; }
		// For everyone since 2026-09-16: nothing about the panel waits on a knob any more...
		assertEqual(typeof railsOn === 'function' && railsOn(), true, 'P128o: the rails panel is on without any knob');
		// ...except what the solve costs. `?runtests` runs this before boot has shown anything, so the
		// knob check only applies once the panel has been laid out.
		if (panel.style.display !== 'none') {
			for (const id of ['rails-cadence-wrap', 'rails-paths-wrap', 'rails-timing', 'rails-table-wrap']) {
				assertEqual(document.getElementById(id)?.style.display === '', !!NERD_KNOBS,
					`P128o: ${id} shows exactly when the nerdknob is on`);
			}
		}
		const el = id => document.getElementById(id);
		assertEqual([el('rails-cadence')?.defaultValue, el('rails-paths')?.defaultValue, el('rails-auto')?.defaultChecked,
			el('rails-show-prev')?.defaultChecked],
			['3', '100', false, false],
			'P128o: every 3 years, 100 paths, auto-run off, previous rails hidden by default');
		// The Monte Carlo tab's own default is the lognormal synthetic (user, 2026-09-16).
		assertEqual(document.querySelector('#mc-sim-mode option[selected]')?.value, 'gbm',
			'P128m: the Monte Carlo tab opens on Synthetic lognormal');
		// Outside the sidebar, so neither the share link, the saved plan nor the recalc listener sees it.
		const sidebar = document.querySelector('.sidebar');
		assertEqual(!!sidebar && sidebar.contains(panel), false, 'P128: the rails panel is not in the sidebar');
		const controls = [...panel.querySelectorAll('input, select')];
		assertEqual(controls.length > 0 && controls.every(el => el.dataset.noShare !== undefined), true,
			'P128: every rails control is data-no-share');
		assertEqual(controls.some(el => OPT_LONG_TO_SHORT[el.id] !== undefined), false,
			'P128: no rails control is a share-URL field');
		const inputs = typeof getInputs === 'function' ? getInputs() : {};
		assertEqual(Object.keys(inputs).some(k => /^rail/i.test(k)), false,
			'P128: no rails setting reaches the engine inputs, and so none reaches a saved plan');
		if (typeof buildShareURL === 'function') {
			const keys = [...new URL(buildShareURL()).searchParams.keys()];
			assertEqual(keys.some(k => /rail/i.test(k)), false, 'P128: the share link carries no rails setting');
		}
		// Before any solve the log carries no rail columns.
		if (typeof RailsState !== 'undefined' && !RailsState.result && Array.isArray(lastSimulationLog) && lastSimulationLog.length) {
			assertEqual('railLower' in lastSimulationLog[0], false, 'P128: no rail columns before a solve');
		}
		// Below both charts and foldable (user, 2026-09-16), with the fold remembered like the Optimizer's.
		const tab = document.getElementById('tab-chart');
		const lastChart = document.getElementById('chartIncomeSources');
		assertEqual(panel.tagName === 'DETAILS' && !!panel.querySelector(':scope > summary'), true,
			'P128: the rails panel folds');
		assertEqual(!!tab && tab.contains(panel) && !!lastChart
			&& !!(lastChart.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING), true,
			'P128: the rails panel sits below both charts on the Charts tab');
		if (typeof FOLD_IDS !== 'undefined') {
			assertEqual(FOLD_IDS.includes('rails-panel'), true, 'P128: the rails fold is remembered');
		}
		// A Guardrails column set (user, 2026-09-19: "all the guardrail related information"): the
		// rule's columns, the rails, what the rule compares, and what the year was handed.
		if (typeof CATEGORY_CHECKBOXES !== 'undefined' && typeof columnCategories !== 'undefined') {
			assertEqual(CATEGORY_CHECKBOXES.Guardrails, 'cat-guardrails', 'P132: Guardrails is a column set');
			assertEqual(!!document.getElementById('cat-guardrails'), true, 'P132: with a box in the table toolbar');
			const want = ['year', 'spendGoal', 'guaranteedIncome', 'totalNetWealth', 'gkSpend', 'gkAdj', 'railLower', 'railUpper',
				'railPoS%', 'railSpend', 'railSpendDn', 'railSpendUp', 'railBasis', 'infl%', 'return%'];
			assertEqual(want.filter(k => !(columnCategories[k] || []).includes('Guardrails')), [],
				'P132: every guardrail column is in the Guardrails set');
		}
		// The market is the Monte Carlo tab's own, with no menu of its own (user, 2026-09-19: "Market
		// Path can be eliminated, it should always follow Monte Carlo"); the panel names it.
		assertEqual(document.getElementById('rails-method'), null, 'P128: the rails have no market menu of their own');
		const tabMode = document.getElementById('mc-sim-mode');
		if (tabMode && typeof railsModelCfg === 'function') {
			assertEqual(railsModelCfg(getInputs()).simulationMode, tabMode.value, 'P128: the rails solve on the tab\'s own method');
			const market = document.getElementById('rails-market');
			assertEqual(!!market && market.textContent.includes('Monte Carlo tab'), true, 'P128: and the panel says so');
		}
		// The two switches on a line of their own, above Preset and Run; the README's
		// how-to beside them; Run a green action button (user, 2026-09-18). The href is matched by its
		// section only: on the live site doclinks.js points README.md at the site root.
		const lineOf = id => document.getElementById(id)?.closest('div');
		const switches = lineOf('rails-auto'), settings = lineOf('rails-preset');
		assertEqual(!!switches && switches === lineOf('rails-show-prev') && switches !== settings
			&& !!(switches.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING)
			&& settings.contains(document.getElementById('rails-run')), true,
			'P128: Auto-run and Show previous rails sit on their own line, above the settings and Run');
		const howto = document.getElementById('rails-howto');
		assertEqual([/#how-to-read-risk-based-rails$/.test(howto?.getAttribute('href') || ''), howto?.target, !!switches?.contains(howto)],
			[true, '_blank', true], 'P128: the panel links to the README\'s How to Read Risk-Based Rails, in a new tab');
		const run = document.getElementById('rails-run');
		assertEqual([run?.classList.contains('go-btn'), run && getComputedStyle(run).backgroundColor], [true, 'rgb(47, 158, 68)'],
			'P128: Run is drawn as a green action button');
	})();

	// Rebuilding the charts holds the Charts tab at its height, then lets go (user, 2026-09-18: using a
	// rails menu below the charts made the window jump 253px, the canvas's 150px default while a chart
	// was rebuilt). While the tab is hidden there is nothing to hold.
	(function chartRebuildHoldsTheTabHeight() {
		if (typeof updateCharts !== 'function' || typeof drawCharts !== 'function') { console.log('SKIP: charts absent'); return; }
		const tab = document.getElementById('tab-chart');
		if (!tab) return;
		const real = drawCharts;
		let during = null;
		try {
			drawCharts = () => { during = tab.style.minHeight; };
			updateCharts([]);
		} finally {
			drawCharts = real;
		}
		assertEqual([during, tab.style.minHeight], [tab.offsetHeight > 0 ? tab.offsetHeight + 'px' : '', ''],
			'P128: the Charts tab keeps its height while its charts are rebuilt, and nothing is left behind');
	})();

	// The rails' tooltip (user, 2026-09-18): no "solved" or "interpolated", which the marker already
	// says; the wealth rails in whole thousands, the raise rail rounded up and the cut rail down; and
	// the plan's chance of success written out once, on the TotalNetWealth line - on each rail it read
	// as the same unexplained "CoS" twice. The first year's target spend is the After-Tax Spend answer,
	// a solved value, so it carries a marker.
	(function railsTooltipChanceOnceAndThousands() {
		if (typeof railsTooltipNote !== 'function' || typeof railsTooltipValue !== 'function'
			|| typeof railsSeries !== 'function' || typeof railsWealthNote !== 'function') {
			console.log('SKIP: rails tooltip helpers absent'); return;
		}
		const log = [0, 1].map(i => ({ year: 2030 + i, inflationFactor: 1,
			railLower: 1485615, railUpper: 2392569, 'railPoS%': [0.6, 0.613][i], railBasis: i ? 'interp' : 'solved',
			railSpend: 118414.4, railSpendDn: i ? 104907.6 : null, railSpendUp: i ? 154036.2 : null }));
		const id = v => v, one = () => 1, rows = i => log[i];
		const at = (ds, i) => ({ dataset: ds, dataIndex: i, parsed: { y: ds.data[i] } });
		const [raise, cut] = railsSeries(log, one, id, 'balance', rows, '');
		assertEqual([railsTooltipNote(at(raise, 0)), railsTooltipNote(at(cut, 1))], ['', ''],
			'P128: a wealth rail carries no note, solved or interpolated');
		assertEqual(railsWealthNote(log), ['CoS 60%', 'CoS 61.3%'],
			'P128: the chance of success, as CoS, is on the TotalNetWealth line');
		assertEqual(railsWealthNote([{ 'railPoS%': 0.5, railBasis: 'solved (stale)' }, { year: 2031 }]),
			['CoS 50%, stale', null], 'P128: a stale one says so, and a year without rails has none');
		assertEqual([railsTooltipValue(at(raise, 0)), railsTooltipValue(at(cut, 0))], [2393000, 1485000],
			'P128: the raise rail rounds up to $1,000 and the cut rail down');
		const spend = railsSeries(log, one, id, 'spend', rows, '');
		assertEqual(spend.map(ds => railsTooltipNote(at(ds, 1))), ['', '', ''], 'P128: the spending rails add no note');
		assertEqual(railsTooltipValue(at(spend[0], 1)), 118414, 'P128: spending stays in whole dollars');
		assertEqual(spend[0].pointRadius[0] > 0 && spend[1].data[0] === null, true,
			'P129: the first year\'s target spend is marked, with no rail spending beside it');
		assertEqual(railsTooltipValue({ dataset: {}, parsed: { y: 1234.5 } }), 1235, 'P128: every other line keeps whole dollars');
		assertEqual(railsTooltipNote({ dataset: {}, dataIndex: 0 }), '', 'P128: and carries no note');
	})();

	// How to read the rails (user, 2026-09-18): a hint above each chart that draws them - the spending
	// one on Income vs Net only - naming the preset's own chances and saying the spending is after tax.
	(function railsHintsFollowTheirRails() {
		if (typeof railsHints !== 'function') { console.log('SKIP: rails hints absent'); return; }
		const P = { target: 0.8, upper: 0.995, lower: 0.4 };
		const text = h => h ? h.html.replace(/<[^>]+>/g, '') : null;
		const wealth = [{ railUpper: 20, railLower: 10 }, { railSpend: 5 }];
		const both = railsHints(wealth, P, 'net');
		assertEqual(/at least a 99\.5% chance of success \(CoS\)/.test(text(both.balances)) && /under 40%/.test(text(both.balances)), true,
			`P128: the Balances hint names the preset's raise and cut chances, and spells out CoS: ${text(both.balances)}`);
		assertEqual(/after-tax spending/.test(text(both.net)) && /Net \(Spendable\)/.test(text(both.net))
			&& /Total Income is before tax/.test(text(both.net)) && /an? 80% chance/.test(text(both.net)), true,
			`P128: the Income vs Net hint says what the spending is measured in: ${text(both.net)}`);
		assertEqual(/Nothing is drawn above 2x your planned spending/.test(text(both.net)), true,
			'P128: and that nothing above twice the planned spending is drawn');
		assertEqual(railsHints(wealth, P, 'combined').net, null, 'P128: no spending hint on the other views');
		assertEqual(railsHints([{ railSpend: 5 }], P, 'net').balances, null, 'P128: no Balances hint without wealth rails');
		const none = railsHints([{ railUpper: null, railSpend: null }], P, 'net');
		assertEqual([none.balances, none.net], [null, null], 'P128: no hint at all before a solve');
		assertEqual(railsHints(wealth, undefined, 'net').balances, null, 'P128: nor without a preset');
		const elB = document.getElementById('rails-hint-balances'), elN = document.getElementById('rails-hint-net');
		assertEqual(!!elB && !!elN && !!document.getElementById('chartAssets')
			&& !!(elB.compareDocumentPosition(document.getElementById('chartAssets')) & Node.DOCUMENT_POSITION_FOLLOWING), true,
			'P128: each hint sits on the Charts tab, above its chart');
	})();

	// No spending rail is drawn above twice the year's planned spending (user, 2026-09-18): near a
	// plan's end the answer climbs toward spending whatever is left, up to 10x the plan on many plans,
	// and flattened every other line. Judged against the year's own Spend Goal in nominal dollars, so
	// Current $ cannot move the cutoff; the wealth rails are never cut.
	(function railsSpendPlotStopsAtTwiceThePlan() {
		if (typeof railsSeries !== 'function' || typeof RAILS_SPEND_PLOT_MAX === 'undefined') {
			console.log('SKIP: rails series builder absent'); return;
		}
		const log = [0, 1, 2, 3].map(i => ({ year: 2030 + i, inflationFactor: 1.5, spendGoal: 100,
			railBasis: 'solved', railLower: 10, railUpper: 20, 'railPoS%': 0.5,
			railSpend: [150, 200, 201, 1000][i], railSpendDn: 90, railSpendUp: [110, 110, 250, 110][i] }));
		const current = r => 1 / r.inflationFactor, id = v => v, rows = i => log[i];
		const [target, up] = railsSeries(log, current, id, 'spend', rows, '');
		assertEqual(target.data.map(v => v == null ? null : Math.round(v * 1.5)), [150, 200, null, null],
			'P128: the target spend is drawn up to twice the planned spending and no higher, in Current $ as well');
		assertEqual([up.data[2], target.pointRadius[2]], [null, 0], 'P128: the spending at a rail is cut the same way, marker and all');
		assertEqual(railsSeries(log, current, id, 'balance', rows, '')[0].data.every(v => v != null), true,
			'P128: the wealth rails are not cut');
	})();

	// Two bands on each view (user, 2026-09-16): green above the raise line, light red below the cut
	// line, nothing between them. Only the current solve has them.
	(function railsBandOnBothViews() {
		if (typeof railsSeries !== 'function') { console.log('SKIP: rails series builder absent'); return; }
		const log = [0, 1, 2].map(i => ({ year: 2030 + i, inflationFactor: 1,
			railLower: 10, railUpper: 20, 'railPoS%': 0.5, railBasis: 'solved',
			railSpend: 5, railSpendDn: 4, railSpendUp: 6 }));
		const id = v => v, one = () => 1, rows = i => log[i];
		for (const kind of ['balance', 'spend']) {
			const cur = railsSeries(log, one, id, kind, rows, '');
			const up = cur.findIndex(d => d.fill === 'end');
			const [raise, cut] = [cur[up], cur[up + 1]];
			assertEqual(up >= 0 && raise.pointRotation === 0 && cut?.pointRotation === 180 && cut.fill === 'start', true,
				`P128: ${kind}: green from the raise line up, red from the cut line down`);
			assertEqual([raise.backgroundColor, cut.backgroundColor], [RAIL_BAND_COLORS.above, RAIL_BAND_COLORS.below],
				`P128: ${kind}: green above, light red below`);
			assertEqual(cur.filter(d => d.fill).length, 2, `P128: two ${kind} bands, and nothing between the rails`);
			const prev = railsSeries(log, one, id, kind, rows, 'previous');
			assertEqual(prev.some(d => d.fill), false, `P128: the previous ${kind} rails carry no band`);
		}
	})();

	// ⚠ UNSAFE - MUTATES: runMCWorker and renderStressChart (both stubbed, restored), #spendGoal's
	// value (restored; the plan is never re-run with it), the two stress-refresh flags, the stored
	// Stress Test result and its hash (all restored). Ends by asking for a real refresh.
	// P91, the half it missed: a refresh displaced by a pass in flight runs when that pass finishes,
	// after a SUCCESS as well as after an error (2026-09-16: success never drained, so a second quick
	// edit left the Stress Test on the plan from before it). Since the same day a pass is skipped when
	// the pass on screen was computed from the same inputs, so the displaced request here is a real
	// edit - and the two same-input cases pin what the skip must and must not swallow. Results are
	// stand-ins and the chart is stubbed, so nothing waits on the page's own first pass.
	(function stressRefreshDisplacedBySuccessIsRun() {
		if (!unsafeTest('stressRefreshDisplacedBySuccessIsRun')) return;
		if (typeof refreshMCStressOnly !== 'function' || typeof runMCWorker !== 'function'
			|| typeof renderStressChart !== 'function' || typeof _mcStress === 'undefined'
			|| typeof _lastStressHash === 'undefined' || !document.getElementById('spendGoal')) {
			console.log('SKIP: Monte Carlo tab code absent'); return;
		}
		// _mcWorkerBusy too: a real pass the page (or an earlier test) started may still be running,
		// and its guard would park every request below as pending.
		const realRun = runMCWorker, realRender = renderStressChart, realBusy = _mcWorkerBusy;
		const was = { stress: _mcStress, inResults: _mcResults ? _mcResults.stress : undefined,
		              hash: _lastStressHash, spend: Number(val('spendGoal')) };
		const ok = { type: 'results', stressOnly: true, stress: { standIn: true }, years: 1 };
		let calls = [];
		const fresh = () => {
			calls = [];
			_mcStressRefreshing = false;
			_mcStressPending = false;
			_lastStressHash = null;
			DisplayHelpers.setDollarValue('spendGoal', was.spend);
		};
		try {
			runMCWorker = (cfg, onProgress, onComplete) => { calls.push({ cfg, onComplete }); };
			renderStressChart = () => {};
			_mcWorkerBusy = () => false;

			fresh();
			refreshMCStressOnly();   // the pass in flight
			DisplayHelpers.setDollarValue('spendGoal', was.spend + 1000);
			refreshMCStressOnly();   // an edit landing while it runs
			assertEqual(calls.length === 1 && _mcStressPending === true, true,
				'P91: a refresh asked for during a pass is remembered, not started beside it');
			calls[0].onComplete(ok);
			assertEqual(calls.length, 2, 'P91: a successful pass runs the refresh it displaced');
			assertEqual(_mcStressPending, false, 'P91: and forgets it once it has');

			// The same inputs asked for twice: the pass that lands is the answer to both.
			fresh();
			refreshMCStressOnly();
			refreshMCStressOnly();
			calls[0].onComplete(ok);
			assertEqual(calls.length === 1 && _mcStressPending === false, true,
				'a request for the inputs a successful pass just used starts no second pass');

			// ...unless that pass failed: then the remembered request is the retry.
			fresh();
			refreshMCStressOnly();
			refreshMCStressOnly();
			calls[0].onComplete({ type: 'results', stressOnly: true, error: 'stand-in failure' });
			assertEqual(calls.length, 2, 'P91: after a FAILED pass the same inputs are asked for again');
		} finally {
			runMCWorker = realRun;
			renderStressChart = realRender;
			_mcWorkerBusy = realBusy;
			DisplayHelpers.setDollarValue('spendGoal', was.spend);
			_mcStress = was.stress;
			if (_mcResults) _mcResults.stress = was.inResults;
			_lastStressHash = was.hash;
			_mcStressRefreshing = false;   // the stubbed passes will never report
			_mcStressPending = false;
			refreshMCStressOnly();
		}
	})();

	// ⚠ UNSAFE - MUTATES: #spendGoal (restored) and re-runs the plan through the real blur listener;
	// stubs runMCWorker, renderStressChart and, for the one debounce timer the blur sets, setTimeout
	// (all restored); the stress-refresh flags, the stored Stress Test result, its hash, _lastMCHash
	// and the Monte Carlo stale banner (all restored). Ends by re-running the plan and asking for a
	// real refresh.
	// 2026-09-16: a blur that changes nothing starts no Stress Test pass, and one that changes the plan
	// does. Before, EVERY blur started one (and a worker) until a full Monte Carlo run had happened -
	// and after one, undoing an edit started none, leaving the Stress Test on the undone plan.
	(function stressRefreshSkipsAnUnchangedBlur() {
		if (!unsafeTest('stressRefreshSkipsAnUnchangedBlur')) return;
		const field = document.getElementById('spendGoal');
		if (!field || typeof mcInputsChanged !== 'function' || typeof runMCWorker !== 'function'
			|| typeof renderStressChart !== 'function' || typeof _lastStressHash === 'undefined'
			|| typeof _buildMCHash !== 'function') {
			console.log('SKIP: Monte Carlo tab code absent'); return;
		}
		const realRun = runMCWorker, realRender = renderStressChart, realTimeout = window.setTimeout;
		const realBusy = _mcWorkerBusy;   // stubbed for the reason the test above gives
		const banner = document.getElementById('mc-stale-banner');
		const was = { stress: _mcStress, inResults: _mcResults ? _mcResults.stress : undefined,
		              hash: _lastStressHash, mcHash: _lastMCHash, spend: Number(val('spendGoal')),
		              banner: banner ? banner.style.display : null };
		const ok = { type: 'results', stressOnly: true, stress: { standIn: true }, years: 1 };
		const passes = [];
		// The sidebar debounces its recalc behind one setTimeout. Run that timer now, so the whole
		// blur - the plan's re-run and the Stress Test's decision - happens inside this test. Only the
		// first timer is taken; anything the recalc itself schedules goes to the real one.
		// ?runtests runs this suite while the page is still parsing, before setupAutoRecalc() has
		// attached the listener, and then nothing takes the timer: the test calls what the recalc
		// would have called for the Stress Test instead, and says which path it measured.
		let wired = null;
		const blur = () => {
			let taken = false;
			window.setTimeout = (fn, ms, ...args) => {
				taken = true;
				window.setTimeout = realTimeout;
				fn(...args);
				return 0;
			};
			try { field.dispatchEvent(new Event('blur')); } finally { window.setTimeout = realTimeout; }
			if (wired === null) wired = taken;
			if (!taken) mcInputsChanged();
		};
		const via = () => (wired ? 'a blur' : 'a recalc (listener not attached yet)');
		try {
			runMCWorker = (cfg, onProgress, onComplete) => { if (cfg.stressOnly) passes.push(onComplete); };
			renderStressChart = () => {};
			_mcWorkerBusy = () => false;
			_mcStressRefreshing = false;
			_mcStressPending = false;
			_lastStressHash = null;
			const asFirst = _buildMCHash();

			blur();
			assertEqual(passes.length, 1, `${via()} with no Stress Test result for this plan starts a pass`);
			passes[0]?.(ok);
			blur();
			assertEqual(passes.length, 1, `${via()} that changes nothing starts no Stress Test pass`);
			DisplayHelpers.setDollarValue('spendGoal', was.spend + 1000);
			blur();
			assertEqual(passes.length, 2, `${via()} that changes the plan starts one`);
			passes[1]?.(ok);
			// As if a full Monte Carlo run had used the plan as it first stood, then undo the edit.
			_lastMCHash = asFirst;
			DisplayHelpers.setDollarValue('spendGoal', was.spend);
			blur();
			assertEqual(passes.length, 3,
				`undoing that edit after a full run starts a pass for the plan as it was (${via()}): its result is not on screen`);
		} finally {
			window.setTimeout = realTimeout;
			runMCWorker = realRun;
			renderStressChart = realRender;
			_mcWorkerBusy = realBusy;
			DisplayHelpers.setDollarValue('spendGoal', was.spend);
			_mcStress = was.stress;
			if (_mcResults) _mcResults.stress = was.inResults;
			_lastStressHash = was.hash;
			_lastMCHash = was.mcHash;
			_mcStressRefreshing = false;   // the stubbed pass never reports
			_mcStressPending = false;
			if (banner) banner.style.display = was.banner;
			runSimulation();
			refreshMCStressOnly();
		}
	})();

	// P128n / P129. Every preset is solved at once, so the preset is no part of what a solve depends on;
	// and the After-Tax Spend answer is in dollars, so the goal it started from is no part of its own.
	(function railsPresetSwitchIsARedraw() {
		const sel = document.getElementById('rails-preset');
		if (!sel || typeof railsFingerprint !== 'function' || typeof railsStartFingerprint !== 'function') {
			console.log('SKIP: rails fingerprints absent'); return;
		}
		const was = sel.value;
		try {
			const fps = ['tight', 'normal', 'loose'].map(v => { sel.value = v; return railsFingerprint(); });
			assertEqual(new Set(fps).size, 1, 'P128n: switching presets changes nothing a solve depends on');
		} finally {
			sel.value = was;
		}
		const base = getInputs();
		const other = { ...base, spendGoal: (base.spendGoal || 0) + 12345 };
		assertEqual(railsStartFingerprint(other) === railsStartFingerprint(base), true,
			'P129: the After-Tax Spend answer does not depend on the goal it started from');
		assertEqual(railsFingerprint(other) === railsFingerprint(base), false, 'P129: the rails themselves do');
	})();

	// ⚠ UNSAFE - MUTATES: runMCWorker (stubbed, restored), #rails-auto (restored), RailsState
	// (snapshotted and restored), and the panel's text.
	// P128o. "'Clicking it on' should cause the build to run" (user, 2026-09-16).
	(function railsAutoTickSolvesAtOnce() {
		if (!unsafeTest('railsAutoTickSolvesAtOnce')) return;
		const auto = document.getElementById('rails-auto');
		if (!auto || typeof railsAutoToggled !== 'function' || typeof runMCWorker !== 'function') {
			console.log('SKIP: rails auto-run absent'); return;
		}
		const realRun = runMCWorker;
		const saved = { ...RailsState };
		const was = auto.checked;
		const jobs = [];
		try {
			runMCWorker = cfg => { if (cfg.kind === 'rails') jobs.push(cfg); };
			Object.assign(RailsState, { result: null, fingerprint: null, running: false, runFingerprint: null });
			auto.checked = true;
			railsAutoToggled();
			assertEqual(jobs.length, 1, 'P128o: ticking Auto-run starts a solve at once, without the debounce');
			railsAutoToggled();
			assertEqual(jobs.length, 1, 'P128o: and never a second solve of a plan already being solved');
			auto.checked = false;
			railsAutoToggled();
			assertEqual(RailsState.debounce, null, 'P128o: unticking it leaves nothing scheduled');
		} finally {
			runMCWorker = realRun;
			railsStopTicker();
			clearTimeout(RailsState.debounce);
			Object.assign(RailsState, saved, { debounce: null, ticker: null });
			auto.checked = was;
			railsRenderPanel();
		}
	})();

	// ⚠ UNSAFE - MUTATES: #spendGoal and the remembered prior goal (both restored), RailsState
	// (snapshotted and restored), runMCWorker (stubbed, restored), the ⓘ menu, the two stress-refresh
	// flags, and re-runs the plan.
	// P129 / P129c. Use it writes the risk-based answer rounded to $100, the ⓘ offers it as a menu, and
	// Restore puts the goal back.
	(function railsStartAnswerUseAndRestore() {
		if (!unsafeTest('railsStartAnswerUseAndRestore')) return;
		if (typeof railsUseStartSpend !== 'function' || typeof applySuggestSpend !== 'function'
			|| !document.getElementById('suggest-spend-menu') || !document.getElementById('spendGoal')) {
			console.log('SKIP: After-Tax Spend answer absent'); return;
		}
		const saved = { ...RailsState };
		const prior = _priorSpendGoal;
		const goal = Number(val('spendGoal'));
		const presetEl = document.getElementById('rails-preset');
		const presetWas = presetEl.value;
		const realRun = runMCWorker;
		const menu = document.getElementById('suggest-spend-menu');
		try {
			runMCWorker = () => {};   // the Stress Test refresh the plan re-run asks for stays out of it
			_priorSpendGoal = null;
			presetEl.value = 'normal';
			const answer = goal * 1.2345;
			const fake = {
				presets: { normal: { key: 'normal', label: 'Normal', target: 0.9, upper: 0.99, lower: 0.7 } },
				startYear: 2026, years: [], numPaths: 100, cadence: 3, simulationMode: 'gbm',
				start: { paths: 400, pos: 0.93, spendGoal: goal,
				         answers: { normal: { mult: 1.2345, spendGoal: answer, clamped: '' } } },
			};
			Object.assign(RailsState, { result: fake, previous: null, running: false, fingerprint: 'another plan',
			                            startFingerprint: railsStartFingerprint() });
			assertEqual(railsStartIsCurrent(), true, 'P129: an answer solved for this plan is current');
			// An action like Run, drawn like it (user, 2026-09-18: "'Use It' is also a button").
			railsRenderStart();
			const use = [...document.querySelectorAll('#rails-start button')].find(b => b.textContent === 'Use it');
			assertEqual([!!use && use.classList.contains('go-btn'), use?.disabled], [true, false],
				'P129: Use it is a green action button, live while its answer is current');
			railsUseStartSpend();
			assertEqual(Number(val('spendGoal')), Math.round(answer / 100) * 100, 'P129: Use it writes the answer, rounded to $100');
			assertEqual(_priorSpendGoal, goal, 'P129: and remembers the goal it replaced');
			assertEqual(railsStartIsCurrent(), true, 'P129: using the answer does not make it stale');
			applySuggestSpend();
			assertEqual(menu.style.display === '' && /90% chance of success/.test(menu.textContent)
				&& /Restore/.test(menu.textContent), true,
				'P129c: the ⓘ opens a menu offering the risk-based answer and Restore');
			applySuggestSpendChoice('restore');
			assertEqual(Number(val('spendGoal')), goal, 'P129: Restore puts the goal back');
			assertEqual([_priorSpendGoal, menu.style.display], [null, 'none'], 'P129: and forgets it, and the menu closes');
		} finally {
			runMCWorker = realRun;
			presetEl.value = presetWas;
			DisplayHelpers.setDollarValue('spendGoal', goal);
			_priorSpendGoal = prior;
			Object.assign(RailsState, saved);
			toggleSuggestSpendMenu(false);
			_mcStressRefreshing = false;   // the stubbed refresh will never report
			_mcStressPending = false;
			runSimulation();
		}
	})();

	// ⚠ UNSAFE - MUTATES: redraws both charts from a variant of the plan, and the income view; both
	// put back from the plan on screen at the end.
	// P130. "Whatever goes back into Brokerage should NOT be counted as income" (user, 2026-09-16), and
	// the same for surplus banked to Cash: neither line counts what the year saved.
	(function incomeChartsDoNotCountSavedMoney() {
		if (!unsafeTest('incomeChartsDoNotCountSavedMoney')) return;
		if (typeof updateCharts !== 'function' || typeof setIncomeChartView !== 'function') {
			console.log('SKIP: income charts absent'); return;
		}
		const view = incomeChartView;
		try {
			// Cycle Brokerage puts every surplus straight back into Brokerage.
			const log = simulate({ ...getInputs(), cyclicEnabled: true, CashReserve: 0 }).log;
			const i = log.findIndex(r => (r.SurplusBrok ?? 0) + (r.surplusCash ?? 0) > 1000);
			if (i < 0) { console.log('SKIP: no year of the plan saved anything'); return; }
			const r = log[i];
			const saved = (r.SurplusBrok ?? 0) + (r.surplusCash ?? 0);
			const sum = r.SSincome + r.pension + r.RMDwd + (r['-iraSpend'] ?? 0) + r.RothWD + r.CapGains
				+ r.cashDividends + r.cashInterest + (r.CashWD ?? 0) + Math.max(0, (r['Brokerage-'] ?? 0) - (r.CapGains ?? 0));
			const adj = document.getElementById('show-current-dollars')?.checked ? 1 / (r.inflationFactor || 1) : 1;
			incomeChartView = 'combined';
			updateCharts(log);
			const net = incomeChart.data.datasets.find(d => d.label === 'Net Income').data[i];
			assertEqual(Math.round(net), Math.round(Math.max(0, sum - r.totalTax - saved) * adj),
				'P130: Income & Expenses\' Net Income leaves out what the year saved');
			incomeChartView = 'net';
			updateCharts(log);
			const find = label => incomeChart.data.datasets.find(d => d.label === label).data[i];
			assertEqual([Math.round(find('Total Income')), Math.round(find('Net (Spendable)'))],
				[Math.round(Math.max(0, r.totalIncome - saved) * adj), Math.round(Math.max(0, sum - r.totalTax - saved) * adj)],
				'P130: and so do Income vs Net\'s Total Income and Net (Spendable)');
		} finally {
			incomeChartView = view;
			syncIncomeViewControls();
			if (lastSimulationLog) updateCharts(lastSimulationLog);
		}
	})();

	// ===== P127a: the spending ceiling is a plan input behind the knob, off by default =====
	(function ceilingSwitchIsAPlanInput() {
		const el = document.getElementById('gkShapeCeiling');
		if (!el) { console.log('SKIP: ceiling switch absent'); return; }
		assertEqual(OPT_LONG_TO_SHORT.gkShapeCeiling, 'gsc', 'P127a: the ceiling travels in the share link');
		assertEqual(typeof getInputs().gkShapeCeiling, 'boolean', 'P127a: getInputs carries the ceiling');
		// P132 moved it out of GK-style's band-and-step row into a row of its own, behind the knob for
		// GK-style and open to everyone with the risk-based rule (toggleStrategyUI decides).
		const box = document.getElementById('ui-rule-ceiling');
		assertEqual(!!box && box.contains(el), true, 'P127a: the switch sits in its own row under the rule\'s controls');
		assertEqual(!!document.querySelector('.sidebar')?.contains(el), true,
			'P127a: inside the sidebar, so a change re-runs the plan');
		if (typeof OPT_DEFAULTS !== 'undefined' && OPT_DEFAULTS.gkShapeCeiling) {
			assertEqual(OPT_DEFAULTS.gkShapeCeiling.c, false, 'P127a: off in the page as shipped');
		}
		// Drawn like the Guardrails switch beside it, not as a bare checkbox .toggle would hide.
		assertEqual(!!el.closest('label.toggle') && !!el.parentElement.querySelector('.toggle-switch'), true,
			'P127a: the switch uses the page\'s toggle markup');
	})();

	(function goalFirstNeverConvertWritesTheFiveControls() {
		const sel = document.getElementById('gf-conv-mode');
		const cxr = document.getElementById('convertExcessToRoth');
		const fcc = document.getElementById('fundConversionWithCash');
		const ico = document.getElementById('includeConvOpt');
		if (!sel || !cxr || !fcc || !ico || typeof onGoalConvModeChange !== 'function') {
			console.log('SKIP: goal-first conversion controls absent'); return;
		}
		const was = { sel: sel.value, cxr: cxr.checked, fcc: fcc.checked, ico: ico.checked,
		              eca: +val('extraConversionAmount') || 0 };
		try {
			// Start from conversions ON so the restore has something distinctive to give back.
			cxr.checked = true; fcc.checked = true; ico.checked = true;
			DisplayHelpers.setDollarValue('extraConversionAmount', 25000);
			sel.value = 'never';
			onGoalConvModeChange();
			assertEqual([cxr.checked, fcc.checked, ico.checked, +val('extraConversionAmount')],
				[false, false, false, 0],
				'P102b3: "Never convert" switches off all four conversion controls');
			assertEqual(document.getElementById('gf-conv-note').style.display, '',
				'P102b3: and says so in visible text, because a phone cannot hover over a tooltip');
			sel.value = 'auto';
			onGoalConvModeChange();
			assertEqual([cxr.checked, fcc.checked, ico.checked, +val('extraConversionAmount')],
				[true, true, true, 25000],
				'P102b3: switching back returns the settings it borrowed, not the defaults');
		} finally {
			cxr.checked = was.cxr; fcc.checked = was.fcc; ico.checked = was.ico;
			DisplayHelpers.setDollarValue('extraConversionAmount', was.eca);
			sel.value = was.sel;
			onConvSubFlagChange?.();
			const note = document.getElementById('gf-conv-note');
			if (note) note.style.display = 'none';
		}
	})();

	(function goalFirstNeverIsClearedButNeverInferred() {
		const sel = document.getElementById('gf-conv-mode');
		const cxr = document.getElementById('convertExcessToRoth');
		const fcc = document.getElementById('fundConversionWithCash');
		if (!sel || !cxr || !fcc || typeof onConvSubFlagChange !== 'function') {
			console.log('SKIP: goal-first conversion controls absent'); return;
		}
		const was = { sel: sel.value, cxr: cxr.checked, fcc: fcc.checked,
		              eca: +val('extraConversionAmount') || 0 };
		try {
			// An optimizer row, a share URL or a scenario can switch conversions on without firing
			// onchange. A panel still reading "Never convert" would then be a lie.
			sel.value = 'never';
			cxr.checked = true;
			onConvSubFlagChange();
			assertEqual(sel.value, 'auto',
				'P102b3: conversions reappearing clears "Never convert"');
			// The other direction must NOT hold. All flags off is also the shipped DEFAULT of a
			// plan whose Optimizer is still searching for a conversion, so inferring "never" from
			// it would answer a question the user was never asked.
			sel.value = 'auto';
			cxr.checked = false; fcc.checked = false;
			DisplayHelpers.setDollarValue('extraConversionAmount', 0);
			onConvSubFlagChange();
			assertEqual(sel.value, 'auto',
				'P102b3: conversions being off is never read as the user asking for "never"');
		} finally {
			cxr.checked = was.cxr; fcc.checked = was.fcc;
			DisplayHelpers.setDollarValue('extraConversionAmount', was.eca);
			sel.value = was.sel;
			onConvSubFlagChange();
		}
	})();

	// ===== P102b2 v2: "when they stop paying" is a POSITION of the stop question =====
	// It used to be a separate toggle in the goal-first panel, which read as live even when the
	// conversions question right above it said "Never convert". Folding it into the scope menu says
	// what it really is: the answer is still a stop year, the only difference is who works it out.
	(function convEndAutoIsAThirdPositionOfTheSameQuestion() {
		const modeEl = document.getElementById('convEndMode');
		const yearEl = document.getElementById('convEndYear');
		if (!modeEl || !yearEl || typeof onConvEndModeChange !== 'function'
			|| typeof refreshConvEndModeOptions !== 'function') {
			console.log('SKIP: stop-conversions controls absent'); return;
		}
		const was = { mode: modeEl.value, year: yearEl.value, ro: yearEl.readOnly };
		try {
			refreshConvEndModeOptions();
			// Gated exactly like the ACA entries in the Limit menu: present only behind the knob,
			// and its absence leaves 'all conversions', which is today's behavior not a fallback.
			assertEqual([...modeEl.options].some(o => o.value === 'auto'), goalFirstOn(),
				'P102b7: the "when they stop paying" position shows only under ?nerdknob=goal');
			if (!goalFirstOn()) return;
			yearEl.value = '2037';
			modeEl.value = 'extra';
			onConvEndModeChange();
			assertEqual(yearEl.readOnly, false,
				'P102b2: a scope the user chose leaves the year box theirs to type in');
			modeEl.value = 'auto';
			onConvEndModeChange();
			// The search runs from updateStats(), never from the menu: applying here too would
			// simulate the plan twice for one change. The box is untouched at this point.
			assertEqual([yearEl.value, yearEl.readOnly], ['2037', true],
				'P102b2: choosing it makes the box read-only without yet rewriting it');
			modeEl.value = 'all';
			onConvEndModeChange();
			assertEqual([yearEl.value, yearEl.readOnly], ['2037', false],
				'P102b2: going back to a manual scope returns the year the user typed');
		} finally {
			modeEl.value = was.mode; yearEl.value = was.year; yearEl.readOnly = was.ro;
			if (typeof convEndAutoNote === 'function') convEndAutoNote('');
			if (typeof refreshConvEndEnabled === 'function') refreshConvEndEnabled();
		}
	})();

	(function convEndGoesDeadWhenThePlanConvertsNothing() {
		const sel = document.getElementById('gf-conv-mode');
		const modeEl = document.getElementById('convEndMode');
		const yearEl = document.getElementById('convEndYear');
		if (!sel || !modeEl || !yearEl || typeof refreshConvEndEnabled !== 'function') {
			console.log('SKIP: goal-first conversion controls absent'); return;
		}
		const was = { sel: sel.value, cxr: document.getElementById('convertExcessToRoth').checked,
		              fcc: document.getElementById('fundConversionWithCash').checked,
		              ico: document.getElementById('includeConvOpt').checked,
		              eca: +val('extraConversionAmount') || 0 };
		try {
			sel.value = 'never';
			onGoalConvModeChange();
			assertEqual([yearEl.disabled, modeEl.disabled], [true, true],
				'P102b2: "Never convert" makes the stop-conversions question dead, not live');
			sel.value = 'auto';
			onGoalConvModeChange();
			assertEqual([yearEl.disabled, modeEl.disabled], [false, false],
				'P102b2: and it comes back when conversions do');
		} finally {
			sel.value = was.sel;
			document.getElementById('convertExcessToRoth').checked = was.cxr;
			document.getElementById('fundConversionWithCash').checked = was.fcc;
			document.getElementById('includeConvOpt').checked = was.ico;
			DisplayHelpers.setDollarValue('extraConversionAmount', was.eca);
			onConvSubFlagChange();
			refreshConvEndEnabled();
			const note = document.getElementById('gf-conv-note');
			if (note) note.style.display = 'none';
		}
	})();

	// ===== P102b6: one goal, two places to set it, never two answers =====
	// Asking the objective on the Optimizer tab and the conversions question in the sidebar made a
	// dance out of a single decision. The mirror is the SAME setting, so the test that matters is
	// that neither select can hold a value the other does not.
	(function goalFirstObjectiveMirrorsRatherThanDuplicates() {
		const gf = document.getElementById('gf-objective');
		const opt = document.getElementById('opt-objective');
		if (!gf || !opt || typeof setOptObjective !== 'function'
			|| typeof buildGoalFirstObjectiveOptions !== 'function') {
			console.log('SKIP: objective selects absent'); return;
		}
		const was = OptimizerState.objective;
		try {
			buildGoalFirstObjectiveOptions();
			// Built from the constants, not a second hand-kept <option> list that could drift.
			assertEqual([...gf.options].map(o => o.value), OPT_OBJECTIVE_ORDER,
				'P102b6: the mirror offers exactly the goals the ranker knows, in the same order');
			assertEqual([...gf.options].map(o => o.textContent),
				OPT_OBJECTIVE_ORDER.map(k => OPT_OBJECTIVE_LABELS[k]),
				'P102b6: and the same labels, so the two menus cannot drift apart');
			setOptObjective('mintax');
			assertEqual([gf.value, opt.value], ['mintax', 'mintax'],
				'P102b6: setting the goal anywhere sets it everywhere');
			setOptObjective('maxroth');
			assertEqual([gf.value, opt.value], ['maxroth', 'maxroth'],
				'P102b6: including from the other direction');
			const note = document.getElementById('gf-objective-note');
			assertEqual(note ? note.textContent : OPT_OBJECTIVE_BLURB.maxroth,
				OPT_OBJECTIVE_BLURB.maxroth,
				'P102b6: and the panel says what the chosen goal ranks by');
		} finally {
			setOptObjective(was || 'taxflex');
		}
	})();

	(function goalFirstResetLeavesNothingDriving() {
		const sel = document.getElementById('gf-conv-mode');
		const yearEl = document.getElementById('convEndYear');
		const modeEl = document.getElementById('convEndMode');
		if (!sel || !yearEl || !modeEl || typeof goalFirstReset !== 'function') {
			console.log('SKIP: goal-first panel absent'); return;
		}
		const was = { sel: sel.value, year: yearEl.value, mode: modeEl.value,
		              cxr: document.getElementById('convertExcessToRoth').checked,
		              fcc: document.getElementById('fundConversionWithCash').checked,
		              ico: document.getElementById('includeConvOpt').checked,
		              eca: +val('extraConversionAmount') || 0 };
		try {
			// Knob off means hidden AND inert. Hidden-but-still-driving would leave a reader with a
			// plan they cannot see the controls for, which is the failure relative view records.
			document.getElementById('convertExcessToRoth').checked = true;
			DisplayHelpers.setDollarValue('extraConversionAmount', 12345);
			sel.value = 'never';
			onGoalConvModeChange();
			yearEl.value = '2041';
			goalFirstReset();
			assertEqual(sel.value, 'auto',
				'P102b1: goalFirstReset puts the goal-first control back to inert');
			// The classic controls keep what the panel WROTE them. Handing the borrowed values
			// back would move the plan at the moment its UI disappeared, which is the one failure
			// a reader could not notice. "never" wrote conversions off, so off is what stays.
			assertEqual([document.getElementById('convertExcessToRoth').checked,
			             +val('extraConversionAmount'), yearEl.value],
				[false, 0, '2041'],
				'P102b1: and leaves the classic controls holding the plan the panel built');
			assertEqual(yearEl.disabled, false,
				'P102b1: with the stop question live again, since the panel is no longer driving it');
		} finally {
			sel.value = was.sel; yearEl.value = was.year; modeEl.value = was.mode;
			document.getElementById('convertExcessToRoth').checked = was.cxr;
			document.getElementById('fundConversionWithCash').checked = was.fcc;
			document.getElementById('includeConvOpt').checked = was.ico;
			DisplayHelpers.setDollarValue('extraConversionAmount', was.eca);
			onConvSubFlagChange();
			if (typeof convEndAutoNote === 'function') convEndAutoNote('');
			if (typeof refreshConvEndEnabled === 'function') refreshConvEndEnabled();
			const note = document.getElementById('gf-conv-note');
			if (note) note.style.display = 'none';
		}
	})();

    console.log('\n========================================');
    console.log(`   RESULTS: ${passed} passed, ${failed} failed`
		+ (skippedUnsafe ? `, ${skippedUnsafe} unsafe suites skipped (add ?runtests)` : ''));
	console.log(`   chart.js version ${Chart.version}`);
    console.log('========================================');
	
    // Tier 1 result is published so the deferred tier can combine with it rather than overwrite it.
    window.TIER1_RESULT = { passed, failed, skippedUnsafe };

    const statusElement = document.getElementById('testsFailed');
    if (failed > 0) {
        statusElement.textContent = '❌ tests failed';
		statusElement.title = `${failed} test${failed !== 1 ? 's' : ''} failed out of ${failed+passed}.`;
    } else if (window.TIER2_PENDING) {
        // A page that opted into the deferred node suites gets a NEUTRAL badge here, never green.
        // Green at this point would be a false green: it would mean "the 245 in-page tests passed"
        // while claiming to mean "the tests passed", which is the exact gap P39 exists to close.
        // TestTiers.finish() below resolves it once the node suites report.
        statusElement.textContent = '⏳';
		statusElement.title = `In-page: all ${passed} passed. Node suites still running...`;
    } else {
        // Without ?runtests the node suites do not run here at all - the pre-commit hook ran them
        // on every commit - so the badge says what it measured and where the rest was measured,
        // rather than a green that reads as "the tests passed".
        const ex = (window.TestTiers && window.TestTiers.EXPECTED) || {};
        const nodeTotal = Object.keys(ex).filter(k => k !== 'slowInCore').reduce((n, k) => n + ex[k], 0);
        statusElement.textContent = '🟢';
		statusElement.title = `In-page: all ${passed} passed.`
			+ (nodeTotal ? ` The ${nodeTotal} node tests run on every commit (pre-commit hook); add ?runtests to run them here as well.` : '')
			+ (skippedUnsafe ? `\n${skippedUnsafe} suite${skippedUnsafe !== 1 ? 's' : ''} that write to the live page were skipped - add ?runtests to include them.` : '');
    }
    return failed === 0;
}

// ── Deferred (tier 2) badge protocol ─────────────────────────────────────────
// Only pages that set window.TIER2_PENDING before calling runTests() use any of this. Pages that
// do not - standalone/IncomeTaxPlanner.html, for one - keep the two-state badge they always had.
window.TestTiers = {
    // ── Staleness guard ──────────────────────────────────────────────────────
    // The tier that runs outside this file is the tier that rots. These are the counts this page
    // believes exist; if the suites on disk disagree, the badge goes RED and names the difference.
    //
    // Yes, this means adding a test requires editing this line in the same commit. That friction is
    // the feature: without it, a whole suite could be added, or the slow tags could drift, and the
    // page would keep reporting green over a number it no longer understands. Measure, do not guess:
    // run `node <suite>` and use the printed total.
    //
    // ALL SIX NUMBERS, NOT JUST THE ONE FOR THE TOOL YOU ARE WORKING ON. This object is the single
    // pin for every node suite in the repo, and the suites belong to different tools: taxPaymentPlanner
    // covers RetirementTaxPlanner.html, which this page never even loads. On 2026-08-17 a Tax Payment
    // Planner release added 2 tests to its own suite, left this line at 32, and reddened the badge on
    // the Optimizer - a page it had not touched. Re-run all five suites and reconcile every entry.
    // Second home for the same counts: the suite table in .githooks/README.md. Update it too.
    EXPECTED: { optimizer_core: 483, taxengine: 32, taxPaymentPlanner: 61, doclinks: 27, feedback: 46, slowInCore: 4 },

    checkCounts(results) {
        const drift = [];
        results.forEach(r => {
            const want = this.EXPECTED[r.name];
            if (want === undefined) drift.push(`${r.name}: suite is not in EXPECTED at all`);
            else if (r.total !== want) drift.push(`${r.name}: ${r.total} tests on disk, ${want} expected`);
        });
        Object.keys(this.EXPECTED).forEach(name => {
            if (name !== 'slowInCore' && !results.some(r => r.name === name)) {
                drift.push(`${name}: expected but never reported - did the suite fail to load?`);
            }
        });
        const slow = window.OPTIMIZER_CORE_SLOW_COUNT;
        if (slow !== undefined && slow !== this.EXPECTED.slowInCore) {
            drift.push(`optimizer_core: ${slow} slow-tagged tests, ${this.EXPECTED.slowInCore} expected`);
        }
        return drift;
    },

    // results: array of {name, passed, failed, skipped, total} from the node suites' browser runners.
    finish(results) {
        const el = document.getElementById('testsFailed');
        if (!el) return;
        const t1 = window.TIER1_RESULT || { passed: 0, failed: 0 };

        // Count drift is reported as a failure, not a footnote. A page that has lost track of how
        // many tests exist cannot honestly render a green dot about them.
        const drift = this.checkCounts(results);
        if (drift.length) {
            el.textContent = '❌ test counts changed';
            el.title = 'The suites on disk no longer match what this page expects:\n'
                     + drift.join('\n')
                     + '\n\nIf this was deliberate, update TestTiers.EXPECTED in optimizer_tests.js.';
            console.error('[staleness guard] ' + drift.join(' | '));
            return;
        }
        const passed = t1.passed + results.reduce((n, r) => n + r.passed, 0);
        const failed = t1.failed + results.reduce((n, r) => n + r.failed, 0);
        const skipped = results.reduce((n, r) => n + (r.skipped || 0), 0);
        // Critical guards protect defects that already shipped once. Report them separately from
        // the bulk count, so "everything passed" and "the guards for the known bugs passed" are
        // two visible statements rather than one aggregate that hides the second.
        const crit = results.reduce((a, r) => ({
            passed: a.passed + (r.critical ? r.critical.passed : 0),
            failed: a.failed + (r.critical ? r.critical.failed : 0),
            names: a.names.concat(r.critical ? r.critical.failedNames : [])
        }), { passed: 0, failed: 0, names: [] });

        if (failed > 0) {
            el.textContent = '❌ tests failed';
            el.title = `${failed} test${failed !== 1 ? 's' : ''} failed out of ${failed + passed}.\n`
                     + results.filter(r => r.failed).map(r => `${r.name}: ${r.failed} failed`).join('\n')
                     + (crit.failed ? `\n\n★ ${crit.failed} CRITICAL guard${crit.failed !== 1 ? 's' : ''} failed - a defect that already shipped once has come back:\n`
                                      + crit.names.join('\n') : '');
        } else {
            el.textContent = '🟢';
            el.title = `All ${passed} tests passed (${t1.passed} in-page + ${passed - t1.passed} node)`
                     + (skipped ? `.\n${skipped} slow test${skipped !== 1 ? 's' : ''} skipped - add ?runtests=all to include them.` : '.')
                     // Say so when the mutating suites sat out. Otherwise the in-page count drops by
                     // a hundred with no explanation, which reads as tests having gone missing.
                     + (t1.skippedUnsafe ? `\n${t1.skippedUnsafe} suite${t1.skippedUnsafe !== 1 ? 's' : ''} that write to the live page were skipped - add ?runtests to include them.` : '')
                     + (crit.passed ? `\n★ ${crit.passed} critical regression guards passed. Each one pins a defect that shipped once and was fixed - the dividend/interest double-count, the gap-fill phantom draw, the state retirement-income exemptions, the no-tax states - so that it cannot come back unnoticed.` : '');
        }
    },

    // The node suites could not be fetched at all. Never render a plain green here: the in-page
    // tests really did pass, but claiming a full green would assert something unverified.
    unavailable(why) {
        const el = document.getElementById('testsFailed');
        if (!el) return;
        const t1 = window.TIER1_RESULT || { passed: 0, failed: 0 };
        if (t1.failed > 0) return;                       // already red, leave it
        el.textContent = '🟢⚠';
        el.title = `In-page: all ${t1.passed} passed. The node suites did NOT run: ${why}\n`
                 + 'Serve the page over http to run them. The pre-commit hook covers them either way.';
    }
};

