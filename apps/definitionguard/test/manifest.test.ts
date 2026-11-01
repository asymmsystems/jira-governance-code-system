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
});
