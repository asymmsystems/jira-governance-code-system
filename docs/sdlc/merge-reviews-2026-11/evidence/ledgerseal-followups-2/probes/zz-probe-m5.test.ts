/** Reviewer probes for M-5 (not committed). */
import { convertRecord } from '../src/service/conversion';
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

function pauseOn(storage: any, method: 'set' | 'commit', match: (a: any) => boolean) {
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
  return { status: view.status, history: ev.history?.map((r: any) => r.transitionName), we: (await storage.get('ls3:we:10001')).statusHead.seq };
}

describe('reviewer M-5 probes', () => {
  it('Q1 stalled run (past lease) paused before its re-check (history rewrite); a revoke goes in; stalled run must not roll back', async () => {
    const { storage, as } = setup();
    await writeOldRecord(storage, sampleIssue());
    const p = pauseOn(storage, 'set', a => a[0] === 'ls3:wes:10001:000001');
    const stalled = convertRecord(as(null), '10001', '2000-01-01T00:00:00.000Z');
    await p.at;
    await expect(revokeSeal({ reason: 'r' }, panelContext('bob'), as('bob'))).resolves.toMatchObject({ ok: true });
    p.release();
    const res = await stalled;
    const s = await state(storage, as);
    console.log('Q1', res, JSON.stringify(s));
    expect(s.status).toBe('SEAL_REVOKED');
    expect(s.history).toEqual(['SEAL', 'REDACT', 'REVOKE']);
  });

  it('Q2 run stopped before commit; within the lease a seal answers CONFLICT; after the lease it resumes and works', async () => {
    const { storage, as } = setup();
    await writeOldRecord(storage, sampleIssue());
    const realCommit = storage.commit.bind(storage);
    storage.commit = async (items: any[]) => { if (items.some(i => i.key === 'ls3:we:10001')) throw new Error('timed out'); return realCommit(items); };
    await expect(convertRecord(as(null), '10001')).rejects.toThrow();
    storage.commit = realCommit;
    await expect(sealIssue({ signature: validSignature({ reason: 'x' }) }, panelContext('carol'), as('carol'))).resolves.toMatchObject({ ok: false, code: 'CONFLICT' });
    const j = await storage.get('ls3:convert:10001');
    await storage.set('ls3:convert:10001', { ...j, startedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString() });
    await expect(sealIssue({ signature: validSignature({ reason: 'x' }) }, panelContext('carol'), as('carol'))).resolves.toMatchObject({ ok: true });
    const s = await state(storage, as);
    console.log('Q2', JSON.stringify(s));
    expect(s.status).toBe('SEAL_VALID');
    expect(storage.map.has('ls3:convert:10001')).toBe(false);
  });

  it('Q3 lease not renewed on resume: two resumers after the lease; weekly paused between re-check and commit; seal goes in', async () => {
    const { storage, as } = setup();
    await writeOldRecord(storage, sampleIssue());
    const realCommit = storage.commit.bind(storage);
    storage.commit = async (items: any[]) => { if (items.some(i => i.key === 'ls3:we:10001')) throw new Error('timed out'); return realCommit(items); };
    await expect(convertRecord(as(null), '10001', '2000-01-01T00:00:00.000Z')).rejects.toThrow();
    storage.commit = realCommit;
    const p = pauseOn(storage, 'commit', a => a[0].some((i: any) => i.key === 'ls3:we:10001'));
    const weekly = convertRecord(as(null), '10001');
    await p.at;
    const seal = await sealIssue({ signature: validSignature({ reason: 'x' }) }, panelContext('carol'), as('carol'));
    p.release();
    const res = await weekly;
    const s = await state(storage, as);
    console.log('Q3', JSON.stringify(seal), res, JSON.stringify(s));
  });

  it('Q4 resumer 1 (seal) paused in its history rewrite; resumer 2 (weekly) after the lease also runs (no BUSY)', async () => {
    const { storage, as } = setup();
    await writeOldRecord(storage, sampleIssue());
    const realCommit = storage.commit.bind(storage);
    storage.commit = async (items: any[]) => { if (items.some(i => i.key === 'ls3:we:10001')) throw new Error('timed out'); return realCommit(items); };
    await expect(convertRecord(as(null), '10001', '2000-01-01T00:00:00.000Z')).rejects.toThrow();
    storage.commit = realCommit;
    const p = pauseOn(storage, 'set', a => a[0] === 'ls3:wes:10001:000001');
    const first = convertRecord(as(null), '10001');
    await p.at;
    const second = await convertRecord(as(null), '10001');
    p.release();
    console.log('Q4', second, await first);
  });
});
