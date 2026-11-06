/** Reviewer probes for M-7 (third follow-ups review, not committed). */
import { convertRecord, takeLease } from '../src/service/conversion';
import { getSealEvidence, revokeSeal, sealIssue, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature } from './support/fakes';
import { writeOldRecord } from './support/old-record';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: (s: any, ...v: any[]) => s.reduce((a: string, x: string, i: number) => a + x + (v[i] ?? ''), ''), privacy: {} }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));

function setup() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann', 'bob', 'carol']);
  const storage = new MemoryStore();
  const as = (user: string | null) => { jira.currentUser = user; return { jira, storage }; };
  return { jira, storage, as };
}

function pauseOn(storage: any, method: 'set' | 'commit' | 'createIfAbsent' | 'get', match: (a: any) => boolean) {
  let release!: () => void; let reached!: () => void;
  const gate = new Promise<void>(r => (release = r));
  const at = new Promise<void>(r => (reached = r));
  const real = storage[method].bind(storage);
  let first = true;
  storage[method] = async (...args: any[]) => {
    if (first && match(args)) { first = false; reached(); await gate; }
    return real(...args);
  };
  return { at, release };
}

async function state(storage: any, as: any) {
  const view: any = await verifyIssue({}, panelContext('bob'), as('bob'));
  const ev: any = await getSealEvidence({}, panelContext('bob'), as('bob'));
  const we = await storage.get('ls3:we:10001');
  return { status: view.status, history: ev.history?.map((r: any) => r.transitionName), seq: we.statusHead.seq, parties: we.attributes.parties };
}

describe('reviewer M-7 probes', () => {
  it('R1 a run that read the record before the lease, paused at its claim; a revoke converts and goes in; the late run must not write the old record back', async () => {
    const { storage, as } = setup();
    await writeOldRecord(storage, sampleIssue());
    const p = pauseOn(storage, 'createIfAbsent', a => a[0] === 'ls3:convert-lease:10001');
    const late = convertRecord(as(null), '10001');
    await p.at;
    await expect(revokeSeal({ reason: 'r' }, panelContext('bob'), as('bob'))).resolves.toMatchObject({ ok: true });
    p.release();
    const res = await late;
    const s = await state(storage, as);
    console.log('R1', res, JSON.stringify(s));
    console.log('R1 keys', [...(storage as any).map.keys()].filter((k: string) => k.includes('10001')).sort().join(' '));
    console.log('R1 weekly after', await convertRecord(as(null), '10001'));
    const reseal = await sealIssue({ signature: validSignature({ reason: 'x' }) }, panelContext('carol'), as('carol'));
    console.log('R1 reseal after', JSON.stringify(reseal));
    const reseal2 = await sealIssue({ signature: validSignature({ reason: 'x' }) }, panelContext('carol'), as('carol'));
    console.log('R1 reseal 2', JSON.stringify(reseal2), JSON.stringify(await state(storage, as)));
    expect(s.status).toBe('SEAL_REVOKED');
    expect(s.history).toEqual(['SEAL', 'REDACT', 'REVOKE']);
  });

  it('R2 same, with a reseal by carol after a revoke: the late run must not undo the reseal', async () => {
    const { storage, as } = setup();
    await writeOldRecord(storage, sampleIssue());
    const p = pauseOn(storage, 'createIfAbsent', a => a[0] === 'ls3:convert-lease:10001');
    const late = convertRecord(as(null), '10001');
    await p.at;
    await expect(revokeSeal({ reason: 'r' }, panelContext('bob'), as('bob'))).resolves.toMatchObject({ ok: true });
    await expect(sealIssue({ signature: validSignature({ reason: 'x' }) }, panelContext('carol'), as('carol'))).resolves.toMatchObject({ ok: true });
    p.release();
    const res = await late;
    const s = await state(storage, as);
    console.log('R2', res, JSON.stringify(s));
    expect(s.status).toBe('SEAL_VALID');
  });

  it('R3 takeover: two takers of an expired lease, interleaved set/get; how many think they hold it', async () => {
    const { storage } = setup();
    await storage.set('ls3:convert-lease:10001', { holder: 'old', takenAt: '2000-01-01T00:00:00.000Z' });
    const now = new Date().toISOString();
    // A: create fails, read, set, read-back, all before B sets
    const a = await takeLease(storage as any, '10001', now);
    const b = await takeLease(storage as any, '10001', now);
    console.log('R3 sequential', a, b);
    expect(b).toBeNull();
  });
});
