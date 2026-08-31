/**
 * ssbasis_harness.js -- P87c1. WHICH taxable-SS regime does a ceiling-filling year actually sit in?
 *
 *   node .test_harnesses/ssbasis_harness.js
 *
 * `underfill_harness.js` established the defect: the sizing aggregate subtracts the FULL Social
 * Security benefit from a MAGI ceiling while at most 85% of the benefit ever reaches MAGI, so the
 * plan stops exactly 15% of its benefit short. That "exactly 15%" is itself a clue - it means the
 * taxable share was pinned at its 85% CAP in every one of those years, not varying with the draw.
 *
 * THAT MATTERS FOR THE FIX. calculateTaxableSocialSecurity (taxengine.js:1290) is monotone in
 * provisional income and capped at 0.85 x totalSS. Where the cap binds, the taxable share does NOT
 * move with the withdrawal being sized, the circularity P87c warns about is inert, and a closed-form
 * subtraction is correct. Where the SLOPED tiers bind (50% or the 85% ramp), MAGI rises 1.5x or
 * 1.85x as fast as the draw and sizing needs the fixed point solved.
 *
 * So: sweep the ceiling families wide enough to reach the low ones (10% / 12% Fed, low FPL
 * multiples, small benefits, big spending) and classify every ceiling-bound year as
 *   ZERO    taxableSS = 0            provisional income under the first threshold
 *   SLOPED  0 < taxableSS < 0.85 SS  a 1.5x or 1.85x marginal MAGI response to the draw
 *   CAPPED  taxableSS = 0.85 SS      flat; the draw does not move the taxable share
 *
 * Reads the hidden log field `-taxableSS` added by P87c (same precedent as P87a's `-fedTaxableInc`).
 * Results go to research/BRACKET_CEILING_BASIS.md section 10.
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

// The ceiling families. ACA multiples are caps, not targets, but they are built by the same
// computeBracketCeiling and spent by the same sizing line, so they belong in the sweep.
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

// Benefit size drives which SS tier a year can land in; spending and IRA size drive how much of the
// ceiling the draw itself occupies. A tiny benefit with heavy spending is the best shot at ZERO.
const SS=[['SS none',{ss1:0,ss2:0}],['SS small',{ss1:9000,ss2:6000}],['SS mid',{ss1:30000,ss2:20000}],['SS large',{ss1:54000,ss2:40000}]];
const WEALTH=[['IRA 400k',{IRA1:300000,IRA2:100000}],['IRA 2.8M',{IRA1:2000000,IRA2:800000}],['IRA 8M',{IRA1:6000000,IRA2:2000000}]];
const SPEND=[['spend 60k',{spendGoal:60000}],['spend 110k',{spendGoal:110000}],['spend 220k',{spendGoal:220000}]];
const STATUS=[['MFJ',{}],['SGL',{hasSpouse:false,ss2:0,IRA2:0,Roth2:0}]];

const EPS=1;                   // dollars; below this a "short" is rounding, not headroom
const CAP=0.85;

function classify(r){                       // r = taxableSS / SSincome
  if (r <= 1e-9) return 'ZERO';
  if (r >= CAP - 1e-6) return 'CAPPED';
  return 'SLOPED';
}

const tally={ZERO:0,SLOPED:0,CAPPED:0};
const underfilled={ZERO:0,SLOPED:0,CAPPED:0};
const shortByRegime={ZERO:0,SLOPED:0,CAPPED:0};
const cells=[];
let cellsRun=0, cellsSkipped=0;

for (const [cl,cov] of CEILINGS)
for (const [sl,sov] of SS)
for (const [wl,wov] of WEALTH)
for (const [pl,pov] of SPEND)
for (const [tl,tov] of STATUS) {
  // A single filer's ss2/IRA2 overrides must win over the SS/WEALTH rows, so STATUS is applied last.
  const inp={...BASE,...cov,...sov,...wov,...pov,...tov};
  if (tl==='SGL') { inp.ss2=0; inp.IRA2=0; inp.Roth2=0; }
  let log;
  try { log = simulate(inp).log; }
  catch(e) { cellsSkipped++; continue; }
  cellsRun++;
  // Ceiling-bound years only: SS actually paid, IRA still funded (a drained IRA cannot reach any
  // ceiling and its short is not a defect), and a ceiling actually computed this year.
  const rows = log.filter(e => e.SSincome > 0 && e.TotalIRA > 1000 && e.BracketTarget > 0);
  if (!rows.length) continue;
  const local={ZERO:0,SLOPED:0,CAPPED:0};
  let cellShort=0;
  for (const e of rows) {
    const reg = classify((e['-taxableSS'] ?? 0) / e.SSincome);
    tally[reg]++; local[reg]++;
    const short = e.BracketTarget - e.MAGI;
    if (short > EPS) { underfilled[reg]++; shortByRegime[reg] += short; cellShort += short; }
  }
  cells.push({name:`${cl} / ${sl} / ${wl} / ${pl} / ${tl}`, ...local, short:cellShort, years:rows.length});
}

const tot = tally.ZERO + tally.SLOPED + tally.CAPPED;
console.log(`cells run ${cellsRun}, skipped ${cellsSkipped}, ceiling-bound years ${tot}\n`);
console.log('regime   years   share    under-filled   headroom never used');
for (const k of ['ZERO','SLOPED','CAPPED'])
  console.log(k.padEnd(8), String(tally[k]).padStart(5),
    (tot ? (tally[k]/tot*100).toFixed(1) : '0.0').padStart(7)+'%',
    String(underfilled[k]).padStart(14),
    ('$'+Math.round(shortByRegime[k]).toLocaleString()).padStart(22));

// The whole decision for P87c2 rides on whether SLOPED is empty. If it is, the taxable share does
// not respond to the draw anywhere a ceiling binds and the fix is closed-form.
const sloped = cells.filter(c => c.SLOPED > 0).sort((a,b) => b.SLOPED - a.SLOPED);
console.log(`\ncells containing any SLOPED year: ${sloped.length} of ${cells.length}`);
for (const c of sloped.slice(0,15))
  console.log('  ', c.name.padEnd(46), 'sloped', String(c.SLOPED).padStart(3), 'of', String(c.years).padStart(3),
    ' short $'+Math.round(c.short).toLocaleString());

const zero = cells.filter(c => c.ZERO > 0);
console.log(`\ncells containing any ZERO year: ${zero.length} of ${cells.length}`);
for (const c of zero.slice(0,10))
  console.log('  ', c.name.padEnd(46), 'zero', String(c.ZERO).padStart(3), 'of', String(c.years).padStart(3));
