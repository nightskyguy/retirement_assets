'use strict';
/**
 * Pre-Medicare couple under an ACA cap, Texas
 *
 * A Texas couple retiring at 57 and holding income under an ACA subsidy cap until Medicare.
 *
 * A PLAN CARD, not just a plan. `notes.summary` is the only line a person ever sees - loading this
 * plan writes it into the tool's own Notes box. Everything else in `notes` is for whoever is
 * choosing a household to measure on, and answers the question that saves a wasted study: not
 * "what is this plan" but "what can this plan NOT show".
 *
 * `notes.viability` is MEASURED, by re-running the plan, not asserted. See plans/README.md.
 */

const PLAN = {
    id: "aca-gap-years-texas",
    title: "Pre-Medicare couple under an ACA cap, Texas",
    notes: {
        summary: "A Texas couple retiring at 57 and holding income under an ACA subsidy cap until Medicare.",
        exercises: [
            "the ACA cap while it is actually IN FORCE, which needs a household under 65 at the start",
            "a cap that binds on ordinary income alone - 7 of its capped years breach",
            "ending-IRA and peak-IRA measures: ends with a live IRA, peaks in year 32",
        ],
        cannotShow: [
            "THE ACA DEFINITION OF MAGI. Both claim Social Security at 67 and the cap lapses at 65, so no benefit is ever paid inside a capped year and the untaxed-benefit add-back is always $0. Use the early-claim sibling for that",
            "anything after the cap lapses at Medicare that is not simply Proportional 0%",
            "state-tax interactions",
        ],
        viability: {
            funded: "39/39",
            fundsEveryYear: true,
            endingIRA: 9965829,
            peakIRAYear: 32,
            acaBreachYears: 7
        },
        origin: "READ BY `acamagi_harness.js`. The Texas bracket-filler moved six years younger and put on a 400% FPL cap.",
    },
    inputs: {
        STATEname: "TX",
        nYears: 30,
        birthyear1: 1968,
        birthmonth1: 6,
        die1: 92,
        birthyear2: 1970,
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
        startAge: 57,
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
        strategy: "aca",
        stratRate: 0,
        stratIRMAATier: -1,
        stratACAMultiple: 400,
        spendGoal: 110000
    },
};

// Dual-mode export, the repo's classic-script contract: `require()` in node, `window.Plans` in the
// browser, so the same file can back a harness and a page load without a build step.
if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
if (typeof window !== 'undefined') (window.Plans = window.Plans || {})[PLAN.id] = PLAN;
