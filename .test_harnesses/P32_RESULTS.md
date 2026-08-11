# P32 results — Q1 re-run, Q3 (does cyclic win), Q4 (cycleLTCGTarget)

**Run:** 2026-08-10, engine at `5e1075e` (post dividend fix `e9a3c8b`, post basis step-up
v11.1499). **Harness:** `node .test_harnesses/brokerage_harness.js` (q1/audit/q2 unchanged;
q3/q4 added, P32e). Q3/Q4 run the Optimizer's own enumeration (192 arms, nerdknob configuration)
over the Stage-1 45-cell grid (P28 5-mix ladder x wealth x0.5/1/3 x spend 4/6/8%), scored with the
UI's recipe: shared per-cell heirs rate, `baselineScore` / real after-tax NW.

## Q1 re-run on the corrected engine (P32d precondition)

Share of years drawing Brokerage, by gap-fill family, vs the 2026-08-06 numbers measured on the
double-crediting engine:

| family | pre-fix | now | direction |
|---|---|---|---|
| baseline | 90.4% | 92.7% | UP |
| bracket | 61.1% | 62.2% | UP |
| cyclic | 57.5% | 56.7% | DOWN 0.8pt |
| ordered | 44.7% | 45.8% | UP |

Never-draw rows: still **0 of 55**. Ordered sub-order: CBIR 51.7% > BIRC 46.7% > RIBC 39.2%
(same ordering conclusion as pre-fix; P3's BIRC-first prediction stays WRONG).

**S1-P4 scored WRONG on a technicality:** three of four families rose as predicted, but cyclic
fell 0.8pt. The premise refutation stands unchanged — Brokerage is drawn constantly.

## Q3 — does cyclic ever win? YES, and about half the headline is a confound

Family-level best cyclic clone vs best non-cyclic row, success required, spend equal within $1,
Δ real after-tax NW at the cell's shared heirs rate.

**Shipped behavior (legacy CashReserve — non-cyclic surplus parks in Cash):**
- Cyclic wins in **26/45 cells (58%)**. S1-P2 (<15%) scored **WRONG**.
- Wins are NOT concentrated in brokerage-heavy mixes (9/26 in thirds+brokheavy; `defaults` leads
  at 7/9) — the annex prediction had the geography backwards.
- Largest wins: **+$1.9M** (Ordered CBIR ira-first, defaults x0.5 @4%), +$1.7M, +$1.6M — all
  4%-spend IRA-heavy cells.

**Confound control (`CashReserve: 0` — BOTH arms reinvest surplus into Brokerage):** a cyclic
clone differs from its twin in three ways: harvest-year branch preemption, surplus routed to
Brokerage instead of Cash (`optimizer_core.js:2065`), forced DRIP (inert here, base already
reinvests). Under legacy rules the non-cyclic arm suffers exactly the surplus-cash-drag P2
documented, so the legacy A/B attributes the bundle, not the harvest. With the routing equalized:
- Cyclic still wins **23/45 cells** — the effect is real, not just routing.
- But the magnitude halves: max win **$890,626** (Proportional 0% brokerage-first, brokheavy x3
  @4%), and the winner geography flips to what the annex predicted: x3-wealth, brokerage-heavier
  cells, mostly **[brokerage-first]** clones.
- Reading: roughly half the shipped-behavior delta is surplus routing; the remainder is genuine
  harvest value (0% LTCG basis step-up + the cheaper draws it enables later).

Note: `Proportional 0%` and `Guyton-Klinger` post identical deltas in several control cells — on
a smooth deterministic path GK never triggers a guardrail and degenerates to the engine fallback,
so those rows are twins. ACA rows are not excluded here (untenability hits both sides of the pair
equally), but ACA family wins inherit the one-sided-pricing caveat.

**Harvest-year money-on-the-table (descriptive; the causal number is Stage 2's q6):** pooled over
successful cyclic rows, 28,390 harvest years drew only $4.1M of IRA (and $8.7k of conversions —
the surplus-conversion cap at `:1984-1988` zeroes them). Forgone IRA draw per harvest year,
using each arm's own IRA-year mean: **~$111,700**. Median per-row forgone equals **57.1%** of the
row's lifetime voluntary IRA draws. Question B is very much alive.

## Q4 — `cycleLTCGTarget` 0.20 vs 0.15: a real lever pointing the WRONG way

2,576 cyclic pairs (every cyclic arm x 45 cells, 0.15 vs 0.20):
- **898 pairs move** more than $1 — the knob is live, S1-P3 (<1% off 8% spend) scored **WRONG**
  (max 6.08% in a 6%-spend cell).
- But 0.20 **wins only 53 of 2,576**. The largest moves are all LOSSES: −$380k, −$373k, −$332k
  (brokheavy x0.5, Fill Bracket cyclic arms).
- Mechanism: harvesting into the 15% LTCG bracket pays real tax today on gains the terminal
  §1014 step-up would have erased at death. Target-the-0%-bracket (0.15, the shipped default) is
  the correct default by a wide margin.

**Feeds P32h:** default 0.15 CONFIRMED; un-gating the knob would mostly hand users a footgun.
If it stays nerdknob-gated, nothing is being hidden that helps.

## Q5 — `cycleHarvestMode`: does "max the bracket anyway" pay? NO, mostly

Research input `cycleHarvestMode: 'maxbracket'(default) | 'spendonly'` (P32c, default off =
today's behavior, bit-identical test pinned). A/B over every successful cyclic arm x 45 cells,
spend equal within $1 (2,514 pairs):

- **maxbracket wins only 108 pairs (4%)**; spendonly wins the bulk, median gains $0-$6.4k by mix,
  max **+$395,892** (brokheavy x0.5 @4%, IRA Draw 15% cyclic).
- Mechanism: with the IRC §1014 step-up firing at both deaths (v11.1499), gains held to death are
  erased anyway — so a 0%-bracket harvest's basis step-up has no terminal payoff, while its MAGI
  side effects (SS taxation, IRMAA) and the sell/re-buy churn remain. The deliberate top-off at
  `optimizer_core.js` (`_targetNetRoom` when spend fits) is a pre-step-up design.
- spendonly's worst losses are thin and high-strain (−$107,822, thirds x0.5 @8%).
- **S2-P3 (maxbracket wins >=70%) scored WRONG — inverted.**

## Q6 — `cycleCoexist`: harvest-year IRA draws reclaim money… only for measured arms

Research input `cycleCoexist: 'off'(default) | 'bracketfill'` (P32c): a harvest year ALSO runs
the family's IRA sizing (v1: bracket/minlimit/aca + fixedpct), IRA sized first, harvest re-sized
against the raised ordinary floor, MAGI ceilings via a two-pass fixed point. With
`netWithdrawals.IRA > 0` the surplus-conversion cap un-zeroes automatically — harvest years
regain conversions with no second edit (test-pinned).

1,232 successful equal-spend pairs (v1-family cyclic arms x 45 cells):

- **Median is NEGATIVE**: bracketfill loses 804 pairs, wins 217. By-mix medians: defaults $0,
  round1 −$31k, thirds −$100k, brokheavy −$99k.
- **The skip was accidentally protective for aggressive ceilings.** Worst: Fill Bracket 35%
  cyclic −$2,086,801, IRMAA Tier 4 −$1,940,161 (round1 x3 @4%). Coexist makes an arm MORE
  itself — a harvest year that draws-and-converts to a 35% ceiling is simply another year of the
  arm's own value-destroying medicine, and skipping ~1-in-N years was dampening it.
- **For measured draw rates it genuinely pays**: IRA Draw 5-8% [brokerage-first] gains up to
  **+$807,715 (15.7%)** at defaults3x x3 @4%. The "money on the table" from Stage 1's descriptive
  stat is real, but only where the reclaimed draw is itself well-sized.
- **S2-P1 (no-harm >=80%) WRONG** (35%); **S2-P2 (gains scale with harvest frequency) WRONG** —
  frequency scales the effect's MAGNITUDE in both directions, not its sign.

**Answer to the user's question B:** yes, cyclic harvest years leave money on the table — but
reclaiming it blindly with the family's own sizing is net-negative on median. The lever is real
(+$808k best case), conditional on the arm's ceiling being moderate. A shipped version would need
arm-aware gating, which is exactly the kind of heuristic this repo requires an axis-property +
pinned test for.

## Predictions scored (registered in the harness header before the numbers)

| id | prediction | verdict |
|---|---|---|
| S1-P2 | cyclic beats its twin in <15% of cells, concentrated brokerage-heavy | **WRONG** — 58%, and concentration only appears after the routing confound is removed |
| S1-P3 | 0.20 inert (<1%) outside 8%-spend cells | **WRONG** — up to 6.08%, but as losses |
| S1-P4 | all families' draw frequency rises post-fix; never-draw stays 0 | **WRONG** (cyclic −0.8pt; never-draw did stay 0) |
| S2-P1 | bracketfill no-harm in >=80% of pairs, median gain <2% | **WRONG** — no-harm 35%, median −0.73% |
| S2-P2 | coexist gains scale with harvest frequency | **WRONG** — frequency scales magnitude both ways, not sign |
| S2-P3 | maxbracket beats spendonly in >=70% of pairs | **WRONG — inverted**: maxbracket wins 4% |

## Coverage — what was actually varied (guard against extrapolating past it)

Two DIFFERENT grids feed this file:

**Q1 / audit / q2 — the original P32 ladder** (5 scenarios, total investable held at $2.25M so
"how often is Brokerage drawn" is not confounded with how much of it there is):

| scenario | Brokerage (share) | IRA | Roth | Cash |
|---|---|---|---|---|
| capbase | $100k (4.4%) | $2.1M | $0 | $50k |
| brokPoor | $100k (4.4%) | $2.05M | $50k | $50k |
| brokThird | $750k (33%) | $1.3M | $100k | $100k |
| brokHalf | $1.125M (50%) | $875k | $125k | $125k |
| brokRich | $1.5M (67%) | $500k | $125k | $125k |

Basis = 50% of Brokerage throughout. Household: couple 66/67 at start (born 1960/1959),
**die at 74/90 (deaths 2034/2049) — ~15 survivor years, 24-year horizon**, spend $160k
declining 1%/yr (7.1% of assets), SS $48k+$24k @67, CA, growth 5%, dividendRate 0 (pinned so
the dividend defect could not contaminate Q1), x 11 strategy arms = 55 rows.

**Q3/Q4/Q5/Q6 — the Stage-1 crossed grid** (45 cells x 192 arms): 5 mixes x wealth x0.5/1/3 x
spend 4/6/8% of assets. Full mix table in `PHASED_RESULTS.md` (Coverage section). Ranges:
total assets **$810k – $14.58M**; IRA share 22–86%; Brokerage share 6–62%; Roth 4–32%; annual
spend **$32,400 – $1,166,400**; basis fraction 43–56%. Held fixed: couple 64/62 die 92/94
(deaths 2054/2058 — only 4 survivor years, 33-yr horizon; note this DIFFERS from the Q1
ladder's ~15), SS $45k+$24k, CA, 6%/2.5% path, dividendRate 2%.

**Basis-axis extension (2026-08-10, closes the 43-56% gap for the 45-cell A/Bs).** The Stage-1
grid was rebuilt at basis = 20% (highly appreciated) and 80% (mostly contributions) and Q3-Q6
re-run. Predictions B-P1..B-P3 pre-registered; **all three RIGHT** — every conclusion holds at
both extremes, with magnitudes scaling exactly as the §1014 mechanism predicts:

| question | basis 20% | mix default (43-56%) | basis 80% |
|---|---|---|---|
| Q3 (control) cyclic wins | 20/45 | 23/45 | 22/45 — **basis-stable** |
| Q4: 0.20-target wins / worst loss | 9 of 2,467 / **−$540k** | 53 of 2,576 / −$380k | 83 of 2,643 / −$232k |
| Q5: spendonly win share / max win | 58% / **+$561k** | 58% / +$396k | 56% / +$237k |
| Q6: coexist median / IRA Draw max gain | **−$39k** / +$649k | −$27k / +$808k | −$4.8k / **+$980k** |

Readings: (a) the anti-lever verdicts (Q4 gate-protective, Q5 top-off harmful) STRENGTHEN at
low basis and soften-but-hold at high basis — harm scales with the gain fraction each harvested
dollar carries; (b) coexist's dual character is basis-stable: aggressive ceilings lose $1.8-2.3M
at every basis, measured IRA Draw arms gain at every basis and gain MOST at 80% (the reclaimed
draw is cheapest when the harvest it displaces carries little gain); (c) B-P3's direction held
but the win-share barely moves (58/58/56%) — basis bites through magnitude, not frequency.

**Remaining coverage gaps:**
- The Q1 ladder itself stays at 50% basis (deliberate: comparability with the pre-fix record).
- The two grids disagree on survivor exposure (~15 survivor years vs 4), so any
  survivor-sensitive effect (widow brackets, IRMAA single thresholds) is mostly probed by Q1's
  ladder, only weakly by the 45-cell A/Bs.
- Single state (CA), single return path, no pension, one SS profile per grid.

## Scope limits

One deterministic return path (6%/2.5%), CA only, one age/SS profile, 45-cell grid, spend rates
are % of total assets. Aggregate basis (no lot selection/HIFO), one-sided ACA pricing, no SECURE
10-yr heirs, IRC §1014 step-up at terminal row. Q3/Q4 compare within cells only. Q1 runs on the
original P32 5-scenario ladder (CAP_BASE derivative), unchanged from the pre-fix run for
comparability.
