module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.d.ts'
  ],
  coverageReporters: ['json', 'json-summary', 'text', 'lcov'],
  // Per-file thresholds: 90% on every metric for every source module (round log, B-01, B-16, B-06).
  coverageThreshold: {
    './src/domain/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/storage/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/jira/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/ui/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/frontend/**/*.tsx': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/index.ts': { branches: 90, functions: 90, lines: 90, statements: 90 }
  }
};
