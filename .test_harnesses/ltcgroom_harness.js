/**
 * ltcgroom_harness.js -- the LTCG bracket room's own income basis (P87c4's deferred third consumer).
 *
 *   node .test_harnesses/ltcgroom_harness.js
 *
 * WHAT WAS LEFT OPEN. `P87c` and `P87c4` corrected two consumers of the harvest branch's ordinary
 * income aggregate, and deliberately left the third:
 *
 *     _baseOrdinaryInc = yr.taxableInc + yr.fixedInc + yr.taxableInterest + yr.taxableDividends
 *     getLTCGBracketRoom(_baseOrdinaryInc, status, targetRate, cpiRate)
 *
 * The reason for leaving it is that this one is a DIFFERENT question. The other two compared that
 * aggregate against a MAGI ceiling, so the only error was the Social Security share. An LTCG bracket
 * top is a TAXABLE-income threshold: long-term gains stack on top of ordinary taxable income, which
 * is income AFTER the deduction. So this call site carries TWO errors, not one, and they point the
 * same way:
 *
 *   1. the FULL benefit is counted where at most 85% of it is taxable            (income too high)
 *   2. NO deduction is subtracted, against a post-deduction threshold            (income too high)
 *
 * Both make the ordinary floor look higher than it is, so the room comes back too SMALL and the
 * harvest stops short of the 0% or 15% LTCG bracket it was aiming to fill.
 *
 * WHAT THIS MEASURES, and it measures before anything is built. Per harvest year, the floor the
 * engine passed against the ordinary taxable income the year actually produced:
 *
 *     passed   = SSincome + (other ordinary income)          what getLTCGBracketRoom was given
 *     actual   = fedTaxableInc - realized LTCG               ordinary income after the deduction
 *     overstated = passed - actual
 *
 * and prices it: `overstated` dollars of LTCG room is `overstated` dollars of gains not harvested in
 * a year the plan had decided to harvest. Reported against the bracket width it is competing with,
 * because an overstatement smaller than the remaining room costs nothing at all.
 *
 * NO ENGINE CHANGE IS PROPOSED HERE. The fix is not a copied line: the deduction is circular at
 * sizing time (it is what `P92a`'s two-pass estimate exists for) and the taxable-SS share moves with
 * the draw. This says how much is at stake, which is what decides whether that work is worth doing.
 *
 * Households come from the plan bank. `bracket-filler-texas-cyclic` is the one that harvests.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const R = '../';
Object.assign(globalThis, require(R + 'taxengine.js'));
require(R + 'displayhelpers.js');
const { simulate } = require(R + 'optimizer_core.js');
const PLANS = require(R + 'plans');

const BASE = { ...PLANS.get("bracket-filler-texas-cyclic").inputs };

const CEILINGS = [
    ['Fed 12%', { strategy: 'bracket', stratRate: 0.12, stratIRMAATier: -1, stratACAMultiple: 0 }],
    ['Fed 22%', { strategy: 'bracket', stratRate: 0.22, stratIRMAATier: -1, stratACAMultiple: 0 }],
    ['Fed 24%', { strategy: 'bracket', stratRate: 0.24, stratIRMAATier: -1, stratACAMultiple: 0 }],
    ['IRMAA T0', { strategy: 'bracket', stratRate: 0, stratIRMAATier: 0, stratACAMultiple: 0 }],
    ['IRMAA T2', { strategy: 'bracket', stratRate: 0, stratIRMAATier: 2, stratACAMultiple: 0 }],
];
const SS = [['SS none', { ss1: 0, ss2: 0 }], ['SS small', { ss1: 12000, ss2: 9000 }],
            ['SS mid', { ss1: 30000, ss2: 20000 }], ['SS large', { ss1: 54000, ss2: 40000 }]];
const BROK = [['Brok 400k', { Brokerage: 400000, BrokerageBasis: 180000 }],
              ['Brok 900k', { Brokerage: 900000, BrokerageBasis: 400000 }],
              ['Brok 2M', { Brokerage: 2000000, BrokerageBasis: 900000 }]];
const SPEND = [['spend 80k', { spendGoal: 80000 }], ['spend 110k', { spendGoal: 110000 }],
               ['spend 180k', { spendGoal: 180000 }]];
const TARGET = [['LTCG target 0%', { cycleLTCGTarget: 0.15 }], ['LTCG target 15%', { cycleLTCGTarget: 0.20 }]];

const med = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const money = n => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US');

const years = [];
let cells = 0, harvestYears = 0;
for (const [cName, c] of CEILINGS)
for (const [ssName, ss] of SS)
for (const [bName, b] of BROK)
for (const [spName, sp] of SPEND)
for (const [tName, t] of TARGET) {
    let r;
    try { r = simulate({ ...BASE, ...c, ...ss, ...b, ...sp, ...t }); } catch (e) { continue; }
    if (!r?.log?.length) continue;
    cells++;
    for (const e of r.log) {
        if (!String(e.subCycle ?? '').includes('Brok')) continue;   // harvest years only
        harvestYears++;
        const ss_ = e.SSincome ?? 0, taxSS = e['-taxableSS'] ?? 0;
        const gains = e.CapitalGains ?? e.capitalGains ?? 0;
        const fedTaxable = e['-fedTaxableInc'] ?? 0;
        const ded = e['-fedDeduction'] ?? 0;
        // What the engine passed as the ordinary floor, reconstructed from the same log fields the
        // aggregate is built from. TaxableInc is the voluntary IRA draw plus RMD in this engine's
        // naming; the reconstruction is checked against the identity below rather than trusted.
        const passed = ss_ + Math.max(0, fedTaxable + ded - taxSS - gains);
        const actualOrdinaryTaxable = Math.max(0, fedTaxable - gains);
        years.push({
            cell: `${cName} | ${ssName} | ${bName} | ${spName} | ${tName}`,
            ssOverstate: Math.max(0, ss_ - taxSS),
            dedOverstate: ded,
            total: passed - actualOrdinaryTaxable,
            gains,
        });
    }
}

const tot = years.map(y => y.total).filter(v => Number.isFinite(v));
const ssPart = years.map(y => y.ssOverstate);
const dedPart = years.map(y => y.dedOverstate);

console.log('\n=== the LTCG bracket room is asked about the wrong income ===');
console.log(`cells ${cells}, harvest years ${harvestYears}\n`);
console.log('How much HIGHER the ordinary floor passed to getLTCGBracketRoom is than the ordinary');
console.log('taxable income the year actually produced. Every dollar of it is a dollar of LTCG room');
console.log('the harvest was not offered.\n');
console.log(`  median   ${money(med(tot)).padStart(12)}`);
console.log(`  p90      ${money(pct(tot, 0.9)).padStart(12)}`);
console.log(`  worst    ${money(Math.max(0, ...tot)).padStart(12)}`);
console.log(`  years overstated by more than $1,000: ${tot.filter(v => v > 1000).length} of ${tot.length}\n`);
console.log('Split by cause, and the deduction is the larger of the two:\n');
console.log(`  the untaxed part of the benefit   median ${money(med(ssPart)).padStart(11)}   worst ${money(Math.max(0, ...ssPart)).padStart(11)}`);
console.log(`  the deduction, never subtracted   median ${money(med(dedPart)).padStart(11)}   worst ${money(Math.max(0, ...dedPart)).padStart(11)}\n`);

console.log('--- by Social Security arm (isolates the benefit half) ---');
for (const [ssName] of SS) {
    const sub = years.filter(y => y.cell.includes(ssName));
    if (!sub.length) continue;
    console.log(`  ${ssName.padEnd(10)} years ${String(sub.length).padStart(4)}   median overstatement ${money(med(sub.map(y => y.total))).padStart(11)}`
        + `   of which benefit ${money(med(sub.map(y => y.ssOverstate))).padStart(10)}`);
}
console.log('\n--- by LTCG target (the room it is competing for) ---');
for (const [tName] of TARGET) {
    const sub = years.filter(y => y.cell.includes(tName));
    if (!sub.length) continue;
    console.log(`  ${tName.padEnd(16)} years ${String(sub.length).padStart(4)}   median overstatement ${money(med(sub.map(y => y.total))).padStart(11)}`);
}
console.log('');
