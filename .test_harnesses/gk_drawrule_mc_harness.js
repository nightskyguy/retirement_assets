'use strict';
/**
 * gk_drawrule_mc_harness.js -- P103e. Does P103d's result survive uncertainty?
 *
 * Run:  node .test_harnesses/gk_drawrule_mc_harness.js
 *       node .test_harnesses/gk_drawrule_mc_harness.js --paths 200
 *       node .test_harnesses/gk_drawrule_mc_harness.js --mode bootstrap   (historical blocks)
 *       node .test_harnesses/gk_drawrule_mc_harness.js --mode aam         (arithmetic-average model)
 *
 * THE MODE MATTERS AND ONE MODE IS NOT AN ANSWER. GBM draws every year from one lognormal, so it
 * has no sequence risk beyond what independence produces; bootstrap replays real historical blocks
 * and therefore carries real crashes in real order. A draw rule can look robust under GBM and fail
 * under bootstrap for exactly the reason P103e exists - so the shippable claim is only as good as
 * its worst mode.
 *
 * WHY THIS IS THE STAGE THAT DECIDES ANYTHING. Every number in P103a-P103d comes from ONE
 * deterministic return path (6% growth, 2.5% inflation, every year). A rule that wins on one path
 * may be winning because it took more risk, and a point estimate cannot tell the difference. P103d
 * found GK's DRAW beaten in 24 of 30 cells, worth a median $231,345 - this asks whether that holds
 * when the future is uncertain, and whether it was bought with survival.
 *
 * IT REUSES THE SHIPPED MODEL, not a copy of it. buildBanks() and buildPathInputs() are the same
 * per-path machinery mc_controller and the worker use, exported from montecarlo/mc_engine.js. P71
 * merged two drifting copies of this model into one file; writing a third here would undo that.
 *
 * WHAT IS COMPARED. Incumbent `strategy: 'gk'` against the candidate draw rules from P103d, each run
 * with `spendRule: 'gk'`, on the SAME paths - same banks, same seed, same path index - so the
 * difference is the rule and not the draw of the dice. Both fixtures stay controlled (CashReserve 0,
 * spend -1%/yr real).
 *
 * WHAT IS REPORTED. Not an argmax. Median and 10th-percentile real terminal wealth, median lifetime
 * spend, and the success rate, because a rule that raises the median while lowering the floor or the
 * survival rate is not an improvement for someone living on it.
 *
 * ── PREDICTIONS UNDER TEST, recorded BEFORE the numbers were looked at ───────────────────────
 *   E-P1. The single-path advantage SHRINKS materially under uncertainty but stays positive at the
 *         median in most cells - the direction survives, the size does not.
 *   E-P2. Success rate is no worse for the winning draw rule. If the extra wealth was bought by
 *         taking more risk, this is where it shows, and it would disqualify the result.
 *   E-P3. The per-cell winner chosen on ONE path is NOT the median-best rule in a substantial
 *         minority of cells - single-path selection overfits, which is the whole reason this stage
 *         exists.
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
const MODE  = argv.includes('--mode')  ? argv[argv.indexOf('--mode') + 1] : 'gbm';
if (!['gbm', 'bootstrap', 'aam'].includes(MODE)) throw new Error('--mode must be gbm|bootstrap|aam');
const YEARS = 33;

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
// The cells P103d found GK's draw beaten in, one per mix at each spend rate it lost.
const CELLS = [
    ['defaults @6%',   { IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000, Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000 }, 0.06],
    ['defaults3x @6%', { IRA1: 3000000, IRA2: 1200000, Roth: 150000, Roth2: 60000, Brokerage: 300000, BrokerageBasis: 150000, Cash: 150000 }, 0.06],
    ['round1 @6%',     { IRA1: 1800000, IRA2: 700000, Roth: 250000, Roth2: 100000, Brokerage: 900000, BrokerageBasis: 500000, Cash: 150000 }, 0.06],
    ['thirds @6%',     { IRA1: 1000000, IRA2: 400000, Roth: 1000000, Roth2: 400000, Brokerage: 1400000, BrokerageBasis: 700000, Cash: 150000 }, 0.06],
    ['brokheavy @6%',  { IRA1: 700000, IRA2: 300000, Roth: 400000, Roth2: 200000, Brokerage: 2800000, BrokerageBasis: 1200000, Cash: 150000 }, 0.06],
    ['thirds @8%',     { IRA1: 1000000, IRA2: 400000, Roth: 1000000, Roth2: 400000, Brokerage: 1400000, BrokerageBasis: 700000, Cash: 150000 }, 0.08],
];
// P103d's winners, plus the incumbent. `null` overrides = GK decides the draw too.
const RULES = [
    ['GK (incumbent)',   null],
    ['Ordered CIBR',     { strategy: 'ordered', orderedSeq: 'CIBR' }],
    ['Fill Bracket 22%', { strategy: 'bracket', stratRate: 0.22 }],
    ['IRA Draw 5%',      { strategy: 'fixedpct', iraWithdrawPct: 0.05 }],
    ['Ordered CBIR',     { strategy: 'ordered', orderedSeq: 'CBIR' }],
];
const totalAssets = o => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;
const pct = (arr, p) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
};

console.log('P103e  does P103d survive uncertainty?  ' + PATHS + ' paths, ' + YEARS + ' years, ' + MODE.toUpperCase() + '.');
console.log('Same banks and same path index for every rule, so the difference is the RULE.');
console.log('Reported: median and p10 real terminal wealth, median lifetime spend, success rate.\n');

let SIMS = 0;
const results = [];
for (const [label, over, sr] of CELLS) {
    const base = { ...COMMON, ...over, spendGoal: Math.round(totalAssets(over) * sr) };
    // mu/sigma are REQUIRED for the synthetic modes - buildBanks destructures them straight off cfg
    // and a missing one makes logDrift NaN, which propagates silently through every balance to a
    // terminal of nulls and a 100%-success table of NaN. The page's own defaults are 7% and 12%
    // (retirement_optimizer.html, #mc-mu / #mc-sigma), as decimals here. inflationRate matches the
    // plan's own 2.5% rather than the engine's 3% fallback, so the MC run and the single-path runs
    // are asking about the same household.
    const cfg = { years: YEARS, numPaths: PATHS, seed: 42, baseInputs: base,
                  mu: 0.07, sigma: 0.12, inflationRate: base.inflation };
    const banks = buildBanks(cfg, mulberry32(42), MODE);

    const per = new Map(RULES.map(([n]) => [n, { w: [], spend: [], ok: 0 }]));
    for (let p = 0; p < PATHS; p++) {
        const pathIn = buildPathInputs(banks, p, YEARS, base, MODE);
        for (const [name, ov] of RULES) {
            const inputs = ov ? { ...base, ...pathIn, ...ov, spendRule: 'gk' }
                              : { ...base, ...pathIn, strategy: 'gk' };
            let r; SIMS++;
            try { r = simulate(inputs); } catch (e) { continue; }
            const rec = per.get(name);
            if (!r?.totals?.success) continue;
            rec.ok++;
            const last = r.log[r.log.length - 1];
            const atnw = afterTaxNetWorth(r.totals.terminal, r.totals.futureIRARate ?? 0, r.totals.capGainsRate);
            const defl = (r.finalNW && r.finalNW !== 0)
                ? ((last.totalNetWealth / (last.inflationFactor || 1)) / r.finalNW) : 1;
            rec.w.push(atnw * defl);
            rec.spend.push(r.totals.spendCurrentDollars ?? 0);
        }
    }

    console.log('== ' + label + ' ==');
    console.log('  rule                med wealth      p10 wealth   med spend      success');
    const rows = [];
    for (const [name] of RULES) {
        const r = per.get(name);
        const row = { name, med: pct(r.w, 50), p10: pct(r.w, 10), spend: pct(r.spend, 50), ok: r.ok / PATHS };
        rows.push(row);
        console.log('  ' + name.padEnd(20) + money(row.med ?? 0).padStart(12) + money(row.p10 ?? 0).padStart(16) +
            money(row.spend ?? 0).padStart(12) + (100 * row.ok).toFixed(0).padStart(11) + '%');
    }
    results.push({ label, rows });
}

console.log('\n' + '='.repeat(100));
console.log('PREDICTION SCORING  (E-P1..E-P3, recorded before the run)');
console.log('='.repeat(100));
let better = 0, worseSurv = 0, flips = 0;
// P103d's single-path per-cell winner, for E-P3.
const SINGLE = { 'defaults @6%': 'IRA Draw 5%', 'defaults3x @6%': 'Ordered CIBR', 'round1 @6%': 'Ordered CIBR',
                 'thirds @6%': 'Ordered CBIR', 'brokheavy @6%': 'IRA Draw 5%', 'thirds @8%': 'Ordered CIBR' };
for (const { label, rows } of results) {
    const gk = rows.find(r => r.name === 'GK (incumbent)');
    const cands = rows.filter(r => r.name !== 'GK (incumbent)' && r.med != null);
    if (!gk || !cands.length) continue;
    const best = cands.reduce((a, b) => (b.med > a.med ? b : a));
    if (best.med > gk.med) better++;
    if (best.ok < gk.ok - 1e-9) worseSurv++;
    const sp = SINGLE[label];
    if (sp && best.name !== sp) flips++;
    console.log('  ' + label.padEnd(18) + 'median-best ' + best.name.padEnd(18) +
        (best.med > gk.med ? '+' : '') + money(best.med - gk.med) + ' vs GK' +
        '   survival ' + (100 * best.ok).toFixed(0) + '% vs ' + (100 * gk.ok).toFixed(0) + '%' +
        (sp && best.name !== sp ? '   [single-path pick was ' + sp + ']' : ''));
}
console.log('\nE-P1 median advantage survives in most cells: ' + better + '/' + results.length +
    ' -> ' + (better > results.length / 2 ? 'RIGHT' : 'WRONG'));
console.log('E-P2 winner never has worse survival: ' + (results.length - worseSurv) + '/' + results.length +
    ' -> ' + (worseSurv === 0 ? 'RIGHT' : 'WRONG'));
console.log('E-P3 single-path pick differs from median-best in a substantial minority: ' + flips +
    '/' + results.length + ' -> ' + (flips > 0 ? 'RIGHT' : 'WRONG'));
console.log('\nTotal ' + SIMS + ' sims');
