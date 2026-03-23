/**
 * Utility functions for CSS selector generation.
 * Shared between content.js (browser) and unit tests (Node.js).
 */

const BLOCK_TAGS = new Set([
  'div', 'article', 'section', 'main', 'aside',
  'header', 'footer', 'nav', 'figure', 'figcaption',
  'ul', 'ol', 'li', 'dl', 'dd', 'dt',
  'table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th',
  'blockquote', 'pre', 'form', 'fieldset',
  'details', 'summary', 'address',
]);

/**
 * Traverses the DOM upward from el to find the nearest block-level ancestor.
 * @param {Element} el
 * @returns {Element|null}
 */
function findBlockAncestor(el) {
  let current = el;
  while (current && current !== document.body && current !== document.documentElement) {
    if (BLOCK_TAGS.has(current.tagName.toLowerCase())) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * Generates a unique CSS selector for the given element.
 * Prefers IDs, then builds a path with classes and nth-of-type.
 * @param {Element} element
 * @returns {string}
 */
function generateSelector(element) {
  if (element.id) {
    return '#' + CSS.escape(element.id);
  }

  const parts = [];
  let el = element;

  while (el && el !== document.documentElement) {
    if (el === document.body) {
      parts.unshift('body');
      break;
    }

    let part = el.tagName.toLowerCase();

    if (el.id) {
      parts.unshift('#' + CSS.escape(el.id));
      break;
    }

    const classes = Array.from(el.classList)
      .filter((c) => c.length > 0 && !c.startsWith('__scraping'))
      .slice(0, 2)
      .map((c) => '.' + CSS.escape(c))
      .join('');

    if (classes) {
      part += classes;
    }

    const parent = el.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
      if (sameTag.length > 1) {
        const idx = sameTag.indexOf(el) + 1;
        part += `:nth-of-type(${idx})`;
      }
    }

    parts.unshift(part);
    el = el.parentElement;
  }

  return parts.join(' > ');
}

// Node.js export (tests)
if (typeof module !== 'undefined') {
  module.exports = { BLOCK_TAGS, findBlockAncestor, generateSelector };
}
