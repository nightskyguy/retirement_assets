/**
 * ceilded_harness.js -- P92a. WHICH deduction can the bracket ceiling actually use?
 *
 *   node .test_harnesses/ceilded_harness.js
 *
 * P92a says the federal-mode ceiling must be raised by "the year's deduction", read from the SAME
 * place calculateTaxes() charges it. The obstacle is a circularity, recorded in
 * research/BRACKET_CEILING_BASIS.md section 6: the OBBBA senior deduction phases out against
 * federal AGI, and SALT itemizing is decided against AGI too, but AGI is the quantity the ceiling
 * is about to determine. This year's deduction does not exist when the ceiling is placed.
 *
 * So the question is not "use the right one" but "how wrong is each obtainable one". Two candidates,
 * both of which read a number calculateTaxes() actually charged rather than re-deriving it:
 *
 *   PRIOR   last year's charged deduction, re-indexed by this year's CPI factor over that year's.
 *           What the P87a research arm used. Undefined in year 0.
 *   STAT    the statutory standard deduction plus age bumps, indexed. NOT a charged number - it is
 *           a second derivation of the deduction, which is the thing P92a says to avoid. Measured
 *           anyway because it is what the research arm falls back to in year 0, so its error is the
 *           error of the only year every plan has.
 *
 * Scored against CHARGED, `-fedDeduction` off the log, which is the full deduction calculateTaxes()
 * charged that year: standard or itemized, plus age bumps, plus the senior deduction after phase-out.
 *
 * The grid is copied from bracketbasis_harness.js so the reading is on the same plans P87a measured.
 * Only the four federal-bracket families are run: the ceiling this affects is the federal one, and
 * IRMAA/ACA rows were measured to be untouched by it (P87a section 3, 0 of 80 cells).
 *
 * PREDICTIONS, registered before the run:
 *   D1  PRIOR is within $500 of CHARGED in the median year. The deduction is dominated by the
 *       standard deduction, which is a pure CPI index with no AGI term.
 *   D2  PRIOR's worst errors cluster on filing-status changes, where the table halves between the
 *       year that produced the number and the year using it.
 *   D3  STAT is materially worse than PRIOR wherever the senior deduction is live (through the 2028
 *       sunset), because STAT omits it entirely.
 *   D4  The residual error of either candidate is small against the quantity being corrected: the
 *       deduction itself, tens of thousands of dollars. A ceiling raised by an approximate deduction
 *       is far closer to the bracket top than one not raised at all.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
Object.assign(globalThis, require('../taxengine.js'));
const core = require('../optimizer_core.js');
require('../displayhelpers.js');
const { simulate } = core;

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

const FAMILIES = [
    { key: 'fed12', label: 'Fill Bracket 12%', over: { strategy: 'bracket', stratRate: 0.12, stratIRMAATier: -1, stratACAMultiple: 0 } },
    { key: 'fed22', label: 'Fill Bracket 22%', over: { strategy: 'bracket', stratRate: 0.22, stratIRMAATier: -1, stratACAMultiple: 0 } },
    { key: 'fed24', label: 'Fill Bracket 24%', over: { strategy: 'bracket', stratRate: 0.24, stratIRMAATier: -1, stratACAMultiple: 0 } },
];

const GOALS  = [0, 750000];
const STATES = ['CA', 'TX'];
const SPEND_RATES = [0.04, 0.06];

const totalOf = (o) => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;
const money = n => (n == null || Number.isNaN(n)) ? '     -    '
    : (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString().padStart(9);
const pct = (a, b) => b === 0 ? '   -  ' : (100 * a / b).toFixed(1).padStart(5) + '%';

function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
const stats = arr => {
    const s = [...arr].sort((a, b) => a - b);
    return { n: s.length, p50: quantile(s, 0.5), p90: quantile(s, 0.9), max: s[s.length - 1] ?? NaN };
};

// ── Run the grid, collecting one row per YEAR ───────────────────────────────────────────────────
const rows = [];       // { fam, y, charged, prior, stat, statusChange }
let cells = 0;

for (const sc of SCENARIOS)
for (const fam of FAMILIES)
for (const goal of GOALS)
for (const st of STATES)
for (const sr of SPEND_RATES) {
    const inputs = { ...COMMON, ...sc.over, ...fam.over, STATEname: st,
                     iraBaseGoal: goal, spendGoal: Math.round(totalOf(sc.over) * sr) };
    const { log } = simulate(inputs);
    cells++;
    for (let y = 0; y < log.length; y++) {
        const charged = log[y]['-fedDeduction'];
        if (!(charged > 0)) continue;
        const cpi = log[y]['-cpiFactor'];
        const prev = y > 0 ? log[y - 1] : null;
        const prior = prev && prev['-fedDeduction'] > 0
            ? prev['-fedDeduction'] * (cpi / (prev['-cpiFactor'] || cpi))
            : null;
        // STAT: the statutory standard deduction plus age bumps, exactly as the research arm's
        // year-0 fallback builds it. No senior deduction, no itemizing.
        const status = log[y].status;
        const fed = TAXData.FEDERAL[status];
        const nSen = (log[y].age1 >= fed.age ? 1 : 0)
                   + (status === 'MFJ' && (log[y].age2 || 0) >= fed.age ? 1 : 0);
        const stat = (fed.std + fed.stdbump * nSen) * cpi;
        // DIRECT is no longer reconstructed here. `-ceilDedAddBack` is the number the shipped
        // ceiling actually used, logged beside the one that was charged, so this column measures
        // what ships rather than a harness's imitation of it.
        const dCalc = { federalStdDeduction: log[y]['-ceilDedAddBack'], useItemized: false };
        rows.push({ fam: fam.key, y, charged, prior, stat, direct: dCalc.federalStdDeduction,
                    itemized: !!dCalc.useItemized,
                    statusChange: !!(prev && prev.status !== status) });
    }
}

console.log(`\n# P92a: how wrong is an obtainable deduction?\n`);
console.log(`${cells} cells, ${rows.length} plan-years, ${FAMILIES.length} federal-bracket families.\n`);

// ── 1. Absolute error of each candidate ────────────────────────────────────────────────────────
console.log('## 1. Error against the deduction actually charged\n');
console.log('| candidate | yrs | median err | p90 err | worst err | median charged | worst as % of charged |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (const [name, pick] of [['PRIOR', r => r.prior], ['STAT', r => r.stat], ['DIRECT', r => r.direct]]) {
    const use = rows.filter(r => pick(r) != null);
    const errs = use.map(r => Math.abs(pick(r) - r.charged));
    const s = stats(errs);
    const chg = stats(use.map(r => r.charged));
    const worstRow = use[errs.indexOf(Math.max(...errs))];
    console.log(`| ${name} | ${s.n} | ${money(s.p50)} | ${money(s.p90)} | ${money(s.max)} | `
              + `${money(chg.p50)} | ${pct(s.max, worstRow ? worstRow.charged : 0)} |`);
}

// ── 2. Year 0 alone: the year PRIOR cannot serve ───────────────────────────────────────────────
console.log('\n## 2. Year 0, where PRIOR does not exist\n');
const y0 = rows.filter(r => r.y === 0);
const y0err = y0.map(r => Math.abs(r.direct - r.charged));
const s0 = stats(y0err), c0 = stats(y0.map(r => r.charged));
console.log(`DIRECT error in year 0: median ${money(s0.p50).trim()}, worst ${money(s0.max).trim()}, `
          + `against a median charged deduction of ${money(c0.p50).trim()} `
          + `(${pct(s0.p50, c0.p50).trim()} of it).`);

// ── 3. Where PRIOR goes wrong ──────────────────────────────────────────────────────────────────
console.log('\n## 3. Where PRIOR goes wrong\n');
const withPrior = rows.filter(r => r.prior != null);
const chg = withPrior.filter(r => r.statusChange);
const same = withPrior.filter(r => !r.statusChange);
console.log('| year kind | yrs | PRIOR median | PRIOR worst | DIRECT median | DIRECT worst |');
console.log('|---|---:|---:|---:|---:|---:|');
for (const [name, set] of [['filing status changed', chg], ['status unchanged', same]]) {
    const s = stats(set.map(r => Math.abs(r.prior - r.charged)));
    const d = stats(set.map(r => Math.abs(r.direct - r.charged)));
    console.log(`| ${name} | ${s.n} | ${money(s.p50)} | ${money(s.max)} | ${money(d.p50)} | ${money(d.max)} |`);
}
console.log(`
SALT itemizing fired in ${rows.filter(r => r.itemized).length} of ${rows.length} plan-years at the provisional income.`);

// ── 4. Senior-deduction era vs after the sunset ────────────────────────────────────────────────
console.log('\n## 4. Before and after the OBBBA senior-deduction sunset\n');
const sunsetIdx = TAXData.OBBBA.SENIOR_DED.sunsetYear - COMMON.startInYear;
console.log('| era | yrs | PRIOR median err | STAT median err | DIRECT median err |');
console.log('|---|---:|---:|---:|---:|');
for (const [name, f] of [[`through ${TAXData.OBBBA.SENIOR_DED.sunsetYear}`, r => r.y <= sunsetIdx],
                         ['after the sunset', r => r.y > sunsetIdx]]) {
    const set = rows.filter(f);
    const p = stats(set.filter(r => r.prior != null).map(r => Math.abs(r.prior - r.charged)));
    const t = stats(set.map(r => Math.abs(r.stat - r.charged)));
    const d = stats(set.map(r => Math.abs(r.direct - r.charged)));
    console.log(`| ${name} | ${set.length} | ${money(p.p50)} | ${money(t.p50)} | ${money(d.p50)} |`);
}

// ── 5. The predictions ─────────────────────────────────────────────────────────────────────────
console.log('\n## 5. Predictions\n');
const priorErrs = stats(withPrior.map(r => Math.abs(r.prior - r.charged)));
const statErrs  = stats(rows.map(r => Math.abs(r.stat - r.charged)));
const chgS = stats(chg.map(r => Math.abs(r.prior - r.charged)));
const sameS = stats(same.map(r => Math.abs(r.prior - r.charged)));
const preSunset = rows.filter(r => r.y <= sunsetIdx);
const preP = stats(preSunset.filter(r => r.prior != null).map(r => Math.abs(r.prior - r.charged)));
const preT = stats(preSunset.map(r => Math.abs(r.stat - r.charged)));
const medCharged = stats(rows.map(r => r.charged)).p50;
const dirErrs = stats(rows.map(r => Math.abs(r.direct - r.charged)));
const verdict = (id, claim, ok, detail) =>
    console.log(`${ok ? 'HOLDS ' : 'BROKEN'}  ${id}  ${claim}\n          ${detail}`);
verdict('D1', 'PRIOR within $500 of CHARGED in the median year',
    priorErrs.p50 < 500, `median error ${money(priorErrs.p50).trim()}`);
verdict('D2', "PRIOR's worst errors cluster on filing-status changes",
    chgS.p50 > sameS.p50 * 2, `status-change median ${money(chgS.p50).trim()} vs unchanged ${money(sameS.p50).trim()}`);
verdict('D3', 'STAT materially worse than PRIOR while the senior deduction is live',
    preT.p50 > preP.p50 * 2, `pre-sunset STAT ${money(preT.p50).trim()} vs PRIOR ${money(preP.p50).trim()}`);
verdict('D4', 'the residual is small against the deduction being added back',
    priorErrs.p50 < medCharged * 0.02, `median error ${money(priorErrs.p50).trim()} against a median deduction of ${money(medCharged).trim()}`);
console.log(`\n(STAT overall: median ${money(statErrs.p50).trim()}, worst ${money(statErrs.max).trim()}.)\n`);
