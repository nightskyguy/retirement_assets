# P30 results — the `[40, 60]` gap-fill split

Reference record for `gapfill_harness.js`. Reproducible with:

```bash
node .test_harnesses/gapfill_harness.js
```

2026-08-25, engine v11.1638. 4,230 simulations, ~3.5s. Two research inputs, both default off and set
by nothing in the UI: `gapFillWeights` (P30a, sections 1-8) and `bracketGapOrder` (P30c, section 9);
plus the 24 Ordered permutations (P30d, section 10), which need no input because `resolveOrderedSeq`
now generates a sequence from its letters. `fillSpendingGap` has three branches and they are three
separate policies, so they are measured separately and do not turn out to agree.

---

## 1. The question

When a year's spending needs more than the strategy itself withdraws, `fillSpendingGap` fills the
shortfall, and it does so **two different ways depending on the strategy**. Sections 1-8 are the
default branch; section 9 is the bracket branch. Neither constant was ever chosen and they turn out
to disagree with each other.

Most strategies land in a default branch that draws **Brokerage and Cash proportionally
at a bare `[40, 60]`**, then falls back to Roth. Nobody chose that 40. P30 asks whether it is
load-bearing, and if so whether 40 is right.

Weights below are **Brokerage's share**: `w=0` is all-Cash, `w=100` is all-Brokerage, `w=40` is
today. Both endpoints still spill through the shortfall cascade, so the whole 0-to-100 range is one
policy rather than three (verified in P30a before this sweep was allowed to read anything into it).

## 2. The short answers

| question | answer |
|---|---|
| Which strategies can even feel it? | **Three.** Proportional, Reduce, Guyton-Klinger. The bracket family (bracket, minlimit, IRA Draw, live-ACA) and Ordered take their own branches. |
| Is the constant load-bearing? | **Yes.** 227 of 360 cells move by more than $1,000 across the range; the widest moves **$616,919**. |
| Is 40 the right number? | **No, and it is not close.** Among the 82 cells that are clean wealth comparisons, `w=40` is best in **zero** of them. |
| What is better? | **`w=0`** — fill the gap from Cash and leave the brokerage account alone. Best in 65 of the 82 clean cells, and in 178 of all 227 live cells. |
| Is that a shipping recommendation? | **Not yet.** See §10. |

## 3. The grid

6 weights x 5 mixes x 3 spend rates x 2 states x 2 Cash-Reserve settings x 3 live families x 2
third-pass arms, plus 3 guard families = 2,430 simulations. `COMMON` and the five mixes are copied
verbatim from `unifiedconv_harness.js`, so the scenario ladder is P28's, re-baselined
(`P28_RESULTS.md` §15) before reuse.

**Scoring.** `baselineScoreOf` against the `w=40` arm of the same cell. One deliberate departure
from `unifiedconv_harness.js`, which scored each arm at its OWN `res.totals.futureIRARate`: that
discounts the two arms of an A/B differently, the exact drift `baselineScoreOf`'s doc comment warns
about. Here every weight in a cell is scored at the control arm's rate, so a delta is a delta in the
plan and not in the yardstick.

## 4. Blast radius, and the construction guard

`yr.isBracketStrategy` covers bracket, minlimit, `fixedpct` and live-ACA, and those take a separate
sequential branch. Ordered takes its own. So the weight reaches **Proportional, Reduce and
Guyton-Klinger, and nothing else** — a much smaller radius than "the gap fill" suggests, and worth
knowing before any decision about exposing it.

Guard: across **270 runs**, Fill Bracket, IRA Draw and Ordered are **bit-identical at every weight**.
If that ever breaks, the weight has leaked into a branch it does not own and the sweep is measuring
something else.

## 5. The headline

| | |
|---|---|
| cells moving more than $1,000 across 0-100 | **227 / 360** |
| widest single cell | **$616,919** (balanced thirds, 4%, TX, reserve off, Reduce, third pass off) |
| best weight, all live cells | **0: 178** · 20: 15 · 40: 9 · 60: 8 · 80: 8 · 100: 9 |
| best weight, the 82 **clean** cells | **0: 65** · 40: **0** |

"Clean" means delivered spending was unchanged across every weight AND every weight funded the plan
— so the delta is wealth, not "you spent more" and not an artifact of a failing plan. It is the
stricter half of the grid and it points the same way, harder.

The curve is close to monotone: in most rows every step from 0 toward 100 is worse than the last.
It is not perfectly monotone — a handful of cells peak in the middle (balanced thirds / Proportional
/ 6% is best at `w=60`) — so a search would still beat a constant, but the constant that beats today
is `0`.

## 6. The two widened axes

Widest 0-to-100 swing within each slice, third pass at today's default:

| slice | live cells | widest swing |
|---|---|---|
| CA / reserve **off** | 39/45 | $534,525 |
| CA / reserve **on** | 20/45 | **$33,358** |
| TX / reserve **off** | 32/45 | $595,841 |
| TX / reserve **on** | 17/45 | $146,218 |

**Cash Reserve is the bigger lever, and it damps this one by an order of magnitude.** With a reserve
in force the fill cannot drain Cash freely, so the weight has far less to argue about — CA's widest
cell falls from $534,525 to $33,358. Anyone who runs a reserve is barely exposed to the constant at
all. State matters much less than the reserve, which is mild evidence that the Cash-vs-Brokerage
trade here is not mainly a state-tax trade.

## 7. The third-pass hypothesis: not supported

P28's re-baseline left an open question — was P32 (letting the third pass draw Brokerage) what
inverted the Roth-position mechanism? Every cell here ran both ways:

| | live cells | widest swing | best weight spread |
|---|---|---|---|
| `thirdPassBrokerage: 'bounded'` (today) | 108/180 | $595,841 | 0:87 20:8 40:6 60:3 80:3 100:1 |
| `thirdPassBrokerage: 'off'` (pre-P32) | 119/180 | $616,919 | 0:91 20:7 40:3 60:5 80:5 100:8 |

**Same shape both ways.** `w=0` dominates under either setting, and the magnitudes are comparable.
So P32 does not explain the direction of the weight result. That is evidence about THIS mechanism,
not a refutation of the P28 hypothesis — the two act on different accounts (Roth's position versus
the Brokerage/Cash split) — but it removes the easy story, and the P28 hypothesis remains open.

## 8. Scored predictions

| | prediction | outcome |
|---|---|---|
| A | inert where the fill never draws Brokerage | **VACUOUS.** Zero cells in this grid had a control arm that never drew Brokerage, so the zero-predicate was never testable here. Not confirmed, not refuted. |
| B | bracket / IRA Draw / Ordered exactly $0 | **HELD.** 270 runs, all bit-identical. |
| C | the curve is flat | **BROKEN.** 227/360 move; widest $616,919. The constant is load-bearing. |
| D | where it is not flat, 40 is not best | **HELD**, emphatically. 40 wins 9 of 227 live cells and **0 of 82 clean ones**. |
| E | Proportional stays near zero | **BROKEN.** 40 of 120 Proportional cells move. P28 round 1's "Proportional funds spending directly so the gap fill is not its lever" does not survive at these mixes. |

Two of five broke, and the broken ones are the output. A is worth restating as an honest miss: the
grid could not test it, and a prediction that cannot fire should have been noticed when it was
written rather than when it was scored.

## 9. P30c — the other constant, and it goes the other way

The bracket family (Fill Bracket, IRMAA Ceiling, ACA Cliff, IRA Draw) takes a separate branch that
drains **Cash to zero before touching Brokerage**, in a strict sequence. Nothing measured that
either; the comment above it asserts that it "keeps supplemental draws out of taxable income".
`bracketGapOrder` (P30c) makes the swap expressible. 360 simulations, 3 bracket families x 5 mixes x
3 rates x 2 states x 2 reserve settings x 2 orders. Delta below is **brokerageFirst minus cashFirst**,
so a positive number means today's order is wrong.

| | |
|---|---|
| cells moving more than $1,000 | 105 / 180 |
| of those, clean wealth comparisons | 23 |
| the swap wins, clean cells | **2 / 23** |
| widest cell | **−$587,970** (round-1, 4%, CA, reserve off, IRA Draw) |

**Today's order is right.** In the CA / reserve-off slice every single cell is negative — swapping to
Brokerage-first loses in all fifteen, by $8,863 to $587,970. Predictions F, G and H all held.

### The two constants disagree with each other, and this one is the one that got it right

Read together with §5, the story is one story:

| branch | serves | today | measured best |
|---|---|---|---|
| default (proportional) | Proportional, Reduce, Guyton-Klinger | **40% Brokerage** / 60% Cash | **0% Brokerage** — all Cash |
| bracket (sequential) | Fill Bracket, IRMAA Ceil, ACA Cliff, IRA Draw | **Cash first**, then Brokerage | Cash first — unchanged |

Both say the same thing: **fill a spending gap from Cash before Brokerage.** The bracket branch
already does it. The default branch does not, and that is the defect.

### Caveats on P30c specifically

- **Only 23 of 105 live cells are clean.** Most carry a delivered-spending change, a failed plan
  under one order, or both — the `!` and `x` flags in section 8 of the harness output. The headline
  rests on the clean 23; the other 82 point the same way but are not like-for-like.
- **Prediction G held on a technicality.** CA's widest cell is $587,970 against TX's $561,127 — a
  5% gap. That is not evidence of a state-tax mechanism; it is evidence that state barely matters
  here, the same conclusion §6 reached for the weight. Recorded as HELD because that is what the
  test asked, but it should not be read as support for the tax story.
- **Cash Reserve damps this one too**, and harder: 87 live cells with the reserve off against 18
  with it on. Third time the reserve has turned out to be the bigger lever.
- **The lifetime direction is not stable.** Drawing Brokerage first does not reliably raise the
  lifetime Brokerage total: it does in one mix and falls in another, because spending a different
  account early feeds back into every later year. Only the score comparison is meaningful; a test
  that pinned a lifetime total would be pinning the scenario.

## 10. P30d — the 21 orderings that were never shipped

Ordered runs the account sequence the user picks, and the UI offers three of the 24 permutations:
CBIR, RIBC, BIRC. `resolveOrderedSeq` used to look the code up in a three-entry map and fall back to
CBIR for everything else, so the other 21 named one sequence and silently ran another. P30d
generalized the resolver to build the sequence from its letters — the three shipped codes are
byte-identical, and nothing ships, since `grids.ordered` still sweeps the same three. 1,440
simulations: 24 permutations x 5 mixes x 3 rates x 2 states x 2 reserve settings.

### 24 orderings are not 24 plans

Distinct plans per cell, out of 24: **min 5, max 24, median 21**. The sequence only matters up to the
point the gap is filled, and an account with no balance is skipped, so the tail is often irrelevant.
In the most collapsed cell the 24 codes produce only 5 different runs.

### An unshipped ordering wins, often

| | |
|---|---|
| cells where the best permutation beats the best SHIPPED one by >$1,000 | 43 / 60 |
| of those, clean wealth comparisons | 15 |
| widest gain | **$858,316** with **CIBR** (round-1, 4%, CA, reserve off — best shipped was BIRC) |

Outright winner counts across all 60 cells:

| ordering | wins | shipped? |
|---|---|---|
| **CBRI** | **22** | no |
| CBIR | 14 | yes |
| BCIR | 8 | no |
| CIBR | 8 | no |
| BCRI | 5 | no |
| CRIB | 2 | no |
| BRCI | 1 | no |

### Two of the three shipped codes are dominated

**RIBC and BIRC never win a single cell of the 60.** CBIR wins 14. The best ordering overall is
**CBRI** — CBIR with the last two swapped, taking Roth before the IRA — which wins 22 and is not
offered. That is shipping-relevant, not a research curiosity: two thirds of the menu is never the
right answer anywhere in this grid, and the most frequently-best sequence is absent from it.

### Scored predictions

| | prediction | outcome |
|---|---|---|
| I | an unshipped ordering wins somewhere | **HELD.** 15 clean cells. |
| J | no shipped code is dominated | **BROKEN.** RIBC and BIRC win nothing. |
| K | Cash before Brokerage beats the reverse | **BROKEN.** Exactly 30/60 — a coin flip. |

**K breaking is the most useful result here.** P30b and P30c both found Cash-before-Brokerage on
their own branches, and the obvious next step was to call that "the P30 story". It does not
generalize to Ordered: averaged pairwise over all 24 permutations, the C-before-B half wins exactly
half the cells.

Narrower readings, reported alongside the broken prediction rather than substituted for it —
rewriting a prediction after seeing the data is how a broken one gets laundered:

- best ordering **starts with Cash**: **46 / 60**
- best ordering **ends with the IRA**: 28 / 60

So "Cash first" survives and "Cash before Brokerage" does not. The difference is that Ordered's
sequence also places the IRA and Roth, and where those sit swamps the Brokerage/Cash pair that
governs the two automatic branches. A four-account sequence is a different problem from a
two-account split, and P30's story stops at that boundary.

## 11. What this does NOT establish

- **Nothing about a default change yet.** `w=0` wins on `baselineScoreOf`, which weighs terminal
  after-tax wealth plus spendable. It has not been checked against the other objectives the
  Optimizer ranks by, and "always drain Cash first" has a liquidity story this harness does not
  model — a plan with no Cash buffer left is more fragile than its score says. The Cash Reserve
  interaction in §6 is the same warning from the other side.
- **Nothing about Ordered's 24 permutations**, which is P30d.
- **Nothing at monthly resolution or under Monte Carlo.** Deterministic single path, as P28 was.
