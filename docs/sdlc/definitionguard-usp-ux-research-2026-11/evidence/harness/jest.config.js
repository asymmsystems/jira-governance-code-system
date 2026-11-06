// DefinitionGuard research harness (Part A baseline, reused in Part B).
// Runs against the app source in place. It writes nothing under apps/.
// Run from the app folder so npx finds jest:
//   cd jira-governance-code-system/apps/definitionguard
//   flatpak-spawn --host npx jest -c docs/sdlc/definitionguard-usp-ux-research-2026-11/evidence/harness/jest.config.js
const path = require('path');
// HARNESS_APP selects the checkout to measure (Part B: the build worktree).
const APP = process.env.HARNESS_APP || '/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/apps/definitionguard';

module.exports = {
  rootDir: __dirname,
  roots: [__dirname],
  testMatch: ['**/*.harness.ts'],
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', path.join(APP, 'node_modules')],
  transform: {
    '^.+\\.tsx?$': [path.join(APP, 'node_modules/ts-jest'), {
      diagnostics: false,
      tsconfig: { target: 'ES2022', module: 'commonjs', esModuleInterop: true, strict: false, jsx: 'react' }
    }]
  },
  globals: { APP_DIR: APP },
  testTimeout: 600000
};
