'use strict';
/**
 * gk_drawrule_harness.js -- P103d. Which DRAW rule should run under a Guyton-Klinger spend rule?
 *
 * Run:  node .test_harnesses/gk_drawrule_harness.js
 *       node .test_harnesses/gk_drawrule_harness.js --all      (every spend rate, not just 6/8%)
 *
 * WHY THIS CELL SET AND THIS QUESTION. P103d's regime map was derived on the only fully-controlled
 * grid (--reserve0 --spendchange -1, zero negative gaps): of the 17 cells with a gap at or above 5%,
 * THIRTEEN are at 8% spend and THIRTEEN have Guyton-Klinger as the best available family. So the
 * money is in high-spend plans where GK wins, and the actionable question is not "which family beats
 * GK" - GK is already winning those cells - but "GK decides the SPEND well; does it also decide the
 * DRAW well, or is its account split leaving money on the table?"
 *
 * P103b5 already showed it is: carrying GK's spend RULE and letting a schedule take the draw beat GK
 * on BOTH axes in 10 of 12 cells. That used a schedule, which is research-only. This asks the
 * shippable version of the same question, using `spendRule: 'gk'` to run GK's spend adjustment under
 * each SHIPPED family in turn. A winner here can ship as a marked sweep arm; a schedule cannot.
 *
 * THE COMPARISON. Incumbent is `strategy: 'gk'` - GK deciding both. Each candidate is
 * `strategy: X, spendRule: 'gk'` - GK deciding spend, X deciding the draw. Same cell, same fixtures,
 * and both fixtures are the controlled ones (CashReserve 0, spend -1%/yr real), because P103b5c
 * showed correcting them one at a time moves the confound rather than removing it.
 *
 * DOMINANCE, not a scalar score. A candidate WINS a cell only if it delivers no less lifetime spend
 * AND ends with more real terminal wealth, both plans funded. Scalarising with SPENDABLE_WEIGHT was
 * measured in P103b5a and cannot rank a real trade-off: at 1.10 it sits below the model's own 1.4-3.3
 * exchange rate, so it would simply prefer whichever candidate spent least.
 *
 * ── PREDICTIONS UNDER TEST, recorded BEFORE the numbers were looked at ───────────────────────
 *   G-P1. At least one shipped draw rule dominates GK's own draw in a MAJORITY of these cells. If
 *         no rule does, GK's split is already fine and P103d has nothing to ship.
 *   G-P2. No single rule wins everywhere - different mixes want different draws, which is the
 *         standing result of this whole line of work and the reason winners must ship regime-gated
 *         rather than as a new default.
 *   G-P3. Rules that reach Brokerage before the IRA win more often than IRA-first ones at these
 *         spend rates, because GK's guardrails already cut spending when the portfolio falls and
 *         §1014 makes held brokerage cheap to heirs, so draining it early is the mistake.
 * Scored at the end of the run.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
Object.assign(globalThis, require('../taxengine.js'));
const core = require('../optimizer_core.js');
const { simulate, afterTaxNetWorth, ORDERED_SEQS } = core;

const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString();
const ALL = process.argv.includes('--all');

// Both fixtures controlled, per P103b5c: CashReserve 0 holds surplus routing constant across arms,
// and spendChange -1% is a realistic real spend path rather than the flat one nobody chose.
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
const RATES = ALL ? [0.04, 0.06, 0.08] : [0.06, 0.08];
const BASIS = [null, 0.2, 0.8];
const totalAssets = o => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;

// The candidates are SHIPPED families, so a winner can become a marked sweep arm. `first` records
// which account each rule reaches first, for G-P3.
const CANDIDATES = [
    ['Proportional',      { strategy: 'propwd', propWithdraw: 0 },              'IRA'],
    ['Proportional +10%', { strategy: 'propwd', propWithdraw: 0.10 },           'IRA'],
    ['IRA Draw 5%',       { strategy: 'fixedpct', iraWithdrawPct: 0.05 },       'IRA'],
    ['IRA Draw 9%',       { strategy: 'fixedpct', iraWithdrawPct: 0.09 },       'IRA'],
    ['Fill Bracket 22%',  { strategy: 'bracket', stratRate: 0.22 },             'IRA'],
    ['Fill Bracket 24%',  { strategy: 'bracket', stratRate: 0.24 },             'IRA'],
    ...ORDERED_SEQS.map(seq => ['Ordered ' + seq, { strategy: 'ordered', orderedSeq: seq }, seq[0]]),
];
const FIRST_ACCT = { C: 'Cash', B: 'Brokerage', I: 'IRA', R: 'Roth' };

let SIMS = 0;
const run = i => { SIMS++; return simulate(i); };

function score(res, rate) {
    if (!res?.totals?.success) return null;
    const last = res.log[res.log.length - 1];
    const atnw = afterTaxNetWorth(res.totals.terminal, rate, res.totals.capGainsRate);
    const defl = (res.finalNW && res.finalNW !== 0)
        ? ((last.totalWealth / (last.inflationFactor || 1)) / res.finalNW) : 1;
    return { w: atnw * defl, spend: res.totals.spendCurrentDollars ?? 0 };
}

console.log('P103d  which DRAW rule belongs under a Guyton-Klinger SPEND rule?');
console.log('Incumbent: strategy gk (GK decides both). Candidates: strategy X + spendRule gk.');
console.log('Fixtures CONTROLLED: CashReserve 0, spend -1%/yr real. A candidate WINS a cell only by');
console.log('delivering no less lifetime spend AND more real terminal wealth.\n');

const cells = [];
for (const [mix, over0] of MIXES) for (const b of BASIS) for (const sr of RATES) {
    const over = { ...over0 };
    if (b != null) over.BrokerageBasis = Math.round(over.Brokerage * b);
    const label = mix + ' @' + (sr * 100) + '%' + (b != null ? ' b' + (b * 100) : '');
    cells.push({ label, base: { ...COMMON, ...over, spendGoal: Math.round(totalAssets(over) * sr) } });
}

const wins = new Map(CANDIDATES.map(([n]) => [n, 0]));
const totalGain = new Map(CANDIDATES.map(([n]) => [n, 0]));
const perCellWinner = [];
let scored = 0;

console.log('cell                   GK wealth        best candidate            wealth gain   spend gain');
for (const cell of cells) {
    const gk = run({ ...cell.base, strategy: 'gk' });
    const rate = gk?.totals?.futureIRARate ?? 0;
    const g = score(gk, rate);
    if (!g) { console.log(cell.label.padEnd(22) + ' GK infeasible, cell skipped'); continue; }
    scored++;
    let best = null;
    for (const [name, ov, first] of CANDIDATES) {
        let r; try { r = run({ ...cell.base, ...ov, spendRule: 'gk' }); } catch (e) { continue; }
        const s = score(r, rate);
        if (!s) continue;
        const dSpend = s.spend - g.spend, dW = s.w - g.w;
        if (dSpend > -100 && dW > 1) {
            wins.set(name, wins.get(name) + 1);
            totalGain.set(name, totalGain.get(name) + dW);
            if (!best || dW > best.dW) best = { name, dW, dSpend, first };
        }
    }
    perCellWinner.push({ cell: cell.label, best });
    console.log(cell.label.padEnd(22) + money(g.w).padStart(13) + '   ' +
        (best ? best.name.padEnd(24) + money(best.dW).padStart(12) + money(best.dSpend).padStart(13)
              : '(none dominates)'));
}

console.log('\n' + '='.repeat(100));
console.log('PREDICTION SCORING  (G-P1..G-P3, recorded before the run)');
console.log('='.repeat(100));
const ranked = [...wins.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
console.log('cells scored: ' + scored);
console.log('\nrule                     cells won   total wealth gain');
for (const [n, c] of ranked) console.log('  ' + n.padEnd(24) + String(c).padStart(6) + money(totalGain.get(n)).padStart(20));
const top = ranked[0];
const majority = top && top[1] > scored / 2;
console.log('\nG-P1 a rule dominates GK in a MAJORITY of cells: ' +
    (top ? top[0] + ' wins ' + top[1] + '/' + scored : 'none') + ' -> ' + (majority ? 'RIGHT' : 'WRONG'));
const distinct = new Set(perCellWinner.filter(p => p.best).map(p => p.best.name));
console.log('G-P2 no single rule wins everywhere: ' + distinct.size + ' distinct per-cell winners -> ' +
    (distinct.size > 1 ? 'RIGHT' : 'WRONG'));
let brokFirst = 0, iraFirst = 0;
for (const p of perCellWinner) {
    if (!p.best) continue;
    const f = FIRST_ACCT[p.best.first] || p.best.first;
    if (f === 'Brokerage' || f === 'Cash') brokFirst++; else if (f === 'IRA') iraFirst++;
}
console.log('G-P3 non-IRA-first rules win more often: cash/brokerage-first ' + brokFirst +
    ' vs IRA-first ' + iraFirst + ' -> ' + (brokFirst > iraFirst ? 'RIGHT' : 'WRONG'));
console.log('\nA winner here is SHIPPABLE - these are all existing families, so it becomes a marked,');
console.log('regime-gated sweep arm rather than a silent default. One deterministic path; P103e is');
console.log('where a survivor gets scored under many.');
console.log('\nTotal ' + SIMS + ' sims');
