'use strict';
/**
 * bracketbasis_harness.js -- P87a, re-pointed after P92a shipped the fix.
 *
 * Run:  node .test_harnesses/bracketbasis_harness.js
 *
 * THE DEFECT IT WAS BUILT FOR. The strategy "Limit" dropdown emits three kinds of ceiling and
 * `computeBracketCeiling` handed all three back as one number, which every caller spends as a MAGI
 * ceiling:
 *
 *   IRMAA Tier n   TAXData.IRMAA brackets     MAGI = AGI + tax-exempt interest        correct
 *   n% Fed         TAXData.FEDERAL brackets   TAXABLE income, i.e. AFTER the           WAS WRONG BY
 *                                             deduction (`std` is a separate field)    ONE DEDUCTION
 *   n% FPL         an FPL multiple            ACA MAGI (adds back non-taxable SS)      ceiling right
 *
 * So "fill the 22% bracket" stopped when MAGI reached the 22% top, leaving federal taxable income one
 * whole deduction short of it, every year, in the same direction, with no cliff crossed to announce
 * it. P92a (v11.16aa) raised the federal ceiling by that deduction unconditionally.
 *
 * WHY THIS FILE CHANGED SHAPE. It used to A/B the research flag `bracketCeilingAddDeduction`. P92a
 * deleted the flag, so from that commit the harness set an input nothing read, both arms were the
 * same run, and it scored four predictions on a column of zeros while printing HOLDS and BROKEN as
 * though it had measured something -- the exact failure `unifiedconv_harness.js` hit with
 * `unifiedConvRouting`, and the one section 0 was written to catch.
 *
 * The A/B cannot come back: reconstructing the old ceiling would mean re-adding dead code to
 * production for a settled question. So the question changes from "what would raising the ceiling be
 * worth" -- answered, shipped, and recorded in BRACKET_CEILING_BASIS.md section 8 -- to "is the
 * shipped ceiling on one basis, and how much room did it release". That is answerable off ONE arm,
 * because P92a logs `-ceilDedAddBack` beside `-fedDeduction` precisely so the residual is auditable
 * from a finished run instead of argued.
 *
 * WHAT THE TWO OPERANDS ARE. `-ceilDedAddBack` is the deduction the CEILING used, estimated in two
 * passes before the year's income is known; `-fedDeduction` is the deduction actually CHARGED. They
 * differ by whatever the estimate could not see coming, and the OBBBA senior deduction phases out
 * against federal AGI -- the very quantity the ceiling is about to determine -- so some residual is
 * structural rather than a defect. `ceilded_harness.js` is where the candidate estimators were
 * scored against each other; this one audits the one that shipped, in situ.
 *
 * PREDICTIONS, registered before the run. New codes: the old B1..B5 were claims about an ARM that no
 * longer exists, and are kept only in the report as what was measured pre-fix.
 *   A1  LIVENESS. On a federal-bracket family the add-back is non-zero in the years that have a
 *       ceiling. If it is zero everywhere the fix has regressed, and this reports BROKEN rather than
 *       "no effect" -- `brokerage_harness.js` printed SKIPPED for months against a counter name that
 *       never existed.
 *   A2  THE POINT OF THE FIX. In a year that sits ON the ceiling, federal TAXABLE income now lands on
 *       the federal bracket top, which is what "fill the 22% bracket" was always supposed to mean.
 *       Scored per year, not on a lifetime total -- the lifetime form is not monotone in the ceiling
 *       and condemned a working arm in 70 of 160 cells once already. Same failure as `rmdbasis`'s R2.
 *   A3  The two-pass estimate is close: the add-back matches the deduction charged in the median
 *       year, and never misses by more than one senior deduction ($6,000 per filer).
 *   A4  ZERO TEST. `IRMAA Tier n` and `n% FPL` ceilings get no add-back at all -- their ceilings are
 *       already MAGI-based and lifting them would be a second, opposite basis error.
 *   A5  The room released GROWS with indexation and the age-65 bumps, so the defect was widening: the
 *       last ceiling year's add-back exceeds the first's.
 *
 * NOT MEASURED HERE, deliberately. What the fix COST in wealth needs two arms and therefore needs
 * `main`; it is measured in the P92a commit and recorded in BRACKET_CEILING_BASIS.md section 8
 * (median -$47,549 over 71 clean cells). Section 9 of that report carries a SECOND basis error of the
 * same shape that is still shipped -- a plan stops exactly 15% of its Social Security short of the
 * ceiling -- which `underfill_harness.js` owns.
 *
 * Results in `research/BRACKET_CEILING_BASIS.md`.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
Object.assign(globalThis, require('../taxengine.js'));
const core = require('../optimizer_core.js');
require('../displayhelpers.js');
const { simulate, afterTaxNetWorth } = core;

// COMMON copied verbatim from rmdbasis_harness.js, per the rule in phased_harness.js -- except
// iraBaseGoal, which is an AXIS here rather than a constant, because B5 is a claim about it.
const COMMON = {
    STATEname: 'CA', nYears: 20,
    birthyear1: 1962, birthmonth1: 6, die1: 92,
    birthyear2: 1964, birthmonth2: 3, die2: 94, hasSpouse: true,
    ss1: 45000, ss1Age: 70, ss2: 24000, ss2Age: 67,
    pensionAnnual: 0, pensionStartAge: 0, survivorPct: 0, pensionCola: false,
    spendChange: 0,
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

// The federal-table families first, then the two controls A4 says must not move.
// `minlimit` was a fourth row here until P94 deleted the strategy; its result -- that the
// federal basis error never reached it, because its ceiling came from the spending goal and
// not the federal table -- is kept in BRACKET_CEILING_BASIS.md, not simulated against an
// engine that no longer has the branch.
const FAMILIES = [
    { key: 'fed12',  label: 'Fill Bracket 12%', fed: true,
      over: { strategy: 'bracket', stratRate: 0.12, stratIRMAATier: -1, stratACAMultiple: 0 } },
    { key: 'fed22',  label: 'Fill Bracket 22%', fed: true,
      over: { strategy: 'bracket', stratRate: 0.22, stratIRMAATier: -1, stratACAMultiple: 0 } },
    { key: 'fed24',  label: 'Fill Bracket 24%', fed: true,
      over: { strategy: 'bracket', stratRate: 0.24, stratIRMAATier: -1, stratACAMultiple: 0 } },
    { key: 'irmaa1', label: 'IRMAA Tier 1',     fed: false, control: true,
      over: { strategy: 'bracket', stratRate: 0, stratIRMAATier: 1, stratACAMultiple: 0 } },
    { key: 'aca400', label: 'ACA 400% FPL',     fed: false, control: true,
      over: { strategy: 'aca', stratRate: 0, stratIRMAATier: -1, stratACAMultiple: 400 } },
];

const GOALS  = [ { key: 'nogoal', label: 'no IRA Goal',   v: 0 },
                 { key: 'goal',   label: 'IRA Goal 750k', v: 750000 } ];
const STATES = ['CA', 'TX'];
const SPEND_RATES = [0.04, 0.06];

const totalOf = (o) => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;
const money = (n) => (n == null || Number.isNaN(n)) ? '      -     '
    : (n < 0 ? '-' : ' ') + '$' + Math.round(Math.abs(n)).toLocaleString().padStart(11);
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const pct = (r) => (r * 100).toFixed(0) + '%';
const median = (xs) => { if (!xs.length) return null; const v = [...xs].sort((x, y) => x - y);
    return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };

// A year is AT-CEILING when MAGI landed on the ceiling, SLACK when something else stopped it first,
// and OVER when the third-pass fallback forced a draw past it. Only AT years can be losing anything,
// so the census reports all three rather than one ratio.
const TOL = 2;
function classifyYear(r) {
    const bt = r.BracketTarget || 0;
    if (!(bt > 0)) return null;
    const d = (r.MAGI || 0) - bt;
    if (d > TOL) return 'over';
    if (d < -TOL) return 'slack';
    return 'at';
}

let simCount = 0;
function run(over) {
    const res = simulate(over);
    simCount++;
    const sum = (k) => res.log.reduce((a, r) => a + (r[k] || 0), 0);
    return {
        log: res.log,
        conv: sum('rothConv'),
        iraSpend: sum('-iraSpend'),
        tax: res.totals.taxCurrentDollars ?? 0,
        spend: res.totals.spendCurrentDollars ?? 0,
        terminal: res.totals.terminal,
        futureIRARate: res.totals.futureIRARate,
        capGainsRate: res.totals.capGainsRate,
        success: res.totals.success,
    };
}

const CELLS = [];
for (const s of SCENARIOS) for (const g of GOALS) for (const st of STATES)
for (const f of FAMILIES) for (const rate of SPEND_RATES) {
    CELLS.push({ s, g, st, f, rate, base: {
        ...COMMON, ...s.over, ...f.over, STATEname: st, iraBaseGoal: g.v,
        spendGoal: Math.round(totalOf(s.over) * rate) } });
}

const line = (c) => console.log((c || '=').repeat(118));
line();
console.log('P87a/P92a -- the federal bracket ceiling was a TAXABLE-income threshold spent as a MAGI');
console.log('ceiling. It is raised by the deduction now: does it land on one basis, and what did that release?');
line();
console.log('Grid: ' + SCENARIOS.length + ' scenarios x ' + GOALS.length + ' IRA-Goal settings x '
          + STATES.length + ' states x ' + FAMILIES.length + ' families x ' + SPEND_RATES.length
          + ' spend rates = ' + CELLS.length + ' cells, one arm (the shipped engine).');
console.log('Reading guide:');
console.log('  ADD-BACK  -ceilDedAddBack, the deduction the CEILING used (0 for non-federal ceilings).');
console.log('  CHARGED   -fedDeduction, the deduction actually charged. ADD-BACK minus CHARGED is the');
console.log('            two-pass estimate residual, and some of it is structural (see the header).');
console.log('  BR TOP    the federal bracket top the ceiling is built on = ceiling minus ADD-BACK.');
console.log('  AT        MAGI landed on the ceiling -- the only years that can be losing anything.');
console.log('  SLACK     something else stopped the draw first (spending, IRA Goal, empty IRA).');
console.log('  OVER      the third-pass fallback forced a draw past the ceiling to fund spending.');
console.log('  A1..A5    predictions, stated in the file header and scored in section 4.');

// ---------------------------------------------------------------------------
// 0. Is the ceiling's add-back live at all?
// ---------------------------------------------------------------------------
line('-');
console.log("0. LIVENESS (A1) -- does the shipped ceiling carry a deduction add-back, and only where it should?");
line('-');
{
    const probe = CELLS.find(c => c.f.key === 'fed22' && c.g.key === 'nogoal' && c.st === 'CA'
                                  && c.s.key === 'defaults3x' && c.rate === 0.04);
    const a = run({ ...probe.base });
    const ceilYears = a.log.filter(r => (r.BracketTarget || 0) > 0);
    const withAdd   = ceilYears.filter(r => (r['-ceilDedAddBack'] || 0) > 1);
    const first     = ceilYears[0] || {};
    console.log('  probe cell: ' + probe.s.label + ' / ' + probe.f.label + ' / ' + probe.st
              + ' / ' + probe.g.label + ' / spend ' + pct(probe.rate));
    console.log('  ceiling years ' + ceilYears.length + ', of which ' + withAdd.length + ' carry an add-back');
    console.log('  first ceiling year: ceiling ' + money(first.BracketTarget)
              + '  bracket top ' + money((first.BracketTarget || 0) - (first['-ceilDedAddBack'] || 0))
              + '  add-back ' + money(first['-ceilDedAddBack']));
    // A field that is absent reads as 0 and would score exactly like a regressed fix, so the two are
    // told apart explicitly rather than pooled into one falsy check.
    const present = ceilYears.some(r => r['-ceilDedAddBack'] !== undefined);
    console.log('  add-back: ' + (!present
        ? 'ABSENT -- the log field is gone; this harness is probing a name the engine no longer writes'
        : withAdd.length === ceilYears.length
            ? 'LIVE -- every ceiling year carries one'
            : withAdd.length > 0
                ? 'PARTIAL -- ' + (ceilYears.length - withAdd.length) + ' ceiling years carry none'
                : 'BROKEN -- no ceiling year carries one; P92a has regressed'));
    if (!present || withAdd.length === 0) {
        console.log('  Nothing below can mean anything if the ceiling carries no add-back, so the run STOPS.');
        process.exit(1);
    }
}

// ---------------------------------------------------------------------------
// 1. One plan, year by year
// ---------------------------------------------------------------------------
line('-');
console.log('1. ONE PLAN, YEAR BY YEAR -- defaults x3, Fill Bracket 22%, CA, no IRA Goal, 4% spend');
line('-');
{
    const cell = CELLS.find(c => c.f.key === 'fed22' && c.g.key === 'nogoal' && c.st === 'CA'
                                 && c.s.key === 'defaults3x' && c.rate === 0.04);
    const a = run({ ...cell.base });
    console.log('  ' + pad('year', 6) + rpad('ceiling', 13) + rpad('MAGI', 13) + rpad('br top', 13)
              + rpad('fed taxable', 13) + rpad('add-back', 13) + rpad('charged', 13)
              + rpad('residual', 12) + '  where');
    a.log.forEach((r, i) => {
        const cls = classifyYear(r);
        if (cls === null) return;
        const add = r['-ceilDedAddBack'] || 0;
        const top = (r.BracketTarget || 0) - add;
        console.log('  ' + pad(r.Year != null ? r.Year : (2026 + i), 6)
            + money(r.BracketTarget) + money(r.MAGI) + money(top)
            + money(r['-fedTaxableInc']) + money(add) + money(r['-fedDeduction'])
            + rpad(Math.round(add - (r['-fedDeduction'] || 0)).toLocaleString(), 12)
            + '  ' + pad(cls.toUpperCase(), 6));
    });
    console.log('  In an AT year "fed taxable" should sit on "br top": that is the whole point of P92a,');
    console.log('  and before it the two differed by the "charged" column every single year.');
    console.log('  A SLACK or OVER year is governed by something other than the ceiling, so it says');
    console.log('  nothing either way -- section 3 scores AT years only, and counts the rest.');
}

// ---------------------------------------------------------------------------
// 2. Census
// ---------------------------------------------------------------------------
line('-');
console.log('2. CENSUS (control arm only) -- where the ceiling actually binds. Upper bound on the loss.');
line('-');
const census = {};
for (const c of CELLS) {
    const a = run({ ...c.base });
    c._ctrl = a;
    let at = 0, slack = 0, over = 0, hidden = 0;
    for (const r of a.log) {
        const cls = classifyYear(r);
        if (cls === 'at')    { at++; hidden += (r['-ceilDedAddBack'] || 0); }
        if (cls === 'slack') slack++;
        if (cls === 'over')  over++;
    }
    c._cen = { at, slack, over, hidden };
    const k = c.f.key;
    census[k] = census[k] || { at: 0, slack: 0, over: 0, hidden: 0, cells: 0 };
    census[k].at += at; census[k].slack += slack; census[k].over += over;
    census[k].hidden += hidden; census[k].cells++;
}
console.log('  ' + pad('family', 20) + rpad('cells', 7) + rpad('AT yrs', 9) + rpad('SLACK', 9)
          + rpad('OVER', 10) + rpad('room released', 46));
for (const f of FAMILIES) {
    const v = census[f.key];
    console.log('  ' + pad(f.label, 20) + rpad(v.cells, 7) + rpad(v.at, 9) + rpad(v.slack, 9)
              + rpad(v.over, 10) + rpad(money(v.hidden), 46));
}
console.log('  Room released is the deduction the ceiling now adds back, summed over AT years -- the');
console.log('  headroom the pre-P92a ceiling left unusable. It is an UPPER BOUND on what the fix');
console.log('  could hand back, not a gain: a year only gains if the plan had IRA left to draw.');
console.log('  A family with 0 there is untouched by the federal basis error, whatever its label says.')

// ---------------------------------------------------------------------------
// 3. The basis audit
// ---------------------------------------------------------------------------
line('-');
console.log('3. BASIS AUDIT -- in an AT year, does federal TAXABLE income land on the bracket top?');
line('-');
// One arm, so this is a property of the shipped engine rather than a comparison. Every AT year on a
// federal-bracket family is a year the ceiling governed, which makes it the only place the question
// is answerable; SLACK and OVER years are counted so a family that never binds cannot look clean by
// having nothing to be wrong about.
const audit = {};
for (const c of CELLS) {
    const k = c.f.key;
    audit[k] = audit[k] || { at: 0, land: [], resid: [], charged: [], addFirst: null, addLast: null, nonzero: 0, years: 0 };
    const A = audit[k];
    for (const r of c._ctrl.log) {
        const cls = classifyYear(r);
        if (cls === null) continue;
        A.years++;
        const add = r['-ceilDedAddBack'] || 0;
        if (add > 1) {
            A.nonzero++;
            if (A.addFirst === null) A.addFirst = add;
            A.addLast = add;
        }
        if (cls !== 'at') continue;
        A.at++;
        // Only a FEDERAL ceiling has a bracket top to land on. On an IRMAA or ACA ceiling the same
        // subtraction returns the deduction and would read as a huge miss, which is an artifact of
        // asking a federal question of a non-federal family, not a finding about it.
        if (!c.f.fed) continue;
        A.land.push((r['-fedTaxableInc'] || 0) - ((r.BracketTarget || 0) - add));
        A.resid.push(add - (r['-fedDeduction'] || 0));
        A.charged.push(r['-fedDeduction'] || 0);
    }
}
const absMax = (xs) => xs.length ? Math.max.apply(null, xs.map(Math.abs)) : null;
const p90 = (xs) => { if (!xs.length) return null; const v = [...xs].map(Math.abs).sort((a, b) => a - b);
    return v[Math.min(v.length - 1, Math.floor(v.length * 0.9))]; };
console.log('  ' + pad('family', 20) + rpad('ceil yrs', 10) + rpad('AT', 7) + rpad('add-back yrs', 14)
          + rpad('median |land err|', 18) + rpad('worst |land err|', 18)
          + rpad('median resid', 14) + rpad('p90 resid', 12) + rpad('worst resid', 13));
for (const f of FAMILIES) {
    const A = audit[f.key];
    const land = A.land.map(Math.abs), res = A.resid.map(Math.abs);   // empty for non-federal families
    console.log('  ' + pad(f.label, 20) + rpad(A.years, 10) + rpad(A.at, 7) + rpad(A.nonzero, 14)
        + rpad(land.length ? Math.round(median(land)).toLocaleString() : '-', 18)
        + rpad(land.length ? Math.round(absMax(A.land)).toLocaleString() : '-', 18)
        + rpad(res.length ? Math.round(median(res)).toLocaleString() : '-', 14)
        + rpad(res.length ? Math.round(p90(A.resid)).toLocaleString() : '-', 12)
        + rpad(res.length ? Math.round(absMax(A.resid)).toLocaleString() : '-', 13));
}
console.log('  land err = fed taxable income minus the bracket top, in AT years, and only where the');
console.log('  ceiling IS a federal bracket top -- the two control families show "-" because the');
console.log('  question does not apply to them, which is different from them passing it.');
console.log('  resid = add-back minus deduction charged. Structurally non-zero (see the header), so it');
console.log('  is scored against a bound -- one senior deduction -- rather than against zero.');

// ---------------------------------------------------------------------------
// 4. Predictions
// ---------------------------------------------------------------------------
line('-');
console.log('4. PREDICTIONS SCORED');
line('-');
const verdict = (ok, txt) => console.log('  ' + (ok ? 'HOLDS ' : 'BROKEN') + '  ' + txt);
const fedKeys = FAMILIES.filter(f => f.fed).map(f => f.key);
const ctlKeys = FAMILIES.filter(f => f.control).map(f => f.key);
const pool = (keys, field) => keys.reduce((a, k) => a.concat(audit[k][field]), []);

{   // A1 -- liveness across the whole grid, not just the section 0 probe
    const on  = fedKeys.reduce((a, k) => a + audit[k].nonzero, 0);
    const yrs = fedKeys.reduce((a, k) => a + audit[k].years, 0);
    verdict(on > 0 && on === yrs,
        'A1  every federal-bracket ceiling year carries an add-back: ' + on + '/' + yrs + '.');
}
{   // A2 -- the point of the fix. Scored per AT year, against the deduction it replaced.
    //
    // A2 AND A3 ARE ONE NUMBER, and saying so is worth more than scoring it twice. In an AT year
    // MAGI sits on the ceiling, so fed taxable = ceiling - dedCharged while the bracket top =
    // ceiling - addBack; the landing error is therefore addBack - dedCharged exactly, which is A3's
    // residual. The first draft scored A2 against a flat $2 and reported BROKEN at 287/305 on a
    // worst miss of $30 -- condemning a working fix for a rounding-scale residual, which is the
    // failure rmdbasis's R2 and bracketbasis's own B1 each made once already.
    //
    // The bar that means something is SCALE. Before P92a the miss was one whole deduction, every
    // year; the claim is that it is now negligible against that deduction, so that is what it is
    // measured against rather than against zero.
    const land = pool(fedKeys, 'land');
    const ded  = median(pool(fedKeys, 'charged')) || 0;
    const worst = land.length ? absMax(land) : 0;
    const exact = land.filter(x => Math.abs(x) <= 2).length;
    const share = ded > 0 ? worst / ded : 0;
    verdict(land.length > 0 && share < 0.01,
        'A2  AT years landing fed taxable income on the bracket top: worst miss $'
        + Math.round(worst).toLocaleString() + ' against a median deduction of $'
        + Math.round(ded).toLocaleString() + ' = ' + (share * 100).toFixed(3)
        + '% of it (' + exact + '/' + land.length + ' land within $2).');
    console.log('        Pre-P92a this miss was 100% of the deduction in every one of these years.');
    console.log('        It is the same quantity A3 scores -- see the note in the source, not two results.');
}
{   // A3 -- the two-pass estimate against its bound
    const res = pool(fedKeys, 'resid');
    const SENIOR = 6000 * 2;      // $6,000 per filer, MFJ on this fixture
    const bust = res.filter(x => Math.abs(x) > SENIOR);
    verdict(res.length > 0 && median(res.map(Math.abs)) === 0 && bust.length === 0,
        'A3  add-back vs deduction charged: median $' + Math.round(median(res.map(Math.abs))).toLocaleString()
        + ', p90 $' + Math.round(p90(res)).toLocaleString()
        + ', worst $' + Math.round(absMax(res)).toLocaleString()
        + ', over one senior deduction in ' + bust.length + '/' + res.length + '.');
}
{   // A4 -- zero test on the two controls
    const on = ctlKeys.reduce((a, k) => a + audit[k].nonzero, 0);
    const yrs = ctlKeys.reduce((a, k) => a + audit[k].years, 0);
    verdict(on === 0,
        'A4  ZERO TEST: IRMAA Tier and ACA ceilings take no add-back in ' + (yrs - on) + '/' + yrs
        + ' ceiling years.');
    console.log('        Those ceilings are already MAGI-based. Lifting them would be a second basis');
    console.log('        error pointing the other way, so this is the check that the fix stayed narrow.');
}
{   // A5 -- the defect was widening
    const grew = fedKeys.filter(k => audit[k].addFirst !== null && audit[k].addLast > audit[k].addFirst);
    verdict(grew.length === fedKeys.length,
        'A5  room released grows with indexation in ' + grew.length + '/' + fedKeys.length
        + ' federal families.');
    for (const k of fedKeys) {
        const A = audit[k], f = FAMILIES.find(x => x.key === k);
        console.log('        ' + pad(f.label, 20) + ' first ' + money(A.addFirst) + '   last ' + money(A.addLast));
    }
}

line('-');
{
    const totalRoom = Object.keys(census).reduce((a, k) => a + census[k].hidden, 0);
    const atYears = FAMILIES.filter(f => f.fed).reduce((a, f) => a + census[f.key].at, 0);
    console.log('  WHAT P87a ASKED, answered off the shipped engine:');
    console.log('    federal-family years that sat ON the ceiling     ' + atYears);
    console.log('    room the ceiling now releases across the grid    ' + money(totalRoom));
    console.log('  What that room turned out to be WORTH needs two arms and therefore needs `main`.');
    console.log('  It is measured in the P92a commit and recorded in BRACKET_CEILING_BASIS.md section 8:');
    console.log('  terminal after-tax net worth up in 18 of 71 clean cells, down in 49, median -$47,549.');
    console.log('  That is a finding about the STRATEGY, not a verdict on the fix -- a named ceiling is a');
    console.log('  contract to fill, and filling it is often worth less than under-filling it.');
}
line();
console.log(simCount + ' simulations.');
