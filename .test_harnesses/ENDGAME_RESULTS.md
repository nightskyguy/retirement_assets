# P35n results — the endgame tail bake-off (what Phased should draw post-IRA-target)

**Run:** 2026-08-10, engine at `5e1075e` + uncommitted P51b hook (with the P35n `{prop}`/`{seq}`
entry forms), suite 244/244. **Harness:** `node .test_harnesses/endgame_harness.js` — 108 cells,
27k sims, 11s. Scenarios START in the endgame state: couple 75/73, SS in payment, RMDs active,
IRA already at its target.

## Headline

**Cash → Roth → Brokerage (`seq-CRB`) wins 88 of 108 cells.** The P35 PR-5 spec — BALANCED fill
proportional over `[Brokerage, Cash, Roth]` — is the WORST candidate tested: median **−$222,745**
vs `seq-CRB`, and it wins exactly 1 cell. The winner is Roth-EARLY, not the Roth-late tail the
P51 oracle shape suggested; reconciliation below.

| arm | wins /108 | median Δ vs spec-prop |
|---|---|---|
| **seq-CRB** (Cash → Roth → Brokerage, IRA backstop) | **88** | **+$222,745** (max +$466k) |
| flip-k (CBR then Roth-first at year k) | 13 | +$131,970 |
| seq-CBR (Cash → Brokerage → Roth) | 4 | +$68,896 |
| ref (today's engine default: propwd-0 + [40,60]) | 2 | — |
| spec-prop (the PR-5 BALANCED spec) | 1 | 0 by definition |
| light oracle (per-year menu, ceiling) | — | +$275,836 |

`seq-CRB`'s dominance holds on EVERY axis slice: both death profiles (joint 48/54, widow 40/54),
both IRA levels, all three mixes, all three basis fractions, all three spend rates. The
conversions-ON sensitivity pass changed the winner in **0 of 36** cells (E-P5 RIGHT).

## Why Roth-early wins — and why this does NOT contradict P28

1. **Cash still drains first.** P28's settled result ("Roth loses when it displaces Cash")
   is not violated: `seq-CRB` spends Cash before anything. The contest is second position —
   Roth vs Brokerage — and P28's other half says exactly this: **Roth pays when it displaces a
   BROKERAGE draw** (the displaced draw would realize gains annually).
2. **§1014 makes held Brokerage nearly tax-free to heirs.** Post-v11.1499, unrealized gains die
   at death. So holding Brokerage costs only the dividend drag, while DRAWING it costs real
   LTCG+state tax today. Draw-cost dominates holding-cost → spend Roth, ride Brokerage to the
   step-up. The P51 oracle's whole-life "Roth tail" was the same logic constrained by mid-life
   IRA bracket management; the endgame has no IRA lever, so the logic applies from year 0.
3. Basis confirms the mechanism: `seq-CRB`'s edge is largest at basis 20% (34/36 wins) and
   thins at 80% (25/36, with flip-k/CBR picking up cells) — less embedded gain, less reason to
   avoid the Brokerage draw.

## Secondary findings

- **flip-k is just a worse CRB.** Best flips land at k/h 0.4–0.6 — the SCAN FLOOR (0.4 was the
  earliest fraction tried), i.e. the optimizer wants the Roth-first regime as early as allowed.
  E-P2's "late flip" framing was wrong for the right reason.
- **The light oracle adds only ~$26-29k median over the best static arm** — a fixed CRB
  sequence captures nearly all expressible tail value; per-year cleverness buys little here.
- **The IRA axis moves levels, not the verdict** (winner identical in 41/54 paired cells; the
  flips are CRB↔flip-k, both Roth-early). RMD income narrows margins but never rescues
  spec-prop.
- **ref (today's default tail) is not floor-safe**: it draws the IRA proportionally below
  target. Shown as the incumbent only.

## Predictions scored (E-P1..E-P5, registered in the harness header)

| id | prediction | verdict |
|---|---|---|
| E-P1 | seq-CBR beats spec-prop in >=70% | **RIGHT** (81/108, 75%) |
| E-P2 | flip pays at b20 with LATE k, inert at b80 | **WRONG** — flip pays at every basis and lands EARLY (0.4-0.6); it is imitating CRB |
| E-P3 | static Roth-early loses to seq-CBR mostly | **WRONG, decisively** — Roth-early WINS 100/108 |
| E-P4 | winner stable across IRA axis >=80% | **WRONG (barely)** — 76%, and the flips stay within the Roth-early family |
| E-P5 | conversions-on winner identity >=80% | **RIGHT** (36/36) |

## What this decides for P35 (`P35i` / PR 5)

**The BALANCED fill should be the sequence Cash → Roth → Brokerage (IRA as last-resort
backstop), not balance-proportional.** Evidence-backed replacement for the PR-5 line
"ordering `['Brokerage','Cash','Roth']` weighted by current balance". Caveats to carry into
the ship decision:
- Verdict is **wealth-maximizing at a shared heirs rate**. A `taxflex` user may still prefer
  holding Roth (CRB empties it) — the objectives disagree here by construction; surface, don't
  hide.
- Leans on §1014 at both deaths and NO SECURE 10-yr heir modeling (heirs netting Brokerage at
  face is the model's assumption); a future heir-tax model could narrow CRB's edge.
- One deterministic path, CA only, one household shape per death profile, dividendRate 2%,
  spend flat, aggregate basis.

## Coverage

108 cells: residual IRA {$0, $750k at-goal} x deaths {joint ~4 survivor yrs, widow ~16 survivor
yrs} x non-IRA mix {brokheavy 1.8M/0.6M/0.15M, balanced 1.2M/1.2M/0.15M, rothheavy
0.6M/1.8M/0.15M} x basis 20/50/80% x spend 4/6/8% of total ($102k–$264k/yr on totals
$2.55M–$3.3M). Conversions OFF primary + ON sensitivity (36 cells).

**Low-wealth check (x0.4 scale, totals ~$1.02M–$1.32M, 36 cells):** the verdict SPLITS —
seq-CRB 16, seq-CBR 15, ref 3, flip-k 2. Exactly the theorized boundary: at ~$1M the 0% LTCG
bracket swallows the Brokerage draw, drawing Brokerage is nearly free, and Roth-early's edge
evaporates into a tie. **spec-prop wins zero cells even here.** So the robust statement:
sequenced beats proportional at every wealth level; WHICH sequence (Roth-early vs
Brokerage-early) matters only above roughly $2M of endgame assets, where realized LTCG is
actually taxed.
