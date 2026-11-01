/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: every write resolver returns { ok, jiraSync: { ok, error, writes } } (B-07, INV-05).
 */

import {
  updateWbsTask,
  scheduleBacklogTask,
  unscheduleTask,
  createInlineTask,
  createSubtaskForResource,
  saveTaskDependency,
  saveColumnWidths,
  setGlobalStorageProvider,
  getTimelineWeeks,
  SyncLog
} from '../src/index';
import { MemStorage, entryOf } from './helpers/mem-storage';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({ requestJira: mockRequestJira }),
    asUser: () => ({ requestJira: mockRequestJira })
  },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));


const weeks = getTimelineWeeks().weeks;
let failPutFor: string | null = null;

describe('Jira sync report (B-07)', () => {
  let storage: MemStorage;

  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    failPutFor = null;
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (routeStr: any, options?: any) => {
      const url = String(routeStr);
      const method = options?.method || 'GET';
      const lookup = url.match(/\/rest\/api\/3\/issue\/([A-Z0-9_]+)-(\d+)\?fields=project/);
      if (lookup) return { status: 200, json: async () => ({ fields: { project: { key: lookup[1] } } }) };
      if (url.includes('/search/jql')) {
        return { status: 200, json: async () => ({ issues: ['TEST-1', 'TEST-2'].map((k, i) => ({ id: String(i + 1), key: k,
          fields: { summary: k, issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } } } })) }) };
      }
      if (method === 'PUT' && failPutFor && url.endsWith(`/issue/${failPutFor}`)) {
        return { status: 400, json: async () => ({ errorMessages: [], errors: { duedate: 'Field duedate cannot be set. It is not on the appropriate screen.' } }) };
      }
      if (method === 'POST' && url.endsWith('/rest/api/3/issue')) return { status: 400, json: async () => ({ errorMessages: ['Issue type is required'] }) };
      return { status: 204, json: async () => ({}) };
    });
    await storage.set('scheduleMap:TEST', {
      'TEST-1': { startWeek: weeks[4].weekKey, spanWeeks: 2, startDate: weeks[4].startDate, endDate: weeks[5].endDate },
      'TEST-2': { startWeek: weeks[4].weekKey, spanWeeks: 1, startDate: weeks[4].startDate, endDate: weeks[4].endDate,
        dependency: { predecessorKey: 'TEST-1', predecessorId: 'TEST-1', triggerPercent: 100, isTriggerSatisfied: false } }
    });
  });

  it('a successful update reports ok with the Jira write it made', async () => {
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { summary: 'Renamed' } });
    expect(res.ok).toBe(true);
    expect(res.jiraSync).toEqual({ ok: true, writes: [{ key: 'TEST-1', fields: ['summary'], ok: true }] });
    expect(res.tasks).toBeDefined();
  });

  it('a Jira rejection is reported with the Jira error text', async () => {
    failPutFor = 'TEST-1';
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { endDate: weeks[6].endDate, startDate: weeks[4].startDate } });
    expect(res.ok).toBe(true);
    expect(res.jiraSync.ok).toBe(false);
    expect(res.jiraSync.error).toContain('Field duedate cannot be set');
    // TEST-2 (a 100% successor) also moves; the report lists each write by key.
    expect(res.jiraSync.writes).toContainEqual({ key: 'TEST-1', fields: ['duedate'], ok: false, error: expect.stringContaining('duedate') });
  });

  it('a failed write to a cascaded successor is reported by key', async () => {
    failPutFor = 'TEST-2';
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startWeek: weeks[6].weekKey } });
    expect(res.jiraSync.ok).toBe(false);
    expect(res.jiraSync.writes.find((w: any) => w.key === 'TEST-2').ok).toBe(false);
    expect(res.jiraSync.writes.find((w: any) => w.key === 'TEST-1').ok).toBe(true);
  });

  it('scheduling reports its due date write', async () => {
    const res: any = await scheduleBacklogTask({ projectKey: 'TEST', taskId: 'TEST-2', startWeek: weeks[5].weekKey });
    expect(res.ok).toBe(true);
    expect(res.jiraSync).toEqual({ ok: true, writes: [{ key: 'TEST-2', fields: ['duedate'], ok: true }] });
  });

  it('KVS-only writes report ok with no Jira writes', async () => {
    const res: any = await unscheduleTask({ projectKey: 'TEST', taskId: 'TEST-2' });
    expect(res.ok).toBe(true);
    expect(res.jiraSync).toEqual({ ok: true, writes: [] });
    const widths: any = await saveColumnWidths({ projectKey: 'TEST', columnWidths: { epic: 100 } as any });
    expect(widths.ok).toBe(true);
    expect(widths.jiraSync).toEqual({ ok: true, writes: [] });
  });

  it('a failed create reports ok false with the Jira error', async () => {
    const res: any = await createInlineTask({ projectKey: 'TEST', summary: 'X' });
    expect(res.ok).toBe(false);
    expect(res.success).toBe(false);
    expect(res.jiraSync.ok).toBe(false);
    expect(res.jiraSync.error).toContain('Issue type is required');
    const sub: any = await createSubtaskForResource({ projectKey: 'TEST', parentKey: 'TEST-1' });
    expect(sub.ok).toBe(false);
    expect(sub.jiraSync.ok).toBe(false);
  });

  it('saveTaskDependency reports the link write', async () => {
    const res: any = await saveTaskDependency({ projectKey: 'TEST', taskId: 'TEST-2', dependency: { predecessorId: 'TEST-1', predecessorKey: 'TEST-1', triggerPercent: 30, isTriggerSatisfied: false } });
    expect(res.ok).toBe(true);
    expect(res.jiraSync.writes[0]).toEqual({ key: 'TEST-2', fields: ['issuelink'], ok: false, error: 'Jira did not create the link' });
    expect(res.jiraSync.ok).toBe(false);
  });

  it('SyncLog summarises writes', () => {
    const log = new SyncLog();
    expect(log.report()).toEqual({ ok: true, writes: [] });
    log.record('A-1', ['summary'], { synced: true });
    log.record('A-2', [], { synced: true });
    log.record('A-3', ['duedate'], { synced: false, error: 'bad' });
    log.record('A-4', ['duedate'], { synced: false });
    expect(log.report()).toEqual({ ok: false, error: 'A-3: bad; A-4: Jira rejected the change', writes: [
      { key: 'A-1', fields: ['summary'], ok: true },
      { key: 'A-3', fields: ['duedate'], ok: false, error: 'bad' },
      { key: 'A-4', fields: ['duedate'], ok: false, error: 'Jira rejected the change' }
    ] });
  });
});
