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
