/**
 * conversion_frontier_harness.js -- Phase P106f.
 *
 * WHY THIS EXISTS, and what it corrects about P106b.
 *
 * `conversion_value_harness.js` holds the STRATEGY fixed and switches conversions off, which answers
 * "what do conversions cost inside this strategy". That is an attribution question. It is not the
 * question a person choosing a plan actually faces, which is:
 *
 *     "Here is the plan with the highest net worth available to me. I am going to pick a different
 *      one because it holds more Roth. What is that costing me?"
 *
 * Those are different baselines and they are BOTH legitimate. P106b's report called the second one a
 * misreading of the first and decomposed it away. That framing was wrong: comparing your pick to the
 * best net-worth plan on the board is the only way to see what the lost net worth is buying, and it
 * is the comparison a rational chooser makes. This harness measures it directly.
 *
 * BEST-NW is therefore an argmax over the WHOLE board - every strategy, conversions on and off - and
 * every other plan is priced against it.
 *
 * NOTE ON WHAT IS AND IS NOT CONFOUNDED. A BEST-NW comparison deliberately moves more than one
 * variable, and that is the point: it is a CHOICE between two whole plans, not an attribution of a
 * single lever. Groundrule 6 still applies to attribution, which is what P106b is for. Both reports
 * are needed and neither replaces the other.
 *
 * --------------------------------------------------------------------------------------------
 * PREDICTIONS, REGISTERED BEFORE THE FIRST RUN. Committed unrun; scored as written.
 *
 *   D1  On the canonical household the BEST-NW plan is a NON-converting plan.
 *   D2  In at least one of the five households the BEST-NW plan IS a converting plan. (The
 *       hypothesis under test: "some circumstances WILL produce more networth due to Conversions -
 *       but those are probably unlikely.")
 *   D3  On the canonical household, the net worth given up going from BEST-NW to the highest-Roth
 *       plan is more than 5x the same-strategy conversion cost P106b measured ($49,121 real).
 *   D4  The BEST-NW plan holds less Roth than the highest-Roth plan in EVERY household - i.e. the
 *       two objectives never coincide.
 *   D5  Ranking by net worth and ranking by "net worth counting only Roth and Brokerage as ideal"
 *       disagree on the top plan in at least 3 of 5 households.
 * --------------------------------------------------------------------------------------------
 *
 * RUN:  node .test_harnesses/conversion_frontier_harness.js
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
const core = require(R + 'optimizer_core.js');
const { simulate, afterTaxWealthOfLogRow } = core;

const HEIRS = 0.24;
const money = (v) => (v < 0 ? '-' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
const pct = (v, d = 2) => (v * 100).toFixed(d) + '%';
const rule = (c = '─') => console.log(c.repeat(112));

function loadFixture(name) {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
    const meta = raw.__meta; delete raw.__meta;
    for (const k of (meta.undefinedKeys || [])) raw[k] = undefined;
    return raw;
}
const CANON = loadFixture('p106_canonical.json');

// Same five households as P106c, so the two reports can be read side by side.
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

// The board: every shipped strategy the canonical inputs can express, each with conversions on and
// off. `conv:'off'` is ROUTING-OFF (same draw, surplus banked in the Brokerage), the baseline that
// leaves the withdrawal behavior alone.
const STRATEGIES = [
    ['Proportional +%', { strategy: 'propwd' }],
    ['Reduce IRA 11yr', { strategy: 'fixed' }],
    ['Fixed %', { strategy: 'fixedpct' }],
    ['Ordered CIBR', { strategy: 'ordered', orderedSeq: 'CIBR' }],
    ['Ordered CBIR', { strategy: 'ordered', orderedSeq: 'CBIR' }],
    ['Ordered BCIR', { strategy: 'ordered', orderedSeq: 'BCIR' }],
    ['Split B90/C10', { strategy: 'split', splitWeights: [0, 9, 1, 0] }],
    ['Fill Bracket 22%', { strategy: 'bracket', stratRate: 0.22 }],
    ['Fill Bracket 24%', { strategy: 'bracket', stratRate: 0.24 }],
    ['IRMAA Tier 1', { strategy: 'irmaaTiers', stratIRMAATier: 1 }],
];

function run(base, over, conv) {
    const inp = { ...base, ...over };
    if (conv === 'off') { inp.convertExcessToRoth = false; inp.extraConversionAmount = 0; }
    let res;
    try { res = simulate({ ...inp, computeOC: false }); } catch (e) { return null; }
    const log = res.log, last = log[log.length - 1];
    const years = log.length - 1;
    const deflator = Math.pow(1 + (inp.inflation ?? 0), years);
    const ira = (last.IRA1 ?? 0) + (last.IRA2 ?? 0);
    const roth = last.Roth ?? 0, brok = last.Brokerage ?? 0, cash = last.Cash ?? 0;
    return {
        conv, nw: afterTaxWealthOfLogRow(last, HEIRS) / deflator,
        roth: roth / deflator, ira: ira / deflator, brok: brok / deflator, cash: cash / deflator,
        // "ideal" buckets, per the stated preference that Roth and Brokerage are worth more than IRA
        ideal: (roth + brok + cash) / deflator,
        conversions: log.reduce((s, r) => s + (r.rothConv ?? 0), 0),
        spend: res.totals.spend, success: res.totals.success,
    };
}

console.log('\nP106f - what does the lost net worth actually buy?');
rule('═');
console.log('BEST-NW is the argmax of real after-tax net worth over the WHOLE board:');
console.log(STRATEGIES.length + ' strategies x {conversions on, off}, shared heirs rate ' + pct(HEIRS, 0) + ', year-0 dollars.');
console.log('Every other plan is priced against it. Spend is checked, not assumed.');
rule();

const summary = [];
for (const h of HOUSEHOLDS) {
    const base = { ...CANON, ...h.over };
    const board = [];
    for (const [label, over] of STRATEGIES) {
        for (const conv of ['on', 'off']) {
            const r = run(base, over, conv);
            if (r && r.success !== false) board.push({ label, ...r });
        }
    }
    if (!board.length) { console.log('\n' + h.key + ': no feasible plans'); continue; }

    const bestNW = board.reduce((b, r) => (r.nw > b.nw ? r : b), board[0]);
    const bestRoth = board.reduce((b, r) => (r.roth > b.roth ? r : b), board[0]);
    const bestIdeal = board.reduce((b, r) => (r.ideal > b.ideal ? r : b), board[0]);
    const spendGap = Math.max(...board.map(r => Math.abs(r.spend - bestNW.spend)));

    console.log('\n' + h.key + '   (' + board.length + ' feasible plans; largest lifetime spend gap ' + money(spendGap) + ')');
    console.log('   ' + 'role'.padEnd(11) + 'plan'.padEnd(20) + 'conv'.padEnd(6)
        + 'NW real'.padStart(14) + 'Roth'.padStart(14) + 'IRA'.padStart(14)
        + 'converted'.padStart(13) + '   vs BEST-NW');
    const show = (role, r) => {
        const d = r.nw - bestNW.nw;
        console.log('   ' + role.padEnd(11) + r.label.padEnd(20) + r.conv.padEnd(6)
            + money(r.nw).padStart(14) + money(r.roth).padStart(14) + money(r.ira).padStart(14)
            + money(r.conversions).padStart(13)
            + '   ' + (r === bestNW ? '-' : money(d) + '  (' + pct(d / bestNW.nw) + ')'));
    };
    show('BEST-NW', bestNW);
    show('BEST-Roth', bestRoth);
    if (bestIdeal !== bestNW && bestIdeal !== bestRoth) show('BEST-ideal', bestIdeal);

    const dNW = bestRoth.nw - bestNW.nw;
    const dRoth = bestRoth.roth - bestNW.roth;
    console.log('   -> choosing the highest-Roth plan over the highest-net-worth plan:');
    console.log('        gives up ' + money(-dNW) + ' of net worth (' + pct(-dNW / bestNW.nw) + ')');
    console.log('        gains    ' + money(dRoth) + ' of Roth');
    console.log('        exchange ' + (dNW < 0 ? (dRoth / -dNW).toFixed(2) + ' : 1' : 'DOMINANT - the Roth plan also has more net worth'));

    summary.push({ key: h.key, bestNW, bestRoth, bestIdeal, dNW, dRoth });
}

// ── the board, canonical household in full ───────────────────────────────────────────────────
console.log('\n\nTHE WHOLE BOARD, canonical household, ranked by net worth');
rule();
{
    const board = [];
    for (const [label, over] of STRATEGIES) for (const conv of ['on', 'off']) {
        const r = run(CANON, over, conv);
        if (r && r.success !== false) board.push({ label, ...r });
    }
    board.sort((a, b) => b.nw - a.nw);
    const top = board[0];
    console.log('   ' + 'plan'.padEnd(20) + 'conv'.padEnd(6) + 'NW real'.padStart(14)
        + 'Roth'.padStart(14) + 'IRA'.padStart(14) + 'Roth+Brok+Cash'.padStart(16) + '   vs best');
    for (const r of board) {
        console.log('   ' + r.label.padEnd(20) + r.conv.padEnd(6) + money(r.nw).padStart(14)
            + money(r.roth).padStart(14) + money(r.ira).padStart(14) + money(r.ideal).padStart(16)
            + '   ' + (r === top ? '-' : money(r.nw - top.nw)));
    }
}

// ── predictions ──────────────────────────────────────────────────────────────────────────────
rule('═');
console.log('PREDICTIONS, scored as written');
rule();
const canon = summary.find(s => s.key === 'CANON');
const convWins = summary.filter(s => s.bestNW.conversions > 1);
const neverCoincide = summary.every(s => s.bestNW.roth < s.bestRoth.roth);
const idealDisagree = summary.filter(s => s.bestIdeal.label !== s.bestNW.label
    || s.bestIdeal.conv !== s.bestNW.conv).length;
const verdicts = [
    ['D1', 'canonical BEST-NW is a NON-converting plan', canon.bestNW.conversions <= 1,
        canon.bestNW.label + ' / conv ' + canon.bestNW.conv + ', converted ' + money(canon.bestNW.conversions)],
    ['D2', 'BEST-NW is a CONVERTING plan somewhere', convWins.length >= 1,
        convWins.length ? convWins.map(s => s.key).join(', ') : 'in none of the five'],
    ['D3', 'canonical give-up > 5x the $49,121 same-strategy cost', (-canon.dNW) > 5 * 49121,
        money(-canon.dNW) + ' vs 5x $49,121 = ' + money(5 * 49121)],
    ['D4', 'BEST-NW never also holds the most Roth', neverCoincide,
        neverCoincide ? 'they differ in all 5' : 'they coincide somewhere'],
    ['D5', 'NW ranking and Roth+Brok+Cash ranking disagree in >=3 of 5', idealDisagree >= 3,
        idealDisagree + ' of ' + summary.length + ' households disagree'],
];
for (const [id, claim, held, ev] of verdicts) {
    console.log('  ' + id + '  ' + (held ? 'HELD  ' : 'BROKEN') + '  ' + claim.padEnd(52) + '  ' + ev);
}
rule('═');
