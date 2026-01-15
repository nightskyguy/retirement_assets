## Who is this For?  What Can It Do? 

You can [download the files](https://github.com/nightskyguy/retirement_assets) and run the tool offline in about any browser (only Brave and Chrome have been tested).  Or you can directly run the tool from Github Pages here:

** [nightskyguy.github.io](https://nightskyguy.github.io/retirement_assets/retirement_optimizer.html) **

**There is no SUPPORT for this tool** and no guarantee of accuracy, or appropriateness of use. There is also no charge. **USE AT YOUR OWN RISK**

A California resident built this with [Google gemini](https://gemini.google.com), [claude.ai](https://claude.ai) and [ChatGPT](https://chatgpt.com") AI assistance. The author is a retired software engineer, spreadsheet twiddler, has a strong knowledge of Python, Javascript, and Groovy. See **Key Features** below for a non-exhaustive list of what the tool can do - and be sure to look at *What the Tool IGNOREs* so you understand the limitations.

#### Why This Tool?
Because he is in retirement, and has an unhealthy IRA balance to manage - it became obvious that no tool he could find offered the flexibility and ease of use he desired.  He and his wife are of different ages (so have different IRAs, RMD timings, Social Security amounts, etc.)  Some really powerful tools didn't offer California tax calculations (California is a high tax state), didn't provide for life expectancy, and more.

The purpose of this tool is to model the remaining years of life with respect to spendable cash and taxation - and to determine how to optimize spendable cash. This tool may be useful to those who are *in* or *very near* retirement. It is not designed to analyze portfolios, in fact you must provide a best guess on the growth rate you expect for your particular portfolio(s).
Signficantly more analysis is needed to do pre-retirement optimization, or optimization of asset mixes - this is not a tool for that. 
		
Many focus on <i>Roth Conversions</i> and that is not wrong thinking, but such a view misses the big picture of WHY to do conversions. Also from the time one stops getting regular W2 income until the time one starts receiving pensions or social security is known as the "valley of opportunity".  
During this otherwise low income period, strategic withdrawals and movement is possible. Ultimately you are in a better place if you have <i>degrees of freedom</i> in your assets - more on this in a moment. 
It also does not make sense to pay more tax than necessary. I do not see taxation as evil, but it does not feel "right" to pay up to 14,000/year in IRMAA fees for no net benefit 
in Medicare - but that is one of the many pitfalls of having too much forced income.
		
Having a large tax deferred IRA/401K balance (about 350K or larger) can have many consequences, the worst being taking forced income (RMDs) at higher tax rates and incurring those IRMAA penalties just described.  
In this tool, we lump IRMAA together with California state and Federal taxes (including NIIT and capital gains) to show the big picture: net taxes/net spendable income, year by year spend and "Final Wealth".

#### Key Features:

1. A complete model until death of a single person or married couple with RMDs calculated, separation of 5 different accounts (IRA1, IRA2, Brokerage, Cash, ROTH)
2. Tweakable rates, withdrawal strategies, and charts and tables to match them - but NOT TOO many variables.
3. A structure that can allow replacement of the California tax tables with (any) other states. 33 of the US states tax IRA and 401K withdrawals the same way - albeit at different tax rates.  Also, those same 33 states treat all capital gains as taxable income - and that can matter quite a lot. In fact, 8 different state tax rates are currently available. WARNING: only California calculations are done using the correct model. Other states may be off. Best to double check.
4. Modeling can show the true cost of the widow penalty (when one spouse predeceases another)
5. The ability to model different spending rates in retirement (e.g. the spending SMILE) or a flat spending rate.
6. A simple way to see the MOST you might expect to spend through retirement, what happens if your life expectancy is changed
7. It automatically rolls any IRA balance from the decease spouse to the living spouse (because RMDs may apply differently!)
8. Forecast the affect of the impending 2033 Social Security Fund depletion (with a 33% reduction in payouts)
9. "Wealth" as shown in this tool is adjusted for the average taxation measured.  Many tools would show a 500,000 Roth and a 500,000 IRA as being 1,000,000 net worth.  But that's not the case. You can only take money out of an IRA/401K at a zero percent total rate at a very low amount. RMDs may make that impossible at some point.
10. Choose tax rates from a number of states (currently California, District of Columbia, Michigan, New York, North Carolina, Oregon, Pennsylvania, and NONE (for those states with no state tax).

#### Features in the Works:

1. Fix the withdrawal logic. Currently it undershoots withdrawals in some scenarios (particularly "Withdraw to meet spend") and overshoots others.
2. Implement the "maximize conversion" logic - use cash/brokerage assets to increase Roth conversions.
3. There are two tax engines, the current one is rough and doesn't properly handle capital gains.
4. Use a more comprehensive calculation. (It's in the code, but needs updating to be made usable).
5. Add a "taxcreep" to see what harm a creeping tax rate might do.
6. More robust federal tax handling (currently needs *Capital Gains* and *NIIT* handling and improvements in handling SS taxability)
7. "Maximize" Roth option. It would use available Cash and brokerage accounts to "backfill" the taxes needed for a conversion. Currently it "converts" the excess withdrawals after taxes and spend goal.  This option would throw cash at covering the tax on IRA withdrawals to increase conversion.
8. Save/Export/Delete/Import inputs to try different scenarios.  (These are currently in the development version).
9. Autoload any saved "Default" scenario (so you can pick up where you left off).
10. Better organize the Annual Details tables.
11. Allow exporting of the Annual Details table(s).


#### What the Tool IGNORES

+ The various short term benefits to seniors under the OBB (e.g. extra deductions and phaseouts).  For the author, those small helps will be gone before he manages to deplete his IRA sufficiently.
+ It does not track separate ROTH accounts - because ROTH accounts have no tax consequences, so they are much like cash.  
+ Forecasting variable growth rates, or growth rates that differ between different assets.  (It's silly to forecast 8% growth in an IRA and 4% growth in a ROTH - or v.v.)
+ Trying to Monte-Carlo or apply historical models.
+ This is not a tool to attempt to model different asset class ratios, or different asset location arrangements.
+ Tax filing statuses other than MFJ (married filing jointly) and SGL (Single). There is no Head of Household, Married filing separately, etc.
+ There is no provision for itemized tax returns.  This tool assumes you rely on standard deductions.
+ No provision for using QCDs to minimize Required Minimum Distributions.  This might get added. You can take QCDs starting at age 70.5 for up to 111k per person.
+ The tool doesn't try to maintain a brokerage account balance or a cash balance. It will deplete those to zero.
+ The tool also funnels dividends (from the Brokerage) and interest on cash into the cash account (i.e. it does not model dividend reinvestment) in part because modeling the basis of a brokerage account becomes more 
complicated - and in part, because the author believes that using those cash equivalents generally works better to SPEND or apply to Roth Conversion.

#### Limitations and Restrictions

A. The tool models things a year-at-a-time. This is not strictly accurate, because, for example, **when** you make withdrawals or conversions may affect the net. For example, 
if you wait until the end of the year to make your withdrawals has a different result than making a withdrawal at the beginning of the year.  The order of calculations is:  RMD withdrawals, calculation of spending/conversion withdrawals (and removal of those funds from the needed accounts) THEN taxes, interest and dividends on the remainder are calculated. Surplus funds after minimum spending levels are 
deposited into a Roth.  
B. As noted, it tracks ONE total Roth balance, even if you're married.
C. IRA withdrawals to reduce IRA balances are done proportionately. Some improvement may result by reducing a large balance first.  You can model this by moving the total balance to one person.
D. **There is no SUPPORT for this tool**. If you ask nicely, or offer a pull request to actually implement a feature, of course we can talk. It is a best effort/time available endeavor.


#### What about Other tools
One of the lovely things about engineers, is they like to build things. I've found at least two other free resources that both inspired me and made realize that there is more than one way to solve problems.  

The sources I found:

+ [GoogleSheet](https://docs.google.com/spreadsheets/d/1orZQ9g1KvGVrCShibutjyreaeqbmRFVAZ9aSY_57-DQ/edit?gid=1250894970#gid=1250894970) by Charles Eglington found on [Reddit](https://www.reddit.com/r/DIYRetirement/comments/1pnpufa/comment/nu9lawc/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1), but missing some - to me - important things. In particular it doesn't properly calculate standard deductions (age related), or handle several situations related to the death of one spouse. It needs a "Life Expectancy" for each person, and should properly calculate deductions, filing status, etc.  In addition, I'd like it to "self optimize" by varying the amounts of IRA/401K withdrawals (and the number of years for withdrawals).  Ideally it would properly, or more properly calculate California Tax, and have a way to forecast based on inflation.

+ Another [Reddit](https://www.reddit.com/r/DIYRetirement/comments/1pnpufa/comment/nulys5i/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button) contribution by <i>Working-Schedule5000
</i> is what made me realize that writing a tool in JavaScript results in the most readability and tweakability of the code. Spreadsheets can become hard to follow.  To use download and save, then run in your browser: https://drive.google.com/file/d/1ZJNCg-HNXHZmzWv9zW1anaFpLNTOTf10/view
