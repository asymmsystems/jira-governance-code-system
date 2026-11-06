/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the weekly personal data report and erasure (BL-3, ADR-014), and the storage
 * minimisation behind it (F-M2).
 */

import { ERASED_ACCOUNT, IssueRow } from '../../src/contract/data/models';
import { DefaultKvsPersonalDataAccessor } from '../../src/accessor/default-kvs-personal-data-accessor';
import { CHUNK_BYTES_MAX, SnapshotRepository } from '../../src/accessor/default-kvs-snapshot-accessor';
import { DefaultKvsExceptionEventAccessor } from '../../src/accessor/default-kvs-exception-event-accessor';
import { DefaultKvsReworkNoteAccessor } from '../../src/accessor/default-kvs-rework-note-accessor';
import { DefaultPersonalDataManager } from '../../src/manager/default-personal-data-manager';
import { DefaultExceptionPolicyEngine } from '../../src/engine/default-exception-policy-engine';
import { DefaultSnapshotEngine } from '../../src/engine/default-snapshot-engine';
import { DefaultMetricsEngine } from '../../src/engine/default-metrics-engine';
import { MemoryStorage } from '../storage/memory-storage';
import { gates, makeFacts, FOUND_V } from '../domain/fixtures';

const NOW = '2026-11-06T10:00:00.000Z';
const metrics = new DefaultMetricsEngine();
const snapshotEngine = new DefaultSnapshotEngine();

/** A site with every kind of stored account id, including a snapshot written before ADR-014. */
async function site(): Promise<MemoryStorage> {
  const s = new MemoryStorage();
  await s.set('fr:ex:101:code:2026-11-01T00:00:00.000Z:a', { schemaVersion: 3, issueId: '101', issueKey: 'PAY-1', gate: 'code', status: 'REQUESTED', at: '2026-11-01T00:00:00.000Z', byAccountId: 'dev-1', asRole: 'REQUESTER', reason: 'Configuration change only' });
  await s.set('fr:ex:101:code:2026-11-02T00:00:00.000Z:b', { schemaVersion: 3, issueId: '101', issueKey: 'PAY-1', gate: 'code', status: 'APPROVED', at: '2026-11-02T00:00:00.000Z', byAccountId: 'admin-1', asRole: 'APPROVER', reason: 'ok' });
  await s.set('fr:note:102:2026-11-03T00:00:00.000Z:c', { schemaVersion: 1, issueId: '102', issueKey: 'PAY-2', reason: 'Requirement changed', recordedBy: 'dev-1', recordedAt: '2026-11-03T00:00:00.000Z' });
  await s.set('fr:issue:103:exception', { schemaVersion: 2, issueId: '103', issueKey: 'PAY-3', rework: { reason: 'old', recordedBy: 'dev-2', recordedAt: '2026-10-01T00:00:00.000Z' } });
  await s.set('fr:issue:104:exception', { issueId: '104', issueKey: 'PAY-4', type: 'CODE', reason: 'v1', recordedBy: 'dev-3', recordedAt: '2026-09-01T00:00:00.000Z' });
  await s.set('fr:issue:105:signals', { x: 1 });
  await s.set('fr:projects', ['PAY', 'OLD']);
  await s.set('fr:p:PAY:meta', { schemaVersion: 2, projectKey: 'PAY', snapshotId: 's1', generatedAt: '2026-11-05T00:00:00.000Z', generatedBy: 'scheduled', chunkCount: 1 });
  await s.set('fr:p:PAY:chunk:0', { snapshotId: 's1', rows: [{ issueId: '101', assigneeAccountId: 'dev-1' }, { issueId: '106', assigneeAccountId: 'dev-4' }] });
  await s.set('fr:p:PAY:accounts', { generatedAt: '2026-11-05T00:00:00.000Z', accountIds: ['dev-1', 'dev-4'] });
  // Written before ADR-014: no index, a name, an exception and a note in the row, the viewer in the meta.
  await s.set('fr:p:OLD:meta', { schemaVersion: 2, projectKey: 'OLD', snapshotId: 's0', generatedAt: '2026-10-20T00:00:00.000Z', generatedBy: 'viewer-1', chunkCount: 2 });
  await s.set('fr:p:OLD:chunk:0', { snapshotId: 's0', rows: [{ issueId: '201', assigneeName: 'Ana Silva', assigneeAccountId: 'dev-5', codeException: { requestedBy: 'dev-6', decidedBy: 'admin-1' }, reworkNote: { recordedBy: 'dev-7' } }] });
  return s;
}

describe('DefaultKvsPersonalDataAccessor', () => {
  it('finds every stored account id with the date of its latest record and the issues that name it', async () => {
    const a = new DefaultKvsPersonalDataAccessor(await site());
    expect(a.serviceType).toBe('accessor');
    const accounts = await a.accounts(NOW);
    expect(accounts.map(x => x.accountId)).toEqual(['admin-1', 'dev-1', 'dev-2', 'dev-3', 'dev-4', 'dev-5', 'dev-6', 'dev-7']);
    expect(accounts.find(x => x.accountId === 'dev-1')).toEqual({ accountId: 'dev-1', updatedAt: '2026-11-05T00:00:00.000Z', issueIds: ['101', '102'] });
    expect(accounts.find(x => x.accountId === 'admin-1')?.updatedAt).toBe('2026-11-02T00:00:00.000Z');
    expect(accounts.find(x => x.accountId === 'dev-3')).toEqual({ accountId: 'dev-3', updatedAt: '2026-09-01T00:00:00.000Z', issueIds: ['104'] });
    expect(accounts.find(x => x.accountId === 'dev-7')?.updatedAt).toBe('2026-10-20T00:00:00.000Z');
  });

  it('skips erased and unknown ids, and dates a record without a date with now', async () => {
    const s = new MemoryStorage();
    await s.set('fr:ex:1:code:t:a', { issueId: '1', byAccountId: ERASED_ACCOUNT, at: 't' });
    await s.set('fr:note:1:t:b', { issueId: '1', recordedBy: 'unknown-user' });
    await s.set('fr:note:1:t:c', { issueId: '1', recordedBy: 'dev-1' });
    await s.set('fr:ex:1:code:t:d', null);
    expect(await new DefaultKvsPersonalDataAccessor(s).accounts(NOW)).toEqual([{ accountId: 'dev-1', updatedAt: NOW, issueIds: ['1'] }]);
  });

  it('erases closed accounts everywhere, keeps the steps and the work text, and drops the fields ADR-014 no longer stores', async () => {
    const s = await site();
    const a = new DefaultKvsPersonalDataAccessor(s);
    await a.erase(['dev-1', 'dev-2', 'dev-3', 'dev-5']);
    expect(s.store.get('fr:ex:101:code:2026-11-01T00:00:00.000Z:a')).toMatchObject({ byAccountId: ERASED_ACCOUNT, reason: 'Configuration change only', status: 'REQUESTED' });
    expect(s.store.get('fr:ex:101:code:2026-11-02T00:00:00.000Z:b').byAccountId).toBe('admin-1');
    expect(s.store.get('fr:note:102:2026-11-03T00:00:00.000Z:c')).toMatchObject({ recordedBy: ERASED_ACCOUNT, reason: 'Requirement changed' });
    expect(s.store.get('fr:issue:103:exception').rework).toMatchObject({ recordedBy: ERASED_ACCOUNT, reason: 'old' });
    expect(s.store.get('fr:issue:104:exception').recordedBy).toBe(ERASED_ACCOUNT);
    expect(s.store.get('fr:p:PAY:chunk:0').rows).toEqual([{ issueId: '101' }, { issueId: '106', assigneeAccountId: 'dev-4' }]);
    expect(s.store.get('fr:p:PAY:accounts').accountIds).toEqual(['dev-4']);
    expect(s.store.get('fr:p:OLD:chunk:0').rows).toEqual([{ issueId: '201' }]);
    expect(JSON.stringify(Array.from(s.store.values()))).not.toMatch(/"dev-1"|"dev-2"|"dev-3"|"dev-5"|Ana Silva/);
    const after = (await a.accounts(NOW)).map(x => x.accountId);
    expect(after).toEqual(['admin-1', 'dev-4']);
  });

  it('changes nothing for an empty list or a project that does not name the account', async () => {
    const s = await site();
    const a = new DefaultKvsPersonalDataAccessor(s);
    s.ops = [];
    await a.erase([]);
    expect(s.count('set')).toBe(0);
    await a.erase(['nobody']);
    expect(s.ops.filter(o => o.op === 'set').map(o => o.key)).toEqual(['fr:p:OLD:chunk:0']);
  });

  it('reads and erases odd records without failing', async () => {
    const s = new MemoryStorage();
    await s.set('fr:ex:1:code:t:a', null);
    await s.set('fr:note:1:t:b', null);
    await s.set('fr:issue:2:exception', null);
    await s.set('fr:issue:3:exception', { schemaVersion: 2, issueId: '3', code: { reason: 'c', recordedBy: 'dev-1' } });
    await s.set('fr:projects', ['A', 'B']);
    await s.set('fr:p:A:accounts', { generatedAt: 't' });
    await s.set('fr:p:B:meta', { schemaVersion: 2, projectKey: 'B', snapshotId: 's', generatedAt: 't', generatedBy: 'user' });
    const a = new DefaultKvsPersonalDataAccessor(s);
    expect((await a.accounts(NOW)).map(x => x.accountId)).toEqual(['dev-1']);
    await a.erase(['dev-1']);
    expect(s.store.get('fr:issue:3:exception').code.recordedBy).toBe(ERASED_ACCOUNT);
    expect(s.store.get('fr:issue:2:exception')).toBeNull();
    const missingChunk = new MemoryStorage();
    await missingChunk.set('fr:projects', ['C']);
    await missingChunk.set('fr:p:C:meta', { schemaVersion: 2, projectKey: 'C', snapshotId: 's', generatedAt: 't', generatedBy: 'user', chunkCount: 2 });
    await new DefaultKvsPersonalDataAccessor(missingChunk).erase(['x']);
    expect(missingChunk.count('set', /chunk/)).toBe(0);
  });

  it('rewrites a snapshot meta that still names a viewer', async () => {
    const s = await site();
    const a = new DefaultKvsPersonalDataAccessor(s);
    expect(await a.minimiseMeta()).toBe(1);
    expect(s.store.get('fr:p:OLD:meta').generatedBy).toBe('user');
    expect(s.store.get('fr:p:PAY:meta').generatedBy).toBe('scheduled');
    expect(await a.minimiseMeta()).toBe(0);
    expect(await new DefaultKvsPersonalDataAccessor(new MemoryStorage()).minimiseMeta()).toBe(0);
  });
});

describe('DefaultPersonalDataManager', () => {
  function setup(storage: MemoryStorage, statuses: Record<string, string>, put = 200) {
    const privacy = { serviceType: 'accessor' as const, report: jest.fn(async (accounts: Array<{ accountId: string }>) => accounts.map(x => ({ accountId: x.accountId, status: statuses[x.accountId] || 'updated' }))) };
    const appJira: any = { putExceptionProperty: jest.fn().mockResolvedValue(put) };
    const manager = new DefaultPersonalDataManager({
      data: new DefaultKvsPersonalDataAccessor(storage), privacy, appJira,
      events: new DefaultKvsExceptionEventAccessor(storage), notes: new DefaultKvsReworkNoteAccessor(storage),
      lifecycle: new DefaultExceptionPolicyEngine(), now: () => new Date(NOW)
    });
    return { manager, privacy, appJira };
  }

  it('reports every account id with its date and erases the closed ones, then writes the projection again as the app', async () => {
    const s = await site();
    const { manager, privacy, appJira } = setup(s, { 'dev-1': 'closed' });
    expect(manager.serviceType).toBe('manager');
    expect(await manager.run()).toEqual({ reported: 8, closed: 1, propertiesRewritten: 2 });
    expect(privacy.report.mock.calls[0][0]).toContainEqual({ accountId: 'dev-1', updatedAt: '2026-11-05T00:00:00.000Z' });
    const [issueId, property] = appJira.putExceptionProperty.mock.calls[0];
    expect(issueId).toBe('101');
    expect(property.code).toMatchObject({ status: 'APPROVED', requestedBy: ERASED_ACCOUNT, decidedBy: 'admin-1' });
    expect(appJira.putExceptionProperty.mock.calls[1][1].rework).toMatchObject({ recordedBy: ERASED_ACCOUNT, reason: 'Requirement changed' });
    expect(appJira.putExceptionProperty.mock.calls[1][1].reworkNoteCount).toBe(1);
  });

  it('reports nothing on an empty site and changes nothing when no account is closed', async () => {
    expect(await setup(new MemoryStorage(), {}).manager.run()).toEqual({ reported: 0, closed: 0, propertiesRewritten: 0 });
    const s = await site();
    const before = JSON.stringify(Array.from(s.store.entries()).filter(([k]) => !k.endsWith(':meta')));
    expect(await setup(s, {}).manager.run()).toEqual({ reported: 8, closed: 0, propertiesRewritten: 0 });
    expect(JSON.stringify(Array.from(s.store.entries()).filter(([k]) => !k.endsWith(':meta')))).toBe(before);
  });

  it('counts a failed or thrown property write, and skips an issue with no record', async () => {
    const s = await site();
    expect((await setup(s, { 'dev-1': 'closed' }, 403).manager.run()).propertiesRewritten).toBe(0);
    const t = await site();
    const thrown = setup(t, { 'dev-4': 'closed' });
    expect((await thrown.manager.run())).toEqual({ reported: 8, closed: 1, propertiesRewritten: 0 });
    const u = await site();
    const failing = setup(u, { 'dev-1': 'closed' });
    failing.appJira.putExceptionProperty.mockRejectedValue(new Error('net'));
    expect((await failing.manager.run()).propertiesRewritten).toBe(0);
  });

  it('writes the latest note with its text, for an issue that has notes only', async () => {
    const s = new MemoryStorage();
    await s.set('fr:note:8:2026-11-01T00:00:00.000Z:a', { schemaVersion: 1, issueId: '8', issueKey: 'PAY-8', reason: 'Scope changed', notes: 'CHG-9', recordedBy: 'dev-8', recordedAt: '2026-11-01T00:00:00.000Z' });
    const { manager, appJira } = setup(s, { 'dev-8': 'closed' });
    expect((await manager.run()).propertiesRewritten).toBe(1);
    expect(appJira.putExceptionProperty.mock.calls[0][1]).toEqual({ schemaVersion: 3, issueId: '8', issueKey: 'PAY-8', code: undefined, rework: { reason: 'Scope changed', notes: 'CHG-9', recordedBy: ERASED_ACCOUNT, recordedAt: '2026-11-01T00:00:00.000Z' }, reworkNoteCount: 1 });
  });

  it('uses the clock when no clock is given', async () => {
    const s = new MemoryStorage();
    await s.set('fr:note:9:t:a', { issueId: '9', recordedBy: 'dev-9' });
    const privacy = { serviceType: 'accessor' as const, report: jest.fn().mockResolvedValue([]) };
    const m = new DefaultPersonalDataManager({ data: new DefaultKvsPersonalDataAccessor(s), privacy, appJira: {} as any, events: new DefaultKvsExceptionEventAccessor(s), notes: new DefaultKvsReworkNoteAccessor(s), lifecycle: new DefaultExceptionPolicyEngine() });
    expect((await m.run()).reported).toBe(1);
    expect(Date.parse(privacy.report.mock.calls[0][0][0].updatedAt)).not.toBeNaN();
  });
});

describe('F-M2, ADR-014: what a snapshot row stores', () => {
  it('stores no exception, no note and no name, and cuts free text', () => {
    const long = 'x'.repeat(500);
    const facts = makeFacts({
      sprintNames: Array.from({ length: 8 }, (_, i) => `${'s'.repeat(80)}${i}`),
      codeException: { status: 'APPROVED', issueKey: 'PAY-1', requestedBy: 'dev-1', requestedAt: 't', reason: long, notes: long },
      reworkNotes: [{ reason: long, notes: long, recordedBy: 'dev-2', recordedAt: 't' }]
    });
    const row = metrics.buildRow(facts, gates({ ...FOUND_V, args: { title: long } }, FOUND_V, FOUND_V, FOUND_V));
    const stored = snapshotEngine.storedRow(row);
    expect(stored.codeException).toBeUndefined();
    expect(stored.reworkNote).toBeUndefined();
    expect(stored.reworkNoteCount).toBeUndefined();
    expect(String(stored.gates.intent.args?.title)).toHaveLength(120);
    expect(stored.sprintNames).toHaveLength(5);
    expect(stored.sprintNames.every(n => n.length === 60)).toBe(true);
    expect(JSON.stringify(stored)).not.toMatch(/dev-1|dev-2/);
    expect(stored.gates.process).toEqual(FOUND_V);
  });

  it('splits rows so that no chunk passes the byte limit, and keeps at most 100 rows per chunk', () => {
    const heavy = (i: number) => ({ issueId: String(i), summary: 'y'.repeat(4000) } as unknown as IssueRow);
    const chunks = SnapshotRepository.chunksOf(Array.from({ length: 150 }, (_, i) => heavy(i)));
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) expect(Buffer.byteLength(JSON.stringify({ snapshotId: 's', rows: c }))).toBeLessThan(CHUNK_BYTES_MAX + 100);
    expect(chunks.flat()).toHaveLength(150);
    expect(SnapshotRepository.chunksOf(Array.from({ length: 250 }, (_, i) => ({ issueId: String(i) } as unknown as IssueRow))).map(c => c.length)).toEqual([100, 100, 50]);
    expect(SnapshotRepository.chunksOf([])).toEqual([]);
  });
});

describe('DefaultForgePrivacyAccessor', () => {
  it('sends the accounts to the Forge personal data reporting API', async () => {
    jest.resetModules();
    const reportPersonalData = jest.fn().mockResolvedValue([{ accountId: 'a', status: 'closed' }]);
    jest.doMock('@forge/api', () => ({ __esModule: true, privacy: { reportPersonalData } }));
    const { DefaultForgePrivacyAccessor } = require('../../src/accessor/default-forge-privacy-accessor');
    const p = new DefaultForgePrivacyAccessor();
    expect(p.serviceType).toBe('accessor');
    expect(await p.report([{ accountId: 'a', updatedAt: 't' }])).toEqual([{ accountId: 'a', status: 'closed' }]);
    expect(reportPersonalData).toHaveBeenCalledWith([{ accountId: 'a', updatedAt: 't' }]);
  });
});
