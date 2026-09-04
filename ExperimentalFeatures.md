# Experimental features and URL-only controls

Everything the Retirement Optimizer will do that the ordinary page does not show you. Three kinds,
and the difference between them matters:

| kind | reached by | who it is for |
|---|---|---|
| **knob-gated UI** | `?nerdknob`, and two deeper variants | a curious user, at their own risk |
| **URL-only inputs** | a query parameter, no form field anywhere | a real modelling input that never got a control |
| **research inputs** | node only, no URL, no UI | harnesses. Not reachable from a browser at all |

**Why this file exists:** every one of these was added for a reason that made sense at the time and
then stopped being written down anywhere a person would look. A control nobody can find is the same
as a control that does not exist, and a research input nobody remembers is a trap for whoever next
changes the code around it.

---

## 1. `?nerdknob` — the advanced surface

`?nerdknob` on any Optimizer URL reveals advanced controls: Monte Carlo parameters, the
Guyton-Klinger guardrail inputs, the 💵 cash-funded sweep dimension, fixed tax indexing, the
withdrawal-month control, and other diagnostics.

It can also be flipped **at runtime** by a hidden checkbox on the Documentation tab
(`setNerdKnob` / `applyNerdKnobVisibility`). That flip is deliberately **not** written back to the
URL, so a link you share does not carry your knob state.

Two things have graduated *out* of the knob and must not be put back: the **optimizer objective
selector** (PF13) and the **ACA Cliff options** (v11.1464).

### Timing diagnostics behind the plain knob

Two selects that answer "when does the money actually leave?", both defaulting to today's behavior
and both carried in a shared link:

| control | URL key | choices |
|---|---|---|
| **Withdrawal month** (`P28jh`) | `fwt` | *Automatic* (the shipped rule: January in any year following one that converted more than $1,000, November otherwise), *Always January*, *Always November* |
| **Tax paid** (`P108b`) | `txs` | *With the withdrawal* (today), *In December* |

They matter because the whole year's draw leaves at once - the spending money **and** the tax on it -
so a January draw stops compounding eleven months early. Measured on five households, settling the
tax in December is worth 0.10%-1.77% of net worth against the automatic rule; most of that is already
obtainable by choosing *Always November* instead. Income tax only: Medicare premiums are billed
monthly and are never deferred either way.

Both are **hidden, not disabled**. A link carrying `fwt=late` or `txs=december` still runs that way
for a reader without the knob, because the alternative is silently running a different plan than the
link describes.

### The two deeper variants

Both are gated one notch below the plain knob: they respond only to the **literal value**, and plain
`?nerdknob` does *not* reveal them. Both are also read once at load and never toggled at runtime, so
the Documentation checkbox cannot reach them.

| URL | what it unlocks |
|---|---|
| `?nerdknob=goal` | **Goal-first mode** (`P102`). An alternative planning surface that drives the classic controls rather than replacing them. Experimental, kept deliberately, and not something to stumble into. |
| `?nerdknob=split` | **Fixed Split** withdrawal family (`P104b3`), **on probation**. Adds the strategy menu entry, its panel, and its sweep rows. |

Both still count as the plain knob for everything else, because `has('nerdknob')` is true for them.

---

## 2. URL-only inputs — real inputs with no form field

### Property and local tax, for the SALT test

**This is the one most easily lost**, because it is a genuine modelling input with no control
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
| `timingConvThreshold` | the bare `1000` that decides whether last year's conversion flips this year's withdrawal to January. `0` and a very large value are both meaningful endpoints. | `P28jb` |
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
