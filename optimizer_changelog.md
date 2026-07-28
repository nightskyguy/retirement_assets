# Retirement Optimizer: Detailed Change Log

Full write-ups of what changed in each release, newest first.

The Documentation tab inside [retirement_optimizer.html](retirement_optimizer.html) carries a short
summary of the five most recent releases and links here for the detail. Entries marked **behavior
change** alter the numbers an existing plan produces, so a saved scenario or a shared link can give a
different answer than it did before that release.

For what the tool does and how to use it, see [README.md](README.md).

---

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

The ⚖ control has its own column at the start of each row, and the outcome marker beside it is part
of the same control, with a gap separating both from the rest of the row. It began as a small glyph
inside the Strategy cell, where a near miss loaded that strategy into the sidebar instead: a
destructive, surprising result for a click aimed at a comparison. The highlighted ⚖ always marks
whichever row the columns are currently measured against, which is the ⚓ baseline until you pick
something else, so the table shows where the comparison point is from the moment it opens. Clicking
the highlighted one puts everything back, exactly like the Stop comparing button.

---

## 11.1387 (behavior change)

**Your own plan now appears in the Optimizer table, so you can compare it against every strategy it suggests.**

A pinned 📍 CURRENT row sits under the ⚓ baseline showing your sidebar settings run exactly as they are, including whether conversions are on, any Extra Annual Roth Conversion, and any stop year. That matters because every strategy the Optimizer sweeps is run with conversions turned on and your own conversion settings set aside, so until now nothing in the table was actually your plan, even when the strategy and its parameter matched. Your plan is also ranked with the others, so the Rank column tells you where it stands, and it can win a metric in the Best table if it genuinely beats everything else. The same 📍 marks the swept row that uses your strategy and parameter, which lets you see where your setting sits on that family's curve. If your parameter falls between the standard steps, for example a 7% proportional boost or an 18 year drawdown, that exact value is now swept as its own row instead of being skipped. The Break Even column is filled in for every strategy now, not just the ⇌ conversion rows, so sorting by it works and there is a new "⏱ Earliest Break Even" entry in the Best table: the strategy whose conversions pay for themselves soonest, with ties going to the one that leaves more after-tax wealth. Choosing "Earliest Break Even" under Optimize for now reorders the table, which it previously could not do because the column had no values to sort. Three fixes came out of the same work. Clicking an Ordered row now brings its account sequence with it instead of leaving whatever was in the sidebar. The Monte Carlo stress test now recognizes Guyton-Klinger and Ordered plans as your current strategy rather than falling back to a generic one. And the summary numbers at the top of the page, including Break Even, now refresh when you change a setting while the Optimizer tab is open: they used to keep showing the previous plan until you clicked over to Chart or Annual Details, which is what made a change like turning Maximize Conversions on look like it had no effect.

## 11.137f (behavior change)

**The suggested year to stop converting is now measured against the plan you would actually get.**

The tool decides whether to take money out of your accounts in January or in December based on whether that year makes a Roth conversion, because a conversion year is better done early. When the Break Even ⓘ searched for the best year to stop converting, it built each trial plan in a way that failed to set that switch, so every year it compared was run with December withdrawals even where conversions were happening. It also treated "convert nothing" as a January-withdrawal year, which no plan with no conversions would ever be. The result was a suggested stop year and dollar gain measured against plans that were not quite the ones you could load, and the two "stop scope" choices could report different gains for the very same cutoff. On a large-IRA example the gain compared with never converting was overstated by about $8,900, and the two scopes disagreed by about $2,200 on a cutoff where they should have matched. All of that now lines up: click the suggested year and the plan you get is the plan that was scored. A stop year set at or before the first year of the plan is also now correctly treated as converting nothing. Plans with no stop year, including the whole strategy table, Monte Carlo and Annual Details, are unchanged to the dollar.

## 11.1370 (behavior change)

**When converting more does not help, the Optimizer now tells you what would have to be true for it to help, and it can find conversions it used to miss.**

Optimize Conversions previously reported only that none of the strategies it examined improved by converting more, which is accurate but a dead end. It now names the future tax rate your plan is assuming, and a link works out the lowest future tax rate at which converting would start to pay, along with the amount and the gain at that rate. If no plausible rate makes conversions worthwhile, it says so plainly, because that is a real answer about your plan rather than a missing one. Separately, the search itself was too narrow: it only ever tested converting the same amount every year for the rest of the plan, so a plan that should convert heavily for a few years and then stop could only be told to convert nothing. When a flat conversion does not help, the Optimizer now also tries converting for a limited number of years, and any plan it finds this way appears as a ⇌ row tagged with the year conversions stop (⏹). Clicking it fills in both the amount and the stop year. This changes which conversion rows appear and the amounts they suggest. Two columns also changed: the Avg BETR column and its summary-bar tile were removed, because testing showed the Break-Even Tax Rate is not reliable enough to decide anything (it is still available per year in Annual Details), and "Conv Savings" is now called "Tax Paid Δ", since it only counts tax paid during the plan and can look positive on a plan that ends up worse off. Break Even remains the column to trust.

## 11.1340 (behavior change)

**Cash Reserve now controls what happens to money you withdraw beyond your spending needs.**

Most retirees with a large IRA are forced to take out more than they spend once required distributions begin. Until now the tool left all of that surplus sitting in cash, earning only the cash yield, for the rest of the plan. That understated how well a plan does when those extra dollars are reinvested, and it quietly tilted the Roth conversion comparison in favor of converting. The Cash Reserve field now decides where the surplus goes. Leave it blank (or enter -1) to keep the original behavior: all surplus stays in cash. Enter 0 to reinvest every surplus dollar into your Brokerage account, where it grows at the market rate. Enter a dollar amount to keep that much as a cash cushion, in today's dollars, and reinvest only the surplus above it; spending will not draw the cushion down unless every other account is exhausted. If you load a saved plan or a shared link that already sets a Cash Reserve, a note reminds you that results now differ from older versions and that blank or -1 restores the old behavior. This one setting can meaningfully change Break Even, the suggested year to stop converting, and the final balances, so it is worth trying both ways.

## 11.1330

**The Break Even note now tells you the best year to stop converting, and offers one click to do it.**

When your plan makes Roth conversions, the ⓘ next to Break Even now names the year that leaves you with the most after-tax wealth if you stop converting after it, along with how much more that keeps than converting all the way through, and how much more than never converting at all. This replaces the older note, which pointed at the year conversions first turned unprofitable; that year is usually not the best place to stop, because it ignores how much a plan can still gain by stopping earlier. The point is that converting past a certain year can leave you worse off than never converting, since the tax paid on a late conversion no longer earns its keep before the plan ends. Click the suggested year to fill in a new "Stop conversions after" control and re-run: enter a calendar year like 2031, or your own age like 71, and conversions run through that point and then stop. You can choose whether stopping applies to all conversions or only the Extra Annual Roth Conversion; stopping all of them is the stronger lever. Spending is unchanged by where you stop, so this is a pure comparison of what your heirs receive after tax.

## 11.12fd

**The charts now mark the year each person's RMDs begin.**

Two new dashed lines, "Your RMDs begin" and "Spouse RMDs begin", join the existing markers on both charts, and because the date depends only on a birth year they also appear on the Monte Carlo chart. The line is drawn for the year you reach your RMD age (73 or 75, depending on when you were born), and only when that birthday falls inside the plan, so a plan that starts after your RMDs have already begun does not get a line. It is drawn whether or not there is anything left in the IRA to withdraw, since the date itself is worth seeing. The "Show milestones" tooltip now lists every marker the charts can draw, which it had stopped doing some versions ago.

## 11.12fb

**The Withdrawal Rate stat was reading far too low and has been corrected.**

It now measures what it says: the money actually pulled out of your accounts to pay for spending and taxes, divided by what the portfolio was worth at the start of that year. Three things were wrong before. Social Security and pension income were being subtracted from the withdrawals, so a plan drawing $164,000 against $81,000 of Social Security was reported as if it had withdrawn only $19,000. The bottom of the fraction used an after-tax estimate of your wealth rather than the actual account balances, and the very first year used a different basis than every year after it. On a typical plan the stat moves from about 1.1% to about 2.4%, which is now directly comparable to the classic 4% rule and to the guardrail rate the Guyton-Klinger strategy uses internally. The tile is relabeled simply "Withdrawal Rate", and hovering it shows two extra views: a dollar-weighted average, and a net depletion figure that goes negative when your portfolio is growing faster than you draw it down. The rate itself can no longer go negative, because you cannot withdraw less than nothing. A related fix: in years when Social Security covers everything, a required distribution that gets reinvested is no longer counted as a withdrawal, since those dollars never left the portfolio. Also in the header, the summary stats are left-aligned on wide screens instead of being pushed to the right edge, and the "what you last changed" note moved to sit after the numbers alongside the save and load messages.
