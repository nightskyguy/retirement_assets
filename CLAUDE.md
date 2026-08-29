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

1. Run all three suites and use the printed totals. Measure, never guess.
   ```sh
   node optimizer_core.tests.js && node taxPaymentPlanner.tests.js && node doclinks.tests.js
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

None of that is lost: **the commit messages carry the intermediate detail**, in as much depth as the
work deserves - what was corrected mid-branch, why an approach changed, what was measured. That is
the audit trail. The changelog is for the person deciding whether this release touches their plan.

Target for a whole entry: **about 150 words.** A 954-word entry was rejected once already.
## A research report in `research/` is written for a reader who has none of the context

Three rules, all three added on 2026-08-29 after a read-through found every one of them broken
somewhere. They apply to every file in `research/`, and to any new one a harness produces.

### Name the file for its SUBJECT, never for the phase

`P32_RESULTS.md` and `P28_RESULTS.md` told a reader nothing. They are now `BROKERAGE_DRAW.md` and
`CONVERSION_ROUTING.md`.

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
