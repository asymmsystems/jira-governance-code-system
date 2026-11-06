/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-10: no unsupported compliance or integrity claim in any tracked file of the app,
 * and the UI and validator texts are the replacements in ux-spec.md section 5 and spec v2 section 9.
 *
 * @author Fahim Farook
 */

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { validateTransitionGate } from '../src/validator/workflow-validator';

const APP = path.resolve(__dirname, '..');
const THIS_FILE = path.basename(__filename);

function trackedFiles(): string[] {
  const out = execFileSync('git', ['-C', APP, 'ls-files', '--cached', '--others', '--exclude-standard', '.'], { encoding: 'utf8' });
  return out
    .split('\n')
    .filter(f => f && !f.endsWith(THIS_FILE) && !f.endsWith('.pem') && !f.endsWith('package-lock.json'))
    .map(f => path.join(APP, f))
    .filter(f => fs.existsSync(f));
}

// Built from parts where needed, so the list itself is not a claim in a scanned file.
const BANNED: RegExp[] = [
  /21 ?CFR/i,
  /Part 11/i,
  /SOC ?2/i,
  /ISO ?27001/i,
  /immutable/i,
  /audit[ -]ready/i,
  /Cloud Fortified/i,
  /\bcompliant\b/i,
  /\bcompliance\b/i,
  /cryptographic(ally)? (seal|sign|proof|integrity)/i,
  /UNTAMPERED/,
  /TAMPER DETECTED/,
  /Re-?Authori[sz]/i
];

// The panel text lives in the view model; index.tsx maps it to UI Kit components (B-15)
const UI = ['src/frontend/index.tsx', 'src/frontend/view-model.ts'].map(f => fs.readFileSync(path.join(APP, f), 'utf8')).join('\n');

describe('B-10 no unsupported claims', () => {
  it('has no banned claim in any tracked file of the app', () => {
    const hits: string[] = [];
    for (const file of trackedFiles()) {
      const text = fs.readFileSync(file, 'utf8');
      for (const pattern of BANNED) {
        const m = pattern.exec(text);
        if (m) hits.push(`${path.relative(APP, file)}: ${m[0]}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('uses the plain panel texts from ux-spec section 5', () => {
    for (const text of [
      'Checking the seal...',
      'Sealed. No change since approval.',
      'Changed after approval',
      'Changed after approval, then changed back',
      'This issue changed after approval and was later changed back. An approver must approve it again.',
      'Approve these changes',
      'Seal this issue',
      'Seal this issue to record approval of its current content.',
      'Sign and seal',
      'Tamper-evident seal'
    ]) {
      expect(UI).toContain(text);
    }
    for (const lozenge of ['SEALED', 'CHANGED', 'NOT SEALED']) {
      expect(UI).toContain(`text: '${lozenge}'`);
    }
  });

  it('describes the validator plainly in the manifest', () => {
    const manifest = fs.readFileSync(path.join(APP, 'manifest.yml'), 'utf8');
    expect(manifest).toContain('description: Blocks the transition unless the issue is sealed and unchanged since approval.');
  });

  it('uses the validator messages of spec v2 section 9', () => {
    const live = { issueId: '1', issueKey: 'X-1', projectKey: 'X', issueType: 'T', status: 'S', fields: [], attachments: [], capturedAt: 't' };
    expect(validateTransitionGate(null, live).errorMessage).toBe(
      'LedgerSeal: this issue is not sealed. To proceed: open the LedgerSeal panel on this issue, select your sign-off role, agree to the declaration, and click "Seal this issue".'
    );
    const sealed = { snapshotHash: 'x', snapshot: live, revoked: false, compromised: false };
    expect(validateTransitionGate({ ...sealed, revoked: true }, live, { revocationReason: 'scope withdrawn', revokedAt: '2026-11-01T10:00:00.000Z' }).errorMessage).toBe(
      'LedgerSeal: the seal was revoked on 2026-11-01 (reason: scope withdrawn). Seal it again to continue.'
    );
    const changed = { ...live, fields: [{ id: 'summary', name: 'Summary', type: 'string', value: 'b' }] };
    const before = { ...live, fields: [{ id: 'summary', name: 'Summary', type: 'string', value: 'a' }] };
    const { computeSnapshotHash } = require('../src/domain/crypto');
    const sealedBefore = { snapshotHash: computeSnapshotHash(before), snapshot: before, revoked: false, compromised: false };
    expect(validateTransitionGate(sealedBefore, changed).errorMessage).toBe(
      'LedgerSeal: 1 field changed after approval (Summary). Ask a project admin who did not make the change to approve it in the LedgerSeal panel.'
    );
    expect(validateTransitionGate({ ...sealedBefore, compromised: true }, before).errorMessage).toBe(
      'LedgerSeal: this issue changed after approval and was changed back. Ask a project admin to approve it again in the LedgerSeal panel.'
    );
  });

  it('states the measured test count in the README', () => {
    const readme = fs.readFileSync(path.join(APP, 'README.md'), 'utf8');
    expect(readme).toMatch(/\| Tests \| \d+ in \d+ suites \|/);
    expect(readme).not.toContain('52 automated tests');
  });
});
