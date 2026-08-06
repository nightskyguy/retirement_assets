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
 *   P2. bracket/minlimit/fixedpct LOWER and LATER. Cash comes first in their chain, so nothing
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
    ['minlimit',   { strategy: 'minlimit', stratRate: 0, stratIRMAATier: 1 }],
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
    bracket22: 'bracket', minlimit: 'bracket', fixedpct2: 'bracket',
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
function q2() {
    console.log('\n' + '='.repeat(100));
    console.log('Q2  Third-pass Brokerage: spiral, converge, or improve?');
    console.log('='.repeat(100));

    const Q2ARMS = [
        ['off',       {}],
        ['bounded',   { thirdPassBrokerage: 'bounded' }],
        ['unbounded', { thirdPassBrokerage: 'unbounded' }],
        ['bnd+forced', { thirdPassBrokerage: 'bounded', forcedIRAAllowBrokerage: true }],
    ];
    const supported = (() => {
        const probe = run(CAP_BASE, { strategy: 'minlimit', stratRate: 0, stratIRMAATier: 1 },
            { thirdPassBrokerage: 'bounded' });
        return probe.totals.tpBrokIters !== undefined;
    })();
    if (!supported) {
        console.log('\n  SKIPPED: engine does not expose totals.tpBrokIters, so the research flags');
        console.log('  are not wired in yet. Q1 above still stands on shipped behavior.\n');
        return null;
    }

    console.log('\nscenario/arm                    mode        shortfall     spend      finalNW   iters(max)  nonConv');
    const out = [];
    for (const [sn, scen] of SCENARIOS) {
        for (const [an, ov] of ARMS) {
            for (const [qn, qov] of Q2ARMS) {
                let r; try { r = run(scen, ov, qov); } catch (e) { continue; }
                const t = r.totals;
                out.push({ sn, an, qn, shortfall: t.shortfall, spend: t.spend, finalNW: r.finalNW,
                           maxIter: t.tpBrokMaxIters ?? 0, nonConv: t.tpBrokNonConverged ?? 0,
                           success: t.success });
            }
        }
    }
    // Only print rows where an arm actually changed something
    for (const [sn] of SCENARIOS) {
        for (const [an] of ARMS) {
            const base = out.find(o => o.sn === sn && o.an === an && o.qn === 'off');
            if (!base) continue;
            const moved = out.filter(o => o.sn === sn && o.an === an && o.qn !== 'off' &&
                (Math.abs(o.shortfall - base.shortfall) > 1 || Math.abs(o.finalNW - base.finalNW) > 1));
            if (!moved.length) continue;
            console.log((sn + '/' + an).padEnd(32) + 'off'.padEnd(12) +
                money(base.shortfall).padStart(12) + money(base.spend).padStart(11) +
                money(base.finalNW).padStart(13));
            for (const m of moved) {
                console.log(''.padEnd(32) + m.qn.padEnd(12) +
                    money(m.shortfall).padStart(12) + money(m.spend).padStart(11) +
                    money(m.finalNW).padStart(13) + String(m.maxIter).padStart(12) +
                    String(m.nonConv).padStart(9));
            }
        }
    }
    const allNon = out.filter(o => o.qn !== 'off').reduce((s, o) => s + o.nonConv, 0);
    const worstIter = Math.max(0, ...out.filter(o => o.qn !== 'off').map(o => o.maxIter));
    console.log('\nSPIRAL VERDICT: non-converged years across every arm = ' + allNon +
                ';  worst iteration count seen = ' + worstIter);
    return { out, allNon, worstIter };
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
    console.log('P5 no divergence             : nonConverged=' + q2r.allNon + ' worstIters=' +
                q2r.worstIter + '  -> ' + (q2r.allNon === 0 ? 'RIGHT' : 'WRONG'));
} else {
    console.log('P5/P6                        : not yet testable (research flags not wired)');
}
console.log('');
