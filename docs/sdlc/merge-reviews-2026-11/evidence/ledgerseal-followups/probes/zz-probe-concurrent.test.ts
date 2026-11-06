// Reviewer probe P1 (not committed). Copy into apps/ledgerseal/test/ and run with
// `npx jest test/zz-probe-concurrent.test.ts --coverage=false`.
// A weekly conversion of an old record pauses just before its commit; a revoke on the same issue converts the
// record itself and revokes; then the weekly conversion commits.
import { convertRecord } from '../src/service/conversion';
import { getSealEvidence, revokeSeal, sealIssue, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';
import { writeOldRecord } from './support/old-record';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: (s: any, ...v: any[]) => s.reduce((a: string, x: string, i: number) => a + x + (v[i] ?? ''), ''), privacy: {} }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));

it('P1 weekly conversion paused before its commit while a revoke converts and revokes', async () => {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann', 'bob', 'carol']);
  const storage = new MemoryStore();
  await writeOldRecord(storage, sampleIssue());
  const realCommit = storage.commit.bind(storage);
  let release!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>(r => (release = r));
  const atCommit = new Promise<void>(r => (reached = r));
  let first = true;
  storage.commit = async (items: any[]) => {
    if (first && items.some(i => i.key === 'ls3:we:10001')) {
      first = false;
      reached();
      await gate;
    }
    return realCommit(items);
  };
  jira.currentUser = null;
  const weekly = convertRecord({ jira, storage }, '10001');
  await atCommit;
  jira.currentUser = 'bob';
  const revoked = await revokeSeal({ reason: 'probe revoke' }, panelContext('bob'), { jira, storage });
  console.log('revoke', JSON.stringify(revoked));
  release();
  console.log('weekly', await weekly);
  const we: any = await model.workEffort(storage);
  console.log('we head', we.statusHead.seq, we.currentStatusId, 'rows', [...storage.map.keys()].filter(k => k.startsWith('ls3:wes:10001')).join(','));
  const view: any = await verifyIssue({}, panelContext('bob'), { jira, storage });
  console.log('view', view.status, view.seal?.revocation?.reason);
  const ev: any = await getSealEvidence({}, panelContext('bob'), { jira, storage });
  console.log('evidence', JSON.stringify(ev).slice(0, 200));
  jira.currentUser = 'carol';
  const again = await sealIssue({ signature: validSignature({ reason: 'again' }) }, panelContext('carol'), { jira, storage });
  console.log('reseal', JSON.stringify(again).slice(0, 200));
});
