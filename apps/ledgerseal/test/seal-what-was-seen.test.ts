/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Readiness review F-05: a seal covers the issue as the approver saw it. When the issue changed after the panel
 * loaded, the seal is refused and nothing is written.
 *
 * @author Fahim Farook
 */

import { sealIssue, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

function setup() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann']);
  jira.currentUser = 'ann';
  const storage = new MemoryStore();
  return { jira, storage, deps: { jira, storage } };
}

describe('F-05 the seal covers what the approver saw', () => {
  it('seals when the issue is as the panel showed it', async () => {
    const { deps } = setup();
    const view: any = await verifyIssue({}, panelContext('ann'), deps);
    expect(view.viewHash).toMatch(/^[0-9a-f]{64}$/);
    await expect(sealIssue({ viewHash: view.viewHash, signature: validSignature() }, panelContext('ann'), deps)).resolves.toMatchObject({ ok: true });
  });

  it('refuses, and writes nothing, when the description changed while the approver was reading', async () => {
    const { jira, storage, deps } = setup();
    const view: any = await verifyIssue({}, panelContext('ann'), deps);
    jira.issue.fields.description = 'Also drop the audit table';
    await expect(sealIssue({ viewHash: view.viewHash, signature: validSignature() }, panelContext('ann'), deps)).resolves.toMatchObject({
      ok: false,
      code: 'ISSUE_CHANGED',
      message: 'The issue changed since you opened it. Nothing was saved. Refresh, review the issue, and seal again.'
    });
    expect(storage.sets).toEqual([]);
  });

  it('gives the same hash whether or not the site has a key yet', async () => {
    const { deps } = setup();
    const before: any = await verifyIssue({}, panelContext('ann'), deps);
    await sealIssue({ viewHash: before.viewHash, signature: validSignature() }, panelContext('ann'), deps);
    const after: any = await verifyIssue({}, panelContext('ann'), deps);
    expect(after.viewHash).toBe(before.viewHash);
  });

  it('the panel sends the hash it was shown', () => {
    const ui = require('fs').readFileSync(require('path').resolve(__dirname, '../src/frontend/index.tsx'), 'utf8');
    expect(ui).toContain('viewHash: result?.viewHash');
  });
});
