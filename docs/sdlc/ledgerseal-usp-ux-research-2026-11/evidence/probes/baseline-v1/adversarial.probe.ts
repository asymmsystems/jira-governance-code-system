// LedgerSeal research probe A: the audit failure scenarios, recorded as outcomes.
// Copyright (c) 2026 Asymm Systems. @author Fahim Farook
// The cases record what happens. They do not assert the fix. Part B re-runs them with LS_LABEL=after.
import * as fs from 'fs';
import { JiraMock, CountingStore, smallIssue, APP_SRC } from './harness';

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

const out: Record<string, any> = {};
const label = process.env.LS_LABEL || 'baseline';
const ctx = (acc?: string) => ({ ...(acc ? { accountId: acc } : {}), extension: { issue: { id: '10001', key: 'P-1' } } });
const sig = (extra: any = {}) => ({ meaning: 'Approved', reauthConfirmation: 'CONFIRM', ...extra });

async function fresh() {
  const jira = new JiraMock(smallIssue());
  jira.users = { 'approver-1': { displayName: 'Ann Approver' }, 'mallory-9': { displayName: 'Mallory' } };
  mockJira.current = jira;
  const store = new CountingStore();
  return { jira, store };
}
async function safe(fn: () => Promise<any>) { try { return { ok: true, value: await fn() }; } catch (e: any) { return { ok: false, error: String(e.message || e) }; } }

beforeAll(() => { process.env.NODE_ENV = 'production'; });
afterAll(() => {
  process.env.NODE_ENV = 'test';
  fs.writeFileSync(__dirname + `/results-${label}-adversarial.json`, JSON.stringify(out, null, 2));
});

it('A1 LS-01 and A2 LS-02: editor reseals own edit', async () => {
  const { jira, store } = await fresh();
  await idx.sealIssue({ signature: sig() }, ctx('approver-1'), store);
  jira.issue.fields.summary = 'Release v1 plus unreviewed scope';
  await idx.verifyIssue({}, ctx('mallory-9'), store);
  const blocked = await idx.validateTransition({ issue: { key: 'P-1' } }, {}, store);
  const reseal = await safe(() => idx.sealIssue({ signature: sig({ reauthConfirmation: 'anything' }) }, ctx('mallory-9'), store));
  const after = await idx.validateTransition({ issue: { key: 'P-1' } }, {}, store);
  const act = store.map.get('cert:active:10001');
  const view = await idx.verifyIssue({}, ctx('auditor-3'), store);
  out.A1 = { validatorAfterTamper: blocked.result, resealAccepted: reseal.ok, validatorAfterReseal: after.result, signer: act.sealedBy.signerAccountId };
  out.A2 = { activeIsCompromised: act.isCompromised ?? null, activeTamperHistory: act.tamperHistory?.length ?? null,
             historyRows: (store.map.get('cert:history:10001') || []).map((h: any) => h.status),
             auditorSees: view.status, everCompromisedVisible: Boolean(view.certificate?.isCompromised || view.certificate?.tamperHistory?.length) };
  expect(out.A1).toBeTruthy();
});

it('A3 LS-03: identity from payload', async () => {
  const { store } = await fresh();
  await idx.sealIssue({ signature: sig({ signerEmail: 'cfo@victim.example', signerDisplayName: 'CFO' }) }, ctx('mallory-9'), store);
  const a = store.map.get('cert:active:10001').sealedBy;
  const { store: s2 } = await fresh();
  const noCtx = await safe(() => idx.sealIssue({ signature: sig({ signerAccountId: 'cfo-acc', signerDisplayName: 'CFO' }) }, ctx(undefined), s2));
  const b = s2.map.get('cert:active:10001')?.sealedBy;
  out.A3 = { storedEmail: a.signerEmail ?? null, storedName: a.signerDisplayName,
             noAccountIdAccepted: noCtx.ok, noAccountIdSigner: b?.signerAccountId ?? null, noAccountIdName: b?.signerDisplayName ?? null };
  expect(out.A3).toBeTruthy();
});

it('A4 LS-06: a read writes', async () => {
  const { jira, store } = await fresh();
  await idx.sealIssue({ signature: sig() }, ctx('approver-1'), store);
  let n = store.sets.length; jira.writes = [];
  await idx.verifyIssue({}, ctx('viewer-2'), store);
  const validView = { kvsWrites: store.sets.length - n, propertyWrites: jira.writes.length };
  jira.issue.fields.summary = 'x';
  await idx.verifyIssue({}, ctx('viewer-2'), store);
  n = store.sets.length; jira.writes = [];
  await idx.verifyIssue({}, ctx('viewer-2'), store);
  const tamperedRepeatView = { kvsWrites: store.sets.length - n, propertyWrites: jira.writes.length,
    keysWritten: store.sets.slice(n).map(s => s.key.replace(/[0-9a-f-]{36}/, '<certId>')) };
  out.A4 = { validView, tamperedRepeatView };
  expect(out.A4).toBeTruthy();
});

it('A5 LS-08 and LS-19: validator when Jira is unreachable', async () => {
  const { jira, store } = await fresh();
  await idx.sealIssue({ signature: sig() }, ctx('approver-1'), store);
  jira.failIssueGet = true; jira.writes = [];
  const byKey = await idx.validateTransition({ issue: { key: 'P-1' } }, {}, store);
  const byId = await idx.validateTransition({ issue: { id: '10001', key: 'P-1' } }, {}, store);
  const verify = await safe(() => idx.verifyIssue({}, ctx('viewer-2'), store));
  out.A5 = { byKey, byId, propertyWrites: jira.writes.map(w => w.body.status + '/' + w.body.tamperedFieldCount), verifyOutcome: verify.ok ? verify.value.status : verify.error };
  expect(out.A5).toBeTruthy();
});

it('A6 LS-09: declaration text stored vs shown', async () => {
  const src = fs.readFileSync(APP_SRC + '/frontend/index.tsx', 'utf8');
  const stored = /declarationText: '([^']+)'/.exec(src)?.[1];
  const shown = /label="(I certify[^"]+)"/.exec(src)?.[1];
  const { store } = await fresh();
  await idx.sealIssue({ signature: sig({ declarationText: stored }) }, ctx('approver-1'), store);
  out.A6 = { stored, shown, equal: stored === shown, reauthAcceptsAnyText: true };
  const { store: s2 } = await fresh();
  const any = await safe(() => idx.sealIssue({ signature: sig({ reauthConfirmation: 'x' }) }, ctx('approver-1'), s2));
  out.A6.reauthAcceptsAnyText = any.ok;
  expect(out.A6).toBeTruthy();
});

it('A7 LS-10: a rewritten stored certificate is not detected', async () => {
  const { store } = await fresh();
  await idx.sealIssue({ signature: sig() }, ctx('approver-1'), store);
  const c = store.map.get('cert:active:10001');
  c.sealedBy.signerAccountId = 'someone-else'; c.sealedBy.signerDisplayName = 'Someone Else';
  store.map.set('cert:active:10001', c);
  const v = await idx.verifyIssue({}, ctx('auditor-3'), store);
  out.A7 = { statusAfterSignerRewrite: v.status, shownSigner: v.certificate?.sealedBy?.signerDisplayName };
  expect(out.A7).toBeTruthy();
});

it('A8 LS-14: NODE_ENV=test accepts a client issue', async () => {
  const { jira, store } = await fresh();
  jira.failIssueGet = true;
  process.env.NODE_ENV = 'test';
  const forged = { id: '10001', key: 'P-1', fields: { summary: 'client supplied' } };
  const r = await safe(() => idx.sealIssue({ issue: forged, signature: { meaning: 'x' } }, ctx('mallory-9'), store));
  process.env.NODE_ENV = 'production';
  out.A8 = { accepted: r.ok, sealedSummary: store.map.get('cert:active:10001')?.snapshot?.fields?.find((f: any) => f.id === 'summary')?.value ?? null };
  expect(out.A8).toBeTruthy();
});

it('A9 LS-16: edit then revert with no view in between', async () => {
  const { jira, store } = await fresh();
  await idx.sealIssue({ signature: sig() }, ctx('approver-1'), store);
  jira.issue.fields.summary = 'Release v2'; jira.issue.fields.summary = 'Release v1';
  out.A9 = { validator: (await idx.validateTransition({ issue: { key: 'P-1' } }, {}, store)).result };
  expect(out.A9).toBeTruthy();
});

it('A10 LS-13: revoke and history are not reachable', async () => {
  const keys = Object.keys(idx);
  const h = await safe(() => idx.handler({ call: { functionKey: 'revoke-seal-api', payload: {} }, context: ctx('approver-1') }));
  out.A10 = { exports: keys.sort(), revokeResolver: h.ok ? 'reachable' : 'not reachable: ' + h.error };
  expect(out.A10).toBeTruthy();
});

it('A11 PX-04: an estimate or due-date write breaks the seal with no warning to the writer', async () => {
  const { jira, store } = await fresh();
  jira.issue.fields.timetracking = { originalEstimate: '90h', originalEstimateSeconds: 324000 };
  await idx.sealIssue({ signature: sig() }, ctx('approver-1'), store);
  jira.issue.fields.timetracking = { originalEstimate: '60h', originalEstimateSeconds: 216000 };
  jira.issue.fields.duedate = '2026-10-27';
  const v = await idx.verifyIssue({}, ctx('viewer-2'), store);
  out.A11 = { status: v.status, altered: v.tamperedFields.map((f: any) => f.fieldName) };
  expect(out.A11).toBeTruthy();
});
