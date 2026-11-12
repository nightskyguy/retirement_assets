# Entering a state tax refund, and the other inputs worth adding to the Income Tax Planner

*(Measured 2026-11-11 on `main` at `5e11da4`, which includes the senior-deduction and NIIT fixes of
PR #259.)*

**Status.** The three largest items are implemented: `D1` (California's 2026 table, Optimizer
11.1d93), `C1` (California's exemption credits, as part of every state's exemptions and credits,
11.1d9d) and `RF` (the Taxable state or local tax refund entry, link key `sr`, Income Tax Planner
v2.15). With all three, the planner gives the tax program's California tax to the dollar in all four
columns and its federal tax as measured for `R2` below. Still open: `T1`, `G1`, `F1`, `I1`, and the
$21 NIIT difference in the 240,000 column. The measurements below are as taken before those changes.

A tax program's 2026 projection for a real California couple was compared against the
[Income Tax Planner](../standalone/IncomeTaxPlanner.html) at four Roth conversion sizes. After PR #259
the federal figures agree to within $1-2. California still ran **$1,024 to $1,257 high**, and the
household had a $1,789 state refund that the planner has no place for: it was entered as Other income,
which California then taxed.

This report answers two questions:

1. **What should the planner add so a refund can be entered honestly?** One amount, the taxable part,
   federal only. Section 2.
2. **Which other simple inputs or corrections would noticeably improve accuracy?** Two of the three
   largest need **no input at all**: California's tax table in the engine is the **2024** one, and
   California's exemption credits are not applied. With those two fixed and the refund kept out of
   California income, the planner reproduces the tax program's California tax **to the dollar in all
   four columns**. Sections 1 and 3.

The earlier explanation of the California gap (about $1,082 from exemption credits, $175 from the
refund, a little from the standard deduction) had the right three suspects and the wrong sizes. The
credits are $632. The rest of what was put down to them is the stale table, $279 to $450.

Harness: [`tax_planner_inputs_harness.js`](../.test_harnesses/tax_planner_inputs_harness.js). It loads
`taxengine.js` and `taxcalc_core.js` (the calculation `node taxcalc.js` runs) and patches the tables
in memory only. Runs in under a second.

---

## Reading guide

### The household

A 2026 joint return, California, ages 66 and 74. Link keys are the planner's own
([UsageGuide.md](../UsageGuide.md)):

```
st=MFJ&s=CA&a1=66&a2=74&yr=2026&ss=29858&it=5075&nd=2500&qd=7950&sg=405&cs=100220&cb=0
&rd=9126&mu=1600&sm=1100&ui=50   plus rc=0 / 55000 / 120000 / 240000
```

The four Roth conversion sizes (`rc`) are the four **columns** in every table below. The tax program
reported California tax of **3,210 / 7,769 / 13,814 / 24,974**. The couple itemized in 2025 and
received a **$1,789** state refund in 2026, which the program treated as fully taxable federally.

### Codes

| code | meaning |
|---|---|
| `CA0` to `CA4` | The California tax as each gap is closed in turn, section 1. `CA0` is the planner today. |
| `R0` | The refund entered as Other income (`ot=1789`), the only workaround today |
| `R1` | The refund left out entirely |
| `R2` | The refund entered federal-only: in federal income, out of state income. The proposal. |
| `D1` | Candidate: replace California's tax table with the 2026 one FTB has published |
| `C1` | Candidate: apply California's personal and senior exemption credits |
| `RF` | Candidate: a refund input, the subject of section 2 |
| `T1` | Candidate: let the state-exempt Treasury entry cover Treasury fund **dividends**, not only interest |
| `G1` | Candidate: the federal charitable deduction for people who do not itemize |
| `I1` | Candidate: itemized deductions beyond property tax (charity, mortgage interest, medical), federal and state |
| `F1` | Candidate: the foreign tax credit |

---

## 1. Where California's gap comes from

Each row closes one more gap. Figures are the planner's California tax, with the difference to the
tax program in parentheses.

| step | rc=0 | 55,000 | 120,000 | 240,000 |
|---|---|---|---|---|
| tax program | 3,210 | 7,769 | 13,814 | 24,974 |
| `CA0` planner today, refund as Other income | 4,234 (+1,024) | 9,026 (+1,257) | 15,071 (+1,257) | 26,231 (+1,257) |
| `CA1` refund kept out of California income | 4,091 (+881) | 8,860 (+1,091) | 14,905 (+1,091) | 26,065 (+1,091) |
| `CA2` plus FTB's 2026 tax rate schedule | 3,848 (+638) | 8,410 (+641) | 14,455 (+641) | 25,615 (+641) |
| `CA3` plus the 2026 standard deduction, 11,800 | 3,842 (+632) | 8,401 (+632) | 14,446 (+632) | 25,606 (+632) |
| `CA4` plus four exemption credits of $158 | **3,210 (0)** | **7,769 (0)** | **13,814 (0)** | **24,974 (0)** |

Each fix alone, measured from `CA0`, in dollars of California tax removed:

| fix | rc=0 | 55,000 | 120,000 | 240,000 |
|---|---|---|---|---|
| refund kept out of California income | 143 | 166 | 166 | 166 |
| 2026 tax rate schedule | 279 | 450 | 450 | 450 |
| 2026 standard deduction | 8 | 9 | 9 | 9 |
| exemption credits | 632 | 632 | 632 | 632 |

**The engine's "2026" California table is the 2024 one.** Its joint brackets end at 21,512 / 50,998 /
80,490 / 111,734 / 141,212 / 721,318, which are the 2024 figures. FTB's 2025 schedule moved them to
22,158 / 52,528 / 82,904 / 115,084 / 145,448 / 742,958, and the
[2026 California Tax Rate Schedules](https://www.ftb.ca.gov/forms/2026/2026-540-tax-rate-schedules.pdf),
already published, to **22,912 / 54,314 / 85,722 / 118,996 / 150,394 / 768,218 / 921,854 / 1,536,426**
(single: 11,456 / 27,157 / 42,861 / 59,498 / 75,197 / 384,109 / 460,927 / 768,213). The table's own
comment says it was inflation-adjusted, and it was not. Two years of indexing on the band edges below
9.3% is worth $450 a year to any California household in the 9.3% band, in every tool that reads
`TAXData`.

**The 2026 standard deduction and credits are derived, not read.** FTB's 2025 figures are an
$11,412 joint standard deduction (2025 Form 540 booklet, line 18) and a $153 personal and $153 senior
exemption credit per person ([2025 Form 540](https://www.ftb.ca.gov/forms/2025/2025-540.pdf), lines 7
and 9). The 2026 rate schedule's edges are the 2025 ones times **1.03403** exactly (22,912 / 22,158),
and applying that factor gives **$11,800** (the tax program's figure) and **$158**. FTB's 2026
estimated-tax worksheet still prints the 2025 amounts, so these two should be replaced by FTB's own
2026 figures once its 2026 Form 540 instructions are out. The exact four-column match says the
derived values are what the tax program used.

The credits phase out at high income: $6 per credit for each $2,500 of federal AGI above $504,411
joint, $252,203 single (2025 Form 540 booklet, line 32, AGI Limitation Worksheet). No column here
reaches that.

The federal side is untouched by all of this and already matches, with one exception: **NIIT in the
240,000 column is $4,414 against the program's $4,435.** That is about $553 of investment income the
program counts and the planner does not. No candidate in this report explains it (a state refund is
not investment income), and the inputs as given do not either.

---

## 2. The refund (`RF`)

### The rules

- **A state or local income tax refund is federal income only to the extent last year's deduction
  for it saved tax.** IRS Publication 525 (2025), *Recoveries*: "You must include a recovery in your
  income in the year you receive it", limited to what the earlier deduction was worth. Someone who
  took the standard deduction last year includes none of it (Example 29: "you didn't itemize
  deductions for 2024"). Someone whose itemized deductions beat the standard deduction by less than
  the refund includes only that difference (Example 32: itemized $29,450, standard $29,200, refund
  $2,100, **include $250**). The deduction cap matters the same way: what is included is limited to
  the excess of what was deducted over what would have been, so a filer whose state and local taxes
  were over the cap even after the refund includes nothing. It goes on Schedule 1, line 1, figured
  with the worksheet in the Schedule 1 instructions. [Publication 525](https://www.irs.gov/publications/p525)
- **A federal refund is never income.** Publication 525: "Refunds of federal income taxes aren't
  included in your income."
- **Interest paid on any refund is interest income**, reported on Form 1040 line 2b in the year
  received (Publication 525).
- **California does not tax its own refund.** Schedule CA (540) instructions, line 1: "California does
  not tax the state income tax refund." The refund is subtracted in column B.
  [2025 Schedule CA (540) instructions](https://www.ftb.ca.gov/forms/2025/2025-540-ca-instructions.html)
- **Other states:** Michigan and Colorado state guidance found in a search both subtract a state
  refund to the extent it was in federal income. A state-by-state audit was not done. It matters less
  than it sounds for this engine, because `calculateTaxes` never starts state income from federal AGI:
  it builds state income from its components. A federal-only line is therefore out of state income in
  every state the engine models, which is right for a state's own refund. A refund of a DIFFERENT
  state's tax, or of a local tax, may be taxable in some states; that is out of scope.

### How the refund should flow

| measure | the refund is in it? | why |
|---|---|---|
| federal AGI and taxable income | yes, as ordinary income | Schedule 1, line 1 |
| IRMAA MAGI | yes | AGI plus tax-exempt interest |
| Social Security provisional income | yes | it is in AGI, so it can pull more benefits into tax |
| senior deduction and SALT cap phase-outs | yes | both run on AGI-based MAGI |
| NIIT | in MAGI, **not** in net investment income | a refund is not investment income |
| state income | no | the state does not tax its own refund |
| retirement income, for states that exempt it | no | it is not a distribution |

Measured (`R0`, `R1`, `R2`; federal tax, NIIT and California tax at each column):

| route | rc=0 | 55,000 | 120,000 | 240,000 |
|---|---|---|---|---|
| `R0` as Other income | fed 951, CA 4,234 | fed 16,735, CA 9,026 | fed 34,833 (NIIT 853), CA 15,071 | fed 65,541, CA 26,231 |
| `R1` left out | fed 650, CA 4,091 | fed 16,194, CA 8,860 | fed 34,371 (NIIT 785), CA 14,905 | fed 65,112, CA 26,065 |
| `R2` federal-only | fed 951, CA 4,091 | fed 16,735, CA 8,860 | fed 34,833 (NIIT 853), CA 14,905 | fed 65,541, CA 26,065 |

**Today a user has two wrong choices.** Entering the refund as Other income gets federal right and
overstates California by $143 to $166. Leaving it out gets California right and understates federal
by **$301 to $541**, more than the $1,789 times a bracket rate, because the refund also shrinks the
senior deduction and, at 120,000, adds $68 of NIIT. `R2` is right on both.

On a household nearer the Social Security thresholds (`st=MFJ&s=CA&a1=70&a2=70&yr=2026&ss=40000&it=3000&rd=30000`)
a $2,000 taxable refund raises AGI by $3,700, because it pulls $1,700 more of the benefits into tax,
and federal tax goes from $0 to $285. That is the case where leaving it out misleads most.

### The proposed control

**One amount: the taxable part.** Not the refund plus a description of last year's return.

| | |
|---|---|
| label | **Taxable state or local tax refund** |
| link key | `sr` (not in use) |
| default | 0 |
| section | Income details, beside Other ordinary income |
| help text, on the page, not only in a tooltip | "The part of last year's state or local income tax refund that counts as federal income (Schedule 1, line 1). If you took the standard deduction last year, none of it does: leave this at 0. If you itemized, it is usually all of it, and your tax software shows the exact amount. Your own state does not tax it. Interest paid on a refund goes in Interest. A federal refund is not income and goes nowhere." |
| files | `taxcalc_core.js`: a `DETAIL_FIELDS` row, counted in `entOrdinary`, kept out of `investOrd` and `retInc`, and passed to `calculateTaxes` as a state subtraction. `standalone/IncomeTaxPlanner.html`: the control, Share, the in-page changelog. `UsageGuide.md`: the row. |
| engine | **No change needed.** The engine's `stateExemptInterest` already subtracts an amount from state income and nothing else; `R2` above was measured through it. Renaming it to say "state subtraction" when a second user arrives would be honest, and is optional. |
| effort | Small: one entry, one row of docs, a few tests |

**Why not ask for last year's return instead.** The exact rule needs four figures from last year
(the refund, the itemized total, the standard deduction, and state and local taxes paid against the
cap) and a worksheet the user's own software has already run. Asking for them would be four inputs to
reproduce one number the user can read off a form, and the rare partial case (itemized barely above
the standard deduction, or over the cap) is the one most likely to be entered wrong. If it is wanted
later, it belongs in a small "figure it for me" helper that writes `sr`, not in the main inputs.

**Risks.** A user who itemized, sees "refund", and enters the whole refund in a year it is only
partly taxable overstates federal income by the difference; the help text names the form that
settles it. In a future year (`yr` above 2026) the refund is whatever the user expects, since the
planner does not carry a prior year's overpayment forward. Neither tool's other pages are affected:
the Optimizer has no refund concept.

---

## 3. The other candidates, ranked

Ranked by dollars of accuracy per unit of user effort. Dollar figures are on the test household
unless a case is named; "per year" is per tax year shown.

| rank | candidate | what is wrong today | size on the test household | user effort |
|---|---|---|---|---|
| 1 | `D1` California 2026 table | 2024 brackets and an 11,700 standard deduction labeled 2026 | **$287 to $459** high | none |
| 2 | `C1` California exemption credits | not applied (the CA `NOTE` says so) | **$632** high | none, ages are known |
| 3 | `RF` refund | no place for it | $143 to $166 high in CA, or $301 to $541 low federally | one amount |
| 4 | `T1` Treasury fund dividends | the state-exempt entry is capped at Interest | $465 per $5,000 of such dividends, CA | one existing entry, relaxed |
| 5 | `G1` charity, non-itemizers | not modeled | $300 to $540 per $2,000 given | one amount |
| 6 | `F1` foreign tax credit | not modeled | dollar for dollar, typically tens to a few hundred | one amount |
| 7 | `I1` other itemized deductions | federal: only property tax and computed state tax; state: never itemizes | federal $0 to $1,616; CA $307 to $400 | one amount, but a large build |

### `D1` California's 2026 table

- **Wrong today:** the brackets are 2024's and the standard deduction 11,700 against a derived 11,800.
- **Proposal:** replace `TAXData.CA` (both filing statuses) with FTB's 2026 schedule above, the
  standard deduction with 11,800 / 5,900 (derived; confirm against FTB's 2026 instructions), and keep
  the $1,000,000 surtax step where it is (it is not indexed). Fix the table's comment.
- **Files:** `taxengine.js`; pins in `taxengine.tests.js` that quote 2024 edges (`findLimitByRate('CA', 'SGL', 0.06, 1)` returns 55,867 today and would return 59,498); every engine-output pin and golden that runs a California household.
- **Risk:** this moves every California number in every tool, including the Optimizer, by design.
  Both changelogs need an entry. It also raises the question this report did not answer: **are other
  states' "2026" tables really 2026?** California's figures came from the commit "Update state tax
  data to 2026 rates across 10 states" (2026-05-23), which describes them as 2026 thresholds after
  2.971% indexing; they are FTB's 2024 figures. Nine other states were updated in the same commit.
  That audit is its own piece of work.

### `C1` California exemption credits

- **Wrong today:** two personal and two senior credits are missing: $632 for this couple, $316 for a
  single senior or an under-65 couple, $158 for a single filer under 65. Blind and dependent credits
  need inputs the planner does not have and stay out.
- **Proposal:** a data field on the state (per-person personal and senior amounts, the AGI threshold,
  $6 per $2,500), and a step in `calculateTaxes` that subtracts the credit from state tax **before**
  the federal SALT deduction reads it: the state tax a household actually pays is after its credits.
  (The engine's existing retirement-income credit, Ohio's, is applied after SALT; that ordering is
  slightly wrong too and is worth fixing in the same change.) Then drop the credit sentence from the
  California `NOTE`.
- **Files:** `taxengine.js`, `taxengine.tests.js`. Optimizer goldens move.
- **Risk:** low; the rule is mechanical and the phase-out sits far above most of this audience. Other
  states use per-person credits rather than deductions; which ones the engine models that way was not
  audited here, and the data field should be general enough to take them.

### `T1` Treasury money-market and fund dividends

- **Wrong today:** `ui` (US Treasury interest, exempt from state tax) is limited to Interest (`it`).
  A Treasury money-market fund pays **dividends**, which a user enters as non-qualified dividends
  (`nd`), so the exemption cannot reach them. California exempts the US-obligation share of a fund's
  dividends when the fund holds at least half its assets in them (Schedule CA (540) instructions,
  line 2). $5,000 of such dividends is $465 of California tax at 9.3%.
- **Proposal:** limit `ui` to `it + nd` instead of `it`, and relabel it "Treasury interest, or the
  Treasury share of fund dividends (exempt from state tax)". Federally nothing changes: those
  dividends stay ordinary dividends and stay in net investment income.
- **Files:** `taxcalc_core.js` (`deriveIncome`), the page label and help, `UsageGuide.md`.
- **Risk:** states differ on the fund threshold; the help text should say to use the exempt share the
  fund reports. Effort tiny.

### `G1` The charitable deduction for people who do not itemize

- **Wrong today:** not modeled. A secondary summary of the 2025 law (P.L. 119-21) gives a deduction of
  up to **$1,000 single / $2,000 joint** for cash gifts to public charities, for non-itemizers, from
  2026, outside AGI. **This was not confirmed against IRS text in this study**: the IRS pages read
  did not state it. Verify against the statute or an IRS publication before building.
- **Size:** a $2,000 gift saves $300 / $540 / $440 / $480 federally across the four columns. It is not
  a flat 22%: below the line it also moves the capital-gain stacking. California has no such deduction.
- **Proposal:** one entry, **Cash gifts to charity**, link key `ch`. Used as the non-itemizer
  deduction (capped) and, when `I1` exists, as part of itemized deductions.
- **Files:** `taxcalc_core.js`; `taxengine.js` gains a below-the-line deduction parameter.

### `F1` The foreign tax credit

- **Wrong today:** foreign tax withheld on international funds (Form 1099-DIV box 7) is a federal
  credit, dollar for dollar, and the planner ignores it.
- **Proposal:** one entry, **Foreign tax paid**, link key `ft`, subtracted from federal income tax and
  limited to it. Most retirees are under the amount that can be claimed without Form 1116 ($300
  single / $600 joint, the long-standing election; not re-read from IRS text for this study); above
  that the true limit needs a calculation the planner would approximate.
  No state credit.
- **Risk:** small dollars; worth doing only because it is cheap.

### `I1` Itemized deductions beyond property tax

- **Wrong today, federally:** itemizing compares only property tax plus the computed state tax
  (capped) to the standard deduction. Charity, mortgage interest and medical costs above 7.5% of AGI
  are missing. With $6,000 of property tax and $10,000 of charity this household still does not
  itemize until the 240,000 column, where it saves $1,616.
- **Wrong today, in California:** the engine never lets a state itemize. California allows property
  tax, mortgage interest, charity and medical with no cap on property tax, and no deduction for state
  income tax. $6,000 of property tax plus $10,000 of charity would save $344 to $400; **a California
  homeowner with $15,000 of property tax and nothing else already loses $264 to $307 today**, because
  California itemizing would beat its standard deduction.
- **Proposal:** one entry, **Other itemized deductions** (mortgage interest, charity, medical above the
  floor), link key `od`, and a per-state itemizing rule in the engine (which states allow it, and
  what they disallow). The 2026 federal changes for itemizers (a floor on charitable gifts, and the
  limit on the value of itemized deductions in the 37% bracket, which the IRS 2026 inflation release
  mentions without figures) have to be handled too.
- **Effort:** the largest here, because the state half is per-state data. A California-only first
  step (property tax and `od` against California's standard deduction) would take most of the value
  for most of this audience.

### Documentation only: no new control

| case | what the user should do | where to say it |
|---|---|---|
| interest paid on a refund | enter it in Interest (`it`) | the `sr` help text |
| a federal refund | enter it nowhere | the `sr` help text |
| a qualified charitable distribution from an IRA | enter the RMD net of it, since it is excluded from federal income. California's treatment was not checked in this study. | the RMD help text |
| a capital loss carried in from an earlier year | enter it as a negative short-term gain (`sg`); the planner nets it against the long-term gain and limits the rest to $3,000 | the `sg` row of `UsageGuide.md` |
| HSA contributions | the engine supports them but the planner does not pass them; people on Medicare cannot contribute, which is most of this audience. Not worth a control. | nowhere |

### Out of scope

- **Withholding and estimated payments.** The planner computes a year's tax, not a balance due.
  Scheduling payments is the Tax Payment Planner's job (`RetirementTaxPlanner.html`).
- **California SDI**, which falls on wages only, and the alternative minimum tax.

---

## 4. Recommendation

1. **`D1` and `C1` first, together.** They need nothing from the user, they are $1,091 of
   California's $1,257 gap on this household, and they apply to every California user of every tool. They
   change shared engine numbers, so they ship with a changelog entry in both tools and the goldens
   re-pinned. Follow with an audit of whether every other state's "2026" table is really 2026.
2. **`RF`, the refund input**, next: one entry, no engine change, and it closes the last of the gap.
   With 1 and 2 done the test household's California tax matches the tax program to the dollar.
3. **`T1`**, because it is a one-line limit change with real money behind it for anyone holding a
   Treasury money-market fund.
4. **`G1` and `F1`** as one small release of two entries, after `G1`'s rule is confirmed.
5. **`I1`** only if itemizers turn out to be a real share of the audience, starting California-only.
