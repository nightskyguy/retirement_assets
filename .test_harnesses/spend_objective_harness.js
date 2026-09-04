'use strict';
/**
 * spend_objective_harness.js -- P103b5a. Can spend be SEARCHED, and under what objective?
 *
 * Run:  node .test_harnesses/spend_objective_harness.js
 *
 * WHY THIS COMES BEFORE ANY FIELD. P103b5 wants spendGoal to become a schedule decision, because
 * Guyton-Klinger's per-year decision IS the spend and the oracle has never searched that axis. But
 * every oracle number in PERFECT_FORESIGHT_ORACLE.md is produced with spend PINNED, and the pin is
 * not an oversight: without it a spend-adaptive arm "wins" by cutting spending, which is how a GK
 * base once showed a fake +81% that was pure spend-shifting. So the first question is not "what
 * field" but "what objective", and it has to be measured before it is chosen.
 *
 * WHAT THE ENGINE ALREADY HAS, and it is load-bearing everywhere. `baselineScoreOf` scores a run as
 *
 *     real terminal after-tax net worth  +  SPENDABLE_WEIGHT x lifetime spend in current dollars
 *
 * with SPENDABLE_WEIGHT = 1.10, a bare constant carrying no comment about where 1.10 came from. It
 * decides champion selection in every harness in this repo and the Optimizer's own ranking. Note the
 * units: totals.spendCurrentDollars ACCUMULATES over the horizon, so this is lifetime spending, not
 * one year of it - on the defaults cell it is roughly $3.2M against ~$5.9M of terminal wealth. That
 * makes 1.10 a genuine exchange rate, not a tie-break: it asserts a dollar of lifetime spending is
 * worth 1.10 dollars of terminal wealth.
 *
 * THE TEST. Sweep a constant spend multiplier, trace the achievable (spend, wealth) frontier, and
 * ask where each candidate objective's argmax lands. An objective whose optimum sits at the FEASIBLE
 * BOUNDARY - spend as much as the plan survives - cannot be used to search the spend axis, because
 * the search would return "spend everything" in every cell and the answer would be the weight rather
 * than the plan. Only an interior optimum makes a scalarized objective usable.
 *
 * ── PREDICTIONS UNDER TEST, recorded BEFORE the numbers were looked at ───────────────────────
 *   O-P1. Under the shipped weight 1.10 the argmax sits at the FEASIBLE BOUNDARY, not in the
 *         interior. Reasoning: a dollar spent in the final year costs about one dollar of terminal
 *         wealth and is credited 1.10, so the objective always prefers more late spending.
 *   O-P2. The empirical exchange rate along the frontier - how much real terminal wealth one extra
 *         dollar of lifetime spending costs - is well ABOVE 1.10 for early spending, because a
 *         dollar not spent compounds at the real growth rate for the rest of the horizon. So 1.10
 *         systematically prefers spending over wealth relative to what the model actually trades.
 *   O-P3. The exchange rate is NOT constant along the frontier, so no single weight makes the
 *         objective agree with the model at both ends. If O-P3 holds, a scalarized objective is the
 *         wrong shape and P103b5 needs a frontier, not a weight.
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

const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString();

const COMMON = {
    STATEname: 'CA', nYears: 20,
    birthyear1: 1962, birthmonth1: 6, die1: 92,
    birthyear2: 1964, birthmonth2: 3, die2: 94, hasSpouse: true,
    ss1: 45000, ss1Age: 70, ss2: 24000, ss2Age: 67,
    pensionAnnual: 0, pensionStartAge: 0, survivorPct: 0, pensionCola: false,
    spendChange: 0, iraBaseGoal: 0,
    inflation: 0.025, cpi: 0.025, growth: 0.06,
    cashYield: 0.03, dividendRate: 0.02,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: true, propWithdraw: 0.10, iraWithdrawPct: 0.06,
    extraConversionAmount: 0, fundConversionWithCash: false,
    startAge: 64, startInYear: 2026, dividendReinvest: true,
    gkGuard: 0.20, gkAdjPct: 0.10, cycleLTCGTarget: 0.15,
    qcdHHMax: 0, qcdMode: 'asneeded', computeOC: false,
};
const CELLS = [
    ['defaults @4%', { IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000,
                       Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000 }, 0.04],
    ['round1 @4%',   { IRA1: 1800000, IRA2: 700000, Roth: 250000, Roth2: 100000,
                       Brokerage: 900000, BrokerageBasis: 500000, Cash: 150000 }, 0.04],
    ['thirds @4%',   { IRA1: 1000000, IRA2: 400000, Roth: 1000000, Roth2: 400000,
                       Brokerage: 1400000, BrokerageBasis: 700000, Cash: 150000 }, 0.04],
];
const MULTS = [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0];
const totalAssets = o => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;

let SIMS = 0;
const runSim = i => { SIMS++; return simulate(i); };

// Real terminal after-tax net worth. Same deflation convention as every other harness here.
function wealthOf(res, rate) {
    if (!res?.totals?.success) return null;
    if ((res.totals.shortfall ?? 0) > 1) return null;
    const last = res.log[res.log.length - 1];
    const atnw = afterTaxNetWorth(res.totals.terminal, rate, res.totals.capGainsRate);
    const defl = (res.finalNW && res.finalNW !== 0)
        ? ((last.totalNetWealth / (last.inflationFactor || 1)) / res.finalNW) : 1;
    return atnw * defl;
}

// The base row: best baselineScore among non-cyclic arms, which is the repo's own champion rule.
function pickBase(cellBase) {
    const acaDisabled = bothOnMedicareAtStart(cellBase.birthyear1, cellBase.startAge,
        !!cellBase.hasSpouse, cellBase.hasSpouse ? (cellBase.birthyear2 || 0) : 0);
    let best = null, rate = 0;
    const rows = [];
    for (const f of buildStrategyFamilies(cellBase, {
        grids: OPTIMIZER_GRIDS, irmaaFamily: true, acaFamily: !acaDisabled,
        bracketResetsIRMAATier: true, markCashFunding: true,
        cashClones: cellBase.Cash > 0, offGridLast: true })) {
        if (f.overrides.cyclicEnabled) continue;
        let res; try { res = runSim({ ...cellBase, ...f.overrides }); } catch (e) { continue; }
        rows.push({ f, res });
    }
    rate = rows[0]?.res?.totals?.futureIRARate ?? 0;
    for (const r of rows) {
        const w = wealthOf(r.res, rate);
        if (w == null) continue;
        const sc = w + SPENDABLE_WEIGHT * (r.res.totals.spendCurrentDollars ?? 0);
        if (!best || sc > best.sc) best = { ...r, sc, w };
    }
    return { base: best, rate };
}

console.log('P103b5a  can the spend axis be searched, and under what objective?');
console.log('Sweeping a constant spend multiplier and tracing the achievable (spend, wealth) frontier.');
console.log('SPENDABLE_WEIGHT is ' + SPENDABLE_WEIGHT + ' and multiplies LIFETIME spend in current dollars.\n');

const verdicts = [];
for (const [label, over, sr] of CELLS) {
    const cellBase = { ...COMMON, ...over, spendGoal: Math.round(totalAssets(over) * sr) };
    const { base, rate } = pickBase(cellBase);
    if (!base) { console.log(label + ': no feasible base row, skipped'); continue; }
    const ov = base.f.overrides;
    console.log('== ' + label + ' ==  base ' + base.f.family + ' ' + base.f.paramLabel +
        ', spendGoal ' + money(cellBase.spendGoal));
    console.log('  mult   lifetime spend    real terminal NW    d(NW)/d(spend)   score @1.10');

    // Rows printed in spend order, feasible and infeasible interleaved, because the ORDER is itself
    // a result: feasibility is not monotone in the spend goal (see the note under the table).
    const pts = [], rows = [];
    for (const m of MULTS) {
        const res = runSim({ ...cellBase, ...ov, spendGoal: Math.round(cellBase.spendGoal * m) });
        const w = wealthOf(res, rate);
        if (w == null) { rows.push({ m, bad: true }); continue; }
        const pt = { m, sp: res.totals.spendCurrentDollars ?? 0, w };
        pts.push(pt); rows.push(pt);
    }
    let prev = null;
    for (const r of rows) {
        if (r.bad) { console.log('  ' + r.m.toFixed(2).padStart(4) + '   (infeasible - a year fell below 99% of target)'); continue; }
        const slope = prev ? (r.w - prev.w) / Math.max(1, r.sp - prev.sp) : null;
        console.log('  ' + r.m.toFixed(2).padStart(4) + money(r.sp).padStart(16) + money(r.w).padStart(20) +
            (slope == null ? '        -' : slope.toFixed(3).padStart(17)) +
            money(r.w + SPENDABLE_WEIGHT * r.sp).padStart(16));
        prev = r;
    }
    // Non-monotone feasibility, reported rather than smoothed over. totals.success is a PER-YEAR
    // test (netIncome < targetSpend * 0.99), so a plan can dip under the threshold in a narrow band
    // of spend goals and recover above it. A spend search may not assume that everything below a
    // feasible spend is also feasible.
    const firstOk = rows.findIndex(r => !r.bad);
    const gaps = rows.slice(firstOk).filter((r, i, a) => r.bad && a.slice(i + 1).some(z => !z.bad));
    if (gaps.length) {
        console.log('  NOTE: feasibility is NOT monotone - infeasible at mult ' +
            gaps.map(g => g.m.toFixed(2)).join(', ') + ' with feasible points on BOTH sides.');
    }
    if (pts.length < 2) { console.log('  too few feasible points\n'); continue; }

    const argmax = pts.reduce((a, b) => (b.w + SPENDABLE_WEIGHT * b.sp) > (a.w + SPENDABLE_WEIGHT * a.sp) ? b : a);
    const atBoundary = argmax.m === pts[pts.length - 1].m;
    const slopes = [];
    for (let i = 1; i < pts.length; i++) {
        slopes.push(-(pts[i].w - pts[i - 1].w) / Math.max(1, pts[i].sp - pts[i - 1].sp));
    }
    const sMin = Math.min(...slopes), sMax = Math.max(...slopes);
    console.log('  argmax @1.10 is mult ' + argmax.m.toFixed(2) +
        (atBoundary ? '  <-- FEASIBLE BOUNDARY (highest spend tested)' : '  (interior)'));
    console.log('  exchange rate |d(NW)/d(spend)| ranges ' + sMin.toFixed(3) + ' to ' + sMax.toFixed(3) +
        '; the shipped weight is ' + SPENDABLE_WEIGHT.toFixed(2) + '\n');
    verdicts.push({ label, atBoundary, sMin, sMax, argmaxMult: argmax.m });
}

console.log('='.repeat(100));
console.log('PREDICTION SCORING  (O-P1..O-P3, recorded before the run)');
console.log('='.repeat(100));
const nBoundary = verdicts.filter(v => v.atBoundary).length;
console.log('O-P1 argmax at the feasible boundary under 1.10: ' + nBoundary + '/' + verdicts.length +
    ' -> ' + (nBoundary === verdicts.length ? 'RIGHT' : nBoundary === 0 ? 'WRONG' : 'MIXED'));
const allAbove = verdicts.every(v => v.sMin > SPENDABLE_WEIGHT);
console.log('O-P2 exchange rate everywhere above 1.10: ' + (allAbove ? 'RIGHT' : 'WRONG') +
    '  (min seen ' + Math.min(...verdicts.map(v => v.sMin)).toFixed(3) + ')');
const spread = verdicts.map(v => v.sMax - v.sMin);
const notConstant = spread.every(s => s > 0.05);
console.log('O-P3 exchange rate varies along the frontier: ' + (notConstant ? 'RIGHT' : 'WRONG') +
    '  (widest spread ' + Math.max(...spread).toFixed(3) + ')');
console.log('\nWHAT THIS DECIDES. If the argmax sits at the boundary, a scalarized objective cannot');
console.log('SEARCH the spend axis - it would answer "spend everything the plan survives" in every');
console.log('cell, and the answer would be the weight rather than the plan. If the exchange rate also');
console.log('varies along the frontier, no single weight fixes that, and P103b5 needs a frontier.');
console.log('\nTotal ' + SIMS + ' sims');
