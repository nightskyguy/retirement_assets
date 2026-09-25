# Plan: one two-phase Medicare escalation, used by every tool

Evidence: [`research/MEDICARE_ESCALATION.md`](../research/MEDICARE_ESCALATION.md), harness
`.test_harnesses/medicare_escalation_harness.js`. Every figure below reproduces from it.

**Decisions already taken by the owner**

| decision | |
|---|---|
| model | two-phase, `g(t) = gLong + (g0 - gLong) * d^t` |
| why | no user input needed, little explanation needed, and it is the only shape robust to the long-run assumption (within 1.2% across tails from 3.0% to 5.6%, where every flat rate swings 25 points or more) |
| override | behind `?nerdknob` only, so README never names it |
| `irmaa_and_rmds` | ask for a current age; with one, project; without one, show 2026 only |
| its dollars | **both bases side by side**: that year's dollars and 2026 dollars |

**What this supersedes.** The earlier decision "the Optimizer keeps `cpi + inflation` as the default
so saved plans reproduce" is dropped: the instruction is now all five tools on one model, which is
consistent with the standing position that compatibility is not an objective. The consequence is
stated in full under Risks.

---

## 1. The model, and where it lives

New root file **`medicare_costs.js`**. Not a `TAXData` key: `TAXData` is a statute table and this is
a fitted model. Precedent is `montecarlo/historical_returns.js` (sourced series, source URLs in the
header, dual `module.exports` / `window` export).

**Zero dependencies, deliberately.** `standalone/FutureCost.html` does not load `taxengine.js` and
must not have to. That forces the helper to take **elapsed years, not a calendar year**; anchoring is
the caller's job.

```js
const MEDICARE_COSTS = {
    ANCHOR_YEAR: 2026,   // the year TAXData.IRMAA's dollars are stated in
    g0:    0.066,        // Trustees 2026-2035 premium CAGR
    gLong: 0.038,        // Trustees long-run Part B per-capita assumption
    decay: 0.90,         // fitted to the benchmark; the optimum is 0.903
    partBStartYear: 2003,
    partBActualThrough: 2026,
    partB: [ /* actuals 2003-2026, then Trustees projections 2027-2035 */ ],
};

// The rate in the year `t` whole years after ANCHOR_YEAR. t = 0 is the first projected year.
function medicareGrowthRate(t, o) { ... }

// The cumulative multiplier over `years` years. medicareGrowthFactor(0) === 1 exactly.
function medicareGrowthFactor(years, o) { ... }
```

`o` is an optional `{ g0, gLong, decay }` merged over the defaults, so an override can move one
parameter without restating the others. Negative `years` returns 1 rather than dividing.

**`partB` ships even though nothing reads it at runtime.** It is what lets a test re-fit the CAGR
instead of trusting a comment, which is the same reason `historical_returns.js` ships its series.

### The cross-file pin

`ANCHOR_YEAR` duplicates `TAXData.IRMAA.YEAR` and cannot read it. **Pin them equal with a test**,
exactly as `feedback.js`'s `LIMITS` and the planner's `SAFE_HARBOR` are pinned: the two files are
loaded by different pages, so the duplication is structural and only a test can hold it.

---

## 2. Per-tool logic changes

### 2.1 `taxengine.js`

| change | note |
|---|---|
| `calcIRMAA`'s `medicareRate` default becomes **`1`** (identity) | today it is `1 + ANNUAL_INCREASE`, so an omitted argument silently applies a year of growth. **All seven live callers pass it explicitly** (verified), so no number moves. |
| delete `TAXData.IRMAA.ANNUAL_INCREASE` | its only live reader is `Retirement_Projection.html`, which switches in the same commit |
| keep `TAXData.IRMAA.YEAR` | it is the anchor, and the new pin test ties `ANCHOR_YEAR` to it |

### 2.2 `optimizer_core.js`

Two sites, and they are not symmetrical.

**The seed, `:4618`.**

```js
let medicareRate = Math.pow(1 + inputs.cpi + inputs.inflation, gapYears);
```
becomes a factor measured from the anchor year, not from today:
```js
let medicareRate = medicareGrowthFactor(currentYear - MEDICARE_COSTS.ANCHOR_YEAR, medOverride);
```

**This fixes a latent bug.** `gapYears` is `max(0, currentYear - new Date().getFullYear())`, so the
multiplier is 1.0 at *today*, while the premiums it scales are stated in **2026** dollars. The two
agree only while the wall clock says 2026. Measured from `ANCHOR_YEAR` they agree always.

**The per-year advance, `:4475`.**

```js
sim.medicareRate *= (1 + cpi_t + inputs.inflation);
```
becomes
```js
sim.medicareRate *= (1 + medicareGrowthRate(sim.currentYear - MEDICARE_COSTS.ANCHOR_YEAR, medOverride));
```

`sim.currentYear` exists and is advanced at `:4420`. **Confirm which side of the advance this line
falls on before writing it**, because an off-by-one here is a whole year of growth and nothing would
fail loudly.

**A real behavior change under Monte Carlo, which is the point.** `cpi_t` is the drawn path's CPI, so
today the Medicare rate varies path to path. The two-phase rate is deterministic. That follows
directly from the finding (premium growth has no measurable relationship to CPI, and hold harmless
gives it the wrong sign), and it slightly narrows the Monte Carlo spread because one source of
variation is removed. Say so in the report's "what shipped" section rather than letting someone
rediscover it.

**Rewrite the comment block at `:4605-4617`.** It still argues from the 8.8% aggregate-cost figure and
the 4x-against-8x comparison, which the report shows is a category error. Replace with the model, the
two sources, and the one constraint: the rate scales *dollars* and never the thresholds, which index
at CPI on a separate axis.

### 2.3 `Retirement_Projection.html`

```js
const medicareGrowth = Math.pow(1 + (TAXData.IRMAA?.ANNUAL_INCREASE ?? 0), y - 1);   // :1198
```
becomes
```js
const medicareGrowth = medicareGrowthFactor(calYear - MEDICARE_COSTS.ANCHOR_YEAR);
```

`calYear` is already in scope (`:1097`, `CURRENT_YEAR + (y - 1)`). Add the `<script>` tag with a
`?v=` token. **This is a behavior change for this tool** (5.6% flat becomes two-phase). It gets no
changelog entry, per the rule that only the Optimizer and the Tax Planner have one.

### 2.4 `standalone/IncomeTaxPlanner.html`

Two defects, one fix.

```js
const medGrowth = Math.pow(1 + medicareExtra / 100, year - BASE_YEAR);   // :379
```

The slider is labelled **"Medicare cost increase above inflation"** and the help text at `:1170` says
costs grow at **"inflation + Medicare extra rate"**, but the code applies the rate **alone**: 2.5%
where the label promises 5.0%. The report also shows 2.5% understates the 30-year premium bill by
**35.7%**, so this is the worst-calibrated of the five tools.

- Replace with `medicareGrowthFactor(year - MEDICARE_COSTS.ANCHOR_YEAR)`.
- **Remove the slider.** The owner's requirement is that no user input be needed, and a control whose
  label has never matched its code is not worth repairing. Replace it with a read-only line showing
  that year's modelled rate.
- Share key `me` loses its meaning. Drop it from the emitted URL and ignore it on read, following the
  `fwt` / `cvt` legacy-fold precedent. A legacy link silently loses an override that was mislabelled
  and mis-scaled in the first place.
- Rewrite the `:1170` help text, which is currently false.

### 2.5 `standalone/irmaa_and_rmds.html`

Today it passes `calcIRMAA(threshold, status, 1, 1)`: no escalation at all, deliberately.

**One new optional input**, beside the existing "Age(s) to Calculate":

| field | default | effect |
|---|---|---|
| **Current age** | blank | blank keeps today's behavior exactly: 2026 dollars, no projection, no new columns |

**CPI is a fixed constant, not a field** (owner, 2026-09-24). A nominal column needs a CPI, but the
reader is not being asked to supply one: the tool states the assumption and uses it.

`CPI_ASSUMED = 0.032`, which is the repository's own BLS CPI-U series over the **last ten years,
2016 to 2025, geometric mean 3.214%**. The 2026 entry is excluded because the series marks it an
estimate. An earlier draft of this plan proposed 2.5%, which was wrong: that is the Trustees'
long-run CPI forecast assumption, not the realized record, and using a forecast where a measured
figure exists is the habit this whole effort removes. The 20-year figure is 2.53%, so the window
matters here as much as it does for Medicare and the constant must say which one it is.

**Logic.** For each listed age `A`, `yearsAhead = A - currentAge`. If negative, that row is in the
past: show it at 2026 and say so, rather than extrapolating backwards.

- threshold for the max-IRA solve: `threshold * (1 + cpi)^yearsAhead`
- Social Security: grown at CPI, because it has a statutory COLA
- **Other Taxable Income: left exactly as typed**, with a label saying so. It is a fixed pension for
  some readers and an indexed one for others, and guessing would be worse than stating it.
- surcharge: `calcIRMAA(threshold, status, cpiFactor, medicareGrowthFactor(yearsAhead))`

**Columns**, per the owner's choice of both bases:

```
IRMAA Tier | Max IRA Balance | RMD Amount | Estimated MAGI | Surcharge (2046 $) | Surcharge (2026 $)
```

The 2026 column is the nominal figure divided by the CPI factor. It is the one that answers "is this
getting worse in real terms", which is the whole reason the two-phase model exists. The heading
carries the actual year so no reader has to infer the basis.

**Also fix the stale note box** (around `:240`): "CPI ... about 2.8% ... IRMAA tax ... about 5.6%".
Both are unsourced, 2.8% matches no window of the repository's own BLS series (3.21% over ten years,
2.53% over twenty), and "5.6%" asserts a fixed-rate model the report disproves. Rewrite from the
report, and state the CPI assumption the projection uses.

### 2.6 `standalone/FutureCost.html`

**Documentation and defaults only. No restructuring.** It is a generic growing-payment calculator
that happens to be documented around IRMAA; it never calls `calcIRMAA` and does not load
`taxengine.js`. Bending a general tool around one use case would be a worse tool.

- load `medicare_costs.js` (zero-dep, which is why that constraint exists) and show a one-line
  readout of the modelled Medicare path beside the Extra Growth field
- fix the help text at `:238`: "Medicare Part B premiums have historically grown 2-4% above general
  inflation" is unsourced and is the model the report rejects
- re-check the example figures against the corrected IRMAA ladder ("$2,297/year for a couple" already
  matches the corrected Tier 1, so this may need nothing)

---

## 3. The nerdknob override

One gated control on the Optimizer, three fields, prefilled with the model's own values so the
default is visible rather than implied: `g0`, `gLong`, `decay`. Blank means "use the model".

Four edits that each fail hard if missed, from the `futureIRATaxRate` precedent:

1. `OPT_LONG_TO_SHORT` short keys (verify each is free)
2. `OPT_SHARE_PRIVACY.safe` (**`feedback.tests.js` fails at 46 without it**)
3. `applyScenario`'s percent-scaling list
4. `captureDefaults()` records the blanks, so `buildShareURL()` omits them and **every existing share
   link stays byte-identical**

Gated features go in `ExperimentalFeatures.md`, never README.

---

## 4. Documentation

| file | change |
|---|---|
| `README.md` `#### IRMAA Escalation` (`:858`) | rewrite. Add the CMS premium table, the model, the windows, and **hold harmless, which is documented nowhere in this repository** and is the mechanism behind the largest moves in the record. Correct two unsourced claims: "CPI has averaged about 2.8%" (own BLS series: **2.53%**) and "Medicare has averaged 5.6%" (window-dependent: 6.44 / 5.24 / 4.24% over 5 / 10 / 20 years). Never name the nerdknob. |
| `doclinks.tests.js` | asserts every `](#anchor)` resolves to a heading, so any new subheading needs its TOC entry in the same commit |
| `ExperimentalFeatures.md` | the override |
| `research/MEDICARE_ESCALATION.md` | add a short "what shipped" section: the report currently only recommends |
| `ARCHITECTURE.md`, `FILE_DIRECTORY.md` | the new root file |
| `optimizer_changelog.md` | **one** entry, Optimizer-visible only: Medicare and IRMAA costs now follow a sourced path that starts higher and eases off, so plans reaching a tier will move. Nothing about the other four tools, the constant, the file, or test counts. Target 150 words. |

**Changelog judgment to confirm:** this is a new entry rather than a continuation of the fix-order
entry. The fix order was the code-quality review's ten findings; this is a modeling change the review
never raised. Same run of stacked branches, different subject.

---

## 5. Tests

No sixth `*.tests.js`: a new suite costs three permanent pins for one data file.

**`taxengine.tests.js`** (about 8):
`ANCHOR_YEAR === TAXData.IRMAA.YEAR`; `medicareGrowthFactor(0) === 1` exactly; the rate at `t = 0`
equals `g0`; the rate is monotone decreasing and converges toward `gLong`; the factor equals the
product of the rates (the two helpers cannot drift apart); `partB` at 2026 equals
`TAXData.IRMAA.standardPartB`; the CAGR re-fits from the shipped series; `calcIRMAA`'s default
`medicareRate` is identity.

**`optimizer_core.tests.js`** (about 4):
an explicit override moves Medicare and IRMAA and nothing else; `gLong = g0` reproduces a flat rate
exactly (the model contains the old one as a special case, which is the cleanest possible proof the
plumbing is live); a zero override holds premiums flat; the seed factor and the loop agree at the
plan's first year.

**The real test risk is not a missing test.** `optimizer_core.tests.js` carries **193** IRMAA
references. A grep found no test that pins `1 + cpi + inflation` directly, but many fixtures will
shift numerically. Expect a pass of re-measuring, and **re-measure rather than relax**: last time a
fixture stopped exercising its own precondition and the honest fix was to restate the precondition,
not the assertion.

Reconcile `TestTiers.EXPECTED` and the `.githooks/README.md` table by running all five suites.

---

## 6. Verification

**Byte identity is the wrong test here.** This is a deliberate behavior change. Instead build
`.test_harnesses/medicare_delta_harness.js`: run all 19 plan-bank households before and after and
report the change in ending wealth, total Medicare paid, total IRMAA and IRMAA tier-years. The size
of the change becomes a recorded number instead of a surprise, and the report gets a "what shipped"
table from it.

Three sanity passes, because dead plumbing passes a delta test that measures nothing:

1. `gLong = g0 = 0.058` must reproduce the old flat-5.8% numbers on every household
2. the shipped model must differ on every household that reaches a tier
3. a zero override must hold premiums at their 2026 dollars

**Plan-bank cards** carry measured `viability`, `endingIRA` and `acaBreachYears`. They will move and
must be re-measured, never typed.

**Browser verification on all five tools**, since four of them change what they display.

---

## 7. Sequencing

| step | what | separable |
|---|---|---|
| 1 | `medicare_costs.js` and its tests, wired to nothing | fully |
| 2 | `calcIRMAA` default to identity, delete `ANNUAL_INCREASE`, switch `Retirement_Projection` | behavior change for that tool only |
| 3 | the Optimizer: both sites, the comment rewrite, the delta harness | largest; run all three sanity passes |
| 4 | the nerdknob override | |
| 5 | `IncomeTaxPlanner` folds in, slider removed, `me` folded, help text fixed | |
| 6 | `irmaa_and_rmds`: age and CPI fields, both-dollar columns, note box | |
| 7 | `FutureCost` docs | |
| 8 | README, ExperimentalFeatures, ARCHITECTURE, FILE_DIRECTORY, changelog, version stamp | last |

Steps 1 and 2 are worth landing on their own: step 1 changes nothing and step 2 removes the dangerous
default, so both are reviewable without the argument about the model.

---

## 8. Risks, stated rather than discovered

| risk | |
|---|---|
| **saved plans and share links no longer reproduce** | Any plan reaching an IRMAA tier moves. This is the intended consequence of switching the Optimizer's model, and it follows the standing position that compatibility is not an objective, but it is the single most visible effect and the changelog must say it plainly. |
| **Medicare stops varying by Monte Carlo path** | Correct per the finding, and it narrows the spread slightly. Must be stated, not discovered. |
| **`decay` has no independent source** | Fitted to a benchmark that is part projection and part assumption past 2035. The report already says so; the code comment must too, rather than implying it is measured. |
| **the off-by-one at `:4475`** | One year of growth, silent. Confirm which side of the `sim.currentYear` advance the line sits on. |
| **premiums fall in the record** | 2012 and 2023 both fell. The model never produces a decrease, so it cannot reproduce that, and no test should demand it. |
| **hold harmless stays unmodeled** | Out of scope here, but it compresses what an individual actually pays relative to the standard premium. Worth recording as a known limitation in README rather than leaving it undocumented a second time. |

---

## 9. Open question I did not decide

**Does `Retirement_Projection.html` need an override too?** It has no nerdknob mechanism, and adding
one for a single field would be the first of its kind in that tool. The plan assumes **no**: it takes
the model and shows the rate. Say so if that is wrong.
