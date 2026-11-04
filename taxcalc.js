#!/usr/bin/env node
'use strict';
// taxcalc.js - the Income Tax Planner's tax calculation from a command line, a CSV file, or a small
// local server, so a spreadsheet can ask for the tax on its own figures. Nothing leaves the machine.
//
//   node taxcalc.js "st=SGL&s=CA&wg=60000&ss=24000"          one result line
//   node taxcalc.js st=SGL s=CA wg=60000 return=fedTax,stateTax,totalTax
//   node taxcalc.js "st=SGL&s=CA&ss=24000&vary=wg:40000,60000,80000"   one line per value
//   node taxcalc.js --csv scenarios.csv [--out results.csv] [return=...]  one result row per input row,
//                                    names on the first line; the first row of the CSV names the columns
//   node taxcalc.js --serve [port]            answers http://127.0.0.1:8765/?st=SGL&s=CA&wg=60000
//
// The parameter names are the Income Tax Planner's link keys (UsageGuide.md), and the result line is
// the one its `return` link gives. Beyond those keys:
//   return=a,b,c   the fields to write: a comma list, `all`, or nothing for the default set
//   vary=key:v1,v2 repeat the request once per value of ONE key, one line each
//   header=1       put the field names on the first line
//   v=1            the output format. Fields are only ever added at the END of a line, never renamed
//                  or reordered; a different number than this tool writes is refused.
// An error is a single line beginning "ERROR:" so it cannot pass as a number. On the command line it
// also exits 1; the server answers it with HTTP 200 and that line, because LibreOffice's WEBSERVICE()
// shows #VALUE! for any other status and hides the reason.

const http = require('http');
const fs = require('fs');
const TaxCalc = require('./taxcalc_core.js');

const FORMAT_VERSION = '1';
const MAX_ROWS = 20000;

// ─── ONE REQUEST ─────────────────────────────────────────────────────────────
// `query` is a URLSearchParams. Returns { ok, text }.
function answer(query) {
  const v = query.get('v');
  if (v !== null && v !== FORMAT_VERSION) {
    return { ok: false, text: `ERROR: this tool writes format version ${FORMAT_VERSION}, not ${v}` };
  }
  const header = ['1', 'true'].includes((query.get('header') || '').trim());
  const vary = query.get('vary');
  let key = null, values = [null];
  if (vary !== null) {
    const at = vary.indexOf(':');
    key = at > 0 ? vary.slice(0, at).trim() : '';
    values = at > 0 ? vary.slice(at + 1).split(',').map(s => s.trim()) : [];
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(key) || values.length === 0 || values.some(s => s === '')) {
      return { ok: false, text: 'ERROR: vary needs the form key:value1,value2 (for example vary=wg:40000,60000)' };
    }
    if (values.length > MAX_ROWS) return { ok: false, text: `ERROR: vary has more than ${MAX_ROWS} values` };
  }
  const lines = [];
  for (let i = 0; i < values.length; i++) {
    const get = k => (key !== null && k === key) ? values[i] : query.get(k);
    const r = TaxCalc.run(get, { header: header && i === 0 });
    if (!r.ok) return { ok: false, text: r.csv };
    lines.push(r.csv);
  }
  return { ok: true, text: lines.join('\n') };
}

// ─── A CSV OF SCENARIOS ──────────────────────────────────────────────────────
// RFC 4180 enough for what a spreadsheet writes: quoted cells, doubled quotes, CRLF or LF.
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}

// The first row names the columns (link keys; a column that is not one is ignored, so a sheet can keep
// a Year or Label column beside them), and each later row is one scenario. A blank cell is absent.
// `settings` carries return / v from the command line. The output always has the field names first,
// since a sheet needs them for its columns.
function answerCsv(text, settings) {
  const v = settings.get('v');
  if (v !== null && v !== FORMAT_VERSION) {
    return { ok: false, text: `ERROR: this tool writes format version ${FORMAT_VERSION}, not ${v}` };
  }
  const rows = parseCsv(text);
  if (rows.length < 2) return { ok: false, text: 'ERROR: the CSV needs a header row and at least one scenario row' };
  const names = rows[0].map(s => s.trim());
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const get = k => {
      if (settings.has(k)) return settings.get(k);
      const at = names.indexOf(k);
      if (at < 0 || at >= cells.length || cells[at].trim() === '') return null;
      return cells[at];
    };
    const r = TaxCalc.run(get, { header: i === 1 });
    if (!r.ok) return { ok: false, text: `ERROR: row ${i + 1}: ${r.csv.replace(/^ERROR: /, '')}` };
    out.push(r.csv);
  }
  return { ok: true, text: out.join('\n') };
}

// ─── THE LOCAL SERVER ────────────────────────────────────────────────────────
// Loopback only. OPTIONS and HEAD are answered with headers and no work, since LibreOffice's
// WEBSERVICE() sends an OPTIONS before its GET.
function makeServer() {
  return http.createServer((req, res) => {
    const headers = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' };
    if (req.method === 'OPTIONS') { res.writeHead(204, { Allow: 'GET, HEAD, OPTIONS' }); return res.end(); }
    if (req.method === 'HEAD') { res.writeHead(200, headers); return res.end(); }
    if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET, HEAD, OPTIONS' }); return res.end(); }
    const q = new URL(req.url, 'http://127.0.0.1').searchParams;
    const r = answer(q);
    res.writeHead(200, headers);
    res.end(r.text);
  });
}

// ─── COMMAND LINE ────────────────────────────────────────────────────────────
function main(argv) {
  const args = argv.slice();
  const flag = (name) => { const i = args.indexOf(name); if (i < 0) return null; args.splice(i, 1); return true; };
  const option = (name) => {
    const i = args.indexOf(name);
    if (i < 0) return null;
    const v = args[i + 1];
    args.splice(i, v === undefined || v.startsWith('--') ? 1 : 2);
    return v === undefined || v.startsWith('--') ? '' : v;
  };
  if (flag('--help') || flag('-h')) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 22).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); return 0; }

  const serve = option('--serve');
  const csvFile = option('--csv');
  const outFile = option('--out');
  const withHeader = flag('--header');
  // What is left is a query string, or key=value words that are joined into one.
  const text = args.join('&').replace(/^\?/, '');
  const query = new URLSearchParams(text);
  if (withHeader) query.set('header', '1');

  if (serve !== null) {
    const port = /^\d+$/.test(serve) ? +serve : 8765;
    const server = makeServer();
    server.on('error', e => { console.error('taxcalc: ' + e.message); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () =>
      console.log(`taxcalc listening on http://127.0.0.1:${port}/?st=SGL&s=CA&wg=60000   (Ctrl+C to stop)`));
    return 0;
  }
  let r;
  if (csvFile !== null) {
    if (!csvFile) { console.error('taxcalc: --csv needs a file name'); return 1; }
    let input;
    try { input = fs.readFileSync(csvFile, 'utf8'); } catch (e) { console.error('taxcalc: ' + e.message); return 1; }
    r = answerCsv(input, query);
    if (r.ok && outFile) { fs.writeFileSync(outFile, r.text + '\n'); return 0; }
  } else if (!text) {
    console.error('taxcalc: nothing to calculate. Try: node taxcalc.js "st=SGL&s=CA&wg=60000"   (--help for more)');
    return 1;
  } else r = answer(query);
  if (!r.ok) { console.error(r.text); return 1; }
  console.log(r.text);
  return 0;
}

if (require.main === module) {
  const code = main(process.argv.slice(2));
  if (code) process.exitCode = code;
}
module.exports = { answer, answerCsv, parseCsv, makeServer, FORMAT_VERSION };
