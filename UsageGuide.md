# Income Tax Planner: URL guide

Every setting on the [Income Tax Planner](standalone/IncomeTaxPlanner.html) can be set from the
page address, so a link can open the tool already filled in. That lets a spreadsheet build the link
from its own cells and give you a clickable way to see the same figures charted, and it lets a link
ask for a single result as a line of comma-separated numbers.

The planner is at `https://tools.netcitizen.us/standalone/IncomeTaxPlanner.html`. Everything after a
`?` is the parameter list, written `name=value` and joined by `&`:

```
https://tools.netcitizen.us/standalone/IncomeTaxPlanner.html?st=SGL&s=TX&yr=2026&wg=60000&ss=24000
```

Leave out any parameter you do not need and the page uses its default. The **Share** button on the
page writes a link like this for whatever is on screen, so the quickest way to learn the names is to
set the page up by hand, press Share, and read the address.

## Parameters

Amounts are plain numbers in dollars a year, with no `$` and no commas (`60000`, not `$60,000`).
Rates and percentages are plain numbers too (`2.5` means 2.5%).

### The household

| Name | Meaning | Values and default |
|---|---|---|
| `st` | Filing status | `MFJ` (married filing jointly, the default) or `SGL` (single) |
| `s` | State | Two-letter code in any case, default `CA`. See [state codes](#state-codes). A code the page does not have is reported as an error and never replaced by a default state. |
| `a1`, `a2` | Ages of the two taxpayers | Whole years, default 65 and 65. `a2` is ignored for `SGL`. An age of 65 or more brings the larger standard deduction and the OBBBA senior deduction. |
| `yr` | Tax year to show | 2026 to 2035, default 2026. Brackets and thresholds are inflated from 2026. |
| `in` | Annual bracket inflation, in percent | 0.5 to 6 in steps of 0.5, default 2.5 |

### Income that stays fixed while the chart sweeps ordinary income

| Name | Meaning | Values and default |
|---|---|---|
| `ss` | Total Social Security for everyone on the return | 0 or more, default 0. One combined figure: how much is taxable depends on all your income together. |
| `cs` | Proceeds of a sale that produces a capital gain | 0 or more, default 0 |
| `cb` | Cost basis, as a percent of the proceeds | 0 to 100, default 60. The long-term gain is `cs` times (100 minus `cb`) divided by 100. |
| `qd` | Qualified dividends | 0 or more. Taxed with the capital gain. |

### Income details (ordinary income and deductions)

These are the entries in the **Income details** section of the page. A link that names any of them
opens that section, even when the value is 0. The section is otherwise folded.

| Name | Meaning | Negative allowed? |
|---|---|---|
| `wg` | Wages, 1099 or business income | Yes. A loss offsets your other income, and taxable income does not go below zero. |
| `it` | Interest | No |
| `nd` | Non-qualified dividends | No |
| `sg` | Short-term capital gains | Yes. A loss is netted against the long-term gain first. A net capital loss offsets only $3,000 of income a year, and the rest is ignored as a carryforward. |
| `ri` | IRA, 401k or pension withdrawals | No |
| `rw` | Set to `1` to treat income swept above what you entered as IRA or 401k money | Only matters in states that exempt retirement income |
| `ot` | Other ordinary income | Yes |
| `pt` | Property and local taxes, for the SALT deduction | No. Enter real estate and local taxes only: state income tax is computed for you. |

`wg`, `it`, `nd`, `sg`, `ri` and `ot` add up to the **ordinary income entered**. The chart marks it
with a teal dotted line, and it is the income a `return` link calculates at when there is no `pi`.

### Medicare

| Name | Meaning | Values and default |
|---|---|---|
| `pm` | Your MAGI from two years before `yr` | 0 or more, optional. Medicare charges this year's IRMAA from that figure. Enter it and this year's taxes include the charge. Leave it out and they include none. |

### What the chart shows

| Name | Meaning | Values and default |
|---|---|---|
| `pi` | Ordinary income to pin, which fills the details panel and is the income a `return` link calculates at | Any number, negative allowed (a net loss). Default: not pinned. |
| `vl`, `vh` | The visible range, as **total** income (the top axis) | Low and high, in dollars, from -300000 up. Default 30000 to 620000. Omit both for the default view. |
| `az` | Set to `0` to turn AutoZoom off | AutoZoom is on by default |

### Asking for a result

| Name | Meaning |
|---|---|
| `return` (or `result`) | Show the result as a line of comma-separated numbers, and copy it to the clipboard. See [Getting a result](#getting-a-result-with-return). |
| `header` | With `return`, set to `1` to put the field names on a first line |

### Old parameters

Links made by earlier versions still work. `zl`, `zh` and `zs` (the old ordinary-income view range) are
converted to `vl` and `vh`. `me`, `ob` and `sh` no longer do anything and are ignored.

## State codes

`AL` Alabama, `AK` Alaska, `AZ` Arizona, `CA` California, `CO` Colorado, `CT` Connecticut,
`DC` District of Columbia, `FL` Florida, `GA` Georgia, `ID` Idaho, `IL` Illinois, `IN` Indiana,
`IA` Iowa, `KY` Kentucky, `ME` Maine, `MD` Maryland, `MA` Massachusetts, `MI` Michigan,
`MN` Minnesota, `MS` Mississippi, `MT` Montana, `NE` Nebraska, `NV` Nevada, `NH` New Hampshire,
`NY` New York, `NC` North Carolina, `ND` North Dakota, `OH` Ohio, `OR` Oregon, `PA` Pennsylvania,
`SC` South Carolina, `SD` South Dakota, `TN` Tennessee, `TX` Texas, `VA` Virginia, `WA` Washington,
`WI` Wisconsin, `WY` Wyoming.

The page's State list is the authority. It grows whenever a state is added to the shared tax tables,
and this list can lag behind it.

## Examples

A single filer in Texas with $60,000 of wages and $24,000 of Social Security:

```
?st=SGL&s=TX&yr=2026&wg=60000&ss=24000
```

A couple in California with a $200,000 gain, a $30,000 IRA withdrawal and a $9,000 property tax bill,
looking at 2028 with their MAGI from 2026 entered:

```
?st=MFJ&s=CA&yr=2028&cs=200000&cb=0&ri=30000&pt=9000&pm=150000
```

A business loss, with the view starting at a total income of $0:

```
?st=SGL&s=CA&wg=-40000&ss=24000&cs=60000&cb=0&vl=0&vh=300000
```

## Building links in a spreadsheet

Build the address with `&` to join text and cells, and put it in `HYPERLINK`. This works the same in
Excel and in Google Sheets. With the filing status in B2, the state in B3, the year in B4, Social
Security in B5, wages in B6 and interest in B7:

```
=HYPERLINK("https://tools.netcitizen.us/standalone/IncomeTaxPlanner.html?st="&B2&"&s="&B3&"&yr="&B4&"&ss="&B5&"&wg="&B6&"&it="&B7, "Open in planner")
```

Tips:

- **Skip zeros.** A parameter you leave out takes its default, so a short link is easier to read and
  stays under the length limit. Join each optional piece with `IF`, for example
  `IF(B6=0,"","&wg="&B6)`.
- **Plain numbers.** Send the cell's value, not its formatted text. If a cell shows `$60,000`, the
  link needs `60000`, so refer to the cell directly and do not use `TEXT()` on it.
- **Length.** Excel can limit the address inside `HYPERLINK` to 255 characters in some versions, and
  browsers have limits of their own. If a link stops working, drop the zero amounts.
- **Text values.** The state and filing status are letters only, so they need no encoding.

## Getting a result with `return`

Add `return` (or `result`, which means the same) and the page calculates at one ordinary income and
shows the answer in a box at the top of the page, with a **Copy** button. It also copies the answer to
the clipboard by itself, as if you had pressed Copy. Many browsers refuse a copy that no click asked
for, and the box then says "Not copied: press Copy", so do not rely on the clipboard being filled.

```
?st=SGL&s=CA&a1=65&yr=2026&wg=60000&it=2000&ri=30000&ss=24000&return&header=1
```

```
ordinary,totalIncome,agi,magi,fedTax,stateTax,irmaa,irmaaFuture,totalTax,effRate,fedMarginal,stateMarginal
92000,116000,112400,112400,14620.68,4554.29,0,0,19174.97,0.165301,0.2332,0.093
```

The same result is on the page without a link: under the details panel at the bottom of the chart, the
**Result for a spreadsheet** row has two buttons that copy it for the pinned income. **Copy** puts the
default fields on the clipboard with their names on a first line. **Copy all fields** adds every other result and the inputs
the result was calculated from. Both carry names because the set of fields may change over time, and a
bare line of numbers would not say which is which.

**Which income it calculates at.** The pinned `pi` if the link has one, otherwise the ordinary income
entered under Income details (`wg` + `it` + `nd` + `sg` + `ri` + `ot`). In the example that is
60000 + 2000 + 30000 = 92000. Use `pi` to calculate at a different ordinary income than the one
entered.

**Which fields.** `return` by itself (or `return=1`) gives the default set shown above. `return=all`
gives every result field and then every input it was calculated from. A comma list picks exactly the
ones you want, in the order you give, and can mix results with inputs:

```
?st=SGL&s=CA&wg=60000&return=fedTax,stateTax,totalTax
```

A name the page does not know produces `ERROR: unknown field` and the name, so a typo cannot pass for
a result. `header=1` puts the field names on a first line.

Dollar amounts are for the whole year, in the dollars of `yr`, rounded to cents. Rates are fractions
(`0.2332` is 23.32%), rounded to six places.

| Field | Meaning |
|---|---|
| `ordinary` | The ordinary income calculated at |
| `totalIncome` | Ordinary income plus all Social Security plus capital gains and qualified dividends |
| `agi` | Adjusted gross income |
| `magi` | Modified AGI, which sets IRMAA |
| `taxableSS` | The part of Social Security that is taxable |
| `deduction` | The federal deduction used, including any senior deduction |
| `seniorDeduction` | The OBBBA senior deduction inside it |
| `stateDeduction` | The state deduction used |
| `itemized` | 1 if itemizing beat the standard deduction, otherwise 0 |
| `fedOrdinaryTax` | Federal tax on ordinary income |
| `fedCgTax` | Federal tax on capital gains and qualified dividends |
| `niit` | The 3.8% net investment income tax |
| `fedTax` | Federal total: ordinary, capital gains and NIIT |
| `stateTax` | State income tax |
| `incomeTax` | Federal plus state |
| `irmaa` | The IRMAA you owe this year, from `pm` (0 when `pm` is not given) |
| `irmaaTier` | Its tier, 0 to 5 |
| `totalTax` | Federal, state and this year's IRMAA |
| `netIncome` | Total income minus `totalTax` |
| `effRate` | Income taxes divided by total income. It leaves IRMAA out. |
| `allInRate` | `totalTax` divided by total income, IRMAA included |
| `fedMarginal` | Federal marginal rate on ordinary income, measured over a $1,000 step |
| `stateMarginal` | State marginal rate |
| `cgRate` | Federal capital-gains rate, including NIIT when it applies |
| `irmaaFuture` | The IRMAA this income will cause two years from `yr` |
| `irmaaFutureTier` | Its tier, 0 to 5 |

**Input fields.** `return=all`, and any comma list, can also name the inputs, spelled as in the link:
`st`, `s`, `a1`, `a2`, `yr`, `in`, `ss`, `cs`, `cb`, `pm`, `wg`, `it`, `nd`, `sg`, `ri`, `ot`, `qd`, `pt`
and `rw`. `st` and `s` come back as text (`SGL`, `TX`). `a2` is blank for a single filer and `pm` is
blank when it was not entered. A result can then say what it was a result of.

### What a spreadsheet can do with it

You open the link, copy the line, paste it into a cell, and split it into columns (**Data, Text to
Columns** in Excel; **Data, Split text to columns** in Google Sheets). That works today.

What does not work is a formula that fetches the answer by itself, such as Excel's `WEBSERVICE()` or
Google Sheets' `IMPORTDATA()`. Those functions read whatever text a web server sends back. This site
is a set of plain pages with no server behind them, and the planner calculates in your browser after
the page loads, which `WEBSERVICE()` does not do: it would receive the page's source code and not
the result. A formula-driven result needs a small hosted calculation service that takes the
parameters above and answers with the comma-separated line. That has not been built, and it would
mean your figures travel to that service, which the planner does not do today.

For scripts that drive a real browser, the page exposes `window.taxResult()`, which returns
`{ fields, values, csv }` for the current inputs.

## Before you share a link

The README explains the risk in full: [Putting Numbers in a Link: Privacy](https://tools.netcitizen.us/#putting-numbers-in-a-link-privacy). In short, a link with parameters is personal financial information.

The calculation runs in your browser. A link carries your figures in plain text, so they are in your
browser history and in anything you paste the link into, including the spreadsheet and any email or
chat.

The page tells Google Analytics only its own address and the state, not the rest of the query, and it
sends other sites only the site's address as the referrer. The Cloudflare page counter reads the full
address and cannot be given a shorter one, so the page does not load it when the address carries
anything besides the state. If you do not want amounts in an address at all, type them into the page
instead.
