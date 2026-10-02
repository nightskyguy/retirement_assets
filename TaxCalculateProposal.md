# Proposal: letting a spreadsheet use the tax calculator

**Status:** a proposal, nothing here is built except what is marked "exists today". Written
2026-10-02 after the `return` link and the Result row shipped in the Income Tax Planner.

## The goal

A spreadsheet that already holds a household's figures should be able to ask the tax calculator for
the tax on them, and get the answer back in cells, without the person copying anything. Two forms of
that were asked for:

1. A **clickable link** built from spreadsheet cells that opens the planner already filled in.
2. A **formula** (the spreadsheet's own web-fetch function) that returns the result as comma-separated
   text, so the sheet can do tax calculations with it.

The first exists. The second is the subject of this document.

## What exists today

- Every planner setting can be set from the page address. [UsageGuide](https://tools.netcitizen.us/UsageGuide.html) lists them.
- A link with `return` shows one result as a comma-separated line, at the ordinary income pinned by
  `pi` or entered under Income details. `return=all` adds every result field and the inputs.
- The **Result for a spreadsheet** row under the charts copies the same line, with field names.
- `window.taxResult()` returns the same thing to a script driving a real browser.
- The page tells Google Analytics only its own address and the state, and loads the Cloudflare page
  counter only when the address carries nothing but the state.

What a person does today: click the link, press Copy, paste into a cell, split on commas. Every step
after the click is manual.

## Why a formula cannot fetch it today

Excel's `WEBSERVICE()` and Google Sheets' `IMPORTDATA()` ask a web server for a page and place the
text they receive in cells. They do not run a page's JavaScript. The planner's result is calculated by
JavaScript after the page loads, and the site is a set of static files on GitHub Pages with no server
that could calculate anything. So a formula pointed at the planner receives the page's source code.

Something must produce the text on the server side, or the calculation must run inside the
spreadsheet. The options below are the ways to do one or the other.

## Options

### A. Plain-text view in the browser (no server)

With `return`, the page would draw nothing except the result text, and `view=1` would open the full
tool.

- **Gets you:** a clean answer for a person who opens the link. Nothing for a formula.
- **Cost:** small, about half an hour.
- **Privacy:** unchanged from today.
- **Verdict:** a convenience only. Worth doing if people open `return` links by hand.

### B. A Cloudflare Worker in front of the site (recommended for formulas)

A Worker sits in front of `tools.netcitizen.us`. A request with `return` is answered by the Worker
itself with `text/plain`: it runs the same tax engine file and sends back the comma-separated line.
Every other request passes straight through to the normal page. The same link then opens the planner
in a browser and returns text to a formula.

- **Gets you:** real formula-driven results. In Google Sheets, `IMPORTDATA(url)` splits comma-separated
  text into cells by itself. In Excel for Windows, `WEBSERVICE(url)` returns one string, and
  `TEXTSPLIT` (Microsoft 365) or a few `MID`/`FIND` formulas split it. Excel for the web and for Mac
  do not have `WEBSERVICE`.
- **Already in place:** the domain is in your Cloudflare account and a Worker already serves
  `feedback.netcitizen.us`, so the tooling and habits exist.
- **To check first:** the `tools` DNS record must be **proxied** (orange cloud) for a Worker route to
  apply to it. A record set to "DNS only" bypasses Cloudflare. If it is DNS only, the alternative is a
  separate hostname such as `calc.netcitizen.us` pointing at the Worker, and formulas use that address
  while people keep using the page address.
- **Work:**
  1. Move the planner's calculation out of the page into a shared file that both the page and the
     Worker load. Today it lives inside `standalone/IncomeTaxPlanner.html`: the settings table, netting
     of capital losses into the pieces the engine takes, the IRMAA index factors, the pinned-income
     result and the field list. `taxengine.js` and `medicare_costs.js` already run unchanged in node.
  2. Write the Worker: parse the query with the same field table, answer `text/plain`, send errors as
     `ERROR: ...` with an HTTP 400 so a formula shows the reason.
  3. Node tests for the shared file, joining the existing suites, plus a test that the page and the
     Worker give the same line for a set of cases.
  4. Deployment and a route, which only you can do.
- **Cost:** about the size of the Income details work, plus the deploy.
- **Output contract to settle before building:** the field names and order in `UsageGuide.md` become an
  interface other people's sheets depend on. Add fields at the end, never rename, and consider a
  `v=1` parameter so a later format change does not silently change old sheets.
- **Abuse and limits:** the calculation is cheap. Cloudflare's free tier allows a large number of Worker
  requests a day. A per-address rate limit is optional but worth a line of configuration.

### C. Google Sheets custom function (no link, no web call)

An Apps Script function, for example `=TAXCALC("SGL","TX",2026,60000,24000)`, that contains the tax
engine and calculates inside the sheet.

- **Gets you:** fast, formula-native results in Sheets only, with no per-cell web requests.
- **Work:** bundle `taxengine.js` and the shared calculation file into the script project, and add a
  small wrapper that maps cell arguments to the field table. The shared file from option B is what
  makes this cheap.
- **Caveats:** the script must be copied or published as an add-on for each user, and it carries its
  own copy of the tax tables, which then need updating by hand each year. Custom functions can also
  call a web address with `UrlFetchApp`, so a Sheets function could instead call option B. (Both facts
  are from memory of the Apps Script documentation and should be checked before building.)

### D. Excel add-in with JavaScript custom functions

Office Add-ins can define custom worksheet functions in JavaScript, which would run the engine inside
Excel on Windows, Mac and the web, with no server.

- **Work:** a manifest, hosting for the add-in files, and each user installing it. The heaviest option.
- **Caveat:** the same copy-of-the-tables maintenance problem as option C.
- **Verdict:** worth considering only if Excel is the main tool and option B is rejected.

### E. Smaller alternatives

- **Excel Office Scripts** can run TypeScript against a workbook, but only in some Microsoft 365 plans
  and not as a cell function. It would be a button-driven recalculation.
- **Rebuilding the tax in spreadsheet formulas** (`LAMBDA`) is possible for a simplified federal
  calculation and is not realistic for this tool's full logic: state tables, the Social Security
  taxability tiers, capital-gains stacking, IRMAA and the SALT cap.
- **A command-line tool** (`node taxcalc.js "st=SGL&..."`) over the shared file would help anyone who
  scripts their finances, and costs almost nothing once the shared file exists. A spreadsheet cannot
  call it directly.

## Comparison

| Option | Formula returns a result? | Excel | Sheets | Server needed | Work | Figures leave the browser? |
|---|---|---|---|---|---|---|
| A. Text-only view | No | no | no | no | small | no |
| B. Cloudflare Worker | Yes | Windows `WEBSERVICE` | `IMPORTDATA` | yes (yours) | medium | yes, to your Worker |
| C. Apps Script function | Yes | no | yes | no | medium | stays in the Google account |
| D. Excel add-in | Yes | yes | no | hosting only | high | no |
| E. Office Scripts, formulas, CLI | partly | partly | no | no | varies | no |

## Privacy

The planner calculates in the browser today and never sends a figure to a server of yours. Option B
changes that: the figures travel in the address to a Worker.

- Google's `IMPORTDATA` fetches from Google's own servers, so Google sees the address and so the
  figures. An Excel `WEBSERVICE` call is made from the user's machine.
- A Worker's request logs and Cloudflare's analytics can see addresses unless they are turned off.
  The Worker should log nothing about the query.
- The Worker itself would not store anything. It computes and answers.
- The page already tells Google Analytics only the state, and does not load the Cloudflare page counter
  when the address carries figures. The same restraint should apply to the Worker route.

Anyone who does not want figures in an address at all can keep using the page and type them in.

## Protecting the figures in a link

Whenever figures are parameters of a link, they can leak. This applies to the page as it is today, with
no Worker at all. Where they can go, and what would stop each:

| Where the figures can end up | Stopped by moving them into the `#` fragment? | Stopped by encrypting them? |
|---|---|---|
| The web host and the network in front of it (access logs) | Yes. The fragment is never sent in the request. | Yes, they would see only ciphertext |
| Analytics scripts that read the page address | Only if the script is told to drop it, which the planner now does | Yes, ciphertext only |
| The `Referer` header sent to other sites | Yes, and a `strict-origin` referrer policy (set on the planner) covers the query too | Yes |
| Browser history, bookmarks and sync | No | Only if the key is not in the link |
| Wherever the link is pasted (email, chat, forum, a sheet) | No | Only if the key is not in the link |
| A Worker's logs, if a Worker is built | No, a fragment never reaches the Worker either | Yes, if only the Worker can decrypt |

Cloudflare's dashboard not showing parameters is encouraging, but it does not show what the page counter
transmitted, and it says nothing about the request logs of the host. The planner now avoids the
question: it does not load that counter when the address carries figures.

### Option F: figures in the `#` fragment instead of the `?` query

A page can read its settings from `location.hash` exactly as it reads `location.search`. Everything
after the `#` stays in the browser: it is not part of the request, so it cannot appear in the host's or
Cloudflare's logs, in the `Referer` header, or in any analytics that does not read it.

- **Work:** small. Read both places, and have Share and the guide offer the `#` form. The spreadsheet
  link changes from `...html?st=SGL&...` to `...html#st=SGL&...` and `HYPERLINK` does not care.
- **Limits:** it does nothing for browser history or for wherever the link is pasted. It cannot be used
  with a Worker, because a Worker never receives the fragment, so it is an alternative to option B for
  the link-opening case, not a way to protect B.
- **Verdict:** the cheapest real reduction in exposure, and worth doing before any Worker.

### Option G: encrypting the parameters

Is there a clean way to do this with open source code? In a browser, yes. In a spreadsheet, no.

- **In the browser.** The Web Crypto API is built into every current browser, needs no library, and does
  AES-GCM and RSA-OAEP. Small open source libraries (libsodium.js, TweetNaCl, jsrsasign) cover the
  rest. A page could decrypt `?e=<ciphertext>` after asking for a passphrase, or an `#e=` fragment
  with the key kept somewhere else.
- **In the spreadsheet.** Neither Excel nor Google Sheets has an encryption function. Google Apps Script
  has hashing and HMAC but no AES, so it would need a pasted-in library. Excel would need VBA calling
  Windows crypto routines or an add-in. So the sheet cannot build an encrypted link without extra
  code that every user must install, which defeats the purpose of a link a formula builds.
- **What it would and would not protect.**
  - If the key travels in the same link, the link is as readable as before to anyone holding it. If it
    travels separately, the person opening the link needs it, which is friction nobody will accept for a
    calculator. A key kept in a fragment protects only against the server channels, which the fragment
    alone already protects against.
  - Against the server and log channels, encryption helps only if the server never holds the key.
    A Worker that decrypts must hold the private key, which protects the figures from the host's logs
    and analytics but not from the Worker's owner.
  - TLS already encrypts the figures on the wire. The real exposures are logs, history, referrers and
    pasted text, and encryption does not reach the last two unless the key is kept apart.
- **Verdict:** possible in a browser, not clean in a spreadsheet, and it solves less than the fragment.
  Not recommended. If a formula must send figures to a Worker, a POST body is better than any
  encryption scheme: it is not part of the address, so it is not in history, referrers or the usual
  access logs. Apps Script's `UrlFetchApp` can POST. `WEBSERVICE` and `IMPORTDATA` can only GET.

### What would reduce the exposure, in order

1. Keep figures out of what servers and analytics see: fragment parameters (F), the analytics changes
   already made, and a `strict-origin` referrer policy on every tool that reads parameters.
2. Do the calculation on the user's side, with no transmission at all: options C and D.
3. Only if a formula must reach a Worker: a POST from a script (C with `UrlFetchApp`) in preference to
   a GET from `WEBSERVICE` or `IMPORTDATA`.
4. Say plainly, in the README and the guide, that a link with parameters is personal financial
   information. The README now does, and the guide should point to it.

## Recommendation

1. Do the **shared calculation file** first. It is the prerequisite for B, C, D and a command-line tool,
   and it also removes the risk of the page and any Worker disagreeing.
2. Build **B**, the Worker, if formula-driven results are wanted, after checking that the `tools` DNS
   record is proxied.
3. Do **A** whenever convenient. It is independent of the rest.
4. Treat **C** and **D** as follow-ons for whichever spreadsheet people actually use.
5. Consider **F**, fragment parameters, before B: it is small, and it removes the figures from the host's
   logs for every user who opens a link, not only for spreadsheet users.

## Decisions needed

- Is a formula-driven result worth sending figures to a Worker you run?
- Is the `tools` hostname proxied by Cloudflare, or should formulas use a separate `calc` hostname?
- Which spreadsheet matters most: Excel (and which version, since `WEBSERVICE` is Windows only) or
  Google Sheets?
- Should the output format carry a version, so the field list can grow without breaking old sheets?
- Should the tools read parameters from the `#` fragment as well as the `?` query, and should Share
  write the `#` form by default?
