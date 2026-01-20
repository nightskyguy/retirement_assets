const TAXData = {
	FEDERAL: {
		YEAR: 2026,  // Official IRS Revenue Procedure 2025-32
		REFERENCE: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill',
		REF_2: 'https://taxfoundation.org/data/all/federal/2026-tax-brackets/',
		CAPITAL_GAINS: {
			YEAR: 2026,
			REFERENCE: 'none - Claude.ai created it.',
			NOTE: 'This bracket combines capital gains and NIIT - strictly speaking its not correct', 
			MFJ: {
				brackets: [
					{ l: 98900, r: 0.00 },      // 0% cap gains
					{ l: 250000, r: 0.15 },     // 15% cap gains, no NIIT
					{ l: 613700, r: 0.188 },    // 15% + 3.8% NIIT = 18.8%
					{ l: Infinity, r: 0.238 }        // 20% + 3.8% NIIT = 23.8%
				]
			},
			SGL: {
				brackets: [
					{ l: 49450, r: 0.00 },      // 0% cap gains
					{ l: 200000, r: 0.15 },     // 15% cap gains, no NIIT
					{ l: 306850, r: 0.188 },    // 15% + 3.8% NIIT = 18.8%
					{ l: Infinity, r: 0.238 }        // 20% + 3.8% NIIT = 23.8%
				]
			}			
		},
		MFJ: {
			std: 32200, 
			age: 65,
			stdbump: 1650,
			brackets: [ 
				{ l: 24800, r: 0.10, nr: 0.1000 },
				{ l: 100800, r: 0.12, nr: 0.1151 },
				{ l: 211400, r: 0.22, nr: 0.1700 },
				{ l: 403550, r: 0.24, nr: 0.2033 },
				{ l: 512450, r: 0.32, nr: 0.2281 },
				{ l: 768700, r: 0.35, nr: 0.2687 },
				{ l: Infinity, r: 0.37, nr: 0.37 }
			]
		},
		SGL: {
			std: 16100,
			age: 65,
			stdbump: 2050,
			brackets: [
				{ l: 12400, r: 0.10, nr: 0.1000 },
				{ l: 50400, r: 0.12, nr: 0.1151 },
				{ l: 105700, r: 0.22, nr: 0.1700 },
				{ l: 201775, r: 0.24, nr: 0.2033 },
				{ l: 256225, r: 0.32, nr: 0.2281 },
				{ l: 640600, r: 0.35, nr: 0.3012 },
				{ l: Infinity, r: 0.37, nr: 0.37 }
			]
		}
	},
		
	SOCIALSECURITY: {
		Year: 2026,
		SGL: { brackets: [{ l: 25000-1, r: 0.0}, { l: 25000, r: 0.5}, { l: 34000, r: 0.85}] },
		MFJ: { brackets: [{ l: 32000-1, r: 0.0}, { l: 32000, r: 0.5}, { l: 44000, r: 0.85}] }
	},

	IRMAA: {
		YEAR: 2026,
		LOOKBACK: -2,  // Based on 2024 tax return
		ANNUAL_INCREASE: 0.056,	// based on analysis of 
		standardPartB: 202.90,
		partBDeductible: 283,
		
		// NOTE these are MONTHLY values, it is NOT progressive, and these are the actual tax, not rates.
		// Also note that brackets increase at the rate of CPI, while Medicare and IRMAA rates
		// increase at the ANNUAL_INCREASE rate above.
				MFJ: {
			brackets: [
				{ l: 218000 - 1, r: 0, tier: "-none-"}, { l: 218000, r: (2 * 202.90), tier: "Tier 1" },
				{ l: 274000, r: 2 * (284.10 + 14.50), tier: "Tier 2" },	{ l: 348000, r: 2 * (405.90 + 37.60), tier: "Tier 3" },
				{ l: 410000, r: 2 * (527.70 + 60.60), tier: "Tier 4" },	{ l: 750000, r: 2 * (649.50 + 83.70), tier: "Tier 5" },
				{ l: Infinity, r: 2 * (689.90 + 91.00), tier: "Tier 6 (TOP)" }
			]
		},
		
		SGL: {
			brackets: [
				{ l: 109000 - 1, r: 0, tier: "-none-"}, { l: 109000, r: 202.90 +0, tier: "Tier 1" },
				{ l: 137000, r: 284.10 +14.50, tier: "Tier 2" }, { l: 174000, r: 405.90 + 37.60, tier: "Tier 3" },
				{ l: 205000, r: 527.70 + 60.60, tier: "Tier 4" }, { l: 500000, r: 649.50 + 83.70 , tier: "Tier 5"},
				{ l: Infinity, r: 689.90 + 91.00, tier: "Tier 6 (TOP)" }
			]
		}
	}, // IRMAA	


	// For states with NO state tax. Not implemented yet... but it's close.
    NONE: {
		STATE: 'None',
		YEAR: 2026,
		FLAT_RATE: 0.0,
		SSTaxation: 0.00,  // no tax on Social Security benefits
        MFJ: {
            std: 0,
            brackets: [ { l: Infinity, r: 0 } ]
        },
        SGL: {
            std: 0,
            brackets: [ { l: Infinity, r: 0 } ]
        }
    },	// FEDERAL brackets

    CA: {
		STATE: 'California',
		YEAR: 2025,
		SSTaxation: 0.00,  // Does not tax Social Security benefits
        MFJ: {
            std: 10804,
            brackets: [
                { l: 20824, r: 0.01 }, { l: 49368, r: 0.02 }, { l: 77918, r: 0.04 },
                { l: 108162, r: 0.06 }, { l: 136700, r: 0.08 }, { l: 698274, r: 0.093 },
                { l: 837922, r: 0.103 }, { l: 1000000, r: 0.123 }, { l: Infinity, r: 0.133 }
            ]
        },
        SGL: {
            std: 5402,
            brackets: [
                { l: 10412, r: 0.01 }, { l: 24684, r: 0.02 }, { l: 38959, r: 0.04 },
                { l: 54081, r: 0.06 }, { l: 68350, r: 0.08 }, { l: 349137, r: 0.093 },
                { l: 418961, r: 0.103 }, { l: 698271, r: 0.123 }, { l: Infinity, r: 0.133 }
            ]
        }
    }, // CALIFORNIA
	

	// CONNECTICUT - 2025/2026
	CT: {
		STATE: 'Connecticut',
		YEAR: 2025,  // No changes announced for 2026
		SSTaxation: 0.25,  // Taxes SS benefits above 75k or 100k (MFJ) at 25%	
		MFJ: {
			std: 24000,  // CT uses personal exemptions instead, not standard deduction
			exemption: 24000,  // Phase out at higher incomes
			brackets: [
				{ l: 20000, r: 0.02 },
				{ l: 100000, r: 0.045 },
				{ l: 200000, r: 0.055 },
				{ l: 400000, r: 0.06 },
				{ l: 500000, r: 0.065 },
				{ l: 1000000, r: 0.069 },
				{ l: Infinity, r: 0.0699 }
			]
		},
		SGL: {
			std: 15000,
			exemption: 15000,  // Phase out at higher incomes
			brackets: [
				{ l: 10000, r: 0.02 },
				{ l: 50000, r: 0.045 },
				{ l: 100000, r: 0.055 },
				{ l: 200000, r: 0.06 },
				{ l: 250000, r: 0.065 },
				{ l: 500000, r: 0.069 },
				{ l: Infinity, r: 0.0699 }
			]
		}
	}, // CONNECTICUT

	// GEORGIA - 2025/2026
	GA: {
		STATE: 'Georgia',
		YEAR: 2025,
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		FLAT_RATE: {2026: 0.0519, 2027: 0.0509, 2028: 0.499 }, // Will decrease to 5.09% on Jan 1, 2027
		MFJ: {
			std: 24000,  // Increased from $18,500
			exemption_dependent: 4000,  // $4,000 per dependent
			brackets: [
				{ l: Infinity, r: 0.0519 }  // Single flat rate
			]
		},
		SGL: {
			std: 12000,  // Increased from $7,100
			exemption_dependent: 4000,
			brackets: [
				{ l: Infinity, r: 0.0519 }
			]
		},
		// Note: Rate will decrease 0.10% annually: 
		// 2027: 5.09%, 2028: 4.99% (then stays at 4.99%)
	}, // GEORGIA	

	// ILLINOIS - 
	IL: {
		STATE: 'Illinois',
		YEAR: 2025,  // Flat tax, no change for 2026
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		FLAT_RATE: 0.0495,  // 4.95% flat rate for all filers
		MFJ: {
			std: 5700,  // Illinois doesn't use standard deduction
			exemption: 5700,  // $2,850 per person (2 × $2,850)
			brackets: [
				{ l: Infinity, r: 0.0495 }  // Single flat rate
			]
		},
		SGL: {
			std: 2850,
			exemption: 2850,  // $2,850 per person
			brackets: [
				{ l: Infinity, r: 0.0495 }
			]
		},
		// Note: Exemptions phase out above $250K single / $500K MFJ federal AGI
	}, // ILLINOIS

	// MARYLAND - 2025/2026
	MD: {
		STATE: 'Maryland',
		YEAR: 2025,  // New brackets effective July 1, 2025
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		CAPITAL_GAINS: {
			MFJ: { brackets: [ {l: 350000 - 1, r: 0.0}, {l: Infinity, r: 0.02 }] },
			SGL: { brackets: [ {l: 350000 - 1, r: 0.0}, {l: Infinity, r: 0.02 }] }
		},
		MFJ: {
			std: 6700,  // New for 2025, was income-based before
			brackets: [
				{ l: 1000, r: 0.02 },
				{ l: 2000, r: 0.03 },
				{ l: 3000, r: 0.04 },
				{ l: 100000, r: 0.0475 },
				{ l: 125000, r: 0.05 },
				{ l: 150000, r: 0.0525 },
				{ l: 250000, r: 0.055 },
				{ l: 600000, r: 0.0575 },
				{ l: 600001, r: 0.0625 },  // New bracket for 2025
				{ l: 1200000, r: 0.065 },  // New top bracket for 2025
				{ l: Infinity, r: 0.065 }
			]
		},
		SGL: {
			std: 3350,  // New for 2025, was income-based before
			brackets: [
				{ l: 1000, r: 0.02 },
				{ l: 2000, r: 0.03 },
				{ l: 3000, r: 0.04 },
				{ l: 100000, r: 0.0475 },
				{ l: 125000, r: 0.05 },
				{ l: 150000, r: 0.0525 },
				{ l: 250000, r: 0.055 },
				{ l: 500000, r: 0.0575 },
				{ l: 500001, r: 0.0625 },  // New bracket for 2025
				{ l: 1000000, r: 0.065 },  // New top bracket for 2025
				{ l: Infinity, r: 0.065 }
			]
		},
		// Note: Maryland also has local county taxes (2.25%-3.3%) added on top
		// Capital gains surtax of 2% for federal AGI > $350K (all statuses)
	}, // MARYLAND

	MI: {
		STATE: 'Michigan',
		YEAR: 2025,
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		FLAT_RATE: 0.0405,  // 4.05% flat rate for all filers
		MFJ: {
			std: 5600,
			brackets: [
				{ l: Infinity, r: 0.0405 }  // Flat tax rate
			]
		},
		SGL: {
			std: 5600,
			brackets: [
				{ l: Infinity, r: 0.0405 }  // Flat tax rate
			]
		}
	}, // MICHIGAN

	
	NY: {
		STATE: 'New York',
		YEAR: 2025,
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		MFJ: {
			std: 16050,
			brackets: [
				{ l: 17150, r: 0.04 }, { l: 23600, r: 0.045 }, { l: 27900, r: 0.0525 },
				{ l: 161550, r: 0.055 }, { l: 323200, r: 0.06 }, { l: 2155350, r: 0.0685 },
				{ l: 5000000, r: 0.0965 }, { l: 25000000, r: 0.103 }, { l: Infinity, r: 0.109 }
			]
		},
		SGL: {
			std: 8000,
			brackets: [
				{ l: 8500, r: 0.04 }, { l: 11700, r: 0.045 }, { l: 13900, r: 0.0525 },
				{ l: 80650, r: 0.055 }, { l: 215400, r: 0.06 }, { l: 1077550, r: 0.0685 },
				{ l: 5000000, r: 0.0965 }, { l: 25000000, r: 0.103 }, { l: Infinity, r: 0.109 }
			]
		}
	},  // NEWYORK

	NC: {
		STATE: 'North Carolina',
		YEAR: 2025,
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		FLAT_RATE: 0.0475,  // 4.75% flat rate for all filers		
		MFJ: {
			std: 25500,
			brackets: [
				{ l: Infinity, r: 0.0475 }  // Flat tax rate
			]
		},
		SGL: {
			std: 12750,
			brackets: [
				{ l: Infinity, r: 0.0475 }  // Flat tax rate
			]
		}
	}, // NORTHCAROLINA

	OR: {
		STATE: 'Oregon',
		YEAR: 2025,
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		MFJ: {
			std: 5200,
			brackets: [
				{ l: 7300, r: 0.0475 }, { l: 18400, r: 0.0675 }, { l: 250000, r: 0.0875 },
				{ l: Infinity, r: 0.099 }
			]
		},
		SGL: {
			std: 2605,
			brackets: [
				{ l: 3650, r: 0.0475 }, { l: 9200, r: 0.0675 }, { l: 125000, r: 0.0875 },
				{ l: Infinity, r: 0.099 }
			]
		}
	}, // OREGON

	PA: {
		STATE: 'Pennsylvania',
		YEAR: 2025,
		FLAT_RATE: 0.0300,  // 3.07% flat rate for all filers
		MFJ: {
			std: 0,  // Pennsylvania has no standard deduction for state tax
			brackets: [
				{ l: Infinity, r: 0.0307 }  // Flat tax rate
			]
		},
		SGL: {
			std: 0,  // Pennsylvania has no standard deduction for state tax
			brackets: [
				{ l: Infinity, r: 0.0307 }  // Flat tax rate
			]
		}
	}, // PENNSYLVANIA	

	// VIRGINIA - 2025/2026
	VA: {
		STATE: 'Virginia',
		YEAR: 2025,  // 2026 data not significantly different
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		MFJ: {
			std: 17500,  // Increased from 17000 in 2024
			brackets: [
				{ l: 3000, r: 0.02 },
				{ l: 5000, r: 0.03 },
				{ l: 17000, r: 0.05 },
				{ l: Infinity, r: 0.0575 }
			]
		},
		SGL: {
			std: 8750,  // Increased from 8500 in 2024
			brackets: [
				{ l: 3000, r: 0.02 },
				{ l: 5000, r: 0.03 },
				{ l: 17000, r: 0.05 },
				{ l: Infinity, r: 0.0575 }
			]
		}
	}, // VIRGINIA


	DC: {
		STATE: 'District of Columbia',
		YEAR: 2025,
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		MFJ: {
			std: 29200,
			brackets: [
				{ l: 10000, r: 0.04 }, { l: 40000, r: 0.06 }, { l: 60000, r: 0.065 },
				{ l: 250000, r: 0.085 }, { l: 500000, r: 0.0925 }, { l: 1000000, r: 0.0975 },
				{ l: Infinity, r: 0.1075 }
			]
		},
		SGL: {
			std: 14600,
			brackets: [
				{ l: 10000, r: 0.04 }, { l: 40000, r: 0.06 }, { l: 60000, r: 0.065 },
				{ l: 250000, r: 0.085 }, { l: 500000, r: 0.0925 }, { l: 1000000, r: 0.0975 },
				{ l: Infinity, r: 0.1075 }
			]
		} 
	}, // WASHINGTONDC

	TEST: {
		// Data used for testing only.
		YEAR: 2026,
		SSTaxation: 0.50,  // Taxes SS at 50%
		MFJ: { std: 100, brackets: [{l: 1000, r: 0.1, nr: 0.1},  {l: 2000, r: 0.2, nr: 0.15}, {l: 40000, r: 0.8, nr: 0.4} ]	},
		SGL: { std: 100/2, brackets: [{l: 1000/2, r: 0.1, nr: 0.1},  {l: 2000/2, r: 0.2, nr: 0.15}, {l: 40000/2, r: 0.8, nr: 0.45} ]}
	},
	XYZZY: { }
	
}; // TAXdata

// Uniform Lifetime Table (Simplified)
const RMD_TABLE = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
    80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
    88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
    96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2,
	104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4,
	112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0
};