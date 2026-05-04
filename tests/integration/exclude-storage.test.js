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
