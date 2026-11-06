/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities research harness: runs against apps/fourrealities/src without changing the app.
 */
const NM = '/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/apps/ledgerseal/node_modules';

module.exports = {
  rootDir: __dirname,
  roots: ['<rootDir>', '<rootDir>/../probes'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testEnvironment: 'node',
  cacheDirectory: '<rootDir>/.jest-cache',
  moduleDirectories: ['node_modules', NM],
  transform: {
    '^.+\\.tsx?$': [NM + '/ts-jest', {
      isolatedModules: true,
      tsconfig: {
        target: 'ES2022', module: 'commonjs', jsx: 'react',
        esModuleInterop: true, strict: false, skipLibCheck: true
      }
    }]
  },
  testTimeout: 600000
};
