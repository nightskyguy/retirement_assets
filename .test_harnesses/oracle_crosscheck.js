'use strict';
/**
 * oracle_crosscheck.js -- P51d / P103a. Independent search cross-check of the oracle.
 *
 * Run:  node .test_harnesses/oracle_crosscheck.js
 *       node .test_harnesses/oracle_crosscheck.js --budget 3     (3x sim budget arm)
 *       node .test_harnesses/oracle_crosscheck.js --cells all     (all 45, slow)
 *
 * WHY THIS EXISTS. `oracle_harness.js` calls its result a CEILING, and every gap number in
 * PERFECT_FORESIGHT_ORACLE.md is a distance below it. But the oracle's own search is CYCLIC
 * COORDINATE DESCENT over a fixed $25k/$5k menu: local, deterministic, and provably not a true
 * optimum -- cyclic rows beat it in one cell. So every published gap is a LOWER bound of unknown
 * size. This harness gives that "unknown" a number by running a search of a DIFFERENT SHAPE
 * against the identical objective and an equal sim budget, and reporting how far the descent sits
 * below it.
 *
 * WHAT IS HELD IDENTICAL to oracle_harness.js, deliberately, so the two numbers subtract:
 *   - the bootstrap, COMMON / MIXES / SPEND_RATES / BASIS_ARMS grid,
 *   - scoreOf() including the spend pin and the deflation factor,
 *   - cellArms() / evalArms() and baselineScore champion selection,
 *   - conversionsOracle(): the descent is re-run HERE rather than read from the other harness's
 *     stdout, so both numbers come from one process on one engine build.
 * The duplication is intentional. A shared module would let a later edit move the yardstick and
 * the thing it measures together, silently.
 *
 * WHAT DIFFERS -- the cross-check search (`stochasticSearch`):
 *   - global, not per-coordinate: random restarts from random sparse vectors, not only from the
 *     three fixed seeds;
 *   - moves act on RUNS OF YEARS, not one year at a time: block add/subtract, shift an amount
 *     from one year to another, scale the whole vector, swap two years. Coordinate descent cannot
 *     reach a better vector that requires two years to move together; these moves can.
 *   - off-menu amounts: $1k granularity, against the descent's $25k grid + $5k refinement.
 *   - seeded RNG (LCG), so a re-run reproduces exactly.
 * Budget is measured, not guessed: each cell's descent sim count is counted first, and the
 * stochastic arm is handed the SAME number of sims. Equal cost, different shape.
 *
 * ── PREDICTIONS UNDER TEST, recorded BEFORE the numbers were looked at ───────────────────────
 *   X-P1. At equal sim budget the stochastic search beats the coordinate descent by < 1% of real
 *         after-tax NW in most cells (>= 3 of 5): the descent is close to the menu's own optimum,
 *         so the published gaps are near-tight rather than wildly conservative.
 *   X-P2. Where the descent's own gain over the flat scalar is largest, the cross-check's residual
 *         is largest too -- search difficulty scales with the size of the prize.
 *   X-P3. Tripling the budget moves the stochastic result by less than the descent-to-stochastic
 *         difference itself, i.e. the cross-check is itself near-converged and is not just a
 *         budget artifact.
 * Scored at the end of the run.
 */

// ── Bootstrap the engine exactly like oracle_harness.js ─────────────────────────────────────
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
const {
    simulate, afterTaxNetWorth, SPENDABLE_WEIGHT, optimizeConversionAmount,
    buildStrategyFamilies, OPTIMIZER_GRIDS, bothOnMedicareAtStart,
} = core;

const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString();
const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] != null ? argv[i + 1] : dflt;
};
const BUDGET_MULT = Number(argOf('--budget', '1')) || 1;
const CELL_MODE = argOf('--cells', 'named');

// ── Grid: identical to oracle_harness.js ────────────────────────────────────────────────────
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
const MIXES = [
    { key: 'defaults',   over: { IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000,
                                 Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000 } },
    { key: 'defaults3x', over: { IRA1: 3000000, IRA2: 1200000, Roth: 150000, Roth2: 60000,
                                 Brokerage: 300000, BrokerageBasis: 150000, Cash: 150000 } },
    { key: 'round1',     over: { IRA1: 1800000, IRA2: 700000, Roth: 250000, Roth2: 100000,
                                 Brokerage: 900000, BrokerageBasis: 500000, Cash: 150000 } },
    { key: 'thirds',     over: { IRA1: 1000000, IRA2: 400000, Roth: 1000000, Roth2: 400000,
                                 Brokerage: 1400000, BrokerageBasis: 700000, Cash: 150000 } },
    { key: 'brokheavy',  over: { IRA1: 700000, IRA2: 300000, Roth: 400000, Roth2: 200000,
                                 Brokerage: 2800000, BrokerageBasis: 1200000, Cash: 150000 } },
];
const SPEND_RATES = [0.04, 0.06, 0.08];
const BASIS_ARMS = [null, 0.2, 0.8];
const totalAssets = o => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;

// The five cells P51's own report singles out, one per mix, spanning the interesting shapes:
// the biggest conversion prize, the cell where cyclic beat the oracle, the split-dominated cell,
// and the null case where the oracle changed nothing.
const NAMED = ['defaults @6%', 'defaults3x @4%', 'round1 @4%', 'thirds @4%', 'brokheavy @4%'];

let SIMS = 0;
function runSim(inputs) { SIMS++; return simulate(inputs); }

// ── Objective: byte-identical to oracle_harness.js scoreOf ──────────────────────────────────
function scoreOf(res, sharedRate, baseSpend = null) {
    if (!res?.totals?.success) return null;
    if ((res.totals.shortfall ?? 0) > 1) return null;
    if (baseSpend != null && Math.abs((res.totals.spendCurrentDollars ?? 0) - baseSpend) > 1) return null;
    const last = res.log[res.log.length - 1];
    const atnw = afterTaxNetWorth(res.totals.terminal, sharedRate, res.totals.capGainsRate);
    const defl = (res.finalNW && res.finalNW !== 0)
        ? ((last.totalNetWealth / (last.inflationFactor || 1)) / res.finalNW) : 1;
    return atnw * defl;
}
function cellArms(cellBase) {
    const acaDisabled = bothOnMedicareAtStart(cellBase.birthyear1, cellBase.startAge,
        !!cellBase.hasSpouse, cellBase.hasSpouse ? (cellBase.birthyear2 || 0) : 0);
    return buildStrategyFamilies(cellBase, {
        grids: OPTIMIZER_GRIDS, irmaaFamily: true, acaFamily: !acaDisabled,
        bracketResetsIRMAATier: true, markCashFunding: true,
        cashClones: cellBase.Cash > 0, offGridLast: true,
    });
}
function evalArms(cellBase) {
    const rows = [];
    for (const f of cellArms(cellBase)) {
        let res; try { res = runSim({ ...cellBase, ...f.overrides }); } catch (e) { continue; }
        const totalYears = res.log.length;
        const ovYears = res.log.filter(e => (e['BracketOverage'] ?? 0) > 0).length;
        const flagged = (f.overrides.strategy === 'bracket' && totalYears > 0 && ovYears / totalYears > 0.5)
            || (f.overrides.strategy === 'aca' && (res.totals?.acaBreachYears ?? 0) > 0);
        rows.push({ f, res, flagged });
    }
    const sharedRate = rows[0]?.res?.totals?.futureIRARate ?? 0;
    for (const r of rows) {
        const w = r.flagged ? null : scoreOf(r.res, sharedRate);
        r.score = w == null ? null : w + SPENDABLE_WEIGHT * (r.res.totals.spendCurrentDollars ?? 0);
        r.wealthScore = w;
    }
    return { rows, sharedRate };
}

// ── ARM A: the oracle's own search, re-run here (identical to oracle_harness.js) ─────────────
function conversionsOracle(cellBase, overrides, sharedRate, horizon, seeds, baseSpend) {
    const evalVec = vec => scoreOf(runSim({ ...cellBase, ...overrides, extraConversionAmount: vec }),
        sharedRate, baseSpend);
    let best = null, bestVec = null, bestSeed = null;
    for (const [seedName, seed] of seeds) {
        let vec = seed.slice(0, horizon);
        while (vec.length < horizon) vec.push(0);
        let cur = evalVec(vec);
        if (cur == null) { vec = new Array(horizon).fill(0); cur = evalVec(vec); }
        if (cur == null) continue;
        for (let pass = 0; pass < 6; pass++) {
            let improved = 0;
            for (let y = 0; y < horizon; y++) {
                let bestAmt = vec[y], bestSc = cur;
                for (let amt = 0; amt <= 400000; amt += 25000) {
                    if (amt === vec[y]) continue;
                    const v2 = vec.slice(); v2[y] = amt;
                    const sc = evalVec(v2);
                    if (sc != null && sc > bestSc + 0.01) { bestSc = sc; bestAmt = amt; }
                }
                for (const amt of [bestAmt - 20000, bestAmt - 15000, bestAmt - 10000, bestAmt - 5000,
                                   bestAmt + 5000, bestAmt + 10000, bestAmt + 15000, bestAmt + 20000]) {
                    if (amt < 0) continue;
                    const v2 = vec.slice(); v2[y] = amt;
                    const sc = evalVec(v2);
                    if (sc != null && sc > bestSc + 0.01) { bestSc = sc; bestAmt = amt; }
                }
                if (bestAmt !== vec[y]) { improved += bestSc - cur; vec[y] = bestAmt; cur = bestSc; }
            }
            if (improved < 1) break;
        }
        if (best == null || cur > best) { best = cur; bestVec = vec; bestSeed = seedName; }
    }
    return { score: best, vec: bestVec, seed: bestSeed };
}

// ── ARM B: the cross-check. Random restarts + block moves, $1k granularity, fixed sim budget ──
function makeRng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const MAX_CONV = 400000;
const clampAmt = a => Math.max(0, Math.min(MAX_CONV, Math.round(a / 1000) * 1000));

function stochasticSearch(cellBase, overrides, sharedRate, horizon, seeds, baseSpend, budget, rngSeed) {
    const rng = makeRng(rngSeed);
    let used = 0;
    const evalVec = vec => {
        used++;
        return scoreOf(runSim({ ...cellBase, ...overrides, extraConversionAmount: vec }),
            sharedRate, baseSpend);
    };
    const pick = n => Math.floor(rng() * n);

    // A restart point: the three fixed seeds first, then random sparse vectors. Sparsity matters --
    // the descent's own winners put conversions in a handful of years, so a dense random vector is
    // a poor start and a uniformly sparse one is a fair sample of the same neighborhood shape.
    let restartIdx = 0;
    const nextStart = () => {
        if (restartIdx < seeds.length) {
            const s = seeds[restartIdx++][1].slice(0, horizon);
            while (s.length < horizon) s.push(0);
            return s.map(clampAmt);
        }
        restartIdx++;
        const v = new Array(horizon).fill(0);
        const density = 0.1 + rng() * 0.5;
        const scale = 25000 + rng() * 175000;
        for (let y = 0; y < horizon; y++) if (rng() < density) v[y] = clampAmt(rng() * scale);
        return v;
    };

    // Move set. Every move but `jump` touches more than one year, which is the whole point:
    // coordinate descent cannot cross a ridge that needs two years to move together.
    const MOVES = ['jump', 'block', 'shift', 'scale', 'swap', 'nudge'];
    const mutate = vec => {
        const v = vec.slice();
        const m = MOVES[pick(MOVES.length)];
        if (m === 'jump') {
            v[pick(horizon)] = clampAmt(rng() * MAX_CONV);
        } else if (m === 'block') {
            const a = pick(horizon), b = Math.min(horizon - 1, a + pick(6));
            const d = (rng() < 0.5 ? -1 : 1) * (1000 + rng() * 60000);
            for (let y = a; y <= b; y++) v[y] = clampAmt(v[y] + d);
        } else if (m === 'shift') {
            const a = pick(horizon), b = pick(horizon);
            if (a !== b && v[a] > 0) {
                const amt = clampAmt(v[a] * (0.25 + rng() * 0.75));
                v[a] = clampAmt(v[a] - amt); v[b] = clampAmt(v[b] + amt);
            }
        } else if (m === 'scale') {
            const f = 0.4 + rng() * 1.4;
            for (let y = 0; y < horizon; y++) v[y] = clampAmt(v[y] * f);
        } else if (m === 'swap') {
            const a = pick(horizon), b = pick(horizon);
            const t = v[a]; v[a] = v[b]; v[b] = t;
        } else {
            const y = pick(horizon);
            v[y] = clampAmt(v[y] + (rng() < 0.5 ? -1 : 1) * (1000 + rng() * 9000));
        }
        return v;
    };

    let best = null, bestVec = null;
    // Restarts are budget-sliced, not counted: a cell with a tiny descent budget still gets several
    // starts, and a fat one gets deeper climbs rather than more shallow ones.
    const perRestart = Math.max(40, Math.floor(budget / 8));
    while (used < budget) {
        let vec = nextStart();
        let cur = evalVec(vec);
        if (cur == null) { vec = new Array(horizon).fill(0); cur = evalVec(vec); }
        if (cur == null) continue;
        let sinceGain = 0;
        const stopAt = Math.min(budget, used + perRestart);
        while (used < stopAt && sinceGain < 60) {
            const v2 = mutate(vec);
            const sc = evalVec(v2);
            if (sc != null && sc > cur + 0.01) { cur = sc; vec = v2; sinceGain = 0; }
            else sinceGain++;
        }
        if (best == null || cur > best) { best = cur; bestVec = vec; }
    }
    return { score: best, vec: bestVec, sims: used, restarts: restartIdx };
}

// ── Main ────────────────────────────────────────────────────────────────────────────────────
console.log('P51d / P103a  independent search cross-check of the perfect-foresight oracle');
console.log('Arm A = the oracle\'s cyclic coordinate descent ($25k grid + $5k refine, 3 fixed seeds).');
console.log('Arm B = random-restart stochastic search, block/shift/scale/swap moves, $1k grain,');
console.log('        handed the SAME sim count Arm A spent on that cell' +
    (BUDGET_MULT !== 1 ? ' x' + BUDGET_MULT : '') + '.');
console.log('Both share the objective, the spend pin, the grid and the champion selection.\n');

const t0 = Date.now();
const cells = [];
for (const mix of MIXES) {
    for (const basis of BASIS_ARMS) {
        const over = { ...mix.over };
        if (basis != null) over.BrokerageBasis = Math.round(over.Brokerage * basis);
        for (const sr of SPEND_RATES) {
            const label = mix.key + ' @' + (sr * 100) + '%' + (basis != null ? ' b' + (basis * 100) : '');
            if (CELL_MODE !== 'all' && !NAMED.includes(label)) continue;
            const cellBase = { ...COMMON, ...over, spendGoal: Math.round(totalAssets(over) * sr) };
            const { rows, sharedRate } = evalArms(cellBase);
            const eligible = rows.filter(r => r.score != null);
            if (!eligible.length) { console.log(label + ': no eligible arm survives, cell skipped'); continue; }
            const champ = eligible.reduce((a, b) => b.score > a.score ? b : a);
            cells.push({ label, mix: mix.key, sr, basis, cellBase, sharedRate, champ });
        }
    }
}
console.log(cells.length + ' cells prepared, ' + SIMS + ' sims, ' +
    ((Date.now() - t0) / 1000).toFixed(1) + 's\n');

console.log('cell                 base score    A descent    B stochastic   B-A         B-A %    A sims  B sims  restarts');
const results = [];
for (const cell of cells) {
    const ov = cell.champ.f.overrides;
    const horizon = cell.champ.res.log.length;
    const baseScore = cell.champ.wealthScore;
    const baseSpend = cell.champ.res.totals.spendCurrentDollars ?? 0;

    let scalarAmt = 0;
    try {
        const o = optimizeConversionAmount(cell.cellBase, ov, 'baselineScore',
            { futureIRARate: cell.sharedRate });
        if (o && o.optConv > 0) scalarAmt = o.optConv;
    } catch (e) { /* seed stays 0 */ }
    const champConv = cell.champ.res.log.map(e => Math.round((e.rothConv || 0) / 5000) * 5000);
    const seeds = [
        ['zero', new Array(horizon).fill(0)],
        ['flat', new Array(horizon).fill(scalarAmt)],
        ['replay', champConv],
    ];

    const simsBefore = SIMS;
    const a = conversionsOracle(cell.cellBase, ov, cell.sharedRate, horizon, seeds, baseSpend);
    const aSims = SIMS - simsBefore;
    const aScore = Math.max(a.score ?? -Infinity, baseScore);

    const budget = Math.max(200, Math.round(aSims * BUDGET_MULT));
    const b = stochasticSearch(cell.cellBase, ov, cell.sharedRate, horizon, seeds, baseSpend,
        budget, 0x51d0 + cells.indexOf(cell));
    const bScore = Math.max(b.score ?? -Infinity, baseScore);

    const delta = bScore - aScore;
    console.log(cell.label.padEnd(21) + money(baseScore).padStart(12) +
        money(aScore - baseScore).padStart(13) + money(bScore - baseScore).padStart(14) +
        money(delta).padStart(12) +
        ((100 * delta / Math.max(1, aScore)).toFixed(3) + '%').padStart(10) +
        String(aSims).padStart(8) + String(b.sims).padStart(8) + String(b.restarts).padStart(10));
    results.push({ cell, baseScore, aScore, bScore, aVec: a.vec, bVec: b.vec, aSims, bSims: b.sims });
}

console.log('\n' + '='.repeat(100));
console.log('PREDICTION SCORING  (X-P1..X-P3, recorded before the run)');
console.log('='.repeat(100));
const relOf = r => (r.bScore - r.aScore) / Math.max(1, r.aScore);
const rels = results.map(relOf);
const under1 = rels.filter(g => g < 0.01).length;
console.log('X-P1  stochastic beats descent by < 1% in most cells: ' + under1 + '/' + rels.length +
    ' -> ' + (under1 >= Math.ceil(rels.length / 2) ? 'RIGHT' : 'WRONG'));
const maxRel = Math.max(...rels), medRel = rels.slice().sort((x, y) => x - y)[Math.floor(rels.length / 2)];
console.log('      max residual ' + (100 * maxRel).toFixed(3) + '%, median ' +
    (100 * medRel).toFixed(3) + '%');
const byPrize = results.slice().sort((x, y) => (y.aScore - y.baseScore) - (x.aScore - x.baseScore));
console.log('X-P2  ordered by the descent\'s own gain (largest prize first):');
for (const r of byPrize) {
    console.log('      ' + r.cell.label.padEnd(20) + 'descent gain ' + money(r.aScore - r.baseScore).padStart(12) +
        '   residual ' + (100 * relOf(r)).toFixed(3) + '%');
}
console.log('\nSO WHAT: the residual is the size of the words "lower bound" in');
console.log('PERFECT_FORESIGHT_ORACLE.md. Every published gap-to-oracle is understated by at least');
console.log('this much, on the conversion axis alone. The withdrawal-split axis is NOT cross-checked');
console.log('here -- it needs the oracleWithdrawalPlan hook and a menu of its own.');
console.log('\nTotal ' + SIMS + ' sims, ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
