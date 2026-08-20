'use strict';
/**
 * irmaa_cpi_risk_harness.js -- does an IRMAA safety margin earn its keep once the CPI that indexes
 * the thresholds is allowed to differ from the one the plan assumed?
 *
 * Run:  node .test_harnesses/irmaa_cpi_risk_harness.js
 *
 * THE GAP THIS EXISTS TO CLOSE
 * irmaa_margin_harness.js measured the margin's COST and found its benefit to be exactly zero. That
 * was the only answer available to it: with a constant CPI the engine hits its ceiling to the
 * dollar, so there is no error for a margin to absorb. The obvious fix - "run it under Monte Carlo
 * or the Stress Test, those vary inflation" - does not work, and that is worth stating precisely
 * because it looks like it should:
 *
 *     sim.cpiRate  *= (1 + inputs.cpi);        // optimizer_core.js -- CONSTANT, every path
 *     sim.inflation *= (1 + yr.yearInflation);  // path-varying, from inputs.inflationSequence
 *
 * `inflationSequence` drives SPENDING inflation. The CPI that indexes the IRMAA ladder is a scalar
 * and never varies. Verified directly: feeding the 1971-2000 CPI record (peaking at 12.3%) as an
 * inflationSequence changes spendGoal and MAGI in every year and leaves BracketTarget byte-identical
 * to a flat-3% run. So neither MC nor the Stress Test exercises this at all.
 *
 * THE TRICK THAT AVOIDS TOUCHING THE SIMULATOR
 * Decide under the assumed CPI, bill under a realized one:
 *
 *   1. Run simulate() once with `cpi = assumed`. That is the plan making its decisions in good
 *      faith: the MAGI it chose each year, and the tier it was aiming at.
 *   2. Re-bill those same MAGIs in post, against thresholds indexed by a REALIZED CPI path, using
 *      the pure exported lookups (getIRMAATier / findUpperLimitByAmount). No engine change, and the
 *      realized paths can be the actual CPI record.
 *
 * The economy of it is that step 1 does not depend on the realized path, so N realized worlds cost
 * one simulation, not N. A few dozen sims cover thousands of world-plan pairs.
 *
 * WHAT THIS DELIBERATELY DOES NOT MODEL
 * Feedback. A larger realized surcharge is a larger real bill, which would slightly change later
 * balances and hence later MAGI. Second-order for counting breaches and pricing the surcharge
 * delta, and capturing it is exactly the engine change this harness exists to avoid. Every number
 * below is therefore a first-order estimate, and the breach counts are exact while the dollar totals
 * are close.
 *
 * WHICH DIRECTION OF ERROR ACTUALLY HURTS
 * Only an UNDERSHOOT. Assume 3%, get 1%, and the threshold two years out is lower than the plan
 * aimed at, so MAGI that was meant to sit just under a tier is now over it. An overshoot is free:
 * the threshold runs away upward and the plan is left with unused room. That asymmetry is the whole
 * case for a margin, and it predicts the SHAPE the margin should have -- a haircut on the projection
 * RATE, which is what a CPI forecast error is, rather than a flat dollar setback whose relative size
 * decays to nothing as thresholds inflate.
 *
 * ── PREDICTIONS, recorded BEFORE the numbers were looked at ──────────────────────────────────────
 *   P1. Breaches appear. Unlike every previous round, some margin setting will now prevent some of
 *       them, because there is finally an error to absorb.
 *   P2. Only undershoot paths produce breaches. Overshoot paths produce zero, in every mode.
 *   P3. The rate-shaped modes (halfcpi, cpiminus1) beat the dollar-shaped ones (flat1000, flat2000)
 *       per dollar of ceiling given up, because a CPI error is proportional and so is their setback.
 *       This reverses the recommendation from the constant-CPI round, which judged them the most
 *       expensive and least useful settings.
 *   P4. `halfstep` (~$1-2k) is far too small to matter against realistic CPI forecast error: two
 *       years of a 1-point miss on a $274,000 threshold is roughly $5,500.
 *   P5. Historical 30-year windows produce breaches in a minority of windows, because the assumed
 *       2.5% sits below the historical mean, so most windows overshoot it.
 */

// ── Bootstrap the engine exactly like the other node harnesses ───────────────────────────────────
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
const { simulate, IRMAA_MARGIN_MODES } = core;
const { TAXData, getRateBracket, findUpperLimitByAmount } = taxengine;
const HIST = require('../montecarlo/historical_returns.js');

const MODES = [...IRMAA_MARGIN_MODES];
const ASSUMED_CPI = 0.025;          // what the plan believes and plans against
const LOOKBACK = -TAXData.IRMAA.LOOKBACK;

// ── Realized CPI worlds ──────────────────────────────────────────────────────────────────────────
// Two families. The constants isolate the direction of the error; the historical windows say how
// often it bites in the record we actually have.
const WORLDS = [];
for (const c of [0.00, 0.01, 0.015, 0.02, 0.025, 0.03, 0.04, 0.06])
    WORLDS.push({ key: `flat ${(c * 100).toFixed(1)}%`, family: 'constant',
                  path: Array(40).fill(c) });
// Every rolling 40-year window of the CPI-U record (1928 onward, December over December).
for (let s = 0; s + 40 <= HIST.inflation.length; s++)
    WORLDS.push({ key: `hist ${HIST.inflationStartYear + s}`, family: 'historical',
                  path: HIST.inflation.slice(s, s + 40) });

// ── Plans ────────────────────────────────────────────────────────────────────────────────────────
const BASE = {
    STATEname: 'CA', strategy: 'bracket', stratRate: 0, stratACAMultiple: 0, nYears: 25,
    birthyear1: 1955, birthmonth1: 3, die1: 92,
    birthyear2: 1956, birthmonth2: 3, die2: 95, hasSpouse: true,
    IRA1: 2500000, IRA2: 500000, Roth: 200000, Roth2: 0,
    Brokerage: 600000, BrokerageBasis: 300000, Cash: 150000, CashReserve: 0,
    ss1: 45000, ss1Age: 70, ss2: 24000, ss2Age: 70,
    pensionAnnual: 0, survivorPct: 75, pensionCola: false,
    spendGoal: 180000, spendChange: 0, iraBaseGoal: 0,
    inflation: ASSUMED_CPI, cpi: ASSUMED_CPI, growth: 0.06, cashYield: 0.02, dividendRate: 0.015,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: true, propWithdraw: 0, iraWithdrawPct: 0.05,
    startYear: 2026, dividendReinvest: false,
    qcdHHMax: 0, qcdMode: 'always',
    cyclicEnabled: false,   // see irmaa_margin_harness.js: cyclic harvest timing swamps this signal
};
const PLANS = [];
for (const shape of [
        { key: 'MFJ 3.0M',   over: {} },
        { key: 'MFJ 6.0M',   over: { IRA1: 5000000, IRA2: 1000000, spendGoal: 240000 } },
        { key: 'MFJ 1.2M',   over: { IRA1: 1000000, IRA2: 200000, spendGoal: 120000 } },
        { key: 'single 2M',  over: { hasSpouse: false, birthyear2: 0, die2: 0, IRA2: 0, ss2: 0,
                                     Roth2: 0, IRA1: 2000000, spendGoal: 130000 } },
    ])
    for (const tier of [0, 1, 2])
        PLANS.push({ key: `${shape.key} / Tier ${tier}`, targetTier: tier,
                     inputs: { ...BASE, ...shape.over, stratIRMAATier: tier } });

// ── Step 1: the plan's decisions, made under the assumed CPI ─────────────────────────────────────
// Everything the re-billing needs, and nothing that depends on the realized path.
function decisions(inputs, mode) {
    const r = simulate({ ...inputs, irmaaMarginMode: mode });
    const rows = r.log.filter(e => e.year !== undefined);
    return rows.map((e, y) => ({
        y, year: e.year, status: e.status, magi: e.MAGI,
        // "—" is how a dead person's age prints. Counting who WILL be enrolled is not needed here:
        // this is the charge year, so current enrolment is the right count.
        onMedicare: (e.age1 !== '—' && e.age1 >= TAXData.IRMAA.ELIGIBILITY_AGE ? 1 : 0)
                  + (e.age2 !== '—' && e.age2 >= TAXData.IRMAA.ELIGIBILITY_AGE ? 1 : 0),
        broke: (e.ForcedIRA || 0) > 1 || (e.BracketOverage || 0) > 1,
        assumedIRMAA: e.IRMAA || 0,
    }));
}

// ── Step 2: re-bill those decisions in a world whose CPI came out differently ────────────────────
const tierIndex = status => {
    const m = new Map();
    getRateBracket('IRMAA', status).forEach((b, i) => m.set(b.tier, i));
    return m;
};
function rebill(dec, targetTier, realizedPath) {
    // cpiRate for the CHARGE year, compounded from the realized path. Year 0 is 1 by construction,
    // matching the engine (gapYears is 0 for a plan starting this year).
    const cpiRateAt = [];
    let acc = 1;
    for (let y = 0; y < dec.length; y++) { cpiRateAt.push(acc); acc *= (1 + (realizedPath[y] ?? 0)); }

    let breaches = 0, eligible = 0, widowBreaches = 0, extra = 0;
    for (let y = LOOKBACK; y < dec.length; y++) {
        const charge = dec[y], src = dec[y - LOOKBACK];
        if (!charge.onMedicare) continue;
        const idx = tierIndex(charge.status === 'MFJ' ? 'MFJ' : 'SGL');
        const persons = charge.status === 'MFJ' ? 2 : 1;
        const rateOf = rate => rate / persons * Math.min(charge.onMedicare, persons) * 12;
        // The engine also scales by medicareRate (premium escalation). It is identical in both
        // worlds for a given year, so it cancels out of the DIFFERENCE and is left out; the extra
        // dollars below are therefore in today's premium terms, deliberately.
        const realized = findUpperLimitByAmount('IRMAA', charge.status === 'MFJ' ? 'MFJ' : 'SGL',
                                                src.magi, cpiRateAt[y]);
        const assumedRate = findUpperLimitByAmount('IRMAA', charge.status === 'MFJ' ? 'MFJ' : 'SGL',
                                                   src.magi, Math.pow(1 + ASSUMED_CPI, y));
        extra += rateOf(realized.rate) - rateOf(assumedRate.rate);

        // Only a source year that RESPECTED the ceiling can be a targeting failure, and only a
        // same-status pair isolates CPI error from the widow gap that both earlier rounds found.
        if (src.broke) continue;
        if (src.status !== charge.status) {
            const t = idx.get(getIRMAATierName(src.magi, charge.status, cpiRateAt[y]));
            if ((t ?? 0) > targetTier) widowBreaches++;
            continue;
        }
        eligible++;
        const tname = getIRMAATierName(src.magi, charge.status, cpiRateAt[y]);
        if ((idx.get(tname) ?? 0) > targetTier) breaches++;
    }
    return { breaches, eligible, widowBreaches, extra };
}
function getIRMAATierName(magi, status, cpiRate) {
    const brks = getRateBracket('IRMAA', status === 'MFJ' ? 'MFJ' : 'SGL');
    let idx = -1;
    for (let i = 0; i < brks.length; i++) { if (brks[i].l * cpiRate <= magi) idx = i; else break; }
    return idx === -1 ? (brks[0].tier ?? '-') : (brks[idx].tier ?? '-');
}

// ── Run ──────────────────────────────────────────────────────────────────────────────────────────
const money = n => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');

console.log('# IRMAA margin under CPI forecast error\n');
console.log(`Plan assumes CPI ${(ASSUMED_CPI * 100).toFixed(1)}%. ${PLANS.length} plans x ${MODES.length} modes`);
console.log(`= ${PLANS.length * MODES.length} simulations, re-billed in ${WORLDS.length} realized CPI worlds`);
console.log(`= ${PLANS.length * MODES.length * WORLDS.length} plan-world pairs.\n`);
console.log('Extra IRMAA is realized minus assumed, in today\'s premium terms, summed over the plan.\n');

const DEC = {};
for (const plan of PLANS) for (const m of MODES) DEC[plan.key + '|' + m] = decisions(plan.inputs, m);

// ---- constants: isolate the direction of the error ----
console.log('## Constant realized CPI (the plan assumed 2.5%)\n');
const hdr = ['realized'.padEnd(12), ...MODES.map(m => m.padStart(11))].join(' ');
console.log('Breaching years, summed over all ' + PLANS.length + ' plans:');
console.log(hdr);
for (const w of WORLDS.filter(w => w.family === 'constant')) {
    const cells = MODES.map(m => {
        let b = 0;
        for (const plan of PLANS) b += rebill(DEC[plan.key + '|' + m], plan.targetTier, w.path).breaches;
        return String(b).padStart(11);
    });
    console.log([w.key.padEnd(12), ...cells].join(' '));
}
console.log('\nExtra IRMAA paid vs what the plan assumed:');
console.log(hdr);
for (const w of WORLDS.filter(w => w.family === 'constant')) {
    const cells = MODES.map(m => {
        let x = 0;
        for (const plan of PLANS) x += rebill(DEC[plan.key + '|' + m], plan.targetTier, w.path).extra;
        return money(x).padStart(11);
    });
    console.log([w.key.padEnd(12), ...cells].join(' '));
}

// ---- historical windows ----
console.log('\n## Historical CPI windows (' + WORLDS.filter(w => w.family === 'historical').length
            + ' rolling 40-year windows, ' + HIST.inflationStartYear + ' onward)\n');
console.log(['mode'.padEnd(11), 'breach yrs'.padStart(11), 'of eligible'.padStart(12),
             'rate'.padStart(7), 'windows hit'.padStart(12), 'extra IRMAA'.padStart(14),
             'worst window'.padStart(14)].join(' '));
const histWorlds = WORLDS.filter(w => w.family === 'historical');
const summary = {};
for (const m of MODES) {
    let br = 0, el = 0, extra = 0, hit = 0, worst = 0, worstKey = '';
    for (const w of histWorlds) {
        let wb = 0, wx = 0;
        for (const plan of PLANS) {
            const r = rebill(DEC[plan.key + '|' + m], plan.targetTier, w.path);
            wb += r.breaches; el += r.eligible; wx += r.extra;
        }
        br += wb; extra += wx;
        if (wb > 0) hit++;
        if (wx > worst) { worst = wx; worstKey = w.key; }
    }
    summary[m] = { br, el, extra, hit };
    console.log([m.padEnd(11), String(br).padStart(11), String(el).padStart(12),
                 (el ? (100 * br / el).toFixed(2) + '%' : '-').padStart(7),
                 `${hit}/${histWorlds.length}`.padStart(12), money(extra).padStart(14),
                 (money(worst) + ' ' + worstKey).padStart(14)].join(' '));
}

// ── Predictions ──────────────────────────────────────────────────────────────────────────────────
const under = WORLDS.find(w => w.key === 'flat 1.0%'), over = WORLDS.find(w => w.key === 'flat 6.0%');
const tot = (w, m, f) => PLANS.reduce((a, p) => a + rebill(DEC[p.key + '|' + m], p.targetTier, w.path)[f], 0);
const verdicts = [
    ['P1 some setting prevents some breaches',
     Math.min(...MODES.map(m => tot(under, m, 'breaches'))) < tot(under, 'none', 'breaches'),
     MODES.map(m => `${m} ${tot(under, m, 'breaches')}`).join(', ') + '  (realized 1%)'],
    ['P2 only undershoot paths breach',
     MODES.every(m => tot(over, m, 'breaches') === 0),
     'at realized 6%: ' + MODES.map(m => `${m} ${tot(over, m, 'breaches')}`).join(', ')],
    ['P3 rate-shaped modes beat dollar-shaped ones',
     tot(under, 'cpiminus1', 'breaches') < tot(under, 'flat2000', 'breaches'),
     `cpiminus1 ${tot(under, 'cpiminus1', 'breaches')} vs flat2000 ${tot(under, 'flat2000', 'breaches')} (realized 1%)`],
    ['P4 halfstep is too small to matter',
     tot(under, 'halfstep', 'breaches') >= tot(under, 'none', 'breaches') * 0.9,
     `halfstep ${tot(under, 'halfstep', 'breaches')} vs none ${tot(under, 'none', 'breaches')}`],
    ['P5 a minority of historical windows breach',
     summary.none.hit < histWorlds.length / 2,
     `none hit ${summary.none.hit}/${histWorlds.length} windows`],
];
console.log('\n## Predictions\n');
for (const [name, ok, detail] of verdicts)
    console.log(`${ok ? 'HELD  ' : 'WRONG '} ${name.padEnd(42)} ${detail}`);
const wrong = verdicts.filter(v => !v[1]);
console.log(`\n${verdicts.length - wrong.length} of ${verdicts.length} predictions held.`);
if (wrong.length) console.log('Wrong: ' + wrong.map(v => v[0].split(' ')[0]).join(', '));
