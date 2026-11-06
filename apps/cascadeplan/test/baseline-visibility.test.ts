/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * Merge review M1: baseline items reach only users who can browse their issues. TEST-2 is secured:
 * the user's live read does not return it and Jira's permission check does not grant Browse projects.
 */

import { getProjectPlan, baselineStatusFor, getScopeCreepReport, compareBaselines, exportBaseline, visibleItems, setGlobalStorageProvider, setSleepForTests } from '../src/index';
import { BaselineStore } from '../src/storage/baseline-store';
import { setPermissionCheckerForTests, PermissionChecker } from '../src/security/write-permissions';
import { MemStorage } from './helpers/mem-storage';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asApp: () => ({ requestJira: mockRequestJira }), asUser: () => ({ requestJira: mockRequestJira }) },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

const issue = (n: number) => ({ id: String(n), key: `TEST-${n}`, fields: { summary: `T${n}`, issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } } } });
const ITEMS = [
  { id: '1', key: 'TEST-1', hours: 8, start: '2026-11-02', end: '2026-11-06' },
  { id: '2', key: 'TEST-2', hours: 40, start: '2026-11-09', end: '2026-11-20' },
  { id: '3', key: 'TEST-3', hours: 4, start: '2026-11-09', end: '2026-11-10' }
];
/** Browse is granted on TEST-1 and TEST-3 (TEST-3 is outside the plan's filter, not secured). */
const browse: PermissionChecker = async (ids, perms) => new Map(perms.map(p => [p, new Set(ids.filter(id => id !== '2'))]));

let storage: MemStorage;
let checked: string[][];
beforeEach(async () => {
  storage = new MemStorage();
  setGlobalStorageProvider(storage);
  setSleepForTests(async () => undefined);
  checked = [];
  setPermissionCheckerForTests(async (ids, perms) => { checked.push(ids); return browse(ids, perms); });
  mockRequestJira.mockReset();
  // The user's own search returns TEST-1 only: TEST-2 is secured, TEST-3 is outside the plan's read.
  mockRequestJira.mockImplementation(async (r: any) => (String(r).includes('/search/jql')
    ? { status: 200, json: async () => ({ issues: String(r).includes('Epic') ? [] : [issue(1)], isLast: true }) }
    : { status: 204, json: async () => ({}) }));
  const store = new BaselineStore(storage, 'TEST', 'default');
  await store.save({ id: 'b1', name: 'Sprint 1', frozenAt: '2026-11-01T00:00:00.000Z', frozenBy: null, items: ITEMS });
  await store.save({ id: 'b2', name: 'Sprint 1 (version 2)', frozenAt: '2026-11-02T00:00:00.000Z', frozenBy: null, items: ITEMS.map(i => ({ ...i, hours: (i.hours || 0) + 1 })) });
});

describe('M1: baseline items are filtered by the caller\'s Browse permission', () => {
  it('the baseline status of a plan load leaves out the secured item; items in the live read need no check', async () => {
    const plan = await getProjectPlan('TEST', storage);
    const s = await baselineStatusFor(storage, 'TEST', undefined, plan);
    expect(s.items.map((i: any) => i.key)).toEqual(['TEST-1', 'TEST-3']);
    expect(s.hidden).toBe(1);
    expect(checked).toEqual([['2', '3']]);
  });

  it('the scope report, the version comparison and the CSV export leave it out too', async () => {
    const report = await getScopeCreepReport({ projectKey: 'TEST', baselineId: 'b1' }, storage);
    expect(JSON.stringify(report.comparison)).not.toContain('TEST-2');
    expect(report.hidden).toBe(1);
    const cmp = await compareBaselines({ projectKey: 'TEST', fromId: 'b1', toId: 'b2' }, storage);
    expect(JSON.stringify(cmp.comparison)).not.toContain('TEST-2');
    expect(cmp.comparison.changed.map((c: any) => c.key)).toEqual(['TEST-1', 'TEST-3']);
    const exp = await exportBaseline({ projectKey: 'TEST', baselineId: 'b1' }, storage);
    expect(exp.csv).not.toContain('TEST-2');
    expect(exp.items.map((i: any) => i.key)).toEqual(['TEST-1', 'TEST-3']);
    expect(exp.csv).toContain('# 1 item(s) of issues you cannot browse are left out; the SHA-256 covers the whole baseline.');
  });

  it('when Jira does not answer the check, the unchecked items are left out (fail closed)', async () => {
    setPermissionCheckerForTests(async () => { throw new Error('down'); });
    const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await visibleItems(ITEMS, new Set(['1']))).toEqual({ items: [ITEMS[0]], hidden: 2 });
    err.mockRestore(); warn.mockRestore();
  });

  it('nothing to check: every item is in the live read', async () => {
    expect(await visibleItems(ITEMS, new Set(['1', '2', '3']))).toEqual({ items: ITEMS, hidden: 0 });
    expect(checked).toEqual([]);
  });
});
