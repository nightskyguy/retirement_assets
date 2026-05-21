/**
 * taxPaymentPlanner.js — v3
 * =========================
 * Retirement Tax Payment Strategy Planner — Dual-IRA Edition
 *
 * Enhancements over v2:
 *   • Two independent IRAs (IRA 1 and IRA 2), each with separate RMD,
 *     voluntary withdrawal, and Roth conversion amounts and timing
 *   • Cross-IRA withholding optimizer — concentrates tax withholding in the
 *     latest-month draw across both IRAs to maximise tax-deferred growth
 *   • Per-IRA RMD → Roth ordering rule applied independently
 *   • Tax payments can come from either IRA (optimizer decides)
 *   • Comprehensive STATE_DB for all 50 states, DC, and 5 territories
 *   • todayDate — enables "missed payment" detection and warnings
 *   • State-aware quarterly schedules (CA 30/40/30, VA May 1, OR Dec 15)
 *   • State-aware safe-harbor rules (MD always 110%; CA $1M threshold)
 *   • IRA-exempt state handling (IL, PA, MI, IA, MS)
 *
 * API
 * ---
 *   const plan = TaxPaymentPlanner.computePaymentPlan(params);
 *
 *   plan.actions  — array of PaymentAction objects (sorted by date)
 *   plan.analysis — OC cost comparison across strategies
 *   plan.summary  — totals, key metrics, missed-payment flags
 *   plan.text     — plain-text narrative (headless use)
 *   plan.html     — pre-rendered HTML (HTML driver use)
 *
 * Parameters (all optional except federalTax / stateTax)
 * -------------------------------------------------------
 *   taxYear              {Number}   default: current year
 *   state                {String}   two-letter abbreviation (see STATE_DB)
 *   federalTax           {Number}   total federal tax due
 *   stateTax             {Number}   total state tax due
 *   priorYearFedTax      {Number}   for safe-harbor (null = use 90% of current)
 *   priorYearStateTax    {Number}
 *   highIncomeFiler      {Boolean}  federal AGI > $150K → 110% safe harbor
 *
 *   IRA 1 (first IRA account)
 *   ira1Rmd              {Number}   IRA 1 RMD amount
 *   ira1Voluntary        {Number}   IRA 1 voluntary withdrawal
 *   ira1RmdMonth         {Number}   1–12, month of IRA 1 RMD/draw (default 12)
 *   ira1RothConversion   {Number}   IRA 1 Roth conversion amount (gross)
 *   ira1ConvMonth        {Number}   1–12, month of IRA 1 conversion (default 1)
 *   ira1RothWithhold     {Boolean}  withhold from IRA 1 conversion + 60-day replace
 *
 *   IRA 2 (second IRA account)
 *   ira2Rmd              {Number}   IRA 2 RMD amount
 *   ira2Voluntary        {Number}   IRA 2 voluntary withdrawal
 *   ira2RmdMonth         {Number}   1–12, month of IRA 2 RMD/draw (default 12)
 *   ira2RothConversion   {Number}   IRA 2 Roth conversion amount (gross)
 *   ira2ConvMonth        {Number}   1–12, month of IRA 2 conversion (default 1)
 *   ira2RothWithhold     {Boolean}  withhold from IRA 2 conversion + 60-day replace
 *
 *   Other income
 *   ssIncome             {Number}   Social Security gross benefit
 *   pensionIncome        {Number}   pension / annuity income
 *   interest             {Number}   taxable interest income
 *   qualifiedDivs        {Number}   qualified dividend income
 *   capitalGains         {Number}   scheduled realized capital gains
 *
 *   Rates
 *   portfolioRate        {Number}   annual portfolio return (default 0.07)
 *   hysaGross            {Number}   gross HYSA yield (default 0.045)
 *   marginalOrdRate      {Number}   marginal ordinary rate, fed+state (default 0.30)
 *   cgRateBlended        {Number}   blended LTCG rate (default 0.20)
 *   appreciationPct      {Number}   brokerage unrealized gain fraction (default 0.40)
 *   forceStrategy        {String}   'ye_ira' | 'quarterly' | null (auto)
 *   todayDate            {Date}     for missed-payment detection (default new Date())
 */

'use strict';

const TaxPaymentPlanner = (() => {

  // ── Action type constants ──────────────────────────────────────────────────
  const T = {
    ROTH_CONV: 'roth_conversion',
    RMD:       'rmd_withdrawal',
    IRA_VOL:   'ira_voluntary',
    SUPPL_IRA: 'supplemental_ira',
    Q_FED:     'quarterly_estimate_fed',
    Q_STATE:   'quarterly_estimate_state',
    SS_WHOLD:  'ss_withholding_election',
    ALERT:     'alert',
    NOTE:      'advisory_note',
  };

  // ── Standard quarterly schedule template ───────────────────────────────────
  const _STD_Q = [
    { month: 4, day: 15, w: 0.25, label: 'Q1 (Jan–Mar)', nextYear: false },
    { month: 6, day: 15, w: 0.25, label: 'Q2 (Apr–May)', nextYear: false },
    { month: 9, day: 15, w: 0.25, label: 'Q3 (Jun–Aug)', nextYear: false },
    { month: 1, day: 15, w: 0.25, label: 'Q4 (Sep–Dec)', nextYear: true  },
  ];

  const FED_Q = _STD_Q;

  const OC_FACTOR = {
    Q_FED:   8.0 / 12,
    MONTHLY: 9.5 / 12,
  };

  // ── STATE_DB builder helpers ───────────────────────────────────────────────
  function _s(name, extra) {
    return Object.assign({
      name,
      hasIncomeTax: true,
      iraExempt: false,
      withholdingCreditedProRata: true,
      safeHarborHighIncomeThreshold: 150000,
      safeHarborAlways110: false,
      quarterlySchedule: _STD_Q,
      ocWeightedMonths: 8.0,
      paymentNote: `Pay ${name} estimated tax to the state revenue department.`,
      paymentUrl: null,
    }, extra);
  }

  function _noTax(name) {
    return {
      name,
      hasIncomeTax: false,
      iraExempt: true,
      withholdingCreditedProRata: false,
      safeHarborHighIncomeThreshold: null,
      safeHarborAlways110: false,
      quarterlySchedule: [],
      ocWeightedMonths: 0,
      paymentNote: `${name} has no state income tax — no estimated payments or state withholding required.`,
      paymentUrl: null,
    };
  }

  // ── Comprehensive STATE_DB ─────────────────────────────────────────────────
  const STATE_DB = {
    AK: _noTax('Alaska'),
    FL: _noTax('Florida'),
    NV: _noTax('Nevada'),
    NH: _noTax('New Hampshire'),
    SD: _noTax('South Dakota'),
    TN: _noTax('Tennessee'),
    TX: _noTax('Texas'),
    WA: _noTax('Washington'),
    WY: _noTax('Wyoming'),

    IL: _s('Illinois', {
      iraExempt: true,
      paymentNote: 'Illinois exempts ALL retirement income (IRA, pension, Social Security) from state tax. No state withholding election needed from IRA distributions.',
      paymentUrl: 'https://mytax.illinois.gov/',
    }),
    PA: _s('Pennsylvania', {
      iraExempt: true,
      paymentNote: 'Pennsylvania exempts all retirement income for filers age 59½ or older (IRA, pension, SS). No state withholding needed if you meet the age requirement.',
      paymentUrl: 'https://mypath.pa.gov/',
    }),
    MI: _s('Michigan', {
      iraExempt: true,
      paymentNote: 'Michigan IRA distributions are fully exempt for most retirees (exemption phase-in complete by 2026). Confirm eligibility for your birth year.',
      paymentUrl: 'https://www.michigan.gov/taxes/',
    }),
    IA: _s('Iowa', {
      iraExempt: true,
      paymentNote: 'Iowa exempts retirement income (IRA, pension, SS) for filers age 55 or older as of 2023. No state withholding needed if eligible.',
      paymentUrl: 'https://tax.iowa.gov/',
    }),
    MS: _s('Mississippi', {
      iraExempt: true,
      paymentNote: 'Mississippi exempts retirement income (IRA, pension, SS) for filers age 59½ or older.',
      paymentUrl: 'https://www.dor.ms.gov/',
    }),

    CA: {
      name: 'California',
      hasIncomeTax: true,
      iraExempt: false,
      withholdingCreditedProRata: true,
      safeHarborHighIncomeThreshold: 1000000,
      safeHarborAlways110: false,
      quarterlySchedule: [
        { month: 4, day: 15, w: 0.30, label: 'Q1 (Jan–Mar)', nextYear: false },
        { month: 6, day: 15, w: 0.40, label: 'Q2 (Apr–May)', nextYear: false },
        { month: 1, day: 15, w: 0.30, label: 'Q4 (Sep–Dec)', nextYear: true  },
      ],
      ocWeightedMonths: 8.5,
      paymentNote: 'Pay via FTB Web Pay at ftb.ca.gov. California uses a 30%/40%/30% schedule — there is NO Q3 (September) payment. High-income threshold for 110% safe harbor is $1,000,000 AGI (not $150K).',
      paymentUrl: 'https://www.ftb.ca.gov/pay/index.html',
    },

    OR: {
      name: 'Oregon',
      hasIncomeTax: true,
      iraExempt: false,
      withholdingCreditedProRata: true,
      safeHarborHighIncomeThreshold: 150000,
      safeHarborAlways110: false,
      quarterlySchedule: [
        { month: 4,  day: 15, w: 0.25, label: 'Q1 (Jan–Mar)', nextYear: false },
        { month: 6,  day: 15, w: 0.25, label: 'Q2 (Apr–May)', nextYear: false },
        { month: 9,  day: 15, w: 0.25, label: 'Q3 (Jun–Aug)', nextYear: false },
        { month: 12, day: 15, w: 0.25, label: 'Q4 (Sep–Nov)', nextYear: false },
      ],
      ocWeightedMonths: 8.25,
      paymentNote: 'Pay via Revenue Online at oregon.gov/dor. IMPORTANT: Oregon Q4 estimated tax is due December 15 of the tax year (not January 15 of the following year). Oregon also taxes Social Security benefits.',
      paymentUrl: 'https://revenueonline.dor.oregon.gov/',
    },

    VA: {
      name: 'Virginia',
      hasIncomeTax: true,
      iraExempt: false,
      withholdingCreditedProRata: true,
      safeHarborHighIncomeThreshold: 150000,
      safeHarborAlways110: false,
      quarterlySchedule: [
        { month: 5, day: 1,  w: 0.25, label: 'Q1 (Jan–Mar)', nextYear: false },
        { month: 6, day: 15, w: 0.25, label: 'Q2 (Apr–May)', nextYear: false },
        { month: 9, day: 15, w: 0.25, label: 'Q3 (Jun–Aug)', nextYear: false },
        { month: 1, day: 15, w: 0.25, label: 'Q4 (Sep–Dec)', nextYear: true  },
      ],
      ocWeightedMonths: 7.875,
      paymentNote: 'Pay via Virginia Tax Online at tax.virginia.gov. IMPORTANT: Virginia Q1 is due May 1 (not April 15).',
      paymentUrl: 'https://www.tax.virginia.gov/',
    },

    MD: _s('Maryland', {
      safeHarborAlways110: true,
      paymentNote: 'Pay via Maryland Tax Express at taxes.marylandtaxes.gov. Maryland requires 110% of prior-year tax for the safe harbor regardless of income level.',
      paymentUrl: 'https://interactive.marylandtaxes.gov/',
    }),

    CT: _s('Connecticut', {
      paymentNote: 'Pay via myconneCT at portal.ct.gov/DRS. Note: Connecticut mandatory lump-sum IRA withholding was suspended July 2025–December 2026; voluntary withholding is still available.',
      paymentUrl: 'https://portal.ct.gov/DRS',
    }),
    DC: _s('District of Columbia', {
      paymentNote: 'Pay via MyTax.DC.gov. DC follows the federal quarterly schedule.',
      paymentUrl: 'https://mytax.dc.gov/',
    }),
    GA: _s('Georgia', {
      paymentNote: 'Pay via Georgia Tax Center at gtc.dor.ga.gov. Georgia offers a retirement income exclusion of up to $65,000 per person for filers age 65+.',
      paymentUrl: 'https://gtc.dor.ga.gov/',
    }),
    NE: _s('Nebraska', {
      paymentNote: 'Pay via revenue.nebraska.gov. Social Security benefits are fully exempt from Nebraska income tax effective 2024 (LB873).',
      paymentUrl: 'https://revenue.nebraska.gov/',
    }),
    NC: _s('North Carolina', {
      paymentNote: 'Pay via NC File at ncdor.gov. North Carolina flat income tax rate of 4.5% (2024), declining to 3.99% by 2027.',
      paymentUrl: 'https://www.ncdor.gov/',
    }),
    NY: _s('New York', {
      paymentNote: 'Pay via NY Online Tax Center at tax.ny.gov. IRA distributions are fully taxable in New York; qualifying pension/annuity income has a $20,000 exclusion.',
      paymentUrl: 'https://www.tax.ny.gov/',
    }),
    AL: _s('Alabama', { paymentUrl: 'https://myalabamataxes.alabama.gov/', paymentNote: 'Pay via My Alabama Taxes at myalabamataxes.alabama.gov.' }),
    AZ: _s('Arizona',  { paymentUrl: 'https://www.aztaxes.gov/', paymentNote: 'Pay via AZTaxes at aztaxes.gov.' }),
    AR: _s('Arkansas', { paymentUrl: 'https://atap.arkansas.gov/', paymentNote: 'Pay via Arkansas Taxpayer Access Point at atap.arkansas.gov.' }),
    CO: _s('Colorado', { paymentUrl: 'https://colorado.gov/revenue', paymentNote: 'Pay via Revenue Online at Colorado.gov/Revenue. Colorado offers a retirement income deduction of $20,000–$24,000+ depending on age.' }),
    DE: _s('Delaware', { paymentUrl: 'https://tap.delaware.gov/', paymentNote: 'Pay via Delaware TAP at tap.delaware.gov.' }),
    HI: _s('Hawaii',   { paymentUrl: 'https://hitax.hawaii.gov/', paymentNote: 'Pay via HiTAX at hitax.hawaii.gov. Hawaii exempts most pension income but IRA distributions are taxable.' }),
    ID: _s('Idaho',    { paymentUrl: 'https://tax.idaho.gov/', paymentNote: 'Pay via Idaho TAP at tax.idaho.gov.' }),
    IN: _s('Indiana',  { paymentUrl: 'https://intime.dor.in.gov/', paymentNote: 'Pay via INTIME at intime.dor.in.gov. Indiana flat income tax rate 3.15% (2024).' }),
    KS: _s('Kansas',   { paymentUrl: 'https://www.ksrevenue.gov/', paymentNote: 'Pay via Kansas WebFile at ksrevenue.gov.' }),
    KY: _s('Kentucky', { paymentUrl: 'https://revenue.ky.gov/', paymentNote: 'Pay via Kentucky Revenue Online at revenue.ky.gov. Flat rate 4%.' }),
    LA: _s('Louisiana',{ paymentUrl: 'https://www.revenue.louisiana.gov/', paymentNote: 'Pay via Louisiana File Online at revenue.louisiana.gov. Up to $6,000 per person of retirement income is exempt.' }),
    ME: _s('Maine',    { paymentUrl: 'https://www.maine.gov/revenue/', paymentNote: 'Pay via Maine Revenue Services at maine.gov/revenue.' }),
    MA: _s('Massachusetts', { paymentUrl: 'https://mtc.dor.state.ma.us/', paymentNote: 'Pay via MassTaxConnect at mass.gov/masstaxconnect. Massachusetts taxes IRA distributions at the flat 5% rate.' }),
    MN: _s('Minnesota',{ paymentUrl: 'https://www.mndor.state.mn.us/', paymentNote: 'Pay via e-Services at taxes.state.mn.us.' }),
    MO: _s('Missouri', { paymentUrl: 'https://mytax.mo.gov/', paymentNote: 'Pay via MyTax Missouri at mytax.mo.gov.' }),
    MT: _s('Montana',  { paymentUrl: 'https://tap.dor.mt.gov/', paymentNote: 'Pay via Montana TAP at tap.dor.mt.gov.' }),
    NM: _s('New Mexico',{ paymentUrl: 'https://tap.state.nm.us/', paymentNote: 'Pay via New Mexico TAP at tap.state.nm.us.' }),
    NJ: _s('New Jersey',{ paymentUrl: 'https://www.state.nj.us/treasury/taxation/', paymentNote: 'Pay via NJ Tax at nj.gov/taxation. NJ exempts pension/IRA income up to $75,000 for joint filers with gross income ≤ $100,000.' }),
    ND: _s('North Dakota',{ paymentUrl: 'https://www.tax.nd.gov/', paymentNote: 'Pay via North Dakota TAP at tax.nd.gov.' }),
    OH: _s('Ohio',     { paymentUrl: 'https://gateway.ohio.gov/', paymentNote: 'Pay via Ohio Business Gateway at gateway.ohio.gov.' }),
    OK: _s('Oklahoma', { paymentUrl: 'https://oktap.tax.ok.gov/', paymentNote: 'Pay via OkTAP at tax.ok.gov.' }),
    RI: _s('Rhode Island',{ paymentUrl: 'https://www.ri.gov/taxation/', paymentNote: 'Pay via RI Division of Taxation at tax.ri.gov.' }),
    SC: _s('South Carolina',{ paymentUrl: 'https://mydorway.dor.sc.gov/', paymentNote: 'Pay via MyDORWAY at dor.sc.gov. South Carolina exempts up to $15,000 of IRA/retirement income for filers age 65+.' }),
    UT: _s('Utah',     { paymentUrl: 'https://tap.utah.gov/', paymentNote: 'Pay via Utah TAP at tap.utah.gov. Utah offers a retirement income credit for taxpayers age 65+.' }),
    VT: _s('Vermont',  { paymentUrl: 'https://myvtax.vermont.gov/', paymentNote: 'Pay via myVTax at myvtax.state.vt.us.' }),
    WI: _s('Wisconsin',{ paymentUrl: 'https://tap.revenue.wi.gov/', paymentNote: 'Pay via My Tax Account at tap.revenue.wi.gov.' }),
    WV: _s('West Virginia',{ paymentUrl: 'https://mytaxes.wvtax.gov/', paymentNote: 'Pay via MyTaxes at mytaxes.wvtax.gov. West Virginia is phasing out the state tax on Social Security benefits.' }),

    PR: _s('Puerto Rico', { paymentNote: 'Puerto Rico has its own distinct tax system. Retirement income rules differ significantly from federal rules. Consult a Puerto Rico tax professional.' }),
    GU: _s('Guam',        { paymentNote: 'Guam mirrors the U.S. Internal Revenue Code. Pay to the Guam Department of Revenue and Taxation.' }),
    VI: _s('U.S. Virgin Islands', { paymentNote: 'The USVI mirrors the U.S. Internal Revenue Code. Pay to the Virgin Islands Bureau of Internal Revenue.' }),
    AS: _s('American Samoa', { withholdingCreditedProRata: false, paymentNote: 'American Samoa has its own tax system. Consult the American Samoa Government Department of Treasury.' }),
    MP: _s('N. Mariana Islands', { paymentNote: 'The CNMI mirrors the U.S. Internal Revenue Code. Pay to the CNMI Division of Revenue and Taxation.' }),

    _DEFAULT: _s('Your State', {
      paymentNote: "Pay estimated tax to your state's revenue department. Confirm your state's specific quarterly schedule and safe-harbor rules before relying on this plan.",
    }),
  };

  // ── Formatting helpers ─────────────────────────────────────────────────────
  const fmt$   = n => '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
  const fmtPct = (n, d = 1) => (n * 100).toFixed(d) + '%';
  const round2 = n => Math.round(n * 100) / 100;

  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  function fmtDate(year, month, day) {
    return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
  }

  function iraOcFactor(rmdMonth) {
    return (16 - Math.max(1, Math.min(12, rmdMonth))) / 12;
  }

  function getStateInfo(code) {
    return STATE_DB[code] || STATE_DB._DEFAULT;
  }

  function detectMissed(schedule, taxYear, todayDate) {
    return schedule
      .map(q => {
        const dueYear = q.nextYear ? taxYear + 1 : taxYear;
        return Object.assign({}, q, { dueYear, dueDate: new Date(dueYear, q.month - 1, q.day) });
      })
      .filter(q => q.dueDate < todayDate);
  }

  // ── Per-IRA ordering rule helper ──────────────────────────────────────────
  // Returns { planARmdMonth, planARmdDay, planAConvDay, hasConflict, sameMonth }
  function resolveIraOrdering(rmd, rmdMonth, conv, convMonth) {
    const clamp = m => Math.max(1, Math.min(12, Math.round(m || 12)));
    const rm = clamp(rmdMonth);
    const cm = clamp(convMonth);
    const hasConflict = rmd > 0 && conv > 0 && cm <= rm;
    const planARmdMonth = hasConflict ? cm : rm;
    const sameMonth = rmd > 0 && conv > 0 && planARmdMonth === cm;
    return {
      planARmdMonth,
      planAConvMonth: cm,
      planARmdDay:  sameMonth ? 14 : 15,
      planAConvDay: 15,
      hasConflict,
      sameMonth,
      origRmdMonth: rm,
      origConvMonth: cm,
    };
  }

  // ── Main compute function ──────────────────────────────────────────────────
  function computePaymentPlan(params) {

    // 1. Merge defaults
    const p = Object.assign({
      taxYear:           new Date().getFullYear(),
      state:             'CA',
      federalTax:        0,
      stateTax:          0,
      priorYearFedTax:   null,
      priorYearStateTax: null,
      highIncomeFiler:   false,

      ira1Rmd:            0,
      ira1Voluntary:      0,
      ira1RmdMonth:       12,
      ira1RothConversion: 0,
      ira1ConvMonth:      1,
      ira1RothWithhold:   false,

      ira2Rmd:            0,
      ira2Voluntary:      0,
      ira2RmdMonth:       12,
      ira2RothConversion: 0,
      ira2ConvMonth:      1,
      ira2RothWithhold:   false,

      ssIncome:          0,
      pensionIncome:     0,
      interest:          0,
      qualifiedDivs:     0,
      capitalGains:      0,
      portfolioRate:     0.07,
      hysaGross:         0.045,
      marginalOrdRate:   0.30,
      cgRateBlended:     0.20,
      appreciationPct:   0.40,
      forceStrategy:     null,
      todayDate:         new Date(),
      _baseline:         false,
    }, params);

    const yr        = p.taxYear;
    const today     = p.todayDate instanceof Date ? p.todayDate : new Date(p.todayDate);
    const stateInfo = getStateInfo(p.state);

    // 2. Per-IRA ordering rules + past-conversion detection
    const currentMonth = today.getMonth() + 1;                     // 1–12
    const nextMonth    = Math.min(currentMonth + 1, 12);

    let ira1 = resolveIraOrdering(p.ira1Rmd, p.ira1RmdMonth, p.ira1RothConversion, p.ira1ConvMonth);
    let ira2 = resolveIraOrdering(p.ira2Rmd, p.ira2RmdMonth, p.ira2RothConversion, p.ira2ConvMonth);

    // If the user's preferred conversion month has already passed (and we are not
    // generating the December baseline), bump it forward to next month.
    const ira1ConvPassed = !p._baseline && p.ira1RothConversion > 0 && ira1.planAConvMonth < currentMonth;
    const ira2ConvPassed = !p._baseline && p.ira2RothConversion > 0 && ira2.planAConvMonth < currentMonth;

    if (ira1ConvPassed) {
      const orig = ira1.planAConvMonth;
      ira1 = resolveIraOrdering(p.ira1Rmd, p.ira1RmdMonth, p.ira1RothConversion, nextMonth);
      ira1.passedOrigMonth = orig;
    }
    if (ira2ConvPassed) {
      const orig = ira2.planAConvMonth;
      ira2 = resolveIraOrdering(p.ira2Rmd, p.ira2RmdMonth, p.ira2RothConversion, nextMonth);
      ira2.passedOrigMonth = orig;
    }

    // 3. Core derived values
    const totalTax  = p.federalTax + p.stateTax;
    const hysaNet   = p.hysaGross * (1 - p.marginalOrdRate);
    const breakeven = p.portfolioRate / 2;
    const yeIraWins = hysaNet < breakeven;

    const fedFrac = totalTax > 0 ? p.federalTax / totalTax : 0.5;
    const stFrac  = 1 - fedFrac;

    const stateIraExempt = stateInfo.iraExempt;
    // For IRA-exempt states, state tax cannot be withheld from IRA draws
    const wFedFrac = stateIraExempt ? 1.0 : fedFrac;
    const wStFrac  = stateIraExempt ? 0.0 : stFrac;

    // 4. IRA draw totals per account
    const ira1DrawTotal = p.ira1Rmd + p.ira1Voluntary;
    const ira2DrawTotal = p.ira2Rmd + p.ira2Voluntary;
    const allDrawsTotal = ira1DrawTotal + ira2DrawTotal;

    // 5. Conversion withholding (optional, per user's rothWithhold flag)
    const grossIncome = allDrawsTotal + p.ira1RothConversion + p.ira2RothConversion +
                        p.ssIncome + p.pensionIncome + p.interest + p.qualifiedDivs + p.capitalGains;

    let convWithholdFed = 0, convWithholdState = 0;
    let ira1ConvFedW = 0, ira1ConvStW = 0;
    let ira2ConvFedW = 0, ira2ConvStW = 0;

    if (p.ira1RothWithhold && p.ira1RothConversion > 0) {
      ira1ConvFedW   = Math.round(p.federalTax * (p.ira1RothConversion / Math.max(1, grossIncome)));
      ira1ConvStW    = stateIraExempt ? 0 : Math.round(ira1ConvFedW * stFrac / Math.max(0.001, fedFrac));
      convWithholdFed   += ira1ConvFedW;
      convWithholdState += ira1ConvStW;
    }
    if (p.ira2RothWithhold && p.ira2RothConversion > 0) {
      ira2ConvFedW   = Math.round(p.federalTax * (p.ira2RothConversion / Math.max(1, grossIncome)));
      ira2ConvStW    = stateIraExempt ? 0 : Math.round(ira2ConvFedW * stFrac / Math.max(0.001, fedFrac));
      convWithholdFed   += ira2ConvFedW;
      convWithholdState += ira2ConvStW;
    }

    // 6. Cross-IRA withholding optimizer
    // Tax remaining after conversion withholding that IRA draws must cover
    const taxAfterConvW = Math.max(0, totalTax - convWithholdFed - convWithholdState);
    // For IRA-exempt states, IRA draws can only cover federal portion
    const drawWithholdCap = stateIraExempt
      ? Math.min(allDrawsTotal, Math.max(0, p.federalTax - convWithholdFed))
      : Math.min(allDrawsTotal, taxAfterConvW);

    // Sort draw groups by month descending — latest-month draws get withholding first
    const drawGroups = [
      { num: 1, month: ira1.planARmdMonth, total: ira1DrawTotal, withheld: 0 },
      { num: 2, month: ira2.planARmdMonth, total: ira2DrawTotal, withheld: 0 },
    ].filter(g => g.total > 0).sort((a, b) => b.month - a.month);

    let remaining = drawWithholdCap;
    for (const g of drawGroups) {
      g.withheld = Math.min(g.total, remaining);
      remaining -= g.withheld;
      if (remaining <= 0) break;
    }

    const ira1Withheld = drawGroups.find(g => g.num === 1)?.withheld || 0;
    const ira2Withheld = drawGroups.find(g => g.num === 2)?.withheld || 0;
    const totalIraDrawWithheld = ira1Withheld + ira2Withheld;
    const totalCovered = totalIraDrawWithheld + convWithholdFed + convWithholdState;
    const shortfall    = Math.max(0, totalTax - totalCovered);

    // 7. Safe-harbor amounts
    const sfFedMult   = p.highIncomeFiler ? 1.10 : 1.00;
    const sfStateMult = stateInfo.safeHarborAlways110 ? 1.10
                      : (p.highIncomeFiler && p.stateTax >= (stateInfo.safeHarborHighIncomeThreshold || Infinity))
                        ? 1.10 : 1.00;
    const shFed   = p.priorYearFedTax   != null ? p.priorYearFedTax   * sfFedMult   : p.federalTax * 0.90;
    const shState = p.priorYearStateTax != null ? p.priorYearStateTax * sfStateMult : p.stateTax   * 0.90;

    // 8. Strategy selection
    let strategy;
    const iraWCap = drawWithholdCap + convWithholdFed + convWithholdState; // total IRA coverage capacity
    if (p.forceStrategy === 'ye_ira') {
      strategy = iraWCap >= totalTax ? 'ye_ira_full' : 'ye_ira_partial';
    } else if (p.forceStrategy === 'quarterly') {
      strategy = 'all_quarterly';
    } else if (allDrawsTotal === 0 && p.ira1RothConversion === 0 && p.ira2RothConversion === 0) {
      strategy = 'all_quarterly';
    } else if (yeIraWins && iraWCap >= totalTax) {
      strategy = 'ye_ira_full';
    } else if (yeIraWins) {
      strategy = 'ye_ira_partial';
    } else {
      strategy = iraWCap >= totalTax ? 'ye_ira_full' : 'ye_ira_partial';
    }
    const usesIraWithholding = strategy === 'ye_ira_full' || strategy === 'ye_ira_partial';

    // 9. Effective withholding month for OC factor
    //    = latest draw group that actually carries withholding
    const withholdingGroup = drawGroups.find(g => g.withheld > 0);
    const effectiveWithholdMonth = withholdingGroup ? withholdingGroup.month : 12;

    // 10. Detect missed quarterly payments
    const missedFed   = detectMissed(FED_Q, yr, today);
    const missedState = stateInfo.hasIncomeTax ? detectMissed(stateInfo.quarterlySchedule, yr, today) : [];
    const hasMissed   = missedFed.length > 0 || missedState.length > 0;

    // 11. Build action list
    const actions = [];
    const addAction = obj => {
      const base = {
        type: T.NOTE, date: null, dateLabel: '',
        amount: 0, federalWithholding: 0, stateWithholding: 0,
        totalWithholding: 0, netReceived: 0,
        fedWithholdPct: 0, stateWithholdPct: 0,
        description: '', notes: [],
      };
      const a = Object.assign(base, obj);
      a.totalWithholding = a.federalWithholding + a.stateWithholding;
      a.netReceived      = a.amount - a.totalWithholding;
      if (a.amount > 0) {
        a.fedWithholdPct   = a.federalWithholding / a.amount;
        a.stateWithholdPct = a.stateWithholding   / a.amount;
      }
      if (a.date) a.dateLabel = fmtDate(a.date.year, a.date.month, a.date.day);
      actions.push(a);
      return a;
    };

    // ── 11a. Per-IRA ordering rule notes + passed-conversion alerts ──────────
    for (const [iraNum, ira, convPassed] of [[1, ira1, ira1ConvPassed], [2, ira2, ira2ConvPassed]]) {
      const convAmt = iraNum === 1 ? p.ira1RothConversion : p.ira2RothConversion;
      // Alert when the user's preferred conversion month has already passed
      if (convPassed && convAmt > 0) {
        addAction({
          type: T.ALERT,
          description:
            `IRA ${iraNum} — Roth conversion month (${MONTH_NAMES[ira.passedOrigMonth - 1]}) has already passed as of ` +
            `${fmtDate(today.getFullYear(), today.getMonth() + 1, today.getDate())}. ` +
            `The plan has been updated to target next month: ` +
            `<strong>${MONTH_NAMES[ira.planAConvMonth - 1]}</strong>. ` +
            `If you want to push to December instead, see Plan B below.`,
          notes: [
            `You can still do a Roth conversion any time before December 31 — there is no deadline other than year-end.`,
            `Converting in ${MONTH_NAMES[ira.planAConvMonth - 1]} still provides ${12 - ira.planAConvMonth} months of tax-free Roth growth this year.`,
          ],
        });
      }
      const iraP = { rmd: iraNum === 1 ? p.ira1Rmd : p.ira2Rmd, conv: convAmt };
      if (iraP.rmd > 0 && iraP.conv > 0) {
        addAction({
          type: T.NOTE,
          description:
            `IRA ${iraNum} — IRS ordering rule: the RMD (${fmt$(iraP.rmd)}) must be distributed ` +
            `before the Roth conversion can take place in the same tax year. ` +
            (ira.hasConflict
              ? `The RMD has been moved from ${MONTH_NAMES[ira.origRmdMonth - 1]} to ` +
                `${MONTH_NAMES[ira.planARmdMonth - 1]} (day ${ira.planARmdDay}) ` +
                `so the conversion can proceed on ${MONTH_NAMES[ira.planAConvMonth - 1]} ${ira.planAConvDay}. `
              : `Your specified IRA ${iraNum} RMD month (${MONTH_NAMES[ira.origRmdMonth - 1]}) already precedes ` +
                `the conversion month (${MONTH_NAMES[ira.planAConvMonth - 1]}) — no adjustment needed. `) +
            `See the two-plan comparison in the analysis section.`,
          notes: [
            'RMD amounts are not eligible for rollover or Roth conversion — only the balance beyond the RMD can be converted.',
            'QCD: directing this RMD to charity (up to $108,000/yr) satisfies the RMD requirement, excludes the amount from income, and allows an earlier conversion without taking the RMD cash first.',
          ],
        });
      }
    }

    // ── 11b. Missed-payment alerts ──────────────────────────────────────────
    if (hasMissed) {
      const todayStr = fmtDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
      if (usesIraWithholding) {
        const missedLabels = [
          ...missedFed.map(q => `Federal ${q.label} (due ${fmtDate(q.dueYear, q.month, q.day)})`),
          ...missedState.map(q => `${stateInfo.name} ${q.label} (due ${fmtDate(q.dueYear, q.month, q.day)})`),
        ].join('; ');
        addAction({
          type: T.ALERT,
          description:
            `As of ${todayStr}, the following quarterly installment dates have passed: ${missedLabels}. ` +
            `No action is required — your strategy uses year-end IRA withholding, which the IRS (and most ` +
            `state revenue agencies) credit as if paid pro-rata throughout the year.`,
          notes: [
            'IRS Publication 505: withholding from IRA distributions is deemed paid equally on each quarterly due date — a December IRA distribution fully satisfies all four quarterly installments retroactively.',
            stateInfo.withholdingCreditedProRata
              ? `${stateInfo.name} similarly credits IRA withholding pro-rata — your state is also penalty-free.`
              : `Verify that ${stateInfo.name} applies the same pro-rata withholding credit rule.`,
          ],
        });
      } else {
        const fedMissedAmt = missedFed.reduce((s, q) => s + Math.round(p.federalTax * q.w), 0);
        const stMissedAmt  = missedState.reduce((s, q) => s + Math.round(p.stateTax  * q.w), 0);
        addAction({
          type: T.ALERT,
          description:
            `MISSED PAYMENT WARNING (as of ${todayStr}): ` +
            (missedFed.length > 0 ? `${missedFed.length} federal quarterly installment(s) totaling ${fmt$(fedMissedAmt)} appear past due. ` : '') +
            (missedState.length > 0 ? `${missedState.length} ${stateInfo.name} installment(s) totaling ${fmt$(stMissedAmt)} appear past due. ` : '') +
            `Pay any missed amounts immediately to minimize penalty exposure.`,
          notes: [
            'The IRS underpayment penalty (Form 2210) is computed daily — catching up now limits the penalty to the period already elapsed.',
            'Alternative: switch to year-end IRA withholding. Withholding credited retroactively can eliminate the underpayment penalty entirely.',
          ],
        });
      }
    }

    // ── 11c. Roth conversion actions (per IRA) ──────────────────────────────
    for (const [iraNum, ira, convFedW, convStW, convAmt, rothWithhold] of [
      [1, ira1, ira1ConvFedW, ira1ConvStW, p.ira1RothConversion, p.ira1RothWithhold],
      [2, ira2, ira2ConvFedW, ira2ConvStW, p.ira2RothConversion, p.ira2RothWithhold],
    ]) {
      if (convAmt <= 0) continue;
      const convDate    = { year: yr, month: ira.planAConvMonth, day: ira.planAConvDay };
      const convDateStr = fmtDate(yr, ira.planAConvMonth, ira.planAConvDay);
      const monthsOfGrowth = 12 - ira.planAConvMonth;

      if (rothWithhold) {
        addAction({
          type: T.ROTH_CONV,
          iraNum,
          date: convDate,
          amount: convAmt,
          federalWithholding: convFedW,
          stateWithholding:   convStW,
          description:
            `IRA ${iraNum} — Roth convert ${fmt$(convAmt)} on ${convDateStr}. ` +
            `Withhold ${fmt$(convFedW)} federal (${fmtPct(convFedW / convAmt)})` +
            (convStW > 0 ? ` and ${fmt$(convStW)} ${stateInfo.name} (${fmtPct(convStW / convAmt)})` : '') +
            `. Restore ${fmt$(convFedW + convStW)} from outside cash into Roth within 60 days.`,
          notes: [
            'Withholding reduces the Roth credit — the 60-day cash replacement makes the conversion whole.',
            'CAUTION: The 60-day replacement counts as an indirect rollover — you are limited to ONE indirect rollover per rolling 12-month period across all IRAs combined.',
            ira.hasConflict
              ? `RMD ordering enforced: IRA ${iraNum} RMD distributed on ${MONTH_NAMES[ira.planARmdMonth-1]} ${ira.planARmdDay}; conversion follows on ${MONTH_NAMES[ira.planAConvMonth-1]} ${ira.planAConvDay}.`
              : monthsOfGrowth > 0
                ? `Converting IRA ${iraNum} in ${MONTH_NAMES[ira.planAConvMonth-1]} gives ${monthsOfGrowth} months of tax-free Roth growth this year.`
                : `Converting IRA ${iraNum} in January maximizes tax-free Roth growth for the year.`,
          ],
        });
      } else {
        addAction({
          type: T.ROTH_CONV,
          iraNum,
          date: convDate,
          amount: convAmt,
          federalWithholding: 0,
          stateWithholding:   0,
          description:
            `IRA ${iraNum} — Roth convert ${fmt$(convAmt)} on ${convDateStr}. ` +
            `Do not withhold — taxes on this conversion are covered by the IRA draws shown below.`,
          notes: [
            'Withholding from a Roth conversion reduces the converted amount and is an avoidable taxable distribution — fund taxes via IRA draws instead.',
            ira.hasConflict
              ? `RMD ordering enforced: IRA ${iraNum} RMD distributed first; this conversion follows.`
              : monthsOfGrowth > 0
                ? `Converting IRA ${iraNum} in ${MONTH_NAMES[ira.planAConvMonth-1]} provides ${monthsOfGrowth} months of tax-free Roth growth this year.`
                : `Converting IRA ${iraNum} in January maximizes tax-free Roth growth for the year.`,
            `Estimated tax attributable to this conversion: ${fmt$(Math.round(p.federalTax * (convAmt / Math.max(1, grossIncome))))} federal` +
            (stateIraExempt ? ` (${stateInfo.name} is IRA-exempt — no state tax on conversion).` : ` (proportional estimate).`),
          ],
        });
      }
    }

    // ── 11d. IRA draw actions (with cross-IRA optimized withholding) ─────────
    if (usesIraWithholding) {
      for (const [iraNum, ira, iraTotal, iraWithheld] of [
        [1, ira1, ira1DrawTotal, ira1Withheld],
        [2, ira2, ira2DrawTotal, ira2Withheld],
      ]) {
        if (iraTotal <= 0) continue;

        const iraFedW = Math.round(iraWithheld * wFedFrac);
        const iraStW  = Math.round(iraWithheld * wStFrac);
        const rmdDate    = { year: yr, month: ira.planARmdMonth, day: ira.planARmdDay };
        const rmdDateStr = fmtDate(yr, ira.planARmdMonth, ira.planARmdDay);

        const iRmd = iraNum === 1 ? p.ira1Rmd : p.ira2Rmd;
        const iVol = iraNum === 1 ? p.ira1Voluntary : p.ira2Voluntary;
        const splits = [
          { type: T.RMD,     amt: iRmd, label: `IRA ${iraNum} RMD` },
          { type: T.IRA_VOL, amt: iVol, label: `IRA ${iraNum} voluntary withdrawal` },
        ].filter(s => s.amt > 0);

        for (const sp of splits) {
          const frac  = sp.amt / iraTotal;
          const fedW  = Math.round(iraFedW * frac);
          const stW   = Math.round(iraStW  * frac);
          const totW  = fedW + stW;
          const net   = sp.amt - totW;
          const pctFed = sp.amt > 0 ? fedW / sp.amt : 0;
          const pctSt  = sp.amt > 0 ? stW  / sp.amt : 0;
          const pctTot = sp.amt > 0 ? totW / sp.amt : 0;

          const optimizerNote = drawGroups.length > 1 && iraWithheld === 0
            ? `IRA ${iraNum} draw month (${MONTH_NAMES[ira.planARmdMonth-1]}) is earlier than another IRA draw — the cross-IRA optimizer directed all withholding to the later IRA draw to maximize tax-deferred growth. No withholding from IRA ${iraNum}.`
            : drawGroups.length > 1
              ? `Cross-IRA optimizer: IRA ${iraNum} carries withholding (${MONTH_NAMES[ira.planARmdMonth-1]}) because it has the latest draw month, keeping IRA money invested the longest.`
              : null;

          const notes = [
            totW > 0 ? `Total withholding: ${fmt$(totW)} (${fmtPct(pctTot)} of distribution).` : `No withholding on this draw — taxes covered by another IRA's draw.`,
            'IRS credit rule: withholding from IRA distributions is deemed paid pro-rata on each quarterly due date — even a December draw satisfies the entire-year quarterly safe-harbor retroactively.',
          ];
          if (optimizerNote) notes.push(optimizerNote);
          if (stateIraExempt) {
            notes.push(`${stateInfo.name}: IRA distributions are exempt from state tax — no state withholding applied. State tax covered by quarterly estimates.`);
          } else if (stateInfo.withholdingCreditedProRata) {
            notes.push(`${stateInfo.name} similarly credits IRA withholding as if paid pro-rata throughout the year.`);
          }
          if (ira.planARmdMonth < 12) {
            notes.push(`Taking this draw in ${MONTH_NAMES[ira.planARmdMonth-1]} is earlier than December — see the two-plan comparison to quantify the opportunity cost.`);
          } else {
            notes.push('Taking this draw in December maximises IRA tax-deferred growth through the year.');
          }
          if (sp.type === T.RMD) {
            notes.push(
              ira.sameMonth
                ? `IRA ${iraNum} RMD must be completed before the Roth conversion in the same month. Take on or before the 14th; conversion follows on the 15th.`
                : `IRA ${iraNum} RMD must be completed by December 31.`
            );
          }

          addAction({
            type: sp.type,
            iraNum,
            date: rmdDate,
            amount: sp.amt,
            federalWithholding: fedW,
            stateWithholding:   stW,
            description:
              `Withdraw ${sp.label} of ${fmt$(sp.amt)} on ${rmdDateStr}. ` +
              (totW > 0
                ? `Withhold ${fmt$(fedW)} federal (${fmtPct(pctFed)})` +
                  (stW > 0 ? ` and ${fmt$(stW)} ${stateInfo.name} (${fmtPct(pctSt)})` : '') +
                  `. Net deposited: ${fmt$(net)}.`
                : `No withholding — taxes covered by other IRA draws. Net deposited: ${fmt$(net)}.`),
            notes,
          });
        }
      }

      // ── Shortfall quarterly estimates ──────────────────────────────────────
      if (shortfall > 0) {
        const sfFed   = stateIraExempt
          ? Math.max(0, p.federalTax - totalIraDrawWithheld - convWithholdFed)
          : Math.round(shortfall * fedFrac);
        const sfState = stateIraExempt
          ? p.stateTax
          : Math.round(shortfall - sfFed);

        addAction({
          type: T.NOTE,
          description:
            `IRA withholding covers ${fmt$(totalCovered)} of your ${fmt$(totalTax)} total liability. ` +
            `The remaining ${fmt$(shortfall)} (${fmt$(sfFed)} federal` +
            (sfState > 0 ? `, ${fmt$(sfState)} ${stateInfo.name}` : '') +
            `) must be paid as quarterly estimated taxes from cash or HYSA.` +
            (stateIraExempt ? ` Note: ${stateInfo.name} retirement income is IRA-exempt — the full ${fmt$(p.stateTax)} state tax is covered by quarterly estimates.` : ''),
          notes: ['Pay from a high-yield savings account — HYSA earnings partially offset the opportunity cost.'],
        });

        FED_Q.forEach(q => {
          const amt = Math.round(sfFed * q.w);
          if (amt === 0) return;
          const dueYear = q.nextYear ? yr + 1 : yr;
          const isPast  = new Date(dueYear, q.month - 1, q.day) < today;
          addAction({
            type: T.Q_FED,
            date: { year: dueYear, month: q.month, day: q.day },
            amount: amt,
            federalWithholding: amt,
            description:
              `Pay federal estimated tax of ${fmt$(amt)} by ${fmtDate(dueYear, q.month, q.day)} ` +
              `(${q.label} — ${fmtPct(q.w)} of ${fmt$(sfFed)} federal shortfall).` +
              (isPast ? ' [PAST DUE — pay immediately]' : ''),
            notes: [
              'Pay via IRS Direct Pay at directpay.irs.gov or EFTPS at eftps.gov.',
              isPast ? 'This installment is past due. Make a catch-up payment now to minimise underpayment penalty.' : '',
            ].filter(Boolean),
          });
        });

        if (sfState > 0 && stateInfo.hasIncomeTax && stateInfo.quarterlySchedule.length > 0) {
          stateInfo.quarterlySchedule.forEach(q => {
            const amt = Math.round(sfState * q.w);
            if (amt === 0) return;
            const dueYear = q.nextYear ? yr + 1 : yr;
            const isPast  = new Date(dueYear, q.month - 1, q.day) < today;
            addAction({
              type: T.Q_STATE,
              date: { year: dueYear, month: q.month, day: q.day },
              amount: amt,
              stateWithholding: amt,
              description:
                `Pay ${stateInfo.name} estimated tax of ${fmt$(amt)} by ` +
                `${fmtDate(dueYear, q.month, q.day)} ` +
                `(${q.label} — ${fmtPct(q.w)} of ${fmt$(sfState)} ${stateInfo.name} shortfall).` +
                (isPast ? ' [PAST DUE — pay immediately]' : ''),
              notes: [
                stateInfo.paymentNote,
                isPast ? 'This installment is past due. Pay now to minimise the underpayment penalty.' : '',
              ].filter(Boolean),
            });
          });
        }
      }

    } else {
      // ── All quarterly (no IRA withholding) ──────────────────────────────────
      FED_Q.forEach(q => {
        const amt = Math.round(p.federalTax * q.w);
        if (amt === 0) return;
        const dueYear = q.nextYear ? yr + 1 : yr;
        const isPast  = new Date(dueYear, q.month - 1, q.day) < today;
        addAction({
          type: T.Q_FED,
          date: { year: dueYear, month: q.month, day: q.day },
          amount: amt,
          federalWithholding: amt,
          description:
            `Pay federal estimated tax of ${fmt$(amt)} by ${fmtDate(dueYear, q.month, q.day)} ` +
            `(${q.label} — ${fmtPct(q.w)} of ${fmt$(p.federalTax)} federal tax).` +
            (isPast ? ' [PAST DUE — pay immediately]' : ''),
          notes: [
            'Pay via IRS Direct Pay at directpay.irs.gov or EFTPS at eftps.gov.',
            isPast ? 'This installment is past due. Make a catch-up payment immediately.' : '',
          ].filter(Boolean),
        });
      });

      if (stateInfo.hasIncomeTax && stateInfo.quarterlySchedule.length > 0 && p.stateTax > 0) {
        stateInfo.quarterlySchedule.forEach(q => {
          const amt = Math.round(p.stateTax * q.w);
          if (amt === 0) return;
          const dueYear = q.nextYear ? yr + 1 : yr;
          const isPast  = new Date(dueYear, q.month - 1, q.day) < today;
          addAction({
            type: T.Q_STATE,
            date: { year: dueYear, month: q.month, day: q.day },
            amount: amt,
            stateWithholding: amt,
            description:
              `Pay ${stateInfo.name} estimated tax of ${fmt$(amt)} by ` +
              `${fmtDate(dueYear, q.month, q.day)} ` +
              `(${q.label} — ${fmtPct(q.w)} of ${fmt$(p.stateTax)} ${stateInfo.name} tax).` +
              (isPast ? ' [PAST DUE — pay immediately]' : ''),
            notes: [
              stateInfo.paymentNote,
              isPast ? 'This installment is past due.' : '',
            ].filter(Boolean),
          });
        });
      } else if (!stateInfo.hasIncomeTax) {
        addAction({ type: T.NOTE, description: `${stateInfo.name} has no state income tax — no state estimated payments required.` });
      }
    }

    // 12. Sort: undated (alerts/notes) first, then by date
    actions.sort((a, b) => {
      if (!a.date && !b.date) {
        if (a.type === T.ALERT && b.type !== T.ALERT) return -1;
        if (b.type === T.ALERT && a.type !== T.ALERT) return  1;
        return 0;
      }
      if (!a.date) return -1;
      if (!b.date) return  1;
      const da = new Date(a.date.year, a.date.month - 1, a.date.day);
      const db = new Date(b.date.year, b.date.month - 1, b.date.day);
      return da - db;
    });
    actions.forEach((a, i) => { a.seq = i + 1; });

    // 13. Verify totals + coverage breakdown by category
    const verFed   = actions.reduce((s, a) => s + a.federalWithholding, 0);
    const verState = actions.reduce((s, a) => s + a.stateWithholding,   0);

    // Coverage summary: how each withholding/payment category contributes to total tax
    const coverageSummary = {
      ira1Draw:   { fed: 0, state: 0 },
      ira2Draw:   { fed: 0, state: 0 },
      conversion: { fed: 0, state: 0 },
      quarterly:  { fed: 0, state: 0 },
    };
    actions.forEach(a => {
      if (a.iraNum === 1 && (a.type === T.RMD || a.type === T.IRA_VOL || a.type === T.SUPPL_IRA)) {
        coverageSummary.ira1Draw.fed   += a.federalWithholding;
        coverageSummary.ira1Draw.state += a.stateWithholding;
      } else if (a.iraNum === 2 && (a.type === T.RMD || a.type === T.IRA_VOL || a.type === T.SUPPL_IRA)) {
        coverageSummary.ira2Draw.fed   += a.federalWithholding;
        coverageSummary.ira2Draw.state += a.stateWithholding;
      } else if (a.type === T.ROTH_CONV) {
        coverageSummary.conversion.fed   += a.federalWithholding;
        coverageSummary.conversion.state += a.stateWithholding;
      } else if (a.type === T.Q_FED) {
        coverageSummary.quarterly.fed += a.federalWithholding;
      } else if (a.type === T.Q_STATE) {
        coverageSummary.quarterly.state += a.stateWithholding;
      }
    });

    // 14. OC analysis
    const analysis = buildAnalysis(p, {
      totalTax, fedFrac, stFrac,
      iraWCap: totalIraDrawWithheld + convWithholdFed + convWithholdState,
      shortfall,
      hysaNet, breakeven, yeIraWins, strategy,
    }, stateInfo, effectiveWithholdMonth);

    // 15. Summary
    const summary = {
      strategy,
      strategyLabel:       strategyLabel(strategy),
      totalFedCovered:     verFed,
      totalStateCovered:   verState,
      totalCovered:        verFed + verState,
      totalTaxDue:         totalTax,
      balanced:            Math.abs((verFed + verState) - totalTax) < 2,
      iraWithholdingUsed:  totalIraDrawWithheld + convWithholdFed + convWithholdState,
      iraCoveragePct:      totalTax > 0 ? (totalIraDrawWithheld + convWithholdFed + convWithholdState) / totalTax : 0,
      shortfall,
      hysaNet, breakeven, yeIraWins,
      safeHarborFed:       shFed,
      safeHarborState:     shState,
      opportunityCost:     analysis.recommended.total,
      savingsVsWorst:      analysis.worst.total - analysis.recommended.total,
      stateIraExempt,
      stateHasIncomeTax:   stateInfo.hasIncomeTax,
      missedFedCount:      missedFed.length,
      missedStateCount:    missedState.length,
      effectiveWithholdMonth,
      ira1: { rmdMonth: ira1.origRmdMonth, planARmdMonth: ira1.planARmdMonth, convMonth: ira1.planAConvMonth, hasConflict: ira1.hasConflict, withheld: ira1Withheld, convPassed: ira1ConvPassed, passedOrigMonth: ira1.passedOrigMonth },
      ira2: { rmdMonth: ira2.origRmdMonth, planARmdMonth: ira2.planARmdMonth, convMonth: ira2.planAConvMonth, hasConflict: ira2.hasConflict, withheld: ira2Withheld, convPassed: ira2ConvPassed, passedOrigMonth: ira2.passedOrigMonth },
      todayDate: today,
      coverageSummary,
    };

    // 16. Plan B (December baseline) when any IRA has a Roth conversion
    const hasAnyConversion = p.ira1RothConversion > 0 || p.ira2RothConversion > 0;
    let planB = null;
    let convComparison = null;
    if (hasAnyConversion && !p._baseline) {
      planB = computePaymentPlan(Object.assign({}, p, {
        ira1RmdMonth: 12, ira1ConvMonth: 12,
        ira2RmdMonth: 12, ira2ConvMonth: 12,
        _baseline: true,
      }));
      convComparison = buildConvComparison(p, ira1, ira2, effectiveWithholdMonth, totalIraDrawWithheld);
    }

    return {
      params:   p,
      strategy,
      actions,
      analysis,
      summary,
      stateInfo,
      planB,
      convComparison,
      text: buildText(p, actions, summary, analysis, yr, stateInfo, planB, convComparison),
      html: buildHtml(p, actions, summary, analysis, yr, stateInfo, planB, convComparison),
    };
  }

  function strategyLabel(s) {
    return {
      ye_ira_full:    'Year-End IRA Withholding (full coverage)',
      ye_ira_partial: 'Year-End IRA Withholding + Quarterly Cash (shortfall)',
      all_quarterly:  'All Quarterly Estimated Payments (HYSA)',
    }[s] || s;
  }

  // ── OC Analysis ───────────────────────────────────────────────────────────
  function buildAnalysis(p, d, stateInfo, effectiveWithholdMonth) {
    const r   = p.portfolioRate;
    const h   = d.hysaNet;
    const ir  = d.iraWCap;
    const sf  = d.shortfall;
    const ff  = d.fedFrac;
    const cf  = d.stFrac;
    const stOcF = (stateInfo.ocWeightedMonths || 8.0) / 12;
    const iraF  = iraOcFactor(effectiveWithholdMonth);

    const ocIra   = amt => amt * r * iraF;
    const ocQcash = (f, s) => f * (r - h) * OC_FACTOR.Q_FED + s * (r - h) * stOcF;
    const ocQbrok = (f, s) => f * r * OC_FACTOR.Q_FED + s * r * stOcF;
    const extraCg = n => {
      if (n <= 0) return 0;
      const denom = 1 - p.appreciationPct * p.cgRateBlended;
      return denom <= 0 ? 0 : (n / denom) * p.appreciationPct * p.cgRateBlended;
    };

    const s1 = {
      id: 'ye_ira_partial', label: 'YE-IRA + Quarterly Cash (shortfall)',
      oc: ocIra(ir) + ocQcash(sf * ff, sf * cf), cg: 0,
    };
    s1.total = s1.oc + s1.cg;

    const s2 = {
      id: 'all_quarterly', label: 'All Quarterly Cash (HYSA)',
      oc: ocQcash(p.federalTax, p.stateTax), cg: 0,
    };
    s2.total = s2.oc + s2.cg;

    const totalTax = p.federalTax + p.stateTax;
    const s3 = {
      id: 'all_brokerage', label: 'All Quarterly Brokerage Sales',
      oc: ocQbrok(p.federalTax, p.stateTax),
      cg: extraCg(totalTax),
    };
    s3.total = s3.oc + s3.cg;

    const rec = d.strategy === 'all_quarterly' ? s2 : s1;
    const all = [s1, s2, s3].sort((a, b) => a.total - b.total);

    return {
      strategies: [s1, s2, s3],
      recommended: rec,
      best:        all[0],
      worst:       all[all.length - 1],
      savingsVsAllBrokerage: s3.total - rec.total,
      savingsVsAllCash:      s2.total - s1.total,
      iraCoverage:   d.iraWCap / Math.max(1, totalTax),
      hysaNet:       d.hysaNet,
      breakeven:     d.breakeven,
      yeIraWins:     d.yeIraWins,
      iraOcFactor:   iraF,
      stateOcFactor: stOcF,
    };
  }

  // ── Two-plan conversion comparison (aggregate across both IRAs) ───────────
  function buildConvComparison(p, ira1, ira2, effectiveWithholdMonth, totalIraWithheld) {
    const r = p.portfolioRate;

    // Roth growth gained = sum across IRAs of convAmount × r × monthsEarlier/12
    let rothGrowthGained = 0;
    if (p.ira1RothConversion > 0) rothGrowthGained += p.ira1RothConversion * r * (12 - ira1.planAConvMonth) / 12;
    if (p.ira2RothConversion > 0) rothGrowthGained += p.ira2RothConversion * r * (12 - ira2.planAConvMonth) / 12;

    // Extra withholding OC = money leaves IRA earlier due to earlier draw month
    const monthsRmdEarly  = 12 - effectiveWithholdMonth;
    const withholdOcExtra = totalIraWithheld * r * monthsRmdEarly / 12;

    // IRA deferral lost = RMD net earns taxably instead of tax-deferred for extra months
    const allDraws = (p.ira1Rmd + p.ira1Voluntary + p.ira2Rmd + p.ira2Voluntary);
    const approxWithholdPct = allDraws > 0 ? Math.min(1, totalIraWithheld / allDraws) : 0;
    let rmdDeferralLost = 0;
    if (p.ira1Rmd > 0) {
      const net = p.ira1Rmd * (1 - approxWithholdPct);
      rmdDeferralLost += net * r * p.marginalOrdRate * (12 - ira1.planARmdMonth) / 12;
    }
    if (p.ira2Rmd > 0) {
      const net = p.ira2Rmd * (1 - approxWithholdPct);
      rmdDeferralLost += net * r * p.marginalOrdRate * (12 - ira2.planARmdMonth) / 12;
    }

    const netBenefit = rothGrowthGained - withholdOcExtra - rmdDeferralLost;

    // Build label showing the earliest conversion month across IRAs
    const earliestConvMonth = Math.min(
      p.ira1RothConversion > 0 ? ira1.planAConvMonth : 12,
      p.ira2RothConversion > 0 ? ira2.planAConvMonth : 12,
    );

    return {
      planALabel: `Plan A — Early conversion(s) (earliest: ${MONTH_NAMES[earliestConvMonth-1]}; draw withholding: ${MONTH_NAMES[effectiveWithholdMonth-1]})`,
      planBLabel: `Plan B — December baseline (all RMDs and conversions in December)`,
      monthsRmdEarly,
      rothGrowthGained,
      withholdOcExtra,
      rmdDeferralLost,
      netBenefit,
      planAWins: netBenefit > 0,
    };
  }

  // ── Plain text output ─────────────────────────────────────────────────────
  function buildText(p, actions, summary, analysis, yr, stateInfo, planB, convComparison) {
    const lines = [];
    const hr = '─'.repeat(70);

    lines.push(`TAX PAYMENT PLAN — ${yr} Tax Year`);
    lines.push(hr);
    lines.push(`Strategy : ${summary.strategyLabel}`);
    lines.push(`State    : ${stateInfo.name}${summary.stateIraExempt ? ' [IRA-exempt — no state IRA withholding]' : ''}`);
    lines.push(`Total tax: ${fmt$(summary.totalTaxDue)}  (${fmt$(p.federalTax)} federal + ${fmt$(p.stateTax)} ${stateInfo.name})`);

    const ira1DrawTotal = p.ira1Rmd + p.ira1Voluntary;
    const ira2DrawTotal = p.ira2Rmd + p.ira2Voluntary;
    if (ira1DrawTotal > 0) lines.push(`IRA 1    : draw ${MONTH_NAMES[summary.ira1.planARmdMonth-1]}` + (p.ira1RothConversion > 0 ? `  | conversion ${MONTH_NAMES[summary.ira1.convMonth-1]}` : ''));
    if (ira2DrawTotal > 0) lines.push(`IRA 2    : draw ${MONTH_NAMES[summary.ira2.planARmdMonth-1]}` + (p.ira2RothConversion > 0 ? `  | conversion ${MONTH_NAMES[summary.ira2.convMonth-1]}` : ''));
    lines.push(`Effective withhold month: ${MONTH_NAMES[summary.effectiveWithholdMonth-1]}  |  Opportunity Cost factor: ${fmtPct(analysis.iraOcFactor, 1)} yrs`);
    lines.push(`OC savings vs. all-brokerage: ${fmt$(summary.savingsVsWorst)}`);

    if (summary.missedFedCount > 0 || summary.missedStateCount > 0) {
      lines.push('');
      lines.push(`*** ${summary.missedFedCount + summary.missedStateCount} QUARTERLY INSTALLMENT(S) PAST DUE ***`);
      if (summary.strategy !== 'all_quarterly') lines.push('    YE-IRA withholding is retroactive — NO penalty applies.');
    }

    if (convComparison) {
      lines.push('');
      lines.push('ROTH CONVERSION — TWO-PLAN COMPARISON');
      lines.push(hr);
      const cc = convComparison;
      lines.push(`  ${cc.planALabel}`);
      lines.push(`  ${cc.planBLabel}`);
      lines.push('');
      lines.push(`  Roth tax-free growth gained (Plan A benefit):   +${fmt$(cc.rothGrowthGained)}`);
      lines.push(`  Extra withholding OC, ${cc.monthsRmdEarly} months earlier:   -${fmt$(cc.withholdOcExtra)}`);
      lines.push(`  IRA tax-deferral lost on RMD net:               -${fmt$(cc.rmdDeferralLost)}`);
      lines.push(`  ` + '─'.repeat(50));
      lines.push(`  Net first-year advantage of Plan A:          ${cc.planAWins ? '+' : '-'}${fmt$(Math.abs(cc.netBenefit))}  (${cc.planAWins ? 'PLAN A WINS' : 'PLAN B WINS'})`);
      lines.push('');
      lines.push('  NOTE: First-year only. Early conversion provides compounding Roth');
      lines.push('  growth for every subsequent year — long-term benefit grows beyond what is shown.');
    }

    lines.push('');
    lines.push(planB ? 'PLAN A — EARLY CONVERSIONS' : 'ACTION PLAN');
    lines.push(hr);

    const renderActions = acts => acts.forEach(a => {
      if (a.type === T.ALERT) {
        lines.push(`  !!! ${a.description}`);
        a.notes.forEach(n => lines.push(`      • ${n}`));
      } else if (a.type === T.NOTE) {
        lines.push(`   -- ${a.description}`);
      } else {
        lines.push(`${String(a.seq).padStart(2)} . ${a.description}`);
        a.notes.forEach(n => lines.push(`       • ${n}`));
      }
      lines.push('');
    });

    renderActions(actions);

    if (planB) {
      lines.push('PLAN B — DECEMBER BASELINE');
      lines.push(hr);
      renderActions(planB.actions);
    }

    lines.push('COST ANALYSIS');
    lines.push(hr);
    analysis.strategies.forEach(s => {
      const isRec = s.id === summary.strategy ||
                    (summary.strategy === 'ye_ira_full' && s.id === 'ye_ira_partial');
      lines.push(`${isRec ? '>>> ' : '    '}${s.label.padEnd(42)} ` +
                 `OC=${fmt$(s.oc)}  CG=${fmt$(s.cg)}  Total=${fmt$(s.total)}`);
    });
    lines.push('');
    lines.push('SAFE HARBOR (minimum to avoid underpayment penalty)');
    lines.push(`  Federal: ${fmt$(summary.safeHarborFed)}`);
    lines.push(`  ${stateInfo.name}: ${fmt$(summary.safeHarborState)}` +
               (stateInfo.safeHarborAlways110 ? ' (always 110% — MD rule)' : ''));

    return lines.join('\n');
  }

  // ── HTML output ───────────────────────────────────────────────────────────
  function buildHtml(p, actions, summary, analysis, yr, stateInfo, planB, convComparison) {
    const typeIcon = {
      [T.ROTH_CONV]: '🔄', [T.RMD]: '🏦', [T.IRA_VOL]: '🏦',
      [T.SUPPL_IRA]: '🏦', [T.Q_FED]: '🇺🇸', [T.Q_STATE]: '📋',
      [T.SS_WHOLD]:  '📌', [T.NOTE]: 'ℹ️', [T.ALERT]: '⚠️',
    };
    const typeColor = {
      [T.ROTH_CONV]: '#4A90D9', [T.RMD]: '#2E75B6', [T.IRA_VOL]: '#2E75B6',
      [T.SUPPL_IRA]: '#2E75B6', [T.Q_FED]: '#C9360C', [T.Q_STATE]: '#9C4A00',
      [T.SS_WHOLD]:  '#596A2F', [T.NOTE]: '#555555', [T.ALERT]: '#8B0000',
    };

    const badge = (label, value, color = '#2E75B6') =>
      `<span style="display:inline-block;background:${color};color:#fff;` +
      `border-radius:4px;padding:2px 8px;font-size:0.78em;margin-right:4px;margin-bottom:4px;font-weight:600;">` +
      `${label}: ${value}</span>`;

    const warn  = txt => `<div style="background:#FFF3CD;border-left:4px solid #FFC107;padding:8px 12px;margin:6px 0;font-size:0.88em;color:#6B4A00;">${txt}</div>`;
    const info  = txt => `<div style="background:#E8F4F8;border-left:4px solid #2E75B6;padding:8px 12px;margin:6px 0;font-size:0.88em;color:#1F4E79;">${txt}</div>`;
    const alert = txt => `<div style="background:#FFECEC;border-left:4px solid #CC0000;padding:10px 14px;margin:8px 0;font-size:0.9em;color:#8B0000;font-weight:500;">${txt}</div>`;
    const good  = txt => `<div style="background:#E8F5E9;border-left:4px solid #2E7D32;padding:8px 12px;margin:6px 0;font-size:0.88em;color:#1B5E20;">${txt}</div>`;

    let h = '';
    h += `<div style="font-family:Arial,sans-serif;max-width:860px;margin:0 auto;color:#222;">`;

    h += `<h2 style="background:#1F4E79;color:#fff;padding:14px 18px;margin:0;font-size:1.15em;border-radius:4px 4px 0 0;">Tax Payment Plan — ${yr} Tax Year</h2>`;

    h += `<div style="background:#EBF3FB;padding:12px 18px;border:1px solid #BDD7EE;border-top:none;">`;
    h += `<div style="margin-bottom:6px;">`;
    h += badge('Strategy', summary.strategyLabel, '#1F4E79');
    h += `</div><div>`;
    h += badge('Federal', fmt$(p.federalTax), '#C9360C');
    h += badge(stateInfo.name, fmt$(p.stateTax), '#9C4A00');
    h += badge('Total Tax', fmt$(summary.totalTaxDue), '#222');
    h += badge('IRA Coverage', fmtPct(summary.iraCoveragePct), '#2E75B6');
    h += badge('Opportunity Cost', fmt$(summary.opportunityCost), '#596A2F');
    h += badge('Saves vs Brokerage', fmt$(summary.savingsVsWorst), '#375623');
    h += `</div>`;

    // IRA timing metadata
    h += `<div style="margin-top:8px;font-size:0.82em;color:#555;">`;
    const ira1DrawTotal = p.ira1Rmd + p.ira1Voluntary;
    const ira2DrawTotal = p.ira2Rmd + p.ira2Voluntary;
    if (ira1DrawTotal > 0) h += `IRA 1 draw: <strong>${MONTH_NAMES[summary.ira1.planARmdMonth-1]}</strong>` +
      (p.ira1RothConversion > 0 ? ` / conv: <strong>${MONTH_NAMES[summary.ira1.convMonth-1]}</strong>` : '') + ` &nbsp;|&nbsp; `;
    if (ira2DrawTotal > 0) h += `IRA 2 draw: <strong>${MONTH_NAMES[summary.ira2.planARmdMonth-1]}</strong>` +
      (p.ira2RothConversion > 0 ? ` / conv: <strong>${MONTH_NAMES[summary.ira2.convMonth-1]}</strong>` : '') + ` &nbsp;|&nbsp; `;
    h += `Effective withhold: <strong>${MONTH_NAMES[summary.effectiveWithholdMonth-1]}</strong> &nbsp;|&nbsp; `;
    h += `Opp. Cost factor: <strong>${fmtPct(analysis.iraOcFactor, 1)}</strong>`;
    if (summary.stateIraExempt) h += ` &nbsp;|&nbsp; <span style="color:#2E7D32;font-weight:600;">${stateInfo.name}: IRA-exempt ✓</span>`;
    else if (!summary.stateHasIncomeTax) h += ` &nbsp;|&nbsp; <span style="color:#2E7D32;font-weight:600;">${stateInfo.name}: no income tax ✓</span>`;
    h += `</div>`;

    if (!summary.yeIraWins) {
      h += warn(`<strong>Note:</strong> At current HYSA net rate ${fmtPct(summary.hysaNet, 2)}, quarterly cash and year-end IRA are nearly equivalent. Break-even = r/2 = ${fmtPct(summary.breakeven, 2)}. Plan uses year-end IRA for simplicity.`);
    }
    h += `</div>`;

    // ── Two-plan comparison ────────────────────────────────────────────────
    if (convComparison) {
      const cc = convComparison;
      const winColor  = cc.planAWins ? '#1B5E20' : '#7B1FA2';
      const netSign   = cc.planAWins ? '+' : '−';
      h += `<div style="margin:12px 0;border:2px solid #1F4E79;border-radius:6px;overflow:hidden;">`;
      h += `<div style="background:#1F4E79;color:#fff;padding:10px 16px;font-weight:700;font-size:0.95em;">⚖️ Roth Conversion Timing — Two-Plan Comparison</div>`;
      h += `<div style="padding:12px 16px;background:#F8FAFF;">`;

      h += `<div style="display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap;">`;
      h += `<div style="flex:1;min-width:220px;background:#E8F5E9;border:1px solid #A5D6A7;border-radius:5px;padding:10px 14px;">`;
      h += `<div style="font-weight:700;color:#1B5E20;font-size:0.88em;margin-bottom:4px;">📅 ${cc.planALabel}</div>`;
      h += `<div style="font-size:0.82em;color:#444;">Roth(s) grow tax-free for extra months. Withholding from ${MONTH_NAMES[summary.effectiveWithholdMonth-1]} draw.</div>`;
      h += `</div>`;
      h += `<div style="flex:1;min-width:220px;background:#F3E5F5;border:1px solid #CE93D8;border-radius:5px;padding:10px 14px;">`;
      h += `<div style="font-weight:700;color:#6A1B9A;font-size:0.88em;margin-bottom:4px;">📅 ${cc.planBLabel}</div>`;
      h += `<div style="font-size:0.82em;color:#444;">All draws in December — minimal Roth growth, maximum IRA deferral.</div>`;
      h += `</div></div>`;

      h += `<table style="width:100%;border-collapse:collapse;font-size:0.87em;margin-bottom:10px;">`;
      h += `<thead><tr style="background:#E3F2FD;"><th style="padding:6px 10px;text-align:left;font-weight:600;color:#1F4E79;">Component</th>`;
      h += `<th style="padding:6px 10px;text-align:right;font-weight:600;color:#1F4E79;">First-Year $</th>`;
      h += `<th style="padding:6px 10px;text-align:left;font-weight:600;color:#1F4E79;">Notes</th></tr></thead><tbody>`;

      const row = (label, amt, note, isPos) => {
        const sign = isPos ? '+' : '−';
        const col  = isPos ? '#1B5E20' : '#C62828';
        h += `<tr style="border-bottom:1px solid #eee;"><td style="padding:6px 10px;">${label}</td>`;
        h += `<td style="padding:6px 10px;text-align:right;font-weight:600;color:${col};">${sign}${fmt$(Math.abs(amt))}</td>`;
        h += `<td style="padding:6px 10px;color:#555;font-size:0.92em;">${note}</td></tr>`;
      };

      row('Roth tax-free growth gained',   cc.rothGrowthGained, 'Early conversion(s) grow tax-free for extra months', true);
      row('Extra withholding OC',          cc.withholdOcExtra,  `${cc.monthsRmdEarly} months earlier draw for withholding`, false);
      row('IRA tax-deferral lost on RMDs', cc.rmdDeferralLost,  'RMD net earns taxably vs. tax-deferred', false);

      h += `<tr style="background:#FFFDE7;font-weight:700;border-top:2px solid #1F4E79;">`;
      h += `<td style="padding:8px 10px;">Net first-year advantage of Plan A</td>`;
      h += `<td style="padding:8px 10px;text-align:right;color:${cc.planAWins ? '#1B5E20' : '#C62828'};font-size:1.05em;">${netSign}${fmt$(Math.abs(cc.netBenefit))}</td>`;
      h += `<td style="padding:8px 10px;color:${cc.planAWins ? '#1B5E20' : '#C62828'};">${cc.planAWins ? '✓ Early plan wins — proceed with Plan A' : 'December plan wins on first-year cost alone'}</td></tr>`;
      h += `</tbody></table>`;

      h += `<div style="font-size:0.81em;color:#555;border-top:1px solid #ddd;padding-top:8px;">`;
      h += `⚠️ <strong>First-year only.</strong> Early conversion provides compounding Roth growth for every subsequent year. Even when Plan B wins on the first-year number, Plan A often wins on a 5–10 year horizon.`;
      h += `</div></div></div>`;
    }

    // ── Coverage summary table ─────────────────────────────────────────────
    {
      const cs = summary.coverageSummary;
      const rows = [
        { label: 'IRA 1 withholding',         fed: cs.ira1Draw.fed,   state: cs.ira1Draw.state,   show: cs.ira1Draw.fed + cs.ira1Draw.state > 0 },
        { label: 'IRA 2 withholding',         fed: cs.ira2Draw.fed,   state: cs.ira2Draw.state,   show: cs.ira2Draw.fed + cs.ira2Draw.state > 0 },
        { label: 'Conversion withholding',    fed: cs.conversion.fed, state: cs.conversion.state, show: cs.conversion.fed + cs.conversion.state > 0 },
        { label: 'Quarterly estimated taxes', fed: cs.quarterly.fed,  state: cs.quarterly.state,  show: cs.quarterly.fed + cs.quarterly.state > 0 },
      ].filter(r => r.show);

      const totalFed   = rows.reduce((s, r) => s + r.fed,   0);
      const totalState = rows.reduce((s, r) => s + r.state, 0);
      const totalAll   = totalFed + totalState;
      const taxDue     = summary.totalTaxDue;
      const balanced   = Math.abs(totalAll - taxDue) < 2;

      h += `<div style="margin:12px 0;border:1px solid #BDD7EE;border-radius:6px;overflow:hidden;">`;
      h += `<div style="background:#2E75B6;color:#fff;padding:8px 16px;font-weight:700;font-size:0.92em;">📊 Tax Coverage Summary</div>`;
      h += `<table style="width:100%;border-collapse:collapse;font-size:0.88em;">`;
      h += `<thead><tr style="background:#EBF3FB;">`;
      h += `<th style="padding:6px 12px;text-align:left;color:#1F4E79;">Payment Source</th>`;
      h += `<th style="padding:6px 12px;text-align:right;color:#1F4E79;">Federal</th>`;
      h += `<th style="padding:6px 12px;text-align:right;color:#1F4E79;">State</th>`;
      h += `<th style="padding:6px 12px;text-align:right;color:#1F4E79;">Total</th>`;
      h += `</tr></thead><tbody>`;
      rows.forEach((r, i) => {
        const bg = i % 2 === 0 ? '#fff' : '#F9F9F9';
        h += `<tr style="background:${bg};border-bottom:1px solid #eee;">`;
        h += `<td style="padding:6px 12px;">${r.label}</td>`;
        h += `<td style="padding:6px 12px;text-align:right;">${r.fed > 0 ? fmt$(r.fed) : '—'}</td>`;
        h += `<td style="padding:6px 12px;text-align:right;">${r.state > 0 ? fmt$(r.state) : '—'}</td>`;
        h += `<td style="padding:6px 12px;text-align:right;font-weight:600;">${fmt$(r.fed + r.state)}</td>`;
        h += `</tr>`;
      });
      h += `<tr style="background:#E2EFDA;font-weight:700;border-top:2px solid #2E75B6;">`;
      h += `<td style="padding:7px 12px;">Total covered</td>`;
      h += `<td style="padding:7px 12px;text-align:right;">${fmt$(totalFed)}</td>`;
      h += `<td style="padding:7px 12px;text-align:right;">${fmt$(totalState)}</td>`;
      h += `<td style="padding:7px 12px;text-align:right;">${fmt$(totalAll)}</td>`;
      h += `</tr>`;
      h += `<tr style="background:#F5F5F5;border-top:1px solid #ccc;">`;
      h += `<td style="padding:6px 12px;color:#555;">Tax due</td>`;
      h += `<td style="padding:6px 12px;text-align:right;color:#555;">${fmt$(p.federalTax)}</td>`;
      h += `<td style="padding:6px 12px;text-align:right;color:#555;">${fmt$(p.stateTax)}</td>`;
      h += `<td style="padding:6px 12px;text-align:right;color:#555;">${fmt$(taxDue)}</td>`;
      h += `</tr>`;
      const balColor = balanced ? '#1B5E20' : '#8B0000';
      const balText  = balanced
        ? `✓ Fully covered`
        : `${fmt$(Math.abs(taxDue - totalAll))} ${totalAll < taxDue ? 'uncovered — check inputs' : 'over-withheld (refund expected)'}`;
      h += `<tr style="background:${balanced ? '#E8F5E9' : '#FFECEC'};">`;
      h += `<td colspan="3" style="padding:6px 12px;font-weight:700;color:${balColor};">${balText}</td>`;
      h += `<td style="padding:6px 12px;text-align:right;font-weight:700;color:${balColor};">${balanced ? '' : fmt$(Math.abs(taxDue - totalAll))}</td>`;
      h += `</tr>`;
      h += `</tbody></table></div>`;
    }

    // ── Render one action list ─────────────────────────────────────────────
    const renderActionList = (acts, planSummary) => {
      let stepNum = 0;
      acts.forEach(a => {
        const isNote  = a.type === T.NOTE;
        const isAlert = a.type === T.ALERT;
        const color   = typeColor[a.type] || '#555';
        const icon    = typeIcon[a.type]  || '•';
        const isPast  = a.date && new Date(a.date.year, a.date.month - 1, a.date.day) < summary.todayDate;

        if (isAlert) {
          const usesIra = planSummary.strategy === 'ye_ira_full' || planSummary.strategy === 'ye_ira_partial';
          const html = `${icon} <strong>${usesIra ? 'Calendar Notice' : 'MISSED PAYMENT WARNING'}:</strong> ${a.description}`;
          h += usesIra ? good(html) : alert(html);
          if (a.notes.length > 0) {
            h += `<ul style="margin:0 0 8px 28px;padding:0;font-size:0.86em;color:#555;">`;
            a.notes.forEach(n => { h += `<li style="margin-bottom:3px;">${n}</li>`; });
            h += `</ul>`;
          }
          return;
        }
        if (isNote) { h += info(`<strong>Note:</strong> ${a.description}`); return; }

        stepNum++;
        const pastBadge = isPast
          ? `<span style="background:#CC0000;color:#fff;font-size:0.72em;padding:1px 6px;border-radius:3px;margin-left:8px;vertical-align:middle;">PAST DUE</span>`
          : '';

        h += `<div style="border:1px solid #ddd;border-left:4px solid ${color};border-radius:0 4px 4px 0;margin:0 0 8px 0;padding:10px 14px;background:#fff;${isPast ? 'border-color:#CC0000;' : ''}">`;
        h += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">`;
        h += `<span style="font-weight:700;color:${color};font-size:0.95em;">${icon} Step ${stepNum} — ${a.dateLabel || 'As needed'}${pastBadge}</span>`;
        if (a.federalWithholding > 0 || a.stateWithholding > 0) {
          h += `<span style="font-size:0.82em;color:#555;">`;
          if (a.federalWithholding > 0) h += `&nbsp;Fed: <strong>${fmt$(a.federalWithholding)}</strong>`;
          if (a.stateWithholding   > 0) h += `&nbsp;${stateInfo.name}: <strong>${fmt$(a.stateWithholding)}</strong>`;
          h += `</span>`;
        }
        h += `</div>`;
        h += `<p style="margin:4px 0 6px;line-height:1.5;">${a.description}</p>`;
        if (a.notes.length > 0) {
          h += `<ul style="margin:2px 0 0 18px;padding:0;color:#555;font-size:0.87em;">`;
          a.notes.forEach(n => {
            const isWarn = /caution|warning|past due|missed/i.test(n);
            h += `<li style="margin-bottom:3px;${isWarn ? 'color:#8B0000;font-weight:600;' : ''}">${n}</li>`;
          });
          h += `</ul>`;
        }
        h += `</div>`;
      });
    };

    // Plan A
    if (planB) {
      const cc = convComparison;
      const planAColor = cc && cc.planAWins ? '#1B5E20' : '#7B1FA2';
      h += `<div style="border:2px solid ${planAColor};border-radius:6px;margin-bottom:16px;overflow:hidden;">`;
      h += `<div style="background:${planAColor};color:#fff;padding:8px 16px;font-weight:700;">📅 Plan A — Early Conversion(s)`;
      if (cc) h += ` &nbsp;<span style="font-weight:400;font-size:0.88em;">(${cc.planAWins ? '✓ lower first-year cost' : 'higher first-year cost — stronger long-term'})</span>`;
      h += `</div><div style="padding:8px;">`;
      renderActionList(actions, summary);
      h += `</div></div>`;
    } else {
      h += `<h3 style="margin:16px 18px 8px;color:#1F4E79;font-size:1em;">Action Plan</h3>`;
      h += `<div style="padding:0 4px;">`;
      renderActionList(actions, summary);
      h += `</div>`;
    }

    // Plan B
    if (planB) {
      const cc = convComparison;
      const planBColor = cc && !cc.planAWins ? '#1B5E20' : '#7B1FA2';
      h += `<div style="border:2px solid ${planBColor};border-radius:6px;margin-bottom:16px;overflow:hidden;">`;
      h += `<div style="background:${planBColor};color:#fff;padding:8px 16px;font-weight:700;">📅 Plan B — December Baseline (all RMDs and conversions in December)`;
      if (cc) h += ` &nbsp;<span style="font-weight:400;font-size:0.88em;">(${!cc.planAWins ? '✓ lower first-year cost' : 'higher first-year cost'})</span>`;
      h += `</div><div style="padding:8px;">`;
      renderActionList(planB.actions, planB.summary);
      h += `</div></div>`;
    }

    // Cost analysis table
    h += `<h3 style="margin:16px 18px 8px;color:#1F4E79;font-size:1em;">Cost Analysis — Opportunity Cost Comparison</h3>`;
    h += `<div style="font-size:0.84em;color:#555;padding:0 4px 6px;">Reference date: April 15 filing deadline. `;
    h += `HYSA net: ${fmtPct(summary.hysaNet, 2)} (${fmtPct(p.hysaGross)} × (1−${fmtPct(p.marginalOrdRate)})). `;
    h += `Break-even: r/2 = ${fmtPct(summary.breakeven, 2)}. `;
    h += `Effective withhold month: ${MONTH_NAMES[summary.effectiveWithholdMonth-1]} → Opportunity Cost factor: ${fmtPct(analysis.iraOcFactor, 1)}.`;
    h += `</div>`;

    h += `<table style="width:100%;border-collapse:collapse;font-size:0.88em;margin-bottom:16px;">`;
    h += `<thead><tr style="background:#2E75B6;color:#fff;">`;
    [
      { label: 'Strategy',          title: '',                                                                   left: true },
      { label: 'Opportunity Cost',  title: 'Foregone portfolio growth while tax money sits outside the IRA',     left: false },
      { label: 'Extra CG Tax',      title: 'Capital Gains tax triggered by selling appreciated brokerage shares', left: false },
      { label: 'Total Extra Cost',  title: 'Opportunity Cost + Capital Gains tax vs. this plan',                 left: false },
      { label: 'vs. This Plan',     title: 'Additional cost compared to the recommended strategy',               left: false },
    ].forEach(col => {
      const titleAttr = col.title ? ` title="${col.title}"` : '';
      h += `<th style="padding:7px 10px;text-align:${col.left ? 'left' : 'right'};cursor:${col.title ? 'help' : 'default'};"${titleAttr}>${col.label}${col.title ? ' ℹ️' : ''}</th>`;
    });
    h += `</tr></thead><tbody>`;

    const recTotal = summary.opportunityCost;
    analysis.strategies.forEach((s, i) => {
      const isRec = s.id === summary.strategy || (summary.strategy === 'ye_ira_full' && s.id === 'ye_ira_partial');
      const bg    = isRec ? '#E2EFDA' : (i % 2 === 0 ? '#F9F9F9' : '#fff');
      const diff  = s.total - recTotal;
      const diffStr = diff < 1 ? '—' : `+${fmt$(diff)} more`;
      h += `<tr style="background:${bg};">`;
      h += `<td style="padding:7px 10px;font-weight:${isRec ? '700' : '400'};">${isRec ? '✓ ' : ''}${s.label}</td>`;
      h += `<td style="padding:7px 10px;text-align:right;">${fmt$(s.oc)}</td>`;
      h += `<td style="padding:7px 10px;text-align:right;">${fmt$(s.cg)}</td>`;
      h += `<td style="padding:7px 10px;text-align:right;font-weight:${isRec ? '700' : '400'};">${fmt$(s.total)}</td>`;
      h += `<td style="padding:7px 10px;text-align:right;color:${diff > 0 ? '#C00000' : '#375623'};">${diffStr}</td>`;
      h += `</tr>`;
    });
    h += `</tbody></table>`;

    // Safe harbor
    const shFedNote = p.highIncomeFiler ? '110% of prior-year (high-income filer)' : '100% of prior-year or 90% current';
    const shStNote  = stateInfo.safeHarborAlways110 ? '110% of prior-year (MD rule — always)' : shFedNote;
    h += info(
      `<strong>Safe Harbor (minimum to avoid underpayment penalty):</strong><br>` +
      `Federal: ${fmt$(summary.safeHarborFed)} (${shFedNote})` +
      (p.priorYearFedTax ? ` — based on prior-year tax ${fmt$(p.priorYearFedTax)}` : ' — estimated at 90% of current year; update with actual prior-year amount') + `.<br>` +
      `${stateInfo.name}: ${fmt$(summary.safeHarborState)} (${shStNote})` +
      (p.priorYearStateTax ? ` — based on prior-year tax ${fmt$(p.priorYearStateTax)}` : '') +
      (stateInfo.safeHarborHighIncomeThreshold
        ? `<br><em>Note: ${stateInfo.name} high-income threshold for 110% safe harbor: $${(stateInfo.safeHarborHighIncomeThreshold/1000).toFixed(0)}K AGI.</em>`
        : '') + '.'
    );

    if (stateInfo.paymentNote) {
      h += info(`<strong>${stateInfo.name} payment info:</strong> ${stateInfo.paymentNote}` +
                (stateInfo.paymentUrl ? ` <a href="${stateInfo.paymentUrl}" target="_blank">${stateInfo.paymentUrl}</a>` : ''));
    }

    h += `<div style="font-size:0.81em;color:#888;padding:8px 0 4px;border-top:1px solid #eee;margin-top:6px;">`;
    h += `<strong>Note on income variation:</strong> Holding cash in a HYSA to pay quarterly estimates `;
    h += `reduces your average cash balance, slightly lowering interest income relative to the planned amount. `;
    h += `Selling brokerage shares eliminates future dividends on those shares. These are typically small second-order effects.`;
    h += `</div>`;

    h += `</div>`;
    return h;
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    computePaymentPlan,
    ACTION_TYPES: T,
    OC_FACTOR,
    STATE_DB,
    getStateInfo,
    iraOcFactor,
  };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaxPaymentPlanner;
}
