// LedgerSeal research probe M: resolver time, stored size and writes per call.
// Part A baseline copy (run against apps/ledgerseal at 423b9b2 in the main checkout). Copyright (c) 2026 Asymm Systems. @author Fahim Farook
// Part B reuses this file. Set LS_LABEL=after to write results-after.json.
import * as fs from 'fs';
import { performance } from 'perf_hooks';
import { JiraMock, CountingStore, smallIssue, bigDescriptionIssue, hundredCommentsIssue, combinedIssue, median, p95, APP_SRC } from './harness';

const mockJira: { current: JiraMock | null } = { current: null };
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asApp: () => ({ requestJira: (p: string, o?: any) => mockJira.current!.requestJira(p, o) }),
             asUser: () => ({ requestJira: (p: string, o?: any) => mockJira.current!.requestJira(p, o) }) },
  route: (s: any, ...v: any[]) => s.reduce((a: string, x: string, i: number) => a + x + (v[i] !== undefined ? v[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const idx = require(APP_SRC + '/index');

const KVS_LIMIT = 240 * 1024;
const RUNS = 25;
const results: any = { label: process.env.LS_LABEL || 'baseline', node: process.version, runs: RUNS, scenarios: {} };

const ctx = (acc = 'approver-1') => ({ accountId: acc, extension: { issue: { id: '10001', key: 'P-1' } } });
const sig = { meaning: 'Approved', reauthConfirmation: 'CONFIRM', reasonCode: 'APPROVAL' };

async function timeIt(fn: () => Promise<any>) {
  const t: number[] = [];
  for (let k = 0; k < RUNS; k++) { const a = performance.now(); await fn(); t.push(performance.now() - a); }
  return { medianMs: +median(t).toFixed(3), p95Ms: +p95(t).toFixed(3) };
}

beforeAll(() => { process.env.NODE_ENV = 'production'; });
afterAll(() => {
  process.env.NODE_ENV = 'test';
  fs.writeFileSync(__dirname + `/results-${results.label}.json`, JSON.stringify(results, null, 2));
});

const fixtures: Record<string, () => any> = {
  small: smallIssue, desc400: bigDescriptionIssue, comments100: hundredCommentsIssue, desc400_comments100: combinedIssue
};

describe('M: size and time per scenario', () => {
  for (const [name, make] of Object.entries(fixtures)) {
    it(name, async () => {
      const r: any = {};
      const jira = new JiraMock(make());
      mockJira.current = jira;
      r.issueJsonBytes = Buffer.byteLength(JSON.stringify(jira.issue), 'utf8');

      // Seal
      r.seal = await timeIt(async () => { const s = new CountingStore(); await idx.sealIssue({ signature: sig }, ctx(), s); });
      const store = new CountingStore();
      jira.writes = [];
      await idx.sealIssue({ signature: sig }, ctx(), store);
      r.activeCertBytes = store.bytes('cert:active:10001');
      r.propertyBytesOnSeal = jira.writes[0]?.bytes;
      r.sealFitsKvs = r.activeCertBytes < KVS_LIMIT;

      // Verify, unchanged issue
      const setsBefore = store.sets.length; jira.writes = [];
      const v = await idx.verifyIssue({}, ctx('viewer-2'), store);
      r.verifyValid = {
        status: v.status, kvsWrites: store.sets.length - setsBefore, propertyWrites: jira.writes.length,
        responseBytes: Buffer.byteLength(JSON.stringify(v), 'utf8')
      };
      r.verifyValid.time = await timeIt(async () => { await idx.verifyIssue({}, ctx('viewer-2'), store); });

      // Validator, unchanged issue
      r.validatorValid = await timeIt(async () => { await idx.validateTransition({ issue: { key: 'P-1' } }, {}, store); });
      r.validatorValidResult = (await idx.validateTransition({ issue: { key: 'P-1' } }, {}, store)).result;

      // Tamper, then 500 panel views
      jira.issue.fields.summary = 'Release v1 plus unreviewed scope';
      const tStore = store;
      const s0 = tStore.sets.length; jira.writes = [];
      let firstOver: number | null = null;
      const viewTimes: number[] = [];
      for (let k = 1; k <= 500; k++) {
        const a = performance.now();
        try { await idx.verifyIssue({}, ctx('viewer-2'), tStore); } catch (e) { r.verifyError = String(e); break; }
        viewTimes.push(performance.now() - a);
        if (firstOver === null && tStore.bytes('cert:active:10001') > KVS_LIMIT) firstOver = k;
      }
      const hist = (tStore.map.get('cert:history:10001') || []);
      r.after500TamperedViews = {
        activeCertBytes: tStore.bytes('cert:active:10001'),
        historyRows: hist.length,
        historyBytes: tStore.bytes('cert:history:10001'),
        tamperIncidents: (tStore.map.get('cert:active:10001')?.tamperHistory || []).length,
        kvsWrites: tStore.sets.length - s0,
        propertyWrites: jira.writes.length,
        firstViewOver240KiB: firstOver,
        verifyMedianMsFirst25: +median(viewTimes.slice(0, 25)).toFixed(3),
        verifyMedianMsLast25: +median(viewTimes.slice(-25)).toFixed(3)
      };
      results.scenarios[name] = r;
      expect(r.activeCertBytes).toBeGreaterThan(0);
    });
  }
});

describe('M2: views until a tampered small issue passes 240 KiB', () => {
  it('counts views', async () => {
    const jira = new JiraMock(smallIssue()); mockJira.current = jira;
    const store = new CountingStore();
    await idx.sealIssue({ signature: sig }, ctx(), store);
    jira.issue.fields.summary = 'changed';
    let n = 0;
    while (n < 5000 && store.bytes('cert:active:10001') <= KVS_LIMIT) { await idx.verifyIssue({}, ctx('v'), store); n++; }
    results.viewsUntil240KiBSmall = store.bytes('cert:active:10001') > KVS_LIMIT ? n : `>${n}`;
    expect(n).toBeGreaterThan(0);
  });
});
