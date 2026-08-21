# Folding the IRMAA forward-threshold work into PR #182 (SALT) — DONE

**Completed 2026-08-20.** PR #182 merged to `main` as `1a6932f`; this branch
(`worktrees/irmaa-threshold-inflation-9e0c0f`) was rebased onto it and now ships as **v11.15ca**.

Kept because the prediction was made *before* the merge and every part of it can now be checked
against what actually happened. The conflict map was measured from the two diffs, not guessed, and
it was right in every particular including the two files that turned out to need no work.

---

## The claim that mattered - held for the merge, but it was stated too strongly

The pre-merge prediction was "SALT and IRMAA cannot interact". The merge consequence was right and
every conflict was mechanical, but the claim itself needs narrowing, and the spot-check this file
demanded is exactly what caught it.

**What is structurally true.** `taxengine.js` builds `federalAGI` (~line 1384) *before*
`saltItemized = min(stateTax + propTax, saltCap)` (~1433), and `IRMAAMagi = federalAGI +
taxExemptInterest` (~1486). Property tax reaches the *deduction*, never AGI. And `propTaxFor()`
short-circuits: `if (base <= 0) return 0;  // the default, and a guaranteed no-op`.

**What is NOT true: "SALT cannot move MAGI".** It cannot move MAGI *directly*, but the engine is a
feedback loop - a lower tax bill changes what has to be withdrawn, and the withdrawal changes MAGI in
later years. Measured on an IRMAA Ceil Tier 1 plan, CA, 3% CPI, `propTax` 0 vs $25,000:

| year | dMAGI | dFedTax |
|---|---|---|
| 2026-2028 | **0** | -$1,176 / -$1,017 / -$852 |
| 2029 onward | grows to **$5,791** (3.74%) | +$25 and up |

While the elevated SALT cap is live the deduction lands with *zero* MAGI change, which is the
structural claim showing through cleanly. Afterwards the feedback loop opens and MAGI drifts.

**The IRMAA ceiling itself is genuinely immune**: `BracketTarget` was identical in every year, as it
must be - it is computed from the bracket ladder and `cpiRate` and never reads a tax figure. In this
fixture no charged tier flipped either, despite MAGI moving 3.74%. That is a **result, not a
guarantee**: a drift of that size landing near a tier boundary could flip one.

**Confirmed after the rebase, not assumed:** all three suites green with every IRMAA-side pinned
number unchanged - the P32 tripwire still 11 years / $26,868.52 / $1,100,390.35 - and both IRMAA
harnesses reproduced their pre-merge results files exactly, including the prediction scorecards
(3 of 5, then 5 of 5). Those hold because every fixture and harness leaves `propTax` at its 0
default, so the feedback loop above never opens in them.


## Prediction vs outcome

| file | predicted | actual |
|---|---|---|
| `optimizer_core.tests.js` | clean | **auto-merged** |
| `optimizer_ui.js` | clean | **auto-merged** |
| `optimizer_core.js` | 1 conflict @78 | 1, exactly there |
| `optimizer_tests.js` | 1, the count | 1 |
| `.githooks/README.md` | 1, the count | 1 |
| `optimizer_changelog.md` | 1, both prepend | 1 |
| `retirement_optimizer.html` | 4 | 4 |

## How each was resolved

1. **`optimizer_core.js` @78** — both branches insert immediately after `taxCreepFactor()`. Kept
   both: `propTaxFor()` then the IRMAA helper block. No shared symbol, no ordering requirement. Both
   sides had relied on the same trailing `}`, so each got its own.
2. **Test counts** — 272 (main, post-SALT) + 7 (this branch) = **279**, which is neither side's
   number. Set provisionally, then **measured**: `279 passed, 0 failed`. Written into both pinned
   homes, `TestTiers.EXPECTED` and the `.githooks/README.md` table.
3. **`optimizer_changelog.md`** — both entries kept, newest first: 11.15ca (IRMAA) above 11.15c9
   (SALT) above 11.15a2.
4. **`retirement_optimizer.html`** — four spots. The `<title>` took neither version: main had already
   shipped `11.15c9` in this same version-hour, so per the repo's collision rule the stamp
   incremented to **`11.15ca`**. The cache-bust block took the **union** — `taxengine.js` (SALT's
   alone), `optimizer_core.js`, `optimizer_ui.js` and `optimizer_tests.js` all to `1115ca` — plus the
   tier-2 loader's own `const V`, which is the token that historically rots. The changelog `<li>`
   kept both entries in version order.

## Two things worth carrying forward

- **`main` had already fixed the unclosed `<strong>`** in the 11.15a2 entry (`aa9742c`),
  byte-identically to the fix on this branch, so that hunk never surfaced as a conflict. The
  in-page guard added here (a `<ul>` may contain only `<li>` children) is the part that is new, and
  it is what stops the class of bug rather than the one instance.
- **`.gitattributes` pins `.githooks/** text eol=lf`** on purpose — `sh` cannot execute a hook whose
  shebang ends in CR. A blanket "restore CRLF to match the working tree" pass over resolved files is
  wrong there. Everything outside `.githooks/` is CRLF under `core.autocrlf=true`.

## Open IRMAA items, unaffected by the merge

Recorded in [.test_harnesses/IRMAA_CPI_RISK_RESULTS.md](../../.test_harnesses/IRMAA_CPI_RISK_RESULTS.md).

1. **Project the filing STATUS forward, not just CPI.** Every clean breach found across three rounds
   is income sized while married and billed after a death against single-filer thresholds roughly
   half as high. No safety margin can close a gap that wide. `die1`/`die2` are already inputs.
2. **The default margin is the weak setting.** `halfstep` ($1,000-$2,500) prevents 5 breaches of 92
   where a rate-shaped haircut prevents 18. Changing the default to `cpiminus1` moves every existing
   plan's numbers, so it is the maintainer's call.
