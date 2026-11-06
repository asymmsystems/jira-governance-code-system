/**
 * B-08: honest listing v2. Every claim maps to a passed backlog item and its test.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import * as fs from 'fs';
import * as path from 'path';

const APP = path.join(__dirname, '..');
const LISTING = path.join(APP, '../../docs/marketplace/definitionguard-listing-v2.md');
const read = () => fs.readFileSync(LISTING, 'utf8');

describe('B-08 listing v2', () => {
  it('drops every claim in research-brief section 5', () => {
    const text = read().toLowerCase();
    for (const claim of [
      'least privilege: restricted to',
      '100% automated test coverage',
      'carries the official',
      'inherits enterprise soc 2',
      'tamper-evident',
      'seamless',
      'ledgerseal',
      'verification evidence',
      'zero config',
      '"resolved", or "deployed"',
      'compliance verification',
      '@forge/storage'
    ]) {
      expect({ claim, found: text.includes(claim) }).toEqual({ claim, found: false });
    }
  });

  it('uses no marketing words', () => {
    expect(read()).not.toMatch(/\b(seamless|best-in-class|compliant|world-class|cutting-edge|revolutionary)\b/i);
  });

  it('maps each capability to a passed backlog item and an existing test file', () => {
    const rows = read().split('\n').filter(l => /^\| [A-Z].* \| B-\d\d/.test(l));
    expect(rows.length).toBeGreaterThanOrEqual(10);
    for (const row of rows) {
      const tests = [...row.matchAll(/`(test\/[^`]+\.test\.ts)`/g)].map(m => m[1]);
      expect({ row: row.slice(0, 60), tests: tests.length > 0 }).toEqual({ row: row.slice(0, 60), tests: true });
      for (const t of tests) expect({ t, exists: fs.existsSync(path.join(APP, t)) }).toEqual({ t, exists: true });
    }
  });

  it('lists exactly the scopes in manifest.yml', () => {
    const manifest = fs.readFileSync(path.join(APP, 'manifest.yml'), 'utf8');
    const scopes = manifest.slice(manifest.indexOf('scopes:')).split('\n').filter(l => /^\s+- /.test(l)).map(l => l.trim().slice(2));
    const section = read().slice(read().indexOf('## Security'));
    const listed = [...section.matchAll(/^- `([a-z:-]+)`/gm)].map(m => m[1]);
    expect(listed.sort()).toEqual(scopes.sort());
  });

  it('states the limit of the signature and of the history check', () => {
    const text = read();
    expect(text).toContain('does not protect against the vendor');
    expect(text).toContain('It does not stop someone who can rewrite');
  });

  it('(BL-2) says what is signed, with which key id, where the public key is, and what happens without a key', () => {
    const text = read();
    for (const field of ['schemaVersion', 'issueId', 'templateId', 'templateVersion', 'stateVersion', 'mandatoryTotal', 'mandatoryCompleted',
      'openMandatoryItemIds', 'isFullySatisfied', 'headHash', 'issuedAt', 'keyId', 'sig']) {
      expect({ field, listed: text.includes(`\`${field}\``) }).toEqual({ field, listed: true });
    }
    expect(text).toContain('`dg-prod-2026-11`');
    expect(text).toContain('https://asymm.systems/product/jira-governance/signing-keys.html');
    expect(text).toContain('"Property not signed"');
    // No public file may point into the private app repository.
    expect(text).not.toContain('definitionguard-public-key.pem');
    expect(text).not.toContain('jira-governance-code-system');
  });

  it('(BL-6) makes no compliance overclaim: no CC7.2, and a tick is not an electronic signature', () => {
    const text = read();
    expect(text).not.toContain('CC7.2');
    expect(text).not.toMatch(/sign-offs?\b/i);
    expect(text).toContain('it is not an electronic signature');
  });

  it('(BL-1, BL-4) states the personal data handling and the licence behaviour', () => {
    const text = read();
    expect(text).toContain('Once a week the app reports these account ids to Atlassian');
    expect(text).toContain('holds no personal data');
    expect(text).toContain('the gate is off: the validator lets every move through');
  });

  it('(BL-6) the superseded listing is gone', () => {
    expect(fs.existsSync(path.join(APP, '../../docs/marketplace/definitionguard-listing.md'))).toBe(false);
  });

  it('states the owner prices of 2026-11-06: free to 10 users, then $0.95, $0.75 and $0.24, annual 10 times monthly', () => {
    const table = read().slice(read().indexOf('## Transparent Pricing'));
    expect(table).toContain('| **1 to 10 Users** | **Free** | **Free** |');
    expect(table).toContain('| **11 to 100 Users** | $0.95 per user / month | $9.50 per user / year |');
    expect(table).toContain('| **101 to 250 Users** | $0.75 per user / month | $7.50 per user / year |');
    expect(table).toContain('| **251 to 1,000 Users** | $0.24 per user / month | $2.40 per user / year |');
    expect(table).toContain('| **More than 1,000 Users** | Custom price | Custom price |');
    expect(read()).not.toMatch(/\$(1\.50|1\.20|0\.90|1\.00|0\.80|0\.40)\b/);
  });

  it('says the gate needs an admin to add the validator, and does not claim compliance', () => {
    const text = read();
    expect(text).toContain('A Jira admin adds the DefinitionGuard validator to each transition');
    expect(text).toContain('DefinitionGuard does not certify your team against any standard.');
  });
});
