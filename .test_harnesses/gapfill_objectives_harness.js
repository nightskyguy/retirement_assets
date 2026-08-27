'use strict';
/**
 * gapfill_objectives_harness.js -- P30h. Should the default gap fill's [40, 60] proportional blend
 * be DELETED and the branch unified on the Cash-first shortfall cascade the bracket branch already
 * runs?
 *
 * Run:  node .test_harnesses/gapfill_objectives_harness.js
 *
 * WHY THIS IS A DIFFERENT QUESTION FROM P30b
 * `P30b` asked "is 40 the right number" and answered no - w=0 wins 65 of 82 clean cells and w=40
 * wins none. `P30g` then declined to change the default, naming three gaps in the evidence:
 *   1. it was `baselineScoreOf` only, not the other OPTIMIZER_OBJECTIVES;
 *   2. there was no liquidity measure, and the harness could not see one;
 *   3. Cash Reserve damps the whole effect ~16x, so the exposed users are the ones with no reserve.
 * This harness closes 1 and 2 and re-measures 3.
 *
 * AND IT REFRAMES THE ANSWER. `w=0` is not "Cash only". `calculateWithdrawals` cascades the
 * shortfall, so `[0, 100]` draws Cash until it is gone and then draws Brokerage - verified in the
 * log, not argued: Cash covers year 1 in full, hits $0, and Brokerage carries every year after.
 * That is exactly the sequence `yr.isBracketStrategy` already runs two branches up. So the choice
 * is not "which weight" but "does the proportional blend deserve to exist at all", and if w=0 wins
 * the two branches collapse into one policy and one of them can go.
 *
 * SCORING, AND THE ONE RULE THAT MATTERS MOST HERE
 * Every objective is computed at the CONTROL arm's `futureIRARate`, so a delta is a delta in the
 * plan and not in the yardstick - the discipline `gapfill_harness.js` established.
 *
 * A cell is CLEAN only when delivered spend is identical across all six weights AND every weight
 * funds the plan. A weight that ends richer by spending less has won nothing, and mixing those
 * cells into a wealth ranking is how a stinginess ordering gets mistaken for a strategy ordering.
 * Unclean cells are counted and reported, never silently dropped.
 *
 * `conveffect` and `breakeven` are NOT scored. They read row fields (`_convSavings`, and a
 * break-even year that needs the conversion baseline) that the Optimizer computes around
 * `simulate()` rather than inside it, so scoring them here would mean reimplementing them - and a
 * reimplemented metric that disagrees with the product's is worse than an absent one.
 *
 * STATE is not swept. `P30b` and `P30c` both found it barely matters (CA vs TX differed by 5% on
 * P30c's headline, which is evidence about state, not about the constant). Runtime went to the
 * reserve axis instead, which `P30b` found IS the big lever.
 *
 * -- PREDICTIONS, recorded BEFORE the numbers were looked at ------------------------------------
 *   W1. w=0 wins most objectives, mirroring P30b's baselineScoreOf finding.
 *   W2. w=0 is the WORST on liquidity - the most years with Cash at zero. This is the cost P30g
 *       named and could not measure, and it is the reason to expect a genuine trade-off.
 *   W3. maxspend is FLAT across weights inside clean cells. A construction guard: clean cells are
 *       defined by equal delivered spend, so if this ever differs the filter is broken.
 *   W4. Reserve-ON damps every objective's spread by roughly an order of magnitude (P30b saw 16x).
 *   W5. The objectives DISAGREE - at least one prefers a nonzero weight. If they all agree on w=0,
 *       the case for deleting the blend is much stronger than P30g assumed when it declined.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
require('../displayhelpers.js');
const { simulate, baselineScoreOf, afterTaxWealthOfLogRow, afterTaxBucketSpread } = core;

const COMMON = {
    STATEname: 'CA',
    birthyear1: 1962, birthmonth1: 6, die1: 92,
    birthyear2: 1964, birthmonth2: 3, die2: 94, hasSpouse: true,
    ss1: 45000, ss1Age: 70, ss2: 24000, ss2Age: 67,
    pensionAnnual: 0, pensionStartAge: 0, survivorPct: 0, pensionCola: false,
    spendChange: 0, iraBaseGoal: 0,
    inflation: 0.025, cpi: 0.025, growth: 0.06,
    cashYield: 0.03, dividendRate: 0.02,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: true, extraConversionAmount: 0, fundConversionWithCash: false,
    startAge: 64, startInYear: 2026, dividendReinvest: true,
    gkGuard: 0.20, gkAdjPct: 0.10, cycleLTCGTarget: 0.15,
    qcdHHMax: 0, qcdMode: 'asneeded', computeOC: false,
    cyclicEnabled: false,   // harvest timing swamps this signal; see irmaa_margin_harness.js
};
const totalAssets = o => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;
const SCENARIOS = [
  { key:'defaults',   label:'shipped defaults (IRA-heavy)', over:{ IRA1:1000000, IRA2:400000, Roth:50000,   Roth2:20000,  Brokerage:100000,  BrokerageBasis:50000,   Cash:50000  } },
  { key:'defaults3x', label:'defaults x3 (same mix)',       over:{ IRA1:3000000, IRA2:1200000,Roth:150000,  Roth2:60000,  Brokerage:300000,  BrokerageBasis:150000,  Cash:150000 } },
  { key:'round1',     label:'round-1 scenario',             over:{ IRA1:1800000, IRA2:700000, Roth:250000,  Roth2:100000, Brokerage:900000,  BrokerageBasis:500000,  Cash:150000 } },
  { key:'thirds',     label:'balanced thirds',              over:{ IRA1:1000000, IRA2:400000, Roth:1000000, Roth2:400000, Brokerage:1400000, BrokerageBasis:700000,  Cash:150000 } },
  { key:'brokheavy',  label:'brokerage-heavy',              over:{ IRA1:700000,  IRA2:300000, Roth:400000,  Roth2:200000, Brokerage:2800000, BrokerageBasis:1200000, Cash:150000 } },
];
const SPEND_RATES = [0.04, 0.06, 0.08];
// The three families that actually reach the default branch. Bracket-family and Ordered take their
// own branches; P30b pinned them bit-identical at every weight across 270 guard runs.
const FAMILIES = [
    { key: 'propwd', label: 'Proportional 10%', over: { strategy: 'propwd', propWithdraw: 0.10, nYears: 25, iraWithdrawPct: 0.06 } },
    { key: 'fixed',  label: 'Reduce 20 yrs',    over: { strategy: 'fixed',  nYears: 20, propWithdraw: 0, iraWithdrawPct: 0.06 } },
    { key: 'gk',     label: 'Guyton-Klinger',   over: { strategy: 'gk',     nYears: 25, propWithdraw: 0, iraWithdrawPct: 0.06 } },
];
const RESERVES = [{ key: 'off', label: 'reserve off', value: null },
                  { key: 'on',  label: 'reserve on',  value: 100000 }];
const WEIGHTS = [0, 20, 40, 60, 80, 100];   // the BROKERAGE weight; order is [Brokerage, Cash]
const CONTROL_W = 40;

const pad  = (s, w) => String(s).padEnd(w);
const rpad = (s, w) => String(s).padStart(w);
const pct  = (x, d = 1) => (x * 100).toFixed(d) + '%';
const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
const spendFor = (s, r) => Math.round(totalAssets(s.over) * r);

// Objectives scored from a simulate() result. dir 'desc' = bigger is better.
// eps is the tie threshold IN THAT OBJECTIVE'S OWN UNITS. `taxflex` is a FRACTION in [0,1], not
// dollars: a single shared $1 epsilon made it tie in all 31 cells mechanically, whatever the data
// said, and the table reported that as "the weight does not move it". Every objective now carries
// its own epsilon and its own formatter.
const OBJECTIVES = [
    ['networth',  'desc', (res, rate) => afterTaxWealthOfLogRow(res.log[res.log.length - 1], rate), 1, money],
    ['balanced',  'desc', (res, rate) => baselineScoreOf(res, rate), 1, money],
    ['taxflex',   'asc',  (res, rate) => afterTaxBucketSpread(res, rate), 1e-6, v => v.toFixed(5)],
    ['mintax',    'asc',  (res) => res.totals.taxCurrentDollars ?? Infinity, 1, money],
    ['maxspend',  'desc', (res) => res.totals.spendCurrentDollars ?? -Infinity, 1, money],
    ['maxroth',   'desc', (res) => res.totals.terminal?.roth ?? -Infinity, 1, money],
    ['widowrmd',  'asc',  (res, rate) => (res.totals.rmdTax ?? 0) + (res.totals.terminal?.ira ?? 0) * (rate ?? 0), 1, money],
];

// Liquidity, the measure P30g said the harness could not see. Cash at (or within $1 of) zero is a
// household with no buffer for anything the plan did not model.
function liquidity(res) {
    const rows = res.log.filter(e => e.year !== undefined);
    const zero = rows.filter(e => (e.Cash ?? 0) <= 1).length;
    return { zeroYears: zero, years: rows.length,
             zeroFrac: rows.length ? zero / rows.length : 0,
             minCash: Math.min(...rows.map(e => e.Cash ?? 0)) };
}

console.log('P30h -- delete the [40,60] blend and unify on the Cash-first cascade?');
console.log(SCENARIOS.length + ' mixes x ' + SPEND_RATES.length + ' spend rates x ' + FAMILIES.length
          + ' families x ' + RESERVES.length + ' reserve settings = '
          + (SCENARIOS.length * SPEND_RATES.length * FAMILIES.length * RESERVES.length) + ' cells, '
          + WEIGHTS.length + ' weights each. w is the BROKERAGE weight; order is [Brokerage, Cash].');

// -- build the grid ------------------------------------------------------------------------------
const cells = [];
for (const s of SCENARIOS) for (const r of SPEND_RATES) for (const f of FAMILIES) for (const rv of RESERVES) {
    const base = { ...COMMON, ...s.over, ...f.over, spendGoal: spendFor(s, r),
                   ...(rv.value == null ? {} : { CashReserve: rv.value }) };
    const arms = {};
    for (const w of WEIGHTS) {
        arms[w] = simulate({ ...base, gapFillWeights: [w, 100 - w] });
    }
    const rate = arms[CONTROL_W].totals.futureIRARate ?? 0;
    const spends = WEIGHTS.map(w => arms[w].totals.spendCurrentDollars ?? 0);
    const funded = WEIGHTS.every(w => (arms[w].totals.success ?? 0) >= 1
                                   || (arms[w].totals.shortfall ?? 0) <= 1);
    const spendEqual = Math.max(...spends) - Math.min(...spends) <= 1;
    cells.push({ s: s.label, f: f.label, fkey: f.key, r, rv: rv.key, arms, rate,
                 clean: spendEqual && funded, spendEqual, funded });
}

const clean = cells.filter(c => c.clean);
console.log('');
console.log('Cells: ' + cells.length + ' total, ' + clean.length + ' CLEAN (delivered spend identical '
          + 'at every weight AND every weight funds the plan).');
console.log('  not clean: ' + cells.filter(c => !c.spendEqual).length + ' moved delivered spend, '
          + cells.filter(c => !c.funded).length + ' left a weight unfunded.');

// -- 1. who wins each objective ------------------------------------------------------------------
// TIE_EPS exists because the first version of this awarded every tie to w=0, the first weight in
// the list, and printed "taxflex: w=0 wins 31 of 31" for an objective whose spread across all six
// weights was $0 - i.e. an objective the weight does not move at all. `maxspend` was the same, and
// worse, because clean cells are DEFINED by equal delivered spend so it can only ever tie. A winner
// column that cannot distinguish "wins everywhere" from "moves nothing" is not evidence.
// Ties are now returned as null and counted in their own column.
const winnerOf = (cell, obj) => {
    const [, dir, fn, eps] = obj;
    const vals = WEIGHTS.map(w => fn(cell.arms[w], cell.rate));
    if (!vals.every(Number.isFinite)) return null;
    const hi = Math.max(...vals), lo = Math.min(...vals);
    if (hi - lo <= eps) return null;                           // the weight does not move this metric
    const target = dir === 'desc' ? hi : lo;
    return WEIGHTS[vals.findIndex(v => v === target)];
};

console.log('');
console.log('## 1. Which weight wins each objective, over the ' + clean.length + ' clean cells');
console.log('');
console.log(pad('objective', 12) + WEIGHTS.map(w => rpad('w=' + w, 7)).join('') + rpad('TIED', 7)
          + rpad('winner', 9) + rpad('w=40', 7) + rpad('mean spread', 14));
for (const obj of OBJECTIVES) {
    const counts = Object.fromEntries(WEIGHTS.map(w => [w, 0]));
    let spreadSum = 0, tied = 0;
    for (const c of clean) {
        const win = winnerOf(c, obj);
        if (win === null) tied++; else counts[win]++;
        const vals = WEIGHTS.map(w => obj[2](c.arms[w], c.rate)).filter(Number.isFinite);
        if (vals.length) spreadSum += Math.abs(Math.max(...vals) - Math.min(...vals));
    }
    const live = clean.length - tied;
    const top = live ? WEIGHTS.reduce((a, w) => counts[w] > counts[a] ? w : a, WEIGHTS[0]) : null;
    console.log(pad(obj[0], 12) + WEIGHTS.map(w => rpad(counts[w], 7)).join('') + rpad(tied, 7)
              + rpad(top === null ? 'none' : 'w=' + top, 9) + rpad(counts[40], 7)
              + rpad(obj[4](spreadSum / Math.max(1, clean.length)), 14));
}
console.log('');
console.log('  TIED = the weight moves this metric by less than its own epsilon in that cell, so no weight');
console.log('  wins it. Counting a tie as a win for the first weight in the list is how an objective');
console.log('  the constant does not touch gets reported as a landslide.');

// -- 2. liquidity ---------------------------------------------------------------------------------
console.log('');
console.log('## 2. Liquidity: years the household holds no Cash (the cost P30g could not measure)');
console.log('');
console.log(pad('weight', 10) + rpad('cash-zero yrs', 16) + rpad('% of plan-years', 18)
          + rpad('cells at 100% zero', 20));
for (const w of WEIGHTS) {
    let zero = 0, yrs = 0, allZero = 0;
    for (const c of cells) {
        const L = liquidity(c.arms[w]);
        zero += L.zeroYears; yrs += L.years;
        if (L.zeroFrac >= 0.999) allZero++;
    }
    console.log(pad('w=' + w, 10) + rpad(zero.toLocaleString('en-US'), 16)
              + rpad(pct(zero / yrs), 18) + rpad(allZero + ' / ' + cells.length, 20));
}

// -- 3. the reserve axis --------------------------------------------------------------------------
console.log('');
console.log('## 3. Does Cash Reserve damp it? (P30b measured ~16x on baselineScoreOf)');
console.log('');
console.log(pad('reserve', 14) + rpad('clean cells', 13) + rpad('mean |spread| balanced', 24)
          + rpad('w=0 wins balanced', 20));
for (const rv of RESERVES) {
    const sub = clean.filter(c => c.rv === rv.key);
    let spreadSum = 0, w0 = 0;
    const obj = OBJECTIVES.find(o => o[0] === 'balanced');
    for (const c of sub) {
        const vals = WEIGHTS.map(w => obj[2](c.arms[w], c.rate));
        spreadSum += Math.max(...vals) - Math.min(...vals);
        if (winnerOf(c, obj) === 0) w0++;
    }
    console.log(pad(rv.label, 14) + rpad(sub.length, 13)
              + rpad(money(spreadSum / Math.max(1, sub.length)), 24)
              + rpad(w0 + ' / ' + sub.length, 20));
}

// -- 4. predictions -------------------------------------------------------------------------------
console.log('');
console.log('## 4. Scored predictions');
console.log('');
const score = (id, ok, detail) => console.log('  ' + (ok ? 'HELD    ' : 'BROKEN  ') + id + '  ' + detail);

const winCounts = {};
for (const obj of OBJECTIVES) {
    const counts = Object.fromEntries(WEIGHTS.map(w => [w, 0]));
    for (const c of clean) { const win = winnerOf(c, obj); if (win !== null) counts[win]++; }
    winCounts[obj[0]] = counts;
}
// An objective every cell ties on has NO winner and must not be counted as agreeing with anything.
const liveOf = o => WEIGHTS.reduce((a, w) => a + winCounts[o][w], 0);
const objWinner = o => liveOf(o) === 0 ? null
    : WEIGHTS.reduce((a, w) => winCounts[o][w] > winCounts[o][a] ? w : a, WEIGHTS[0]);
const liveObjs = OBJECTIVES.filter(o => objWinner(o[0]) !== null);
const zeroWins = liveObjs.filter(o => objWinner(o[0]) === 0).length;
score('W1. w=0 wins most objectives', zeroWins > liveObjs.length / 2,
      zeroWins + ' of ' + liveObjs.length + ' LIVE objectives ('
      + (OBJECTIVES.length - liveObjs.length) + ' tied everywhere and are not counted) -> '
      + liveObjs.map(o => o[0] + ':w=' + objWinner(o[0]) + ' (' + winCounts[o[0]][objWinner(o[0])]
        + '/' + liveOf(o[0]) + ')').join(', '));

const zeroFracFor = w => {
    let z = 0, y = 0;
    for (const c of cells) { const L = liquidity(c.arms[w]); z += L.zeroYears; y += L.years; }
    return z / y;
};
const f0 = zeroFracFor(0), f100 = zeroFracFor(100);
score('W2. w=0 is worst on liquidity', f0 > f100,
      'cash-zero share w=0 ' + pct(f0) + ' vs w=100 ' + pct(f100)
      + ' vs w=40 ' + pct(zeroFracFor(40)));

const spendFlat = clean.every(c => {
    const v = WEIGHTS.map(w => c.arms[w].totals.spendCurrentDollars ?? 0);
    return Math.max(...v) - Math.min(...v) <= 1;
});
score('W3. maxspend flat inside clean cells', spendFlat, spendFlat ? 'construction guard holds'
      : 'CLEAN-CELL FILTER IS BROKEN - spend differs inside a cell it called clean');

const spreadFor = key => {
    const sub = clean.filter(c => c.rv === key);
    const obj = OBJECTIVES.find(o => o[0] === 'balanced');
    let s = 0;
    for (const c of sub) { const v = WEIGHTS.map(w => obj[2](c.arms[w], c.rate)); s += Math.max(...v) - Math.min(...v); }
    return s / Math.max(1, sub.length);
};
const sOff = spreadFor('off'), sOn = spreadFor('on');
score('W4. reserve-on damps ~an order of magnitude', sOn > 0 && sOff / sOn >= 5,
      'off ' + money(sOff) + ' vs on ' + money(sOn) + ' = ' + (sOn ? (sOff / sOn).toFixed(1) : 'inf') + 'x');

const distinct = new Set(liveObjs.map(o => objWinner(o[0])));
score('W5. the objectives disagree', distinct.size > 1,
      'winners across ' + liveObjs.length + ' live objectives: '
      + [...distinct].map(w => 'w=' + w).join(', '));
