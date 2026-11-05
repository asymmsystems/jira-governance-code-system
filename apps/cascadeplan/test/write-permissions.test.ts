/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * BL-2, INV-16: the real Jira permission check, the rule of every resolver, and the refusals.
 */
import * as fs from 'fs';
import * as path from 'path';
import { RESOLVER_RULES, handler, updateWbsTask, getProjectPlan, setGlobalStorageProvider, getTimelineWeeks } from '../src/index';
import { deniedIssues, setPermissionCheckerForTests, PermissionCheckError } from '../src/security/write-permissions';
import { PlanStore } from '../src/storage/plan-store';
import { MemStorage } from './helpers/mem-storage';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asApp: () => ({ requestJira: mockRequestJira }), asUser: () => ({ requestJira: mockRequestJira }) },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

const weeks = getTimelineWeeks().weeks;
const add = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
const start = weeks[5].startDate;
let granted: Record<string, number[]> = {};
let checkStatus = 200;
let storage: MemStorage;

const issue = (n: number) => ({ id: String(10000 + n), key: `TEST-${n}`,
  fields: { summary: `T${n}`, issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } }, duedate: null } });

beforeEach(async () => {
  setPermissionCheckerForTests(); // the real Jira check, against the fake Jira below
  storage = new MemStorage();
  setGlobalStorageProvider(storage);
  granted = {};
  checkStatus = 200;
  mockRequestJira.mockReset();
  mockRequestJira.mockImplementation(async (r: any, opts?: any) => {
    const url = String(r);
    if (opts?.method === 'POST' && url.endsWith('/permissions/check')) {
      const body = JSON.parse(opts.body);
      const perms: string[] = body.projectPermissions[0].permissions;
      return { status: checkStatus, json: async () => ({ projectPermissions: perms.map(p => ({ permission: p, issues: granted[p] || [] })) }) };
    }
    if (opts?.method === 'PUT') return { status: 204, json: async () => ({}) };
    if (url.includes('mypermissions')) return { status: 200, json: async () => ({ permissions: { ADMINISTER: { havePermission: false }, ADMINISTER_PROJECTS: { havePermission: false } } }) };
    if (url.includes('myself')) return { status: 200, json: async () => ({ groups: { items: [] } }) };
    if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [] : [1, 2].map(issue), isLast: true }) };
    return { status: 200, json: async () => ({}) };
  });
  // TEST-2 depends on TEST-1 (finish to start), both scheduled.
  const store = new PlanStore(storage, 'TEST', 'TEST');
  await store.saveSettings({ migratedAt: '2026-01-01', modelVersion: 2 });
  await store.putEntry('TEST-1', '10001', { startWeek: weeks[5].weekKey, startDate: start, endDate: add(start, 2) });
  await store.putEntry('TEST-2', '10002', { startWeek: weeks[5].weekKey, startDate: add(start, 3), endDate: add(start, 5),
    dependencies: [{ predecessorKey: 'TEST-1', predecessorId: '10001', triggerPercent: 100, isTriggerSatisfied: false }] } as any);
});

describe('BL-2: the real Jira permission check', () => {
  it('an issue missing from Jira\'s answer is denied, and a key without an id is never granted', async () => {
    granted = { EDIT_ISSUES: [10001] };
    const denied = await deniedIssues([{ key: 'TEST-1', id: '10001' }, { key: 'TEST-2', id: '10002' }, { key: 'TEST-3' }], ['EDIT_ISSUES']);
    expect(denied.map(d => d.key)).toEqual(['TEST-2', 'TEST-3']);
  });

  it('a check Jira does not answer refuses the write', async () => {
    checkStatus = 500;
    await expect(deniedIssues([{ key: 'TEST-1', id: '10001' }], ['EDIT_ISSUES'])).rejects.toBeInstanceOf(PermissionCheckError);
    const res: any = await handler({ call: { functionKey: 'updateWbsTask', payload: { taskId: 'TEST-1', updates: { progress: 10 } } },
      context: { extension: { project: { key: 'TEST', id: 'TEST' } } } });
    expect(res).toMatchObject({ ok: false, error: 'forbidden' });
    expect(mockRequestJira.mock.calls.filter(([, o]) => o?.method === 'PUT')).toEqual([]);
  });

  it('a cascaded successor the user may not edit is not moved, and is reported', async () => {
    granted = { EDIT_ISSUES: [10001], SCHEDULE_ISSUES: [10001] };
    const v = (await new PlanStore(storage, 'TEST', 'TEST').loadEntries()).get('TEST-1')!.version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: add(start, 4), endDate: add(start, 6) }, expectedVersion: v }, storage);
    expect(res.ok).toBe(true);
    expect(res.jiraSync.writes.find((w: any) => w.key === 'TEST-2')).toMatchObject({ ok: false, error: 'not moved: you lack Edit issues, Schedule issues on this issue in Jira' });
    expect((await new PlanStore(storage, 'TEST', 'TEST').loadEntries()).get('TEST-2')!.startDate).toBe(add(start, 3));
    expect(mockRequestJira.mock.calls.filter(([u, o]) => o?.method === 'PUT' && String(u).endsWith('TEST-2'))).toEqual([]);
    expect((await getProjectPlan('TEST', storage)).tasks.find(t => t.key === 'TEST-1')!.startDate).toBe(add(start, 4));
  });

  it('plan management needs a plan approver', async () => {
    const res: any = await handler({ call: { functionKey: 'createProjectPlan', payload: { name: 'X' } },
      context: { accountId: 'acc-1', extension: { project: { key: 'TEST', id: '10010' } } } });
    expect(res).toMatchObject({ ok: false, error: 'forbidden' });
    expect((await new PlanStore(storage, '10010', 'TEST').listPlans()).map(pl => pl.name)).toEqual(['Main Plan']);
  });
});

describe('BL-2: every resolver has a permission rule', () => {
  it('src/index.ts registers resolvers only through define(), which needs a rule', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.ts'), 'utf8');
    // The only resolver.define call is inside define() itself; none at the top level.
    const direct = source.split('\n').filter(l => /^resolver\.define\(/.test(l));
    expect(direct).toEqual([]);
    const names = [...source.matchAll(/^define\('([^']+)'/gm)].map(m => m[1]);
    expect(names.length).toBeGreaterThan(15);
    for (const n of names) expect(RESOLVER_RULES[n]).toBeDefined();
  });
});
