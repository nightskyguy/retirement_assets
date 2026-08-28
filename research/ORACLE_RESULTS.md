# P51 results — perfect-foresight oracle (conversions + withdrawal split)

**Run:** 2026-08-10, engine at `5e1075e` + the P51b hook (uncommitted), suite 242/242.
**Harness:** `node .test_harnesses/oracle_harness.js` (P51a) / `--full` (P51c-g).
15 cells (Stage-1 mix ladder x spend 4/6/8%, wealth x1). 165,131 sims, 196s sequential node.
**Objective:** wealth-only real after-tax NW at the cell's shared heirs rate, **spend pinned**
(candidates with shortfall > $1 or delivered spend ≠ base ± $1 are discarded). Backstops
instrumented, never bypassed.

## What the oracle IS and IS NOT (read first)

Perfect foresight on ONE deterministic path: an upper-bound **diagnostic**, never a policy.
And it is a ceiling only over what its two levers control — per-year `extraConversionAmount[]`
and the per-year `oracleWithdrawalPlan` split across IRA/Brokerage/Cash/Roth. **It does NOT
control surplus routing**, and this showed up in the data: in `defaults @6%` two cyclic rows
BEAT the oracle (gaps −0.31%, −0.19%), because cyclic's surplus-to-Brokerage routing is a
mechanism the withdrawal menu cannot express, and the hook refuses to compose with cyclic by
design. Two honest consequences:

1. Coordinate descent over a 10-archetype menu is local and coarse — treat every oracle number
   as a LOWER bound on the true ceiling (P51d's cross-check remains open).
2. The negative gaps are themselves the attribution: **cyclic's residual edge lives in surplus
   routing, not in draw order** — consistent with Stage 1's q3 confound finding.

## P51a — conversions-only (champion base, 15/15 cells)

| finding | number |
|---|---|
| Oracle gain over the champion row | **0 – 2.87%** (max +$241,415, round1 @4%) |
| Best flat scalar (core's own `optimizeConversionAmount`) | **$0 in 15 of 15 cells** |
| S3-P1 (oracle beats flat by <3% in most cells) | **RIGHT**, 15/15 |

The flat sweep finds nothing on champion arms while per-year timing finds up to $241k —
**per-year conversion shapes are genuinely inexpressible to the flat sweep**, the same
conclusion `bestTimeLimitedConversion` reached from the other direction. Timing clusters
mid-plan (post-SS / pre-and-around RMD), not in a single early burst.

Two methodology fixes are load-bearing and pinned in the harness comments: champion selection
must use `baselineScore` (wealth-only lets GK buy the slot by cutting spend), and every
candidate must pin delivered spend to the base row (without the pin, a GK base showed a fake
+81% that was pure spend-shifting).

## P51c/e — full oracle and the gap-to-oracle table (non-cyclic base per cell)

Per-cell decomposition (base → +conversions → +withdrawal-split), non-GK cells first:

| cell | base row | +conv | +split | best-family gap | Proportional gap |
|---|---|---|---|---|---|
| defaults @4% | Reduce 20 [cash] | +$72k | +$35k | 1.53% (IRA Draw) | 2.34% |
| defaults @6% | IRA Draw 7 [cash] | +$160k | +$19k | **−0.31%** (cyclic IRA Draw) | 5.45% |
| defaults3x @4% | IRA Draw 5 [cash] | **+$1,078k** | +$36k | 10.47% (IRA Draw) | 11.62% |
| round1 @4% | IRA Draw 6 [cash] | +$241k | +$105k | 3.89% (IRA Draw) | 10.47% |
| thirds @4% | IRA Draw 5 | +$2k | +$170k | 1.46% (IRA Draw) | 6.02% |
| brokheavy @4% | Ordered CBIR | $0 | $0 | **0.00%** | — |

GK-base cells (6/8% spend, where only GK survives at the base's delivered spend — their gap
tables contain only GK itself): +split reaches **+$461k** (thirds @6%) and +conv **+$236k**
(defaults @8%); oracle gains over the GK base run 0.5% – 20%.

**Attribution:** conversion timing dominates in IRA-heavy mixes (defaults3x @4%: 97% of the
gain is conversions); the withdrawal split matters most in balanced/brokerage mixes and
high-strain GK cells but stays second fiddle. `brokheavy @4%` is the boundary case: Ordered
CBIR already sits AT the expressible ceiling — the oracle changed nothing.

**Answer to question C (the absolute half):** "Proportional is default-optimal" is **REFUTED**
on this grid — its gap to the oracle runs 2.3% – 11.6% where measurable, and IRA Draw
dominates it in every cell. (The comparative half was already refuted by Stage 1's rankings.)

**Answer to question A:** difficulty as measured — conversions-only needed ZERO engine change
and ~5s/cell; the full dance needed one default-off hook pair (~40 lines) plus this harness at
~10s/cell. Whole-horizon optimization on this engine is cheap enough to be a standard research
instrument; it is only its POLICY use that is out of bounds.

## P51f — trajectory post-mortem (observation only, ships nothing)

- **No harvest-like alternation** (S3-P3 WRONG: 1/6 thirds/brokheavy cells with ≥3 IRA↔Brok
  flips). The oracle does not rediscover cyclic's rhythm through the withdrawal menu.
- The recurring shape instead: **family-default or IRA-led years through mid-plan, then a
  solid Roth-spending tail** in the final ~5-10 years, with Brokerage held to the §1014
  step-up. Rational in-model: Roth compounds tax-free longest, terminal brokerage gains are
  erased anyway. This is a perfect-foresight artifact to NOTICE, not a rule to ship.
- Backstops stayed silent everywhere: forced-IRA years = 0 in 15/15 accepted solutions
  (S3-P4 RIGHT).

## P51g — heirs-rate sensitivity (full re-optimization at 0.15 / 0.35)

- defaults @6%: gain $183k at rate 0.15 → $254k at 0.35, conversion years 17 → 21.
  Conversions are worth more when the heirs rate is higher — correct direction, and the oracle
  responds by converting MORE.
- thirds @6%: gain $755k / $670k with only 3-5 conversion years — the gain here is the
  Roth-tail split, nearly rate-insensitive.

## Predictions scored

| id | prediction | verdict |
|---|---|---|
| S3-P1 | conv-only oracle beats flat scalar by <3% in most cells | **RIGHT** (15/15) |
| S3-P2 | median best-family gap < 4% | **WRONG** — median 4.35% (GK-only cells inflate it; non-GK cells run 0–10.5%) |
| S3-P3 | harvest-like alternation in brokerage-heavy mixes | **WRONG** — 1/6; the oracle prefers the Roth tail |
| S3-P4 | backstops quiet (<5% forced-IRA years) | **RIGHT** — 0 forced years, 15/15 |

## Open

- **P51d** (independent search cross-check) — now sharpened: the cyclic negative gaps prove
  the menu+descent combination is not a true ceiling; a cross-check should bound how far below
  the ceiling it sits.
- The GK-base cells need a fixed-spend base to produce family gap tables at 6-8% spend
  (candidate: run those cells at the highest spend a fixed-spend arm survives).

## Coverage — what was actually varied (guard against extrapolating past it)

The oracle grid is the Stage-1 ladder at **wealth x1 only** — NARROWER than the Stage-1/2
scans. 15 cells = 5 mixes x spend 4/6/8% of assets:

| mix | total | IRA share | Roth share | Brok share | basis/Brok | spend range |
|---|---|---|---|---|---|---|
| defaults | $1.62M | 86.4% | 4.3% | 6.2% | 50% | $64.8k – $129.6k |
| defaults3x | $4.86M | 86.4% | 4.3% | 6.2% | 50% | $194.4k – $388.8k |
| round1 | $3.90M | 64.1% | 9.0% | 23.1% | 55.6% | $156k – $312k |
| thirds | $4.35M | 32.2% | 32.2% | 32.2% | 50% | $174k – $348k |
| brokheavy | $4.55M | 22.0% | 13.2% | 61.5% | 42.9% | $182k – $364k |

So: totals **$1.62M – $4.86M**, IRA share 22–86%, Brokerage share 6–62%, annual spend
**$64,800 – $388,800**, basis fraction **20% / mix default (43-56%) / 80%** (basis-axis
extension below). The x0.5 and x3 wealth points of the Stage-1 grid were NOT run through
the oracle (runtime); every oracle conclusion is untested below $1.6M and above $4.9M, where
bracket-absolute effects (IRMAA cliffs, 0%-LTCG ceiling vs portfolio size) shift.

**Held fixed:** couple 64/62, die 92/94 (deaths 2054/2058, only 4 survivor years), SS
$45k+$24k, no pension, CA, growth 6% / inflation 2.5% / dividends 2%, spend flat, CashReserve
off. Family gap tables additionally require rows at the base row's exact delivered spend, which
at 6-8% strain excludes most fixed-spend families in GK-base cells (counted per cell above).

## Basis-axis extension (2026-08-10, closes the 43-56% basis gap)

The grid was rebuilt at basis 20% and 80% — **45 cells total** (5 mixes x 3 spend x 3 basis
arms), 511k sims / 562s. Prediction **B-P4 (pre-registered) RIGHT**:

- Median best-family gap: **4.47%** at basis 20% > 4.35% at default > **1.83%** at basis 80% —
  more embedded gain = more tax terrain = more oracle alpha, exactly the §1014-driven direction.
- **Proportional's minimum gap stays > 2% at both extremes** (2.4% at b20, 2.3% at b80) — the
  "default-optimal REFUTED" verdict is basis-stable.
- Conversions-only gains GROW off the default basis: max 2.87% (default) → **9.00%** at b20 and
  **6.45%** at b80 (e.g. defaults3x @4% b80: +$408k, Ordered CBIR champion). Per-year
  conversion timing matters MORE when the brokerage is not mid-basis, in both directions.
- Backstops stayed silent in **45/45** cells (S3-P4 extended).

Published S3-P1..P4 scores above remain keyed to the default-basis arm for comparability.

## Scope limits

One deterministic path (6%/2.5%), CA only, one age/SS profile, wealth x1 only, aggregate basis
(no lots), one-sided ACA, no SECURE 10-yr heirs, §1014 at terminal row. The oracle overfits
the known path by construction; nothing here ships without the axis-property + pinned-test bar.
