'use strict';
// Runs the BROWSER-ONLY suite (optimizer_tests.js runTests()) under node with a permissive DOM stub,
// so its pure-engine assertions can be mutation-tested. Assertions that need a real page will fail
// or pass vacuously under the stub; only assertions that PASS at baseline are reported, and they are
// printed in the same check/cross format the node suites use.
//   node inpage_runner.js            (cwd = a repo copy)   env INPAGE_BASELINE=<json> to read/write
const vm = require('vm'), fs = require('fs'), path = require('path');
const cwd = process.cwd();
const PASS = String.fromCharCode(0x2713), FAIL = String.fromCharCode(0x2717);

function makeStub() {
    const target = function () {};
    const stub = new Proxy(target, {
        get(t, p) {
            if (p === Symbol.toPrimitive) return () => 0;
            if (p === Symbol.iterator) return function* () {};
            if (p === 'toString' || p === 'valueOf') return () => '';
            if (p === 'length' || p === 'size') return 0;
            if (p === 'then') return undefined;
            if (p === 'value' || p === 'textContent' || p === 'innerHTML' || p === 'title' || p === 'id' || p === 'className') return '';
            if (p === 'checked' || p === 'disabled' || p === 'hidden' || p === 'open') return false;
            if (p === 'children' || p === 'options' || p === 'childNodes' || p === 'rows') return [];
            if (p === 'style' || p === 'dataset' || p === 'classList') return stub;
            return stub;
        },
        set() { return true; }, has() { return true; }, apply() { return stub; }, construct() { return stub; },
        deleteProperty() { return true; },
    });
    return stub;
}
const stub = makeStub();
const realLog = console.log;
const results = [];
const seen = new Map();
console.log = function (...a) {
    const s = String(a[0]);
    let m;
    if ((m = /^✅ PASS: (.*)$/.exec(s))) record(true, m[1]);
    else if ((m = /^❌ FAIL @ [^:]*:\S*\s+(.*?)\s*$/.exec(s)) || (m = /^❌ FAIL[^A-Za-z]*(.*?)\s*$/.exec(s))) record(false, m[1]);
};
console.warn = console.error = console.info = console.debug = function () {};
function record(ok, name) {
    const n = (seen.get(name) || 0) + 1; seen.set(name, n);
    results.push([ok, name + (n > 1 ? ' #' + n : '')]);
}

const g = globalThis;
g.window = g; g.self = g;
g.document = new Proxy(function () {}, {
    get(t, p) {
        if (p === 'getElementById' || p === 'querySelector') return () => stub;
        if (p === 'querySelectorAll' || p === 'getElementsByClassName' || p === 'getElementsByTagName') return () => [];
        if (p === 'readyState') return 'complete';
        if (p === 'addEventListener' || p === 'removeEventListener') return () => {};
        if (p === 'createElement' || p === 'createElementNS' || p === 'createTextNode' || p === 'createDocumentFragment') return () => stub;
        return stub;
    }, set() { return true; }, has() { return true; },
});
g.location = { search: '', href: 'http://localhost/retirement_optimizer.html', protocol: 'http:', origin: 'http://localhost', pathname: '/retirement_optimizer.html', hash: '', host: 'localhost', hostname: 'localhost' };
g.localStorage = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
g.sessionStorage = g.localStorage;
try { Object.defineProperty(g, 'navigator', { value: { userAgent: 'node', clipboard: stub, language: 'en-US' }, configurable: true }); } catch (e) {}
g.history = { replaceState() {}, pushState() {} };
g.Chart = stub; g.requestIdleCallback = () => 0; g.requestAnimationFrame = () => 0; g.cancelAnimationFrame = () => {};
g.getComputedStyle = () => stub; g.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
g.alert = () => {}; g.confirm = () => true; g.prompt = () => null;
g.MutationObserver = g.ResizeObserver = g.IntersectionObserver = function () { return { observe() {}, disconnect() {}, unobserve() {} }; };
g.Worker = undefined; g.Image = function () { return stub; }; g.FileReader = function () { return stub; };
g.addEventListener = () => {}; g.removeEventListener = () => {}; g.dispatchEvent = () => true;
g.innerWidth = 1400; g.innerHeight = 900; g.devicePixelRatio = 1; g.scrollTo = () => {};
g.gtag = () => {}; g.dataLayer = [];
for (const n of ['Node','Element','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','CustomEvent','KeyboardEvent','MouseEvent','InputEvent','DOMParser','XMLSerializer','Blob','File','CSS','NodeFilter','Range','Selection','DocumentFragment','HTMLCanvasElement','CanvasRenderingContext2D','Option','Audio','Notification','screen','visualViewport','caches','indexedDB','crypto_']) if (typeof g[n] === 'undefined') g[n] = stub;
g.module = undefined;

const order = ['displayhelpers.js', 'taxengine.js', 'optimizer_core.js', 'optimizer_ui.js', 'optimizer_tests.js',
    'montecarlo/historical_returns.js', 'montecarlo/prng.js', 'montecarlo/stats.js', 'montecarlo/mc_engine.js',
    'montecarlo/rails_engine.js', 'montecarlo/mc_controller.js', 'montecarlo/mc_tab.js'];
let loadErr = null;
for (const f of order) {
    try { vm.runInThisContext(fs.readFileSync(path.join(cwd, f), 'utf8'), { filename: f }); }
    catch (e) { loadErr = f + ': ' + (e && e.message); if (/optimizer_core|taxengine|optimizer_tests/.test(f)) break; }
}
let runErr = null;
const watchdog = setTimeout(() => { finish('timeout'); process.exit(3); }, 120000);
try { if (typeof g.runTests === 'function') g.runTests(); else runErr = 'runTests is not defined (' + loadErr + ')'; }
catch (e) { runErr = (e && e.stack || String(e)).split('\n').slice(0, 3).join(' | '); }
clearTimeout(watchdog);
finish(runErr);

function finish(err) {
    const bfile = process.env.INPAGE_BASELINE;
    let allow = null;
    if (bfile && fs.existsSync(bfile)) allow = new Set(JSON.parse(fs.readFileSync(bfile, 'utf8')));
    if (bfile && !allow) fs.writeFileSync(bfile, JSON.stringify(results.filter(r => r[0]).map(r => r[1])));
    const got = new Map(results.map(r => [r[1], r[0]]));
    if (allow) {
        for (const name of allow) {
            const ok = got.get(name) === true;
            realLog(`  ${ok ? PASS : FAIL}  ${name}`);
        }
    } else {
        for (const [ok, name] of results) realLog(`  ${ok ? PASS : FAIL}  ${name}`);
    }
    realLog(`inpage: ${results.filter(r => r[0]).length} passed, ${results.filter(r => !r[0]).length} failed, of ${results.length}` + (err ? ' | ABORTED: ' + err : '') + (loadErr ? ' | loadErr: ' + loadErr : ''));
}
