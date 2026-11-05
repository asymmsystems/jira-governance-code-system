/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/** Error and edge paths of the hierarchy, block-move, due-date and baseline resolvers: each refuses plainly and writes nothing. */
import { getProjectPlan, changeParent, convertIssueType, checkConversion, moveTaskGroup, updateWbsTask, getPlanBaselines, freezePlanBaseline, reviewScopeShift, exportBaseline, compareBaselines, getScopeCreepReport, setGlobalStorageProvider, setSleepForTests, getTimelineWeeks } from '../src/index';
import { BaselineStore, eraseClosedAccounts } from '../src/storage/baseline-store';
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
let createmetaTypes: any[];
let queueStatus = 200;
let searchOneStatus = 200;

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
  createmetaTypes = [TYPE.epic, TYPE.task, TYPE.sub];
  queueStatus = 200;
  searchOneStatus = 200;
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
    if (url.includes('/createmeta/TEST/issuetypes')) return ok(200, { issueTypes: createmetaTypes });
    if (url === '/rest/api/3/bulk/issues/move' && method === 'POST') return ok(bulkSubmit.status, bulkSubmit.body);
    if (url.startsWith('/rest/api/3/bulk/queue/')) return ok(queueStatus, bulkJob);
    if (/\/rest\/api\/3\/issue\/TEST-\d+\?fields=project/.test(url)) return ok(200, { id: url.match(/TEST-(\d+)/)![1], fields: { project: { key: 'TEST', id: 'TEST' } } });
    const one = url.match(/jql=key\+%3D\+(TEST-\d+)/);
    if (url.includes('/search/jql') && one) return searchOneStatus === 200 ? ok(200, { issues: KEYS.filter(n => `TEST-${n}` === one[1]).map(n => issue(n)) }) : ok(searchOneStatus, {});
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


describe('convertIssueType: every refusal is plain and writes nothing', () => {
  it('bad input, unknown issues, wrong kinds, missing types, a link cycle, and a refused job', async () => {
    const no = (p: any, text: string) => expect(convertIssueType({ projectKey: 'TEST', ...p }, storage)).rejects.toThrow(text);
    await no({ taskId: 'TEST-3', toSubtaskOf: 'bad key' }, 'toSubtaskOf');
    await no({ taskId: 'TEST-11', toTypeName: '<script>' }, 'work type name');
    await no({ taskId: 'TEST-99', toSubtaskOf: 'TEST-2' }, 'not in project');
    await no({ taskId: 'TEST-11', toSubtaskOf: 'TEST-2' }, 'already a sub-task');
    await no({ taskId: 'TEST-3', toSubtaskOf: 'TEST-98' }, 'not in project');
    await no({ taskId: 'TEST-3', toSubtaskOf: 'TEST-3' }, 'its own parent');
    links.links.push({ id: '601', pred: 'TEST-2', succ: 'TEST-3' });
    await no({ taskId: 'TEST-3', toSubtaskOf: 'TEST-2' }, 'has a dependency with TEST-2');
    links.links.pop();
    createmetaTypes = [TYPE.task];
    await no({ taskId: 'TEST-3', toSubtaskOf: 'TEST-2' }, 'no sub-task work type');
    await no({ taskId: 'TEST-11', toTypeName: 'Story' }, 'no work type "Story"');
    createmetaTypes = [TYPE.epic, TYPE.task, TYPE.sub];
    bulkSubmit = { status: 400, body: { errors: { issueType: 'Field X is required' } } };
    const res: any = await convertIssueType({ projectKey: 'TEST', taskId: 'TEST-3', toSubtaskOf: 'TEST-2' }, storage);
    expect(res).toMatchObject({ ok: false, error: 'convert_refused' });
    expect(res.message).toContain('Field X is required');
    setPermissionCheckerForTests(async (ids, perms) => new Map(perms.map(p => [p, new Set(p === 'MOVE_ISSUES' ? [] : ids)])));
    try {
      const f: any = await convertIssueType({ projectKey: 'TEST', taskId: 'TEST-3', toSubtaskOf: 'TEST-2' }, storage);
      expect(f.message).toContain('Move issues');
    } finally { setPermissionCheckerForTests(allowAllPermissions); }
  });
});

describe('checkConversion: unknown jobs and failures', () => {
  it('a bad parent key, a job Jira does not report, a failed job with no details, and a parent the user may not schedule', async () => {
    await expect(checkConversion({ projectKey: 'TEST', jobId: '777', taskId: 'TEST-3', newParentKey: 'nope' }, storage)).rejects.toThrow(ValidationError);
    queueStatus = 404;
    expect(await checkConversion({ projectKey: 'TEST', jobId: '777', taskId: 'TEST-3' }, storage)).toMatchObject({ ok: false, error: 'job_unknown' });
    queueStatus = 200;
    bulkJob = { status: 'DEAD' };
    const dead: any = await checkConversion({ projectKey: 'TEST', jobId: '777', taskId: 'TEST-3' }, storage);
    expect(dead.message).toContain('the job ended as DEAD');
    bulkJob = { status: 'COMPLETE', failedAccessibleIssues: {} };
    parents['TEST-3'] = 'TEST-2';
    types['TEST-3'] = TYPE.sub;
    jiraDue['TEST-2'] = add(s0, 2);
    setPermissionCheckerForTests(async (ids, perms) => new Map(perms.map(p => [p, new Set(ids.filter(id => id !== '2'))])));
    try {
      const r: any = await checkConversion({ projectKey: 'TEST', jobId: '777', taskId: 'TEST-3', oldParentKey: 'TEST-1', newParentKey: 'TEST-2' }, storage);
      expect(r.ok).toBe(true);
      expect(r.jiraSync.writes.find((w: any) => w.key === 'TEST-2')).toMatchObject({ ok: false, error: expect.stringContaining('not written') });
    } finally { setPermissionCheckerForTests(allowAllPermissions); }
  });
});

describe('changeParent: unknown issues', () => {
  it('an unknown task or parent is refused', async () => {
    await expect(changeParent({ projectKey: 'TEST', taskId: 'TEST-99', newParentKey: 'TEST-2' }, storage)).rejects.toThrow('not in project');
    await expect(changeParent({ projectKey: 'TEST', taskId: 'TEST-11', newParentKey: 'TEST-98' }, storage)).rejects.toThrow('not in project');
    await expect(changeParent({ projectKey: 'TEST', taskId: 'TEST-11', newParentKey: 'TEST-3' }, storage)).resolves.toMatchObject({ ok: true });
  });
});

describe('moveTaskGroup: edge cases', () => {
  it('an unknown parent and a bad expectedVersions map are refused', async () => {
    await expect(moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-99', days: 7 }, storage)).rejects.toThrow('not in project');
    await expect(moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-1', days: 7, expectedVersions: [] as any }, storage)).rejects.toThrow('expectedVersions');
    await expect(moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-1', days: 7, expectedVersions: { 'TEST-11': -1 } }, storage)).rejects.toThrow('expectedVersions');
  });
});

describe('the due-date check (C3) when Jira does not answer', () => {
  it('a failed or empty check does not block the move', async () => {
    const v = (await new PlanStore(storage, 'TEST', 'TEST').loadEntries()).get('TEST-2')!.version;
    searchOneStatus = 500;
    const r: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-2', updates: { startDate: add(s0, 1), endDate: add(s0, 3) }, expectedVersion: v, expectedDueDate: null }, storage);
    expect(r.ok).not.toBe(false);
  });
});

describe('baseline store and resolvers: edge cases', () => {
  it('missing baselines, a busy index, setActive on a missing id, and erasure of an unknown account', async () => {
    const store = new BaselineStore(storage, 'TEST', 'default');
    expect(await store.load('nope')).toBeUndefined();
    expect(await store.setActive('nope')).toBe(false);
    expect(await exportBaseline({ projectKey: 'TEST', baselineId: 'nope' }, storage)).toMatchObject({ ok: false, error: 'no_baseline' });
    expect(await compareBaselines({ projectKey: 'TEST', fromId: 'a', toId: 'b' }, storage)).toMatchObject({ ok: false });
    expect(await getScopeCreepReport({ projectKey: 'TEST', baselineId: 'nope' }, storage)).toMatchObject({ ok: false });
    expect(await reviewScopeShift({ projectKey: 'TEST', shiftId: 'nope', status: 'APPROVED' }, storage, { accountId: 'a' })).toMatchObject({ ok: false });
    expect(await getPlanBaselines({ projectKey: 'TEST' }, storage)).toMatchObject({ ok: true, active: null, activeIntact: null, baselines: [] });
    expect(await eraseClosedAccounts(storage, [])).toEqual([]);
    expect(await eraseClosedAccounts(storage, ['who'])).toEqual([]);
    // Another writer changes the index at every try: the save gives up with a plain message.
    const realSwap = storage.swap.bind(storage);
    storage.swap = async (k: string, v: any) => { const prev: any = await realSwap(k, v); return (k.endsWith(':index') ? { ...(prev || { ids: [] }), v: ((prev && prev.v) || 0) + 100 } : prev) as any; };
    await expect(store.save({ id: 'b1', name: 'B', frozenAt: 'T', frozenBy: null, items: [] })).rejects.toThrow('Someone else is changing');
  });

  it('a review without a reviewer id, and a request already reviewed, are refused', async () => {
    await freezePlanBaseline({ projectKey: 'TEST', name: 'B' }, storage, { accountId: 'acc-1' });
    const store = new BaselineStore(storage, 'TEST', 'default');
    await store.saveShift({ id: 's1', planId: 'default', baselineId: (await store.readIndex()).active!, requestedBy: 'acc-2', requestedAt: 'x', reason: 'r', status: 'REJECTED', summary: { added: 0, removed: 0, changed: 1, deltaHours: 0 }, reviewedBy: 'acc-1', v: 1 });
    expect((await reviewScopeShift({ projectKey: 'TEST', shiftId: 's1', status: 'APPROVED' }, storage, { accountId: 'acc-3' })).error).toContain('already been reviewed');
    await store.saveShift({ id: 's2', planId: 'default', baselineId: 'x', requestedBy: null, requestedAt: 'y', reason: 'r', status: 'PENDING', summary: { added: 0, removed: 0, changed: 1, deltaHours: 0 }, v: 1 });
    expect((await reviewScopeShift({ projectKey: 'TEST', shiftId: 's2', status: 'APPROVED' }, storage, {})).error).toContain('could not be identified');
    const list: any = await getPlanBaselines({ projectKey: 'TEST' }, storage);
    expect(list.shifts.map((s: any) => s.requestedByName)).toEqual(['a deleted user', 'a Jira user']);
  });
});
