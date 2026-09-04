# Does the conversion result generalize? Four varied households  *(P106c)*

[`CONVERSION_VALUE.md`](CONVERSION_VALUE.md) measured whether converting pays on one plan, the
reference household. This report asks how much of that was about conversions and how much was about
that one plan.

**Answer: it generalizes, and it generalizes more strongly than the canonical scenario showed.**
Converting pays in every household that converts at all, and the one prediction registered to catch
a reversal found none. The widow mechanism the canonical scenario could only hint at is confirmed and
scales hard: on a household with a 24-year widowhood, converting saves **$3,227,336** of survivor
tax, drops the survivor's marginal rate from 30.0% to 19.3%, and is **DOMINANT** - more Roth and more
net worth, no trade to weigh.

Per P106 groundrule 1, every household is reported **separately** and none of this is averaged into
the canonical headline.

---

## Reading guide

### The households, and the axis each one varies

Chosen against a standing objection to this repo's other fixture sets, that they "were chosen as
knife-edge defaults and may not reflect real balances, ages or spend". Each is an ordinary retiree
household.

| id | household | axis it varies |
|---|---|---|
| **CANON** | the reference household. CA, married, $4.41M, 25 years, 2-year widowhood | the reference row, not a test |
| **H1-single** | single filer, CA, $2.41M, 29 years, **no survivor transition at all** | filing status. Single brackets apply for the whole plan rather than only after a death, so this separates "compressed brackets" from "the widow penalty" |
| **H2-longwidow** | 13-year age gap, TX, $3.62M, 38 years, **24-year widowhood** | the widow axis, and the one P106b could not test. TX has no state income tax, so the effect is federal only |
| **H3-IRAlight** | NY, married, $3.68M, 27 years, **$700k IRA against $2.6M brokerage** | the IRA-to-taxable ratio, reversed from the canonical |
| **H4-tight** | CA, married, **$1.62M**, 29 years, little surplus over need | the surplus-over-need axis. The stated rule is that willingness to trade tracks surplus rather than wealth: *"if my assets were smaller, I would be less aggressive"* |

Built by overriding named fields on `.test_harnesses/fixtures/p106_canonical.json`, which is itself
the verbatim output of the page's own `getInputs()`. Nothing re-decodes a share URL, so every field
not named above keeps a value the real decoder produced.

All three arms succeed in every household. Spend is equal to within **$5** everywhere.

### The two baselines and the columns

Carried over unchanged from [`CONVERSION_VALUE.md`](CONVERSION_VALUE.md), where they are defined in
full:

- **ROUTING-OFF** (`convertExcessToRoth:false`) draws the same money out of the IRA and banks the
  surplus in the Brokerage. A pure routing difference.
- **DRAW-OFF** (`_cfSuppressConversions`) never withdraws it. A draw difference and a routing
  difference together.
- **DOMINANT** means `dNW >= 0` and `dRoth > 0`: more Roth *and* more net worth, so there is no trade.
- **exchange** is `dRoth / -dNW`, suppressed when `dNW` is under $10,000.

Shared heirs rate 24% for the headline, band 12%-37%. Stop year held fixed per household, per
[`CONVERSION_STOP_YEAR.md`](CONVERSION_STOP_YEAR.md).

Harness: `.test_harnesses/conversion_value_general_harness.js`.

---

## Side by side

Each column is its own household. **Not averaged.**

| metric | CANON | H1-single | H2-longwidow | H3-IRAlight | H4-tight |
|---|---:|---:|---:|---:|---:|
| converted | $986,721 | $443,232 | $1,609,197 | **$0** | $193,814 |
| dRoth (end) | $5,000,390 | $2,054,804 | $14,360,414 | $0 | $1,129,853 |
| dNW vs ROUTING-OFF | +$484,409 | +$178,388 | +$805,493 | $0 | -$12,516 |
| **dNW vs DRAW-OFF** | -$49,121 | -$51,274 | **+$95,632** | $0 | -$36,411 |
| as % of surplus over need | -2.36% | -6.69% | +8.86% | 0.00% | **-13.16%** |
| **exchange vs DRAW-OFF** | 101.8 : 1 | 40.1 : 1 | **DOMINANT** | - | 31.0 : 1 |
| survivor window | 2y | none | **24y** | 4y | 4y |
| survivor tax saved | $380,460 | - | **$3,227,336** | $0 | $84,388 |
| survivor marginal | 30.9% vs 32.9% | - | **19.3% vs 30.0%** | 22.4% vs 22.4% | 20.0% vs 21.0% |

## 1. Converting pays in every household that converts at all

`C8` was registered specifically to catch a reversal, predicting at least one household where
converting does not pay. **There is none.** Exchange rates against DRAW-OFF are 101.8:1, 40.1:1,
DOMINANT, and 31.0:1; against ROUTING-OFF, three of four are DOMINANT outright.

That is a stronger generalization than the canonical scenario alone justified, and it is worth being
precise about what it does and does not say. It says that **within this engine, on these five
households, with spending held equal and the stop year held fixed**, routing surplus into a Roth beat
not doing so every time it was possible at all. It does not say conversions are universally good, and
the landmines listed at the end can each move a converting row.

## 2. The widow mechanism is confirmed, and it scales with the window

This is the clearest result in the report. Ordering the households by survivor window:

| household | survivor window | survivor tax saved | survivor marginal, converted vs not |
|---|---:|---:|---|
| H1-single | none | - | no survivor transition exists |
| CANON | 2 years | $380,460 | 30.9% vs 32.9% |
| H3-IRAlight | 4 years | $0 | 22.4% vs 22.4% (converts nothing) |
| H4-tight | 4 years | $84,388 | 20.0% vs 21.0% |
| **H2-longwidow** | **24 years** | **$3,227,336** | **19.3% vs 30.0%** |

On H2 the survivor's average marginal rate falls by **10.6 percentage points** for 24 years. That is
the widow penalty being avoided rather than merely deferred, and it is why H2 is the one household
where converting is DOMINANT against both baselines: it gains $95,632 of net worth *and* $14,360,414
of Roth.

**H1 is the control that makes this readable.** A single filer has no survivor transition at all, so
none of its benefit can be the widow penalty - and converting still pays there at 40.1:1. So the
value of converting has at least two separate sources: compressed brackets, which H1 has for its
whole plan, and the widow penalty, which H2 has for 24 years. They add.

## 3. Two households where the answer is different in kind

**H3 converts nothing at all.** Not less - zero. With $700k of IRA against $2.6M of brokerage, the
"Reduce IRA in 11 Years" strategy drains the IRA into spending and never produces a surplus for
`convertExcessToRoth` to route. Every column is $0 and all three arms are the same plan. `C3`
predicted "under 25% of the canonical's dRoth" and held, but the mechanism is more absolute than the
prediction imagined: **for an IRA-light household this strategy offers no conversion program to
evaluate.** That is a fact about the strategy, not about conversions.

**H4 is where that rule bites.** The same decision that costs the canonical scenario 2.36% of its
surplus over need costs H4 **13.16%** - 5.6x more of the thing that appetite is said to track. In absolute terms H4 gives up less ($36,411 against $49,121); as a share of what it has spare
after funding its own spending, it gives up far more. `C4` held. This is the quantified form of *"if
my assets were smaller, I would be less aggressive"*, and it is the number that rule should be
applied to.

H4 is also the only household whose heirs-rate band never flips: it is a cost at every rate from 12%
to 37%.

## 4. The baseline ambiguity is real but not universal

`C5` predicted the ROUTING-OFF / DRAW-OFF sign disagreement would recur in at least half the
households. **BROKEN: 2 of 5.**

It disagrees where the conversion program is a genuine trade (CANON, H1) and agrees where it is not:
H2 is positive against both, H3 is zero against both, H4 negative against both. So the ambiguity is
not an artifact of the canonical scenario, but it is not structural either - it appears in the
middle, where the draw and the routing pull in opposite directions.

**The practical rule survives unchanged: a conversion claim that names only one baseline is
under-specified**, because you cannot tell in advance which case you are in.

## 5. Heirs-rate sensitivity

`dNW` against DRAW-OFF, by household:

| household | 12% | 22% | 24% | 32% | 37% | flips? |
|---|---:|---:|---:|---:|---:|---|
| CANON | -$203,482 | -$74,848 | -$49,121 | +$53,786 | +$118,103 | yes |
| H1-single | -$112,756 | -$61,521 | -$51,274 | -$10,286 | +$15,331 | yes |
| H2-longwidow | -$129,054 | +$58,185 | +$95,632 | +$245,423 | +$339,042 | yes |
| H3-IRAlight | $0 | $0 | $0 | $0 | $0 | no |
| H4-tight | -$63,979 | -$41,005 | -$36,411 | -$18,032 | -$6,545 | no |

Three of five flip, and all three flip the same way: converting goes from a cost to a gain as the
heirs rate rises. The crossover sits between 12% and 22% for H2, between 24% and 32% for the
canonical, and between 32% and 37% for H1. **The heirs rate never reverses the recommendation, only
whether there is a price to pay for it** - which is the mild version of the risk groundrule 2 was
written for.

## Predictions, scored as written

| id | claim | verdict | evidence |
|---|---|---|---|
| `C1` | single filer still shows conversions paying | HELD | 40.07 : 1 with no survivor transition at all |
| `C2` | long widowhood saves more survivor tax than canonical | HELD | $3,227,336 over 24y against $380,460 over 2y |
| `C3` | IRA-light dRoth under 25% of canonical | HELD | $0. The strategy generates no surplus to convert |
| `C4` | tight funding gives up more of its surplus | HELD | -13.16% against -2.36% |
| `C5` | baseline ambiguity is structural (>= half disagree) | **BROKEN** | 2 of 5. It appears where the program is a genuine trade and not where it is clearly one-sided |
| `C6` | no household DOMINANT vs DRAW-OFF at 24% | **BROKEN** | H2 is. On a long widowhood there is no trade to weigh at all |
| `C7` | spend equal within $100 everywhere | HELD | largest gap $5 |
| `C8` | at least one household reverses the verdict | **BROKEN** | none. Converting pays in every household that converts at all |

`C6` and `C8` both broke in the same direction, toward conversions being better than predicted. That
is worth flagging rather than celebrating: the household set is five plans in one engine, chosen by
the same person who wrote the predictions, and three of the five share the canonical scenario's
strategy and spending shape.

## What this changes about the P106b conclusion

P106b concluded that on the reference household, nothing needs an unpriced motive to justify
converting - the trade is cheap on its own terms. That survives, and two things sharpen it:

1. **The widow penalty is the largest single source of the benefit, and the canonical scenario is
   nearly the worst case for seeing it.** A 2-year window showed $380,460; a 24-year window shows
   $3,227,336 and turns the whole decision DOMINANT. Anyone reading the canonical numbers as the
   general case is understating this.
2. **The cost should be quoted against surplus over need, not against net worth.** The same decision
   is 2.36% of surplus for the canonical household and 13.16% for the modest one, while the absolute
   dollars move the other way. Net worth alone inverts the ranking of who can afford it.

## Landmines, unchanged

None of these are resolved by this report and each can move a converting row: `P28j` (the intra-year
timing rule is on the wrong side about nine times in ten), `P85` (converting earlier still wins 353
of 499, but the RMD reasoning behind it broke, 124 counterexamples), `P100` (the ranking defect), and
`P106a` (the stop year, held fixed here precisely because its optimum is a moving peak).
