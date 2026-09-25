// medicare_costs.js - how fast Medicare premium and IRMAA surcharge DOLLARS grow.
//
// NOT part of TAXData, deliberately. TAXData is statute: figures a government published, refreshed
// by looking them up. This is a fitted MODEL, and the two rot differently - a bad year of data is a
// correction, a bad model is an argument. The precedent is montecarlo/historical_returns.js.
//
// ZERO DEPENDENCIES, also deliberately. standalone/FutureCost.html loads this WITHOUT taxengine.js,
// so nothing here may read TAXData. That is why the helpers take ELAPSED YEARS rather than a
// calendar year: anchoring is the caller's job, and ANCHOR_YEAR below is the only calendar fact
// here. A test pins it equal to TAXData.IRMAA.YEAR, which is the only way two files that cannot see
// each other stay in step.
//
// THE MODEL, and why it is not a single rate:
//
//     g(t) = gLong + (g0 - gLong) * decay^t
//
// A rate that starts at g0 and eases toward gLong, never reaching it. The officially projected
// future has two phases - the Trustees publish a premium path averaging 6.60% a year to 2035, and
// separately assume about 3.8% in the long run - so a ONE-phase model is wrong at one end or the
// other by construction. Fitting the near term overshoots 2056 by 75%; fitting the long run
// understates the next decade, which is where a conversion decision is actually made.
//
// The measured case for this shape, against the flat and CPI-linked alternatives, is in
// research/MEDICARE_ESCALATION.md. Three findings from it that this file depends on:
//
//   1. CPI CARRIES NO SIGNAL. Regressing premium growth on the prior year's CPI gives a slope of
//      -0.18, 0.44 and 0.24 over 5, 10 and 20 years, against standard errors near 1. Worse, hold
//      harmless gives it the WRONG SIGN: a small COLA protects most beneficiaries, so the whole
//      increase falls on the minority who are not protected and the STANDARD premium jumps. CPI
//      0.70% produced +16.11% in 2016; CPI 6.50% produced -3.06% in 2023. Do not reintroduce a
//      CPI-linked model here.
//   2. THE SHAPE BEATS THE CONSTANT. The best POSSIBLE flat rate (5.02%) still carries 6.94% path
//      error against this model's 2.96%, and every flat rate is right only at the one long-run
//      assumption that suits it, swinging 25 points or more across a plausible range where this
//      model stays within 1.2%.
//   3. 8.5% IS NOT A PREMIUM FIGURE. It is aggregate Part B SPENDING growth, 2026-2030. The premium
//      over that same window grows 5.93%; the gap is enrollment growth and the general-revenue
//      share, neither of which a retiree pays. Never "correct" g0 toward a cost-growth number.
//
// `decay` is the weak parameter and this file should not pretend otherwise: no year-by-year premium
// path is published past 2035, so it is fitted to a benchmark that is part projection and part
// assumption beyond that year. Its optimum is 0.903. What IS measured is that the shape matters
// more than the constant - every decay from 0.85 to 0.95 beats every flat rate on path error.
//
// Sources, all verified 2026-09-24:
//   premium 2003-2026   SSA POMS HI 01001.014, the "Base" row
//                       https://secure.ssa.gov/poms.nsf/lnx/0601001014
//   premium 2027-2035   2026 Medicare Trustees Report, Table V.E2
//                       https://www.cms.gov/oact/tr/2026
//   long-run growth     2026 Trustees: Part B per capita = GDP per capita + 0.1 to 0.3 points

const MEDICARE_COSTS = {
	// The year TAXData.IRMAA's dollars are stated in. Elapsed years are measured from HERE, never
	// from the wall clock: the premiums being scaled are 2026 dollars whatever year it is now.
	ANCHOR_YEAR: 2026,

	g0:    0.066,   // first projected year. Trustees' own 2026-2035 premium CAGR.
	gLong: 0.038,   // the rate it eases toward. Trustees' long-run Part B per-capita assumption.
	decay: 0.90,    // how fast. Fitted; see the note above on why this one is the weak parameter.

	// The series the model was fitted to, shipped so a test can re-derive the CAGR instead of
	// trusting the comment above it - the same reason historical_returns.js ships its series.
	// Nothing reads this at runtime.
	partBStartYear: 2003,
	partBActualThrough: 2026,      // entries after this index are Trustees projections
	partB: [
		//  2003     2004     2005     2006     2007     2008
		    58.70,   66.60,   78.20,   88.50,   93.50,   96.40,
		//  2009     2010     2011     2012     2013     2014
		    96.40,  110.50,  115.40,   99.90,  104.90,  104.90,
		//  2015     2016     2017     2018     2019     2020
		   104.90,  121.80,  134.00,  134.00,  135.50,  144.60,
		//  2021     2022     2023     2024     2025     2026
		   148.50,  170.10,  164.90,  174.70,  185.00,  202.90,
		//  2027     2028     2029     2030     2031     2032    (projected)
		   209.50,  224.50,  238.50,  255.50,  272.10,  290.20,
		//  2033     2034     2035                               (projected)
		   313.60,  338.50,  360.60,
	],
};

// The growth rate in the year `t` whole years after ANCHOR_YEAR. t = 0 is the first projected year,
// so medicareGrowthRate(0) is the rate carrying ANCHOR_YEAR's dollars into ANCHOR_YEAR + 1.
//
// `over` is an optional { g0, gLong, decay }; any key it omits keeps the shipped value, so a caller
// can move one parameter without restating the other two.
function medicareGrowthRate(t, over) {
	const g0    = (over && over.g0    != null) ? over.g0    : MEDICARE_COSTS.g0;
	const gLong = (over && over.gLong != null) ? over.gLong : MEDICARE_COSTS.gLong;
	const decay = (over && over.decay != null) ? over.decay : MEDICARE_COSTS.decay;
	if (!(t > 0)) return g0;                       // t = 0, and anything non-finite or negative
	return gLong + (g0 - gLong) * Math.pow(decay, t);
}

// The cumulative multiplier over `years` years from ANCHOR_YEAR. medicareGrowthFactor(0) is exactly
// 1, so a caller at the anchor year gets today's published dollars unchanged.
//
// A LOOP, not a closed form: the rate differs every year, so there is no single rate to raise to a
// power. That is the whole difference from the flat model this replaced, and it is why callers must
// not "optimize" this into Math.pow.
function medicareGrowthFactor(years, over) {
	let f = 1;
	for (let t = 0; t < years; t++) f *= 1 + medicareGrowthRate(t, over);
	return f;
}

// Dual-mode export, matching taxengine.js. A classic <script> needs neither - every name above is
// already a bare global - but `const MEDICARE_COSTS` is a lexical binding and does NOT land on
// window, so a test reading it as a property would get undefined and fail somewhere unrelated.
if (typeof module !== 'undefined' && module.exports) {
	globalThis.MEDICARE_COSTS = MEDICARE_COSTS;
	globalThis.medicareGrowthRate = medicareGrowthRate;
	globalThis.medicareGrowthFactor = medicareGrowthFactor;
	module.exports = { MEDICARE_COSTS, medicareGrowthRate, medicareGrowthFactor };
} else if (typeof window !== 'undefined') {
	window.MedicareCosts = { MEDICARE_COSTS, medicareGrowthRate, medicareGrowthFactor };
	window.MEDICARE_COSTS = MEDICARE_COSTS;
}
