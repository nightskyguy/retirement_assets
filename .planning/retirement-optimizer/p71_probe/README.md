# P71 A/B probes — proof that an MC refactor changed no number

Neither node suite executes `montecarlo/worker.js` (it opens with `importScripts`/`self.onmessage`)
or `montecarlo/mc_controller.js` (it is a page script). The P23 suite's `_p23NewSynth` is a HAND
COPY of the draw loop, so it pins the formula's shape and not the code that ships. And `MC_GOLDEN`,
which P71's plan named as the guard, pins `buildVariations()` row inventory — the sweep enumeration
— not a single simulated return.

So a "byte-identical" claim about an MC refactor needs its own evidence. These two probes are it.
Each loads a repo root's real files into a `vm` context under a minimal shim (worker: `self`,
`importScripts`, `postMessage`; controller: `window.location.protocol`, `setTimeout`,
`performance`), runs a fixed-seed 25-path 30-year job in `gbm`, `aam` and `bootstrap`, and prints a
sha256 of the whole result message with every number at `toPrecision(17)`.

    node probe_worker.js      <repo-root>
    node probe_controller.js  <repo-root>

To A/B, stage the pre-change files somewhere and run both roots:

    mkdir -p /tmp/base/montecarlo
    cp taxengine.js optimizer_core.js sweep_golden.js /tmp/base/
    cp montecarlo/stats.js montecarlo/historical_returns.js /tmp/base/montecarlo/
    for f in worker.js prng.js mc_controller.js; do
        git show HEAD:montecarlo/$f > /tmp/base/montecarlo/$f
    done
    node probe_worker.js /tmp/base && node probe_worker.js .

Identical hashes on both roots, in all three modes, is the pass.

**2026-08-23, P71a:** all six hashes matched, and the worker and the controller produced the SAME
hashes as each other — the two mirrors are in sync today, which is the premise P71b/P71c rest on.

    gbm        6c27ec21931ed71ced3968bdd98e7c0a
    aam        755ab7df0e59624467971c857ec32714
    bootstrap  58fc7d5cd458bf26ae87fc4f7d1bbfac
