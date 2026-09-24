'use strict';
/**
 * Underfunded couple against a soft cap
 *
 * A California couple whose spending cannot be met inside their chosen bracket ceiling.
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
    id: "soft-cap-underfunded",
    title: "Couple spending through a soft cap",
    notes: {
        summary: "A California couple whose spending cannot be met inside their chosen bracket ceiling.",
        exercises: [
            "a soft ceiling breached to fund spending: 9 of its 24 years run over the cap, by up to $14,575",
            "the difference between a soft cap (breaches to fund spending) and the strict ACA cap (does not)",
        ],
        cannotShow: [
            "the third-pass FORCED IRA draw. It used to force one and no longer does - correcting the IRMAA ladder on 2026-09-23 cut the surcharge enough that this household funds every year on its own. Use `ira-heavy-couple-overreaching` for a genuine shortfall",
        ],
        viability: {
            funded: "24/24",
            fundsEveryYear: true,
            endingIRA: 0,
            peakIRAYear: 0,
            acaBreachYears: 0
        },
        origin: "READ BY `brokerage_harness.js` (as `CAP_BASE`), retired in P116. Built as a household that could not fund itself; it now funds 24/24 after the IRMAA ladder was corrected to the CMS bands, so the name is historical. Still breaches its soft cap, which is the half of its purpose that survives.",
    },
    inputs: {
        STATEname: "CA",
        strategy: "bracket",
        stratRate: 0.22,
        stratIRMAATier: -1,
        stratACAMultiple: 0,
        nYears: 30,
        birthyear1: 1960,
        birthmonth1: 12,
        die1: 74,
        birthyear2: 1959,
        birthmonth2: 12,
        die2: 90,
        hasSpouse: true,
        IRA1: 2000000,
        IRA2: 100000,
        Roth: 0,
        Roth2: 0,
        Brokerage: 100000,
        BrokerageBasis: 50000,
        Cash: 50000,
        CashReserve: 0,
        ss1: 48000,
        ss1Age: 67,
        ss2: 24000,
        ss2Age: 67,
        pensionAnnual: 0,
        survivorPct: 75,
        pensionCola: false,
        spendGoal: 160000,
        spendChange: -0.01,
        iraBaseGoal: 0,
        inflation: 0.025,
        cpi: 0.025,
        growth: 0.05,
        cashYield: 0.02,
        dividendRate: 0,
        ssFailYear: 2099,
        ssFailPct: 1,
        convertExcessToRoth: false,
        propWithdraw: 0,
        iraWithdrawPct: 0.05,
        startYear: 2026,
        dividendReinvest: false
    },
};

// Dual-mode export, the repo's classic-script contract: `require()` in node, `window.Plans` in the
// browser, so the same file can back a harness and a page load without a build step.
if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
if (typeof window !== 'undefined') (window.Plans = window.Plans || {})[PLAN.id] = PLAN;
})();
