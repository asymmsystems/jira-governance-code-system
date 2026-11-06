/**
 * B-20: the validator is offered in team-managed projects too.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import * as fs from 'fs';
import * as path from 'path';

describe('B-20 manifest', () => {
  const manifest = fs.readFileSync(path.join(__dirname, '../manifest.yml'), 'utf8');
  const start = manifest.indexOf('jira:workflowValidator:');
  const validator = manifest.slice(start, manifest.indexOf('\n  function:\n', start));

  it("declares projectTypes ['company-managed', 'team-managed'] on the workflow validator", () => {
    expect(validator).toContain("projectTypes: ['company-managed', 'team-managed']");
  });

  it('keeps the validator as a function validator with the same module key', () => {
    expect(validator).toContain('- key: definitionguard-workflow-validator');
    expect(validator).toContain('function: validateTransition');
  });

  it('titles the issue panel Definition of Done without vendor branding', () => {
    const panel = manifest.slice(manifest.indexOf('jira:issuePanel:'), start);
    expect(panel).toContain('title: Definition of Done');
  });

  it('declares the native admin page for approvers under module definitionguard-admin', () => {
    expect(manifest).toContain('jira:adminPage:');
    expect(manifest).toContain('- key: definitionguard-admin');
    expect(manifest).toContain('title: DefinitionGuard approvers');
    expect(manifest).toContain('function: admin-resolver');
  });

  it('declares the read:jira-user scope for group checks and picker', () => {
    expect(manifest).toContain('- read:jira-user');
  });

  it('(MK-02 Q7) declares the granular issue property write scope, not write:jira-work', () => {
    expect(manifest).toMatch(/scopes:\n    - read:jira-work\n    - write:issue\.property:jira\n    - read:jira-user\n    - storage:app\n    - read:workflow:jira\n    - report:personal-data\n?$/);
    expect(manifest).not.toContain('write:jira-work');
  });

  it('(MK-02 Q7) makes only one Jira write, a PUT of its own issue property', () => {
    const src = path.join(__dirname, '../src');
    const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
      .flatMap(e => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]))
      .filter(f => /\.tsx?$/.test(f));
    const writes = files(src).flatMap(f => [...fs.readFileSync(f, 'utf8').matchAll(/method:\s*'([A-Z]+)'/g)]
      .map(m => `${path.relative(src, f)} ${m[1]}`));
    expect(writes).toEqual(['integrity/attestation.ts PUT']);
    const attestation = fs.readFileSync(path.join(src, 'integrity/attestation.ts'), 'utf8');
    expect(attestation).toMatch(/requestJira\(route`\/rest\/api\/3\/issue\/\$\{[^}]+\}\/properties\/\$\{PROPERTY_KEY\}`,\s*\{\s*method: 'PUT'/);
  });

  it('(BL-1, ADR-010) declares report:personal-data and a weekly trigger bound to personalDataTrigger', () => {
    expect(manifest).toContain('- report:personal-data');
    expect(manifest).toMatch(/scheduledTrigger:\n(?:\s+#.*\n)*\s+- key: personal-data-report\n\s+function: personal-data-fn\n\s+interval: week/);
    expect(manifest).toMatch(/- key: personal-data-fn\n\s+handler: index\.personalDataTrigger/);
    expect(typeof require('../src/index').personalDataTrigger).toBe('function');
  });
});
