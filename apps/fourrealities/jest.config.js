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
  // Per-file thresholds (90%) for every module except src/index.ts, which holds a floor at its
  // measured value until its remaining v1 code is replaced (round log, B-01 and B-16).
  coverageThreshold: {
    './src/domain/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/storage/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/jira/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/ui/**/*.ts': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/frontend/**/*.tsx': { branches: 90, functions: 90, lines: 90, statements: 90 },
    './src/index.ts': { branches: 88, functions: 90, lines: 90, statements: 90 }
  }
};
