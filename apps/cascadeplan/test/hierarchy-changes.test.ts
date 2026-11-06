/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/** N-08, ADR-005: parent changes (edit endpoint) and type conversions (bulk move), as Jira writes. */
import { getProjectPlan, changeParent, convertIssueType, checkConversion, setGlobalStorageProvider, setSleepForTests, getTimelineWeeks } from '../src/index';
import { setPermissionCheckerForTests, allowAllPermissions } from '../src/security/write-permissions';
import { PlanStore } from '../src/storage/plan-store';
import { ValidationError } from '../src/validation';
import { MemStorage } from './helpers/mem-storage';
import { FakeJiraLinks } from './helpers/fake-jira-links';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asApp: () => ({ requestJira: mockRequestJira }), asUser: () => ({ requestJira: mockRequestJira }) },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

const weeks = getTimelineWeeks().weeks;
const s0 = weeks[5].startDate;
const add = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
const TYPE = { task: { id: '10001', name: 'Task', hierarchyLevel: 0 }, sub: { id: '10003', name: 'Sub-task', hierarchyLevel: -1, subtask: true }, epic: { id: '10000', name: 'Epic', hierarchyLevel: 1 } };

let storage: MemStorage;
let links: FakeJiraLinks;
let parents: Record<string, string | null>;
let types: Record<string, any>;
let jiraDue: Record<string, string>;
let bulkJob: any;
let bulkSubmit: { status: number; body: any };
let globalBulk: boolean;
let refuseParent: string | null;

const issue = (n: number) => {
  const key = `TEST-${n}`;
  const parent = parents[key];
  return { id: String(n), key, fields: { summary: `T${n}`, issuetype: types[key], status: { statusCategory: { key: 'new' } }, duedate: jiraDue[key] || null,
    ...(parent ? { parent: { id: parent.split('-')[1], key: parent, fields: { summary: parent, issuetype: types[parent] } } } : {}) } };
};
const KEYS = [1, 2, 3, 5, 11, 20];
const puts = (key: string) => mockRequestJira.mock.calls.filter(([u, o]) => o?.method === 'PUT' && String(u) === `/rest/api/3/issue/${key}`).map(([, o]) => JSON.parse(o.body).fields);
const bulkBodies = () => mockRequestJira.mock.calls.filter(([u, o]) => o?.method === 'POST' && String(u) === '/rest/api/3/bulk/issues/move').map(([, o]) => JSON.parse(o.body));
const plan = async () => { const p = await getProjectPlan('TEST', storage); return [...p.tasks, ...(p.backlogTasks || [])]; };

beforeEach(async () => {
  storage = new MemStorage();
  setGlobalStorageProvider(storage);
  setSleepForTests(async () => undefined);
  links = new FakeJiraLinks();
  parents = { 'TEST-11': 'TEST-1', 'TEST-1': 'TEST-20' };
  types = { 'TEST-1': TYPE.task, 'TEST-2': TYPE.task, 'TEST-3': TYPE.task, 'TEST-5': TYPE.task, 'TEST-11': TYPE.sub, 'TEST-20': TYPE.epic };
  jiraDue = {};
  bulkJob = { status: 'COMPLETE', progressPercent: 100, failedAccessibleIssues: {} };
  bulkSubmit = { status: 201, body: { taskId: '777' } };
  globalBulk = true;
  refuseParent = null;
  mockRequestJira.mockReset();
  mockRequestJira.mockImplementation(async (r: any, o?: any) => {
    const url = String(r);
    const method = o?.method || 'GET';
    const ok = (status: number, body: any = {}) => ({ status, json: async () => body });
    const handled = links.handle(url, o);
    if (handled) return handled;
    const put = method === 'PUT' ? url.match(/^\/rest\/api\/3\/issue\/(TEST-\d+)$/) : null;
    if (put) {
      const f = JSON.parse(o.body).fields || {};
      if ('parent' in f) {
        if (refuseParent === put[1]) return ok(400, { errorMessages: ['You do not have permission to set the parent'] });
        parents[put[1]] = f.parent ? f.parent.key : null;
      }
      if (f.duedate) jiraDue[put[1]] = f.duedate;
      return ok(204);
    }
    if (url === '/rest/api/3/permissions/check' && method === 'POST') {
      const body = JSON.parse(o.body);
      if (body.globalPermissions) return ok(200, { globalPermissions: globalBulk ? body.globalPermissions : [] });
    }
    if (url.includes('/createmeta/TEST/issuetypes')) return ok(200, { issueTypes: [TYPE.epic, TYPE.task, TYPE.sub] });
    if (url === '/rest/api/3/bulk/issues/move' && method === 'POST') return ok(bulkSubmit.status, bulkSubmit.body);
    if (url.startsWith('/rest/api/3/bulk/queue/')) return ok(200, bulkJob);
    if (/\/rest\/api\/3\/issue\/TEST-\d+\?fields=project/.test(url)) return ok(200, { id: url.match(/TEST-(\d+)/)![1], fields: { project: { key: 'TEST', id: 'TEST' } } });
    if (url.includes('/search/jql')) {
      return ok(200, { issues: url.includes('Epic') ? [links.decorate(issue(20))] : KEYS.map(n => links.decorate(issue(n))), isLast: true });
    }
    return ok(200, {});
  });
  const w = weeks[5].weekKey;
  await storage.set('scheduleMap:TEST', {
    'TEST-11': { startWeek: w, spanWeeks: 1, startDate: s0, endDate: add(s0, 9) },
    'TEST-2': { startWeek: w, spanWeeks: 1, startDate: s0, endDate: add(s0, 2) },
    'TEST-3': { startWeek: w, spanWeeks: 1, startDate: s0, endDate: add(s0, 1) },
    'TEST-5': { startWeek: w, spanWeeks: 1, startDate: add(s0, 3), endDate: add(s0, 4) }
  });
  links.links.push({ id: '501', pred: 'TEST-2', succ: 'TEST-5' });
  await getProjectPlan('TEST', storage);
  mockRequestJira.mockClear();
});

describe('changeParent (R1, R2)', () => {
  it('R2: a sub-task moves under another task through the edit endpoint; the new parent\'s due date follows and its successor cascades', async () => {
    const res: any = await changeParent({ projectKey: 'TEST', taskId: 'TEST-11', newParentKey: 'TEST-2' }, storage);
    expect(res.ok).toBe(true);
    expect(puts('TEST-11')).toEqual([{ parent: { key: 'TEST-2' } }]);
    const all = await plan();
    expect(all.find(t => t.key === 'TEST-11')!.parentKey).toBe('TEST-2');
    const p2 = all.find(t => t.key === 'TEST-2')!;
    expect(p2).toMatchObject({ datesFromChildren: true, endDate: add(s0, 9) });
    // DEC-6: TEST-2's Jira due date is its new roll-up end.
    expect(jiraDue['TEST-2']).toBe(add(s0, 9));
    // TEST-5 depends on TEST-2 (finish to start): it now starts after the new end.
    expect(all.find(t => t.key === 'TEST-5')!.startDate > add(s0, 9)).toBe(true);
    expect(res.jiraSync.writes[0]).toMatchObject({ key: 'TEST-11', fields: ['parent'], ok: true, changes: [{ field: 'parent', from: 'TEST-1', to: 'TEST-2' }] });
  });

  it('R1: a task moves under an epic, or out of it', async () => {
    await changeParent({ projectKey: 'TEST', taskId: 'TEST-3', newParentKey: 'TEST-20' }, storage);
    expect(puts('TEST-3')).toEqual([{ parent: { key: 'TEST-20' } }]);
    await changeParent({ projectKey: 'TEST', taskId: 'TEST-1', newParentKey: null }, storage);
    expect(puts('TEST-1')).toEqual([{ parent: null }]);
  });

  it('the old parent\'s contributor entry for the moved sub-task is removed', async () => {
    const store = new PlanStore(storage, 'TEST', 'TEST');
    await store.putEntry('TEST-1', '1', { contributors: [{ accountId: 'acc-2', since: '2026-01-01', subtaskKey: 'TEST-11' }] } as any);
    expect((await store.loadEntries()).get('TEST-1')!.contributors).toHaveLength(1);
    await changeParent({ projectKey: 'TEST', taskId: 'TEST-11', newParentKey: 'TEST-2' }, storage);
    expect((await store.loadEntries()).get('TEST-1')!.contributors || []).toEqual([]);
  });

  it('refuses what Jira does not allow, before any write, with the rule as the reason', async () => {
    const no = (taskId: string, newParentKey: string | null, text: string) =>
      expect(changeParent({ projectKey: 'TEST', taskId, newParentKey }, storage)).rejects.toThrow(text);
    await no('TEST-2', 'TEST-11', 'cannot have children');
    await no('TEST-20', 'TEST-2', 'is an epic');
    await no('TEST-11', null, 'its parent must be a task or story');
    await no('TEST-11', 'TEST-20', 'its parent must be a task or story');
    await no('TEST-3', 'TEST-2', 'changes its work type');
    await no('TEST-11', 'TEST-1', 'already under');
    await no('TEST-1', 'TEST-1', 'its own parent');
    await expect(changeParent({ projectKey: 'TEST', taskId: 'TEST-11', newParentKey: 'bad' }, storage)).rejects.toThrow(ValidationError);
    expect(mockRequestJira.mock.calls.filter(([, o]) => o?.method === 'PUT')).toEqual([]);
  });

  it('refuses a move under an issue the sub-task has a dependency with (a cycle through the roll-up)', async () => {
    links.links.push({ id: '502', pred: 'TEST-2', succ: 'TEST-11' });
    await expect(changeParent({ projectKey: 'TEST', taskId: 'TEST-11', newParentKey: 'TEST-2' }, storage)).rejects.toThrow('has a dependency with TEST-2');
  });

  it('a user without Edit issues is refused; a parent Jira refuses is reported and nothing else changes', async () => {
    setPermissionCheckerForTests(async (ids, perms) => new Map(perms.map(p => [p, new Set(ids.filter(id => id !== '11'))])));
    try {
      const res: any = await changeParent({ projectKey: 'TEST', taskId: 'TEST-11', newParentKey: 'TEST-2' }, storage);
      expect(res).toMatchObject({ ok: false, error: 'forbidden' });
    } finally { setPermissionCheckerForTests(allowAllPermissions); }
    refuseParent = 'TEST-11';
    const res: any = await changeParent({ projectKey: 'TEST', taskId: 'TEST-11', newParentKey: 'TEST-2' }, storage);
    expect(res).toMatchObject({ ok: false, error: 'parent_refused' });
    expect(res.message).toContain('permission to set the parent');
    expect(jiraDue['TEST-2']).toBeUndefined();
  });
});

describe('convertIssueType and checkConversion (R3, R4)', () => {
  it('R3: a task without sub-tasks becomes a sub-task through a bulk move job', async () => {
    const res: any = await convertIssueType({ projectKey: 'TEST', taskId: 'TEST-3', toSubtaskOf: 'TEST-2' }, storage);
    expect(res).toMatchObject({ ok: true, jobId: '777', taskId: 'TEST-3', newParentKey: 'TEST-2' });
    expect(bulkBodies()).toEqual([{ sendBulkNotification: false, targetToSourcesMapping: { 'TEST,10003,TEST-2': {
      inferClassificationDefaults: true, inferFieldDefaults: true, inferStatusDefaults: true, inferSubtaskTypeDefault: true, issueIdsOrKeys: ['TEST-3'] } } }]);
  });

  it('R4: a sub-task becomes a Task', async () => {
    await convertIssueType({ projectKey: 'TEST', taskId: 'TEST-11' }, storage);
    expect(Object.keys(bulkBodies()[0].targetToSourcesMapping)).toEqual(['TEST,10001']);
  });

  it('refuses a task with sub-tasks, an epic target, and a user without Make bulk changes', async () => {
    await expect(convertIssueType({ projectKey: 'TEST', taskId: 'TEST-1', toSubtaskOf: 'TEST-2' }, storage)).rejects.toThrow('has sub-tasks');
    await expect(convertIssueType({ projectKey: 'TEST', taskId: 'TEST-3', toSubtaskOf: 'TEST-20' }, storage)).rejects.toThrow('is an epic');
    await expect(convertIssueType({ projectKey: 'TEST', taskId: 'TEST-3' }, storage)).rejects.toThrow('is not a sub-task');
    globalBulk = false;
    const res: any = await convertIssueType({ projectKey: 'TEST', taskId: 'TEST-3', toSubtaskOf: 'TEST-2' }, storage);
    expect(res).toMatchObject({ ok: false, error: 'forbidden' });
    expect(res.message).toContain('Make bulk changes');
    expect(bulkBodies()).toEqual([]);
  });

  it('the site limit of bulk jobs gives a plain "try again" message', async () => {
    bulkSubmit = { status: 429, body: { errorMessages: ['Too many concurrent bulk operations'] } };
    const res: any = await convertIssueType({ projectKey: 'TEST', taskId: 'TEST-3', toSubtaskOf: 'TEST-2' }, storage);
    expect(res).toMatchObject({ ok: false, error: 'bulk_busy' });
    expect(res.message).toContain('Try again in a minute');
  });

  it('checkConversion: running, failed, and complete (with DEC-6 for the new parent)', async () => {
    bulkJob = { status: 'RUNNING', progressPercent: 40 };
    expect(await checkConversion({ projectKey: 'TEST', jobId: '777', taskId: 'TEST-3', newParentKey: 'TEST-2' }, storage)).toMatchObject({ ok: true, done: false, progress: 40 });
    bulkJob = { status: 'COMPLETE', failedAccessibleIssues: { '3': ['Field X is required'] } };
    const failed: any = await checkConversion({ projectKey: 'TEST', jobId: '777', taskId: 'TEST-3', newParentKey: 'TEST-2' }, storage);
    expect(failed).toMatchObject({ ok: false, done: true, error: 'convert_failed' });
    expect(failed.message).toContain('Field X is required');
    // Jira converted TEST-3 into a sub-task of TEST-2.
    parents['TEST-3'] = 'TEST-2';
    types['TEST-3'] = TYPE.sub;
    jiraDue['TEST-2'] = add(s0, 2);
    bulkJob = { status: 'COMPLETE', failedAccessibleIssues: {} };
    const done: any = await checkConversion({ projectKey: 'TEST', jobId: '777', taskId: 'TEST-3', oldParentKey: null, newParentKey: 'TEST-2' }, storage);
    expect(done).toMatchObject({ ok: true, done: true });
    const p2 = done.tasks.find((t: any) => t.key === 'TEST-2');
    expect(p2.datesFromChildren).toBe(true);
    expect(jiraDue['TEST-2']).toBe(p2.endDate);
    await expect(checkConversion({ projectKey: 'TEST', jobId: 'x', taskId: 'TEST-3' }, storage)).rejects.toThrow('jobId');
  });
});
