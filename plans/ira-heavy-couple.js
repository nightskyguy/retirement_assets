'use strict';
/**
 * IRA-heavy couple, California
 *
 * A California couple in their early sixties with almost all of their money in traditional IRAs.
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
    id: "ira-heavy-couple",
    title: "IRA-heavy couple, California",
    notes: {
        summary: "A California couple in their early sixties with almost all of their money in traditional IRAs.",
        exercises: [
            "the ordinary case for conversion work: $1.4M of IRA against $220k of everything else, so the IRA is the only lever",
            "a 20-year horizon with both people alive throughout, then a short survivor window",
        ],
        cannotShow: [
            "anything about brokerage draw order or basis step-up - there is only $100k of it",
            "anything about the ACA cap: both are past 65 well before the plan ends",
        ],
        viability: {
            funded: "33/33",
            fundsEveryYear: true,
            endingIRA: 1656142,
            peakIRAYear: 22,
            acaBreachYears: 0
        },
        origin: "the shared COMMON block crossed with the `defaults` mix, at the middle 6% spend rate. Thirteen harnesses cross this household; `schedule_replay_harness.js` uses this exact plan.",
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
        IRA1: 1000000,
        IRA2: 400000,
        Roth: 50000,
        Roth2: 20000,
        Brokerage: 100000,
        BrokerageBasis: 50000,
        Cash: 50000,
        spendGoal: 97200,
        strategy: "propwd"
    },
};

// Dual-mode export, the repo's classic-script contract: `require()` in node, `window.Plans` in the
// browser, so the same file can back a harness and a page load without a build step.
if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
if (typeof window !== 'undefined') (window.Plans = window.Plans || {})[PLAN.id] = PLAN;
})();
