/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/** C7: a create repeated with the same create id returns the issue the first call created, and creates no second one. */
import { createIdOf, partCreateId, postIssueOnce, findCreatedIssue, createJiraEpic, createInlineTask, addSubtaskToTask, createSubtaskForResource,
  resolveLocalSubtasks, CREATE_PROPERTY, setGlobalStorageProvider, setSleepForTests } from '../src/index';
import { PlanStore } from '../src/storage/plan-store';
import { ValidationError } from '../src/validation';
import { MemStorage } from './helpers/mem-storage';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asApp: () => ({ requestJira: mockRequestJira }), asUser: () => ({ requestJira: mockRequestJira }) },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

const TASK = { id: '10001', name: 'Task', hierarchyLevel: 0 };
const ID = 'a1b2c3d4-e5f6-4711-9000-000000000001';

let storage: MemStorage;
// Issues the fake Jira created, with the create id each carries.
let created: Array<{ id: string; key: string; createId?: string; fields: any }>;
let searchStatus: number;
let createStatus: number;

const posts = () => mockRequestJira.mock.calls.filter(([u, o]) => String(u) === '/rest/api/3/issue' && o?.method === 'POST').map(([, o]) => JSON.parse(o.body));
const propertySearches = () => mockRequestJira.mock.calls.map(([u]) => String(u)).filter(u => u.includes(`issue.property[${CREATE_PROPERTY}].id`));

beforeEach(() => {
  storage = new MemStorage();
  setGlobalStorageProvider(storage);
  setSleepForTests(async () => undefined);
  created = [];
  searchStatus = 200;
  createStatus = 201;
  mockRequestJira.mockReset();
  mockRequestJira.mockImplementation(async (r: any, o?: any) => {
    const url = String(r);
    const ok = (status: number, body: any = {}) => ({ status, json: async () => body });
    if (url === '/rest/api/3/issue' && o?.method === 'POST') {
      if (createStatus !== 201) return ok(createStatus, { errorMessages: ['refused'] });
      const body = JSON.parse(o.body);
      const n = 100 + created.length;
      const prop = (body.properties || []).find((p: any) => p.key === CREATE_PROPERTY);
      created.push({ id: String(n), key: `TEST-${n}`, createId: prop?.value?.id, fields: body.fields });
      return ok(201, { id: String(n), key: `TEST-${n}` });
    }
    const byProperty = url.match(/issue\.property\[cascadeplan\.create\]\.id = "([^"]+)"/);
    if (byProperty) {
      if (searchStatus !== 200) return ok(searchStatus, {});
      return ok(200, { issues: created.filter(c => c.createId === byProperty[1]).map(c => ({ id: c.id, key: c.key })) });
    }
    if (url.includes('/search/jql')) {
      return ok(200, { issues: [{ id: '1', key: 'TEST-1', fields: { summary: 'Parent', issuetype: TASK, status: { statusCategory: { key: 'new' } } } }], isLast: true });
    }
    if (/\/rest\/api\/3\/issue\/TEST-\d+\?fields=project/.test(url)) return ok(200, { id: url.match(/TEST-(\d+)/)![1], fields: { project: { key: 'TEST', id: 'TEST' } } });
    if (o?.method === 'PUT') return ok(204);
    return ok(200, {});
  });
});

describe('create ids', () => {
  it('createIdOf accepts 8 to 60 letters, digits or hyphens, and treats an absent id as none', () => {
    expect(createIdOf(undefined)).toBeUndefined();
    expect(createIdOf(null)).toBeUndefined();
    expect(createIdOf('')).toBeUndefined();
    expect(createIdOf(ID)).toBe(ID);
    for (const bad of ['short', 'x'.repeat(61), 'has space 123', 'quote"123456', 42]) expect(() => createIdOf(bad)).toThrow(ValidationError);
  });

  it('partCreateId is stable for the same part, differs between parts, and is undefined without a create id', () => {
    expect(partCreateId(ID, 'acc-1')).toBe(partCreateId(ID, 'acc-1'));
    expect(partCreateId(ID, 'acc-1')).not.toBe(partCreateId(ID, 'acc-2'));
    expect(partCreateId(ID, 'acc-1')).toMatch(new RegExp(`^${ID}-[0-9a-f]{12}$`));
    expect(partCreateId(undefined, 'acc-1')).toBeUndefined();
  });
});

describe('postIssueOnce', () => {
  const body = { fields: { project: { key: 'TEST' }, summary: 'S', issuetype: { name: 'Task' } } };

  it('without a create id posts the body as it is, with no search', async () => {
    await postIssueOnce('TEST', body);
    expect(posts()).toEqual([body]);
    expect(propertySearches()).toEqual([]);
  });

  it('with a create id, the new issue carries it, and a repeat returns that issue without a second create', async () => {
    const first = await postIssueOnce('TEST', body, ID);
    expect(first.status).toBe(201);
    expect(posts()[0].properties).toEqual([{ key: CREATE_PROPERTY, value: { id: ID, v: 1 } }]);
    const again = await postIssueOnce('TEST', body, ID);
    expect(again).toMatchObject({ status: 201, reused: true });
    expect(await again.json()).toEqual({ id: '100', key: 'TEST-100' });
    expect(posts()).toHaveLength(1);
    expect(propertySearches()[0]).toContain('project = "TEST" AND issue.property[cascadeplan.create].id = "');
  });

  it('a search Jira does not answer does not block the create', async () => {
    searchStatus = 500;
    expect(await findCreatedIssue('TEST', ID)).toBeUndefined();
    expect((await postIssueOnce('TEST', body, ID)).status).toBe(201);
    mockRequestJira.mockImplementationOnce(async () => { throw new Error('network'); });
    expect(await findCreatedIssue('TEST', ID)).toBeUndefined();
  });
});

describe('create resolvers repeated with the same create id', () => {
  it('createJiraEpic returns the first epic', async () => {
    const a: any = await createJiraEpic({ projectKey: 'TEST', summary: 'Checkout', createId: ID });
    const b: any = await createJiraEpic({ projectKey: 'TEST', summary: 'Checkout', createId: ID });
    expect(b.epic.key).toBe(a.epic.key);
    expect(created).toHaveLength(1);
    await expect(createJiraEpic({ projectKey: 'TEST', summary: 'Checkout', createId: 'bad id' })).rejects.toThrow('createId');
  });

  it('createInlineTask returns the first task, and a new create id creates a new one', async () => {
    const a: any = await createInlineTask({ projectKey: 'TEST', summary: 'Write tests', createId: ID } as any, storage);
    const b: any = await createInlineTask({ projectKey: 'TEST', summary: 'Write tests', createId: ID } as any, storage);
    expect(a.ok && b.ok).toBe(true);
    expect(b.task.key).toBe(a.task.key);
    expect(created).toHaveLength(1);
    await createInlineTask({ projectKey: 'TEST', summary: 'Write tests', createId: `${ID}9` } as any, storage);
    expect(created).toHaveLength(2);
  });

  it('addSubtaskToTask and createSubtaskForResource return the first sub-task', async () => {
    const a: any = await addSubtaskToTask({ projectKey: 'TEST', parentTaskId: 'TEST-1', subtask: { summary: 'Schema' }, createId: ID } as any, storage);
    const b: any = await addSubtaskToTask({ projectKey: 'TEST', parentTaskId: 'TEST-1', subtask: { summary: 'Schema' }, createId: ID } as any, storage);
    expect(b.createdKey).toBe(a.createdKey);
    const id2 = `${ID}2`;
    const c: any = await createSubtaskForResource({ projectKey: 'TEST', parentKey: 'TEST-1', resource: 'Ann', resourceAccountId: 'acc-1', createId: id2 } as any, storage);
    const d: any = await createSubtaskForResource({ projectKey: 'TEST', parentKey: 'TEST-1', resource: 'Ann', resourceAccountId: 'acc-1', createId: id2 } as any, storage);
    expect(c.ok && d.ok).toBe(true);
    expect(created).toHaveLength(2);
  });

  it('resolveLocalSubtasks: a repeat after a partial success creates only the sub-tasks still missing', async () => {
    const store = new PlanStore(storage, 'TEST', 'TEST');
    const sub = (id: string, summary: string) => ({ id, summary, estimateValue: 1, estimateUnit: 'HOURS', normalizedHours: 1, status: 'TODO' });
    await store.putEntry('TEST-1', '1', { subtasks: [sub('s1', 'One'), sub('s2', 'Two')] } as any);
    // The first call created "One" in Jira, then ended before its record was saved.
    await postIssueOnce('TEST', { fields: { summary: 'One' } }, partCreateId(ID, 's1'));
    expect(created).toHaveLength(1);
    await resolveLocalSubtasks({ projectKey: 'TEST', parentTaskId: 'TEST-1', action: 'create', createId: ID } as any, storage);
    expect(created.map(c => c.fields.summary)).toEqual(['One', 'Two']);
    expect(((await new PlanStore(storage, 'TEST', 'TEST').loadEntries()).get('TEST-1')!.subtasks || []).filter((s: any) => !s.key)).toEqual([]);
  });

  it('a refused create is not reused: Jira refused it, so there is no issue to find', async () => {
    createStatus = 400;
    const a: any = await createJiraEpic({ projectKey: 'TEST', summary: 'Checkout', createId: ID });
    expect(a.ok).toBe(false);
    createStatus = 201;
    const b: any = await createJiraEpic({ projectKey: 'TEST', summary: 'Checkout', createId: ID });
    expect(b.ok).toBe(true);
    expect(created).toHaveLength(1);
  });
});
