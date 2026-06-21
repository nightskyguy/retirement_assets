> [!WARNING & DISCLAIMER]
> **There is no SUPPORT for these tools** and no guarantee of accuracy, or appropriateness of use. No warranty of suitability for any purpose. There is also *no charge*. **USE AT YOUR OWN RISK**


## Who Are These Tools For?  What Can They Do? 

First, **NOTE this** I use the term "**IRA**" for any account that is "Pre-Tax". And "**Roth**" for any tax free account.  **IRA** in this context could be any number of actual account types: IRA, Traditional IRA, Solo IRA, SEP-IRA, Simple IRA, 401(k), 403(b), 457(b), Keogh plans, and probably more.  **Roth** includes Roth IRA, IRA 401(k), HSA, TFRAs. HSAs are a bit of a different animal, actually.

Trivia for fun: _IRA_ stands for "Individual Retirement *AGREEMENT*", not account. Yeah, weird. And it's not ROTH but Roth. It's named after Senator William *Roth* who introduced it.  Oh, and the "(k)" in 401(k) does NOT refer to Eugene Keogh, it's a reference to the Internal Revenue Code. 

You can inspect or [download the files](https://github.com/nightskyguy/retirement_assets) and run the tool(s) in about any browser (Brave and Chrome have been tested).  Or you can directly run the tools from Cloudflare (_tools.netcitizen.us_).  You need internet access for the fonts and charts to work properly because those are downloaded from public sources.

You can DIRECTLY invoke these tools:

+ **[Retirement Optimizer](https://tools.netcitizen.us/retirement_optimizer.html)**  A full tool, with optimizers!  This is the original, and most featured tool.

+ **[Income Tax Planner](https://tools.netcitizen.us/IncomeTaxPlanner.html)** What does taxation look like at different ordinary income levels (includes many states)
+ **[Retirement Tax Planner](https://tools.netcitizen.us/RetirementTaxPlanner.html)** Compares 3 ways to pay taxes in retirement - provides reminders. Retirement Optimizer calls it.
+ **[Retirement Projection](https://tools.netcitizen.us/Retirement_Projection.html)**  What will my retirement assets do? It's very VISUAL but not as rich as Retirement Optimizer.
+ **[IRMAA and Medicare Future costs](https://tools.netcitizen.us/FutureCost.html)** Will IRMAA kill me?
+ **[After Tax REAL Growth](https://tools.netcitizen.us/AfterTaxRealGrowth.html)**  What growth rate do I need to stay ahead of inflation?
+ **[HYSA Real Value](https://tools.netcitizen.us/standalone/HYSA_Real_Growth.html)** Does my "safe" high-yield savings account actually grow after taxes and inflation?
+ **[HYSA vs Inflation](https://tools.netcitizen.us/standalone/HYSA_v_Inflation.html)** Year by year, did my savings beat inflation after tax — and how often?


A California resident built these with [Google gemini](https://gemini.google.com), [claude.ai](https://claude.ai) and [ChatGPT](https://chatgpt.com") AI assistance. The author is a retired software engineer, spreadsheet twiddler, has a strong knowledge of Python, and Javascript. See **Standalone Tools** and **Key Features** below for a summary of what the tools can do - and be sure to look at *What the Tool IGNOREs* (and *Known Bugs*, below) so you understand the limitations of the *Retirement Optimizer*.

Here are less ambitious, standalone tools. Each should have a "How to Use" set if instructions, many have a way to generate a URL (called share) to capture your settings so you can either run again without reentering, or share with friends (or Redditors) for advice.

## Standalone Calculator Tools

These tools are all being actively developed and improved. Each tool runs standalone in your browser - though most load additional local resources (e.g. they share the same **taxengine.js**). An internet connection is needed to load fonts and the tool for graphing charts. Basic, anonymous page-load analytics are collected (Google Analytics and Cloudflare Web Analytics) solely to understand how often the tools are used and from what general region — no personally identifiable information is collected, stored, or transmitted. General region information helps prioritize which state tax rules to add in future releases. You are welcome to see for yourself by inspecting the [source code](https://github.com/nightskyguy/retirement_assets).

**[Retirement Projection](Retirement_Projection.html) — How might *most* of your retirement assets fare during your lifetime.**
Retirement Projection is visually richer tool than the [Retirement Optimizer](https://tools.netcitizen.us/retirement_optimizer.html), but it's less featured. Various Reddit and YouTube discussions do a lot of handwaving about IRA/401K balances. What this tool does is allow you to set your current age, current account balances, growth and inflation, filing status, and withdrawal rate.  It then calculates the account balances and RMDs (once they kick in).  

Retirement Projection includes Federal and **state** taxation - in fact, it shares the taxengine.js. As such it has a fairly rigorous tax calculator. Like the Optimizer, it models TWO IRA accounts, one Brokerage account, one cash account, and ONE Roth account.
Why only one Roth? Because Roth accounts are "interchangeable" tax wise, so if you already have balances in multiple Roth's just sum them.
Ditto with Brokerage and cash accounts. In fact, perhaps the two most difficult problems (which it would be nice to have a solution for) are determining what a "correct" dividend and "growth" rate are.

Like the "Retirement Optimizer" you cannot specify different growth rates for Brokerage, IRA/401k or Roth accounts. There are several reasons why, not the least of which is that you can make an IRA better than a Roth by significantly increasing it's dividend or growth rate - but then you're not comparing the value of the account taxation consequences as much as the difference in growth rates.

In real life, yes you are very likely to put your Bonds, TIPS, and Money Market funds in your IRA when you move your faster growing assets to your Roth - to take advantage of the magic of compounding tax free.  And if you have a choice, your high dividend, and high interest assets are better placed in a Roth where the tax moth won't feed.

There is no provision for adding lumpy withdrawals, but there is a way to apply a "spending smile" curve to withdrawals. 


**[FutureCost.html](FutureCost.html) — Present Value of Growing Payments**
Answers the question: how much money must be set aside today — and left to grow — to fund a stream of payments that increase faster than inflation? The primary use case is Medicare IRMAA surcharges: because IRMAA penalties are paid from pre-tax IRA/401k withdrawals, the tool tracks federal and state marginal tax rates separately and grosses up every payment to reflect the actual account draw required. Sliders control the annual penalty, planning horizon, CPI inflation, extra growth above inflation (Medicare premiums have historically risen 2–4% above CPI), portfolio return rate, and income (MAGI). Four result metrics — funds to allocate now, year-1 pre-tax draw, final-year pre-tax draw, and total real cost in today's dollars — plus a year-by-year chart of the payment as a percentage of income make the central point viscerally clear: those "small potatoes" grow in real purchasing-power terms every single year.

**[IRMAA and RMDs](https://tools.netcitizen.us/irmaa_and_rmds.html) - What balances get me in trouble with IRMAA**
Given entered fixed income, calculate what size IRA balance will cause RMDs that hit IRMAA tiers at various ages.  The tool uses current rates and does not attempt to adjust for inflation.  For example a married couple with a $16,607,550 balance at age **73** together with $130,000 income (pensions/social security/etc) will hit the highest IRMAA Tier 5 due to $626,700 forced RMD. Yeah, that is clearly not most of us. But at age **80** a $2,882,540 IRA balance together with that same income will hit **Tier 2** $5.2K annual charge because that balance at that age forces a $142,000 RMD.  A balance of $1,286,740 for a single 80 year old lands in **Tier 4** with a $5.7k annual charge.  At 75 that same single person would be in Tier 4 with a 1.5M IRA balance.  The Retirement Optimizer will suggest a target (combined) IRA balance that minimizes IRMAA jeopardy.

**[AfterTaxRealGrowth.html](AfterTaxRealGrowth.html) — After-Tax Real Growth Rate**
Did you know that your 2.5% interest bearing savings account LOSES money even if inflation is LESS than 2.5%?  I suspected that, but this tool will show you the real answer - and surprise, it matters what your tax bracket is!

Visualize how inflation and taxation combine to erode nominal investment returns. Set an inflation rate and your portfolio's nominal return, and the tool plots the real after-tax return across six federal tax brackets (0%, 12%, 22%, 24%, 32%, 37%), with the 24% bracket highlighted as the typical IRMAA Tier 1 landing zone. A dashed break-even line at 0% real return makes immediately visible that a 2.50% nominal return at 2.50% inflation and 25% tax is not a wash — it is a net loss of purchasing power (~0.61%/year). Each bracket card shows your real return at the current portfolio return alongside the minimum nominal return needed to merely preserve purchasing power at that bracket and inflation rate. Useful for stress-testing conservative accounts (CDs, money markets, bond funds) where the real return is easily negative without realizing it.

**[IncomeTaxPlanner.html](IncomeTaxPlanner.html) — Federal + State Tax Sweep with IRMAA & Capital Gains**
Sweeps ordinary income from $0 to $1.1M in $10k steps and plots your true all-in effective tax rate — federal, state, and IRMAA combined — with a marginal rate curve that makes the Social Security torpedo, IRMAA tier crossings, and NIIT threshold immediately visible. Configure filing status, state (14 options currently), taxpayer ages, fixed Social Security income, capital gains proceeds and basis, a target year 2026–2035 with configurable CPI, and OBBBA provisions (senior deduction, elevated SALT cap). Two linked charts update instantly on any control change, and hovering either chart activates the corresponding tooltip on the other at the same income level.

Uses 2026 IRS Rev. Proc. 2025-32 federal brackets inflated forward by your chosen CPI rate; IRMAA premiums grow at that rate plus a configurable Medicare-specific increment. Designed to answer four questions: *How sensitive is my tax burden to a $10k income change? Where are my sweet spots and danger zones (SS torpedo, IRMAA cliffs, NIIT)? What is my real all-in effective rate? What withholding should I target?* The Share button encodes all settings into a compact URL that works from a local file or a web server — save it as a bookmark or paste it into a discussion to let someone else replicate your exact scenario.

**[HYSA Real Value](standalone/HYSA_Real_Growth.html) — Cumulative Real Value of a High-Yield Savings Account**
Starting from $10,000, this tool compounds a high-yield savings balance year over year and plots the *real* value after both tax and inflation. Three lines: Roth / 0%-tax, a custom tax bracket (slider), and uninvested cash eroded by inflation alone. A year-count slider lets you shorten the window. It makes visible that even a competitive HYSA can lose real purchasing power once taxes and CPI are netted out. Rates are 80th-percentile competitive HYSA estimates (FDIC national rate data, Fed funds rate history, Bankrate benchmarks); inflation is BLS CPI-U.

**[HYSA vs Inflation](standalone/HYSA_v_Inflation.html) — Year-by-Year Real After-Tax Returns vs. Inflation**
The year-by-year companion to the tool above: real after-tax HYSA return — a Roth / 0% line and a custom-rate slider line — plotted against inflation bars with summary stats for positive years, average net per year, and the best and worst year. Same data sources (FDIC / Fed funds / Bankrate estimates for HYSA rates, BLS CPI-U for inflation).


## The Retirement Optimizer

This is the original tool. And while I like it, it's definitely not for everyone. There is no "accumulation phase". The focus is managing withdrawals from your accounts. But it has something I haven't found in any tool: a withdrawal strategy optimizer — and a Monte Carlo stress-test tab to show you how your plan holds up across hundreds of simulated market scenarios.

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

#### Features in the Works (and Known Bugs):

+ Add a "tax creep" to see what harm a creeping tax rate might do.  I notice some states (e.g. Georgia) are reducing their tax rates, while others are adding more brackets and increasing rates.
+ Better organize the Annual Details tables. There are just too many columns to easily navigate.
+ Allow exporting of the Annual Details table(s). 
+ The tool should warn when a "Fill Bracket" is picked that is impossible to meet if the After-Tax Spend goal is high. For example, setting After-Tax Spend to 180,000 makes it impossible to stay in the 12% (or even the 22%) bracket unless there are lots of cash, brokerage or Roth assets already. 
+ I'm always looking to include additional withdrawal scenarios. The most powerful recent addition was a +% addition to the proportional withdrawal.
+ Allow selection of the month(s) in which withdrawals will occur. My modeling shows it DOES make a difference. If you're trying to draw down an IRA, taking withdrawals early in the year means you will accrue less growth in the IRA account (and more in the Roth or Brokerage if that's where the funds go). Conversely, if you're trying to make the account grow a little more, taking withdrawals in the last months may help.
+ Optimize tax payment: in this scenario you withhold taxes from a year-end withdrawal. So, for example, to stay in the good graces of the Internal Revenue Service, your final IRA withdrawal might be solely for the purpose of witholding funds to Federal and State taxing agencies. Waiting until the end of the year means you get to use the extra interest to help pay the tax bill.
+ More state taxation options are *usually* easy. You can [open an "Issue" in Github](https://github.com/nightskyguy/retirement_assets/issues/new/choose) to request that I add your state.
+ **State standard deduction accuracy:** States that use the Federal standard deduction (AZ, CO, ME, MN, ND, SC) now reference it directly so the deduction updates automatically when the Federal value changes. States with *fixed* standard deductions that are **not** indexed to inflation (AL, MT, OH) are incorrectly inflated by the engine each year — this overstates the deduction and slightly understates future taxes for those state residents. A future fix will properly handle those (and any future similar) states.

##### Recent Fixes / Improvements
+ State tax rates have been updated to 2026 (e.g. NC tax was reduced).
+ More properly handles Social Security Survivor benefits.  (See #Limitations and Restrictions)
+ Optimizer now can optimize Spending, not just find the best withdrawal strategy.
+ You now have the option to reinvest Dividends, or collect them into your cash account.
+ Optimizer also highlights the "best" withdrawal strategy in each category, including the results of Spend Goal optimization. Just click the entry in the table, and it loads that scenario.
+ Augmented the "Proportional Withdraw" with a "+%" option. This proved very helpful! It allows you to withdraw a percentage more than your needs - often to build up cash, or to do Roth conversion. Turns out to be an effective way to keep your IRA balance from growing unbounded. I got this idea from [Ben Brandt of "Even Better Retirement" on YouTube](https://www.youtube.com/watch?v=wptEu1Sb3Bk)
+ A problem where shortfalls would occur when using the **💸Reduce IRA in *N* Years** strategy, and sometimes when using "📊Proportional Withdraw +%". Adding a third tax calculation phase nailed it. **FIXED**
+ In addition to the "Load/Save/Delete/Manage Scenarios", there is a new "share" option that creates a reusable URL. If you want to share a scenario with someone else (or bookmark it for yourself), you can use that method.
+ It should only be possible to move surplus IRA withdrawals into Roth - it was incorrectly moving extra cash. **FIXED** 
+ Implement the *Max (Roth) Conversion* logic - use cash/brokerage assets to increase Roth conversions. Currently it "converts" the excess withdrawals after taxes and spend goal.  If there is available cash to pay taxes on the conversion, more can be moved into Roth. Of course excess withdrawals can also be spent or deposited into cash. However there is not an option to withdraw brokerage funds to increase Roth conversions. **DONE**
+ The tax calculations are more comprehensive. **FIXED** 
+ When Roth funds are tapped to meet spending goals, it sometimes over-withdrew. **FIXED** 
+ Save/Import/Export of settings **DONE**. The Load/Save/Delete/Manage Scenarios UI is not well undocumented. 
+ Autoload any saved "default" scenario (so you can pick up where you left off).  A message pops up telling you this happened.

#### Why This Tool?
Because the author is in retirement and has an unhealthy IRA balance to manage - it became obvious that no tool he could find offered the flexibility and *ease of use* he desired.  He and his wife are of different ages (so have different IRAs, RMD timings, Social Security amounts, etc.)  Some really powerful tools did not offer California tax calculations (California is a high tax state), or did not provide for life expectancy, and more.  Some of the questions the author sought to answer by modeling are these:

- Which strategy does the best job of reducing total taxation?
- What withdrawal strategy produces the most annual spendable amount? What is that amount?
- What assets will be left at the end of life, and in which accounts?

Therefore, the purpose of this tool is to model the remaining years of life with respect to spendable cash and taxation - and to determine how to optimize spendable cash. This tool may be useful to those who are *in* or *very near* retirement. It is not designed to analyze portfolios, in fact you must provide a best guess on the growth rate you expect for your particular portfolio(s).
Signficantly more analysis is needed to do pre-retirement optimization, or optimization of asset mixes - this is not a tool for that. Some general principles apply, however: in general if you have a large IRA, it is usually best to put more bonds and conservative assets in the IRA, and put more aggressive assets in the Roth so that they can grow tax free.
		
Many focus on ***Roth Conversions*** and that is not wrong thinking, but such a view misses the big picture of WHY to do conversions. Also from the time one stops getting regular W2 income until the time one starts receiving pensions or social security is known as the "valley of opportunity".  
During this otherwise low income period, strategic withdrawals and movement is possible. Ultimately you are in a better place if you have *degrees of freedom* in your assets - more on this in a moment. 
It also does not make sense to pay more tax than necessary. I do not see taxation as evil, but it does not feel "right" to pay up to 14,000/year in IRMAA fees for no net benefit 
in Medicare - but that is one of the many pitfalls of having too much forced income.
		
Having a large tax deferred IRA balance (about 750K or larger at the start of drawing from your IRA) can have many consequences, the worst being taking forced income (RMDs) at higher tax rates and incurring those IRMAA penalties just described.  
In this tool, we show each: IRMAA, state and Federal taxes to show the big picture: net taxes/net spendable income, year by year spend and "Final Wealth".

#### Key Features:

+ Sophisticated Federal Tax and State tax calculations.  Includes *Capital Gains*, *NIIT*, a variety of states, and accurate social security taxation calculations.
+ A complete model until death of a single person or married couple with RMDs calculated, separation of 5 different accounts (IRA1, IRA2, Brokerage, Cash, Roth)
+ Tweakable rate(s), withdrawal strategies, and charts and tables to match them - but NOT TOO many variables.
+ Withdrawal Strategies include: **📊Proportional Withdraw +%** — proportionately withdraws from all sources to meet the After-Tax Spend goal. So, for example if your IRA is 10 times the size of your Cash, it will use 10x more IRA than cash. The **+%** adds an IRA-only boost of 0–200% of the spend goal (configurable; 0% is the pure proportional baseline). The after-tax surplus from the boost flows to Roth (if Max Conversion is on) or Cash. The Optimizer tests this at 0/5/10/20/50% × Max Conversion on/off. A "**💸Reduce IRA in *N* Years**" attempts to amortize the IRA down to "IRA Goal" in the number of years specified (Note "**Optimizer 🎯**" checks years 1 to 30 automatically and highlights the best result in a table - click any line in the table to choose that scenario). A "**🪣Fill Fed/IRMAA Bracket**" caps income/IRA draws at a chosen ceiling — the top of a federal tax bracket, a specific IRMAA tier threshold, or an ACA Federal Poverty Level multiple (200/250/300/400% FPL) — with any spending shortfall filled from Cash → Brokerage → Roth. "**📉IRA Draw %**" withdraws a fixed percentage of the IRA balance each year (5–10% in the Optimizer). **Ordered** strategies (CBIR, RIBC, BIRC) withdraw from accounts in a strict sequence until the spend goal is met: Cash→Brokerage→IRA→Roth, Roth→IRA→Brokerage→Cash, or Brokerage→IRA→Roth→Cash respectively.
+ There is also a "Max Conversion" option. It uses any surplus cash to increase Roth conversions from the *largest* IRA balance.
+ **Monte Carlo 🎲 stress-test tab** — despite the name, this has nothing to do with gambling. "Monte Carlo" is a mathematical technique that asks: *what if we ran your retirement plan five hundred times, each time with a different sequence of good years and bad years drawn from the same statistical range?* Some runs get lucky (strong markets early), some get unlucky (a crash right after you retire). The result is a survival rate — "97% of scenarios still had money at age 90" — plus a chart showing the spread from best-case to worst-case portfolios over time. This is far more informative than a single projected growth rate, because the *order* of good and bad years matters enormously in retirement: a crash in year two is far more damaging than the same crash in year twenty. The tab compares all withdrawal strategies side by side under identical market conditions so you can see which ones are merely good on average and which ones are resilient across bad luck.  The growth and inflation sequences are chosen from historical data.
+ Multiple state tax tables are present (including "No Tax" states). California tax table is the default. 33 of the US states tax IRA withdrawals the same way - albeit at different tax rates.  Also, those same 33 states treat all capital gains as taxable income - and that can matter quite a lot. In fact, 8 different state tax rates are currently available. WARNING: only California calculations are done using the correct model. Other states may be off. Best to double check. Moreover, most states do NOT tax Social Security. Those that do may not be modeled correctly. The Federal government taxation of Social Security should be very accurate.
+ Modeling can show the true cost of the widow penalty (when one spouse predeceases another) and the IRMAA penalty.
+ The ability to model different spending rates (goals) in retirement (e.g. the spending SMILE) or a flat spending rate.
+ The Optimizer can also determine the "highest possible spending rate" if you check the "**Optimize Spend**" box - but you would be wise to run a Monte Carlo against that spend level.
+ It automatically rolls any IRA balance from the deceased spouse to the living spouse (RMDs may apply differently!)
+ Includes the affect of the impending **2033 Social Security Fund** depletion (with a 23% reduction in payouts). If you think congress will fix this, you can change the year to much later, or the payout to 100%.
+ "Wealth" as shown in this tool is adjusted for the average taxation measured.  Many tools show a 50,000 Roth and a 50,000 IRA as being 100,000 net worth - but that's not very accurate. You can only take money out of an IRA at a zero percent total rate at a very low amount. RMDs may make that impossible at some point.
+ Save/Load/Import/Export settings (**Import/Export 📂**) so you can quickly start where you left off. If you save your settings as the name "default" those settings will automatically be reloaded when you restart. NOTE settings are saved in your **browser**. However you can Export them and Import scenarios in another browser if you wish. You can also use the "share" to generate a portable URL.
+ View the detailed transactions (**Annual Details ⊞**) or a simplified graph (**Chart 📊**).
+ On the Annual Details page, click either the year column or the "totalTax" column and it will generate up to 3 different tax payment plans - showing which is the most effective.
+ By default dividends from the Brokerage and interest on cash are accumulated into the Cash account. The "Reinvest Brokerage Dividends" changes this behavior and dividends are reinvested (meaning your cost basis grows over time).


#### What the Tool IGNORES (No Plans to Implement)

+ **Roth and IRA Modeling Limitations:** This tool assumes all Traditional IRA balances consist entirely of pre-tax contributions, and that all Roth IRA withdrawals are tax-free. If your Roth account is less than 5 years old, or if you made Roth conversions within the past 5 years while under age 59½, actual withdrawals may incur income tax or a 10% early withdrawal penalty not reflected in these projections.
+ The various short term benefits to seniors under the OBBBA (e.g. extra deductions and phaseouts) are in the engine, and should properly phase out. However the author's experience is that those benefits are not very useful if trying to deal with a heavy weight IRA balance so haven't been fully tested.
+ Two Roth accounts are modeled — one per person — tracked independently throughout the simulation. Withdrawals are split proportionally; conversions are routed per-person (IRA→Roth for each individual).
+ Forecasting variable growth rates, or growth rates that differ between different assets.  (It's silly to forecast 8% growth in an IRA and 4% growth in a Roth - or v.v.) because that may hide the value of one over the other, however it MAY make sense for Roth assets to be more aggressive than IRA assets. The "Account Composition" can be used to set different asset mixes for each account and that WILL affect the Monte Carlo simulation.
+ Historical return models or per-asset-class volatility — the Monte Carlo tab uses two models (log-normal Geometric Brownian Motion, and Historical). Historical - including historical inflation is used by default.
+ This is not a tool to attempt to model different asset class ratios, or different asset location arrangements - though as noted, those are accounted for in the "Account Composition" settings.
+ Tax filing statuses other than MFJ (married filing jointly) and SGL (Single). There is no Head of Household, Married filing separately, etc.
+ There is no provision for itemized tax returns.  This tool assumes you rely on standard deductions (or exemptions, if that's what your state uses).  It also assumes that Single means one person, Married Filing Jointly is two. If you have a dependent adult, or children, it will not calculate the proper possible exemptions or deductions for these situations.
+ There is currently No provision for using QCDs to minimize Required Minimum Distributions.  QCDs are planned. You can take QCDs starting at age 70.5 for up to 111k per person.
+ The tool doesn't try to maintain a brokerage account balance or a cash balance. It will deplete those accounts to zero if required to meet your spend goal.  (The *Cash Reserve* is ignored currently).
+ ACA subsidy targeting (keeping MAGI below 200/250/300/400% of the Federal Poverty Level) is available as an option within the **🪣Fill Fed/IRMAA Bracket** strategy. Medicaid income targeting is not modeled.  And to be frank, such modeling would only make sense to age 65 - but if you select that target, it applies for life.
+ There is no modeling of any kind of Annuity, Life Insurance, Reverse Mortgage, inheritance, or ongoing (part time or full time) Income.  If you have a lifetime annuity, or other ongoing income you can treat it like a pension.
+ There is only one pension and it's assigned to "You". If your spouse has a pension and you don't, you can swap roles. You become **your spouse**, and your spouse becomes you in the entry fields.

There are two reasons that these permanent *ignorances* apply

0. It's not the author's reality, 
0. More inputs and knobs and conditions make the tool far less simple. If you've got those situations, you can do some modeling here, but maybe a better tool will be MaxiFi, EMoney, Empower, Projection Labs, Pralana, Boldin, or similar.


#### Limitations and Restrictions

0. The tool models things a year-at-a-time. This is not strictly accurate, because, for example, **when** you make withdrawals or conversions materially affects the results. For example, 
waiting until the end of the year to make your withdrawals has a different result than making a withdrawal at the beginning of the year.  The order of calculations is:  RMD withdrawals, calculation of spending/conversion withdrawals (and removal of those funds from the needed accounts) THEN taxes, interest and dividends on the remainder are calculated. Surplus funds after minimum spending levels are eligible for deposit into a Roth.  In real life, you must do Roth conversions as a separate operation, but this tool can help forecast what that conversion would be.  The newly added [Retirement Tax Planner](https://tools.netcitizen.us/RetirementTaxPlanner.html) will show the trade off about WHEN to withdraw or convert.  There IS a plan to model begining of year, middle of year, and end of year conversions and withdrawals.
0. It tracks two Roth balances (one per person). Withdrawals are split proportionally between them; conversions are routed per-person.
0. IRA withdrawals are done *proportionately*. Some improvement may result by reducing a large balance first.  You can model this by moving the total balance to one person.
0. There is no "Accumulation phase" and no plan to add one.  I.e. no way to say "stash X dollars per year" in an IRA or Roth, Brokerage or Cash. The goal is to keep the inputs simple.  However, you CAN calculate your expected assets as of your retirement age, and use the *Retirement Start Age* to delay retirement into the future. This will result in properly adjusted tax brackets.
0. There is no plan to add "Part Time income", Annuities, windfalls, lumpy spending (well, we are thinking about that last one) ...
0. Social Security Survivor benefits are roughly calculated. The month of death is required for exactness, but we are not sure anybody knows that, let alone the exact year of demise ;-) 

---

> [!CAUTION]
> Remember: **There is no SUPPORT for this tool**. If you ask nicely, or offer a pull request to actually implement a feature, of course we can talk. It is a best effort/time available endeavor.

---

#### What about Other tools
One of the lovely things about engineers is they like to build things. I've found many other free (or almost free) resources that both inspired me and made realize that there is more than one way to solve problems.  

The sources I found around the interweb.


+ [GoogleSheet](https://docs.google.com/spreadsheets/d/1orZQ9g1KvGVrCShibutjyreaeqbmRFVAZ9aSY_57-DQ/edit?gid=1250894970#gid=1250894970) by Charles Eglington found on [Reddit](https://www.reddit.com/r/DIYRetirement/comments/1pnpufa/comment/nu9lawc/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1). It's got lots of options. I want some things that aren't in it like a "Life Expectancy" for each person, properly calculate deductions, deduce filing status, etc.  In addition, I'd like it to "self optimize" by varying the amounts of IRA/401K withdrawals (and the number of years for withdrawals).  Ideally it would properly, or more properly calculate California Tax, and have a way to forecast based on inflation. But it's still a helpful tool.

+ Another [Reddit](https://www.reddit.com/r/DIYRetirement/comments/1pnpufa/comment/nulys5i/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button) contribution by _Working-Schedule5000
_ is what made me realize that writing a tool in JavaScript results in the most readability and tweakability of the code. Spreadsheets can become hard to follow.  To use download and save, then run in your browser: https://drive.google.com/file/d/1ZJNCg-HNXHZmzWv9zW1anaFpLNTOTf10/view

+ [Visual Federal Tax Tool](https://engaging-data.com/tax-brackets/) - this tool shows how your federal taxes are calculated.  As of 2026-01-17, it doesn't handle taxability of Social Security income, and as best I can tell, doesn't handle the OBBB (One Big Beautiful Bill) provisions for seniors.

Operational Tools (All Free, though one is only free to try)

+ [NestWise](https://www.nestwise.me/) - lots and lots of features. No login required. Includes things like budgeting, extensive Monte Carlo analysis, and even one of my favorite features which allows you to automatically iterate over different withdrawal rates (using different strategies) to find one that best suits you.  I've examined the source code for this tool and collaborated with the developer. No back-doors, or exploitable flaws were found as of March, 2026.

+ [RetirementIQ](https://retirementiq.app/) Free for 7 days, $50/year. I've not dabbled much with this, partly because I prefer open source that I can inspect for possible flaws, back-doors, etc.  Directly invoke it here: [retirementiq.app](https://retirementiq.app/app/)

+ [Retirement Figures](http://retirementfigures.com/) seems pretty robust and is currently free.  I have no access to the source to look for problems.

+ [Retirement Scenarios](https://retirementscenarios.com) free to kick the tires, but $79 to fully unlock. The UI is good, but the reliance on sliders and a few quirks make it less than ideal for use with a phone/small screen device. I found no gotchas after doing a security audit of the code (as of May 22, 2026). The author recently fixed a problem that made the tool unusable unless your retirement age is greater than your current age. There is, unfortunately, nothing in the tool that helps you calculate "ideal" Roth conversions - but all the directional guidance is good. Like many tools these days, but unlike all the others, this tool integrates AI. You can ask the AI questions about your plan and/or about the tool. If you want to use the tool on multiple devices, you need to "login" using the email address you use to make a purchase.  

---

## Ramblings and Observations

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
