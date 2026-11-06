/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: both managers keep the rollback history (merge review N-3), and the snapshot
 * writes it in batches inside the page view's time (N-1).
 */

import { DEFAULT_SOURCE_SETTINGS, IssueFacts } from '../../src/contract/data/models';
import { DefaultSnapshotManager, HISTORY_BATCH, HISTORY_GRACE_MS } from '../../src/manager/default-snapshot-manager';
import { DefaultIssueEvidenceManager } from '../../src/manager/default-issue-evidence-manager';
import { DefaultExceptionPolicyEngine } from '../../src/engine/default-exception-policy-engine';
import { DefaultGateEngine } from '../../src/engine/default-gate-engine';
import { DefaultMetricsEngine } from '../../src/engine/default-metrics-engine';
import { DefaultSnapshotEngine } from '../../src/engine/default-snapshot-engine';
import { DefaultSourcePolicyEngine } from '../../src/engine/default-source-policy-engine';
import { DefaultPolicyEngine } from '../../src/engine/default-policy-engine';
import { DefaultKvsSnapshotAccessor } from '../../src/accessor/default-kvs-snapshot-accessor';
import { DefaultKvsAttestationHistoryAccessor } from '../../src/accessor/default-kvs-attestation-history-accessor';
import { MemoryStorage } from '../storage/memory-storage';
import { makeFacts } from '../domain/fixtures';

const CONFIG = { devFieldId: null, siteHost: 's', statusCategories: {}, pullRequestsSeen: false, readAt: 't' };
const SETTINGS = { ...DEFAULT_SOURCE_SETTINGS, audit: 'ledgerseal' as const };
const seal = (issueId: string, status: string, issuedAt: string) => ({
  schemaVersion: 3, issueId, status, certificateId: '3f0c2a52-7d1b-4c47-9a51-0d6e3b8a9f10', snapshotHash: 'b'.repeat(64), sealedAt: '2026-11-06T09:00:00.000Z', issuedAt
});
const sealed = (issueId: string, status: string, issuedAt: string): IssueFacts =>
  makeFacts({ issueId, issueKey: `PAY-${issueId}`, properties: { ledgerseal: seal(issueId, status, issuedAt) }, attestations: { ledgerseal: 'VERIFIED' } });

const settings = { serviceType: 'accessor', getSettings: async () => SETTINGS, getDetected: async () => ({}), saveDetected: async () => undefined } as any;

function snapshotManager(storage: MemoryStorage, facts: () => IssueFacts[], history = new DefaultKvsAttestationHistoryAccessor(storage)) {
  const jira: any = {
    serviceType: 'accessor',
    searchProject: jest.fn(async () => ({ facts: facts(), capped: false, totalKnown: facts().length })),
    remoteLinks: jest.fn().mockResolvedValue(new Map()),
    visibleIssueIds: jest.fn(async () => ({ ids: new Set(facts().map(f => f.issueId)), complete: true }))
  };
  return new DefaultSnapshotManager({
    jira, viewerJira: jira, budgetMs: 20_000,
    siteConfig: { serviceType: 'accessor', get: async () => CONFIG },
    snapshots: new DefaultKvsSnapshotAccessor(storage),
    notes: { serviceType: 'accessor', listAll: async () => new Map(), migrateV2ReworkNotes: async () => 0 } as any,
    events: { serviceType: 'accessor', listAll: async () => new Map(), migrateV2CodeNotes: async () => 0 } as any,
    lifecycle: new DefaultExceptionPolicyEngine(), gates: new DefaultGateEngine(), metrics: new DefaultMetricsEngine(), snapshot: new DefaultSnapshotEngine(),
    settings, sources: new DefaultSourcePolicyEngine(),
    directory: { serviceType: 'accessor', userNames: async () => ({}) } as any,
    confluence: { serviceType: 'accessor', existingPages: async () => null, checkPages: async (m: any) => m } as any,
    history
  });
}

describe('N-3: the snapshot keeps the rollback history', () => {
  it('stores a verified record, then rejects an older one put back', async () => {
    const storage = new MemoryStorage();
    let current = [sealed('1', 'SEAL_BROKEN', '2026-11-06T10:00:00.000Z')];
    const m = snapshotManager(storage, () => current);
    await m.build('PAY', 'user', Date.now() + 10_000);
    expect(storage.store.get('fr:att:1')).toEqual({ ledgerseal: { issuedAt: '2026-11-06T10:00:00.000Z' } });
    current = [sealed('1', 'SEAL_VALID', '2026-11-06T09:00:00.000Z')];
    const second: any = await m.build('PAY', 'user', Date.now() + 10_000);
    expect(second.rows[0].gates.audit).toMatchObject({ state: 'MISSING', reason: 'SEAL_SIGNATURE_INVALID', args: { why: 'older than a record already seen' } });
  });
});

describe('N-3: the issue panel keeps the rollback history', () => {
  it('stores a verified record, then rejects an older one put back', async () => {
    const storage = new MemoryStorage();
    let current = sealed('1', 'SEAL_BROKEN', '2026-11-06T10:00:00.000Z');
    const m = new DefaultIssueEvidenceManager({
      userJira: { serviceType: 'accessor', readIssue: async () => ({ status: 200, facts: current }) } as any,
      siteConfig: { serviceType: 'accessor', get: async () => CONFIG } as any,
      notes: { serviceType: 'accessor', list: async () => [] } as any,
      events: { serviceType: 'accessor', list: async () => [] } as any,
      lifecycle: new DefaultExceptionPolicyEngine(), gates: new DefaultGateEngine(), metrics: new DefaultMetricsEngine(), policy: new DefaultPolicyEngine(),
      settings, sources: new DefaultSourcePolicyEngine(),
      confluence: { serviceType: 'accessor', existingPages: async () => null, checkPages: async (m2: any) => m2 } as any,
      history: new DefaultKvsAttestationHistoryAccessor(storage)
    });
    await m.evaluate({ issueId: '1', issueKey: 'PAY-1' });
    expect(storage.store.get('fr:att:1')).toEqual({ ledgerseal: { issuedAt: '2026-11-06T10:00:00.000Z' } });
    current = sealed('1', 'SEAL_VALID', '2026-11-06T09:00:00.000Z');
    const res: any = await m.evaluate({ issueId: '1', issueKey: 'PAY-1' });
    expect(res.row.gates.audit).toMatchObject({ state: 'MISSING', reason: 'SEAL_SIGNATURE_INVALID' });
  });
});

describe('N-1: history writes on a large site stay inside the page view', () => {
  const site = Array.from({ length: 2000 }, (_, i) => sealed(String(i + 1), 'SEAL_VALID', '2026-11-06T10:00:00.000Z'));

  /** A history store whose writes take time, counting parallel writes. */
  function slowHistory(storage: MemoryStorage, ms: number) {
    const real = new DefaultKvsAttestationHistoryAccessor(storage);
    const stats = { writes: 0, inFlight: 0, maxInFlight: 0 };
    const history: any = {
      serviceType: 'accessor',
      get: (id: string) => real.get(id),
      listAll: () => real.listAll(),
      raise: async (id: string, seen: any, current: any) => {
        stats.inFlight++;
        stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
        await new Promise(resolve => setTimeout(resolve, ms));
        stats.inFlight--;
        stats.writes++;
        return real.raise(id, seen, current);
      }
    };
    return { history, stats };
  }

  it('saves the snapshot first and stops the writes at the time limit', async () => {
    const storage = new MemoryStorage();
    const { history, stats } = slowHistory(storage, 30);
    const m = snapshotManager(storage, () => site, history);
    const started = Date.now();
    // About 0.8 s for the writes: 2,000 writes of 30 ms in batches of 25 would need 2.4 s.
    const res: any = await m.build('PAY', 'user', Date.now() - HISTORY_GRACE_MS + 800);
    expect(res.ok).toBe(true);
    expect(storage.store.has('fr:p:PAY:meta')).toBe(true);
    expect(stats.writes).toBeGreaterThan(0);
    expect(stats.writes).toBeLessThan(2000);
    expect(Date.now() - started).toBeLessThan(2400);
  });

  it('writes in parallel batches, and finishes the rest on the next build', async () => {
    const storage = new MemoryStorage();
    const { history, stats } = slowHistory(storage, 1);
    const m = snapshotManager(storage, () => site, history);
    await m.build('PAY', 'user', Date.now() - HISTORY_GRACE_MS + 30);
    const first = stats.writes;
    await m.build('PAY', 'user', Date.now() + 60_000);
    expect(stats.maxInFlight).toBe(HISTORY_BATCH);
    expect(Array.from(storage.store.keys()).filter(k => k.startsWith('fr:att:'))).toHaveLength(2000);
    expect(first).toBeLessThan(2000);
  });
});
