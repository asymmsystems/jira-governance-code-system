/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/** F-29: weeks start on Monday in UTC; old week keys never place a bar; "today" is the user's local date. */
import { PlannerEngine } from '../src/domain/planner-engine';
import { getProjectPlan, setGlobalStorageProvider, clientTodayOf, withClientToday, moveTaskGroup } from '../src/index';
import { PlanStore } from '../src/storage/plan-store';
import { MemStorage } from './helpers/mem-storage';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asApp: () => ({ requestJira: mockRequestJira }), asUser: () => ({ requestJira: mockRequestJira }) },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

describe('week grid (F-29)', () => {
  it('weeks start on Monday, for any day of the week and any time of day in UTC', () => {
    for (const ref of ['2026-11-02T00:00:00Z', '2026-11-05T12:00:00Z', '2026-11-08T23:59:00Z']) {
      const { weeks, currentWeekIndex } = PlannerEngine.generateDynamicWeeks(new Date(ref), 2, 2);
      expect(weeks[currentWeekIndex]).toMatchObject({ startDate: '2026-11-02', endDate: '2026-11-08', weekKey: '02-Nov', isCurrentWeek: true });
      for (const w of weeks) expect(new Date(`${w.startDate}T00:00:00Z`).getUTCDay()).toBe(1);
    }
    expect(PlannerEngine.generateDynamicWeeks(new Date('2026-11-09T00:30:00Z'), 0, 0).weeks[0].startDate).toBe('2026-11-09');
  });

  it('a record with week keys of the old Wednesday grid shows the same dates, on the Monday grid', async () => {
    const storage = new MemStorage();
    setGlobalStorageProvider(storage);
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (r: any) => {
      const url = String(r);
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [] : [{ id: '1', key: 'T-1', fields: { summary: 'A', issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } } } }], isLast: true }) };
      return { status: 200, json: async () => ({}) };
    });
    const monday = (() => { const d = new Date(); const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); return new Date(s.getTime() - ((s.getUTCDay() + 6) % 7) * 86400000); })();
    const iso = (n: number) => new Date(monday.getTime() + n * 86400000).toISOString().slice(0, 10);
    await new PlanStore(storage, 'T', 'T').saveSettings({ migratedAt: '2026-01-01', modelVersion: 2 });
    // Stored by the Wednesday grid: start and end keys of a Wednesday week, dates Thursday to Tuesday.
    await new PlanStore(storage, 'T', 'T').putEntry('T-1', '1', { startWeek: '99-Wed', endWeek: '99-Wed', spanWeeks: 1, startDate: iso(3), endDate: iso(8) } as any);
    const t1 = (await getProjectPlan('T', storage)).tasks.find(t => t.key === 'T-1')!;
    expect(t1).toMatchObject({ startDate: iso(3), endDate: iso(8), spanWeeks: 2 });
    expect(t1.startWeek).not.toBe('99-Wed');
  });

  it('the user\'s local date is accepted within one day of the server UTC date, else ignored', async () => {
    const now = new Date('2026-11-05T19:00:00Z'); // 00:30 on 6 Nov in UTC+5:30
    expect(clientTodayOf('2026-11-06', now)).toBe('2026-11-06');
    expect(clientTodayOf('2026-11-04', now)).toBe('2026-11-04');
    expect(clientTodayOf('2026-11-08', now)).toBeUndefined();
    expect(clientTodayOf('6 Nov', now)).toBeUndefined();
    expect(clientTodayOf(undefined, now)).toBeUndefined();
    // Inside a request, the client date is "today" (here: an unknown task fails the same way, the scope just runs).
    await expect(withClientToday('2026-11-06', async () => 'ran')).resolves.toBe('ran');
    await expect(withClientToday(new Date().toISOString().slice(0, 10), () => moveTaskGroup({ projectKey: 'T', taskId: 'T-404', days: 1 }, new MemStorage()))).rejects.toThrow();
  });
});
