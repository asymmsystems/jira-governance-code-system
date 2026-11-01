/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import { buildWhyModel } from '../../src/ui/why';

const tasks: any[] = [
  { key: 'A', summary: 'Schema', startDate: '2026-11-04', endDate: '2026-11-13' },
  { key: 'B', summary: 'API', startDate: '2026-11-09', endDate: '2026-11-20',
    dependency: { predecessorKey: 'A', triggerPercent: 50, triggerDate: '2026-11-08', earliestStartDate: '2026-11-09',
      earliestStartReason: 'Starts 2026-11-09 because A reaches 50% on 2026-11-08 (planned: 10 days).', driverKey: 'A', isViolated: false } },
  { key: 'C', summary: 'UI', startDate: '2026-11-10', endDate: '2026-11-25',
    dependency: { predecessorKey: 'B', triggerPercent: 30, triggerDate: '2026-11-12', earliestStartDate: '2026-11-13',
      earliestStartReason: 'Starts 2026-11-13 because B reaches 30% on 2026-11-12 (planned: 12 days).', driverKey: 'B', isViolated: true,
      fixSuggestion: 'Move C to 2026-11-13 or lower the trigger to 8%.',
      fixOptions: [{ kind: 'move', startDate: '2026-11-13', endDate: '2026-11-28' }, { kind: 'trigger', triggerPercent: 8 }] } }
];

describe('buildWhyModel (B-12)', () => {
  it('lists the driver chain back to the first task with no constraint', () => {
    const m = buildWhyModel(tasks, 'C')!;
    expect(m.title).toBe('Why C starts on 2026-11-10');
    expect(m.reason).toBe('Starts 2026-11-13 because B reaches 30% on 2026-11-12 (planned: 12 days).');
    expect(m.chain).toEqual([
      { key: 'B', text: 'B: starts when A reaches 50% (2026-11-08)' },
      { key: 'A', text: 'A: no dependency; starts 2026-11-04' }
    ]);
    expect(m.violation).toBe('Move C to 2026-11-13 or lower the trigger to 8%.');
    expect(m.fixes).toEqual([
      { label: 'Move C to 2026-11-13', updates: { startDate: '2026-11-13', endDate: '2026-11-28' } },
      { label: 'Lower the trigger to 8%', updates: { dependency: { predecessorId: 'B', predecessorKey: 'B', triggerPercent: 8, isTriggerSatisfied: false } } }
    ]);
    expect(m.driverKeys).toEqual(['B', 'A']);
  });

  it('explains a task with no dependency and a task that is not on the plan', () => {
    expect(buildWhyModel(tasks, 'A')).toEqual({ title: 'Why A starts on 2026-11-04', reason: 'A has no dependency. Its start date is the one set on the plan.',
      chain: [], fixes: [], driverKeys: [] });
    expect(buildWhyModel(tasks, 'ZZ')).toBeNull();
  });

  it('stops on a loop and on a missing predecessor', () => {
    const loop: any[] = [
      { key: 'X', startDate: '2026-11-04', dependency: { predecessorKey: 'Y', triggerPercent: 10, driverKey: 'Y', earliestStartReason: 'r' } },
      { key: 'Y', startDate: '2026-11-04', dependency: { predecessorKey: 'X', triggerPercent: 10, driverKey: 'X', earliestStartReason: 'r' } }
    ];
    expect(buildWhyModel(loop, 'X')!.chain.map(c => c.key)).toEqual(['Y']);
    const missing: any[] = [{ key: 'M', startDate: '2026-11-04', dependency: { predecessorKey: 'GONE', triggerPercent: 10, isViolated: true, violationReason: 'Predecessor GONE is not on the plan.' } }];
    const m = buildWhyModel(missing, 'M')!;
    expect(m.reason).toBe('Predecessor GONE is not on the plan.');
    expect(m.chain).toEqual([]);
  });
});
