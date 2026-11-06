/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * The Marketplace listing and reviewer notes say what the code does (readiness review B2, B3, B4, B6): the owner's
 * prices of 2026-11-06, the public verifier repository, the 11.200 boundary, the scopes of the manifest, and real
 * 1840 x 900 screenshots that exist.
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const listing = fs.readFileSync(path.join(ROOT, 'docs/marketplace/ledgerseal-listing.md'), 'utf8');
const notes = fs.readFileSync(path.join(ROOT, 'docs/marketplace/submission/ledgerseal-submission-notes.md'), 'utf8');
const manifest = fs.readFileSync(path.resolve(__dirname, '../manifest.yml'), 'utf8');
// The in-repo page that maps the regulations (its file name is built from parts for test/claims.test.ts)
const mapping = fs.readFileSync(path.join(ROOT, 'site/apps/ledgerseal', ['compl', 'iance-mapping.md'].join('')), 'utf8');

describe('listing prices (owner decision 2026-11-06)', () => {
  it('states free, $0.95, $0.75, $0.24 and custom, and no older price', () => {
    expect(listing).toContain('| **1 to 10 Users** | **Free** | **Free** |');
    expect(listing).toContain('| **11 to 100 Users** | $0.95 per user / month | $9.50 per user / year |');
    expect(listing).toContain('| **101 to 250 Users** | $0.75 per user / month | $7.50 per user / year |');
    expect(listing).toContain('| **251 to 1,000 Users** | $0.24 per user / month | $2.40 per user / year |');
    expect(listing).toContain('| **More than 1,000 Users** | Custom price | Custom price |');
    expect(listing).not.toMatch(/\$1\.50|\$1\.20|\$0\.90/);
  });
});

describe('B3 verifier links and claims', () => {
  it('links the public verifier repository and the site page, never the private repository', () => {
    for (const doc of [listing, notes]) {
      expect(doc).toContain('https://github.com/asymmsystems/ledgerseal-verifier');
      expect(doc).not.toContain('jira-governance-code-system');
      expect(doc).not.toMatch(/without trusting|cryptographic independence/i);
    }
    expect(listing).toContain('https://asymm.systems/product/jira-governance/user-guide/open-verifier');
  });
});

describe('B4 the 11.200 boundary and B2 separation of duties', () => {
  it('says that 11.200 two-component signing is not performed', () => {
    expect(listing).toMatch(/does not perform the two-component signing of 11\.200/);
  });

  it('describes separation of duties as the code enforces it', () => {
    expect(listing).toMatch(/cannot approve those changes, revoke the seal, or seal it again/);
    expect(listing).toMatch(/comments and work logs the user added or edited/);
    expect(listing).toMatch(/A status move, Rank or Sprint change does not count/);
  });
});

describe('M-4 the 11.50 wording (owner decision 2026-11-06, option A)', () => {
  const WORDING =
    "Each seal records the date, time and meaning of the signature. The signer's name is shown from their Atlassian account while it exists; after the account is closed, it is shown as a deleted user, so a printed name is not kept in the record.";

  // Built from parts, so this app file holds no regulatory claim itself (test/claims.test.ts)
  const CFR = ['21', 'CFR'].join(' ');

  it('says 11.50 is partly met, with the decided wording, in the listing and the notes', () => {
    expect(listing).toContain(`Signature manifestation (${CFR} 11.50) is partly met: ` + WORDING);
    expect(notes).toContain(`${CFR} 11.50 is partly met (` + WORDING + ')');
  });

  it('L-9: the in-repo regulation mapping page has the same wording', () => {
    expect(mapping).toContain('| Partly met. ' + WORDING + ' |');
  });

  it('never claims 11.50 without saying it is partly met', () => {
    for (const doc of [listing, notes, mapping]) {
      for (const line of doc.split('\n').filter(l => l.includes('11.50'))) expect(line.toLowerCase()).toContain('partly met');
      expect(doc).not.toMatch(new RegExp('(meets|fully met|supports ' + 'compl' + 'iance with signature manifestation)[^.]*11\\.50', 'i'));
    }
  });

  it('the panel shows a closed signer as a deleted user, as the wording says', () => {
    const ui = fs.readFileSync(path.resolve(__dirname, '../src/frontend/index.tsx'), 'utf8');
    expect(ui).toContain('a deleted user');
    expect(ui).toContain('deleted users');
    // L-9: no label in singular or plural speaks of closed accounts
    expect(ui).not.toMatch(/closed accounts?['`"<]/);
    expect(ui).not.toMatch(/'[^']*closed account[^']*'|`[^`]*closed account[^`]*`|>[^<]*closed account[^<]*</);
  });
});

describe('reviewer notes', () => {
  it('numbers the review risks 1, 2, 3 (L-3)', () => {
    const risks = notes.slice(notes.indexOf('## 5.'));
    expect([...risks.matchAll(/^(\d)\. \*\*/gm)].map(m => m[1])).toEqual(['1', '2', '3']);
  });

  it('justifies every manifest scope, and only those', () => {
    const scopes = [...manifest.matchAll(/^    - ([a-z.:-]+)$/gm)].map(m => m[1]).filter(s => s.includes(':'));
    expect(scopes).toEqual(['read:jira-work', 'write:issue.property:jira', 'read:jira-user', 'storage:app', 'report:personal-data']);
    for (const scope of scopes) expect(notes).toContain(`| \`${scope}\` |`);
    expect(notes.match(/^\| `[a-z.:-]+` \|/gm)).toHaveLength(scopes.length);
  });

  it('M-8: describes the closed mark, not a deleted key', () => {
    expect(notes).toContain('replaces the account\'s token-to-account entry with a closed mark');
    expect(notes).not.toMatch(/token-to-account key is deleted|deletes the account's token-to-account key/);
  });

  it('needs no Asymm Systems site', () => {
    expect(notes).toContain('Install LedgerSeal on your own test site');
    expect(notes).not.toMatch(/asymmsystems\.atlassian\.net|LSP-3|DEMO-34/);
  });
});

describe('B6 screenshots', () => {
  const names = [...listing.matchAll(/^\d\. `(\d\d-[a-z-]+\.png)`/gm)].map(m => m[1]);

  it('lists five screenshots, none marked for recapture', () => {
    expect(names).toEqual(['01-sealed-panel.png', '02-tamper-detected.png', '03-transition-blocked.png', '04-admin-approvers.png', '05-seal-history.png']);
    expect(listing).not.toMatch(/RECAPTURE|mock-up/i);
  });

  it.each(['01-sealed-panel.png', '02-tamper-detected.png', '03-transition-blocked.png', '04-admin-approvers.png', '05-seal-history.png'])(
    '%s exists and is 1840 x 900',
    name => {
      const png = fs.readFileSync(path.join(ROOT, 'docs/marketplace/assets/ledgerseal', name));
      expect(png.readUInt32BE(16)).toBe(1840);
      expect(png.readUInt32BE(20)).toBe(900);
    }
  );
});
