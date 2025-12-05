module.exports = {
  preset: 'ts-jest', // Use ts-jest to handle TypeScript files
  testEnvironment: 'node', // Set the test environment to Node.js
  testMatch: ['**/tests/unit/**/*.test.ts', '**/tests/integration/**/*.test.ts'], // Match all test files with .test.ts extension
  moduleFileExtensions: ['ts', 'js', 'json'], // Recognize these file extensions
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1', // Optional: Alias for cleaner imports,
    '^@groceries/shared-types(.*)$': '<rootDir>/../shared_types/src/$1',
  },
  setupFiles: ['dotenv/config'], // Load environment variables from .env
  collectCoverage: true, // Enable code coverage collection
  collectCoverageFrom: [
    '/**/*.{ts,js}', // Collect coverage from all .ts and .js files in src
    '!/**/*.d.ts', // Exclude TypeScript declaration files
  ],
  coverageDirectory: '<rootDir>/coverage', // Output directory for coverage reports
  coverageReporters: ['text', 'lcov'], // Generate text and lcov coverage reports
};
