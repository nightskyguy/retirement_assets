/**
 * taxPaymentPlanner.js — v5
 * =========================
 * Retirement Tax Payment Strategy Planner — Dual-IRA Edition
 *
 * Enhancements over v4:
 *   • Business-day arithmetic. Every date the planner prints is one you have to act on,
 *     and nothing used to check that you could. A future tax year forces nextMonth to
 *     January, and the same-month RMD/conversion split was day 1 / day 8, so tax year
 *     2028 scheduled the draw on January 1 (a federal holiday AND a Saturday). January
 *     now starts on the first Monday after New Year's Day; every other target is day 15
 *     nudged forward. The restore date is nudged too.
 *     Models weekends plus New Year's Day and Christmas Day only — see OBSERVED_HOLIDAYS.
 *   • IRC 7503 applied to federal and state estimated-tax due dates, for both the printed
 *     deadline and the past-due check, so an installment is no longer flagged late while
 *     the real deadline is still ahead.
 *
 * Enhancements over v3:
 *   • Rule correction: the 60-day cash replacement after a Roth conversion is a
 *     traditional-to-Roth CONVERSION rollover, which the IRS excludes from the
 *     one-rollover-per-12-months limit of IRC 408(d)(3)(B). v3 wrongly warned that
 *     it was limited to once per rolling 12 months. It is repeatable per conversion.
 *   • December conversion withholding is no longer skipped outright. It now fires
 *     when the shortfall would breach safe harbor, because withholding is deemed
 *     paid ratably across all four due dates under IRC 6654(g)(1).
 *   • Restore-cash deadline follows the real 60-day window and may cross year end.
 *   • RULE_CITES — sources rendered in both the HTML and plain-text output.
 *   • _sixtyDayAnalysis replaced by _replacementAnalysis (summary key sixtyDay →
 *     replacement). The old version weighted the Roth side by the rest of the year and
 *     the cash side by 60 days, which overstated the gain by 20-50% and went negative in
 *     December. It is one differential over one period:
 *         gain = withheld × (portfolioRate − hysaNet) × yearsFromRestoreToYearEnd
 *     Growth now accrues from the restore date, not the conversion date.
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
 *   ira1RmdTaken         {Boolean}  true if RMD already taken this year (dates action in prev month)
 *   ira1VolTaken         {Boolean}  true if voluntary withdrawal already taken (requires RMD taken or no RMD)
 *   ira1RothConversion   {Number}   IRA 1 Roth conversion amount (gross)
 *   ira1ConvDone         {Boolean}  true if conversion already completed (requires RMD taken or no RMD)
 *   ira1RothWithhold     {Boolean|null}  override 60-day replace decision; null=auto-compute
 *
 *   IRA 2 (second IRA account)
 *   ira2Rmd              {Number}   IRA 2 RMD amount
 *   ira2Voluntary        {Number}   IRA 2 voluntary withdrawal
 *   ira2RmdTaken         {Boolean}  true if IRA 2 RMD already taken this year
 *   ira2VolTaken         {Boolean}  true if IRA 2 voluntary withdrawal already taken
 *   ira2RothConversion   {Number}   IRA 2 Roth conversion amount (gross)
 *   ira2ConvDone         {Boolean}  true if conversion already completed
 *   ira2RothWithhold     {Boolean|null}  override 60-day replace decision; null=auto-compute
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
 *   cgRateBlended        {Number}   blended LTCG rate, fed + state (default 0.20)
 *   brokerageValue       {Number}   brokerage market value, dollars (optional)
 *   brokerageBasis       {Number}   brokerage cost basis, dollars (optional)
 *   appreciationPct      {Number}   brokerage unrealized gain FRACTION, not a growth rate
 *                                   (default 0.40). Derived from brokerageValue/brokerageBasis
 *                                   when both are supplied; see the note at the derivation.
 *   forceStrategy        {String}   'ye_ira' | 'quarterly' | null (auto)
 *   todayDate            {Date}     for missed-payment detection (default new Date())
 */

'use strict';

const TaxPaymentPlanner = (() => {

  // ── Action type constants ──────────────────────────────────────────────────
  const T = {
    ROTH_CONV:    'roth_conversion',
    RMD:          'rmd_withdrawal',
    IRA_VOL:      'ira_voluntary',
    SUPPL_IRA:    'supplemental_ira',
    CASH_RESTORE: 'cash_restore',
    Q_FED:        'quarterly_estimate_fed',
    Q_STATE:      'quarterly_estimate_state',
    SS_WHOLD:     'ss_withholding_election',
    ALERT:        'alert',
    NOTE:         'advisory_note',
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

  // ── Replacing the withheld amount after a Roth conversion ──────────────────
  // 60 days is the statutory rollover window. 45 is the date we actually recommend,
  // leaving a buffer for transfer processing. These are a DEADLINE, not a holding
  // period: once the cash is replaced it stays in the Roth, so nothing about the
  // economics of the maneuver lasts 60 days.
  //
  // Declared up here, ahead of RULE_CITES and CONCEPT_NOTES, because those arrays quote the
  // numbers rather than hardcoding them and are evaluated at module init.
  const ROLLOVER_DEADLINE_DAYS = 60;
  const RESTORE_TARGET_DAYS    = 45;

  // Gap between an RMD and a same-month Roth conversion. The RMD must be distributed
  // before the conversion; this leaves room for it to settle first.
  const ORDERING_BUFFER_DAYS = 7;

  // Earliest practical replacement: the next business day after the conversion. Used only
  // to price what acting sooner than the 45-day target is worth, not to schedule anything.
  const RESTORE_EARLIEST_DAYS = 1;

  // ── Authorities behind the rules this planner applies ──────────────────────
  // `tag` is the short marker used inline in action notes; the footer carries the URL.
  //
  // `long` is prose that used to be repeated inline in every affected action. Each block
  // appeared once per IRA per plan, and there are three plans, so the same paragraph rendered
  // three or six times: measured on a dual-IRA dual-conversion scenario, 13.2k of 20.7k total
  // note characters were duplicate boilerplate. The prose lives here once now and the action
  // carries a pointer built by seeAlso(). Anything scenario-specific — dollars, dates, the
  // capped-withholding explanation — deliberately stays inline, because it is not boilerplate.
  const RULE_CITES = [
    {
      tag:   'IRS Rollovers',
      label: '60-day rollover deadline, and using other funds to replace the amount withheld',
      cite:  'IRS, Rollovers of retirement plan and IRA distributions',
      url:   'https://www.irs.gov/retirement-plans/plan-participant-employee/rollovers-of-retirement-plan-and-ira-distributions',
      note:  'Lists the transactions excluded from the one-rollover-per-year limit. Rollovers from traditional IRAs to Roth IRAs (conversions) are on that list.',
      long:  'Replacing the withheld amount from cash completes a traditional-to-Roth conversion rollover, which the IRS excludes from the one-rollover-per-12-months limit. There is no cap on how many times per year you can do it, and it does not consume your one regular IRA-to-IRA rollover. Source the cash from any personal account — checking, HYSA, or brokerage — and transfer it directly into the Roth.',
    },
    {
      tag:   'IRS Ann. 2014-32',
      label: 'Roth conversions are outside the one-rollover-per-year limit',
      cite:  'IRS IR-2014-107 / Announcement 2014-32',
      url:   'https://www.irs.gov/uac/newsroom/irs-clarifies-application-of-one-per-year-limit-on-ira-rollovers-allows-owners-of-multiple-iras-a-fresh-start-in-2015',
      note:  'Roth conversions are not subject to the one-per-year limit and are disregarded in applying the limit to other rollovers.',
      long:  'Because conversions are excluded from the one-rollover-per-12-months limit, withhold-and-replace is repeatable: you can do it on every conversion you make, in the same year, in both IRAs. It also does not use up your one regular IRA-to-IRA rollover, because conversions are disregarded when that limit is applied to other rollovers.',
    },
    {
      tag:   'IRC 6654(g)',
      label: 'Withholding is credited as if paid in equal parts on every due date',
      cite:  '26 U.S.C. 6654(g)(1)',
      url:   'https://www.law.cornell.edu/uscode/text/26/6654',
      note:  'This is why year-end withholding cures an earlier-quarter underpayment while a Q4 estimated payment does not.',
      long:  'Withholding from an IRA distribution is deemed paid pro-rata on each quarterly due date, whatever date it actually happened on. So even a December draw satisfies the whole year of quarterly installments retroactively. An estimated payment gets no such treatment: it is credited when you actually pay it, which is why a January 15 estimate cannot repair a Q1 shortfall.',
    },
    {
      tag:   'IRC 408(d)(3)',
      label: 'The 60-day deadline itself, the one-rollover-per-12-months limit, and the waiver',
      cite:  '26 U.S.C. 408(d)(3)(A), (B) and (I)',
      url:   'https://www.law.cornell.edu/uscode/text/26/408',
      note:  '(A) requires the money be paid in "not later than the 60th day after the day on which he receives the payment or distribution". (B) is the one-per-12-months limit, which applies to IRA-to-IRA rollovers only, not conversions. (I) lets the Secretary waive the 60 days "where the failure to waive such requirement would be against equity or good conscience".',
      long:  'The exclusion covers the CONVERSION only. Withholding from an RMD or from a plain IRA withdrawal and then replacing that money is an ordinary IRA-to-IRA rollover, which really is limited to once per 12 months. RMD dollars cannot be rolled over or converted at all, so only the balance beyond the RMD is available to convert.',
    },
    {
      tag:   'IRC 408(d)(8)',
      label: 'Qualified charitable distribution — an RMD sent straight to charity',
      cite:  '26 U.S.C. 408(d)(8)',
      url:   'https://www.irs.gov/retirement-plans/retirement-plans-faqs-regarding-iras-distributions-withdrawals',
      note:  'The annual QCD limit is inflation-indexed; the planner cites the 2025 figure of $108,000. Confirm the current year\'s limit.',
      long:  'Directing an RMD to charity as a QCD satisfies the RMD requirement and excludes the amount from income, which also lets a Roth conversion go ahead without taking the RMD as cash first. The exclusion is why it beats taking the RMD and deducting a donation.',
    },
    {
      tag:   'Rev. Proc. 2020-46',
      label: 'Self-certifying a late rollover when you miss the 60 days',
      cite:  'IRS Revenue Procedure 2020-46 (see also: Accepting late rollover contributions)',
      url:   'https://www.irs.gov/retirement-plans/accepting-late-rollover-contributions',
      note:  'One of three routes to a waiver, alongside an automatic waiver and a private letter ruling. You give the custodian the Model Letter, and it may rely on that "unless they have actual knowledge contrary to the certification". Only listed reasons qualify, it covers the lateness only and not whether the amount was rollover-eligible, and the IRS can still disagree on audit.',
      long:  'Relief is narrow if you do miss the deadline. There are three routes: an automatic waiver, a private letter ruling, or self-certification using the Model Letter in Rev. Proc. 2020-46, which your custodian may accept unless it has actual knowledge to the contrary. Self-certification only covers the REASON you were late, and only for listed reasons such as serious illness, a death in the family, or a financial institution error. It does not bless the rollover otherwise, and the IRS can still disagree on audit. Treat the deadline as real rather than as something you can undo.',
    },
    {
      tag:   'IRC 4973',
      label: '6% per year on an excess contribution, until you fix it',
      cite:  '26 U.S.C. 4973(a) and (f)',
      url:   'https://www.law.cornell.edu/uscode/text/26/4973',
      note:  'Why a late deposit is not a harmless one. Past 60 days it is not a rollover, so at best it counts as a regular Roth contribution against the annual limit and the MAGI rules. Anything that does not fit is an excess contribution taxed "6 percent of the amount of the excess contributions", recurring every year until corrected.',
      long:  'What a late deposit becomes: past the 60 days it is not a rollover, so it counts at best as a regular Roth contribution for that year, against the annual limit and the income eligibility rules. Anything that does not fit is an excess contribution taxed 6% per year until you correct it. The Roth space itself is gone either way — the withheld amount stays out of the Roth permanently and you cannot put it back later.',
    },
    {
      tag:   'Pub 505',
      label: 'Safe harbor: 90% of this year, or 100% of last year (110% above $150K AGI)',
      cite:  'IRS Publication 505, Tax Withholding and Estimated Tax',
      url:   'https://www.irs.gov/publications/p505',
      note:  null,
    },
    {
      tag:   'IRC 7503',
      label: 'A deadline landing on a weekend or holiday moves to the next business day',
      cite:  '26 U.S.C. 7503',
      url:   'https://www.law.cornell.edu/uscode/text/26/7503',
      note:  'Applied to the estimated-tax due dates shown above, for both the printed deadline and the past-due check.',
    },
    {
      tag:   'Form 2210 Sch. AI',
      label: 'Annualized income installment method, for income that arrived late in the year',
      cite:  'IRS Form 2210, Schedule AI (see also Pub 505)',
      url:   'https://www.irs.gov/forms-pubs/about-form-2210',
      note:  'Attributes a late-year conversion to the quarter it arose in, which can remove an earlier-quarter penalty without any withholding.',
    },
  ];

  // ── Repeated explanations that are NOT law ─────────────────────────────────
  // Same shape as RULE_CITES and rendered in the same panel, but with no `cite` or `url`,
  // because these are economic arguments and scheduling mechanics rather than authorities.
  // Keeping them out of RULE_CITES is the point: everything in that array is something you
  // can look up, and a reader should be able to trust that.
  const CONCEPT_NOTES = [
    {
      tag:  'Replacement timing',
      label: 'Sooner is better, and the deadline is not the target',
      long: 'The gain from replacing the withheld cash runs from the day the cash lands in the Roth, ' +
            'not from the conversion date, so replacing as soon as you have the money is worth more than ' +
            `waiting. The ${RESTORE_TARGET_DAYS}-day date the planner prints is a safety buffer against the ` +
            `${ROLLOVER_DEADLINE_DAYS}-day statutory deadline, not a date to aim for. Acting earlier also widens ` +
            'that margin, so the only reason to wait is not having the cash yet. The per-conversion dollar ' +
            'figures are on the conversion and restore steps.',
    },
    {
      tag:  'RMD ordering',
      label: 'Why the RMD is scheduled before the conversion',
      long: 'The RMD for the year must be distributed before any Roth conversion from the same IRA, and RMD ' +
            'dollars themselves cannot be converted. When both land in the same month the planner splits them ' +
            'and leaves a settlement buffer between the two, and moves both dates off weekends and the ' +
            'holidays it models. The RMD must in any case be completed by December 31.',
    },
  ];

  // The plain-text tab has no clickable anchors, so a pointer has to name the tag in a form you
  // can find by eye in the sources list. Same string in both outputs, deliberately.
  function seeAlso(tag) {
    return `[see ${tag} in Rules and sources]`;
  }

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

  // ── Business-day arithmetic ────────────────────────────────────────────────
  // Every date this planner prints is a date you have to act on, so none of them may
  // land on a day your custodian is shut.
  //
  // DELIBERATE SIMPLIFICATION: this models weekends plus the two holidays below, and
  // nothing else. A target date can still land on Thanksgiving, July 4, or Memorial Day.
  // Widening the model is a one-line addition to OBSERVED_HOLIDAYS, not a code change.
  // The output says which days it knows about so nobody has to guess.
  const OBSERVED_HOLIDAYS = [
    { month: 1,  day: 1,  name: "New Year's Day" },
    { month: 12, day: 25, name: 'Christmas Day'  },
  ];

  // A fixed-date federal holiday falling on Saturday is observed the preceding Friday,
  // and one falling on Sunday the following Monday (5 U.S.C. 6103(b)).
  function observedHolidayName(date) {
    const y = date.getFullYear();
    for (const h of OBSERVED_HOLIDAYS) {
      const actual = new Date(y, h.month - 1, h.day);
      const obs    = new Date(actual);
      if (actual.getDay() === 6) obs.setDate(obs.getDate() - 1);        // Sat → Fri
      else if (actual.getDay() === 0) obs.setDate(obs.getDate() + 1);   // Sun → Mon
      if (obs.getMonth() === date.getMonth() && obs.getDate() === date.getDate()) return h.name;
      // New Year's Day observed on the preceding Friday falls in the PREVIOUS year.
      if (h.month === 1 && h.day === 1) {
        const nextActual = new Date(y + 1, 0, 1);
        if (nextActual.getDay() === 6) {
          const nextObs = new Date(nextActual); nextObs.setDate(nextObs.getDate() - 1);
          if (nextObs.getFullYear() === y && nextObs.getMonth() === date.getMonth()
              && nextObs.getDate() === date.getDate()) return h.name;
        }
      }
    }
    return null;
  }

  function isBusinessDay(date) {
    const wd = date.getDay();
    if (wd === 0 || wd === 6) return false;
    return observedHolidayName(date) === null;
  }

  function nextBusinessDay(date) {
    const d = new Date(date);
    while (!isBusinessDay(d)) d.setDate(d.getDate() + 1);
    return d;
  }

  function prevBusinessDay(date) {
    const d = new Date(date);
    while (!isBusinessDay(d)) d.setDate(d.getDate() - 1);
    return d;
  }

  // First Monday strictly after the given date. Used for the January draw target so the
  // year's first action clears New Year's week rather than landing on the holiday itself.
  function firstMondayAfter(year, month, day) {
    const d = new Date(year, month - 1, day);
    do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 1);
    return d;
  }

  // IRC 7503: an act due on a Saturday, Sunday, or legal holiday is timely if performed
  // on the next succeeding business day. Returns the shifted date plus the statutory one,
  // so callers can show both. Used for BOTH the displayed deadline and the past-due test,
  // which is how those two can never disagree.
  function dueDateFor(q, taxYear) {
    const dueYear   = q.nextYear ? taxYear + 1 : taxYear;
    const statutory = new Date(dueYear, q.month - 1, q.day);
    const due       = nextBusinessDay(statutory);
    return {
      statutory,
      dueDate: due,
      shifted: due.getTime() !== statutory.getTime(),
      date: { year: due.getFullYear(), month: due.getMonth() + 1, day: due.getDate() },
      statutoryStr: fmtDate(dueYear, q.month, q.day),
    };
  }

  function restoreDateFor(taxYear, convMonth, convDay) {
    const conv = new Date(taxYear, convMonth - 1, convDay);
    const raw  = new Date(conv);
    raw.setDate(raw.getDate() + RESTORE_TARGET_DAYS);
    const restore = nextBusinessDay(raw);
    // The 45-day target can absorb at most a few days of nudge, so the statutory ceiling
    // is never at risk. Assert it rather than assume it.
    const elapsed = Math.round((restore - conv) / 86400000);
    if (elapsed > ROLLOVER_DEADLINE_DAYS) {
      throw new Error(`restore date ${elapsed} days after conversion exceeds the ${ROLLOVER_DEADLINE_DAYS}-day rollover window`);
    }
    return { conv, restore, elapsed };
  }

  // Split a total across weighted installments so the parts sum EXACTLY to the total.
  // Rounding each installment independently drifts by up to a dollar per installment, which
  // is enough to leave a plan a few dollars short of the liability it is supposed to pay.
  // The last installment absorbs the remainder.
  function splitExact(total, weights) {
    const out = [];
    let assigned = 0;
    weights.forEach((w, i) => {
      const amt = (i === weights.length - 1) ? total - assigned : Math.round(total * w);
      out.push(amt);
      assigned += amt;
    });
    return out;
  }

  // Explains an IRC 7503 shift on an action's note, or '' when the date did not move.
  function shiftNote(d) {
    if (!d.shifted) return '';
    return `The statutory date is ${d.statutoryStr}, which falls on a weekend or a holiday, ` +
           `so the deadline moves to the next business day [IRC 7503].`;
  }

  function getStateInfo(code) {
    return STATE_DB[code] || STATE_DB._DEFAULT;
  }

  // IRC 6654(g)(1) credits withholding as if an equal part were paid on each due date, whatever
  // date it actually happened. So "does withholding alone make me timely" is a CUMULATIVE question,
  // not one comparison: at every due date, is the cumulative ratable credit at least the cumulative
  // required installment? A uniform credit against a WEIGHTED schedule can clear the annual total
  // and still miss an early date — California is 30/40/30 — which is the case a single
  // total-versus-total test gets wrong.
  function withholdingCoversSchedule(withheldTotal, reqAnnual, schedule) {
    if (reqAnnual <= 0) return true;
    const n = schedule.length;
    if (n === 0) return true;            // no schedule means nothing to be late for
    let cumReq = 0, cumCredit = 0;
    for (const q of schedule) {
      cumReq    += reqAnnual * q.w;
      cumCredit += withheldTotal / n;
      if (cumCredit + 1 < cumReq) return false;   // $1 tolerance, matches splitExact rounding
    }
    return true;
  }

  function detectMissed(schedule, taxYear, todayDate) {
    return schedule
      .map(q => {
        const d = dueDateFor(q, taxYear);
        // dueYear/dueDate are the IRC 7503 shifted values, so an installment is never
        // flagged past due on a weekend when the real deadline is the following Monday.
        return Object.assign({}, q, {
          dueYear: d.date.year, dueDate: d.dueDate,
          shifted: d.shifted, statutoryStr: d.statutoryStr,
        });
      })
      .filter(q => q.dueDate < todayDate);
  }

  // ── Per-IRA ordering rule helper ──────────────────────────────────────────
  // convFuture=false when the conversion is already completed — skip the
  // pull-forward rule so a past conv month doesn't drag the draw backward.
  function resolveIraOrdering(taxYear, rmd, rmdMonth, conv, convMonth, convFuture = true) {
    const clamp = m => Math.max(1, Math.min(12, Math.round(m || 12)));
    const rm = clamp(rmdMonth);
    const cm = clamp(convMonth);
    const hasConflict = convFuture && rmd > 0 && conv > 0 && cm <= rm;
    const planARmdMonth = hasConflict ? cm : rm;
    const sameMonth = rmd > 0 && conv > 0 && planARmdMonth === cm;

    // Day targets. Base is the 15th in every month, nudged forward off weekends and the
    // holidays we model.
    //
    // When the RMD and the conversion share a month they have to be split, because the RMD
    // must be distributed before the conversion. The old split was day 1 and day 8, which
    // put the draw on January 1 for every future tax year (nextMonth is forced to January
    // then) — a federal holiday, and a Saturday in 2028. January now starts on the first
    // Monday after New Year's Day instead, and the conversion keeps its 7-day buffer.
    let rmdDate, convDate;
    if (sameMonth) {
      const rmdBase = planARmdMonth === 1
        ? firstMondayAfter(taxYear, 1, 1)
        : new Date(taxYear, planARmdMonth - 1, 1);
      rmdDate = nextBusinessDay(rmdBase);
      const convBase = new Date(rmdDate);
      convBase.setDate(convBase.getDate() + ORDERING_BUFFER_DAYS);
      convDate = nextBusinessDay(convBase);
    } else {
      rmdDate  = nextBusinessDay(new Date(taxYear, planARmdMonth - 1, 15));
      convDate = nextBusinessDay(new Date(taxYear, cm - 1, 15));
    }

    return {
      planARmdMonth,
      planAConvMonth: cm,
      planARmdDay:  rmdDate.getDate(),
      planAConvDay: convDate.getDate(),
      hasConflict,
      sameMonth,
      origRmdMonth: rm,
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

      ira1Rmd:             0,
      ira1Voluntary:       0,
      ira1RmdTaken:        false,   // RMD/draw already taken — must be true before VolTaken/ConvDone
      ira1VolTaken:        false,   // voluntary withdrawal already taken (requires ira1Rmd=0 or ira1RmdTaken)
      ira1RothConversion:  0,
      ira1ConvDone:        false,   // conversion already done (requires ira1Rmd=0 or ira1RmdTaken)
      ira1RothWithhold:    null,

      ira2Rmd:             0,
      ira2Voluntary:       0,
      ira2RmdTaken:        false,
      ira2VolTaken:        false,
      ira2RothConversion:  0,
      ira2ConvDone:        false,
      ira2RothWithhold:    null,

      ssIncome:          0,
      pensionIncome:     0,
      interest:          0,
      qualifiedDivs:     0,
      capitalGains:      0,
      portfolioRate:     0.07,
      hysaGross:         0.038,
      marginalOrdRate:   0.30,
      cgRateBlended:     0.20,
      appreciationPct:   0.40,
      brokerageValue:    null,
      brokerageBasis:    null,
      forceStrategy:     null,
      todayDate:         new Date(),
      _baseline:         false,
      _planC:            false,
    }, params);

    // appreciationPct is a FRACTION OF VALUE — what share of the brokerage position is
    // unrealized gain — and not an annual growth rate. It is easy to misread as a rate, and the
    // callers that have the real numbers think in dollars, so the preferred way to supply it is
    // brokerageValue + brokerageBasis, which is also exactly what the optimizer tracks
    // (`row.Brokerage` / `row.Basis`, and `yr.capGainsPercentage` in optimizer_core.js is this
    // same ratio). The raw fraction stays supported so existing ?ap= links keep working.
    //
    // Dollars win when both are present and the value is positive. A basis above the value would
    // be a loss position, which this model has no representation for — extraCg() would go
    // negative and start crediting a tax refund against the cost of selling — so clamp to 0.
    if (p.brokerageValue != null && p.brokerageBasis != null && p.brokerageValue > 0) {
      p.appreciationPct = Math.max(0, Math.min(1,
        (p.brokerageValue - p.brokerageBasis) / p.brokerageValue));
    }

    const yr        = p.taxYear;
    const today     = p.todayDate instanceof Date ? p.todayDate : new Date(p.todayDate);
    const stateInfo = getStateInfo(p.state);

    // 2. Per-IRA ordering rules
    // Plan A targets the first of NEXT month — always in the future, no false urgency.
    // Plan B (_baseline) targets December for any action not yet taken.
    // Plan C (_planC): conversions early (nextMonth), draws deferred to December.
    // Already-taken/done actions use the 1st of the PREVIOUS month (or January if in Jan).
    const currentMonth = today.getMonth() + 1;                          // 1–12
    const isFutureYear = yr > today.getFullYear();
    const nextMonth    = isFutureYear ? 1 : Math.min(currentMonth + 1, 12);  // Jan for future years
    const prevMonth    = currentMonth > 1 ? currentMonth - 1 : 1;      // already-done target

    const isBaseline = p._baseline === true;
    const isPlanC    = p._planC    === true;

    // Conversions: Plans A and C use nextMonth (early); Plan B uses December.
    const convTargetMonth = isBaseline ? 12 : nextMonth;
    // Draws (RMD + voluntary): only Plan A uses nextMonth; Plans B and C defer to December.
    const drawTargetMonth = (isBaseline || isPlanC) ? 12 : nextMonth;

    const ira1ConvMonth = p.ira1ConvDone  ? prevMonth : convTargetMonth;
    const ira1RmdMonth  = p.ira1RmdTaken  ? prevMonth : drawTargetMonth;
    const ira1VolMonth  = p.ira1VolTaken  ? prevMonth : drawTargetMonth;
    const ira2ConvMonth = p.ira2ConvDone  ? prevMonth : convTargetMonth;
    const ira2RmdMonth  = p.ira2RmdTaken  ? prevMonth : drawTargetMonth;
    const ira2VolMonth  = p.ira2VolTaken  ? prevMonth : drawTargetMonth;

    // resolveIraOrdering uses the RMD month (IRS ordering: RMD must precede conversion)
    const ira1 = resolveIraOrdering(yr, p.ira1Rmd, ira1RmdMonth, p.ira1RothConversion, ira1ConvMonth, !p.ira1ConvDone);
    const ira2 = resolveIraOrdering(yr, p.ira2Rmd, ira2RmdMonth, p.ira2RothConversion, ira2ConvMonth, !p.ira2ConvDone);

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

    // 5. Conversion withholding setup — draw-first for ALL plans.
    //    All plans prefer to fund taxes through IRA draw withholding rather than conversion
    //    withholding. Conversion withholding is only used as a fallback when draws are insufficient
    //    to cover the full tax liability.
    //
    //    Why draw-first, now that the once-per-12-months story is gone: draw withholding needs no
    //    out-of-pocket cash, has no 60-day deadline to miss, and generates no rollover paperwork.
    //    It is NOT because the maneuver is scarce. A traditional-to-Roth conversion rollover is
    //    excluded from the IRC 408(d)(3)(B) one-rollover-per-12-months limit and is disregarded in
    //    applying that limit to other rollovers, so withhold-and-replace is repeatable per
    //    conversion. doWithhold1 and doWithhold2 are independent for exactly that reason.
    //
    //    ira1RothWithhold / ira2RothWithhold override:
    //      true  → force full pro-rata conversion withholding (explicit user override)
    //      false → never withhold from conversion (accept quarterly shortfall instead)
    //      null  → auto (draw-first; minimum conversion withholding only if gap remains)
    const grossIncome = allDrawsTotal + p.ira1RothConversion + p.ira2RothConversion +
                        p.ssIncome + p.pensionIncome + p.interest + p.qualifiedDivs + p.capitalGains;

    function _estConvW(convAmt) {
      if (convAmt <= 0) return { fed: 0, state: 0, total: 0 };
      const fedW = Math.round(p.federalTax * (convAmt / Math.max(1, grossIncome)));
      const stW  = stateIraExempt ? 0 : Math.round(fedW * stFrac / Math.max(0.001, fedFrac));
      return { fed: fedW, state: stW, total: fedW + stW };
    }

    // Should the withheld W be replaced from outside cash?
    //   replace → W earns altRate until the restore date, then portfolioRate tax-free
    //   don't   → W earns altRate in the taxable account all year, Roth stays short by W
    // Subtracting one from the other, the pre-restore stretch cancels and what is left is a
    // SINGLE differential over ONE period:
    //     gain = W × (portfolioRate − altRate) × yearsFromRestoreToYearEnd
    // The previous version weighted the Roth side by the rest of the year and the cash side
    // by 60 days. Same principal, same year, two different clocks, which overstated the gain
    // by 20-50% and produced a negative result in December. 60 days is the deadline for the
    // rollover, not a holding period for the money.
    function _replacementAnalysis(convAmt, convMonth, convDay, estW) {
      const withheld  = estW.total;
      const monthsRem = Math.max(0, 12 - convMonth);
      const altRate   = hysaNet;
      const spread    = p.portfolioRate - altRate;
      const YEAR_MS   = 365 * 24 * 60 * 60 * 1000;
      const yearEnd   = new Date(yr + 1, 0, 1);
      const yearsTo   = d => Math.max(0, (yearEnd - d) / YEAR_MS);
      // Growth accrues from where the money actually lands, not from the conversion date.
      const { conv, restore } = restoreDateFor(yr, convMonth, convDay);
      const yearsRem = yearsTo(restore);
      const gain     = withheld * spread * yearsRem;

      // The replacement date is a lever, not a fixed fact. Because the gain is
      //     withheld × spread × yearsFromRestoreToYearEnd
      // every day earlier is another day at the spread instead of the cash rate. The 45-day
      // target is a deadline buffer, not a goal, so quantify what acting sooner is worth and
      // let the user decide. Sooner is better on both axes: more compounding AND more margin
      // against the 60-day cliff. The only reason to wait is not having the cash yet.
      const earliestRaw = new Date(conv);
      earliestRaw.setDate(earliestRaw.getDate() + RESTORE_EARLIEST_DAYS);
      const earliest       = nextBusinessDay(earliestRaw);
      const gainIfEarliest = withheld * spread * yearsTo(earliest);
      const earlyBonus     = Math.max(0, gainIfEarliest - gain);

      return {
        withheld, altRate, spread, monthsRem, yearsRem, gain,
        gainIfEarliest, earlyBonus,
        restoreDate:  { year: restore.getFullYear(),  month: restore.getMonth() + 1,  day: restore.getDate() },
        earliestDate: { year: earliest.getFullYear(), month: earliest.getMonth() + 1, day: earliest.getDate() },
        // Replacing wins whenever the portfolio outgrows the cash rate and there is cash to
        // do it with. True in December too: yearsRem is 0 so the first-year gain is 0, but
        // the spread applies every year the money stays in the Roth.
        recommended: withheld > 0 && spread > 0,
      };
    }

    // Withholding variables — all start at zero; gap fill below may update them.
    let doWithhold1 = false, doWithhold2 = false;
    let convWithholdFed = 0, convWithholdState = 0;
    let ira1ConvFedW = 0, ira1ConvStW = 0;
    let ira2ConvFedW = 0, ira2ConvStW = 0;
    // 60-day analysis initialised with zero withholding; updated after gap is known.
    let ira1Replacement = _replacementAnalysis(p.ira1RothConversion, ira1.planAConvMonth, ira1.planAConvDay, { total: 0, fed: 0, state: 0 });
    let ira2Replacement = _replacementAnalysis(p.ira2RothConversion, ira2.planAConvMonth, ira2.planAConvDay, { total: 0, fed: 0, state: 0 });

    // Explicit override: ira1RothWithhold === true → pre-draw full pro-rata conversion withholding.
    // This is included in taxAfterConvW so the draw optimizer knows less remains to cover.
    if (p.ira1RothConversion > 0 && p.ira1RothWithhold === true) {
      const w = _estConvW(p.ira1RothConversion);
      ira1ConvFedW = w.fed;  ira1ConvStW = w.state;
      convWithholdFed += ira1ConvFedW;  convWithholdState += ira1ConvStW;
      doWithhold1 = true;
      ira1Replacement = _replacementAnalysis(p.ira1RothConversion, ira1.planAConvMonth, ira1.planAConvDay, w);
    }
    if (p.ira2RothConversion > 0 && p.ira2RothWithhold === true) {
      const w = _estConvW(p.ira2RothConversion);
      ira2ConvFedW = w.fed;  ira2ConvStW = w.state;
      convWithholdFed += ira2ConvFedW;  convWithholdState += ira2ConvStW;
      doWithhold2 = true;
      ira2Replacement = _replacementAnalysis(p.ira2RothConversion, ira2.planAConvMonth, ira2.planAConvDay, w);
    }

    // 6. Cross-IRA withholding optimizer
    // Tax remaining after conversion withholding that IRA draws must cover
    const taxAfterConvW = Math.max(0, totalTax - convWithholdFed - convWithholdState);
    // For IRA-exempt states, IRA draws can only cover federal portion
    const drawWithholdCap = stateIraExempt
      ? Math.min(allDrawsTotal, Math.max(0, p.federalTax - convWithholdFed))
      : Math.min(allDrawsTotal, taxAfterConvW);

    // Sort draw groups by month descending — latest-month draws get withholding first.
    // RMD and voluntary are tracked separately so a later voluntary draw (nextMonth) can
    // carry the withholding even when the RMD was already taken (prevMonth).
    const drawGroups = [
      { num: 1, tag: 'rmd', month: ira1.planARmdMonth, total: p.ira1Rmd,       withheld: 0 },
      { num: 1, tag: 'vol', month: ira1VolMonth,        total: p.ira1Voluntary, withheld: 0 },
      { num: 2, tag: 'rmd', month: ira2.planARmdMonth,  total: p.ira2Rmd,       withheld: 0 },
      { num: 2, tag: 'vol', month: ira2VolMonth,         total: p.ira2Voluntary, withheld: 0 },
    ].filter(g => g.total > 0).sort((a, b) => b.month - a.month);

    let remaining = drawWithholdCap;
    for (const g of drawGroups) {
      g.withheld = Math.min(g.total, remaining);
      remaining -= g.withheld;
      if (remaining <= 0) break;
    }

    const ira1Withheld = drawGroups.filter(g => g.num === 1).reduce((s, g) => s + g.withheld, 0);
    const ira2Withheld = drawGroups.filter(g => g.num === 2).reduce((s, g) => s + g.withheld, 0);
    const totalIraDrawWithheld = ira1Withheld + ira2Withheld;
    let totalCovered = totalIraDrawWithheld + convWithholdFed + convWithholdState;
    let shortfall    = Math.max(0, totalTax - totalCovered);

    // 7. Safe-harbor amounts (computed before the gap fill — the December branch needs them)
    const sfFedMult   = p.highIncomeFiler ? 1.10 : 1.00;
    const sfStateMult = stateInfo.safeHarborAlways110 ? 1.10
                      : (p.highIncomeFiler && p.stateTax >= (stateInfo.safeHarborHighIncomeThreshold || Infinity))
                        ? 1.10 : 1.00;
    const shFed   = p.priorYearFedTax   != null ? p.priorYearFedTax   * sfFedMult   : p.federalTax * 0.90;
    const shState = p.priorYearStateTax != null ? p.priorYearStateTax * sfStateMult : p.stateTax   * 0.90;
    const safeHarborTotal = shFed + shState;

    // Required annual payment, IRC 6654(d)(1)(B): the LESSER of 90% of this year's tax and
    // 100% (110% for a high earner) of last year's. shFed/shState above do NOT take that
    // minimum — they use the prior year whenever it is supplied — so they OVERSTATE the
    // requirement whenever 90% of the current year is the smaller number. Example: current
    // federal tax 35,000 and prior year 33,000 gives shFed 33,000 where the real requirement is
    // 31,500.
    //
    // Those two are displayed figures and they also drive the gap-fill gate below, so correcting
    // them in place would move withholding decisions. That is deliberately left for the penalty
    // work (TPP-1), which has to unify them anyway. What follows is used ONLY to decide whether
    // withholding alone makes the taxpayer timely, and that question needs the real number.
    const reqAnnualFed = p.priorYearFedTax != null
      ? Math.min(p.federalTax * 0.90, p.priorYearFedTax * sfFedMult)
      : p.federalTax * 0.90;
    const reqAnnualState = p.priorYearStateTax != null
      ? Math.min(p.stateTax * 0.90, p.priorYearStateTax * sfStateMult)
      : p.stateTax * 0.90;


    // Gap fill — applies to ALL plans.
    // If draws (+ any forced override withholding) don't cover everything, add the minimum
    // conversion withholding needed to close the gap. Split pro-rata across IRAs by conv size.
    // Skipped when ira1RothWithhold === false (explicit "no conv withholding") or already applied (true).
    //
    // December conversions (monthsRem=0) have no Roth growth left to capture, so withholding buys
    // nothing on that axis. It still buys penalty relief: withholding is deemed paid in equal parts
    // on all four due dates (IRC 6654(g)(1)), so a December withholding retroactively cures Q1-Q3,
    // while a Q4 estimate paid January 15 does not. So December withholding is used only when the
    // coverage would otherwise fall short of safe harbor.
    const _gapFillAllowed = monthsRem =>
      monthsRem > 0 || totalCovered < safeHarborTotal;
    //
    // WITHHOLDING COMES OUT OF THE DISTRIBUTION, so it can never exceed the conversion
    // itself. Form W-4R allows a 0% to 100% federal election on an IRA distribution, and
    // 100% of the gross is the hard ceiling. The old version sized this purely off the
    // shortfall and never looked at the conversion amount, so a $5,000 conversion against a
    // $37,000 gap was told to withhold $24,851 federal (497%) and $12,149 state (243%).
    // Whatever the conversions cannot absorb belongs in quarterly estimates instead.
    let convWithholdCapped = false;
    if (shortfall > 0) {
      // In an IRA-exempt state no state tax can be withheld from an IRA distribution, so
      // conversion withholding can only chase the FEDERAL gap. Sizing it off the whole
      // shortfall there would over-withhold federal past the federal liability.
      let need = stateIraExempt
        ? Math.max(0, p.federalTax - totalIraDrawWithheld - convWithholdFed)
        : shortfall;
      const needAtStart = need;

      // Largest conversion first. When one conversion is too small to carry its share, the
      // remainder rolls to the other rather than being silently dropped.
      const convSlots = [
        { num: 1, ira: ira1, amt: p.ira1RothConversion, allowed: p.ira1RothWithhold !== false && !doWithhold1 },
        { num: 2, ira: ira2, amt: p.ira2RothConversion, allowed: p.ira2RothWithhold !== false && !doWithhold2 },
      ].filter(s => s.amt > 0 && s.allowed).sort((a, b) => b.amt - a.amt);

      for (const s of convSlots) {
        if (need <= 0) break;
        if (!_gapFillAllowed(Math.max(0, 12 - s.ira.planAConvMonth))) continue;

        const take = Math.min(need, s.amt);          // the cap that was missing
        const fedW = Math.round(take * (stateIraExempt ? 1.0 : fedFrac));
        const stW  = stateIraExempt ? 0 : take - fedW; // exact, so fedW + stW === take
        if (fedW + stW <= 0) continue;

        if (s.num === 1) { ira1ConvFedW = fedW; ira1ConvStW = stW; doWithhold1 = true; }
        else             { ira2ConvFedW = fedW; ira2ConvStW = stW; doWithhold2 = true; }
        convWithholdFed   += fedW;
        convWithholdState += stW;
        const rep = _replacementAnalysis(s.amt, s.ira.planAConvMonth, s.ira.planAConvDay,
          { total: fedW + stW, fed: fedW, state: stW });
        if (s.num === 1) ira1Replacement = rep; else ira2Replacement = rep;
        need -= (fedW + stW);
      }

      convWithholdCapped = needAtStart > 0 && need > 0 && convSlots.length > 0;
      totalCovered = totalIraDrawWithheld + convWithholdFed + convWithholdState;
      shortfall    = Math.max(0, totalTax - totalCovered);
    }

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

    // 10b. Does withholding ALONE make each schedule timely?
    // The old missed-payment alert answered this with `usesIraWithholding` — i.e. "am I using any
    // withholding at all" — and then told the user no action was required and they were
    // penalty-free. That is only true when the withholding actually clears the installments.
    // A plan can use withholding heavily, still be short, and still be told it is safe: with
    // federal tax 35,000 against 50,000 of draws, the federal share of the withholding is 30,702
    // against a 31,500 requirement, so it misses by 798 while the alert claimed penalty-free.
    // Federal and state are tested separately because they can disagree — in that same scenario
    // California is comfortably covered while federal is not.
    const fedWithheldTotal   = Math.round(totalIraDrawWithheld * wFedFrac) + convWithholdFed;
    const stateWithheldTotal = (totalIraDrawWithheld - Math.round(totalIraDrawWithheld * wFedFrac))
                             + convWithholdState;
    const fedTimelyByWithholding   = withholdingCoversSchedule(fedWithheldTotal, reqAnnualFed, FED_Q);
    const stateTimelyByWithholding = !stateInfo.hasIncomeTax
      || withholdingCoversSchedule(stateWithheldTotal, reqAnnualState, stateInfo.quarterlySchedule);

    // 11. Build action list
    const actions = [];
    const addAction = obj => {
      const base = {
        type: T.NOTE, date: null, dateLabel: '',
        amount: 0, federalWithholding: 0, stateWithholding: 0,
        totalWithholding: 0, netReceived: 0,
        fedWithholdPct: 0, stateWithholdPct: 0,
        description: '', notes: [],
        // A date in the past is not the same thing as money being late. Withholding is credited
        // ratably across every due date [IRC 6654(g)(1)], so an elapsed installment on a schedule
        // that withholding already covers is owed but carries no penalty. buildHtml reads this to
        // decide between a red PAST DUE badge and a neutral one, and `benign` to decide whether an
        // alert is reassurance or a warning. Both default to the cautious reading.
        noPenalty: false,
        benign: false,
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

    // ── 11a. Per-IRA ordering rule notes ─────────────────────────────────────
    for (const [iraNum, ira] of [[1, ira1], [2, ira2]]) {
      const convAmt = iraNum === 1 ? p.ira1RothConversion : p.ira2RothConversion;
      const rmdAmt  = iraNum === 1 ? p.ira1Rmd : p.ira2Rmd;
      if (rmdAmt > 0 && convAmt > 0) {
        const timing = ira.sameMonth
          ? `Both are scheduled in ${MONTH_NAMES[ira.planARmdMonth - 1]}: draw on day ${ira.planARmdDay}, conversion on day ${ira.planAConvDay}.`
          : `Draw in ${MONTH_NAMES[ira.planARmdMonth - 1]}, conversion in ${MONTH_NAMES[ira.planAConvMonth - 1]} — order satisfied.`;
        addAction({
          type: T.NOTE,
          description:
            `IRA ${iraNum} — IRS ordering rule: the RMD (${fmt$(rmdAmt)}) must be distributed ` +
            `before any Roth conversion in the same tax year. ${timing} ` +
            `See the two-plan comparison below.`,
          notes: [
            'Only the balance beyond the RMD can be converted. ' + seeAlso('IRC 408(d)(3)'),
            'QCD alternative: sending this RMD to charity satisfies the RMD and keeps it out of income, which allows ' +
            'an earlier conversion. ' + seeAlso('IRC 408(d)(8)'),
          ],
        });
      }
    }

    // ── 11a-w. Already-taken withholding reminder ─────────────────────────
    if (!p._baseline && !isPlanC) {
      const items = [];
      // RMD and voluntary are tracked independently — each gets its own withholding reminder
      for (const [iraNum, rmdTaken, rmd, volTaken, vol] of [
        [1, p.ira1RmdTaken, p.ira1Rmd, p.ira1VolTaken, p.ira1Voluntary],
        [2, p.ira2RmdTaken, p.ira2Rmd, p.ira2VolTaken, p.ira2Voluntary],
      ]) {
        if (rmdTaken && rmd > 0) {
          const g = drawGroups.find(h => h.num === iraNum && h.tag === 'rmd');
          const wFed = Math.round((g?.withheld || 0) * wFedFrac);
          const wSt  = Math.round((g?.withheld || 0) * wStFrac);
          items.push(`IRA ${iraNum} RMD (${fmt$(rmd)}) — estimated withholding: ` +
            `${fmt$(wFed)} federal` + (wSt > 0 ? ` + ${fmt$(wSt)} ${stateInfo.name}` : ''));
        }
        if (volTaken && vol > 0) {
          const g = drawGroups.find(h => h.num === iraNum && h.tag === 'vol');
          const wFed = Math.round((g?.withheld || 0) * wFedFrac);
          const wSt  = Math.round((g?.withheld || 0) * wStFrac);
          items.push(`IRA ${iraNum} voluntary withdrawal (${fmt$(vol)}) — estimated withholding: ` +
            `${fmt$(wFed)} federal` + (wSt > 0 ? ` + ${fmt$(wSt)} ${stateInfo.name}` : ''));
        }
      }
      if (p.ira1ConvDone && p.ira1RothConversion > 0) {
        const wLabel = doWithhold1
          ? `${fmt$(ira1ConvFedW)} federal` + (ira1ConvStW > 0 ? ` + ${fmt$(ira1ConvStW)} ${stateInfo.name}` : '')
          : 'none (IRA draws cover all taxes)';
        items.push(`IRA 1 Roth conversion (${fmt$(p.ira1RothConversion)}) — estimated withholding: ${wLabel}`);
      }
      if (p.ira2ConvDone && p.ira2RothConversion > 0) {
        const wLabel = doWithhold2
          ? `${fmt$(ira2ConvFedW)} federal` + (ira2ConvStW > 0 ? ` + ${fmt$(ira2ConvStW)} ${stateInfo.name}` : '')
          : 'none (IRA draws cover all taxes)';
        items.push(`IRA 2 Roth conversion (${fmt$(p.ira2RothConversion)}) — estimated withholding: ${wLabel}`);
      }
      if (items.length > 0) {
        addAction({
          type: T.ALERT,
          description: `One or more distributions are marked as already taken. ` +
            `Verify that you instructed your IRA custodian to withhold the amounts shown below. ` +
            `If withholding was insufficient, a supplemental estimated tax payment may be needed.`,
          notes: [
            ...items,
            `IRA withholding is voluntary and must be requested at the time of distribution — ` +
            `custodians do not withhold automatically unless instructed.`,
            `If you under-withheld, use Form 1040-ES to make a catch-up estimated payment by the next quarterly due date.`,
          ],
        });
      }
    }

    // ── 11b. Missed-payment alerts ──────────────────────────────────────────
    if (hasMissed) {
      const todayStr = fmtDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
      if (usesIraWithholding && fedTimelyByWithholding && stateTimelyByWithholding) {
        const missedLabels = [
          ...missedFed.map(q => `Federal ${q.label} (due ${fmtDate(q.dueYear, q.month, q.day)})`),
          ...missedState.map(q => `${stateInfo.name} ${q.label} (due ${fmtDate(q.dueYear, q.month, q.day)})`),
        ].join('; ');
        addAction({
          type: T.ALERT,
          benign: true,
          description:
            `As of ${todayStr}, the following quarterly installment dates have passed: ${missedLabels}. ` +
            `No action is required — your withholding covers every installment on both schedules, and it is ` +
            `credited as if paid pro-rata through the year.`,
          notes: [
            'A December IRA distribution satisfies all four quarterly installments retroactively. ' + seeAlso('IRC 6654(g)'),
            `Checked, not assumed: ${fmt$(fedWithheldTotal)} of federal withholding against a ` +
            `${fmt$(Math.round(reqAnnualFed))} required annual payment` +
            (stateInfo.hasIncomeTax
              ? `, and ${fmt$(stateWithheldTotal)} of ${stateInfo.name} withholding against ${fmt$(Math.round(reqAnnualState))}`
              : '') + `, compared cumulatively at each due date.`,
            stateInfo.withholdingCreditedProRata || !stateInfo.hasIncomeTax
              ? ''
              : `Verify that ${stateInfo.name} applies the same pro-rata withholding credit rule — this ` +
                `planner assumes it does not, so the state figure above may be optimistic.`,
          ].filter(Boolean),
        });
      } else if (usesIraWithholding) {
        // Withholding is in use but does NOT clear both schedules. This is the branch the old code
        // was missing: it sent this case down the reassuring path above and told the user they were
        // penalty-free. Name which schedule is short, because the answer differs per schedule.
        const shortSchedules = [
          !fedTimelyByWithholding
            ? `federal (${fmt$(fedWithheldTotal)} withheld against a ${fmt$(Math.round(reqAnnualFed))} required annual payment)`
            : '',
          !stateTimelyByWithholding
            ? `${stateInfo.name} (${fmt$(stateWithheldTotal)} withheld against ${fmt$(Math.round(reqAnnualState))})`
            : '',
        ].filter(Boolean).join(' and ');
        const coveredSchedules = [
          fedTimelyByWithholding ? 'federal' : '',
          stateTimelyByWithholding && stateInfo.hasIncomeTax ? stateInfo.name : '',
        ].filter(Boolean).join(' and ');
        addAction({
          type: T.ALERT,
          description:
            `As of ${todayStr}, installment dates have passed and your withholding does not fully cover ` +
            `${shortSchedules}. Your withholding IS credited as if paid pro-rata through the year, so it ` +
            `repairs most of the timing problem, but the uncovered part of an elapsed installment is still ` +
            `late. The estimated payments scheduled below close the gap.`,
          notes: [
            'Withholding is credited in equal parts on every due date, whenever it actually happened, which is why it reaches back to quarters that have already passed. An estimated payment does not. ' + seeAlso('IRC 6654(g)'),
            coveredSchedules
              ? `${coveredSchedules} withholding does clear every installment on its own schedule, so no penalty arises there.`
              : '',
            'The strongest remedy is more withholding rather than a larger estimate, because only withholding reaches an elapsed quarter. Form 2210 Schedule AI is the other lever when the income genuinely arrived late in the year.',
            'This planner does not yet quantify the penalty.',
          ].filter(Boolean),
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
    for (const [iraNum, ira, convFedW, convStW, convAmt, doWithhold, sda] of [
      [1, ira1, ira1ConvFedW, ira1ConvStW, p.ira1RothConversion, doWithhold1, ira1Replacement],
      [2, ira2, ira2ConvFedW, ira2ConvStW, p.ira2RothConversion, doWithhold2, ira2Replacement],
    ]) {
      if (convAmt <= 0) continue;
      const convDate    = { year: yr, month: ira.planAConvMonth, day: ira.planAConvDay };
      const convDateStr = fmtDate(yr, ira.planAConvMonth, ira.planAConvDay);
      const monthsOfGrowth = 12 - ira.planAConvMonth;
      const restoreStr = fmtDate(sda.restoreDate.year, sda.restoreDate.month, sda.restoreDate.day);
      // The gain is a single differential over one period. An earlier version of this note
      // credited the Roth for the rest of the year while charging the cash side only 60 days,
      // which OVERSTATED the gain by roughly 20% to 50% and turned negative in December.
      const sdaNote = sda.withheld === 0
        ? ''
        : sda.monthsRem === 0
          ? `December conversion: no Roth growth left to capture this year, so this withholding is here ` +
            `for penalty relief, not growth. ${fmt$(sda.withheld)} withheld in December is credited as ` +
            `if paid in equal parts on all four due dates, which cures an earlier-quarter shortfall that ` +
            `a January 15 estimate cannot reach [IRC 6654(g)]. Still replace the ${fmt$(sda.withheld)} from ` +
            `cash: the restore lands in ${MONTH_NAMES[sda.restoreDate.month-1]}, so at the 45-day target ` +
            `this year's gain is $0, ` +
            (sda.earlyBonus > 0
              ? `though replacing before December 31 instead would capture about ${fmt$(sda.earlyBonus)} of it. `
              : '') +
            `The ${fmtPct(sda.spread, 2)} spread between the Roth and your cash then applies every year ` +
            `afterward, and the full conversion stays in the Roth.`
          : `Replacing the ${fmt$(sda.withheld)}: it moves from cash earning ${fmtPct(sda.altRate, 2)} after tax ` +
            `into the Roth earning ${fmtPct(p.portfolioRate)} tax free, counted from the restore date ` +
            `(${restoreStr}) to year end. First-year gain = +${fmt$(sda.gain)} ` +
            `(${fmt$(sda.withheld)} × ${fmtPct(sda.spread, 2)} spread × ${sda.yearsRem.toFixed(2)} years). ` +
            `The same spread applies every year the money stays in the Roth, so treat ${fmt$(sda.gain)} as a ` +
            `floor, not the total. Replacing is worth it whenever your portfolio outgrows your cash rate ` +
            `and you have the cash on hand.`;

      // The replacement date is a lever. Sooner is better on both axes and costs nothing.
      // This note rides BOTH the conversion action and the restore action, and there are three
      // plans, so it renders six times. The dollar figures are per-scenario and stay here; the
      // argument for acting early is identical every time and lives in CONCEPT_NOTES.
      const earlyNote = (sda.withheld > 0 && sda.earlyBonus > 0)
        ? `Sooner is better: replacing around ` +
          `${fmtDate(sda.earliestDate.year, sda.earliestDate.month, sda.earliestDate.day)} rather than waiting for ` +
          `the ${RESTORE_TARGET_DAYS}-day date is worth about ${fmt$(sda.earlyBonus)} more this year ` +
          `(${fmt$(sda.gainIfEarliest)} versus ${fmt$(sda.gain)}), and the gap persists in every later year. ` +
          seeAlso('Replacement timing')
        : '';

      if (doWithhold) {
        const restoreAmt = convFedW + convStW;
        const restoreDate    = sda.restoreDate;
        const restoreDateStr = restoreStr;
        const crossesYearEnd = restoreDate.year > yr;

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
            `. See the restore-cash step below.`,
          notes: [
            isPlanC
              ? `Plan C fallback: December draws cover most taxes, but a ${fmt$(restoreAmt)} gap required this minimum conversion withholding. Restoring this amount keeps the full conversion in Roth.`
              : 'Withholding reduces the Roth credit — the 60-day cash replacement makes the conversion whole so the full amount earns tax-free Roth growth.',
            sdaNote,
            earlyNote,
            'Repeatable: you can withhold and replace on every conversion you make, in the same year, ' +
            'in both IRAs. ' + seeAlso('IRS Ann. 2014-32'),
            'The exclusion covers the CONVERSION only, not an RMD or a plain withdrawal. ' +
            seeAlso('IRC 408(d)(3)'),
            // Withholding is taken out of the distribution, so the conversion is a hard ceiling.
            convWithholdCapped
              ? `This conversion is too small to carry the rest of the tax gap. Withholding is ` +
                `capped at the ${fmt$(convAmt)} being converted, because it comes out of the ` +
                `distribution and cannot exceed it. The remainder is scheduled as quarterly ` +
                `estimates below.`
              : '',
            (convFedW + convStW) >= convAmt
              ? `Note the rate: this withholds the entire ${fmt$(convAmt)}, so nothing lands in the ` +
                `Roth unless you complete the cash replacement below. If you cannot replace it, ` +
                `withhold less here and pay the difference as an estimate instead.`
              : '',
            ira.hasConflict
              ? `RMD ordering enforced: IRA ${iraNum} RMD distributed on ${MONTH_NAMES[ira.planARmdMonth-1]} ${ira.planARmdDay}; conversion follows on ${MONTH_NAMES[ira.planAConvMonth-1]} ${ira.planAConvDay}.`
              : monthsOfGrowth > 0
                ? `Converting IRA ${iraNum} in ${MONTH_NAMES[ira.planAConvMonth-1]} gives ${monthsOfGrowth} months of tax-free Roth growth this year.`
                : `Converting IRA ${iraNum} in January maximizes tax-free Roth growth for the year.`,
          ].filter(Boolean),
        });

        // Restore-cash calendar entry
        addAction({
          type: T.CASH_RESTORE,
          iraNum,
          date: restoreDate,
          amount: restoreAmt,
          federalWithholding: 0,
          stateWithholding:   0,
          description:
            `Restore ${fmt$(restoreAmt)} cash into IRA ${iraNum} Roth by ${restoreDateStr}. ` +
            `This replaces the ${fmt$(restoreAmt)} withheld at conversion so the full ${fmt$(convAmt)} earns tax-free Roth growth.`,
          notes: [
            `This date is the LATEST you should act, not the goal. It is ${RESTORE_TARGET_DAYS} days from the conversion (${convDateStr}), inside the ${ROLLOVER_DEADLINE_DAYS}-day statutory limit [IRS Rollovers]. ` + seeAlso('Replacement timing'),
            earlyNote,
            `Source the cash from any personal account and transfer it straight into the Roth. ` + seeAlso('IRS Rollovers'),
            // What missing the deadline actually costs. Deliberately does NOT say "the withheld
            // amount becomes taxable" — for a conversion it was taxable either way, and saying
            // otherwise implies an income-tax hit that does not exist. That precision is
            // scenario-specific (it names the gross), so it stays here rather than moving to a cite.
            `IF YOU MISS THE ${ROLLOVER_DEADLINE_DAYS} DAYS: the deposit is no longer a rollover [IRC 408(d)(3)], and the ` +
            `${fmt$(restoreAmt)} stays out of the Roth permanently. Your income tax does not change, because you ` +
            `converted ${fmt$(convAmt)} gross and that whole amount is taxable this year whether or not you replace ` +
            `the ${fmt$(restoreAmt)}. ` + seeAlso('IRC 4973') + ` for what a late deposit becomes.`,
            `Relief is narrow if you do miss it: an automatic waiver, a private letter ruling, or self-certification ` +
            `under Rev. Proc. 2020-46, and only for listed reasons. Treat the deadline as real rather than as ` +
            `something you can undo. ` + seeAlso('Rev. Proc. 2020-46'),
            crossesYearEnd
              ? `This deadline falls in ${restoreDate.year}, which is fine. The 60-day window is measured from the distribution, not from year end. The replacement still completes the ${yr} conversion, so expect the 1099-R for ${yr} and the 5498 for ${restoreDate.year}. Keep the transfer confirmation.`
              : '',
            // The date itself is left alone; the 60-day window is what it is. This just warns
            // that the last week of December is a bad time to rely on a custodian transfer.
            (restoreDate.year === yr && restoreDate.month === 12 && restoreDate.day >= 24)
              ? `Heads up: this lands in the last week of December, when custodians are running year-end processing and staffing is thin. Move the transfer earlier in the window rather than up against this date.`
              : '',
          ].filter(Boolean),
        });
      } else {
        // No conversion withholding — draws cover taxes. Build a plan-aware description.
        const drawTimingLabel = isBaseline ? 'December draws'
          : isPlanC ? 'December draws (Plan A hybrid)'
          : 'IRA draws';
        // These used to assert "Taxes covered by December draws" / "Taxes funded by IRA draws"
        // unconditionally, which is false whenever a shortfall is being routed to quarterly
        // estimates further down the same plan. That is the common case for a December conversion:
        // the gap fill declines to withhold (no Roth growth left AND safe harbor already met), so
        // the residual goes to estimates while this step claimed the draws had it handled. Say what
        // the plan actually does.
        const partlyEstimated = shortfall > 0;
        const fundingClause = partlyEstimated
          ? `Draws cover ${fmt$(totalCovered)} of the ${fmt$(totalTax)} due; the remaining ` +
            `${fmt$(shortfall)} is scheduled as quarterly estimates below.`
          : `Taxes covered by ${drawTimingLabel}.`;
        const noWithholdDesc = sda.monthsRem === 0
          ? `No withholding — December conversion; no Roth growth remaining to capture this year. ${fundingClause}`
          : `No withholding — full ${fmt$(convAmt)} earns ${monthsOfGrowth} months of tax-free Roth growth, and no 60-day rollover is needed. ${fundingClause}`;
        // Why withholding was declined rather than merely "not needed" — the reasoning a reader
        // cannot otherwise see. Three genuinely different causes, so do not report one of them as
        // if it were the others. The safe-harbor clause is CHECKED against the figure rather than
        // inferred from the gate, because a second conversion in another month can move coverage
        // after the gate ran.
        const declinedByOverride = iraNum === 1
          ? p.ira1RothWithhold === false
          : p.ira2RothWithhold === false;
        const shMet = totalCovered >= safeHarborTotal;
        let noWithholdNote;
        if (declinedByOverride && partlyEstimated) {
          noWithholdNote =
            `Conversion withholding is switched off for IRA ${iraNum} by your override, so the residual ` +
            `${fmt$(shortfall)} goes to quarterly estimates instead. The full ${fmt$(convAmt)} stays in the Roth.`;
        } else if (sda.monthsRem === 0 && partlyEstimated) {
          noWithholdNote =
            `Withholding from this conversion was considered and declined: a December conversion has no Roth ` +
            `growth left to capture` +
            (shMet
              ? `, and your withholding already covers the ${fmt$(Math.round(safeHarborTotal))} safe-harbor minimum, so withholding here would buy neither growth nor penalty relief. `
              : `, so withholding here would buy no growth. `) +
            `Paying the ${fmt$(shortfall)} as estimates keeps the full ${fmt$(convAmt)} in the Roth and needs no ` +
            `60-day replacement.`;
        } else if (sda.monthsRem === 0) {
          noWithholdNote =
            `December conversion: 0 months of Roth growth remaining, and the draws already fund the whole ` +
            `liability, so there is nothing for conversion withholding to do.`;
        } else if (partlyEstimated) {
          noWithholdNote =
            `Conversion withholding was not used to close the gap; the residual ${fmt$(shortfall)} goes to ` +
            `quarterly estimates, and the full conversion stays in the Roth.`;
        } else {
          noWithholdNote =
            `Taxes funded entirely by IRA draw withholding — no out-of-pocket cash required and no 60-day rollover needed.`;
        }
        addAction({
          type: T.ROTH_CONV,
          iraNum,
          date: convDate,
          amount: convAmt,
          federalWithholding: 0,
          stateWithholding:   0,
          description: `IRA ${iraNum} — Roth convert ${fmt$(convAmt)} on ${convDateStr}. ${noWithholdDesc}`,
          notes: [
            noWithholdNote,
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
      // Merge optimizer groups into action-level entries, combining same-IRA same-month subdraws
      // into one action while keeping different-month subdraws as separate calendar entries.
      const actionGroups = [];
      for (const g of drawGroups) {
        const ex = actionGroups.find(a => a.num === g.num && a.month === g.month);
        if (ex) {
          ex.total    += g.total;
          ex.withheld += g.withheld;
          if (g.tag === 'rmd') ex.rmdAmt += g.total; else ex.volAmt += g.total;
        } else {
          actionGroups.push({
            num: g.num, month: g.month,
            total: g.total, withheld: g.withheld,
            rmdAmt: g.tag === 'rmd' ? g.total : 0,
            volAmt: g.tag === 'vol' ? g.total : 0,
          });
        }
      }
      actionGroups.sort((a, b) => a.num - b.num || a.month - b.month);

      for (const ag of actionGroups) {
        const iraNum = ag.num;
        const ira    = iraNum === 1 ? ira1 : ira2;
        const iraWithheld = ag.withheld;
        const iRmd   = ag.rmdAmt;
        const iVol   = ag.volAmt;

        const iraFedW = Math.round(iraWithheld * wFedFrac);
        const iraStW  = Math.round(iraWithheld * wStFrac);

        // RMD groups use the day from resolveIraOrdering (may be day 1 for same-month conv);
        // vol-only groups default to the 15th.
        const actionDay  = iRmd > 0 ? ira.planARmdDay : 15;
        const rmdDate    = { year: yr, month: ag.month, day: actionDay };
        const rmdDateStr = fmtDate(yr, ag.month, actionDay);

        const totW   = iraFedW + iraStW;
        const net    = ag.total - totW;
        const pctFed = ag.total > 0 ? iraFedW / ag.total : 0;
        const pctSt  = ag.total > 0 ? iraStW  / ag.total : 0;
        const pctTot = ag.total > 0 ? totW    / ag.total : 0;

        const optimizerNote = drawGroups.length > 1 && iraWithheld === 0
          ? `This draw (${MONTH_NAMES[ag.month-1]}) is earlier than another scheduled draw — the optimizer directed all withholding to the later draw to maximize tax-deferred growth. No withholding from this entry.`
          : drawGroups.length > 1
            ? `Draw-order optimizer: this entry (${MONTH_NAMES[ag.month-1]}) carries withholding because it is the latest scheduled draw, keeping IRA funds invested the longest.`
            : null;

        // Build description — combine RMD + voluntary into one line when both exist in this group
        const drawLabel = iRmd > 0 && iVol > 0
          ? `IRA ${iraNum} draw of ${fmt$(ag.total)} (RMD ${fmt$(iRmd)} + voluntary ${fmt$(iVol)})`
          : iRmd > 0
            ? `IRA ${iraNum} RMD of ${fmt$(iRmd)}`
            : `IRA ${iraNum} voluntary withdrawal of ${fmt$(iVol)}`;

        const notes = [];
        if (iRmd > 0 && iVol > 0)
          notes.push(`Breakdown: required RMD ${fmt$(iRmd)}, voluntary withdrawal ${fmt$(iVol)}.`);
        notes.push(
          totW > 0
            ? `Total withholding: ${fmt$(totW)} (${fmtPct(pctTot)} of distribution).`
            : `No withholding on this draw — taxes covered by another draw.`
        );
        notes.push('Withholding is credited pro-rata on all four due dates, so even a December draw satisfies the whole year retroactively. ' + seeAlso('IRC 6654(g)'));
        if (optimizerNote) notes.push(optimizerNote);
        if (stateIraExempt) {
          notes.push(`${stateInfo.name}: IRA distributions are exempt from state tax — no state withholding applied. State tax covered by quarterly estimates.`);
        } else if (stateInfo.withholdingCreditedProRata) {
          notes.push(`${stateInfo.name} similarly credits IRA withholding as if paid pro-rata throughout the year.`);
        }
        if (ag.month < 12) {
          notes.push(`Taking this draw in ${MONTH_NAMES[ag.month-1]} is earlier than December — see the two-plan comparison to quantify the opportunity cost.`);
        } else {
          notes.push('Taking this draw in December maximises IRA tax-deferred growth through the year.');
        }
        if (iRmd > 0) {
          notes.push(
            ira.sameMonth
              ? `Same month as the conversion: complete the draw by the ${ira.planARmdDay}th, conversion follows on the ${ira.planAConvDay}th. ` + seeAlso('RMD ordering')
              : `RMD must be completed by December 31.`
          );
        }

        addAction({
          type: iRmd > 0 ? T.RMD : T.IRA_VOL,
          iraNum,
          date: rmdDate,
          amount: ag.total,
          federalWithholding: iraFedW,
          stateWithholding:   iraStW,
          description:
            `Withdraw ${drawLabel} on ${rmdDateStr}. ` +
            (totW > 0
              ? `Withhold ${fmt$(iraFedW)} federal (${fmtPct(pctFed)})` +
                (iraStW > 0 ? ` and ${fmt$(iraStW)} ${stateInfo.name} (${fmtPct(pctSt)})` : '') +
                `. Net deposited: ${fmt$(net)}.`
              : `No withholding — taxes covered by other draws. Net deposited: ${fmt$(net)}.`),
          notes,
        });
      }

      // ── Shortfall quarterly estimates ──────────────────────────────────────
      // EVERY plan must pay the whole liability. The _baseline and _planC variants are not
      // internal scratch work: they are rendered as the displayed Plan C and Plan A, complete
      // action lists a user is meant to follow. They used to skip this block so that
      // summary.totalCovered would equal withholding alone and an old invariant test could
      // read the gap off it. That test convenience made two of the three displayed plans
      // silently underpay: 25k of draws and a 10k conversion against a 72k liability produced
      // 35k of withholding and no estimates at all.
      //
      // The gap is reported through summary.iraWithholdingUsed and summary.shortfall instead,
      // which is where it belonged. summary.totalCovered now means what it says: everything
      // the plan actually pays.
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

        // Late-year conversion + residual shortfall → Schedule AI is the alternative lever.
        // Narrative only; this planner does not compute the annualized penalty.
        const latestConvMonth = Math.max(
          p.ira1RothConversion > 0 ? ira1.planAConvMonth : 0,
          p.ira2RothConversion > 0 ? ira2.planAConvMonth : 0,
        );
        if (latestConvMonth >= 7) {
          addAction({
            type: T.NOTE,
            description:
              `Your conversion lands in ${MONTH_NAMES[latestConvMonth-1]}, and ${fmt$(shortfall)} is still ` +
              `unpaid. Quarterly estimates are dated when you pay them, so a late payment does not fix an ` +
              `earlier quarter. Two levers can: withholding, which is credited across all four due dates ` +
              `[IRC 6654(g)], or Form 2210 Schedule AI.`,
            notes: [
              'Schedule AI (the annualized income installment method) recomputes each quarter from the income you actually had by that point, so a Q3 or Q4 conversion is charged to the quarter it arose in instead of being spread back over the whole year.',
              'Cost of using it: an extra form with your return, and quarter-by-quarter records of income, deductions, and withholding for the year. It changes only the penalty computation, not the tax you owe.',
              'This planner does not compute the Schedule AI result. It is listed so you can weigh it against withholding rather than assuming quarterly estimates are your only option.',
            ],
          });
        }

        const sfFedAmts = splitExact(sfFed, FED_Q.map(q => q.w));
        FED_Q.forEach((q, qi) => {
          const amt = sfFedAmts[qi];
          if (amt === 0) return;
          const d      = dueDateFor(q, yr);
          const isPast = d.dueDate < today;
          addAction({
            type: T.Q_FED,
            date: d.date,
            amount: amt,
            federalWithholding: amt,
            noPenalty: fedTimelyByWithholding,
            description:
              `Pay federal estimated tax of ${fmt$(amt)} by ${fmtDate(d.date.year, d.date.month, d.date.day)} ` +
              `(${q.label} — ${fmtPct(q.w)} of ${fmt$(sfFed)} federal shortfall).` +
              (isPast ? (fedTimelyByWithholding ? ' [DATE PASSED]' : ' [PAST DUE — pay immediately]') : ''),
            notes: [
              'Pay via IRS Direct Pay at directpay.irs.gov or EFTPS at eftps.gov.',
              shiftNote(d),
              // "Pay now to minimise the penalty" is only true if a penalty is actually accruing.
              // When federal withholding already clears every installment by itself, this money is
              // still owed but it is not late in the IRC 6654 sense, and saying otherwise invents
              // urgency the numbers do not support.
              isPast
                ? (fedTimelyByWithholding
                    ? 'This date has passed, but your federal withholding covers every installment on its own, so paying this late does not create an underpayment penalty. It is still owed.'
                    : 'This installment is past due. Make a catch-up payment now to minimise underpayment penalty.')
                : '',
            ].filter(Boolean),
          });
        });

        if (sfState > 0 && stateInfo.hasIncomeTax && stateInfo.quarterlySchedule.length > 0) {
          const sfStAmts = splitExact(sfState, stateInfo.quarterlySchedule.map(q => q.w));
          stateInfo.quarterlySchedule.forEach((q, qi) => {
            const amt = sfStAmts[qi];
            if (amt === 0) return;
            const d      = dueDateFor(q, yr);
            const isPast = d.dueDate < today;
            addAction({
              type: T.Q_STATE,
              date: d.date,
              amount: amt,
              stateWithholding: amt,
              noPenalty: stateTimelyByWithholding,
              description:
                `Pay ${stateInfo.name} estimated tax of ${fmt$(amt)} by ` +
                `${fmtDate(d.date.year, d.date.month, d.date.day)} ` +
                `(${q.label} — ${fmtPct(q.w)} of ${fmt$(sfState)} ${stateInfo.name} shortfall).` +
                (isPast ? (stateTimelyByWithholding ? ' [DATE PASSED]' : ' [PAST DUE — pay immediately]') : ''),
              notes: [
                stateInfo.paymentNote,
                shiftNote(d),
                isPast
                  ? (stateTimelyByWithholding
                      ? `This date has passed, but your ${stateInfo.name} withholding covers every installment on its own, so paying this late does not create an underpayment penalty. It is still owed.`
                      : 'This installment is past due. Pay now to minimise the underpayment penalty.')
                  : '',
              ].filter(Boolean),
            });
          });
        }
      }

    } else {
      // ── All quarterly (no IRA withholding) ──────────────────────────────────
      const fedAmts = splitExact(p.federalTax, FED_Q.map(q => q.w));
      FED_Q.forEach((q, qi) => {
        const amt = fedAmts[qi];
        if (amt === 0) return;
        const d      = dueDateFor(q, yr);
        const isPast = d.dueDate < today;
        addAction({
          type: T.Q_FED,
          date: d.date,
          amount: amt,
          federalWithholding: amt,
          description:
            `Pay federal estimated tax of ${fmt$(amt)} by ${fmtDate(d.date.year, d.date.month, d.date.day)} ` +
            `(${q.label} — ${fmtPct(q.w)} of ${fmt$(p.federalTax)} federal tax).` +
            (isPast ? ' [PAST DUE — pay immediately]' : ''),
          notes: [
            'Pay via IRS Direct Pay at directpay.irs.gov or EFTPS at eftps.gov.',
            shiftNote(d),
            isPast ? 'This installment is past due. Make a catch-up payment immediately.' : '',
          ].filter(Boolean),
        });
      });

      if (stateInfo.hasIncomeTax && stateInfo.quarterlySchedule.length > 0 && p.stateTax > 0) {
        const stAmts = splitExact(p.stateTax, stateInfo.quarterlySchedule.map(q => q.w));
        stateInfo.quarterlySchedule.forEach((q, qi) => {
          const amt = stAmts[qi];
          if (amt === 0) return;
          const d      = dueDateFor(q, yr);
          const isPast = d.dueDate < today;
          addAction({
            type: T.Q_STATE,
            date: d.date,
            amount: amt,
            stateWithholding: amt,
            description:
              `Pay ${stateInfo.name} estimated tax of ${fmt$(amt)} by ` +
              `${fmtDate(d.date.year, d.date.month, d.date.day)} ` +
              `(${q.label} — ${fmtPct(q.w)} of ${fmt$(p.stateTax)} ${stateInfo.name} tax).` +
              (isPast ? ' [PAST DUE — pay immediately]' : ''),
            notes: [
              stateInfo.paymentNote,
              shiftNote(d),
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
      shortfall:           strategy === 'all_quarterly' ? 0 : shortfall,
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
      ira1: { rmdMonth: ira1.origRmdMonth, planARmdMonth: ira1.planARmdMonth, convMonth: ira1.planAConvMonth, hasConflict: ira1.hasConflict, withheld: ira1Withheld, replacement: ira1Replacement, doWithhold: doWithhold1 },
      ira2: { rmdMonth: ira2.origRmdMonth, planARmdMonth: ira2.planARmdMonth, convMonth: ira2.planAConvMonth, hasConflict: ira2.hasConflict, withheld: ira2Withheld, replacement: ira2Replacement, doWithhold: doWithhold2 },
      todayDate: today,
      coverageSummary,
    };

    // 16. Early-vs-December timing comparison.
    //     Plan B (December baseline) and Plan C (early conv + December draws).
    //     Guard with both _baseline and _planC to prevent infinite recursion.
    const hasAnyConversion = p.ira1RothConversion > 0 || p.ira2RothConversion > 0;
    // The timing lever is NOT conversion-specific. Any draw that has not been taken yet can be
    // deferred to December, keeping its net proceeds tax-deferred longer, so the Early-vs-December
    // comparison is meaningful with zero conversions too. Already-taken draws are locked to their
    // actual month and offer no choice, so they do not trigger the comparison on their own.
    const hasDeferrableDraw =
      (p.ira1Rmd       > 0 && !p.ira1RmdTaken) ||
      (p.ira1Voluntary > 0 && !p.ira1VolTaken) ||
      (p.ira2Rmd       > 0 && !p.ira2RmdTaken) ||
      (p.ira2Voluntary > 0 && !p.ira2VolTaken);
    let planB = null;
    let planC = null;
    let convComparison = null;
    if ((hasAnyConversion || hasDeferrableDraw) && !p._baseline && !isPlanC) {
      // December baseline — always the far end of the timing lever.
      planB = computePaymentPlan(Object.assign({}, p, { _baseline: true }));
      // The hybrid (early conversions, December draws) only differs from the December baseline when
      // there are conversions to pull early. With none it is identical, so skip it rather than show
      // a duplicate Plan A column.
      if (hasAnyConversion) planC = computePaymentPlan(Object.assign({}, p, { _planC: true }));
      // buildConvComparison(p, ira1, ira2, ewm, totalIraWithheld, planC_obj, planA_obj, _unused)
      // planC_obj = _baseline computation → displayed as Plan C (December baseline)
      // planA_obj = _planC computation    → displayed as Plan A (hybrid), null when no conversion
      convComparison = buildConvComparison(p, ira1, ira2, effectiveWithholdMonth,
                         totalIraDrawWithheld, planB, planC, null);
    }

    return {
      params:   p,
      strategy,
      actions,
      analysis,
      summary,
      stateInfo,
      planB,
      planC,
      convComparison,
      text: buildText(p, actions, summary, analysis, yr, stateInfo, planB, planC, convComparison),
      html: buildHtml(p, actions, summary, analysis, yr, stateInfo, planB, planC, convComparison),
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

  // ── Three-plan conversion comparison (aggregate across both IRAs) ──────────
  // New plan letter convention:
  //   Plan A = hybrid  (early conversions + December draws)   ← _planC flag
  //   Plan B = early   (early conversions + early draws)      ← no flag (main computation)
  //   Plan C = December baseline (everything in December)      ← _baseline flag
  function buildConvComparison(p, ira1, ira2, effectiveWithholdMonth, totalIraWithheld,
                                planC_obj, planA_obj, planB_oc_unused) {
    // Note: parameter names use old convention from call site; we remap inside:
    //   planC_obj = the object computed with _baseline:true  → displayed as Plan C
    //   planA_obj = the object computed with _planC:true     → displayed as Plan A
    const r = p.portfolioRate;

    // Earliest conversion month across IRAs (Plans A and B use same timing)
    const earliestConvMonth = Math.min(
      p.ira1RothConversion > 0 ? ira1.planAConvMonth : 12,
      p.ira2RothConversion > 0 ? ira2.planAConvMonth : 12,
    );

    // ── Plan B (early everything) components ─────────────────────────────────
    // Roth growth: conversion happens in nextMonth for Plans A and B
    let planB_rothGrowth = 0;
    if (p.ira1RothConversion > 0) planB_rothGrowth += p.ira1RothConversion * r * (12 - ira1.planAConvMonth) / 12;
    if (p.ira2RothConversion > 0) planB_rothGrowth += p.ira2RothConversion * r * (12 - ira2.planAConvMonth) / 12;

    // Withholding OC: draw withholding leaves IRA early (Plan B draws happen in nextMonth)
    const monthsDrawEarly = 12 - effectiveWithholdMonth;
    const planB_withholdOC = totalIraWithheld * r * monthsDrawEarly / 12;

    // Draw deferral lost (Plan B): draws happen early, so net after-tax proceeds are out
    // of the IRA sooner, earning taxably rather than tax-deferred
    const allDraws = p.ira1Rmd + p.ira1Voluntary + p.ira2Rmd + p.ira2Voluntary;
    const approxWithholdPct = allDraws > 0 ? Math.min(1, totalIraWithheld / allDraws) : 0;
    let planB_drawDeferral = 0;
    if (p.ira1Rmd > 0) {
      planB_drawDeferral += p.ira1Rmd * (1 - approxWithholdPct) * r * p.marginalOrdRate * (12 - ira1.planARmdMonth) / 12;
    }
    if (p.ira2Rmd > 0) {
      planB_drawDeferral += p.ira2Rmd * (1 - approxWithholdPct) * r * p.marginalOrdRate * (12 - ira2.planARmdMonth) / 12;
    }

    // Plan B net advantage vs Plan C baseline (higher = better)
    const planB_netVsC = planB_rothGrowth - planB_withholdOC - planB_drawDeferral;

    // ── Plan A (hybrid) components ────────────────────────────────────────────
    // Same Roth growth as Plan B (same conversion timing); draws deferred to December
    const planA_rothGrowth = planB_rothGrowth;

    // Withhold OC: only from minimum conversion withholding (usually 0 when draws suffice)
    let planA_withholdOC = 0;
    if (planA_obj) {
      const cs = planA_obj.summary.coverageSummary;
      const convW = cs.conversion.fed + cs.conversion.state;
      planA_withholdOC = convW > 0 ? convW * r * (12 - earliestConvMonth) / 12 : 0;
    }

    // Draw deferral: only forced-early RMDs (same-IRA ordering rule); voluntary always stays December
    let planA_drawDeferral = 0;
    if (planA_obj) {
      const approxW = allDraws > 0 ? Math.min(1, totalIraWithheld / allDraws) : 0;
      if (p.ira1Rmd > 0 && p.ira1RothConversion > 0) {
        const rmd1Month = planA_obj.summary.ira1.planARmdMonth;
        planA_drawDeferral += p.ira1Rmd * (1 - approxW) * r * p.marginalOrdRate * (12 - rmd1Month) / 12;
      }
      if (p.ira2Rmd > 0 && p.ira2RothConversion > 0) {
        const rmd2Month = planA_obj.summary.ira2.planARmdMonth;
        planA_drawDeferral += p.ira2Rmd * (1 - approxW) * r * p.marginalOrdRate * (12 - rmd2Month) / 12;
      }
    }

    // Plan A net advantage vs Plan C baseline
    const planA_netVsC = planA_obj ? planA_rothGrowth - planA_withholdOC - planA_drawDeferral : null;

    // ── Best plan: highest net advantage vs Plan C (baseline = 0) ────────────
    const netValues = [
      { label: 'A', net: planA_netVsC !== null ? planA_netVsC : -Infinity },
      { label: 'B', net: planB_netVsC },
      { label: 'C', net: 0 },
    ];
    const bestNet  = Math.max(...netValues.map(x => x.net));
    const bestPlan = netValues.find(x => x.net === bestNet)?.label;

    const hasConv = p.ira1RothConversion > 0 || p.ira2RothConversion > 0;

    return {
      hasConversion: hasConv,
      planALabel: `Plan A — Hybrid: early conversion(s) (${MONTH_NAMES[earliestConvMonth-1]}), December draws`,
      planBLabel: hasConv
        ? `Plan B — Early everything: conversions and draws in ${MONTH_NAMES[effectiveWithholdMonth-1]}`
        : `Plan B — Early draws: all draws in ${MONTH_NAMES[effectiveWithholdMonth-1]}`,
      planCLabel: hasConv
        ? `Plan C — December baseline: all draws and conversions in December`
        : `Plan C — December: all draws deferred to December`,
      // Plan A (hybrid) components
      planA_rothGrowth,
      planA_withholdOC,
      planA_drawDeferral,
      planA_netVsC,
      // Plan B (early) components
      planB_rothGrowth,
      planB_withholdOC,
      planB_drawDeferral,
      planB_netVsC,
      // Winner
      bestPlan,
      earliestConvMonth,
      monthsDrawEarly,
    };
  }

  // ── Plain text output ─────────────────────────────────────────────────────
  function buildText(p, actions, summary, analysis, yr, stateInfo, planB, planC, convComparison) {
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
      const cc = convComparison;
      const fmtNetTxt = v => v === null || v === undefined ? 'n/a'
        : v === 0 ? '$0 (baseline)'
        : (v > 0 ? '+' : '−') + fmt$(Math.abs(v));
      lines.push('');
      if (cc.hasConversion) {
        lines.push('ROTH CONVERSION — THREE-PLAN COMPARISON');
        lines.push(hr);
        lines.push(`  ${cc.planALabel}`);
        lines.push(`  ${cc.planBLabel}`);
        lines.push(`  ${cc.planCLabel}`);
        lines.push('');
        lines.push(`  Component             Plan A (hybrid)   Plan B (early)   Plan C (Dec)`);
        lines.push(`  Roth growth          +${fmt$(cc.planA_rothGrowth).padStart(10)}   +${fmt$(cc.planB_rothGrowth).padStart(10)}          $0`);
        lines.push(`  Withhold OC          -${fmt$(cc.planA_withholdOC).padStart(10)}   -${fmt$(cc.planB_withholdOC).padStart(10)}          $0`);
        lines.push(`  Draw deferral        -${fmt$(cc.planA_drawDeferral).padStart(10)}   -${fmt$(cc.planB_drawDeferral).padStart(10)}          $0`);
        lines.push(`  ${'─'.repeat(66)}`);
        lines.push(`  Net adv. vs Plan C   ${fmtNetTxt(cc.planA_netVsC).padStart(14)}   ${fmtNetTxt(cc.planB_netVsC).padStart(14)}   $0 (baseline)   ← ${cc.bestPlan ? 'Plan ' + cc.bestPlan + ' WINS' : ''}`);
        lines.push('');
        lines.push('  NOTE: First-year only. Early conversion provides compounding Roth');
        lines.push('  growth for every subsequent year — long-term benefit grows beyond what is shown.');
      } else {
        // Draw-only: no conversion to pull early, so the hybrid plan does not exist. Two plans —
        // early draws (Plan B) vs draws deferred to December (Plan C baseline).
        lines.push('DRAW TIMING — EARLY vs DECEMBER');
        lines.push(hr);
        lines.push(`  ${cc.planBLabel}`);
        lines.push(`  ${cc.planCLabel}`);
        lines.push('');
        lines.push(`  Component             Plan B (early)   Plan C (Dec)`);
        lines.push(`  Withhold OC          -${fmt$(cc.planB_withholdOC).padStart(10)}          $0`);
        lines.push(`  Draw deferral        -${fmt$(cc.planB_drawDeferral).padStart(10)}          $0`);
        lines.push(`  ${'─'.repeat(52)}`);
        lines.push(`  Net adv. vs Plan C   ${fmtNetTxt(cc.planB_netVsC).padStart(14)}   $0 (baseline)   ← ${cc.bestPlan ? 'Plan ' + cc.bestPlan + ' WINS' : ''}`);
        lines.push('');
        lines.push('  Deferring a not-yet-taken draw to December keeps its net proceeds tax-deferred');
        lines.push('  longer. Only draws you can freely postpone count here (an RMD is required either');
        lines.push('  way; a voluntary draw you need for spending is not free to move).');
      }
    }

    const renderActions = acts => acts.forEach(a => {
      if (a.type === T.ALERT) {
        lines.push(`  !!! ${a.description}`);
        a.notes.forEach(n => lines.push(`      • ${n}`));
      } else if (a.type === T.NOTE) {
        lines.push(`   -- ${a.description}`);
        // These bullets used to be dropped. T.NOTE was the only action type whose `notes` never
        // rendered, in either output, so the QCD alternative and the RMD-conversion eligibility
        // line had never once reached a reader.
        a.notes.forEach(n => lines.push(`      • ${n}`));
      } else {
        lines.push(`${String(a.seq).padStart(2)} . ${a.description}`);
        a.notes.forEach(n => lines.push(`       • ${n}`));
      }
      lines.push('');
    });

    // Render order: Plan A (hybrid) first, Plan B (early) second, Plan C (December) third.
    // Plan A only exists when there is a conversion to pull early (planC object present).
    if (planB || planC) {
      const hasConv = convComparison ? convComparison.hasConversion : (planC != null);
      lines.push('');
      if (planC) {
        lines.push('PLAN A — HYBRID (EARLY CONVERSION + DECEMBER DRAWS)');
        lines.push(hr);
        renderActions(planC.actions);
      }

      lines.push(hasConv ? 'PLAN B — EARLY EVERYTHING' : 'PLAN B — EARLY DRAWS');
      lines.push(hr);
      renderActions(actions);

      lines.push(hasConv ? 'PLAN C — DECEMBER BASELINE' : 'PLAN C — DECEMBER (DRAWS DEFERRED)');
      lines.push(hr);
      if (planB) renderActions(planB.actions);
    } else {
      lines.push('');
      lines.push('ACTION PLAN');
      lines.push(hr);
      renderActions(actions);
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

    lines.push('');
    lines.push('RULES AND SOURCES');
    lines.push(hr);
    RULE_CITES.forEach(c => {
      lines.push(`  [${c.tag}] ${c.label}`);
      lines.push(`      ${c.cite}`);
      lines.push(`      ${c.url}`);
      if (c.long) lines.push(`      ${c.long}`);
      if (c.note) lines.push(`      ${c.note}`);
      lines.push('');
    });
    // Same panel, separate heading: these are arguments and mechanics, not authorities.
    lines.push('  CONCEPTS');
    lines.push('');
    CONCEPT_NOTES.forEach(c => {
      lines.push(`  [${c.tag}] ${c.label}`);
      lines.push(`      ${c.long}`);
      lines.push('');
    });
    lines.push('  SCHEDULING: every date above is moved off Saturdays, Sundays, New Year\'s Day,');
    lines.push('  and Christmas Day. The other federal holidays are not tracked, so a date can still');
    lines.push('  land on Thanksgiving, July 4, or Memorial Day. Confirm the date with your custodian.');
    lines.push('');

    return lines.join('\n');
  }

  // ── HTML output ───────────────────────────────────────────────────────────
  function buildHtml(p, actions, summary, analysis, yr, stateInfo, planB, planC, convComparison) {
    const typeIcon = {
      [T.ROTH_CONV]:    '🔄', [T.RMD]: '🏦', [T.IRA_VOL]: '🏦',
      [T.SUPPL_IRA]:    '🏦', [T.CASH_RESTORE]: '💵',
      [T.Q_FED]: '🇺🇸', [T.Q_STATE]: '📋',
      [T.SS_WHOLD]:  '📌', [T.NOTE]: 'ℹ️', [T.ALERT]: '⚠️',
    };
    const typeColor = {
      [T.ROTH_CONV]:    '#4A90D9', [T.RMD]: '#2E75B6', [T.IRA_VOL]: '#2E75B6',
      [T.SUPPL_IRA]:    '#2E75B6', [T.CASH_RESTORE]: '#00796B',
      [T.Q_FED]: '#C9360C', [T.Q_STATE]: '#9C4A00',
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

    // Conversion present? Drives whether the timing comparison shows the Roth-specific Plan A
    // (hybrid) and the Roth growth row, or reads as a plain Early-vs-December draw comparison.
    const hasConv = p.ira1RothConversion > 0 || p.ira2RothConversion > 0;

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

    // ── Timing comparison ──────────────────────────────────────────────────
    // With a conversion: three plans (A hybrid / B early / C December baseline).
    // Draw-only: no conversion to pull early, so Plan A (hybrid) does not exist — the
    // Plan A column, its pill, and the Roth-growth row are all dropped and it reads as a
    // plain Early-vs-December draw comparison.
    if (convComparison) {
      const cc = convComparison;
      const showA = !!planC;   // Plan A (hybrid) only when there is a conversion
      const planAColor = '#1565C0';   // blue  — Plan A (hybrid, often best)
      const planBColor = '#1B5E20';   // green — Plan B (early everything)
      const planCColor = '#6A1B9A';   // purple — Plan C (December baseline)
      h += `<div style="margin:12px 0;border:2px solid #1F4E79;border-radius:6px;overflow:hidden;">`;
      h += `<div style="background:#1F4E79;color:#fff;padding:10px 16px;font-weight:700;font-size:0.95em;">⚖️ ${
        hasConv ? 'Roth Conversion Timing — Three-Plan Comparison'
                : 'Draw Timing — Early vs. December'}</div>`;
      h += `<div style="padding:12px 16px;background:#F8FAFF;">`;

      // Plan label pills — A first (hybrid, often best), shown only when a conversion exists
      h += `<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">`;
      if (showA) {
        h += `<div style="flex:1;min-width:180px;background:#E3F2FD;border:1px solid #90CAF9;border-radius:5px;padding:9px 12px;">`;
        h += `<div style="font-weight:700;color:${planAColor};font-size:0.86em;margin-bottom:3px;">📅 Plan A — Hybrid (often best)</div>`;
        h += `<div style="font-size:0.80em;color:#444;">Conversions early (${MONTH_NAMES[cc.earliestConvMonth-1]}), draws in December. Tax certainty before setting withholding.</div>`;
        h += `</div>`;
      }
      h += `<div style="flex:1;min-width:180px;background:#E8F5E9;border:1px solid #A5D6A7;border-radius:5px;padding:9px 12px;">`;
      h += `<div style="font-weight:700;color:${planBColor};font-size:0.86em;margin-bottom:3px;">📅 Plan B — Early ${hasConv ? 'everything' : 'draws'}</div>`;
      h += `<div style="font-size:0.80em;color:#444;">${
        hasConv ? `Conversions &amp; draws in ${MONTH_NAMES[summary.effectiveWithholdMonth-1]}. Withholding from draws; no 60-day rollover.`
                : `All draws in ${MONTH_NAMES[summary.effectiveWithholdMonth-1]}. Withholding taken from those draws.`}</div>`;
      h += `</div>`;
      h += `<div style="flex:1;min-width:180px;background:#F3E5F5;border:1px solid #CE93D8;border-radius:5px;padding:9px 12px;">`;
      h += `<div style="font-weight:700;color:${planCColor};font-size:0.86em;margin-bottom:3px;">📅 Plan C — December ${hasConv ? 'baseline' : ''}</div>`;
      h += `<div style="font-size:0.80em;color:#444;">${
        hasConv ? 'All draws &amp; conversions in December. Maximum IRA tax-deferred growth; no early Roth growth.'
                : 'All draws deferred to December. Maximum IRA tax-deferred growth.'}</div>`;
      h += `</div></div>`;

      // Comparison table — columns: [Plan A] | Plan B | Plan C. Plan A column present only with a conversion.
      const winBg = '#E8F5E9', nearBg = '#FFFDE7', loseBg = '#fff';
      // Winner = highest net advantage vs Plan C baseline (higher = better)
      const _allNets = [
        showA && cc.planA_netVsC !== null ? cc.planA_netVsC : -Infinity,
        cc.planB_netVsC,
        0,
      ];
      const bestNet  = Math.max(..._allNets);
      const isWinner = v => v !== null && v !== undefined && Math.abs(v - bestNet) < 1;
      const isNear   = v => v !== null && v !== undefined && !isWinner(v) && bestNet > 0 && v > bestNet * 0.95;
      const cellBg   = v => isWinner(v) ? winBg : isNear(v) ? nearBg : loseBg;
      const winStar  = v => isWinner(v) ? ' ★' : '';

      h += `<table style="width:100%;border-collapse:collapse;font-size:0.86em;margin-bottom:10px;">`;
      h += `<thead><tr style="background:#E3F2FD;">`;
      h += `<th style="padding:7px 10px;text-align:left;color:#1F4E79;font-weight:600;">Component (first-year advantage vs. Plan C baseline)</th>`;
      if (showA) h += `<th style="padding:7px 10px;text-align:right;color:${planAColor};font-weight:700;">Plan A</th>`;
      h += `<th style="padding:7px 10px;text-align:right;color:${planBColor};font-weight:700;">Plan B</th>`;
      h += `<th style="padding:7px 10px;text-align:right;color:${planCColor};font-weight:700;">Plan C</th>`;
      h += `</tr></thead><tbody>`;

      // compRow: aVal=Plan A (hybrid), bVal=Plan B (early), cVal=Plan C (Dec=0 baseline).
      // The Plan A cell is omitted entirely when there is no conversion.
      const compRow = (label, aVal, bVal, cVal, isGood, note) => {
        const fmtCell = (v, isPos) => {
          if (v === null || v === undefined) return '—';
          const sign = isPos ? (isGood ? '+' : '−') : (isGood ? '−' : '+');
          const col  = isPos ? (isGood ? '#1B5E20' : '#C62828') : (isGood ? '#C62828' : '#1B5E20');
          return `<span style="color:${col};font-weight:600;">${v > 0.5 ? sign : ''}${fmt$(Math.abs(v))}</span>`;
        };
        h += `<tr style="border-bottom:1px solid #eee;">`;
        h += `<td style="padding:6px 10px;">${label}${note ? ` <span style="color:#888;font-size:0.88em;">${note}</span>` : ''}</td>`;
        if (showA) h += `<td style="padding:6px 10px;text-align:right;">${fmtCell(aVal, true)}</td>`;
        h += `<td style="padding:6px 10px;text-align:right;">${fmtCell(bVal, true)}</td>`;
        h += `<td style="padding:6px 10px;text-align:right;">${fmtCell(cVal, false)}</td>`;
        h += `</tr>`;
      };

      // Roth growth only applies when there is a conversion to grow — hidden in the draw-only case.
      if (hasConv) {
        compRow('Roth tax-free growth',
          cc.planA_rothGrowth, cc.planB_rothGrowth, 0, true,
          `(${MONTH_NAMES[cc.earliestConvMonth-1]} conv × rate)`);
      }
      compRow('Withholding OC paid',
        cc.planA_withholdOC, cc.planB_withholdOC, 0, false,
        cc.planB_withholdOC > 0.5 ? `(${cc.monthsDrawEarly} mo. early for Plan B)` : '');
      compRow('Draw deferral lost',
        cc.planA_drawDeferral, cc.planB_drawDeferral, 0, false,
        cc.planB_drawDeferral > 0.5 ? '(Plan B early draws)' : '');

      // Net advantage vs Plan C baseline row — higher is better
      const fmtNet = v => v === null || v === undefined ? '—'
        : v === 0 ? '$0 (baseline)'
        : (v > 0 ? '+' : '−') + fmt$(Math.abs(v));
      const netCells = showA
        ? [[cc.planA_netVsC, planAColor],[cc.planB_netVsC, planBColor],[0, planCColor]]
        : [[cc.planB_netVsC, planBColor],[0, planCColor]];
      h += `<tr style="border-top:2px solid #1F4E79;">`;
      h += `<td style="padding:8px 10px;font-weight:700;">Net advantage vs Plan C <span style="font-weight:400;color:#777;font-size:0.9em;">(higher = better)</span></td>`;
      for (const [nv, col] of netCells) {
        const bg = cellBg(nv);
        h += `<td style="padding:8px 10px;text-align:right;background:${bg};font-weight:700;color:${col};">`;
        h += `${fmtNet(nv)}${winStar(nv)}</td>`;
      }
      h += `</tr>`;

      h += `</tbody></table>`;

      h += `<div style="font-size:0.81em;color:#555;border-top:1px solid #ddd;padding-top:8px;">`;
      h += hasConv
        ? `⚠️ <strong>First-year only.</strong> Early conversion provides compounding Roth growth every subsequent year — the long-term advantage of Plans A and B over Plan C grows with time. `
        : `Deferring a not-yet-taken draw to December keeps its net proceeds tax-deferred longer. Only draws you can freely postpone count — an RMD is required either way, a voluntary draw you need for spending is not free to move. `;
      h += `★ = highest first-year net advantage vs Plan C baseline.`;
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
          // Green "Calendar Notice" vs red "MISSED PAYMENT WARNING" used to be chosen from the
          // STRATEGY — any plan using IRA withholding got the green treatment. That painted a
          // reassuring box around text saying the withholding falls short and a penalty accrues.
          // The action now carries `benign`, set only where the coverage was actually checked.
          const html = `${icon} <strong>${a.benign ? 'Calendar Notice' : 'MISSED PAYMENT WARNING'}:</strong> ${a.description}`;
          h += a.benign ? good(html) : alert(html);
          if (a.notes.length > 0) {
            h += `<ul style="margin:0 0 8px 28px;padding:0;font-size:0.86em;color:#555;">`;
            a.notes.forEach(n => { h += `<li style="margin-bottom:3px;">${n}</li>`; });
            h += `</ul>`;
          }
          return;
        }
        if (isNote) {
          h += info(`<strong>Note:</strong> ${a.description}`);
          // This branch used to `return` before the bullet loop that every other action type gets,
          // which meant T.NOTE was the one type whose `notes` never rendered in either output. The
          // QCD alternative had therefore never reached a reader. Styled to match the alert bullets
          // above rather than the per-step ones, since a note is not a numbered step.
          if (a.notes.length > 0) {
            h += `<ul style="margin:0 0 8px 28px;padding:0;font-size:0.86em;color:#555;">`;
            a.notes.forEach(n => { h += `<li style="margin-bottom:3px;">${n}</li>`; });
            h += `</ul>`;
          }
          return;
        }

        stepNum++;
        // An elapsed date on a schedule that withholding already covers is owed, but not late in
        // the IRC 6654 sense, so it gets a neutral grey badge and no red border. Only a genuine
        // underpayment gets the alarm.
        const lateBadge = isPast && !a.noPenalty;
        const pastBadge = !isPast ? ''
          : lateBadge
            ? `<span style="background:#CC0000;color:#fff;font-size:0.72em;padding:1px 6px;border-radius:3px;margin-left:8px;vertical-align:middle;">PAST DUE</span>`
            : `<span style="background:#777;color:#fff;font-size:0.72em;padding:1px 6px;border-radius:3px;margin-left:8px;vertical-align:middle;" title="This date has passed, but your withholding covers this schedule, so no underpayment penalty arises.">DATE PASSED</span>`;

        h += `<div style="border:1px solid #ddd;border-left:4px solid ${color};border-radius:0 4px 4px 0;margin:0 0 8px 0;padding:10px 14px;background:#fff;${lateBadge ? 'border-color:#CC0000;' : ''}">`;
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

    const planBtnStyle = `background:rgba(255,255,255,0.18);color:#fff;border:1px solid rgba(255,255,255,0.5);` +
      `border-radius:4px;padding:3px 10px;font-size:0.8em;cursor:pointer;margin-left:6px;font-weight:600;`;

    const makePlanSection = (id, winLetter, winColor, defaultColor, title, subtitle, actList, actSummary) => {
      const cc   = convComparison;
      const wins = cc?.bestPlan === winLetter;
      const bdr  = wins ? '#1B5E20' : defaultColor;
      h += `<div id="${id}" style="border:2px solid ${bdr};border-radius:6px;margin-bottom:16px;overflow:hidden;">`;
      h += `<div style="background:${bdr};color:#fff;padding:8px 16px;font-weight:700;display:flex;justify-content:space-between;align-items:center;">`;
      h += `<span>${title}`;
      if (cc) h += ` &nbsp;<span style="font-weight:400;font-size:0.88em;">(${wins ? '★ highest first-year advantage' : subtitle})</span>`;
      h += `</span>`;
      h += `<span class="plan-action-btns" style="white-space:nowrap;">`;
      h += `<button style="${planBtnStyle}" onclick="downloadPlanIcs('${winLetter}')">📅 .ics</button>`;
      h += `<button style="${planBtnStyle}" onclick="printPlan('${winLetter}')">🖨️ Print</button>`;
      h += `</span></div>`;
      h += `<div style="padding:8px;">`;
      renderActionList(actList, actSummary);
      h += `</div></div>`;
    };

    if (planB || planC) {
      // Render order: Plan A (hybrid) → Plan B (early) → Plan C (December baseline)
      // Plan A = _planC computation (planC object); Plan B = main computation; Plan C = _baseline computation (planB object)
      if (planC) {
        makePlanSection('plan-section-a', 'A', '#1565C0', '#1565C0',
          '📅 Plan A — Hybrid: Early Conversion(s) + December Draws',
          'see comparison above', planC.actions, planC.summary);
      }
      makePlanSection('plan-section-b', 'B', '#1B5E20', '#2E75B6',
        hasConv
          ? '📅 Plan B — Early Everything: Conversion(s) + Draws in ' + MONTH_NAMES[summary.effectiveWithholdMonth - 1]
          : '📅 Plan B — Early Draws: All Draws in ' + MONTH_NAMES[summary.effectiveWithholdMonth - 1],
        'see comparison above', actions, summary);
      if (planB) {
        makePlanSection('plan-section-c', 'C', '#6A1B9A', '#6A1B9A',
          hasConv
            ? '📅 Plan C — December Baseline: All Draws and Conversions in December'
            : '📅 Plan C — December: All Draws Deferred to December',
          'see comparison above', planB.actions, planB.summary);
      }
    } else {
      h += `<h3 style="margin:16px 18px 8px;color:#1F4E79;font-size:1em;">Action Plan</h3>`;
      h += `<div style="padding:0 4px;">`;
      renderActionList(actions, summary);
      h += `</div>`;
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

    // ── Rules and sources ──────────────────────────────────────────────────
    h += `<details style="margin:12px 0;border:2px solid #1F4E79;border-radius:6px;overflow:hidden;">`;
    h += `<summary style="background:#1F4E79;color:#fff;padding:10px 16px;font-weight:700;font-size:0.95em;cursor:pointer;">📚 Rules and sources</summary>`;
    h += `<div style="padding:12px 16px;background:#F8FAFF;">`;
    h += `<table style="width:100%;border-collapse:collapse;font-size:0.84em;">`;
    RULE_CITES.forEach(c => {
      h += `<tr style="border-bottom:1px solid #E3F2FD;">`;
      h += `<td style="padding:8px 10px;vertical-align:top;white-space:nowrap;color:#1F4E79;font-weight:700;">[${c.tag}]</td>`;
      h += `<td style="padding:8px 10px;vertical-align:top;">`;
      h += `<div style="font-weight:600;color:#222;">${c.label}</div>`;
      h += `<div style="margin-top:2px;"><a href="${c.url}" target="_blank" rel="noopener">${c.cite}</a></div>`;
      if (c.long) h += `<div style="margin-top:3px;color:#333;">${c.long}</div>`;
      if (c.note) h += `<div style="margin-top:3px;color:#555;">${c.note}</div>`;
      h += `</td></tr>`;
    });
    h += `</table>`;
    // Same panel, separate heading: these are arguments and mechanics, not authorities, so they
    // carry no cite or link and must not look like they do.
    h += `<div style="font-weight:700;color:#1F4E79;margin:14px 0 4px;font-size:0.88em;">CONCEPTS</div>`;
    h += `<table style="width:100%;border-collapse:collapse;font-size:0.84em;">`;
    CONCEPT_NOTES.forEach(c => {
      h += `<tr style="border-bottom:1px solid #E3F2FD;">`;
      h += `<td style="padding:8px 10px;vertical-align:top;white-space:nowrap;color:#1F4E79;font-weight:700;">[${c.tag}]</td>`;
      h += `<td style="padding:8px 10px;vertical-align:top;">`;
      h += `<div style="font-weight:600;color:#222;">${c.label}</div>`;
      h += `<div style="margin-top:3px;color:#333;">${c.long}</div>`;
      h += `</td></tr>`;
    });
    h += `</table>`;
    h += `<div style="font-size:0.80em;color:#777;margin-top:10px;">`;
    h += `Tags in square brackets inside the action notes above point at these entries. `;
    h += `<br><strong>Scheduling:</strong> every date above is moved off Saturdays, Sundays, New Year's Day, and `;
    h += `Christmas Day. The other federal holidays are not tracked, so a date can still land on `;
    h += `Thanksgiving, July 4, or Memorial Day. Confirm the date with your custodian before you rely on it.`;
    h += `<br>This is a planning tool, not tax advice. Confirm anything consequential with your own preparer.`;
    h += `</div></div></details>`;

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
    ROLLOVER_DEADLINE_DAYS,
    RESTORE_TARGET_DAYS,
    ORDERING_BUFFER_DAYS,
    restoreDateFor,
    _withholdingCoversSchedule: withholdingCoversSchedule,
    OBSERVED_HOLIDAYS,
    isBusinessDay,
    nextBusinessDay,
    prevBusinessDay,
    firstMondayAfter,
    dueDateFor,
  };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaxPaymentPlanner;
} else if (typeof window !== 'undefined') {
  // A top-level `const` in a classic script lives in the global LEXICAL scope, which is not the
  // same thing as a property of window. The page itself reads the bare identifier and works
  // either way, but taxPaymentPlanner.tests.js has to resolve the engine without knowing how it
  // was loaded, so publish it explicitly.
  window.TaxPaymentPlanner = TaxPaymentPlanner;
}
