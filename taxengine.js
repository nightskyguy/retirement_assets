var TAXData = {
	FEDERAL: {
		YEAR: 2026,  // Official IRS Revenue Procedure 2025-32
		REFERENCE: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill',
		REF_2: 'https://taxfoundation.org/data/all/federal/2026-tax-brackets/',
		// Net Investment Income Tax (3.8% surtax). MAGI thresholds — not indexed to inflation.
		NIIT: {
			rate: 0.038,
			MFJ: 250000,
			SGL: 200000,
		},

		CAPITAL_GAINS: {
			YEAR: 2026,
			REFERENCE: 'none - Claude.ai created it.',
			NOTE: 'NIIT is not indexed by inflation but must be considered', 
			MFJ: {
				brackets: [
					{ l: 98900, r: 0.00 },      // 0% cap gains
					{ l: 250000, r: 0.15 },     // 15% cap gains, may be subject to NIIT
					{ l: Infinity, r: 0.20 }    // 20% (+ likely 3.8% NIIT = 23.8)%
				]
			},
			SGL: {
				brackets: [
					{ l: 49450, r: 0.00 },      // 0% cap gains
					{ l: 200000, r: 0.15 },     // 15% cap gains, may be subject to NIIT
					{ l: Infinity, r: 0.20 }    // 20% (+ 3.8% NIIT = 23.8) %
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

	QCD: {
		YEAR: 2026,
		AMOUNT: 111000,       // per person per year (SECURE 2.0, permanently CPI-indexed from 2024)
		ANNUAL_INCREASE: 'cpi', // sentinel: use simulation's CPI assumption (same as bracket growth)
		// REFERENCE: IRS Notice 2025-49; $105k 2024, $108k 2025, $111k 2026
	}, // QCD

	// ─────────────────────────────────────────────────────────────────────────
	// STATE TAX SUMMARY (as of 2026) — 38 of 51 jurisdictions included
	//
	// NO INCOME TAX — 9 states, each its own dropdown entry (added below via NO_TAX_SHELL,
	// after this object literal closes, so each gets its real STATE name instead of one
	// bundled entry):
	//   AK, FL, NV, NH, SD, TN, TX, WA, WY
	//
	// FLAT-RATE — 14 included  (15 total across all 51 jurisdictions)
	//   Included (single Infinity bracket):
	//     AZ  2.5%    CO  4.4%    GA  4.99%  IA  3.8%  ID  5.3% (with income threshold)
	//     IL  4.95%   IN  3.05%   KY  4.0%   MA  5.0%
	//     MI  4.25%   NC  3.99%   NE  4.55%  PA  3.07%
	//   Scheduled/possible reductions (FLAT_RATE field is metadata; brackets govern):
	//     GA — 4.99%(2026) → 4.89%(2027) → 4.79%(2028), targeting 3.99%
	//     NE — LB754 phase-down continuing toward 3.99% target
	//     IN — HEA 1002/1001 phase-down ongoing
	//     KY — revenue-trigger reduction possible (not triggered for 2026)
	//   Not yet coded (2 flat-rate states):
	//     LA  3.0%  constitutional amendment, effective 2025
	//     UT  4.65% cut from 4.85% in 2022; no further changes scheduled
	//
	// GRADUATED — 16 states + DC included  (27 total across all 51 jurisdictions)
	//   Included: AL, CA, CT, DC, MD, ME, MN, MS, MT, ND, NY, OH, OR, SC, VA, WI
	//   Not yet coded (11 graduated states):
	//     AR  top 3.9%    2 brackets  statutory   SS partial  major 2024 reform
	//     DE  top 6.6%    7 brackets  statutory   SS exempt   brackets ~20yrs unchanged
	//     HI  top 11%    12 brackets  statutory   SS exempt   most brackets in US
	//     KS  top 5.7%    3 brackets  statutory   SS exempt   rate cuts contested
	//     MO  top 4.7%    5 brackets  statutory   SS partial  revenue-trigger phase-down
	//     NJ  top 10.75%  7 brackets  statutory   SS partial  surtax >$1M
	//     NM  top 4.9%    4 brackets  statutory   SS partial
	//     OK  top 4.75%   6 brackets  statutory   SS exempt   cut from 5%
	//     RI  top 5.99%   3 brackets  CPI-INDEXED SS partial
	//     VT  top 8.75%   4 brackets  CPI-INDEXED SS partial  exempt <~$65k AGI
	//     WV  top ~4.82%  5 brackets  statutory   SS partial  active phase-down
	//
	// FIXED (NON-INFLATION-INDEXED) BRACKETS — 5 included states:
	//   AL, MT, ND, OH, SC  (flagged INFLATION_INDEXED: false)
	//   Of the 11 missing graduated states, only RI and VT are CPI-indexed; rest are statutory.
	//
	// RETIREMENT_EXCLUSION coded (data-driven, see evaluator functions above calculateTaxes()):
	//   full: CO(55+), IA(55+), IL, MS, PA   cap: GA, KY, MD, MI, NY, WI   phaseout: CT, ME, VA
	//   credit: OH   array-of-rules: AL
	// ─────────────────────────────────────────────────────────────────────────

	// No-tax states are added individually below (after this object literal closes) via
	// NO_TAX_SHELL, so each gets its own dropdown entry with its real state name instead of
	// one bundled 'no' entry (dropdown is built from Object.keys(TAXData).length===2).

    CA: {
		STATE: 'California',
		YEAR: 2026,
		Default: true,
		NOTE: 'Excludes CA SDI and CA personal exemption credits. Because those credits are not applied, the California tax shown here is slightly over-calculated — your actual California tax would be a bit lower.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		// Thresholds inflation-adjusted by CA FTB (~2.971% CCPI); 13.3% = 12.3% + 1% MHSA surtax on income >$1M.
		// MFJ brackets >$1M: $1M triggers MHSA (+1%), nominal 12.3% bracket starts at $1,442,628 (= 2×SGL).
        MFJ: {
            std: 11700,
            brackets: [
                { l: 21512, r: 0.01 }, { l: 50998, r: 0.02 }, { l: 80490, r: 0.04 },
                { l: 111734, r: 0.06 }, { l: 141212, r: 0.08 }, { l: 721318, r: 0.093 },
                { l: 865574, r: 0.103 }, { l: 1000000, r: 0.113 }, { l: 1442628, r: 0.123 },
                { l: Infinity, r: 0.133 }
            ]
        },
        SGL: {
            std: 5850,
            brackets: [
                { l: 10756, r: 0.01 }, { l: 25499, r: 0.02 }, { l: 40245, r: 0.04 },
                { l: 55867, r: 0.06 }, { l: 70606, r: 0.08 }, { l: 360659, r: 0.093 },
                { l: 432787, r: 0.103 }, { l: 721314, r: 0.113 }, { l: 1000000, r: 0.123 },
                { l: Infinity, r: 0.133 }
            ]
        }
    }, // CALIFORNIA
	

	// CONNECTICUT - 2025/2026
	CT: {
		STATE: 'Connecticut',
		YEAR: 2026,  // No rate or bracket changes for 2026
		NOTE: 'Retirement income: Connecticut exempts pension/IRA income on a graduated scale by income (100% exempt below $75,000 Single/$100,000 MFJ federal AGI, phasing down to fully taxable by $100,000/$150,000). Uses personal exemptions ($24,000 MFJ / $15,000 Single) instead of a standard deduction; those exemptions also phase out at higher incomes, which this calculator does not apply, so tax may be understated for higher-income filers. Social Security is taxed above these same income thresholds in real CT law; this calculator applies a flat 25% instead, which may overstate SS tax for filers below the threshold.',
		SSTaxation: 0.25,  // Taxes SS benefits above 75k or 100k (MFJ) at 25%
		RETIREMENT_EXCLUSION: {
			mode: 'phaseout', types: ['pension', 'ira'],
			brackets: {
				SGL: [
					{l: 75000, r: 1.00}, {l: 77500, r: 0.85}, {l: 80000, r: 0.70}, {l: 82500, r: 0.55},
					{l: 85000, r: 0.40}, {l: 87500, r: 0.25}, {l: 90000, r: 0.10}, {l: 95000, r: 0.05},
					{l: 100000, r: 0.025}, {l: Infinity, r: 0}
				],
				MFJ: [
					{l: 100000, r: 1.00}, {l: 105000, r: 0.85}, {l: 110000, r: 0.70}, {l: 115000, r: 0.55},
					{l: 120000, r: 0.40}, {l: 125000, r: 0.25}, {l: 130000, r: 0.10}, {l: 140000, r: 0.05},
					{l: 150000, r: 0.025}, {l: Infinity, r: 0}
				]
			}
		},
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

	// GEORGIA - HB 463 (Georgia Economic Growth and Tax Relief Act of 2026)
	GA: {
		STATE: 'Georgia',
		YEAR: 2026,
		NOTE: 'Retirement income: Georgia exempts up to $65,000 of pension/IRA income per person age 65+ ($35,000 for ages 62–64). Georgia law also lets this exclusion cover interest, dividends, and capital gains up to the cap — this calculator only applies it to pension/IRA income, so tax may be slightly overstated for retirees with other investment income.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: {
			mode: 'cap', types: ['pension', 'ira'],
			ageGateTiers: [ { minAge: 62, capPerPerson: 35000 }, { minAge: 65, capPerPerson: 65000 } ]
		},
		FLAT_RATE: {2026: 0.0499, 2027: 0.0489, 2028: 0.0479 }, // Decreasing 0.1%/yr (10bp) toward 3.99%
		MFJ: {
			std: 24000,  // Increases to $30,000 in 2027 per HB 463
			exemption_dependent: 4000,  // $4,000 per dependent
			brackets: [
				{ l: Infinity, r: 0.0499 }  // Single flat rate
			]
		},
		SGL: {
			std: 12000,  // Increases to $15,000 in 2027 per HB 463
			exemption_dependent: 4000,
			brackets: [
				{ l: Infinity, r: 0.0499 }
			]
		},
		// Note: Rate decreases 0.1%/yr (10bp): 2027: 4.89%, etc., targeting 3.99%
	}, // GEORGIA

	// IDAHO - flat 5.3% (HB 40, enacted March 2025, retroactive to Jan 1 2025); SS fully exempt
	ID: {
		STATE: 'Idaho',
		YEAR: 2026,
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		MFJ: {
			std: 32200,
			brackets: [
				{ l: 9622,    r: 0.0   },  // 0% on first ~$9.6k
				{ l: Infinity, r: 0.053 }   // 5.3% on income above threshold
			]
		},
		SGL: {
			std: 16100,
			brackets: [
				{ l: 4811,    r: 0.0   },
				{ l: Infinity, r: 0.053 }
			]
		}
	}, // IDAHO

	// ILLINOIS -
	IL: {
		STATE: 'Illinois',
		YEAR: 2026,  // Flat tax, rate unchanged; personal exemption increased to $2,925/person
		NOTE: 'Retirement-account distributions (IRA/401k/pension) are exempt from Illinois tax; interest, dividends, and capital gains remain taxable. Personal exemptions ($5,850 MFJ / $2,925 Single) phase out above $500k AGI (MFJ) or $250k AGI (Single); this calculator always applies the full exemption, so tax may be understated for filers above those income levels.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		// IL Schedule M subtracts federally-taxed retirement income (qualified plans, IRA distributions,
		// govt/RR/military pensions). Assumes retirees are past plan-qualification age.
		RETIREMENT_EXCLUSION: { mode: 'full', types: ['pension', 'ira'] },
		FLAT_RATE: 0.0495,  // 4.95% flat rate for all filers (unchanged)
		MFJ: {
			std: 5850,  // Illinois personal exemption: 2 × $2,925 per person
			exemption: 5850,  // $2,925 per person (up from $2,850 in 2025)
			brackets: [
				{ l: Infinity, r: 0.0495 }  // Single flat rate
			]
		},
		SGL: {
			std: 2925,
			exemption: 2925,  // $2,925 per person (up from $2,850 in 2025)
			brackets: [
				{ l: Infinity, r: 0.0495 }
			]
		},
		// Note: Exemptions phase out above $250K single / $500K MFJ federal AGI
	}, // ILLINOIS

	// MISSISSIPPI - full retirement-income exemption, no age/income limit
	MS: {
		STATE: 'Mississippi',
		YEAR: 2026,
		NOTE: 'Mississippi fully exempts all retirement income (Social Security, pension, IRA/401k/403b, annuity, disability, military) — no age or income limit. Non-retirement income is taxed at a flat 4.3% above a $10,000 exemption.',
		SSTaxation: 0.00,
		RETIREMENT_EXCLUSION: { mode: 'full', types: ['pension', 'ira'] },
		MFJ: {
			std: 'FEDERAL',
			brackets: [
				{ l: 10000, r: 0.0 },
				{ l: Infinity, r: 0.043 }
			]
		},
		SGL: {
			std: 'FEDERAL',
			brackets: [
				{ l: 10000, r: 0.0 },
				{ l: Infinity, r: 0.043 }
			]
		},
	}, // MISSISSIPPI

	// IOWA - age 55+ full retirement-income exemption, flat 3.8% on remaining income
	IA: {
		STATE: 'Iowa',
		YEAR: 2026,
		NOTE: 'Iowa fully exempts pension, IRA, 401(k), and other retirement-plan income for filers 55+ (Social Security is already separately exempt).',
		SSTaxation: 0.00,
		RETIREMENT_EXCLUSION: { mode: 'full', types: ['pension', 'ira'], ageGate: 55 },
		FLAT_RATE: 0.038,
		MFJ: {
			std: 'FEDERAL',
			brackets: [
				{ l: Infinity, r: 0.038 }
			]
		},
		SGL: {
			std: 'FEDERAL',
			brackets: [
				{ l: Infinity, r: 0.038 }
			]
		},
	}, // IOWA

	// MASSACHUSETTS -
	MA: {
		STATE: 'Massachusetts',
		YEAR: 2026,  // Flat 5% rate; personal exemption $4,400/person
		NOTE: 'Retirement income: Massachusetts fully exempts pensions from federal, state, and municipal government employers (private pensions, IRA, and 401(k) distributions remain taxable at the flat 5% rate). This calculator does not apply that exclusion, so tax may be overstated for retirees with a government pension.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		FLAT_RATE: 0.05,
		MFJ: {
			std: 8800,  // 2 × $4,400 personal exemption
			exemption: 8800,
			brackets: [
				{ l: Infinity, r: 0.05 }
			]
		},
		SGL: {
			std: 4400,
			exemption: 4400,
			brackets: [
				{ l: Infinity, r: 0.05 }
			]
		},
	}, // MASSACHUSETTS

	// MARYLAND - 2025/2026
	MD: {
		STATE: 'Maryland',
		YEAR: 2026,  // Brackets effective July 1, 2025 remain in effect; std deductions COLA-indexed (may be slightly higher)
		NOTE: 'Retirement income: Maryland excludes up to $40,600 (2026) of qualified pension income for filers 65+ or disabled, reduced dollar-for-dollar by Social Security/Railroad Retirement received (traditional IRA distributions do not qualify). Maryland county/local income taxes (2.25%–3.3% depending on county) are levied on top of state tax; this calculator does not include them, so total tax is understated by that amount.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: { mode: 'cap', types: ['pension'], cap: 40600, ageGate: 65, reduceBySS: true },
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
		YEAR: 2026,
		NOTE: 'Retirement income: 2026 is the final phase-in year of Michigan\'s retirement-income tax relief — pension/IRA/401(k) income is exempt up to $67,610/person ($135,220 for a married couple). Filers born before 1946 have unlimited exemption, but only for government pensions; this calculator can\'t tell government from private pensions, so it only grants the unlimited exemption when both spouses were born before 1946, and applies the standard per-person cap otherwise. Tax may be overstated for a household born before 1946 with a private pension and only one qualifying spouse.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: { mode: 'cap', types: ['pension', 'ira'], capPerPerson: 67610, birthYearFullExemptBefore: 1946 },
		FLAT_RATE: 0.0425,  // 4.25% — general fund did not exceed inflation so no rate reduction triggered
		MFJ: {
			std: 5600,
			brackets: [
				{ l: Infinity, r: 0.0425 }  // Flat tax rate
			]
		},
		SGL: {
			std: 5600,
			brackets: [
				{ l: Infinity, r: 0.0425 }  // Flat tax rate
			]
		}
	}, // MICHIGAN

	
	NY: {
		STATE: 'New York',
		YEAR: 2026,
		NOTE: 'Retirement income: New York fully exempts government and military pensions and excludes up to $20,000/person of private pension/IRA income (age 59½+). This calculator can\'t tell government from private pensions, so it applies the $20,000/person private-pension cap to all pension/IRA income — actual NY tax may be overstated for filers with a government pension.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: { mode: 'cap', types: ['pension', 'ira'], capPerPerson: 20000, ageGate: 60 },
		// FY2026 budget (signed May 2025): first 5 brackets each cut 0.1%; top brackets unchanged.
		// A further 0.1% cut phases in for 2027 (total 0.2% reduction fully phased in by 2027).
		MFJ: {
			std: 16050,
			brackets: [
				{ l: 17150, r: 0.039 }, { l: 23600, r: 0.044 }, { l: 27900, r: 0.0515 },
				{ l: 161550, r: 0.054 }, { l: 323200, r: 0.059 }, { l: 2155350, r: 0.0685 },
				{ l: 5000000, r: 0.0965 }, { l: 25000000, r: 0.103 }, { l: Infinity, r: 0.109 }
			]
		},
		SGL: {
			std: 8000,
			brackets: [
				{ l: 8500, r: 0.039 }, { l: 11700, r: 0.044 }, { l: 13900, r: 0.0515 },
				{ l: 80650, r: 0.054 }, { l: 215400, r: 0.059 }, { l: 1077550, r: 0.0685 },
				{ l: 5000000, r: 0.0965 }, { l: 25000000, r: 0.103 }, { l: Infinity, r: 0.109 }
			]
		}
	},  // NEWYORK

	NC: {
		STATE: 'North Carolina',
		YEAR: 2026,
		NOTE: 'Retirement income: North Carolina fully exempts government and military pension income for retirees with 5+ years of service credit as of August 12, 1989 (the Bailey settlement); other retirement income is fully taxable. This calculator does not apply that exclusion, so tax may be overstated for qualifying retirees.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		FLAT_RATE: 0.0399,  // 3.99% flat rate — final step in phasedown enacted by NC law
		MFJ: {
			std: 25500,
			brackets: [
				{ l: Infinity, r: 0.0399 }  // Flat tax rate
			]
		},
		SGL: {
			std: 12750,
			brackets: [
				{ l: Infinity, r: 0.0399 }  // Flat tax rate
			]
		}
	}, // NORTHCAROLINA

	OR: {
		STATE: 'Oregon',
		YEAR: 2026,
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		// Lower bracket thresholds indexed for inflation annually; rates unchanged
		MFJ: {
			std: 5495,
			brackets: [
				{ l: 8100, r: 0.0475 }, { l: 20400, r: 0.0675 }, { l: 250000, r: 0.0875 },
				{ l: Infinity, r: 0.099 }
			]
		},
		SGL: {
			std: 2745,
			brackets: [
				{ l: 4050, r: 0.0475 }, { l: 10200, r: 0.0675 }, { l: 125000, r: 0.0875 },
				{ l: Infinity, r: 0.099 }
			]
		}
	}, // OREGON

	PA: {
		STATE: 'Pennsylvania',
		YEAR: 2026,
		NOTE: 'Retirement-account distributions (IRA/401k/pension) after age 59½/retirement are exempt from Pennsylvania tax; interest, dividends, and capital gains remain taxable. Assumes retirees are 59½+.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		// PA does not tax distributions from eligible employer plans or IRAs after 59½/retirement.
		RETIREMENT_EXCLUSION: { mode: 'full', types: ['pension', 'ira'] },
		FLAT_RATE: 0.0307,  // 3.07% flat rate (unchanged since 2004)
		MFJ: {
			std: 0,  // Pennsylvania has no standard deduction
			brackets: [
				{ l: Infinity, r: 0.0307 }
			]
		},
		SGL: {
			std: 0,
			brackets: [
				{ l: Infinity, r: 0.0307 }
			]
		}
	}, // PENNSYLVANIA

	// VIRGINIA - HB1754 signed May 2025; effective TY2025+
	VA: {
		STATE: 'Virginia',
		YEAR: 2026,
		NOTE: 'Retirement income: Virginia offers a $12,000/person age deduction for filers 65+, phased out dollar-for-dollar above $75,000 AGI (MFJ, zero at $99,000) / $50,000 AGI (Single). This calculator approximates that phase-out in steps rather than a smooth dollar-for-dollar reduction, so tax may be slightly over- or understated depending on exactly where your income falls within the phase-out range; it also applies the deduction only to pension/IRA income rather than all income, which understates the deduction (overstates tax) for filers with other income sources. Elevated standard deduction ($24,000 MFJ / $12,000 Single) sunsets after TY2026 unless extended by the legislature.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: {
			mode: 'phaseout', types: ['pension', 'ira'], capPerPerson: 12000, ageGate: 65,
			brackets: {
				MFJ: [ {l: 75000, r: 1.00}, {l: 81000, r: 0.75}, {l: 87000, r: 0.50}, {l: 93000, r: 0.25}, {l: Infinity, r: 0} ],
				SGL: [ {l: 50000, r: 1.00}, {l: 53000, r: 0.75}, {l: 56000, r: 0.50}, {l: 59000, r: 0.25}, {l: Infinity, r: 0} ]
			}
		},
		// HB1754: std deduction raised to $12,000/$24,000 (TY2025-2026, indexed for inflation); sunset after 2026 unless extended.
		// HB1754 also adds 7% top bracket on income > $600,000 beginning TY2026.
		MFJ: {
			std: 24000,
			brackets: [
				{ l: 3000, r: 0.02 },
				{ l: 5000, r: 0.03 },
				{ l: 17000, r: 0.05 },
				{ l: 600000, r: 0.0575 },
				{ l: Infinity, r: 0.07 }
			]
		},
		SGL: {
			std: 12000,
			brackets: [
				{ l: 3000, r: 0.02 },
				{ l: 5000, r: 0.03 },
				{ l: 17000, r: 0.05 },
				{ l: 600000, r: 0.0575 },
				{ l: Infinity, r: 0.07 }
			]
		}
	}, // VIRGINIA


	DC: {
		STATE: 'District of Columbia',
		YEAR: 2026,
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		MFJ: {
			std: 30000,
			brackets: [
				{ l: 10000, r: 0.04 }, { l: 40000, r: 0.06 }, { l: 60000, r: 0.065 },
				{ l: 250000, r: 0.085 }, { l: 500000, r: 0.0925 }, { l: 1000000, r: 0.0975 },
				{ l: Infinity, r: 0.1075 }
			]
		},
		SGL: {
			std: 15000,
			brackets: [
				{ l: 10000, r: 0.04 }, { l: 40000, r: 0.06 }, { l: 60000, r: 0.065 },
				{ l: 250000, r: 0.085 }, { l: 500000, r: 0.0925 }, { l: 1000000, r: 0.0975 },
				{ l: Infinity, r: 0.1075 }
			]
		}
	}, // WASHINGTONDC

	// NEBRASKA - LB754 phase-down: flat 4.55% in 2026 (was 5.20% in 2025, 5.84% in 2024); SS exempt per LB873
	NE: {
		STATE: 'Nebraska',
		YEAR: 2026,
		NOTE: 'Brackets are approximate based on the LB754 phase-down schedule; confirm with NE DOR for your specific year. Retirement income: Nebraska also offers a retirement-income exclusion for qualifying IRA/401(k) and pension distributions, which this calculator does not apply, so tax may be overstated for retirees who qualify.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits (LB873, eff. 2024)
		MFJ: {
			std: 17200,  // Nebraska state standard deduction (approx. 2025 value; verify against NE DOR for 2026)
			brackets: [
				{ l: Infinity, r: 0.0455 }  // Flat 4.55% — final step in LB754 phase-down before 3.99% target
			]
		},
		SGL: {
			std: 8600,
			brackets: [
				{ l: Infinity, r: 0.0455 }
			]
		}
	}, // NEBRASKA

	// ALABAMA - brackets/rates unchanged since 2006; federal income tax deduction not modeled
	AL: {
		STATE: 'Alabama',
		YEAR: 2026,
		INFLATION_INDEXED: false,
		NOTE: 'Retirement income: Alabama fully exempts defined-benefit pension income (public or private); IRA/401(k) distributions are taxable but get a $6,000 exclusion for filers 65+. Alabama also allows a deduction for federal income taxes paid, which this calculator does not apply, so tax is overstated. Brackets unchanged since 2006 (not inflation-adjusted).',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: [
			{ mode: 'full', types: ['pension'] },
			{ mode: 'cap', types: ['ira'], cap: 6000, ageGate: 65 }
		],
		MFJ: {
			std: 8500,
			brackets: [
				{ l: 1000, r: 0.02 },
				{ l: 6000, r: 0.04 },
				{ l: Infinity, r: 0.05 },
			]
		},
		SGL: {
			std: 3000,
			brackets: [
				{ l: 500, r: 0.02 },
				{ l: 3000, r: 0.04 },
				{ l: Infinity, r: 0.05 },
			]
		},
	}, // ALABAMA

	// ARIZONA - flat 2.5% (Prop 208 struck down; rate locked via HB 2900, 2022; unchanged through 2026)
	AZ: {
		STATE: 'Arizona',
		YEAR: 2026,
		NOTE: 'Retirement income: Arizona exempts up to $2,500/person of government pension income (Arizona, other states, or the U.S. government), and fully exempts military retirement pay. Private pension, IRA, and 401(k) income remain fully taxable. This calculator does not apply the government-pension exclusion, so tax may be overstated for qualifying retirees.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		FLAT_RATE: 0.025,
		MFJ: {
			std: 'FEDERAL',  // AZ uses federal standard deduction
			brackets: [
				{ l: Infinity, r: 0.025 }
			]
		},
		SGL: {
			std: 'FEDERAL',
			brackets: [
				{ l: Infinity, r: 0.025 }
			]
		},
	}, // ARIZONA

	// COLORADO - flat 4.4% (rate cut eff. 2022; unchanged 2026; std = federal)
	CO: {
		STATE: 'Colorado',
		YEAR: 2026,
		NOTE: 'Retirement income: as of 2026, Colorado removed all dollar caps on the pension/annuity/IRA subtraction for filers 55+ (the prior $20,000 age 55–64 / $24,000 age 65+ caps no longer apply). Fully exempt once at least one spouse is 55 or older.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: { mode: 'full', types: ['pension', 'ira'], ageGate: 55 },
		FLAT_RATE: 0.044,
		MFJ: {
			std: 'FEDERAL',  // CO uses federal standard deduction
			brackets: [
				{ l: Infinity, r: 0.044 }
			]
		},
		SGL: {
			std: 'FEDERAL',
			brackets: [
				{ l: Infinity, r: 0.044 }
			]
		},
	}, // COLORADO

	// INDIANA - flat 3.05% (HEA 1002/1001 phase-down; 2026 rate confirmed 3.05%; county taxes not modeled)
	IN: {
		STATE: 'Indiana',
		YEAR: 2026,
		NOTE: 'Indiana county income taxes (typically 0.5%–2.9% depending on county) are levied in addition to the state rate; this calculator does not include them, so total tax is understated by that amount.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		FLAT_RATE: 0.0305,
		MFJ: {
			std: 2000,  // $1,000 personal exemption per taxpayer
			brackets: [
				{ l: Infinity, r: 0.0305 }
			]
		},
		SGL: {
			std: 1000,
			brackets: [
				{ l: Infinity, r: 0.0305 }
			]
		},
	}, // INDIANA

	// KENTUCKY - flat 4.0% (phased down from 5.0%; revenue trigger not met for 2026 reduction)
	KY: {
		STATE: 'Kentucky',
		YEAR: 2026,
		NOTE: 'Retirement income: Kentucky exempts up to $31,110/person of pension/IRA/401(k) income.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: { mode: 'cap', types: ['pension', 'ira'], capPerPerson: 31110 },
		FLAT_RATE: 0.04,
		MFJ: {
			std: 3270,  // KY standard deduction per return (same amount for all filing statuses, 2025)
			brackets: [
				{ l: Infinity, r: 0.04 }
			]
		},
		SGL: {
			std: 3270,
			brackets: [
				{ l: Infinity, r: 0.04 }
			]
		},
	}, // KENTUCKY

	// MAINE - 2025 (brackets inflation-adjusted annually by Maine Revenue Services)
	ME: {
		STATE: 'Maine',
		YEAR: 2026,
		NOTE: 'Retirement income: Maine deducts up to $48,216 of pension/IRA income, reduced dollar-for-dollar by Social Security/Railroad Retirement received. The deduction phases out above $125,000 AGI (Single)/$250,000 (MFJ); this calculator applies the phase-out as a single step at the threshold rather than Maine\'s actual gradual reduction, so tax may be overstated for filers just above the threshold. Brackets reflect 2026 values (inflation-adjusted by Maine Revenue Services); rates unchanged.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: {
			mode: 'phaseout', types: ['pension', 'ira'], cap: 48216, reduceBySS: true,
			brackets: {
				SGL: [ {l: 125000, r: 1.00}, {l: Infinity, r: 0} ],
				MFJ: [ {l: 250000, r: 1.00}, {l: Infinity, r: 0} ]
			}
		},
		MFJ: {
			std: 'FEDERAL',  // ME uses federal standard deduction
			brackets: [
				{ l: 54850, r: 0.058 },
				{ l: 129750, r: 0.0675 },
				{ l: Infinity, r: 0.0715 },
			]
		},
		SGL: {
			std: 'FEDERAL',
			brackets: [
				{ l: 27400, r: 0.058 },
				{ l: 64850, r: 0.0675 },
				{ l: Infinity, r: 0.0715 },
			]
		},
	}, // MAINE

	// MINNESOTA - 2026 (brackets inflation-adjusted +2.369% from 2025 by MN DOR; rates unchanged)
	// SSTaxation 0.85: MN includes SS in state income for filers above ~$105k MFJ — no subtraction available
	MN: {
		STATE: 'Minnesota',
		YEAR: 2026,
		NOTE: 'Brackets reflect 2026 values (inflation-adjusted +2.369% from 2025; rates unchanged). Minnesota taxes Social Security — 85% of SS is included in state taxable income at moderate-to-high incomes. Lower-income filers may qualify for a Social Security subtraction that this calculator does not apply, so tax may be overstated for those filers.',
		SSTaxation: 0.85,
		MFJ: {
			std: 'FEDERAL',  // MN uses federal standard deduction
			brackets: [
				{ l: 46330, r: 0.0535 },
				{ l: 184040, r: 0.0680 },
				{ l: 321450, r: 0.0785 },
				{ l: Infinity, r: 0.0985 },
			]
		},
		SGL: {
			std: 'FEDERAL',
			brackets: [
				{ l: 31690, r: 0.0535 },
				{ l: 104090, r: 0.0680 },
				{ l: 193240, r: 0.0785 },
				{ l: Infinity, r: 0.0985 },
			]
		},
	}, // MINNESOTA

	// MONTANA - HB 192 two-bracket reform eff. 2024; brackets NOT inflation-indexed — unchanged through 2026
	// SSTaxation 0.85: MT exempts SS for low income; at moderate-high income, 85% is taxable (matching federal)
	MT: {
		STATE: 'Montana',
		YEAR: 2026,
		INFLATION_INDEXED: false,
		NOTE: 'Retirement income: Montana allows a small income-tested retirement subtraction (being phased out) that this calculator does not apply, so tax may be overstated for lower-income retirees. Separately, the standard deduction (20% of AGI, capped at $10,160 MFJ / $5,080 Single) is approximated using the cap, which may understate tax at lower incomes where the true 20%-of-AGI amount would be smaller than the cap. Bracket thresholds are not inflation-adjusted.',
		SSTaxation: 0.85,
		MFJ: {
			std: 10160,  // MT: 20% of AGI, capped at $10,160 (2024); using cap as approximation
			brackets: [
				{ l: 41000, r: 0.047 },
				{ l: Infinity, r: 0.059 },
			]
		},
		SGL: {
			std: 5080,  // cap at $5,080 (2024)
			brackets: [
				{ l: 20500, r: 0.047 },
				{ l: Infinity, r: 0.059 },
			]
		},
	}, // MONTANA

	// NORTH DAKOTA - HB 1158 rate cuts eff. 2024; brackets NOT inflation-indexed — unchanged through 2026
	ND: {
		STATE: 'North Dakota',
		YEAR: 2026,
		INFLATION_INDEXED: false,
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		MFJ: {
			std: 'FEDERAL',  // ND uses federal standard deduction (which IS inflation-adjusted)
			brackets: [
				{ l: 74750, r: 0.011 },
				{ l: Infinity, r: 0.0204 },
			]
		},
		SGL: {
			std: 'FEDERAL',
			brackets: [
				{ l: 44725, r: 0.011 },
				{ l: Infinity, r: 0.0204 },
			]
		},
	}, // NORTH DAKOTA

	// OHIO - HB 96 (FY2026-27 budget): flat 2.75% on non-business income above $26,050 effective TY 2026
	// (the prior 3.5% top bracket is repealed; the final phase-down of the 2-bracket HB 33 schedule).
	// Bracket thresholds are statutory fixed values; Ohio does not CPI-index income brackets.
	OH: {
		STATE: 'Ohio',
		YEAR: 2026,
		INFLATION_INDEXED: false,
		NOTE: 'Retirement income: Ohio provides a retirement-income tax credit of up to $200 (not a deduction), scaled by the amount of retirement income received, for filers with income under $100,000. 2026: Ohio moved to a flat 2.75% rate on non-business income above $26,050 (the prior 3.5% top bracket was repealed). Thresholds are not inflation-adjusted.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: {
			mode: 'credit', types: ['pension', 'ira'], magiGate: 100000,
			creditTiers: [
				{l: 500, amount: 0}, {l: 1500, amount: 25}, {l: 3000, amount: 50},
				{l: 5000, amount: 80}, {l: 8000, amount: 130}, {l: Infinity, amount: 200}
			]
		},
		MFJ: {
			std: 4800,  // $2,400 personal exemption per taxpayer (2 for MFJ); unchanged
			brackets: [
				{ l: 26050, r: 0.00 },
				{ l: Infinity, r: 0.0275 },
			]
		},
		SGL: {
			std: 2400,
			brackets: [
				{ l: 26050, r: 0.00 },
				{ l: Infinity, r: 0.0275 },
			]
		},
	}, // OHIO

	// SOUTH CAROLINA - Act 47 (2022) phase-down: 6.5%→6.4%→6.3%→6.2%→6.1% (triggers met each year)
	// Bracket thresholds are statutory fixed values; not CPI-indexed.
	SC: {
		STATE: 'South Carolina',
		YEAR: 2026,
		INFLATION_INDEXED: false,
		NOTE: 'Retirement income: South Carolina allows a deduction of up to $10,000 of retirement income (401(k), IRA, or pension) for filers 65+, plus a separate age-based deduction of up to $15,000 (the two are coordinated, not additive). This calculator does not apply either deduction, so tax is overstated for retirees 65 and older.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		MFJ: {
			std: 'FEDERAL',  // SC uses federal standard deduction (which IS inflation-adjusted)
			brackets: [
				{ l: 3200, r: 0.00 },
				{ l: 6410, r: 0.03 },
				{ l: 9620, r: 0.04 },
				{ l: 12820, r: 0.05 },
				{ l: 16040, r: 0.06 },
				{ l: Infinity, r: 0.061 },
			]
		},
		SGL: {
			std: 'FEDERAL',
			brackets: [
				{ l: 3200, r: 0.00 },
				{ l: 6410, r: 0.03 },
				{ l: 9620, r: 0.04 },
				{ l: 12820, r: 0.05 },
				{ l: 16040, r: 0.06 },
				{ l: Infinity, r: 0.061 },
			]
		},
	}, // SOUTH CAROLINA

	// WISCONSIN - 2025 (brackets inflation-adjusted annually by WI DOR; rates unchanged since 2024 reform)
	// Std deduction phases out at higher income — using base amount
	WI: {
		STATE: 'Wisconsin',
		YEAR: 2025,
		NOTE: 'Retirement income: starting with the 2025 tax year (filed 2026), Wisconsin exempts up to $24,000/person ($48,000 for a married couple) of pension/IRA income for filers 67+, with no income limit. Brackets reflect 2025 values. Standard deduction phases out at higher incomes — base amounts are used here, so results may understate tax for high-income filers.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: { mode: 'cap', types: ['pension', 'ira'], capPerPerson: 24000, ageGate: 67 },
		MFJ: {
			std: 25200,
			brackets: [
				{ l: 19660, r: 0.035 },
				{ l: 39310, r: 0.044 },
				{ l: 432830, r: 0.053 },
				{ l: Infinity, r: 0.0765 },
			]
		},
		SGL: {
			std: 13610,
			brackets: [
				{ l: 14750, r: 0.035 },
				{ l: 29490, r: 0.044 },
				{ l: 324750, r: 0.053 },
				{ l: Infinity, r: 0.0765 },
			]
		},
	}, // WISCONSIN

	TEST: {
		// Data used for testing only.
		YEAR: 2026,
		SSTaxation: 0.50,  // Taxes SS at 50%
		MFJ: { std: 100, brackets: [{l: 1000, r: 0.1, nr: 0.1},  {l: 2000, r: 0.2, nr: 0.15}, {l: 40000, r: 0.8, nr: 0.4} ]	},
		SGL: { std: 100/2, brackets: [{l: 1000/2, r: 0.1, nr: 0.1},  {l: 2000/2, r: 0.2, nr: 0.15}, {l: 40000/2, r: 0.8, nr: 0.45} ]}
	},
	XYZZY: { }
	
}; // TAXdata

// No-income-tax states, each as its own dropdown entry (Object.keys(TAXData).length===2 drives
// the dropdown — see retirement_optimizer_core.js). Shared shape via spread, not by reference,
// so any future per-state divergence (e.g. NH's now-repealed interest/dividends tax) is safe.
const NO_TAX_SHELL = {
    YEAR: 2026,
    FLAT_RATE: 0.0,
    SSTaxation: 0.00,  // no tax on Social Security benefits
    MFJ: { std: 0, brackets: [ { l: Infinity, r: 0 } ] },
    SGL: { std: 0, brackets: [ { l: Infinity, r: 0 } ] }
};
TAXData.AK = { STATE: 'Alaska', ...NO_TAX_SHELL };
TAXData.FL = { STATE: 'Florida', ...NO_TAX_SHELL };
TAXData.NV = { STATE: 'Nevada', ...NO_TAX_SHELL };
TAXData.NH = { STATE: 'New Hampshire', ...NO_TAX_SHELL,
    NOTE: 'New Hampshire fully repealed its tax on interest and dividends effective January 1, 2025.' };
TAXData.SD = { STATE: 'South Dakota', ...NO_TAX_SHELL };
TAXData.TN = { STATE: 'Tennessee', ...NO_TAX_SHELL };
TAXData.TX = { STATE: 'Texas', ...NO_TAX_SHELL };
TAXData.WA = { STATE: 'Washington', ...NO_TAX_SHELL };
TAXData.WY = { STATE: 'Wyoming', ...NO_TAX_SHELL };

// OBBBA provisions — P.L. 119-21, signed July 4, 2025. Update this block if IRS issues amended guidance.
// calculateTaxes() and IncomeTaxPlanner.html read from here; no values are hardcoded there.
TAXData.OBBBA = {
    SALT: {
        capHigh:           40000,   // elevated cap (2025); increases 1%/yr through 2029
        capLow:            10000,   // TCJA floor / fallback when OBBBA is off or after sunset
        phaseoutThreshold: 500000,  // MAGI above which capHigh phases down (MFJ & SGL per OBBBA)
        phaseoutRate:      0.30,    // 30¢ reduction per $1 above threshold ($40k→$10k over $100k of income)
        sunsetYear:        2029     // capHigh expires after this tax year; reverts to capLow in 2030
    },
    SENIOR_DED: {
        perSenior:    6000,                          // deduction per person aged ≥ 65 (P.L. 119-21)
        phaseoutAGI:  { MFJ: 150000, SGL: 75000 },  // AGI above which deduction phases out
        phaseoutRate: 0.06,                          // $0.06 reduction per $1 above threshold
        sunsetYear:   2028                           // deduction expires after this tax year (2025–2028 only)
    }
};

// Uniform Lifetime Table (Simplified)
const RMD_TABLE = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
    80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
    88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
    96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2,
	104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4,
	112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0
};

// ============================================================================
// State retirement-income exclusion evaluator
// Data-driven: every dollar figure, age threshold, phase-out step, and rate lives in
// each state's RETIREMENT_EXCLUSION entry (see IL/PA for `full`, and AL/GA/NY/CO/KY/MD/
// ME/MI/CT/VA/WI/OH for `cap`/`phaseout`/`credit`/array-of-rules examples). No per-state
// `if (state === 'XX')` branches here — only dispatch on `rule.mode`.
// ============================================================================

// Counts filers whose age qualifies (>= minAge), reusing the same shape as the federal
// `nSeniors` count above (taxengine.js ~924-925), generalized to an arbitrary threshold.
function countQualifyingFilers(ages, status, minAge) {
    if (minAge == null) return (status === 'MFJ' && ages.length > 1) ? 2 : 1;
    return (ages[0] >= minAge ? 1 : 0) +
           (status === 'MFJ' && ages.length > 1 && ages[1] >= minAge ? 1 : 0);
}

// Resolves a rule's dollar cap (used by both `cap` and `phaseout` modes) from whichever of
// ageGateTiers / capPerPerson / flat cap is present, then applies the optional SS offset.
function resolveCapAmount(rule, ages, status, totalSS) {
    let capAmount;
    if (rule.ageGateTiers) {
        const perFilerCap = (age) => rule.ageGateTiers.reduce(
            (c, tier) => age >= tier.minAge ? tier.capPerPerson : c, 0);
        capAmount = perFilerCap(ages[0] ?? 0) +
            (status === 'MFJ' && ages.length > 1 ? perFilerCap(ages[1]) : 0);
    } else if (rule.capPerPerson != null) {
        capAmount = rule.capPerPerson * countQualifyingFilers(ages, status, rule.ageGate);
    } else if (rule.cap != null) {
        capAmount = countQualifyingFilers(ages, status, rule.ageGate) > 0 ? rule.cap : 0;
    } else {
        capAmount = Infinity; // no cap configured
    }
    if (rule.reduceBySS) capAmount = Math.max(0, capAmount - totalSS);
    return capAmount;
}

function evaluateExclusionRule(rule, ctx) {
    const { pensionIncome, iraIncome, totalSS, ages, birthyears, status, federalAGI } = ctx;
    const t = rule.types || ['pension', 'ira'];
    const grossRetIncome = (t.includes('pension') ? pensionIncome : 0) +
                           (t.includes('ira')     ? iraIncome     : 0);

    if (rule.mode === 'full') {
        if (rule.ageGate != null && countQualifyingFilers(ages, status, rule.ageGate) === 0) return 0;
        return grossRetIncome;
    }

    if (rule.mode === 'cap') {
        // Birth-year full-exemption override (e.g. Michigan pre-1946). Conservative: only
        // triggers when EVERY filer in the household pre-dates the cutoff (can't tell which
        // spouse's income is which, so a mixed/unknown household falls through to the cap).
        if (rule.birthYearFullExemptBefore != null && birthyears && birthyears.length) {
            const relevant = (status === 'MFJ') ? birthyears : birthyears.slice(0, 1);
            const allQualify = relevant.length > 0 && relevant.every(y => y > 0 && y < rule.birthYearFullExemptBefore);
            if (allQualify) return grossRetIncome;
        }
        const capAmount = resolveCapAmount(rule, ages, status, totalSS);
        return Math.min(grossRetIncome, capAmount);
    }

    if (rule.mode === 'phaseout') {
        const capAmount = resolveCapAmount(rule, ages, status, totalSS);
        const baseAmount = Math.min(grossRetIncome, capAmount);
        const brks = rule.brackets[status] || rule.brackets.SGL;
        let pct = 0;
        for (const b of brks) { if (federalAGI <= b.l) { pct = b.r; break; } }
        return baseAmount * pct;
    }

    return 0; // 'credit' mode is handled separately, post-tax (see evaluateRetirementCredit).
}

// Returns the total dollar amount to SUBTRACT from state AGI. `retExcl` may be a single
// rule object or an array of rules with disjoint `types` (e.g. Alabama: pension full-exempt,
// IRA capped) — each rule is evaluated independently and summed.
function evaluateRetirementExclusion(retExcl, ctx) {
    if (!retExcl) return 0;
    const rules = Array.isArray(retExcl) ? retExcl : [retExcl];
    return rules.reduce((sum, r) => sum + evaluateExclusionRule(r, ctx), 0);
}

// Returns a dollar CREDIT to subtract from final state tax liability (mode: 'credit', e.g.
// Ohio's retirement-income credit) — does not touch AGI, applied after stateTax is computed.
function evaluateRetirementCredit(retExcl, { pensionIncome, iraIncome, magi }) {
    if (!retExcl) return 0;
    const rules = Array.isArray(retExcl) ? retExcl : [retExcl];
    const creditRule = rules.find(r => r && r.mode === 'credit');
    if (!creditRule) return 0;
    if (creditRule.magiGate != null && magi >= creditRule.magiGate) return 0;
    const t = creditRule.types || ['pension', 'ira'];
    const received = (t.includes('pension') ? pensionIncome : 0) + (t.includes('ira') ? iraIncome : 0);
    for (const tier of creditRule.creditTiers) { if (received <= tier.l) return tier.amount; }
    return 0;
}

/**
 * Calculates Federal, State, Capital Gains, NIIT, and IRMAA taxes.
 *
 * @param {Object} params - Input parameters
 * @param {string} params.filingStatus - 'MFJ' or 'SGL'.
 * @param {Array}  params.ages - [age1, age2] or [age1] if single.
 * @param {Array}  params.birthyears - [birthyear1, birthyear2] or [birthyear1] if single (used only by
 *                 state RETIREMENT_EXCLUSION rules with a `birthYearFullExemptBefore` cohort test).
 * @param {number} params.earnedIncome - W2, IRA/401k withdrawals, pensions, RMDs.
 * @param {number} params.totalSS - Total Social Security income.
 * @param {number} params.ordDivInterest - Interest and Ordinary Dividends.
 * @param {number} params.qualifiedDiv - Qualified Dividends (preferentially taxed).
 * @param {number} params.capGains - Net Long Term Capital Gains.
 * @param {number} params.taxExemptInterest - Muni bond interest (affects SS/IRMAA/CA).
 * @param {number} params.hsaContrib - HSA contributions (deductible Fed, taxable CA).
 * @param {number} params.inflation - CPI multiplier for tax brackets (e.g., 1.025).
 * @param {string} params.state - State abbreviation (e.g., 'CA', 'no' for no-tax states).
 * @param {number} params.irmaaAnnualCost - Annual IRMAA cost (from 2-year lookback MAGI).
 * @param {boolean} params.obbaOn - Enable OBBBA provisions (senior deduction + SALT cap).
 * @param {boolean} params.saltHigh - Use $40k SALT cap (OBBBA); false = $10k (TCJA).
 * @param {number}  params.propTax - Property + local taxes paid (for SALT itemizing).
 * @returns {Object} Comprehensive tax calculation results.
 */
function calculateTaxes(params = {}) {
    const {
        irmaaAnnualCost = 0,
        filingStatus = 'MFJ',
        ages = [],
        birthyears = [],
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
        propTax = 0,
        pensionIncome = 0,   // employer/govt pension + annuity portion of earnedIncome
        iraIncome     = 0    // IRA/401k/RMD distribution portion of earnedIncome
    } = params;

    const status = filingStatus ?? "MFJ";

    // ========================================================================
    // STEP 1: Federal Standard Deduction (age bumps + OBBBA parameters)
    // ========================================================================
    const federalStdBase = TAXData.FEDERAL[status].std;
    const federalAgeThreshold = TAXData.FEDERAL[status].age;
    const federalAgeBump = TAXData.FEDERAL[status].stdbump;

    const nSeniors = (ages[0] >= federalAgeThreshold ? 1 : 0) +
                     (status === 'MFJ' && ages.length > 1 && ages[1] >= federalAgeThreshold ? 1 : 0);

    let federalStdDeduction = (federalStdBase + federalAgeBump * nSeniors) * inflation;

    const obbaSalt = TAXData.OBBBA.SALT;
    const obbaSen  = TAXData.OBBBA.SENIOR_DED;
    const saltBaseCap = obbaOn ? (saltHigh ? obbaSalt.capHigh : obbaSalt.capLow) : obbaSalt.capLow;

    // ========================================================================
    // STEP 2: Social Security Taxability
    // SS thresholds are NOT inflation-indexed (statutory since 1984).
    // ========================================================================
    const ssBrackets = getRateBracket('SOCIALSECURITY', status);
    if (!ssBrackets) {
        return { error: `Unable to retrieve Social Security brackets for status: ${status}` };
    }

    const provisionalIncomeRate = ssBrackets[1].r ?? 0;
    const provisionalIncome = (earnedIncome - hsaContrib + ordDivInterest +
                               qualifiedDiv + capGains + taxExemptInterest +
                               provisionalIncomeRate * totalSS);
    let taxableSS = 0;

    if (provisionalIncome <= ssBrackets[0].l) {
        taxableSS = 0;
    } else if (provisionalIncome <= ssBrackets[2].l) {
        const threshold1 = ssBrackets[1].l;
        const tier1Rate = ssBrackets[1].r;
        taxableSS = Math.min(tier1Rate * totalSS, tier1Rate * (provisionalIncome - threshold1));
    } else {
        const threshold1 = ssBrackets[1].l;
        const threshold2 = ssBrackets[2].l;
        const tier1Rate = ssBrackets[1].r;
        const tier2Rate = ssBrackets[2].r;
        const tier1Amount = tier1Rate * (threshold2 - threshold1);
        const tier2Amount = tier2Rate * (provisionalIncome - threshold2);
        taxableSS = Math.min(tier2Rate * totalSS, tier1Amount + tier2Amount);
    }

    // ========================================================================
    // STEP 3: Federal AGI (pre-deduction)
    // ========================================================================
    const federalAGI = (earnedIncome - hsaContrib) + taxableSS + ordDivInterest +
                       qualifiedDiv + capGains;

    // ========================================================================
    // STEP 4: State AGI and State Tax
    // (Computed before finalizing federal deduction to enable SALT itemizing)
    // ========================================================================
    const stateData = TAXData[state];
    const stateTaxableSS = totalSS * (stateData.SSTaxation || 0);

    // State retirement-income exclusion (e.g. IL, PA fully exempt IRA/401k/pension distributions;
    // other states apply dollar caps, AGI-based phase-outs, or a post-tax credit — see
    // evaluateRetirementExclusion above). Default 0 when the state has no RETIREMENT_EXCLUSION or
    // callers omit the split → no change.
    const retExcl = stateData.RETIREMENT_EXCLUSION;
    const stateRetExcl = evaluateRetirementExclusion(retExcl, {
        pensionIncome, iraIncome, totalSS, ages, birthyears, status, federalAGI
    });

    let stateAGI;
    if (state === 'CA') {
        // CA does not allow HSA deduction
        stateAGI = earnedIncome + stateTaxableSS + ordDivInterest + qualifiedDiv + capGains - stateRetExcl;
    } else {
        stateAGI = earnedIncome - hsaContrib + stateTaxableSS + ordDivInterest + qualifiedDiv + capGains - stateRetExcl;
    }

    const rawStateStd = stateData[status].std;
    const stateStdDeduction = rawStateStd === 'FEDERAL'
        ? federalStdBase * inflation   // track federal base (no age bumps — those are federal-only)
        : rawStateStd * inflation;
    const stateTaxableIncome = Math.max(0, stateAGI - stateStdDeduction);
    const stateResult = calculateProgressive(state, status, stateTaxableIncome, inflation);
    const stateTax = stateResult.total;
    const stateMarginalRate = stateResult.marginal;

    // State ordinary vs. cap gains breakdown (for callers that need stacked display)
    const stateOrdinaryTax = calculateProgressive(
        state, status, Math.max(0, stateAGI - capGains - stateStdDeduction), inflation).total;
    const stateCapGainsTax = stateTax - stateOrdinaryTax;

    // ========================================================================
    // STEP 5: Finalize Federal Deduction (SALT itemizing + OBBBA senior deduction)
    // ========================================================================
    const saltMagi = federalAGI + taxExemptInterest;
    const saltCap = (obbaOn && saltHigh)
        ? Math.max(obbaSalt.capLow, saltBaseCap - Math.max(0, saltMagi - obbaSalt.phaseoutThreshold) * obbaSalt.phaseoutRate)
        : saltBaseCap;
    const saltItemized = Math.min(stateTax + propTax, saltCap);
    const useItemized = saltItemized > federalStdDeduction;
    let federalDeduction = useItemized ? saltItemized : federalStdDeduction;

    let seniorDeduction = 0;
    if (obbaOn && nSeniors > 0) {
        const rawSenDed = obbaSen.perSenior * nSeniors;
        const phaseoutExcess = Math.max(0, federalAGI - obbaSen.phaseoutAGI[status]);
        seniorDeduction = Math.max(0, rawSenDed - phaseoutExcess * obbaSen.phaseoutRate);
    }
    federalDeduction += seniorDeduction;

    // ========================================================================
    // STEP 6: Split Taxable Income into Ordinary and Preferential
    // ========================================================================
    const federalTaxableIncome = Math.max(0, federalAGI - federalDeduction);
    const ordinaryIncomeInAGI = (earnedIncome - hsaContrib) + taxableSS + ordDivInterest;
    const preferentialIncomeInAGI = qualifiedDiv + capGains;
    const taxableOrdinaryIncome = Math.max(0, Math.min(federalTaxableIncome,
                                            ordinaryIncomeInAGI - federalDeduction));
    const taxablePreferentialIncome = Math.max(0, federalTaxableIncome - taxableOrdinaryIncome);

    // ========================================================================
    // STEP 7: Federal Ordinary Income Tax
    // ========================================================================
    const federalOrdinaryResult = calculateProgressive('FEDERAL', status,
                                                       taxableOrdinaryIncome, inflation);
    const federalOrdinaryTax = federalOrdinaryResult.total;
    const federalMarginalRate = federalOrdinaryResult.marginal;

    // ========================================================================
    // STEP 8: Capital Gains Tax (0 / 15 / 20% — NIIT calculated separately)
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
    }

    // ========================================================================
    // STEP 9: NIIT (3.8% surtax — thresholds NOT inflation-indexed)
    // Applies to lesser of net investment income or (MAGI − threshold).
    // ========================================================================
    const niitThreshold = TAXData.FEDERAL.NIIT[status];
    const niitMagi = federalAGI + taxExemptInterest;
    const niitNII = qualifiedDiv + capGains + ordDivInterest;
    const niitTax = TAXData.FEDERAL.NIIT.rate *
                    Math.min(niitNII, Math.max(0, niitMagi - niitThreshold));

    const federalTax = federalOrdinaryTax + federalCapGainsTax + niitTax;

    // ========================================================================
    // STEP 10: Totals and return
    // ========================================================================
    const irmaaMagi = federalAGI + taxExemptInterest;

    // State retirement-income CREDIT (e.g. Ohio) — a dollar reduction of final state tax
    // liability, not an AGI exclusion, so it's applied here after stateTax is finalized.
    const stateRetCredit = evaluateRetirementCredit(retExcl, { pensionIncome, iraIncome, magi: irmaaMagi });
    const stateTaxFinal = Math.max(0, stateTax - stateRetCredit);

    const totalTax = federalTax + stateTaxFinal;
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
        stateTax: stateTaxFinal,
        state: stateTaxFinal,
        stateOrdinaryTax,
        stateCapGainsTax,
        capitalGainsRate,
        capitalGainsTax: federalCapGainsTax,
        niitTax,
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


///////////////////////////

function calcIRMAA(magi, status, cpiRate, medicareRate = (1 + TAXData.IRMAA.ANNUAL_INCREASE)) {

	let irmaalimit = findUpperLimitByAmount( 'IRMAA', status, magi, cpiRate)
	return irmaalimit.rate * medicareRate * 12
}

function getIRMAATier(magi, status, cpiRate) {
	const brks = getRateBracket('IRMAA', status);
	if (!brks) return '-';
	let tier = brks[0].tier ?? '-';
	for (const b of brks) {
		if (b.l * cpiRate <= magi) tier = b.tier ?? '-';
		else break;
	}
	return tier;
}

// Returns the CPI-adjusted per-person annual QCD limit for the given simulation year.
function getQCDLimit(simYear, cpiRate) {
	const { YEAR, AMOUNT } = TAXData.QCD;
	return AMOUNT * Math.pow(1 + cpiRate, simYear - YEAR);
}

// Returns true if a person is QCD-eligible (age 70½+) during simYear.
// Uses birth month for precision: born Jan–Jun → turns 70.5 in (birthYear+70);
// born Jul–Dec → turns 70.5 in (birthYear+71).
function isQCDEligible(birthYear, birthMonth, simYear) {
	const eligible70_5Year = birthYear + 70 + (birthMonth <= 6 ? 0 : 1);
	return simYear >= eligible70_5Year;
}

// For QCD "As Needed" mode: returns the target MAGI ceiling to reduce to in order to drop
// tiersDown IRMAA tiers from current position (or escape all surcharges — whichever needs
// fewer QCDs). Returns 0 if already at no-surcharge level (no QCDs needed).
// The returned value is the TOP of the target tier so the minimum QCD achieves the drop.
// Example MFJ: MAGI=$350k (Tier 3), tiersDown=2 → target=Tier 1 ceiling=$273,999
//              MAGI=$230k (Tier 1), tiersDown=2 → target=no-surcharge ceiling=$217,999
function getIRMAATierTargetMAGI(magi, status, cpiRate, tiersDown) {
	const brks = getRateBracket('IRMAA', status);
	if (!brks) return 0;
	// Find current bracket index (highest i where b.l * cpiRate <= magi)
	let currentIdx = -1;
	for (let i = 0; i < brks.length; i++) {
		if (brks[i].l * cpiRate <= magi) currentIdx = i;
		else break;
	}
	// At index 0 ("-none-" / no surcharge) or below: nothing to escape
	if (currentIdx <= 0) return 0;
	// Target bracket: drop tiersDown, clamped to index 0 (no-surcharge zone)
	const targetIdx = Math.max(currentIdx - tiersDown, 0);
	// Return the TOP of the target tier = just below the next tier's lower bound.
	// For targetIdx=0 this is just below Tier 1's floor (no surcharge).
	const nextFloor = (brks[targetIdx + 1]?.l ?? brks[targetIdx].l);
	return nextFloor * cpiRate - 1;
}
