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
      'read:jira-user',
      'report:personal-data'
    ]);
    expect(manifest).not.toMatch(/external:/);
  });

  it('unifies project page, issue panel, and issue context module titles to Four Realities', () => {
    expect(manifest).toMatch(/jira:projectPage:\s*\n\s*- key: fourrealities-project-dashboard\s*\n\s*title: Four Realities/);
    expect(manifest).toMatch(/jira:issuePanel:\s*\n\s*- key: fourrealities-issue-panel\s*\n\s*title: Four Realities/);
    expect(manifest).toMatch(/jira:issueContext:\s*\n\s*- key: fourrealities-issue-context\s*\n\s*title: Four Realities\s*\n\s*label: Four Realities/);
  });

  it('ADR-013: declares the admin page of the permission standard, with its own resolver function', () => {
    expect(manifest).toMatch(/jira:adminPage:\s*\n(?:\s*#.*\n)?\s*- key: fourrealities-admin\s*\n\s*title: FourRealities gate authority\s*\n\s*render: native\s*\n\s*resource: admin\s*\n\s*resolver:\s*\n\s*function: admin-resolver/);
    expect(manifest).toMatch(/- key: admin-resolver\s*\n\s*handler: index\.adminHandler/);
    expect(manifest).toMatch(/- key: admin\s*\n\s*path: src\/frontend\/admin\.tsx/);
  });

  it('ADR-014: runs the personal data report every week', () => {
    expect(manifest).toMatch(/- key: fourrealities-personal-data\s*\n\s*function: personal-data\s*\n\s*interval: week/);
    expect(manifest).toMatch(/- key: personal-data\s*\n\s*handler: index\.personalData\s*\n\s*timeoutSeconds: 600/);
  });

  it('ADR-015: the report consumer (900 s), the daily report run (600 s), Object Store and 1,024 MB, with no new scope', () => {
    expect(manifest).toMatch(/- key: fourrealities-report-daily\s*\n\s*function: report-daily\s*\n\s*interval: day/);
    expect(manifest).toMatch(/objectStore:\s*\n\s*- key: fourrealities-reports\s*\n\s*storageClass: standard/);
    expect(manifest).toMatch(/consumer:\s*\n\s*- key: fourrealities-report-consumer\s*\n\s*queue: fourrealities-report-jobs\s*\n\s*function: report-worker/);
    expect(manifest).toMatch(/- key: report-worker\s*\n\s*handler: index\.reportWorker\s*\n\s*timeoutSeconds: 900/);
    expect(manifest).toMatch(/- key: report-daily\s*\n\s*handler: index\.reportDaily\s*\n\s*timeoutSeconds: 600/);
    expect(manifest).toMatch(/runtime:\s*\n\s*name: nodejs22\.x\s*\n(?:\s*#.*\n)?\s*memoryMB: 1024/);
    expect(manifest).not.toMatch(/webtrigger|external:/);
  });
});

