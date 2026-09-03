# Progress Log

Session entries from **2026-08-20**. Everything earlier is in `progress_archived.md`, verbatim.

## Session: 2026-08-20 (worktree readme-review-updates-c9df11) - plan resync, no code

Planning files had drifted three ways against `main` = `0b4d5b5`; this session only closed the gap.
PRs #182/#183/#184 had all merged since the header was written.

- **`P64g` DONE** (PR #184) - `Retirement_Projection.html:1278-1303` derives `obbaOn`/`saltHigh` from
  `TAXData.OBBBA.*.sunsetYear` per year and passes an inflated `propTax`. **P64 COMPLETE.**
- **The IRMAA forward-threshold work had no phase ID at all** - shipped v11.15cf in #182/#183 with a
  changelog entry, three harnesses and a merge post-mortem. Filed retroactively as `P66`.
- Test counts did NOT move (280/61/22, slowInCore 3), checked not assumed, so `TestTiers.EXPECTED`
  and `.githooks/README.md` needed no edit.

**The page's own test caught a defect in my changelog entry.** I wrote `<b>Behavior change:</b>`; a
tier-1 test asserts every `<b>` in the changelog list is a version stamp alone in its own `<li>`.
Badge went red at 610/611 and the failure text is not in the DOM - it had to be chased through
`TIER1_RESULT` and a console capture. Changed to `<strong>`. A good argument for always loading the
page rather than trusting three green node suites.

Version bumped only at the three sites this release touched (`<title>`, `optimizer_core.js?v=`, the
tier-2 loader's own `const V`); `taxengine.js`, `optimizer_ui.js` and the CSS deliberately left.

## Session: 2026-08-22 (worktree readme-review-updates-c9df11) - `/plan` re-entry, context restore

`/plan` invoked with no task. Planning files already exist under `.planning/retirement-optimizer/`
with `.planning/.active_plan` pointing at it; no root-level `task_plan.md` was created, since that
would have forked the plan.

**State measured, not assumed.** `git rev-parse --abbrev-ref HEAD` =
`worktrees/planning-with-files-2a1f63`; `git rev-list --count origin/main..HEAD` = 0, working tree
clean, `main` = `721653d` (Merge PR #185). `retirement_optimizer.html` `<title>` reads **11.15e3**.

**One drift closed.** The header still called v11.15e3 "P32 complete, unreleased" - it merged in
**PR #185**. Header rewritten line-neutrally (3 lines out, 3 in) with the LINE-30 BOUNDARY marker
asserted before and after the write, and the P32 NOW paragraph now names the PR.

Nothing else had drifted: O0/O1 rows (P35, P36, P51, P30, P19, P34, P65) are unchanged and P32's
index row was already struck. No product file touched, so no version bump and no changelog entry.

## Session 2026-08-22 (continued) - P67a: the "Optimize for" goal now picks the columns

User asked for the Optimizer's goal selector to control which columns show, giving three examples:
Roth Conversion Effectiveness should show the total Roth balance, Spend Goal and Yrs Funded should
leave the table, Total RMDs matters mainly under Avoiding Widow & RMD Tax. Then, answering the
Δ-columns question, asked for something larger: a second **rendering mode** where every numeric column
reads as a delta from the pinned row. Split into PR A (shipped) and PR B (P67b, not started).

**Three explorations first, and the findings shaped everything.** The table is a CSS grid of flat
`<div>`s, not a `<table>`; all 21 columns come from ONE descriptor array, `getOptimizerColumns()`;
**no test anywhere asserts on its columns** and no CSS targets them (`nth-child` appears nowhere in
the repo). So the mechanism was a `filter()`, not a rewrite. What it was NOT free of was index
arithmetic: four separate hazards, each dormant only because no column had ever been optional.

**The fourth hazard was the one nobody listed and the one that mattered.** A sort column that no
longer exists left `col === undefined`, skipped the sort block, and rendered rows in **build order
under a header carrying no arrow**. Not an error, not a blank table - just quietly unsorted. Now
`normalizeSortState()` at the single render choke point. Verified by hand: sort by Yrs Funded with
all columns showing, collapse back to a goal that hides it, and the order falls to goal order.

**Three goals ranked on numbers with no column.** `maxroth` on `terminal.roth`, `widowrmd` partly on
`terminal.ira`, and `taxflex` - the DEFAULT - on a spread computed inline inside its own ranker. New
Final IRA / Final Roth / Mix Spread columns. `afterTaxBucketSpread()` was **extracted** from the
ranker rather than reimplemented in the UI, so the number the column prints and the number the
ranking sorts on are the same number. A node test asserts the column and the ranker agree on order.

**`OPT_OBJECTIVE_COLUMNS` went in core, not the UI.** `optimizer_ui.js` has no `module.exports` and
no `window.*` block and no node suite loads it, so anything placed there cannot be asserted outside a
browser. Cost: core holds string references to identifiers defined in the UI. Paid for with
`OPT_COLUMN_KEYS` as an explicit contract plus the one tier-1 test that can see both files.

**Two defects found while verifying, neither predicted.**

1. The page's own changelog test caught my changelog entry: it asserts every `<b>` in the list is a
   version stamp in its own `<li>`, and I had used `<b>` for emphasis. Badge went red at 655/656.
   The same trap as the `<strong>` incident recorded above, from the other side. The failure text is
   not in the DOM, so it needed a console capture around `runTests()` to name.
2. **Chrome fires `toggle` when it PARSES a `<details open>`.** Both legend strips carry `open`, so
   two toggles fired before any init code ran, the inline `ontoggle` handler wrote "both open" to
   localStorage, and `restoreFoldState()` then read back the value it had just clobbered. A reader
   who folded the strips would find them open again on every visit, with nothing in the console.
   Found by tracing the load order rather than reasoning about it - three wrong theories first.
   Guarded with `_foldsRestored`: nothing persists until the stored preference has been read.

**One deviation from the approved plan, deliberate.** The plan put the Infeasible/Failed chips beside
the "Showing N of 21 columns" link. That link sits by the goal selector, which is where the *cause*
is, while the chips hide *rows* and belong beside the rows. They now sit on their own always-visible
strip directly above the two folds, still outside the fold, which was the actual requirement.

**Counts moved and both pins were reconciled from measured output**: node `optimizer_core` 280 ->
**286**, `slowInCore` unchanged at 3, TPP 61 and doclinks 22 unchanged. `TestTiers.EXPECTED` and
`.githooks/README.md` both edited in the same commit. Tier-1 went 248 -> **287**, which is NOT in
`EXPECTED` (it pins node suites only) and is called out in the commit message for that reason.

**Version bumped at all four sites** to **11.15f9**: `<title>`, the `?v=` on core/ui/tests, and the
tier-2 loader's own `const V`. The stale-token GOTCHA bit mid-branch and is worth repeating: after
commit 2 the browser served a **cached** `optimizer_core.js?v=1115e3` with no `afterTaxBucketSpread`
in it, and the error looked like a missing export rather than a cache hit.

**Browser-verified at 11.15f9**, badge green at 656 (287 in-page + 369 node): all nine goals render
9-10 columns with ⚖ first and the main and Best tables on matching track counts; Δ columns appear
only on pin, labelled `ΔFinalWealth vs ⚖`; the escape hatch reads "Showing 9 of 21 columns", expands
to 21 and back; the density preference survives a goal change; no green row lacks a highlighted cell;
`📋 Lowest RMD Tax%` disappears from the Best table under goals that hide the column while
`⚓ Best w/o Conv` survives under all nine; the fold persists across reload with the chips still
visible and still live-counting ("click to show 8 hidden"). Console clean apart from the usual
unrelated Cloudflare RUM CORS error. **No screenshot** - the Browser pane was not displayed, so all
of the above is DOM-level assertion rather than visual.

**Bookkeeping note:** `git add -A` on commit 2 swept the earlier planning-file resync into a feature
commit. Content correct, commit boundary not. Explicit paths thereafter. Also, P51 was rotated out of
the NOW table to make room for P67 (the table is capped at 7 rows by the LINE-30 BOUNDARY); it keeps
its O1 index row and is not dropped.

## Session 2026-08-22 (continued) - P67a review rounds, v11.15f9 -> v11.15fa

Two rounds of user review on the shipped table, then the PR. Nine items total, all landed.

**Round 1, seven items** (`bd75a56`). Duplicate "Your plan" symbol. Three legend strips merged into
one fold. Naming unified. `Conv Tax` with Break Even ahead of it. Colour legend lines dropped for
every colour whose rows carry a symbol. Compare hint folded. One ⚖ instead of 178.

Two of these were settled by READING rather than by opinion: **"Infeasible" and "target unreachable"
were literally the same flag** (`optimizer_ui.js:836` renders ⚠️ on exactly the condition that drives
the row colour and the hide-rows filter), and the summary bar's four tile names were checkable at
`retirement_optimizer.html:431-434`. The naming answer **reverts FinalWealth**, which the user had
asked for one round earlier - the summary bar won because it is what a reader sees first.

Also flagged before acting, and it changed the plan: item 7 wanted the compare row shaded like the
baseline, but item 3 had just pointed out baseline and Optimize Spend were already both `#dbeafe`.
Three things blue. User chose to strip ✦ of its colour rather than invent a fourth.

**Round 2, two items** (`1eef3b2`). The 💵 entry was not missing an explanation - **round 1 had
deleted it**. The merge script kept only spans opening `<span title=` and that one opens `<span id=`,
because `optimizer_ui.js:116` toggles it by id. A self-inflicted regression, found only because the
user noticed the symbol had no key. ⚠️ and 🚨 removed from the symbol list, both having a permanent
chip that says more (live count, click to toggle). 🟢 kept - no chip of its own.

**Two GOTCHAs, both now in task_plan under P67a.**
1. A goal's column list does NOT set display order; the filter preserves `OPT_COLUMN_KEYS`. Moving
   Break Even ahead of Conv Tax by editing `OPT_OBJECTIVE_COLUMNS` alone did nothing visible.
2. `sed -i` on Git Bash rewrites a CRLF file as LF. It flattened `retirement_optimizer.html` and
   `.githooks/README.md`. Git normalises so the blob survives, but `.gitattributes` pins
   `.githooks/**` to `eol=lf`, so blanket "restore CRLF" is WRONG there - a CR in a shebang breaks
   the hook for every Windows clone. Python with `newline=''` throughout instead.

**One self-inflicted corruption, caught immediately.** Swapping the convBE/convSaved descriptors with
a brace-matching script relocated the `Conv Tax` block into an unrelated Chart.js legend helper 1600
lines away. Caught by a `new Function()` parse check before anything else ran, repaired in place
rather than reverted (a revert would have lost the other six items), and the helper was confirmed
absent from `git diff`. Lesson: for block moves in a large file, anchor on the unique `key:` line and
assert the neighbours, do not trust `rfind` on a brace.

**Recorded, not fixed:** `buildStrategyFamilies` (`optimizer_core.js:4305`) sets `cashClones` on
`base.Cash > 0` with NO nerdknob gate, while the Optimizer's own call site (`optimizer_ui.js:911`)
gates on `NERD_KNOBS && base.Cash > 0`. The ungated path is Monte Carlo's, so MC can label a row 💵
with no legend anywhere on that tab. Pre-existing, outside this change.

**Final state:** v11.15fa, 6 commits, suites 286 / 61 / 22, tier-1 287/0, badge green at 656.
Verified in the browser at every step: Break Even now precedes Conv Tax under both conversion goals;
of 167 compare cells exactly one carries the marker, on a row shaded `rgb(219,234,254)`; the 💵 entry
is present under nerdknob and hidden without it. Still no screenshot - the Browser pane was never
displayed, so all of it is DOM assertion.

**Planning-file near-miss worth recording:** updating the NOW table by line INDEX clobbered the P30
row and duplicated P67, because the assert was written after the assignment and so was vacuous.
Caught by diffing the table against HEAD. Match on row TEXT, not on index, and assert before writing.

## Session 2026-08-22 (continued) - changelog brevity rule, P68 deferred, then P67b built

**The changelog rule got a NUMBER, which is why it will now hold.** The memory already said
"brevity"; it constrained nothing, and a 954-word entry got written under it. User: "WAY too long",
with a ~110-word example. Rewrote 11.15fc to 183 words, the in-page `<li>` to 89, and the README
bullet to match. `feedback_changelog_conventions` now carries a **target of roughly 150 words** and a
cut ORDER: the "why" first, then the mechanism, then any per-item list that restates the summary.

Measured the whole file while there: **79 entries, 18,459 words**, worst offenders 11.150b (1717) and
11.152f (1474). User asked for a pass over the recent ones, then interrupted and deferred it. Written
up as **P68** (a-c) at O2 with the measured table, and the one instruction that matters for it:
**do not cut the behavior-change warnings** - "does this release move my saved plan?" is the reader's
actual question, so those sentences are the part that earns its length.

**P67b, the relative view, built and shipped at v11.15fd** (`a98c94a`), nerdknob-gated.

The mechanism decision that made it small: a wrapper over `col.getSortValue` at the body-cell emit,
NOT 21 edited descriptors. `getSortValue` already bakes in the Future $ / Current $ toggle, so the
mode inherits it, and a column changing how it computes cannot leave the delta reading a stale field.

**Row order is provably identical in both modes** - sorting keeps using the absolutes, and a
difference from a common reference is monotonic in the absolute. Verified rather than asserted: the
first 25 rows come out in the same order either way.

Three judgement calls worth keeping:
- **Direction is per column, and `neutral` is a real option.** A negative on All Taxes is green, a
  negative on End Wealth is red. Final IRA and All RMDs colour NOTHING: a bigger Final IRA is worse
  for a widow and better for a spender, and the table should not pretend to know which one you are.
- **Conv Tax stays absolute**, pinned by a node test rather than by a comment. It is already a
  difference, measured inside one row's own conversion search rather than against another row.
- **A row with nothing to compare keeps its dash.** Turning "no value" into "+0" would read as a tie.

**Turning the nerdknob OFF also forces the mode off**, or a reader who enabled it once would be left
reading a table of differences with no visible way back.

**Known, recorded, not fixed:** under the two conversion goals the ⚓ baseline never converts, so it
has no break-even year and the ENTIRE Break Even column reads as dashes in relative view until a ⚖
row is pinned. Logically right, practically useless there. Flagged to the user.

Tests 287 -> 288 node, both pins reconciled from measured output, badge green at 658. PR #186 now
carries 12 commits. Still no screenshot - the Browser pane was never displayed this session.

## Session 2026-08-22 (continued) - five review rounds, v11.15fe through v11.1601

Rapid review cycles on the shipped Optimizer table. Everything below came from the user looking at
the real page; almost none of it was predicted.

**Two bugs that were MY regressions, both found by the user rather than by me.**
1. The 💵 legend entry vanished. My legend-merge script kept only spans opening `<span title=`, and
   that one opens `<span id=` because `optimizer_ui.js` toggles it by id. The symbol was on screen
   with its explanation deleted.
2. The Δ columns were still there in relative view. I had excluded them from the FILTERED set only,
   so switching "show all columns" on brought them straight back. I had also reported this as done.

**Two gaps found while verifying, not predicted:**
- Both PINNED rows are built by their own code paths calling `col.getValue` directly, so 📍 Your plan
  stayed absolute in relative view while every row beneath it was a difference, in the same columns.
- Chrome fires `toggle` when it PARSES `<details open>`, before init runs, so the fold preference was
  clobbered before it could be read.

**The coupling that caused two incidents is now gone.** Display order came from the order the
descriptors happened to be written in, while `OPT_COLUMN_KEYS` claimed to be the contract. That
caused (a) a Break Even reorder that changed nothing visible, and (b) a scripted block move that
relocated the Conv Tax descriptor into an unrelated Chart.js legend helper 1600 lines away. Order now
comes from `OPT_COLUMN_KEYS`; a descriptor missing from it logs the key instead of vanishing.

**A test found data drift I would not have.** Pinning End Wealth and All Taxes made them RENDER
everywhere via the pinned union, while the nine goal lists still did not name them. The assertion
failed on its first run. Without it the data and the display would have disagreed indefinitely, with
nothing visibly wrong.

**Two style rules earned memories**, both because the existing guidance was too vague to constrain
anything:
- **US spelling** ([[feedback_us_spelling]]). "colour" had reached a `<summary>` a reader sees. It
  lands in comments first, where it looks harmless, then gets copied into a visible string.
- **Do not argue for the change** (added to [[feedback_changelog_conventions]] as 3c). "and it used
  to print in the same black as a gain" is a pitch, not a fact. Cut "previously...", "it used to...".

**Also shipped:** switches instead of text links; percent deltas lost the "pp" suffix (user: "the pp
is the confuser"); the reference row moves to a converting row under the two conversion goals
(`OPT_BASELINE_REQUIRES`, with a node test asserting it covers exactly the goals ranking on a
conversion column); Conv Tax colored by sign with no `$`; the ⏹ stop-year mark explained; the
Version column dropped from the scenario list; `?tab=` added with friendly aliases.

**Answered:** there is no nerdknob control on the Optimizer tab. It is at the bottom of the
Documentation tab, unlabeled and faint, plus `?nerdknob`. It still gates the 💵 sweep arm, its legend
and the relative-view switch, so it is not vestigial.

**Still NOT verified live, and worth saying plainly:** the Roth Conversion Effectiveness half of the
baseline change. Neither the default scenario nor the user's own shared URL produced ⇌ rows, so only
the fallback path ran. Covered by a node test, not by a browser check. The user's URL also swept to
zero rows for me with no JS error, which is itself unexplained.

Final: **v11.1601**, 16 commits on PR #186, suites 289 / 61 / 22, tier-1 289/0, badge green at 661.
No screenshot at any point this session - the Browser pane was never displayed, so every visual claim
rests on DOM and computed-style assertions.

---

## Session 2026-08-23 — P23 shipped as three modes, v11.160F

Started as a planning session on three user questions; two were answered from the record, the third
became the work.

1. **Why arithmetic mean rather than geometric?** Never written down (progress.md said only "user
   confirmed"). Reconstructed: at mu 7% / sigma 15% the Synthetic tab prints 6.05% because `mu` is a
   log drift. **Correction to the original spec:** "mean === median" is true of the one-year return
   and false of cumulative growth, so AAM changes what the number MEANS, not how much money you end
   up with. The engine confirmed it later - 0.2pp of survival between the models.
2. **A realistic inflation model.** The planned AR(1) constants were guessed. Fitted against the
   CPI-U array already in `historical_returns.js`, three windows; shipped the 1948-2025 fit.
3. **Replay.** Scoped and deferred to a new phase, `P69`, per the user's own sequencing.

**The user changed the design mid-plan:** AAM is a THIRD mode beside GBM, not a replacement, so the
two can be compared. That produced the strongest guarantee in the change - inflation draws got their
own PRNG stream, so GBM's returns are **bit-identical** to the pre-P23 code whatever the inflation
knobs say, asserted by a node test against a verbatim copy of the old bank build.

Three claims made while planning were scored against the measurement; all three write-ups are in
`findings.md` under "P23m" and "P23q". Phase body archived in `.planning/task_completed.md`.

## Session 2026-08-23 (continued) — `/plan` re-entry, state resync, no code

Context restore only. The three planning files already existed under
`.planning/retirement-optimizer/` and `.planning/.active_plan` points at that directory, so nothing
was created. `session-catchup.py` reported no unsynced context.

What was stale, and is now corrected in `task_plan.md`:

| Claim in the header | Reality on disk |
|---|---|
| "P23 COMPLETE at v11.160F, **uncommitted**" | committed, and merged in PR #188 |
| latest version v11.160F | v11.161B — seven addenda landed after P23 proper |
| suites 299 / 61 / 22 | **300** / 61 / 22, and `TestTiers.EXPECTED` already pins 300 |

Measured, not assumed: all three node suites re-run green (300 / 61 / 22),
`TestTiers.EXPECTED` reads `{ optimizer_core: 300, taxPaymentPlanner: 61, doclinks: 22, slowInCore: 3 }`,
`<title>` reads `Retirement Optimizer 11.161B`, `git status` clean, HEAD `1e274f3` = the PR #188 merge.

The seven post-P23 addenda, from the commit trail: reset-to-defaults + Pessimistic preset and clearer
mode labels (v11.1615), Input Distributions un-gated and labeled with its run (v11.1616), fan caption
carrying every parameter (v11.1617), Experiment keeping the reader's synthetic mode (v11.1618), the
Fixed Inflation button plus a retracted changelog claim (v11.1619), the preset row moved out from
behind the nerdknob (v11.161A), and the "Model presets" -> "Mode presets" rename (v11.161B).

Nothing else changed. The open queue is untouched: **P35i** is the only O0; P71, P36, P30, P19, P69,
P70, P34 are the O1s, with P69 explicitly blocked behind P71.


---

## Session 2026-08-23 (continued) - P71a, the shared synthetic draw (v11.161C)

You picked P71a off the queue. It is the smallest step of the MC dedup: move the one formula that
three files each spell out for themselves into prng.js, and change nothing a reader can see.

**What moved.** prng.js gains `INFLATION_STREAM_XOR = 0x5F356495` (previously a bare literal in
worker.js, mc_controller.js and twice in optimizer_core.tests.js) and three functions:
`drawSyntheticBank(mode, mu, sigma, logDrift, z)`, `syntheticReturnFromBank(mode, banked)` and
`drawSyntheticReturn(...)`, the two composed. Both export tails carry all four names.

**Where the design changed.** P71's plan named one function, `drawSyntheticReturn()`. One is not
enough: the hot loop banks a value AND needs that year's return for the min/max scan, and under
'gbm' those are different numbers (bank = log-space shock, return = exp(shock) - 1). Deriving one
from the other inside a single call would have meant returning an object - 400,000 allocations on a
10,000-path 40-year run. Two functions plus a convenience wrapper costs nothing and reads the same.
`calibrateMCMs`, which wants only the return, uses the wrapper.

**The guard the plan named does not exist.** P71's "the invariant that makes it safe" section says
`MC_GOLDEN` in sweep_golden.js "pins full MC results". It does not: `MC_GOLDEN` records
`buildVariations()` row counts, labels and base-row strategy selections, which is the sweep
enumeration, and not one simulated return. Worse, **no node suite loads worker.js or
mc_controller.js at all** - worker.js opens with `importScripts`, mc_controller.js is a page script -
so the 300 green tests would have stayed green if this refactor had changed every number on screen.
The one draw-related pin, `_p23OldGbmShocks`, is reached through `_p23NewSynth`, a hand copy of the
new code rather than the code itself.

**So the evidence was built rather than borrowed.** `p71_probe/` (kept beside the plan, with a
README) holds two node harnesses that load the REAL worker.js and the REAL mc_controller.js into a
`vm` context under a minimal shim and hash a fixed-seed 25-path 30-year run in all three modes, every
number at `toPrecision(17)`. Staged HEAD copies of worker.js, prng.js and mc_controller.js, ran both
probes against both roots:

    gbm        6c27ec21931ed71ced3968bdd98e7c0a
    aam        755ab7df0e59624467971c857ec32714
    bootstrap  58fc7d5cd458bf26ae87fc4f7d1bbfac

Six hashes, all identical before and after. A side result worth having: the worker and the
controller print the SAME hashes as each other, so the two mirrors really are in sync today, which
is the premise P71b and P71c rest on.

**Browser.** Page loads at 11.161C with all four new globals present and the arithmetic right
(`aam` at z=1 gives exactly mu + sigma, `gbm` gives exp(logDrift + sigma) - 1). Ran the real Worker
from the page, 200 paths x 30 years, both synthetic modes: `gbm` median return 0.06051 = exp(0.05875)
- 1 as it should be, `aam` median exactly 0.07, and both modes report identical `inflationStats`,
which is the separate inflation stream doing its job. Tier-1 in-page tests 289/289. The tier-2
badge could not fetch the node suites, which this entry first blamed on the preview pane's sandbox.
**Wrong** - see the P71b entry: the preview server had wedged and was refusing new connections.
Restarted, the badge reads a full green 669 (289 in-page + 380 node).

**Version.** 11.161B -> **11.161C**. The clock-derived minor for this hour is 1619, which is BELOW
the 161B already shipped today, so the letter was stepped instead. Four sites: title, the tier-2
loader's `const V`, and the `?v=` tokens on prng.js and mc_controller.js. worker.js needs none (its
URL falls back to `Date.now()`). **No changelog entry** - P71 changes nothing a user can see, which
is what P71e's rule already says.

Suites 300 / 61 / 22, unmoved, so `TestTiers.EXPECTED` and `.githooks/README.md` needed no edit.
Uncommitted. Next: `P71b`, create mc_engine.js and reduce worker.js to a shell.


---

## Session 2026-08-23 (continued) - P71b, one engine instead of two mirrors (v11.161D)

`montecarlo/mc_engine.js` is new and holds the model. `montecarlo/worker.js` went from **455 lines
to 42**: importScripts, a throttled progress callback, onmessage. Nothing a user can see was meant
to change, and the probe says nothing did.

**The engine took the job level too, which the plan did not ask for.** P71b's brief was `runPass`,
`buildStressMsg` and the per-path bundle. But reading the two copies side by side, the duplication
did not stop at `runPass`: `mainMode`, the progress weights, the `stressOnly` early return and the
whole results-message shape were written out twice as well. Extracting only `runPass` would have
left the next model change a paired edit, which is the exact thing P71 exists to end. So the engine
exposes `runJob(cfg, hooks)` - seed the rng once, main pass, stress pass, message - and
`runPass`/`buildPathInputs`/`buildStressMsg` beside it for P69 and for the tests.

**Two deviations from the design, both forced by the code rather than chosen.**

1. `runPass` takes the rng as an ARGUMENT. The design's `runPass(cfg, mode, hooks)` would have had
   to seed its own, and both passes of a job draw from ONE stream - the stress pass continues where
   the main pass stopped. Re-seeding per pass would have changed every stress number.

2. The two copies had drifted more than the plan recorded. A comment-stripped diff of the two
   `runPass` bodies found the controller carrying **per-path progress** (every 16 paths, so a
   one-variation run has a moving bar) and **cancellation** that the worker never had. A merged
   engine has to pick one, and picking the weaker one would be a deliberate regression, so the
   engine reports progress inside a variation for both callers. That is 90,000 `postMessage` calls
   on a 10,000-path 144-variation run, so the shell throttles to one per 60ms. First browser run
   left the bar at 95%: the terminal update had been swallowed by the throttle. The final update is
   now exempt, and the bar reaches 1.

**Evidence.** The `p71_probe/` harnesses needed one fix first - the worker's `onmessage` is async
now, so the probe polls for the result message instead of reading it straight after the call.
Re-baselined the fixed probe against the staged HEAD copy (same three hashes as P71a, so the fix
changed nothing), then ran it against the working tree:

    gbm        6c27ec21931ed71ced3968bdd98e7c0a
    aam        755ab7df0e59624467971c857ec32714
    bootstrap  58fc7d5cd458bf26ae87fc4f7d1bbfac

Identical. Node suites 300 / 61 / 22.

**Browser.** Real Worker, 200 paths x 30 years, all three modes: `gbm` median 0.06051008007643799,
`aam` exactly 0.07, `bootstrap` min -0.4384 / max 0.5256 - digit-for-digit what the P71a build
produced, with the stress pass returning its two variations in each. Progress arrives 9-11 times per
run and ends at exactly 1.

**A correction to the P71a entry.** That entry said the tier-2 badge could not fetch the node suites
because the preview pane's sandbox blocks `fetch`. It does not. The preview server (a leftover from
a `--help` invocation that started a real server) had wedged and was refusing new connections, which
is also why the pane could not navigate at all this session until it was killed. On a fresh server
the badge reads **green at 669 - 289 in-page + 380 node**, with the 3 slow tests skipped and the 12
critical regression guards passing.

**Version** 11.161C -> **11.161D**, title only. mc_engine.js is not on the page yet - the controller
still runs its own copy until `P71c` - so no `?v=` token moved and the tier-2 loader's `V` is
unchanged. No changelog entry, per P71e.

Uncommitted. Next: `P71c`, delete the controller's ~250-line mirror and delegate to `runJob` with
its yield/cancel hooks; that is also where mc_engine.js first gets a `<script>` tag and the file://
fallback needs a manual pass.


---

## Session 2026-08-23 (continued) - P71c, the second mirror deleted (v11.161E)

mc_controller.js **567 -> 203 lines**. `_runMCMainThread` is thirty lines that build three hooks and
await `runJob`; `_buildStressMsg` went with the mirror it belonged to. Counting P71b, the two
hand-kept copies that were 455 + 567 lines are now 42 + 203 around one 522-line engine.

The hooks are the whole difference between the two callers: `onProgress` forwards to the caller's
callback, `shouldCancel` reads `_mcCancelled`, and `yieldIfDue` keeps the 16ms frame budget the
comment has always described. The worker passes none of them and gets no-ops.

`recordMCTiming` stays on this side - it is a main-thread estimator and the worker has its own wall
clock - and it is still skipped for a stress-only refresh, which would teach the estimator a per-sim
cost no full run matches.

**Page wiring.** mc_engine.js now has a `<script>` tag ahead of mc_controller.js, so the file://
fallback and the worker literally run the same text. Tokens: mc_engine.js and mc_controller.js at
`?v=11161e`; prng.js unchanged at `11161c`; the tier-2 loader's `V` unchanged, no test file moved.

**Evidence.** `probe_controller.js` needed one change - it now skips mc_engine.js when the root does
not have one, so the staged pre-P71 copy still loads - and then both probes matched the HEAD
baseline exactly, all three modes:

    gbm        6c27ec21931ed71ced3968bdd98e7c0a
    aam        755ab7df0e59624467971c857ec32714
    bootstrap  58fc7d5cd458bf26ae87fc4f7d1bbfac

Node suites 300 / 61 / 22. Badge green at 669.

**Browser.** Worker path, gbm, 200 paths: median 0.06051008007643799, stress pass present - the same
digits as P71a and P71b. Main-thread path, same config: identical median, 34 progress updates,
last pct exactly 1.

**The file:// pass, and what it did not cover.** The preview pane renders a `file://` URL as a static
snapshot and will not run scripts in it, so the branch was exercised the other way: `_runMCFallback()`
called directly over http, which is precisely what `location.protocol === 'file:'` calls. Bootstrap,
50 paths, one variation: 60ms, survival 0.82, stress pass present, no error. What remains untested is
the one-line protocol check itself.

**Cancel, re-verified because the mechanism moved.** Cancellation used to be a `return null` inside
the controller's own loop; it is now a hook the engine calls. Started a 6-variation 400-path run,
called `cancelMCWorker()` after 300ms: 32 progress updates, then onComplete never fired and no error
was reported - the contract that leaves the previous results on screen.

**One measurement worth not misreading.** A main-thread run of 200 paths x 2 variations took 21
seconds in the pane and 60ms in a foreground tab. That is `setTimeout` clamped to ~1s in a hidden
tab, not the refactor: the yield points and their 16ms budget are unchanged from before P71.

**Version** 11.161D -> **11.161E**. Title, plus the two `?v=` tokens. No changelog entry, per P71e.

Uncommitted. Next: `P71d`, `require('./montecarlo/mc_engine.js')` in optimizer_core.tests.js and run
all three modes end to end at ~20 paths, replacing `_p23NewSynth` with calls to the real engine
(`_p23OldGbmShocks` stays a verbatim copy - being a copy of the OLD code is its whole point). That
one moves the test count, so `TestTiers.EXPECTED` and `.githooks/README.md` move with it.


---

## Session 2026-08-23 (continued) - P71d, the suite finally executes the engine (v11.161F)

Until now no suite ran the Monte Carlo. That is the finding P71a turned up and this item closes:
four new tests drive `mc_engine.js` directly, and the hand copy that stood in for it is gone.

**What the four cover.** A whole job end to end in all three modes (20 paths, 1 variation, 25 years)
asserting shape and coherence, not a golden number: mode echoed back, path count, one variation
returned, 25 percentile years, survival in [0,1], a finite inflation CAGR, an input fan, and a stress
pass carrying the same single variation. Then CRN determinism - the same seed twice must agree
exactly AND a different seed must not, or the first half proves nothing. Then stress banking one path
per selected scenario. Then a cancelled job resolving to `null`, which is the contract that leaves
the previous results on screen.

**`_p23NewSynth` is a six-line adapter now.** It used to reimplement the bank-build loop, so every
P23 assertion was testing a copy of the code rather than the code. It calls `buildBanks()` and hands
back `{bank, inf}`. All ten P23 tests passed unchanged on the first run against the real engine,
which is the best evidence available that the copy had not drifted.

**Three things the plan did not anticipate.**

1. **`buildBanks(cfg, rng, mode)` had to come out of `runPass` first.** Two P23 tests draw a 40,000
   long series; routing that through `runPass` would have run `simulate()` over 40,000 years to get
   at a bank. The bank build is a better seam anyway - it is where every draw happens, and where a
   test asserting something about the draw should be pointed. Both probes stayed byte-identical
   across the extraction.

2. **The test runner is async now.** `runJob` is a promise by construction. The old runner called
   `fn()` and ignored what came back, so an async body would have reported PASS without ever
   asserting, and a failure would have surfaced as an unhandled rejection. `runOptimizerCoreTests`
   is `async`, the loop `await`s each body, and both call sites await it: the node entry point (which
   now exports before running, since the run yields to the event loop) and the page's tier-2 loader.

3. **`montecarlo/stats.js` had no export tail.** It was a plain script for the worker and the page.
   Node needs `computePercentiles` and `computeInputFan` on globalThis before mc_engine.js can be
   required, so it got the same three-host tail prng.js and mc_engine.js already carry. While there,
   corrected a comment that had gone stale at P23: it still said GBM uses fixed inflation and passes
   a null inflation bank.

**The badge did its job.** First browser check went RED: "optimizer_core: 304 tests on disk, 300
expected". `optimizer_tests.js`, which holds `TestTiers.EXPECTED`, was still being served from cache
on its old `?v=11160f` token. That is the fourth version-bump site the repo's own CLAUDE.md warns
about, missed on the first pass and caught in the one place designed to catch it - red, not
green-with-a-warning. Token bumped, badge green at **673 (289 in-page + 384 node)**, which confirms
the four new tests run in the browser tier too.

**Counts.** optimizer_core **300 -> 304**; taxPaymentPlanner 61 and doclinks 22 unchanged;
`slowInCore` still 3. Both homes updated in this pass: `TestTiers.EXPECTED` and the table in
`.githooks/README.md`.

**Version** 11.161E -> **11.161F**. Title, the tier-2 loader's `V`, and tokens on optimizer_tests.js,
stats.js and mc_engine.js.

**P71e is finished too**, without its own release: every wiring item it listed moved with whichever
of a-d needed it. What is left of P71 is a review pass and a commit - five uncommitted versions,
v11.161C through v11.161F, touching prng.js, worker.js, mc_controller.js, mc_engine.js, stats.js,
optimizer_core.tests.js, optimizer_tests.js, .githooks/README.md and the page.


---

## Session 2026-08-23 (continued) - P71 committed, then three Annual Details columns (v11.161G)

**P71 is committed** as `b7f8808`, five versions squashed into one commit with the reasoning in the
message: the two mirrors, what the engine now owns, the deviations, and the probe evidence. The
pre-commit hook ran all three suites green before it landed.

**Then the user asked for plumbing:** annual inflation, cumulative inflation and market return in
Annual Details, hidden behind Show All for now.

Three columns, at the far right of the table: `infl%` (the inflation applied to the spending goal
that year), `inflCum%` (how far the price level has risen since the plan started) and `return%` (the
year's market return before dividends and before each account's own mix). The engine already had
both numbers - `yr.yearInflation` and `yr.baseReturn` - and neither reached the log; `inflationFactor`
was in the log but in no category, so it could never appear.

Two decisions worth recording. Cumulative inflation is reported as the PERCENT risen rather than the
raw multiplier, so it formats like every other `%` column instead of rounding to "1"; the multiplier
stays available as `inflationFactor`. And the category is a new `Market` with **no checkbox**, the
same trick `loopMs`/`Debug` already uses, which is exactly "behind Show All" without inventing a
control for three columns that say nothing in a deterministic run.

**A break I caused and the page caught.** The `inflCum%` hover-over text contained an apostrophe in
"today's money" inside a single-quoted string, which broke `optimizer_ui.js` at parse time - so
`runSimulation`, `showTab` and everything else in that file went undefined and the page was inert.
All three node suites stayed green throughout: none of them loads optimizer_ui.js. What caught it was
opening the page. Reworded to avoid the apostrophe, and while fixing it the text now names the real
control (the **Future $ / Current $** switch above the tabs) instead of a "Current dollars" checkbox
that does not exist under that name.

**Tests.** One new test: the three columns must echo the sequences a Monte Carlo path actually ran
on, year by year, with `inflCum%` compounding and agreeing with `inflationFactor` - and a
deterministic run must fall back to the typed Growth and Inflation rather than to blanks. Suite
**304 -> 305**, reconciled in `TestTiers.EXPECTED` and `.githooks/README.md`.

**Browser.** Columns present, hidden by default, revealed by Show All, grouped under a new **Market**
header. Values check out: 3.00 / 6.00 flat on a deterministic run, and `inflCum%` reads 0.00, 12.55,
75.35 at years 1, 5 and 20, which is 1.03^0, ^4 and ^19. Badge green at **674**.

**Version** 11.161F -> **11.161G**; tokens on optimizer_core.js, optimizer_ui.js, optimizer_tests.js
and the tier-2 loader. This one IS user-visible, so it gets a changelog entry in both homes: the
in-page list and `optimizer_changelog.md`.


---

## Session 2026-08-24 - the two map files P71 forgot

User asked whether `ARCHITECTURE.md` and `.planning/FILE_DIRECTORY.md` were missing changes. They
were. P71 renamed the shape of the whole Monte Carlo layer across four commits and neither map moved,
so both described a `worker.js` that owns `runPass` and a `mc_controller.js` that keeps a copy of it -
the exact arrangement the phase existed to end. Nothing automated would have caught this: the suites
do not read either file, and the doclinks suite only checks that links resolve.

`ARCHITECTURE.md`: `mc_engine.js` added to the module diagram with its real edges (the page loads it,
the worker `importScripts` it, the controller falls back to it), the worker and controller relabeled
as shells, and the Monte Carlo flowchart corrected on three counts - it now routes both protocols
through `runJob`, names all three simulation modes instead of "Synthetic", and shows the stress pass
running in EVERY mode rather than only Historical, which has been true since v11.152d and was never
drawn. Three paragraphs added after the flow: one engine with two shells, why a Monte Carlo refactor
needs the `p71_probe/` harnesses rather than the suites, and the CRN discipline in one place
(separate inflation stream, correlated shock, and why Fixed Inflation still makes the draw it
multiplies by zero). File-reference table updated for all five montecarlo files.

`FILE_DIRECTORY.md`: `mc_engine.js` row added, `worker.js` demoted to "shell around mc_engine.js",
`mc_controller.js` and `prng.js` and `stats.js` rows corrected, and `p71_probe/` documented in the
planning section.

Docs only - no page asset changed, so no version bump and no changelog entry. Suites 305 / 61 / 22.

## Session 2026-08-24 (continued) - README staleness, and the harness catalog gets its own name

Three items, all from the user noticing that "README.md" is two different files.

**A correction first.** I said the root README had "no montecarlo references at all". That was a
claim about source-FILE references (it names only `taxengine.js` and `chart.js`) stated as though it
were a claim about content - the README discusses Monte Carlo at length. Checked properly, it was
stale in three places, all from P23:

- "Model variable inflation in the synthetic Monte Carlo" was still under **Features in the Works**,
  three weeks after it shipped in v11.161B. Moved to Recent Fixes and written out properly: what
  varying inflation buys, what Synthetic - AAM is for, that GBM's market draws are unchanged, and
  that Fixed Inflation reproduces the old model.
- "The other model, Synthetic, is Log-Normal, Geometric Brownian Motion" - there are two synthetic
  models now. Rewritten to name both and say what the growth rate means in each.
- The Account Composition paragraph named "Synthetic (Log-Normal / GBM)" as the mode that ignores
  the per-account mix. Still true, but it now names both synthetic modes.

**`research/README.md` -> `HARNESSES.md`.** It is a catalog of eleven investigative scripts,
not an introduction, and the name collided with the repo's real README in search and in conversation.
Renamed with `git mv`, a line at the top records the old name, and every live inbound reference moved
with it: `ARCHITECTURE.md`, `FILE_DIRECTORY.md`, and five references in `task_plan.md`. Two of those
carried line numbers (`:79-81`, `:7-10`) that the rename invalidated; rather than re-derive numbers
that will rot again, they now cite the file and the section heading.

**Left deliberately stale:** the two references in this file's own older entries. progress.md is a
chronological record and those entries were true when written; rewriting them would be falsifying the
log to tidy a path.

**Also found:** `ordered_fill_harness.js` had no row in the catalog table. Added one, from the
harness's own header: it proves the Ordered strategy restarts its account sequence every year and
shows where the year's leftover surplus is banked.

Docs only. Suites 305 / 61 / 22, no version bump, no changelog entry.

## Session 2026-08-24 (continued) - the README paragraph the first sweep missed

User quoted a line from the "Stress Test vs Monte Carlo Analysis" section that still said Synthetic
"currently does not vary inflation". I had not corrected it, and my "three places" report from an
hour earlier was therefore wrong - there were four, and the fourth was the one a reader is most
likely to hit, because it sits in the section that explains the difference between the modes.

**Why the sweep missed it.** I grepped for `Monte Carlo|montecarlo`. The sentence contains neither -
it opens "Synthetic uses randomized market variations". A grep for the feature name cannot find text
that describes the feature without naming it, which is most prose. Grepping for `Synthetic` (the
thing that changed) instead of `Monte Carlo` (the tab it lives in) returns all four hits plus two
more paragraphs worth checking.

Fixed: that paragraph now says synthetic randomizes inflation as well as returns, describes the
calibration and the clustering in the author's register rather than the changelog's, and a new
paragraph after it explains the GBM/AAM split as a difference in what the growth rate you type
*means* - with the concrete 7% -> 6.05% median - and notes that neither is the more optimistic of the
two. The "TWO Monte Carlo regimens" sentence above it now says synthetic has two flavors.

**Left alone, deliberately.** The competitor section (~line 1004) criticizes GBM as a "drunk man's
walk" that lacks the persistence real markets show. That critique still stands against this tool's
own synthetic RETURNS: P23 gave inflation an AR(1) persistence model, not returns. The paragraph is
the author's argument and remains factually correct, so it is his call whether to note the asymmetry;
flagged to him rather than edited. Also related: P14 (regime-switching MC) is the open phase that
would answer it.

Docs only. Suites 305 / 61 / 22.

## Session 2026-08-24 (continued) - loopMs was empty because the table was off by one column (v11.1628)

User: "why is loopMs always empty? (It's been that way for a while)". It is a real defect, and not
in loopMs.

**What was wrong.** `updateTable()` builds the heading row and the body rows from the same key list
but applied DIFFERENT filters to it. Header: `if (!key.startsWith('-'))`. Body:
`if (!key.startsWith('-') && key !== 'inflationFactor')`. So the body emitted one cell fewer than
there were headings, and from `inflationFactor` rightward every value sat under the heading to its
left. `loopMs` is the last key in the log record, so it got no cell at all - a heading with nothing
under it, in every row, forever.

Measured before the fix: 81 headings, 80 cells per row.

**Why nobody caught it.** Both affected columns are internal and hidden by default -
`inflationFactor` is in no category at all, `loopMs` is category `Debug`, so you only see either
under **Show All**. And the one visibly wrong cell was as good as invisible: under the
`inflationFactor` heading, whose expected value in year 1 is 1.0, sat the loopMs timing for that
year, which also rounds to 1. It dates to at least the P15 file split (`eadb1cc`, 2026-07-10) and
was carried in from the monolith before that.

**Fix.** One predicate, `isTableColumnKey(key)`, used by the header loop, the body loop and
`analyzeColumnContent`. The comment above it says what each exclusion means and why the two must
never diverge again. After: 80 headings, 80 cells, `inflationFactor` no longer emitted as a heading
at all (its reader-facing form is the new `inflCum%` column).

**And loopMs still was not useful.** With cells rendering it read `0` in every row, because a
simulated year costs ~0.2ms and the table rounds non-percent columns to whole numbers. It now prints
two decimals: 0.30, 0.20, 0.00, 0.10 on the default plan.

**Regression guard, and the mistake I nearly shipped in it.** The first version of the in-page test
read `#main-table` and returned early when it was absent - which is ALWAYS, because `runTests()` runs
before the page's first `runSimulation()`. It passed by never running: in-page count stayed at 289.
The test now renders its own table from `simulate(getInputs()).log` and counts cells per row against
headings; `runSimulation()` rebuilds the table moments later, so nothing is left behind. In-page 289
-> 290, and I verified it discriminates by deleting one cell in the live DOM and re-running the
comparison (0 misaligned rows -> 1).

Suites 305 / 61 / 22 unchanged (node), in-page 290, badge green at 675. Version 11.161G -> 11.1628,
changelog entry in both homes.

## Session 2026-08-24 (continued) - Mode presets became stateful, and a load-order bug fell out (v11.162A)

User: a reader cannot tell which regime they are in without opening Input Distributions, and even
then it is numbers they have no way to read. Make the buttons stateful; rename "Reset to defaults"
to "Default" and light it too; clear everything when a knob moves away.

**Built as derived state, not a clicked flag.** `updateMCPresetState()` asks the parameter boxes what
they hold and lights the buttons from that. A click flag would go wrong in both directions: still lit
after the reader edits a box, and dark for a reader who typed the preset's values by hand. Three
predicates, each stating what the preset actually means:

- Default: every `MC_PARAMS` entry at its default, with mu tested against Growth % rather than
  against a number, because mu's default is the behavior "track Growth" that `resetMCParams()` leaves
  in place.
- Fixed Inflation: `mc-inflation-shock-sd === 0`, and nothing else. A zero shock leaves the AR(1)
  middle term with nothing to act on, so this is true whatever persistence and correlation say - it
  can coexist with a reader's own settings, which is why it is tested alone.
- Pessimistic: the four fixed values plus mu two points under Growth. Paths, seed and stress count
  are deliberately excluded, for the reason that button's own comment gives.

Lit via `aria-pressed` with the styling keyed off that attribute, so what is announced and what is
painted cannot disagree. In Historical mode Fixed Inflation and Pessimistic are DISABLED rather than
merely dark: that mode samples real inflation and has no synthetic model to tune, so those buttons
were clickable and inert there. Not asked for; the alternative was lighting a button for a regime the
run is not in.

**Two bugs found by watching the test count.**

1. First load painted Default as false on a page that WAS at its defaults. `initMCTab()` paints
   before `syncMCMuFromGrowth()` runs, so mu still held the MC_PARAMS number rather than Growth.
   `syncMCMuFromGrowth()` now repaints.

2. The six new in-page assertions did not run at all: in-page stayed at 290 when it should have been
   296. The guard `typeof updateMCPresetState !== 'function'` was returning early - because
   **the montecarlo scripts loaded AFTER the page's bootstrap block**. Which meant the load order had
   a live bug of its own: with `?tab=montecarlo` in the URL, `applyTabFromUrl()` reached
   `mcTabActivated?.()` while that name did not yet exist, and an optional call does not protect an
   undeclared identifier - ReferenceError, which aborted the rest of the block, which is where the
   deferred test tier registers. On that one URL the self-check badge sat on its neutral hourglass
   forever. Confirmed in the console before the fix, gone after.

   The six montecarlo `<script>` tags now load above the bootstrap block. Nothing in them has a
   load-time side effect. `?tab=montecarlo`, `?montecarlo` (the demo) and a plain load were all
   checked afterwards.

**Verified in the browser**, per state, not by clicking through and trusting it: fresh load in
Historical shows Default green with the other two greyed; switching to GBM enables them; Fixed
Inflation lights only Fixed; Pessimistic lights only Pessimistic; editing persistence clears all
three; Default lights again after reset. Computed style on the lit button is rgb(47,158,68) on white
text.

In-page 290 -> 296, node suites unchanged at 305 / 61 / 22, badge green at 681. Version 11.1628 ->
11.162A; tokens on the CSS (new `.mc-preset` rules), mc_tab.js and optimizer_tests.js. Changelog in
both homes.

## Session 2026-08-24 (continued) - four changelog entries collapse into one (v11.1629)

User: the ordering buries what matters. The end reader cares about the arithmetic model and about
inflation varying; the preset-button work is part of the SAME change and never shipped separately;
and giving a never-merged internal fix its own release entry is a mistake.

**11.161B, 11.161G, 11.1628 and 11.162A are now one entry, 11.1629**, in both homes. None of the
four was ever merged to main - they were four commits on one branch, and numbering them separately
described the development, not the release. The rule this leaves behind: a changelog entry belongs to
a RELEASE, and a branch that ships once gets one entry however many versions it passed through on the
way.

The detailed entry is the three points the user named, in that order, and nothing else: there is an
arithmetic model; both synthetic models vary inflation; the Mode presets set how much it moves and
show which setting is in force. The behavior-change warning stays, because a Synthetic plan really
will not reproduce an older recorded result until Fixed Inflation is clicked.

**Cut deliberately:** the AR(1) persistence / shock / correlation knobs (nothing in the UI varies them
today - the planned work that will use them can introduce them), the Input Distributions caption
inventory, and the whole column-alignment write-up. loopMs is one line, in the user's own words: the
time spent calculating each year of data was rendering incorrectly and has been fixed.

Version 11.162A -> 11.1629, title and the single entry. No `?v=` token moved: nothing but the HTML
and the changelog file changed. Badge green at 681, in-page 296.

---

## Session: 2026-08-24 (worktree context-ab498f) — P72 filed, first-year stub. No code.

User asked a direct question: with $1M in Cash today, late August, does the Optimizer accrue
September-December in year 1, or a full year?

**Answer, verified in the engine: a full year.** `applyGrowth` (optimizer_core.js:626) is
proportional and already takes a month count, but `preMonths = early ? 1 : 11;
postMonths = 12 - preMonths` (optimizer_core.js:1168) **always sums to 12**, in year 0 as in every
other year. The 1/11 split positions the withdrawal before or after growth inside the year; it is
not a calendar offset. No month input exists anywhere in the model, and `startInYear`
(optimizer_ui.js:558) is derived from `startAge` and clamped to `>= this calendar year`. The only
calendar-partial thing modeled today is Social Security claim-year proration by birth month,
`ssFirstYearFraction` (optimizer_core.js:693).

The overstatement is roughly `(1 - monthsRemaining/12) x rate x balance` and it compounds forward
over the whole run, so it biases every metric that depends on terminal wealth.

**Filed as P72, O2, full build spec** (user chose the build spec over a measure-first item). Two
decisions came out of the conversation and are what the spec hangs on:

1. **Auto-detect the month, but only in the UI layer.** The user does not want to hand-enter
   January-1 balances, because the change since January mixes growth, taxable events, withdrawals
   and deposits. So the page auto-detects when `startInYear` is the current calendar year, and
   assumes January for a future retirement with the month overridable. The engine never reads
   `new Date()`: it takes `startMonth`, defaulting to 1, which is bit-identical to today and leaves
   every golden fixture and node test untouched. The resolved month is pinned into the URL on
   save/share so a link still reproduces months later.
2. **The wage caveat is a first-class item, not a footnote.** A stub year exists because the user is
   mid-year, and that year almost always carries January-August earned income and withheld tax that
   the model knows nothing about. Prorating income without it would invent Roth conversion room that
   does not exist - the one number people act on. P72g adds income-already-received and
   tax-already-withheld inputs for exactly that reason.

The spec also fixes what does NOT prorate: RMD (the whole year's is due however late you start),
the standard deduction, brackets and the ACA FPL (annual by statute), and, recommended, property tax
(an annual bill that feeds SALT). `endYear` must advance inflation by the stub fraction too, or year
2's dollars sit a full year ahead of a four-month year 1.

Files touched: `task_plan.md` (new P72 section after P71, one O2 index row) and this log. No product
code, no version bump, no changelog entry.

---

## Session 2026-08-24/25 (worktree readme-review-updates) - P28 shipped, then all of P30 (v11.162B -> v11.163F)

One branch, one changelog entry, six commits. In order: P28's `rothGapFill` shipped as a switch and
as the circled-R clone pass; `unifiedConvRouting` deleted as provably inert; the Optimizer's Reduce
and IRA Draw grids cut to five steps each with per-strategy run counts added behind the nerdknob;
then P30a-g.

**What the research found, and it is not one answer.** `fillSpendingGap` has three branches and they
disagree. The default branch's `[40,60]` is wrong - `w=0` wins 65 of 82 clean cells, 40 wins none.
The bracket branch's Cash-first is right - swapping it loses 21 of 23. And under Ordered the story
collapses: "Cash before Brokerage" is exactly 30/60, a coin flip, because a four-account sequence
also places the IRA and Roth and that swamps the pair. Full tables in `GAPFILL_SPLIT.md`.

**P30g shipped the menu, not the constants.** Two of the three Ordered codes on offer (RIBC, BIRC)
win nothing in 60 cells, and the most-often-best sequence, CBRI, was not offered at all. The list is
now six - CBRI, CBIR, CIBR, BCIR, RIBC, BIRC - ordered by wins with ties broken on dollars at stake,
and it is ONE constant (`ORDERED_SEQS`) shared by the dropdown and both sweep grids, so a sequence a
user can pick is always one the sweeps score. The `[40,60]` default was deliberately left alone: the
win is measured on `baselineScoreOf` only, and "always drain Cash first" has a liquidity cost the
harness cannot see. That reasoning is written into P30g so it is not re-derived.

**Corrections worth keeping.** P28's 2026-07-30 evidence no longer reproduces on the current engine
and its mechanism has inverted; the ladder was re-baselined (`CONVERSION_ROUTING.md` section 15) before P30
reused it. `resolveOrderedSeq` was silently resolving all 21 unshipped permutations to CBIR - they
named one sequence and ran another - which is why P30d had to generalize it before it could measure
anything. And one prediction was scored VACUOUS rather than quietly dropped: no cell in the grid
could make it fire.

Suites 314 / 61 / 22, badge green at 690. Both goldens regenerated: MC in node, OPT re-captured in
the browser (four scenarios), and the diff read row by row rather than accepted.

---

## Session 2026-08-25 (worktree readme-review-updates) - P73, the Strategy column sorts on data now (v11.1640)

User's call on the open design question: **family, then parameter**. So `strategySortKey()` in
`optimizer_core.js` - pure, exported, node-tested - builds a fixed-width key from `_family`,
`_paramSortVal`, the modifier and the variant, and the Strategy column returns that instead of the
rendered label.

Two things this had to get right beyond the ordering itself. The rows had to carry the family and
modifier the ENUMERATION assigned, not ones parsed back off a label that starts with raw HTML for
the cyclic IRA-first arm - so `addResult` records `_family`/`_modifier` and the derived rows copy
them. And the comparator had to stop using `localeCompare` for this column: locale collation treats
the key's padding and field tags as ignorable at primary strength, which would silently reorder the
key's own fields. The column declares `rawSort: true` and the comparator compares by code point.

`P73b` dissolved rather than got decided. It asked whether the pinned rows should keep sorting to
the top; they never sorted at all - `display` filters both out before the comparator runs, because
each is already rendered sticky above the table.

Browser-verified both directions: one contiguous run per family (Fill Bracket, Guyton-Klinger, IRA
Draw, IRMAA Ceil, Ordered, Proportional, Reduce), each parameter's arms clustered as plain, no-conv,
then clones, and descending an exact mirror. Suite 315/61/22, badge green at 691. No changelog entry,
by the user's call. The same commit trims the release entry's Ordered item to name only the three
NEW sequences.

---

## Session 2026-08-25 (worktree readme-review-updates) - P74, Monte Carlo pinned the wrong strategy (v11.1642)

User: run Compare with Ordered CIBR selected, and the chart emphasizes CBRI.

The transport was the defect. `mc_engine.js` posts a summary of each variation back to the page with
a hand-written list of strategy fields, and that list was missing the five that identify the
remaining families - orderedSeq, the IRMAA tier, the ACA multiple, and the two GK guardrails. Both
sides were individually correct: sameStrategySelection() reads all of them, and the page passes the
real sidebar plan. But with a field absent on one side the comparison fell through to `?? default`,
so every Ordered row compared equal to CBIR and every IRMAA, ACA and GK plan matched nothing.
Pre-existing on main - the six-sequence menu only made it visible by putting CBRI first in the grid.

Fixed as one list rather than a longer hand-written one: `selectionOf()` in optimizer_core.js, which
mc_engine spreads. `loadMCVariation()` had the mirror-image gap and now restores the sequence, tier,
cliff, guardrails and Roth position - clicking a row used to run whatever the sidebar already held.

Second half of the request - Monte Carlo should always run YOUR plan - is `withCurrentPlan()`:
Compare appends the sidebar plan when no swept row matches. That is not only a matching problem, it
is coverage: MC sweeps no IRMAA ceiling and no ACA cliff at all, so those plans could not be in the
run however the matching behaved. Verified in the browser: Ordered CIBR pins and draws as itself,
and an IRMAA Tier 2 plan appears as row 157 of 157, pinned and drawn.

Two node tests, one of which fails on the pre-fix engine and names the wrong row. Suite 317/61/22,
badge green at 693. One self-inflicted detour: the changelog `<li>` I wrote used `<b>` for emphasis,
and an in-page test counts `<b>` tags to detect a swallowed entry - it caught it, which is the test
doing its job.


---

## Session 2026-08-25 (worktree mc-path-replay) - P69 planning, no code yet

Fresh worktree `mc-path-replay` off `f29b40a`, which is `origin/main` exactly. Target chosen by the
user: **P69**, replay one Monte Carlo or Stress sequence through the main model.

Re-anchored the approved design (`~/.claude/plans/cryptic-wondering-wren.md`) on the code as it
stands after P71 and P74, because both moved every line that plan cites. Three things the read
settled before any code:

- **P69a is already done.** P71 extracted the per-path bundle as `buildPathInputs()` in
  `montecarlo/mc_engine.js:44`, exported at `:538`, and there is no inline block left in
  `worker.js` to extract - the worker is 42 lines. Marked complete, next item is `P69b`.
- **`ruinYears` already survives for stress** as `ruinYearsPerPath` (`mc_engine.js:395`, kept by
  P53). The main pass still collapses it to `medianRuinYear`. So P69b is a smaller change than the
  plan assumed: keep the array, add the ranking metric, add the selector.
- **`runSimulation()` has no injection point** (`optimizer_ui.js:680`) - it builds its inputs from
  `getInputs()` and takes no argument. Replay needs exactly one, not a parallel copy of the
  updateTable/updateStats/updateCharts pipeline. That is the P69d design constraint.

Ranking metric settled as `afterTaxWealthOfLogRow` of the last log row - the basis Break Even and
the stop-year search already score on - with ruined paths below every survivor, earliest ruin worst.
One total order, so a rank percentile is unambiguous.

Open for the user: how many paths to capture and at which ranks. Straw man is worst 5 plus ranks
5/25/50/75/95.

---

## Session 2026-08-25 (worktree mc-path-replay) - P69b, the capture selector (v11.1643)

User decisions first: capture worst 5 plus ranks 5/25/50/75/95 (10 rows, deduped, worst-first), and
the replay control lands on the stress table and the main survival table in the same pass.

`selectCapturePaths()` in `mc_engine.js`, pure and exported, with the count and ranks as the two
named constants beside it. Total order: ruined below all survivors, earliest ruin worst, survivors
by ascending after-tax terminal wealth (`afterTaxWealthOfLogRow` of the last log row - the Break
Even basis), path index as the deterministic tie-break. `runPass` computes `metricPerPath` off the
row it already holds - one function call per path, no second simulate - and every varResult in both
passes now ships `captured` rows (metadata only, ~10 small objects; sequences are P69c's transport
problem). `buildStressMsg` passes varResults through whole, so stress rows got it for free.

Engine gained a dependency: `afterTaxWealthOfLogRow` from optimizer_core, hoisted onto globalThis
in the node test shim beside simulate/selectionOf, already global in page and worker scopes.

Three node tests: hand-built 10-path array where the right order is checkable by eye (ruin-year
ordering, dedup to 8 rows, rankPct 0..100 honest), a 100-survivor run plus a 3-path dedup edge, and
an e2e runJob asserting every variation of both passes carries in-range capture rows whose worst
row agrees with survivalRate. Suites 320/61/22, badge green at 696. No changelog entry - nothing
user-visible until the replay UI; title bumped to 11.1643, first `<li>` stays 11.1642 deliberately
(that entry belongs to a merged branch; this branch writes its own entry when the UI ships).

---

## Session 2026-08-25 (worktree mc-path-replay) - P69c, replay transport (v11.1644)

Two helpers in mc_engine.js, deliberately symmetric: `sliceBankRowsForPath()` pulls one path's
draws out of the banks as plain arrays (~2KB - scenario row plus the four asset rows for
bootstrap/stress, scenario plus synthInflation for the synthetic modes), and
`pathInputsFromBankRows()` wraps them as a single-path bank and calls the same `buildPathInputs`
the run itself used. No second copy of the blending code, so replayed inputs cannot drift.

Scope decision worth recording: the main pass ships rows for the captured paths of ONE variation,
the sidebar's own plan, not the union across variations. A Compare run has ~150 variations whose
capture sets need not overlap; the union is unbounded in the wrong direction, and replay always
runs the user's plan anyway (P69d injects sequences, never mutates inputs). The page names that
variation via `cfg.captureVariationIndex`, computed in `runMonteCarlo()` with
`findCurrentStrategyIdx` - `withCurrentPlan()` (P74) guarantees the match exists. The stress pass
ships `pathBankRows` for every path, index-aligned with the labels/startYears already in the
message, so any stress row can be replayed and still name its decade.

The test that matters: rebuild a captured path's inputs from the shipped rows, run simulate(), and
the after-tax terminal wealth equals the captured metric EXACTLY - the shipped rows are the run,
not a reconstruction. Round-trip element-exact in all four modes. Browser-verified through the
real worker: plan run carries captureVariationIndex 0, 10 captured rows, 10 bundles, 36/36 stress
bundles. Suites 322/61/22, badge green at 698. Still no changelog entry; UI is P69d.

---

## Session 2026-08-25 (worktree mc-path-replay) - P69d+P69h, the replay UI (v11.1645)

Replay is live. One injection point in runSimulation() - no parallel pipeline - overlaying the
path's sequences onto the inputs just read from the sidebar; the sidebar controls are never
written. A banner under the tab bar names the path (rank, survival or ruin year, mode, seed) with
an Exit button. Entry points: "Replay worst path" on the plan headline, a pinned-row button in the
compare survival table, and a per-row 🎬 on the stress table. Exit: the button, any sidebar input
event (capture-phase delegated listener), or leaving Charts/Annual Details (P69h, the approved
simplest answer - Optimizer and Tax Planner read the sidebar, which replay never writes).

Two things the browser found that the plan did not:

1. Plan scope never renders the survival table (it renders the headline and empties the tbody), so
   the pinned-row control alone was unreachable in the default scope. The headline hosts the
   button now, in both scopes.
2. Replaying the RAW sidebar put the stress ruin year one year off (2041 vs the table's 2042).
   Cause: swept rows are not the raw plan - every sweep row forces conversions on
   (convertExcessToRoth true vs sidebar false, measured $55 apart by year one). The run's survival
   rate and ruin year describe the ROW, so _replayPlanFields() now rides the variation's
   strategy/conversion fields (selectionOf + the four page-read extras + spendGoal) along with the
   sequences. After the fix: replayed stress balances match the engine trace to the dollar, ruin
   2042==2042, and a survivor path's replayed after-tax wealth equals its captured metric to the
   float (12,125,940.416580342).

Also: length guard refuses a replay after the plan's dates change; banner uses inline
display:flex/none because the .hidden class loses to an inline display. Changelog entry written
(11.1645, the branch's one entry) and the in-page list trimmed to its documented five-entry
ceiling. Suites 322/61/22 unchanged, badge green at 698. P69e (prev/next), P69f (overlay), P69g
(ruin-year mark) remain.

---

## Session 2026-08-25 (worktree mc-path-replay) - P69e + replay control rework (v11.1645 refreshed)

User feedback drove both halves. The boxed 🎬 buttons were unreadable at table size, and "worst
path" alone is not the goal - the capture exists to span the spread. So: ▶️ replaces 🎬
everywhere; the headline button became a compact picker listing all ten captured paths by outcome
("Worst path · ruin 2035" ... "Rank 95% · survives", rankPct rounded for display); the stress
rows keep a bare borderless ▶️; the pinned-row duplicate button is gone.

P69e shipped in the same pass: ◀ ▶ in the banner. Captured paths step worst-to-best as the engine
ranked them; stress scenarios step in the stress table's CURRENT display order, rebuilt at step
time from sortStressRows(buildStressRows()), so prev/next walks exactly the list on screen. Ends
disable their button. The picker snaps back to its placeholder after each choice so the same path
can be picked twice.

Browser-verified: pick worst (prev disabled) -> #2 worst -> ... -> rank 95% (next disabled);
stress walk 1973 -> 1969 matches the table; badge green at 698. Changelog li and md entry
reworded for the picker and the arrows.

---

## Session 2026-08-26 (worktree mc-path-replay) - P69f + Market view + stress compaction (v11.1657)

Three user asks, planned in plan mode (approved design at
~/.claude/plans/propose-how-to-overlay-serene-cocke.md), shipped as four commits.

The overlay: ONE dashed gray "Plan (steady assumptions)" line on the replayed balance chart - the
user chose it over a full second set for readability. Baseline is the SAME plan the replay runs
(sidebar + planFields), deterministically, cached on _replayState so every fresh state or exit
invalidates it for free. Under Current $ it deflates by its own steady inflationFactor, never the
path's - deflating by the path's would smuggle the path back into the "expected" line. Verified:
worst path draws expected $793k against replayed $0.

The Market view: new button in the income-chart row - each year's market return as green/red bars,
inflation as a line, percent axis, tooltip overridden to one decimal (the shared callback rounds
to integers). adj() deliberately unused: rates are not dollars, Current $ must not touch them.
Replay auto-switches to it on entry only (prev/next preserves a mid-replay view choice) and every
exit restores the prior view. The tab-leave exit now also re-renders, closing the pre-existing
quirk where replayed lines lingered bannerless.

Stress table: swatch cell went display:flex with a 4px gap (the inline gap was the user's "wasted
space", round two) and the 46px section indent dropped to 14px.

Suites 322/61/22 (UI only), badge green. Version 11.1657; the branch's one changelog entry
refreshed in place. P69 remainder: only P69g's visible ruin-year mark in Annual Details.

---

## Session 2026-08-26 (worktree mc-path-replay) - P69g, ruin year marked; P69 COMPLETE (v11.1657)

Small and final: under replay, the first year the portfolio cannot cover its required draw - the
same rule the engine's path loop scores ruin by, already the trigger for the pink underfunded
shading - now gets a 2px dark red line across its row. One row only, so the year the banner names
stands out from the pink wreckage after it. One catch the browser found: the year cell's tooltip
was being overwritten by the Tax Planner click-handoff title set LATER in the same cell loop, so
the ruin explanation is folded into that title and applied after it. Verified: marked row 2035
equals the captured ruinYear, tooltip carries both messages, zero marks after exit.

That closes P69 - a through h all shipped. Branch worktree-mc-path-replay holds nine commits,
suites 322/61/22, badge green at 698. Ready for a PR.

---

## Session 2026-08-26 (worktree mc-path-replay) - buying power line, P70 confirmed, P78-P80 planned (filed as P75-P77, renumbered in the PR #194 merge: main had already taken P75 for the withdrawal-mix phase)

Five user asks. Built: the Market view's third series - what day-one $10,000 still buys
(10000/inflationFactor), dashed on its own right-hand dollar axis, dollar tooltip while the rate
series keep percents. Verified $4,919 at 3%/25yr and $2,960 on the worst replayed path.

Investigated: brackets do NOT follow path inflation - sim.cpiRate compounds the fixed inputs.cpi
(optimizer_core.js:2915) while spending follows the path. That is P70, now user-confirmed
interest, and the section gained today's anchors plus a new nuance: Social Security COLA also
rides cpiRate, so high-inflation paths understate SS too - a partial offset to the overstated
bracket creep. Also noted: IRS/SSA index by REALIZED inflation in the real world, so
path-following is the realistic model. P70a stays measure-first.

Planned, not built: P78 (edit the plan against a pinned path - banner lock, planFields
handed off to the sidebar then dropped, banner stops claiming the run's outcome), P79 (draw the
10 captured paths on the survival chart - cost answer: ~3KB transport plus legend hygiene, so
cheap), P80 (nerdknob: record the source years of each bootstrap block - parallel srcYears bank,
no new rng draws so CRN is untouched, byte-identical regression asserted). NOW table cleaned:
struck rows dropped, three new O1 rows added, marker still on line 30.

**PR #194 opened 2026-08-26** (worktree-mc-path-replay -> main): the whole replay feature, 12 commits, plus the variable-inflation caveat in the changelog. P78/P79/P80 plans ride along in .planning (renumbered from P75-P77 at merge time).
---

## Session 2026-08-25 (worktree retirement-optimizer-asset-allocation) - filed P75, year-by-year withdrawal mix; found e-ORP

User asked how to find the IDEAL year-by-year asset-spending mix, beyond one-rule-per-horizon
strategy families. The design worked out in conversation is now the P75 spec: reframe the control
from "which account" to two income targets per year (ordinary realized, LTCG realized); within a
regime tax is piecewise-linear convex so optima sit on a ~12-item per-year edge menu (bracket
tops, IRMAA tier edges, ACA cliff, 0% LTCG top, RMD/spend floors); search by coordinate descent
over that menu seeded from the best swept row, DP as a later rung; deterministic plan plus annual
re-solve rather than a feedback policy; the descent-vs-best-family gap is the number P36 wants.
P75a is a measure-first gate: if the best rows' realized MAGIs do not already sit on edges, the
vertex argument misses an engine coupling and the phase stops for redesign.

Second half of the request: references. i-orp.com is dead (NXDOMAIN); recovered the site, the
papers, and crucially ModelDescriptionK.pdf - the actual LP formulation - via archive.org. Found
e-ORP, which the user had heard of but could not locate: github.com/dcurrie/e-ORP, Doug Currie's
actively maintained MILP re-implementation (pyscipopt/SCIP). Logged DiLellio & Ostrov and three
adjacent open-source planners (fplan, Owl, rplanlib) beside it in findings.md:2752. Two honesty
notes made it into the record: Welch's death is unconfirmed (the Bogleheads thread says only that
he sought a successor), and the DiLellio & Ostrov 2020 abstract does not actually name its
technique - verify before citing it as DP.

NOW table: dropped the done ~~P30~~ row for the P75 row, so the line-30 marker stays on line 30.
Priority O1, user's call via question. Files touched: findings.md (P75 references entry),
task_plan.md (P75 section after P73, NOW row, index row), and this log. No product code, no
version bump, no changelog entry.

Addendum, same session: downloaded and read ModelDescriptionK.pdf in full (28 pp; archive.org
truncated the first attempt at 13KB, the id_ raw-bytes URL delivered all 210,648). It is the model
description, not the equation set - I had over-labeled it "the LP formulation" in findings.md, now
corrected there, in the P75 spec, and in memory. What the paper does pin down (objective =
maximize level real spending with estate as constraint, Appendix C timing, per-bracket income
slices in Table 6, "iteratively" as the only nonconvexity hint) is recorded in the findings entry;
Ragsdale/Seila/Little 1994 added as the published predecessor formulation.

---

---

## Session 2026-08-26 (worktree-p70-cpi-indexation) - P70 COMPLETE, v11.1661, `a27aaea`

Fixed bracket indexation was inventing plan failures. `advanceYear` gained `cpiFollowsPath`, an
opt-in input defaulting OFF, picking the rate that advances `sim.cpiRate`/`sim.medicareRate`: the
fixed `inputs.cpi` as before, or the path's `yr.yearInflation`. Deliberately left alone, each with a
comment saying why: gapYears pre-compounding (those years precede the simulation), `irmaaFwdFactor()`
and the ACA one-year lookahead (path-aware indexation is not clairvoyance), `taxCreepFactor`
(calendar-year by design) and `propTax` (rides `inputs.inflation`).

Harness `cpi_index_harness.js` draws its scenarios from `buildStressBank`/`buildPathInputs` rather
than a second copy, so it runs the Stress tab's own set. **P70e: halfcpi prevents 8.5% of breaches
under fixed indexation and 21.1% under path-following** - the default holds, and re-running the old
`irmaa_default_harness.js` was NOT the answer, because it never feeds `simulate()` a path, so with no
`inflationSequence` its output is byte-identical to main.

**Three operational rules earned here, all now in `findings.md` under "Rules earned the hard way":**
the page is not the file; never cache-bust this page with a short query param (`g` is Growth, `s` is
State - I set growth to 1% for two probes and read it as a plan failure); and any new top-level
`const`/`function` in `optimizer_core.js`, `taxengine.js` or the montecarlo files must be unique
across all five, because the worker shares one scope and node will never tell you. That last one was
found by renaming a colliding constant to `CPI_INDEX_FLOOR` and adding a scan of all five
worker-imported files; written against the broken state it found exactly one collision, which is the
only way to know a guard works.

**Unsafe in-page tests gated (`c877f63`), and the reason is boot ORDER.** `runTests?.()` is called at
TOP LEVEL in `retirement_optimizer.html`, so the in-page suite runs BEFORE `captureDefaults()`,
`loadScenarioByName('default')` and `loadFromURL()`. A mutating test therefore poisons the snapshot
Share uses to decide which fields it may omit, and any field an incoming scenario or URL does not
mention keeps the test's value. Five suites mutate live page state (`acaOptionsUngated`,
`mcPresetStateFollowsTheParameters`, `ceilingDropdownEndsAtTheLastRealCeiling`,
`annualDetailsCellsAlignWithHeaders`, `objectiveColumnSets`); each now carries a
`⚠ UNSAFE - MUTATES:` banner and an `if (!unsafeTest('name')) return;` guard. Gated 246 passed / 5
skipped; `?runtests` 351. The "plan facing ruin" that started this was the fixture leaking, not a
modeling change - restored, the branch matches main to the dollar (tax 551,192, final NW 637,024).

`P81c` stays open: real COLAs are floored at zero and never claw back, but modeled Social Security
and a capped pension both fall when the index falls. Counts: optimizer_core **335**, page 661 gated.

## Session 2026-08-26 (later) - plan reconciliation, no code

Working tree clean at `9ffa856` (PR #195 merged). No unsynced context from the catchup script.

Three drifts between the NOW table and the Open Task Index, all fixed in `task_plan.md`:

1. **P70 still carried an O0 row naming `P70b` as next.** Every sub-item `P70a`-`P70i` is checked
   off and the phase merged in PR #195; the row now reads DONE with the version span and the two
   things that actually shipped (the two-clock `fixedTaxIndexing` spread model, the five-way pension
   COLA cap).
2. **P81 had no index row at all** - it existed only in the NOW table, so anyone reading the index
   would not have seen the one O0 item that is still open. Added with `P81c` as the next item.
3. **P78/P79/P80 all listed "Blocked by P69 (PR #194)".** That PR merged at `30a2e38`, one commit
   behind #195. All three are unblocked.

Net open at O0: **P35** (`P35i`, the Phased engine) and **P81** (`P81c`, the zero-floor decision for
Social Security and a capped pension, which goes for both or neither).

---

## Session 2026-08-26/27 - P81c: a COLA is a raise, never a pay cut  *(v11.1667)*

**Decided both at once, as P70i required, and gave them DIFFERENT floors** - which was the part the
question had not anticipated. They are different instruments and their real rules are not the same.

**Measured before deciding.** The statutory index rate `cpi_t` goes NEGATIVE far more often than
"deflation is rare" suggests, because the shipped spread is negative (cpi 2.8 against inflation 3.0)
and the bootstrap pool is the full 1928-2025 record, Depression blocks included:

| bank (shipped defaults) | path-years | `cpi_t` < 0 | paths with at least one |
|---|---|---|---|
| historical bootstrap, 1000 paths | 30,000 | 8.62% | 87.4% |
| synthetic AR(1) at 3.0% | 30,000 | 13.99% | 92.5% |
| synthetic AR(1) at 2.0% | 30,000 | 22.07% | 98.4% |
| stress bank, combined windows | 780 | 4.87% | 26.9% |

**Social Security got the high-water mark, not a per-year floor, and the statute is why.**
42 U.S.C. 415(i) measures each increase from the last quarter that actually produced one, so a
deflation year pays zero AND the shortfall is absorbed by the recovery: CPI-W fell in 2009, benefits
held flat through 2010 and 2011, and the 3.6% paid in 2012 was measured against 2008 rather than
against the trough. That is a running max over the index. It is also **15x cheaper** than the naive
reading - over 1,000 bootstrap paths a per-year `max(0, .)` lifts the end-of-plan factor +2.07% mean
and +10.57% worst, the high-water rule +0.14% and +4.31% - because the naive rule would ratchet up
permanently and be paid twice for every recovery.

SS could not simply stay on `cpiRate`: that same factor indexes brackets, the standard deduction,
LTCG, IRMAA, the ACA multiple and the QCD limit, and none of those has a statutory floor. Hence a
separate `sim.ssFactor`, seeded at `Math.max(1, cpiRate)` so a typed negative CPI holds the benefit
flat over the gap years instead of shrinking it before the plan starts.

**A capped pension got the per-year floor instead**, `max(0, min(cap, cpi_t))`. The cap has already
severed it from the index LEVEL - that is exactly what makes a capped COLA fall permanently behind
(P70i) - and plan language grants an adjustment of the lesser of the cap and the year's increase,
then never claws back.

**End-to-end, 400 bootstrap paths + the 26-sequence stress bank:** SS +0.12%, pension +0.99%, tax
+0.21%, after-tax wealth +0.19%, failure COUNT unchanged, 4 failing paths last one year longer.
Nothing got worse on the stress bank at all.

**The interesting result: it is NOT monotone in wealth. 9 of 400 paths end POORER**, worst -$20,735.
Cause named rather than assumed - re-ran those paths against the pre-change engine year by year and
the IRMAA column is the whole story. On the worst one a single 2043 tier breach costs $14,477 of
surcharge against $1,174 of lifetime extra SS, and the gap compounds for the remaining eleven years.
A cliff behaving like a cliff. Worth remembering the next time "more income" is assumed to be safe.

**Both guards were checked against the pre-change engine before being trusted**: on the same
deflating sequence SS fell in 4 years and the pension in 4 years there. A floor test that has never
seen the floor bite proves nothing - the same discipline P81a/d used.

**Browser-verified, not just node.** Page 771 green (351 in-page + 420 node), Monte Carlo re-run
through the worker (385 of 500 paths, stress 8 of 36), no console errors, and the index walked by
hand in the live page: 2028-2031 the index falls 1.018 -> 0.99575 while SS holds at $40,716, then
2032 recovers to 1.06193 and SS steps to $42,473 - absorbed once, not paid twice. The pension holds
at $30,540 through the same stretch and resumes from there, not from a high-water mark.

Counts: optimizer_core **337** (up 2), taxPaymentPlanner 61, doclinks 22, page 771.

---

## Session 2026-08-27 - P78 and P79, the replay grows a memory and the chart grows paths  *(v11.1670)*

Both shipped on the same branch as P81c, so the changelog entry was REWRITTEN in place rather than
added to - one entry per branch, and its stamp moved 11.1667 -> 11.1670.

### P78: the plan can now be edited without losing the path

The banner carries "Keep path while editing". With it on, a sidebar edit re-runs against the same
sequence instead of ending the replay.

**The plan said hand the run's plan fields to the sidebar on the FIRST LOCKED EDIT. That is
unimplementable as written, and writing it would have been the bug it was trying to prevent.** The
exit listener is capture-phase on `input`, and by the time an `input` event fires `el.value` is
ALREADY the user's new value. Handing off there means writing the run's `strategy` over the control
the user just changed - the PF8 / P74 class from the other side. So the handoff happens when the
lock goes ON. That is also the better behavior: the moment the reader opts in, the sidebar stops
disagreeing with what is being replayed. Browser-verified - ticking the box flipped
`convertExcessToRoth` false -> true, the swept row's own setting, previously invisible.

**One item the plan did not have, and it was not optional.** `replayCarryOnStep()`: stepping
prev/next builds a FRESH state carrying planFields, so without it the first step after an edit
silently reverted the whole edited plan. Found by walking the step path, not by it failing.

Both decision rules were extracted as pure functions - `replayBannerText()` and
`replayCarryOnStep()` - and unit-tested in tier 1 rather than left inside DOM handlers. Ten
assertions, including the case where the lock is on but the handoff has NOT happened yet, where
stripping planFields would quietly replay a different plan.

**End to end in the browser, which is the only place this feature exists:** worst path, ruin 2034,
lock on, spend $140,000 -> $70,000. The replay survived the edit, the same 25-year sequence stayed
injected, and the path that ruined in 2034 ended at **$1,564,443**. That is the question the
feature was built to answer, answered. Stepping to the #2 worst kept the edited $70,000 and kept
saying MODIFIED; lock off then edit ended the replay the old way.

Note for anyone extending this: text inputs recalc on **blur**, selects and checkboxes on
**change**, and the replay listener is on **input**. Three different events, and a test that fires
only `input` will see the banner update while the numbers do not - which is exactly what happened
here for one round.

### P79: the ten captured paths, drawn and clickable

Engine side is small, as the estimate said: `capturedTraces` sliced from the `paths` array the
capture variation already holds, ~3KB. Two things worth keeping: `captureVariationIndex` is now
clamped BEFORE the variation loop (the loop has to recognise its own variation while it still holds
those paths), and `selectCapturePaths()` is called ONCE and shared, so the drawn traces and the
replay rows cannot drift into describing different paths. Stress deliberately gets none - it
already ships every path as `stressPaths`, and the test asserts it is not paying twice.

**The real hazard was not the drawing, it was `% 5`.** The main chart is five datasets per
variation, and the legend filter, the tooltip filter and the isolate handler ALL index on that.
An appended trace whose index happened to land on 4 mod 5 would have shown up in the legend as a
phantom strategy with a path's name. Traces are appended after every block and all three are now
bounded by `nBlockDs`; isolate maps a trace to `_mcTraceGroup` so isolating the pinned strategy
keeps its own paths rather than hiding them with the others.

**Chart.js's own `options.onClick` never fired for these.** Hit detection was fine the whole time -
`getElementsAtEventForMode` returned the right dataset - but the handler was never called, so the
listener went on the canvas instead. Hooked ONCE: `renderMCChart` destroys and rebuilds the chart
on the same canvas element, so a per-render listener would stack one more replay trigger onto every
click.

**Known limit, measured rather than assumed.** The click resolves to the NEAREST trace point. At
year 4, where five ruined paths run within a few pixels of each other, clicking the worst path
replayed the #3 worst. At year 18 the Rank 95% survivor sits 143px clear of its nearest neighbour
and the click replayed exactly it. Nearest is the only answer available for overlapping hairlines.
Recorded, not papered over.

Scope default verified all three ways: 10 traces at plan scope, 0 at Compare, 10 at Compare once
the reader ticks the box.

Counts: optimizer_core **338** (up 1), tier 1 **361** (up 10), page **782** green. Screenshots were
unavailable this session (the Browser pane was not compositing), so every check above is a DOM or
engine assertion read back out of the live page rather than something looked at.

---

## Session 2026-08-27 (later) - P82, six things wrong with what shipped an hour ago  *(v11.1670)*

All six from using P78/P79 for real. Same branch, so the changelog entry was rewritten in place
again rather than added to - it now describes P81c, P78, P79 and P82 as one release.

**The tooltip was the real complaint, and the number is stark.** Index mode listed every series at
the hovered year: at one pixel, **11 lines**, tall enough to hide the ten paths it was describing.
`nearest` + `intersect` was not enough on its own - it returns every element TIED at the nearest
distance, and two overlapping hairlines are two rows - so the filter keeps only the first element
that passes. Measured at the same pixel afterwards: **1 line**. Medians needed a `hitRadius` too;
with `intersect: true` a zero-radius point has nothing to be on.

**The ring landed on exactly the 46 the report predicted** (10 captured + 36 stress). Verified in
all three directions rather than one: last captured -> first stress, last stress -> first captured,
and backward from the first captured -> the last stress scenario. `ringStep` is pure and tested,
including the double-modulo - a plain `%` in JavaScript keeps the sign, so a backward step from
position 0 lands on -1 and the arrow silently does nothing.

**Dropping the checkbox simplified more than the UI.** With the lock unconditional, the handoff had
to move to replay ENTRY (there is no lock moment any more), and `replayCarryOnStep` lost its lock
parameter: the question is now "is there a prev", not "is the flag on". One fewer state to get
wrong.

**P82f is worth more than the seconds it saves.** An edit during replay used to fire
`mcInputsChanged()`, which would age out the very run the replay came from. Verified by counting
calls, not by watching: both counters read **0** across an edit that did re-run the path.

**The Market Return legend was a genuine Chart.js trap.** The bars carry a per-point color array,
green up and red down, and Chart.js builds the legend swatch from `backgroundColor[0]` - so the key
showed whatever the FIRST year happened to be. A red swatch beside mostly green bars, for one
quantity. `generateLabels` pins the swatch and the label names the convention.

The new real-return line is COMPOUNDED, `(1+r)/(1+i)-1`, not subtracted. At 6% against 3% it reads
2.91% where a subtraction says 3.00%, and the gap widens exactly on the high-inflation paths that
decide an outcome. Tested with the deflation case too, where a flat market is a real gain.

**Testing note that cost time twice now:** a synthetic `MouseEvent` has `offsetX`/`offsetY` of 0,
and Chart.js resolves pointer position from those when the event target is the canvas. So every
hit test silently reported "nothing under the pointer" until the offsets were defined on the event.
The canvas click listener is unaffected - it is a plain DOM listener - which is why click-to-replay
tested fine while hover did not.

Counts: optimizer_core **338** (unchanged - P82 is all tier 1), tier 1 **373** (up 12), page **794**
green. Screenshots still unavailable (the Browser pane is not compositing), so the tooltip and
legend fixes are verified by reading Chart.js's own hit tests and legend items out of the live page,
not by looking at them. Worth one visual pass before merge.

---

## Session 2026-08-27 - P82h, two things still wrong on screen  *(v11.1670)*

Both reported from a screenshot, which is the check I could not run myself this session.

**The banner buttons were mine and the cause is worth remembering.** P82b shrank them with an inline
style carrying only a background. The global `button` rule sets `color: white`, `width: 100%` AND a
44px min-height, so what shipped was three wide blank cream boxes: white text on near-white, at full
width. An inline background does not beat a stylesheet's `color`. They are a `.replay-btn` class
now, overriding each of the three explicitly - and a class can carry a `:hover`, which is the other
thing inline styles cannot do. Measured after: 53 / 55 / 70px, `#6b5310` on `#fffaf0`. The arrows
also read "◀ Prev" and "Next ▶" now instead of bare glyphs; a 10.7px glyph alone was thin even when
it was visible.

Not changelog material: it never existed on main, so against main it nets to zero.

**The Input Distributions fold was pre-existing, and I checked before saying so.** `git show
main:retirement_optimizer.html` has the same summary with no chevron. `.mc-fold > summary` kills the
native marker on purpose - the two headline folds draw their own `.mc-fold-chev` inside a colored
banner - and this third, static summary was never given one. So it had no disclosure affordance at
all since the fold shipped. That one IS reportable, and is in the entry.

**Left alone, deliberately:** `.mc-fold[open] > summary .mc-fold-chev { transform: rotate(90deg) }`
does not take. The rule is loaded (checked `document.styleSheets`), the selector matches, the
`[open]` attribute is there, and the computed transform is still `none` - on all three folds, on
main as well. Nobody reported it, the chevron marks the control either way, and it is a separate
pre-existing quirk rather than part of what was asked for.

**Method note.** Both of these were invisible to every check I ran last round, because both are
about how the page LOOKS and every check was a DOM assertion. `getComputedStyle` would have caught
the buttons - `color: rgb(255,255,255)` against `background: rgb(255,250,240)` is a contrast test a
machine can do - and that is the check worth adding to the habit, not more assertions about state.

---

## Session 2026-08-27 - P82i, a tooltip pointing at the page you are on  *(v11.1670)*

**The Stress Test tooltip was pre-existing, and the cause is a shared string with one unshareable
sentence.** `stressTooltip()` on main takes no placement argument, and both callers get the same
text: the summary-bar tile, which is visible from EVERY tab and for which "See the Monte Carlo tab
for the full stress chart" is exactly right, and the Monte Carlo headline, where it points the
reader at the page they are already looking at. The headline sits inside its own COLLAPSED fold, so
what it should say is where the chart actually is - and the reader's own wording, "Expand this
header to see the detailed chart", says it better than anything I drafted.

`stressTooltip(s, where)` now closes with one of two lines, and an unnamed placement closes with
neither rather than guessing at a destination. Eight tier-1 assertions, including one that the two
strings are IDENTICAL up to the closing line - the point is one shared explanation with one
placement-specific tail, and a future edit that drifts the bodies apart should fail.

**The buttons went blue, and the shade was measured rather than picked.** The page's standard
`#2980b9` carries white text at **4.3:1**, which is under AA, and these run at 0.85em. `#1f6391`,
the darker end of the same blue, reads **6.46:1** on the text and **5.83:1** against the cream
banner. Hover lifts to `#2980b9`, so the standard blue becomes the active state instead of the
resting one.

That contrast check is the habit the last round said was worth keeping, and this is the first time
it changed a decision rather than confirming one: the obvious choice - match the page's button blue
- was the wrong one, and only the number said so.

Counts: optimizer_core **338** (unchanged, all tier 1), tier 1 **381** (up 8), page **802** green.

---

## Session 2026-08-27 - P80, the year behind the number  *(v11.1671)*

Built to the estimate: about 60 lines and four tests. The scoping pass was worth doing, because it
found that the interesting question in the plan had a false premise.

**P80c is answered, and the answer is that the question did not arise.** I expected the Market
return bar and the Inflation line to come from DIFFERENT historical years, which would have made
"one year per column" dishonest and forced a per-series label. They do not:
`buildBanks` sets `scenarioBank = multiAssetBank.equity` in Historical mode, so
`bootstrapScenarioBank` is not used there at all, and `bootstrapMultiAssetBank` fills equity, bonds,
intl and inflation from ONE shared block index. One source year is honest for all three series,
which is why the label went on the tooltip HEADING rather than being repeated on each line.

**The bear overlay was the trap, and it is a quarter of the paths.** `applyBearStartOverlay`
rewrites the OPENING years of `bearFraction` of the paths after the bank is built. Without the same
one-line update there, those cells would carry the years of the block the bootstrap drew and then
discarded - and they are the first years a reader looks at. The test arms the overlay at its default
rather than testing the clean path.

**The wrap is why the years are recorded rather than derived.** A stress sequence that runs past the
end of the record wraps to 1928. A 2007 start on a 25-year plan reads 2007..2025 then 1928..1933;
`startYear + y` would have invented 2026..2031 and looked entirely plausible. The test asserts the
fixture actually CONTAINS a wrapped scenario before checking the labels, so it cannot pass by never
meeting the case.

**The test is the claim, not the plumbing.** The tooltip asserts "this number came from that year",
so the check compares the bank's VALUE against the historical record at the year named, for every
cell: 0 mismatches over 40 bootstrap paths with the overlay armed, plus the whole stress bank. Live
cross-check in the page agreed - 1930 to -25.12%, 1931 to -43.84%, 1972 to +18.98%.

**Zero extra rng draws** is the other load-bearing property, since srcYears fills from an index
already in hand: a draw added there would shift every path in every existing run and quietly change
what a seed means. Pinned by running whole jobs in two modes, not by reading the code.

The three ways to have no year - no replay, a synthetic path, no nerdknob - all produce the byte-
identical year-free heading, checked in the page.

Counts: optimizer_core **340** (up 2), tier 1 **389** (up 8), page **812** green.

---

## Sessions 2026-08-27 / 2026-08-28 - P28j, P83, P30h, P85, P84, P86, and the research/ split

Fifteen passes over two days, no single version until the P84 ship. Full write-ups live in
`research/` and in the phase bodies; this is the trail.

**P28j got a phase, and scoping found its own premise half wrong.** Filed as "invisible and
uncontrollable from the UI". It is NOT invisible - the `timing` column ships in Annual Details as
`Early(Conv)`/`Late(Spend)` with a tooltip. It IS uncontrollable: `forceWithdrawTiming` has no UI, no
URL key, and is absent from `getInputs()`. The constant nobody chose is a third one, `_prevConv > 1000`
(`optimizer_core.js:1274`) - one dollar either side moves a whole year's withdrawal from month 11 to
month 1.

**`P28ja` re-baselined the phase out from under itself.** 450 sims, 75 cells, v11.1671, written as
`CONVERSION_ROUTING.md` section 16 with section 9 left under a SUPERSEDED pointer. The >$1M loss that
justified the phase is gone: `convertExcessToRoth`'s worst case is now **-$8,658**, and section 9's
28-of-75 / -$1,411,488 became **17 / -$616,067**. 15 of 17 losing cells stop losing the moment timing
is held still; the timing leg is never positive in any of 39 live cells (median -$341,771). **Late
beats early 35 of 39.** So the old headline was mostly reporting WHEN money left, not WHETHER
converting paid. The phase is not dead, it is a different phase.

**P32 had zero unchecked boxes and a Status line saying the opposite** - four sub-items had written
their results into the phase without touching the Status line four screens below. The real find was
an item with no checkbox at all: `P32h` decision (4), "give it its own item when someone picks it
up", which nobody did. Now `P32j`. **A prose deferral is invisible to every check the repo has** - a
checkbox is greppable and a status line is read; a sub-bullet is neither.

**P83 (IRMAA margin) - answer is `halfcpi`, the shipped default, and the ordering is identical across
all four path sources.** Breach drop -17.5% bootstrap, -20.1% GBM, -20.3% AAM, -21.4% stress. Both
existing documents were wrong about the premise: `IRMAA_MARGIN_FIXED_CPI.md` proves its case by
quoting a line that has not existed since P70. **`P83f`: every adaptive forecast rule is WORSE on the
downside tail in all four sources** - p10 undershoot roughly doubles under `lastyear`. The constant
wins because it is biased in the safe direction; **an unbiased forecast is the wrong objective when
the loss function is one-sided.** An engine change was scoped and then NOT built, because the
analytic pass showed all three candidates lose to the constant already shipping.

**P30h - do NOT delete the `[40,60]` blend, and the current default is not defensible either.** The
seven objectives split 3-3 AT THE ENDPOINTS; **`w=40` wins zero cells on every objective.** So this
is not "40 is nearly right", it is "no single number is right".

**P85 - converting earlier wins 353 of 499, but RMDs are not what pays.** Zero out growth and 96% of
the advantage disappears ($454,700 -> $18,349). At an 8% spend rate the sign FLIPS (-$8,954). The
re-run with an IRA Goal axis **BROKE C2**: 124 counterexamples, every one the bracket family at a
live goal, zero for Proportional and zero at goal 0. Cause measured, not argued: front-loading eats
the above-goal headroom early, `curIRA` throttles the bracket rule's own withdrawals for the rest of
the plan, and the bigger surviving IRA throws bigger RMDs. **Conversions ignore `curIRA` entirely** -
`applyExtraConversion` caps at `_availIRA`, never at `curIRA` - recorded, undecided, not fixed.
Neither P85 change was a scorer bug: **a fixture was inherited without being read** (`iraBaseGoal: 0`
copied wholesale from another harness against a shipped default of $750,000).

**P84 SHIPPED, v11.168c then v11.168d/e.** RMDs now strike off the prior December 31 balance per
26 CFR 1.401(a)(9)-5; before, `preMonths` was 1 or 11 depending on whether LAST year converted more
than $1,000, so **two identical plans got different RMDs because one of them converted.** `P84k`
characterized first: 22 of 30 plans had a timing-dependent RMD, median 6.21%, max 58.62%; after, 0 of
30 to 7e-18. **R2 was written wrong twice and the first version would have condemned a correct fix** -
it demanded identical LIFETIME RMDs, but timing legitimately changes the balance PATH; **the
regulation constrains the BASIS, not the trajectory.** Then the advisor/AUM fee: six scopes, brokerage
debited pro-rata against basis so `capGainsPercentage` prices identically, `none` the default and a
real off switch (the engine RETURNS on it). **The fee shares the RMD fix's snapshot for a reason, not
for tidiness:** anything computed off `balance` between `beginYear`'s growth and `growAndSettle`
inherits the same `preMonths` dependency, so a fee struck at its own call site would have moved with
whether last year converted. That window now has two known casualties. Measured on shipped defaults,
a 1% fee CHARGES $212,267 and lowers ending balance by **$433,490** - the removed money would have
compounded, so any single-number ratio in a tile understates the cost while looking authoritative.
Later: the %/$ dropdown replaced by inference (threshold in the ENGINE, so a shared `af=20000` is
never read as 20,000%; 20 belongs to FLAT deliberately), which uncovered `data-plain` fields never
setting `dataset.numVal`, so `+val()` on `"20k"` was `NaN` and charged nothing.

**`research/` split, and the user caught the dot-directory mistake before it shipped.** Built as
`.research/` first, which would have BURIED the very files being promoted - Jekyll skips
dot-directories, so every harness report had been invisible on the site the whole time. Renamed to
`research/`. Scripts keep the dot on purpose (nobody should run a harness from a browser), so a
report linking back with a relative `../.test_harnesses/x.js` resolves locally and 404s on the site;
those links are absolute GitHub blob URLs now.

**P86 filed at O0 and then built, v11.1690.** The trigger was `SumAUMfees` DECLINING between 2049 and
2050. **The rule it reduces to: a STOCK is deflated by its own date's factor; a FLOW ACCUMULATED over
time must be `SUM(flow_y / factor_y)`.** The user's premise that the whole summary bar is on the
wrong basis was mostly wrong - and finding that out mattered, because scoping this as a rewrite would
have been wrong. But it did expose a defect: "All RMDs" ignored the toggle entirely, so a nominal
lifetime flow sat beside a deflated one. Exactly two columns are genuine broken running totals
(`SumTaxes`, `SumAdvisorFees`); the same test flags `spendGoal` and `netIncome` as declining and
**those are CORRECT**, so the fix had to be a NAMED accumulator list, never a monotonicity heuristic.
Stored running totals were deleted whole rather than fixed (measured first: 114.0ms -> 113.8ms). MC
deflates each path by its OWN inflation; per-path real vs flat-CAGR differs +4.9% at the median.
Suites **358**/61/22.

**Nine scoring-predicate defects across these two days**, every one caught by a number disagreeing
with the one printed beside it, never by review. Generalized into `findings.md` under "Rules earned
the hard way". The MC-time question the user raised was TABLED - node A/B showed parity (means 68.2s
vs 68.8s) and the in-browser slowdown followed RUN ORDER, not the build, with the release build
doubling against itself. User's standing instruction from it: perf A/Bs on the MC should use 50-100
paths, not 500.

## 2026-08-29 - P19 demoted to O2; P87a measured, and it refuted P87's premise

**P19 -> O2 (user, this session).** Row removed from the NOW table (that table is O0/O1 only), index
row at what was line 379 relabelled, and a `User 2026-08-29:` note added beside the 2026-08-07 one.
The note is load-bearing rather than decorative: deleting a NOW row would have pulled the LINE-30
marker up to 29 and silently dropped a row out of the planning hook's `head -30` window. One line
out, one line in.

**P87a DONE.** New harness `.test_harnesses/bracketbasis_harness.js`, report
`research/BRACKET_CEILING_BASIS.md`, rows added to `research/README.md` and `research/HARNESSES.md`
in the same commit. 240 cells x 2 arms, 485 sims, ~2s.

Engine changes, all inert unless armed:
- `-fedTaxableInc` and `-fedDeduction` on the log record (leading `-` keeps them out of Annual
  Details; browser-verified at 87 columns with neither present).
- `bracketCeilingAddDeduction`, research-only, default off, no UI. Raises the federal-mode ceiling
  by the year's deduction. Placed after the state bracket LOOKUP but before the state min and before
  the `minlimit` IRMAA min, and the position is the measurement - see the comment at
  `optimizer_core.js:980`.
- `computeBracketCeiling` gained a 13th parameter, `dedAddBack`, passed from `yr._ceilDedAddBack` at
  all three call sites.

**The finding, in one line: the defect is real and exactly one deduction, and correcting it loses
money.** A Fill Bracket 22% plan aims at $211,400, lands MAGI on $211,400 and federal TAXABLE income
on $179,200, against a $32,200 deduction - to the dollar, every year. But over 74 clean cells,
terminal after-tax net worth RISES in 19 and FALLS in 51, median -$47,092.

The sign is set by the bracket, not the plan: 12% gains (+$159,278 median, +$1,201,973 best), 22%
loses (-$173,437, -$2,523,647 worst), 24% loses (-$14,583). The separator is OVER years and nothing
else - cells that gain were already breaching the ceiling every year, so the ceiling was not
governing them and lifting it turns a forced draw into an ordinary one (lifetime tax -$53,590);
cells that lose had ZERO OVER years, and lifting a ceiling that did govern just draws more, earlier,
for $314 of tax. Control-arm lifetime tax is the same in both groups to within $1,200 of $894,000,
so it is not a tax-level story.

**Second finding, unlooked-for: `Min Limit 24%` never sees the federal number.** 0 of 40 cells move.
Its ceiling is `yr.IRMAALimit`, built from `goalLimit` - the bracket top containing the SPENDING
GOAL, $211,399 where Fill Bracket 24% aims at $403,550 - so the min never selects the federal side.
The "24%" in that row's label is close to decorative. Not P87's problem; recorded so it is not lost.

**Two predictions were scored on the wrong quantity and both are documented rather than deleted.**
B1 asked a per-year claim of a LIFETIME total and condemned a working arm in 70 of 120 cells
(drawing more early leaves less to draw later; a lifetime sum is not monotone in the ceiling). Same
failure as `rmdbasis_harness.js` R2. B4's second clause predicted `minlimit` would move.

**Phase consequences:** P87 stays O2. `P87b` reframed from "which correction" to "should the number
change at all", and if anything is built it belongs behind a choice, not as a silent fix. `P87f`
(label which income the ceiling is) promoted to the phase's best-supported item. `P87c`/`P87d`
untouched - this armed the deduction leg only.

**Verification.** Suites 358 / 61 / 22, unchanged; no tests added, so `TestTiers.EXPECTED` and
`.githooks/README.md` needed no reconciliation. In-browser: Annual Details renders 87 columns with
neither new key present, self-check badge green with tier 2 run via `?runtests`.

**No changelog entry for this branch.** Nothing in `git diff main...HEAD` is visible to a user: the
flag is off, the log fields are hidden, and the only `retirement_optimizer.html` change is the
`optimizer_core.js?v=` cache-buster. The `<title>` stamp was bumped to 11.16a1 and then reverted for
the same reason - that number names a changelog entry, and there is no entry to name.

GOTCHA for the next session: `.planning/retirement-optimizer/task_plan.md` is CRLF, and an edit
written with bare `\n` leaves one mixed line behind. Normalize on the way out.

## 2026-08-29 (cont.) - P88 opened at O0: extra conversions are invisible to MAGI

Came out of a user observation, not a plan item. The user pointed out that `extraConversionAmount`
and Fill Bracket are antagonistic - an extra conversion stacked on a draw already sized to fill the
ceiling must break it - and proposed a UI warning plus excluding bracket families from the
Optimizer's conversion search. Both correct. Chasing why the tool has never SHOWN that conflict
found a larger defect underneath it.

**`applyExtraConversion` updates the year's tax and not the year's MAGI.** Logged MAGI is identical
at $0, $25k, $50k and $100k of extra conversion - flat $211,400 against a $211,400 ceiling. The
income tax is charged correctly (both functions recompute it and copy `federalTax`/`stateTax` back);
`MAGI`, `AGI` and `federalTaxableIncome` are simply not copied out of the same result.

That figure is what the IRMAA lookback charges two years later. On the probe plan the engine records
`-none-` / $0 where $311,400 of true MAGI earns Tier 2 at $7,166 a year. Every strategy using the
conversion path is affected, so this is not a ceiling-family problem, and it biases the Optimizer's
`⇌` conversion search toward larger conversions across the board.

Two blindnesses stack and either alone would hide it: the stale MAGI, and `bracketOverage` being
computed in the withdrawal phases (`:2276`, `:2518`) long before `applyExtraConversion` runs
(`:3534`).

Sequenced deliberately: characterize with a harness FIRST (P88a, the rmdbasis R12 lesson - this
moves IRMAA in nearly every converting plan, so predictions get registered before the fix), then the
fix, then the overage recompute, then tests, and only THEN the UI warning the user asked for. A
warning shipped ahead of the fix would describe a conflict the tool's own numbers deny. The
Optimizer exclusion is deferred to P88f and may prove unnecessary once conversions are priced right.

P88 blocks P87g. NOW-table bookkeeping: the new O0 row cost a line, so the two `User <date>:`
decision notes were merged into one to keep the LINE-30 marker on line 30.

Nothing built this session beyond the write-up; no engine change, suites unchanged at 358 / 61 / 22.

## 2026-08-29 (cont.) - P88a-e built and shipped, v11.16a3

User asked for a through e. All five done; `P88f` deliberately left open.

**P88a.** `extraconv_magi_harness.js` + `research/EXTRA_CONVERSION_MAGI.md`, 172 sims, rows in both
indexes. Ran on the stale engine FIRST and the pre-fix numbers are embedded in the harness, so it
scores the fix rather than needing two pasted tables compared by hand. M1-M6 all HOLD.

**P88b.** `adoptTaxBasis(yr, calc)` + an explicit `TAX_BASIS_FIELDS` list.
`applyExtraConversion` adopts from the `_exTaxCalc` it already had. `applyConversionGrossUp` had no
with-gross-up calc, so it makes one - and it had to, because adding `increase` to MAGI by hand is
wrong whenever taxable Social Security is under its 85% cap: the draw raises provisional income and
AGI moves by more than the draw. The list is explicit rather than an `Object.assign` because the
recomputed calc carries `IRMAAAnnualCost: 0` and its rate/total fields are wrong for the year.

**P88c.** `recomputeBracketOverage` after both paths, with the two causes kept apart -
`-overageFromConv` is the voluntary share, and `isBracketInfeasible` subtracts it so the heuristic
keeps meaning "this ceiling cannot fund this plan". Without that, typing a conversion would flag
every bracket row infeasible and empty the Optimizer table for exactly the users this phase is for.
`acaBreach` deliberately left on the spending-driven figure.

**P88d.** 5 new tests, suites **363**/61/22, `TestTiers.EXPECTED` and `.githooks/README.md`
reconciled, badge green in-browser at 845 total. Three existing tests re-baselined and every one
CHECKED rather than accepted, which is the whole reason P88a ran first (risk R12). Two of my own new
tests were wrong on the first pass and both faults are recorded in the test file: the IRMAA fixture
drew $250,000/yr, and single-filer bands run 109k/137k/174k/205k/500k, so $250k and $350k are the
SAME tier and the test could not fail; and the regression guard asserted an identity that stops
holding once the portfolio is spent out and taxable income floors at zero.

**P88e.** Visible warning under Extra Annual Roth Conversion, gated on a ceiling strategy plus a
non-zero amount. Warns, never blocks. Carries measured numbers once a run exists. Browser verified
in all three states.

**Changelog written** - this branch IS user-visible now, unlike its earlier commits. The in-page
list was already over its documented five-entry ceiling, so the two oldest went when this was added.

Version 11.16a3, five bump sites including the tier-2 loader's own `const V` (the suites changed).

**P88 unblocks P87g.** Next: `P88f`, and the GK re-baseline is the evidence it is worth asking.

## 2026-08-29 (cont.) - P89: the ACA age gate read a year the plan does not start in

User selected `Below IRMAA` and got a paragraph about the ACA FPL cap. Three stacked defects, and
the user chose to fix all three.

**A.** `updateACAWarning` never read `sel.value` - it gated on "does the dropdown contain ACA
options" plus ages, so the FPL advisory fired for every Limit choice.

**B.** Its year and both ages were wrong: `by1 + startAge` = 2023 on the reported plan, which
actually runs from 2026. It announced "you will be 65 and your spouse 54" for a plan whose first
year has them at 68 and 57. The block's own comment says naming the start year is "the whole point
of this block rather than a flourish", added because exactly this confusion was reported before.

**C.** The same expression lives in `bothOnMedicareAtStart`, which decides whether ACA rows appear
in the Optimizer at all.

**Root cause: two definitions of the plan's first year, one clamped and one not.** I initially
guessed `startAge` was vestigial because the engine never reads it; that was wrong, and checking
`getInputs()` corrected it - `startAge` drives the start year through `startInYear`'s clamp.

Measured before changing anything: 22.2% of a 6,396-combination grid disagrees, 1,423 flips one way
and 0 the other. The direction is provable and is now pinned by a test rather than left to be
re-measured.

Fixed with one shared `planFirstYear(by1, startAge, currentYear)`, pure and year-pinnable. The
advisory is gated on an ACA selection; the "options are greyed out" message deliberately is not,
since a user who cannot select them could otherwise never learn why.

3 tests, suites **366**/61/22, both count sites reconciled, badge green at 848 in-browser. Verified
on the user's exact URL: hidden on Below IRMAA, and the ACA advisory now reads 2026 / 68 / 57.

**Three existing test call sites had to be pinned to an explicit year** - the new default parameter
would otherwise have made them time-dependent, including the golden capture reproduction. One
existing test comment was also wrong and is corrected in place.

Changelog entry names the Optimizer consequence plainly. v11.16a4.

## 2026-08-29 (cont.) - P88f done; P88 and P89 both complete, v11.16a4

Measured the user's original proposal properly now that P88b prices conversions correctly.

**Answer: their instinct was right, their remedy was not.** 61 of 180 ceiling cells pick a non-zero
conversion, so the search does not exclude them by itself; all 61 breach their own ceiling, several
in every year they have one. But excluding them costs a median $53,990 and up to $1,546,930, with
not one of the 61 gaining under $1,000 - there is nothing marginal to discard. Shipped `⤴` on the
Strategy column instead, reading `-overageFromConv` so it never fires on a spending-forced breach.
That distinction is exactly what P88c was built to make, and this is the first thing to use it.

C5 was nearly scored on a bar it could not fail - "the heirs rate flips the answer at least once",
which 3-of-60 would have passed. Rescored against the competing axis it FAILS: the spend rate is the
lever (spread 25 against 3). That is the third time this session, after B2 and M1. Recorded in
findings as a standing rule: a prediction that cannot lose is not a prediction.

**Changelog consolidated.** I had written one entry per release - 11.16a3 and 11.16a4 - which is
exactly what CLAUDE.md's one-entry-per-BRANCH rule forbids ("numbered the development rather than
the change"). Merged back into a single entry covering P88 and P89, ordered by user impact, 249
words against the ~150 target. The in-page list is at four entries, under its five ceiling.

Version stayed 11.16a4 - same hour as P89. Suites 366/61/22. Browser verified the marker on a live
sweep: 7 conversion rows, 2 marked, all five agnostic rows unmarked at zero breach.

P88 and P89 both close. NOW table is back to its pre-session rows plus nothing.

## 2026-08-29 (cont.) - P90: two user-reported chart fixes, v11.16a4

**A.** The Market Return chart's "(from 1974)" source-year suffix was nerdknob-only. Ungated, on the
rule already written beside the advisor fee and the forward IRMAA projection: which historical year
a bootstrap block came from is a FACT about the path on screen, not a diagnostic.

**B.** The Income & Expenses tooltip reported the scaled bar height rather than the income. That
chart shrinks every source by one year-wide rate so the stack meets the Net Income line; the tooltip
printed the shrunk figure, so a $15,000 pension read $12,886 with no explanation on screen.

Now `Pension: 15,000 - ~2,114 tax`. Two deliberate details:

- **A `taxed` flag per source.** The scale is uniform, so it also shaves Roth withdrawals, Cash
  withdrawals and return of basis - none of which is taxable. Those report their amount alone rather
  than being given an invented tax charge. Checked the books on one year: attributed tax across the
  taxed sources $26,733, untaxed Brokerage shaved $392, Fed+State that year $27,126. 26,733 + 392 =
  27,125, so the uniform scale is fully accounted for and only the taxable part is named tax.
- **A `~` on the figure.** Even where tax is borne, this is the year's average rate applied
  proportionally, not a per-source calculation - Social Security is taxed on at most 85% of itself.

The note under the chart pointed readers to Annual Details "for pre-tax amounts", which this change
made half-stale, so it was rewritten rather than left aimed at the wrong place.

**Changelog: folded into the existing branch entry, not added as a new one** - the mistake I made
earlier this session and corrected. 341 words now, over the ~150 target and worth watching if the
branch grows again.

No tests: both are Chart.js callback wiring with no node-reachable seam. Suites unchanged at
366/61/22, browser-verified instead - the callback returns `SS: 26,073 - ~3,674 tax` and
`Brokerage: 2,779`, and `replaySourceYear` returns 1974 with NERD_KNOBS false.

## 2026-08-29 (cont.) - user reported "Stress Test 36 -> 40"; it is NOT this branch, and the real bug is worse

Suspected a regression from this session. Measured instead of assuming, and the suspicion was wrong.

**Staged `main` (11.1691) and HEAD (11.16a4) side by side and gave both the same shared URL. Both
report `8 / 36` on first load. Both report `0 / 40` once the stress pass is re-run against the plan
on screen.** `simulate()` is bit-identical for that plan across the two builds - same success, 36
years funded, same tax, IRMAA, conversions, terminal wealth; the only log differences are the three
fields P88/P88c added, previously `undefined`. `buildStressBank` is identical at every plan length
and window mode.

**The real defect: the first stress pass answers about a plan the user is not looking at.**
`mcPlanYears(getInputs())` = 36 while `_mcResults.years` = 25, and 25 is the horizon of the saved
*default* scenario that `loadScenarioByName('default')` applies before `loadFromURL()` replaces it.
The sequence count is a pure function of (stressCount, years, window): 20-25 years -> 36 sequences,
30+ -> 40. So the count the user saw move was the horizon moving.

**It flips the verdict, which is why this is O0 rather than cosmetic.** Stale: "runs out of money in
8 of the 36 worst historical periods, typically around 2046." Correct: "survives all 40." A false
alarm on the one number the pass exists to produce. Opened as P91, explicitly marked NOT a regression
so nobody bisects this branch for it. All three entry points read `getInputs()` fresh, so the run is
started too early or not invalidated - not a stale variable.

Also noted in P91d, and NOT the cause: the Monte Carlo controls are in neither the saved scenario nor
the share URL, and mc_tab.js uses no localStorage, so paths/seed/stress count/window reset every load.
That is the first thing anyone will blame when two runs of "the same plan" disagree.

**P90b fixed and shipped:** the Cash Reserve warning offered "-1" as the way back to legacy all-cash
behavior. `-1` is not typeable - the field carries `min: 0`, so it clamps to `0`, which is a
DIFFERENT mode (no buffer, reinvest all surplus to Brokerage). A user following the advice landed in
a third behavior silently. Now says "Off", which is what the field's own tooltip and placeholder
already said. Folded into the branch's single changelog entry.

Killed the two staged A/B servers afterwards.

## 2026-08-29 (cont.) - P90 wording corrected after user review

The user read my P90 note and pushed back on two things, both fair.

**It overstated the precision.** My note said "Hover over a bar for what that source actually paid,
and the tax attributed to it", which reads as though the tax figure is that source's real bill. It
is not - it is the year's average rate shared out proportionally. Their example: $35,000 of Social
Security does not owe $12,000. Replaced with their wording, which is also shorter: "Income BARS have
been scaled down by the total taxes. Hover over a bar to see the actual income less the approximate
attributed tax."

**`- ~3,674 tax` is hard to parse** - two operators in a row. Now `26,073  ~3,674 tax`: the space and
the word "tax" already say it is a deduction, so the minus sign was only noise. The `~` stays, and it
is now the only thing carrying the approximation, so the code comment says so explicitly rather than
leaving it to the note.

**Changelog trimmed while in there.** It had grown to 416 words against the ~150 target as this
branch accumulated - the same drift CLAUDE.md warns about, one step removed. Rewritten to 301,
ordered by what a reader needs first: the IRMAA behavior change, the two conversion warnings, the ACA
gate (also a behavior change), then the small stuff. Still over target; this branch simply carries a
lot of user-visible surface, and cutting further would start dropping things a reader must act on.

Verified in the browser: note reads as the user wrote it, tooltips read `SS: 26,073  ~3,674 tax` and
`Brokerage: 2,779`. Suites 366/61/22.

## 2026-08-29 (cont.) - in-page changelog split into bullets, and two notes dropped from it

User review. The 11.16a4 entry read as one block of text, and the LATEST CHANGE banner copies the
first `<li>`'s innerHTML verbatim, so it inherited the same wall. Now a nested `<ul>`, four bullets,
which renders in both places (checked: `display: list-item`, markers `disc` in the banner and
`circle` in the Change Log list, so they are real bullets and not just paragraph breaks).

**Two notes dropped from the PAGE and kept in the .md**, on the user's rule, which is a better rule
than "summarize everything":

- The Cash Reserve "-1" wording fix. Anyone loading this build will never see the bad message, so
  the note has no reader.
- The Market Return chart naming the replayed year. Self-evident on sight.

Recorded that rule in the VERSION SYNC comment block above the list, next to the existing
five-entry ceiling, since the next person writing an entry is the one who needs it: **drop any note
a reader of THIS build cannot act on - a fixed message they will never see, or a change that is
obvious the moment they look at it. Both still belong in optimizer_changelog.md, which is the record
rather than the notice.**

The .md keeps all six items and stays at 301 words.

## 2026-08-29 (cont.) - P91 DONE, v11.16a5

**It was a dropped request, not a stale variable** - which is what the write-up predicted, so the
prediction earned its place. `refreshMCStressOnly`'s two guards (`_mcStressRefreshing`,
`_mcWorkerBusy`) are both correct and both threw the request away. Prime-on-load is still running
when the share URL or saved scenario lands, the refresh it asks for is discarded, and nothing ever
asks again - `mcInputsChanged` reads `_lastMCHash` but never writes it, so there is no retry path.

**The same guard has now caused three bugs and the first two fixes treated the wrong half.**
`runMonteCarlo` and `cancelMC` both carry comments about clearing the flag so later refreshes are not
frozen out; both fixed the stuck FLAG, neither noticed that a request dropped while the flag was
legitimately set is gone for good. Recorded in findings as the transferable shape: a guard that drops
work needs somewhere to put the work, not just a reliable way to clear itself.

Fix is coalescing: `_mcStressPending` + `_drainStressPending()`, drained on every completion including
errors, flag cleared before re-entry so a failing refresh runs once more instead of spinning.

**Found while fixing, same class:** the full sweep was silently stale too - `markMCStale(false)` ran
unconditionally at completion, and the staleness check it depends on skips itself while `_mcResults`
is null, which is exactly the load case. So a sweep on the pre-URL plan finished, CLEARED the banner,
and sat there looking current. Now re-checked at completion. The banner text was already right; it
had just never been shown in the situation it describes.

Verified on the user's own URL, fresh load with the cache busted: `0 / 40`, stress horizon 36 = plan
36. Before: `8 / 36` on a 25-year horizon. The sweep is still on 25 years - correct, it did run early
- but now raises the Out-of-date banner.

No node test: `optimizer_core.tests.js:5446` already records that this code needs a DOM and is
covered in the browser tier. Suites unchanged 366/61/22.

**Changelog is 416 words against the ~150 target.** I have trimmed it twice and it keeps growing
because the branch keeps earning entries - six user-visible items now, three of them behavior
changes. Noting it rather than shaving further: cutting more would drop things a reader has to act
on, and the stress fix in particular tells them to re-check a number they may have believed.

## 2026-08-29 (cont.) - P93: the assets heading names its year, v11.16a9

I reported the no-growth-before-retirement finding as a possible modelling gap. The user reframed it
and the reframing is right: the section is titled "Assets at Retirement Age", so the balances were
never meant to be today's. **The tool has no accumulation phase and the reader forecasts to that
year** - the defect was only that the year appeared nowhere on screen.

Heading now reads `2. Assets at Retirement Age (2035)`, computed from `planFirstYear` - the same
definition the engine's `startInYear` uses (P89), so the label cannot drift from the simulated year.
Wired to both inputs that move it: `updateProfileAgeDisplay()` already covered birth year and month,
but `startAge` had its own inline `oninput` that only refreshed the ACA warning, so it needed adding.
Verified across four cases including the already-passed clamp.

Also fixed the documentation entry, which said "Enter balances in today's dollars" - the exact
misreading this phase exists to stop.

No calculation changed. Suites 366/61/22.

## 2026-08-29 (cont.) - P94 START: remove the `minlimit` strategy

Branch is level with `main` (0 ahead, 0 behind), tree clean, so this starts a new changelog entry.
Baseline captured before touching anything: suites **366 / 61 / 22**, all green. The strategy-
enumeration goldens are asserted inside `optimizer_core.tests.js` (`:5508`, `:5526`), so a passing
core suite IS the proof that neither sweep ever emitted `minlimit`.

Grep confirms the plan's inventory: `optimizer_core.js` clamp at `:984`, cascade at `:1458`-`:1472`,
five dispatch/coexist conditions, three UI sites, seven test fixtures to re-point and two tests to
delete. `taxengine.js:1584`'s `IRMAALimit` is a DIFFERENT thing - a local in the Medicare-premium
helper - and stays.

## 2026-08-29 (cont.) - P94 DONE: `minlimit` is gone, v11.16aa

All five steps landed. Suites **364 / 61 / 22** in node, badge green in the browser at 850 total
(403 in-page + 447 node), `?runtests` with zero unsafe skips.

**The goldens are the proof.** `sweep_golden.js` was not touched, and both enumeration goldens still
reproduce, so neither the Optimizer sweep nor the Monte Carlo sweep ever emitted `minlimit`.

**Three things the plan got wrong, all found by doing it:**

1. **`computeBracketCeiling` does NOT drop a branch.** Its three branches are IRMAA tier / ACA /
   federal; the `minlimit` clamp lived INSIDE the federal one. Two branches became two. The cascade
   deletion is real - `yr.IRMAALimit`, `_irmaaEffCpi`, `IRMAABracket`, `_irmaaMargin`, the 15-line
   inertness comment and the `IRMAALimit` parameter with all three call sites - but the function did
   not get structurally simpler, only shorter.
2. **The fallback cannot run where the plan said to put it.** "Immediately after the `aca` mapping"
   is before `applyScenario`'s generic loop, and that loop writes `#strategy` itself - so the guard
   would inspect a select the loop had not yet broken. It runs AFTER the loop, and separately on the
   URL path.
3. **Money moved on one test fixture, and the plan predicted it would not.** Re-pointing the P32h
   tripwire from `minlimit` to `bracket` at IRMAA tier 1 flipped year 0 from a month-11 withdrawal
   to a month-1 one, because `_stratImpliesConversion` lists `bracket` and never listed `minlimit`.
   Total stranded 27,529 -> 29,368 and the Brokerage headline 1,027,282 -> 1,016,150, over the same
   ten years, worst single year unmoved. Re-pinned with the reason recorded in the test. This is the
   P28j coupling, arriving unbidden: the fixture now measures a plan a user can actually run.

**Found and fixed because this change would have broken it:** the changelog's `<a id="11.1691">`
anchor sat above the `## 11.16a9` heading, and `## 11.1691` had none. It only worked because 11.16a9
was the top entry, so the Details link landed on it by accident. Adding an entry above would have
sent it to the wrong release. Both anchors now sit on their own headings.

**Extended past the letter of the plan, once:** `?str=aca` on the URL path. `applyScenario` maps
`aca` -> `bracket`, `loadFromURL` never did, so the guard would have taken a deliberate internal
name for an unknown one. Same one-line mapping added there, and verified both ways.

`resetUnknownStrategy` falls back to the markup defaults when `OPT_DEFAULTS` is empty. That is not
belt-and-braces: the self-check suite runs BEFORE `captureDefaults()`, so the first version silently
did nothing under test while working in production. The test caught it.

**Left alone deliberately:** the five files in `.test_harnesses/` still name `minlimit`. They are
dated research records whose conclusions were measured against the strategy as it was; re-pointing
them would change what they measured and invalidate their own prose. They will not run correctly
again, which is true of their line-number references already.

**Found while verifying, NOT fixed, and pre-existing on `main`:** an ACA share link does not
round-trip. `?str=bracket&sr=aca400` lands on stratRate `10`, not `aca400`, so `stratACAMultiple`
reads 0 and the plan silently loads as Fill Bracket 10% instead of an ACA cap. `buildShareURL` emits
exactly that pair, so every shared ACA plan is affected. Confirmed pre-existing: `git diff main`
touches no stratRate code. Recorded in task_plan as its own item.

## 2026-08-29 (cont.) - P92a DONE: the bracket ceiling adds the deduction, v11.16aa

Suites **367 / 61 / 22**, browser badge green at 853. The ceiling raise is unconditional; the P87a
research flag `bracketCeilingAddDeduction` is gone from the engine.

**The plan's instruction could not be followed literally, and measuring said what to do instead.**
It asked for "the SAME deduction calculateTaxes() charges". That deduction does not exist when the
ceiling is placed - the senior deduction phases out against the AGI the ceiling is about to
determine - so the real question was how wrong each OBTAINABLE deduction is. New harness
`.test_harnesses/ceilded_harness.js`, 3,960 plan-years:

| candidate | median | p90 | worst |
|---|---:|---:|---:|
| last year's charged, re-indexed (the P87a arm) | $0 | $763 | **$35,505** |
| statutory std + age bumps, re-derived | $0 | $4,300 | $6,000 |
| **ask calculateTaxes() about a provisional year, twice - SHIPPED** | **$0** | **$0** | $6,000 |

The prior-year candidate is exact in the median and wrong by the WHOLE $35,505 in the 120 years the
filing status changes, because it carries an MFJ number into a Single year. That killed it.

**The second pass is not polish.** Asking at the bracket top evaluates the senior deduction about one
deduction too low, so it comes back too large and the ceiling OVERSHOOTS: measured $1,338 of taxable
income spilling into the next bracket. Asking again at the ceiling the first pass implies turns that
into an $80 undershoot. Verified in the browser on the default plan: bracket top $211,400, ceiling
$252,790, taxable income $207,641 - against $22,308 short before.

**Cost measured, not assumed:** 0.813 ms/sim against main's 0.820 on a 40-year Fill Bracket plan,
alternating runs. Two extra tax calls a year are lost in the noise.

**Four tests failed and none was a pinned constant.** Every one was a fixture whose assumption the
ceiling change invalidated, and each was repaired to keep testing its own subject:
- `soft cap (federal bracket)`: a 22% ceiling on the true top no longer breaches at all, so there
  was no forced draw left to test. New `CAP_SOFT` at 12%, where the limit still binds.
- Two `P35g` step-up tests: the ceiling drains that fixture's IRA to zero, which drops the survivor
  into the **0% long-term capital-gains band** - and a step-up on gains taxed at 0% is worth exactly
  nothing, so both assertions about its value went vacuously false. `STEPUP_BASE` gains an IRA Goal.
  Worth keeping in mind: that is a real consequence a user can hit, not only a fixture artifact.
- `OC: counterfactual pays the RMD counter-effect`: comparing the counterfactual's lifetime tax
  against the actual run's is confounded now that the actual arm converts ~$1M. Replaced with the
  causal form its own title claims - same plan, bigger IRA, bigger RMDs, more tax - which holds on
  main too.

**Disclosed cost, measured against main on the P87a grid:** 71 clean cells, net worth up in 18 and
down in 49, median **-$47,549**, best +$1,517,175, worst -$2,589,357. By bracket: 12% +$157,572,
22% -$200,350, 24% -$12,741. Median conversion change $0 - nothing sizes a conversion against the
ceiling, which is P87a section 7's finding surviving intact and still unaddressed.

`-ceilDedAddBack` is now logged beside `-fedDeduction` so the residual is auditable from a finished
run. `research/BRACKET_CEILING_BASIS.md` gains section 8 and its index row names it.

## 2026-08-29 (cont.) - P92c DONE: a limit that could not be kept now says so, v11.16ab

Suites **367 / 61 / 22** in node (unchanged - the warning is UI), browser badge green at **860**
(410 in-page + 450 node). Seven new in-page assertions.

**NO THRESHOLD, and that is the decision.** The Optimizer's `_isBracketInfeasible` calls a row
infeasible past 50% of years. That is fine for ranking a table and wrong for talking to one reader,
because both ends of the distribution are common. Measured on the P87a grid, cells with at least one
forced-overage year:

| family | cells | 0 forced yrs | 1..50% | >50% |
|---|---:|---:|---:|---:|
| Fill 12% | 40 | 0 | 4 | 36 |
| Fill 22% | 40 | 6 | 14 | 20 |
| Fill 24% | 40 | 37 | 3 | 0 |
| IRMAA 1 | 40 | 12 | 24 | 4 |
| IRMAA 3 | 40 | 37 | 3 | 0 |

A single breached year is common and a wholly unfundable limit is common; they are different
statements and neither is noise. So the COUNT is the message - "in 3 of 25 years" - and only the
opening sentence hardens past half. ACA gets its own wording off `-acaBreach`, because it is a CAP
and breaching it forfeits the subsidy rather than paying a higher rate.

**Found and fixed, shipped broken since v11.16a4:** `extraConvCeilingKind()` read
`val('stratIRMAATier')` and `val('stratACAMultiple')`, and **neither is a form field** - both are
derived in `getInputs()` from the single Limit dropdown, whose value carries them as `IRMAA2` or
`aca400`. Both reads were `undefined`, `+undefined` is `NaN`, every comparison against it is false,
and the function fell through to "the federal bracket ceiling" for every plan in the family. The P88e
warning has been naming the wrong ceiling from the day it shipped, in the one sentence whose whole
job is to name the right one. Confirmed on `main`. Now asks `getInputs()`. My own warning inherited
the bug and is what surfaced it.

**Verified in the browser, all four kinds:** Fill 12% -> "cannot fund this plan: ... 22 of 25 years
... up to $191,296"; IRMAA tier 0 -> "the IRMAA tier ceiling ... 1 of 25 years ... up to $130"; ACA
400% -> "income goes over the cap in 2 of 36 years and the premium subsidy is lost"; Proportional ->
silent.

**Testing gotcha, cost a full false-green run.** I bumped `?v=` to `1116ab` and THEN edited
`optimizer_tests.js`, so the browser served the cached bundle and reported 403 passing with my new
tests never executed - a green badge that meant nothing. `runTests.toString().includes(...)` is what
caught it; `fetch(url, {cache:'reload'})` on the exact `?v=` URL fixed it. **Bump the version AFTER
editing, not before, or verify the bundle actually contains the new code.**

## 2026-08-29 (cont.) - P96: advice nobody can follow, v11.16ab

User-reported. The ACA gate's note ended "Lower Retirement Start Age to model pre-Medicare years",
which for a household already past 65 this year is unfollowable - `planFirstYear` clamps a start year
in the past up to the current one, so every start age gives the same first year and the same ages in
it. The note named a control that could not change what it was describing.

Split the `bothMedicare` branch on whether Medicare age is already past THIS year, computed from
`planFirstYear(by1, 0)` - the clamp's own floor - so there is no second age calculation beside the
shared one. Already past: greyed and silent, per the instruction. Start age is what carries them
over: unchanged, because there lowering it genuinely helps.

Verified on five profiles: both 65+ today -> greyed, silent; both under 65 with start 70 -> greyed,
note shown; one on Medicare -> not greyed; single 65+ today -> greyed, silent; single under 65 with
start 70 -> greyed, note shown. Four in-page assertions. Badge 864, node 367/61/22.

**Bumped the version AFTER editing this time**, and checked `runTests.toString()` and
`updateACAWarning.toString()` both contained the new code before believing the green badge. The hour
had not rolled, so the stamp is still 11.16ab and the browser needed an explicit
`fetch(url, {cache:'reload'})` on the exact `?v=` URLs.

**Recorded tradeoff:** the `bothMedicare` branch carried a comment saying it was deliberately NOT
gated on the selection, so that a user who cannot pick an ACA row could still learn why. The
already-past-65 case now loses that explanation. If greyed-with-no-reason reads badly, the answer is
a short statement of fact with no advice in it, not the old sentence back.

## 2026-08-29 (cont.) - P92e DONE: the Limit menu reads on both ladders, v11.16af

Node **371 / 61 / 22**, browser badge green at **924** (470 in-page + 454 node), zero unsafe skips,
bundle freshness checked before believing it.

**The base-year defect the user spotted was real and is fixed first.** `TAX_DATA_BASE_YEAR` was
hardcoded `2025` while `TAXData.FEDERAL.YEAR` and `TAXData.IRMAA.YEAR` both say `2026`, so the menu
compounded one extra year of CPI over tables that were already current: `$217,319` where the engine
built the same plan's ceiling on `$211,400`. It now reads the year off the data. Verified against
`findLimitByRate('FEDERAL', status, rate, 1)` for every federal entry, in a test.

**The ACA rows were off by the same year plus one more.** They compounded
`currentYear - FPL_BASE_YEAR + 1`, which is two years where the federal rows took one. Measured
against the engine's own ACA formula before changing anything: a 2026 plan targets $84,049 where the
menu offered $86,403. They now mirror the engine exactly, `cpiAdj * (1 + cpi)`.

**Deduction source, as planned:** `-fedDeduction` off the plan's first year, divided by that year's
`-cpiFactor`. That divisor is load-bearing and the plan was right to flag it: `sim.cpiRate` does NOT
open at 1, it compounds from the table year to the plan's FIRST year, so a plan starting 2035 logs a
deduction inflated 28%. Measured (`cpiFactorY0` 1.282 on a 2035 plan, 1 on a 2026 one).

**Sorting on the comparable axis was tried and REVERTED, and the reason is worth keeping.** The raw
sort puts `24% Fed - $404k` above `IRMAA Tier 3 - $410k` while its real ceiling ($435,750 MAGI) is
below Tier 3 - the inversion I flagged when scoping. Fixing it re-sorts `10% Fed - $24.8k` to sit
between the $63k and $84k ACA rows, because its MAGI equivalent is $57k, and a visible column
reading 42k, 52.5k, 63k, 24.8k, 84k looks broken on sight, on every load. Traded a subtle wrong
ordering for an obvious-looking one; took the subtle one and let the annotation and the ladder carry
the truth. Recorded in a code comment so it is not re-attempted.

**The ladder is a picture, per instruction, and had three defects found by looking at it:**
- The IRMAA table's first row is a `-none-` sentinel one dollar below Tier 1, not a tier. Drawing it
  as one produced a $1 sliver and shifted every tier label by one - the row read `none T2 T4`.
- Inside a 245px sidebar that clips its overflow the SVG was either illegible or scrolled sideways.
  Now `position:fixed`, placed under the dropdown and clamped to the viewport, same as
  `#touch-tooltip`. Clamping only the bottom put it off the TOP of the window when the page was
  scrolled; both ends now.
- **User-reported mid-build: no obvious way to dismiss it.** It opens away from the link that opened
  it, so "click Show me again" is not discoverable. It now has a titled header with `close ✕`,
  dismisses on a click outside (the share panel's pattern) and on Escape, and the link itself reads
  `Hide ▾` while open. Four routes, all verified.

**Two old tests broke and both were parsing the label text** - the exact practice this phase removed
from `updateBracketFeedback()`. The reference-entry checks read `$769,001` out of the label to prove
the "+1 dollar" relation; at 3 significant figures that is `$769k` on both sides. Re-pointed at
`data-limit`. The trailing-`+` check now looks for the `+` against the amount, since the label
continues past it.

**Formatter:** `DisplayHelpers.formatDollarShort`, 3 significant figures with k/M/B. Deliberately NOT
`compactNum`, which is a lossless share-URL compressor that renders 100000 as `1e5`. Four node tests
including the carry cases (999,500 -> $1M, 999,999,999 -> $1B) and that it never emits an exponent.
First version blew the stack on a billion by recursing to carry; the unit search also ran backwards
and called a billion "k". Both caught by probing the output rather than reasoning about it.

## 2026-08-30 - P97: the limit warning blamed spending for RMDs, v11.16b0

User-reported on a shared URL, and their own diagnosis was right. On that plan - $4M across two IRAs,
IRMAA Tier 1, TX, person 1 dying 2046 - **all 15 flagged years have `IRAwd` = 0, `ForcedIRA` = 0 and
`rothConv` = 0**. The plan draws nothing beyond its required distribution and is over anyway: by 2061
an RMD of **$455,636** against a Tier 1 ceiling of **$370,371**, every flagged year a SGL survivor
year after the first death halves both ladders. P92c's warning said "The plan withdraws past it to
pay for spending... Lower the Spend Goal" - advice that cannot work, on the one screen whose job is
to explain the number above it.

`BracketOverage` conflates two causes that take OPPOSITE advice, and the fix is to tell them apart:
spending you can lower, against required income you cannot. `limitWarningText()` is now a pure
function so the classification is testable on rows instead of by driving the page.

**The test is exact rather than estimated, and the reason matters:** `IRAwd` is the voluntary draw
plus conversion gross (`optimizer_core.js:1067`) and `ForcedIRA` is the third pass's draw, so a year
with neither is a year in which the plan chose nothing that could have put it over. The estimate I
first considered - subtract the draws from MAGI and see whether it still clears the ceiling - errs in
the UNSAFE direction, because IRA income also raises the taxable share of Social Security, so
removing it takes more out of MAGI than the draw itself and years would be called structural that
were not.

**Found while checking the other branch:** the plain 12% default plan reported "22 of 25 years" as one
count and blamed spending for all of it. **6 of those 22 were structural.** Both counts are now
reported separately.

Suites 371/61/22; badge 934 (480 in-page + 454 node), zero unsafe skips, bundle freshness checked.

**Version-stamp gotcha, cost one wrong number:** my usual one-liner uses
`Math.floor((now - Dec31)/864e5)` for the day of year, and across the PST-to-PDT boundary that is
241.96 days on 30 August - floor 241, one day short. `Math.round` is correct. It only shows up when
the run crosses midnight, which this one did.

## 2026-08-30 (cont.) - PR #203 opened; P87g retracted, P87c measured

**PR:** https://github.com/nightskyguy/retirement_assets/pull/203 - 10 commits, v11.16aa through
v11.16b0. Node 371/61/22, badge 934. Flagged two things for the reviewer in the PR body: the
changelog entry is ~1,000 words against the ~150 target, and `.test_harnesses/` still names the
removed `minlimit` on purpose.

**I was wrong about P87g and the user caught it.** I had repeated P87a section 7's heading - "nothing
sizes a conversion against the ceiling at all" - as a claim about the mechanism, and used it to call
P87g the largest remaining gap. The user said the conversion ceiling IS the limit for bracket
strategies. Measured: MAGI lands on `BracketTarget` to the dollar and the conversion is its residual
after spending. They were right. Corrected in the report, its index row, and the task plan
(`b381b7a`), leaving the original measurement tables untouched and changing only the claims drawn
from them.

**The challenge is what found the real defect.** Looking at that same run properly: the plan reaches
its ceiling every year until Social Security starts and never again, and `short / SSincome` is
**0.150000** - min equal to max - in every affected year, on federal brackets and IRMAA tiers alike.
$168,500 of headroom never used on one $2.8M fixture at Fill Bracket 22%. That is P87c: the sizing
aggregate subtracts the FULL benefit while at most 85% reaches MAGI. Same shape as the deduction
error P92a fixed, and not fixed by it. Harness `.test_harnesses/underfill_harness.js`, write-up in
`research/BRACKET_CEILING_BASIS.md` section 9 (`8260929`).

**Two process notes worth carrying forward.** Separating the regimes was the whole difficulty: a raw
shortfall table shows a drained IRA ($170k-$390k short, not a defect) beside the real anomaly
($2.5k-$12.6k short with millions still in the IRA), and together they look like noise. And a wrong
statement of mine - "2031 is before that plan's SS starts" - nearly sent this after the wrong
mechanism; person 2 claims at 67 in 2031 and I had checked only person 1.

**Next round: P87c**, at the user's direction. It is the strongest O0 candidate - measured, still
shipped, known mechanism, bounded cost, and the fix is the move P92a already made in the neighbouring
place: size against the taxable share of the benefit rather than the gross.

## 2026-08-31 - P98: a self-check that measured run order, not the menu

**User report:** v11.16b0 showed `Documentation ❌ tests failed` on load, one assertion, and
**"oddly, it doesn't report this failure when using `?runtests`."** That second sentence is the whole
diagnosis - a check whose verdict depends on a URL flag is not testing what it says it tests.

`dropdownLimitsMatchTheEngine` read `#stratRate` live, but `runTests()` is called at top level from
`retirement_optimizer.html`, before the `DOMContentLoaded` handler fills that control. It was reading
the markup placeholder - a lone `<option value="24">` with no `data-limit` - so `Number(undefined)`
went up against the engine's `403550`. Exactly one failure, and `24%` only because that is the value
the placeholder carries. Nothing in the menu, the builder or the engine was wrong.

`?runtests` was green by accident: `acaOptionsUngated` sits earlier in the file, is gated behind that
flag, and calls `refreshStratRateOptions()`, which builds the real list before the check reaches it.
The parse-time trap is already spelled out in that suite's own comment at `optimizer_tests.js:2205`;
this later check did not inherit it.

**Fix:** build a detached copy from `generateStratRateOptions()`. The builder is pure, so the check
is now about the builder rather than about when the suite ran, and it needs no `unsafeTest()` gate.
On load it goes from 1 assertion to 6 (fed rates 10/12/22/24/32/35; 37 skipped, `l` is the Infinity
sentinel).

**Verified in the browser, not inferred:** on load 753 passed / 0 failed (302 in-page + 451 node);
with `?runtests` 934 / 0 (480 + 454). Node suites 371/61/22 unchanged. `TestTiers.EXPECTED` pins node
counts only, so the in-page +5 needed no reconciliation.

**Changelog wording corrected by the user.** I first wrote "the dot beside the version number turned
red". The badge is `<strong id="testsFailed">` inside the Documentation tab BUTTON
(`retirement_optimizer.html:539`), so what a reader actually sees is `Documentation ❌ tests
failed`. Entry and heading now say that. Worth carrying: describe a symptom by where the user's eye
lands, not by where the element lives in the DOM.

**Two process notes.** The preview server had to be restarted on a fresh port - the browser served a
cached copy of the HTML and kept showing the old `<title>`, so the first "fix verified" read would
have been a lie. And `serve.py` swallows `--help` and just starts serving, which is how a server
ended up registered before I meant to start one.

v11.16b0 -> v11.16cf (title + `optimizer_tests.js` cache token; the tier-2 loader's `V` left alone,
none of its five suites changed). Commit `92f2d1e` on `worktrees/optimizer-menu-limit-test-04e131`,
pushed. No PR opened.

**Next round is still P87c** - unchanged by this. P98 was an interrupt, not a re-prioritization.

## 2026-08-31 (cont.) - P87c: the ceiling now counts the benefit the way the tax does

**Shipped v11.16d4.** A federal-bracket or IRMAA ceiling is spent against MAGI, which carries at most
85% of a Social Security benefit. The sizing aggregate subtracted the FULL benefit, so every plan on
a chosen limit stopped exactly 15% of its benefit short of it, every year the benefit was paid.
`nonSSIncomeForMAGI` (`taxengine.js`) now inverts the MAGI relation and the room is solved for
instead of estimated. ACA keeps the full benefit, because its own MAGI counts it.

**Verified in the browser, not inferred.** Plain load and `?runtests` both green: 956 tests (498
in-page + 458 node), 0 failed. Running the original defect fixture through the shipped page's own
`simulate` returns `short/SS` of exactly 0 on Fill 22%, Fill 24% and IRMAA Tier 1, against 0.150000
before. Suites **375**/61/22; `TestTiers.EXPECTED` and `.githooks/README.md` both reconciled.

**THE USER OVERTURNED A CLAIM MID-ROUND, AND THE CORRECTION IMPROVED THE WORK.** I wrote that a flat
`0.85 x SS` subtraction would OVERSHOOT the ceiling in the low tiers. It cannot: 85% is the MAXIMUM
taxable share, so assuming it is the conservative assumption, and `MAGI = (L - 0.85 SS) + taxableSS
<= L` in every tier. Their framing - start at 85% and raise the ceiling only where the share is
demonstrably lower - is exactly what the shipped inversion does, stated procedurally. Corrected in
`findings.md` in place, with the wrong claim quoted rather than deleted, since it is the reason the
phase measured three arms instead of arguing about two.

**The measurement is what settled it, not the argument.** `ssbasis_harness.js` found 96.3% of
ceiling-bound years pinned at the 85% cap and 3.6% sloped, all on `Fed 10%` / `Fed 12%`. Then
`ssbasis_arms_harness.js` ran three arms over 720 cells: OFF left 1,670 years under-filled and
$16.8M unused, `flat85` left 144 and $3.6M, `exact` left **zero**. `exact` also breached LESS than
the shipped code ($2.4473B vs $2.4669B), ended richer and paid less tax, so there was no trade to
make and no reason to keep the flag. Shipped unconditionally, `P92a` precedent.

**Bisection over a closed form, deliberately.** The four segments are solvable by hand. That was
rejected because it would be a second source of truth for the SS split, free to drift from the
function charging the tax - the failure mode `P92a` named for the deduction. The shipped inverse
CALLS `calculateTaxableSocialSecurity` and leans only on monotonicity.

**Three process notes worth carrying.**

- **The breach test took three drafts, and each wrong one was informative.** Draft 1 used the phase
  fixture unchanged and reported 17 breached years that were surplus conversions. Draft 2 turned
  conversions off and cut the spend goal, and reported **the same 17 years to the dollar** - an
  unchanged number after a change that should have moved it is the tell; the household was 74 with a
  $3M IRA and the RMD alone cleared the ceiling. Draft 3 excludes RMD years outright.
- **`nYears` does not bound a run.** The draft-2 fixture set `nYears: 10` and returned 27 rows ending
  at the death year. Anything reasoning about a horizon has to filter on what it actually means.
- **`serve.py --help` starts a server**, which my own note from 2026-08-31 already said and which I
  did anyway, burning a two-minute timeout. Use `preview_start` with a `launch.json` entry.

**`P32h` moved for the seventh time**, and only in size: total stranded 29,367.55 -> 24,836.15,
Brokerage headline 1,016,150.36 -> 1,000,311.35, count still 10 and still 2040-2049. The arm draws
its headroom earlier and reaches the stranded tail with less unfunded. Re-pinned with the reason.

**Bookkeeping fixed at the top of the round:** the NOW table still carried a struck-out `P92` row as
its only O0 and did not list `P87c` at all, while `progress.md` had named it next for two sessions.
`P87` now holds that row. Next item in the phase is **`P87d`** - the ACA overage reads low because
`tax.MAGI` has no non-taxable-SS add-back - which the target/cap split makes the one that matters
most for the only ceiling whose job is to stay UNDER.

## 2026-08-31 (cont.) - backlog cleanup, Phased to O1, and the 40/60 closed

**User instruction:** stop carrying work nobody is doing; move Phased to O1; confirm whether
"Roth before Brokerage" already answers P28; and put the `[40,60]` to bed permanently.

**P28: the user was right, and it was pure bookkeeping.** `P28f`/`g`/`h` shipped 2026-08-24 in
v11.162B - the *Roth before Brokerage* switch plus the 🅡 clone pass in `buildStrategyFamilies` -
and the section's own Status line already said "Nothing else in P28 is open." The three boxes were
still unchecked, so the plan read as open work that had shipped a week earlier. Only `P28j` remains
and it is a DIFFERENT question (withdrawal timing keying off `rothConv`, and the bare `1000`).

**The 40/60 is closed in a new `P30i`, and the close is a reframe rather than an answer.** Three
studies asked which weight is right: `P30b` (w=40 best in 0 of 82 clean cells), `P30c` (bracket
branch's Cash-first is right, 21 of 23) and `P30h` (w=40 wins ZERO cells on all seven objectives,
every winner an endpoint, objectives split 3-3). **A fourth sweep would re-derive the same thing.**
The question is being asked as a measurement when it is a policy choice. `P30a` already shipped
`gapFillWeights` as a validated input with verified monotone endpoints, so the close is to LABEL it -
three positions (Cash first / Blend / Brokerage first), default unchanged so every saved plan
reproduces, `P30h`'s 3-3 split as the tooltip. Rule recorded: `[40,60]` is not to be re-swept;
reopening needs a new question, and the only two are `conveffect` and `breakeven`.

**Phased to O1**, leaving `P87` the sole O0. Recorded WHY on the row: Phased cannot land on the
"ideal" withdrawal strategy while the optimization questions behind it are open - `P36` round 2 is
literally `P35`'s PR 7, and `P75` is the year-by-year mix study that defines what "ideal" would mean.
Building `P35i` first would ship an engine whose target is not yet defined.

**The cleanup, in numbers.** 34 stale boxes closed under phases their own status called shipped -
`P84a`-`P84o` (v11.168c/d; confirmed against the `P84l` comment live in `optimizer_core.js`, not from
the Status line, which was stale and still read "filed, not started"), `P23a`-`P23l` (COMPLETE,
shipped differently from the spec), `P28f`/`g`/`h`, `P92b` (answered when `P94` removed `minlimit`),
`P92d`, `P24g`, `P32j`, `P91a-old`. Then **29 never-started phases moved to `task_parked.md`** -
every one `pending` / `not started` / `deferred` / `unprioritized`, none named as a blocker by a live
O0 or O1. **Nothing deleted, sections verbatim, IDs unchanged so cross-references still resolve.**

Open boxes **210 -> 52**, across **41 phases -> 12**. `task_plan.md` 6,998 -> 5,739 lines.

**One item was rescued rather than parked.** `P91d` sat inside a DONE phase: the Monte Carlo controls
are in neither the saved scenario nor the share URL, so paths, seed and stress window reset on every
load and cannot be shared. That is a real gap, not a plan, and it was about to be invisible. Marked
as the one live item in an otherwise finished phase.

**Kept live deliberately:** `P72` (the year-0 RMD basis in `P72k` is a known correctness gap) and
`P19` (state coverage - 13 uncoded jurisdictions the README's own Tax Torpedo table names).

## 2026-08-31 (cont.) - P100 written up as a staged investigation

**User asked for the whole Optimizer-ranking discussion as one phase, ordered by code dependency and
by bang for the buck.** Written as `P100`, six gated stages, 16 items, now the second O0 row.

**The instability was TRACED, not theorized, and that is what makes the phase buildable.** Four
links: `_convSavings` exists only on `⇌` rows (`optimizer_ui.js:1546`); `conveffect` ranks on
`_convSavings ?? -Infinity` (`optimizer_core.js:4357`), so a row with no twin is dumped BELOW every
row that has one; only 12 rows get a twin (`selectConversionCandidates(results, 12)`,
`optimizer_ui.js:1438`); and the pool is chosen by `_baselineScore`, computed with
`sharedFutureIRARate = base.futureIRATaxRate ?? results[0].totals.futureIRARate`
(`optimizer_ui.js:1428`). Change the user's own plan and the pool membership changes, so 105th to
24th is a SET DIFFERENCE, not a scoring wobble.

**The user's own workaround turned out to be the design.** They described picking a row at 85th with
higher net worth AND higher final Roth for a slightly later break-even - which is Pareto reasoning
done by hand. So Stage D computes the non-dominated set instead of asking anyone to weight five
objectives. **A weighted blend is explicitly rejected in the phase**: it replaces one choice with
five, and the weights are undefendable.

**Five predictions stated before the harness exists** (`H1`-`H5`), per the `P87a`/`P30b` convention.
`H4` ("more than 50% of rows are dominated") and `H5` ("the hand-picked row is on the frontier, the
nominal winner is not") are the GATE on Stage D: if the frontier is 80 rows wide it is not a
simplification and the phase stops after Stage C.

**Ordering rationale, since the user asked for it explicitly.** Stage A characterizes and must be
first because nothing after it is verifiable otherwise - and `P100a1` needs the USER'S scenario, not
an invented one. Stage B is three live defects that need no engine change and are each shippable
alone; `P100b1` (persist the objective) is the highest payoff per line in the phase, and `P100b3`
(stop ranking rows nobody evaluated) is the single biggest reduction in the confusion reported,
because ~114 of ~126 rows are currently ordered on a value never computed for them. Stage C fixes
the metric the user says is measuring the wrong thing. Stage D is the payoff. Stage E is gated on
`P34`, which is why the phase recommends `P34` to O0 if accepted.

**Rejections recorded in the phase so they are not re-derived:** weighted blend; objective-as-strategy
(the user's option B - it crosses 9 objectives x 12 strategies into 108 menu entries); pick-one-and-fix
(option C, right for the default only); and `P30i`'s three-position gap-fill control, superseded by
`P100e2` because it was one more knob.

**Blocked on the user for `P100a1`:** the actual scenario where their plan sits at 105th.

**NOW table bookkeeping:** adding the `P100` row would have pushed the LINE-30 marker to 31, so a
wrapped two-line paragraph below the table was joined into one. Content identical, marker still on 30.

## 2026-08-31 (cont.) - P100 Stage A: reproduced, and it refuted my own hypothesis

**Reproduced exactly on the user's own scenario** (`.test_harnesses/fixtures_rankstability.local.json` (gitignored - real personal data, public repo), saved
from their file, not invented): plan at **103rd** under `Roth Conversion Effectiveness`; adopt
`IRA Draw 9%`; re-run; the IRMAA Tier 2 plan comes back at **20th**. User reported 103 and 22.

**H1, H2 and H3 - the pool-churn story I wrote into the phase yesterday - are REFUTED.** The pool is
byte-identical across both runs (same 3 labels) and `sharedFutureIRARate` is 0.12 both times. I had
read the code, found a plausible chain, and written it up as the mechanism. The measurement did not
support it. **The real cause is one link earlier in the same chain and much simpler.**

**Only 3 of 136 successful rows are ever evaluated for that objective.** `_convSavings` is written
only on `⇌` rows; `conveffect` ranks on `_convSavings ?? -Infinity`; so **133 rows are mutually tied**
and - verified directly, `tieOrderIsArrayOrder: true` - displayed in INPUT-ARRAY ORDER. "Rank 103"
means "position 100 of 133 rows that all scored identically." The plan moved 103 -> 20 **with nothing
about it re-measured**: no `_convSavings` either time. It moved because it stopped being the pinned
current-plan row and became an ordinary swept row, which is a different array position.

**A second finding that kills the obvious fix.** Raising the pool cap does not close the tie: 9 of
the 12 candidates returned `optConv === 0` and produced no row at all, so a bigger pool yields more
evaluated rows, never a complete table. `P100e1` is therefore not the answer to this defect either.

**Consequence for the phase.** `P100b3` (stop ranking unevaluated rows) is promoted to the primary
fix of the whole phase - it is a comparator and display change, no engine work, and on this scenario
it converts a dishonest 136-row ranking into an honest 3-row one with 133 rows plainly marked
unmeasured. `P100b2` (the `results[0]` rate fallback) stays worth fixing as a fragility but is
explicitly NOT this defect.

**Report:** `research/OPTIMIZER_RANK_STABILITY.md`, indexed in `research/README.md` the same commit.
Row count is **152**, not the ~126 I had been quoting from `P30e`'s older capture.

**Process note worth carrying: I wrote a mechanism into the plan from a code read and it was wrong.**
The chain was real - every link exists - but the defect fires before it. Writing H1-H3 down first is
what made the refutation cheap and visible; had they been left implicit I would have "confirmed" the
pool story by finding the pool code and stopping there. Predictions stated up front are worth most
when they fail.

## 2026-08-31 (cont.) - P100b1 shipped, P100a3 measured

**`P100b1` SHIPPED v11.16d5.** The "Optimize for" goal now travels with the plan. Four sites, all
following the `propTax` precedent for a field with no engine input to ride in: seeded from `?obj=` at
the `OptimizerState` declaration (not in an init hook - `renderOptimizerTable` and the anchor-baseline
pick both read it before one would run), emitted by `buildShareURL` only when non-default so existing
links are byte-identical, saved as `optObjective` **beside** `getInputs()` rather than inside it (that
object feeds `simulate()` and the MC cache hash; a ranking preference must not change either),
restored by `applyScenario`, and `setOptObjective` now writes the `<select>` back - a control showing
one goal while the table is ranked by another is worse than not restoring it.

Verified in the browser on both loads: `?runtests&obj=mintax` gives **960 / 0** (502 in-page + 458
node) with the state AND the selector on `mintax`; a plain load gives 766 / 0 and `taxflex`. Node
suites 375/61/22 unchanged, so `TestTiers.EXPECTED` needed no edit - it pins node counts only, and
the in-page suite grew by 4.

**`P100a3` measured. `H4` CONFIRMED, `H5` SPLIT.**

| metric set | dominated | frontier | % |
|---|---:|---:|---:|
| NW + Roth | 118 | 18 | 86.8% |
| NW + Roth + tax | 109 | 27 | 80.1% |
| NW + Roth + spend + tax | 90 | 46 | 66.2% |
| + break-even | 84 | 52 | 61.8% |

`H4` predicted ">50% dominated" and every metric set clears it. **`H5` splits:** the user's
hand-picked plan IS non-dominated, but so is the `conveffect` winner - **that clause is refuted, and
it matters.** The objective never picked a bad plan; it just said nothing about the other 133 rows.
The defect was always silence, not a wrong answer.

**The finding that shapes Stage D: the metric SET is the knob.** 18 rows on two metrics, 52 on five.
"Show the frontier" moves the choice from *which objective* to *which metrics count* rather than
removing it, and the phase now says so instead of implying the trade disappeared. It is still much
weaker - metrics are columns the table already prints, and widening the set is monotone safe (a row
on the frontier for a set stays on it for any superset). Recommended default is the four core
metrics: 46 of 136, a 3x cut, **honestly not "a handful"**, which is how I had been describing it.

Break-even is deliberately excluded from the default: 133 of these rows have no break-even year, so
including it mostly measures whether a row was ever evaluated - Part 1's defect leaking into a second
place.

**Two cheap properties to pin as tests when Stage D builds:** the argmax of any reported metric is
never dominated (so suppression can never hide an objective's winner - this is the safety argument
for defaulting it on), and widening the metric set only ever grows the frontier.

Report: `research/OPTIMIZER_RANK_STABILITY.md` Part 2, index row updated.

## 2026-08-31 (cont.) - user challenge reshapes P100b3; the "mark it" answer was half an answer

**User:** *"What's the point of marking unevaluated rows? Wouldn't a better strategy be to evaluate
all rows using perhaps a second generic system (e.g. Net Wealth) so that there is still some meaning
to the ordering?"* **Correct, and `P100b3` is rewritten around it.** Marking is honest but leaves 133
of 136 rows ungraded, which does not help anyone CHOOSE - a table that refuses to order itself has
swapped one problem for another.

**Measuring the challenge turned up a fact neither of us had.** The 133 unranked rows are TWO groups,
not one: **9 were fully evaluated and came back "conversions do not pay" - a measured $0 that the
code discards** (`continue` on `optConv === 0` never records it) - and only 124 are genuinely unknown.
Recording those zeros takes the graded set from 3 to 12 for free. Blank currently means both
"measured, the answer is nothing" and "never asked", which are different facts.

**Cost of the obviously-right answer, measured rather than asserted:** base sweep 1,535 ms; with the
pool of 12, 6,238 ms; **392 ms per candidate**; **all 136 projects to ~55 seconds**. That is the real
reason the cap exists and the concrete case for `P34` - a number, not a preference for a smaller
table.

**Revised design: two-key ordering, NOT a blended score.** Evaluated rows by effectiveness, then the
rest by net wealth and labelled as such. A single blended number is rejected because conversion
savings top out at $2.28M here while net wealth runs ~$10M - a naive blend sorts by scale and "rank
40" would silently mean "40th by net wealth" under a column headed effectiveness, a new lie replacing
the old one.

**And it fixes the instability, which marking alone would not have.** A row's net wealth does not
move when the user adopts a recommendation. **New hard dependency recorded:** that holds only once
`P100b2` lands, because `afterTaxNWCurrentDollars` reads `sharedFutureIRARate`, which falls back to
`results[0]` when the heirs rate is unset - measured identical (0.12) across both runs, but an
observation, not a guarantee. `P100b2` must ship with or before `P100b3`.

**Process note.** This is the second time in two days that a user challenge to a conclusion I had
already written into the plan produced a better design (the first was the flat-0.85 correction in
`P87c`). Both times the fix was to MEASURE the challenge rather than defend the position, and both
times the measurement turned up a fact that neither the challenge nor the original had.

`research/OPTIMIZER_RANK_STABILITY.md` Part 3; index row updated.

## 2026-08-31 (cont.) - the priority-list proposal, named and measured

**User generalized the fallback into a priority list over every metric** ("first by conversion tax
savings, second by final Roth, third by break even, fourth by net wealth..."). Adopted; it supersedes
the two-key ordering, which was the 2-level case of it.

**Named precisely, because the phase now uses both and they are different tools.** This is
LEXICOGRAPHIC ordering. **Pareto FILTERS** (drops rows beaten on every metric, 136 -> 46) and returns
a set with no order; **lexicographic ORDERS** and filters nothing. They compose in that order.

**The failure mode, measured before endorsing it.** A tie-break fires only when the higher key ties,
and continuous dollar metrics essentially never do. Distinct values in 133 rows: net wealth **118**,
lifetime tax 117, remaining IRA 102, final Roth 78, spend 39, break-even 15 (+67 missing). **With net
wealth leading, priorities 2-8 would decide 15 rows** - an eight-level list would be seven levels of
decoration.

**Tolerance bands rescue it, and the number is good.** At a band of 1% of the metric's range:
39 groups, **priority 2 decides 118 of 133 rows**, top group **10 plans**. That top group is exactly
the shortlist the user was assembling by hand. 0.5% -> 108 rows; 5% -> 130 rows but the top group
swells to 34.

**Two per-metric facts worth encoding once.** `spend` collapses to 3 groups at EVERY band (nearly
every plan funds the same goal) - a poor leading key, a good late tie-break. `breakEven` is an
integer year, heavy ties, and missing on 67 rows.

**New sub-item `P100b3c`, and it is a maintenance argument rather than a design one.** Nine
objectives x eight metrics is 72 ordering decisions to author and defend - the kind of table that
rots. One shared default order, per-objective overrides of the leading metric or two only.

**What does NOT change:** the evaluated / not-evaluated partition survives, because lexicographic
cannot order rows on a key they do not have and `conveffect`'s leading key exists for 12 rows of 136.
`P100b3a` (record the zeros) is still needed. And a single blended score stays rejected.

Report: `research/OPTIMIZER_RANK_STABILITY.md` Part 4; findings and index updated.

## 2026-08-31 (cont.) - P101 opened: worked examples served from the site

**User:** *"Maintaining a list of worked examples that can be loaded from the server via Load. For
that each example will also need a notes/description."* Filed as `P101`, O2, not started.

**The origin is the argument.** The scenario that reproduced `P100` was a worked example from a
YouTuber's video. Two things followed: nothing in the tool could load it except a manual import, and
it could not be committed, because it arrived under a real surname and this repo is public. A curated
set fixes both - examples are publishable by construction and they ship with the tool.

**The under-sold benefit: it is a test corpus.** Every example is a regression fixture. `P100` needed
exactly that and had to settle for a gitignored local file, so its reproduction cannot be re-run by
anyone else or by CI.

**Four design facts worth having before anyone starts.**

- **The directory must not start with an underscore.** This site is served by Jekyll (`_includes/`
  exists), which treats `_`-prefixed directories as source and does not publish them. `examples/`.
- **A manifest is required** - GitHub Pages serves no directory index, so the page cannot discover
  files. `examples/index.json`, with the notes IN THE MANIFEST so the scenario files stay plain
  `saveScenario` output and nothing new has to thread through `getInputs`, the URL or the version
  check.
- **`SCENARIO_VERSION` is the rot risk and it is not hypothetical.** It is 4, and `loadScenario`
  filters on EXACT equality (`optimizer_ui.js:5598`), so every shipped example dies silently at the
  next schema bump. Mitigation is a TEST (`P101b`), not discipline: a stale example must fail the
  build rather than the user.
- **Attribution and privacy are requirements, not courtesies.** An example reproducing published
  material names and links its source, does not use anyone's name as an identifier, and says it is a
  reconstruction. A real private user's plan never qualifies - which is what the `*.local.json`
  gitignore rule added earlier today is for.

Three open questions recorded rather than guessed: whether loading also switches tab or auto-runs;
whether an example needs anything extra to be shareable (probably not - the `?`-URL carries the
inputs); and what marks a loaded example on screen so it is not mistaken for the user's own plan.

## 2026-08-31 (cont.) - P100b3b/b3c SHIPPED v11.16d6: secondary ranking

**User approved option C**: one shared default chain, plus a `conveffect` override in their own
priority order. Shipped as `OPT_TIEBREAK_KEYS` + `OPT_TIEBREAK_DEFAULT` in `optimizer_core.js`, with
an optional `tiebreak` array on any objective.

- **Default:** net wealth, final Roth, spend, lifetime tax, remaining IRA, break-even, then `_id`.
- **`conveffect` override (the user's order):** final Roth, break-even, net wealth, remaining IRA,
  account spread, lifetime tax, spend.
- **`taxflex` and `earliestbe` untouched** - custom rankers with their own tie handling; a blanket
  re-sort would undo what makes them custom.

**Verified on the user's own scenario, and this is the number that matters.** Run the sweep, adopt
`IRA Draw 9%`, run again: **151 of 152 rows are common to both runs and their relative order is
IDENTICAL - zero positions differ.** Only the current-plan row changes, which it should. Under
v11.16d4 the same action moved a row from 103rd to 20th. The top of the table now reads: three
measured `⇌` rows, then the rest ordered by final Roth (20.4M, 20.2M, 20.2M...) instead of by array
position.

**EXACT ties only; tolerance bands are NOT built.** That is the remaining half of `b3b` and it is
not the urgent half here - `conveffect`'s 133 rows tie exactly, so the chain fires on all of them.
Bands matter for objectives whose leading metric already discriminates (net wealth has 118 distinct
values in 133 rows).

**A test caught a real weakness rather than confirming the design.** `_id` was inside the subtracting
chain, so a non-numeric id produced `NaN`, which is falsy, and the total-order guarantee silently
evaporated - re-introducing array-order ranking one level down, invisibly. Now compared with `<`/`>`
outside the chain. The test that found it ranked rows keyed `'x'/'y'/'z'`. Worth carrying: a
comparator built on subtraction is only total for numbers, and "the ids are always numeric" is an
assumption a fixture can break without anyone noticing.

Suites **382**/61/22; `TestTiers.EXPECTED` and `.githooks/README.md` reconciled. Seven new node tests,
including two that discriminate the default from the override by ranking the SAME rows both ways.

## 2026-08-31 (cont.) - user correction: perf claims need a target machine, not a percentage

**User:** *"the user running this tool may have a much slower system than what is being tested on, so
efficiency does matter."* Right, and it corrects the SHAPE of my argument rather than one number.

**The reference machine is an AMD Ryzen AI 9 HX 370** - 12c/24t, a 2025 flagship - and I never said
so beside any timing. Scaled by single-core speed (the sweep is single-threaded, which is what
`P34`'s worker item is for): the 6.2 s sweep becomes **12.5 s at 2x, 21.8 s at 3.5x, 37.4 s at 6x,
62.4 s at 10x**. The audience is people planning retirement, so a ten-year-old laptop is an ordinary
machine. At 22 to 62 seconds a user concludes the page has hung.

**The reasoning error, stated plainly so it is not repeated.** "0.02% of the sweep" is
machine-INVARIANT and stays true at every tier - which is exactly what makes it seductive. It is not
a verdict on its own. It becomes one only after the ABSOLUTE total is shown acceptable on the slowest
machine that matters. I used the ratio to mean "not worth caring about", and that inference does not
survive a device where the thing it is a percentage of has become unusable.

**Where it points, and it is NOT the bisection I just changed.** `nonSSIncomeForMAGI` is 0.021% of
the sweep at every tier - 13 ms even at 10x. **The conversion search is 75.4%**, also at every tier.
So the whole slow-machine problem is `P34`, and this finally gives that phase the target it was
missing: not "make it faster" but **a sweep that stays usable at 3.5x to 6x slower single-core
speed**. A sweep under ~10 s at 3.5x implies under ~3 s at reference, which is a 2x cut and a number
to profile against.

Recorded in `findings.md`, in the `P34` phase as a target section, on the NOW-table row, and saved to
memory as a standing rule (state the reference machine; give the absolute on a slow target; scale by
SINGLE-core speed for browser tools).

**I have NOT re-prioritized `P34`** - it sits at O1. There are now two independent arguments for O0:
it gates `P100` Stage E, and it is the entire slow-machine story. That is the user's call.

## 2026-09-01 - P102 Stage B SHIPPED (v11.16d7) and P103 opened at O0

*Backfilled 2026-09-01 from commit `effb35d`, which updated `task_plan.md` only. This session log
and `findings.md` had no entry for the day.*

**P102 Stage B: a goal-first panel, gated at `?nerdknob=goal`.** An ADDITIVE alternative surface
above the Withdrawal Strategy box. It drives the classic controls through their own shipped adopt
paths and owns no values of its own, so it never reaches `getInputs()`, a share URL or a saved
scenario; turning the gate off leaves the sidebar holding exactly the plan the panel built. No
engine change - node suites **382/61/22** byte-identical to `main`.

- Gate is one notch deeper than the plain knob (user: "keep the current work, but make it not
  accidentally findable"). `goalFirstOn() = GOAL_FIRST && NERD_KNOBS`, so the runtime checkbox can
  still hide and force-revert it like every other gated surface.
- **Optimize for** is mirrored from the Optimizer tab; both selects call `setOptObjective()`, which
  writes back to whichever one did not raise it. Options are built from `OPT_OBJECTIVE_ORDER` so the
  two menus cannot drift.
- **Roth conversions: let the tool decide / never.** "never" writes the five conversion controls off
  (restored on the way back) and skips the conversion-optimization pass: default scenario
  **2,395 ms -> 732 ms, 0 rows lost**; $3M IRA **3,231 ms -> 682 ms, 2 rows lost**.
- **"when they stop paying"** became a third position of the Stop-conversions scope menu, adopting
  `_beStopSuggestion` through `applyConvStopYear()` - the same object and function behind the Break
  Even icon, so the two agree by construction. 0 re-applies across further runs.

**Two bugs found by looking, not by tests.** `applyConvStopYear()` writes the scope too, so adopting
through it deselected the position that asked for it (now re-asserted after the apply). And an
edited `optimizer_tests.js` was served from cache because its `?v=` token had not moved, reporting a
green three assertions short. Carry-forward: **a cache token must move with every edit to the file
it names.**

No changelog entry and no `<title>` bump - nothing an ungated user can see or feel.

**P103 opened at O0: "the ceiling, then the rules".** After a verified reading of the perfect-
foresight oracle study (`P51`): the gap is priced (median **4.35%** at default basis, up to 20% under
strain), the per-year plumbing exists on `main` with two named holes (surplus-to-brokerage routing,
total-conversion control), and as previously sequenced almost nothing planned would move a computed
number. `P75` and parked `P5` merge in - `P75d`'s claim that withdrawals do not accept per-year
arrays is FALSE, `oracleWithdrawalPlan` does. `P100` to O1 as SELECTION not RESULT. `P102` Stages
C/D deferred behind `P103d`. `P35` becomes the carrier for whatever rules `P103d`'s regime bake-offs
pick. `P30i` closed. Five stale statements in `P100`/`P34`/`P30i` corrected in place.

**Gate for everything below it is `P103a`**: re-run `oracle_harness.js --full` over the 45-cell grid
on today's engine (~10 min node), re-baseline the gap table with the engine commit named, then
`P51d`, the independent cross-check that gives "lower bound" a size.

## 2026-09-01 (cont.) - P103a DONE: the oracle re-run, and the gap closed by itself

`P103a` was the gate for all of `P103`. Both halves of `oracle_harness.js --full` re-run on engine
`1b7b366`: **45 cells, 418,289 sims, 373.4 s**, suites 382/61/22 green on the same build.
`research/PERFECT_FORESIGHT_ORACLE.md` is now the second run throughout, with a before/after table
so the old numbers are not silently overwritten.

**The headline that opened this phase is gone.** Median best-family gap **4.35% -> 1.58%**;
`defaults3x @4%`, the +$1.078M cell, now measures +$122k. Three fixes shipped between the two
engines all push that way by making the SHIPPED arms better rather than the oracle worse - `P84`,
`P88`, `P87c`. Which one did it is **not measured**; it would need a bisect, and I did not run one.

**The dominant lever flipped** from conversion timing to the **withdrawal split**. The four largest
single gains in the run are all split (+$856k, +$656k, +$519k, +$395k); conversions still dominate
only in the IRA-heavy family.

**`P51d` is closed**, open since 2026-08-10. New harness `.test_harnesses/oracle_crosscheck.js`:
Arm A re-runs the descent in-process, Arm B is a random-restart search with block/shift/scale/swap
moves at $1k grain on the same MEASURED sim budget. Arm B beats Arm A by at most **+0.013%** at 3x
budget and is worse in one cell. So "lower bound" is worth about one part in ten thousand on the
conversion axis - the published gaps are near-tight.

**I wrote the limit of that into the report rather than the headline.** A negative B-A means Arm B
is the weaker searcher, not that the descent is optimal; `X-P3` was WRONG in 3 of 5, so Arm B is
not converged; and the split axis - now the dominant lever - has no cross-check at all. `X-P1`
RIGHT 5/5, `X-P2` WRONG.

**Three numbers in my own first draft were wrong and were caught by re-reading the raw output**,
which is the argument for keeping the run file: I had `round1 @4%` carrying a Proportional gap it
does not have (no eligible row), `defaults3x @4%` marked "not eligible" when it is 7.13%, and an
archetype run counted as eleven Roth years when it is fourteen.

**What it changes downstream, recorded in `task_plan.md`:** `P103d`'s fat regimes are now named by
measurement - the GK-strain cells at 6-8% spend and the b20 arm - and `defaults3x @4%` is off that
list. `P36`'s round-2 certification measures against 1.58%, not 4.35%. `P103b` (the two plumbing
holes) is next; the surplus-routing hole is still why one cyclic row beats the ceiling.

**Rename, user 2026-09-01: `to_aTax` -> `to_brokerage`.** *"the 'a' in 'aTax' doesn't make sense to
me. I believe the point is that excess withdrawals can go to: cash, roth, or taxable (brokerage) -
and the last isn't present."* The `a` was e-ORP's abbreviation for its after-tax account, legible
only to someone who had read e-ORP. Renamed in the reading guide, in the evidence line and in
`P103b`'s acceptance text; the e-ORP original is kept in one parenthetical for traceability.

**The user's three-destination model is right and it corrected the definition.** A year's surplus
does have exactly three homes, and re-reading the engine shows Brokerage is NOT absent: `convertExcessToRoth`
routes IRA-sourced surplus to Roth, `surplusToBrokerage` reinvests Cash Reserve overflow
(`optimizer_core.js:2800`), cyclic banks its harvest there, and the remainder lands in Cash. **The
hole is per-year CHOICE, not the destination** - nothing lets a schedule decide, year by year, to
over-withdraw and bank the excess in Brokerage. `P103b` already scoped it that way; the glossary
entry said "cannot express", which overstated it, and now says what is actually missing.

## 2026-09-01 (cont.) - two user corrections, then P103b1: the grid was confounded

**Correction 1, and it was right.** I wrote that "nothing lets a schedule decide, year by year, to
over-withdraw and bank the excess in Brokerage." User: *"some can: IRA Draw, any bracket with a
limit above required spend, reduce in N years."* Correct - those all over-withdraw by construction,
which is where the surplus in my own probe came from. The missing thing is narrower than I stated:
one `x`, one limit, one `N` for the whole plan, with the year shape imposed by the rule. Never an
arbitrary per-year magnitude.

**Correction 2 was a proposal.** *"if the goal is a strategy with ultimate flexibility perhaps that
should be built (even if only used internally)."* Agreed, and reading the code to scope it turned up
the constraint that shapes it - `optimizer_core.js:1849`: *"Fractions, not dollars: dollar plans
desync from endogenous taxes/growth; weights are always feasible."* A per-year dollar schedule is
chosen against the previous iteration's tax outcome and taxes are endogenous. A per-year INCOME
TARGET is solved inside the year. **That is exactly `P75`/`P103c`'s control variable, so the
flexible strategy and the unified search are the same object** - they had been planned as separate
work. `P103b` restructured around it: `b2` the `strategy: 'schedule'` carrier whose acceptance is a
replay-identity test (compile each shipped family into a schedule, assert bit-identical), `b3` total-
conversion control, `b4` the re-run.

**User chose measure-first, and the measurement changed more than it was run for.**

`P103b1`: new opt-in `--reserve0` flag on `oracle_harness.js` sets `CashReserve: 0` so every arm
banks surplus in Brokerage. 45 cells, 391,160 sims, 359.6 s.

- **Negative gaps 1 -> 0.** Hole (i) is a HARNESS CONFOUND, not an engine hole. `surplusTo` dropped
  from the schedule design.
- **The routing setting is worth more than the gaps this study measures**: +$100,653 / +$84,322 /
  +$120,124 / +$86,332 on the base row, and **the winning strategy changes in 4 of 6 headline cells**.
- **The gap gets WIDER**, median 1.58% -> 2.03%, because the oracle exploits Brokerage banking better
  than the rules do.
- **It retires `P103a`'s attribution claim from this morning.** `defaults3x @4%`'s conversions-only
  gain falls from +$14,297 to **$825**; the split now dominates in all six headline cells.

**What I should have caught before running `P103a` at all.** The oracle's entire product is an
attribution, and the grid differed in two things at once - draw order AND where surplus lands.
Enumerate what the arms differ in and equalize everything that is not the variable under test. Saved
to findings as the generalizable form.

**Kept both runs.** The bare run is what a user gets (reserve unset by default); `--reserve0` is the
only routing-controlled yardstick, so `P103d` uses it. New item `P103b1x`, deliberately NOT decided
here: blank Cash Reserve costs $84k-$120k in four of six cells and changes the recommendation, so
whether the shipped default should change is a product question needing its own measurement.

## 2026-09-01 (cont.) - P103b2: the schedule carrier, and what it proved cannot be said

PR [#208](https://github.com/nightskyguy/retirement_assets/pull/208) opened for the two research
commits, then straight into the build the user asked for.

`strategy: 'schedule'` shipped as a research input - default-off, node-only, `oracleWithdrawalPlan`
discipline. Per-year `{ ordTarget, kind, rateBasis? }`. Suites **389**/61/22, seven new tests, every
pre-existing test bit-identical. Harness `.test_harnesses/schedule_replay_harness.js`.

**Reading the code to scope it produced the design.** `optimizer_core.js`: *"Fractions, not dollars:
dollar plans desync from endogenous taxes/growth."* So the schedule takes income TARGETS, solved
inside the year - which is exactly `P75`/`P103c`'s control variable. Two plans, one object.

**Replay identity holds where the family's decision IS a ceiling.** Fill Bracket 12/22/24% and IRMAA
tier 0/2: **$0** on every column. Five other families compile to zero scheduled years.

**The replay earned its keep twice.**
- It found `rateBasis`: federal bracket ceilings derive marginal rates at the STATUTORY top while
  their limit is lifted by the `P92a` add-back. Deriving at the target picked 24% instead of 22% -
  $0.34 in year 8, **$121 over 33 years**. Now returned by `computeBracketCeiling`, logged, and
  pinned by a test that asserts stripping it re-breaks the replay.
- It broke my own prediction `R-P1`. ACA is partial at 3/33 years, because its cap lapses and a
  lapsed year falls through to baseline Proportional. **The boundary is not ceiling-versus-quantity;
  the schedule cannot state what to do when there is no ceiling.**

**`P103b3` now has four fields, not one:** total-conversion control, plus the quantity lever, the
unscheduled-year fallback and the account sequence that this measured as missing.

**Two process notes.** A patch script written with `io.open(..., newline='')` silently converted
`optimizer_core.js` from CRLF to LF; git's diff stayed clean because the repo stores LF, but the
working copy no longer matched a fresh checkout. Every patch script now restores CRLF explicitly,
and `.githooks/**` is edited in binary because `.gitattributes` pins it to LF. And per the cache-token
rule from earlier today, the two `?v=` tokens naming `optimizer_core.js` and the test loader moved to
`1116f4`, plus the stale one in `standalone/IncomeTaxPlanner.html`. No changelog entry and no
`<title>` bump: the schedule is invisible to an ungated user.

## 2026-09-01 (cont.) - P103b3: four fields, 8 of 11 arms exact

Suites **394**/61/22. Report: `PERFECT_FORESIGHT_ORACLE.md` `P103b3`; harness re-run in place.

**Added:** `iraDraw` (the quantity lever), per-year `gapFill`, `scheduleFallback`, `convert`.
**Newly exact:** ACA across its lapse (was −$841,327), IRA Draw 5% (was −$1,182,054), Reduce 17 yrs
(was −$1,469,870).

**The item's own field turned out to be half-solved already.** "Total conversion control" is two
levers: gross (lower `ordTarget`/`iraDraw` - `b2` already did this) and destination (`convert`). The
plan had carried it as one hole for weeks.

**Three wrong compilers before the right one**, and I should have gone here first. Reconstructing the
voluntary IRA draw from logged outcomes failed three times - $39,117 short, $191,737 short, $39,117
again - because downstream it is merged with the RMD, split per IRA, netted against conversions and
adjusted by the shortfall cascade. Fixed by logging the decision itself (`-volIRAwd`). That is the
second time in two stages the answer was "log the decision, do not infer it" (`rateBasis` was the
first), so it went to findings as a rule rather than an anecdote.

**Then one boolean cost a whole plan.** With all 33 years correctly scheduled, IRA Draw was still
$39,117 adrift: a year-0 entry was read as implying a conversion, which flips the withdrawal month
Late -> Early for the entire horizon. A ceiling implies one; a quantity draw does not. Also
generalizable, and recorded: **a replay that is wrong by a roughly constant proportion is a whole-plan
MODE difference, not a per-year arithmetic error.**

**A `b2` test failed on purpose and was replaced, not deleted.** `'a quantity family compiles to
nothing, and says so'` pinned the old coverage limit precisely so widening it had to be deliberate.
It now asserts the widened behavior, and a new test pins the limit that remains.

**What remains is a boundary I can state in one sentence:** the schedule says how much to take from
the IRA, not how to split a spending draw across accounts (Proportional, Ordered - that is
`oracleWithdrawalPlan`, which preempts rather than composes) and not what to spend (Guyton-Klinger,
outside the vocabulary by construction). `P103b4` is next: re-run the oracle table on the schedule
representation, and decide the search question, which is still ~130 axes against today's ~33.

## 2026-09-01 (cont.) - user corrects the GK claim; P103b4 moves a number

**User:** *"Guyton Klinger affects the goal, and it, too, can likely be improved by changing the
draw/spend strategy."* Right, and I had written "outside the vocabulary by construction" in the
report, the plan, findings, a commit message and the PR body. Corrected in all of them.

**The correction is bigger than the sentence.** GK's per-year decision is the SPEND, and spend is a
decision a better draw strategy can improve - not a constant handed to the plan. What is actually
true is narrower and more damaging to the study: **the oracle PINS spend**, so every ceiling in
`P103a` is a ceiling at fixed spend, which is exactly why GK rows are excluded from the gap tables
rather than compared in them. The spend axis has never been searched. Opened as **`P103b5`**, with
the design constraint recorded up front: the pin exists because a spend-adaptive arm otherwise "wins"
by cutting spending (a GK base once showed a fake +81%), so the first item is a two-dimensional
objective, not a field.

**`P103b4`: Arm S (schedule) beats Arm A (conversions-only) in 6 of 6 cells**, +$11,259 to +$198,508,
+0.25% to +1.82%, same base row and same measured budget. `S-P1` RIGHT. This is the first thing in
`P103` to move a computed number instead of describing one.

- **The two cells that make the case:** `thirds @4%` and `brokheavy @4%`, where the conversion oracle
  finds **$0** and the schedule finds **~$198k**. Those plans want the base rule's draw moved, which
  `extraConversionAmount` cannot express in any amount.
- **It wins on ~1/8 the compute** (1,021 sims vs 9,575). Multiplicative candidates are scale-free; a
  $25k grid over $0-400k is not. Transferable to `P34` and `P103c`.

**I shipped a confidently wrong harness first and caught it by reading the sim counts.** Version 1
took the best non-cyclic base regardless of family, so five of seven cells handed Arm S an empty plan
(Ordered and GK compile to nothing) - null score after ONE simulation - and it printed Arm S losing
by the whole conversion gain with `S-P1` WRONG. The tell was the `sims A/S` column reading `8248/1`.
Recorded as a rule: **a null or catastrophic result that arrives after one evaluation is a setup bug,
not a finding.** Base selection now requires exact replay, verified per cell.

Next is `P103b5`, and its first question is the objective, not the field.

## 2026-09-01 (cont.) - P103b5a, and two Annual Details fixes the user found

**`P103b5a`: the spend axis cannot be searched with a weight.** The model gives up **1.38 to 3.31**
dollars of real terminal wealth per extra dollar of lifetime spending; `SPENDABLE_WEIGHT` is 1.10.
Below the technical rate everywhere, so the scalarized optimum sits at MINIMUM spend in 3/3 cells.
`O-P1` WRONG **in the opposite direction** from my prediction - I expected "spend everything", it
hoards. `O-P2`/`O-P3` RIGHT, and the rate varies 1.38-3.31 inside a single cell, so no weight can
agree with the model at both ends. **`P103b5` needs a frontier.**

Side finding with teeth: **feasibility is not monotone in the spend goal** (`round1 @4%` feasible at
0.70, infeasible at 0.80, feasible at 0.90). `totals.success` is a per-year 99%-of-target test.
Bisecting for maximum sustainable spend is unsound; whether `optimizeSpend` is exposed is now an open
question in findings.

**User asked for a comment on `SPENDABLE_WEIGHT`, with "unless you notice it's not working".** It IS
working at its stated job - ties at equal spend cancel, ties at equal wealth prefer more spending -
but it cannot price a real trade-off, and I said so in the comment and to the user rather than only
documenting the happy case.

**Two user-visible fixes, shipped as v11.16f9.**

1. **Cash could fall with nothing on screen explaining it.** On the user's plan Cash went
   $72,000 -> $16,099 in year one with `CashWD` reading 0, because $56,512 paid conversion tax under
   "Use Cash". The figure existed only as `-extraConvCashTax`, whose leading `-` means no column.
   Added `ttlCashWD` (every dollar that left Cash, in the Withdrawals band beside CashWD) and
   `ConvTaxCash` (the of-which). **I did NOT redefine `CashWD` as the total**, which the user
   proposed: it feeds two charts as money that funded SPENDING and a sum that reconciles against net
   income, so folding conversion tax in would double-count it in three places. Explained rather than
   silently declined. **And I put ttlCashWD in Balances first, which was wrong** - the user moved it
   to Withdrawals, and they are right: Balances carries balances, and a flow column among them is the
   same confusion that hid the outflow to begin with.
2. **"Suppress zero" no longer hides account balance columns.** A zero balance is a fact; a missing
   column reads as "the tool does not track this account". Flow and rate columns still hide, and so
   do the per-person splits, because an all-zero Roth2 means no second person.

**What I could not reproduce, and said so:** the original report was "Balances does not include
Cash". On the default scenario Cash was present and populated. The user then supplied the real
scenario, which was the conversion-tax case above. Asking for the scenario beat guessing at a fix.

## 2026-09-01 (cont.) - P103b5: the schedule beats GK, after two user corrections

**`spend` and `spendRule: 'gk'` added.** Suites **397**/61/22. The second field is the one that
matters: it runs the Guyton-Klinger adjustment under ANY strategy, so a schedule owns the DRAW while
GK owns the SPEND.

**Correction 1, and it changed the design.** *"The only rule it should follow is to use the GK spend
goal adjustment strategy faithfully."* My first pass compiled GK's RECORDED spend numbers and
replayed them under a different draw - a hindsight artifact, since GK's spend responds to the
portfolio and would have chosen differently under that draw. Carrying the RULE instead makes the
combination followable. Recorded in findings as a general tell: a replay that carries an adaptive
strategy's decisions rather than its decision rule will almost always look better than the source,
and the flattery is an artifact.

**Correction 2, and I had filed a win as a defect.** I reported GK as a "partial replay, residual
$292k" - a strict improvement described as a coverage gap. *"If a draw strategy improves GK it should
be used. Indeed, that's the point."* Right. The harness now reports the delivered-spend delta beside
the wealth delta and labels the case DOMINATES; a verdict set of only EXACT-or-BROKEN could not see
an improvement at all.

**Result: GK dominated in 10 of 12 cells** - more lifetime spending AND more terminal wealth. At the
user's typical -1%/yr decline: +$26,285 spend / +$2,611 wealth at 4%, +$91,655 / +$95,758 at 6%. The
two non-dominating cells are a RISING spend goal, where it trades wealth for spending, which is what
a dominance test should say when there is no dominance.

**Correction 3, to language I had used throughout.** *"You've repeatedly said spend is fixed - it is
not, usually it is declined by -1% per year."* Two things conflated: spend is PINNED as a comparison
rule (real), and FLAT as a fixture choice (unrepresentative - every harness here sets
`spendChange: 0`). Opened `P103b5c` to re-run the grid on a declining path, and flagged in the report
that every existing gap number is a flat-path number.

**What it licenses:** not $198k for a user. GK's account split costs it that much at its own spending
rule, so the draw rule is what to replace - `P103d`, now with a measured prize. Unlike `P103b4` this
needs no perfect foresight.

**One field left:** the account SPLIT. Proportional and Ordered still carry nothing.

## 2026-09-01 (cont.) - P103b5c: the flat spend fixture was worth a factor of two

Ran the whole 45-cell grid on a realistic -1%/yr spend path, the correction the user made two
messages earlier. Predictions `D-P1`/`D-P2` registered in `task_plan.md` before the run finished.

**`D-P1` RIGHT by six times the margin I predicted.** Median best-family gap **1.58% -> 3.44%** at
default basis, b20 1.13% -> 3.30%, b80 0.90% -> 3.23%. Max conversions-only gain 0.57% -> **9.55%**.

**`D-P2` RIGHT but narrowing** - the split stays dominant (27 of 45 both paths) while conversions
nearly double in total ($2.04M -> $3.80M) and the split falls ($5.47M -> $4.85M).

**A headline I have repeated all session breaks:** "the flat scalar finds $0 in 45 of 45 cells" is a
flat-path artifact. On the declining path it finds money in 3 cells, up to $86,640. And `S3-P4`
flips WRONG - backstops are no longer silent everywhere.

**I misread my own output first and caught it before writing.** A quick `awk` put the flat-scalar
count at 28 of 45; re-extracting with a proper parser gave **3**. The difference between "the
headline is destroyed" and "the headline is dented" is exactly the kind of thing a sloppy field index
invents, and it would have gone into the report as a number nobody could reproduce.

**Third fixture-as-finding this session**, and that is now the pattern worth naming: `P103b1`
(surplus routing confounded the grid), `P103b5` (spend pinned vs spend flat), and this. All three
were defaults inherited from the first harness and never revisited. Recorded in findings as a rule.

**Consequence:** every other gap number in the report is a flat-path number, understating the
realistic gap ~2x. `P103d` now has to re-derive its regime map on the declining path FIRST - written
into its plan item.

## 2026-09-01 (cont.) - correcting P103b5c, then deriving P103d's map

**I withdrew two claims I committed an hour earlier.** `P103b5c` ran the declining spend path with
routing left uncontrolled and reported the median gap doubling (1.58% -> 3.44%), scoring `D-P1`
RIGHT. Running the 2x2 for `P103d`'s map showed that was an interaction with the routing confound:
controlled, the gap goes 2.03% -> 1.94%, i.e. does not widen. `D-P1` is **WRONG**.

Also withdrawn: "the flat scalar's $0 in 45/45 is a flat-path artifact". Under routing control it is
**$0 in 44 of 44 on both paths**; the 3 cells were routing artifacts and the original headline holds.

**What survives:** max conversions-only gain 0.57% -> 9.55%, `S3-P4` flipping WRONG, and the basis
arms converging (all three medians 1.94%) on a declining path.

**The sharper rule:** fixtures INTERACT, so correcting them one at a time moves the confound instead
of removing it. Fixing routing with spend flat, then spend with routing loose, produced a confident
false positive at each step. Cost of finding out: one extra 345 s run. Cost of not: two claims that
had already survived a write-up, a prediction score and a commit.

**`P103d`'s map is now derived** from the only fully-controlled run (409,277 sims, 0 negative gaps).
Of the 17 cells with a gap >= 5%, **13 are at 8% spend** (4 at 6%, none at 4%) and **13 have
Guyton-Klinger as the best family**. Fattest `round1 @8% b20` at **22.78%**. The map RELOCATED rather
than growing: flat-path fat cells collapse (`thirds @6%` 14.95% -> 0.58%) while near-closed cells
open up (`thirds @8% b20` 0.00% -> 14.96%). `P103a`'s "6-8% and the b20 arm" was half right - the
spend rate is the axis and it is 8%; basis is not, all three basis medians are 1.94%.

**So the bake-off target is derived rather than guessed:** draw rules under a GK spend rule, in
high-spend plans - the composition `spendRule: 'gk'` was built for, on the family the schedule
already dominates.

## 2026-09-01 (cont.) - P103d: the bake-off, and GK's draw is beaten in 80% of cells

New harness `.test_harnesses/gk_drawrule_harness.js`. Incumbent `strategy: 'gk'`; candidates are
shipped families run with `spendRule: 'gk'`, so GK keeps the spend and something else takes the draw.
A candidate wins a cell only on BOTH axes. Both fixtures controlled.

**GK's draw is beaten in 24 of 30 cells (80%), 15 of 15 at 6% spend.** $6,564,797 total, median
$231,345, largest $713,401. The 6 unbeaten cells are all at 8%.

**`G-P1` WRONG but not in the direction that matters:** no single rule wins a majority (best 14/30),
yet SOME rule wins 80% of cells. That is a regime-gated winner, not the absence of one. **`G-P2`
RIGHT** - six distinct winners. **`G-P3` WRONG**: IRA-first rules win 14 per-cell bests against 10
cash/brokerage-first, the OPPOSITE of `P35n`'s endgame finding. Two results from this repo pointing
opposite ways - flagged in findings as something to settle before either ships, not glossed.

**Candidates are all shipped families on purpose**, so a winner becomes a marked, regime-gated sweep
arm rather than an engine change. `P103e` is the last stage: score a survivor under many paths.

## 2026-09-01 (cont.) - P103e: Monte Carlo overturns P103d, and P103 has a shippable answer

100 GBM paths x 33 years x 5 rules x 6 cells, same banks/seed/path index for every rule, built on the
shipped `buildBanks`/`buildPathInputs` rather than a fourth copy of the model.

**`E-P3` RIGHT 6/6 - the single-path pick is NEVER the median-best rule.** **`E-P1` RIGHT 6/6** -
some rule still beats GK's median everywhere (+$56,674 to +$620,781). **`E-P2` WRONG** - in
`defaults3x @6%` the median-best survives 57% of paths against GK's 100%, wealth bought with
survival, exactly what that prediction was written to catch.

**`P103d`'s winner is the worst rule here.** Ordered CIBR won more single-path cells than anything
else and survives 3-21% of paths in four MC cells. **The robust winner is Fill Bracket 22%** -
median-best in 5 of 6 at 100% survival, +$57k to +$600k - which the single-path bake-off ranked
second.

**So P103 has a result worth shipping:** GK spend rule + Fill Bracket 22% draw, as a regime-gated
marked arm built from existing families. And the selection must be made under Monte Carlo.

**First run printed all `$NaN` at 100% success** because the synthetic modes need `cfg.mu`/`cfg.sigma`
and I passed neither. Caught by the same reflex as `P103b4`'s one-sim null; noted in the harness
header so the next person does not lose the time.

**Remaining in P103:** `P103c` (unified search) and the account SPLIT field from `P103b2`.
`P103b1x` - whether blank Cash Reserve should stop being the default - is a product question and is
the user's call, not mine.

## 2026-09-01 (cont.) - P103e mode sweep: the claim narrows, and the ordered rules are out

Ran `P103e` under bootstrap and AAM as well as GBM. Bootstrap replays real historical blocks, so it
carries real crashes in real order - the thing GBM cannot show.

**Both ordered sequences are disqualified outright on survival, in every mode.** Ordered CIBR - the
single-path bake-off's most frequent winner - reaches **0% survival under bootstrap**, funding not one
historical path in a cell. Ordered CBIR is 15-19% at worst.

**Fill Bracket 22% wins 12 of 18 mode-cells** at 95-100% survival, not the "5 of 6" the GBM-only run
suggested. It loses in `defaults3x @6%` in all three modes, and flips +$107k -> **-$381k** in
`thirds @6%` between GBM and bootstrap. `IRA Draw 5%` is the other safe candidate: 100% survival
everywhere, smaller gains.

**Recommendation narrowed accordingly** in the report, the harness index and the plan: pair GK's
spend rule with a bracket-filling draw *in the regimes where it is measured to win*, never with an
ordered sequence.

**The pattern worth carrying out of this whole phase:** one path picked a brittle rule; one mode
overstated the replacement; one uncontrolled fixture doubled a gap that does not move when
controlled. Every narrowing of the evidence flattered the answer, in the same direction, every time.
Recorded in findings as a working rule.

## 2026-09-01 (cont.) - P103c's gate run, and stopping short of the verdict

`P75a` is the gate on `P103c`: a search over the MAGI edge menu only makes sense if good plans land
on that menu. New harness `.test_harnesses/magi_edge_gate_harness.js`.

**Measured 4.2% of 990 best-row plan-years within $1,000 of an edge** (1.3% at $250, 29.2% at
$10,000). `U-P1`/`U-P2` WRONG, `U-P3` RIGHT - which reads as the gate FAILING.

**I am not acting on it.** The first version of this measurement was wrong - hand-rebuilt statutory
tables scaled by the spending inflation factor rather than the CPI indexation one, ignoring the P92a
add-back - and it reported 1.1% for Fill Bracket, a family that fills a ceiling by construction. The
impossibility caught it. After the fix a direct check confirms Fill Bracket 22% sits at exactly $0
from its own BracketTarget in the years the ceiling binds, 6 of 33 in the cell tested.

So the low residency now looks real, and for an interesting reason: ceilings bind in a minority of
years even for families built to fill them, and the best rows in the fat regimes are GK, which has no
ceiling. But a verdict that discards planned work should not rest on a measurement whose first
version was wrong. **Recorded as PROVISIONAL in the plan with the confirming step named** - count
binding years per family and check 6/33 generalizes. That is the user's call to make, not mine.

## 2026-09-02 - "GK's draw" is the DEFAULT draw, and the user spotted it

User: *"the default draw rule for gk is 'proportional' and I believe the same rule that the
'proportional' (propwd) rule uses."* Right, and it is the same code rather than the same idea. No
`'gk'` case in `planPrimaryWithdrawals`; GK falls through to the baseline `else`, whose three lines
open the `propwd` branch too, and neither family is in `yr.isBracketStrategy` so the gap fill matches
as well.

New harness `.test_harnesses/family_equivalence_harness.js` compares two families on every field of
every log row plus final net worth, with `spendRule: 'gk'` on both arms so only the draw can differ.
**15 of 15 cells bit-identical.**

Three consequences, all recorded in `PERFECT_FORESIGHT_ORACLE.md` under `P103d`:

1. `P103d`'s headline is about the **legacy default draw**, not about Guyton-Klinger, and generalizes
   past GK anywhere that default is in play.
2. `Proportional` was a **null arm** in the `P103d` bake-off - it is the incumbent and can only tie.
   The results agree (it wins no cell), so nothing is wrong, but a guaranteed tie should not have
   been listed as a candidate. `P103e` is unaffected: its five rules contain no Proportional entry.
3. It re-derives the account-split hole from the other direction: every surviving candidate varies
   how much IRA comes out, never how the non-IRA remainder splits, because the only family that could
   express that IS the incumbent.

Also fixed a doc block in `optimizer_core.js` that described the fallback branch as unreachable
("No UI option currently routes here") when Guyton-Klinger reaches it on every run, and never
documented `'gk'` at all. `ARCHITECTURE.md` §3a and the published diagram carry the equivalence now.

## 2026-09-02 (cont.) - P104: the split needs phases, not per-annum freedom

User: *"the real question is whether Proportional itself should be improved (or replaced). I suspect
a winning draw strategy will require strategic choice of assets to draw from on a per-annum basis."*

New harness `.test_harnesses/split_expressiveness_harness.js`, 38,721 sims - an expressiveness ladder
(`k=1` one archetype / `k=2` one switch / `k=free` per-year) over the oracle's own archetype menu.

**Answer: mostly phases.** One switch captures 85-100% of the full per-year optimum in 7 of 10 cells.
The three exceptions are all brokerage-heavy and large (`brokheavy @6%`: $938,307 of $1,603,960, a
$665,653 per-year increment).

**The cheapest result is the flattest:** one better CONSTANT beats Proportional in **10 of 10** cells,
$139,928 to $1,155,056. The default is the wrong constant, not wrong for being constant. And the best
constant is a BLEND in 4 of 10 - which no shipped family can express - so the `P103b2` SPLIT field is
needed even for a constant, a far smaller build than a per-year search.

**Caught before reporting:** the first run declared 8 of 10 cells invalid on a spend-drift check.
The actual drift was **$1 against $7.4M** - the base over-funds by $2 and the tolerance was absolute
on a 33-year cumulative total. Fixed to relative, prints its magnitude. Also recorded that `X-P4`'s
blip-collapse operator is bad (negative in two cells) and nothing rests on it.

**Trust boundary written into the report:** the k=2-to-k=free increment is the most hindsight-fitted
number in the table, and `P103e` is the standing proof that fitted complexity dies out of sample.
Phase structure is the trustworthy part; the per-year increment is the suspect part.

`P35` raised to **O0** - it is the carrier for exactly this. New `P104b`-`P104e` sequence: constant
split, then one switch, then a Monte Carlo pass BEFORE anything ships.

## 2026-09-02 - planning session opened on a fresh branch; two record fixes, no product code

Opened with `/plan` in the reused `readme-review-updates-c9df11` directory, branch
`worktrees/planning-with-files-a83df3` at `c67744f` = `main`. Nothing unsynced; the catchup script
was empty. No task named yet.

**This file's tail was out of order.** PR #208's merge left the 09-01 `P103c` gate entry AFTER both
09-02 entries, and the `(cont.)` P104 entry before the base 09-02 one - so the planning hook was
injecting the gate run as "recent progress" when P104 is the newest work. Reordered to commit
order (gate run, GK's-draw, P104); content unchanged, checked as a line multiset against `HEAD`.
First attempt left a lone carriage return at EOF, which git reads as binary and diffs as the whole file -
caught by the 7,810-line diff stat, fixed to a 39-line move.

**`readme_caveats_findings.md` is recoverable.** The 08-20 memory note said the P48 audit file never
existed and its file:line citations were gone. Git says otherwise: 215 lines committed in `838a870`
(PR #140), deleted by the user in `3f7cda2` ("Not needed. Local copy is being kept."). Memory
corrected; `git show 838a870:.planning/retirement-optimizer/readme_caveats_findings.md` restores it.

## 2026-09-02 (cont.) - P104b planned: three PRs, a review point, and a winner that looks like CIBR

User: *"P35/P104b are the next target."* Planning only; no product code.

**The build is small because the arithmetic exists.** `calculateWithdrawals` already takes a
`weight` array, and `oracleWithdrawalPlan` already binds `{IRA, Brokerage, Cash, Roth}` weights to
both the primary draw and the gap fill - which is the exact path `P104a` measured. So a shipped
family is that path with a name, and its acceptance test is replay identity against
`propwd 0 + oracleWithdrawalPlan.fill(V)`. Design settled from the code and written into the plan:
`inputs.splitWeights`, `strategy: 'split'`, baseline behavior everywhere else, `ROTH_GAP_EXCLUDED`,
element-wise selection compare, malformed-vector fallback with a visible warning.

**The thing that reorders the work:** `{Cash: 1}` is not an all-cash draw. Phase 2 of
`calculateWithdrawals` walks IRA, Brokerage, Roth for the remainder, so the single-path `k=1`
winner in 5 of 10 cells has Ordered CIBR's shape - the rule `P103e` found at 0% survival under
bootstrap. Not the same code path, so it is prediction `V-P1`, not a finding. But it means the grid
cannot be read off `P104a`'s winners, and the plan now puts the Monte Carlo selection (`b2`) BEFORE
the product PR (`b3`), with the user's grid and label decisions at the review point between them.
`V-P4` is the kill switch: no vector robustly beats Proportional, no `b3`.

**The per-cell `k=1` winners were never recorded** - the harness prints them, the report kept
aggregates. Re-run launched to recover them. First launch died with the wrapper shell (an inner `&`
under the tool); relaunched under the tool's own backgrounding.

Budget stated up front: Optimizer already 1,711 runs against a 1,500 cap; ~4 rows per vector over
the clone passes; eight golden pins, the Optimizer half a browser capture. Rules `C1`/`C2` bind.

**Per-cell winners recovered** (re-run finished, exit 0, aggregates bit-identical to the report):

| cell | k=1 winner | k=2 winner (A -> B at year t) |
|---|---|---|
| defaults @4% | `Cash` | same as k=1 |
| defaults @6% | `Cash` | `I5C5` -> `Roth` at year 1 |
| defaults3x @4% | `prop` | `Cash` -> `prop` at year 1 |
| defaults3x @6% | `B4C6` | `B4C6` -> `Roth` at year 11 |
| round1 @4% | `Cash` | `Cash` -> `Brok` at year 13 |
| round1 @6% | `B4C6` | `I5C5` -> `Brok` at year 1 |
| thirds @4% | `B4C6` | `Cash` -> `Brok` at year 1 |
| thirds @6% | `Cash` | `B4C6` -> `Roth` at year 5 |
| brokheavy @4% | `Brok` | `Cash` -> `Roth` at year 10 |
| brokheavy @6% | `Cash` | `Brok` -> `Roth` at year 12 |

Full output kept in the session scratchpad; the table is in findings.md under the 2026-09-02 entry.

## 2026-09-02 (cont.) - P104b1 built and green, and the acceptance test found a shipped defect

User: *"go ahead with P104b1."*

**Built.** `inputs.splitWeights` + `strategy: 'split'` in `optimizer_core.js`: `_splitWeightsFor`
(shape-validated), a branch beside `propwd` that sets order/weight/taxrate exactly as the oracle
hook does, the same vector at the oracle's mirror in `fillSpendingGap` (harvest years excepted),
`totals.splitWeightsInvalid` for the malformed fallback, `'split'` in `ROTH_GAP_EXCLUDED` (now
exported), `splitWeights` in `STRATEGY_SELECTION_FIELDS` with a normalized element-wise compare.
Eight tests: replay identity over four vectors and two mixes, nine malformed shapes plus the strip
test, cyclic composition, gap-fill binding, selection identity, two `FUNDING_ARMS` rows, and one
pinned defect. Suites **405**/61/22, `TestTiers.EXPECTED` and `.githooks/README.md` reconciled.
Nothing user-visible; no version, no changelog. Uncommitted.

**Replay identity passed on the first run.** The family IS the oracle path, to the dollar, on
every column, for `[1,0,0,0]`, `B4C6`, `I4B3C3` and a Brokerage/Roth blend on two mixes.

**The one failure was the CIBR-shape pin, and it was right to fail.** `{Cash:1}` on BASE drew
$11,767 of Cash against a $50,000 balance and $29,292 of IRA. Instrumented trace: pass 1 drew the
whole $36,717 need from Cash; pass 2 then saw the same gap again because `possibleIncome` counts
IRA and Brokerage draws and not Cash or Roth; it drained the rest of Cash, spilled into the IRA,
and the surplus routine refunded $38,233 to Cash at year end. The oracle's own `{seq}` form does
exactly the same. Ordered's branch comment names the defect and Ordered avoids it by design.

**Sized with a one-line scratch copy, never on the branch.** Ten cells, real after-tax wealth,
spend identical: Proportional +0% **+$241,868 mean** (up 8 of 10), Guyton-Klinger +$103,349;
Fill Bracket, IRA Draw, IRA-only split and Ordered exactly $0 (the controls). With Max Conversion
on the phantom gap is CONVERTED - a Proportional +0% plan converts $7.8k, $7.2k, $6.2k, $3.5k in
its first years and should convert nothing. Full table in findings.md.

**What it does to the plan.** `P104a`'s `Cash` winner loses in 7 of 10 on the corrected engine, so
the grid cannot come from it, and the oracle gap tables were measured on the distorted path in both
arms. `P104b1x` opened at O0 as the user's decision: correct pass 2 behind a research input, measure,
then flip the default in its own PR. `P104b2` is gated on it. The pin in the test suite will announce
the fix when it lands.

## 2026-09-02 (cont.) - P104b1x: the phantom-gap fix, v11.1701

User: *"Go ahead with the fix"*, after stating that backward compatibility is not an objective.

**One line in `fillSpendingGap`**: `netSpendable` now adds pass 1's Cash and Roth draws, so a year
funded from either is not funded again. Ordered's branch comment, which had recorded the loop as
the reason Ordered draws nothing in pass 1, rewritten as history.

**Three tests re-pinned, each with its derivation in the file:** the `P35n` sequence test, whose
"cascade to Brokerage" had been the phantom draw itself (now runs at a $90k goal so Cash genuinely
runs out); the GK triple (+$24,019 spend, -$1,237 tax, +$51,310 final NW, guardrail count still 3);
the `P38` forced-IRA total ($33,744 -> $30,943). The `P104b1` pinned-defect test became two
`test.critical` guards for the corrected behavior. Goldens untouched (they pin enumeration).
Suites **406**/61/22, `TestTiers.EXPECTED`, `.githooks/README.md` and the critical-guard blurb
reconciled.

**Release:** v11.1701 (day 245, hour 9). Title, `optimizer_core.js` and `optimizer_tests.js`
cache tokens, one changelog entry marked behavior change, one page `<li data-flag="behavior">`.
The entry says what a user needs: Proportional and Guyton-Klinger plans were withdrawing and, with
Max Conversion on, converting money they did not need; spending unchanged to the dollar; ending
wealth moves; the IRA-first families and Ordered are unchanged.

**Re-baselining started.** `P104a` re-run launched on the corrected engine; the `P103a` yardstick
follows. `P104b2` stays gated until both report.

**Browser-verified on the worktree preview** (title 11.1701): self-check badge green, "All 820 tests
passed (334 in-page + 486 node)", `TestTiers.EXPECTED` 406 in the page, changelog list's first entry
11.1701 flagged behavior. **P104a re-run on the corrected engine** and written into the report as a
superseding subsection: 8 of 10 (was 10 of 10), Proportional the best constant in both brokheavy
cells, winners moved from `Cash` x5 to blends x7. Oracle yardstick re-run in progress.


**Oracle yardstick re-baselined** (`oracle_harness.js --full --reserve0 --spendchange -1`,
404,511 sims, 359 s): median gap 1.94% -> 1.29%, basis extremes 2.23%, cells >=5% 17 -> 13, max
conversions-only gain 9.55% -> 2.34%, zero negative gaps, S3-P2/B-P4 RIGHT, S3-P3/S3-P4 WRONG as
before. Written into `PERFECT_FORESIGHT_ORACLE.md` as "What changed with v11.1701" with an engine
note at the top of the file; `research/README.md` row extended; plan updated (`b2` unblocked;
`P103d`/`P103e` flagged as old-engine before their arm ships).

## 2026-09-02 (cont.) - Cash Reserve default 0, the reserve column, and the changelog trimmed (v11.1702)

User: the ten-plan dollar figures out of the page changelog (done, `abe6934`); a first pass at what
in the plan and findings reads as unfixed when it is fixed (the badge blurb reworded, an audit
proposed); a Cash Reserve default. **Measured** (12 cells x 5 families x 8 sizes, plus 12,000 MC
sims): 0 is never worse than blank and best or tied in every family; every dollar of buffer costs.
User approved 0 after a check of their intuition that 0 leaves a larger unspent Brokerage:
composition yes, cost no (findings 2026-09-02).

**Shipped:** the input defaults to 0 (`OPT_DEFAULTS` captures it from the page, so share-URL
omission follows), the load-time reserve warning retired (it would have fired for everyone), a
`CashReserve` column in Annual Details (engine `cashReserve` on the log row, display key beside
`Cash`, bands Balances + Cash Δ, tooltip; hidden when there is no reserve), README FAQ and the
field tooltip updated. One test (407), counts reconciled. Same branch entry, stamp refreshed to
11.1702; core, ui and tests cache tokens bumped.

**User's stance recorded:** Cash Reserve is one vehicle, Roth is the backup; no emergency-spending
feature.

## 2026-09-02 (cont.) - BrokerageG explained, DRIP and SurplusBrok columns, chart scale (v11.1703)

User: what BrokerageG contains, a tooltip, a column for money routed into Brokerage by the reserve
rule and the DRIP; a linear / log10 / log2 choice for the Balances chart.

**Shipped:** engine log field `brokDRIP`; display keys `DRIP` and `SurplusBrok` beside `brokerageG`;
`SumBrokIn` running total (P86 mechanism, Current-$ aware); tooltips for Brokerage, brokerageG,
DRIP, SurplusBrok, SumBrokIn stating the reconciliation; a `Scale` select on the Balances chart with
`setAssetChartScale`, a `Log2Scale` registered on first use, zeros as gaps on log axes, dollar tick
labels. One test (408): the Brokerage identity to $1 every year, DRIP on and off, reserve routing
on, reserve Off. Counts reconciled; same branch entry, stamp refreshed; core, ui, tests tokens
bumped. Findings: "What BrokerageG contains".

**PR #209 opened 2026-09-02** (`worktrees/planning-with-files-a83df3` -> `main`, eight commits, v11.1701-11.1703):
the split family (P104b1), the gap-fill correction (P104b1x), the oracle re-baseline, Cash Reserve default 0
with its column, the Brokerage columns and the chart scale, and the changelog wording per the user (the
page entry restored to four bullets after a regex took the middle four with it).

## 2026-09-02 (cont.) - planning-file cleanup: findings and the task plan cut roughly in half

User: the two files carry old and obsolete references, including completed tasks. Remove the
obsolete findings, move completed task descriptions to the completed file but keep the headlines
marked complete. Goal: less detritus for `plan-with-files` to read on every session.

| file | before | after |
|---|---|---|
| `findings.md` | 4,564 | 2,594 |
| `findings_archive.md` | - | 2,130 (new) |
| `task_plan.md` | 6,983 | 2,790 |
| `task_completed.md` | 1,430 | 5,579 |

**`findings.md`.** 34 sections moved verbatim to a new `findings_archive.md`: fixed-defect
narratives whose defect the code no longer has (the dividend double-credit among them - the user
named it, and `optimizer_core.js:1744` confirms `possibleIncome` no longer carries dividends or
interest), claims a later entry in the same file already superseded or withdrew, and the undated
pre-`Pnn` legacy block. Guyton-Klinger and the pre-TCJA bracket table were lifted back out of that
legacy block and kept - they are primary-source records for a shipped strategy and for parked `P4`.

What the archived narratives earned is now a **"Rules earned the hard way"** section at the top of
`findings.md`: eleven rules, each naming the thing that enforces it (`optimizer_core.tests.js:4117`,
`:4144`, `:4166` for the three `no free money` invariants, `:2880` for the use-site flag guard).
Three kept subsections whose parent was archived were promoted to `##`: "Two traps this work fell
into", "Rate-axis monotonicity", "Perf gate baseline" - the last one gained an explicit line naming
the reference machine, which it had been inheriting from its parent.

**`task_plan.md`.** 39 fully-complete phase sections moved to `task_completed.md` under a new
`# Archived 2026-09-02 from task_plan.md` banner, bodies verbatim. **Departure from the 2026-08-07
and 2026-08-31 passes, at the user request: the headings did NOT go with the bodies.** Each phase
keeps a one-line stub marked `**COMPLETE.**` with its version/PR/date and a pointer, so the plan
still reads as a record of what shipped and a grep for a phase ID hits in both files.

- **Rescued:** `P91d` (the Monte Carlo controls are in neither the saved scenario nor the share URL)
  sat inside a phase whose status reads DONE. It stays live under the `P91` stub.
- **Kept live:** `P19` and `P28j` are PARTIAL, not complete. `P75` keeps its 5 boxes even though it
  merged into `P103`, and the TPP-1/TPP-2 items under `P46` are still pending.
- **Deleted outright, not archived:** the `Open Task Index` (stale - still called `P32` and `P56` the
  O0s, both long complete), the second `Recent state and trail` (superseded by the NOW block, and
  its own maintenance note said so), the `Dependency Graph` (written in the retired `P1`-`P28`
  numbering, where "Phase 23" means a different phase than `P23` does today), `Known TODOs` and the
  empty `Errors Encountered`. Also the duplicate `P35 PR 3 replan` block, which contradicted the
  settled-decisions table in `P35` about `deathBasisStepUp` and whose real write-ups were already
  archived; a pointer stub replaces it.

**Citations.** `task_plan.md` cited `findings.md` by line number in 22 places and **about half were
already dead** before this session - `:170`, `:377` and `:1057` landed on blank lines, `:53`, `:123`,
`:515`, `:535`, `:559`, `:962` on unrelated text. All 22 are now heading citations, which survive any
renumbering; two point into `findings_archive.md`. `:53` had no surviving target in either file and
was dropped, the claim it decorated kept. **`progress.md`, `task_completed.md` and `task_parked.md`
were deliberately NOT re-cited** - they are frozen historical logs, same rule as 2026-08-29.

**Checks.** Open boxes in `task_plan.md` unchanged at **86** - an open item archived by accident is
the one failure mode here that costs real work. Line-30 boundary marker still on line 30. Every
NOW-table ID still resolves to a live section. Zero `findings.md:NNN` citations left in the plan.
Suites unchanged - no code was touched.

**Bookkeeping.** `FILE_DIRECTORY.md` gained rows for `findings_archive.md`, `task_parked.md`,
`CLEANUP.md` and `MERGE_PR182_IRMAA.md`. The `p71_probe/` row was checked and is correct - the
directory still exists. The `task_parked.md` index row for `P5` now says it was un-parked into
`P103c`. No changelog entry: nothing here is visible to a user.


## 2026-09-02 (cont.) - progress log split at 2026-08-19 and the four bloated sessions compressed

Second half of the planning-file cleanup, same user instruction applied to `progress.md`: move the
obsolete out to `progress_archived.md`, compress what moves and what stays.

| file | before | after |
|---|---|---|
| `progress.md` | 8,049 | 3,484 |
| `progress_archived.md` | - | 3,390 (new) |

**Split at 2026-08-19.** 122 sessions moved; everything they describe is complete and merged, with
the phase bodies in `task_completed.md` and the measurements in `research/` and
`findings_archive.md`. Eight sessions that opened with `/plan`, reconciled state and wrote no code
are collapsed to one table row each - they recorded nothing that outlived the session.

**The moved entries are verbatim, and that was a deliberate call against the instruction to
compress them.** They were already terse: 85 sessions in about 1,200 lines for May through July,
averaging 14 lines. Rewriting that prose would have cost facts and saved a few hundred lines. The
bloat was not old - August alone was 113 sessions in 6,083 lines - so the compression was spent
where it actually was.

**Four sessions hand-compressed, 1,524 lines to about 170.** The 2026-08-27 entry was 832 lines,
10% of the whole file, and its heading was wrong: "planning pass, P28j gets a phase" actually
covered two days and fifteen passes through P28j, P83, P30h, P85, P84, P86 and the `research/`
split. Retitled to say so. Also compressed: P70a (330), P23 (189) and the 2026-08-20 plan resync
(173). Every measured number, version, PR and commit in them was carried across; what went was
narration and the per-session verification boilerplate.

**Eight rules were lifted out before their sessions were archived** and added to `findings.md`
under "Rules earned the hard way", which now runs 19 rules in four groups. The one worth naming:
**the SCORER is where the bugs live, not the measurement** - nine scoring-predicate defects over two
days, every one caught by a number disagreeing with the one printed beside it and not one by
review, because a wrong scorer still prints a confident verdict. Two flipped a recommendation and
one would have shipped a default behavior change on a tie-breaking artifact. Also lifted: the page
is not the file; never cache-bust this page with a short query param (`g` is Growth, `s` is State);
a new top-level name in any worker-imported file must be unique across all five, and node will
never tell you.

**Checks.** 223 of 225 session headings preserved verbatim; the two exceptions are the 08-27 entry
retitled above and P70a, retitled from "P70a measured" to "P70 COMPLETE" since the compressed entry
covers the whole phase. No session is in neither file. Suites 408/61/22 - no code touched.

**Not done:** the P67 (227 lines) and P71 (286 lines) session series in the kept range are still
uncompressed. Both phases are complete and archived, so both are fair game for a later pass; they
were left because compressing a session I have not read risks dropping a number.

## 2026-09-03 - session opened, state restored, one stale record fixed

Planning files restored from disk; nothing was lost. Working tree **clean**, branch
`worktrees/planning-with-files-7ee466` level with `main` at `37fb835` - **PRs #209 and #210 both
merged**, so the plan header's "PR #209 open" was stale and now reads as of today. Page at
**v11.1703**, suites **408 / 61 / 22** unchanged (no code touched since the merge).

**Where the work stands.** `P104b2` is the next item and it is unblocked: `P104b1` and `P104b1x`
shipped (the phantom-gap fix, v11.1701), and `b2`'s part (i) is already done - the per-cell `k=1` /
`k=2` winner table was recovered and is in the 2026-09-02 session above. Remaining inside `b2`:
(ii) the fine `k=1` 3-simplex at 10% steps plus b20/b80 basis arms, (iii) the Monte Carlo selection
harness `.test_harnesses/split_mc_harness.js` (does not exist yet; `gk_drawrule_mc_harness.js` is
the structural template), (iv) the report `research/CONSTANT_SPLIT.md` and its `research/README.md`
row. `V-P4` is still the kill switch for `b3`.

**Caveat carried forward, not yet discharged:** `P104a`'s and `P103a`'s re-baselines are recorded,
but the `P104b1x` A/B harness still lives only in a session scratchpad, and `P103d`/`P103e` have not
been re-run on v11.1701 - GK's draw is the one the phantom-gap defect distorted most.

## 2026-09-03 (cont.) - Earliest Break Even: ties on the Roth balance, and the balances on screen (v11.1717)

User, mid-session, interrupting `P104b2`: *"retirement_optimizer should show the Ending IRA and Roth
balances for 'Break Even', and Break Even should tie break 'earliest break even' with Roth balance
then netwealth."* Both halves are the same surface, the Optimizer's **Earliest Break Even** goal, so
they shipped together. `P104b2` is paused with nothing half-written.

**What changed.** `OPTIMIZER_OBJECTIVES.earliestbe` stops being a custom ranker: it is now
`metric: r => r._convBEYear ?? 9999` plus `tiebreak: ['finalRoth','netWealth','remainIRA','spend',
'lifeTax','spread']`. The hand-written two-key sort it replaced stopped at net wealth and left
everything past that in results-array order, which is the `P100b3` defect; the named chain carries
the rest of the keys and the `_id` backstop, so the order is total. `taxflex` is now the only
objective with a custom `rank`. `OPT_OBJECTIVE_COLUMNS.earliestbe` gains `finalIRA` and `finalRoth`.

**The second copy of the tie rule was the real hazard.** `optimizer_ui.js` had its own `beBetter`
for the Best table's ⏱ badge, breaking ties on net wealth. Left alone it would have gone on awarding
the badge to a row the goal no longer ranks first. It now reads `rankRows(beRows,'earliestbe')[0]`,
so badge and Rank 1 cannot disagree.

**Browser-verified on the default plan**, v11.1717, badge 🟢, 1,014 tests (525 in-page + 489 node).
Under Earliest Break Even the header reads `... End Wealth | All Taxes | Final IRA | Final Roth |
Break Even | Conv Tax`, and the 2034 tie group ranks Roth 356,982 / 356,958 / 356,824 - **rank 3
holds the highest End Wealth in the table, $1,603,660, and still sorts last**, which is the flip.
The ⏱ badge names the rank-1 row; the 💎 Most End Wealth badge names the rank-3 one, as it should.
In the 11-row 2049 group the displayed Roth is equal across ranks 10-13 while net wealth ascends:
those Roth values differ below the dollar the column rounds to, which is the only mechanism left
once break-even and Roth agree, since exactly-equal Roth would have ordered them by net wealth
descending (pinned in node).

**Suites 409 / 61 / 22**, `TestTiers.EXPECTED` and `.githooks/README.md` reconciled. One test
updated (the old one asserted the net-wealth tie) and one added, pinning that both tie keys are
columns. README's goal list restated. Changelog entry 11.1717, flagged `display`: no plan's own
numbers move, only the row order under one goal.

**Not committed** - the user has not asked for a commit.

## 2026-09-03 (cont.) - P105: one year of RMD went missing at every first death (v11.1718)

User, from a share link, mid-session: *"In 2049 it looks like it does not calculate the correct IRA
RMD. It appears it's only calculating the RMD for 'Spouse' not 'You' because it's the year 'You'
dies. However, the RMD for 'You' would be required."* Confirmed, fixed, and it is a real engine
defect rather than a display one. Full evidence in findings.md, "One year of RMD went missing at
every first death" (2026-09-03).

**The collision.** `computeIncome` inherits the decedent's IRA into the survivor's account at the
top of the year; `P84l` reads the RMD basis from the prior December 31 balance. In the first
survivor year those two disagree - the basis still has the money as the decedent's, and `yr.rmd1`
is zeroed by its own `alive1` guard - so the inherited balance is charged to nobody. One year per
death, self-healing the next year, which is why nothing ever looked broken and no test caught it.

**The user's year was off by one, and that mattered.** `alive1 = age1 <= die1` is inclusive, so
2048 (person 1 at 88) is the death year and its $154,412 RMD WAS taken. 2049 is the first survivor
year and the broken one. Getting this right is what made the fix a basis change rather than an
alive-flag change.

**Fix:** the survivor's basis gains the decedent's prior year-end balance, at the SURVIVOR's own
percentage. That is the treat-as-own election, so a survivor below their RMD age still distributes
nothing (`getRMDPercentage` returns 0), with no branch needed. The added term self-extinguishes once
the decedent's account has been empty for a full year, so later years cannot double count. The
duplicated `yr.rmd1Pct = Math.max(...)` line beside it went too.

**Measured, old vs new, on a scratch pre-fix copy of the engine:**

| fixture | inheritance-year RMD | spend | tax | final NW |
|---|---|---|---|---|
| single filer | 0 differing years | same | same | same |
| GK couple (death 2052) | +$242,194 | identical | +$49,329 | -$31,876 |
| `CAP_BASE` (death 2034) | +$78,203 | identical | -$459 | -$4,579 |
| the user's link (death 2048) | +$328,848 | identical | +$106,717 | -$41,896 |

**Browser-verified on the user's own URL at v11.1718:** 2049 RMD $10,148 -> **$283,315**
= 12.821% x ($2,130,705 + $79,151); 2050 = 13.699% x $2,102,964 with prior IRA1 at zero, so no
double count. Badge 🟢, 1,016 tests (525 in-page + 491 node).

**Two pins re-derived, both with the direction argued in the test's own comment.** `GK` tax
1,924,412 -> 1,973,741 and final NW -$31,876, spend unchanged to the cent, guardrail count still 3.
`P38` forced-IRA 30,943 -> **20,309, DOWN**, which is the `P84l` identity in reverse: `ForcedIRA`
counts the backstop, and a bigger RMD means the backstop reaches less far.

**Two tests added**, one `test.critical`, and the critical one was **verified to fail against the
pre-fix copy** - $3,151 charged where the combined basis requires $73,834. Both derive their
expected value from the run's own prior row rather than a captured dollar figure, because a magic
number would pass against any basis that happened to total the same.

**README:665 was already the spec** - it says the survivor takes over the balance and the larger
balance is subject to the survivor's RMD - so this was never a design choice being revisited.

Suites **411 / 61 / 22**, counts reconciled in `TestTiers.EXPECTED` and `.githooks/README.md`.
The branch's single changelog entry is now **11.1718**, reordered so the RMD fix leads and flagged
`behavior`; the Earliest Break Even work from earlier today is the second section of the same entry.
Still uncommitted.
