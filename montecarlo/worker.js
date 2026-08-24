// Monte Carlo simulation worker: the message shell around mc_engine.js.
// Receives a config message, hands it to the engine, posts progress updates, then posts the final
// results. The model itself lives in mc_engine.js, which mc_controller.js's file:// fallback runs
// too - this file used to hold a second copy of it, and the two drifted.

// Propagate the worker's own cache-bust token (?v=… from new Worker(...)) to its imported
// scripts so prng.js / core.js etc. never serve a stale cached copy when the worker refreshes.
const _v = self.location.search || '';
importScripts('../taxengine.js' + _v, '../optimizer_core.js' + _v, 'prng.js' + _v, 'stats.js' + _v,
              'historical_returns.js' + _v, 'mc_engine.js' + _v);

// The engine reports progress inside a variation, every 16 paths, which is far more often than a
// worker should post: a 10,000-path 144-variation run would be 90,000 messages. Throttle to one
// every 60ms. Nothing downstream reads more than the latest percentage.
let _lastPost = 0;
function _postProgress(pct) {
    const now = performance.now();
    // The last update is exempt: dropping it leaves the bar short of full for as long as the
    // results message takes to build and clone, which on a big run is visible.
    if (pct < 0.999 && now - _lastPost < 60) return;
    _lastPost = now;
    postMessage({ type: 'progress', pct });
}

// A throw in here used to escape as a worker `error` event, which mc_controller.js reads as "worker
// unavailable" and answers by retrying the identical config on the main thread -- where it threw
// again, that time as an unhandled promise rejection, so the completion callback never fired. The
// caller's in-flight flags then stayed set and the Stress Test froze for the rest of the session.
// Catching here turns any failure into an ordinary result message with an `error` field, which every
// caller already knows how to display. runJob() is async, so the rejection path needs its own catch:
// a try/catch alone would let a failure after the first await escape as that same error event.
self.onmessage = function (e) {
    const fail = err => postMessage({ type: 'results', error: String((err && err.message) || err) });
    try {
        _lastPost = 0;
        runJob(e.data, { onProgress: _postProgress })
            .then(msg => { if (msg) postMessage(msg); })
            .catch(fail);
    } catch (err) {
        fail(err);
    }
};
