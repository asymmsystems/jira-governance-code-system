/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-19: Marketplace licensing. An inactive licence stops the panel actions, never the customer's workflow.
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSealEvidence, getSealHistory, revokeSeal, sealIssue, validateTransition, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const inactive = (accountId = 'ann') => ({ ...panelContext(accountId), license: { active: false } });

async function sealed() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann']);
  jira.currentUser = 'ann';
  const storage = new MemoryStore();
  await sealIssue({ signature: validSignature() }, panelContext('ann'), { jira, storage });
  return { jira, storage, deps: { jira, storage } };
}

describe('B-19 licensing', () => {
  it('enables licensing in the manifest', () => {
    const manifest = fs.readFileSync(path.resolve(__dirname, '../manifest.yml'), 'utf8');
    expect(manifest).toMatch(/app:\n  id: [^\n]+\n  runtime:\n    name: nodejs22.x\n  licensing:\n    enabled: true/);
  });

  it('returns LICENSE_INACTIVE from every panel resolver and writes nothing', async () => {
    const { jira, storage, deps } = await sealed();
    const sets = storage.sets.length;
    const writes = jira.propertyWrites.length;
    for (const call of [
      () => verifyIssue({}, inactive(), deps),
      () => sealIssue({ signature: validSignature() }, inactive(), deps),
      () => revokeSeal({ reason: 'x' }, inactive(), deps),
      () => getSealHistory({}, inactive(), deps),
      () => getSealEvidence({}, inactive(), deps)
    ]) {
      await expect(call()).resolves.toMatchObject({ ok: false, code: 'LICENSE_INACTIVE' });
    }
    expect(storage.sets.length).toBe(sets);
    expect(jira.propertyWrites.length).toBe(writes);
  });

  it('treats the deprecated isActive flag the same way, and a missing licence (development) as active', async () => {
    const { deps } = await sealed();
    await expect(verifyIssue({}, { ...panelContext('ann'), license: { isActive: false } }, deps)).resolves.toMatchObject({ code: 'LICENSE_INACTIVE' });
    await expect(verifyIssue({}, { ...panelContext('ann'), license: { active: true } }, deps)).resolves.toMatchObject({ status: 'SEAL_VALID' });
    await expect(verifyIssue({}, panelContext('ann'), deps)).resolves.toMatchObject({ status: 'SEAL_VALID' });
  });

  it('does not change the validator result on licence alone (D-8)', async () => {
    const { deps } = await sealed();
    await expect(validateTransition({ issue: { key: 'CHG-1' } }, { license: { active: false } }, deps)).resolves.toEqual({ result: true });
  });
});
