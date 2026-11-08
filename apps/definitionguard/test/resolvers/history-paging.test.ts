/**
 * DG-2: the issue panel can show the whole history, one page of 100 events at a time ("Show more"),
 * and every page is checked as the first one is: Browse projects as the user, before any read.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import * as fs from 'fs';
import * as path from 'path';
import { jira, CountingStorage } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return { __esModule: true, default: { asApp: () => asApp, asUser: () => asUser }, route: m.routeImpl };
});
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));

import { ChecklistStore, HISTORY_PAGE } from '../../src/storage/checklist-store';
import { createEntry, statusEntry } from '../../src/domain/event-log';
import { toDodTemplate } from '../../src/domain/dod-template';
import { getChecklistHistory } from '../../src/index';
import { BROWSE_DENIED } from '../../src/security/permissions';
import { appendHistoryPage, historyShownText, historyRows, HistoryPageData } from '../../src/ui/panel-view-model';
import { ChecklistTemplate } from '../../src/domain/models';

const T = '2026-11-01T00:00:00.000Z';
const ACTOR = '712020:0123456789abcdef01234567';
const ISSUE = '60101';
const ctx = { accountId: ACTOR, extension: { issue: { id: ISSUE, key: `DEMO-${ISSUE}`, type: 'Task' }, project: { id: '10000' } } };
const BROWSE = `/rest/api/3/mypermissions?issueId=${ISSUE}&permissions=BROWSE_PROJECTS`;

const tmpl: ChecklistTemplate = {
  id: 'tmpl-paging', name: 'Paging', description: '',
  items: [{ id: 'item-a', title: 'Item A', isMandatory: true, category: 'TESTING' }]
};

/** One Create event, then n ticks and unticks: n + 1 events. */
async function events(storage: CountingStorage, n: number) {
  const store = new ChecklistStore(storage);
  const dod = toDodTemplate(tmpl);
  for (let k = 0; k < n; k++) {
    const tick = k % 2 === 0;
    await store.mutate(
      ISSUE,
      async base => [createEntry(base, dod, ACTOR, T)],
      st => [statusEntry(st, { templateItemId: 'item-a', statusIdTo: tick ? 'DOD_DONE' : 'DOD_OPEN', transitionName: tick ? 'Complete' : 'Reopen', actorPartyId: ACTOR, at: T })],
      { issueKey: `DEMO-${ISSUE}`, projectId: '10000' }
    );
  }
}

/** What the panel does: the first page on "Load audit history", then "Show more" until no cursor. */
async function showAll(storage: CountingStorage): Promise<{ shown: HistoryPageData; pages: number }> {
  let shown: HistoryPageData | null = null;
  let cursor: string | undefined;
  let pages = 0;
  do {
    const next = await getChecklistHistory(cursor ? { cursor } : {}, ctx, storage) as HistoryPageData;
    shown = appendHistoryPage(shown, next);
    cursor = next.nextCursor;
    pages++;
  } while (cursor);
  return { shown: shown!, pages };
}

describe('DG-2 the panel can show every history event', () => {
  beforeEach(() => jira.reset());

  it('shows 250 events in three pages, oldest first, each event once, and stops on the last page', async () => {
    const storage = new CountingStorage();
    await events(storage, 249);
    const first = await getChecklistHistory({}, ctx, storage) as HistoryPageData;
    expect(first.auditTrail).toHaveLength(HISTORY_PAGE);
    expect(historyShownText(first)).toBe('Showing 100 of 250 events, oldest first.');

    const { shown, pages } = await showAll(storage);
    expect(pages).toBe(3);
    expect(shown.auditTrail).toHaveLength(250);
    expect(new Set(shown.auditTrail!.map(e => e.id)).size).toBe(250);
    expect(shown.nextCursor).toBeUndefined();
    expect(historyShownText(shown)).toBeUndefined();
    expect(shown.chain!.ok).toBe(true);
    const rows = historyRows(shown.auditTrail);
    expect(rows[0].actionVerb).toBe('Checklist created');
    expect(rows.slice(1).every(r => r.actionVerb === 'Completed' || r.actionVerb === 'Reopened')).toBe(true);
  });

  it('a history of 100 events or fewer has no cursor, so the panel offers no "Show more"', async () => {
    const storage = new CountingStorage();
    await events(storage, 99);
    const page = await getChecklistHistory({}, ctx, storage) as HistoryPageData;
    expect(page.auditTrail).toHaveLength(100);
    expect(page.nextCursor).toBeUndefined();
    expect(historyShownText(page)).toBeUndefined();
  });

  it('checks Browse projects as the user on every page, before any storage read', async () => {
    const storage = new CountingStorage();
    await events(storage, 149);
    const first = await getChecklistHistory({}, ctx, storage);
    jira.calls.length = 0;
    storage.gets = [];
    await getChecklistHistory({ cursor: first.nextCursor }, ctx, storage);
    expect(jira.calls[0]).toMatchObject({ who: 'user', method: 'GET', path: BROWSE });
    expect(jira.calls.filter(c => c.who === 'app')).toEqual([]);
  });

  it('refuses the next page when the user can no longer browse the issue, and reads nothing', async () => {
    const storage = new CountingStorage();
    await events(storage, 149);
    const first = await getChecklistHistory({}, ctx, storage);
    jira.browse = 'deny';
    storage.gets = [];
    await expect(getChecklistHistory({ cursor: first.nextCursor }, ctx, storage)).rejects.toThrow(BROWSE_DENIED);
    expect(storage.gets).toEqual([]);
  });

  it('the panel passes the cursor of the newest page and appends the rows', () => {
    const ui = fs.readFileSync(path.join(__dirname, '../../src/frontend/index.tsx'), 'utf8');
    expect(ui).toMatch(/invoke\('getHistory', \{ cursor: history\.nextCursor \}\)/);
    expect(ui).toMatch(/setHistory\(appendHistoryPage\(history, next\)\)/);
    expect(ui).toMatch(/Show more/);
  });
});

describe('DG-2 appendHistoryPage and historyShownText', () => {
  const ev = (id: string) => ({ id, eventType: 'CHECK', timestamp: T, actorAccountId: ACTOR } as any);

  it('starts from the first page, appends new rows, skips rows already shown, and takes the newest chain and cursor', () => {
    const p1: HistoryPageData = { auditTrail: [ev('1'), ev('2')], chain: { ok: true, message: 'a', limit: 'l' }, nextCursor: 'c1', eventCount: 4 };
    expect(appendHistoryPage(null, p1)).toBe(p1);
    const p2: HistoryPageData = { auditTrail: [ev('2'), ev('3'), ev('4')], chain: { ok: false, message: 'b', limit: 'l' }, eventCount: 4 };
    const both = appendHistoryPage(p1, p2);
    expect(both.auditTrail!.map(e => e.id)).toEqual(['1', '2', '3', '4']);
    expect(both.chain!.message).toBe('b');
    expect(both.nextCursor).toBeUndefined();
    expect(appendHistoryPage({}, {}).auditTrail).toEqual([]);
  });

  it('names how many events are shown, never fewer in total than shown', () => {
    expect(historyShownText(null)).toBeUndefined();
    expect(historyShownText({ auditTrail: [ev('1')] })).toBeUndefined();
    expect(historyShownText({ auditTrail: [ev('1'), ev('2')], nextCursor: 'c', eventCount: 5 })).toBe('Showing 2 of 5 events, oldest first.');
    expect(historyShownText({ nextCursor: 'c' })).toBe('Showing 0 of 0 events, oldest first.');
    expect(historyShownText({ auditTrail: [ev('1'), ev('2')], nextCursor: 'c' })).toBe('Showing 2 of 2 events, oldest first.');
  });
});
