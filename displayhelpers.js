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

  // ── Public API ────────────────────────────────────────────────────────────

  window.DisplayHelpers = {
    parseShorthand: parseShorthand,
    formatDollar: formatDollar,
    attachNumericDollarInput: attachNumericDollarInput,
    registerChartDismissal: registerChartDismissal,
    initTouchTooltips: initTouchTooltips
  };

})();
