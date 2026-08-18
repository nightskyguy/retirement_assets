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
| `optimizer_core.tests.js` | 269 | 2.9 s |
| `taxPaymentPlanner.tests.js` | 58 | 0.5 s |
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
