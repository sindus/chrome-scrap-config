/**
 * Utility functions for CSS selector generation.
 * Shared between content.js (browser) and unit tests (Node.js).
 *
 * Uses var + a guard so the script can be injected multiple times
 * without throwing "Identifier already declared".
 */

/* eslint-disable no-var */

if (typeof BLOCK_TAGS === 'undefined') {
  var BLOCK_TAGS = new Set([
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
  var findBlockAncestor = function findBlockAncestor(el) {
    var current = el;
    while (current && current !== document.body && current !== document.documentElement) {
      if (BLOCK_TAGS.has(current.tagName.toLowerCase())) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  };

  /**
   * Generates a unique CSS selector for the given element.
   * Prefers IDs, then builds a path with classes and nth-of-type.
   * @param {Element} element
   * @returns {string}
   */
  var generateSelector = function generateSelector(element) {
    if (element.id) {
      return '#' + CSS.escape(element.id);
    }

    var parts = [];
    var el = element;

    while (el && el !== document.documentElement) {
      if (el === document.body) {
        parts.unshift('body');
        break;
      }

      var part = el.tagName.toLowerCase();

      if (el.id) {
        parts.unshift('#' + CSS.escape(el.id));
        break;
      }

      var classes = Array.from(el.classList)
        .filter(function (c) { return c.length > 0 && !c.startsWith('__scraping'); })
        .slice(0, 2)
        .map(function (c) { return '.' + CSS.escape(c); })
        .join('');

      if (classes) {
        part += classes;
      }

      var parent = el.parentElement;
      if (parent) {
        var sameTag = Array.from(parent.children).filter(function (c) { return c.tagName === el.tagName; });
        if (sameTag.length > 1) {
          var idx = sameTag.indexOf(el) + 1;
          part += ':nth-of-type(' + idx + ')';
        }
      }

      parts.unshift(part);
      el = el.parentElement;
    }

    return parts.join(' > ');
  };
}

// Node.js export (tests)
if (typeof module !== 'undefined') {
  module.exports = { BLOCK_TAGS: BLOCK_TAGS, findBlockAncestor: findBlockAncestor, generateSelector: generateSelector };
}
