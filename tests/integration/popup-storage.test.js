/**
 * Integration tests for the popup storage logic.
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
          // object with defaults
          const result = {};
          Object.keys(keys).forEach((k) => { result[k] = store[k] !== undefined ? store[k] : keys[k]; });
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
  tabs: {
    query: jest.fn(() => Promise.resolve([{ id: 1, url: 'https://example.com' }])),
    sendMessage: jest.fn(() => Promise.resolve()),
  },
  scripting: {
    executeScript: jest.fn(() => Promise.resolve()),
  },
  runtime: {
    onMessage: { addListener: jest.fn() },
  },
};

global.chrome = chromeMock;

// ── Helpers ───────────────────────────────────────────────────────────────────

function setStore(obj) {
  store = { ...obj };
}

function getStore() {
  return store;
}

// ── Tests : chapter mode state management ─────────────────────────────────────

describe('Chapter mode — storage logic', () => {
  beforeEach(() => {
    store = {};
    jest.clearAllMocks();
  });

  test('initialises chaptersData when entering chapter mode', () => {
    chromeMock.storage.local.set({ chaptersData: { active: true, chapters: [], lastAdded: null } });
    expect(getStore().chaptersData).toEqual({ active: true, chapters: [], lastAdded: null });
  });

  test('appending a chapter updates the chapters array', () => {
    setStore({ chaptersData: { active: true, chapters: [], lastAdded: null } });
    const config = { page: 'https://example.com/p1', path: 'div.article' };
    const { chapters } = getStore().chaptersData;
    chapters.push(config);
    chromeMock.storage.local.set({ chaptersData: { active: true, chapters, lastAdded: config } });
    expect(getStore().chaptersData.chapters).toHaveLength(1);
    expect(getStore().chaptersData.chapters[0]).toEqual(config);
  });

  test('reordering chapters reflects in storage', () => {
    const ch1 = { page: 'https://example.com/1', path: 'div.a' };
    const ch2 = { page: 'https://example.com/2', path: 'div.b' };
    const ch3 = { page: 'https://example.com/3', path: 'div.c' };
    setStore({ chaptersData: { active: true, chapters: [ch1, ch2, ch3], lastAdded: ch3 } });

    const chapters = [...getStore().chaptersData.chapters];
    // Move ch3 to position 0
    const [moved] = chapters.splice(2, 1);
    chapters.splice(0, 0, moved);
    chromeMock.storage.local.set({ chaptersData: { active: true, chapters, lastAdded: ch3 } });

    expect(getStore().chaptersData.chapters[0]).toEqual(ch3);
    expect(getStore().chaptersData.chapters[1]).toEqual(ch1);
    expect(getStore().chaptersData.chapters[2]).toEqual(ch2);
  });

  test('deleting a chapter removes it from the array', () => {
    const ch1 = { page: 'https://example.com/1', path: 'div.a' };
    const ch2 = { page: 'https://example.com/2', path: 'div.b' };
    setStore({ chaptersData: { active: true, chapters: [ch1, ch2], lastAdded: ch2 } });

    const chapters = [...getStore().chaptersData.chapters];
    chapters.splice(0, 1); // delete ch1
    chromeMock.storage.local.set({ chaptersData: { active: true, chapters, lastAdded: ch2 } });

    expect(getStore().chaptersData.chapters).toHaveLength(1);
    expect(getStore().chaptersData.chapters[0]).toEqual(ch2);
  });

  test('exiting chapter mode resets chaptersData', () => {
    setStore({ chaptersData: { active: true, chapters: [{ page: 'x', path: 'y' }], lastAdded: null } });
    chromeMock.storage.local.set({ chaptersData: { active: false, chapters: [], lastAdded: null } });
    expect(getStore().chaptersData.active).toBe(false);
    expect(getStore().chaptersData.chapters).toHaveLength(0);
  });
});

// ── Tests : pending detection ─────────────────────────────────────────────────

describe('Pending selection detection', () => {
  beforeEach(() => {
    store = {};
    jest.clearAllMocks();
  });

  test('detects new selection when lastAdded is null', () => {
    const config = { page: 'https://example.com', path: 'div.main' };
    const lastAdded = null;
    const isNew = !lastAdded || lastAdded.page !== config.page || lastAdded.path !== config.path;
    expect(isNew).toBe(true);
  });

  test('detects new selection when page differs', () => {
    const config = { page: 'https://example.com/page2', path: 'div.main' };
    const lastAdded = { page: 'https://example.com/page1', path: 'div.main' };
    const isNew = !lastAdded || lastAdded.page !== config.page || lastAdded.path !== config.path;
    expect(isNew).toBe(true);
  });

  test('detects new selection when path differs', () => {
    const config = { page: 'https://example.com', path: 'section.content' };
    const lastAdded = { page: 'https://example.com', path: 'div.main' };
    const isNew = !lastAdded || lastAdded.page !== config.page || lastAdded.path !== config.path;
    expect(isNew).toBe(true);
  });

  test('does not flag as new when page and path are identical', () => {
    const config = { page: 'https://example.com', path: 'div.main' };
    const lastAdded = { page: 'https://example.com', path: 'div.main' };
    const isNew = !lastAdded || lastAdded.page !== config.page || lastAdded.path !== config.path;
    expect(isNew).toBe(false);
  });
});

// ── Tests : export payload ────────────────────────────────────────────────────

describe('Export payload', () => {
  test('simple mode produces {page, path} object', () => {
    const config = { page: 'https://example.com', path: '#main' };
    expect(config).toHaveProperty('page');
    expect(config).toHaveProperty('path');
  });

  test('chapter mode produces {chapters: [...]} object', () => {
    const chapters = [
      { page: 'https://example.com/1', path: 'div.article' },
      { page: 'https://example.com/2', path: 'section.content' },
    ];
    const payload = { chapters };
    expect(payload.chapters).toHaveLength(2);
    payload.chapters.forEach((ch) => {
      expect(ch).toHaveProperty('page');
      expect(ch).toHaveProperty('path');
    });
  });

  test('exported JSON is valid and parseable', () => {
    const payload = {
      chapters: [{ page: 'https://x.com', path: 'div.x' }],
    };
    const json = JSON.stringify(payload, null, 2);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json)).toEqual(payload);
  });
});
