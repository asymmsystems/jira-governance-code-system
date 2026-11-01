/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: bounded remote-link reader unit tests
 */

import { readRemoteLinks } from '../../src/jira/remote-links';

// These tests use the real @forge/api route tag, so a path that the tag would reject fails here.
const pathOf = (r: any): string => (typeof r === 'string' ? r : r.value);

describe('readRemoteLinks', () => {
  it('reads each issue once, at most 8 at a time', async () => {
    let active = 0;
    let peak = 0;
    const request = jest.fn(async (r: any) => {
      const path = pathOf(r);
      active++;
      peak = Math.max(peak, active);
      await new Promise(r => setTimeout(r, 2));
      active--;
      return { status: 200, json: async () => [{ object: { url: path } }] };
    });
    const ids = Array.from({ length: 20 }, (_, i) => String(i + 1));
    const links = await readRemoteLinks(ids, request, Date.now() + 10_000);
    expect(request).toHaveBeenCalledTimes(20);
    expect(peak).toBeLessThanOrEqual(8);
    expect(links.get('7')).toEqual([{ object: { url: '/rest/api/3/issue/7/remotelink' } }]);
  });

  it('leaves issues unread after the deadline and after a failed read', async () => {
    const request = jest.fn(async (r: any) => {
      const path = pathOf(r);
      if (path.includes('/b/')) return { status: 500, json: async () => ({}) };
      if (path.includes('/c/')) throw new Error('network');
      if (path.includes('/d/')) return { status: 200, json: async () => ({ not: 'array' }) };
      return { status: 200, json: async () => [] };
    });
    const links = await readRemoteLinks(['a', 'b', 'c', 'd'], request, Date.now() + 10_000);
    expect(links.get('a')).toEqual([]);
    expect(links.has('b')).toBe(false);
    expect(links.has('c')).toBe(false);
    expect(links.get('d')).toEqual([]);
    const late = await readRemoteLinks(['a'], request, Date.now() - 1);
    expect(late.size).toBe(0);
  });
});
