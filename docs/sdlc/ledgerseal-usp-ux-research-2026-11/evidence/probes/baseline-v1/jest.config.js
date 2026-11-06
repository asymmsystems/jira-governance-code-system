// LedgerSeal research probes. Runs the app source read-only from the scratch folder.
// Run: flatpak-spawn --host /home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/apps/ledgerseal/node_modules/.bin/jest -c <this file>
const APP = '/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/apps/ledgerseal';
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/*.probe.ts'],
  transform: {
    '^.+\\.tsx?$': [APP + '/node_modules/ts-jest', { tsconfig: __dirname + '/tsconfig.json', diagnostics: false }]
  },
  modulePaths: [APP + '/node_modules'],
  cacheDirectory: __dirname + '/.jest-cache',
  collectCoverage: false,
  verbose: false
};
