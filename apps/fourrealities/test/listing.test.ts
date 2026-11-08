/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the Marketplace listing and reviewer notes match the app (BL-4): prices, scopes,
 * media sizes, and no claim of features the app does not have.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..', '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const listing = read('docs/marketplace/fourrealities-listing.md');
const notes = read('docs/marketplace/submission/fourrealities-submission-notes.md');
const manifest = read('apps/fourrealities/manifest.yml');
const ASSETS = 'docs/marketplace/assets/fourrealities';

/** Width and height of a PNG from its IHDR header. */
function pngSize(p: string): [number, number] {
  const b = fs.readFileSync(path.join(ROOT, p));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

const scopes = manifest.slice(manifest.indexOf('scopes:')).split('\n').filter(l => /^\s*- /.test(l)).map(l => l.trim().slice(2));

describe('FourRealities listing (BL-4)', () => {
  it('states the owner\'s prices of 2026-11-06', () => {
    expect(listing).toContain('| **1 to 10 Users** | **Free** | **Free** |');
    expect(listing).toContain('| **11 to 100 Users** | $1.40 per user / month | $14.00 per user / year |');
    expect(listing).toContain('| **101 to 250 Users** | $1.10 per user / month | $11.00 per user / year |');
    expect(listing).toContain('| **251 to 1,000 Users** | $0.80 per user / month | $8.00 per user / year |');
    expect(listing).toContain('| **Above 1,000 Users** | $0.80 per user / month | $8.00 per user / year |');
    expect(listing).not.toMatch(/\$1\.50|\$1\.20|\$0\.90/);
  });

  it('names exactly the manifest scopes, in the listing and in the reviewer notes', () => {
    for (const scope of scopes) {
      expect(listing).toContain(`\`${scope}\``);
      expect(notes).toContain(`| \`${scope}\` |`);
    }
    const noted = Array.from(notes.matchAll(/^\| `([a-z:.-]+)` \|/gm)).map(m => m[1]);
    expect(noted.sort()).toEqual([...scopes].sort());
  });

  it('lists five 1840 x 900 screenshots that exist, a 1120 x 548 banner and three 580 x 330 highlights', () => {
    const shots = Array.from(listing.matchAll(/^\d\. `(\d\d-[a-z-]+\.png)`/gm)).map(m => m[1]);
    expect(shots).toEqual(['01-dashboard.png', '02-issue-panel.png', '03-link-decision.png', '04-inspect.png', '05-admin.png']);
    for (const s of shots) expect(pngSize(`${ASSETS}/${s}`)).toEqual([1840, 900]);
    expect(pngSize(`${ASSETS}/banner.png`)).toEqual([1120, 548]);
    for (const i of [1, 2, 3]) expect(pngSize(`${ASSETS}/highlight-${i}.png`)).toEqual([580, 330]);
    expect(listing).not.toContain('RECAPTURE REQUIRED');
  });

  it('claims no feature the app does not have, and names the real admin page and panels', () => {
    expect(listing).not.toMatch(/listing-v2|Audit Gate panel|Checklist panel|100% (automated )?test coverage|no settings page/i);
    // Merge review H-1: an unverified record counts like no record; the listing must not say it is only left out.
    expect(listing).not.toMatch(/Reported, not verified|reported and not scored/);
    expect(listing).toContain('counts exactly like no record');
    // Round 2 N-4: a changed, copied or older record is missing even before Done.
    expect(listing).toContain('counts as evidence missing, also before Done');
    expect(fs.existsSync(path.join(ROOT, 'docs/marketplace/fourrealities-listing-v2.md'))).toBe(false);
    expect(manifest).toContain('title: FourRealities gate authority');
    expect(listing).toContain('FourRealities gate authority');
    expect(notes).toContain('Jira settings > Apps > FourRealities gate authority');
    expect(notes).not.toMatch(/asymmsystems\.atlassian\.net|AUDT-/);
  });

  it('ADR-015 Q7: names the evidence reports "evidence reports for change-management audits", never an audit log, and only as release copy', () => {
    const release = listing.slice(listing.indexOf('## Release copy: evidence reports (ADR-015)'));
    expect(release).toContain('**Evidence Reports for Change-Management Audits**');
    expect(release).toContain('"evidence reports for change-management audits"');
    expect(release).toContain("FourRealities is not an administrative audit log: Jira's audit log and Atlassian Guard keep it.");
    const before = listing.slice(0, listing.indexOf('## Release copy: evidence reports (ADR-015)'));
    expect(before).not.toMatch(/evidence report/i);
    const row = release.split('\n').find(l => l.startsWith('| **Evidence Reports'))!;
    expect(row).not.toMatch(/audit log|tamper|compliant/i);
  });

  it('uses no em or en dash', () => {
    for (const text of [listing, notes]) expect(text).not.toMatch(/[–—]/);
  });
});
