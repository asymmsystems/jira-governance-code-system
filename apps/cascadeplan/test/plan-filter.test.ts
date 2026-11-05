/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/** F-27: a plan reads only the project's issues that match its JQL filter, and the filter can only narrow the project. */
import { getProjectPlan, setPlanFilter, fetchRawIssues, testPlanFilter, updateWbsTask, createProjectPlan, setGlobalStorageProvider, setSleepForTests, getTimelineWeeks, RESOLVER_RULES, MAX_PAGES, fetchProjectUsers, USER_PAGE_SIZE, MAX_USER_PAGES, UNASSIGNED_USER } from '../src/index';
import { cleanPlanFilter, planJql, PlanFilterError, MAX_FILTER_LENGTH } from '../src/domain/plan-filter';
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
const s0 = weeks[5].startDate;
const TASK = { id: '10001', name: 'Task', hierarchyLevel: 0 };
// TEST-1 and TEST-2 have component A; TEST-3 has none.
const COMPONENT: Record<number, string> = { 1: 'A', 2: 'A' };
const issue = (n: number) => ({ id: String(n), key: `TEST-${n}`, fields: { summary: `T${n}`, issuetype: TASK, status: { statusCategory: { key: 'new' } }, duedate: null } });

let storage: MemStorage;
// The answer of Jira's strict JQL parse: its HTTP status and body.
let parseStatus: number;
let parseBody: any;
let countStatus: number;

const searches = () => mockRequestJira.mock.calls.map(([u]) => String(u)).filter(u => u.startsWith('/rest/api/3/search/jql') || u.startsWith('/rest/api/3/jql/parse'));
const parses = () => mockRequestJira.mock.calls.filter(([u]) => String(u) === '/rest/api/3/jql/parse?validation=strict').map(([, o]) => JSON.parse(o.body).queries);
const countBodies = () => mockRequestJira.mock.calls.filter(([u]) => String(u) === '/rest/api/3/search/approximate-count').map(([, o]) => JSON.parse(o.body).jql);

beforeEach(() => {
  storage = new MemStorage();
  setGlobalStorageProvider(storage);
  setSleepForTests(async () => undefined);
  parseStatus = 200;
  parseBody = null;
  countStatus = 200;
  mockRequestJira.mockReset();
  mockRequestJira.mockImplementation(async (r: any, o?: any) => {
    const url = String(r);
    const ok = (status: number, body: any = {}) => ({ status, json: async () => body });
    if (url === '/rest/api/3/search/approximate-count') return ok(countStatus, { count: JSON.parse(o.body).jql.includes('component') ? 2 : 3 });
    if (url.includes('/search/jql') && url.includes('Epic')) return ok(200, { issues: [], isLast: true });
    if (url === '/rest/api/3/jql/parse?validation=strict') {
      return ok(parseStatus, parseBody ?? { queries: [{ query: JSON.parse(o.body).queries[0], errors: [] }] });
    }
    if (url.includes('/search/jql')) {
      const filtered = url.includes('AND (component = "A")');
      return ok(200, { issues: [1, 2, 3].filter(n => !filtered || COMPONENT[n] === 'A').map(issue), isLast: true });
    }
    if (o?.method === 'PUT') return ok(204);
    if (/\/rest\/api\/3\/issue\/TEST-\d+\?fields=project/.test(url)) return ok(200, { id: url.match(/TEST-(\d+)/)![1], fields: { project: { key: 'TEST', id: 'TEST' } } });
    return ok(200, {});
  });
});

describe('cleanPlanFilter: the text can only narrow the project', () => {
  it('keeps a plain filter, trimmed, and treats an empty filter as none', () => {
    expect(cleanPlanFilter('  component = "A"  ')).toBe('component = "A"');
    expect(cleanPlanFilter('')).toBe('');
    expect(cleanPlanFilter('   ')).toBe('');
    expect(cleanPlanFilter(undefined)).toBe('');
    expect(cleanPlanFilter(null)).toBe('');
  });

  it('accepts parentheses and ORDER BY inside quoted strings, and escaped quotes', () => {
    expect(cleanPlanFilter('summary ~ "a)" OR (labels = x)')).toBe('summary ~ "a)" OR (labels = x)');
    expect(cleanPlanFilter('summary ~ \'order by\'')).toBe('summary ~ \'order by\'');
    expect(cleanPlanFilter('summary ~ "say \\"hi\\" ("')).toBe('summary ~ "say \\"hi\\" ("');
  });

  it('refuses text that could change the project clause or the order', () => {
    const no = (text: unknown, message: string) => expect(() => cleanPlanFilter(text)).toThrow(message);
    no(42, 'must be JQL text');
    no('a'.repeat(MAX_FILTER_LENGTH + 1), 'longer than');
    no('labels = x\nOR project = OTHER', 'one line');
    no('summary ~ "open', 'quote that is not closed');
    no('labels = x ORDER BY rank', 'ORDER BY');
    no('labels = x) OR (project = OTHER', 'closes a parenthesis');
    no('(labels = x', 'opens a parenthesis');
    expect(() => cleanPlanFilter(')(')).toThrow(PlanFilterError);
  });

  it('planJql adds the filter to the project clause in parentheses', () => {
    expect(planJql('TEST')).toBe('project = "TEST"');
    expect(planJql('TEST', 'labels = x OR labels = y')).toBe('project = "TEST" AND (labels = x OR labels = y)');
  });
});

describe('fetchRawIssues and testPlanFilter', () => {
  it('searches the project with the filter, and counts with the same JQL when the read is cut short', async () => {
    let page = 0;
    mockRequestJira.mockImplementation(async (r: any, o?: any) => {
      const url = String(r);
      if (url === '/rest/api/3/search/approximate-count') return { status: 200, json: async () => ({ count: 5000 }) };
      page++;
      return { status: 200, json: async () => ({ issues: [issue(page)], isLast: false, nextPageToken: `t${page}` }) };
    });
    const raw = await fetchRawIssues('TEST', [], 'component = "A"');
    expect(searches()[0]).toContain('jql=project = "TEST" AND (component = "A") order by created desc&');
    expect(searches()).toHaveLength(MAX_PAGES);
    expect(countBodies()).toEqual(['project = "TEST" AND (component = "A")']);
    expect(raw.truncated).toEqual({ shown: MAX_PAGES, total: 5000 });
  });

  it('without a filter the search is the project, as before', async () => {
    await fetchRawIssues('TEST');
    expect(searches()[0]).toContain('jql=project = "TEST" order by created desc&');
  });

  it('testPlanFilter asks Jira\'s strict JQL parser, then counts; it returns Jira\'s own messages, or a plain message when Jira does not answer', async () => {
    expect(await testPlanFilter('TEST', 'component = "A"')).toEqual({ ok: true, count: 2 });
    expect(parses()).toEqual([['project = "TEST" AND (component = "A")']]);
    countStatus = 500;
    expect(await testPlanFilter('TEST', 'component = "A"')).toEqual({ ok: true });
    // Jira's search answers an unknown field with no issues; the strict parser names the error.
    parseBody = { queries: [{ query: 'q', errors: ['Field \'compnent\' does not exist or you do not have permission to view it.'] }] };
    expect(await testPlanFilter('TEST', 'compnent = A')).toEqual({ ok: false, message: 'Jira did not accept the filter: Field \'compnent\' does not exist or you do not have permission to view it.' });
    parseStatus = 400;
    parseBody = { errorMessages: ['Bad request.'], errors: { queries: 'Bad JQL.' } };
    expect(await testPlanFilter('TEST', 'x = y')).toEqual({ ok: false, message: 'Jira did not accept the filter: Bad request. Bad JQL.' });
    parseBody = { };
    expect(await testPlanFilter('TEST', 'x = y')).toEqual({ ok: false, message: 'Jira did not accept the filter (HTTP 400).' });
    mockRequestJira.mockImplementationOnce(async () => ({ status: 403, json: async () => { throw new Error('not json'); } }));
    expect(await testPlanFilter('TEST', 'x = y')).toEqual({ ok: false, message: 'Jira did not accept the filter (HTTP 403).' });
    mockRequestJira.mockImplementation(async () => { throw new Error('network'); });
    expect(await testPlanFilter('TEST', 'x = y')).toEqual({ ok: false, message: 'Jira did not answer. Try again.' });
  });
});

describe('setPlanFilter: a plan approver narrows a plan', () => {
  it('is a plan-approver resolver', () => {
    expect(RESOLVER_RULES.setPlanFilter).toBe('plan-approver');
  });

  it('saves a filter Jira accepts; the plan then reads only matching issues and names the filter', async () => {
    const res = await setPlanFilter({ projectKey: 'TEST', filter: ' component = "A" ' }, storage);
    expect(res).toEqual({ ok: true, filter: 'component = "A"', count: 2 });
    expect((await new PlanStore(storage, 'TEST', 'TEST').getSettings()).jqlFilter).toBe('component = "A"');
    const plan = await getProjectPlan('TEST', storage);
    expect(plan.jqlFilter).toBe('component = "A"');
    expect([...plan.tasks, ...(plan.backlogTasks || [])].map(t => t.key).sort()).toEqual(['TEST-1', 'TEST-2']);
  });

  it('a record outside the filter is not listed as stale', async () => {
    await new PlanStore(storage, 'TEST', 'TEST').putEntry('TEST-3', '3', { startDate: s0 } as any);
    expect((await getProjectPlan('TEST', storage)).staleEntries).toEqual([]);
    await setPlanFilter({ projectKey: 'TEST', filter: 'component = "A"' }, storage);
    const plan = await getProjectPlan('TEST', storage);
    expect(plan.staleEntries).toEqual([]);
    expect([...plan.tasks, ...(plan.backlogTasks || [])].map(t => t.key)).not.toContain('TEST-3');
  });

  it('a write reads Jira with the filter of its plan', async () => {
    await getProjectPlan('TEST', storage); // the one-time record migration reads the whole project
    await setPlanFilter({ projectKey: 'TEST', filter: 'component = "A"' }, storage);
    mockRequestJira.mockClear();
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { summary: 'Renamed' } }, storage);
    // The plan's issue reads (the epic picker still lists every epic of the project).
    const reads = searches().filter(u => u.includes('properties=cascadeplan.dates'));
    expect(reads.length).toBeGreaterThan(0);
    for (const u of reads) expect(u).toContain('AND (component = "A")');
  });

  it('each plan has its own filter', async () => {
    const created: any = await createProjectPlan({ projectKey: 'TEST', name: 'Payments' }, storage);
    await setPlanFilter({ projectKey: 'TEST', planId: created.plan.id, filter: 'component = "A"' }, storage);
    expect((await getProjectPlan('TEST', storage)).jqlFilter).toBeUndefined();
    expect((await getProjectPlan('TEST', storage, new Date(), undefined, undefined, undefined, created.plan.id)).jqlFilter).toBe('component = "A"');
  });

  it('an empty filter removes it', async () => {
    await setPlanFilter({ projectKey: 'TEST', filter: 'component = "A"' }, storage);
    mockRequestJira.mockClear();
    expect(await setPlanFilter({ projectKey: 'TEST', filter: '' }, storage)).toEqual({ ok: true, filter: '', count: undefined });
    expect(searches()).toEqual([]); // no Jira check for an empty filter
    expect((await getProjectPlan('TEST', storage)).jqlFilter).toBeUndefined();
  });

  it('refuses bad text before asking Jira, and keeps the old filter when Jira refuses the new one', async () => {
    await setPlanFilter({ projectKey: 'TEST', filter: 'component = "A"' }, storage);
    mockRequestJira.mockClear();
    expect(await setPlanFilter({ projectKey: 'TEST', filter: 'x) OR (project = OTHER' }, storage))
      .toEqual({ ok: false, error: 'validation', message: 'The filter closes a parenthesis that it did not open.' });
    expect(searches()).toEqual([]);
    parseBody = { queries: [{ query: 'q', errors: ['Bad JQL.'] }] };
    expect(await setPlanFilter({ projectKey: 'TEST', filter: 'nofield = 1' }, storage))
      .toEqual({ ok: false, error: 'jql', message: 'Jira did not accept the filter: Bad JQL.' });
    expect((await new PlanStore(storage, 'TEST', 'TEST').getSettings()).jqlFilter).toBe('component = "A"');
  });

  it('refuses a plan that does not exist', async () => {
    await expect(setPlanFilter({ projectKey: 'TEST', planId: 'nope', filter: 'labels = x' }, storage)).rejects.toThrow('no longer exists');
  });
});

describe('fetchProjectUsers: assignable users are read in pages', () => {
  const users = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ accountId: `acc-${from + i}`, displayName: `User ${from + i}` }));
  const userCalls = () => mockRequestJira.mock.calls.map(([u]) => String(u)).filter(u => u.includes('/user/assignable/search'));

  it('reads pages until a short page, and lists every user once after Unassigned', async () => {
    mockRequestJira.mockImplementation(async (r: any) => {
      const startAt = Number(String(r).match(/startAt=(\d+)/)![1]);
      return { status: 200, json: async () => startAt < 2 * USER_PAGE_SIZE ? users(startAt, USER_PAGE_SIZE) : [...users(startAt, 3), ...users(0, 1)] };
    });
    const list = await fetchProjectUsers('TEST');
    expect(userCalls()).toHaveLength(3);
    expect(userCalls()[1]).toContain(`startAt=${USER_PAGE_SIZE}&maxResults=${USER_PAGE_SIZE}`);
    expect(list).toHaveLength(1 + 2 * USER_PAGE_SIZE + 3);
    expect(list[0]).toBe(UNASSIGNED_USER);
  });

  it('stops at MAX_USER_PAGES pages, and keeps the pages read before a failed one', async () => {
    let page = 0;
    mockRequestJira.mockImplementation(async () => ({ status: 200, json: async () => users(USER_PAGE_SIZE * page++, USER_PAGE_SIZE) }));
    expect(await fetchProjectUsers('TEST')).toHaveLength(1 + MAX_USER_PAGES * USER_PAGE_SIZE);
    expect(userCalls()).toHaveLength(MAX_USER_PAGES);
    mockRequestJira.mockReset();
    page = 0;
    mockRequestJira.mockImplementation(async () => (page++ === 0 ? { status: 200, json: async () => users(0, USER_PAGE_SIZE) } : { status: 500, json: async () => ({}) }));
    expect(await fetchProjectUsers('TEST')).toHaveLength(1 + USER_PAGE_SIZE);
  });
});
