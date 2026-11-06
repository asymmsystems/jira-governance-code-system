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

  it('(BL-1, ADR-010) declares report:personal-data and a weekly trigger bound to personalDataTrigger', () => {
    expect(manifest).toContain('- report:personal-data');
    expect(manifest).toMatch(/scheduledTrigger:\n(?:\s+#.*\n)*\s+- key: personal-data-report\n\s+function: personal-data-fn\n\s+interval: week/);
    expect(manifest).toMatch(/- key: personal-data-fn\n\s+handler: index\.personalDataTrigger/);
    expect(typeof require('../src/index').personalDataTrigger).toBe('function');
  });
});
