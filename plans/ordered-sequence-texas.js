'use strict';
/**
 * Ordered-sequence couple, Texas
 *
 * A Texas couple drawing from their accounts in a strict order rather than by rule.
 *
 * A PLAN CARD, not just a plan. `notes.summary` is the only line a person ever sees - loading this
 * plan writes it into the tool's own Notes box. Everything else in `notes` is for whoever is
 * choosing a household to measure on, and answers the question that saves a wasted study: not
 * "what is this plan" but "what can this plan NOT show".
 *
 * `notes.viability` is MEASURED, by re-running the plan, not asserted. See plans/README.md.
 */

// WRAPPED IN AN IIFE, and it is not style. Each of these files declares `PLAN`, and a classic
// script declaring `const PLAN` at global scope throws a redeclaration SyntaxError the moment a
// SECOND one is loaded - so the bank could be required in node but only ever ONE file could be
// loaded into a page, silently killing every load after the first. Found while trying to run the
// Optimizer against every household in the bank.
(function () {
const PLAN = {
    id: "ordered-sequence-texas",
    title: "Ordered-sequence couple, Texas",
    notes: {
        summary: "A Texas couple drawing from their accounts in a strict order rather than by rule.",
        exercises: [
            "the Ordered family, which is the one strategy that will NOT step outside its sequence to fund spending",
            "residual shortfalls that coexist with money still in a later account",
            "ending-IRA measures: ends with a live IRA, peaks in year 16",
        ],
        cannotShow: [
            "third-pass forced-draw behavior - Ordered is exempt from it by design",
        ],
        viability: {
            funded: "29/29",
            fundsEveryYear: true,
            endingIRA: 1799278,
            peakIRAYear: 16,
            acaBreachYears: 0
        },
        origin: "READ BY `ordered_fill_harness.js` (as `ORD_BASE`), retired in P116.",
    },
    inputs: {
        STATEname: "TX",
        strategy: "ordered",
        orderedSeq: "CBIR",
        stratRate: 0,
        stratIRMAATier: -1,
        stratACAMultiple: 0,
        nYears: 30,
        startYear: 2026,
        birthyear1: 1962,
        birthmonth1: 6,
        die1: 92,
        birthyear2: 1962,
        birthmonth2: 6,
        die2: 92,
        hasSpouse: true,
        IRA1: 1600000,
        IRA2: 0,
        Roth: 150000,
        Roth2: 0,
        Brokerage: 300000,
        BrokerageBasis: 150000,
        Cash: 60000,
        ss1: 50000,
        ss1Age: 70,
        ss2: 30000,
        ss2Age: 70,
        pensionAnnual: 0,
        survivorPct: 75,
        pensionCola: false,
        spendGoal: 90000,
        spendChange: 0.02,
        iraBaseGoal: 0,
        inflation: 0.025,
        cpi: 0.025,
        growth: 0.05,
        cashYield: 0.03,
        dividendRate: 0,
        ssFailYear: 2099,
        ssFailPct: 1,
        convertExcessToRoth: false,
        propWithdraw: 0,
        iraWithdrawPct: 0.05,
        dividendReinvest: false
    },
};

// Dual-mode export, the repo's classic-script contract: `require()` in node, `window.Plans` in the
// browser, so the same file can back a harness and a page load without a build step.
if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
if (typeof window !== 'undefined') (window.Plans = window.Plans || {})[PLAN.id] = PLAN;
})();
