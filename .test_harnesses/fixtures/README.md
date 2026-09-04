# Scenario fixtures

Each `.json` here is the **verbatim output of the page's own `getInputs()`**, captured in a browser
against a share URL and saved. Node harnesses read these instead of re-implementing the share-URL
decoder.

That is the whole point. `optimizer_ui.js` owns the parameter map and the markup defaults; a node-side
re-implementation of it drifts silently, and `stopyear_harness.js` had to live in the browser console
for exactly that reason. Capturing the real decoder's output once removes the drift without moving
the study into a console.

`__meta` on every fixture records the source URL, the page version it was captured from, the UTC
timestamp, and `undefinedKeys` - the keys that were `undefined` in the live object and became `null`
in JSON. A loader must restore those to `undefined`, because the engine distinguishes the two
(`futureIRATaxRate` undefined means "no heirs rate", and `afterTaxWealthOfLogRow` then scores raw
`totalWealth`).

**Re-capture when the page's input set changes.** The captured version is in `__meta.title`; a
fixture from an older version is not wrong, but it is a record of that version.

| fixture | scenario |
|---|---|
| `p106_canonical.json` | The user's own plan, the canonical scenario for `P106`. CA, MFJ, $3.44M IRA, $220k spend declining 1%/yr, Fixed strategy, cyclic on, conversions ending 2032, **no heirs rate set**. |
