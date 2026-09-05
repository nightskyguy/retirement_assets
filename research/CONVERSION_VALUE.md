# Does converting pay? Measured on one hypothetical plan  *(P106b)*

The goal, as stated: **more Roth from the smallest reduction in net worth, with no
reduction in spending.** This report measures that on one hypothetical plan, and replaces
`_convSavings`,
which is a lifetime-tax difference that exists only on the sweep's own conversion-optimized rows and
is therefore both the wrong quantity and an artifact of the search that produced it.

**Headline: holding the strategy fixed, converting costs $49,121 of real after-tax net worth and
buys $2,459,861 of ending Roth** - 2.4% of the plan's surplus over what its spending actually needs,
and most of what it buys is a smaller tax bill for the survivor.

That is the ATTRIBUTION question: what does this one lever cost inside a fixed strategy. It is not
the only question worth asking, and on its own it is misleading about what a chooser faces. The
comparison that prompted this study set a converting plan against the highest-net-worth plan on the
board, which costs **$582,049**, and that is the CHOICE question.
[`CONVERSION_FRONTIER.md`](CONVERSION_FRONTIER.md) measures it. Both are real; they answer different
things, and section 3 sets them side by side.

---

## Reading guide

### The two baselines, and why there have to be two

"Conversions off" is ambiguous, and **the verdict flips depending on which one is meant.** Both were
measured before anything was written:

| baseline | what it does | terminal IRA |
|---|---|---:|
| **ROUTING-OFF** (`convertExcessToRoth:false`) | The strategy draws the **same** money out of the IRA and banks the surplus in the Brokerage instead of the Roth. A pure **routing** difference. | $1,589,225 |
| **DRAW-OFF** (`_cfSuppressConversions`) | The extra money is **never withdrawn**. A **draw** difference and a routing difference together. | $5,437,748 |

Both convert $0 and deliver the same lifetime spend, and their terminal IRAs are **$3,848,523**
apart. Neither is called "the" answer. This is the confound P106's groundrule 6 exists to catch, and
it is the same shape as the surplus-routing/draw-order mix-up that misread the oracle grid for three
weeks.

### Columns

| column | meaning |
|---|---|
| **dRoth (end)** | ending Roth, conversions on minus baseline |
| **dRoth (1st death)** | the same at the last married-filing-jointly year, so the "Roth earlier" half of the goal is visible |
| **dNW real** | after-tax net worth in year-0 dollars, at a **shared** heirs rate |
| **exchange** | `dRoth / -dNW`, reported only when net worth actually falls, and suppressed as `n/m` when `dNW` is under $10,000, where the ratio explodes and means nothing |
| **DOMINANT** | `dNW >= 0` and `dRoth > 0`. More Roth AND more net worth, so there is no trade to weigh |

### Controls

- **Stop year fixed at 2032 for every arm**, never each arm's own optimum. Per
  [`CONVERSION_STOP_YEAR.md`](CONVERSION_STOP_YEAR.md), that optimum is a sharp peak that relocates by
  up to 3 years under a 1% input change, so "each arm at its own best stop year" compares two
  argmaxes rather than two plans.
- **Shared heirs rate**, headline 24%, band 12%-37%. Never the default `totalNetWealth`, which discounts
  each run's IRA at that run's own final-year marginal rate and so scores different arms on different
  bases.
- **Spend asserted equal**: largest gap across every arm and baseline is **$4** on $7.0M of lifetime
  spending.

Scenario: one hypothetical household, the reference scenario throughout. CA, married, $3.44M across
two IRAs, $274k Roth, $600k brokerage on $200k basis, $100k cash, $220k spending declining 1%/yr real, strategy `fixed` = **"Reduce IRA in 11
Years"**, cyclic harvesting on, conversion taxes funded from cash. Inputs are
`.test_harnesses/fixtures/p106_canonical.json`; harness `.test_harnesses/conversion_value_harness.js`.

---

## 1. The answer, against both baselines

**Reduce IRA in 11 Years, the reference household:**

| baseline | dRoth (end) | dRoth (1st death) | dNW real | dNW %NW | exchange | verdict |
|---|---:|---:|---:|---:|---:|---|
| ROUTING-OFF | $2,459,861 | $2,234,506 | **+$484,409** | +11.70% | - | **DOMINANT** |
| DRAW-OFF | $2,459,861 | $2,234,506 | **-$49,121** | -1.05% | 50.08 : 1 | a trade |

Against ROUTING-OFF there is **no trade to weigh at all**: converting the surplus rather than banking
it in the brokerage produces more Roth *and* more net worth. Against DRAW-OFF it costs $49,121 and
returns $2,459,861 of Roth, an exchange rate of **50.08 to 1**.

The other two arms:

| arm | baseline | dRoth (end) | dNW real | exchange | verdict |
|---|---|---:|---:|---:|---|
| Ordered CIBR | either | $0 | $0 | - | identical plan, this arm never converts |
| Proportional Withdraw +% | ROUTING-OFF | $408,977 | -$811 | n/m | a trade, but a rounding-scale one |
| Proportional Withdraw +% | DRAW-OFF | $408,977 | -$159,564 | 2.56 : 1 | a trade |

**Ordered CIBR converts $0 even with conversions switched on.** An ordered strategy draws only what
the year needs, so there is no surplus for `convertExcessToRoth` to route and all three columns are
the same plan. That is a real property of the strategy rather than a defect, and it is why `B3`
broke: only one of three arms can disagree about anything.

## 2. What each arm actually holds

Balances at the end of the plan, in real year-0 dollars. Conversions and lifetime tax are marked
`*` because they are NOMINAL sums across the plan's years rather than terminal balances; no ratio in
this report mixes the two.

| arm | conversions\* | Roth | IRA | Brokerage | lifetime tax\* |
|---|---:|---:|---:|---:|---:|
| **Reduce 11yr + conversions** | $986,721 | $3,397,852 | $1,388,672 | $171,659 | $2,177,814 |
| Reduce 11yr routing-off | $0 | $937,992 | $781,793 | $2,608,339 | $2,725,875 |
| Reduce 11yr draw-off | $0 | $937,992 | $2,675,012 | $1,631,210 | $2,933,462 |
| Ordered CIBR (all three) | $0 | $937,992 | $3,031,689 | $1,964,876 | $2,886,121 |
| propwd + conversions | $174,140 | $1,346,968 | $2,692,534 | $1,339,846 | $2,706,106 |
| propwd routing-off | $0 | $937,992 | $2,480,993 | $1,868,796 | $2,966,317 |
| propwd draw-off | $0 | $937,992 | $3,020,420 | $1,637,045 | $2,886,425 |

Converting also cuts lifetime tax on this arm, by **$755,648** against DRAW-OFF. Less lifetime
tax alongside less net worth was flagged in the P106 groundrules as "not the usual conversion
signature" and needing explanation. It is not mysterious here: the conversions are paid for out of
cash and out of a brokerage that is drawn down from $1,631,210 to $171,659, so the plan trades
brokerage and its embedded gains for Roth. The tax saving is real; the net-worth cost is the
brokerage the plan no longer holds.

## 3. Two questions, not one answer and one error

The comparison that prompted this study set Ordered CIBR without conversions against Reduce 11 Years
with them. It moves **two variables at once**, and an earlier draft of this report treated that as a
mistake to be decomposed away. **That framing was wrong**, and the correction matters because the two
framings give answers an order of magnitude apart and both are right about their own question.

| question | baseline | what it measures |
|---|---|---|
| **ATTRIBUTION** | the same strategy, conversions off | what this one lever costs, holding everything else still |
| **CHOICE** | the highest-net-worth plan on the whole board | what picking a different plan costs, which is the decision actually in front of a chooser |

Decomposing the original pair answers the first:

| leg | what changes | dRoth | dNW real |
|---|---|---:|---:|
| **strategy leg** | Ordered CIBR to Reduce 11yr, conversions off in both | **$0** | **-$532,928** |
| **conversion leg** | Reduce 11yr, conversions off to on | **$2,459,861** | **-$49,121** |
| total | both at once | $2,459,861 | -$582,049 |

**All of the Roth gain is the conversion leg; 92% of the net-worth cost is the strategy leg.** That is
a true and useful attribution: inside Reduce, conversions are nearly free.

It is not a refutation of the original comparison. A person choosing a plan does not get to hold the
strategy still - they pick one whole plan over another, and the honest question is what the best plan
on the board costs them. On this household that total is **-$582,049 for +$2,459,861 of Roth, an
exchange of 4.23 to 1**, which is close to the 3.26 the original pair produced and nowhere near the
50.08 the attribution question gives. [`CONVERSION_FRONTIER.md`](CONVERSION_FRONTIER.md) measures the
choice question across the whole board and all five households.

Quote the attribution number when asking "is the conversion lever itself expensive". Quote the choice
number when asking "what am I giving up to hold more Roth". They are not interchangeable, and the
gap between them is a factor of twelve.

## 4. Against the funding floor

Groundrule 4 asks for the give-up against **surplus over need**, because the stated
willingness to trade tracks that rather than wealth: *"if my assets were smaller, I would be less
aggressive."*

Funding floor is defined here, since there is no canonical definition, as **the present value at the
plan's own 6.0% growth rate of every year's spending that guaranteed income does not cover.**

| | |
|---|---:|
| funding floor | $2,333,535 |
| starting portfolio | $4,414,000 |
| **surplus over need** | **$2,080,465** |

| arm / baseline | dNW real | % of NW | **% of surplus over need** |
|---|---:|---:|---:|
| Reduce 11yr vs routing-off | +$484,409 | +11.70% | **+23.28%** |
| Reduce 11yr vs draw-off | -$49,121 | -1.05% | **-2.36%** |
| propwd vs routing-off | -$811 | -0.02% | -0.04% |
| propwd vs draw-off | -$159,564 | -3.22% | -7.67% |

The conversion decision on the reference household costs **2.36% of the surplus over what its
spending plan needs**. That is the number the stated rule should be applied to.

## 5. Widow exposure

Both columns are reported: survivor-year tax in dollars and the survivor's marginal rate.

**The survivor window on this scenario is 2 years, 2049-2050.** `B7` predicted that would make the
column read small. It does not, and `B7` is BROKEN by a wide margin.

| arm / baseline | survivor-year tax | vs its baseline | survivor marginal |
|---|---:|---:|---:|
| **Reduce 11yr + conversions** | **$328,198** | | **30.94%** |
| vs routing-off | $261,205 | +$66,994 | 26.34% |
| vs draw-off | $708,658 | **-$380,460** | 32.92% |
| Ordered CIBR (all three) | $809,346 | $0 | 32.62% |
| propwd + conversions | $704,649 | | 32.94% |
| vs routing-off | $700,983 | +$3,666 | 32.95% |
| vs draw-off | $801,892 | -$97,244 | 32.65% |

Against DRAW-OFF, converting **more than halves the survivor's tax bill, $708,658 down to $328,198**,
over two years, and drops the survivor's marginal rate from 32.92% to 30.94%. The saving is
**7.7x the $49,121 of net worth the conversions cost.**

Two things to keep straight about that number:

- **It is not additive to dNW.** Taxes paid already reduce net worth, so this is a decomposition of
  where the value sits, not a second benefit to be added on.
- **It is a two-year window at the very end of the plan.** The same mechanism over a longer widowhood
  scales with it, and this scenario is close to the least favorable case for showing it. That is what
  `P106c`'s varied households have to carry.

Against ROUTING-OFF the sign reverses: converting *raises* survivor-year tax by $66,994, because the
baseline it is compared against has already emptied the IRA into a brokerage that generates no
ordinary income. The two baselines disagree here as elsewhere.

## 6. Heirs-rate sensitivity

Groundrule 2: if the ordering flips between plausible rates, the flip is the finding. `dNW real` at
each rate:

| arm / baseline | 12% | 22% | 24% | 32% | 37% |
|---|---:|---:|---:|---:|---:|
| Reduce 11yr vs routing-off | $557,234 | $496,546 | $484,409 | $435,858 | $405,515 |
| **Reduce 11yr vs draw-off** | **-$203,482** | -$74,848 | -$49,121 | **+$53,786** | **+$118,103** |
| propwd vs routing-off | +$24,574 | +$3,419 | -$811 | -$17,735 | -$28,312 |
| propwd vs draw-off | -$198,910 | -$166,122 | -$159,564 | -$133,333 | -$116,939 |

**The reference household's arm flips DOMINANT between 24% and 32%.** Below about 30% the conversions cost net
worth; above it they gain net worth and there is no trade at all. So the answer to "does converting
pay on this plan" is *yes outright* if the heirs face 32% or more, and *yes at 101 Roth dollars per
dollar* if they face less. The flip does not reverse the decision, it only changes whether there is a
cost to weigh - which is a mild version of the risk groundrule 2 was written for.

## Predictions, scored as written

| id | claim | verdict | evidence |
|---|---|---|---|
| `B1` | DOMINANT vs ROUTING-OFF on the reference arm | HELD | dNW +$484,409, dRoth +$2,459,861 |
| `B2` | NOT dominant vs DRAW-OFF | HELD | dNW -$49,121 |
| `B3` | baselines disagree on sign of dNW for >= half the arms | **BROKEN** | 1 of 3. Ordered CIBR never converts, so it cannot disagree about anything; the prediction assumed three live arms and there are two. |
| `B4` | conversion leg carries more dRoth than strategy leg | HELD | $2,459,861 vs $0 |
| `B5` | exchange rate vs DRAW-OFF > 3.0 | HELD | 50.08 : 1. Note this is the ATTRIBUTION rate; the choice rate against the best plan on the board is 4.23 : 1 (section 3) |
| `B6` | spend equal to within $100 | HELD | largest gap $4 |
| `B7` | survivor-year tax differs by < 5% | **BROKEN** | 53.69% on a 2-year window. The prediction was that a short widowhood would make this column uninformative; it is the strongest single result in the report. |
| `B8` | heirs-rate band flips a DOMINANT flag | HELD | Reduce 11yr vs draw-off flips between 24% and 32% |

## What this says about the question P106 was opened to answer

P106 was opened because after-tax net worth already prices Roth above IRA via the heirs rate, so an
arm that gains Roth while losing net worth is destroying value **under the model's own valuation**,
and a willingness to make that trade is rational only if net worth omits something the plan owner
values. The named candidates were the widow penalty, Roth timing, and bucket diversification.

On this plan:

1. **The premise is weaker than it looked.** Held at a fixed strategy, the conversions cost $49,121,
   which is 1.05% of net worth and 2.36% of surplus over need, and at a 32% heirs rate they cost
   nothing at all. 92% of the -$582,049 being weighed was the strategy change, not the conversions.
2. **The widow penalty is measurable and large**, even on a scenario whose survivor window is two
   years. It is inside dNW already, so it is not an omission from net worth; it is an explanation of
   why the net-worth cost is as small as it is.
3. **Roth timing shows up** in the first-death column: $2,234,506 of the $2,459,861 is already in
   place at the last married year, so this is not a terminal-value effect.
4. **Nothing here needs an unpriced motive to justify the trade.** That is a finding about this plan,
   not about conversions generally, and `P106c` is where it gets tested against households chosen to
   be different.

## Related

- [`CONVERSION_STOP_YEAR.md`](CONVERSION_STOP_YEAR.md) - why the stop year is held fixed here rather
  than optimized per arm.
- Landmines that constrain any conversion result and are not resolved by this report: `P28j` (the
  intra-year timing rule is on the wrong side about nine times in ten), `P85` (converting earlier
  still wins 353 of 499 but the RMD reasoning behind it broke, 124 counterexamples), `P100` (the
  ranking defect). All three can move a converting row.
