'use strict';
/**
 * Bracket-filling couple with Cycle Brokerage, Texas
 *
 * A Texas couple filling the 22% bracket with a $900k brokerage account and Cycle Brokerage turned on.
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
    id: "bracket-filler-texas-cyclic",
    title: "Bracket-filling couple with Cycle Brokerage, Texas",
    notes: {
        summary: "A Texas couple filling the 22% bracket with a $900k brokerage account and Cycle Brokerage turned on.",
        exercises: [
            "the harvest branch, which runs INSTEAD of the ordinary sizing line and needs a brokerage worth harvesting",
            "ending-IRA and peak-IRA measures: this one ends with a live IRA and peaks in year 26",
        ],
        cannotShow: [
            "the plain sizing line in a harvest year - by construction the harvest branch preempts it",
            "state-tax interactions",
        ],
        viability: {
            funded: "33/33",
            fundsEveryYear: true,
            endingIRA: 4528318,
            peakIRAYear: 26,
            acaBreachYears: 0
        },
        origin: "READ BY `harvestceil_harness.js`. The Texas bracket-filler with the brokerage raised to $900k and Cycle Brokerage on.",
    },
    inputs: {
        STATEname: "TX",
        nYears: 30,
        birthyear1: 1962,
        birthmonth1: 6,
        die1: 92,
        birthyear2: 1964,
        birthmonth2: 3,
        die2: 94,
        hasSpouse: true,
        ss1: 30000,
        ss1Age: 67,
        ss2: 20000,
        ss2Age: 67,
        pensionAnnual: 0,
        pensionStartAge: 0,
        survivorPct: 0,
        pensionCola: false,
        spendChange: 0,
        inflation: 0.025,
        cpi: 0.025,
        growth: 0.06,
        cashYield: 0.03,
        dividendRate: 0.02,
        ssFailYear: 2099,
        ssFailPct: 1,
        convertExcessToRoth: true,
        fundConversionWithCash: false,
        propWithdraw: 0.1,
        iraWithdrawPct: 0.06,
        extraConversionAmount: 0,
        startAge: 64,
        startInYear: 2026,
        dividendReinvest: true,
        gkGuard: 0.2,
        gkAdjPct: 0.1,
        cycleLTCGTarget: 0.15,
        qcdHHMax: 0,
        qcdMode: "asneeded",
        computeOC: false,
        IRA1: 2000000,
        IRA2: 800000,
        Roth: 50000,
        Roth2: 20000,
        Brokerage: 900000,
        BrokerageBasis: 400000,
        Cash: 80000,
        iraBaseGoal: 0,
        strategy: "bracket",
        stratRate: 0.22,
        stratIRMAATier: -1,
        stratACAMultiple: 0,
        spendGoal: 110000,
        cyclicEnabled: true,
        cyclicOrder: "ira-first"
    },
};

// Dual-mode export, the repo's classic-script contract: `require()` in node, `window.Plans` in the
// browser, so the same file can back a harness and a page load without a build step.
if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
if (typeof window !== 'undefined') (window.Plans = window.Plans || {})[PLAN.id] = PLAN;
})();
