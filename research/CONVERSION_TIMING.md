# When conversions happen: is earlier better, and is RMD suppression why?  *(phase P85)*

Harness: [`convtiming_harness.js`](https://github.com/nightskyguy/retirement_assets/blob/main/.test_harnesses/convtiming_harness.js). Run `node .test_harnesses/convtiming_harness.js`.
11,328 simulations, ~40 seconds. Suites at the time of the run: **371 / 61 / 22**.

> **THIRD RUN, 2026-08-30. Every number below is this run; the run is deterministic and reproduces
> byte-for-byte.** The second run (2026-08-28) was measured before `P88a-e` (`b34e310`) made a
> conversion reach MAGI so IRMAA charges it, and before `P92a` (`4664958`) made a Fill Bracket
> ceiling actually fill its bracket. Both bear directly on this study: every arm here converts by
> construction, so the IRMAA fix touches all of them, and one of the two families is a bracket
> family.
>
> **The direction of the headline changed.** "Earlier wins by about two to one" no longer holds:
> FRONT is the outright winner of the three shapes in **233 of 474** clean cells, which is not a
> majority, against 304 of 499 before. `C1` — a head-to-head claim, FRONT against BACK alone — still
> HOLDS, but at **284 of 474 (60%)** rather than 353 of 499 (71%). The advice "convert earlier"
> survives as a tendency and no longer survives as a rule.
>
> Two structural changes came with it. **`bracket @ goal 0` now yields no clean comparisons at all**
> (was 6): the corrected ceiling draws harder, so every one of those cells is now filtered out as
> undelivered or insolvent. And **`C2`'s counterexamples went from 124 of 139 bracket cells to 118
> of 118** — every bracket cell at a live IRA Goal is now a counterexample, so what was a strong
> tendency is now exceptionless within that family.
>
> The first run of 2026-08-28 is superseded twice over. Its headline — "front-loading gives strictly
> lower lifetime RMDs in 186 of 186 cells" — was already broken by the second run and stays broken.

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
2 families × **2 IRA Goals** = 240 cells, at 2 program sizes and 3 block widths (1,440 N1
comparisons). Every arm pinned to
`forceWithdrawTiming: 'late'`, because P28ja measured the withdrawal-timing leg as larger than the
conversion leg in 29 of 54 cells.

### Vocabulary - every label used below, defined once

Everything the results sections refer to by a short code is listed here. Sections 2 through 10 use
these without re-introducing them.

**The three schedule shapes.** One cell runs all three, converting the same lifetime gross:

| shape | when it converts |
|---|---|
| **FRONT** | all of it in the first `k` years |
| **LEVEL** | spread evenly across every year |
| **BACK** | all of it in the last `k` years |

**The two sweep knobs.** `k` is the **block width** - how many years the FRONT and BACK blocks span,
swept at 3, 5 and 10. `S` is the **program size** - the lifetime gross to convert, set as a share of
the starting IRA balance and swept at 15% and 30%. A slice written `k=5, S=30%` names one setting of
each.

**The two strategy families.** Each cell runs one of them, and the two behave differently enough
that most results below are reported per family:

| key | strategy |
|---|---|
| **`propwd`** | Proportional 10% - proportional withdrawals plus a 10% IRA boost |
| **`bracket`** | Fill Bracket 24% - draw the IRA up to the top of the 24% federal bracket |

**The three normalizations, N1 to N3.** Equal nominal gross is not a neutral way to compare
schedules: a dollar converted in year 0 removes a larger share of the future IRA than the same dollar
in year 10. So the question is asked three ways, and disagreement between them is itself a result.

| id | what is held equal across the three arms | what it is for |
|---|---|---|
| **N1** | lifetime **gross** converted | the headline. Every number in sections 2 to 6 is N1 unless it says otherwise |
| **N2** | lifetime **tax**, in current dollars | "for the same tax bill, when?" |
| **N3** | **terminal pre-tax IRA** | isolates the RMD stock by construction - hold the stock equal and see whether FRONT still wins |

N2 and N3 reach their target by bisecting a scale factor on each arm's gross until it matches the
LEVEL arm's value, which is why they cost roughly 50x an N1 cell and are run on one slice rather than
the whole grid.

**How a comparison is classified.** Delivery is verified, not assumed, and a cell is only scored if
all three of its arms survive every filter:

| word | meaning |
|---|---|
| **undelivered** | an arm's actual converted gross missed the request, because `applyExtraConversion` caps each year at the available IRA balance. Excluded rather than silently compared at a smaller `S` |
| **insolvent** | an arm ran out of money |
| **dirty** | the three arms did not deliver equal spend. Moving the schedule moves delivered spend, so comparing wealth across unequal spend is meaningless (the P29 / P28jd rule) |
| **clean** | delivered, solvent, equal spend. Only these are scored, on after-tax net worth |

**The four predictions, C1 to C4.** Stated in the harness before the sweep ran, scored in
**section 8**, which carries the verdicts and the evidence:

| id | prediction |
|---|---|
| **C1** | FRONT beats BACK on after-tax net worth in a majority of clean cells |
| **C2** | FRONT has strictly lower lifetime RMDs in EVERY clean cell - the user's stated mechanism, so a single counterexample localizes where the intuition breaks rather than merely denting it |
| **C3** | FRONT's advantage shrinks toward $0 as growth goes to zero. If it does not, something other than compounding is paying |
| **C4** | N1 and N2 agree on direction |

---

## 2. Headline

**Earlier still wins head-to-head, but it is no longer the best of the three shapes in a majority of
cells. The RMD story does not survive contact with a realistic IRA Goal.**

| finding | number |
|---|---|
| FRONT ahead of BACK on after-tax net worth | **284 of 474** clean comparisons (60%) |
| FRONT outright winner of three shapes | **233 of 474** (LEVEL 125, BACK 116, ties 0) — **not a majority** |
| FRONT has lower lifetime RMDs | **356 of 474 — with 118 counterexamples** |
| median FRONT − BACK after-tax net worth | +$72,468 to +$118,955 by block width |
| surviving at zero growth | **4.2%** (paired on 72: $449,889 → $18,832) |

**LEVEL wins outright in 125 of 474 and BACK in 116** — together 51%, so between them the two
non-front shapes take more cells than FRONT does. The extreme is not uniformly best, and that now
matters for `P5` more than it did: a greedy schedule that always front-loads is choosing the losing
side of a coin flip in half the grid.

The head-to-head and the three-way disagree because FRONT and BACK are the two extremes: where the
middle is best, FRONT still beats BACK and still loses the cell. Both numbers are reported for that
reason, and quoting only the 284 overstates the case.

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
| Fill Bracket 24% | $750,000 | $1,286,503 | **$1,699,611** |

**At goal 0 the bracket family drains the IRA to nothing and takes no RMDs at all.** A harness asking
what conversions do to RMDs, run at goal 0, was asking it of plans that have none. It is also the
whole explanation for why N3 (equal terminal pre-tax IRA) produced nothing usable in the first run:
"flat at zero, the IRA is exhausted with or without the conversion" in 48 of 60 arms is a statement
about goal 0, not about conversions.

The clean-cell population for the bracket family goes from **0** comparisons at goal 0 to **118** at
goal 750k. It was 6 and 133 before `P92a`: the corrected ceiling draws harder, which pushes every
goal-0 bracket cell over the delivery or solvency filter. **A family with no clean cells on one side
of an axis cannot be compared across that axis at all**, so the goal-0 bracket row below is now
empty rather than thin - and the six cells that used to fill it were the entire basis for treating
goal 0 as a measurable arm for this family.

| slice | FRONT / LEVEL / BACK | median FRONT − BACK |
|---|---|---|
| IRA Goal 0 | 75 / 51 / 52 | +$33,681 |
| IRA Goal $750k | 158 / 74 / 64 | +$123,559 |
| propwd @ goal 0 | 75 / 51 / 52 | +$33,681 |
| propwd @ goal 750k | 75 / 51 / 52 | +$33,681 |
| bracket @ goal 0 | — no clean cells | — |
| bracket @ goal 750k | 83 / 23 / 12 | +$253,883 |

Proportional is **bit-identical** across the two goals — the ceiling never binds for it, and that
still holds exactly. Every difference the goal makes runs through the bracket family, which is now
the only family with anything to compare at all at goal 750k.

At goal 0 the grid is therefore **entirely Proportional**, and its median advantage there (+$33,681)
is a third of what it was (+$110,283). The goal-0 slice is no longer a mixed population and should
not be read as one.

### A related gap, found on the way

**Conversions ignore the IRA Goal entirely.** `applyExtraConversion` caps the year's gross at
`_availIRA = balance.IRA1 + balance.IRA2` (`optimizer_core.js:2694`), never at `yr.curIRA`. So a
conversion program can drive the IRA below a goal that voluntary withdrawals are forbidden to cross.
Whether that is intended is a design question, not a defect call — but it is the mechanism behind
section 4, and it is currently undocumented.

---

## 4. C2 is BROKEN - 118 cells where front-loading gives HIGHER lifetime RMDs, and now it is every one

C2 predicted FRONT would have strictly lower lifetime RMDs in **every** clean cell. It does not.

The counterexamples are perfectly localized:

| grouping | counterexamples |
|---|---|
| by IRA Goal | goal 0: **0 of 178** · goal 750k: **118 of 296** |
| by family | propwd: **0 of 356** · bracket: **118 of 118** |
| by spend rate | 4%: 74 of 314 · 6%: 44 of 134 · 8%: 0 of 26 |
| by block width | k3 36/154 · k5 38/156 · k10 44/164 |
| by program size | S15% 67/253 · S30% 51/221 |

**Every one is the bracket family at a live IRA Goal, and now every such cell is one.** The
bracket-family row reads 118 of 118: the counterexample is no longer a tendency inside that family,
it is the whole family. Before `P92a` it was 124 of 139, leaving 15 bracket cells where FRONT did
suppress RMDs; the corrected ceiling removed the last of them. Proportional remains at 0 of 356.

That makes the split cleaner than it was, and worth restating as a rule rather than a count: **at a
live IRA Goal, front-loading a bracket strategy RAISES its lifetime RMDs — always, on this grid.** The mechanism, measured rather than argued —
same plan, same $210,000 conversion gross, only the schedule shape differing:

| arm | voluntary IRA spend | lifetime RMD | terminal IRA |
|---|---|---|---|
| FRONT | $1,125,092 | **$1,692,247** | $1,285,901 |
| BACK | $1,328,074 | **$1,462,895** | $1,067,049 |

FRONT draws **$202,982 less** voluntarily, ends with **$218,852 more** IRA, and takes **$229,351
more** in RMDs. (Fill Bracket 24%, shipped defaults, CA, reserve off, goal $750k, `k=5`, `S=$210,000`,
spend $64,000. The BACK arm's two figures are unchanged to the dollar from the previous run — the
mechanism is stable; it is the population around it that moved.)

Front-loading consumes the above-goal headroom early. The bracket rule's own withdrawals are capped
at `curIRA`, so they are throttled for the rest of the plan; the IRA sits near the goal and compounds;
and RMDs — which the goal does not cap — run higher later. Conversions ignore the goal, withdrawals
respect it, and the two compete for the same headroom.

**So the user's RMD intuition is right for a plan with no IRA floor and right for Proportional, and
wrong for the strategy most likely to be paired with a floor.**

---

## 5. The mechanism: compounding pays, and now N3 (equal terminal IRA) says so directly

| channel | FRONT − BACK, 474 clean comparisons |
|---|---|
| lifetime RMD (BACK − FRONT) | median +$356,432 (min −$1,027,472, max +$4,863,847) |
| terminal Roth | median **+$1,353,548** (min −$592,775, max +$7,212,167) |
| net into Roth off the **same** gross | median **−$484** (min −$118,306, max +$52,495) |
| IRMAA years | median **0** (min −15, max +6) |

**The IRMAA channel closed.** Its median was −1 year and is now 0, with the range widening both ways
(−15 to +6, from −13 to +2). That is `P88a-e` arriving: before it, a conversion never reached MAGI,
so front-loading appeared to buy a Medicare-surcharge year back for free. Charged properly, the
median cell gains no IRMAA years from front-loading and some lose badly. **One of the three
mechanisms this study credited to earlier conversion was an artifact of the unbilled conversion.**

**C3 held again**: paired on the 72 comparisons clean at both growth rates, the median |FRONT − BACK|
collapses from $449,889 to $18,832 — **4.2% survives** (was 4.8%). FRONT is still ahead in 70 of 72
at zero growth, so a small pure tax-timing residual is real, as in P28ja's Q5.

**N3 still has signal.** Holding terminal pre-tax IRA equal — the RMD stock — **17 of 60** arms are
usable and FRONT still leads **10 / 4 / 3** with a median of **+$339,924** (was 18/60, 9/5/4,
+$459,475). The decomposition survives: **FRONT keeps its advantage with the RMD stock held equal, so
compounding is what pays.** The zero-growth arm and N3 still agree, and the margin is a quarter
smaller.

**The conversion tax rate is still not the lever.** Off an identical gross, the net landing in Roth is
a coin flip, median −$484.

---

## 6. Where the effect reverses

| slice | FRONT / LEVEL / BACK | median FRONT − BACK |
|---|---|---|
| spend 4% | 150 / 86 / 78 | +$118,955 |
| spend 6% | 75 / 31 / 28 | +$100,525 |
| **spend 8%** | 8 / 8 / 10 | **−$22,544** |
| state CA | 94 / 65 / 67 | +$16,993 |
| state TX | 139 / 60 / 49 | +$138,445 |
| k = 3 | 68 / 51 / 35 | +$90,690 |
| k = 5 | 76 / 41 / 39 | +$118,955 |
| k = 10 | 89 / 33 / 42 | +$72,468 |
| S = 15% of IRA | 138 / 67 / 48 | +$138,445 |
| S = 30% of IRA | 95 / 58 / 68 | +$30,090 |

At an 8% spend rate the sign still flips, and BACK now outright wins that slice (8 / 8 / 10): the
liquidity cost of the early tax bill exceeds the compounding gain.

**CA has effectively stopped paying.** Its median advantage fell from +$156,660 to **+$16,993**.
FRONT still takes the most CA cells (94 of 226) but that is a plurality, not a majority: LEVEL and
BACK together take 132. State tax on the conversion was always eating the premium; charged alongside
the IRMAA the conversion now also owes, it eats nearly all of it. **In California, on this grid, the
median gain from converting earlier is under $17,000.**

**The bigger program is the worse one to front-load.** At `S = 30%` of the IRA the median advantage
falls to +$30,090, against +$138,445 at `S = 15%`, and FRONT's 95 of 221 is again only a plurality
(LEVEL 58, BACK 68). Front-loading a large program concentrates the tax and the surcharge into a few
years, and the concentration costs more than the extra compounding returns.

---

## 7. What could not be measured

Of 1,440 N1 (equal lifetime gross) comparisons: **768 undelivered** (the IRA does not hold the
request - itself a real constraint on front-loading), 98 insolvent, 100 with unequal delivered spend,
leaving **474 clean**. The undelivered count rose by 18 and the clean population fell by 25. Where
those 25 went is worth naming, because it is not spread evenly:

| slice | 2nd run | this run | change |
|---|---|---|---|
| propwd @ goal 0 | 180 | 178 | −2 |
| propwd @ goal 750k | 180 | 178 | −2 |
| bracket @ goal 0 | 6 | **0** | −6 |
| bracket @ goal 750k | 133 | 118 | −15 |

**21 of the 25 are the bracket family**, across both goals - the family `P92a` changed. Proportional
lost 2 cells a side, which is the `P88a-e` IRMAA charge tipping a handful of marginal plans over the
solvency filter. The attrition is concentrated exactly where the engine changed, which is the check
that the population shift is the fix and not noise.

**N2 (equal lifetime tax) is now unusable at 0 of 60**, against a 5-cell floor — it was 2. Lifetime
tax is not monotone in the conversion amount and usually *falls* as conversions rise: an arm that
converts nothing carries a bigger IRA into RMD age and pays more tax overall. 36 targets fell outside
the bracket, 24 were flat, 18 failed to converge.

**C4 (N1 and N2 agree on direction) is UNTESTED**, not broken: with 0 usable N2 cells there is no
N2 direction to compare against N1. Two runs have now failed to make N2 usable, which is itself
worth recording — **the normalization is not merely underpowered on this grid, it is the wrong
instrument for a non-monotone metric**, and a third attempt should change the method rather than the
sample.

---

## 8. Predictions, scored

Stated before the run (section 1 lists them); verdicts here.

| id | verdict | evidence |
|---|---|---|
| **C1** FRONT beats BACK in a majority of clean cells | **HELD** | 284 of 474 (60%) |
| **C2** FRONT has strictly lower lifetime RMDs in every cell | **BROKEN** | 356 of 474; 118 counterexamples, all bracket @ goal 750k, and now all 118 of that family's cells |
| **C3** FRONT's advantage shrinks toward $0 as growth → 0 | **HELD** | paired on 72: $449,889 → $18,832, 4.2% survives |
| **C4** N1 and N2 agree on direction | **UNTESTED** | N2 gave 0 usable cells |

**C2 held at 186 of 186 in the first run and has been broken by both runs since.** Three engine
changes did it across the two re-runs: `P84l` fixed the RMD basis, `P92a` corrected the bracket
ceiling, and the IRA Goal axis replaced a value no plan uses. None was a scorer bug — each run's
scorer was right about the data it was given. **The data was wrong, three times, in the same
direction.**

**C1 is the verdict to watch.** It has held in all three runs, but its margin has fallen from 353 of
499 (71%) to 284 of 474 (60%), and the three-way count it does not measure has crossed below a
majority. A prediction phrased as head-to-head keeps passing while the practical claim underneath it
- "front-load" - stops being the best available advice. **That is a prediction that is too weak to
notice its own subject changing**, and it should be restated for any fourth run as a three-way claim.

---

## 9. Seven scorer defects across the three runs

Five in the first run (section 7 of the superseded version, preserved in `progress.md`), plus:

6. **The RMD-basis harness's own R2 was written wrong twice** — first as a lifetime-total comparison,
   which condemns a correct fix, then as a blended two-spouse ratio. Details in
   [`RMD_BASIS.md`](RMD_BASIS.md) section 4.
7. **`C1` is phrased too weakly to fail when its own subject changes.** It asks whether FRONT beats
   BACK head-to-head, and has HELD in all three runs. But the claim the study exists to test is
   "convert earlier", and the three-way count that actually answers it crossed below a majority in
   this run without moving `C1` at all. A prediction that cannot notice the headline reversing is a
   scorer defect, not a passing grade. The third run found no defect in the harness code itself.

The standing lesson is unchanged and now has seven instances: **the scorer, not the measurement, is
where these bugs live**, because a wrong scorer prints a confident verdict either way — and the
seventh adds a corollary: **a prediction can be wrong by being too easy to keep passing.**

---

## 10. For the open phases

- **`P5` (greedy per-year schedule)** must carry four constraints, not one: the 8% liquidity
  reversal, the delivery cap (768 of 1,440), **the IRA-Goal headroom interaction** — a greedy search
  that front-loads into a bracket plan with a live floor will raise that plan's RMDs, now in every
  such cell — **and the fact that FRONT is no longer the majority winner**, so a schedule search
  should not be seeded with a front-loaded prior.
- **The RMD channel is real, is not universal, and is not the payoff.** It is worth ~4% of the effect
  once growth is removed, it reverses for bracket-with-a-floor in every cell, and N3 still shows the
  advantage surviving with the RMD stock held equal.
- **The IRMAA channel is gone.** Its median was −1 year and is 0 now that `P88a-e` charges the
  conversion. Any argument for early conversion that leans on Medicare surcharges should be re-derived
  rather than cited from the earlier runs.
- **Conversions ignoring `curIRA` deserves a decision.** Either the IRA Goal floors the IRA or it
  does not; today it floors withdrawals only.
- **`P85a` is now partly answered** by N3 having signal. Holding the lifetime RMD *stream* equal
  rather than the terminal balance would finish it.
