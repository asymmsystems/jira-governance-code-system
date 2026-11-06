/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: src/domain/drop-plan.ts, the drop computation shared by the server and the preview (H2).
 */

import { parentDueDateTargets, previewSingleMove, expandParentCascades, engineInputs } from '../../src/domain/drop-plan';

const today = '2026-11-01';

describe('drop plan', () => {
  it('a DEC-6 target carries the parent issue id, which the permission check needs', () => {
    const tasks = [
      { key: 'P-1', id: '10', startDate: '2026-12-01', endDate: '2026-12-05', datesFromChildren: true, jiraDueDate: '2026-12-05' },
      { key: 'S-1', id: '11', parentKey: 'P-1', startDate: '2026-12-01', endDate: '2026-12-05' }
    ];
    const t = parentDueDateTargets(tasks, new Map([['S-1', { startDate: '2026-12-08', endDate: '2026-12-12' }]]));
    expect(t.map(x => ({ key: x.key, id: x.id, endDate: x.endDate }))).toEqual([{ key: 'P-1', id: '10', endDate: '2026-12-12' }]);
    // Jira already holds the end: nothing to write.
    expect(parentDueDateTargets([{ ...tasks[0], jiraDueDate: '2026-12-12' }, tasks[1]], new Map([['S-1', { startDate: '2026-12-08', endDate: '2026-12-12' }]]))).toEqual([]);
  });

  it('a cascade into an epic is listed as not moved; the epic writes nothing', () => {
    const plan = { tasks: [
      { key: 'A-1', startDate: '2026-12-01', endDate: '2026-12-05' },
      { key: 'E-1', startDate: '2026-12-02', endDate: '2026-12-09', datesFromChildren: true, isEpic: true, hierarchyLevel: 1, dependencies: [{ predecessorKey: 'A-1', triggerPercent: 100 }] },
      { key: 'T-1', parentKey: 'E-1', startDate: '2026-12-02', endDate: '2026-12-09' }
    ] };
    const p = previewSingleMove(plan, 'A-1', '2026-12-04', '2026-12-08', today);
    expect(p.epics).toEqual(['E-1']);
    expect([...p.moves.keys()]).toEqual(['A-1']);
  });

  it('a parent change with no day shift and a parent without dates move nothing', () => {
    const tasks = [{ key: 'P-1', startDate: '2026-12-01', endDate: '2026-12-05', datesFromChildren: true }, { key: 'P-2', datesFromChildren: true }];
    expect(expandParentCascades([{ key: 'P-1', toStart: '2026-12-01', toEnd: '2026-12-05' }, { key: 'P-2', toStart: '2026-12-01', toEnd: '2026-12-05' }], tasks, today).changes).toEqual([]);
    expect(engineInputs([{ key: 'X-1', startDate: '2026-12-01', status: 'IN_PROGRESS', dependency: { predecessorKey: 'Y-1', triggerPercent: 50 } }]).links).toHaveLength(1);
  });
});
