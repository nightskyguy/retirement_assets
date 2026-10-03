#!/usr/bin/env node
'use strict';
/**
 * libreoffice_probe.js - a throwaway local server for finding out how LibreOffice Calc talks to one.
 *
 *   node prototypes/libreoffice_probe.js            # listens on 127.0.0.1:8765
 *   node prototypes/libreoffice_probe.js 9000       # another port
 *   node prototypes/libreoffice_probe.js --full-head   # HEAD does the work too, for comparison
 *
 * It answers with real tax figures (taxengine.js) so it is a working prototype of the local tax
 * server in TaxCalculateProposal.md, and it prints every request it receives, so the number and kind
 * of requests each Calc feature makes can be counted. Nothing is written to disk and nothing is
 * reachable from another machine.
 *
 * WHAT TO TRY IN CALC, one at a time, then look at the console (or http://127.0.0.1:8765/stats):
 *
 *   1. WEBSERVICE, one scenario:
 *        =WEBSERVICE("http://127.0.0.1:8765/tax.csv?st=SGL&s=CA&ss=24000&wg=60000")
 *      How many requests, and of which methods?
 *   2. WEBSERVICE, a batch split in the sheet (rows are scenarios, columns are fields):
 *        =WEBSERVICE("http://127.0.0.1:8765/tax.csv?st=SGL&s=CA&ss=24000&vary=wg:40000,60000,80000")
 *        =TEXTSPLIT(A1, ",", CHAR(10))
 *   3. Sheet > Link to External Data...: URL http://127.0.0.1:8765/tax.html?st=SGL&s=CA&ss=24000&vary=wg:40000,60000,80000
 *      pick the table, and set "Update every" to a few seconds. Count the requests per refresh.
 *      Try the .csv address too: it shows whether Calc will take a plain CSV from an address.
 *   4. Whether Calc asks you to trust the link each time, and in which of the cases above.
 *
 * Open /stats to see the counts by method, and /stats?reset=1 to zero them between experiments. Neither
 * /stats nor /mark counts itself. /mark?label=reopened prints a separator line in the console, to tell
 * one step of an experiment from the next in the log.
 */
const http = require('http');
const path = require('path');
const { calculateTaxes, TAXData } = require(path.join(__dirname, '..', 'taxengine.js'));

const PORT = parseInt(process.argv.find(a => /^\d+$/.test(a)) || '8765', 10);
const FULL_HEAD = process.argv.includes('--full-head');
const HOST = '127.0.0.1';   // this machine only
const FIELDS = ['wg', 'agi', 'fedTax', 'stateTax', 'totalTax'];

// One scenario: filing status, state, ages, Social Security and an ordinary income (wg). The tax
// year is the engine's own 2026 tables, with no inflation.
function scenario(q, wg) {
  const single = (q.get('st') || 'MFJ') === 'SGL';
  const state = (q.get('s') || 'CA').toUpperCase();
  if (!TAXData[state] || TAXData[state].STATE === undefined) throw new Error('unknown state ' + state);
  const r = calculateTaxes({
    filingStatus: single ? 'SGL' : 'MFJ',
    ages: single ? [+(q.get('a1') || 65)] : [+(q.get('a1') || 65), +(q.get('a2') || 65)],
    earnedIncome: wg,
    totalSS: +(q.get('ss') || 0),
    state,
    inflation: 1, obbaOn: true, saltHigh: true, taxYear: 2026,
  });
  if (r.error) throw new Error(r.error);
  const cents = v => Math.round(v * 100) / 100;
  return [wg, r.AGI, r.federalTax, r.stateTax, r.totalTax].map(cents);
}

// The rows asked for: the one wg, or one row per value of vary=wg:v1,v2,...
function rows(q) {
  const vary = q.get('vary');
  if (!vary) return [scenario(q, +(q.get('wg') || 0))];
  const [name, list] = vary.split(':');
  if (name !== 'wg' || !list) throw new Error('vary must look like wg:40000,60000');
  return list.split(',').map(v => scenario(q, +v));
}

const counts = {};
// /stats and /mark are for the person running the experiment, so they are logged but not counted.
const note = (req) => {
  if (!/^\/(stats|mark)(\?|$)/.test(req.url)) counts[req.method] = (counts[req.method] || 0) + 1;
  const ua = String(req.headers['user-agent'] || '').slice(0, 40);
  console.log(new Date().toISOString().slice(11, 23), req.method.padEnd(7), req.url, '|', ua,
              '| conn:', req.headers.connection || '-');
};

const server = http.createServer((req, res) => {
  note(req);
  const url = new URL(req.url, 'http://x');

  // The two probes Calc's WEBSERVICE sends before it fetches: headers only, no calculation.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { Allow: 'GET, HEAD, OPTIONS' });
    return res.end();
  }
  if (req.method === 'HEAD' && !FULL_HEAD) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end();
  }

  try {
    if (url.pathname === '/mark') {
      console.log('-------- ' + (url.searchParams.get('label') || 'mark') + ' --------');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('ok' + String.fromCharCode(10));
    }
    if (url.pathname === '/stats') {
      if (url.searchParams.get('reset')) for (const k of Object.keys(counts)) delete counts[k];
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(JSON.stringify(counts, null, 1) + '\n');
    }
    if (url.pathname === '/tax.csv') {
      const body = rows(url.searchParams).map(r => r.join(',')).join('\n');
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }
    if (url.pathname === '/tax.html') {
      const head = '<tr>' + FIELDS.map(f => `<th>${f}</th>`).join('') + '</tr>';
      const body = rows(url.searchParams).map(r => '<tr>' + r.map(v => `<td>${v}</td>`).join('') + '</tr>').join('');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(req.method === 'HEAD' ? undefined
        : `<!doctype html><meta charset="utf-8"><title>tax</title><table>${head}${body}</table>`);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found\n');
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('ERROR: ' + e.message + '\n');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`probe on http://${HOST}:${PORT}  (HEAD ${FULL_HEAD ? 'does the work' : 'is answered with headers only'})`);
  console.log('  /tax.csv  /tax.html  /stats   ?st=SGL&s=CA&ss=24000&wg=60000  or  &vary=wg:40000,60000');
});
