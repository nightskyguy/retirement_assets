/**
 * harvestceil_harness.js -- P87c4. Does a brokerage HARVEST year stop short of its ceiling too?
 *
 *   node .test_harnesses/harvestceil_harness.js
 *
 * P87c corrected the Social Security basis in the ordinary sizing line: a federal-bracket or IRMAA
 * ceiling is spent against `tax.MAGI`, which carries at most 85% of the benefit, so subtracting the
 * FULL benefit charged the ceiling for income it never receives and the plan stopped that much
 * short. `nonSSIncomeForMAGI` now inverts the MAGI relation instead.
 *
 * THAT FIX DID NOT REACH THE HARVEST BRANCH. When Cycle Brokerage picks a harvest year, the
 * `isBrokerageYear` arm runs INSTEAD of the sizing branch, and it builds its own aggregate:
 *
 *     _baseOrdinaryInc = yr.taxableInc + yr.fixedInc + yr.taxableInterest + yr.taxableDividends
 *
 * with `yr.fixedInc` the FULL benefit. That aggregate is then compared against the strategy's own
 * MAGI ceiling in the LTCG top-off guard (`_room = min(_room, _ceil - ordFloor)`) and, under the
 * cycleCoexist nerdknob, in `_iraRoom = yr.limit - _baseOrdinaryInc`. Same units mismatch, same
 * direction: the harvest is capped low.
 *
 * The third consumer of the same aggregate, `getLTCGBracketRoom(ordFloor, ...)`, is NOT part of this
 * question and is deliberately left alone - LTCG brackets are taxable-income thresholds, so the
 * right basis there involves the deduction as well as the benefit, and it needs its own measurement
 * rather than a copied line.
 *
 * WHAT THIS MEASURES. Two arms on identical cyclic plans:
 *   today   the guard as shipped, full benefit in the floor
 *   fixed   the guard on the ceiling's own income definition, via `harvestCeilSSBasis: 'magi'`
 * and reports how often the guard BINDS at all (it only matters in years where the ceiling, not the
 * LTCG bracket, is the thing stopping the harvest), how much extra gain is realized, and what it
 * does to lifetime tax and ending net worth.
 *
 * A guard that never binds would make this a no-op worth documenting rather than shipping, which is
 * exactly what P87c4 was left open to find out.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const R = '../';
Object.assign(globalThis, require(R + 'taxengine.js'));
require(R + 'displayhelpers.js');
const { simulate } = require(R + 'optimizer_core.js');

const BASE = {
    STATEname: 'TX', nYears: 30,
    birthyear1: 1962, birthmonth1: 6, die1: 92, birthyear2: 1964, birthmonth2: 3, die2: 94, hasSpouse: true,
    ss1: 30000, ss1Age: 67, ss2: 20000, ss2Age: 67, pensionAnnual: 0, pensionStartAge: 0,
    survivorPct: 0, pensionCola: false, spendChange: 0,
    inflation: .025, cpi: .025, growth: .06, cashYield: .03, dividendRate: .02,
    ssFailYear: 2099, ssFailPct: 1,
    convertExcessToRoth: true, fundConversionWithCash: false,
    propWithdraw: .10, iraWithdrawPct: .06, extraConversionAmount: 0,
    startAge: 64, startInYear: 2026, dividendReinvest: true,
    gkGuard: .2, gkAdjPct: .1, cycleLTCGTarget: .15, qcdHHMax: 0, qcdMode: 'asneeded', computeOC: false,
    IRA1: 2000000, IRA2: 800000, Roth: 50000, Roth2: 20000,
    // A harvest year needs a Brokerage worth harvesting, and the cycle length is
    // round(IRA/Brokerage), so a tiny Brokerage means a harvest year almost never arrives.
    Brokerage: 900000, BrokerageBasis: 400000, Cash: 80000, iraBaseGoal: 0,
    strategy: 'bracket', stratRate: 0.22, stratIRMAATier: -1, stratACAMultiple: 0,
    spendGoal: 110000,
    cyclicEnabled: true, cyclicOrder: 'ira-first',
};

const CEILINGS = [
    ['Fed 12%', { strategy: 'bracket', stratRate: 0.12, stratIRMAATier: -1, stratACAMultiple: 0 }],
    ['Fed 22%', { strategy: 'bracket', stratRate: 0.22, stratIRMAATier: -1, stratACAMultiple: 0 }],
    ['Fed 24%', { strategy: 'bracket', stratRate: 0.24, stratIRMAATier: -1, stratACAMultiple: 0 }],
    ['IRMAA T0', { strategy: 'bracket', stratRate: 0, stratIRMAATier: 0, stratACAMultiple: 0 }],
    ['IRMAA T1', { strategy: 'bracket', stratRate: 0, stratIRMAATier: 1, stratACAMultiple: 0 }],
    ['IRMAA T2', { strategy: 'bracket', stratRate: 0, stratIRMAATier: 2, stratACAMultiple: 0 }],
];
const SS = [['SS small', { ss1: 12000, ss2: 9000 }], ['SS mid', { ss1: 30000, ss2: 20000 }],
            ['SS large', { ss1: 54000, ss2: 40000 }]];
const BROK = [['Brok 400k', { Brokerage: 400000, BrokerageBasis: 180000 }],
              ['Brok 900k', { Brokerage: 900000, BrokerageBasis: 400000 }],
              ['Brok 2M', { Brokerage: 2000000, BrokerageBasis: 900000 }]];
const SPEND = [['spend 80k', { spendGoal: 80000 }], ['spend 110k', { spendGoal: 110000 }],
               ['spend 180k', { spendGoal: 180000 }]];
const STATUS = [['MFJ', {}], ['SGL', { hasSpouse: false, ss2: 0, IRA2: 0, Roth2: 0 }]];
const COEXIST = [['coexist off', {}], ['coexist on', { cycleCoexist: 'bracketfill' }]];

const med = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const money = n => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US');
const finalNW = r => { const L = r.log?.[r.log.length - 1]; return L ? (L['totalNetWealth'] ?? L['TotalNetWealth'] ?? 0) : 0; };

const rows = [];
let cells = 0, skipped = 0, noHarvest = 0;
for (const [cName, c] of CEILINGS)
for (const [ssName, ss] of SS)
for (const [bName, b] of BROK)
for (const [spName, sp] of SPEND)
for (const [stName, st] of STATUS)
for (const [coName, co] of COEXIST) {
    const inputs = { ...BASE, ...c, ...ss, ...b, ...sp, ...st, ...co };
    let a, f;
    try {
        a = simulate({ ...inputs });
        f = simulate({ ...inputs, harvestCeilSSBasis: 'magi' });
    } catch (e) { skipped++; continue; }
    if (!a?.log?.length || !f?.log?.length) { skipped++; continue; }
    cells++;
    // Harvest years are labelled 'Brok' by the cycle. Only those run the branch under test.
    const harvestYears = a.log.filter(e => String(e['subCycle'] ?? '').includes('Brok')).length;
    const label = `${cName} | ${ssName} | ${bName} | ${spName} | ${stName} | ${coName}`;
    const dGain = (f.totals?.gross ?? 0) - (a.totals?.gross ?? 0);
    const dTax = (f.totals?.tax ?? 0) - (a.totals?.tax ?? 0);
    const dNW = finalNW(f) - finalNW(a);
    const identical = JSON.stringify(a.log) === JSON.stringify(f.log);
    if (!harvestYears) noHarvest++;
    // P87a's CLEAN filter. Comparing ending net worth across two arms that delivered different
    // spending compares two different plans; only cells where the household lived the same life are
    // a fair read on what the ceiling change is worth.
    const dSpend = (f.totals?.spend ?? 0) - (a.totals?.spend ?? 0);
    const clean = Math.abs(dSpend) <= 1 && a.totals?.success && f.totals?.success;
    rows.push({ label, harvestYears, dGain, dTax, dNW, dSpend, clean, identical, coexist: coName === 'coexist on' });
}

const moved = rows.filter(r => !r.identical);
console.log('\n=== P87c4: the harvest branch against the ceiling\'s own income definition ===');
console.log(`cells run ${cells}, skipped ${skipped}, cells with no harvest year at all ${noHarvest}\n`);
console.log(`cells where the two arms differ AT ALL: ${moved.length} of ${cells} (${(100 * moved.length / Math.max(1, cells)).toFixed(1)}%)`);
if (!moved.length) {
    console.log('\nThe guard never binds on this grid. P87c4 is a no-op here - document it, do not ship it.\n');
    process.exit(0);
}
const offCo = moved.filter(r => !r.coexist), onCo = moved.filter(r => r.coexist);
console.log(`  with cycleCoexist OFF (shipped default): ${offCo.length}`);
console.log(`  with cycleCoexist ON  (nerdknob):        ${onCo.length}\n`);
console.log(`median  d(lifetime tax) ${money(med(moved.map(r => r.dTax)))}   d(ending net worth) ${money(med(moved.map(r => r.dNW)))}`);
console.log(`best    d(ending net worth) ${money(Math.max(...moved.map(r => r.dNW)))}`);
console.log(`worst   d(ending net worth) ${money(Math.min(...moved.map(r => r.dNW)))}`);
console.log(`net worth UP in ${moved.filter(r => r.dNW > 1).length}, DOWN in ${moved.filter(r => r.dNW < -1).length}, flat in ${moved.filter(r => Math.abs(r.dNW) <= 1).length}\n`);

// The shipped default is cycleCoexist OFF, so that sub-grid is the blast radius of shipping this.
// CLEAN cells only: same delivered spending in both arms, both plans funded to the end.
for (const [name, sub] of [['coexist OFF (shipped default)', offCo], ['coexist ON  (nerdknob)', onCo]]) {
    const cl = sub.filter(r => r.clean);
    if (!cl.length) { console.log(`${name}: ${sub.length} moved, none clean`); continue; }
    console.log(`${name}: ${cl.length} clean of ${sub.length} moved`);
    console.log(`   median dTax ${money(med(cl.map(r => r.dTax)))}   median dNW ${money(med(cl.map(r => r.dNW)))}`
        + `   up ${cl.filter(r => r.dNW > 1).length} / down ${cl.filter(r => r.dNW < -1).length}`);
    console.log(`   best dNW ${money(Math.max(...cl.map(r => r.dNW)))}   worst dNW ${money(Math.min(...cl.map(r => r.dNW)))}`);
}
console.log('');

console.log('--- the 15 largest movers by |d net worth| ---');
for (const r of [...moved].sort((x, y) => Math.abs(y.dNW) - Math.abs(x.dNW)).slice(0, 15)) {
    console.log(`  ${r.label.padEnd(62)} harvest yrs ${String(r.harvestYears).padStart(2)}  dTax ${money(r.dTax).padStart(12)}  dNW ${money(r.dNW).padStart(14)}`);
}
console.log('\n--- by ceiling ---');
for (const [cName] of CEILINGS) {
    const sub = rows.filter(r => r.label.startsWith(cName));
    const mv = sub.filter(r => !r.identical);
    console.log(`  ${cName.padEnd(9)} cells ${String(sub.length).padStart(3)}  moved ${String(mv.length).padStart(3)}  median dNW ${money(med(mv.map(r => r.dNW)))}`);
}
console.log('');
