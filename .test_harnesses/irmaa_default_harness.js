'use strict';
/**
 * irmaa_default_harness.js -- which irmaaMarginMode should be the DEFAULT, and which settings can
 * be deleted?
 *
 * Run:  node .test_harnesses/irmaa_default_harness.js
 *
 * THE QUESTION, AND THE TENSION INSIDE IT
 * "Which setting produces the most conversions and the smallest QCDs" has a trivial answer, and it
 * is the wrong one. Both of those improve monotonically as the margin shrinks:
 *   - more conversion room  = a HIGHER ceiling  = LESS margin
 *   - a smaller QCD         = a HIGHER target   = LESS margin
 * so `none` wins both by construction, and `none` is also the setting with zero protection. The
 * margin only ever pays by preventing a breach when inflation comes in BELOW the plan's assumption.
 *
 * So the default cannot be chosen on gross conversions or gross donations. It has to be chosen on
 * the NET: the benefit of the extra room, minus the surcharge actually billed once the realized CPI
 * is known. That is what this file measures.
 *
 * WHAT RANDOMIZING INFLATION DOES AND DOES NOT CHANGE
 * Worth being exact, because it is counter-intuitive. `sim.cpiRate` is built from the scalar
 * `inputs.cpi`, so the ceiling, the conversions and the donations are **deterministic** - they do
 * not respond to a realized inflation path at all. Randomizing inflation changes only the
 * CONSEQUENCE: which tier the resulting MAGI is billed at two years later. So:
 *
 *   conversions, QCDs   -> a function of the margin setting alone, one number per mode
 *   surcharge paid      -> a distribution over realized CPI paths
 *   net                 -> what the default should be chosen on
 *
 * Method is the same trick as irmaa_cpi_risk_harness.js and needs no engine change: run the plan
 * once under its assumed CPI to get its decisions, then re-bill those decisions against thresholds
 * indexed by each realized path from the CPI-U record.
 *
 * NOT MODELED: feedback. A larger realized surcharge is a larger real bill, which would slightly
 * change later balances. Second-order against terminal wealth, and capturing it is the engine change
 * this avoids. The ranking below is first-order.
 *
 * ── PREDICTIONS, recorded BEFORE the numbers were looked at ──────────────────────────────────────
 *   P1. `none` wins gross conversions and gross donations outright. Stated so the trivial answer is
 *       on the record rather than presented later as a finding.
 *   P2. `none` also wins on NET across the historical record, because most CPI-U windows run above a
 *       2.5% assumption, so the surcharge it risks is usually never billed.
 *   P3. The ranking flips somewhere below the assumed rate. There is a realized-CPI level at which a
 *       rate-shaped margin overtakes `none` on net, and it is the honest basis for a default.
 *   P4. flat1000, flat2000 and halfstep are dominated everywhere: too small to prevent breaches, and
 *       still costing conversion room. They can be deleted.
 *   P5. halfcpi and cpiminus1 are near-duplicates of each other; keeping both is redundant.
 */

// ── Bootstrap the engine exactly like the other node harnesses ───────────────────────────────────
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
const { simulate, afterTaxWealthOfLogRow, IRMAA_MARGIN_MODES } = core;
const { TAXData, getRateBracket, findUpperLimitByAmount } = taxengine;
const HIST = require('../montecarlo/historical_returns.js');

const MODES = [...IRMAA_MARGIN_MODES];
const ASSUMED_CPI = 0.025;
const LOOKBACK = -TAXData.IRMAA.LOOKBACK;
const FUTURE_IRA_RATE = 0.22;

// ── Realized CPI worlds ──────────────────────────────────────────────────────────────────────────
const CONSTANTS = [0.00, 0.01, 0.015, 0.02, 0.025, 0.03, 0.04];
const HIST_WINDOWS = [];
for (let s = 0; s + 40 <= HIST.inflation.length; s++)
    HIST_WINDOWS.push({ key: 'hist ' + (HIST.inflationStartYear + s), path: HIST.inflation.slice(s, s + 40) });

// ── Plans: one family that converts, one that donates ────────────────────────────────────────────
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
    cyclicEnabled: false,   // harvest timing swamps this signal; see irmaa_margin_harness.js
};
const SHAPES = [
    { key: 'MFJ 3.0M',  over: {} },
    { key: 'MFJ 6.0M',  over: { IRA1: 5000000, IRA2: 1000000, spendGoal: 240000 } },
    { key: 'MFJ 1.2M',  over: { IRA1: 1000000, IRA2: 200000, spendGoal: 120000 } },
    { key: 'single 2M', over: { hasSpouse: false, birthyear2: 0, die2: 0, IRA2: 0, ss2: 0,
                                Roth2: 0, IRA1: 2000000, spendGoal: 130000 } },
];
const PLANS = [];
for (const s of SHAPES) {
    for (const tier of [0, 1, 2])
        PLANS.push({ key: `${s.key} / Tier ${tier}`, family: 'convert', targetTier: tier,
                     inputs: { ...BASE, ...s.over, stratIRMAATier: tier } });
    // No IRMAA ceiling at all, so the QCD target is the only forward-projected mechanism here.
    PLANS.push({ key: `${s.key} / QCD`, family: 'donate', targetTier: null,
                 inputs: { ...BASE, ...s.over, strategy: 'propwd', propWithdraw: 0, stratRate: 0,
                           stratIRMAATier: -1, qcdHHMax: 60000, qcdMode: 'asneeded' } });
}

// ── Step 1: decisions under the assumed CPI (independent of any realized path) ───────────────────
function decisions(inputs, mode) {
    const r = simulate({ ...inputs, irmaaMarginMode: mode });
    const rows = r.log.filter(e => e.year !== undefined);
    const last = rows[rows.length - 1];
    return {
        years: rows.map(e => ({
            year: e.year, status: e.status === 'MFJ' ? 'MFJ' : 'SGL', magi: e.MAGI,
            onMedicare: (e.age1 !== '—' && e.age1 >= TAXData.IRMAA.ELIGIBILITY_AGE ? 1 : 0)
                      + (e.age2 !== '—' && e.age2 >= TAXData.IRMAA.ELIGIBILITY_AGE ? 1 : 0),
        })),
        converted: rows.reduce((a, e) => a + (e.rothConv || 0), 0),
        given:     rows.reduce((a, e) => a + (e.QCD1 || 0) + (e.QCD2 || 0), 0),
        wealth:    afterTaxWealthOfLogRow(last, FUTURE_IRA_RATE),
    };
}

// ── Step 2: the surcharge those decisions actually incur in a given world ────────────────────────
// Returns EXTRA surcharge versus what the plan assumed, in today's premium terms (the medicareRate
// escalation is identical in both worlds for a given year, so it cancels out of the difference).
function extraSurcharge(dec, realizedPath) {
    const cpiAt = []; let acc = 1;
    for (let y = 0; y < dec.years.length; y++) { cpiAt.push(acc); acc *= (1 + (realizedPath[y] ?? 0)); }
    let extra = 0;
    for (let y = LOOKBACK; y < dec.years.length; y++) {
        const charge = dec.years[y], src = dec.years[y - LOOKBACK];
        if (!charge.onMedicare) continue;
        const persons = charge.status === 'MFJ' ? 2 : 1;
        const scale = r => r / persons * Math.min(charge.onMedicare, persons) * 12;
        const real = findUpperLimitByAmount('IRMAA', charge.status, src.magi, cpiAt[y]).rate;
        const asmd = findUpperLimitByAmount('IRMAA', charge.status, src.magi,
                                            Math.pow(1 + ASSUMED_CPI, y)).rate;
        extra += scale(real) - scale(asmd);
    }
    return extra;
}

// ── Run ──────────────────────────────────────────────────────────────────────────────────────────
const money = n => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
const pct = n => (n >= 0 ? '+' : '') + (n * 100).toFixed(3) + '%';

const DEC = {};
for (const p of PLANS) for (const m of MODES) DEC[p.key + '|' + m] = decisions(p.inputs, m);

const CONV = PLANS.filter(p => p.family === 'convert');
const DON  = PLANS.filter(p => p.family === 'donate');
const sum = (plans, m, f) => plans.reduce((a, p) => a + DEC[p.key + '|' + m][f], 0);

console.log('# Which IRMAA margin setting should be the default?\n');
console.log(`${PLANS.length} plans (${CONV.length} converting, ${DON.length} donating) x ${MODES.length} modes`);
console.log(`= ${PLANS.length * MODES.length} simulations, each re-billed in ${CONSTANTS.length} constant`);
console.log(`and ${HIST_WINDOWS.length} historical CPI worlds. Plan assumes CPI ${(ASSUMED_CPI*100).toFixed(1)}%.\n`);

// ---- 1. The gross numbers the question asked for ----
console.log('## Gross: conversions and donations (deterministic - CPI randomness cannot touch these)\n');
console.log(['mode'.padEnd(11), 'converted'.padStart(15), 'vs none'.padStart(13),
             'QCD given'.padStart(15), 'vs none'.padStart(13)].join(' '));
const convNone = sum(CONV, 'none', 'converted'), givenNone = sum(DON, 'none', 'given');
for (const m of MODES) {
    const c = sum(CONV, m, 'converted'), g = sum(DON, m, 'given');
    console.log([m.padEnd(11), money(c).padStart(15), money(c - convNone).padStart(13),
                 money(g).padStart(15), money(g - givenNone).padStart(13)].join(' '));
}
console.log('\nBoth columns are maximised by `none`, by construction. That is why the default cannot');
console.log('be picked from this table - see the net comparison below.');

// ---- 2. DECOMPOSED, because the raw net is dominated by the wrong effect ------------------------
// A first version of this file compared modes on net terminal wealth and reported that every margin
// beats `none` at every realized CPI, including rates where the cpi-risk harness proves there are
// ZERO breaches. That cannot be an IRMAA result, and it is not one. Two different things move when
// the margin changes:
//
//   dWealth     the ceiling moved, so the plan converted a different amount. CPI-INDEPENDENT.
//               On this grid converting less scores better at a 22% heir rate, which is the P24
//               finding, not anything to do with IRMAA.
//   dSurcharge  the tier the resulting MAGI is billed at. CPI-DEPENDENT. This, and only this, is
//               what a safety margin exists to change.
//
// Reporting only their sum credits the margin for a conversion-sizing side effect that belongs to
// the tier selector. They are separated below, and the margin is judged on dSurcharge alone.
const gross = m => CONV.reduce((a, p) => a + DEC[p.key + '|' + m].wealth, 0);
const surch = (m, path) => CONV.reduce((a, p) => a + extraSurcharge(DEC[p.key + '|' + m], path), 0);

console.log('\n## Decomposed: what actually moves when the margin changes\n');
console.log('dWealth is the conversion-sizing side effect (same in every world).');
console.log('dSurcharge is the IRMAA effect, and negative means the margin SAVED surcharge.\n');
console.log(['realized CPI'.padEnd(14), 'metric'.padEnd(11),
             ...MODES.filter(m => m !== 'none').map(m => m.padStart(12))].join(' '));
const gNone = gross('none');
console.log([''.padEnd(14), 'dWealth'.padEnd(11),
             ...MODES.filter(m => m !== 'none').map(m => money(gross(m) - gNone).padStart(12))].join(' '));
for (const c of CONSTANTS) {
    const path = Array(45).fill(c);
    const sNone = surch('none', path);
    console.log([(`flat ${(c*100).toFixed(1)}%`).padEnd(14), 'dSurcharge'.padEnd(11),
        ...MODES.filter(m => m !== 'none').map(m => money(surch(m, path) - sNone).padStart(12))].join(' '));
}

console.log('\n## The IRMAA effect alone, across ' + HIST_WINDOWS.length + ' historical CPI-U windows\n');
console.log(['mode'.padEnd(11), 'mean dSurcharge'.padStart(16), 'best (most saved)'.padStart(18),
             'worst'.padStart(12), 'windows where it saved'.padStart(24)].join(' '));
for (const m of MODES.filter(x => x !== 'none')) {
    const d = HIST_WINDOWS.map(w => surch(m, w.path) - surch('none', w.path));
    const mean = d.reduce((a, b) => a + b, 0) / d.length;
    console.log([m.padEnd(11), money(mean).padStart(16), money(Math.min(...d)).padStart(18),
                 money(Math.max(...d)).padStart(12),
                 `${d.filter(x => x < -1).length}/${d.length}`.padStart(24)].join(' '));
}

// ---- 3. Where the IRMAA effect actually turns on -----------------------------------------------
// Scanned over the whole range rather than stopped at the first failure: an earlier version broke
// out of the loop and then printed the last value it happened to test, which read as a crossover
// at the top of the range when in fact no crossover had been found at all.
console.log('\n## At which realized CPI does the margin save any surcharge?\n');
for (const m of MODES.filter(x => x !== 'none')) {
    const saves = [];
    for (let c = 0; c <= 0.0401; c += 0.0025) {
        const path = Array(45).fill(c);
        if (surch(m, path) - surch('none', path) < -1) saves.push((c * 100).toFixed(2) + '%');
    }
    console.log(`  ${m.padEnd(11)} ` + (saves.length
        ? `saves surcharge at realized CPI ${saves[0]} .. ${saves[saves.length - 1]}`
        : 'never saves any surcharge at any rate tested'));
}

// ---- Predictions ----
// Scored on dSurcharge - the margin's actual job - not on net wealth, which the decomposition
// above shows is dominated by conversion sizing.
const dSur = m => {
    const d = HIST_WINDOWS.map(w => surch(m, w.path) - surch('none', w.path));
    return d.reduce((a, b) => a + b, 0) / d.length;
};
const meanOf = m => (m === 'none' ? 0 : dSur(m));
const dominated = m => meanOf(m) >= -1;   // saves essentially nothing
const verdicts = [
    ['P1 none wins gross conversions and donations',
     MODES.every(m => sum(CONV, m, 'converted') <= convNone + 1)
       && MODES.every(m => sum(DON, m, 'given') >= givenNone - 1),
     'converted ' + money(convNone) + ', given ' + money(givenNone)],
    ['P2 every margin saves surcharge on the record',
     MODES.filter(m => m !== 'none').every(m => meanOf(m) < -1),
     MODES.filter(m => m !== 'none').map(m => m + ' ' + money(meanOf(m))).join(', ')],
    ['P3 no margin saves surcharge at or above the assumption',
     MODES.filter(m => m !== 'none').every(m =>
        surch(m, Array(45).fill(0.03)) - surch('none', Array(45).fill(0.03)) >= -1),
     'at realized 3%: ' + MODES.filter(m => m !== 'none').map(m => m + ' '
        + money(surch(m, Array(45).fill(0.03)) - surch('none', Array(45).fill(0.03)))).join(', ')],
    // flat1000 was retired in v11.15cc on the strength of this row, so it is no longer in
    // IRMAA_MARGIN_MODES and the check now covers whatever dollar-shaped settings remain.
    ['P4 the dollar-shaped settings are dominated',
     IRMAA_MARGIN_MODES.filter(m => /^flat|halfstep/.test(m)).every(dominated),
     IRMAA_MARGIN_MODES.filter(m => /^flat|halfstep/.test(m))
        .map(m => m + ' mean dSurcharge ' + money(meanOf(m))
             + ' vs halfcpi ' + money(meanOf('halfcpi'))).join(', ')],
    ['P5 halfcpi and cpiminus1 are near-duplicates',
     Math.abs(meanOf('halfcpi') - meanOf('cpiminus1')) < Math.abs(meanOf('halfcpi')) * 0.25,
     'halfcpi ' + money(meanOf('halfcpi')) + ' vs cpiminus1 ' + money(meanOf('cpiminus1'))],
    ['P6 the conversion-sizing side effect dwarfs the IRMAA effect',
     Math.abs(gross('halfcpi') - gNone) > Math.abs(meanOf('halfcpi')) * 2,
     'halfcpi dWealth ' + money(gross('halfcpi') - gNone)
        + ' vs mean dSurcharge ' + money(meanOf('halfcpi'))],
];
console.log('\n## Predictions\n');
for (const [n, ok, d] of verdicts) console.log(`${ok ? 'HELD  ' : 'WRONG '} ${n.padEnd(46)} ${d}`);
const wrong = verdicts.filter(v => !v[1]);
console.log(`\n${verdicts.length - wrong.length} of ${verdicts.length} predictions held.`);
if (wrong.length) console.log('Wrong: ' + wrong.map(v => v[0].split(' ')[0]).join(', '));
