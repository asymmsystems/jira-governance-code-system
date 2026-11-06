/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Approver policy by group (spec v2 section 7.1): a Jira admin names approver groups on the LedgerSeal admin
 * page. Members of those groups may seal, reseal and revoke, as project admins and Jira admins may.
 *
 * @author Fahim Farook
 */

import { sealIssue, verifyIssue, revokeSeal, getApproverPolicy, setApproverPolicy, searchApproverGroups } from '../src/index';
import { createJiraClient } from '../src/jira/jira-client';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asApp: jest.fn(), asUser: jest.fn() },
  route: (strings: any, ...values: any[]) =>
    strings.reduce((acc: string, s: string, i: number) => acc + s + (i < values.length ? encodeURIComponent(String(values[i])) : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const QA = { groupId: 'g-qa', name: 'qa-approvers' };
const OPS = { groupId: 'g-ops', name: 'ops' };
const adminContext = (accountId?: string) => (accountId ? { accountId } : {});

function setup() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann']);
  jira.jiraAdmins = new Set(['root']);
  jira.siteGroups = [QA, OPS];
  jira.memberships = { qa1: ['g-qa'], dev1: ['g-ops'] };
  jira.users = { ann: 'Ann Approver', qa1: 'Quinn QA', dev1: 'Dev One' };
  const storage = new MemoryStore();
  const as = (user: string | null) => {
    jira.currentUser = user;
    return { jira, storage };
  };
  return { jira, storage, as };
}

async function choose(as: (u: string | null) => any, groupIds: string[]) {
  return setApproverPolicy({ groupIds }, adminContext('root'), as('root'));
}

describe('approver policy by group', () => {
  it('lets a member of an approver group seal and revoke, and records that member as the signer', async () => {
    const { storage, as } = setup();
    await expect(choose(as, ['g-qa'])).resolves.toMatchObject({ ok: true });

    await expect(sealIssue({ signature: validSignature() }, panelContext('qa1'), as('qa1'))).resolves.toMatchObject({ ok: true });
    const assignment = [...storage.map.entries()].find(([k]) => k.startsWith('ls3:wepa:'))![1];
    expect(assignment.partyId).toBe(await model.token(storage, 'qa1'));
    await expect(revokeSeal({ reason: 'Wrong release' }, panelContext('qa1'), as('qa1'))).resolves.toMatchObject({ ok: true });
  });

  it('refuses a user in no approver group, and writes nothing', async () => {
    const { jira, storage, as } = setup();
    await choose(as, ['g-qa']);
    const before = storage.sets.length;

    await expect(sealIssue({ signature: validSignature() }, panelContext('dev1'), as('dev1'))).resolves.toMatchObject({ ok: false, code: 'NOT_APPROVER' });
    expect(storage.sets.length).toBe(before);
    expect(jira.propertyWrites).toEqual([]);
  });

  it('with no policy, only project admins and Jira admins may seal, and no group is read', async () => {
    const { jira, as } = setup();
    await expect(sealIssue({ signature: validSignature() }, panelContext('qa1'), as('qa1'))).resolves.toMatchObject({ code: 'NOT_APPROVER' });
    await expect(sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'))).resolves.toMatchObject({ ok: true });
    expect(jira.groupReads).toBe(0);
  });

  it('does not read groups for a project admin even when a policy exists', async () => {
    const { jira, as } = setup();
    await choose(as, ['g-qa']);
    jira.groupReads = 0;
    await expect(sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'))).resolves.toMatchObject({ ok: true });
    expect(jira.groupReads).toBe(0);
  });

  it('fails closed when the caller groups cannot be read', async () => {
    const { jira, storage, as } = setup();
    await choose(as, ['g-qa']);
    jira.failGroups = true;
    const before = storage.sets.length;
    await expect(sealIssue({ signature: validSignature() }, panelContext('qa1'), as('qa1'))).resolves.toMatchObject({ ok: false, code: 'JIRA_UNREACHABLE' });
    expect(storage.sets.length).toBe(before);
  });

  it('a panel view names the approver groups, shows the actions to a member, and writes nothing', async () => {
    const { storage, as } = setup();
    await choose(as, ['g-qa', 'g-ops']);
    const before = storage.sets.length;

    const view: any = await verifyIssue({}, panelContext('qa1'), as('qa1'));

    expect(view.approverGroups).toEqual(['ops', 'qa-approvers']);
    expect(view.rights).toMatchObject({ canSeal: true });
    expect(storage.sets.length).toBe(before);
  });
});

describe('admin page: approver groups', () => {
  it('only a Jira admin may read, search or change the policy', async () => {
    const { storage, as } = setup();
    for (const user of ['ann', 'qa1']) {
      await expect(getApproverPolicy({}, adminContext(user), as(user))).resolves.toMatchObject({ ok: false, code: 'NOT_ADMIN' });
      await expect(searchApproverGroups({ query: 'qa' }, adminContext(user), as(user))).resolves.toMatchObject({ ok: false, code: 'NOT_ADMIN' });
      await expect(setApproverPolicy({ groupIds: ['g-qa'] }, adminContext(user), as(user))).resolves.toMatchObject({ ok: false, code: 'NOT_ADMIN' });
    }
    expect(storage.sets).toEqual([]);
    await expect(getApproverPolicy({}, adminContext(), as(null))).resolves.toMatchObject({ code: 'NO_IDENTITY' });
  });

  it('stores the groups with the names Jira gives, the admin from context, and the time', async () => {
    const { as } = setup();
    const saved = await setApproverPolicy({ groupIds: ['g-qa', 'g-qa'], names: ['Forged name'], setByPartyId: 'someone' }, adminContext('root'), as('root'));

    expect(saved).toMatchObject({ ok: true, policy: { roleTypeId: 'LS_APPROVER', setByPartyId: 'root', parties: [{ partyId: 'g-qa', partyTypeId: 'GROUP', name: 'qa-approvers' }] } });
    const read: any = await getApproverPolicy({}, adminContext('root'), as('root'));
    expect(read.policy.parties).toEqual([{ partyId: 'g-qa', partyTypeId: 'GROUP', name: 'qa-approvers' }]);
    expect(Date.parse(read.policy.fromDate)).not.toBeNaN();
  });

  it('refuses an unknown group, a bad list and a failed Jira read, and writes nothing', async () => {
    const { jira, storage, as } = setup();
    await expect(choose(as, ['g-missing'])).resolves.toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    await expect(setApproverPolicy({ groupIds: 'g-qa' }, adminContext('root'), as('root'))).resolves.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(setApproverPolicy({ groupIds: [7] }, adminContext('root'), as('root'))).resolves.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(setApproverPolicy({ groupIds: Array.from({ length: 21 }, (_, i) => `g${i}`) }, adminContext('root'), as('root'))).resolves.toMatchObject({ code: 'INVALID_REQUEST' });
    jira.failGroups = true;
    await expect(choose(as, ['g-qa'])).resolves.toMatchObject({ code: 'JIRA_UNREACHABLE' });
    jira.failAdminCheck = true;
    await expect(choose(as, ['g-qa'])).resolves.toMatchObject({ code: 'JIRA_UNREACHABLE' });
    expect(storage.sets).toEqual([]);
  });

  it('an empty list removes every approver group', async () => {
    const { as } = setup();
    await choose(as, ['g-qa']);
    await expect(choose(as, [])).resolves.toMatchObject({ ok: true, policy: { parties: [] } });
    await expect(sealIssue({ signature: validSignature() }, panelContext('qa1'), as('qa1'))).resolves.toMatchObject({ code: 'NOT_APPROVER' });
  });

  it('searches groups by name for the admin, with a bounded query', async () => {
    const { jira, as } = setup();
    await expect(searchApproverGroups({ query: 'qa' }, adminContext('root'), as('root'))).resolves.toEqual({ ok: true, groups: [QA] });
    await expect(searchApproverGroups({ query: 'x'.repeat(101) }, adminContext('root'), as('root'))).resolves.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(getApproverPolicy({}, adminContext('root'), as('root'))).resolves.toEqual({ ok: true, policy: null });
    jira.failGroups = true;
    await expect(searchApproverGroups({ query: 'qa' }, adminContext('root'), as('root'))).resolves.toMatchObject({ code: 'JIRA_UNREACHABLE' });
  });

  it('uses the Forge defaults when no dependencies are passed, and refuses a call with no identity', async () => {
    const { getSealHistory, getSealEvidence } = require('../src/index');
    for (const call of [getApproverPolicy, setApproverPolicy, searchApproverGroups, getSealHistory, getSealEvidence]) {
      await expect(call({}, {})).resolves.toMatchObject({ ok: false, code: 'NO_IDENTITY' });
    }
  });

  it('refuses every admin call when the licence is inactive', async () => {
    const { as } = setup();
    const lapsed = { accountId: 'root', license: { active: false } };
    await expect(getApproverPolicy({}, lapsed, as('root'))).resolves.toMatchObject({ code: 'LICENSE_INACTIVE' });
    await expect(setApproverPolicy({ groupIds: [] }, lapsed, as('root'))).resolves.toMatchObject({ code: 'LICENSE_INACTIVE' });
    await expect(searchApproverGroups({ query: 'qa' }, lapsed, as('root'))).resolves.toMatchObject({ code: 'LICENSE_INACTIVE' });
  });
});

describe('Forge Jira client: groups', () => {
  const reply = (status: number, body: any = {}) => ({ status, json: async () => body, headers: { get: () => null } });

  it('reads the caller groups, admin permission, group search and groups by id as the user', async () => {
    const asApp = { requestJira: jest.fn() };
    const asUser = {
      requestJira: jest.fn(async (p: any) => {
        const url = String(p);
        if (url.startsWith('/rest/api/3/myself')) return reply(200, { groups: { items: [{ name: 'qa', groupId: 'g-qa' }, { name: 'old' }] } });
        if (url.includes('mypermissions')) return reply(200, { permissions: { ADMINISTER: { havePermission: true } } });
        if (url.includes('groups/picker')) return reply(200, { groups: [{ name: 'qa', groupId: 'g-qa' }, { name: 'no id' }] });
        return reply(200, { values: url.includes('g-qa') ? [{ name: 'qa', groupId: 'g-qa' }] : [] });
      })
    };
    const client = createJiraClient(asApp, asUser);

    await expect(client.getMyGroupIds()).resolves.toEqual({ ok: true, value: ['g-qa'] });
    await expect(client.isJiraAdmin()).resolves.toEqual({ ok: true, value: true });
    await expect(client.findGroups('q a')).resolves.toEqual({ ok: true, value: [{ groupId: 'g-qa', name: 'qa' }] });
    await expect(client.getGroups(['g-qa', 'g-x'])).resolves.toEqual({ ok: true, value: [{ groupId: 'g-qa', name: 'qa' }] });
    expect(asApp.requestJira).not.toHaveBeenCalled();
    const urls = asUser.requestJira.mock.calls.map((c: any[]) => String(c[0]));
    expect(urls).toEqual([
      '/rest/api/3/myself?expand=groups',
      '/rest/api/3/mypermissions?permissions=ADMINISTER',
      '/rest/api/3/groups/picker?query=q%20a&maxResults=20',
      '/rest/api/3/group/bulk?groupId=g-qa',
      '/rest/api/3/group/bulk?groupId=g-x'
    ]);
  });

  it('fails closed without a user, and passes on a failed read', async () => {
    const none = createJiraClient({ requestJira: jest.fn() }, null);
    for (const call of [() => none.getMyGroupIds(), () => none.isJiraAdmin(), () => none.findGroups('a'), () => none.getGroups(['g'])]) {
      await expect(call()).resolves.toEqual({ ok: false, error: 'FORBIDDEN' });
    }
    const down = createJiraClient({ requestJira: jest.fn() }, { requestJira: jest.fn(async () => reply(500)) }, { maxRetries: 0 });
    await expect(down.getMyGroupIds()).resolves.toMatchObject({ ok: false });
    await expect(down.isJiraAdmin()).resolves.toMatchObject({ ok: false });
    await expect(down.findGroups('a')).resolves.toMatchObject({ ok: false });
    await expect(down.getGroups(['g'])).resolves.toMatchObject({ ok: false });
    const empty = createJiraClient({ requestJira: jest.fn() }, { requestJira: jest.fn(async () => reply(200, {})) });
    await expect(empty.getMyGroupIds()).resolves.toEqual({ ok: true, value: [] });
    await expect(empty.isJiraAdmin()).resolves.toEqual({ ok: true, value: false });
    await expect(empty.findGroups('a')).resolves.toEqual({ ok: true, value: [] });
    await expect(empty.getGroups(['g'])).resolves.toEqual({ ok: true, value: [] });
  });
});
