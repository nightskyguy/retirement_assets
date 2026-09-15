'use strict';
/**
 * rbg_harness.js -- Risk-based spending guardrails: can this engine compute them, what do they
 * cost, and where does the shipped Guardrails rule disagree with them?
 *
 * Run:  node .test_harnesses/rbg_harness.js
 *       PATHS=400 node .test_harnesses/rbg_harness.js          (paths per probability estimate)
 *       node .test_harnesses/rbg_harness.js --plans long-widowhood,bracket-filler-texas
 * About two minutes at the default 200 paths; every number it claims is printed as a table.
 *
 * THE SOURCE. Derek Tharp and Justin Fitzpatrick, "The Retirement Distribution 'Hatchet': Using
 * Risk-Based Guardrails To Project Sustainable Cash Flows", Kitces.com, 24 November 2021. Its
 * argument: withdrawal-rate guardrails assume a roughly level withdrawal rate, and real retirees
 * have a HATCHET - a high portfolio draw in the years before a deferred Social Security benefit
 * starts (the blade), a permanent drop when it does, then a slow decline as real spending falls
 * with age (the handle). A rule that judges a RATE cannot tell a planned change in that rate from
 * an unplanned one.
 *
 * ITS REPLACEMENT, in the article's own words, is a four-step recipe: solve for the spending that
 * hits an initial target probability of success; pick an upper and a lower rail; find the PORTFOLIO
 * VALUES that would put the plan on those rails today, so the rails reach the household in dollars;
 * and solve for the spending that returns the plan to target at each rail. This harness runs that
 * recipe. The article's own two parameter sets are both carried below, unchanged.
 *
 * WHY IT IS WORTH MEASURING HERE. The shipped Guardrails rule is Guyton-Klinger
 * (`spendRule: 'gk'`, optimizer_core.js resolveSpendTarget), and its trigger is
 * `spendGoal / prevPortfolio` against the same ratio in year 0. That ratio knows nothing about a
 * benefit that has not started yet, so a household retiring at 64 with benefits deferred to 70 - a
 * large, dated, near-certain income step - is judged on a rate that is high for a reason the rule
 * cannot see. The question is what that costs, in dollars, on households from the bank.
 *
 * WHAT IS COMPARED. For each household, four things:
 *   1. the guardrail SET at retirement - probability of success at the plan's own spend, and the
 *      spending that lands on each of five probability targets;
 *   1b. how far the shipped rule's own ratio moves in the pre-benefit years on a path with NO
 *      market variation, against its 1 +/- gkGuard band. That isolates the hatchet from the market;
 *   2. WHO ACTS FIRST - the first-year market return that makes each rule act. Guyton-Klinger is
 *      MEASURED, not re-derived from its formula: the year-0 return is bisected until the year-1
 *      row actually carries a cut (or a raise) in its `gkAdj` column;
 *   3. THE SHOCK - a fixed -22% / -13% pair in the first two years, the 2000-2002 shape, then the
 *      plan's own growth. What each rule does to real spending, and what it costs over a lifetime.
 *
 * AND ONE THING THAT IS NOT ABOUT THE ARTICLE (printed as section 5; it is section 6 of the
 * report). Everything above compares the rails to the rule this tool ships. This one asks a
 * different question that the comparison kept raising:
 * how far the shipped rule is from Guyton-Klinger AS PUBLISHED (Guyton 2004; Guyton and Klinger,
 * "Decision Rules and Maximum Initial Withdrawal Rates", Journal of Financial Planning, March
 * 2006). Four divergences are measurable from here - the rate the rule tests, the return the
 * inflation freeze reads, the missing suspension of the capital-preservation cut in the last 15
 * years, and the missing 6% cap on the inflation raise - and the first one decides the other
 * report sections, because it is the reason the hatchet is invisible to the rule.
 *
 * AND ONE MORE (printed as section 6; section 7 of the report), asked by the user on 2026-09-15:
 * how the rule COMPOSES with Spend Delta, the planned real drift the household sets. Two things
 * are measured. `gkSpendStable`
 * (optimizer_core.js:5261), the filter the Optimizer's spend and conversion searches apply, reads
 * the finished run's minimum real spendGoal against year 0 - and spendGoal carries the delta, so
 * the filter cannot tell a planned decline from a rule-driven slash. And `gkShapeCeiling`, the P127
 * prototype, holds the goal at the plan's own shape so raises can only undo prior cuts; what it
 * costs in spending and returns in ending wealth is priced here rather than argued.
 *
 * AND ONE LAST ONE (printed as section 7; section 8 of the report), asked by the user on
 * 2026-09-15: "early spending is significantly more valuable than late spending". Every spending
 * total above adds year 1 and year 30 at par, which silently prices a cut in the blade years the
 * same as one at 90. Section 7 re-scores the same runs with the year's spending discounted at 0%,
 * 3% and 5%, and reports where in the plan each rule's effect actually lands. The discount rate is
 * a PREFERENCE, not a measurement, which is why three of them are reported and none is called the
 * right one.
 *
 * HOW THE PROBABILITY IS COMPUTED. `buildBanks` / `buildPathInputs` from montecarlo/mc_engine.js -
 * the same per-path machinery the worker and the main-thread fallback use - then `simulate()` per
 * path, counting `totals.success`. Synthetic GBM at the page's own defaults (mu 7%, sigma 12%), one
 * seed, so every arm of one household sees identical draws (CRN) and a difference is the rule and
 * not the dice. A "re-plan" moves `startInYear`/`startYear` forward and replaces the balances with
 * the ones the realized year produced; ages and the horizon follow from the birth years. Spending
 * is carried forward in NOMINAL dollars (multiplied by that year's inflation factor), which is what
 * leaving real spending unchanged means.
 *
 * WHAT THIS HARNESS DOES NOT DO. It does not run a risk-based rule INSIDE a Monte Carlo path. That
 * needs a probability estimate at every path-year - three to four orders of magnitude more engine
 * runs than anything here - and pricing that is what the cost table at the end is for.
 *
 * ENGINE NOTE. v11.1823 (`1842270`). Probabilities move with the engine, so a number quoted from
 * this harness belongs with that commit and not with an earlier report.
 *
 * -- PREDICTIONS, registered before the first run on 2026-09-15 --------------------------------
 * Registered against a 25% lower rail, which is what the second-hand summaries available at the
 * time said the rule used. The source document arrived afterwards and carries two parameter sets,
 * neither of them that one, so each prediction is scored against BOTH of the article's sets rather
 * than re-aimed.
 *   G-P1. On a benign path the shipped rule fires in the pre-Social-Security years of a deferred-
 *         benefit household: the portfolio is carrying the whole spend, so the rate rises fast
 *         enough to cross the 20% band before the benefit arrives.
 *   G-P2. After a market drop the shipped rule cuts EARLIER and DEEPER than a probability-of-
 *         success rail would, on every household tested.
 *   G-P3. The shipped rule's trigger is nearly household-INDEPENDENT (it is a function of the band
 *         and inflation), while the risk-based rail moves household by household by at least 20
 *         points of first-year return across the four.
 *   G-P4. A full guardrail set is computable at interactive cost: under 30 seconds per household
 *         at 200 paths.
 * Scored at the end of the run.
 */

globalThis.performance = { now: () => Date.now() };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
Object.assign(globalThis, require('../taxengine.js'));
Object.assign(globalThis, require('../optimizer_core.js'));
Object.assign(globalThis, require('../montecarlo/prng.js'));
Object.assign(globalThis, require('../montecarlo/stats.js'));
const core = require('../optimizer_core.js');
const mc   = require('../montecarlo/mc_engine.js');
const PLANS = require('../plans');
const { simulate } = core;
const { buildBanks, buildPathInputs } = mc;

// ---- knobs -----------------------------------------------------------------------------------
const PATHS = Number(process.env.PATHS || 200);
const MODE  = 'gbm';
const MU    = 0.07, SIGMA = 0.12;     // the page's own #mc-mu / #mc-sigma defaults
const SEED  = 42;
const STEPS = 9;                      // bisection steps; 9 puts a spend answer inside ~0.4%

// THE ARTICLE'S OWN TWO PARAMETER SETS, neither invented here.
//   A is its implementation recipe: "solve for an initial target probability of success (e.g.,
//     90%) ... increase spending at 99% probability of success; decrease spending at 70%".
//   B is its income-risk framing: "target an initial income risk of 20% ... increase income if the
//     risk goes down to 0% ... decrease income if the risk rises to 60%", read as probability of
//     success, since risk is its complement. B's upper rail is unreachable in a finite sample by
//     anything except "every path survived", which is what 1.00 means here - and why the number of
//     paths is part of that answer rather than a detail of it.
// Both reset spending to the target once a rail is hit, which is the article's own suggestion for
// the size of the adjustment ("return to an income with the target risk level").
const RAIL_SETS = [
    { name: 'A 90/99/70',  target: 0.90, upper: 0.99, lower: 0.70 },
    { name: 'B 80/100/40', target: 0.80, upper: 1.00, lower: 0.40 },
];
const PRIMARY = RAIL_SETS[0];
const SPEND_TARGETS = [0.95, 0.90, 0.80, 0.70, 0.40];

// Households with the shape this is about: retirement starts years before a deferred benefit.
// The defaults are resolved through the bank rather than listed as bare strings, for two reasons:
// `get()` throws on an unknown id, so a typo fails at startup instead of halfway through a
// four-minute run, and `which_plan.js` finds a household by matching `PLANS.get('...')` - a list of
// strings would make this harness invisible to the one tool that answers "what does it run on?".
const PLAN_IDS = (process.argv.includes('--plans')
    ? process.argv[process.argv.indexOf('--plans') + 1].split(',')
    : [PLANS.get('bracket-filler-texas').id,
       PLANS.get('mixed-portfolio-couple').id,
       PLANS.get('long-widowhood').id,
       PLANS.get('age-gap-ira-heavy-ca').id]);

const SHOCK = [-0.22, -0.13];         // the 2000-2002 shape, then the plan's own growth

let SIMS = 0, CRASHES = 0;
const money = x => '$' + Math.round(x).toLocaleString();
const pctS  = x => (x * 100).toFixed(1) + '%';
const pad  = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

// ---- the model -------------------------------------------------------------------------------
function rowsOf(inputs) { return simulate({ ...inputs }).log.length; }

function banksFor(base, years) {
    const cfg = { years, numPaths: PATHS, seed: SEED, baseInputs: base,
                  mu: MU, sigma: SIGMA, inflationRate: base.inflation ?? 0.025 };
    return buildBanks(cfg, mulberry32(SEED), MODE);
}

// Share of paths whose plan funds every year. The bank must be at least as long as the plan: a path
// that runs off the end of its return sequence throws inside applyGrowth, and a caught throw would
// read as a failure, which is how a 0% probability gets manufactured out of a fixture error.
function posOf(banks, base, years, over) {
    let ok = 0;
    for (let p = 0; p < banks.numPaths; p++) {
        const pathIn = buildPathInputs(banks, p, years, base, MODE);
        SIMS++;
        let r;
        try { r = simulate({ ...base, ...over, ...pathIn }); }
        catch (e) { CRASHES++; continue; }
        if (r?.totals?.success) ok++;
    }
    return ok / banks.numPaths;
}

// Generic bisection. `below(mid)` answers "is mid below the crossing?"; the answer is the midpoint
// of the final bracket. Never breaks early: the probability curve is monotone in expectation but
// noisy at 200 paths, and an early exit on one flat step would report the noise as the answer.
function bisect(lo, hi, below, steps = STEPS) {
    for (let i = 0; i < steps; i++) {
        const mid = (lo + hi) / 2;
        if (below(mid)) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
}

// The state one year in, after a first-year return of `r`: balances as that year left them, real
// spending unchanged, horizon and ages shortened by the year that passed.
function stateAfterYear(base, rows, r) {
    const seq = new Float64Array(rows + 3).fill(base.growth ?? 0.06);
    seq[0] = r;
    const inf = new Float64Array(rows + 3).fill(base.inflation ?? 0.025);
    const row = simulate({ ...base, returnSequence: seq, inflationSequence: inf }).log[0];
    const f = row.inflationFactor || 1;
    return {
        inputs: { ...base, startInYear: row.year + 1, startYear: row.year + 1,
                  IRA1: row.IRA1, IRA2: row.IRA2, Roth: row.Roth1, Roth2: row.Roth2,
                  Brokerage: row.Brokerage, BrokerageBasis: row.Basis, Cash: row.Cash,
                  spendGoal: (base.spendGoal ?? 0) * f },
        portfolio: row.portfolioBalance,
    };
}

// Does the SHIPPED rule act in year 1, given a first-year return of `r`? Read off the `gkAdj`
// column rather than re-derived from the rule's formula, so this measures what the engine does.
function gkActs(base, rows, r, kind) {
    const seq = new Float64Array(rows + 3).fill(base.growth ?? 0.06);
    seq[0] = r;
    const inf = new Float64Array(rows + 3).fill(base.inflation ?? 0.025);
    const label = simulate({ ...base, spendRule: 'gk', returnSequence: seq, inflationSequence: inf })
        .log[1]?.gkAdj || '';
    return kind === 'cut' ? label.includes('cap') : label.includes('pros');
}

// ---- per-household study ---------------------------------------------------------------------
const sets = [], benigns = [], firsts = [], shocks = [], costs = [];

for (const id of PLAN_IDS) {
    const plan = PLANS.get(id);
    const base = { ...plan.inputs };
    const t0 = Date.now(), sims0 = SIMS;
    const rows = rowsOf(base);
    const years = rows + 3;
    const banks = banksFor(base, years);
    const spend0 = base.spendGoal ?? 0;
    const port0 = ['IRA1','IRA2','Roth','Roth2','Brokerage','Cash']
        .reduce((t, k) => t + (base[k] || 0), 0);

    // 1. The guardrail set at retirement: where the plan sits, and what each target is worth.
    const p0 = posOf(banks, base, years, {});
    const spendAt = t => bisect(spend0 * 0.25, spend0 * 3,
        v => posOf(banks, base, years, { spendGoal: v }) > t);
    const spends = {};
    for (const t of SPEND_TARGETS) spends[t] = spendAt(t);
    sets.push({ id, port0, spend0, p0, spends });

    // 1b. The hatchet on its own, with the market held still: how far the shipped rule's ratio
    // moves in the pre-benefit years. Its trigger is spendGoal / start-of-year portfolio, against
    // the same ratio in year 0, so only the drawdown moves it.
    const flat = new Float64Array(years).fill(base.growth ?? 0.06);
    const flatInf = new Float64Array(years).fill(base.inflation ?? 0.025);
    const benign = simulate({ ...base, spendRule: 'gk', returnSequence: flat, inflationSequence: flatInf });
    const iwr = spend0 / port0;
    let peak = 1;
    for (let i = 1; i < Math.min(benign.log.length, 7); i++) {
        const prev = benign.log[i - 1].portfolioBalance;
        if (prev > 0) peak = Math.max(peak, (benign.log[i].spendGoal / prev) / iwr);
    }
    benigns.push({ id, peak, band: 1 + (base.gkGuard ?? 0.20),
                   fired: benign.log.slice(0, 7).some(r => { const a = r.gkAdj || ''; return a && a !== '—'; }) });

    // 2. Who acts first. The shipped rule is measured at the plan's own spend, because that is what
    // it is applied to; each risk-based rail is measured from ITS OWN target spend, because that is
    // what a household following that rule is spending. The extra "same spend" line holds the
    // primary rail to the plan's number too, so the rule and the spending level can be separated -
    // without it the two answers differ in two things at once and neither can be read.
    const railReturn = (railBase, target) => bisect(-0.85, 0.85, r => {
        const st = stateAfterYear(railBase, rows, r);
        return posOf(banksFor(st.inputs, years), st.inputs, years, {}) < target;
    });
    const rCutGK   = bisect(-0.85, 0.30, r => gkActs(base, rows, r, 'cut'));
    const rRaiseGK = bisect(-0.10, 1.50, r => !gkActs(base, rows, r, 'pros'));
    const rails = RAIL_SETS.map(set => {
        const atTarget = { ...base, spendGoal: spends[set.target] };
        const rCut = railReturn(atTarget, set.lower);
        const rRaise = railReturn(atTarget, set.upper);
        return { set: set.name, rCut, rRaise,
                 portCut: stateAfterYear(atTarget, rows, rCut).portfolio,
                 portRaise: stateAfterYear(atTarget, rows, rRaise).portfolio };
    });
    const rCutSameSpend = railReturn(base, PRIMARY.lower);
    firsts.push({ id, rCutGK, rRaiseGK, rCutSameSpend, rails,
                  portCutGK: stateAfterYear(base, rows, rCutGK).portfolio });

    // 3. The shock, and what each rule does about it.
    const seq = new Float64Array(years).fill(base.growth ?? 0.06);
    seq[1] = SHOCK[0]; seq[2] = SHOCK[1];
    const inf = new Float64Array(years).fill(base.inflation ?? 0.025);
    const off = simulate({ ...base, returnSequence: seq, inflationSequence: inf });
    const on  = simulate({ ...base, spendRule: 'gk', returnSequence: seq, inflationSequence: inf });
    const real = row => (row.spendGoal || 0) / (row.inflationFactor || 1);
    // MEASURED AGAINST THE PLAN'S OWN REAL SPENDING PATH, year by year, not against year 0. A
    // household whose plan already declines 1%/year in real terms (spendChange, which
    // age-gap-ira-heavy-ca carries) would otherwise be scored as though the rule had cut spending
    // that the plan gives up on purpose - a quarter of that household's decline is its own smile.
    const trough = Math.min(...on.log.map(real));
    const troughRatio = Math.min(...on.log.map((r, i) => real(r) / (real(off.log[i]) || 1)));
    const below = on.log.filter((r, i) => real(r) < real(off.log[i]) * 0.995).length;
    // Both rules are read at the same moment: the year the shipped rule stopped cutting.
    const cuts = on.log.filter(r => (r.gkAdj || '').includes('cap'));
    const lastCut = cuts.length ? cuts[cuts.length - 1] : on.log[3];
    const idx = on.log.findIndex(r => r.year === lastCut.year);
    const rowOff = off.log[idx];
    const fOff = rowOff.inflationFactor || 1;
    const st = { ...base, startInYear: rowOff.year + 1, startYear: rowOff.year + 1,
        IRA1: rowOff.IRA1, IRA2: rowOff.IRA2, Roth: rowOff.Roth1, Roth2: rowOff.Roth2,
        Brokerage: rowOff.Brokerage, BrokerageBasis: rowOff.Basis, Cash: rowOff.Cash,
        spendGoal: spend0 * fOff };
    const bShock = banksFor(st, years);
    const pShock = posOf(bShock, st, years, {});
    const actions = RAIL_SETS.map(set => {
        const act = pShock < set.lower ? 'cut' : pShock > set.upper ? 'raise' : 'no change';
        const spend = act === 'no change' ? spend0 * fOff
            : bisect(spend0 * fOff * 0.25, spend0 * fOff * 3,
                     v => posOf(bShock, st, years, { spendGoal: v }) > set.target);
        return { set: set.name, act, real: spend / fOff };
    });
    shocks.push({ id, year: rowOff.year, portfolio: rowOff.portfolioBalance, pShock, actions,
        gkTrough: trough, gkTroughRatio: troughRatio, gkBelow: below, gkYears: on.log.length,
        gkLifetime: on.totals.spendCurrentDollars, offLifetime: off.totals.spendCurrentDollars,
        offSuccess: off.totals.success, onSuccess: on.totals.success });

    costs.push({ id, rows, sims: SIMS - sims0, secs: (Date.now() - t0) / 1000 });
    console.log(`  ${id}: done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ---- output ----------------------------------------------------------------------------------
console.log('\nRISK-BASED GUARDRAILS  ' + PATHS + ' paths/estimate, synthetic GBM mu ' + MU
    + ' sigma ' + SIGMA + ', seed ' + SEED + ', ' + STEPS + ' bisection steps.');
console.log('Rail sets, both the article\'s: '
    + RAIL_SETS.map(s => s.name + ' (target ' + pctS(s.target) + ', raise at ' + pctS(s.upper)
        + ', cut at ' + pctS(s.lower) + ')').join('   |   '));

console.log('\n1. THE GUARDRAIL SET AT RETIREMENT - spending that lands on each probability');
console.log(pad('household', 26) + rpad('portfolio', 12) + rpad('plan spend', 12) + rpad('P(success)', 12)
    + SPEND_TARGETS.map(t => rpad('at ' + (t * 100) + '%', 11)).join(''));
for (const s of sets) {
    console.log(pad(s.id, 26) + rpad(money(s.port0), 12) + rpad(money(s.spend0), 12)
        + rpad(pctS(s.p0), 12) + SPEND_TARGETS.map(t => rpad(money(s.spends[t]), 11)).join(''));
}

console.log('\n1b. THE HATCHET ON ITS OWN - the pre-benefit years with the market held still');
console.log(pad('household', 26) + rpad('peak ratio', 12) + rpad('band', 8) + rpad('shipped rule fired', 20));
for (const b of benigns) {
    console.log(pad(b.id, 26) + rpad(b.peak.toFixed(3), 12) + rpad(b.band.toFixed(2), 8)
        + rpad(b.fired ? 'yes' : 'no', 20));
}

console.log('\n2. WHO ACTS FIRST - the first-year market return each rule needs before it moves');
for (const f of firsts) {
    console.log('  ' + pad(f.id, 24) + 'shipped rule    cut at ' + rpad(pctS(f.rCutGK), 8)
        + '  raise at ' + rpad(pctS(f.rRaiseGK), 8) + '   portfolio at the cut ' + money(f.portCutGK));
    for (const r of f.rails) {
        console.log('  ' + pad('  rails ' + r.set, 24) + 'at its target   cut at ' + rpad(pctS(r.rCut), 8)
            + '  raise at ' + rpad(pctS(r.rRaise), 8)
            + '   ' + money(r.portCut) + ' / ' + money(r.portRaise));
    }
    console.log('  ' + pad('  rails ' + PRIMARY.name, 24) + 'at the plan\'s own spend   cut at '
        + pctS(f.rCutSameSpend));
}

console.log('\n3. THE SHOCK - ' + pctS(SHOCK[0]) + ' then ' + pctS(SHOCK[1]) + ' in years 2-3');
console.log(pad('household', 26) + rpad('GK trough (real)', 18) + rpad('vs plan path', 14)
    + rpad('yrs below plan', 16)
    + rpad('GK lifetime', 14) + rpad('GK funded', 12)
    + rpad('no-rule lifetime', 18) + rpad('no-rule funded', 16));
for (const s of shocks) {
    console.log(pad(s.id, 26) + rpad(money(s.gkTrough), 18)
        + rpad(((s.gkTroughRatio - 1) * 100).toFixed(1) + '%', 14)
        + rpad(s.gkBelow + '/' + s.gkYears, 16)
        + rpad(money(s.gkLifetime), 14) + rpad(s.onSuccess ? 'every year' : 'NO', 12)
        + rpad(money(s.offLifetime), 18) + rpad(s.offSuccess ? 'every year' : 'NO', 16));
}
console.log('   the risk-based read at the same moment, spending never having been cut:');
for (const s of shocks) {
    console.log('   ' + pad(s.id, 26) + s.year + '  portfolio ' + rpad(money(s.portfolio), 12)
        + '  P(success) ' + rpad(pctS(s.pShock), 8)
        + s.actions.map(a => '   ' + a.set + ': ' + pad(a.act, 9) + ' -> ' + rpad(money(a.real), 10)).join(''));
}

console.log('\n4. COST');
console.log(pad('household', 26) + rpad('plan years', 12) + rpad('engine runs', 14)
    + rpad('seconds', 10) + rpad('ms/run', 9));
for (const c of costs) {
    console.log(pad(c.id, 26) + rpad(c.rows, 12) + rpad(c.sims.toLocaleString(), 14)
        + rpad(c.secs.toFixed(1), 10) + rpad((c.secs * 1000 / c.sims).toFixed(2), 9));
}
console.log('   one probability estimate = ' + PATHS + ' engine runs; one spend or rail answer = '
    + STEPS + ' estimates; crashes: ' + CRASHES);

// ---- 5. fidelity to Guyton-Klinger as published (report section 6) ----------------------------
// Published GK tests PORTFOLIO WITHDRAWALS / PORTFOLIO against the same ratio in year 0. The engine
// computes that quantity already - `yr._wdRate`, the `wdRate%` column - and the shipped rule does
// not use it. Both ratios are read off ONE run with the rule OFF, at the plan's own deterministic
// growth and CPI, so the market cannot move either of them and the difference is the numerator.
//
// WHAT THIS CANNOT SHOW, and the honest limit of it: the "would have" column is the first year the
// published ratio leaves the band, on a path where NO adjustment is ever applied. A real published
// GK run would adjust at that point and move its own ratio afterwards, so the column is the first
// DIVERGENCE, not a simulation of the published rule.
console.log('\n5. FIDELITY TO GUYTON-KLINGER AS PUBLISHED  (report section 6)');
console.log('   the ratio each rule tests, as a multiple of its own year-0 value, band 0.80-1.20');
console.log(pad('household', 26) + rpad('shipped range', 14) + rpad('outside', 10)
    + rpad('published range', 18) + rpad('outside', 10) + '   ' + 'first divergence');
const fid = [];
for (const id of PLAN_IDS) {
    const base = { ...PLANS.get(id).inputs };
    const run = simulate({ ...base });
    const port0 = ['IRA1','IRA2','Roth','Roth2','Brokerage','Cash']
        .reduce((t, k) => t + (base[k] || 0), 0);
    const gk0 = (base.spendGoal ?? 0) / port0;
    const pub0 = run.log[0]['wdRate%'] || 0;
    let gkLo = Infinity, gkHi = 0, pubLo = Infinity, pubHi = 0, gkOut = 0, pubOut = 0, first = null;
    run.log.forEach((row, i) => {
        const prev = i === 0 ? port0 : run.log[i - 1].portfolioBalance;
        const gk = (row.spendGoal / prev) / gk0;
        const pub = pub0 > 0 ? (row['wdRate%'] || 0) / pub0 : 1;
        gkLo = Math.min(gkLo, gk); gkHi = Math.max(gkHi, gk);
        pubLo = Math.min(pubLo, pub); pubHi = Math.max(pubHi, pub);
        if (gk > 1.2 || gk < 0.8) gkOut++;
        if (pub > 1.2 || pub < 0.8) {
            pubOut++;
            if (!first) first = { year: row.year, dir: pub > 1.2 ? 'cut' : 'raise', pub, gk };
        }
    });
    fid.push({ id, gkLo, gkHi, pubLo, pubHi, gkOut, pubOut, first, years: run.log.length });
    console.log(pad(id, 26) + rpad(gkLo.toFixed(2) + '-' + gkHi.toFixed(2), 14)
        + rpad(gkOut + '/' + run.log.length, 10)
        + rpad(pubLo.toFixed(2) + '-' + pubHi.toFixed(2), 18)
        + rpad(pubOut + '/' + run.log.length, 10) + '   '
        + (first ? `${first.year} ${first.dir} - published ratio ${first.pub.toFixed(2)}, shipped ${first.gk.toFixed(2)}`
                 : 'never leaves the band'));
}

// The freeze signal. `sim.gkPriorReturn = yr.baseReturn` is the scenario's BASE (equity) return;
// published GK freezes on the PORTFOLIO's total return. They differ only where the accounts get
// their own blended sequences, which is the Historical and stress banks, not GBM.
console.log('\n   the inflation freeze reads the base (equity) return, not the portfolio return:');
{
    const base = { ...PLANS.get(PLAN_IDS[0]).inputs };
    const years = 40;
    const cfg = { years, numPaths: PATHS, seed: SEED, baseInputs: base,
                  mu: MU, sigma: SIGMA, inflationRate: base.inflation ?? 0.025 };
    for (const mode of ['bootstrap', 'gbm']) {
        const banks = buildBanks(cfg, mulberry32(SEED), mode);
        let disagree = 0, total = 0, neg = 0;
        for (let p = 0; p < banks.numPaths; p++) {
            const pi = buildPathInputs(banks, p, years, base, mode);
            const psa = pi.returnSequencePerAccount;
            for (let y = 0; y < years; y++) {
                const eq = pi.returnSequence[y];
                const blend = psa ? (psa.IRA1[y] + psa.Brokerage[y]) / 2 : eq;
                total++;
                if (eq < 0) neg++;
                if ((eq < 0) !== (blend < 0)) disagree++;
            }
        }
        console.log('   ' + pad(mode, 12) + rpad(pctS(neg / total), 8) + ' of path-years are equity-negative; '
            + rpad(pctS(disagree / total), 8) + ' disagree in sign with the blended account return');
    }
}

// The two omissions that are only visible under the right conditions.
console.log('\n   capital-preservation cuts inside the final 15 years (published GK suspends them there):');
for (const id of PLAN_IDS) {
    const base = { ...PLANS.get(id).inputs };
    const rows = rowsOf(base);
    const seq = new Float64Array(rows + 3).fill(base.growth ?? 0.06);
    seq[1] = SHOCK[0]; seq[2] = SHOCK[1];
    const inf = new Float64Array(rows + 3).fill(base.inflation ?? 0.025);
    const on = simulate({ ...base, spendRule: 'gk', returnSequence: seq, inflationSequence: inf });
    const n = on.log.length;
    const cuts = on.log.map((r, i) => ({ i, a: r.gkAdj || '' })).filter(x => x.a.includes('cap'));
    const late = cuts.filter(x => x.i >= n - 15).length;
    const raises = on.log.filter(r => (r.gkAdj || '').includes('pros')).length;
    console.log('   ' + pad(id, 26) + n + ' years: ' + cuts.length + ' cuts (' + late
        + ' in the final 15), ' + raises + ' raises');
}
{
    const base = { ...PLANS.get(PLAN_IDS[0]).inputs };
    const years = 40;
    const cfg = { years, numPaths: PATHS, seed: SEED, baseInputs: base,
                  mu: MU, sigma: SIGMA, inflationRate: base.inflation ?? 0.025 };
    const banks = buildBanks(cfg, mulberry32(SEED), 'gbm');
    let over = 0, total = 0, worst = 0;
    for (let p = 0; p < banks.numPaths; p++) {
        const seq = buildPathInputs(banks, p, years, base, 'gbm').inflationSequence;
        if (!seq) continue;
        for (let y = 0; y < years; y++) { total++; worst = Math.max(worst, seq[y]); if (seq[y] > 0.06) over++; }
    }
    console.log('\n   the published 6% cap on the inflation raise, which this engine does not apply: '
        + pctS(over / total) + ' of path-years draw inflation above 6%, worst ' + pctS(worst));
}

// ---- 6. how the rule composes with Spend Delta (report section 7) -----------------------------
// (a) The filter. gkSpendStable rejects a candidate spend or conversion when the run's minimum real
// spendGoal falls more than gkGuard below year 0. Run at the plan's own growth with NO shock, so a
// household that trips it with zero cuts has been rejected for its own planned shape.
console.log('\n6. HOW THE RULE COMPOSES WITH SPEND DELTA  (report section 7)');
console.log('   (a) gkSpendStable, the Optimizer\'s search filter, against a planned decline');
console.log('       flat returns at the plan\'s own growth, so any cut is the rule reacting to nothing');
console.log(pad('household', 26) + rpad('delta', 8) + rpad('GK cuts', 10)
    + rpad('min real / year 0', 19) + rpad('gkSpendStable', 15));
for (const id of PLAN_IDS) {
    for (const delta of [0, -0.01]) {
        const base = { ...PLANS.get(id).inputs, spendChange: delta };
        const years = rowsOf(base) + 3;
        const flat = new Float64Array(years).fill(base.growth ?? 0.06);
        const flatInf = new Float64Array(years).fill(base.inflation ?? 0.025);
        const res = simulate({ ...base, spendRule: 'gk', returnSequence: flat, inflationSequence: flatInf });
        const real = r => r.spendGoal / (r.inflationFactor || 1);
        const ratio = Math.min(...res.log.map(real)) / real(res.log[0]);
        const cuts = res.log.filter(r => (r.gkAdj || '').includes('cap')).length;
        console.log(pad(id, 26) + rpad((delta * 100).toFixed(0) + '%', 8) + rpad(cuts, 10)
            + rpad(ratio.toFixed(3), 19) + rpad(core.gkSpendStable(res, { spendRule: 'gk' }, base) ? 'accepted' : 'REJECTED', 15));
    }
}
console.log('   a -1%/year shape alone crosses the 0.80 floor at year '
    + Math.ceil(Math.log(0.8) / Math.log(0.99)) + ', with no market move and no cut.');

// What the filter does to the search it guards. optimizeSpend drives its binary search on
// passes(), and passes() fails whenever gkSpendStable does - so a household whose SHAPE breaches
// the floor can end the search with no answer at all, at any spend level.
console.log('\n       what that costs the search that uses it (optimizeSpend, the plan\'s own strategy):');
console.log(pad('household', 26) + rpad('delta', 8) + rpad('Guardrails on', 18) + rpad('Guardrails off', 18));
for (const id of PLAN_IDS) {
    for (const delta of [0, -0.01]) {
        const base = { ...PLANS.get(id).inputs, spendChange: delta };
        const on  = core.optimizeSpend({ ...base, spendRule: 'gk' }, { spendRule: 'gk' });
        const off = core.optimizeSpend({ ...base, spendRule: undefined }, {});
        const show = r => r ? money(r.optimizedSpend ?? r.spend ?? 0) : 'no viable spend';
        console.log(pad(id, 26) + rpad((delta * 100).toFixed(0) + '%', 8)
            + rpad(show(on), 18) + rpad(show(off), 18));
    }
}

// (b) The prototype. Same households, twice: the rule as shipped, and the rule with its goal held
// at the plan's own shape. Benign path first (where only the raises differ), then the shock.
console.log('\n   (b) gkShapeCeiling: what holding the goal at the shape costs and returns');
console.log(pad('household', 26) + rpad('path', 8) + rpad('peak real/shape', 17)
    + rpad('clamped yrs', 13) + rpad('lifetime real spend', 21) + rpad('ending wealth', 15));
for (const id of PLAN_IDS) {
    const base = { ...PLANS.get(id).inputs };
    const years = rowsOf(base) + 3;
    const delta = 1 + (base.spendChange ?? 0);
    const shapeReal = y => (base.spendGoal ?? 0) * Math.pow(delta, y);
    for (const [label, seq] of [['benign', null], ['shock', SHOCK]]) {
        const ret = new Float64Array(years).fill(base.growth ?? 0.06);
        if (seq) { ret[1] = seq[0]; ret[2] = seq[1]; }
        const inf = new Float64Array(years).fill(base.inflation ?? 0.025);
        const runs = [false, true].map(ceil => simulate({ ...base, spendRule: 'gk',
            gkShapeCeiling: ceil, returnSequence: ret, inflationSequence: inf }));
        runs.forEach((res, i) => {
            const peak = Math.max(...res.log.map((r, y) =>
                (r.spendGoal / (r.inflationFactor || 1)) / shapeReal(y)));
            const clamped = res.log.filter(r => (r.gkAdj || '').includes('@shape')).length;
            console.log(pad(i === 0 ? id : '  with the ceiling', 26) + rpad(label, 8)
                + rpad(peak.toFixed(3), 17) + rpad(clamped, 13)
                + rpad(money(res.totals.spendCurrentDollars), 21)
                + rpad(money(res.finalNW), 15));
        });
    }
}

// ---- 7. early spending against late spending (report section 8) -------------------------------
// Per-year real spending reconstructed as (spendGoal + shortfall) / inflationFactor, which sums to
// totals.spendCurrentDollars to the dollar on every run measured - the engine's own accumulator is
// the same expression (optimizer_core.js:4386), so this is its per-year decomposition rather than a
// second definition of delivered spending.
console.log('\n7. EARLY SPENDING AGAINST LATE SPENDING  (report section 8)');
console.log('   the same runs, with the year\'s real spending discounted at 0%, 3% and 5%');
console.log('   a discount rate is a preference, not a measurement: three are shown, none is the right one');
const DISCOUNTS = [0, 0.03, 0.05];
function spendProfile(res) {
    const real = res.log.map(r => (r.spendGoal + (r.shortfall || 0)) / (r.inflationFactor || 1));
    const total = d => real.reduce((t, v, y) => t + v / Math.pow(1 + d, y), 0);
    const first10 = real.slice(0, 10).reduce((t, v) => t + v, 0);
    return { real, totals: DISCOUNTS.map(total), first10, all: total(0) };
}
console.log('\n   what the rule costs, and what the ceiling costs, by discount rate');
console.log(pad('household', 26) + rpad('path', 8) + rpad('comparison', 24)
    + DISCOUNTS.map(d => rpad('at ' + (d * 100) + '%', 13)).join('') + rpad('first 10 yrs', 16));
for (const id of PLAN_IDS) {
    const base = { ...PLANS.get(id).inputs };
    const years = rowsOf(base) + 3;
    const inf = new Float64Array(years).fill(base.inflation ?? 0.025);
    for (const [label, sh] of [['benign', null], ['shock', SHOCK]]) {
        const ret = new Float64Array(years).fill(base.growth ?? 0.06);
        if (sh) { ret[1] = sh[0]; ret[2] = sh[1]; }
        const common = { returnSequence: ret, inflationSequence: inf };
        const off  = spendProfile(simulate({ ...base, ...common }));
        const rule = spendProfile(simulate({ ...base, spendRule: 'gk', ...common }));
        const ceil = spendProfile(simulate({ ...base, spendRule: 'gk', gkShapeCeiling: true, ...common }));
        const line = (name, a, b) => pad('', 26) + rpad(label, 8) + rpad(name, 24)
            + DISCOUNTS.map((d, i) => rpad(((a.totals[i] / b.totals[i] - 1) * 100).toFixed(1) + '%', 13)).join('')
            + rpad(((a.first10 / b.first10 - 1) * 100).toFixed(1) + '%', 16);
        console.log(pad(id, 26) + rpad(label, 8) + rpad('no rule, real spend', 24)
            + DISCOUNTS.map((d, i) => rpad(money(off.totals[i]), 13)).join('')
            + rpad(money(off.first10), 16));
        console.log(line('the rule vs no rule', rule, off));
        console.log(line('the ceiling vs not', ceil, rule));
    }
}

// ---- predictions -----------------------------------------------------------------------------
const anyFired = benigns.some(b => b.fired);
const worstPeak = Math.max(...benigns.map(b => b.peak));
const earlierPer = RAIL_SETS.map((set, i) => firsts.every(f => f.rCutGK > f.rails[i].rCut));
const deeperPer  = RAIL_SETS.map((set, i) => shocks.every(s => s.gkTrough < s.actions[i].real));
const gkSpread = Math.max(...firsts.map(f => f.rCutGK)) - Math.min(...firsts.map(f => f.rCutGK));
const railSpread = RAIL_SETS.map((set, i) =>
    Math.max(...firsts.map(f => f.rails[i].rCut)) - Math.min(...firsts.map(f => f.rails[i].rCut)));
const slowest = Math.max(...costs.map(c => c.secs));

console.log('\nPREDICTIONS  (scored against both rail sets; see the header for why)');
console.log('  G-P1 shipped rule fires in the pre-benefit years on a benign path ..... '
    + (anyFired ? 'CONFIRMED' : 'REFUTED')
    + '  (closest approach ' + worstPeak.toFixed(3) + ' against a ' + benigns[0].band.toFixed(2) + ' band)');
RAIL_SETS.forEach((set, i) => {
    console.log('  G-P2 shipped rule cuts earlier AND deeper, rails ' + pad(set.name, 12) + ' .. '
        + (earlierPer[i] && deeperPer[i] ? 'CONFIRMED' : earlierPer[i] || deeperPer[i] ? 'PARTLY' : 'REFUTED')
        + '  (earlier: ' + earlierPer[i] + ', deeper: ' + deeperPer[i] + ')');
});
RAIL_SETS.forEach((set, i) => {
    console.log('  G-P3 shipped trigger flat, rail moves 20+ points, rails ' + pad(set.name, 12) + ' '
        + (PLAN_IDS.length < 2 ? 'NOT TESTED (one household)'
           : gkSpread < 0.05 && railSpread[i] > 0.20 ? 'CONFIRMED' : 'REFUTED')
        + '  (shipped spread ' + pctS(gkSpread) + ', rail spread ' + pctS(railSpread[i]) + ')');
});
console.log('  G-P4 a full guardrail set costs under 30s per household at 200 paths .. '
    + (slowest < 30 ? 'CONFIRMED' : 'REFUTED') + '  (slowest ' + slowest.toFixed(1) + 's)');
