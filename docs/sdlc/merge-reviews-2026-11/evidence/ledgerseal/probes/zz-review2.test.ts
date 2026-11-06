/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Merge review probes (not committed).
 *
 * @author Fahim Farook
 */

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '', privacy: {} }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));

import * as oldIndex from '../zzmaster/src/index';
import * as oldFakes from '../zzmaster/test/support/fakes';
import * as newIndex from '../src/index';
import * as fakes from './support/fakes';
import { convertRecord } from '../src/service/conversion';

async function oldTwoSealRecord() {
  const ojira = new oldFakes.FakeJira(oldFakes.sampleIssue());
  ojira.approvers = new Set(['acc-ann', 'acc-bob']);
  const ostore = new oldFakes.MemoryStore();
  const odeps = { jira: ojira, storage: ostore } as any;
  ojira.currentUser = 'acc-ann';
  await oldIndex.sealIssue({ signature: oldFakes.validSignature() }, oldFakes.panelContext('acc-ann'), odeps);
  ojira.edit('acc-mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed by mallory');
  ojira.currentUser = 'acc-bob';
  await oldIndex.sealIssue({ signature: oldFakes.validSignature({ reason: 'CAB ok' }) }, oldFakes.panelContext('acc-bob'), odeps);
  const store = new fakes.MemoryStore();
  for (const [k, v] of ostore.map) store.map.set(k, JSON.parse(JSON.stringify(v)));
  const jira = new fakes.FakeJira(JSON.parse(JSON.stringify(ojira.issue)));
  jira.changelog = JSON.parse(JSON.stringify(ojira.changelog));
  jira.approvers = new Set(['acc-ann', 'acc-bob', 'acc-carol']);
  return { store, jira };
}

describe('review probes', () => {
  it('R1: conversion stopped after its commit, then a revoke, then the weekly job', async () => {
    const { store, jira } = await oldTwoSealRecord();
    const deps = { jira, storage: store } as any;
    // fail once while deleting a superseded snapshot (after the commit, before the journal is deleted)
    const realDelete = store.delete.bind(store);
    let failed = false;
    store.delete = async (key: string) => {
      if (!failed && key.startsWith('ls3:content:')) {
        failed = true;
        throw new Error('invocation timed out');
      }
      return realDelete(key);
    };
    await expect(convertRecord({ storage: store, jira }, '10001')).rejects.toThrow('timed out');
    store.delete = realDelete;
    expect([...store.map.keys()].some(k => k.startsWith('ls3:convert:'))).toBe(true);
    jira.currentUser = 'acc-bob';
    const revoked: any = await newIndex.revokeSeal({ reason: 'probe revoke' }, fakes.panelContext('acc-bob'), deps);
    expect(revoked.ok).toBe(true);
    const before: any = await newIndex.verifyIssue({}, fakes.panelContext('acc-bob'), deps);
    console.log('R1 after revoke:', before.status);
    await newIndex.personalDataReport({}, {}, deps, async () => []);
    const after: any = await newIndex.verifyIssue({}, fakes.panelContext('acc-bob'), deps);
    console.log('R1 after weekly job:', after.status, JSON.stringify(after.seal?.revocation ?? null));
    const we = await store.get('ls3:we:10001');
    console.log('R1 work effort status/head:', we.currentStatusId, JSON.stringify(we.statusHead));
    expect(after.status).toBe('SEAL_REVOKED');
    console.log('R1 row keys:', [...store.map.keys()].filter(k => k.startsWith('ls3:wes:')).join(' '));
    const ev: any = await newIndex.getSealEvidence({}, fakes.panelContext('acc-bob'), deps);
    console.log('R1 evidence history:', ev.history.map((r: any) => `${r.seq}:${r.transitionName}:${r.reason}`).join(' | '));
    jira.currentUser = 'acc-carol';
    const reseal: any = await newIndex.sealIssue({ signature: fakes.validSignature({ reason: 'again' }) }, fakes.panelContext('acc-carol'), deps);
    console.log('R1 reseal after:', JSON.stringify(reseal));
    const reseal2: any = await newIndex.sealIssue({ signature: fakes.validSignature({ reason: 'again' }) }, fakes.panelContext('acc-carol'), deps);
    console.log('R1 reseal retry:', JSON.stringify(reseal2));
  });

  it('R2: a closed account is written back to the map by a later incident', async () => {
    const { store, jira } = await oldTwoSealRecord();
    const deps = { jira, storage: store } as any;
    // ann seals in the new form; mallory edits after the seal; incident recorded
    jira.currentUser = 'acc-ann';
    await newIndex.personalDataReport({}, {}, deps, async () => []);
    const resealed: any = await newIndex.sealIssue({ signature: fakes.validSignature({ reason: 'again' }) }, fakes.panelContext('acc-ann'), deps);
    expect(resealed.ok).toBe(true);
    jira.edit('acc-mallory', '2099-03-01T00:00:00.000Z', 'summary', 'mallory again');
    await newIndex.verifyIssue({}, fakes.panelContext('acc-ann'), deps);
    // mallory's account is closed
    await newIndex.personalDataReport({}, {}, deps, async (a: any[]) => a.filter(x => x.accountId === 'acc-mallory').map(x => ({ accountId: x.accountId, status: 'closed' })));
    expect(JSON.stringify([...store.map.entries()])).not.toContain('acc-mallory');
    // carol makes a new change to the same field; the next view records a new incident
    jira.edit('acc-carol', '2099-03-02T00:00:00.000Z', 'summary', 'carol');
    await newIndex.verifyIssue({}, fakes.panelContext('acc-ann'), deps);
    const back = JSON.stringify([...store.map.entries()]).includes('acc-mallory');
    console.log('R2 closed account id stored again:', back);
    expect(back).toBe(true);
  });
});
