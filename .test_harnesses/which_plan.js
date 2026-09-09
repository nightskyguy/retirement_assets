/**
 * which_plan.js -- which household does each harness actually run on?
 *
 *   node .test_harnesses/which_plan.js              every harness
 *   node .test_harnesses/which_plan.js cyclic       only those whose plan turns Cycle Brokerage on
 *   node .test_harnesses/which_plan.js aca          only those running an ACA cap
 *   node .test_harnesses/which_plan.js TX           substring match on any printed field
 *
 * WHY THIS EXISTS. Grep used to answer this. It does not any more, and the refit is what broke it:
 * a harness that reads `PLANS.get('bracket-filler-texas-cyclic')` contains the string
 * `cyclicEnabled` nowhere, so `grep cyclicEnabled .test_harnesses/` now UNDERCOUNTS - it misses
 * exactly the harnesses that were tidied up. That is a real cost of moving a literal behind a name,
 * and this is the thing that pays it back: it resolves the name and reports the property.
 *
 * It also still finds the harnesses that carry their own literal, so the two kinds are listed
 * together and the ones yet to be refitted are visible as `(literal)`.
 *
 * Nothing here simulates. It reads source and the plan bank, so it is instant.
 */

const fs = require('fs');
const path = require('path');
const bank = require('../plans');

const DIR = __dirname;
const filter = (process.argv[2] || '').toLowerCase();

const rows = [];
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.js') && f !== path.basename(__filename))) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    const ids = [...new Set([...src.matchAll(/PLANS\.get\(\s*["']([^"']+)["']\s*\)/g)].map(m => m[1]))];

    // Properties that decide whether a harness is exposed to a given engine path. Resolved through
    // the plan where there is one, and read off the file's own text where there is not.
    let aca = /strategy:\s*'aca'|stratACAMultiple:\s*[1-9]/.test(src);
    let cyclic = /cyclicEnabled:\s*true/.test(src);
    const states = new Set([...src.matchAll(/STATEname:\s*'([A-Z]{2})'/g)].map(m => m[1]));
    let horizon = null, ira = null;

    for (const id of ids) {
        let p; try { p = bank.get(id); } catch (e) { continue; }
        const i = p.inputs;
        if (i.strategy === 'aca' || (i.stratACAMultiple || 0) > 0) aca = true;
        if (i.cyclicEnabled) cyclic = true;
        if (i.STATEname) states.add(i.STATEname);
        horizon = p.notes.viability.funded;
        ira = (i.IRA1 || 0) + (i.IRA2 || 0);
    }

    rows.push({
        file: f,
        plans: ids.length ? ids.join(', ') : '(literal)',
        tags: [aca ? 'aca' : null, cyclic ? 'cyclic' : null].filter(Boolean).join('+') || '-',
        states: [...states].sort().join('/') || '-',
        funded: horizon || '-',
        ira: ira == null ? '-' : '$' + Math.round(ira / 1000) + 'k',
    });
}

const shown = filter
    ? rows.filter(r => Object.values(r).join(' ').toLowerCase().includes(filter))
    : rows;

const w = (s, n) => String(s).padEnd(n).slice(0, n);
console.log('');
console.log(w('harness', 32) + w('plan(s) it reads', 34) + w('paths', 8) + w('state', 7) + w('funded', 8) + 'IRA');
console.log('-'.repeat(97));
for (const r of shown.sort((a, b) => a.file.localeCompare(b.file)))
    console.log(w(r.file, 32) + w(r.plans, 34) + w(r.tags, 8) + w(r.states, 7) + w(r.funded, 8) + r.ira);
console.log('');
console.log(`${shown.length} of ${rows.length} harnesses`
    + (filter ? ` matching "${process.argv[2]}"` : '')
    + `; ${rows.filter(r => r.plans !== '(literal)').length} read the plan bank, `
    + `${rows.filter(r => r.plans === '(literal)').length} still carry their own literal.`);
console.log('');
