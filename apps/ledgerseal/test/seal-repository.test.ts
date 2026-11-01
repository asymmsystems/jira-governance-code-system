import { SealRepository } from '../src/storage/seal-repository';
import { buildEntry } from '../src/domain/history';
import { withRecordHash, hasValidRecordHash } from '../src/domain/seal-record';
import { SealRecord } from '../src/domain/models';
import { MemoryStore } from './support/fakes';

function record(overrides: Partial<SealRecord> = {}): SealRecord {
  return withRecordHash({
    schemaVersion: 2,
    issueId: '10001',
    issueKey: 'AUDIT-1',
    certificateId: 'cert-1',
    state: 'ACTIVE',
    sealedAt: '2026-11-01T10:00:00.000Z',
    sealedBy: { accountId: 'acc-1', displayName: 'Lead Auditor' },
    meaning: 'Initial approval',
    declaration: { version: '1', text: 'I approve.' },
    reason: null,
    statusAtSeal: 'Done',
    snapshotHash: 'a'.repeat(64),
    canonicalizerVersion: '1.0.0',
    coveredFields: [{ id: 'summary', name: 'Summary' }],
    excludedFields: [],
    snapshotChunks: 2,
    everCompromised: false,
    incidentCount: 0,
    lastIncidentHash: null,
    head: { seq: 1, entryHash: 'b'.repeat(64) },
    revocation: null,
    ...overrides
  });
}

describe('Seal Repository (v2)', () => {
  let storage: MemoryStore;
  let repo: SealRepository;

  beforeEach(() => {
    storage = new MemoryStore();
    repo = new SealRepository(storage);
  });

  it('saves the record and the snapshot parts in one transaction and reads the snapshot back', async () => {
    const snapshot = { issueId: '10001', fields: [{ id: 'summary', value: 'First build' }] };
    const text = JSON.stringify(snapshot);
    await repo.saveSeal(record(), [text.slice(0, 10), text.slice(10)]);
    expect(storage.commits).toEqual([['ls2:snap:cert-1:0', 'ls2:snap:cert-1:1', 'ls2:seal:10001']]);
    const saved = await repo.getSeal('10001');
    expect(saved?.certificateId).toBe('cert-1');
    await expect(repo.getSnapshot(saved!)).resolves.toEqual(snapshot);
  });

  it('returns null for a missing seal, a missing snapshot part or an unreadable snapshot', async () => {
    await expect(repo.getSeal('nope')).resolves.toBeNull();
    await expect(repo.getLegacyCertificate('nope')).resolves.toBeNull();
    await expect(repo.getSnapshot(record())).resolves.toBeNull();
    await storage.set('ls2:snap:cert-1:0', '{"broken');
    await storage.set('ls2:snap:cert-1:1', '');
    await expect(repo.getSnapshot(record())).resolves.toBeNull();
  });

  it('creates each history entry once', async () => {
    const entry = buildEntry(null, { type: 'SEALED', at: 't', actorAccountId: 'a', certificateId: 'c', data: {} });
    await expect(repo.appendEntry('10001', entry)).resolves.toBe(true);
    await expect(repo.appendEntry('10001', { ...entry, data: { forged: true } })).resolves.toBe(false);
    await expect(repo.getEntries('10001', 1, 1)).resolves.toEqual([entry]);
  });

  it('reads a v1 certificate without writing', async () => {
    await storage.set('cert:active:10001', { certificateId: 'v1' });
    storage.sets = [];
    await expect(repo.getLegacyCertificate('10001')).resolves.toEqual({ certificateId: 'v1' });
    expect(storage.sets).toEqual([]);
  });

  it('detects a record whose fields no longer match its hash', () => {
    const r = record();
    expect(hasValidRecordHash(r)).toBe(true);
    expect(hasValidRecordHash({ ...r, sealedBy: { accountId: 'x', displayName: 'Someone Else' } })).toBe(false);
    expect(hasValidRecordHash({ ...r, recordHash: undefined as any })).toBe(false);
  });
});
