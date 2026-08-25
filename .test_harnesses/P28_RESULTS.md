# P28 results — unified conversion routing, Roth-first gap filling, and the conversion switch

Reference record for `unifiedconv_harness.js`. Everything below is reproducible with:

```bash
node .test_harnesses/unifiedconv_harness.js
```

2026-07-30. 630 simulations, ~1.2s. Engine at `optimizer_core.js` with three research inputs, **all
default off and set by nothing in the UI**: `unifiedConvRouting`, `rothGapFill`,
`forceWithdrawTiming`.

> **Round 3 supersedes round 2.** Round 2 set spend by hand per scenario and accidentally confounded
> account mix with spending strain — the two default scenarios sat at 8.6% of assets while the other
> three sat near 4.4%. Spend is now a controlled axis (4% / 6% / 8% of total assets) crossed with
> every mix. Three round-2 conclusions did not survive; they are marked **[CORRECTED]** below.

> ## ⚠ 2026-08-24: the engine moved, and every number below moved with it
>
> Re-running the same harness on the v11.162B engine does **not** reproduce the figures in this
> document. The measurement was not wrong; the engine it measured no longer exists. The largest
> intervening change is P32 (v11.15e3), which let the third pass draw Brokerage by default —
> `fillCashThenRoth`'s whole mechanism is displacing a Brokerage draw, so changing when Brokerage is
> drawn changes the size and the sign of the effect. P64 (SALT) and P66 (IRMAA ceiling) also sit on
> the same tax path.
>
> | | recorded 2026-07-30 | re-run 2026-08-24 |
> |---|---|---|
> | best `fillCashThenRoth` cell | **+$3,559,596** | **+$470,977** |
> | worst `fillCashThenRoth` cell | −$12,466 | **−$633,605** |
> | cells where it is negative | 1 of 60 | **26 of 60** |
> | `fillCashThenRoth` ≥ `fillRothThenCash` | 53 of 60 | 54 of 60 |
> | worst `fillRothThenCash` cell | −$244,689 | −$1,136,213 |
>
> **What survives:** `fillCashThenRoth` is still the better of the two positions, still by a wide
> margin, and the zero-predicate is intact - a control arm that never drew Brokerage still returns
> exactly $0. **What does not:** the headline "+$3.56M, almost never loses", and, less obviously, the
> mechanism itself. The payoff no longer tracks the SIZE of the Brokerage draw; the largest draws in
> the grid now produce the largest losses. See section 15.3. On today's engine this is a two-sided
> lever that can cost more than half a million dollars, which is a stronger argument for the P28f
> decision (sweep it, do not recommend it) than the old numbers were.
>
> Prediction B was already **BROKEN** at 1/60. It is broken by a much wider margin now.
>
> Everything below this box is the 2026-07-30 record, left as written. **Section 15 is the full
> re-baseline on today's engine** - quote that, not these.

---

## 1. What was asked

Model every **voluntary** (non-RMD) IRA withdrawal as a Roth conversion, with spending then drawn out
of Roth. Nerdknob-controlled. Does it simplify the logic, is it provably better, which strategies
would have to change.

## 2. The short answers

| question | answer |
|---|---|
| Does the reframe simplify the logic? | Simplifies the *decision space* (one lever per year, not two). Changes nothing in the tax math. |
| Is it provably better? | **No — provably neutral, and measured neutral** in all 90 mix x rate x family cells. |
| Which strategies change? | Only ones that fund a spending gap out of **Brokerage**. Which ones those are depends on the spend rate. |
| So is there anything here? | **Yes, in the other half.** Where Roth sits in the gap-fill queue is worth up to **+$3.56M**. |

---

## 3. The two flags

### `unifiedConvRouting` — the literal proposal. Inert.

Arithmetic, not a model change. Draw gross `X`, pay tax `T`, fund spending `S`:

- **today:** Roth gains the leftover `L = X − T − S`
- **routed:** Roth gains `(X − T)`, then immediately returns `S` — the same `L`

The round trip cannot move money and cannot fail: the conversion funding `S` arrives in the same
instant `S` leaves. **Zero money fields differ** across all 90 cells. Shipping this as a switch would
ship a control that changes no number in the tool.

### `rothGapFill` — where Roth sits in the gap-fill queue. Not inert.

When the strategy's IRA draw does not cover spending, `fillSpendingGap` fills the rest:

| `inputs.rothGapFill` | queue |
|---|---|
| unset (today) | Cash → Brokerage → **Roth** (last resort) |
| `'fillRothThenCash'` | **Roth** → Cash → Brokerage |
| `'fillCashThenRoth'` | Cash → **Roth** → Brokerage |

Named for what they control — where Roth is *inserted*. Ordered-style letter codes were considered
and rejected: today's default is already `CBRI`, so `CBRI` would name the current behavior rather
than a new mode (the correct codes would be `CRBI` / `RCBI`), and more importantly this input does
not set a total ordering at all — the non-bracket branch draws Brokerage and Cash **proportionally
40/60**, so there is no full sequence for four letters to name.

Only the middle step differs, and it decides which account Roth *displaces*:

- Both move Roth ahead of **Brokerage**. That is the win — a Brokerage draw realizes capital gains,
  a Roth draw does not.
- Only `fillRothThenCash` also moves Roth ahead of **Cash**. That is a loss. Both are tax-free to
  withdraw so it looks free, but Roth compounds at the growth rate tax-free while Cash earns
  `cashYield` and is taxed on the interest. Spending Roth to preserve Cash keeps the worse asset.

Unrecognized values are validated to a no-op rather than tested for truthiness. The first cut used
`inputs.rothGapFill || null`, under which a typo (`'fillCashThenRother'`) silently modelled
`fillRothThenCash` — the opposite mode. Caught by probing the browser with a garbage value.

---

## 4. The grid

MFJ, ages 64/62, die 92/94, CA, 6% growth, 2.5% inflation, 3% cash yield, 2% dividends, SS $45k + $24k.

| mix | total assets | Brokerage share | spend @4% | @6% | @8% |
|---|---|---|---|---|---|
| shipped defaults (IRA-heavy) | $1.62M | 6% | $65k | $97k | $130k |
| defaults x3 (same mix) | $4.86M | 6% | $194k | $292k | $389k |
| round-1 scenario | $3.90M | 23% | $156k | $234k | $312k |
| balanced thirds | $4.35M | 32% | $174k | $261k | $348k |
| brokerage-heavy | $4.55M | 62% | $182k | $273k | $364k |

Spend is a percentage of **total assets**, not a portfolio withdrawal rate. Social Security is $69k
combined, so at 4% the guaranteed income covers most of the spend and the portfolio is barely
touched — which matters, because these mechanisms only act on a spending gap.

---

## 5. fillCashThenRoth payoff, by mix and spend rate

Δ`baselineScoreOf` vs control, today's dollars. `!` = delivered spending also changed, so that cell
mixes a wealth change with a spending change and is not like-for-like.

| mix | family | 4% | 6% | 8% |
|---|---|---|---|---|
| shipped defaults | Reduce 20 yrs | $280 | $56,256 | $233,024 |
| shipped defaults | Fill Bracket 24% | $170,877 | **$329,575** | $187,460 ! |
| shipped defaults | IRA Draw 6% | $0 | $21,579 | $9,771 |
| defaults x3 | Reduce 20 yrs | $217,623 | $173,496 ! | $8,531 ! |
| defaults x3 | Fill Bracket 24% | $225,645 | $100,041 ! | $18,001 ! |
| round-1 | Reduce 20 yrs | $55,301 | $600,585 ! | $357,399 ! |
| round-1 | Fill Bracket 24% | $342,714 | **$1,219,316** ! | $263,242 ! |
| round-1 | IRA Draw 6% | $0 | **$1,200,484** | $23,870 ! |
| balanced thirds | Reduce 20 yrs | $294,500 | **$3,559,596** | $1,771,868 ! |
| balanced thirds | Fill Bracket 24% | $1,064,527 | **$2,961,220** | $1,620,309 ! |
| balanced thirds | IRA Draw 6% | $282,485 | **$3,201,551** | $777,209 ! |
| balanced thirds | Proportional 10% | $12,495 | **−$12,466** | $19,272 ! |
| brokerage-heavy | Reduce 20 yrs | $190,924 | $2,206,308 ! | $2,479,540 ! |
| brokerage-heavy | Fill Bracket 24% | $410,713 | $1,906,388 ! | $2,342,420 ! |
| brokerage-heavy | IRA Draw 6% | $284,356 | $1,837,445 ! | $766,264 ! |

**[CORRECTED] The payoff peaks at 6%, it does not grow with spend.** Round 2, which mostly sampled
~4.4%, understated it badly. Live cells (|Δ| > $1k) by rate: **13/20 at 4%, 19/20 at 6%, 19/20 at 8%**;
best cell $1.06M → $3.56M → $2.48M. At 4% Social Security covers most of the spend so there is
barely a gap to redirect; at 8% many plans are straining and the deltas get mixed up with changed
spending.

**[CORRECTED] "IRA Draw 6% is unreachable" was strain-specific.** It was inert at round 2's ~4.2%
spend and is worth **+$1,200,484** at 6% in the same mix.

---

## 6. Mechanism: no Brokerage draw, no lever

Lifetime gap-fill draws in the **control** arm, against the payoff. The relationship is direct.

| mix | family | rate | BrokWD (control) | realized LTCG | RC payoff |
|---|---|---|---|---|---|
| shipped defaults | IRA Draw 6% | 4% | **$0** | $0 | **$0** |
| shipped defaults | IRA Draw 6% | 6% | $18,474 | $10,832 | $21,579 |
| shipped defaults | IRA Draw 6% | 8% | $125,036 | $68,382 | $9,771 |
| round-1 | IRA Draw 6% | 4% | **$0** | $0 | **$0** |
| round-1 | IRA Draw 6% | 6% | $2,950,386 | $1,958,297 | $1,200,484 |
| balanced thirds | Fill Bracket 24% | 4% | $2,712,131 | $1,876,522 | $1,064,527 |
| balanced thirds | Fill Bracket 24% | 6% | $3,751,340 | $2,442,446 | $2,961,220 |
| brokerage-heavy | Fill Bracket 24% | 6% | $6,998,076 | $4,948,990 | $1,906,388 |

**Every cell where the control never touched Brokerage returns exactly $0.** That is the cleanest
statement of the mechanism: `fillCashThenRoth` can only convert a Brokerage draw into a Roth draw, so a
plan that funds its gap from Cash alone has nothing to gain and nothing to lose.

---

## 7. `fillCashThenRoth` vs `fillRothThenCash`

| spend rate | RC ≥ RF | RC strictly wins | worst RF cell | worst RC cell | best RC cell |
|---|---|---|---|---|---|
| 4% | 19/20 | 15/20 | −$244,689 | $0 | $1,064,527 |
| 6% | 17/20 | 16/20 | −$119,701 | −$12,466 | $3,559,596 |
| 8% | 17/20 | 16/20 | −$10,683 | $0 | $2,479,540 |

`fillCashThenRoth` still wins or ties in **53 of 60** cells and its worst case is −$12,466 against
`fillRothThenCash`'s −$244,689.

**[CORRECTED] "fillCashThenRoth never destroys value" is false.** It is negative in 1 of 60 cells
(−$12,466, balanced thirds / Proportional / 6%). Round 2 checked 20 cells at one spend rate and
found none.

All seven cells where `fillRothThenCash` beats `fillCashThenRoth` are **Proportional**, which draws Brokerage
inside `planPrimaryWithdrawals` rather than leaving it to the gap fill — so gap-fill ordering is not
its Brokerage lever. **Guyton-Klinger is excluded from all comparisons**: its guardrails re-cut
spending, so its deltas mix wealth and spending changes, the same reason the optimizer gates GK
behind `gkSpendStable()`.

---

## 8. `fundConversionWithCash` ("Use Cash") compounds with it

From the round-2 sweep (one spend rate per mix). Δscore vs control; "interaction" = combined minus
the sum of the separate effects.

| mix | family | cash alone | RC alone | sum | RC+cash | interaction |
|---|---|---|---|---|---|---|
| round-1 | Fill Bracket 24% | **−$218,645** | +$466,289 | +$247,644 | +$550,069 | **+$302,425** |
| balanced thirds | Fill Bracket 24% | **−$162,569** | +$1,757,386 | +$1,594,818 | +$1,709,876 | +$115,058 |
| brokerage-heavy | Fill Bracket 24% | **−$201,097** | +$778,677 | +$577,579 | +$735,789 | +$158,209 |
| round-1 | Reduce 20 yrs | +$171,547 | +$70,844 | +$242,391 | +$267,302 | +$24,911 |
| balanced thirds | Proportional 10% | −$89,915 | +$37,076 | −$52,839 | −$64,613 | −$11,773 |

Cash-funded conversions are **negative on their own** for Fill Bracket in three of five mixes, yet
the pair beats the sum of the parts every time. **"Use Cash" should not be judged in isolation.**

---

## 9. Does `convertExcessToRoth` ever lose on its own?

**Yes — 28 of 75 cells, worst −$1,411,488. But only 7 of those survive holding withdrawal timing
constant, and at 4% spend it is a very large win almost everywhere.**

Δscore, ON minus OFF. "raw" uses the engine's own timing rule; "timed" pins withdrawal timing.

| mix | family | 4% raw | 4% timed | 6% raw | 6% timed | 8% raw | 8% timed |
|---|---|---|---|---|---|---|---|
| shipped defaults | Reduce 20 yrs | **+$2,051,465** | +$2,405,970 | +$917,689 | +$1,280,142 | +$146,761 | +$348,155 |
| shipped defaults | Fill Bracket 24% | **+$1,792,983** | +$2,180,319 | +$626,589 | +$966,601 | −$29,925 | +$244,275 |
| shipped defaults | IRA Draw 6% | +$935,402 | +$1,184,326 | +$398,227 | +$533,230 | −$25,627 | +$74,741 |
| shipped defaults | Proportional 10% | +$115,839 | +$278,674 | +$73,213 | +$321,310 | −$232,149 | +$189,480 |
| defaults x3 | Fill Bracket 24% | +$1,803,664 | +$2,795,390 | −$721,182 | +$57,315 | $0 | $0 |
| defaults x3 | Proportional 10% | −$271,164 | +$349,270 | −$843,149 | +$30,009 | −$392,230 | +$15,154 |
| round-1 | Fill Bracket 24% | +$1,637,249 | +$2,334,294 | −$788,446 | **−$92,745** | $0 | $0 |
| round-1 | Proportional 10% | −$192,800 | +$373,095 | −$960,053 | +$60,892 | −$387,049 | +$32,117 |
| balanced thirds | Fill Bracket 24% | −$879,750 | **−$297,195** | −$606,145 | **−$109,132** | $0 | $0 |
| balanced thirds | Proportional 10% | −$341,343 | +$277,305 | −$711,607 | +$58,492 | −$407,203 | +$8,606 |
| brokerage-heavy | Fill Bracket 24% | −$209,786 | +$231,528 | −$472,620 | **−$138,704** | $0 | $0 |
| brokerage-heavy | Proportional 10% | −$563,781 | +$401,426 | **−$1,411,488** | +$30,329 | −$642,265 | −$4,895 |

Two separate causes.

### Cause 1 — it silently changes withdrawal timing (the larger effect)

Converting sets `rothConv > 1000`, and `beginYear` reads that to pick the **next year's withdrawal
timing**: month-1 (early) instead of month-11 (late). So a naive A/B compares two different
withdrawal schedules on top of the routing difference. `forceWithdrawTiming` exists to pin it.

**21 of the 28 losses disappear when timing is pinned.** Every Proportional loss is of this kind:
−$1,411,488 raw becomes +$30,329 timed. That is not a tax result, it is the early-withdrawal penalty.

### Cause 2 — it starves the Cash buffer, and the gap fill lands on Brokerage

The 7 surviving losses concentrate in **Fill Bracket at high Brokerage share**, which is exactly the
Roth-first mechanism seen from the other side. Cash is the **first** account the gap fill draws; Roth
is the **last**. Routing the surplus into Roth means the Cash buffer is never rebuilt, so later gaps
fall on Brokerage and realize gains.

Balanced thirds / Fill Bracket 24%, timing pinned late, terminal in today's dollars:

| | Roth | Brokerage | spend | lifetime tax | realized LTCG |
|---|---|---|---|---|---|
| OFF | $7,938,152 | **$5,144,518** | $6,600,000 | $964,454 | $2,076,968 |
| ON | $9,742,461 | **$2,537,057** | $6,600,000 | $908,000 | **$3,076,599** |

ON holds $1.80M more Roth and $2.61M less Brokerage, on identical delivered spend and *lower* tax. It
bought the Roth balance by liquidating Brokerage and paying $1.0M more in realized gains.

**[CORRECTED] Round 2 reported "13 of 25, 5 surviving timing".** With spend controlled the picture is
28 of 75 raw / 7 timed, and the sign is strongly strain-dependent: at 4% spend the switch is worth
**+$1.8M to +$2.1M** in the IRA-heavy mixes.

---

## 10. Roth-first and `convertExcessToRoth` are near opposites

- `convertExcessToRoth` acts in `routeSurplusAndConvert` on the **surplus left after spending** and
  moves IRA → Roth. It **fills** Roth.
- `rothGapFill` acts in `fillSpendingGap` on the **gap still needed** and moves Roth →
  spending. It **drains** Roth.

A year has a surplus or a gap, never both, so they cannot fire in the same year. Counted on balanced
thirds / Fill Bracket over 33 years: Roth received a conversion in **4** years, was drawn for
spending in **28**, both in **0**.

Not substitutes, not additive. Against a both-off baseline in that scenario: `convertExcessToRoth`
alone −$1,095,454, `fillCashThenRoth` alone +$784,418, **both together +$661,933** — less than Roth-first
alone. They interfere, because `fillCashThenRoth` fixes the Brokerage-harvesting problem that
`convertExcessToRoth` creates.

---

## 11. The engine lesson worth keeping

**A log field the next iteration reads is engine state, not a label.**

The first implementation reported the reframe through `yr.totalConverted` and the `rothConv` log
field. That moved **780 money fields**, on one family only. The path:

```javascript
// optimizer_core.js, beginYear()
const _prevConv = y > 0 ? (log[y - 1].rothConv ?? 0) : 0;
yr._useEarly    = y === 0 ? _stratImpliesConversion : (_prevConv > 1000);
const preMonths = yr._useEarly ? 1 : 11;
```

`rothConv` is read back out of the previous year's log record to choose **withdrawal timing**. IRA
Draw 6% converts nothing in most years so it ran late; the reframe pushed its `rothConv` over the
threshold and flipped every year to early. Every other family already converted enough to be on the
early branch either way — which is why only one family moved, and why a smaller test set would have
called the change clean.

- **`rothConv` and `yr.totalConverted` are not display fields.** The reframe reports through
  `-unifiedConvGross` / `-unifiedRothSpend`, and the harness keeps `rothConv` in its *money* set so a
  regression fails loudly.
- **`log` is loop-carried state.** "It only changes a column" is not safe here until `log[...]` has
  been grepped.
- Same family as the 2026-07-26 finding that a predicate must read its input through the same
  accessor the behavior uses. Both are values that looked like output and were input.

---

## 12. Scored predictions

The harness states predictions up front and scores them, so a wrong one is visible rather than
quietly dropped.

| | prediction | outcome |
|---|---|---|
| A | `fillCashThenRoth` dominates `fillRothThenCash` | **BROKEN** — lost 7/60, all Proportional |
| B | `fillCashThenRoth` never destroys value | **BROKEN** — 1/60 negative, −$12,466 |
| C | payoff grows with spend rate | **BROKEN** — peaks at 6%, not monotone |
| D | routing inert, `ordered` frozen | **HELD** — across all 90 cells |
| E | `convertExcessToRoth` never loses alone | **BROKEN** — 28/75 raw, 7 timed, worst −$1,411,488 |

Four of five broke. The broken ones are the output.

---

## 13. Open decisions

1. **Ship `rothGapFill: 'fillCashThenRoth'`?** Worth up to +$3.56M, wins or ties 53/60, worst case
   −$12,466. But it is a **per-family, per-strain** effect: worth nothing when the gap never reaches
   Brokerage, worth millions when it does. Best home is an optimizer sweep dimension, not a global
   sidebar switch — the tool has to run it to know.
2. **Drop `unifiedConvRouting`?** Inert in all 90 cells. It earns its keep only if the Annual Details
   reframe is wanted as a *view*, which `-unifiedConvGross` already makes possible.
3. **`convertExcessToRoth` needs its own phase.** It is default-facing, swings from +$2.1M to
   −$1.4M depending on mix and spend rate, and most of the downside is a **withdrawal-timing side
   effect users cannot see or control**. Decide whether the early/late rule should key off conversion
   at all.
4. **Scope limits.** One return path, deterministic, no Monte Carlo, no sequence-of-returns risk, CA
   only, one age/SS profile, `CashReserve` off throughout. Spend rates are % of total assets, not
   withdrawal rates, and SS covers a large share at the low end.

---

## 14. Verification

- `node .test_harnesses/unifiedconv_harness.js` — 630 simulations, ~1.2s, all sections.
- Regression suites unaffected (all flags default off): `optimizer_core.tests.js` 148/148,
  `taxPaymentPlanner.tests.js` 32/32, `doclinks.tests.js` 22/22.
- Browser in-page suite 242/242, `#testsFailed` 🟢, console clean apart from the 4 known TEST
  fixtures. Browser reproduces the node figures exactly.
- The engine is deterministic: two identical browser runs differ only in `loopMs`, a wall-clock
  field. The node harness stubs `performance.now()` so it never appears there.


---

## 15. Re-baseline, 2026-08-24 (v11.162J engine)

Everything above is the 2026-07-30 record. This section is the same harness, same 5 mixes x 3 spend
rates x 6 families, run against today's engine. It exists because P30 was about to reuse the ladder
above as settled ground, and it is not.

The arm set is 6, not 7: `unifiedConvRouting` was deleted at P28f, so 540 simulations rather than 630.

### 15.1 What moved

| | 2026-07-30 | 2026-08-24 |
|---|---|---|
| best `fillCashThenRoth` cell | **+$3,559,596** | **+$470,977** |
| worst `fillCashThenRoth` cell | −$12,466 | **−$633,605** |
| cells where it is negative | 1 of 60 | **26 of 60** |
| worst `fillRothThenCash` cell | −$244,689 | −$1,136,213 |
| `fillCashThenRoth` >= `fillRothThenCash` | 53 of 60 | 54 of 60 |
| where it loses to `fillRothThenCash` | 7 of 60, all Proportional | 6 of 60, all Proportional |
| payoff vs spend rate | peaks at **6%** | **falls monotonically**: best $470,977 / $117,615 / $40,597 at 4 / 6 / 8% |

### 15.2 What still holds

**The zero-predicate.** Both cells whose control arm never drew Brokerage - IRA Draw 6% at 4% spend,
in the two default mixes - return exactly $0. The rule that a plan with no Brokerage draw has no
lever survives the engine change intact.

**The ranking.** `fillCashThenRoth` is still the better of the two positions, and still loses only to
Proportional, where the gap fill is barely the lever at all.

**Ordered is frozen** in every arm, and no arm makes two families indistinguishable.

### 15.3 What does NOT hold, and matters most for P30

**"Roth pays when it displaces a Brokerage draw" no longer predicts the sign.** In the 2026-07-30
record the payoff tracked the size of the Brokerage draw. It does not now:

| mix | control Brokerage draw | `fillCashThenRoth` payoff |
|---|---|---|
| balanced thirds, Fill Bracket, **4%** | $5,434,336 | **+$286,815** |
| balanced thirds, Fill Bracket, **6%** | $3,187,345 | **−$359,646** |
| balanced thirds, IRA Draw, **6%** | $2,279,148 | **−$633,605** |
| brokerage-heavy, Fill Bracket, **4%** | $7,428,416 | **−$146,374** |
| brokerage-heavy, IRA Draw, **6%** | $7,221,548 | **−$435,271** |

The largest Brokerage draws in the grid now produce the largest LOSSES. What predicts the sign today
is the pair (spend rate, brokerage share): positive at 4% except in the brokerage-heavy mix, negative
almost everywhere at 6% and 8%. Guyton-Klinger is the exception, positive in all 15 of its cells.

**Hypothesis, not a finding:** P32 (v11.15e3) let the third pass draw Brokerage by default, so Roth
spent early in the gap fill is Roth that is no longer there when the third pass would have reached
for it. That would explain a mechanism that inverts as the plan is strained. It has not been tested -
the honest way to settle it is to re-run this grid with `thirdPassBrokerage: 'off'` and see whether
the old shape returns.

### 15.4 Consequence for P30

P30b planned to reuse this ladder and to report against the zero-predicate. The ladder is fine as a
SCENARIO SET - the mixes and rates still span the space usefully - but no NUMBER above section 15 may
be carried forward. The zero-predicate may be. The "displaces a Brokerage draw" mechanism may not,
and a weight sweep must not assume that moving a draw from Brokerage to Cash is directionally good.
