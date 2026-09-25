# Experimental features and URL-only controls

Everything the Retirement Optimizer will do that the ordinary page does not show you. Three kinds,
and the difference between them matters:

| kind | reached by | who it is for |
|---|---|---|
| **knob-gated UI** | `?nerdknob`, and two deeper variants | a curious user, at their own risk |
| **URL-only inputs** | a query parameter, no form field anywhere | a real modeling input that never got a control |
| **research inputs** | node only, no URL, no UI | harnesses. Not reachable from a browser at all |

**Why this file exists:** every one of these was added for a reason that made sense at the time and
then stopped being written down anywhere a person would look. A control nobody can find is the same
as a control that does not exist, and a research input nobody remembers is a trap for whoever next
changes the code around it.

---

## 1. `?nerdknob` — the advanced surface

`?nerdknob` on any Optimizer URL reveals advanced controls: Monte Carlo parameters, the Guardrails
band and step inputs and its **Never above plan** switch, the 💵 cash-funded sweep dimension, the
timing control, the risk-based rails panel's *Solve every*, *Paths*, timing readout and rule table, the
risk-based spend rule (below), and other diagnostics. (Fixed tax indexing used to be here; it now lives on the Monte
Carlo tab, which is the only place it can do anything.)

**Never above plan** (`P127a`, off by default) lets a Guardrails raise bring spending back up to the
plan's own path - the spend goal carried forward by Spend Delta and inflation - but never above it.
Cuts still follow the savings. On the research households it gives up 9-16% of lifetime spending
where the rule would otherwise raise, and changes nothing where it would not
(`research/RISK_BASED_GUARDRAILS.md` section 7b). It changes the plan's numbers, so unlike the rest
of this section it travels in a share link (`gsc`) and a saved plan, and a link carrying it stays in
force for a reader without the knob; the sentence under the Guardrails switch says so when it is on.

It can also be flipped **at runtime** by a hidden checkbox on the Documentation tab
(`setNerdKnob` / `applyNerdKnobVisibility`). That flip is deliberately **not** written back to the
URL, so a link you share does not carry your knob state.

Three things have graduated *out* of the knob and must not be put back: the **optimizer objective
selector** (PF13), the **ACA Cliff options** (v11.1464), and the **risk-based rails panel** (2026-09-16,
user: "For non-nerdknob users, leave it off and expose it"). What stays behind the knob is only what a
solve costs: how often it solves (every 3 years for everyone else), how many market paths it uses
(100), and the readout of where the time went with a projection for other settings. The panel
itself - presets, market method, Run, Auto-run, the rails on both charts and the After-Tax Spend
answer - is for everyone, and nothing in it enters the share link, a saved plan or the engine inputs
unless *Use it* writes After-Tax Spend.

### The risk-based spend rule, and its rule table

Everyone gets the risk-based rails panel and the *Risk-based guidance* preset; what stays behind the
knob is the rule that makes the plan **follow** them. With `?nerdknob` the **Guardrails** switch
beside After-Tax Spend has a rule menu: **GK-style**, the Guyton-Klinger-style rule the README
describes under *Limitations and Restrictions*, or **Risk-based (CoS)**. Risk-based makes the plan
follow the rails: in any year the chance of success has fallen to the cut rail, spending is cut to
what gives the preset's "back to" chance; in any year it has reached the raise rail, spending is
raised to what gives the target; otherwise spending stays on the planned path, with inflation every
year and Spend Delta on top. The preset is the *Risk-based guidance* menu (the panel's menu is the
same setting), so the rails on screen are the rails the plan follows. It travels in a share link
(`grk=rbg` with `rbp` and, for Custom, `rbt`/`rbu`/`rbl`/`rbc`) and in a saved plan, and a link
carrying it runs the rule for a reader without the knob, with the menu shown so the rule is never
invisible.

While the rule is on the rails solve themselves whenever the plan changes, whether or not Auto-run
is checked, and the plan is run again when the solve lands. Until then the Guardrails columns in
Annual Details read *no rails* and spending stays on the plan's path. Monte Carlo and the Optimizer
run the rule too: every path and every swept row follows the same rails, which is what makes the
rule cheap enough to sweep. The rails themselves are solved on the plan without the rule, so turning
the rule on or changing its preset never makes them stale.

**Replaying a Monte Carlo path** with the rule on draws the rails it read along that path: the
plan's rails in dollars at the path's own spending and wealth each year, which is what decided each
cut and raise (no chance of success is shown for them). *Solve rails on this path*, which everyone
has, then re-solves the chance from the state the path actually reached.

**Never above plan is recommended with this rule.** The rule does not re-solve the chance every
year along a path; it compares each year's spending with the rails solved for the plan and lands on
the spending the solve found at each rail. That is exact when spending is near the planned path and
drifts when a run of raises has taken it far above. Measured against re-solving the chance every
year through six historical starts on five households
(`research/RBG_RULE_VALIDATION.md`), the rule stays within a few percent of the exact answer with
the ceiling on, and both the cheap rule and the exact one drift and sometimes fail without it.
Choosing a rule never changes the switch; the note under it says when it is off.

**The rule table.** With the knob the rails panel has a *Rule table* fold: the dimensionless table
the rule reads, one row per plan year. Each row gives the ratio of net spending (after Social
Security and pension) to the wealth at the end of the year before at which the chance of success
falls to the cut rail and at which it reaches the raise rail, and the line each adjustment lands on.
The ratios depend on the market model and the years left, and hardly at all on the plan's own
balances: at a Growth of 4% the cut ratio in an early year is about 60% of what it is at 8%, because
the Monte Carlo tab's Synthetic Return follows Growth; holding that return fixed and moving only the
plan's Growth changes the ratios by about 1%. What each setting delivers on the households the rails
are likely to cut is in `research/RBG_RULE_THRESHOLDS.md`.

### Timing diagnostics behind the plain knob

Two selects that answer "when does the money actually leave?", both carried in a shared link:

| control | URL key | choices |
|---|---|---|
| **Money moves** | `wt` | *Split* (default: required distribution and conversion in January, spending in November), *Early* (everything January), *Late* (everything November) |
| **Tax paid** | `txs` | *With the withdrawal* (today), *In December* |

They matter because the whole year's draw leaves at once - the spending money **and** the tax on it -
so a January draw stops compounding eleven months early, while a conversion is the opposite: the
sooner it lands in the Roth the longer it grows there. Split is the only setting that can do both,
and it is the only one that could not be expressed before the required distribution was given its own
month. A conversion may not precede the distribution, so "convert in January, spend in November" was
a silent no-op in every year a distribution was due.

Measured across ten plan-bank households that convert and reach distribution age: Split is ahead of
Late in seven and behind in one, and **none of them pays more tax or ends with a larger IRA**. A year
that converts nothing runs exactly as Late. Settling the tax in December is worth a further
0.10%-1.77% of net worth. Income tax only: Medicare premiums are billed monthly and are never
deferred either way.

Both are **hidden, not disabled**. A link carrying `wt=late` or `txs=december` still runs that way
for a reader without the knob, because the alternative is silently running a different plan than the
link describes. Links written before the two selects became one still load: `fwt`/`cvt` are folded
onto the nearest mode, and the substitution is reported rather than made quietly.

**Retired with this control:** the automatic rule that set a year's spending month from the PREVIOUS
year's conversion, and its `$1,000` trigger. `timingConvThreshold` survives as a URL-only research
input, corrected to read THIS year's conversion and to move the CONVERSION rather than the spending.

### The IRMAA safety margin

One select, URL key `imm`, that chooses how much room the **IRMAA Ceiling** strategy leaves below
the threshold it aims at.

**The forward projection is NOT gated and is not part of this.** IRMAA bills this year's premium
against the MAGI you reported two years ago, judged against the thresholds published for the premium
year, so a ceiling capping this year's MAGI has to aim two years out - about 6% higher at 3%
inflation. Every reader gets that, including on *No margin*. This control only picks the extra room
below that projected threshold, because a tier is a cliff and one dollar over costs a full year's
surcharge.

| choice | aims at |
|---|---|
| **Half the projected increase** (default, `halfcpi`) | half way between today's threshold and the projected one |
| The projected increase, less 1 percentage point (`cpiminus1`) | 1 point short of the projection |
| Half the next-tier surcharge below the projected threshold (`halfstep`) | a dollar amount set by what the next tier costs |
| $2,000 below the projected threshold (`flat2000`) | a flat dollar cushion |
| No margin (`none`) | the projected threshold exactly |

The default moved from `halfstep` to `halfcpi` in 11.15cc: at a 1.5-point CPI miss `halfstep`
prevented 5 breaching years of 92 where `halfcpi` prevented 21, and `halfcpi` saves surcharge in 59
of the 60 windows measured.

The two inflation-based choices leave room as a share of the *projected increase* rather than as
dollars, which is why they hold up over a long plan where a fixed dollar amount does not: a forecast
error is proportional, so the room they leave is too.

Applies to the IRMAA Ceiling strategy **only**. QCD *As Needed* aims at the fully projected
threshold with no margin, because there the margin is bought with money that leaves the household -
measured at $82,764 donated to avoid $3,348 of surcharge, about 25 to 1 against.

### The Medicare growth model, overridden

Three boxes in the sidebar, all blank by default: **start**, **long-run** and **decay**. They open
up the rate the tool uses for Medicare premiums and IRMAA surcharge dollars, which is otherwise not
a setting at all.

The shipped model is `g(t) = long-run + (start - long-run) * decay^t`: a rate that begins near 6.6%
a year, the figure the Medicare Trustees project through 2035, and eases toward 3.8%, their
long-run assumption. The evidence for that shape, and for what it does not establish, is in
[research/MEDICARE_ESCALATION.md](research/MEDICARE_ESCALATION.md).

| box | shipped | what it is |
|---|---|---|
| start | 6.6% | the first projected year's rate. Published data. |
| long-run | 3.8% | the rate it eases toward. The Trustees' assumption, and the parameter the 30-year answer is most sensitive to. |
| decay | 0.90 | how fast one becomes the other. **The weakest of the three:** no year-by-year premium path is published past 2035, so it is fitted rather than sourced. |

**Setting start and long-run to the same number gives a flat rate**, which is how the tool behaved
before this model existed. That is also how the test suite proves the override is live rather than
ignored.

Each box is independent: fill one and the other two keep their shipped values. A blank box is not a
zero, and a typed **0 means premiums hold flat**, which is a real assumption someone might want to
test. The line under the boxes reports the 30-year multiplier, because two rates cannot be compared
by eye when one of them changes every year.

Share keys `mgs`, `mgl`, `mgd`. An untouched field emits no parameter, so a link from a plan that
never opened these is unchanged. A link that DOES carry them applies them to a reader without the
knob, who cannot see the controls - the same behavior as every other gated field here.

### The two deeper variants

Both are gated one notch below the plain knob: they respond only to the **literal value**, and
plain `?nerdknob` does *not* reveal them. Both are also read once at load, so the Documentation
checkbox cannot turn them on. Unchecking it does hide goal-first again (it also requires the knob to
be on); the Fixed Split menu entry ignores it.

| URL | what it unlocks |
|---|---|
| `?nerdknob=goal` | **Goal-first mode** (`P102`). An alternative planning surface that drives the classic controls rather than replacing them. Experimental, kept deliberately, and not something to stumble into. |
| `?nerdknob=split` | **Fixed Split** withdrawal family (`P104b3`), **on probation**. Adds the strategy menu entry, its panel, and its sweep rows. Like Proportional Withdraw and Ordered, it **never reads the IRA Goal**, so that field grays out when it is selected - a fact that belongs here rather than in the changelog, because a reader without this knob has no way to select the strategy it describes. |

Both still count as the plain knob for everything else, because `has('nerdknob')` is true for them.

---

## 2. URL-only inputs — real inputs with no form field

### Property and local tax, for the SALT test

**This is the one most easily lost**, because it is a genuine modeling input with no control
anywhere on the page. `calculateTaxes()` had always accepted `propTax` and always computed
`min(stateTax + propTax, saltCap)` correctly, but no caller passed it, so SALT was state income tax
alone and any household that would itemize was charged too much federal tax **in every year**
(`P64a`).

| parameter | meaning |
|---|---|
| `ptx` | property + other local taxes, **in today's dollars**, like `spendGoal` |
| `ptxm` | growth mode: `inflation` (default), `flat`, or `custom` |
| `ptxr` | the custom rate as a **percent**, used only when `ptxm=custom` |

The three growth modes are three genuinely different plans, and the SALT cap turns the difference
into a step rather than a smooth curve:

- **`inflation`** (default) tracks the plan's general inflation, and reads the *realized* price level,
  so it follows a Monte Carlo path the way `spendGoal` does. It uses `inflation`, **not** `cpi` — a
  property assessment is a household price, not a statutory threshold.
- **`flat`** is a nominal-constant bill, which decays in real terms.
- **`custom`** is an explicit rate. This is the California Proposition 13 case (a 2% assessment cap)
  and the reassessment-heavy case, neither of which is general inflation.

`ptx` round-trips: it is written into a shared link and read back on load, even though there is no
field to type it into.

Example: `?ptx=12000&ptxm=custom&ptxr=2`

### Presentation and navigation

| parameter | effect |
|---|---|
| `?tab=…` | opens on a named tab instead of Charts. Friendly names, because links are read by people: `annual`/`details`/`table`, `charts`, `optimizer`/`opt`, `montecarlo`/`mc`, `importexport`/`fileio`/`import`/`export`, `documentation`/`docs`/`help`. A typo leaves the default alone rather than silently moving you. |
| `?obj=…` | preselects the Optimizer's ranking objective. |
| `?montecarlo` | the teaching demo. Lands on the Monte Carlo tab in Synthetic mode with Seed / Paths / Input Distributions exposed and auto-runs the Experiment. **Deliberately narrow** — unlike `?nerdknob` it does *not* unlock the other advanced surfaces, only the MC panels and a lower paths floor. |
| `?runtests` | runs the in-page suites that write to the live page (skipped by default). |
| `?runtests=all` | also runs the slow tests that are otherwise skipped. |

---

## 3. Research inputs — node only, unreachable from a browser

These have **no UI, no URL parameter, and no presence in `getInputs()`**. They exist so harnesses can
A/B a decision that is otherwise a bare constant. Every one defaults to today's behavior, so an unset
run is bit-identical to a shipped run.

They are shape-validated rather than tested for truthiness, and that discipline is deliberate: a
malformed value must mean *"leave today's behavior alone"*, never *"model something else silently"*.

| input | replaces / does | phase |
|---|---|---|
| `timingConvThreshold` | pulls a year's CONVERSION to January when that year converts more than this. Reads the CURRENT year and never touches the spending month; cannot defeat the rule that a conversion may not precede a required distribution. `0` and a very large value are both meaningful endpoints. | `P28jb` |
| `gapFillWeights` | the hard-coded `[40, 60]` Brokerage/Cash spending-gap blend. Weights are relative, so `[1,1]` and `[50,50]` are the same split. | `P30a` |
| `bracketGapOrder` | swaps the first two accounts of the gap-fill cascade. | `P30c` |
| `schedulePlan` | a per-year policy carrier. Each entry takes exactly one of `ordTarget` (fill to this income ceiling) or `iraDraw` (draw this many dollars), plus optional `convert`, `spend`, `gapFill`. `compileScheduleFromRun()` builds one from a finished run. | `P103b2` |
| `oracleWithdrawalPlan` | a per-year withdrawal-split override, used by the perfect-foresight oracle. | `P51b` |
| `splitWeights` | the Fixed Split mix. Also reachable through the gated UI above. | `P104b1` |
| `returnSequence`, `returnSequencePerAccount`, `inflationSequence` | per-year market and inflation paths, supplied by the Monte Carlo engine. **`returnSequencePerAccount` is the one that gives each account its own return**, blended from shared draws by that account's own composition — so accounts diverge only as their allocations do, and only under `bootstrap`/`stress`. | MC |
| `_cfRun`, `_cfSuppressConversions`, `_cfSuppressConversionsFromYear`, `_cfSuppressConversionsBeforeYear`, `_cfSuppressExcess` | counterfactual flags behind Break Even and the opportunity-cost series. | various |

Two of these **refuse to compose** and throw rather than guessing: `schedulePlan` and
`oracleWithdrawalPlan` each reject `cyclicEnabled`, because a typo in a research input must never be
read as a quiet year.

---

## Keeping this file honest

- **Add a row when you add a gate or a URL-only input.** The cost of not doing it is a feature that
  exists only in someone's memory.
- **Delete a row when the thing goes.** `bracketCeilingAddDeduction` was a research flag here once;
  `P92a` shipped the fix and it is gone, and only a harness comment still names it.
- **When something graduates out of the knob, say so.** The two graduations recorded above exist
  because both were nearly re-gated by someone reading old code.
