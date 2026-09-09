'use strict';
/**
 * High-spending couple, large IRA
 *
 * A California couple with $4.2M of IRA and $240k of annual spending.
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
    id: "high-spend-large-ira",
    title: "High-spending couple, large IRA",
    notes: {
        summary: "A California couple with $4.2M of IRA and $240k of annual spending.",
        exercises: [
            "high marginal rates throughout, where a bracket ceiling binds every year",
            "ending-IRA measures: ends with a live IRA, peaks in year 19",
        ],
        cannotShow: [
            "low-bracket behavior of any kind - this household never visits the bottom of the ladder",
        ],
        viability: {
            funded: "26/26",
            fundsEveryYear: true,
            endingIRA: 6567372,
            peakIRAYear: 19,
            acaBreachYears: 0
        },
        origin: "READ BY `growthcredit_check.js`.",
    },
    inputs: {
        STATEname: "CA",
        nYears: 20,
        birthyear1: 1955,
        birthmonth1: 6,
        die1: 92,
        birthyear2: 1957,
        birthmonth2: 3,
        die2: 94,
        hasSpouse: true,
        ss1: 45000,
        ss1Age: 70,
        ss2: 24000,
        ss2Age: 67,
        pensionAnnual: 0,
        pensionStartAge: 0,
        survivorPct: 0,
        pensionCola: false,
        spendChange: 0,
        iraBaseGoal: 750000,
        inflation: 0.025,
        cpi: 0.025,
        growth: 0.06,
        cashYield: 0.03,
        dividendRate: 0.02,
        ssFailYear: 2099,
        ssFailPct: 1,
        convertExcessToRoth: true,
        propWithdraw: 0,
        iraWithdrawPct: 0.06,
        extraConversionAmount: 0,
        fundConversionWithCash: false,
        startAge: 71,
        startInYear: 2026,
        dividendReinvest: true,
        gkGuard: 0.2,
        gkAdjPct: 0.1,
        cycleLTCGTarget: 0.15,
        qcdHHMax: 0,
        qcdMode: "asneeded",
        computeOC: false,
        strategy: "bracket",
        stratRate: 0.22,
        IRA1: 3000000,
        IRA2: 1200000,
        Roth: 150000,
        Roth2: 60000,
        Brokerage: 300000,
        BrokerageBasis: 150000,
        Cash: 150000,
        spendGoal: 240000,
        forceWithdrawTiming: "late"
    },
};

// Dual-mode export, the repo's classic-script contract: `require()` in node, `window.Plans` in the
// browser, so the same file can back a harness and a page load without a build step.
if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
if (typeof window !== 'undefined') (window.Plans = window.Plans || {})[PLAN.id] = PLAN;
})();
