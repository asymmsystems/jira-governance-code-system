/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the stored form of planning data is the Silverston WorkEffort model (B-24, B-28).
 * Pattern reference: Apache OFBiz workeffort-entitymodel.xml (silverston-conformance.md).
 */

import * as fs from 'fs';
import * as path from 'path';
import { toWorkEffortRecord, fromWorkEffortRecord, WorkEffortRecordBody, WORK_EFFORT_MODEL } from '../../src/domain/models';

const FULL_ENTRY: any = {
  startDate: '2026-11-04', endDate: '2026-11-24', startWeek: '04-Nov', endWeek: '18-Nov', spanWeeks: 3,
  weeklyAllocations: { '04-Nov': 33, '11-Nov': 33, '18-Nov': 34 }, sequenceNum: 2500, isBacklog: false,
  targetProgress: 60, manualProgress: true, progress: 45,
  dependencies: [
    { predecessorKey: 'TEST-1', predecessorId: 'TEST-1', triggerPercent: 30, isTriggerSatisfied: false, jiraLinkId: '10077', since: '2026-10-01' },
    { predecessorKey: 'TEST-5', predecessorId: 'TEST-5', triggerPercent: 100, isTriggerSatisfied: false, since: '2026-10-02' }
  ],
  endedLinks: [{ predecessorKey: 'TEST-7', triggerPercent: 50, since: '2026-09-01', until: '2026-10-01', jiraLinkId: '10050' }],
  contributors: [{ accountId: 'acc-1', since: '2026-10-03', subtaskKey: 'TEST-21' }, { legacyName: 'Bo Chen', since: '2026-10-04' }],
  effortConfig: { unit: 'STORY_POINTS', rawEstimate: 5, hoursConversionRatio: 8, subtasks: [], subtasksSumHours: 0,
    bufferType: 'PERCENTAGE', bufferValue: 10, bufferHours: 4, totalCalculatedHours: 44 },
  subtasks: [{ id: 'sub-1', summary: 'Local step', estimateValue: 2, estimateUnit: 'HOURS', normalizedHours: 2, status: 'NOT_STARTED' }]
};

describe('WorkEffort record (B-24, B-28)', () => {
  it('stores links as time-bound WORK_EFF_PRECEDENCY associations with attributes, and no engine output', () => {
    const rec: WorkEffortRecordBody = toWorkEffortRecord('TEST-2', FULL_ENTRY, '2026-11-01');
    expect(rec.model).toBe(WORK_EFFORT_MODEL);
    expect(rec.effort).toEqual({
      workEffortId: 'TEST-2', estimatedStartDate: '2026-11-04', estimatedCompletionDate: '2026-11-24',
      sequenceNum: 2500, targetPercentComplete: 60, manualProgress: true, percentComplete: 45
    });
    expect(rec.assocs).toEqual([
      { workEffortIdFrom: 'TEST-1', workEffortIdTo: 'TEST-2', workEffortAssocTypeId: 'WORK_EFF_PRECEDENCY', fromDate: '2026-10-01', attrs: { triggerPercent: 30, jiraLinkId: '10077' } },
      { workEffortIdFrom: 'TEST-5', workEffortIdTo: 'TEST-2', workEffortAssocTypeId: 'WORK_EFF_PRECEDENCY', fromDate: '2026-10-02', attrs: { triggerPercent: 100 } },
      { workEffortIdFrom: 'TEST-7', workEffortIdTo: 'TEST-2', workEffortAssocTypeId: 'WORK_EFF_PRECEDENCY', fromDate: '2026-09-01', thruDate: '2026-10-01', attrs: { triggerPercent: 50, jiraLinkId: '10050' } }
    ]);
    expect(JSON.stringify(rec)).not.toMatch(/isTriggerSatisfied|isViolated|violationReason|precedenceRemoved|FRACTIONAL_MILESTONE/);
  });

  it('stores second people by account id with a role and a from date; a legacy name only when no account id is known', () => {
    expect(toWorkEffortRecord('TEST-2', FULL_ENTRY, '2026-11-01').parties).toEqual([
      { workEffortId: 'TEST-2', partyId: 'acc-1', roleTypeId: 'CONTRIBUTOR', fromDate: '2026-10-03', subtaskKey: 'TEST-21' },
      { workEffortId: 'TEST-2', legacyName: 'Bo Chen', roleTypeId: 'CONTRIBUTOR', fromDate: '2026-10-04' }
    ]);
  });

  it('round-trips every stored field without loss, with dependency as the first active link', () => {
    const back = fromWorkEffortRecord(toWorkEffortRecord('TEST-2', FULL_ENTRY, '2026-11-01'));
    expect(back).toEqual({ ...FULL_ENTRY, dependency: FULL_ENTRY.dependencies[0] });
  });

  it('a single dependency in an update is stored from today; no link and no people store empty lists', () => {
    const rec = toWorkEffortRecord('TEST-3', { dependency: { predecessorKey: 'TEST-1', predecessorId: 'TEST-1', triggerPercent: 40, isTriggerSatisfied: false } }, '2026-11-01');
    expect(rec.assocs[0]).toEqual({ workEffortIdFrom: 'TEST-1', workEffortIdTo: 'TEST-3', workEffortAssocTypeId: 'WORK_EFF_PRECEDENCY', fromDate: '2026-11-01', attrs: { triggerPercent: 40 } });
    const empty = toWorkEffortRecord('TEST-3', { startWeek: 'w', spanWeeks: 1, dependency: null }, '2026-11-01');
    expect(empty.assocs).toEqual([]);
    expect(empty.parties).toEqual([]);
    expect(fromWorkEffortRecord(empty)).toEqual({ startWeek: 'w', spanWeeks: 1 });
    expect(toWorkEffortRecord('TEST-3', { progress: 50 } as any).effort.percentComplete).toBeUndefined();
  });

  it('never stores a Jira-owned field', () => {
    const rec = toWorkEffortRecord('TEST-4', { ...FULL_ENTRY, subtasks: undefined, summary: 'S', status: 'COMPLETED', resource: 'R', resourceAccountId: 'a',
      epic: 'E', epicKey: 'TEST-9', story: 'Story', effortHours: 99, parentKey: 'TEST-1', isSubtask: true, hierarchyLevel: -1,
      contributingResources: ['Ann Lee'], jiraDueDate: '2026-12-01' });
    const text = JSON.stringify(rec);
    for (const field of ['"summary"', '"status"', '"resource"', '"resourceAccountId"', '"epic"', '"epicKey"', '"story"', '"effortHours"', '"parentKey"',
      '"isSubtask"', '"hierarchyLevel"', '"contributingResources"', '"displayName"', '"jiraDueDate"']) {
      expect(text).not.toContain(field);
    }
  });

  it('reads a model 1 record (B-24 shape) so the migration can convert it', () => {
    const old: any = { effort: { workEffortId: 'TEST-2', estimatedStartDate: '2026-11-04' },
      assocs: [{ workEffortIdFrom: 'TEST-1', workEffortIdTo: 'TEST-2', workEffortAssocTypeId: 'FRACTIONAL_MILESTONE', triggerPercent: 30, isTriggerSatisfied: false, jiraLinkId: '5' }],
      parties: [{ workEffortId: 'TEST-2', partyId: '', displayName: 'Ann Lee', roleTypeId: 'CONTRIBUTOR' }] };
    expect(fromWorkEffortRecord(old)).toEqual({ model: 1, startDate: '2026-11-04',
      dependency: { predecessorKey: 'TEST-1', predecessorId: 'TEST-1', triggerPercent: 30, isTriggerSatisfied: false, jiraLinkId: '5' },
      contributingResources: ['Ann Lee'] });
    expect(fromWorkEffortRecord({ effort: { workEffortId: 'X-1' }, assocs: [], parties: [], precedenceRemoved: true } as any)).toEqual({ model: 1, dependency: null });
    expect(fromWorkEffortRecord({ startWeek: 'w', spanWeeks: 2 } as any)).toEqual({ model: 1, startWeek: 'w', spanWeeks: 2 });
  });

  it('defaults: an ended link without a start or trigger, a person without a date, and model 1 records without lists', () => {
    const rec = toWorkEffortRecord('TEST-3', { endedLinks: [{ predecessorKey: 'TEST-1', until: '2026-10-01' }],
      contributors: [{ accountId: 'acc-9', legacyName: 'Old Name' }] }, '2026-11-01');
    expect(rec.assocs).toEqual([{ workEffortIdFrom: 'TEST-1', workEffortIdTo: 'TEST-3', workEffortAssocTypeId: 'WORK_EFF_PRECEDENCY',
      fromDate: '2026-10-01', thruDate: '2026-10-01', attrs: { triggerPercent: 100 } }]);
    expect(rec.parties).toEqual([{ workEffortId: 'TEST-3', partyId: 'acc-9', roleTypeId: 'CONTRIBUTOR', fromDate: '2026-11-01' }]);
    expect(fromWorkEffortRecord({ effort: { workEffortId: 'X-1' } } as any)).toEqual({ model: 1 });
    expect(fromWorkEffortRecord({ effort: { workEffortId: 'X-1' }, assocs: [{ workEffortIdFrom: 'X-0', workEffortAssocTypeId: 'PRECEDENCE', triggerPercent: 100 }] } as any).dependency)
      .toEqual({ predecessorId: 'X-0', predecessorKey: 'X-0', triggerPercent: 100, isTriggerSatisfied: false });
  });

  it('a full record stays far below 8 KiB', () => {
    expect(Buffer.byteLength(JSON.stringify(toWorkEffortRecord('TEST-1000', FULL_ENTRY)))).toBeLessThan(8 * 1024);
  });

  it('the unused converters, types, statuses and roles are gone (B-28 criterion 7)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../src/domain/models.ts'), 'utf8');
    for (const name of ['function toWorkEffort(', 'function fromWorkEffort(', 'WorkEffortStatus', "'EPIC'", 'QA_LEAD', 'PRIMARY_ASSIGNEE', 'lagTimeDays']) {
      expect(src).not.toContain(name);
    }
    // FRACTIONAL_MILESTONE appears only in the model 1 reader that the migration uses.
    expect(src.match(/export type WorkEffortAssocType = [^;]*;/)![0]).not.toContain('FRACTIONAL_MILESTONE');
  });
});
