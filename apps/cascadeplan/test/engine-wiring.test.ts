/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the schedule engine wired into the resolvers (B-11).
 */

import { getProjectPlan, previewCascade, updateWbsTask, gridFor, setGlobalStorageProvider, setSleepForTests, getTimelineWeeks } from '../src/index';
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
const issue = (n: number) => ({ id: String(n), key: `TEST-${n}`, fields: { summary: `T${n}`, issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } } } });

describe('engine wiring (B-11)', () => {
  let storage: MemStorage;

  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    setSleepForTests(async () => undefined);
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (url: string) => String(url).includes('/search/jql') && !String(url).includes('Epic')
      ? { status: 200, json: async () => ({ issues: [issue(1), issue(2), issue(3)], isLast: true }) }
      : { status: 200, json: async () => [] });
    await storage.set('scheduleMap:TEST', {
      'TEST-1': { startWeek: weeks[5].weekKey, spanWeeks: 2, startDate: weeks[5].startDate, endDate: weeks[6].endDate },
      'TEST-2': { startWeek: weeks[5].weekKey, spanWeeks: 1, startDate: weeks[5].startDate, endDate: weeks[5].endDate,
        dependency: { predecessorKey: 'TEST-1', predecessorId: 'TEST-1', triggerPercent: 100, isTriggerSatisfied: false } },
      'TEST-3': { startWeek: weeks[5].weekKey, spanWeeks: 1, startDate: weeks[5].startDate, endDate: weeks[5].endDate,
        dependency: { predecessorKey: 'TEST-99', predecessorId: 'TEST-99', triggerPercent: 30, isTriggerSatisfied: false } }
    });
  });

  it('a plan load gives each dependency its earliest start, reason, driver and fix', async () => {
    const plan = await getProjectPlan('TEST', storage);
    const d2 = plan.tasks.find(t => t.key === 'TEST-2')!.dependency!;
    expect(d2.isViolated).toBe(true);
    expect(d2.driverKey).toBe('TEST-1');
    expect(d2.earliestStartReason).toMatch(/^Starts \d{4}-\d{2}-\d{2} because TEST-1 reaches 100% on /);
    expect(d2.fixSuggestion).toMatch(/^Move TEST-2 to \d{4}-\d{2}-\d{2}/);
    expect(d2.violationReason).toBe(d2.fixSuggestion);
    const d3 = plan.tasks.find(t => t.key === 'TEST-3')!.dependency!;
    expect(d3).toMatchObject({ isViolated: true, violationReason: 'Predecessor TEST-99 is not on the plan.' });
  });

  it('previewCascade shifts by whole weeks (keeping days) and by span, and lists the moves with reasons', async () => {
    const moved: any = await previewCascade({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startWeek: weeks[6].weekKey } });
    expect(moved.changes.map((c: any) => c.key)).toEqual(['TEST-2']);
    const longer: any = await previewCascade({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startWeek: weeks[5].weekKey, spanWeeks: 3 } });
    expect(longer.changes[0].reason).toContain('TEST-1 reaches 100%');
    const byDate: any = await previewCascade({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: weeks[5].startDate, endDate: weeks[7].endDate } });
    expect(byDate.changes[0].to > longer.changes[0].from).toBe(true);
  });

  it('a form save with only one date keeps the other date of the task', async () => {
    await getProjectPlan('TEST', storage);
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { endDate: weeks[7].endDate } });
    expect(await entryOf(storage, 'TEST-1')).toMatchObject({ startDate: weeks[5].startDate, endDate: weeks[7].endDate });
    await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: weeks[6].startDate } });
    expect(await entryOf(storage, 'TEST-1')).toMatchObject({ startDate: weeks[6].startDate, endDate: weeks[7].endDate });
  });

  it('gridFor clamps dates outside the window to its edges for display only', () => {
    expect(gridFor(weeks, '2000-01-01', '2000-01-05')).toMatchObject({ startWeek: weeks[0].weekKey, spanWeeks: 1 });
    expect(gridFor(weeks, '2999-01-01', '2999-01-05')).toMatchObject({ startWeek: weeks[weeks.length - 1].weekKey, spanWeeks: 1 });
  });
});
