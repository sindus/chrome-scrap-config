/**
 * Unit tests for lib/selector.js
 * Tests run in jsdom environment — DOM APIs are available.
 */

// jsdom doesn't include CSS.escape — polyfill it
if (typeof CSS === 'undefined') {
  global.CSS = { escape: (s) => s.replace(/[^\w-]/g, (c) => '\\' + c) };
}

const { BLOCK_TAGS, findBlockAncestor, generateSelector } = require('../../lib/selector.js');

// ── BLOCK_TAGS ────────────────────────────────────────────────────────────────

describe('BLOCK_TAGS', () => {
  test('contains expected block elements', () => {
    expect(BLOCK_TAGS.has('div')).toBe(true);
    expect(BLOCK_TAGS.has('article')).toBe(true);
    expect(BLOCK_TAGS.has('section')).toBe(true);
    expect(BLOCK_TAGS.has('main')).toBe(true);
    expect(BLOCK_TAGS.has('ul')).toBe(true);
    expect(BLOCK_TAGS.has('table')).toBe(true);
  });

  test('does not contain inline/text elements', () => {
    expect(BLOCK_TAGS.has('a')).toBe(false);
    expect(BLOCK_TAGS.has('span')).toBe(false);
    expect(BLOCK_TAGS.has('em')).toBe(false);
    expect(BLOCK_TAGS.has('strong')).toBe(false);
    expect(BLOCK_TAGS.has('p')).toBe(false);
  });
});

// ── findBlockAncestor ─────────────────────────────────────────────────────────

describe('findBlockAncestor', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('returns the element itself when it is a block', () => {
    const div = document.createElement('div');
    container.appendChild(div);
    expect(findBlockAncestor(div)).toBe(div);
  });

  test('returns nearest block ancestor when target is inline', () => {
    const div = document.createElement('div');
    const span = document.createElement('span');
    div.appendChild(span);
    container.appendChild(div);
    expect(findBlockAncestor(span)).toBe(div);
  });

  test('returns nearest block ancestor when target is a link', () => {
    const article = document.createElement('article');
    const a = document.createElement('a');
    article.appendChild(a);
    container.appendChild(article);
    expect(findBlockAncestor(a)).toBe(article);
  });

  test('skips intermediate inline elements to find block', () => {
    const section = document.createElement('section');
    const em = document.createElement('em');
    const strong = document.createElement('strong');
    em.appendChild(strong);
    section.appendChild(em);
    container.appendChild(section);
    expect(findBlockAncestor(strong)).toBe(section);
  });

  test('returns null when no block ancestor exists (only body/html)', () => {
    const span = document.createElement('span');
    document.body.appendChild(span);
    // findBlockAncestor stops at document.body
    const result = findBlockAncestor(span);
    expect(result).toBeNull();
    document.body.removeChild(span);
  });

  test('works with article element', () => {
    const article = document.createElement('article');
    container.appendChild(article);
    expect(findBlockAncestor(article)).toBe(article);
  });
});

// ── generateSelector ──────────────────────────────────────────────────────────

describe('generateSelector', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('returns #id when element has an id', () => {
    const div = document.createElement('div');
    div.id = 'main-content';
    container.appendChild(div);
    expect(generateSelector(div)).toBe('#main-content');
  });

  test('prefers ancestor id over full path', () => {
    const parent = document.createElement('div');
    parent.id = 'root';
    const child = document.createElement('div');
    parent.appendChild(child);
    container.appendChild(parent);
    const sel = generateSelector(child);
    expect(sel).toContain('#root');
  });

  test('builds path with tag and classes', () => {
    const div = document.createElement('div');
    div.className = 'card featured';
    container.appendChild(div);
    const sel = generateSelector(div);
    expect(sel).toContain('div');
    expect(sel).toContain('.card');
  });

  test('adds nth-of-type when siblings share the same tag', () => {
    const parent = document.createElement('div');
    const child1 = document.createElement('div');
    const child2 = document.createElement('div');
    parent.appendChild(child1);
    parent.appendChild(child2);
    container.appendChild(parent);
    const sel1 = generateSelector(child1);
    const sel2 = generateSelector(child2);
    expect(sel1).toContain(':nth-of-type(1)');
    expect(sel2).toContain(':nth-of-type(2)');
  });

  test('does not add nth-of-type for unique tag among siblings', () => {
    const parent = document.createElement('div');
    const article = document.createElement('article');
    const aside = document.createElement('aside');
    parent.appendChild(article);
    parent.appendChild(aside);
    container.appendChild(parent);
    expect(generateSelector(article)).not.toContain(':nth-of-type');
    expect(generateSelector(aside)).not.toContain(':nth-of-type');
  });

  test('ignores classes starting with __scraping', () => {
    const div = document.createElement('div');
    div.className = '__scraping_internal real-class';
    container.appendChild(div);
    const sel = generateSelector(div);
    expect(sel).not.toContain('__scraping');
    expect(sel).toContain('.real-class');
  });

  test('limits to max 2 classes', () => {
    const div = document.createElement('div');
    div.className = 'a b c d';
    container.appendChild(div);
    const sel = generateSelector(div);
    const classMatches = sel.match(/\./g) || [];
    expect(classMatches.length).toBeLessThanOrEqual(2);
  });

  test('stops path at body', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const sel = generateSelector(div);
    expect(sel).toContain('body');
    document.body.removeChild(div);
  });
});
