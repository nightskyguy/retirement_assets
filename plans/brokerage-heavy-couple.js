'use strict';
/**
 * Brokerage-heavy couple, California
 *
 * A California couple whose wealth is mostly in a taxable brokerage account.
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
    id: "brokerage-heavy-couple",
    title: "Brokerage-heavy couple, California",
    notes: {
        summary: "A California couple whose wealth is mostly in a taxable brokerage account.",
        exercises: [
            "capital-gains behavior as the dominant tax story rather than ordinary income",
            "the case where conversions have little room because the IRA is small",
        ],
        cannotShow: [
            "conversion sizing at scale - $1M of IRA is spent down rather than converted",
            "ending-IRA measures: the IRA drains to zero",
        ],
        viability: {
            funded: "33/33",
            fundsEveryYear: true,
            endingIRA: 0,
            peakIRAYear: 0,
            acaBreachYears: 0
        },
        origin: "the `brokheavy` mix at 6% spend.",
    },
    inputs: {
        STATEname: "CA",
        nYears: 20,
        birthyear1: 1962,
        birthmonth1: 6,
        die1: 92,
        birthyear2: 1964,
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
        iraBaseGoal: 0,
        inflation: 0.025,
        cpi: 0.025,
        growth: 0.06,
        cashYield: 0.03,
        dividendRate: 0.02,
        ssFailYear: 2099,
        ssFailPct: 1,
        convertExcessToRoth: true,
        propWithdraw: 0.1,
        iraWithdrawPct: 0.06,
        extraConversionAmount: 0,
        fundConversionWithCash: false,
        startAge: 64,
        startInYear: 2026,
        dividendReinvest: true,
        gkGuard: 0.2,
        gkAdjPct: 0.1,
        cycleLTCGTarget: 0.15,
        qcdHHMax: 0,
        qcdMode: "asneeded",
        computeOC: false,
        IRA1: 700000,
        IRA2: 300000,
        Roth: 400000,
        Roth2: 200000,
        Brokerage: 2800000,
        BrokerageBasis: 1200000,
        Cash: 150000,
        spendGoal: 273000,
        strategy: "propwd"
    },
};

// Dual-mode export, the repo's classic-script contract: `require()` in node, `window.Plans` in the
// browser, so the same file can back a harness and a page load without a build step.
if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
if (typeof window !== 'undefined') (window.Plans = window.Plans || {})[PLAN.id] = PLAN;
})();
