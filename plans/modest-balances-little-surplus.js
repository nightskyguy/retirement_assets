'use strict';
/**
 * Modest balances, little surplus over need
 *
 * A California couple whose portfolio is not much larger than the spending it has to fund.
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
    id: "modest-balances-little-surplus",
    title: "Modest balances, little surplus over need",
    notes: {
        summary: "A California couple whose portfolio is not much larger than the spending it has to fund.",
        exercises: [
            "the surplus-over-need axis: how much a household will trade when it has little to spare",
            "the case that answers \"if my assets were smaller, I would be less aggressive\" with a number",
            "ending-IRA measures: ends with a live IRA, peaks in year 26",
        ],
        cannotShow: [
            "large-conversion behavior - there is no room for one",
        ],
        viability: {
            funded: "29/29",
            fundsEveryYear: true,
            endingIRA: 1944414,
            peakIRAYear: 26,
            acaBreachYears: 0
        },
        origin: "the canonical fixture with balances and spending cut. From the household study in `research/CONVERSION_VALUE_HOUSEHOLDS.md`, where it gave up 13.16% of its surplus against the canonical household's 2.36%.",
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
        birthyear1: 1961,
        birthmonth1: 8,
        die1: 89,
        birthyear2: 1963,
        birthmonth2: 2,
        die2: 91,
        IRA1: 1100000,
        IRA2: 150000,
        Roth: 60000,
        Roth2: 10000,
        CashReserve: 0,
        Brokerage: 250000,
        BrokerageBasis: 120000,
        Cash: 50000,
        ss1: 36000,
        ss1Age: 67,
        ss2: 22000,
        ss2Age: 67,
        pensionAnnual: 0,
        pensionStartAge: 0,
        survivorPct: 75,
        pensionCola: "none",
        spendGoal: 105000,
        spendChange: 0,
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
        convEndYear: 2034,
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
