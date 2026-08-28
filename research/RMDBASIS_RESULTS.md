# P84k / P84l / P84m / P84o — the RMD basis was a mid-year balance

Harness: [`rmdbasis_harness.js`](https://github.com/nightskyguy/retirement_assets/blob/main/.test_harnesses/rmdbasis_harness.js). Run `node .test_harnesses/rmdbasis_harness.js`.
Suites after the change: **344 / 61 / 22** (`slowInCore` 3).

---

## 1. The defect

26 CFR 1.401(a)(9)-5 sets a year's required distribution as the **prior December 31** account
balance over the life-expectancy divisor. Nothing that happens during the year can change it.

The engine struck it off `balance.IRA1` at `optimizer_core.js:1557`, which by then had already had
**this year's** pre-withdrawal growth applied in `beginYear`. Two errors:

1. **A systematic overstatement** of roughly `preMonths/12 × growth`.
2. **The RMD was coupled to the withdrawal-timing rule.** `preMonths` is 1 or 11, picked from
   `yr._useEarly`, which is set from whether *last year* converted more than $1,000. **Two otherwise
   identical plans got different RMDs because one of them converted.** No basis in the regulation,
   and the same coupling P28j is scoped against, surfacing in a second place.

---

## 2. P84k — characterization, run before anything changed (risk R12)

30 plans (5 mixes × 3 families × 2 spend rates), `iraBaseGoal` at the shipped $750,000.

**22 of 30 plans had a timing-dependent RMD.** Relative spread: min 0.00%, median 6.21%, max
**58.62%** — far above the 5.49% that 11 months of 6% growth accounts for on its own, because an
inflated RMD forces out more money, which shrinks the balance, which re-bases every later RMD. The
error compounds; it is not a one-year stub.

| plan | RMD (late) | RMD (early) | gap |
|---|---|---|---|
| defaults / propwd / 4% | $4,598,607 | $4,190,329 | −8.88% |
| defaults / propwd / 6% | $3,153,303 | $2,746,500 | −12.90% |
| defaults3x / propwd / 6% | $1,157,640 | $674,407 | −41.74% |
| defaults3x / draw / 6% | $4,072,228 | $2,358,650 | −42.08% |
| round1 / propwd / 6% | $880,142 | $541,778 | −38.44% |

---

## 3. The fix

**P84l.** `sim.priorYearEndIRA1` / `priorYearEndIRA2` snapshotted at the top of `beginYear`, before
the growth call. At that point `balance` *is* the prior December 31 position: last year's
`growAndSettle` applied `postMonths` and nothing has moved since. Read at the RMD lines instead of
the live balance.

**P84m.** `yr.totalRMD` and `yr.taxableRMD` capped at the **realized** IRA outflow. The debits
already floored at zero, but both totals were computed from the *requirement*, so an IRA drained
below the required amount was taxed on a distribution that never happened. Reachable today via a
large QCD.

**P84o.** Year 0 is **not** clean and is not pretended to be. The snapshot seeds from the typed IRA
balance, which is a December 31 balance only for a plan starting in January. `P72` owns `startMonth`
and therefore owns the fix; a test pins the limitation so it cannot drift silently.

---

## 4. Predictions, scored

| id | verdict | evidence |
|---|---|---|
| **R1** lifetime RMDs fall wherever any RMD is taken | **HELD** | e.g. defaults/propwd/4% $4,598,607 → $4,372,422 |
| **R2** the RMD **basis** is timing-independent | **HELD** | 22 of 30 violating → **0 of 30**, agreement to 7e-18 |
| **R3** terminal IRA rises | **HELD** | GK fixture final net worth $9,021,152 → $9,188,057 |
| **R4** IRMAA breach years fall or hold, never rise | **HELD** | no fixture gained a breach year |

### R2 was written wrong twice, and both wrong versions are the point

**Version 1 tested lifetime totals:** *"pinning timing early vs late changes lifetime RMDs; after
the fix it changes them by $0."* Run against the **correctly fixed** engine this reported **30 of 30
plans still violating** — worse than the 22 of 30 it found before the fix. The statement is simply
false: timing legitimately changes the balance *path*, so next year's December 31 balance, and
therefore next year's perfectly legal RMD, differs. **The regulation constrains the basis, not the
trajectory.** Taken at face value this would have condemned a correct fix.

**Version 2 tested the combined ratio** `(rmd1+rmd2) ÷ (prior IRA1+IRA2)`. Each spouse carries their
own divisor, so that quotient is a *blend* weighted by the IRA1/IRA2 split — and the split itself
moves between arms. It reported a 2.3e-4 discrepancy that was entirely the blend.

**Version 3, per account,** agrees to 7e-18 and is what both the harness and the node test now use.
Two consecutive rounds of measuring the nearest convenient statistic instead of the quantity
claimed — the same family as P83's P1, P30f's vacuous predicate, and the four defects in P85.

---

## 5. Re-baselines, each checked against a prediction rather than accepted

Three pinned assertions moved. Under R12 the rule is that a moved number must match the
characterization's predicted **direction**, or it is a regression wearing a re-pin's clothes.

| assertion | before | after | direction |
|---|---|---|---|
| GK total spend | $7,393,024 | $7,423,664 | **up** — less forced ordinary income, so less tax, so more spendable |
| GK total tax | $2,027,749 | $1,925,649 | **down** −5.0% — the RMD stub is gone |
| GK final net worth | $9,021,152 | $9,188,057 | **up** +1.85% — R3 |
| P38 forced-IRA total | $18,719 | $33,744 | **up**, and this one looks wrong until you read the fixture |

**The P38 move is the one worth explaining.** That fixture sets `propWithdraw: 0`, so there is *no*
primary draw: spending is funded by Social Security plus whatever the RMD forces out, and the
backstop covers the rest. Smaller RMDs mean less income arrives on its own, so the backstop —
which is what `ForcedIRA` counts — reaches further. **Smaller RMDs and a bigger backstop are the same
finding seen twice**, not a contradiction.

Guardrail adjustment count stayed at 3, which is the signature the GK test's own comment describes
for a valuation fix rather than a behavior change in the withdrawal engine.

---

## 6. New tests

Four, all in `optimizer_core.tests.js` (340 → 344):

- **P84l** the RMD ÷ prior year-end balance is a life-expectancy factor to one decimal, per account.
- **P84l** that quotient is identical on both timing arms — **the test that fails on `main`**.
- **P84m** a drained IRA is never taxed on more than the realized outflow.
- **P84o** year 0 keys off the balance as typed, pinning the limitation rather than hiding it.

`TestTiers.EXPECTED` and the suite table in `.githooks/README.md` reconciled in the same commit.

---

## 7. What this does to P85

P85's first run measured the RMD channel on this broken basis **and** at `iraBaseGoal: 0`. Both were
wrong, and together they flipped a headline: the claim "front-loading gives strictly lower lifetime
RMDs in 186 of 186 cells" became **375 of 499, with 124 counterexamples**. See
[`CONVTIMING_RESULTS.md`](CONVTIMING_RESULTS.md) section 4.

Still open: `P84a`–`P84j`, the AUM fee itself. `P84l` retires risk **R11** and placement reason 3 in
that plan — once the RMD keys off the prior December 31 balance, a mid-year fee cannot move the same
year's RMD at all, which is the legally correct answer.
