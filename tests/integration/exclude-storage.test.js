/**
 * Integration tests for exclusion selector storage logic.
 * Chrome API is fully mocked — no browser required.
 */

// ── Chrome API mock ───────────────────────────────────────────────────────────

let store = {};

const chromeMock = {
  storage: {
    local: {
      get: jest.fn((keys, cb) => {
        if (typeof keys === 'string') {
          cb({ [keys]: store[keys] });
        } else if (Array.isArray(keys)) {
          const result = {};
          keys.forEach((k) => { result[k] = store[k]; });
          cb(result);
        } else {
          const result = {};
          Object.keys(keys).forEach((k) => {
            result[k] = store[k] !== undefined ? store[k] : keys[k];
          });
          cb(result);
        }
      }),
      set: jest.fn((obj, cb) => {
        Object.assign(store, obj);
        if (cb) { cb(); }
      }),
      remove: jest.fn((key, cb) => {
        if (Array.isArray(key)) { key.forEach((k) => delete store[k]); }
        else { delete store[key]; }
        if (cb) { cb(); }
      }),
    },
  },
};

global.chrome = chromeMock;

beforeEach(() => {
  store = {};
  jest.clearAllMocks();
});

// ── Helpers that replicate the exclusion logic from content.js / popup.js ─────

/**
 * Simulates content.js onClick in 'exclude' mode:
 * appends selector to scrapingConfig.exclude (with dedup).
 */
function addExclusionFromPage(selector, existingConfig) {
  const config = existingConfig || {};
  const existing = Array.isArray(config.exclude) ? config.exclude : [];
  if (!existing.includes(selector)) {
    config.exclude = [...existing, selector];
    chromeMock.storage.local.set({ scrapingConfig: config });
  }
}

/**
 * Simulates popup.js delete handler:
 * removes item at idx; deletes the key when array becomes empty.
 */
function deleteExclusion(config, idx) {
  const updated = Array.isArray(config.exclude) ? [...config.exclude] : [];
  updated.splice(idx, 1);
  if (updated.length > 0) {
    config.exclude = updated;
  } else {
    delete config.exclude;
  }
  chromeMock.storage.local.set({ scrapingConfig: config });
  return config;
}

/**
 * Simulates popup.js btnExcludeManualAdd click handler:
 * adds a manually typed selector (with dedup).
 */
function addExclusionManual(config, rawValue) {
  const val = rawValue.trim();
  if (!val) { return; }
  const exclude = Array.isArray(config.exclude) ? config.exclude : [];
  if (!exclude.includes(val)) {
    config.exclude = [...exclude, val];
    chromeMock.storage.local.set({ scrapingConfig: config });
  }
}

// ── Exclusion list — adding ───────────────────────────────────────────────────

describe('Exclusion list — adding selectors', () => {
  test('appends a selector to scrapingConfig.exclude', () => {
    const config = { page: 'https://example.com', path: 'main' };
    addExclusionFromPage('div.sp-wrapper', config);
    expect(store.scrapingConfig.exclude).toEqual(['div.sp-wrapper']);
  });

  test('appends multiple selectors in order', () => {
    const config = { page: 'https://example.com', path: 'main', exclude: ['div.sp-wrapper'] };
    addExclusionFromPage('button.copy-page', config);
    expect(store.scrapingConfig.exclude).toEqual(['div.sp-wrapper', 'button.copy-page']);
  });

  test('does not duplicate an already-present selector', () => {
    const config = { page: 'https://example.com', path: 'main', exclude: ['div.sp-wrapper'] };
    addExclusionFromPage('div.sp-wrapper', config);
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
    expect(config.exclude).toHaveLength(1);
  });

  test('creates exclude array when none exists', () => {
    const config = { page: 'https://example.com', path: 'main' };
    addExclusionFromPage('#sidebar', config);
    expect(store.scrapingConfig.exclude).toEqual(['#sidebar']);
  });
});

// ── Exclusion list — deleting ─────────────────────────────────────────────────

describe('Exclusion list — deleting selectors', () => {
  test('removes the selector at the given index', () => {
    const config = {
      page: 'https://example.com', path: 'main',
      exclude: ['div.a', 'div.b', 'div.c'],
    };
    deleteExclusion(config, 1);
    expect(store.scrapingConfig.exclude).toEqual(['div.a', 'div.c']);
  });

  test('removes the exclude key entirely when the last item is deleted', () => {
    const config = { page: 'https://example.com', path: 'main', exclude: ['div.only'] };
    deleteExclusion(config, 0);
    expect(store.scrapingConfig).not.toHaveProperty('exclude');
  });

  test('removing first item does not affect remaining items', () => {
    const config = { page: 'https://example.com', path: 'main', exclude: ['a', 'b'] };
    deleteExclusion(config, 0);
    expect(store.scrapingConfig.exclude).toEqual(['b']);
  });
});

// ── Exclusion list — global clear ─────────────────────────────────────────────

describe('Exclusion list — global clear', () => {
  test('removing scrapingConfig also clears exclusions', () => {
    store = { scrapingConfig: { page: 'https://x.com', path: 'div', exclude: ['nav'] } };
    chromeMock.storage.local.remove('scrapingConfig');
    expect(store.scrapingConfig).toBeUndefined();
  });
});

// ── Chapter mode — exclusion capture (content.js → popup.js) ─────────────────

/**
 * Simulates content.js onClick in 'exclude' mode with a chapterIdx target:
 * stores to chapterExclusionCapture instead of scrapingConfig.exclude.
 */
function captureChapterExclusion(chapterIdx, selector) {
  chromeMock.storage.local.set({ chapterExclusionCapture: { chapterIdx, selector } });
}

/**
 * Simulates the popup init consumption of chapterExclusionCapture.
 */
function consumeChapterExclusionCapture(chapters) {
  const capture = store.chapterExclusionCapture;
  if (!capture) { return; }
  const { chapterIdx, selector } = capture;
  if (chapterIdx >= 0 && chapterIdx < chapters.length) {
    const existing = Array.isArray(chapters[chapterIdx].exclude) ? chapters[chapterIdx].exclude : [];
    if (!existing.includes(selector)) {
      chapters[chapterIdx].exclude = [...existing, selector];
      chromeMock.storage.local.set({ chaptersData: { active: true, chapters, lastAdded: null } });
    }
  }
  chromeMock.storage.local.remove('chapterExclusionCapture');
}

/**
 * Simulates addManualBtn click in renderChapterList() for chapter exclusions.
 */
function addChapterExclusionManual(chapters, chapterIdx, rawValue) {
  const val = rawValue.trim();
  if (!val) { return; }
  const existing = Array.isArray(chapters[chapterIdx].exclude) ? chapters[chapterIdx].exclude : [];
  if (!existing.includes(val)) {
    chapters[chapterIdx].exclude = [...existing, val];
    chromeMock.storage.local.set({ chaptersData: { active: true, chapters, lastAdded: null } });
  }
}

/**
 * Simulates eDel click in renderChapterList() for chapter exclusions.
 */
function deleteChapterExclusion(chapters, chapterIdx, eIdx) {
  const excl = Array.isArray(chapters[chapterIdx].exclude) ? [...chapters[chapterIdx].exclude] : [];
  excl.splice(eIdx, 1);
  if (excl.length > 0) { chapters[chapterIdx].exclude = excl; }
  else { delete chapters[chapterIdx].exclude; }
  chromeMock.storage.local.set({ chaptersData: { active: true, chapters, lastAdded: null } });
}

describe('Chapter mode — exclusion via visual selection', () => {
  test('stores chapterExclusionCapture with correct chapterIdx and selector', () => {
    captureChapterExclusion(1, 'div.sp-wrapper');
    expect(store.chapterExclusionCapture).toEqual({ chapterIdx: 1, selector: 'div.sp-wrapper' });
  });

  test('popup init adds captured selector to the correct chapter', () => {
    const chapters = [
      { page: 'https://example.com/1', path: 'main' },
      { page: 'https://example.com/2', path: 'article' },
    ];
    store.chapterExclusionCapture = { chapterIdx: 1, selector: 'nav.sidebar' };
    consumeChapterExclusionCapture(chapters);
    expect(chapters[1].exclude).toEqual(['nav.sidebar']);
    expect(chapters[0].exclude).toBeUndefined();
  });

  test('popup init does not duplicate an already-present exclusion', () => {
    const chapters = [
      { page: 'https://example.com/1', path: 'main', exclude: ['nav.sidebar'] },
    ];
    store.chapterExclusionCapture = { chapterIdx: 0, selector: 'nav.sidebar' };
    consumeChapterExclusionCapture(chapters);
    expect(chapters[0].exclude).toHaveLength(1);
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
  });

  test('popup init clears chapterExclusionCapture after consuming it', () => {
    const chapters = [{ page: 'https://example.com', path: 'main' }];
    store.chapterExclusionCapture = { chapterIdx: 0, selector: 'div.ads' };
    consumeChapterExclusionCapture(chapters);
    expect(store.chapterExclusionCapture).toBeUndefined();
  });

  test('popup init ignores capture when chapterIdx is out of bounds', () => {
    const chapters = [{ page: 'https://example.com', path: 'main' }];
    store.chapterExclusionCapture = { chapterIdx: 5, selector: 'div.ads' };
    consumeChapterExclusionCapture(chapters);
    expect(chapters[0].exclude).toBeUndefined();
  });
});

describe('Chapter mode — exclusion via manual input', () => {
  test('adds a manual selector to the correct chapter', () => {
    const chapters = [
      { page: 'https://example.com/1', path: 'main' },
      { page: 'https://example.com/2', path: 'article' },
    ];
    addChapterExclusionManual(chapters, 0, 'div.sp-wrapper');
    expect(chapters[0].exclude).toEqual(['div.sp-wrapper']);
    expect(chapters[1].exclude).toBeUndefined();
    expect(store.chaptersData.chapters[0].exclude).toEqual(['div.sp-wrapper']);
  });

  test('trims whitespace before adding', () => {
    const chapters = [{ page: 'https://example.com', path: 'main' }];
    addChapterExclusionManual(chapters, 0, '  .ads  ');
    expect(chapters[0].exclude).toEqual(['.ads']);
  });

  test('does not add an empty value', () => {
    const chapters = [{ page: 'https://example.com', path: 'main' }];
    addChapterExclusionManual(chapters, 0, '   ');
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
  });

  test('does not duplicate a chapter exclusion', () => {
    const chapters = [{ page: 'https://example.com', path: 'main', exclude: ['div.ads'] }];
    addChapterExclusionManual(chapters, 0, 'div.ads');
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
    expect(chapters[0].exclude).toHaveLength(1);
  });
});

describe('Chapter mode — exclusion deletion', () => {
  test('removes the exclusion at the given index', () => {
    const chapters = [
      { page: 'https://example.com', path: 'main', exclude: ['div.a', 'div.b', 'div.c'] },
    ];
    deleteChapterExclusion(chapters, 0, 1);
    expect(chapters[0].exclude).toEqual(['div.a', 'div.c']);
  });

  test('removes the exclude key when last item is deleted', () => {
    const chapters = [{ page: 'https://example.com', path: 'main', exclude: ['div.only'] }];
    deleteChapterExclusion(chapters, 0, 0);
    expect(chapters[0]).not.toHaveProperty('exclude');
  });

  test('deleting from one chapter does not affect another', () => {
    const chapters = [
      { page: 'https://example.com/1', path: 'main', exclude: ['div.a'] },
      { page: 'https://example.com/2', path: 'article', exclude: ['nav.b'] },
    ];
    deleteChapterExclusion(chapters, 0, 0);
    expect(chapters[0]).not.toHaveProperty('exclude');
    expect(chapters[1].exclude).toEqual(['nav.b']);
  });
});

describe('Chapter mode — export with exclusions', () => {
  test('excludes key present in exported chapter when non-empty', () => {
    const chapters = [
      { page: 'https://example.com/1', path: 'main', exclude: ['div.sp-wrapper'] },
      { page: 'https://example.com/2', path: 'article' },
    ];
    const exportChapters = chapters.map((ch) => {
      const entry = { page: ch.page, path: ch.path };
      if (Array.isArray(ch.exclude) && ch.exclude.length > 0) { entry.exclude = ch.exclude; }
      return entry;
    });
    expect(exportChapters[0].exclude).toEqual(['div.sp-wrapper']);
    expect(exportChapters[1]).not.toHaveProperty('exclude');
  });

  test('exported JSON is valid and parseable with per-chapter exclusions', () => {
    const chapters = [{ page: 'https://x.com', path: 'main', exclude: ['div.ads', 'nav'] }];
    const exportChapters = chapters.map((ch) => {
      const entry = { page: ch.page, path: ch.path };
      if (Array.isArray(ch.exclude) && ch.exclude.length > 0) { entry.exclude = ch.exclude; }
      return entry;
    });
    const json = JSON.stringify({ chapters: exportChapters }, null, 2);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json).chapters[0].exclude).toHaveLength(2);
  });
});

// ── Exclusion list — manual input ─────────────────────────────────────────────

describe('Exclusion list — manual input', () => {
  test('adds a manually typed selector', () => {
    const config = { page: 'https://example.com', path: 'main' };
    addExclusionManual(config, 'div.sp-wrapper');
    expect(store.scrapingConfig.exclude).toEqual(['div.sp-wrapper']);
  });

  test('does not add an empty or whitespace-only value', () => {
    const config = { page: 'https://example.com', path: 'main' };
    addExclusionManual(config, '   ');
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
  });

  test('trims whitespace before adding', () => {
    const config = { page: 'https://example.com', path: 'main' };
    addExclusionManual(config, '  .sidebar  ');
    expect(store.scrapingConfig.exclude).toEqual(['.sidebar']);
  });

  test('does not duplicate a manually added selector', () => {
    const config = { page: 'https://example.com', path: 'main', exclude: ['.sidebar'] };
    addExclusionManual(config, '.sidebar');
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
    expect(config.exclude).toHaveLength(1);
  });
});
