/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-01: approver policy, separation of duties, identity from context and the injected Jira client.
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';
import { sealIssue, verifyIssue, validateTransition } from '../src/index';
import { createJiraClient } from '../src/jira/jira-client';
import { FakeJira, MemoryStore, panelContext, sampleIssue } from './support/fakes';

jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asApp: jest.fn(), asUser: jest.fn() },
  route: (strings: any, ...values: any[]) =>
    strings.reduce((acc: string, s: string, i: number) => acc + s + (i < values.length ? encodeURIComponent(String(values[i])) : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const sig = { meaning: 'Approved', reauthConfirmation: 'CONFIRM' };

function setup() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann', 'bob']);
  jira.users = { ann: 'Ann Approver', bob: 'Bob Approver', mallory: 'Mallory' };
  const storage = new MemoryStore();
  const deps = (user: string | null) => {
    jira.currentUser = user;
    return { jira, storage };
  };
  return { jira, storage, deps };
}

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    return fs.statSync(full).isDirectory() ? listSourceFiles(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('B-01 approver policy and separation of duties', () => {
  it('has no NODE_ENV branch in production code', () => {
    const offenders = listSourceFiles(path.resolve(__dirname, '../src')).filter(f =>
      fs.readFileSync(f, 'utf8').includes('NODE_ENV')
    );
    expect(offenders).toEqual([]);
  });

  it('lets an approver seal and records the context account as the signer', async () => {
    const { storage, deps } = setup();
    const result = await sealIssue({ signature: sig }, panelContext('ann'), deps('ann'));
    expect(result).toMatchObject({ ok: true });
    const active = await storage.get('ls2:seal:10001');
    expect(active.sealedBy).toEqual({ accountId: 'ann', displayName: 'Ann Approver' });
  });

  it('refuses a seal from a user outside the policy and writes nothing', async () => {
    const { jira, storage, deps } = setup();
    const result = await sealIssue({ signature: sig }, panelContext('mallory'), deps('mallory'));
    expect(result).toMatchObject({ ok: false, code: 'NOT_APPROVER' });
    expect(storage.sets).toEqual([]);
    expect(jira.propertyWrites).toEqual([]);
  });

  it('adversarial (audit flow.js step 3): the editor cannot reseal their own change', async () => {
    const { jira, storage, deps } = setup();
    jira.approvers.add('mallory');
    await sealIssue({ signature: sig }, panelContext('ann'), deps('ann'));
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'Rotate credentials and drop the audit table');
    await verifyIssue({}, panelContext('viewer'), deps('viewer'));
    const before = storage.sets.length;
    const writesBefore = jira.propertyWrites.length;

    const result = await sealIssue({ signature: { ...sig, reauthConfirmation: 'anything' } }, panelContext('mallory'), deps('mallory'));

    expect(result).toMatchObject({ ok: false, code: 'SELF_APPROVAL' });
    expect(storage.sets.length).toBe(before);
    expect(jira.propertyWrites.length).toBe(writesBefore);
    const gate = await validateTransition({ issue: { key: 'CHG-1' } }, {}, deps(null));
    expect(gate.result).toBe(false);
  });

  it('lets a different approver approve the change, after which the gate opens', async () => {
    const { jira, deps } = setup();
    await sealIssue({ signature: sig }, panelContext('ann'), deps('ann'));
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'Rotate credentials, staged rollout');
    const result = await sealIssue({ signature: sig }, panelContext('bob'), deps('bob'));
    expect(result).toMatchObject({ ok: true });
    const gate = await validateTransition({ issue: { key: 'CHG-1' } }, {}, deps(null));
    expect(gate).toEqual({ result: true });
  });

  it('fails every resolver with NO_IDENTITY when the context has no account id, and writes nothing', async () => {
    const { jira, storage, deps } = setup();
    const seal = await sealIssue({ signature: { ...sig, signerAccountId: 'cfo' } }, panelContext(), deps('ann'));
    const verify = await verifyIssue({}, panelContext(), deps('ann'));
    expect(seal).toMatchObject({ ok: false, code: 'NO_IDENTITY' });
    expect(verify).toMatchObject({ ok: false, code: 'NO_IDENTITY' });
    expect(storage.sets).toEqual([]);
    expect(jira.propertyWrites).toEqual([]);
  });
});

describe('B-01 failure paths', () => {
  it('maps a permission read failure to NOT_APPROVER or JIRA_UNREACHABLE, and writes nothing', async () => {
    const { jira, storage, deps } = setup();
    jira.permissionError = 'FORBIDDEN';
    await expect(sealIssue({ signature: sig }, panelContext('ann'), deps('ann'))).resolves.toMatchObject({ code: 'NOT_APPROVER' });
    jira.permissionError = 'UNREACHABLE';
    await expect(sealIssue({ signature: sig }, panelContext('ann'), deps('ann'))).resolves.toMatchObject({ code: 'JIRA_UNREACHABLE' });
    expect(storage.sets).toEqual([]);
  });

  it('refuses a reseal when the change log cannot be read', async () => {
    const { jira, deps } = setup();
    await sealIssue({ signature: sig }, panelContext('ann'), deps('ann'));
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    jira.failChangelog = true;
    await expect(sealIssue({ signature: sig }, panelContext('bob'), deps('bob'))).resolves.toMatchObject({ code: 'JIRA_UNREACHABLE' });
  });

  it('applies separation of duties to a change that was changed back', async () => {
    const { jira, storage, deps } = setup();
    jira.approvers.add('mallory');
    await sealIssue({ signature: sig }, panelContext('ann'), deps('ann'));
    const original = jira.issue.fields.summary;
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    await verifyIssue({}, panelContext('viewer'), deps('viewer'));
    jira.edit('mallory', '2099-01-01T00:01:00.000Z', 'summary', original);
    const active = await storage.get('ls2:seal:10001');
    expect(active.everCompromised).toBe(true);
    await expect(sealIssue({ signature: sig }, panelContext('mallory'), deps('mallory'))).resolves.toMatchObject({ code: 'SELF_APPROVAL' });
  });

  it('stores a default meaning and uses the issue id as the key when the context has no key', async () => {
    const { storage, deps } = setup();
    await sealIssue({ signature: { reauthConfirmation: 'CONFIRM' } }, { accountId: 'ann', extension: { issue: { id: '10001' } } }, deps('ann'));
    const active = await storage.get('ls2:seal:10001');
    expect(active.meaning).toBe('Approved for production release');
  });

  it('validator: falls back when the issue cannot be read, by id or by key', async () => {
    const { jira, deps } = setup();
    jira.failIssueGet = true;
    await expect(validateTransition({ issue: { key: 'CHG-1' } }, {}, deps(null))).resolves.toMatchObject({ result: false });
    await expect(validateTransition({ issue: { id: '10001' } }, {}, deps(null))).resolves.toMatchObject({ result: false });
    jira.failIssueGet = false;
    delete jira.issue.id;
    await expect(validateTransition({ issue: { id: '10001', key: 'CHG-1' } }, {}, deps(null))).resolves.toMatchObject({ result: false });
  });

  it('validator: uses the Forge defaults when no dependencies are passed', async () => {
    await expect(validateTransition({}, {})).resolves.toEqual({ result: false, errorMessage: 'LedgerSeal Validator: Missing issue context.' });
  });
});

describe('B-01 Forge Jira client', () => {
  const reply = (status: number, body: any = {}) => ({ status, json: async () => body, headers: { get: () => null } });

  it('checks the approver permission as the user, not as the app', async () => {
    const asApp = { requestJira: jest.fn(async () => reply(200, {})) };
    const asUser = {
      requestJira: jest.fn(async () =>
        reply(200, { permissions: { ADMINISTER_PROJECTS: { havePermission: true }, ADMINISTER: { havePermission: false } } })
      )
    };
    const client = createJiraClient(asApp, asUser);
    await expect(client.hasApproverPermission('10001')).resolves.toEqual({ ok: true, value: true });
    expect(asApp.requestJira).not.toHaveBeenCalled();
    expect(asUser.requestJira).toHaveBeenCalledTimes(1);
    expect(String((asUser.requestJira.mock.calls[0] as any[])[0])).toBe(
      '/rest/api/3/mypermissions?issueId=10001&permissions=ADMINISTER_PROJECTS%2CADMINISTER'
    );
  });

  it('denies the permission when neither permission is held, and fails closed without a user', async () => {
    const asApp = { requestJira: jest.fn() };
    const asUser = {
      requestJira: jest.fn(async () =>
        reply(200, { permissions: { ADMINISTER_PROJECTS: { havePermission: false }, ADMINISTER: { havePermission: false } } })
      )
    };
    await expect(createJiraClient(asApp, asUser).hasApproverPermission('1')).resolves.toEqual({ ok: true, value: false });
    await expect(createJiraClient(asApp, null).hasApproverPermission('1')).resolves.toEqual({ ok: false, error: 'FORBIDDEN' });
  });

  it('reads the issue, change log, user and property as the app', async () => {
    const asUser = { requestJira: jest.fn() };
    const asApp = {
      requestJira: jest.fn(async (p: any) => {
        const url = String(p);
        if (url.includes('/changelog')) {
          return reply(200, { values: [{ id: '1', author: { accountId: 'm' }, created: 'c', items: [] }], isLast: true });
        }
        if (url.includes('/user?')) return reply(200, { displayName: 'Ann' });
        if (url.includes('/properties/')) return reply(204);
        return reply(200, { id: '10001', key: 'CHG-1', fields: {} });
      })
    };
    const client = createJiraClient(asApp, asUser);
    await expect(client.getIssue('10001')).resolves.toMatchObject({ ok: true, value: { key: 'CHG-1' } });
    await expect(client.getChangelog('10001')).resolves.toMatchObject({ ok: true, value: [{ id: '1' }] });
    await expect(client.getUserName('ann')).resolves.toBe('Ann');
    await expect(client.putSealProperty('10001', { status: 'SEAL_VALID' })).resolves.toBe(true);
    expect(asUser.requestJira).not.toHaveBeenCalled();
  });

  it('maps HTTP failures to typed results instead of null', async () => {
    const asApp = {
      requestJira: jest
        .fn()
        .mockResolvedValueOnce(reply(404))
        .mockResolvedValueOnce(reply(403))
        .mockRejectedValueOnce(new Error('socket hang up'))
        .mockResolvedValueOnce(reply(500))
        .mockRejectedValueOnce(new Error('down'))
    };
    const client = createJiraClient(asApp, null, { maxRetries: 0 });
    await expect(client.getIssue('1')).resolves.toEqual({ ok: false, error: 'NOT_FOUND', status: 404 });
    await expect(client.getIssue('1')).resolves.toEqual({ ok: false, error: 'FORBIDDEN', status: 403 });
    await expect(client.getIssue('1')).resolves.toEqual({ ok: false, error: 'UNREACHABLE' });
    await expect(client.getUserName('x')).resolves.toBeNull();
    await expect(client.putSealProperty('1', {})).resolves.toBe(false);
  });
});
