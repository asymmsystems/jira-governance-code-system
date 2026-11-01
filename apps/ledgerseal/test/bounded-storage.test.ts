/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-17: bounded KVS values, one transaction per seal, and concurrency control.
 *
 * @author Fahim Farook
 */

import { splitUtf8, MAX_PART_BYTES } from '../src/storage/seal-repository';
import { sealIssue, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const doc = (paras: number, width = 200) => ({
  type: 'doc',
  version: 1,
  content: Array.from({ length: paras }, (_, n) => ({ type: 'paragraph', content: [{ type: 'text', text: 'Line ' + n + ' '.padEnd(width, 'x') }] }))
});

function combinedIssue() {
  const issue = sampleIssue();
  issue.fields.description = doc(400);
  issue.fields.comment = {
    total: 100,
    comments: Array.from({ length: 100 }, (_, n) => ({ id: String(20000 + n), author: { accountId: 'c' + (n % 5) }, body: doc(1), created: '2026-10-30T00:00:00.000+0000' }))
  };
  return issue;
}

function setup(issue: any = sampleIssue()) {
  const jira = new FakeJira(issue);
  jira.approvers = new Set(['ann', 'bob']);
  jira.currentUser = 'ann';
  const storage = new MemoryStore();
  return { jira, storage, deps: { jira, storage } };
}

describe('B-17 bounded storage', () => {
  it('adversarial (LS-07, T-01): keeps every KVS value under 120 KiB for the combined fixture, and reads the snapshot back', async () => {
    const { storage, deps } = setup(combinedIssue());
    await expect(sealIssue({ signature: validSignature() }, panelContext('ann'), deps)).resolves.toMatchObject({ ok: true });
    const largest = Math.max(...[...storage.map.keys()].map(k => storage.bytes(k)));
    expect(largest).toBeLessThan(120 * 1024);
    const we = await model.workEffort(storage);
    expect(we.attributes.snapshotParts).toBeGreaterThan(1);
    expect((await model.sealedSnapshot(storage)).comments).toHaveLength(100);
    expect(((await verifyIssue({}, panelContext('viewer'), deps)) as any).status).toBe('SEAL_VALID');
  });

  it('writes a seal in one transaction of at most 25 operations', async () => {
    const { storage, deps } = setup(combinedIssue());
    await sealIssue({ signature: validSignature() }, panelContext('ann'), deps);
    expect(storage.commits).toHaveLength(1);
    expect(storage.commits[0].length).toBeLessThanOrEqual(25);
  });

  it('refuses a snapshot too large for one transaction, and writes nothing', async () => {
    const huge = sampleIssue();
    huge.fields.description = doc(3000, 1000);
    const { jira, storage, deps } = setup(huge);
    await expect(sealIssue({ signature: validSignature() }, panelContext('ann'), deps)).resolves.toMatchObject({ ok: false, code: 'SNAPSHOT_TOO_LARGE' });
    expect(storage.sets).toEqual([]);
    expect(jira.propertyWrites).toEqual([]);
  });

  it('splits text by UTF-8 bytes without cutting a character in two', () => {
    const text = 'a'.repeat(5) + '😀'.repeat(10) + 'é'.repeat(10);
    const parts = splitUtf8(text, 7);
    expect(parts.join('')).toBe(text);
    for (const part of parts) expect(Buffer.byteLength(JSON.stringify(part), 'utf8')).toBeLessThanOrEqual(7);
    const quoted = splitUtf8('"'.repeat(10), 8);
    for (const part of quoted) expect(Buffer.byteLength(JSON.stringify(part), 'utf8')).toBeLessThanOrEqual(8);
    expect(quoted.join('')).toBe('"'.repeat(10));
    expect(parts.some(p => p.includes('�'))).toBe(false);
    expect(splitUtf8('', 10)).toEqual(['']);
    expect(MAX_PART_BYTES).toBe(120000);
  });
});

describe('B-17 concurrency control', () => {
  it('lets one of two concurrent seals win; the other gets CONFLICT with a reload message', async () => {
    const { jira, storage } = setup();
    const results = await Promise.all([
      sealIssue({ signature: validSignature() }, panelContext('ann'), { jira, storage }),
      sealIssue({ signature: validSignature() }, panelContext('ann'), { jira, storage })
    ]);
    const codes = results.map((r: any) => (r.ok ? 'OK' : r.code)).sort();
    expect(codes).toEqual(['CONFLICT', 'OK']);
    const conflict: any = results.find((r: any) => !r.ok);
    expect(conflict.message).toBe('Someone else sealed this issue a moment ago. Reload to see the new seal.');
    expect(model.statusRows(storage)).toHaveLength(1);
  });

  it('removes its claimed status row when the transaction fails, so later seals are not blocked', async () => {
    const { storage, deps } = setup();
    const commit = storage.commit.bind(storage);
    let failNext = true;
    storage.commit = async (items: any[]) => {
      if (failNext) {
        failNext = false;
        throw new Error('KVS transaction failed');
      }
      return commit(items);
    };
    await expect(sealIssue({ signature: validSignature() }, panelContext('ann'), deps)).rejects.toThrow('KVS transaction failed');
    expect(model.statusRows(storage)).toEqual([]);
    await expect(sealIssue({ signature: validSignature() }, panelContext('ann'), deps)).resolves.toMatchObject({ ok: true });
  });
});

describe('B-17 stored-size rule (performance fix)', () => {
  it('counts each character at its JSON-escaped size, including control characters and lone surrogates', () => {
    const tricky = 'a"\\\n\t\u0001é€😀\ud800z';
    for (let max = 8; max <= 14; max++) {
      const parts = splitUtf8(tricky, max);
      expect(parts.join('')).toBe(tricky);
      for (const part of parts) expect(Buffer.byteLength(JSON.stringify(part), 'utf8')).toBeLessThanOrEqual(max);
    }
  });

  it('splits a 400-paragraph snapshot in well under 50 ms', () => {
    const text = JSON.stringify({ text: 'Line x '.padEnd(200, 'x') }).repeat(1200);
    // CPU time of this worker, so parallel test workers do not slow the measure
    const started = process.cpuUsage();
    splitUtf8(text, MAX_PART_BYTES);
    const used = process.cpuUsage(started);
    expect((used.user + used.system) / 1000).toBeLessThan(50);
  });
});
