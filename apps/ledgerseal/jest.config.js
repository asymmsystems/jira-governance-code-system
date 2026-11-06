module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  moduleDirectories: ['node_modules', '<rootDir>/node_modules'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/frontend/view-model.ts',
    '!src/**/*.d.ts',
    '!src/frontend/**/*.tsx'
  ],
  coverageReporters: ['json', 'json-summary', 'text', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
