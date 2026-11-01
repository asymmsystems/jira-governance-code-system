/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the stored form of planning data is the Silverston WorkEffort model (B-24).
 */

import { toWorkEffortRecord, fromWorkEffortRecord, WorkEffortRecordBody } from '../../src/domain/models';

const FULL_ENTRY: any = {
  startDate: '2026-11-04', endDate: '2026-11-24', startWeek: '04-Nov', endWeek: '18-Nov', spanWeeks: 3,
  weeklyAllocations: { '04-Nov': 33, '11-Nov': 33, '18-Nov': 34 }, sequenceNum: 2500, isBacklog: false,
  targetProgress: 60, manualProgress: true, progress: 45,
  dependency: { predecessorKey: 'TEST-1', predecessorId: 'TEST-1', triggerPercent: 30, isTriggerSatisfied: false, jiraLinkId: '10077' },
  contributingResources: ['Ann Lee', 'Bo Chen'],
  effortConfig: { unit: 'STORY_POINTS', rawEstimate: 5, hoursConversionRatio: 8, subtasks: [], subtasksSumHours: 0,
    bufferType: 'PERCENTAGE', bufferValue: 10, bufferHours: 4, totalCalculatedHours: 44 },
  subtasks: [{ id: 'sub-1', summary: 'Local step', estimateValue: 2, estimateUnit: 'HOURS', normalizedHours: 2, status: 'NOT_STARTED' }]
};

describe('WorkEffort record (B-24)', () => {
  it('stores planning data as WorkEffort, WorkEffortAssoc, WorkEffortPartyAssignment and WorkEffortEstimate', () => {
    const rec: WorkEffortRecordBody = toWorkEffortRecord('TEST-2', FULL_ENTRY);
    expect(rec.effort).toEqual({
      workEffortId: 'TEST-2', estimatedStartDate: '2026-11-04', estimatedCompletionDate: '2026-11-24',
      sequenceNum: 2500, targetPercentComplete: 60, manualProgress: true, percentComplete: 45
    });
    expect(rec.assocs).toEqual([{ workEffortIdFrom: 'TEST-1', workEffortIdTo: 'TEST-2', workEffortAssocTypeId: 'FRACTIONAL_MILESTONE',
      triggerPercent: 30, isTriggerSatisfied: false, jiraLinkId: '10077' }]);
    expect(rec.parties).toEqual([
      { workEffortId: 'TEST-2', partyId: '', displayName: 'Ann Lee', roleTypeId: 'CONTRIBUTOR' },
      { workEffortId: 'TEST-2', partyId: '', displayName: 'Bo Chen', roleTypeId: 'CONTRIBUTOR' }
    ]);
    expect(rec.estimate).toEqual({ workEffortId: 'TEST-2', estimateUnit: 'STORY_POINTS', rawEstimate: 5, normalizedHours: 40,
      bufferType: 'PERCENTAGE', bufferValue: 10, totalCalculatedHours: 44 });
  });

  it('round-trips every stored field without loss', () => {
    const back = fromWorkEffortRecord(toWorkEffortRecord('TEST-2', FULL_ENTRY));
    expect(back).toEqual({ ...FULL_ENTRY, dependency: { ...FULL_ENTRY.dependency } });
  });

  it('round-trips a minimal entry, a removed dependency and an entry without a manual percent', () => {
    expect(fromWorkEffortRecord(toWorkEffortRecord('TEST-3', { startWeek: 'w', spanWeeks: 1 }))).toEqual({ startWeek: 'w', spanWeeks: 1 });
    const removed = toWorkEffortRecord('TEST-3', { dependency: null });
    expect(removed.assocs).toEqual([]);
    expect(removed.precedenceRemoved).toBe(true);
    expect(fromWorkEffortRecord(removed)).toEqual({ dependency: null });
    expect(toWorkEffortRecord('TEST-3', { progress: 50 } as any).effort.percentComplete).toBeUndefined();
  });

  it('never stores a Jira-owned field', () => {
    // Local sub-task items carry their own summary; they are app-owned and left out of this check.
    const rec = toWorkEffortRecord('TEST-4', { ...FULL_ENTRY, subtasks: undefined, summary: 'S', status: 'COMPLETED', resource: 'R', resourceAccountId: 'a',
      epic: 'E', epicKey: 'TEST-9', story: 'Story', effortHours: 99, parentKey: 'TEST-1', isSubtask: true, hierarchyLevel: -1 });
    const text = JSON.stringify(rec);
    for (const field of ['"summary"', '"status"', '"resource"', '"resourceAccountId"', '"epic"', '"epicKey"', '"story"', '"effortHours"', '"parentKey"', '"isSubtask"', '"hierarchyLevel"']) {
      expect(text).not.toContain(field);
    }
  });

  it('reads an older entry-shaped record unchanged', () => {
    expect(fromWorkEffortRecord({ startWeek: 'w', spanWeeks: 2 } as any)).toEqual({ startWeek: 'w', spanWeeks: 2 });
  });

  it('a full record stays far below 8 KiB', () => {
    expect(Buffer.byteLength(JSON.stringify(toWorkEffortRecord('TEST-1000', FULL_ENTRY)))).toBeLessThan(8 * 1024);
  });
});
