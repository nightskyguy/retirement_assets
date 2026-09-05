/**
 * tax_timing_harness.js -- P108a, stage 1. What is it worth to pay the tax later?
 *
 * THE GAP. The Optimizer has no concept of a tax DATE. `calculateWithdrawals` grosses the draw up
 * for tax (`netAmount = totalWithdrawals - result.totalTax`), so the tax leaves the portfolio at the
 * same instant as the spending money - month 1 or month 11, whichever the timing rule picked. The
 * total is right; the timing is not modelled at all. Money that leaves in January stops compounding
 * eleven months earlier than it needs to.
 *
 * WHY THE MECHANISM IS REAL. Withholding is deemed paid RATABLY across the year regardless of when
 * it is actually withheld, so withholding on a December IRA distribution satisfies the whole year.
 * That is a standard planning technique, not an accounting trick, and it is why option (b) below
 * needs no safe-harbor machinery.
 *
 * THE MODEL IS BORROWED, NOT INVENTED. `taxPaymentPlanner.js` already prices this and has 61 tests
 * behind it. Its carry runs to APRIL 15 OF THE FOLLOWING YEAR - `carry = m => max(0, 16 - m) / 12`,
 * month 16 - not to December 31, and `withholdOC = w * r * carry(m)` is the growth given up when tax
 * leaves early. An earlier estimate of mine used ten months and December as the reference and so
 * UNDERSTATED the prize; borrowing the model rather than guessing is the point of this file.
 *
 * TWO SETTLEMENT POINTS, both priced, because they are different products:
 *
 *   (b) DECEMBER withholding    gain per year = tax * r * (12 - m) / 12
 *       Withhold on a December draw. One extra settlement point inside the year, nothing crosses a
 *       year boundary. This is the cheap 80%.
 *
 *   (c) APRIL 15 next year      gain per year = tax * r * (16 - m) / 12
 *       The real due date. Four more months of carry than (b), and it creates a CROSS-YEAR
 *       LIABILITY the engine has never had, which is why it is costed here and deferred there.
 *
 * WHAT THIS IS NOT. A first-order estimate: it prices the growth on the tax dollars and compounds it
 * forward, and does not model the feedback of a larger balance on later withdrawals, brackets or
 * RMDs. Right shape for deciding whether to build; wrong shape for a headline.
 *
 * RUN:  node .test_harnesses/tax_timing_harness.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const R = path.join(__dirname, '..') + path.sep;
Object.assign(globalThis, require(R + 'taxengine.js'));
require(R + 'displayhelpers.js');
const { simulate } = require(R + 'optimizer_core.js');

function loadFixture(name) {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
    const meta = raw.__meta; delete raw.__meta;
    for (const k of (meta.undefinedKeys || [])) raw[k] = undefined;
    return raw;
}
const BASE = loadFixture('p106_canonical.json');
const money = (v) => (v < 0 ? '-' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
const pct = (v, d = 2) => (v * 100).toFixed(d) + '%';

// Same five households as CONVERSION_VALUE_HOUSEHOLDS.md, so the numbers read side by side.
const HOUSEHOLDS = [
    { key: 'CANON', over: {} },
    { key: 'H1-single', over: { hasSpouse: false, STATEname: 'CA', birthyear1: 1962, birthmonth1: 6, die1: 92,
        IRA1: 1800000, IRA2: 0, Roth: 150000, Roth2: 0, Brokerage: 400000, BrokerageBasis: 150000, Cash: 60000,
        ss1: 42000, ss1Age: 67, ss2: 0, pensionAnnual: 0, spendGoal: 110000, spendChange: 0, convEndYear: 2034 } },
    { key: 'H2-longwidow', over: { hasSpouse: true, STATEname: 'TX', birthyear1: 1955, birthmonth1: 3, die1: 84,
        birthyear2: 1968, birthmonth2: 9, die2: 95, IRA1: 2500000, IRA2: 300000, Roth: 200000, Roth2: 40000,
        Brokerage: 500000, BrokerageBasis: 200000, Cash: 80000, ss1: 48000, ss1Age: 70, ss2: 26000, ss2Age: 67,
        pensionAnnual: 0, spendGoal: 150000, spendChange: 0, convEndYear: 2036 } },
    { key: 'H3-IRAlight', over: { hasSpouse: true, STATEname: 'NY', birthyear1: 1958, birthmonth1: 4, die1: 90,
        birthyear2: 1960, birthmonth2: 11, die2: 92, IRA1: 600000, IRA2: 100000, Roth: 150000, Roth2: 30000,
        Brokerage: 2600000, BrokerageBasis: 1000000, Cash: 200000, ss1: 45000, ss1Age: 67, ss2: 30000, ss2Age: 67,
        pensionAnnual: 0, spendGoal: 160000, spendChange: 0, convEndYear: 2034 } },
    { key: 'H4-tight', over: { hasSpouse: true, STATEname: 'CA', birthyear1: 1961, birthmonth1: 8, die1: 89,
        birthyear2: 1963, birthmonth2: 2, die2: 91, IRA1: 1100000, IRA2: 150000, Roth: 60000, Roth2: 10000,
        Brokerage: 250000, BrokerageBasis: 120000, Cash: 50000, ss1: 36000, ss1Age: 67, ss2: 22000, ss2Age: 67,
        pensionAnnual: 0, spendGoal: 105000, spendChange: 0, convEndYear: 2034 } },
];

// The month the year's money actually leaves. `timing` reads 'Early(...)' or 'Late(...)', which are
// preMonths 1 and 11 - the same two the engine picks between. Read off the row rather than
// re-derived, so a change to the rule cannot leave this harness quietly measuring the old one.
const monthOf = (row) => (String(row.timing).startsWith('Early') ? 1 : 11);

function priceOne(over, timingArm) {
    const inp = { ...BASE, ...over, computeOC: false };
    if (timingArm) inp.forceWithdrawTiming = timingArm;
    const r = simulate(inp);
    const log = r.log;
    const growth = (over.growth ?? BASE.growth ?? 0.06);
    let gainB = 0, gainC = 0, taxTotal = 0, earlyYears = 0;

    for (let y = 0; y < log.length; y++) {
        const tax = log[y].totalTax ?? 0;
        if (tax <= 0) continue;
        const m = monthOf(log[y]);
        if (m === 1) earlyYears++;
        taxTotal += tax;
        // Growth the tax dollars would earn by settling later instead of at month m.
        let b = tax * growth * Math.max(0, 12 - m) / 12;
        let c = tax * growth * Math.max(0, 16 - m) / 12;
        // Compound each year's gain forward to the end of the plan.
        const yearsLeft = log.length - 1 - y;
        const factor = Math.pow(1 + growth, yearsLeft);
        gainB += b * factor;
        gainC += c * factor;
    }
    const last = log[log.length - 1];
    const defl = last.inflationFactor || 1;
    return {
        gainB: gainB / defl, gainC: gainC / defl, taxTotal,
        nw: r.finalNW / defl, earlyYears, years: log.length,
        spend: r.totals.spend, ok: r.totals.success !== false,
    };
}

console.log('\nP108a - what is it worth to pay the tax later?');
console.log('='.repeat(104));
console.log('Carry model borrowed from taxPaymentPlanner.js: settle in December (b) or April 15 next year (c).');
console.log('Gains are real year-0 dollars, compounded forward. First-order: no feedback on later brackets or RMDs.');
console.log('-'.repeat(104));
console.log('\n' + 'household'.padEnd(15) + 'timing'.padEnd(9) + 'earlyYrs'.padStart(9)
    + 'lifetimeTax'.padStart(14) + '(b) Dec'.padStart(13) + '% NW'.padStart(8)
    + '(c) Apr15'.padStart(13) + '% NW'.padStart(8));

for (const h of HOUSEHOLDS) {
    for (const arm of [null, 'early', 'late']) {
        let p;
        try { p = priceOne(h.over, arm); } catch (e) { console.log('  ' + h.key + ' ' + arm + ': ' + e.message); continue; }
        if (!p.ok) { console.log('  ' + h.key + ' ' + (arm || 'auto') + ': FAILS'); continue; }
        console.log((arm === null ? h.key : '').padEnd(15) + (arm || 'auto').padEnd(9)
            + (p.earlyYears + '/' + p.years).padStart(9)
            + money(p.taxTotal).padStart(14)
            + money(p.gainB).padStart(13) + pct(p.gainB / p.nw).padStart(8)
            + money(p.gainC).padStart(13) + pct(p.gainC / p.nw).padStart(8));
    }
}
console.log('\n' + '='.repeat(104));
console.log('Read the AUTO row for what the shipped rule leaves on the table today.');
console.log('EARLY is the worst case (tax out in January, 11 months of carry lost under (b));');
console.log('LATE is the best case already reachable with the shipped withdrawal-month control.');
