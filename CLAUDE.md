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

## One changelog entry per RELEASE, not per commit

Everything built between one release and the next accrues into a **single** entry in
`optimizer_changelog.md` and its matching `<li>` in the page - across commits, across sessions,
across days. Edit that entry in place. The version stamp may be refreshed with each change (the
`<title>` and the entry keep matching), but a refreshed stamp is a new number on the same entry, not
a second entry.

On 2026-08-24 one unmerged branch carried four entries - 11.161B, 11.161G, 11.1628, 11.162A - one per
commit. That numbers the development rather than the release, and it buried the two things a reader
needed under two fixes to code that had never shipped.

**Order by what matters to the reader**, not by build order or by difficulty. New capability first.
Fixes to things nobody outside the branch ever saw go last, one line each, or not at all.

**Leave out**, always:

| don't write | because |
|---|---|
| how it used to work | the reader wants what it does now. One exception: something they must act on, e.g. a saved plan that will not reproduce - then state it as consequence, not history |
| the internals of the change | function, file and variable names, the mechanism, the defect, test counts, phase IDs. That belongs in the commit message and `progress.md`, which already carry it |
| an argument for why the change is good | state what it is |

Target for a whole release entry: **about 150 words.** A 954-word entry was rejected once already.

