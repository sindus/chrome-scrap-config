/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/unit/**/*.test.js', '**/tests/integration/**/*.test.js'],
  collectCoverageFrom: ['lib/**/*.js', 'popup.js', 'content.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
