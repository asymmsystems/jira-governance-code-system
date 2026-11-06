/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: MK-02 questionnaire Q3. The dashboard checks the viewer's Browse projects with the
 * permissions REST API before anything is read or built as the app; every number it shows covers
 * only issues the viewer can browse; linked Confluence pages are checked as the viewer only.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_SOURCE_SETTINGS, IssueFacts, IssueRow, RemoteLink } from '../../src/contract/data/models';
import { BROWSE_CHECK_FAILED, BROWSE_DENIED, DefaultSnapshotManager, TREND_WITHHELD } from '../../src/manager/default-snapshot-manager';
import { DefaultExceptionPolicyEngine } from '../../src/engine/default-exception-policy-engine';
import { DefaultGateEngine } from '../../src/engine/default-gate-engine';
import { DefaultMetricsEngine } from '../../src/engine/default-metrics-engine';
import { DefaultSnapshotEngine } from '../../src/engine/default-snapshot-engine';
import { DefaultSourcePolicyEngine } from '../../src/engine/default-source-policy-engine';
import { DefaultKvsSnapshotAccessor } from '../../src/accessor/default-kvs-snapshot-accessor';
import { MemoryStorage } from '../storage/memory-storage';
import { makeFacts } from '../domain/fixtures';

const CONFIG = { devFieldId: null, siteHost: 'example.atlassian.net', statusCategories: {}, pullRequestsSeen: false, readAt: 't' };
const page = (id: string): RemoteLink => ({ url: `https://example.atlassian.net/wiki/spaces/A/pages/${id}`, title: `ADR ${id}`, applicationType: 'com.atlassian.confluence', pageId: id });
const facts = (id: string): IssueFacts => makeFacts({ issueId: id, issueKey: `PAY-${id}`, statusCategory: 'indeterminate', started: true });

interface Setup {
  ids?: string[];
  capped?: boolean;
  links?: Record<string, RemoteLink[]>;
  seen?: string[];
  browse?: { status: number; granted: boolean } | Error;
  pages?: Set<string> | null;
  storage?: MemoryStorage;
  now?: string;
}

function setup(o: Setup = {}) {
  const ids = o.ids || ['1', '2', '3'];
  const storage = o.storage || new MemoryStorage();
  const appJira: any = {
    serviceType: 'accessor',
    searchProject: jest.fn().mockResolvedValue({ facts: ids.map(facts), capped: Boolean(o.capped), totalKnown: o.capped ? 5000 : ids.length }),
    remoteLinks: jest.fn().mockImplementation(async (started: string[]) => new Map(started.map(id => [id, (o.links || {})[id] || []])))
  };
  const viewerJira: any = {
    serviceType: 'accessor',
    hasAnyPermission: o.browse instanceof Error ? jest.fn().mockRejectedValue(o.browse) : jest.fn().mockResolvedValue(o.browse || { status: 200, granted: true }),
    visibleIssueIds: jest.fn().mockResolvedValue({ ids: new Set(o.seen || ids), complete: true })
  };
  const confluence: any = {
    serviceType: 'accessor',
    existingPages: jest.fn().mockResolvedValue(o.pages === undefined ? new Set() : o.pages),
    checkPages: jest.fn()
  };
  const at = new Date(o.now || '2026-11-04T10:00:00.000Z');
  const m = new DefaultSnapshotManager({
    jira: appJira, viewerJira, budgetMs: 20_000, deadline: Date.now() + 20_000,
    siteConfig: { serviceType: 'accessor', get: async () => CONFIG },
    snapshots: new DefaultKvsSnapshotAccessor(storage),
    notes: { serviceType: 'accessor', listAll: async () => new Map() } as any,
    events: { serviceType: 'accessor', listAll: async () => new Map() } as any,
    lifecycle: new DefaultExceptionPolicyEngine(), gates: new DefaultGateEngine(), metrics: new DefaultMetricsEngine(), snapshot: new DefaultSnapshotEngine(),
    settings: { serviceType: 'accessor', getSettings: async () => DEFAULT_SOURCE_SETTINGS, getDetected: async () => ({}), saveDetected: async () => undefined } as any,
    sources: new DefaultSourcePolicyEngine(),
    directory: { serviceType: 'accessor', userNames: async () => ({}) } as any,
    confluence,
    history: { serviceType: 'accessor', listAll: async () => new Map(), raise: async () => false } as any,
    now: () => at
  });
  return { m, appJira, viewerJira, confluence, storage };
}

const caller = { projectKey: 'PAY', accountId: 'acc-1' };

describe('MK-02 Q3: Browse projects, as the viewer, before anything else', () => {
  it('checks BROWSE_PROJECTS on the context project with the permissions API, first', async () => {
    const { m, appJira, viewerJira } = setup();
    expect((await m.view(caller, false) as any).ok).toBe(true);
    expect(viewerJira.hasAnyPermission).toHaveBeenCalledWith('PAY', ['BROWSE_PROJECTS']);
    expect(viewerJira.hasAnyPermission.mock.invocationCallOrder[0]).toBeLessThan(appJira.searchProject.mock.invocationCallOrder[0]);
  });

  it('refuses a viewer without Browse projects: no build as the app, no storage write, no other call', async () => {
    const { m, appJira, viewerJira, confluence, storage } = setup({ browse: { status: 200, granted: false } });
    expect(await m.view(caller, false)).toEqual({ ok: false, error: { code: 'FORBIDDEN', message: BROWSE_DENIED } });
    expect(appJira.searchProject).not.toHaveBeenCalled();
    expect(viewerJira.visibleIssueIds).not.toHaveBeenCalled();
    expect(confluence.existingPages).not.toHaveBeenCalled();
    expect(storage.ops).toEqual([]);
  });

  it.each([
    ['a non-200 answer', { status: 500, granted: false }, { code: 'JIRA_ERROR', message: BROWSE_CHECK_FAILED, status: 500 }],
    ['a 403 answer', { status: 403, granted: false }, { code: 'FORBIDDEN', message: BROWSE_CHECK_FAILED, status: 403 }],
    ['a thrown call', new Error('socket'), { code: 'JIRA_ERROR', message: BROWSE_CHECK_FAILED }]
  ])('fails closed on %s', async (_name, browse, error) => {
    const { m, appJira, storage } = setup({ browse: browse as any });
    expect(await m.view(caller, true)).toEqual({ ok: false, error });
    expect(appJira.searchProject).not.toHaveBeenCalled();
    expect(storage.ops).toEqual([]);
  });
});

describe('MK-02 Q3: every number covers only issues the viewer can browse', () => {
  it('a viewer who sees part of the project gets counts of that part, and no trend', async () => {
    const { m } = setup({ seen: ['1', '3'] });
    const res: any = await m.view(caller, false);
    expect(res.rows.map((r: IssueRow) => r.issueId)).toEqual(['1', '3']);
    expect(res.summary.totalIssues).toBe(2);
    expect(res.coverage).toEqual({ shown: 2, totalKnown: 2, capped: false });
    expect(res.trend).toEqual([]);
    expect(res.trendWithheld).toBe(TREND_WITHHELD);
    expect(res).not.toHaveProperty('meta');
    expect(JSON.stringify(res)).not.toContain('PAY-2');
  });

  it('a viewer who sees every issue gets the trend', async () => {
    const { m } = setup();
    const res: any = await m.view(caller, false);
    expect(res.coverage).toEqual({ shown: 3, totalKnown: 3, capped: false });
    expect(res.trend).toHaveLength(1);
    expect(res.trend[0].ratedIssues).toBeGreaterThan(0);
    expect(res).not.toHaveProperty('trendWithheld');
  });

  it('asks the viewer search for every issue the trend counts, not only the snapshot rows', async () => {
    const storage = new MemoryStorage();
    await setup({ storage, ids: ['1', '2', '9'] }).m.view(caller, false);
    // A later build that reads fewer issues keeps the stored trend ids only when it restarts the trend;
    // here the stored ids stay ['1', '2', '9'] while the snapshot holds 1 and 2 (a capped read).
    const capped = setup({ storage, ids: ['1', '2'], capped: true, seen: ['1', '2'] });
    const res: any = await capped.m.view(caller, true);
    expect(Array.from(capped.viewerJira.visibleIssueIds.mock.calls[0][2]).sort()).toEqual(['1', '2', '9']);
    expect(res.trend).toEqual([]);
    expect(res.trendWithheld).toBe(TREND_WITHHELD);
    const all = setup({ storage, ids: ['1', '2'], capped: true, seen: ['1', '2', '9'] });
    expect((await all.m.view(caller, false) as any).trend).toHaveLength(1);
  });

  it('a capped read shows no total: the project count includes issues the viewer may not see', async () => {
    const res: any = await setup({ capped: true }).m.view(caller, false);
    expect(res.coverage).toEqual({ shown: 3, totalKnown: null, capped: true });
  });
});

describe('MK-02 Q3: the trend counts only issues still in the project', () => {
  const build = (storage: MemoryStorage, ids: string[], now: string, capped = false) =>
    setup({ storage, ids, now, capped }).m.build('PAY', 'scheduled', Date.now() + 60_000);
  const weeks = async (storage: MemoryStorage) => (await new DefaultKvsSnapshotAccessor(storage).getTrend('PAY')).map(p => p.weekStart);

  it('stores the ids of the newest point and keeps the trend while no counted issue has left', async () => {
    const storage = new MemoryStorage();
    await build(storage, ['1', '2', '3'], '2026-10-20T10:00:00Z');
    await build(storage, ['1', '2', '3', '4'], '2026-10-27T10:00:00Z');
    expect(await weeks(storage)).toEqual(['2026-10-19', '2026-10-26']);
    expect(await new DefaultKvsSnapshotAccessor(storage).getTrendIssueIds('PAY')).toEqual(['1', '2', '3', '4']);
  });

  it('restarts the trend when an issue it counts has left the project (deleted, moved or hidden from the app)', async () => {
    const storage = new MemoryStorage();
    await build(storage, ['1', '2', '3'], '2026-10-20T10:00:00Z');
    await build(storage, ['1', '2', '3', '4'], '2026-10-27T10:00:00Z');
    await build(storage, ['1', '2', '4'], '2026-11-03T10:00:00Z');
    expect(await weeks(storage)).toEqual(['2026-11-02']);
    expect(await new DefaultKvsSnapshotAccessor(storage).getTrendIssueIds('PAY')).toEqual(['1', '2', '4']);
  });

  it('records no trend point for a capped or timed-out read', async () => {
    const storage = new MemoryStorage();
    await build(storage, ['1', '2'], '2026-10-20T10:00:00Z', true);
    expect(await weeks(storage)).toEqual([]);
    expect(await new DefaultKvsSnapshotAccessor(storage).getTrendIssueIds('PAY')).toBeUndefined();
  });

  it('restarts a trend stored before 2.1 (no issue ids), and shows it to nobody until then', async () => {
    const storage = new MemoryStorage();
    await storage.set('fr:p:PAY:trend', [{ weekStart: '2026-10-12', generatedAt: '2026-10-12T00:00:00Z', ratedIssues: 9, averageRAI: 50, gates: { intent: { found: 1, missing: 1 }, process: { found: 1, missing: 1 }, code: { found: 1, missing: 1 }, audit: { found: 1, missing: 1 } }, startedIssues: 9, reworkIssues: 0 }]);
    await storage.set('fr:p:PAY:meta', { schemaVersion: 2, projectKey: 'PAY', snapshotId: 's', generatedAt: '2026-11-03T00:00:00Z', generatedBy: 'scheduled', chunkCount: 0, shownCount: 0, totalKnown: 0, capped: false, remoteLinksRead: 0 });
    const legacy: any = await setup({ storage, ids: [] }).m.view(caller, false);
    expect(legacy.trend).toEqual([]);
    await build(storage, ['1'], '2026-11-03T10:00:00Z');
    expect(await weeks(storage)).toEqual(['2026-11-02']);
  });

  it('continuesTrend: empty trend continues; no stored ids or a missing id restarts', () => {
    const e = new DefaultSnapshotEngine();
    expect(e.continuesTrend(undefined, 0, ['1'])).toBe(true);
    expect(e.continuesTrend(undefined, 2, ['1'])).toBe(false);
    expect(e.continuesTrend(['1', '2'], 2, ['1', '2', '3'])).toBe(true);
    expect(e.continuesTrend(['1', '2'], 2, ['1', '3'])).toBe(false);
  });
});

describe('MK-02 Q3: linked Confluence pages are checked as the viewer, never as the app', () => {
  const links = { '1': [page('777')], '2': [page('888')], '3': [] };

  it('the build stores the link unchecked, with its page id, and never asks Confluence', async () => {
    const { m, confluence } = setup({ links });
    const built: any = await m.build('PAY', 'scheduled', Date.now() + 60_000);
    expect(confluence.existingPages).not.toHaveBeenCalled();
    expect(confluence.checkPages).not.toHaveBeenCalled();
    expect(built.rows[0].gates.intent).toMatchObject({ state: 'FOUND', verification: 'LINK_ONLY', pageId: '777' });
  });

  it('the view checks only the pages of the rows the viewer sees, and verifies what the viewer search returns', async () => {
    const { m, confluence } = setup({ links, seen: ['1', '3'], pages: new Set(['777']) });
    const res: any = await m.view(caller, false);
    expect(confluence.existingPages).toHaveBeenCalledTimes(1);
    expect(confluence.existingPages.mock.calls[0][0]).toEqual(['777']);
    expect(res.rows[0].gates.intent).toMatchObject({ state: 'FOUND', verification: 'VERIFIED' });
  });

  it.each([
    ['the viewer search does not return the page', new Set<string>()],
    ['Confluence could not be asked', null]
  ])('shows "link only" when %s', async (_name, pages) => {
    const res: any = await setup({ links, pages: pages as any }).m.view(caller, false);
    expect(res.rows.find((r: IssueRow) => r.issueId === '1').gates.intent.verification).toBe('LINK_ONLY');
  });

  it('a page verified as the app in a snapshot stored before 2.1 is shown as "link only"', () => {
    const e = new DefaultSnapshotEngine();
    const row = { issueId: '1', gates: { intent: { state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK', method: 'CONFLUENCE_PAGE_LINK' } } } as unknown as IssueRow;
    expect(e.pagesToCheck([row])).toEqual([]);
    expect(e.withCheckedPages([row], new Set(['777']))[0].gates.intent.verification).toBe('LINK_ONLY');
    const decision = { issueId: '2', gates: { intent: { state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_DECISION_ISSUE', method: 'DECISION_ISSUE_LINK' } } } as unknown as IssueRow;
    expect(e.withCheckedPages([decision], null)[0]).toBe(decision);
  });

  it('no source file reads Confluence as the app', () => {
    const src = path.join(__dirname, '../../src');
    const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
      .flatMap(e => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));
    const text = files(src).map(f => fs.readFileSync(f, 'utf8')).join('\n');
    expect(text).toContain('api.asUser().requestConfluence');
    expect(text).not.toMatch(/asApp\(\)[^;\n]*requestConfluence/);
    expect(text).not.toMatch(/DefaultForgeConfluenceSearchAccessor\('app'\)/);
  });
});
