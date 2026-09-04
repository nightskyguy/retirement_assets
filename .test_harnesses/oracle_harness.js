'use strict';
/**
 * oracle_harness.js -- P51. Perfect-foresight trajectory oracle (research, node-only).
 *
 * Run:  node .test_harnesses/oracle_harness.js            (P51a: conversions-only)
 *       node .test_harnesses/oracle_harness.js --full     (adds P51c: withdrawal-split oracle;
 *                                                          needs the P51b engine hook)
 *       node .test_harnesses/oracle_harness.js --reserve0 (arms CashReserve = 0, so EVERY arm banks
 *                                                          its surplus in Brokerage; combinable with
 *                                                          --full)
 *       node .test_harnesses/oracle_harness.js --spendchange -1   (spend declines 1%/yr in real terms)
 *
 * WHY --spendchange EXISTS (P103b5c, 2026-09-01, user). Every cell in this study is run at
 * spendChange: 0, a FLAT real spend path, and that is not what a typical plan looks like - the
 * user's own plans decline around 1% a year. "Spend is pinned" (candidates delivering a different
 * spend are discarded) is a comparison rule and is real; "spend is flat" was a fixture choice
 * nobody chose deliberately. Opt-in, so a bare run still reproduces the published tables.
 *
 * WHY --reserve0 EXISTS (P103b, 2026-09-01). The published grid leaves CashReserve unset, which is
 * the legacy all-surplus-to-Cash default. Cyclic rows bank their surplus in Brokerage instead, and
 * an Ordered brokerage-first sequence does too, so the default grid compares strategies that differ
 * in WHERE surplus lands as well as in how it is drawn. That confound is the whole reason a cyclic
 * row beats the "ceiling" in defaults @6%. With --reserve0 every arm banks in Brokerage
 * (optimizer_core.js: CashReserve != null -> overflow above the buffer is reinvested, and a buffer
 * of 0 means all of it), which isolates draw order from surplus routing. Opt-in, so a bare run still
 * reproduces PERFECT_FORESIGHT_ORACLE.md exactly.
 *
 * WHAT THIS IS: an UPPER-BOUND DIAGNOSTIC. The optimizer sees the whole deterministic return
 * path in advance, so its result is a perfect-foresight ceiling -- NOT a shippable policy. It
 * overfits the known path by construction. Its use is the GAP: how far each shipped family's
 * best row sits below the ceiling, and how much of that gap is conversion timing vs withdrawal
 * split. No pattern read off an oracle trajectory ships without the repo's axis-property +
 * pinned-test bar.
 *
 * P51a -- conversions-only, ZERO engine change: the decision vector is extraConversionAmount[]
 * (per-year array, optimizer_core.js reads it whenever the input is an array). Cyclic
 * coordinate descent, per-year LINEAR scans (never binary -- bracket/IRMAA step functions make
 * every axis non-unimodal), $25k grid then $5k refinement, full passes until a pass improves
 * < $1, three seeds: all-zero / flat scalar winner / the champion's own realized conversions.
 * NOTE the axis is EXTRA conversions ON TOP of the champion arm's native conversion behavior
 * (bracket fill, convertExcessToRoth); it is "how much better could this plan's conversions
 * be", not total-conversion control.
 *
 * RULES (binding, from the plan):
 *  - Spend is PINNED: any candidate with totals.success false or shortfall > $1 is DISCARDED.
 *    The objective is wealth-only at a shared per-cell heirs rate (real dollars), which equals
 *    baselineScore ranking when spend is constant.
 *  - Backstops are instrumented, not bypassed: accepted solutions report forced-IRA activity.
 *  - Sequential node only (module globals STATEname/simulationCount forbid workers).
 *
 * ── PREDICTION UNDER TEST (S3-P1), recorded BEFORE the numbers were looked at ────────────────
 *   S3-P1. The conversions-only oracle beats the best FLAT scalar conversion by <3% of real
 *          after-tax NW in most cells; the win concentrates in the pre-SS/pre-RMD window
 *          (timing, not total volume).
 * Scored at the end of the run.
 */

// ── Bootstrap the engine exactly like brokerage_harness.js / optimizer_core.tests.js ────────
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
const FULL = process.argv.includes('--full');
const RESERVE0 = process.argv.includes('--reserve0');
const _scIdx = process.argv.indexOf('--spendchange');
const SPENDCHANGE = _scIdx >= 0 ? Number(process.argv[_scIdx + 1]) / 100 : null;

// ── Grid: the Stage-1 ladder at wealth x1 only (15 cells) ───────────────────────────────────
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
// P103b: arm the reserve so surplus routing is identical across every arm. Mutating COMMON before
// any cell is built is deliberate - the flag must reach the champion selection too, not just the
// oracle, or the two halves would disagree about which plan they are optimizing.
if (RESERVE0) COMMON.CashReserve = 0;
// P103b5c: a real-terms spend trajectory. Applied to COMMON before any cell is built, for the
// same reason --reserve0 is: it has to reach champion selection too, not only the oracle.
if (SPENDCHANGE != null) {
    if (!Number.isFinite(SPENDCHANGE)) throw new Error('--spendchange needs a number, e.g. --spendchange -1');
    COMMON.spendChange = SPENDCHANGE;
}
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
const totalAssets = o => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;

let SIMS = 0;
function runSim(inputs) { SIMS++; return simulate(inputs); }

// Wealth-only objective at the cell's shared rate; null when the candidate is infeasible.
// baseSpend (when given) PINS delivered spend: a candidate whose spendCurrentDollars moves more
// than $1 from the base is discarded. Without the pin, a spend-adaptive base (GK guardrails)
// lets the oracle "win" by inducing spending cuts -- the first run showed +81% on a GK champion
// that was entirely spend-shifting, the exact (spend, wealth) pair violation the rules name.
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

// ── Champion + family-best selection (Stage-1 rules: success, unflagged) ────────────────────
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
    // Champion selection uses the Stage-1 objective (baselineScore = wealth + spendable-weighted
    // spend) so a spend-cutting arm cannot buy the champion slot with a wealth-only score.
    for (const r of rows) {
        const w = r.flagged ? null : scoreOf(r.res, sharedRate);
        r.score = w == null ? null : w + SPENDABLE_WEIGHT * (r.res.totals.spendCurrentDollars ?? 0);
        r.wealthScore = w;
    }
    return { rows, sharedRate };
}

// ── P51a: cyclic coordinate descent over extraConversionAmount[] ────────────────────────────
function conversionsOracle(cellBase, overrides, sharedRate, horizon, seeds, baseSpend) {
    const evalVec = vec => scoreOf(runSim({ ...cellBase, ...overrides, extraConversionAmount: vec }),
        sharedRate, baseSpend);
    let best = null, bestVec = null, bestSeed = null, passesUsed = 0;
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
                // $5k refinement around the coarse winner
                for (const amt of [bestAmt - 20000, bestAmt - 15000, bestAmt - 10000, bestAmt - 5000,
                                   bestAmt + 5000, bestAmt + 10000, bestAmt + 15000, bestAmt + 20000]) {
                    if (amt < 0) continue;
                    const v2 = vec.slice(); v2[y] = amt;
                    const sc = evalVec(v2);
                    if (sc != null && sc > bestSc + 0.01) { bestSc = sc; bestAmt = amt; }
                }
                if (bestAmt !== vec[y]) { improved += bestSc - cur; vec[y] = bestAmt; cur = bestSc; }
            }
            passesUsed++;
            if (improved < 1) break;
        }
        if (best == null || cur > best) { best = cur; bestVec = vec; bestSeed = seedName; }
    }
    return { score: best, vec: bestVec, seed: bestSeed, passes: passesUsed };
}

// ── Main ────────────────────────────────────────────────────────────────────────────────────
console.log('P51 oracle harness -- ' + (FULL ? 'FULL (P51a + P51c)' : 'P51a conversions-only') +
    (RESERVE0 ? '  [--reserve0: CashReserve = 0, every arm banks surplus in Brokerage]' : '') +
    (SPENDCHANGE != null ? '  [--spendchange ' + (SPENDCHANGE * 100).toFixed(1) + '%/yr real]' : ''));
console.log('45 cells (5 mixes x spend 4/6/8% x basis default/20%/80%, wealth x1). Objective: wealth-only at the cell\'s');
console.log('shared heirs rate, spend pinned (shortfall > $1 discarded). Upper-bound diagnostic;');
console.log('never a shippable policy.\n');

// Basis axis (2026-08-10, user request): null = the mix's own basis fraction (43-56%);
// 0.2 = highly appreciated; 0.8 = mostly contributions. Default-arm labels are unchanged so
// published numbers stay comparable.
const BASIS_ARMS = [null, 0.2, 0.8];
const t0 = Date.now();
const cells = [];
for (const mix of MIXES) {
    for (const basis of BASIS_ARMS) {
        const over = { ...mix.over };
        if (basis != null) over.BrokerageBasis = Math.round(over.Brokerage * basis);
        for (const sr of SPEND_RATES) {
            const cellBase = { ...COMMON, ...over, spendGoal: Math.round(totalAssets(over) * sr) };
            const { rows, sharedRate } = evalArms(cellBase);
            const eligible = rows.filter(r => r.score != null);
            const label = mix.key + ' @' + (sr * 100) + '%' + (basis != null ? ' b' + (basis * 100) : '');
            if (!eligible.length) {
                console.log(label + ': no eligible arm survives, cell skipped');
                continue;
            }
            const champ = eligible.reduce((a, b) => b.score > a.score ? b : a);
            cells.push({ label, mix: mix.key, sr, basis, cellBase, sharedRate, rows, champ });
        }
    }
}
console.log(cells.length + ' cells prepared, ' + SIMS + ' sims, ' +
    ((Date.now() - t0) / 1000).toFixed(1) + 's\n');

console.log('P51a  conversions-only oracle vs the champion row and the best flat scalar:');
console.log('cell                 champion arm                    base score   +flat scalar   +oracle      oracle gain  seed        convYrs');
const results = [];
for (const cell of cells) {
    const ov = cell.champ.f.overrides;
    const horizon = cell.champ.res.log.length;
    const baseScore = cell.champ.wealthScore;                      // wealth-only; spend is pinned below
    const baseSpend = cell.champ.res.totals.spendCurrentDollars ?? 0;
    // Best flat scalar on the same base (core's own $25k grid search, baselineScore objective),
    // re-scored under the spend pin so a spend-shifting scalar cannot slip in.
    let scalarScore = baseScore, scalarAmt = 0;
    try {
        const o = optimizeConversionAmount(cell.cellBase, ov, 'baselineScore',
            { futureIRARate: cell.sharedRate });
        if (o && o.optConv > 0) {
            const sc = scoreOf(runSim({ ...cell.cellBase, ...ov, extraConversionAmount: o.optConv }),
                cell.sharedRate, baseSpend);
            if (sc != null && sc > scalarScore) { scalarScore = sc; scalarAmt = o.optConv; }
        }
    } catch (e) { /* scalar stays at base */ }
    // Seeds: all-zero; the flat scalar winner; the champion's own realized conversions.
    const champConv = cell.champ.res.log.map(e => Math.round((e.rothConv || 0) / 5000) * 5000);
    const seeds = [
        ['zero', new Array(horizon).fill(0)],
        ['flat', new Array(horizon).fill(scalarAmt)],
        ['replay', champConv],
    ];
    const t1 = Date.now();
    const o = conversionsOracle(cell.cellBase, ov, cell.sharedRate, horizon, seeds, baseSpend);
    const oracleScore = Math.max(o.score ?? -Infinity, baseScore);
    const convYears = (o.vec || []).filter(a => a > 0).length;
    const label = cell.champ.f.family + ' ' + cell.champ.f.paramLabel +
        (cell.champ.f.modifier ? ' [' + cell.champ.f.modifier + ']' : '');
    console.log(cell.label.padEnd(21) + label.padEnd(32) +
        money(baseScore).padStart(11) + money(scalarScore - baseScore).padStart(13) +
        money(oracleScore - baseScore).padStart(13) +
        ((100 * (oracleScore - scalarScore) / Math.max(1, scalarScore)).toFixed(2) + '%').padStart(12) +
        ('  ' + (o.seed ?? '-')).padEnd(12) + String(convYears).padStart(5) +
        '   (' + ((Date.now() - t1) / 1000).toFixed(1) + 's)');
    results.push({ cell, baseScore, scalarScore, oracleScore, vec: o.vec, seed: o.seed });
}

// Where do the oracle's conversions sit? (S3-P1's timing claim)
console.log('\nOracle conversion timing (years with conv > 0, index from plan start; SS starts ~yr 4-6, RMDs ~yr 11):');
for (const r of results) {
    const yrs = (r.vec || []).map((a, i) => a > 0 ? i : -1).filter(i => i >= 0);
    console.log('  ' + r.cell.label.padEnd(21) +
        (yrs.length ? yrs.join(',') : '(none)'));
}

console.log('\n' + '='.repeat(100));
console.log('PREDICTION SCORING  (S3-P1, recorded before the run)');
console.log('='.repeat(100));
// S3-P1 is scored on the DEFAULT-basis arm only (the published form); basis arms reported after.
const gapOf = r => (r.oracleScore - r.scalarScore) / Math.max(1, r.scalarScore);
const gapsD = results.filter(r => r.cell.basis == null).map(gapOf);
const under3 = gapsD.filter(g => g < 0.03).length;
console.log('S3-P1 oracle beats best flat scalar by <3% in most cells (default basis): ' + under3 +
    '/' + gapsD.length + ' under 3% -> ' + (under3 > gapsD.length / 2 ? 'RIGHT' : 'WRONG') +
    ';  max ' + (100 * Math.max(...gapsD, 0)).toFixed(2) + '%');
for (const b of [0.2, 0.8]) {
    const gs = results.filter(r => r.cell.basis === b).map(gapOf);
    if (gs.length) console.log('  conv-only gain at basis ' + (b * 100) + '%: max ' +
        (100 * Math.max(...gs, 0)).toFixed(2) + '%, cells under 3%: ' +
        gs.filter(g => g < 0.03).length + '/' + gs.length);
}
console.log('\nTotal: ' + SIMS + ' sims, ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log('\nCEILINGS: perfect foresight on one deterministic path; aggregate basis (no lots);');
console.log('one-sided ACA; no SECURE 10-yr heirs; IRC 1014 step-up at terminal row; CA only.');
console.log('The oracle result is a ceiling for THIS path, not advice.');

// ════════════════════════════════════════════════════════════════════════════════════════════
// P51c-g -- full oracle: per-year withdrawal-split archetypes + interleaved conversions.
// Requires the P51b engine hook (oracleWithdrawalPlan).
// ════════════════════════════════════════════════════════════════════════════════════════════
if (FULL) {
    // ── PREDICTIONS (S3-P2..P4), recorded before the numbers were looked at ─────────────────
    //   S3-P2. Median gap-to-oracle of each cell's best family row < 4% of oracle real
    //          after-tax NW. Propwd's own gap is smallest in 8%-spend cells; bracket-family's
    //          smallest in unconstrained cells (the user's gut predicted PARTIALLY right:
    //          propwd robust, not uniformly optimal).
    //   S3-P3. Oracle trajectories show harvest-like alternation (Brokerage-dominant years
    //          alternating with IRA-dominant years) in thirds/brokheavy mixes.
    //   S3-P4. Accepted oracle solutions have ~zero backstop activity (ForcedIRA > $1 in
    //          <5% of years).
    const ARCH = [
        ['family', null],                                   // no override: the arm's own branch
        ['IRA',    { IRA: 1 }],
        ['Brok',   { Brokerage: 1 }],
        ['Cash',   { Cash: 1 }],
        ['Roth',   { Roth: 1 }],
        ['prop',   { IRA: 1, Brokerage: 1, Cash: 1 }],      // equal-weight proportional-ish
        ['I6B4',   { IRA: 0.6, Brokerage: 0.4 }],
        ['B4C6',   { Brokerage: 0.4, Cash: 0.6 }],          // the [40,60] gap-fill shape
        ['I5C5',   { IRA: 0.5, Cash: 0.5 }],
        ['I4B3C3', { IRA: 0.4, Brokerage: 0.3, Cash: 0.3 }],
    ];
    // The full oracle needs a NON-CYCLIC base: oracleWithdrawalPlan deliberately refuses to
    // compose with cyclicEnabled (both preempt the strategy chain), and the archetype menu can
    // express harvest-like alternation on its own -- whether it chooses to is S3-P3's question.
    function fullOracle(cell, baseRow, seedConv) {
        const ov = baseRow.f.overrides;
        const horizon = baseRow.res.log.length;
        const baseSpend = baseRow.res.totals.spendCurrentDollars ?? 0;
        const evalPlan = (wp, cv) => scoreOf(
            runSim({ ...cell.cellBase, ...ov, oracleWithdrawalPlan: wp, extraConversionAmount: cv }),
            cell.sharedRate, baseSpend);
        let wplan = new Array(horizon).fill(null);
        let warch = new Array(horizon).fill('family');
        let cvec = (seedConv && seedConv.length ? seedConv.slice(0, horizon) : new Array(horizon).fill(0));
        while (cvec.length < horizon) cvec.push(0);
        let cur = evalPlan(wplan, cvec);
        if (cur == null) { cvec = new Array(horizon).fill(0); cur = evalPlan(wplan, cvec); }
        for (let round = 0; round < 4 && cur != null; round++) {
            const before = cur;
            for (let y = 0; y < horizon; y++) {             // withdrawal-split pass
                let bestA = warch[y], bestW = wplan[y], bestSc = cur;
                for (const [an, aw] of ARCH) {
                    if (an === warch[y]) continue;
                    const wp2 = wplan.slice(); wp2[y] = aw;
                    const sc = evalPlan(wp2, cvec);
                    if (sc != null && sc > bestSc + 0.01) { bestSc = sc; bestA = an; bestW = aw; }
                }
                if (bestA !== warch[y]) { warch[y] = bestA; wplan[y] = bestW; cur = bestSc; }
            }
            for (let y = 0; y < horizon; y++) {             // conversion pass, coarse
                let bestAmt = cvec[y], bestSc = cur;
                for (let amt = 0; amt <= 400000; amt += 25000) {
                    if (amt === cvec[y]) continue;
                    const cv2 = cvec.slice(); cv2[y] = amt;
                    const sc = evalPlan(wplan, cv2);
                    if (sc != null && sc > bestSc + 0.01) { bestSc = sc; bestAmt = amt; }
                }
                if (bestAmt !== cvec[y]) { cvec[y] = bestAmt; cur = bestSc; }
            }
            if (cur - before < 1) break;
        }
        // Backstop instrumentation on the accepted solution (rule: instrumented, not bypassed).
        const finalRes = runSim({ ...cell.cellBase, ...ov, oracleWithdrawalPlan: wplan,
                                  extraConversionAmount: cvec });
        const forcedYrs = finalRes.log.filter(e => (e.ForcedIRA ?? 0) > 1).length;
        return { score: cur, wplan, warch, cvec, forcedYrs, horizon };
    }

    console.log('\n' + '='.repeat(110));
    console.log('P51c/P51e  full oracle (withdrawal split + conversions) and the GAP-TO-ORACLE table');
    console.log('='.repeat(110));
    console.log('Gap rows are families whose best eligible row delivers the SAME spend as the champion');
    console.log('(pair rule); spend-moving families (GK) are excluded and counted.\n');
    const fullResults = [];
    for (const r of results) {
        const cell = r.cell;
        const t1 = Date.now();
        // Non-cyclic base row: best eligible non-cyclic arm by wealth score.
        const baseRow = cell.rows
            .filter(x => x.wealthScore != null && !x.f.overrides.cyclicEnabled)
            .reduce((a, b) => (!a || b.wealthScore > a.wealthScore) ? b : a, null);
        if (!baseRow) { console.log(cell.label + ': no non-cyclic base survives, cell skipped'); continue; }
        const baseSpend = baseRow.res.totals.spendCurrentDollars ?? 0;
        const horizon = baseRow.res.log.length;
        // Conversions-only on the SAME base, so the conversions-vs-split attribution is
        // apples-to-apples (the standalone P51a table above may use a cyclic champion).
        const convSeeds = [
            ['zero', new Array(horizon).fill(0)],
            ['replay', baseRow.res.log.map(e => Math.round((e.rothConv || 0) / 5000) * 5000)],
        ];
        const convO = conversionsOracle(cell.cellBase, baseRow.f.overrides, cell.sharedRate,
            horizon, convSeeds, baseSpend);
        const convOnly = Math.max(convO.score ?? -Infinity, baseRow.wealthScore);
        const o = fullOracle(cell, baseRow, convO.vec);
        const oracleScore = Math.max(o.score ?? -Infinity, convOnly);
        // Per-family best equal-spend row (wealth-only score at the shared rate).
        const famBest = {};
        let spendExcluded = 0;
        for (const row of cell.rows) {
            if (row.wealthScore == null) continue;
            if (Math.abs((row.res.totals.spendCurrentDollars ?? 0) - baseSpend) > 1) { spendExcluded++; continue; }
            const fam = row.f.family;
            if (!(fam in famBest) || row.wealthScore > famBest[fam].wealthScore) famBest[fam] = row;
        }
        const overrideYrs = o.warch.filter(a => a !== 'family').length;
        const baseLabel = baseRow.f.family + ' ' + baseRow.f.paramLabel +
            (baseRow.f.modifier ? ' [' + baseRow.f.modifier + ']' : '');
        console.log(cell.label + '  base ' + baseLabel + ' ' + money(baseRow.wealthScore) +
            '  -> +conv ' + money(convOnly - baseRow.wealthScore) +
            '  -> +split ' + money(oracleScore - convOnly) +
            '  oracle ' + money(oracleScore) +
            '  override yrs ' + overrideYrs + '/' + o.horizon +
            '  forcedIRA yrs ' + o.forcedYrs + '  (' + ((Date.now() - t1) / 1000).toFixed(1) + 's)');
        const gaps = [];
        for (const [fam, row] of Object.entries(famBest).sort((a, b) => b[1].wealthScore - a[1].wealthScore)) {
            const gap = oracleScore - row.wealthScore;
            const gapPct = gap / Math.max(1, Math.abs(oracleScore));
            gaps.push({ fam, gap, gapPct });
            console.log('    ' + fam.padEnd(16) + money(row.wealthScore).padStart(12) +
                ('  gap ' + money(gap)).padEnd(18) + ('(' + (100 * gapPct).toFixed(2) + '%)').padStart(9));
        }
        if (spendExcluded) console.log('    [' + spendExcluded + ' rows excluded: delivered spend differs from the base row]');
        console.log('    archetypes: ' + o.warch.join(' '));
        fullResults.push({ cell, oracleScore, convOnlyScore: convOnly, baseScore: baseRow.wealthScore,
                           baseRow, gaps, o });
    }

    console.log('\n' + '='.repeat(110));
    console.log('PREDICTION SCORING  (S3-P2..P4, recorded before the run)');
    console.log('='.repeat(110));
    const bestGapsFor = basis => fullResults
        .filter(f => f.cell.basis === basis)
        .map(f => f.gaps.length ? Math.min(...f.gaps.map(g => g.gapPct)) : NaN)
        .filter(g => !isNaN(g)).sort((a, b) => a - b);
    const medOf = xs => xs.length ? xs[Math.floor(xs.length / 2)] : NaN;
    const medBestGap = medOf(bestGapsFor(null));
    console.log('S3-P2 median best-family gap < 4% (default basis): median ' +
        (100 * medBestGap).toFixed(2) + '% -> ' + (medBestGap < 0.04 ? 'RIGHT' : 'WRONG'));
    // B-P4 (basis axis, pre-registered): the best-family gap GROWS at 20% basis (more tax
    // terrain for the oracle to navigate) and propwd's gap stays > 1% at both extremes.
    const med20 = medOf(bestGapsFor(0.2)), med80 = medOf(bestGapsFor(0.8));
    const propGapAt = basis => fullResults.filter(f => f.cell.basis === basis)
        .map(f => f.gaps.find(g => g.fam === 'Proportional')).filter(Boolean).map(g => g.gapPct);
    const prop20 = propGapAt(0.2), prop80 = propGapAt(0.8);
    console.log('B-P4 gap grows at b20, propwd >1% at both extremes: median best-family gap b20 ' +
        (100 * med20).toFixed(2) + '% / default ' + (100 * medBestGap).toFixed(2) + '% / b80 ' +
        (100 * med80).toFixed(2) + '%;  propwd min gap b20 ' +
        (prop20.length ? (100 * Math.min(...prop20)).toFixed(1) + '%' : 'n/a') + ', b80 ' +
        (prop80.length ? (100 * Math.min(...prop80)).toFixed(1) + '%' : 'n/a') + ' -> ' +
        ((med20 > medBestGap &&
          (!prop20.length || Math.min(...prop20) > 0.01) &&
          (!prop80.length || Math.min(...prop80) > 0.01)) ? 'RIGHT' : 'WRONG'));
    const propGaps = {};
    for (const f of fullResults) {
        if (f.cell.basis != null) continue;   // published lines stay on the default arm
        const p = f.gaps.find(g => g.fam === 'Proportional');
        if (p) (propGaps[f.cell.sr] = propGaps[f.cell.sr] || []).push(p.gapPct);
    }
    for (const sr of SPEND_RATES) {
        const xs = propGaps[sr] || [];
        console.log('  Proportional gap at ' + (sr * 100) + '% spend: ' +
            (xs.length ? xs.map(g => (100 * g).toFixed(1) + '%').join(', ') : '(no eligible rows)'));
    }
    // S3-P3: harvest-like alternation = adjacent override years flipping between Brokerage-led
    // and IRA-led archetypes in the brokerage-heavy mixes.
    const IRA_LED = new Set(['IRA', 'I6B4', 'I5C5', 'I4B3C3']);
    const BROK_LED = new Set(['Brok', 'B4C6']);
    let altCells = 0, heavyCells = 0;
    for (const f of fullResults) {
        if (f.cell.basis != null) continue;   // scored on the default arm, as published
        if (!(f.cell.mix === 'thirds' || f.cell.mix === 'brokheavy')) continue;
        heavyCells++;
        let flips = 0;
        for (let y = 1; y < f.o.warch.length; y++) {
            const a = f.o.warch[y - 1], b = f.o.warch[y];
            if ((IRA_LED.has(a) && BROK_LED.has(b)) || (BROK_LED.has(a) && IRA_LED.has(b))) flips++;
        }
        if (flips >= 3) altCells++;
    }
    console.log('S3-P3 harvest-like alternation in thirds/brokheavy: ' + altCells + '/' + heavyCells +
        ' cells with >=3 IRA<->Brok flips -> ' + (altCells > heavyCells / 2 ? 'RIGHT' : 'WRONG'));
    const badBackstop = fullResults.filter(f => f.o.forcedYrs / f.o.horizon >= 0.05).length;
    console.log('S3-P4 backstops quiet (<5% forced-IRA years): ' + (fullResults.length - badBackstop) +
        '/' + fullResults.length + ' cells clean -> ' +
        (badBackstop === 0 ? 'RIGHT' : 'WRONG (' + badBackstop + ' flagged)'));

    // P51g: heirs-rate sensitivity on two cells -- re-OPTIMIZE at each rate, don't just re-score.
    console.log('\nP51g  heirs-rate sensitivity (defaults @6%, thirds @6%), full re-optimization:');
    for (const label of ['defaults @6%', 'thirds @6%']) {
        const f = fullResults.find(x => x.cell.label === label);
        if (!f) continue;
        for (const rate of [0.15, 0.35]) {
            const cellR = { ...f.cell, sharedRate: rate };
            const o = fullOracle(cellR, f.baseRow, f.o.cvec);
            const base = scoreOf(f.baseRow.res, rate, null);
            console.log('  ' + label.padEnd(16) + 'rate ' + rate.toFixed(2) +
                '  oracle ' + money(o.score ?? 0) + '  base ' + money(base ?? 0) +
                '  gain ' + money((o.score ?? 0) - (base ?? 0)) +
                '  convYrs ' + o.cvec.filter(a => a > 0).length);
        }
    }
    console.log('\nFULL total: ' + SIMS + ' sims, ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
    console.log('Reminder: perfect-foresight ceiling for THIS deterministic path. Not advice, not shippable.');
}
