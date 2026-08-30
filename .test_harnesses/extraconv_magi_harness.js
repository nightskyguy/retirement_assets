'use strict';
/**
 * extraconv_magi_harness.js -- P88a / P88b. An Extra Roth Conversion never reaches MAGI, so the
 * IRMAA lookback charges a figure that omits it. How wrong is it, and did fixing it move what the
 * characterization predicted?
 *
 * Run:  node .test_harnesses/extraconv_magi_harness.js
 *
 * THE DEFECT. `applyExtraConversion` (optimizer_core.js) recomputes the year's tax from its own
 * `calculateTaxes` call and copies `federalTax` and `stateTax` back out of the result. It copies
 * neither `MAGI` nor `AGI` nor `federalTaxableIncome`. `applyConversionGrossUp` has the same shape.
 * So the income tax on an extra conversion is charged correctly and the year's MAGI never moves.
 *
 * WHY THAT MATTERS, and it is not a display bug. `growAndSettle` pushes `yr.tax.MAGI` into
 * `balance.magiHistory`, and `beginYear` charges IRMAA off `magiHistory[len-2]` -- the two-year
 * lookback. The stale figure is what gets charged. A household can convert $100,000 a year and
 * never pay a cent of IRMAA on it.
 *
 * NOT A CEILING-STRATEGY PROBLEM. Every strategy uses this conversion path. Proportional and
 * Ordered are bracket-agnostic and under-report IRMAA identically; the grid below carries both so
 * that claim is measured rather than asserted.
 *
 * WHY THIS HARNESS EXISTS SEPARATELY FROM THE FIX (risk R12, the `rmdbasis_harness.js` lesson).
 * `P88b` moves IRMAA in almost every plan that converts, and therefore moves withdrawals, tax and
 * terminal wealth through the feedback loop. A genuinely broken assertion could then be "fixed" by
 * accepting whatever new value appeared. So the size and DIRECTION of every expected move is
 * recorded here BEFORE the change, and section 5 scores each one afterwards.
 *
 * Run it on the pre-fix engine and again after. Results in `research/EXTRA_CONVERSION_MAGI.md`,
 * which carries both columns.
 *
 * PREDICTIONS, stated before the fix:
 *   M1  BEFORE: the conversion gross is never ADDED to MAGI -- the year's logged MAGI moves by
 *       less than HALF the gross. AFTER: MAGI rises by the gross that was actually taken.
 *       This is the defect itself, so M1 is what flips.
 *
 *       M1 WAS FIRST WRITTEN AS "MAGI is IDENTICAL at $0 and at $100,000" and that is too strong,
 *       for a reason worth keeping. It holds exactly for the CEILING families, whose MAGI is pinned
 *       to the ceiling by construction, and fails for Proportional and Ordered, where MAGI drifts a
 *       little (-$3,640 and -$993 on the grid) because a larger conversion changes the surplus
 *       routing and therefore the ordinary draw. That drift is real second-order behavior, not the
 *       defect. The defect is the ABSENCE of the gross, so the threshold is one-sided and stated
 *       against the gross rather than as a band around zero: the drift reaches -14.6% of a $25,000
 *       conversion, and a symmetric 5% band scored that as a partial fix, which it is not.
 *   M2  AFTER: lifetime IRMAA dollars RISE, or stay equal, for every plan with a non-zero extra
 *       conversion and a household that reaches Medicare age. Never fall. Direction is certain --
 *       a larger MAGI cannot buy a cheaper tier -- even though the second-order feedback (a bigger
 *       IRMAA bill draws more, which moves later balances) makes the SIZE hard to predict.
 *   M3  ZERO TEST. A plan with `extraConversionAmount: 0` and `fundConversionWithCash: false` is
 *       BIT-IDENTICAL before and after. Neither code path runs, so nothing may move. If this
 *       breaks, the fix reached further than it should have.
 *   M4  A household that never reaches Medicare age shows MOVED MAGI and UNMOVED IRMAA. Separates
 *       the MAGI fix from the IRMAA charge, so a null result in M2 can be read correctly.
 *   M5  The FIRST year's federal + state income tax is UNCHANGED by the fix. The corrected MAGI is
 *       copied out of the same `calculateTaxes` result that already produced those two numbers, so
 *       touching it must not move them. Year 0 only: from year 2 the lookback bites and everything
 *       legitimately moves.
 *   M6  The gross-up path (`fundConversionWithCash: true`) carries the same staleness as the
 *       extra-conversion path, and is fixed by the same change.
 *
 * A NOTE ON WHAT "BEFORE" AND "AFTER" MEAN HERE. Unlike `bracketbasis_harness.js` there is no
 * research flag to A/B against: this is a defect, not a candidate behavior, so the fix is
 * unconditional. The comparison is between two RUNS OF THIS FILE on two builds, and the pre-fix
 * numbers live in the report. Section 1 is self-diagnosing and says which build it is looking at.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
Object.assign(globalThis, require('../taxengine.js'));
const core = require('../optimizer_core.js');
require('../displayhelpers.js');
const { simulate, afterTaxNetWorth } = core;

// COMMON copied verbatim from rmdbasis_harness.js, per the rule in phased_harness.js -- except
// extraConversionAmount and fundConversionWithCash, which are the axes here.
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

// A household that dies before Medicare eligibility, for M4. Same money, different ages.
const YOUNG = {
    birthyear1: 1985, birthmonth1: 6, die1: 62,
    birthyear2: 1987, birthmonth2: 3, die2: 62,
    ss1Age: 62, ss2Age: 62, startAge: 50, nYears: 12,
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

// Two ceiling families and two that are bracket-agnostic, so "this is not a ceiling problem" is
// measured rather than asserted.
const FAMILIES = [
    { key: 'fed22',   label: 'Fill Bracket 22%', ceiling: true,
      over: { strategy: 'bracket', stratRate: 0.22, stratIRMAATier: -1, stratACAMultiple: 0 } },
    { key: 'irmaa1',  label: 'IRMAA Tier 1',     ceiling: true,
      over: { strategy: 'bracket', stratRate: 0, stratIRMAATier: 1, stratACAMultiple: 0 } },
    { key: 'propwd',  label: 'Proportional 10%', ceiling: false,
      over: { strategy: 'propwd', propWithdraw: 0.10 } },
    { key: 'ordered', label: 'Ordered CBRI',     ceiling: false,
      over: { strategy: 'ordered', orderedSeq: 'CBRI' } },
];

// THE PRE-FIX RECORDING. Captured by running this file on the stale engine before P88b, so the
// same script scores the fix instead of a human comparing two pasted tables. Every number here is
// a MEASUREMENT, never a restatement of what the code ought to have produced. Do not regenerate
// these from a fixed build - they would then agree with anything.
const PRE_FIX = Object.freeze({
    magiMovedPctOfGross: { fed22: 0.0, irmaa1: 0.0, propwd: -3.6, ordered: -1.0 },  // at $100,000
    lifetimeIRMAA: {                       // cash-funding off, summed over the 5 scenarios
        fed22:   { 0: 1409139, 100000: 628518 },
        irmaa1:  { 0: 1249360, 100000: 778871 },
        propwd:  { 0: 1501543, 100000: 435339 },
        ordered: { 0: 1852918, 100000: 502349 },
    },
    zeroFingerprint: 39920984,             // M3: sum(lifetime IRMAA + tax + conversions), 20 cells
    year0FedState: { 0: 39238, 100000: 73125 },   // M5
});

const AMOUNTS = [0, 25000, 50000, 100000];
const CASHFUND = [false, true];
const SPEND_RATE = 0.05;

const totalOf = (o) => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;
const money = (n) => (n == null || Number.isNaN(n)) ? '      -     '
    : (n < 0 ? '-' : ' ') + '$' + Math.round(Math.abs(n)).toLocaleString().padStart(11);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

let simCount = 0;
function run(over) {
    const res = simulate(over);
    simCount++;
    const sum = (k) => res.log.reduce((a, r) => a + (r[k] || 0), 0);
    return {
        log: res.log,
        magi0: res.log[0] ? (res.log[0].MAGI || 0) : 0,
        extraConv0: res.log[0] ? (res.log[0].extraConv || 0) : 0,
        fedState0: res.log[0] ? ((res.log[0].FedTax || 0) + (res.log[0].StateTax || 0)) : 0,
        ceiling0: res.log[0] ? (res.log[0].BracketTarget || 0) : 0,
        overage0: res.log[0] ? (res.log[0].BracketOverage || 0) : 0,
        irmaa: sum('IRMAA'),
        irmaaYears: res.log.filter(r => (r.IRMAA || 0) > 0).length,
        extraConvTot: sum('extraConv'),
        conv: sum('rothConv'),
        tax: res.totals.taxCurrentDollars ?? 0,
        spend: res.totals.spendCurrentDollars ?? 0,
        terminal: res.totals.terminal,
        futureIRARate: res.totals.futureIRARate,
        capGainsRate: res.totals.capGainsRate,
        success: res.totals.success,
        onMedicareEver: res.log.some(r => (r.Medicare || 0) > 0),
    };
}

const line = (c) => console.log((c || '=').repeat(118));
line();
console.log('P88a -- an Extra Roth Conversion never reaches MAGI, so the IRMAA lookback omits it.');
console.log('Characterization, recorded BEFORE the fix and re-scored after.');
line();
console.log('Reading guide:');
console.log('  MAGI SENSITIVITY   log[0].MAGI at $X of extra conversion, minus the same at $0.');
console.log('                     A correct engine returns roughly the conversion gross. A stale one');
console.log('                     returns 0.');
console.log('  lifetime IRMAA     sum of the IRMAA column over the plan, nominal dollars.');
console.log('  M1..M6             predictions, stated in the file header, scored in section 5.');
console.log('  CEILING family     Fill Bracket / IRMAA Tier. AGNOSTIC family: Proportional, Ordered.');

// ---------------------------------------------------------------------------
// 1. Which build is this? Self-diagnosing, so a pasted table can never be mislabelled.
// ---------------------------------------------------------------------------
line('-');
console.log('1. WHICH BUILD IS THIS -- does MAGI respond to an extra conversion at all?');
line('-');
const probeBase = { ...COMMON, ...SCENARIOS[2].over, ...FAMILIES[0].over,
                    spendGoal: Math.round(totalOf(SCENARIOS[2].over) * SPEND_RATE) };
let STALE = null;
{
    const a = run({ ...probeBase, extraConversionAmount: 0 });
    const b = run({ ...probeBase, extraConversionAmount: 100000 });
    const delta = b.magi0 - a.magi0;
    STALE = Math.abs(delta) < 1;
    console.log('  probe: round-1 scenario / Fill Bracket 22% / CA, year 0');
    console.log('    ceiling                       ' + money(a.ceiling0));
    console.log('    MAGI at $0 extra conversion   ' + money(a.magi0));
    console.log('    MAGI at $100,000              ' + money(b.magi0)
              + '   (extra conversion taken: ' + money(b.extraConv0).trim() + ')');
    console.log('    MAGI moved by                 ' + money(delta));
    console.log('    logged BracketOverage         ' + money(b.overage0));
    console.log('  VERDICT: ' + (STALE
        ? 'STALE BUILD -- MAGI is independent of the conversion. The defect is present.'
        : 'FIXED BUILD -- MAGI tracks the conversion.'));
}

// ---------------------------------------------------------------------------
// 2. MAGI sensitivity across the grid
// ---------------------------------------------------------------------------
line('-');
console.log('2. MAGI SENSITIVITY -- how much does log[0].MAGI move per dollar of extra conversion?');
line('-');
const cells = [];
for (const s of SCENARIOS) for (const f of FAMILIES) for (const cf of CASHFUND) {
    const base = { ...COMMON, ...s.over, ...f.over, fundConversionWithCash: cf,
                   spendGoal: Math.round(totalOf(s.over) * SPEND_RATE) };
    const zero = run({ ...base, extraConversionAmount: 0 });
    for (const amt of AMOUNTS) {
        if (amt === 0) { cells.push({ s, f, cf, amt, r: zero, zero }); continue; }
        cells.push({ s, f, cf, amt, r: run({ ...base, extraConversionAmount: amt }), zero });
    }
}
console.log('  ' + pad('family', 20) + pad('cashFund', 10) + rpad('extraConv', 12)
          + rpad('gross taken', 14) + rpad('MAGI moved', 14) + rpad('as % of gross', 15));
for (const f of FAMILIES) for (const cf of CASHFUND) for (const amt of AMOUNTS) {
    if (amt === 0) continue;
    const g = cells.filter(c => c.f.key === f.key && c.cf === cf && c.amt === amt);
    const gross = g.reduce((a, c) => a + c.r.extraConv0, 0) / g.length;
    const moved = g.reduce((a, c) => a + (c.r.magi0 - c.zero.magi0), 0) / g.length;
    console.log('  ' + pad(f.label, 20) + pad(cf ? 'on' : 'off', 10) + rpad(money(amt), 12)
        + rpad(money(gross), 14) + rpad(money(moved), 14)
        + rpad(gross > 1 ? (100 * moved / gross).toFixed(1) + '%' : '-', 15));
}
console.log('  Means over the 5 scenarios. "gross taken" is the extraConv column, i.e. what the');
console.log('  engine actually converted after the IRA-balance cap. A correct engine reads ~100% in');
console.log('  the last column. The small NEGATIVE readings on the agnostic families are second-order:');
console.log('  a larger conversion changes surplus routing and therefore the ordinary draw. They are');
console.log('  not the conversion being counted -- that would be positive and the size of the gross.');

// ---------------------------------------------------------------------------
// 3. What IRMAA is being charged
// ---------------------------------------------------------------------------
line('-');
console.log('3. LIFETIME IRMAA -- what the lookback actually charges, by conversion size');
line('-');
console.log('  ' + pad('family', 20) + pad('kind', 11) + rpad('$0', 15) + rpad('$25,000', 15)
          + rpad('$50,000', 15) + rpad('$100,000', 15) + rpad('surcharge yrs @$100k', 22));
for (const f of FAMILIES) {
    const at = (amt) => {
        const g = cells.filter(c => c.f.key === f.key && !c.cf && c.amt === amt);
        return g.reduce((a, c) => a + c.r.irmaa, 0);
    };
    const yrs = cells.filter(c => c.f.key === f.key && !c.cf && c.amt === 100000)
                     .reduce((a, c) => a + c.r.irmaaYears, 0);
    console.log('  ' + pad(f.label, 20) + pad(f.ceiling ? 'ceiling' : 'agnostic', 11)
        + rpad(money(at(0)), 15) + rpad(money(at(25000)), 15)
        + rpad(money(at(50000)), 15) + rpad(money(at(100000)), 15) + rpad(yrs, 22));
}
console.log('  Totals across the 5 scenarios, cash-funding off. On a stale build these barely move');
console.log('  with the conversion, and where they FALL it is the shrinking IRA lowering later RMDs,');
console.log('  not the conversion being priced.');

// ---------------------------------------------------------------------------
// 4. The year-0 tax, and the young household
// ---------------------------------------------------------------------------
line('-');
console.log('4. YEAR-0 INCOME TAX (M5) and a household that never reaches Medicare (M4)');
line('-');
{
    console.log('  Year-0 federal + state income tax, round-1 scenario, Fill Bracket 22%:');
    for (const amt of AMOUNTS) {
        const r = run({ ...probeBase, extraConversionAmount: amt });
        console.log('    extraConv ' + rpad(money(amt), 13) + '  fed+state ' + money(r.fedState0)
            + '   MAGI ' + money(r.magi0));
    }
    console.log('  These are the numbers M5 says the fix must NOT move.');
    console.log('');
    const yBase = { ...COMMON, ...YOUNG, ...SCENARIOS[2].over, ...FAMILIES[2].over,
                    spendGoal: Math.round(totalOf(SCENARIOS[2].over) * SPEND_RATE) };
    const y0 = run({ ...yBase, extraConversionAmount: 0 });
    const y1 = run({ ...yBase, extraConversionAmount: 100000 });
    console.log('  Young household (dies at 62, never on Medicare), Proportional 10%:');
    console.log('    reaches Medicare age:  ' + (y0.onMedicareEver ? 'YES -- M4 is invalid as built' : 'no'));
    console.log('    MAGI moved by $100k conversion:  ' + money(y1.magi0 - y0.magi0));
    console.log('    lifetime IRMAA  $0 / $100k:      ' + money(y0.irmaa) + ' / ' + money(y1.irmaa));
}

// ---------------------------------------------------------------------------
// 5. Predictions
// ---------------------------------------------------------------------------
line('-');
console.log('5. PREDICTIONS SCORED');
line('-');
const verdict = (ok, txt) => console.log('  ' + (ok ? 'HOLDS ' : 'BROKEN') + '  ' + txt);

{   // M1 -- the defect itself. Scored against the GROSS, not against zero: see the header note.
    const conv = cells.filter(c => c.amt > 0 && c.r.extraConv0 > 1);
    // "absent" is a claim about the GROSS not being added, so it is a one-sided test against half
    // the gross -- not a symmetric band around zero. The agnostic families' routing drift reaches
    // -14.6% of a $25,000 conversion, which is nowhere near +100% and must not read as a partial fix.
    const absent = conv.filter(c => (c.r.magi0 - c.zero.magi0) < c.r.extraConv0 * 0.5);
    const frozen = conv.filter(c => Math.abs(c.r.magi0 - c.zero.magi0) < 1);
    const tracked = conv.filter(c => Math.abs((c.r.magi0 - c.zero.magi0) - c.r.extraConv0)
                                     <= Math.max(1, c.r.extraConv0 * 0.05));
    if (STALE) {
        verdict(absent.length === conv.length,
            'M1  BEFORE: the gross is absent from MAGI in ' + absent.length + '/' + conv.length
            + ' converting cells (exactly frozen in ' + frozen.length + ' -- the ceiling families, '
            + 'whose MAGI the ceiling pins).');
    } else {
        // Mirror of the BEFORE test, and one-sided for the same reason: the agnostic families'
        // routing drift is worth up to 15% of a $25,000 conversion, so "present" is the claim that
        // can be scored cleanly. The exact-match count is reported beside it rather than asserted.
        verdict(absent.length === 0,
            'M1  AFTER: the gross is present in MAGI in ' + (conv.length - absent.length) + '/'
            + conv.length + ' converting cells, exact to within 5% in ' + tracked.length
            + ' (the rest are the routing drift, largest on Proportional at $25,000).');
    }
}
{   // M2 -- lifetime IRMAA must RISE against the recording, and only where a conversion happens.
    const at = (k, amt) => cells.filter(c => c.f.key === k && !c.cf && c.amt === amt)
                                .reduce((a, c) => a + c.r.irmaa, 0);
    let rose = 0, unchanged0 = 0;
    console.log('  M2  lifetime IRMAA vs the pre-fix recording, cash-funding off, 5 scenarios:');
    console.log('      ' + pad('family', 20) + rpad('pre @$100k', 15) + rpad('now @$100k', 15)
        + rpad('change', 15) + rpad('pre @$0', 15) + rpad('now @$0', 15));
    for (const f of FAMILIES) {
        const rec = PRE_FIX.lifetimeIRMAA[f.key];
        const now100 = at(f.key, 100000), now0 = at(f.key, 0);
        if (now100 > rec[100000] + 1) rose++;
        if (Math.abs(now0 - rec[0]) < 1) unchanged0++;
        console.log('      ' + pad(f.label, 20) + rpad(money(rec[100000]), 15) + rpad(money(now100), 15)
            + rpad((now100 > rec[100000] ? '+' : '') + Math.round(100 * (now100 - rec[100000]) / Math.max(1, rec[100000])) + '%', 15)
            + rpad(money(rec[0]), 15) + rpad(money(now0), 15));
    }
    if (STALE) {
        console.log('      (stale build -- these are the recording itself, so the comparison is vacuous)');
    } else {
        verdict(rose === FAMILIES.length && unchanged0 === FAMILIES.length,
            'M2  lifetime IRMAA rose in ' + rose + '/' + FAMILIES.length + ' families at $100,000, and is'
            + ' unchanged in ' + unchanged0 + '/' + FAMILIES.length + ' at $0 -- the fix charges the'
            + ' conversion and touches nothing else.');
    }
}
{   // M3 -- zero test, scored against the recording
    const z = cells.filter(c => c.amt === 0 && !c.cf);
    const fp = z.reduce((a, c) => a + c.r.irmaa + c.r.tax + c.r.conv, 0);
    verdict(Math.abs(fp - PRE_FIX.zeroFingerprint) < 1,
        'M3  ZERO TEST over ' + z.length + ' cells with no extra conversion and no cash-funding: '
        + 'sum(lifetime IRMAA + tax + conversions) = ' + money(fp).trim() + ', recorded '
        + money(PRE_FIX.zeroFingerprint).trim() + '. Neither conversion path runs, so nothing may move.');
}
{   // M4 -- young household
    const yBase = { ...COMMON, ...YOUNG, ...SCENARIOS[2].over, ...FAMILIES[2].over,
                    spendGoal: Math.round(totalOf(SCENARIOS[2].over) * SPEND_RATE) };
    const y0 = run({ ...yBase, extraConversionAmount: 0 });
    const y1 = run({ ...yBase, extraConversionAmount: 100000 });
    verdict(!y0.onMedicareEver && y0.irmaa === 0 && y1.irmaa === 0,
        'M4  the young household pays $0 IRMAA on both arms, so a null in M2 for it is the age gate '
        + 'and not the fix.');
}
{   // M5 -- year-0 income tax must not move: the corrected MAGI comes out of the same calc
    const a = run({ ...probeBase, extraConversionAmount: 0 });
    const b = run({ ...probeBase, extraConversionAmount: 100000 });
    const ok = Math.abs(a.fedState0 - PRE_FIX.year0FedState[0]) < 1
            && Math.abs(b.fedState0 - PRE_FIX.year0FedState[100000]) < 1;
    verdict(ok, 'M5  year-0 fed+state income tax: $0 arm ' + money(a.fedState0).trim() + ' (recorded '
        + money(PRE_FIX.year0FedState[0]).trim() + '), $100k arm ' + money(b.fedState0).trim()
        + ' (recorded ' + money(PRE_FIX.year0FedState[100000]).trim() + '). The corrected MAGI is '
        + 'copied out of the calc that already produced these, so they must not move.');
}
{   // M6 -- the gross-up path carries the same staleness and the same fix
    const conv = cells.filter(c => c.amt > 0 && c.r.extraConv0 > 1);
    const pctOf = (cf) => {
        const g = conv.filter(c => c.cf === cf && c.amt === 100000);
        const gross = g.reduce((a, c) => a + c.r.extraConv0, 0);
        const moved = g.reduce((a, c) => a + (c.r.magi0 - c.zero.magi0), 0);
        return gross > 0 ? 100 * moved / gross : 0;
    };
    const off = pctOf(false), on = pctOf(true);
    verdict(Math.abs(on - off) < 5,
        'M6  at $100,000 the MAGI basis moves ' + off.toFixed(1) + '% of gross with cash-funding OFF and '
        + on.toFixed(1) + '% with it ON -- the two conversion paths agree, so one fix covered both.');
}

line('-');
console.log('  WHAT TO CARRY TO THE REPORT: section 1 verdict, section 2 "as % of gross" column,');
console.log('  section 3 lifetime IRMAA table, and the M3 fingerprint. Re-run after the fix and');
console.log('  paste the second column beside them.');
line();
console.log(simCount + ' simulations.');
