/**
 * timingmode_harness.js -- what does Split actually cost or buy, at RMD age?
 *
 *   node .test_harnesses/timingmode_harness.js
 *
 * THE QUESTION, and why it could not be asked before. The year-timing control now names three
 * modes - Early, Split, Late - as three months rather than as two half-coupled selects:
 *
 *     mode     RMD   conversion   spending
 *     early     1        1           1
 *     split     1        1          11
 *     late     11       11          11
 *
 * Split is the one that was previously unreachable. With a late spending draw the required
 * distribution sat in month 11, and a conversion may not precede the distribution, so a January
 * conversion was silently a no-op in every RMD year. Every prior measurement of the conversion month
 * therefore used a deliberately PRE-RMD fixture, and the two studies that exist say so in their own
 * comments. **Split's behavior at RMD age has never been measured at all**, which is exactly why it
 * is being made the default before rather than after this run: the point is to measure the thing,
 * not to defend it.
 *
 * WHAT SPLIT COSTS, structurally. Taking the distribution in January to unlock a January conversion
 * means those dollars leave the IRA ten months early and sit in Cash. The cost is
 * `R * (g_IRA - cashYield) * 10/12` a year and nothing has ever priced it. What it buys is ten extra
 * months of Roth growth on the converted amount, and a smaller December 31 IRA balance - which is
 * next year's RMD basis, so the effect compounds.
 *
 * The two pull in opposite directions and the sign is a household property, not a constant. This
 * reports it per household rather than averaging it away.
 *
 * Households come from the plan bank, which is what makes "at RMD age" checkable rather than
 * assumed: each card records whether its IRA survives, and a household whose IRA drains to zero
 * cannot show an RMD-basis effect at all.
 */

globalThis.performance = { now: () => 0 };
globalThis.window = {};
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const R = '../';
Object.assign(globalThis, require(R + 'taxengine.js'));
require(R + 'displayhelpers.js');
const { simulate } = require(R + 'optimizer_core.js');
const PLANS = require(R + 'plans');

const MODES = ['early', 'split', 'late'];
const money = n => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US');
const pctOf = (d, b) => (b ? (100 * d / Math.abs(b)).toFixed(2) + '%' : '-');
const med = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const nw = r => { const L = r.log[r.log.length - 1]; return L ? (L.totalNetWealth ?? 0) : 0; };

const rows = [];
for (const plan of PLANS.list()) {
    const out = {};
    let ok = true;
    for (const m of MODES) {
        try { out[m] = simulate({ ...plan.inputs, withdrawTiming: m }); }
        catch (e) { ok = false; break; }
    }
    if (!ok) continue;
    const rmdYears = out.late.log.filter(e => (e.RMDwd ?? 0) > 0).length;
    // Only a household that actually reaches RMD age can answer the question this harness asks.
    if (!rmdYears) continue;
    // Spending must match across the modes or the comparison is between two different lives.
    const spends = MODES.map(m => out[m].totals.spend ?? 0);
    const clean = Math.max(...spends) - Math.min(...spends) <= 1
               && MODES.every(m => out[m].totals.success);
    rows.push({
        id: plan.id,
        rmdYears,
        clean,
        nwSplit: nw(out.split), nwLate: nw(out.late), nwEarly: nw(out.early),
        dSplitLate: nw(out.split) - nw(out.late),
        dSplitEarly: nw(out.split) - nw(out.early),
        taxSplitLate: (out.split.totals.tax ?? 0) - (out.late.totals.tax ?? 0),
        rmdSplitLate: (out.split.totals.rmd ?? 0) - (out.late.totals.rmd ?? 0),
        convShiftYears: out.split.log.filter(e => Math.abs(e['-convTimingShift'] ?? 0) > 0.01).length,
        rmdShiftCost: out.split.log.reduce((s, e) => s + (e['-rmdTimingShift'] ?? 0), 0),
        endingIRA: out.late.log[out.late.log.length - 1]?.TotalIRA ?? 0,
    });
}

const cl = rows.filter(r => r.clean);
console.log('\n=== Split at RMD age: the comparison that could not be made before ===\n');
console.log(`households from the plan bank that reach RMD age: ${rows.length}   (clean: ${cl.length})`);
console.log('clean = identical delivered spending across all three modes, and all three fund every year\n');

console.log('  household                        RMD yrs  conv-shift   Split - Late      as %    Split - Early');
console.log('  ' + '-'.repeat(96));
for (const r of cl.sort((a, b) => b.dSplitLate - a.dSplitLate)) {
    console.log('  ' + r.id.padEnd(32)
        + String(r.rmdYears).padStart(6)
        + String(r.convShiftYears).padStart(11)
        + money(r.dSplitLate).padStart(16)
        + pctOf(r.dSplitLate, r.nwLate).padStart(10)
        + money(r.dSplitEarly).padStart(16));
}

const wins = cl.filter(r => r.dSplitLate > 1).length;
const loses = cl.filter(r => r.dSplitLate < -1).length;
console.log('\n--- Split against Late (the best of the two reachable modes today) ---');
console.log(`  Split ahead in ${wins} of ${cl.length}, behind in ${loses}, level in ${cl.length - wins - loses}`);
console.log(`  median  d(net worth) ${money(med(cl.map(r => r.dSplitLate)))}    d(lifetime tax) ${money(med(cl.map(r => r.taxSplitLate)))}`);
console.log(`  median  d(lifetime RMDs) ${money(med(cl.map(r => r.rmdSplitLate)))}   <- the IRA-basis effect`);
console.log(`  best ${money(Math.max(...cl.map(r => r.dSplitLate)))}   worst ${money(Math.min(...cl.map(r => r.dSplitLate)))}`);

console.log('\n--- what the early distribution itself costs ---');
console.log('  the RMD leaves the IRA ten months early and sits in Cash; this is the net of the cash');
console.log('  yield gained against the IRA growth given back, summed over the plan:\n');
console.log(`  median ${money(med(cl.map(r => r.rmdShiftCost)))}    worst ${money(Math.min(...cl.map(r => r.rmdShiftCost)))}`);
console.log('\n--- Split against Early ---');
console.log(`  Split ahead in ${cl.filter(r => r.dSplitEarly > 1).length} of ${cl.length},`
    + ` median ${money(med(cl.map(r => r.dSplitEarly)))}`);
console.log('');
