// LedgerSeal research probe M: resolver time, stored size and writes per call (Part B, after the build).
// Copyright (c) 2026 Asymm Systems. @author Fahim Farook
// The Part A version is in baseline-v1/. Same scenarios and measures; the app API changed in B-01 to B-21.
import * as fs from 'fs';
import { performance } from 'perf_hooks';
import { JiraMock, CountingStore, smallIssue, bigDescriptionIssue, hundredCommentsIssue, combinedIssue, median, p95, APP_SRC } from './harness';

jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {},
  route: (s: any, ...v: any[]) => s.reduce((a: string, x: string, i: number) => a + x + (i < v.length ? String(v[i]) : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const idx = require(APP_SRC + '/index');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createJiraClient } = require(APP_SRC + '/jira/jira-client');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DECLARATION } = require(APP_SRC + '/domain/declaration');

const KVS_LIMIT = 240 * 1024;
const RUNS = 25;
const results: any = { label: process.env.LS_LABEL || 'after', node: process.version, runs: RUNS, scenarios: {} };
const ctx = (acc: string) => ({ accountId: acc, extension: { issue: { id: '10001', key: 'P-1' } } });
const sig = { meaning: 'APPROVAL', declarationVersion: DECLARATION.version, declarationText: DECLARATION.text };

async function timeIt(fn: () => Promise<any>) {
  const t: number[] = [];
  for (let k = 0; k < RUNS; k++) { const a = performance.now(); await fn(); t.push(performance.now() - a); }
  return { medianMs: +median(t).toFixed(3), p95Ms: +p95(t).toFixed(3) };
}

afterAll(() => fs.writeFileSync(__dirname + `/results-${results.label}.json`, JSON.stringify(results, null, 2)));

const fixtures: Record<string, () => any> = { small: smallIssue, desc400: bigDescriptionIssue, comments100: hundredCommentsIssue, desc400_comments100: combinedIssue };

describe('M: size and time per scenario', () => {
  for (const [name, make] of Object.entries(fixtures)) {
    it(name, async () => {
      const r: any = {};
      const jira = new JiraMock(make());
      jira.approvers = new Set(['approver-1']);
      r.issueJsonBytes = Buffer.byteLength(JSON.stringify(jira.issue), 'utf8');

      r.seal = await timeIt(async () => { await idx.sealIssue({ signature: sig }, ctx('approver-1'), jira.deps(createJiraClient, new CountingStore(), 'approver-1')); });
      const store = new CountingStore();
      jira.writes = [];
      const sealed = await idx.sealIssue({ signature: sig }, ctx('approver-1'), jira.deps(createJiraClient, store, 'approver-1'));
      r.sealOk = sealed.ok === true;
      r.largestKvsValueAfterSeal = store.largest();
      r.workEffortBytes = store.bytes('ls3:we:10001');
      r.snapshotParts = store.map.get('ls3:we:10001').attributes.snapshotParts;
      r.sealTransactionOps = store.maxCommitOps;
      r.propertyBytesOnSeal = jira.writes[0]?.bytes;

      const viewer = jira.deps(createJiraClient, store, 'viewer-2');
      const setsBefore = store.sets.length; jira.writes = [];
      const v = await idx.verifyIssue({}, ctx('viewer-2'), viewer);
      r.verifyValid = { status: v.status, kvsWrites: store.sets.length - setsBefore, propertyWrites: jira.writes.length, responseBytes: Buffer.byteLength(JSON.stringify(v), 'utf8') };
      r.verifyValid.time = await timeIt(async () => { await idx.verifyIssue({}, ctx('viewer-2'), viewer); });

      const app = jira.deps(createJiraClient, store, null);
      r.validatorValid = await timeIt(async () => { await idx.validateTransition({ issue: { key: 'P-1' } }, {}, app); });
      r.validatorValidResult = (await idx.validateTransition({ issue: { key: 'P-1' } }, {}, app)).result;

      jira.edit('mallory', 'summary', 'Release v1 plus unreviewed scope');
      const weBefore = store.bytes('ls3:we:10001');
      const s0 = store.sets.length; jira.writes = [];
      let firstOver: number | null = null;
      const viewTimes: number[] = [];
      let lastResponse = 0;
      for (let k = 1; k <= 500; k++) {
        const a = performance.now();
        const res = await idx.verifyIssue({}, ctx('viewer-2'), viewer);
        viewTimes.push(performance.now() - a);
        lastResponse = Buffer.byteLength(JSON.stringify(res), 'utf8');
        if (firstOver === null && store.largest() > KVS_LIMIT) firstOver = k;
      }
      const we = store.map.get('ls3:we:10001');
      r.after500TamperedViews = {
        workEffortBytes: store.bytes('ls3:we:10001'),
        workEffortGrowthBytes: store.bytes('ls3:we:10001') - weBefore,
        statusRows: store.keys().filter(k => k.startsWith('ls3:wes:10001:')).length,
        incidents: we.incidentCount,
        kvsWrites: store.sets.length - s0,
        propertyWrites: jira.writes.length,
        largestKvsValue: store.largest(),
        firstViewOver240KiB: firstOver,
        responseBytes: lastResponse,
        verifyMedianMsFirst25: +median(viewTimes.slice(0, 25)).toFixed(3),
        verifyMedianMsLast25: +median(viewTimes.slice(-25)).toFixed(3)
      };
      results.scenarios[name] = r;
      expect(r.sealOk).toBe(true);
    });
  }
});
