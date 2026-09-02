'use strict';
/**
 * schedule_replay_harness.js -- P103b2, widened by P103b3. What can `strategy: 'schedule'` carry?
 *
 * Run:  node .test_harnesses/schedule_replay_harness.js
 *
 * WHAT THIS IS. `strategy: 'schedule'` is the flexible research carrier: a per-year decision vector
 * instead of a named rule. Its acceptance bar is REPLAY IDENTITY - compile a shipped family's
 * realized decisions into a schedulePlan, re-run as a schedule, and require the two runs to agree to
 * the dollar. A family that cannot reproduce itself proves the representation cannot express what
 * that family decides, which is the measurement this harness exists to print.
 *
 * The two exact cases and the two failure modes are PINNED as node tests in optimizer_core.tests.js.
 * This harness is the wider table: every shipped family, so the coverage boundary is visible rather
 * than inferred. Report: research/PERFECT_FORESIGHT_ORACLE.md, section P103b2.
 *
 * WHY TARGETS AND NOT DOLLARS, since it is the design decision everything else follows from. The
 * reason is already recorded at optimizer_core.js (the oracleWithdrawalPlan comment): "Fractions,
 * not dollars: dollar plans desync from endogenous taxes/growth". A per-year dollar withdrawal is
 * chosen against the PREVIOUS iteration's tax outcome, and taxes are endogenous, so it stops being
 * feasible. `ordTarget` is an income target solved INSIDE the year against that year's realized
 * taxes - which is also, exactly, the control variable P75/P103c proposed for the unified search.
 *
 * ── PREDICTION UNDER TEST (R-P1), recorded BEFORE the numbers were looked at ─────────────────
 *   R-P1. Every family whose per-year decision IS an income ceiling replays to the dollar; every
 *         family whose decision is a QUANTITY compiles to nothing at all. There is no partial case
 *         among the fixed-spend families - a family is either fully expressible or not at all.
 * Scored at the end of the run. It was WRONG at P103b2 (ACA was partial), and the counterexample
 * is what named the missing fallback. It is kept scored against the WIDENED representation, where
 * it now fails for the opposite reason: the quantity families are no longer empty.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
Object.assign(globalThis, require('../taxengine.js'));
const core = require('../optimizer_core.js');
const { simulate, compileScheduleFromRun, scheduleOptionsForRun } = core;

const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString();

const BASE = {
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
    IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000,
    Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000,
    spendGoal: 97200,
};

// `decides` names what the family's per-year choice IS. It is the whole story of the results table.
const ARMS = [
    ['Fill Bracket 12%',   'ceiling',  { strategy: 'bracket', stratRate: 0.12 }],
    ['Fill Bracket 22%',   'ceiling',  { strategy: 'bracket', stratRate: 0.22 }],
    ['Fill Bracket 24%',   'ceiling',  { strategy: 'bracket', stratRate: 0.24 }],
    ['IRMAA tier 0',       'ceiling',  { strategy: 'bracket', stratRate: 0, stratIRMAATier: 0 }],
    ['IRMAA tier 2',       'ceiling',  { strategy: 'bracket', stratRate: 0, stratIRMAATier: 2 }],
    ['ACA 400% FPL',       'ceiling',  { strategy: 'aca', stratRate: 0, stratACAMultiple: 400 }],
    ['IRA Draw 5%',        'quantity', { strategy: 'fixedpct', iraWithdrawPct: 0.05 }],
    ['Proportional +10%',  'quantity', { strategy: 'propwd', propWithdraw: 0.10 }],
    ['Ordered CBIR',       'sequence', { strategy: 'ordered', orderedSeq: 'CBIR' }],
    ['Guyton-Klinger',     'spend',    { strategy: 'gk' }],
    ['Reduce 17 yrs',      'quantity', { strategy: 'fixed', nYears: 17 }],
];

console.log('P103b2/b3  schedule replay identity: compile each shipped family to a schedulePlan,');
console.log('re-run as strategy:\'schedule\', and measure the disagreement. Exact = the schedule');
console.log('can carry that family. Anything else names a decision ordTarget cannot express.\n');
console.log('arm                  decides    yrs sched   final NW (orig)    delta NW   max |yr wealth|  verdict');

const rows = [];
for (const [name, decides, ov] of ARMS) {
    const src = { ...BASE, ...ov };
    let a;
    try { a = simulate(src); } catch (e) { console.log(name.padEnd(21) + ' source threw: ' + e.message); continue; }
    const plan = compileScheduleFromRun(a, src);
    const scheduled = plan.filter(Boolean).length;
    let b;
    try {
        b = simulate({ ...src, strategy: 'schedule', schedulePlan: plan,
                       ...scheduleOptionsForRun(src),
                       stratRate: undefined, stratIRMAATier: undefined, stratACAMultiple: undefined });
    } catch (e) { console.log(name.padEnd(21) + ' replay threw: ' + e.message); continue; }
    const dNW = (b.finalNW ?? 0) - (a.finalNW ?? 0);
    let maxYr = 0;
    if (a.log.length !== b.log.length) maxYr = Infinity;
    else for (let i = 0; i < a.log.length; i++) {
        maxYr = Math.max(maxYr, Math.abs((b.log[i].totalWealth ?? 0) - (a.log[i].totalWealth ?? 0)));
    }
    const exact = maxYr < 0.01 && Math.abs(dNW) < 0.01;
    const verdict = exact ? 'EXACT'
        : scheduled === 0 ? 'carries nothing'
        : 'partial (' + scheduled + '/' + a.log.length + ' yrs)';
    rows.push({ name, decides, scheduled, years: a.log.length, dNW, maxYr, exact });
    console.log(name.padEnd(21) + decides.padEnd(11) + String(scheduled).padStart(4) + '   ' +
        money(a.finalNW ?? 0).padStart(16) + money(dNW).padStart(12) +
        money(maxYr).padStart(18) + '  ' + verdict);
}

console.log('\n' + '='.repeat(100));
console.log('PREDICTION SCORING  (R-P1, recorded before the run)');
console.log('='.repeat(100));
const ceilings = rows.filter(r => r.decides === 'ceiling');
const others = rows.filter(r => r.decides !== 'ceiling');
const ceilExact = ceilings.filter(r => r.exact).length;
const otherEmpty = others.filter(r => r.scheduled === 0).length;
const partials = rows.filter(r => !r.exact && r.scheduled > 0);
console.log('ceiling families replaying EXACTLY: ' + ceilExact + '/' + ceilings.length);
console.log('non-ceiling families carrying NOTHING: ' + otherEmpty + '/' + others.length);
console.log('partial cases (the prediction says there are none): ' + partials.length +
    (partials.length ? ' -> ' + partials.map(r => r.name).join(', ') : ''));
console.log('R-P1 -> ' + ((ceilExact === ceilings.length && otherEmpty === others.length && partials.length === 0)
    ? 'RIGHT' : 'WRONG'));

console.log('\nWHAT REMAINS, after P103b3 added iraDraw, gapFill, scheduleFallback and convert:');
console.log('  - the account SPLIT. Proportional draws proportionally across IRA/Brokerage/Cash and');
console.log('    Ordered runs a sequence; neither is an IRA draw, so ordTarget and iraDraw are both');
console.log('    silent. oracleWithdrawalPlan already expresses it, but it PREEMPTS the strategy');
console.log('    branch rather than composing with it - carrying Ordered means using that hook.');
console.log('  - the SPEND. Guyton-Klinger decides what to spend; a schedule takes spendGoal as');
console.log('    given, so it is outside the vocabulary by construction rather than by omission.');
