/**
 * mix_steering_harness.js -- where each strategy's OWN control lands the IRA/Roth balance.
 *
 * THE QUESTION. A household holding far more IRA than Roth (4x and up) wants to end nearer a
 * balance between them, after tax. Three strategies do that work: Reduce, Fill a Fed/IRMAA ceiling,
 * and IRA Draw at a rate above growth. Each is steered by a DIFFERENT control:
 *
 *   Reduce ......... the IRA Goal
 *   Fill ........... the ceiling chosen (a Fed bracket, or an IRMAA tier)
 *   IRA Draw ....... the draw percentage
 *
 * and SPENDING moves all three, because spending draws the IRA down whether or not the strategy
 * means it to.
 *
 * WHAT THIS FIXES ABOUT AN EARLIER PROBE. A first pass held each strategy's own lever fixed, swept
 * the IRA Goal across all three, and reported that Fill and IRA Draw "do nothing". That was the
 * wrong reading: the Goal was never their lever. Sweeping a control a strategy does not read says
 * nothing about whether the strategy can be steered. Each family is now swept on the thing that
 * actually steers it.
 *
 * WHAT IT PRODUCES. A landscape, not a recommendation. For each family, where its own control puts
 * the after-tax IRA/Roth balance, and what that costs. The point of the tool is to remove the
 * hand-tweaking, so the deliverable is the whole curve and its trade, not one "best" setting.
 *
 * THE BALANCE METRIC. `IRA share` = afterTaxIRA / (afterTaxIRA + Roth) at the end of the plan,
 * where afterTaxIRA discounts at the row's widow-scoped terminal rate (P106g). 50% is parity. It is
 * a starting place to steer toward and explicitly NOT claimed to be optimal - measured on the
 * reference household, the net-worth peak sits well away from it.
 *
 * RUN:  node .test_harnesses/mix_steering_harness.js
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

const M = (v) => (v < 0 ? '-' : '') + '$' + (Math.abs(v) / 1e6).toFixed(2) + 'M';
const PC = (v) => (v * 100).toFixed(1) + '%';

// One point on the landscape.
function point(over) {
    let r;
    try { r = simulate({ ...BASE, ...over, computeOC: false }); } catch (e) { return null; }
    const L = r.log[r.log.length - 1];
    const defl = L.inflationFactor || 1;
    const rate = L['-termIRARate'] ?? 0;
    const iraAT = (((L.IRA1 ?? 0) + (L.IRA2 ?? 0)) * (1 - rate)) / defl;
    const roth = (L.Roth ?? 0) / defl;
    const denom = iraAT + roth;
    return {
        share: denom > 0 ? iraAT / denom : 1,
        iraAT, roth,
        nw: r.finalNW / defl,
        spend: r.totals.spend,
        conv: r.log.reduce((s, x) => s + (x.rothConv ?? 0), 0),
        ok: r.totals.success !== false,
    };
}

// Each family, and the control that actually steers it.
const FAMILIES = [
    {
        key: 'Reduce', control: 'IRA Goal',
        values: [0, 500000, 1000000, 2000000, 2740000, 4000000, 5000000],
        label: (v) => '$' + (v / 1e6).toFixed(2) + 'M',
        over: (v) => ({ strategy: 'fixed', iraBaseGoal: v }),
    },
    {
        key: 'Fill', control: 'ceiling',
        values: ['fed12', 'fed22', 'fed24', 'fed32', 'irmaa0', 'irmaa1', 'irmaa2', 'irmaa3', 'irmaa4'],
        label: (v) => v,
        over: (v) => v.startsWith('fed')
            ? { strategy: 'bracket', stratRate: +v.slice(3) / 100, stratIRMAATier: -1 }
            : { strategy: 'bracket', stratRate: 0, stratIRMAATier: +v.slice(5) },
    },
    {
        key: 'IRA Draw', control: 'draw %',
        values: [0.04, 0.05, 0.06, 0.07, 0.08, 0.10, 0.12, 0.15],
        label: (v) => (v * 100).toFixed(0) + '%',
        over: (v) => ({ strategy: 'fixedpct', iraWithdrawPct: v }),
    },
];

// Spending is an axis, not a constant: it draws the IRA down regardless of strategy.
const SPENDS = [190000, 220000, 250000];

const startIRA = BASE.IRA1 + BASE.IRA2;
const startRoth = BASE.Roth + BASE.Roth2;
console.log('\nWhere each strategy\'s own control lands the after-tax IRA/Roth balance');
console.log('='.repeat(104));
console.log('household: IRA ' + M(startIRA) + ' / Roth ' + M(startRoth)
    + '  = ' + (startIRA / startRoth).toFixed(1) + 'x   growth ' + PC(BASE.growth)
    + '   spend axis ' + SPENDS.map(s => '$' + s / 1000 + 'k').join(' / '));
console.log('IRA share = afterTaxIRA / (afterTaxIRA + Roth) at plan end. 50% is parity.');
console.log('-'.repeat(104));

for (const fam of FAMILIES) {
    console.log('\n' + fam.key + '   (steered by ' + fam.control + ')');
    console.log('   ' + 'setting'.padEnd(10)
        + SPENDS.map(s => ('spend $' + s / 1000 + 'k').padStart(30)).join(''));
    console.log('   ' + ''.padEnd(10)
        + SPENDS.map(() => 'IRAshare'.padStart(11) + 'NW'.padStart(10) + 'conv'.padStart(9)).join(''));
    for (const v of fam.values) {
        const cells = SPENDS.map(sp => point({ ...fam.over(v), spendGoal: sp }));
        console.log('   ' + fam.label(v).padEnd(10) + cells.map(c => c === null || !c.ok
            ? '        FAIL'.padStart(30)
            : PC(c.share).padStart(11) + M(c.nw).padStart(10) + M(c.conv).padStart(9)).join(''));
    }
    // Where does its own control get closest to parity, at the middle spend?
    const mid = SPENDS[1];
    const scan = fam.values.map(v => ({ v, p: point({ ...fam.over(v), spendGoal: mid }) }))
        .filter(x => x.p && x.p.ok);
    if (scan.length) {
        const nearest = scan.reduce((b, x) => Math.abs(x.p.share - 0.5) < Math.abs(b.p.share - 0.5) ? x : b);
        const richest = scan.reduce((b, x) => x.p.nw > b.p.nw ? x : b);
        console.log('   at $' + mid / 1000 + 'k: closest to parity = ' + fam.label(nearest.v)
            + ' (' + PC(nearest.p.share) + ', NW ' + M(nearest.p.nw) + ')'
            + '   |   most net worth = ' + fam.label(richest.v)
            + ' (' + PC(richest.p.share) + ', NW ' + M(richest.p.nw) + ')'
            + (nearest.v === richest.v ? '   [same setting]'
                : '   [costs ' + M(richest.p.nw - nearest.p.nw) + ' to sit at parity]'));
    }
}
console.log('\n' + '='.repeat(104));
