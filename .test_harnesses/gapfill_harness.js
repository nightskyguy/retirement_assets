'use strict';
/**
 * gapfill_harness.js -- P30. Is the [40, 60] Brokerage/Cash split in the default gap fill
 * load-bearing, and if it is, is 40 the right number?
 *
 * Run:  node .test_harnesses/gapfill_harness.js
 *
 * THE CONSTANT UNDER TEST. When a year's spending needs more than the strategy itself withdraws,
 * `fillSpendingGap` fills the shortfall. The bracket family drains Cash then Brokerage then Roth in
 * sequence; Ordered runs the user's own sequence; EVERYTHING ELSE lands in a default branch that
 * draws Brokerage and Cash proportionally at a bare `[40, 60]`, then falls back to Roth. That
 * literal has been there since the branch was written with nothing justifying the value. P30a made
 * it `inputs.gapFillWeights` so it can be swept; this sweeps it.
 *
 * WHICH FAMILIES CAN EVEN FEEL IT. `yr.isBracketStrategy` covers bracket, minlimit, fixedpct and
 * live-ACA, and those take their own branch. Ordered takes its own. So the weight reaches exactly
 * three families: Proportional, Reduce and Guyton-Klinger. That is a much smaller blast radius than
 * "the gap fill" suggests, and it is the first thing this harness reports rather than the last.
 *
 * SCOPE, AND WHY IT IS WIDER THAN P28's. Two axes P28 held fixed are swept here because they act
 * directly on the mechanism: STATE (the Brokerage leg's tax rate carries
 * `nominalStateTaxAtLimit`, so a no-income-tax state probes the Cash-vs-Brokerage trade rather
 * than re-running it) and CASH RESERVE (the reserve governs how much Cash the fill can reach at
 * all, which is the exact resource the weight splits).
 *
 * A THIRD-PASS ARM, TO SETTLE AN OPEN HYPOTHESIS. P28's ladder was re-baselined on 2026-08-24
 * (`P28_RESULTS.md` section 15) and its mechanism had inverted: the largest Brokerage draws now
 * produce the largest LOSSES where they used to produce the largest gains. The standing hypothesis
 * is P32 (v11.15e3), which let the third pass draw Brokerage by default, so Roth or Cash spent
 * early is no longer there when the third pass reaches for it. Every cell therefore runs twice,
 * at `thirdPassBrokerage: 'bounded'` (today) and `'off'` (pre-P32). If the weight curve has a
 * different SHAPE under the two, the hypothesis is supported.
 *
 * SCORING. `baselineScoreOf`, not finalNW: PF11 established finalNW is orthogonal to "would this
 * change help". One deliberate departure from `unifiedconv_harness.js`, which scored each arm at
 * its OWN `res.totals.futureIRARate`: that discounts the two arms of an A/B differently, which is
 * the drift `baselineScoreOf`'s own doc comment warns about. Here every weight in a cell is scored
 * at the CONTROL arm's rate, so a delta is a delta in the plan and not in the yardstick.
 *
 * REPORTING. The full grid answers the headline (is the curve flat?). The detailed tables slice to
 * CA / reserve-off, because 2,430 cells cannot be read as a table and a slice that is honest about
 * being a slice beats a table nobody reads.
 *
 * PREDICTIONS UNDER TEST, stated before the run and scored in section 6:
 *   A. The weight is INERT wherever the gap fill never draws Brokerage. This is the one P28 finding
 *      that survived re-baselining, and it should survive this too.
 *   B. Fill Bracket, IRA Draw and Ordered are EXACTLY $0 at every weight. They never reach the
 *      branch. A construction guard: if this breaks, the sweep is measuring something else.
 *   C. The curve is FLAT - no cell moves more than $1,000 across the whole 0-to-100 range. "The
 *      constant is not load-bearing" is a real answer and closes part 1 of P30.
 *   D. If it is NOT flat, the best weight is not 40. Nobody chose 40, so nothing recommends it.
 *   E. Proportional stays near zero even where the branch is live, because planPrimaryWithdrawals
 *      funds spending directly and rarely leaves a gap (P28 round 1, re-checked here).
 */

// ── Bootstrap the engine exactly like betr_harness.js / optimizer_core.tests.js ───────────────
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
require('../displayhelpers.js');
const { simulate, baselineScoreOf } = core;

// ── Axes ─────────────────────────────────────────────────────────────────────────────────────
// COMMON and SCENARIOS are copied from unifiedconv_harness.js VERBATIM, not imported:
// phased_harness.js states the rule, and it is the right one - a harness that imports another's
// fixture silently changes when that one is edited for its own reasons.
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

const SPEND_RATES = [0.04, 0.06, 0.08];
const totalAssets = (o) => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;

const SCENARIOS = [
    { key: 'defaults',   label: 'shipped defaults (IRA-heavy)',
      over: { IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000,
              Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000 } },
    { key: 'defaults3x', label: 'defaults x3 (same mix, bigger)',
      over: { IRA1: 3000000, IRA2: 1200000, Roth: 150000, Roth2: 60000,
              Brokerage: 300000, BrokerageBasis: 150000, Cash: 150000 } },
    { key: 'round1',     label: 'round-1 scenario',
      over: { IRA1: 1800000, IRA2: 700000, Roth: 250000, Roth2: 100000,
              Brokerage: 900000, BrokerageBasis: 500000, Cash: 150000 } },
    { key: 'thirds',     label: 'balanced thirds',
      over: { IRA1: 1000000, IRA2: 400000, Roth: 1000000, Roth2: 400000,
              Brokerage: 1400000, BrokerageBasis: 700000, Cash: 150000 } },
    { key: 'brokheavy',  label: 'brokerage-heavy',
      over: { IRA1: 700000, IRA2: 300000, Roth: 400000, Roth2: 200000,
              Brokerage: 2800000, BrokerageBasis: 1200000, Cash: 150000 } },
];

// Brokerage's share of the gap fill. 40 is today. The endpoints are legal and still spill through
// the shortfall cascade (P30a verified this before the sweep was allowed to read anything into
// them), so 0 and 100 are points on the same curve rather than a different policy.
const WEIGHTS = [0, 20, 40, 60, 80, 100];
const CONTROL_W = 40;

// The three families that actually reach the branch, and the three that must not.
const LIVE_FAMILIES = [
    { key: 'propwd',  label: 'Proportional 10%', over: { strategy: 'propwd', propWithdraw: 0.10 } },
    { key: 'reduce',  label: 'Reduce 20 yrs',    over: { strategy: 'fixed', nYears: 20 } },
    { key: 'gk',      label: 'Guyton-Klinger',   over: { strategy: 'gk' } },
];
const GUARD_FAMILIES = [
    { key: 'bracket', label: 'Fill Bracket 24%', over: { strategy: 'bracket', stratRate: 0.24, stratIRMAATier: -1, stratACAMultiple: 0 } },
    { key: 'draw',    label: 'IRA Draw 6%',      over: { strategy: 'fixedpct', iraWithdrawPct: 0.06 } },
    { key: 'ordered', label: 'Ordered CBIR',     over: { strategy: 'ordered', orderedSeq: 'CBIR' } },
];

// CA carries state tax into the Brokerage leg's rate; TX carries none. Not padding - it is the
// cleanest available probe of whether the Cash-vs-Brokerage trade is a TAX trade.
const STATES = ['CA', 'TX'];
// null is OFF, the legacy all-to-cash behavior. A positive number keeps a buffer, which changes how
// much Cash the fill can reach - the exact resource the weight splits.
const RESERVES = [{ key: 'off', label: 'reserve off', value: null },
                  { key: 'on',  label: 'reserve on',  value: 150000 }];
const THIRD_PASS = ['bounded', 'off'];

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────
const money = (n) => (n == null || Number.isNaN(n)) ? '     —   '
    : (n < 0 ? '-' : ' ') + '$' + Math.round(Math.abs(n)).toLocaleString().padStart(10);
const pad = (s, n) => String(s).padEnd(n);
const pct = (r) => (r * 100).toFixed(0) + '%';
const spendFor = (s, r) => Math.round(totalAssets(s.over) * r);

// ── The sweep ────────────────────────────────────────────────────────────────────────────────
const R = new Map();
const k = (...parts) => parts.join('|');
let simCount = 0;

for (const s of SCENARIOS) {
    for (const rate of SPEND_RATES) {
        for (const st of STATES) {
            for (const rsv of RESERVES) {
                for (const f of LIVE_FAMILIES) {
                    for (const tp of THIRD_PASS) {
                        // The control runs first so its futureIRARate can score the whole cell.
                        let cellRate = null;
                        for (const w of [CONTROL_W, ...WEIGHTS.filter(x => x !== CONTROL_W)]) {
                            const inputs = {
                                ...COMMON, ...s.over, STATEname: st, spendGoal: spendFor(s, rate),
                                ...f.over, CashReserve: rsv.value,
                                thirdPassBrokerage: tp, gapFillWeights: [w, 100 - w],
                            };
                            const res = simulate(inputs);
                            simCount++;
                            if (cellRate === null) cellRate = res.totals.futureIRARate ?? 0;
                            const brokWD = res.log.reduce((a, r2) => a + (r2['Brokerage-'] ?? 0), 0);
                            R.set(k(s.key, rate, st, rsv.key, f.key, tp, w), {
                                score: baselineScoreOf(res, cellRate),
                                spend: res.totals.spendCurrentDollars ?? 0,
                                brokWD, success: res.totals.success,
                            });
                        }
                    }
                }
            }
        }
    }
}

// Guards run CA / reserve-off / today's third pass only: the claim is structural, not conditional.
for (const s of SCENARIOS) {
    for (const rate of SPEND_RATES) {
        for (const f of GUARD_FAMILIES) {
            for (const w of WEIGHTS) {
                const res = simulate({
                    ...COMMON, ...s.over, spendGoal: spendFor(s, rate), ...f.over,
                    CashReserve: null, thirdPassBrokerage: 'bounded', gapFillWeights: [w, 100 - w],
                });
                simCount++;
                R.set(k('GUARD', s.key, rate, f.key, w), { log: JSON.stringify(res.log) });
            }
        }
    }
}

const g = (...parts) => R.get(k(...parts));
const d = (s, rate, st, rsv, f, tp, w) => {
    const a = g(s, rate, st, rsv, f, tp, CONTROL_W), b = g(s, rate, st, rsv, f, tp, w);
    return (a && b) ? b.score - a.score : 0;
};

// ── Output ───────────────────────────────────────────────────────────────────────────────────
console.log('='.repeat(112));
console.log('P30 -- the [40, 60] gap-fill split. Is it load-bearing, and is 40 right?');
console.log('='.repeat(112));
console.log('');
console.log(`Grid: ${WEIGHTS.length} weights x ${SCENARIOS.length} mixes x ${SPEND_RATES.length} spend rates x `
    + `${STATES.length} states x ${RESERVES.length} reserve settings x ${LIVE_FAMILIES.length} live families x `
    + `${THIRD_PASS.length} third-pass arms, plus ${GUARD_FAMILIES.length} guard families = ${simCount} simulations.`);
console.log('Scored on baselineScoreOf against the w=40 arm of the SAME cell, at that arm\'s futureIRARate.');
console.log('Weights are Brokerage\'s share; w=40 is today. Spend is a % of TOTAL assets.');
console.log('');

// ── 1. Blast radius ──────────────────────────────────────────────────────────────────────────
console.log('1. WHICH FAMILIES CAN FEEL THIS AT ALL\n');
console.log('   The default branch serves everything that is neither bracket-family nor Ordered:');
console.log('     live   : ' + LIVE_FAMILIES.map(f => f.label).join(', '));
console.log('     never  : ' + GUARD_FAMILIES.map(f => f.label).join(', ') + '  (own branches)');
let guardClean = true, guardChecked = 0;
for (const s of SCENARIOS) for (const rate of SPEND_RATES) for (const f of GUARD_FAMILIES) {
    const ref = g('GUARD', s.key, rate, f.key, CONTROL_W).log;
    for (const w of WEIGHTS) {
        guardChecked++;
        if (g('GUARD', s.key, rate, f.key, w).log !== ref) guardClean = false;
    }
}
console.log(`\n   guard: every weight bit-identical for those three, across ${guardChecked} runs : `
    + (guardClean ? 'YES' : 'NO -- the weight is leaking into a branch it does not own'));

// ── 2. Headline, full grid ───────────────────────────────────────────────────────────────────
const allCells = [];
for (const s of SCENARIOS) for (const rate of SPEND_RATES) for (const st of STATES)
    for (const rsv of RESERVES) for (const f of LIVE_FAMILIES) for (const tp of THIRD_PASS) {
        const swing = WEIGHTS.map(w => d(s.key, rate, st, rsv.key, f.key, tp, w));
        const lo = Math.min(...swing), hi = Math.max(...swing);
        const best = WEIGHTS[swing.indexOf(hi)];
        // A cell whose DELIVERED SPENDING also moved is not a like-for-like wealth comparison:
        // part of its delta is "you spent more", not "you ended richer". baselineScoreOf counts
        // both on purpose, but the two have to be separable or a reader cannot tell which they
        // are looking at. Same guard unifiedconv_harness.js prints as "!".
        const ctl = g(s.key, rate, st, rsv.key, f.key, tp, CONTROL_W);
        const spendMoved = WEIGHTS.some(w =>
            Math.abs(g(s.key, rate, st, rsv.key, f.key, tp, w).spend - ctl.spend) > 1);
        const allOK = WEIGHTS.every(w => g(s.key, rate, st, rsv.key, f.key, tp, w).success);
        allCells.push({ s: s.key, rate, st, rsv: rsv.key, f: f.key, tp, swing, range: hi - lo, best,
                        brok: ctl.brokWD, spendMoved, allOK });
    }
const LIVE_CUT = 1000;
const live = allCells.filter(c => c.range > LIVE_CUT);
console.log('\n2. HEADLINE, ALL ' + allCells.length + ' CELLS OF THE FULL GRID\n');
console.log(`   cells where the whole 0-100 sweep moves more than $${LIVE_CUT.toLocaleString()} : `
    + `${live.length}/${allCells.length}`);
if (live.length) {
    const worst = live.reduce((a, b) => b.range > a.range ? b : a);
    console.log(`   widest cell                                              : ${money(worst.range).trim()}`
        + `  (${worst.s} ${pct(worst.rate)} ${worst.st} ${worst.rsv} ${worst.f} tp=${worst.tp})`);
    const bestCount = {};
    live.forEach(c => { bestCount[c.best] = (bestCount[c.best] ?? 0) + 1; });
    console.log('   best weight among the live cells                         : '
        + WEIGHTS.map(w => `${w}:${bestCount[w] ?? 0}`).join('  '));
}

// ── 3. The curve, CA / reserve-off / today's third pass ──────────────────────────────────────
console.log('\n3. THE CURVE, sliced to CA / reserve off / thirdPassBrokerage=bounded (today)\n');
console.log('   Δscore vs w=40. "brok" is the lifetime Brokerage draw in the CONTROL arm - the');
console.log('   zero-predicate says a cell that never draws Brokerage cannot feel the weight.\n');
console.log('   "!" = delivered spending moved too, so that row mixes a wealth change with a');
console.log('   spending change. "x" = at least one weight failed the plan.\n');
console.log(pad('mix', 30) + pad('family', 18) + pad('rate', 8) + pad('brok', 14)
    + WEIGHTS.map(w => pad('w=' + w, 14)).join(''));
for (const s of SCENARIOS) for (const f of LIVE_FAMILIES) for (const rate of SPEND_RATES) {
    const cell = WEIGHTS.map(w => d(s.key, rate, 'CA', 'off', f.key, 'bounded', w));
    if (cell.every(v => Math.abs(v) <= 1)) continue;   // skip dead rows, they say nothing
    const meta = allCells.find(c => c.s === s.key && c.rate === rate && c.st === 'CA'
        && c.rsv === 'off' && c.f === f.key && c.tp === 'bounded');
    const brok = g(s.key, rate, 'CA', 'off', f.key, 'bounded', CONTROL_W).brokWD;
    console.log(pad(s.label, 30) + pad(f.label, 18)
        + pad(pct(rate) + (meta.spendMoved ? ' !' : '') + (meta.allOK ? '' : ' x'), 8)
        + pad('$' + Math.round(brok).toLocaleString(), 14)
        + cell.map(v => pad(Math.abs(v) <= 1 ? '.' : money(v).trim(), 14)).join(''));
}

// ── 4. Does the state matter, and does the reserve? ──────────────────────────────────────────
console.log('\n4. THE TWO WIDENED AXES -- widest 0-100 swing seen in each slice\n');
console.log(pad('slice', 28) + pad('live cells', 12) + pad('widest swing', 16));
for (const st of STATES) for (const rsv of RESERVES) {
    const sub = allCells.filter(c => c.st === st && c.rsv === rsv.key && c.tp === 'bounded');
    const liveN = sub.filter(c => c.range > LIVE_CUT).length;
    const wide = sub.reduce((a, b) => b.range > a.range ? b : a, { range: 0 });
    console.log(pad(`${st} / ${rsv.label}`, 28) + pad(`${liveN}/${sub.length}`, 12)
        + pad(money(wide.range).trim(), 16));
}

// ── 5. The third-pass hypothesis ─────────────────────────────────────────────────────────────
console.log('\n5. IS P32 WHY THE MECHANISM INVERTED? Same cells, thirdPassBrokerage bounded vs off\n');
console.log(pad('slice', 28) + pad('live cells', 12) + pad('widest swing', 16) + pad('best weight spread', 24));
for (const tp of THIRD_PASS) {
    const sub = allCells.filter(c => c.tp === tp);
    const liveN = sub.filter(c => c.range > LIVE_CUT).length;
    const wide = sub.reduce((a, b) => b.range > a.range ? b : a, { range: 0 });
    const bests = {};
    sub.filter(c => c.range > LIVE_CUT).forEach(c => { bests[c.best] = (bests[c.best] ?? 0) + 1; });
    console.log(pad(`thirdPassBrokerage=${tp}`, 28) + pad(`${liveN}/${sub.length}`, 12)
        + pad(money(wide.range).trim(), 16)
        + pad(WEIGHTS.map(w => `${w}:${bests[w] ?? 0}`).join(' '), 24));
}

// ── 6. Predictions ───────────────────────────────────────────────────────────────────────────
console.log('\n6. PREDICTIONS vs OUTCOME\n');
const check = (label, ok, detail) =>
    console.log(`  ${ok ? 'HELD  ' : 'BROKEN'}   ${pad(label, 44)} ${detail}`);

const noBrok = allCells.filter(c => c.brok === 0);
const noBrokLive = noBrok.filter(c => c.range > 1);
check('A. inert where the fill never draws Brokerage', noBrokLive.length === 0,
    `${noBrok.length} such cells, ${noBrokLive.length} of them move`);

check('B. bracket / IRA Draw / Ordered exactly $0', guardClean,
    `${guardChecked} runs compared, ${guardClean ? 'all bit-identical' : 'A LEAK'}`);

check('C. the curve is flat everywhere', live.length === 0,
    live.length === 0 ? `no cell moves more than $${LIVE_CUT.toLocaleString()}`
        : `${live.length}/${allCells.length} cells move, widest ${money(Math.max(...allCells.map(c => c.range))).trim()}`);

const best40 = live.filter(c => c.best === CONTROL_W).length;
check('D. where it is NOT flat, 40 is not the best', live.length === 0 || best40 < live.length / 2,
    live.length === 0 ? 'vacuous - the curve is flat' : `40 wins ${best40}/${live.length} live cells`);

const cleanLive = live.filter(c => !c.spendMoved && c.allOK);
console.log(`
  Of the ${live.length} live cells, ${cleanLive.length} are clean wealth comparisons `
    + `(delivered spend unchanged, every weight funded the plan).`);
console.log(`  Among those, w=0 is best in ${cleanLive.filter(c => c.best === 0).length}, w=40 in `
    + `${cleanLive.filter(c => c.best === CONTROL_W).length}.
`);

const propCells = allCells.filter(c => c.f === 'propwd');
const propLive = propCells.filter(c => c.range > LIVE_CUT);
check('E. Proportional stays near zero', propLive.length === 0,
    `${propLive.length}/${propCells.length} Proportional cells move more than $${LIVE_CUT.toLocaleString()}`);

// ══ P30c: the OTHER constant nobody chose ════════════════════════════════════════════════════
// The bracket family takes its own branch and drains Cash to zero before touching Brokerage, in a
// strict sequence. Nothing measured that either; the comment above it has always just asserted that
// it "keeps supplemental draws out of taxable income". This sweeps the swap.
//
// Bigger blast radius than the weight: this branch serves Fill Bracket, IRMAA Ceiling, ACA Cliff and
// IRA Draw, where the weight reaches only Proportional, Reduce and Guyton-Klinger. ACA is left out
// of the grid rather than the branch - its rows go untenable when the cap cannot fund spending, and
// an untenable row's delta is noise rather than signal.
//
// PREDICTIONS, stated before the sweep. One cell of Fill Bracket and one of IRA Draw were spot-
// checked first to confirm the arm bites at all, so these are chosen to be undetermined by that:
//   F. cashFirst (today) beats brokerageFirst in most cells - the standing rationale.
//   G. The effect is LARGER in CA than in TX. If this is a tax trade, the state tax that rides on
//      the Brokerage leg's rate should be visible.
//   H. Cash Reserve damps it, the way it damped the weight in section 4.
const BRACKET_FAMILIES = [
    { key: 'bracket', label: 'Fill Bracket 24%', over: { strategy: 'bracket', stratRate: 0.24, stratIRMAATier: -1, stratACAMultiple: 0 } },
    { key: 'irmaa',   label: 'IRMAA Ceil t2',    over: { strategy: 'bracket', stratRate: 0, stratIRMAATier: 2, stratACAMultiple: 0 } },
    { key: 'draw',    label: 'IRA Draw 6%',      over: { strategy: 'fixedpct', iraWithdrawPct: 0.06 } },
];
const ORDERS = ['cashFirst', 'brokerageFirst'];

const C = new Map();
let cCount = 0;
for (const s of SCENARIOS) for (const rate of SPEND_RATES) for (const st of STATES)
    for (const rsv of RESERVES) for (const f of BRACKET_FAMILIES) {
        let cellRate = null;
        for (const ord of ORDERS) {
            const res = simulate({
                ...COMMON, ...s.over, STATEname: st, spendGoal: spendFor(s, rate), ...f.over,
                CashReserve: rsv.value, bracketGapOrder: ord,
            });
            cCount++;
            if (cellRate === null) cellRate = res.totals.futureIRARate ?? 0;
            C.set(k(s.key, rate, st, rsv.key, f.key, ord), {
                score: baselineScoreOf(res, cellRate),
                spend: res.totals.spendCurrentDollars ?? 0,
                success: res.totals.success,
            });
        }
    }

const cCells = [];
for (const s of SCENARIOS) for (const rate of SPEND_RATES) for (const st of STATES)
    for (const rsv of RESERVES) for (const f of BRACKET_FAMILIES) {
        const a = C.get(k(s.key, rate, st, rsv.key, f.key, 'cashFirst'));
        const b = C.get(k(s.key, rate, st, rsv.key, f.key, 'brokerageFirst'));
        cCells.push({ s: s.key, sLabel: s.label, rate, st, rsv: rsv.key, f: f.key, fLabel: f.label,
                      delta: b.score - a.score, spendMoved: Math.abs(b.spend - a.spend) > 1,
                      allOK: a.success && b.success });
    }

console.log('\n' + '='.repeat(112));
console.log('P30c -- the bracket family drains Cash before Brokerage. Should it?');
console.log('='.repeat(112));
console.log('');
console.log(`Grid: ${BRACKET_FAMILIES.length} bracket families x ${SCENARIOS.length} mixes x ${SPEND_RATES.length} rates x `
    + `${STATES.length} states x ${RESERVES.length} reserve settings x ${ORDERS.length} orders = ${cCount} simulations.`);
console.log('Delta is brokerageFirst MINUS cashFirst (today), so a POSITIVE number means the swap wins.');
console.log('');

const cLive = cCells.filter(c => Math.abs(c.delta) > LIVE_CUT);
const cClean = cLive.filter(c => !c.spendMoved && c.allOK);
console.log('7. HEADLINE, ALL ' + cCells.length + ' CELLS\n');
console.log(`   cells where the swap moves more than $${LIVE_CUT.toLocaleString()} : ${cLive.length}/${cCells.length}`);
console.log(`   of those, clean wealth comparisons                : ${cClean.length}`);
console.log(`   swap WINS (clean cells only)                      : ${cClean.filter(c => c.delta > 0).length}/${cClean.length}`);
const cWorst = cCells.reduce((a, b) => Math.abs(b.delta) > Math.abs(a.delta) ? b : a, { delta: 0 });
console.log(`   widest cell                                       : ${money(cWorst.delta).trim()}`
    + `  (${cWorst.s} ${pct(cWorst.rate)} ${cWorst.st} ${cWorst.rsv} ${cWorst.f})`);

console.log('\n8. THE SWAP, sliced to CA / reserve off\n');
console.log('   "!" = delivered spending moved too. "x" = a plan failed under one of the orders.\n');
console.log(pad('mix', 30) + pad('family', 20) + SPEND_RATES.map(r => pad(pct(r), 18)).join(''));
for (const s of SCENARIOS) for (const f of BRACKET_FAMILIES) {
    const row = SPEND_RATES.map(rate => {
        const c = cCells.find(x => x.s === s.key && x.rate === rate && x.st === 'CA'
            && x.rsv === 'off' && x.f === f.key);
        if (Math.abs(c.delta) <= 1) return pad('.', 18);
        return pad(money(c.delta).trim() + (c.spendMoved ? ' !' : '') + (c.allOK ? '' : ' x'), 18);
    });
    if (row.every(v => v.trim() === '.')) continue;
    console.log(pad(s.label, 30) + pad(f.label, 20) + row.join(''));
}

console.log('\n9. STATE AND RESERVE\n');
console.log(pad('slice', 28) + pad('live cells', 12) + pad('swap wins', 12) + pad('widest', 16));
for (const st of STATES) for (const rsv of RESERVES) {
    const sub = cCells.filter(c => c.st === st && c.rsv === rsv.key);
    const l = sub.filter(c => Math.abs(c.delta) > LIVE_CUT);
    const wide = sub.reduce((a, b) => Math.abs(b.delta) > Math.abs(a.delta) ? b : a, { delta: 0 });
    console.log(pad(`${st} / ${rsv.label}`, 28) + pad(`${l.length}/${sub.length}`, 12)
        + pad(`${l.filter(c => c.delta > 0).length}/${l.length}`, 12) + pad(money(wide.delta).trim(), 16));
}

console.log('\n10. P30c PREDICTIONS vs OUTCOME\n');
const cashWins = cClean.filter(c => c.delta < 0).length;
check('F. cashFirst (today) beats the swap', cClean.length > 0 && cashWins > cClean.length / 2,
    `cashFirst wins ${cashWins}/${cClean.length} clean cells`);
const widestIn = (st) => cCells.filter(c => c.st === st)
    .reduce((a, b) => Math.abs(b.delta) > a ? Math.abs(b.delta) : a, 0);
check('G. the effect is larger in CA than TX', widestIn('CA') > widestIn('TX'),
    `widest CA ${money(widestIn('CA')).trim()} vs TX ${money(widestIn('TX')).trim()}`);
const liveIn = (r) => cCells.filter(c => c.rsv === r && Math.abs(c.delta) > LIVE_CUT).length;
check('H. Cash Reserve damps it', liveIn('on') < liveIn('off'),
    `live cells: reserve off ${liveIn('off')}, reserve on ${liveIn('on')}`);

// ══ P30d: the 21 orderings that were never shipped ═══════════════════════════════════════════
// Ordered runs the account sequence the user picked, and the UI offers three: CBIR, RIBC, BIRC.
// Twenty-four permutations of four accounts exist. `resolveOrderedSeq` used to look the code up in
// a three-entry map and fall back to CBIR for everything else, so the other 21 named a sequence and
// silently ran a different one - unmeasurable by construction. P30d generalized the resolver to
// build the sequence from the letters, which leaves the three shipped codes byte-identical and
// makes the rest reachable. Nothing ships: `grids.ordered` still sweeps the same three.
//
// PREDICTIONS, stated before the sweep:
//   I. At least one unshipped ordering beats all three shipped ones somewhere. This is Q4.
//   J. The three shipped codes are not dominated - each wins somewhere.
//   K. Orderings that reach Cash before Brokerage beat orderings that do the reverse, which is what
//      P30b and P30c both found on their own branches. If P30 has one story, this is where it
//      either generalizes or stops.
const PERMS = (() => {
    const out = [];
    const walk = (acc, rest) => rest.length ? rest.forEach((c, i) =>
        walk([...acc, c], rest.filter((_, j) => j !== i))) : out.push(acc.join(''));
    walk([], ['C', 'B', 'I', 'R']);
    return out;
})();
const SHIPPED = ['CBIR', 'RIBC', 'BIRC'];

const O = new Map();
let oCount = 0;
for (const s of SCENARIOS) for (const rate of SPEND_RATES) for (const st of STATES)
    for (const rsv of RESERVES) {
        let cellRate = null;
        for (const seq of PERMS) {
            const res = simulate({
                ...COMMON, ...s.over, STATEname: st, spendGoal: spendFor(s, rate),
                strategy: 'ordered', orderedSeq: seq, CashReserve: rsv.value,
            });
            oCount++;
            if (cellRate === null) cellRate = res.totals.futureIRARate ?? 0;
            O.set(k(s.key, rate, st, rsv.key, seq), {
                score: baselineScoreOf(res, cellRate),
                spend: res.totals.spendCurrentDollars ?? 0,
                success: res.totals.success,
                shape: JSON.stringify(res.log),
            });
        }
    }

const oCells = [];
for (const s of SCENARIOS) for (const rate of SPEND_RATES) for (const st of STATES)
    for (const rsv of RESERVES) {
        const rows = PERMS.map(seq => ({ seq, ...O.get(k(s.key, rate, st, rsv.key, seq)) }));
        const best = rows.reduce((a, b) => b.score > a.score ? b : a);
        const bestShipped = rows.filter(r => SHIPPED.includes(r.seq))
            .reduce((a, b) => b.score > a.score ? b : a);
        oCells.push({ s: s.key, sLabel: s.label, rate, st, rsv: rsv.key, rows, best, bestShipped,
                      gain: best.score - bestShipped.score,
                      distinct: new Set(rows.map(r => r.shape)).size });
    }

console.log('\n' + '='.repeat(112));
console.log('P30d -- the 21 orderings of four accounts that were never shipped');
console.log('='.repeat(112));
console.log('');
console.log(`Grid: ${PERMS.length} permutations x ${SCENARIOS.length} mixes x ${SPEND_RATES.length} rates x `
    + `${STATES.length} states x ${RESERVES.length} reserve settings = ${oCount} simulations.`);
console.log(`Shipped today: ${SHIPPED.join(', ')}. "gain" is the best permutation MINUS the best shipped one.`);
console.log('');

console.log('11. HOW MANY ORDERINGS ARE REALLY DISTINCT\n');
const distincts = oCells.map(c => c.distinct);
console.log(`   distinct plans per cell, out of ${PERMS.length} permutations : `
    + `min ${Math.min(...distincts)}, max ${Math.max(...distincts)}, `
    + `median ${distincts.slice().sort((a, b) => a - b)[Math.floor(distincts.length / 2)]}`);
console.log('   The sequence only matters up to the point the gap is filled, and an account with no');
console.log('   balance is skipped, so the tail of the order is frequently irrelevant.');

console.log('\n12. DOES AN UNSHIPPED ORDERING EVER WIN?\n');
const oWin = oCells.filter(c => c.gain > LIVE_CUT);
const oClean = oWin.filter(c => c.best.success && c.bestShipped.success
    && Math.abs(c.best.spend - c.bestShipped.spend) <= 1);
console.log(`   cells where the best permutation beats the best shipped one by >$${LIVE_CUT.toLocaleString()} : `
    + `${oWin.length}/${oCells.length}`);
console.log(`   of those, clean wealth comparisons                                : ${oClean.length}`);
if (oWin.length) {
    const top = oWin.reduce((a, b) => b.gain > a.gain ? b : a);
    console.log(`   widest gain                                                      : ${money(top.gain).trim()}`
        + `  with ${top.best.seq}  (${top.s} ${pct(top.rate)} ${top.st} ${top.rsv}, best shipped ${top.bestShipped.seq})`);
}
const winners = {};
oCells.forEach(c => { winners[c.best.seq] = (winners[c.best.seq] ?? 0) + 1; });
console.log('\n   how often each ordering is the outright best of all 24:');
Object.entries(winners).sort((a, b) => b[1] - a[1]).forEach(([seq, n]) =>
    console.log(`     ${seq}${SHIPPED.includes(seq) ? ' (shipped)' : '          '}  ${n}`));

console.log('\n13. BEST ORDERING, sliced to CA / reserve off\n');
console.log(pad('mix', 30) + pad('rate', 8) + pad('best of 24', 14) + pad('best shipped', 16)
    + pad('gain', 16) + pad('distinct', 10));
for (const s of SCENARIOS) for (const rate of SPEND_RATES) {
    const c = oCells.find(x => x.s === s.key && x.rate === rate && x.st === 'CA' && x.rsv === 'off');
    console.log(pad(s.label, 30) + pad(pct(rate), 8) + pad(c.best.seq, 14) + pad(c.bestShipped.seq, 16)
        + pad(c.gain > 1 ? money(c.gain).trim() : '-', 16) + pad(String(c.distinct), 10));
}

console.log('\n14. P30d PREDICTIONS vs OUTCOME\n');
check('I. an unshipped ordering wins somewhere', oClean.length > 0,
    `${oClean.length} clean cells where an unshipped ordering beats every shipped one`);
const shippedWins = SHIPPED.filter(sq => (winners[sq] ?? 0) > 0);
check('J. no shipped code is dominated', shippedWins.length === SHIPPED.length,
    `shipped codes that win at least one cell: ${shippedWins.join(', ') || 'none'}`);
// Cash-before-Brokerage across the whole field, not just the winner: compare the mean score of the
// 12 permutations with C before B against the 12 with B before C, cell by cell.
const cBeforeB = (sq) => sq.indexOf('C') < sq.indexOf('B');
let cbWins = 0;
for (const c of oCells) {
    const mean = (f) => { const v = c.rows.filter(r => f(r.seq)).map(r => r.score);
                          return v.reduce((a, b) => a + b, 0) / v.length; };
    if (mean(cBeforeB) > mean(sq => !cBeforeB(sq))) cbWins++;
}
check('K. Cash before Brokerage beats the reverse', cbWins > oCells.length / 2,
    `${cbWins}/${oCells.length} cells where the C-before-B half scores higher on average`);

// K broke as a PAIRWISE test, which averages over where I and R sit and washes the signal out.
// The narrower claim - Cash FIRST - is reported alongside it rather than quietly substituted for
// it, because rewriting a prediction after seeing the data is how a broken one gets laundered.
const cashFirstBest = oCells.filter(c => c.best.seq[0] === 'C').length;
const iraLastBest = oCells.filter(c => c.best.seq[3] === 'I').length;
console.log(`\n  Narrower readings, reported because K broke and these are what the winners show:`);
console.log(`    best ordering starts with Cash : ${cashFirstBest}/${oCells.length}`);
console.log(`    best ordering ends with IRA    : ${iraLastBest}/${oCells.length}`);
console.log(`    shipped codes never best       : `
    + `${SHIPPED.filter(sq => !(winners[sq] > 0)).join(', ') || 'none'}`);

console.log('');
