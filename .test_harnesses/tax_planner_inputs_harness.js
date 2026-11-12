'use strict';
//
// What should the Income Tax Planner add so a user can enter a state tax refund, and which other
// simple inputs would make it noticeably more accurate?
//
// Produces research/INCOME_TAX_PLANNER_INPUTS.md. Unlike the Optimizer harnesses it loads
// taxengine.js and taxcalc_core.js (the planner's calculation, the same one `node taxcalc.js` runs)
// and no household from plans/: the subject is one real 2026 tax return a tax program projected.
//
// Every candidate is measured by patching TAXData or wrapping calculateTaxes IN MEMORY. Nothing is
// written anywhere, and the repository's tables are untouched.
//
// Parts:
//   1. CA   - the planner's California tax against the tax program's, with each gap closed in turn.
//   2. REF  - the refund routed three ways: as Other income (the workaround), left out, federal-only.
//   3. MORE - the other candidate inputs on the same household.
//
// Sources, read 2026-11-11:
//   2026 CA rate schedules     ftb.ca.gov/forms/2026/2026-540-tax-rate-schedules.pdf
//   2025 CA exemption credits  ftb.ca.gov/forms/2025/2025-540.pdf, lines 7 and 9 ($153 each)
//   2025 CA standard deduction ftb.ca.gov/forms/2025/2025-540-booklet.html, line 18 ($11,412 MFJ)

const path = require('path');
const ROOT = path.join(__dirname, '..');
const engPath = path.join(ROOT, 'taxengine.js');
const ENG = require(engPath);
const TD = ENG.TAXData;

// One extra state-only subtraction, fed through the engine's existing stateExemptInterest channel
// (subtracted from state income and nothing else). Installed before taxcalc_core binds the function.
let STATE_SUB = 0;
const calcOrig = ENG.calculateTaxes;
require.cache[require.resolve(engPath)].exports.calculateTaxes = p =>
	calcOrig({ ...p, stateExemptInterest: (p.stateExemptInterest || 0) + STATE_SUB });
const TC = require(path.join(ROOT, 'taxcalc_core.js'));

const HH = 'st=MFJ&s=CA&a1=66&a2=74&yr=2026&ss=29858&it=5075&nd=2500&qd=7950&sg=405&cs=100220&cb=0&rd=9126&mu=1600&sm=1100&ui=50';
const REFUND = 1789;
const RCS = [0, 55000, 120000, 240000];
const SOFTWARE_CA = [3210, 7769, 13814, 24974];

const q = (link, fields) => {
	const p = new URLSearchParams(link + '&return=' + fields);
	const r = TC.run(k => p.get(k), {});
	if (!r.ok) throw new Error(r.csv);
	return r.csv.split(',').map(Number);
};
const fmt = v => Math.round(v).toLocaleString('en-US');
const row = (label, cells) => console.log('| ' + label + ' | ' + cells.join(' | ') + ' |');

const caSnapshot = JSON.stringify(TD.CA.MFJ, (k, v) => v === Infinity ? 'INF' : v);
const restoreCA = () => { TD.CA.MFJ = JSON.parse(caSnapshot, (k, v) => v === 'INF' ? Infinity : v); };

// FTB 2026 Schedule Y, plus the $1,000,000 Behavioral Health Services surtax step the engine folds in.
const Y2026 = [22912, 54314, 85722, 118996, 150394, 768218, 921854, 1000000, 1536426];
const RATES = [0.01, 0.02, 0.04, 0.06, 0.08, 0.093, 0.103, 0.113, 0.123, 0.133];
const setCA = (ceilings, std) => {
	TD.CA.MFJ.std = std;
	TD.CA.MFJ.brackets = RATES.map((r, i) => ({ l: i < ceilings.length ? ceilings[i] : Infinity, r }));
};
// 2026 indexing factor read off the schedules themselves: 22,912 / 22,158 (2025 Schedule Y).
const CA_INDEX_2026 = 22912 / 22158;
const STD_2026 = Math.round(11412 * CA_INDEX_2026);                // 11,800
const CREDIT_2026 = Math.round(153 * CA_INDEX_2026);               // 158
const credits = n => n * CREDIT_2026;                              // 2 personal + 2 senior here

const caRow = (extra, fn = r => r) => RCS.map((rc, i) => {
	const v = fn(q(HH + extra + '&rc=' + rc, 'stateTax')[0]);
	return fmt(v) + ' (' + (v - SOFTWARE_CA[i] >= 0 ? '+' : '') + fmt(v - SOFTWARE_CA[i]) + ')';
});

console.log('\n## 1. CA: planner California tax (gap to the tax program), Roth conversion ' + RCS.join(' / '));
console.log('index ' + CA_INDEX_2026.toFixed(5) + ', standard deduction ' + STD_2026 + ', exemption credit ' + CREDIT_2026 + '\n');
row('step', RCS.map(String));
row('---', RCS.map(() => '---'));
row('tax program', SOFTWARE_CA.map(fmt));
row('CA0 today, refund entered as ot', caRow('&ot=' + REFUND));
row('CA1 + refund federal-only', caRow(''));
setCA(Y2026, 11700);
row('CA2 + 2026 FTB brackets', caRow(''));
setCA(Y2026, STD_2026);
row('CA3 + 2026 standard deduction', caRow(''));
row('CA4 + four exemption credits', caRow('', v => Math.max(0, v - credits(4))));
restoreCA();

console.log('\nEach gap alone, from CA0 (dollars of California tax it removes):\n');
const base = RCS.map(rc => q(HH + '&ot=' + REFUND + '&rc=' + rc, 'stateTax')[0]);
const saves = extra => RCS.map((rc, i) => fmt(base[i] - q(HH + extra + '&rc=' + rc, 'stateTax')[0]));
row('refund kept out of CA income', saves(''));
setCA(Y2026, 11700); row('2026 brackets', saves('&ot=' + REFUND)); restoreCA();
TD.CA.MFJ.std = STD_2026; row('2026 standard deduction', saves('&ot=' + REFUND)); restoreCA();
row('exemption credits (flat)', RCS.map(() => fmt(credits(4))));

console.log('\n## 2. REF: the refund three ways\n');
const F = 'agi,magi,seniorDeduction,fedTax,niit,stateTax';
console.log('fields: ' + F + '\n');
for (const [label, extra, sub] of [['R0 entered as ot (workaround)', '&ot=' + REFUND, 0],
                                   ['R1 left out', '', 0],
                                   ['R2 federal-only', '&ot=' + REFUND, REFUND]]) {
	STATE_SUB = sub;
	RCS.forEach(rc => console.log(label.padEnd(32) + String(rc).padStart(7) + '  ' + q(HH + extra + '&rc=' + rc, F).map(fmt).join(', ')));
	STATE_SUB = 0;
}
// A household nearer the Social Security thresholds, where the refund also pulls benefits into tax.
const LOW = 'st=MFJ&s=CA&a1=70&a2=70&yr=2026&ss=40000&it=3000&rd=30000';
console.log('\nlower-income household ' + LOW + ' (agi, taxableSS, fedTax, stateTax):');
for (const [label, extra, sub] of [['no refund', '', 0], ['2,000 refund as ot', '&ot=2000', 0], ['2,000 refund federal-only', '&ot=2000', 2000]]) {
	STATE_SUB = sub;
	console.log('  ' + label.padEnd(28) + q(LOW + extra, 'agi,taxableSS,fedTax,stateTax').map(fmt).join(', '));
	STATE_SUB = 0;
}

console.log('\n## 3. MORE: other candidates on the same household (refund entered as ot, today\'s tables)\n');
const H3 = HH + '&ot=' + REFUND;
const fedStd = TD.FEDERAL.MFJ.std;
row('candidate', RCS.map(String));
row('---', RCS.map(() => '---'));
// T1: $5,000 of Treasury money-market dividends (non-qualified dividends), exempt from CA.
row('T1 5,000 Treasury fund dividends, CA tax saved', RCS.map(rc => {
	const a = q(H3 + '&nd=7500&rc=' + rc, 'stateTax')[0];
	STATE_SUB = 5000; const b = q(H3 + '&nd=7500&rc=' + rc, 'stateTax')[0]; STATE_SUB = 0;
	return fmt(a - b);
}));
// G1: a $2,000 below-the-line federal deduction (non-itemizer charitable gift), emulated as +2,000 std.
row('G1 2,000 gift, non-itemizer, federal tax saved', RCS.map(rc => {
	const a = q(H3 + '&rc=' + rc, 'fedTax')[0];
	TD.FEDERAL.MFJ.std = fedStd + 2000; const b = q(H3 + '&rc=' + rc, 'fedTax')[0]; TD.FEDERAL.MFJ.std = fedStd;
	return fmt(a - b);
}));
// I1: 6,000 property tax + 10,000 charity. Federal: itemized = min(state tax + 6,000, SALT cap) + 10,000,
// against standard + age (35,500 here). CA: itemized 16,000 against the 11,700 standard deduction.
const capIdx = TD.OBBBA.SALT.capHigh * Math.pow(1 + TD.OBBBA.SALT.indexRate, 2026 - TD.OBBBA.SALT.indexBaseYear);
row('I1 6k property tax + 10k charity, federal tax saved', RCS.map(rc => {
	// `deduction` includes the senior deduction, which a filer gets whether or not they itemize.
	const [fed, st, dedAll, sen] = q(H3 + '&pt=6000&rc=' + rc, 'fedTax,stateTax,deduction,seniorDeduction');
	const ded = dedAll - sen;
	const itz = Math.min(st + 6000, capIdx) + 10000;
	TD.FEDERAL.MFJ.std = fedStd + Math.max(0, itz - ded); const b = q(H3 + '&rc=' + rc, 'fedTax')[0]; TD.FEDERAL.MFJ.std = fedStd;
	return fmt(fed - b) + ' (itemized ' + fmt(itz) + ' vs ' + fmt(ded) + ')';
}));
row('I1 same, CA tax saved (CA itemizing)', RCS.map(rc => {
	const a = q(H3 + '&pt=6000&rc=' + rc, 'stateTax')[0];
	TD.CA.MFJ.std = 16000; const b = q(H3 + '&pt=6000&rc=' + rc, 'stateTax')[0]; restoreCA();
	return fmt(a - b);
}));
row('I1b 15,000 property tax alone, CA tax saved', RCS.map(rc => {
	const a = q(H3 + '&pt=15000&rc=' + rc, 'stateTax')[0];
	TD.CA.MFJ.std = 15000; const b = q(H3 + '&pt=15000&rc=' + rc, 'stateTax')[0]; restoreCA();
	return fmt(a - b);
}));
