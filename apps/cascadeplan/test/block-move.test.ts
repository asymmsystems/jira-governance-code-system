/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/** N-05, ADR-003: a task or story moves with its sub-tasks as one block; DEC-6 for its due date. */
import { planBlockMove, rollUpAfter, blockState } from '../src/domain/block-move';
import { getProjectPlan, moveTaskGroup, continueBlockMove, updateWbsTask, setGlobalStorageProvider, setSleepForTests, getTimelineWeeks, expandParentCascades } from '../src/index';
import { setPermissionCheckerForTests, allowAllPermissions } from '../src/security/write-permissions';
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

const weeks = getTimelineWeeks().weeks;
const add = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
const today = new Date().toISOString().slice(0, 10);

describe('planBlockMove (ADR-003 rules)', () => {
  it('the ADR example: done stays, in progress keeps its start, not started moves', () => {
    const r = planBlockMove([
      { key: 'D-30', startDate: '2026-10-27', endDate: '2026-10-31', status: 'COMPLETED' },
      { key: 'D-29', startDate: '2026-11-03', endDate: '2026-11-10', status: 'IN_PROGRESS' },
      { key: 'D-28', startDate: '2026-11-11', endDate: '2026-11-14', status: 'NOT_STARTED' },
      { key: 'D-27', status: 'NOT_STARTED' }
    ], 7, '2026-11-05');
    expect(r.changes).toEqual([
      { key: 'D-29', state: 'in-progress', fromStart: '2026-11-03', fromEnd: '2026-11-10', toStart: '2026-11-03', toEnd: '2026-11-17' },
      { key: 'D-28', state: 'not-started', fromStart: '2026-11-11', fromEnd: '2026-11-14', toStart: '2026-11-18', toEnd: '2026-11-21' }
    ]);
    expect(r.fixed.map(f => [f.key, f.state])).toEqual([['D-30', 'done'], ['D-27', 'undated']]);
    expect(rollUpAfter([
      { key: 'D-30', startDate: '2026-10-27', endDate: '2026-10-31' }, { key: 'D-29', startDate: '2026-11-03', endDate: '2026-11-10' },
      { key: 'D-28', startDate: '2026-11-11', endDate: '2026-11-14' }], r.changes)).toEqual({ startDate: '2026-10-27', endDate: '2026-11-21' });
  });

  it('a sub-task with no end moves as one day; an in-progress end never moves before its start; roll-ups skip undated items', () => {
    expect(planBlockMove([{ key: 'B-1', startDate: '2026-11-02' }], 7, '2026-11-01').changes[0]).toMatchObject({ fromEnd: '2026-11-02', toStart: '2026-11-09', toEnd: '2026-11-09' });
    expect(planBlockMove([{ key: 'B-2', startDate: '2026-11-10', endDate: '2026-11-12', status: 'IN_PROGRESS' }], -10, '2026-11-01').changes[0]).toMatchObject({ toStart: '2026-11-10', toEnd: '2026-11-10' });
    expect(rollUpAfter([{ key: 'U' }, { key: 'D', startDate: '2026-11-02' }], [])).toEqual({ startDate: '2026-11-02', endDate: '2026-11-02' });
    expect(rollUpAfter([{ key: 'U' }], [])).toBeNull();
  });

  it('an in-progress end never moves before today or its start; a not-started bar may move into the past', () => {
    const r = planBlockMove([
      { key: 'A-1', startDate: '2026-11-01', endDate: '2026-11-08', progress: 20, status: 'IN_PROGRESS' },
      { key: 'A-2', startDate: '2026-11-06', endDate: '2026-11-07' }
    ], -14, '2026-11-05');
    expect(r.changes).toEqual([
      { key: 'A-1', state: 'in-progress', fromStart: '2026-11-01', fromEnd: '2026-11-08', toStart: '2026-11-01', toEnd: '2026-11-05' },
      { key: 'A-2', state: 'not-started', fromStart: '2026-11-06', fromEnd: '2026-11-07', toStart: '2026-10-23', toEnd: '2026-10-24' }
    ]);
    expect(planBlockMove([{ key: 'A-3', startDate: '2026-11-01', endDate: '2026-11-05', status: 'IN_PROGRESS' }], -3, '2026-11-05').fixed[0].state).toBe('in-progress');
    expect(blockState({ key: 'x', startDate: '2026-11-01', progress: 0 })).toBe('not-started');
  });

  it('the state comes from the Jira status only: progress alone never starts or finishes an item (2026-11-06)', () => {
    expect(blockState({ key: 'x', startDate: '2026-11-01', progress: 40, status: 'NOT_STARTED' })).toBe('not-started');
    expect(blockState({ key: 'x', startDate: '2026-11-01', progress: 100, status: 'IN_PROGRESS' })).toBe('in-progress');
    expect(blockState({ key: 'x', startDate: '2026-11-01', progress: 0, status: 'COMPLETED' })).toBe('done');
  });
});

describe('expandParentCascades (N-06 rule 2)', () => {
  const tasks: any[] = [
    { key: 'P', startDate: '2026-11-02', endDate: '2026-11-13', datesFromChildren: true, hierarchyLevel: 0 },
    { key: 'S1', parentKey: 'P', startDate: '2026-11-02', endDate: '2026-11-06', status: 'NOT_STARTED' },
    { key: 'S2', parentKey: 'P', startDate: '2026-11-09', endDate: '2026-11-13', status: 'COMPLETED' },
    { key: 'E', startDate: '2026-11-02', endDate: '2026-11-20', datesFromChildren: true, isEpic: true, hierarchyLevel: 1 },
    { key: 'L', startDate: '2026-11-02', endDate: '2026-11-04' }
  ];
  it('turns a parent change into its block, keeps leaf changes, and returns epics unmoved', () => {
    const r = expandParentCascades([
      { key: 'P', toStart: '2026-11-09', toEnd: '2026-11-20' },
      { key: 'E', toStart: '2026-11-09', toEnd: '2026-11-27' },
      { key: 'L', toStart: '2026-11-05', toEnd: '2026-11-07' }
    ], tasks, '2026-11-05');
    expect(r.changes).toEqual([{ key: 'S1', toStart: '2026-11-09', toEnd: '2026-11-13' }, { key: 'L', toStart: '2026-11-05', toEnd: '2026-11-07' }]);
    expect(r.epics).toEqual(['E']);
  });
  it('never changes an excluded key (the task the user moved)', () => {
    const r = expandParentCascades([{ key: 'P', toStart: '2026-11-09', toEnd: '2026-11-20' }], tasks, '2026-11-05', new Set(['S1']));
    expect(r.changes).toEqual([]);
  });
});

describe('moveTaskGroup (N-05)', () => {
  const s0 = weeks[5].startDate;
  let storage: MemStorage;
  let jiraDue: Record<string, string>;
  let refuseDue: string | null;
  const cat: Record<string, string> = {};
  const type = { task: { name: 'Task', hierarchyLevel: 0 }, sub: { name: 'Subtask', hierarchyLevel: -1, subtask: true }, epic: { name: 'Epic', hierarchyLevel: 1 } };
  const issue = (n: number, t: any, parent?: number) => ({ id: String(n), key: `TEST-${n}`, fields: {
    summary: `T${n}`, issuetype: t, status: { statusCategory: { key: cat[`TEST-${n}`] || 'new' } }, duedate: jiraDue[`TEST-${n}`] || null,
    ...(parent ? { parent: { id: String(parent), key: `TEST-${parent}`, fields: { summary: `T${parent}`, issuetype: n === 1 ? type.epic : type.task } } } : {})
  } });
  // TEST-1 task with sub-tasks 11 (not started), 12 (in progress), 13 (done), 14 (undated); TEST-5 depends on TEST-1.
  const issues = () => [issue(1, type.task), issue(11, type.sub, 1), issue(12, type.sub, 1), issue(13, type.sub, 1), issue(14, type.sub, 1), issue(5, type.task),
    issue(20, type.epic), { ...issue(21, type.task), fields: { ...issue(21, type.task).fields, parent: { id: '20', key: 'TEST-20', fields: { summary: 'T20', issuetype: type.epic } } } }];
  const fieldPuts = (key: string) => mockRequestJira.mock.calls.filter(([u, o]) => o?.method === 'PUT' && String(u) === `/rest/api/3/issue/${key}`).map(([, o]) => JSON.parse(o.body).fields);
  const entry = async (key: string): Promise<any> => (await new PlanStore(storage, 'TEST', 'TEST').loadEntries()).get(key);

  beforeEach(async () => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    setSleepForTests(async () => undefined);
    jiraDue = {};
    refuseDue = null;
    Object.assign(cat, { 'TEST-12': 'indeterminate', 'TEST-13': 'done' });
    mockRequestJira.mockReset();
    mockRequestJira.mockImplementation(async (r: any, opts?: any) => {
      const url = String(r);
      const put = opts?.method === 'PUT' ? url.match(/^\/rest\/api\/3\/issue\/(TEST-\d+)$/) : null;
      if (put) {
        const fields = JSON.parse(opts.body).fields || {};
        if (put[1] === refuseDue && fields.duedate) return { status: 400, json: async () => ({ errors: { duedate: 'Field duedate cannot be set.' } }) };
        if (fields.duedate) jiraDue[put[1]] = fields.duedate;
        return { status: 204, json: async () => ({}) };
      }
      if (/\/rest\/api\/3\/issue\/TEST-\d+\?fields=project/.test(url)) return { status: 200, json: async () => ({ id: url.match(/TEST-(\d+)/)![1], fields: { project: { key: 'TEST', id: 'TEST' } } }) };
      const one = url.match(/jql=key\+%3D\+(TEST-\d+)/);
      if (url.includes('/search/jql') && one) return { status: 200, json: async () => ({ issues: issues().filter(i => i.key === one[1]), isLast: true }) };
      if (url.includes('/search/jql')) return { status: 200, json: async () => ({ issues: url.includes('Epic') ? [issue(20, type.epic)] : issues(), isLast: true }) };
      return { status: 204, json: async () => ({}) };
    });
    const w = weeks[5].weekKey;
    await storage.set('scheduleMap:TEST', {
      'TEST-11': { startWeek: w, spanWeeks: 1, startDate: add(s0, 3), endDate: add(s0, 5) },
      'TEST-12': { startWeek: w, spanWeeks: 1, startDate: add(s0, 0), endDate: add(s0, 4) },
      'TEST-13': { startWeek: w, spanWeeks: 1, startDate: add(s0, -7), endDate: add(s0, -3) },
      'TEST-21': { startWeek: w, spanWeeks: 1, startDate: add(s0, 1), endDate: add(s0, 2) },
      'TEST-5': { startWeek: w, spanWeeks: 1, startDate: add(s0, 6), endDate: add(s0, 8), dependency: { predecessorKey: 'TEST-1', predecessorId: '1', triggerPercent: 100, isTriggerSatisfied: false } }
    });
    await getProjectPlan('TEST', storage);
    Object.assign(jiraDue, { 'TEST-1': add(s0, 5), 'TEST-11': add(s0, 5), 'TEST-12': add(s0, 4), 'TEST-13': add(s0, -3), 'TEST-5': add(s0, 8) });
    mockRequestJira.mockClear();
  });

  it('moves the block by 7 days: each sub-task by its state, the parent due date follows, the successor cascades', async () => {
    const res: any = await moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-1', days: 7 }, storage);
    expect(res.ok).toBe(true);
    const plan = await getProjectPlan('TEST', storage);
    const t = (k: string) => [...plan.tasks, ...(plan.backlogTasks || [])].find(x => x.key === k)!;
    expect(t('TEST-11')).toMatchObject({ startDate: add(s0, 10), endDate: add(s0, 12) });
    // In progress: start kept; the end moves 7 days (or to today, whichever is later).
    const ipEnd = add(s0, 11) < today ? today : add(s0, 11);
    expect(t('TEST-12')).toMatchObject({ startDate: s0, endDate: ipEnd });
    expect(t('TEST-13')).toMatchObject({ startDate: add(s0, -7), endDate: add(s0, -3) });
    expect(t('TEST-14').isBacklog).toBe(true);
    expect(fieldPuts('TEST-13')).toEqual([]);
    expect(fieldPuts('TEST-11')).toEqual([{ duedate: add(s0, 12) }]);
    // DEC-6: the parent's Jira due date is the new roll-up end.
    const end = ipEnd > add(s0, 12) ? ipEnd : add(s0, 12);
    expect(jiraDue['TEST-1']).toBe(end);
    expect(t('TEST-1')).toMatchObject({ endDate: end, datesFromChildren: true });
    // TEST-5 starts after the parent's new end.
    expect(t('TEST-5').startDate > end).toBe(true);
    expect(res.block.fixed.map((f: any) => f.key).sort()).toEqual(['TEST-13', 'TEST-14']);
  });

  it('all or nothing: one sub-task the user may not schedule stops the move before any write', async () => {
    setPermissionCheckerForTests(async (ids, perms) => new Map(perms.map(p => [p, new Set(ids.filter(id => !(p === 'SCHEDULE_ISSUES' && id === '12')))])));
    try {
      const before = await entry('TEST-11');
      const res: any = await moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-1', days: 7 }, storage);
      expect(res.ok).toBe(false);
      expect(res.message).toContain('TEST-12');
      expect(res.message).toContain('Schedule issues');
      expect(await entry('TEST-11')).toEqual(before);
      expect(mockRequestJira.mock.calls.filter(([, o]) => o?.method === 'PUT')).toEqual([]);
    } finally {
      setPermissionCheckerForTests(allowAllPermissions);
    }
  });

  it('all or nothing: a refused due date puts every moved sub-task back, in KVS and in Jira', async () => {
    refuseDue = 'TEST-12';
    const before = await entry('TEST-11');
    const res: any = await moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-1', days: 7 }, storage);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('due_date_refused');
    expect(res.message).toContain('nothing in TEST-1 moved');
    expect((await entry('TEST-11'))).toMatchObject({ startDate: before.startDate, endDate: before.endDate });
    expect(jiraDue['TEST-11']).toBe(add(s0, 5));
    expect(jiraDue['TEST-1']).toBe(add(s0, 5));
  });

  it('a stale version of a sub-task refuses the move with no write', async () => {
    const v = (await entry('TEST-11')).version;
    const res: any = await moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-1', days: 7, expectedVersions: { 'TEST-11': v + 5 } }, storage);
    expect(res.conflict).toBe(true);
    expect(mockRequestJira.mock.calls.filter(([, o]) => o?.method === 'PUT')).toEqual([]);
  });

  it('refuses an epic (DEC-5b), a task without sub-tasks, and a bad day count', async () => {
    const p = await getProjectPlan('TEST', storage);
    expect([...p.tasks, ...(p.backlogTasks || [])].find(x => x.key === 'TEST-20')).toMatchObject({ isEpic: true });
    await expect(moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-20', days: 7 }, storage)).rejects.toThrow('is an epic');
    await expect(moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-5', days: 7 }, storage)).rejects.toThrow('no dated sub-tasks');
    await expect(moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-1', days: 0 }, storage)).rejects.toThrow(ValidationError);
    await expect(moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-1', days: 1.5 as any }, storage)).rejects.toThrow(ValidationError);
    await expect(moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-1', days: 7, expectedVersions: { 'bad key': 1 } as any }, storage)).rejects.toThrow(ValidationError);
  });

  for (const restore of [false, true]) {
    it(`Undo ${restore ? 'with' : 'without'} restore: a successor that broke its link before the action ${restore ? 'gets its exact old dates back' : 'is cascaded again'} (B-14)`, async () => {
      // Before the action TEST-5 starts on s0+2, before its predecessor TEST-1 ends (s0+5).
      const store = new PlanStore(storage, 'TEST', 'TEST');
      const e5: any = await entry('TEST-5');
      await store.putEntry('TEST-5', '5', { ...e5, startDate: add(s0, 2), endDate: add(s0, 4) }, e5.version);
      const moved: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-11', updates: { startDate: add(s0, 4), endDate: add(s0, 7) }, expectedVersion: (await entry('TEST-11')).version }, storage);
      expect(moved.ok).toBe(true);
      // Undo replays the cascaded successor first, then the moved sub-task (the order of the live failure).
      await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-5', updates: { startDate: add(s0, 2), endDate: add(s0, 4) }, expectedVersion: (await entry('TEST-5')).version, restore }, storage);
      await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-11', updates: { startDate: add(s0, 3), endDate: add(s0, 5) }, expectedVersion: (await entry('TEST-11')).version, restore }, storage);
      const t5 = (await getProjectPlan('TEST', storage)).tasks.find(x => x.key === 'TEST-5')!;
      if (restore) expect(t5).toMatchObject({ startDate: add(s0, 2), endDate: add(s0, 4) });
      else expect(t5.startDate > add(s0, 2)).toBe(true);
    });
  }

  it('C3: a move refused when Jira\'s due date changed since the user saw it; the check reads with reconcileIssues', async () => {
    const v = (await entry('TEST-11')).version;
    const res: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-11', updates: { startDate: add(s0, 4), endDate: add(s0, 6) }, expectedVersion: v, expectedDueDate: add(s0, 2) }, storage);
    expect(res).toMatchObject({ ok: false, conflict: true, error: 'due_date_changed' });
    expect(res.message).toContain(`now ${add(s0, 5)}`);
    expect(fieldPuts('TEST-11')).toEqual([]);
    const check = mockRequestJira.mock.calls.map(c => String(c[0])).find(u => u.includes('search/jql') && u.includes('fields=duedate') && u.includes('key+%3D+TEST-11'));
    expect(check).toContain('reconcileIssues=11');
    // The due date the user saw matches: the move goes ahead.
    const ok: any = await updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-11', updates: { startDate: add(s0, 4), endDate: add(s0, 6) }, expectedVersion: v, expectedDueDate: add(s0, 5) }, storage);
    expect(ok.ok).not.toBe(false);
    expect(fieldPuts('TEST-11')).toEqual([{ duedate: add(s0, 6) }]);
    await expect(updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-11', updates: { startDate: add(s0, 4) }, expectedDueDate: 'soon' as any }, storage)).rejects.toThrow(ValidationError);
  });

  it('a block of more than 25 sub-tasks moves 25 in the first call and the rest in continueBlockMove; the last call cascades', async () => {
    // 30 more not-started sub-tasks of TEST-1, each dated.
    const extra = Array.from({ length: 30 }, (_, i) => 100 + i);
    const base = mockRequestJira.getMockImplementation()!;
    const more = extra.map(n => issue(n, type.sub, 1));
    mockRequestJira.mockImplementation(async (r: any, o?: any) => {
      const url = String(r);
      if (url.includes('/search/jql') && !url.includes('Epic') && !url.includes('key+%3D')) return { status: 200, json: async () => ({ issues: [...issues(), ...more.map(m => ({ ...m, fields: { ...m.fields, duedate: jiraDue[m.key] || null } }))], isLast: true }) };
      return base(r, o);
    });
    const store = new PlanStore(storage, 'TEST', 'TEST');
    for (const n of extra) await store.putEntry(`TEST-${n}`, String(n), { startWeek: weeks[5].weekKey, spanWeeks: 1, startDate: add(s0, 3), endDate: add(s0, 5) });
    const first: any = await moveTaskGroup({ projectKey: 'TEST', taskId: 'TEST-1', days: 7 }, storage);
    expect(first.ok).toBe(true);
    // 32 changes (TEST-11, TEST-12 and 30 more): 25 now, 7 left.
    expect(first.blockRemaining).toHaveLength(7);
    expect(first.blockRemaining[0]).toMatchObject({ fromStart: add(s0, 3), toStart: add(s0, 10) });
    const putsBefore = mockRequestJira.mock.calls.filter(([, o]) => o?.method === 'PUT').length;
    // An item that is not a sub-task of TEST-1 is refused.
    await expect(continueBlockMove({ projectKey: 'TEST', taskId: 'TEST-1', items: [{ ...first.blockRemaining[0], key: 'TEST-5' }] }, storage)).rejects.toThrow('not a sub-task');
    const done: any = await continueBlockMove({ projectKey: 'TEST', taskId: 'TEST-1', items: first.blockRemaining, last: true }, storage);
    expect(done.ok).toBe(true);
    const all = [...done.tasks, ...(done.backlogTasks || [])];
    for (const it of first.blockRemaining) expect(all.find((t: any) => t.key === it.key)).toMatchObject({ startDate: it.toStart, endDate: it.toEnd });
    expect(mockRequestJira.mock.calls.filter(([, o]) => o?.method === 'PUT').length).toBeGreaterThan(putsBefore);
    // Running the same items again changes nothing (they no longer have their old dates).
    const again: any = await continueBlockMove({ projectKey: 'TEST', taskId: 'TEST-1', items: first.blockRemaining }, storage);
    expect(again.jiraSync.writes).toEqual([]);
    await expect(continueBlockMove({ projectKey: 'TEST', taskId: 'TEST-1', items: [{ key: 'TEST-100', fromStart: 'x', fromEnd: 'y', toStart: 'z', toEnd: 'w' }] as any }, storage)).rejects.toThrow(ValidationError);
  });

  it('continueBlockMove: no permission, changed by someone else, or a refused due date leaves the sub-task as it was', async () => {
    const it11 = { key: 'TEST-11', fromStart: add(s0, 3), fromEnd: add(s0, 5), toStart: add(s0, 10), toEnd: add(s0, 12) };
    const it12 = { key: 'TEST-12', fromStart: add(s0, 9), fromEnd: add(s0, 11), toStart: add(s0, 16), toEnd: add(s0, 18) };
    setPermissionCheckerForTests(async (ids, perms) => new Map(perms.map(p => [p, new Set(ids.filter(id => id !== '11'))])));
    try {
      const r: any = await continueBlockMove({ projectKey: 'TEST', taskId: 'TEST-1', items: [it11, it12] }, storage);
      expect(r.jiraSync.writes.find((w: any) => w.key === 'TEST-11').error).toContain('not moved: you lack');
      // TEST-12 does not have the dates it would move from (s0+0..s0+4): reported, not moved.
      expect(r.jiraSync.writes.find((w: any) => w.key === 'TEST-12').error).toContain('someone else changed it');
    } finally { setPermissionCheckerForTests(allowAllPermissions); }
    refuseDue = 'TEST-11';
    const before = await entry('TEST-11');
    const r2: any = await continueBlockMove({ projectKey: 'TEST', taskId: 'TEST-1', items: [it11], last: true }, storage);
    expect(r2.jiraSync.ok).toBe(false);
    expect(await entry('TEST-11')).toMatchObject({ startDate: before.startDate, endDate: before.endDate });
    await expect(continueBlockMove({ projectKey: 'TEST', taskId: 'TEST-1', items: 'x' as any }, storage)).rejects.toThrow('items');
    await expect(continueBlockMove({ projectKey: 'TEST', taskId: 'TEST-1', items: [null] as any }, storage)).rejects.toThrow('object');
    await expect(continueBlockMove({ projectKey: 'TEST', taskId: 'TEST-1', items: [{ ...it11, toEnd: add(s0, 1) }] }, storage)).rejects.toThrow('on or after');
    await expect(continueBlockMove({ projectKey: 'TEST', taskId: 'TEST-1', items: [], last: 'yes' as any }, storage)).rejects.toThrow('last');
    await expect(continueBlockMove({ projectKey: 'TEST', taskId: 'TEST-99', items: [] }, storage)).rejects.toThrow('not in project');
  });

  it('restore must be true or false', async () => {
    await expect(updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-11', updates: { progress: 5 }, restore: 'yes' as any }, storage)).rejects.toThrow(ValidationError);
  });

  it('a direct date write to the parent is still refused (N-06 rule 3)', async () => {
    await expect(updateWbsTask({ projectKey: 'TEST', taskId: 'TEST-1', updates: { startDate: add(s0, 7), endDate: add(s0, 9) } }, storage))
      .rejects.toThrow('takes its dates from its sub-tasks');
  });
});
