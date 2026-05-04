// lib/selector.js is loaded before this script via manifest content_scripts.
// BLOCK_TAGS, findBlockAncestor, generateSelector are available as globals.

// Guard against double-injection
if (window.__scrapingConfigInjected) {
  chrome.runtime.onMessage.addListener(handleMessage);
} else {
  window.__scrapingConfigInjected = true;

  let selectionMode = null; // null | 'main' | 'exclude'
  let excludeTarget = null; // null (mode simple) | number (index chapitre)
  let highlightedElement = null;
  let selectedElement = null;
  let banner = null;

  // ── Banner ────────────────────────────────────────────────────

  function createBanner(text) {
    banner = document.createElement('div');
    banner.id = '__scraping_banner__';
    banner.style.cssText = `
      position: fixed !important;
      top: 0 !important; left: 0 !important; right: 0 !important;
      background: rgba(20, 20, 20, 0.92) !important;
      color: #fff !important;
      text-align: center !important;
      padding: 12px 16px !important;
      font-size: 14px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      letter-spacing: 0.3px !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4) !important;
    `;
    banner.textContent = text;
    document.body.appendChild(banner);
  }

  function removeBanner() {
    if (banner) { banner.remove(); banner = null; }
  }

  // ── Highlight ─────────────────────────────────────────────────

  function clearElementOutline(el) {
    if (!el) {return;}
    el.style.removeProperty('outline');
    el.style.removeProperty('outline-offset');
    if (el.__origOutline) {el.style.outline = el.__origOutline;}
    if (el.__origOutlineOffset) {el.style.outlineOffset = el.__origOutlineOffset;}
    delete el.__origOutline;
    delete el.__origOutlineOffset;
  }

  function highlightElement(el) {
    if (highlightedElement && highlightedElement !== el) {
      clearElementOutline(highlightedElement);
    }
    if (el && el !== document.body && el !== document.documentElement && el !== banner) {
      el.__origOutline = el.style.outline;
      el.__origOutlineOffset = el.style.outlineOffset;
      const color = selectionMode === 'exclude' ? '#ff6f00' : '#e53935';
      el.style.setProperty('outline', `2px solid ${color}`, 'important');
      el.style.setProperty('outline-offset', '1px', 'important');
      highlightedElement = el;
    }
  }

  function removeHighlight() {
    clearElementOutline(highlightedElement);
    highlightedElement = null;
  }

  function clearSelected() {
    clearElementOutline(selectedElement);
    selectedElement = null;
  }

  // ── Event handlers ────────────────────────────────────────────

  function onMouseOver(e) {
    if (selectionMode === null || e.target === banner) {return;}
    const block = findBlockAncestor(e.target); // from lib/selector.js
    if (block) {highlightElement(block);}
  }

  function onClick(e) {
    if (selectionMode === null || e.target === banner) {return;}
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const block = findBlockAncestor(e.target); // from lib/selector.js
    if (!block) {return;}

    const selector = generateSelector(block); // from lib/selector.js

    if (selectionMode === 'main') {
      const page = window.location.href;
      stopSelection();
      selectedElement = block;
      block.style.setProperty('outline', '2px solid #e53935', 'important');
      block.style.setProperty('outline-offset', '1px', 'important');
      chrome.storage.local.set({ scrapingConfig: { page, path: selector } });

    } else if (selectionMode === 'exclude') {
      const target = excludeTarget; // capture avant stopSelection (qui réinitialise excludeTarget)
      stopSelection();

      if (target !== null) {
        // Mode chapitrage : stockage dédié pour associer l'exclusion au bon chapitre
        chrome.storage.local.set({ chapterExclusionCapture: { chapterIdx: target, selector } });
      } else {
        // Mode simple : ajout dans scrapingConfig.exclude
        chrome.storage.local.get('scrapingConfig', (data) => {
          const config = data.scrapingConfig || {};
          const existing = Array.isArray(config.exclude) ? config.exclude : [];
          if (!existing.includes(selector)) {
            config.exclude = [...existing, selector];
            chrome.storage.local.set({ scrapingConfig: config });
          }
        });
      }
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {stopSelection();}
  }

  // ── Selection lifecycle ───────────────────────────────────────

  function startSelectionMode(mode, chapterIdx) {
    if (selectionMode !== null) {return;}
    selectionMode = mode;
    excludeTarget = (chapterIdx !== undefined && chapterIdx !== null) ? chapterIdx : null;
    const text = mode === 'exclude'
      ? '🚫 Cliquez sur un élément à exclure   |   Échap pour annuler'
      : '🎯 Cliquez sur un élément pour le sélectionner   |   Échap pour annuler';
    createBanner(text);
    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function stopSelection() {
    if (selectionMode === null) {return;}
    selectionMode = null;
    excludeTarget = null;
    removeHighlight();
    removeBanner();
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
  }

  // ── Message handler ───────────────────────────────────────────

  function handleMessage(message) {
    if (message.action === 'startSelection') {
      clearSelected();
      startSelectionMode('main');
    } else if (message.action === 'startExclusionSelection') {
      startSelectionMode('exclude', message.chapterIdx);
    } else if (message.action === 'clearHighlight') {
      clearSelected();
    }
  }

  chrome.runtime.onMessage.addListener(handleMessage);
}
