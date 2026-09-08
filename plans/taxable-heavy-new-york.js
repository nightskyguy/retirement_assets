'use strict';
/**
 * IRA-light couple, New York
 *
 * A New York couple whose wealth is mostly already taxed: $700k of IRA against $2.6M of brokerage.
 *
 * A PLAN CARD, not just a plan. `notes.summary` is the only line a person ever sees - loading this
 * plan writes it into the tool's own Notes box. Everything else in `notes` is for whoever is
 * choosing a household to measure on, and answers the question that saves a wasted study: not
 * "what is this plan" but "what can this plan NOT show".
 *
 * `notes.viability` is MEASURED, by re-running the plan, not asserted. See plans/README.md.
 */

const PLAN = {
    id: "taxable-heavy-new-york",
    title: "IRA-light couple, New York",
    notes: {
        summary: "A New York couple whose wealth is mostly already taxed: $700k of IRA against $2.6M of brokerage.",
        exercises: [
            "the reverse of the usual shape, and the household where converting is worth least",
            "a high-tax state that is not California",
            "ending-IRA measures: ends with a live IRA, peaks in year 23",
        ],
        cannotShow: [
            "conversion sizing at scale - the strategy leaves almost no surplus to route, so this household converts nothing under several strategies",
        ],
        viability: {
            funded: "27/27",
            fundsEveryYear: true,
            endingIRA: 1631658,
            peakIRAYear: 23,
            acaBreachYears: 0
        },
        origin: "the canonical fixture with the IRA and brokerage swapped in size. From the household study in `research/CONVERSION_VALUE_HOUSEHOLDS.md`.",
    },
    inputs: {
        STATEname: "NY",
        strategy: "fixed",
        orderedSeq: "CBIR",
        splitWeights: [0,9,1,0],
        rothGapFill: "",
        nYears: 11,
        stratRate: 0,
        stratIRMAATier: 0,
        stratACAMultiple: 0,
        hasSpouse: true,
        birthyear1: 1958,
        birthmonth1: 4,
        die1: 90,
        birthyear2: 1960,
        birthmonth2: 11,
        die2: 92,
        IRA1: 600000,
        IRA2: 100000,
        Roth: 150000,
        Roth2: 30000,
        CashReserve: 0,
        Brokerage: 2600000,
        BrokerageBasis: 1000000,
        Cash: 200000,
        ss1: 45000,
        ss1Age: 67,
        ss2: 30000,
        ss2Age: 67,
        pensionAnnual: 0,
        pensionStartAge: 0,
        survivorPct: 75,
        pensionCola: "none",
        spendGoal: 160000,
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
