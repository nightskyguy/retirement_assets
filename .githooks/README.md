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
| `optimizer_core.test.js` | 214 | 2.9 s |
| `taxPaymentPlanner.test.js` | 32 | 0.4 s |
| `doclinks.test.js` | 22 | 0.1 s |

About 3.5 s total. It also blocks if a suite is **missing**, because a renamed or deleted suite
would otherwise pass in silence and look identical to a green run.

`git commit --no-verify` skips it. That is the deliberate escape hatch for a commit you know does
not touch code. It is not the way past a red suite.

## Why this exists

Release gating relies on the Red X badge that `optimizer_tests.js` renders at page load, and that
badge covers only the 245 in-page tests. The 268 tests above **never run in the browser at all**, so
a change that breaks one is invisible at the moment of release and can be published by accident.
The hook moves the check to the moment the breakage would enter history.

This is work item 1 of P39. The remaining items make the node suites visible in the browser too;
the hook is the guarantee, the badge is the convenience.

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
