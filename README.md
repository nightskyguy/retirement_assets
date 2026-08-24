# Retirement Planning Tools

> [!WARNING]
> **Disclaimer:** There is no SUPPORT for these tools and no guarantee of accuracy, or appropriateness of use. No warranty of suitability for any purpose. There is also *no charge*. **USE AT YOUR OWN RISK**

## Who Are These Tools For?  What Can They Do? 

You can DIRECTLY invoke these tools:

+ **[Retirement Optimizer](https://tools.netcitizen.us/retirement_optimizer.html)**  A full tool, with optimizers!  This is the original, and most featured tool.
+ **[Historical Real Returns](https://tools.netcitizen.us/standalone/RealReturns.html)** How did stocks, bonds, and T-bills really perform after inflation? 98 years of data (1928–2025) with a custom allocation mix.
+ **[Income Tax Planner](https://tools.netcitizen.us/standalone/IncomeTaxPlanner.html)** What does taxation look like at different ordinary income levels (includes many states)
+ **[Retirement Tax Planner](https://tools.netcitizen.us/RetirementTaxPlanner.html)** Compares 3 ways to pay taxes in retirement - provides reminders. Retirement Optimizer calls it.
+ **[Retirement Projection](https://tools.netcitizen.us/Retirement_Projection.html)**  What will my retirement assets do? It's very VISUAL but not as rich as Retirement Optimizer.
+ **[IRMAA and Medicare Future costs](https://tools.netcitizen.us/standalone/FutureCost.html)** Will IRMAA kill me?
+ **[IRMAA and RMDs](https://tools.netcitizen.us/standalone/irmaa_and_rmds.html)** What IRA balance will cause me to have to pay IRMAA penalties at a given age?
+ **[After Tax REAL Growth](https://tools.netcitizen.us/standalone/AfterTaxRealGrowth.html)**  What growth rate do I need to stay ahead of inflation?
+ **[HYSA Real Returns](https://tools.netcitizen.us/standalone/HYSA.html)** Does my "safe" high-yield savings account actually grow after taxes and inflation? Annual and cumulative views in one tool.

All tools are "open source". Nothing is hidden.

A California resident built these with [Google gemini](https://gemini.google.com), [claude.ai](https://claude.ai) and [ChatGPT](https://chatgpt.com) AI assistance. The author is a retired software engineer and spreadsheet twiddler, with a strong knowledge of Python and JavaScript. See **Standalone Tools** and **Key Features** below for a summary of what the tools can do - and be sure to look at *What the Tool IGNOREs* (and *Known Bugs*, below) so you understand the limitations of the *Retirement Optimizer*.

## Table of Contents

- [Who Are These Tools For? What Can They Do?](#who-are-these-tools-for--what-can-they-do)
- [Standalone Calculator Tools](#standalone-calculator-tools)
  - [Historical Real Returns](#historical-real-returns)
  - [Future Cost](#future-cost)
  - [IRMAA and RMDs](#irmaa-and-rmds)
  - [After Tax Real Growth](#after-tax-real-growth)
  - [Income Tax Planner](#income-tax-planner)
  - [Retirement Tax Planner](#retirement-tax-planner)
  - [High Yield Savings Accounts Real Returns](#high-yield-savings-accounts-real-returns)
  - [Retirement Projection](#retirement-projection)
- [The Retirement Optimizer](#the-retirement-optimizer)
  - [Features in the Works (and Known Bugs)](#features-in-the-works-and-known-bugs)
    - [Recent Fixes / Improvements](#recent-fixes--improvements)
  - [Why This Tool?](#why-this-tool)
  - [Key Features](#key-features)
  - [What the Tool IGNORES](#what-the-tool-ignores-no-plans-to-implement)
  - [Limitations and Restrictions](#limitations-and-restrictions)
- [What about Other Tools](#what-about-other-tools)
  - [Free Tools](#free-tools)
    - [NestWise](#nestwise)
    - [Visual Federal Tax Tool](#visual-federal-tax-tool)
    - [AARP Federal Tax Calculator](#aarp-federal-tax-calculator)
    - [Retirement Figures](#retirement-figures)
    - [TaxVantage](#taxvantage) (free for now)
    - [Google Sheet by Redditor](#google-sheet-by-redditor)
    - [Roth Helper](#roth-helper)
    - [AiRA Retirement Application](#aira-retirement-application)
  - [Paid Tools](#paid-tools) - Commercial
    - [ThunderHarbor.net by yanyan80](#thunderharbornet-by-yanyan80)
    - [Boldin](#boldin) - Probably the leading tool
    - [MaxiFi](#maxifi) - Lesser known tool
    - [Projection Lab](#projection-lab) - Best of Breed?!
    - [Roth Done Right (Stonewood)](#roth-done-right-stonewood)
    - [Others](#others)
      - [Number Crunch Nerds](#number-crunch-nerds) (spreadsheets)
      - [RetirementIQ](#retirementiq) 
      - [Retirement Scenarios](#retirement-scenarios) 
      - [CliffEdge App](#cliffedge-app) 
- [Ramblings and Observations](#ramblings-and-observations)
  - [References and Useful Resources](#references-and-useful-resources)
    - [YouTube Sources](#youtube-sources)
    - [Papers by Edward McQuarrie](#papers-by-edward-mcquarrie)
    - [Miscellaneous](#miscellaneous)
  - [Some of the Things I Learned About Taxation](#some-of-the-things-i-learned-about-taxation)
    - [Late Payment Penalties](#late-payment-penalties)
      - [End of Year vs Quarterly Tax Payments](#why-end-of-year-vs-quarterly)
      - [Roth Conversion Withholding and Replacement](#roth-conversion-tax-withholding-and-repayment)
      - [Reconciling IRS Forms/Custodian Notes](#reconciliation-and-notes)
    - [Moldy Brackets](#moldy-brackets)
    - [IRMAA Escalation](#irmaa-escalation)
    - [The Tax Torpedo](#the-tax-torpedo)
      - [State Tax Rates on Social Security Income by Federal Bracket Level (2026)](#state-tax-rates-on-social-security-income-by-federal-bracket-level-2026)
      - [Combined Tax Torpedo Examples](#combined-tax-torpedo-examples-during-85-ss-phase-out)
    - [No "Long Term Capital Gains" in most states](#no-long-term-capital-gains-in-most-states)
    - [Roth Conversion Gotchas](#roth-conversion-gotchas)
    - [How Reliable Is the Break-Even Tax Rate?](#how-reliable-is-the-break-even-tax-rate)
- [Frequently Asked Questions](#frequently-asked-questions)
  - [Is It a Fool's Errand to Make Multi-Decade Projections?](#is-it-a-fools-errand-to-make-multi-decade-projections)
  - [How does Cash Reserve work with dividends?](#how-does-cash-reserve-work-with-dividends)
  - [When might Cash Reserve be depleted?](#when-might-cash-reserve-be-depleted)
  - [Where is cash interest routed?](#where-is-cash-interest-routed)
  - [Does the brokerage account for "cash"?](#does-the-brokerage-account-for-cash)
  - [How do I find the most efficient Roth conversions?](#how-do-i-find-the-most-efficient-roth-conversions)
  - [Why does the Optimizer say converting never helps?](#why-does-the-optimizer-say-converting-never-helps)
  - [What about Doing all Conversions rather than withdrawals?](#what-about-doing-all-conversions-rather-than-withdrawals)
  - [Is the Break-Even Tax Rate Trustworthy?](#is-the-break-even-tax-rate-trustworthy)
  - [Stress Test vs Monte Carlo Analysis](#stress-test-vs-monte-carlo-analysis)
  - [How Do I Evaluate Tools for Privacy and Security?](#how-do-i-evaluate-tools-for-privacy-and-security)
  - [What Should I Look for in Retirement Tools?](#what-should-i-look-for-in-retirement-tools)
  	- [Monte Carlo and Chance of Success - How accurate?](#monte-carlo-and-chance-of-success-accuracy)

--- 

First, **NOTE this** I use the term "**IRA**" for any account that is "Pre-Tax". And "**Roth**" for any tax free account.  **IRA** in this context could be any number of actual account types: IRA, Traditional IRA, Solo IRA, SEP-IRA, Simple IRA, 401(k), 403(b), 457(b), Keogh plans, and probably more. Some literature uses the acronym TDA for Tax Deferred Accounts.  **Roth** includes Roth IRA, IRA 401(k), HSA, TFRAs. HSAs are a bit of a different animal, actually.

Trivia for fun: _IRA_ stands for "Individual Retirement *ARRANGEMENT*", not account. Yeah, weird. And it's not ROTH but Roth. It's named after Senator William *Roth* who introduced it.  Oh, and the "(k)" in 401(k) does NOT refer to Eugene Keogh, it's a reference to the Internal Revenue Code. 

[![github logo](./github_black_green_50x.png)](https://github.com/nightskyguy/retirement_assets) You can inspect or [download the files](https://github.com/nightskyguy/retirement_assets) and run the tool(s) in about any browser (Brave and Chrome have been tested). You must have internet access for the fonts and charts to work properly because those are downloaded from public sources.

Or you can directly run the tools from _tools.netcitizen.us_ 

---

## Standalone Calculator Tools

Here are less ambitious, standalone tools. Each should have a "How to Use" set of instructions, many have a way to generate a URL (called share) to capture your settings so you can either run again without reentering, or share with friends (or Redditors) for advice.

These tools are all being actively developed and improved. Each tool runs standalone in your browser - though most load additional local resources (e.g. they share the same **taxengine.js**). An internet connection is needed to load fonts and the tool for graphing charts. Basic, anonymous page-load analytics are collected (Google Analytics and Cloudflare Web Analytics) solely to understand how often the tools are used and from what general region - no personally identifiable information is collected, stored, or transmitted. General region information helps prioritize which state tax rules to add in future releases. You are welcome to see for yourself by inspecting the [source code](https://github.com/nightskyguy/retirement_assets).

### Historical Real Returns
**[Historical Real Returns](standalone/RealReturns.html) - Inflation-Adjusted Cumulative Growth of $10,000 (1928–2025)**
Plots the real (inflation-adjusted) cumulative growth of $10,000 in US equity (S&P 500 proxy), US bonds (10-yr Treasury), and T-bills across 98 years of history, alongside a custom allocation mix (equity/bond/cash sliders) and an uninvested cash reference line showing the full purchasing-power loss from holding dollars with no return. A "Market Returns" overlay adds nominal (pre-inflation) companion lines in darker colors to make the inflation drag viscerally visible. Clicking any legend asset isolates that real + nominal pair. Log/linear scale toggle; shareable URLs encode start year, allocation, and scale.

### Future Cost
**[FutureCost.html](standalone/FutureCost.html) - Present Value of Growing Payments**
Answers the question: how much money must be set aside today - and left to grow - to fund a stream of payments that increase faster than inflation? The primary use case is Medicare IRMAA surcharges: because IRMAA penalties are paid from pre-tax IRA/401k withdrawals, the tool tracks federal and state marginal tax rates separately and grosses up every payment to reflect the actual account draw required. Sliders control the annual penalty, planning horizon, CPI inflation, extra growth above inflation (Medicare premiums have historically risen 2–4% above CPI), portfolio return rate, and income (MAGI). Four result metrics - funds to allocate now, year-1 pre-tax draw, final-year pre-tax draw, and total real cost in today's dollars - plus a year-by-year chart of the payment as a percentage of income make the central point viscerally clear: those "small potatoes" grow in real purchasing-power terms every single year.

### IRMAA and RMDs
**[IRMAA and RMDs](https://tools.netcitizen.us/standalone/irmaa_and_rmds.html) - What balances get me in trouble with IRMAA**
Given entered fixed income, calculate what size IRA balance will cause RMDs that hit IRMAA tiers at various ages.  The tool uses current rates and does not attempt to adjust for inflation.  For example a married couple with a $16,607,550 balance at age **73** together with $130,000 income (pensions/social security/etc) will hit the highest IRMAA Tier 5 due to $626,700 of forced RMD. Yeah, that is clearly not most of us. But at age **80** a $2,882,540 IRA balance together with that same income will hit **Tier 2** $5.2K annual charge because that balance at that age forces a $142,000 RMD.  A balance of $1,286,740 for a single 80 year old lands in **Tier 4** with a $5.7k annual charge.  At 75 that same single person would be in Tier 4 with a 1.5M IRA balance.  The Retirement Optimizer will suggest a target (combined) IRA balance that minimizes IRMAA jeopardy.

### After Tax Real Growth
**[AfterTaxRealGrowth.html](standalone/AfterTaxRealGrowth.html) - After-Tax Real Growth Rate**
Did you know that your 2.5% interest bearing savings account LOSES money even if inflation is LESS than 2.5%?  I suspected that, but this tool will show you the real answer - and surprise, it matters what your tax bracket is!

Visualize how inflation and taxation combine to erode nominal investment returns. Set an inflation rate and your portfolio's nominal return, and the tool plots the real after-tax return across six federal tax brackets (0%, 12%, 22%, 24%, 32%, 37%), with the 24% bracket highlighted as the typical IRMAA Tier 1 landing zone. A dashed break-even line at 0% real return makes immediately visible that a 2.50% nominal return at 2.50% inflation and 25% tax is not a wash - it is a net loss of purchasing power (~0.61%/year). Each bracket card shows your real return at the current portfolio return alongside the minimum nominal return needed to merely preserve purchasing power at that bracket and inflation rate. Useful for stress-testing conservative accounts (CDs, money markets, bond funds) where the real return is easily negative without realizing it.

### Income Tax Planner
**[IncomeTaxPlanner.html](standalone/IncomeTaxPlanner.html) - Federal + State Tax Sweep with IRMAA & Capital Gains**
Sweeps ordinary income from $0 to $1.1M in $10k steps and plots your true all-in effective tax rate - federal, state, and IRMAA combined - with a marginal rate curve that makes the Social Security torpedo, IRMAA tier crossings, and NIIT threshold immediately visible. Configure filing status, state (38 choices: 29 taxing jurisdictions including DC, plus the 9 states with no income tax - the list is generated from the shared tax engine, so it grows whenever a state is added there), taxpayer ages, fixed Social Security income, capital gains proceeds and basis, a target year 2026–2035 with configurable CPI, and OBBBA provisions (senior deduction, elevated SALT cap). Two linked charts update instantly on any control change, and hovering over either chart activates the corresponding tooltip on the other at the same income level.

Uses 2026 IRS Rev. Proc. 2025-32 federal brackets inflated forward by your chosen CPI rate; IRMAA premiums grow at that rate plus a configurable Medicare-specific increment. Designed to answer four questions: *How sensitive is my tax burden to a $10k income change? Where are my sweet spots and danger zones (SS torpedo, IRMAA cliffs, NIIT)? What is my real all-in effective rate? What withholding should I target?* The Share button encodes all settings into a compact URL that works from a local file or a web server - save it as a bookmark or paste it into a discussion to let someone else replicate your exact scenario.

### Retirement Tax Planner
**[Retirement Tax Planner](https://tools.netcitizen.us/RetirementTaxPlanner.html) - Compares 3 Ways to Pay Taxes in Retirement**
Given a year's withdrawal/conversion numbers, compares three ways to actually pay the resulting tax bill: withhold from the distribution itself, pay quarterly estimates, or a mix of both - and reminds you of the Safe Harbor and underpayment-penalty rules that make the "when" of tax payment its own decision, separate from the "how much." The Retirement Optimizer's Annual Details table links directly into this tool: click a year (or the `totalTax` column) and it opens pre-filled with that year's real numbers so you can see which payment plan is most effective for that specific year.

**Version 1.13c3.** The Compute button now follows you down the page instead of hiding at the bottom of a long form, and the long boilerplate that used to repeat six or twelve times per run has moved into the "Rules and sources" panel with a short pointer left inline. When the Retirement Optimizer hands a year over, it now also passes that year's brokerage position, so the planner prices selling shares to pay the bill instead of assuming there is nothing there.

Earlier in the same cycle: fixed a long-standing bug where a small conversion could be told to withhold far more than it contained (a $5,000 conversion showed $24,851 federal, 497%). Withholding comes out of the distribution, so it is now capped at the conversion, and whatever the conversion cannot absorb becomes quarterly estimates. The replacement step now also shows what replacing the cash sooner is worth, since the 45-day target is a safety buffer rather than a goal. The 60-day cash replacement after a Roth conversion is not limited to once per 12 months. The IRS excludes conversions from that limit, so it is repeatable per conversion, and the tool no longer warns otherwise. Also this cycle: a December conversion now withholds when that is what keeps you in Safe Harbor, the dollar gain from replacing is computed correctly (it was overstated by 20% to 50%), and every rule the planner applies now cites its IRS or statutory source in a "Rules and sources" panel. Scheduled dates now avoid weekends, New Year's Day, and Christmas Day (a future tax year used to put the draw on January 1), and estimated-tax deadlines shift to the next business day per IRC 7503.

### High Yield Savings Accounts Real Returns
**[HYSA Real Returns](standalone/HYSA.html) - Annual and Cumulative Real Value of a High-Yield Savings Account**
Two views in one tool. The **Annual** tab shows year-by-year after-tax interest and inflation erosion as stacked bars with a net real return line - making visible how often a "safe" savings account actually loses purchasing power. The **Cumulative** tab computes the real value of $10,000 compounding from a chosen start year, with three lines: Roth / 0%-tax, a custom tax-rate slider, and uninvested cash eroded by inflation alone. Rates are 80th-percentile competitive HYSA estimates (FDIC national rate data, Fed funds rate history, Bankrate benchmarks); inflation is BLS CPI-U.

### Retirement Projection
**[Retirement Projection](Retirement_Projection.html) - How might *most* of your retirement assets fare during your lifetime.**
Retirement Projection is visually richer tool than the [Retirement Optimizer](https://tools.netcitizen.us/retirement_optimizer.html), but it's less featured. Various Reddit and YouTube discussions do a lot of handwaving about IRA/401K balances. What this tool does is allow you to set your current age, current account balances, growth and inflation, filing status, and withdrawal rate.  It then calculates the account balances and RMDs (once they kick in).  

Retirement Projection includes Federal and **state** taxation - in fact, it shares the taxengine.js. As such it has a fairly rigorous tax calculator. Like the Optimizer, it models TWO IRA accounts, one Brokerage account, one cash account, and ONE Roth account.
Why only one Roth? Because Roth accounts are "interchangeable" tax wise, so if you already have balances in multiple Roth's just sum them.
Ditto with Brokerage and cash accounts. In fact, perhaps the two most difficult problems (which it would be nice to have a solution for) are determining what a "correct" dividend and "growth" rate are.

Like the "Retirement Optimizer" you cannot specify different growth rates for Brokerage, IRA/401k or Roth accounts. There are several reasons why, not the least of which is that you can make an IRA better than a Roth by significantly increasing it's dividend or growth rate - but then you're not comparing the value of the account taxation consequences as much as the difference in growth rates.

In real life, yes you are very likely to put your Bonds, TIPS, and Money Market funds in your IRA when you move your faster growing assets to your Roth - to take advantage of the magic of compounding tax free.  And if you have a choice, your high dividend, and high interest assets are better placed in a Roth where the tax moth won't feed.

There is no provision for adding lumpy withdrawals, but there is a way to apply a "spending smile" curve to withdrawals.

## The Retirement Optimizer

This is the original tool. It's definitely not for everyone. There is no "accumulation phase". The focus is managing withdrawals from your accounts. But it has something I haven't found in any tool: a withdrawal strategy optimizer - and a Monte Carlo stress-test tab to show you how your plan holds up across hundreds of simulated market scenarios. Monte Carlo is familiar - it's used as the "Chance of Success" in quite a few tools, but it's done here a bit differently.

I think retirement is like [going to the moon](https://engineering.mit.edu/ask-an-engineer/how-were-we-able-to-navigate-from-the-earth-to-the-moon-with-such-precision). There are lots of critical calculations, lots of variables, lots of complexity, and lots of ways to fail. For the moon launch, add too much thrust at the wrong time and you miss the moon, land in a crater or crash.  Get the angle of reentry into the earth's atmosphere wrong and the spacecraft bounces off into space or burns up. Fortunately in retirement miscalculation has far less deadly consequences than a moon mission, but many more speed bumps and potholes.  Purists will rightly point out that there are a LOT of unknowns: market returns, inflation, spending, taxation and taxation changes. As one CFP put it: "It's a tower of guesses". The longer range the projection, the more likely the guesses are to be wrong. BUT failing to try to plan, is in-my-opinion itself a failure. Moreover taxation is the one thing that only changes at the speed of congress - which means years in the same direction is likely. The market and inflation, of course behave like petulant children and are truly unknowable.
Further musings on the subject are located in [Is It a Fool's Errand to Make Multi-Decade Projections?](#is-it-a-fools-errand-to-make-multi-decade-projections), in the [FAQ](#frequently-asked-questions), below.

My primary motivations for this tool are: 
+ What does the withdrawal phase look like?
+ What happens to my assets over time? 
+ Am I in RMD jeopardy? E.g. Will I experience tax bracket escalation?  
+ What withdrawal strateg(ies) result in: the lowest taxation, the highest ending wealth, and my favorite: the most **lifetime spending**.
+ Is it really true that *heavy* Roth conversions, **no Roth conversions**, or "*some*" Roth conversions are BETTER? (Setting aside some of the significant advantages of Roth)
+ How painful is the so-called widow's penalty, really?
+ How different might things look for me if I move to another state?
+ How much should I withdraw, convert or sell from each of my accounts to stay on track, and what will the tax consequences be?

> [!WARNING]
> This is a work in progress. It may contain flaws beyond the presumption of the future being similar to the present. Use at your own risk. Consult a CFP and/or tax attorney before you make life-changing decisions.

### Features in the Works (and Known Bugs):

I use AI to keep track of and categorize possible future enhancements. You can read the [CURRENT PLANS](https://github.com/nightskyguy/retirement_assets/blob/main/.planning/retirement-optimizer/task_plan.md) to see the nitty-gritty, up-to-date details. Do note that the ordering in PLANS does not reflect my view of priority. You can also peruse the [findings](https://github.com/nightskyguy/retirement_assets/blob/main/.planning/retirement-optimizer/findings.md) and [progress](https://github.com/nightskyguy/retirement_assets/blob/main/.planning/retirement-optimizer/progress.md) files to get insights into what has been done. Or you can check below which may not be up-to-date. I make weekly and sometimes daily changes.

+ Better organize the Annual Details tables. There are just too many columns to easily navigate.
+ Allow exporting of the Annual Details table(s). 
+ **State standard deduction accuracy:** States that use the Federal standard deduction (AZ, CO, IA, ME, MN, MS, ND, SC) now reference it directly so the deduction updates automatically when the Federal value changes. States with *fixed* standard deductions that are **not** indexed to inflation (AL, MT, OH) are incorrectly inflated by the engine each year - this overstates the deduction and slightly understates future taxes for those state residents. A future fix will properly handle those (and any future similar) states.

#### Recent Fixes / Improvements
+ **The synthetic Monte Carlo now models inflation as something that varies, and offers a second synthetic model.** Inflation used to be a single rate repeated every year, which is the assumption most tools make and the one I think is least defensible - a plan is broken by prices running away for a stretch, not by an average. Each path now draws its own inflation, tuned to US consumer price data for 1948 to 2025, clustering the way the record does and leaning high in years when returns are poor. The new **Synthetic - AAM** model reads the growth rate you type as a plain yearly average, so the median it reports is the number you entered rather than one about a point lower; **Synthetic - GBM** is the model that was always there, with its market draws unchanged. Both draw the same shocks from the same seed, so switching compares the models rather than two different runs. A **Fixed Inflation** button pins inflation back to your Assumptions rate and reproduces the older model exactly.
+ The Optimizer tab has been reorganized. Labels, column names, colors and symbols are now consistent with the rest of the tool, and the table shows the columns the **"Optimize for"** goal actually uses instead of all twenty-one at once. Some were never shown at all, so **Final Roth**, **Final IRA** and **Mix Spread** now exist. Optimize for also says in one line what the goal ranks by, and a switch below it shows every column. **Spend Goal** and **Yrs Funded** moved into the row pop-up, and the legend folds out of the way. The saved-scenario list drops its Version column, and a `?tab=` web address opens the page on a chosen tab (`?tab=optimizer`, `?tab=annual`, `?tab=charts`, `?tab=montecarlo`, `?tab=importexport`, `?tab=documentation`). No numbers change.
+ Any two strategies in the Optimizer table can now be compared head to head. The two Δ columns have always measured every strategy against the ⚓ baseline, which answers "is this better than doing nothing clever" but not "is this better than *that* one". Every row now carries a **⚖** button; click it and both Δ columns are re-measured against that row, and the headings say "vs ⚖" so the change in meaning is never silent. Click it again, or use the button in the note above the table, to go back to the baseline. The choice survives a re-run. Clicking ⚖ does not load the strategy into the sidebar - clicking anywhere else on the row still does.
+ Your own plan is now placed in the Optimizer table rather than left for you to find. Two pinned rows read **⚓ BASELINE** and **📍 CURRENT**, and a **Rank** column, shown under every goal, tells you where your plan lands among all the strategies swept, under whichever goal you picked in "Optimize for".
+ A **Stress Test** result now appears in the summary bar at the top of every tab, reading for example "7 of 10 fail" - your plan running out of money in 7 of the 10 harshest return periods in the historical record, with the median year of depletion in the tooltip. These sequences are deliberately the worst on record, so this is a durability test and not a forecast. It is cheap enough to recompute on every input change, which makes it the one Monte Carlo figure that is always current, and it now runs in Synthetic mode too (there is still a real historical record to stress against, whatever you chose for the projection).
+ Social Security is now counted from your birth month. Previously someone claiming at 70 collected a full twelve months in the year they turned 70, whichever month their birthday fell in. The claim year now pays from the birth month onward, so a June birthday collects six months. The birth month defaults to December, which means no benefit at all in the claim year - if that is not your birthday, set it under Profile. The year a spouse dies works the same way: months before the death pay both benefits, months after pay the survivor benefit.
+ Survivor benefits now use the deceased spouse's real Full Retirement Age instead of assuming 67 for everyone. FRA is 66 for anyone born 1943 to 1954 and rises two months per birth year through 1959, so the old assumption paid survivors more than they were actually due. Plans where both people were born in 1960 or later are unchanged to the dollar.
+ Cash Reserve has been implemented. Specifying a cash reserve attempts to keep that much cash on hand. The reserves are built from interest and dividends, and only spent if there is no other way to meet annual spending goals.  See the [Cash Reserve handling](#where-is-cash-interest-routed) and related topics in the [FAQ](#frequently-asked-questions).
+ Great strides have been made in improving the ability to find Break Even Roth conversion strategies. One significant finding is that the BETR (Break Even Tax Rate) proffered by Vanguard has been [proved unreliable](#how-reliable-is-the-break-even-tax-rate) in my modeling. BETR calculations are still provided per year in Annual Details, but they no longer take up space in the summary bar or the Optimizer table.
+ When the Optimizer finds no worthwhile Roth conversion, it now tells you what would have to change instead of stopping at "nothing helps". It names the future tax rate your plan assumes and can work out the lowest rate at which converting would start to pay. See [Why does the Optimizer say converting never helps?](#why-does-the-optimizer-say-converting-never-helps) in the FAQ.
+ The Optimizer can now suggest converting for a limited number of years and then stopping. It previously only ever tested converting the same amount every year for the rest of the plan, so plans that should convert heavily early and then stop were told to convert nothing at all.
+ The Optimizer's "Conv Savings" column is now called "Tax Paid Δ" (and, as of 11.1601, "Conv Tax"), because it only counts tax paid during the plan and can look positive on a plan that ends up worse off overall. Break Even remains the column to trust.
+ An arithmetic bug was understating the asset withdrawal rate.
+ Tax creep (rising future tax rates) is in the Assumptions section as "Fed Tax Creep %/yr", with "Creep Starts" beside it. It raises the federal ordinary-income bracket rates a little each year so you can stress-test a higher-tax future. Bracket thresholds still track CPI, and state tax, capital gains, NIIT and IRMAA are unaffected. It defaults to 0, which keeps today's rates for the whole plan.
+ RMD milestone markers now show up on the charts, so you can see at a glance which year RMDs kick in.
+ Lots of chart improvements were made - additional charts, highlighting of specific categories.
+ Improved usability on small devices by allowing the "Tooltips" that are visible in a large browser to be clickable. (Most headers and titles have tooltips).
+ State tax rates have been updated to 2026 - and more states are included.  Some - especially those with odd taxation are still not present.
+ Properly handles Social Security Survivor benefits.  (See [Limitations and Restrictions](#limitations-and-restrictions))
+ You can reinvest Dividends, or collect them into your cash account.
+ Optimizer highlights the "best" withdrawal strategy in each category, including the results of Spend Goal optimization. Just click the entry in the table, and it loads that scenario.
+ Augmented the "Proportional Withdraw" with a "+%" option. This proved very helpful! It allows you to withdraw a percentage more than your needs - often to build up cash, or to do Roth conversion. Turns out to be an effective way to keep your IRA balance from growing unbounded. I got this idea from [Ben Brandt of "Even Better Retirement" on YouTube](https://www.youtube.com/watch?v=wptEu1Sb3Bk)
+ **Spending is funded from the IRA rather than left short.** A high After-Tax Spend goal could leave a large unfunded shortfall even with a multi-million-dollar IRA - most often after a spouse's death collapsed the tax brackets from joint to single. Once Cash, Brokerage and Roth are exhausted, the tool now draws the extra IRA needed to fund mandatory spending, shown in a `ForcedIRA` column. For **Fill Bracket** and **IRMAA Tier** that draw goes *above* the chosen ceiling, which is what makes those ceilings "soft" (the year's bracket overage is shown alongside). **Two strategies deliberately do not do this**, and for them a shortfall is the intended answer rather than a failure: **ACA Cliff** while its cap is in force never breaches the FPL cap, because crossing it would forfeit the whole premium subsidy; and **Ordered** will not step outside the account sequence you chose. Everywhere else, a shortfall means the plan genuinely ran out of money.
+ **Dividends and interest were counted twice, and ending balances were too high as a result.** The same dollar was added to your account *and* treated as income available to spend, so the tool withdrew that much less to cover your spending while the money stayed put. Nothing ever took it back out. A cash account earning 3% grew closer to 6%. The check that shows it: a portfolio returning 8% as pure growth against one returning 6% growth plus a 2% reinvested dividend has the same total return, but the dividend version pays tax every year and must therefore end up *behind* - it was ending up 21.7% *ahead*. Dividends and interest are still income, still taxed identically, and still land in your account; they are simply no longer counted a second time as spending money, and your withdrawal strategy draws on them like any other balance. Ending balances typically fall 4% to 23% at the default rates, with the spending goal still funded in the same years. Your inputs were never wrong - the tool was mishandling them, so a plan that looked like it worked may now need a lower goal, a later start, or a different strategy.
+ **Withdrawals are now sized against your guaranteed income after tax, not before it.** Proportional, Guyton-Klinger, the default strategy and the Cyclic Brokerage option used to work out the withdrawal by subtracting your Social Security, pension and required distributions at their full pre-tax value, as if that income arrived tax free. The tax owed on it was never funded, so those plans came up short by roughly that tax bill every year - quietly covered while Cash and Brokerage lasted, then reported as unfunded spending next to a large IRA. The tax is now computed and included. If you have a saved plan or a shared link using one of these strategies, its numbers can differ from what you saw before: the withdrawals themselves, the tax that follows from them, and your ending balance can all move, in either direction. Fill Bracket, IRMAA Tier, IRA Draw %, Reduce IRA in *N* Years and Ordered set their withdrawal by their own rule and are unaffected.
+ In addition to the "Load/Save/Delete/Manage Scenarios", there is a new "share" option that creates a reusable URL. If you want to share a scenario with someone else (or bookmark it for yourself), you can use that method.
+ The tool was incorrectly moving non-IRA assets to Roth.  
+ Implement the *Maximize (Roth) Conversion* logic - use cash/brokerage assets to increase Roth conversions. Currently it "converts" the excess withdrawals after taxes and spend goal.  If there is available cash to pay taxes on the conversion, more can be moved into Roth. Of course excess withdrawals can also be spent or deposited into cash. However there is not an option to withdraw brokerage funds to increase Roth conversions. 
+ Autoload any saved "default" scenario (so you can pick up where you left off).  A message pops up telling you this happened.
+ Tracks "Break Even" year for Roth Conversions. For details about what is tracked, consult the "Documentation" tab of the tool.

### Why This Tool?
Because the author is in retirement and has an unhealthy IRA balance to manage - it became obvious that no tool he could find offered the flexibility and *ease of use* he desired.  He and his wife are of different ages (so have different IRAs, RMD timings, Social Security amounts, etc.)  Some really powerful tools did not offer California tax calculations (California is a high tax state), or did not provide for life expectancy, and more.  Some of the questions the author sought to answer by modeling are these:

- Which strategy does the best job of reducing total taxation?
- What withdrawal strategy produces the most annual spendable amount? What is that amount?
- What assets will be left at the end of life, and in which accounts?

Therefore, the purpose of this tool is to model the remaining years of life with respect to spendable cash and taxation - and to determine how to optimize spendable cash. This tool may be useful to those who are *in* or *very near* retirement. It is not designed to analyze portfolios, in fact you must provide a best guess on the growth rate you expect for your particular portfolio(s).
Significantly more analysis is needed to do pre-retirement optimization, or optimization of asset mixes - this is not a tool for that. Some general principles apply, however: in general if you have a large IRA, it is usually best to put more bonds and conservative assets in the IRA, and put more aggressive assets in the Roth so that they can grow tax free.
		
Many focus on ***Roth Conversions*** and that is not wrong thinking, but such a view misses the big picture of WHY to do conversions. Also from the time one stops getting regular W2 income until the time one starts receiving pensions or social security is known as the "valley of opportunity".  
During this otherwise low income period, strategic withdrawals and movement is possible. Ultimately you are in a better place if you have *degrees of freedom* in your assets - more on this in a moment. 
It also does not make sense to pay more tax than necessary. I do not see taxation as evil, but it does not feel "right" to pay up to $14,000/year in IRMAA fees for no net benefit 
in Medicare - but that is one of the many possible pitfalls of having too much forced income.
		
Having a large tax deferred IRA balance (about 750K or larger at the start of drawing from your IRA) can have many consequences, the worst being taking forced income (RMDs) at higher tax rates and incurring those IRMAA penalties just described.  You do NOT have to have a large IRA balance to fall prey to RMDs causing IRMAA. For example, if you have a healthy income stream between a pension, social security, and say a profit sharing plan, dividends, interest or residuals, even a modest amount of forced income can push you over an IRMAA cliff, cause you to incur NIIT (extra tax on capital gains), or push you into a higher tax bracket.  That is, RMDs are NOT exclusively a "rich people problem."
In this tool, we show each: IRMAA, state and Federal taxes to show the big picture: net taxes/net spendable income, year by year spend and "Final Wealth".

### Key Features:

+ Two Roth accounts are modeled - one per person - tracked independently throughout the simulation. Withdrawals are split proportionally; conversions are routed per-person (IRA→Roth for each 
individual).
+ Historical returns are modeled in the Monte Carlo "Historical" mode. There are two synthetic models beside it: **Synthetic - GBM** (Log-Normal, Geometric Brownian Motion, where the growth rate you type is a drift in logarithms) and **Synthetic - AAM** (arithmetic, where the rate you type is the plain average of the yearly returns). Both give every path its own varying inflation. Historical - including historical inflation - is used by default.  See more at Monte Carlo, below.
+ Sophisticated Federal Tax and State tax calculations.  Includes *Capital Gains*, *NIIT*, a variety of states, and accurate social security taxation calculations.
+ A complete model until death of a single person or married couple with RMDs calculated, separation of 5 different accounts (IRA1, IRA2, Brokerage, Cash, Roth)
+ Tweakable rate(s), withdrawal strategies, and charts and tables to match them - but NOT TOO many variables.
+ Withdrawal Strategies include: **📊Proportional Withdraw +%** - proportionately withdraws from all sources to meet the After-Tax Spend goal. So, for example if your IRA is 10 times the size of your Cash, it will use 10x more IRA than cash. The **+%** adds an IRA-only boost of 0–200% of the spend goal (configurable; 0% is the pure proportional baseline). The after-tax surplus from the boost flows to Roth (if Max Conversion is on) or Cash. The Optimizer tests this at 0/5/10/20/50%. A "**💸Reduce IRA in *N* Years**" attempts to amortize the IRA down to "IRA Goal" in the number of years specified (Note "**Optimizer 🎯**" tries 2 through 15 years, then 20 and 25, and highlights the best result in a table - click any line in the table to choose that scenario). A "**🪣Fill Fed/IRMAA Bracket**" caps income/IRA draws at a chosen ceiling - the top of a federal tax bracket, or a specific IRMAA tier threshold - with any spending shortfall filled from Cash → Brokerage → Roth, and then from extra IRA above the ceiling as a last resort. An **ACA Cliff** ceiling (200/250/300/400% of the Federal Poverty Level) is also available, and the Optimizer sweeps those rows for everyone. It skips them entirely once both people are on Medicare at the start of the plan, when an income cap has no subsidy left to protect. A lower percentage is a **stricter** income limit, so if the Optimizer flags one ACA row as untenable (⚠️) it will flag every lower one too. "**📉IRA Draw %**" withdraws a fixed percentage of the IRA balance each year (the Optimizer tries 5, 6, 7, 8, 10, 12, 15 and 20%). **Ordered** strategies (CBIR, RIBC, BIRC) withdraw from accounts in a strict sequence: Cash→Brokerage→IRA→Roth, Roth→IRA→Brokerage→Cash, or Brokerage→IRA→Roth→Cash respectively. Because the sequence is yours, Ordered is the one strategy that will **not** draw extra IRA outside it, so unlike the others it can report a small residual shortfall while an account later in your sequence still holds money. A **Guyton-Klinger** guardrail strategy is swept too, using the guard and adjustment percentages you set. Apart from Ordered, and apart from ACA Cliff while its cap is in force, every strategy will draw additional IRA once Cash, Brokerage and Roth are exhausted rather than report unfunded spending. Every swept row runs with Max Conversion **on**, so the table compares strategies rather than conversion switches; turn it off in the sidebar to see your own plan without it.
+ There is also a "Max Conversion" option. It uses any surplus cash to increase Roth conversions from the *largest* IRA balance. With advanced controls turned on, the Optimizer also sweeps a **💵 Cash-funded taxes** copy of each strategy, which pays the conversion tax from Cash so more of the conversion actually lands in the Roth.
+ **Roth in shortfall withdrawals** decides where Roth sits when a year's spending needs more than the strategy itself withdraws. The default, *Last resort*, fills the shortfall from Cash, then Brokerage, then Roth. *After cash, before brokerage* takes Roth ahead of the brokerage account, which avoids realizing capital gains but spends the account that grows tax-free. It is a two-sided lever: across 60 test plans it gained as much as $471,000 and lost as much as $634,000, and it was negative in 26 of them, with nothing about a plan predicting which side it lands on. So the Optimizer sweeps a 🅡 copy of every strategy the setting can reach, whenever you hold Roth. It appears under Reduce IRA, Fill Fed/IRMAA Bracket and IRA Draw only: Proportional funds spending directly and rarely leaves a shortfall, Guyton-Klinger re-cuts spending through its guardrails, and Ordered runs the sequence you chose.
+ **Cycle Brokerage** layers on top of *any* withdrawal strategy: it alternates several IRA draw years with a brokerage long-term-capital-gains harvest year, which can keep ordinary income low in the off years. The Optimizer runs every strategy three ways - plain, cyclic IRA-first (🗘), and cyclic brokerage-first (🔄) - so you can see whether the maneuver is worth it for your plan before you turn it on. Watch the caveats: harvest years spike income, which can cost you at an IRMAA or ACA threshold, and the basis does eventually deplete.
+ An **"Optimize for"** selector at the top of the Optimizer re-orders the entire table by the goal you actually care about, moves the ⚓ baseline to match, and shows only the columns that goal is about, with a **Show all columns** link to bring the rest back. Nine goals are offered, from Tax Flexibility (the default) to Minimum Lifetime Taxes, Maximum Spending, and Earliest Break Even. The full list is in [How do I find the most efficient Roth conversions?](#how-do-i-find-the-most-efficient-roth-conversions) in the FAQ.
+ **Monte Carlo 🎲** - despite the name, this has nothing to do with gambling. "Monte Carlo" is a mathematical technique that asks: *what if we ran your retirement plan five hundred times, each time with a different sequence of good years and bad years drawn from the same statistical range?* Some runs get lucky (strong markets early), some get unlucky (a crash right after you retire). The result is a survival rate - "97% of scenarios still had money at age 90" - plus a chart showing the spread from best-case to worst-case portfolios over time. This is far more informative than a single projected growth rate, because the *order* of good and bad years matters enormously in retirement: a crash in year two is far more damaging than the same crash in year twenty. The tab compares all withdrawal strategies side by side under identical market conditions so you can see which ones are merely good on average and which ones are resilient across bad luck.  The growth and inflation sequences are chosen from historical data. My analysis of many tools has led me to believe that most of them are seriously flawed. Failing to model inflation variability is often what is lacking.
+ **Stress Test** - separate from the Monte Carlo, and not a random sample of anything. It replays your plan through the worst retirement *start years* that actually happened, one run each, and reports how many of them your plan survived. Because the sequences are fixed history, the result is identical on every machine and does not move when you change the seed. Each line is colored by what became of your money - ran out early, ran out later, never ran out - with a sortable table of the numbers behind every sequence. See [Stress Test vs Monte Carlo Analysis](#stress-test-vs-monte-carlo-analysis).
+ Many state tax tables are present (including "No Tax" states). California tax table is the default. 33 of the US states tax IRA withdrawals the same way - albeit at different tax rates.  Also, those same 33 states treat all capital gains as taxable income - and that can matter quite a lot. WARNING: only California calculations are done using the correct model. Other states may be off. Best to double check. Moreover, most states do NOT tax Social Security. Those that do may not be modeled correctly. The Federal government taxation of Social Security should be very accurate.
+ Modeling will show the true cost of the widow penalty (when one spouse predeceases another) and the IRMAA penalty.
+ Can model different spending rates (goals) in retirement via a declining (spending smile) or a flat spending rate.
+ The Optimizer can also determine the "highest possible spending rate" if you check the "**Optimize Spend**" box - but you would be wise to run a Monte Carlo against that spend level. Just because the math finds a higher spend level doesn't mean it's a good idea!
+ It automatically rolls any IRA balance from the deceased spouse to the living spouse (RMDs may apply differently!).
+ Includes the effect of the impending **2033 Social Security Fund** depletion (with a 23% reduction in payouts). If you think congress will fix this, you can change the year to much later, or the payout to 100%.
+ "Wealth" as shown in this tool is adjusted for the average taxation measured.  Many tools show a 50,000 Roth and a 50,000 IRA as being 100,000 net worth - but that's not very accurate. You can only take money out of an IRA at a zero percent total rate at a very low amount. RMDs may make that impossible at some point.
+ Save/Load/Import/Export settings (**Import/Export 📂**) so you can quickly start where you left off. If you save your settings as the name "default" those settings will automatically be reloaded when you restart. NOTE settings are saved in your **browser**. However you can Export them and Import scenarios in another browser if you wish. You can also use the "share" to generate a portable URL.
+ View the detailed transactions (**Annual Details ⊞**) or a simplified graph (**Chart 📊**).
+ On the Annual Details page, click either the year column or the "totalTax" column and it will generate up to 3 different tax payment plans - showing which is the most effective.
+ By default dividends from the Brokerage and interest on cash are accumulated into the Cash account. The "Reinvest Brokerage Dividends" changes this behavior and dividends are reinvested (meaning your cost basis grows over time).
+ If you do Roth Conversions (even a $1), the tool will determine when you "break even" - if ever. Break Even means the value of your total assets becomes the same or greater than the value of your assets had you done NO Roth conversions (and paid no taxes on those conversions), and stays that way for the rest of the plan - a one-year blip that later falls behind again does not count.

### What the Tool IGNORES (No Plans to Implement)

+ **Roth and IRA Modeling Limitations:** This tool assumes all Traditional IRA balances consist entirely of pre-tax contributions, and that all Roth IRA withdrawals are tax-free. If your Roth account is less than 5 years old, or if you made Roth conversions within the past 5 years or are under age 59½, actual withdrawals may incur income tax or a 10% early withdrawal penalty not reflected in these projections.
+ The various short term benefits to seniors under the OBBBA (e.g. extra deductions and phaseouts) are in the engine, and should properly phase out. There is no logic to intentionally make use of those deductions, however - in part because they are temporary.
+ There is no plan to model partial spousal uptake of the deceased's IRA. This could happen, for example, if the IRA is divided among multiple beneficiaries - including or not including the spouse, or if the spouse disclaims some or all of the IRA.
+ It's silly to forecast 8% growth in an IRA and 4% growth in a Roth because that confuses the value of one over the other. It MAY make sense for Roth assets to be more aggressive than IRA assets. The "Account Composition" can be used to set different asset mixes for each account, but be clear about how far that reaches: it feeds the **Historical** Monte Carlo modes only (the bootstrap run and the stress sequences). Both Synthetic modes (GBM and AAM) ignore it, and so does the normal deterministic projection - those fall back to the single growth rate for every account. Cash has no composition row at all. 
+ Only tax filing statuses MFJ (married filing jointly) and SGL (Single) are modeled. There is no Head of Household, Married filing separately, etc.
+ There is no provision for itemized tax returns.  This tool assumes you rely on standard deductions (or exemptions, if that's what your state uses).  It also assumes that Single means one person, Married Filing Jointly is two. If you have a dependent adult, or children, it will not calculate the proper possible exemptions or deductions for these situations.
+ The tool doesn't try to maintain a *brokerage* balance. It will deplete the brokerage account to zero if required to meet your spend goal. Cash is the exception: the **Cash Reserve** setting does keep a target cash buffer, and the tool only breaks into it after every other account has been exhausted. See [When might Cash Reserve be depleted?](#when-might-cash-reserve-be-depleted) in the FAQ. There is no equivalent floor for brokerage, and no plan to add one.
+ When enabled ACA subsidy targeting keeps MAGI below 200/250/300/400% of the Federal Poverty Level. ACA thresholds are the only strategy that **strictly** enforce the ceiling. Crossing an ACA Federal Poverty Level (FPL) threshold forfeits the entire premium subsidy (a cliff, not a gradual cost), so the simulation never breaches the cap. If your spending can't be met within the ACA target, the plan is flagged untenable rather than quietly overspending. The cap **ends at Medicare**: from the year every living person in the plan is Medicare-eligible there is no premium subsidy left to protect, so the ceiling is dropped and the strategy runs as **Proportional 0%** from then on. Before that point the cap is measured against *household* income, so a spouse who is already on Medicare still has their RMDs and Social Security counted against the younger spouse's limit. What the tool does **not** model is the subsidy itself - there is no premium tax credit, no applicable-percentage table, and no health-insurance premium in the spend goal, so it can show you what staying under the cap **costs** but not what it **buys**. Read an ACA row as a constraint study, never as a recommendation.
+ All other strategies e.g. the **🪣Fill Fed/IRMAA Bracket** strategy, are *soft* - and will exceed the ceiling to fund spending.

+ An **IRMAA tier ceiling** aims at the threshold that will actually apply, not today's. IRMAA bills a
given year's premium against the income you reported **two years earlier**, and compares it against
the thresholds published for the billing year, so a ceiling capping this year's income has to target
the threshold two years out. At 3% inflation that is about 6% higher than today's. The same forward
projection drives QCD "As Needed", where it matters most: that mode donates exactly enough to reach
the target, so a correctly projected target means a smaller donation buys the same tier. The safety
margin below does **not** apply there, only to the ceiling, because on the QCD side a margin is paid
for with money that leaves the household and it measured costing far more in donations than it saved
in surcharges. Two things it does **not** do. It does not anticipate a change of
filing status: income sized while married but billed after a death is judged against single-filer
thresholds roughly half as high, which is the IRMAA half of the widow penalty and the one case where
a plan can land in a much higher tier than it targeted. And the safety margin it leaves below the threshold (an
`?nerdknob` setting, default: project the threshold forward at half your expected inflation) only
insures one thing: **inflation
coming in BELOW your assumption**. If CPI meets or beats what you entered, the thresholds outrun
your plan and the margin buys nothing at all - measured as exactly zero breaches in every setting at
or above the assumed rate. It also does not cover income you could not know about in December, such
as a late fund distribution or K-1, because the simulation never has any. It warns about this, but don't expect to spend 300k/year and remain in the 12% Federal bracket unless you've got a lot of Roth or high basis brokerage assets.
+ There is no modeling of any kind of Annuity, Life Insurance, Reverse Mortgage, inheritance, or ongoing (part time or full time) Income.  If you have a lifetime annuity, or other ongoing income you can treat it like a pension.
+ There is only one pension and it's assigned to "You". If your spouse has a pension and you don't, you can swap roles. You become **your spouse**, and your spouse becomes you in the entry fields.
+ There is no modeling of rental income (Schedule E), 1099/self-employment income, or self-employment tax.
+ There is no Foreign Tax Credit modeling (relevant if your brokerage holds international funds).
+ There is no Alternative Minimum Tax (AMT) calculation.
+ There is no asset-class-specific tax treatment for alternative assets - gold/collectibles, cryptocurrency, or REIT-specific dividend/basis rules. All holdings within an account are taxed per that account's rules only.
+ There is no Estate Tax or Gift Tax modeling. This tool only models income tax.
+ There is no NUA (Net Unrealized Appreciation) handling for employer stock held inside a 401k.
+ There is no 72(t) SEPP (Substantially Equal Periodic Payments) modeling for pre-59½ withdrawal planning.
+ There is no modeling of Education Credits or 529 plan interactions.
+ There is no modeling of Alimony (pre- or post-2019 TCJA rules).
+ Capital gains are modeled at Long-Term rates only. Short-Term Capital Gains (taxed as ordinary income) are not distinguished.
+ The NIIT (Net Investment Income Tax) threshold is not inflation-indexed in the engine because it is not inflation adjusted in the tax code.

Why are these permanent?

More inputs and knobs and conditions make the tool less simple. If you've got those situations, you can do some modeling here, but maybe a better tool will be MaxiFi, EMoney, Empower, Projection Labs, Pralana, Boldin, or similar.

### Limitations and Restrictions

0. The tool models things a year-at-a-time. This is not strictly accurate, because, for example, **when** you make withdrawals or conversions materially affects the results. Waiting until the end of the year to make your withdrawals has a different result than making a withdrawal at the beginning of the year.  The order of calculations is:  QCD withdrawals, RMD withdrawals, calculation of spending/conversion withdrawals (and removal of those funds from the needed accounts) THEN taxes, interest and dividends on the remainder are calculated. Surplus funds after minimum spending levels are eligible for deposit into a Roth.  In real life, you must do Roth conversions as a separate operation, but this tool can help forecast what that conversion would be. The [Retirement Tax Planner](https://tools.netcitizen.us/RetirementTaxPlanner.html) linked from the Annual Table "Year" or "totalTaxColumns" shows the trade offs about WHEN to withdraw or convert. Internally, the retirement optimizer checks two alternatives: early withdrawals (when conversions are being done) and late withdrawals - if no conversions. Early conversions push pre-tax money into tax free money - so the earlier the conversion occurs, the more tax-free growth you gain.
0. IRA withdrawals are done *proportionately*. Some improvement may result by reducing a large balance first.  You can model this by moving the total balance to one person.
0. There is no "Accumulation phase" and no plan to add one.  I.e. no way to say "stash X dollars per year" in an IRA or Roth, Brokerage or Cash. The goal is to keep the inputs simple.  However, you CAN calculate your expected assets as of your retirement age, and use the *Retirement Start Age* to delay retirement into the future. This will result in properly adjusted tax brackets.
0. There is no plan to add "Part Time income", Annuities (can model those as "pension"), windfalls, lumpy spending (well, we are thinking about that last one) ...
0. Social Security Survivor benefits are roughly calculated. The month of death is required for exactness, but we are not sure anybody knows that, let alone the exact year of demise ;-) 
0. **Basis step-up at death is now modeled, with four residual limits.** Under IRC §1014 a taxable account is re-based to its date-of-death value, so the gain that accrued during the decedent's life is never taxed. The tool applies this at *both* deaths: at the **first death** it steps up the whole account in a community-property state and half the unrealized gain everywhere else, following your State Tax selection (this is a matter of law, not preference, so there is no switch for it); at the **final death** whatever Brokerage remains is valued at market rather than net of capital gains tax, because the heirs inherit it and never owe that tax. What is still approximate: (a) **Louisiana and New Mexico** are community-property states that the tool does not model at all, so they cannot be selected - if they could be, treating them as common law would **understate** their terminal wealth; (b) basis is a single **aggregate** number with no lot tracking and no per-spouse attribution, so half-versus-full is an ownership-model proxy rather than a computed share, meaning a household whose taxable money mostly belonged to the *survivor* gets **too much** step-up and one whose money was mostly the *decedent's* gets **too little**; (c) **Alaska** is treated as common law, because community property there is opt-in by written agreement rather than the default, so an Alaskan couple who did opt in gets **understated** terminal wealth; (d) there is no capital-loss carryforward, so a basis left larger than the account after a market decline is written down in that year instead of being banked against a later gain, which can only **overstate** the tax owed, never understate it. Note also that the **Break Even** figure deliberately still values the terminal account as if it were sold rather than inherited; see the change log for 11.1494.
0. **Cost basis is one aggregate number, so the tool cannot model choosing which shares to sell.** A real taxable account holds lots, each bought on a different day at a different price. Sell the high-basis lots first (specific identification, often automated as "HIFO") and you raise the cash you need while realizing much less taxable gain. This tool holds a single basis figure for the whole Brokerage account and consumes it proportionally: withdraw 10% of the account and it always realizes exactly 10% of the unrealized gain, no more and no less. That is the correct average, and it is what a household actually gets if it never selects lots or if it holds a single lot. For anybody who does select lots, the tool **overstates** the capital-gains tax on a Brokerage withdrawal, which in turn **understates** both the spendable income that withdrawal produces and the terminal wealth of a plan that leans on Brokerage. The same limit is why there is no tax-loss harvesting: selling a losing lot to bank a loss is a lot-level action, and this model has no lots to sell. Practical effect: wherever the tool compares drawing from Brokerage against drawing from an IRA, it is pricing the Brokerage draw at the account's average gain fraction, so a household sitting on plenty of high-basis shares should read the tool as **too pessimistic** about Brokerage withdrawals rather than too optimistic.

---

> [!CAUTION]
> Remember: **There is no SUPPORT for this tool**. If you ask nicely, or offer a pull request to actually implement a feature, of course we can talk. It is a best effort/time available endeavor.

---

## What about Other Tools

One of the lovely things about engineers is they like to build things. I've found many other free (or almost free) resources that both inspired me and made realize that there is more than one way to solve problems.  Of course I've also paid for and used yet more tools which I will briefly address.

### Free Tools

The sources I found around the interweb.

#### NestWise

[NestWise](https://www.nestwise.me/) - lots and lots of features. No login required. Includes things like budgeting, extensive Monte Carlo analysis, and even one of my favorite features which allows you to compare different withdrawal  strategies to find one that best suits you. What I'd like to see is a tool to vary starting spend to optimize that number (to be fair, it's there but buried in the Scenario Compare as "Reverse Solver" - and there is "Probability Calculator" that allows you to sweep withdrawal rates, but takes a LONG time to run). And a bit more details in the strategy comparison - I'm less interested in the terminal balance than I am things like how much RMDs drive my taxation - there is a "Scenario Comparison".  I've examined the source code for this tool and collaborated with the developer. No back-doors, or exploitable flaws were found as of March, 2026. It incorporates a variety of withdrawal strategies (Guyton Klinger Guardrails, Constant Dollar, and many more).

I haven't determined whether inflation is being used in the Monte Carlo or Historical (Cycles) modes, but it appears to be and it's probably the clearest historical comparison tool I've seen anywhere.  You can run your plan against the dot com bust, the Global Financial Crisis of 2008, the Great Depression, the lost Decade (1999-2009), and Stagflation. 

It's currently the best of breed. The user interface is more approachable than typical tools - but also more nerdy. One flaw is the frequent, long recalculation times - but that can be tweaked to only recalculate on demand. You can use it without logging in. It saves your progress in your browser. It has Debt Payoff, Budgeting (rather rare for a free tool) that allows you to import transactions.  The tool is lingo heavy (meaning it uses financial terms).

#### Visual Federal Tax Tool
[Visual Federal Tax Tool](https://engaging-data.com/tax-brackets/) - this tool shows how your federal taxes are calculated.  As of 2026-01-17, it doesn't handle taxability of Social Security income, and as best I can tell, doesn't handle the OBBBA (One Big Beautiful Bill Act) provisions for seniors.

#### AARP Federal Tax Calculator
[AARP Tax Calculator](https://www.aarp.org/money/taxes/1040-tax-calculator/) - free to AARP members.

#### Retirement Figures
[Retirement Figures](http://retirementfigures.com/) seems pretty robust and is currently free.  I have no access to the source to look for problems.

#### TaxVantage
[TaxVantage](http://taxvant.com/) Recently came on the scene. I have not evaluated it yet, though I have taken a look at the tax engine being used.

#### Google Sheet by Redditor
[GoogleSheet](https://docs.google.com/spreadsheets/d/1orZQ9g1KvGVrCShibutjyreaeqbmRFVAZ9aSY_57-DQ/edit?gid=1250894970#gid=1250894970) by Charles Eglington found on [Reddit](https://www.reddit.com/r/DIYRetirement/comments/1pnpufa/comment/nu9lawc/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1). It's got lots of options. I want some things that aren't in it like a "Life Expectancy" for each person, properly calculate deductions, deduce filing status, etc.  In addition, I'd like it to "self-optimize" by varying the amounts of IRA/401K withdrawals (and the number of years for withdrawals).  Ideally it would properly, or more properly calculate California Tax, and have a way to forecast based on inflation. But it's still a helpful tool.

#### Roth Helper
[RothHelper](https://rothhelper.com/) is another tool that was posted in the same [Reddit DIY thread](https://www.reddit.com/r/DIYRetirement/comments/1pnpufa/comment/op600xx/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button). It has an accumulation phase and a simple analysis.  Probably OK for modest IRA balances. I like the tabular output though it's several pages worth of entry to get there.  I recognize the graphics... same chart.js engine I've been using.

#### AiRA Retirement Application
This is a new tool that was announced on July 25, 2026 in [Reddit DIYRetirement](https://www.reddit.com/r/DIYRetirement/comments/1v6ltzf/i_made_a_free_retirement_calculator/). It lives at a peculiar address: [aira.tiredtoretire.com](http://aira.tiredtoretire.com/) "tired to retire".  I first read it as "tried to retire".  First attempts at the tool uncovered a number of issues. For example it uses a "Bucket Strategy" and seems to enforce a Guyton Klinger withdrawal strategy. Bucket Strategy is not explained - and the 3-buckets provided in the tool will not make sense to people who think differently about bucket strategies. Entry fields lack tooltips, and there is some confusing language like "D-Day" - which apparently means retirement day. Oddly it asks for the specific day, but when it showed my withdrawals, it started them in 2020 - 6 years ago but I entered the retirement date as 2024. It makes me wonder if the tool would be usable by someone who has already retired more than a year or so ago.

There are some interesting ideas in the tool: for example "Health Care Spending Shock" with a percent likelihood of the occurrence. But I'm not sure that makes sense. I think statistically speaking the chance of health care shocks goes up over time.

### Paid Tools

#### ThunderHarbor.net by yanyan80
Free to try, $3.99 for a one week trial then $49 or $79 year. 

Frankly two things dissuaded me from trying this tool. The first was the "Free to Try" banner with no pricing, and the second is the requirement to provide an email. Pricing is now present. The $49 vs $79 is for those who "start before the 50 low-price slots are gone."  I get the idea behind the pricing, but it feels a bit like the many scammy sites that pretend the pricing is going to expire soon. It also allows $3.99 for a week trial.  When I've created throw away email address, I will evaluate the tool for the week.

@[yanyan80](https://www.reddit.com/user/yanyan80/) is the author on Reddit. 

---

#### Boldin
[Boldin](https://www.boldin.com) - formerly known as *New Retirement*. I had a year subscription. It was usable, but there was much I didn't like about it. The main issue with the tool is they try to do "everything" from pre-retirement planning through retirement. My number one pet peeve is that everything you wish to do that requires a future date shows month-by-month choices. It matters for some things, like exactly what month you retire or start social security. But it's tedious. One thing they have fixed is that it used to show "65y3m" meaning age 65, third month. Depending on your birthday, that could be any actual month.  Now they show "65y3m Jan 2038" - for example. You can type either "65" or "2038" to get the list of 12 months and just pick one, but if that future income is say, an inheritance well, it's just bizarre to be specifying the year, and month.  Well, at least they don't ask me what month I plan to die in. Maybe my spouse knows that plan.

You must specify an account withdrawal order (or use the default). The default picks taxable accounts first, followed by tax deferred and tax free. But if you're going to do Roth conversions, or trying to deplete your overblown IRA - that order makes no sense. Ordering within taxable types makes sense... but I want the tool to be smart enough to know that the last 10k dollars I plan to spend can come from wherever is the most tax efficient at that time.  Pull from my cash, or my Roth instead of launching me off an IRMAA cliff, please.

Boldin offers synchronization. The majority of redditors worry about providing linkages. My thought was: why wouldn't you want to automatically get your account balances, and portfolio information...
BUT Boldin only cares about balances. So the pain of "sometimes working/sometimes broken/sometimes need to be deleted and recreated" links is really a nuisance - not a value add. They have announced plans to actually monitor your portfolio, but unless they are going to do so in a way that enhances the guidance that they can provide for asset allocation or choosing growth rates... I doubt it will be worth it.  Speaking of growth rates... 

Another gotcha, is that every user, must select the "growth rate" for **each** account. This is a very tricky problem and picking wrong will give a much rosier or much more dismal picture. It may also severely skew the logic for Roth Conversions. If you have a brokerage account (or IRA) that contains 60% equity (and 20% of that International), 10% Bonds, and 30% cash/money market, the growth rate you pick needs to roughly match a reasonable reality that converges those 4 numbers. What many people end up doing is to split every account into separate components (Brok1-Equity, Brok1-Intl-eq, Brok1-TIPS, Brok1-Cash, Brok1-TaxFreeBonds) in order to assign reasonable different rates to each. Doing the split makes rate management easier, but it makes updating balances much more tedious - and it makes linkage to accounts useless.  

Navigability of the tool has improved. Things are more where I expect them than when I first subscribed. As I noted, however, there could be many more easy cross links between sections - for example Taxes and IRMAA are separate sections. And if the AI could provide a link to get you straight to the section it's telling you to visit, THAT would make it more usable. When I asked AI how to set a "glide path" it told me to change the "Growth Curve". It told me where to find it. But it wasn't there. I balked and the AI said: "Oh, that's the INTERNAL name, it's actually called "Model a Rate Change in the Future" (a switch). It's not a curve, it's a single change. So much for actually creating a glide path!

In my opinion, however the worst part of the tool is the Monte Carlo analysis. Monte Carlo is not a SPECIFIC type of analysis. [Boldin has chosen NOT to model variable inflation](https://help.boldin.com/en/articles/5805671-boldin-s-monte-carlo-simulation). They offer Historical "simulation" (Market Risk Explorer) but it's not on the Monte Carlo page, and the Monte Carlo output doesn't inspire. Monte Carlo shows possible net worth outcomes (and the percentage of outcomes that end with >0 money). But that's not very reassuring. And the Monte Carlo "chance of success" shown on the overview page is a dead end - it's not clickable. They don't provide information about what range of market volatility was used, what range of inflation was used. Their document (and the AI) both specify that they do NOT vary inflation at all - it comes from the "Rate Assumptions"

Social security explorer is inaccessible if one of the couple has already started collecting social security. That seems odd, because maybe I want to know if 67 or 69 or 70 is a better start age.

Oddly, the Roth Conversion Explorer has no AI component. And it feels very disjoint from the main components. For example, if you use the Roth Conversion Explorer but haven't ALREADY created a new scenario, you must: quit and back out, duplicate a scenario and then redo the Roth Explorer questions. Or apply the changes to whatever the "current scenario" is. This would be a perfect opportunity to create a new scenario. Another head-scratcher: you can specify that "surplus" (e.g. income in excess of spending needs) can be placed in a taxable account. But why can't I put the excess that comes from an IRA into a Roth (e.g. a conversion). That is, I don't expect to ever see years with a surplus AND a Roth conversion in the summaries, but I do. Seems it's missing an easy win.

The Scenario Manager is another prickly point. You can name scenarios, provide a "note" about what each one is, but you can't e.g. see or compare the notes of multiple scenarios at once, nor can you readily tell how they are different. Did you want to try multiple Roth conversion strategies? You better have named them precisely and kept notes, because the Scenario Manager cannot tell you how the scenarios are different. AI can help, but it won't, for example, tell you what choices you made in the Roth Explorer.  Moreover, the explorer seems to always target drawing each spouse's IRA to Zero. This does not make sense to me.  There is value in keeping an IRA. Both due to the ability to do QCDs, leave some to charity, and - once the balance is sufficiently low - to withdraw funds at miniscule taxation.  If you happen to be in a scenario and notice that the growth rate is wrong. You really only have one choice: delete all scenarios, make the change to the Baseline and recreate all the scenarios. Unless you *happen* to know the rates or inspect the rates used in every scenario - in that case you could update all the ones that had the wrong growth rate. But then you have to also take into account any money flow monkey business you may have done to model some of the things that Boldin doesn't natively model.

One other shortcoming: Boldin likes to present things in future dollars. This is a mistake that gives a false impression. Right now one million dollars sounds like a nice nest egg (and it is). But 30 years from now at 3% annual inflation, that 1M is worth $412k. In much the same way if you notice your High Yield Savings account balance has climbed from 10k to 11k you would be remiss to not consider what inflation (and taxation) do to diminish the **value** of that account!

Final comment: at $144/year it's a great deal compared to a ruinous retirement. You may spend a week putting a plan together. But you will have no use for the tool for the rest of the year. If it did real portfolio tracking, or budget tracking, or tax planning (e.g. how to pay your taxes in retirement) it WOULD make the tool more useful on a monthly basis. But ultimately, what Boldin provides is a complex calculator that responds to your tweaking. That is, it takes a complex problem, and makes you the decider. It will help you think about organizing, timing and accounts, but it won't suggest to you how to do it BETTER.  It won't help you pick a "more ideal portfolio allocation", tell you that your chosen growth rates are unrealistic. It doesn't appear to optimize your annual withdrawals, or provide insights on the best time to do conversions (early in the year - by default it schedules them for December!)

---
#### MaxiFi

I've not had this subscription for very long, so I'll withhold my comments until I've kicked the tires more aggressively.  I will offer for now, that it's less "polished" than Boldin (I run into reference errors pretty often). So far the main quirk I noticed:

It wants to know ONLY the IRA balances at the end of last year. I understand this, but I do NOT. Why it wants prior year end of year balances is no doubt so it can compute RMDs for IRAs and 401K accounts. But if my accounts soared or took a beating, the current value is what I care about. 

More later.

---
#### Projection Lab
[Projection Lab](https://projectionlab.com) - Just now getting a look at this tool. First, don't pluralize labs... that's an empty webpage. It offers a free to try phase, current cost is $129 / year.
It is definitely more "geeky" than say Boldin, but I already know it does two things that are awesome: 
1. It provides a way to "optimize" your asset location.  Tell it about your asset classes and it will suggest how to relocate them to other accounts for improved tax treatment.
2. It has INFLATION built in to its Monte Carlo engine

More later.

---
#### Roth Done Right (Stonewood)
[Stonewood Financial](https://www.stonewoodfinancial.com/pricing/). I found this while doing some research. I believe the tool is targeted to financial advisors, not individuals.  Prices are from $229 to $349/mo. I haven't test driven it, so can speak for it's value or whether it's even offered to clients who are not CFPs.

In some of their website info [they discuss Roth Break Even](https://www.stonewoodfinancial.com/the-real-cost-of-roth-conversions/).  And I found them precisely because they address [BETR](#is-the-break-even-tax-rate-trustworthy) which I note is NOT trustworthy.

> Nominal break-even asks when the balance looks whole again. After-tax break-even asks when the client is actually ahead. BETR asks what future tax rate would need to be true for the decision to be a wash. A client conversation that only uses one of the three is missing part of the picture.

---
#### Others

##### Number Crunch Nerds
[NumberCrunch Nerds](https://www.youtube.com/@NumberCrunchNerds) "Justin, the Honest Tax Accountant" has produced many useful videos, and sells an extensive set of spreadsheets that you can buy and fill with your own data. I've used the spreadsheets in Google Sheets (with mixed results), and LibreOffice Calc. They are designed for Excel. He methodically explains many concepts and if you don't mind being read the slides aloud he's worth paying attention to. His spreadsheets are obviously one of the most "private" ways to manage your planning since the data stays in your computer (unless you put it in a cloud).

##### RetirementIQ
[RetirementIQ](https://retirementiq.app/) Free for 7 days, $50/year. I've not dabbled much with this, partly because I prefer open source that I can inspect for possible flaws, back-doors, etc.  Directly invoke it here: [retirementiq.app](https://retirementiq.app/app/)

##### Retirement Scenarios
[Retirement Scenario](https://retirementscenario.com) free to kick the tires, but $79 to fully unlock. The UI is good, but the reliance on sliders and a few quirks make it less than ideal for use with a phone/small screen device. I found no gotchas after doing a security audit of the code (as of May 22, 2026). The author recently fixed a problem that made the tool unusable unless your retirement age is greater than your current age. There is, unfortunately, nothing in the tool that helps you calculate "ideal" Roth conversions - but all the directional guidance is good. Like many tools these days, but unlike all the others, this tool integrates AI. You can ask the AI questions about your plan and/or about the tool. If you want to use the tool on multiple devices, you need to "login" using the email address you use to make a purchase.

##### CliffEdge App
[Cliff Edge App](https://cliffedge.app/) - found this in the DIYRetirement space and have been in contact with the author who asked me to review. It has good visuals. It is focused on seeing where the holes are that you can fall into. Give it some basic data, then slide the Roth Conversion slider to the right and it will show you what brackets you land in and how far away the next "cliff" is. There is a difference, however between a "cliff" (like IRMAA), and a bracket change (like the 0% long term capital gains income limit).  If you cross a cliff you get hurt by a thousand or more dollars. If you cross a bracket you pay the next dollars at the higher bracket (extra pennies).  It was free, but I see it's asking $49/yr (or $79/yr by the time you read this).  It includes RMD projections. You must create an account to see full projections. I haven't analyzed it for full features - in part because I'm "averse" to creating an account unless I know what is going to happen with my data. The privacy policy is clear that all data stays in your browser (except the email to create the account). Sliding the Roth control to the right is the equivalent of getting more ordinary income as my [Income Tax Planner](https://tools.netcitizen.us/standalone/IncomeTaxPlanner.html) will illustrate. 

---

## Ramblings and Observations

### References and Useful Resources
I've read more than a dozen books, viewed 100s of YouTube videos, read perhaps a 100 papers and online articles.  Here I've distilled down what I found useful. I'd call it my recommended reading list.

#### YouTube Sources
+ [Rob Berger](https://www.youtube.com/@rob_berger) formerly a securities lawyer in Washington DC, I find his pragmatism refreshing. He focusses on retirement topics.
+ [Zacc Call Money Education](https://www.youtube.com/@ZaccMoneyEducation) - Zacc provides math-based insights into not just retirement topics, but also money management in general.
+ [Erin Talks Money](https://www.youtube.com/@ErinTalksMoney) - Erin presents some interesting and compelling ideas in a clean, clear-headed way. 
+ [NumberCrunchNerds](https://www.youtube.com/@NumberCrunchNerds) - Extensive calculation oriented videos with well supported math. He (Justin) also sells a suite of spreadsheets that you can use to do your own projections and calculations.
+ [Even Better Retirement](https://www.youtube.com/@EvenBetterRetirement) - Ben Brandt, a CFP, is another level-headed, straight talk guy with a wry sense of humor and compelling insights.
+ [Kevin Lum, Foundry Financial](https://www.youtube.com/@foundryfinancial) - Kevin Lum, CFP, is also a "straight shooter" who avoids click-baity content.
+ [Ramit Sethi - I Will Teach You to Be Rich](https://www.youtube.com/@ramitsethi) - Sethi is the author of the bestseller book "I Will Teach You to Be Rich" - also a Netflix series. I highly recommend the book. His YouTube content is less retirement oriented and more "life" oriented.

The list of click bait presenters would be very long.

#### Papers by Edward McQuarrie 
Edward McQuarrie is a former professor at Santa Clara University School of Business, in California. He has tackled several topics, including the "payout" of *Roth Conversions* and the Widow's Tax *penalty*. His conclusion is that generally for the mass affluent, Roth conversions do not pay off.  He has three papers on the topic, and a fourth that is thought provoking. I would call him a *responsible contrarian* - meaning he doesn't just espouse opinions, he backs them with math and facts.

1. [2024 Net Present Value Analysis of Roth Conversions](https://www.financialplanningassociation.org/learning/publications/journal/SEP24-net-present-value-analysis-roth-conversions-OPEN). This is his latest, and perhaps most concise paper on the topic.
2. [2021 When and For Whom Are Roth Conversions](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3860359) - download the paper from there. This is his original paper on the subject.
3. [2023 Widow Tax Hit Debunked](https://www.financialplanningassociation.org/learning/publications/journal/DEC23-widow-tax-hit-debunked-OPEN) - McQuarrie illustrates that the "widows tax" is overstated. I think he errs in saying it's **debunked** because his numbers illustrate the reality of the survivor penalty - and worse numbers can be had.
4. [2025 Charts you Never Saw](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3050736) - McQuarrie shows an even longer market timeframe which illuminates the reality that "the market always returns value in the long term" is a bit illusory.

I notice that he is releasing a book with Bill Bernstein (a prolific author of financial books) in March 2027 called "[Retirement: How to save enough, invest it well, and make your money last](https://www.amazon.com/Retirement-save-enough-invest-money-ebook/dp/B0GQWCS15F)"

#### Miscellaneous

[Quick Way to Estimate Portfolio Longevity](https://retirementincomejournal.com/article/a-quick-way-to-estimate-portfolio-longevity/) - a paper by Jim Otar.

[Sequence of Inflation Risk](https://retirementoptimizer.com/articles/Sequence%20of%20Inflation.pdf) - another paper by Jim Otar, and something I learned from my own modeling.  

### Some of the Things I Learned About Taxation

#### Late Payment Penalties

One of the biggest bugaboos in retirement is managing your tax payments.  Unlike working years where you were getting frequent payments with tax withholding already done, in retirement you can take taxable withdrawals anytime you like: beginning of the year, middle of the year, monthly, etc. However federal and state taxing authorities expect you to pay your taxes "timely" (e.g. quarterly or through appropriate withdrawals).  It doesn't matter to the IRS whether you withdraw 50K at the beginning, middle or end of the year, the IRS expects you to pay your taxes "quarterly" based on your total income at year end. 

You CANNOT solve the timeliness problem by plunking down your tax debt when you file your taxes by the April 15 deadline!

The easiest solution to the "when were taxes paid" problem is to have taxes withheld from withdrawals or conversions. The IRS and most state governments treat withholding as if you paid the amounts quarterly. BUT, most custodians will NOT allow you to withhold taxes from a Roth withdrawal.  This means you have three ways to solve the "timely payment" problem: 

- A. Estimate your taxes and pay them quarterly.  (But if you miss a payment, expect late penalties!)
- B. Have the appropriate amount of taxes **withheld** from a taxable distribution to cover the years worth of taxes (or at least enough to reach "Safe Harbor").
- C. File a form with the IRS (Form 2210, Schedule A) that explains why your income was "lumpy" and you didn't meet the expected timely payment requirement.

##### The Maneuver
Option B allows another workaround: Suppose you convert 10k from your IRA to your Roth. You can have taxes withheld from the conversion, and WITHIN 60 days, make your Roth whole by adding cash into the Roth. We call this "*the maneuver*" and detail it later.

There is a once-per-12-months limit [IRC 408(d)(3)(B)](https://www.law.cornell.edu/uscode/text/26/408) that applies to **IRA-to-IRA** 60-day rollovers. Transactions that are excluded from the once per year include "rollovers from traditional IRAs to Roth IRAs (conversions)" (see [IRS, Rollovers of retirement plan and IRA distributions](https://www.irs.gov/retirement-plans/plan-participant-employee/rollovers-of-retirement-plan-and-ira-distributions)). The IRS says elsewhere that Roth conversions "are not subject to the one-per-year limit and are disregarded in applying the limit to other rollovers" ([IR-2014-107 / Announcement 2014-32](https://www.irs.gov/uac/newsroom/irs-clarifies-application-of-one-per-year-limit-on-ira-rollovers-allows-owners-of-multiple-iras-a-fresh-start-in-2015)). So you **can** *withhold-and-replace* on every conversion you do, in the same year, in each spouse's IRA, and doing so does not use up your one ordinary IRA-to-IRA rollover.

##### Why End of Year vs Quarterly?
Perhaps the main reasons why you would want to withhold at the end of the year instead of quarterly are twofold:
1. You have time to earn more growth, and
2. You have greater tax certainty.

If you pay $X quarterly, that means the first 3 months you get growth on the full amount $X, but the next 3 months you get interest on 3/4 of X, ... and so on. The net is you gain 7.5/12 (62.5%) of the growth you could have gained had you kept the total payment in your account until the end of the year.  On a total tax bill of 30k, in a HYSA at 4% you could make $1,200, but by paying quarterly you only gain $750.  But don't forget to pay the tax on the interest.  Note that monthly payments also collect less interest:  6.5/12 (54.17%) - about half as much.

Two things about *the maneuver* are still real limits. First, the exclusion covers the *conversion*. If you withhold from a plain (non-RMD) IRA withdrawal and then try to replace that money into a traditional IRA, you are doing an ordinary IRA-to-IRA rollover, which really is capped at once per 12 months, aggregated across all your IRAs. RMD dollars are a separate and harder problem: they are not eligible for rollover treatment at all, so "replacing" withheld RMD money doesn't complete a rollover, it's a new contribution, and if it exceeds your contribution limit it becomes an excess contribution subject to a 6% excise tax until fixed. Second, if under 59.5, any withheld dollars you fail to replace inside the 60 days are a distribution you did not convert, so they are ordinary income **plus** a 10% early-distribution penalty. That penalty, not a 365-day clock, is the actual trap for the conversion maneuver itself.

#### The Other Maneuver

You can use the once per year method to pay taxes by withholding from an IRA to IRA rollover with repayment! The problem, of course, is needing the cash to pay taxes doesn't go away, and if you try the IRA-IRA rollover and do NOT repay into the target IRA, you owe additional tax on the withdrawn funds. One way that might work in your favor other than satisfying the timely withdrawal through withholding is if, for example, you expect a CD or bond to mature. You can gain up to 60 days for that to happen.

How it might work:

Withhold in December, replenish by early-to-mid February, and it's still a timely completed rollover, well inside the window. Because the 1099-R reports the distribution (and the withholding) in the year it happened, the withholding still counts as paid ratably throughout that December's tax year even though you don't actually replenish until the following year. You cure a current-year underpayment problem regardless of which calendar year the replenishment lands in.

It's genuinely two transactions serving five functions:

A. Timely tax payment. The withheld amount is sent to the IRS and credited as if paid evenly across the year, curing an underpayment penalty for the year of distribution regardless of when you replenish.

B. Partial withdrawal, on demand. Whatever portion of the distribution you don't roll back within 60 days simply stays a taxable distribution. You don't have to decide this upfront, you can distribute $X, and by day 60 decide you only want to replace $Y of it, keeping $X-Y as a real, permanent withdrawal, taxed as ordinary income.  (But note that extra income may result in an underpayment of taxes!)

C. Sixty days of float. Until the deadline, nothing is locked in, you can gather funds, watch the market, or just change your mind about how much to keep versus replace.

D. If you will be RMD age next year, the December withdrawal reduces the IRA balance and thus the RMD you pay in the next year.

E. Since you must liquidate assets to withhold, when you replenish you can invest in different assets. That is, you can rebalance your portfolio. In a IRA there are no consequences to rebalancing at any time, so this is a very minor extra.  We don't recommend trying to "time the market" but this *other maneuver* can take you out of the market for up to 60 days.  

The reason withholding fixes timeliness at all is [IRC 6654(g)(1)](https://www.law.cornell.edu/uscode/text/26/6654): withholding is credited as if an equal part were paid on each of the four due dates, whenever it actually happened. A December withholding therefore repairs a Q1 shortfall. A December estimated *payment* does not.

Safe Harbor is another "gotcha" in the tax code. If you "timely" pay 90% of your current year taxes and 100% or 110% of your prior taxes (depending on income), you will not get an underpayment/late payment penalty. See [IRS Publication 505](https://www.irs.gov/publications/p505).

More on Option C: [Form 2210, Schedule AI](https://www.irs.gov/forms-pubs/about-form-2210) is the annualized income installment method. It recomputes each quarter's required payment from the income you actually had by that point, so a conversion done in Q3 or Q4 is charged to the quarter it arose in instead of being spread back across the whole year. It can erase an early-quarter penalty with no withholding at all. The cost is an extra form plus quarter-by-quarter records of income, deductions, and withholding. It changes the penalty computation only, never the tax you owe. The [Tax Payment Planner](https://tools.netcitizen.us/RetirementTaxPlanner.html) names Schedule AI when your conversion lands late in the year and a shortfall remains, but it does not compute the result.

#### Roth Conversion Tax Withholding and Repayment

Because you can remove $30k from your IRA, move some to a Roth, have some withheld for taxes, move some into another IRA, and repay some or all of the withdrawn funds within 60 days, it made me wonder how that works. That is, what paper trail does the IRS use to determine whether you've done a withdrawal, a conversion, a roll-over or a contribution (which requires income and exceeds current limits). The IRS doesn't distinguish these by watching the transaction happen - it relies on two separate information returns from your custodian(s), then matches them via a form you file.

Your IRA custodian sends a 1099-R reporting a $30k gross distribution from the traditional IRA (with a distribution code indicating IRA money, e.g. code 2 or 7). It flags $30k as having left the IRA - it does not know or care where it ended up. Your Roth custodian sends a 5498 reporting what it actually received as a "conversion contribution" - say $20k or whatever amount actually landed in the Roth.

On your tax return, you file Form 8606, Part II, where you report the conversion amount. The IRS's matching system essentially reconciles the 1099-R (money out) against the 5498s (money in) and your 8606. If only $20k shows up as converted while $30k left the IRA, the other $10k is a taxable distribution - subject to ordinary income tax and, if you're under 59½, the 10% early-withdrawal penalty (conversions are exempt from that penalty, plain distributions aren't).  Of course, the whole withdrawal is subject to income tax unless some of the IRA withdrawal landed in another IRA, in which case the portion that moved from one IRA to another is a rollover.

If you make up the withheld $10k out of pocket and deposit it into the Roth within 60 days, that deposit generates its own 5498 as a 60-day Roth rollover contribution. Now the two 5498s together show $30k converted, matching the $30k on the 1099-R, and you report the full $30k as converted on Form 8606 - no penalty, though the withheld amount was still paid to the IRS as tax (that's separate from the taxability of the conversion itself, since conversions are fully taxable either way).

So there's no ambiguity resolved after the fact by IRS guesswork - it's a paper trail (1099-R + 5498s + your 8606) that either reconciles to $30k converted or leaves a $10k gap taxed as a straight distribution - or if under 59.5 invokes a penalty.

My understanding of this implies something else: even if you are **under 59.5 you can have taxes withheld from the conversion** and make them up within 60 days. The conventional wisdom is that withholding taxes counts as a distribution and the 10% penalty will apply. But not if you timely repay! Note that missing the 60 day replacement WILL result in a penalty which may be waived if you show good cause. "I forgot" will not be acceptable, but "I was in a coma in the hospital" might work. Check with your tax attorney before you try this, laws change and I am not a tax attorney!  One gotcha here: many custodians do not support the "obvious" paths below well, so pay attention to the "friction reduction" noted.

The following are 3 ways to convert $30k from an IRA to a Roth.

##### Scenario 1: $30k moved, no withholding

You convert $30k directly from the traditional IRA to the Roth. No 1099-R withholding involved. The Roth custodian's 5498 shows a $30k conversion contribution, matching the $30k distribution (on 1099-R), and the full $30k is taxable ordinary income for the year.

**Friction** - most custodians support this directly so it is low friction. For example at Fidelity a Roth conversion is simply a transfer from an IRA to a Roth. It's dangerously easy.

##### Scenario 2: $30k withdrawn, $10k moved, $20k withheld and replaced

The IRA distributes $30k. $10k goes straight to the Roth as a conversion (same mechanism as scenario 1). $20k is withheld for taxes. Within 60 days, you deposit $20k of outside funds into the Roth. The 5498s show $10k as a conversion contribution plus $20k as a rollover contribution, totaling $30k, which matches the 1099-R. Form 8606 reports the full $30k as converted, and it's fully taxable, same as scenario 1.

The lowest friction way to do this at a custodian is as follows:

Change the "withdraw" and "convert" operations from one messy operation into 3 clean ones.

1. Use the "distribution with withholding" option. This is a very normal distribution and most custodians directly support it. One possible gotcha is that you may not be able to withhold 100% of the distribution at some custodians. The withdrawal is reported on Form 1099-R.
2. Do a Roth conversion (transfer from IRA to Roth) of the direct portion. This is reported on the 5498 form.
3. Replace the withheld amount with a deposit into the Roth within 60 days. The custodian will report it as a rollover contribution on Form 5498.

In each scenario, the 5498(s) total $30k, and the 1099-R(s) total $30k.  If all transactions are at one custodian, it may come out as only two forms even if you do multiple transactions.  Note if under 59.5 and some is not repaid, it pops out on Form 5329.

##### Scenario 3: $30k withheld and replaced.
Scenario 3 is the same as scenario 2 with one less step: there is no "conversion" (no step 2).

##### Reconciliation and Notes
*Not tax or legal advice - consult a CPA or tax advisor before executing any of these scenarios.*

Since the multi-step - lower friction - procedure may produce multiple 1099-Rs and multiple 5498s instead of one of each, whoever prepares the tax return needs to make sure they are aggregated correctly on Form 8606 rather than one being overlooked.

Each scenario (1-3) produces an identical tax result: $30k converted, $30k taxable, no penalty (provided any withheld amount is timely replaced, or you're over 59½). The real-world differences are cash flow - how much outside money you need on hand to make the replacement deposit - and the 60-day deadline for scenarios 2 and 3.

**Sources:**
- [Fidelity IRA one-time withdrawal form](https://www.fidelity.com/bin-public/060_www_fidelity_com/documents/customer-service/withdrawals-ira-one-time.pdf)
- [Bogleheads: Fidelity, must call them to have withholding for Roth conversion](https://www.bogleheads.org/forum/viewtopic.php?t=455838)
- [Bogleheads: Roth conversion, tax payment options](https://www.bogleheads.org/forum/viewtopic.php?t=457507)
- [Rollovers of retirement plan and IRA distributions | IRS](https://www.irs.gov/retirement-plans/plan-participant-employee/rollovers-of-retirement-plan-and-ira-distributions)
- [Publication 590-A (2025), Contributions to IRAs | IRS](https://www.irs.gov/publications/p590a)

#### Moldy Brackets

While the Social Security payments are adjusted annually according to the CPI (Consumer Price Index), the rate at which Social Security is taxed is based on thresholds have NEVER been adjusted for inflation. When taxation of Social Security began (1983 for 50%, and 1993 for 85%) the thresholds were established and have not changed since. Each "fix" to the Social Security system to prevent bankruptcy is anchored in the time that Social Security became increasingly taxed.

#### IRMAA Escalation

My original model assumed that the IRMAA tax brackets and amounts are adjusted by CPI, but that's not true. The *brackets* are adjusted per CPI, but the amounts are tied to Medicare. The CPI has averaged about 2.8% annually over the last 20 years, but Medicare has averaged 5.6% annual increase.  IRMAA, as mentioned is a TAX CLIFF, not a graduated bracket. That means if you make $1 more than the maximum you move up an IRMAA tier. The result is not only the need to pay the tax, say an extra 4k per year, but you may have to withdraw more from an IRA to pay the tax.  At a 20% nominal tax rate, that extra $1 costs at least $5K AND may result in pushing you up into higher marginal brackets. IRMAA penalties will cost significantly more REAL dollars in the future - if you have a chance to eat IRMAA now, or eat IRMAA later, neither is appetizing, but the future will be more painful.

#### The Tax Torpedo

Those *Moldy Brackets* have added to another problem: there is a ["Tax Torpedo"](https://www.fidelity.com/learning-center/personal-finance/social-security-tax-torpedo-and-hidden-taxes) - along with several other tax "pitfalls" - that hits *middle income* retirees particularly hard. The so-called **Tax Torpedo** turns a portion of your income in the federal 10%, 12% and 22% brackets into an effective tax rate of 18.5%, 22.2% and **40.7%** respectively. To add more injury, eight states tax Social Security and that can make these rates even worse.  Here are the net effects:

#### State Tax Rates on Social Security Income by Federal Bracket Level (2026)

| State | Tax Structure | Rate at 10% Fed Level (~$10-20K) | Rate at 12% Fed Level (~$30-70K) | Rate at 22% Fed Level (~$75-150K) |
|-------|---------------|----------------------------------|----------------------------------|----------------------------------|
| **Colorado** | Flat | 4.4% | 4.4% | 4.4% |
| **Connecticut** | Progressive (7 brackets) | 2.0% - 4.5% | 5.0% - 5.5% | 5.5% - 6.0% |
| **Minnesota** | Progressive (4 brackets) | 5.35% | 6.80% | 7.85% - 9.85% |
| **Montana** | Two brackets | 4.7% | 4.7% - 5.65% | 5.65% |
| **New Mexico** | Progressive (5 brackets) | 1.7% - 3.2% | 4.7% - 4.9% | 4.9% - 5.9% |
| **Rhode Island** | Three brackets | 3.75% - 4.75% | 4.75% - 5.99% | 5.99% |
| **Utah** | Flat | 4.55% | 4.55% | 4.55% |
| **Vermont** | Progressive (4 brackets) | 3.35% - 6.60% | 6.60% - 7.60% | 7.60% - 8.75% |

#### Combined Tax Torpedo Examples (during 85% SS phase-out):

**At 12% Federal Bracket:**
- Federal effective: 22.2%
- + Minnesota (6.80%): **29.0% combined**
- + Vermont (6.60%-7.60%): **28.8-29.8% combined**
- + Rhode Island (5.99%): **28.2% combined**
- + Montana (4.7%-5.65%): **26.9-27.9% combined**
- + Colorado/Utah (~4.5%): **~26.7% combined**

**At 22% Federal Bracket:**
- Federal effective: 40.7%
- + Minnesota (7.85-9.85%): **48.6-50.6% combined**
- + Vermont (7.60-8.75%): **48.3-49.5% combined**
- + Rhode Island (5.99%): **46.7% combined**
- + New Mexico (5.9%): **46.6% combined**
- + Montana (5.65%): **46.4% combined**
- + Colorado/Utah (~4.5%): **~45.2% combined**

#### No "Long Term Capital Gains" in most states

33 of 50 states tax capital gains the same as regular income. Unfortunately many tools and many discussions neglect this aspect, which is another reason I wrote this tool. 9 states have no taxation or do not tax capital gains (as of 2026), and 9 states have preferential treatment of capital gains. [[Source]](https://www.theentrustgroup.com/blog/state-capital-gains-tax)

If you live in, or plan to move in a different state and you want to use this tool, you can! Most states are currently modeled. The ones that are not modeled are those with "weirdness" (e.g. those that tax social security, or have other odd gotchas that makes modeling state tax very different.)

#### Roth Conversion Gotchas

0. You withdraw/convert now at a (significantly) higher tax rate than you will face in your future. Converting into the 24% bracket might save you even if you expect to be in the 22% bracket, but converting into the 32% bracket will *likely* not help - at least this is the conventional wisdom, and I believe it is, like much conventional wisdom, is incomplete and does not apply universally.  Indeed, exploring the veracity of the conventional wisdom is one of the reasons I created the retirement optimizer. Let's say I have a healthy dose of skepticism.
0. You convert before you're 59.5 and do not have funds to pay the taxes AND/or that conversion pushes you into a significantly higher taxation situation.
0. You have modest IRA balances and expect that to be the case once you start drawing them in retirement. Modest here means something less than 1 million with 12 or fewer years before you plan to start drawing down assets. If you have 1M now, 10 years of 10% gains like those from 2016 to 2025 could TRIPLE that 1M to 3M.  3M will force you to take about 115k from your IRA at age 75. If married the RMD plus 70k in social security and other income MAY land you in the Federal 24% bracket - if inflation is low. At 83 just the RMD will put you in the 24% Federal Bracket.  If single, your first RMD may land you in the 24% Federal Bracket above the IRMAA tier 1.
0. Your remainder estate is going to charity (not people).  Charities pay zero tax regardless of the income source. If you can stomach the RMD forced income, it may not be necessary to bother with conversions.
0. You plan to take advantage of QCDs (Qualified Chraritable Deductions) after 70.5 years of age. QCDs satisfy RMD requirements, and do not count against your MAGI so can be used to avoid IRMAA penalties.
0. You already have a healthy mix of assets (e.g. 60% IRA/401K, 30% Roth, 10% or higher Cash/CDs/Bonds in taxable).
0. You have to pay conversion taxes solely from the IRA withdrawals. This is not the bad thing the pundits claim it is.
0. You plan to make relatively large annual withdrawals.  For example, assume you're 59 now and your IRA balance is 1M. It grows at a steady 8% annually. In 3 years you start taking 70K (adjusted for inflation, so actually 77k), at age 75 your RMD will be less than your planned annual withdrawal and remain so to age 99. This is "living on the edge", because any other income may push you into higher taxes and/or IRMAA penalties, but it may well be a scenario where conversions does not gain anything (financially). 


Here are some of the harms of having or accruing a large IRA/401K:

1. Growth in or size of the IRA/401K balance reaches a point where you end up in a higher tax bracket after RMDs start. This in ITSELF is not the problem. Yes, moving from the 12% to 22% Federal bracket sounds painful, but if it's only the last $1000 being taxed at the higher rate very little is being added.
2. RMDs cause you to have little to no room for managing your desired spend (i.e. avoiding IRMAA and/or NIIT) - if you don't plan to invoke QCDs. But remember, higher brackets are "bumps" not cliffs.
3. If the bulk of your assets remain in an IRA/401K, any large extra expenditure may cause a corresponding hit to your taxation (think remodeling, buying a new car, repairing a roof, or buying a vacation home).
4. Tax rates could go up significantly in the future (I argue they will go up!).
5. Social security bottoms out in 2033 (as it is on track to do), and you have to withdraw more to cover the loss of Social Security funds to maintain your style of living ... increasing your taxation.
6. Your spouse passes away. Now you're in a single tax bracket paying 30% more taxes for the same income (unless you remarry).
7. Your IRA (not 401K) crosses about 1.5m - in that case you could be forced to surrender some of it in a lawsuit. (401Ks have stronger protection). Roths are similarly exposed, but because Roth is not taxed, a smaller balance has greater value to you.
8. You (and your spouse) pass away. Your heirs will be forced to liquidate the IRA/401K balance within 10 years at THEIR tax rate. (Roths must be liquidated, too, but there is no tax).
9. If you or your spouse pass away, usually the most effective way to manage this is for the survivor to "take over" the deceased's IRA/401K balance. The now larger balance will be subject to the survivors RMD requirements. This might be better if the surviving spouse is younger, but could go the other way.
10. As your IRA/401K grows - and as you age, your RMDs will also grow. At some point this causes 85% of your social security to become taxable, AND causes IRMAA taxes, AND possibly NIIT.
11. IRA/401K withdrawals are taxable income in MOST states. Roth withdrawals are not taxable in any state.
12. You die wealthy, not having spent what you could have, and your heirs pay the highest taxes of their lives to draw down the remaining balance in 10 years. Though they may still be able to use QCDs if they are 70.5 at the time.

#### How Reliable Is the Break-Even Tax Rate?

The tool calculates a "Break-Even Tax Rate" for each year you convert. The BETR is visible in the Annual Details. The idea is from 3 folks at Vanguard who based their formula on publications by Michael Kitces.  It is intended to answer the question: how high would your future tax rate have to be for a conversion today to pay off? If you expect your future rate to be *above* that break-even number, converting looks worthwhile; *below* it, it does not. To check whether that number can be trusted, I built a test harness that runs each plan twice, once converting and once not, and finds the future tax rate at which the two plans finish in a dead heat. That is the honest, full-in break-even, because it captures everything the tidy formula leaves out: the larger required distributions a bigger IRA forces on you later, the extra Social Security that becomes taxable, the IRMAA surcharges, and where your surplus cash actually ends up invested.

The finding is that the displayed Break-Even Tax Rate is not trustworthy, and it can be wrong in *either* direction. The formula itself is algebraically correct, but it models only "money grows, then is taxed once" and ignores the cascade of knock-on effects above. In my tests the true break-even was sometimes far *below* the displayed number (so the tool discouraged conversions that clearly won) and sometimes far *above* it (so the tool encouraged conversions that clearly lost). Which way it erred depended heavily on a single modeling choice that has nothing to do with the formula: whether your surplus money is left sitting in cash or reinvested at market rates. Meanwhile the one input the formula fusses over most, the number of years until your required distributions begin, turned out to matter the least. The practical takeaway: treat the Break-Even Tax Rate as a rough conversation-starter, not a decision rule, and trust the plan's actual after-tax ending balances instead.

## Frequently Asked Questions

### Is It a Fool's Errand to Make Multi-Decade Projections?

The single most frequent objection to multi-decade projections is that it is all "*unknowable*". No one knows what future taxation, market growth, inflation, or spending shocks are likely to occur - so projection is a "fool's errand".

Arguments that assert "the future is unknowable, so why bother" neglect that forecasting doesn't require *certainty* to be useful; it requires the range of outcomes to be bounded enough to inform a decision. Directional correctness is still useful. 30-year capital markets and demographic data give a workable range even if any single point estimate is wrong. 

> Actuaries price life insurance and pensions on multi-decade projections professionally and profitably; the fact that no one nails the exact number doesn't mean the exercise is worthless.

A well-constructed range (Monte Carlo, sensitivity tables, scenario bands) still tells you whether a strategy is robust across plausible futures or only works in a narrow lucky case. Also, the alternative to projecting isn't some cleaner truth. Doing no projection is an *implicit* projection - just as "taking no action" **IS** a default action. Doing nothing, or assuming today's tax rates never change, or assuming zero market growth, are all projections too, just unexamined ones. Some inputs are far more knowable than others: mortality tables, the mechanics of compounding, and RMD schedules are close to deterministic, so a chunk of the "30 years out" uncertainty is smaller than a blanket dismissal would allow.

On the other hand: point estimates decades out have a well-documented history of being wrong, often badly, because the variables compound and interact rather than staying independent (a market downturn coincides with a recession that changes tax policy that changes your income that changes your bracket). Historical base rates back this up: 30-year forecasts of tax brackets, inflation, or market returns made in 1995 or 2005 would have missed major regime shifts (TCJA, zero-rate era, 2008, 2022 inflation spike) that materially changed the "right" answer in hindsight. There's also a real difference between a probabilistic range being technically producible and that range being decision-useful. If the 90% confidence interval on 30-year outcomes is enormous, as it often is for equity returns and tax policy both, the model can look rigorous while still not meaningfully narrowing the decision. And behaviorally, precise-looking long-horizon projections can create **false confidence**, leading people to over-anchor on a specific number rather than staying flexible as reality unfolds. 

In a Reddit discussion someone noted that for the early retiree the "4.7% withdrawal rate and the proposed '4.9%' withdrawal rate for a 50-year retirement" were *indistinguishable*. But not only was the "4.7% withdrawal number taken out of context", but over 50 years there is a consequential difference. A 50-year mortgage at the higher rate will result in 10% more total payment. For a retirement, that means a 10% higher starting balance is needed.

The take away: the real point isn't "don't model at all," it's "don't mistake a model's precision for accuracy."

### How does Cash Reserve work with dividends?

The **Cash Reserve** setting and **Dividend Reinvestment (DRIP)** are independent controls that interact to determine where your annual surplus ends up. Here's how it works:

**Cash Reserve** creates a target cash buffer (if set to a positive amount like $50,000). Each year, the tool calculates your surplus and routes it in order:
1. First, surplus fills the cash buffer up to your target (inflation-adjusted)
2. Any excess beyond the buffer overflows to your **Brokerage** account

**Dividend Reinvestment** separately controls where annual dividends go:
- If DRIP is **ON**: Dividends stay in the **Brokerage** account, reinvested at market growth rates. The basis steps up, so future capital gains are smaller.
- If DRIP is **OFF**: Dividends flow to the **Cash** account, growing at the cash yield rate (up to about 3%, vs. 7-10%+ market returns).

**The interaction:** Turning off DRIP diverts dividends from Brokerage to Cash, which fills your reserve faster but sacrifices market-rate compounding. Conversely, DRIP ON keeps dividends invested at higher returns, leaving your regular surplus to fill the buffer.

**Key gotcha:** The per-account growth rates differ dramatically. Money in Brokerage appreciates at market rates; money in Cash grows at much lower yields. So the location of your surplus has outsized impact on long-term wealth.

### When might Cash Reserve be depleted?

Your **Cash Reserve** is a protective buffer, but it can be drawn down if spending demands exceed available sources in a given year. Here's the order the tool uses to cover spending:

1. Draw from regular **Cash** balance first (no taxes)
2. If Cash runs out, liquidate from **Brokerage** (triggers capital gains tax)
3. If Brokerage is exhausted, withdraw from **Roth** accounts (tax-free, but reduces future growth)
4. If Roth is exhausted, take forced **IRA withdrawals** (ordinary income tax). **ACA Cliff** will not cross its income cap while that cap is in force, but other strategies will dip into the IRA to meet spend.
5. Only if all else fails, the tool dips into your hidden **Cash Reserve buffer** as a true last resort

When the reserve is breached, it's flagged internally so you can see in logs that this happened.

**Common depletion scenarios:**
Note: the *High spending year* and *Healthcare crisis* scenarios below are not modeled by the tool; the high-spending-year case is tracked separately in the backlog as "lumpy spending."
- **High spending year**: Unexpected major expenses or planned large purchases
- **Market downturn**: Brokerage value drops, forcing earlier liquidation to meet goals
- **Early retirement**: Spending exceeds portfolio growth in the first decade
- **Healthcare crisis**: Long-term care costs drain the buffer rapidly

**The practical implication:** A Cash Reserve protects you from some spending shocks, but only if your overall spending is sustainable. The tool flags if the reserve gets breached repeatedly, signaling the plan may be too aggressive.

### Where is cash interest routed?

**Cash interest always stays in the Cash account.** It doesn't move to Brokerage or anywhere else.

Here's what happens each year:
- Your Cash balance grows by the cash yield rate (e.g., 3% on $50,000 = $1,500 interest)
- That interest accrues directly in Cash and is reinvested there
- It's taxed as **ordinary income** (not the lower qualified dividend rate) - meaning your full marginal tax rate applies

**Contrast with dividends:**
- Dividends (with DRIP ON) move to Brokerage, reinvest at market rates, taxed at qualified rates
- Dividends (with DRIP OFF) move to Cash, taxed at qualified rates
- Interest has no qualified treatment; it's always ordinary income
- Dividends from some sources may be tax free or only taxable to the Federal or State government. This tool treats all dividends as "qualified".

**Why it matters:** If you maintain a large Cash Reserve, the interest compounds annually, but the after-tax return is lower due to ordinary income taxation. This is one reason the tool recommends enabling DRIP - to capture market-rate growth in Brokerage rather than letting cash balances idle at low yields. On the other hand, if you regularly will spend the cash, then having it available in the cash account is more convenient.

### Does the brokerage account for "cash"?

No - **Cash** and **Brokerage** are two separate accounts in the model.

**Brokerage** holds stocks, bonds, and investments. It:
- Grows at your specified market growth rate
- Accumulates unrealized capital gains (tracked separately as **basis**)
- Pays long-term capital gains tax on those gains when liquidated
- Can receive dividend reinvestments (if DRIP ON), which step up the basis

**Cash** is your high-yield savings or money market fund. It:
- Grows at the cash yield rate (up to about 3%, not market rates)
- Never has capital gains (interest is ordinary income)
- Serves as your spending pool and reserve buffer
- Can receive dividends if DRIP is OFF

**Why the distinction matters:**
- When you need spending money, the tool withdraws from Cash first (tax-free)
- When Cash runs out, it liquidates Brokerage and pays capital gains tax on appreciation
- The **Cash Reserve** setting controls how much to keep in Cash; surplus overflows to Brokerage for better growth

**Gotcha:** The tool tracks basis separately. When dividends reinvest to Brokerage (DRIP ON), the basis steps up by the dividend amount, reducing your future capital gains tax. If dividends route to Cash (DRIP OFF), there's no basis step-up, and you pay ordinary income tax on the interest later.

**A different "step up":** the dividend step-up above happens during your life and is driven by DRIP. The separate step-up *at death* under IRC §1014 is modeled too. Watch the Basis column through the year a spouse dies and you will see it jump rather than keep falling: by half the unrealized gain in most states, by all of it in a community-property one. The final row jumps again, all the way to the account value, because heirs inherit at market. See [Limitations and Restrictions](#limitations-and-restrictions) for what is still approximate about it.

### How does the ACA limit work?

The **ACA Cliff** strategies hold your income under a chosen multiple of the Federal Poverty Level (200%, 250%, 300% or 400%) so that you stay eligible for a premium tax credit on a Marketplace health plan. It is the only strategy in the tool with a **hard** ceiling. Every other ceiling is soft.

Note that the correct way to use ACA is to set your spend goal to whatever you want it to be AFTER ACA (age 65). 

**Why it is hard, and what that looks like.** Going over a bracket boundary costs you a slightly higher rate on the dollars above it. Going one dollar over the ACA limit can cost you the entire premium subsidy for the year. That is a cliff, not a bump, so the strategy will not step over it, ever. If Cash and Roth run out and the only money left is in an IRA, the tool **reports an unfunded shortfall rather than drawing from the IRA**, because that withdrawal is taxable income and would breach the cap.

So a shortfall on an ACA row is not a bug and not a failure to find a solution. It is the answer to the question the strategy asks: *can this plan be funded without breaching the cap?* When you see one, the answer is no. Every strategy will draw the IRA to fund the goal - but NOT breach the income limit.

**What the tool models, and what it does not.** This matters more than anything else on this page:

- It models the income **cap**. It does **not** model the premium **subsidy** the cap buys.
- So an ACA row shows you what staying under the limit **costs** you, and nothing about what it **saves** you. The strategy therefore looks worse than it is, and by an amount the tool never calculates. You have to price the subsidy yourself and weigh it against the cost shown.
- Compare the ACA row's ending wealth against your own estimate of the credit over those years. The tool cannot make that comparison for you.

**The cap ends at Medicare.** Premium subsidies stop once you are eligible for Medicare, so from the first year in which **every living person in the plan** is old enough, the cap is dropped and the strategy funds spending like any other. Two consequences worth knowing:

- It is every **living** person, not every person. If one spouse dies before reaching Medicare age and the survivor is already past it, the cap ends that year.
- Until then the limit is measured against **household** income. If one spouse is on Medicare and the other is not, the older spouse's required distributions and Social Security still count against the younger spouse's limit.

**A lower percentage is a stricter limit.** 200% FPL is harder to stay under than 400%. So if the Optimizer flags one ACA row as untenable, every lower one is flagged too. That is an invariant, not a coincidence.

**Known limitations, stated plainly:**

- The poverty level is the 2025 figure ($15,060 single, $20,440 for a couple) inflated forward by your CPI assumption. Real FPL figures are published annually and will not track CPI exactly.
- Only one-person and two-person households are modeled. If anyone else is in your tax household, your real FPL is higher than the tool's, so the tool's limit is **too strict** and it will understate what you can withdraw.
- The 400% cliff assumes current law. The enhanced subsidies that were in effect from 2021 through 2025 had a gradual phase-out, but current law is a cliff. If phase-out is restored, a 400% row in this tool will be **more pessimistic** than reality.
- Alaska and Hawaii have higher poverty guidelines and are not modeled, so for those states the limit is again **too strict**.
- The tool does not model Medicaid eligibility at the low end, cost-sharing reductions below 250% FPL, or the difference between MAGI for ACA purposes and the MAGI it computes for IRMAA.

### How do I find the most efficient Roth conversions?

The tool provides a built-in diagnostic called **Stop-Year** that identifies the optimal conversion cutoff. Here's how to use it:

1. **Enable conversions** (set up a strategy: Extra Annual Roth Conversion, or let it bracket-fill)
2. **Look for the "Break Even ⓘ" diagnostic**
   - It shows the first year your plan's after-tax wealth permanently overtakes a no-conversion scenario
   - This is a milestone, but *not* always the best stopping point
3. **The Stop-Year suggestion** appears as: *"Stop after 2031 - gain $125k vs converting through 2040, gain $340k vs never converting"*
   - This is the year that *maximizes* your after-tax wealth
   - Click **"Stop after YYYY ▸"** to apply it one-click
   - It often differs from Break-Even by significant amounts ($662k+ in some scenarios)
4. **"Optimize for" selector** re-orders the whole Optimizer table by the goal you pick, and moves the ⚓ baseline to match. There are nine choices, shown here in order you might use them for efficient Roth Conversions:
   - **Earliest Break Even**: Soonest year conversions permanently pull ahead, ties broken on net wealth
   - **Roth Conversion Effectiveness**: Ranks by how much the conversions themselves gained
   - **Maximum Roth**: Largest ending Roth balance
   - **Avoiding Widow & RMD Tax**: Least RMD tax paid during the plan *plus* the tax still owed on whatever pre-tax IRA is left at the end
   - **Tax Flexibility** (default): Among plans within 10% of the best after-tax net wealth, the one whose three buckets (pre-tax IRA, Roth, taxable [brokerage and cash]) are closest to equal - maximum freedom to draw from whichever bucket is tax-advantaged each year
   - **Maximum Net Wealth**: Highest after-tax ending balance
   - **Minimum Lifetime Taxes**: Lowest total tax bill
   - **Maximum Spending**: Most lifetime spendable dollars
   - **Balanced (Wealth + Spend)**: The blended score the tool uses to pick its own baseline

**Key insight:** Break-Even tells you when conversions "paid off"; Stop-Year tells you when to *stop* for maximum final wealth. Generally you'll want to stop both "annual" and "opportunistic" conversions.

### Why does the Optimizer say converting never helps?

Turn on **Optimize Conversions** and you may get a message saying it examined the best strategies and found none where converting more improves the result. That is a real answer about your plan and the tool now tells you enough to check it yourself.

The message names the **future tax rate your plan is assuming** (the "Future IRA Tax %" field, which defaults to a rate derived from your own plan). Whether a conversion pays comes down to a comparison: you pay tax now at today's marginal rate to avoid tax later at that future rate. If the future rate you are assuming is not meaningfully higher than what you would pay today, converting is simply a bad trade, and the tool says so.

Click **"What rate would change that?"** and the tool searches for the lowest future tax rate at which converting would start to pay, then reports that rate along with how much it would convert and what you would gain. Using the stock example plan, it reports that conversions start paying at about 43%, against the roughly 30% the plan assumes. Set "Future IRA Tax %" above the reported figure and re-run, and conversion rows appear as promised. If no rate up to 75% makes conversions worthwhile, it says that plainly too.

Three things worth knowing before concluding conversions are useless for you:

- **Your spending rate matters more than your tax rate.** A plan spending heavily relative to its portfolio is consuming the IRA anyway, which leaves little for a conversion to improve. In testing, dropping the example plan's spending was a far stronger lever than any tax assumption.
- **Check your Cash Reserve setting.** With Cash Reserve off, surplus money sits in cash earning the cash yield, which quietly makes almost anything that moves money out of cash look like a win. A conversion "gain" that disappears once you turn Cash Reserve on was never a conversion gain.
- **Converting for a few years and then stopping is a different question.** The Optimizer tests that shape too, and flags any plan it finds with a ⏹ and the year conversions stop. On some plans this is the only conversion strategy that pays at all.

### What about Doing all Conversions rather than withdrawals?

With this observation:

_**The tax consequences of an IRA withdrawal and a Roth conversion are identical**_.

We asked and modeled doing all conversions for spending rather than withdrawals. That is, every withdrawal for spending is FIRST a Roth conversion. Taking that approach you may gain these benefits:

+ until you spend the funds, you get tax free growth.
+ unspent funds will have automatically been converted - no extra step. 
+ spent funds may have accrued some interest before they were spent that will continue compounding (tax free)
+ If you have surplus cash in the brokerage or a taxable account, you can use it to pay the tax bill and get a larger amount converted to tax-free status.

Modeling this found a flaw, which in hindsight might be obvious: the most effective conversions are those that use cash (an asset that does not appreciate as much). Conversions that pay the tax from the Brokerage increase income and taxes. Once cash is run-out, there is diminishing gain from "conversion first". In fact, a strategy that then becomes "spend from Roth" runs the risk of defeating the purpose of "conversion first".

### Is the Break-Even Tax Rate Trustworthy?

Several studies of Vanguard's "BETR" have poked holes in it. So the answer is: **BETR is not very trustworthy**. We still calculate it and show it in Annual Details, but no longer feature it in the Optimizer columns, or on the summary page.

The **Break-Even Tax Rate (BETR)** uses the formula created by [Passman, Wong and Dickson](https://corporate.vanguard.com/content/dam/corp/research/pdf/a_betr_approach_to_roth_conversions_072025.pdf) of Vanguard to answer: *"How high would your future tax rate need to be for this conversion to pay off?"* If you expect rates to rise above that number, converting looks good; below it, it looks bad.  Passman, Wong and Dickson reference Michael Kitces' [Roth or Not to Roth](https://www.kitces.com/wp-content/uploads/2014/11/Kitces-Report-May-2009.pdf) paper - but that paper looks at whether accumulation into Roth is preferable to accumulation into an IRA and then expands to Conversions. It's worth noting that when Kitces wrote the paper there were several "loopholes" in the conversion laws that have subsequently been closed. E.g. a Roth Conversion is no longer undoable.

**The problem:** The formula is mathematically correct but incomplete. It models "money grows, then is taxed once" completely missing the cascade of real effects that the full simulation captures:

- Whether your surplus cash sits idle or gets reinvested. Idle surplus cash is itself a tax drag.
- Inflation simultaneously devalues all assets and widens future tax brackets. Paying 22% on the last 10k of income this year does NOT imply that 22% will be paid on the last $10k of income ten years from now.  Assuming 2.5% annual inflation [$162k of MFJ income in 2026](https://tools.netcitizen.us/standalone/IncomeTaxPlanner.html?st=MFJ&s=CA&a1=65&a2=65&ss=0&pt=0&cs=0&cb=60&yr=2034&in=2.5&me=2.5&ob=1&sh=0&pi=162000&zl=50000&zh=210000&zs=2000&az=0) would incur 14.7K federal tax. But in 2034 $162k would incur 13.6k in tax. In 8 years 162K will be the equivalent of 197k in future dollars. Tax on $197k then will be $21k in future dollars and worth $16.4k in current dollars.  
- IRMAA surcharges kick in from higher income (one of the biggest misses) and BETR doesn't model that.

And BETR misses the other side of the issue:
- Larger IRAs force bigger required distributions later
- Bigger RMDs may cause more Social Security to become taxable

**The practical result:** The displayed BETR is often unreliable in both directions. Sometimes it is far too low (discouraging conversions that clearly win); sometimes far too high (encouraging conversions that clearly lose). Which way it errs depends on your specific situation, especially your cash reserve strategy, and, more importantly, the amount of time that elapses between conversion and possible consumption.

##### What we recommend instead of BETR

- Use the **Stop-Year** diagnostic instead (it simulates the full cascade and finds the wealth-maximizing cutoff)
- Trust the **Break-Even *year*** (when your plan pulls ahead) not the *Break-Even tax rate*
- Let the plan's actual after-tax ending balances guide your conversion decisions

Professor Emeritus Edward McQuarrie pretty forcefully proves in [Net Present Value Analysis of Roth Conversions - 2024](https://www.financialplanningassociation.org/learning/publications/journal/SEP24-net-present-value-analysis-roth-conversions-OPEN) that Roth Conversions are unlikely to break even. Despite the conventional wisdom that the gains are driven by differences in tax rates - that is **not** the primary factor. The hurdle to overcome with early tax payments is that the lost value of early taxes requires enough growth time in the Roth to overcome the opportunity cost.  Opportunity cost, briefly, is what you surrender when you pay taxes out of funds that would have remained invested and growing. Also consider that paying $10k in taxes this year is worth more than the same (or larger) figure paid in 5 or 10 years due to inflation. Future (or present) tax avoidance is not the whole picture.

Our personal opinion: any conversions you can do in the Federal 12% or 10% brackets may not appreciably improve wealth or taxation, but they also won't significantly decrease net outcomes.

### Stress Test vs Monte Carlo Analysis

The Monte Carlo tab runs three different things and it is easy to read one as the other. The main projection is a Monte Carlo: many randomized paths, scored as a survival rate. There are TWO Monte Carlo regimens: historical, and synthetic (which itself comes in two flavors - see below). The Stress Test is not Monte Carlo at all: it is a fixed, deterministic replay of the worst starting years that actually happened. One asks "how does this plan do across a range of possible futures", the other asks "would this plan have survived the worst of the real past". A plan can look fine on one and poor on the other, and neither number is a forecast.

For how accurate any of this can be, and why two tools rarely agree, see [Monte Carlo and Chance of Success - How accurate?](#monte-carlo-and-chance-of-success-accuracy).

The difference between "Historical" and "Synthetic" is that Historical chooses 3-year random buckets of real data to test your portfolio - including the inflation that occured in those periods. Why 3 years at a time? The market has been "cyclical" for as long as it has existed. Upward and downward trends tend to last more than a year and 3-year periods thus capture the observed market trending. To be clear, the market has also seen decade long trends (e.g. Stagflation of the 60s and 70s and the Lost Decade of the 2000s). The Stress test hits those short painful, or long painful periods by replaying real data.

Synthetic uses randomized market variations, and randomized inflation to go with them. Each path draws its own inflation from a model tuned to US consumer price data for 1948 to 2025, so prices cluster the way they do in the record - a bad stretch tends to stay bad rather than reverting to the average next year - and inflation leans high in the years returns are poor, which is the pairing that actually breaks a plan. Randomization - in theory - can emulate markets that we have not yet seen - and "by luck" some that we have. Each method has its charms. None can fortell the future.

Synthetic comes in two flavors, and they differ only in what the growth rate you type means. **Synthetic - GBM** treats it as a drift in logarithms, which puts the middle of the yearly returns below the number you entered - type 7% with 15% volatility and the median comes out 6.05%. **Synthetic - AAM** treats it as the plain average of the yearly returns, so the middle IS the number you typed. Neither is more optimistic than the other about how much money you end up with: volatility drags on compounded growth in both. They draw the same market shocks from the same seed, so switching between them compares the two definitions rather than two different runs. A **Fixed Inflation** button turns the inflation variation off and reproduces the model that shipped before all this.

#### How many simulations is "500 paths"?

Let's start with an obvious question: Why 500? Why not 100, or 1000, or 10,000? See the discussion [Monte Carlo and Chance of Success - How accurate?](#monte-carlo-and-chance-of-success-accuracy) but the short answer is more paths doesn't mean "better". 500 is chosen to run the most scenarios in a reasonable amount of time (less than a minute).

The Paths box in *Advanced Parameters* (not normally visible) is the number of paths run **per withdrawal strategy**, not the size of the whole run. The Monte Carlo tab has two "Run" buttons. **My Plan Only** runs 500 paths of your plan times the number of years your plan covers. **Compare All Scenarios** simulates every strategy the Optimizer knows how to build, so it can rank them against each other - and includes your plan. Each withdrawal strategy has options. The total number of strategies plus variations is about 144. By default, therefore, *Compare All* runs 500 iterations times 144 strategies over the number of years in the plan (say 30). Where "My Plan Only" may run 500 times 30 (6000) years, *Compare All* runs 144 times more (1.8 million years).  Fun fact: each year of the plan may do as many as 4 complete taxation calculations. Your Tax accountant does far less work by comparison.

Your own (current) plan is called out separately from the ranking of all other plans. It is pinned with a 📍 to the top of the survival table whatever you sort by, drawn as the thick line on the chart, and its chance of success is stated in a sentence above the chart.

#### What the Stress Test actually does

It runs your plan against the worst *actual* retirement start years in the historical record, one simulation (complete path) each, and it is entirely deterministic. Before it runs anything, it ranks every start year by its REAL return over each of five lengths (5, 10, 15, 20 and 30 years) and takes the worst from each. How many it takes per length is the Stress sequences box, 20 by default. Since those different lengths often flag the same year, the repeats are discarded, so the union is far smaller than the sum: 20 per length gives about 40 distinct start years rather than 100.

This is DIFFERENT from the worst market downturns, by the way. How? Well, for example the 2008 Global Financial Crises where the market lost 37% is not among the years it picks. 2007 is! 2007 begins the second worst 5-year stretch in the market which over those 5 years saw a net -12.3% Real Compound Annual Growth (loss) rate - of course the 2008 crash is part of the reason. There a lot of ties for 5-year stretches that had -8.4% real CAGR - the late 1950s through the early 1970s.

Stress Test runs your portfolio and withdrawal strategy starting in each of those worst years in history - including inflation - and notes how many end in ruin. And it shows you the score, for example "7 of 40 Fail".

It charts each of those years (failing years are in yellow or red, surviving years in green) and provides a detailed table below that shows the particulars: which 5 year, 10 year periods during the plan that were the worst.  You can sort or hover over the table. Clicking it will isolate the chart to just that year. Clicking the same year again will restore all the graphs.
The chart colors each line by what happened to your money, and when: red ran out in the first half of your plan, amber in the second half, green never ran out. 

The Stress Test doesn't randomize anything. And the one "gotcha" is that if your plan outlives the last year for which there is data, it starts over in 1928. That makes it "extra bad". A 35-year plan that starts in 1999 gets the actual 1999 through 2025 data, and then, having run out of history, wraps around and continues with the actual 1928 results onward. When the tool wraps around, it draws the graph at the wrap point with a dashed rather than solid line. But you'll probably notice because, remember 1928 began the worst crash in US history.

The Stress test will always produce the same result given the same withdrawal strategy.

There is a special option that exposes two Stress Test window choices.
- **Combined (5/10/15/20/30)**, the default, scores every window and runs the union of what each one flags. The count is per window, and because they overlap the union is far smaller than the sum: the default of 20 gives about 40 distinct start years rather than 100. Hovering over a row says which windows flagged that year.
- **All start years** skips ranking entirely and runs every start year in the record, currently 98. At that density individual lines stop being readable, so survivors fade into the background and failures are drawn solid and on top. The question at that point is not which line is 1966, which the table answers, but how much of the record this plan does not survive.

Notes about the table below the Stress Chart:

A sequence can open calmly and still contain the decade that breaks the plan. Hovering over a row adds the equity, bond, international and inflation rates behind it, which windows flagged that year, and where the record runs out. Bonds and international are reported but not ranked on; the choice of worst start years is made on real equity return alone. International data begins in 1970, so a scenario starting earlier shows domestic equity in its place, which is the same substitution the simulation itself makes.

Because the Combined selection picks sequences that are the worst on record, failing some of them is not a prediction. All start years makes the same point the other way round, by leaving nothing out. Either way it is a durability test.

### How Do I Evaluate Tools for Privacy and Security?

This tool, and many of the tools in the [reviews above](#what-about-other-tools), have been reviewed for malware, privacy leaks, and in some cases for accuracy.  Evaluation is easy to do with modern AI tools if the source code is available (and the AI is sufficiently capable). It is much harder to evaluate commercial software, since those tools typically do not expose their source code.

Here is the AI command I provide to Claude Code when evaluating tools. I vary it a bit depending on what the tool is stated to do - for example, if it doesn't claim "Roth Break Even" calculations, I omit that section. As written, it requires the source code locally, but you can point it at a website.

```
Analyze this code for the following potential problems. List the problem and where possible the suspected cause in "FlawsToFix.md"

A. Any user exploitable flaws in the code that might expose the code creator to increased costs, denial of service attacks, hijacks, or failure to validate arguments, and failure to halt.

B. Any leaks, or probable leaks of PII (Personally Identifiable Information) that exist or may be created by use of the program or through exploiting flaws.

C. Validate to within a dollar accuracy of the following flows:

State and Federal Tax calculations for single AND married filing jointly filers. Test border cases like IRMAA brackets, NIIT, capital gains.

For Roth Conversion "Break Even". Does the analysis use reliable financial accounting techniques?

Proper inflation (at CPI) of Federal and applicable state tax brackets, IRMAA.

Improper inflation of tax thresholds (like NIIT, unindexed state brackets, SS taxation thresholds)

Ability to adjust/forecast Consumer Price Index (CPI)

Any obvious misses in the code.

First spouse death handling: do TDAs get rolled over? Does the tax bracket change appropriately? Is SS survivor benefit properly calculated?

Validate that all tracked accounts are properly accounted for - that is they reflect earnings, withdrawals, and contributions accurately.

D. Document any missing taxation related issues in priority order in "MissingFeatures.md".

E. Identify any architectural issues/problems and document them in "ARCHITECTUREIssues.md" including missing test cases, useless/orphaned test cases and organizational issues (duplication of code rather than reuse). Also note any hard coded conditions or constants that are likely to change when there are changes in the tax laws of the federal or state(s) supported.

F. Identify any usability issues that may apply to the current implementation in a large browser window, and or using a smaller real-estate device (like a tablet or smart phone). Summarize usability findings in "UsabilityFlaws.md"

Provide a two paragraph standalone summary of the top 5 most important issues/flaws/problems from among the findings. Save this summary in "IssueSummary.md"

Create a PDF that includes all the created documents in one document. "[todays date] findings.pdf"
```

PDF is easy for you to read. MD (mark down) files are more digestible by AI tools.

### What Should I Look for in Retirement Tools?

This is up to you, of course. Some red flags are tools that ask for inputs that are unclear. For example, "growth rate" can mean "market growth rate", or it can mean "real growth rate", which is adjusted for inflation. A tool that only uses a real growth rate cannot make accurate RMD calculations - RMDs scale with the account balance, not with the current dollar value of that balance.  While most taxation does scale with inflation, several things in law do not, so a real growth rate tool can't get them right.

A tool that doesn't have a way to vary inflation is immediately suspect.

> Inflation is the greatest killer of retirement portfolios.
>
> ~ Bill Bengen (father of the 4% rule)

A tool that doesn't separately account for healthcare inflation (Medicare) will miss on calculating IRMAA and health care costs.

A tool that models states with a "flat tax" concept can miss very badly. State tax laws are [hideously complex](#some-of-the-things-i-learned-about-taxation): some states have no tax (easy to model), some have a flat tax, some with flat taxes also tax retirement income, and some do not. Some have generous exceptions for retirement income. Some have meager allowances. Those states that do not tax retirement income at all, still tax dividend and interest income. 

There are in fact over 4600 tax jurisdictions - including state, county, special and municipal jurisdictions. For example residents of Maryland and Indiana have not only state taxes, but every county also has an income tax. Many municipalities have a city tax: New York City, Yonkers, Philadelphia, Pittsburgh and Scranton, also Portland, a smattering of cities in AL, CO, WV, and NJ along with *every city in Ohio*. As your income sources and asset balances change, your income will likely vary too, so modeling a state with graduated brackets as a flat tax will be wrong. Modeling, say Maryland with it's brackets from 2 to 6% base tax rate must also include the 2.2 to 3.3% additional county taxes. 

Accurately calculating "break even" for Social Security claiming or Roth conversions is rarely done in a fiscally responsible manner. What is responsible? Calculate using current dollars, and future dollars adjusted to current dollars. Calculate lost opportunity cost (if the dollars had stayed invested where they were - and no extra tax paid - what would the outcome likely have been?).  And when calculating opportunity cost, use a like-for-like comparison. Paying $1k in taxes from cash has a different consequence from paying $1k by liquidating more IRA or selling an appreciated asset. One tool I evaluated allowed "unlimited cash" for Roth Conversions - who wouldn't love that retirement!

A tool that doesn't separately model IRA balances, have a Birth Year for each spouse will not be able to accurately calculate RMDs, or understand what "retire at 65" means (if it knows only your current age - it doesn't know if you will be 65 before the end of the year or not until the next). To calculate accurately it will also need the Birth Month for each spouse. A tool can't correctly calculate Social Security for the first partial year unless it allows you to say what MONTH and year social security begins.  Further, not knowing your birth month means it can't accurately determine when you are 59.5 (for penalty free IRA/Roth withdrawals), when you reach 70.5 for QCD eligibity. And it may also not correctly calculate whether you are eligible for extra senior standard deductions. I might, for example, be 64 right now, but my birthday falls in December so I *will* be eligible.

#### Monte Carlo and Chance of Success Accuracy

A Federal Tax calculation is well described and, if properly implemented, will be EXACT. But Monte Carlo and "Chance of Success" calculations should always be suspect. Monte Carlo is a *technique*, not a specific algorithm. Results are not comparable across tools because unlike tax calculations there is no prescriptive method to run Monte Carlo. 

A primitive way to describe Monte Carlo is to imagine drawing balls from a shaken bag numbered 1 to 75 - as happens in many Bingo parlors. Unlike Bingo, the drawn balls are placed back into the bag after each draw. The outcomes can land anywhere from -30% (if you draw a 1) to +50% (if you draw 75). You can see already why this won't be that much like the real market. A -90% and a +100% are also possible outcomes in a real market - very unlikely outcomes, but possible.  Moreover drawing two (or three) 1s or 75s in a row can, of course, happen but we've never seen those two outcomes in successive years - ever - so far.  Monte Carlo, simplified, then works like this:
For a retirement of 30 years, draw a ball, note its number, and then replace it in the bag. Do this 30 times. Each year's returns are determined from the ball drawn for each year. Any needed distributions are taken from the assets each year. If the portfolio balance ever hits zero (becomes bankrupt), the "outcome" is a *fail*. If after the 30 years of ups, downs, and annual withdrawals remaining assets end with a $1 or more, it's a *success*.  Now repeat the same process 100, 500, 1000, or 10,000 times. Total up the number of successes, divided by the number of trials and you get a percentage *chance of success*.

To the extent that the Monte Carlo simulations are unlike past and *possible* future market/economic behavior, inaccuracy cannot be overcome by increasing the number of iterations. More iterations fix imprecision, not a broken sampling method. Weighing yourself a thousand times on a scale that is off by five pounds will falsely increase your confidence, but it will be just as wrong as 2 or 10 weighings.

One major flaw with most Monte Carlo implementations is that they generally vary "returns" by asset volatility. That is consistent with the market, but by itself it is insufficient. Inflation destroys the value of non-volatile assets just as efficiently as it does the volatile ones. Volatile assets have the ability to recover from a 20% loss. However, Cash/Bonds/Money Market funds have no savior. There is zero chance that your cash (or bonds) that got eaten by 13% inflation over the last several years is going to earn that loss back - ever. Some of the worst periods in US history had market gains, but [staggeringly high inflation erased all the gains](standalone/RealReturns.html?yr=1969&ny=10&xi=0).

[Boldin](#boldin), for example models their Chance of Success (Monte Carlo) on a [FIXED inflation number](https://help.boldin.com/en/articles/11708904-faq-on-monte-carlo-updates) while [ProjectionLab](#projection-lab), and the [Retirement Optimizer](#the-retirement-optimizer) model inflation variation. A model that doesn't vary inflation is not close enough to reality to be very useful. Moreover, Monte Carlo is typically implemented using "Geometric Brownian Motion". A strategy sometimes called "drunk man's walk". The "draw a ball" model earlier reveals that a draw of 1 and 75 can occur one after the other - that would be true "randomness" - not unlike a drunk man lurching from losses to gains and back. But in the real world one segment of the economy spills over into another resulting not in a "random drunk walk" but in a sustained directional stagger. Upward and downward trends tend to last for more than one period. This is often called persistence or momentum. Bad news begets bad news and declines stack on declines. Improving conditions can halt the downward momentum and result in a hopefully longer period of upward persistence.  Or as market traders might quote: "The trend is your friend - until it bends".

This observation also gives rise to another: prices and rates change quarterly, monthly, daily, and even hourly.  It might seem that modeling on a more frequent basis would cover more ground, but if the model isn't realistic, more frequency - like more trials - doesn't improve the accuracy. Where more frequent (say monthly) modeling might apply is where people are involved who are watching their portfolios blossom into awesomeness (and taking profits), or retreat from the market amid falling market panic. I have yet to see a Monte Carlo model that tries to behave like a human. (Of course we recognize that some humans are not very recognizable as human)

There is another gotcha built into Monte Carlo that is only well understood by people who have a background in encryption - where randomness is extremely important. Randomness is surprisingly hard to do well. If you were able to achieve true randomness in drawing bingo balls: no two complete Monte Carlo simulations are likely to ever be the same. That is, every time you run the simulation you would get different results with the same starting conditions. Some shipped software suffers from this very problem with people asking "*I didn't change anything, why did my chance of success move from 78% to 76%?*"  You can see this for yourself using the [Monte Carlo Experiment Feature](https://tools.netcitizen.us/retirement_optimizer.html?montecarlo). It will illustrate how randomness and the number of iterations change the outcomes. You can also play with the tool manually (varying "seed" and "Paths" and rerunning *My Plan Only*). 

Over the last 100 years, the US has observed declines about 23% of the time. Some declines have been sustained for a few months, some for a decade or more. 
That means the market has been neutral or positive the other 77% of the time.  A Monte Carlo model that doesn't have the ability to mimic observed behavior at least some of the time can completely miss creating conditions like those that have occurred. And a model that doesn't stray outside the bounds of what has been seen is also not as helpful, because a more volatile future is also a possibility.

Conclusions:

- **No single tool can be "completely right"**. Monte Carlo is not a "precision instrument".
- **No two tools are likely to be comparable because the implementations are different**.
- **Do not mistake precision for accuracy**. A 77.52% chance of success (or 79% for that matter) is not more precise because it has more digits or ran more trials.
- **Actual humans** behave differently when the market is topsy turvy - and that also affects outcomes. Nervous humans may try to time the market by selling even when they know they *shouldn't* or by cutting spending (arguably a better strategy).
- **Changing landscapes may cause changes in not just taxation, but in what assets are better kept vs spent**. 
