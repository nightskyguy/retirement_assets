'use strict';
/**
 * Thirteen-year age gap, long widowhood, Texas
 *
 * A Texas couple thirteen years apart in age, so one of them spends 24 years filing as a single survivor.
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
    id: "long-widowhood",
    title: "Thirteen-year age gap, long widowhood, Texas",
    notes: {
        summary: "A Texas couple thirteen years apart in age, so one of them spends 24 years filing as a single survivor.",
        exercises: [
            "the widow penalty at full strength - a 24-year survivor window against the canonical household's 2",
            "the federal side of that penalty alone: Texas has no state income tax",
            "ending-IRA measures: ends with a live IRA",
        ],
        cannotShow: [
            "state-tax interactions",
            "the pre-survivor years as a large sample - most of this plan is the widowhood",
        ],
        viability: {
            funded: "38/38",
            fundsEveryYear: true,
            endingIRA: 2327863,
            peakIRAYear: 0,
            acaBreachYears: 0
        },
        origin: "the canonical fixture with a 13-year age gap. From the household study in `research/CONVERSION_VALUE_HOUSEHOLDS.md`, where it saved $3,227,336 of survivor tax.",
    },
    inputs: {
        STATEname: "TX",
        strategy: "fixed",
        orderedSeq: "CBIR",
        splitWeights: [0,9,1,0],
        rothGapFill: "",
        nYears: 11,
        stratRate: 0,
        stratIRMAATier: 0,
        stratACAMultiple: 0,
        hasSpouse: true,
        birthyear1: 1955,
        birthmonth1: 3,
        die1: 84,
        birthyear2: 1968,
        birthmonth2: 9,
        die2: 95,
        IRA1: 2500000,
        IRA2: 300000,
        Roth: 200000,
        Roth2: 40000,
        CashReserve: 0,
        Brokerage: 500000,
        BrokerageBasis: 200000,
        Cash: 80000,
        ss1: 48000,
        ss1Age: 70,
        ss2: 26000,
        ss2Age: 67,
        pensionAnnual: 0,
        pensionStartAge: 0,
        survivorPct: 75,
        pensionCola: "none",
        spendGoal: 150000,
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
        convEndYear: 2036,
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
