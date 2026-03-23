/**
 * Pure utility for parsing and validating a chapitrage JSON file.
 * Shared between popup.js (browser) and unit tests (Node.js).
 */

/**
 * Parses a raw JSON string and returns a validated array of {page, path} entries.
 * Accepts two formats:
 *   - { chapters: [{page, path}, ...] }   (exported by this extension)
 *   - [{page, path}, ...]                  (bare array)
 *
 * @param {string} raw - Raw JSON string from the loaded file.
 * @returns {{ page: string, path: string }[]}
 * @throws {SyntaxError} If the string is not valid JSON.
 * @throws {Error} If the structure is invalid or contains no valid entries.
 */
function parseChaptersJson(raw) {
  const data = JSON.parse(raw); // throws SyntaxError on invalid JSON

  const loaded = Array.isArray(data) ? data : data.chapters;

  if (!Array.isArray(loaded)) {
    throw new Error('Format invalide : la clé "chapters" est absente ou n\'est pas un tableau.');
  }

  const valid = loaded.filter(
    (ch) => ch !== null
      && typeof ch === 'object'
      && typeof ch.page === 'string'
      && ch.page.trim() !== ''
      && typeof ch.path === 'string'
      && ch.path.trim() !== '',
  );

  if (valid.length === 0) {
    throw new Error('Aucune entrée valide trouvée (chaque entrée doit avoir "page" et "path" non vides).');
  }

  return valid;
}

// Node.js export (tests)
if (typeof module !== 'undefined') {
  module.exports = { parseChaptersJson };
}
