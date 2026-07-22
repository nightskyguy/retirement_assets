# Retirement Planning Tools

> [!WARNING & DISCLAIMER]
> **There is no SUPPORT for these tools** and no guarantee of accuracy, or appropriateness of use. No warranty of suitability for any purpose. There is also *no charge*. **USE AT YOUR OWN RISK**


## Who Are These Tools For?  What Can They Do? 

You can DIRECTLY invoke these tools:

+ **[Retirement Optimizer](https://tools.netcitizen.us/retirement_optimizer.html)**  A full tool, with optimizers!  This is the original, and most featured tool.
+ **[Historical Real Returns](https://tools.netcitizen.us/standalone/RealReturns.html)** How did stocks, bonds, and T-bills really perform after inflation? 98 years of data (1928–2025) with a custom allocation mix.
+ **[Income Tax Planner](https://tools.netcitizen.us/standalone/IncomeTaxPlanner.html)** What does taxation look like at different ordinary income levels (includes many states)
+ **[Retirement Tax Planner](https://tools.netcitizen.us/RetirementTaxPlanner.html)** Compares 3 ways to pay taxes in retirement - provides reminders. Retirement Optimizer calls it.
+ **[Retirement Projection](https://tools.netcitizen.us/Retirement_Projection.html)**  What will my retirement assets do? It's very VISUAL but not as rich as Retirement Optimizer.
+ **[IRMAA and Medicare Future costs](https://tools.netcitizen.us/standalone/FutureCost.html)** Will IRMAA kill me?
+ **[After Tax REAL Growth](https://tools.netcitizen.us/standalone/AfterTaxRealGrowth.html)**  What growth rate do I need to stay ahead of inflation?
+ **[HYSA Real Returns](https://tools.netcitizen.us/standalone/HYSA.html)** Does my "safe" high-yield savings account actually grow after taxes and inflation? Annual and cumulative views in one tool.


All tools are "open source". Nothing is hidden.

A California resident built these with [Google gemini](https://gemini.google.com), [claude.ai](https://claude.ai) and [ChatGPT](https://chatgpt.com") AI assistance. The author is a retired software engineer, spreadsheet twiddler, has a strong knowledge of Python, and Javascript. See **Standalone Tools** and **Key Features** below for a summary of what the tools can do - and be sure to look at *What the Tool IGNOREs* (and *Known Bugs*, below) so you understand the limitations of the *Retirement Optimizer*.

## Table of Contents

- [Who Are These Tools For? What Can They Do?](#who-are-these-tools-for--what-can-they-do)
- [Standalone Calculator Tools](#standalone-calculator-tools)
- [The Retirement Optimizer](#the-retirement-optimizer)
  - [Features in the Works (and Known Bugs)](#features-in-the-works-and-known-bugs)
  - [Why This Tool?](#why-this-tool)
  - [Key Features](#key-features)
  - [What the Tool IGNORES](#what-the-tool-ignores-no-plans-to-implement)
  - [Limitations and Restrictions](#limitations-and-restrictions)
- [What about Other Tools](#what-about-other-tools)
  - [Free Tools](#free-tools)
    - [NestWise](#nestwise)
    - [Retirement Figures](#retirement-figures)
    - [AARP Federal Tax Calculator](#aarp-federal-tax-calculator)
    - [Visual Federal Tax Tool](#visual-federal-tax-tool)
    - [NumberCrunch Nerds](#number-crunch-nerds) (spreadsheets)
    - [TaxVantage](#taxvantage) (free for now)
  - [Paid Tools](#paid-tools) - Commercial
    - [Boldin](#boldin) - Probably the leading tool
    - [MaxiFi](#maxifi) - Lesser known tool
    - [ProjectionLab](#projection-lab) - Best of Breed?!
    - [Others](#others)
      - [RetirementIQ](#retirementiq) 
      - [Retirement Scenarios](#retirement-scenarios) 
      - [CliffEdge App](#cliffedge-app) 
- [Ramblings and Observations](#ramblings-and-observations)

  - [Some of the Things I Learned About Taxation](#some-of-the-things-i-learned-about-taxation)

--- 

First, **NOTE this** I use the term "**IRA**" for any account that is "Pre-Tax". And "**Roth**" for any tax free account.  **IRA** in this context could be any number of actual account types: IRA, Traditional IRA, Solo IRA, SEP-IRA, Simple IRA, 401(k), 403(b), 457(b), Keogh plans, and probably more.  **Roth** includes Roth IRA, IRA 401(k), HSA, TFRAs. HSAs are a bit of a different animal, actually.

Trivia for fun: _IRA_ stands for "Individual Retirement *AGREEMENT*", not account. Yeah, weird. And it's not ROTH but Roth. It's named after Senator William *Roth* who introduced it.  Oh, and the "(k)" in 401(k) does NOT refer to Eugene Keogh, it's a reference to the Internal Revenue Code. 

You can inspect or [download the files](https://github.com/nightskyguy/retirement_assets) and run the tool(s) in about any browser (Brave and Chrome have been tested).  Or you can directly run the tools from Cloudflare (_tools.netcitizen.us_).  You need internet access for the fonts and charts to work properly because those are downloaded from public sources.


## Standalone Calculator Tools

Here are less ambitious, standalone tools. Each should have a "How to Use" set if instructions, many have a way to generate a URL (called share) to capture your settings so you can either run again without reentering, or share with friends (or Redditors) for advice.

These tools are all being actively developed and improved. Each tool runs standalone in your browser - though most load additional local resources (e.g. they share the same **taxengine.js**). An internet connection is needed to load fonts and the tool for graphing charts. Basic, anonymous page-load analytics are collected (Google Analytics and Cloudflare Web Analytics) solely to understand how often the tools are used and from what general region - no personally identifiable information is collected, stored, or transmitted. General region information helps prioritize which state tax rules to add in future releases. You are welcome to see for yourself by inspecting the [source code](https://github.com/nightskyguy/retirement_assets).

### Historical Real Returns
**[Historical Real Returns](standalone/RealReturns.html) - Inflation-Adjusted Cumulative Growth of $10,000 (1928–2025)**
Plots the real (inflation-adjusted) cumulative growth of $10,000 in US equity (S&P 500 proxy), US bonds (10-yr Treasury), and T-bills across 98 years of history, alongside a custom allocation mix (equity/bond/cash sliders) and an uninvested cash reference line showing the full purchasing-power loss from holding dollars with no return. A "Market Returns" overlay adds nominal (pre-inflation) companion lines in darker colors to make the inflation drag viscerally visible. Clicking any legend asset isolates that real + nominal pair. Log/linear scale toggle; shareable URLs encode start year, allocation, and scale.

### Future Cost
**[FutureCost.html](standalone/FutureCost.html) - Present Value of Growing Payments**
Answers the question: how much money must be set aside today - and left to grow - to fund a stream of payments that increase faster than inflation? The primary use case is Medicare IRMAA surcharges: because IRMAA penalties are paid from pre-tax IRA/401k withdrawals, the tool tracks federal and state marginal tax rates separately and grosses up every payment to reflect the actual account draw required. Sliders control the annual penalty, planning horizon, CPI inflation, extra growth above inflation (Medicare premiums have historically risen 2–4% above CPI), portfolio return rate, and income (MAGI). Four result metrics - funds to allocate now, year-1 pre-tax draw, final-year pre-tax draw, and total real cost in today's dollars - plus a year-by-year chart of the payment as a percentage of income make the central point viscerally clear: those "small potatoes" grow in real purchasing-power terms every single year.

### IRMAA and RMDs
**[IRMAA and RMDs](https://tools.netcitizen.us/standalone/irmaa_and_rmds.html) - What balances get me in trouble with IRMAA**
Given entered fixed income, calculate what size IRA balance will cause RMDs that hit IRMAA tiers at various ages.  The tool uses current rates and does not attempt to adjust for inflation.  For example a married couple with a $16,607,550 balance at age **73** together with $130,000 income (pensions/social security/etc) will hit the highest IRMAA Tier 5 due to $626,700 forced RMD. Yeah, that is clearly not most of us. But at age **80** a $2,882,540 IRA balance together with that same income will hit **Tier 2** $5.2K annual charge because that balance at that age forces a $142,000 RMD.  A balance of $1,286,740 for a single 80 year old lands in **Tier 4** with a $5.7k annual charge.  At 75 that same single person would be in Tier 4 with a 1.5M IRA balance.  The Retirement Optimizer will suggest a target (combined) IRA balance that minimizes IRMAA jeopardy.

### After Tax Real Growth
**[AfterTaxRealGrowth.html](standalone/AfterTaxRealGrowth.html) - After-Tax Real Growth Rate**
Did you know that your 2.5% interest bearing savings account LOSES money even if inflation is LESS than 2.5%?  I suspected that, but this tool will show you the real answer - and surprise, it matters what your tax bracket is!

Visualize how inflation and taxation combine to erode nominal investment returns. Set an inflation rate and your portfolio's nominal return, and the tool plots the real after-tax return across six federal tax brackets (0%, 12%, 22%, 24%, 32%, 37%), with the 24% bracket highlighted as the typical IRMAA Tier 1 landing zone. A dashed break-even line at 0% real return makes immediately visible that a 2.50% nominal return at 2.50% inflation and 25% tax is not a wash - it is a net loss of purchasing power (~0.61%/year). Each bracket card shows your real return at the current portfolio return alongside the minimum nominal return needed to merely preserve purchasing power at that bracket and inflation rate. Useful for stress-testing conservative accounts (CDs, money markets, bond funds) where the real return is easily negative without realizing it.

### Income Tax Planner
**[IncomeTaxPlanner.html](standalone/IncomeTaxPlanner.html) - Federal + State Tax Sweep with IRMAA & Capital Gains**
Sweeps ordinary income from $0 to $1.1M in $10k steps and plots your true all-in effective tax rate - federal, state, and IRMAA combined - with a marginal rate curve that makes the Social Security torpedo, IRMAA tier crossings, and NIIT threshold immediately visible. Configure filing status, state (14 options currently), taxpayer ages, fixed Social Security income, capital gains proceeds and basis, a target year 2026–2035 with configurable CPI, and OBBBA provisions (senior deduction, elevated SALT cap). Two linked charts update instantly on any control change, and hovering either chart activates the corresponding tooltip on the other at the same income level.

Uses 2026 IRS Rev. Proc. 2025-32 federal brackets inflated forward by your chosen CPI rate; IRMAA premiums grow at that rate plus a configurable Medicare-specific increment. Designed to answer four questions: *How sensitive is my tax burden to a $10k income change? Where are my sweet spots and danger zones (SS torpedo, IRMAA cliffs, NIIT)? What is my real all-in effective rate? What withholding should I target?* The Share button encodes all settings into a compact URL that works from a local file or a web server - save it as a bookmark or paste it into a discussion to let someone else replicate your exact scenario.

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

My primary motivations for this tool are: 
+ What does the withdrawal phase look like?
+ What happens to my assets over time? 
+ Am I in RMD jeopardy? E.g. Will I experience tax bracket escalation?  
+ What withdrawal strategy results in: the lowest taxation, the highest ending wealth, and my favorite: the most **lifetime spending**.
+ Is it really true that *heavy* Roth conversions, **no Roth conversions**, or "*some*" Roth conversions are BETTER? (Setting aside some of the significant advantages of Roth)
+ How painful is the so-called widow's penalty, really?
+ How different might things look for me if I move to another state?
+ How much should I withdraw, convert or sell from each of my accounts to stay on track, and what will the tax consequences be?

> [!WARNING]
> While I've renewed development of this tool and conquered some daunting bugs, it's still a work in progress.

### Features in the Works (and Known Bugs):

+ Add a "tax creep" to see what harm a creeping tax rate might do.  I notice some states (e.g. Georgia) are reducing their tax rates, while others are adding more brackets and increasing rates.
+ Better organize the Annual Details tables. There are just too many columns to easily navigate.
+ Allow exporting of the Annual Details table(s). 
+ **State standard deduction accuracy:** States that use the Federal standard deduction (AZ, CO, ME, MN, ND, SC) now reference it directly so the deduction updates automatically when the Federal value changes. States with *fixed* standard deductions that are **not** indexed to inflation (AL, MT, OH) are incorrectly inflated by the engine each year - this overstates the deduction and slightly understates future taxes for those state residents. A future fix will properly handle those (and any future similar) states.
+ Model variable inflation in the synthetic Monte Carlo.

#### Recent Fixes / Improvements
+ Lots of chart improvements were made - additional charts, highlighting of specific categories.
+ Improved usability on small devices by allowing the "Tooltips" that are visible in a large browser to be clickable. (Most headers and titles have tooltips).
+ State tax rates have been updated to 2026 - and more states are included.  Some - especially those with odd taxation are still not present.
+ Properly handles Social Security Survivor benefits.  (See [Limitations and Restrictions](#limitations-and-restrictions))
+ You can reinvest Dividends, or collect them into your cash account.
+ Optimizer highlights the "best" withdrawal strategy in each category, including the results of Spend Goal optimization. Just click the entry in the table, and it loads that scenario.
+ Augmented the "Proportional Withdraw" with a "+%" option. This proved very helpful! It allows you to withdraw a percentage more than your needs - often to build up cash, or to do Roth conversion. Turns out to be an effective way to keep your IRA balance from growing unbounded. I got this idea from [Ben Brandt of "Even Better Retirement" on YouTube](https://www.youtube.com/watch?v=wptEu1Sb3Bk)
+ **Fill Bracket / IRMAA caps are now "soft".** A high After-Tax Spend goal could leave a large unfunded shortfall even with a multi-million-dollar IRA - most often after a spouse's death collapsed the tax brackets from joint to single. The bracket and IRMAA ceilings now draw extra IRA *above* the ceiling to fund mandatory spending (shown in a new `ForcedIRA` column, with the year's bracket overage); a genuine shortfall now only appears when *all* accounts are exhausted. The **ACA Cliff** ceiling, by contrast, is now its own *strict* strategy - it never breaches the FPL cap (which would forfeit the subsidy) and instead flags the plan untenable. 
+ In addition to the "Load/Save/Delete/Manage Scenarios", there is a new "share" option that creates a reusable URL. If you want to share a scenario with someone else (or bookmark it for yourself), you can use that method.
+ The tool was incorrectly moving non IRA assets to Roth.  
+ Implement the *Maximize (Roth) Conversion* logic - use cash/brokerage assets to increase Roth conversions. Currently it "converts" the excess withdrawals after taxes and spend goal.  If there is available cash to pay taxes on the conversion, more can be moved into Roth. Of course excess withdrawals can also be spent or deposited into cash. However there is not an option to withdraw brokerage funds to increase Roth conversions. 
+ Autoload any saved "default" scenario (so you can pick up where you left off).  A message pops up telling you this happened.
+ Tracks "Break Even" year for Roth Conversions. For details about what is tracked, consult the "Documentation" tab of the tool.

### Why This Tool?
Because the author is in retirement and has an unhealthy IRA balance to manage - it became obvious that no tool he could find offered the flexibility and *ease of use* he desired.  He and his wife are of different ages (so have different IRAs, RMD timings, Social Security amounts, etc.)  Some really powerful tools did not offer California tax calculations (California is a high tax state), or did not provide for life expectancy, and more.  Some of the questions the author sought to answer by modeling are these:

- Which strategy does the best job of reducing total taxation?
- What withdrawal strategy produces the most annual spendable amount? What is that amount?
- What assets will be left at the end of life, and in which accounts?

Therefore, the purpose of this tool is to model the remaining years of life with respect to spendable cash and taxation - and to determine how to optimize spendable cash. This tool may be useful to those who are *in* or *very near* retirement. It is not designed to analyze portfolios, in fact you must provide a best guess on the growth rate you expect for your particular portfolio(s).
Signficantly more analysis is needed to do pre-retirement optimization, or optimization of asset mixes - this is not a tool for that. Some general principles apply, however: in general if you have a large IRA, it is usually best to put more bonds and conservative assets in the IRA, and put more aggressive assets in the Roth so that they can grow tax free.
		
Many focus on ***Roth Conversions*** and that is not wrong thinking, but such a view misses the big picture of WHY to do conversions. Also from the time one stops getting regular W2 income until the time one starts receiving pensions or social security is known as the "valley of opportunity".  
During this otherwise low income period, strategic withdrawals and movement is possible. Ultimately you are in a better place if you have *degrees of freedom* in your assets - more on this in a moment. 
It also does not make sense to pay more tax than necessary. I do not see taxation as evil, but it does not feel "right" to pay up to 14,000/year in IRMAA fees for no net benefit 
in Medicare - but that is one of the many possible pitfalls of having too much forced income.
		
Having a large tax deferred IRA balance (about 750K or larger at the start of drawing from your IRA) can have many consequences, the worst being taking forced income (RMDs) at higher tax rates and incurring those IRMAA penalties just described.  You do NOT have to have a large IRA balance to fall prey to RMDs causing IRMAA. For example, if you have a healthy income stream between a pension, social security, and say a profit sharing plan, dividends, interest or residuals, even a modest amount of forced income can push you over an IRMAA cliff, cause you to incur NIIT (extra tax on capital gains), or push you into a higher tax bracket.  That is, RMDs are NOT exclusively a "rich people problem."
In this tool, we show each: IRMAA, state and Federal taxes to show the big picture: net taxes/net spendable income, year by year spend and "Final Wealth".

### Key Features:

+ Two Roth accounts are modeled - one per person - tracked independently throughout the simulation. Withdrawals are split proportionally; conversions are routed per-person (IRA→Roth for each 
individual).
+ Historical returns are modeled in the Monte Carlo "Historical" mode. The other model, Synthetic, is Log-Normal, Geometric Brownian Motion. Historical - including historical inflation is used by default.  See more at Monte Carlo, below.
+ Sophisticated Federal Tax and State tax calculations.  Includes *Capital Gains*, *NIIT*, a variety of states, and accurate social security taxation calculations.
+ A complete model until death of a single person or married couple with RMDs calculated, separation of 5 different accounts (IRA1, IRA2, Brokerage, Cash, Roth)
+ Tweakable rate(s), withdrawal strategies, and charts and tables to match them - but NOT TOO many variables.
+ Withdrawal Strategies include: **📊Proportional Withdraw +%** - proportionately withdraws from all sources to meet the After-Tax Spend goal. So, for example if your IRA is 10 times the size of your Cash, it will use 10x more IRA than cash. The **+%** adds an IRA-only boost of 0–200% of the spend goal (configurable; 0% is the pure proportional baseline). The after-tax surplus from the boost flows to Roth (if Max Conversion is on) or Cash. The Optimizer tests this at 0/5/10/20/50% × Max Conversion on/off. A "**💸Reduce IRA in *N* Years**" attempts to amortize the IRA down to "IRA Goal" in the number of years specified (Note "**Optimizer 🎯**" checks years 1 to 30 automatically and highlights the best result in a table - click any line in the table to choose that scenario). A "**🪣Fill Fed/IRMAA Bracket**" caps income/IRA draws at a chosen ceiling - the top of a federal tax bracket, a specific IRMAA tier threshold, or an ACA Federal Poverty Level multiple (200/250/300/400% FPL) - with any spending shortfall filled from Cash → Brokerage → Roth. "**📉IRA Draw %**" withdraws a fixed percentage of the IRA balance each year (5–10% in the Optimizer). **Ordered** strategies (CBIR, RIBC, BIRC) withdraw from accounts in a strict sequence until the spend goal is met: Cash→Brokerage→IRA→Roth, Roth→IRA→Brokerage→Cash, or Brokerage→IRA→Roth→Cash respectively.
+ There is also a "Max Conversion" option. It uses any surplus cash to increase Roth conversions from the *largest* IRA balance.
+ **Monte Carlo 🎲** - despite the name, this has nothing to do with gambling. "Monte Carlo" is a mathematical technique that asks: *what if we ran your retirement plan five hundred times, each time with a different sequence of good years and bad years drawn from the same statistical range?* Some runs get lucky (strong markets early), some get unlucky (a crash right after you retire). The result is a survival rate - "97% of scenarios still had money at age 90" - plus a chart showing the spread from best-case to worst-case portfolios over time. This is far more informative than a single projected growth rate, because the *order* of good and bad years matters enormously in retirement: a crash in year two is far more damaging than the same crash in year twenty. The tab compares all withdrawal strategies side by side under identical market conditions so you can see which ones are merely good on average and which ones are resilient across bad luck.  The growth and inflation sequences are chosen from historical data. My analysis of many tools has lead me to believe that most of them are seriously flawed. Failing to model inflation variability is often what is lacking.
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
+ It's silly to forecast 8% growth in an IRA and 4% growth in a Roth because that confuses the value of one over the other. It MAY make sense for Roth assets to be more aggressive than IRA assets. The "Account Composition" can be used to set different asset mixes for each account and that WILL affect the Monte Carlo simulation but currently the normal runs do not make a distinction between asset classes. 
+ Only tax filing statuses MFJ (married filing jointly) and SGL (Single) are modeled. There is no Head of Household, Married filing separately, etc.
+ There is no provision for itemized tax returns.  This tool assumes you rely on standard deductions (or exemptions, if that's what your state uses).  It also assumes that Single means one person, Married Filing Jointly is two. If you have a dependent adult, or children, it will not calculate the proper possible exemptions or deductions for these situations.
+ The tool doesn't try to maintain a brokerage balance or a cash balance. It will deplete those accounts to zero if required to meet your spend goal.  (The *Cash Reserve* is ignored currently).
+ When enabled ACA subsidy targeting keeps MAGI below 200/250/300/400% of the Federal Poverty Level. ACA thresholds are the only strategy that **strictly** enforce the ceiling. Crossing an ACA Federal Poverty Level (FPL) threshold forfeits the entire premium subsidy (a cliff, not a gradual cost), so the simulation never breaches the cap. If your spending can't be met within the ACA target, the plan is flagged untenable rather than quietly overspending. 
+ All other strategies e.g. the **🪣Fill Fed/IRMAA Bracket** strategy, are *soft* - and will exceed the ceiling to fund spending. It warns about this, but don't expect to spend 300k/year and remain in the 12% Federal bracket unless you've got a lot of Roth or high basis brokerage assets.
+ There is no modeling of any kind of Annuity, Life Insurance, Reverse Mortgage, inheritance, or ongoing (part time or full time) Income.  If you have a lifetime annuity, or other ongoing income you can treat it like a pension.
+ There is only one pension and it's assigned to "You". If your spouse has a pension and you don't, you can swap roles. You become **your spouse**, and your spouse becomes you in the entry fields.

Why are these permanent?

More inputs and knobs and conditions make the tool less simple. If you've got those situations, you can do some modeling here, but maybe a better tool will be MaxiFi, EMoney, Empower, Projection Labs, Pralana, Boldin, or similar.


### Limitations and Restrictions

0. The tool models things a year-at-a-time. This is not strictly accurate, because, for example, **when** you make withdrawals or conversions materially affects the results. Waiting until the end of the year to make your withdrawals has a different result than making a withdrawal at the beginning of the year.  The order of calculations is:  RMD withdrawals, QCD withdrawals, calculation of spending/conversion withdrawals (and removal of those funds from the needed accounts) THEN taxes, interest and dividends on the remainder are calculated. Surplus funds after minimum spending levels are eligible for deposit into a Roth.  In real life, you must do Roth conversions as a separate operation, but this tool can help forecast what that conversion would be. The [Retirement Tax Planner](https://tools.netcitizen.us/RetirementTaxPlanner.html) linked from the Annual Table shows the trade offs about WHEN to withdraw or convert. Internally, the tool checks two alternatives: early withdrawals (when conversions are being done) and late withdrawals - if no conversions. Early conversions push pre-tax money into tax free money - so the earlier the conversion occurs, the more growth you gain.
0. It tracks two Roth balances (one per person). Withdrawals are split proportionally between them; conversions are routed per-person.
0. IRA withdrawals are done *proportionately*. Some improvement may result by reducing a large balance first.  You can model this by moving the total balance to one person.
0. There is no "Accumulation phase" and no plan to add one.  I.e. no way to say "stash X dollars per year" in an IRA or Roth, Brokerage or Cash. The goal is to keep the inputs simple.  However, you CAN calculate your expected assets as of your retirement age, and use the *Retirement Start Age* to delay retirement into the future. This will result in properly adjusted tax brackets.
0. There is no plan to add "Part Time income", Annuities (can model those as "pension"), windfalls, lumpy spending (well, we are thinking about that last one) ...
0. Social Security Survivor benefits are roughly calculated. The month of death is required for exactness, but we are not sure anybody knows that, let alone the exact year of demise ;-) 

---

> [!CAUTION]
> Remember: **There is no SUPPORT for this tool**. If you ask nicely, or offer a pull request to actually implement a feature, of course we can talk. It is a best effort/time available endeavor.

---

## What about Other tools

One of the lovely things about engineers is they like to build things. I've found many other free (or almost free) resources that both inspired me and made realize that there is more than one way to solve problems.  Of course  I've also paid for and used yet more tools which I will briefly address.

### Free Tools

The sources I found around the interweb.

#### Nestwise

[NestWise](https://www.nestwise.me/) - lots and lots of features. No login required. Includes things like budgeting, extensive Monte Carlo analysis, and even one of my favorite features which allows you to compare different withdrawal  strategies to find one that best suits you. What I'd like to see is a tool to vary starting spend to optimize that number (to be fair, it's there but buried in the Scenario Compare as "Reverse Solver" - and there is "Probability Calculator" that allows you to sweep withdrawal rates, but takes a LONG time to run). And a bit more details in the strategy comparison - I'm less interested in the terminal balance than I am things like how much RMDs drive my taxation - there is a "Scenario Comparison".  I've examined the source code for this tool and collaborated with the developer. No back-doors, or exploitable flaws were found as of March, 2026. It incorporates a variety of withdrawal strategies (Guyton Klinger Guardrails, Constant Dollar, and many more).

I haven't determined whether inflation is being used in the Monte Carlo or Historical (Cycles) modes, but it appears to be and it's probably the clearest historical comparison tool I've seen anywhere.  You can run your plan against the dot com bust, the Global Financial Crisis of 2008, the Great Depression, the lost Decade (1999-2009), and Stagflation. 

It's currently the best of breed. The user interface is more approachable than typical tools - but also more nerdy. One flaw is the frequent, long recalculation times - but that can be tweaked to only recalculate on demand. You can use it without logging in. It saves your progress in your browser. It has Debt Payoff, Budgeting (rather rare for a free tool) that allows you to import transactions.  The tool is lingo heavy (meaning it uses financial terms).  

#### Anonymous Reddit Tool
Well, it's gone now. But it's the tool that made me realize that using Javascript to create a tool is much, much nicer than a spreadsheet.

#### Visual Federal Tax Tool
[Visual Federal Tax Tool](https://engaging-data.com/tax-brackets/) - this tool shows how your federal taxes are calculated.  As of 2026-01-17, it doesn't handle taxability of Social Security income, and as best I can tell, doesn't handle the OBBB (One Big Beautiful Bill) provisions for seniors.

#### AARP Federal Tax Calculator
[AARP Tax Calculator](https://www.aarp.org/money/taxes/1040-tax-calculator/) - free to AARP members.

#### Retirement Figures
[Retirement Figures](http://retirementfigures.com/) seems pretty robust and is currently free.  I have no access to the source to look for problems.

#### TaxVantage
[TaxVantage](http://taxvant.com/) Recently came on the scene. I have not evaluated it yet, though I have taken a look at the tax engine being used.

#### Google Sheet by Redittor
[GoogleSheet](https://docs.google.com/spreadsheets/d/1orZQ9g1KvGVrCShibutjyreaeqbmRFVAZ9aSY_57-DQ/edit?gid=1250894970#gid=1250894970) by Charles Eglington found on [Reddit](https://www.reddit.com/r/DIYRetirement/comments/1pnpufa/comment/nu9lawc/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1). It's got lots of options. I want some things that aren't in it like a "Life Expectancy" for each person, properly calculate deductions, deduce filing status, etc.  In addition, I'd like it to "self optimize" by varying the amounts of IRA/401K withdrawals (and the number of years for withdrawals).  Ideally it would properly, or more properly calculate California Tax, and have a way to forecast based on inflation. But it's still a helpful tool.

#### Roth Helper
[RothHelper](https://rothhelper.com/) is another tool that was posted in the same [Reddit DIY thread](https://www.reddit.com/r/DIYRetirement/comments/1pnpufa/comment/op600xx/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button). It has an accumulation phase and a simple analysis.  Probably OK for modest IRA balances. I like the tabular output though it's several pages worth of entry to get there.  I recognize the graphics... same chart.js engine I've been using.

### Paid Tools
#### Boldin
[Boldin](https://www.boldin.com) - formerly known as *New Retirement*. I had a year subscription. It was usable, but there was much I didn't like about it. The main issue with the tool is they try to do "everything" from pre-retirement planning through retirement. My number one pet peeve is that everything you wish to do that requires a future date shows month-by-month choices. It matters for some things, like exactly what month you retire or start social security. But it's tedious. One thing they have fixed is that it used to show "65y3m" meaning age 65, third month. Depending on your birthday, that could be any actual month.  Now they show "65y3m Jan 2038" - for example. You can type either "65" or "2038" to get the list of 12 months and just pick one, but if that future income is say, an inheritance well, it's just bizarre to be specifying the year, and month.  Well, at least they don't ask me what month I plan to die in. Maybe my spouse knows that plan.

You must specify an account withdrawal order (or use the default). The default picks taxable accounts first, followed by tax deferred and tax free. But if you're going to do Roth conversions, or trying to deplete your overblown IRA - that order makes no sense. Ordering within taxable types makes sense... but I want the tool to be smart enough to know that the last 10k dollars I plan to spend can come from wherever is the most tax efficient at that time.  Pull from my cash, or my Roth instead of launching me off an IRMAA cliff, please.

Boldin offers synchronization. The majority of redditors worry about providing linkages. My thought was: why wouldn't you want to automatically get your account balances, and portfolio information...
BUT Boldin only cares about balances. So the pain of "sometimes working/sometimes broken/sometimes need to be deleted and recreated" links is really a nuisance - not a value add. They have announced plans to actually monitor your portfolio, but unless they are going to do so in a way that enhances the guidance that they can provide for asset allocation or choosing growth rates... I doubt it will be worth it.  Speaking of growth rates... 

Another gotcha, is that every user, must select the "growth rate" for **each** account. This is a very tricky problem and picking wrong will give a much rosier or much more dismal picture. It may also severely skew the logic for Roth Conversions. If you have a brokerage account (or IRA) that contains 60% equity (and 20% of that International), 10% Bonds, and 30% cash/money market, the growth rate you pick needs to roughly match a reasonable reality that converges those 4 numbers. What many people end up doing is to split every account into separate components (Brok1-Equity, Brok1-Intl-eq, Brok1-TIPS, Brok1-Cash, Brok1-TaxFreeBonds) in order to assign reasonable different rates to each. Doing the split makes rate management easier, but it makes updating balances much more tedious - and it makes linkage to accounts useless.  

Navigability of the tool has improved. Things are more where I expect them than when I first subscribed. As I noted, however, there could be many more easy cross links between sections - for example Taxes and IRMAA are separate sections. And if the AI could provide a link to get you straight to the section it's telling you to visit, THAT would make it more usable. When I asked AI how to set a "glide path" it told me to change the "Growth Curve". It told me where to find it. But it wasn't there. I balked and the AI said: "Oh, that's the INTERNAL name, it's actually called "Model a Rate Change in the Future" (a switch). It's not a curve, it's a single change. So much for actually creating a glide path!

In my opinion, however the worst part of the tool is the Monte Carlo analysis. Monte Carlo is not a SPECIFIC type of analysis. [Boldin has chosen NOT to model variable inflation](https://help.boldin.com/en/articles/5805671-boldin-s-monte-carlo-simulation). They offer Historical "simulation" (Market Risk Explorer) but it's not on the Monte Carlo page, and the Monte Carlo output doesn't inspire. Monte Carlo shows possible net worth outcomes (and the percentage of outcomes that end with >0 money). But that's not very reassuring. And the Monte Carlo "chance of success" shown on the overview page is a dead end - it's not clickable. They don't provide information about what range of market volatility was used, what range of inflation was used. Their document (and the AI) both specify that they do NOT vary inflation at all - it comes from the "Rate Assumptions"

Social security explorer is inaccessible if one of the couple has already started collecting social security. That seems odd, because maybe I want to know if 67 or 69 or 70 is a better start age.

Oddly, the Roth Conversion Explorer has no AI component. And it feels very disjoint from the main components. For example, if you use the Roth Conversion Explorer but haven't ALREADY created a new scenario, you must: quit and back out, duplicate a scenario and then redo the Roth Explorer questions. Or apply the changes to whatever the "current scenario" is. This would be a perfect opportunity to create a new scenario. Another head scratcher: you can specify that "surplus" (e.g. income in excess of spending needs) can be placed in a taxable account. But why can't I put the excess that comes from an IRA into a Roth (e.g. a conversion). That is, I don't expect to ever see years with a surplus AND a Roth conversion in the summaries, but I do.  Seems it's missing an easy win. And what about this: every withdrawal for spending is FIRST a Roth conversion. Taking that approach you gain tremendous benefits:

+ until you spend the funds, you get tax free growth.
+ unspent funds will have automatically been converted. 
+ spent funds may have accrued some interest before they were spent that will continue compounding (tax free)
+ If you have surplus cash in the brokerage or a taxable account, you can use it to pay the tax bill and get a larger amount converted to tax-free status.

_**The tax consequences of an IRA withdrawal and a Roth conversion are identical**_.

The Scenario Manager is another prickly point. You can name scenarios, provide a "note" about what each one is, but you can't e.g. see or compare the notes of multiple scenarios at once, nor can you readily tell how they are different. Did you want to try multiple Roth conversion strategies? You better have named them precisely and kept notes, because the Scenario Manager cannot tell you how the scenarios are different. AI can help, but it won't, for example, tell you what choices you made in the Roth Explorer.  Moreover, the explorer seems to always target drawing each spouse's IRA to Zero. This does not make sense to me.  There is value in keeping an IRA. Both due to the ability to do QCDs, leave some to charity, and - once the balance is sufficiently low - to withdraw funds at miniscule taxation.  If you happen to be in a scenario and notice that the growth rate is wrong. You really only have one choice: delete all scenarios, make the change to the Baseline and recreate all the scenarios. Unless you *happen* to know the rates or inspect the rates used in every scenario - in that case you could update all the ones that had the wrong growth rate. But then you have to also take into account any money flow monkey business you may have done to model some of the things that Boldin doesn't natively model.

One other shortcoming: Boldin likes to present things in future dollars. This is a mistake that gives a false impression. Right now one million dollars sounds like a nice nest egg (and it is). But 30 years from now at 3% annual inflation, that 1M is worth $412k. In much the same way if you notice your High Yield Savings account balance has climbed from 10k to 11k you would be remiss to not consider what inflation (and taxation) do to diminish the **value** of that account!

Final comment: at $144/year it's a great deal compared to a ruinous retirement. You may spend a week putting a plan together. But you will have no use for the tool for the rest of the year. If it did real portfolio tracking, or budget tracking, or tax planning (e.g. how to pay your taxes in retirement) it WOULD make the tool more useful on a monthly basis. But ultimately, what Boldin provides is a complex calculator that responds to your tweaking. That is, it takes a complex problem, and makes you the decider. It will help you think about organizing, timing and accounts, but it won't suggest to you how to do it BETTER.  It won't help you pick a "more ideal portfolio allocation", tell you that your chosen growth rates are unrealistic. It doesn't appear to optimize your annual withdrawals, or provide insights on the best time to do conversions (early in the year - by default it schedules them for December!)

#### MaxiFi

I've not had this subscription for very long, so I'll withhold my comments until I've kicked the tires more aggressively.  I will offer for now, that it's less "polished" than Boldin (I run into reference errors pretty often). So far the main quirk I noticed:

It wants to know ONLY the IRA balances at the end of last year. I understand this, but I do NOT. Why it wants prior year end of year balances is no doubt so it can compute RMDs for IRAs and 401K accounts. But if my accounts soared or took a beating, the current value is what I care about. 

More later.

#### Projection Lab
[Projection Lab](https://projectionlab.com) - Just now getting a look at this tool. First, don't pluralize labs... that's an empty webpage. It offers a free to try phase, current cost is $129 / year.
It is definitely more "geeky" than say Boldin, but I already know it does two things that are awesome: 
1. It provides a way to "optimize" your asset location.  Tell it about your asset classes and it will suggest how to relocate them to other accounts for improved tax treatment.
2. It has INFLATION built in to its Monte Carlo engine

More later.

#### Others

##### Number Crunch Nerds
[NumberCrunch Nerds](https://www.youtube.com/@NumberCrunchNerds) "Justin, the Honest Tax Accountant" has produced many useful videos, and sells an extensive set of spreadsheets that you can buy and fill with your own data. I've used the spreadsheets in Google Sheets (with mixed results), and LibreOffice Calc. They are designed for Excel. He methodically explains many concepts and if you don't mind being read the slides aloud he's worth paying attention to. His spreadsheets are obviously one of the most "private" ways to manage your planning since the data stays in your computer (unless you put it in a cloud).

##### RetirementIQ
[RetirementIQ](https://retirementiq.app/) Free for 7 days, $50/year. I've not dabbled much with this, partly because I prefer open source that I can inspect for possible flaws, back-doors, etc.  Directly invoke it here: [retirementiq.app](https://retirementiq.app/app/)

##### Retirement Scenarios
[Retirement Scenarios](https://retirementscenarios.com) free to kick the tires, but $79 to fully unlock. The UI is good, but the reliance on sliders and a few quirks make it less than ideal for use with a phone/small screen device. I found no gotchas after doing a security audit of the code (as of May 22, 2026). The author recently fixed a problem that made the tool unusable unless your retirement age is greater than your current age. There is, unfortunately, nothing in the tool that helps you calculate "ideal" Roth conversions - but all the directional guidance is good. Like many tools these days, but unlike all the others, this tool integrates AI. You can ask the AI questions about your plan and/or about the tool. If you want to use the tool on multiple devices, you need to "login" using the email address you use to make a purchase.

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

1. [Roth Conversions - 2024](https://www.financialplanningassociation.org/learning/publications/journal/SEP24-net-present-value-analysis-roth-conversions-OPEN)
2. [When and For Whom Are Roth Conversions - 2021](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3860359) - download the paper from there. This is his original paper on the subject.
3. [Widow Tax Hit Debunked - 2023](https://www.financialplanningassociation.org/learning/publications/journal/DEC23-widow-tax-hit-debunked-OPEN) - McQuarrie illustrates that the "widows tax" is overstated. I think he errs in saying it's **debunked** because his numbers illustrate the reality of the survivor penalty - and worse numbers can be had.
4. [Charts you Never Saw - 2025](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3050736) - McQuarrie shows an even longer market timeframe which illuminates the reality that "the market always returns value in the long term" is a bit illusory.

I notice that he is releasing a book with Bill Bernstein (the founder of the 4% idea, and a prolific author) in March 2027 called "[Retirement: How to save enough, invest it well, and make your money last](https://www.amazon.com/Retirement-save-enough-invest-money-ebook/dp/B0GQWCS15F)"

#### Miscellaneous

[Quick Way to Estimate Portfolio Longevity](https://retirementincomejournal.com/article/a-quick-way-to-estimate-portfolio-longevity/) - a paper by Jim Otar.

[Sequence of Inflation Risk](https://retirementoptimizer.com/articles/Sequence%20of%20Inflation.pdf) - another paper by Jim Otar, and something I learned from my own modeling.  

### Some of the Things I Learned About Taxation

**Late Payment Penalties**  One of the biggest bugaboos in retirement is managing your tax payments.  Unlike working years where you were getting frequent payments with tax withholding already done, in retirement you can take taxable withdrawals anytime you like: beginning of the year, middle of the year, monthly, etc. However federal and state taxing authorities expect you to pay your taxes "timely" (e.g. quarterly or through appropriate withdrawals).  It doesn't matter to the IRS whether you withdraw 50K at the beginning, middle or end of the year, the IRS expects you to pay your taxes "quarterly" based on your total income at year end. 

You CANNOT solve the timeliness problem by plunking down your tax debt when you file your taxes by the April 15 deadline!

The easiest solution to the "when were taxes paid" problem is to have taxes withheld from withdrawals or conversions. The IRS and most state goverments treat withholding as if you paid the amounts quarterly. BUT, most custodians will NOT allow you to withhold taxes from an Roth withdrawal.  This means you have three ways to solve the "timely payment" problem: 
A. Estimate your taxes and pay them quarterly.  (But if you miss a payment, expect late penalties!)
B. Have the appropriate amount of taxes **withheld** from a taxable distribution to cover the years worth of taxes (or at least enought to reach "Safe Harbor").
C. File a form with the IRS (Form 2210, Schedule A) that explains why your income was "lumpy" and you didn't meet the expected timely payment requirement.

Option B allows another workaround: Suppose you convert 10k from your IRA to your Roth. You can have taxes withheld from the conversion, and WITHIN 60 days, make your Roth whole by adding cash into the Roth. However you can only do that "rollover" maneuver **once every 365 days** - and it only makes sense if you are at least 59.5 years old.

Safe Harbor is another "gotcha" in the tax code. If you "timely" pay 90% of your current year taxes and 100% or 110% of your prior taxes (depending on income), you will not get an underpayment/late payment penalty.

**Moldy Brackets** While the Social Security payments are adjusted annually by the CPI (Consumer Price Index), the rate at which Social Security is taxed is based on thresholds have NEVER been adjusted for inflation since they were established (1983 for 50%, and 1993 for 85%). This is no doubt why congress has churned and churned on trying to make Social Security non taxable.

**IRMAA Escalation** My original model assumed that the IRMAA tax brackets and amounts are adjusted by CPI, but that's not true. The *brackets* are adjusted per CPI, but the amounts are tied to Medicare. The CPI has averaged about 2.8% annually over the last 20 years, but Medicare has averaged 5.6% annual increase.  IRMAA, as mentioned is a TAX CLIFF, not a graduated bracket. That means if you make $1 more than the maximum you move up an IRMAA tier. The result is not only the need to pay the tax, say an extra 4k per year, but you may have to withdraw more from an IRA to pay the tax.  At a 20% nominal tax rate, that extra $1 costs at least $5K AND may result in pushing you up into higher marginal brackets. IRMAA penalties will cost significantly more REAL dollars in the future - if you have a chance to eat IRMAA now, or eat IRMAA later, neither is appetizing, but the future will be more painful.

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

33 of 50 states tax capital gains the same as regular income. Unfortunately many tools and many discussions neglect this aspect, which is another reason I wrote this tool. 9 states have no taxation or do not tax capital gains (as of 2025), and 9 states have preferential treatment of capital gains. [[Source]](https://www.theentrustgroup.com/blog/state-capital-gains-tax)

If you live in, or plan to move in a different state and you want to use this tool, you can! It now includes several states - and more can be added. If you're impatient, you can get creative and ask AI to add your state to the *TAXdata* embedded in retirement_optimizer_taxdata.js file.

#### Roth Conversion Gotchas

0. You withdraw/convert now at a (significantly) higher tax rate than you will face in your future. Converting into the 24% bracket might save you even if you expect to be in the 22% bracket, but converting into the 32% bracket will *likely* not help - at least this is the conventional wisdom, and I believe it is, like much conventional wisdom, is incomplete and does not apply universally.  Indeed, exploring the veracity of the conventional wisdom is one of the reasons I created the retirement optimizer. Let's say I have a healthy dose of skepticism.
0. You convert before you're 59.5 and do not have funds to pay the taxes AND/or that conversion pushes you into a significantly higher taxation situation.
0. You have modest IRA balances and expect that to be the case once you start drawing them in retirement. Modest here means something less than 1 million with 12 or fewer years before you plan to start drawing down assets. If you have 1M now, 10 years of 10% gains like those from 2016 to 2025 could TRIPLE that 1M to 3M.  3M would force you to take about 115k from your IRA at age 75. If married the RMD plus 70k in social security and other income lands you in the Federal 24% bracket.  At 83 just the RMD will put you in the 24% Federal Bracket.  If single, your first RMD will land you in the 24% Federal Bracket above the IRMAA tier 1.
0. Your remainder estate is going to charity (not people).  Charities pay zero tax regardless of the income source. If you can stomach the RMD forced income, it may not be necessary to bother with conversions.
0. You plan to take advantage of QCDs (Qualified Chraritable Deductions) after 70.5 years of age. QCDs satisfy RMD requirements, and do not count against your MAGI so do not incur IRMAA penalties.
0. You already have a healthy mix of assets (e.g. 60% IRA/401K, 30% Roth, 10% or higher Cash/CDs/Bonds in taxable).
0. You have to pay conversion taxes solely from the IRA withdrawals. This is not always the bad thing the pundits claim it is.
0. You plan to make relatively large annual withdrawals.  For example, assume you're 59 now and your IRA balance is 1M. It grows at a steady 8% annually. In 3 years you start taking 70K (adjusted for inflation, so actually 77k), at age 75 your RMD will be less than your planned annual withdrawal and remain so to age 99. This is "living on the edge", because any other income may push you into higher taxes and/or IRMAA penalties, but it may well be a scenario where conversions does not gain anything (financially). 

There are more than a dozen ways that not doing a conversion (to Roth or brokerage) can result in less spendable money and reduce spendable asset value. These scenarios mostly affect those with proportionately large IRA/401K balances. Even modest IRA/401K balances can significantly improve their asset balance and spendable cash through thoughtful withdrawals and conversions.

Here are some of the harms of having or accruing a large IRA/401K:

1. Growth in or size of the IRA/401K balance reaches a point where you end up in a higher tax bracket after RMDs start.
2. RMDs cause you to have little to no room for managing your desired spend (i.e. avoiding higher taxes and/or IRMAA and/or NIIT) - if you don't plan to invoke QCDs.
3. If the bulk of your assets remain in an IRA/401K, any large extra expenditure may cause a corresponding hit to your taxation (think remodeling, buying a fancy car, repairing a roof, or buying a vacation home).
4. Tax rates could go up significantly in the future (I argue they will go up!).
5. Social security bottoms out in 2033 (as it is on track to do), and you have to withdraw more to cover the loss of Social Security funds to maintain your style of living ... increasing your taxation.
6. Your spouse passes away. Now you're in a single tax bracket paying 30% more taxes for the same income (unless you remarry).
7. Your IRA (not 401K) crosses about 1.5m - in that case you could be forced to surrender some of it in a lawsuit. (401Ks have stronger protection). Roths are similarly exposed, but because Roth is not taxed, a smaller balance has greater value to you.
8. You (and your spouse) pass away. Your heirs will be forced to liquidate the IRA/401K balance within 10 years at THEIR tax rate. (Roths must be liquidated, too, but there is no tax).
9. If you or your spouse pass away, usually the most effective way to manage this is for the survivor to "take over" the deceased's IRA/401K balance. The now larger balance will be subject to the survivors RMD requirements. This might be better if the surviving spouse is younger, but could go the other way.
10. As your IRA/401K grows, your RMDs will also grow. At some point this causes 85% of your social security to become taxable, AND causes IRMAA taxes, AND possibly NIIT.
11. IRA/401K withdrawals are taxable income in MOST states. Roth withdrawals are not taxable in any state.
12. You die wealthy, not having spent what you could have, and your heirs pay the highest taxes of their lives to draw down the remaining balance in 10 years.  Though they may still be able to use QCDs if they are 70.5 at the time.
