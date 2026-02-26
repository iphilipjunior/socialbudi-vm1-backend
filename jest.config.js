/**
 * Jest Configuration
 *
 * Configuration for running tests with Jest.
 * Supports unit tests and integration tests.
 */

module.exports = {
  // Use Node.js test environment
  testEnvironment: 'node',

  // Directory for coverage reports
  coverageDirectory: 'coverage',

  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js', // Exclude server entry point
    '!**/node_modules/**'
  ],

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js'
  ],

  // Coverage thresholds (Phase 2 target: 80%)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Show verbose output
  verbose: true,

  // Setup files to run before tests (sets env vars)
  setupFiles: ['./tests/setup.js'],

  // Setup files to run after test environment
  setupFilesAfterEnv: [],

  // Clear mocks between tests
  clearMocks: true,

  // Timeout for async tests (10 seconds)
  testTimeout: 10000,

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles (useful for debugging)
  detectOpenHandles: true
};
