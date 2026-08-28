# P85 — when conversions happen. Is earlier better, and is RMD suppression why?

Harness: [`convtiming_harness.js`](https://github.com/nightskyguy/retirement_assets/blob/main/.test_harnesses/convtiming_harness.js). Run `node .test_harnesses/convtiming_harness.js`.
11,274 simulations, ~9 seconds. Suites at the time of the run: **344 / 61 / 22**.

> **This supersedes the first run of 2026-08-28.** That run was measured on a broken RMD basis and at
> `iraBaseGoal: 0`, and both were load-bearing. Its headline finding — "front-loading gives strictly
> lower lifetime RMDs in 186 of 186 cells" — **is now BROKEN, at 375 of 499 with 124 counterexamples.**
> Section 4 carries the counterexamples and section 8 carries the correction. The re-run was
> prompted by the user, who flagged both problems from memory.

---

## 1. The question

The user's claim: converting earlier beats converting later, because (a) the dollars compound
tax-free for longer and (b) a smaller IRA grows less, so lifetime RMDs and their consequences shrink.

Nothing in this repo had tested it. `betr_harness.js` asks convert-vs-not; `stopyear_harness.js` and
`bestConversionStopYear()` ask when to **stop**, and a later stop converts more in total, so a cutoff
sweep confounds timing with amount.

**This is not P28j**, which is the intra-year withdrawal *month* (`optimizer_core.js:1275-1285`); its
`Early(Conv)` / `Late(Spend)` column names invite exactly this confusion.

**Design.** FRONT (first `k` years) / LEVEL (every year) / BACK (last `k` years) conversion schedules
at equal lifetime **gross**, over 5 mixes × 3 spend rates × 2 states × 2 Cash Reserve settings ×
2 families × **2 IRA Goals** = 240 cells, at 2 program sizes and 3 block widths. Every arm pinned to
`forceWithdrawTiming: 'late'`, because P28ja measured the withdrawal-timing leg as larger than the
conversion leg in 29 of 54 cells.

---

## 2. Headline

**Earlier still wins, by about two to one. The RMD story does not survive contact with a realistic
IRA Goal.**

| finding | number |
|---|---|
| FRONT ahead of BACK on after-tax net worth | **353 of 499** clean comparisons |
| FRONT outright winner of three shapes | 304 of 499 (LEVEL 102, BACK 93, ties 0) |
| FRONT has lower lifetime RMDs | **375 of 499 — with 124 counterexamples** |
| median FRONT − BACK after-tax net worth | +$156,660 to +$188,024 by block width |
| surviving at zero growth | **4.8%** (paired on 72: $449,889 → $21,724) |

LEVEL wins outright in 102 of 499. The extreme is not uniformly best, which matters for `P5`.

---

## 3. The IRA Goal changes the answer, and the first run had it at zero

The first run inherited `iraBaseGoal: 0` from `gapfill_harness.js`'s `COMMON` without asking whether
it belonged. It did not. **The shipped page default is $750,000** (`retirement_optimizer.html:210`),
and the page additionally offers a computed suggestion — the IRA balance whose RMDs roughly equal the
spend goal at a target age (`computeSuggestedIraGoal`, `optimizer_ui.js:665`). Zero is a value
essentially no real plan carries.

It is not a cosmetic axis. `yr.curIRA` (`optimizer_core.js:1584`) is the IRA-above-goal ceiling on
voluntary IRA withdrawals, and it gates **the bracket family** (`:1914`), the coexist paths (`:1852`,
`:1858`) and Reduce (`:1898`) — not Reduce alone, as was assumed.

Measured, same plan, only the goal differing:

| family | IRA Goal | terminal IRA | lifetime RMD |
|---|---|---|---|
| Fill Bracket 24% | 0 | **$0** | **$0** |
| Fill Bracket 24% | $750,000 | $1,119,897 | **$1,824,266** |

**At goal 0 the bracket family drains the IRA to nothing and takes no RMDs at all.** A harness asking
what conversions do to RMDs, run at goal 0, was asking it of plans that have none. It is also the
whole explanation for the first run's N3 failure: "flat at zero, the IRA is exhausted with or without
the conversion" in 48 of 60 arms is a statement about goal 0, not about conversions.

The clean-cell population for the bracket family goes from **6** comparisons at goal 0 to **133** at
goal 750k.

| slice | FRONT / LEVEL / BACK | median FRONT − BACK |
|---|---|---|
| IRA Goal 0 | 99 / 43 / 44 | +$110,283 |
| IRA Goal $750k | 205 / 59 / 49 | +$205,954 |
| propwd @ goal 0 | 95 / 41 / 44 | +$96,246 |
| propwd @ goal 750k | 95 / 41 / 44 | +$96,246 |
| bracket @ goal 0 | 4 / 2 / 0 | +$1,089,411 |
| bracket @ goal 750k | 110 / 18 / 5 | +$272,292 |

Proportional is **bit-identical** across the two goals — the ceiling never binds for it. Every
difference the goal makes runs through the bracket family.

### A related gap, found on the way

**Conversions ignore the IRA Goal entirely.** `applyExtraConversion` caps the year's gross at
`_availIRA = balance.IRA1 + balance.IRA2` (`optimizer_core.js:2694`), never at `yr.curIRA`. So a
conversion program can drive the IRA below a goal that voluntary withdrawals are forbidden to cross.
Whether that is intended is a design question, not a defect call — but it is the mechanism behind
section 4, and it is currently undocumented.

---

## 4. C2 is BROKEN: 124 cells where front-loading gives HIGHER lifetime RMDs

The counterexamples are perfectly localized:

| grouping | counterexamples |
|---|---|
| by IRA Goal | goal 0: **0 of 186** · goal 750k: **124 of 313** |
| by family | propwd: **0 of 360** · bracket: **124 of 139** |
| by spend rate | 4%: 74 of 329 · 6%: 50 of 140 · 8%: 0 of 30 |
| by block width | k3 40/165 · k5 39/164 · k10 45/170 |

**Every one is the bracket family at a live IRA Goal.** The mechanism, measured rather than argued —
same plan, same $210,000 conversion gross, only the schedule shape differing:

| arm | voluntary IRA spend | lifetime RMD | terminal IRA |
|---|---|---|---|
| FRONT | $1,127,660 | **$1,692,276** | $1,285,910 |
| BACK | $1,332,316 | **$1,462,895** | $1,067,049 |

FRONT draws **$204,656 less** voluntarily, ends with **$218,861 more** IRA, and takes **$229,381
more** in RMDs.

Front-loading consumes the above-goal headroom early. The bracket rule's own withdrawals are capped
at `curIRA`, so they are throttled for the rest of the plan; the IRA sits near the goal and compounds;
and RMDs — which the goal does not cap — run higher later. Conversions ignore the goal, withdrawals
respect it, and the two compete for the same headroom.

**So the user's RMD intuition is right for a plan with no IRA floor and right for Proportional, and
wrong for the strategy most likely to be paired with a floor.**

---

## 5. The mechanism: compounding pays, and now N3 says so directly

| channel | FRONT − BACK, 499 clean comparisons |
|---|---|
| lifetime RMD (BACK − FRONT) | median +$340,767 (min −$880,960, max +$4,568,867) |
| terminal Roth | median **+$1,362,644** (min −$371,135, max +$7,218,343) |
| net into Roth off the **same** gross | median **−$464** (min −$65,538, max +$59,246) |
| IRMAA years | median −1 (min −13, max +2) |

**C3 held again and harder**: paired on the 72 comparisons clean at both growth rates, the median
|FRONT − BACK| collapses from $449,889 to $21,724 — **4.8% survives**. FRONT is still ahead in 71 of
72 at zero growth, so a small pure tax-timing residual is real, as in P28ja's Q5.

**N3 now has signal, which it did not before.** Holding terminal pre-tax IRA equal — the RMD stock —
18 of 60 arms are usable (was 6 of 30) and FRONT still leads 9 / 5 / 4 with a median of **+$459,475**.
That is the decomposition the first run could not run: **FRONT keeps its advantage with the RMD stock
held equal, so compounding is what pays.** The zero-growth arm and N3 now agree.

**The conversion tax rate is still not the lever.** Off an identical gross, the net landing in Roth is
a coin flip, median −$464.

---

## 6. Where the effect reverses

| slice | FRONT / LEVEL / BACK | median FRONT − BACK |
|---|---|---|
| spend 4% | 196 / 56 / 77 | +$172,014 |
| spend 6% | 96 / 38 / 6 | +$199,288 |
| **spend 8%** | 12 / 8 / 10 | **−$18,375** |
| state CA | 132 / 56 / 53 | +$156,660 |
| state TX | 172 / 46 / 40 | +$188,024 |

At an 8% spend rate the sign still flips: the liquidity cost of the early tax bill exceeds the
compounding gain. CA's advantage remains far smaller than TX's — state tax on the conversion eats the
premium.

---

## 7. What could not be measured

Of 1,440 N1 comparisons: **750 undelivered** (the IRA does not hold the request — itself a real
constraint on front-loading), 102 insolvent, 89 with unequal delivered spend, leaving **499 clean**.

**N2 (equal lifetime tax) remains unusable at 2 of 60.** Lifetime tax is not monotone in the
conversion amount and usually *falls* as conversions rise ($796,324 → $572,130 → $427,589 at requests
of $0 / $420k / $1.68M): an arm that converts nothing carries a bigger IRA into RMD age and pays more
tax overall. 33 targets fell outside the bracket, 24 were flat, 11 failed to converge.

**C4 is UNTESTED**, not broken — N2 yields 2 usable cells against a 5-cell floor.

---

## 8. Predictions

| id | verdict | evidence |
|---|---|---|
| **C1** FRONT beats BACK in a majority of clean cells | **HELD** | 353 of 499 |
| **C2** FRONT has strictly lower lifetime RMDs in every cell | **BROKEN** | 375 of 499; 124 counterexamples, all bracket @ goal 750k |
| **C3** FRONT's advantage shrinks toward $0 as growth → 0 | **HELD** | paired on 72: $449,889 → $21,724, 4.8% survives |
| **C4** N1 and N2 agree on direction | **UNTESTED** | N2 gave 2 usable cells |

**C2 held at 186 of 186 in the first run and is broken now.** Two changes did it, and both were the
user's call: `P84l` fixed the RMD basis, and the IRA Goal axis replaced a value no plan uses. Neither
was a scorer bug — the first run's scorer was right about the data it was given. **The data was
wrong.**

---

## 9. Six scorer defects across the two runs

Five in the first run (section 7 of the superseded version, preserved in `progress.md`), plus:

6. **The RMD-basis harness's own R2 was written wrong twice** — first as a lifetime-total comparison,
   which condemns a correct fix, then as a blended two-spouse ratio. Details in
   [`RMDBASIS_RESULTS.md`](RMDBASIS_RESULTS.md) section 4.

The standing lesson is unchanged and now has six instances: **the scorer, not the measurement, is
where these bugs live**, because a wrong scorer prints a confident verdict either way.

---

## 10. For the open phases

- **`P5` (greedy per-year schedule)** must carry three constraints, not one: the 8% liquidity
  reversal, the delivery cap (750 of 1,440), **and the IRA-Goal headroom interaction** — a greedy
  search that front-loads into a bracket plan with a live floor will raise that plan's RMDs.
- **The RMD channel is real, is not universal, and is not the payoff.** It is worth ~5% of the effect
  once growth is removed, it reverses for bracket-with-a-floor, and N3 now shows the advantage
  surviving with the RMD stock held equal.
- **Conversions ignoring `curIRA` deserves a decision.** Either the IRA Goal floors the IRA or it
  does not; today it floors withdrawals only.
- **`P85a` is now partly answered** by N3 having signal. Holding the lifetime RMD *stream* equal
  rather than the terminal balance would finish it.
