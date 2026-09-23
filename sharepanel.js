'use strict';
/**
 * sharepanel.js - the "share this link" panel every tool on this site carries.
 *
 * The panel itself is the same on all seven pages: a text input holding a URL, a status line, a
 * toggle that fills and opens it, a copy button with a three-step clipboard fallback, and a click
 * anywhere else that closes it. Only three things differ per page, and they are the arguments to
 * `SharePanel.init`: which function builds the URL, which element must NOT count as an outside
 * click (the page's own toggle button), and whether the panel carries a label that changes with
 * the kind of URL that came back.
 *
 * What stays with each page is `buildShareURL` itself: the field list, the short codes and the
 * encoding are that tool's own, and a link a reader saved has to keep decoding.
 *
 * Loaded as a classic script; it defines `toggleSharePanel` and `copyShareURL` on `window` from
 * inside an IIFE, because every page calls them from inline onclick markup and two top-level
 * declarations of the same name on one page is a SyntaxError.
 */
(() => {

const COPIED = '✓ Copied to clipboard';
const MANUAL = 'Select the URL above and press Ctrl+C / Cmd+C';

let buildURL = () => location.href;
let dismissSelector = null;   // an element inside this selector does not close the panel
let labelFor = null;          // (url) => string, for the pages whose label depends on the URL

const el = id => document.getElementById(id);

function toggleSharePanel() {
    const panel = el('share-panel');
    if (!panel) return;
    if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
    const input = el('share-url-input');
    const url = buildURL();
    if (input) input.value = url;
    const label = el('share-label');
    if (label && labelFor) label.textContent = labelFor(url);
    const status = el('share-status');
    if (status) status.textContent = '';
    panel.style.display = 'block';
    // After the paint that makes the panel visible: selecting a hidden input selects nothing.
    requestAnimationFrame(() => { if (input) input.select(); });
}

// Three ways to reach the clipboard, in order of what a browser will allow. The async API needs a
// secure context and the permission, execCommand still works where it does not, and a page opened
// from file:// may refuse both - so the last step tells the reader to copy the selection by hand.
async function copyShareURL() {
    const input = el('share-url-input');
    const status = el('share-status');
    if (!input) return;
    input.select();
    try {
        await navigator.clipboard.writeText(input.value);
        if (status) status.textContent = COPIED;
        return;
    } catch { /* fall through to execCommand */ }
    try {
        document.execCommand('copy');
        if (status) status.textContent = COPIED;
    } catch {
        if (status) status.textContent = MANUAL;
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
        const panel = el('share-panel');
        if (panel && panel.style.display === 'block' &&
            !panel.contains(e.target) &&
            !(dismissSelector && e.target.closest(dismissSelector))) {
            panel.style.display = 'none';
        }
    });
}

if (typeof window !== 'undefined') {
    window.toggleSharePanel = toggleSharePanel;
    window.copyShareURL = copyShareURL;
    window.SharePanel = {
        init({ build, toggle, label } = {}) {
            if (build) buildURL = build;
            if (toggle) dismissSelector = toggle;
            if (label) labelFor = label;
        },
        toggle: toggleSharePanel,
        copy: copyShareURL,
        COPIED, MANUAL,
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { toggleSharePanel, copyShareURL, COPIED, MANUAL };
}

})();
