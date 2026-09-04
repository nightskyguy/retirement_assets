/**
 * conversion_value_general_harness.js -- Phase P106c.
 *
 * Runs the P106b metric over deliberately varied households, to find out how much of
 * `research/CONVERSION_VALUE.md` is about conversions and how much is about the user's own plan.
 *
 * P106 groundrule 1: these are reported SEPARATELY and are never averaged into the headline. The
 * canonical scenario stays the headline; this file is the generalization check.
 *
 * THE USER'S STANDING OBJECTION TO FIXTURE SETS, which shaped every household below: the 5-6
 * households used elsewhere in this repo "were chosen as knife-edge defaults and may not reflect
 * real balances, ages or spend". So each household here is an ordinary retiree household, each
 * varies on a named axis, and the reason for each is written down next to it.
 *
 * HOW THEY ARE BUILT: by overriding named fields on `fixtures/p106_canonical.json`, which is itself
 * the verbatim output of the page's own getInputs(). Nothing re-decodes a share URL, so the
 * drift `fixtures/README.md` warns about cannot occur - every field not named below keeps a value
 * the real decoder produced.
 *
 * AXES VARIED (groundrule 1 names the first four; the fifth is the user's own reasoning):
 *   filing status .......... H1 is single and never has a survivor transition at all
 *   state .................. CA, TX (no income tax), NY
 *   horizon ................ 28 to 38 years
 *   IRA-to-taxable ratio ... H3 holds most of its wealth already taxable
 *   surplus over need ...... H4 has little of it, and the user's stated rule is that willingness
 *                            to trade tracks surplus rather than wealth
 *
 * WHY A LONG WIDOWHOOD IS IN THE SET: P106b's strongest result was that converting more than halves
 * the survivor's tax bill, measured on a survivor window only TWO years long. H2 exists to test that
 * on a 24-year one, which is where the effect should be largest if the mechanism is what it looks
 * like.
 *
 * --------------------------------------------------------------------------------------------
 * PREDICTIONS, REGISTERED BEFORE THE FIRST RUN. Committed unrun; scored as written.
 *
 *   C1  The SINGLE filer (H1) still shows conversions paying against DRAW-OFF - a positive exchange
 *       rate - even with no survivor transition to avoid, because single brackets are compressed
 *       for the whole plan rather than only after a death.
 *   C2  The LONG-WIDOWHOOD household (H2) shows a larger absolute survivor-year tax saving than the
 *       canonical's $380,460.
 *   C3  The IRA-LIGHT household (H3) shows dRoth under 25% of the canonical's $5,000,390.
 *   C4  The TIGHT-FUNDING household (H4) gives up a larger share of surplus over need than the
 *       canonical's 2.36%.
 *   C5  The baseline ambiguity is STRUCTURAL, not a quirk of the canonical scenario: ROUTING-OFF and
 *       DRAW-OFF disagree on the sign of dNW in at least half the households.
 *   C6  No household is DOMINANT against DRAW-OFF at the 24% headline rate.
 *   C7  Spend is equal to within $100 across all three arms in every household.
 *   C8  At least one household reverses the canonical verdict, i.e. converting does not pay there.
 * --------------------------------------------------------------------------------------------
 *
 * RUN:  node .test_harnesses/conversion_value_general_harness.js
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
const BAND = [0.12, 0.22, 0.24, 0.32, 0.37];
const XR_FLOOR = 10000;

function loadFixture(name) {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
    const meta = raw.__meta;
    delete raw.__meta;
    for (const k of (meta.undefinedKeys || [])) raw[k] = undefined;
    return raw;
}
const money = (v) => (v < 0 ? '-' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
const pct = (v, d = 2) => (v * 100).toFixed(d) + '%';
const rule = (c = '─') => console.log(c.repeat(112));
const CANON = loadFixture('p106_canonical.json');

// ── the households ───────────────────────────────────────────────────────────────────────────
// Each `over` is applied to the canonical fixture. `why` is printed with the results, so no row in
// the output is unexplained.
const HOUSEHOLDS = [
    {
        key: 'CANON', label: 'the canonical scenario (the user\'s own plan)',
        why: 'carried through as the reference row; it is the headline everywhere else',
        over: {},
    },
    {
        key: 'H1-single', label: 'H1  single filer, CA, no survivor transition',
        why: 'filing status. Single brackets apply for the WHOLE plan rather than only after a death, '
            + 'so this separates "compressed brackets" from "the widow penalty"',
        over: {
            hasSpouse: false, STATEname: 'CA',
            birthyear1: 1962, birthmonth1: 6, die1: 92,
            IRA1: 1800000, IRA2: 0, Roth: 150000, Roth2: 0,
            Brokerage: 400000, BrokerageBasis: 150000, Cash: 60000,
            ss1: 42000, ss1Age: 67, ss2: 0, pensionAnnual: 0,
            spendGoal: 110000, spendChange: 0, convEndYear: 2034,
        },
    },
    {
        key: 'H2-longwidow', label: 'H2  13-year age gap, TX, 24-year widowhood',
        why: 'the widow axis, and the one P106b could not test. Its survivor window is 24 years '
            + 'against the canonical\'s 2. TX has no state income tax, so the effect is federal only',
        over: {
            hasSpouse: true, STATEname: 'TX',
            birthyear1: 1955, birthmonth1: 3, die1: 84,
            birthyear2: 1968, birthmonth2: 9, die2: 95,
            IRA1: 2500000, IRA2: 300000, Roth: 200000, Roth2: 40000,
            Brokerage: 500000, BrokerageBasis: 200000, Cash: 80000,
            ss1: 48000, ss1Age: 70, ss2: 26000, ss2Age: 67, pensionAnnual: 0,
            spendGoal: 150000, spendChange: 0, convEndYear: 2036,
        },
    },
    {
        key: 'H3-IRAlight', label: 'H3  most wealth already taxable, NY',
        why: 'the IRA-to-taxable axis. $700k of IRA against $2.6M of brokerage, the reverse of the '
            + 'canonical, so there is little left to convert',
        over: {
            hasSpouse: true, STATEname: 'NY',
            birthyear1: 1958, birthmonth1: 4, die1: 90,
            birthyear2: 1960, birthmonth2: 11, die2: 92,
            IRA1: 600000, IRA2: 100000, Roth: 150000, Roth2: 30000,
            Brokerage: 2600000, BrokerageBasis: 1000000, Cash: 200000,
            ss1: 45000, ss1Age: 67, ss2: 30000, ss2Age: 67, pensionAnnual: 0,
            spendGoal: 160000, spendChange: 0, convEndYear: 2034,
        },
    },
    {
        key: 'H4-tight', label: 'H4  modest balances, little surplus over need',
        why: 'the surplus-over-need axis. The user\'s own rule is that willingness to trade tracks '
            + 'surplus rather than wealth ("if my assets were smaller, I would be less aggressive")',
        over: {
            hasSpouse: true, STATEname: 'CA',
            birthyear1: 1961, birthmonth1: 8, die1: 89,
            birthyear2: 1963, birthmonth2: 2, die2: 91,
            IRA1: 1100000, IRA2: 150000, Roth: 60000, Roth2: 10000,
            Brokerage: 250000, BrokerageBasis: 120000, Cash: 50000,
            ss1: 36000, ss1Age: 67, ss2: 22000, ss2Age: 67, pensionAnnual: 0,
            spendGoal: 105000, spendChange: 0, convEndYear: 2034,
        },
    },
];

// ── one arm ──────────────────────────────────────────────────────────────────────────────────
function run(over, conv) {
    const inp = { ...CANON, ...over };
    if (conv === 'routing-off') { inp.convertExcessToRoth = false; inp.extraConversionAmount = 0; }
    if (conv === 'draw-off') { inp._cfSuppressConversions = true; }
    const res = simulate({ ...inp, computeOC: false });
    const log = res.log, last = log[log.length - 1];

    let firstSingleIdx = -1;
    for (let i = 1; i < log.length; i++) {
        if (log[i].status === 'SGL' && log[i - 1].status === 'MFJ') { firstSingleIdx = i; break; }
    }
    const survivorRows = firstSingleIdx < 0 ? [] : log.slice(firstSingleIdx);
    const atFirstDeath = firstSingleIdx < 0 ? null : log[firstSingleIdx - 1];
    const taxOf = (r) => (r.totalTax ?? r.tax ?? 0);

    const years = log.length - 1;
    const deflator = Math.pow(1 + (inp.inflation ?? 0), years);
    const nwAt = (rate) => afterTaxWealthOfLogRow(last, rate) / deflator;

    let floor = 0;
    log.forEach((r, i) => {
        floor += Math.max(0, (r.spendGoal ?? 0) - (r.guaranteedIncome ?? 0)) / Math.pow(1 + (inp.growth ?? 0.06), i);
    });

    return {
        conv, spend: res.totals.spend, success: res.totals.success,
        years: log.length, firstYear: log[0].year, lastYear: last.year,
        conversions: log.reduce((s, r) => s + (r.rothConv ?? 0), 0),
        tax: res.totals.tax,
        rothEnd: last.Roth ?? 0,
        rothAtFirstDeath: atFirstDeath ? (atFirstDeath.Roth ?? 0) : null,
        iraEnd: (last.IRA1 ?? 0) + (last.IRA2 ?? 0),
        brokEnd: last.Brokerage ?? 0,
        nw: nwAt(HEIRS), nwAt, floor,
        startNW: (inp.IRA1 || 0) + (inp.IRA2 || 0) + (inp.Roth || 0) + (inp.Roth2 || 0)
            + (inp.Brokerage || 0) + (inp.Cash || 0),
        survivorYears: survivorRows.length,
        survivorFirstYear: survivorRows.length ? survivorRows[0].year : null,
        survivorTax: survivorRows.reduce((s, r) => s + taxOf(r), 0),
        survivorMarginal: survivorRows.length
            ? survivorRows.reduce((s, r) => s + (r['NominalRate%'] ?? 0), 0) / survivorRows.length : null,
    };
}

console.log('\nP106c - how much of the P106b result is about conversions, and how much about one plan?');
rule('═');
console.log('Reported SEPARATELY per household, never averaged (P106 groundrule 1).');
console.log('Shared heirs rate ' + pct(HEIRS, 0) + ', real year-0 dollars, stop year fixed per household.');
rule();

const out = [];
for (const h of HOUSEHOLDS) {
    const on = run(h.over, 'on');
    const routingOff = run(h.over, 'routing-off');
    const drawOff = run(h.over, 'draw-off');
    out.push({ h, on, routingOff, drawOff });
}

// ── 1. per household ─────────────────────────────────────────────────────────────────────────
for (const { h, on, routingOff, drawOff } of out) {
    console.log('\n' + h.label);
    console.log('   why: ' + h.why);
    console.log('   plan ' + on.firstYear + '-' + on.lastYear + ' (' + on.years + 'y)'
        + '   survivor window ' + (on.survivorYears ? on.survivorYears + 'y from ' + on.survivorFirstYear : 'none')
        + '   starting portfolio ' + money(on.startNW)
        + '   succeeds: ' + [on.success, routingOff.success, drawOff.success].join('/'));
    console.log('   converted ' + money(on.conversions)
        + '   floor ' + money(on.floor) + '   surplus over need ' + money(on.startNW - on.floor));
    console.log('     ' + 'baseline'.padEnd(13) + 'dRoth(end)'.padStart(14) + 'dRoth(1st dth)'.padStart(16)
        + 'dNW real'.padStart(13) + 'dNW %NW'.padStart(9) + '  %surplus'.padStart(10)
        + '   exchange   verdict');
    for (const [name, base] of [['ROUTING-OFF', routingOff], ['DRAW-OFF', drawOff]]) {
        const dRoth = on.rothEnd - base.rothEnd;
        const dRothFD = (on.rothAtFirstDeath ?? 0) - (base.rothAtFirstDeath ?? 0);
        const dNW = on.nw - base.nw;
        const surplus = on.startNW - on.floor;
        const dominant = dNW >= 0 && dRoth > 0;
        const xr = dNW >= 0 ? '-' : (-dNW < XR_FLOOR ? 'n/m' : (dRoth / -dNW).toFixed(2) + ' : 1');
        console.log('     ' + name.padEnd(13) + money(dRoth).padStart(14) + money(dRothFD).padStart(16)
            + money(dNW).padStart(13) + pct(dNW / base.nw).padStart(9)
            + pct(dNW / surplus).padStart(10) + '   ' + String(xr).padStart(11)
            + '   ' + (dRoth === 0 && dNW === 0 ? 'identical plan, never converts'
                : dominant ? 'DOMINANT' : 'a trade'));
    }
    console.log('     spend  ' + money(on.spend) + ' / ' + money(routingOff.spend) + ' / ' + money(drawOff.spend)
        + '   max gap ' + money(Math.max(Math.abs(on.spend - routingOff.spend), Math.abs(on.spend - drawOff.spend))));
    console.log('     widow  survivor-year tax ' + money(on.survivorTax)
        + ' with conversions vs ' + money(drawOff.survivorTax) + ' draw-off  ('
        + money(on.survivorTax - drawOff.survivorTax) + ')'
        + '   marginal ' + pct(on.survivorMarginal ?? 0) + ' vs ' + pct(drawOff.survivorMarginal ?? 0));
}

// ── 2. the comparison table ──────────────────────────────────────────────────────────────────
console.log('\n\nSIDE BY SIDE  (each column its own household; NOT averaged)');
rule();
const rows = [
    ['converted', r => money(r.on.conversions)],
    ['dRoth (end)', r => money(r.on.rothEnd - r.drawOff.rothEnd)],
    ['dNW vs ROUTING-OFF', r => money(r.on.nw - r.routingOff.nw)],
    ['dNW vs DRAW-OFF', r => money(r.on.nw - r.drawOff.nw)],
    ['  as % of surplus', r => pct((r.on.nw - r.drawOff.nw) / (r.on.startNW - r.on.floor))],
    ['exchange vs DRAW-OFF', r => {
        const d = r.on.nw - r.drawOff.nw, dr = r.on.rothEnd - r.drawOff.rothEnd;
        return d >= 0 ? 'DOMINANT' : (-d < XR_FLOOR ? 'n/m' : (dr / -d).toFixed(1) + ':1');
    }],
    ['survivor window', r => r.on.survivorYears ? r.on.survivorYears + 'y' : 'none'],
    ['survivor tax saved', r => r.on.survivorYears ? money(r.drawOff.survivorTax - r.on.survivorTax) : '-'],
    ['survivor marginal', r => r.on.survivorYears ? pct(r.on.survivorMarginal, 1) + ' vs ' + pct(r.drawOff.survivorMarginal, 1) : '-'],
];
console.log('   ' + 'metric'.padEnd(22) + out.map(r => r.h.key.padStart(17)).join(''));
for (const [label, f] of rows) {
    console.log('   ' + label.padEnd(22) + out.map(r => String(f(r)).padStart(17)).join(''));
}

// ── 3. heirs-rate band ───────────────────────────────────────────────────────────────────────
console.log('\nHEIRS-RATE BAND, dNW vs DRAW-OFF  (groundrule 2)');
console.log('   ' + 'household'.padEnd(22) + BAND.map(b => pct(b, 0).padStart(15)).join('') + '   flips?');
let bandFlips = 0;
for (const r of out) {
    const cells = BAND.map(rate => r.on.nwAt(rate) - r.drawOff.nwAt(rate));
    const flips = new Set(cells.map(c => c >= 0)).size > 1;
    if (flips) bandFlips++;
    console.log('   ' + r.h.key.padEnd(22) + cells.map(c => money(c).padStart(15)).join('')
        + (flips ? '   YES' : '   no'));
}

// ── predictions ──────────────────────────────────────────────────────────────────────────────
const by = (k) => out.find(r => r.h.key === k);
const canon = by('CANON'), h1 = by('H1-single'), h2 = by('H2-longwidow'),
    h3 = by('H3-IRAlight'), h4 = by('H4-tight');
const xrOf = (r) => { const d = r.on.nw - r.drawOff.nw; return d < 0 ? (r.on.rothEnd - r.drawOff.rothEnd) / -d : null; };
const signDisagree = out.filter(r =>
    Math.sign(r.on.nw - r.routingOff.nw) !== Math.sign(r.on.nw - r.drawOff.nw)).length;
const maxSpendGap = Math.max(...out.flatMap(r =>
    [Math.abs(r.on.spend - r.routingOff.spend), Math.abs(r.on.spend - r.drawOff.spend)]));
const canonSaving = canon.drawOff.survivorTax - canon.on.survivorTax;
const h2Saving = h2.drawOff.survivorTax - h2.on.survivorTax;
const canonSurplusPct = (canon.on.nw - canon.drawOff.nw) / (canon.on.startNW - canon.on.floor);
const h4SurplusPct = (h4.on.nw - h4.drawOff.nw) / (h4.on.startNW - h4.on.floor);
const anyDominantVsDraw = out.some(r => (r.on.nw - r.drawOff.nw) >= 0 && (r.on.rothEnd - r.drawOff.rothEnd) > 0);
const reversed = out.filter(r => (r.on.rothEnd - r.drawOff.rothEnd) > 0 && xrOf(r) != null && xrOf(r) < 1);

rule('═');
console.log('PREDICTIONS, scored as written');
rule();
const verdicts = [
    ['C1', 'single filer still shows conversions paying', xrOf(h1) != null || (h1.on.nw - h1.drawOff.nw) >= 0,
        'exchange ' + (xrOf(h1) == null ? 'dNW >= 0 (DOMINANT)' : xrOf(h1).toFixed(2) + ':1')],
    ['C2', 'long widowhood saves more survivor tax than canonical', h2Saving > canonSaving,
        money(h2Saving) + ' over ' + h2.on.survivorYears + 'y vs canonical ' + money(canonSaving) + ' over ' + canon.on.survivorYears + 'y'],
    ['C3', 'IRA-light dRoth < 25% of canonical', (h3.on.rothEnd - h3.drawOff.rothEnd) < 0.25 * (canon.on.rothEnd - canon.drawOff.rothEnd),
        money(h3.on.rothEnd - h3.drawOff.rothEnd) + ' vs 25% of ' + money(canon.on.rothEnd - canon.drawOff.rothEnd)],
    ['C4', 'tight funding gives up more of its surplus', Math.abs(h4SurplusPct) > Math.abs(canonSurplusPct),
        pct(h4SurplusPct) + ' vs canonical ' + pct(canonSurplusPct)],
    ['C5', 'baseline ambiguity is structural (>=half disagree)', signDisagree >= Math.ceil(out.length / 2),
        signDisagree + ' of ' + out.length + ' households disagree on the sign of dNW'],
    ['C6', 'no household DOMINANT vs DRAW-OFF at 24%', !anyDominantVsDraw,
        anyDominantVsDraw ? 'at least one is' : 'none'],
    ['C7', 'spend equal within $100 everywhere', maxSpendGap <= 100, 'largest gap ' + money(maxSpendGap)],
    ['C8', 'at least one household reverses the verdict', reversed.length >= 1,
        reversed.length ? reversed.map(r => r.h.key).join(', ') + ' below 1:1' : 'none below 1:1'],
];
for (const [id, claim, held, evidence] of verdicts) {
    console.log('  ' + id + '  ' + (held ? 'HELD  ' : 'BROKEN') + '  ' + claim.padEnd(48) + '  ' + evidence);
}
rule('═');
