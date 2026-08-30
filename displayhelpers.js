/* displayhelpers.js — shared numeric input helpers and tooltip utilities */
(function () {
  'use strict';

  // ── Parsing ──────────────────────────────────────────────────────────────

  function parseShorthand(str) {
    if (typeof str === 'number') return isNaN(str) ? null : str;
    var s = String(str).trim().replace(/[$,\s]/g, '');
    if (!s) return null;
    var mult = 1;
    var last = s.slice(-1).toLowerCase();
    if (last === 'b') { mult = 1e9; s = s.slice(0, -1); }
    else if (last === 'm') { mult = 1e6; s = s.slice(0, -1); }
    else if (last === 'k') { mult = 1e3; s = s.slice(0, -1); }
    var v = parseFloat(s) * mult;
    return isNaN(v) ? null : v;
  }

  // ── Formatting ───────────────────────────────────────────────────────────

  function formatDollar(val) {
    return '$' + Math.round(val).toLocaleString('en-US');
  }

  // P92e. A SHORT dollar for places that show several amounts side by side and have no room for
  // full digits - the Limit dropdown, where every entry now carries its position on the other
  // income ladder as well as its own figure.
  //
  // Three significant figures, so the low end keeps the precision that makes it meaningful:
  // $24.8k rather than $25k, while $211,400 is simply $211k. Round thousands lose the trailing
  // zeros ($274k, not $274.0k).
  //
  // NOT compactNum() in optimizer_core.js, which looks like this and is not: that one compresses a
  // number to the shortest string parseShorthand() decodes back EXACTLY, for share URLs, so it
  // renders 100000 as "1e5" and gives up entirely on anything that will not round-trip. This one is
  // lossy on purpose and is for reading.
  var SHORT_UNITS = [[1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
  function formatDollarShort(val) {
    // null/undefined/'' explicitly, because Number() turns all three into 0 and "$0" is a lie about
    // a missing value in a place that is showing real thresholds.
    if (val === null || val === undefined || val === '') return '';
    var n = Number(val);
    if (!isFinite(n)) return '';
    var sign = n < 0 ? '-$' : '$';
    n = Math.abs(n);
    var u = -1;
    // Forward, so the FIRST match is the LARGEST unit that fits; backwards would call a billion "k".
    for (var i = 0; i < SHORT_UNITS.length; i++) if (n >= SHORT_UNITS[i][0]) { u = i; break; }
    if (u < 0) return sign + Math.round(n).toLocaleString('en-US');
    // 3 significant figures across the scaled value's whole 1..999 range.
    var scaled = n / SHORT_UNITS[u][0];
    var out = scaled.toFixed(scaled >= 100 ? 0 : (scaled >= 10 ? 1 : 2));
    // Rounding can push a value up into the next unit ($999,500 -> "1000k"), which belongs there
    // rather than here. Step up ONCE, and only when there is a unit to step up into - iterating
    // instead would not terminate above the largest one.
    if (parseFloat(out) >= 1000 && u > 0) {
      u -= 1;
      scaled = n / SHORT_UNITS[u][0];
      out = scaled.toFixed(scaled >= 100 ? 0 : (scaled >= 10 ? 1 : 2));
    }
    if (out.indexOf('.') >= 0) out = out.replace(/\.?0+$/, '');
    return sign + out + SHORT_UNITS[u][1];
  }

  // ── Input attachment ─────────────────────────────────────────────────────

  // Attaches smart numeric behaviour to a <input type="text"> element.
  // opts: { min, max, onChange(val) }
  function attachNumericDollarInput(el, opts) {
    opts = opts || {};

    // Seed dataset with whatever initial value is in the field
    var seed = parseShorthand(el.value);
    if (seed !== null) {
      var seeded = clamp(seed, opts);
      el.dataset.numVal = String(seeded);
      el.value = formatDollar(seeded);
    }

    el.addEventListener('focus', function () {
      // Strip formatting so user can type freely
      var raw = el.dataset.numVal;
      el.value = raw !== undefined ? raw : el.value.replace(/[$,]/g, '');
      el.select();
    });

    el.addEventListener('blur', function () {
      var v = parseShorthand(el.value);
      if (v === null) {
        // Restore last valid
        var prev = el.dataset.numVal;
        el.value = prev !== undefined ? formatDollar(parseFloat(prev)) : el.value;
        return;
      }
      var clamped = clamp(v, opts);
      el.dataset.numVal = String(clamped);
      el.value = formatDollar(clamped);
      if (typeof opts.onChange === 'function') opts.onChange(clamped);
    });

    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') el.blur();
    });
  }

  function clamp(v, opts) {
    if (opts.min != null && v < opts.min) v = opts.min;
    if (opts.max != null && v > opts.max) v = opts.max;
    return v;
  }

  // ── Chart.js tap-outside-to-dismiss ─────────────────────────────────────
  // Accepts a Chart instance or a canvas element. Canvas-based registration
  // survives chart destroy+recreate because we call Chart.getChart() at dismiss time.

  var _canvases = [];

  function registerChartDismissal(chartOrCanvas) {
    var canvas;
    if (chartOrCanvas && chartOrCanvas.canvas) {
      canvas = chartOrCanvas.canvas;          // Chart instance
    } else if (chartOrCanvas instanceof HTMLElement) {
      canvas = chartOrCanvas;                 // canvas element directly
    } else {
      return;
    }
    if (_canvases.indexOf(canvas) !== -1) return; // skip duplicates
    _canvases.push(canvas);
    if (_canvases.length === 1) {
      document.addEventListener('touchend', function (e) {
        var outside = _canvases.every(function (c) {
          return !c.contains(e.target);
        });
        if (!outside) return;
        _canvases.forEach(function (c) {
          var ch = (typeof Chart !== 'undefined') && Chart.getChart(c);
          if (!ch) return;
          try {
            ch.tooltip.setActiveElements([], { x: 0, y: 0 });
            ch.update('none');
          } catch (_) {}
        });
      }, { passive: true });
    }
  }

  // ── CSS hover tooltip touch fix ──────────────────────────────────────────

  function initTouchTooltips() {
    // Inject the class-driven rule alongside the existing :hover rule
    var style = document.createElement('style');
    style.textContent =
      '.tooltip-container.tt-open .tooltip-text { visibility: visible !important; opacity: 1 !important; }';
    document.head.appendChild(style);

    var containers = document.querySelectorAll('.tooltip-container');
    containers.forEach(function (container) {
      var icon = container.querySelector('.tooltip-icon');
      if (!icon) return;
      icon.addEventListener('touchstart', function (e) {
        e.preventDefault(); // prevent ghost click
        var isOpen = container.classList.contains('tt-open');
        // Close all
        containers.forEach(function (c) { c.classList.remove('tt-open'); });
        // Toggle this one
        if (!isOpen) container.classList.add('tt-open');
      }, { passive: false });
    });

    document.addEventListener('touchstart', function (e) {
      // Dismiss if touch lands outside any tooltip container
      var inside = false;
      containers.forEach(function (c) {
        if (c.contains(e.target)) inside = true;
      });
      if (!inside) {
        containers.forEach(function (c) { c.classList.remove('tt-open'); });
      }
    }, { passive: true });
  }

  // ── Programmatic value setter ─────────────────────────────────────────────

  function setDollarValue(id, num) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.numVal = String(num);
    el.value = formatDollar(num);
  }

  // Pension gate: the annual pension counts only once the holder has reached the start
  // age. startAge 0/blank means "starts at retirement" -> always on. Mirrors the engine
  // gate in optimizer_core.js (which additionally applies COLA + survivor pct).
  function pensionAtAge(amount, startAge, age) {
    return age >= (startAge || 0) ? (amount || 0) : 0;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.DisplayHelpers = {
    parseShorthand: parseShorthand,
    formatDollar: formatDollar,
    formatDollarShort: formatDollarShort,
    attachNumericDollarInput: attachNumericDollarInput,
    setDollarValue: setDollarValue,
    registerChartDismissal: registerChartDismissal,
    initTouchTooltips: initTouchTooltips,
    pensionAtAge: pensionAtAge
  };

  // Dual-mode export: inert in browser (classic script); lets Node tests require() this file.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.DisplayHelpers;
  }

})();
