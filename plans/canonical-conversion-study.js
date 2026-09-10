'use strict';
/**
 * Canonical conversion study household
 *
 * The reference household for the conversion studies: California, $3.44M of IRA, spending $220k and declining.
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
    id: "canonical-conversion-study",
    title: "Canonical conversion study household",
    notes: {
        summary: "The reference household for the conversion studies: California, $3.44M of IRA, spending $220k and declining.",
        exercises: [
            "the conversion question as it was actually asked, and the one every conversion report quotes",
            "a short survivor window (2 years), which is the LOW end of the widow-penalty axis",
            "ending-IRA measures: ends with a live IRA",
        ],
        cannotShow: [
            "the widow penalty at strength - two years is barely a window; see the long-widowhood plan for that",
            "anything that needs an heirs rate: this plan deliberately has none set",
        ],
        viability: {
            funded: "25/25",
            fundsEveryYear: true,
            endingIRA: 2798107,
            peakIRAYear: 0,
            acaBreachYears: 0
        },
        origin: "`.test_harnesses/fixtures/p106_canonical.json`, captured verbatim from the page's own `getInputs()` in a browser. The four households below are named overrides on it.",
    },
    inputs: {
        STATEname: "CA",
        strategy: "fixed",
        orderedSeq: "CBIR",
        splitWeights: [0,9,1,0],
        rothGapFill: "",
        nYears: 11,
        stratRate: 0,
        stratIRMAATier: 0,
        stratACAMultiple: 0,
        hasSpouse: true,
        birthyear1: 1960,
        birthmonth1: 12,
        die1: 88,
        birthyear2: 1952,
        birthmonth2: 12,
        die2: 98,
        IRA1: 3200000,
        IRA2: 240000,
        Roth: 240000,
        Roth2: 34000,
        CashReserve: 0,
        Brokerage: 600000,
        BrokerageBasis: 200000,
        Cash: 100000,
        ss1: 60000,
        ss1Age: 70,
        ss2: 29000,
        ss2Age: 70,
        pensionAnnual: 15000,
        pensionStartAge: 0,
        survivorPct: 75,
        pensionCola: "none",
        spendGoal: 220000,
        spendChange: -0.01,
        iraBaseGoal: 1000000,
        advisorFeeAmount: 0,
        advisorFeeMode: "pct",
        advisorFeeScope: "none",
        inflation: 0.03,
        cpi: 0.027999999999999997,
        growth: 0.06,
        cashYield: 0.03,
        dividendRate: 0.0202,
        ssFailYear: 2033,
        ssFailPct: 0.773,
        taxRateCreep: 0,
        taxCreepStartYear: 0,
        taxRateCreepState: 0,
        convertExcessToRoth: true,
        fundConversionWithCash: true,
        extraConversionAmount: 0,
        convEndYear: 2032,
        convEndMode: "all",
        propWithdraw: 0.2,
        iraWithdrawPct: 0.05,
        startAge: 65,
        startInYear: 2026,
        dividendReinvest: true,
        cyclicEnabled: true,
        cyclicOrder: "brokerage-first",
        cycleLTCGTarget: 0.15,
        irmaaMarginMode: "halfcpi",
        fixedTaxIndexing: false,
        comp_IRA1_ratio: 65,
        comp_IRA1_intl: 8,
        comp_IRA2_ratio: 65,
        comp_IRA2_intl: 8,
        comp_Brokerage_ratio: 100,
        comp_Brokerage_intl: 5,
        comp_Roth1_ratio: 90,
        comp_Roth1_intl: 10,
        comp_Roth2_ratio: 90,
        comp_Roth2_intl: 10,
        futureIRATaxRate: undefined,
        qcdHHMax: 0,
        qcdMode: "asneeded",
        gkGuard: 0.2,
        gkAdjPct: 0.1
    },
};

// Dual-mode export, the repo's classic-script contract: `require()` in node, `window.Plans` in the
// browser, so the same file can back a harness and a page load without a build step.
if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
if (typeof window !== 'undefined') (window.Plans = window.Plans || {})[PLAN.id] = PLAN;
})();
