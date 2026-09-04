# Git hooks

Version-controlled hooks for this repo. Run once per clone:

```sh
sh .githooks/install
```

That is the whole setup. It covers the main checkout and every worktree, including worktrees
created later.

## What the pre-commit hook does

Runs the three `node`-only suites and blocks the commit if any of them fails:

| suite | tests | approx |
|---|---|---|
| `optimizer_core.tests.js` | 419 | 2.9 s |
| `taxPaymentPlanner.tests.js` | 61 | 0.5 s |
| `doclinks.tests.js` | 22 | 0.1 s |

About 3.5 s total.

**These counts are documentation, and they rot.** The enforced copy is `TestTiers.EXPECTED` in
`optimizer_tests.js`, which pins all three suites at once plus the slow-tagged subset of
`optimizer_core`. Adding or removing a test anywhere means updating **every** number in that object
and then this table, in the same commit - including the suites belonging to tools you did not touch.
`taxPaymentPlanner.tests.js` covers `RetirementTaxPlanner.html`, and leaving its count stale turns
the **Optimizer's** self-check badge red. Measure with `node <suite>`; never guess.

It also blocks in two cases that would otherwise pass in silence:

- **A suite is missing.** A renamed or deleted suite would look identical to a green run.
- **A suite exists but is not listed.** Every `*.tests.js` file in the repo root must appear in the
  `suites=` line; a new suite committed without being added there would simply never run. The check
  reports the on-disk set against the listed set and names the difference.

**The glob is `*.tests.js` and must never be widened to `*test*`.** `optimizer_tests.js` is the
browser-only release gate: it declares `runTests()` without ever calling it, so
`node optimizer_tests.js` exits 0 having run nothing, and this hook reports success for anything
that exits 0. Sweeping it in would print a permanent green for zero tests run, on the one file
publishing is checked against. `_tests.js` does not match `*.tests.js`, which is what keeps the two
sets disjoint - and is the reason that suffix was chosen.

## The markdown preview gate

After the suites, the hook runs `node .githooks/md-html-scan.js` over **every tracked `.md`**, and
blocks on raw HTML that hides the rest of the file.

On 2026-08-28 the VS Code preview of `task_plan.md` stopped rendering at line 1304 of 5,734. Not
truncation and not a setting: that line held a bare, unquoted `<select>` in prose. VS Code's preview
passes raw HTML through **without sanitizing**, so the browser parsed it as a real element, and a
`<select>` paints nothing except `<option>` children. Never being closed, all 4,430 following lines
became its children and were silently not painted. `progress.md` had the same class of defect at
line 3695 via a bare `<details>`, hiding about 1,944 lines - an unclosed `<details>` is **closed**
by default, so everything after it collapses inside it.

Both survived for weeks because **GitHub sanitizes markdown HTML** and drops non-allowlisted tags,
so the files rendered perfectly everywhere they were normally reviewed. There is no error, no
artifact at the break point, and no clue in the source - the document just appears to end early,
which reads as file corruption or an editor limit rather than a typo.

**A blanket "no raw HTML" rule was measured and rejected.** The 27 tracked `.md` files hold 181 bare
tags and 172 are legitimate `<a>` anchors in the changelog. `<a>`, `<b>`, `<span>`, `<li>`,
`<details>`, `<img>`, `<br>` and `<kbd>` all render their children normally and are none of the
gate's business, closed or not.

Two rules, because there are two failure modes and the second was missed at first.

**Rule A, hides.** The eleven elements that actually make following content vanish: `select`,
`textarea`, `title`, `style`, `script`, `noscript`, `iframe`, `template`, `details`, `object`,
`dialog`. Blocked on sight, closed or not - even a properly paired `<select>...</select>` paints
nothing but its options.

**Rule B, corrupts.** Any element whose open and close counts differ within a file. An unclosed
`<b>` bolds the rest of the document, an unclosed `<a>` makes the remainder one hyperlink, an
unclosed `<li>` emits a stray bullet and pulls what follows into a list item.

Rule B exists because rule A could not have caught the real case that produced it: two unclosed
`<b>` at `progress.md:4447-4448` left every following line bold. Nothing was hidden, so the
measurement behind rule A - "did the text disappear from `innerText`" - returned clean. A reader
found it. **The check was asking one question about a problem that has two.**

Balance, not presence, is what makes rule B usable: the 172 `<a>` anchors in
`optimizer_changelog.md` are all correctly paired, so genuine markup passes untouched and only
unclosed markup fails. Void elements (`<br>`, `<img>`, `<hr>`, ...) and self-closing tags are exempt,
since they never take a closing tag.

**That list is measured, not reasoned, because reasoning it produced a wrong list.** The first
version was written from the HTML spec and was wrong in both directions - it blocked `option`,
`optgroup`, `xmp`, `plaintext` and `listing`, none of which hide anything, and it missed `details`,
`object` and `dialog`, all of which do. A bare `<details>` was live in `progress.md` at the time, so
the gate shipped with a false negative already in the tree. Guessing content models is precisely the
mistake this check exists to catch someone else making.

The list was re-derived by rendering all 57 candidate elements in a browser and recording which ones
made following content vanish. The re-derivation snippet is in the header of `md-html-scan.js`; run
it rather than editing the set by hand. `<option>`, `<optgroup>`, `<table>`, `<tr>`, `<li>`, `<b>`,
`<span>`, `<a>`, `<summary>` and `<pre>` are all safe and are deliberately left alone.

It is a denylist rather than a parser because deciding "unclosed" properly needs a real HTML parse,
while naming the elements that can swallow a document needs none.

Fenced blocks and inline code spans are skipped. Indented four-space code blocks are **not**
detected, deliberately - telling one from a wrapped list item needs a real markdown parse. A tag
inside an indented block is therefore reported; fence it instead, which is clearer anyway and is
what `p71_probe/README.md` was converted to.

**The fix is always the same: wrap it in backticks.** `` `<select>` `` renders the tag visibly
instead of executing it, and matches the convention every other code identifier in these docs
already follows. Run it standalone on specific files while editing:

```sh
node .githooks/md-html-scan.js .planning/retirement-optimizer/task_plan.md
```

`git commit --no-verify` skips it. That is the deliberate escape hatch for a commit you know does
not touch code. It is not the way past a red suite.

## Why this exists

Release gating relies on the Red X badge that `optimizer_tests.js` renders at page load. That badge
used to cover only the 245 in-page tests, so a change breaking one of the 268 node tests was
invisible at the moment of release. Both now cover the same 513 tests.

They are still worth having separately, and the hook came first on purpose:

- The **hook** catches breakage when it would enter history, on every commit, whether or not anyone
  opens a browser. It is the guarantee.
- The **badge** catches it at the moment of release, and reports the counts. It is the convenience,
  and it only helps when someone is looking at it.

The hook also covers what the badge cannot: on a `file://` URL the browser blocks the node suites
from loading at all, and the badge honestly reports `🟢⚠` rather than a full green.

## Why a shim, and not `git config core.hooksPath .githooks`

That is the usual advice and it does not work here.

`core.hooksPath` is already set to an **absolute** path in `.git/config`, and
`extensions.worktreeConfig` is enabled, so every worktree carries the same absolute pin in its own
`config.worktree` - which **outranks** the repo-level config. Setting a relative `core.hooksPath`
would be silently ignored inside every worktree, which is where most work on this repo happens.

A hook that silently does not run is worse than no hook, so `install` instead writes a one-line
shim at the already-pinned location. The shim resolves the top of whichever working tree is
committing and execs that tree's `.githooks/pre-commit`, so the logic stays version-controlled and
reviewable while the wiring stays where git is already looking.

On a working tree that predates this directory (an old branch, say), the shim prints a notice and
exits 0 rather than blocking commits on history.

## Line endings

`.gitattributes` pins `.githooks/**` to `eol=lf`. `core.autocrlf` is true on Windows here, and `sh`
cannot execute a script whose shebang ends in CR. Without that pin a fresh clone would break
committing.
