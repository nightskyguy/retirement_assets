'use strict';
//
// What switching Medicare to the two-phase model costs each household, and three checks that the
// switch is actually wired rather than merely present.
//
//   node .test_harnesses/medicare_delta_harness.js
//
// BYTE IDENTITY IS THE WRONG TEST HERE. This is a deliberate behavior change, so the point is to
// MEASURE the change rather than to prove there is none. A delta harness that measures nothing
// looks exactly like one measuring dead plumbing, which is why parts 1 and 3 exist.
//
//   part 1  EQUIVALENCE  - overriding the model back to a flat rate must reproduce compound
//                          interest, so the old behavior is still reachable and the override is
//                          live. Compared to a closed form computed here, not to an old engine, so
//                          this keeps working after the old code is gone.
//   part 2  DELTA        - the shipped model against the flat 5.8% it replaced, per household.
//   part 3  ZERO         - a zero override must hold premiums at their anchor-year dollars. Without
//                          this, part 2 could pass on plumbing that ignores the override entirely.
//
// The measured case for the model is research/MEDICARE_ESCALATION.md.

const path = require('path');
const ROOT = path.join(__dirname, '..');

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };

const te = require(path.join(ROOT, 'taxengine.js'));
Object.assign(globalThis, te);
require(path.join(ROOT, 'displayhelpers.js'));
const core = require(path.join(ROOT, 'optimizer_core.js'));
const { MEDICARE_COSTS: M, medicareGrowthFactor } = require(path.join(ROOT, 'medicare_costs.js'));
const bank = require(path.join(ROOT, 'plans'));

const money = n => '$' + Math.round(n).toLocaleString('en-US');
const pct = x => (x >= 0 ? '+' : '') + (x * 100).toFixed(2) + '%';

// The flat rate the engine used before the switch: the two page inputs added together.
const flatRateOf = i => i.cpi + i.inflation;
const flatOver = i => { const r = flatRateOf(i); return { g0: r, gLong: r }; };

// Everything the change can touch, plus one thing it must not.
function measure(plan, over) {
	const r = core.simulate({ ...plan.inputs, medicarePremiumMode: 'added', medicareGrowth: over });
	let irmaa = 0, medicare = 0, tierYears = 0;
	for (const yr of r.log) {
		irmaa += yr.IRMAA || 0;
		medicare += yr.Medicare || 0;
		if (yr.IRMAATier && yr.IRMAATier !== '-none-' && yr.IRMAATier !== '-') tierYears++;
	}
	const t = r.totals.terminal || {};
	return {
		irmaa, medicare, tierYears,
		tax: r.totals.tax,
		ending: (t.ira || 0) + (t.roth || 0) + (t.cash || 0) + (t.brokerage || 0),
		funded: r.totals.yearsfunded,
		tested: r.totals.yearstested,
	};
}

const plans = bank.list();

// ── 1. EQUIVALENCE ───────────────────────────────────────────────────────────────────────────
// A flat override must make the Medicare factor exactly compound interest. Reported as a relative
// difference rather than an equality: the engine compounds `1 + rate` where the old code compounded
// `1 + cpi + inflation`, and those associate differently in floating point. One ulp is agreement.
console.log('=== 1. EQUIVALENCE: the flat override reproduces the model it replaced ===\n');
const base12 = (te.TAXData.IRMAA.standardPartB + te.TAXData.IRMAA.standardPartD) * 12;
const elig = te.TAXData.IRMAA.ELIGIBILITY_AGE;
let rows = 0, worst = 0, worstAt = '';
for (const plan of plans) {
	const i = plan.inputs, r = flatRateOf(i);
	const run = core.simulate({ ...i, medicarePremiumMode: 'added', medicareGrowth: flatOver(i) });
	for (const yr of run.log) {
		const n = (yr.age1 >= elig ? 1 : 0) + (yr.age2 >= elig ? 1 : 0);
		if (!n || !yr.Medicare) continue;
		const got = yr.Medicare / (n * base12);
		const want = Math.pow(1 + r, yr.year - M.ANCHOR_YEAR);
		const rel = Math.abs(got - want) / Math.max(1, want);
		rows++;
		if (rel > worst) { worst = rel; worstAt = `${plan.id} ${yr.year}`; }
	}
}
console.log(`${rows} year-rows across ${plans.length} households`);
console.log(`worst relative difference from (1 + cpi + inflation)^n: ${worst.toExponential(2)}  (${worstAt})`);
console.log(worst < 1e-12
	? 'PASS - agreement to floating-point noise, so the old behavior is still reachable\n'
	: '*** FAIL - the flat override is NOT compound interest ***\n');

// ── 2. DELTA ─────────────────────────────────────────────────────────────────────────────────
console.log('=== 2. DELTA: the shipped two-phase model against the flat rate it replaced ===\n');
console.log('household                        flat   IRMAA paid                        ending wealth    funded');
console.log('                                 rate   was -> now                         change         was -> now');
let movedIrmaa = 0, movedEnding = 0;
const fundingChanged = [];
for (const plan of plans) {
	const a = measure(plan, flatOver(plan.inputs));
	const b = measure(plan, undefined);
	const dIrmaa = a.irmaa ? b.irmaa / a.irmaa - 1 : 0;
	// A percentage against a depleted portfolio is noise dressed as a finding: the "overreaching"
	// household ends at zero under both models and still prints +193%. Below a thousand dollars,
	// report the dollars and let the funded-years column carry the real news.
	const dEnd = (a.ending > 1000) ? b.ending / a.ending - 1 : null;
	if (Math.abs(dIrmaa) > 1e-9) movedIrmaa++;
	if (dEnd !== null && Math.abs(dEnd) > 1e-9) movedEnding++;
	if (a.funded !== b.funded) fundingChanged.push(`${plan.id} ${a.funded} -> ${b.funded} of ${a.tested}`);
	console.log(
		plan.id.padEnd(32) +
		((flatRateOf(plan.inputs) * 100).toFixed(2) + '%').padStart(6) + '  ' +
		(a.irmaa ? `${money(a.irmaa)} -> ${money(b.irmaa)} ${pct(dIrmaa)}` : 'never reaches a tier').padEnd(34) +
		(dEnd === null ? 'depleted' : pct(dEnd)).padStart(9) + '   ' +
		`${a.funded}->${b.funded} of ${a.tested}`.padStart(12));
}
console.log(`\n${movedIrmaa} of ${plans.length} households moved on IRMAA, ${movedEnding} on ending wealth.`);
console.log('IRMAA falls on most and rises on some: the model starts ABOVE the flat rates these');
console.log('households use and ends well below them, so which way a household moves depends on how');
console.log('much of its Medicare life is early.');
if (fundingChanged.length) {
	console.log('\nFUNDED YEARS CHANGED - the only outcome here a reader would feel:');
	for (const s of fundingChanged) console.log('  ' + s);
} else {
	console.log('\nNo household funds a different number of years.');
}
console.log('');

// ── 3. ZERO ──────────────────────────────────────────────────────────────────────────────────
console.log('=== 3. ZERO: an override of no growth holds premiums at anchor-year dollars ===\n');
let flatOk = 0;
for (const plan of plans) {
	const run = core.simulate({ ...plan.inputs, medicarePremiumMode: 'added',
	                            medicareGrowth: { g0: 0, gLong: 0 } });
	let ok = true;
	for (const yr of run.log) {
		const n = (yr.age1 >= elig ? 1 : 0) + (yr.age2 >= elig ? 1 : 0);
		if (!n || !yr.Medicare) continue;
		if (Math.abs(yr.Medicare / (n * base12) - 1) > 1e-12) ok = false;
	}
	if (ok) flatOk++;
}
console.log(`${flatOk} of ${plans.length} households hold every year at exactly the anchor-year premium`);
console.log(flatOk === plans.length
	? 'PASS - the override reaches the engine, so part 2 is not measuring dead plumbing'
	: '*** FAIL - a zero override still grew something ***');

console.log(`\nmodel: g0 ${(M.g0 * 100).toFixed(1)}% easing to ${(M.gLong * 100).toFixed(1)}% at decay ${M.decay}` +
            `, anchored at ${M.ANCHOR_YEAR}; 30-year factor ${medicareGrowthFactor(30).toFixed(3)}`);
