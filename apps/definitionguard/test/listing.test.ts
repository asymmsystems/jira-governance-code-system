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
    expect(text).toContain('definitionguard-public-key.pem');
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
