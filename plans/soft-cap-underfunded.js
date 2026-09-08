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

const PLAN = {
    id: "soft-cap-underfunded",
    title: "Underfunded couple against a soft cap",
    notes: {
        summary: "A California couple whose spending cannot be met inside their chosen bracket ceiling.",
        exercises: [
            "the third-pass forced IRA draw above a soft ceiling, and the bracket overage it records",
            "the difference between a soft cap (breaches to fund spending) and the strict ACA cap (does not)",
        ],
        cannotShow: [
            "ranking against other households. It does not fund its last year, ON PURPOSE - the shortfall is the subject",
        ],
        viability: {
            funded: "23/24",
            fundsEveryYear: false,
            endingIRA: 0,
            peakIRAYear: 0,
            acaBreachYears: 0
        },
        origin: "READ BY `brokerage_harness.js` (as `CAP_BASE`). **Measured not fully funded**, by design.",
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
