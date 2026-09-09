/**
 * underfill_harness.js -- P87c. A plan stops 15% of its Social Security short of its own ceiling.
 *
 *   node .test_harnesses/underfill_harness.js
 *
 * Chasing the under-fill left open by the correction to section 7 of
 * research/BRACKET_CEILING_BASIS.md. A Fill Bracket plan with Convert Excess to Roth on reaches its
 * ceiling exactly, year after year - until Social Security starts, after which MAGI lands short and
 * stays short.
 *
 * THE ANSWER, and it is not approximate: `short / SSincome` is 0.150000 in every affected year,
 * minimum equal to maximum, on federal brackets and IRMAA tiers alike. The sizing aggregate
 * subtracts the FULL benefit (`yr.fixedInc = yr.s1 + yr.s2`) from the ceiling while at most 85% of
 * the benefit ever reaches MAGI, so the untaxed 15% is treated as consuming ceiling it never
 * occupies and the plan leaves exactly that much unused. Same shape as the deduction error P92a
 * fixed: a quantity on one income basis measured against a threshold on another.
 *
 * TWO REGIMES, AND CONFLATING THEM IS WHAT MADE THIS LOOK MYSTERIOUS. Once the IRA empties the
 * short jumps to hundreds of thousands, because there is nothing left to draw - not a defect. The
 * rows below are therefore restricted to years where Social Security is paid AND the IRA still has
 * money in it.
 *
 * Fixture: 2026 MFJ couple, $2.8M across two IRAs, TX so no state ceiling binds first.
 * Results in research/BRACKET_CEILING_BASIS.md section 9.
 *
 * THE DEFECT SHIPPED FIXED IN v11.16d4 (P87c), so this file has flipped from measurement to
 * check: it now prints 0.000000 and $0 on the same fixture. The numbers in the header above are
 * the PRE-FIX record and are kept verbatim - they are what section 9 reports, and they are what
 * makes the zero below mean anything. Section 10 covers the regime split and the fix.
 */

globalThis.performance={now:()=>0};globalThis.window={};globalThis.document={getElementById:()=>null,addEventListener:()=>{}};
const R='../';
Object.assign(globalThis, require(R+'taxengine.js'));require(R+'displayhelpers.js');
const {simulate}=require(R+'optimizer_core.js');
const PLANS=require(R+'plans');
// P112. The household is `bracket-filler-texas` in the plan bank, not a literal copied into
// this file. Its card records what it exercises, what its measured viability is, and what it
// CANNOT show: state-tax interactions, and any ending-IRA measure - its IRA drains to zero.
// Read plans/bracket-filler-texas.js before reading a verdict off this harness.
const BASE = { ...PLANS.get("bracket-filler-texas").inputs, nYears: 20 };
const log=simulate({...BASE}).log;
// Restrict to years the anomaly can exist in: SS is paid AND the IRA still has money to draw.
const rows=log.filter(e=>e.SSincome>0 && e.TotalIRA>1000);
const tot=rows.reduce((a,e)=>a+(e.BracketTarget-e.MAGI),0);
const ratios=rows.map(e=>(e.BracketTarget-e.MAGI)/e.SSincome);
console.log('years with SS paid and IRA still funded:', rows.length);
console.log('short/SS  min', Math.min(...ratios).toFixed(6), ' max', Math.max(...ratios).toFixed(6));
console.log('total ceiling headroom never used: $' + Math.round(tot).toLocaleString());
console.log('as a share of total SS paid in those years:',
  (tot/rows.reduce((a,e)=>a+e.SSincome,0)).toFixed(5));
// Same fixture across the three ceiling families, to show which are affected.
for (const [lbl,ov] of [['Fill 22%',{}],['Fill 24%',{stratRate:0.24}],['IRMAA Tier 1',{stratRate:0,stratIRMAATier:1}],
                        ['IRMAA Tier 2',{stratRate:0,stratIRMAATier:2}]]) {
  const L=simulate({...BASE,...ov}).log.filter(e=>e.SSincome>0 && e.TotalIRA>1000 && (e.BracketTarget-e.MAGI)>1);
  if(!L.length){console.log(lbl.padEnd(13),'no under-filled year');continue;}
  const rr=L.map(e=>(e.BracketTarget-e.MAGI)/e.SSincome);
  console.log(lbl.padEnd(13), L.length, 'yrs, short/SS', Math.min(...rr).toFixed(5), '-', Math.max(...rr).toFixed(5),
    ', unused $'+Math.round(L.reduce((a,e)=>a+e.BracketTarget-e.MAGI,0)).toLocaleString());
}
