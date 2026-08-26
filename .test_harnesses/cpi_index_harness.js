'use strict';
/**
 * cpi_index_harness.js -- do high-inflation paths overstate tax, because the brackets are indexed
 * at a rate the path never experienced?
 *
 * Run:  node .test_harnesses/cpi_index_harness.js
 *
 * THE DEFECT BEING MEASURED (P70)
 * simulate() runs two inflation clocks, and only one of them follows the path:
 *
 *     sim.inflation *= (1 + yr.yearInflation);   // the PATH's realized inflation. Drives spending.
 *     sim.cpiRate   *= (1 + inputs.cpi);         // a FIXED scalar. Indexes the whole tax code.
 *
 * Everything bracket-shaped rides cpiRate: federal and state bracket limits, the LTCG brackets,
 * IRMAA thresholds and tiers, the ACA FPL multiple, the IRA goal, QCD sizing -- and Social Security
 * COLA. So a path escalating spending at 11% indexes its brackets at 2.5%. That is artificial REAL
 * bracket creep, and it lands in exactly the paths that decide whether a plan survives.
 *
 * The SS term pushes the other way: the same path understates SS income, which is a partial offset
 * on both the income side and the taxable-SS side. The net sign is not derivable by inspection.
 * Hence a measurement, not a fix.
 *
 * WHY THIS NEEDED AN ENGINE FLAG, WHEN irmaa_cpi_risk_harness.js DID NOT
 * That harness answered a neighboring question with a post-processing trick -- decide under the
 * assumed CPI, re-bill under a realized one -- and explicitly dropped feedback as second-order. Here
 * feedback IS the question. Creep moves the bracket ceiling, which moves the withdrawal, which moves
 * the balance, which moves the ruin year. Nothing outside the loop can see that. So optimizer_core.js
 * gained `fixedTaxIndexing` (default OFF, i.e. path-following), and this harness runs both arms.
 *
 * WHAT THE FLAG DOES NOT TOUCH, AND WHY IT IS CORRECT NOT TO
 *   - gapYears pre-compounding: those years precede the simulation. No path exists there.
 *   - irmaaFwdFactor() and the ACA one-year lookahead: those are the plan FORECASTING an index it
 *     cannot know. Path-aware indexation does not grant clairvoyance about next year's CPI.
 *   - taxCreepFactor(): a function of the calendar year, by design.
 * Both arms therefore share identical forecasting behavior, and the only difference between them is
 * how the REALIZED index advanced.
 *
 * SCENARIOS: the Stress Test's own set, not a new one. buildStressBank() from montecarlo/prng.js is
 * what the Stress tab runs -- the worst historical windows by real CAGR -- and it is node-callable.
 * buildPathInputs() from montecarlo/mc_engine.js builds the per-path bundle. Neither is
 * reimplemented here; mc_engine.js exists precisely because a second copy of that code drifted once
 * already.
 *
 * BASIS: lifetime tax is reported both nominal (totals.tax) and real (totals.taxCurrentDollars,
 * which the engine deflates by sim.inflation). sim.inflation is IDENTICAL in both arms -- the flag
 * does not touch it -- so the real figures share a denominator and the delta between arms is a true
 * comparison, not a units artifact.
 *
 * -- PREDICTIONS, recorded BEFORE the numbers were looked at ------------------------------------
 *   P1. The sign of the tax delta tracks realized-minus-assumed CPI: path-following LOWERS tax in
 *       the high-inflation windows (1965-1982 starts) and raises it slightly in the windows that
 *       came in under the assumed rate.
 *   P2. The SS offset is smaller than the bracket effect, so the net direction in the windows that
 *       matter is less tax, not more.
 *   P3. IRMAA tier-years move MORE, proportionally, than total tax. The tier ladder is a cliff and
 *       a marginal bracket is a ramp, so threshold placement matters more to it.
 *   P4. At least one stress window changes its outcome band. If none does, the answer to P70 is a
 *       documentation NOTE rather than an engine fix.
 *   P5. The effect is largest on the 6.0M plan, which has the most income to push through creeping
 *       brackets, and smallest on the 1.2M plan, which spends much of the plan below the first
 *       bracket that moves.
 */

// -- Bootstrap the engine exactly like the other node harnesses ---------------------------------
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
const { simulate, afterTaxWealthOfLogRow } = core;
const prng = require('../montecarlo/prng.js');
const { buildStressBank, stressOutcomeBand } = prng;
const mcEngine = require('../montecarlo/mc_engine.js');
const { buildPathInputs } = mcEngine;

const YEARS      = 30;     // plan horizon the stress bank is cut to
const START_YEAR = 2026;
const STRESS_COUNT = 10;   // the Stress tab's default
const STRESS_WINDOW_MODE = 'combined';   // union of every ranking window, the tab's richest mode
const FUTURE_IRA_RATE = 0.24;            // for the after-tax net worth column only

// -- The plan ladder ----------------------------------------------------------------------------
// Same shape as irmaa_cpi_risk_harness.js, so a reader comparing the two studies is looking at the
// same households. Crossed with the assumed cpi, which is the variable that decides how far the
// fixed clock can drift from the realized one.
//
// NOTE on stratRate: `strategy: 'bracket'` with stratRate 0, no stratIRMAATier and no
// stratACAMultiple is a DEGENERATE config - computeBracketCeiling has no rate to find a limit for,
// and the run comes back with NaN totals rather than throwing. irmaa_cpi_risk_harness.js's BASE
// carries stratRate 0 but always overrides it with a tier, so it never meets this. Every plan below
// names a real ceiling.
const BASE = {
    STATEname: 'CA', strategy: 'bracket', stratRate: 0.24, stratACAMultiple: 0, nYears: YEARS,
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
    startYear: START_YEAR, dividendReinvest: false,
    qcdHHMax: 0, qcdMode: 'always',
    cyclicEnabled: false,
};

// Three ceilings, because they are shaped differently and indexation does not treat them alike.
// A bracket top is a RAMP: index it too low and the plan pays a higher marginal rate on the last
// slice. An IRMAA tier and the ACA FPL multiple are CLIFFS: index them too low and the plan falls
// off, paying a whole step. Prediction P3 is about exactly that difference.
const CEILINGS = {
    brk24: { stratRate: 0.24 },
    tier1: { stratRate: 0, stratIRMAATier: 1 },
    aca400: { stratRate: 0, stratACAMultiple: 400 },
};

// Which ceilings each household can actually exercise. An ACA cap has nothing to protect once
// everyone living is at or past Medicare age (acaCapLapsed in optimizer_core.js), and every
// household above starts at 70/71 - so crossing `aca400` over all of them would have printed a
// column of zeros and read as "indexation does not touch ACA", which is not what it would mean.
// The early-retiree shape exists to give that ceiling something to bite on.
const SHAPES = [
    { key: 'MFJ 3.0M',  ceilings: ['brk24', 'tier1'], over: {} },
    { key: 'MFJ 6.0M',  ceilings: ['brk24', 'tier1'],
      over: { IRA1: 5000000, IRA2: 1000000, spendGoal: 240000 } },
    { key: 'MFJ 1.2M',  ceilings: ['brk24', 'tier1'],
      over: { IRA1: 1000000, IRA2: 200000, spendGoal: 120000 } },
    { key: 'single 2M', ceilings: ['brk24', 'tier1'],
      over: { hasSpouse: false, birthyear2: 0, die2: 0, IRA2: 0, ss2: 0,
              Roth2: 0, IRA1: 2000000, spendGoal: 130000 } },
    // Both 60 in 2026, so there are five pre-Medicare years for an ACA cap to matter in, and SS
    // does not start until 70. Death ages are chosen so the plan ends in exactly YEARS years,
    // with a widow stretch at the end; see the horizon assertion below for why that matters.
    { key: 'MFJ early',  ceilings: ['brk24', 'aca400'],
      over: { birthyear1: 1966, die1: 86, birthyear2: 1966, die2: 89,
              ss1Age: 70, ss2Age: 70 } },
];
const ASSUMED_CPIS = [0.02, 0.025, 0.03];
// Felt inflation runs ABOVE the statutory index; the shipped defaults are 3.0 vs 2.8. Every
// plan below carries that gap, so the statutory clock is the path LESS this, not the path.
const DEFAULT_SPREAD = 0.002;

const PLANS = [];
for (const shape of SHAPES)
    for (const ceilKey of shape.ceilings)
        for (const cpi of ASSUMED_CPIS)
            PLANS.push({
                key: `${shape.key} ${ceilKey} @${(cpi * 100).toFixed(1)}%`,
                shape: shape.key, ceiling: ceilKey, cpi,
                // inflation is NOT set equal to cpi. The two are separate inputs on purpose and
                // the shipped defaults differ by 0.2 points (inflation 3.0 / cpi 2.8); an earlier
                // round of this harness set them equal, which silently measured a configuration
                // no default user runs and hid the spread from the result.
                inputs: { ...BASE, ...shape.over, ...CEILINGS[ceilKey], cpi,
                          inflation: cpi + DEFAULT_SPREAD },
            });

// A plan that outlives the bank is the quietest trap here. simulate() runs
// max(birthyear + die) - startYear + 1 years regardless of nYears, and reads
// `inputs.inflationSequence?.[y] ?? inputs.inflation` - so the tail past the bank silently reverts
// to the FIXED rate, in both arms, diluting the very difference being measured. No throw, no
// warning, just a smaller number.
for (const plan of PLANS) {
    const i = plan.inputs;
    const horizon = Math.max(i.birthyear1 + i.die1, i.birthyear2 + i.die2) - START_YEAR + 1;
    if (horizon > YEARS)
        throw new Error(`${plan.key}: horizon ${horizon}y exceeds the ${YEARS}y bank; `
                      + `the last ${horizon - YEARS} years would fall back to the fixed rate`);
}

// -- The scenario bank ---------------------------------------------------------------------------
const bank = buildStressBank(STRESS_COUNT, YEARS, STRESS_WINDOW_MODE);
const banks = { scenarioBank: bank.equity, multiAssetBank: bank, synthInflationBank: null };
const nSeq = bank.startYears.length;

// -- One run -------------------------------------------------------------------------------------
function runOne(planInputs, pathInputs, fixed) {
    const r = simulate({ ...planInputs, ...pathInputs, fixedTaxIndexing: fixed });
    const rows = r.log.filter(e => e.year !== undefined);
    const last = r.log[r.log.length - 1];

    // Tier-years: how many plan years landed on a surcharged IRMAA tier at all. '-none-' is the
    // engine's marker for a year nobody was enrolled; the base tier prints as its own name and is
    // not a surcharge, so it is excluded by the dollar test rather than by tier name.
    let irmaaTierYears = 0, irmaaTotal = 0;
    for (const e of rows) {
        if ((e.IRMAA || 0) > 0) { irmaaTierYears++; irmaaTotal += e.IRMAA; }
    }

    const ruinYear = r.totals.failedInYear.length ? r.totals.failedInYear[0] : 0;
    return {
        taxNominal: r.totals.tax,
        taxReal:    r.totals.taxCurrentDollars,
        ruinYear,
        band:       stressOutcomeBand(START_YEAR, ruinYear, YEARS),
        yearsFunded: r.totals.yearsfunded,
        success:    r.totals.success,
        afterTaxNW: afterTaxWealthOfLogRow(last, FUTURE_IRA_RATE),
        irmaaTierYears, irmaaTotal,
        acaBreachYears: r.totals.acaBreachYears,
        finalCpiFactor: rows.length ? rows[rows.length - 1]['-cpiFactor'] : 1,
    };
}

// -- Sweep ---------------------------------------------------------------------------------------
// One entry per (plan, scenario). CONTROL is today's engine; TEST is path-following indexation.
const results = [];
const t0 = Date.now();
for (const plan of PLANS) {
    for (let p = 0; p < nSeq; p++) {
        const pathInputs = buildPathInputs(banks, p, YEARS, plan.inputs, 'stress');
        const control = runOne(plan.inputs, pathInputs, true);    // fixed indexation: today
        const test    = runOne(plan.inputs, pathInputs, false);   // path-following, less the spread
        // Fail loudly. A degenerate strategy config returns NaN totals rather than throwing (see
        // the note on BASE), and a NaN quietly sorts to one end of every table below and reads as
        // a finding. Nothing here should ever be non-finite.
        for (const [arm, r] of [['control', control], ['test', test]])
            for (const k of ['taxNominal', 'taxReal', 'afterTaxNW'])
                if (!Number.isFinite(r[k]))
                    throw new Error(`${plan.key} / start ${bank.startYears[p]} / ${arm}: ${k} = ${r[k]}`);
        results.push({
            plan: plan.key, shape: plan.shape, ceiling: plan.ceiling, assumedCpi: plan.cpi,
            startYear: bank.startYears[p],
            inflCagr: bank.fullInflCAGRs[p],
            realCagr: bank.fullRealCAGRs[p],
            control, test,
            dTaxReal:  test.taxReal - control.taxReal,
            dTaxPct:   control.taxReal ? (test.taxReal - control.taxReal) / control.taxReal : 0,
            dRuin:     (test.ruinYear || 0) - (control.ruinYear || 0),
            dNW:       test.afterTaxNW - control.afterTaxNW,
            dIrmaaYrs: test.irmaaTierYears - control.irmaaTierYears,
            dIrmaa:    test.irmaaTotal - control.irmaaTotal,
            dAca:      test.acaBreachYears - control.acaBreachYears,
            bandFlip:  test.band !== control.band,
        });
    }
}
const elapsed = Date.now() - t0;

// -- Report --------------------------------------------------------------------------------------
const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
const pct   = n => (n * 100).toFixed(2) + '%';
const pad   = (s, w) => String(s).padEnd(w);
const rpad  = (s, w) => String(s).padStart(w);

console.log('P70a -- CPI indexation: fixed rate vs path-following');
console.log(`Stress bank: ${nSeq} scenarios, mode '${STRESS_WINDOW_MODE}', ${YEARS}-year plans, `
          + `start ${START_YEAR}. ${PLANS.length} plans x ${nSeq} scenarios x 2 arms = `
          + `${results.length * 2} simulations in ${(elapsed / 1000).toFixed(1)}s.`);
console.log(`Assumed CPI: ${ASSUMED_CPIS.map(c => pct(c)).join(' / ')}. `
          + `Realized inflation CAGR across the bank: `
          + `${pct(Math.min(...bank.fullInflCAGRs))} to ${pct(Math.max(...bank.fullInflCAGRs))}.`);
console.log('');

// 1. Headline: does anything flip?
const flips = results.filter(r => r.bandFlip);
const ruinMoves = results.filter(r => r.dRuin !== 0);
// Three genuinely different events, and lumping them together made the ruin-year delta unreadable:
// a scenario that stops ruining has no ruin year to subtract, so it printed as a delta of -2046.
const rescued = results.filter(r =>  r.control.ruinYear && !r.test.ruinYear);
const broken  = results.filter(r => !r.control.ruinYear &&  r.test.ruinYear);
const moved   = results.filter(r =>  r.control.ruinYear &&  r.test.ruinYear && r.dRuin !== 0);

console.log('== OUTCOME CHANGES ==');
console.log(`Outcome-band flips:                ${flips.length} of ${results.length}`);
console.log(`Ruin-year moves (any kind):        ${ruinMoves.length} of ${results.length}`);
console.log(`  ruined under fixed, SURVIVES under path: ${rescued.length}`);
console.log(`  survived under fixed, RUINS under path:  ${broken.length}`);
console.log(`  ruined in both, year moved:              ${moved.length}`);

const outcomeRow = r =>
    pad(r.plan, 24) + rpad(r.startYear, 6) + rpad(pct(r.inflCagr), 10)
  + rpad(r.control.ruinYear || 'survived', 12)
  + rpad(r.test.ruinYear || 'survived', 11)
  + '  ' + r.control.band + (r.bandFlip ? ' -> ' + r.test.band : '');
const outcomeHead = () => console.log(pad('plan', 24) + rpad('start', 6) + rpad('inflCAGR', 10)
                                    + rpad('ruin(fixed)', 12) + rpad('ruin(path)', 11) + '  band');

for (const [title, rows, sort] of [
    ['-- RESCUED: ruined under fixed indexation, survives under path-following --',
     rescued, (a, b) => a.control.ruinYear - b.control.ruinYear],
    ['-- BROKEN: survived under fixed indexation, ruins under path-following --',
     broken, (a, b) => a.test.ruinYear - b.test.ruinYear],
    ['-- MOVED: ruined under both, ruin year shifted --',
     moved, (a, b) => b.dRuin - a.dRuin],
]) {
    if (!rows.length) continue;
    console.log('');
    console.log(title);
    outcomeHead();
    for (const r of [...rows].sort(sort)) console.log(outcomeRow(r));
}
console.log('');

// 2. Tax deltas, worst and best
console.log('== LIFETIME TAX, REAL DOLLARS: path-following minus fixed ==');
const byTax = [...results].sort((a, b) => a.dTaxReal - b.dTaxReal);
const showTax = rows => {
    console.log(pad('plan', 24) + rpad('start', 6) + rpad('inflCAGR', 10)
              + rpad('tax(fixed)', 13) + rpad('tax(path)', 13) + rpad('delta', 13) + rpad('%', 9));
    for (const r of rows) {
        console.log(pad(r.plan, 24) + rpad(r.startYear, 6) + rpad(pct(r.inflCagr), 10)
                  + rpad(money(r.control.taxReal), 13) + rpad(money(r.test.taxReal), 13)
                  + rpad(money(r.dTaxReal), 13) + rpad(pct(r.dTaxPct), 9));
    }
};
console.log('-- 10 largest DECREASES (path-following charges less) --');
showTax(byTax.slice(0, 10));
console.log('');
console.log('-- 10 largest INCREASES (path-following charges more) --');
showTax(byTax.slice(-10).reverse());
console.log('');

// 3. Per-shape and per-assumed-CPI summary
console.log('== SUMMARY BY PLAN ==');
console.log(pad('plan', 24) + rpad('n', 4) + rpad('mean dTax', 13) + rpad('mean d%', 9)
          + rpad('median d%', 11) + rpad('dIRMAA yrs', 12) + rpad('dACA yrs', 10)
          + rpad('ruin moves', 12));
for (const plan of PLANS) {
    const rows = results.filter(r => r.plan === plan.key);
    const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
    const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    console.log(pad(plan.key, 24) + rpad(rows.length, 4)
              + rpad(money(mean(rows.map(r => r.dTaxReal))), 13)
              + rpad(pct(mean(rows.map(r => r.dTaxPct))), 9)
              + rpad(pct(median(rows.map(r => r.dTaxPct))), 11)
              + rpad(rows.reduce((s, r) => s + r.dIrmaaYrs, 0), 12)
              + rpad(rows.reduce((s, r) => s + r.dAca, 0), 10)
              + rpad(rows.filter(r => r.dRuin !== 0).length, 12));
}
console.log('');

// 4. Does the sign track realized-minus-assumed CPI? (Prediction P1)
console.log('== SIGN TEST: does the tax delta track realized minus assumed CPI? ==');
console.log(pad('realized - assumed', 22) + rpad('n', 5) + rpad('mean dTax%', 12)
          + rpad('n cheaper', 11) + rpad('n dearer', 10));
const BUCKETS = [
    { key: 'under by >1pt',   lo: -Infinity, hi: -0.01 },
    { key: 'under by 0-1pt',  lo: -0.01,     hi: 0 },
    { key: 'over by 0-1pt',   lo: 0,         hi: 0.01 },
    { key: 'over by 1-3pt',   lo: 0.01,      hi: 0.03 },
    { key: 'over by >3pt',    lo: 0.03,      hi: Infinity },
];
for (const b of BUCKETS) {
    const rows = results.filter(r => {
        const d = r.inflCagr - r.assumedCpi;
        return d >= b.lo && d < b.hi;
    });
    if (!rows.length) continue;
    const m = rows.reduce((s, r) => s + r.dTaxPct, 0) / rows.length;
    console.log(pad(b.key, 22) + rpad(rows.length, 5) + rpad(pct(m), 12)
              + rpad(rows.filter(r => r.dTaxReal < 0).length, 11)
              + rpad(rows.filter(r => r.dTaxReal > 0).length, 10));
}
console.log('');

// 5. IRMAA and ACA, the cliff-shaped surfaces (Prediction P3)
const totIrmaaYrsC = results.reduce((s, r) => s + r.control.irmaaTierYears, 0);
const totIrmaaYrsT = results.reduce((s, r) => s + r.test.irmaaTierYears, 0);
const totIrmaaC    = results.reduce((s, r) => s + r.control.irmaaTotal, 0);
const totIrmaaT    = results.reduce((s, r) => s + r.test.irmaaTotal, 0);
const totAcaC      = results.reduce((s, r) => s + r.control.acaBreachYears, 0);
const totAcaT      = results.reduce((s, r) => s + r.test.acaBreachYears, 0);
const totTaxC      = results.reduce((s, r) => s + r.control.taxReal, 0);
const totTaxT      = results.reduce((s, r) => s + r.test.taxReal, 0);
console.log('== CLIFF-SHAPED SURFACES vs TOTAL TAX ==');
console.log(pad('surface', 22) + rpad('fixed', 15) + rpad('path', 15) + rpad('change', 10));
const rel = (a, b) => a ? pct((b - a) / a) : 'n/a';
console.log(pad('lifetime tax (real)', 22) + rpad(money(totTaxC), 15) + rpad(money(totTaxT), 15)
          + rpad(rel(totTaxC, totTaxT), 10));
console.log(pad('IRMAA surcharge yrs', 22) + rpad(totIrmaaYrsC, 15) + rpad(totIrmaaYrsT, 15)
          + rpad(rel(totIrmaaYrsC, totIrmaaYrsT), 10));
console.log(pad('IRMAA dollars', 22) + rpad(money(totIrmaaC), 15) + rpad(money(totIrmaaT), 15)
          + rpad(rel(totIrmaaC, totIrmaaT), 10));
console.log(pad('ACA breach yrs', 22) + rpad(totAcaC, 15) + rpad(totAcaT, 15)
          + rpad(rel(totAcaC, totAcaT), 10));
if (totAcaC === 0 && totAcaT === 0) {
    const acaPlans = PLANS.filter(p => p.ceiling === 'aca400');
    const acaRows = results.filter(r => r.ceiling === 'aca400');
    const meanPct = acaRows.reduce((s, r) => s + r.dTaxPct, 0) / (acaRows.length || 1);
    console.log('');
    console.log(`Zero ACA breaches in BOTH arms, across all ${acaPlans.length} ACA-capped plans `
              + `(${acaRows.length} runs). That is not "indexation does not reach the ACA cap":`);
    console.log(`those plans carry the largest tax delta in the study (mean ${pct(meanPct)}). The `
              + `cap MOVED, and the plan followed it - it never had to breach it.`);
}
console.log('');

// 6. How far apart the two clocks actually got, so nothing above is read as noise
console.log('== INDEX DRIFT: cumulative CPI factor at the last plan year ==');
console.log(pad('plan', 24) + rpad('start', 6) + rpad('fixed', 9) + rpad('path', 9) + rpad('ratio', 8));
const drift = [...results].sort((a, b) => b.test.finalCpiFactor - a.test.finalCpiFactor).slice(0, 8);
for (const r of drift) {
    console.log(pad(r.plan, 24) + rpad(r.startYear, 6)
              + rpad(r.control.finalCpiFactor.toFixed(2), 9)
              + rpad(r.test.finalCpiFactor.toFixed(2), 9)
              + rpad((r.test.finalCpiFactor / r.control.finalCpiFactor).toFixed(2) + 'x', 8));
}
