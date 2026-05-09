## Who is this For?  What Can It Do? 

You can [download the files](https://github.com/nightskyguy/retirement_assets) and run the tool offline in about any browser (only Brave and Chrome have been tested).  Or you can directly run the tool from Github Pages here:

** [nightskyguy.github.io](https://nightskyguy.github.io/retirement_assets/retirement_optimizer.html) **

**There is no SUPPORT for this tool** and no guarantee of accuracy, or appropriateness of use. There is also no charge. **USE AT YOUR OWN RISK**

A California resident built this with [Google gemini](https://gemini.google.com), [claude.ai](https://claude.ai) and [ChatGPT](https://chatgpt.com") AI assistance. The author is a retired software engineer, spreadsheet twiddler, has a strong knowledge of Python, Javascript, and Groovy. See **Key Features** below for a non-exhaustive list of what the tool can do - and be sure to look at *What the Tool IGNOREs* (and *Known Bugs*, below) so you understand the limitations.

#### Features in the Works (and Known Bugs):

> [!WARNING]
> I've stopped updating this for the time being.  In part because I am evaluating other tools, in part because I realized that the approach needs some rethinking. And in part because some of the bugs are daunting.

+ **BUG** We suspect the "Fill Bracket" goal has a flaw in the implementation. Please be cautious/ignore for now!
+ **BUG** There appears to be an error in the logic that is now under-withdrawing to meet spend goals.  For my several test scenarios, under withdrawals to meet spend may come to 3k per year. 
+ **BUG** The Dividend rate is applied to the Brokerage account. It should be applied to the Roth account, too! Brokerage dividends are accumulated in the Cash account.
+ **BUG** It's not clear if interest and dividends are being properly accounted for.
+ Add a "taxcreep" to see what harm a creeping tax rate might do.  I notice some states (e.g. Georgia) are reducing their tax rates, while others are adding more brackets and increasing rates.
+ Better organize the Annual Details tables. There are just too many columns to easily navigate. **NOTE** Release 7g has new selectable columns.
+ Allow exporting of the Annual Details table(s).
+ The tool should warn when a "Fill Federal Bracket" is picked that is impossible to meet due to After-Tax Spend goal. For example, setting After-Tax Spend to 180,000 makes it impossible to stay in the 12% (or even the 22%) bracket unless there are lots of cash, brokerage or Roth assets already.
+ Allow selection of the quarter in which withdrawals will occur. I don't know if it makes a significant difference, but changing the model a bit will make it possible to know how much difference it might make. For example if you're trying to draw down an IRA, taking the withdrawals early in the year means you will accrue less growth in the IRA account (and more in the Roth or Brokerage if that's where the funds go). Conversely, if you're trying to make the account grow a little more, taking withdrawals in the last quarter may help.
+ There is no option to accumulate "surplus" amounts anywhere except Roth. Or to try to refill Brokerage or Cash accounts. Surplus in this context means if your spend goal is exceeded, the amount above your planned spend is counted as surplus and is automatically marked as a Roth conversion.  Since Roth is the "super account" for most purposes, it's not clear if an option to do anything else makes sense.

##### Recent Fixes / Improvements
+ Only the surplus from IRA withdrawals can be moved into Roth. **FIXED** 
+ Fix the withdrawal logic. Currently it undershoots withdrawals in some scenarios (particularly "🔄Withdraw Proportionally") and often overshoots.  Note the improved tax calculations - item 3 below - have lessened this problem a bit, but it still occurs. **FIXED** 
+ **DONE** Implement the *Max Conversion* logic - use cash/brokerage assets to increase Roth conversions. Currently it "converts" the excess withdrawals after taxes and spend goal.  But if there is available cash to pay taxes on the conversion, more can be moved into Roth. Of course excess withdrawals can also be spent or deposited into cash. However there is not an option to withdraw brokerage funds to increase Roth conversions.
+ The tax calculations are more comprehensive. **FIXED** 
+ When Roth funds are tapped to meet spending goals, it may over-withdraw. For example, it may withdraw 15,000 and then have a 15,000 surplus which implies the Roth withdrawal was unnecessary. **FIXED** 
+ Save/Import/Export of settings **DONE**. The Load/Save/Delete/Manage Scenarios UI is undocumented. 
+ **Completed** Autoload any saved "default" scenario (so you can pick up where you left off).  A message pops up telling you this happened.

#### Why This Tool?
Because the author is in retirement and has an unhealthy IRA balance to manage - it became obvious that no tool he could find offered the flexibility and *ease of use* he desired.  He and his wife are of different ages (so have different IRAs, RMD timings, Social Security amounts, etc.)  Some really powerful tools did not offer California tax calculations (California is a high tax state), or did not provide for life expectancy, and more.  Some of the questions the author sought to answer by modeling are these:

- Which strategy does the best job of reducing total taxation?
- What withdrawal strategy produces the most annual spendable amount? What is that amount?
- What assets will be left at the end of life, and in which accounts?

Therefore, the purpose of this tool is to model the remaining years of life with respect to spendable cash and taxation - and to determine how to optimize spendable cash. This tool may be useful to those who are *in* or *very near* retirement. It is not designed to analyze portfolios, in fact you must provide a best guess on the growth rate you expect for your particular portfolio(s).
Signficantly more analysis is needed to do pre-retirement optimization, or optimization of asset mixes - this is not a tool for that. Some general principles apply, however: in general if you have a large IRA, it is usually best to put more bonds and conservative assets in the IRA, and put more aggressive assets in the ROTH so that they can grow tax free.
		
Many focus on ***Roth Conversions*** and that is not wrong thinking, but such a view misses the big picture of WHY to do conversions. Also from the time one stops getting regular W2 income until the time one starts receiving pensions or social security is known as the "valley of opportunity".  
During this otherwise low income period, strategic withdrawals and movement is possible. Ultimately you are in a better place if you have *degrees of freedom* in your assets - more on this in a moment. 
It also does not make sense to pay more tax than necessary. I do not see taxation as evil, but it does not feel "right" to pay up to 14,000/year in IRMAA fees for no net benefit 
in Medicare - but that is one of the many pitfalls of having too much forced income.
		
Having a large tax deferred IRA/401K balance (about 350K or larger) can have many consequences, the worst being taking forced income (RMDs) at higher tax rates and incurring those IRMAA penalties just described.  
In this tool, we lump IRMAA together with California state and Federal taxes (including NIIT and capital gains) to show the big picture: net taxes/net spendable income, year by year spend and "Final Wealth".

#### Key Features:


+ Sophisticated Federal Tax and State tax calculations.  Includes *Capital Gains*, *NIIT*, a variety of states, and accurate social security taxation calculations.
+ A complete model until death of a single person or married couple with RMDs calculated, separation of 5 different accounts (IRA1, IRA2, Brokerage, Cash, ROTH)
+ Tweakable rates, withdrawal strategies, and charts and tables to match them - but NOT TOO many variables.
+ Withdrawal Strategies include: **🔄Withdraw Proportionally** this strategy does nothing to avoid RMDs or IRMAA but it does withdrawals based on asset balances.  A "**💸Reduce IRA in *N* Years**"  attempts to amortize the IRA down to "IRA Goal" in the number of years specified (Note "**Optimizer 🎯**" checks years 1 to 30 automatically and highlights the best result in a table - click any line in the table to choose that scenario). A "**🪣Fill Federal Tax Bracket**" where you pick the Federal Bracket you want to fill, and it draws up to the top of that bracket (or a higher one if your Spend Goal is too high) with the intent of doing Roth conversion with any surplus. A "**🛑Lesser of IRMAA or TaxBracket**" which is not currently implemented.
+ There is also a "Max Conversion" option. What it does is use any surplus cash to increase Roth conversions from the largest IRA balance.
+ A structure that allows more than just the California tax tables (which are the default) 33 of the US states tax IRA and 401K withdrawals the same way - albeit at different tax rates.  Also, those same 33 states treat all capital gains as taxable income - and that can matter quite a lot. In fact, 8 different state tax rates are currently available. WARNING: only California calculations are done using the correct model. Other states may be off. Best to double check.
+ Modeling can show the true cost of the widow penalty (when one spouse predeceases another) and the IRMAA penalty.
+ The ability to model different spending rates (goals) in retirement (e.g. the spending SMILE) or a flat spending rate.
+ A simple way to see the MOST you might expect to spend through retirement, what happens if your life expectancy is changed
+ It automatically rolls any IRA balance from the deceased spouse to the living spouse (because RMDs may apply differently!)
+ Includes the affect of the impending **2033 Social Security Fund** depletion (with a 23% reduction in payouts).
9. "Wealth" as shown in this tool is adjusted for the average taxation measured.  Many tools would show a 500,000 Roth and a 500,000 IRA as being 1,000,000 net worth.  But that's not very accurate. You can only take money out of an IRA/401K at a zero percent total rate at a very low amount. RMDs may make that impossible at some point.
10. Choose tax rates from a number of states (currently California, District of Columbia, Michigan, New York, North Carolina, Oregon, Pennsylvania, 
Virginia, Illinois, Connecticut, Maryland, Georgia and NONE (for those states with no state tax).  Note there are some calculation variations among 
states that are not performed.
11. Save/Load/Import/Export settings (**Import/Export 📂**) so you can quickly start where you left off. If you save your settings as the name "default" those settings will automatically be reloaded when you restart. NOTE settings are saved in your browser. However you can Export them and Import scenarios in another browser if you wish.
12. View the detailed transactions (**Annual Details ⊞**) or a simplified graph (**Chart 📊**).



#### What the Tool IGNORES

+ The various short term benefits to seniors under the OBB (e.g. extra deductions and phaseouts).  For the author, those small helps will be gone before he manages to deplete his IRA sufficiently.
+ It does not track separate ROTH accounts - because ROTH accounts have no tax consequences, so they are much like cash, but in fact, Roth's can't be co-owned.  
+ Forecasting variable growth rates, or growth rates that differ between different assets.  (It's silly to forecast 8% growth in an IRA and 4% growth in a ROTH - or v.v.) because that may hide the value of one over the other, however it MAY make sense for Roth assets to be more aggressive than IRA assets.
+ Monte-Carlo or historical models to determine plan robustness.  That may happen in the future.
+ This is not a tool to attempt to model different asset class ratios, or different asset location arrangements.
+ Tax filing statuses other than MFJ (married filing jointly) and SGL (Single). There is no Head of Household, Married filing separately, etc.
+ There is no provision for itemized tax returns.  This tool assumes you rely on standard deductions (or exemptions, if that's what your state uses).  It also assumes that Single means one person, Married Filing Jointly is two. If you have a dependent adult, or children, it will not calculate the proper possible exemptions or deductions for these situations.
+ There is currently No provision for using QCDs to minimize Required Minimum Distributions.  This might get added. You can take QCDs starting at age 70.5 for up to 111k per person.
+ The tool doesn't try to maintain a brokerage account balance or a cash balance. It will deplete those to zero if required.
+ The tool also funnels dividends (from the Brokerage) and interest on cash into the cash account (i.e. it does not model dividend reinvestment) in part because modeling the basis of a brokerage account becomes more complicated - and in part, because the author believes that using those cash equivalents generally works better to SPEND or apply to Roth Conversion.

#### Limitations and Restrictions

A. The tool models things a year-at-a-time. This is not strictly accurate, because, for example, **when** you make withdrawals or conversions may affect the net. For example, 
if you wait until the end of the year to make your withdrawals has a different result than making a withdrawal at the beginning of the year.  The order of calculations is:  RMD withdrawals, calculation of spending/conversion withdrawals (and removal of those funds from the needed accounts) THEN taxes, interest and dividends on the remainder are calculated. Surplus funds after minimum spending levels are deposited into a Roth.  In real life, you must do Roth conversions as a separate operation, but this tool can help forecast what that conversion would be.
B. As noted, it tracks ONE total Roth balance, even if you're married.
C. IRA withdrawals are done *proportionately*. Some improvement may result by reducing a large balance first.  You can model this by moving the total balance to one person.
D. **There is no SUPPORT for this tool**. If you ask nicely, or offer a pull request to actually implement a feature, of course we can talk. It is a best effort/time available endeavor.


#### What about Other tools
One of the lovely things about engineers, is they like to build things. I've found many other free resources that both inspired me and made realize that there is more than one way to solve problems.  

The sources I found or built.

+ [IRA Projection](https://nightskyguy.github.io/retirement_assets/IRA_projection.html) by Me.
In following various Reddit and YouTube discussions, I notice a lot of handwaving about IRA/401K balances. What this tool does is it allows you to set your current age, current IRA value, growth and inflation, filing status, and withdrawal rate.  It then calculates the IRA balance and RMDs (once they kick in).  If your current age is > 66 it assumes you have RMDs starting at 73, otherwise it assumes at 75.  You can view the plot in Current or Future dollars.  It's particularly useful for noticing if/when RMDs (by themselves) would exceed certain thresholds (like the Federal 22% bracket). Note that the thresholds provided by default assume the standard deduction has been applied. All brackets are adjusted by the inflation figure given.  You can also add or override the brackets, e.g. to determine which IRMAA tier(s) may be crossed, or to add State tax brackets.  There is no provision for including "additional" income like Social Security, pension, dividends, capital gains, or interest.  And there is no provision for adding lumpy withdrawals, or applying a "curve" to withdrawals. Also, it assumes withdrawals start immediately.  These are possible future additions, but again, the goal is just to get an idea what an IRA might look like in 5 or 10 or 15 years at different appreciation and withdrawal rates.

Where I think it will shine is to quickly determine: how your spending power erodes with inflation, and whether you are going to face RMD jeopardy (and the scale of that jeopardy).

+ [GoogleSheet](https://docs.google.com/spreadsheets/d/1orZQ9g1KvGVrCShibutjyreaeqbmRFVAZ9aSY_57-DQ/edit?gid=1250894970#gid=1250894970) by Charles Eglington found on [Reddit](https://www.reddit.com/r/DIYRetirement/comments/1pnpufa/comment/nu9lawc/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1). It's got lots of options. I want some things that aren't in it like a "Life Expectancy" for each person, properly calculate deductions, deduce filing status, etc.  In addition, I'd like it to "self optimize" by varying the amounts of IRA/401K withdrawals (and the number of years for withdrawals).  Ideally it would properly, or more properly calculate California Tax, and have a way to forecast based on inflation. But it's still a helpful tool.

+ Another [Reddit](https://www.reddit.com/r/DIYRetirement/comments/1pnpufa/comment/nulys5i/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button) contribution by _Working-Schedule5000
_ is what made me realize that writing a tool in JavaScript results in the most readability and tweakability of the code. Spreadsheets can become hard to follow.  To use download and save, then run in your browser: https://drive.google.com/file/d/1ZJNCg-HNXHZmzWv9zW1anaFpLNTOTf10/view

+ [Visual Federal Tax Tool](https://engaging-data.com/tax-brackets/) - this tool shows how your federal taxes are calculated.  As of 2026-01-17, it doesn't handle taxability of Social Security income, and as best I can tell, doesn't handle the OBB (One Big Beautiful Bill) provisions for seniors.

+ [What IRA Balances Result in IRMAA due to RMDS](https://nightskyguy.github.io/retirement_assets/irmaa_and_rmds.html) I wrote this tool, too, using AI. Given entered fixed income, it calculates what size IRA balance will cause RMDs that hit IRMAA tiers at various ages.  The tool uses current rates and does not attempt to adjust for inflation.  For example a married couple with a $16,607,550 balance at age **73** together with $130,000 income (pensions/social security/etc) will hit the highest IRMAA Tier 5 due to $626,700 forced RMD. Yeah, that is clearly not most of us. But at age **80** a $2,882,540 IRA balance together with that same income will hit **Tier 2** $5.2K annual charge) because that balance at that age forces a $142,000 RMD.  A balance of $1,286,740 for a single 80 year old lands in **Tier 4** with a $5,7k annual charge.  At 75 that same single person would be in Tier 4 with a 1.5M IRA balance. 

Operational Tools (All Free, though one is only free to try)

+ [NestWise](https://www.nestwise.me/) - lots and lots of features. No login required. Includes things like budgeting, extensive Monte Carlo analysis, and even one of my favorite features which allows you to automatically iterate over different withdrawal rates (using different strategies) to find one that best suits you.  I've examined the source code for this tool and collaborated with the developer. No backdoors, or exploitable flaws were found.
+ [RetirementIQ](https://retirementiq.app/) Free for 7 days, $50/year. I've not dabbled much with this, partly because I prefer open source that I can inspect for possible flaws, backdoors, etc.  Directly invoke it here: [retirementiq.app](https://retirementiq.app/app/)

+ [Retirement Figures](http://retirementfigures.com/) seems pretty robust and is currently free.  I have no  access to the source to look for problems.


## Ramblings and Observations

### Some of the Things I Learned About Taxation

**Moldy Brackets** While the Social Security payments are adjusted annually by the CPI (Consumer Price Index), the rate at which Social Security is taxed is based on thresholds have NEVER been adjusted for inflation since they were established (1983 for 50%, and 1993 for 85%). This is no doubt why congress has churned and churned on trying to make Social Security non taxable.

**IRMAA Escalation** My original model assumed that the IRMAA tax brackets and amounts are adjusted by CPI, but that's not true. The *brackets* are adjusted per CPI, but the amounts are tied to Medicare. The CPI has averaged about 2.8% annually over the last 20 years, but Medicare has averaged 5.6% annual increase.  IRMAA, as mentioned is a TAX CLIFF, not a graduated bracket. That means if you make $1 more than the maximum you move up an IRMAA tier. The result is not only the need to pay the tax, say an extra 4k per year, but you may have to withdraw more from an IRA to pay the tax.  At a 20% nominal tax rate, that extra $1 costs at least $5K AND may result in pushing you up into higher marginal brackets.

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

#### ROTH Conversion Gotchas

The bad scenarios for ROTH conversions are these - and most can be modeled with the [IRA Projection Tool](https://nightskyguy.github.io/retirement_assets/IRA_projection.html)

1. You withdraw/convert now at a (significantly) higher tax rate than you will face in your future. Converting into the 24% bracket might save you even if you expect to be in the 22% bracket, but converting into the 32% bracket will likely not help - at least this is the conventional wisdom.
2. You withdraw + convert in an amount that pushes your taxation up (this is a specific case of 1)
3. You convert before you're 59.5 and do not have funds to pay the taxes AND/or that conversion pushes you into a higher taxation situation.
4. You have modest IRA balances and expect that to be the case once you start drawing them in retirement. Modest here means something less than 1 million with 12 or fewer years before you plan to start drawing down assets. If you have 1M now, 10 years of 10% gains like those from 2016 to 2025 could TRIPLE that 1M to 3M.  3M would force you to take about 115k from your IRA at age 75. If married the RMD plus 70k in social security and other income lands you in the Federal 24% bracket.  At 83 just the RMD will put you in the 24% Federal Bracket.  If single, your first RMD will land you in the 24% Federal Bracket above the IRMAA tier 1.
5. Your remainder estate is going to charity (not people).  Charities pay zero tax regardless of the income source. If you can stomach the RMD forced income, it may not be necessary to bother with conversions.
6. You plan to take advantage of QCDs (Qualified Chraritable Deductions) after 70.5 years of age. QCDs satisfy RMD requirements, and do not count against your MAGI so do not incur IRMAA penalties.
7. You already have a healthy mix of assets (e.g. 60% IRA/401K, 30% Roth, 10% or higher Cash/CDs/Bonds in taxable).
8. You have to pay conversion taxes solely from the IRA withdrawals. This is not always a bad thing.
9. You plan to make relatively large annual withdrawals.  For example, assume you're 59 now and your IRA balance is 1M. It grows at a steady 8% annually. In 3 years you start taking 70K (adjusted for inflation, so actually 77k), at age 75 your RMD will be less than your planned annual withdrawal and remain so to age 99. This is "living on the edge", but if you have other assets (Roth, Brokerage) 

There are more than a dozen ways that not doing a conversion (to ROTH or brokerage) can result in less spendable money and reduce spendable asset value. These scenarios mostly affect those with proportionately large IRA/401K balances. Even modest IRA/401K balances can significantly improve their asset balance and spendable cash through thoughtful withdrawals and conversions.

Here are some of the harms of having or accruing a large IRA/401K:

1. Growth in or size of the IRA/401K balance reaches a point where you end up in a higher tax bracket before or after RMDs start.
2. RMDs cause you to have little to no room for managing your desired spend (i.e. avoiding higher taxes and/or IRMAA and/or NIIT) - if you don't plan to invoke QCDs.
3. If the bulk of your assets remain in an IRA/401K, any large extra expenditure may cause a corresponding hit to your taxation (think remodeling, buying a fancy car, repairing a roof, or buying a vacation home).
4. Tax rates could go up significantly in the future (I argue they will go up!).
5. Social security bottoms out in 2033 (as it is on track to do), and you have to withdraw more to cover the loss of Social Security funds to maintain your style of living ... increasing your taxation.
6. Your spouse passes away. Now you're in a single tax bracket paying 30% more taxes for the same income (unless you remarry).
7. Your IRA (not 401K) crosses about 1.5m - in that case you could be forced to surrender some of it in a lawsuit. (401Ks have stronger protection). ROTHs are similarly exposed, but because ROTH is not taxed, a smaller balance has greater value to you.
8. You (and your spouse) pass away. Your heirs will be forced to liquidate the IRA/401K balance within 10 years at THEIR tax rate. (ROTHs must be liquidated, too, but there is no tax).
9. If you or your spouse pass away, usually the most effective way to manage this is for the survivor to "take over" the deceased's IRA/401K balance. The now larger balance will be subject to the survivors RMD requirements. This might be better if the surviving spouse is younger, but could go the other way.
10. As your IRA/401K grows, your RMDs will also grow. At some point this causes 85% of your social security to become taxable, AND causes IRMAA taxes, AND possibly NIIT.
11. IRA/401K withdrawals are taxable income in MOST states. ROTH withdrawals are not taxable in any state.
12. You die wealthy, not having spent what you could have, and your heirs pay the highest taxes of their lives to draw down the remaining balance in 10 years.  Though they may still be able to use QCDs if they are 70.5 at the time.
