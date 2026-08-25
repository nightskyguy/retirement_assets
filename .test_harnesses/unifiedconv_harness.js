'use strict';
/**
 * unifiedconv_harness.js -- P28. Does modeling every voluntary IRA withdrawal as a Roth conversion
 * change anything, and where does drawing Roth earlier actually pay?
 *
 * Run:  node .test_harnesses/unifiedconv_harness.js
 *
 * SETTLED 2026-08-24 (P28f). `unifiedConvRouting` was DELETED from the engine once measured -- it
 * moved 0 money fields in 90 cells, and the two-leg view it existed for is already in every log row
 * as `-iraSpend` and `-iraConvGrossTot`. Its arm (A1) is gone from this harness with it, because an
 * arm setting a flag nothing reads would report as the control and look like a finding. The numbers
 * it produced are kept in P28_RESULTS.md. `rothGapFill` SHIPPED, as the "Roth in shortfall
 * withdrawals" control and the Optimizer's 🅡 rows.
 *
 * THE PROPOSAL, AS TWO SEPARABLE ENGINE FLAGS (both default off, no UI sets either)
 *   inputs.unifiedConvRouting -- REMOVED, see above. The voluntary draw was CALLED a conversion and
 *                                spending round-tripped through Roth. Provably a relabel; round 1.
 *   inputs.rothGapFill        -- where Roth sits in the gap fill:
 *                                  'fillRothThenCash' : Roth ahead of everything
 *                                  'fillCashThenRoth' : Cash, then Roth, then Brokerage
 *                                (unset) is today's behavior: Roth last.
 *                                `ordered` is excluded from both, by instruction.
 *
 * ROUND 1 (2026-07-30) ESTABLISHED
 *   - Routing alone moves 0 money fields in every family. It is arithmetic: draw X, pay tax T, fund
 *     spending S -- today Roth gains X-T-S; routed, it gains X-T then returns S, the same number.
 *   - `rothConv` is engine state, not a display field (beginYear reads log[y-1].rothConv > 1000 to
 *     pick withdrawal TIMING). Reporting the reframe through it moved 780 money fields.
 *   - Roth-first is the half that can move money, and its sign was inconsistent: Fill Bracket 24%
 *     +$269k, IRA Draw 6% -$137k, Proportional untouched.
 *
 * ROUND 2 (this version) TESTS THE MECHANISM THAT EXPLAINS THE SIGN
 * Roth and Cash are both tax-free to withdraw, so swapping one for the other looks free and is not:
 * Roth compounds at the growth rate tax-free, Cash earns cashYield and pays tax on the interest. So
 *     displacing a BROKERAGE draw with Roth  -> avoids realizing capital gains       -> gain
 *     displacing a CASH draw with Roth       -> spends the best asset to keep the worst -> loss
 * IRA Draw 6% lost precisely because its gap fill only ever touched Cash ($60,541 lifetime, $0
 * Brokerage): Roth-first swapped that for $58,000 of Roth and cost $137,062 of terminal value.
 *
 * PREDICTION UNDER TEST: 'fillCashThenRoth' dominates 'fillRothThenCash' everywhere, because it keeps the Brokerage
 * displacement and drops the Cash displacement. And the size of the win should track how much
 * BROKERAGE the plan holds relative to everything else -- which is why this runs a scenario ladder
 * from the shipped defaults (Brokerage-poor) to balanced thirds (Brokerage-rich).
 */

// ── Bootstrap the engine exactly like betr_harness.js / optimizer_core.tests.js ───────────────
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
require('../displayhelpers.js');
const { simulate, afterTaxNetWorth, baselineScoreOf } = core;

// ── Scenario ladder ─────────────────────────────────────────────────────────────────────────
// Everything except the account mix is held fixed, so a column-to-column change is attributable to
// the mix. Spend is scaled with the portfolio so each scenario is under comparable strain.
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

// Spend is a CONTROLLED AXIS, not a per-scenario constant. Round 2 set it by hand and accidentally
// confounded mix with strain: the two default scenarios sat at 8.6% of assets while the other three
// sat near 4.4%, so "the defaults show small effects" could have been a strain artifact rather than
// a mix artifact. Every scenario now runs at each rate, so the two axes are separable.
// NOTE these are percentages of TOTAL ASSETS, not portfolio withdrawal rates: Social Security is
// $69k combined here, so at the low end SS covers most of the spend and the portfolio is barely
// touched -- which is itself the point, since these mechanisms only act on a spending gap.
const SPEND_RATES = [0.04, 0.06, 0.08];
const totalAssets = (o) => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;

const SCENARIOS = [
    {   // Exactly what ships in retirement_optimizer.html. Brokerage is 6% of the portfolio.
        key: 'defaults', label: 'shipped defaults (IRA-heavy)',
        over: { IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000,
                Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000 },
    },
    {   // The same MIX at 3x the size: isolates bracket/scale effects from mix effects, because the
        // tax brackets are absolute dollars while the account ratios are not.
        key: 'defaults3x', label: 'defaults x3 (same mix, bigger)',
        over: { IRA1: 3000000, IRA2: 1200000, Roth: 150000, Roth2: 60000,
                Brokerage: 300000, BrokerageBasis: 150000, Cash: 150000 },
    },
    {   // Round 1's scenario, kept so the earlier numbers stay reproducible.
        key: 'round1', label: 'round-1 scenario',
        over: { IRA1: 1800000, IRA2: 700000, Roth: 250000, Roth2: 100000,
                Brokerage: 900000, BrokerageBasis: 500000, Cash: 150000 },
    },
    {   // Equal thirds across IRA / Roth / Brokerage. The mix where a gap fill has a real choice.
        key: 'thirds', label: 'balanced thirds',
        over: { IRA1: 1000000, IRA2: 400000, Roth: 1000000, Roth2: 400000,
                Brokerage: 1400000, BrokerageBasis: 700000, Cash: 150000 },
    },
    {   // Brokerage-dominant: the most Roth-first has to work with.
        key: 'brokheavy', label: 'brokerage-heavy',
        over: { IRA1: 700000, IRA2: 300000, Roth: 400000, Roth2: 200000,
                Brokerage: 2800000, BrokerageBasis: 1200000, Cash: 150000 },
    },
];

const FAMILIES = [
    { key: 'propwd',   label: 'Proportional 10%', over: { strategy: 'propwd',   propWithdraw: 0.10 } },
    { key: 'fixed',    label: 'Reduce 20 yrs',    over: { strategy: 'fixed',    nYears: 20 } },
    { key: 'bracket',  label: 'Fill Bracket 24%', over: { strategy: 'bracket',  stratRate: 0.24, stratIRMAATier: -1 } },
    { key: 'fixedpct', label: 'IRA Draw 6%',      over: { strategy: 'fixedpct', iraWithdrawPct: 0.06 } },
    { key: 'gk',       label: 'Guyton-Klinger',   over: { strategy: 'gk' } },
    { key: 'ordered',  label: 'Ordered CBIR',     over: { strategy: 'ordered',  orderedSeq: 'CBIR' } },
];

const ARMS = [
    { key: 'A0', label: 'control',        flags: {} },
    // A1 ('routing', unifiedConvRouting: true) was removed with the flag itself -- see the header.
    { key: 'RF', label: 'rothThenCash',   flags: { rothGapFill: 'fillRothThenCash' } },
    { key: 'RC', label: 'cashThenRoth',   flags: { rothGapFill: 'fillCashThenRoth' } },
    { key: 'C',  label: 'cash-funded',    flags: { fundConversionWithCash: true } },
    { key: 'RFC', label: 'rothThenCash+cash', flags: { rothGapFill: 'fillRothThenCash', fundConversionWithCash: true } },
    { key: 'RCC', label: 'cashThenRoth+cash', flags: { rothGapFill: 'fillCashThenRoth', fundConversionWithCash: true } },
];

// Fields the routing flag relabels by design. `rothConv` is deliberately NOT here: it is engine
// state (beginYear picks withdrawal timing from it), so leaving it in the money set is what would
// catch a regression of the round-1 mistake.
const LABEL_FIELDS = new Set([
    'IRAwd', 'IRA1-', 'IRA2-',
    '-iraVolSpend1', '-iraVolSpend2', '-iraConvGross1', '-iraConvGross2',
    '-iraSpend', '-iraConvGrossTot',
]);

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────
const money = (n) => (n == null || Number.isNaN(n)) ? '     —   '
    : (n < 0 ? '-' : ' ') + '$' + Math.round(Math.abs(n)).toLocaleString().padStart(10);
const pad = (s, n) => String(s).padEnd(n);

function diffFields(aLog, bLog) {
    if (aLog.length !== bLog.length) return { shapeChange: true, fields: new Map() };
    const fields = new Map();
    for (let i = 0; i < aLog.length; i++) {
        for (const k of new Set([...Object.keys(aLog[i]), ...Object.keys(bLog[i])])) {
            const av = aLog[i][k], bv = bLog[i][k];
            if (typeof av === 'number' && typeof bv === 'number') {
                if (Math.abs(av - bv) > 0.5) fields.set(k, (fields.get(k) ?? 0) + Math.abs(av - bv));
            } else if (av !== bv) fields.set(k, (fields.get(k) ?? 0) + 1);
        }
    }
    return { shapeChange: false, fields };
}

function metrics(res) {
    const last = res.log[res.log.length - 1];
    const defl = last.inflationFactor || 1;
    const rate = res.totals.futureIRARate ?? 0;
    const t = res.totals.terminal;
    const sum = (k) => res.log.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    return {
        score: baselineScoreOf(res, rate),
        spend: res.totals.spendCurrentDollars ?? 0,
        capgains: sum('CapGains'),
        rothWD: sum('RothWD'), cashWD: sum('CashWD'), brokWD: sum('Brokerage-'),
        endRoth: t.roth / defl, endCash: t.cash / defl, endBrok: t.brokerage / defl,
    };
}

function moneyKey(res) {
    return JSON.stringify(res.log.map(r => {
        const o = {};
        for (const k of Object.keys(r)) if (!LABEL_FIELDS.has(k)) o[k] = r[k];
        return o;
    }));
}

// ── Run the whole grid: scenario x spend rate x family x arm ────────────────────────────────
const spendFor = (s, r) => Math.round(totalAssets(s.over) * r);
const R = new Map();   // `${scen}|${rate}|${fam}|${arm}`
for (const s of SCENARIOS) {
    for (const r of SPEND_RATES) {
        for (const f of FAMILIES) {
            for (const a of ARMS) {
                const res = simulate({ ...COMMON, ...s.over, spendGoal: spendFor(s, r), ...f.over, ...a.flags });
                R.set(`${s.key}|${r}|${f.key}|${a.key}`, { res, m: metrics(res) });
            }
        }
    }
}
const g = (s, r, f, a) => R.get(`${s}|${r}|${f}|${a}`);
const d = (s, r, f, a) => g(s, r, f, a).m.score - g(s, r, f, 'A0').m.score;
const pct = (r) => (r * 100).toFixed(0) + '%';

const brokShare = (s) => {
    const o = s.over;
    const tot = o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;
    return o.Brokerage / tot;
};

console.log('='.repeat(112));
console.log('P28 round 3 -- account mix x spend rate. Where does drawing Roth earlier actually pay?');
console.log('='.repeat(112));
console.log('\nGrid: ' + SCENARIOS.length + ' mixes x ' + SPEND_RATES.length + ' spend rates x '
    + FAMILIES.length + ' families x ' + ARMS.length + ' arms = '
    + SCENARIOS.length * SPEND_RATES.length * FAMILIES.length * ARMS.length + ' simulations.');
console.log('Spend is a % of TOTAL ASSETS. Social Security is $69k combined, so the low rates leave'
    + '\nlittle or no spending gap -- which is exactly when these mechanisms have nothing to act on.\n');
console.log(pad('mix', 32) + pad('total assets', 15) + pad('Brok share', 12)
    + SPEND_RATES.map(r => pad('spend @' + pct(r), 13)).join(''));
for (const s of SCENARIOS) {
    console.log('  ' + pad(s.label, 30) + pad('$' + (totalAssets(s.over) / 1e6).toFixed(2) + 'M', 15)
        + pad((brokShare(s) * 100).toFixed(0) + '%', 12)
        + SPEND_RATES.map(r => pad('$' + (spendFor(s, r) / 1000).toFixed(0) + 'k', 13)).join(''));
}

// ── 1. Regression guards ────────────────────────────────────────────────────────────────────
// The routing guard that stood here compared A0 against A1 and went with the flag. What it
// asserted -- routing is label-only in all 90 cells -- is recorded in P28_RESULTS.md, and it can
// no longer regress because there is no longer any code to regress.
let orderedClean = true, cellCount = 0;
for (const s of SCENARIOS) for (const r of SPEND_RATES) for (const f of FAMILIES) {
    cellCount++;
    for (const a of ARMS.slice(1)) {
        const od = diffFields(g(s.key, r, 'ordered', 'A0').res.log, g(s.key, r, 'ordered', a.key).res.log);
        if (od.shapeChange || [...od.fields.keys()].some(k => !LABEL_FIELDS.has(k))) orderedClean = false;
    }
}
console.log('\n1. REGRESSION GUARDS across all ' + cellCount + ' mix x rate x family cells\n');
console.log('   ordered never moves in any arm        : ' + (orderedClean ? 'YES' : 'NO -- a flag leaked'));

// ── 2. Roth-cashThenRoth payoff, spend rate as its own axis ────────────────────────────────────
// Round 2's headline re-run with strain controlled. "!" marks a cell where delivered spending also
// changed, so its delta mixes a wealth change with a spending change and is not like-for-like.
console.log('\n2. Δscore for RC = fillCashThenRoth, by spend rate. "!" = delivered spend changed too.\n');
console.log(pad('mix', 30) + pad('family', 18) + SPEND_RATES.map(r => pad(pct(r), 16)).join(''));
for (const s of SCENARIOS) {
    for (const f of FAMILIES) {
        if (f.key === 'ordered') continue;
        let live = false;
        const row = SPEND_RATES.map(r => {
            const v = d(s.key, r, f.key, 'RC');
            if (Math.abs(v) > 1) live = true;
            const moved = Math.abs(g(s.key, r, f.key, 'RC').m.spend - g(s.key, r, f.key, 'A0').m.spend) > 1;
            return pad(money(v).trim() + (moved ? ' !' : ''), 16);
        });
        if (!live) continue;
        console.log(pad(s.label, 30) + pad(f.label, 18) + row.join(''));
    }
}

// ── 3. Does cashThenRoth still beat first at every strain? ─────────────────────────────────────
console.log('\n3. RC (cashThenRoth) vs RF (rothThenCash), per spend rate. RF is the one that ALSO displaces Cash,\n'
          + '   which is the losing trade, so RC should win or tie everywhere.\n');
console.log(pad('spend rate', 14) + pad('RC >= RF', 12) + pad('RC strictly wins', 20)
    + pad('worst RF cell', 16) + pad('worst RC cell', 16) + 'best RC cell');
for (const r of SPEND_RATES) {
    const cs = [];
    for (const s of SCENARIOS) for (const f of FAMILIES) {
        if (f.key === 'ordered' || f.key === 'gk') continue;
        cs.push({ rf: d(s.key, r, f.key, 'RF'), rc: d(s.key, r, f.key, 'RC') });
    }
    const ge = cs.filter(c => c.rc >= c.rf - 1).length;
    const wins = cs.filter(c => c.rc > c.rf + 1).length;
    console.log(pad(pct(r), 14) + pad(`${ge}/${cs.length}`, 12) + pad(`${wins}/${cs.length}`, 20)
        + pad(money(Math.min(...cs.map(c => c.rf))).trim(), 16)
        + pad(money(Math.min(...cs.map(c => c.rc))).trim(), 16)
        + money(Math.max(...cs.map(c => c.rc))).trim());
}

// ── 4. Mechanism: does the gap fill even have anything to redirect? ─────────────────────────
console.log('\n4. MECHANISM -- lifetime gap-fill draws in the CONTROL arm. fillCashThenRoth can only act on\n'
          + '   a Brokerage draw, so a plan that never reaches Brokerage has no lever to pull.\n');
console.log(pad('mix', 30) + pad('family', 18) + pad('rate', 8)
    + pad('BrokWD (control)', 18) + pad('realized LTCG', 16) + 'RC payoff');
for (const s of SCENARIOS) {
    for (const f of FAMILIES) {
        if (f.key !== 'bracket' && f.key !== 'fixedpct') continue;
        for (const r of SPEND_RATES) {
            const m = g(s.key, r, f.key, 'A0').m;
            console.log(pad(r === SPEND_RATES[0] ? s.label : '', 30)
                + pad(r === SPEND_RATES[0] ? f.label : '', 18) + pad(pct(r), 8)
                + pad(money(m.brokWD).trim(), 18) + pad(money(m.capgains).trim(), 16)
                + money(d(s.key, r, f.key, 'RC')).trim());
        }
    }
}

// ── 5. convertExcessToRoth on its own, strain controlled ────────────────────────────────────
console.log('\n5. convertExcessToRoth ON vs OFF (Δscore), by spend rate. "timed" pins withdrawal timing so\n'
          + '   the routing effect is visible without the month-1/month-11 flip that converting causes.\n');
console.log(pad('mix', 26) + pad('family', 18)
    + SPEND_RATES.map(r => pad(pct(r) + ' raw', 15) + pad(pct(r) + ' timed', 15)).join(''));
const ceCells = [];
for (const s of SCENARIOS) {
    for (const f of FAMILIES) {
        if (f.key === 'gk') continue;                        // spend drifts; not like-for-like
        const cols = []; let live = false;
        for (const r of SPEND_RATES) {
            const mk = (ce, t) => simulate({ ...COMMON, ...s.over, spendGoal: spendFor(s, r), ...f.over,
                convertExcessToRoth: ce, ...(t ? { forceWithdrawTiming: t } : {}) });
            const sc = (x) => baselineScoreOf(x, x.totals.futureIRARate ?? 0);
            const dRaw = sc(mk(true, null)) - sc(mk(false, null));
            const dLate = sc(mk(true, 'late')) - sc(mk(false, 'late'));
            if (Math.abs(dRaw) > 1 || Math.abs(dLate) > 1) live = true;
            ceCells.push({ s: s.label, f: f.label, r, dRaw, dLate });
            cols.push(pad(money(dRaw).trim(), 15) + pad(money(dLate).trim(), 15));
        }
        if (!live) continue;
        console.log(pad(s.label, 26) + pad(f.label, 18) + cols.join(''));
    }
}

// ── 6. Degeneracy ───────────────────────────────────────────────────────────────────────────
const collapses = [];
for (const s of SCENARIOS) for (const r of SPEND_RATES) for (const a of ARMS) {
    const seen = new Map();
    for (const f of FAMILIES) {
        const k = moneyKey(g(s.key, r, f.key, a.key).res);
        if (seen.has(k)) collapses.push(`${s.label} @${pct(r)} ${a.label}: ${seen.get(k)} == ${f.label}`);
        else seen.set(k, f.label);
    }
}
console.log('\n6. DEGENERACY -- does an arm make two families indistinguishable?\n');
if (!collapses.length) console.log('   none -- all 6 families stayed distinct in every arm of every mix x rate cell');
else { collapses.slice(0, 12).forEach(c => console.log('   ' + c));
       if (collapses.length > 12) console.log(`   ...and ${collapses.length - 12} more`); }

// ── 7. Scored predictions ───────────────────────────────────────────────────────────────────
console.log('\n7. PREDICTIONS vs OUTCOME\n');
const check = (l, ok, det) => console.log(`  ${ok ? 'HELD    ' : 'BROKEN  '} ${pad(l, 44)} ${det}`);

const allCells = [];
for (const s of SCENARIOS) for (const r of SPEND_RATES) for (const f of FAMILIES) {
    if (f.key === 'ordered' || f.key === 'gk') continue;
    allCells.push({ s: s.label, f: f.label, r, rf: d(s.key, r, f.key, 'RF'), rc: d(s.key, r, f.key, 'RC') });
}
const rcLoses = allCells.filter(c => c.rc < c.rf - 1);
check('A. cashThenRoth dominates rothThenCash', rcLoses.length === 0,
    rcLoses.length === 0 ? `RC >= RF in all ${allCells.length} cells`
        : `RC lost ${rcLoses.length}/${allCells.length}: `
          + rcLoses.slice(0, 3).map(c => `${c.f}@${pct(c.r)}`).join(', '));

const rcNeg = allCells.filter(c => c.rc < -1000);
check('B. cashThenRoth never destroys value', rcNeg.length === 0,
    rcNeg.length === 0 ? `no cell worse than -$1k across ${allCells.length}`
        : `${rcNeg.length}/${allCells.length} negative, worst ${money(Math.min(...rcNeg.map(c => c.rc))).trim()}`);

const byRate = SPEND_RATES.map(r => ({
    r, best: Math.max(...allCells.filter(c => c.r === r).map(c => c.rc)),
    live: allCells.filter(c => c.r === r && Math.abs(c.rc) > 1000).length,
    n: allCells.filter(c => c.r === r).length,
}));
const growsWithSpend = byRate.every((x, i) => i === 0 || x.best >= byRate[i - 1].best - 1000);
check('C. payoff grows with spend rate', growsWithSpend,
    byRate.map(x => `${pct(x.r)}: best ${money(x.best).trim()}, ${x.live}/${x.n} live`).join('  |  '));

// Prediction D was "routing inert AND ordered frozen". Its first half HELD and then took the
// routing flag out of the engine with it, so what is left to score is the half that still has code
// behind it.
check('D. ordered frozen in every arm', orderedClean, orderedClean ? 'ok' : 'LEAK');

const ceLose = ceCells.filter(c => c.dRaw < -1000);
const ceLoseTimed = ceCells.filter(c => c.dLate < -1000);
check('E. convertExcessToRoth never loses alone', ceLose.length === 0,
    ceLose.length === 0 ? `ON >= OFF in all ${ceCells.length} cells`
        : `loses ${ceLose.length}/${ceCells.length} (${ceLoseTimed.length} still lose with timing pinned), `
          + `worst ${money(Math.min(...ceLose.map(c => c.dRaw))).trim()}`);
console.log('');
