/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * Tests for DefaultForgeConfluenceSearchAccessor (B-41).
 */

import { DefaultForgeConfluenceSearchAccessor } from '../src/accessor/default-forge-confluence-search-accessor';

const pathOf = (r: unknown): string => {
  if (typeof r === 'string') return r;
  if (typeof r === 'object' && r !== null && 'value' in r) {
    return String((r as { value: unknown }).value);
  }
  return '';
};

describe('DefaultForgeConfluenceSearchAccessor', () => {
  it('returns empty list for short or empty queries without calling Confluence', async () => {
    let called = false;
    const accessor = new DefaultForgeConfluenceSearchAccessor(async () => {
      called = true;
      return { status: 200, json: async () => ({ results: [] }) };
    });

    const resEmpty = await accessor.searchPages('');
    expect(resEmpty).toEqual({ ok: true, pages: [] });
    expect(called).toBe(false);

    const resSingle = await accessor.searchPages('a');
    expect(resSingle).toEqual({ ok: true, pages: [] });
    expect(called).toBe(false);
  });

  it('searches Confluence and formats pages when results are returned', async () => {
    let requestedUrl = '';
    const fakeData = {
      _links: { base: 'https://asymmsystems.atlassian.net/wiki' },
      results: [
        {
          id: '1001',
          title: 'ADR-001 Evidence Model',
          space: { key: 'ARCH', name: 'Architecture' },
          _links: { webui: '/spaces/ARCH/pages/1001/ADR-001+Evidence+Model' }
        },
        {
          id: '1002',
          title: 'Specification v2',
          _links: { webui: 'https://asymmsystems.atlassian.net/wiki/spaces/SPEC/pages/1002/Specification+v2' }
        },
        {
          id: '1003',
          title: '   ' // Empty title should be filtered out
        }
      ]
    };

    const accessor = new DefaultForgeConfluenceSearchAccessor(async (r) => {
      requestedUrl = pathOf(r);
      return { status: 200, json: async () => fakeData };
    });

    const res = await accessor.searchPages('ADR');
    expect(res.ok).toBe(true);
    expect(res.pages).toHaveLength(2);
    expect(res.pages[0]).toEqual({
      title: 'ADR-001 Evidence Model',
      url: 'https://asymmsystems.atlassian.net/wiki/spaces/ARCH/pages/1001/ADR-001+Evidence+Model',
      spaceKey: 'ARCH'
    });
    expect(res.pages[1]).toEqual({
      title: 'Specification v2',
      url: 'https://asymmsystems.atlassian.net/wiki/spaces/SPEC/pages/1002/Specification+v2',
      spaceKey: undefined
    });
    expect(decodeURIComponent(requestedUrl)).toContain('type=page');
    expect(decodeURIComponent(requestedUrl)).toContain('ADR');
  });

  it('handles empty results and missing _links gracefully', async () => {
    const accessor = new DefaultForgeConfluenceSearchAccessor(async () => ({
      status: 200,
      json: async () => ({ results: null })
    }));

    const res = await accessor.searchPages('ADR');
    expect(res.ok).toBe(true);
    expect(res.pages).toEqual([]);
  });

  it('reports permission error on 401 and 403', async () => {
    const accessor403 = new DefaultForgeConfluenceSearchAccessor(async () => ({
      status: 403,
      json: async () => ({})
    }));

    const res403 = await accessor403.searchPages('ADR');
    expect(res403.ok).toBe(false);
    expect(res403.error).toBe('Confluence refused the search (HTTP 403). Either you cannot search Confluence, or FourRealities has no access to Confluence on this site. You can still enter the page address and title by hand.');

    const accessor401 = new DefaultForgeConfluenceSearchAccessor(async () => ({
      status: 401,
      json: async () => ({})
    }));

    const res401 = await accessor401.searchPages('ADR');
    expect(res401.ok).toBe(false);
    expect(res401.error).toContain('HTTP 401');
  });

  it('reports Confluence status error on 500', async () => {
    const accessor = new DefaultForgeConfluenceSearchAccessor(async () => ({
      status: 500,
      json: async () => ({})
    }));

    const res = await accessor.searchPages('ADR');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Confluence returned status 500');
  });

  it('handles network exceptions gracefully', async () => {
    const accessor = new DefaultForgeConfluenceSearchAccessor(async () => {
      throw new Error('Network timeout');
    });

    const res = await accessor.searchPages('ADR');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Network timeout');
  });

  it('instantiates with default requester without errors', () => {
    const accessor = new DefaultForgeConfluenceSearchAccessor();
    expect(accessor.serviceType).toBe('accessor');
  });
});

describe('F-H4: Confluence pages are checked by id', () => {
  const { confluencePageId } = require('../src/accessor/issue-facts');
  const pathOf = (r: any): string => (typeof r === 'string' ? r : r.value);

  it('reads the page id from a global id or a page URL, and none from a tiny link', () => {
    expect(confluencePageId('appId=abc&pageId=123', undefined)).toBe('123');
    expect(confluencePageId(undefined, 'https://s.atlassian.net/wiki/spaces/A/pages/456/ADR')).toBe('456');
    expect(confluencePageId(undefined, 'https://s.atlassian.net/wiki/spaces/A/pages/789')).toBe('789');
    expect(confluencePageId(undefined, 'https://s.atlassian.net/wiki/pages/viewpage.action?pageId=321')).toBe('321');
    expect(confluencePageId(undefined, 'https://s.atlassian.net/wiki/x/AbCd')).toBeUndefined();
    expect(confluencePageId(undefined, undefined)).toBeUndefined();
    // L-2: a global id and an address that name different pages give no id to check.
    expect(confluencePageId('appId=abc&pageId=123', 'https://s.atlassian.net/wiki/spaces/A/pages/999/Other')).toBeUndefined();
    expect(confluencePageId('appId=abc&pageId=123', 'https://s.atlassian.net/wiki/spaces/A/pages/123/Same')).toBe('123');
  });

  it('asks Confluence for the ids in batches of 50 and marks each link', async () => {
    const requester = jest.fn(async (r: any) => {
      const cql = decodeURIComponent(pathOf(r));
      return { status: 200, json: async () => ({ results: cql.includes('(1,') ? [{ id: '1' }, { id: 7 }] : [{ title: 'no id' }] }) };
    });
    const a = new DefaultForgeConfluenceSearchAccessor(requester);
    const ids = Array.from({ length: 60 }, (_, i) => String(i + 1));
    expect(await a.existingPages([...ids, 'x', '1'], Date.now() + 10_000)).toEqual(new Set(['1', '7']));
    expect(requester).toHaveBeenCalledTimes(2);
    expect(decodeURIComponent(pathOf(requester.mock.calls[0][0]))).toMatch(/^\/wiki\/rest\/api\/content\/search\?cql=id in \(1,2,.*,50\)&limit=50$/);
    const marked = await a.checkPages(new Map([['10', [{ url: 'u', pageId: '1' }, { url: 'v', pageId: '2' }, { url: 'w' }]]]), Date.now() + 10_000);
    expect(marked.get('10')).toEqual([{ url: 'u', pageId: '1', pageExists: true }, { url: 'v', pageId: '2', pageExists: false }, { url: 'w' }]);
  });

  it('leaves links unchecked when there is no id, Confluence refuses or throws, or the deadline passed', async () => {
    const links = new Map([['10', [{ url: 'u', pageId: '1' }]]]);
    const none = new Map([['10', [{ url: 'u' }]]]);
    const never = jest.fn();
    expect(await new DefaultForgeConfluenceSearchAccessor(never).checkPages(none, Date.now() + 10_000)).toBe(none);
    expect(never).not.toHaveBeenCalled();
    expect(await new DefaultForgeConfluenceSearchAccessor(async () => ({ status: 403, json: async () => ({}) })).checkPages(links, Date.now() + 10_000)).toBe(links);
    expect(await new DefaultForgeConfluenceSearchAccessor(async () => { throw new Error('no app access'); }).existingPages(['1'], Date.now() + 10_000)).toBeNull();
    expect(await new DefaultForgeConfluenceSearchAccessor(async () => ({ status: 200, json: async () => null })).existingPages(['1'], Date.now() + 10_000)).toEqual(new Set());
    expect(await new DefaultForgeConfluenceSearchAccessor(never).existingPages(['1'], Date.now() - 1)).toBeNull();
  });
});
