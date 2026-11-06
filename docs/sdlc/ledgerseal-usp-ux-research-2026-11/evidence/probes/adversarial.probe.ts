// LedgerSeal research probe A: the audit failure scenarios, recorded as outcomes (Part B, after the build).
// Copyright (c) 2026 Asymm Systems. @author Fahim Farook
// The cases record what happens. They do not assert. The Part A version is in baseline-v1/.
import * as fs from 'fs';
import { JiraMock, CountingStore, smallIssue, APP_SRC } from './harness';

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

const out: Record<string, any> = {};
const label = process.env.LS_LABEL || 'after';
const ctx = (acc?: string) => ({ ...(acc ? { accountId: acc } : {}), extension: { issue: { id: '10001', key: 'P-1' } } });
const sig = (extra: any = {}) => ({ meaning: 'APPROVAL', declarationVersion: DECLARATION.version, declarationText: DECLARATION.text, reason: 'Approved change', ...extra });

function fresh() {
  const jira = new JiraMock(smallIssue());
  jira.users = { 'approver-1': { displayName: 'Ann Approver' }, 'mallory-9': { displayName: 'Mallory' }, 'bob-2': { displayName: 'Bob Approver' } };
  jira.approvers = new Set(['approver-1', 'bob-2', 'mallory-9']);
  const store = new CountingStore();
  const as = (user: string | null) => jira.deps(createJiraClient, store, user);
  return { jira, store, as };
}
async function safe(fn: () => Promise<any>) { try { return { ok: true, value: await fn() }; } catch (e: any) { return { ok: false, error: String(e.message || e) }; } }

afterAll(() => fs.writeFileSync(__dirname + `/results-${label}-adversarial.json`, JSON.stringify(out, null, 2)));

it('A1 LS-01 and A2 LS-02: editor reseals own edit', async () => {
  const { jira, store, as } = fresh();
  await idx.sealIssue({ signature: sig() }, ctx('approver-1'), as('approver-1'));
  jira.edit('mallory-9', 'summary', 'Release v1 plus unreviewed scope');
  await idx.verifyIssue({}, ctx('viewer-3'), as('viewer-3'));
  const blocked = await idx.validateTransition({ issue: { key: 'P-1' } }, {}, as(null));
  const reseal = await idx.sealIssue({ signature: sig() }, ctx('mallory-9'), as('mallory-9'));
  const nonApprover = await idx.sealIssue({ signature: sig() }, ctx('eve-7'), as('eve-7'));
  const after = await idx.validateTransition({ issue: { key: 'P-1' } }, {}, as(null));
  const byOther = await idx.sealIssue({ signature: sig() }, ctx('bob-2'), as('bob-2'));
  const view = await idx.verifyIssue({}, ctx('auditor-3'), as('auditor-3'));
  out.A1 = { validatorAfterTamper: blocked.result, resealByEditor: reseal.ok ? 'accepted' : reseal.code, resealByNonApprover: nonApprover.ok ? 'accepted' : nonApprover.code, validatorAfterEditorTry: after.result, resealByOtherApprover: byOther.ok };
  out.A2 = { auditorSees: view.status, everCompromised: view.seal?.everCompromised, incidentCount: view.seal?.incidentCount, historyTransitions: store.keys().filter(k => k.startsWith('ls3:wes:')).sort().map(k => store.map.get(k).transitionName) };
});

it('A3 LS-03: identity from payload', async () => {
  const { store, as } = fresh();
  await idx.sealIssue({ signature: sig({ signerEmail: 'cfo@victim.example', signerDisplayName: 'CFO', signerAccountId: 'cfo-acc' }) }, ctx('mallory-9'), as('mallory-9'));
  const stored = JSON.stringify([...store.map.values()]);
  const { as: as2 } = fresh();
  const noCtx = await idx.sealIssue({ signature: sig({ signerAccountId: 'cfo-acc' }) }, ctx(undefined), as2('mallory-9'));
  out.A3 = { storedEmail: stored.includes('cfo@victim.example'), storedCfoName: stored.includes('CFO'), storedCfoAccount: stored.includes('cfo-acc'), noAccountId: noCtx.ok ? 'accepted' : noCtx.code };
});

it('A4 LS-06: a read writes', async () => {
  const { jira, store, as } = fresh();
  await idx.sealIssue({ signature: sig() }, ctx('approver-1'), as('approver-1'));
  let n = store.sets.length; jira.writes = [];
  await idx.verifyIssue({}, ctx('viewer-2'), as('viewer-2'));
  const validView = { kvsWrites: store.sets.length - n, propertyWrites: jira.writes.length };
  jira.edit('mallory-9', 'summary', 'x');
  await idx.verifyIssue({}, ctx('viewer-2'), as('viewer-2'));
  n = store.sets.length; jira.writes = [];
  await idx.verifyIssue({}, ctx('viewer-2'), as('viewer-2'));
  out.A4 = { validView, tamperedRepeatView: { kvsWrites: store.sets.length - n, propertyWrites: jira.writes.length } };
});

it('A5 LS-08 and LS-19: validator when Jira is unreachable', async () => {
  const { jira, as } = fresh();
  await idx.sealIssue({ signature: sig() }, ctx('approver-1'), as('approver-1'));
  jira.failIssueGet = true; jira.writes = [];
  const byKey = await idx.validateTransition({ issue: { key: 'P-1' } }, {}, as(null));
  const byId = await idx.validateTransition({ issue: { id: '10001', key: 'P-1' } }, {}, as(null));
  const verify = await idx.verifyIssue({}, ctx('viewer-2'), as('viewer-2'));
  out.A5 = { byKey, byId, propertyWrites: jira.writes.length, verifyOutcome: verify.status + '/' + verify.errorReason };
});

it('A6 LS-09: declaration text stored vs shown', async () => {
  const ui = fs.readFileSync(APP_SRC + '/frontend/index.tsx', 'utf8');
  const { store, as } = fresh();
  await idx.sealIssue({ signature: sig() }, ctx('approver-1'), as('approver-1'));
  const assignment = [...store.map.entries()].find(([k]) => k.startsWith('ls3:wepa:'))![1];
  const { as: as2 } = fresh();
  const other = await idx.sealIssue({ signature: sig({ declarationText: 'I electronically sign and seal this issue.' }) }, ctx('approver-1'), as2('approver-1'));
  out.A6 = { stored: assignment.declaration, shownFromSameConstant: ui.includes('{DECLARATION.text}'), otherTextOutcome: other.ok ? 'accepted' : other.code, uiHasReauthField: /reauth/i.test(ui) };
});

it('A7 LS-10: a rewritten stored record is detected', async () => {
  const { store, as } = fresh();
  await idx.sealIssue({ signature: sig() }, ctx('approver-1'), as('approver-1'));
  const key = store.keys().find(k => k.startsWith('ls3:wepa:'))!;
  store.map.set(key, { ...store.map.get(key), partyId: 'someone-else' });
  const v = await idx.verifyIssue({}, ctx('auditor-3'), as('auditor-3'));
  const gate = await idx.validateTransition({ issue: { key: 'P-1' } }, {}, as(null));
  out.A7 = { statusAfterSignerRewrite: v.status, gate };
});

it('A8 LS-14: a client-supplied issue is used', async () => {
  const { jira, store, as } = fresh();
  jira.failIssueGet = true;
  const r = await idx.sealIssue({ issue: { id: '10001', key: 'P-1', fields: { summary: 'client supplied' } }, signature: sig() }, ctx('mallory-9'), as('mallory-9'));
  out.A8 = { outcome: r.ok ? 'accepted' : r.code, wroteAnything: store.sets.length > 0 };
});

it('A9 LS-16: edit then revert with no panel view in between', async () => {
  const withEvent = fresh();
  await idx.sealIssue({ signature: sig() }, ctx('approver-1'), withEvent.as('approver-1'));
  withEvent.jira.edit('mallory-9', 'summary', 'Release v2');
  await idx.onIssueChanged({ eventType: 'avi:jira:updated:issue', issue: { id: '10001' } }, {}, withEvent.as(null));
  withEvent.jira.edit('mallory-9', 'summary', 'Release v1');
  const noEvent = fresh();
  await idx.sealIssue({ signature: sig() }, ctx('approver-1'), noEvent.as('approver-1'));
  noEvent.jira.edit('mallory-9', 'summary', 'Release v2');
  noEvent.jira.edit('mallory-9', 'summary', 'Release v1');
  out.A9 = {
    validatorWhenTheUpdateEventArrived: (await idx.validateTransition({ issue: { key: 'P-1' } }, {}, withEvent.as(null))).result,
    validatorWhenNoEventArrived: (await idx.validateTransition({ issue: { key: 'P-1' } }, {}, noEvent.as(null))).result
  };
});

it('A10 LS-13: revoke and history are reachable', async () => {
  const { as } = fresh();
  await idx.sealIssue({ signature: sig() }, ctx('approver-1'), as('approver-1'));
  const revoke = await safe(() => idx.revokeSeal({ reason: 'Scope withdrawn' }, ctx('bob-2'), as('bob-2')));
  const history = await idx.getSealHistory({}, ctx('auditor-3'), as('auditor-3'));
  out.A10 = { revoke: revoke.ok ? revoke.value.ok : revoke.error, historyTransitions: history.entries.map((e: any) => e.transitionName), chainValid: history.chainValid };
});

it('A11 PX-04: an estimate or due-date write breaks the seal and names who changed it', async () => {
  const { jira, as } = fresh();
  jira.issue.fields.timetracking = { originalEstimate: '90h', originalEstimateSeconds: 324000 };
  await idx.sealIssue({ signature: sig() }, ctx('approver-1'), as('approver-1'));
  jira.edit('cascadeplan-user', 'timetracking', { originalEstimate: '60h', originalEstimateSeconds: 216000 });
  jira.edit('cascadeplan-user', 'duedate', '2026-10-27');
  const v = await idx.verifyIssue({}, ctx('viewer-2'), as('viewer-2'));
  out.A11 = { status: v.status, altered: v.tamperedFields.map((f: any) => `${f.fieldName} by ${f.changedBy.join(',')}`), propertyStatus: jira.writes[jira.writes.length - 1]?.body?.status };
});
