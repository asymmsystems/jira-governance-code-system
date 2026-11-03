module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@asymm/jira-ui$': '<rootDir>/../../packages/asymm-jira-ui/src/index.ts'
  },
  moduleDirectories: ['node_modules', '<rootDir>/node_modules'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/frontend/**'
  ],
  coverageReporters: ['json', 'json-summary', 'text', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    // Each source file, not only the total (DG-13, PX-03).
    './src/**/*.ts': {
      branches: 90
    }
  }
};
