'use strict';
/**
 * irmaa_margin_paths_harness.js -- P83. Which IRMAA safety margin is best once the threshold the
 * plan is aiming at is UNCERTAIN?
 *
 * Run:  node .test_harnesses/irmaa_margin_paths_harness.js
 *
 * WHY THIS CAN EXIST NOW, WHEN irmaa_margin_harness.js SAID IT COULD NOT
 * That harness's section 5 ("the limit no sweep can lift") is built on this line:
 *
 *     sim.cpiRate *= (1 + inputs.cpi);        // constant, every run, every path
 *
 * The line is gone. P70 replaced it with an offset off the path's own inflation:
 *
 *     cpi_t = max(CPI_INDEX_FLOOR, yr.yearInflation + (inputs.cpi - inputs.inflation))
 *     sim.cpiRate *= (1 + cpi_t)
 *
 * while irmaaFwdFactor() deliberately stayed on the scalar inputs.cpi, because a plan forecasting
 * the index two years out is not clairvoyant. So REALIZED and ASSUMED CPI now diverge, which is
 * exactly the "engine change, not a harness one" that IRMAA_MARGIN_RESULTS.md section 7 asked for.
 * The margin finally has something to be safe against.
 *
 * WHAT P70e ALREADY DID, AND WHAT IT DID NOT
 * P70e added a native section to irmaa_default_harness.js: halfcpi prevents 8.5% of tier breaches
 * under fixed indexation and 21.1% under path-following, with surcharge dollars at -0.09%. That was
 * `halfcpi` against `none` across the STRESS bank only. It did not sweep the other three modes and
 * it did not touch the three Monte Carlo modes, whose inflation is generated quite differently:
 *
 *   bootstrap  synchronized 3-year blocks from the 1970-2025 record. Inflation is HISTORICAL, so it
 *              carries real persistence and real regime shifts, and a block can hold a 1970s run.
 *   gbm / aam  per-path AR(1) around the plan's own inflation target, persistence 0.67, correlated
 *              -0.30 with that year's return draw. MEAN-REVERTING by construction.
 *
 * That difference is the whole reason to run all three rather than one: a mean-reverting process
 * and a block-bootstrapped historical one should not produce the same two-year forecast error, and
 * the margin can only ever pay out of that error.
 *
 * METHOD
 * Banks come from mc_engine.buildBanks() and paths from mc_engine.buildPathInputs() -- the real
 * builders, not a reimplementation, so a change to how the product draws inflation shows up here
 * instead of being silently reproduced wrong.
 *
 * COMMON RANDOM NUMBERS. Banks are built ONCE per (MC mode, CPI) pair and every margin mode is
 * scored on the same paths. Without that the margin difference is swamped by path noise.
 *
 * THE CONTROL ARM IS `fixedTaxIndexing: true`, which pins both statutory clocks to the typed rates
 * while spending still follows the path. Under it the forward projection is exact by construction,
 * so any margin benefit there is NOT forecast absorption and marks a confound.
 *
 * READING A NULL RESULT. "No margin helped" is ambiguous unless you know how much error the paths
 * actually generated, so section 1 reports the realized-vs-assumed CPI distribution per mode BEFORE
 * any margin number. Only an UNDERSHOOT can breach (irmaa_cpi_risk_harness.js section 3: the
 * asymmetry is total), so the undershoot rate is the size of the prize.
 *
 * SCORING. Breaches and surcharge dollars are the IRMAA metrics. Wealth is reported beside them and
 * is NOT the ranking: P6 and P70e both found the wealth ordering is driven by conversion sizing,
 * not by IRMAA, and a tighter ceiling converts less. Delivered spend is printed for the same reason
 * P29 and P28jd carry the rule -- a margin that ends richer by spending less has won nothing.
 *
 * -- PREDICTIONS, recorded BEFORE the numbers were looked at ------------------------------------
 *   P1. Bootstrap generates the largest two-year forecast error, because historical inflation has
 *       regime shifts and the AR(1) is mean-reverting to the plan's own target. So bootstrap shows
 *       the largest margin benefit and gbm/aam the smallest.
 *   P2. The rate-shaped modes (halfcpi, cpiminus1) beat the dollar-shaped ones (flat2000, halfstep)
 *       on breaches, because the error they absorb is proportional to the threshold.
 *       (irmaa_cpi_risk_harness.js reached this under hand-built CPI worlds; this is the first test
 *       of it against generated paths.)
 *   P3. Surcharge DOLLARS stay noise, under +/-0.5% between modes, as in P70e (-0.09%).
 *   P4. The fixed-indexation control shows a materially smaller benefit than the path arm for every
 *       mode. If it does not, something other than forecast absorption is moving the number.
 *   P5. `halfcpi` leads on wealth in every mode, for the conversion-sizing reason, not the IRMAA one.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
require('../displayhelpers.js');
const prng = require('../montecarlo/prng.js');
// mc_engine.js reads the bank builders as BARE GLOBALS, the way importScripts supplies them in the
// worker. Requiring it without this throws `bootstrapMultiAssetBank is not defined` on the first
// bootstrap build, which is the one mode this harness most needs.
Object.assign(globalThis, prng);
const mcEngine = require('../montecarlo/mc_engine.js');
const { simulate, afterTaxWealthOfLogRow, IRMAA_MARGIN_MODES } = core;

const MODES  = [...IRMAA_MARGIN_MODES];
const YEARS  = 30;
const TIER   = 1;                 // the ceiling every convert arm aims at
const SPREAD = 0.002;             // shipped default gap: inflation 3.0 against cpi 2.8
const FUTURE_IRA_RATE = 0.22;
const PATHS  = 150;
const SEED   = 42;
const CPIS   = [0.02, 0.025, 0.03];

// Same fixture family as irmaa_default_harness.js, MFJ only so there is one tier table to read.
const BASE = {
    STATEname: 'CA', strategy: 'bracket', stratRate: 0, stratACAMultiple: 0, nYears: YEARS,
    birthyear1: 1955, birthmonth1: 3, die1: 92,
    birthyear2: 1956, birthmonth2: 3, die2: 95, hasSpouse: true,
    IRA1: 2500000, IRA2: 500000, Roth: 200000, Roth2: 0,
    Brokerage: 600000, BrokerageBasis: 300000, Cash: 150000, CashReserve: 0,
    ss1: 45000, ss1Age: 70, ss2: 24000, ss2Age: 70,
    pensionAnnual: 0, survivorPct: 75, pensionCola: false,
    spendGoal: 180000, spendChange: 0, iraBaseGoal: 0,
    growth: 0.06, cashYield: 0.02, dividendRate: 0.015,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: true, propWithdraw: 0, iraWithdrawPct: 0.05,
    startYear: 2026, dividendReinvest: false,
    qcdHHMax: 0, qcdMode: 'always',
    cyclicEnabled: false,   // harvest timing swamps this signal; see irmaa_margin_harness.js
    stratIRMAATier: TIER,
};
const SHAPES = [
    { key: 'MFJ 3.0M', over: {} },
    { key: 'MFJ 6.0M', over: { IRA1: 5000000, IRA2: 1000000, spendGoal: 240000 } },
    { key: 'MFJ 1.2M', over: { IRA1: 1000000, IRA2: 200000, spendGoal: 120000 } },
];

// The three Monte Carlo modes the tab offers, plus stress for continuity with P70e's numbers.
const MC_MODES = [
    { key: 'bootstrap', label: 'Historical (block bootstrap)' },
    { key: 'gbm',       label: 'Synthetic-GBM' },
    { key: 'aam',       label: 'Synthetic-AAM' },
    { key: 'stress',    label: 'Stress bank (P70e continuity)' },
];

const pad  = (s, w) => String(s).padEnd(w);
const rpad = (s, w) => String(s).padStart(w);
const pct  = (x, d = 2) => (x * 100).toFixed(d) + '%';
const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

const tierIndexOf = (() => {
    const m = new Map();
    getRateBracket('IRMAA', 'MFJ').forEach((b, i) => m.set(b.tier, i));
    return m;
})();

// Build the banks for one Monte Carlo mode. inflationRate is the plan's own inflation input, which
// is what mc_tab passes as the AR(1) target.
function banksFor(mcMode, inflationRate) {
    if (mcMode === 'stress') {
        const bank = prng.buildStressBank(10, YEARS, 'combined');
        return { banks: { scenarioBank: bank.equity, multiAssetBank: bank, synthInflationBank: null },
                 nPaths: bank.startYears.length };
    }
    const cfg = { years: YEARS, numPaths: PATHS, seed: SEED, bearFraction: 25,
                  mu: 0.07, sigma: 0.12, inflationRate,
                  inflationPersistence: prng.INFLATION_AR1_PERSISTENCE,
                  inflationShockSd:     prng.INFLATION_AR1_SHOCK_SD,
                  inflationReturnCorr:  prng.INFLATION_RETURN_CORR };
    const rng = prng.mulberry32(SEED);
    const b = mcEngine.buildBanks(cfg, rng, mcMode);
    return { banks: b, nPaths: b.numPaths ?? PATHS };
}

const LOOKBACK  = Math.abs(TAXData.IRMAA.LOOKBACK);
const CPI_FLOOR = -0.01;

console.log('P83 -- IRMAA safety margin against Monte Carlo inflation paths');
console.log(MODES.length + ' margin modes x ' + MC_MODES.length + ' MC modes x ' + SHAPES.length
          + ' shapes x ' + CPIS.length + ' CPI assumptions, ' + YEARS + '-year plans, tier ' + TIER
          + ', seed ' + SEED + '.');

// -- 1. How much forecast error do these paths actually generate? -------------------------------
//
// The plan projects the threshold forward LOOKBACK years at inputs.cpi. What actually indexes it is
// cpi_t = yearInflation + spread. So the error on the window ending at year y is what compounded
// against what was assumed. Only a shortfall (realized < assumed) can push MAGI over a threshold
// that moved less than the plan expected.
console.log('');
console.log('## 1. The size of the prize: realized vs assumed CPI over each ' + LOOKBACK
          + '-year lookback window');
console.log('');
console.log(pad('MC mode', 32) + rpad('windows', 10) + rpad('undershoot', 12)
          + rpad('mean err', 11) + rpad('p10 err', 10) + rpad('worst', 10));

const errorByMode = {};
for (const mc of MC_MODES) {
    const errs = [];
    for (const cpi of CPIS) {
        const inflation = cpi + SPREAD;
        const { banks, nPaths } = banksFor(mc.key, inflation);
        for (let p = 0; p < nPaths; p++) {
            const path = mcEngine.buildPathInputs(banks, p, YEARS, { ...BASE, cpi, inflation }, mc.key);
            const seq = path.inflationSequence;
            if (!seq) continue;
            for (let y = LOOKBACK; y < YEARS; y++) {
                let realized = 1, assumed = 1;
                for (let k = y - LOOKBACK; k < y; k++) {
                    realized *= (1 + Math.max(CPI_FLOOR, seq[k] + (cpi - inflation)));
                    assumed  *= (1 + cpi);
                }
                errs.push(realized / assumed - 1);
            }
        }
    }
    errs.sort((a, b) => a - b);
    const under = errs.length ? errs.filter(e => e < 0).length / errs.length : 0;
    const mean  = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : 0;
    errorByMode[mc.key] = { n: errs.length, under, mean,
                            p10: errs.length ? errs[Math.floor(errs.length * 0.10)] : 0,
                            worst: errs.length ? errs[0] : 0 };
    const e = errorByMode[mc.key];
    console.log(pad(mc.label, 32) + rpad(e.n.toLocaleString(), 10) + rpad(pct(under, 1), 12)
              + rpad(pct(mean), 11) + rpad(pct(e.p10), 10) + rpad(pct(e.worst), 10));
}

// -- 1b. How big is each mode's setback? ---------------------------------------------------------
//
// Without this the sweep cannot distinguish "halfcpi is the best SHAPE" from "halfcpi is simply the
// most conservative option on the menu". If breaches fall monotonically with setback size and the
// curve is still falling at the largest shipped mode, the menu is truncated below its own optimum -
// which is a different finding, and P30 hit exactly this with `[40,60]`.
console.log('');
console.log('## 1b. What each mode actually sets the ceiling back, at CPI 2.5% and the Tier ' + TIER
          + ' MFJ threshold');
console.log('');
{
    const cpi = 0.025;
    const probe = { ...BASE, cpi, inflation: cpi + SPREAD };
    const tiers = getRateBracket('IRMAA', 'MFJ');
    const threshold = tiers[TIER] && tiers[TIER].l ? tiers[TIER].l : 0;
    const fwdNone = core.irmaaFwdFactor({ ...probe, irmaaMarginMode: 'none' });
    console.log(pad('margin', 12) + rpad('fwd factor', 13) + rpad('vs none', 10)
              + rpad('rate setback', 15) + rpad('dollar setback', 16) + rpad('TOTAL setback', 15));
    for (const m of MODES) {
        const inp = { ...probe, irmaaMarginMode: m };
        const fwd = core.irmaaFwdFactor(inp);
        const rateSetback = threshold * (fwdNone - fwd);
        // The 4th argument is a cpiRate FACTOR, not a rate. Passing `cpi` (0.025) here scaled every
        // bracket to a fortieth of itself, which put both calcIRMAA probes in the same tier and
        // reported halfstep's setback as $0 - while the sweep showed it preventing 2.1% of breaches.
        // A number that disagrees with the arm beside it is the tell.
        const dollarSetback = core.irmaaMarginDollars(inp, threshold * fwd, 'MFJ', fwd, 1, 2);
        console.log(pad(m, 12) + rpad(fwd.toFixed(5), 13)
                  + rpad(pct((fwd - fwdNone) / fwdNone), 10)
                  + rpad(money(rateSetback), 15) + rpad(money(dollarSetback), 16)
                  + rpad(money(rateSetback + dollarSetback), 15));
    }
}

// -- 2. The margin sweep -------------------------------------------------------------------------
function sweep(mcMode, fixedIndexing) {
    const agg = {};
    for (const m of MODES) agg[m] = { breach: 0, charged: 0, surcharge: 0, wealth: 0, conv: 0, spend: 0 };
    for (const shape of SHAPES) for (const cpi of CPIS) {
        const inputs = { ...BASE, ...shape.over, cpi, inflation: cpi + SPREAD };
        const { banks, nPaths } = banksFor(mcMode, inputs.inflation);
        for (let p = 0; p < nPaths; p++) {
            const path = mcEngine.buildPathInputs(banks, p, YEARS, inputs, mcMode);
            for (const m of MODES) {
                const r = simulate({ ...inputs, ...path, irmaaMarginMode: m,
                                     fixedTaxIndexing: fixedIndexing });
                const rows = r.log.filter(e => e.year !== undefined);
                const a = agg[m];
                for (const e of rows) {
                    if (e.IRMAATier === '-none-' || !(e.IRMAA >= 0)) continue;
                    a.charged++;
                    a.surcharge += e.IRMAA || 0;
                    const t = tierIndexOf.get(e.IRMAATier);
                    if (t !== undefined && t > TIER) a.breach++;
                }
                a.conv   += rows.reduce((x, e) => x + (e.rothConv || 0), 0);
                a.spend  += r.totals && r.totals.spendCurrentDollars ? r.totals.spendCurrentDollars : 0;
                a.wealth += afterTaxWealthOfLogRow(r.log[r.log.length - 1], FUTURE_IRA_RATE);
            }
        }
    }
    return agg;
}

const results = {};
for (const mc of MC_MODES) {
    results[mc.key] = { path: sweep(mc.key, false), fixed: sweep(mc.key, true) };
}

const rel = (a, b) => b ? (a - b) / b : 0;
const show = (agg, label) => {
    const none = agg.none;
    console.log('');
    console.log(label);
    console.log('  ' + pad('margin', 12) + rpad('breaches', 10) + rpad('vs none', 10)
              + rpad('charged', 9) + rpad('surcharge', 14) + rpad('vs none', 10)
              + rpad('wealth', 16) + rpad('vs none', 10) + rpad('spend vs none', 15));
    for (const m of MODES) {
        const a = agg[m];
        console.log('  ' + pad(m, 12) + rpad(a.breach, 10)
                  + rpad(none.breach ? pct(rel(a.breach, none.breach), 1) : '-', 10)
                  + rpad(a.charged, 9) + rpad(money(a.surcharge), 14)
                  + rpad(pct(rel(a.surcharge, none.surcharge)), 10)
                  + rpad(money(a.wealth), 16)
                  + rpad(pct(rel(a.wealth, none.wealth)), 10)
                  + rpad(pct(rel(a.spend, none.spend)), 15));
    }
};

console.log('');
console.log('');
console.log('## 2. Margin sweep, indexation FOLLOWING each path (the real regime)');
for (const mc of MC_MODES) show(results[mc.key].path, '### ' + mc.label);

console.log('');
console.log('');
console.log('## 3. Control: fixedTaxIndexing ON. The forecast is exact by construction, so nothing');
console.log('   here is forecast absorption. A benefit that survives this arm is a confound.');
for (const mc of MC_MODES) show(results[mc.key].fixed, '### ' + mc.label);

// -- 3b. Could the forecast itself be better? ----------------------------------------------------
//
// P83f, added at the user's question: the plan projects the threshold forward at the TYPED cpi, a
// constant, ignoring everything the path has already realized. Is that the best available forecast?
//
// At decision year y the plan caps year y's MAGI, charged in year y+2 against the threshold
// published for y+2, so it must forecast index growth over years y+1 and y+2 - a FORWARD window.
// This section is analytic: it works on the inflation banks alone and calls no simulate(), because
// the question is about forecast accuracy, not about plan outcomes.
//
// INFORMATION SET. `lastyear` uses c[y], which the engine does have in hand when the ceiling is
// computed; `lastyear-lag` uses c[y-1], which is what a real household would know, since CPI for
// year y is not published until it ends. Both are reported, and the generous one still loses.
console.log('');
console.log('');
console.log('## 3b. How good can the 2-year threshold forecast be? (P83f, analytic)');
console.log('   Error = realized / forecast - 1. NEGATIVE = the threshold moved LESS than projected,');
console.log('   which is the only direction that can breach. `oracle` is perfect foresight - not');
console.log('   shippable, present as the bound on what any forecast could buy.');
{
    const geo = arr => Math.pow(arr.reduce((a, b) => a * (1 + b), 1), 1 / arr.length) - 1;
    const RULES = [
        ['typed (today)', (c, y, cpi) => Math.pow(1 + cpi, LOOKBACK)],
        ['lastyear',      (c, y) => Math.pow(1 + c[y], LOOKBACK)],
        ['lastyear-lag',  (c, y) => Math.pow(1 + c[Math.max(0, y - 1)], LOOKBACK)],
        ['trailing3',     (c, y) => Math.pow(1 + geo(Array.from(c.slice(Math.max(0, y - 2), y + 1))), LOOKBACK)],
        ['trailing5',     (c, y) => Math.pow(1 + geo(Array.from(c.slice(Math.max(0, y - 4), y + 1))), LOOKBACK)],
        ['oracle',        (c, y) => (1 + c[y + 1]) * (1 + c[y + 2])],
    ];
    const tiers = getRateBracket('IRMAA', 'MFJ');
    const THRESH = tiers[TIER].l;

    const seqsFor = (mode) => {
        const out = [];
        for (const cpi of CPIS) {
            const inflation = cpi + SPREAD;
            const { banks, nPaths } = banksFor(mode, inflation);
            for (let p = 0; p < nPaths; p++) {
                const path = mcEngine.buildPathInputs(banks, p, YEARS, { ...BASE, cpi, inflation }, mode);
                if (!path.inflationSequence) continue;
                const c = new Float64Array(YEARS);
                for (let y = 0; y < YEARS; y++) {
                    c[y] = Math.max(CPI_FLOOR, path.inflationSequence[y] + (cpi - inflation));
                }
                out.push({ cpi, c });
            }
        }
        return out;
    };

    console.log('');
    console.log('   Tier ' + TIER + ' MFJ threshold $' + THRESH.toLocaleString('en-US')
              + '. "setback needed" is the p10 undershoot expressed in dollars at that threshold.');
    for (const mc of MC_MODES) {
        const s = seqsFor(mc.key);
        console.log('');
        console.log('### ' + mc.label);
        console.log('  ' + pad('rule', 16) + rpad('undershoot', 12) + rpad('mean err', 11)
                  + rpad('sd', 10) + rpad('p10 err', 10) + rpad('setback needed', 17));
        for (const [rname, rule] of RULES) {
            const errs = [];
            for (const { cpi, c } of s) {
                for (let y = 0; y + LOOKBACK < YEARS; y++) {
                    errs.push((1 + c[y + 1]) * (1 + c[y + 2]) / rule(c, y, cpi) - 1);
                }
            }
            errs.sort((a, b) => a - b);
            const n = errs.length;
            const mean = errs.reduce((a, b) => a + b, 0) / n;
            const sd = Math.sqrt(errs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n);
            const p10 = errs[Math.floor(n * 0.10)];
            console.log('  ' + pad(rname, 16)
                      + rpad(pct(errs.filter(e => e < 0).length / n, 1), 12)
                      + rpad(pct(mean), 11) + rpad(pct(sd), 10) + rpad(pct(p10), 10)
                      + rpad(money(Math.max(0, -p10) * THRESH), 17));
        }
    }
}

// -- 4. Predictions ------------------------------------------------------------------------------
console.log('');
console.log('');
console.log('## 4. Scored predictions');
console.log('');
const score = (id, ok, detail) => console.log('  ' + (ok ? 'HELD    ' : 'BROKEN  ') + id + '  ' + detail);

const benefit = (mcKey, arm) => {
    const a = results[mcKey][arm];
    return a.none.breach ? (a.none.breach - a.halfcpi.breach) / a.none.breach : 0;
};
// P1's SUBSTANCE is "bootstrap shows the largest margin benefit". An earlier version of this line
// tested only the undershoot RATE, which bootstrap does lead, and so printed HELD for a prediction
// the benefit numbers refute. Scored on the claim, not on the nearest convenient statistic.
score('P1. bootstrap benefit > synthetic benefit',
      benefit('bootstrap', 'path') > benefit('gbm', 'path')
      && benefit('bootstrap', 'path') > benefit('aam', 'path'),
      'halfcpi breach drop boot ' + pct(benefit('bootstrap', 'path'), 1)
      + ' / gbm ' + pct(benefit('gbm', 'path'), 1) + ' / aam ' + pct(benefit('aam', 'path'), 1)
      + '; undershoot RATE boot ' + pct(errorByMode.bootstrap.under, 1)
      + ' / gbm ' + pct(errorByMode.gbm.under, 1) + ' / aam ' + pct(errorByMode.aam.under, 1)
      + '; p10 undershoot boot ' + pct(errorByMode.bootstrap.p10)
      + ' / gbm ' + pct(errorByMode.gbm.p10) + ' / aam ' + pct(errorByMode.aam.p10));

const rateBeatsDollar = MC_MODES.every(mc => {
    const a = results[mc.key].path;
    return Math.min(a.halfcpi.breach, a.cpiminus1.breach) <= Math.min(a.flat2000.breach, a.halfstep.breach);
});
score('P2. rate-shaped beat dollar-shaped', rateBeatsDollar,
      MC_MODES.map(mc => {
          const a = results[mc.key].path;
          return mc.key + ': hc ' + a.halfcpi.breach + ' cm1 ' + a.cpiminus1.breach
               + ' f2k ' + a.flat2000.breach + ' hs ' + a.halfstep.breach;
      }).join(' | '));

const maxDollarSwing = Math.max(...MC_MODES.map(mc => {
    const a = results[mc.key].path;
    return Math.max(...MODES.map(m => Math.abs(rel(a[m].surcharge, a.none.surcharge))));
}));
score('P3. surcharge dollars stay noise (<0.5%)', maxDollarSwing < 0.005,
      'largest swing ' + pct(maxDollarSwing));

const controlSmaller = MC_MODES.every(mc =>
    Math.abs(benefit(mc.key, 'fixed')) < Math.abs(benefit(mc.key, 'path')));
score('P4. control benefit < path benefit', controlSmaller,
      MC_MODES.map(mc => mc.key + ': path ' + pct(benefit(mc.key, 'path'), 1)
                       + ' fixed ' + pct(benefit(mc.key, 'fixed'), 1)).join(' | '));

const halfcpiLeadsWealth = MC_MODES.every(mc => {
    const a = results[mc.key].path;
    return a.halfcpi.wealth >= Math.max(...MODES.map(m => a[m].wealth)) - 0.5;
});
score('P5. halfcpi leads on wealth everywhere', halfcpiLeadsWealth,
      MC_MODES.map(mc => {
          const a = results[mc.key].path;
          const best = MODES.reduce((x, m) => a[m].wealth > a[x].wealth ? m : x, MODES[0]);
          return mc.key + ': ' + best;
      }).join(' | '));
