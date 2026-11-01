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
  // Per-path thresholds. Backend domain and storage files meet 90% per file.
  // src/index.ts and src/frontend/** hold floors at their measured values until
  // backlog B-05 and B-22 raise them to 90% per file (round-log, B-01).
  coverageThreshold: {
    './src/domain/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/storage/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/index.ts': { branches: 88, functions: 88, lines: 90, statements: 90 },
    './src/frontend/**/*.tsx': { branches: 38, functions: 22, lines: 49, statements: 47 }
  }
};
