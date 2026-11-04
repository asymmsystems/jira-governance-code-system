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
    expect(res403.error).toContain('permission');

    const accessor401 = new DefaultForgeConfluenceSearchAccessor(async () => ({
      status: 401,
      json: async () => ({})
    }));

    const res401 = await accessor401.searchPages('ADR');
    expect(res401.ok).toBe(false);
    expect(res401.error).toContain('permission');
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
