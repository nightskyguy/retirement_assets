/* feedback.js - the "Send feedback" dialog.

   Shared the way doclinks.js is. The pure half decides what a report contains and what it
   withholds; it is plain functions that feedback.tests.js runs under node. The dialog is built the
   first time someone opens it, so a visit that never does pays for two error listeners and nothing
   else.

   Where a report goes: a Cloudflare Worker (.feedback-worker/ in this repo) checks it and emails it
   to the author. The address lives only in that Worker's secrets, never in a page. The dialog also
   links to the repo's public GitHub issue form, filled with the message, version and browser only.

   What a report contains is the person's choice, made in the dialog, and "Show exactly what will be
   sent" prints it before anything leaves the browser:
     always      tool, version, page address WITHOUT its query, browser, window size, open tab
     settings    (ticked) the page's pinned values (the state), the share-link keys the page marks
                 safe, the NAMES of the rest, and up to five page errors with every run of 3+ digits
                 masked
     plan link   (unticked) the whole share link, numbers and all
     screenshot  (unticked) a JPEG of what is on screen behind the dialog
     email       (optional) used only as the reply address

   Load it WITHOUT defer and early in <head>: the error listeners have to exist before the page's
   own scripts run. Nothing else here touches the page until FeedbackWidget.open(). */
(function () {
  'use strict';

  // ── Settings ─────────────────────────────────────────────────────────────────────────────────

  const ENDPOINT = 'https://feedback.netcitizen.us/';
  // Turnstile site key. Public by design: it names the widget and authorizes nothing. Left empty
  // the dialog says sending is not set up, rather than failing at the last step.
  const SITE_KEY = '0x4AAAAAAE6xgA7I3EIE8i01';
  // ?fbdev, honored only on a page served from localhost: post to `npx wrangler dev` and use
  // Cloudflare's always-pass test key. See .feedback-worker/README.md.
  const DEV_ENDPOINT = 'http://localhost:8787/';
  const DEV_SITE_KEY = '1x00000000000000000000AA';
  const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  // Pinned and hash-checked: the browser refuses the file if a single byte differs. MIT licensed.
  const CAPTURE_SRC = 'https://cdn.jsdelivr.net/npm/html2canvas-pro@2.4.3/dist/html2canvas-pro.min.js';
  const CAPTURE_SRI = 'sha256-Ite1VTBCauBlJ0giW6H+3MsgfsnaDf+DpS3t1vviRhE=';
  const README_SECTION = 'README.md#sending-feedback';
  const LIVE_SITE = 'https://tools.netcitizen.us/';
  // The public alternative: the repo's issue form, .github/ISSUE_TEMPLATE/feedback.yml. The link
  // fills its fields by their ids.
  const GITHUB_NEW_ISSUE = 'https://github.com/nightskyguy/retirement_assets/issues/new';
  const GITHUB_TEMPLATE = 'feedback.yml';
  const GITHUB_FIELDS = Object.freeze({ message: 'what', version: 'version', browser: 'browser' });

  const LIMITS = Object.freeze({
    message: 5000,        // .feedback-worker/src/logic.cjs refuses anything longer
    address: 254,
    errors: 5,
    errorText: 300,
    imageBytes: 900000,   // the Worker accepts up to 1,000,000
    fieldName: 60,
    tool: 60,
    version: 20,
    githubMessage: 6000,  // encoded characters of the message a GitHub link carries; links have a length limit
    timeoutMs: 20000,
  });

  // Same pattern as ADDRESS in .feedback-worker/src/logic.cjs; feedback.tests.js checks they agree.
  const ADDRESS = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

  // ── Pure (node-testable) ─────────────────────────────────────────────────────────────────────

  // The query part of a URL, without "?" and without any #fragment.
  function queryOf(url) {
    const s = String(url || '');
    const q = s.indexOf('?');
    if (q === -1) return '';
    const rest = s.slice(q + 1);
    const h = rest.indexOf('#');
    return h === -1 ? rest : rest.slice(0, h);
  }

  // Keeps the keys in safeKeys, in their original order, and lists every other key once by name.
  // An unknown key is withheld: the default is private.
  function splitQuery(query, safeKeys) {
    const safe = new Set(safeKeys || []);
    const params = new URLSearchParams(String(query || '').replace(/^\?/, ''));
    const kept = new URLSearchParams();
    const withheld = [];
    params.forEach((value, key) => {
      if (safe.has(key)) kept.append(key, value);
      else if (withheld.indexOf(key) === -1) withheld.push(key);
    });
    return { settings: kept.toString(), withheld };
  }

  // The readable name of a withheld key, reduced to the characters the Worker accepts.
  function fieldName(key, keyNames) {
    const named = keyNames && Object.prototype.hasOwnProperty.call(keyNames, key) ? keyNames[key] : key;
    return String(named).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, LIMITS.fieldName) || '_';
  }

  function pageAddress(href) {
    const s = String(href || '');
    const cut = s.search(/[?#]/);
    return cut === -1 ? s : s.slice(0, cut);
  }

  // An empty field is valid: the address is optional.
  function validReplyTo(s) {
    if (typeof s !== 'string') return false;
    const t = s.trim();
    return t === '' || (t.length <= LIMITS.address && ADDRESS.test(t));
  }

  // An error message can quote a value. Any run of three or more digits could be a dollar amount or
  // a year, so it is masked; the script location is added afterwards and keeps its line number.
  function maskDigits(s) {
    return String(s).replace(/\d{3,}/g, m => '#'.repeat(m.length));
  }

  // One page error as a short line. Only the script's FILE NAME is kept: an inline script reports
  // the page's own URL, query string and all, and that query can hold the whole plan.
  function errorLine(message, filename, line, col) {
    let text = maskDigits(String(message || 'Error')).replace(/\s+/g, ' ').trim();
    const where = pageAddress(filename).split('/').pop();
    if (where) text += ' @ ' + where + (line ? ':' + line + (col ? ':' + col : '') : '');
    return text.slice(0, LIMITS.errorText);
  }

  function normalizeMessage(m) {
    return String(m || '').replace(/\r\n?/g, '\n').trim();
  }

  // '' when the message can be sent, else 'empty' or 'long'.
  function messageProblem(m) {
    const t = normalizeMessage(m);
    if (!t) return 'empty';
    return t.length > LIMITS.message ? 'long' : '';
  }

  // The settings to send: the page's pinned values first (the state, which the share link leaves out
  // while it is at its default), then the safe keys of the share link. A pinned key the page has not
  // marked safe is dropped, like any other.
  function settingsWith(settings, pinned, safeKeys) {
    const safe = new Set(safeKeys || []);
    const kept = new URLSearchParams(settings);
    const out = new URLSearchParams();
    Object.keys(pinned || {}).forEach(key => {
      const value = pinned[key];
      if (safe.has(key) && !kept.has(key) && value != null && value !== '') out.append(key, String(value));
    });
    kept.forEach((value, key) => out.append(key, value));
    return out.toString();
  }

  // s:   { message, replyTo, includeSettings, includePlan, shareUrl, errors, screenshot, turnstile,
  //        href, env }
  // cfg: { tool, version, safeKeys, keyNames, pinned }
  // null in the result means "not included". shareUrl is read only for what the ticks allow.
  function buildPayload(s, cfg) {
    const c = cfg || {};
    const p = {
      v: 1,
      tool: String(c.tool || 'Unknown tool').slice(0, LIMITS.tool),
      version: String(c.version || '').slice(0, LIMITS.version),
      page: pageAddress(s.href),
      message: normalizeMessage(s.message),
      replyTo: String(s.replyTo || '').trim(),
      settings: null,
      withheld: null,
      errors: null,
      planUrl: null,
      screenshot: s.screenshot || null,
      env: s.env || {},
      turnstile: String(s.turnstile || ''),
    };
    if (s.includeSettings) {
      const split = splitQuery(queryOf(s.shareUrl), c.safeKeys);
      p.settings = settingsWith(split.settings, c.pinned, c.safeKeys);
      p.withheld = split.withheld.map(k => fieldName(k, c.keyNames))
        .filter((n, i, all) => all.indexOf(n) === i);
      p.errors = (s.errors || []).slice(-LIMITS.errors);
    }
    if (s.includePlan && s.shareUrl) p.planUrl = String(s.shareUrl);
    return p;
  }

  // A link to the repo's public issue form with the message, version and browser filled in. Never
  // the settings, the plan link or the screenshot: anyone can read an issue.
  function githubIssueUrl(p) {
    const message = normalizeMessage(p.message);
    const flat = Array.from(message.replace(/\s+/g, ' '));
    const q = new URLSearchParams();
    q.set('template', GITHUB_TEMPLATE);
    q.set('title', '[Feedback] ' + flat.slice(0, 60).join('') + (flat.length > 60 ? '...' : ''));
    if (message) {
      // Cut by ENCODED length: one character can take nine once it is in a link.
      let kept = '';
      let size = 0;
      let cut = false;
      for (const ch of message) {
        size += encodeURIComponent(ch).length;
        if (size > LIMITS.githubMessage) { cut = true; break; }
        kept += ch;
      }
      q.set(GITHUB_FIELDS.message, cut ? kept + '\n\n(Shortened: the rest did not fit in the link.)' : message);
    }
    if (p.version) q.set(GITHUB_FIELDS.version, String(p.version));
    if (p.env && p.env.ua) q.set(GITHUB_FIELDS.browser, String(p.env.ua));
    return GITHUB_NEW_ISSUE + '?' + q.toString();
  }

  function dataUrlBytes(url) {
    const s = String(url || '');
    const comma = s.indexOf(',');
    if (comma === -1) return 0;
    const b64 = s.slice(comma + 1);
    const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
    return Math.floor(b64.length * 3 / 4) - pad;
  }

  function kb(bytes) {
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }

  // The preview. It lists every field the payload carries; the screenshot appears as its size, and
  // the spam-check token as a mention, since neither means anything to read.
  function describePayload(p) {
    const out = [];
    out.push('Message:');
    (p.message ? p.message.split('\n') : ['(empty)']).forEach(line => out.push('  ' + line));
    out.push('Your email: ' + (p.replyTo || '(none)'));
    if (p.settings === null) {
      out.push('Settings: (not included)');
      out.push('Page errors: (not included)');
    } else {
      out.push('Settings: ' + (p.settings || '(all at their defaults)'));
      out.push('Withheld, names only: ' + (p.withheld.length ? p.withheld.join(', ') : '(none)'));
      out.push('Page errors: ' + (p.errors.length ? '' : '(none)'));
      p.errors.forEach(e => out.push('  - ' + e));
    }
    out.push('Full plan link: ' + (p.planUrl || '(not included)'));
    out.push('Screenshot: ' + (p.screenshot ? kb(dataUrlBytes(p.screenshot)) + ' image' : '(not included)'));
    out.push('Tool: ' + p.tool + (p.version ? ' ' + p.version : ''));
    out.push('Page: ' + p.page);
    const e = p.env || {};
    out.push('Window: ' + (e.viewport || '?') + (e.dpr ? ' at ' + e.dpr + 'x' : ''));
    out.push('Tab: ' + (e.tab || '?'));
    out.push('Browser: ' + (e.ua || '?'));
    out.push('Spam check: a one-time token from Cloudflare Turnstile');
    return out.join('\n');
  }

  // Where to send, and whether sending can work from this page at all. problem is '' when it can,
  // 'file' for a page opened from disk (Turnstile does not run there), or 'setup' when there is no
  // site key. ?fbdev is honored only on a page served from localhost, so a crafted link cannot
  // point someone's report somewhere else.
  function resolveEndpoint(loc, siteKey) {
    const key = siteKey === undefined ? SITE_KEY : siteKey;
    const web = loc.protocol === 'https:' || loc.protocol === 'http:';
    const local = web && /^(localhost|127\.0\.0\.1)$/.test(loc.hostname);
    const dev = local && new URLSearchParams(loc.search || '').has('fbdev');
    const route = {
      endpoint: dev ? DEV_ENDPOINT : ENDPOINT,
      siteKey: dev ? DEV_SITE_KEY : key,
      dev,
      problem: '',
    };
    if (!web) route.problem = 'file';
    else if (!route.siteKey) route.problem = 'setup';
    return route;
  }

  // What to tell the person when the Worker refuses. The code comes from the server, so only
  // letters are kept before it is shown.
  function failureText(status, code) {
    const c = String(code || '').replace(/[^A-Za-z]/g, '').slice(0, 20) || String(status);
    if (status === 429 && c === 'daily') {
      return 'Feedback is full for today. Try again tomorrow, or open an issue on GitHub with the link above.';
    }
    if (status === 429) return 'Too many messages in a short time. Wait a minute, then try again.';
    if (status === 413) return 'This is too large to send. Remove the screenshot and try again.';
    if (status === 403 && c === 'bot') return 'The spam check did not pass. Try again.';
    if (status === 403) return 'Feedback can only be sent from the tools.netcitizen.us site.';
    if (status === 400) return 'The feedback service turned this message down (' + c + '). Your message is still here.';
    return 'The feedback service had a problem (' + c + '). Your message is still here; try again later.';
  }

  // ── Page errors, collected from the moment this file loads ───────────────────────────────────

  const recentErrors = [];
  function remember(text) {
    if (!text || recentErrors[recentErrors.length - 1] === text) return;
    recentErrors.push(text);
    if (recentErrors.length > LIMITS.errors) recentErrors.shift();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('error', e => {
      // Failed image or script loads reach window only in the capture phase, so they never arrive
      // here; everything that does is a script error.
      if (e && e.message) remember(errorLine(e.message, e.filename, e.lineno, e.colno));
    });
    window.addEventListener('unhandledrejection', e => {
      const r = e && e.reason;
      remember(errorLine(r && r.message ? r.message : String(r), '', 0, 0));
    });
  }

  // ── The dialog ───────────────────────────────────────────────────────────────────────────────

  const config = {
    tool: '',
    getVersion: null,
    getPlanUrl: null,     // no share link on this page: the two plan options are not offered
    safeKeys: [],
    keyNames: null,
    // () => ({ key: value }): safe settings sent even at their default, which the share link omits.
    pinnedSettings: null,
    getTab: null,
    settingsHelp: 'Your choices and assumptions, plus any error messages the page logged. '
      + 'Never balances, income, spending, ages or birth dates.',
  };

  const ui = {
    dialog: null,
    el: {},
    route: null,
    opener: null,
    shot: null,
    shotBusy: false,
    token: '',
    widget: null,
    turnstile: 'idle',
    sending: false,
  };

  const STYLE = `
#fbw-dialog{box-sizing:border-box;width:min(560px,calc(100vw - 24px));max-width:none;max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);margin:auto;padding:0;border:0;border-radius:10px;background:#fff;color:#222;box-shadow:0 12px 40px rgba(0,0,0,.35);overflow:auto;font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:left}
#fbw-dialog::backdrop{background:rgba(0,0,0,.45)}
#fbw-dialog *{box-sizing:border-box}
#fbw-dialog [hidden]{display:none!important}
#fbw-dialog .fbw-body{padding:16px 18px 18px}
#fbw-dialog .fbw-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
#fbw-dialog h2{margin:0;padding:0;border:0;font-size:1.25em;color:#1f3b57}
#fbw-dialog .fbw-lede{margin:4px 0 2px;color:#555}
#fbw-dialog .fbw-alt{margin:0 0 8px}
#fbw-dialog .fbw-help strong{color:#222}
#fbw-dialog .fbw-label{display:block;margin:12px 0 4px;font-weight:600}
#fbw-dialog textarea,#fbw-dialog input[type=email]{display:block;width:100%;margin:0;padding:8px 10px;border:1px solid #b5bec6;border-radius:6px;background:#fff;color:#222;font:inherit}
#fbw-dialog textarea{min-height:100px;resize:vertical}
#fbw-dialog textarea:focus,#fbw-dialog input[type=email]:focus{outline:2px solid #2980b9;outline-offset:1px;border-color:#2980b9}
#fbw-dialog .fbw-count{min-height:1.2em;text-align:right;font-size:.8em;color:#777}
#fbw-dialog .fbw-opt{display:grid;grid-template-columns:auto 1fr;column-gap:8px;align-items:start;margin:10px 0 0}
#fbw-dialog .fbw-opt input[type=checkbox]{display:inline-block;position:static;opacity:1;width:18px;height:18px;margin:2px 0 0;accent-color:#2980b9;cursor:pointer}
#fbw-dialog .fbw-opt label{display:inline;font-weight:600;cursor:pointer}
#fbw-dialog .fbw-opt>.fbw-help,#fbw-dialog .fbw-opt>.fbw-shot{grid-column:2}
#fbw-dialog .fbw-help{margin:2px 0 0;font-size:.85em;color:#555}
#fbw-dialog .fbw-shot{margin-top:6px}
#fbw-dialog .fbw-shot img{display:block;max-width:100%;max-height:180px;border:1px solid #ccc;border-radius:4px}
#fbw-dialog .fbw-shot-bar{display:flex;align-items:center;gap:8px;margin-top:4px;font-size:.85em;color:#555}
#fbw-dialog .fbw-preview{margin:14px 0 4px}
#fbw-dialog .fbw-preview summary{cursor:pointer;color:#2980b9}
#fbw-dialog .fbw-preview pre{margin:6px 0 0;padding:8px;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word;background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;font:12px/1.4 ui-monospace,Consolas,monospace;color:#222}
#fbw-dialog a{color:#2980b9}
#fbw-dialog .fbw-foot{position:sticky;bottom:0;margin:10px -18px -18px;padding:8px 18px 14px;background:#fff;border-top:1px solid #e3e8ec}
#fbw-dialog .fbw-status{min-height:1.4em}
#fbw-dialog .fbw-status:empty{min-height:0}
#fbw-dialog .fbw-status.fbw-error{color:#b00020}
#fbw-dialog .fbw-status.fbw-ok{color:#1a7a1a;font-weight:600}
#fbw-dialog .fbw-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}
#fbw-dialog button{width:auto;min-width:0;min-height:36px;margin:0;padding:8px 18px;border:0;border-radius:6px;background:#2980b9;color:#fff;font:inherit;line-height:1.2;cursor:pointer}
#fbw-dialog button:hover{background:#3498db}
#fbw-dialog button:disabled{background:#9db7c9;cursor:default}
#fbw-dialog button.fbw-quiet{background:#eef2f5;color:#1f3b57}
#fbw-dialog button.fbw-quiet:hover{background:#dde5eb}
#fbw-dialog button.fbw-small{min-height:28px;padding:3px 10px;font-size:.9em}
#fbw-dialog button.fbw-x{min-height:32px;padding:0 10px;font-size:1.5em;line-height:1}
@media (max-width:480px){#fbw-dialog .fbw-body{padding:14px 14px 16px}#fbw-dialog .fbw-foot{margin:10px -14px -16px;padding:8px 14px 12px}#fbw-dialog .fbw-actions button{flex:1;min-height:44px}}
`;

  // Constants only. Everything a person types, and everything the server says, is set with
  // .value or .textContent.
  const TEMPLATE = `
<div class="fbw-body">
  <div class="fbw-head">
    <h2 id="fbw-title">Send feedback</h2>
    <button type="button" class="fbw-quiet fbw-x" id="fbw-x" aria-label="Close">&times;</button>
  </div>
  <p class="fbw-lede">A problem, a question or an idea. It goes privately to the author of this tool.</p>
  <p class="fbw-help fbw-alt">Prefer GitHub? <a id="fbw-github" target="_blank" rel="noopener">Open an issue there</a>
    with your message filled in. Issues are public, so leave your own numbers out.</p>
  <label class="fbw-label" for="fbw-message">Your message</label>
  <textarea id="fbw-message" rows="5" maxlength="${LIMITS.message}" placeholder="What problem are you finding?"></textarea>
  <div class="fbw-count" id="fbw-count"></div>

  <div class="fbw-opt" id="fbw-settings-row">
    <input type="checkbox" id="fbw-settings" checked aria-describedby="fbw-settings-help">
    <label for="fbw-settings">Include my settings and page errors</label>
    <div class="fbw-help" id="fbw-settings-help"></div>
  </div>
  <div class="fbw-opt" id="fbw-plan-row">
    <input type="checkbox" id="fbw-plan" aria-describedby="fbw-plan-help">
    <label for="fbw-plan">Include my full plan link</label>
    <div class="fbw-help" id="fbw-plan-help">It contains your balances, income, spending and ages. Without them, a problem can be hard to reproduce. For privacy you can reproduce and send numbers that are not your private information but that illustrate the problem.</div>
  </div>
  <div class="fbw-opt">
    <input type="checkbox" id="fbw-shot" aria-describedby="fbw-shot-help">
    <label for="fbw-shot">Include a screenshot of this page</label>
    <div class="fbw-help" id="fbw-shot-help">It shows the whole page behind this box, top to bottom rather than only the part on screen, <strong>including your numbers</strong>.</div>
    <div class="fbw-shot" id="fbw-shot-box" hidden>
      <img id="fbw-shot-img" alt="The screenshot that will be sent">
      <div class="fbw-shot-bar">
        <span id="fbw-shot-size"></span>
        <button type="button" class="fbw-quiet fbw-small" id="fbw-retake">Retake</button>
        <button type="button" class="fbw-quiet fbw-small" id="fbw-remove">Remove</button>
      </div>
    </div>
    <div class="fbw-help" id="fbw-shot-status" role="status"></div>
  </div>

  <label class="fbw-label" for="fbw-email">Your email (optional)</label>
  <input type="email" id="fbw-email" autocomplete="email" maxlength="${LIMITS.address}" spellcheck="false" placeholder="you@example.com" aria-describedby="fbw-email-help">
  <div class="fbw-help" id="fbw-email-help">Used only to reply to you. Leave it empty and there is no way to answer. One person reads these, so a reply can take a while.</div>

  <details class="fbw-preview" id="fbw-preview">
    <summary>Show exactly what will be sent</summary>
    <pre id="fbw-preview-text"></pre>
  </details>
  <p class="fbw-help">Always sent: app version, browser, window size and which tab is open.
    <a id="fbw-readme" target="_blank" rel="noopener">What happens to it</a></p>

  <div id="fbw-turnstile"></div>
  <div class="fbw-foot">
    <div class="fbw-status" id="fbw-status" role="status" aria-live="polite"></div>
    <div class="fbw-actions">
      <button type="button" class="fbw-quiet" id="fbw-close">Close</button>
      <button type="button" id="fbw-send">Send</button>
    </div>
  </div>
</div>`;

  function call(fn) {
    try { return typeof fn === 'function' ? fn() : ''; } catch (e) { return ''; }
  }

  function build() {
    if (ui.dialog) return;
    if (!document.getElementById('fbw-style')) {
      const style = document.createElement('style');
      style.id = 'fbw-style';
      style.textContent = STYLE;
      document.head.appendChild(style);
    }
    const d = document.createElement('dialog');
    d.id = 'fbw-dialog';
    d.setAttribute('aria-labelledby', 'fbw-title');
    d.innerHTML = TEMPLATE;
    document.body.appendChild(d);

    const $ = id => d.querySelector('#' + id);
    const el = {
      message: $('fbw-message'), count: $('fbw-count'),
      settingsRow: $('fbw-settings-row'), settings: $('fbw-settings'), settingsHelp: $('fbw-settings-help'),
      planRow: $('fbw-plan-row'), plan: $('fbw-plan'),
      shot: $('fbw-shot'), shotBox: $('fbw-shot-box'), shotImg: $('fbw-shot-img'), shotSize: $('fbw-shot-size'),
      shotStatus: $('fbw-shot-status'), retake: $('fbw-retake'), remove: $('fbw-remove'),
      email: $('fbw-email'), preview: $('fbw-preview'), previewText: $('fbw-preview-text'),
      readme: $('fbw-readme'), github: $('fbw-github'), turnstile: $('fbw-turnstile'), status: $('fbw-status'),
      close: $('fbw-close'), x: $('fbw-x'), send: $('fbw-send'),
    };
    ui.dialog = d;
    ui.el = el;

    el.message.addEventListener('input', () => { updateCount(); updateGithubLink(); refreshPreview(); });
    el.message.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
    });
    el.email.addEventListener('input', refreshPreview);
    el.settings.addEventListener('change', refreshPreview);
    el.plan.addEventListener('change', refreshPreview);
    el.shot.addEventListener('change', () => { if (el.shot.checked) takeShot(); else dropShot(); });
    el.retake.addEventListener('click', takeShot);
    el.remove.addEventListener('click', () => { el.shot.checked = false; dropShot(); });
    el.preview.addEventListener('toggle', refreshPreview);
    el.close.addEventListener('click', close);
    el.x.addEventListener('click', close);
    el.send.addEventListener('click', send);

    // Escape closes the box. A modal <dialog> normally does that by itself, but not everywhere: in
    // an embedded browser the key reached the page and the dialog stayed open. Handling it here,
    // and preventing the built-in path, gives exactly one close either way.
    d.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        close();
      }
    });

    // A click on the backdrop closes the box. The press has to start there too, or a text
    // selection dragged past the edge would close it. Nothing typed is lost either way.
    let pressedOutside = false;
    d.addEventListener('pointerdown', e => { pressedOutside = e.target === d; });
    d.addEventListener('click', e => { if (pressedOutside && e.target === d) close(); });
    d.addEventListener('close', () => {
      const back = ui.opener;
      ui.opener = null;
      if (back && typeof back.focus === 'function' && document.contains(back)) back.focus();
    });

    const dl = window.DocLinks;
    el.readme.setAttribute('href', dl && typeof dl.docHref === 'function'
      ? dl.docHref(README_SECTION, dl.isRendered())
      : README_SECTION);
  }

  function open() {
    if (typeof document === 'undefined') return;
    build();
    const el = ui.el;
    const hasPlan = typeof config.getPlanUrl === 'function';
    el.settingsRow.hidden = !hasPlan;
    el.planRow.hidden = !hasPlan;
    el.settingsHelp.textContent = config.settingsHelp;

    ui.route = resolveEndpoint(window.location);
    if (!ui.sending) setStatus('', '');
    showRouteProblem();
    updateCount();
    updateGithubLink();
    refreshPreview();
    if (!ui.dialog.open) {
      ui.opener = document.activeElement;
      ui.dialog.showModal();
    }
    el.message.focus();
    if (!ui.route.problem) startTurnstile();
  }

  function close() {
    if (ui.dialog && ui.dialog.open) ui.dialog.close();
  }

  function setStatus(text, kind) {
    const s = ui.el.status;
    s.textContent = text;
    s.className = 'fbw-status' + (kind ? ' fbw-' + kind : '');
  }

  function showRouteProblem() {
    const route = ui.route;
    if (route.problem === 'file') {
      setStatus('Sending needs the online page. Open this tool at ', 'error');
      const a = document.createElement('a');
      a.href = LIVE_SITE + (window.location.pathname.split('/').pop() || '');
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'tools.netcitizen.us';
      ui.el.status.appendChild(a);
      ui.el.status.appendChild(document.createTextNode(' to send it.'));
    } else if (route.problem === 'setup') {
      setStatus('Sending is not set up on this copy of the page yet.', 'error');
    }
    updateSendState();
  }

  function updateSendState() {
    const b = ui.el.send;
    if (!b) return;
    b.disabled = ui.sending || !ui.route || !!ui.route.problem;
    b.textContent = ui.sending ? 'Sending...' : 'Send';
  }

  function updateCount() {
    const n = ui.el.message.value.length;
    ui.el.count.textContent = n ? n + ' of ' + LIMITS.message + ' characters' : '';
  }

  function updateGithubLink() {
    ui.el.github.setAttribute('href', githubIssueUrl({
      message: ui.el.message.value,
      version: call(config.getVersion),
      env: { ua: String(navigator.userAgent || '').slice(0, 300) },
    }));
  }

  function environment() {
    return {
      ua: String(navigator.userAgent || '').slice(0, 300),
      viewport: window.innerWidth + 'x' + window.innerHeight,
      dpr: String(Math.round((window.devicePixelRatio || 1) * 100) / 100),
      tab: String(call(config.getTab) || '').replace(/\s+/g, ' ').trim().slice(0, 60),
    };
  }

  function currentPayload() {
    const el = ui.el;
    const hasPlan = typeof config.getPlanUrl === 'function';
    const includeSettings = hasPlan && el.settings.checked;
    const includePlan = hasPlan && el.plan.checked;
    return buildPayload({
      message: el.message.value,
      replyTo: el.email.value,
      includeSettings,
      includePlan,
      shareUrl: includeSettings || includePlan ? String(call(config.getPlanUrl) || '') : '',
      errors: recentErrors.slice(),
      screenshot: el.shot.checked ? ui.shot : null,
      turnstile: ui.token,
      href: window.location.href,
      env: environment(),
    }, {
      tool: config.tool || document.title.replace(/\s*\d+\.[0-9a-f]+\s*$/i, ''),
      version: call(config.getVersion),
      safeKeys: config.safeKeys,
      keyNames: config.keyNames,
      pinned: call(config.pinnedSettings) || {},
    });
  }

  function refreshPreview() {
    if (!ui.el.preview || !ui.el.preview.open) return;
    ui.el.previewText.textContent = describePayload(currentPayload());
  }

  // ── Screenshot ───────────────────────────────────────────────────────────────────────────────

  const loading = {};
  function loadScript(src, integrity) {
    if (!loading[src]) {
      loading[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        if (integrity) {
          s.integrity = integrity;
          s.crossOrigin = 'anonymous';
          s.referrerPolicy = 'no-referrer';
        }
        s.onload = () => resolve();
        s.onerror = () => {
          delete loading[src];
          s.remove();
          reject(new Error('could not load ' + src));
        };
        document.head.appendChild(s);
      });
    }
    return loading[src];
  }

  function setShotStatus(text) {
    ui.el.shotStatus.textContent = text;
  }

  function dropShot() {
    ui.shot = null;
    ui.el.shotBox.hidden = true;
    ui.el.shotImg.removeAttribute('src');
    ui.el.shotSize.textContent = '';
    setShotStatus('');
    refreshPreview();
  }

  // Shrinks until the JPEG fits under LIMITS.imageBytes. null if even the smallest step does not.
  function toJpeg(canvas) {
    const steps = [[1280, 0.7], [1280, 0.5], [960, 0.6], [960, 0.45], [720, 0.5]];
    for (const [maxWidth, quality] of steps) {
      const w = Math.min(maxWidth, canvas.width);
      const h = Math.max(1, Math.round(canvas.height * w / canvas.width));
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const g = out.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, w, h);
      g.drawImage(canvas, 0, 0, w, h);
      const url = out.toDataURL('image/jpeg', quality);
      if (url.indexOf('data:image/jpeg;base64,') === 0 && dataUrlBytes(url) <= LIMITS.imageBytes) return url;
    }
    return null;
  }

  // The whole page, top to bottom, drawn from the page itself rather than from pixels, so no
  // permission prompt is needed. Everything below the fold is included, because the chart or the
  // control somebody is reporting is usually the one they had to scroll to. The dialog is left out
  // of the drawing. A table with its own scrollbar still shows only the rows inside it: that is the
  // element's own clipping, not this.
  //
  // Measured on the tallest tab, 5167 px: 1.5 seconds and 738 KB at full width, so nothing is
  // downscaled. Reckon on 5 to 9 seconds on a laptop of a few years ago. A page too long even for
  // the smallest step falls back to what is on screen, which always fits.
  function capturePage() {
    return loadScript(CAPTURE_SRC, CAPTURE_SRI).then(() => {
      const draw = window.html2canvas;
      if (typeof draw !== 'function') throw new Error('capture library missing');
      const started = performance.now();
      const width = document.documentElement.clientWidth;
      const shoot = (y, height) => draw(document.body, {
        x: 0,
        y,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scale: Math.min(window.devicePixelRatio || 1, 1.5),
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        ignoreElements: node => node === ui.dialog,
      });
      const whole = Math.max(document.documentElement.scrollHeight, window.innerHeight);
      return shoot(0, whole)
        .then(canvas => toJpeg(canvas) || shoot(window.scrollY, window.innerHeight).then(toJpeg))
        .then(url => {
          api.lastCaptureMs = Math.round(performance.now() - started);
          return url;
        });
    });
  }

  function takeShot() {
    const el = ui.el;
    if (ui.shotBusy) return;
    ui.shotBusy = true;
    ui.shot = null;
    el.shotBox.hidden = true;
    setShotStatus('Taking the screenshot...');
    capturePage().then(url => {
      if (!el.shot.checked) return;            // unticked while it was being taken
      if (!url) {
        el.shot.checked = false;
        setShotStatus('The screenshot came out too large to send.');
        return;
      }
      ui.shot = url;
      el.shotImg.src = url;
      el.shotSize.textContent = kb(dataUrlBytes(url));
      el.shotBox.hidden = false;
      setShotStatus('');
    }).catch(() => {
      el.shot.checked = false;
      setShotStatus('The screenshot could not be taken on this page.');
    }).finally(() => {
      ui.shotBusy = false;
      refreshPreview();
    });
  }

  // ── Bot check ────────────────────────────────────────────────────────────────────────────────

  function startTurnstile() {
    if (ui.widget !== null || ui.turnstile === 'loading') return;
    ui.turnstile = 'loading';
    loadScript(TURNSTILE_SRC).then(() => {
      const ts = window.turnstile;
      if (!ts || typeof ts.render !== 'function') throw new Error('turnstile missing');
      ui.widget = ts.render(ui.el.turnstile, {
        sitekey: ui.route.siteKey,
        action: 'feedback',
        appearance: 'interaction-only',
        callback: token => { ui.token = token; },
        'expired-callback': () => { ui.token = ''; },
        'timeout-callback': () => { ui.token = ''; },
        'error-callback': () => {
          ui.token = '';
          setStatus('The spam check could not run. Reload the page to try again.', 'error');
          return true;
        },
      });
      ui.turnstile = 'ready';
    }).catch(() => {
      ui.turnstile = 'idle';
      setStatus('The spam check could not load. Check your connection, then close this box and open it again.', 'error');
    });
  }

  function resetTurnstile() {
    ui.token = '';
    if (ui.widget !== null && window.turnstile) {
      try { window.turnstile.reset(ui.widget); } catch (e) { /* widget gone; next open renders again */ }
    }
  }

  // ── Sending ──────────────────────────────────────────────────────────────────────────────────

  function send() {
    const el = ui.el;
    if (ui.sending) return;
    const route = ui.route || resolveEndpoint(window.location);
    if (route.problem) { showRouteProblem(); return; }
    const problem = messageProblem(el.message.value);
    if (problem) {
      setStatus(problem === 'empty'
        ? 'Write a message first.'
        : 'The message is over ' + LIMITS.message + ' characters.', 'error');
      el.message.focus();
      return;
    }
    if (!validReplyTo(el.email.value)) {
      setStatus('That email address does not look complete. Fix it, or leave the box empty.', 'error');
      el.email.focus();
      return;
    }
    if (ui.shotBusy) {
      setStatus('Wait for the screenshot to finish.', 'error');
      return;
    }
    if (!ui.token) {
      setStatus('The spam check is still running. Try again in a moment.', 'error');
      startTurnstile();
      return;
    }

    const body = JSON.stringify(currentPayload());
    ui.sending = true;
    updateSendState();
    setStatus('Sending...', '');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), LIMITS.timeoutMs);
    fetch(route.endpoint, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: ctrl.signal,
    })
      .then(res => res.json().catch(() => ({})).then(data => ({ status: res.status, data })))
      .then(({ status, data }) => {
        if (status === 200 && data && data.ok === true) sent();
        else setStatus(failureText(status, data && data.error), 'error');
      })
      .catch(err => {
        setStatus(err && err.name === 'AbortError'
          ? 'Sending took too long. Your message is still here; try again.'
          : 'The feedback service could not be reached. Your message is still here; check your connection and try again.',
        'error');
      })
      .finally(() => {
        clearTimeout(timer);
        ui.sending = false;
        resetTurnstile();
        updateSendState();
      });
  }

  function sent() {
    const el = ui.el;
    // Said at the one moment the answer is certain: the address either went with the message or it
    // did not. Nobody should be left waiting for a reply that was never possible.
    const gaveAddress = el.email.value.trim() !== '';
    el.message.value = '';
    el.plan.checked = false;
    el.shot.checked = false;
    dropShot();
    updateCount();
    refreshPreview();
    setStatus(gaveAddress
      ? 'Thank you. Your feedback was sent. Any reply goes to the address you gave, and it can take a while.'
      : 'Thank you. Your feedback was sent. You left no email address, so there is no way to reply to you.', 'ok');
  }

  // ── Public API ───────────────────────────────────────────────────────────────────────────────

  function init(options) {
    Object.assign(config, options || {});
    return api;
  }

  const api = {
    init,
    open,
    close,
    // The pure half, for feedback.tests.js.
    queryOf,
    splitQuery,
    fieldName,
    pageAddress,
    validReplyTo,
    maskDigits,
    errorLine,
    normalizeMessage,
    messageProblem,
    settingsWith,
    buildPayload,
    githubIssueUrl,
    describePayload,
    dataUrlBytes,
    resolveEndpoint,
    failureText,
    // Read-only facts.
    LIMITS,
    ADDRESS,
    ENDPOINT,
    GITHUB_NEW_ISSUE,
    GITHUB_TEMPLATE,
    GITHUB_FIELDS,
    DEV_ENDPOINT,
    SITE_KEY,
    DEV_SITE_KEY,
    CAPTURE_SRC,
    CAPTURE_SRI,
    config: () => Object.assign({}, config),
    recentErrors: () => recentErrors.slice(),
    lastCaptureMs: null,
  };

  if (typeof window !== 'undefined') {
    window.FeedbackWidget = api;
  }

  // Dual-mode export: inert in browser (classic script); lets Node tests require() this file.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

})();
