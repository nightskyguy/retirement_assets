# Which IRMAA margin setting should be the default?

> **RE-MEASURED at v11.15cd.** Two things changed under this file after it was written: `flat1000`
> was retired, and `cpiminus1` was corrected to take its point off the projected INCREASE rather
> than off the annual rate. Both haircuts now act on the projected increase. Current figures, mean
> surcharge saved across the 60 historical windows:
>
> | mode | mean dSurcharge | windows where it saved |
> |---|---|---|
> | halfcpi *(now the default)* | **-$47,987** | **60/60** |
> | cpiminus1 | -$23,832 | 58/60 |
> | halfstep | -$11,649 | 49/60 |
> | flat2000 | -$10,047 | 48/60 |
>
> The correction is what settled section 4's open question: before it, `halfcpi` and `cpiminus1`
> measured as near-duplicates (-$48.5k vs -$37.2k) and one looked deletable. Corrected they separate
> about two to one and form a ladder, so both are kept. Everything below is the reasoning, which is
> unchanged; only `cpiminus1`'s numbers and the retired `flat1000` rows are stale.

`node .test_harnesses/irmaa_default_harness.js`. 16 plans (12 converting, 4 donating) x 6 modes = 96
simulations, each re-billed in 7 constant and 60 historical CPI worlds. Plan assumes CPI 2.5%.

---

## 1. The question inverts: conversions and QCDs both point at *no margin at all*

Both objectives improve monotonically as the margin shrinks — more conversion room is a **higher**
ceiling, a smaller QCD is a **higher** target — so `none` wins both by construction:

| mode | converted | vs none | QCD given | vs none |
|---|---|---|---|---|
| **none** | **$4,268,621** | — | **$3,337,063** | — |
| flat1000 | $4,231,705 | -$36,916 | $3,353,414 | +$16,352 |
| flat2000 | $4,215,404 | -$53,217 | $3,369,764 | +$32,701 |
| halfstep | $4,206,845 | -$61,776 | $3,387,422 | +$50,359 |
| cpiminus1 | $4,130,950 | -$137,671 | $3,403,872 | +$66,809 |
| halfcpi | $4,091,389 | -$177,233 | $3,420,348 | +$83,285 |

So "the setting that most improves conversions and most reduces QCDs" is `none`, trivially, and
`none` is also the setting with zero cliff protection. The default cannot be picked from this table.

**Randomizing inflation does not change this table at all.** `sim.cpiRate` is built from the scalar
`inputs.cpi`, so the ceiling, the conversions and the donations are deterministic. A realized
inflation path changes only which tier the resulting MAGI is *billed* at two years later.

## 2. Decomposition: the margin's headline effect is not an IRMAA effect

A first cut of this harness compared modes on net terminal wealth and found every margin beating
`none` at every realized CPI — including rates where `irmaa_cpi_risk_harness.js` proves there are
**zero** breaches. That cannot be an IRMAA result, and it is not one. Two separate things move:

| | what it is | depends on realized CPI? |
|---|---|---|
| **dWealth** | the ceiling moved, so the plan converted a different amount | **no** |
| **dSurcharge** | which tier the MAGI is billed at | **yes** |

Only dSurcharge is what a safety margin exists to change. Measured (converting plans, vs `none`):

| realized CPI | halfstep | flat1000 | flat2000 | halfcpi | cpiminus1 |
|---|---|---|---|---|---|
| **dWealth** (all worlds) | +$168,379 | +$32,599 | +$192,190 | **+$464,884** | +$345,890 |
| dSurcharge @ 0.0% | -$27,016 | -$5,459 | -$22,500 | -$62,288 | -$40,032 |
| dSurcharge @ 1.5% | -$30,226 | -$32,522 | -$30,226 | **-$97,008** | -$65,633 |
| dSurcharge @ 2.5% (as assumed) | $0 | $0 | $0 | $0 | $0 |
| dSurcharge @ 4.0% | +$3,132 | +$3,132 | +$3,132 | -$17,288 | -$13,253 |

**The side effect is roughly ten times the IRMAA effect.** `halfcpi` moves wealth by +$464,884 and
surcharge by -$48,493 on average. Any ranking of margin settings by wealth is about 90% a statement
about conversion sizing — the P24 finding that over-converting hurts at a 22% heir rate — and about
10% a statement about IRMAA.

Conversion sizing already has an honest control: **pick a lower tier**. It should not be reached
through a knob labelled "safety margin".

## 3. Two predictions were wrong, and both matter

**P3 wrong — margins save surcharge even when inflation meets or beats the assumption.** At realized
3% and 4%, above the 2.5% assumption, `halfcpi` still saves $14,465 and $17,288. That is not
protection: `irmaa_cpi_risk_harness.js` shows zero boundary breaches at those rates. It is the same
conversion-sizing effect leaking into the surcharge column — a lower ceiling means lower MAGI means a
lower tier in some years regardless of any cliff being crossed.

**P4 wrong — the small settings are not dominated, just weak.** All three save surcharge on the
historical record, but four to five times less than the rate-shaped ones:

| mode | mean dSurcharge | best window | worst | windows where it saved |
|---|---|---|---|---|
| flat1000 | -$9,301 | -$29,569 | +$1,738 | 59/60 |
| flat2000 | -$10,047 | -$45,462 | +$11,477 | 48/60 |
| halfstep | -$11,649 | -$49,530 | +$11,477 | 49/60 |
| cpiminus1 | -$37,178 | -$112,142 | +$5,114 | 58/60 |
| **halfcpi** | **-$48,493** | **-$142,820** | **-$1,494** | **60/60** |

`halfcpi` is the only setting that never costs surcharge in any of the 60 windows.

**P5 held** — `halfcpi` and `cpiminus1` are within 25% of each other. Keeping both is redundant.

## 4. Recommendation

**Default to `none`.** It maximises both things the question asked about, it is the only setting
under which "IRMAA Ceil Tier N" means the plan aims at Tier N and nothing else, and the wealth
advantage of the rate-shaped settings is a conversion-sizing artifact that belongs to the tier
selector rather than to a safety-margin knob. It is also the setting that needs no explanation.

The counter-argument, stated fairly: on this grid `halfcpi` ends with **+$513k** more after-tax
wealth (dWealth +$465k plus dSurcharge -$48k). If the goal is simply the biggest number, `halfcpi`
wins. But it wins by converting $177k less, which the user can choose directly and legibly by
dropping a tier — and if that is the real lever, this knob is the wrong place for it.

**Delete three of the six.** `flat1000` and `flat2000` are the wrong shape (a fixed dollar setback
decays to irrelevance as thresholds inflate) and save four to five times less than a rate haircut.
`cpiminus1` is a near-duplicate of `halfcpi`. That leaves:

- **`none`** — the default, and the honest meaning of the tier ceiling.
- **`halfcpi`** — the one opt-in worth keeping, for a user who wants the cliff guarded against an
  inflation undershoot. It is the only setting that never cost surcharge in 60 historical windows.
- **`halfstep`** — keep only if a small, self-scaling default is wanted for non-nerdknob users;
  otherwise drop it too and go to two.

## 5. What the margin uniquely provides, once the artifact is removed

Only one thing: guarding the tier **boundary** against CPI forecast error. From
[IRMAA_CPI_RISK_RESULTS.md](IRMAA_CPI_RISK_RESULTS.md), assume 2.5% and realize 1%, and `halfcpi`
prevents 21 breaching years of 92 while `flat1000` prevents 0. At or above the assumed rate it
prevents nothing, because nothing is breached.

Everything else it appears to do — more wealth, less surcharge — is available more directly, and more
comprehensibly, by choosing a lower tier.

## 6. Still ahead of all of this

The widow gap. Every clean breach found across four rounds is income sized while married and billed
after a death against single-filer thresholds roughly half as high. No margin setting can close a gap
that wide. Project the filing status forward first.
