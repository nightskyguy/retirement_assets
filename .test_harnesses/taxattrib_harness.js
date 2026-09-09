'use strict';
/**
 * taxattrib_harness.js  (P115: tax-payment attribution)
 *
 *   node .test_harnesses/taxattrib_harness.js
 *
 * WHAT IT MEASURES. Whether the growth on money that moves between accounts during a year is
 * taxed where and when it is earned. Two levers move money mid-year - the withdrawal timing mode
 * (Early / Split / Late) and the tax settlement date (with the withdrawal / December) - and each
 * changes which account holds the dollars while they grow.
 *
 * Part 1, cash interest, per plan-bank household and per mode:
 *   earned  = `-cashInterestEarned`, the yield credited to Cash over the year
 *   taxed   = `cashInterest`, what calculateTaxes was handed as interest
 *   untaxed = earned - taxed, summed over the plan; the per-year mean and the worst year
 *   missing tax = untaxed_y x (federal + state marginal rate that year), nominal and compounded to
 *   the plan's end at the plan's growth rate; against lifetime tax and ending net worth; and the
 *   DIFFERENTIAL between Split and Late against the Split-minus-Late ending-net-worth margin,
 *   which is the bias on the mode comparison.
 * Since P115a the engine trues the estimate up the following year, so untaxed should be the final
 * year's residual only. Run it on an older engine to see the defect: untaxed was 21% of the yield
 * earned under Split on ira-heavy-couple.
 *
 * Part 2, the December settlement credit: total credit per household, and how much of the ending
 * Brokerage basis it moved. P115b is the open half - the credit is shared by NET withdrawal rather
 * than by the tax each source paid, and its Brokerage share is added to basis.
 *
 * Reads every plan in the bank (`plans/`), not a COMMON literal.
 */
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
const path = require('path');
const ROOT = path.join(__dirname, '..');
Object.assign(globalThis, require(path.join(ROOT, 'taxengine.js')));
const { simulate } = require(path.join(ROOT, 'optimizer_core.js'));
const bank = require(path.join(ROOT, 'plans'));

const m = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString();
const pct = (a, b) => Math.abs(b) > 1 ? (100 * a / b).toFixed(2) + '%' : 'n/a';
const rate = v => (v > 1 ? v / 100 : v) || 0;
const med = a => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };

function analyse(inputs, mode, extra = {}) {
    const r = simulate({ ...inputs, ...extra, withdrawTiming: mode, computeOC: false });
    const N = r.log.length, g = inputs.growth ?? 0.06;
    let earned = 0, untaxed = 0, missing = 0, missingComp = 0, lifetimeTax = 0, convYears = 0, worst = 0, credit = 0;
    r.log.forEach((e, y) => {
        const a = e['-cashInterestEarned'] ?? 0, t = e.cashInterest ?? 0, u = a - t;
        const tax = u * (rate(e['FedRate%']) + rate(e['StateRate%']));
        earned += a; untaxed += u; missing += tax; missingComp += tax * Math.pow(1 + g, N - 1 - y);
        lifetimeTax += e.totalTax ?? 0;
        credit += e['-taxCarryCredit'] ?? 0;
        if ((e.rothConv ?? 0) > 0) convYears++;
        if (Math.abs(u) > Math.abs(worst)) worst = u;
    });
    const last = r.log[N - 1] || {};
    return { N, earned, untaxed, perYear: untaxed / N, worst, missing, missingComp, lifetimeTax,
             finalNW: r.finalNW, convYears, credit, endBasis: last.BrokerageBasis ?? 0 };
}

console.log('PART 1 - cash interest earned vs taxed, Split (untaxed = earned - taxed over the plan)\n');
console.log('plan'.padEnd(32) + 'yrs conv   earned   untaxed  /yr   worst yr  missing tax  %lifetime tax  compounded  %ending NW   Split-Late NW  bias(comp)  %margin');
const rows = [];
for (const p of bank.list()) {
    const s = analyse(p.inputs, 'split'), l = analyse(p.inputs, 'late');
    const margin = s.finalNW - l.finalNW, bias = s.missingComp - l.missingComp;
    rows.push({ id: p.id, s, l, margin, bias });
    console.log(p.id.padEnd(32) + String(s.N).padStart(3) + String(s.convYears).padStart(5)
        + m(s.earned).padStart(9) + m(s.untaxed).padStart(10) + m(s.perYear).padStart(6) + m(s.worst).padStart(10)
        + m(s.missing).padStart(13) + pct(s.missing, s.lifetimeTax).padStart(14) + m(s.missingComp).padStart(12)
        + pct(s.missingComp, s.finalNW).padStart(12) + m(margin).padStart(16) + m(bias).padStart(12)
        + pct(bias, Math.abs(margin)).padStart(9));
}
const conv = rows.filter(r => r.s.convYears > 0);
console.log('\nconverting households: ' + conv.length + ' of ' + rows.length
    + '; median |untaxed| as share of earned: ' + (100 * med(conv.map(r => Math.abs(r.s.untaxed) / Math.max(1, r.s.earned)))).toFixed(2) + '%'
    + '; median |missing tax| as share of lifetime tax: ' + (100 * med(conv.map(r => Math.abs(r.s.missing) / Math.max(1, r.s.lifetimeTax)))).toFixed(2) + '%');
console.log('Split ahead of Late in ' + conv.filter(r => r.margin > 0).length + ', behind in ' + conv.filter(r => r.margin < 0).length);

console.log('\nPART 2 - December settlement credit, Early mode (P115b, open)\n');
console.log('plan'.padEnd(32) + 'total credit   ending basis: with-withdrawal   december   diff');
for (const p of bank.list()) {
    const a = analyse(p.inputs, 'early'), d = analyse(p.inputs, 'early', { taxSettlement: 'december' });
    console.log(p.id.padEnd(32) + m(d.credit).padStart(12) + m(a.endBasis).padStart(28) + m(d.endBasis).padStart(11) + m(d.endBasis - a.endBasis).padStart(10));
}
