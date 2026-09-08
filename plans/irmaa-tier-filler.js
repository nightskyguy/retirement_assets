'use strict';
/**
 * IRMAA-tier-filling couple, California
 *
 * A California couple holding income just inside an IRMAA tier.
 *
 * A PLAN CARD, not just a plan. `notes.summary` is the only line a person ever sees - loading this
 * plan writes it into the tool's own Notes box. Everything else in `notes` is for whoever is
 * choosing a household to measure on, and answers the question that saves a wasted study: not
 * "what is this plan" but "what can this plan NOT show".
 *
 * `notes.viability` is MEASURED, by re-running the plan, not asserted. See plans/README.md.
 */

const PLAN = {
    id: "irmaa-tier-filler",
    title: "IRMAA-tier-filling couple, California",
    notes: {
        summary: "A California couple holding income just inside an IRMAA tier.",
        exercises: [
            "the IRMAA lookback and its safety margin, which need a household actually near a tier edge",
            "ending-IRA measures: ends with a live IRA, peaks in year 17",
        ],
        cannotShow: [
            "the ACA cap - both are on Medicare, which is the point of an IRMAA study",
        ],
        viability: {
            funded: "26/26",
            fundsEveryYear: true,
            endingIRA: 4330394,
            peakIRAYear: 17,
            acaBreachYears: 0
        },
        origin: "READ BY `irmaa_margin_harness.js`.",
    },
    inputs: {
        STATEname: "CA",
        strategy: "bracket",
        stratRate: 0,
        stratACAMultiple: 0,
        stratIRMAATier: -1,
        nYears: 25,
        birthyear1: 1955,
        birthmonth1: 3,
        die1: 92,
        birthyear2: 1956,
        birthmonth2: 3,
        die2: 95,
        hasSpouse: true,
        IRA1: 2500000,
        IRA2: 500000,
        Roth: 200000,
        Roth2: 0,
        Brokerage: 600000,
        BrokerageBasis: 300000,
        Cash: 150000,
        CashReserve: 0,
        ss1: 45000,
        ss1Age: 70,
        ss2: 24000,
        ss2Age: 70,
        pensionAnnual: 0,
        survivorPct: 75,
        pensionCola: false,
        spendGoal: 180000,
        spendChange: 0,
        iraBaseGoal: 0,
        inflation: 0.03,
        cpi: 0.03,
        growth: 0.06,
        cashYield: 0.02,
        dividendRate: 0.015,
        ssFailYear: 2099,
        ssFailPct: 1,
        convertExcessToRoth: true,
        propWithdraw: 0,
        iraWithdrawPct: 0.05,
        startYear: 2026,
        dividendReinvest: false,
        qcdHHMax: 0,
        qcdMode: "always",
        cyclicEnabled: false
    },
};

// Dual-mode export, the repo's classic-script contract: `require()` in node, `window.Plans` in the
// browser, so the same file can back a harness and a page load without a build step.
if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
if (typeof window !== 'undefined') (window.Plans = window.Plans || {})[PLAN.id] = PLAN;
