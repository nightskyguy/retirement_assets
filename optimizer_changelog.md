# Retirement Optimizer: Detailed Change Log

Full write-ups of what changed in each release, newest first.

The Documentation tab inside [retirement_optimizer.html](retirement_optimizer.html) carries a short
summary of the five most recent releases and links here for the detail. Entries marked **behavior
change** alter the numbers an existing plan produces, so a saved scenario or a shared link can give a
different answer than it did before that release.

For what the tool does and how to use it, see [README.md](README.md).

---

<a id="11.146a"></a>

## 11.146a (behavior change)

**The same strategies now work the withdrawal out correctly the first time, instead of drawing too
little and then patching the difference. The tax on your guaranteed income is part of the
calculation rather than an afterthought.**

**What was wrong.** The previous release fixed the symptom. When Proportional, Reduce,
Guyton-Klinger or the default strategy came up short, they could finally go back to the IRA for the
difference. But the reason they came up short every year was still there: the first withdrawal was
worked out by subtracting your guaranteed income from your spending goal at its full pre-tax value,
so it was always too small by about the tax owed on your Social Security, pension and required
distributions. The plan then spent the year discovering that and correcting it. The end result was
usually right, but the withdrawal amounts and the tax that followed from them were not, and every
plan leaned on an emergency backstop to do ordinary work.

**What changed.** The first withdrawal is now sized against what your guaranteed income is actually
worth after tax. The tax is computed, not estimated with a single rate, because your guaranteed
income is not taxed at one rate: Social Security is between 0% and 85% taxable depending on your
other income, qualified dividends have their own 0/15/20% schedule, and pensions and required
distributions are ordinary income. Applying one blended rate to the whole amount would have
overstated the tax by several times on a Social Security heavy household and drawn far too much.

**What this does to your numbers.** On the same test plan used in the previous entry, Proportional
0% spends the same $4,567,609 and the backstop draw shown in the `ForcedIRA` column falls from
$395,109 to $43,816. The withdrawals are now where they belong, and the backstop is back to being a
backstop. Ending wealth moves a little, from $202,859 to $195,000. On other plans the effect is
larger and can go either way, because a differently sized withdrawal lands in different tax
brackets: one Guyton-Klinger test plan pays $29,575 less tax and ends with $89,827 more, while a
Proportional plan with a large IRA pays $17,677 more tax and ends with $8,648 less. Guyton-Klinger
plans can also change their spending path, since that strategy sets spending from the portfolio
balance and the balance now follows a different track.

**Which strategies change.** Proportional, Reduce, Guyton-Klinger, the default strategy, an ACA
Cliff plan after its cap ends at Medicare, and the Cyclic Brokerage option. Fill Bracket, IRMAA
Tier, IRA Draw %, Fixed and Ordered set their withdrawal by their own rule and never used this
calculation, so they produce identical results to before. ACA Cliff while its cap is in force is
unchanged and still reports a shortfall rather than crossing the cap, for the reasons in the
previous entry.

---

<a id="11.1468"></a>

## 11.1468 (behavior change)

**Proportional, Reduce, Guyton-Klinger and the default strategy were sizing withdrawals as if
Social Security, pensions and RMDs arrived tax free. They now draw the IRA needed to cover the
whole spending goal, so plans that used to report a shortfall next to a large IRA are funded.**

**What was wrong.** These strategies worked out the withdrawal by subtracting your guaranteed
income from your spending goal, using the full pre-tax value of that income. The tax owed on the
Social Security, pension and RMD money was never included, so every year came up short by roughly
the amount of that tax bill. While there was money in Cash or Brokerage the gap was quietly covered
and nothing looked wrong. Once those accounts ran dry the gap had nowhere to go, and the plan
reported unfunded spending while the IRA still held a large balance. On one test plan, Proportional
0% left $304,331 of spending unfunded across 13 years while holding $893,920 in the IRA. Reduce
left $234,643 unfunded, and Guyton-Klinger $34,050. Which of these plans happened to survive
depended on details that have nothing to do with funding: Proportional at a 10% boost passed only
because over-drawing the IRA left a cash surplus that got spent later.

**What changed.** When Cash, Brokerage and Roth are exhausted and spending is still unfunded, these
strategies now draw the additional IRA needed, the same backstop Fill Bracket and IRMAA Tier have
always had. The amount appears in the `ForcedIRA` column.

**What this does to your numbers.** If you have a saved Proportional, Reduce or Guyton-Klinger plan,
or a shared link to one, it can now report different results. A plan that reported a shortfall may
now succeed. Spending goes up, tax goes up because the extra withdrawal is taxable, and ending
wealth goes down. On the test plan above, Proportional 0% went from $4,263,278 spent and $684,010
left over, to $4,567,608 spent and $202,859 left over. The drop in ending wealth is the money being
spent on your goal instead of sitting unspent in the IRA. Fill Bracket, IRMAA Tier, IRA Draw % and
Ordered produce identical results to before.

**ACA Cliff is deliberately excluded, and that is not an oversight.** While the cap is in force it
will still report a shortfall rather than draw more from an IRA. An IRA withdrawal is taxable
income, and going a single dollar over the cap forfeits the entire premium subsidy, so drawing more
would cost far more than the spending it funds. A shortfall on ACA Cliff means the spending goal
could not be met from non-taxable sources, which is the answer that strategy exists to give. Once
the cap ends at Medicare there is no subsidy left to protect, and from that year the plan is funded
like any other. On a plan whose cap runs to age 65, that shows up as seven capped years that still
report a shortfall, followed by twenty-one funded years.

**Also.** A plan that genuinely runs out of money still reports a shortfall. The change only affects
spending that could have been funded from an IRA that was sitting there.

---

<a id="11.1464"></a>

## 11.1464

**The ACA Cliff strategies are now available to everyone, and the warning about them tells you which
year it is talking about.**

Three changes, all to what you can see and select. No plan's numbers move.

**1. ACA Cliff is no longer an advanced-only option.** The four Federal Poverty Level ceilings
(200/250/300/400%) now appear in the ceiling dropdown for everyone, the Optimizer sweeps those rows
for everyone, and the paragraph explaining the strategy is no longer hidden. It was gated because
the ACA model is rough, which is still true, so the documentation now says so plainly rather than
the option being hidden. In particular the tool models the income cap and **none** of the premium
subsidy that cap buys, so an ACA row shows you what staying under the limit costs and not what it
saves. The options still disappear once both people are on Medicare at the start of the plan.

**2. The 400% option no longer carries a warning triangle.** Nothing computed it. It was fixed text
attached to that one entry, so it appeared even when 400% was the only workable choice, and stayed
silent on a 200% cap that could not fund a single year. Whether a cap is achievable cannot be known
without running the plan, which the dropdown does not do. The ⚠️ that **is** computed is the one on
Optimizer rows, from the number of years the cap actually blocked spending. Because a lower
percentage is a stricter limit, if one ACA row is flagged there, every lower one is flagged too.

**3. The Medicare warning now names the year and your ages in it.** It used to say only that you
would be on Medicare "at retirement start", while the age shown next to your birth year is your age
**today**. If your plan starts years from now those are two different numbers, and being told you
are on Medicare while the field beside it reads "Age 59" looked like the tool had stopped paying
attention. It now reads, for example, "At retirement start in 2031, you will be 65 and your spouse
79", and tells you that lowering **Retirement Start Age** is what brings the ACA years back.

---

<a id="11.1462"></a>

## 11.1462 (behavior change)

**The ACA income cap now ends when Medicare begins, instead of being enforced for the rest of your
life.**

ACA premium subsidies stop being available once you are eligible for Medicare. The tool was not
checking ages at all: pick an ACA Cliff strategy and it held your income under the Federal Poverty
Level multiple you chose at 65, at 80, at 95, protecting a subsidy that had ended decades earlier.
On a plan that opens after 65 the cap was being enforced for every single year of the plan.

What happens now: from the first year in which **every living person in the plan** is old enough for
Medicare, the cap is dropped and the strategy behaves as **Proportional 0%**, drawing across your
accounts to fund your spending goal.

Two details worth knowing, because both change what you should expect to see:

+ It is **every living person**, not every person. If one spouse dies before reaching Medicare age
  and the survivor is already past it, the cap ends that year. Those survivor years are exactly where
  a single filer's narrower tax brackets used to strand spending under a cap that was protecting
  nothing.
+ Until then the cap is measured against **household** income. If one spouse is already on Medicare
  and the other is not, the older spouse's required distributions and Social Security still count
  against the younger spouse's limit. The tool now says this in the warning under the strategy
  selector, which previously claimed the limits applied only to the younger person.

**Who this changes.** Only plans using an ACA Cliff strategy. Nothing else moves: Fill Bracket,
Minimize IRMAA, Proportional, Reduce, IRA Draw, Ordered, Guyton-Klinger and the baseline were all
confirmed identical to the previous release.

On a couple aged 66 and 67 at the start with a $2.1M IRA and a $160,000 spending goal, the ACA 400%
arm changes like this:

| | before | now |
|---|---|---|
| years the cap blocked spending | 24 of 24 | 0 |
| spending left unfunded | $735,010 | $304,331 |
| total spending funded | $3,832,599 | $4,263,278 |
| ending net worth | $1,888,543 | $684,010 |

Ending net worth **falls**, and that is the point rather than a side effect. The old behavior looked
wealthier only because it refused to fund the spending goal and left the money in the IRA. The
remaining $304,331 of unfunded spending is not an ACA effect at all; it is what Proportional 0%
already did on that plan, unchanged by this release.

An ACA row is still worth reading as a constraint study rather than a recommendation. The tool
models the income cap and none of the premium subsidy it buys, so it can show you what staying under
the cap costs you and not what it saves you.

Also in this release: the year a cap actually blocked spending is now recorded per year internally
rather than only as a total, which is what made the above measurable.

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
  while it funded no spending at all, and total spending could come out negative. In the run above,
  a Proportional plan in Nevada reported success with total spending of -$649,857; it now reports
  $810,921 and correctly reports failure, because a $400,000 goal on that portfolio genuinely fails.
- **"Minimize IRMAA" converted little or nothing in every state, not just those 21.** That strategy
  stops at the first IRMAA surcharge tier, and the same missing boundary applied whenever your
  spending goal sat below that tier, which is most plans. The same single filer above now converts
  $13,698 in California and $163,686 in Nevada, against $0 and $465 before.

**What this means for a saved plan.** If your state is one of the 21, or if you use Minimize IRMAA
anywhere, your saved scenarios and shared links will produce different numbers than before. In every
case measured the new numbers are the correct ones and the old ones understated what the strategy
would do. The 17 states the tool models with graduated brackets are unaffected for every strategy
except Minimize IRMAA, and that was verified state by state rather than assumed.

---

<a id="11.13d0"></a>

## 11.13d0

**A link labelled with a file name now shows the page it actually opens.**

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

Clicking a year in Annual Details opens the Tax Payment Planner with that year's figures. Three of
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

Both are plain inputs like any other now. Neither does anything until you fill it in, so no existing
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
onward, so a 22% bracket becomes roughly 26.8% after twenty years at 1%/yr. Bracket thresholds still
track CPI as before, and state tax, capital gains, the NIIT surtax and IRMAA are unaffected. It is a
stress test for a higher-tax future, not a forecast. Leave it at 0 to keep today's rates for the
whole plan.

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

The stress chart also failed to draw for anyone who reached a stress result without running a full
Monte Carlo sweep first, which is the normal path with advanced controls turned on: the headline
count appeared with an empty chart beneath it.

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

Your plan is now marked in exactly one place when there is nothing else to say. It was possible to
see three 📍 markers at once: the pinned row, the same row repeated in the ranked body, and the swept
strategy that matches your settings. The body copy is gone, since the pinned row already carries the
Rank column, and the swept row is only marked when it is genuinely a different plan from yours,
which happens when your conversion switch, Extra Annual Conversion or stop year differ from what the
sweep runs. When the swept row simply is your plan, only the pinned row is marked.

The pinned rows read ⚓ BASELINE and 📍 CURRENT, marker first in both cases, and a row that wins a
metric in the Best table keeps its marker there too, so it is recognisable as the same row without
repeating the words.

The ⚖ control has its own column at the start of each row, and the outcome marker beside it is part
of the same control, with a gap separating both from the rest of the row. It began as a small glyph
inside the Strategy cell, where a near miss loaded that strategy into the sidebar instead: a
destructive, surprising result for a click aimed at a comparison. The highlighted ⚖ always marks
whichever row the columns are currently measured against, which is the ⚓ baseline until you pick
something else, so the table shows where the comparison point is from the moment it opens. Clicking
the highlighted one puts everything back, exactly like the Stop comparing button.

---

<a id="11.1387"></a>

## 11.1387 (behavior change)

**Your own plan now appears in the Optimizer table, so you can compare it against every strategy it suggests.**

A pinned 📍 CURRENT row sits under the ⚓ baseline showing your sidebar settings run exactly as they are, including whether conversions are on, any Extra Annual Roth Conversion, and any stop year. That matters because every strategy the Optimizer sweeps is run with conversions turned on and your own conversion settings set aside, so until now nothing in the table was actually your plan, even when the strategy and its parameter matched. Your plan is also ranked with the others, so the Rank column tells you where it stands, and it can win a metric in the Best table if it genuinely beats everything else. The same 📍 marks the swept row that uses your strategy and parameter, which lets you see where your setting sits on that family's curve. If your parameter falls between the standard steps, for example a 7% proportional boost or an 18 year drawdown, that exact value is now swept as its own row instead of being skipped. The Break Even column is filled in for every strategy now, not just the ⇌ conversion rows, so sorting by it works and there is a new "⏱ Earliest Break Even" entry in the Best table: the strategy whose conversions pay for themselves soonest, with ties going to the one that leaves more after-tax wealth. Choosing "Earliest Break Even" under Optimize for now reorders the table, which it previously could not do because the column had no values to sort. Three fixes came out of the same work. Clicking an Ordered row now brings its account sequence with it instead of leaving whatever was in the sidebar. The Monte Carlo stress test now recognizes Guyton-Klinger and Ordered plans as your current strategy rather than falling back to a generic one. And the summary numbers at the top of the page, including Break Even, now refresh when you change a setting while the Optimizer tab is open: they used to keep showing the previous plan until you clicked over to Chart or Annual Details, which is what made a change like turning Maximize Conversions on look like it had no effect.

<a id="11.137f"></a>

## 11.137f (behavior change)

**The suggested year to stop converting is now measured against the plan you would actually get.**

The tool decides whether to take money out of your accounts in January or in December based on whether that year makes a Roth conversion, because a conversion year is better done early. When the Break Even ⓘ searched for the best year to stop converting, it built each trial plan in a way that failed to set that switch, so every year it compared was run with December withdrawals even where conversions were happening. It also treated "convert nothing" as a January-withdrawal year, which no plan with no conversions would ever be. The result was a suggested stop year and dollar gain measured against plans that were not quite the ones you could load, and the two "stop scope" choices could report different gains for the very same cutoff. On a large-IRA example the gain compared with never converting was overstated by about $8,900, and the two scopes disagreed by about $2,200 on a cutoff where they should have matched. All of that now lines up: click the suggested year and the plan you get is the plan that was scored. A stop year set at or before the first year of the plan is also now correctly treated as converting nothing. Plans with no stop year, including the whole strategy table, Monte Carlo and Annual Details, are unchanged to the dollar.

<a id="11.1370"></a>

## 11.1370 (behavior change)

**When converting more does not help, the Optimizer now tells you what would have to be true for it to help, and it can find conversions it used to miss.**

Optimize Conversions previously reported only that none of the strategies it examined improved by converting more, which is accurate but a dead end. It now names the future tax rate your plan is assuming, and a link works out the lowest future tax rate at which converting would start to pay, along with the amount and the gain at that rate. If no plausible rate makes conversions worthwhile, it says so plainly, because that is a real answer about your plan rather than a missing one. Separately, the search itself was too narrow: it only ever tested converting the same amount every year for the rest of the plan, so a plan that should convert heavily for a few years and then stop could only be told to convert nothing. When a flat conversion does not help, the Optimizer now also tries converting for a limited number of years, and any plan it finds this way appears as a ⇌ row tagged with the year conversions stop (⏹). Clicking it fills in both the amount and the stop year. This changes which conversion rows appear and the amounts they suggest. Two columns also changed: the Avg BETR column and its summary-bar tile were removed, because testing showed the Break-Even Tax Rate is not reliable enough to decide anything (it is still available per year in Annual Details), and "Conv Savings" is now called "Tax Paid Δ", since it only counts tax paid during the plan and can look positive on a plan that ends up worse off. Break Even remains the column to trust.

<a id="11.1340"></a>

## 11.1340 (behavior change)

**Cash Reserve now controls what happens to money you withdraw beyond your spending needs.**

Most retirees with a large IRA are forced to take out more than they spend once required distributions begin. Until now the tool left all of that surplus sitting in cash, earning only the cash yield, for the rest of the plan. That understated how well a plan does when those extra dollars are reinvested, and it quietly tilted the Roth conversion comparison in favor of converting. The Cash Reserve field now decides where the surplus goes. Leave it blank (or enter -1) to keep the original behavior: all surplus stays in cash. Enter 0 to reinvest every surplus dollar into your Brokerage account, where it grows at the market rate. Enter a dollar amount to keep that much as a cash cushion, in today's dollars, and reinvest only the surplus above it; spending will not draw the cushion down unless every other account is exhausted. If you load a saved plan or a shared link that already sets a Cash Reserve, a note reminds you that results now differ from older versions and that blank or -1 restores the old behavior. This one setting can meaningfully change Break Even, the suggested year to stop converting, and the final balances, so it is worth trying both ways.

<a id="11.1330"></a>

## 11.1330

**The Break Even note now tells you the best year to stop converting, and offers one click to do it.**

When your plan makes Roth conversions, the ⓘ next to Break Even now names the year that leaves you with the most after-tax wealth if you stop converting after it, along with how much more that keeps than converting all the way through, and how much more than never converting at all. This replaces the older note, which pointed at the year conversions first turned unprofitable; that year is usually not the best place to stop, because it ignores how much a plan can still gain by stopping earlier. The point is that converting past a certain year can leave you worse off than never converting, since the tax paid on a late conversion no longer earns its keep before the plan ends. Click the suggested year to fill in a new "Stop conversions after" control and re-run: enter a calendar year like 2031, or your own age like 71, and conversions run through that point and then stop. You can choose whether stopping applies to all conversions or only the Extra Annual Roth Conversion; stopping all of them is the stronger lever. Spending is unchanged by where you stop, so this is a pure comparison of what your heirs receive after tax.

<a id="11.12fd"></a>

## 11.12fd

**The charts now mark the year each person's RMDs begin.**

Two new dashed lines, "Your RMDs begin" and "Spouse RMDs begin", join the existing markers on both charts, and because the date depends only on a birth year they also appear on the Monte Carlo chart. The line is drawn for the year you reach your RMD age (73 or 75, depending on when you were born), and only when that birthday falls inside the plan, so a plan that starts after your RMDs have already begun does not get a line. It is drawn whether or not there is anything left in the IRA to withdraw, since the date itself is worth seeing. The "Show milestones" tooltip now lists every marker the charts can draw, which it had stopped doing some versions ago.

<a id="11.12fb"></a>

## 11.12fb

**The Withdrawal Rate stat was reading far too low and has been corrected.**

It now measures what it says: the money actually pulled out of your accounts to pay for spending and taxes, divided by what the portfolio was worth at the start of that year. Three things were wrong before. Social Security and pension income were being subtracted from the withdrawals, so a plan drawing $164,000 against $81,000 of Social Security was reported as if it had withdrawn only $19,000. The bottom of the fraction used an after-tax estimate of your wealth rather than the actual account balances, and the very first year used a different basis than every year after it. On a typical plan the stat moves from about 1.1% to about 2.4%, which is now directly comparable to the classic 4% rule and to the guardrail rate the Guyton-Klinger strategy uses internally. The tile is relabeled simply "Withdrawal Rate", and hovering it shows two extra views: a dollar-weighted average, and a net depletion figure that goes negative when your portfolio is growing faster than you draw it down. The rate itself can no longer go negative, because you cannot withdraw less than nothing. A related fix: in years when Social Security covers everything, a required distribution that gets reinvested is no longer counted as a withdrawal, since those dollars never left the portfolio. Also in the header, the summary stats are left-aligned on wide screens instead of being pushed to the right edge, and the "what you last changed" note moved to sit after the numbers alongside the save and load messages.

<a id="11.12f7"></a>

## 11.12f7

**New "Optimize for" choice at the top of the Optimizer ranks every strategy by the goal you care about.**

Pick a goal and the table sorts to put the best plan for it on top, moves the baseline to match, and renumbers the Rank column. It changes only which plan the tool puts in front of you, never the underlying numbers, and clicking any column header still sorts by that column. The choices, in the order most people asked for them: Tax Flexibility (the default, which favors plans that end with your money spread evenly across pre-tax, Roth, and taxable accounts so you can draw from whichever is cheapest in any given year, compared only among the plans that also finish among the wealthiest); Maximum Net Wealth; Avoiding Widow and RMD Tax (favors plans that leave less in the pre-tax IRA, since that is what drives forced withdrawals and the higher single-filer tax a survivor pays); Minimum Lifetime Taxes; plus Maximum Spending, Maximum Roth, and a Balanced blend. The Documentation tab explains what each one measures, including why Minimum Lifetime Taxes and Avoiding Widow and RMD Tax can legitimately disagree. A few smaller fixes came along with it: the "Best" summary no longer lists a strategy that cannot actually be run; Annual Details shows the Roth Conversion column when you turn on the Opp. Cost view; when a spouse is already on Medicare, all of the ACA income-limit rows are marked not applicable rather than just one; and the Score column was dropped since the row order and the Rank column already show the ranking.

<a id="11.12e5"></a>

## 11.12e5

**Optimize Conversions now looks at the best plan from each family of strategies, not just the five with the highest ending wealth.**

The strategies that benefit most from converting are often not the ones that finish with the most money, so the old five-highest list could be filled entirely by strategies that gain nothing from converting, leaving the ⇌ table empty even when other strategies had a real conversion to recommend. It now considers the best Proportional, Reduce, Fill Bracket, IRMAA Ceiling, IRA Draw, Ordered, and Guyton-Klinger plan (each with and without the cyclic brokerage option), so a strategy that converts well gets a seat. It also judges how much to convert by the same measure it uses to rank everything else - after-tax wealth left over plus the money you actually get to spend, in today's dollars - rather than raw ending wealth, which used to reward simply hoarding in the IRA. Because of these two changes, the recommended conversion amounts and the strategies shown may differ from before on the same plan. When no strategy benefits from converting more, the tool now says so plainly instead of showing an empty table.

<a id="11.129d"></a>

## 11.129d

**Annual Details now shows Roth conversions as the IRA withdrawals they are, and conversions draw from the larger IRA.**

A Roth conversion is money leaving the IRA, so the IRA WD, IRA1- and IRA2- columns now include it. Before, a year could show a large conversion with little or no IRA withdrawal, which looked wrong even though the balances were correct. RMD stays in its own columns (it is the involuntary draw and is never a conversion). The Federal and State tax columns now include the tax on conversions, so they add up to Total Tax and the Taxation chart shows the real tax. Conversions are now taken from the larger IRA first (spilling to the smaller only when the larger cannot supply the full amount) instead of being split by size, which is what you would actually do and avoids converting a token slice out of a tiny IRA. This changes each IRA's balance over time and therefore each person's future RMDs; the combined yearly tax is unchanged. Clicking a year to open the Tax Payment Planner now sends the correct per-IRA voluntary, conversion, and tax figures.

<a id="11.1287"></a>

## 11.1287

**Maximize Conversions now actually maximizes: available Cash can cover conversion taxes.**

Previously nothing in the tool paid a conversion's tax bill from outside funds, so a $20,000 Extra Annual Roth Conversion only landed about $13,700 in Roth - the rest went to the tax on its own withdrawal. Standard practice is to cover that tax from Cash so the full amount gets to grow tax-free, and Maximize Conversions now does exactly that, on top of its original behavior of routing leftover IRA withdrawals into Roth. It uses only the Cash you have: when Cash is short it funds what it can, and at $0 Cash nothing changes, so existing plans are unaffected until you turn it on. Two switches beneath it, "Convert Excess to Roth" and "Use Cash", let you control the two behaviors separately.

<a id="11.1287-2"></a>

## 11.1287

**Optimize Spend and Optimize Conversions moved to the Optimizer tab, and Optimize Conversions is now on by default.**

Both only ever affected the Optimizer, but sat in the sidebar next to the strategy settings that drive every tab, which made them look like plan settings. They now live at the top of the Optimizer tab under "Search options", where they apply. Optimize Conversions starts on so the conversion-optimized ⇌ rows are found without having to know to ask for them; turn it off if you want a faster sweep. Note that ⇌ rows only appear where an extra conversion actually improves the result for one of the top-ranked strategies, so a plan whose best strategies do not benefit from converting more will correctly show none. Your saved scenarios and shared links keep working unchanged.

<a id="11.1287-3"></a>

## 11.1287

**Smaller fixes.**

The Roth Conv column in Annual Details had silently lost its explanatory tooltip to a naming typo (as had the Roth Growth column); Roth Conv's now spells out why it can read lower than the amount you asked to convert. The Break Even explainer is a compact ⓘ next to the year instead of a standing button, and it no longer makes you click before telling you anything - hover reads the reason, click pins it open, click again closes it.

<a id="11.1271"></a>

## 11.1271

**Three fixes from testing the Extra Conversion field and Break Even.**

(1) The Optimizer's conversion-amount search could recommend a Guyton-Klinger conversion so large that GK could only "afford" it by continuously cutting your future spend behind the scenes -- the search now rejects any amount that isn't actually sustainable for GK, the same stability check already used elsewhere in the optimizer. (2) The "Extra Annual Roth Conversion $" tooltip now says plainly that it is capped only by the remaining IRA balance, not by your IRA Goal -- a conversion moves money IRA-to-Roth rather than out of the household, so it is allowed to draw the IRA below that goal on purpose. (3) When Break Even shows “ - ”, a new ⓘ next to the stat identifies the specific conversion year that erases an otherwise-sustained lead, instead of leaving you to guess why.

<a id="11.1253"></a>

## 11.1253

**Optimizer strategies loaded from the table now actually match what the table showed.**

Clicking a "⇌ Optimize Conversions" row to load it previously dropped the extra conversion amount that made that row special, so the loaded plan's Break Even (and everything else) could disagree with the Optimizer table. A new "Extra Annual Roth Conversion $" field now holds that amount, is filled in automatically when you load a ⇌ row, and is shareable/saveable like any other input. Loading a cyclic-brokerage or IRMAA/ACA-ceiling ⇌ row now also correctly carries those settings over. Also clarified the Conv Savings tooltip: it only counts tax actually paid so far, so it can look good even when Break Even (which also counts the tax still owed on money left in the IRA) says the conversions never really paid off.

<a id="11.1247"></a>

## 11.1247

**Optimizer: Break Even now shown for Optimize Conversions strategies.**

When the Optimize Conversions checkbox is on, the top 5 strategy rows now report a Break Even year (same permanent-crossover definition as the single-scenario stat) in a new column, and a new "Earliest Break Even" objective ranks strategies by how soon their conversions permanently pull ahead. Strategies that never sustain a lead show “ - ”.

<a id="11.1240"></a>

## 11.1240

**Break Even now requires the lead to hold for the rest of the plan.**

A rare scenario could report Break Even off a single year where the converting (or excess-withdrawal) plan brushed even before falling behind again, sometimes for good. Break Even is now the earliest year the plan pulls ahead and stays ahead through the end of the simulation, showing “ - ” if that lead is never sustained. Same fix applies to excessOC. See “What is Break Even?” below.

<a id="11.11ff"></a>

## 11.11ff

Refactor: No behavior changes. If the page looks stale after this update, do a hard refresh.

<a id="11.11f3"></a>

## 11.11f3

Internal cleanup: source files renamed to a shorter, consistent scheme (optimizer_core.js, optimizer_ui.js, optimizer_tests.js, optimizer_text.js, optimizer_styles_responsive.css). The simulation engine and the page UI now live in separate files. No behavior changes. If the page looks broken after this update, do a hard refresh (Ctrl+Shift+R) to clear the old cached files.

<a id="11.11dc"></a>

## 11.11dc

**Break Even and Opp. Cost are now measured with a true no-conversion re-simulation.**

The tool re-runs your whole plan with the Roth conversions removed and compares after-tax wealth year by year. The no-conversion plan keeps the money in the IRA and pays its own larger RMD taxes and IRMAA surcharges later, so the benefit of avoiding those is now fully counted. The old approximation could report a Break Even year when there were no conversions at all, and could fail to report one for conversions that clearly paid off. Break Even now appears only when conversions actually happen. The same rework applies to the excess-withdrawal opportunity cost (excessOC). See "What is Break Even?" below.

<a id="11.11c8"></a>

## 11.11c8

Improved bar charts. Hover over or click legends to isolate that value. Double click to restore. Line legends are unchanged. IRMAA is now presumed to occur in years 1 and 2 (matching the future value) - a bug caused it to only show up on year 2.

Stress is now performed automatically when Historical Monte Carlo is selected and applies to the current strategy. Line charts now also have the "isolate" behavior in addition to the "click to dismiss, click to reshow."

Cycle Brokerage will now fill up the 0% or 15% tax bracket (whichever falls below any current limits). Previously it was only pulling enough to meet spending.

Other minor UI improvements also made.

<a id="11.11ae"></a>

## 11.11ae

Income & Expenses chart: added a note that shown incomes are after-tax (pre-tax figures are in Annual Details).

<a id="11.11ad"></a>

## 11.11ad

Added Spending to Annual Details to focus on spending.

<a id="11.1133"></a>

## 11.1133

**Architectural improvements**

, no features changed.

<a id="11.1125"></a>

## 11.1125

**IRMAA now respects Medicare age.**

- **Age-65 gate, per spouse.** The IRMAA surcharge is charged only for spouses who are 65+ (actually on Medicare) - a couple aged 61/59 no longer pays IRMAA no matter how large a Roth conversion is. With one spouse 65+ and one younger, only the older spouse's half is charged.

- **Tier display fix.** The IRMAA Tier column (and chart milestone) previously appeared one year before the surcharge was actually charged; both now use the same 2-year MAGI lookback as the dollar amount, and show -none- before age 65.

- **IRMAA Ceil strategies unlocked pre-63.** Before any spouse is 63 (the earliest year income can affect a premium, given the 2-year lookback), the IRMAA-tier conversion ceiling relaxes to the top of the federal bracket containing it - no more pointlessly capped conversions in your early 60s. Same for “Lesser of IRMAA or Bracket.”

- **Medicare Parts B+D base cost** now shown on charts and table for spouses 65+ - illustration only, not deducted from spendable.

- **Distinct chart colors.** IRMAA is now deep pink and Medicare teal on all charts (they previously shared nearly identical pinks); the IRMAA milestone marker matches the pink.

<a id="11.1119"></a>

## 11.1119

**State retirement-income taxes are now much more accurate.**

16 states (Alabama, Colorado, Connecticut, Georgia, Illinois, Iowa, Kentucky, Maine, Maryland, Michigan, Mississippi, New York, Ohio, Pennsylvania, Virginia, Wisconsin) now apply their real pension/IRA exemptions, caps, and credits instead of taxing all retirement income as ordinary income. Several states have limitations; limitations are listed below the state once it's selected. See, e.g., CA, MA, NC, SC, NE, AZ, and MT.

<a id="11.1102"></a>

## 11.1102

**State retirement-income exemptions (Illinois & Pennsylvania):**

IRA/401k/pension distributions are no longer taxed by states that exempt them. Illinois and Pennsylvania now correctly exempt these withdrawals (interest, dividends, and capital gains remain state-taxed). Other states are unchanged.

<a id="11.10ee"></a>

## 11.10ee

**Pension start age, optimizer symbol legend, and a Guyton-Klinger fix:**

- **Pension start age.** Model a pension that begins after you retire (e.g. retire at 60 while the pension starts at 65). Leave the start age at 0 to begin at retirement.

- **Optimizer symbol legend.** A new legend explains the symbols shown on strategy names (✓ ✦ ▼ 🗘 🔄 ⇌ ⚠️ 🟢 🚨 ⚓).

- **Guyton-Klinger sustainable-spend fix.** When no strategy can fund your spend goal, the suggested fallback spend no longer reports a Guyton-Klinger value that only “works” by cutting spending every year - and the suggested strategy is now clickable to load.

<a id="11.10cf"></a>

## 11.10cf

Numerous user experience improvements: IRA Draw strategies now tested to 20%, After-Tax-Spend searches higher spend rates and a suggested value is offered. Other changes include tooltip clarity improvements, chart improvements, and showing Charts first by default.

<a id="11.10a2"></a>

## 11.10a2

Added additional charts for clarity: Taxation, Income vs Net Income, Inflows vs Outflows, Earnings vs W/D.

<a id="11.1099"></a>

## 11.1099

**Baseline strategy is now ranked by total economic value, not terminal wealth alone.**

The pinned ⚓ baseline is the best no-conversion strategy. **Guyton-Klinger Optimize Spend no longer reports an unsustainable spend.** Optimize Spend now applies a stability floor and accepts a higher initial spend only if the guardrails never cut real delivered spending below one guard band of the initial.

<a id="11.1091"></a>

## 11.1091

>Fixed a NaN in a Monte Carlo.
   **Fixed a shortfall**. Fill strategies will exceed the threshold when needed to meet the spend goal.
However, the ACA Cliff ceiling is now its own strict strategy: it never breaches the cap. If spending can’t be met under the target the plan is flagged untenable (⚠️ in the Optimizer) rather than silently overspending.

<a id="11.1060"></a>

## 11.1060

**Stress mode now ranks worst decades by real inflation-adjusted Compound Annual Growth Rate (Real CAGR):**

real CAGR = (1 + equity) / (1 + inflation) − 1. High-inflation decades like the 1960s–70s stagflation, and the Lost Decade (1999-2010)  correctly rank as worse for retirees than a pure equity crash with near-zero inflation. Depression-era crashes also had high deflation which is now clamped to a minimum of -1% (rather than -9%).

<a id="11.1042"></a>

## 11.1042

**Guyton-Klinger Guardrails withdrawal strategy:**

- **Dynamic spending rules.** The Guyton-Klinger strategy adjusts annual spending based on portfolio withdrawal rate. It skips inflation adjustments when the prior year return was negative, and cuts spending 10% when the withdrawal rate exceeds the upper guardrail; raises spending 10% when withdrawal rate falls below the lower guardrail. Supports higher initial withdrawal rates (~5–5.5%) by absorbing sequence-of-returns risk through spending flexibility.

- **Four configurable parameters:** Upper/lower guardrail (default ±20% of IWR) and cut/raise percent (default 10%). Annual Details Income category shows gkSpend and gkAdj columns.

<a id="11.1001"></a>

## 11.1001

**Best "Baseline" is used for strategy comparison:**

- **Honest baseline.** The optimizer now also runs every strategy family with no Roth conversions and no cyclic brokerage maneuvering, no QCDs, and pins the strongest of those as a ⚓ BASELINE reference row at the top of the results. Every other strategy is measured against it - because "strategy A beats strategy B" only means something relative to the best you can do without conversion/brokerage tricks.

<a id="11.1048"></a>

## 11.1048

**Shorter share URLs:**

(up to 70% shorter); older/longer URLs should still load unchanged.

<a id="11.1019"></a>

## 11.1019

**Cyclic-brokerage drawdown fixed:**



<a id="11.1018"></a>

## 11.1018

**Δ columns honor Future/Current $; tax tooltips clarified:**

- **Cleaner table.** Infeasible (bracket-unreachable) rows are hidden by default - click the Infeasible legend to reveal or hide them. Failed plans always sort below successful ones. Every column header now has an explanatory tooltip.

<a id="11.fed"></a>

## 11.fed

**Charitable Giving (QCDs) & UX Improvements:**

- **Qualified Charitable Distributions (QCDs):** New Charitable Giving (QCD) section in the sidebar. Enter an annual household QCD maximum - the simulation transfers that amount directly from the larger eligible IRA to charity each year (age 70½+ per person). QCDs satisfy the RMD requirement without adding to taxable income, reducing IRMAA exposure.
Two modes: Always donates the full amount every eligible year; As Needed applies only enough to drop two IRMAA tiers (or escape the surcharge entirely, whichever requires fewer dollars). The per-person limit is $111,000 for 2026 (CPI-indexed annually per SECURE 2.0). QCDs appear as a gray bar in the Income & Expenses chart.

- **Dollar display toggle:** The Future $ / Current $ toggle has moved to the left of the tab bar (always visible). Future $ shows nominal amounts as they will actually appear; Current $ restates everything in today's purchasing power for easy year-to-year comparison.

- **Strategy panel switches:** Maximize Conversions (formerly "Max Conversion"), Cycle Brokerage (formerly "Cyclic"), Optimize Spend, and Optimize Conversions (formerly "Conv Optimizer") are now all in the strategy sidebar with labels to the right of each switch. Toggle labels are positioned so that the green (on) position visually aligns with the label.

<a id="11.ecc"></a>

## 11.ecc

**Withdrawal Rate:**

Corrected Portfolio Withdrawal percent calculations. Added netOutflow, grossOutflow and inFlow columns for summary information.

<a id="11.ecb"></a>

## 11.ecb

**Withdrawal Timing:**

Each simulation year now auto-selects Early (January) or Late (December) withdrawal timing. Conversion years use Early - maximizing Roth compounding duration. Spending-only years use Late - the full portfolio compounds before the withdrawal exits, gaining D×r per year (~$3,500/yr on a $50k draw at 7%). No manual toggle; the algorithm tracks prior-year conversion activity. A new Timing column in Annual Details shows Early(Conv) or Late(Spend) for each year.

<a id="11.eca"></a>

## 11.eca

**Bear-Start Overlay (Historical Monte Carlo):**

In Historical mode, the bottom 25% of paths begin with a randomly-sampled worst-decade historical sequence before continuing with random draws. The likelihood of a "Bear start" market is 23%, so this adds realistic sequence of return risks (SORR).

<a id="11.ec9"></a>

## 11.ec9

**Stress Mode:**

Monte Carlo "Stress (worst sequences)" runs the worst historical retirement-start sequences scored by first-decade real (inflation-adjusted) CAGR. Shows sequence-of-returns risk directly - each line is a real historical scenario. Chart labels show nominal equity CAGR, inflation CAGR, and real CAGR for each scenario. Clicking on a legend hides all other plots. Will your retirement withdrawal strategy survive the stagflation of the 1960s–70s? The tech bubble of 2000? This will tell you.

<a id="11.ec8"></a>

## 11.ec8

**State Bracket Inflation Fix:**

MT, ND, AL, OH, and SC have statutory fixed income tax brackets (they were being incorrectly inflated which would understate future state taxation). Other states are unaffected. Known limitation: the standard deduction for AL, OH, and MT is fixed by statute but is being adjusted - future fix to be provided.

<a id="11.ec7"></a>

## 11.ec7

**State Tax Expansion:**

Added AL, AZ, CO, IN, KY, MA, ME, MN, MT, ND, OH, SC, WI to the state income tax dropdown.  All states adjusted to latest available information.

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

<a id="11.e64"></a>

## 11.e64

**BETR (Break-Even Tax Rate):**

Annual Details now shows the break-even future tax rate for each year's Roth conversion.
Avg BETR summary stat shows the average across all conversion years. "Conv Optimizer" determines whether conversions realize any tax savings and are indicated with (⇌)
**Bug fix:** eliminated shortfalls in cases invoving brokerage withdrawals.

<a id="11.e52"></a>

## 11.e52

URL compression: all share URLs now use short parameter names (57% shorter). Share button opens a copyable popup panel on all tools matching Income Tax Planner style. Income Tax Planner gets an "Open in Tax Planner →" button that pre-fills Retirement Tax Planner with state, SS income, and capital gains. Backward compatible - existing long-key bookmarks still load.

<a id="11.e4f"></a>

## 11.e4f

User Experience polish throughout. Roth conversion & opportunity cost tracking calculates when conversions or cash withdrawals "pay off". Break Even at the top says when that year is. New Opp. Cost category and columns added to Annual Details. Future IRA Tax % marginal rate when IRA is eventually distributed; auto defaults the last simulation year marginal rate. Choose your heirs total tax rate.

<a id="11.e4a"></a>

## 11.e4a

Fixed start age bug (table now starts at retirement year on URL load). Updated withdrawal strategy descriptions in How To. Added color legend to Annual Details table.

<a id="11.e1a"></a>

## 11.e1a

New feature: view input distributions in Monte Carlo.

<a id="11.df0"></a>

## 11.df0

Monte Carlo uses historical inflation 1928–2024 and growth (based on S&P), that historical inflation also is used to escalate the spend-goal rather than using a fixed rate. Stats display CAGR (Compound Annual Growth Rate) instead of arithmetic median - e.g. the CAGR growth rate is the "true" rate where the median rate is the "middle" rate over the entire period. Example: -20% growth for 3 years, 10% growth for one year, then +20% growth for 3 years the CAGR is about -0.38%, but the median is 10%. CAGR gives you the real net growth.

<a id="11.dd9"></a>

## 11.dd9

Monte Carlo uses Historical data from real S&P 500, bond, and international returns (1970–2024). Account Composition shows Est.Rtn advisory column (median before inflation); Monte Carlo shows per-asset-class return ranges (Eq/Bonds/Intl).

<a id="11.dd6"></a>

## 11.dd6

Added ordered withdrawal strategy (CBIR/RIBC/BIRC). Fixed error where Spend Goal was inflated prematurely.Defaults bracket strategy changed to \`Below IRMAA\`. Fill provides feedback: ✓ or ⚠ status with max feasible spend estimate; clicking ⚠ sets After-Tax Spend to the bracket maximum and triggers recalculation.

<a id="11.dad"></a>

## 11.dad

Ages (current age and RMD start age, live-updating) added; optimizer always runs with Max Conversion on (it was almost always better); Strategy defaults were changed; other defaults changed, too.

<a id="11.da6"></a>

## 11.da6

Bug fixes: survivor SS benefit was ~2× correct (delayed credits were accruing past claiming age - fixed); dividends now correctly compound inside IRA and Roth accounts (previously only Brokerage received the dividend growth component). New feature: Retirement Start Age - enter the age you plan to retire; the simulation inflates brackets, SS COLA, and spend goal forward to that year automatically. Start age defaults to your current real-world age (birth-month aware). You may have retired already, but this tool starts where you are. Monte Carlo: click any result row to load that strategy. Annual Details: Roth1/Roth2 per-person balance columns now available under Roth Δ. Minor Version numbering changed: lowercase hex((day-of-year × 24) + hour).
