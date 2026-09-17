'use strict';
/* local-server.cjs - the feedback Worker's own handle(), run by plain node, so the page can be tested
   end to end without a Cloudflare account and without installing anything.

     node .feedback-worker/local-server.cjs

   It listens on localhost:8787, the address feedback.js posts to when a page served from localhost
   is opened with ?fbdev. Instead of sending mail it writes each message to .feedback-worker/.outbox/
   as an .eml file, which any mail program can open. The bot check is real: the page gets Cloudflare's
   always-pass test token and this server asks Cloudflare to confirm it, exactly as the Worker does.
   Addresses and the secret come from .dev.vars when that file exists (see .dev.vars.example). */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const logic = require('./src/logic.cjs');

const PORT = Number(process.env.PORT) || 8787;
const OUTBOX = path.join(__dirname, '.outbox');

function devVars() {
    const vars = {
        FEEDBACK_TO: 'owner@example.com',
        FEEDBACK_FROM: 'feedback@example.com',
        TURNSTILE_SECRET: '1x0000000000000000000000000000000AA',
        DAILY_LIMIT: '50',
    };
    const file = path.join(__dirname, '.dev.vars');
    if (fs.existsSync(file)) {
        for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
            if (m) vars[m[1]] = m[2];
        }
    }
    if (process.env.DAILY_LIMIT) vars.DAILY_LIMIT = process.env.DAILY_LIMIT;
    return vars;
}

// wrangler.jsonc's three-a-minute rule, kept in memory.
const hits = new Map();
const RL = {
    async limit({ key }) {
        const now = Date.now();
        const recent = (hits.get(key) || []).filter(t => now - t < 60000);
        recent.push(now);
        hits.set(key, recent);
        return { success: recent.length <= 3 };
    },
};

const SEND = {
    async send(message) {
        fs.mkdirSync(OUTBOX, { recursive: true });
        const file = path.join(OUTBOX, new Date().toISOString().replace(/[:.]/g, '-') + '.eml');
        fs.writeFileSync(file, message.raw);
        console.log('  wrote ' + file + ' (' + message.raw.length + ' bytes)');
    },
};

// The Durable Object that keeps the day's count, as a Map. Same counting rule (logic.takeFromStore).
const counterStore = new Map();
const COUNTER = {
    idFromName: name => name,
    get: () => ({
        take: (day, limit) => logic.takeFromStore({
            get: async key => counterStore.get(key),
            put: async (key, value) => { counterStore.set(key, value); },
        }, day, limit),
    }),
};

class EmailMessage {
    constructor(from, to, raw) {
        this.from = from;
        this.to = to;
        this.raw = raw;
    }
}

const env = Object.assign({
    ALLOWED_ORIGINS: 'https://tools.netcitizen.us',
    ALLOW_LOCALHOST: '1',
    SEND,
    RL,
    COUNTER,
}, devVars());

const deps = {
    EmailMessage,
    fetch: (url, init) => fetch(url, init),
    uuid: () => crypto.randomUUID(),
    now: () => new Date(),
};

async function serve(req, res) {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
        if (typeof value === 'string' && name !== 'host' && name !== 'connection') headers.set(name, value);
    }
    headers.set('CF-Connecting-IP', req.socket.remoteAddress || '');
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const request = new Request('http://localhost:' + PORT + req.url, {
        method: req.method,
        headers,
        body: hasBody ? Readable.toWeb(req) : undefined,
        duplex: hasBody ? 'half' : undefined,
    });
    const response = await logic.handle(request, env, deps);
    // A refusal can come before the body is read, and a kept-alive connection would then carry the
    // unread rest into the next request. Cloudflare deals with that itself; here, close each time.
    res.writeHead(response.status, Object.assign(Object.fromEntries(response.headers), { Connection: 'close' }));
    res.end(Buffer.from(await response.arrayBuffer()));
    console.log(req.method + ' -> ' + response.status + '  (origin ' + (req.headers.origin || 'none') + ')');
}

const missing = logic.checkConfig(env);
if (missing.length) {
    console.error('Not configured: ' + missing.join(', ') + '. Check .dev.vars.');
    process.exit(1);
}

// Both loopback addresses, because a browser may resolve "localhost" to either.
for (const host of ['127.0.0.1', '::1']) {
    http.createServer((req, res) => {
        serve(req, res).catch(e => {
            console.error(e);
            if (!res.headersSent) res.writeHead(500);
            res.end();
        });
    })
        .on('error', e => {
            if (e.code === 'EADDRNOTAVAIL' || e.code === 'EAFNOSUPPORT') return;   // no IPv6 here
            throw e;
        })
        .listen(PORT, host, () => {
            console.log('feedback Worker, local copy: http://' + (host.includes(':') ? '[' + host + ']' : host) + ':' + PORT
                + '/  (at most ' + env.DAILY_LIMIT + ' messages a day)');
        });
}
