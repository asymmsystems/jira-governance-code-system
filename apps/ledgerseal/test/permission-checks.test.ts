/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Marketplace security questionnaire question 3: every resolver that acts on the context issue (verify, seal,
 * revoke, history, evidence) first checks, as the calling user and with the permissions REST API, that the user
 * may browse the issue. Without that permission, or when the check fails, it reads nothing as the app, writes
 * nothing and returns nothing about the issue.
 *
 * @author Fahim Farook
 */

import { createSigningIntent, getSealEvidence, getSealHistory, requestSigningCode, revokeSeal, sealIssue, verifyIssue } from '../src/index';
import { createJiraClient } from '../src/jira/jira-client';
import { buildPanelView } from '../src/frontend/view-model';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: (s: any, ...v: any[]) => s.reduce((a: string, x: string, i: number) => a + x + (v[i] ?? ''), '') }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const APP_READS = ['getIssue', 'getComments', 'getWorklogs', 'getFields', 'getChangelog', 'getUserName', 'accountState', 'putSealProperty', 'getIssueScope', 'notifyUser'] as const;

async function sealedIssue() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann', 'bob']);
  const storage = new MemoryStore();
  const as = (user: string) => {
    jira.currentUser = user;
    return { jira, storage };
  };
  await expect(sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'))).resolves.toMatchObject({ ok: true });
  // Spy on every app read and write only after the seal, so the counts below are the resolver's own calls
  const spies = APP_READS.map(name => jest.spyOn(jira, name as any));
  const appCalls = () => spies.reduce((n, spy) => n + spy.mock.calls.length, 0);
  return { jira, storage, as, appCalls };
}

const RESOLVERS: [string, (user: string, deps: any) => Promise<any>][] = [
  ['verify-issue-api', (user, deps) => verifyIssue({}, panelContext(user), deps)],
  ['seal-issue-api', (user, deps) => sealIssue({ signature: validSignature({ reason: 'Agreed' }) }, panelContext(user), deps)],
  ['revoke-seal-api', (user, deps) => revokeSeal({ reason: 'Scope withdrawn' }, panelContext(user), deps)],
  ['seal-history-api', (user, deps) => getSealHistory({}, panelContext(user), deps)],
  ['seal-evidence-api', (user, deps) => getSealEvidence({}, panelContext(user), deps)],
  ['signing-code-request-api', (user, deps) => requestSigningCode({ action: 'SEAL' }, panelContext(user), deps)],
  ['transition-sign-intent-api', (user, deps) => createSigningIntent({ viewHash: 'x', signature: validSignature() }, panelContext(user), deps)]
];

describe('Q3 a Browse projects check as the user comes before any app read', () => {
  it.each(RESOLVERS)('%s refuses a user who cannot browse the issue, and reads and writes nothing', async (_name, call) => {
    const { jira, storage, as, appCalls } = await sealedIssue();
    // bob is an approver, so only the Browse check stops seal and revoke
    jira.cannotBrowse.add('bob');
    const sets = storage.sets.length;
    jira.browseChecks = [];
    const result = await call('bob', as('bob'));
    expect(result).toMatchObject({ ok: false, code: 'NO_BROWSE_PERMISSION' });
    expect(result.message).toMatch(/permission to browse this issue/);
    expect(jira.browseChecks).toEqual(['10001']);
    expect(appCalls()).toBe(0);
    expect(storage.sets.length).toBe(sets);
    expect(JSON.stringify(result)).not.toMatch(/CHG-1|LS_SEALED|summary/i);
  });

  it.each(RESOLVERS)('%s fails closed when Jira cannot answer the permission check', async (_name, call) => {
    const { jira, as, appCalls } = await sealedIssue();
    jira.browseError = 'UNREACHABLE';
    await expect(call('bob', as('bob'))).resolves.toMatchObject({ ok: false, code: 'JIRA_UNREACHABLE' });
    expect(appCalls()).toBe(0);
    for (const refused of ['FORBIDDEN', 'NOT_FOUND'] as const) {
      jira.browseError = refused;
      await expect(call('bob', as('bob'))).resolves.toMatchObject({ ok: false, code: 'NO_BROWSE_PERMISSION' });
    }
    expect(appCalls()).toBe(0);
  });

  it.each(RESOLVERS)('%s still works for a user who can browse the issue', async (_name, call) => {
    const { jira, as } = await sealedIssue();
    jira.browseChecks = [];
    const result = await call('bob', as('bob'));
    expect(result?.code).not.toBe('NO_BROWSE_PERMISSION');
    expect(result?.ok === false ? result.code : 'ok').not.toBe('JIRA_UNREACHABLE');
    expect(jira.browseChecks).toEqual(['10001']);
  });

  it('the panel says why it shows nothing', () => {
    const view = buildPanelView({ result: { ok: false, code: 'NO_BROWSE_PERMISSION', message: 'You do not have permission to browse this issue in Jira, so LedgerSeal shows nothing about it.' } } as any);
    expect(JSON.stringify(view)).toContain('You do not have permission to browse this issue in Jira');
  });
});

describe('Q3 the Jira client', () => {
  const reply = (status: number, body: any = {}) => ({ status, json: async () => body, headers: { get: () => null } });

  it('asks the permissions REST API as the user for BROWSE_PROJECTS on the issue', async () => {
    const asUser = { requestJira: jest.fn().mockResolvedValue(reply(200, { permissions: { BROWSE_PROJECTS: { havePermission: true } } })) };
    const asApp = { requestJira: jest.fn() };
    await expect(createJiraClient(asApp, asUser).canBrowseIssue('10001')).resolves.toEqual({ ok: true, value: true });
    expect(String(asUser.requestJira.mock.calls[0][0])).toBe('/rest/api/3/mypermissions?issueId=10001&permissions=BROWSE_PROJECTS');
    expect(asApp.requestJira).not.toHaveBeenCalled();
    const denied = { requestJira: jest.fn().mockResolvedValue(reply(200, { permissions: { BROWSE_PROJECTS: { havePermission: false } } })) };
    await expect(createJiraClient(asApp, denied).canBrowseIssue('10001')).resolves.toEqual({ ok: true, value: false });
    const empty = { requestJira: jest.fn().mockResolvedValue(reply(200, {})) };
    await expect(createJiraClient(asApp, empty).canBrowseIssue('10001')).resolves.toEqual({ ok: true, value: false });
    await expect(createJiraClient(asApp, null).canBrowseIssue('10001')).resolves.toEqual({ ok: false, error: 'FORBIDDEN' });
    const missing = { requestJira: jest.fn().mockResolvedValue(reply(404)) };
    await expect(createJiraClient(asApp, missing).canBrowseIssue('10001')).resolves.toMatchObject({ ok: false, error: 'NOT_FOUND' });
  });
});
