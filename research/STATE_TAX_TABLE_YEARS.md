# State tax tables: which year each one really carries

**Audit date 2026-11-11, on `main` at `5e11da4`.** Research only: `taxengine.js` is not changed here.
Every correction below is listed with its source so they can ship as one data change.

## Why this was run

Every state block in `TAXData` (`taxengine.js`) is stamped `YEAR: 2026`. A research pass on the
Income Tax Planner (`research/INCOME_TAX_PLANNER_INPUTS.md`, on branch
`worktrees/itp-refund-inputs-research-36b74f`, not yet merged) found that `TAXData.CA` is in fact the
Franchise Tax Board's **2024** schedule, put in by commit `654694f` (2026-05-23, "Update state tax
data to 2026 rates across 10 states") with a comment saying it had been indexed to 2026. That commit
changed nine other states the same day: NC, GA, MI, IL, NY, OR, VA, DC, NE. This report checks those
nine first, then every other state block stamped 2026.

Two facts about the engine decide how much a stale table matters:

- **The engine reads only `std` and `brackets`.** `calculateTaxes` subtracts `stateData[status].std`
  (or the federal amount when it is `'FEDERAL'`) and runs `calculateProgressive` on what is left. An
  `exemption:` field is ignored, so a state's personal exemption counts only if it has been folded into
  `std` (IL, MA, CT, IN and OH do this; MI, MD and ME do not, see below).
- **A stale base year never catches up.** Thresholds and `std` are multiplied by the plan's own
  inflation factor from the first plan year, so a 2024 table stamped 2026 stays two years of indexing
  behind in every year of every projection, not only in 2026.

## Reading guide

**Verdicts**

| verdict | meaning |
|---|---|
| **MATCHES** | every bracket ceiling, rate and `std` equals the state's published tax year 2026 figure |
| **OLDER (year)** | the figures are a prior year's published figures, named |
| **WRONG** | the figures are not any year's published schedule: a structural or transcription error |
| **NOT PUBLISHED** | the state has not yet published the 2026 figure the table needs; the table holds the latest one |

A state can carry more than one verdict, one per field.

**Source tiers** (column "src")

| code | meaning |
|---|---|
| **P** | the state's own publication (rate schedule, estimated-tax or withholding instructions), fetched and read in this pass |
| **L** | the enacting law or the governor's signing release, fetched in this pass |
| **C** | checked against the state's own form in an earlier commit (`8aaed37` on 2026-09-22 or `54fb86d` on 2026-09-25, each naming its form); not re-fetched here |
| **S** | statutory flat rate, not indexed, no 2026 change found; not re-fetched here |

**"Effect"** is hand arithmetic in 2026 dollars for a household where the error binds fully, with the
sign stated: *overstates* means the tool charges more state tax than the state does.

Withholding formulas were used as a 2026 source only where they demonstrably carry the tax
schedule itself: Oregon's 2025 withholding formulas (150-206-436, Rev. 12-10-24) reproduce exactly
the 2025 thresholds and standard deductions printed in Oregon Publication OR-17, so the 2026 formulas
were taken as the 2026 schedule.

## Verdict table

### The nine states commit `654694f` changed, plus California

| state | verdict | what the table has | published 2026 figure | src | effect |
|---|---|---|---|---|---|
| **CA** | **OLDER (2024)** brackets; std 2024-ish | MFJ ceilings 21,512 / 50,998 / 80,490 / 111,734 / 141,212 / 721,318 / 865,574; std 11,700 / 5,850 | MFJ 22,912 / 54,314 / 85,722 / 118,996 / 150,394 / 768,218 / 921,854 / 1,536,426; SGL 11,456 / 27,157 / 42,861 / 59,498 / 75,197 / 384,109 / 460,927 / 768,213; std 11,800 / 5,900 (derived, see corrections) | P (FTB 2026 Schedules X and Y, via the ITP report) | overstates up to about $450/yr |
| **OR** | **OLDER**: brackets 2023, std 2024 | SGL 4,050 / 10,200 / 125,000, MFJ 8,100 / 20,400 / 250,000; std 2,745 / 5,495 | SGL 4,550 / 11,400 / 125,000, MFJ 9,100 / 22,800 / 250,000; std 2,910 / 5,820 | P | overstates about $96/yr MFJ, $48 SGL |
| **MI** | rate MATCHES; std **OLDER (2024)** and **WRONG** for MFJ | 4.25%; std 5,600 for both statuses | 4.25%; personal exemption 5,900 per person, so 11,800 MFJ / 5,900 SGL | P (rate notice 2026-04-15; Treasury withholding page) | overstates $264/yr MFJ, $13 SGL |
| **DC** | brackets MATCH; std **NOT PUBLISHED** (and contested) | std 30,000 / 15,000 | brackets unchanged. D.C.'s own 2025 standard deduction is 30,000 / 15,000; its FY2027 Budget Support emergency act says 2026 is that amount indexed for cost of living, but OTR has published no 2026 figure, and OTR's own FAQ still says the deduction "is now aligned with the federal standard deduction" (32,200 / 16,100) | L (EY alert on B26-0724), P (OTR FAQ) | between about $50 and $190/yr overstated, depending on which rule stands |
| **NY** | **MATCHES** | rates 3.9 / 4.4 / 5.15 / 5.4 / 5.9 / 6.85 / 9.65 / 10.3 / 10.9%; MFJ ceilings 17,150 ... 25,000,000; std 16,050 / 8,000 | identical, IT-2105-I (2026) tax rate schedules | P | none |
| **IL** | **MATCHES** | 4.95%; std 5,850 / 2,925 | 4.95%; exemption allowance $2,925 (Booklet IL-700-T, 2026) | P | none |
| **NC** | **MATCHES** | 3.99%; std 25,500 / 12,750 | 3.99% (NCDOR 2026 estimator worksheet); std not indexed, 25,500 / 12,750 | P, C | none |
| **GA** | **MATCHES** | 4.99%; std 30,000 / 15,000; retirement exclusion 35,000 / 65,000 | HB 463: 4.99% from 2026-01-01, std raised from 2026, retirement exclusion rises to 70,000 only from 2027 | L, C | none |
| **VA** | **MATCHES** | 2 / 3 / 5 / 5.75% at 3,000 / 5,000 / 17,000; std 17,500 / 8,750 | identical; Virginia Tax: std "remains at $8,750 ... and $17,500" for 2026 | P | none (but see stale NOTE below) |
| **NE** | **MATCHES** | 2.46 / 3.51 / 4.55%; SGL 4,130 / 24,760, MFJ 8,250 / 49,530; std 8,850 / 17,700 | 2026 Nebraska Tax Calculation Schedule 8-460-2026 | C | none |

### Every other state stamped 2026

| state | verdict | what the table has | published 2026 figure | src | effect |
|---|---|---|---|---|---|
| **MD** | std **OLDER (2025)**; MFJ brackets **WRONG**; 6.25% band **WRONG** for both statuses | MFJ uses the SINGLE thresholds below 5.75% (100,000 / 125,000 / 150,000 / 250,000), 5.75% to 600,000, then a $1-wide 6.25% band and 6.5% from 600,001; SGL the same $1-wide 6.25% band at 500,000; std 6,700 / 3,350 | MFJ 4.75% to 150,000, 5% to 175,000, 5.25% to 225,000, 5.5% to 300,000, 5.75% to 600,000, 6.25% to 1,200,000, 6.5% above; SGL 6.25% from 500,000 to 1,000,000; std 3,400 single (2026 withholding guide), 6,800 joint (derived) | P (Comptroller tax alert rev. 2025-12-22; resident booklet Tax Rate Schedules I and II; 2026 withholding guide) | MFJ overstates $437 at $250k taxable, $562 from $300k up to $600k, then up to $2,062 at $1.2M; SGL up to $1,250 between $500k and $1M |
| **ME** | brackets **MATCH**; std **WRONG**; pension cap **OLDER (2025)** | MFJ 54,850 / 129,750, SGL 27,400 / 64,850; std `'FEDERAL'`; no exemption; pension cap 48,216 | brackets identical; std 31,400 / 15,700 (Maine's own, not federal) PLUS personal exemption 5,300 per person; pension cap 49,824; new 2% surcharge above $1,500,000 MFJ / $1,000,000 SGL | P (MRS 2026 rate schedule rev. 2026-05-20; 2026 1040ES) | net overstates about $569/yr MFJ, $284 SGL (missing exemption outweighs the higher federal std); up to $109/person more from the cap; understates above the surcharge line |
| **MS** | rate **MATCHES**; std **WRONG** | 0% to 10,000 then 4%; std `'FEDERAL'` | 4% above 10,000 (DOR 2026 notice); std 4,600 / 2,300 plus exemptions 12,000 / 6,000, so 16,600 / 8,300 | P (rate, via Bloomberg Tax report of the DOR release); std from long-standing statute, not re-fetched | understates up to $624/yr MFJ, $312 SGL, on non-retirement income only |
| **ID** | rate and std **MATCH**; zero band **NOT PUBLISHED** | 0% to 9,622 / 4,811, then 5.3%; std `'FEDERAL'` | 5.3% unchanged for 2026 (Tax Commission withholding update, Aug 2026); std = federal 32,200 / 16,100; 9,622 / 4,811 is the 2025 indexed zero band, 2026 figure due with the 2026 Form 40 instructions | P (withholding update via EY), S | about $14/yr, negligible |
| **MA** | **MATCHES** what it models | 5%; std 8,800 / 4,400 | 5%; exemptions 8,800 / 4,400 (not indexed). The 4% surtax on income above $1,107,750 (2026) is not modeled at all | P (mass.gov tax rates) | understates 4% of income above $1,107,750 |
| **OH** | **MATCHES** | 0% to 26,050, then 2.75%; std 4,800 / 2,400 | HB 96: flat 2.75% above 26,050 from 2026; exemptions not indexed for 2025-2026. $2,400 is the low-income tier ($1,900 above $80,000 MAGI; none above $500,000) | L (LSC analysis, EY) | understates up to $27/yr MFJ |
| **CO** | **MATCHES** | 4.4%; std `'FEDERAL'` | 4.4% statutory. A TABOR-surplus temporary reduction is possible for 2026 but none had been announced | S | none |
| **CT** | **MATCHES** | 2 / 4.5 / 5.5 / 6 / 6.5 / 6.9 / 6.99%; exemptions 24,000 / 15,000 | unchanged for 2026 (exemption indexing in HB 5444 starts 2028). The exemption phase-out is not applied, which the block's NOTE already says | S | none new |
| **IN** | **MATCHES** | 2.95%; exemptions 2,000 / 1,000 | 2.95% for 2026 | C | none |
| **KY** | **MATCHES** | 3.5%; std 3,360 | 3.5%, std 3,360 | C | none |
| **MN** | **MATCHES** | 2026 schedule, std 30,600 / 15,300 | MN DOR 2025-12-16 | C | none |
| **MT** | **MATCHES** | 4.7% to 95,000 / 47,500, then 5.65%; std federal | HB 337 | C | none |
| **ND** | **MATCHES** | 0% to 82,800 / 49,575, 1.95% to 304,850 / 250,400, then 2.5% | 2026 ND-1ES | C | none |
| **SC** | **MATCHES** | 1.99% / 5.21% at 30,000; std 30,000 / 15,000 | H. 4216 | C | none |
| **WI** | **MATCHES** | 2026 schedule, std max 25,840 / 13,960 | WI 2026 Form 1-ES | C | none |
| **AZ** | **MATCHES** | 2.5%; std federal | 2.5%, federal std | C, S | none |
| **AL** | **MATCHES** (rates) | 2 / 4 / 5% at 1,000 / 6,000 (MFJ) | statutory since 2006, not indexed | S | not audited for structure |
| **PA** | **MATCHES** | 3.07% | statutory | S | none |
| **IA** | **MATCHES** | 3.8%; std federal | 3.8% from 2025 | S | none |

**Summary.** Of 29 taxing jurisdictions, 21 match 2026 as far as their tables reach. **Two carry an
older year's figures throughout (CA 2024, OR 2023/2024)**, one carries an older exemption and the
wrong count of exemptions (MI), **one has a bracket schedule that matches no year (MD)**, two use the
federal standard deduction where the state has its own (ME, MS), and two hold the latest published
figure while the 2026 one is still unpublished (DC, ID).

Of the ten states `654694f` touched, two were already corrected in September (VA's 24,000 / 12,000
standard deduction and phantom 7% bracket in `8aaed37`, NE's flat 4.55% in `54fb86d`). Of what is
left from that commit, the **inflation-indexed figures are the ones that are stale**: CA's brackets
and std, OR's brackets (2023) and std (2024), and DC's std. The legislated rates (NC, GA, MI, NY) and
IL's published exemption hold up. That is the pattern to expect from a pass that reasoned forward
from an older table instead of reading the 2026 publication. MI's 5,600 std predates that commit.

## Corrections needed, as one data change

All in `TAXData`, `taxengine.js`. Ordered by size of effect.

1. **MD** (structural, largest single-household error)
   - MFJ brackets: `{1000, .02}, {2000, .03}, {3000, .04}, {150000, .0475}, {175000, .05},
     {225000, .0525}, {300000, .055}, {600000, .0575}, {1200000, .0625}, {Infinity, .065}`.
   - SGL brackets: keep the lower rows; replace the tail with `{500000, .0575}, {1000000, .0625},
     {Infinity, .065}` (removes the `{500001, .0625}` row that makes the 6.25% band $1 wide).
   - `std`: 6,800 / 3,400. The single figure is the 2026 withholding guide's; the joint figure is
     derived (the law sets joint at twice single: 3,350 / 6,700 for 2025) and should be confirmed
     against the 2026 Form 502 instructions when they appear.
   - Decide whether to fold in the $3,200 per-person exemption (it phases out between $100,000 and
     about $200,000 of federal AGI depending on status, which the engine cannot do), and say so in the
     NOTE either way. Folding it in at full value understates tax above the phase-out.
   - Pension exclusion cap: the table's 40,600 matches no year found; the 2025 booklet says 41,200.
     Use the 2026 figure when the Comptroller publishes it.
   - Sources: [Comptroller tax alert, rev. 2025-12-22](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/legal-publications/alerts/tax-alert-changes-to-standard-and-itemized-deductions-and-to-state-and-local-income-tax-rates-from-the-2025-legislative-session.pdf),
     [2025 resident booklet, Tax Rate Schedules I and II](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/2025/resident-booklet.pdf),
     [2026 withholding guide](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/withholding-guide.pdf).
2. **ME**
   - `std`: 42,000 MFJ / 21,000 SGL (Maine standard deduction 31,400 / 15,700 plus the 5,300
     per-person exemption), replacing `'FEDERAL'`. Both phase out at high income, unmodeled.
   - Pension cap: 48,216 -> 49,824.
   - Note the new 2% surcharge above $1,500,000 MFJ / $1,000,000 SGL in the NOTE, or add it as a
     bracket row (it is a surcharge on taxable income above a line, so a row works: `{1500000,
     .0715}, {Infinity, .0915}` MFJ).
   - Sources: [MRS 2026 rate schedule](https://www.maine.gov/revenue/sites/maine.gov.revenue/files/2026-05/ind_tax_rate_sched_2026_rev.pdf),
     [MRS 2026 1040ES](https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/26_1040es_fillable.pdf).
3. **CA**
   - MFJ: `{22912, .01}, {54314, .02}, {85722, .04}, {118996, .06}, {150394, .08}, {768218, .093},
     {921854, .103}, {1000000, .113}, {1536426, .123}, {Infinity, .133}`.
   - SGL: `{11456, .01}, {27157, .02}, {42861, .04}, {59498, .06}, {75197, .08}, {384109, .093},
     {460927, .103}, {768213, .113}, {1000000, .123}, {Infinity, .133}`.
     (The `1000000` rows are the 1% Mental Health Services surcharge, unchanged in shape.)
   - `std`: 11,800 / 5,900. FTB had not published these when the ITP report was written; they are
     2025's 11,412 / 5,706 times FTB's 2026 inflation factor (1.03403 from the ITP report), rounded.
     Replace with the published figures when the 2026 Form 540 instructions appear.
   - Replace the comment that says the thresholds were indexed by 2.971%.
   - Source: FTB 2026 tax rate schedules, as recorded in `research/INCOME_TAX_PLANNER_INPUTS.md`.
4. **MS**
   - `std`: 16,600 MFJ / 8,300 SGL (standard deduction 4,600 / 2,300 plus exemption 12,000 / 6,000),
     replacing `'FEDERAL'`. Confirm against the 2026 Form 80-105 instructions before shipping; this
     audit took those amounts from statute and secondary sources, not a fetched MS DOR document.
   - NOTE: "flat 4.3%" -> "flat 4%".
5. **MI**
   - `std`: 11,800 MFJ / 5,900 SGL (personal exemption $5,900 per person).
   - Source: [Treasury withholding page, 2026 personal exemption $5,900](https://www.michigan.gov/taxes/business-taxes/withholding/calendar-year-tax-information);
     rate [Treasury notice, 2026-04-15](https://www.michigan.gov/treasury/news/2026/04/15/state-individual-income-tax-rate-for-2026-tax-year-determined).
   - The retirement cap 67,610 per person agrees with secondary sources citing Revenue Administrative
     Bulletin 2026-1; the RAB itself was not fetched.
6. **OR**
   - MFJ: `{9100, .0475}, {22800, .0675}, {250000, .0875}, {Infinity, .099}`; SGL: `{4550, .0475},
     {11400, .0675}, {125000, .0875}, {Infinity, .099}`; `std` 5,820 / 2,910.
   - Source: [Oregon Withholding Tax Formulas 150-206-436, Rev. 12-31-25](https://www.oregon.gov/dor/forms/FormsPubs/withholding-tax-formulas_206-436_2026.pdf),
     cross-checked against [Publication OR-17 (2025)](https://www.oregon.gov/dor/forms/FormsPubs/publication-or-17_101-431_2025.pdf).
7. **Hold, do not change yet**
   - **DC** `std`: wait for OTR's 2026 D-40 figure. If D.C.'s own indexed amount stands it will be
     about 30,000 x (1 + 2025-26 CPI); if federal conformity stands it is 32,200 / 16,100.
     Sources: [EY on B26-0724](https://taxnews.ey.com/news/2026-1962-district-of-columbia-budget-bill-decouples-from-select-obbba-provisions-delays-sales-and-use-tax-rate-increase-increases-hotel-and-car-rental-tax-rates-requires-bat-study),
     [OTR FAQ](https://otr.cfo.dc.gov/book/individual-income-tax-filing).
   - **ID** zero band: wait for the 2026 Form 40 instructions.

### Stale comments and NOTEs found on the way

These do not move a number but say something false about the block, which is how `654694f`'s CA
comment survived.

| state | text | fact |
|---|---|---|
| CA | comment: thresholds "inflation-adjusted by CA FTB (~2.971% CCPI)" | they are FTB's 2024 figures |
| IN | comment: "flat 3.05% ... 2026 rate confirmed 3.05%" | value is 2.95%, which is the 2026 rate |
| KY | comment: "flat 4.0% ... revenue trigger not met for 2026 reduction" | value and NOTE are 3.5%, the 2026 rate |
| SC | comment: "Act 47 (2022) phase-down: 6.5% -> ... 6.1%" | the block is H. 4216's 1.99% / 5.21% |
| ME | comment: "MAINE - 2025" | brackets are 2026 |
| WI | comment: "WISCONSIN - 2025" | figures are 2026 |
| MS | NOTE: "flat 4.3%" | 4% for 2026, which is what the table charges |
| VA | NOTE: the higher std "sunsets after TY2026 unless extended" | the 2026 Appropriation Act extended it: 9,200 / 18,400 for 2027 |

## What this did not cover

- Structure beyond year: AL's income-dependent standard deduction and personal exemption, VA's
  personal exemption, and the exemption phase-outs in CT, IL, MD and ME were seen but not audited.
- The `RETIREMENT_EXCLUSION` caps were checked only where they are indexed and a 2026 figure turned
  up (GA, ME, MD, MI). WI, KY, CO, NY, IA, PA, AL and the others were not.
- No-tax states (`NO_TAX_SHELL`) carry no figures to check.
- Effects are hand arithmetic, not engine runs. The CA figure is the one engine measurement, from the
  ITP report.
