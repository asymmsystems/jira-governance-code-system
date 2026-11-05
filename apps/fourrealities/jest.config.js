module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleDirectories: ['node_modules', '<rootDir>/node_modules'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.d.ts'
  ],
  coverageReporters: ['json', 'json-summary', 'text', 'lcov'],
  // Per-file thresholds: 90% on every metric for every source module (round log, B-01, B-16, B-06).
  coverageThreshold: {
    './src/contract/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/engine/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/accessor/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/manager/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/ui/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/frontend/**/*.tsx': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/index.ts': { branches: 90, functions: 90, lines: 90, statements: 90 }
  }
};
