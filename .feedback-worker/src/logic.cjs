'use strict';
/* logic.cjs - everything the feedback Worker decides, and the request handler that applies it.

   index.js is only the Cloudflare entry point. It hands the real EmailMessage class, fetch() and
   a clock to handle() below. Because those are passed in rather than imported, feedback.tests.js
   (repo root) runs this whole request path under node on every commit, with stand-ins for the mail
   binding, the rate limiter and Turnstile.

   CommonJS on purpose: node require()s it with no loader, and wrangler's bundler accepts a
   CommonJS file imported from an ES-module entry point.

   Everything in a request is untrusted. Nothing from it reaches an email header except the reply
   address, which must match ADDRESS, and the subject, which is stripped of control characters and
   then encoded. Everything else travels base64-encoded inside a text/plain body, so no content can
   start a header or a MIME part. */

const LIMITS = Object.freeze({
    bodyBytes: 1600000,     // the whole request, as received
    message: 5000,          // characters, after trimming; feedback.js enforces the same number
    address: 254,           // RFC 5321 path limit
    link: 8000,             // a full plan link is 1-2 KB
    settings: 8000,
    text: 300,              // one browser field, one page error
    tool: 60,
    version: 20,
    tab: 60,
    errors: 5,
    withheld: 120,
    fieldName: 60,
    token: 4096,            // Turnstile response token
    imageBytes: 1000000,    // the decoded JPEG; feedback.js aims for 900 KB
});

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

// RFC 5322 dot-atom local part and a DNS domain with at least one dot. The atext set excludes every
// character that can end an address or begin another header field - space, CR, LF, comma,
// semicolon, angle brackets, quotes, parentheses, colon, backslash - which is what makes a match
// safe to place in Reply-To. feedback.js carries the same pattern; a test checks the two agree.
const ADDRESS = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

// Every character URLSearchParams.toString() can emit.
const QUERY = /^[A-Za-z0-9*._+%=&-]*$/;
const FIELD_NAME = /^[A-Za-z0-9_-]{1,60}$/;
const JPEG_PREFIX = 'data:image/jpeg;base64,';
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const MESSAGE_ID = /^[A-Za-z0-9.-]+@[A-Za-z0-9.-]+$/;
const BOUNDARY = /^[A-Za-z0-9=_.-]{1,60}$/;

// Cloudflare's published Turnstile test secrets: 1x... always passes, 2x... always fails, 3x...
// reports the token as already spent. They belong in .dev.vars and nowhere else.
const TEST_SECRET = /^[123]x0+AA$/;

// ── Configuration ──────────────────────────────────────────────────────────────────────────────

function listVar(v) {
    return String(v || '').split(',').map(s => s.trim()).filter(Boolean);
}

// Names of whatever is missing or malformed. An empty list means the Worker can run.
function checkConfig(env) {
    const bad = [];
    if (!validAddress(env.FEEDBACK_TO)) bad.push('FEEDBACK_TO');
    if (!validAddress(env.FEEDBACK_FROM)) bad.push('FEEDBACK_FROM');
    if (!env.TURNSTILE_SECRET) bad.push('TURNSTILE_SECRET');
    if (!listVar(env.ALLOWED_ORIGINS).length) bad.push('ALLOWED_ORIGINS');
    if (!dailyLimit(env)) bad.push('DAILY_LIMIT');
    if (!env.SEND || typeof env.SEND.send !== 'function') bad.push('SEND');
    if (!env.RL || typeof env.RL.limit !== 'function') bad.push('RL');
    if (!env.COUNTER || typeof env.COUNTER.idFromName !== 'function' || typeof env.COUNTER.get !== 'function') {
        bad.push('COUNTER');
    }
    return bad;
}

// Most messages a whole day may send, whoever sends them. 0 when the setting is missing or
// malformed, which checkConfig reports rather than guessing a number.
function dailyLimit(env) {
    const n = Number(env.DAILY_LIMIT);
    return Number.isInteger(n) && n >= 1 && n <= 10000 ? n : 0;
}

// Counts one message against the day's limit and answers whether it may be sent. `store` is a
// Durable Object's storage (get/put); a Durable Object runs one call at a time, so the count is
// exact however many requests arrive at once. One key, overwritten each day, so nothing piles up.
async function takeFromStore(store, day, limit) {
    const rec = await store.get('today');
    const used = rec && rec.day === day ? rec.used : 0;
    if (used >= limit) return false;
    await store.put('today', { day, used: used + 1 });
    return true;
}

// ── Origins ────────────────────────────────────────────────────────────────────────────────────

// Exact match only. A browser always sends the origin in this form, so there is nothing to
// normalize, and a prefix or suffix test is how "tools.netcitizen.us.example.com" gets in.
function checkOrigin(origin, env) {
    if (typeof origin !== 'string' || origin === '') return false;
    if (listVar(env.ALLOWED_ORIGINS).indexOf(origin) !== -1) return true;
    return env.ALLOW_LOCALHOST === '1' && LOCALHOST.test(origin);
}

function corsHeaders(origin, env) {
    const h = { 'Vary': 'Origin' };
    if (checkOrigin(origin, env)) {
        h['Access-Control-Allow-Origin'] = origin;
        h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
        h['Access-Control-Allow-Headers'] = 'Content-Type';
        h['Access-Control-Max-Age'] = '7200';
    }
    return h;
}

function allowedHostnames(env) {
    const hosts = listVar(env.ALLOWED_ORIGINS).map(o => {
        try { return new URL(o).hostname; } catch (e) { return ''; }
    }).filter(Boolean);
    if (env.ALLOW_LOCALHOST === '1') hosts.push('localhost', '127.0.0.1');
    return hosts;
}

// A link in a report must point back at one of our own pages.
function linkOk(link, env) {
    if (typeof link !== 'string' || link.length > LIMITS.link || /[\s\\]/.test(link)) return false;
    let u;
    try { u = new URL(link); } catch (e) { return false; }
    return checkOrigin(u.origin, env) && link.indexOf(u.origin + '/') === 0;
}

// ── Turnstile ──────────────────────────────────────────────────────────────────────────────────

// A test secret is honored only for a request from a local page, so a test key left in the live
// Worker's secrets cannot switch off the bot check for the real site.
function turnstileOk(result, env, origin) {
    if (!result || result.success !== true) return false;
    if (TEST_SECRET.test(String(env.TURNSTILE_SECRET || ''))) {
        return env.ALLOW_LOCALHOST === '1' && LOCALHOST.test(String(origin || ''));
    }
    return result.action === 'feedback'
        && allowedHostnames(env).indexOf(String(result.hostname || '')) !== -1;
}

// ── Payload ────────────────────────────────────────────────────────────────────────────────────

function validAddress(s) {
    return typeof s === 'string' && s.length <= LIMITS.address && ADDRESS.test(s);
}

// One line of plain text: control characters become spaces, runs of space collapse, then cut.
function clip(s, max) {
    if (typeof s !== 'string' && typeof s !== 'number') return '';
    return String(s).replace(/[\x00-\x1f\x7f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

// A message keeps its line breaks and tabs and loses every other control character.
function cleanMessage(s) {
    return String(s).replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim();
}

function decodedBytes(b64) {
    const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
    return (b64.length / 4) * 3 - pad;
}

// { ok: true, clean, token } or { ok: false, code }. Only the fields named here survive; anything
// else in the request is dropped. null means "the sender chose not to include this".
function validatePayload(p, env) {
    const bad = code => ({ ok: false, code });
    if (!p || typeof p !== 'object' || Array.isArray(p)) return bad('payload');
    if (p.v !== 1) return bad('version');

    if (typeof p.message !== 'string') return bad('message');
    const message = cleanMessage(p.message);
    if (!message || message.length > LIMITS.message) return bad('message');

    const replyTo = p.replyTo == null ? '' : String(p.replyTo).trim();
    if (replyTo !== '' && !validAddress(replyTo)) return bad('replyTo');

    if (!linkOk(p.page, env) || /[?#]/.test(p.page)) return bad('page');

    let settings = null;
    let withheld = null;
    if (p.settings != null) {
        if (typeof p.settings !== 'string' || p.settings.length > LIMITS.settings || !QUERY.test(p.settings)) {
            return bad('settings');
        }
        settings = p.settings;
        const w = p.withheld == null ? [] : p.withheld;
        if (!Array.isArray(w) || w.length > LIMITS.withheld
            || !w.every(n => typeof n === 'string' && FIELD_NAME.test(n))) {
            return bad('withheld');
        }
        withheld = w.filter((n, i) => w.indexOf(n) === i);
    }

    let errors = null;
    if (p.errors != null) {
        if (!Array.isArray(p.errors) || p.errors.length > LIMITS.errors
            || !p.errors.every(e => typeof e === 'string')) {
            return bad('errors');
        }
        errors = p.errors.map(e => clip(e, LIMITS.text)).filter(Boolean);
    }

    let planUrl = null;
    if (p.planUrl != null) {
        if (!linkOk(p.planUrl, env)) return bad('planUrl');
        planUrl = p.planUrl;
    }

    let jpeg = null;
    if (p.screenshot != null) {
        const s = p.screenshot;
        if (typeof s !== 'string' || s.indexOf(JPEG_PREFIX) !== 0) return bad('screenshot');
        const b64 = s.slice(JPEG_PREFIX.length);
        // '/9j/' is the base64 of FF D8 FF, the first bytes of every JPEG file.
        if (b64.length % 4 !== 0 || !BASE64.test(b64) || b64.indexOf('/9j/') !== 0) return bad('screenshot');
        if (decodedBytes(b64) > LIMITS.imageBytes) return bad('screenshot');
        jpeg = b64;
    }

    let token = '';
    if (p.turnstile != null) {
        if (typeof p.turnstile !== 'string' || p.turnstile.length > LIMITS.token
            || /[\x00-\x20\x7f]/.test(p.turnstile)) {
            return bad('token');
        }
        token = p.turnstile;
    }

    const e = p.env && typeof p.env === 'object' && !Array.isArray(p.env) ? p.env : {};
    const clean = {
        tool: clip(p.tool, LIMITS.tool) || 'Unknown tool',
        version: clip(p.version, LIMITS.version),
        page: p.page,
        message,
        replyTo,
        settings,
        withheld,
        errors,
        planUrl,
        jpeg,
        env: {
            ua: clip(e.ua, LIMITS.text),
            viewport: clip(e.viewport, 40),
            dpr: clip(e.dpr, 10),
            tab: clip(e.tab, LIMITS.tab),
        },
    };
    return { ok: true, clean, token };
}

// ── The email ──────────────────────────────────────────────────────────────────────────────────

function utf8ToBase64(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
}

function wrap76(b64) {
    const lines = [];
    for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
    return lines.join('\r\n');
}

// One header field, with its value on one logical line and no physical line over 78 characters,
// RFC 5322's limit for a well-formed line. Plain ASCII folds at spaces. Anything else becomes
// RFC 2047 encoded-words, split between whole characters and folded with CRLF+space, which a mail
// client joins back without a gap. RFC 2047 caps a line holding encoded-words at 76 characters, so
// each word carries at most 36 bytes: 60 characters, which fits even after "Subject: ".
function headerField(name, text) {
    const flat = String(text).replace(/[\x00-\x1f\x7f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();
    const lead = name + ': ';
    if (/^[\x20-\x7e]*$/.test(flat)) {
        const lines = [];
        let line = lead;
        for (const word of flat.split(' ')) {
            if (line === lead) {
                line += word;
            } else if (line.length + 1 + word.length > 78) {
                lines.push(line);
                line = ' ' + word;
            } else {
                line += ' ' + word;
            }
        }
        lines.push(line);
        return lines.join('\r\n');
    }
    const enc = new TextEncoder();
    const words = [];
    let chunk = '';
    for (const ch of flat) {
        if (chunk && enc.encode(chunk + ch).length > 36) {
            words.push(chunk);
            chunk = ch;
        } else {
            chunk += ch;
        }
    }
    if (chunk) words.push(chunk);
    return lead + words.map(w => '=?UTF-8?B?' + utf8ToBase64(w) + '?=').join('\r\n ');
}

function domainOf(address) {
    return String(address).split('@').pop();
}

function subjectFor(clean) {
    const chars = Array.from(clean.message.replace(/\s+/g, ' ').trim());
    const head = chars.slice(0, 60).join('') + (chars.length > 60 ? '...' : '');
    return '[Feedback] ' + clean.tool + (clean.version ? ' ' + clean.version : '') + ': ' + head;
}

function kb(bytes) {
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

function formatBody(clean, meta) {
    const out = [];
    const section = (title, lines) => {
        out.push('', title, '-'.repeat(title.length));
        lines.forEach(line => out.push(line));
    };
    out.push('Feedback from ' + clean.tool + (clean.version ? ' ' + clean.version : ''));
    out.push('Page: ' + clean.page);
    if (meta && meta.received instanceof Date) {
        out.push('Received: ' + meta.received.toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
    }
    out.push('Reply to: ' + (clean.replyTo || '(none given)'));

    section('Message', clean.message.split('\n'));

    section('Settings (no balances, income, spending, ages or birth dates)', clean.settings === null
        ? ['(not included)']
        : ['Link: ' + clean.page + (clean.settings ? '?' + clean.settings : ''),
           'Withheld: ' + (clean.withheld.length ? clean.withheld.join(', ') : '(none)')]);

    section('Page errors', clean.errors === null
        ? ['(not included)']
        : clean.errors.length ? clean.errors.map(e => '- ' + e) : ['(none)']);

    section('Full plan link', [clean.planUrl || '(not included)']);

    const e = clean.env;
    section('Browser', [
        'Window: ' + (e.viewport || '?') + (e.dpr ? ' at ' + e.dpr + 'x' : ''),
        'Tab: ' + (e.tab || '?'),
        'Agent: ' + (e.ua || '?'),
    ]);

    out.push('', 'Screenshot: ' + (clean.jpeg ? 'attached, ' + kb(decodedBytes(clean.jpeg)) : '(not included)'));
    return out.join('\n');
}

// A complete message in RFC 5322 form, CRLF throughout. Throws rather than build a message around a
// malformed address, id or boundary: those come from configuration and from index.js, never from
// the request, so a failure here is a setup fault to surface, not input to tolerate.
function buildMime(m) {
    if (!validAddress(m.from)) throw new Error('bad From address');
    if (!validAddress(m.to)) throw new Error('bad To address');
    if (m.replyTo && !validAddress(m.replyTo)) throw new Error('bad Reply-To address');
    if (!MESSAGE_ID.test(String(m.messageId))) throw new Error('bad Message-ID');
    if (m.jpeg && !BOUNDARY.test(String(m.boundary))) throw new Error('bad boundary');

    const head = [
        'From: Retirement tools feedback <' + m.from + '>',
        'To: <' + m.to + '>',
    ];
    if (m.replyTo) head.push('Reply-To: <' + m.replyTo + '>');
    head.push(
        headerField('Subject', m.subject),
        'Date: ' + m.date.toUTCString().replace(/GMT$/, '+0000'),
        'Message-ID: <' + m.messageId + '>',
        'MIME-Version: 1.0'
    );
    const text = [
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        wrap76(utf8ToBase64(String(m.text).replace(/\r?\n/g, '\r\n'))),
    ];
    if (!m.jpeg) return head.concat(text).join('\r\n') + '\r\n';

    const b = m.boundary;
    return head.concat(
        ['Content-Type: multipart/mixed; boundary="' + b + '"', '', '--' + b],
        text,
        [
            '--' + b,
            'Content-Type: image/jpeg; name="screenshot.jpg"',
            'Content-Disposition: attachment; filename="screenshot.jpg"',
            'Content-Transfer-Encoding: base64',
            '',
            wrap76(m.jpeg),
            '--' + b + '--',
            '',
        ]
    ).join('\r\n');
}

function composeEmail(clean, env, ids) {
    return buildMime({
        from: env.FEEDBACK_FROM,
        to: env.FEEDBACK_TO,
        replyTo: clean.replyTo,
        subject: subjectFor(clean),
        text: formatBody(clean, { received: ids.date }),
        jpeg: clean.jpeg,
        messageId: ids.messageId,
        boundary: ids.boundary,
        date: ids.date,
    });
}

// ── The request handler ────────────────────────────────────────────────────────────────────────

// Reads the body but gives up as soon as it passes `limit`, so an oversized upload is refused
// without being held in memory. null means too large.
async function readLimited(request, limit) {
    if (!request.body) return new Uint8Array(0);
    const reader = request.body.getReader();
    const parts = [];
    let size = 0;
    for (;;) {
        const step = await reader.read();
        if (step.done) break;
        size += step.value.byteLength;
        if (size > limit) {
            try { await reader.cancel(); } catch (e) { /* already closed */ }
            return null;
        }
        parts.push(step.value);
    }
    const out = new Uint8Array(size);
    let at = 0;
    for (const part of parts) {
        out.set(part, at);
        at += part.byteLength;
    }
    return out;
}

// deps: { EmailMessage, fetch, uuid, now }. Cheapest refusals first; the bot check comes after
// validation so a malformed request never costs a call to Cloudflare, and the day's count is
// touched only by a request that passed the bot check. Error replies carry a short code and never
// any part of the request. Nothing is logged.
async function handle(request, env, deps) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    const reply = (status, body) => new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: Object.assign(
            body === null ? {} : { 'Content-Type': 'application/json' },
            { 'Cache-Control': 'no-store' },
            cors
        ),
    });
    const fail = (status, code) => reply(status, { ok: false, error: code });

    if (request.method === 'OPTIONS') {
        return checkOrigin(origin, env) ? reply(204, null) : fail(403, 'origin');
    }
    if (request.method !== 'POST') return fail(405, 'method');
    if (!checkOrigin(origin, env)) return fail(403, 'origin');
    if (!/^application\/json\s*(;|$)/i.test(request.headers.get('Content-Type') || '')) return fail(415, 'type');
    if (Number(request.headers.get('Content-Length')) > LIMITS.bodyBytes) return fail(413, 'size');
    if (checkConfig(env).length) return fail(500, 'config');

    const ip = request.headers.get('CF-Connecting-IP') || '';
    const gate = await env.RL.limit({ key: ip || 'unknown' });
    if (!gate || gate.success !== true) return fail(429, 'rate');

    const bytes = await readLimited(request, LIMITS.bodyBytes);
    if (bytes === null) return fail(413, 'size');
    let payload;
    try {
        payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
        return fail(400, 'json');
    }

    const checked = validatePayload(payload, env);
    if (!checked.ok) return fail(400, checked.code);
    if (!checked.token) return fail(403, 'bot');

    let verdict = null;
    try {
        const res = await deps.fetch(SITEVERIFY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: checked.token, remoteip: ip || undefined }),
        });
        verdict = await res.json();
    } catch (e) {
        return fail(502, 'verify');
    }
    if (!turnstileOk(verdict, env, origin)) return fail(403, 'bot');

    const date = deps.now();
    let allowed = false;
    try {
        const counter = env.COUNTER.get(env.COUNTER.idFromName('daily'));
        allowed = await counter.take(date.toISOString().slice(0, 10), dailyLimit(env));
    } catch (e) {
        return fail(503, 'busy');
    }
    if (allowed !== true) return fail(429, 'daily');

    const raw = composeEmail(checked.clean, env, {
        messageId: deps.uuid() + '@' + domainOf(env.FEEDBACK_FROM),
        // 24 hex digits keep the Content-Type line under 78 characters.
        boundary: '=_fb_' + deps.uuid().replace(/-/g, '').slice(0, 24),
        date,
    });
    try {
        await env.SEND.send(new deps.EmailMessage(env.FEEDBACK_FROM, env.FEEDBACK_TO, raw));
    } catch (e) {
        return fail(502, 'send');
    }
    return reply(200, { ok: true });
}

module.exports = {
    LIMITS,
    SITEVERIFY,
    ADDRESS,
    checkConfig,
    dailyLimit,
    takeFromStore,
    checkOrigin,
    corsHeaders,
    allowedHostnames,
    linkOk,
    turnstileOk,
    validAddress,
    validatePayload,
    decodedBytes,
    headerField,
    subjectFor,
    formatBody,
    buildMime,
    composeEmail,
    handle,
};
