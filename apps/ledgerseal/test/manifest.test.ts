/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Manifest checks for B-18 (entity property index), B-19 (licensing) and B-20 (bundled icon, no dead code).
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';

const manifest = fs.readFileSync(path.resolve(__dirname, '../manifest.yml'), 'utf8');

describe('B-18 entity property index', () => {
  it('indexes status, everCompromised and incidentCount of ledgerseal-cert for JQL', () => {
    expect(manifest).toContain(`  jira:entityProperty:
    - key: ledgerseal-cert-index
      entityType: issue
      propertyKey: ledgerseal-cert
      values:
        - path: status
          type: string
          searchAlias: ledgersealStatus
        - path: everCompromised
          type: string
          searchAlias: ledgersealEverCompromised
        - path: incidentCount
          type: number
          searchAlias: ledgersealIncidents`);
  });
});

describe('approver policy admin page', () => {
  it('declares a native Jira admin page on the shared resolver, with its own UI resource', () => {
    expect(manifest).toContain(`  jira:adminPage:
    - key: ledgerseal-admin
      title: LedgerSeal settings
      icon: resource:icons;icon.svg
      render: native
      resource: admin
      resolver:
        function: resolver`);
    expect(manifest).toMatch(/  - key: admin\n    path: src\/frontend\/admin\.tsx/);
  });

  it('declares the work scopes, the issue property write scope (F-20) and the personal data report scope, nothing else', () => {
    // ADR-016: send:notification:jira (granular) only emails a signer their own signing code (spike S-8)
    expect(manifest).toMatch(/scopes:\n    - read:jira-work\n    - write:issue\.property:jira\n    - read:jira-user\n    - storage:app\n    - report:personal-data\n    - send:notification:jira\n?$/);
  });
});

describe('ADR-011 personal data and deleted issues', () => {
  it('runs the personal data report weekly and deletes the records of a deleted issue', () => {
    expect(manifest).toContain(`  scheduledTrigger:
    # ADR-011 decision 5: the weekly personal data report; closed accounts are erased from the party map.
    - key: ledgerseal-personal-data-report
      function: personal-data-report
      interval: week`);
    expect(manifest).toContain(`    - key: ledgerseal-issue-deleted
      function: on-issue-deleted
      events:
        - avi:jira:deleted:issue`);
    expect(manifest).toContain('      handler: index.personalDataReport');
    expect(manifest).toContain('      handler: index.onIssueDeleted');
  });
});

describe('B-20 bundled icon and no dead code', () => {
  it('loads nothing from outside the app: no http URL in the manifest', () => {
    expect(manifest).not.toMatch(/https?:\/\//);
    expect(manifest).toContain('      icon: resource:icons;icon.svg');
    expect(manifest).toMatch(/  - key: icons\n    path: static\/icons/);
    const svg = fs.readFileSync(path.resolve(__dirname, '../static/icons/icon.svg'), 'utf8');
    expect(svg).toMatch(/^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  it('TASK-00007 5a: every module that Jira shows with an icon has the bundled LedgerSeal icon', () => {
    // Module types whose manifest schema has `icon`: the issue panel, the issue context and the admin page here
    for (const key of ['ledgerseal-panel', 'ledgerseal-context', 'ledgerseal-admin']) {
      expect(manifest).toMatch(new RegExp(`- key: ${key}\\n(?:      .*\\n)*?      icon: resource:icons;icon\\.svg\\n`));
    }
    // The Family A mark: the "[ }" frame with the rose wax seal, no Atlassian blue
    const svg = fs.readFileSync(path.resolve(__dirname, '../static/icons/icon.svg'), 'utf8');
    expect(svg).toContain('d="M10.5 7.5H5.5V40.5H10.5"');
    expect(svg).toContain('#BA6E8F');
    expect(svg).not.toMatch(/#0C66E4/i);
  });

  it('TASK-00007 5b: Jira shows the app by its listing name, LedgerSeal', () => {
    expect(manifest).toContain('    - key: ledgerseal-panel\n      title: LedgerSeal\n');
    expect(manifest).not.toMatch(/Approval Seal/);
    // Labels that name an action keep the action
    expect(manifest).toContain('      title: Sign with LedgerSeal\n');
  });

  it('has no unused renderIssuePanel handler', () => {
    const index = fs.readFileSync(path.resolve(__dirname, '../src/index.ts'), 'utf8');
    expect(index).not.toContain('renderIssuePanel');
    const tests = fs.readdirSync(__dirname).filter(f => f.endsWith('.ts') && f !== 'manifest.test.ts');
    for (const file of tests) expect(fs.readFileSync(path.join(__dirname, file), 'utf8')).not.toContain('renderIssuePanel');
  });
});

describe('ADR-018 signature field and issue action', () => {
  const fs = require('fs');
  const text: string = fs.readFileSync(require('path').resolve(__dirname, '../manifest.yml'), 'utf8');
  it('declares the signature field with a UI Kit edit view, no view resource and no experience limit', () => {
    const block = text.slice(text.indexOf('  jira:customField:'), text.indexOf('  jira:issueAction:'));
    expect(block).toContain('- key: ledgerseal-signature');
    expect(block).toMatch(/edit:\n        resource: sigedit\n        render: native\n      resolver:\n        function: resolver/);
    // A view resource made the new transition dialog show a plain text box (live, LSP-6)
    expect(block).not.toMatch(/^      view:/m);
    expect(block).not.toMatch(/experience:/);
  });

  it('declares the "Sign with LedgerSeal" issue action on the panel resource', () => {
    expect(text).toMatch(/jira:issueAction:\n(?:    #.*\n)*    - key: ledgerseal-sign-action\n      title: Sign with LedgerSeal\n      render: native\n      resource: main/);
    expect(text).toMatch(/  - key: sigedit\n    path: src\/frontend\/signature-field\.tsx/);
  });
});
