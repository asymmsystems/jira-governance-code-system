/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: one deadline for a whole page view (F-H2), and a scheduled run that survives one
 * project's failure (F-L1).
 */

import { DEFAULT_SOURCE_SETTINGS } from '../../src/contract/data/models';
import { DefaultSnapshotManager, VIEW_RESERVE_MS, VISIBLE_RESERVE_MS } from '../../src/manager/default-snapshot-manager';
import { DefaultExceptionPolicyEngine } from '../../src/engine/default-exception-policy-engine';
import { DefaultGateEngine } from '../../src/engine/default-gate-engine';
import { DefaultMetricsEngine } from '../../src/engine/default-metrics-engine';
import { DefaultSnapshotEngine } from '../../src/engine/default-snapshot-engine';
import { DefaultSourcePolicyEngine } from '../../src/engine/default-source-policy-engine';
import { DefaultKvsSnapshotAccessor } from '../../src/accessor/default-kvs-snapshot-accessor';
import { MemoryStorage } from '../storage/memory-storage';
import { makeFacts } from '../domain/fixtures';

const CONFIG = { devFieldId: null, siteHost: 's', statusCategories: {}, pullRequestsSeen: false, readAt: 't' };

function manager(o: { deadline: number; storage?: MemoryStorage; searchProject?: jest.Mock; snapshots?: any }) {
  const jira: any = {
    serviceType: 'accessor',
    searchProject: o.searchProject || jest.fn().mockResolvedValue({ facts: [makeFacts({ issueId: '1', issueKey: 'PAY-1' })], capped: true, timedOut: true, totalKnown: 3000 }),
    remoteLinks: jest.fn().mockResolvedValue(new Map()),
    visibleIssueIds: jest.fn().mockResolvedValue({ ids: new Set(['1']), complete: true })
  };
  const storage = o.storage || new MemoryStorage();
  const m = new DefaultSnapshotManager({
    jira, viewerJira: jira, budgetMs: 20_000, deadline: o.deadline,
    siteConfig: { serviceType: 'accessor', get: async () => CONFIG },
    snapshots: o.snapshots || new DefaultKvsSnapshotAccessor(storage),
    notes: { serviceType: 'accessor', listAll: async () => new Map(), migrateV2ReworkNotes: async () => 0 } as any,
    events: { serviceType: 'accessor', listAll: async () => new Map(), migrateV2CodeNotes: async () => 0 } as any,
    lifecycle: new DefaultExceptionPolicyEngine(), gates: new DefaultGateEngine(), metrics: new DefaultMetricsEngine(), snapshot: new DefaultSnapshotEngine(),
    settings: { serviceType: 'accessor', getSettings: async () => DEFAULT_SOURCE_SETTINGS, getDetected: async () => ({}), saveDetected: async () => undefined } as any,
    sources: new DefaultSourcePolicyEngine(),
    directory: { serviceType: 'accessor', userNames: async () => ({}) } as any,
    confluence: { serviceType: 'accessor', existingPages: async () => null, checkPages: async (m: any) => m } as any
  });
  return { m, jira, storage };
}

describe('F-H2: one deadline for the whole page view', () => {
  it('builds before the reserve and checks the viewer before the end, from the same deadline', async () => {
    const deadline = Date.now() + 20_000;
    const { m, jira } = manager({ deadline });
    const res: any = await m.view({ projectKey: 'PAY', accountId: 'acc-1' }, true);
    expect(res.ok).toBe(true);
    expect(jira.searchProject.mock.calls[0][2]).toBe(deadline - VIEW_RESERVE_MS);
    expect(jira.remoteLinks.mock.calls[0][1]).toBe(deadline - VIEW_RESERVE_MS);
    expect(jira.visibleIssueIds.mock.calls[0][1]).toBe(deadline - VISIBLE_RESERVE_MS);
    expect(Array.from(jira.visibleIssueIds.mock.calls[0][2])).toEqual(['1']);
    expect(res.coverage).toEqual({ shown: 1, totalKnown: 3000, capped: true, timedOut: true });
  });

  it('uses now plus the budget when no deadline is given', async () => {
    const { m } = manager({ deadline: undefined as unknown as number });
    expect((await m.view({ projectKey: 'PAY' }, true) as any).ok).toBe(true);
  });
});

describe('F-L1: a failed project does not stop the scheduled run', () => {
  it('records the failure and builds the next project', async () => {
    const storage = new MemoryStorage();
    await storage.set('fr:projects', ['BAD', 'PAY']);
    const searchProject = jest.fn()
      .mockRejectedValueOnce(new Error('kvs value too large'))
      .mockResolvedValue({ facts: [makeFacts({ issueId: '1' })], capped: false, totalKnown: 1 });
    const { m } = manager({ deadline: Date.now() + 60_000, storage, searchProject });
    const res = await m.runScheduled(Date.now() + 60_000);
    expect(res.failed).toEqual(['BAD']);
    expect(res.built).toEqual(['PAY']);
  });
});
