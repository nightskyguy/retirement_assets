'use strict';
/**
 * Pre-Medicare couple under an ACA cap, claiming at 62, Texas
 *
 * A Texas couple retiring at 57 who claim Social Security at 62, while an ACA subsidy cap is still in force.
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
    id: "aca-gap-years-texas-early-ss",
    title: "Pre-Medicare couple under an ACA cap, claiming at 62, Texas",
    notes: {
        summary: "A Texas couple retiring at 57 who claim Social Security at 62, while an ACA subsidy cap is still in force.",
        exercises: [
            "THE ACA DEFINITION OF MAGI, which no other plan here can show: the benefit is paid during the capped years, so the untaxed part of it counts against the cap",
            "the gap-years shape - retire early, convert or draw hard, then Medicare",
            "ending-IRA and peak-IRA measures: ends with a live IRA",
        ],
        cannotShow: [
            "the cap and the benefit as separable effects - by construction they overlap here",
            "state-tax interactions",
        ],
        viability: {
            funded: "39/39",
            fundsEveryYear: true,
            endingIRA: 10870350,
            peakIRAYear: 32,
            acaBreachYears: 7
        },
        origin: "`acamagi_harness.js`, its BASE crossed with its own `SS mid @62` claim-age arm. The BASE alone claims at 67, which is AFTER the cap lapses, so it cannot show the add-back at all - that gap is why this plan exists.",
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
        ss1Age: 62,
        ss2: 20000,
        ss2Age: 62,
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
})();
