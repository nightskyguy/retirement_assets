// The IRMAA surcharge ladder: per person, MONTHLY dollars, the Part B income-related adjustment
// plus the Part D IRMAA for each band. CMS, "2026 Medicare Parts A & B Premiums and Deductibles".
//
// Out here rather than inside TAXData because TAXData.IRMAA.MFJ is built from it, and an object
// literal cannot refer to a sibling it is still defining. See the notes above TAXData.IRMAA for
// what monthlyCost and l mean and why the last row is a terminator rather than a band.
const IRMAA_SGL_BRACKETS = [
	{ l: 109000,   monthlyCost: 0,              tier: "-none-" },
	{ l: 109001,   monthlyCost: 81.20 + 14.50,  tier: "Tier 1" },
	{ l: 137001,   monthlyCost: 202.90 + 37.60, tier: "Tier 2" },
	{ l: 171001,   monthlyCost: 324.60 + 60.60, tier: "Tier 3" },
	{ l: 205001,   monthlyCost: 446.30 + 83.70, tier: "Tier 4" },
	{ l: 500000,   monthlyCost: 487.00 + 91.00, tier: "Tier 5" },
	{ l: Infinity, monthlyCost: 487.00 + 91.00, tier: "Tier 5" },
];

var TAXData = {
	FEDERAL: {
		YEAR: 2026,  // Official IRS Revenue Procedure 2025-32
		// Estimated-tax safe harbor, IRC 6654(d)(1)(C): 110% of last year's tax, not 100%, once last
		// year's AGI was above this. Not indexed. taxPaymentPlanner.js carries the whole rule as
		// SAFE_HARBOR for its own page, and taxPaymentPlanner.tests.js pins the two to one figure.
		SAFE_HARBOR_HIGH_INCOME_AGI: 150000,
		REFERENCE: 'https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill',
		REF_2: 'https://taxfoundation.org/data/all/federal/2026-tax-brackets/',
		// Net Investment Income Tax (3.8% surtax). MAGI thresholds — not indexed to inflation.
		NIIT: {
			rate: 0.038,
			MFJ: 250000,
			SGL: 200000,
		},
		// IRC 1211(b): a NET capital loss offsets ordinary income only up to this amount a year; the
		// rest carries forward. Not indexed. $1,500 for married filing separately, which this tool
		// does not model. See netCapitalLosses.
		CAPITAL_LOSS_LIMIT: 3000,

		CAPITAL_GAINS: {
			YEAR: 2026,
			REFERENCE: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',  // Rev. Proc. 2025-32 §2.02
			// These are LTCG bracket ceilings on TAXABLE INCOME, and they are NOT the NIIT
			// thresholds. The 15%->20% ceilings used to read 250,000 / 200,000, which are the
			// NIIT MAGI thresholds copied down from the NIIT block above; NIIT is computed
			// separately in STEP 9 and added on top, so that overcharged every filer between the
			// real ceiling and the NIIT threshold by 5 points - up to $18,185 a year MFJ - and
			// reported a 0.20 marginal rate that seeded withdrawal ordering all through
			// optimizer_core.js. Keep the two sets of numbers apart.
			NOTE: 'NIIT is a separate 3.8% surtax on top of these rates, not part of them: the 15% band is 18.8% and the 20% band 23.8% for filers over the NIIT MAGI threshold. NIIT thresholds are not inflation-indexed; these bracket ceilings are.',
			// WHERE NIIT ACTUALLY BITES, and it is not where the old comments here guessed. These
			// ceilings are TAXABLE income; the NIIT threshold is MAGI, which is bigger by the
			// deduction. Putting both on a MAGI footing:
			//
			//                        20% band opens at    NIIT starts at    gap
			//   MFJ                       $645,900           $250,000     $395,900
			//   SGL                       $561,600           $200,000     $361,600
			//
			// So the surtax begins roughly $400k of income BEFORE the 20% bracket does, and the
			// 20% band is therefore ALWAYS 23.8% - never a bare 20%. The band that actually splits
			// is the 15% one, at about $217,800 of MFJ taxable income (where MAGI reaches
			// $250,000). Below that it is a true 15%; above it, 18.8%.
			//
			// That split point DRIFTS every year, which is why it must never be written into this
			// table as a bracket line: these ceilings are inflation-indexed and the NIIT threshold
			// is not, so any fixed figure is right in at most one year.
			//
			// The one regime where a bare 20% becomes reachable is sustained DEFLATION shrinking
			// these ceilings toward the fixed threshold: the crossover is a cumulative CPI factor
			// of 0.387 (MFJ) / 0.356 (SGL), which needs about 94 years at optimizer_core.js's
			// CPI_INDEX_FLOOR of -1%/yr. Not reachable by any plan this tool can build. Pinned by
			// TEST CASE 6f.
			MFJ: {
				brackets: [
					{ l: 98900, r: 0.00 },      // 0%, always below the NIIT threshold, so a true 0%
					{ l: 613700, r: 0.15 },     // 15% up to ~$217,800 taxable, 18.8% above it
					{ l: Infinity, r: 0.20 }    // 20% + 3.8% NIIT = 23.8%, always
				]
			},
			SGL: {
				brackets: [
					{ l: 49450, r: 0.00 },      // 0%, always below the NIIT threshold, so a true 0%
					{ l: 545500, r: 0.15 },     // 15% up to ~$183,900 taxable, 18.8% above it
					{ l: Infinity, r: 0.20 }    // 20% + 3.8% NIIT = 23.8%, always
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
		// YEAR, not Year: every other block in this file spells it in capitals, and this one did
		// not, so a script auditing year stamps across TAXData skipped it silently. Nothing reads
		// the key either way (2026-09-22).
		//
		// The stamp is the year the BENEFIT rules below were checked against SSA, not the year of
		// the taxability thresholds beneath it. Those thresholds - $25,000/$34,000 single,
		// $32,000/$44,000 joint - are statutory and have never been indexed, which is why an ever
		// larger share of benefits becomes taxable as incomes rise. TEST CASE 9 pins that they do
		// not move with CPI; do not "refresh" them with the rest of the tables.
		YEAR: 2026,
		SGL: { brackets: [{ l: 25000-1, r: 0.0}, { l: 25000, r: 0.5}, { l: 34000, r: 0.85}] },
		MFJ: { brackets: [{ l: 32000-1, r: 0.0}, { l: 32000, r: 0.5}, { l: 44000, r: 0.85}] },
		// Benefit rules (SSA). Full retirement age in months, keyed by the first birth year each row
		// applies to: 66 through 1954, two months more per year to 1959, 67 from 1960. Earlier
		// cohorts are treated as 66; they are past any claiming age in a plan this tool runs.
		FRA_MONTHS: [[1960, 67 * 12], [1959, 66 * 12 + 10], [1958, 66 * 12 + 8], [1957, 66 * 12 + 6],
		             [1956, 66 * 12 + 4], [1955, 66 * 12 + 2], [0, 66 * 12]],
		DELAYED_CREDIT_PER_YEAR: 0.08,          // each year claimed past FRA, to 70 (born 1943 or later)
		// Claiming before FRA: 5/9 of 1% a month for the first 36 months early, 5/12 of 1% after.
		EARLY_REDUCTION: { FIRST_MONTHS: 36, FIRST_RATE: 5 / 9 / 100, LATER_RATE: 5 / 12 / 100 },
		// A widow(er) may claim from 60, at a reduction reaching 28.5% at 60 and spread evenly
		// over the months from 60 to their own FRA.
		SURVIVOR: { MIN_AGE: 60, MAX_REDUCTION: 0.285 },
	},

	IRMAA: {
		YEAR: 2026,
		LOOKBACK: -2,  // Based on 2024 tax return
		// Medicare eligibility age (SSA). One source of truth for every "is this person on
		// Medicare" test: the surcharge itself, the base Part B/D premium, and the ACA-vs-Medicare
		// checks in optimizer_core.js. NOT the same 65 as the federal standard-deduction age bump
		// (FEDERAL.*.age above) or a state's retirement-income ageGate — separate statutes that
		// happen to share a number today, so changing one must not move the others.
		ELIGIBILITY_AGE: 65,
		// Medicare premium and IRMAA surcharge growth USED TO LIVE HERE, as `ANNUAL_INCREASE: 0.056`.
		// It is now medicare_costs.js, which every tool shares: a two-phase rate rather than a flat
		// one, because the officially projected future has two phases and no single rate can be both.
		//
		// It moved OUT of TAXData on purpose. This table is statute - figures a government published,
		// refreshed by looking them up - and that was a fitted assumption with no source at all. Put a
		// growth rate back here and it acquires the authority of the numbers around it.
		//
		// YEAR above is what medicare_costs.js anchors to; TEST CASE 26 pins the two equal.
		standardPartB: 202.90,	// 2026 standard Part B premium (CMS); set at 25% of Part B cost for aged enrollees
		standardPartD: 38.99,	// 2026 Part D base beneficiary premium (CMS, 6% IRA cap); plan premiums vary
		
		// THESE ROWS ARE NOT LIKE THE OTHER TABLES IN THIS FILE, in three ways that have each caused
		// a misreading:
		//
		//   NOT A RATE.  `r` is MONTHLY DOLLARS. Every other table here carries an annual marginal
		//                rate. calcIRMAA multiplies by 12.
		//   NOT CUMULATIVE.  A row is the whole charge for that band, not a marginal slice added to
		//                the bands below it.
		//   THE SURCHARGE ALONE, not the total premium. The base Part B + Part D premium is charged
		//                separately as `yr.medicareBase` in optimizer_core.js, so a row carrying the
		//                total would count the base twice. Each figure is the Part B income-related
		//                adjustment plus the Part D IRMAA for that band, per person; the MFJ rows are
		//                those same per-person amounts doubled, because a couple pays two of them.
		//
		// `l` IS THE FIRST DOLLAR OF THE BAND. CMS publishes the bands as "<= 218,000" and
		// "> 218,000 - <= 274,000", so the no-surcharge row ends AT 218,000 and Tier 1 begins at
		// 218,001. Write the number out; expressing it as `218000 - 1` is what put every boundary a
		// dollar low.
		//
		// `-none-` IS TIER ZERO. No fee, no tier. There are FIVE surcharge tiers and `stratIRMAATier`
		// indexes them 1 to 5. Published tables disagree about this - some count the below-IRMAA band
		// as the first - so a figure quoted from outside is off by one until you check its convention.
		//
		// THE TRAILING `l: Infinity` ROW IS TIER 5 AGAIN, standing in for the ceiling it does not
		// have. `l` is a floor, so nothing ever lands on it and its amount is never charged; it
		// exists so "the ceiling of tier n" can be written `brackets[n + 1].l` for every n including
		// the last. FEDERAL and the state tables carry the same terminator. The consequence is real:
		// asked to fill the top tier, computeBracketCeiling gets Infinity and has nothing to fill up
		// to - handled by nominalRateAtLimit's `limit = Inf` branch, which returns the top marginal
		// rate rather than the $NaN it once printed. Anything that LISTS tiers must drop this row and
		// `-none-`; Retirement_Projection.html and standalone/irmaa_and_rmds.html both do.
		//
		// Figures are tax year 2026 from the CMS fact sheet "2026 Medicare Parts A & B Premiums and
		// Deductibles". Check every band and both boundaries against it when refreshing.
				MFJ: {
			// A couple pays TWO of the same per-person surcharge, so the amounts are doubled from SGL
			// rather than restated - one place to be wrong instead of two.
			//
			// The FLOORS are not derivable and are listed. They double for the first four bands
			// (109,001 -> 218,001 and so on) and then stop: the top band begins at 500,000 single but
			// 750,000 joint, not 1,000,000.
			brackets: IRMAA_SGL_BRACKETS.map((b, i) => ({
				l: [218000, 218001, 274001, 342001, 410001, 750000, Infinity][i],
				monthlyCost: 2 * b.monthlyCost,
				tier: b.tier,
			}))
		},
		
		SGL: {
			brackets: IRMAA_SGL_BRACKETS
		}
	}, // IRMAA

	QCD: {
		YEAR: 2026,
		ELIGIBILITY_AGE: 70.5,   // IRC 408(d)(8): the IRA owner must have attained 70½
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
	// FLAT-RATE — 12 included  (15 total across all 51 jurisdictions)
	//   Included (single Infinity bracket):
	//     AZ  2.5%    CO  4.4%    GA  4.99%  IA  3.8%  ID  5.3% (with income threshold)
	//     IL  4.95%   IN  2.95%   KY  3.5%   MA  5.0% (9% over the surtax line)
	//     MI  4.25%   NC  3.99%   PA  3.07%
	//   Nebraska is NOT flat: its top rate is 4.55% but the schedule is graduated (2.46 / 3.51 / 4.55).
	//   Scheduled or possible reductions (the brackets govern; these are notes on where they head):
	//     GA — 4.99% from TY2026 (HB 463), then 0.125 points a year from 2027 toward 4.99%'s successor
	//     NE — LB754 phase-down continuing toward a 3.99% top rate
	//     IN — HEA 1002/1001 phase-down ongoing
	//     KY — 3.5% from 2026 under the HB 8 (2022) revenue triggers; further cuts possible
	//   Not yet coded (2 flat-rate states):
	//     LA  3.0%  constitutional amendment, effective 2025
	//     UT  4.65% cut from 4.85% in 2022; no further changes scheduled
	//
	// GRADUATED — 15 states + DC included  (27 total across all 51 jurisdictions)
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
	// FIXED (NON-INFLATION-INDEXED) BRACKETS — 10 included jurisdictions:
	//   AL, CT, DC, MD, MS, MT, NY, OH, SC, VA  (flagged INFLATION_INDEXED: false)
	//   Oregon's 9.9% line is one statutory row in an indexed table (`indexed: false` on the row).
	//   STD_INDEXED: false marks a statutory standard deduction: MS, NC, NY, VA.
	//   North Dakota is NOT one of them: it indexes its thresholds every year.
	//   Of the 11 missing graduated states, only RI and VT are CPI-indexed; rest are statutory.
	//
	// BASIS STEP-UP AT DEATH (BasisStepUp, per jurisdiction - IRC 1014):
	//   Fraction of unrealized brokerage gain whose cost basis resets at the FIRST spouse's
	//   death. 1.00 = community property (the whole account resets); 0.50 = common law (the
	//   decedent's half only). At the SECOND death the reset is always 100% for everyone, so
	//   that one is applied in the engine's terminal valuation and is not driven by this field.
	//   1.00 - 7 included:  AZ, CA, ID, NV, TX, WA, WI
	//   0.50 - the other 31 included jurisdictions.
	//   AK is 0.50 deliberately: community property there is opt-in by written agreement, not
	//   the default marital regime.
	//   LA and NM are community-property states but are not coded at all (they appear in the
	//   'Not yet coded' lists above), so they cannot be selected and need no designation.
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
		BasisStepUp: 1.00,
		YEAR: 2026,
		Default: true,
		NOTE: 'California SDI, a payroll tax on wages, is not included, so tax is understated for filers with wages. The renter\'s credit is not applied, so tax is overstated for renters who qualify.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		HSA_DEDUCTIBLE: false,   // CA does not conform to the federal HSA deduction; absent means deductible
		// FTB 2026 Schedules X and Y and the 2026 standard deduction (Tax News, October 2026). The 1%
		// Mental Health Services Act surcharge over $1M is in SURTAXES, not the rows: its line does not
		// index and the rows do.
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'FTB Tax News, October 2026: 2026 California tax rate schedules X and Y' },
			std:      { year: 2026, status: 'published', doc: 'FTB Tax News, October 2026: 2026 standard deduction' },
			ALLOWANCES: { year: 2026, status: 'published', doc: 'personal and senior exemption credits; the renter\'s and dependent credits are not modeled' },
		},
		ALLOWANCES: [
			{ apply: 'credit', amount: { perFiler: 158 }, indexed: true,
			  phaseout: { kind: 'linear', basis: 'federalAGI', start: { MFJ: 521561, SGL: 260778 }, step: 2500, reduce: 6, per: 'unit', ceil: true, indexed: true },
			  source: { year: 2026, status: 'derived', doc: 'FTB Tax News, Oct 2026: 158 per person, senior 158 more; phase-out lines are 2025\'s 504,411 / 252,203 x the 2026 CCPI 1.034, $6 per credit per $2,500 (R&TC 17054.1)' } },
			{ apply: 'credit', amount: { perSenior: 158, minAge: 65 }, indexed: true,
			  phaseout: { kind: 'linear', basis: 'federalAGI', start: { MFJ: 521561, SGL: 260778 }, step: 2500, reduce: 6, per: 'unit', ceil: true, indexed: true },
			  source: { year: 2026, status: 'derived', doc: 'FTB Tax News, Oct 2026: 158 per person, senior 158 more; phase-out lines are 2025\'s 504,411 / 252,203 x the 2026 CCPI 1.034, $6 per credit per $2,500 (R&TC 17054.1)' } },
		],
		SURTAXES: [
			{ over: { MFJ: 1000000, SGL: 1000000 }, rate: 0.01, indexed: false, source: { year: 2026, status: 'published', doc: 'R&TC 17043 (Mental Health Services Act): 1% on taxable income over $1,000,000, not indexed' } },
		],
        MFJ: {
            std: 11800,
            brackets: [
                { l: 22912, r: 0.01 }, { l: 54314, r: 0.02 }, { l: 85722, r: 0.04 },
                { l: 118996, r: 0.06 }, { l: 150394, r: 0.08 }, { l: 768218, r: 0.093 },
                { l: 921854, r: 0.103 }, { l: 1536426, r: 0.113 },
                { l: Infinity, r: 0.123 }
            ]
        },
        SGL: {
            std: 5900,
            brackets: [
                { l: 11456, r: 0.01 }, { l: 27157, r: 0.02 }, { l: 42861, r: 0.04 },
                { l: 59498, r: 0.06 }, { l: 75197, r: 0.08 }, { l: 384109, r: 0.093 },
                { l: 460927, r: 0.103 }, { l: 768213, r: 0.113 },
                { l: Infinity, r: 0.123 }
            ]
        }
    }, // CALIFORNIA
	

	// CONNECTICUT - 2025/2026
	CT: {
		STATE: 'Connecticut',
		BasisStepUp: 0.50,
		YEAR: 2026,  // No rate or bracket changes for 2026
		INFLATION_INDEXED: false,  // C.G.S. 12-700 thresholds are statutory
		NOTE: 'Retirement income: Connecticut exempts pension/IRA income on a graduated scale by income (100% exempt below $75,000 Single/$100,000 MFJ federal AGI, phasing down to fully taxable by $100,000/$150,000). Uses personal exemptions ($24,000 MFJ / $15,000 Single) instead of a standard deduction, phasing out between $48,000 and $71,000 of Connecticut AGI (joint; $30,000 to $44,000 single). Connecticut\'s personal tax credit for lower incomes is not applied, so tax may be overstated for those filers; its add-backs that recapture the lower rates at higher incomes are not applied either, so tax may be understated for higher-income filers. Social Security is taxed above these same income thresholds in real CT law; this calculator applies a flat 25% instead, which may overstate SS tax for filers below the threshold.',
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
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'C.G.S. 12-700: rates and thresholds unchanged for 2026' },
			std:      { year: 2026, status: 'published', doc: 'Connecticut has no standard deduction' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'exemption and its phase-out; the personal tax credit (Table E) and the 2% and recapture add-backs (Tables C, D) are not modeled' },
		},
		ALLOWANCES: [
			{ apply: 'deduction', amount: { flat: { MFJ: 24000, SGL: 15000 } }, indexed: false,
			  phaseout: { kind: 'linear', basis: 'stateAGI', start: { MFJ: 48000, SGL: 30000 }, step: 1000, reduce: 1000, ceil: true, indexed: false },
			  source: { year: 2026, status: 'published', doc: 'C.G.S. 12-702 and Form CT-1040 TCS: 24,000 / 15,000, less $1,000 for each $1,000 of CT AGI over 48,000 / 30,000; not indexed before 2028' } },
		],
		MFJ: {
			std: 0,
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
			std: 0,
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
		BasisStepUp: 0.50,
		YEAR: 2026,
		// `std` is left indexed: HB 463 raises it $750 a year from 2027 toward $36,000 joint, about
		// 2.3% a year, which plan inflation tracks more closely than holding it at 30,000 would.
		NOTE: 'Retirement income: Georgia exempts up to $65,000 of pension/IRA income per person age 65+ ($35,000 for ages 62–64). Georgia law also lets this exclusion cover interest, dividends, and capital gains up to the cap — this calculator only applies it to pension/IRA income, so tax may be slightly overstated for retirees with other investment income.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: {
			mode: 'cap', types: ['pension', 'ira'],
			ageGateTiers: [ { minAge: 62, capPerPerson: 35000 }, { minAge: 65, capPerPerson: 65000 } ]
		},
		SOURCES: {
			brackets:             { year: 2026, status: 'published', doc: 'HB 463 (2026): flat 4.99% from 2026-01-01' },
			std:                  { year: 2026, status: 'published', doc: 'HB 463 (2026): standard deduction 30,000 / 15,000 from 2026' },
			RETIREMENT_EXCLUSION: { year: 2026, status: 'published', doc: 'O.C.G.A. 48-7-27: 35,000 (62-64) / 65,000 (65+) per person; 70,000 from 2027' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'the 65+ additional deduction ($1,300 before 2026) may be folded into the 2026 standard deduction; not confirmed' },
		},
		ALLOWANCES: [],
		MFJ: {
			std: 30000,  // HB 463 (2026), applicable from TY2026; then +$750/yr from 2027 toward $36,000
			brackets: [
				{ l: Infinity, r: 0.0499 }  // Single flat rate
			]
		},
		SGL: {
			std: 15000,  // HB 463 (2026), applicable from TY2026; then +$750/yr from 2027
			brackets: [
				{ l: Infinity, r: 0.0499 }
			]
		},
		// Note: Rate decreases 0.1%/yr (10bp): 2027: 4.89%, etc., targeting 3.99%
	}, // GEORGIA

	// IDAHO - flat 5.3% (HB 40, enacted March 2025, retroactive to Jan 1 2025); SS fully exempt
	ID: {
		STATE: 'Idaho',
		BasisStepUp: 1.00,
		YEAR: 2026,
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		SOURCES: {
			brackets: { year: 2025, status: 'pending', doc: 'Tax Commission withholding update (Aug 2026): 5.3% for 2026; the 0% band is 2025\'s, the 2026 figure comes with the 2026 Form 40 instructions' },
			std:      { year: 2026, status: 'published', doc: 'Idaho conforms to the federal standard deduction, including the 65+ add-on' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'whether Idaho takes the federal senior deduction (2025-2028) is not checked' },
		},
		ALLOWANCES: [],
		MFJ: {
			std: 'FEDERAL_WITH_AGE',
			brackets: [
				{ l: 9622,    r: 0.0   },  // 0% on first ~$9.6k
				{ l: Infinity, r: 0.053 }   // 5.3% on income above threshold
			]
		},
		SGL: {
			std: 'FEDERAL_WITH_AGE',
			brackets: [
				{ l: 4811,    r: 0.0   },
				{ l: Infinity, r: 0.053 }
			]
		}
	}, // IDAHO

	// ILLINOIS -
	IL: {
		STATE: 'Illinois',
		BasisStepUp: 0.50,
		YEAR: 2026,  // Flat tax, rate unchanged; personal exemption increased to $2,925/person
		NOTE: 'Retirement-account distributions (IRA/401k/pension) are exempt from Illinois tax; interest, dividends, and capital gains remain taxable.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		// IL Schedule M subtracts federally-taxed retirement income (qualified plans, IRA distributions,
		// govt/RR/military pensions). Assumes retirees are past plan-qualification age.
		RETIREMENT_EXCLUSION: { mode: 'full', types: ['pension', 'ira'] },
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'Booklet IL-700-T (2026): flat 4.95%' },
			std:      { year: 2026, status: 'published', doc: 'Illinois has no standard deduction' },
			ALLOWANCES: { year: 2026, status: 'published', doc: 'exemption allowance, its income cliff and the 65+ exemption' },
		},
		ALLOWANCES: [
			{ apply: 'deduction', amount: { perFiler: 2925 }, indexed: true,
			  phaseout: { kind: 'steps', basis: 'federalAGI', indexed: false, table: { MFJ: [{ l: 500000, r: 1 }, { l: Infinity, r: 0 }], SGL: [{ l: 250000, r: 1 }, { l: Infinity, r: 0 }] } },
			  source: { year: 2026, status: 'published', doc: 'Booklet IL-700-T (2026): 2,925 per person; none above federal AGI 500,000 joint / 250,000 single' } },
			{ apply: 'deduction', amount: { perSenior: 1000, minAge: 65 }, indexed: false,
			  phaseout: { kind: 'steps', basis: 'federalAGI', indexed: false, table: { MFJ: [{ l: 500000, r: 1 }, { l: Infinity, r: 0 }], SGL: [{ l: 250000, r: 1 }, { l: Infinity, r: 0 }] } },
			  source: { year: 2026, status: 'published', doc: 'IL DOR: an additional 1,000 for each filer 65 or older' } },
		],
		MFJ: {
			std: 0,
			brackets: [
				{ l: Infinity, r: 0.0495 }  // Single flat rate
			]
		},
		SGL: {
			std: 0,
			brackets: [
				{ l: Infinity, r: 0.0495 }
			]
		},
		// Note: Exemptions phase out above $250K single / $500K MFJ federal AGI
	}, // ILLINOIS

	// MISSISSIPPI - full retirement-income exemption, no age/income limit
	MS: {
		STATE: 'Mississippi',
		BasisStepUp: 0.50,
		YEAR: 2026,
		INFLATION_INDEXED: false,  // the $10,000 0% band is statutory
		STD_INDEXED: false,
		NOTE: 'Mississippi fully exempts all retirement income (Social Security, pension, IRA/401k/403b, annuity, disability, military) - no age or income limit. Other income is taxed at 4% (2026) above the standard deduction, the personal exemption and a first $10,000 taxed at 0%. A married couple filing a combined return gets the 0% band on each spouse\'s income ($20,000 together) where this calculator gives one $10,000, so tax may be overstated by up to $400 a year. The rate is scheduled to fall to 3.75% in 2027; this calculator keeps 4% for every year.',
		SSTaxation: 0.00,
		RETIREMENT_EXCLUSION: { mode: 'full', types: ['pension', 'ira'] },
		// `std` is Mississippi's own standard deduction; it does not use the federal one. The law
		// indexes none of it, the exemptions or the $10,000 0% band, hence the two flags above.
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'MS DOR Individual Income Tax general information: 2026 rate 4% over $10,000' },
			std:      { year: 2026, status: 'published', doc: 'MS DOR Individual Income Tax general information: standard deduction 4,600 / 2,300' },
			ALLOWANCES: { year: 2026, status: 'published', doc: 'personal exemption and the 65+ exemption' },
		},
		ALLOWANCES: [
			{ apply: 'deduction', amount: { perFiler: 6000 }, indexed: false,
			  source: { year: 2026, status: 'published', doc: 'MS DOR Individual Income Tax general information: exemption 12,000 joint / 6,000 single' } },
			{ apply: 'deduction', amount: { perSenior: 1500, minAge: 65 }, indexed: false,
			  source: { year: 2026, status: 'published', doc: 'MS DOR Individual Income Tax general information: 1,500 more for each filer 65 or older' } },
		],
		MFJ: {
			std: 4600,
			brackets: [
				{ l: 10000, r: 0.0 },
				{ l: Infinity, r: 0.04 }
			]
		},
		SGL: {
			std: 2300,
			brackets: [
				{ l: 10000, r: 0.0 },
				{ l: Infinity, r: 0.04 }
			]
		},
	}, // MISSISSIPPI

	// IOWA - age 55+ full retirement-income exemption, flat 3.8% on remaining income
	IA: {
		STATE: 'Iowa',
		BasisStepUp: 0.50,
		YEAR: 2026,
		NOTE: 'Iowa fully exempts pension, IRA, 401(k), and other retirement-plan income for filers 55+ (Social Security is already separately exempt). Most Iowa school districts also levy a surtax (a percentage of the Iowa income tax owed, up to about 20%), plus a small emergency-services surtax; because Iowa still taxes interest, dividends, and capital gains, this calculator understates tax by that surtax on the investment-income portion for residents of surtax districts.',
		SSTaxation: 0.00,
		RETIREMENT_EXCLUSION: { mode: 'full', types: ['pension', 'ira'], ageGate: 55 },
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'Iowa Code 422.5A: flat 3.8% from 2025' },
			std:      { year: 2026, status: 'published', doc: 'Iowa starts from federal taxable income, so the federal standard deduction with its 65+ add-on' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'exemption credits; whether Iowa takes the federal senior deduction (2025-2028) is not checked' },
		},
		ALLOWANCES: [
			{ apply: 'credit', amount: { perFiler: 40 }, indexed: false,
			  source: { year: 2026, status: 'published', doc: 'IA 1040 instructions (2025): 40 per filer' } },
			{ apply: 'credit', amount: { perSenior: 20, minAge: 65 }, indexed: false,
			  source: { year: 2026, status: 'published', doc: 'IA 1040 instructions (2025): 20 more per filer 65 or older' } },
		],
		MFJ: {
			std: 'FEDERAL_WITH_AGE',
			brackets: [
				{ l: Infinity, r: 0.038 }
			]
		},
		SGL: {
			std: 'FEDERAL_WITH_AGE',
			brackets: [
				{ l: Infinity, r: 0.038 }
			]
		},
	}, // IOWA

	// MASSACHUSETTS -
	MA: {
		STATE: 'Massachusetts',
		BasisStepUp: 0.50,
		YEAR: 2026,  // Flat 5% rate; personal exemption $4,400/person
		NOTE: 'Retirement income: Massachusetts fully exempts pensions from federal, state, and municipal government employers (private pensions, IRA, and 401(k) distributions remain taxable at the flat 5% rate). This calculator does not apply that exclusion, so tax may be overstated for retirees with a government pension.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		// The 4% surtax over $1,107,750 is in SURTAXES.
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'mass.gov personal income tax rates: 5%, and the 4% surtax over $1,107,750 (2026)' },
			std:      { year: 2026, status: 'published', doc: 'Massachusetts has no standard deduction' },
			ALLOWANCES: { year: 2026, status: 'published', doc: 'personal exemption and the 65+ exemption' },
		},
		ALLOWANCES: [
			{ apply: 'deduction', amount: { perFiler: 4400 }, indexed: false,
			  source: { year: 2026, status: 'published', doc: 'mass.gov: personal exemption 4,400 per person, not indexed' } },
			{ apply: 'deduction', amount: { perSenior: 700, minAge: 65 }, indexed: false,
			  source: { year: 2026, status: 'published', doc: 'mass.gov: 700 more for each filer 65 or older' } },
		],
		SURTAXES: [
			{ over: { MFJ: 1107750, SGL: 1107750 }, rate: 0.04, indexed: true, source: { year: 2026, status: 'published', doc: 'mass.gov: 4% surtax on income over $1,107,750 (2026), the same line on a joint return, indexed' } },
		],
		MFJ: {
			std: 0,
			brackets: [
				{ l: Infinity, r: 0.05 }
			]
		},
		SGL: {
			std: 0,
			brackets: [
				{ l: Infinity, r: 0.05 }
			]
		},
	}, // MASSACHUSETTS

	// MARYLAND - 2026
	MD: {
		STATE: 'Maryland',
		BasisStepUp: 0.50,
		YEAR: 2026,
		INFLATION_INDEXED: false,  // Tax-General 10-105 thresholds are statutory
		NOTE: 'Retirement income: Maryland excludes up to $41,200 (the 2025 figure; 2026 is not yet published) of qualified pension income for filers 65+ or disabled, reduced dollar-for-dollar by Social Security/Railroad Retirement received (traditional IRA distributions do not qualify). Maryland county/local income taxes (2.25% to 3.3% depending on county) apply to all Maryland taxable income, including IRA/401(k) distributions, interest, dividends, and capital gains, and every county plus Baltimore City levies one; this calculator does not include them, so total tax is understated for essentially every Maryland resident.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: { mode: 'cap', types: ['pension'], cap: 41200, ageGate: 65, reduceBySS: true },
		CAPITAL_GAINS: {
			MFJ: { brackets: [ {l: 350000 - 1, r: 0.0}, {l: Infinity, r: 0.02 }] },
			SGL: { brackets: [ {l: 350000 - 1, r: 0.0}, {l: Infinity, r: 0.02 }] }
		},
		// Brackets: Comptroller Tax Rate Schedules I (single) and II (joint), as amended for tax years
		// after 2024 (6.25% and 6.5% top bands). Standard deduction: a flat amount, COLA-indexed from
		// 2025; the 2026 single figure is the withholding guide's, and joint is twice single by statute.
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'Comptroller tax alert rev. 2025-12-22; resident booklet Tax Rate Schedules I and II' },
			std:      { year: 2026, status: 'derived',   doc: '2026 withholding guide (single 3,400); joint = 2 x single per statute, confirm on 2026 Form 502 instructions' },
			RETIREMENT_EXCLUSION: { year: 2025, status: 'pending', doc: '2025 resident booklet pension exclusion cap 41,200; 2026 cap not yet published' },
			ALLOWANCES: { year: 2026, status: 'published', doc: 'personal exemption with its income steps, and the 65+ exemption' },
		},
		ALLOWANCES: [
			{ apply: 'deduction', amount: { perFiler: 3200 }, indexed: false,
			  phaseout: { kind: 'steps', basis: 'federalAGI', indexed: false, table: { MFJ: [{ l: 150000, r: 1 }, { l: 175000, r: 0.5 }, { l: 200000, r: 0.25 }, { l: Infinity, r: 0 }], SGL: [{ l: 100000, r: 1 }, { l: 125000, r: 0.5 }, { l: 150000, r: 0.25 }, { l: Infinity, r: 0 }] } },
			  source: { year: 2026, status: 'published', doc: 'Comptroller Form 502 instructions, exemption chart: 3,200, then 1,600 and 800, none above 200,000 joint / 150,000 single' } },
			{ apply: 'deduction', amount: { perSenior: 1000, minAge: 65 }, indexed: false,
			  source: { year: 2026, status: 'published', doc: 'Comptroller Technical Bulletin 51: 1,000 more for each filer 65 or older' } },
		],
		MFJ: {
			std: 6800,
			brackets: [
				{ l: 1000, r: 0.02 },
				{ l: 2000, r: 0.03 },
				{ l: 3000, r: 0.04 },
				{ l: 150000, r: 0.0475 },
				{ l: 175000, r: 0.05 },
				{ l: 225000, r: 0.0525 },
				{ l: 300000, r: 0.055 },
				{ l: 600000, r: 0.0575 },
				{ l: 1200000, r: 0.0625 },
				{ l: Infinity, r: 0.065 }
			]
		},
		SGL: {
			std: 3400,
			brackets: [
				{ l: 1000, r: 0.02 },
				{ l: 2000, r: 0.03 },
				{ l: 3000, r: 0.04 },
				{ l: 100000, r: 0.0475 },
				{ l: 125000, r: 0.05 },
				{ l: 150000, r: 0.0525 },
				{ l: 250000, r: 0.055 },
				{ l: 500000, r: 0.0575 },
				{ l: 1000000, r: 0.0625 },
				{ l: Infinity, r: 0.065 }
			]
		},
		// Note: Maryland also has local county taxes (2.25%-3.3%) added on top
		// Capital gains surtax of 2% for federal AGI > $350K (all statuses)
	}, // MARYLAND

	MI: {
		STATE: 'Michigan',
		BasisStepUp: 0.50,
		YEAR: 2026,
		NOTE: 'Retirement income: 2026 is the final phase-in year of Michigan\'s retirement-income tax relief — pension/IRA/401(k) income is exempt up to $67,610/person ($135,220 for a married couple). Filers born before 1946 have unlimited exemption, but only for government pensions; this calculator can\'t tell government from private pensions, so it only grants the unlimited exemption when both spouses were born before 1946, and applies the standard per-person cap otherwise. Tax may be overstated for a household born before 1946 with a private pension and only one qualifying spouse. Separately, about two dozen Michigan cities (Detroit at 2.4%, most others near 1%) levy a resident income tax that exempts pension and Social Security income but does tax interest, dividends, and capital gains; this calculator does not include it, so total tax is understated for residents of those cities who hold taxable brokerage income.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: { mode: 'cap', types: ['pension', 'ira'], capPerPerson: 67610, birthYearFullExemptBefore: 1946 },
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'Michigan Treasury notice 2026-04-15: 2026 individual income tax rate 4.25%' },
			std:      { year: 2026, status: 'published', doc: 'Michigan has no standard deduction' },
			ALLOWANCES: { year: 2026, status: 'published', doc: 'personal exemption; the special exemption for disability is not modeled' },
		},
		ALLOWANCES: [
			{ apply: 'deduction', amount: { perFiler: 5900 }, indexed: true,
			  source: { year: 2026, status: 'published', doc: 'Michigan Treasury 2026 withholding guide: personal exemption 5,900 per person' } },
		],
		MFJ: {
			std: 0,
			brackets: [
				{ l: Infinity, r: 0.0425 }  // Flat tax rate
			]
		},
		SGL: {
			std: 0,
			brackets: [
				{ l: Infinity, r: 0.0425 }  // Flat tax rate
			]
		}
	}, // MICHIGAN

	
	NY: {
		STATE: 'New York',
		BasisStepUp: 0.50,
		YEAR: 2026,
		INFLATION_INDEXED: false,  // Tax Law 601 thresholds are statutory
		STD_INDEXED: false,
		NOTE: 'Retirement income: New York fully exempts government and military pensions and excludes up to $20,000/person of private pension/IRA income (age 59½+). This calculator can\'t tell government from private pensions, so it applies the $20,000/person private-pension cap to all pension/IRA income — actual NY tax may be overstated for filers with a government pension. Separately, New York City and Yonkers residents owe a local income tax on the same base (taxable IRA and pension income, interest, dividends, and capital gains); New York City rates run about 3.08% to 3.88%. This calculator does not include the city tax, so total tax is understated for New York City and Yonkers residents.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: { mode: 'cap', types: ['pension', 'ira'], capPerPerson: 20000, ageGate: 60 },
		// FY2026 budget (signed May 2025): first 5 brackets each cut 0.1%; top brackets unchanged.
		// A further 0.1% cut phases in for 2027 (total 0.2% reduction fully phased in by 2027).
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'IT-2105-I (2026): tax rate schedules' },
			std:      { year: 2026, status: 'published', doc: 'Tax Law 614: standard deduction 16,050 / 8,000, not indexed' },
			ALLOWANCES: { year: 2026, status: 'published', doc: 'none: New York allows no personal exemption for the filers themselves' },
		},
		ALLOWANCES: [],
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
		BasisStepUp: 0.50,
		YEAR: 2026,
		STD_INDEXED: false,
		NOTE: 'Retirement income: North Carolina fully exempts government and military pension income for retirees with 5+ years of service credit as of August 12, 1989 (the Bailey settlement); other retirement income is fully taxable. This calculator does not apply that exclusion, so tax may be overstated for qualifying retirees.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'NCDOR 2026 estimated tax worksheet: flat 3.99%' },
			std:      { year: 2026, status: 'published', doc: 'G.S. 105-153.5: 25,500 / 12,750, not indexed' },
			ALLOWANCES: { year: 2026, status: 'published', doc: 'none: North Carolina has no personal exemption' },
		},
		ALLOWANCES: [],
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
		NOTE: 'Local income taxes: Portland-area residents owe the Metro Supportive Housing Services tax (1%) and the Multnomah County Preschool for All tax (1.5% to 3%) on taxable income above $125,000 single / $200,000 joint, including retirement distributions, interest, dividends, and capital gains; this calculator does not include them, so total tax is understated for higher-income Portland-area residents. Oregon\'s subtraction for federal income tax paid (up to about $8,500) is not applied, so tax is overstated. The personal exemption credit and the 65+ standard deduction add-on use their 2025 amounts.',
		BasisStepUp: 0.50,
		YEAR: 2026,
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		// The lower thresholds and `std` are indexed every year; the 9.9% thresholds (125,000 single /
		// 250,000 joint) are set in statute, so those rows carry `indexed: false`. Oregon's 2026
		// withholding formulas carry the tax schedule itself: the 2025 formulas match Publication
		// OR-17 (2025).
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'Oregon Withholding Tax Formulas 150-206-436 (Rev. 12-31-25)' },
			std:      { year: 2026, status: 'published', doc: 'Oregon Withholding Tax Formulas 150-206-436 (Rev. 12-31-25)' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'exemption credit and 65+ add-on at their 2025 amounts; the federal tax subtraction is not modeled' },
		},
		ALLOWANCES: [
			{ apply: 'credit', amount: { perFiler: 256 }, indexed: true,
			  phaseout: { kind: 'steps', basis: 'federalAGI', indexed: false, table: { MFJ: [{ l: 200000, r: 1 }, { l: Infinity, r: 0 }], SGL: [{ l: 100000, r: 1 }, { l: Infinity, r: 0 }] } },
			  source: { year: 2025, status: 'pending', doc: 'Oregon DOR credits page: 256 per exemption for 2025, none above federal AGI 200,000 joint / 100,000 single; the 2026 amount is not yet confirmed' } },
			{ apply: 'deduction', amount: { perSenior: { MFJ: 1000, SGL: 1200 }, minAge: 65 }, indexed: true,
			  source: { year: 2025, status: 'pending', doc: 'Oregon DOR publication: additional standard deduction 1,000 per spouse 65+, 1,200 single (2025)' } },
		],
		MFJ: {
			std: 5820,
			brackets: [
				{ l: 9100, r: 0.0475 }, { l: 22800, r: 0.0675 }, { l: 250000, r: 0.0875, indexed: false },
				{ l: Infinity, r: 0.099 }
			]
		},
		SGL: {
			std: 2910,
			brackets: [
				{ l: 4550, r: 0.0475 }, { l: 11400, r: 0.0675 }, { l: 125000, r: 0.0875, indexed: false },
				{ l: Infinity, r: 0.099 }
			]
		}
	}, // OREGON

	PA: {
		STATE: 'Pennsylvania',
		BasisStepUp: 0.50,
		YEAR: 2026,
		NOTE: 'Retirement-account distributions (IRA/401k/pension) after age 59½/retirement are exempt from Pennsylvania tax; interest, dividends, and capital gains remain taxable. Assumes retirees are 59½+. The Philadelphia School Income Tax (about 3.75%) applies to a Philadelphia resident\'s dividend income and certain non-bank interest (bank interest, capital gains, wages, and retirement distributions are exempt); this calculator does not include it, so total tax is understated for Philadelphia residents with dividend income. Pennsylvania\'s other local taxes (the Earned Income Tax and city wage taxes, including Philadelphia\'s) fall only on wages and business profits, so they do not affect a retiree\'s investment or retirement income.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		// PA does not tax distributions from eligible employer plans or IRAs after 59½/retirement.
		RETIREMENT_EXCLUSION: { mode: 'full', types: ['pension', 'ira'] },
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: '72 P.S. 7302: flat 3.07%' },
			std:      { year: 2026, status: 'published', doc: 'Pennsylvania has no standard deduction' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'no exemptions; the Tax Forgiveness credit for low incomes is not modeled' },
		},
		ALLOWANCES: [],
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
		BasisStepUp: 0.50,
		YEAR: 2026,
		INFLATION_INDEXED: false,  // Va. Code 58.1-320 thresholds are statutory
		STD_INDEXED: false,
		NOTE: 'Retirement income: Virginia offers a $12,000/person age deduction for filers 65+, phased out dollar-for-dollar above $75,000 AGI (MFJ, zero at $99,000) / $50,000 AGI (Single). This calculator approximates that phase-out in steps rather than a smooth dollar-for-dollar reduction, so tax may be slightly over- or understated depending on exactly where your income falls within the phase-out range; it also applies the deduction only to pension/IRA income rather than all income, which understates the deduction (overstates tax) for filers with other income sources. Standard deduction is the tax year 2026 amount published by Virginia Tax ($17,500 MFJ / $8,750 Single); the 2026 Appropriation Act raises it to $18,400 / $9,200 for 2027, which this calculator does not apply, so tax is slightly overstated from 2027. The top marginal rate is 5.75% on taxable income over $17,000, and there is no bracket above it.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: {
			mode: 'phaseout', types: ['pension', 'ira'], capPerPerson: 12000, ageGate: 65,
			brackets: {
				MFJ: [ {l: 75000, r: 1.00}, {l: 81000, r: 0.75}, {l: 87000, r: 0.50}, {l: 93000, r: 0.25}, {l: Infinity, r: 0} ],
				SGL: [ {l: 50000, r: 1.00}, {l: 53000, r: 0.75}, {l: 56000, r: 0.50}, {l: 59000, r: 0.25}, {l: Infinity, r: 0} ]
			}
		},
		// Standard deduction 8,750 / 17,500 for 2025 and 2026; the 2026 Appropriation Act sets 9,200 /
		// 18,400 for 2027, which this table does not carry. Rates top out at 5.75%; there is no 7% band.
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'Va. Code 58.1-320: 2% / 3% / 5% / 5.75%, not indexed' },
			std:      { year: 2026, status: 'published', doc: 'Virginia Tax: 2026 standard deduction 8,750 / 17,500' },
			ALLOWANCES: { year: 2026, status: 'published', doc: 'personal exemption and the 65+ exemption' },
		},
		ALLOWANCES: [
			{ apply: 'deduction', amount: { perFiler: 930 }, indexed: false,
			  source: { year: 2026, status: 'published', doc: 'Virginia Tax: 930 per filer' } },
			{ apply: 'deduction', amount: { perSenior: 800, minAge: 65 }, indexed: false,
			  source: { year: 2026, status: 'published', doc: 'Va. Code 58.1-322.03: 800 more for each filer 65 or older' } },
		],
		MFJ: {
			std: 17500,
			brackets: [
				{ l: 3000, r: 0.02 },
				{ l: 5000, r: 0.03 },
				{ l: 17000, r: 0.05 },
				{ l: Infinity, r: 0.0575 }
			]
		},
		SGL: {
			std: 8750,
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
		BasisStepUp: 0.50,
		YEAR: 2026,
		INFLATION_INDEXED: false,  // D.C. Code 47-1806.03 thresholds are statutory
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'D.C. Code 47-1806.03: rates and thresholds unchanged for 2026' },
			std:      { year: 2025, status: 'pending', doc: 'OTR: 2025 standard deduction 30,000 / 15,000; the 2026 figure is unpublished and contested (FY2027 BSA indexing vs federal conformity)' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'no personal exemption; any 65+ add-on is not checked' },
		},
		ALLOWANCES: [],
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

	// NEBRASKA - graduated 2.46 / 3.51 / 4.55 in 2026; the 4.55% TOP rate is the LB754 phase-down step
	// (5.20% top in 2025, 5.84% in 2024), heading for 3.99%. SS exempt per LB873.
	NE: {
		STATE: 'Nebraska',
		BasisStepUp: 0.50,
		YEAR: 2026,
		NOTE: 'Retirement income: Nebraska offers a retirement-income exclusion for qualifying IRA/401(k) and pension distributions, which this calculator does not apply, so tax is overstated for retirees who qualify. The personal exemption credit uses the 2025 amount.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits (LB873, eff. 2024)
		// 2026 Nebraska Tax Calculation Schedule (8-460-2026) and the Department's own rate chronology:
		// GRADUATED, not flat - 2.46%, then 3.51%, then 4.55%. The top two rows of the published schedule
		// are both 4.55% at different thresholds, which is one band here. Standard deductions and bracket
		// thresholds are indexed annually (8,600 / 17,200 in 2025 to 8,850 / 17,700 in 2026).
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'Nebraska Tax Calculation Schedule 8-460-2026' },
			std:      { year: 2026, status: 'published', doc: 'Nebraska Tax Calculation Schedule 8-460-2026: standard deduction' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'exemption credit at the 2025 amount; any 65+ standard deduction add-on is not checked' },
		},
		ALLOWANCES: [
			{ apply: 'credit', amount: { perFiler: 171 }, indexed: true,
			  source: { year: 2025, status: 'pending', doc: '171 per exemption for 2025, from secondary sources; the 2026 Form 1040N amount is not yet confirmed' } },
		],
		MFJ: {
			std: 17700,
			brackets: [
				{ l: 8250, r: 0.0246 },
				{ l: 49530, r: 0.0351 },
				{ l: Infinity, r: 0.0455 },
			]
		},
		SGL: {
			std: 8850,
			brackets: [
				{ l: 4130, r: 0.0246 },
				{ l: 24760, r: 0.0351 },
				{ l: Infinity, r: 0.0455 },
			]
		}
	}, // NEBRASKA

	// ALABAMA - brackets/rates unchanged since 2006; federal income tax deduction not modeled
	AL: {
		STATE: 'Alabama',
		BasisStepUp: 0.50,
		YEAR: 2026,
		INFLATION_INDEXED: false,
		NOTE: 'Retirement income: Alabama fully exempts defined-benefit pension income (public or private); IRA/401(k) distributions are taxable but get a $6,000 exclusion for filers 65+. Alabama also allows a deduction for federal income taxes paid, which this calculator does not apply, so tax is overstated. Brackets unchanged since 2006 (not inflation-adjusted).',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: [
			{ mode: 'full', types: ['pension'] },
			{ mode: 'cap', types: ['ira'], cap: 6000, ageGate: 65 }
		],
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'Ala. Code 40-18-5: 2% / 4% / 5%, thresholds unchanged since 2006 and not indexed' },
			std:      { year: 2026, status: 'published', doc: 'the standard deduction slides with income, so it is an ALLOWANCES rule' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'the sliding standard deduction and the personal exemption; the single filer\'s slide is not confirmed' },
		},
		ALLOWANCES: [
			{ apply: 'deduction', amount: { flat: { MFJ: 8500, SGL: 3000 } }, indexed: false,
			  phaseout: { kind: 'linear', basis: 'stateAGI', start: { MFJ: 25999, SGL: 25999 }, step: 500, reduce: { MFJ: 175, SGL: 25 }, ceil: true, floor: { MFJ: 5000, SGL: 2500 }, indexed: false },
			  source: { year: 2026, status: 'unverified', doc: 'ADOR standard deduction chart: joint 8,500 less 175 for each 500 of AL AGI over 25,999, down to 5,000; single 3,000 to 2,500 by 25' } },
			{ apply: 'deduction', amount: { perFiler: 1500 }, indexed: false,
			  source: { year: 2026, status: 'published', doc: 'Ala. Code 40-18-19: 3,000 joint / 1,500 single' } },
		],
		MFJ: {
			std: 0,
			brackets: [
				{ l: 1000, r: 0.02 },
				{ l: 6000, r: 0.04 },
				{ l: Infinity, r: 0.05 },
			]
		},
		SGL: {
			std: 0,
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
		BasisStepUp: 1.00,
		YEAR: 2026,
		NOTE: 'Retirement income: Arizona exempts up to $2,500/person of government pension income (Arizona, other states, or the U.S. government), and fully exempts military retirement pay. Private pension, IRA, and 401(k) income remain fully taxable. This calculator does not apply the government-pension exclusion, so tax may be overstated for qualifying retirees. Arizona\'s extra exemption for filers 65 or older is not applied either, so tax is overstated for them.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'A.R.S. 43-1011: flat 2.5%' },
			std:      { year: 2026, status: 'published', doc: 'A.R.S. 43-1041: the federal standard deduction' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'the 65+ exemption is not applied: sources give 2,100 and 2,300' },
		},
		ALLOWANCES: [],
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
		BasisStepUp: 0.50,
		YEAR: 2026,
		NOTE: 'Retirement income: as of 2026, Colorado removed all dollar caps on the pension/annuity/IRA subtraction for filers 55+ (the prior $20,000 age 55–64 / $24,000 age 65+ caps no longer apply). Fully exempt once at least one spouse is 55 or older. Social Security: Colorado is treated here as not taxing benefits, which is correct from age 65, where the subtraction is unlimited. From 55 to 64 the full subtraction applies only below $75,000 AGI (single) or $95,000 (joint) and is capped at $20,000 above that, so tax is understated for a Colorado retiree in that age band with income over the limit.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: { mode: 'full', types: ['pension', 'ira'], ageGate: 55 },
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'C.R.S. 39-22-104: flat 4.4%; no TABOR-surplus rate reduction announced for 2026' },
			std:      { year: 2026, status: 'published', doc: 'Colorado starts from federal taxable income, so the federal standard deduction with its 65+ add-on' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'whether Colorado takes the federal senior deduction (2025-2028) is not checked' },
		},
		ALLOWANCES: [],
		MFJ: {
			std: 'FEDERAL_WITH_AGE',  // CO uses federal standard deduction
			brackets: [
				{ l: Infinity, r: 0.044 }
			]
		},
		SGL: {
			std: 'FEDERAL_WITH_AGE',
			brackets: [
				{ l: Infinity, r: 0.044 }
			]
		},
	}, // COLORADO

	// INDIANA - flat 2.95% for 2026 (HEA 1002/1001 phase-down; county taxes not modeled)
	IN: {
		STATE: 'Indiana',
		BasisStepUp: 0.50,
		YEAR: 2026,
		NOTE: 'Indiana county income taxes (roughly 0.5% to 3% depending on county) apply to Indiana adjusted gross income, including IRA/401(k) distributions, interest, dividends, and capital gains, and all 92 counties levy one; this calculator does not include them, so total tax is understated for essentially every Indiana resident.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'IC 6-3-2-1: 2.95% for 2026' },
			std:      { year: 2026, status: 'published', doc: 'Indiana has no standard deduction' },
			ALLOWANCES: { year: 2026, status: 'published', doc: 'personal exemption and the two 65+ exemptions' },
		},
		ALLOWANCES: [
			{ apply: 'deduction', amount: { perFiler: 1000 }, indexed: false,
			  source: { year: 2026, status: 'published', doc: 'IC 6-3-1-3.5: 1,000 per filer' } },
			{ apply: 'deduction', amount: { perSenior: 1000, minAge: 65 }, indexed: false,
			  source: { year: 2026, status: 'published', doc: 'Indiana DOR: 1,000 more for each filer 65 or older' } },
			{ apply: 'deduction', amount: { perSenior: 500, minAge: 65 }, indexed: false,
			  phaseout: { kind: 'steps', basis: 'federalAGI', indexed: false, table: { MFJ: [{ l: 39999, r: 1 }, { l: Infinity, r: 0 }], SGL: [{ l: 39999, r: 1 }, { l: Infinity, r: 0 }] } },
			  source: { year: 2026, status: 'published', doc: 'Indiana DOR: 500 more for each filer 65 or older when federal AGI is under 40,000' } },
		],
		MFJ: {
			std: 0,
			brackets: [
				{ l: Infinity, r: 0.0295 }
			]
		},
		SGL: {
			std: 0,
			brackets: [
				{ l: Infinity, r: 0.0295 }
			]
		},
	}, // INDIANA

	// KENTUCKY - flat 3.5% for 2026 (down from 4.0% under the HB 8 revenue triggers)
	KY: {
		STATE: 'Kentucky',
		BasisStepUp: 0.50,
		YEAR: 2026,
		NOTE: 'Rate and standard deduction are tax year 2026 values from the Kentucky Department of Revenue; the flat rate fell from 4.0% to 3.5% on 2026-01-01 under the 2022 tax triggers. Retirement income: Kentucky exempts up to $31,110/person of pension/IRA/401(k) income.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: { mode: 'cap', types: ['pension', 'ira'], capPerPerson: 31110 },
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'Kentucky DOR: 3.5% for 2026 under the HB 8 (2022) triggers' },
			std:      { year: 2026, status: 'published', doc: 'Kentucky DOR: 2026 standard deduction 3,360' },
			ALLOWANCES: { year: 2026, status: 'published', doc: 'none: Kentucky repealed its personal tax credits' },
		},
		ALLOWANCES: [],
		MFJ: {
			std: 3360,  // KY standard deduction per return, same for every filing status (2026)
			brackets: [
				{ l: Infinity, r: 0.035 }
			]
		},
		SGL: {
			std: 3360,
			brackets: [
				{ l: Infinity, r: 0.035 }
			]
		},
	}, // KENTUCKY

	// MAINE - 2026 (brackets inflation-adjusted annually by Maine Revenue Services)
	ME: {
		STATE: 'Maine',
		BasisStepUp: 0.50,
		YEAR: 2026,
		NOTE: 'Maine\'s standard deduction and personal exemption both phase out at higher incomes, which this calculator does not apply, so tax may be understated for higher-income filers. Retirement income: Maine deducts up to $49,824 of pension/IRA income, reduced dollar-for-dollar by Social Security/Railroad Retirement received. The deduction phases out above $125,000 AGI (Single)/$250,000 (MFJ); this calculator applies the phase-out as a single step at the threshold rather than Maine\'s actual gradual reduction, so tax may be overstated for filers just above the threshold. Brackets reflect 2026 values (inflation-adjusted by Maine Revenue Services); rates unchanged.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: {
			mode: 'phaseout', types: ['pension', 'ira'], cap: 49824, reduceBySS: true,
			brackets: {
				SGL: [ {l: 125000, r: 1.00}, {l: Infinity, r: 0} ],
				MFJ: [ {l: 250000, r: 1.00}, {l: Infinity, r: 0} ]
			}
		},
		// `std` is Maine's own standard deduction; Maine does not use the federal one. The 2% surcharge
		// over $1,500,000 joint / $1,000,000 single is in SURTAXES.
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'MRS 2026 individual income tax rate schedule (rev. 2026-05-20)' },
			std:      { year: 2026, status: 'published', doc: 'MRS 2026 rate schedule: standard deduction 31,400 / 15,700' },
			RETIREMENT_EXCLUSION: { year: 2026, status: 'published', doc: 'MRS 2026 rate schedule: pension income deduction cap' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'personal exemption; its phase-out and the standard deduction\'s are not modeled' },
		},
		ALLOWANCES: [
			{ apply: 'deduction', amount: { perFiler: 5300 }, indexed: true,
			  source: { year: 2026, status: 'published', doc: 'MRS 2026 rate schedule and 2026 Form 1040ES: personal exemption 5,300' } },
		],
		SURTAXES: [
			{ over: { MFJ: 1500000, SGL: 1000000 }, rate: 0.02, indexed: false, source: { year: 2026, status: 'published', doc: 'MRS 2026 rate schedule: 2% on taxable income over 1,500,000 joint / 1,000,000 single' } },
		],
		MFJ: {
			std: 31400,
			brackets: [
				{ l: 54850, r: 0.058 },
				{ l: 129750, r: 0.0675 },
				{ l: Infinity, r: 0.0715 },
			]
		},
		SGL: {
			std: 15700,
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
		BasisStepUp: 0.50,
		YEAR: 2026,
		NOTE: 'Brackets and standard deduction are tax year 2026 values published by the Minnesota Department of Revenue (inflation-adjusted +2.369% from 2025; rates unchanged). Minnesota taxes Social Security — 85% of SS is included in state taxable income at moderate-to-high incomes. Lower-income filers may qualify for a Social Security subtraction that this calculator does not apply, so tax may be overstated for those filers. Minnesota\'s extra standard deduction for filers 65 or older is not applied, so tax is overstated for them.',
		SSTaxation: 0.85,
		// MN does NOT conform to the federal standard deduction; it publishes its own, which is
		// lower. `std: 'FEDERAL'` was set here on 2026-06-30 alongside a comment saying MN used the
		// federal amount, which handed every MN plan $800 single / $1,600 joint too much deduction.
		// Source: MN DOR, "Minnesota income tax brackets, standard deduction and dependent exemption
		// amounts for tax year 2026", 2025-12-16.
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'MN DOR 2025-12-16: tax year 2026 brackets' },
			std:      { year: 2026, status: 'published', doc: 'MN DOR 2025-12-16: tax year 2026 standard deduction' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'the 65+ additional standard deduction and the deduction\'s high-income phase-out are not applied' },
		},
		ALLOWANCES: [],
		MFJ: {
			std: 30600,
			brackets: [
				{ l: 48700, r: 0.0535 },
				{ l: 193480, r: 0.0680 },
				{ l: 337930, r: 0.0785 },
				{ l: Infinity, r: 0.0985 },
			]
		},
		SGL: {
			std: 15300,
			brackets: [
				{ l: 33310, r: 0.0535 },
				{ l: 109430, r: 0.0680 },
				{ l: 203150, r: 0.0785 },
				{ l: Infinity, r: 0.0985 },
			]
		},
	}, // MINNESOTA

	// MONTANA - HB 192 two-bracket reform eff. 2024; brackets NOT inflation-indexed — unchanged through 2026
	// SSTaxation 0.85: MT exempts SS for low income; at moderate-high income, 85% is taxable (matching federal)
	MT: {
		STATE: 'Montana',
		BasisStepUp: 0.50,
		YEAR: 2026,
		INFLATION_INDEXED: false,
		NOTE: 'Retirement income: Montana allows a small income-tested retirement subtraction (being phased out) that this calculator does not apply, so tax may be overstated for lower-income retirees. Rates, bracket thresholds and the standard deduction are tax year 2026 values (HB 337; the standard deduction conforms to the federal amount). Bracket thresholds are not inflation-adjusted, so they move only when the legislature moves them; the top rate falls again to 5.4% in 2027. Capital gains: this calculator taxes capital gains at the full ordinary state rate. Montana instead taxes long-term capital gains at reduced rates below its ordinary top rate. Tax on a brokerage withdrawal is therefore overstated for this state, and the overstatement grows with the size of the gain realized, so a plan that harvests a large gain in one year is penalized most.',
		SSTaxation: 0.85,
		// HB 337 (2025) widened the 4.7% band and cut the top rate: for 2026 the 5.65% rate starts
		// above $47,500 single / $95,000 joint, falling again to 5.4% in 2027. The figures here were
		// the 2024 ones - a $20,500 single threshold and a 5.9% top rate - until 2026-09-22.
		// Montana also stopped using its own 20%-of-AGI standard deduction when SB 399 conformed it
		// to the federal amount, so the cap approximation the NOTE describes no longer applies.
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'HB 337 (2025): 4.7% / 5.65% for 2026, thresholds not indexed' },
			std:      { year: 2026, status: 'published', doc: 'SB 399: Montana starts from federal taxable income, so the federal standard deduction with its 65+ add-on' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'whether Montana takes the federal senior deduction (2025-2028) is not checked' },
		},
		ALLOWANCES: [],
		MFJ: {
			std: 'FEDERAL_WITH_AGE',
			brackets: [
				{ l: 95000, r: 0.047 },
				{ l: Infinity, r: 0.0565 },
			]
		},
		SGL: {
			std: 'FEDERAL_WITH_AGE',
			brackets: [
				{ l: 47500, r: 0.047 },
				{ l: Infinity, r: 0.0565 },
			]
		},
	}, // MONTANA

	// NORTH DAKOTA - HB 1158 rate cuts eff. 2024; brackets NOT inflation-indexed — unchanged through 2026
	ND: {
		STATE: 'North Dakota',
		NOTE: 'Capital gains: this calculator taxes capital gains at the full ordinary state rate. North Dakota instead allows a deduction of up to 40% of capital gains income. Tax on a brokerage withdrawal is therefore overstated for this state, and the overstatement grows with the size of the gain realized, so a plan that harvests a large gain in one year is penalized most.',
		BasisStepUp: 0.50,
		YEAR: 2026,
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		// 2026 Forms ND-1 and ND-EZ Tax Rate Schedules (Form ND-1ES, SFN 28709, 12-2025): a 0% band,
		// then 1.95%, then 2.50%. The thresholds move with inflation each year - the 0% band top went
		// from 48,475 in 2025 to 49,575 in 2026 - so they are not flagged as statutory-fixed.
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: '2026 Form ND-1ES tax rate schedules' },
			std:      { year: 2026, status: 'published', doc: 'North Dakota starts from federal taxable income, so the federal standard deduction with its 65+ add-on' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'whether North Dakota takes the federal senior deduction (2025-2028) is not checked' },
		},
		ALLOWANCES: [],
		MFJ: {
			std: 'FEDERAL_WITH_AGE',  // ND taxable income starts from federal taxable income
			brackets: [
				{ l: 82800, r: 0.00 },
				{ l: 304850, r: 0.0195 },
				{ l: Infinity, r: 0.025 },
			]
		},
		SGL: {
			std: 'FEDERAL_WITH_AGE',
			brackets: [
				{ l: 49575, r: 0.00 },
				{ l: 250400, r: 0.0195 },
				{ l: Infinity, r: 0.025 },
			]
		},
	}, // NORTH DAKOTA

	// OHIO - HB 96 (FY2026-27 budget): flat 2.75% on non-business income above $26,050 effective TY 2026
	// (the prior 3.5% top bracket is repealed; the final phase-down of the 2-bracket HB 33 schedule).
	// Bracket thresholds are statutory fixed values; Ohio does not CPI-index income brackets.
	OH: {
		STATE: 'Ohio',
		BasisStepUp: 0.50,
		YEAR: 2026,
		INFLATION_INDEXED: false,
		NOTE: 'Retirement income: Ohio provides a retirement-income tax credit of up to $200 (not a deduction), scaled by the amount of retirement income received, for filers with income under $100,000. 2026: Ohio moved to a flat 2.75% rate on non-business income above $26,050 (the prior 3.5% top bracket was repealed). Thresholds are not inflation-adjusted. Ohio school districts that use the "traditional" tax base also levy a school district income tax on all Ohio taxable income, including retirement distributions, interest, dividends, and capital gains (rates about 0.25% to 2%); this calculator does not include it, so total tax is understated for residents of those districts. Ohio municipal and city income taxes generally reach only wages and business profits, not a retiree\'s investment or retirement income, so they are correctly excluded here.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: {
			mode: 'credit', types: ['pension', 'ira'], magiGate: 100000,
			creditTiers: [
				{l: 500, amount: 0}, {l: 1500, amount: 25}, {l: 3000, amount: 50},
				{l: 5000, amount: 80}, {l: 8000, amount: 130}, {l: Infinity, amount: 200}
			]
		},
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'HB 96 (2025): 0% to 26,050, then 2.75% from 2026; not indexed' },
			std:      { year: 2026, status: 'published', doc: 'Ohio has no standard deduction' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'personal exemption with its MAGI tiers; the senior and joint filing credits are not modeled' },
		},
		ALLOWANCES: [
			{ apply: 'deduction', amount: { perFiler: 2400 }, indexed: false,
			  phaseout: { kind: 'steps', basis: 'magi', indexed: false, table: { MFJ: [{ l: 40000, value: 2400 }, { l: 80000, value: 2150 }, { l: 500000, value: 1900 }, { l: Infinity, value: 0 }], SGL: [{ l: 40000, value: 2400 }, { l: 80000, value: 2150 }, { l: 500000, value: 1900 }, { l: Infinity, value: 0 }] } },
			  source: { year: 2026, status: 'published', doc: 'R.C. 5747.025 as amended by HB 96 (LSC analysis): 2,400 / 2,150 / 1,900 per person by MAGI, none above 500,000' } },
		],
		MFJ: {
			std: 0,
			brackets: [
				{ l: 26050, r: 0.00 },
				{ l: Infinity, r: 0.0275 },
			]
		},
		SGL: {
			std: 0,
			brackets: [
				{ l: 26050, r: 0.00 },
				{ l: Infinity, r: 0.0275 },
			]
		},
	}, // OHIO

	// SOUTH CAROLINA - H. 4216 (2026): two rates, 1.99% and 5.21%, and the SC Income Adjusted Deduction.
	// INFLATION_INDEXED: false holds the $30,000 threshold flat across a projection (see NOTE).
	SC: {
		STATE: 'South Carolina',
		BasisStepUp: 0.50,
		YEAR: 2026,
		INFLATION_INDEXED: false,
		NOTE: 'South Carolina rewrote its individual income tax for 2026 (H. 4216): two rates, 1.99% and 5.21%, and a state deduction (the South Carolina Income Adjusted Deduction) in place of the federal standard deduction. That deduction is REDUCED at higher federal AGI, and this calculator always applies the full amount, so tax is understated for higher-income households. The $30,000 rate threshold is held flat here rather than indexed, which overstates tax in later years of a long plan. Retirement income: South Carolina allows a deduction of up to $10,000 of retirement income (401(k), IRA, or pension) for filers 65+, plus a separate age-based deduction of up to $15,000 (the two are coordinated, not additive). This calculator applies the $15,000 per person 65 or older, which is what the two give together; the retirement deduction for filers under 65 is not applied, so tax is overstated for them. Capital gains: this calculator taxes capital gains at the full ordinary state rate. South Carolina instead allows a 44% deduction on net long-term capital gains. Tax on a brokerage withdrawal is therefore overstated for this state, and the overstatement grows with the size of the gain realized, so a plan that harvests a large gain in one year is penalized most.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		// H. 4216, from TY2026: two brackets, 1.99% below 30,000 of South Carolina taxable income and
		// 5.21% above it. The published form states the upper band as "5.21% minus $966", which is the
		// same schedule written as a single rate on the whole amount: 0.0521x - 966 equals
		// 597 + 0.0521(x - 30,000), and 597 is 1.99% of the first 30,000.
		//
		// `std` is the South Carolina Income Adjusted Deduction (SCIAD), not the federal figure: the state
		// decoupled from IRC 63(b)-(g) and now starts from federal AGI, which is the base this engine
		// already builds. The SCIAD is reduced at higher federal AGI by a formula published in SCDOR
		// Information Letter #26-20; that reduction is not modeled - see NOTE.
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'H. 4216 (2026): 1.99% / 5.21% at 30,000' },
			std:      { year: 2026, status: 'published', doc: 'H. 4216 (2026): SC Income Adjusted Deduction 30,000 / 15,000 (its AGI reduction is not applied)' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'the 65+ deduction; its coordination with the retirement deduction is per person in law and per household here' },
		},
		ALLOWANCES: [
			{ apply: 'deduction', amount: { perSenior: 15000, minAge: 65 }, indexed: false, offsetBy: 'retirementExclusion',
			  source: { year: 2026, status: 'published', doc: 'S.C. Code 12-6-1170: 15,000 for each filer 65 or older, less any retirement deduction claimed' } },
		],
		MFJ: {
			std: 30000,
			brackets: [
				{ l: 30000, r: 0.0199 },
				{ l: Infinity, r: 0.0521 },
			]
		},
		SGL: {
			std: 15000,
			brackets: [
				{ l: 30000, r: 0.0199 },
				{ l: Infinity, r: 0.0521 },
			]
		},
	}, // SOUTH CAROLINA

	// WISCONSIN - 2026 (brackets inflation-adjusted annually by WI DOR; rates unchanged since 2024 reform)
	// Std deduction phases out at higher income — using base amount
	WI: {
		STATE: 'Wisconsin',
		BasisStepUp: 1.00,
		YEAR: 2026,
		NOTE: 'Retirement income: starting with the 2025 tax year (filed 2026), Wisconsin exempts up to $24,000/person ($48,000 for a married couple) of pension/IRA income for filers 67+, with no income limit. Brackets and the standard deduction maximum are tax year 2026 values from the Wisconsin Department of Revenue, and include the 2025 Act 15 widening of the 4.40% band. Standard deduction phases out at higher incomes; base amounts are used here, so results may understate tax for high-income filers. Capital gains: this calculator taxes capital gains at the full ordinary state rate. Wisconsin instead excludes 30% of net long-term capital gains (60% for qualifying farm assets). Tax on a brokerage withdrawal is therefore overstated for this state, and the overstatement grows with the size of the gain realized, so a plan that harvests a large gain in one year is penalized most.',
		SSTaxation: 0.00,  // Does not tax Social Security benefits
		RETIREMENT_EXCLUSION: { mode: 'cap', types: ['pension', 'ira'], capPerPerson: 24000, ageGate: 67 },
		// 2025 Wis. Act 15 widened the 4.40% band a long way - single from $29,370 to $50,480, joint
		// from $39,150 to $67,300 - for tax years after 2024. This table missed it until 2026-09-22
		// and taxed the whole gap at 5.30% instead. Figures are tax year 2026 from the WI DOR 2026
		// Form 1-ES instructions; `std` is the MAXIMUM, which phases out with income (see NOTE).
		SOURCES: {
			brackets: { year: 2026, status: 'published', doc: 'WI DOR 2026 Form 1-ES instructions: tax rate schedules' },
			std:      { year: 2026, status: 'published', doc: 'WI DOR 2026 Form 1-ES instructions: standard deduction maximum' },
			ALLOWANCES: { year: 2026, status: 'unverified', doc: 'personal and 65+ exemptions; the standard deduction\'s income phase-out is not applied' },
		},
		ALLOWANCES: [
			{ apply: 'deduction', amount: { perFiler: 700 }, indexed: false,
			  source: { year: 2026, status: 'published', doc: 'WI DOR Pub 106: 700 per filer' } },
			{ apply: 'deduction', amount: { perSenior: 250, minAge: 65 }, indexed: false,
			  source: { year: 2026, status: 'published', doc: 'WI DOR Pub 106: 250 more for each filer 65 or older' } },
		],
		MFJ: {
			std: 25840,
			brackets: [
				{ l: 20150, r: 0.035 },
				{ l: 69260, r: 0.044 },
				{ l: 443630, r: 0.053 },
				{ l: Infinity, r: 0.0765 },
			]
		},
		SGL: {
			std: 13960,
			brackets: [
				{ l: 15110, r: 0.035 },
				{ l: 51950, r: 0.044 },
				{ l: 332720, r: 0.053 },
				{ l: Infinity, r: 0.0765 },
			]
		},
	}, // WISCONSIN


}; // TAXdata

// No-income-tax states, each as its own dropdown entry (Object.keys(TAXData).length===2 drives
// the dropdown — see generateStateOptions() in optimizer_ui.js). Shared shape via spread, not by reference,
// so any future per-state divergence (e.g. NH's now-repealed interest/dividends tax) is safe.
const NO_TAX_SHELL = {
    YEAR: 2026,
    SSTaxation: 0.00,  // no tax on Social Security benefits
    BasisStepUp: 0.50, // common law; the 3 community-property no-tax states override below
    MFJ: { std: 0, brackets: [ { l: Infinity, r: 0 } ] },
    SGL: { std: 0, brackets: [ { l: Infinity, r: 0 } ] }
};
TAXData.AK = { STATE: 'Alaska', ...NO_TAX_SHELL };
TAXData.FL = { STATE: 'Florida', ...NO_TAX_SHELL };
TAXData.NV = { STATE: 'Nevada', ...NO_TAX_SHELL, BasisStepUp: 1.00 };
TAXData.NH = { STATE: 'New Hampshire', ...NO_TAX_SHELL,
    NOTE: 'New Hampshire fully repealed its tax on interest and dividends effective January 1, 2025.' };
TAXData.SD = { STATE: 'South Dakota', ...NO_TAX_SHELL };
TAXData.TN = { STATE: 'Tennessee', ...NO_TAX_SHELL };
TAXData.TX = { STATE: 'Texas', ...NO_TAX_SHELL, BasisStepUp: 1.00 };
TAXData.WA = { STATE: 'Washington', ...NO_TAX_SHELL, BasisStepUp: 1.00,
    NOTE: 'Washington levies no income tax, but it DOES tax long-term capital gains: 7% on gain above a standard deduction of about $278,000 (2025, indexed annually), and 9.9% on gain above $1,000,000. Retirement accounts and real estate are exempt, so IRA, Roth and pension withdrawals are unaffected; only realized brokerage gains would be taxed. This calculator does not apply it, so tax is understated for a Washington resident whose brokerage gains in a single year clear that deduction - which a large harvest year can do.' };
TAXData.WY = { STATE: 'Wyoming', ...NO_TAX_SHELL };

// ─────────────────────────────────────────────────────────────────────────
// Where each state figure comes from. Every state that levies an income tax carries a SOURCES map
// with one entry per figure it holds (`brackets` and `std` always, `RETIREMENT_EXCLUSION` and the
// rest once they are checked): { year, status, doc }. `year` is the tax year the figure is for,
// `doc` names the publication or statute, and `status` is one of:
//   published   read from the state's own publication or law for that year
//   derived     computed from published figures (e.g. joint = 2 x single), not printed anywhere yet
//   pending     the state has not published this year's figure; the table holds the latest one
//   unverified  carried over, not yet checked against a publication
// One YEAR stamp per state is not enough: a state stamped with the current year once carried a
// two-year-old schedule. checkStateSources() fails a figure behind TAXData.FEDERAL.YEAR unless it is
// marked pending, so rolling the federal table forward a year forces every state to be re-checked.
// ─────────────────────────────────────────────────────────────────────────
const SOURCE_STATUSES = ['published', 'derived', 'pending', 'unverified'];
// SOURCES.ALLOWANCES speaks for the LIST: whether the state's exemptions, credits and add-ons have been
// checked as a whole. Each rule in the list also carries its own `source` for its figures.
const SOURCE_FIELDS_REQUIRED = ['brackets', 'std', 'ALLOWANCES'];

// Returns { errors, flagged }: `errors` must be empty; `flagged` lists every figure that is not
// 'published', so a suite run can print what is still waiting on a publication. Takes the table as
// an argument so a test can hand it a broken one.
function checkStateSources(td = TAXData) {
    const errors = [], flagged = [];
    const fedYear = td.FEDERAL.YEAR;
    for (const code of Object.keys(td)) {
        const st = td[code];
        if (!st || !st.STATE || !st.MFJ || !st.SGL) continue;
        const levies = [st.MFJ, st.SGL].some(f => (f.brackets || []).some(b => b.r > 0));
        if (!levies) continue;   // a no-income-tax shell holds no figures to source
        const src = st.SOURCES;
        if (!src) { errors.push(`${code}: no SOURCES`); continue; }
        for (const f of SOURCE_FIELDS_REQUIRED) if (!src[f]) errors.push(`${code}: SOURCES.${f} missing`);
        const checkEntry = (where, label, e) => {
            if (!e || typeof e !== 'object') { errors.push(`${where} is not an entry`); return; }
            if (!SOURCE_STATUSES.includes(e.status)) errors.push(`${where}: unknown status '${e.status}'`);
            if (typeof e.doc !== 'string' || !e.doc.trim()) errors.push(`${where}: no doc`);
            if (!Number.isInteger(e.year)) errors.push(`${where}: year is not a whole number`);
            else if (e.year < fedYear && e.status !== 'pending')
                errors.push(`${where} is for ${e.year}, behind the ${fedYear} federal table, and not marked pending`);
            if (e.status !== 'published') flagged.push(`${label}: ${e.status} ${e.year} (${e.doc})`);
        };
        for (const [field, e] of Object.entries(src)) {
            if (!SOURCE_FIELDS_REQUIRED.includes(field) && st[field] === undefined)
                errors.push(`${code}: SOURCES.${field} names a field the state does not have`);
            checkEntry(`${code}: SOURCES.${field}`, `${code}.${field}`, e);
        }
        for (const list of ['ALLOWANCES', 'SURTAXES'])
            (Array.isArray(st[list]) ? st[list] : []).forEach((rule, i) => {
                if (!rule || !rule.source) errors.push(`${code}: ${list}[${i}] has no source`);
                else checkEntry(`${code}: ${list}[${i}].source`, `${code}.${list}[${i}]`, rule.source);
            });
    }
    return { errors, flagged };
}

// The shape of every ALLOWANCES rule, against the grammar described at evaluateAllowance. Returns the
// problems as strings; an empty list means every income-tax state has a list and every rule in it
// can be evaluated. Takes the table as an argument so a test can hand it a broken one.
const ALLOWANCE_RULE_KEYS = ['apply', 'amount', 'phaseout', 'offsetBy', 'indexed', 'source'];
const ALLOWANCE_AMOUNT_KINDS = ['flat', 'perFiler', 'perSenior', 'pctOfTax'];
function checkStateAllowances(td = TAXData) {
    const errors = [];
    const isNum = v => typeof v === 'number' && !Number.isNaN(v);
    const byStatus = (o, ok) => !!o && typeof o === 'object' && ok(o.MFJ) && ok(o.SGL);
    const ladder = (rows, rowOk) => Array.isArray(rows) && rows.length > 0 && rows[rows.length - 1].l === Infinity
        && rows.every((row, i) => isNum(row.l) && (i === 0 || row.l > rows[i - 1].l) && rowOk(row));
    const fraction = v => isNum(v) && v >= 0 && v <= 1;
    for (const code of Object.keys(td)) {
        const st = td[code];
        if (!st || !st.STATE || !st.MFJ || !st.SGL) continue;
        if (![st.MFJ, st.SGL].some(f => (f.brackets || []).some(b => b.r > 0))) continue;
        for (const flag of ['INFLATION_INDEXED', 'STD_INDEXED'])
            if (st[flag] !== undefined && typeof st[flag] !== 'boolean') errors.push(`${code}: ${flag} must be true or false`);
        for (const status of ['MFJ', 'SGL'])
            for (const row of st[status].brackets || [])
                if (row.indexed !== undefined && typeof row.indexed !== 'boolean') errors.push(`${code} ${status}: a bracket row's indexed must be true or false`);
        if (st.SURTAXES !== undefined) {
            if (!Array.isArray(st.SURTAXES)) errors.push(`${code}: SURTAXES is not a list`);
            else st.SURTAXES.forEach((s, i) => {
                const at = `${code}: SURTAXES[${i}]`;
                if (!s || !byStatus(s.over, isNum)) errors.push(`${at}: needs over for MFJ and SGL`);
                if (!s || !fraction(s.rate)) errors.push(`${at}: rate must be between 0 and 1`);
                if (!s || typeof s.indexed !== 'boolean') errors.push(`${at}: indexed must be true or false`);
            });
        }
        if (!Array.isArray(st.ALLOWANCES)) { errors.push(`${code}: ALLOWANCES is not a list (an empty list means none)`); continue; }
        st.ALLOWANCES.forEach((rule, i) => {
            const at = `${code}: ALLOWANCES[${i}]`;
            if (!rule || typeof rule !== 'object') { errors.push(`${at} is not a rule`); return; }
            for (const k of Object.keys(rule)) if (!ALLOWANCE_RULE_KEYS.includes(k)) errors.push(`${at}: unknown field '${k}'`);
            if (rule.apply !== 'deduction' && rule.apply !== 'credit') errors.push(`${at}: apply must be 'deduction' or 'credit'`);
            if (typeof rule.indexed !== 'boolean') errors.push(`${at}: indexed must be true or false`);
            if (rule.offsetBy !== undefined && rule.offsetBy !== 'retirementExclusion') errors.push(`${at}: unknown offsetBy`);
            const a = rule.amount;
            const kinds = a && typeof a === 'object' ? ALLOWANCE_AMOUNT_KINDS.filter(k => a[k] !== undefined) : [];
            if (kinds.length !== 1) { errors.push(`${at}: amount needs exactly one of ${ALLOWANCE_AMOUNT_KINDS.join(', ')}`); return; }
            const kind = kinds[0];
            const extra = Object.keys(a).filter(k => k !== kind && !(kind === 'perSenior' && k === 'minAge') && !(kind === 'pctOfTax' && k === 'basis'));
            if (extra.length) errors.push(`${at}: amount has unexpected ${extra.join(', ')}`);
            if (kind === 'flat' && !byStatus(a.flat, v => isNum(v) && v >= 0)) errors.push(`${at}: flat needs MFJ and SGL amounts`);
            const amountOk = v => (isNum(v) && v >= 0) || byStatus(v, x => isNum(x) && x >= 0);
            if ((kind === 'perFiler' || kind === 'perSenior') && !amountOk(a[kind])) errors.push(`${at}: ${kind} must be a non-negative number or {MFJ, SGL}`);
            if (kind === 'perSenior' && !isNum(a.minAge)) errors.push(`${at}: perSenior needs minAge`);
            if (kind === 'pctOfTax') {
                if (rule.apply !== 'credit') errors.push(`${at}: pctOfTax is a credit`);
                if (!ALLOWANCE_BASES.includes(a.basis)) errors.push(`${at}: pctOfTax basis must be one of ${ALLOWANCE_BASES.join(', ')}`);
                if (!byStatus(a.pctOfTax, rows => ladder(rows, row => fraction(row.r)))) errors.push(`${at}: pctOfTax needs MFJ and SGL tables of {l, r} ending at Infinity`);
            }
            const p = rule.phaseout;
            if (p === undefined) return;
            if (!p || typeof p !== 'object') { errors.push(`${at}: phaseout is not an object`); return; }
            if (!ALLOWANCE_BASES.includes(p.basis)) errors.push(`${at}: phaseout basis must be one of ${ALLOWANCE_BASES.join(', ')}`);
            if (typeof p.indexed !== 'boolean') errors.push(`${at}: phaseout.indexed must be true or false`);
            if (p.kind === 'linear') {
                if (!byStatus(p.start, isNum)) errors.push(`${at}: linear phaseout needs start for MFJ and SGL`);
                const reduceOk = (isNum(p.reduce) && p.reduce >= 0) || byStatus(p.reduce, x => isNum(x) && x >= 0);
                if (!(isNum(p.step) && p.step > 0) || !reduceOk) errors.push(`${at}: linear phaseout needs step > 0 and reduce >= 0 (or {MFJ, SGL})`);
                if (p.per !== undefined && p.per !== 'rule' && p.per !== 'unit') errors.push(`${at}: per must be 'rule' or 'unit'`);
                if (p.floor !== undefined && !byStatus(p.floor, isNum)) errors.push(`${at}: floor needs MFJ and SGL`);
                if (p.floorFraction !== undefined && !fraction(p.floorFraction)) errors.push(`${at}: floorFraction must be between 0 and 1`);
            } else if (p.kind === 'steps') {
                const rowOk = row => (row.r !== undefined) !== (row.value !== undefined)
                    && (row.r === undefined || fraction(row.r)) && (row.value === undefined || (isNum(row.value) && row.value >= 0));
                if (!byStatus(p.table, rows => ladder(rows, rowOk))) errors.push(`${at}: steps phaseout needs MFJ and SGL tables of {l, r} or {l, value} ending at Infinity`);
            } else errors.push(`${at}: phaseout kind must be 'linear' or 'steps'`);
        });
    }
    return errors;
}

// ─────────────────────────────────────────────────────────────────────────
// Derived LTCG constants. Both were literal 0.15 scattered across optimizer_core.js,
// optimizer_ui.js and retirement_optimizer.html; they are computed from the schedule above so
// the bracket table stays the single source of truth. A future rate change (0/15/20 becoming,
// say, 0/18/25) moves these with it instead of leaving magic numbers that still parse.
// Both read the MFJ schedule: the rate LADDER is identical for every filing status - only the
// dollar thresholds differ - so there is nothing status-specific to pick here.
// ─────────────────────────────────────────────────────────────────────────

// The middle LTCG rate, used as a fallback wherever a real bracket lookup is impossible:
// the year-0 seed before any tax has been computed, and log rows written without a rate.
// A guess either way, but the schedule's own middle rate is the defensible guess.
TAXData.FEDERAL.CAPITAL_GAINS.DEFAULT_RATE = TAXData.FEDERAL.CAPITAL_GAINS.MFJ.brackets[1].r;

// Default harvest ceiling for Cycle Brokerage, expressed the way getLTCGBracketRoom() reads a
// `maxRate`: room spans every bracket whose rate is STRICTLY BELOW this value. So the middle
// rate means "fill the 0% bracket and stop", which is the shipped default.
TAXData.FEDERAL.CAPITAL_GAINS.CYCLE_TARGET_DEFAULT = TAXData.FEDERAL.CAPITAL_GAINS.MFJ.brackets[1].r;

// Every LTCG rate a Cycle Brokerage target may be set to: each bracket's rate acts as the
// exclusive ceiling for the bracket beneath it, so the top rate is not a selectable target
// (there is nothing above it to stop at). Drives the Target menu, which used to hard-code
// <option value="0.15">/<option value="0.20"> in markup.
TAXData.FEDERAL.CAPITAL_GAINS.CYCLE_TARGET_OPTIONS =
    TAXData.FEDERAL.CAPITAL_GAINS.MFJ.brackets
        .slice(1)
        .map((b, i) => ({
            value: b.r,                                                  // the exclusive ceiling
            label: `${Math.round(TAXData.FEDERAL.CAPITAL_GAINS.MFJ.brackets[i].r * 100)}% bracket`
        }));

// Federal Poverty Level. Not an IRS table: HHS publishes these each January, and they are what an
// ACA premium subsidy is measured against.
//
// THE YEAR LAG IS DELIBERATE. An ACA plan year is subsidized against the guideline published the
// PREVIOUS January, so a plan priced for 2026 coverage uses the 2025 figures. Do not "update" these
// to the current year to match TAXData.FEDERAL.YEAR - that would overstate every FPL ceiling by a
// year of indexation. The two tables are on different clocks on purpose. For the same reason the
// figures apply AS PUBLISHED in PLAN_YEAR, with no year of CPI added: cpiRate indexes them from
// there like every other threshold. taxengine.tests.js ties GUIDELINE_YEAR to PLAN_YEAR and the
// figures to HHS's table for GUIDELINE_YEAR.
//
// Household size is filing status and nothing else: MFJ is the two-person guideline, SGL the
// one-person. There are no dependents in this model. Alaska and Hawaii have higher guidelines and
// are NOT modeled, so an ACA ceiling in those states is too strict - see "Limitations and
// Restrictions" in README.md.
//
// Read by computeBracketCeiling() in optimizer_core.js, and by the Limit menu and the limit ladder
// in optimizer_ui.js, which compute the same figure.
TAXData.FPL = {
    PLAN_YEAR: 2026,        // the coverage year these serve
    GUIDELINE_YEAR: 2025,   // the January HHS publication they are taken from
    MFJ: 21150,             // two-person household, contiguous 48 states and DC
    SGL: 15650,             // one-person household
    MULTIPLES: [200, 250, 300, 400],   // the subsidy cliffs the Limit menu offers
};

// OBBBA provisions — P.L. 119-21, signed July 4, 2025. Update this block if IRS issues amended guidance.
// calculateTaxes() and IncomeTaxPlanner.html read from here; no values are hardcoded there.
TAXData.OBBBA = {
    SALT: {
        // P64d. BOTH of these are 2025 BASE figures that the statute steps up 1% per year, applied
        // to the prior year's figure, through 2029 - so 2026 is $40,400 / $505,000, not $40,000 /
        // $500,000. The old comment here claimed the cap "increases 1%/yr through 2029" while nothing
        // implemented it and the threshold carried no comment at all, so the CURRENT tax year was
        // already being priced $400 low on the cap and $5,000 low on the threshold.
        // Rounding for 2027-2029 is unconfirmed: 2026 is exactly 40000 x 1.01, so plain compounding
        // matches at the first step, but whether later years round to the dollar or to $50/$100 is not
        // established. The difference is a few dollars of DEDUCTION, i.e. a dollar or two of tax.
        capHigh:           40000,   // 2025 base for the elevated cap; indexed below
        capLow:            10000,   // TCJA floor / fallback after the sunset. Never indexed.
        phaseoutThreshold: 500000,  // 2025 base MAGI above which capHigh phases down; indexed below
        phaseoutRate:      0.30,    // 30¢ reduction per $1 above threshold, and it stops at capLow
        indexRate:         0.01,    // statutory step, NOT a CPI adjustment
        indexBaseYear:     2025,    // the year both base figures are stated for
        sunsetYear:        2029     // capHigh expires after this tax year; reverts to capLow in 2030
    },
    SENIOR_DED: {
        perSenior:    6000,                          // deduction per person aged ≥ 65 (P.L. 119-21)
        phaseoutAGI:  { MFJ: 150000, SGL: 75000 },  // AGI above which deduction phases out
        phaseoutRate: 0.06,                          // $0.06 off EACH person's $6,000 per $1 above threshold
        sunsetYear:   2028                           // deduction expires after this tax year (2025–2028 only)
    }
};

// RMD start age by birth year, keyed by the first birth year each row applies to: 75 from 1960 and
// 73 from 1951 (SECURE 2.0), 72 before (SECURE Act). Owners born before July 1949 began at 70½, but
// they are past every start age in a plan this tool runs, so the table stops at 72.
const RMD_START_AGE = [[1960, 75], [1951, 73], [0, 72]];

function rmdStartAge(birthYear) {
    const row = RMD_START_AGE.find(([from]) => birthYear >= from);
    return (row || RMD_START_AGE[RMD_START_AGE.length - 1])[1];
}

// The divisor for an age, clamped into the table: the youngest row for any age below it, the
// oldest for any age past it.
function rmdDivisor(age) {
    const ages = Object.keys(RMD_TABLE).map(Number);
    return RMD_TABLE[Math.min(Math.max(age, Math.min(...ages)), Math.max(...ages))];
}

// IRS Uniform Lifetime Table, Treas. Reg. 1.401(a)(9)-9(c), in effect for distribution years from 2022.
const RMD_TABLE = {
    72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
    80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
    88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9,
    96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2,
	104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4,
	112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0
};

// ============================================================================
// Bracket utilities
// Relocated from optimizer_core.js so taxengine.js is self-contained (was a
// circular file dependency: taxengine.js called these, core.js called calculateTaxes()/
// calcIRMAA()/etc. back). No other file should redefine these — optimizer_core.js
// and every HTML consumer now get them from here.
// ============================================================================

function getRateBracket(entity, status) {
    let brks = TAXData?.[entity]?.[status]?.brackets;

    if (!brks) {
        console.error(`Invalid tax data: entity="${entity}", status="${status}"`);
        return null
    };

    return brks
}

// The dollar threshold of a bracket row in a plan year. Indexed by `inflation` unless the jurisdiction
// sets INFLATION_INDEXED: false (a statutory schedule) or the row says `indexed: false` (one statutory
// line in an otherwise indexed table). Every state and federal lookup reads thresholds through here,
// so the tax charged and the ceilings the strategies aim at always agree. `entity` may be a table
// array (the capital-gains schedule), which carries no flags and always indexes.
function rowThreshold(entity, row, inflation) {
    const fixed = row.indexed === false
        || (typeof entity === 'string' && TAXData[entity]?.INFLATION_INDEXED === false);
    return row.l * (fixed ? 1 : inflation);
}

// Rows' thresholds for a plan year, never decreasing: an indexed row that inflates past a statutory
// one above it keeps the band order (the statutory band then has no width) instead of folding back.
function rowThresholds(entity, brks, inflation) {
    const out = new Array(brks.length);
    let prev = -Infinity;
    for (let i = 0; i < brks.length; i++) {
        prev = Math.max(prev, rowThreshold(entity, brks[i], inflation));
        out[i] = prev;
    }
    return out;
}

// Returns the highest index i such that brackets[i].l * multiplier <= amount, or -1 if none match.
// Shared boundary-lookup primitive for findUpperLimitByAmount/getIRMAATier/getIRMAATierTargetMAGI.
function findBracketIndex(brackets, amount, multiplier = 1) {
    let idx = -1;
    for (let i = 0; i < brackets.length; i++) {
        if (brackets[i].l * multiplier <= amount) idx = i;
        else break;
    }
    return idx;
}

/**
 * Find the income limit for a specified marginal tax rate within tax brackets.
 * Returns the highest bracket limit where the rate is less than or equal to the target rate.
 * Uses TAXdata structure to retrieve bracket information.
 *
 * @param {string} entity - Tax entity identifier (e.g., 'federal', 'CA', 'IRMAA', 'SS')
 * @param {string} status - Filing status (e.g., 'single', 'joint', 'mfs', 'hoh')
 * @param {number} tgtrate - Target marginal tax rate to find limit for
 * @param {number} [inflation=1] - Inflation multiplier for bracket limits (default: 1)
 * @returns {Object} Bracket limit results
 * @returns {number} return.limit - Income limit at or below the target rate (0 if no match)
 * @returns {number} return.rate - Actual rate of the bracket found
 * @note Does not validate input parameters for reasonableness
 */
function findLimitByRate(entity, status, tgtrate, inflation = 1) {
    let brks = getRateBracket(entity, status)

    let limit = 0;
    let rate = 0;

    const lims = rowThresholds(entity, brks, inflation);
    for (let i = 0; i < brks.length; i++) {
        if (brks[i].r <= tgtrate) {
            limit = lims[i];
            rate = brks[i].r;
        } else break;
    }
    return { limit, rate: rate }
}

// We want to find the limit of the next bracket HIGHER than the amount given (that is the upper limit).
// For example if the limits are 10, 100, 1000 and the amount is 150 - we want the 1000 (less 1).
// If amount is 99, we want 100.
function findUpperLimitByAmount(entity, status, amount, inflation = 1) {
    let brks = getRateBracket(entity, status)
    const lims = rowThresholds(entity, brks, inflation);
    let idx = -1;
    for (let i = 0; i < brks.length; i++) { if (lims[i] <= amount) idx = i; else break; }

    // Below every bracket's lower bound. The band runs up to the first bracket's threshold, and no
    // bracket rate applies inside it. A SINGLE-ROW table `[{l: Infinity}]` always lands here —
    // `Infinity <= amount` is never true — so this is equally the "this entity imposes no ceiling"
    // answer for the 21 flat-rate and no-tax jurisdictions, and Infinity is exactly what a caller
    // doing Math.min(stateLimit, fedLimit) needs to see. This returned 0 until v11.14xx, which
    // zeroed the federal ceiling and stopped Fill Bracket / IRMAA Ceiling / ACA converting anything
    // in those states, and zeroed `yr.goalLimit` (hence
    // `targetSpend`) for every strategy outside the bracket/ordered/GK set.
    if (idx === -1) return { limit: lims[0] - 1, rate: 0, nominalRate: 0 };

    // IRMAA rows carry monthlyCost - flat monthly DOLLARS - where every other table carries
    // r, an annual marginal rate. One coalescing read rather than a second lookup function.
    const rate = brks[idx].monthlyCost ?? brks[idx].r;
    const nominalRate = brks[idx].nr ?? 0;
    const nextB = brks[idx + 1];
    // Asymmetry kept on purpose: 0 here means "no upper limit" for the LAST bracket, the opposite
    // of what 0 meant above. Unreachable in production — FEDERAL, every state and IRMAA all
    // terminate at {l: Infinity}, which can never be selected, and the one table that does not
    // (SOCIALSECURITY) is never passed to this function. Left alone rather than changed to
    // Infinity, since no caller exercises it and the two would then be indistinguishable.
    const limit = nextB ? lims[idx + 1] - 1 : 0;
    return { limit, rate: rate, nominalRate: nominalRate }
}

/**
 * Calculate progressive tax on a given amount using tax brackets from TAXdata structure.
 * Iterates through brackets, applying rates to income ranges, with optional inflation
 * and rate creep adjustments for future year projections.
 *
 * @param {string} entity - Tax entity identifier (e.g., 'federal', 'CA', 'IRMAA', 'SS')
 * @param {string} status - Filing status (e.g., 'single', 'joint', 'mfs', 'hoh')
 * @param {number} amount - Taxable amount to calculate tax on
 * @param {number} [inflation=1] - Inflation multiplier for bracket limits (default: 1)
 * @param {number} [ratecreep=1] - Rate adjustment multiplier (default: 1)
 * @returns {Object} Tax calculation results
 * @returns {number} return.cumulative - Total tax owed
 * @returns {number} return.total - Total tax owed (same as cumulative)
 * @returns {number} return.marginal - Marginal tax rate at this income level
 * @returns {number} return.limit - Upper limit of the bracket reached
 * @returns {number} return.nominalRate - Nominal rate if specified in bracket data
 * @returns {string} [return.error] - Error message if entity/status invalid
 */
// startPosition (default 0) lets a caller stack `amount` on top of income already taxed
// elsewhere (e.g. preferential income stacked on top of ordinary income for cap gains) —
// brackets fully below startPosition are skipped, and the walk proceeds from there.
function calculateProgressive(entity, status, amount, inflation = 1, ratecreep = 1, startPosition = 0) {

    let brks = Array.isArray(entity) ? entity : getRateBracket(entity, status)
    if (!brks) {
        return { cumulative: 0, total: 0, marginal: 0, limit: 0, error: `Invalid entity (${entity}) or status (${status})` };
    }

    // Thresholds come from rowThreshold (statutory rows and schedules do not inflate), kept
    // non-decreasing the same way rowThresholds does; computed inline because this runs on every call.
    let prevLimit = startPosition;
    let cumulative = 0;
    let marginalRate = 0;
    let nominalRate = 0;
    let floorSoFar = -Infinity;

    for (let b of brks) {
        floorSoFar = Math.max(floorSoFar, rowThreshold(entity, b, inflation));
        let currentLimit = floorSoFar;
        if (currentLimit <= startPosition) continue;   // bracket entirely below the starting position

        if (startPosition + amount <= currentLimit) {
            cumulative += (startPosition + amount - prevLimit) * b.r * ratecreep;
            marginalRate = b.r * ratecreep;
            // nr is the precomputed EFFECTIVE rate at this bracket's top; every statutory rate
            // beneath it scales by ratecreep, so the effective rate scales by exactly the same
            // factor. No-op at ratecreep = 1.
            nominalRate = (b.nr ?? 0) * ratecreep;
            prevLimit = currentLimit;
            break;
        } else {
            cumulative += (currentLimit - prevLimit) * b.r * ratecreep;
            marginalRate = b.r * ratecreep;
            nominalRate = (b.nr ?? 0) * ratecreep;
            prevLimit = currentLimit;
        }
    }

    // SURTAXES: an extra rate charged on taxable income above a line, kept out of the bracket rows because
    // its line indexes differently from theirs (California's 1% over $1M is statutory while its
    // brackets index; folded into the rows, inflation would carry an indexed row past it). Each is
    // { over: {MFJ, SGL}, rate, indexed, source }. The line is not a bracket edge, so `limit` and
    // the ceiling lookups do not stop at it; every line in the tables is above $1M.
    const surtaxes = typeof entity === 'string' ? TAXData[entity]?.SURTAXES : undefined;
    if (surtaxes) {
        const top = startPosition + amount;
        for (const s of surtaxes) {
            const line = (s.over[status] ?? s.over.SGL) * (s.indexed ? inflation : 1);
            if (top > line) {
                cumulative += (top - Math.max(line, startPosition)) * s.rate * ratecreep;
                marginalRate += s.rate * ratecreep;
            }
        }
    }

    return { cumulative, total: cumulative, marginal: marginalRate, limit: prevLimit, nominalRate: nominalRate }
}

// ============================================================================
// State retirement-income exclusion evaluator
// Data-driven: every dollar figure, age threshold, phase-out step, and rate lives in
// each state's RETIREMENT_EXCLUSION entry (see IL/PA for `full`, and AL/GA/NY/CO/KY/MD/
// ME/MI/CT/VA/WI/OH for `cap`/`phaseout`/`credit`/array-of-rules examples). No per-state
// `if (state === 'XX')` branches here — only dispatch on `rule.mode`.
// ============================================================================

// Counts filers whose age qualifies (>= minAge), reusing the same shape as the federal
// `nSeniors` count in `calculateTaxes` below, generalized to an
// arbitrary threshold.
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

// ============================================================================
// State allowances: personal exemptions, age add-ons and personal credits
// Data-driven like the retirement exclusion above. Each income-tax state carries ALLOWANCES, a list of
// rules, and every dollar figure, age and threshold lives in the rule. Nothing below names a state:
// it reads rule fields only, and a test holds it to that.
//
// A rule:
//   apply     'deduction' - subtracted from state income before the rates, beside `std`
//             'credit'    - subtracted from the state tax; all credits together stop at zero tax
//   amount    exactly one of
//               { flat: {MFJ, SGL} }        one amount per return
//               { perFiler: n }              n per filer: two on a joint return, one on a single
//               { perSenior: n, minAge }     n per filer at or over minAge (needs `ages`)
//                                            (n may also be {MFJ, SGL} where the amount differs by status)
//               { pctOfTax: {MFJ: [{l, r}], SGL: [...]}, basis }
//                                            credit only: r times the tax before credits, r from the
//                                            first row whose l the basis does not exceed
//   phaseout  optional, one of
//               { kind: 'linear', basis, start: {MFJ, SGL}, step, reduce, indexed,
//                 per: 'rule' | 'unit', ceil, floor: {MFJ, SGL}, floorFraction }
//                   reduction = reduce x (excess over start / step, rounded up when ceil), times the
//                   unit count when per is 'unit' (a credit cut "$6 per credit"); the amount never
//                   falls below floor (dollars) or floorFraction of itself
//               { kind: 'steps', basis, indexed, table: {MFJ: [{l, r} | {l, value}], SGL: [...]} }
//                   the first row whose l the basis does not exceed: r scales the amount, value
//                   replaces the per-unit amount. A cliff is a two-row table ending {l: Infinity, r: 0}.
//             `phaseout.indexed` says whether its thresholds (start, l) grow with inflation; it is
//             separate from the rule's own flag because a state can index an exemption and not the
//             income line where it ends. `step` and `reduce` never index.
//   offsetBy  optional 'retirementExclusion': the amount less the retirement exclusion already taken
//   indexed   required boolean: whether the amount (and floor) grows with the plan's inflation factor
//   source    required { year, status, doc }, checked the same way as SOURCES
// basis is 'federalAGI', 'stateAGI' or 'magi' (federal AGI plus tax-exempt interest).
// ============================================================================
const ALLOWANCE_BASES = ['federalAGI', 'stateAGI', 'magi'];

// perFiler, perSenior, flat and a linear phase-out's `reduce` may each be one number or {MFJ, SGL}.
function byStatusValue(v, status) {
    return typeof v === 'object' && v !== null ? (v[status] ?? v.SGL) : v;
}

function allowanceBasis(basis, ctx) {
    return basis === 'stateAGI' ? ctx.stateAGI : basis === 'magi' ? ctx.magi : ctx.federalAGI;
}

// First row of a status-keyed table whose threshold the value does not exceed.
function allowanceRow(table, status, x, thresholdFactor) {
    const rows = table[status] || table.SGL;
    for (const row of rows) if (x <= row.l * thresholdFactor) return row;
    return rows[rows.length - 1];
}

// The dollar value of one rule for this return. ctx: { status, ages, inflation, federalAGI, stateAGI,
// magi, retirementExclusion, taxBeforeCredits }.
function evaluateAllowance(rule, ctx) {
    const { status, inflation } = ctx;
    const a = rule.amount;
    const amountFactor = rule.indexed ? inflation : 1;

    if (a.pctOfTax) {
        const row = allowanceRow(a.pctOfTax, status, allowanceBasis(a.basis, ctx), 1);
        return Math.max(0, row.r * (ctx.taxBeforeCredits || 0));
    }

    let units, perUnit;
    if (a.flat) { units = 1; perUnit = byStatusValue(a.flat, status); }
    else if (a.perFiler != null) { units = status === 'MFJ' ? 2 : 1; perUnit = byStatusValue(a.perFiler, status); }
    else if (a.perSenior != null) { units = countQualifyingFilers(ctx.ages || [], status, a.minAge); perUnit = byStatusValue(a.perSenior, status); }
    else return 0;
    if (units === 0) return 0;

    let total = perUnit * amountFactor * units;
    const p = rule.phaseout;
    if (p) {
        const x = allowanceBasis(p.basis, ctx);
        const thresholdFactor = p.indexed ? inflation : 1;
        if (p.kind === 'steps') {
            const row = allowanceRow(p.table, status, x, thresholdFactor);
            total = row.value != null ? row.value * amountFactor * units : total * row.r;
        } else if (p.kind === 'linear') {
            const excess = x - (p.start[status] ?? p.start.SGL) * thresholdFactor;
            if (excess > 0) {
                const steps = p.ceil ? Math.ceil(excess / p.step) : excess / p.step;
                const reduction = byStatusValue(p.reduce, status) * steps * (p.per === 'unit' ? units : 1);
                let floor = p.floor ? (p.floor[status] ?? p.floor.SGL) * amountFactor : 0;
                if (p.floorFraction != null) floor = Math.max(floor, p.floorFraction * total);
                total = Math.max(Math.min(floor, total), total - reduction);
            }
        }
    }
    if (rule.offsetBy === 'retirementExclusion') total -= ctx.retirementExclusion || 0;
    return Math.max(0, total);
}

// Sum of the rules of one kind ('deduction' or 'credit'). A plain loop: this runs on every
// calculateTaxes call, several times per simulated year.
function sumAllowances(rules, apply, ctx) {
    if (!rules) return 0;
    let sum = 0;
    for (const rule of rules) if (rule.apply === apply) sum += evaluateAllowance(rule, ctx);
    return sum;
}

// Pure 3-tier SS taxability formula (statutory since 1984, brackets NOT inflation-indexed).
// Assumes exactly 3 brackets per TAXData.SOCIALSECURITY[status].brackets shape.
function calculateTaxableSocialSecurity(status, provisionalIncome, totalSS) {
    const ssBrackets = getRateBracket('SOCIALSECURITY', status);
    if (!ssBrackets) return 0;
    if (provisionalIncome <= ssBrackets[0].l) return 0;
    if (provisionalIncome <= ssBrackets[2].l) {
        const threshold1 = ssBrackets[1].l;
        const tier1Rate = ssBrackets[1].r;
        return Math.min(tier1Rate * totalSS, tier1Rate * (provisionalIncome - threshold1));
    }
    const threshold1 = ssBrackets[1].l;
    const threshold2 = ssBrackets[2].l;
    const tier1Rate = ssBrackets[1].r;
    const tier2Rate = ssBrackets[2].r;
    const tier1Amount = tier1Rate * (threshold2 - threshold1);
    const tier2Amount = tier2Rate * (provisionalIncome - threshold2);
    return Math.min(tier2Rate * totalSS, tier1Amount + tier2Amount);
}

// P87c. The inverse of the line above, in the one direction a ceiling-filling strategy needs it.
//
// THE PROBLEM IT SOLVES. A strategy that fills a MAGI ceiling has to answer "how much NON-Social-
// Security income can this year hold before MAGI reaches L?" That is not `L - totalSS`: only the
// taxable share of the benefit ever enters MAGI, and how large that share is depends on the very
// income being sized. Reading taxengine's own definitions (see calculateTaxes STEP 2 and STEP 3),
//
//     MAGI        = federalAGI + taxExemptInterest
//     provisional = (MAGI - taxableSS) + provisionalIncomeRate x totalSS
//
// so with N = the non-SS part of MAGI the whole relation collapses to one scalar equation:
//
//     MAGI(N) = N + calculateTaxableSocialSecurity(status, N + r x totalSS, totalSS)
//
// This returns the N that solves MAGI(N) = magiTarget.
//
// WHY BISECTION AND NOT ALGEBRA. MAGI(N) is piecewise linear with slope 1, 1.5, 1.85 or 1 again -
// four segments, whose knots sit at the two statutory thresholds and at the two points where the
// formula's `min()` caps saturate. Solving those four cases in closed form is possible and was
// rejected: it would be a SECOND SOURCE OF TRUTH for the SS split, free to drift from the function
// actually charging the tax. This calls that function instead, and leans only on the property the
// statute guarantees - MAGI(N) is monotone non-decreasing in N - which is all bisection needs. If
// the formula ever gains a tier, this keeps working with no edit.
//
// Returns magiTarget unchanged when there is no benefit, which is the correct answer and skips the
// loop on every pre-Social-Security year.
// The two numbers the loop below stops on. The tolerance is the mechanism (half a cent of benefit);
// the pass count is the backstop against a non-finite input, and 40 halvings cover $5.5 billion.
const SS_BISECT_TOLERANCE  = 0.005;
const SS_BISECT_MAX_PASSES = 40;
function nonSSIncomeForMAGI(status, magiTarget, totalSS) {
    if (!(totalSS > 0)) return magiTarget;
    const ssBrackets = getRateBracket('SOCIALSECURITY', status);
    if (!ssBrackets) return magiTarget;
    const r = ssBrackets[1].r ?? 0;
    const magiOf = (N) => N + calculateTaxableSocialSecurity(status, N + r * totalSS, totalSS);
    // MAGI(N) >= N, so the answer is never above magiTarget; and MAGI is at most 0.85 x SS above N,
    // so magiTarget - 0.85 x SS is a lower bound. Both bounds are exact.
    let lo = magiTarget - ssBrackets[2].r * totalSS, hi = magiTarget;
    // THE COMMON CASE NEVER ENTERS THE LOOP, and this line is why. Where the 85% cap binds - which
    // is 96% of the ceiling-bound years measured in research/OPTIMIZER_RANK_STABILITY.md - `lo` IS
    // the answer, and exactly so: taxableSS <= 0.85 x SS always, so magiOf(lo) <= magiTarget always,
    // and combined with the test below it can only be EQUAL. It cannot overshoot.
    if (magiOf(lo) >= magiTarget) return lo;
    // Bisect until the interval is settled to half a cent, NOT for a fixed count. The starting span
    // is 0.85 x totalSS, so a fixed count silently loses precision as the benefit grows: 20 halvings
    // are half a cent on a $40k benefit and eight cents on a $1M one. Stopping on the interval holds
    // the same accuracy at every benefit size and lets small ones exit sooner - typically 22 to 24
    // passes, against the 60 this used to run unconditionally.
    //
    // MAGI's slope in N is 1, 1.5 or 1.85, so half a cent on N is at worst about one cent on MAGI.
    // The 40 is a backstop against a non-finite input, not the mechanism: 40 halvings cover a
    // benefit of $5.5 billion. Measured, dropping to 18 or 20 passes moves no engine result at all -
    // the only thing that noticed was this function's own unit test at its 0.01 tolerance.
    for (let i = 0; i < SS_BISECT_MAX_PASSES && hi - lo > SS_BISECT_TOLERANCE; i++) {
        const mid = (lo + hi) / 2;
        if (magiOf(mid) < magiTarget) lo = mid; else hi = mid;
    }
    return lo;
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
 * @param {number} params.stateExemptInterest - Interest on US obligations (Treasuries, savings bonds).
 *                 Part of the income passed in, taxed federally and exempt from state income tax, so it
 *                 is subtracted from state income only.
 * @param {number} params.stateTaxableExempt - Federally tax-exempt interest that the state taxes anyway
 *                 (usually out-of-state municipal bonds). Added to state income only; it is already
 *                 in `taxExemptInterest`, which this does not change.
 * @param {number} params.hsaContrib - HSA contributions (deductible Fed, taxable CA).
 * @param {number} params.inflation - CPI multiplier for tax brackets (e.g., 1.025).
 * @param {string} params.state - State abbreviation (e.g., 'CA', 'no' for no-tax states).
 * @param {number} params.IRMAAAnnualCost - Annual IRMAA cost (from 2-year lookback MAGI).
 * @param {boolean} params.obbaOn - Enable OBBBA provisions (senior deduction + SALT cap).
 * @param {boolean} params.saltHigh - Use $40k SALT cap (OBBBA); false = $10k (TCJA).
 * @param {number} params.fedRateCreep - Multiplier on federal ORDINARY bracket rates (1 = today's
 *                 rates). Models legislated rate increases; bracket thresholds are unaffected and
 *                 still track `inflation`. Capital gains and NIIT are deliberately excluded.
 * @param {number} params.stateRateCreep - Same, for state bracket rates.
 * @param {number}  params.propTax - Property + local taxes paid (for SALT itemizing).
 * @param {number}  params.taxYear - Calendar tax year, used ONLY to index the SALT cap and its
 *                 phase-out threshold at their statutory 1%/yr. Omitting it prices the 2025 base
 *                 figures, which is wrong for every later year - callers that know the year must
 *                 pass it, and optimizer_core's guard test asserts they do.
 * @returns {Object} Comprehensive tax calculation results.
 */
function calculateTaxes(params = {}) {
    const {
        IRMAAAnnualCost = 0,
        filingStatus = 'MFJ',
        ages = [],
        birthyears = [],
        earnedIncome = 0,
        totalSS = 0,
        ordDivInterest = 0,
        qualifiedDiv = 0,
        capGains = 0,
        taxExemptInterest = 0,
        stateExemptInterest = 0,
        stateTaxableExempt = 0,
        hsaContrib = 0,
        inflation = 1.0,
        state = 'CA',
        obbaOn = false,
        saltHigh = false,
        propTax = 0,
        taxYear = TAXData.OBBBA.SALT.indexBaseYear,
        pensionIncome = 0,   // employer/govt pension + annuity portion of earnedIncome
        iraIncome     = 0,   // IRA/401k/RMD distribution portion of earnedIncome
        fedRateCreep   = 1,  // tax-rate creep multipliers (1 = today's statutory rates)
        stateRateCreep = 1
    } = params;

    const status = filingStatus ?? "MFJ";

    // ========================================================================
    // STEP 1: Federal Standard Deduction (age bumps + OBBBA parameters)
    // ========================================================================
    const federalStdBase = TAXData.FEDERAL[status].std;
    const federalAgeThreshold = TAXData.FEDERAL[status].age;
    const federalAgeBump = TAXData.FEDERAL[status].stdbump;

    const nSeniors = countQualifyingFilers(ages, status, federalAgeThreshold);

    let federalStdDeduction = (federalStdBase + federalAgeBump * nSeniors) * inflation;

    const obbaSalt = TAXData.OBBBA.SALT;
    const obbaSen  = TAXData.OBBBA.SENIOR_DED;
    // P64d. Both the elevated cap and its phase-out threshold step up 1% per year from their 2025
    // base, through the sunset. Clamped there so a post-sunset year cannot keep compounding a figure
    // that no longer applies (saltHigh is false then anyway, but the threshold is read below).
    const saltIdxYear = Math.min(Math.max(taxYear || obbaSalt.indexBaseYear, obbaSalt.indexBaseYear), obbaSalt.sunsetYear);
    const saltIndex   = Math.pow(1 + obbaSalt.indexRate, saltIdxYear - obbaSalt.indexBaseYear);

    // P64f. `saltHigh` is the SOLE gate on the elevated cap, and `obbaOn` gates only the senior
    // deduction. It used to read `obbaOn ? (saltHigh ? capHigh : capLow) : capLow`, and that quietly
    // killed the elevated cap a year early: both callers derive obbaOn from SENIOR_DED.sunsetYear
    // (2028) and saltHigh from SALT.sunsetYear (2029), so in tax year 2029 obbaOn was already false
    // and the $40k cap collapsed to $10k while the statute still allowed it. IncomeTaxPlanner.html
    // even says so in its own comment - "SALT elevated cap continues through 2029" - while passing
    // flags this line then ignored. One flag cannot carry two different sunsets.
    const saltBaseCap = saltHigh ? obbaSalt.capHigh * saltIndex : obbaSalt.capLow;

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
    const taxableSS = calculateTaxableSocialSecurity(status, provisionalIncome, totalSS);

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

    // A state row with HSA_DEDUCTIBLE: false taxes HSA contributions; every other state deducts them.
    const stateHSADeduction = stateData.HSA_DEDUCTIBLE === false ? 0 : hsaContrib;
    // Two state-only adjustments, both zero unless the caller supplies them: US-obligation interest
    // is in the income above and comes back out, and tax-exempt interest the state taxes goes in.
    const stateAGI = earnedIncome - stateHSADeduction + stateTaxableSS + ordDivInterest + qualifiedDiv + capGains
                   - stateRetExcl - stateExemptInterest + stateTaxableExempt;

    // `std` is a number, 'FEDERAL' (the federal basic standard deduction) or 'FEDERAL_WITH_AGE' (that
    // plus the federal 65+ add-on, for a state whose taxable income starts from the federal figure).
    // A number indexes with inflation unless the state sets STD_INDEXED: false (a statutory amount);
    // the federal references always index, as the federal amounts do.
    const rawStateStd = stateData[status].std;
    const stateStdDeduction = rawStateStd === 'FEDERAL' ? federalStdBase * inflation
        : rawStateStd === 'FEDERAL_WITH_AGE' ? (federalStdBase + federalAgeBump * nSeniors) * inflation
        : rawStateStd * (stateData.STD_INDEXED === false ? 1 : inflation);

    // Personal exemptions and age add-ons (ALLOWANCES deduction rules, see evaluateAllowance). The
    // context object is built only for a state that has rules: this runs on every call.
    const magi = federalAGI + taxExemptInterest;
    const allowanceRules = stateData.ALLOWANCES;
    const allowanceCtx = allowanceRules && allowanceRules.length
        ? { status, ages, inflation, federalAGI, stateAGI, magi, retirementExclusion: stateRetExcl, taxBeforeCredits: 0 }
        : null;
    const stateExemptions = allowanceCtx ? sumAllowances(allowanceRules, 'deduction', allowanceCtx) : 0;
    const stateDeductions = stateStdDeduction + stateExemptions;

    const stateTaxableIncome = Math.max(0, stateAGI - stateDeductions);
    const stateResult = calculateProgressive(state, status, stateTaxableIncome, inflation, stateRateCreep);
    const stateTax = stateResult.total;
    const stateMarginalRate = stateResult.marginal;

    // Credits come off the tax the rates produced: the retirement-income credit (RETIREMENT_EXCLUSION
    // mode 'credit') and the ALLOWANCES credit rules. Together they stop at zero tax.
    const stateRetCredit = evaluateRetirementCredit(retExcl, { pensionIncome, iraIncome, magi });
    let stateAllowanceCredits = 0;
    if (allowanceCtx) {
        allowanceCtx.taxBeforeCredits = stateTax;
        stateAllowanceCredits = sumAllowances(allowanceRules, 'credit', allowanceCtx);
    }
    const stateCredits = Math.min(stateTax, stateRetCredit + stateAllowanceCredits);
    const stateTaxFinal = stateTax - stateCredits;

    // State ordinary vs. cap gains breakdown (for callers that need stacked display), AFTER credits:
    // the credits come off the ordinary part first, so the two always add up to the tax charged.
    // Must use the SAME creep as the total above.
    const stateOrdinaryBeforeCredits = calculateProgressive(
        state, status, Math.max(0, stateAGI - capGains - stateDeductions), inflation, stateRateCreep).total;
    const stateOrdinaryTax = Math.max(0, stateOrdinaryBeforeCredits - stateCredits);
    const stateCapGainsTax = stateTaxFinal - stateOrdinaryTax;

    // ========================================================================
    // STEP 5: Finalize Federal Deduction (SALT itemizing + OBBBA senior deduction)
    // ========================================================================
    const saltMagi = federalAGI + taxExemptInterest;
    // Same correction as saltBaseCap: the phase-down belongs to the elevated cap, so it is gated on
    // saltHigh alone. Under the $10k floor there is nothing to phase down.
    const saltCap = saltHigh
        ? Math.max(obbaSalt.capLow, saltBaseCap - Math.max(0, saltMagi - obbaSalt.phaseoutThreshold * saltIndex) * obbaSalt.phaseoutRate)
        : saltBaseCap;
    // The state tax deducted is the tax after credits: that is what the household pays.
    const saltItemized = Math.min(stateTaxFinal + propTax, saltCap);
    const useItemized = saltItemized > federalStdDeduction;
    let federalDeduction = useItemized ? saltItemized : federalStdDeduction;

    let seniorDeduction = 0;
    if (obbaOn && nSeniors > 0) {
        // The reduction comes off EACH person's $6,000, not off the couple's total: IRS Schedule 1-A
        // Part V finds one per-person amount (line 35) and gives it to the taxpayer (36a) and to the
        // spouse (36b). Two seniors on a joint return therefore lose 12 cents per dollar over the
        // threshold and reach zero at $250,000, not $350,000. See 26 U.S.C. 151(d)(5)(C)(iii).
        const phaseoutExcess = Math.max(0, federalAGI - obbaSen.phaseoutAGI[status]);
        const perPerson = Math.max(0, obbaSen.perSenior - phaseoutExcess * obbaSen.phaseoutRate);
        seniorDeduction = perPerson * nSeniors;
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
                                                       taxableOrdinaryIncome, inflation, fedRateCreep);
    const federalOrdinaryTax = federalOrdinaryResult.total;
    const federalMarginalRate = federalOrdinaryResult.marginal;

    // ========================================================================
    // STEP 8: Capital Gains Tax (0 / 15 / 20% — NIIT calculated separately)
    // ========================================================================
    const capGainsBrackets = TAXData.FEDERAL.CAPITAL_GAINS[status].brackets;
    const capGainsResult = calculateProgressive(capGainsBrackets, status, taxablePreferentialIncome, inflation, 1, taxableOrdinaryIncome);
    const federalCapGainsTax = capGainsResult.total;
    const capitalGainsRate   = capGainsResult.marginal;

    // ========================================================================
    // STEP 9: NIIT (3.8% surtax — thresholds NOT inflation-indexed)
    // Applies to lesser of net investment income or (MAGI − threshold).
    // ========================================================================
    const niitThreshold = TAXData.FEDERAL.NIIT[status];
    // NIIT MAGI is AGI plus only the section 911 foreign-earned-income exclusion (IRC 1411(d)),
    // which this model does not carry - so here it is plain AGI. Tax-exempt interest is in
    // NEITHER the MAGI nor the NII, which is the whole reason municipal bonds dodge this surtax.
    // This used to read `federalAGI + taxExemptInterest`, the IRMAA definition (see IRMAAMagi
    // below, where the add-back IS correct, per 42 USC 1395r(i)(4)). Provisional income for
    // Social Security adds it back too (IRC 86(b)(2)(B)). Three MAGI-like quantities, three
    // different statutes: do not collapse them again.
    const niitMagi = federalAGI;
    const niitNII = qualifiedDiv + capGains + ordDivInterest;
    const niitExcess = Math.max(0, niitMagi - niitThreshold);
    const niitTax = TAXData.FEDERAL.NIIT.rate * Math.min(niitNII, niitExcess);

    // MARGINAL surtax on the NEXT dollar, by income type. The optimizer's withdrawal ordering
    // needs these: the surtax is real money but it is charged on min(NII, MAGI - threshold), so
    // it does NOT move at the same rate for every kind of dollar and a flat add-on would be wrong.
    //
    //   An INVESTMENT dollar (capital gain, qualified dividend, taxable interest) raises NII and
    //   MAGI together. Whichever of the two terms is binding therefore rises by one, so the
    //   surtax applies in full the moment MAGI is over the threshold. No condition beyond that.
    //
    //   An ORDINARY dollar (IRA withdrawal, Roth conversion, wages) raises MAGI only. It moves
    //   the surtax just while the MAGI EXCESS is the binding term; once NII is the smaller of the
    //   two, more ordinary income widens the excess without touching min() and costs nothing.
    //
    // Measured, not assumed - a $100 probe against calculateTaxes() in all four regimes returns
    // exactly these two rules. The tests are TEST CASE 6d/6e in taxengine.tests.js.
    const niitMarginalOnInvestment = niitExcess > 0 ? TAXData.FEDERAL.NIIT.rate : 0;
    const niitMarginalOnOrdinary   = (niitExcess > 0 && niitExcess < niitNII) ? TAXData.FEDERAL.NIIT.rate : 0;

    const federalTax = federalOrdinaryTax + federalCapGainsTax + niitTax;

    // ========================================================================
    // STEP 10: Totals and return
    // ========================================================================
    const IRMAAMagi = magi;

    const totalTax = federalTax + stateTaxFinal;
    const federalNominalRate = federalOrdinaryResult.nominalRate || 0;
    const stateNominalRate = stateResult.nominalRate || 0;
    const IRMAARate = federalAGI > 0 ? IRMAAAnnualCost / federalAGI : 0;
    const nominalRate = federalNominalRate + stateNominalRate + IRMAARate;

    return {
        nominalRate,
        federalNominalRate,
        stateNominalRate,
        IRMAARate,
        IRMAAAnnualCost,
        totalTax,
        federalTax,
        stateTax: stateTaxFinal,
        stateOrdinaryTax,
        stateCapGainsTax,
        capitalGainsRate,
        capitalGainsTax: federalCapGainsTax,
        niitTax,
        // Both are the statutory rate or zero. `capitalGainsRate` and `federalMarginalRate` stay
        // STATUTORY (they answer "which bracket"); a caller pricing the cost of a dollar adds the
        // matching one of these to them. See the block above STEP 9's `federalTax` for which is which.
        niitMarginalOnInvestment,
        niitMarginalOnOrdinary,
        niitNII,
        AGI: federalAGI,
        MAGI: IRMAAMagi,

        federalOrdinaryTax,
        federalMarginalRate,
        stateMarginalRate,
        fedLimit: federalOrdinaryResult.limit,
        stLimit: stateResult.limit,

        taxableSS,
        provisionalIncome,
        federalTaxableIncome,
        stateTaxableIncome,
        stateAGI,

        federalStdDeduction: federalDeduction,
        stateStdDeduction,      // the standard deduction alone
        stateExemptions,        // ALLOWANCES deductions; with stateStdDeduction, all that comes off before the rates
        stateCredits,           // every credit taken off the state tax; stateTax is after them
        useItemized,
        seniorDeduction,

        ordinaryIncomeInAGI,
        preferentialIncomeInAGI,
        taxableOrdinaryIncome,
        taxablePreferentialIncome,

        // Echoed back so callers can log what rate policy actually produced these numbers.
        fedRateCreep,
        stateRateCreep
    }; // return object
} // calculateTaxes()


///////////////////////////

// onMedicareCount: number of living persons at or past TAXData.IRMAA.ELIGIBILITY_AGE (i.e.
// actually enrolled in Medicare). The age gate is the caller's job — this function never
// sees an age.
// null (default) keeps the legacy household-total behavior. The bracket `r` values are
// household totals (MFJ tables are 2x the per-person surcharge), so per-person = r / persons.
// `medicareRate` is a cumulative FACTOR, not a rate: medicare_costs.js's medicareGrowthFactor(n),
// or 1 for today's published dollars. It defaults to 1 - the identity - so an omitted argument
// changes nothing. It used to default to `1 + ANNUAL_INCREASE`, which silently applied a year of
// growth to any caller that forgot it, and every live caller passes it explicitly anyway.
//
// `cpiRate` is the OTHER axis and is not interchangeable: it indexes the income THRESHOLDS, which
// move at CPI, while medicareRate scales the DOLLARS, which do not.
function calcIRMAA(magi, status, cpiRate, medicareRate = 1, onMedicareCount = null) {

	let IRMAALimit = findUpperLimitByAmount( 'IRMAA', status, magi, cpiRate)
	if (onMedicareCount === null) return IRMAALimit.rate * medicareRate * 12
	const persons = status === 'MFJ' ? 2 : 1;
	return IRMAALimit.rate / persons * Math.min(onMedicareCount, persons) * medicareRate * 12
}

function getIRMAATier(magi, status, cpiRate) {
	const brks = getRateBracket('IRMAA', status);
	if (!brks) return '-';
	const idx = findBracketIndex(brks, magi, cpiRate);
	return idx === -1 ? (brks[0].tier ?? '-') : (brks[idx].tier ?? '-');
}

// The five surcharge tiers of TAXData.IRMAA[status], in order, as a list a caller can draw or
// describe. `-none-` (tier zero, no fee) and the trailing `l: Infinity` terminator are left out:
// neither is a band someone lands in and pays for. Anything that lists tiers goes through here
// rather than filtering the raw rows, so a rename of a row field breaks a test and not a chart.
//
// `l` is the first dollar of the tier at the table's own dollars, so a caller indexing for a later
// year multiplies it by the CPI factor, as every lookup in this file does. `annualCost` is the
// household surcharge in the table's dollars, before any Medicare growth factor.
function getIRMAATiers(status) {
	const brks = getRateBracket('IRMAA', status);
	if (!brks) return [];
	return brks
		.filter(b => b.monthlyCost > 0 && Number.isFinite(b.l))
		.map((b, i) => ({ n: i + 1, tier: b.tier, l: b.l, monthlyCost: b.monthlyCost,
		                  annualCost: b.monthlyCost * 12 }));
}

// Nets a short-term and a long-term capital result the way the return does, and says what each
// part becomes. A loss in either basket offsets a gain in the other; what survives keeps the
// character of the gain it came from (short-term gain is ordinary income, long-term stays
// preferential). If the two together are a NET LOSS, at most `limit` of it offsets ordinary income
// this year and the rest is a carryforward, which this function reports and nothing else uses.
//
// Returns { ordinary, longTerm, carryforward }. `ordinary` is the amount that joins ordinary income
// (negative for a capped net loss), `longTerm` the preferential gain left, `carryforward` the loss
// that does not offset anything this year (>= 0).
function netCapitalLosses(shortTerm, longTerm, limit = TAXData.FEDERAL.CAPITAL_LOSS_LIMIT) {
	if (shortTerm >= 0 && longTerm >= 0) return { ordinary: shortTerm, longTerm, carryforward: 0 };
	const net = shortTerm + longTerm;
	if (net >= 0) {
		// One basket is a loss and the gain in the other absorbs it.
		return shortTerm >= 0
			? { ordinary: net, longTerm: 0, carryforward: 0 }
			: { ordinary: 0, longTerm: net, carryforward: 0 };
	}
	const used = Math.min(-net, limit);
	return { ordinary: -used, longTerm: 0, carryforward: -net - used };
}

// Returns the CPI-adjusted per-person annual QCD limit.
//
// P70d. `cpiFactor` is the CUMULATIVE index factor (sim.cpiRate), the same thing every bracket
// lookup in this file multiplies by. It used to take the simulation year and a scalar RATE and
// exponentiate - and the parameter was NAMED cpiRate while receiving a rate, in a codebase where
// cpiRate means a factor everywhere else. The arithmetic happened to be right; the name was a
// trap, and recomputing from a scalar meant this limit could not follow a Monte Carlo path once
// the rest of the tax code started to.
//
// AMOUNT is stated in TAXData.QCD.YEAR dollars and cpiFactor is anchored at the real current
// year. Keep QCD.YEAR in step with the rest of the table when the data is refreshed.
function getQCDLimit(cpiFactor) {
	return TAXData.QCD.AMOUNT * (cpiFactor ?? 1);
}

// True if a person has reached TAXData.QCD.ELIGIBILITY_AGE (70½) during simYear. A half-year age
// falls in the same calendar year as the whole birthday for a January-June birth and in the next
// year otherwise; a missing birth month counts as the later half.
function isQCDEligible(birthYear, birthMonth, simYear) {
	const age = TAXData.QCD.ELIGIBILITY_AGE;
	const whole = Math.floor(age);
	const nextYear = age > whole && !(birthMonth <= 6);
	return simYear >= birthYear + whole + (nextYear ? 1 : 0);
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
	const currentIdx = findBracketIndex(brks, magi, cpiRate);
	// At index 0 ("-none-" / no surcharge) or below: nothing to escape
	if (currentIdx <= 0) return 0;
	// Target bracket: drop tiersDown, clamped to index 0 (no-surcharge zone)
	const targetIdx = Math.max(currentIdx - tiersDown, 0);
	// Return the TOP of the target tier = just below the next tier's lower bound.
	// For targetIdx=0 this is just below Tier 1's floor (no surcharge).
	const nextFloor = (brks[targetIdx + 1]?.l ?? brks[targetIdx].l);
	return nextFloor * cpiRate - 1;
}

// Dual-mode export: inert in browser/worker (classic script); lets Node tests require() this file.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TAXData, RMD_TABLE, RMD_START_AGE, rmdStartAge, rmdDivisor, getRateBracket,
        findLimitByRate, findUpperLimitByAmount, calculateProgressive,
        calculateTaxes, calcIRMAA, getIRMAATier, getIRMAATiers, netCapitalLosses, getIRMAATierTargetMAGI,
        getQCDLimit, isQCDEligible,
        calculateTaxableSocialSecurity, nonSSIncomeForMAGI, checkStateSources,
        checkStateAllowances, evaluateAllowance, sumAllowances
    };
} else if (typeof window !== 'undefined') {
    // Same list, for the browser. The page itself does NOT need this - every name above is
    // already reachable as a bare global. It exists so the test suites can resolve one object
    // in both modes instead of guessing per symbol, and that guessing is a real hazard here:
    // `function` declarations land on globalThis but `const RMD_TABLE` does not, so a browser
    // test reading RMD_TABLE off globalThis would get undefined and fail somewhere unrelated
    // rather than at the point of the mistake.
    window.TaxEngine = {
        TAXData, RMD_TABLE, RMD_START_AGE, rmdStartAge, rmdDivisor, getRateBracket,
        findLimitByRate, findUpperLimitByAmount, calculateProgressive,
        calculateTaxes, calcIRMAA, getIRMAATier, getIRMAATiers, netCapitalLosses, getIRMAATierTargetMAGI,
        getQCDLimit, isQCDEligible,
        calculateTaxableSocialSecurity, nonSSIncomeForMAGI, checkStateSources,
        checkStateAllowances, evaluateAllowance, sumAllowances
    };
}
