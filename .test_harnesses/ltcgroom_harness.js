/**
 * ltcgroom_harness.js -- the LTCG bracket room's income basis, and what correcting it did.
 *
 *   node .test_harnesses/ltcgroom_harness.js
 *
 * THE DEFECT, now fixed. An LTCG bracket top is a TAXABLE-income threshold: long-term gains stack
 * on top of ordinary income AFTER the deduction. The harvest branch was passing it
 *
 *     _baseOrdinaryInc = yr.taxableInc + yr.fixedInc + yr.taxableInterest + yr.taxableDividends
 *
 * which is neither - it carries the FULL Social Security benefit and subtracts no deduction. Two
 * errors, both making the floor look higher than it is, so the room came back too small and the
 * harvest stopped short of the bracket it was told to fill. `_ltcgFloor` now asks `calculateTaxes`
 * for ordinary taxable income on the same code path the year's tax is charged on.
 *
 * A SECOND DEFECT FELL OUT OF FIXING IT, and it is the more interesting one. The strategy's own
 * MAGI ceiling was only applied on the "spend forces gains past the target bracket" path - a
 * harvest that fitted INSIDE the target bracket was returned without ever being tested against the
 * IRMAA tier or ACA cap the plan was holding. That hole was unreachable only because the room was
 * too small to reach a threshold. Correcting the floor made it reachable and a coexist harvest year
 * immediately crossed into IRMAA Tier 1. The cap now applies on every path.
 *
 * WHAT THIS MEASURES, on the same grid, in two parts:
 *   1. the SIZE of the basis error, split by cause, which is why the fix is not a copy of P87c4's
 *   2. the OUTCOME, A/B against `ltcgRoomBasis: 'gross'` which still selects the old arm
 *
 * Read part 2 first. Part 1 explains the mechanism; part 2 is what the change is worth.
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

// A strategy with NO income ceiling is deliberately in the grid: `_capToCeiling` is a no-op there,
// so it isolates what the LTCG room alone does when nothing else is binding.
const CEILINGS = [
    ['Fed 12%', { strategy: 'bracket', stratRate: 0.12, stratIRMAATier: -1, stratACAMultiple: 0 }],
    ['Fed 22%', { strategy: 'bracket', stratRate: 0.22, stratIRMAATier: -1, stratACAMultiple: 0 }],
    ['Fed 24%', { strategy: 'bracket', stratRate: 0.24, stratIRMAATier: -1, stratACAMultiple: 0 }],
    ['IRMAA T0', { strategy: 'bracket', stratRate: 0, stratIRMAATier: 0, stratACAMultiple: 0 }],
    ['IRMAA T2', { strategy: 'bracket', stratRate: 0, stratIRMAATier: 2, stratACAMultiple: 0 }],
    ['Propwd 10%', { strategy: 'propwd', propWithdraw: 0.10, stratIRMAATier: -1, stratACAMultiple: 0 }],
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
const nw = r => { const L = r.log[r.log.length - 1]; return L ? (L.totalNetWealth ?? 0) : 0; };

const years = [], cells = [];
let harvestYears = 0;
for (const [cName, c] of CEILINGS)
for (const [ssName, ss] of SS)
for (const [bName, b] of BROK)
for (const [spName, sp] of SPEND)
for (const [tName, t] of TARGET) {
    const inp = { ...BASE, ...c, ...ss, ...b, ...sp, ...t };
    let a, f;
    try { a = simulate({ ...inp, ltcgRoomBasis: 'gross' }); f = simulate({ ...inp }); } catch (e) { continue; }
    if (!a?.log?.length || !f?.log?.length) continue;

    const dSpend = (f.totals.spend ?? 0) - (a.totals.spend ?? 0);
    cells.push({
        family: cName,
        label: `${cName} | ${ssName} | ${bName} | ${spName} | ${tName}`,
        identical: JSON.stringify(a.log) === JSON.stringify(f.log),
        dTax: (f.totals.tax ?? 0) - (a.totals.tax ?? 0),
        dNW: nw(f) - nw(a),
        dGross: (f.totals.gross ?? 0) - (a.totals.gross ?? 0),
        clean: Math.abs(dSpend) <= 1 && a.totals.success && f.totals.success,
    });

    // Part 1 reads the OLD arm, because that is where the error lives.
    for (const e of a.log) {
        if (!String(e.subCycle ?? '').includes('Brok')) continue;
        harvestYears++;
        const ss_ = e.SSincome ?? 0, taxSS = e['-taxableSS'] ?? 0;
        const gains = e.CapitalGains ?? e.capitalGains ?? 0;
        const fedTaxable = e['-fedTaxableInc'] ?? 0, ded = e['-fedDeduction'] ?? 0;
        const passed = ss_ + Math.max(0, fedTaxable + ded - taxSS - gains);
        years.push({
            ssOverstate: Math.max(0, ss_ - taxSS),
            dedOverstate: ded,
            total: passed - Math.max(0, fedTaxable - gains),
        });
    }
}

const moved = cells.filter(c => !c.identical);
const cl = moved.filter(c => c.clean);

console.log('\n=== 2. WHAT CORRECTING IT IS WORTH (A/B against `ltcgRoomBasis: gross`) ===\n');
console.log(`cells ${cells.length}, moved ${moved.length} (${(100 * moved.length / cells.length).toFixed(1)}%), clean ${cl.length}\n`);
console.log(`median  d(lifetime tax) ${money(med(cl.map(c => c.dTax)))}    d(gross drawn) ${money(med(cl.map(c => c.dGross)))}`);
console.log(`median  d(ending net worth) ${money(med(cl.map(c => c.dNW)))}`);
console.log(`net worth UP ${cl.filter(c => c.dNW > 1).length}  DOWN ${cl.filter(c => c.dNW < -1).length}  flat ${cl.filter(c => Math.abs(c.dNW) <= 1).length}`);
console.log(`best ${money(Math.max(...cl.map(c => c.dNW)))}   worst ${money(Math.min(...cl.map(c => c.dNW)))}\n`);
console.log('--- by strategy family, and the split is the finding ---');
console.log('    a family whose own income ceiling binds FIRST barely moves: the ceiling was already');
console.log('    holding the harvest down. The movers are the ones where the LTCG bracket is the');
console.log('    binding constraint, and Propwd has no income ceiling at all.\n');
for (const [cName] of CEILINGS) {
    const sub = cl.filter(c => c.family === cName);
    if (!sub.length) { console.log(`  ${cName.padEnd(11)} no clean movers`); continue; }
    console.log(`  ${cName.padEnd(11)} moved ${String(sub.length).padStart(3)}   median dNW ${money(med(sub.map(c => c.dNW))).padStart(12)}   median dTax ${money(med(sub.map(c => c.dTax))).padStart(11)}`);
}

const tot = years.map(y => y.total);
console.log('\n\n=== 1. THE MECHANISM: how wrong the old floor was ===\n');
console.log(`harvest years measured (old arm) ${harvestYears}\n`);
console.log('How much HIGHER the ordinary floor was than the ordinary taxable income the year');
console.log('actually produced. Every dollar is LTCG room the harvest was not offered.\n');
console.log(`  median ${money(med(tot)).padStart(12)}    p90 ${money(pct(tot, 0.9)).padStart(11)}    worst ${money(Math.max(0, ...tot)).padStart(11)}`);
console.log(`  years overstated by more than $1,000: ${tot.filter(v => v > 1000).length} of ${tot.length}\n`);
console.log('Split by cause. The deduction is the larger half, which is why this was NOT a copy of');
console.log('the Social-Security-only correction in the sizing line:\n');
console.log(`  the untaxed part of the benefit   median ${money(med(years.map(y => y.ssOverstate))).padStart(11)}   worst ${money(Math.max(0, ...years.map(y => y.ssOverstate))).padStart(11)}`);
console.log(`  the deduction, never subtracted   median ${money(med(years.map(y => y.dedOverstate))).padStart(11)}   worst ${money(Math.max(0, ...years.map(y => y.dedOverstate))).padStart(11)}`);
console.log('');
