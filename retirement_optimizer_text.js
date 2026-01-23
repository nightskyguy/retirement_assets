const drawerContent = {
/////////////////////////////////////////////////////////////////////////////////	
howToUse: `  
	<div class="log-entry"><ul>
		<li><strong>1. Profile &amp; Ages:</strong> Enter the birth year of each person and estimated life expectancy for both partners. To model a single taxpayer, set the <I>Spouse Birth Year</I>, <i>Spouse  Life expectancy</i> and <i>Spouse IRA</i> to zero.</li>
		<li><strong>2. Assets:</strong> Enter balances. <i>Brokerage Basis</i> is used to calculate capital gains vs. principal. Brokerage withdrawals will be assumed to be part subject to capital gains. Total all after tax investment assets into <i>Brokerage</i>, and all cash-like holdings into <i>Cash</i>. Should one spouse predecease the other, all IRA assets are inherited by the remaining spouse. <i>For Roth</i>, sum the existing ROTH balances into one total.</li>
		<li><strong>3. Income (annual)</strong> Input annual Social Security and pensions. Set the start ages to see the impact of delaying benefits. Amounts you enter for <i>Social Security Amt</i> will be adjusted annually by the <i>CPI/COLA</i> (next options). <i>Survivorship</i> is the percentage of the pension that will continue to be paid after You pass away.</li>
		<li><strong>4. Assumptions:</strong> choose the Inflation rate, the CPI rate (which is the expected change in tax brackets rather than actual inflation), the <i>Growth</i> rate for the IRA/401K, Brokerage &amp; ROTH.  <i>Cash Interest</i> is the expected interest on cash and cash-like investments (e.g. Mutual Funds/Bonds). To make these numbers accurate, it's best to separate all investments into "Brokerage" and cash into Cash.</li>. <i>Social Security Fail</i> &amp; <i>SSecurity Net Payout</i>.
		<li><strong>Strategy:</strong> 
			Find this unlabeled item at the top left of the display.
			Set the <i>After-Tax Send</i> to the amount of after-tax income you need per year. And set the <i>Spend Delta</i> percentage. A Spend Delta of 0 means no change, while -1.5 would reduce spending by 1.5% each year. To have spending grow, use a number greater than 0, like 2%.  Default is -1% per <A HREF="https://retirementresearcher.com/retirement-spending-smile"> historical data</A>.
			<ul><li>In <em>Withdraw Proportionally</em> it proportionately withdraws enough from all available sources to reach <i>After-tax Spending Goal</i>. Its a good baseline to compare with other strategies.</li>
			<li>Compare with <em>Reduce IRA in N Years</em> to amortize your IRAs in a fixed number of years (they won't be emptied, they will be drawn down to <i>IRA  Goal</i>.</li>
			<li><i>Fill Federal Tax Bracket</i> withdraws enough to max out the chosen federal tax bracket. NOTE: If your spend goal is in a bracket higher than you select, it will try to meet the spend goal instead of locking to the bracket.</li>
			<li><i>Lesser of IRMAA or TaxBracket</i> is not yet implemented, but here it's like <i>Fill Federal Tax Bracket</i>, but reduces the amount withdrawn to stay under the the lesser of the (next) IRMAA tier, the next state or next federal bracket - which ever is lower. It applies an inflation adjusted "safety threshold" of 2,000. There are three gotcha's here: a. the <i>After-Tax Spend</i> goal is in play so it may blow right past the next tier if you have insufficient non-taxable income, b. the current year IRMAA tax is based on income from two years ago - so this setting attempts to avoid FUTURE tax - not tax in this year, c. the current year filing status is what is used to avoid hitting a higher tier. Here is why that matters: If you or your spouse pass away, the careful work avoiding a higher tier two years ago will still <i>hurt </i> in the current year. For example if the MAGI is one dollar below the first tier while married, two years from now when filing status is Single, that MAGI falls into the 4th IRMAA tier - the only upside here, is that there is now half as much of the IRMAA tax since it is per-person. One solution is to remarry. :-) </li></ul>
		<li><strong>After Changes...</strong> selecting the Annual Details, Chart or Optimizer will cause a recalculation and show the page. On the <i>Annual Details</i> table, rows are highlighted in yellow if status changes to single. A pink/red backgrounds means there are not enough funds to meet two years of SpendGoal.
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
	`	  
} // drawerContent

