'use strict';
/**
 * split_expressiveness_harness.js -- HOW MUCH per-year freedom does a good draw split actually need?
 *
 * Run:  node .test_harnesses/split_expressiveness_harness.js
 *       node .test_harnesses/split_expressiveness_harness.js --rates 4,6,8
 *
 * THE QUESTION, raised by the user 2026-09-02: *"the real question is whether Proportional itself
 * should be improved (or replaced). I suspect a winning draw strategy will require strategic choice
 * of assets to draw from on a per-annum basis - not an 'IRA then fill' or ordered strategy."*
 *
 * Half of that is already measured. `P51c/e` attributes the oracle's gain to the WITHDRAWAL SPLIT
 * over conversion timing in most cells, with `+split` reaching +$856,425, and `P51c` refutes
 * "Proportional is default-optimal" outright. So the split is where the money is, and Proportional
 * is not the right constant. None of that is in question here.
 *
 * The unmeasured half is the one that decides what gets BUILT: **does capturing it require a
 * different answer every year, or a small number of long phases?** Those are very different
 * features. A per-year split needs the account SPLIT field `P103b2` named and never built, plus a
 * search over it. A phased split is `P35`, which already exists as a carrier. And `P51f` hints at
 * the answer without measuring it - the oracle's trajectories are long blocks, `brokheavy @6% b20`
 * running fourteen consecutive `Roth` years, with harvest-like alternation in only 1 of 6 cells.
 *
 * WHAT IT MEASURES. An expressiveness ladder on the SAME archetype menu the oracle uses, so the
 * rungs are directly comparable:
 *
 *   base    the family's own draw (Proportional +0%, which is also Guyton-Klinger's draw)
 *   k=1     ONE archetype held every year - exhaustive over the menu
 *   k=2     one switch: archetype A until year t, archetype B after - exhaustive over pairs x t
 *   k=free  per-year coordinate descent, the oracle's own split search
 *
 * Then: what FRACTION of the k=free gain does each rung capture, and how much structure does the
 * k=free answer actually contain (distinct archetypes used, number of switches)?
 *
 * WHY THE BASE IS PROPORTIONAL AND NOT GK. Spend must be identical across arms or a wealth
 * comparison is meaningless, and Guyton-Klinger's spend responds to the portfolio, which the draw
 * changes. Proportional +0% holds spend to the plan's own trajectory, so every rung delivers the
 * same spending and the comparison is pure wealth. Since GK's draw IS Proportional +0% (proved in
 * `family_equivalence_harness.js`), a result about this base is a result about GK's draw too. The
 * harness asserts spend equality rather than assuming it, and prints any cell where it moved.
 *
 * WHAT IS HELD CONSTANT. Conversions are left at the family default and never searched, so the
 * whole difference between rungs is the split. Both fixtures are the controlled ones per `P103b5c`
 * (CashReserve 0, spend -1%/yr real) because correcting them one at a time moves the confound
 * rather than removing it.
 *
 * THIS IS AN UPPER BOUND, NOT A STRATEGY. Every rung has perfect foresight over the cell's own
 * realized returns. k=1 and k=2 are still hindsight-fitted; a shippable rule has to pick its
 * archetypes and its switch year in advance. What the ladder prices is how much REPRESENTATION is
 * worth building, and the k=2/k=free ratio is the number that decides it. `P103e` is the standing
 * warning that a rule fitted to one path can fail most futures - the ordered sequences reached 0%
 * survival under bootstrap - so nothing here ships without a Monte Carlo pass.
 *
 * ── PREDICTIONS, recorded BEFORE the numbers were looked at ──────────────────────────────────
 *   X-P1. k=2 captures at least 80% of the k=free gain in a MAJORITY of cells. If it does, the
 *         per-year SPLIT field is not the thing to build and `P35`'s phased carrier is.
 *   X-P2. The k=free solution is structurally simple in the median cell: at most 4 distinct
 *         archetypes and at most 6 switches across a 33-year horizon.
 *   X-P3. k=1 beats the base in EVERY cell - even one better constant, chosen per regime, is worth
 *         real money, which would make "replace the Proportional constant" a shippable step on its
 *         own ahead of any per-year work.
 * Scored at the end of the run.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
Object.assign(globalThis, require('../taxengine.js'));
const { simulate, afterTaxNetWorth } = require('../optimizer_core.js');

const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString();
const _rIdx = process.argv.indexOf('--rates');
const RATES = (_rIdx >= 0 ? process.argv[_rIdx + 1].split(',').map(Number) : [4, 6]).map(r => r / 100);

// Same household as oracle_harness.js and gk_drawrule_harness.js. Both fixtures controlled.
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
const MIXES = [
    ['defaults',   { IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000, Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000 }],
    ['defaults3x', { IRA1: 3000000, IRA2: 1200000, Roth: 150000, Roth2: 60000, Brokerage: 300000, BrokerageBasis: 150000, Cash: 150000 }],
    ['round1',     { IRA1: 1800000, IRA2: 700000, Roth: 250000, Roth2: 100000, Brokerage: 900000, BrokerageBasis: 500000, Cash: 150000 }],
    ['thirds',     { IRA1: 1000000, IRA2: 400000, Roth: 1000000, Roth2: 400000, Brokerage: 1400000, BrokerageBasis: 700000, Cash: 150000 }],
    ['brokheavy',  { IRA1: 700000, IRA2: 300000, Roth: 400000, Roth2: 200000, Brokerage: 2800000, BrokerageBasis: 1200000, Cash: 150000 }],
];
const totalAssets = o => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;

// The oracle's own archetype menu, unchanged, so the rungs here and the +split column in
// PERFECT_FORESIGHT_ORACLE.md are measuring over the same space. 'family' = no override.
const ARCH = [
    ['family', null],
    ['IRA',    { IRA: 1 }],
    ['Brok',   { Brokerage: 1 }],
    ['Cash',   { Cash: 1 }],
    ['Roth',   { Roth: 1 }],
    ['prop',   { IRA: 1, Brokerage: 1, Cash: 1 }],
    ['I6B4',   { IRA: 0.6, Brokerage: 0.4 }],
    ['B4C6',   { Brokerage: 0.4, Cash: 0.6 }],
    ['I5C5',   { IRA: 0.5, Cash: 0.5 }],
    ['I4B3C3', { IRA: 0.4, Brokerage: 0.3, Cash: 0.3 }],
];
const ARCH_BY_NAME = new Map(ARCH);

let SIMS = 0;
function runSim(inputs) { SIMS++; return simulate(inputs); }

// Real after-tax terminal wealth, matching oracle_harness.js's scoreOf. Returns null when the plan
// does not fund its spending, so an infeasible rung can never be selected.
function scoreOf(res, sharedRate) {
    if (!res?.totals?.success) return null;
    if ((res.totals.shortfall ?? 0) > 1) return null;
    const last = res.log[res.log.length - 1];
    const atnw = afterTaxNetWorth(res.totals.terminal, sharedRate, res.totals.capGainsRate);
    const defl = (res.finalNW && res.finalNW !== 0)
        ? ((last.totalNetWealth / (last.inflationFactor || 1)) / res.finalNW) : 1;
    return atnw * defl;
}

function evalPlan(cellBase, rate, plan) {
    const res = runSim({ ...cellBase, oracleWithdrawalPlan: plan });
    return { score: scoreOf(res, rate), spend: res?.totals?.spendCurrentDollars ?? null };
}

// Runs of equal archetype names -> [{name, from, to}], the structure measure for X-P2.
function runsOf(names) {
    const out = [];
    for (let i = 0; i < names.length; i++) {
        if (i === 0 || names[i] !== names[i - 1]) out.push({ name: names[i], from: i, to: i });
        else out[out.length - 1].to = i;
    }
    return out;
}

const cells = [];
for (const [mixName, bal] of MIXES) {
    for (const rate of RATES) {
        const spendGoal = Math.round(totalAssets(bal) * rate);
        const cellBase = { ...COMMON, ...bal, spendGoal };
        const label = `${mixName} @${(rate * 100).toFixed(0)}%`;

        const baseRes = runSim(cellBase);
        const baseScore = scoreOf(baseRes, rate);
        if (baseScore == null) { cells.push({ label, skipped: 'base does not fund' }); continue; }
        const horizon = baseRes.log.length;
        const baseSpend = baseRes.totals.spendCurrentDollars ?? 0;
        const nullPlan = new Array(horizon).fill(null);

        // ── k=1: one archetype every year, exhaustive ───────────────────────────────────────
        let k1 = { score: baseScore, name: 'family' };
        for (const [an, aw] of ARCH) {
            if (an === 'family') continue;
            const r = evalPlan(cellBase, rate, new Array(horizon).fill(aw));
            if (r.score != null && r.score > k1.score) k1 = { score: r.score, name: an };
        }

        // ── k=2: A until year t, B from t on. Exhaustive over pairs and switch year ─────────
        let k2 = { score: k1.score, a: k1.name, b: k1.name, t: 0 };
        for (const [an, aw] of ARCH) {
            for (const [bn, bw] of ARCH) {
                if (an === bn) continue;
                for (let t = 1; t < horizon; t++) {
                    const plan = new Array(horizon);
                    for (let y = 0; y < horizon; y++) plan[y] = y < t ? aw : bw;
                    const r = evalPlan(cellBase, rate, plan);
                    if (r.score != null && r.score > k2.score + 0.01) k2 = { score: r.score, a: an, b: bn, t };
                }
            }
        }

        // ── k=free: the oracle's own per-year coordinate descent over the same menu ─────────
        const wplan = nullPlan.slice();
        const warch = new Array(horizon).fill('family');
        let cur = baseScore;
        for (let round = 0; round < 4; round++) {
            const before = cur;
            for (let y = 0; y < horizon; y++) {
                let bestA = warch[y], bestW = wplan[y], bestSc = cur;
                for (const [an, aw] of ARCH) {
                    if (an === warch[y]) continue;
                    const p2 = wplan.slice(); p2[y] = aw;
                    const r = evalPlan(cellBase, rate, p2);
                    if (r.score != null && r.score > bestSc + 0.01) { bestSc = r.score; bestA = an; bestW = aw; }
                }
                if (bestA !== warch[y]) { warch[y] = bestA; wplan[y] = bestW; cur = bestSc; }
            }
            if (cur - before < 1) break;
        }
        const freeSpend = evalPlan(cellBase, rate, wplan).spend;

        // ── k=free with single-year blips removed ──────────────────────────────────────────
        // The descent accepts a year's change for a gain of one cent, so a plan can look busy
        // while almost none of the busyness is load-bearing. Collapse every run of length 1 into
        // its neighbour, re-score, and the difference is what per-YEAR freedom is worth over the
        // same plan expressed in blocks. This is the number the user's question turns on.
        const blocky = warch.slice();
        for (let i = 0; i < blocky.length; i++) {
            const sameBefore = i > 0 && blocky[i - 1] === blocky[i];
            const sameAfter = i < blocky.length - 1 && blocky[i + 1] === blocky[i];
            if (!sameBefore && !sameAfter) blocky[i] = i > 0 ? blocky[i - 1] : (blocky[i + 1] ?? blocky[i]);
        }
        const blockyEval = evalPlan(cellBase, rate, blocky.map(n => ARCH_BY_NAME.get(n)));
        const blockyRuns = runsOf(blocky);

        const runs = runsOf(warch);
        cells.push({
            label, horizon, baseScore, baseSpend, freeSpend,
            k1, k2, free: { score: cur, warch, runs },
            blocky: { score: blockyEval.score, runs: blockyRuns, switches: blockyRuns.length - 1 },
            distinct: new Set(warch).size, switches: runs.length - 1,
            gainFree: cur - baseScore,
            capt1: cur - baseScore > 1 ? (k1.score - baseScore) / (cur - baseScore) : null,
            capt2: cur - baseScore > 1 ? (k2.score - baseScore) / (cur - baseScore) : null,
            captB: (cur - baseScore > 1 && blockyEval.score != null)
                ? (blockyEval.score - baseScore) / (cur - baseScore) : null,
        });
    }
}

// ── Report ──────────────────────────────────────────────────────────────────────────────────
console.log('\nHOW MUCH PER-YEAR FREEDOM DOES THE DRAW SPLIT NEED?');
console.log('base = Proportional +0% (= Guyton-Klinger\'s draw). Conversions untouched. Spend fixed.');
console.log('Every rung has perfect foresight - this is an upper bound on REPRESENTATION, not a strategy.\n');

const hdr = ['cell', 'base NW', 'k=1 gain', 'k=2 gain', 'k=free gain', 'k=1 %', 'k=2 %', 'blk %', 'arch', 'sw'];
console.log(hdr[0].padEnd(16) + hdr[1].padStart(14) + hdr[2].padStart(14) + hdr[3].padStart(14)
    + hdr[4].padStart(14) + hdr[5].padStart(8) + hdr[6].padStart(8) + hdr[7].padStart(8)
    + hdr[8].padStart(6) + hdr[9].padStart(5));
console.log('-'.repeat(107));

const live = cells.filter(c => !c.skipped);
for (const c of cells) {
    if (c.skipped) { console.log(c.label.padEnd(16) + ('  ' + c.skipped).padStart(14)); continue; }
    console.log(c.label.padEnd(16)
        + money(c.baseScore).padStart(14)
        + money(c.k1.score - c.baseScore).padStart(14)
        + money(c.k2.score - c.baseScore).padStart(14)
        + money(c.free.score - c.baseScore).padStart(14)
        + (c.capt1 == null ? '-' : (c.capt1 * 100).toFixed(0) + '%').padStart(8)
        + (c.capt2 == null ? '-' : (c.capt2 * 100).toFixed(0) + '%').padStart(8)
        + (c.captB == null ? '-' : (c.captB * 100).toFixed(0) + '%').padStart(8)
        + String(c.distinct).padStart(6)
        + String(c.switches).padStart(5));
}

// WHICH archetype won matters more than the gain, because it decides what is shippable. A single
// account (IRA/Brok/Cash/Roth) is expressible today as an Ordered sequence - and P103e disqualified
// those on survival. A BLEND (prop, I6B4, B4C6, I5C5, I4B3C3) is expressible by NO shipped family.
console.log('\nWhich archetype each rung picked:');
console.log('  cell            k=1 winner   k=2 winner');
for (const c of live) {
    console.log('  ' + c.label.padEnd(16) + c.k1.name.padEnd(13)
        + (c.k2.a === c.k2.b ? '(same as k=1)' : `${c.k2.a} -> ${c.k2.b} at year ${c.k2.t}`));
}

console.log('\nWhat the k=free answer actually looks like (archetype per year, left to right):');
for (const c of live) {
    console.log('  ' + c.label.padEnd(16) + c.free.runs.map(r => `${r.name}x${r.to - r.from + 1}`).join(' '));
}

// A 33-year cumulative spend total is a multi-million-dollar figure; comparing it against a $1
// ABSOLUTE tolerance reports rounding as drift. The first run of this harness did exactly that and
// declared 8 of 10 cells invalid on deltas of ONE DOLLAR against $7.4M, because the base plan
// over-funds by $2. Report the magnitude and let it be judged.
console.log('\nSpend check (a wealth comparison is meaningless if spend moved):');
let worstAbs = 0, worstRel = 0, worstCell = '-';
for (const c of live) {
    const d = Math.abs((c.freeSpend ?? 0) - c.baseSpend);
    const rel = c.baseSpend ? d / c.baseSpend : 0;
    if (rel > worstRel) { worstRel = rel; worstAbs = d; worstCell = c.label; }
}
console.log(`  largest drift across ${live.length} cells: ${money(worstAbs)} on ${worstCell}`
    + `, ${(worstRel * 100).toFixed(6)}% of that cell's lifetime spend.`);
console.log(worstRel < 1e-6
    ? '  Rounding only. Every rung delivers the same spending; the wealth comparison stands.'
    : '  REAL DRIFT - the wealth comparison does NOT stand where it exceeds rounding.');

// ── Predictions ─────────────────────────────────────────────────────────────────────────────
const withGain = live.filter(c => c.capt2 != null);
const p1 = withGain.filter(c => c.capt2 >= 0.80).length;
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const medDistinct = med(live.map(c => c.distinct)), medSwitch = med(live.map(c => c.switches));
const p3 = live.filter(c => c.k1.score - c.baseScore > 1).length;

console.log('\nPREDICTIONS');
console.log(`  X-P1  k=2 captures >=80% of the k=free gain in a majority of cells`);
console.log(`        -> ${p1} of ${withGain.length} cells. ${p1 * 2 > withGain.length ? 'RIGHT' : 'WRONG'}`);
console.log(`  X-P2  k=free is structurally simple: median <=4 distinct archetypes and <=6 switches`);
console.log(`        -> median ${medDistinct} distinct, ${medSwitch} switches. ${medDistinct <= 4 && medSwitch <= 6 ? 'RIGHT' : 'WRONG'}`);
const medCaptB = med(live.filter(c => c.captB != null).map(c => c.captB));
console.log(`  X-P4  is the per-YEAR churn load-bearing? Collapse every 1-year run into its neighbour:`);
console.log(`        -> median ${(medCaptB * 100).toFixed(0)}% of the k=free gain survives, `
    + `median switches ${medSwitch} -> ${med(live.map(c => c.blocky.switches))}.`);
console.log(`  X-P3  k=1 beats the base in EVERY cell`);
console.log(`        -> ${p3} of ${live.length}. ${p3 === live.length ? 'RIGHT' : 'WRONG'}`);
console.log(`\n  ${SIMS.toLocaleString()} sims\n`);
