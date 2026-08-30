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
 */

globalThis.performance={now:()=>0};globalThis.window={};globalThis.document={getElementById:()=>null,addEventListener:()=>{}};
const R='C:/Users/starc/source/retirement_assets/.claude/worktrees/readme-review-updates-c9df11/';
Object.assign(globalThis, require(R+'taxengine.js'));require(R+'displayhelpers.js');
const {simulate}=require(R+'optimizer_core.js');
const BASE={STATEname:'TX',nYears:20,birthyear1:1962,birthmonth1:6,die1:92,birthyear2:1964,birthmonth2:3,die2:94,hasSpouse:true,
 ss1:30000,ss1Age:70,ss2:20000,ss2Age:67,pensionAnnual:0,pensionStartAge:0,survivorPct:0,pensionCola:false,spendChange:0,
 inflation:.025,cpi:.025,growth:.06,cashYield:.03,dividendRate:.02,ssFailYear:2099,ssFailPct:1,
 convertExcessToRoth:true,fundConversionWithCash:false,propWithdraw:.10,iraWithdrawPct:.06,extraConversionAmount:0,
 startAge:64,startInYear:2026,dividendReinvest:true,gkGuard:.2,gkAdjPct:.1,cycleLTCGTarget:.15,qcdHHMax:0,qcdMode:'asneeded',computeOC:false,
 IRA1:2000000,IRA2:800000,Roth:50000,Roth2:20000,Brokerage:150000,BrokerageBasis:80000,Cash:80000,iraBaseGoal:0,
 strategy:'bracket',stratRate:0.22,stratIRMAATier:-1,stratACAMultiple:0,spendGoal:110000};
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
