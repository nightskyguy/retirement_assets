'use strict';
/**
 * feedback.tests.js
 * Run with: node feedback.tests.js
 *
 * TEST COUNTS ARE PINNED OUTSIDE THIS FILE. Adding or removing a test here means updating, in the
 * same commit:
 *   1. `TestTiers.EXPECTED` in optimizer_tests.js - ONE object holding the count of EVERY node
 *      suite, so the file you have to edit is usually not the tool you are working on.
 *   2. the suite table in .githooks/README.md
 * Measure, never guess: run this file and use the printed total.
 *
 * Covers "Send feedback" end to end, in three layers:
 *   1. feedback.js, the dialog's pure half: what a report contains, what it withholds, and whether
 *      sending can work from this page at all. Runs in node and in the page's ?runtests tier.
 *   2. The privacy split: every share-link key in optimizer_ui.js is classified, and the money,
 *      age, date and health keys are on the withheld side. Node only, since it reads source.
 *   3. .feedback-worker/src/logic.cjs, the Cloudflare Worker: origin, size, rate and bot checks,
 *      payload validation, and the exact email it writes, driven through handle() with stand-ins
 *      for Cloudflare. Node only.
 *
 * Tests may return a promise; the runner awaits each one. A node-only test returns before creating
 * its promise when it runs in a browser, so both environments report the same count.
 */

// Wrapped in an IIFE so the top-level names here do not collide with the page's own global lexical
// scope once the tier-2 loader injects this file.
(() => {

const IS_NODE = (typeof module !== 'undefined' && module.exports);

// Resolved lazily, the same way doclinks.tests.js resolves its module.
function _feedback() {
  const f = IS_NODE ? require('./feedback.js') : window.FeedbackWidget;
  if (!f) throw new Error('feedback.js has not loaded');
  return f;
}
const FW = new Proxy({}, { get: (_t, prop) => _feedback()[prop] });

function _worker() {
  return require('./.feedback-worker/src/logic.cjs');
}

let passed = 0, failed = 0;

// Registers rather than runs - see the note in optimizer_core.tests.js.
const TESTS = [];

function test(name, fn) {
  TESTS.push([name, fn]);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function deepEq(actual, expected, msg) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'expected ' + b + ', got ' + a);
}

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────────

const SAFE = ['str', 'os', 's', 'g'];
const SHARE = 'https://tools.netcitizen.us/retirement_optimizer.html'
  + '?str=ordered&i1=1.5e6&os=RIBC&sg=140000&s=CA&by1=1960&g=6';
const CFG = {
  tool: 'Retirement Optimizer',
  version: '11.1867',
  safeKeys: SAFE,
  keyNames: { i1: 'IRA1', sg: 'spendGoal', by1: 'birthyear1' },
};

function dialogState(over) {
  return Object.assign({
    message: '  The chart is blank.\r\nSecond line  ',
    replyTo: '',
    includeSettings: false,
    includePlan: false,
    shareUrl: SHARE,
    errors: ['TypeError: x @ optimizer_ui.js:12'],
    screenshot: null,
    turnstile: 'tok',
    href: 'https://tools.netcitizen.us/retirement_optimizer.html?i1=1.5e6&sg=140000#top',
    env: { ua: 'UA', viewport: '800x600', dpr: '1', tab: 'Charts' },
  }, over || {});
}

function where(href) {
  const u = new URL(href);
  return { protocol: u.protocol, hostname: u.hostname, search: u.search };
}

const GOOD_ADDRESSES = [
  'pat@example.com',
  'first.last+tag@mail.example.co.uk',
  "o'brien@example.org",
  'x_y-z@sub-domain.example.io',
];
const BAD_ADDRESSES = [
  'pat@example',
  'pat example@example.com',
  'pat@example.com\r\nBcc: x@evil.test',
  'pat@exa\nmple.com',
  'a@b.com, c@d.com',
  'a@b.com;c@d.com',
  '<pat@example.com>',
  'Pat <pat@example.com>',
  '"pat"@example.com',
  'pat@@example.com',
  '.pat@example.com',
  'pat.@example.com',
  'pat..x@example.com',
  'pat@-example.com',
  'a'.repeat(250) + '@example.com',
];

// ── feedback.js: what a report contains ───────────────────────────────────────────────────────────

test('splitQuery keeps only the safe keys, in their original order', () => {
  eq(FW.splitQuery(FW.queryOf(SHARE), SAFE).settings, 'str=ordered&os=RIBC&s=CA&g=6');
});

test('splitQuery names each withheld key once, and withholds keys it does not know', () => {
  const r = FW.splitQuery('i1=1&zz=2&i1=3&by1=1960&str=x', ['str']);
  deepEq(r.withheld, ['i1', 'zz', 'by1']);
  eq(r.settings, 'str=x');
});

test('splitQuery handles an empty or missing query, with or without "?"', () => {
  deepEq(FW.splitQuery('', SAFE), { settings: '', withheld: [] });
  deepEq(FW.splitQuery(undefined, SAFE), { settings: '', withheld: [] });
  eq(FW.splitQuery('?str=a', SAFE).settings, 'str=a');
  eq(FW.queryOf('https://x.test/p'), '');
  eq(FW.queryOf('https://x.test/p?a=1#frag'), 'a=1');
});

test('keys named after object properties are neither safe nor renamed', () => {
  const r = FW.splitQuery('constructor=1&__proto__=2&toString=3', []);
  eq(r.settings, '');
  deepEq(r.withheld, ['constructor', '__proto__', 'toString']);
  eq(FW.fieldName('constructor', { i1: 'IRA1' }), 'constructor');
  eq(FW.fieldName('odd key!', null), 'odd_key_');
});

test('buildPayload leaves the plan link out unless it is checked', () => {
  eq(FW.buildPayload(dialogState(), CFG).planUrl, null);
  eq(FW.buildPayload(dialogState({ includePlan: true }), CFG).planUrl, SHARE);
  eq(FW.buildPayload(dialogState({ includePlan: true, shareUrl: '' }), CFG).planUrl, null);
});

test('buildPayload sends settings, withheld names and page errors only when settings is checked', () => {
  const off = FW.buildPayload(dialogState(), CFG);
  eq(off.settings, null);
  eq(off.withheld, null);
  eq(off.errors, null);
  const on = FW.buildPayload(dialogState({ includeSettings: true }), CFG);
  eq(on.settings, 'str=ordered&os=RIBC&s=CA&g=6');
  deepEq(on.errors, ['TypeError: x @ optimizer_ui.js:12']);
  const many = FW.buildPayload(dialogState({ includeSettings: true, errors: ['1', '2', '3', '4', '5', '6', '7'] }), CFG);
  deepEq(many.errors, ['3', '4', '5', '6', '7'], 'the five most recent');
});

test('buildPayload names withheld fields readably and never carries their values', () => {
  const p = FW.buildPayload(dialogState({ includeSettings: true }), CFG);
  deepEq(p.withheld, ['IRA1', 'spendGoal', 'birthyear1']);
  const all = JSON.stringify(p);
  for (const value of ['1.5e6', '140000', '1960']) assert(!all.includes(value), value + ' leaked into the report');
});

test('the state always goes with the settings, even at its default, and only a safe key can be pinned', () => {
  const cfg = Object.assign({}, CFG, { pinned: { s: 'CA', i1: '999999' } });
  // The share link leaves out a state that is still at its default.
  const p = FW.buildPayload(dialogState({
    includeSettings: true,
    shareUrl: 'https://tools.netcitizen.us/r.html?str=ordered&sg=140000',
  }), cfg);
  eq(p.settings, 's=CA&str=ordered');
  assert(!JSON.stringify(p).includes('999999'), 'a pinned key that is not marked safe was sent');
  eq(FW.buildPayload(dialogState({ includeSettings: true, shareUrl: 'https://x.test/r.html?s=NY&g=6' }), cfg).settings,
    's=NY&g=6', 'a state already in the link is neither repeated nor replaced');
  eq(FW.buildPayload(dialogState(), cfg).settings, null, 'unchecked settings send no state either');
});

test('the GitHub link fills the message, version and browser, and nothing about the plan', () => {
  const p = FW.buildPayload(dialogState({ includeSettings: true, includePlan: true }), CFG);
  const url = new URL(FW.githubIssueUrl(p));
  eq(url.origin + url.pathname, FW.GITHUB_NEW_ISSUE);
  eq(url.searchParams.get('template'), FW.GITHUB_TEMPLATE);
  eq(url.searchParams.get('title'), '[Feedback] The chart is blank. Second line');
  eq(url.searchParams.get(FW.GITHUB_FIELDS.message), 'The chart is blank.\nSecond line');
  eq(url.searchParams.get(FW.GITHUB_FIELDS.version), '11.1867');
  eq(url.searchParams.get(FW.GITHUB_FIELDS.browser), 'UA');
  deepEq([...url.searchParams.keys()].sort(), ['browser', 'template', 'title', 'version', 'what']);
  const values = [...url.searchParams.values()].join(' ');
  for (const secret of ['1.5e6', '140000', '1960', 'str=']) assert(!values.includes(secret), secret + ' reached a public link');

  // A long message is cut, says so, and the link stays short enough for GitHub.
  for (const ch of ['x', '税']) {
    const link = FW.githubIssueUrl({ message: ch.repeat(8000), version: '11.1867', env: { ua: 'U'.repeat(300) } });
    const what = new URL(link).searchParams.get('what');
    assert(/Shortened/.test(what) && what.startsWith(ch.repeat(100)), 'a long message is cut and says so');
    assert(link.length < 8000, 'a link of ' + link.length + ' characters');
  }
});

test('buildPayload sends the page address without its query or fragment', () => {
  eq(FW.buildPayload(dialogState(), CFG).page, 'https://tools.netcitizen.us/retirement_optimizer.html');
  eq(FW.pageAddress('file:///C:/x/retirement_optimizer.html?i1=5#a'), 'file:///C:/x/retirement_optimizer.html');
});

test('the message is trimmed, uses plain line breaks, and must be 1 to 5000 characters', () => {
  eq(FW.buildPayload(dialogState(), CFG).message, 'The chart is blank.\nSecond line');
  eq(FW.messageProblem('   \n '), 'empty');
  eq(FW.messageProblem('x'.repeat(FW.LIMITS.message)), '');
  eq(FW.messageProblem('x'.repeat(FW.LIMITS.message + 1)), 'long');
});

test('validReplyTo accepts ordinary addresses and an empty box', () => {
  for (const a of GOOD_ADDRESSES) assert(FW.validReplyTo(a), a + ' should be accepted');
  assert(FW.validReplyTo(''), 'empty is allowed: the address is optional');
  assert(FW.validReplyTo('   '), 'blank counts as empty');
});

test('validReplyTo refuses anything that could add a header or a second recipient', () => {
  for (const a of BAD_ADDRESSES) assert(!FW.validReplyTo(a), JSON.stringify(a) + ' should be refused');
  assert(!FW.validReplyTo(null), 'not a string');
});

test('maskDigits hides every run of three or more digits', () => {
  eq(FW.maskDigits('balance 1500000 in 2031 at 7% x12'), 'balance ####### in #### at 7% x12');
});

test('errorLine keeps the script file name and never the page query', () => {
  eq(FW.errorLine('Bad value 250000',
    'https://tools.netcitizen.us/retirement_optimizer.html?i1=250000&sg=90000', 1712, 9),
    'Bad value ###### @ retirement_optimizer.html:1712:9');
  eq(FW.errorLine('Oops', 'https://tools.netcitizen.us/optimizer_ui.js?v=111859x', 42, 0), 'Oops @ optimizer_ui.js:42');
  eq(FW.errorLine('Rejected', '', 0, 0), 'Rejected');
  assert(FW.errorLine('x'.repeat(900), '', 0, 0).length <= FW.LIMITS.errorText, 'capped');
});

test('resolveEndpoint honors ?fbdev only on a page served from localhost', () => {
  const live = FW.resolveEndpoint(where('https://tools.netcitizen.us/retirement_optimizer.html?fbdev'), 'KEY');
  eq(live.endpoint, FW.ENDPOINT);
  eq(live.siteKey, 'KEY');
  eq(live.dev, false);
  eq(FW.resolveEndpoint(where('https://localhost.example.com/x.html?fbdev'), 'KEY').dev, false, 'lookalike host');
  const local = FW.resolveEndpoint(where('http://127.0.0.1:8767/retirement_optimizer.html?fbdev'), 'KEY');
  eq(local.endpoint, FW.DEV_ENDPOINT);
  eq(local.siteKey, FW.DEV_SITE_KEY);
  eq(local.problem, '');
  eq(FW.resolveEndpoint(where('http://localhost:8767/x.html'), 'KEY').endpoint, FW.ENDPOINT, 'no flag, no dev');
});

test('resolveEndpoint refuses a page opened from disk, and a copy with no site key', () => {
  eq(FW.resolveEndpoint(where('file:///C:/tools/retirement_optimizer.html?fbdev'), 'KEY').problem, 'file');
  eq(FW.resolveEndpoint(where('https://tools.netcitizen.us/retirement_optimizer.html'), '').problem, 'setup');
  eq(FW.resolveEndpoint(where('https://tools.netcitizen.us/retirement_optimizer.html'), 'KEY').problem, '');
  eq(FW.resolveEndpoint(where('https://tools.netcitizen.us/r.html')).problem, FW.SITE_KEY ? '' : 'setup',
    'the shipped site key decides');
});

test('dataUrlBytes measures the decoded image, padding included', () => {
  eq(FW.dataUrlBytes('data:image/jpeg;base64,/9j/'), 3);
  eq(FW.dataUrlBytes('data:image/jpeg;base64,/9j/4A=='), 4);
  eq(FW.dataUrlBytes('data:image/jpeg;base64,/9j/4AA='), 5);
  eq(FW.dataUrlBytes('nonsense'), 0);
});

test('the preview marks every unchecked part and shows a screenshot only by its size', () => {
  const quiet = FW.describePayload(FW.buildPayload(dialogState(), CFG));
  for (const line of ['Settings: (not included)', 'Page errors: (not included)',
                      'Full plan link: (not included)', 'Screenshot: (not included)']) {
    assert(quiet.includes(line), 'missing "' + line + '"');
  }
  const shot = 'data:image/jpeg;base64,/9j/' + 'A'.repeat(4000);
  const full = FW.describePayload(FW.buildPayload(
    dialogState({ includeSettings: true, includePlan: true, screenshot: shot }), CFG));
  assert(full.includes('Withheld, names only: IRA1, spendGoal, birthyear1'), full);
  assert(full.includes(SHARE), 'the plan link is shown when it is checked');
  assert(/Screenshot: \d+ KB image/.test(full) && !full.includes('AAAA'), 'the image appears by size only');
});

test('a refusal from the service is shown in plain words, never as raw server text', () => {
  assert(/Wait a minute/.test(FW.failureText(429, 'rate')));
  assert(/full for today/.test(FW.failureText(429, 'daily')) && /GitHub/.test(FW.failureText(429, 'daily')),
    'a full day points to GitHub');
  assert(/spam check/.test(FW.failureText(403, 'bot')));
  const hostile = FW.failureText(400, '<img src=x onerror=alert(1)>');
  assert(!/[<>=]/.test(hostile) && hostile.includes('(imgsrcxonerroralert)'), 'only letters survive: ' + hostile);
});

// ── The privacy split, and the page wiring ────────────────────────────────────────────────────────

function _source(file) {
  return require('fs').readFileSync(require('path').join(__dirname, file), 'utf8');
}

// Evaluates one `const NAME = { ... };` object literal from optimizer_ui.js without loading the file.
function _literal(src, name) {
  const m = src.match(new RegExp('const ' + name + ' = (\\{[\\s\\S]*?\\n\\});'));
  if (!m) throw new Error('test setup: const ' + name + ' not found in optimizer_ui.js');
  return require('vm').runInNewContext('(' + m[1] + ')');
}

test('every share-link key is classified as safe or personal, exactly once', () => {
  if (!IS_NODE) return;
  const src = _source('optimizer_ui.js');
  const map = _literal(src, 'OPT_LONG_TO_SHORT');
  const privacy = _literal(src, 'OPT_SHARE_PRIVACY');
  // buildShareURL() also emits a few keys outside its field loop, by literal name.
  const builder = (src.match(/function buildShareURL\(\) \{[\s\S]*?\r?\n\}\r?\n/) || [''])[0];
  const extras = [...builder.matchAll(/params\.set\('([A-Za-z0-9_]+)'/g)].map(m => m[1]);
  assert(extras.length >= 4, 'test setup: the extra keys in buildShareURL were not found');
  const keys = Object.values(map).concat(extras);
  assert(keys.length > 60, 'test setup: the key map looks truncated (' + keys.length + ')');

  const safe = new Set(privacy.safe);
  const personal = new Set(privacy.personal);
  const both = keys.filter(k => safe.has(k) && personal.has(k));
  const neither = keys.filter(k => !safe.has(k) && !personal.has(k));
  const stale = [...safe, ...personal].filter(k => !keys.includes(k));
  assert(!both.length, 'in both lists: ' + both.join(', '));
  assert(!neither.length, 'not classified - add each to OPT_SHARE_PRIVACY in optimizer_ui.js: ' + neither.join(', '));
  assert(!stale.length, 'classified, but no longer a share-link key: ' + stale.join(', '));
});

test('balances, income, spending, ages, dates and health coverage are all withheld', () => {
  if (!IS_NODE) return;
  const personal = new Set(_literal(_source('optimizer_ui.js'), 'OPT_SHARE_PRIVACY').personal);
  const mustBe = {
    balance: ['i1', 'i2', 'ro', 'ro2', 'bk', 'bb', 'ca', 'cr'],
    income: ['ss1', 'ss2', 'pa', 'pc', 'sur'],
    spending: ['sg', 'qm', 'af', 'ptx', 'eca', 'ibg'],
    ageOrDate: ['by1', 'bm1', 'by2', 'bm2', 'd1', 'd2', 'sa', 'ss1a', 'ss2a', 'psa', 'cey'],
    health: ['me1', 'me2'],
  };
  const wrong = [];
  for (const [kind, keys] of Object.entries(mustBe)) {
    for (const k of keys) if (!personal.has(k)) wrong.push(kind + ' ' + k);
  }
  assert(!wrong.length, 'must be withheld from a settings-only report: ' + wrong.join(', '));
});

test('retirement_optimizer.html loads feedback.js early and wires the Feedback button', () => {
  if (!IS_NODE) return;
  const src = _source('retirement_optimizer.html');
  const head = src.slice(0, src.indexOf('</head>'));
  const tag = head.match(/<script src="feedback\.js(\?v=[^"]*)?"[^>]*><\/script>/);
  assert(tag, 'feedback.js must load in <head>, so its error listeners exist before the page scripts run');
  assert(!/\b(defer|async)\b/.test(tag[0]), 'feedback.js must not be deferred: ' + tag[0]);
  assert(/onclick="FeedbackWidget\.open\(\)"/.test(src), 'no button opens the dialog');
  assert(/FeedbackWidget\.init\(\{[\s\S]*?safeKeys:\s*OPT_SHARE_PRIVACY\.safe/.test(src),
    'the page must hand feedback.js its safe-key list');
  assert(/FeedbackWidget\.init\(\{[\s\S]*?pinnedSettings:[^\n]*\bs:\s*document\.getElementById\('STATEname'\)/.test(src),
    'the page must pin the state, which the share link leaves out at its default');
});

test('the GitHub issue form has the fields the link fills, and a required privacy check', () => {
  if (!IS_NODE) return;
  const src = _source('.github/ISSUE_TEMPLATE/feedback.yml');
  for (const key of ['name', 'description', 'body']) {
    assert(new RegExp('^' + key + ':', 'm').test(src), 'the form has no top-level ' + key);
  }
  const ids = [...src.matchAll(/^\s+id:\s*([A-Za-z0-9_-]+)\s*$/gm)].map(m => m[1]);
  eq(new Set(ids).size, ids.length, 'field ids must be unique');
  for (const id of Object.values(FW.GITHUB_FIELDS)) assert(ids.includes(id), 'the form has no field with id ' + id);
  eq(FW.GITHUB_TEMPLATE, 'feedback.yml');
  assert(/required:\s*true/.test(src.slice(src.indexOf('id: privacy'))), 'the privacy box must be required');
  assert(/public/i.test(src), 'the form must say that issues are public');
});

test('the live page hands feedback.js its safe-key list and share-link builder', () => {
  if (IS_NODE) return;   // browser only: the node test above checks the same wiring in the source
  const cfg = window.FeedbackWidget.config();
  assert(Array.isArray(cfg.safeKeys) && cfg.safeKeys.length > 20, 'safeKeys missing');
  assert(typeof cfg.getPlanUrl === 'function', 'getPlanUrl missing');
  assert(!cfg.safeKeys.includes('i1') && !cfg.safeKeys.includes('sg'), 'a balance or spending key is marked safe');
  const pinned = typeof cfg.pinnedSettings === 'function' ? cfg.pinnedSettings() : {};
  assert(/^[A-Z]{2}$/.test(pinned.s || ''), 'the state is not pinned: ' + JSON.stringify(pinned));
});

test('the dialog and the Worker agree on addresses and limits', () => {
  if (!IS_NODE) return;
  const W = _worker();
  eq(String(FW.ADDRESS), String(W.ADDRESS), 'the two address patterns have drifted apart');
  for (const a of GOOD_ADDRESSES.concat(BAD_ADDRESSES)) eq(W.validAddress(a), FW.validReplyTo(a), JSON.stringify(a));
  eq(FW.LIMITS.message, W.LIMITS.message, 'message length');
  assert(FW.LIMITS.imageBytes <= W.LIMITS.imageBytes, 'the dialog aims above what the Worker accepts');
  assert(FW.LIMITS.errors <= W.LIMITS.errors && FW.LIMITS.errorText <= W.LIMITS.text, 'page error limits');
});

// ── The Worker ────────────────────────────────────────────────────────────────────────────────────

const LIVE = 'https://tools.netcitizen.us';
const IDS = { messageId: 'abc123@tools.example.com', boundary: '=_fb_abc123', date: new Date(Date.UTC(2026, 8, 17, 14, 3, 0)) };

function workerEnv(over) {
  return Object.assign({
    ALLOWED_ORIGINS: LIVE,
    ALLOW_LOCALHOST: '1',
    FEEDBACK_TO: 'owner@example.com',
    FEEDBACK_FROM: 'feedback@tools.example.com',
    TURNSTILE_SECRET: 'live-secret',
    DAILY_LIMIT: '50',
  }, over || {});
}

// A Durable Object's storage, as a Map.
function memoryStore() {
  const map = new Map();
  return {
    map,
    get: async key => map.get(key),
    put: async (key, value) => { map.set(key, value); },
  };
}

function jpegDataUrl(bytes) {
  const body = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(bytes - 4, 7)]);
  return 'data:image/jpeg;base64,' + body.toString('base64');
}

function report(over) {
  return Object.assign({
    v: 1,
    tool: 'Retirement Optimizer',
    version: '11.1867',
    page: LIVE + '/retirement_optimizer.html',
    message: 'The chart is blank.',
    replyTo: 'pat@example.com',
    settings: 'str=ordered&s=CA',
    withheld: ['IRA1', 'spendGoal'],
    errors: ['TypeError: x @ optimizer_ui.js:12'],
    planUrl: null,
    screenshot: null,
    env: { ua: 'Mozilla/5.0', viewport: '1280x720', dpr: '1.5', tab: 'Charts' },
    turnstile: 'token-123',
  }, over || {});
}

function mimeOf(over) {
  const W = _worker();
  const env = workerEnv();
  const r = W.validatePayload(report(over), env);
  if (!r.ok) throw new Error('fixture refused: ' + r.code);
  return W.composeEmail(r.clean, env, IDS);
}

function headersOf(mime) {
  return mime.slice(0, mime.indexOf('\r\n\r\n'));
}

test('Worker: only our own page origin is accepted, by exact match', () => {
  if (!IS_NODE) return;
  const W = _worker();
  const env = workerEnv();
  assert(W.checkOrigin(LIVE, env));
  for (const o of [LIVE + '.evil.test', 'http://tools.netcitizen.us', LIVE + '/', 'https://evil.test', 'null', '', undefined]) {
    assert(!W.checkOrigin(o, env), 'accepted ' + o);
  }
  assert(W.checkOrigin('http://localhost:8767', env) && W.checkOrigin('http://127.0.0.1', env), 'localhost while allowed');
  assert(!W.checkOrigin('http://localhost:8767', workerEnv({ ALLOW_LOCALHOST: '0' })), 'localhost while not allowed');
  assert(!W.checkOrigin('http://localhost.evil.test', env) && !W.checkOrigin('https://localhost:8767', env), 'localhost lookalikes');
});

test('Worker: CORS headers name the caller only when it is allowed', () => {
  if (!IS_NODE) return;
  const W = _worker();
  const ok = W.corsHeaders(LIVE, workerEnv());
  eq(ok['Access-Control-Allow-Origin'], LIVE);
  eq(ok['Access-Control-Allow-Headers'], 'Content-Type');
  eq(ok['Vary'], 'Origin');
  const no = W.corsHeaders('https://evil.test', workerEnv());
  eq(no['Access-Control-Allow-Origin'], undefined);
  eq(no['Vary'], 'Origin');
});

test('Worker: a screenshot must be a real JPEG of at most a megabyte', () => {
  if (!IS_NODE) return;
  const W = _worker();
  const env = workerEnv();
  assert(W.validatePayload(report({ screenshot: jpegDataUrl(5000) }), env).ok, 'a small JPEG');
  assert(W.validatePayload(report({ screenshot: jpegDataUrl(W.LIMITS.imageBytes) }), env).ok, 'exactly at the limit');
  const png = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2]).toString('base64');
  const svg = 'data:image/jpeg;base64,' + Buffer.from('<svg onload=x>').toString('base64');
  const broken = jpegDataUrl(300).replace(/.{8}$/, 'A\r\n--x--');
  const cases = [['png', png], ['not a jpeg', svg], ['broken base64', broken], ['too large', jpegDataUrl(W.LIMITS.imageBytes + 1)]];
  for (const [what, s] of cases) eq(W.validatePayload(report({ screenshot: s }), env).code, 'screenshot', what);
});

test('Worker: links must lead back to our own pages, and settings must be a plain query', () => {
  if (!IS_NODE) return;
  const W = _worker();
  const env = workerEnv();
  const code = over => W.validatePayload(report(over), env).code;
  eq(code({ planUrl: 'https://evil.test/retirement_optimizer.html?i1=5' }), 'planUrl');
  eq(code({ planUrl: 'https://tools.netcitizen.us@evil.test/x' }), 'planUrl');
  eq(code({ planUrl: 'javascript:alert(1)//https://tools.netcitizen.us/' }), 'planUrl');
  eq(code({ planUrl: LIVE + '/r.html?a=1 b' }), 'planUrl');
  eq(code({ page: LIVE + '/retirement_optimizer.html?i1=5' }), 'page');
  eq(code({ settings: 'str=a\r\nBcc: x' }), 'settings');
  eq(code({ withheld: ['IRA1', 'bad name'] }), 'withheld');
  assert(W.validatePayload(report({ planUrl: LIVE + '/retirement_optimizer.html?i1=1.5e6&str=ordered' }), env).ok, 'our own link');
  assert(W.validatePayload(report({ page: 'http://localhost:8767/retirement_optimizer.html' }), env).ok, 'a local page while localhost is allowed');
});

test('Worker: messages are required, errors are capped, and unknown fields are dropped', () => {
  if (!IS_NODE) return;
  const W = _worker();
  const env = workerEnv();
  const code = over => W.validatePayload(report(over), env).code;
  eq(code({ errors: ['a', 'b', 'c', 'd', 'e', 'f'] }), 'errors');
  eq(code({ errors: [{}] }), 'errors');
  eq(code({ message: ' \n\t ' }), 'message');
  eq(code({ message: 'x'.repeat(W.LIMITS.message + 1) }), 'message');
  eq(code({ replyTo: 'a@b.com\r\nBcc: c@d.com' }), 'replyTo');
  eq(code({ v: 2 }), 'version');
  eq(W.validatePayload([], env).code, 'payload');
  const r = W.validatePayload(report({ bcc: 'x@evil.test', env: { ua: 'A\r\nB', extra: 'no' } }), env);
  assert(r.ok, r.code);
  assert(!('bcc' in r.clean) && !('extra' in r.clean.env), 'an unknown field survived');
  eq(r.clean.env.ua, 'A B');
});

test('Worker: the email uses CRLF only, and message text cannot start a header', () => {
  if (!IS_NODE) return;
  const mime = mimeOf({ message: 'Hi\r\nBcc: victim@evil.test\nSubject: pwned\rX: y' });
  assert(!/(^|[^\r])\n|\r(?!\n)/.test(mime), 'a bare LF or a bare CR');
  const names = headersOf(mime).split('\r\n').filter(l => !/^[ \t]/.test(l)).map(l => l.split(':')[0]);
  deepEq(names, ['From', 'To', 'Reply-To', 'Subject', 'Date', 'Message-ID', 'MIME-Version',
                 'Content-Type', 'Content-Transfer-Encoding']);
});

// The Subject field's physical lines: the first without its name, then each continuation.
function subjectLines(mime) {
  const lines = headersOf(mime).split('\r\n');
  const at = lines.findIndex(l => l.startsWith('Subject: '));
  const out = [lines[at].slice('Subject: '.length)];
  for (let i = at + 1; lines[i] && lines[i][0] === ' '; i++) out.push(lines[i].slice(1));
  return out;
}

test('Worker: a subject is folded or encoded so that no line is too long', () => {
  if (!IS_NODE) return;
  const message = 'Größe falsch – 税金 ' + 'é'.repeat(80);
  const mime = mimeOf({ message });
  const bytes = subjectLines(mime).map(w => {
    const m = w.match(/^=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=$/);
    assert(m, 'not an encoded word: ' + w);
    return Buffer.from(m[1], 'base64');
  });
  const expected = '[Feedback] Retirement Optimizer 11.1867: ' + Array.from(message).slice(0, 60).join('') + '...';
  eq(Buffer.concat(bytes).toString('utf8'), expected);
  for (const line of mime.split('\r\n')) {
    if (line.includes('=?UTF-8?B?')) assert(line.length <= 76, 'an encoded header line of ' + line.length);
  }
  const body = mime.slice(mime.indexOf('\r\n\r\n') + 4);
  assert(body.split('\r\n').every(l => l.length <= 76), 'a body line over 76 characters');

  // Plain ASCII folds at spaces and unfolds to exactly the subject it started as.
  const words = 'The Monte Carlo tab shows a blank chart after switching the scale twice';
  const ascii = mimeOf({ message: words, screenshot: jpegDataUrl(900) });
  eq(subjectLines(ascii).join(' '), '[Feedback] Retirement Optimizer 11.1867: ' + words.slice(0, 60) + '...');
  assert(subjectLines(ascii).length > 1, 'a long subject should fold');
  for (const mimeText of [mime, ascii]) {
    const over = headersOf(mimeText).split('\r\n').filter(l => l.length > 78);
    assert(!over.length, 'header lines over 78 characters: ' + over.join(' | '));
  }
});

test('Worker: the screenshot is attached only when there is one', () => {
  if (!IS_NODE) return;
  const plain = mimeOf({});
  assert(headersOf(plain).includes('Content-Type: text/plain; charset=utf-8'), 'one text part');
  assert(!headersOf(plain).includes('multipart') && !plain.includes('screenshot.jpg'), 'no attachment');
  const shot = jpegDataUrl(3000);
  const mixed = mimeOf({ screenshot: shot });
  assert(headersOf(mixed).includes('Content-Type: multipart/mixed; boundary="=_fb_abc123"'), 'multipart');
  const parts = mixed.split('\r\n--=_fb_abc123');
  eq(parts.length, 4, 'headers, text, image, closing delimiter');
  assert(parts[2].includes('Content-Type: image/jpeg; name="screenshot.jpg"'), 'the image part');
  eq(parts[3], '--\r\n', 'the closing delimiter');
  eq(parts[2].split('\r\n\r\n')[1].replace(/\r\n/g, ''), shot.slice('data:image/jpeg;base64,'.length),
    'the attachment is the image, byte for byte');
});

test('Worker: the email body lists withheld names and marks what was left out', () => {
  if (!IS_NODE) return;
  const W = _worker();
  const r = W.validatePayload(report({ errors: null }), workerEnv());
  const text = W.formatBody(r.clean, { received: IDS.date });
  assert(text.includes('Withheld: IRA1, spendGoal'), text);
  assert(text.includes('Link: ' + LIVE + '/retirement_optimizer.html?str=ordered&s=CA'), text);
  assert(/Full plan link\n-+\n\(not included\)/.test(text), 'the plan link is marked absent');
  assert(/Page errors\n-+\n\(not included\)/.test(text), 'page errors are marked absent');
  assert(text.includes('Received: 2026-09-17 14:03 UTC'), text);
  assert(text.includes('Reply to: pat@example.com'), text);
});

test('Worker: the bot check needs success, our hostname and the feedback action', () => {
  if (!IS_NODE) return;
  const W = _worker();
  const env = workerEnv();
  const good = { success: true, hostname: 'tools.netcitizen.us', action: 'feedback' };
  assert(W.turnstileOk(good, env, LIVE));
  assert(!W.turnstileOk(Object.assign({}, good, { success: false }), env, LIVE), 'failed');
  assert(!W.turnstileOk(Object.assign({}, good, { hostname: 'evil.test' }), env, LIVE), 'foreign host');
  assert(!W.turnstileOk(Object.assign({}, good, { action: 'login' }), env, LIVE), 'another action');
  assert(!W.turnstileOk(null, env, LIVE), 'no answer');
  const local = Object.assign({}, good, { hostname: 'localhost' });
  assert(W.turnstileOk(local, env, 'http://localhost:8767'), 'a local page');
  assert(!W.turnstileOk(local, workerEnv({ ALLOW_LOCALHOST: '0' }), LIVE), 'localhost while not allowed');
});

test('Worker: a Turnstile test secret passes a local page and never the live site', () => {
  if (!IS_NODE) return;
  const W = _worker();
  const secret = { TURNSTILE_SECRET: '1x0000000000000000000000000000000AA' };
  const dummy = { success: true, hostname: 'example.com', action: 'test' };
  assert(W.turnstileOk(dummy, workerEnv(secret), 'http://127.0.0.1:8767'), 'local');
  assert(!W.turnstileOk(dummy, workerEnv(secret), LIVE), 'live');
  assert(!W.turnstileOk(dummy, workerEnv(Object.assign({ ALLOW_LOCALHOST: '0' }, secret)), 'http://127.0.0.1:8767'),
    'local while localhost is off');
});

// ── The Worker's request path, with stand-ins for Cloudflare ──────────────────────────────────────

function fakeCloudflare(opts) {
  const o = opts || {};
  const sent = [], verified = [], limited = [];
  const env = workerEnv(o.env);
  if (!o.noSend) {
    env.SEND = {
      send: async m => {
        if (o.sendFails) throw new Error('mail refused');
        sent.push(m);
      },
    };
  }
  if (!o.noRL) {
    env.RL = { limit: async a => { limited.push(a.key); return { success: !o.rateLimited }; } };
  }
  const store = memoryStore();
  const taken = [];
  if (!o.noCounter) {
    env.COUNTER = {
      idFromName: name => 'id:' + name,
      get: id => ({
        take: async (day, limit) => {
          if (o.counterDown) throw new Error('storage unavailable');
          taken.push({ id, day, limit });
          return _worker().takeFromStore(store, day, limit);
        },
      }),
    };
  }
  const deps = {
    EmailMessage: class {
      constructor(from, to, raw) { this.from = from; this.to = to; this.raw = raw; }
    },
    fetch: async (url, init) => {
      verified.push({ url, body: JSON.parse(init.body) });
      if (o.verifyDown) throw new Error('offline');
      return { json: async () => o.verdict || { success: true, hostname: 'tools.netcitizen.us', action: 'feedback' } };
    },
    uuid: () => '0f0e0d0c-0b0a-4908-8706-050403020100',
    now: () => new Date(IDS.date.getTime()),
  };
  return { env, deps, sent, verified, limited, taken, store };
}

function request(opts) {
  const o = opts || {};
  const headers = Object.assign({
    'Origin': LIVE,
    'Content-Type': 'application/json',
    'CF-Connecting-IP': '203.0.113.9',
  }, o.headers || {});
  Object.keys(headers).forEach(k => { if (headers[k] === null) delete headers[k]; });
  const method = o.method || 'POST';
  const body = method === 'POST'
    ? (o.body !== undefined ? o.body : JSON.stringify(report(o.payload)))
    : undefined;
  return new Request('https://feedback.netcitizen.us/', { method, headers, body });
}

async function handled(req, cf) {
  const res = await _worker().handle(req, cf.env, cf.deps);
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

test('Worker: the browser preflight is answered for our page and refused for others', () => {
  if (!IS_NODE) return;
  return (async () => {
    const cf = fakeCloudflare();
    const ok = await handled(request({ method: 'OPTIONS' }), cf);
    eq(ok.status, 204);
    eq(ok.headers.get('Access-Control-Allow-Origin'), LIVE);
    eq(ok.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
    const no = await handled(request({ method: 'OPTIONS', headers: { Origin: 'https://evil.test' } }), cf);
    eq(no.status, 403);
    eq(no.headers.get('Access-Control-Allow-Origin'), null);
    eq(cf.limited.length + cf.sent.length, 0, 'a preflight must not count or send');
  })();
});

test('Worker: a wrong method, origin, type or size is refused before anything is checked or sent', () => {
  if (!IS_NODE) return;
  return (async () => {
    const cf = fakeCloudflare();
    const cases = [
      [405, 'method', request({ method: 'GET' })],
      [403, 'origin', request({ headers: { Origin: LIVE + '.evil.test' } })],
      [403, 'origin', request({ headers: { Origin: null } })],
      [415, 'type', request({ headers: { 'Content-Type': 'text/plain' } })],
      [415, 'type', request({ headers: { 'Content-Type': 'application/jsonp' } })],
      [413, 'size', request({ headers: { 'Content-Length': '2000000' } })],
      [413, 'size', request({ body: JSON.stringify(report({ padding: 'y'.repeat(1700000) })) })],
      [400, 'json', request({ body: '{"v":1,' })],
    ];
    for (const [status, code, req] of cases) {
      const r = await handled(req, cf);
      eq(r.status, status, code);
      eq(r.body && r.body.error, code, 'the code for ' + status);
    }
    eq(cf.sent.length, 0, 'nothing may be sent');
    eq(cf.verified.length, 0, 'no refused request may reach Turnstile');
  })();
});

test('Worker: a missing address, secret or binding fails closed', () => {
  if (!IS_NODE) return;
  return (async () => {
    const setups = [
      { env: { FEEDBACK_TO: '' } },
      { env: { FEEDBACK_FROM: 'not an address' } },
      { env: { TURNSTILE_SECRET: '' } },
      { env: { ALLOWED_ORIGINS: '' }, },
      { env: { DAILY_LIMIT: '0' } },
      { env: { DAILY_LIMIT: undefined } },
      { noSend: true },
      { noRL: true },
      { noCounter: true },
    ];
    for (const setup of setups) {
      const cf = fakeCloudflare(setup);
      const r = await handled(request(setup.env && setup.env.ALLOWED_ORIGINS === '' ? { headers: { Origin: 'http://localhost:8767' } } : {}), cf);
      eq(r.status, 500, JSON.stringify(setup));
      eq(r.body.error, 'config');
      eq(cf.sent.length, 0);
    }
  })();
});

test('Worker: the rate limit counts per sender address and stops the send', () => {
  if (!IS_NODE) return;
  return (async () => {
    const cf = fakeCloudflare({ rateLimited: true });
    const r = await handled(request(), cf);
    eq(r.status, 429);
    eq(r.body.error, 'rate');
    deepEq(cf.limited, ['203.0.113.9']);
    eq(cf.sent.length + cf.verified.length, 0);
  })();
});

test('Worker: an invalid report or a failed bot check sends nothing', () => {
  if (!IS_NODE) return;
  return (async () => {
    const invalid = fakeCloudflare();
    const r1 = await handled(request({ payload: { replyTo: 'x@y.com\r\nBcc: z@w.com' } }), invalid);
    eq(r1.status, 400);
    eq(r1.body.error, 'replyTo');
    eq(invalid.verified.length, 0, 'validation comes before the bot check');

    const noToken = fakeCloudflare();
    const r2 = await handled(request({ payload: { turnstile: '' } }), noToken);
    eq(r2.status, 403);
    eq(r2.body.error, 'bot');
    eq(noToken.verified.length, 0, 'no token, no call to Cloudflare');

    const refused = fakeCloudflare({ verdict: { success: false, 'error-codes': ['invalid-input-response'] } });
    const r3 = await handled(request(), refused);
    eq(r3.status, 403);
    eq(r3.body.error, 'bot');
    deepEq(refused.verified[0].body, { secret: 'live-secret', response: 'token-123', remoteip: '203.0.113.9' });

    const down = fakeCloudflare({ verifyDown: true });
    const r4 = await handled(request(), down);
    eq(r4.status, 502);
    eq(r4.body.error, 'verify');

    for (const cf of [invalid, noToken, refused, down]) eq(cf.sent.length, 0, 'nothing may be sent');
  })();
});

test('Worker: the daily limit is exact and starts again the next day', () => {
  if (!IS_NODE) return;
  return (async () => {
    const W = _worker();
    const store = memoryStore();
    const answers = [];
    for (let i = 0; i < 4; i++) answers.push(await W.takeFromStore(store, '2026-09-17', 3));
    deepEq(answers, [true, true, true, false]);
    eq(await W.takeFromStore(store, '2026-09-18', 3), true, 'a new day starts from zero');
    eq(store.map.size, 1, 'one key, overwritten each day');
    deepEq(store.map.get('today'), { day: '2026-09-18', used: 1 });
    eq(W.dailyLimit({ DAILY_LIMIT: '50' }), 50);
    for (const bad of [undefined, '', '0', '-1', '2.5', 'many', '10001']) {
      eq(W.dailyLimit({ DAILY_LIMIT: bad }), 0, 'DAILY_LIMIT ' + JSON.stringify(bad));
    }
  })();
});

test('Worker: a full day refuses every report and sends nothing, and only a passed bot check counts', () => {
  if (!IS_NODE) return;
  return (async () => {
    const cf = fakeCloudflare({ env: { DAILY_LIMIT: '2' } });
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await handled(request(), cf)).status);
    deepEq(statuses, [200, 200, 429]);
    eq(cf.sent.length, 2, 'exactly the limit was sent');
    eq((await handled(request(), cf)).body.error, 'daily');
    deepEq(cf.taken[0], { id: 'id:daily', day: '2026-09-17', limit: 2 });

    const bot = fakeCloudflare({ env: { DAILY_LIMIT: '2' }, verdict: { success: false } });
    await handled(request(), bot);
    eq(bot.taken.length, 0, 'a failed bot check must not use up the day');

    const down = fakeCloudflare({ counterDown: true });
    const r = await handled(request(), down);
    eq(r.status, 503);
    eq(r.body.error, 'busy');
    eq(down.sent.length, 0, 'no count, no send');
  })();
});

test('Worker: a good report sends one email to the configured inbox, with Reply-To and the screenshot', () => {
  if (!IS_NODE) return;
  return (async () => {
    const cf = fakeCloudflare();
    const shot = jpegDataUrl(2000);
    const plan = LIVE + '/retirement_optimizer.html?i1=1.5e6';
    const r = await handled(request({ payload: { screenshot: shot, planUrl: plan } }), cf);
    eq(r.status, 200);
    eq(r.body.ok, true);
    eq(cf.sent.length, 1);
    const m = cf.sent[0];
    eq(m.from, 'feedback@tools.example.com');
    eq(m.to, 'owner@example.com');
    const head = headersOf(m.raw);
    assert(head.includes('\r\nTo: <owner@example.com>\r\n'), 'To');
    assert(head.includes('\r\nReply-To: <pat@example.com>\r\n'), 'Reply-To');
    assert(head.includes('\r\nMessage-ID: <0f0e0d0c-0b0a-4908-8706-050403020100@tools.example.com>\r\n'), 'Message-ID');
    assert(head.includes('\r\nDate: Thu, 17 Sep 2026 14:03:00 +0000\r\n'), 'Date');
    const parts = m.raw.split('\r\n--=_fb_0f0e0d0c0b0a490887060504');
    eq(parts.length, 4, 'a text part and an image part');
    const text = Buffer.from(parts[1].split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
    assert(text.includes('The chart is blank.'), text);
    assert(text.includes(plan), 'the plan link, because it was included');
    assert(!text.includes('203.0.113.9'), 'the sender IP must never be written into the email');
    eq(parts[2].split('\r\n\r\n')[1].replace(/\r\n/g, ''), shot.slice('data:image/jpeg;base64,'.length),
      'the screenshot, byte for byte');
  })();
});

test('Worker: a failed send is reported, and every reply is readable by the page and echoes nothing', () => {
  if (!IS_NODE) return;
  return (async () => {
    const r = await handled(request(), fakeCloudflare({ sendFails: true }));
    eq(r.status, 502);
    eq(r.body.error, 'send');
    const replies = [request(), request({ headers: { 'Content-Type': 'text/plain' } }), request({ body: '[' }),
                     request({ payload: { replyTo: 'bad address' } })];
    for (const req of replies) {
      const res = await handled(req, fakeCloudflare({ sendFails: true }));
      eq(res.headers.get('Access-Control-Allow-Origin'), LIVE, 'status ' + res.status);
      eq(res.headers.get('Cache-Control'), 'no-store', 'status ' + res.status);
      const said = JSON.stringify(res.body);
      assert(!said.includes('pat@example.com') && !said.includes('bad address'), 'a reply echoed the request: ' + said);
    }
  })();
});

async function runFeedbackTests() {
  passed = 0;
  failed = 0;
  const failures = [];
  for (const [name, fn] of TESTS) {
    try {
      await fn();
      console.log(`  ✓  ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ✗  ${name}`);
      console.log(`       ${e.message}`);
      failures.push(`${name}: ${e.message}`);
      failed++;
    }
  }
  console.log('');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(failed > 0 ? '\n*** SOME TESTS FAILED ***' : 'All tests passed.');
  return { passed, failed, skipped: 0, total: TESTS.length, failures };
}

if (IS_NODE) {
  module.exports = { runFeedbackTests, TEST_COUNT: TESTS.length };
  runFeedbackTests().then(r => { if (r.failed > 0) process.exitCode = 1; });
} else {
  window.runFeedbackTests = runFeedbackTests;
  window.FEEDBACK_TEST_COUNT = TESTS.length;
}

})();
