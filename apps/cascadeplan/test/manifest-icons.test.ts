/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * TASK-00007 findings 5a and 5b: every module that Jira shows with an icon has the bundled CascadePlan
 * icon (the admin page had none, so Jira showed a placeholder), and Jira names the app as the listing
 * does.
 */

import * as fs from 'fs';
import * as path from 'path';

const APP = path.join(__dirname, '..');
const manifest = fs.readFileSync(path.join(APP, 'manifest.yml'), 'utf8');

describe('TASK-00007 CascadePlan icon and names in Jira', () => {
  it('the project page and the admin page carry the bundled icon', () => {
    // Module types whose manifest schema has `icon`: here the project page and the admin page
    for (const key of ['cascadeplan-project-planner', 'cascadeplan-admin']) {
      expect(manifest).toMatch(new RegExp(`- key: ${key}\\n(?:      .*\\n)*?      icon: resource:main;icon\\.svg\\n`));
    }
  });

  it('the icon is the Family A mark on its sand chiclet, with no Atlassian blue', () => {
    const svg = fs.readFileSync(path.join(APP, 'static/frontend/build/icon.svg'), 'utf8');
    expect(svg).toMatch(/^<svg [^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain('d="M10.5 7.5H5.5V40.5H10.5"');
    expect(svg).toContain('fill="#F8DBA9"');
    expect(svg).not.toMatch(/#0052CC|#0C66E4/i);
  });

  it('names the modules CascadePlan Planner and CascadePlan approvers', () => {
    expect(manifest).toContain('    - key: cascadeplan-project-planner\n      title: CascadePlan Planner\n');
    expect(manifest).toContain('    - key: cascadeplan-admin\n      title: CascadePlan approvers\n');
  });
});
