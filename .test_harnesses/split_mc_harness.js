'use strict';
/**
 * split_mc_harness.js -- P104b2 (iii). Does a constant split survive an uncertain future?
 *
 * Run:  node .test_harnesses/split_mc_harness.js
 *       node .test_harnesses/split_mc_harness.js --paths 200
 *       node .test_harnesses/split_mc_harness.js --mode bootstrap      (one mode instead of three)
 *
 * WHY THIS IS THE STAGE THAT DECIDES. `P104a` and `P104b2` (ii) both have PERFECT FORESIGHT: every
 * vector is scored on the cell's own realized return path, so the winner is fitted to one future.
 * `P103e` is the standing proof that this is not a technicality - the ordered draw sequences that
 * won a single-path bake-off reached **0% survival** under bootstrap and were removed from
 * consideration entirely. A constant split has to clear the same bar before any row ships.
 *
 * IT REUSES THE SHIPPED MODEL, not a copy. buildBanks() and buildPathInputs() are the same per-path
 * machinery mc_controller and the worker use, exported from montecarlo/mc_engine.js. P71 merged two
 * drifting copies of this model into one file; a third here would undo that.
 *
 * WHAT IS COMPARED. Proportional +0% as the INCUMBENT - which is both the shipped default and
 * Guyton-Klinger's own draw - against:
 *   - the greedy grid from (ii): the vectors that between them capture the most of the achievable
 *     constant-split gain across 30 single-path cells;
 *   - the per-cell single-path winners from (ii), because "the argmax overfits" is a claim that has
 *     to be measured rather than asserted;
 *   - four of the oracle's ten archetypes, including `Cash`, which prediction `V-P1` is about.
 * Every arm runs on the SAME paths - same banks, same seed, same path index - so a difference is the
 * vector and not the draw of the dice.
 *
 * ALL THREE MODES, and the claim is only as good as the worst one. GBM draws each year from one
 * lognormal and so has no sequence risk beyond what independence produces; bootstrap replays real
 * historical blocks and therefore carries real crashes in real order; AAM is the
 * arithmetic-average model. A rule can look robust under GBM and fail under bootstrap, which is
 * exactly what happened in `P103e`.
 *
 * WHAT IS REPORTED. Not an argmax. Median and 10th-percentile real terminal wealth, median lifetime
 * spend, and the success rate - because a vector that lifts the median while lowering the floor or
 * the survival rate is not an improvement for someone living on it.
 *
 * ENGINE NOTE. v11.1718, which includes `P105`. Every fixture has a death inside the plan and
 * `P105` moves single-path scores by up to $110,611 arm-dependently, so these numbers belong with
 * (ii)'s and not with `P104a`'s.
 *
 * ── PREDICTIONS, from the plan, recorded BEFORE this harness was written ─────────────────────
 *   V-P1. `{Cash: 1}` - the single-path winner in 5 of 10 cells in `P104a`'s FIRST run - fails
 *         survival under bootstrap in at least one cell, and is not median-best there. Its phase-2
 *         spill is Cash then IRA, Brokerage, Roth, which is Ordered CIBR's shape, the rule `P103e`
 *         found at 0% survival. NOTE the premise moved twice since it was written: the `P104b1x`
 *         re-baseline and then (ii)'s exhaustive grid both displaced `Cash` as the winner. Scored
 *         as written anyway - a prediction is not re-aimed after the fact.
 *   V-P3. The MC median-best vector is a BLEND (two or more non-zero accounts) in most cells,
 *         never a single account.
 *   V-P4. At least one vector beats Proportional +0% at the median WITH NO WORSE SURVIVAL, in
 *         every mode, in 4 or more of 6 cells.
 *         **THIS IS THE KILL SWITCH. If `V-P4` is WRONG, `P104b3` does not proceed and `P104b`
 *         closes as "no robust constant".**
 * Scored at the end of the run.
 */

globalThis.performance = { now: () => Date.now() };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
Object.assign(globalThis, require('../taxengine.js'));
Object.assign(globalThis, require('../optimizer_core.js'));
Object.assign(globalThis, require('../montecarlo/prng.js'));
Object.assign(globalThis, require('../montecarlo/stats.js'));
const core = require('../optimizer_core.js');
const mc = require('../montecarlo/mc_engine.js');
const { simulate, afterTaxNetWorth } = core;
const { buildBanks, buildPathInputs } = mc;

const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString();
const argv = process.argv.slice(2);
const PATHS = argv.includes('--paths') ? Number(argv[argv.indexOf('--paths') + 1]) : 100;
const MODES = argv.includes('--mode') ? [argv[argv.indexOf('--mode') + 1]] : ['gbm', 'bootstrap', 'aam'];
for (const m of MODES) if (!['gbm', 'bootstrap', 'aam'].includes(m)) throw new Error('bad --mode ' + m);
const YEARS = 33;

// Same household as split_fine_harness.js and gk_drawrule_mc_harness.js, controlled per P103b5c.
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
    convertExcessToRoth: true, propWithdraw: 0, iraWithdrawPct: 0.06,
    extraConversionAmount: 0, fundConversionWithCash: false,
    startAge: 64, startInYear: 2026, dividendReinvest: true,
    gkGuard: 0.20, gkAdjPct: 0.10, cycleLTCGTarget: 0.15,
    qcdHHMax: 0, qcdMode: 'asneeded', computeOC: false,
    CashReserve: 0, strategy: 'propwd',
};
// The six cells gk_drawrule_mc_harness.js uses, so the two Monte Carlo studies are comparable.
// Basis stays at 50%: (ii)'s `F-P3` found basis moves the SIZE of the gain and not the identity of
// the winner (Brokerage share monotone in basis in 8 of 10 pairs, same dominant account in 9 of 10),
// so per-basis cells here would triple the run to re-measure something already answered.
const CELLS = [
    ['defaults @6%',   { IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000, Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000 }, 0.06],
    ['defaults3x @6%', { IRA1: 3000000, IRA2: 1200000, Roth: 150000, Roth2: 60000, Brokerage: 300000, BrokerageBasis: 150000, Cash: 150000 }, 0.06],
    ['round1 @6%',     { IRA1: 1800000, IRA2: 700000, Roth: 250000, Roth2: 100000, Brokerage: 900000, BrokerageBasis: 500000, Cash: 150000 }, 0.06],
    ['thirds @6%',     { IRA1: 1000000, IRA2: 400000, Roth: 1000000, Roth2: 400000, Brokerage: 1400000, BrokerageBasis: 700000, Cash: 150000 }, 0.06],
    ['brokheavy @6%',  { IRA1: 700000, IRA2: 300000, Roth: 400000, Roth2: 200000, Brokerage: 2800000, BrokerageBasis: 1200000, Cash: 150000 }, 0.06],
    ['thirds @8%',     { IRA1: 1000000, IRA2: 400000, Roth: 1000000, Roth2: 400000, Brokerage: 1400000, BrokerageBasis: 700000, Cash: 150000 }, 0.08],
];
// [IRA, Brokerage, Cash, Roth]. null = the incumbent, no override.
// The greedy grid and the per-cell argmaxes both come from (ii); the archetypes are the oracle's.
const ARMS = [
    ['prop +0% (incumbent)', null],
    ['B7C2R1  [grid 1]',  [7, 2, 1, 0]],
    ['I5C4R1  [grid 2]',  [5, 0, 4, 1]],
    ['B6C2R2  [grid 3]',  [0, 6, 2, 2]],
    ['B9C1    [grid 4]',  [0, 9, 1, 0]],
    ['B7C1R2  [argmax]',  [0, 7, 1, 2]],
    ['I4C5R1  [argmax]',  [4, 0, 5, 1]],
    ['I6C4    [argmax]',  [6, 0, 4, 0]],
    ['Cash    [V-P1]',    [0, 0, 1, 0]],
    ['Brok    [menu]',    [0, 1, 0, 0]],
    ['I5C5    [menu]',    [5, 0, 5, 0]],
    ['B4C6    [menu]',    [0, 4, 6, 0]],
];
const nonZero = name => {
    const a = ARMS.find(([n]) => n === name);
    return a && a[1] ? a[1].filter(x => x > 0).length : null;
};
const totalAssets = o => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;
const pct = (arr, p) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
};

console.log('\nP104b2 (iii)  DOES A CONSTANT SPLIT SURVIVE UNCERTAINTY?  ' + PATHS + ' paths, '
    + YEARS + ' years, modes: ' + MODES.join(' / ') + '.');
console.log('Incumbent is Proportional +0%, which is the shipped default AND Guyton-Klinger\'s draw.');
console.log('Same banks and same path index for every arm, so a difference is the VECTOR.');
console.log('Reported: median and p10 real terminal wealth, median lifetime spend, success rate.');

let SIMS = 0;
const results = [];      // { mode, label, rows: [{name, med, p10, spend, ok}] }
for (const mode of MODES) {
    for (const [label, over, sr] of CELLS) {
        const base = { ...COMMON, ...over, spendGoal: Math.round(totalAssets(over) * sr) };
        // mu/sigma are REQUIRED for the synthetic modes - buildBanks destructures them off cfg and
        // a missing one makes logDrift NaN, which propagates silently to a 100%-success table of
        // NaN. The page's own defaults are 7% and 12% (#mc-mu / #mc-sigma).
        const cfg = { years: YEARS, numPaths: PATHS, seed: 42, baseInputs: base,
                      mu: 0.07, sigma: 0.12, inflationRate: base.inflation };
        const banks = buildBanks(cfg, mulberry32(42), mode);

        const per = new Map(ARMS.map(([n]) => [n, { w: [], spend: [], ok: 0 }]));
        for (let p = 0; p < PATHS; p++) {
            const pathIn = buildPathInputs(banks, p, YEARS, base, mode);
            for (const [name, v] of ARMS) {
                const inputs = v ? { ...base, ...pathIn, strategy: 'split', splitWeights: v }
                                 : { ...base, ...pathIn };
                let r; SIMS++;
                try { r = simulate(inputs); } catch (e) { continue; }
                if (r?.totals?.splitWeightsInvalid) throw new Error(name + ': engine rejected the vector');
                const rec = per.get(name);
                if (!r?.totals?.success) continue;
                rec.ok++;
                const last = r.log[r.log.length - 1];
                const atnw = afterTaxNetWorth(r.totals.terminal, r.totals.futureIRARate ?? 0, r.totals.capGainsRate);
                const defl = (r.finalNW && r.finalNW !== 0)
                    ? ((last.totalWealth / (last.inflationFactor || 1)) / r.finalNW) : 1;
                rec.w.push(atnw * defl);
                rec.spend.push(r.totals.spendCurrentDollars ?? 0);
            }
        }
        const rows = ARMS.map(([name]) => {
            const r = per.get(name);
            return { name, med: pct(r.w, 50), p10: pct(r.w, 10), spend: pct(r.spend, 50), ok: r.ok / PATHS };
        });
        results.push({ mode, label, rows });
    }
}

// ── Report ──────────────────────────────────────────────────────────────────────────────────
for (const mode of MODES) {
    console.log('\n' + '='.repeat(96));
    console.log('MODE: ' + mode.toUpperCase());
    console.log('='.repeat(96));
    for (const { label, rows } of results.filter(r => r.mode === mode)) {
        const inc = rows[0];
        console.log('\n== ' + label + ' ==');
        console.log('  vector'.padEnd(24) + 'med wealth'.padStart(14) + 'p10 wealth'.padStart(14)
            + 'med spend'.padStart(13) + 'success'.padStart(9) + '   vs incumbent');
        for (const r of rows) {
            const dMed = (r.med != null && inc.med != null) ? r.med - inc.med : null;
            const flag = r === inc ? '' :
                (dMed > 0 && r.ok >= inc.ok - 1e-9) ? 'better, survival held'
                : (dMed > 0) ? 'better median, WORSE survival'
                : 'no better';
            console.log('  ' + r.name.padEnd(24) + money(r.med ?? 0).padStart(14) + money(r.p10 ?? 0).padStart(14)
                + money(r.spend ?? 0).padStart(13) + ((100 * r.ok).toFixed(0) + '%').padStart(9)
                + '   ' + (dMed == null ? '' : (dMed > 0 ? '+' : '') + money(dMed) + '  ' + flag));
        }
    }
}

// ── Prediction scoring ──────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(96));
console.log('PREDICTION SCORING  (V-P1, V-P3, V-P4 - recorded in task_plan.md before the run)');
console.log('='.repeat(96));

// V-P4, the kill switch: a vector that beats the incumbent at the median with no worse survival,
// in EVERY mode, counted per cell.
let robustCells = 0;
const robustBy = new Map();
for (const [label] of CELLS) {
    const perMode = MODES.map(m => results.find(r => r.mode === m && r.label === label));
    const survivors = ARMS.slice(1).map(([name]) => name).filter(name =>
        perMode.every(res => {
            const inc = res.rows[0], row = res.rows.find(r => r.name === name);
            return row.med != null && inc.med != null && row.med > inc.med && row.ok >= inc.ok - 1e-9;
        }));
    if (survivors.length) { robustCells++; robustBy.set(label, survivors); }
    console.log('  ' + label.padEnd(17) + (survivors.length
        ? survivors.length + ' of ' + (ARMS.length - 1) + ' beat the incumbent in EVERY mode, survival held: '
          + survivors.map(s => s.split('[')[0].trim()).join(', ')
        : 'NO vector beats the incumbent in every mode with survival held'));
}
console.log('\nV-P4  at least one vector beats Proportional +0% at the median with no worse survival,');
console.log('      in every mode, in 4 or more of 6 cells');
console.log('      -> ' + robustCells + ' of ' + CELLS.length + '. '
    + (robustCells >= 4 ? 'RIGHT - b3 may proceed on these cells'
                        : 'WRONG - THE KILL SWITCH FIRES: b3 does not proceed, P104b closes as "no robust constant"'));

// V-P3: is the median-best arm a blend?
let blendBest = 0, totalModeCells = 0, singleBest = [];
for (const { mode, label, rows } of results) {
    totalModeCells++;
    const best = rows.filter(r => r.med != null).reduce((a, b) => (b.med > a.med ? b : a));
    const nz = nonZero(best.name);
    if (nz == null) continue;                       // the incumbent won this mode-cell
    if (nz >= 2) blendBest++; else singleBest.push(`${mode}/${label}: ${best.name.trim()}`);
}
console.log('\nV-P3  the MC median-best vector is a BLEND in most cells, never a single account');
console.log('      -> blend in ' + blendBest + ' of ' + totalModeCells + ' mode-cells'
    + (singleBest.length ? '; single-account best in ' + singleBest.length + ': ' + singleBest.join('; ').slice(0, 70) : '')
    + '. ' + (blendBest * 2 > totalModeCells ? 'RIGHT on "most"' : 'WRONG on "most"')
    + (singleBest.length ? ', and "never a single account" is WRONG' : ', and "never a single account" holds'));

// V-P1: Cash under bootstrap.
const cashName = ARMS.find(([n]) => n.startsWith('Cash'))[0];
let cashFails = 0, cashNotBest = 0;
const bootstrapRuns = results.filter(r => r.mode === 'bootstrap');
for (const { label, rows } of bootstrapRuns) {
    const inc = rows[0], cash = rows.find(r => r.name === cashName);
    const best = rows.filter(r => r.med != null).reduce((a, b) => (b.med > a.med ? b : a));
    const worse = cash.ok < inc.ok - 1e-9;
    if (worse) cashFails++;
    if (best.name !== cashName) cashNotBest++;
    console.log('  bootstrap ' + label.padEnd(17) + 'Cash survival ' + (100 * cash.ok).toFixed(0)
        + '% vs incumbent ' + (100 * inc.ok).toFixed(0) + '%'
        + (worse ? '  WORSE' : '  held') + ';  median-best is ' + best.name.trim());
}
console.log('\nV-P1  Cash fails survival under bootstrap in at least one cell, and is not median-best there');
console.log('      -> survival worse in ' + cashFails + ' of ' + bootstrapRuns.length
    + ' bootstrap cells; not median-best in ' + cashNotBest + ' of ' + bootstrapRuns.length + '. '
    + (bootstrapRuns.length === 0 ? 'NOT SCORED (bootstrap not run)'
       : cashFails > 0 ? 'RIGHT' : 'WRONG on the survival half'));
console.log('      (V-P2 was scored by (ii) as F-P1: the fine grid DOES beat the menu, but by a');
console.log('       median 76.4% of the menu\'s gain, not the predicted "under 10%" - so WRONG.)');

// ── What (iv) has to recommend: which vectors are robust, and where they are worst ──────────
// A vector earns a row by clearing the incumbent on THREE counts in EVERY mode, not one: the
// median, the 10th-percentile floor, and the success rate. The median alone is the metric that
// hides a rule bought with risk, which is the whole reason this stage exists.
console.log('\n' + '='.repeat(96));
console.log('ROBUSTNESS BY VECTOR  (across ' + CELLS.length + ' cells x ' + MODES.length + ' modes)');
console.log('='.repeat(96));
console.log('  vector'.padEnd(13) + 'cells won'.padStart(11) + 'med gain'.padStart(14)
    + 'worst p10'.padStart(14) + 'worst surv'.padStart(12) + '   floor holds everywhere');
const medOf = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const summary = [];
for (const [name] of ARMS.slice(1)) {
    const gains = [], dP10 = [], dOk = [];
    let cellsAllModes = 0;
    for (const [label] of CELLS) {
        const perMode = MODES.map(m => results.find(r => r.mode === m && r.label === label));
        let allModes = true;
        for (const res of perMode) {
            const inc = res.rows[0], row = res.rows.find(r => r.name === name);
            if (row.med == null || inc.med == null) { allModes = false; continue; }
            gains.push(row.med - inc.med);
            dP10.push((row.p10 ?? 0) - (inc.p10 ?? 0));
            dOk.push(row.ok - inc.ok);
            if (!(row.med > inc.med && row.ok >= inc.ok - 1e-9)) allModes = false;
        }
        if (allModes) cellsAllModes++;
    }
    const worstP10 = Math.min(...dP10), worstOk = Math.min(...dOk);
    summary.push({ name, cellsAllModes, med: medOf(gains), worstP10, worstOk });
}
summary.sort((a, b) => b.cellsAllModes - a.cellsAllModes || b.med - a.med);
for (const s of summary)
    console.log('  ' + s.name.split('[')[0].trim().padEnd(11) + (s.cellsAllModes + '/' + CELLS.length).padStart(11)
        + money(s.med).padStart(14) + money(s.worstP10).padStart(14)
        + ((s.worstOk >= 0 ? '' : '') + (100 * s.worstOk).toFixed(0) + 'pp').padStart(12)
        + '   ' + (s.worstP10 >= 0 ? 'yes' : 'NO - floor falls in at least one mode-cell'));
console.log('\n  "cells won" = beats the incumbent median in ALL ' + MODES.length
    + ' modes with survival held. "worst p10"/"worst surv" are the WORST');
console.log('  mode-cell for that vector, so a negative there is a real floor or survival cost'
    + ' somewhere even when the median is up.');

console.log('\n  ' + SIMS.toLocaleString() + ' sims\n');
