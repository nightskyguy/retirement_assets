const drawerContent = {
/////////////////////////////////////////////////////////////////////////////////	
howToUse: `  
	<div class="log-entry"><ul>
		<li><strong>1. Profile &amp; Ages:</strong> Enter the birth year of each person and estimated life expectancy for both partners. To model a single taxpayer, set the <I>Spouse Birth Year</I>, <i>Spouse  Life expectancy</i> and <i>Spouse IRA</i> to zero.</li>
		<li><strong>2. Assets:</strong> Enter balances. <i>Brokerage Basis</i> is used to calculate capital gains vs. principal. Brokerage withdrawals will be assumed to be part subject to capital gains. Total all after tax investment assets into <i>Brokerage</i>, and all cash-like holdings into <i>Cash</i>. Should one spouse predecease the other, all IRA assets are inherited by the remaining spouse. <i>For Roth</i>, sum the existing ROTH balances into one total.</li>
		<li><strong>3. Income</strong> Input annual Social Security and pensions. Set the start ages to see the impact of delaying benefits. Amounts you enter for <i>Social Security Amt</i> will be adjusted annually by the <i>CPI/COLA</i>. </li>
		<li><strong>4. Assumptions:</strong> choose the Inflation rate, the CPI rate (which is the expected change in tax brackets rather than actual inflation), the <i>Growth</i> rate for the IRA/401K, Brokerage &amp; ROTH.  <i>Cash Interest</i> is the expected interest on cash and cash-like investments (e.g. Mutual Funds/Bonds). To make these numbers accurate, it's best to separate all investments into "Brokerage" and cash into Cash.</li>. <i>Social Security Fail</i> &amp; <i>SSecurity Net Payout</i>.
		<li><strong>Strategy:</strong> 
			Find this unlabeled item at the top left of the display.
			Set the <i>After-Tax Sending Goal</i> to the amount of after-tax income you need per year. And set the <i>Spend Delta</i> percentage. A Spend Delta of 100 means no change, while a 98.5 would reduce spending by 1.5% each year. To have spending grow, use a number greater than 100%
			<ul><li>In <em>Withdraw to meet spend goal</em> it proportionately withdraws enough from all available sources to reach <i>After-tax Spending Goal</i>. Its a good baseline to compare with other strategies.</li>
			<li>Compare with <em>Reduce IRA in N Years</em> to amortize your IRAs in a fixed number of years (they won't be emptied, they will be drawn down to <i>IRA Reduction Goal</i>.</li>
			<li><i>Fill Federal Tax Bracket</i> withdraws enough to max out the chosen federal tax bracket.</li>
			<li><i>Lesser of IRMAA or ...</i> is not yet implemented, but here it's like <i>Fill Federal Tax Bracket</i>, but reduces the amount withdrawn to stay under the (next) IRMAA tier.</li></ul>
		<li><strong>After Changes...</strong> selecting the Annual Details, Chart or Optimizer will cause a recalculation and show the page. 
		<I>Optimizer</I> finds the mathematical "sweet spot" for emptying IRAs to minimize lifetime total tax and maximize total spendable value. It checks different drawdown years - that is the same thing as the <i>Reduce IRA in N Years</i> but it loops through from 1 to 30 years.</li>
		</li>
	</ul>			
	<h4>What is Missing</h4>
	<p>This tool does not (currently) model <b>annuities</b>, multiple pensions, additional w2 (taxable) income</b>. The tool intentionally keeps the number of options low.  Currently the "optimize" option focuses on depleting the IRA balance(s) to the point where future RMDs will not force excess taxation (Federal, State and IRMAA). An additional optimization is planned that will iterate to maximize spendable - see the <B>Planned</B> tab. These 
	features, however are <B>NOT in scope</B>.
	<ol><li>There is no Monte Carlo or other fancy strength tests.</li>
	<li>The RMD tables are the standard one, not the one that might apply if there is a 10 year or more difference in spouse ages</li>
	<li>It only uses the MFJ and Single tax brackets. (No head of household, or Married filing separately)</li>
	<li>Because ROTH assets are not taxable, it merges all ROTH funds into one account. In real life, conversions/withdraws and earnings would occur in separate accounts.</li>
	<li>There is no Federal Alternative Minimum Tax (AMT) calculation. This normally does not apply to retirees unless they have huge bond interest, or are exercising ISO stock.  In the case of California the 1% additional tax for high earners is built into the embedded tax table.</li>
	</ol>
</div>
	`,
/////////////////////////////////////////////////////////////////////////////////	
planned: `
	<div class="drawer-content" id="drawer-planned"><B>Planned Enhancements &amp; Bug Fixes</B>
	Please read details in the  <A href="https://nightskyguy.github.io/retirement_assets/">README.md</A> - it contains 
	a list of planned enhancements and known problems.  In case you're wondering, I moved it there 
	because I was failing to duplicate between these documents and decided to save myself some 
	pain.
	</div>  
	`,
/////////////////////////////////////////////////////////////////////////////////
background: `  
		<div class=drawer-content" id="drawer-background">
		<h3>Who is this For, What are the Caveats</h3>
		<p>A California resident built this with <a HREF="https://gemini.google.com">Google gemini</A> (and <A HREF="https://claude.ai/">claude.ai</A> and <A HREF="https://chatgpt.com/">ChatGPT</a>) AI assistance because he is in retirement and has an unhealthy IRA balance to manage. <strong>The purpose of this tool, therefore, is to model the remaining years of life with respect to spendable cash and taxation - and to determine how to optimize spendable cash.</strong> This tool may be useful to those who are in or very near retirement.  Signficantly more analysis is needed to do pre-retirement optimization. Nor is the goal of this tool to optimize <a HREF="https://en.wikipedia.org/wiki/Asset_location">asset location</a> or <A HREF="https://en.wikipedia.org/wiki/Asset_allocation">asset allocation</A>.
		
		Many focus on <i>Roth Conversions</i> and that's not wrong thinking, but such a view misses the big picture of WHY to do conversions. Also from the time one stops getting regular W2 income until the time one starts receiving pensions or social security is known as the "valley of opportunity".  During this otherwise low income period, strategic withdrawals and movement is possible. Ultimately you are in a better place if you have <i>degrees of freedom</i> in your assets - more on this in a moment. It also does not make sense to pay more tax than necessary. I do not see taxation as evil, but it does not feel <i>right</i> to pay up to 14,000/year in IRMAA fees for no net benefit in Medicare - but that is one of the many pitfalls of having too much forced income.
		
		<p>Having a large tax deferred balance has many consequences, the worst being taking forced income (<B>R</B>equired <B>M</B>inimum <B>D</B>istributions - RMDs) at higher tax rates and incurring IRMAA penalties.  In this tool, we lump IRMAA together with California state and Federal taxes (<i>including NIIT and capital gains</i> in the future) to show the big picture: net taxes/net spendable income.
		
		<p>There are three ways I can think of where doing a ROTH conversion could make the financial landscape worse and all are easily avoidable. That means in most situations one is better off having assets in Tax deferred (IRA/401k), Tax Free (ROTH), and Taxable (Brokerage/cash) - this is how to obtain <b><i>degrees of freedom</i></b>.  
		<h4>About State Taxation</h4>
		33 of 50 states tax capital gains the same as regular income. Unfortunately many tools and many discussions neglect this aspect, which is another reason I wrote this tool. 9 states have no taxation or do not tax capital gains (as of 2025), and 9 states have preferential treatment of capital gains. <A HREF="https://www.theentrustgroup.com/blog/state-capital-gains-tax">[Source]</A>
		If you live in, or plan to move in a different state and you want to use this tool, you can!  It now includes several states - and more can be added. If you're impatient, you can get creative and ask AI to add your state to the <i>TAXdata</i> embedded in retirement_optimizer_taxdata.js file.
		<p>
		<h4>ROTH Conversion Gotchas</h4>
		<p>The bad scenarios for ROTH conversions are these:
		<ol><li>You withdraw/convert now at a higher tax rate than you will face in your future.</li>
		<li>You withdraw + convert in an amount that pushes your taxation up (this is a specific case of 1)</li>
		<li>You convert before you're 59.5 and do not have funds to pay the taxes AND/or that conversion pushes you into a higher taxation situation.</li>
		</ol>
		There are more than a dozen ways that not doing a conversion (to ROTH or brokerage) can result in less spendable money and reduce spendable asset value.  These scenarios mostly affect those with proportionately large IRA/401K balances. Even modest IRA/401K balances can significantly improve their asset balance and spendable cash through thoughtful withdrawals.
		Here are some of the harms of having or accruing a large IRA/401K:
		<ol>
		<li>Growth in or size of the IRA/401K balance reaches a point where you end up in a higher tax bracket before or after RMDs start.</li>
		<li>RMDs cause you to have little to no room for managing your desired spend (i.e. avoiding higher taxes and/or IRMAA and/or NIIT).</li>
		<li>If the bulk of your assets remain in an IRA/401K, any large extra expenditure will result in a corresponding hit to your taxation (think remodeling, buying a fancy car, or a vacation home).</li>
		<li>Tax rates could go up significantly in the future (I argue they will go up!).</li>
		<li>To spend more, you have to withdraw more and pay more tax.</li>
		<li>Social security bottoms out in 2033 (as it is on track to do), and you have to withdraw more to cover the loss of Social Security funds... increasing your taxation.</li>
		<li>Your spouse passes away. Now you're in a single tax bracket paying 30% more taxes for the same income (unless you remarry).</li>
		<li>Your IRA (not 401K) crosses about 1.5m - in that case you could be forced to surrender some of it in a lawsuit.  (401Ks have stronger protection). ROTHs are similarly exposed, but because ROTH is not taxed, a smaller balance has greater value to you.</li>
		<li>You and your spouse pass away. Your heirs will be forced to liquidate the IRA/401K balance within 10 years at THEIR tax rate.  (ROTHs must be liquidated, too, but there is no tax).</li>
		<li>If you or your spouse pass away, usually the most effective way to manage this is for the survivor to "take over" the deceased's IRA/401K balance.  The now larger balance will be subject to the survivors RMD requirements.  This might be better if the surviving spouse is younger, but could go the other way.</li>
		<li>As your IRA/401K grows, your RMDs will also grow. At some point this causes 85% of your social security to become taxable, AND causes IRMAA taxes, AND possibly NIIT.</li>
		<li>IRA/401K withdrawals are taxable income in MOST states. ROTH withdrawals are not taxable in any state.</li>
		</ol>	
	</div>	`  
} // drawerContent

