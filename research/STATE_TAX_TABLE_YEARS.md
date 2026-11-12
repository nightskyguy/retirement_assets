# State tax tables: which year each one really carries

**Audit date 2026-11-11, on `main` at `5e11da4`.** Every `TAXData` state block (`taxengine.js`) was
stamped `YEAR: 2026`; this checked each one against the state's own 2026 publication. 21 of 29
matched. The eight that did not (CA, OR, MD, MI, ME, MS, plus DC and ID, which wait on unpublished
figures) and eight stale comments were corrected in **11.1d93**, and each state block now carries a
`SOURCES` map naming the publication behind each figure. This report now holds only what is still
open. The full audit, with every corrected figure and its source, is in this file's history at
commit `4541674`.

## Reading guide

**Source status**, the `status` field of each `SOURCES` entry in `taxengine.js`:

| status | meaning |
|---|---|
| **published** | read from the state's own publication or statute for that tax year |
| **derived** | computed from published figures (for example joint = 2 x single), not yet printed by the state |
| **pending** | the state has not published this year's figure; the table holds the latest one |
| **unverified** | carried over, not yet checked against a publication |

`checkStateSources()` fails any entry whose year is behind `TAXData.FEDERAL.YEAR` unless it is marked
pending, and TEST CASE 28 in `taxengine.tests.js` prints every entry that is not `published` on each
run. That list is the live version of the table below.

**"Effect"** is hand arithmetic in 2026 dollars for a household where the gap binds fully, with the
sign stated: *overstates* means the tool charges more state tax than the state does.

## Still open

| state | field | status | what is needed | effect |
|---|---|---|---|---|
| DC | `std` | pending (2025) | OTR's 2026 D-40 figure. D.C.'s FY2027 Budget Support emergency act indexes its own 30,000 / 15,000; OTR's FAQ still says the deduction follows the federal one (32,200 / 16,100). Whichever stands goes in | overstates between about $50 and $190/yr |
| ID | `brackets` (0% band) | pending (2025) | the 2026 Form 40 instructions; 9,622 / 4,811 is the 2025 indexed band | about $14/yr |
| MD | `RETIREMENT_EXCLUSION` cap | pending (2025) | the 2026 pension exclusion cap; the table holds 2025's 41,200 | small |
| MD | `std` (joint) | derived | the 2026 Form 502 instructions; 6,800 is twice the withholding guide's 3,400 single, as the statute sets it | none if confirmed |
| AL | `std` | unverified | Alabama's income-dependent standard deduction and its personal exemption, neither audited | not measured |

Withholding formulas were used as a 2026 source only where they carry the tax schedule itself:
Oregon's 2025 withholding formulas (150-206-436, Rev. 12-10-24) give the same thresholds and standard
deductions as Publication OR-17 (2025), so the 2026 formulas stand for the 2026 schedule.

The citations marked `published` for states checked in earlier commits (MN, MT, ND, NE, SC, WI, KY,
IN, AZ, NC) or taken from statute (AL rates, CO, CT, IA, PA) name the form or statute but were not
re-fetched in this pass.

## Found while applying the corrections

- **Mississippi's combined return.** A married couple filing a combined return gets the $10,000 0%
  band on each spouse's income, so $20,000 together; the table gives one. Tax is overstated by up to
  $400/yr for a couple who both have income (the MS `NOTE` says so).

Personal exemptions, credits, age-65 add-ons and per-figure indexing, which this audit did not cover,
were modeled in 11.1d9d (`ALLOWANCES`, `SURTAXES`, `STD_INDEXED` and per-row `indexed` in
`taxengine.js`). What remains open there - the 2026 Oregon and Nebraska credits, the AZ, GA and MN
add-ons, Connecticut's Table E, the federal senior-deduction conformity of the states that start from
federal taxable income - is each state's `SOURCES.ALLOWANCES` entry, printed by TEST CASE 28.

## What this audit did not cover

- The `RETIREMENT_EXCLUSION` caps other than GA, ME, MD and MI.
- No-tax states (`NO_TAX_SHELL`) carry no figures to check.
- Effects are hand arithmetic, not engine runs.
