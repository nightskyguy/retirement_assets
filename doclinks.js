/* doclinks.js - bridges the gap between the .md files on disk and the .html pages
   GitHub Pages serves.

   GitHub Pages runs Jekyll over this repo on every push to main and publishes each
   .md file as themed HTML at its .html URL, so optimizer_changelog.html exists on the
   live site even though it is not a file in the repo. Jekyll runs ONLY on GitHub's
   servers: file:// and `python -m http.server` have no .html for any .md.

   So the hrefs in the markup stay .md - true on disk, works locally - and this file
   upgrades them to .html at runtime when the page is served from a non-local origin.
   Same idea as the depth-aware path rewrite in other_tools.js.

   Where the visible link text IS the filename ("optimizer_changelog.md"), the label is
   swapped too. Rewriting the href alone left the page reading .md while the link went to
   .html, which reads as a bug whichever half you look at.

   Loaded with `defer` from retirement_optimizer.html and, on the Jekyll-rendered doc
   pages, from _includes/head-custom.html. Also decorates those rendered pages: mermaid
   fences (which Jekyll leaves as plain <pre>) get a link to GitHub's blob view, which
   renders them, and the otherwise dead-end pages get a link back to the tool.

   DO NOT add a .nojekyll file to this repo - it would stop the rendering this relies on. */
(function () {
  'use strict';

  var REPO_BLOB = 'https://github.com/nightskyguy/retirement_assets/blob/main/';

  // ── Pure mapping (node-testable) ──────────────────────────────────────────

  // Rewrite a relative *.md href to the Jekyll-rendered page it becomes on Pages.
  // Returns href unchanged for anything it should not touch.
  function docHref(href, rendered) {
    if (!rendered || typeof href !== 'string' || !href) return href;

    // Absolute URLs and protocol-relative URLs are off limits. The Jekyll theme
    // footer emits an https://github.com/.../edit/main/<file>.md link on every
    // rendered page; rewriting that would break "Improve this page".
    if (/^[a-z][a-z0-9+.\-]*:/i.test(href) || href.slice(0, 2) === '//') return href;
    if (href.charAt(0) === '#') return href;

    var cut = href.search(/[?#]/);
    var path = cut === -1 ? href : href.slice(0, cut);
    var tail = cut === -1 ? '' : href.slice(cut);

    if (!/\.md$/i.test(path)) return href;

    // Jekyll skips dot-directories, so nothing under .planning/ is published in any
    // form. Leave those alone rather than pointing at a .html that also 404s.
    if (/(^|\/)\.[^./]/.test(path)) return href;

    // README.md becomes the site index, not README.html (that 404s).
    if (/(^|\/)README\.md$/i.test(path)) {
      var dir = path.slice(0, path.length - 'README.md'.length);
      return (dir || './') + tail;
    }

    return path.slice(0, -3) + '.html' + tail;
  }

  // A link whose visible text IS the filename has to be relabelled with the href, or the
  // page tells the reader ".md" while sending them to ".html". Only that case: link text
  // like "Details" or "Improve this page" describes the destination rather than naming it,
  // and must not be touched.
  //
  // Returns the text unchanged unless the href actually moved, the old text is exactly the
  // old basename, and the new href is a .html page. The README case (README.md -> "./")
  // therefore falls through untouched: "README.md" is still the honest name of what sits at
  // the site root, and there is no filename to swap in.
  function docLabel(text, oldHref, newHref) {
    if (typeof text !== 'string' || oldHref === newHref) return text;
    var base = function (h) {
      var cut = h.search(/[?#]/);
      return (cut === -1 ? h : h.slice(0, cut)).split('/').pop();
    };
    var oldBase = base(oldHref);
    var newBase = base(newHref);
    if (!oldBase || !/\.html$/i.test(newBase)) return text;
    if (text.trim() !== oldBase) return text;
    return text.replace(oldBase, newBase);   // replace, not rebuild: keeps any padding
  }

  // ── Origin detection ──────────────────────────────────────────────────────

  // True when this page came from the deployed site, i.e. somewhere Jekyll ran.
  // window.__DOCLINKS_FORCE_RENDERED overrides it, so the rewrite can be exercised
  // from localhost without deploying.
  function isRendered() {
    if (typeof window.__DOCLINKS_FORCE_RENDERED === 'boolean') {
      return window.__DOCLINKS_FORCE_RENDERED;
    }
    return /^https?:$/.test(window.location.protocol) &&
           !/^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(window.location.hostname);
  }

  // ── DOM passes ────────────────────────────────────────────────────────────

  function rewriteLinks(rendered) {
    // Document-wide on purpose. retirement_optimizer.html copies the first changelog
    // <li>'s innerHTML into the LATEST CHANGE banner during parse, so by the time this
    // deferred script runs there are TWO copies of the newest Details link. Scoping the
    // sweep to #changelog-list would leave the banner's copy pointing at the raw .md.
    var links = document.querySelectorAll('a[href]');
    var n = 0;
    for (var i = 0; i < links.length; i++) {
      var raw = links[i].getAttribute('href');
      var next = docHref(raw, rendered);
      if (next !== raw) {
        links[i].setAttribute('href', next);
        // Guard on childElementCount: relabelling reads and rewrites textContent, which would
        // flatten any markup inside the anchor. Every filename-labelled link here is plain
        // text (the <strong> at retirement_optimizer.html:631 wraps the <a>, not the reverse).
        if (links[i].childElementCount === 0) {
          var label = docLabel(links[i].textContent, raw, next);
          if (label !== links[i].textContent) links[i].textContent = label;
        }
        n++;
      }
    }
    return n;
  }

  // The .md file this rendered page was generated from. Takes the pathname as an
  // argument so it can be tested without a DOM.
  function sourceFile(pathname) {
    var p = typeof pathname === 'string' ? pathname : window.location.pathname;
    var name = p.split('/').pop() || '';
    if (!name || name === 'index.html') return 'README.md';
    return name.replace(/\.html$/i, '.md');
  }

  // Nearest heading above `el` that carries an id, so the GitHub link lands on the
  // right section rather than the top of a long file.
  function precedingHeadingId(el) {
    for (var node = el; node; node = node.parentNode) {
      for (var sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
        if (/^H[1-6]$/.test(sib.tagName) && sib.id) return sib.id;
      }
      if (node.parentNode === document.body) break;
    }
    return '';
  }

  // Jekyll renders a ```mermaid fence as <pre><code class="language-mermaid">, i.e. the
  // diagram source as text. No mermaid library here by design; GitHub's blob view draws
  // the diagram, so point at it.
  function captionMermaid(root) {
    var scope = root || document;
    var blocks = scope.querySelectorAll('pre > code.language-mermaid');
    if (!blocks.length) return 0;
    var file = sourceFile();
    for (var i = 0; i < blocks.length; i++) {
      var pre = blocks[i].parentNode;
      var id = precedingHeadingId(pre);
      var cap = document.createElement('div');
      cap.className = 'mermaid-caption';
      cap.innerHTML = 'Diagram source. ' +
        '<a href="' + REPO_BLOB + file + (id ? '#' + id : '') + '">View it rendered on GitHub</a>.';
      pre.parentNode.insertBefore(cap, pre);
      pre.className = (pre.className ? pre.className + ' ' : '') + 'mermaid-source';
    }
    return blocks.length;
  }

  // The rendered doc pages have no navigation at all, so give them a way back. Skipped
  // on the site index, which is the rendered README and already links every tool.
  function addBackLink() {
    if (sourceFile() === 'README.md') return false;
    var body = document.querySelector('.markdown-body');
    if (!body || document.querySelector('.doc-nav')) return false;
    var nav = document.createElement('div');
    nav.className = 'doc-nav';
    nav.innerHTML = '<a href="/retirement_optimizer.html">&larr; Retirement Optimizer</a>' +
                    '<a href="/">&uarr; All tools</a>';
    body.insertBefore(nav, body.firstChild);
    return true;
  }

  function init() {
    var rendered = isRendered();
    rewriteLinks(rendered);
    captionMermaid();
    addBackLink();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  var DocLinks = {
    docHref: docHref,
    docLabel: docLabel,
    isRendered: isRendered,
    rewriteLinks: rewriteLinks,
    sourceFile: sourceFile,
    captionMermaid: captionMermaid,
    addBackLink: addBackLink,
    init: init
  };

  if (typeof window !== 'undefined') {
    window.DocLinks = DocLinks;
    // Loaded with `defer`, so the document is already parsed; the readyState guard is
    // only insurance against a future non-deferred tag.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  // Dual-mode export: inert in browser (classic script); lets Node tests require() this file.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DocLinks;
  }

})();
