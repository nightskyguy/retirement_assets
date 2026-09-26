#!/usr/bin/env node
'use strict';
/**
 * check-asset-tokens.js - a staged asset whose cache token did not move blocks the commit.
 *
 * Run by .githooks/pre-commit. Standalone: `node .githooks/check-asset-tokens.js`.
 *
 * WHAT IT GUARDS. Every page loads its local scripts and stylesheets with a `?v=` token, and the
 * token is what a browser keys its cache on. Change `optimizer_core.js`, leave the token alone, and a
 * reader with the page already open gets the NEW html against the OLD engine - which is not a
 * failure, it is a silently wrong answer, and it reproduces on nobody's machine but theirs. It has
 * happened to this repo during development (a same-token reload served a stale stylesheet and the
 * page looked correct while the CSS it was tested against was not the one loaded).
 *
 * THE RULE. For every file staged in this commit, every tracked .html that references it with a
 * `?v=` token must reference it with a token DIFFERENT from the one in HEAD. Nothing is asserted
 * about the token's value: per-file tokens are deliberate here, so an unchanged asset keeps its
 * cache, and only what actually moved is invalidated.
 *
 * WHY NOT ONE ASSET_VERSION, which is what the code quality review asked for. One stamp appended to
 * everything makes a release edit one line, and invalidates every asset on every release - eight
 * scripts and three stylesheets re-fetched for a one-line change in the planner. The chore the review
 * was aiming at is not the fifteen tokens, it is FORGETTING one, and that is what this removes while
 * per-asset caching survives. The release stamp still has one home: the page <title>, which
 * optimizer_ui.js reads into APP_VERSION for the worker URL.
 *
 * NOT CHECKED, deliberately: the token's format, whether it matches the title, and .md files (no
 * page loads one with a token). A renamed asset is caught by the missing-reference check below.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sh = cmd => execSync(cmd, { encoding: 'utf8' }).trim();
const tracked = pattern => sh(`git ls-files ${pattern}`).split('\n').filter(Boolean);

// A page's references, as { asset path relative to repo root -> token }.
const REF = /(?:src|href)\s*=\s*"([^"?]+)\?v=([^"]*)"/g;
function refsOf(html, htmlPath) {
    const out = new Map();
    for (const m of html.matchAll(REF)) {
        const [, rel, token] = m;
        if (/^(https?:)?\/\//.test(rel)) continue;                 // a CDN, not ours to stamp
        // A leading slash is site-root absolute, which is how the Jekyll include in _includes/
        // references the repo root: that fragment is pasted into a page at the root, so resolving
        // it against its own directory would look for _includes/doclinks.js, which is not a file.
        const asset = rel.startsWith('/')
            ? path.posix.normalize(rel.slice(1))
            : path.posix.normalize(path.posix.join(path.posix.dirname(htmlPath), rel));
        out.set(asset, token);
    }
    return out;
}

function atHead(file) {
    try { return execSync(`git show HEAD:${file}`, { encoding: 'utf8' }); } catch { return null; }
}

const staged = sh('git diff --cached --name-only --diff-filter=ACMR').split('\n').filter(Boolean);
const pages = tracked('"*.html"');
const problems = [];
const missing = [];
let checkedPages = 0, checkedRefs = 0;

for (const page of pages) {
    if (!fs.existsSync(page)) continue;
    const now = refsOf(fs.readFileSync(page, 'utf8'), page);
    if (!now.size) continue;
    checkedPages++;
    checkedRefs += now.size;

    // A reference to a file that does not exist is a broken page whatever its token says.
    for (const asset of now.keys()) {
        if (!fs.existsSync(asset)) missing.push(`${page} -> ${asset}`);
    }

    const headHtml = atHead(page);
    const before = headHtml === null ? new Map() : refsOf(headHtml, page);
    for (const asset of staged) {
        if (!now.has(asset)) continue;
        if (asset === page) continue;                              // a page's own edit needs no token
        const wasToken = before.get(asset);
        if (wasToken === undefined) continue;                      // new reference: nothing to compare
        if (wasToken === now.get(asset)) {
            problems.push(`${asset} changed, but ${page} still loads it at ?v=${wasToken}`);
        }
    }
}

if (missing.length) {
    console.log('check-asset-tokens: BLOCKED - a page references a file that is not there:');
    for (const m of missing) console.log(`            ${m}`);
    process.exitCode = 1;
}
if (problems.length) {
    console.log('check-asset-tokens: BLOCKED - a changed asset kept its cache token:');
    for (const p of problems) console.log(`            ${p}`);
    console.log('            Bump that ?v= token in the same commit, or a reader with the page open');
    console.log('            gets the new page against the cached old file.');
    process.exitCode = 1;
}
if (!missing.length && !problems.length) {
    console.log(`check-asset-tokens: ${checkedRefs} tokens across ${checkedPages} pages, `
        + `every changed asset re-stamped.`);
}
