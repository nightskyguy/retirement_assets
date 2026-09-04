'use strict';
/**
 * brokerage_harness.js -- P32. Why is Brokerage barely drawn, and is the third-pass exclusion
 * that keeps it out still the right call?
 *
 * Run:  node .test_harnesses/brokerage_harness.js
 *
 * THE DEFECT THAT PROMPTED THIS
 * `optimizer_core.tests.js` pins it: on CAP_BASE, `minlimit` strands $71,382 across nine consecutive
 * years (2041-2049), the first with $945,376 of Brokerage untouched, and in every one of those
 * years Cash, Roth and the IRA are all at zero. Brokerage is the only money left and the engine
 * will not touch it. P38 could not fix this -- widening the forced-IRA gate cannot help a year
 * whose IRA is already empty.
 *
 * THE FIVE PLACES BROKERAGE CAN BE DRAWN FOR SPENDING (verified, nothing else touches it)
 *   1. cyclic harvest branch        optimizer_core.js:1358-1406   only when cyclicEnabled
 *   2. bracket-family gap fill      optimizer_core.js:1592-1610   Cash -> Brokerage -> Roth
 *   3. ordered gap fill             optimizer_core.js:1611-1613   user's own CBIR/RIBC/BIRC order
 *   4. baseline gap fill            optimizer_core.js:1615-1629   Brokerage+Cash PROPORTIONAL 40/60
 *   5. ordered third pass           optimizer_core.js:1667-1669   ordered re-runs its sequence
 * Exactly one gap-fill branch fires per year and which one is fixed by the strategy, so a strategy
 * label is already an attribution -- no engine instrumentation is needed for Q1.
 *
 * THE EXCLUSION UNDER TEST (optimizer_core.js:1671-1678, verbatim)
 *   "Always use Cash-only in the 3rd pass - adding more Brokerage here creates a cap-gains spiral:
 *    more gains -> higher SS taxation -> bigger residual -> repeat."
 * The reasoning is plausible and cites no run. Note the engine already accepts this hazard for
 * `ordered`, which draws Brokerage in the third pass (:1667). And the forced-IRA backstop next door
 * (:1741-1764) already establishes a bounded 4-iteration convergence pattern for the same shape of
 * feedback. So the question is not "is feedback conceivable" but "does it actually diverge".
 *
 * ── PREDICTIONS UNDER TEST, recorded BEFORE the numbers were looked at ───────────────────────────
 * Q1, by strategy family, fraction of simulated years drawing any Brokerage:
 *   P1. baseline/propwd/gk/fixed HIGHEST and earliest. Their gap fill is proportional, not
 *       sequential, so Brokerage is touched in the very first year that opens a gap.
 *   P2. bracket/IRMAA-tier/fixedpct LOWER and LATER. Cash comes first in their chain, so nothing
 *       reaches Brokerage until Cash is exhausted.
 *   P3. ordered BIRC ~100% from year 0 (Brokerage first); CBIR high (Brokerage second); RIBC
 *       LOWEST of the three and latest (Brokerage third, behind Roth and the whole IRA).
 *   P4. Rows that never draw Brokerage at all should be rare outside RIBC and Brokerage-poor plans.
 * Q2:
 *   P5. The spiral does NOT diverge. SS inclusion is capped at 85% and LTCG rates top out at 20%,
 *       so the marginal "extra tax per extra gain dollar" is bounded well under 1 and the feedback
 *       is a convergent geometric series, not a runaway. Expect <= 2 iterations in nearly all years.
 *   P6. Allowing Brokerage in the third pass eliminates the pinned minlimit stranding outright.
 *
 * Scoring of these predictions is printed at the end, and the ones that were WRONG are called out.
 */

// ── Bootstrap the engine exactly like unifiedconv_harness.js / optimizer_core.tests.js ───────────
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
const simulate = core.simulate;
// q3/q4 (P32e) additionally use the sweep's own enumeration + the UI's scoring recipe.
const { afterTaxNetWorth, SPENDABLE_WEIGHT, buildStrategyFamilies, OPTIMIZER_GRIDS,
        bothOnMedicareAtStart } = core;

const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString();
const pct = (a, b) => b === 0 ? '  n/a' : (100 * a / b).toFixed(1).padStart(5) + '%';

// ── Scenarios ───────────────────────────────────────────────────────────────────────────────────
// CAP_BASE is the fixture the P32 tripwire is pinned on; the ladder walks Brokerage-poor to
// Brokerage-rich holding total wealth constant, because "how often is Brokerage drawn" is
// meaningless without knowing how much of it there is.
const CAP_BASE = {
    STATEname: 'CA', strategy: 'bracket', stratRate: 0.22, stratIRMAATier: -1, stratACAMultiple: 0,
    nYears: 30, birthyear1: 1960, birthmonth1: 12, die1: 74,
    birthyear2: 1959, birthmonth2: 12, die2: 90, hasSpouse: true,
    IRA1: 2000000, IRA2: 100000, Roth: 0, Roth2: 0,
    Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000, CashReserve: 0,
    ss1: 48000, ss1Age: 67, ss2: 24000, ss2Age: 67,
    pensionAnnual: 0, survivorPct: 75, pensionCola: false,
    spendGoal: 160000, spendChange: -0.01, iraBaseGoal: 0,
    inflation: 0.025, cpi: 0.025, growth: 0.05, cashYield: 0.02, dividendRate: 0.0,
    ssFailYear: 2099, ssFailPct: 1.0, convertExcessToRoth: false, propWithdraw: 0,
    iraWithdrawPct: 0.05, startYear: 2026, dividendReinvest: false,
};
// Total investable held at $2.25M across the ladder; only the split moves.
const ladder = (brok, ira, cash, roth) => ({
    ...CAP_BASE, IRA1: ira, IRA2: 0, Brokerage: brok, BrokerageBasis: brok / 2,
    Cash: cash, Roth: roth, Roth2: 0,
});
const SCENARIOS = [
    ['capbase',    { ...CAP_BASE }],                              // the pinned fixture
    ['brokPoor',   ladder(100000, 2050000,  50000,  50000)],
    ['brokThird',  ladder(750000, 1300000, 100000, 100000)],
    ['brokHalf',   ladder(1125000, 875000, 125000, 125000)],
    ['brokRich',   ladder(1500000, 500000, 125000, 125000)],
];

const ARMS = [
    ['bracket22',  { strategy: 'bracket',  stratRate: 0.22 }],
    // Was `strategy: 'minlimit'` until 2026-08-30. P94 (`46f7bb6`) deleted that strategy, after which
    // this arm matched no withdrawal branch and returned the `baseline` arm below BIT-FOR-BIT while
    // still being filed under the 'bracket' family in FAMILY -- a baseline run counted as a bracket
    // one, in a harness whose whole subject is which family draws Brokerage. Re-pointed the way P94
    // re-pointed its own seven fixtures: to bracket at IRMAA tier 1, the reachable arm these
    // parameters (stratRate 0, stratIRMAATier 1) always described.
    ['irmaa1',     { strategy: 'bracket',  stratRate: 0, stratIRMAATier: 1 }],
    ['fixedpct2',  { strategy: 'fixedpct', iraWithdrawPct: 0.02 }],
    ['propwd0',    { strategy: 'propwd',   propWithdraw: 0, stratRate: 0 }],
    ['gk',         { strategy: 'gk' }],
    ['fixed',      { strategy: 'fixed' }],
    ['baseline',   { strategy: '__unrecognized__' }],
    ['ord-CBIR',   { strategy: 'ordered',  orderedSeq: 'CBIR' }],
    ['ord-RIBC',   { strategy: 'ordered',  orderedSeq: 'RIBC' }],
    ['ord-BIRC',   { strategy: 'ordered',  orderedSeq: 'BIRC' }],
    ['cyclic',     { cyclicEnabled: true }],
];
// Which gap-fill branch each arm lands in, from the dispatch at optimizer_core.js:1591-1629.
const FAMILY = {
    bracket22: 'bracket', irmaa1: 'bracket', fixedpct2: 'bracket',
    propwd0: 'baseline', gk: 'baseline', fixed: 'baseline', baseline: 'baseline',
    'ord-CBIR': 'ordered', 'ord-RIBC': 'ordered', 'ord-BIRC': 'ordered',
    cyclic: 'cyclic',
};

const run = (scen, ov, extra = {}) => simulate({ ...scen, ...ov, ...extra });

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Q1 -- how often is Brokerage drawn at all?
// ════════════════════════════════════════════════════════════════════════════════════════════════
function q1() {
    console.log('\n' + '='.repeat(100));
    console.log('Q1  How often is Brokerage actually drawn?   (years with Brokerage- > $1)');
    console.log('='.repeat(100));

    const byFamily = {};
    const rows = [];
    for (const [sn, scen] of SCENARIOS) {
        for (const [an, ov] of ARMS) {
            let r;
            try { r = run(scen, ov); } catch (e) { continue; }
            const log = r.log;
            const drawYears = log.filter(e => (e['Brokerage-'] || 0) > 1);
            const lifetime = log.reduce((s, e) => s + (e['Brokerage-'] || 0), 0);
            // First year Brokerage is touched, as an index into the plan
            const firstIdx = log.findIndex(e => (e['Brokerage-'] || 0) > 1);
            const startBrok = scen.Brokerage || 0;
            const rec = {
                scen: sn, arm: an, fam: FAMILY[an],
                years: log.length, drawYears: drawYears.length,
                lifetime, startBrok,
                firstIdx: firstIdx < 0 ? null : firstIdx,
                neverDrew: drawYears.length === 0,
                endBrok: log[log.length - 1]?.Brokerage ?? 0,
            };
            rows.push(rec);
            const f = byFamily[rec.fam] = byFamily[rec.fam] ||
                { rowN: 0, never: 0, yrs: 0, drawYrs: 0, firstSum: 0, firstN: 0 };
            f.rowN++; f.yrs += rec.years; f.drawYrs += rec.drawYears;
            if (rec.neverDrew) f.never++;
            if (rec.firstIdx != null) { f.firstSum += rec.firstIdx; f.firstN++; }
        }
    }

    console.log('\nBy gap-fill family:');
    console.log('family    rows  rows never drawing   years drawing Brokerage   mean first draw yr');
    for (const [f, v] of Object.entries(byFamily)) {
        console.log(f.padEnd(10) + String(v.rowN).padStart(4) +
            (String(v.never) + '/' + v.rowN).padStart(20) +
            pct(v.drawYrs, v.yrs).padStart(24) +
            (v.firstN ? (v.firstSum / v.firstN).toFixed(1) : 'never').padStart(21));
    }

    console.log('\nBy arm (all scenarios pooled):');
    console.log('arm          rows never drew   % of years drawing   mean first draw yr');
    for (const [an] of ARMS) {
        const rs = rows.filter(r => r.arm === an);
        if (!rs.length) continue;
        const never = rs.filter(r => r.neverDrew).length;
        const dy = rs.reduce((s, r) => s + r.drawYears, 0), ty = rs.reduce((s, r) => s + r.years, 0);
        const fs = rs.filter(r => r.firstIdx != null);
        console.log(an.padEnd(12) + (String(never) + '/' + rs.length).padStart(14) +
            pct(dy, ty).padStart(21) +
            (fs.length ? (fs.reduce((s, r) => s + r.firstIdx, 0) / fs.length).toFixed(1) : 'never').padStart(21));
    }

    console.log('\nPer scenario, share of the starting Brokerage ever spent (lifetime draw / start):');
    console.log('scenario     ' + ARMS.map(a => a[0].slice(0, 9).padStart(10)).join(''));
    for (const [sn] of SCENARIOS) {
        let line = sn.padEnd(13);
        for (const [an] of ARMS) {
            const r = rows.find(x => x.scen === sn && x.arm === an);
            line += (r && r.startBrok ? (100 * r.lifetime / r.startBrok).toFixed(0) + '%' : '-').padStart(10);
        }
        console.log(line);
    }
    return { rows, byFamily };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Q2 -- does a third-pass Brokerage leg spiral, converge, or improve?
// Requires the engine research flags (default off): thirdPassBrokerage, forcedIRAAllowBrokerage.
// ════════════════════════════════════════════════════════════════════════════════════════════════
// ── Q2 axes (P32d-3) ────────────────────────────────────────────────────────────────────────────
// The 2026-08-17 preliminary reading was 8 hand-picked scenarios in ONE state, on a fixture whose
// dividendRate is 0. That is close to the configuration LEAST able to produce the feedback under
// test, so "no spiral" measured there is weak evidence. These three axes move the spiral's own
// arithmetic:
//   basis    - gains per withdrawn dollar IS the amplitude. A 20%-basis account realizes four times
//              the gain per dollar raised that an 80%-basis one does. findings.md already records
//              that brokerage conclusions are basis-stable in SIGN and basis-scaled in SIZE.
//   state    - feeds `_brokTaxRate` directly via `nominalStateTaxAtLimit`. CA taxes gains as
//              ordinary income, TX not at all, NY in between.
//   dividend - raises MAGI independently of any withdrawal, pushing SS inclusion toward its 85%
//              ceiling BEFORE the Brokerage leg fires. If SS phase-in is the spiral's engine, a
//              household already at the ceiling cannot spiral and one approaching it is worst case.
const Q2_BASIS = [0.2, 0.5, 0.8];
const Q2_STATES = ['CA', 'NY', 'TX'];
const Q2_DIVS = [0, 0.02];
// `brokFirst` is measured ALONE as well as combined, because the preliminary run found the two arms
// can pull opposite ways: it erased every forced-IRA dollar on one fixture and funded five FEWER
// years. Reporting only the combined arm would have averaged that away.
// Labels name the SETTING, not an abbreviation of it. An earlier draft called the backstop arm
// `fib` (forced-IRA-brokerage), which reads as Fibonacci and hid which of the two exclusions was
// under test in every table it printed.
const Q2_ARMS = [
    ['off',            {}],
    ['bounded',        { thirdPassBrokerage: 'bounded' }],
    ['unbounded',      { thirdPassBrokerage: 'unbounded' }],
    ['brokFirst',      { forcedIRAAllowBrokerage: 'brokerageFirst' }],
    ['bnd+brokFirst',  { thirdPassBrokerage: 'bounded', forcedIRAAllowBrokerage: 'brokerageFirst' }],
];

function q2() {
    console.log('\n' + '='.repeat(100));
    console.log('Q2  Third-pass Brokerage: spiral, converge, or improve?');
    console.log('='.repeat(100));

    // These are the SHIPPED counter names (optimizer_core.js:2138-2140). The previous probe guessed
    // `tpBrokIters` before the arms existed, never matched, and printed SKIPPED on every run from
    // v11.1582 until 2026-08-21 - the question looked answered and was inert.
    const supported = (() => {
        const probe = run(CAP_BASE, {}, { thirdPassBrokerage: 'unbounded' });
        return probe.totals.thirdPassBrokerIters !== undefined;
    })();
    if (!supported) {
        console.log('\n  SKIPPED: totals.thirdPassBrokerIters absent on a run that should have used');
        console.log('  the arm. Either the research flags are gone or CAP_BASE stopped reaching the');
        console.log('  third pass at all - check BOTH before believing this line.\n');
        return null;
    }

    const out = [];
    for (const basis of Q2_BASIS) for (const st of Q2_STATES) for (const dv of Q2_DIVS) {
        for (const [sn, scen] of SCENARIOS) {
            for (const [an, ov] of ARMS) {
                for (const [qn, qov] of Q2_ARMS) {
                    const axis = { STATEname: st, dividendRate: dv,
                                   BrokerageBasis: Math.round((scen.Brokerage || 0) * basis) };
                    let r; try { r = run(scen, ov, { ...axis, ...qov }); } catch (e) { continue; }
                    const t = r.totals;
                    out.push({
                        basis, st, dv, sn, an, qn, fam: FAMILY[an],
                        shortfall: t.shortfall, spend: t.spend, finalNW: r.finalNW,
                        funded: t.yearsfunded, tested: t.yearstested,
                        forcedIRA: t.forcedIRATotal ?? 0,
                        brokLife: r.log.reduce((a, e) => a + (e['Brokerage-'] || 0), 0),
                        // Counters attach lazily, so ABSENT means the arm never fired - which is not
                        // the same as zero. Kept distinct here, coerced only at print time.
                        iters: t.thirdPassBrokerIters, capped: t.thirdPassBrokerCapped,
                        stalled: t.thirdPassBrokerStalled,
                    });
                }
            }
        }
    }

    const armed = o => o.qn !== 'off';
    const num = v => v ?? 0;
    const cells = out.length / Q2_ARMS.length;

    // ── Capped and stalled are NEVER summed. Only capped is spiral evidence; a stalled year is the
    // account's own arithmetic (dust, or a draw whose tax eats the draw). The engine's first draft
    // lacked the stall guard and burned 200 passes on dust, which would have read as divergence.
    console.log('\nSPIRAL COUNTERS by arm  (' + cells + ' scenario cells per arm)');
    console.log('arm              runs w/ iters    total iters      max iters      CAPPED yrs     stalled yrs');
    for (const [qn] of Q2_ARMS) {
        const rs = out.filter(o => o.qn === qn);
        if (!rs.length) continue;
        const fired = rs.filter(o => o.iters !== undefined).length;
        console.log(qn.padEnd(16) +
            (fired + '/' + rs.length).padStart(13) +
            String(rs.reduce((s, o) => s + num(o.iters), 0)).padStart(15) +
            String(Math.max(0, ...rs.map(o => num(o.iters)))).padStart(15) +
            String(rs.reduce((s, o) => s + num(o.capped), 0)).padStart(16) +
            String(rs.reduce((s, o) => s + num(o.stalled), 0)).padStart(16));
    }

    // ── Read one axis at a time. A pooled total hides an axis that only bites at one end.
    const axisTable = (title, key, vals, fmt) => {
        const f = fmt || String;
        console.log('\nby ' + title + '   (armed runs only)');
        console.log(title.padEnd(12) + '  total iters    max iters       CAPPED       stalled     armed runs');
        for (const v of vals) {
            const rs = out.filter(o => armed(o) && o[key] === v);
            console.log(f(v).padEnd(12) +
                String(rs.reduce((s, o) => s + num(o.iters), 0)).padStart(13) +
                String(Math.max(0, ...rs.map(o => num(o.iters)))).padStart(13) +
                String(rs.reduce((s, o) => s + num(o.capped), 0)).padStart(13) +
                String(rs.reduce((s, o) => s + num(o.stalled), 0)).padStart(14) +
                String(rs.filter(o => o.iters !== undefined).length).padStart(15));
        }
    };
    axisTable('basis', 'basis', Q2_BASIS, v => (v * 100) + '%');
    axisTable('state', 'st', Q2_STATES);
    axisTable('dividend', 'dv', Q2_DIVS, v => (v * 100) + '%');

    const mate = o => out.find(x => x.qn === 'off' && x.sn === o.sn && x.an === o.an &&
                                    x.basis === o.basis && x.st === o.st && x.dv === o.dv);

    // ── Ordered is excluded from BOTH arms by design (optimizer_core.js:2107 and :2169). Its rows
    // are INERT, not zero. Printing them as zeros would read as "measured, no effect".
    const inertFams = [...new Set(out.filter(o => o.fam === 'ordered').map(o => o.an))];
    console.log('\nINERT by design (engine excludes ordered from both arms): ' + inertFams.join(', '));
    const inertMoved = out.filter(o => armed(o) && o.fam === 'ordered').filter(o => {
        const b = mate(o);
        return b && (Math.abs(o.finalNW - b.finalNW) > 1 || Math.abs(o.shortfall - b.shortfall) > 1);
    });
    console.log('  ordered rows that moved anyway: ' + inertMoved.length +
                (inertMoved.length ? '   <-- INVESTIGATE, the exclusion is not holding' : '   (as expected)'));

    // ── Funded years sits BESIDE the forced-IRA saving deliberately: on the preliminary run
    // `brokerageFirst` erased $253,802 of forced IRA and funded five fewer years. A saving column
    // on its own would have shipped that as a win.
    console.log('\nWHAT MOVED  (armed vs off, same cell; only funded-year movers are printed)');
    // `totals.shortfall` is Math.min(0, netIncome - spendGoal) accumulated, so it is NEGATIVE or
    // zero (optimizer_core.js:2310, :2726). A raw delta reads backwards - a smaller shortfall is a
    // LARGER number. Printed as unfunded dollars, positive, off -> armed, so the direction is on
    // the page and cannot be misread.
    console.log('cell                                      arm                 funded          unfunded off->armed      dBrokLife      dFinalNW');
    let movedN = 0, fundedWorse = 0, fundedBetter = 0;
    for (const o of out) {
        if (!armed(o)) continue;
        const b = mate(o);
        if (!b || o.funded === b.funded) continue;
        movedN++;
        if (o.funded < b.funded) fundedWorse++; else fundedBetter++;
        const cell = o.sn + '/' + o.an + ' b' + (o.basis * 100) + ' ' + o.st + ' d' + (o.dv * 100);
        console.log(cell.padEnd(42) + o.qn.padEnd(16) +
            (b.funded + '->' + o.funded).padStart(8) +
            (money(-b.shortfall) + '->' + money(-o.shortfall)).padStart(28) +
            money(o.brokLife - b.brokLife).padStart(14) +
            money(o.finalNW - b.finalNW).padStart(14));
    }
    console.log('\nfunded-year changes: ' + movedN + '  (better ' + fundedBetter +
                ',  WORSE ' + fundedWorse + ')');
    // A funded-year COUNT cannot say whether the unfunded DOLLARS fell, and the two arms differ so
    // sharply that a pooled figure is actively misleading. Per arm, always.
    console.log('\nunfunded DOLLARS by arm  (positive column = spending that stays unpaid)');
    console.log('arm                 fell     rose      $ newly funded      $ newly unfunded');
    for (const [qn] of Q2_ARMS) {
        if (qn === 'off') continue;
        let fell = 0, rose = 0, gained = 0, lost = 0;
        for (const o of out.filter(x => x.qn === qn)) {
            const b = mate(o);
            if (!b) continue;
            const du = (-o.shortfall) - (-b.shortfall);   // positive = MORE unfunded = worse
            if (du < -1) { fell++; gained += -du; } else if (du > 1) { rose++; lost += du; }
        }
        console.log(qn.padEnd(18) + String(fell).padStart(6) + String(rose).padStart(9) +
                    money(gained).padStart(20) + money(lost).padStart(22));
    }
    // Pooled better/worse hides the only thing this question needs to separate: the third-pass arm
    // and the funding-backstop arm are different decisions and can point opposite ways.
    console.log('\nfunded-year movers BY ARM  (the two arms are separate ship decisions)');
    console.log('arm                movers      better       WORSE');
    for (const [qn] of Q2_ARMS) {
        if (qn === 'off') continue;
        let bt = 0, ws = 0;
        for (const o of out.filter(x => x.qn === qn)) {
            const b = mate(o);
            if (!b || o.funded === b.funded) continue;
            if (o.funded < b.funded) ws++; else bt++;
        }
        console.log(qn.padEnd(18) + String(bt + ws).padStart(6) + String(bt).padStart(12) +
                    String(ws).padStart(12));
    }

    const totalCapped = out.filter(armed).reduce((s, o) => s + num(o.capped), 0);
    const totalStalled = out.filter(armed).reduce((s, o) => s + num(o.stalled), 0);
    const worstIter = Math.max(0, ...out.filter(armed).map(o => num(o.iters)));
    console.log('\nSPIRAL VERDICT: capped years = ' + totalCapped + '   (the ONLY spiral evidence);' +
                '  stalled years = ' + totalStalled + ';  worst iters in one run = ' + worstIter);
    if (totalCapped) {
        console.log('  NOTE: a capped year in the BOUNDED arm can be a cap artifact - the convergence');
        console.log('  test sits at the TOP of the loop body, so a year consuming all 6 draws exits on');
        console.log('  the loop condition without testing again. P32d-4 re-checks each of these against');
        console.log('  the unbounded arm before the word "spiral" is used.');
    }
    return { out, totalCapped, totalStalled, worstIter, fundedWorse, fundedBetter };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Accounting audit -- the phase requires these BEFORE trusting any behavior arm.
// ════════════════════════════════════════════════════════════════════════════════════════════════
function audit() {
    console.log('\n' + '='.repeat(100));
    console.log('ACCOUNTING AUDIT  (run before believing any behavior number above)');
    console.log('='.repeat(100));

    // A1. THE DIVIDEND IS COUNTED TWICE. Found here, and it is the actual answer to "why is
    // Brokerage barely drawn" -- bigger than anything in the third pass.
    //
    // yr.taxableDividends (optimizer_core.js:1191) is Brokerage x dividendRate. It then appears in
    // BOTH places:
    //   as INCOME   -- yr.possibleIncome (:1226, :1543) and every later income sum (:1662, :1750,
    //                  :1778, :1800), so it reduces the withdrawal the plan needs to make; and
    //   as BALANCE  -- growAndSettle credits it to Cash (:2243) or, under DRIP, to Brokerage
    //                  (:2239-2240).
    // Nothing ever debits it back out. The only Cash debits in the file are the Cash Reserve hide
    // (:1328) and conversion-tax funding (:2065, :2157). So the same dollar funds spending AND stays
    // on the balance sheet.
    //
    // The test holds TOTAL return fixed and moves it between growth and dividends. Dividends are
    // taxed every year and growth is not, so the dividend-bearing plan must end BELOW the
    // growth-only plan. It ends far above.
    console.log('\nA1. Dividend double-count. Same total return, split two ways.');
    console.log('    Brokerage-only $1M, basis = value so no capital gains interfere.');
    console.log('    A: growth 8% / dividend 0%      B: growth 6% / dividend 2%');
    console.log('    B pays tax on its dividends and A pays none, so B MUST end lower.\n');
    const dseed = {
        STATEname: 'CA', nYears: 20, birthyear1: 1955, birthmonth1: 1, die1: 90,
        birthyear2: 0, birthmonth2: 12, die2: 0, hasSpouse: false,
        ss1: 0, ss1Age: 70, ss2: 0, ss2Age: 70, pensionAnnual: 0, survivorPct: 0, pensionCola: false,
        spendChange: 0, iraBaseGoal: 0, inflation: 0, cpi: 0, cashYield: 0,
        ssFailYear: 2099, ssFailPct: 1, convertExcessToRoth: false, propWithdraw: 0, stratRate: 0,
        iraWithdrawPct: 0.05, startYear: 2026, dividendReinvest: false, strategy: 'propwd',
        IRA1: 0, IRA2: 0, Roth: 0, Roth2: 0, Cash: 0, CashReserve: null,
        Brokerage: 1000000, BrokerageBasis: 1000000,
    };
    const endWealth = r => { const l = r.log[r.log.length - 1];
        return (l.Brokerage || 0) + (l.Cash || 0) + (l.TotalIRA || 0) + (l.TotalRoth || 0); };
    console.log('    spendGoal        A end wealth    B end wealth     B - A      A tax     B tax');
    for (const spend of [0, 40000, 80000]) {
        const A = simulate({ ...dseed, growth: 0.08, dividendRate: 0,    spendGoal: spend });
        const B = simulate({ ...dseed, growth: 0.06, dividendRate: 0.02, spendGoal: spend });
        console.log('    ' + money(spend).padStart(9) + money(endWealth(A)).padStart(16) +
            money(endWealth(B)).padStart(16) + money(endWealth(B) - endWealth(A)).padStart(12) +
            money(A.totals.tax).padStart(11) + money(B.totals.tax).padStart(10));
    }
    console.log('\n    Year-by-year, plan B. BEFORE the fix the dividend landed in Cash, CashWD stayed');
    console.log('    $0 forever, Cash climbed to $746,286 and Brokerage- fell to $0 by year 14. After');
    console.log('    the fix Brokerage- carries the spending and Cash is drawn for the dividend tax.');
    const trace = simulate({ ...dseed, growth: 0.06, dividendRate: 0.02, spendGoal: 40000 });
    console.log('    yr   cashDividends      CashWD        Cash   Brokerage-');
    [0, 1, 5, 10, 14, 19].forEach(i => { const e = trace.log[i]; if (!e) return;
        console.log('    ' + String(i).padEnd(5) + money(e.cashDividends || 0).padStart(13) +
            money(e.CashWD || 0).padStart(12) + money(e.Cash || 0).padStart(12) +
            money(e['Brokerage-'] || 0).padStart(13)); });

    // A1b. What it costs at the SHIPPED default. retirement_optimizer.html:380 defaults
    // dividendRate to 0.5, so this is not an edge case - it is every plan.
    console.log('\nA1b. Cost at the shipped 0.5% default. Total return pinned at 5%, split moved.');
    console.log('     div%  growth%     end Cash    end Brok   lifetime BrokWD      finalNW');
    for (const d of [0, 0.005, 0.01, 0.02]) {
        const r = simulate({ ...CAP_BASE, Brokerage: 600000, BrokerageBasis: 300000,
                             dividendRate: d, growth: 0.05 - d });
        const L = r.log[r.log.length - 1];
        const bw = r.log.reduce((s, e) => s + (e['Brokerage-'] || 0), 0);
        console.log('     ' + (d * 100).toFixed(1).padStart(4) + '%' +
            ((0.05 - d) * 100).toFixed(1).padStart(8) + '%' +
            money(L.Cash || 0).padStart(13) + money(L.Brokerage || 0).padStart(12) +
            money(bw).padStart(18) + money(r.finalNW).padStart(13));
    }
    console.log('     Raising the dividend share at CONSTANT total return suppresses Brokerage');
    console.log('     withdrawals and inflates net worth. That is the reported symptom, and its');
    console.log('     cause is here rather than in any withdrawal-order rule.');

    // A2. capGainsPercentage is frozen at start of year (optimizer_core.js:1330 reads `balance`,
    // not `curBalances`), so a SECOND Brokerage draw in one year is priced at the pre-draw gain
    // fraction -- and a third-pass Brokerage leg is exactly that second draw.
    console.log('\nA2. capGainsPercentage is computed once from the START-of-year balance (:1330).');
    const gainFrac = (brok, basis) => brok === 0 ? 0 : (brok - basis) / brok;
    console.log('    Worked example, $1,000,000 Brokerage with $500,000 basis:');
    console.log('      start-of-year gain fraction          ' + (100 * gainFrac(1e6, 5e5)).toFixed(1) + '%');
    console.log('      after a $400,000 proportional draw   ' +
        (100 * gainFrac(1e6 - 4e5, 5e5 - 5e5 * 0.4)).toFixed(1) + '%  (basis consumes proportionally)');
    console.log('    Proportional consumption keeps the ratio CONSTANT, so the frozen value is');
    console.log('    correct under the current basis model. It would only be wrong under lot');
    console.log('    selection (HIFO / specific-ID), which this engine does not model.');

    // A3. The modeling ceiling the phase asks to be recorded regardless of outcome.
    console.log('\nA3. MODELING CEILING: basis is a single aggregate scalar consumed proportionally');
    console.log('    (calculateBrokerageWithdrawal, optimizer_core.js:165-183). No lot selection, so');
    console.log('    HIFO / specific-ID -- the single largest real-world lever for raising cash');
    console.log('    without raising gains -- cannot be modeled. Any P32 conclusion is bounded by this.');
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Q3/Q4 (P32e) -- does cyclic ever WIN, and does the cycleLTCGTarget nerdknob hide a real lever?
// Runs the Optimizer's own enumeration (buildStrategyFamilies, nerdknob configuration) over the
// Stage-1 45-cell grid, scored with the UI's recipe (shared per-cell heirs rate, baselineScore).
// Grid copied from phased_harness.js, which copied P28's ladder -- copy, do not import.
//
// PREDICTIONS (S1-P2..P4), recorded before the numbers were looked at:
//   S1-P2. Cyclic beats its own non-cyclic family twin (family-level best-vs-best, spend equal
//          within $1) in <15% of cells; wins concentrate in the brokerage-heavy mixes
//          (thirds / brokheavy).
//   S1-P3. cycleLTCGTarget 0.20 moves the (spend, wealth) pair by <1% of real after-tax NW
//          except in 8%-spend cells, where spend already forces past the 0% LTCG bracket.
//   S1-P4. Q1 re-run on the corrected engine: every family's draw frequency RISES vs the
//          pre-fix numbers (baseline 90.4%, bracket 61.1%, cyclic 57.5%, ordered 44.7% -- the
//          double-credited dividend was suppressing draws); never-draw rows stay at zero.
// ════════════════════════════════════════════════════════════════════════════════════════════════
const S1_COMMON = {
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
const S1_MIXES = [
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
const S1_WEALTH = [0.5, 1, 3];
const S1_RATES = [0.04, 0.06, 0.08];
const S1_ACCTS = ['IRA1', 'IRA2', 'Roth', 'Roth2', 'Brokerage', 'BrokerageBasis', 'Cash'];
const s1Total = o => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;

function s1MkRow(f, res) {
    const last = res.log[res.log.length - 1];
    const row = {
        family: f.family, modifier: f.modifier, param: f.paramLabel,
        cyclic: !!(f.overrides.cyclicEnabled), overrides: f.overrides,
        totals: res.totals, finalNW: res.finalNW,
        finalNWCurrentDollars: last.totalNetWealth / (last.inflationFactor || 1),
    };
    if (row.cyclic) {
        const hv = res.log.filter(e => e.subCycle && String(e.subCycle).includes('Brok'));
        const iv = res.log.filter(e => e.subCycle === 'IRA');
        row.harvest = {
            n: hv.length,
            iraWdHarvest: hv.reduce((s, e) => s + (e.IRAwd || 0), 0),
            convHarvest: hv.reduce((s, e) => s + (e.rothConv || 0), 0),
            meanIraWdIRAyrs: iv.length ? iv.reduce((s, e) => s + (e.IRAwd || 0), 0) / iv.length : 0,
            iraWdLife: res.log.reduce((s, e) => s + (e.IRAwd || 0), 0),
        };
    }
    return row;
}
function s1Score(r, sharedRate) {
    if (!r.totals?.terminal) return;
    r.afterTaxNW = afterTaxNetWorth(r.totals.terminal, sharedRate, r.totals.capGainsRate);
    const defl = (r.finalNW && r.finalNW !== 0) ? (r.finalNWCurrentDollars / r.finalNW) : 1;
    r.afterTaxNWCurrentDollars = r.afterTaxNW * defl;
    r._baselineScore = (r.afterTaxNWCurrentDollars ?? 0)
        + SPENDABLE_WEIGHT * (r.totals.spendCurrentDollars ?? 0);
}
function s1Cells(extra = {}, basisFrac = null) {
    const cells = [];
    for (const mix of S1_MIXES) for (const w of S1_WEALTH) {
        const scaled = {};
        for (const a of S1_ACCTS) scaled[a] = Math.round(mix.over[a] * w);
        // Basis-axis arm (2026-08-10): override the mix's basis fraction (defaults 43-56%).
        if (basisFrac != null) scaled.BrokerageBasis = Math.round(scaled.Brokerage * basisFrac);
        for (const sr of S1_RATES) {
            const cellBase = { ...S1_COMMON, ...scaled, ...extra,
                               spendGoal: Math.round(s1Total(scaled) * sr) };
            const acaDisabled = bothOnMedicareAtStart(cellBase.birthyear1, cellBase.startAge,
                !!cellBase.hasSpouse, cellBase.hasSpouse ? (cellBase.birthyear2 || 0) : 0);
            const fams = buildStrategyFamilies(cellBase, {
                grids: OPTIMIZER_GRIDS, irmaaFamily: true, acaFamily: !acaDisabled,
                bracketResetsIRMAATier: true, markCashFunding: true,
                cashClones: cellBase.Cash > 0, offGridLast: true,
            });
            const rows = [];
            for (const f of fams) {
                let res; try { res = simulate({ ...cellBase, ...f.overrides }); } catch (e) { continue; }
                rows.push(s1MkRow(f, res));
            }
            const sharedRate = rows[0]?.totals?.futureIRARate ?? 0;
            for (const r of rows) s1Score(r, sharedRate);
            cells.push({ label: mix.key + ' x' + w + ' @' + (sr * 100) + '%',
                         mix: mix.key, w, sr, cellBase, rows, sharedRate });
            process.stdout.write('.');
        }
    }
    console.log('');
    return cells;
}

function q3(cells, label = 'shipped (legacy CashReserve: surplus parks in Cash)') {
    console.log('\n' + '='.repeat(100));
    console.log('Q3  Does cyclic ever WIN?  (family-level best cyclic clone vs best non-cyclic row,');
    console.log('    success required, spend equal within $1; scored on shared-rate baselineScore)');
    console.log('    Arm: ' + label);
    console.log('='.repeat(100));
    const famWins = {};             // family -> cells won
    const byMix = {};               // mix -> cells where ANY family's cyclic won
    let cellsAnyWin = 0, spendMoved = 0, pairs = 0;
    const topDeltas = [];
    for (const cell of cells) {
        const ok = r => r.totals?.success;
        const families = [...new Set(cell.rows.map(r => r.family))];
        let anyWin = false;
        for (const fam of families) {
            // 💵 cash clones excluded: they are a different modifier, not the cyclic A/B.
            const lin = cell.rows.filter(r => r.family === fam && !r.cyclic && r.modifier !== 'cash' && ok(r));
            const cyc = cell.rows.filter(r => r.family === fam && r.cyclic && ok(r));
            if (!lin.length || !cyc.length) continue;
            pairs++;
            const best = rs => rs.reduce((a, b) => (b._baselineScore ?? -Infinity) > (a._baselineScore ?? -Infinity) ? b : a);
            const bl = best(lin), bc = best(cyc);
            const dSpend = (bc.totals.spendCurrentDollars ?? 0) - (bl.totals.spendCurrentDollars ?? 0);
            const dNW = (bc.afterTaxNWCurrentDollars ?? 0) - (bl.afterTaxNWCurrentDollars ?? 0);
            if (Math.abs(dSpend) > 1) { spendMoved++; continue; }
            if (dNW > 1) {
                anyWin = true;
                famWins[fam] = (famWins[fam] || 0) + 1;
                topDeltas.push({ cell: cell.label, fam, dNW, dSpend,
                    cycArm: bc.param + ' [' + bc.modifier + ']', linArm: bl.param });
            }
        }
        if (anyWin) { cellsAnyWin++; byMix[cell.mix] = (byMix[cell.mix] || 0) + 1; }
    }
    console.log('\nCells where at least one family\'s cyclic beats its non-cyclic twin: ' +
        cellsAnyWin + '/' + cells.length + '   (family-pairs compared: ' + pairs +
        ', pairs skipped for spend moving: ' + spendMoved + ')');
    console.log('By mix: ' + S1_MIXES.map(m => m.key + ' ' + (byMix[m.key] || 0) + '/9').join(', '));
    console.log('By family (cells won): ' + Object.entries(famWins).sort((a, b) => b[1] - a[1])
        .map(([f, n]) => f + ' ' + n).join(', ') || 'none');
    topDeltas.sort((a, b) => b.dNW - a.dNW);
    console.log('\nLargest cyclic wins (Δ real after-tax NW at equal spend):');
    for (const t of topDeltas.slice(0, 8)) {
        console.log('  ' + t.cell.padEnd(22) + t.fam.padEnd(16) + money(t.dNW).padStart(12) +
            '   (' + t.cycArm + ' vs ' + t.linArm + ')');
    }
    // Harvest-year money-on-the-table, descriptive (question B; Stage 2 measures it causally):
    // in harvest years the discretionary IRA draw is zeroed by the branch preemption, so the
    // forgone draw is approximated by the same arm's mean draw in its IRA years.
    let hvYears = 0, hvIraWd = 0, hvConv = 0, forgone = 0, lifeWd = 0;
    const rowShare = [];
    for (const cell of cells) for (const r of cell.rows) {
        if (!r.harvest || !r.totals?.success) continue;
        hvYears += r.harvest.n;
        hvIraWd += r.harvest.iraWdHarvest;
        hvConv += r.harvest.convHarvest;
        const f = r.harvest.n * r.harvest.meanIraWdIRAyrs;
        forgone += f;
        lifeWd += r.harvest.iraWdLife;
        if (r.harvest.iraWdLife > 0) rowShare.push(f / r.harvest.iraWdLife);
    }
    rowShare.sort((a, b) => a - b);
    const medShare = rowShare.length ? rowShare[Math.floor(rowShare.length / 2)] : 0;
    console.log('\nHarvest-year descriptive stat (successful cyclic rows, all cells pooled):');
    console.log('  harvest years: ' + hvYears + ';  IRAwd in them: ' + money(hvIraWd) +
        ';  conversions in them: ' + money(hvConv));
    console.log('  forgone IRA draw per harvest year (arm\'s own IRA-year mean): ~' +
        money(hvYears ? forgone / hvYears : 0));
    console.log('  median per-row forgone as share of the row\'s lifetime IRAwd: ' +
        (100 * medShare).toFixed(1) + '%  [descriptive only -- the causal number is Stage 2\'s q6()]');
    return { cellsAnyWin, byMix, famWins, nCells: cells.length };
}

function q4(cells) {
    console.log('\n' + '='.repeat(100));
    console.log('Q4  cycleLTCGTarget 0.15 vs 0.20 -- is the nerdknob hiding a real lever?');
    console.log('='.repeat(100));
    let moved = 0, pairs = 0, spendMoved = 0;
    const deltas = [];             // { cell, sr, arm, dNW, dPct, dSpend }
    for (const cell of cells) {
        for (const r of cell.rows) {
            if (!r.cyclic || !r.totals?.success) continue;
            let res20;
            try { res20 = simulate({ ...cell.cellBase, ...r.overrides, cycleLTCGTarget: 0.20 }); }
            catch (e) { continue; }
            const r20 = s1MkRow({ family: r.family, modifier: r.modifier, paramLabel: r.param,
                                  overrides: r.overrides }, res20);
            s1Score(r20, cell.sharedRate);
            if (!r20.totals?.success) continue;
            pairs++;
            const dSpend = (r20.totals.spendCurrentDollars ?? 0) - (r.totals.spendCurrentDollars ?? 0);
            const dNW = (r20.afterTaxNWCurrentDollars ?? 0) - (r.afterTaxNWCurrentDollars ?? 0);
            const dPct = Math.abs(dNW) / Math.max(1, Math.abs(r.afterTaxNWCurrentDollars ?? 1));
            if (Math.abs(dSpend) > 1) spendMoved++;
            if (Math.abs(dNW) > 1) { moved++; deltas.push({ cell: cell.label, sr: cell.sr,
                arm: r.family + ' ' + r.param + ' [' + r.modifier + ']', dNW, dPct, dSpend }); }
        }
        process.stdout.write('.');
    }
    console.log('\n\nPairs compared: ' + pairs + ';  pairs where 0.20 moved anything > $1: ' + moved +
        ';  pairs where spend moved: ' + spendMoved);
    deltas.sort((a, b) => Math.abs(b.dNW) - Math.abs(a.dNW));
    console.log('Largest |Δ| (0.20 minus 0.15, real after-tax NW):');
    for (const d of deltas.slice(0, 10)) {
        console.log('  ' + d.cell.padEnd(22) + d.arm.padEnd(34) + money(d.dNW).padStart(12) +
            ('(' + (100 * d.dPct).toFixed(2) + '%)').padStart(9) +
            (Math.abs(d.dSpend) > 1 ? '  spend ' + money(d.dSpend) : ''));
    }
    const nonHigh = deltas.filter(d => d.sr < 0.08);
    const maxPctNonHigh = nonHigh.length ? Math.max(...nonHigh.map(d => d.dPct)) : 0;
    const winners20 = deltas.filter(d => d.dNW > 1).length;
    console.log('Pairs where 0.20 WINS: ' + winners20 + ' of ' + pairs +
        ';  max |Δ%| in 4/6%-spend cells: ' + (100 * maxPctNonHigh).toFixed(2) + '%');
    return { pairs, moved, deltas, maxPctNonHigh };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Q5/Q6 (P32f / P32i) -- the cycleHarvestMode and cycleCoexist A/Bs. Both sides of each pair are
// CYCLIC, so the q3 surplus-routing confound cancels: the only difference is the research input.
//
// PREDICTIONS (S2-P1..P3), recorded before the numbers were looked at:
//   S2-P1. bracketfill >= off in >=80% of successful cyclic pairs at equal spend; median gain
//          < 2% of final real after-tax NW (harvest years are 1-in-N of the horizon).
//   S2-P2. Coexist gains scale with harvest frequency: largest in thirds/brokheavy (N~1),
//          negligible in the defaults mixes (N~14, rare harvests).
//   S2-P3. maxbracket beats spendonly in >=70% of pairs (0%-LTCG step-up is nearly free);
//          spendonly wins concentrate where the MAGI side (IRMAA / SS phase-in) bites.
// ════════════════════════════════════════════════════════════════════════════════════════════════
function runAB(cells, name, extraOver, armFilter) {
    console.log('\n' + '='.repeat(100));
    console.log(name);
    console.log('='.repeat(100));
    const perMix = {};   // mix -> { pairs, wins, losses, deltas[] }
    const all = [];
    for (const cell of cells) {
        for (const r of cell.rows) {
            if (!r.cyclic || !r.totals?.success) continue;
            if (armFilter && !armFilter(r)) continue;
            let resB;
            try { resB = simulate({ ...cell.cellBase, ...r.overrides, ...extraOver }); }
            catch (e) { continue; }
            const b = s1MkRow({ family: r.family, modifier: r.modifier, paramLabel: r.param,
                                overrides: r.overrides }, resB);
            s1Score(b, cell.sharedRate);
            if (!b.totals?.success) continue;
            const dSpend = (b.totals.spendCurrentDollars ?? 0) - (r.totals.spendCurrentDollars ?? 0);
            if (Math.abs(dSpend) > 1) continue;   // (spend, wealth) pair rule: equal spend only
            const dNW = (b.afterTaxNWCurrentDollars ?? 0) - (r.afterTaxNWCurrentDollars ?? 0);
            const dPct = dNW / Math.max(1, Math.abs(r.afterTaxNWCurrentDollars ?? 1));
            const m = perMix[cell.mix] = perMix[cell.mix] || { pairs: 0, wins: 0, losses: 0, deltas: [] };
            m.pairs++; m.deltas.push(dNW);
            if (dNW > 1) m.wins++; else if (dNW < -1) m.losses++;
            all.push({ cell: cell.label, mix: cell.mix, sr: cell.sr,
                       arm: r.family + ' ' + r.param + ' [' + r.modifier + ']', dNW, dPct });
        }
        process.stdout.write('.');
    }
    console.log('\n\nmix          pairs   B wins   B loses   median Δ       max Δ        min Δ');
    for (const mix of S1_MIXES.map(m => m.key)) {
        const m = perMix[mix]; if (!m) continue;
        const ds = m.deltas.slice().sort((a, b) => a - b);
        const med = ds.length ? ds[Math.floor(ds.length / 2)] : 0;
        console.log(mix.padEnd(13) + String(m.pairs).padStart(5) + String(m.wins).padStart(9) +
            String(m.losses).padStart(10) + money(med).padStart(11) +
            money(ds[ds.length - 1] ?? 0).padStart(13) + money(ds[0] ?? 0).padStart(13));
    }
    all.sort((a, b) => b.dNW - a.dNW);
    console.log('Largest B-side wins:');
    for (const t of all.slice(0, 6)) {
        console.log('  ' + t.cell.padEnd(22) + t.arm.padEnd(36) + money(t.dNW).padStart(12) +
            ('(' + (100 * t.dPct).toFixed(2) + '%)').padStart(9));
    }
    console.log('Largest B-side losses:');
    for (const t of all.slice(-3).reverse()) {
        console.log('  ' + t.cell.padEnd(22) + t.arm.padEnd(36) + money(t.dNW).padStart(12) +
            ('(' + (100 * t.dPct).toFixed(2) + '%)').padStart(9));
    }
    return { perMix, all };
}

// ── Main ────────────────────────────────────────────────────────────────────────────────────────
console.log('P32 brokerage harness');
console.log('Engine: optimizer_core.js  |  scenarios: ' + SCENARIOS.length + '  arms: ' + ARMS.length);
const q1r = q1();
audit();
const q2r = q2();

console.log('\n' + '='.repeat(100));
console.log('PREDICTION SCORING');
console.log('='.repeat(100));
const fam = q1r.byFamily;
const share = f => fam[f] ? (100 * fam[f].drawYrs / fam[f].yrs) : NaN;
const firstYr = f => fam[f] && fam[f].firstN ? fam[f].firstSum / fam[f].firstN : NaN;
console.log('P1 baseline highest+earliest : baseline ' + share('baseline').toFixed(1) + '% @yr ' +
            firstYr('baseline').toFixed(1) + '  vs bracket ' + share('bracket').toFixed(1) + '% @yr ' +
            firstYr('bracket').toFixed(1) + '   -> ' +
            (share('baseline') > share('bracket') ? 'RIGHT' : 'WRONG'));
console.log('P2 bracket lower and later   : ' +
            (firstYr('bracket') > firstYr('baseline') ? 'RIGHT' : 'WRONG'));
const armShare = an => {
    const rs = q1r.rows.filter(r => r.arm === an);
    return 100 * rs.reduce((s, r) => s + r.drawYears, 0) / rs.reduce((s, r) => s + r.years, 0);
};
console.log('P3 BIRC > CBIR > RIBC        : BIRC ' + armShare('ord-BIRC').toFixed(1) + '%  CBIR ' +
            armShare('ord-CBIR').toFixed(1) + '%  RIBC ' + armShare('ord-RIBC').toFixed(1) + '%  -> ' +
            (armShare('ord-BIRC') >= armShare('ord-CBIR') && armShare('ord-CBIR') >= armShare('ord-RIBC')
                ? 'RIGHT' : 'WRONG'));
const neverRows = q1r.rows.filter(r => r.neverDrew);
console.log('P4 never-drawing rows rare   : ' + neverRows.length + '/' + q1r.rows.length +
            (neverRows.length ? '  [' + neverRows.map(r => r.scen + '/' + r.arm).join(', ') + ']' : ''));
if (q2r) {
    // P5 is scored on CAPPED years alone. Stalled years are the account running out of usable
    // money, not the cap-gains spiral, and summing the two would score P5 WRONG on arithmetic that
    // has nothing to do with the prediction.
    console.log('P5 no divergence             : capped=' + q2r.totalCapped +
                ' (stalled=' + q2r.totalStalled + ', not spiral evidence) worstIters=' +
                q2r.worstIter + '  -> ' + (q2r.totalCapped === 0 ? 'RIGHT' : 'WRONG'));
    // P6 named the THIRD-PASS arm ("allowing Brokerage in the third pass eliminates the pinned
    // minlimit stranding"). Scoring it against the pooled total lets the backstop arm, which P6
    // never mentioned, decide the verdict. Scored per arm instead.
    const scoreArm = qn => {
        let bt = 0, ws = 0;
        for (const o of q2r.out.filter(x => x.qn === qn)) {
            const b = q2r.out.find(x => x.qn === 'off' && x.sn === o.sn && x.an === o.an &&
                                        x.basis === o.basis && x.st === o.st && x.dv === o.dv);
            if (!b || o.funded === b.funded) continue;
            if (o.funded < b.funded) ws++; else bt++;
        }
        return { bt, ws };
    };
    const tp = scoreArm('bounded'), bf = scoreArm('brokFirst');
    console.log('P6 third pass ends stranding : better=' + tp.bt + ' worse=' + tp.ws +
                '  -> ' + (tp.bt > 0 && tp.bt > tp.ws ? 'RIGHT' : tp.bt > 0 ? 'MIXED' : 'WRONG'));
    console.log('   brokFirst (NOT named by P6) : better=' + bf.bt + ' WORSE=' + bf.ws +
                '  -> its own decision, scored separately');
} else {
    console.log('P5/P6                        : not testable (see the Q2 SKIP note above)');
}
console.log('');

// ── Q3/Q4 over the Stage-1 grid ─────────────────────────────────────────────────────────────────
console.log('Building the 45-cell Stage-1 grid (Optimizer enumeration per cell)...');
const s1cells = s1Cells();
const q3r = q3(s1cells);

// CONFOUND CONTROL. A cyclic clone differs from its twin in THREE ways: harvest-year branch
// preemption, surplus reinvested into Brokerage instead of Cash (:2065), and forced DRIP (:2499 --
// inert here, S1_COMMON already sets dividendReinvest true). Under legacy CashReserve the
// non-cyclic arm parks every surplus dollar in Cash at cashYield while cyclic compounds it at
// growth -- the exact surplus-cash-drag P2's Cash Reserve documented. CashReserve: 0 puts the
// NON-cyclic arms on reinvest-all-surplus-to-Brokerage too, so this run isolates the harvest
// mechanics from the routing side effect. (Cash Reserve floor is disabled under cyclic (:1399),
// so the cyclic arms are unchanged between the two runs.)
console.log('\nRebuilding the grid with CashReserve: 0 (surplus-routing confound removed)...');
const s1cellsR0 = s1Cells({ CashReserve: 0 });
const q3r0 = q3(s1cellsR0, 'CashReserve: 0 control (both arms reinvest surplus into Brokerage)');

const q4r = q4(s1cells);

// Q5: spendonly vs maxbracket, every cyclic arm. Q6: coexist off vs bracketfill, v1 families only.
const V1_FAMILIES = new Set(['Fill Bracket', 'IRMAA Ceil', 'ACA Cliff', 'IRA Draw']);
const q5r = runAB(s1cells,
    'Q5  cycleHarvestMode: maxbracket (A, shipped) vs spendonly (B) -- does maxing the bracket pay?',
    { cycleHarvestMode: 'spendonly' }, null);
const q6r = runAB(s1cells,
    'Q6  cycleCoexist: off (A, shipped) vs bracketfill (B) -- what do harvest-year IRA draws reclaim?',
    { cycleCoexist: 'bracketfill' }, r => V1_FAMILIES.has(r.family));

console.log('\n' + '='.repeat(100));
console.log('PREDICTION SCORING  (S2-P1..P3, recorded before the numbers were looked at)');
console.log('='.repeat(100));
{
    const q6all = q6r.all;
    const noHarm = q6all.filter(t => t.dNW >= -1).length;
    const ds = q6all.map(t => t.dPct).slice().sort((a, b) => a - b);
    const medPct = ds.length ? ds[Math.floor(ds.length / 2)] : 0;
    console.log('S2-P1 bracketfill no-harm >=80%, median gain <2%: no-harm ' + noHarm + '/' +
        q6all.length + ' (' + (q6all.length ? (100 * noHarm / q6all.length).toFixed(0) : 0) +
        '%), median Δ ' + (100 * medPct).toFixed(2) + '% -> ' +
        ((q6all.length && noHarm / q6all.length >= 0.8 && Math.abs(medPct) < 0.02) ? 'RIGHT' : 'WRONG'));
    const mixMean = mix => {
        const xs = q6all.filter(t => t.mix === mix).map(t => t.dNW);
        return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    };
    const heavy = (mixMean('thirds') + mixMean('brokheavy')) / 2;
    const light = (mixMean('defaults') + mixMean('defaults3x')) / 2;
    console.log('S2-P2 gains scale with harvest frequency: mean Δ thirds/brokheavy ' +
        money(heavy) + ' vs defaults mixes ' + money(light) + ' -> ' +
        (heavy > light ? 'RIGHT' : 'WRONG'));
    const q5all = q5r.all;
    const maxbWins = q5all.filter(t => t.dNW < -1).length;   // B=spendonly loses => maxbracket wins
    console.log('S2-P3 maxbracket beats spendonly >=70%: maxbracket wins ' + maxbWins + '/' +
        q5all.length + ' (' + (q5all.length ? (100 * maxbWins / q5all.length).toFixed(0) : 0) +
        '%) -> ' + ((q5all.length && maxbWins / q5all.length >= 0.7) ? 'RIGHT' : 'WRONG'));
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// BASIS-AXIS EXTENSION (2026-08-10, user request). The Stage-1 grid's basis fraction never left
// 43-56%; rebuild at 20% (highly appreciated) and 80% (mostly contributions) and re-run the
// basis-sensitive A/Bs. q3 runs on its CashReserve:0 CONTROL form only (the legacy form is the
// known routing confound; no reason to propagate it to new arms). Q1 ladder deliberately stays
// at 50% basis - its role is comparability with the pre-fix record.
//
// PREDICTIONS (B-P1..B-P3), recorded before the numbers were looked at:
//   B-P1. q4: the 0.20-target losses GROW at 20% basis (more gain per harvested dollar, all of
//         it erased by the terminal step-up) and shrink toward inert at 80% basis.
//   B-P2. q6: coexist's median is MORE negative at 20% basis; the IRA Draw 5-8% gains persist
//         at both extremes.
//   B-P3. q5: spendonly's win share grows at 20% basis and falls toward parity at 80% (the
//         top-off is nearly free when there is little gain to realize).
// ════════════════════════════════════════════════════════════════════════════════════════════════
console.log('\nBASIS AXIS: rebuilding the grid at basis 20% and 80%...');
const cellsB20 = s1Cells({}, 0.2);
const cellsB80 = s1Cells({}, 0.8);
console.log('q3 control at each basis arm:');
const cellsB20R0 = s1Cells({ CashReserve: 0 }, 0.2);
const q3b20 = q3(cellsB20R0, 'basis 20%, CashReserve: 0 control');
const cellsB80R0 = s1Cells({ CashReserve: 0 }, 0.8);
const q3b80 = q3(cellsB80R0, 'basis 80%, CashReserve: 0 control');
const q4b20 = q4(cellsB20);
const q4b80 = q4(cellsB80);
const q5b20 = runAB(cellsB20, 'Q5 @ basis 20%: maxbracket (A) vs spendonly (B)',
    { cycleHarvestMode: 'spendonly' }, null);
const q5b80 = runAB(cellsB80, 'Q5 @ basis 80%: maxbracket (A) vs spendonly (B)',
    { cycleHarvestMode: 'spendonly' }, null);
const q6b20 = runAB(cellsB20, 'Q6 @ basis 20%: coexist off (A) vs bracketfill (B)',
    { cycleCoexist: 'bracketfill' }, r => V1_FAMILIES.has(r.family));
const q6b80 = runAB(cellsB80, 'Q6 @ basis 80%: coexist off (A) vs bracketfill (B)',
    { cycleCoexist: 'bracketfill' }, r => V1_FAMILIES.has(r.family));

console.log('\n' + '='.repeat(100));
console.log('PREDICTION SCORING  (B-P1..B-P3, recorded before the numbers were looked at)');
console.log('='.repeat(100));
{
    const maxLoss = q => q.deltas.length ? Math.max(...q.deltas.map(d => -d.dNW)) : 0;
    console.log('B-P1 q4 losses grow at 20%, shrink at 80%: max loss b20 ' + money(maxLoss(q4b20)) +
        ' vs b50ish ' + money(maxLoss(q4r)) + ' vs b80 ' + money(maxLoss(q4b80)) +
        ';  moved pairs ' + q4b20.moved + ' / ' + q4r.moved + ' / ' + q4b80.moved + ' -> ' +
        ((maxLoss(q4b20) > maxLoss(q4r) && maxLoss(q4b80) < maxLoss(q4r)) ? 'RIGHT' : 'WRONG'));
    const med = ab => {
        const ds = ab.all.map(t => t.dNW).sort((a, b) => a - b);
        return ds.length ? ds[Math.floor(ds.length / 2)] : 0;
    };
    const q6med = med(q6r), q6med20 = med(q6b20), q6med80 = med(q6b80);
    const iraDrawGain = ab => Math.max(0, ...ab.all.filter(t => t.arm.startsWith('IRA Draw')).map(t => t.dNW));
    console.log('B-P2 q6 median more negative at 20%: ' + money(q6med20) + ' vs ' + money(q6med) +
        ' vs b80 ' + money(q6med80) + ';  IRA Draw best gain b20 ' + money(iraDrawGain(q6b20)) +
        ' b80 ' + money(iraDrawGain(q6b80)) + ' -> ' +
        ((q6med20 < q6med && iraDrawGain(q6b20) > 1 && iraDrawGain(q6b80) > 1) ? 'RIGHT' : 'WRONG'));
    const winShare = ab => {
        const w = ab.all.filter(t => t.dNW > 1).length;
        return ab.all.length ? w / ab.all.length : 0;
    };
    console.log('B-P3 q5 spendonly win share b20 > default > b80: ' +
        (100 * winShare(q5b20)).toFixed(0) + '% / ' + (100 * winShare(q5r)).toFixed(0) + '% / ' +
        (100 * winShare(q5b80)).toFixed(0) + '% -> ' +
        ((winShare(q5b20) > winShare(q5r) && winShare(q5b80) < winShare(q5r)) ? 'RIGHT' : 'WRONG'));
    console.log('q3-control cyclic wins by basis: b20 ' + q3b20.cellsAnyWin + '/45, default ' +
        q3r0.cellsAnyWin + '/45, b80 ' + q3b80.cellsAnyWin + '/45');
}

console.log('\n' + '='.repeat(100));
console.log('PREDICTION SCORING  (S1-P2..P4, recorded before the numbers were looked at)');
console.log('='.repeat(100));
const winFrac = q3r.cellsAnyWin / q3r.nCells;
const heavyMixWins = (q3r.byMix['thirds'] || 0) + (q3r.byMix['brokheavy'] || 0);
const allMixWins = Object.values(q3r.byMix).reduce((a, b) => a + b, 0);
console.log('S1-P2 cyclic wins <15% of cells : ' + q3r.cellsAnyWin + '/' + q3r.nCells + ' (' +
    (100 * winFrac).toFixed(0) + '%) -> ' + (winFrac < 0.15 ? 'RIGHT' : 'WRONG') +
    ';  concentration in thirds/brokheavy: ' + heavyMixWins + '/' + (allMixWins || 1) + ' of wins');
console.log('      confound check           : with CashReserve:0 removing the surplus-routing ' +
    'side effect, cyclic wins ' + q3r0.cellsAnyWin + '/' + q3r0.nCells + ' cells (vs ' +
    q3r.cellsAnyWin + ' under legacy routing)');
console.log('S1-P3 0.20 inert off 8% spend   : max |Δ%| in 4/6% cells = ' +
    (100 * q4r.maxPctNonHigh).toFixed(2) + '% -> ' + (q4r.maxPctNonHigh < 0.01 ? 'RIGHT' : 'WRONG'));
// S1-P4: Q1 on the corrected engine vs the pre-fix record (2026-08-06 run, double-crediting engine).
const PREFIX_Q1 = { baseline: 90.4, bracket: 61.1, cyclic: 57.5, ordered: 44.7 };
console.log('S1-P4 draw frequency rises vs pre-fix engine, never-draw stays 0:');
let p4Right = true;
for (const [f, prev] of Object.entries(PREFIX_Q1)) {
    const v = fam[f]; if (!v) continue;
    const now = 100 * v.drawYrs / v.yrs;
    const up = now > prev;
    if (!up) p4Right = false;
    console.log('   ' + f.padEnd(10) + prev.toFixed(1) + '% -> ' + now.toFixed(1) + '%  ' +
        (up ? 'UP' : 'DOWN/FLAT'));
}
const neverNow = q1r.rows.filter(r => r.neverDrew).length;
if (neverNow !== 0) p4Right = false;
console.log('   never-draw rows now: ' + neverNow + '  ->  S1-P4 overall ' +
    (p4Right ? 'RIGHT' : 'WRONG'));
console.log('');
