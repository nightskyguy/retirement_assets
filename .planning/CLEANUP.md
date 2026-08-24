# Browser storage: security posture and localStorage cleanup

Written 2026-08-24. Analysis only, no code changed. Covers `retirement_optimizer.html` and the two
`localStorage` keys it owns.

---

## 1. What is stored, and where

Two keys, plaintext JSON, no encryption, no expiry, both declared at the top of `optimizer_ui.js`:

| Key | Line | Status |
|---|---|---|
| `SLCRetireOptimizeScenario` | `optimizer_ui.js:14` | current, `SCENARIO_VERSION = 4` |
| `retirementScenarios` | `optimizer_ui.js:17` | legacy v1, still read and migrated forward |

Contents are the full saved-scenario input map: IRA / Roth / brokerage balances, Social Security
amounts, ages, state, spending. Real financial data, sitting in cleartext on disk.

No other tool in the repo writes browser storage. A grep across every `.js` and `.html` returns hits
only in `optimizer_ui.js` (plus the no-storage contract comment at `optimizer_core.js:4`).

---

## 2. How secure is it

Not secure storage, and it was never designed to be. `localStorage` has no encryption, no access
control beyond the browser's same-origin policy, and no protection from anything running inside the
page.

| Reader | Can read? | Why |
|---|---|---|
| Another website (`evil.com`) | No | Same-origin policy. Hard browser boundary. |
| Any other page on the **same origin** | **Yes** | See exposure #1 below. |
| Browser extension with host permission | **Yes** | Extensions run in-page. The page cannot defend against this. |
| Anyone with the unlocked OS user profile | **Yes** | It is a LevelDB file on disk, readable with `strings`. |
| Third-party scripts the page itself loads | **Yes** | See exposure #2 below. |

### Exposure #1: sibling repos share the origin

GitHub Pages serves every repo under `https://nightskyguy.github.io/<repo>/`. That is **one origin**.
Path does not isolate storage; only scheme + host + port do.

So any HTML in **any** repo published under that account, now or later, yours or a merged PR's, can
read the saved retirement scenarios with a single `localStorage.getItem` call.

### Exposure #2: three unpinned third-party scripts

`retirement_optimizer.html` loads these, and each one runs with full same-origin privilege:

| Script | Line | Pinned? |
|---|---|---|
| `googletagmanager.com/gtag/js` (GA4) | 4 | version controlled by Google |
| `cdn.jsdelivr.net/npm/chart.js` | 23 | **no version, no `integrity=` / SRI** |
| `static.cloudflareinsights.com/beacon.min.js` | 1359 | version controlled by Cloudflare |

If any of these is compromised or maliciously updated, a one-liner reads the balances and POSTs them
anywhere. The Chart.js tag is the weakest link: `npm/chart.js` resolves to whatever jsDelivr calls
latest, so you do not control which bytes execute on your users' machines.

**Cheap hardening, if wanted:** pin Chart.js to an exact version with an `integrity=` SRI hash, or
vendor the file into the repo. That closes the largest hole without touching the storage design at
all.

### Not a leak, but worth knowing

The `?...` share URLs are explicit and intentional. Note that they carry full balances in a URL,
which lands in browser history, `Referer` headers, and any intermediate proxy log. Treat a share URL
as public.

---

## 3. The "settings missing on `file:` / `localhost`" puzzle

Not drift, and nothing is lost. **`localStorage` is partitioned per origin, and the port is part of
the origin.**

```
https://nightskyguy.github.io   ->  store A
http://localhost:8767           ->  store B
http://localhost:8791           ->  store C   <-- different port = different store
file:///C:/...                  ->  store D   (opaque-ish, browser-dependent)
```

The preview server uses `autoPort`. Every session that lands on a new port therefore gets a brand new
empty store, which is exactly the symptom observed. `file://` gets yet another one, and Chrome and
Firefox disagree on whether `file://` gets persistent storage at all.

### Enumerate

JavaScript cannot read across origins, so enumeration happens either per-origin or off-disk.

**Per-origin.** Paste in the console on each URL of interest:

```js
(() => {
  const K = ['SLCRetireOptimizeScenario', 'retirementScenarios'];
  console.log('origin:', location.origin);
  console.log('all keys:', Object.keys(localStorage));
  for (const k of K) {
    const raw = localStorage.getItem(k);
    if (!raw) { console.log(k, '-> (absent)'); continue; }
    const o = JSON.parse(raw);
    console.log(k, '->', Object.keys(o).length, 'scenarios,', raw.length, 'bytes');
    console.table(Object.keys(o).map(n => ({ name: n, version: o[n].version ?? 1 })));
  }
})();
```

**All origins at once.** DevTools > Application > Storage > Local Storage lists every origin in that
browser profile. Fastest visual sweep.

**Off-disk**, to find every port that ever held data. Close Chrome first for a clean read:

```bash
grep -a -o -E 'https?://[a-zA-Z0-9.:-]+' "$LOCALAPPDATA/Google/Chrome/User Data/Default/Local Storage/leveldb/"*.ldb | grep -i -E 'localhost|github\.io' | sort -u
```

### Remove the drift

Read the enumeration output **before** deleting. Confirm the origin in the console banner is a
throwaway test origin, not the Pages origin holding scenarios worth keeping. This is not undoable.

```js
(() => {
  const before = Object.keys(localStorage);
  localStorage.removeItem('SLCRetireOptimizeScenario');
  localStorage.removeItem('retirementScenarios');
  console.log('cleared on', location.origin, '| was:', before);
})();
```

Run it on each stale `localhost:<port>` origin.

### Stop it recurring

Pin the preview port instead of trusting `autoPort`, so every session shares one origin:

```bash
PORT=8767 python ~/.claude/serve.py --root "C:/Users/starc/source/retirement_assets/.claude/worktrees/context-ab498f"
```

This also sidesteps the known Windows port-collision gotcha, where two servers appeared to bind 8767
at once and `curl` kept answering from a stale worktree.

---

## 4. Follow-ups, none applied

1. Pin Chart.js to an exact version plus SRI hash, or vendor it. Largest single risk reduction.
2. Decide whether the legacy `retirementScenarios` key still needs read support, or whether the
   migration path can finally be retired.
3. Consider a one-click "clear saved scenarios" control in the page, so cleanup does not require the
   console.
