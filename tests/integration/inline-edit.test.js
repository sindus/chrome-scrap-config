/**
 * Integration tests for inline editing of page URLs and CSS paths.
 * Covers both simple mode (scrapingConfig) and chapter mode (chaptersData).
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

// ── Helpers that replicate the blur-save logic from popup.js ─────────────────

/**
 * Simulates the blur handler for simple mode fields.
 * Logic mirrors makeFieldEditable() in popup.js.
 */
function saveSimpleField(newValue, storageKey, existingConfig) {
  const val = newValue.trim();
  if (!val) { return; }
  const updated = { ...existingConfig, [storageKey]: val };
  chromeMock.storage.local.set({ scrapingConfig: updated });
}

/**
 * Simulates the blur handler for chapter item fields.
 * Logic mirrors the blur handler in renderChapterList() in popup.js.
 */
function saveChapterField(chapters, idx, key, newValue) {
  const val = newValue.trim();
  if (!val) { return; } // don't save — caller would restore previous value
  chapters[idx][key] = val;
  chromeMock.storage.local.set({
    chaptersData: { active: true, chapters, lastAdded: null },
  });
}

// ── Simple mode ───────────────────────────────────────────────────────────────

describe('Inline edit — simple mode', () => {
  test('saving a new page URL updates scrapingConfig', () => {
    const config = { page: 'https://old.com', path: 'div.content' };
    saveSimpleField('https://new.com', 'page', config);
    expect(store.scrapingConfig.page).toBe('https://new.com');
    expect(store.scrapingConfig.path).toBe('div.content'); // unchanged
  });

  test('saving a new CSS path updates scrapingConfig', () => {
    const config = { page: 'https://example.com', path: 'div.old' };
    saveSimpleField('article.new', 'path', config);
    expect(store.scrapingConfig.path).toBe('article.new');
    expect(store.scrapingConfig.page).toBe('https://example.com'); // unchanged
  });

  test('empty value after trim does not trigger a save', () => {
    const config = { page: 'https://example.com', path: 'div.ok' };
    saveSimpleField('   ', 'page', config);
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
  });

  test('empty string does not trigger a save', () => {
    const config = { page: 'https://example.com', path: 'div.ok' };
    saveSimpleField('', 'path', config);
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
  });

  test('value with only whitespace is trimmed before save', () => {
    const config = { page: 'https://example.com', path: 'div.ok' };
    saveSimpleField('  #hero  ', 'path', config);
    expect(store.scrapingConfig.path).toBe('#hero');
  });
});

// ── Chapter mode ──────────────────────────────────────────────────────────────

describe('Inline edit — chapter mode', () => {
  test('editing a chapter URL saves to storage', () => {
    const chapters = [
      { page: 'https://old.com/1', path: 'div.a' },
      { page: 'https://old.com/2', path: 'div.b' },
    ];
    saveChapterField(chapters, 0, 'page', 'https://new.com/1');
    expect(store.chaptersData.chapters[0].page).toBe('https://new.com/1');
    expect(store.chaptersData.chapters[1].page).toBe('https://old.com/2'); // untouched
  });

  test('editing a chapter CSS path saves to storage', () => {
    const chapters = [{ page: 'https://example.com', path: 'div.old' }];
    saveChapterField(chapters, 0, 'path', 'article.new');
    expect(store.chaptersData.chapters[0].path).toBe('article.new');
  });

  test('empty value does not save and should trigger a UI restore', () => {
    const chapters = [{ page: 'https://example.com', path: 'div.ok' }];
    saveChapterField(chapters, 0, 'path', '');
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
    // The path in the local array is also not mutated
    expect(chapters[0].path).toBe('div.ok');
  });

  test('whitespace-only value does not save', () => {
    const chapters = [{ page: 'https://example.com', path: 'div.ok' }];
    saveChapterField(chapters, 0, 'page', '   ');
    expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
  });

  test('editing the second chapter does not affect the first', () => {
    const chapters = [
      { page: 'https://a.com', path: 'div.a' },
      { page: 'https://b.com', path: 'div.b' },
    ];
    saveChapterField(chapters, 1, 'path', 'section.b-new');
    expect(store.chaptersData.chapters[0].path).toBe('div.a');
    expect(store.chaptersData.chapters[1].path).toBe('section.b-new');
  });

  test('value is trimmed before saving', () => {
    const chapters = [{ page: 'https://example.com', path: 'div.ok' }];
    saveChapterField(chapters, 0, 'path', '  #hero  ');
    expect(store.chaptersData.chapters[0].path).toBe('#hero');
  });
});
