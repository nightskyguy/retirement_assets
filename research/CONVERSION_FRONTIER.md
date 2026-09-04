# What does the lost net worth actually buy?  *(P106f)*

[`CONVERSION_VALUE.md`](CONVERSION_VALUE.md) holds the withdrawal strategy fixed and switches
conversions off. That answers **what the conversion lever costs inside a strategy**. It is an
attribution, and on its own it is misleading about the decision a person actually faces, which is:

> Here is the plan with the highest net worth available to me. I am going to pick a different one
> because it holds more Roth. What is that costing me?

That is a **choice** between two whole plans, not an attribution of one lever, and the two give
answers a factor of twelve apart on the same household. This report measures the choice.

**Headline: choosing the highest-Roth plan over the highest-net-worth plan costs between 2.07% and
14.69% of net worth across five households, and buys between 2.36 and 32.74 dollars of Roth per
dollar given up. The best-net-worth plan is a non-converting plan in all five.**

---

## Reading guide

| term | meaning |
|---|---|
| **the board** | 10 strategies x {conversions on, off}, every combination the inputs can express |
| **BEST-NW** | the argmax of real after-tax net worth over the whole board. The plan a net-worth maximizer picks |
| **BEST-Roth** | the plan on the board holding the most Roth |
| **exchange** | `dRoth / -dNW` between those two. Roth dollars bought per dollar of net worth given up |

Real year-0 dollars throughout, shared 24% heirs rate, spend checked rather than assumed. Households
are the same five as [`CONVERSION_VALUE_HOUSEHOLDS.md`](CONVERSION_VALUE_HOUSEHOLDS.md), so the two
read side by side. Harness `.test_harnesses/conversion_frontier_harness.js`.

**A BEST-NW comparison deliberately moves more than one variable, and that is the point.** It prices
a choice between whole plans. Attribution still needs the equalized pairs in `CONVERSION_VALUE.md`.
Both are needed; neither replaces the other.

---

## The choice, per household

| household | BEST-NW plan | BEST-Roth plan | net worth given up | Roth gained | exchange |
|---|---|---|---:|---:|---:|
| **CANON** | Ordered CIBR | Reduce IRA 11yr | -$582,049 (-11.18%) | +$2,459,861 | **4.23 : 1** |
| **H1-single** | Fill Bracket 22% | Reduce IRA 11yr | -$380,191 (-14.69%) | +$898,107 | **2.36 : 1** |
| **H2-longwidow** | Ordered CIBR | Reduce IRA 11yr | -$146,930 (-2.07%) | +$4,810,494 | **32.74 : 1** |
| **H3-IRAlight** | Ordered CBIR | Proportional +% | -$574,586 (-8.77%) | +$287,522 | **0.50 : 1** |
| **H4-tight** | Fixed % | Fill Bracket 22% | -$147,259 (-9.26%) | +$560,257 | **3.80 : 1** |

Two things stand out.

**The long-widowhood household is where this trade is cheap.** H2 gives up 2.07% of net worth and
gains $4.8M of Roth, 32.74 to 1 - five to thirteen times better than any other household. It is the
same mechanism `CONVERSION_VALUE_HOUSEHOLDS.md` found in the widow column, showing up now as the
price of the plan choice rather than of the lever.

**The IRA-light household is where it is a bad trade, and it is the only one.** H3 gives up $574,586
to gain $287,522 of Roth - **0.50 to 1**, half a Roth dollar per dollar surrendered. With $700k of IRA
against $2.6M of brokerage there is little to convert and little widow exposure to avoid, so the
give-up buys almost nothing. Anyone whose wealth is already mostly taxable should not read the other
four rows as applying to them.

## The whole board, canonical household

Ranked by real after-tax net worth. `on`/`off` rows that are identical mean the strategy generates no
surplus to convert, so conversions are inert for it.

| plan | conv | NW real | Roth | IRA | Roth+Brok+Cash | vs best |
|---|---|---:|---:|---:|---:|---:|
| **Ordered CIBR** | on | **$5,206,952** | $937,992 | $3,031,689 | $2,902,868 | - |
| Ordered CIBR | off | $5,206,952 | $937,992 | $3,031,689 | $2,902,868 | -$0 |
| Split B90/C10 | off | $5,168,112 | $934,170 | $3,627,172 | $2,411,462 | -$38,840 |
| Split B90/C10 | on | $5,168,112 | $934,170 | $3,627,172 | $2,411,462 | -$38,840 |
| Fill Bracket 22% | on | $5,144,502 | $937,992 | $3,118,883 | $2,774,151 | -$62,450 |
| Fill Bracket 22% | off | $5,144,502 | $937,992 | $3,118,883 | $2,774,151 | -$62,450 |
| Fill Bracket 24% | on | $5,144,502 | $937,992 | $3,118,883 | $2,774,151 | -$62,450 |
| Fixed % | off | $5,137,989 | $937,992 | $2,861,742 | $2,963,065 | -$68,963 |
| Ordered BCIR | on | $5,130,729 | $937,992 | $3,617,421 | $2,381,489 | -$76,222 |
| Fixed % | on | $5,127,850 | $1,013,522 | $2,972,125 | $2,869,035 | -$79,101 |
| IRMAA Tier 1 | on | $5,088,959 | $937,992 | $3,069,721 | $2,755,971 | -$117,993 |
| Proportional +% | off | $4,792,571 | $937,992 | $2,480,993 | $2,907,016 | -$414,381 |
| Proportional +% | on | $4,791,760 | $1,346,968 | $2,692,534 | $2,745,434 | -$415,192 |
| **Reduce IRA 11yr** | **on** | $4,624,903 | **$3,397,852** | $1,388,672 | **$3,569,511** | -$582,049 |
| Reduce IRA 11yr | off | $4,140,494 | $937,992 | $781,793 | $3,546,331 | -$1,066,458 |

**Only three of ten strategies convert anything at all** on this household: Reduce, Fixed % and
Proportional. For the other seven the `on` and `off` rows are the same plan, because they draw only
what the year needs and leave no surplus for `convertExcessToRoth` to route. That is why the
converting plans cluster at the bottom of a net-worth ranking: the strategies that convert are also
the strategies that draw the IRA down hardest, and the ranking is picking up the withdrawal
behavior, not the conversion.

Note the last column. **Reduce with conversions holds the most Roth+Brokerage+Cash on the board**
($3,569,511) while ranking fourteenth by net worth. If the premise is that a dollar of Roth or
brokerage is worth more than a dollar of IRA, the net-worth ranking is not measuring the thing being
optimized for.

## Predictions, scored as written

| id | claim | verdict | evidence |
|---|---|---|---|
| `D1` | canonical BEST-NW is a NON-converting plan | HELD | Ordered CIBR, converted $0 |
| `D2` | BEST-NW is a CONVERTING plan somewhere | **BROKEN** | in none of the five |
| `D3` | canonical give-up > 5x the $49,121 attribution cost | HELD | $582,049 against $245,605 |
| `D4` | BEST-NW never also holds the most Roth | HELD | they differ in all five |
| `D5` | NW and Roth+Brok+Cash rankings disagree in >=3 of 5 | HELD | 4 of 5 |

**`D2` is the one worth dwelling on.** The hypothesis was that some circumstances produce more net
worth *because* of conversions, but that they are unlikely. Across these five households the
best-net-worth plan is never a converting plan - so as a statement about the top of the board, the
answer is "not observed here".

But the finer version of the claim IS true, and `CONVERSION_VALUE_HOUSEHOLDS.md` measured it:
**within** a fixed strategy, conversions raise net worth on H2-longwidow (+$95,632 and +$4.8M of
Roth, dominant) and against the routing-off baseline on three of five households. So conversions can
add net worth; what they cannot do here is add enough to overcome the withdrawal-strategy gap and
reach the top of the board. Those are different claims and only the second one is refuted.

## How to quote these numbers

| you are asking | use | canonical answer |
|---|---|---|
| is the conversion lever itself expensive? | `CONVERSION_VALUE.md`, attribution | $49,121, 50.08 : 1 |
| what does my preferred plan cost against the best one available? | this report, choice | $582,049, 4.23 : 1 |

Quoting the attribution number for the choice question understates the cost by a factor of twelve.
Quoting the choice number for the attribution question blames the conversions for a withdrawal
strategy decision. An earlier draft of `CONVERSION_VALUE.md` did the second and called the first
reading an error; it was not.

## Limits

- Five households, one engine, ten strategies. The board is the shipped strategy set, not the space
  of possible plans, and [`PERFECT_FORESIGHT_ORACLE.md`](PERFECT_FORESIGHT_ORACLE.md) shows the
  shipped set leaves a median 1.29% on the table against a perfect-foresight ceiling.
- H3's board carries a lifetime spend gap of $8,619 on $6.5M, larger than the other four. Small
  against the differences reported, but it is not exactly zero.
- The landmines that constrain every conversion result here are unchanged: `P28j` (the intra-year
  timing rule), `P85` (the broken RMD reasoning), `P100` (the ranking defect), `P106a` (the stop year,
  held fixed).
