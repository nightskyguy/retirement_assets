'use strict';
/**
 * timingtrigger_harness.js -- P28jf. Does the automatic withdrawal-timing trigger ever pay,
 * on the POST-P28jg engine?
 *
 * Run:  node .test_harnesses/timingtrigger_harness.js
 *
 * THE RULE UNDER TEST (optimizer_core.js:1457):
 *     yr._useEarly = y === 0 ? _stratImpliesConversion : (_prevConv > threshold)   // threshold 1000
 * Early means preMonths = 1: the whole year's SPENDING withdrawal exits in January and the rest of
 * the portfolio compounds for eleven months. Late means preMonths = 11. So one dollar of conversion
 * past the threshold moves a whole year's spending draw by ten months, and keeps moving it for every
 * year the flag stays flipped.
 *
 * WHY IT IS BEING RE-ASKED. P28ja measured this pre-P28jg and found late beating early 35 of 39 live
 * cells, the flip never once paying. Those numbers are STALE: P28jg (v11.1734) fixed a converted
 * dollar earning no growth in its conversion year, which is the mechanism that made early-vs-late
 * look catastrophic in the first place. Three research tables in this repo have stopped reproducing
 * after an engine change (P28 round 2, P30's ladder, P28j itself), so the claim is re-measured
 * rather than carried forward.
 *
 * AND THE FIX REMOVED THE TRIGGER'S OWN JUSTIFICATION. The trigger exists so that a conversion year
 * gets money out early and the Roth compounds. Post-P28jg the conversion month is growth-neutral
 * deterministically (IRA and Roth carry the same rate; preMonths + postMonths = 12; verified to the
 * cent on a conversion-only fixture). If that is right, the trigger has no upside left and only the
 * cost side of moving the SPENDING draw, which is a different leg entirely.
 *
 * ARMS, three, one axis, everything else equalized:
 *   AUTO   forceWithdrawTiming unset  -- today's shipped behavior
 *   EARLY  forceWithdrawTiming:'early'
 *   LATE   forceWithdrawTiming:'late'
 *
 * -- PREDICTIONS, registered before the numbers were looked at ---------------------------------
 *   T1. AUTO never beats LATE in any cell where the trigger actually fires. This is the one that
 *       decides P28jf: if it holds, "drop the trigger, default late" is supported; if it breaks,
 *       the trigger is buying something and the decision needs the threshold sweep (P28je).
 *   T2. LATE beats EARLY in the large majority of cells. Not "always" - the withdrawal month moves
 *       the December 31 balance, which is the next year's RMD basis (P84l), so a tax path exists
 *       that could run the other way. An EARLY win is a finding to explain, not a scorer bug.
 *   T3. PLUMBING CHECK. In any cell where the trigger never fires, AUTO and LATE are identical to
 *       the cent. If this breaks the arms differ for some reason other than timing and the run is
 *       VOID, not merely suspect.
 *   T4. The AUTO-minus-LATE gap grows with the number of Early years the trigger fires.
 *
 * FIXTURES SET THE IRA GOAL EXPLICITLY, and this is not boilerplate. P85's 124 counterexamples came
 * from `iraBaseGoal: 0` inherited from another harness against a shipped default of $750,000. The
 * COMMON block below is copied from unifiedconv_harness.js and carries the 0. The headline grid
 * therefore runs at the SHIPPED DEFAULT and the whole grid is re-run at 0 as a robustness pass, with
 * both printed. A verdict that depends on which one you inherited is a finding, not a footnote.
 *
 * SPEND IS VERIFIED, NOT ASSUMED. Timing moves delivered spend (P28jd). Non-GK arms are scored only
 * where delivered spend matches to the dollar; Guyton-Klinger moves the spend goal BY DESIGN, so GK
 * cells carry delivered spend as a reported column and are scored in their own block.
 */

// -- Bootstrap the engine exactly like phased_harness.js / optimizer_core.tests.js -------------
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
const { simulate } = core;

const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString();
const pct = n => (n * 100).toFixed(3) + '%';

// -- Base plan: unifiedconv_harness.js COMMON, copied verbatim (iraBaseGoal overridden below) --
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

// P28 mix ladder, copied verbatim from unifiedconv_harness.js:79-106.
const MIXES = [
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
const WEALTH = [0.5, 1, 3];
const SPEND_RATES = [0.04, 0.06, 0.08];
const ACCTS = ['IRA1', 'IRA2', 'Roth', 'Roth2', 'Brokerage', 'BrokerageBasis', 'Cash'];
const totalAssets = o => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;

// Strategy axis, and it is NOT optional. Whether the trigger fires at all is a property of the
// STRATEGY, not of the household (the P28jb note at optimizer_core.js:1448): Fill Bracket's smallest
// conversion on one fixture was $27,365 so the $1,000 constant is inert for it, while Proportional's
// were every one under $1,000 so that plan never flips today. A grid without both would look
// decisive or flat for reasons that have nothing to do with the trigger.
const STRATEGIES = [
    { key: 'bracket22', over: { strategy: 'bracket', stratRate: 0.22 } },
    { key: 'reduce11',  over: { strategy: 'fixed', nYears: 11 } },
    { key: 'iradraw9',  over: { strategy: 'fixedpct', iraWithdrawPct: 0.09 } },
    { key: 'prop10',    over: { strategy: 'propwd', propWithdraw: 0.10 } },
    { key: 'gk',        over: { strategy: 'gk' } },
    { key: 'ordered',   over: { strategy: 'ordered', orderedSeq: 'CIBR' } },
];

const ARMS = [
    { key: 'auto',  over: {} },
    { key: 'early', over: { forceWithdrawTiming: 'early' } },
    { key: 'late',  over: { forceWithdrawTiming: 'late' } },
];

function runOne(inputs) {
    let res;
    try { res = simulate(inputs); } catch (e) { return { threw: String((e && e.message) || e) }; }
    const log = res.log || [];
    const last = log[log.length - 1];
    if (!last) return { threw: 'empty log' };
    const earlyYears = log.filter(e => String(e.timing || '').startsWith('Early')).length;
    const infl = last.inflationFactor || 1;
    // The trigger is a CONVERSION-motivated rule, so it has to be scored on conversion outcomes and
    // not only on wealth. The first version of this harness captured neither, which meant it never
    // tested the trigger's own claim - the same species of error this repo keeps cataloguing
    // (scoring the nearest convenient statistic). Roth is deflated by the row's own inflationFactor
    // for the reason P106's unit error records: a nominal Roth against a real net worth inflates
    // every ratio by the deflator.
    return {
        nwReal: last.totalNetWealth / infl,
        rothReal: ((last.Roth1 || 0) + (last.Roth2 || 0)) / infl,
        convGross: log.reduce((s, e) => s + (e['-iraConvGrossTot'] || 0), 0),
        spend: res.totals ? res.totals.spend : null,
        tax: res.totals ? res.totals.tax : null,
        success: res.totals ? !!res.totals.success : false,
        earlyYears, years: log.length,
    };
}

const cellId = c => ({ id: c.strat + '/' + c.mix + '/x' + c.w + '/' + (c.sr * 100).toFixed(0) + '%' });

function runGrid(goal, label) {
    const cells = [];
    for (const mix of MIXES) for (const w of WEALTH) for (const sr of SPEND_RATES) {
        const over = {};
        for (const a of ACCTS) over[a] = (mix.over[a] || 0) * w;
        const spendGoal = totalAssets(over) * sr;
        for (const st of STRATEGIES) {
            const base = { ...COMMON, ...over, ...st.over, iraBaseGoal: goal, spendGoal };
            const out = {};
            for (const arm of ARMS) out[arm.key] = runOne({ ...base, ...arm.over });
            cells.push({ mix: mix.key, w, sr, strat: st.key, out });
        }
    }
    return { label, goal, cells };
}

function score(grid) {
    const R = { label: grid.label, goal: grid.goal, total: grid.cells.length,
                threw: 0, failed: 0, spendMismatch: 0, inert: 0, fires: 0,
                t1Break: [], t3Break: [], earlyWins: [], scored: 0, gkScored: 0,
                autoMinusLate: [], earlyMinusLate: [], byEarlyYears: new Map(),
                firesByStrat: new Map(), autoOnlyFails: [], earlyOnlyFails: [], lateOnlyFails: [],
                autoWorseBoth: [], autoBetterBoth: [], autoTrades: [] };
    for (const c of grid.cells) {
        const a = c.out.auto, e = c.out.early, l = c.out.late;
        if (a.threw || e.threw || l.threw) { R.threw++; continue; }
        // A cell where the arms disagree about SURVIVAL is the strongest result this grid can
        // carry, and dropping it silently would bias every remaining number toward plans robust
        // enough that timing could not break them. Counted and named before anything is excluded.
        if (!a.success || !e.success || !l.success) {
            R.failed++;
            if (l.success && !a.success) R.autoOnlyFails.push(cellId(c));
            if (l.success && !e.success) R.earlyOnlyFails.push(cellId(c));
            if (!l.success && (a.success || e.success)) R.lateOnlyFails.push(cellId(c));
            continue;
        }
        const isGK = c.strat === 'gk';
        const spendOK = Math.abs(a.spend - l.spend) < 1 && Math.abs(e.spend - l.spend) < 1;
        // Timing moves delivered spend (P28jd). A cell where AUTO delivers LESS spend than LATE is
        // not a tie to drop: if its wealth is also lower it is strictly worse on both, and saying so
        // costs nothing. Reported by direction, then excluded from the wealth-only scoring.
        if (!spendOK && !isGK) {
            R.spendMismatch++;
            const dS = a.spend - l.spend, dW = a.nwReal - l.nwReal;
            if (dS < -1 && dW < -0.01) R.autoWorseBoth.push({ ...cellId(c), dS, dW });
            else if (dS > 1 && dW > 0.01) R.autoBetterBoth.push({ ...cellId(c), dS, dW });
            else R.autoTrades.push({ ...cellId(c), dS, dW });
            continue;
        }
        const dAutoLate = a.nwReal - l.nwReal;
        const dEarlyLate = e.nwReal - l.nwReal;
        // T3: the trigger never fires -> AUTO must BE late, to the cent.
        if (a.earlyYears === 0) {
            R.inert++;
            if (Math.abs(dAutoLate) >= 0.01) R.t3Break.push({ ...cellId(c), d: dAutoLate });
            continue;
        }
        R.fires++;
        R.firesByStrat.set(c.strat, (R.firesByStrat.get(c.strat) || 0) + 1);
        if (isGK) { R.gkScored++; } else { R.scored++; }
        R.autoMinusLate.push({ ...cellId(c), d: dAutoLate, pctNW: dAutoLate / l.nwReal,
                               dSpend: a.spend - l.spend, nwLate: l.nwReal,
                               dRoth: a.rothReal - l.rothReal, rothLate: l.rothReal,
                               dConv: a.convGross - l.convGross, convLate: l.convGross,
                               eRoth: e.rothReal - l.rothReal, eConv: e.convGross - l.convGross,
                               earlyYears: a.earlyYears, years: a.years, isGK });
        R.earlyMinusLate.push({ ...cellId(c), d: dEarlyLate, pctNW: dEarlyLate / l.nwReal, isGK });
        if (!isGK && dAutoLate > 0.01) R.t1Break.push({ ...cellId(c), d: dAutoLate, earlyYears: a.earlyYears });
        if (!isGK && dEarlyLate > 0.01) R.earlyWins.push({ ...cellId(c), d: dEarlyLate });
        if (!isGK) {
            const k = a.earlyYears;
            if (!R.byEarlyYears.has(k)) R.byEarlyYears.set(k, []);
            R.byEarlyYears.get(k).push(dAutoLate / l.nwReal);
        }
    }
    return R;
}

const median = xs => { if (!xs.length) return NaN; const s = [...xs].sort((p, q) => p - q);
    const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function report(R) {
    console.log('\n' + '='.repeat(78));
    console.log(R.label + '   (iraBaseGoal = ' + money(R.goal) + ')');
    console.log('='.repeat(78));
    console.log('cells ' + R.total + ' | threw ' + R.threw + ' | failed ' + R.failed +
                ' | spend mismatch ' + R.spendMismatch);
    console.log('trigger INERT (0 Early years, AUTO==LATE by construction): ' + R.inert);
    console.log('trigger FIRES (scorable): ' + R.fires + '   non-GK ' + R.scored + ', GK ' + R.gkScored);
    const fb = [...R.firesByStrat.entries()].map(x => x[0] + ':' + x[1]).join('  ');
    console.log('fires by strategy: ' + (fb || '(none)'));

    console.log('');
    console.log('-- SURVIVAL: do the arms disagree about whether the plan works at all? --');
    console.log('   AUTO fails where LATE survives:    ' + R.autoOnlyFails.length);
    for (const x of R.autoOnlyFails.slice(0, 6)) console.log('      ' + x.id);
    console.log('   EARLY fails where LATE survives:   ' + R.earlyOnlyFails.length);
    console.log('   LATE fails where another survives: ' + R.lateOnlyFails.length);
    for (const x of R.lateOnlyFails.slice(0, 6)) console.log('      ' + x.id);

    console.log('');
    console.log('-- SPEND: cells excluded from wealth scoring because delivered spend moved --');
    console.log('   n=' + R.spendMismatch + '   AUTO worse on BOTH: ' + R.autoWorseBoth.length +
                ' | better on both: ' + R.autoBetterBoth.length +
                ' | a real trade: ' + R.autoTrades.length);
    for (const x of R.autoTrades.slice(0, 4)) {
        console.log('      TRADE ' + x.id + '  spend ' + money(x.dS) + ', wealth ' + money(x.dW));
    }
    console.log('\n-- T3 PLUMBING: AUTO must equal LATE where the trigger never fires --');
    console.log(R.t3Break.length === 0
        ? '   HELD. ' + R.inert + ' inert cells, all identical to the cent.'
        : '   *** BROKEN, RUN IS VOID *** ' + R.t3Break.length + ' inert cells differ, worst ' +
          money(Math.max.apply(null, R.t3Break.map(x => Math.abs(x.d)))));

    const nonGK = R.autoMinusLate.filter(x => !x.isGK);
    console.log('\n-- T1 THE DECIDING ONE: does AUTO ever beat LATE where the trigger fires? --');
    if (!nonGK.length) {
        console.log('   NO SCORABLE NON-GK CELLS - the grid never fires the trigger. Inconclusive.');
    } else {
        const ds = nonGK.map(x => x.d), ps = nonGK.map(x => x.pctNW);
        console.log('   AUTO beats LATE in ' + R.t1Break.length + ' of ' + nonGK.length + ' non-GK cells');
        console.log('   auto - late:  median ' + money(median(ds)) + ' (' + pct(median(ps)) + ' of NW)');
        console.log('                 worst  ' + money(Math.min.apply(null, ds)) +
                    '   best ' + money(Math.max.apply(null, ds)));
        console.log(R.t1Break.length === 0 ? '   T1 HELD - the trigger never pays.'
            : '   T1 BROKEN - ' + R.t1Break.length + ' cells where AUTO wins:');
        for (const x of R.t1Break.slice(0, 8)) {
            const row = nonGK.find(y => y.id === x.id);
            const scale = row ? '  = ' + pct(row.d / row.nwLate) + ' of a ' + money(row.nwLate) + ' plan' : '';
            console.log('      ' + x.id + '  +' + money(x.d) + '  (' + x.earlyYears + ' Early yrs)' + scale);
        }
    }

    const nonGKe = R.earlyMinusLate.filter(x => !x.isGK);
    console.log('\n-- T2: EARLY vs LATE as a pure policy --');
    if (nonGKe.length) {
        const de = nonGKe.map(x => x.d);
        console.log('   LATE beats EARLY in ' + nonGKe.filter(x => x.d < 0).length + ' of ' + nonGKe.length);
        console.log('   early - late: median ' + money(median(de)) +
                    ' (' + pct(median(nonGKe.map(x => x.pctNW))) + ' of NW)');
        console.log('                 worst  ' + money(Math.min.apply(null, de)) +
                    '   best ' + money(Math.max.apply(null, de)));
        if (R.earlyWins.length) {
            console.log('   EARLY wins in ' + R.earlyWins.length + ' cells - explain, do not dismiss:');
            for (const x of R.earlyWins.slice(0, 6)) console.log('      ' + x.id + '  +' + money(x.d));
        }
    }

    console.log('\n-- T5 THE TRIGGER ON ITS OWN TERMS: does Early buy more Roth, or convert more? --');
    const nz = R.autoMinusLate.filter(x => !x.isGK);
    if (nz.length) {
        console.log('   AUTO vs LATE, ending Roth (real):  median ' + money(median(nz.map(x => x.dRoth))) +
                    '   AUTO higher in ' + nz.filter(x => x.dRoth > 0.01).length + ' of ' + nz.length);
        console.log('   AUTO vs LATE, lifetime conv GROSS: median ' + money(median(nz.map(x => x.dConv))) +
                    '   AUTO higher in ' + nz.filter(x => x.dConv > 1).length + ' of ' + nz.length);
        console.log('   EARLY vs LATE, ending Roth (real):  median ' + money(median(nz.map(x => x.eRoth))) +
                    '   EARLY higher in ' + nz.filter(x => x.eRoth > 0.01).length + ' of ' + nz.length);
        console.log('   EARLY vs LATE, lifetime conv GROSS: median ' + money(median(nz.map(x => x.eConv))) +
                    '   EARLY higher in ' + nz.filter(x => x.eConv > 1).length + ' of ' + nz.length);
        const tradeCells = nz.filter(x => x.dRoth > 0.01 && x.d < -0.01);
        console.log('   Cells where AUTO buys MORE Roth at LESS net worth (a real trade): ' + tradeCells.length);
        // Priced the way P106 prices a conversion: dRoth per dollar of net worth given up. That
        // report's benchmark is the user's own decision at 50.08:1, and the only sub-1:1 arm it found
        // anywhere was called a bad trade. Same yardstick here, so the two are comparable.
        if (tradeCells.length) {
            const rates = tradeCells.map(x => x.dRoth / -x.d).sort((p, q) => p - q);
            const above1 = rates.filter(r => r >= 1).length;
            console.log('   exchange rate (Roth gained per $1 of NW given up):');
            console.log('      median ' + median(rates).toFixed(2) + ':1   best ' + rates[rates.length - 1].toFixed(2) +
                        ':1   worst ' + rates[0].toFixed(2) + ':1');
            console.log('      at or above 1:1 (the P106 bad-trade line): ' + above1 + ' of ' + tradeCells.length);
        }
        const dominated = nz.filter(x => x.dRoth <= 0.01 && x.d < -0.01);
        console.log('   Cells where AUTO is worse on BOTH Roth and net worth (no trade at all): ' + dominated.length);
        for (const x of tradeCells.slice(0, 5)) {
            console.log('      TRADE ' + x.id + '  Roth ' + money(x.dRoth) + ', NW ' + money(x.d) +
                        '  = ' + (x.dRoth / -x.d).toFixed(2) + ':1');
        }
    }

    console.log('\n-- T4: does the gap scale with how many Early years fire? --');
    const keys = [...R.byEarlyYears.keys()].sort((a, b) => a - b);
    for (const k of keys) {
        const v = R.byEarlyYears.get(k);
        console.log('   ' + String(k).padStart(2) + ' Early yr(s): n=' + String(v.length).padStart(3) +
                    '  median ' + pct(median(v)) + ' of NW');
    }

    const gk = R.autoMinusLate.filter(x => x.isGK);
    if (gk.length) {
        console.log('\n-- GK, scored separately (guardrails move the spend goal by design) --');
        console.log('   n=' + gk.length + '  auto - late median ' + money(median(gk.map(x => x.d))) +
                    ' (' + pct(median(gk.map(x => x.pctNW))) + ' of NW)');
        console.log('   AUTO beats LATE in ' + gk.filter(x => x.d > 0.01).length + ' of ' + gk.length);
        // GK's guardrails move the spend goal, so a wealth win can simply be spending less.
        const gkWinsSpendLess = gk.filter(x => x.d > 0.01 && x.dSpend < -1).length;
        console.log('   ...of those, delivered LESS spend than LATE: ' + gkWinsSpendLess +
                    '   (median GK spend delta ' + money(median(gk.map(x => x.dSpend))) + ')');
    }
    return R;
}

console.log('P28jf -- withdrawal-timing trigger, post-P28jg confirmation');
console.log('grid: ' + MIXES.length + ' mixes x ' + WEALTH.length + ' wealth x ' + SPEND_RATES.length +
            ' spend x ' + STRATEGIES.length + ' strategies x ' + ARMS.length + ' arms');
const A = report(score(runGrid(750000, 'HEADLINE - shipped IRA Goal default')));
const B = report(score(runGrid(0, 'ROBUSTNESS - iraBaseGoal 0, the value COMMON inherited (P85)')));

console.log('\n' + '='.repeat(78) + '\nVERDICT\n' + '='.repeat(78));
for (const R of [A, B]) {
    const nonGK = R.autoMinusLate.filter(x => !x.isGK);
    console.log(R.label);
    console.log('   T1 ' + (R.t1Break.length === 0 ? 'HELD' : 'BROKEN (' + R.t1Break.length + ')') +
                ' | T3 ' + (R.t3Break.length === 0 ? 'HELD' : 'BROKEN - VOID') +
                ' | fires ' + R.fires + '/' + R.total +
                ' | median auto-late ' + (nonGK.length ? money(median(nonGK.map(x => x.d))) : 'n/a'));
}
