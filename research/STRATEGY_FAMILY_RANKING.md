# Ranking the strategy families over the shipped sweep enumeration  *(phase P36, round 1)*

**Run:** 2026-08-10, engine at `5e1075e` (post dividend fix `e9a3c8b`, post basis step-up v11.1499).
**Harness:** `node .test_harnesses/phased_harness.js` — 45 cells x 192 arms = 8,640 sims, ~9s.
**Grid:** P28's 5-mix ladder (copied verbatim) x wealth x0.5/x1/x3 x spend 4/6/8% of total assets.
**Arms:** the Optimizer table's own enumeration — `buildStrategyFamilies` nerdknob configuration
(IRMAA family, ACA family, cyclic 🗘/🔄 clones, 💵 cash clones).
**Scoring:** the UI's recipe reproduced exactly (`optimizer_ui.js:560-568`, `:981`): shared
heirs rate per cell from the Proportional 0% row's `totals.futureIRARate` ("auto" path), ranked by
the exported `rankRowsByObjective` on 7 core objectives + `earliestbe`. `conveffect` out of scope
(reads UI-computed `_convSavings`). Rows failed / bracket-infeasible (>50% overage years) /
ACA-untenable (any breach year) are vote-ineligible, mirroring the Best-table rules.

## Headline findings

1. **S1-P1a WRONG, decisively.** Proportional (lin) reached top-3 family rank on `networth` in
   **0%** of cells and on `balanced` in **0%** of cells (predicted >=60%). Its overall mean rank is
   15.9 of 24 famKeys. On this grid the comparative half of "proportional may be default-optimal"
   is refuted inside the existing menu — no objective ranks it top-3 anywhere.
   (S1-P1b RIGHT: the #1 family is not Proportional.)

2. **Guyton-Klinger's apparent dominance (178/360 votes) is two artifacts, not an efficiency
   result.** (a) **Survivorship:** mean vote-eligible arms per cell fall 160 → 100 → 37 as spend
   goes 4% → 6% → 8%; GK cuts spending to survive, so at 8% it is nearly the last family standing
   (102 of 120 pooled votes). At 4% strain GK takes **zero** of the leading votes. (b) **Delivered
   spend drifts** — GK lin vs Proportional 10% on defaults x1: **+38.3%** at 4%, +10.3% at 6%,
   **−12.4%** at 8%. A spend-changing arm is not like-for-like (the P28 exclusion rule; production
   gates GK behind `gkSpendStable`). GK's `networth`/`maxspend` wins mix a spending change with a
   wealth change and must not be read as "GK is best".

3. **Cyclic clones win constantly — P32's Q3 answered YES at the vote level.** Pooled votes for
   cyc famKeys: GK 68, IRA Draw 34, Ordered 16, Reduce 9, Fill Bracket 8, Proportional 5,
   IRMAA 1 = **141 of 360**. Low-strain (4%) leaders are IRA Draw|cyc (17) and Ordered|cyc (12).
   The paired form (cyclic vs its own non-cyclic twin, same family/param) is `q3()` in
   `brokerage_harness.js` — see `BROKERAGE_DRAW.md`.

4. **ACA Cliff never wins and ranks last everywhere — DO NOT CONCLUDE.** The tool prices the cost
   of staying under the cap and not the subsidy benefit (documented one-sided pricing,
   findings.md), so "ACA never wins" is a measurement artifact by construction. 648 rows were
   additionally ACA-untenable (breach years) on this grid.

5. **Zero test (the only deletion evidence): two arm-pairs are byte-identical in all 45 cells.**
   `Fill Bracket 10%` == its 💵 cash clone (the 10% ceiling sits below base income → no
   discretionary IRA draw → no conversion for cash-funding to touch), and `Ordered CBIR` == its 💵
   cash clone. Both were also identical to their 🗘 cyc-ira twins in *some* cells (union shown by
   the harness), but only the cash-clone pairings hold in **every** cell. 119 further arms
   duplicate in some cells only — not deletion candidates.

6. **118 of 192 arms never take rank 1 under any objective in any cell.** Frequency observation,
   NOT deletion evidence (the repo's rule: only the zero test deletes; frequency shortcuts have
   failed four times).

7. **`earliestbe` coverage:** 1,605 of 8,640 rows carry a break-even year; the rest sort on the
   9999 sentinel. Row health: 3,463 failed, 533 bracket-infeasible, 648 ACA-untenable, 0 threw.

## Table 1 — mean family rank per objective (1 = best; eligible rows only)

```
family                   taxflex  networth  widowrmd    mintax  maxspend   maxroth  balanced earliestb   OVERALL
ACA Cliff|cash              22.9      22.9      23.1      23.1      23.1      23.0      23.1      22.9      23.0
ACA Cliff|cyc               19.6      19.7      22.7      22.6      21.1      22.7      19.7      22.2      21.3
ACA Cliff|lin               22.9      23.0      23.2      23.2      21.8      23.2      23.2      22.9      22.9
Fill Bracket|cash           17.9      17.8      14.6      12.4      19.1      15.6      18.1      17.3      16.6
Fill Bracket|cyc            15.6      15.5      13.2      16.3      16.7      15.4      15.6      16.8      15.6
Fill Bracket|lin            18.4      18.7      11.5      13.8      18.5      17.3      19.1      18.4      17.0
Guyton-Klinger|cash         10.4       9.9      10.8      10.1       5.6       8.0       9.3       9.0       9.1
Guyton-Klinger|cyc           9.2       9.7      12.5      12.0       4.2       9.4       7.3       9.1       9.2
Guyton-Klinger|lin          10.6      10.4      11.8      10.7       5.3       8.8      10.0       9.7       9.7
IRA Draw|cash               12.5      11.5      15.3      12.9      17.2      15.2      11.4      10.9      13.4
IRA Draw|cyc                11.1      10.8      17.3      15.4      15.7      15.1      10.6      12.3      13.5
IRA Draw|lin                12.5      11.8      15.6      13.8      15.4      16.4      11.7      11.2      13.6
IRMAA Ceil|cash             18.3      18.1      15.2      13.5      19.4      16.2      18.4      17.9      17.1
IRMAA Ceil|cyc              17.2      17.5      14.1      16.6      16.6      15.8      17.7      18.4      16.7
IRMAA Ceil|lin              18.2      18.3      12.1      14.5      18.2      17.5      18.6      18.6      17.0
Ordered|cash                18.1      18.3      21.4      21.7      20.6      20.2      18.8      16.8      19.5
Ordered|cyc                 13.3      14.4      20.8      21.0      19.0      19.6      14.3      15.9      17.3
Ordered|lin                 17.6      17.8      21.2      21.6      18.9      19.8      18.3      16.8      19.0
Proportional|cash           16.7      16.9      15.0      13.4      14.2      13.7      17.1      14.9      15.2
Proportional|cyc            14.0      15.3      17.6      17.2      13.0      14.8      15.4      16.8      15.5
Proportional|lin            17.6      18.1      14.9      14.7      11.8      15.2      18.4      16.5      15.9
Reduce|cash                 14.8      13.5      12.5      11.6      16.4      11.6      13.5      13.6      13.4
Reduce|cyc                  15.6      16.0      13.4      14.7      13.2      12.1      16.2      16.9      14.8
Reduce|lin                  14.8      14.2      10.1      13.2      14.8      13.2      14.3      14.0      13.6
```

Read WITH finding 2: every Guyton-Klinger row mixes a spend change into its rank.
Excluding GK, the best overall mean ranks are Reduce|cash 13.4, IRA Draw|cash 13.4,
IRA Draw|cyc 13.5, Reduce|lin 13.6, IRA Draw|lin 13.6 — the field is tight and no family
monopolizes every objective (Reduce|lin owns `widowrmd` at 10.1; Proportional|lin's single
strength is `maxspend` 11.8).

## Table 2 — winner votes (one per cell per objective)

```
family                   taxflex  networth  widowrmd    mintax  maxspend   maxroth  balanced earliestb     TOTAL
Fill Bracket|cash                                            7                                                 7
Fill Bracket|cyc               1         2                                       1         2         2         8
Fill Bracket|lin                                   2                                                           2
Guyton-Klinger|cash            3        17        15        12         2        17         3        11        80
Guyton-Klinger|cyc            13         1                   2        29                  15         8        68
Guyton-Klinger|lin             7         6         1         4         3         6         2         1        30
IRA Draw|cash                            1                   9                   4         1         6        21
IRA Draw|cyc                   9         9                                                13         3        34
IRA Draw|lin                   2         6                                                 6         2        16
IRMAA Ceil|cash                                              1                                                 1
IRMAA Ceil|cyc                                                                                       1         1
Ordered|cash                                                                                         2         2
Ordered|cyc                    7         2                                                 2         5        16
Ordered|lin                              1                                                 1                   2
Proportional|cash              1                             8         3         5                   2        19
Proportional|cyc               2                                       1         1                   1         5
Proportional|lin                                   8                   3                                      11
Reduce|cash                                        1         2                   7                            10
Reduce|cyc                                                             4         4                   1         9
Reduce|lin                                        18                                                          18
```

Families with zero votes under every objective: all three ACA Cliff famKeys (see finding 4) and
IRMAA Ceil|lin.

**By spend rate (all objectives pooled) — the survivorship lens:**

```
spend    mean eligible arms/cell   top families (votes)
4%                           160   IRA Draw|cyc 17, IRA Draw|cash 13, Ordered|cyc 12, Proportional|cash 12
6%                           100   Guyton-Klinger|cash 35, Guyton-Klinger|cyc 23, IRA Draw|cyc 13, IRA Draw|lin 8
8%                            37   Guyton-Klinger|cash 43, Guyton-Klinger|cyc 35, Guyton-Klinger|lin 24, IRA Draw|cyc 4
```

**GK delivered-spend drift vs Proportional 10% (defaults x1):** +38.3% @4%, +10.3% @6%,
−12.4% @8% — the (spend, wealth) pair rule in action; GK's votes are not wealth-at-equal-spend.

## Table 3 — zero test

Byte-identical in ALL 45 cells (money-field fingerprint: finalNW, tax, spend, shortfall, all five
terminal buckets):
- `Fill Bracket 10%` == `Fill Bracket 10% [cash]`
- `Ordered CBIR` == `Ordered CBIR [cash]`

119 further arms duplicated in SOME cells (worst: ACA Cliff 200% FPL and Fill Bracket 12% pairs at
40/45) — not deletion candidates.

## Coverage — what was actually varied (guard against extrapolating past it)

The grid is CROSSED (mix ⊥ wealth ⊥ spend, 45 cells), not hand-picked scenarios — P28 round 2's
confound of mix with strain is the reason. Concrete ranges:

**The five mixes at wealth x1** (accounts in $k: IRA1+IRA2 / Roth+Roth2 / Brokerage (basis) / Cash):

| mix | total | IRA share | Roth share | Brok share | Cash | basis/Brok |
|---|---|---|---|---|---|---|
| defaults | $1.62M | 86.4% | 4.3% | 6.2% | 3.1% | 50% |
| defaults3x | $4.86M | 86.4% | 4.3% | 6.2% | 3.1% | 50% |
| round1 | $3.90M | 64.1% | 9.0% | 23.1% | 3.8% | 55.6% |
| thirds | $4.35M | 32.2% | 32.2% | 32.2% | 3.4% | 50% |
| brokheavy | $4.55M | 22.0% | 13.2% | 61.5% | 3.3% | 42.9% |

`defaults3x` is the SAME ratios as `defaults` at 3x the dollars, deliberately: it separates
bracket-absolute (scale) effects from mix effects. The x0.5/x1/x3 wealth axis then multiplies
every mix again.

**Ranges spanned by the full 45-cell grid:**
- Total investable assets: **$810k – $14.58M** (defaults x0.5 → defaults3x x3)
- IRA share **22–86%**, Roth share **4–32%**, Brokerage share **6–62%**, Cash ~3%
- Annual spend: 4/6/8% of total assets = **$32,400 – $1,166,400** per year
- Strain: at 4% SS covers most of spend in the small cells; vote-eligible arms fall
  160 → 100 → 37 (of 192) as spend goes 4% → 6% → 8%, and 40% of all 8,640 rows fail overall

**Held FIXED across all 45 cells — extrapolation stops here:**
- One household: couple 64/62 at start (born 1962/1964), die 92/94 (deaths 2054/2058 — only 4
  survivor years), 33-year horizon
- SS $45k @70 + $24k @67; no pension; CA residency only
- One deterministic path: growth 6%, inflation/CPI 2.5%, cashYield 3%, dividendRate 2%
- ~~Brokerage basis fraction narrow: 43–56%~~ **CLOSED 2026-08-10**: the grid was rebuilt at
  basis 20% and 80% (135 cells total) and the ranking conclusions re-checked. **Prediction `B-P5`,
  registered before the run, said the rankings would be basis-stable. RIGHT**: same leader (Guyton-Klinger|cash, with
  the same survivorship caveat), ACA Cliff still zero-vote everywhere, and Proportional|lin
  still reaches top-3 on networth/balanced in **0 cells at 20% AND 0 cells at 80%** (mean rank
  16.0 / 15.4). At 80% basis two more famKeys drop to zero votes (Fill Bracket|lin,
  IRMAA Ceil|cash). Basis moves the LEVELS (see BROKERAGE_DRAW.md basis table), not the ORDER.
- Spend flat (spendChange 0), CashReserve off, `convertExcessToRoth` on (the sweep's own default)

## Scope limits

One deterministic return path (6% growth, 2.5% inflation), CA only, one age/SS profile
(64/62 start, die 92/94), CashReserve off, `convertExcessToRoth` on per the sweep's own
enumeration. Aggregate basis (no lot selection/HIFO), one-sided ACA pricing, no SECURE 10-yr heir
modeling, IRC §1014 step-up at the terminal row. Spend rates are % of total assets, not
withdrawal rates. Mean ranks compare families WITHIN cells; nothing here compares across cells.

## What this feeds

- **P36e** (default ordering / arm count): the vote tables above, with the GK caveat applied.
- **P32e Q3**: cyclic wins at the vote level; the paired twin comparison is in `BROKERAGE_DRAW.md`.
- **Round 2** (after P35i): add Phased arms, death-timing axis, `deathBasisStepUp` cross,
  `survivorSpendPct` factor per the P36 section's full design.
