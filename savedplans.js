'use strict';
/**
 * savedplans.js - plans kept in the browser, and the .json files they export to and import from.
 *
 * Page-agnostic and DOM-free, so node can test it. A page creates one store and keeps its own UI:
 *
 *   const store = SavedPlans.create({ key, kind, toolName, formatVersion, appVersion });
 *   store.save(name, { payload, notes, summary })   -> { replaced, entry }
 *   store.list() / store.get(name) / store.remove(name) / store.put(entry)
 *   store.fileFor(entry)                             -> { filename, text }
 *   store.parseFile(text, fileName)                  -> { ok, entry, warnings } or { ok: false, reason, message }
 *
 * An entry is { kind, version, name, payload, savedAt, appVersion, notes, summary, sourceFile }.
 * `payload` is the page's own description of its inputs (for the Income Tax Planner, its share-link
 * keys as strings), and this module never reads inside it. `normalize` is the ONE way an entry enters
 * the store, from Save and from Import alike, so Import cannot store something Load would refuse.
 *
 * Every storage call is inside try/catch: a private window or blocked site data makes localStorage
 * throw, and that must give the page a message to show, not a dead page. `available()` says which.
 * A store that cannot be parsed is reported, never overwritten, so one bad write cannot erase the rest.
 */
(function (root) {

const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/** Strip a trailing extension only: `my.json.backup.json` -> `my.json.backup`. */
function stripFileExtension(name) {
    return String(name ?? '').replace(/\.[A-Za-z0-9]{1,8}$/, '');
}

/**
 * A file name every OS accepts. Must give the same answer as `safeExportFilename` in
 * optimizer_core.js, which the Retirement Optimizer uses until it moves onto this module; a test in
 * taxengine.tests.js holds the two together. Spaces are legal on Windows and are kept.
 */
function safeExportFilename(name, ext = '.json', fallback = 'retirement-plan') {
    let s = Array.from(String(name ?? '').trim())
        .filter(ch => ch.charCodeAt(0) >= 32)          // drop control characters
        .join('')
        .replace(/[<>:"/\\|?*]/g, '-')                 // illegal on Windows
        .replace(/[. ]+$/, '')                        // trailing dot or space
        .replace(/-{2,}/g, '-');
    if (!s || WIN_RESERVED.test(s)) s = s ? s + '-plan' : fallback;
    if (s.length > 120) s = s.slice(0, 120);
    return s + ext;
}

/** Compare release strings such as 'v2.16' and 'v2.18' segment by segment; 0 when either is unreadable. */
function compareVersions(a, b) {
    const parts = v => String(v ?? '').trim().replace(/^v/i, '').split('.').map(x => parseInt(x, 10));
    const pa = parts(a), pb = parts(b);
    if (pa.some(Number.isNaN) || pb.some(Number.isNaN)) return 0;
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] || 0) - (pb[i] || 0);
        if (d) return Math.sign(d);
    }
    return 0;
}

const isObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
const validDate = s => typeof s === 'string' && !Number.isNaN(Date.parse(s));

function create({
    key, kind, toolName, formatVersion = 1,
    appVersion = () => null,
    storage = () => root.localStorage,
    now = () => new Date().toISOString(),
    fileFallback = 'saved-plan',
} = {}) {
    if (!key || !kind || !toolName) throw new TypeError('SavedPlans.create needs key, kind and toolName');

    // One entry in its one shape. Throws on anything that is not a plan for this tool.
    function normalize(raw, { sourceFile = null } = {}) {
        if (!isObject(raw)) throw new Error('not a saved plan');
        if (raw.kind !== kind) throw new Error('not a saved plan for the ' + toolName);
        if (!isObject(raw.payload)) throw new Error('the plan carries no entries');
        // Only flat keys with scalar values: the payload is read back through the page's own reader,
        // which takes strings, so nothing else could ever mean anything.
        const payload = {};
        for (const [k, v] of Object.entries(raw.payload)) {
            if (/^[A-Za-z][A-Za-z0-9]*$/.test(k) && ['string', 'number', 'boolean'].includes(typeof v)) payload[k] = String(v);
        }
        return {
            kind,
            version:    Number.isInteger(raw.version) && raw.version > 0 ? raw.version : formatVersion,
            name:       typeof raw.name === 'string' ? raw.name.trim() : '',
            payload,
            savedAt:    validDate(raw.savedAt) ? raw.savedAt : now(),
            appVersion: typeof raw.appVersion === 'string' && raw.appVersion ? raw.appVersion : null,
            notes:      typeof raw.notes === 'string' ? raw.notes : '',
            summary:    isObject(raw.summary) ? raw.summary : null,
            sourceFile: typeof raw.sourceFile === 'string' ? raw.sourceFile : sourceFile,
        };
    }

    // { map, error }. A missing store is an empty one; an unreadable one is an error, so nothing
    // writes over it.
    function read() {
        let text;
        try { text = storage().getItem(key); }
        catch (e) { return { map: {}, error: 'unavailable' }; }
        if (text === null || text === undefined || text === '') return { map: {}, error: null };
        try {
            const map = JSON.parse(text);
            return isObject(map) ? { map, error: null } : { map: {}, error: 'unreadable' };
        } catch (e) {
            return { map: {}, error: 'unreadable' };
        }
    }

    function write(map) {
        try { storage().setItem(key, JSON.stringify(map)); }
        catch (e) {
            const err = new Error('This browser did not let the page save (a private window, blocked site data, or a full store).');
            err.storage = true;
            throw err;
        }
    }

    function writable() {
        const r = read();
        if (r.error === 'unreadable') {
            const err = new Error('The saved plans in this browser could not be read, so nothing was written over them.');
            err.storage = true;
            throw err;
        }
        if (r.error) {
            const err = new Error('This browser is not letting the page keep data.');
            err.storage = true;
            throw err;
        }
        return r.map;
    }

    function available() {
        try {
            const s = storage(), probe = key + ':probe';
            s.setItem(probe, '1');
            s.removeItem(probe);
            return read().error !== 'unavailable';
        } catch (e) {
            return false;
        }
    }

    /** A new entry for the plan on screen, stamped now with the current release. Not stored. */
    function makeEntry(name, { payload, notes = '', summary = null } = {}) {
        return normalize({ kind, version: formatVersion, name, payload, savedAt: now(),
                           appVersion: appVersion(), notes, summary });
    }

    /** Every readable entry, newest first, as [{ name, entry }]; `error` names a store that failed. */
    function list() {
        const r = read();
        const out = [];
        for (const [name, raw] of Object.entries(r.map)) {
            try { out.push({ name, entry: { ...normalize(raw), name } }); } catch (e) { /* not ours: left in place */ }
        }
        out.sort((a, b) => Date.parse(b.entry.savedAt) - Date.parse(a.entry.savedAt));
        out.error = r.error;
        return out;
    }

    function get(name) {
        const raw = read().map[name];
        if (raw === undefined) return null;
        try { return { ...normalize(raw), name }; } catch (e) { return null; }
    }

    /** Store an already-built entry under its name; `replaced` says a plan of that name was overwritten. */
    function put(entry) {
        const e = normalize(entry);
        if (!e.name) throw new Error('a saved plan needs a name');
        const map = writable();
        const replaced = Object.prototype.hasOwnProperty.call(map, e.name);
        map[e.name] = e;
        write(map);
        return { replaced, entry: e };
    }

    function save(name, fields) {
        return put(makeEntry(String(name ?? '').trim(), fields));
    }

    function remove(name) {
        const map = writable();
        if (!Object.prototype.hasOwnProperty.call(map, name)) return false;
        delete map[name];
        write(map);
        return true;
    }

    /** The file an entry exports to. Where it was imported from stays in this browser. */
    function fileFor(entry) {
        const e = normalize(entry);
        const { sourceFile, ...out } = e;
        if (!out.appVersion) out.appVersion = appVersion();
        return { filename: safeExportFilename(e.name, '.json', fileFallback), text: JSON.stringify(out, null, 2) };
    }

    /**
     * Read an imported file. Refused files are named for what they are and nothing of them is kept:
     * a Retirement Optimizer plan (its files wrap their inputs in `data`), another tool's plan, or
     * anything that is not JSON. A file from a later release loads, with a warning saying so.
     */
    function parseFile(text, fileName = '') {
        const file = String(fileName || 'The file');
        const refuse = (reason, message) => ({ ok: false, reason, message });
        let raw;
        try { raw = JSON.parse(String(text)); }
        catch (e) { return refuse('json', `${file} is not a saved plan file: it is not readable as JSON. Nothing was loaded or saved.`); }
        if (isObject(raw) && raw.kind === kind) {
            let entry;
            try { entry = normalize(raw, { sourceFile: fileName || null }); }
            catch (e) { return refuse('broken', `${file} is damaged: ${e.message}. Nothing was loaded or saved.`); }
            if (!entry.name) entry.name = stripFileExtension(fileName).trim() || 'Imported plan';
            const warnings = [];
            const cur = appVersion();
            if (entry.appVersion && cur && compareVersions(entry.appVersion, cur) > 0) {
                warnings.push(`This file was saved by ${entry.appVersion} of the ${toolName} and you are on ${cur}. ` +
                              'It may not load exactly as it was saved. Check the entries after loading.');
            } else if (entry.version > formatVersion) {
                warnings.push(`This file was written in a newer format than this release reads. ` +
                              'It may not load exactly as it was saved. Check the entries after loading.');
            }
            return { ok: true, entry, warnings };
        }
        if (isObject(raw) && isObject(raw.data)) {
            return refuse('optimizer', `${file} is a Retirement Optimizer plan, not a plan for the ${toolName}, so ` +
                                       'nothing was loaded or saved. Open it in the Retirement Optimizer with its own Import.');
        }
        return refuse('other', `${file} is not a plan for the ${toolName}, so nothing was loaded or saved.`);
    }

    return { key, kind, toolName, formatVersion, available, normalize, makeEntry, list, get, put, save, remove,
             fileFor, parseFile };
}

const api = { create, safeExportFilename, stripFileExtension, compareVersions };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.SavedPlans = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
