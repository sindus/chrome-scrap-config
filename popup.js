// ── Références DOM ──────────────────────────────────────────────
const modeSimple  = document.getElementById('mode-simple');
const modeChapter = document.getElementById('mode-chapter');

// Mode simple
const btnSelect      = document.getElementById('btnSelect');
const btnEnterChapter = document.getElementById('btnEnterChapter');
const btnDownload    = document.getElementById('btnDownload');
const btnClear       = document.getElementById('btnClear');
const resultSection  = document.getElementById('result-section');
const statusIdle     = document.getElementById('status-idle');
const fieldPage      = document.getElementById('field-page');
const fieldPath      = document.getElementById('field-path');

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
  chrome.storage.local.get(['chaptersData', 'scrapingConfig'], (data) => {
    const cd = data.chaptersData || { active: false, chapters: [], lastAdded: null };
    cb(cd, data.scrapingConfig || null);
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

function showConfig(config) {
  fieldPage.textContent = config.page;
  fieldPage.title       = config.page;
  fieldPath.textContent = config.path;
  resultSection.style.display = 'block';
  statusIdle.style.display    = 'none';
}

function hideConfig() {
  resultSection.style.display = 'none';
  statusIdle.style.display    = 'block';
}

async function sendMessage(action) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Injection de secours (page ouverte avant l'installation)
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['lib/selector.js', 'content.js'] });
  } catch (_) {}
  chrome.tabs.sendMessage(tab.id, { action }).catch(() => {});
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
    downloadJSON(data.scrapingConfig, 'scraping-config.json');
  });
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

      // Enter confirme, Escape annule
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
          // Restaure la valeur précédente si vide
          el.textContent = el === urlEl ? chapters[idx].page : chapters[idx].path;
          return;
        }
        if (el === urlEl) { chapters[idx].page = val; }
        else              { chapters[idx].path = val; }
        saveChapterState();
      });

      // Empêche le drag de se déclencher quand on édite
      el.addEventListener('mousedown', (e) => e.stopPropagation());
    });

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
  downloadJSON({ chapters }, 'chapitrage.json');
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
      const data = JSON.parse(e.target.result);

      // Accepte {chapters:[...]} ou directement [{page,path},...]
      const loaded = Array.isArray(data) ? data : data.chapters;

      if (!Array.isArray(loaded)) {
        throw new Error('Format invalide : la clé "chapters" est absente ou n\'est pas un tableau.');
      }

      const valid = loaded.filter(
        (ch) => typeof ch.page === 'string' && typeof ch.path === 'string',
      );

      if (valid.length === 0) {
        throw new Error('Aucune entrée valide trouvée (chaque entrée doit avoir "page" et "path").');
      }

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
loadChapterState((cd, config) => {
  if (cd.active) {
    chapters  = cd.chapters || [];
    lastAdded = cd.lastAdded || null;
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
