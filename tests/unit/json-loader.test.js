/**
 * Unit tests for lib/json-loader.js — parseChaptersJson()
 */

const { parseChaptersJson } = require('../../lib/json-loader.js');

// ── Valid inputs ──────────────────────────────────────────────────────────────

describe('parseChaptersJson — valid inputs', () => {
  test('parses {chapters:[...]} format', () => {
    const raw = JSON.stringify({
      chapters: [
        { page: 'https://example.com/1', path: 'div.article' },
        { page: 'https://example.com/2', path: 'section.body' },
      ],
    });
    const result = parseChaptersJson(raw);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ page: 'https://example.com/1', path: 'div.article' });
  });

  test('parses bare array format', () => {
    const raw = JSON.stringify([
      { page: 'https://example.com', path: '#main' },
    ]);
    const result = parseChaptersJson(raw);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('#main');
  });

  test('preserves extra properties on entries', () => {
    const raw = JSON.stringify({
      chapters: [{ page: 'https://x.com', path: 'div', extra: 'data' }],
    });
    const result = parseChaptersJson(raw);
    expect(result[0]).toHaveProperty('extra', 'data');
  });

  test('filters out invalid entries and returns the rest', () => {
    const raw = JSON.stringify({
      chapters: [
        { page: 'https://example.com', path: 'div.ok' },
        { page: 'https://example.com' },           // missing path
        { path: 'div.ok' },                          // missing page
        { page: 42, path: 'div' },                   // page not a string
        null,                                         // null entry
        'string-entry',                              // primitive
      ],
    });
    const result = parseChaptersJson(raw);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('div.ok');
  });

  test('filters out entries with empty page or path', () => {
    const raw = JSON.stringify({
      chapters: [
        { page: '', path: 'div.content' },
        { page: 'https://x.com', path: '' },
        { page: 'https://x.com', path: 'div.ok' },
      ],
    });
    const result = parseChaptersJson(raw);
    expect(result).toHaveLength(1);
  });

  test('handles chapters with extra whitespace in values', () => {
    const raw = JSON.stringify({
      chapters: [{ page: '  https://x.com  ', path: '  div.ok  ' }],
    });
    // Whitespace in values is kept — trimming is the caller's responsibility
    const result = parseChaptersJson(raw);
    expect(result).toHaveLength(1);
  });
});

// ── Invalid JSON ──────────────────────────────────────────────────────────────

describe('parseChaptersJson — invalid JSON', () => {
  test('throws SyntaxError on malformed JSON string', () => {
    expect(() => parseChaptersJson('not json at all')).toThrow(SyntaxError);
  });

  test('throws SyntaxError on truncated JSON', () => {
    expect(() => parseChaptersJson('{"chapters":[{')).toThrow(SyntaxError);
  });

  test('throws SyntaxError on empty string', () => {
    expect(() => parseChaptersJson('')).toThrow(SyntaxError);
  });
});

// ── Invalid structure ─────────────────────────────────────────────────────────

describe('parseChaptersJson — invalid structure', () => {
  test('throws when top-level is an object without "chapters" key', () => {
    const raw = JSON.stringify({ page: 'x', path: 'y' });
    expect(() => parseChaptersJson(raw)).toThrow('chapters');
  });

  test('throws when "chapters" is not an array', () => {
    const raw = JSON.stringify({ chapters: 'not-an-array' });
    expect(() => parseChaptersJson(raw)).toThrow('tableau');
  });

  test('throws when "chapters" is null', () => {
    const raw = JSON.stringify({ chapters: null });
    expect(() => parseChaptersJson(raw)).toThrow('tableau');
  });

  test('throws when "chapters" is an object', () => {
    const raw = JSON.stringify({ chapters: { 0: { page: 'x', path: 'y' } } });
    expect(() => parseChaptersJson(raw)).toThrow('tableau');
  });

  test('throws when array is empty', () => {
    const raw = JSON.stringify({ chapters: [] });
    expect(() => parseChaptersJson(raw)).toThrow('valide');
  });

  test('throws when all entries are invalid', () => {
    const raw = JSON.stringify({
      chapters: [
        { page: 123, path: 456 },
        { foo: 'bar' },
      ],
    });
    expect(() => parseChaptersJson(raw)).toThrow('valide');
  });

  test('throws when top-level value is a number', () => {
    expect(() => parseChaptersJson('42')).toThrow();
  });
});

// ── Merge logic (caller responsibility, tested here as contract) ──────────────

describe('parseChaptersJson — merge contract', () => {
  test('returned array is safe to spread-merge with existing chapters', () => {
    const existing = [{ page: 'https://old.com', path: 'div.old' }];
    const raw = JSON.stringify({ chapters: [{ page: 'https://new.com', path: 'div.new' }] });
    const loaded = parseChaptersJson(raw);
    const merged = [...loaded, ...existing];
    expect(merged).toHaveLength(2);
    expect(merged[0].page).toBe('https://new.com'); // loaded entries come first
    expect(merged[1].page).toBe('https://old.com');
  });
});
