/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: manifest configuration checks
 */

import * as fs from 'fs';
import * as path from 'path';

const manifest = fs.readFileSync(path.join(__dirname, '..', 'manifest.yml'), 'utf8');

describe('manifest.yml', () => {
  it('declares a daily scheduled trigger that runs the snapshot function with a 600 s timeout (B-08)', () => {
    expect(manifest).toMatch(/scheduledTrigger:\s*\n\s*- key: fourrealities-daily-snapshot\s*\n\s*function: snapshot\s*\n\s*interval: day/);
    expect(manifest).toMatch(/- key: snapshot\s*\n\s*handler: index\.snapshot\s*\n\s*timeoutSeconds: 600/);
  });

  it('B-23: turns on Marketplace licensing for the app', () => {
    expect(manifest).toMatch(/\napp:\n(?:  .*\n)*  licensing:\n    enabled: true\n/);
  });

  it('keeps the scopes the app uses, and declares no external egress', () => {
    const scopes = manifest.slice(manifest.indexOf('scopes:')).split('\n').filter(l => /^\s*- /.test(l)).map(l => l.trim().slice(2));
    expect(scopes).toEqual([
      'read:jira-work',
      'write:jira-work',
      'storage:app',
      'search:confluence',
      'read:confluence-content.summary',
      'read:jira-user'
    ]);
    expect(manifest).not.toMatch(/external:/);
  });

  it('unifies project page, issue panel, and issue context module titles to Four Realities', () => {
    expect(manifest).toMatch(/jira:projectPage:\s*\n\s*- key: fourrealities-project-dashboard\s*\n\s*title: Four Realities/);
    expect(manifest).toMatch(/jira:issuePanel:\s*\n\s*- key: fourrealities-issue-panel\s*\n\s*title: Four Realities/);
    expect(manifest).toMatch(/jira:issueContext:\s*\n\s*- key: fourrealities-issue-context\s*\n\s*title: Four Realities\s*\n\s*label: Four Realities/);
  });

  it('ADR-011: declares the admin page of the permission standard, with its own resolver function', () => {
    expect(manifest).toMatch(/jira:adminPage:\s*\n(?:\s*#.*\n)?\s*- key: fourrealities-admin\s*\n\s*title: FourRealities gate authority\s*\n\s*render: native\s*\n\s*resource: admin\s*\n\s*resolver:\s*\n\s*function: admin-resolver/);
    expect(manifest).toMatch(/- key: admin-resolver\s*\n\s*handler: index\.adminHandler/);
    expect(manifest).toMatch(/- key: admin\s*\n\s*path: src\/frontend\/admin\.tsx/);
  });
});
