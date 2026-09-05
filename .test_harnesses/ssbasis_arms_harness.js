/**
 * ssbasis_arms_harness.js -- P87c2. Three arms over one grid: does the exact inversion buy anything
 * that a flat 85% subtraction does not?
 *
 *   node .test_harnesses/ssbasis_arms_harness.js
 *
 * ARMS (`ceilingSSTaxableBasis`, a research input, default off, reachable from no UI):
 *
 *   OFF      today. The sizing aggregate subtracts the FULL Social Security benefit from a MAGI
 *            ceiling, so the untaxed share is charged against a ceiling it never occupies and the
 *            plan stops short. This is the shipped defect.
 *   flat85   subtract 0.85 x benefit, the statutory MAXIMUM taxable share. Cannot breach the
 *            ceiling: the true share is at most 0.85, so MAGI = (limit - 0.85 SS) + taxableSS <=
 *            limit, in every tier, always.
 *   exact    solve MAGI(N) = limit for the non-SS income N (`nonSSIncomeForMAGI`). Identical to
 *            flat85 wherever the 85% cap binds; larger where a lower tier binds, because there MAGI
 *            rises 1.5x or 1.85x as fast as the draw and flat85 leaves the difference unused.
 *            Also cannot breach: it solves for the limit rather than assuming a tier.
 *
 * WHAT THIS DECIDES. `ssbasis_harness.js` (P87c1) found 96.3% of ceiling-bound years pinned at the
 * 85% cap, where the two arms agree exactly, and 3.6% in a sloped tier, where they do not. So the
 * question is not which arm is SAFE - both are - but whether the sloped 3.6% is worth the extra
 * machinery. This measures that: per-arm fill quality (how close MAGI lands to the ceiling it was
 * told to fill), any breach at all, and the wealth consequence.
 *
 * Results in research/BRACKET_CEILING_BASIS.md section 10.
 */

globalThis.performance={now:()=>0};globalThis.window={};globalThis.document={getElementById:()=>null,addEventListener:()=>{}};
const R='../';
Object.assign(globalThis, require(R+'taxengine.js'));require(R+'displayhelpers.js');
const {simulate}=require(R+'optimizer_core.js');

const BASE={STATEname:'TX',nYears:30,birthyear1:1962,birthmonth1:6,die1:92,birthyear2:1964,birthmonth2:3,die2:94,hasSpouse:true,
 ss1:30000,ss1Age:70,ss2:20000,ss2Age:67,pensionAnnual:0,pensionStartAge:0,survivorPct:0,pensionCola:false,spendChange:0,
 inflation:.025,cpi:.025,growth:.06,cashYield:.03,dividendRate:.02,ssFailYear:2099,ssFailPct:1,
 convertExcessToRoth:true,fundConversionWithCash:false,propWithdraw:.10,iraWithdrawPct:.06,extraConversionAmount:0,
 startAge:64,startInYear:2026,dividendReinvest:true,gkGuard:.2,gkAdjPct:.1,cycleLTCGTarget:.15,qcdHHMax:0,qcdMode:'asneeded',computeOC:false,
 IRA1:2000000,IRA2:800000,Roth:50000,Roth2:20000,Brokerage:150000,BrokerageBasis:80000,Cash:80000,iraBaseGoal:0,
 strategy:'bracket',stratRate:0.22,stratIRMAATier:-1,stratACAMultiple:0,spendGoal:110000};

const CEILINGS=[
  ['Fed 10%',   {stratRate:0.10, stratIRMAATier:-1, stratACAMultiple:0}],
  ['Fed 12%',   {stratRate:0.12, stratIRMAATier:-1, stratACAMultiple:0}],
  ['Fed 22%',   {stratRate:0.22, stratIRMAATier:-1, stratACAMultiple:0}],
  ['Fed 24%',   {stratRate:0.24, stratIRMAATier:-1, stratACAMultiple:0}],
  ['Fed 32%',   {stratRate:0.32, stratIRMAATier:-1, stratACAMultiple:0}],
  ['IRMAA T1',  {stratRate:0, stratIRMAATier:1, stratACAMultiple:0}],
  ['IRMAA T2',  {stratRate:0, stratIRMAATier:2, stratACAMultiple:0}],
  ['IRMAA T4',  {stratRate:0, stratIRMAATier:4, stratACAMultiple:0}],
  ['ACA 200FPL',{strategy:'aca', stratRate:0, stratIRMAATier:-1, stratACAMultiple:2.0}],
  ['ACA 400FPL',{strategy:'aca', stratRate:0, stratIRMAATier:-1, stratACAMultiple:4.0}],
];
const SS=[['SS none',{ss1:0,ss2:0}],['SS small',{ss1:9000,ss2:6000}],['SS mid',{ss1:30000,ss2:20000}],['SS large',{ss1:54000,ss2:40000}]];
const WEALTH=[['IRA 400k',{IRA1:300000,IRA2:100000}],['IRA 2.8M',{IRA1:2000000,IRA2:800000}],['IRA 8M',{IRA1:6000000,IRA2:2000000}]];
const SPEND=[['spend 60k',{spendGoal:60000}],['spend 110k',{spendGoal:110000}],['spend 220k',{spendGoal:220000}]];
const STATUS=[['MFJ',{}],['SGL',{hasSpouse:false}]];
const ARMS=[['OFF',false],['flat85','flat85'],['exact','exact']];

const EPS=1;
const acc={};                                  // per-arm accumulators
for (const [a] of ARMS) acc[a]={short:0, shortYears:0, over:0, overYears:0, finalNW:0, tax:0, conv:0, years:0};
const perCell=[];                              // rows where the two armed forms disagree

for (const [cl,cov] of CEILINGS)
for (const [sl,sov] of SS)
for (const [wl,wov] of WEALTH)
for (const [pl,pov] of SPEND)
for (const [tl,tov] of STATUS) {
  const name=`${cl} / ${sl} / ${wl} / ${pl} / ${tl}`;
  const runs={};
  let ok=true;
  for (const [aName,aVal] of ARMS) {
    const inp={...BASE,...cov,...sov,...wov,...pov,...tov, ceilingSSTaxableBasis:aVal};
    if (tl==='SGL') { inp.ss2=0; inp.IRA2=0; inp.Roth2=0; }
    try { runs[aName]=simulate(inp); } catch(e) { ok=false; break; }
  }
  if (!ok) continue;
  // A cell is only comparable if every arm delivered the same spending. An arm that funds less
  // spending is not a better or worse fill, it is a different plan.
  const spends=ARMS.map(([a])=>Math.round(runs[a].totals.spend));
  const clean = spends.every(v=>Math.abs(v-spends[0]) < 1);

  const stat={};
  for (const [aName] of ARMS) {
    const log=runs[aName].log;
    const rows=log.filter(e=>e.SSincome>0 && e.TotalIRA>1000 && e.BracketTarget>0);
    let short=0, shortYears=0, over=0, overYears=0;
    for (const e of rows) {
      const d=e.BracketTarget-e.MAGI;
      if (d>EPS) { short+=d; shortYears++; }
      else if (d < -EPS) { over+=-d; overYears++; }
    }
    const last=log[log.length-1]||{};
    stat[aName]={short,shortYears,over,overYears,years:rows.length,
      nw:(last.totalNetWealth ?? 0),
      tax:runs[aName].totals.tax,
      conv:log.reduce((s,e)=>s+(e.rothConv??0),0)};
    const A=acc[aName];
    A.short+=short; A.shortYears+=shortYears; A.over+=over; A.overYears+=overYears; A.years+=rows.length;
    A.finalNW+=stat[aName].nw; A.tax+=stat[aName].tax; A.conv+=stat[aName].conv;
  }
  if (Math.abs(stat.flat85.short - stat.exact.short) > EPS)
    perCell.push({name, clean, f:stat.flat85, x:stat.exact, o:stat.OFF});
}

const $=n=>'$'+Math.round(n).toLocaleString();
console.log('arm      ceiling-bound yrs   under-filled   headroom unused        OVER yrs   breach $');
for (const [a] of ARMS) {
  const A=acc[a];
  console.log(a.padEnd(8), String(A.years).padStart(17), String(A.shortYears).padStart(14),
    $(A.short).padStart(19), String(A.overYears).padStart(15), $(A.over).padStart(11));
}
console.log('\narm      summed final NW        summed lifetime tax     summed conversions');
for (const [a] of ARMS) {
  const A=acc[a];
  console.log(a.padEnd(8), $(A.finalNW).padStart(17), $(A.tax).padStart(23), $(A.conv).padStart(22));
}

console.log(`\ncells where exact and flat85 differ at all: ${perCell.length}`);
console.log('cell                                             flat85 short      exact short       OFF short');
for (const c of perCell.sort((a,b)=>(b.f.short-b.x.short)-(a.f.short-a.x.short)).slice(0,20))
  console.log('  ', c.name.padEnd(44), $(c.f.short).padStart(13), $(c.x.short).padStart(16), $(c.o.short).padStart(15), c.clean?'':'  [spend differs]');
