'use strict';
/**
 * family_equivalence_harness.js -- are two strategy families the SAME MODEL, or only similar?
 *
 * Run:  node .test_harnesses/family_equivalence_harness.js
 *
 * WHY IT EXISTS. The user observed, 2026-09-02: "the default draw rule for gk is 'proportional' and
 * I believe the same rule that the 'proportional' (propwd) rule uses." Reading the dispatch says yes
 * - there is no `'gk'` case in `planPrimaryWithdrawals`, so Guyton-Klinger falls through to the
 * baseline `else`, whose three lines are the same three lines that open the `propwd` branch. But
 * "the code looks the same" is not a measurement, and this repo's standing rule is that a claim of
 * the form "X cannot differ from Y" gets checked rather than reasoned about, because the withdrawal
 * feedback loop couples almost everything eventually.
 *
 * WHAT IT DOES. Runs two families over the same cells and compares EVERY field of EVERY log row plus
 * final net worth, to half a cent. Not terminal wealth, not a summary statistic - a summary can
 * match while the years differ. Pairs are declared below; add one rather than editing an existing.
 *
 * CONTROLLING THE SPEND RULE. A draw comparison is only meaningful when both arms spend the same, so
 * the GK pair runs `spendRule: 'gk'` on BOTH sides. That makes the guardrail adjustment identical by
 * construction and leaves the draw as the only thing that can differ. Comparing `strategy: 'gk'`
 * against a plain `propwd` would show differences that belong entirely to the spend rule.
 *
 * WHAT COUNTS AS DISPLAY. `gkSpend` and `gkAdj` are populated only when `strategy === 'gk'` - they
 * label the row in the UI and are read by nothing in the model. They are excluded, and they are the
 * ONLY exclusions; every other field is compared.
 *
 * RESULT, 2026-09-02: 15 of 15 cells bit-identical. Guyton-Klinger's draw IS Proportional +0%.
 * Recorded in research/PERFECT_FORESIGHT_ORACLE.md under P103d.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
Object.assign(globalThis, require('../taxengine.js'));
const { simulate } = require('../optimizer_core.js');

// Same household and fixtures as gk_drawrule_harness.js, so a difference here cannot be a
// difference of setup. Both fixtures controlled per P103b5c: CashReserve 0, spend -1%/yr real.
const COMMON = {
    STATEname: 'CA', nYears: 20,
    birthyear1: 1962, birthmonth1: 6, die1: 92,
    birthyear2: 1964, birthmonth2: 3, die2: 94, hasSpouse: true,
    ss1: 45000, ss1Age: 70, ss2: 24000, ss2Age: 67,
    pensionAnnual: 0, pensionStartAge: 0, survivorPct: 0, pensionCola: false,
    spendChange: -0.01, iraBaseGoal: 0,
    inflation: 0.025, cpi: 0.025, growth: 0.06,
    cashYield: 0.03, dividendRate: 0.02,
    ssFailYear: 2099, ssFailPct: 1.0,
    convertExcessToRoth: true, iraWithdrawPct: 0.06,
    extraConversionAmount: 0, fundConversionWithCash: false,
    startAge: 64, startInYear: 2026, dividendReinvest: true,
    gkGuard: 0.20, gkAdjPct: 0.10, cycleLTCGTarget: 0.15,
    qcdHHMax: 0, qcdMode: 'asneeded', computeOC: false,
    CashReserve: 0,
};
const MIXES = [
    ['defaults',   { IRA1: 1000000, IRA2: 400000, Roth: 50000, Roth2: 20000, Brokerage: 100000, BrokerageBasis: 50000, Cash: 50000 }],
    ['defaults3x', { IRA1: 3000000, IRA2: 1200000, Roth: 150000, Roth2: 60000, Brokerage: 300000, BrokerageBasis: 150000, Cash: 150000 }],
    ['round1',     { IRA1: 1800000, IRA2: 700000, Roth: 250000, Roth2: 100000, Brokerage: 900000, BrokerageBasis: 500000, Cash: 150000 }],
    ['thirds',     { IRA1: 1000000, IRA2: 400000, Roth: 1000000, Roth2: 400000, Brokerage: 1400000, BrokerageBasis: 700000, Cash: 150000 }],
    ['brokheavy',  { IRA1: 700000, IRA2: 300000, Roth: 400000, Roth2: 200000, Brokerage: 2800000, BrokerageBasis: 1200000, Cash: 150000 }],
];
const RATES = [0.04, 0.06, 0.08];
const totalAssets = o => o.IRA1 + o.IRA2 + o.Roth + o.Roth2 + o.Brokerage + o.Cash;

// Populated only for strategy 'gk'; label fields, read by nothing in the model.
const DISPLAY_ONLY = new Set(['gkSpend', 'gkAdj']);

const PAIRS = [
    {
        name: "Guyton-Klinger draw  ==  Proportional +0%",
        why: "no 'gk' case in the dispatch; GK falls through to the baseline else",
        a: { label: "strategy 'gk'", inputs: { strategy: 'gk' } },
        b: { label: "propwd 0% + spendRule 'gk'", inputs: { strategy: 'propwd', propWithdraw: 0, spendRule: 'gk' } },
    },
];

function compareCell(baseInputs, pair) {
    const A = simulate({ ...baseInputs, ...pair.a.inputs });
    const B = simulate({ ...baseInputs, ...pair.b.inputs });
    const bad = [];
    if (A.log.length !== B.log.length) return [`log length ${A.log.length} vs ${B.log.length}`];
    for (let y = 0; y < A.log.length; y++) {
        const ra = A.log[y], rb = B.log[y];
        for (const k of new Set([...Object.keys(ra), ...Object.keys(rb)])) {
            if (DISPLAY_ONLY.has(k)) continue;
            const va = ra[k], vb = rb[k];
            if (typeof va === 'number' && typeof vb === 'number') {
                if (Math.abs(va - vb) > 0.005) bad.push(`y${y} ${k}: ${va} vs ${vb}`);
            } else if (va !== vb) {
                bad.push(`y${y} ${k}: ${JSON.stringify(va)} vs ${JSON.stringify(vb)}`);
            }
        }
    }
    const nwA = A.totals && A.totals.finalNW, nwB = B.totals && B.totals.finalNW;
    if (Math.abs((nwA || 0) - (nwB || 0)) > 0.005) bad.push(`finalNW ${nwA} vs ${nwB}`);
    return bad;
}

let failed = 0;
for (const pair of PAIRS) {
    console.log(`\n${pair.name}`);
    console.log(`  claim : ${pair.why}`);
    console.log(`  arm A : ${pair.a.label}`);
    console.log(`  arm B : ${pair.b.label}`);
    let cells = 0, same = 0;
    const diffs = [];
    for (const [mixName, bal] of MIXES) {
        for (const rate of RATES) {
            const spendGoal = Math.round(totalAssets(bal) * rate);
            const bad = compareCell({ ...COMMON, ...bal, spendGoal, propWithdraw: 0 }, pair);
            cells++;
            if (bad.length === 0) same++;
            else diffs.push(`${mixName} @${(rate * 100).toFixed(0)}%: ${bad.length} diffs -> ${bad.slice(0, 4).join(' | ')}`);
        }
    }
    console.log(`  cells compared : ${cells}`);
    console.log(`  BIT-IDENTICAL  : ${same}`);
    console.log(`  differing      : ${cells - same}`);
    if (diffs.length) {
        failed++;
        console.log('  differences:');
        diffs.forEach(d => console.log('   ' + d));
        console.log('  VERDICT: NOT the same model.');
    } else {
        console.log('  VERDICT: same model, every field of every year.');
    }
}
console.log('');
process.exitCode = failed ? 1 : 0;
