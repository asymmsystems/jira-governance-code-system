/**
 * H-2: who was the assignee of an issue during a time window, from the Jira changelog.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { jira, JiraCall } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return { __esModule: true, default: { asApp: () => asApp, asUser: () => asUser }, route: m.routeImpl };
});

import { assigneeChanges, assigneesSince, ASSIGNEE_HISTORY_FAILED, CHANGELOG_PAGE, MAX_CHANGELOG_PAGES } from '../../src/jira/assignee-history';
import { retryPolicy } from '../../src/jira/jira-client';

const entry = (created: any, items: any[]) => ({ created, items });

describe('H-2 assignee history', () => {
  beforeEach(() => {
    jira.reset();
    retryPolicy.sleep = async () => {};
  });

  it('reads every page, keeps only assignee changes, oldest first, as the chosen identity', async () => {
    const page1 = Array.from({ length: CHANGELOG_PAGE }, (_, i) => entry(`2026-11-0${1 + (i % 2)}T00:00:00.000+0000`, [{ field: 'status', fieldId: 'status', from: '1', to: '3' }]));
    page1[0] = entry('2026-11-03T00:00:00.000+0000', [{ field: 'assignee', fieldId: 'assignee', from: 'a', to: 'b' }]);
    const page2 = [entry(1762300000000, [{ field: 'assignee', from: null, to: 'c' }]), entry('not a date', [{ fieldId: 'assignee', from: 'c', to: null }])];
    jira.handler = (c: JiraCall) => (c.path.includes('startAt=0')
      ? { status: 200, body: { startAt: 0, total: CHANGELOG_PAGE + 2, values: page1 } }
      : { status: 200, body: { startAt: CHANGELOG_PAGE, total: CHANGELOG_PAGE + 2, values: page2 } });
    const changes = await assigneeChanges('DEMO-1', 'user');
    expect(changes).toEqual([
      { at: 1762300000000, from: undefined, to: 'c' },
      { at: Date.parse('2026-11-03T00:00:00.000+0000'), from: 'a', to: 'b' },
      { at: Number.POSITIVE_INFINITY, from: 'c', to: undefined }
    ]);
    expect(jira.calls.map(c => c.who)).toEqual(['user', 'user']);
    expect(jira.calls[1].path).toBe(`/rest/api/3/issue/DEMO-1/changelog?startAt=${CHANGELOG_PAGE}&maxResults=${CHANGELOG_PAGE}`);
    jira.calls = [];
    jira.handler = () => ({ status: 200, body: { isLast: true, values: [] } });
    expect(await assigneeChanges('10001', 'app')).toEqual([]);
    expect(jira.calls.map(c => c.who)).toEqual(['app']);
  });

  it('stops on isLast, on an empty page, and on a body without a total', async () => {
    jira.handler = () => ({ status: 200, body: { values: [entry('2026-11-01T00:00:00Z', [{ field: 'assignee', to: 'x' }])] } });
    expect(await assigneeChanges('DEMO-1', 'app')).toHaveLength(1);
    jira.handler = () => ({ status: 200, body: { values: 'junk', total: 5 } });
    expect(await assigneeChanges('DEMO-1', 'app')).toEqual([]);
    jira.handler = () => ({ status: 200, body: { values: [{ created: '2026-11-01T00:00:00Z', items: 'junk' }, null], total: 2 } });
    expect(await assigneeChanges('DEMO-1', 'app')).toEqual([]);
  });

  it('fails closed on a failed read, a network error, and a history longer than the page limit', async () => {
    jira.handler = () => ({ status: 403 });
    await expect(assigneeChanges('DEMO-1', 'user')).rejects.toThrow(ASSIGNEE_HISTORY_FAILED);
    jira.handler = () => ({ status: 0, throws: 'down' } as any);
    await expect(assigneeChanges('DEMO-1', 'user')).rejects.toThrow(ASSIGNEE_HISTORY_FAILED);
    jira.calls = [];
    jira.handler = () => ({ status: 200, body: { total: 1e9, values: [entry('2026-11-01T00:00:00Z', [])] } });
    await expect(assigneeChanges('DEMO-1', 'app')).rejects.toThrow(ASSIGNEE_HISTORY_FAILED);
    expect(jira.calls).toHaveLength(MAX_CHANGELOG_PAGES);
  });

  it('names the current assignee and both sides of every change after the window start, with a 5 s grace', () => {
    const t = (iso: string) => Date.parse(iso);
    const changes = [
      { at: t('2026-11-01T00:00:00Z'), from: 'early', to: 'a' },
      { at: t('2026-11-05T09:59:57Z'), from: 'a', to: 'b' },
      { at: t('2026-11-06T00:00:00Z'), from: 'b', to: undefined }
    ];
    expect(assigneesSince(changes, 'cur', '2026-11-05T10:00:00Z')).toEqual(new Set(['cur', 'a', 'b']));
    expect(assigneesSince(changes, undefined)).toEqual(new Set(['early', 'a', 'b']));
    expect(assigneesSince(changes, undefined, 'not a date')).toEqual(new Set(['early', 'a', 'b']));
    expect(assigneesSince([], 'cur', '2026-11-05T10:00:00Z')).toEqual(new Set(['cur']));
  });
});
