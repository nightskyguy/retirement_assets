// Main-thread interface to the Monte Carlo Web Worker.

let _mcWorker = null;

// Launch a Monte Carlo run. Calls onProgress(0..1) for updates, onComplete(resultsMsg) when done.
// cfg: { variations, numPaths, mu, sigma, seed, years }
function runMCWorker(cfg, onProgress, onComplete) {
    if (_mcWorker) {
        _mcWorker.terminate();
        _mcWorker = null;
    }

    _mcWorker = new Worker('montecarlo/worker.js');

    _mcWorker.onmessage = function (e) {
        const msg = e.data;
        if (msg.type === 'progress') {
            onProgress?.(msg.pct);
        } else if (msg.type === 'results') {
            _mcWorker = null;
            onComplete?.(msg);
        }
    };

    _mcWorker.onerror = function (e) {
        console.error('MC Worker error:', e.message, e);
        _mcWorker = null;
        onComplete?.({ error: e.message, variations: [], numPaths: 0, years: 0 });
    };

    _mcWorker.postMessage(cfg);
}

function cancelMCWorker() {
    if (_mcWorker) {
        _mcWorker.terminate();
        _mcWorker = null;
    }
}
