/**
 * conversion_value_harness.js -- Phase P106b.
 *
 * QUESTION: does converting pay, on the user's own plan, measured the way the user defines the
 * goal: "more Roth from the smallest reduction in net worth, with no reduction in spending."
 *
 * This REPLACES `_convSavings` for the study. That figure is a lifetime-tax difference that exists
 * only on the sweep's own conversion-optimized rows, so it is both the wrong quantity and an
 * artifact of the search that produced it.
 *
 * SCENARIO: the user's own plan, `fixtures/p106_canonical.json`, captured from the page's own
 * getInputs(). CA, MFJ, $3.44M across two IRAs, $220k spending declining 1%/yr real, strategy
 * `fixed` = "Reduce IRA in 11 Years", cyclic on, conversion taxes funded from cash.
 *
 * ============================================================================================
 * TWO BASELINES, BECAUSE "CONVERSIONS OFF" IS AMBIGUOUS AND THE ANSWER DEPENDS ON WHICH
 *
 * Measured before writing this file (P106 groundrule 6: state what each pair differs in):
 *
 *   ROUTING-OFF  `convertExcessToRoth:false`  - the strategy draws the SAME money out of the IRA
 *                and routes the surplus to the Brokerage instead of the Roth. A pure routing
 *                difference. Terminal IRA $1,589,225.
 *   DRAW-OFF     `_cfSuppressConversions`     - the extra money is never withdrawn at all. A draw
 *                difference AND a routing difference. Terminal IRA $5,437,748.
 *
 * Same $0 of conversions and the same lifetime spend either way, and a terminal IRA $3,848,523
 * apart. Against ROUTING-OFF the conversion program gains net worth; against DRAW-OFF it loses
 * some. **The verdict flips with the baseline**, so both are reported and neither is called "the"
 * answer. This is the confound P106 groundrule 6 exists to catch, and it is the same shape as the
 * surplus-routing/draw-order mix-up that misread the oracle grid for three weeks.
 * ============================================================================================
 *
 * CONTROLLED, per P106a (`research/CONVERSION_STOP_YEAR.md`): the conversion STOP YEAR is held
 * fixed across every arm and never set to each arm's own optimum. The optimum is a sharp peak that
 * relocates by up to 3 years under a 1% input change, so "each arm at its own best stop year" is a
 * comparison of two argmaxes rather than of two plans.
 *
 * VALUATION, per P106 groundrule 2 and P106a finding 3: a SHARED heirs rate, never the default
 * `totalWealth`, which discounts each run's IRA at that run's own final-year marginal rate and so
 * scores different arms on different bases. Headline 24%, sensitivity band 12%-37%.
 *
 * --------------------------------------------------------------------------------------------
 * PREDICTIONS, REGISTERED BEFORE THE FIRST RUN. Committed unrun; scored as written.
 *
 *   B1  On the user's own strategy, conversions are DOMINANT against ROUTING-OFF: dNW >= 0 and
 *       dRoth > 0, so there is no trade to weigh at all.
 *   B2  Against DRAW-OFF they are NOT dominant: dNW < 0.
 *   B3  The two baselines disagree on the SIGN of dNW for at least half the arms.
 *   B4  In the user's own worked example (Ordered CIBR without conversions against Reduce 11yrs
 *       with them), the conversion leg accounts for more of the dRoth than the strategy leg.
 *   B5  The exchange rate dRoth / -dNW against DRAW-OFF exceeds 3.0 on the user's own strategy.
 *       (Their two-variable pair produced 3.26.)
 *   B6  Lifetime spend is equal across every arm to within $100, as groundrule 3 requires.
 *   B7  Survivor-year tax differs by less than 5% between conversions on and off, because this
 *       scenario's survivor window is only 2 years (2049-2050) and sits after the portfolio has
 *       reached its terminal shape.
 *   B8  The heirs-rate band 12%-37% flips at least one arm's DOMINANT flag.
 * --------------------------------------------------------------------------------------------
 *
 * RUN:  node .test_harnesses/conversion_value_harness.js
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

function loadFixture(name) {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
    const meta = raw.__meta;
    delete raw.__meta;
    for (const k of (meta.undefinedKeys || [])) raw[k] = undefined;
    return { inputs: raw, meta };
}
const money = (v) => (v < 0 ? '-' : '') + '$' + Math.round(Math.abs(v)).toLocaleString('en-US');
const pct = (v, d = 2) => (v * 100).toFixed(d) + '%';
const rule = (c = '─') => console.log(c.repeat(104));

const { inputs: CANON, meta: META } = loadFixture('p106_canonical.json');
const STOP_YEAR = CANON.convEndYear;   // held fixed across every arm, per P106a

// ── running one arm ──────────────────────────────────────────────────────────────────────────
// `conv` is 'on' | 'routing-off' | 'draw-off'. Everything else is held at the canonical value
// unless `over` says otherwise, and `over` is echoed in the report so each pair states what it
// differs in.
function run(over, conv) {
    const inp = { ...CANON, ...over };
    if (conv === 'routing-off') { inp.convertExcessToRoth = false; inp.extraConversionAmount = 0; }
    if (conv === 'draw-off') { inp._cfSuppressConversions = true; }
    const res = simulate({ ...inp, computeOC: false });
    const log = res.log;
    const last = log[log.length - 1];

    // First death: the first row filing single after at least one MFJ row. The survivor window is
    // that row to the end. `status` is 'MFJ' / 'SGL'.
    let firstSingleIdx = -1;
    for (let i = 0; i < log.length; i++) {
        if (log[i].status === 'SGL' && i > 0 && log[i - 1].status === 'MFJ') { firstSingleIdx = i; break; }
    }
    const survivorRows = firstSingleIdx < 0 ? [] : log.slice(firstSingleIdx);
    const atFirstDeath = firstSingleIdx < 0 ? null : log[firstSingleIdx - 1];

    const taxOf = (r) => (r.totalTax ?? r.tax ?? 0);
    const survivorTax = survivorRows.reduce((s, r) => s + taxOf(r), 0);
    // Marginal rate the survivor actually faced, averaged over the survivor years. `NominalRate%`
    // is the row's own ordinary marginal, which is what a further IRA dollar would be taxed at.
    const survivorMarginal = survivorRows.length
        ? survivorRows.reduce((s, r) => s + (r['NominalRate%'] ?? 0), 0) / survivorRows.length
        : null;

    // Real (year-0) dollars: the plan's own inflation compounding over its length.
    const years = log.length - 1;
    const deflator = Math.pow(1 + (CANON.inflation ?? 0), years);

    const nwAt = (rate) => afterTaxWealthOfLogRow(last, rate) / deflator;

    return {
        conv, over,
        log, last,
        spend: res.totals.spend,
        success: res.totals.success,
        conversions: log.reduce((s, r) => s + (r.rothConv ?? 0), 0),
        tax: res.totals.tax,
        rothEnd: last.Roth ?? 0,
        rothAtFirstDeath: atFirstDeath ? (atFirstDeath.Roth ?? 0) : null,
        iraEnd: (last.IRA1 ?? 0) + (last.IRA2 ?? 0),
        brokEnd: last.Brokerage ?? 0,
        nw: nwAt(HEIRS),
        nwAt,
        deflator,
        survivorYears: survivorRows.length,
        survivorFirstYear: survivorRows.length ? survivorRows[0].year : null,
        survivorTax, survivorMarginal,
    };
}

// The funding floor, per P106 groundrule 4: the assets the spending plan actually needs, so a
// give-up can be expressed against SURPLUS OVER NEED rather than against wealth. The user's own
// reason for wanting it: "if my assets were smaller, I would be less aggressive."
// Definition used here, stated because there is no canonical one: the present value at the plan's
// own growth rate of every year's spending that guaranteed income does not cover.
// The per-year target is `spendGoal` on the log row, NOT `targetSpend` - an earlier draft used the
// latter, got undefined, and reported a floor of $0 for a plan that plainly needs funding.
function fundingFloor(arm) {
    const g = CANON.growth ?? 0.06;
    let pv = 0;
    arm.log.forEach((r, i) => {
        const need = Math.max(0, (r.spendGoal ?? 0) - (r.guaranteedIncome ?? 0));
        pv += need / Math.pow(1 + g, i);
    });
    return pv;
}

// An exchange rate is dRoth per dollar of net worth given up. When dNW is a rounding-scale number
// the ratio explodes and means nothing, so it is suppressed rather than printed as a big number.
const XR_FLOOR = 10000;   // dollars of |dNW| below which the ratio is not reported
function exchangeRate(dRoth, dNW) {
    if (dNW >= 0) return null;
    if (-dNW < XR_FLOOR) return 'n/m';     // not meaningful
    return (dRoth / -dNW).toFixed(2) + ' : 1';
}

// ── arms ─────────────────────────────────────────────────────────────────────────────────────
const ARMS = [
    { key: 'reduce11', label: 'Reduce IRA in 11 Years  (the user\'s own plan)', over: {} },
    { key: 'orderedCIBR', label: 'Ordered CIBR', over: { strategy: 'ordered', orderedSeq: 'CIBR' } },
    { key: 'propwd', label: 'Proportional Withdraw +%', over: { strategy: 'propwd' } },
];

console.log('\nP106b - does converting pay, in the user\'s own terms?');
rule('═');
console.log('scenario   : the user\'s own plan  (' + META.title + ')');
console.log('metric     : more Roth for the smallest reduction in net worth, spending held fixed');
console.log('valuation  : SHARED heirs rate ' + pct(HEIRS, 0) + ', real (year-0) dollars, band '
    + BAND.map(b => pct(b, 0)).join(' / '));
console.log('controlled : stop year fixed at ' + STOP_YEAR + ' for every arm (P106a: the optimum is a moving peak)');
rule();

const results = [];
for (const arm of ARMS) {
    const on = run(arm.over, 'on');
    const routingOff = run(arm.over, 'routing-off');
    const drawOff = run(arm.over, 'draw-off');
    results.push({ arm, on, routingOff, drawOff });
}

// ── 1. the two baselines, side by side ───────────────────────────────────────────────────────
console.log('\n1. THE SAME ARM AGAINST BOTH BASELINES');
console.log('   ROUTING-OFF draws the same money and banks it in the Brokerage instead of the Roth.');
console.log('   DRAW-OFF never takes it out of the IRA. Both convert $0 and deliver the same spend.\n');

for (const { arm, on, routingOff, drawOff } of results) {
    console.log('   ' + arm.label);
    console.log('     ' + 'baseline'.padEnd(14) + 'dRoth(end)'.padStart(15) + 'dRoth(1st death)'.padStart(18)
        + 'dNW real'.padStart(14) + 'dNW %NW'.padStart(10) + '   exchange   verdict');
    for (const [name, base] of [['ROUTING-OFF', routingOff], ['DRAW-OFF', drawOff]]) {
        const dRoth = on.rothEnd - base.rothEnd;
        const dRothFD = (on.rothAtFirstDeath ?? 0) - (base.rothAtFirstDeath ?? 0);
        const dNW = on.nw - base.nw;
        const dominant = dNW >= 0 && dRoth > 0;
        const xr = exchangeRate(dRoth, dNW);
        const verdict = dRoth === 0 && dNW === 0 ? 'identical plan - this arm never converts'
            : dominant ? 'DOMINANT (no trade to weigh)' : 'a trade';
        console.log('     ' + name.padEnd(14) + money(dRoth).padStart(15) + money(dRothFD).padStart(18)
            + money(dNW).padStart(14) + pct(dNW / base.nw).padStart(10)
            + '   ' + String(xr == null ? '-' : xr).padStart(11)
            + '   ' + verdict);
    }
    console.log('     spend on/routing-off/draw-off: ' + money(on.spend) + ' / ' + money(routingOff.spend)
        + ' / ' + money(drawOff.spend)
        + '   max gap ' + money(Math.max(Math.abs(on.spend - routingOff.spend), Math.abs(on.spend - drawOff.spend))));
    console.log();
}

// ── 2. what the arms hold ────────────────────────────────────────────────────────────────────
console.log('2. WHAT EACH ARM ACTUALLY HOLDS AT THE END  (nominal balances)');
console.log('   ' + 'arm'.padEnd(34) + 'conversions'.padStart(14) + 'Roth'.padStart(15)
    + 'IRA'.padStart(15) + 'Brokerage'.padStart(15) + 'lifetime tax'.padStart(15));
for (const { arm, on, routingOff, drawOff } of results) {
    for (const [n, a] of [['  + conversions', on], ['  routing-off', routingOff], ['  draw-off', drawOff]]) {
        console.log('   ' + (n === '  + conversions' ? arm.key + n : ' '.repeat(arm.key.length) + n).padEnd(34)
            + money(a.conversions).padStart(14) + money(a.rothEnd).padStart(15)
            + money(a.iraEnd).padStart(15) + money(a.brokEnd).padStart(15) + money(a.tax).padStart(15));
    }
}

// ── 3. the user's own worked example, decomposed ─────────────────────────────────────────────
console.log('\n3. THE USER\'S OWN COMPARISON, DECOMPOSED  (it moves TWO variables at once)');
const cibr = results.find(r => r.arm.key === 'orderedCIBR');
const red = results.find(r => r.arm.key === 'reduce11');
const start = cibr.drawOff, end = red.on;
const midStrategy = red.drawOff;     // strategy changed, conversions still off
console.log('   from : Ordered CIBR, conversions off        Roth ' + money(start.rothEnd) + '   NW ' + money(start.nw));
console.log('   to   : Reduce 11 Years, conversions on      Roth ' + money(end.rothEnd) + '   NW ' + money(end.nw));
console.log('   total: dRoth ' + money(end.rothEnd - start.rothEnd) + '   dNW ' + money(end.nw - start.nw));
console.log('\n   split into its two legs, each moving ONE variable:');
console.log('     strategy leg   (CIBR -> Reduce, both conversions off) : dRoth '
    + money(midStrategy.rothEnd - start.rothEnd).padStart(14) + '   dNW ' + money(midStrategy.nw - start.nw));
console.log('     conversion leg (Reduce, off -> on)                    : dRoth '
    + money(end.rothEnd - midStrategy.rothEnd).padStart(14) + '   dNW ' + money(end.nw - midStrategy.nw));
const legStrat = Math.abs(midStrategy.rothEnd - start.rothEnd);
const legConv = Math.abs(end.rothEnd - midStrategy.rothEnd);
console.log('   -> the ' + (legConv > legStrat ? 'CONVERSION' : 'STRATEGY') + ' leg carries more of the Roth gain ('
    + pct(Math.max(legConv, legStrat) / (legConv + legStrat), 1) + ' of the two).');

// ── 4. the funding floor ─────────────────────────────────────────────────────────────────────
console.log('\n4. AGAINST THE FUNDING FLOOR  (what the spending plan actually needs)');
const floor = fundingFloor(red.on);
const startNW = (CANON.IRA1 + CANON.IRA2 + CANON.Roth + CANON.Roth2 + CANON.Brokerage + CANON.Cash);
console.log('   funding floor (PV at ' + pct(CANON.growth, 1) + ' of spending guaranteed income does not cover): '
    + money(floor));
console.log('   starting portfolio: ' + money(startNW) + '   surplus over need: ' + money(startNW - floor));
console.log('\n   ' + 'arm / baseline'.padEnd(44) + 'dNW real'.padStart(14) + '  % of NW   % of SURPLUS OVER NEED');
for (const { arm, on, routingOff, drawOff } of results) {
    for (const [n, base] of [['vs routing-off', routingOff], ['vs draw-off', drawOff]]) {
        const dNW = on.nw - base.nw;
        console.log('   ' + (arm.key + ' ' + n).padEnd(44) + money(dNW).padStart(14)
            + '  ' + pct(dNW / base.nw).padStart(7)
            + '  ' + pct(dNW / (startNW - floor)).padStart(9));
    }
}

// ── 5. widow exposure ────────────────────────────────────────────────────────────────────────
console.log('\n5. WIDOW EXPOSURE  (both columns, per the user\'s decision 2026-09-03)');
console.log('   survivor window on this scenario: ' + red.on.survivorYears + ' years from '
    + red.on.survivorFirstYear + '. Short, so this reads small here by construction;');
console.log('   it is the generalization set (P106c) that has to carry this column.\n');
console.log('   ' + 'arm / baseline'.padEnd(44) + 'survivor-year tax'.padStart(19) + '  vs its baseline'
    + '   survivor marginal');
for (const { arm, on, routingOff, drawOff } of results) {
    console.log('   ' + (arm.key + ' + conversions').padEnd(44) + money(on.survivorTax).padStart(19)
        + '  ' + ' '.repeat(15) + '   ' + pct(on.survivorMarginal ?? 0));
    for (const [n, base] of [['vs routing-off', routingOff], ['vs draw-off', drawOff]]) {
        console.log('   ' + ('  ' + n).padEnd(44) + money(base.survivorTax).padStart(19)
            + '  ' + money(on.survivorTax - base.survivorTax).padStart(15)
            + '   ' + pct(base.survivorMarginal ?? 0));
    }
}

// ── 6. heirs-rate sensitivity ────────────────────────────────────────────────────────────────
console.log('\n6. HEIRS-RATE SENSITIVITY BAND  (groundrule 2: if the ordering flips, the flip IS the finding)');
console.log('   ' + 'arm / baseline'.padEnd(44) + BAND.map(b => pct(b, 0).padStart(13)).join(''));
let b8flip = false;
for (const { arm, on, routingOff, drawOff } of results) {
    for (const [n, base] of [['vs routing-off', routingOff], ['vs draw-off', drawOff]]) {
        const cells = BAND.map(rate => on.nwAt(rate) - base.nwAt(rate));
        const doms = cells.map(d => d >= 0);
        if (new Set(doms).size > 1) b8flip = true;
        console.log('   ' + (arm.key + ' ' + n).padEnd(44)
            + cells.map(c => money(c).padStart(13)).join('')
            + (new Set(doms).size > 1 ? '   <- DOMINANT flips' : ''));
    }
}

// ── predictions ──────────────────────────────────────────────────────────────────────────────
rule('═');
console.log('PREDICTIONS, scored as written');
rule();
const dRothRoutingOff = red.on.rothEnd - red.routingOff.rothEnd;
const dNWRoutingOff = red.on.nw - red.routingOff.nw;
const dRothDrawOff = red.on.rothEnd - red.drawOff.rothEnd;
const dNWDrawOff = red.on.nw - red.drawOff.nw;
const signDisagreements = results.filter(r =>
    Math.sign(r.on.nw - r.routingOff.nw) !== Math.sign(r.on.nw - r.drawOff.nw)).length;
const maxSpendGap = Math.max(...results.flatMap(r =>
    [Math.abs(r.on.spend - r.routingOff.spend), Math.abs(r.on.spend - r.drawOff.spend)]));
const widowGap = Math.abs(red.on.survivorTax - red.drawOff.survivorTax)
    / Math.max(1, red.drawOff.survivorTax);
const verdicts = [
    ['B1', 'DOMINANT vs ROUTING-OFF on the user\'s arm', dNWRoutingOff >= 0 && dRothRoutingOff > 0,
        'dNW ' + money(dNWRoutingOff) + ', dRoth ' + money(dRothRoutingOff)],
    ['B2', 'NOT dominant vs DRAW-OFF (dNW < 0)', dNWDrawOff < 0, 'dNW ' + money(dNWDrawOff)],
    ['B3', 'baselines disagree on sign of dNW for >=half the arms',
        signDisagreements >= Math.ceil(results.length / 2),
        signDisagreements + ' of ' + results.length + ' arms disagree'],
    ['B4', 'conversion leg carries more dRoth than strategy leg', legConv > legStrat,
        'conversion ' + money(legConv) + ' vs strategy ' + money(legStrat)],
    ['B5', 'exchange rate vs DRAW-OFF > 3.0', dNWDrawOff < 0 && (dRothDrawOff / -dNWDrawOff) > 3.0,
        dNWDrawOff < 0 ? (dRothDrawOff / -dNWDrawOff).toFixed(2) + ' : 1' : 'dNW >= 0, no exchange rate'],
    ['B6', 'spend equal to within $100 across every arm', maxSpendGap <= 100,
        'largest gap ' + money(maxSpendGap)],
    ['B7', 'survivor-year tax differs by < 5%', widowGap < 0.05, pct(widowGap) + ' on a '
        + red.on.survivorYears + '-year window'],
    ['B8', 'heirs-rate band flips a DOMINANT flag', b8flip, b8flip ? 'at least one flip' : 'no flip in 12%-37%'],
];
for (const [id, claim, held, evidence] of verdicts) {
    console.log('  ' + id + '  ' + (held ? 'HELD  ' : 'BROKEN') + '  ' + claim.padEnd(52) + '  ' + evidence);
}
rule('═');
