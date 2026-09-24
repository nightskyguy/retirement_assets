'use strict';
//
// Which growth model should carry Medicare premium and IRMAA surcharge dollars forward?
//
// Produces research/MEDICARE_ESCALATION.md. Unlike every other harness here this one does NOT load
// the engine or a household: the question is about a data series, not about a plan, so the only
// repository file it reads is the CPI array the Monte Carlo tab already ships.
//
// Three parts:
//   1. FIT     - four models against the record, over trailing 5, 10 and 20 year windows.
//   2. FORWARD - the same models scored on the 30-year premium stream against a benchmark built
//                from the Trustees' own published path.
//   3. TAIL    - whether part 2's answer depends on believing the long-run assumption.
//
// Sources, all verified 2026-09-24:
//   Part B standard premium 2003-2026   SSA POMS HI 01001.014, the "Base" row.
//   Part B premium 2027-2035 projected  2026 Medicare Trustees Report, Table V.E2.
//   Part B long-run per-capita growth   2026 Trustees: GDP per capita + 0.1 to 0.3 points.
//   Part B AGGREGATE spending 2026-30   2026 Trustees: 8.5%/yr. Not a premium figure. See below.
//   CPI-U December-over-December        montecarlo/historical_returns.js, the repo's own series.

const path = require('path');
const h = require(path.join(__dirname, '..', 'montecarlo', 'historical_returns.js'));
const cpiOf = y => h.inflation[y - h.inflationStartYear];

const partB = {
	2003: 58.70, 2004: 66.60, 2005: 78.20, 2006: 88.50, 2007: 93.50, 2008: 96.40,
	2009: 96.40, 2010: 110.50, 2011: 115.40, 2012: 99.90, 2013: 104.90, 2014: 104.90,
	2015: 104.90, 2016: 121.80, 2017: 134.00, 2018: 134.00, 2019: 135.50, 2020: 144.60,
	2021: 148.50, 2022: 170.10, 2023: 164.90, 2024: 174.70, 2025: 185.00, 2026: 202.90,
};
const proj = {
	2027: 209.50, 2028: 224.50, 2029: 238.50, 2030: 255.50, 2031: 272.10,
	2032: 290.20, 2033: 313.60, 2034: 338.50, 2035: 360.60,
};
const LONG_RUN = 0.038;   // Trustees' long-run Part B per-capita assumption
const FWD_CPI  = 0.024;   // Trustees' ultimate CPI assumption
const YEARS    = 30;      // 2027-2056, one retirement

const pct = (x, d = 2) => (x * 100).toFixed(d) + '%';
const cagr = (a, b, n) => Math.pow(b / a, 1 / n) - 1;

// The premium for year t is announced in the autumn of t-1, and the hold-harmless cap is that
// year's Social Security COLA, computed from CPI-W through Q3 of t-1. So growth in year t pairs
// with CPI(t-1). Pairing it with CPI(t) would test a relationship that cannot exist.
const obs = [];
for (let y = 2004; y <= 2026; y++) obs.push({ y, g: partB[y] / partB[y - 1] - 1, cpi: cpiOf(y - 1) });

// Four models, each fitted by least squares on the annual growth rate with one free parameter or
// none, so the comparison is like for like. M2 is what BOTH "fixed rate above inflation" and
// "cpi + inflation" compute: they differ only in where b comes from.
const MODELS = {
	'M1 fixed rate      g = a': {
		fit: w => ({ a: w.reduce((s, o) => s + o.g, 0) / w.length }),
		pred: (p) => p.a,
		say: p => `a = ${pct(p.a)}`,
	},
	'M2 CPI + excess    g = cpi + b': {
		fit: w => ({ b: w.reduce((s, o) => s + (o.g - o.cpi), 0) / w.length }),
		pred: (p, o) => o.cpi + p.b,
		say: p => `b = ${pct(p.b)}`,
	},
	'M3 CPI x multiple  g = k*cpi': {
		fit: w => ({ k: w.reduce((s, o) => s + o.g * o.cpi, 0) / w.reduce((s, o) => s + o.cpi * o.cpi, 0) }),
		pred: (p, o) => p.k * o.cpi,
		say: p => `k = ${p.k.toFixed(2)}x`,
	},
	'M4 no growth       g = 0': { fit: () => ({}), pred: () => 0, say: () => 'flat' },
};

const rmse = (w, m, p) => Math.sqrt(w.reduce((s, o) => s + Math.pow(o.g - m.pred(p, o), 2), 0) / w.length);

// Run the model forward from the window's first premium: the terminal dollar, not the wiggle, is
// what a retirement projection gets right or wrong.
function levelPath(w, m, p) {
	let lvl = partB[w[0].y - 1];
	return w.map(o => (lvl *= 1 + m.pred(p, o)));
}

console.log('=== 1. THE RECORD ===\n');
console.log('year   premium   growth    CPI(t-1)   excess');
for (const o of obs) {
	console.log(`${o.y}   ${partB[o.y].toFixed(2).padStart(7)}   ${pct(o.g).padStart(7)}   ` +
	            `${pct(o.cpi).padStart(7)}   ${pct(o.g - o.cpi).padStart(8)}`);
}

for (const n of [5, 10, 20]) {
	const w = obs.slice(-n), y0 = w[0].y - 1, y1 = w[n - 1].y;
	const cpiCAGR = Math.pow(w.reduce((s, o) => s * (1 + o.cpi), 1), 1 / n) - 1;
	console.log(`\n--- last ${n} years, ${y0} to ${y1} ---`);
	console.log(`premium CAGR ${pct(cagr(partB[y0], partB[y1], n))}   CPI ${pct(cpiCAGR)}   ` +
	            `excess ${pct(cagr(partB[y0], partB[y1], n) - cpiCAGR)}`);

	// Unrestricted g = alpha + beta*cpi. M2 assumes beta = 1; M1 assumes beta = 0.
	const mg = w.reduce((s, o) => s + o.g, 0) / n, mc = w.reduce((s, o) => s + o.cpi, 0) / n;
	const sxx = w.reduce((s, o) => s + Math.pow(o.cpi - mc, 2), 0);
	const beta = w.reduce((s, o) => s + (o.cpi - mc) * (o.g - mg), 0) / sxx;
	const alpha = mg - beta * mc;
	const sse = w.reduce((s, o) => s + Math.pow(o.g - (alpha + beta * o.cpi), 2), 0);
	const sst = w.reduce((s, o) => s + Math.pow(o.g - mg, 2), 0);
	const se = Math.sqrt(sse / (n - 2) / sxx);
	console.log(`g = ${pct(alpha)} + ${beta.toFixed(3)} x CPI    SE ${se.toFixed(3)}   ` +
	            `t ${(beta / se).toFixed(2)}   R2 ${(1 - sse / sst).toFixed(3)}`);

	console.log('model                         fitted      RMSE     terminal $   err');
	for (const [name, m] of Object.entries(MODELS)) {
		const p = m.fit(w), lp = levelPath(w, m, p);
		console.log(`${name.padEnd(29)} ${m.say(p).padEnd(11)} ${pct(rmse(w, m, p)).padStart(6)}   ` +
		            `${lp[n - 1].toFixed(2).padStart(9)}   ${pct(lp[n - 1] / partB[y1] - 1).padStart(8)}`);
	}
	console.log(`${'actual'.padEnd(29)} ${''.padEnd(11)} ${''.padStart(6)}   ${partB[y1].toFixed(2).padStart(9)}`);
}

// ---- 2. FORWARD ----------------------------------------------------------------------------
// The benchmark is the Trustees' own published premium path while it exists, then their long-run
// assumption. It is the only forward series in evidence that is not something we made up.
function benchmark(longRun) {
	const b = [];
	let lvl = partB[2026];
	for (let y = 2027; y <= 2026 + YEARS; y++) { lvl = proj[y] !== undefined ? proj[y] : lvl * (1 + longRun); b.push(lvl); }
	return b;
}

const CANDIDATES = [
	['flat 4.24%  20y record',              () => 0.0424],
	['flat 4.84%  2010-2035 blend',         () => 0.0484],
	['flat 5.24%  10y record',              () => 0.0524],
	['flat 5.60%  ANNUAL_INCREASE today',   () => 0.0560],
	['flat 5.80%  Optimizer cpi+inflation', () => 0.0580],
	['flat 6.44%  5y record',               () => 0.0644],
	['flat 6.60%  Trustees 2026-2035',      () => 0.0660],
	['flat 2.50%  IncomeTaxPlanner today',  () => 0.0250],
	['flat 8.50%  AGGREGATE spending',      () => 0.0850],
	['CPI + 1.91% excess, 20y fit',         () => FWD_CPI + 0.0191],
	['CPI + 2.13% excess, 10y fit',         () => FWD_CPI + 0.0213],
	['two-phase 6.6->3.8, decay 0.85',      t => LONG_RUN + (0.066 - LONG_RUN) * Math.pow(0.85, t)],
	['two-phase 6.6->3.8, decay 0.90',      t => LONG_RUN + (0.066 - LONG_RUN) * Math.pow(0.90, t)],
	['two-phase 6.6->3.8, decay 0.92',      t => LONG_RUN + (0.066 - LONG_RUN) * Math.pow(0.92, t)],
	['two-phase 6.6->3.8, decay 0.95',      t => LONG_RUN + (0.066 - LONG_RUN) * Math.pow(0.95, t)],
];

function score(g, bench) {
	const bTotal = bench.reduce((s, p) => s + p * 12, 0);
	let p = partB[2026], total = 0, sse = 0;
	const path = [];
	for (let t = 0; t < YEARS; t++) {
		p *= 1 + g(t); total += p * 12; path.push(p);
		sse += Math.pow(p / bench[t] - 1, 2);
	}
	return { y2035: path[8], y2056: path[29], total,
	         e35: path[8] / bench[8] - 1, e56: path[29] / bench[29] - 1,
	         eTot: total / bTotal - 1, rmse: Math.sqrt(sse / YEARS) };
}

console.log('\n\n=== 2. FORWARD ===\n');
console.log("the Trustees' own premium path");
let prev = partB[2026];
for (const y of Object.keys(proj).map(Number)) {
	console.log(`  ${y}   ${proj[y].toFixed(2).padStart(7)}   ${pct(proj[y] / prev - 1).padStart(7)}`);
	prev = proj[y];
}
console.log(`  2026-2030 premium CAGR ${pct(cagr(partB[2026], proj[2030], 4))}`);
console.log(`  2026-2035 premium CAGR ${pct(cagr(partB[2026], proj[2035], 9))}`);
console.log('\nAGGREGATE Part B spending, 2026-2030, is 8.5%/yr. That is a DIFFERENT QUANTITY:');
console.log(`the premium over the same window grows ${pct(cagr(partB[2026], proj[2030], 4))}, and the ` +
            `${pct(0.085 - cagr(partB[2026], proj[2030], 4))} gap is`);
console.log('enrollment growth plus the general-revenue share. Neither is paid by a retiree.');

const bench = benchmark(LONG_RUN);
console.log(`\nbenchmark: published path to 2035, then ${pct(LONG_RUN)}. 2056 $${bench[29].toFixed(2)}, ` +
            `30y total $${Math.round(bench.reduce((s, p) => s + p * 12, 0)).toLocaleString()}\n`);
console.log('model                                 2035 $   err      2056 $   err       30y total     err      RMSE');
const scored = CANDIDATES.map(([label, g]) => ({ label, ...score(g, bench) }));
for (const r of scored) {
	console.log(`${r.label.padEnd(36)} ${r.y2035.toFixed(0).padStart(6)} ${pct(r.e35, 1).padStart(7)}   ` +
	            `${r.y2056.toFixed(0).padStart(6)} ${pct(r.e56, 1).padStart(7)}   ` +
	            `${('$' + Math.round(r.total).toLocaleString()).padStart(10)} ${pct(r.eTot, 1).padStart(7)}   ${pct(r.rmse, 1).padStart(6)}`);
}
console.log('\nranked by 30-year total dollars:');
scored.slice().sort((a, b) => Math.abs(a.eTot) - Math.abs(b.eTot))
	.forEach((r, i) => console.log(`  ${(i + 1 + '.').padStart(4)} ${r.label.padEnd(36)} ${pct(r.eTot, 1).padStart(7)}`));

// ---- 3. TAIL -------------------------------------------------------------------------------
// Part 2 ranks models against a benchmark whose tail is an assumption. If the ranking only holds at
// 3.8%, it is an artifact. This is the test that decides the recommendation.
console.log('\n\n=== 3. TAIL SENSITIVITY ===\n');
console.log('30-year total error as the long-run assumption moves. A two-phase model TAKES the tail');
console.log('as a parameter, so it converges to whatever is assumed; a flat rate cannot.\n');
const TAILS = [0.030, 0.038, 0.045, 0.050, 0.056];
console.log('model'.padEnd(36) + TAILS.map(t => ('LR ' + pct(t, 1)).padStart(9)).join(''));
for (const [label, g] of CANDIDATES) {
	if (/6.44|8.50|2.50|0.85|0.95/.test(label)) continue;  // the clearly-wrong and the near-duplicates
	let line = label.padEnd(36);
	for (const LR of TAILS) {
		// A two-phase candidate converges on the tail being tested, not on the hardcoded LONG_RUN.
		const m = label.match(/decay (0\.\d+)/);
		const gg = m ? (t => LR + (0.066 - LR) * Math.pow(+m[1], t)) : g;
		line += pct(score(gg, benchmark(LR)).eTot, 1).padStart(9);
	}
	console.log(line);
}
