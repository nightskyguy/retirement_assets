/* other_tools.js — shared "Other Tools" widget for all retirement planning pages */
(function () {
  'use strict';

  const TOOLS = [
    {
      name: 'Retirement Projection',
      file: 'Retirement_Projection.html',
      desc: 'Project multi-account retirement assets (IRA, Roth, brokerage) across your retirement timeline.'
    },
    {
      name: 'Retirement Optimizer',
      file: 'retirement_optimizer.html',
      desc: 'Full optimizer with Roth conversion strategies, withdrawal sequencing, and IRMAA modeling.'
    },
    {
      name: 'Income Tax Planner',
      file: 'IncomeTaxPlanner.html',
      desc: 'Tax sweep calculator across ordinary income levels — federal + many states, capital gains, IRMAA.'
    },
    {
      name: 'IRMAA & RMDs',
      file: 'irmaa_and_rmds.html',
      desc: 'Find what IRA balance forces RMDs into IRMAA Medicare surcharge tiers at various ages.'
    },
    {
      name: 'Future Cost (NPV)',
      file: 'FutureCost.html',
      desc: 'Net present value of growing future payments — ideal for modeling escalating IRMAA costs.'
    },
    {
      name: 'After-Tax Real Growth',
      file: 'AfterTaxRealGrowth.html',
      desc: 'Calculate the real (inflation-adjusted, after-tax) growth rate needed to stay ahead of inflation.'
    },
    {
      name: 'IRA Projection',
      file: 'IRA_projection.html',
      desc: 'Legacy IRA/401k projection tool.',
      deprecated: true
    }
  ];

  const currentFile = window.location.pathname.split('/').pop() || '';

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #ot-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.55);
        z-index: 9000;
        align-items: center;
        justify-content: center;
      }
      #ot-overlay.open { display: flex; }
      #ot-modal {
        background: var(--surface, #fff);
        border: 1px solid var(--border, #d8d4cb);
        border-radius: 12px;
        max-width: 580px;
        width: calc(100% - 2rem);
        max-height: 88vh;
        overflow-y: auto;
        padding: 1.5rem;
        position: relative;
        font-family: var(--sans, 'DM Sans', sans-serif);
        color: var(--text, #1a1916);
      }
      #ot-modal h2 {
        font-size: .95rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: var(--teal, var(--accent, #2a5caa));
        font-family: var(--mono, monospace);
        letter-spacing: .05em;
        text-transform: uppercase;
      }
      #ot-close {
        position: absolute;
        top: .75rem;
        right: .75rem;
        background: transparent;
        border: none;
        font-size: 1rem;
        cursor: pointer;
        color: var(--muted, #7a7670);
        padding: 2px 6px;
        line-height: 1;
      }
      #ot-close:hover { color: var(--text, #1a1916); }
      .ot-tool-link {
        display: flex;
        align-items: baseline;
        gap: .75rem;
        padding: .65rem 0;
        border-bottom: 1px solid var(--border, #d8d4cb);
        text-decoration: none;
        color: inherit;
      }
      .ot-tool-link:last-child { border-bottom: none; }
      .ot-tool-link:hover .ot-name { text-decoration: underline; }
      .ot-name {
        font-weight: 500;
        font-size: .88rem;
        color: var(--teal, var(--accent, #2a5caa));
        white-space: nowrap;
        min-width: 160px;
      }
      .ot-tool-link.ot-current .ot-name { color: var(--muted, #7a7670); font-style: italic; }
      .ot-tool-link.ot-current:hover .ot-name { text-decoration: none; }
      .ot-desc {
        font-size: .8rem;
        color: var(--muted, #7a7670);
        line-height: 1.45;
      }
      .ot-deprecated { opacity: .5; }
      .ot-badge {
        display: inline-block;
        font-size: .6rem;
        background: var(--border, #d8d4cb);
        color: var(--muted, #7a7670);
        border-radius: 3px;
        padding: 1px 5px;
        margin-left: .35rem;
        vertical-align: middle;
        font-style: normal;
        font-weight: 400;
      }
      /* Inline drawer variant (retirement_optimizer.html) */
      #ot-drawer-content .ot-tool-link { padding: .5rem 0; }
      #ot-drawer-content .ot-name { font-size: .85rem; min-width: 150px; }
    `;
    document.head.appendChild(style);
  }

  function buildToolList() {
    const frag = document.createDocumentFragment();
    TOOLS.forEach(function (tool) {
      const isCurrent = tool.file.toLowerCase() === currentFile.toLowerCase();
      const a = document.createElement('a');
      a.className = 'ot-tool-link'
        + (tool.deprecated ? ' ot-deprecated' : '')
        + (isCurrent ? ' ot-current' : '');
      a.href = isCurrent ? '#' : tool.file;
      if (!isCurrent) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      if (isCurrent) {
        a.setAttribute('aria-current', 'page');
        a.addEventListener('click', function (e) {
          e.preventDefault();
          closeOtherTools();
        });
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'ot-name';
      nameSpan.textContent = tool.name;
      if (tool.deprecated) {
        const badge = document.createElement('span');
        badge.className = 'ot-badge';
        badge.textContent = 'deprecated';
        nameSpan.appendChild(badge);
      }
      if (isCurrent) {
        const badge = document.createElement('span');
        badge.className = 'ot-badge';
        badge.textContent = 'here';
        nameSpan.appendChild(badge);
      }

      const descSpan = document.createElement('span');
      descSpan.className = 'ot-desc';
      descSpan.textContent = tool.desc;

      a.appendChild(nameSpan);
      a.appendChild(descSpan);
      frag.appendChild(a);
    });
    return frag;
  }

  function buildModal() {
    const overlay = document.createElement('div');
    overlay.id = 'ot-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Other Retirement Tools');
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeOtherTools();
    });

    const modal = document.createElement('div');
    modal.id = 'ot-modal';

    const closeBtn = document.createElement('button');
    closeBtn.id = 'ot-close';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', closeOtherTools);

    const h2 = document.createElement('h2');
    h2.textContent = 'Retirement Planning Tools';

    modal.appendChild(closeBtn);
    modal.appendChild(h2);
    modal.appendChild(buildToolList());
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  function closeOtherTools() {
    const overlay = document.getElementById('ot-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  window.showOtherTools = function () {
    const overlay = document.getElementById('ot-overlay');
    if (overlay) overlay.classList.add('open');
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeOtherTools();
  });

  document.addEventListener('DOMContentLoaded', function () {
    injectStyles();

    // Drawer variant: if the page has a drawer container, populate it inline
    const drawerEl = document.getElementById('ot-drawer-content');
    if (drawerEl) {
      drawerEl.appendChild(buildToolList());
    }

    // Always build the modal (used by all pages; drawer pages may not call showOtherTools)
    buildModal();
  });
})();
