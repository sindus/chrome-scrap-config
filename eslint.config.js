const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  // ── Extension source files (browser context) ──────────────────
  {
    files: ['*.js', 'lib/**/*.js'],
    ignores: ['eslint.config.js', 'jest.config.js', 'playwright.config.js', 'scripts/**', 'tests/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        CSS: 'readonly',
        FileReader: 'readonly',
        Node: 'readonly',
        setTimeout: 'readonly',
        module: 'readonly',
        // Chrome extension API
        chrome: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-console': 'warn',
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'curly': ['error', 'all'],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  // ── content.js gets the selector globals injected by lib/selector.js ─
  {
    files: ['content.js'],
    languageOptions: {
      globals: {
        BLOCK_TAGS: 'readonly',
        findBlockAncestor: 'readonly',
        generateSelector: 'readonly',
        handleMessage: 'readonly',
      },
    },
  },
  {
    // popup.js gets the json-loader global injected by lib/json-loader.js
    files: ['popup.js'],
    languageOptions: {
      globals: {
        parseChaptersJson: 'readonly',
      },
    },
  },
  // ── Node.js config files ──────────────────────────────────────
  {
    files: ['jest.config.js', 'playwright.config.js', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
  // ── Scripts ───────────────────────────────────────────────────
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  // ── Unit & Integration tests (Jest + jsdom) ───────────────────
  {
    files: ['tests/unit/**/*.js', 'tests/integration/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        console: 'readonly',
        // jsdom browser globals
        document: 'readonly',
        window: 'readonly',
        CSS: 'readonly',
        // Jest
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        global: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  // ── E2E tests (Playwright — Node context, browser APIs in evaluate()) ─
  {
    files: ['tests/e2e/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        console: 'readonly',
        // Jest/Playwright
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      // page.evaluate() callbacks run in the browser — browser globals are intentional
      'no-undef': 'off',
    },
  },
  {
    ignores: ['node_modules/', 'coverage/', 'playwright-report/', 'test-results/'],
  },
];
