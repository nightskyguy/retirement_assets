# Retirement Optimizer: Detailed Change Log

Full write-ups of what changed in each release, newest first.

The Documentation tab inside [retirement_optimizer.html](retirement_optimizer.html) carries a short
summary of the most recent releases and links here for the detail. Entries marked **behavior
change** alter the numbers an existing plan produces, so a saved scenario or a shared link can give a
different answer than it did before that release.

For what the tool does and how to use it, see [README.md](README.md).

---

<a id="11.15cc"></a>

## 11.15cc

### The IRMAA ceiling was aiming two years of inflation too low

IRMAA bills the premium for a given year against the MAGI you reported two years earlier, and it
compares that MAGI against the thresholds published for the **billing** year. The engine had the
billing half right: it reads the MAGI from two years back and measures it against thresholds
inflated to the current year, which is what SSA does.

The targeting half was wrong. Every ceiling that caps *this* year's MAGI to stay inside a tier used
*this* year's threshold, when the MAGI it is capping will be judged against the threshold published
two years later. At 3% inflation that aims about 6% low. On the MFJ Tier 1 floor of $218,000 it is
roughly $13,300 a year of Roth conversion room that was never used, every year of a plan.

The error was in the safe direction, so no plan was ever told it would stay in a tier and then
billed for a higher one. But the cushion was accidental, undocumented, and unrelated to how
expensive the cliff it was guarding actually is.

Three places did this, and all three are fixed. Only **two** of them can actually change a number:

- **IRMAA Ceiling strategy** ("Fill Fed/IRMAA Bracket" with a tier selected). Live.
- **QCD "As Needed"**, which donates only as much as it takes to drop two IRMAA tiers. Live, and
  the place the correction is worth the most.
- **The internal `minlimit` ceiling**. Provably **inert**: the value it computes has always been
  equal to the spending-goal band it is compared against, so the IRMAA lookup there contributes
  nothing and never did. Verified over 7,216 combinations of goal, filing status and inflation with
  zero exceptions. The projection is applied there anyway so all three read the same way, and a
  test now pins the inertness so the site announces itself if the bracket ladder ever changes.

**Behavior change.** An IRMAA Ceiling plan now converts more, a QCD "As Needed" plan donates
slightly less, and both shift the numbers in a saved scenario or a shared link. At 0% inflation
nothing moves at all, which is what makes this an indexing fix rather than a new policy.

### The forward projection applies to every setting, including "No margin"

The margin selector's options used to read "None (aim at the threshold)", "$1,000", "$2,000" and so
on, which never said WHICH threshold and was reasonably read as "no forward projection at all". It
never meant that: the projection always applies, and the setting only chooses how much extra room to
leave below the projected figure. Every option now names it - "No margin (aim right at the projected
threshold)", "$1,000 below the projected threshold" - and the tooltip says it outright.

The practical consequence is worth stating because it is the point of the whole change. Income
sitting between today's tier floor and the projected one is **already under the line that will judge
it**, so QCD "As Needed" asks for nothing at all. Single filer, 3% inflation, Tier 1 floor $109,000
projected to $115,638:

| your MAGI | QCD asked for now | QCD asked for before |
|---|---|---|
| $109,500 | **nothing** | $501 |
| $112,000 | **nothing** | $3,001 |
| $115,000 | **nothing** | $6,001 |
| $116,000 | $363 | $7,001 |

Pinned by a test at that boundary, including the check that it still trims once you are genuinely
over the projected floor - it is a boundary, not a blanket exemption.

### The default margin, and one setting retired

The default is now **"project forward at half the expected inflation"**, and the **$1,000** option is
gone.

Measured across 60 rolling 40-year windows of the actual CPI-U record since 1928. The old default,
half the next tier's surcharge, is $1,000 to $2,500 of room - against roughly $8,300 for two years of
a 1.5-point inflation miss on the $274,000 MFJ Tier 2 floor. It prevented 5 breaching years out of 92
where the half-inflation setting prevented 21, and the half-inflation setting is the only one that
never cost surcharge in any of the 60 windows.

The $1,000 option went because it is the wrong SHAPE. An inflation forecast error is proportional, so
the room that absorbs it has to be proportional too; a fixed dollar setback is worth less every year
as the thresholds inflate, and it saved four to five times less than a rate-based one. A saved link
or scenario still carrying it falls back to the default rather than failing.

Five settings remain: half the expected inflation (default), 1% less than expected inflation, half
the next-tier surcharge, $2,000, and no margin at all.

### A selectable safety margin, behind the nerdknob

An IRMAA tier is a cliff: one dollar over the line costs the whole surcharge for a year. The old
buffer against that was exactly $1. There is now an **IRMAA safety margin** selector next to the
Cycle Brokerage row, visible with `?nerdknob`, offering:

- **Half the next-tier surcharge** (default). Looks up what crossing this particular boundary
  costs per year and holds back half of it, so the setback scales with the size of the cliff.
- **None**, **$1,000**, **$2,000** - fixed setbacks below the projected threshold.
- **Half the expected inflation**, **1% less than expected inflation** - hold room back by
  projecting the threshold forward at a slower rate instead of subtracting dollars.

It is gated because it is still being measured, not because it is dangerous. The forward projection
underneath it is **not** gated: that is a correctness fix and it applies to everyone. Hiding the
selector leaves the default margin in force, not "no margin".

### What the measurements say, including the parts that did not go as expected

`node .test_harnesses/irmaa_margin_harness.js`, 588 simulations across 7 portfolio shapes, 3 CPI
rates and 3 strategy arms, written up in
[.test_harnesses/IRMAA_MARGIN_RESULTS.md](.test_harnesses/IRMAA_MARGIN_RESULTS.md):

- **The correction is worth real money on QCD "As Needed".** That mode donates exactly enough to
  reach the target, so raising the target shrinks the donation dollar for dollar. Across the swept
  cells the forward projection alone avoids **$1.9M of unnecessary donation** against the old
  under-indexed target. This is the place the fix pays.
- **The margin itself prevents nothing measurable**, and cannot be chosen on this evidence. Every
  breach in every mode - twice now, on two different grids - is the same thing: income sized while
  married and billed after a death against single-filer thresholds roughly half as high. There was
  never a same-status breach for a margin to prevent. That is the IRMAA half of the widow penalty;
  the billing is correct and the targeting does not see it coming. Projecting the filing status
  forward, not just the inflation, is the follow-up.
- **The margin does earn its keep, but only against an inflation UNDERSHOOT.** CPI is a constant in
  this engine, and Monte Carlo does not help: it varies spending inflation, never the CPI that
  indexes the IRMAA ladder. Feeding the 1971-2000 CPI record through it as an inflation sequence
  leaves the ceiling byte-identical. So the margin was measured a different way, by letting the plan
  decide under its assumed CPI and then re-billing those same decisions against thresholds indexed
  by a realized CPI, over the whole CPI-U record since 1928. That needs no engine change, and it
  gives a clean answer: **zero breaches in every setting when inflation meets or beats the
  assumption, and breaches only when it falls short**. Assume 2.5% and get 1%, and the "1% less than
  expected inflation" setting prevents about a fifth of them; the flat dollar settings prevent almost
  none. A CPI error is proportional, so only a proportional setback absorbs it - a flat $1,000 decays
  to irrelevance as thresholds inflate. Across 60 rolling 40-year windows the breach rate runs 16.2%
  with no margin and 11.9% with the strongest one.
- **The shipped default is the weak setting.** "Half the next-tier surcharge" is $1,000 to $2,500,
  while two years of a 1.5-point CPI miss on the $274,000 MFJ Tier 2 floor is about $8,300. It
  prevents 5 breaches out of 92 where a rate haircut prevents 18. The default is unchanged in this
  release because moving it changes every existing plan's numbers; the evidence for changing it is
  in [.test_harnesses/IRMAA_CPI_RISK_RESULTS.md](.test_harnesses/IRMAA_CPI_RISK_RESULTS.md).
- **Careful with an apparent win.** On a plan with Cycle Brokerage on, one setting looked worth
  +0.68% of final wealth. It was harvest timing, not IRMAA: wealth there is a smooth function of how
  many dollars the ceiling is lowered by, the best amount moves from $1,000 to beyond $9,000
  depending on the portfolio, and with Cycle Brokerage off the effect falls to +0.002%.

### Fixed in the same release: one unclosed tag was bolding the rest of the page

The v11.15a2 changelog entry on the Documentation tab opened a `<strong>` and never closed it.
Nothing threw and the source read fine, but the HTML parser's recovery moved the two entries below
it inside a stray `<strong>` hanging off the list itself - four entries in the file, two in the
page - and carried the bold on out of the list and into the **How to Use** section. It was reported
as "everything is bold", which is a long way from the single missing tag behind it.

The in-page suite now refuses to let that ship again, with three checks. A `<ul>` or `<ol>` may
contain only `<li>` children, which is the general law and catches the same mistake anywhere on the
page. Every changelog version stamp must still sit in its own `<li>`. And **How to Use** must not be
inside an inline tag, which is the symptom as a reader actually meets it.

### Also

- `optimizer_core.tests.js` gains 7 tests (269 to 276), pinning the forward factor, the identity at
  0% inflation, the ordering of all six margin settings, the margin at age 63 before anyone is
  enrolled in Medicare, and that none of it leaks into a plan with no IRMAA ceiling.
- A test added earlier in this release claimed to cover the `minlimit` ceiling and covered the tier
  ceiling instead, because the tier it passed sent the code down the other branch. Replaced with the
  inertness proof described above.
- The long-standing P32 tripwire moved for the first time in four attempts: `minlimit` now strands
  spending across 11 years rather than 9, because a higher ceiling drains the IRA two years sooner
  and hands two more years to the pass that refuses to touch Brokerage. Re-pinned with the reason
  recorded next to it.

---

<a id="11.15c9"></a>

## 11.15c9

### More accurate SALT (state and local tax) deductions

**Behavior change.** Three corrections to how state and local taxes are deducted, all affecting tax
years 2026 through 2029:

- **Property and other local taxes can now be included.** Previously only state income tax counted
  toward the SALT figure. Add yours with `?ptx=25000` in the web address - state income tax is
  already supplied elsewhere, so enter only property and other local taxes here. Optionally set how
  it grows over time with `?ptxm=flat` or `?ptxm=custom` plus `?ptxr=2`; the default is to grow with
  inflation. Sharing a link and saving a named scenario both keep the figure.
- **The higher $40,000 SALT cap now runs through 2029**, as the law allows, rather than reverting to
  $10,000 a year early.
- **The SALT cap and the income limit that phases it out now step up 1% a year**, so 2026 uses
  $40,400 and $505,000.

For plans converting heavily in a high-tax state, these can change the recommended conversion size.
Note that this tool tests only SALT against the standard deduction - it does not model mortgage
interest, charitable giving, or medical expenses - so the benefit is limited to households where SALT
alone exceeds the standard deduction, and it ends after 2029.

---

<a id="11.15a2"></a>

## 11.15a2

### Five Payment Plans - Was 3 plus Quarterly

Previously comparisons were not apples-to-applies (same time frames). Now there are 5 plans now rather than 4 - Quarterly payment was not called out as a separate plan, 
so it became "Plan Q". Each plan is measured up to April 15th so they are on equal footing - previously one plan 
measured to April 15th of the following year, but the others did not.

Each plan is a full computation in its own right.
Draw timing and tax-payment timing are separate levers, and the tool now says so.
A star (★) marks the cheapest plan(s)

- **Plan A, Early.** Draws and conversions next month, tax withheld at the draw. [Was Plan B]
- **Plan B, Hybrid.** Conversions next month, draws and withholding in December. Shown only when
  there is a conversion to pull early; without one it would be a copy of Plan C, and the table now
  says that in a line rather than letting the column vanish. [Was Plan A]
- **Plan C, Late.** Everything in December. [Same as prior]
- **Plan D, Split.** New. The spending part of each draw is taken early with no withholding, and the
  tax part is held back to a separate December draw withheld up to 100%, which Form W-4R permits.
  You get your spending cash on the early schedule and the tax still gets the pro-rata credit that
  only withholding earns. Total draws are unchanged: D never adds a supplemental draw, because that
  would create taxable income your entered tax figures do not include.  Useful if you want to get your spending money early, 
  and pay taxes when there is more tax certainty - however there are some costs and potential gotchas.
- **Plan Q, Quarterly.** Spelled out separately, but was being compared to in the prior version. December draws with no withholding at all, and the whole liability paid
  as quarterly estimates.  NOTE: Selling appreciated brokerage shares to fund those estimates is now a footnote under the table rather than a fourth row that read like a plan. It is a way to fund Plan Q, and it carries the capital gains tax on the sale.

Some minor corrections were also made: 
- Using weekdays where previously they were not being used. Payments that may 
have landed at the end of the year or past deadlines are moved earlier - for example when running the Tax Planner at the end of the year, compliance requires timely payment within the year.
- In some cases the plan reported that there were no penalties, but the logic was inconsistent. 
- Roth gains from an early conversion appeared as if they were costs, rather than improvements.
- The tool failed to point out that late draws carried the consequence of not getting "spending money" until late in the year. This is now spelled out.
- *Citations are clickable* - in plan descriptions the codes cited are now clickable.
- **The Income Tax Planner button** In the [IncomeTaxPlanner Tool](standalone/IncomeTaxPlanner.html) was non-operational and is now fixed.
- **Safe harbor** now states whether Federal safe harbor is met, and does so using either the input fields, or by inferring net income.
- **Withholding is credited in equal parts across every due date**, whatever date it actually
  happened [IRC 6654(g)], so a December draw can still satisfy a quarter that has already gone by.
- **An estimated payment counts on the day you pay it**, so an installment already past cannot be
  made timely at all.
- Plans are ranked by first-year cost, and an **underpayment penalty** is not part of that cost. When the cheapest plan is one that misses safe harbor,
the winner line and a header badge now say so, because the ranking alone would hide it.
- The planner no longer credits withholding to money that has already moved.  You can indicate that some of the payments or withdrawals have already been done and the planner no longer assumes that "completed" items had the proper withholding.  Instead you must 
   - **Tell the planner the figure** and it is credited in full, exactly as before but on your numbers.
   - **Leave it blank** and the planner credits nothing. It then schedules estimated payments for the
  shortfall, which overstates what you still owe rather than understating it. That is the safer
  direction to be wrong in, and the note on the plan says so in as many words.

**Saved URLs will now compute correctly and may show the newer (not prior) plan numbers.**

---

<a id="11.1585"></a>

## 11.1585

**Two Stress Test fixes. No change to any plan or its numbers.**

### The Stress Test now updates when you load a saved scenario

Loading a scenario refreshed everything in the summary bar except the Stress Test, which kept showing
the result for whatever plan had been on screen before. It corrected itself only if you edited a field
by hand or opened the Monte Carlo tab, so the most likely reading was that the scenario had not loaded
at all. It now refreshes with the rest of the summary bar. The same load also raises the "out of date"
notice on the Monte Carlo tab when a full comparison run is on screen, which it should have been doing
and was not.

One case is still open, and is not fixed here: if you load a scenario in the second or so while a
Stress Test pass is already running, that pass finishes last and leaves its own, now older, numbers on
the tile. Editing any field or opening the Monte Carlo tab corrects it.

### "All start years" no longer calls every year one of the worst

The Stress window offers two selections. Combined ranks every start year over each of five lengths and
runs the worst of each. All start years runs the entire record, good years and bad alike. The result
sentence described both the same way, so in All mode it read "in 13 of the 98 worst historical periods
on record" about a set that is simply every year there is. It now reads "in 13 of the 98 start years on
record", and the tooltip on both the headline and the summary tile explains the selection actually in
use. Combined is unchanged, where "worst" was accurate all along.

The README's Stress Test section had drifted from the code and is corrected: it described six ranking
lengths including a 25 year window that does not exist, and quoted a fixed count of 36 start years that
moves with the Stress sequences box.

Additional elements were added for P32 research.

---

<a id="11.1581"></a>

## 11.1581

**Self-check fix. No change to any plan or its numbers.**

The page runs its full test suite at load and reports the result in the indicator at the top. That
indicator has a staleness guard: the page is told how many tests each suite on disk is supposed to
contain, and if the real number differs it refuses to report green, because a page that has lost
count of its own tests cannot honestly claim they all passed.

Tax Payment Planner release 1.1580 added 2 tests to its own suite and did not update that expected
count.

**This file had an editing pass of its own.** Including fixing dead links, an empty link, and more.

---

<a id="11.1553"></a>

## 11.1553

**A teaching demo that shows, in one table, how the number of Monte Carlo paths matters. No change
to any plan or its numbers.**

### The `?montecarlo` demo

Adding `?montecarlo` to the page address (for example
`retirement_optimizer.html?montecarlo`) opens the Monte Carlo tab in Synthetic mode, exposes the
Seed, Paths and Input Distributions controls, and automatically runs a small experiment: the plan
currently in the sidebar, simulated with three random seeds at each of four path counts (5, 10, 25
and 100). Every cell goes through the same engine and reports the same numbers a manual "My Plan
Only" run would, so nothing in the table is a special demo figure.

The table lists, for each seed and path count, the sampled Equity range (the worst and best single
year across all the paths in that run) and the Inflation range. The point is visible at a glance:
with 5 paths the equity range swings widely from one seed to the next, and by 100 paths it has
settled. The Experiment button reshuffles the three seeds so a reader can watch a fresh random draw
land in the same structure. The Input Distributions panel below is drawn from the last run in the
grid (100 paths) and, in this mode, shows its worst and best sampled lines by default rather than
hiding them behind a legend click.

Synthetic inflation is still a single fixed rate today, so its column shows one value; the table is
built to display a real range automatically once Synthetic paths gain a varying inflation series.

### The Paths box can now go below 100 in advanced and demo modes

The Paths field is normally held at a minimum of 100, because the survival rate and the percentile
bands stop meaning much at very low path counts - but experiments are allowed down to 3 paths. 
The default experience is unchanged.

---

<a id="11.152f"></a>

## 11.152f

**A Stress Test release: two crashes fixed, the ranking windows can now be combined or skipped
entirely, and failures are graded against the length of your plan.**

**Behavior change:** the Bear-start overlay now draws its opening from the worst 3, 5 and 10 year
stretches rather than the worst decade only, which moves Historical Monte Carlo results. Nothing
else here changes any plan or its numbers.

### Asking for 85 or more stress sequences froze the tab  (nerdknob mode)

The Stress Test ranks historical retirement start years and runs the worst of them. How many there
are to rank depends on the window, because a start year has to have the full window of real data
after it to be scored at all: a 5 year window leaves 94 candidates and a 30 year window leaves only
69. Asking for more sequences than the record can supply used to run off the end of the ranked list and freeze.

The count is now capped at what the window can supply and anything above that is ignored.

### Clearing the Paths box printed "NaN"

The run size line under the Run button updates as you type. Emptying the box left it reading
"NaN paths x 144 strategies = NaN simulations" until you typed a digit. Every numeric box on the tab
now falls back to its default when empty and is held inside its stated range, so a half-typed value
cannot reach the run, the time estimate or the out-of-date check.

### One window at a time was hiding most of the bad years

Windows were increased to 5/10/15/20/30 and Combined. Previously picking one (10 was the default) 
caused the worst 5-year start, for example, to be skipped because it was only looking at 10 year combined 
growth rates.

Two new choices in the Stress window selector:

- **Combined (5/10/15/20/30)**, now the default, scores every window and keeps the union of what
  each one flags. The count you set is per window, and because the windows overlap the union is 
  smaller than the sum: the new default of 20 gives about 40 distinct start years rather than 100.
  Hovering over a row says which windows flagged that year.
- **All start years** skips ranking and runs every start year the record holds, currently 98. At
  that density the individual lines stop being readable, so survivors fade back and the failures are
  drawn solid and on top. The shape you are looking for is how much of history breaks the plan, not
  which line is 1966.

Everything the ranking picks is still a real historical sequence run straight through, not a snippet added 
at the beginning.
A window longer than your plan is trimmed to the length of the plan, so a 12 year plan combines
5, 10 and 12 rather than considering 15, 20 and 30 year stretches.

The defaults are now 20 sequences and the Combined window, up from 10 and a single 10 year window.

### Red and amber now mean early and late in YOUR plan

A failure now is marked red if ruin occurs before the halfway point, yellow if it lands on or after the halfway point, and 
green if the stress for that sequence ends in assets still present (success rather than ruin).  Early ruin is worse 
because it's harder to avoid.

### The scenario table reports the whole plan, and the worst stretch inside it

Real CAGR is now calculated over your whole plan, for every sequence, and it also 
calculates the worst 5, 10, 15 and 20 year real return found anywhere inside it. A sequence can open
calmly and still contain the decade that breaks the plan. The old stress test might not have discovered the 
true worst scenario.  To save space, the equity, bond, international and inflation rates moved into the hover-over data.

### Sequences that run past the end of the record are now marked

A plan longer than the record has left after its start year wraps around and replays history from
1928. A 2015 start on a 30 year plan gets 11 real years and then 19 of replay. That has always been
the behavior, and the ranking has always excluded start years without a full window of real data
after them, so a wrapped stretch never gets a vote in which years are worst. It is now visible: the 
graphed line becomes dashed. Hover over the row to reveal the year the record runs out.

### Bear-start openings are no longer all the same shape

**This one changes Historical numbers.** Bear-start overlays a bad historical opening onto a quarter
of the simulated paths, on the grounds that block sampling on its own shuffles the year order and so
under-produces the sustained bad opening that actually breaks a retirement.

It drew that opening from the worst ten *decades*, and averaging over a decade washes a crash out.
1930 is the worst opening in the whole record measured over three years, at -26.9% a year after
inflation, and only the thirteenth worst measured over ten, at -0.4%, because the decade starting
1930 contains 1933's +54% rebound. Ranked on decades, the pool came out as 1999, 1965, 2000, 1969,
1968, 1966, 1972, 1973, 1970 and 1929: six of the ten being 1960s and 1970s stagflation, 1930 absent
altogether, and only 1929 opening worse than -15% a year over its first three years. And because
every draw was spliced for a full ten years, a 1929 draw arrived with its own 1933 to 1936 recovery
attached. The overlay could not produce "crash, then whatever comes next", which is the shape people
mean by a bear start.

The pool is now the worst ten start years over each of three, five and ten years, and each one is
spliced for the length that flagged it. A three-year draw gives three brutal years and then hands
back to the random draws; a ten-year draw behaves as before. Thirty entries drawn from twenty-one
distinct years, averaging a six-year opening. A year that several lengths agree on, like 1929,
appears once per length and so is drawn proportionally more often.

The fraction (only visible in nerdknob mode) stays at 25%. Measured
over the three to five year openings this overlay now mostly draws, the frequency is about 22%, so
25% is a modest and deliberate over-weighting rather than a base rate, and the tooltip now says so.

Also fixed here: an opening longer than the whole plan used to write past the end of that path's row
and corrupt the start of the next one. It is capped at the plan length now. This only affected plans
shorter than ten years.

### Two run buttons are now visible, and each states what it will cost

The tab had one button, "Run Monte Carlo", which ran every withdrawal strategy the Optimizer knows
how to build so it could rank them. That is about 144 strategies, and the path count is per strategy,
so the default 500 was 72,000 simulations and about 43 seconds of work. A second button only runs your 
own plan.

- **My Plan Only** is listed first and is the new default. It answers "how did my plan do", which is the
  question most people want to answer. It costs about one 144th of the work. You get your chance of success
  and the percentile chart, but no strategy ranking table.
- **Compare All Scenarios** is the old behaviour, renamed to say what it actually does.

Each button carries its own expected time, measured on the machine you are running on rather than
guessed: "My Plan Only (1.3 sec)", "Compare All Scenarios (43 sec)". The first figure shown is an estimate; 
after one run it reports the time actually measured.

### Changing a Stress Test setting no longer marks the whole run out of date

Editing Stress sequences or the Stress window used to raise the "Out of date" banner over the whole
Monte Carlo sweep. That banner's Re-run button re-runs everything, so it was offering half a minute
of work on the roughly 144 strategy sweep to refresh a chart that had already refreshed itself by the
time the banner appeared. Only a change the sweep itself would have seen marks it out of date now,
and the stress pass keeps re-running on its own either way.

### Smaller things

- The Stress Test chart legend was dropped. The table underneath already names every line,
  carries every number, sorts, and shows each line's color in its first column. The table made the legend 
  a waste of space so only the table remains.
- The hover-over data is not shown until you pick a line from the table. Click the row in the table again to bring 
  all the graphed lines back.

---

<a id="11.150b"></a>

## 11.150b

**The Monte Carlo tab now shows you your own plan, says how big the run really is, and the Stress
Test is readable. No change to any plan or its numbers.**

**Your plan is pinned and its chance of success is stated outright.**

The survival table ranks every withdrawal strategy against every other, which answers "what is best"
but never answered "how did mine do". Your own plan was a row somewhere in a table of about 144,
sorted by somebody else's metric, with nothing marking it. It is now pinned with a 📍 to the top of
the table and stays there whatever column you sort by, it is drawn as the thick line on the chart,
and a sentence above the chart names it and gives its chance of success directly: how many of the
simulated paths it survived, and the median balance it ended with. If your exact settings are not
among the strategies the sweep covers, the page says that plainly instead of pinning a near miss.

**"500 paths" was never 500 simulations.**

The Paths box is the number of paths run per strategy, and the sweep runs every strategy it knows
how to build so it can rank them. On a typical plan that is about 144 of them, so the default 500
paths is 72,000 simulations covering 1.8 million years for a 25 year long retirement. Nothing in the
tool said so, which made a run that takes half a minute look like it should have been instant. The
box is now labeled "Paths (per strategy)" and the full arithmetic, "500 paths x 144 strategies =
72,000 simulations, 1,800,000 simulated years", appears beside the Run button and under the survival
table. 72,000 retirements simulating about 1,800,000 years is why the wait is what it is.

**The Stress Test chart is legible.**

Every line used to be labeled "1966 (eq: +6.0% inf: +7.0% real: -1.0%)". Ten of those made the
legend wider than the plot it was explaining. Each line is now labeled by its start year and what
happened to the money, for example "1966 ✗2041" or "1999 ✓", and every statistic that used to be in
the label has a sortable column in a new table under the chart: start year, outcome, ruin year, years
to ruin, equity CAGR, inflation CAGR, real CAGR and final balance. Click a row to isolate its line,
the same as clicking the legend.

The colors changed meaning. They used to run dark red to amber by how bad the opening stretch was -
ten years by default, but it may instead be 5, 15, 20 or 30 - which is the reason a sequence was
picked, not what became of your plan in it, so a scenario your plan sailed through could still be
drawn in alarm red. Red now means the money ran out inside that opening window, amber means it ran
out later, and green means it never ran out. Sequences are listed
worst first: earliest failure at the top, survivors at the bottom.

**The ten-year window is now adjustable, and what it does is documented.**

Under nerdknob there is a new Stress window control offering 5, 15, 20 or 30 years instead of the
default 10. It changes two
things at once, on purpose: which historical start years count as the worst, since they are ranked by
real return over that stretch, and where the line falls between an early failure and a late one. A
window longer than your plan is trimmed to the length of the plan, and the caption under the chart
always names the window actually in use.

Two long-standing behaviors are now written down in
[Stress Test vs Monte Carlo Analysis](README.md#stress-test-vs-monte-carlo-analysis), because both
surprise people. The
window only *ranks* start years, it is not a splice point: after it, each scenario keeps following
the real historical record for the whole length of your plan, wrapping back to 1928 when it runs past
the end of the data. And the seed does not move the Stress Test, because there is no random number
drawn anywhere in it. The seed tooltip now says so.

**Inflation is colored by whether it hurts you, not by its sign.**

Every figure in these summaries was green when positive and red when negative, which is right for a
return and backwards for inflation: 8.7% inflation was drawn in the same green as a good year for
equities. Inflation now reads red when it is above zero and green when it is at or below zero,
everywhere it appears. The other series are unchanged.

**Both banners are now the control that folds their section.**

The Stress Test starts folded, since its banner already carries the result and the chart plus
scenario table underneath are a lot of page to open unasked. The Chance of Success section starts
open.

The Stress Test had a plain "Stress Test" heading to click and a colored result banner underneath
it, so the one thing worth reading while the section was collapsed was not the thing you clicked to
collapse it. They are now the same element: the banner carries the heading, the count and a chevron,
and clicking anywhere on it opens or closes the section. The main Monte Carlo block works the same
way, with the Chance of Success banner moved up above the strategy table it introduces, folding the
table and the chart together. Both start open.

**The run size now says how many years it is simulating.**

The readout gains a third figure: "500 paths x 144 strategies = 72,000 simulations, 1,800,000
simulated years". Each of those simulations is a full plan run with a tax return computed in every
year, so the year count, not the simulation count, is what the running time is actually proportional
to. It is the number that explains the wait.

**The Historical summary line reads like the Synthetic one.**

Synthetic mode described itself in a sentence, while Historical rendered a four-row Min/CAGR/Max grid
wedged into the same line, leading with the least useful figure. Historical now uses the same
"·"-separated sentence, per asset, in CAGR then worst year then best year order, with the same red
and green coloring so a negative number is visible without reading it. Both modes now put the CAGR
first. The stress panel's own summary line changed with it.

**Reordering and two additions in the Stress Test.**

The survival table sat between the Stress Test and the chart that goes with it; it now sits after
the Stress Test, next to its chart. The scenario table gains Bonds CAGR and Intl CAGR columns, so a
sequence where equities and bonds both fell is distinguishable from one where bonds held up. Those
two figures were never computed before, only equity and inflation were. International data begins in
1970, so scenarios starting earlier show domestic equity as the proxy, which is the same substitution
the simulation itself makes. The Outcome column now says "Ruin" for both early and late failures: the
color already carries that distinction and the Ruin Year and Yrs to Ruin columns give the exact
answer.

**The historical record label said 1928-2024 and had not been true for a while.**

The embedded data runs through 2025 for equities, bonds and international, and the code has always
used all of it. Only the labels were stale. They now say 1928-2025.

**You can now run Monte Carlo against your own plan alone (nerdknob).**

*This part is deliberately absent from the short changelog inside the page. It adds a control
without changing what anyone gets by default, so it is recorded here for the record rather than
announced on the Documentation tab.*

The tab has only ever had one kind of run: simulate every withdrawal strategy and rank them. That is
about 144 strategy arms, and it is why a run takes half a minute. Most of that work answers "which
strategy is best", not "will my plan hold up", and the second question needs 500 simulations rather
than 72,000.

Under nerdknob there is now a second button, **Run My Plan Only**, which runs just the plan in the
sidebar. On the default scenario it finishes in under two seconds instead of around thirty-seven, and
it produces the same answer: the same 66.6%, the same 333 of 500 paths that the pinned row reports
after a full comparison run. You get your chance of success, the percentile chart and the Stress
Test; you do not get the strategy comparison table, because a one-row ranking is not a ranking, so
that table is hidden in this mode.

**Nothing changes unless you press the new button.** "Run Monte Carlo" still means compare every
strategy, and that is still what runs automatically when you open the tab, which is what people
without nerdknob get. Switching between the two marks the previous result out of date rather than
leaving the other mode's answer on screen.

This was cheap to add because it required no engine change at all: a single-variation run is exactly
the shape the Stress Test pass has used since it was introduced, so the worker was already able to do
it.

**Fixed a potential freeze when running Monte Carlo,** along with a progress bar that could sit at
the same number for a whole run and a Cancel button that would not take effect until the run ended
on its own. Only the downloaded copy of the tool, opened directly as a file, could freeze; the
version served from the web was never affected.

**Three fixes came out of the same work.**

Toggling Current Dollars re-drew the main chart but not the Stress Test chart, which silently stayed
in nominal dollars underneath it. Both now switch together, along with the new table. Sorting a
column whose blanks are stored as "no value", such as Exhausted or Total Taxes, compared two blanks
by subtracting them, which produces a meaningless result and left those rows in arbitrary order; the
comparison is now done properly. And the "paths" readout beside the Cancel button described the
previous run rather than the one in flight. Hovering over a line on the main chart could also name a
different strategy than the one its legend entry named.

---

<a id="11.1508"></a>

## 11.1508

**Self-check fix and documentation. No change to any plan or its numbers.**

The page runs its full test suite at load and shows the result in the indicator at the top. That
indicator has a staleness guard: the page is told how many tests each suite on disk is supposed to
contain, and if the real number differs it refuses to report green, because a page that has lost
count of its own tests cannot honestly claim they all passed.

Release 11.14e1 added 11 tests to the engine suite and did not update that expected count, so the
guard fired as designed and the indicator read "test counts changed" with the console
detail `optimizer_core: 244 tests on disk, 233 expected`. Nothing was failing. The expected count
is now 244, which is the number `node optimizer_core.tests.js` actually reports, and the indicator
is green again.

Also in this release:

- **[README.md](README.md) now explains [Monte Carlo and "Chance of Success"](README.md#monte-carlo-and-chance-of-success-accuracy) properly.** 
  Walks through what a Monte Carlo simulation is doing, why results from two different
  tools are not comparable, why more iterations cannot repair a sampling method that does not
  resemble the real world, why a model that holds inflation fixed is not good enough, why real
  markets trend rather than lurch randomly year to year, and why a seeded (repeatable) random
  sequence matters. It ends with what you can and cannot conclude from any tool's success
  percentage.
- **The [tax-withholding maneuver](README.md#why-end-of-year-vs-quarterly) section gains "the *other* maneuver":** using the once-per-year
  IRA-to-IRA rollover, with repayment, to pay taxes through withholding, and the five separate
  jobs that one pair of transactions can do.

---

<a id="11.14e1"></a>

## 11.14e1

**Research groundwork. No change to any plan or its numbers.** Nothing on the page behaves
differently.

What was added, and why:

- **Four engine research inputs**, used only by the offline study harnesses.
- **Five research studies were run and recorded** (results live beside the harnesses). The
  highlights below will shape future releases:
  [Brokerage Research](https://github.com/nightskyguy/retirement_assets/blob/main/.test_harnesses/P32_RESULTS.md), 
  [Proportional Draw Research](https://github.com/nightskyguy/retirement_assets/blob/main/.test_harnesses/PHASED_RESULTS.md)
  (it's not as optimal as thought), and 
  ["EndGame" Research](https://github.com/nightskyguy/retirement_assets/blob/main/.test_harnesses/ENDGAME_RESULTS.md) -
  what is the best strategy once the IRA is under control. 

---

<a id="11.14dd"></a>

## 11.14dd

**Behavior change** (Ordered strategy, RIBC and BIRC sequences only).

The Ordered strategy draws your accounts in a strict sequence you choose (CBIR, RIBC, or BIRC). Any
year your guaranteed income and required withdrawals come to more than you spend, the leftover has to be
banked somewhere. Until now it always went to Cash, regardless of the sequence. For the two sequences
that draw Cash last (RIBC and BIRC), that stranded the surplus in the one account the strategy would not
touch again until everything else was gone: it earned the cash yield instead of the market return, and
it was not spent until far too late.

Now the fill follows the same order as the draw. The surplus is banked in the first account your
sequence would draw that can actually receive a deposit, which is Cash or Brokerage. Roth and the IRA
are contribution-limited and cannot take an arbitrary after-tax deposit, so they are never fill targets.
That resolves to:

- **CBIR** (Cash first): Cash, exactly as before. No change to any CBIR plan.
- **RIBC** (Roth, IRA, Brokerage, Cash): Brokerage, because Brokerage is drawn before Cash.
- **BIRC** (Brokerage, IRA, Roth, Cash): Brokerage, because Brokerage is drawn first.

An explicit Cash Reserve target, or Cycle Brokerage, still takes precedence over this rule where set.

Effect: RIBC and BIRC plans that ran a surplus now end with more wealth, because the banked money grows
at the investment return rather than the cash yield and is drawn back sooner. On one 30-year test the
gain was roughly 4% of ending wealth for RIBC and 7% for BIRC. CBIR plans are byte-for-byte unchanged, as
are all other strategies. The withdrawal sequence itself was already correct: it restarts from the top
every year and uses whatever balances exist that year, so a refilled account is drawn again in its
proper position.

---

<a id="11.14c6"></a>

## 11.14c6

**The suggested spending goal** (the figure behind the ⓘ next to the spending goal) is now
solved by the plan itself, and considers how long the retirement is, and when any pension 
is planned to start.

The old suggestion used 5% of every account, plus Social Security and pension,
taxed once. It ignored the length of the plan entirely, so a 12-year retirement and a 40-year
retirement got the same 5%. That is contrary to what the withdrawal-rate research suggests. 
A shorter horizon can support a meaningfully higher rate; a longer one needs a
lower one.

The suggestion now runs your current strategy at many spending levels and reports the highest one that
still leaves a cushion in the portfolio at the end. "Cushion" means the last modeled year still
holds at least five years of the spending the portfolio
must cover after Social Security and pension. Because it runs the real engine rather than a
formula, taxes, required minimum distributions, and the timing of a deferred pension or an
unclaimed Social Security benefit are all handled correctly - the previous method did not.

A closed-form amortization of the invested portfolio (using your own growth and inflation
assumptions) seeds the search, and the tooltip reports the result as a percentage of that naive
amortization so you can see how much the taxes and the end-of-plan cushion shaved off.

What to expect: the calculation will vary with the withdrawal strategy, and may differ from what the 
Optimizer calculates under "Maximize Spend".  Do remember that the proposed spend is a THEORETICAL, not 
a "best" option - and does not properly account for Sequence of Returns Risk (SoRR). 
Anything suggested should be vetted first against the Monte Carlo (especially the stress test) 
analysis, and ultimately scrutinized by a CFP (Certified Financial Planner).

More thorough proposed spend goals are being considered for the future.

---

<a id="11.1499"></a>

## 11.1499 (behavior change)

When someone dies, the cost basis of a taxable brokerage account resets to what the account is
worth that day. The gain that built up during their lifetime is never taxed, to them or to their
heirs. The tool was ignoring this in two separate places:

1. **At the first spouse's death.** The survivor's cost basis carried straight on as if nothing had
   happened, so every later sale from that account realized more gain than it really would, and
   paid tax on it.
2. **At the end of the plan.** The final year valued whatever brokerage was left over as if it had
   been sold and the capital-gains tax paid. It is not sold, it is inherited, and that tax is never
   owed.

Both are now modeled. The size of the first basis adjustment depends on where you live - the underlying
property law of the state dictates what happens. In a community-property state the whole account resets; everywhere else only the
share that belonged to the person who died, which the tool treats as half. This follows the State Tax selection, because it is a matter of law
rather than preference. The seven community-property states this tool models are AZ, CA, ID, NV,
TX, WA and WI. Louisiana and New Mexico are community-property states too, but they are not among
the 38 jurisdictions the tool models at all, so they cannot be selected. Alaska is deliberately
treated as common law, because community property there is something spouses have to opt into by
written agreement.

**What to expect.** Ending balances rise, lifetime tax falls, and the spending goal is funded in
exactly the same years as before. The demonstration plan the tool opens with goes from $625,885 to
$637,024 and pays $10,513 less tax over its life, with spending identical to the dollar. That plan
happens to spend its brokerage account down to nothing, so all of its gain comes from the first
death; a plan that still holds a large taxable account at the end can gain considerably more. One
test plan holding $900,000 of brokerage gained $398,712 in the final year alone.

**Why this matters for Roth conversions.** The error only ever ran one way. It penalized money
kept in a taxable brokerage account and left Roth and cash untouched, so every comparison between
converting and not converting was tilted toward converting. Correcting it makes conversions look
worse than they used to, and some plans that previously reported a conversion benefit no longer
report one. In one test case the conversion advantage reported was worth less than what was gained 
by the step-up in basis. 

**Break Even is deliberately unchanged.** It still measures the year conversions pull permanently
ahead, valued as though the account were sold rather than inherited. Break Even during your
lifetime and break-even measured against what your heirs receive are different questions, and the
second one is being left for its own release rather than folded in silently here. Break-even years
reported today are the same ones reported before this change, on the same basis.

**On the chart.** Every death now carries a marker, and the marker carries a small circle showing
which step-up applied: half filled for a half step-up, solid for a full one. A legend under the
chart says which is which, and it only describes the marks your plan actually has. A half step-up
cannot happen in a community-property state, or to a single person whose estate goes straight to
their heirs, so those plans get the solid circle explained and nothing about halves. The last
death is marked which is where the final step-up happens.

Also in this release: a brokerage cost basis larger than the brokerage account value is now corrected rather than
carried. A market decline can cause a declining basis - as would be observed in Monte Carlo Stress Cases. 
Ordinary projection will not see a basis decline due to declining account value unless you put a 
[negative growth rate in place purposely](https://tools.netcitizen.us/retirement_optimizer.html?str=ordered&os=RIBC&bb=90k&g=-1.0). 
The place you would observe the declining basis is in the "Annual Details" -> "Brokerage" column "Basis".

---

<a id="11.147c"></a>

## 11.147c

**Self-tests improved.** No change to your plan or its numbers. The self-check that runs at page
load now covers 510 tests instead of 245; hover over the indicator for the count. A brief hourglass
before the green dot is normal.

---

<a id="11.1478"></a>

## 11.1478 (behavior change)

**Four tax and accounting corrections. The big one: dividends and interest were counted twice, so
plans have been showing more money than they should. Ending balances go down. Please read this even
if you skip the rest.**

### 1. Dividends and interest were credited twice

When your brokerage paid a dividend, or your cash earned interest, the same dollar was doing two
jobs. It was added to your balance, which is right. It was also treated as income available to
spend, so the tool withdrew that much less from your accounts to cover your spending. The dollar
bought your groceries and stayed in your account. Nothing ever took it back out.

The longer the plan and the higher the rates, the more money this invented. A cash account earning
4% grew at closer to 8%. In one test a plan spent $800,000 over twenty years while taking only
$2,449 out of the cash account. That money tree - unfortunately - does not exist so the modeling now matches reality.

You can check the old behavior yourself. Take a portfolio returning 8% a year. Have it earn that as
[8% growth with no dividend](https://tools.netcitizen.us/retirement_optimizer.html?str=ordered&os=RIBC&bb=90k&dr=1&g=8&div=0), then again as [6% growth plus a 2% dividend](https://tools.netcitizen.us/retirement_optimizer.html?str=ordered&os=RIBC&bb=90k&dr=1&g=6&div=2) that is automatically
reinvested. Same total return, same reinvestment, but the dividend version pays tax every year that
the growth version does not, so it must end up **behind**. After the fix, the 6%+2% example lands at $1,231,249 vs $1,250,627 net wealth (current dollars) for the 8% DRIP.
Dividends and interest are still income, still taxed exactly as before, and still land in your
account. The withdrawal strategy decides whether a dividend is spent or banked, and how the tax on it is paid (e.g. you can earn interest and pay the tax on that interest from an IRA, or from cash).

**Expect ending balances to fall, typically between 4% and 23%** on a plan using the default 3% cash
yield and 0.5% dividend rate. Your spending goal is still funded in the same years it was before.
Tax goes up slightly, because the invented money had been quietly absorbing some of it. A
Guyton-Klinger plan can also shift its spending path, since that strategy sets spending from what was an overstated - now correct - portfolio balance.

A plan that looked like it worked may now need a lower spending goal, a later start, or a different strategy.

### 2. Two 2025 tax-law provisions were implemented but never switched on

The senior deduction and the higher SALT cap from the 2025 tax act were both built into the tax
engine and then never actually applied to any plan. The result was federal tax that was too **high**.

The **senior deduction** is an extra $6,000 for each filer aged 65 or over, for tax years 2025
through 2028, phasing out above $150,000 of income for a couple. On a plan with two filers over 65
this is $12,000 a year of additional deduction. Both provisions now switch themselves off in the
year the law says they expire.

The **SALT cap** rise, to $40,000 through 2029, only matters if your state and local taxes are large
enough to make itemizing worthwhile, which for most retirees they are not. It is worth up to about
$950, in a narrow band of high income in a high-tax state, and nothing outside it.

### 3. States that exempt retirement income were taxing it anyway, in some years

16 of the 38 states the tool models exempt some or all of your pension and IRA income: Connecticut,
Georgia, Illinois, Mississippi, Iowa, Maryland, Michigan, New York, Pennsylvania, Virginia, Alabama,
Colorado, Kentucky, Maine, Ohio and Wisconsin. The tool works your tax out up to four times in a
year as it settles the final withdrawal amounts, and one of those passes was not being told which
part of your income was retirement income. Any year that reached that pass was taxed as though your
state had no exemption at all.

**Ordered** strategies took the worst of it, because for other strategies a later pass works the tax
out again correctly and hid the problem. Ordered strategies do not run that later pass, so the
faulty figure was the final answer. Across a 16-state test sweep the correction removed **$732,133**
of state tax that was never owed, **$685,487** of it on Ordered rows, and **23 of 36 Ordered plans
went from reporting failure to funding the whole plan**. On one Pennsylvania test plan whose only
income was Social Security, a pension and IRA withdrawals, all three of which Pennsylvania exempts,
lifetime state tax fell from **$28,055 to $9**. Plans in the other 22 states are unchanged.

### 4. Documentation that no longer matched the tool

The funding backstop was still described as a Fill Bracket / IRMAA feature. It has not been one
since 11.146a: once Cash, Brokerage and Roth are exhausted, nearly every strategy now draws the
extra IRA needed. What is specific to those two ceilings is that their draw goes *above* the
ceiling, which is what makes them soft.

**Ordered's exclusion was documented nowhere.** Like ACA Cliff, it reports a shortfall by design,
because the account sequence is the one you picked and it will not step outside it. A small
remaining shortfall on a CBIR, RIBC or BIRC row is the answer, not a bug. That is now said in the
README, in the strategy description, on the Annual Details legend and in the shortfall column
tooltip. The shortfall tooltip also used to say a shortfall was "likely due to errors in the
calculation", which was backwards.

One of the Ordered strategies was leaving a small amount of spending unfunded in two years; the
amounts moved and now sit between $10 and $161 across three years on the test plan. These are
rounding-scale residuals from the order in which tax is recomputed, not stranded capital.

---

<a id="11.146a"></a>

## 11.146a (behavior change)

**Proportional, Reduce, Guyton-Klinger and the default strategy were sizing withdrawals as if Social
Security, pensions and RMDs arrived tax free. They now work the withdrawal out correctly, and they
draw the IRA needed to cover the whole spending goal, so plans that used to report a shortfall next
to a large IRA are funded.**

**What was wrong.** These strategies worked out the withdrawal by subtracting your guaranteed income
from your spending goal, using the full **pre-tax** value of that income. The tax owed on the Social
Security, pension and RMD money was never included, so every year came up short by roughly the
amount of that tax bill. While there was money in Cash or Brokerage the gap was quietly covered and
nothing looked wrong. Once those accounts ran dry the gap had nowhere to go, and the plan reported
unfunded spending while the IRA still held a large balance.

**What changed, part one: the plan can reach the money.** When Cash, Brokerage and Roth are
exhausted and spending is still unfunded, these strategies now draw the additional IRA needed, the
same backstop Fill Bracket and IRMAA Tier have always had. The amount appears in the `ForcedIRA`
column.

**What changed, part two: the first withdrawal is the right size.** Part one fixed the symptom, but
the reason the plan came up short every year was still there. The first withdrawal is now sized
against what your guaranteed income is actually worth **after** tax. That tax is computed, not
estimated with a single rate, because your guaranteed income is not taxed at one rate: Social
Security is between 0% and 85% taxable depending on your other income, qualified dividends have
their own 0/15/20% schedule, and pensions and required distributions are ordinary income. Applying
one blended rate to the whole amount overstated the tax by several times on a Social
Security heavy household and drew far too much.

**What this does to your numbers.** A plan that reported a shortfall in one or more years may now succeed.

**Which strategies change.** Proportional, Reduce, Guyton-Klinger, the default strategy, an ACA
Cliff plan after its cap ends at Medicare, and the Cyclic Brokerage option. Fill Bracket, IRMAA Tier,
IRA Draw % and Ordered set their withdrawal by their own rule, so they produce identical results to
before.

**ACA Cliff is deliberately excluded, and that is not an oversight.** While the cap is in force it
will still report a shortfall rather than draw more from an IRA. An IRA withdrawal is taxable income,
and going a single dollar over the cap forfeits the entire premium subsidy, so drawing more would
cost far more than the spending it funds. A shortfall on ACA Cliff means the spending goal could not
be met from non-taxable sources, which is the answer that strategy exists to give. Once the cap ends
at Medicare there is no subsidy left to protect, and from that year the plan is funded like any
other. On a plan whose cap runs to age 65, that shows up as seven capped years that still report a
shortfall, followed by twenty-one funded years.

**Also.** A plan that genuinely runs out of money still reports a shortfall. The change only affects
spending that could have been funded from an IRA that was sitting there.

---

<a id="11.1464"></a>

## 11.1464 (behavior change)

**The ACA Cliff strategies are now available to everyone, the income cap ends when Medicare begins
instead of being enforced for the rest of your life, and the warnings tell you which year they are
talking about.**

Only plans using an ACA Cliff strategy change their numbers. Everything else is about what you can
see and select.  As for what "Spend Goal" you should enter: enter your AFTER ACA spend goal. While ACA limits are in 
place, your spending is capped to meet them. If you have lots of cash or Roth, or a high basis Brokerage,
you may be able to meet your spend goals in the first years of ACA by consuming those resources.

**1. The cap now ends at Medicare.** ACA premium subsidies stop being available once you are
eligible for Medicare. The tool was not checking ages at all: pick an ACA Cliff strategy and it held
your income under the Federal Poverty Level multiple you chose at 65, at 80, at 95, protecting a
subsidy that had ended decades earlier. On a plan that opens after 65 the cap was being enforced for
every single year.

From the first year in which **every living person in the plan** is old enough for Medicare, the cap
is dropped and the strategy behaves as **Proportional 0%**, drawing across your accounts to fund
your spending goal. Two details worth knowing:

+ It is **every living person**, not every person. If one spouse dies before reaching Medicare age
  and the survivor is already past it, the cap ends that year. Those survivor years are exactly where
  a single filer's narrower tax brackets used to strand spending under a cap that was protecting
  nothing.
+ Until then the cap is measured against **household** income. If one spouse is already on Medicare
  and the other is not, the older spouse's required distributions and Social Security still count
  against the younger spouse's limit. The warning under the strategy selector now says this; it
  previously claimed the limits applied only to the younger person.

On a couple aged 66 and 67 at the start with a $2.1M IRA and a $160,000 spending goal, the ACA 400%
arm changes like this:

| | before | now |
|---|---|---|
| years the cap blocked spending | 24 of 24 | 0 |
| spending left unfunded | $735,010 | $304,331 |
| total spending funded | $3,832,599 | $4,263,278 |
| ending net worth | $1,888,543 | $684,010 |

Ending net worth **falls**, and that is the point rather than a side effect. The old behavior looked
wealthier only because it refused to fund the spending goal and left the money in the IRA.

**2. ACA Cliffs: the four Federal Poverty Level ceilings
(200/250/300/400%) now appear for everyone**.  The Optimizer sweeps those rows
for everyone. The tool models the income cap and **none** of the premium subsidy
that cap buys, so an ACA row shows you what staying under the limit costs and not what it saves. Read
one as a constraint study, never as a recommendation. The options disappear once both people
are on Medicare at the start of the plan.

**3. On Optimizer rows a ⚠️ indicates that the spend goal is infeasible.**
If one ACA row is flagged every lower one is flagged too.

**4. The Medicare warning now names the year and your ages in it.** It used to say only that you
would be on Medicare "at retirement start", while the age shown next to your birth year is your age
**today**. If your plan starts years from now those are two different numbers, and being told you are
on Medicare while the field beside it reads "Age 59" looked like the tool had stopped paying
attention. It now reads, for example, "At retirement start in 2031, you will be 65 and your spouse
79", and tells you that lowering **Retirement Start Age** is what brings the ACA years back.

---

<a id="11.1447"></a>

## 11.1447 (behavior change)

**Roth conversion strategies now work in states with no income tax and in states with a single flat
rate.**

If your state is one of the 21 the tool models with a single tax rate, the strategies that fill a tax
bracket were converting almost nothing, however you set them. Those states are Alaska, Arizona,
Colorado, Florida, Georgia, Illinois, Indiana, Iowa, Kentucky, Massachusetts, Michigan, Nebraska,
Nevada, New Hampshire, North Carolina, Pennsylvania, South Dakota, Tennessee, Texas, Washington and
Wyoming.

The cause: a bracket strategy takes the tighter of the federal limit and your state's limit. To find
the state limit the tool looks up which bracket your income falls in, and a state with one flat rate
has no bracket boundary to find. It read that as "there is no room at all" rather than "this state
imposes no limit", and because it then took the tighter of the two, the missing state limit wiped out
the federal limit as well.

Measured on a single filer with a $600,000 IRA and a $60,000 spending goal, Fill Bracket at 22%:

| state | converted before | converted now |
|---|---|---|
| Nevada, Texas, Florida | $465 | $163,686 |
| Illinois | $6,740 | $163,686 |
| Pennsylvania | $4,047 | $163,686 |
| Arizona | $775 | $151,101 |
| California, New York | $131,832 / $141,348 | unchanged |

Two further problems came from the same cause:

- **Spending was reported wrongly in those 21 states.** For any strategy that is not bracket based,
  the plan's yearly spending target was set to zero. The Summary then reported the plan as successful
  while it funded no spending at all, and total spending could come out negative. 
- **"Below IRMAA" converted little or nothing in every state, not just those 21.** That strategy
  stops at the first IRMAA surcharge tier, and the same missing boundary applied whenever your
  spending goal sat below that tier, which is most plans. The same single filer above now converts
  $13,698 in California and $163,686 in Nevada, against $0 and $465 before.

**What this means for a saved plan.** If your state is one of the 21, or if you use the "Below IRMAA" bracket,  
your saved scenarios and shared links will produce different numbers than before. In every
case measured the new numbers are the correct ones and the old ones understated what the strategy
would do. The 17 states the tool models with graduated brackets are unaffected for every strategy
except *Below IRMAA*, and that was verified state by state rather than assumed.

---

<a id="11.13d0"></a>

## 11.13d0

**A link labeled with a file name now shows the page it actually opens.**

The previous release pointed the Change Log's "Details" links, and the link to the full change log
itself, at the formatted page the site publishes. It changed where those links went but not what they
said, so the Documentation tab read "optimizer_changelog.md" while the link underneath opened
`optimizer_changelog.html`. Naming one file and opening another is confusing in both directions: it
looks like the fix never shipped, and anyone who copied the visible name got a file that downloads
instead of displaying.

The label now follows the link. This applies only where the visible text *is* the file name.
Descriptive wording, "Details" or the theme's "Improve this page", is never rewritten, and neither is
the name README.md, which is still the honest name of what sits at the site root.

Nothing changes when you run the tool from your own disk or your own local web server. There the
formatted pages do not exist, so both the link and its label stay on the plain file, which is what is
really there.

---

<a id="11.13c5"></a>

## 11.13c5

**The "Details" links in the Change Log now open a properly formatted page instead of downloading a text file.**

Every release write-up lives in a Markdown file, and clicking through to one used to hand your
browser a raw `.md` file. Most browsers download that rather than displaying it, and a link to a
particular release inside it did nothing at all. So the links went to a file you had to open by hand,
in whatever program claims `.md` on your computer.

The site already publishes a formatted version of each of those files; the links just were not
pointing at it. They are now, and the link to a specific release lands on that release. Running the
tool from your own disk or your own local web server still opens the plain file, because the
formatted version only exists on the live site.

Two side fixes came with it. The three links on the front page to the planning notes, under "What is
coming next", were broken and now go to where those notes can actually be read. And the architecture
document's diagrams, which were showing as a wall of text, are now labeled as diagram source with a
link to a page that draws them.

---

<a id="11.13c3"></a>

## 11.13c3

**The Tax Payment Planner now receives your brokerage position, so it stops guessing at it.**

Clicking a year in Annual Details of the Retirement Optimizer opens the Tax Payment Planner with that year's figures. Three of
them were never being sent, and the planner quietly fell back to its own built-in assumptions
instead:

- **Brokerage value and cost basis.** The planner uses the unrealized-gain share of your brokerage
  account to price the option of raising the tax money by selling shares. With nothing handed over
  it assumed 40% of the account was gain, no matter what basis you had entered here. On the default
  scenario the real figure is 60.4%, which nearly doubles the capital-gains cost of that option.
- **The blended long-term capital gains rate**, federal plus state, which had been fixed at 20%.
- **The high-income flag.** Above $150,000 of prior-year income the estimated-tax safe harbor rises
  from 100% to 110% of the prior year's tax. The planner had no way to know, so it always used 100%.

Nothing the Optimizer computes changes; this only affects what the Tax Payment Planner is told when
you open it. On the planner side, the single "Brokerage Appreciation (%)" field has been replaced by
**Brokerage Value ($)** and **Brokerage Basis ($)**, with the gain share shown as a computed
readout. That field held a fraction of account value, not a growth rate, but it sat among four
genuine rates and was widely read as one. Shared links using the old field still work.

---

<a id="11.13bd"></a>

## 11.13bd

**Two controls are now available to everyone: "Stop conversions after (year or age)" in the sidebar and "Fed Tax Creep %/yr" in Assumptions.**

Neither does anything until you fill it in, so no existing
plan, saved scenario or shared link produces a different number because of this release.

**Stop conversions after (year or age)** sits just under Extra Annual Roth Conversion. Enter a
calendar year (2031) or your age (71) and that is the last year conversions run; they cease the year
after. Blank means convert for the whole plan, which is what the tool has always done. The dropdown
beside it chooses the scope: "all conversions" stops your strategy's own bracket filling as well as
the Extra Annual Roth Conversion, while "extra only" stops the extra conversion and lets the strategy
keep filling brackets.

This is the field the Break Even ⓘ has been filling in all along. When the diagnostic finds a year
worth stopping at, it offers a "Stop after YYYY" link, and clicking it writes the year here and
re-runs. Converting past the point where the tax paid stops earning its keep can leave you worse off
than never converting at all, so the year that maximizes after-tax wealth is worth knowing.

**Fed Tax Creep %/yr**, with **Creep Starts** beside it, sits in Assumptions under the growth row. It
multiplies the federal ordinary-income bracket rates by a little more each year from the start year
onward, so a 1% creep turns a 22% bracket into a 26.8% bracket in 20 years. Bracket thresholds still
track CPI as before, and state tax, capital gains, the NIIT surtax and IRMAA are unaffected. Why is tax creep here at all? 
Many think a higher-tax future is likely, so this is a simple way to model increasing taxes. We are not forecasting that 
tax rate increases will come - after all, tax law changes at the speed of Congress and that's to say... slowly. 
Leave tax creep % at 0 to keep today's rates for the whole plan.  There is no model for State tax increases, and no plan to 
add them, so if you think your state taxes will be creeping up, you can make the creep rate a little higher to compensate.

---

<a id="11.13a1"></a>

## 11.13a1 (behavior change)

**Social Security is now counted from your birth month, both when you claim it and when a spouse dies.**

Until now the tool treated benefits as an all-or-nothing yearly amount. Someone claiming at 70
collected a full twelve months in the year they turned 70, whichever month their birthday fell in.

The claim year is now paid from the birth month onward: a June birthday collects six months, a
January birthday eleven. The birth month defaults to December, which means no benefit at all in the
claim year and one more year before the money starts. If that is not your birthday, set it under
Profile. It was already used for the age 70 and a half rule on charitable distributions, and it now
matters for Social Security too.

The year a spouse dies works the same way, with the death treated as falling in the deceased
spouse's birth month. The months before it pay both spouses' own benefits, because both were
genuinely collecting; the months after pay the survivor benefit. Previously that whole year paid only
the survivor benefit, which understated it, since the survivor benefit is the higher of the two
benefits and never their sum.

This moves the numbers in almost every plan, and not by a fixed amount. Less income early on changes
how much room a Roth conversion has, how much has to come out of the portfolio, and how much of your
benefit is taxable, and the Medicare surcharge look-back brings the difference back two years later.

**Survivor benefits now use the deceased spouse's real Full Retirement Age instead of assuming 67 for everyone.**

Full Retirement Age is 66 for anyone born between 1943 and 1954, rises two months per birth year
through 1959, and reaches 67 only for those born in 1960 or later. The tool assumed 67 for everybody.
Because a survivor benefit is worked back from what the deceased was collecting, that assumption made
an early claim look like a bigger reduction than it was, and paid the survivor more than they are
actually due.

On a couple born in 1950 and 1952 where the higher earner claimed at 62, the survivor benefit drops
from about $51,076 to $49,148 in its first year. Plans where both people were born in 1960 or later
are unchanged to the dollar, and so is any plan where both spouses claim at or after their Full
Retirement Age, because a late claimer's survivor baseline is their actual benefit rather than a
figure derived from it.

**The chart marks when Social Security actually starts.**

New markers show the first year each person receives a benefit, and the year a survivor benefit
begins. With a December birth month that marker sits on the year after the claiming age, which is
when the money genuinely arrives. Someone already collecting when the plan starts gets no marker,
since the tool cannot tell that apart from a benefit beginning in the first year.

**The Monte Carlo tab no longer shows you the previous plan without saying so.**

Changing a setting while the Monte Carlo tab was open used to leave every chart, the survival table
and the stress test quietly describing the plan you had before the change, until you clicked away to
another tab and back.

The stress test now re-runs by itself, because it is only about ten simulations. The main chart and
survival table are a different matter: they are hundreds of simulations across every strategy, which
takes long enough that recomputing them on every edit would leave you waiting. Those are marked "Out
of date" with a Re-run button instead.

**A Stress Test result now appears in the summary bar at the top of every tab.**

It reads, for example, "7 of 10 fail", meaning your plan runs out of money in 7 of the 10 harshest
return periods in the historical record. It is colored green, amber or red on the same scale as the
Monte Carlo survival table, and the tooltip names the median year the money runs out.

These sequences are deliberately the worst on record, so this is a durability test and not a
forecast: failing some of them does not mean the plan is likely to fail. Because the stress pass is
cheap, this number recomputes whenever you change an input, which makes it the one Monte Carlo figure
that is always current. On the Monte Carlo tab the stress test now appears first, above the
percentile chart, with a headline count and a fold-away control for readers who only want the main
projection. In Synthetic mode there is no historical record to stress against, so the tile reads a
dash.

**The stress test is always available, and the Optimizer says when it is working.**

The stress test used to be skipped entirely in Synthetic mode. It never needed the main projection
to be Historical: it builds its own set of worst-case sequences from the real record, so it now runs
in both modes. Choosing synthetic returns for the projection is not a reason to hide the question of
whether the plan would have survived the worst of what actually happened.

The Optimizer blocks the page for a second or more while it tests every strategy, which looked like
a freeze with the previous run still on screen. It now shows a "Calculating strategies" banner
first. The comparison feature also gained a permanent one-line explanation above the table, and the
button to end a comparison now says so plainly.

**Any two strategies in the Optimizer table can now be compared directly against each other.**

The two Δ columns have always measured every strategy against the anchor ⚓ baseline, which answers
"is this better than doing nothing clever" but not "is this better than that one". Every row now
carries a ⚖ button. Click it and both Δ columns are re-measured against that row, so the numbers
beside every other strategy tell you directly how it compares with the one you picked.

The chosen row reads zero by definition, a note above the table names what the columns are measured
against, and the column headings gain "vs ⚖" so the change in meaning is never silent. Click the same
⚖ again, or use the button in that note, to go back to the baseline. The choice survives a re-run:
change a setting and the tool re-finds the same strategy in the new results rather than losing your
place. If a change removes that strategy from the table entirely, the comparison reverts to the
baseline. Clicking ⚖ does not load the strategy into the sidebar; clicking anywhere else on the row
still does.

Your current plan is now marked (📍) in exactly one place when there is nothing else to say. If another 📍 
appears it indicates a slightly DIFFERENT variation from your plan.

The pinned rows read ⚓ BASELINE and 📍 CURRENT, marker first in all cases, and a row that wins a
metric in the Best table keeps its marker there too, so it is recognisable as the same row without
repeating the words.

The ⚖ control has its own column at the start of each row, and the outcome marker beside it is part
of the same control, with a gap separating both from the rest of the row. The highlighted ⚖ always marks
whichever row the columns are currently measured against, which is the ⚓ baseline until you pick
something else, so the table shows where the comparison point is from the moment it opens. Clicking
the highlighted one puts everything back, exactly like the Stop comparing button.

---

<a id="11.1387"></a>

## 11.1387 (behavior change)

**Your own plan now appears in the Optimizer table, so you can compare it against every strategy it suggests.**

A pinned 📍 CURRENT row sits under the ⚓ baseline showing your sidebar settings run exactly as they are, including whether conversions are on, any Extra Annual Roth Conversion, and any stop year. That matters because every strategy the Optimizer sweeps is run with conversions turned on and your own conversion settings set aside, so until now nothing in the table was actually your plan, even when the strategy and its parameter matched. Your plan is also ranked with the others, so the Rank column tells you where it stands, and it can win a metric in the Best table if it genuinely beats everything else. The same 📍 marks the swept row that uses your strategy and parameter, which lets you see where your setting sits on that family's curve. If your parameter falls between the standard steps, for example a 7% proportional boost or an 18 year drawdown, that exact value is now swept as its own row instead of being skipped. The Break Even column is filled in for every strategy now, not just the ⇌ conversion rows, so sorting by it works and there is a new "⏱ Earliest Break Even" entry in the Best table: the strategy whose conversions pay for themselves soonest, with ties going to the one that leaves more after-tax wealth. Choosing "Earliest Break Even" under Optimize for now reorders the table, which it previously could not do because the column had no values to sort. Three fixes came out of the same work. Clicking an Ordered row now brings its account sequence with it instead of leaving whatever was in the sidebar. The Monte Carlo stress test now recognizes Guyton-Klinger and Ordered plans as your current strategy rather than falling back to a generic one. And the summary numbers at the top of the page, including Break Even, now refresh when you change a setting while the Optimizer tab is open: they used to keep showing the previous plan until you clicked over to Chart or Annual Details, which is what made a change like turning Maximize Conversions on look like it had no effect.

---

<a id="11.137f"></a>

## 11.137f (behavior change)

**The suggested year to stop converting is now measured against the plan you would actually get.**

The tool decides whether to take money out of your accounts in January or in December based on whether that year makes a Roth conversion, because a conversion year is better done early. When the Break Even ⓘ searched for the best year to stop converting, it built each trial plan in a way that failed to set that switch, so every year it compared was run with December withdrawals even where conversions were happening. It also treated "convert nothing" as a January-withdrawal year, which no plan with no conversions would ever be. The result was a suggested stop year and dollar gain measured against plans that were not quite the ones you could load, and the two "stop scope" choices could report different gains for the very same cutoff. On a large-IRA example the gain compared with never converting was overstated by about $8,900, and the two scopes disagreed by about $2,200 on a cutoff where they should have matched. All of that now lines up: click the suggested year and the plan you get is the plan that was scored. A stop year set at or before the first year of the plan is also now correctly treated as converting nothing. Plans with no stop year, including the whole strategy table, Monte Carlo and Annual Details, are unchanged to the dollar.

---

<a id="11.1370"></a>

## 11.1370 (behavior change)

**When converting more does not help, the Optimizer now tells you what would have to be true for it to help, and it can find conversions it used to miss.**

Optimize Conversions previously reported only that none of the strategies it examined improved by converting more, which is accurate but a dead end. It now names the future tax rate your plan is assuming, and a link works out the lowest future tax rate at which converting would start to pay, along with the amount and the gain at that rate. If no plausible rate makes conversions worthwhile, it says so plainly, because that is a real answer about your plan rather than a missing one. Separately, the search itself was too narrow: it only ever tested converting the same amount every year for the rest of the plan, so a plan that should convert heavily for a few years and then stop could only be told to convert nothing. When a flat conversion does not help, the Optimizer now also tries converting for a limited number of years, and any plan it finds this way appears as a ⇌ row tagged with the year conversions stop (⏹). Clicking it fills in both the amount and the stop year. This changes which conversion rows appear and the amounts they suggest. Two columns also changed: the Avg BETR column and its summary-bar tile were removed, because testing showed the Break-Even Tax Rate is not reliable enough to decide anything (it is still available per year in Annual Details), and "Conv Savings" is now called "Tax Paid Δ", since it only counts tax paid during the plan and can look positive on a plan that ends up worse off. Break Even remains the column to trust.

---

<a id="11.1340"></a>

## 11.1340 (behavior change)

**Cash Reserve now controls what happens to money you withdraw beyond your spending needs.**

Most retirees with a large IRA are forced to take out more than they spend once required distributions begin. Until now the tool left all of that surplus sitting in cash, earning only the cash yield, for the rest of the plan. That understated how well a plan does when those extra dollars are reinvested, and it quietly tilted the Roth conversion comparison in favor of converting. The Cash Reserve field now decides where the surplus goes. Leave it blank (or enter -1) to keep the original behavior: all surplus stays in cash. Enter 0 to reinvest every surplus dollar into your Brokerage account, where it grows at the market rate. Enter a dollar amount to keep that much as a cash cushion, in today's dollars, and reinvest only the surplus above it; spending will not draw the cushion down unless every other account is exhausted. If you load a saved plan or a shared link that already sets a Cash Reserve, a note reminds you that results now differ from older versions and that blank or -1 restores the old behavior. This one setting can meaningfully change Break Even, the suggested year to stop converting, and the final balances, so it is worth trying both ways.

---

<a id="11.1330"></a>

## 11.1330

**The Break Even note now tells you the best year to stop converting, and offers one click to do it.**

When your plan makes Roth conversions, the ⓘ next to Break Even now names the year that leaves you with the most after-tax wealth if you stop converting after it, along with how much more that keeps than converting all the way through, and how much more than never converting at all. This replaces the older note, which pointed at the year conversions first turned unprofitable; that year is usually not the best place to stop, because it ignores how much a plan can still gain by stopping earlier. The point is that converting past a certain year can leave you worse off than never converting, since the tax paid on a late conversion no longer earns its keep before the plan ends. Click the suggested year to fill in a new "Stop conversions after" control and re-run: enter a calendar year like 2031, or your own age like 71, and conversions run through that point and then stop. You can choose whether stopping applies to all conversions or only the Extra Annual Roth Conversion; stopping all of them is the stronger lever. Spending is unchanged by where you stop, so this is a pure comparison of what your heirs receive after tax.

---

<a id="11.12fd"></a>

## 11.12fd

**The charts now mark the year each person's RMDs begin.**

Two new dashed lines, "Your RMDs begin" and "Spouse RMDs begin", join the existing markers on both charts, and because the date depends only on a birth year they also appear on the Monte Carlo chart. The line is drawn for the year you reach your RMD age (73 or 75, depending on when you were born), and only when that birthday falls inside the plan, so a plan that starts after your RMDs have already begun does not get a line. It is drawn whether or not there is anything left in the IRA to withdraw, since the date itself is worth seeing. The "Show milestones" tooltip now lists every marker the charts can draw, which it had stopped doing some versions ago.

---

<a id="11.12fb"></a>

## 11.12fb

**The Withdrawal Rate stat was reading far too low and has been corrected.**

It now measures what it says: the money actually pulled out of your accounts to pay for spending and taxes, divided by what the portfolio was worth at the start of that year. Three things were wrong before. Social Security and pension income were being subtracted from the withdrawals, so a plan drawing $164,000 against $81,000 of Social Security was reported as if it had withdrawn only $19,000. The bottom of the fraction used an after-tax estimate of your wealth rather than the actual account balances, and the very first year used a different basis than every year after it. On a typical plan the stat moves from about 1.1% to about 2.4%, which is now directly comparable to the classic 4% rule and to the guardrail rate the Guyton-Klinger strategy uses internally. The tile is relabeled simply "Withdrawal Rate", and hovering over it shows two extra views: a dollar-weighted average, and a net depletion figure that goes negative when your portfolio is growing faster than you draw it down. The rate itself can no longer go negative, because you cannot withdraw less than nothing. A related fix: in years when Social Security covers everything, a required distribution that gets reinvested is no longer counted as a withdrawal, since those dollars never left the portfolio. Also in the header, the summary stats are left-aligned on wide screens instead of being pushed to the right edge, and the "what you last changed" note moved to sit after the numbers alongside the save and load messages.

---

<a id="11.12f7"></a>

## 11.12f7

**New "Optimize for" choice at the top of the Optimizer ranks every strategy by the goal you care about.**

Pick a goal and the table sorts to put the best plan for it on top, moves the baseline to match, and renumbers the Rank column. It changes only which plan the tool puts in front of you, never the underlying numbers, and clicking any column header still sorts by that column. The choices, in the order most people asked for them: Tax Flexibility (the default, which favors plans that end with your money spread evenly across pre-tax, Roth, and taxable accounts so you can draw from whichever is cheapest in any given year, compared only among the plans that also finish among the wealthiest); Maximum Net Wealth; Avoiding Widow and RMD Tax (favors plans that leave less in the pre-tax IRA, since that is what drives forced withdrawals and the higher single-filer tax a survivor pays); Minimum Lifetime Taxes; plus Maximum Spending, Maximum Roth, and a Balanced blend. The Documentation tab explains what each one measures, including why Minimum Lifetime Taxes and Avoiding Widow and RMD Tax can legitimately disagree. A few smaller fixes came along with it: the "Best" summary no longer lists a strategy that cannot actually be run; Annual Details shows the Roth Conversion column when you turn on the Opp. Cost view; when a spouse is already on Medicare, all of the ACA income-limit rows are marked not applicable rather than just one; and the Score column was dropped since the row order and the Rank column already show the ranking.

---

<a id="11.12e5"></a>

## 11.12e5

**Optimize Conversions now looks at the best plan from each family of strategies, not just the five with the highest ending wealth.**

The strategies that benefit most from converting are often not the ones that finish with the most money, so the old five-highest list could be filled entirely by strategies that gain nothing from converting, leaving the ⇌ table empty even when other strategies had a real conversion to recommend. It now considers the best Proportional, Reduce, Fill Bracket, IRMAA Ceiling, IRA Draw, Ordered, and Guyton-Klinger plan (each with and without the cyclic brokerage option), so a strategy that converts well gets a seat. It also judges how much to convert by the same measure it uses to rank everything else - after-tax wealth left over plus the money you actually get to spend, in today's dollars - rather than raw ending wealth, which used to reward simply hoarding in the IRA. Because of these two changes, the recommended conversion amounts and the strategies shown may differ from before on the same plan. When no strategy benefits from converting more, the tool now says so plainly instead of showing an empty table.

---

<a id="11.129d"></a>

## 11.129d

**Annual Details now shows Roth conversions as the IRA withdrawals they are, and conversions draw from the larger IRA.**

A Roth conversion is money leaving the IRA, so the IRA WD, IRA1- and IRA2- columns now include it. Before, a year could show a large conversion with little or no IRA withdrawal, which looked wrong even though the balances were correct. RMD stays in its own columns (it is the involuntary draw and is never a conversion). The Federal and State tax columns now include the tax on conversions, so they add up to Total Tax and the Taxation chart shows the real tax. Conversions are now taken from the larger IRA first (spilling to the smaller only when the larger cannot supply the full amount) instead of being split by size, which is what you would actually do and avoids converting a token slice out of a tiny IRA. This changes each IRA's balance over time and therefore each person's future RMDs; the combined yearly tax is unchanged. Clicking a year to open the Tax Payment Planner now sends the correct per-IRA voluntary, conversion, and tax figures.

---

<a id="11.1287"></a>

## 11.1287 - cash-funded conversion taxes

**Maximize Conversions now actually maximizes: available Cash can cover conversion taxes.**

Previously nothing in the tool paid a conversion's tax bill from outside funds, so a $20,000 Extra Annual Roth Conversion only landed about $13,700 in Roth - the rest went to the tax on its own withdrawal. Standard practice is to cover that tax from Cash so the full amount gets to grow tax-free, and Maximize Conversions now does exactly that, on top of its original behavior of routing leftover IRA withdrawals into Roth. It uses only the Cash you have: when Cash is short it funds what it can, and at $0 Cash nothing changes, so existing plans are unaffected until you turn it on. Two switches beneath it, "Convert Excess to Roth" and "Use Cash", let you control the two behaviors separately.

---

<a id="11.1287-2"></a>

## 11.1287 - Optimize Spend and Optimize Conversions move to the Optimizer tab

**Optimize Spend and Optimize Conversions moved to the Optimizer tab, and Optimize Conversions is now on by default.**

Both only ever affected the Optimizer, but sat in the sidebar next to the strategy settings that drive every tab, which made them look like plan settings. They now live at the top of the Optimizer tab under "Search options", where they apply. Optimize Conversions starts on so the conversion-optimized ⇌ rows are found without having to know to ask for them; turn it off if you want a faster sweep. Note that ⇌ rows only appear where an extra conversion actually improves the result for one of the top-ranked strategies, so a plan whose best strategies do not benefit from converting more will correctly show none. Your saved scenarios and shared links keep working unchanged.

---

<a id="11.1287-3"></a>

## 11.1287 - smaller fixes

**Smaller fixes.**

The Roth Conv column in Annual Details had silently lost its explanatory tooltip to a naming typo (as had the Roth Growth column); Roth Conv's now spells out why it can read lower than the amount you asked to convert. The Break Even explainer is a compact ⓘ next to the year instead of a standing button, and it no longer makes you click before telling you anything - hover over it to read the reason, click pins it open, click again closes it.

---

<a id="11.1271"></a>

## 11.1271

**Three fixes from testing the Extra Conversion field and Break Even.**

(1) The Optimizer's conversion-amount search could recommend a Guyton-Klinger conversion so large that GK could only "afford" it by continuously cutting your future spend behind the scenes -- the search now rejects any amount that isn't actually sustainable for GK, the same stability check already used elsewhere in the optimizer. (2) The "Extra Annual Roth Conversion $" tooltip now says plainly that it is capped only by the remaining IRA balance, not by your IRA Goal -- a conversion moves money IRA-to-Roth rather than out of the household, so it is allowed to draw the IRA below that goal on purpose. (3) When Break Even shows “ - ”, a new ⓘ next to the stat identifies the specific conversion year that erases an otherwise-sustained lead, instead of leaving you to guess why.

---

<a id="11.1253"></a>

## 11.1253

**Optimizer strategies loaded from the table now actually match what the table showed.**

Clicking a "⇌ Optimize Conversions" row to load it previously dropped the extra conversion amount that made that row special, so the loaded plan's Break Even (and everything else) could disagree with the Optimizer table. A new "Extra Annual Roth Conversion $" field now holds that amount, is filled in automatically when you load a ⇌ row, and is shareable/saveable like any other input. Loading a cyclic-brokerage or IRMAA/ACA-ceiling ⇌ row now also correctly carries those settings over. Also clarified the Conv Savings tooltip: it only counts tax actually paid so far, so it can look good even when Break Even (which also counts the tax still owed on money left in the IRA) says the conversions never really paid off.

---

<a id="11.1247"></a>

## 11.1247

**Optimizer: Break Even now shown for Optimize Conversions strategies.**

When the Optimize Conversions checkbox is on, the top 5 strategy rows now report a Break Even year (same permanent-crossover definition as the single-scenario stat) in a new column, and a new "Earliest Break Even" objective ranks strategies by how soon their conversions permanently pull ahead. Strategies that never sustain a lead show “ - ”.

---

<a id="11.1240"></a>

## 11.1240

**Break Even now requires the lead to hold for the rest of the plan.**

A rare scenario could report Break Even off a single year where the converting (or excess-withdrawal) plan brushed even before falling behind again, sometimes for good. Break Even is now the earliest year the plan pulls ahead and stays ahead through the end of the simulation, showing “ - ” if that lead is never sustained. Same fix applies to excessOC.

---

<a id="11.11ff"></a>

## 11.11ff

Refactor: No behavior changes. If the page looks stale after this update, do a hard refresh.

---

<a id="11.11f3"></a>

## 11.11f3

Internal cleanup: source files renamed to a shorter, consistent scheme (optimizer_core.js, optimizer_ui.js, optimizer_tests.js, optimizer_text.js, optimizer_styles_responsive.css). The simulation engine and the page UI now live in separate files. No behavior changes. If the page looks broken after this update, do a hard refresh (Ctrl+Shift+R) to clear the old cached files.

---

<a id="11.11dc"></a>

## 11.11dc

**Break Even and Opp. Cost are now measured with a true no-conversion re-simulation.**

The tool re-runs your whole plan with the Roth conversions removed and compares after-tax wealth year by year. The no-conversion plan keeps the money in the IRA and pays its own larger RMD taxes and IRMAA surcharges later, so the benefit of avoiding those is now fully counted. The old approximation could report a Break Even year when there were no conversions at all, and could fail to report one for conversions that clearly paid off. Break Even now appears only when conversions actually happen. The same rework applies to the excess-withdrawal opportunity cost (excessOC).

---

<a id="11.11c8"></a>

## 11.11c8

Improved bar charts. Hover over or click legends to isolate that value. Double click to restore. Line legends are unchanged. IRMAA is now presumed to occur in years 1 and 2 (matching the future value) - a bug caused it to only show up on year 2.

Stress is now performed automatically when Historical Monte Carlo is selected and applies to the current strategy. Line charts now also have the "isolate" behavior in addition to the "click to dismiss, click to reshow."

Cycle Brokerage will now fill up the 0% or 15% tax bracket (whichever falls below any current limits). Previously it was only pulling enough to meet spending.

Other minor UI improvements also made.

---

<a id="11.11ae"></a>

## 11.11ae

Income & Expenses chart: added a note that shown incomes are after-tax (pre-tax figures are in Annual Details).

---

<a id="11.11ad"></a>

## 11.11ad

Added Spending to Annual Details to focus on spending.

---

<a id="11.1133"></a>

## 11.1133

**Architectural improvements.** No features changed.

---

<a id="11.1125"></a>

## 11.1125

**IRMAA now respects Medicare age.**

- **Age-65 gate, per spouse.** The IRMAA surcharge is charged only for spouses who are 65+ (actually on Medicare) - a couple aged 61/59 no longer pays IRMAA no matter how large a Roth conversion is. With one spouse 65+ and one younger, only the older spouse's half is charged.

- **Tier display fix.** The IRMAA Tier column (and chart milestone) previously appeared one year before the surcharge was actually charged; both now use the same 2-year MAGI lookback as the dollar amount, and show -none- before age 65.

- **IRMAA Ceil strategies unlocked pre-63.** Before any spouse is 63 (the earliest year income can affect a premium, given the 2-year lookback), the IRMAA-tier conversion ceiling relaxes to the top of the federal bracket containing it - no more pointlessly capped conversions in your early 60s. Same for “Lesser of IRMAA or Bracket.”

- **Medicare Parts B+D base cost** now shown on charts and table for spouses 65+ - illustration only, not deducted from spendable.

- **Distinct chart colors.** IRMAA is now deep pink and Medicare teal on all charts (they previously shared nearly identical pinks); the IRMAA milestone marker matches the pink.

---

<a id="11.1119"></a>

## 11.1119

**State retirement-income taxes are now much more accurate.**

16 states (Alabama, Colorado, Connecticut, Georgia, Illinois, Iowa, Kentucky, Maine, Maryland, Michigan, Mississippi, New York, Ohio, Pennsylvania, Virginia, Wisconsin) now apply their real pension/IRA exemptions, caps, and credits instead of taxing all retirement income as ordinary income. Several states have limitations; limitations are listed below the state once it's selected. See, e.g., CA, MA, NC, SC, NE, AZ, and MT.

---

<a id="11.1102"></a>

## 11.1102

**State retirement-income exemptions (Illinois & Pennsylvania):**

IRA/401k/pension distributions are no longer taxed by states that exempt them. Illinois and Pennsylvania now correctly exempt these withdrawals (interest, dividends, and capital gains remain state-taxed). Other states are unchanged.

---

<a id="11.10ee"></a>

## 11.10ee

**Pension start age, optimizer symbol legend, and a Guyton-Klinger fix:**

- **Pension start age.** Model a pension that begins after you retire (e.g. retire at 60 while the pension starts at 65). Leave the start age at 0 to begin at retirement.

- **Optimizer symbol legend.** A new legend explains the symbols shown on strategy names (✓ ✦ ▼ 🗘 🔄 ⇌ ⚠️ 🟢 🚨 ⚓).

- **Guyton-Klinger sustainable-spend fix.** When no strategy can fund your spend goal, the suggested fallback spend no longer reports a Guyton-Klinger value that only “works” by cutting spending every year - and the suggested strategy is now clickable to load.

---

<a id="11.10cf"></a>

## 11.10cf

Numerous user experience improvements: IRA Draw strategies now tested to 20%, After-Tax-Spend searches higher spend rates and a suggested value is offered. Other changes include tooltip clarity improvements, chart improvements, and showing Charts first by default.

---

<a id="11.10a2"></a>

## 11.10a2

Added additional charts for clarity: Taxation, Income vs Net Income, Inflows vs Outflows, Earnings vs W/D.

---

<a id="11.1099"></a>

## 11.1099

**Baseline strategy is now ranked by total economic value, not terminal wealth alone.**

The pinned ⚓ baseline is the best no-conversion strategy. **Guyton-Klinger Optimize Spend no longer reports an unsustainable spend.** Optimize Spend now applies a stability floor and accepts a higher initial spend only if the guardrails never cut real delivered spending below one guard band of the initial.

---

<a id="11.1091"></a>

## 11.1091

Fixed a NaN in a Monte Carlo.

**Fixed a shortfall**. Fill strategies will exceed the threshold when needed to meet the spend goal.
However, the ACA Cliff ceiling is now its own strict strategy: it never breaches the cap. If spending can’t be met under the target the plan is flagged untenable (⚠️ in the Optimizer) rather than silently overspending.

---

<a id="11.1060"></a>

## 11.1060

**Stress mode now ranks worst decades by real inflation-adjusted Compound Annual Growth Rate (Real CAGR):**

real CAGR = (1 + equity) / (1 + inflation) − 1. High-inflation decades like the 1960s–70s stagflation, and the Lost Decade (1999-2010)  correctly rank as worse for retirees than a pure equity crash with near-zero inflation. Depression-era crashes also had high deflation which is now clamped to a minimum of -1% (rather than -9%).

---

<a id="11.1042"></a>

## 11.1042

**Guyton-Klinger Guardrails withdrawal strategy:**

- **Dynamic spending rules.** The Guyton-Klinger strategy adjusts annual spending based on portfolio withdrawal rate. It skips inflation adjustments when the prior year return was negative, and cuts spending 10% when the withdrawal rate exceeds the upper guardrail; raises spending 10% when withdrawal rate falls below the lower guardrail. Supports higher initial withdrawal rates (~5–5.5%) by absorbing sequence-of-returns risk through spending flexibility.

- **Four configurable parameters:** Upper/lower guardrail (default ±20% of IWR) and cut/raise percent (default 10%). Annual Details Income category shows gkSpend and gkAdj columns.

---

<a id="11.1001"></a>

## 11.1001

**Best "Baseline" is used for strategy comparison:**

- **Honest baseline.** The optimizer now also runs every strategy family with no Roth conversions and no cyclic brokerage maneuvering, no QCDs, and pins the strongest of those as a ⚓ BASELINE reference row at the top of the results. Every other strategy is measured against it - because "strategy A beats strategy B" only means something relative to the best you can do without conversion/brokerage tricks.

---

<a id="11.1048"></a>

## 11.1048

**Shorter share URLs:**

Share URLs are now up to 70% shorter; older, longer URLs still load unchanged.

---

<a id="11.1019"></a>

## 11.1019

**Cyclic-brokerage drawdown fixed.**

---

<a id="11.1018"></a>

## 11.1018

**Δ columns honor Future/Current $; tax tooltips clarified.**

- **Cleaner table.** Infeasible (bracket-unreachable) rows are hidden by default - click the Infeasible legend to reveal or hide them. Failed plans always sort below successful ones. Every column header now has an explanatory tooltip.

---

<a id="11.fed"></a>

## 11.fed

**Charitable Giving (QCDs) & UX Improvements:**

- **Qualified Charitable Distributions (QCDs):** New Charitable Giving (QCD) section in the sidebar. Enter an annual household QCD maximum - the simulation transfers that amount directly from the larger eligible IRA to charity each year (age 70½+ per person). QCDs satisfy the RMD requirement without adding to taxable income, reducing IRMAA exposure.
Two modes: Always donates the full amount every eligible year; As Needed applies only enough to drop two IRMAA tiers (or escape the surcharge entirely, whichever requires fewer dollars). The per-person limit is $111,000 for 2026 (CPI-indexed annually per SECURE 2.0). QCDs appear as a gray bar in the Income & Expenses chart.

- **Dollar display toggle:** The Future $ / Current $ toggle has moved to the left of the tab bar (always visible). Future $ shows nominal amounts as they will actually appear; Current $ restates everything in today's purchasing power for easy year-to-year comparison.

- **Strategy panel switches:** Maximize Conversions (formerly "Max Conversion"), Cycle Brokerage (formerly "Cyclic"), Optimize Spend, and Optimize Conversions (formerly "Conv Optimizer") are now all in the strategy sidebar with labels to the right of each switch. Toggle labels are positioned so that the green (on) position visually aligns with the label.

---

<a id="11.ecc"></a>

## 11.ecc

**Withdrawal Rate:**

Corrected Portfolio Withdrawal percent calculations. Added netOutflow, grossOutflow and inFlow columns for summary information.

---

<a id="11.ecb"></a>

## 11.ecb

**Withdrawal Timing:**

Each simulation year now auto-selects Early (January) or Late (December) withdrawal timing. Conversion years use Early - maximizing Roth compounding duration. Spending-only years use Late - the full portfolio compounds before the withdrawal exits, gaining D×r per year (~$3,500/yr on a $50k draw at 7%). No manual toggle; the algorithm tracks prior-year conversion activity. A new Timing column in Annual Details shows Early(Conv) or Late(Spend) for each year.

---

<a id="11.eca"></a>

## 11.eca

**Bear-Start Overlay (Historical Monte Carlo):**

In Historical mode, the bottom 25% of paths begin with a randomly-sampled worst-decade historical sequence before continuing with random draws. The likelihood of a "Bear start" market is 23%, so this adds realistic sequence of return risks (SORR).

---

<a id="11.ec9"></a>

## 11.ec9

**Stress Mode:**

Monte Carlo "Stress (worst sequences)" runs the worst historical retirement-start sequences scored by first-decade real (inflation-adjusted) CAGR. Shows sequence-of-returns risk directly - each line is a real historical scenario. Chart labels show nominal equity CAGR, inflation CAGR, and real CAGR for each scenario. Clicking on a legend hides all other plots. Will your retirement withdrawal strategy survive the stagflation of the 1960s–70s? The tech bubble of 2000? This will tell you.

---

<a id="11.ec8"></a>

## 11.ec8

**State Bracket Inflation Fix:**

MT, ND, AL, OH, and SC have statutory fixed income tax brackets (they were being incorrectly inflated which would understate future state taxation). Other states are unaffected. Known limitation: the standard deduction for AL, OH, and MT is fixed by statute but is being adjusted - future fix to be provided.

---

<a id="11.ec7"></a>

## 11.ec7

**State Tax Expansion:**

Added AL, AZ, CO, IN, KY, MA, ME, MN, MT, ND, OH, SC, WI to the state income tax dropdown.  All states adjusted to latest available information.

---

<a id="11.ec6"></a>

## 11.ec6

**Cycle Brokerage:**

New Cycle Brokerage toggle in the strategy box enables alternating IRA draw years and brokerage LTCG harvest years.
IRA-draw years and brokerage harvest years alternate. The ratio of IRA to brokerage cycles is based on the ratio of the account balances. E.g. if the brokerage is 1/3 the size of the IRA total, the cycle will be 1 year brokerage, 2 years IRA draws.
As the asset balances change, the ratio may also change.
In Brokerage harvest years spending is funded from brokerage gains at capital-gains rates (often 0–15%). Excess brokerage funds are reinvested (DRIP) so dividends stay inside brokerage and don't
leak to Cash as ordinary income. Two orderings are supported: IRA-first (🗘, red) harvests after N IRA years; Brokerage-first (🔄) harvests at the start of each cycle.
The Optimizer and Monte Carlo always run all three variants (baseline + IRA-first + Brokerage-first) and surface the best. The subCycle column in Annual Details shows IRA/Brok/⚠Brok per year.
One benefit of Cycle Brokerage is earlier reduction of brokerage assets that would otherwise grow increasing later capital gains.

---

<a id="11.e64"></a>

## 11.e64

**BETR (Break-Even Tax Rate):**

Annual Details now shows the break-even future tax rate for each year's Roth conversion.
Avg BETR summary stat shows the average across all conversion years. "Conv Optimizer" determines whether conversions realize any tax savings and are indicated with (⇌)
**Bug fix:** eliminated shortfalls in cases involving brokerage withdrawals.

---

<a id="11.e52"></a>

## 11.e52

URL compression: all share URLs now use short parameter names (57% shorter). Share button opens a copyable popup panel on all tools matching Income Tax Planner style. Income Tax Planner gets an "Open in Tax Planner →" button that pre-fills Retirement Tax Planner with state, SS income, and capital gains. Backward compatible - existing long-key bookmarks still load.

---

<a id="11.e4f"></a>

## 11.e4f

User Experience polish throughout. Roth conversion & opportunity cost tracking calculates when conversions or cash withdrawals "pay off". Break Even at the top says when that year is. New Opp. Cost category and columns added to Annual Details. Future IRA Tax % marginal rate when IRA is eventually distributed; auto defaults the last simulation year marginal rate. Choose your heirs total tax rate.

---

<a id="11.e4a"></a>

## 11.e4a

Fixed start age bug (table now starts at retirement year on URL load). Updated withdrawal strategy descriptions in How To. Added color legend to Annual Details table.

---

<a id="11.e1a"></a>

## 11.e1a

New feature: view input distributions in Monte Carlo.

---

<a id="11.df0"></a>

## 11.df0

Monte Carlo uses historical inflation 1928–2024 and growth (based on S&P), that historical inflation also is used to escalate the spend-goal rather than using a fixed rate. Stats display CAGR (Compound Annual Growth Rate) instead of arithmetic median - e.g. the CAGR growth rate is the "true" rate where the median rate is the "middle" rate over the entire period. Example: -20% growth for 3 years, 10% growth for one year, then +20% growth for 3 years the CAGR is about -0.38%, but the median is 10%. CAGR gives you the real net growth.

---

<a id="11.dd9"></a>

## 11.dd9

Monte Carlo uses Historical data from real S&P 500, bond, and international returns (1970–2024). Account Composition shows Est.Rtn advisory column (median before inflation); Monte Carlo shows per-asset-class return ranges (Eq/Bonds/Intl).

---

<a id="11.dd6"></a>

## 11.dd6

Added ordered withdrawal strategy (CBIR/RIBC/BIRC). Fixed error where Spend Goal was inflated prematurely. Default bracket strategy changed to `Below IRMAA`. Fill provides feedback: ✓ or ⚠ status with max feasible spend estimate; clicking ⚠ sets After-Tax Spend to the bracket maximum and triggers recalculation.

---

<a id="11.dad"></a>

## 11.dad

Ages (current age and RMD start age, live-updating) added; optimizer always runs with Max Conversion on (it was almost always better); Strategy defaults were changed; other defaults changed, too.

---

<a id="11.da6"></a>

## 11.da6

Bug fixes: survivor SS benefit was ~2× correct (delayed credits were accruing past claiming age - fixed); dividends now correctly compound inside IRA and Roth accounts (previously only Brokerage received the dividend growth component). New feature: Retirement Start Age - enter the age you plan to retire; the simulation inflates brackets, SS COLA, and spend goal forward to that year automatically. Start age defaults to your current real-world age (birth-month aware). You may have retired already, but this tool starts where you are. Monte Carlo: click any result row to load that strategy. Annual Details: Roth1/Roth2 per-person balance columns now available under Roth Δ. Minor Version numbering changed: lowercase hex((day-of-year × 24) + hour).
