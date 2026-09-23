#!/usr/bin/env node
'use strict';
// page-suite.js - run retirement_optimizer.html's in-page suite (optimizer_tests.js) in a headless
// Chrome or Edge, and exit non-zero if any assertion fails. The pre-commit hook runs it after the
// node suites; run it by hand the same way:
//
//     node .githooks/page-suite.js
//
// The page is opened with ?runtests=page: the in-page tier, including the tests that write to live
// page state, and not the node tier, which the hook has just run itself.
//
// Nothing to install. It needs node 22 or newer (built-in WebSocket) and a Chrome, Edge or
// Chromium; PAGE_SUITE_BROWSER names one explicitly. The repo is served from 127.0.0.1 with caching
// off, so the page runs the files on disk. Every request that is not for that server is answered
// here, never by the network: Chart.js from a local copy (downloaded once, then refreshed weekly,
// so a commit works offline after the first run), and everything else, analytics included, refused.

const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PAGE = 'retirement_optimizer.html';
const TIMEOUT_MS = Number(process.env.PAGE_SUITE_TIMEOUT_MS) || 120000;
const CHART_URL = 'https://cdn.jsdelivr.net/npm/chart.js';
const CHART_CACHE = path.join(os.tmpdir(), 'retirement-assets-page-suite', 'chart.js');
const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.cjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
// A timeout to race against: unref'd, so a race already won does not keep node alive until it fires.
const grace = ms => new Promise(r => setTimeout(r, ms).unref());
const say = msg => console.log(`page-suite: ${msg}`);

function findBrowser() {
    const named = process.env.PAGE_SUITE_BROWSER;
    if (named) return fs.existsSync(named) ? named : null;
    let candidates;
    if (process.platform === 'win32') {
        const dirs = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
        candidates = dirs.flatMap(d => [path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'),
                                        path.join(d, 'Microsoft', 'Edge', 'Application', 'msedge.exe')]);
    } else if (process.platform === 'darwin') {
        candidates = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
                      '/Applications/Chromium.app/Contents/MacOS/Chromium'];
    } else {
        candidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']
            .map(name => (cp.spawnSync('which', [name], { encoding: 'utf8' }).stdout || '').trim());
    }
    return candidates.find(p => p && fs.existsSync(p)) || null;
}

// Chart.js as the page's CDN tag serves it, cached across runs. A failed refresh keeps the old copy.
async function chartSource() {
    const fresh = fs.existsSync(CHART_CACHE) && Date.now() - fs.statSync(CHART_CACHE).mtimeMs < 7 * 864e5;
    if (!fresh) {
        try {
            const r = await fetch(CHART_URL, { signal: AbortSignal.timeout(15000) });
            const body = r.ok ? Buffer.from(await r.arrayBuffer()) : null;
            if (body && body.length > 10000) {
                fs.mkdirSync(path.dirname(CHART_CACHE), { recursive: true });
                fs.writeFileSync(CHART_CACHE, body);
            }
        } catch (_) { /* offline: use the cached copy below, if there is one */ }
    }
    return fs.existsSync(CHART_CACHE) ? fs.readFileSync(CHART_CACHE) : null;
}

function serve(root) {
    const server = http.createServer((req, res) => {
        const rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
        const file = path.resolve(root, '.' + rel);
        if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
        fs.readFile(file, (err, data) => {
            if (err) { res.writeHead(404); res.end(); return; }
            res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
                                 'Cache-Control': 'no-store' });
            res.end(data);
        });
    });
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

// The browser writes its DevTools port and path to this file once it is listening.
async function devtoolsUrl(profile, deadline) {
    const file = path.join(profile, 'DevToolsActivePort');
    while (Date.now() < deadline) {
        if (fs.existsSync(file)) {
            const [port, wsPath] = fs.readFileSync(file, 'utf8').split(/\r?\n/);
            if (port && wsPath) return `ws://127.0.0.1:${port}${wsPath}`;
        }
        await sleep(100);
    }
    throw new Error('the browser never opened its DevTools port');
}

// A minimal Chrome DevTools Protocol client over node's built-in WebSocket.
class Cdp {
    constructor(url) {
        this.ws = new WebSocket(url);
        this.nextId = 0;
        this.pending = new Map();
        this.listeners = [];
    }
    open() {
        return new Promise((resolve, reject) => {
            this.ws.onopen = () => resolve();
            this.ws.onerror = () => reject(new Error('could not connect to the browser'));
            this.ws.onmessage = ev => this.receive(JSON.parse(ev.data));
            // A browser that is closing drops the socket without answering, Browser.close included.
            this.ws.onclose = () => {
                for (const p of this.pending.values()) p.reject(new Error(`${p.method}: connection closed`));
                this.pending.clear();
            };
        });
    }
    receive(msg) {
        if (msg.id !== undefined) {
            const p = this.pending.get(msg.id);
            if (!p) return;
            this.pending.delete(msg.id);
            if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
            else p.resolve(msg.result);
            return;
        }
        for (const fn of this.listeners) fn(msg);
    }
    send(method, params = {}, sessionId) {
        const id = ++this.nextId;
        this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
        return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
    }
    on(fn) { this.listeners.push(fn); }
    close() { try { this.ws.close(); } catch (_) { /* already closed */ } }
}

const argText = a => ('value' in a) ? String(a.value) : (a.description || a.type);
const exceptionText = d => (d.exception && d.exception.description) || d.text
    + (d.url ? ` (${d.url.split('/').pop()}:${d.lineNumber + 1})` : '');

async function run() {
    const started = Date.now();
    const deadline = started + TIMEOUT_MS;
    const exe = findBrowser();
    if (!exe) throw new Error(process.env.PAGE_SUITE_BROWSER
        ? `PAGE_SUITE_BROWSER names ${process.env.PAGE_SUITE_BROWSER}, which does not exist.`
        : 'no Chrome, Edge or Chromium found. Install one, or set PAGE_SUITE_BROWSER to its path.');
    const chart = await chartSource();
    if (!chart) throw new Error(`Chart.js could not be downloaded from ${CHART_URL} and there is no cached copy yet. Connect once and re-run.`);

    const server = await serve(ROOT);
    const origin = `http://127.0.0.1:${server.address().port}`;
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'page-suite-profile-'));
    const browser = cp.spawn(exe, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--disable-extensions', '--disable-background-networking', '--disable-sync',
        '--disable-component-update', '--mute-audio', '--window-size=1400,900',
        '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
    ], { stdio: 'ignore', windowsHide: true });
    const exited = new Promise(resolve => browser.once('exit', resolve));
    let cdp = null;
    try {
        cdp = new Cdp(await devtoolsUrl(profile, Math.min(deadline, Date.now() + 20000)));
        await cdp.open();
        const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
        const page = (method, params) => cdp.send(method, params, sessionId);

        const lines = [];
        const errors = [];
        cdp.on(msg => {
            if (msg.sessionId !== sessionId) return;
            const p = msg.params;
            if (msg.method === 'Runtime.consoleAPICalled') lines.push(p.args.map(argText).join(' '));
            else if (msg.method === 'Runtime.exceptionThrown') errors.push(exceptionText(p.exceptionDetails));
            else if (msg.method === 'Fetch.requestPaused') {
                const answer = p.request.url.startsWith(origin + '/')
                    ? page('Fetch.continueRequest', { requestId: p.requestId })
                    : p.request.url.startsWith(CHART_URL)
                    ? page('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, body: chart.toString('base64'),
                                                     responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }] })
                    : page('Fetch.failRequest', { requestId: p.requestId, errorReason: 'BlockedByClient' });
                answer.catch(() => { /* the request may already be gone, e.g. on navigation */ });
            }
        });
        await page('Runtime.enable');
        await page('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
        await page('Page.enable');
        await page('Page.navigate', { url: `${origin}/${PAGE}?runtests=page` });

        let result = null;
        while (Date.now() < deadline) {
            const r = await page('Runtime.evaluate', {
                expression: 'window.TIER1_RESULT ? JSON.stringify(window.TIER1_RESULT) : ""', returnByValue: true });
            if (r.result && r.result.value) { result = JSON.parse(r.result.value); break; }
            await sleep(250);
        }
        const secs = ((Date.now() - started) / 1000).toFixed(1);
        const problems = [];
        if (!result) problems.push(`the in-page suite did not finish within ${TIMEOUT_MS / 1000}s`);
        else {
            if (result.failed > 0) problems.push(`${result.failed} assertion(s) failed`);
            if (result.skippedUnsafe > 0) problems.push(`${result.skippedUnsafe} state-writing suite(s) were skipped`);
        }
        if (errors.length) problems.push(`${errors.length} uncaught page error(s)`);
        if (!problems.length) {
            say(`${result.passed} in-page assertions passed in ${secs}s (${path.basename(exe)}, headless).`);
            return 0;
        }
        say(`FAILED after ${secs}s - ${problems.join('; ')}.`);
        // Each failure is a line starting with the cross mark, then its Expected and Got lines.
        const CROSS = String.fromCharCode(0x274C);
        lines.forEach((line, i) => {
            if (line.startsWith(CROSS)) console.log('  ' + [line, lines[i + 1], lines[i + 2]].filter(Boolean).join('\n  '));
        });
        for (const e of errors) console.log(`  uncaught: ${e}`);
        if (!result && lines.length) console.log('  last console lines:\n  ' + lines.slice(-8).join('\n  '));
        return 1;
    } finally {
        if (cdp) {
            await Promise.race([cdp.send('Browser.close').catch(() => {}), grace(3000)]);
            cdp.close();
        }
        await Promise.race([exited, grace(5000)]);
        if (browser.exitCode === null) browser.kill();
        server.closeAllConnections();
        server.close();
        try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (_) { /* a locked temp profile is harmless */ }
    }
}

run().then(code => { process.exitCode = code; }, err => {
    say(`BLOCKED - ${err.message}`);
    process.exitCode = 1;
});
