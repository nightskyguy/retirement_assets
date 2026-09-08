'use strict';
/**
 * Single filer, no survivor transition, long plan
 *
 * A single filer with a $3M IRA and thirty funded years ahead.
 *
 * A PLAN CARD, not just a plan. `notes.summary` is the only line a person ever sees - loading this
 * plan writes it into the tool's own Notes box. Everything else in `notes` is for whoever is
 * choosing a household to measure on, and answers the question that saves a wasted study: not
 * "what is this plan" but "what can this plan NOT show".
 *
 * `notes.viability` is MEASURED, by re-running the plan, not asserted. See plans/README.md.
 */

const PLAN = {
    id: "single-filer-long-horizon",
    title: "Single filer, no survivor transition, long plan",
    notes: {
        summary: "A single filer with a $3M IRA and thirty funded years ahead.",
        exercises: [
            "a long horizon - thirty funded years, the longest here after the widowhood plan - which is what break-even and heirs-rate questions need",
            "single brackets for the WHOLE plan, with no survivor transition to confound them",
            "ending-IRA measures: ends with a live IRA, peaks in year 16",
        ],
        cannotShow: [
            "the widow penalty, or anything about filing-status change - there is one person",
            "anything keyed on Retirement Start Age: this plan sets `startInYear` and leaves `startAge` undefined, which the engine accepts and a page load would have to fill in",
        ],
        viability: {
            funded: "30/30",
            fundsEveryYear: true,
            endingIRA: 2690759,
            peakIRAYear: 16,
            acaBreachYears: 0
        },
        origin: "READ BY `betr_harness.js`. Its `nYears: 40` is a cap, not the horizon - the plan funds 30 years and ends at the death age.",
    },
    inputs: {
        STATEname: "CA",
        strategy: "fixed",
        nYears: 40,
        birthyear1: 1965,
        birthmonth1: 1,
        die1: 90,
        birthyear2: 0,
        birthmonth2: 12,
        die2: 0,
        IRA1: 3000000,
        IRA2: 0,
        Roth: 0,
        Roth2: 0,
        Brokerage: 300000,
        BrokerageBasis: 300000,
        Cash: 200000,
        ss1: 40000,
        ss1Age: 70,
        ss2: 0,
        ss2Age: 70,
        pensionAnnual: 0,
        survivorPct: 0,
        pensionCola: false,
        spendGoal: 90000,
        spendChange: 0,
        iraBaseGoal: 0,
        inflation: 0.025,
        cpi: 0.025,
        growth: 0.06,
        cashYield: 0.03,
        dividendRate: 0.02,
        ssFailYear: 2099,
        ssFailPct: 1,
        convertExcessToRoth: false,
        propWithdraw: 0,
        iraWithdrawPct: 0.05,
        startInYear: 2026,
        dividendReinvest: true,
        startYear: 2026,
        hasSpouse: false
    },
};

// Dual-mode export, the repo's classic-script contract: `require()` in node, `window.Plans` in the
// browser, so the same file can back a harness and a page load without a build step.
if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
if (typeof window !== 'undefined') (window.Plans = window.Plans || {})[PLAN.id] = PLAN;
