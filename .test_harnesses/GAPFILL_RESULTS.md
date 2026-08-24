# P30 results — the `[40, 60]` gap-fill split

Reference record for `gapfill_harness.js`. Reproducible with:

```bash
node .test_harnesses/gapfill_harness.js
```

2026-08-24, engine v11.162K. 2,430 simulations, ~2s. One research input, `gapFillWeights`
(P30a), default off and set by nothing in the UI.

---

## 1. The question

When a year's spending needs more than the strategy itself withdraws, `fillSpendingGap` fills the
shortfall. Most strategies land in a default branch that draws **Brokerage and Cash proportionally
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
| Is that a shipping recommendation? | **Not yet.** See §7. |

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

## 9. What this does NOT establish

- **Nothing about a default change yet.** `w=0` wins on `baselineScoreOf`, which weighs terminal
  after-tax wealth plus spendable. It has not been checked against the other objectives the
  Optimizer ranks by, and "always drain Cash first" has a liquidity story this harness does not
  model — a plan with no Cash buffer left is more fragile than its score says. The Cash Reserve
  interaction in §6 is the same warning from the other side.
- **Nothing about the bracket family**, which is P30c's question (Cash before Brokerage in the
  sequential branch) and is untouched here.
- **Nothing about Ordered's 24 permutations**, which is P30d.
- **Nothing at monthly resolution or under Monte Carlo.** Deterministic single path, as P28 was.
