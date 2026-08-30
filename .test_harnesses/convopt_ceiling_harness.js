'use strict';
/**
 * convopt_ceiling_harness.js -- P88f. Should the Optimizer's conversion search skip the families
 * that target a ceiling?
 *
 * Run:  node .test_harnesses/convopt_ceiling_harness.js
 *
 * THE QUESTION, and where it came from. A user pointed out that an Extra Annual Roth Conversion and
 * a Fill Bracket strategy pull against each other: the strategy fills income to a ceiling, and the
 * conversion is then stacked on top of it, so the ceiling breaks. They proposed that the Optimizer
 * should not offer conversion-optimized rows for ceiling families at all.
 *
 * That proposal was deferred rather than refused, for a reason that has since changed. Until P88b
 * the conversion never reached MAGI, so the search scored those rows on numbers that omitted the
 * conversion's own IRMAA, biased toward larger conversions everywhere. Asking "does the search
 * behave sensibly on ceiling families" was unanswerable while it read the wrong numbers. It now
 * reads the right ones, so the question is live.
 *
 * WHAT THE PRODUCTION CODE DOES. `selectConversionCandidates` picks one champion per strategy
 * FAMILY and deliberately splits `bracket` into `bracket-rate` and `bracket-irmaa`, so both ceiling
 * kinds get a seat. Each champion goes through
 * `optimizeConversionAmount(base, overrides, 'baselineScore', { futureIRARate })`, and a candidate
 * whose search returns $0 is DROPPED - `if (!optResult || optConv === 0) continue`. So the exclusion
 * the user asked for already happens by itself IF the search returns zero on those families. That is
 * the first thing to measure, and it decides whether anything needs building at all.
 *
 * THE THREE ANSWERS THIS CAN REACH:
 *   (a) EXCLUDE ceiling families from the search, as proposed.
 *   (b) LEAVE IT - the search returns $0 for them on its own, or the rows it does produce are worth
 *       having.
 *   (c) KEEP the rows and MARK them. The Strategy column already carries a warning glyph for a
 *       ceiling that cannot be hit; a ceiling deliberately broken by the row's own conversion is the
 *       same class of thing and has no marker today.
 *
 * PREDICTIONS, registered before the run:
 *   C1  The search does NOT self-correct to zero. There are ceiling-family cells where it picks a
 *       non-zero conversion, so answer (b)-by-accident is not available. If this is wrong and every
 *       ceiling cell returns $0, the phase closes with no change.
 *   C2  Every non-zero pick on a ceiling family BREACHES that family's own ceiling. Close to true by
 *       construction - the conversion is added on top of a draw already sized to fill the ceiling -
 *       so a cell that picks a conversion and does NOT breach would mean the ceiling was not binding
 *       there, which is worth seeing separately rather than averaging away.
 *   C3  Where it picks non-zero, the score gain is MATERIAL rather than noise. This is the cost of
 *       answer (a): excluding these families throws that gain away.
 *   C4  ZERO TEST. The bracket-agnostic families (Proportional, Ordered, IRA Draw) never record any
 *       conversion-caused overage, in any cell. They have no ceiling to break, so a non-zero reading
 *       there would mean `-overageFromConv` measures something other than what it claims.
 *   C5  The lever is the HEIRS RATE, not the family. The same family flips between $0 and a large
 *       conversion as the assumed future tax rate on inherited IRA dollars moves, which would make a
 *       family-level exclusion the wrong SHAPE of rule.
 *
 *       SCORED AGAINST THE ALTERNATIVE, not against zero. "at least one flip" would be passed by
 *       three flips in sixty combinations, which is noise wearing a verdict. The test asks which
 *       axis moves the pick count MORE - the heirs rate or the spend rate - so a wrong answer can
 *       actually lose.
 *
 * Results in `research/CONVERSION_SEARCH_CEILINGS.md`.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
Object.assign(globalThis, require('../taxengine.js'));
const core = require('../optimizer_core.js');
require('../displayhelpers.js');
const { simulate, optimizeConversionAmount, baselineScoreOf, SPENDABLE_WEIGHT } = core;

// COMMON copied verbatim from rmdbasis_harness.js, per the rule in phased_harness.js.
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

const SCENARIOS = [
    { key: 'defaults',   label: 'shipped defaults',
      over: { IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000,
              Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000 } },
    { key: 'defaults3x', label: 'defaults x3',
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

// `ceiling: true` is the property under test, so it is declared rather than inferred - and section 0
// checks each declaration against the engine's own BracketTarget instead of trusting it.
const FAMILIES = [
    { key: 'fed12',   label: 'Fill Bracket 12%', ceiling: true,
      over: { strategy: 'bracket', stratRate: 0.12, stratIRMAATier: -1, stratACAMultiple: 0 } },
    { key: 'fed22',   label: 'Fill Bracket 22%', ceiling: true,
      over: { strategy: 'bracket', stratRate: 0.22, stratIRMAATier: -1, stratACAMultiple: 0 } },
    { key: 'fed24',   label: 'Fill Bracket 24%', ceiling: true,
      over: { strategy: 'bracket', stratRate: 0.24, stratIRMAATier: -1, stratACAMultiple: 0 } },
    { key: 'irmaa1',  label: 'IRMAA Tier 1',     ceiling: true,
      over: { strategy: 'bracket', stratRate: 0, stratIRMAATier: 1, stratACAMultiple: 0 } },
    { key: 'irmaa2',  label: 'IRMAA Tier 2',     ceiling: true,
      over: { strategy: 'bracket', stratRate: 0, stratIRMAATier: 2, stratACAMultiple: 0 } },
    { key: 'propwd',  label: 'Proportional 10%', ceiling: false,
      over: { strategy: 'propwd', propWithdraw: 0.10 } },
    { key: 'ordered', label: 'Ordered CBRI',     ceiling: false,
      over: { strategy: 'ordered', orderedSeq: 'CBRI' } },
    { key: 'draw6',   label: 'IRA Draw 6%',      ceiling: false,
      over: { strategy: 'fixedpct', iraWithdrawPct: 0.06 } },
];

// The heirs rate is an AXIS, not a constant, because C5 claims it is the real lever. `null` means
// "whatever the plan itself reports", which is what the Optimizer uses in production.
const HEIRS = [null, 0.35, 0.45];
const SPEND_RATES = [0.04, 0.06];

const totalOf = (o) => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;
const money = (n) => (n == null || Number.isNaN(n)) ? '      -     '
    : (n < 0 ? '-' : ' ') + '$' + Math.round(Math.abs(n)).toLocaleString().padStart(11);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const median = (xs) => { if (!xs.length) return null; const v = [...xs].sort((a, b) => a - b);
    return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };

let simCount = 0;
const sim = (o) => { simCount++; return simulate(o); };

const line = (c) => console.log((c || '=').repeat(118));
line();
console.log('P88f -- should the Optimizer conversion search skip the families that target a ceiling?');
line();
console.log('Reading guide:');
console.log('  optConv       what optimizeConversionAmount picks, on the production metric');
console.log('                (baselineScore at a shared heirs rate). $0 means the Optimizer DROPS the');
console.log('                row, so $0 is the user-proposed exclusion happening by itself.');
console.log('  score gain    baselineScore at optConv minus the same at $0. What excluding would cost.');
console.log('  breach yrs    years where the CONVERSION put MAGI over that row own ceiling, counted');
console.log('                from -overageFromConv (added by P88c). NOT spending going over: that is');
console.log('                a different cause and is deliberately tracked apart from this one.');
console.log('  CEILING       Fill Bracket, IRMAA Tier. AGNOSTIC: Proportional, Ordered,');
console.log('                IRA Draw - no ceiling to break.');
console.log('  heirs         assumed future tax rate on inherited IRA dollars. "auto" = the plan own.');
console.log('  C1..C5        predictions, stated in the file header, scored in section 4.');

const CELLS = [];
for (const s of SCENARIOS) for (const h of HEIRS) for (const rate of SPEND_RATES) for (const f of FAMILIES) {
    CELLS.push({ s, h, rate, f, base: { ...COMMON, ...s.over,
        spendGoal: Math.round(totalOf(s.over) * rate) } });
}

// ---------------------------------------------------------------------------
// 0. Is the declared ceiling/agnostic split the engine's own?
// ---------------------------------------------------------------------------
line('-');
console.log('0. SETUP CHECK -- does each family actually have (or not have) a ceiling?');
line('-');
{
    const probe = { ...COMMON, ...SCENARIOS[2].over,
                    spendGoal: Math.round(totalOf(SCENARIOS[2].over) * 0.04) };
    let bad = 0;
    for (const f of FAMILIES) {
        const r = sim({ ...probe, ...f.over });
        const has = r.log.some(x => (x.BracketTarget || 0) > 0);
        if (has !== f.ceiling) bad++;
        console.log('  ' + pad(f.label, 20) + pad(f.ceiling ? 'declared CEILING' : 'declared agnostic', 20)
            + (has ? 'engine sets a BracketTarget' : 'engine sets no BracketTarget')
            + (has === f.ceiling ? '' : '   <-- MISMATCH'));
    }
    if (bad === 0) {
        console.log('  The split is the engine measurement, not a harness assertion.');
    } else {
        // Printing the alarm and then printing the results anyway is how a retired strategy went on
        // supplying 30 of these cells after P94 deleted it: the run said "suspect" and the tables
        // below still looked quotable. A family whose ceiling the engine does not agree about is not
        // a degraded reading, it is a different question, so the run stops here instead.
        console.log('  ' + bad + ' families are labelled wrongly. A family the engine does not agree');
        console.log('  about cannot be scored on whether it breaks a ceiling, so this run STOPS');
        console.log('  rather than printing tables that read as if it could.');
        process.exit(1);
    }
}

// ---------------------------------------------------------------------------
// 1. Run the search
// ---------------------------------------------------------------------------
for (const c of CELLS) {
    const heirs = c.h == null ? sim({ ...c.base, strategy: 'propwd' }).totals.futureIRARate : c.h;
    c._heirs = heirs;
    const r = optimizeConversionAmount(c.base, c.f.over, 'baselineScore', { futureIRARate: heirs });
    c.optConv = r.optConv || 0;
    const at0 = sim({ ...c.base, ...c.f.over, extraConversionAmount: 0 });
    const atOpt = c.optConv > 0 ? sim({ ...c.base, ...c.f.over, extraConversionAmount: c.optConv }) : at0;
    c.gain = baselineScoreOf(atOpt, heirs, SPENDABLE_WEIGHT) - baselineScoreOf(at0, heirs, SPENDABLE_WEIGHT);
    const br = atOpt.log.filter(x => (x['-overageFromConv'] || 0) > 1);
    c.breachYrs = br.length;
    c.worstBreach = br.length ? Math.max(...br.map(x => x['-overageFromConv'])) : 0;
    c.ceilYrs = atOpt.log.filter(x => (x.BracketTarget || 0) > 0).length;
}

line('-');
console.log('1. WHAT THE SEARCH PICKS, by family');
line('-');
console.log('  ' + pad('family', 20) + pad('kind', 10) + rpad('cells', 7) + rpad('picks > $0', 12)
          + rpad('median pick', 14) + rpad('largest pick', 14) + rpad('median gain', 14));
for (const f of FAMILIES) {
    const g = CELLS.filter(c => c.f.key === f.key);
    const nz = g.filter(c => c.optConv > 0);
    console.log('  ' + pad(f.label, 20) + pad(f.ceiling ? 'CEILING' : 'agnostic', 10)
        + rpad(g.length, 7) + rpad(nz.length, 12)
        + (nz.length ? rpad(money(median(nz.map(c => c.optConv))), 14) : rpad('-', 14))
        + (nz.length ? rpad(money(Math.max.apply(null, nz.map(c => c.optConv))), 14) : rpad('-', 14))
        + (nz.length ? rpad(money(median(nz.map(c => c.gain))), 14) : rpad('-', 14)));
}

// ---------------------------------------------------------------------------
// 2. When it picks, does it break the ceiling?
// ---------------------------------------------------------------------------
line('-');
console.log('2. THE ROWS IT WOULD OFFER -- ceiling families with a non-zero pick');
line('-');
{
    const nz = CELLS.filter(c => c.f.ceiling && c.optConv > 0);
    if (!nz.length) {
        console.log('  None. The search returns $0 on every ceiling cell, so the Optimizer already');
        console.log('  drops all of them and the proposed exclusion would change nothing.');
    } else {
        console.log('  ' + pad('scenario', 20) + pad('family', 20) + pad('spend', 7) + pad('heirs', 7)
                  + rpad('pick', 13) + rpad('score gain', 14) + rpad('breach yrs', 12) + rpad('worst breach', 14));
        nz.slice().sort((a, b) => b.gain - a.gain).slice(0, 14).forEach(c => {
            console.log('  ' + pad(c.s.label, 20) + pad(c.f.label, 20)
                + pad((c.rate * 100) + '%', 7) + pad(c.h == null ? 'auto' : c.h, 7)
                + rpad(money(c.optConv), 13) + rpad(money(c.gain), 14)
                + rpad(c.breachYrs + '/' + c.ceilYrs, 12) + rpad(money(c.worstBreach), 14));
        });
        if (nz.length > 14) console.log('  ... ' + (nz.length - 14) + ' more non-zero ceiling cells not listed.');
    }
}

// ---------------------------------------------------------------------------
// 3. Is the heirs rate the lever?
// ---------------------------------------------------------------------------
line('-');
console.log('3. THE HEIRS RATE AS THE LEVER (C5) -- ceiling families only');
line('-');
console.log('  ' + pad('heirs rate', 12) + rpad('cells', 8) + rpad('picks > $0', 12) + rpad('median pick', 14));
for (const h of HEIRS) {
    const g = CELLS.filter(c => c.f.ceiling && c.h === h);
    const nz = g.filter(c => c.optConv > 0);
    console.log('  ' + pad(h == null ? 'auto' : h, 12) + rpad(g.length, 8) + rpad(nz.length, 12)
        + (nz.length ? rpad(money(median(nz.map(c => c.optConv))), 14) : rpad('-', 14)));
}
console.log('');
console.log('  ' + pad('spend rate', 12) + rpad('cells', 8) + rpad('picks > $0', 12));
for (const r of SPEND_RATES) {
    const g = CELLS.filter(c => c.f.ceiling && c.rate === r);
    console.log('  ' + pad((r * 100) + '%', 12) + rpad(g.length, 8) + rpad(g.filter(c => c.optConv > 0).length, 12));
}

// ---------------------------------------------------------------------------
// 4. Predictions
// ---------------------------------------------------------------------------
line('-');
console.log('4. PREDICTIONS SCORED');
line('-');
const verdict = (ok, txt) => console.log('  ' + (ok ? 'HOLDS ' : 'BROKEN') + '  ' + txt);
const ceil = CELLS.filter(c => c.f.ceiling);
const agn  = CELLS.filter(c => !c.f.ceiling);
const ceilNZ = ceil.filter(c => c.optConv > 0);

verdict(ceilNZ.length > 0,
    'C1  the search does NOT self-correct to zero: ' + ceilNZ.length + '/' + ceil.length
    + ' ceiling cells pick a non-zero conversion, so those rows do reach the table.');

{
    const noBreach = ceilNZ.filter(c => c.breachYrs === 0);
    verdict(ceilNZ.length > 0 && noBreach.length === 0,
        'C2  every non-zero ceiling pick breaches its own ceiling: '
        + (ceilNZ.length - noBreach.length) + '/' + ceilNZ.length + ' breach, '
        + noBreach.length + ' do not.');
}
{
    const gains = ceilNZ.map(c => c.gain);
    const tiny = gains.filter(g => Math.abs(g) < 1000).length;
    verdict(gains.length > 0 && median(gains) > 1000,
        'C3  the gain is material: median ' + money(median(gains)).trim() + ', largest '
        + money(gains.length ? Math.max.apply(null, gains) : 0).trim() + ', under $1,000 in '
        + tiny + ' of ' + gains.length + '.');
}
{
    const dirty = agn.filter(c => c.breachYrs > 0);
    verdict(dirty.length === 0,
        'C4  ZERO TEST: no agnostic family records conversion-caused overage in any of '
        + agn.length + ' cells (' + dirty.length + ' did).');
}
{
    let flips = 0;
    for (const f of FAMILIES.filter(x => x.ceiling)) {
        for (const s of SCENARIOS) for (const r of SPEND_RATES) {
            const row = HEIRS.map(h => CELLS.find(c =>
                c.f.key === f.key && c.s.key === s.key && c.rate === r && c.h === h));
            if (row.some(c => c && c.optConv === 0) && row.some(c => c && c.optConv > 0)) flips++;
        }
    }
    // C5 asked whether the HEIRS RATE is the lever, and "flips > 0" is far too low a bar to
    // answer it - 3 flips out of 60 combinations would pass that test and mean nothing. Scored
    // against the alternative instead: which axis actually moves the pick count?
    const byHeirs = HEIRS.map(h => ceil.filter(c => c.h === h && c.optConv > 0).length);
    const bySpend = SPEND_RATES.map(r => ceil.filter(c => c.rate === r && c.optConv > 0).length);
    const spread = (a) => Math.max.apply(null, a) - Math.min.apply(null, a);
    const combos = FAMILIES.filter(x => x.ceiling).length * SCENARIOS.length * SPEND_RATES.length;
    verdict(spread(byHeirs) > spread(bySpend),
        'C5  the heirs rate is the lever. Picks by heirs rate ' + byHeirs.join(' / ')
        + ' (spread ' + spread(byHeirs) + ') against picks by spend rate ' + bySpend.join(' / ')
        + ' (spread ' + spread(bySpend) + '). It flips a fixed family+scenario+spend in only '
        + flips + ' of ' + combos + ' combinations.');
    console.log('        The SPEND rate is the lever, not the heirs rate. That does not rescue a'
        + ' family-level exclusion:');
    console.log('        the families still split on spend rather than on identity, so the rule'
        + ' would still be the wrong shape.');
}

line('-');
console.log('  THE DECISION P88f OWES:');
console.log('    (a) exclude ceiling families   costs the gains in section 2');
console.log('    (b) leave it                   ships rows that break their own ceiling, unmarked');
console.log('    (c) keep the rows, mark them   the Strategy column already warns about a ceiling');
console.log('                                   that CANNOT be hit; a ceiling deliberately broken by');
console.log('                                   the row own conversion has no marker today');
line();
console.log(simCount + ' simulations outside the sweeps (each sweep runs many more).');
