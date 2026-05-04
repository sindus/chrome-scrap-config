// ── Références DOM ──────────────────────────────────────────────
const modeSimple  = document.getElementById('mode-simple');
const modeChapter = document.getElementById('mode-chapter');

// Mode simple
const btnSelect          = document.getElementById('btnSelect');
const btnEnterChapter    = document.getElementById('btnEnterChapter');
const btnDownload        = document.getElementById('btnDownload');
const btnClear           = document.getElementById('btnClear');
const resultSection      = document.getElementById('result-section');
const statusIdle         = document.getElementById('status-idle');
const fieldPage          = document.getElementById('field-page');
const fieldPath          = document.getElementById('field-path');
const excludeList        = document.getElementById('exclude-list');
const btnAddExclusion    = document.getElementById('btnAddExclusion');
const inputExcludeManual = document.getElementById('inputExcludeManual');
const btnExcludeManualAdd = document.getElementById('btnExcludeManualAdd');

// Mode chapitrage
const chapterBadge      = document.getElementById('chapter-badge');
const btnSelectChapter  = document.getElementById('btnSelectChapter');
const pendingSection    = document.getElementById('pending-section');
const pendingUrl        = document.getElementById('pending-url');
const pendingPath       = document.getElementById('pending-path');
const btnAddChapter     = document.getElementById('btnAddChapter');
const btnDiscardPending = document.getElementById('btnDiscardPending');
const chapterList       = document.getElementById('chapter-list');
const btnExportChapters = document.getElementById('btnExportChapters');
const btnLoadJson       = document.getElementById('btnLoadJson');
const inputLoadJson     = document.getElementById('inputLoadJson');
const loadError         = document.getElementById('load-error');
const btnExitChapter    = document.getElementById('btnExitChapter');

// ── État local ──────────────────────────────────────────────────
let chapters = [];       // [{page, path}]
let lastAdded = null;    // dernière sélection consommée (pour détecter les nouvelles)
let dragSrcIdx = null;

// ── Utilitaires storage ─────────────────────────────────────────
function loadChapterState(cb) {
  chrome.storage.local.get(['chaptersData', 'scrapingConfig', 'chapterExclusionCapture'], (data) => {
    const cd = data.chaptersData || { active: false, chapters: [], lastAdded: null };
    cb(cd, data.scrapingConfig || null, data.chapterExclusionCapture || null);
  });
}

function saveChapterState() {
  chrome.storage.local.set({
    chaptersData: { active: true, chapters, lastAdded }
  });
}

// ── Navigation entre les deux modes ────────────────────────────
function showSimpleMode() {
  modeSimple.style.display  = 'block';
  modeChapter.style.display = 'none';
}

function showChapterMode() {
  modeSimple.style.display  = 'none';
  modeChapter.style.display = 'block';
}

// ── Mode simple ─────────────────────────────────────────────────
function makeFieldEditable(el, storageKey) {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') { el.blur(); }
  });
  el.addEventListener('blur', () => {
    const val = el.textContent.trim();
    if (!val) { return; }
    chrome.storage.local.get('scrapingConfig', (data) => {
      if (!data.scrapingConfig) { return; }
      data.scrapingConfig[storageKey] = val;
      chrome.storage.local.set({ scrapingConfig: data.scrapingConfig });
    });
  });
}

makeFieldEditable(fieldPage, 'page');
makeFieldEditable(fieldPath, 'path');

function renderExcludeList(excludes) {
  excludeList.innerHTML = '';
  excludes.forEach((selector, idx) => {
    const item = document.createElement('div');
    item.className = 'exclude-item';

    const selectorEl = document.createElement('div');
    selectorEl.className = 'exclude-selector';
    selectorEl.contentEditable = 'true';
    selectorEl.spellcheck = false;
    selectorEl.textContent = selector;

    selectorEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); selectorEl.blur(); }
      if (e.key === 'Escape') { selectorEl.textContent = selector; selectorEl.blur(); }
    });

    selectorEl.addEventListener('blur', () => {
      const val = selectorEl.textContent.trim();
      if (!val) { selectorEl.textContent = selector; return; }
      chrome.storage.local.get('scrapingConfig', (data) => {
        if (!data.scrapingConfig) { return; }
        const updated = Array.isArray(data.scrapingConfig.exclude)
          ? [...data.scrapingConfig.exclude]
          : [];
        updated[idx] = val;
        data.scrapingConfig.exclude = updated;
        chrome.storage.local.set({ scrapingConfig: data.scrapingConfig });
      });
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'exclude-del';
    delBtn.title = 'Supprimer';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', () => {
      chrome.storage.local.get('scrapingConfig', (data) => {
        if (!data.scrapingConfig) { return; }
        const updated = Array.isArray(data.scrapingConfig.exclude)
          ? [...data.scrapingConfig.exclude]
          : [];
        updated.splice(idx, 1);
        if (updated.length > 0) {
          data.scrapingConfig.exclude = updated;
        } else {
          delete data.scrapingConfig.exclude;
        }
        chrome.storage.local.set({ scrapingConfig: data.scrapingConfig });
        renderExcludeList(data.scrapingConfig.exclude || []);
      });
    });

    item.appendChild(selectorEl);
    item.appendChild(delBtn);
    excludeList.appendChild(item);
  });
}

function showConfig(config) {
  fieldPage.textContent = config.page;
  fieldPage.title       = config.page;
  fieldPath.textContent = config.path;
  renderExcludeList(config.exclude || []);
  resultSection.style.display = 'block';
  statusIdle.style.display    = 'none';
}

function hideConfig() {
  resultSection.style.display = 'none';
  statusIdle.style.display    = 'block';
}

async function sendMessage(action, extraData) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Injection de secours (page ouverte avant l'installation)
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['lib/selector.js', 'content.js'] });
  } catch (_) {}
  const msg = extraData ? { action, ...extraData } : { action };
  chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
  return tab.id;
}

btnSelect.addEventListener('click', async () => {
  await sendMessage('startSelection');
  window.close();
});

btnDownload.addEventListener('click', async () => {
  await sendMessage('clearHighlight');
  chrome.storage.local.get('scrapingConfig', (data) => {
    if (!data.scrapingConfig) {return;}
    const payload = { page: data.scrapingConfig.page, path: data.scrapingConfig.path };
    if (Array.isArray(data.scrapingConfig.exclude) && data.scrapingConfig.exclude.length > 0) {
      payload.exclude = data.scrapingConfig.exclude;
    }
    downloadJSON(payload, 'scraping-config.json');
  });
});

btnAddExclusion.addEventListener('click', async () => {
  await sendMessage('startExclusionSelection');
  window.close();
});

btnExcludeManualAdd.addEventListener('click', () => {
  const val = inputExcludeManual.value.trim();
  if (!val) { return; }
  chrome.storage.local.get('scrapingConfig', (data) => {
    if (!data.scrapingConfig) { return; }
    const exclude = Array.isArray(data.scrapingConfig.exclude) ? data.scrapingConfig.exclude : [];
    if (!exclude.includes(val)) {
      data.scrapingConfig.exclude = [...exclude, val];
      chrome.storage.local.set({ scrapingConfig: data.scrapingConfig });
      renderExcludeList(data.scrapingConfig.exclude);
    }
    inputExcludeManual.value = '';
  });
});

inputExcludeManual.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); btnExcludeManualAdd.click(); }
});

btnClear.addEventListener('click', async () => {
  await sendMessage('clearHighlight');
  chrome.storage.local.remove('scrapingConfig');
  hideConfig();
});

// ── Mode chapitrage ─────────────────────────────────────────────
function updateBadge() {
  const n = chapters.length;
  chapterBadge.textContent = n === 0 ? '0 page' : `${n} page${n > 1 ? 's' : ''}`;
}

function renderChapterList() {
  updateBadge();
  btnExportChapters.disabled = chapters.length === 0;

  if (chapters.length === 0) {
    chapterList.classList.remove('has-items');
    chapterList.innerHTML = '';
    return;
  }

  chapterList.classList.add('has-items');
  chapterList.innerHTML = '';

  chapters.forEach((ch, idx) => {
    const item = document.createElement('div');
    item.className = 'chapter-item';
    item.draggable = true;
    item.dataset.idx = idx;

    let displayUrl = ch.page;
    try { displayUrl = new URL(ch.page).pathname || ch.page; } catch (_) {}

    item.innerHTML = `
      <span class="chapter-handle">⠿</span>
      <span class="chapter-num">${idx + 1}</span>
      <div class="chapter-info">
        <div class="chapter-url" title="${ch.page}">${displayUrl}</div>
        <div class="chapter-path" title="${ch.path}">${ch.path}</div>
      </div>
      <button class="chapter-del" title="Supprimer">×</button>
    `;

    // Édition inline url / path
    const urlEl  = item.querySelector('.chapter-url');
    const pathEl = item.querySelector('.chapter-path');

    [urlEl, pathEl].forEach((el) => {
      el.contentEditable = 'true';
      el.spellcheck = false;

      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        if (e.key === 'Escape') {
          el.textContent = el === urlEl ? chapters[idx].page : chapters[idx].path;
          el.blur();
        }
      });

      el.addEventListener('blur', () => {
        const val = el.textContent.trim();
        if (!val) {
          el.textContent = el === urlEl ? chapters[idx].page : chapters[idx].path;
          return;
        }
        if (el === urlEl) { chapters[idx].page = val; }
        else              { chapters[idx].path = val; }
        saveChapterState();
      });

      el.addEventListener('mousedown', (e) => e.stopPropagation());
    });

    // ── Exclusions du chapitre ────────────────────────────────
    const chapterInfo = item.querySelector('.chapter-info');
    const excludesDiv = document.createElement('div');
    excludesDiv.className = 'chapter-excludes';

    const chExcludes = Array.isArray(ch.exclude) ? ch.exclude : [];

    chExcludes.forEach((sel, eIdx) => {
      const eItem = document.createElement('div');
      eItem.className = 'exclude-item';

      const eSel = document.createElement('div');
      eSel.className = 'exclude-selector';
      eSel.contentEditable = 'true';
      eSel.spellcheck = false;
      eSel.textContent = sel;

      eSel.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); eSel.blur(); }
        if (e.key === 'Escape') { eSel.textContent = sel; eSel.blur(); }
      });
      eSel.addEventListener('blur', () => {
        const val = eSel.textContent.trim();
        if (!val) { eSel.textContent = sel; return; }
        const excl = Array.isArray(chapters[idx].exclude) ? [...chapters[idx].exclude] : [];
        excl[eIdx] = val;
        chapters[idx].exclude = excl;
        saveChapterState();
      });
      eSel.addEventListener('mousedown', (e) => e.stopPropagation());

      const eDel = document.createElement('button');
      eDel.className = 'exclude-del';
      eDel.title = 'Supprimer';
      eDel.textContent = '×';
      eDel.addEventListener('click', (e) => {
        e.stopPropagation();
        const excl = Array.isArray(chapters[idx].exclude) ? [...chapters[idx].exclude] : [];
        excl.splice(eIdx, 1);
        if (excl.length > 0) { chapters[idx].exclude = excl; }
        else { delete chapters[idx].exclude; }
        saveChapterState();
        renderChapterList();
      });

      eItem.append(eSel, eDel);
      excludesDiv.appendChild(eItem);
    });

    // Saisie d'exclusion (manuelle + visuelle)
    const actionsRow = document.createElement('div');
    actionsRow.className = 'chapter-exclude-actions';

    const manualInput = document.createElement('input');
    manualInput.type = 'text';
    manualInput.className = 'chapter-exclude-input';
    manualInput.placeholder = 'Sélecteur CSS…';
    manualInput.spellcheck = false;

    const addManualBtn = document.createElement('button');
    addManualBtn.className = 'btn-icon btn-ghost chapter-exclude-manual-btn';
    addManualBtn.title = 'Ajouter';
    addManualBtn.textContent = '+';

    const addVisualBtn = document.createElement('button');
    addVisualBtn.className = 'btn-icon btn-ghost chapter-exclude-visual-btn';
    addVisualBtn.title = 'Sélectionner sur la page';
    addVisualBtn.textContent = '🚫';

    addManualBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = manualInput.value.trim();
      if (!val) { return; }
      const existing = Array.isArray(chapters[idx].exclude) ? chapters[idx].exclude : [];
      if (!existing.includes(val)) {
        chapters[idx].exclude = [...existing, val];
        saveChapterState();
        renderChapterList();
      }
      manualInput.value = '';
    });

    manualInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addManualBtn.click(); }
    });

    addVisualBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await sendMessage('startExclusionSelection', { chapterIdx: idx });
      window.close();
    });

    [manualInput, addManualBtn, addVisualBtn].forEach((el) => {
      el.addEventListener('mousedown', (e) => e.stopPropagation());
    });

    actionsRow.append(manualInput, addManualBtn, addVisualBtn);
    excludesDiv.appendChild(actionsRow);
    chapterInfo.appendChild(excludesDiv);

    // Drag & drop
    item.addEventListener('dragstart', (e) => {
      dragSrcIdx = idx;
      setTimeout(() => item.classList.add('dragging'), 0);
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      chapterList.querySelectorAll('.chapter-item').forEach(el => el.classList.remove('drag-over'));
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      chapterList.querySelectorAll('.chapter-item').forEach(el => el.classList.remove('drag-over'));
      if (dragSrcIdx !== idx) {item.classList.add('drag-over');}
    });
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragSrcIdx === null || dragSrcIdx === idx) {return;}
      const [moved] = chapters.splice(dragSrcIdx, 1);
      chapters.splice(idx, 0, moved);
      dragSrcIdx = null;
      saveChapterState();
      renderChapterList();
    });

    // Suppression
    item.querySelector('.chapter-del').addEventListener('click', (e) => {
      e.stopPropagation();
      chapters.splice(idx, 1);
      saveChapterState();
      renderChapterList();
    });

    chapterList.appendChild(item);
  });
}

function showPending(config) {
  let displayUrl = config.page;
  try { displayUrl = new URL(config.page).hostname + new URL(config.page).pathname; } catch (_) {}
  pendingUrl.textContent  = displayUrl;
  pendingUrl.title        = config.page;
  pendingPath.textContent = config.path;
  pendingSection.style.display = 'block';
}

function hidePending() {
  pendingSection.style.display = 'none';
}

btnSelectChapter.addEventListener('click', async () => {
  await sendMessage('startSelection');
  window.close();
});

btnAddChapter.addEventListener('click', () => {
  chrome.storage.local.get('scrapingConfig', (data) => {
    if (!data.scrapingConfig) {return;}
    const { page, path } = data.scrapingConfig;
    chapters.push({ page, path });
    lastAdded = { page, path };
    saveChapterState();
    hidePending();
    renderChapterList();
    // Efface la bordure rouge sur la page
    sendMessage('clearHighlight');
  });
});

btnDiscardPending.addEventListener('click', () => {
  chrome.storage.local.get('scrapingConfig', (data) => {
    if (data.scrapingConfig) {
      const { page, path } = data.scrapingConfig;
      lastAdded = { page, path }; // marquer comme ignorée pour ne plus la reproposer
      saveChapterState();
    }
  });
  sendMessage('clearHighlight');
  hidePending();
});

btnExportChapters.addEventListener('click', () => {
  if (chapters.length === 0) {return;}
  const exportChapters = chapters.map((ch) => {
    const entry = { page: ch.page, path: ch.path };
    if (Array.isArray(ch.exclude) && ch.exclude.length > 0) {
      entry.exclude = ch.exclude;
    }
    return entry;
  });
  downloadJSON({ chapters: exportChapters }, 'chapitrage.json');
});

// ── Chargement d'un JSON existant ───────────────────────────────
btnLoadJson.addEventListener('click', () => {
  loadError.style.display = 'none';
  inputLoadJson.value = '';
  inputLoadJson.click();
});

inputLoadJson.addEventListener('change', () => {
  const file = inputLoadJson.files[0];
  if (!file) {return;}

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      // parseChaptersJson is loaded from lib/json-loader.js
      const valid = parseChaptersJson(e.target.result);

      // Fusionne : les entrées du fichier en premier, puis celles déjà en session
      chapters = [...valid, ...chapters];
      lastAdded = null; // force la re-détection de la sélection en attente
      saveChapterState();
      renderChapterList();
      loadError.style.display = 'none';
    } catch (err) {
      loadError.textContent = err.message;
      loadError.style.display = 'block';
    }
  };
  reader.readAsText(file);
});

btnExitChapter.addEventListener('click', () => {
  chrome.storage.local.set({ chaptersData: { active: false, chapters: [], lastAdded: null } });
  chapters  = [];
  lastAdded = null;
  hidePending();
  renderChapterList();
  showSimpleMode();
  // Recharge l'état simple
  chrome.storage.local.get('scrapingConfig', (data) => {
    if (data.scrapingConfig) {showConfig(data.scrapingConfig);}
    else {hideConfig();}
  });
});

btnEnterChapter.addEventListener('click', () => {
  chrome.storage.local.set({ chaptersData: { active: true, chapters: [], lastAdded: null } });
  chapters  = [];
  lastAdded = null;
  hidePending();
  renderChapterList();
  showChapterMode();
});

// ── Téléchargement JSON ─────────────────────────────────────────
function downloadJSON(data, filename) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Init ────────────────────────────────────────────────────────
loadChapterState((cd, config, exclusionCapture) => {
  if (cd.active) {
    chapters  = cd.chapters || [];
    lastAdded = cd.lastAdded || null;

    // Consomme l'exclusion capturée par sélection visuelle en mode chapitrage
    if (exclusionCapture) {
      const { chapterIdx, selector } = exclusionCapture;
      if (chapterIdx >= 0 && chapterIdx < chapters.length) {
        const existing = Array.isArray(chapters[chapterIdx].exclude) ? chapters[chapterIdx].exclude : [];
        if (!existing.includes(selector)) {
          chapters[chapterIdx].exclude = [...existing, selector];
          saveChapterState();
        }
      }
      chrome.storage.local.remove('chapterExclusionCapture');
    }

    showChapterMode();
    renderChapterList();

    // Détecte si une nouvelle sélection est disponible (pas encore consommée)
    if (config) {
      const isNew = !lastAdded
        || lastAdded.page !== config.page
        || lastAdded.path !== config.path;
      if (isNew) {showPending(config);}
    }
  } else {
    showSimpleMode();
    if (config) {showConfig(config);}
    else {hideConfig();}
  }
});
