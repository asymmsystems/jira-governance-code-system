/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: bounded snapshot storage unit tests (spec v2, Storage Schema)
 */

import { CHUNK_SIZE, MAX_PROJECTS, MAX_TREND_POINTS, SnapshotRepository } from '../../src/accessor/default-kvs-snapshot-accessor';
import { weekStartOf } from '../../src/engine/default-snapshot-engine';
import { DefaultMetricsEngine } from '../../src/engine/default-metrics-engine';
import { evaluateGates } from '../../src/engine/default-gate-engine';

const MetricsEngine = new DefaultMetricsEngine();
import { SnapshotMeta, TrendPoint } from '../../src/contract/data/models';
import { makeFacts } from '../domain/fixtures';
import { MemoryStorage } from './memory-storage';

const rows = (n: number) => Array.from({ length: n }, (_, i) => { const f = makeFacts({ issueId: String(i), issueKey: `DEMO-${i}` }); return MetricsEngine.buildRow(f, evaluateGates(f)); });
const meta = (id: string, n: number): SnapshotMeta => ({
  schemaVersion: 2, projectKey: 'DEMO', snapshotId: id, generatedAt: '2026-11-01T00:00:00.000Z', generatedBy: 'scheduled',
  chunkCount: Math.ceil(n / CHUNK_SIZE), shownCount: n, totalKnown: n, capped: false, remoteLinksRead: 0
});
const point = (weekStart: string, rai: number): TrendPoint => ({
  weekStart, generatedAt: `${weekStart}T01:00:00.000Z`, ratedIssues: 1, averageRAI: rai,
  gates: { intent: { found: 1, missing: 0 }, process: { found: 0, missing: 0 }, code: { found: 0, missing: 0 }, audit: { found: 0, missing: 0 } },
  startedIssues: 1, reworkIssues: 0
});

describe('SnapshotRepository snapshots', () => {
  it('stores rows in chunks of at most 100, writes the meta last, and reads them back', async () => {
    const storage = new MemoryStorage();
    const repo = new SnapshotRepository(storage);
    const data = rows(250);
    await repo.saveSnapshot(meta('s1', 250), data, MetricsEngine.summarize(data));
    const sets = storage.ops.filter(o => o.op === 'set').map(o => o.key);
    expect(sets).toEqual(['fr:p:DEMO:chunk:0', 'fr:p:DEMO:chunk:1', 'fr:p:DEMO:chunk:2', 'fr:p:DEMO:accounts', 'fr:p:DEMO:summary', 'fr:p:DEMO:meta']);
    expect((await storage.get<any>('fr:p:DEMO:chunk:2')).rows).toHaveLength(50);
    const loaded = await repo.loadSnapshot('DEMO');
    expect(loaded?.meta.snapshotId).toBe('s1');
    expect(loaded?.rows.map(r => r.issueKey)).toEqual(data.map(r => r.issueKey));
  });

  it('treats a missing chunk, a chunk from another snapshot or an old schema as no snapshot', async () => {
    const storage = new MemoryStorage();
    const repo = new SnapshotRepository(storage);
    expect(await repo.loadSnapshot('DEMO')).toBeUndefined();
    await repo.saveSnapshot(meta('s1', 150), rows(150), MetricsEngine.summarize([]));
    await storage.set('fr:p:DEMO:chunk:1', { snapshotId: 'other', rows: [] });
    expect(await repo.loadSnapshot('DEMO')).toBeUndefined();
    await storage.delete('fr:p:DEMO:chunk:1');
    expect(await repo.loadSnapshot('DEMO')).toBeUndefined();
    await storage.set('fr:p:DEMO:meta', { ...meta('s1', 0), schemaVersion: 1 });
    expect(await repo.loadSnapshot('DEMO')).toBeUndefined();
  });

  it('deletes chunks left over from a larger earlier snapshot', async () => {
    const storage = new MemoryStorage();
    const repo = new SnapshotRepository(storage);
    await repo.saveSnapshot(meta('s1', 250), rows(250), MetricsEngine.summarize([]));
    await repo.saveSnapshot(meta('s2', 50), rows(50), MetricsEngine.summarize([]));
    expect(storage.store.has('fr:p:DEMO:chunk:1')).toBe(false);
    expect(storage.store.has('fr:p:DEMO:chunk:2')).toBe(false);
    expect((await repo.loadSnapshot('DEMO'))?.rows).toHaveLength(50);
  });
});

describe('SnapshotRepository trend, registry and migration', () => {
  it('keeps one trend point per week, sorted, at most 52', async () => {
    const repo = new SnapshotRepository(new MemoryStorage());
    await repo.recordTrendPoint('DEMO', point('2026-10-26', 40));
    await repo.recordTrendPoint('DEMO', point('2026-10-19', 30));
    await repo.recordTrendPoint('DEMO', point('2026-10-26', 45));
    expect((await repo.getTrend('DEMO')).map(p => [p.weekStart, p.averageRAI])).toEqual([['2026-10-19', 30], ['2026-10-26', 45]]);
    for (let i = 0; i < 60; i++) {
      const d = new Date(Date.UTC(2025, 0, 6 + i * 7)).toISOString().slice(0, 10);
      await repo.recordTrendPoint('DEMO', point(d, i));
    }
    const trend = await repo.getTrend('DEMO');
    expect(trend).toHaveLength(MAX_TREND_POINTS);
    expect(trend[trend.length - 1].weekStart > trend[0].weekStart).toBe(true);
  });

  it('computes the Monday (UTC) that starts the ISO week', () => {
    expect(weekStartOf('2026-11-01T10:00:00.000Z')).toBe('2026-10-26');
    expect(weekStartOf('2026-10-26T00:00:00.000Z')).toBe('2026-10-26');
    expect(weekStartOf('2026-11-02T23:59:00.000Z')).toBe('2026-11-02');
  });

  it('registers each project once, at most 500', async () => {
    const storage = new MemoryStorage();
    const repo = new SnapshotRepository(storage);
    await repo.registerProject('DEMO');
    await repo.registerProject('DEMO');
    expect(await repo.listProjects()).toEqual(['DEMO']);
    expect(storage.count('set', /^fr:projects$/)).toBe(1);
    for (let i = 0; i < MAX_PROJECTS + 5; i++) await repo.registerProject(`P${i}`);
    expect(await repo.listProjects()).toHaveLength(MAX_PROJECTS);
  });

  it('deletes the v1 project keys and at most 100 v1 signals keys per call', async () => {
    const storage = new MemoryStorage();
    const repo = new SnapshotRepository(storage);
    await storage.set('fr:project:DEMO:latest', {});
    await storage.set('fr:project:DEMO:history', []);
    for (let i = 0; i < 130; i++) await storage.set(`fr:issue:${i}:signals`, {});
    await storage.set('fr:issue:5:exception', { reason: 'keep' });
    await repo.deleteV1ProjectKeys('DEMO');
    expect(storage.store.has('fr:project:DEMO:latest')).toBe(false);
    expect(storage.store.has('fr:project:DEMO:history')).toBe(false);
    expect(await repo.deleteV1Signals()).toBe(100);
    expect(await repo.deleteV1Signals()).toBe(30);
    expect(storage.store.has('fr:issue:5:exception')).toBe(true);
  });
});
