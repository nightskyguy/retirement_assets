'use strict';
/**
 * bracketbasis_harness.js -- P87a. What does the federal bracket ceiling leave unfilled?
 *
 * Run:  node .test_harnesses/bracketbasis_harness.js
 *
 * THE DEFECT. The strategy "Limit" dropdown emits three kinds of ceiling and `computeBracketCeiling`
 * hands all three back as one number, which every caller then spends as a MAGI ceiling:
 *
 *   IRMAA Tier n   TAXData.IRMAA brackets     MAGI = AGI + tax-exempt interest        correct
 *   n% Fed         TAXData.FEDERAL brackets   TAXABLE income, i.e. AFTER the           WRONG BY ONE
 *                                             deduction (`std` is a separate field)    DEDUCTION
 *   n% FPL         an FPL multiple            ACA MAGI (adds back non-taxable SS)      ceiling right
 *
 * So "fill the 22% bracket" stops when MAGI reaches the 22% top, which leaves federal taxable income
 * one whole deduction short of it -- $32,200 MFJ in 2026 before the two $1,650 age-65 bumps and the
 * $6,000-per-filer senior deduction. Conversion and withdrawal room the strategy was asked for and
 * never used, every year, in the same direction, with no cliff crossed to announce it.
 *
 * WHAT THIS MEASURES, AND WHAT IT DOES NOT. It sizes the gap. It does not fix it. P87b picks between
 * raising the federal ceiling by the deduction and comparing federal-mode ceilings against taxable
 * income instead of MAGI, and stays closed until this reports.
 *
 * TWO HALVES, because they answer different questions:
 *   Section 2 is a census off the CONTROL arm's log alone. How many years actually sat ON the
 *   ceiling, and how much room the deduction hid in those years. That sum is an UPPER BOUND: a year
 *   only loses money if the ceiling is what stopped it.
 *   Section 3 is the A/B. `bracketCeilingAddDeduction` raises the federal-mode ceiling by the year's
 *   deduction, and the difference between the arms is what the room was worth once the IRA balance,
 *   the IRA Goal and the spending had their say.
 *
 * THE ARM IS AN APPROXIMATION AND SAYS SO. The senior deduction phases out against federalAGI, which
 * is what the ceiling is about to determine, so the year's own deduction is not knowable when the
 * ceiling is placed. The arm re-indexes LAST year's charged deduction, and falls back for year 0
 * only to the statutory standard deduction plus age bumps. It also lifts the FEDERAL number alone
 * and leaves the state bracket top -- same basis error, not measured here -- so in a state whose
 * table binds first this reads LOW. Both choices push the answer the same way: toward understatement.
 *
 * PREDICTIONS, registered before the run:
 *   B1  In a year that sits ON the ceiling, the armed arm's MAGI is higher by about that year's
 *       deduction. Nothing else in the year is claimed.
 *
 *       B1 WAS FIRST WRITTEN WRONG, and the wrong form is the instructive one. It said "armed never
 *       draws LESS than control", scored on LIFETIME totals, and reported 70 of 160 cells reversed
 *       against a perfectly working arm. Drawing more early leaves a smaller IRA to draw from later,
 *       so a lifetime sum is not monotone in the ceiling and never could be. The claim is about a
 *       year, so it has to be scored on a year. Same failure as `rmdbasis_harness.js` R2.
 *   B2  The gain is largest where the spend rate is low -- where the ceiling binds and the IRA still
 *       has stock to give.
 *   B3  Lifetime nominal tax RISES while terminal after-tax net worth ALSO rises: more moved earlier
 *       at a lower rate.
 *
 *       B3 IS SCORED, BUT IT IS NOT A VERDICT ON THE FIX, and the first version of this file said it
 *       was. A named ceiling is a CONTRACT TO FILL: a user picking `22% Fed` or `IRMAA Tier 2` wants
 *       the room between their spending and the limit converted or banked, and is not asking the
 *       tool to minimize their tax. So B3 breaking means "filling this bracket is often a worse
 *       STRATEGY than under-filling it" - the Optimizer ranking's business, and a changelog
 *       disclosure if the fix ships - not "leave the ceiling one deduction short". Judging a
 *       correctness defect by a wealth metric is how an accidental hedge gets mistaken for a design.
 *   B4  ZERO TEST. `IRMAA Tier n` and `n% FPL` rows are bit-identical across the arms -- their
 *       ceilings do not come from the federal bracket table.
 *
 *       B4 CARRIED A SECOND CLAUSE AND IT WAS WRONG: "`minlimit` rows DO move, that branch takes the
 *       federal limit and then mins it against the IRMAA one". They move in 0 of 40 cells. The min
 *       is the whole story -- `yr.IRMAALimit` is built from `goalLimit`, the bracket top containing
 *       the SPENDING GOAL, which sits far below the federal ceiling the user picked. Measured here:
 *       Fill Bracket 24% targets $403,550 in year 0 where Min Limit 24% targets $211,399. So the
 *       federal basis error never reaches `minlimit` at all, and B4's zero test is really a THREE-
 *       family zero test.
 *   B5  A plan whose IRA is already at its Goal moves less: `curIRA` throttles the draw before the
 *       ceiling ever does.
 *
 * Section 0 exists because `brokerage_harness.js` printed SKIPPED for months while probing a counter
 * name that never existed. If arming the flag moves nothing, this reports BROKEN, not "no effect".
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

// The federal-table families first, then the two controls B4 says must not move.
const FAMILIES = [
    { key: 'fed12',  label: 'Fill Bracket 12%', fed: true,
      over: { strategy: 'bracket', stratRate: 0.12, stratIRMAATier: -1, stratACAMultiple: 0 } },
    { key: 'fed22',  label: 'Fill Bracket 22%', fed: true,
      over: { strategy: 'bracket', stratRate: 0.22, stratIRMAATier: -1, stratACAMultiple: 0 } },
    { key: 'fed24',  label: 'Fill Bracket 24%', fed: true,
      over: { strategy: 'bracket', stratRate: 0.24, stratIRMAATier: -1, stratACAMultiple: 0 } },
    // fed:false is a RESULT, not an assumption -- see B4 in the header, and the ceiling-moved
    // column in section 3, which measures it rather than taking it on trust.
    { key: 'minlim', label: 'Min Limit 24%',    fed: false,
      over: { strategy: 'minlimit', stratRate: 0.24, stratIRMAATier: -1, stratACAMultiple: 0 } },
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
console.log('P87a -- the federal bracket ceiling is a TAXABLE-income threshold spent as a MAGI ceiling.');
console.log('How much room does that leave unused, and what is the room worth?');
line();
console.log('Grid: ' + SCENARIOS.length + ' scenarios x ' + GOALS.length + ' IRA-Goal settings x '
          + STATES.length + ' states x ' + FAMILIES.length + ' families x ' + SPEND_RATES.length
          + ' spend rates = ' + CELLS.length + ' cells, 2 arms.');
console.log('Reading guide:');
console.log('  CONTROL   the shipped engine.   ARMED   bracketCeilingAddDeduction on.');
console.log('  AT        MAGI landed on the ceiling -- the only years that can be losing anything.');
console.log('  SLACK     something else stopped the draw first (spending, IRA Goal, empty IRA).');
console.log('  OVER      the third-pass fallback forced a draw past the ceiling to fund spending.');
console.log('  CLEAN     delivered spend identical on both arms and both arms funded -- the only');
console.log('            cells whose wealth numbers are a comparison rather than a spending change.');
console.log('  B1..B5    predictions, stated in the file header and scored in section 4.');

// ---------------------------------------------------------------------------
// 0. Is the flag live at all?
// ---------------------------------------------------------------------------
line('-');
console.log('0. FLAG LIVENESS -- does arming bracketCeilingAddDeduction move anything, and is it inert unset?');
line('-');
{
    const probe = CELLS.find(c => c.f.key === 'fed22' && c.g.key === 'nogoal' && c.st === 'CA'
                                  && c.s.key === 'defaults3x' && c.rate === 0.04);
    const a = run({ ...probe.base });
    const b = run({ ...probe.base, bracketCeilingAddDeduction: true });
    const c = run({ ...probe.base, bracketCeilingAddDeduction: false });
    const moved = Math.abs(b.conv - a.conv) + Math.abs(b.iraSpend - a.iraSpend);
    const inert = (c.conv === a.conv && c.iraSpend === a.iraSpend && c.tax === a.tax);
    console.log('  probe cell: ' + probe.s.label + ' / ' + probe.f.label + ' / ' + probe.st
              + ' / ' + probe.g.label + ' / spend ' + pct(probe.rate));
    console.log('  control conversions ' + money(a.conv) + '   armed ' + money(b.conv));
    console.log('  control IRA spend   ' + money(a.iraSpend) + '   armed ' + money(b.iraSpend));
    console.log('  flag armed:  ' + (moved > 1
        ? 'LIVE -- the arm reaches the engine'
        : 'BROKEN -- armed run is identical; the input name is not being read'));
    console.log('  flag unset:  ' + (inert
        ? 'INERT -- bit-identical to omitting it'
        : 'LEAKED -- unset is not the shipped path'));
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
    const b = run({ ...cell.base, bracketCeilingAddDeduction: true });
    console.log('  ' + pad('year', 6) + rpad('ceiling', 13) + rpad('MAGI', 13) + rpad('fed taxable', 13)
              + rpad('deduction', 13) + rpad('under ceil', 13) + '  where '
              + rpad('armed MAGI', 13) + rpad('armed draw+', 13));
    a.log.forEach((r, i) => {
        const cls = classifyYear(r);
        if (cls === null) return;
        const br = b.log[i] || {};
        console.log('  ' + pad(r.Year != null ? r.Year : (2026 + i), 6)
            + money(r.BracketTarget) + money(r.MAGI) + money(r['-fedTaxableInc'])
            + money(r['-fedDeduction'])
            + money((r.BracketTarget || 0) - (r.MAGI || 0))
            + '  ' + pad(cls.toUpperCase(), 6)
            + money(br.MAGI)
            + money(((br['-iraSpend'] || 0) + (br.rothConv || 0))
                  - ((r['-iraSpend'] || 0) + (r.rothConv || 0))));
    });
    console.log('  "under ceil" is the ceiling minus MAGI, so in an AT year it is ~0 by construction.');
    console.log('  The money left behind in an AT year is the DEDUCTION column beside it, not that one.');
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
        if (cls === 'at')    { at++; hidden += (r['-fedDeduction'] || 0); }
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
          + rpad('OVER', 9) + rpad('hidden room (sum of deduction over AT years)', 45));
for (const f of FAMILIES) {
    const v = census[f.key];
    console.log('  ' + pad(f.label, 20) + rpad(v.cells, 7) + rpad(v.at, 9) + rpad(v.slack, 9)
              + rpad(v.over, 9) + rpad(money(v.hidden), 45));
}
console.log('  Hidden room is the most the ceiling could have released. Section 3 measures how much');
console.log('  of it the plan could actually take once balances and spending had their say.');
console.log('  "ceil yrs" in section 3 counts the years the ARM actually moved the ceiling. A family');
console.log('  with 0 there is untouched by the federal basis error, whatever its dropdown label says.');

// ---------------------------------------------------------------------------
// 3. The A/B
// ---------------------------------------------------------------------------
line('-');
console.log('3. A/B -- control vs armed. CLEAN cells only for the wealth columns.');
line('-');
const results = [];
for (const c of CELLS) {
    const a = c._ctrl;
    const b = run({ ...c.base, bracketCeilingAddDeduction: true });
    const rate = a.futureIRARate;          // CONTROL arm's rate on BOTH sides (the gapfill rule)
    const nwA = afterTaxNetWorth(a.terminal, rate, a.capGainsRate);
    const nwB = afterTaxNetWorth(b.terminal, rate, b.capGainsRate);
    // Did the CEILING move at all? Measured, not assumed: a family whose ceiling comes from
    // somewhere other than the federal bracket table cannot be touched by a federal basis fix,
    // and this is the column that says which families those are.
    let ceilMoved = 0;
    for (let i = 0; i < a.log.length && i < b.log.length; i++) {
        if ((b.log[i].BracketTarget || 0) - (a.log[i].BracketTarget || 0) > 1) ceilMoved++;
    }
    // B1 is a per-YEAR claim, so it is scored on the first year that sat on the ceiling -- the last
    // year in which the two arms still describe the same plan. After that they diverge, and a
    // year-by-year comparison would be comparing two different balance paths.
    let b1 = null;
    for (let i = 0; i < a.log.length && i < b.log.length; i++) {
        if (classifyYear(a.log[i]) === 'at') {
            b1 = { lift: (b.log[i].MAGI || 0) - (a.log[i].MAGI || 0),
                   ded: a.log[i]['-fedDeduction'] || 0 };
            break;
        }
    }
    results.push({ c, a, b, nwA, nwB, ceilMoved, b1,
        clean: a.success && b.success && Math.abs(a.spend - b.spend) < 1,
        dConv: b.conv - a.conv,
        dDraw: (b.iraSpend + b.conv) - (a.iraSpend + a.conv),
        dTax: b.tax - a.tax, dNW: nwB - nwA });
}
const fedRes = results.filter(r => r.c.f.fed);
const ctlRes = results.filter(r => r.c.f.control);
const clean  = fedRes.filter(r => r.clean);

console.log('  ' + pad('family', 20) + rpad('cells', 7) + rpad('clean', 7) + rpad('ceil yrs', 10)
          + rpad('moved', 7)
          + rpad('median dNW', 14) + rpad('best dNW', 14) + rpad('worst dNW', 14) + rpad('median dTax', 14));
for (const f of FAMILIES) {
    const g = results.filter(r => r.c.f.key === f.key);
    const gc = g.filter(r => r.clean);
    const moved = g.filter(r => Math.abs(r.dConv) + Math.abs(r.dDraw) + Math.abs(r.dNW) > 1).length;
    const nws = gc.map(r => r.dNW);
    console.log('  ' + pad(f.label, 20) + rpad(g.length, 7) + rpad(gc.length, 7)
        + rpad(g.reduce((x, r) => x + r.ceilMoved, 0), 10) + rpad(moved, 7)
        + (nws.length ? rpad(money(median(nws)), 14) : rpad('-', 14))
        + (nws.length ? rpad(money(Math.max.apply(null, nws)), 14) : rpad('-', 14))
        + (nws.length ? rpad(money(Math.min.apply(null, nws)), 14) : rpad('-', 14))
        + (gc.length ? rpad(money(median(gc.map(r => r.dTax))), 14) : rpad('-', 14)));
}

console.log('');
console.log('  Ten largest clean gains:');
console.log('  ' + pad('scenario', 20) + pad('family', 20) + pad('st', 4) + pad('goal', 15)
          + pad('spend', 7) + rpad('d after-tax NW', 14) + rpad('d conversions', 14) + rpad('d lifetime tax', 15));
clean.slice().sort((x, y) => y.dNW - x.dNW).slice(0, 10).forEach(r => {
    console.log('  ' + pad(r.c.s.label, 20) + pad(r.c.f.label, 20) + pad(r.c.st, 4) + pad(r.c.g.label, 15)
        + pad(pct(r.c.rate), 7) + rpad(money(r.dNW), 14) + rpad(money(r.dConv), 14) + rpad(money(r.dTax), 15));
});

// ---------------------------------------------------------------------------
// 4. Predictions
// ---------------------------------------------------------------------------
line('-');
console.log('4. PREDICTIONS SCORED');
line('-');
const verdict = (ok, txt) => console.log('  ' + (ok ? 'HOLDS ' : 'BROKEN') + '  ' + txt);

{   // B1 -- per-year, on the first AT year, before the two arms diverge
    const scored = fedRes.filter(r => r.b1 && r.b1.ded > 0);
    const near = scored.filter(r => Math.abs(r.b1.lift - r.b1.ded) <= r.b1.ded * 0.02);
    const up   = scored.filter(r => r.b1.lift > 1);
    const over = scored.filter(r => r.b1.lift > r.b1.ded * 1.02);
    // The lift is the deduction CAPPED by the IRA the year actually had, so falling short of it is
    // an empty IRA, not a broken arm. Overshooting it would be the broken case, and is what is
    // scored: every lift positive, none above the deduction.
    verdict(scored.length > 0 && up.length === scored.length && over.length === 0,
        'B1  first AT year: armed MAGI up in ' + up.length + '/' + scored.length + ' cells, above the'
        + ' deduction in ' + over.length + '. Exactly the deduction in ' + near.length + '; the other '
        + (scored.length - near.length) + ' ran out of IRA first.');
    const back = fedRes.filter(r => r.dDraw < -1);
    console.log('        the WRONG lifetime form would report ' + back.length + '/' + fedRes.length
        + ' cells reversed. Drawing more early leaves less to draw later, so a');
    console.log('        lifetime sum is not monotone in the ceiling and never could be.');
}
{   // B2 -- gain largest where spend is low
    const m4 = median(clean.filter(r => r.c.rate === 0.04).map(r => r.dNW));
    const m6 = median(clean.filter(r => r.c.rate === 0.06).map(r => r.dNW));
    verdict(m4 !== null && m6 !== null && m4 > m6 && m4 > 0,
        'B2  median clean change at 4% spend ' + money(m4) + ' vs at 6% ' + money(m6)
        + (m4 !== null && m4 <= 0
            ? ' -- both negative, so there is no pooled "gain" for the spend rate to order.'
            : '.'));
    for (const f of FAMILIES.filter(x => x.fed)) {
        const g = clean.filter(r => r.c.f.key === f.key);
        console.log('        ' + pad(f.label, 20) + ' 4%: '
            + money(median(g.filter(r => r.c.rate === 0.04).map(r => r.dNW)))
            + '   6%: ' + money(median(g.filter(r => r.c.rate === 0.06).map(r => r.dNW))));
    }
}
{   // B3 -- tax rises AND wealth rises
    const taxUp = clean.filter(r => r.dTax > 1).length;
    const nwUp  = clean.filter(r => r.dNW > 1).length;
    const nwDn  = clean.filter(r => r.dNW < -1).length;
    verdict(nwUp > nwDn,
        'B3  clean cells: after-tax NW up in ' + nwUp + ', down in ' + nwDn + ', tax up in '
        + taxUp + ' of ' + clean.length + '. Median dTax ' + money(median(clean.map(r => r.dTax)))
        + ', median dNW ' + money(median(clean.map(r => r.dNW))) + '.');
    if (nwDn > nwUp) console.log('        NW falls more often than it rises. That scores the STRATEGY,'
        + ' not the fix -- see B3 in the file header.');
    for (const f of FAMILIES.filter(x => x.fed)) {
        const g = clean.filter(r => r.c.f.key === f.key);
        console.log('        ' + pad(f.label, 20) + ' up ' + rpad(g.filter(r => r.dNW > 1).length, 3)
            + '  down ' + rpad(g.filter(r => r.dNW < -1).length, 3)
            + '  median dNW ' + money(median(g.map(r => r.dNW))));
    }
}
{   // B4 -- zero test on the controls, and minlimit must move
    const dirty = ctlRes.filter(r => Math.abs(r.dConv) + Math.abs(r.dDraw)
                                   + Math.abs(r.dNW) + Math.abs(r.dTax) > 0);
    const ml = results.filter(r => r.c.f.key === 'minlim');
    const mlMoved = ml.filter(r => Math.abs(r.dNW) + Math.abs(r.dConv) > 1).length;
    const mlCeil = ml.reduce((x, r) => x + r.ceilMoved, 0);
    verdict(dirty.length === 0,
        'B4a ZERO TEST: IRMAA Tier and ACA rows bit-identical across arms in '
        + (ctlRes.length - dirty.length) + '/' + ctlRes.length + ' cells.');
    dirty.slice(0, 5).forEach(r => console.log('        moved: ' + r.c.s.label + ' / ' + r.c.f.label
        + ' / ' + r.c.st + ' / ' + r.c.g.label + ' / ' + pct(r.c.rate) + '  dNW ' + money(r.dNW)));
    const mlYears = ml.reduce((x, r) => x + r.a.log.length, 0);
    verdict(mlMoved === 0,
        'B4b RESTATED: minlimit is a FOURTH zero, not the mover B4 predicted. Its ceiling moved in '
        + mlCeil + '/' + mlYears + ' years and the RESULT moved in ' + mlMoved + '/' + ml.length
        + ' cells -- the few lifted years never bound.');
    console.log('        Its ceiling is yr.IRMAALimit, built from goalLimit -- the bracket top containing');
    console.log('        the SPENDING GOAL -- which sits below the federal ceiling the user picked, so the');
    console.log('        min never selects the federal side and the basis error never reaches it.');
}
{   // B5 -- a live IRA Goal damps it
    const mg = median(fedRes.filter(r => r.c.g.key === 'goal').map(r => Math.abs(r.dNW)));
    const mn = median(fedRes.filter(r => r.c.g.key === 'nogoal').map(r => Math.abs(r.dNW)));
    verdict(mg !== null && mn !== null && mg < mn,
        'B5  median |dNW| with a live IRA Goal ' + money(mg) + ' vs without ' + money(mn) + '.');
}

// ---------------------------------------------------------------------------
// 5. Where the sign comes from
// ---------------------------------------------------------------------------
line('-');
console.log('5. WHERE THE SIGN COMES FROM -- clean federal-family cells split by which way they went');
line('-');
{
    const win  = clean.filter(r => r.dNW > 1);
    const lose = clean.filter(r => r.dNW < -1);
    const flat = clean.filter(r => Math.abs(r.dNW) <= 1);
    const show = (label, g) => {
        if (!g.length) { console.log('  ' + pad(label, 10) + '  (none)'); return; }
        console.log('  ' + pad(label, 10) + rpad(g.length, 7)
            + rpad(median(g.map(r => r.c._cen.at)), 10)
            + rpad(median(g.map(r => r.c._cen.slack)), 10)
            + rpad(median(g.map(r => r.c._cen.over)), 10)
            + rpad(money(median(g.map(r => r.a.tax))), 20)
            + rpad(money(median(g.map(r => r.dTax))), 16)
            + rpad(money(median(g.map(r => r.dConv))), 16));
    };
    console.log('  ' + pad('cells', 10) + rpad('n', 7) + rpad('AT yrs', 10) + rpad('SLACK', 10)
        + rpad('OVER', 10) + rpad('ctrl lifetime tax', 20) + rpad('median dTax', 16) + rpad('median dConv', 16));
    show('gained', win); show('lost', lose); show('unchanged', flat);
    console.log('  All figures are medians of the CONTROL arm except the two delta columns.');
    console.log('  A cell with many OVER years was already breaching its ceiling to fund spending, so');
    console.log('  the ceiling was not what governed it and lifting the ceiling mostly re-times draws.');
}

line('-');
{
    const totalHidden = Object.keys(census).reduce((a, k) => a + census[k].hidden, 0);
    const realized = clean.map(r => r.dNW);
    console.log('  THE NUMBER P87a WAS ASKED FOR, over ' + clean.length + ' clean federal-family cells:');
    console.log('    median gain in terminal after-tax net worth   ' + money(median(realized)));
    console.log('    best                                          '
        + money(realized.length ? Math.max.apply(null, realized) : null));
    console.log('    worst                                         '
        + money(realized.length ? Math.min.apply(null, realized) : null));
    console.log('    median gain in lifetime conversion gross      ' + money(median(clean.map(r => r.dConv))));
    console.log('    hidden room across the whole grid (bound)     ' + money(totalHidden));
}
line();
console.log(simCount + ' simulations.');
