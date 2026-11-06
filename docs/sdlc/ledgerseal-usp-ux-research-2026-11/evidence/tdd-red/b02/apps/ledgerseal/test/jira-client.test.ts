/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Jira client: retry, paging and result mapping.
 *
 * @author Fahim Farook
 */

import { createJiraClient } from '../src/jira/jira-client';
import { authorsSince } from '../src/domain/policy';

jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {},
  route: (strings: any, ...values: any[]) =>
    strings.reduce((acc: string, s: string, i: number) => acc + s + (i < values.length ? encodeURIComponent(String(values[i])) : ''), '')
}));

const reply = (status: number, body: any = {}, retryAfter: string | null = null) => ({
  status,
  json: async () => body,
  headers: { get: (name: string) => (name === 'Retry-After' ? retryAfter : null) }
});

function clock() {
  let t = 0;
  const waits: number[] = [];
  return {
    waits,
    now: () => t,
    sleep: async (ms: number) => {
      waits.push(ms);
      t += ms;
    }
  };
}

describe('Jira client retry', () => {
  it('honours Retry-After on 429 and returns the later success', async () => {
    const c = clock();
    const asApp = { requestJira: jest.fn().mockResolvedValueOnce(reply(429, {}, '2')).mockResolvedValueOnce(reply(200, { id: '1' })) };
    const client = createJiraClient(asApp, null, { sleep: c.sleep, now: c.now });
    await expect(client.getIssue('1')).resolves.toEqual({ ok: true, value: { id: '1' } });
    expect(c.waits).toEqual([2000]);
  });

  it('backs off exponentially on 5xx without Retry-After, up to 3 retries', async () => {
    const c = clock();
    const asApp = { requestJira: jest.fn().mockResolvedValue(reply(503)) };
    const client = createJiraClient(asApp, null, { sleep: c.sleep, now: c.now });
    await expect(client.getIssue('1')).resolves.toEqual({ ok: false, error: 'UNREACHABLE', status: 503 });
    expect(c.waits).toEqual([500, 1000, 2000]);
    expect(asApp.requestJira).toHaveBeenCalledTimes(4);
  });

  it('stops retrying when the next wait would pass the time budget', async () => {
    const c = clock();
    const asApp = { requestJira: jest.fn().mockResolvedValue(reply(429, {}, '30')) };
    const client = createJiraClient(asApp, null, { sleep: c.sleep, now: c.now, budgetMs: 20000 });
    await expect(client.getIssue('1')).resolves.toEqual({ ok: false, error: 'UNREACHABLE', status: 429 });
    expect(c.waits).toEqual([]);
  });

  it('uses the real timer when no sleep is injected', async () => {
    const asApp = { requestJira: jest.fn().mockResolvedValueOnce(reply(500, {}, '0.001')).mockResolvedValueOnce(reply(200, {})) };
    await expect(createJiraClient(asApp, null).getIssue('1')).resolves.toMatchObject({ ok: true });
  });
});

describe('Jira client paging and mapping', () => {
  it('pages the change log until isLast', async () => {
    const asApp = {
      requestJira: jest
        .fn()
        .mockResolvedValueOnce(reply(200, { values: [{ id: '1', created: 'a', items: [] }], isLast: false }))
        .mockResolvedValueOnce(reply(200, { values: [{ id: '2', created: 'b', items: [] }], isLast: true }))
    };
    const res = await createJiraClient(asApp, null).getChangelog('10001');
    expect(res).toEqual({ ok: true, value: [{ id: '1', created: 'a', items: [] }, { id: '2', created: 'b', items: [] }] });
    expect(String(asApp.requestJira.mock.calls[1][0])).toContain('startAt=100');
  });

  it('stops on an empty or malformed change log page and passes failures through', async () => {
    const asApp = {
      requestJira: jest.fn().mockResolvedValueOnce(reply(200, { isLast: false })).mockResolvedValueOnce(reply(404))
    };
    const client = createJiraClient(asApp, null);
    await expect(client.getChangelog('1')).resolves.toEqual({ ok: true, value: [] });
    await expect(client.getChangelog('1')).resolves.toEqual({ ok: false, error: 'NOT_FOUND', status: 404 });
  });

  it('passes a permission read failure through and treats a missing permissions object as no permission', async () => {
    const asUser = { requestJira: jest.fn().mockResolvedValueOnce(reply(401)).mockResolvedValueOnce(reply(200, {})) };
    const client = createJiraClient({ requestJira: jest.fn() }, asUser);
    await expect(client.hasApproverPermission('1')).resolves.toEqual({ ok: false, error: 'FORBIDDEN', status: 401 });
    await expect(client.hasApproverPermission('1')).resolves.toEqual({ ok: true, value: false });
  });

  it('returns null for a user without a display name and false for a failed property write', async () => {
    const asApp = { requestJira: jest.fn().mockResolvedValueOnce(reply(200, { displayName: 7 })).mockResolvedValueOnce(reply(400)) };
    const client = createJiraClient(asApp, null);
    await expect(client.getUserName('a')).resolves.toBeNull();
    await expect(client.putSealProperty('1', {})).resolves.toBe(false);
  });
});

describe('authorsSince', () => {
  const log = (accountId: string | undefined, created: any) => ({ id: 'x', author: accountId ? { accountId } : undefined, created, items: [] });

  it('returns only authors of entries after the seal time', () => {
    const authors = authorsSince(
      [log('before', '2026-11-01T09:59:59.000+0000'), log('after', '2026-11-01T15:31:00.000+0530'), log(undefined, '2026-12-01T00:00:00Z')],
      '2026-11-01T10:00:00.000Z'
    );
    expect([...authors]).toEqual(['after']);
  });

  it('fails closed when a time cannot be read', () => {
    expect([...authorsSince([log('a', 'not a date'), log('b', undefined)], '2026-11-01T10:00:00Z')]).toEqual(['a', 'b']);
    expect([...authorsSince([log('c', '2020-01-01T00:00:00Z')], 'garbage')]).toEqual(['c']);
  });
});
