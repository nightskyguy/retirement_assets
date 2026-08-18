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
      tag:   'Form W-4R',
      label: 'You choose the withholding rate on an IRA distribution, anywhere from 0% to 100%',
      cite:  'IRS, About Form W-4R, Withholding Certificate for Nonperiodic Payments and Eligible Rollover Distributions',
      url:   'https://www.irs.gov/forms-pubs/about-form-w-4r',
      note:  'The default rate on a nonperiodic IRA distribution is 10%, but you may elect any rate from 0% to 100% in whole percentages.',
      long:  'This is what makes a December tax-holdback tranche possible: a distribution can be withheld at 100%, sending the entire gross amount to the IRS and the states that allow it. Combined with the pro-rata credit rule, a single December draw withheld at 100% can satisfy the whole year of installments. The election is made on Form W-4R with the custodian, and some custodians cap the rate they will accept online, so confirm before relying on it.',
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
      tag:  'Tax figures are inputs',
      label: 'Anything that raises your income after the plan is built is not in these numbers',
      long: 'The federal and state tax on this page was calculated elsewhere and handed to the planner, ' +
            'which decides only when to draw and when to pay. Any money you raise on top of the draws ' +
            'entered here sits outside that calculation. Selling shares from a taxable account realises a ' +
            'gain, and an extra IRA withdrawal is ordinary income. Either one lifts the bill above the ' +
            'figure every plan here is sized against, and the difference turns up as a balance due when ' +
            'you file. Where the prior-year safe harbor is the test protecting you, that extra tax is ' +
            'simply due in April. Where it is not, it can carry an underpayment charge as well. Recompute ' +
            'the tax figures if you take either step.',
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
      // P58. Withholding on a draw you have ALREADY TAKEN is a past fact, not a choice the planner
      // can make for you: you cannot elect withholding retroactively. Null means "not stated", and
      // the planner then assumes NOTHING was withheld, which overstates what you still owe rather
      // than understating it. Give the real figure here and it is credited exactly.
      ira1RmdWithheld:     null,
      ira1VolWithheld:     null,
      ira2RmdWithheld:     null,
      ira2VolWithheld:     null,
      // Same rule for a conversion already completed. The gap fill used to be able to elect
      // withholding on one, and because it sizes off the gap it could take the WHOLE conversion:
      // a $40,000 conversion marked done was assigned $40,000 of withholding, retroactively,
      // leaving nothing in the Roth.
      ira1ConvWithheld:    null,
      ira2ConvWithheld:    null,

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
      // P56 variant plumbing. Unset means the parent run, which carries Plan A semantics
      // (early draws, early conversions). Any run with _variant set is a CHILD: it renders no
      // text/html and spawns no siblings of its own.
      _variant:          null,        // null | 'A' | 'B' | 'C' | 'D' | 'Q'
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
    // The plan letters are the P56 matrix, NOT the old display lettering:
    //   A  early draws  + early conversions            (the parent computation)
    //   B  December draws + early conversions          (hybrid; was the _planC flag)
    //   C  December draws + December conversions       (late; was the _baseline flag)
    //   D  early spending draws + a December tax-holdback tranche
    //   Q  December draws + December conversions, taxes paid as quarterly estimates
    // "Early" is the first of NEXT month, always in the future, so there is no false urgency.
    // Already-taken/done actions use the 1st of the PREVIOUS month (or January if in Jan).
    const currentMonth = today.getMonth() + 1;                          // 1–12
    const isFutureYear = yr > today.getFullYear();
    const nextMonth    = isFutureYear ? 1 : Math.min(currentMonth + 1, 12);  // Jan for future years
    const prevMonth    = currentMonth > 1 ? currentMonth - 1 : 1;      // already-done target

    const variant = p._variant || 'A';      // unset parent runs with Plan A semantics
    const isChild = p._variant != null;     // children render nothing and spawn no siblings

    // Conversions: C and Q convert in December; A, B and D convert early.
    const convTargetMonth = (variant === 'C' || variant === 'Q') ? 12 : nextMonth;
    // Draws (RMD + voluntary): A and D draw early; B, C and Q defer to December. D's December
    // tax tranche is synthesized separately, so resolveIraOrdering still sees early months here
    // and the RMD-before-conversion invariant holds with no extra work.
    const drawTargetMonth = (variant === 'A' || variant === 'D') ? nextMonth : 12;
    // Q pays the whole liability as quarterly estimates, so it withholds NOTHING: not from draws,
    // not from conversions, and not through an explicit ira*RothWithhold override. That is the one
    // lever it isolates against C, which is identical to it in every other respect.
    const isQ = variant === 'Q';

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
    if (p.ira1RothConversion > 0 && p.ira1RothWithhold === true && !isQ && !p.ira1ConvDone) {
      const w = _estConvW(p.ira1RothConversion);
      ira1ConvFedW = w.fed;  ira1ConvStW = w.state;
      convWithholdFed += ira1ConvFedW;  convWithholdState += ira1ConvStW;
      doWithhold1 = true;
      ira1Replacement = _replacementAnalysis(p.ira1RothConversion, ira1.planAConvMonth, ira1.planAConvDay, w);
    }
    if (p.ira2RothConversion > 0 && p.ira2RothWithhold === true && !isQ && !p.ira2ConvDone) {
      const w = _estConvW(p.ira2RothConversion);
      ira2ConvFedW = w.fed;  ira2ConvStW = w.state;
      convWithholdFed += ira2ConvFedW;  convWithholdState += ira2ConvStW;
      doWithhold2 = true;
      ira2Replacement = _replacementAnalysis(p.ira2RothConversion, ira2.planAConvMonth, ira2.planAConvDay, w);
    }

    // A conversion already completed carries exactly what the user says it carried. Nothing else
    // is available: the distribution happened and its election cannot be revisited.
    [[1, p.ira1ConvDone, p.ira1RothConversion, p.ira1ConvWithheld],
     [2, p.ira2ConvDone, p.ira2RothConversion, p.ira2ConvWithheld]].forEach(([num, isDone, amt, stated]) => {
      if (!isDone || amt <= 0) return;
      const total = (typeof stated === 'number' && isFinite(stated) && stated >= 0)
        ? Math.min(stated, amt) : 0;
      const fed = Math.round(total * (stateIraExempt ? 1.0 : fedFrac));
      const st  = stateIraExempt ? 0 : total - fed;
      if (num === 1) { ira1ConvFedW = fed; ira1ConvStW = st; doWithhold1 = true; }
      else           { ira2ConvFedW = fed; ira2ConvStW = st; doWithhold2 = true; }
      convWithholdFed   += fed;
      convWithholdState += st;
      const rep2 = _replacementAnalysis(amt,
        num === 1 ? ira1.planAConvMonth : ira2.planAConvMonth,
        num === 1 ? ira1.planAConvDay   : ira2.planAConvDay,
        { total, fed, state: st });
      if (num === 1) ira1Replacement = rep2; else ira2Replacement = rep2;
    });

    // 6. Cross-IRA withholding optimizer
    // Tax remaining after conversion withholding that IRA draws must cover
    const taxAfterConvW = Math.max(0, totalTax - convWithholdFed - convWithholdState);
    // For IRA-exempt states, IRA draws can only cover federal portion
    // What the user says was already withheld from a draw they already took. Anything else on a
    // taken draw is unavailable: the distribution has happened and its election cannot be changed.
    const statedWithheld = (num, tag) => {
      const v = num === 1 ? (tag === 'rmd' ? p.ira1RmdWithheld : p.ira1VolWithheld)
                          : (tag === 'rmd' ? p.ira2RmdWithheld : p.ira2VolWithheld);
      return (typeof v === 'number' && isFinite(v) && v >= 0) ? v : null;
    };

    // The input draw groups, before D splits any of them. RMD and voluntary are tracked
    // separately so a later voluntary draw (nextMonth) can carry the withholding even when the
    // RMD was already taken (prevMonth). `taken` is read for D eligibility only.
    const baseGroups = [
      { num: 1, tag: 'rmd', month: ira1.planARmdMonth, total: p.ira1Rmd,       withheld: 0, taken: p.ira1RmdTaken },
      { num: 1, tag: 'vol', month: ira1VolMonth,       total: p.ira1Voluntary, withheld: 0, taken: p.ira1VolTaken },
      { num: 2, tag: 'rmd', month: ira2.planARmdMonth, total: p.ira2Rmd,       withheld: 0, taken: p.ira2RmdTaken },
      { num: 2, tag: 'vol', month: ira2VolMonth,       total: p.ira2Voluntary, withheld: 0, taken: p.ira2VolTaken },
    ].filter(g => g.total > 0);

    // A taken group carries exactly what the user says it carried, and nothing the planner wishes
    // it carried. The optimizer used to sort ALL groups by month and assign withholding to the
    // latest first, which meant a plan could put thousands of dollars of withholding on a
    // distribution received months ago, then report itself fully covered.
    baseGroups.forEach(g => {
      g.stated = g.taken ? statedWithheld(g.num, g.tag) : null;
      g.locked = g.taken;                                   // not available to the optimizer
      if (g.locked) g.fixedWithheld = Math.min(g.total, g.stated || 0);
    });
    const lockedWithheld = baseGroups.reduce((sum, g) => sum + (g.locked ? g.fixedWithheld : 0), 0);
    const movableTotal   = baseGroups.reduce((sum, g) => sum + (g.locked ? 0 : g.total), 0);
    // Draws the planner can still direct, capped by what is left to cover after the locked credits.
    const drawWithholdCap = isQ ? 0
      : stateIraExempt
        ? Math.min(movableTotal, Math.max(0, p.federalTax - convWithholdFed - lockedWithheld))
        : Math.min(movableTotal, Math.max(0, taxAfterConvW - lockedWithheld));

    // D takes the SPENDING part of each draw early with no withholding and holds the TAX part
    // back to a separate December tranche withheld up to 100%, which Form W-4R permits on an IRA
    // distribution. Total draws still equal the input amounts exactly: D must never add a
    // supplemental draw, because that would create taxable income the pre-calculated tax inputs
    // do not include.
    const isD = variant === 'D';
    const iraHasConv = num => (num === 1 ? p.ira1RothConversion : p.ira2RothConversion) > 0;
    // Eligible to host the December tranche: not already taken (a taken draw is locked to the
    // month it actually happened), and not the RMD of an IRA that also converts — that RMD has to
    // complete before the early conversion, so it cannot be deferred to December.
    const dEligible      = isD ? baseGroups.filter(g => !g.taken && !(g.tag === 'rmd' && iraHasConv(g.num))) : [];
    const dEligibleTotal = dEligible.reduce((sum, g) => sum + g.total, 0);
    const dTaxPortion    = isD
      ? Math.min(dEligibleTotal, stateIraExempt
          ? Math.max(0, p.federalTax - convWithholdFed)
          : taxAfterConvW)
      : 0;

    let drawGroups;
    if (isD && dTaxPortion > 0) {
      // Source largest-first, mirroring the gap-fill convSlots convention. Month-descending is
      // meaningless here because every holdback lands in the same month.
      let need = dTaxPortion;
      const decShare = new Map();
      for (const g of dEligible.slice().sort((a, b) => b.total - a.total)) {
        if (need <= 0) break;
        const take = Math.min(g.total, need);
        decShare.set(g, take);
        need -= take;
      }
      drawGroups = [];
      for (const g of baseGroups) {
        const dec   = decShare.get(g) || 0;
        const early = g.total - dec;
        if (early > 0) drawGroups.push({ num: g.num, tag: g.tag, month: g.month, total: early,
                                         withheld: g.locked ? g.fixedWithheld : 0,
                                         taken: g.locked, stated: g.stated,
                                         tranche: dec > 0 ? 'spend' : undefined });
        if (dec   > 0) drawGroups.push({ num: g.num, tag: g.tag, month: 12,      total: dec,   withheld: dec, tranche: 'tax'   });
      }
      drawGroups.sort((a, b) => b.month - a.month);
    } else {
      // Every other variant: one entry per input group, latest-month draws withheld first.
      drawGroups = baseGroups
        .map(g => ({ num: g.num, tag: g.tag, month: g.month, total: g.total,
                     withheld: g.locked ? g.fixedWithheld : 0, taken: g.locked, stated: g.stated }))
        .sort((a, b) => b.month - a.month);
      let remaining = drawWithholdCap;
      for (const g of drawGroups) {
        if (g.taken) continue;                              // its election already happened
        g.withheld = Math.min(g.total, remaining);
        remaining -= g.withheld;
        if (remaining <= 0) break;
      }
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
    // A plan forced to all-quarterly pays the whole liability as estimates, so withholding on a
    // conversion is money paid twice. Plan Q already skips the gap fill for exactly this reason;
    // a caller-level forceStrategy of 'quarterly' did not, and the plan then paid $64,000 against
    // a $57,000 bill.
    const forcedQuarterly = isQ || p.forceStrategy === 'quarterly';
    let convWithholdCapped = false;
    if (shortfall > 0 && !forcedQuarterly) {
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
    if (isQ) {
      // By definition, and ahead of forceStrategy: a user-level forceStrategy of 'ye_ira' must not
      // turn the quarterly plan into a withholding plan when it propagates to this child.
      strategy = 'all_quarterly';
    } else if (p.forceStrategy === 'ye_ira') {
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
            `See the plan comparison below.`,
          notes: [
            'Only the balance beyond the RMD can be converted. ' + seeAlso('IRC 408(d)(3)'),
            'QCD alternative: sending this RMD to charity satisfies the RMD and keeps it out of income, which allows ' +
            'an earlier conversion. ' + seeAlso('IRC 408(d)(8)'),
          ],
        });
      }
    }

    // ── 11a-w. What an action you have ALREADY TAKEN actually carried ──────
    // This used to render only in the parent plan and to report the withholding the optimizer had
    // ASSIGNED to a past distribution, as though the planner could elect it after the fact. It
    // cannot. Every plan now carries the disclosure, because every plan depends on the answer, and
    // it distinguishes a figure you supplied from an assumption the planner made for you.
    {
      const items = [];
      const split = amt => {
        const fed = Math.round(amt * wFedFrac);
        return { fed, st: amt - fed };
      };
      const line = (label, gross, statedVal) => {
        if (statedVal != null) {
          const { fed, st } = split(Math.min(statedVal, gross));
          return `${label} (${fmt$(gross)}) — you reported ${fmt$(Math.min(statedVal, gross))} withheld ` +
                 `(${fmt$(fed)} federal` + (st > 0 ? ` + ${fmt$(st)} ${stateInfo.name}` : '') +
                 `). Credited in full against this year's liability.`;
        }
        return `${label} (${fmt$(gross)}) — no withholding assumed. Withholding cannot be elected ` +
               `after a distribution has been taken, so the planner credits nothing unless you say ` +
               `what was actually withheld. If tax WAS withheld from it, enter that amount; until ` +
               `you do, the plan below schedules estimated payments for money you may have already ` +
               `paid, which OVERSTATES what you still owe.`;
      };

      for (const [iraNum, rmdTaken, rmd, rmdW, volTaken, vol, volW] of [
        [1, p.ira1RmdTaken, p.ira1Rmd, p.ira1RmdWithheld, p.ira1VolTaken, p.ira1Voluntary, p.ira1VolWithheld],
        [2, p.ira2RmdTaken, p.ira2Rmd, p.ira2RmdWithheld, p.ira2VolTaken, p.ira2Voluntary, p.ira2VolWithheld],
      ]) {
        if (rmdTaken && rmd > 0) items.push(line(`IRA ${iraNum} RMD`, rmd, rmdW));
        if (volTaken && vol > 0) items.push(line(`IRA ${iraNum} voluntary withdrawal`, vol, volW));
      }
      if (p.ira1ConvDone && p.ira1RothConversion > 0) {
        items.push(line('IRA 1 Roth conversion', p.ira1RothConversion, p.ira1ConvWithheld));
      }
      if (p.ira2ConvDone && p.ira2RothConversion > 0) {
        items.push(line('IRA 2 Roth conversion', p.ira2RothConversion, p.ira2ConvWithheld));
      }

      if (items.length > 0) {
        const anyAssumed = items.some(t => /no withholding assumed/.test(t));
        addAction({
          type: T.NOTE,
          description: anyAssumed
            ? 'Some of this year\'s money has already moved, and the planner does not know what tax ' +
              'was withheld from it. Read the figures below before following any plan.'
            : 'Already completed this year, with the withholding you reported credited against the ' +
              'liability every plan below is sized against.',
          notes: items,
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
            variant === 'B'
              ? `Plan B fallback: December draws cover most taxes, but a ${fmt$(restoreAmt)} gap required this minimum conversion withholding. Restoring this amount keeps the full conversion in Roth.`
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
        const drawTimingLabel = variant === 'C' ? 'December draws'
          : variant === 'B' ? 'December draws (Plan B hybrid)'
          : 'IRA draws';
        // These used to assert "Taxes covered by December draws" / "Taxes funded by IRA draws"
        // unconditionally, which is false whenever a shortfall is being routed to quarterly
        // estimates further down the same plan. That is the common case for a December conversion:
        // the gap fill declines to withhold (no Roth growth left AND safe harbor already met), so
        // the residual goes to estimates while this step claimed the draws had it handled. Say what
        // the plan actually does.
        const partlyEstimated = shortfall > 0;
        const fundingClause = isQ
          ? `This plan withholds nothing: the full ${fmt$(totalTax)} is scheduled as quarterly estimates below.`
          : partlyEstimated
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
    // The gate used to be `usesIraWithholding` alone, which silently dropped every draw action
    // from any all-quarterly plan that still takes draws. Q is exactly that plan: the draws are
    // real and the user has to execute them, they just carry no withholding.
    if (usesIraWithholding || (isQ && allDrawsTotal > 0)) {
      // Merge optimizer groups into action-level entries, combining same-IRA same-month subdraws
      // into one action while keeping different-month subdraws as separate calendar entries.
      const actionGroups = [];
      for (const g of drawGroups) {
        const ex = actionGroups.find(a => a.num === g.num && a.month === g.month);
        if (ex) {
          ex.total    += g.total;
          ex.withheld += g.withheld;
          if (g.tag === 'rmd') ex.rmdAmt += g.total; else ex.volAmt += g.total;
          // Late in the year D's early month IS December, so a spend part and a tax part can
          // merge into one action. That merged action is plain Plan A behavior, not a holdback,
          // so it must not claim to be either tranche.
          if (ex.tranche !== g.tranche) ex.tranche = null;
        } else {
          actionGroups.push({
            num: g.num, month: g.month,
            total: g.total, withheld: g.withheld,
            rmdAmt: g.tag === 'rmd' ? g.total : 0,
            volAmt: g.tag === 'vol' ? g.total : 0,
            tranche: g.tranche || null,
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
        //
        // Both of those days then have to be nudged off weekends and holidays HERE. The
        // resolveIraOrdering day is nudged for the month IT chose, and D's December tranche
        // reuses that day in a different month, where it can land on a Saturday. The plain
        // day-15 path was never nudged at all: the business-day sweep passed only because no
        // shape it ran produced a voluntary-only draw group, and D's split creates one.
        // A forward nudge could leave December, and an RMD cannot cross year end, so fall back
        // to the previous business day when it would.
        const rawDrawDate = new Date(yr, ag.month - 1, iRmd > 0 ? ira.planARmdDay : 15);
        let drawDate = nextBusinessDay(rawDrawDate);
        if (drawDate.getMonth() !== rawDrawDate.getMonth()) drawDate = prevBusinessDay(rawDrawDate);
        const actionDay  = drawDate.getDate();
        const rmdDate    = { year: yr, month: ag.month, day: actionDay };
        const rmdDateStr = fmtDate(yr, ag.month, actionDay);

        const totW   = iraFedW + iraStW;
        const net    = ag.total - totW;
        const pctFed = ag.total > 0 ? iraFedW / ag.total : 0;
        const pctSt  = ag.total > 0 ? iraStW  / ag.total : 0;
        const pctTot = ag.total > 0 ? totW    / ag.total : 0;

        const isTaxTranche   = ag.tranche === 'tax';
        const isSpendTranche = ag.tranche === 'spend';
        // D's zero-withholding early draws are a holdback, not the draw-order optimizer's doing.
        const optimizerNote = isQ || isD
          ? null
          : drawGroups.length > 1 && iraWithheld === 0
          ? `This draw (${MONTH_NAMES[ag.month-1]}) is earlier than another scheduled draw — the optimizer directed all withholding to the later draw to maximize tax-deferred growth. No withholding from this entry.`
          : drawGroups.length > 1
            ? `Draw-order optimizer: this entry (${MONTH_NAMES[ag.month-1]}) carries withholding because it is the latest scheduled draw, keeping IRA funds invested the longest.`
            : null;

        // Build description — combine RMD + voluntary into one line when both exist in this group
        const drawLabel = isTaxTranche
          ? `IRA ${iraNum} December tax-holdback tranche of ${fmt$(ag.total)}`
          : iRmd > 0 && iVol > 0
            ? `IRA ${iraNum} draw of ${fmt$(ag.total)} (RMD ${fmt$(iRmd)} + voluntary ${fmt$(iVol)})`
            : iRmd > 0
              ? `IRA ${iraNum} RMD of ${fmt$(iRmd)}`
              : `IRA ${iraNum} voluntary withdrawal of ${fmt$(iVol)}`;

        const notes = [];
        if (isTaxTranche) {
          notes.push(
            `This is the tax portion of draws you were already taking, held back from the early ` +
            `distribution and withheld up to 100%. Form W-4R allows a 0% to 100% federal election ` +
            `on an IRA distribution. ` + seeAlso('Form W-4R'));
          notes.push('Total draws are unchanged: the early part plus this tranche equals the amount you entered, so no extra taxable income is created.');
        }
        if (isSpendTranche) {
          notes.push('Spending portion only — the tax share of this draw is held back to the December tranche below, so the cash you receive now matches what Plan A leaves you after withholding.');
        }
        if (iRmd > 0 && iVol > 0)
          notes.push(`Breakdown: required RMD ${fmt$(iRmd)}, voluntary withdrawal ${fmt$(iVol)}.`);
        notes.push(
          totW > 0
            ? `Total withholding: ${fmt$(totW)} (${fmtPct(pctTot)} of distribution).`
            : isQ
              ? `No withholding on this draw — this plan pays the entire liability as quarterly estimates.`
              : isSpendTranche
                ? `No withholding on this draw — the tax share rides the December tranche instead.`
                : isD
                  ? `No withholding on this draw — the tax is paid by the December holdback tranche.`
                  : `No withholding on this draw — taxes covered by another draw.`
        );
        // The pro-rata credit is a property of WITHHOLDING. Q has none, and its estimates are
        // credited when they are paid, so printing this note there would be actively misleading.
        if (!isQ) notes.push('Withholding is credited pro-rata on all four due dates, so even a December draw satisfies the whole year retroactively. ' + seeAlso('IRC 6654(g)'));
        if (optimizerNote) notes.push(optimizerNote);
        if (stateIraExempt) {
          notes.push(`${stateInfo.name}: IRA distributions are exempt from state tax — no state withholding applied. State tax covered by quarterly estimates.`);
        } else if (stateInfo.withholdingCreditedProRata) {
          notes.push(`${stateInfo.name} similarly credits IRA withholding as if paid pro-rata throughout the year.`);
        }
        if (ag.month < 12) {
          notes.push(`Taking this draw in ${MONTH_NAMES[ag.month-1]} is earlier than December — see the plan comparison to quantify the opportunity cost.`);
        } else {
          notes.push('Taking this draw in December keeps the money growing tax-deferred for the whole year, ' +
                     'and it also means these proceeds are not in your hands until December. Whatever you ' +
                     'spend before then has to come from another source.');
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
          tranche: ag.tranche || undefined,
          date: rmdDate,
          amount: ag.total,
          rmdAmount: iRmd,
          volAmount: iVol,
          federalWithholding: iraFedW,
          stateWithholding:   iraStW,
          description:
            `Withdraw ${drawLabel} on ${rmdDateStr}. ` +
            (totW > 0
              ? `Withhold ${fmt$(iraFedW)} federal (${fmtPct(pctFed)})` +
                (iraStW > 0 ? ` and ${fmt$(iraStW)} ${stateInfo.name} (${fmtPct(pctSt)})` : '') +
                `. Net deposited: ${fmt$(net)}.`
              : isQ
                ? `No withholding — this plan pays the whole liability as quarterly estimates. Net deposited: ${fmt$(net)}.`
                : isSpendTranche
                  ? `No withholding — the tax share is held back to December. Net deposited: ${fmt$(net)}.`
                  : isD
                    ? `No withholding — the tax rides the December holdback tranche. Net deposited: ${fmt$(net)}.`
                    : `No withholding — taxes covered by other draws. Net deposited: ${fmt$(net)}.`),
          notes,
        });
      }

      // ── Shortfall quarterly estimates ──────────────────────────────────────
      // EVERY plan must pay the whole liability. The child variants are not internal scratch
      // work: every one of them is rendered as a displayed plan, a complete action list a user
      // is meant to follow. They used to skip this block so that
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
            (isQ
              ? `This plan takes its draws without any withholding, so the full ${fmt$(totalTax)} liability ` +
                `(${fmt$(sfFed)} federal` +
                (sfState > 0 ? `, ${fmt$(sfState)} ${stateInfo.name}` : '') +
                `) is paid as quarterly estimated taxes from cash or HYSA.`
              : `IRA withholding covers ${fmt$(totalCovered)} of your ${fmt$(totalTax)} total liability. ` +
                `The remaining ${fmt$(shortfall)} (${fmt$(sfFed)} federal` +
                (sfState > 0 ? `, ${fmt$(sfState)} ${stateInfo.name}` : '') +
                `) must be paid as quarterly estimated taxes from cash or HYSA.`) +
            (stateIraExempt ? ` Note: ${stateInfo.name} retirement income is IRA-exempt — the full ${fmt$(p.stateTax)} state tax is covered by quarterly estimates.` : ''),
          notes: [
            'Pay from a high-yield savings account — HYSA earnings partially offset the opportunity cost.',
            'This assumes the cash already exists outside your IRAs. Raising it by selling shares or by ' +
            'taking an extra withdrawal adds income the tax figures on this page do not include. ' +
            seeAlso('Tax figures are inputs'),
          ],
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
              `(${q.label} — ${fmtPct(q.w)} of ${fmt$(sfFed)} federal ${isQ ? 'liability' : 'shortfall'}).` +
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
                `(${q.label} — ${fmtPct(q.w)} of ${fmt$(sfState)} ${stateInfo.name} ${isQ ? 'liability' : 'shortfall'}).` +
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

    // P57. Plan D is only a distinct plan if something is still drawn EARLY. When the tax portion
    // consumes every eligible dollar, D's whole draw list IS the December tranche: same dates, same
    // amounts and the same cost as Plan C, while its label promises early spending draws and its
    // tranche note describes an early distribution that does not exist. P56c guarded the empty end
    // (nothing eligible to host the tranche) and never guarded this one.
    const dNoEarlyLeg = isD && drawGroups.length > 0 && drawGroups.every(g => g.month === 12);

    // P57. What each plan actually hands the household, and when. The comparison prices the timing
    // of the tax, but it cannot price the cash-flow consequence of moving a draw, because nothing
    // here knows when the money gets spent. So the outputs state the consequence instead, per plan,
    // in dollars.
    const netCashByMonth = {};
    actions.filter(a => a.type === T.RMD || a.type === T.IRA_VOL).forEach(a => {
      const net = a.amount - ((a.federalWithholding || 0) + (a.stateWithholding || 0));
      if (net > 0.5 && a.date) netCashByMonth[a.date.month] = (netCashByMonth[a.date.month] || 0) + net;
    });
    const netCashMonths = Object.keys(netCashByMonth).map(Number).sort((x, y) => x - y);

    // 14. Summary
    // buildAnalysis is deleted. It priced three hypothetical funding strategies on an April-15
    // frame while buildConvComparison priced the real plans on a Dec-31 frame, and the two could
    // print opposite verdicts for the same run. Every plan is now priced from its own action list
    // by buildPlanCost, on one frame, which is what makes that contradiction impossible.
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
      // P57. The box used to reuse the FEDERAL sentence for the state line, so California printed
      // "110% of prior-year (high-income filer)" over a number computed at 100%, and Maryland
      // printed "110% (MD rule, always)" over a number that was 90% of the current year. Both notes
      // are now built from the multiplier each figure actually used.
      safeHarborFedMult:   sfFedMult,
      safeHarborStateMult: sfStateMult,
      priorYearFedGiven:   p.priorYearFedTax   != null,
      priorYearStateGiven: p.priorYearStateTax != null,
      stateIraExempt,
      stateHasIncomeTax:   stateInfo.hasIncomeTax,
      missedFedCount:      missedFed.length,
      missedStateCount:    missedState.length,
      // P57. Whether THIS plan's withholding actually clears each installment schedule on its own.
      // These were closure locals, so the past-due reassurance in both renderers was gated on the
      // strategy label instead, which let a plan that withholds heavily and still misses by a few
      // hundred dollars print "no penalty applies".
      fedTimelyByWithholding,
      stateTimelyByWithholding,
      effectiveWithholdMonth,
      ira1: { rmdMonth: ira1.origRmdMonth, planARmdMonth: ira1.planARmdMonth, convMonth: ira1.planAConvMonth, hasConflict: ira1.hasConflict, withheld: ira1Withheld, replacement: ira1Replacement, doWithhold: doWithhold1 },
      ira2: { rmdMonth: ira2.origRmdMonth, planARmdMonth: ira2.planARmdMonth, convMonth: ira2.planAConvMonth, hasConflict: ira2.hasConflict, withheld: ira2Withheld, replacement: ira2Replacement, doWithhold: doWithhold2 },
      todayDate: today,
      coverageSummary,
      // P56 variant identity. `dTaxPortion` is the dollar size of D's December holdback tranche;
      // 0 means D degenerated (nothing eligible to host it) and the parent should omit the plan
      // with a note rather than print a duplicate of A.
      variant,
      dTaxPortion,
      // Either end of the range makes D a duplicate of another plan rather than a choice.
      dDegenerate: isD && (dTaxPortion <= 0 || dNoEarlyLeg),
      dNoEarlyLeg,
      netCashByMonth,
      netCashMonths,
      lateNetCash: netCashByMonth[12] || 0,
      drawsTotal:  allDrawsTotal,
    };

    // 16. Early-vs-December timing comparison.
    //     The parent (Plan A) spawns the sibling variants; `isChild` prevents infinite recursion.
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
    // The plan matrix. Each sibling is a full computePaymentPlan run under its own variant, so
    // every plan owns a complete, executable action list rather than an adjustment applied to
    // someone else's.
    let plans      = null;
    let comparison = null;
    if ((hasAnyConversion || hasDeferrableDraw) && !isChild) {
      const asPlan = r => (r ? { actions: r.actions, summary: r.summary, strategy: r.strategy } : null);
      const sibling = v => computePaymentPlan(Object.assign({}, p, { _variant: v }));

      // B (hybrid) only differs from C when there are conversions to pull early. With none it is
      // identical to C, so it is omitted and the reason is printed — a column that silently
      // vanishes is the complaint this replaces.
      const planB = hasAnyConversion ? asPlan(sibling('B')) : null;
      const planC = asPlan(sibling('C'));

      // D needs a deferrable draw to host the December tax tranche and a tax bill to hold back.
      // A D that finds nothing eligible (a lone RMD locked ahead of a conversion, or draws all
      // already taken) is a duplicate of A, so it is dropped the same way B is.
      let planD       = null;
      let dOmitReason = totalTax > 0 ? 'nothing-eligible' : 'no-tax';
      if (hasDeferrableDraw && totalTax > 0) {
        const d = sibling('D');
        // The tranche has to exist as an ACTION, not just as a dollar figure. A caller-level
        // forceStrategy of 'quarterly' propagates into this child and suppresses its draw actions,
        // which would otherwise offer a "Split" plan with nothing split. Belt and braces: D is only
        // offered when it is genuinely a distinct, executable plan.
        const hasTranche = d.actions.some(a => a.tranche === 'tax');
        if (d.summary.dDegenerate || !hasTranche) {
          // Different reasons, and the reader deserves the right one.
          dOmitReason = d.summary.dNoEarlyLeg ? 'no-early-leg' : 'nothing-eligible';
        } else {
          planD = asPlan(d);
        }
      }

      // Q isolates the payment mechanism against C: same December draws and conversions, taxes
      // paid as estimates instead of withheld. With no tax there is nothing to isolate.
      const planQ = totalTax > 0 ? asPlan(sibling('Q')) : null;

      plans = {
        A: { actions, summary, strategy },
        B: planB,
        C: planC,
        D: planD,
        Q: planQ,
      };
      comparison = buildComparison(p, plans, stateInfo, yr, hasAnyConversion, dOmitReason);
    }

    return {
      params:   p,
      strategy,
      actions,
      summary,
      stateInfo,
      plans,
      comparison,
      // Children render nothing: the work was thrown away before, and a child-rendered plan letter
      // would be stale anyway because only the parent knows which siblings exist.
      text: isChild ? '' : buildText(p, actions, summary, yr, stateInfo, plans, comparison),
      html: isChild ? '' : buildHtml(p, actions, summary, yr, stateInfo, plans, comparison),
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
  // ── One cost model, one frame ─────────────────────────────────────────────
  // Every plan is priced by walking its OWN action list to a single April 15 reference (the month
  // index runs 1..13, where January of the following year is 13, so `16 - m` months of carry is
  // the distance from an action to that reference).
  //
  // This replaces two cost models that never met. buildConvComparison measured first-year timing
  // deltas to December 31 with no cash-carry term; buildAnalysis measured absolute opportunity
  // cost to April 15 with one, and priced its year-end-IRA row at the MAIN plan's withholding
  // month even when a later plan won. On the scenario that prompted this phase they printed
  // opposite verdicts on the same screen. Pricing each plan from its own actions makes that
  // structurally impossible: there is no second clock left to disagree with.
  function buildPlanCost(plan, p, yr) {
    const r       = p.portfolioRate;
    const hysaNet = p.hysaGross * (1 - p.marginalOrdRate);
    const carry   = m => Math.max(0, 16 - m) / 12;
    const frame   = a => a.date.month + (a.date.year > yr ? 12 : 0);

    let withholdOC = 0, estimateOC = 0, rmdDeferral = 0, rothGrowth = 0;
    let withheldTotal = 0, estimatesTotal = 0;

    for (const a of plan.actions) {
      const w = (a.federalWithholding || 0) + (a.stateWithholding || 0);
      if (a.type === T.Q_FED || a.type === T.Q_STATE) {
        // Cash held for an estimate earns the HYSA rate meanwhile, so only the spread is lost.
        estimateOC     += a.amount * (r - hysaNet) * carry(frame(a));
        estimatesTotal += a.amount;
      } else if (a.type === T.ROTH_CONV) {
        // No tax rate is applied to the Roth growth, matching the shipped convention, so
        // plan-to-plan deltas stay comparable with the calendar-frame numbers this replaces.
        rothGrowth    += a.amount * r * carry(frame(a));
        withholdOC    += w * r * carry(frame(a));
        withheldTotal += w;
      } else if (a.type === T.RMD || a.type === T.IRA_VOL) {
        withholdOC    += w * r * carry(frame(a));
        withheldTotal += w;
        // Only the RMD portion carries a deferral value, and only to December 31: an RMD cannot
        // be pushed past year end. Voluntary draws serve a spending need and are not free to
        // move, so they are deliberately left un-costed.
        const netFrac = a.amount > 0 ? 1 - w / a.amount : 1;
        rmdDeferral  += (a.rmdAmount || 0) * netFrac * r * p.marginalOrdRate
                        * Math.max(0, 12 - a.date.month) / 12;
      }
    }

    return {
      withholdOC, estimateOC, rmdDeferral, rothGrowth,
      total: withholdOC + estimateOC + rmdDeferral - rothGrowth,
      withheldTotal, estimatesTotal,
      paid: withheldTotal + estimatesTotal,
    };
  }

  // ── The one comparison table ──────────────────────────────────────────────
  function buildComparison(p, plans, stateInfo, yr, hasConv, dOmitReason) {
    const r        = p.portfolioRate;
    const hysaNet  = p.hysaGross * (1 - p.marginalOrdRate);
    const totalTax = p.federalTax + p.stateTax;
    const letters  = ['A', 'B', 'C', 'D', 'Q'].filter(k => plans[k]);

    // Every label is built from the plan it names. They used to be built from Plan A's months, so
    // Plan B's said "draws and withholding in December" while Plan B withheld in January (an IRA
    // that both converts and has an RMD has that RMD pulled forward by resolveIraOrdering), and
    // Plan D's named an early month even when D kept no early draw at all.
    const monthsOf = (k, types, filter) => {
      if (!plans[k]) return [];
      const ms = plans[k].actions
        .filter(a => types.includes(a.type) && a.date && (!filter || filter(a)))
        .map(a => a.date.month);
      return Array.from(new Set(ms)).sort((x, y) => x - y);
    };
    const mName = m => (m ? MONTH_NAMES[m - 1] : 'December');
    // An empty month list means the plan does nothing of that kind, and saying "December" would be
    // a plain falsehood: a conversion-only plan was labelled "draws in December" with no draws.
    const mList = ms => (ms.length === 0 ? null
      : ms.length === 1 ? MONTH_NAMES[ms[0] - 1]
      : ms.slice(0, -1).map(m => MONTH_NAMES[m - 1]).join(', ') + ' and ' + MONTH_NAMES[ms[ms.length - 1] - 1]);
    const drawMonths = k => monthsOf(k, [T.RMD, T.IRA_VOL]);
    const convMonths = k => monthsOf(k, [T.ROTH_CONV]);

    const perPlan = {};
    letters.forEach(k => { perPlan[k] = buildPlanCost(plans[k], p, yr); });

    let best = null;
    letters.forEach(k => { if (best === null || perPlan[k].total < perPlan[best].total - 0.5) best = k; });
    // Everything within a dollar of the cheapest is a co-winner: starring one of them on a
    // rounding artefact would be noise dressed as advice.
    const bestSet = letters.filter(k => Math.abs(perPlan[k].total - perPlan[best].total) <= 1);
    const anyNegative = letters.some(k => perPlan[k].total < -0.5);
    // Late in the year "early" IS December, so the TIMING plans collapse onto the same dates.
    // Q is not part of that: it differs by payment mechanism, not by timing, and stays distinct
    // however late it gets.
    const timing  = letters.filter(k => k !== 'Q');
    const allTie  = timing.length > 1 &&
      timing.every(k => Math.abs(perPlan[k].total - perPlan[timing[0]].total) <= 1);

    // Each label is assembled from the clauses that are actually true of that plan, so a plan with
    // no draws does not describe draw timing and a plan with no conversion does not describe a
    // conversion month.
    const clause = (months, phrase) => (months ? `${phrase} ${months}` : null);
    const join   = parts => parts.filter(Boolean).join(', ');
    const dEarly = mList(monthsOf('D', [T.RMD, T.IRA_VOL], a => a.tranche !== 'tax'));
    const dTax   = mList(monthsOf('D', [T.RMD, T.IRA_VOL], a => a.tranche === 'tax'));
    const labels = {
      A: `Plan A — Early: ` + (join([clause(mList(convMonths('A')), 'conversions in'),
                                     clause(mList(drawMonths('A')), 'draws in')])
            || 'nothing to draw or convert') +
         (mList(drawMonths('A')) ? ', tax withheld at the draw' : ''),
      B: `Plan B — Hybrid: ` + join([clause(mList(convMonths('B')), 'conversions in'),
                                     clause(mList(drawMonths('B')), 'draws and withholding in')]),
      C: `Plan C — Late: ` + (join([clause(mList(drawMonths('C')), 'draws in'),
                                    clause(mList(convMonths('C')), 'conversions in')])
            || 'nothing to draw or convert'),
      // D's early leg is whatever is NOT the December tax tranche.
      D: `Plan D — Split: ` + join([clause(dEarly, 'spending draws in'),
                                    dTax ? `tax held back to a ${dTax} tranche` : null]),
      Q: `Plan Q — Quarterly: ` + join([clause(mList(drawMonths('Q')), 'draws in'),
                                        'the whole liability paid as quarterly estimates']),
    };

    // Why a column is missing, rather than letting it silently vanish.
    const bNote = plans.B ? null
      : 'Plan B (hybrid) is not shown: with no Roth conversion to pull early it would be identical to Plan C.';
    const dNote = plans.D ? null
      : dOmitReason === 'no-tax'
        ? 'Plan D (split) is not shown: with no tax due there is nothing to hold back.'
        : dOmitReason === 'no-early-leg'
          ? 'Plan D (split) is not shown: the tax needs every dollar of the draws you can still move, ' +
            'so nothing would be left to take early and the plan would be identical to Plan C.'
          : 'Plan D (split) is not shown: no draw is available to host the December tax tranche. ' +
            'A draw already taken is locked to the month it happened, and the RMD of an IRA you are ' +
            'converting has to complete before the conversion.';

    // Funding the same estimates by selling in a taxable brokerage account instead of holding
    // cash: the whole balance stays invested at r rather than the HYSA rate, and the sale itself
    // realises capital gains, so the sale has to be grossed up to net the tax.
    const extraCg = n => {
      if (n <= 0) return 0;
      const denom = 1 - p.appreciationPct * p.cgRateBlended;
      return denom <= 0 ? 0 : (n / denom) * p.appreciationPct * p.cgRateBlended;
    };
    let brokerage = null;
    if (plans.Q && totalTax > 0) {
      const q  = plans.Q.actions.filter(a => a.type === T.Q_FED || a.type === T.Q_STATE);
      const oc = q.reduce((sum, a) =>
        sum + a.amount * r * Math.max(0, 16 - (a.date.month + (a.date.year > yr ? 12 : 0))) / 12, 0);
      const cg = extraCg(totalTax);
      brokerage = { oc, cg, total: oc + cg };
    }

    return {
      letters, perPlan, best, bestSet, allTie, anyNegative, labels, bNote, dNote, brokerage,
      hasConversion: hasConv,
      hysaNet,
      breakeven: r / 2,
      yeIraWins: hysaNet < r / 2,
      stateName: stateInfo.name,
      totalTax,
    };
  }



  // ── Plain text output ─────────────────────────────────────────────────────
  // P57. One sentence, used by both renderers, saying what a plan actually hands the household and
  // when. The comparison prices the timing of the TAX. Nothing in this tool knows when the money
  // gets SPENT, so the cash-flow consequence of pushing a draw to December cannot be priced; it is
  // stated instead, in that plan's own dollars.
  function cashDeliveryLine(sum) {
    const months = sum.netCashMonths || [];
    if (months.length === 0) {
      return (sum.drawsTotal || 0) > 0.5
        ? `Net IRA cash to you: none. Every dollar of the ${fmt$(sum.drawsTotal)} drawn is withheld for tax, ` +
          `so this plan funds no spending.`
        : 'Net IRA cash to you: none, this plan takes no draws.';
    }
    const parts = months.map(m => `${MONTH_NAMES[m - 1]} ${fmt$(sum.netCashByMonth[m])}`);
    const when  = parts.length === 1 ? parts[0]
      : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
    const late  = sum.lateNetCash || 0;
    const tail  = (months.length === 1 && months[0] === 12)
      ? ' Anything you spend before December comes from somewhere else.'
      : late > 0.5
        ? ` ${fmt$(late)} of it does not arrive until December.`
        : '';
    return `Net IRA cash to you: ${when}.${tail}`;
  }

  function buildText(p, actions, summary, yr, stateInfo, plans, comparison) {
    const lines = [];
    const hr = '─'.repeat(70);

    lines.push(`TAX PAYMENT PLAN — ${yr} Tax Year`);
    lines.push(hr);
    lines.push(`State    : ${stateInfo.name}${summary.stateIraExempt ? ' [IRA-exempt — no state IRA withholding]' : ''}`);
    lines.push(`Total tax: ${fmt$(summary.totalTaxDue)}  (${fmt$(p.federalTax)} federal + ${fmt$(p.stateTax)} ${stateInfo.name})`);

    // The header used to print Strategy, IRA Coverage, per-IRA draw and conversion months and an
    // effective withholding month, all read from the top-level summary. The top-level summary is
    // PLAN A's, so the page opened by describing one plan while crowning another: on a reported
    // scenario it said "draw January, withhold January, coverage 100%" directly above
    // "Winner: Plan C", a plan that draws in December and routes $7,000 to estimates. Those values
    // are per-plan and now live only where the plan letter is attached to them: the comparison
    // table and each plan's own section. What stays here is true of the page.
    if (comparison) {
      const t = comparison.perPlan[comparison.best].total;
      const money = (t < -0.5 ? '-' : '') + fmt$(t);
      lines.push(comparison.bestSet.length > 1
        ? `Winner   : Plans ${comparison.bestSet.join(', ')} tie at ${money} to April 15`
        : `Winner   : Plan ${comparison.best} — first-year ${t < -0.5 ? 'net GAIN' : 'cost'} of ${money} to April 15`);
      lines.push(`           ${comparison.labels[comparison.best]}`);
    }

    if (summary.missedFedCount > 0 || summary.missedStateCount > 0) {
      lines.push('');
      lines.push(`*** ${summary.missedFedCount + summary.missedStateCount} QUARTERLY INSTALLMENT(S) PAST DUE ***`);
      // "Withholding is retroactive, no penalty applies" used to be gated on the strategy LABEL of
      // Plan A. A plan can withhold heavily, still miss an installment by a few hundred dollars, and
      // it printed the reassurance anyway; worse, the recommended plan's own steps forty lines below
      // could be marked PAST DUE at the same time. It is now checked against the plan being
      // recommended, using that plan's own coverage of each schedule.
      const rec     = comparison ? plans[comparison.best].summary : summary;
      const recName = comparison ? comparison.best : 'A';
      if (rec.iraWithholdingUsed <= 0.5) {
        // A plan that withholds nothing can be neither praised nor blamed for its withholding.
        // The original code skipped this sentence entirely for an all-quarterly plan, which was
        // right about withholding and silent about what actually decides lateness for it.
        lines.push(`    Plan ${recName} pays by quarterly estimates, and an estimate counts on the day you`);
        lines.push('    pay it, so an installment already past is late. Pay the missed ones now.');
      } else if (rec.fedTimelyByWithholding && rec.stateTimelyByWithholding) {
        lines.push(`    Plan ${recName} withholding covers every installment on both schedules, and`);
        lines.push('    withholding is credited pro-rata, so no penalty applies.');
      } else {
        const short = [!rec.fedTimelyByWithholding ? 'federal' : null,
                       !rec.stateTimelyByWithholding ? stateInfo.name : null].filter(Boolean).join(' and ');
        lines.push(`    Withholding under Plan ${recName} does not fully cover the ${short} schedule,`);
        lines.push('    so a penalty can accrue. See that plan\'s steps below.');
      }
    }

    // ── The one comparison table ────────────────────────────────────────────
    if (comparison) {
      const cc = comparison;
      const W  = 11;
      const cell = v => String(v).padStart(W);
      const row  = (label, fn) => lines.push('  ' + label.padEnd(24) + cc.letters.map(k => cell(fn(cc.perPlan[k], k))).join(''));

      lines.push('');
      lines.push('PLAN COMPARISON — first-year cost, every plan priced to April 15');
      lines.push(hr);
      cc.letters.forEach(k => lines.push(`  ${cc.labels[k]}`));
      if (cc.bNote) lines.push(`  ${cc.bNote}`);
      if (cc.dNote) lines.push(`  ${cc.dNote}`);
      lines.push('');
      lines.push('  ' + 'Component'.padEnd(24) + cc.letters.map(k => cell('Plan ' + k)).join(''));
      row('Withholding OC',    c => fmt$(c.withholdOC));
      row('Estimate carry',    c => fmt$(c.estimateOC));
      row('RMD proceeds held',  c => fmt$(c.rmdDeferral));
      row('Roth growth credit', c => (c.rothGrowth > 0.5 ? '-' : '') + fmt$(c.rothGrowth));
      lines.push('  ' + '─'.repeat(24 + W * cc.letters.length));
      row('TOTAL first-year cost',
        (c, k) => (c.total < -0.5 ? '-' : '') + fmt$(c.total) + (cc.bestSet.includes(k) ? ' ★' : ''));
      row('vs best', (c, k) => (cc.bestSet.includes(k) ? '—' : '+' + fmt$(c.total - cc.perPlan[cc.best].total)));
      lines.push('');
      if (cc.allTie) {
        lines.push('  The timing plans are identical this late in the year: "early" is already December,');
        lines.push('  so they land on the same dates. Plan Q still differs, because what it changes is');
        lines.push('  how the tax is paid rather than when the money moves.');
      }
      if (cc.brokerage) {
        lines.push(`  Funding those estimates by selling brokerage instead of holding cash costs`);
        lines.push(`  ${fmt$(cc.brokerage.total)}: ${fmt$(cc.brokerage.oc)} of forgone growth plus ` +
                   `${fmt$(cc.brokerage.cg)} of capital gains tax on the sale.`);
        lines.push(`  That ${fmt$(cc.brokerage.cg)} is NOT part of the ${fmt$(cc.totalTax)} these plans are built around,`);
        lines.push(`  because the tax figures were calculated before the sale existed. Selling raises next`);
        lines.push(`  April's bill by roughly that much. ` + seeAlso('Tax figures are inputs'));
      }
      if (cc.anyNegative) {
        lines.push('  A NEGATIVE total is a net gain: the Roth growth that plan buys outweighs everything');
        lines.push('  it costs.');
      }
      lines.push('  Lower is better. Moving a draw to December is not free, and this table does not');
      lines.push('  price it: the planner does not know when you actually spend the money. A December');
      lines.push('  draw either funds next year\'s spending, or it assumes you can cover this year\'s from');
      lines.push('  somewhere else until it lands. Only the RMD portion carries a deferral value here,');
      lines.push('  and only to December 31.');
      lines.push('  First-year only: an early conversion compounds tax-free in every later year too,');
      lines.push('  which this table does not count.');
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

    if (comparison) {
      lines.push('');
      comparison.letters.forEach(k => {
        const win = comparison.bestSet.includes(k) ? '   ★ LOWEST FIRST-YEAR COST' : '';
        lines.push(comparison.labels[k].toUpperCase() + win);
        lines.push(hr);
        const sum = plans[k].summary;
        const c   = comparison.perPlan[k];
        lines.push(`  First-year cost to April 15: ${(c.total < -0.5 ? '-' : '') + fmt$(c.total)}` +
                   `   |   tax withheld ${fmt$(c.withheldTotal)}, paid as estimates ${fmt$(c.estimatesTotal)}`);
        lines.push('  ' + cashDeliveryLine(sum));
        lines.push('');
        renderActions(plans[k].actions);
      });
    } else {
      lines.push('');
      lines.push('ACTION PLAN');
      lines.push(hr);
      renderActions(actions);
    }

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
  function buildHtml(p, actions, summary, yr, stateInfo, plans, comparison) {
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

    let h = '';
    h += `<div style="font-family:Arial,sans-serif;max-width:860px;margin:0 auto;color:#222;">`;

    h += `<h2 style="background:#1F4E79;color:#fff;padding:14px 18px;margin:0;font-size:1.15em;border-radius:4px 4px 0 0;">Tax Payment Plan — ${yr} Tax Year</h2>`;

    h += `<div style="background:#EBF3FB;padding:12px 18px;border:1px solid #BDD7EE;border-top:none;">`;
    h += `<div style="margin-bottom:6px;">`;
    // The Strategy and IRA Coverage badges described the TOP-LEVEL summary, which is Plan A's, and
    // sat inches from a Winner badge naming a different plan. Both are per-plan values and now live
    // only inside the plan sections and the priced table, where the letter travels with them.
    h += badge('Federal', fmt$(p.federalTax), '#C9360C');
    h += badge(stateInfo.name, fmt$(p.stateTax), '#9C4A00');
    h += badge('Total Tax', fmt$(summary.totalTaxDue), '#222');
    if (comparison) {
      const t = comparison.perPlan[comparison.best].total;
      h += comparison.bestSet.length > 1
        ? badge('Winner', 'Plans ' + comparison.bestSet.join(', ') + ' tie', '#596A2F')
        : badge('Winner', 'Plan ' + comparison.best, '#375623');
      // fmt$ is Math.abs by design, so a plan whose Roth growth outweighs its costs printed a gain
      // as a cost here while the table twelve lines below printed it correctly as negative.
      h += badge(t < -0.5 ? 'First-year net gain' : 'First-year cost',
                 (t < -0.5 ? '' : '') + fmt$(t), '#596A2F');
    }
    h += `</div>`;

    // What is left here is true of the page rather than of one plan: the state's treatment of IRA
    // income, and the winning plan's own one-line description.
    h += `<div style="margin-top:8px;font-size:0.82em;color:#555;">`;
    if (comparison) h += comparison.labels[comparison.best];
    if (summary.stateIraExempt) h += ` &nbsp;|&nbsp; <span style="color:#2E7D32;font-weight:600;">${stateInfo.name}: IRA-exempt ✓</span>`;
    else if (!summary.stateHasIncomeTax) h += ` &nbsp;|&nbsp; <span style="color:#2E7D32;font-weight:600;">${stateInfo.name}: no income tax ✓</span>`;
    h += `</div>`;

    // The old banner here said "Plan uses year-end IRA for simplicity" whenever the HYSA net rate
    // had caught up with the break-even. It asserted Plan A's funding mechanism, it fired most often
    // in exactly the scenarios where the quarterly plan wins, and it printed even when the parent
    // plan itself was all-quarterly, contradicting the Strategy badge in the same block. The rates
    // it quoted are facts, so they stay; the verdict it drew from them is the priced table's job.
    if (!summary.yeIraWins) {
      h += warn(`<strong>Rates are close.</strong> Cash in a high-yield account nets ` +
                `${fmtPct(summary.hysaNet, 2)} against a break-even of r/2 = ${fmtPct(summary.breakeven, 2)}, ` +
                `so withholding from the IRA and paying quarterly from cash cost nearly the same. ` +
                `The comparison below prices both against your figures.`);
    }
    h += `</div>`;

    // ── The one comparison table ───────────────────────────────────────────
    // Up to five plans, every one of them priced from its own action list on a single April 15
    // frame. There is no second cost table further down the page any more: the old Cost Analysis
    // block measured hypothetical funding strategies on a different clock and could contradict
    // this one on the same screen.
    const PLAN_COLOR = { A: '#1B5E20', B: '#1565C0', C: '#6A1B9A', D: '#00695C', Q: '#E65100' };
    const PLAN_BG    = { A: '#E8F5E9', B: '#E3F2FD', C: '#F3E5F5', D: '#E0F2F1', Q: '#FFF3E0' };
    const PLAN_BDR   = { A: '#A5D6A7', B: '#90CAF9', C: '#CE93D8', D: '#80CBC4', Q: '#FFCC80' };
    if (comparison) {
      const cc = comparison;
      h += `<div style="margin:12px 0;border:2px solid #1F4E79;border-radius:6px;overflow:hidden;">`;
      h += `<div style="background:#1F4E79;color:#fff;padding:10px 16px;font-weight:700;font-size:0.95em;">` +
           `⚖️ Plan comparison — first-year cost, every plan priced to April 15</div>`;
      h += `<div style="padding:12px 16px;background:#F8FAFF;">`;

      // One pill per plan that exists.
      h += `<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">`;
      cc.letters.forEach(k => {
        const label = cc.labels[k];
        const dash  = label.indexOf('—');
        const head  = dash >= 0 ? label.slice(0, dash + 1) + label.slice(dash + 1).split(':')[0] : label;
        const rest  = dash >= 0 && label.slice(dash + 1).includes(':')
          ? label.slice(label.indexOf(':', dash) + 1).trim() : '';
        h += `<div style="flex:1;min-width:170px;background:${PLAN_BG[k]};border:1px solid ${PLAN_BDR[k]};border-radius:5px;padding:9px 12px;">`;
        h += `<div style="font-weight:700;color:${PLAN_COLOR[k]};font-size:0.86em;margin-bottom:3px;">📅 ${head}</div>`;
        h += `<div style="font-size:0.80em;color:#444;">${rest}</div>`;
        h += `</div>`;
      });
      h += `</div>`;

      const money = v => fmt$(Math.abs(v));
      const compRow = (label, fn, note, bold) => {
        h += `<tr style="border-bottom:1px solid #eee;${bold ? 'border-top:2px solid #1F4E79;' : ''}">`;
        h += `<td style="padding:${bold ? '8px' : '6px'} 10px;${bold ? 'font-weight:700;' : ''}">${label}` +
             `${note ? ` <span style="color:#888;font-size:0.88em;">${note}</span>` : ''}</td>`;
        cc.letters.forEach(k => {
          const win = bold && cc.bestSet.includes(k);
          h += `<td style="padding:${bold ? '8px' : '6px'} 10px;text-align:right;` +
               `${win ? 'background:#E8F5E9;' : ''}${bold ? `font-weight:700;color:${PLAN_COLOR[k]};` : ''}">` +
               `${fn(cc.perPlan[k], k)}${win ? ' ★' : ''}</td>`;
        });
        h += `</tr>`;
      };

      h += `<table style="width:100%;border-collapse:collapse;font-size:0.86em;margin-bottom:10px;">`;
      h += `<thead><tr style="background:#E3F2FD;">`;
      h += `<th style="padding:7px 10px;text-align:left;color:#1F4E79;font-weight:600;">Component (cost to April 15, lower is better)</th>`;
      cc.letters.forEach(k => {
        h += `<th style="padding:7px 10px;text-align:right;color:${PLAN_COLOR[k]};font-weight:700;">Plan ${k}</th>`;
      });
      h += `</tr></thead><tbody>`;
      compRow('Withholding opportunity cost', c => money(c.withholdOC), 'growth given up when tax leaves the IRA early');
      compRow('Estimate cash carry',          c => money(c.estimateOC), `portfolio rate less HYSA net ${fmtPct(cc.hysaNet, 2)}`);
      compRow('RMD proceeds held outside the IRA', c => money(c.rmdDeferral),
        'RMD taken before December, net of the withholding on it');
      if (cc.hasConversion) {
        compRow('Roth tax-free growth (credit)',
          c => `<span style="color:#1B5E20;">${c.rothGrowth > 0.5 ? '−' : ''}${money(c.rothGrowth)}</span>`,
          'earned by converting earlier');
      }
      compRow('TOTAL first-year cost',
        c => (c.total < -0.5 ? '−' : '') + money(c.total), '', true);
      compRow('vs best', (c, k) => (cc.bestSet.includes(k) ? '—' : '+' + money(c.total - cc.perPlan[cc.best].total)), '');
      h += `</tbody></table>`;

      h += `<div style="font-size:0.81em;color:#555;border-top:1px solid #ddd;padding-top:8px;">`;
      if (cc.allTie) {
        h += `<div style="margin-bottom:4px;"><strong>The timing plans are identical this late in the year.</strong> ` +
             `"Early" is already December, so they land on the same dates. Plan Q still differs, because what ` +
             `it changes is how the tax is paid rather than when the money moves.</div>`;
      }
      if (cc.bNote) h += `<div style="margin-bottom:4px;">${cc.bNote}</div>`;
      if (cc.dNote) h += `<div style="margin-bottom:4px;">${cc.dNote}</div>`;
      if (cc.brokerage) {
        h += `<div style="margin-bottom:4px;"><strong>Funding source footnote.</strong> Paying those estimates by ` +
             `selling appreciated brokerage shares instead of holding cash costs ${fmt$(cc.brokerage.total)}: ` +
             `${fmt$(cc.brokerage.oc)} of forgone growth plus ${fmt$(cc.brokerage.cg)} of capital gains tax on the ` +
             `sale itself. It is a way to fund Plan Q, not a plan of its own, so it has no steps below. ` +
             `<strong>That ${fmt$(cc.brokerage.cg)} is not part of the ${fmt$(cc.totalTax)} these plans are sized ` +
             `against</strong>, because the tax figures were calculated before the sale existed, so selling lifts ` +
             `next April's bill by roughly that much. ${seeAlso('Tax figures are inputs')}</div>`;
      }
      if (cc.anyNegative) {
        h += `<div style="margin-bottom:4px;"><strong>A negative total is a net gain</strong>, not a cost: ` +
             `the Roth growth that plan buys outweighs everything it gives up.</div>`;
      }
      h += `<strong>Moving a draw to December is not free, and this table does not price it</strong>, because ` +
           `the planner does not know when you actually spend the money. A December draw either funds next ` +
           `year's spending, or it assumes you can cover this year's from somewhere else until it lands. Each ` +
           `plan below states what it hands you and when. Only the RMD portion carries a deferral value here, ` +
           `and only to December 31. <strong>First-year only</strong>: an early conversion keeps compounding ` +
           `tax-free in every later year, which this table does not count. ★ = lowest first-year cost.`;
      h += `</div></div></div>`;
    }

    // P57. This table is a pay checklist, and it used to be rendered ONCE from the top-level
    // summary, which is Plan A's. On a reported scenario it listed conversion withholding of
    // $7,000 and no estimates at all, while the recommended plan withheld nothing on the
    // conversion and owed seven estimated payments totalling the same $7,000. A reader working
    // from it would have skipped all seven. It is now built per plan.
    const coverageBlock = sum => {
      let out = '';
      const cs = sum.coverageSummary;
      const rows = [
        { label: 'IRA 1 withholding',         fed: cs.ira1Draw.fed,   state: cs.ira1Draw.state,   show: cs.ira1Draw.fed + cs.ira1Draw.state > 0 },
        { label: 'IRA 2 withholding',         fed: cs.ira2Draw.fed,   state: cs.ira2Draw.state,   show: cs.ira2Draw.fed + cs.ira2Draw.state > 0 },
        { label: 'Conversion withholding',    fed: cs.conversion.fed, state: cs.conversion.state, show: cs.conversion.fed + cs.conversion.state > 0 },
        { label: 'Quarterly estimated taxes', fed: cs.quarterly.fed,  state: cs.quarterly.state,  show: cs.quarterly.fed + cs.quarterly.state > 0 },
      ].filter(r => r.show);

      const totalFed   = rows.reduce((s, r) => s + r.fed,   0);
      const totalState = rows.reduce((s, r) => s + r.state, 0);
      const totalAll   = totalFed + totalState;
      const taxDue     = sum.totalTaxDue;
      const balanced   = Math.abs(totalAll - taxDue) < 2;

      out += `<div style="margin:12px 0;border:1px solid #BDD7EE;border-radius:6px;overflow:hidden;">`;
      out += `<div style="background:#2E75B6;color:#fff;padding:8px 16px;font-weight:700;font-size:0.92em;">📊 Tax Coverage Summary</div>`;
      out += `<table style="width:100%;border-collapse:collapse;font-size:0.88em;">`;
      out += `<thead><tr style="background:#EBF3FB;">`;
      out += `<th style="padding:6px 12px;text-align:left;color:#1F4E79;">Payment Source</th>`;
      out += `<th style="padding:6px 12px;text-align:right;color:#1F4E79;">Federal</th>`;
      out += `<th style="padding:6px 12px;text-align:right;color:#1F4E79;">State</th>`;
      out += `<th style="padding:6px 12px;text-align:right;color:#1F4E79;">Total</th>`;
      out += `</tr></thead><tbody>`;
      rows.forEach((r, i) => {
        const bg = i % 2 === 0 ? '#fff' : '#F9F9F9';
        out += `<tr style="background:${bg};border-bottom:1px solid #eee;">`;
        out += `<td style="padding:6px 12px;">${r.label}</td>`;
        out += `<td style="padding:6px 12px;text-align:right;">${r.fed > 0 ? fmt$(r.fed) : '—'}</td>`;
        out += `<td style="padding:6px 12px;text-align:right;">${r.state > 0 ? fmt$(r.state) : '—'}</td>`;
        out += `<td style="padding:6px 12px;text-align:right;font-weight:600;">${fmt$(r.fed + r.state)}</td>`;
        out += `</tr>`;
      });
      out += `<tr style="background:#E2EFDA;font-weight:700;border-top:2px solid #2E75B6;">`;
      out += `<td style="padding:7px 12px;">Total covered</td>`;
      out += `<td style="padding:7px 12px;text-align:right;">${fmt$(totalFed)}</td>`;
      out += `<td style="padding:7px 12px;text-align:right;">${fmt$(totalState)}</td>`;
      out += `<td style="padding:7px 12px;text-align:right;">${fmt$(totalAll)}</td>`;
      out += `</tr>`;
      out += `<tr style="background:#F5F5F5;border-top:1px solid #ccc;">`;
      out += `<td style="padding:6px 12px;color:#555;">Tax due</td>`;
      out += `<td style="padding:6px 12px;text-align:right;color:#555;">${fmt$(p.federalTax)}</td>`;
      out += `<td style="padding:6px 12px;text-align:right;color:#555;">${fmt$(p.stateTax)}</td>`;
      out += `<td style="padding:6px 12px;text-align:right;color:#555;">${fmt$(taxDue)}</td>`;
      out += `</tr>`;
      const balColor = balanced ? '#1B5E20' : '#8B0000';
      const balText  = balanced
        ? `✓ Fully covered`
        : `${fmt$(Math.abs(taxDue - totalAll))} ${totalAll < taxDue ? 'uncovered — check inputs' : 'over-withheld (refund expected)'}`;
      out += `<tr style="background:${balanced ? '#E8F5E9' : '#FFECEC'};">`;
      out += `<td colspan="3" style="padding:6px 12px;font-weight:700;color:${balColor};">${balText}</td>`;
      out += `<td style="padding:6px 12px;text-align:right;font-weight:700;color:${balColor};">${balanced ? '' : fmt$(Math.abs(taxDue - totalAll))}</td>`;
      out += `</tr>`;
      out += `</tbody></table></div>`;
      return out;
    };

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

    // One section per plan, collapsed except the winner. The .ics and Print buttons live inside
    // the <summary>, so they must stop the click before it reaches the disclosure and toggles it.
    const makePlanSection = (letter, plan) => {
      const cc    = comparison;
      const wins  = !!cc && cc.bestSet.includes(letter);
      const color = PLAN_COLOR[letter] || '#2E75B6';
      const bdr   = wins ? '#1B5E20' : color;
      const cost  = cc ? fmt$(cc.perPlan[letter].total) : null;
      const label = cc ? cc.labels[letter] : 'Action plan';
      h += `<details id="plan-section-${letter.toLowerCase()}"${wins || !cc ? ' open' : ''} ` +
           `style="border:2px solid ${bdr};border-radius:6px;margin-bottom:16px;overflow:hidden;">`;
      h += `<summary style="background:${bdr};color:#fff;padding:8px 16px;font-weight:700;cursor:pointer;">`;
      h += `<span class="plan-action-btns" style="float:right;white-space:nowrap;">`;
      h += `<button style="${planBtnStyle}" onclick="event.preventDefault();event.stopPropagation();downloadPlanIcs('${letter}')">📅 .ics</button>`;
      h += `<button style="${planBtnStyle}" onclick="event.preventDefault();event.stopPropagation();printPlan('${letter}')">🖨️ Print</button>`;
      h += `</span>`;
      h += `📅 ${label}`;
      if (cost !== null) {
        h += ` &nbsp;<span style="font-weight:400;font-size:0.88em;">(${wins ? '★ lowest first-year cost, ' : ''}${cost})</span>`;
      }
      h += `</summary>`;
      h += `<div style="padding:8px;">`;
      if (cc) {
        const c = cc.perPlan[letter];
        h += `<div style="font-size:0.85em;color:#333;background:#F5F7FA;border:1px solid #E1E6ED;` +
             `border-radius:5px;padding:8px 12px;margin:0 0 8px 0;">`;
        h += `<div>First-year cost to April 15: <strong>${(c.total < -0.5 ? '−' : '') + fmt$(c.total)}</strong>` +
             ` &nbsp;|&nbsp; tax withheld <strong>${fmt$(c.withheldTotal)}</strong>` +
             `, paid as estimates <strong>${fmt$(c.estimatesTotal)}</strong></div>`;
        h += `<div style="margin-top:3px;">${cashDeliveryLine(plan.summary)}</div>`;
        h += `</div>`;
      }
      h += coverageBlock(plan.summary);
      renderActionList(plan.actions, plan.summary);
      h += `</div></details>`;
    };

    if (comparison) {
      comparison.letters.forEach(k => makePlanSection(k, plans[k]));
    } else {
      h += `<h3 style="margin:16px 18px 8px;color:#1F4E79;font-size:1em;">Action Plan</h3>`;
      h += `<div style="padding:0 4px;">`;
      renderActionList(actions, summary);
      h += `</div>`;
    }

    // Safe harbor
    // Each line describes the multiplier its own figure used, and says so only when the figure was
    // built from a prior year at all.
    const shNote = (mult, given, always110) =>
      !given ? 'estimated at 90% of this year; enter last year\'s tax for the real test'
      : mult >= 1.10
        ? (always110 ? `110% of prior-year (${stateInfo.name} applies 110% to every filer)`
                     : '110% of prior-year (high-income filer)')
        : '100% of prior-year';
    h += info(
      `<strong>Safe Harbor (minimum to avoid underpayment penalty):</strong><br>` +
      `Federal: ${fmt$(summary.safeHarborFed)} (${shNote(summary.safeHarborFedMult, summary.priorYearFedGiven, false)})` +
      (summary.priorYearFedGiven ? ` — based on prior-year tax ${fmt$(p.priorYearFedTax)}` : '') + `.<br>` +
      `${stateInfo.name}: ${fmt$(summary.safeHarborState)} ` +
      `(${shNote(summary.safeHarborStateMult, summary.priorYearStateGiven, stateInfo.safeHarborAlways110)})` +
      (summary.priorYearStateGiven ? ` — based on prior-year tax ${fmt$(p.priorYearStateTax)}` : '') + '.' +
      // A state that applies 110% to everyone has no threshold to describe, so the caveat below is
      // for the states where the higher rate depends on income the planner is never given.
      (stateInfo.safeHarborHighIncomeThreshold && !stateInfo.safeHarborAlways110
        ? `<br><em>NOTE: ${stateInfo.name} raises the requirement to 110% for high earners, and writes that ` +
          `threshold against adjusted gross income (${stateInfo.safeHarborHighIncomeThreshold >= 1000000
              ? '$' + (stateInfo.safeHarborHighIncomeThreshold / 1000000).toFixed(1) + 'M'
              : '$' + (stateInfo.safeHarborHighIncomeThreshold / 1000).toFixed(0) + 'K'}). ` +
          `This planner is not given your AGI, so it compares your ${stateInfo.name} tax to that figure instead. ` +
          `The 110% requirement will therefore usually not trigger here even when it applies to you, which ` +
          `UNDERSTATES the minimum you owe. Check the rule yourself if your income is near it.</em>`
        : '')
    );

    if (stateInfo.paymentNote) {
      h += info(`<strong>${stateInfo.name} payment info:</strong> ${stateInfo.paymentNote}` +
                (stateInfo.paymentUrl ? ` <a href="${stateInfo.paymentUrl}" target="_blank">${stateInfo.paymentUrl}</a>` : ''));
    }

    h += `<div style="font-size:0.81em;color:#888;padding:8px 0 4px;border-top:1px solid #eee;margin-top:6px;">`;
    h += `<strong>Note on income variation:</strong> Holding cash in a HYSA to pay quarterly estimates `;
    h += `reduces your average cash balance, slightly lowering interest income relative to the planned amount, `;
    h += `and selling brokerage shares gives up the future dividends on those shares. Both of those are small `;
    h += `second-order effects. The capital gains tax on such a sale is not: it is priced in the funding-source `;
    h += `footnote above, and it is not part of the tax these plans are sized against. ${seeAlso('Tax figures are inputs')}`;
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
