'use strict';
/**
 * ordered_fill_harness.js -- Ordered strategy: (c) prove the sequence restarts every year, and
 * (b) show where the year's surplus is banked before vs after the "fill follows draw order" change.
 *
 * Run:  node .test_harnesses/ordered_fill_harness.js
 *
 * TWO QUESTIONS
 *   Q_C  Does each year re-fund from the TOP of the sequence, reading that year's live balances,
 *        with no persistent "this account is exhausted, skip it forever" pointer? The claim is YES;
 *        the concrete proof is a Cash account that is drawn to ~0 in an early (pre-SS) year and then,
 *        once guaranteed income + RMDs create a surplus, refills and is DRAWN AGAIN FIRST.
 *   Q_B  Where does the year's leftover surplus land? Before the change: always Cash (legacy
 *        all-to-cash) regardless of sequence, so a BIRC/RIBC plan -- which draws Cash LAST -- strands
 *        its surplus in the one account it will not touch until everything else is gone. After the
 *        change: surplus is banked in whichever FUNDABLE account (Cash or Brokerage) the sequence
 *        draws first, so it is pulled back first next year. Roth/IRA are contribution-limited and
 *        cannot receive arbitrary surplus, so they are never fill targets.
 *
 * WHAT "FUNDABLE-FIRST" RESOLVES TO
 *   CBIR (Cash,Brokerage,IRA,Roth) -> Cash       (no change from legacy)
 *   RIBC (Roth,IRA,Brokerage,Cash) -> Brokerage  (Brokerage @3 beats Cash @4)
 *   BIRC (Brokerage,IRA,Roth,Cash) -> Brokerage  (Brokerage @1 beats Cash @4)
 */

const taxengine = require('../taxengine.js');
Object.assign(globalThis, taxengine);
const core = require('../optimizer_core.js');
const simulate = core.simulate;

const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString();
const SEQS = ['CBIR', 'RIBC', 'BIRC'];
const SEQ_ORDER = {
    CBIR: ['Cash', 'Brokerage', 'IRA', 'Roth'],
    RIBC: ['Roth', 'IRA', 'Brokerage', 'Cash'],
    BIRC: ['Brokerage', 'IRA', 'Roth', 'Cash'],
};
// First account in each sequence that can actually receive a surplus deposit (taxable only).
const FUNDABLE_FIRST = seq => SEQ_ORDER[seq].find(a => a === 'Cash' || a === 'Brokerage');

// A plan that runs a deficit early (retire at 64, SS deferred to 70) and a surplus later
// (SS at 70, big RMDs at 73+), so Cash is spent down and then refilled -- exactly the shape Q_C
// needs. No state tax (TX) keeps the surplus arithmetic clean.
const ORD_BASE = {
    STATEname: 'TX', strategy: 'ordered', orderedSeq: 'CBIR',
    stratRate: 0, stratIRMAATier: -1, stratACAMultiple: 0,
    nYears: 30, startYear: 2026,
    birthyear1: 1962, birthmonth1: 6, die1: 92,
    birthyear2: 1962, birthmonth2: 6, die2: 92, hasSpouse: true,
    IRA1: 1600000, IRA2: 0, Roth: 150000, Roth2: 0,
    Brokerage: 300000, BrokerageBasis: 150000, Cash: 60000,
    ss1: 50000, ss1Age: 70, ss2: 30000, ss2Age: 70,
    pensionAnnual: 0, survivorPct: 75, pensionCola: false,
    // Spend rises in real terms: small early (pre-SS) deficit drains Cash, the SS+RMD window banks a
    // surplus that refills it, then rising spend outpaces income again and re-draws it -> oscillation.
    spendGoal: 90000, spendChange: 0.02, iraBaseGoal: 0,
    inflation: 0.025, cpi: 0.025, growth: 0.05, cashYield: 0.03, dividendRate: 0.0,
    ssFailYear: 2099, ssFailPct: 1.0, convertExcessToRoth: false, propWithdraw: 0,
    iraWithdrawPct: 0.05, dividendReinvest: false,
    // CashReserve intentionally omitted -> legacy all-to-cash path, so the ordered fill branch (b)
    // is what governs. Setting it to 0 would instead force the reserve branch for every strategy.
};
const run = seq => simulate({ ...ORD_BASE, orderedSeq: seq });

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Q_C -- prove the yearly restart with a concrete exhaust -> refill -> redraw on Cash.
// ════════════════════════════════════════════════════════════════════════════════════════════════
function proveRestart() {
    console.log('\n' + '='.repeat(100));
    console.log('Q_C  Does the sequence restart every year? (Cash drawn to ~0, later refilled, drawn again)');
    console.log('='.repeat(100));

    // runOrderedWithdrawal is a single stateless function shared by all three sequences, so
    // demonstrating the exhaust -> refill -> redraw loop on ONE sequence proves it for all. The loop
    // only shows up where the first-drawn account actually refills; under legacy all-to-cash routing
    // that is Cash, i.e. CBIR. RIBC/BIRC draw Cash last, so Cash there just accumulates.
    let anyPass = false;
    for (const seq of SEQS) {
        const log = run(seq).log;
        // Year index where Cash was drawn for spending and ended near empty.
        const exhaustIdx = log.findIndex(e => (e.CashWD || 0) > 1 && (e.Cash || 0) < 2000);
        // A LATER year that was REFILLED going in (prior year ended with real Cash) and is DRAWN
        // again -> proof the exhausted account was not permanently skipped by a stuck pointer.
        let redrawIdx = -1;
        if (exhaustIdx >= 0) {
            redrawIdx = log.findIndex((e, i) => i > exhaustIdx + 1 && (log[i - 1].Cash || 0) > 20000 && (e.CashWD || 0) > 1);
        }
        const pass = exhaustIdx >= 0 && redrawIdx >= 0;
        anyPass = anyPass || pass;
        console.log(`\n  ${seq}:  ${pass ? 'PASS' : 'n/a  '}  ` +
            (exhaustIdx >= 0 ? `Cash emptied in ${log[exhaustIdx].year} (CashWD ${money(log[exhaustIdx].CashWD)}, end ${money(log[exhaustIdx].Cash)})` : 'Cash never emptied by a spending draw') +
            (redrawIdx >= 0 ? `\n         -> refilled + drawn again in ${log[redrawIdx].year} (end Cash ${money(log[redrawIdx].Cash)}, CashWD ${money(log[redrawIdx].CashWD)})` : ''));
        // A compact window around the transition so the refill is visible.
        if (pass) {
            const lo = Math.max(0, exhaustIdx - 1), hi = Math.min(log.length - 1, redrawIdx + 1);
            console.log('         yr    CashWD    Brok-    RothWD   endCash   endBrok   endRoth   surplus->Cash');
            for (let i = lo; i <= hi; i++) {
                const e = log[i];
                console.log('        ' + String(e.year).padStart(5) +
                    money(e.CashWD || 0).padStart(10) + money(e['Brokerage-'] || 0).padStart(9) +
                    money(e.RothWD || 0).padStart(10) + money(e.Cash || 0).padStart(10) +
                    money(e.Brokerage || 0).padStart(10) + money(e.Roth || 0).padStart(10) +
                    money(e.surplusCash || 0).padStart(14));
            }
        }
    }
    console.log(`\n  RESTART PROOF: ${anyPass ? 'PASS -- an emptied account was refilled and drawn again, so the shared\n                 stateless runOrderedWithdrawal re-reads live balances every year (no stuck pointer).' : 'INCONCLUSIVE for this fixture.'}`);
    return anyPass;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Q_B -- where does surplus land? (run this before AND after the (b) edit to see the shift)
// ════════════════════════════════════════════════════════════════════════════════════════════════
function surplusLanding() {
    console.log('\n' + '='.repeat(100));
    console.log('Q_B  Lifetime surplus banking + terminal balances, by sequence');
    console.log('     expect after (b): CBIR unchanged; RIBC/BIRC shift surplus Cash -> Brokerage');
    console.log('='.repeat(100));
    console.log('\n  seq   fund-first   surplus->Cash   surplus->Brok     endCash    endBrok   totalWealth');
    for (const seq of SEQS) {
        const log = run(seq).log;
        const toCash = log.reduce((s, e) => s + (e.surplusCash || 0), 0);
        const toBrok = log.reduce((s, e) => s + (e['-surplusToBrokerage'] || 0), 0);
        const last = log[log.length - 1];
        console.log('  ' + seq.padEnd(6) + FUNDABLE_FIRST(seq).padEnd(11) +
            money(toCash).padStart(15) + money(toBrok).padStart(15) +
            money(last.Cash || 0).padStart(12) + money(last.Brokerage || 0).padStart(11) +
            money(last.totalWealth || 0).padStart(14));
    }
}

const restartOK = proveRestart();
surplusLanding();
console.log('');
process.exit(restartOK ? 0 : 1);
