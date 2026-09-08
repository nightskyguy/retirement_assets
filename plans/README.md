# The plan bank

Reference households for studies to measure on, and for anyone who wants to load a realistic plan
into the tool and press buttons.

**Why this directory exists.** Studies here used to run on the page's shipped defaults. Those
defaults are a *teaching* scenario - built to show a user the tradeoffs needed to reach a viable
plan, and strained on purpose - and using one as a measurement fixture produced four dead results in
a single day: a feature scored at $0 because the household converts nothing in the only window that
feature is legal in; ending-IRA and peak-IRA measures that said nothing because the IRA drains to
zero and peaks in year 0; a bucket-spread objective that could not be read because the household
ends 100% Roth; and 189 of 270 households skipped because the crossed spend rate could not be
funded. None of those were arithmetic errors.

**So the rule is: choose a household deliberately, and read its card before you measure on it.**

## The plan card

Every file exports one `PLAN` with an `inputs` object and a `notes` card. The card has two
audiences and the split is the point.

| field | who reads it |
|---|---|
| `summary` | **a person.** One sentence, plain language. Loading a plan writes this into the tool's own Notes box, and it is the only field that ever reaches a user |
| `exercises` | whoever is choosing a household: what this plan is good FOR |
| `cannotShow` | **the field that saves a wasted study.** What this plan structurally cannot answer, whatever the arithmetic says |
| `viability` | measured, never asserted: years funded, whether it funds every year, ending and peak IRA, ACA breach count |
| `origin` | which harness or report the household came from, so a number in a report traces back to the plan that produced it |

`viability` is **re-measured by running the plan**, not typed in. If an engine change moves it, the
card is stale and the number in it is the evidence that it is.

## Using them

```js
const { get, viable, withLiveIRA } = require('./plans');
simulate(get('long-widowhood').inputs);
```

`list()` returns all of them, `viable()` only the ones that fund every year, and `withLiveIRA()`
only the ones an ending-IRA or peak-IRA measure can be read on. `get()` throws on an unknown id
rather than returning `undefined`, because a typo would otherwise run a whole study on nothing.

Files are dual-mode, the repo's classic-script contract: `require()` in node, `window.Plans` in a
browser, no build step.

## The bank

The table lists only the FIRST `cannotShow` entry; open the file for the rest.

| plan | what it is | first thing it cannot show | funded | ending IRA |
|---|---|---|---|---|
| [`aca-gap-years-texas-early-ss`](aca-gap-years-texas-early-ss.js) | A Texas couple retiring at 57 who claim Social Security at 62, while an ACA subsidy cap is still in force. | the cap and the benefit as separable effects - by construction they overlap here | 39/39 | $10,843,773 |
| [`aca-gap-years-texas`](aca-gap-years-texas.js) | A Texas couple retiring at 57 and holding income under an ACA subsidy cap until Medicare. | THE ACA DEFINITION OF MAGI. Both claim Social Security at 67 and the cap lapses at 65, so no benefit is ever paid inside a capped year and the untaxed-benefit add-back is always $0. Use the early-claim sibling for that | 39/39 | $9,965,829 |
| [`balanced-thirds-couple`](balanced-thirds-couple.js) | A California couple with their money split roughly evenly between IRA, Roth and brokerage. | the widow penalty at full strength - the survivor inherits a portfolio that is already diversified | 33/33 | **$0** |
| [`bracket-filler-texas-cyclic`](bracket-filler-texas-cyclic.js) | A Texas couple filling the 22% bracket with a $900k brokerage account and Cycle Brokerage turned on. | the plain sizing line in a harvest year - by construction the harvest branch preempts it | 33/33 | $4,524,864 |
| [`bracket-filler-texas`](bracket-filler-texas.js) | A Texas couple filling the 22% federal bracket every year, with no state income tax. | state-tax interactions of any kind - Texas has none | 33/33 | **$0** |
| [`brokerage-heavy-couple`](brokerage-heavy-couple.js) | A California couple whose wealth is mostly in a taxable brokerage account. | conversion sizing at scale - $1M of IRA is spent down rather than converted | 33/33 | **$0** |
| [`canonical-conversion-study`](canonical-conversion-study.js) | The reference household for the conversion studies: California, $3.44M of IRA, spending $220k and declining. | the widow penalty at strength - two years is barely a window; see the long-widowhood plan for that | 25/25 | $2,822,885 |
| [`high-spend-large-ira`](high-spend-large-ira.js) | A California couple with $4.2M of IRA and $240k of annual spending. | low-bracket behavior of any kind - this household never visits the bottom of the ladder | 26/26 | $6,575,722 |
| [`ira-heavy-couple-overreaching`](ira-heavy-couple-overreaching.js) | A California couple with $4.2M of IRA who spend $292k a year and run out of money before the plan ends. | ANY ranking question. It is here as the control that must be excluded, not as a household to measure on | 23/33 **fails** | **$0** |
| [`ira-heavy-couple`](ira-heavy-couple.js) | A California couple in their early sixties with almost all of their money in traditional IRAs. | anything about brokerage draw order or basis step-up - there is only $100k of it | 33/33 | $1,656,142 |
| [`irmaa-tier-filler`](irmaa-tier-filler.js) | A California couple holding income just inside an IRMAA tier. | the ACA cap - both are on Medicare, which is the point of an IRMAA study | 26/26 | $4,330,394 |
| [`long-widowhood`](long-widowhood.js) | A Texas couple thirteen years apart in age, so one of them spends 24 years filing as a single survivor. | state-tax interactions | 38/38 | $2,400,220 |
| [`mixed-portfolio-couple`](mixed-portfolio-couple.js) | A California couple with a real brokerage account alongside a large IRA. | ending-IRA or peak-IRA measures - the IRA drains to zero and peaks in year 0 | 33/33 | **$0** |
| [`modest-balances-little-surplus`](modest-balances-little-surplus.js) | A California couple whose portfolio is not much larger than the spending it has to fund. | large-conversion behavior - there is no room for one | 29/29 | $1,931,291 |
| [`ordered-sequence-texas`](ordered-sequence-texas.js) | A Texas couple drawing from their accounts in a strict order rather than by rule. | third-pass forced-draw behavior - Ordered is exempt from it by design | 29/29 | $1,799,267 |
| [`single-filer-long-horizon`](single-filer-long-horizon.js) | A single filer with a $3M IRA and thirty funded years ahead. | the widow penalty, or anything about filing-status change - there is one person | 30/30 | $2,690,759 |
| [`single-filer-no-survivor`](single-filer-no-survivor.js) | A single Californian, so the compressed single brackets apply for the whole plan rather than only after a death. | anything about a survivor - there is nobody to survive | 29/29 | $2,067,681 |
| [`soft-cap-underfunded`](soft-cap-underfunded.js) | A California couple whose spending cannot be met inside their chosen bracket ceiling. | ranking against other households. It does not fund its last year, ON PURPOSE - the shortfall is the subject | 23/24 **fails** | **$0** |
| [`taxable-heavy-new-york`](taxable-heavy-new-york.js) | A New York couple whose wealth is mostly already taxed: $700k of IRA against $2.6M of brokerage. | conversion sizing at scale - the strategy leaves almost no surplus to route, so this household converts nothing under several strategies | 27/27 | $1,631,658 |

## Adding one

1. Write the file, following the shape of any existing one.
2. **Measure** `viability` by running the plan. Do not copy the numbers from a similar plan.
3. Fill in `cannotShow` honestly. "I could not think of anything" means the card is not finished -
   every household in this table has at least one entry, including the good ones.
4. Add it to `index.js` and to the table above, in the same commit.

One card here was first written claiming its household could show the ACA definition of MAGI. It
could not: it claims Social Security at 67 while its cap lapses at 65, so the benefit is never paid
inside a capped year and the add-back is $0 in every one of them. Checking the claim against the
plan's own inputs is the only reason there is now a second plan,
[`aca-gap-years-texas-early-ss`](aca-gap-years-texas-early-ss.js), that really can show it - $22,514 at
its largest. **Check the card against the inputs, not against the intention.**
