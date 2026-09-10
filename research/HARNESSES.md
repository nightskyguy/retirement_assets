# Test harnesses

One row per investigative script in [`.test_harnesses/`](../.test_harnesses/). These are **not**
part of the unit-test suite (`optimizer_core.tests.js`); they exist so a finding can be re-derived
on demand. The reports they produce live beside this file and are indexed by
[README.md](README.md).

This file is a catalog, not an introduction.

## What happened on 2026-09-10 (`P116`)

**Twenty-eight harnesses and sixteen reports were deleted**, and this file was rebuilt from what
survived. The rule was: a study whose decision has SHIPPED goes, together with the harness that
produced it, because the decision is pinned by a test or by the changelog. A study for an OPEN phase
stays. Nothing is kept as a historical record; the commit messages are the record, and every deleted
file is recoverable with `git log --diff-filter=D -- <path>`.

Four of the deleted scripts were **silently wrong** and had been for some time: they set the retired
`forceWithdrawTiming` input, which the timing modes replaced. Four more parsed the Annual Details
`timing` column with `startsWith('Early')`, which now reads the conversion label rather than the
withdrawal one. That is the cost of keeping a script nobody re-runs.

The 2026-08-30 re-evaluation table that used to sit here has gone with them: it described files that
no longer exist.

## The last-run column, and why it is here

**A harness that has not been run since the engine changed is not evidence.** Every report in this
repository predated at least one of six engine changes at the time of the prune (the Split timing
default, the ACA-MAGI measurement, the LTCG floor and both-path ceiling, in-year conversion
compounding, the prior-December RMD basis, and the cash-interest true-up), and their numbers were
cited anyway. So each row records the engine commit the script was **last actually executed on**.

`b3cafa3` is v11.17b1. A row saying **not re-run** means exactly that: the script loads and its
question is still open, but no number from it should be quoted until it has been run again.

## The households

**The households these harnesses run on are a bank: [`plans/`](../plans/README.md).** Every harness
that built its own base plan has had it extracted there with a card naming what it can and, more
usefully, what it CANNOT show. A new harness should pick a plan by name rather than carry a literal.
`which_plan.js` reports which household each script actually runs on.

**The `COMMON` block has NOT been converted, and it is worse than the duplication it looks like.**
Files declaring a `COMMON` have DRIFTED: several distinct households share that one variable name.
`endgame_harness.js` is a different household entirely (born 1951/1953, retiring at 75, a $750k IRA
goal); the `split_*` trio, `gk_drawrule*`, `magi_edge_gate` and `family_equivalence` all run a
declining spend and a zero cash reserve that the others do not. **A reader seeing `COMMON` in two of
these files is entitled to assume one household and would be wrong.** That is what `P112c` has to
fix, and deleting twenty-eight scripts has made it a much smaller job.

## The scripts

| script | mode | what it asks | report | last run on |
|---|---|---|---|---|
| `betr_harness.js` | node | Whether the displayed Break-Even Tax Rate puts its hurdle in the right place. Rebuilt in `P116` to sweep the plan bank, not one household. | [BETR_RELIABILITY.md](BETR_RELIABILITY.md) | `b3cafa3` |
| `conversion_value_harness.js` | node | Does converting pay, measured as "more Roth for the smallest reduction in net worth, spending fixed"? | [CONVERSION_VALUE.md](CONVERSION_VALUE.md) | `b3cafa3` |
| `conversion_value_general_harness.js` | node | The same metric over deliberately varied households: is the result about conversions or about one plan? | [CONVERSION_VALUE_HOUSEHOLDS.md](CONVERSION_VALUE_HOUSEHOLDS.md) | `b3cafa3` |
| `conversion_frontier_harness.js` | node | What the lost net worth actually buys, priced against the best plan on the board rather than the same strategy with conversions off. | [CONVERSION_FRONTIER.md](CONVERSION_FRONTIER.md) | `b3cafa3` |
| `stopyear_stability_harness.js` | node | Is the suggested Stop Conversion year stable, or does it move under small input changes? | [CONVERSION_STOP_YEAR.md](CONVERSION_STOP_YEAR.md) | `b3cafa3` |
| `convtiming_harness.js` | node | When conversions happen: is earlier better, and if so is RMD suppression the reason? | [CONVERSION_TIMING.md](CONVERSION_TIMING.md) | not re-run |
| `timingmode_harness.js` | node | What Split actually costs or buys at RMD age, against Early and Late. | *(table in its own output)* | `b3cafa3` |
| `oracle_harness.js` | node | Perfect-foresight upper bound: how much does any shipped strategy leave on the table? | [PERFECT_FORESIGHT_ORACLE.md](PERFECT_FORESIGHT_ORACLE.md) | not re-run |
| `oracle_crosscheck.js` | node | An independent search of equal cost, to test whether the oracle's ceiling is tight. | [PERFECT_FORESIGHT_ORACLE.md](PERFECT_FORESIGHT_ORACLE.md) | not re-run |
| `schedule_replay_harness.js` | node | What `strategy: 'schedule'` can carry, and what it cannot express. | [PERFECT_FORESIGHT_ORACLE.md](PERFECT_FORESIGHT_ORACLE.md) | not re-run |
| `schedule_oracle_harness.js` | node | Does the wider schedule representation raise the oracle's ceiling? | [PERFECT_FORESIGHT_ORACLE.md](PERFECT_FORESIGHT_ORACLE.md) | not re-run |
| `spend_objective_harness.js` | node | Can the spend goal itself be searched, and under what objective? | [PERFECT_FORESIGHT_ORACLE.md](PERFECT_FORESIGHT_ORACLE.md) | not re-run |
| `magi_edge_gate_harness.js` | node | Do the best plans live on MAGI edges? The gate `P103c` turns on. | [PERFECT_FORESIGHT_ORACLE.md](PERFECT_FORESIGHT_ORACLE.md) | not re-run |
| `gk_drawrule_harness.js` | node | Which draw rule should run under a Guyton-Klinger spend rule? | [PERFECT_FORESIGHT_ORACLE.md](PERFECT_FORESIGHT_ORACLE.md) | not re-run |
| `gk_drawrule_mc_harness.js` | node | Does that answer survive uncertainty, over three Monte Carlo models? | [PERFECT_FORESIGHT_ORACLE.md](PERFECT_FORESIGHT_ORACLE.md) | not re-run |
| `family_equivalence_harness.js` | node | Are two strategy families the same model, or only similar? | [PERFECT_FORESIGHT_ORACLE.md](PERFECT_FORESIGHT_ORACLE.md) | not re-run |
| `split_fine_harness.js` | node | Was the ten-archetype split menu close enough, or does a fine search beat it? | [CONSTANT_SPLIT.md](CONSTANT_SPLIT.md) | not re-run |
| `split_mc_harness.js` | node | Does a constant split survive an uncertain future? | [CONSTANT_SPLIT.md](CONSTANT_SPLIT.md) | not re-run |
| `split_expressiveness_harness.js` | node | How much per-year freedom does a good draw split actually need? | [CONSTANT_SPLIT.md](CONSTANT_SPLIT.md) | not re-run |
| `phased_harness.js` | node | Do any strategies never win, and where does each family rank? **Kept for a planned re-measure**; its report was retired with the rest. | *(to be rewritten on re-run)* | not re-run |
| `endgame_harness.js` | node | What should the tail draw from, once the IRA has reached its target? **Kept for a planned re-measure**; its report was retired with the rest. | *(to be rewritten on re-run)* | not re-run |
| `taxattrib_harness.js` | node | Which assets pay the tax, and what the settlement date is worth. | *(open, `P115`)* | not re-run |
| `which_plan.js` | node | A tool, not a study: which household does each harness actually run on? | *(none)* | `b3cafa3` |

## Running one

```sh
node .test_harnesses/<name>.js
```

Every script is node-only and self-bootstrapping: it stubs `window`/`document`/`performance`, loads
`taxengine.js`, `displayhelpers.js` and `optimizer_core.js`, and reads its household from
[`plans/`](../plans/README.md). None of them writes to the repository.

**If you run one, update its row.** A last-run column that is not maintained is the same defect this
file was rebuilt to remove.
