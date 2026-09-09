/**
 * acamagi_harness.js -- P87d. Does the ACA overage read LOW, and by how much?
 *
 *   node .test_harnesses/acamagi_harness.js
 *
 * THE TWO DEFINITIONS. `yr.tax.MAGI` is the SSA/IRMAA one: federal AGI + tax-exempt interest, where
 * AGI already carries only the TAXABLE share of Social Security, at most 85%. ACA MAGI is a
 * different statutory quantity: it adds the whole benefit back, taxable or not. So
 *
 *     acaMAGI = MAGI + (SSincome - taxableSS)
 *
 * and the add-back is at least 15% of the benefit in the capped regime, more in the sloped tiers,
 * and the entire benefit in a year where none of it is taxable.
 *
 * WHY IT MATTERS. The ACA branch of the SIZING line already treats the cap as ACA-MAGI-shaped -
 * `_ssCeilRoom = yr.limit - yr.fixedInc` subtracts the FULL benefit, on purpose, and P87c kept it
 * that way. The MEASUREMENT side never followed: `bracketOverage = max(0, tax.MAGI - bracketTarget)`
 * judges every ceiling kind against the SSA definition. The two sides of the same cap therefore
 * disagree by the add-back, and the disagreement is one-directional - the overage can only read low,
 * never high, so a breached cap can report as clean.
 *
 * `acaBreach` is set from that overage (`optimizer_core.js`, resolveResidualAndForcedIRA) and feeds
 * `totals.acaBreachYears`, which the Optimizer uses to flag an ACA row UNTENABLE. An understated
 * overage therefore does not just misreport a column: it lets an ACA row that cannot hold its cap
 * rank as though it could.
 *
 * WHAT THIS MEASURES, per plan-year with a live ACA ceiling:
 *   addBack     SSincome - taxableSS
 *   overageNow  max(0, MAGI    - BracketTarget)   what the engine reports today
 *   overageTrue max(0, acaMAGI - BracketTarget)   what the ACA definition gives
 * and per plan, whether the count of breach years changes at all - which is the number that moves
 * a row's feasibility flag.
 *
 * ACA MULTIPLES ARE WHOLE PERCENTS. `stratACAMultiple` is 200/250/300/400, matching the dropdown's
 * `aca400` and computeBracketCeiling's `FPL_2025 * multiple / 100`. Note for anyone reading
 * ssbasis_harness.js: its ACA arms pass 2.0 and 4.0, which is a $409 cap, not a $81,760 one.
 *
 * Households are deliberately PRE-MEDICARE at the start - the cap lapses once every living spouse
 * reaches 65 (`yr.acaLapsed`), and a lapsed year has no ceiling to breach.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const R = '../';
Object.assign(globalThis, require(R + 'taxengine.js'));
require(R + 'displayhelpers.js');
const { simulate } = require(R + 'optimizer_core.js');
const PLANS = require(R + 'plans');

// P112. The household is `aca-gap-years-texas` in the plan bank, not a literal copied into
// this file. Its card records what it exercises, what its measured viability is, and what it
// CANNOT show: the ACA definition of MAGI - it claims Social Security at 67, after its cap has lapsed.
// Read plans/aca-gap-years-texas.js before reading a verdict off this harness.
const BASE = { ...PLANS.get("aca-gap-years-texas").inputs };

const CAPS = [['ACA 200%', { stratACAMultiple: 200 }], ['ACA 250%', { stratACAMultiple: 250 }],
              ['ACA 300%', { stratACAMultiple: 300 }], ['ACA 400%', { stratACAMultiple: 400 }]];
// The benefit is the whole lever here: no benefit means no add-back and nothing to find. The
// claim-age arm matters because a cap that lapses at 65 and a benefit that starts at 67 never
// overlap - claiming at 62 is what puts SS inside the ACA window at all.
const SS = [['SS none', { ss1: 0, ss2: 0 }],
            ['SS small @62', { ss1: 12000, ss2: 9000, ss1Age: 62, ss2Age: 62 }],
            ['SS mid @62', { ss1: 30000, ss2: 20000, ss1Age: 62, ss2Age: 62 }],
            ['SS large @62', { ss1: 54000, ss2: 40000, ss1Age: 62, ss2Age: 62 }],
            ['SS mid @67', { ss1: 30000, ss2: 20000, ss1Age: 67, ss2Age: 67 }]];
const WEALTH = [['IRA 400k', { IRA1: 300000, IRA2: 100000 }],
                ['IRA 2.8M', { IRA1: 2000000, IRA2: 800000 }],
                ['IRA 8M', { IRA1: 6000000, IRA2: 2000000 }]];
const SPEND = [['spend 60k', { spendGoal: 60000 }], ['spend 110k', { spendGoal: 110000 }],
               ['spend 180k', { spendGoal: 180000 }]];
const STATUS = [['MFJ', {}], ['SGL', { hasSpouse: false, ss2: 0, IRA2: 0, Roth2: 0 }]];

const med = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const money = n => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US');

const rows = [];
let cells = 0, skipped = 0;
for (const [capName, cap] of CAPS)
for (const [ssName, ss] of SS)
for (const [wName, w] of WEALTH)
for (const [spName, sp] of SPEND)
for (const [stName, st] of STATUS) {
    const inputs = { ...BASE, ...cap, ...ss, ...w, ...sp, ...st };
    let res;
    try { res = simulate(inputs); } catch (e) { skipped++; continue; }
    if (!res || !res.log || !res.log.length) { skipped++; continue; }
    cells++;
    const label = `${capName} | ${ssName} | ${wName} | ${spName} | ${stName}`;
    let liveYears = 0, breachNow = 0, breachTrue = 0, newBreach = 0;
    const addBacks = [], understate = [];
    for (const e of res.log) {
        const target = e['BracketTarget'] ?? 0;
        if (!(target > 0)) continue;            // no ceiling this year (lapsed, or dead household)
        liveYears++;
        const magi = e['MAGI'] ?? 0;
        const addBack = Math.max(0, (e['SSincome'] ?? 0) - (e['-taxableSS'] ?? 0));
        const acaMAGI = magi + addBack;
        const ovNow = Math.max(0, magi - target);
        const ovTrue = Math.max(0, acaMAGI - target);
        addBacks.push(addBack);
        if (ovTrue > ovNow) understate.push(ovTrue - ovNow);
        if (ovNow > 1) breachNow++;
        if (ovTrue > 1) breachTrue++;
        if (ovTrue > 1 && ovNow <= 1) newBreach++;
    }
    if (!liveYears) { skipped++; cells--; continue; }
    rows.push({ label, liveYears, breachNow, breachTrue, newBreach,
                medAddBack: med(addBacks), maxAddBack: Math.max(0, ...addBacks),
                medUnderstate: med(understate), maxUnderstate: Math.max(0, ...understate),
                flips: (breachNow === 0 && breachTrue > 0) });
}

const flipped = rows.filter(r => r.flips);
const moved = rows.filter(r => r.breachTrue > r.breachNow);
const totLive = rows.reduce((a, r) => a + r.liveYears, 0);
const totNew = rows.reduce((a, r) => a + r.newBreach, 0);
const totNow = rows.reduce((a, r) => a + r.breachNow, 0);
const totTrue = rows.reduce((a, r) => a + r.breachTrue, 0);

console.log('\n=== P87d: the ACA overage against the ACA definition of MAGI ===');
console.log(`cells run ${cells}, skipped ${skipped}, plan-years with a live ACA ceiling ${totLive}\n`);
console.log(`breach years reported today       ${totNow} (${(100 * totNow / totLive).toFixed(1)}% of live years)`);
console.log(`breach years on the ACA basis     ${totTrue} (${(100 * totTrue / totLive).toFixed(1)}%)`);
console.log(`years that flip clean -> breached ${totNew}\n`);
console.log(`PLANS whose breach count rises            ${moved.length} of ${rows.length}`);
console.log(`PLANS that report ZERO breaches and breach ${flipped.length} of ${rows.length}  <- the feasibility flag flips here\n`);

const allAdd = rows.map(r => r.medAddBack).filter(v => v > 0);
console.log(`median per-year add-back, over plans with any SS: ${money(med(allAdd))}`);
console.log(`largest single-year add-back seen:                ${money(Math.max(0, ...rows.map(r => r.maxAddBack)))}`);
const allUnder = rows.map(r => r.medUnderstate).filter(v => v > 0);
console.log(`median understatement of the overage:            ${money(med(allUnder))}`);
console.log(`largest understatement seen:                     ${money(Math.max(0, ...rows.map(r => r.maxUnderstate)))}\n`);

console.log('--- the 15 plans where the flag flips hardest (zero reported, some real) ---');
for (const r of [...flipped].sort((a, b) => b.breachTrue - a.breachTrue).slice(0, 15)) {
    console.log(`  ${r.label.padEnd(46)} live ${String(r.liveYears).padStart(2)}  reported 0  real ${String(r.breachTrue).padStart(2)}  medAddBack ${money(r.medAddBack)}`);
}
console.log('\n--- by cap ---');
for (const [capName] of CAPS) {
    const sub = rows.filter(r => r.label.startsWith(capName));
    if (!sub.length) continue;
    const f = sub.filter(r => r.flips).length;
    console.log(`  ${capName.padEnd(10)} plans ${String(sub.length).padStart(3)}  flag flips ${String(f).padStart(3)}  breach yrs ${sub.reduce((a, r) => a + r.breachNow, 0)} -> ${sub.reduce((a, r) => a + r.breachTrue, 0)}`);
}
console.log('\n--- by Social Security arm ---');
for (const [ssName] of SS) {
    const sub = rows.filter(r => r.label.includes(ssName));
    if (!sub.length) continue;
    const f = sub.filter(r => r.flips).length;
    console.log(`  ${ssName.padEnd(14)} plans ${String(sub.length).padStart(3)}  flag flips ${String(f).padStart(3)}  medAddBack ${money(med(sub.map(r => r.medAddBack)))}`);
}
console.log('');
