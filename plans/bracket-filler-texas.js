'use strict';
/**
 * Bracket-filling couple, Texas
 *
 * A Texas couple filling the 22% federal bracket every year, with no state income tax.
 *
 * A PLAN CARD, not just a plan. `notes.summary` is the only line a person ever sees - loading this
 * plan writes it into the tool's own Notes box. Everything else in `notes` is for whoever is
 * choosing a household to measure on, and answers the question that saves a wasted study: not
 * "what is this plan" but "what can this plan NOT show".
 *
 * `notes.viability` is MEASURED, by re-running the plan, not asserted. See plans/README.md.
 */

const PLAN = {
    id: "bracket-filler-texas",
    title: "Bracket-filling couple, Texas",
    notes: {
        summary: "A Texas couple filling the 22% federal bracket every year, with no state income tax.",
        exercises: [
            "ceiling-filling behavior with the state tax removed, so the federal story is not confounded",
            "the Social Security basis of a MAGI ceiling: $50k of benefit against a bracket top",
        ],
        cannotShow: [
            "state-tax interactions of any kind - Texas has none",
            "ending-IRA measures: the IRA drains to zero",
        ],
        viability: {
            funded: "33/33",
            fundsEveryYear: true,
            endingIRA: 0,
            peakIRAYear: 0,
            acaBreachYears: 0
        },
        origin: "`ssbasis_harness.js` and `ssbasis_arms_harness.js`. `underfill_harness.js` runs the same household over 20 years instead of 30.",
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
        ss1Age: 70,
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
        Brokerage: 150000,
        BrokerageBasis: 80000,
        Cash: 80000,
        iraBaseGoal: 0,
        strategy: "bracket",
        stratRate: 0.22,
        stratIRMAATier: -1,
        stratACAMultiple: 0,
        spendGoal: 110000
    },
};

// Dual-mode export, the repo's classic-script contract: `require()` in node, `window.Plans` in the
// browser, so the same file can back a harness and a page load without a build step.
if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
if (typeof window !== 'undefined') (window.Plans = window.Plans || {})[PLAN.id] = PLAN;
