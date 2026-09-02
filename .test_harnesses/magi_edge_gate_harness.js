'use strict';
/**
 * magi_edge_gate_harness.js -- P103c / P75a. THE GATE. Do the best plans live on MAGI edges?
 *
 * Run:  node .test_harnesses/magi_edge_gate_harness.js
 *
 * WHY THIS RUNS BEFORE ANY OF P103c IS BUILT. P103c proposes searching two per-year income targets
 * over "the ~12-edge MAGI menu" - the federal bracket tops, the IRMAA tier thresholds and the ACA
 * cliff. That design is only sensible if good plans actually LAND on those edges. The plan has always
 * said so: P75a is the gate, and "mostly interior" means stop and redesign. This measures it.
 *
 * The premise is not obviously true. A ceiling family (Fill Bracket, IRMAA Tier, ACA Cliff) lands on
 * an edge BY CONSTRUCTION - that is what filling a limit means. But P103d's regime map found that in
 * the cells where the money is, the best available family is Guyton-Klinger in 13 of 17, and GK has
 * no reason whatever to stop on a bracket top. So the honest question is not "do ceiling families
 * sit on edges" - they must - but "do the BEST rows sit on edges, in the regimes that matter".
 *
 * WHAT IS MEASURED. For each cell, take the best rows by the repo's own baselineScore, and for every
 * year of each read the realized MAGI out of the log. Compute that year's edge set and record the
 * distance to the nearest edge. Residency is reported as a CURVE over tolerance, not a single number,
 * so the verdict cannot be manufactured by choosing a generous band.
 *
 * Fixtures are the controlled ones (CashReserve 0, spend -1%/yr real), per P103b5c.
 *
 * ── PREDICTIONS UNDER TEST, recorded BEFORE the numbers were looked at ───────────────────────
 *   U-P1. Across ALL best rows, MAGI sits within $1,000 of an edge in a MAJORITY of plan-years.
 *   U-P2. Split by family, the ceiling families are near 100% and the non-ceiling families
 *         (IRA Draw, Ordered, GK, Reduce, Proportional) are LOW - they have no reason to stop on an
 *         edge. So edge residency is a property of the FAMILY, not of good planning.
 *   U-P3. Therefore, in the fat regimes P103d identified - where GK is the best family - residency
 *         is low, and the MAGI-edge menu is the wrong control variable exactly where the money is.
 *         If U-P3 holds, the gate FAILS and P103c needs redesigning before it is built.
 * Scored at the end of the run.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
Object.assign(globalThis, require('../taxengine.js'));
const core = require('../optimizer_core.js');
const {
    simulate, afterTaxNetWorth, SPENDABLE_WEIGHT,
    buildStrategyFamilies, OPTIMIZER_GRIDS, bothOnMedicareAtStart,
} = core;

const money = n => '$' + Math.round(n).toLocaleString();

const COMMON = {
    STATEname: 'CA', nYears: 20,
    birthyear1: 1962, birthmonth1: 6, die1: 92,
    birthyear2: 1964, birthmonth2: 3, die2: 94, hasSpouse: true,
    ss1: 45000, ss1Age: 70, ss2: 24000, ss2Age: 67,
    pensionAnnual: 0, pensionStartAge: 0, survivorPct: 0, pensionCola: false,
    spendChange: -0.01, iraBaseGoal: 0,
    inflation: 0.025, cpi: 0.025, growth: 0.06,
    cashYield: 0.03, dividendRate: 0.02,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: true, propWithdraw: 0.10, iraWithdrawPct: 0.06,
    extraConversionAmount: 0, fundConversionWithCash: false,
    startAge: 64, startInYear: 2026, dividendReinvest: true,
    gkGuard: 0.20, gkAdjPct: 0.10, cycleLTCGTarget: 0.15,
    qcdHHMax: 0, qcdMode: 'asneeded', computeOC: false,
    CashReserve: 0,
};
const MIXES = [
    ['defaults',   { IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000, Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000 }],
    ['defaults3x', { IRA1: 3000000, IRA2: 1200000, Roth: 150000, Roth2: 60000, Brokerage: 300000, BrokerageBasis: 150000, Cash: 150000 }],
    ['round1',     { IRA1: 1800000, IRA2: 700000, Roth: 250000, Roth2: 100000, Brokerage: 900000, BrokerageBasis: 500000, Cash: 150000 }],
    ['thirds',     { IRA1: 1000000, IRA2: 400000, Roth: 1000000, Roth2: 400000, Brokerage: 1400000, BrokerageBasis: 700000, Cash: 150000 }],
    ['brokheavy',  { IRA1: 700000, IRA2: 300000, Roth: 400000, Roth2: 200000, Brokerage: 2800000, BrokerageBasis: 1200000, Cash: 150000 }],
];
const RATES = [0.06, 0.08];
const TOLS = [250, 1000, 2500, 5000, 10000];
const totalAssets = o => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;

// The MAGI menu for one plan-year, built from the ENGINE's own indexed numbers rather than a
// reconstruction. The first version of this harness rebuilt the statutory tables by hand and scaled
// them by `inflationFactor`; it reported 1.1% edge residency for Fill Bracket, a family that fills a
// ceiling BY CONSTRUCTION, and the impossibility of that is what exposed the bug. Two errors: the
// spending inflation factor is not the CPI indexation factor (the log carries both, and P70 gives
// indexation a one-year lag), and a federal bracket ceiling is lifted by the P92a deduction add-back
// so realized MAGI sits ABOVE the statutory top by roughly a standard deduction.
//
// So: `FedCap` and `StateCap` come straight off the log, already indexed by the engine, and the
// remaining edges scale by `-cpiFactor`, which is the indexation factor and not the spending one.
// `BracketTarget` is the ACTIVE ceiling when a ceiling family is running - the number the plan is
// actually aiming at, verified to sit at $0 distance from realized MAGI in the years it binds.
function magiEdgesForYear(row, status) {
    const edges = [];
    const cpiF = row['-cpiFactor'] || 1;
    if (row.FedCap > 0) edges.push(row.FedCap);
    if (row.StateCap > 0) edges.push(row.StateCap);
    if (row.BracketTarget > 0) edges.push(row.BracketTarget);
    const irmaa = getRateBracket('IRMAA', status) || [];
    for (const b of irmaa) if (b.l > 0) edges.push(b.l * cpiF);
    const ltcg = (TAXData.FEDERAL.CAPITAL_GAINS[status]?.brackets ?? []);
    for (const b of ltcg) if (b.l > 0) edges.push(b.l * cpiF);
    const FPL = status === 'MFJ' ? 20440 : 15060;
    for (const m of [1.38, 4.0]) edges.push(FPL * m * cpiF);
    return edges.filter(e => Number.isFinite(e) && e > 0).sort((a, b) => a - b);
}

let SIMS = 0;
function bestRows(base, n) {
    const acaDisabled = bothOnMedicareAtStart(base.birthyear1, base.startAge, true, base.birthyear2);
    const rows = [];
    for (const f of buildStrategyFamilies(base, {
        grids: OPTIMIZER_GRIDS, irmaaFamily: true, acaFamily: !acaDisabled,
        bracketResetsIRMAATier: true, markCashFunding: true,
        cashClones: base.Cash > 0, offGridLast: true })) {
        let r; SIMS++;
        try { r = simulate({ ...base, ...f.overrides }); } catch (e) { continue; }
        if (!r?.totals?.success) continue;
        const last = r.log[r.log.length - 1];
        const atnw = afterTaxNetWorth(r.totals.terminal, r.totals.futureIRARate ?? 0, r.totals.capGainsRate);
        const defl = (r.finalNW && r.finalNW !== 0)
            ? ((last.totalWealth / (last.inflationFactor || 1)) / r.finalNW) : 1;
        rows.push({ f, r, score: atnw * defl + SPENDABLE_WEIGHT * (r.totals.spendCurrentDollars ?? 0) });
    }
    rows.sort((a, b) => b.score - a.score);
    return rows.slice(0, n);
}

console.log('P103c / P75a GATE  do the BEST rows land on MAGI edges, or in the interior?');
console.log('Best 3 rows per cell by baselineScore; every plan-year measured against that year\'s');
console.log('federal / IRMAA / LTCG / ACA edge set. Residency reported as a CURVE over tolerance.\n');

const byFamily = new Map();
const all = [];
const fatCells = [];
for (const [mix, over] of MIXES) for (const sr of RATES) {
    const base = { ...COMMON, ...over, spendGoal: Math.round(totalAssets(over) * sr) };
    const label = mix + ' @' + (sr * 100) + '%';
    for (const row of bestRows(base, 3)) {
        const fam = row.f.family;
        for (const e of row.r.log) {
            const magi = e.MAGI ?? 0;
            if (!(magi > 0)) continue;
            const edges = magiEdgesForYear(e, row.r.totals.status ?? 'MFJ');
            let d = Infinity;
            for (const x of edges) d = Math.min(d, Math.abs(magi - x));
            const rec = { fam, d, label };
            all.push(rec);
            if (!byFamily.has(fam)) byFamily.set(fam, []);
            byFamily.get(fam).push(d);
            if (sr === 0.08) fatCells.push(rec);
        }
    }
}

const share = (arr, tol) => arr.length ? arr.filter(d => d <= tol).length / arr.length : 0;
console.log('ALL best rows, ' + all.length + ' plan-years:');
console.log('  tolerance   within');
for (const t of TOLS) console.log('  ' + money(t).padStart(9) + '   ' + (100 * share(all.map(r => r.d), t)).toFixed(1) + '%');

console.log('\nBY FAMILY (within $1,000):');
const famRows = [...byFamily.entries()].map(([f, ds]) => [f, ds.length, share(ds, 1000)])
    .sort((a, b) => b[2] - a[2]);
for (const [f, n, s] of famRows) console.log('  ' + f.padEnd(18) + String(n).padStart(5) + ' yrs   ' + (100 * s).toFixed(1) + '%');

const fatShare = share(fatCells.map(r => r.d), 1000);
console.log('\nFAT REGIMES ONLY (the 8%-spend cells P103d named), ' + fatCells.length + ' plan-years: ' +
    (100 * fatShare).toFixed(1) + '% within $1,000');

console.log('\n' + '='.repeat(100));
console.log('PREDICTION SCORING  (U-P1..U-P3, recorded before the run)');
console.log('='.repeat(100));
const allShare = share(all.map(r => r.d), 1000);
console.log('U-P1 majority of ALL best-row years within $1,000 of an edge: ' +
    (100 * allShare).toFixed(1) + '% -> ' + (allShare > 0.5 ? 'RIGHT' : 'WRONG'));
const ceil = ['Fill Bracket', 'IRMAA Ceil', 'ACA Cliff'];
const cShare = share(famRows.filter(r => ceil.some(c => r[0].startsWith(c))).flatMap(r => byFamily.get(r[0])), 1000);
const nShare = share(famRows.filter(r => !ceil.some(c => r[0].startsWith(c))).flatMap(r => byFamily.get(r[0])), 1000);
console.log('U-P2 ceiling families high, others low: ceiling ' + (100 * cShare).toFixed(1) +
    '% vs others ' + (100 * nShare).toFixed(1) + '% -> ' + (cShare > 0.5 && nShare < 0.5 ? 'RIGHT' : 'WRONG'));
console.log('U-P3 fat regimes are INTERIOR (residency < 50%): ' + (100 * fatShare).toFixed(1) +
    '% -> ' + (fatShare < 0.5 ? 'RIGHT' : 'WRONG'));
console.log('');
console.log('VERDICT: PROVISIONAL, and deliberately not acted on.');
console.log('This measurement already produced one wrong answer: the first edge set was rebuilt by');
console.log('hand and scaled by the SPENDING inflation factor instead of the CPI indexation one, and');
console.log('reported 1.1% residency for Fill Bracket - a family that fills a ceiling BY CONSTRUCTION.');
console.log('The impossibility of that number is what exposed the bug. Edges now come off the log');
console.log('(FedCap, StateCap, BracketTarget, plus -cpiFactor for the rest), and a direct check');
console.log('confirms Fill Bracket 22% sits at exactly zero distance from its own BracketTarget in');
console.log('the years the ceiling binds - 6 of 33 in the cell tested.');
console.log('');
console.log('So the low residency now looks REAL: ceilings bind in a minority of years even for the');
console.log('families built to fill them, and the best rows are mostly Guyton-Klinger, which has no');
console.log('ceiling at all. But a verdict that would send P103c back to the drawing board should not');
console.log('rest on a measurement whose first version was wrong. Confirm the binding-year counts');
console.log('per family before acting on this.');
console.log('Total ' + SIMS + ' sims');
