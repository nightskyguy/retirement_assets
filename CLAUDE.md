# Repo conventions

Short rules that outlive any one change. Each one is here because it was broken at least once.

## Test counts are pinned in more than one place, and in more than one tool

`TestTiers.EXPECTED` in `optimizer_tests.js` holds the exact test count of **every** node suite in
this repo. The self-check badge on `retirement_optimizer.html` compares it against what the suites
actually report and turns red, not green-with-a-warning, on any drift.

**Adding or removing a test means reconciling all of those numbers, not only the one belonging to
the tool you are working on.** The suites cover different tools: `taxPaymentPlanner.tests.js` covers
`RetirementTaxPlanner.html`, a page the Optimizer never loads. On 2026-08-17 a Tax Payment Planner
release added 2 tests, left `taxPaymentPlanner: 32` in place, and reddened the Optimizer's badge
without editing a single Optimizer file.

In the same commit as the test change:

1. Run all five suites and use the printed totals. Measure, never guess.
   ```sh
   node optimizer_core.tests.js && node taxengine.tests.js && node taxPaymentPlanner.tests.js && node doclinks.tests.js && node feedback.tests.js
   ```
2. Update every entry in `TestTiers.EXPECTED`, `slowInCore` included.
3. Update the suite table in `.githooks/README.md`, which carries the same counts as documentation.

## "Hover over", never "hover" on its own

In user-facing text - tooltips, changelog entries, README, in-page help copy - the verb takes
"over".

| yes | no |
|---|---|
| Hover over the row | Hover the row |
| Hovering over a line names it | Hovering a line names it |
| hover over the indicator for the count | hover the indicator for the count |
| the hover-over data | the hover readout |

"Hover the row" reads as though the row is the thing doing the hovering, or the thing being held
aloft. "Hover over the row" says what the reader actually does, and is the standard US English
form. Noun and adjective forms keep the particle: "the hover-over data", "on hover over the line".

Code identifiers are never rewritten: `:hover`, `mouseover`, `onHover`, `hoverRadius`,
`hoverBackgroundColor` and friends stay exactly as the language and Chart.js spell them. Internal
code comments are not user-facing and are not worth churn, but new ones may as well follow the rule.

## One changelog entry per BRANCH, written against `main`

A branch gets **one** entry in `optimizer_changelog.md` and one matching `<li>` in the page. That
entry describes the difference between `main` and the branch **as an end user would experience it**,
ordered by how much it affects them. Not what was built first, not what was hardest, not what the
commits happened to be.

Everything after the first commit edits that entry in place. The version stamp may be refreshed with
each change (the `<title>` and the entry keep matching), but a refreshed stamp is a new number on the
same entry, never a second entry. A new branch starts a new entry.

**A multi-pass effort is ONE entry, not one per pass.** When a single piece of work ships as a run of
stacked branches - a review's fix order, a refactor done in steps, anything numbered "step n of m" -
every user-visible change across the whole run accumulates into the **same** entry, edited in place
and restamped, no matter how many branches and PRs it takes. Keep bumping the version; do not open a
second entry. The page shows only the most recent five or six, so ten passes each claiming an entry
would push every genuinely different release off the list and leave a reader paging through one
refactor (user, 2026-09-22). A pass with nothing user-visible in it adds nothing at all: it takes a
version stamp and no entry.

The scope test is mechanical: **if it does not show up in `git diff main...HEAD` as something a user
can see or feel, it does not go in the changelog.** Work that fixes something introduced earlier on
the same branch nets out to zero against `main` and is not reportable at all - there is only the
final behavior. A fix to something already released IS reportable; check `main` or the live site
before assuming either way, because "was this ever broken for a user" is not answerable from memory.

On 2026-08-24 one unmerged branch carried four entries - 11.161B, 11.161G, 11.1628, 11.162A - one per
commit, which numbered the development rather than the change, and buried the two things a reader
needed under two fixes to code that had never shipped.

**Leave out**, always:

| don't write | because |
|---|---|
| how it used to work | the reader wants what it does now. One exception: something they must act on, e.g. a saved plan that will not reproduce - then state it as consequence, not history |
| the internals of the change | function, file and variable names, the mechanism, the defect, test counts, phase IDs |
| an argument for why the change is good | state what it is |
| what you checked and found CORRECT | nothing changed for that reader, so it is not news. "Arizona and North Carolina were checked and are correct" was cut from the 11.1933 entry: taken as a convention it would list every state on nearly every release (user, 2026-09-25). The checking goes in the commit message and the PR |
| anything behind the nerdknob, or the word "nerdknob" | `?nerdknob` gates experimental, UNRELEASED features; a reader without it cannot see them, and the changelog is the released tool's. Describe only what everyone gets (user, 2026-09-19) |

None of that is lost: **the commit messages carry the intermediate detail**, in as much depth as the
work deserves - what was corrected mid-branch, why an approach changed, what was measured. That is
the audit trail. The changelog is for the person deciding whether this release touches their plan.

Target for a whole entry: **about 150 words.** A 954-word entry was rejected once already.
## README.md describes released features only; the nerdknob lives in ExperimentalFeatures.md

`?nerdknob` gates experimental, unreleased features. README.md is the public document: it describes
what every reader of the page gets, and never names the nerdknob or a control behind it, unless the
user pre-approves a mention. Anything gated goes in `ExperimentalFeatures.md`, which exists for that.
The same rule already governs the changelog (above). On 2026-09-20 a PR review found two nerdknob
sections in README.md (the risk-based spend rule and its rule table) and had them moved.

## A research report in `research/` is written for a reader who has none of the context

Three rules, all three added on 2026-08-29 after a read-through found every one of them broken
somewhere. They apply to every file in `research/`, and to any new one a harness produces.

### Name the file for its SUBJECT, never for the phase

`P32_RESULTS.md` and `P28_RESULTS.md` told a reader nothing, and were renamed for what they were
about. Both were later retired, so read `CONVERSION_STOP_YEAR.md` and `PERFECT_FORESIGHT_ORACLE.md`
for the shape a name should have.

**Treat the phase ID as information the reader does not have.** It may appear inside the file - as a
parenthetical on the title, and freely in the body where it points at `task_plan.md` - but nothing a
reader needs in order to find or choose the file may depend on knowing it. The `_RESULTS` suffix is
dropped as well: every file in that directory is one, so repeating it in fifteen filenames carries
no information.

### Define every code before its first use

Prediction ids (`C2`, `S1-P4`, `E-P3`, `R12`), normalization ids (`N1`, `N2`, `N3`), arm and mix
names, grid knobs (`k`, `S`, `b20`). A report that scores **"C2 is BROKEN"** in section 4 and first
states what C2 claimed in section 8 is not readable on its own, and that is exactly what
`CONVTIMING_RESULTS.md` did. `N1` appeared twice and was never defined at all.

The fix that works is a **reading guide near the top** - one block of small tables defining the
codes, the arms and the grid - with the verdict tables later pointing back at it. Rearranging the
results is not required and usually makes them worse.

Watch for id series that collide: a bare `P5` has meant both a prediction and a phase in the same
sentence. Say which, or rename one.

### Add the report to `research/README.md` in the same commit

`research/README.md` is the index: one row per report, a link and one or two sentences on what it
covers and what it found. A new harness that writes a report and does not add its row has produced a
file nobody will open. An index nobody updates is worse than no index.

## A bracket table's last row is an open top band, and IRMAA's first row is tier ZERO

Two facts about `TAXData` that get re-derived wrongly, and were again on 2026-09-22 by a pass that
read the IRMAA ladder fresh and reported a defect that is not one (owner corrected it the same day).

**Every bracket table terminates at `{ l: Infinity }`** - FEDERAL, all 51 state tables, IRMAA. `l`
is a FLOOR, so nothing ever lands on that row: it exists so "the ceiling of band n" can be written
`brackets[n + 1].l` for every n, including the last. It is not a band, it is the absence of a
ceiling. A lookup that never returns it is correct, not broken.

**The consequence is what actually bites:** the top band has a floor and no ceiling, and this
codebase's ceiling-fillers aim AT a ceiling or just under it. Asked to fill the top federal bracket
or the top IRMAA tier, `computeBracketCeiling` gets `Infinity` and there is nothing to fill up to.
That is handled, not avoided - `nominalRateAtLimit` has a `limit = Inf` branch returning the
jurisdiction's top marginal rate, and the `$NaN` it once printed is a shipped fix. Any new code that
reads a ceiling must cope with `Infinity` rather than assume a number.

**IRMAA's `-none-` row is TIER ZERO.** No fee, no tier. There are five surcharge tiers, 1 to 5, and
`stratIRMAATier` indexes them that way. Published tables are split on this - some count the
below-IRMAA band as the first one - so a figure quoted from outside is off by one until you check
which convention it used.

Both are stated at the table in `taxengine.js` and pinned by `TEST CASE 25c` in
`taxengine.tests.js`. `Retirement_Projection.html` drops `-none-` and the `Infinity` row when it
lists tiers to choose from, which is the same judgment made in a different place.

## A code comment says what the code does now, and names functions, never lines

A comment carries two things: what the code does today, and the constraint that would break if
someone changed it ("applied AFTER `applyGrowth`, because this shift IS growth, so adding it before
would grow it twice"). Everything else about the code's past goes in the commit message, and in
`research/` when a later decision will need the evidence.

| write | not |
|---|---|
| what the code does, and the one constraint that breaks it | how the constraint was found, what it cost, which version got it wrong |
| a function or field: "the ACA branch of `computeBracketCeiling`" | a line number: "`optimizer_core.js:1040`" |
| a pointer to the evidence: "see `research/CONSTANT_SPLIT.md`" | the measurements, dates, phase ids and "(user, ...)" quotes themselves |
| a file tracked on `main` | a harness or script that has been retired |

A line number is wrong after the next edit above it, and a retired file is a dead end. The
code-quality review of 2026-09-21 (`.planning/CODE_QUALITY_REVIEW.md`, section 3) found
`optimizer_core.js` at 3,435 comment lines against 3,429 lines of code, 5,219 comment lines across
the production files in blocks that narrate history, 15 of 15 line-number cites pointing at the
wrong line, and eight comments naming harness files that no longer exist.

Existing blocks get trimmed to this shape one at a time (that review's section 3.3 and Appendix A).
Until a block's turn comes, a comment you edit is rewritten to this shape, and a new one is written
to it from the start.
