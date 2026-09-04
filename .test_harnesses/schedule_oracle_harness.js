'use strict';
/**
 * schedule_oracle_harness.js -- P103b4. Does the wider representation raise the ceiling?
 *
 * Run:  node .test_harnesses/schedule_oracle_harness.js
 *       node .test_harnesses/schedule_oracle_harness.js --cells all
 *
 * THE QUESTION, and it is the one P103 was opened to answer. The oracle's conversion axis is
 * `extraConversionAmount[]`, which is EXTRA ON TOP of whatever the base arm's own rule decided. It
 * can convert more than the rule; it can never convert less, because the rule's own ceiling is not a
 * variable. `strategy: 'schedule'` (P103b2/b3) makes that ceiling a per-year number, so the search
 * can lower it as well as raise it. **Is the missing direction worth anything?**
 *
 * Both arms are handed the SAME non-cyclic base row and the SAME measured sim budget, and both are
 * scored by the same objective with the same spend pin, so the difference is the representation and
 * nothing else.
 *
 *   Arm A  today's oracle: per-year extraConversionAmount, $25k grid + $5k refinement, 3 seeds.
 *   Arm S  the schedule: per-year ordTarget (or iraDraw, whichever the base compiles to), searched
 *          multiplicatively around the compiled value so it can go DOWN as well as up.
 *
 * WHY THE BASE IS "THE BEST ROW THE SCHEDULE CAN CARRY". Two constraints, both learned the hard way.
 * A cyclic row refuses to compose with either research input by design (both throw). And a row whose
 * family the schedule cannot express - Ordered, Proportional, Guyton-Klinger, per P103b3 - compiles
 * to an EMPTY plan, which funds no spending, fails the pin, and scores null. The first version of
 * this harness took the best non-cyclic row regardless, and five of seven cells duly reported Arm S
 * spending one simulation and losing by the whole conversion gain. That was the b3 coverage boundary
 * being re-measured, not an answer to the question. So the base is now the best-scoring row whose
 * compiled schedule REPLAYS IT EXACTLY, verified per cell before either arm runs.
 *
 * SPEND IS PINNED, exactly as in oracle_harness.js, and P103b5 is where that stops being true.
 * Every number here is therefore "more wealth at the same delivered spend". A strategy that would
 * buy MORE spending is invisible to this harness by construction.
 *
 * ── PREDICTION UNDER TEST (S-P1), recorded BEFORE the numbers were looked at ─────────────────
 *   S-P1. Arm S beats Arm A in most cells, because the ability to LOWER a year's ceiling is a
 *         direction the conversion axis has never been able to express, and P103a found conversion
 *         timing worth up to 13.5% at 20% basis. Expected size: same order as the conversion-only
 *         gains, low single-digit percent.
 * Scored at the end of the run.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
Object.assign(globalThis, require('../taxengine.js'));
const core = require('../optimizer_core.js');
const {
    simulate, afterTaxNetWorth, SPENDABLE_WEIGHT, optimizeConversionAmount,
    buildStrategyFamilies, OPTIMIZER_GRIDS, bothOnMedicareAtStart,
    compileScheduleFromRun, scheduleOptionsForRun,
} = core;

const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString();
const argv = process.argv.slice(2);
const CELL_MODE = argv.includes('--cells') ? argv[argv.indexOf('--cells') + 1] : 'named';

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
const NAMED = ['defaults @4%', 'defaults @6%', 'defaults3x @4%', 'defaults3x @8% b20',
               'round1 @4%', 'thirds @4%', 'brokheavy @4%'];
const totalAssets = o => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;

let SIMS = 0;
const runSim = i => { SIMS++; return simulate(i); };

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
function evalArms(cellBase) {
    const acaDisabled = bothOnMedicareAtStart(cellBase.birthyear1, cellBase.startAge,
        !!cellBase.hasSpouse, cellBase.hasSpouse ? (cellBase.birthyear2 || 0) : 0);
    const rows = [];
    for (const f of buildStrategyFamilies(cellBase, {
        grids: OPTIMIZER_GRIDS, irmaaFamily: true, acaFamily: !acaDisabled,
        bracketResetsIRMAATier: true, markCashFunding: true,
        cashClones: cellBase.Cash > 0, offGridLast: true })) {
        let res; try { res = runSim({ ...cellBase, ...f.overrides }); } catch (e) { continue; }
        const ovY = res.log.filter(e => (e['BracketOverage'] ?? 0) > 0).length;
        const flagged = (f.overrides.strategy === 'bracket' && res.log.length > 0 && ovY / res.log.length > 0.5)
            || (f.overrides.strategy === 'aca' && (res.totals?.acaBreachYears ?? 0) > 0);
        rows.push({ f, res, flagged });
    }
    const sharedRate = rows[0]?.res?.totals?.futureIRARate ?? 0;
    for (const r of rows) {
        const w = r.flagged ? null : scoreOf(r.res, sharedRate);
        r.wealthScore = w;
        r.score = w == null ? null : w + SPENDABLE_WEIGHT * (r.res.totals.spendCurrentDollars ?? 0);
    }
    return { rows, sharedRate };
}

// ── ARM A: today's oracle, the conversions-only descent (oracle_harness.js verbatim) ─────────
function conversionsOracle(cellBase, ov, sharedRate, horizon, seeds, baseSpend) {
    const evalVec = v => scoreOf(runSim({ ...cellBase, ...ov, extraConversionAmount: v }), sharedRate, baseSpend);
    let best = null;
    for (const [, seed] of seeds) {
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
        if (best == null || cur > best) best = cur;
    }
    return best;
}

// ── ARM S: the schedule. Same descent SHAPE, a different decision variable ───────────────────
// Multiplicative candidates so the search is scale-free across a $400k ceiling and a $40k draw,
// and so it can go DOWN - the direction extraConversionAmount cannot express at all.
const MULT = [0.4, 0.6, 0.75, 0.85, 0.95, 1.05, 1.15, 1.3, 1.6, 2.0];
function scheduleOracle(cellBase, ov, sharedRate, plan, opts, baseSpend, budget) {
    let used = 0;
    const evalPlan = p => {
        used++;
        return scoreOf(runSim({ ...cellBase, ...ov, strategy: 'schedule', schedulePlan: p, ...opts,
            stratRate: undefined, stratIRMAATier: undefined, stratACAMultiple: undefined }),
            sharedRate, baseSpend);
    };
    const keyOf = e => (e == null ? null : (e.ordTarget !== undefined ? 'ordTarget' : 'iraDraw'));
    let cur = plan.map(e => (e ? { ...e } : null));
    let score = evalPlan(cur);
    if (score == null) return { score: null, sims: used };
    for (let pass = 0; pass < 6 && used < budget; pass++) {
        let improved = 0;
        for (let y = 0; y < cur.length && used < budget; y++) {
            const k = keyOf(cur[y]);
            if (!k) continue;
            const base = cur[y][k];
            if (!(base > 0)) continue;
            let bestVal = base, bestSc = score;
            for (const m of MULT) {
                const cand = cur.slice();
                cand[y] = { ...cur[y], [k]: Math.round(base * m) };
                const sc = evalPlan(cand);
                if (sc != null && sc > bestSc + 0.01) { bestSc = sc; bestVal = cand[y][k]; }
                if (used >= budget) break;
            }
            if (bestVal !== base) { improved += bestSc - score; cur[y] = { ...cur[y], [k]: bestVal }; score = bestSc; }
        }
        if (improved < 1) break;
    }
    return { score, sims: used };
}

// ── Main ────────────────────────────────────────────────────────────────────────────────────
console.log('P103b4  does the schedule representation raise the ceiling the oracle can reach?');
console.log('Arm A = per-year extraConversionAmount (EXTRA on top of the base rule; cannot go down).');
console.log('Arm S = per-year ordTarget/iraDraw on the same base, searched multiplicatively so it CAN.');
console.log('Same base row, same objective, same spend pin, same measured sim budget.\n');

const t0 = Date.now();
const cells = [];
for (const mix of MIXES) for (const basis of BASIS_ARMS) {
    const over = { ...mix.over };
    if (basis != null) over.BrokerageBasis = Math.round(over.Brokerage * basis);
    for (const sr of SPEND_RATES) {
        const label = mix.key + ' @' + (sr * 100) + '%' + (basis != null ? ' b' + (basis * 100) : '');
        if (CELL_MODE !== 'all' && !NAMED.includes(label)) continue;
        const cellBase = { ...COMMON, ...over, spendGoal: Math.round(totalAssets(over) * sr) };
        const { rows, sharedRate } = evalArms(cellBase);
        const ok = rows.filter(r => r.score != null && !r.f.overrides.cyclicEnabled)
                       .sort((a, b) => b.score - a.score);
        // Take the best row the schedule can actually carry, verified rather than assumed.
        let base = null, tried = 0;
        for (const r of ok) {
            tried++;
            const src = { ...cellBase, ...r.f.overrides };
            const plan = compileScheduleFromRun(r.res, src);
            if (!plan.some(Boolean)) continue;                 // family the schedule cannot express
            let rep;
            try {
                rep = runSim({ ...src, strategy: 'schedule', schedulePlan: plan,
                    ...scheduleOptionsForRun(src),
                    stratRate: undefined, stratIRMAATier: undefined, stratACAMultiple: undefined });
            } catch (e) { continue; }
            const repScore = scoreOf(rep, sharedRate);
            if (repScore != null && Math.abs(repScore - r.wealthScore) < 0.01) { base = r; break; }
        }
        if (!base) { console.log(label + ': no row the schedule can carry (' + tried + ' tried), skipped'); continue; }
        cells.push({ label, cellBase, sharedRate, base, rank: tried });
    }
}
console.log(cells.length + ' cells prepared, ' + SIMS + ' sims, ' + ((Date.now() - t0) / 1000).toFixed(1) + 's\n');
console.log('cell                 base row (#=rank among rows)     base score     A conv    S schedule     S-A      S-A %   sims A/S');

const results = [];
for (const cell of cells) {
    const ov = cell.base.f.overrides;
    const horizon = cell.base.res.log.length;
    const baseScore = cell.base.wealthScore;
    const baseSpend = cell.base.res.totals.spendCurrentDollars ?? 0;

    let scalarAmt = 0;
    try {
        const o = optimizeConversionAmount(cell.cellBase, ov, 'baselineScore', { futureIRARate: cell.sharedRate });
        if (o && o.optConv > 0) scalarAmt = o.optConv;
    } catch (e) { /* seed stays 0 */ }
    const seeds = [
        ['zero', new Array(horizon).fill(0)],
        ['flat', new Array(horizon).fill(scalarAmt)],
        ['replay', cell.base.res.log.map(e => Math.round((e.rothConv || 0) / 5000) * 5000)],
    ];

    const s0 = SIMS;
    const aScore = Math.max(conversionsOracle(cell.cellBase, ov, cell.sharedRate, horizon, seeds, baseSpend) ?? -Infinity, baseScore);
    const aSims = SIMS - s0;

    const srcInputs = { ...cell.cellBase, ...ov };
    const plan = compileScheduleFromRun(cell.base.res, srcInputs);
    const opts = scheduleOptionsForRun(srcInputs);
    const s = scheduleOracle(cell.cellBase, ov, cell.sharedRate, plan, opts, baseSpend, aSims);
    const sScore = Math.max(s.score ?? -Infinity, baseScore);

    const d = sScore - aScore;
    console.log(cell.label.padEnd(21) +
        ((cell.base.f.family + ' ' + cell.base.f.paramLabel).slice(0, 28) + ' #' + cell.rank).padEnd(33) +
        money(baseScore).padStart(12) + money(aScore - baseScore).padStart(11) +
        money(sScore - baseScore).padStart(13) + money(d).padStart(11) +
        ((100 * d / Math.max(1, aScore)).toFixed(3) + '%').padStart(10) +
        ('  ' + aSims + '/' + s.sims).padStart(12));
    results.push({ cell, baseScore, aScore, sScore, d });
}

console.log('\n' + '='.repeat(100));
console.log('PREDICTION SCORING  (S-P1, recorded before the run)');
console.log('='.repeat(100));
const wins = results.filter(r => r.d > 1).length;
const rel = results.map(r => r.d / Math.max(1, r.aScore));
const maxRel = rel.length ? Math.max(...rel) : 0;
console.log('Arm S beats Arm A in ' + wins + '/' + results.length + ' cells; max advantage ' +
    (100 * maxRel).toFixed(3) + '%');
console.log('S-P1 (S wins in most cells, low single-digit percent) -> ' +
    (wins > results.length / 2 ? 'RIGHT' : 'WRONG'));
console.log('\nSPEND IS PINNED. Every number is more wealth at the SAME delivered spend; a strategy');
console.log('that would buy more SPENDING is invisible here by construction (P103b5).');
console.log('\nTotal ' + SIMS + ' sims, ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
