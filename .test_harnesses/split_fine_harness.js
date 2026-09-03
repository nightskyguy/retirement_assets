'use strict';
/**
 * split_fine_harness.js -- P104b2 (ii). Was the 10-archetype menu close enough?
 *
 * Run:  node .test_harnesses/split_fine_harness.js
 *       node .test_harnesses/split_fine_harness.js --rates 4,6,8
 *       node .test_harnesses/split_fine_harness.js --basis 20,50,80
 *       node .test_harnesses/split_fine_harness.js --step 20        (coarser simplex, for a smoke run)
 *
 * THE QUESTION. `P104a` measured the expressiveness ladder over the oracle's own ten-archetype
 * MENU and found that one better CONSTANT beats Proportional in 8 of 10 cells. That menu was never
 * chosen as a grid - it is the oracle's hand-written list. So two things are still unknown, and
 * `P104b3` cannot pick which vectors to ship without them:
 *
 *   1. How much is the menu leaving on the table against an exhaustive constant search?
 *   2. Does the answer move with BASIS? `P104a` ran one basis (50% of Brokerage) and the split's
 *      whole cost is basis: a brokerage-weighted vector realizes gain when it draws.
 *
 * WHAT IT MEASURES. Per cell, the best CONSTANT account-weight vector, three ways:
 *
 *   base    Proportional +0%, which is also Guyton-Klinger's draw
 *   menu    the oracle's ten archetypes, exactly as `P104a` used them
 *   fine    every vector on the 3-simplex at `--step`% increments (286 vectors at 10%)
 *
 * The menu is almost a SUBSET of the fine grid - eight of its ten entries land on 10% gridpoints -
 * so those eight are read out of the same simulate() results rather than re-run. Only `prop`
 * (equal thirds, off any 10% grid) and `family` (no override, which IS the base) cost extra sims.
 * That makes menu-vs-fine an exact within-run comparison and not a comparison of two runs.
 *
 * IT RUNS THE SHIPPED FAMILY, not the oracle input. `P104b1` proved `strategy: 'split'` with
 * vector V replays `propwd 0 + oracleWithdrawalPlan.fill(V)` to the dollar, so this measures the
 * thing that would actually ship. A vector here is `[IRA, Brokerage, Cash, Roth]` RELATIVE weights;
 * `calculateWithdrawals` normalizes. Note `[0,0,1,0]` is NOT an all-cash draw - phase 2 walks the
 * order for whatever the weighted phase left unfunded - which is the whole reason `V-P1` exists.
 *
 * ENGINE NOTE, and it is not a footnote. This runs on v11.1718, which includes `P105` (a survivor's
 * RMD basis now includes the IRA they inherited). Every fixture below has a death inside the plan,
 * and `P105` moves 20 of 30 arm-cells DOWNWARD by up to $110,611 - ARM-DEPENDENTLY, so within-cell
 * gaps move by up to ~$32k. Spend is unchanged to the dollar. Therefore: the `k=1` numbers this
 * harness prints SUPERSEDE `P104a`'s `k=1` column, and they must NOT be compared against `P104a`'s
 * `k=2` or `k=free` columns, which were measured before `P105`. Anything wanting that ladder again
 * has to re-run `split_expressiveness_harness.js`.
 *
 * THIS IS PERFECT FORESIGHT. Every arm is scored on the cell's own realized return path, so the
 * best vector here is fitted to one future. `P103e` is the standing proof that a single-path winner
 * can reach 0% survival out of sample. Nothing here selects a shipping grid: that is `P104b2` (iii),
 * the Monte Carlo pass, and this harness only narrows what it has to test.
 *
 * ── PREDICTIONS, recorded BEFORE the numbers were looked at ──────────────────────────────────
 *   F-P1 (the plan's `V-P2`). The fine grid beats the menu in most cells, but by LESS THAN 10% of
 *        the menu's own gain over base. If right, the menu was close enough and `P104b3` can ship
 *        vectors chosen off it; if wrong by a lot, the grid has to come from the simplex.
 *   F-P2. The fine winner is a BLEND - two or more non-zero accounts - in most cells. `P104a` found
 *        blends winning 7 of 10 on the menu, and no shipped family can express one.
 *   F-P3. Basis moves the SIZE and not the identity: the winning vector's Brokerage share is
 *        non-decreasing from b20 to b80 in most mixes (a higher basis means a cheaper brokerage
 *        draw), while the winner's dominant account stays the same.
 *   F-P4. No single vector wins a majority of the 30 cells. This is `G-P1`'s failure mode from
 *        `P103d`: the replacement for a default is regime-dependent, not absent.
 * Scored at the end of the run.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
Object.assign(globalThis, require('../taxengine.js'));
const core = require('../optimizer_core.js');
const { simulate, afterTaxNetWorth } = core;

const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString();
const argv = process.argv.slice(2);
const argOf = (flag, dflt) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : dflt;
};
const RATES = String(argOf('--rates', '4,6')).split(',').map(Number).map(r => r / 100);
const BASES = String(argOf('--basis', '20,50,80')).split(',').map(Number).map(b => b / 100);
const STEP  = Number(argOf('--step', '10'));
if (!(STEP > 0 && STEP <= 50 && 100 % STEP === 0)) throw new Error('--step must divide 100 and be <= 50');

// Same household as split_expressiveness_harness.js, so the cells are the P104a cells.
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
// Brokerage basis is applied as a FRACTION of Brokerage per arm, so b20/b50/b80 are the same
// household with a different embedded gain rather than three different households.
const MIXES = [
    ['defaults',   { IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000, Brokerage: 100000, Cash: 50000 }],
    ['defaults3x', { IRA1: 3000000, IRA2: 1200000, Roth: 150000, Roth2: 60000, Brokerage: 300000, Cash: 150000 }],
    ['round1',     { IRA1: 1800000, IRA2: 700000, Roth: 250000, Roth2: 100000, Brokerage: 900000, Cash: 150000 }],
    ['thirds',     { IRA1: 1000000, IRA2: 400000, Roth: 1000000, Roth2: 400000, Brokerage: 1400000, Cash: 150000 }],
    ['brokheavy',  { IRA1: 700000, IRA2: 300000, Roth: 400000, Roth2: 200000, Brokerage: 2800000, Cash: 150000 }],
];
const totalAssets = o => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;

// The oracle's menu, as [IRA, Brokerage, Cash, Roth]. `family` is the base (no override).
const MENU = [
    ['IRA',    [1, 0, 0, 0]],
    ['Brok',   [0, 1, 0, 0]],
    ['Cash',   [0, 0, 1, 0]],
    ['Roth',   [0, 0, 0, 1]],
    ['prop',   [1, 1, 1, 0]],
    ['I6B4',   [0.6, 0.4, 0, 0]],
    ['B4C6',   [0, 0.4, 0.6, 0]],
    ['I5C5',   [0.5, 0, 0.5, 0]],
    ['I4B3C3', [0.4, 0.3, 0.3, 0]],
];

// The 3-simplex at STEP% increments, as integer tenths so a key is exact and never a float compare.
function simplex(step) {
    const n = 100 / step, out = [];
    for (let i = 0; i <= n; i++)
        for (let j = 0; j + i <= n; j++)
            for (let k = 0; k + j + i <= n; k++)
                out.push([i, j, k, n - i - j - k]);
    return out;
}
const GRID = simplex(STEP);
const keyOf = v => {
    const s = v[0] + v[1] + v[2] + v[3];
    if (!(s > 0)) return null;
    const t = v.map(x => (x / s) * (100 / STEP));
    // On-grid only when every normalized coordinate is an integer number of steps.
    return t.every(x => Math.abs(x - Math.round(x)) < 1e-9) ? t.map(Math.round).join('-') : null;
};
const nameOf = v => {
    const L = ['I', 'B', 'C', 'R'], s = v[0] + v[1] + v[2] + v[3];
    const parts = v.map((x, i) => [L[i], Math.round((x / s) * 100)]).filter(([, p]) => p > 0);
    if (parts.length === 1) return { IRA: 'IRA', Brokerage: 'Brok', Cash: 'Cash', Roth: 'Roth' }[
        ['IRA', 'Brokerage', 'Cash', 'Roth'][v.findIndex(x => x > 0)]];
    return parts.map(([l, p]) => l + (p / 10)).join('');
};
const nonZero = v => v.filter(x => x > 0).length;

let SIMS = 0;
// Real after-tax terminal wealth, the same scoreOf oracle_harness.js and P104a use. null when the
// plan does not fund its spending, so an infeasible vector can never be selected.
function scoreOf(res, sharedRate) {
    if (!res?.totals?.success) return null;
    if ((res.totals.shortfall ?? 0) > 1) return null;
    const last = res.log[res.log.length - 1];
    const atnw = afterTaxNetWorth(res.totals.terminal, sharedRate, res.totals.capGainsRate);
    const defl = (res.finalNW && res.finalNW !== 0)
        ? ((last.totalWealth / (last.inflationFactor || 1)) / res.finalNW) : 1;
    return atnw * defl;
}
function run(base, rate, weights) {
    SIMS++;
    const res = simulate(weights ? { ...base, strategy: 'split', splitWeights: weights } : base);
    return { score: scoreOf(res, rate), spend: res?.totals?.spendCurrentDollars ?? null,
             invalid: !!res?.totals?.splitWeightsInvalid };
}

const cells = [];
for (const [mixName, bal] of MIXES) {
    for (const basis of BASES) {
        for (const rate of RATES) {
            const bal2 = { ...bal, BrokerageBasis: Math.round(bal.Brokerage * basis) };
            const spendGoal = Math.round(totalAssets(bal) * rate);
            const cellBase = { ...COMMON, ...bal2, spendGoal };
            const label = `${mixName} @${(rate * 100).toFixed(0)}% b${(basis * 100).toFixed(0)}`;

            const b = run(cellBase, rate, null);
            if (b.score == null) { cells.push({ label, skipped: 'base does not fund' }); continue; }

            // Every gridpoint once. A malformed vector would be a harness bug, not a finding, so
            // the flag is asserted rather than reported.
            const byKey = new Map();
            let fine = null;
            for (const g of GRID) {
                if (!(g[0] + g[1] + g[2] + g[3] > 0)) continue;
                const r = run(cellBase, rate, g);
                if (r.invalid) throw new Error(`${label}: engine rejected vector ${g.join(',')}`);
                byKey.set(keyOf(g), { v: g, ...r });
                if (r.score != null && (!fine || r.score > fine.score)) fine = { v: g, ...r };
            }
            // The menu, read out of the same results where it lands on the grid.
            let menu = { score: b.score, name: 'family', v: null, spend: b.spend };
            const offGrid = [];
            for (const [name, v] of MENU) {
                const k = keyOf(v);
                const hit = k && byKey.get(k);
                const r = hit || run(cellBase, rate, v);
                if (!hit) offGrid.push(name);
                if (r.score != null && r.score > menu.score) menu = { score: r.score, name, v, spend: r.spend };
            }
            cells.push({
                label, mixName, basis, rate, offGrid,
                // key -> score for every gridpoint, kept so the GRID can be chosen ACROSS cells.
                // A per-cell argmax names one winner per cell and says nothing about what a user
                // gets whose household is not that cell; a shippable grid is 3 or 4 vectors, and
                // picking them needs each candidate's score in the cells it does NOT win.
                scores: new Map([...byKey].map(([k, r]) => [k, r.score])),
                baseScore: b.score, baseSpend: b.spend,
                menu, fine: { ...fine, name: nameOf(fine.v) },
                gainMenu: menu.score - b.score,
                gainFine: fine.score - b.score,
                headroom: (menu.score - b.score) > 1 ? (fine.score - menu.score) / (menu.score - b.score) : null,
            });
        }
    }
}

// ── Report ──────────────────────────────────────────────────────────────────────────────────
console.log('\nWAS THE TEN-ARCHETYPE MENU CLOSE ENOUGH?  ' + GRID.length + ' vectors at ' + STEP + '% steps.');
console.log('base = Proportional +0% (= Guyton-Klinger\'s draw), run as the shipped `split` family.');
console.log('Perfect foresight on one path per cell. An upper bound on a CONSTANT, not a strategy.\n');

const live = cells.filter(c => !c.skipped);
console.log('cell'.padEnd(22) + 'menu best'.padEnd(9) + 'menu gain'.padStart(14)
    + '  fine best'.padEnd(12) + 'fine gain'.padStart(14) + 'headroom'.padStart(10));
console.log('-'.repeat(83));
for (const c of cells) {
    if (c.skipped) { console.log(c.label.padEnd(22) + c.skipped); continue; }
    console.log(c.label.padEnd(22) + c.menu.name.padEnd(9) + money(c.gainMenu).padStart(14)
        + ('  ' + c.fine.name).padEnd(12) + money(c.gainFine).padStart(14)
        + (c.headroom == null ? '-' : (c.headroom * 100).toFixed(0) + '%').padStart(10));
}

// Spend must be identical across arms or a wealth comparison means nothing. P104a's first run
// declared 8 of 10 cells invalid on ONE DOLLAR of rounding against $7.4M, so report the magnitude.
console.log('\nSpend check (the base fixes spend by construction; the split must not move it):');
let worstRel = 0, worstAbs = 0, worstCell = '-';
for (const c of live) {
    for (const s of [c.menu.spend, c.fine.spend]) {
        const d = Math.abs((s ?? 0) - c.baseSpend);
        const rel = c.baseSpend ? d / c.baseSpend : 0;
        if (rel > worstRel) { worstRel = rel; worstAbs = d; worstCell = c.label; }
    }
}
console.log(`  largest drift across ${live.length} cells: ${money(worstAbs)} on ${worstCell}, `
    + (worstRel * 100).toFixed(6) + '% of that cell\'s lifetime spend.');
// BOTH a relative and an absolute floor. P104a's first run declared 8 of 10 cells invalid on ONE
// DOLLAR against $7.4M; a pure ratio test does the same thing one decimal place further down - $8
// on a $7.3M lifetime spend tripped 1e-6 here on the first smoke run. A drift is real when it is
// both a meaningful fraction AND more than pocket change.
console.log((worstRel < 1e-5 || worstAbs <= 100)
    ? '  Rounding only. Every arm delivers the same spending; the wealth comparison stands.'
    : '  REAL DRIFT - the wealth comparison does NOT stand where it exceeds rounding.');
if (live.length && live[0].offGrid.length)
    console.log('  menu entries needing their own sim (off the ' + STEP + '% grid): ' + live[0].offGrid.join(', '));

// ── Predictions ─────────────────────────────────────────────────────────────────────────────
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const withGain = live.filter(c => c.headroom != null);
const p1Beat = withGain.filter(c => c.gainFine > c.gainMenu + 1).length;
const p1Under = withGain.filter(c => c.headroom < 0.10).length;
const p2Blend = live.filter(c => nonZero(c.fine.v) >= 2).length;

console.log('\nPREDICTIONS');
console.log(`  F-P1  fine beats the menu in most cells, by under 10% of the menu's own gain`);
console.log(`        -> beats in ${p1Beat}/${withGain.length}; headroom under 10% in ${p1Under}/${withGain.length}`
    + `, median ${(med(withGain.map(c => c.headroom)) * 100).toFixed(1)}%. `
    + `${(p1Beat * 2 > withGain.length && p1Under * 2 > withGain.length) ? 'RIGHT' : 'WRONG'}`);
console.log(`  F-P2  the fine winner is a BLEND (2+ non-zero accounts) in most cells`);
console.log(`        -> ${p2Blend} of ${live.length}. ${p2Blend * 2 > live.length ? 'RIGHT' : 'WRONG'}`);

// F-P3: within a mix+rate, does the winner's Brokerage share rise with basis, and does its
// dominant account hold?
let p3Mono = 0, p3Same = 0, p3Tot = 0;
for (const [mixName] of MIXES) {
    for (const rate of RATES) {
        const byBasis = BASES.map(bs => live.find(c => c.mixName === mixName && c.basis === bs && c.rate === rate))
                             .filter(Boolean);
        if (byBasis.length < 2) continue;
        p3Tot++;
        const brok = byBasis.map(c => c.fine.v[1] / (c.fine.v[0] + c.fine.v[1] + c.fine.v[2] + c.fine.v[3]));
        if (brok.every((x, i) => i === 0 || x >= brok[i - 1] - 1e-9)) p3Mono++;
        const dom = byBasis.map(c => c.fine.v.indexOf(Math.max(...c.fine.v)));
        if (dom.every(d => d === dom[0])) p3Same++;
    }
}
console.log(`  F-P3  basis moves SIZE not identity: Brokerage share non-decreasing in basis,`);
console.log(`        dominant account unchanged -> monotone in ${p3Mono}/${p3Tot}, same dominant in `
    + `${p3Same}/${p3Tot}. ${(p3Mono * 2 > p3Tot && p3Same * 2 > p3Tot) ? 'RIGHT' : 'WRONG'}`);

const tally = new Map();
for (const c of live) tally.set(c.fine.name, (tally.get(c.fine.name) ?? 0) + 1);
const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
console.log(`  F-P4  no single vector wins a majority of the cells`);
console.log(`        -> ${ranked.length} distinct winners, top is ${ranked[0]?.[0]} at ${ranked[0]?.[1]}/${live.length}. `
    + `${(ranked[0]?.[1] ?? 0) * 2 <= live.length ? 'RIGHT' : 'WRONG'}`);
console.log('        full tally: ' + ranked.map(([n, k]) => `${n} ${k}`).join(', '));

// ── What `b3` actually has to decide: WHICH 3-4 VECTORS SHIP ────────────────────────────────
// CAPTURE is the number the grid decision turns on. For a candidate v in a cell:
// (score(v) - base) / (fineBest - base). 1.0 = as good as perfect per-cell hindsight, 0 = no
// better than the shipped default, NEGATIVE = worse than the default, which a shipped row must
// not be in many cells.
const keyToName = new Map(GRID.filter(g => g[0] + g[1] + g[2] + g[3] > 0).map(g => [keyOf(g), nameOf(g)]));
const captureOf = (c, k) => {
    const sc = c.scores.get(k);
    if (sc == null) return null;                 // infeasible here, so it cannot be credited
    const span = c.fine.score - c.baseScore;
    return span > 1 ? (sc - c.baseScore) / span : null;
};
// Only vectors FEASIBLE IN EVERY live cell are eligible. One that strands spending anywhere is not
// a row to offer, whatever it scores where it happens to work.
const eligible = [...keyToName.keys()].filter(k => live.every(c => captureOf(c, k) != null));
const meanCap = k => live.reduce((s, c) => s + captureOf(c, k), 0) / live.length;
const minCap  = k => Math.min(...live.map(c => captureOf(c, k)));
const bySingle = eligible.map(k => ({ k, name: keyToName.get(k), mean: meanCap(k), min: minCap(k) }))
                         .sort((a, b) => b.mean - a.mean);

console.log('\nBest SINGLE constant, if exactly one vector could replace the default:');
console.log('  vector'.padEnd(14) + 'mean capture'.padStart(14) + 'worst cell'.padStart(14));
for (const e of bySingle.slice(0, 8))
    console.log('  ' + e.name.padEnd(12) + ((e.mean * 100).toFixed(1) + '%').padStart(14)
        + ((e.min * 100).toFixed(1) + '%').padStart(14));
console.log('  ' + eligible.length + ' of ' + keyToName.size + ' vectors are feasible in every cell ('
    + (keyToName.size - eligible.length) + ' strand spending somewhere).');

// Greedy cover: add the vector that most improves the per-cell BEST of the chosen set. Stated as
// greedy because it is - not proven optimal, and it is a CANDIDATE GENERATOR for the Monte Carlo
// pass in (iii), which is what actually decides. Every number here has perfect foresight.
console.log('\nGreedy grid (each row adds the vector that most improves the per-cell best):');
const chosen = [];
let bestOf = live.map(() => -Infinity);
for (let n = 1; n <= 4 && chosen.length < eligible.length; n++) {
    let pick = null;
    for (const k of eligible) {
        const cand = live.map((c, i) => Math.max(bestOf[i], captureOf(c, k)));
        const mean = cand.reduce((a, b) => a + b, 0) / cand.length;
        if (!pick || mean > pick.mean) pick = { k, mean, cand, min: Math.min(...cand) };
    }
    chosen.push(keyToName.get(pick.k));
    bestOf = pick.cand;
    console.log('  ' + n + '. ' + chosen.join(' + ').padEnd(36)
        + 'mean ' + (pick.mean * 100).toFixed(1) + '%   worst cell ' + (pick.min * 100).toFixed(1) + '%');
}

console.log('\nPer-cell winners (the argmax, for reference - this is NOT the grid):');
for (const [name] of ranked) {
    const owns = live.filter(c => c.fine.name === name);
    console.log('  ' + name.padEnd(12) + String(owns.length).padStart(2) + ' cells   '
        + 'median gain ' + money(med(owns.map(c => c.gainFine))).padStart(12)
        + '   ' + owns.map(c => c.label).join(', ').slice(0, 72));
}
console.log(`\n  ${SIMS.toLocaleString()} sims\n`);
