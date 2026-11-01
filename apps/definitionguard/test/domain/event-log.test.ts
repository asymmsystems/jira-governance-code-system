/**
 * Change log (spec v3): canonical JSON, chaining, Silverston-shaped rows and the fold (B-03, B-21).
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import {
  canonicalJson,
  hashEntry,
  genesisHash,
  emptyState,
  makeEntry,
  createEntry,
  migrateEntry,
  stateFromLegacy,
  legacyRefOf,
  applyEntry,
  statusEntry,
  resetEntry,
  criterionWorkEffortId,
  issueWorkEffortId
} from '../../src/domain/event-log';
import { toDodTemplate, toTemplateView } from '../../src/domain/dod-template';
import { isValidChange, invalidChangeMessage, STATUS_VALID_CHANGES, STATUS_ITEMS } from '../../src/domain/dod-status';
import { permissionKeyOf, roleOfPermission } from '../../src/domain/roles';
import { ChecklistEngine, DEFAULT_DEFINITION_OF_DONE } from '../../src/domain/checklist-engine';
import { T, created, tick, untick, append, statusRow, criterion } from '../helpers/dod';

describe('canonicalJson', () => {
  it('sorts keys at every level and drops undefined fields', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[1,{"y":2,"z":1}]},"b":1}');
  });

  it('keeps nulls, writes undefined array entries as null, and handles scalars', () => {
    expect(canonicalJson([null, undefined, 'x', 2, true])).toBe('[null,null,"x",2,true]');
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson('s')).toBe('"s"');
  });
});

describe('hashing and chaining', () => {
  it('gives a different genesis hash per issue', () => {
    expect(genesisHash('1')).not.toBe(genesisHash('2'));
    expect(genesisHash('1')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashEntry ignores the hash field and covers every other field, rows included', () => {
    const { state } = created('9', DEFAULT_DEFINITION_OF_DONE);
    const e = makeEntry(state, tick('item-unit-tests', 'a')(state)[0]);
    expect(hashEntry({ ...e, hash: 'anything' })).toBe(e.hash);
    expect(hashEntry({ ...e, actorPartyId: 'b' })).not.toBe(e.hash);
    expect(hashEntry({ ...e, rows: [{ ...e.rows[0], setByPartyId: 'b' } as any] })).not.toBe(e.hash);
  });

  it('makeEntry chains to the state head and increments seq', () => {
    const base = emptyState('9', 'D-9', 'p');
    const e = makeEntry(base, { transitionName: 'Reset', at: T, actorPartyId: 'a', rows: [] });
    expect(e).toMatchObject({ seq: 1, issueId: '9', prevHash: genesisHash('9') });
  });
});

describe('Create: the issue WorkEffort, its criteria and the associations', () => {
  it('writes WorkEffort ISSUE, WORK_EFF_TEMPLATE, and a DOD_CRITERION WorkEffort with a WORK_EFF_BREAKDOWN link per item', () => {
    const { entry, state } = created('9', DEFAULT_DEFINITION_OF_DONE);
    expect(entry.transitionName).toBe('Create');
    expect(entry.rows[0]).toEqual({ entity: 'WorkEffort', workEffortId: 'issue:9', workEffortTypeId: 'ISSUE', sourceReferenceId: '9', workEffortName: 'DEMO-9', projectId: '10000' });
    expect(entry.rows[1]).toEqual({ entity: 'WorkEffortAssoc', workEffortIdFrom: DEFAULT_DEFINITION_OF_DONE.id, workEffortIdTo: 'issue:9', workEffortAssocTypeId: 'WORK_EFF_TEMPLATE', revisionNumber: 1, waiverRoleTypeId: 'PROJECT_ADMIN', fromDate: T });
    expect(entry.rows[2]).toMatchObject({ entity: 'WorkEffort', workEffortId: 'crit:9:item-unit-tests', workEffortTypeId: 'DOD_CRITERION', templateItemId: 'item-unit-tests', isMandatory: true, purposeTypeId: 'TESTING' });
    expect(entry.rows[3]).toEqual({ entity: 'WorkEffortAssoc', workEffortIdFrom: 'issue:9', workEffortIdTo: 'crit:9:item-unit-tests', workEffortAssocTypeId: 'WORK_EFF_BREAKDOWN', sequenceNum: 1, fromDate: T });
    expect(entry.rows.filter(r => r.entity === 'WorkEffortAssoc' && r.workEffortAssocTypeId === 'WORK_EFF_BREAKDOWN')).toHaveLength(DEFAULT_DEFINITION_OF_DONE.items.length);
    expect(state.criteria.map(c => c.templateItemId)).toEqual(DEFAULT_DEFINITION_OF_DONE.items.map(i => i.id));
    expect(state.criteria.every(c => c.currentStatusId === 'DOD_OPEN')).toBe(true);
    expect(state.template).toEqual({ workEffortId: DEFAULT_DEFINITION_OF_DONE.id, revisionNumber: 1, waiverRoleTypeId: 'PROJECT_ADMIN' });
  });

  it('orders criteria by the breakdown sequenceNum', () => {
    const { entry } = created('9', DEFAULT_DEFINITION_OF_DONE);
    const swapped = entry.rows.map(r => (r.entity === 'WorkEffortAssoc' && r.workEffortIdTo === 'crit:9:item-unit-tests' ? { ...r, sequenceNum: 99 } : r));
    const st = applyEntry(emptyState('9', 'DEMO-9', '10000'), { ...entry, rows: swapped });
    expect(st.criteria[st.criteria.length - 1].templateItemId).toBe('item-unit-tests');
  });
});

describe('status changes: WorkEffortStatus rows and StatusValidChange', () => {
  it('Complete writes one WorkEffortStatus row with setByPartyId and statusDatetime', () => {
    const { state } = created('9', DEFAULT_DEFINITION_OF_DONE);
    const { state: s2, entries } = append(state, tick('item-unit-tests', 'acc-a')(state));
    expect(entries[0].rows).toEqual([{ entity: 'WorkEffortStatus', workEffortId: 'crit:9:item-unit-tests', statusId: 'DOD_DONE', statusDatetime: T, setByPartyId: 'acc-a' }]);
    expect(criterion(s2, 'item-unit-tests')).toMatchObject({ currentStatusId: 'DOD_DONE', lastStatusByPartyId: 'acc-a', lastStatusUpdate: T, lastStatusSeq: 2 });
  });

  it('evidence is a Content row linked by WorkEffortContent from the same moment', () => {
    const { state } = created('9', DEFAULT_DEFINITION_OF_DONE);
    const { state: s2, entries } = append(state, tick('item-unit-tests', 'a', T, { url: 'https://ci/1', note: 'green' })(state));
    expect(entries[0].rows.slice(1)).toEqual([
      { entity: 'Content', contentId: 'content:9:2', contentTypeId: 'DOD_EVIDENCE', objectInfo: 'https://ci/1', textData: 'green' },
      { entity: 'WorkEffortContent', workEffortId: 'crit:9:item-unit-tests', contentId: 'content:9:2', workEffortContentTypeId: 'DOD_EVIDENCE', fromDate: T }
    ]);
    expect(criterion(s2, 'item-unit-tests').evidenceContentId).toBe('content:9:2');
  });

  it('ignores evidence whose fromDate is not the DONE moment, and a reopen ends it', () => {
    const { state } = created('9', DEFAULT_DEFINITION_OF_DONE);
    const input = tick('item-unit-tests', 'a', T, { note: 'n' })(state)[0];
    (input.rows[2] as any).fromDate = '2025-01-01T00:00:00.000Z';
    expect(criterion(append(state, [input]).state, 'item-unit-tests').evidenceContentId).toBeUndefined();
    const done = append(state, tick('item-unit-tests', 'a', T, { note: 'n' })(state)).state;
    const reopened = append(done, untick('item-unit-tests', 'a')(done)).state;
    expect(criterion(reopened, 'item-unit-tests')).toMatchObject({ currentStatusId: 'DOD_OPEN', evidenceContentId: undefined, lastStatusByPartyId: undefined });
  });

  it('Waive keeps the reason on the WorkEffortStatus row', () => {
    const { state } = created('9', DEFAULT_DEFINITION_OF_DONE);
    const input = statusEntry(state, { templateItemId: 'item-peer-review', statusIdTo: 'DOD_WAIVED', transitionName: 'Waive', actorPartyId: 'lead', at: T, reason: 'Pair-programmed' });
    const { state: s2, entries } = append(state, [input]);
    expect(statusRow(entries[0])).toMatchObject({ statusId: 'DOD_WAIVED', reason: 'Pair-programmed', setByPartyId: 'lead' });
    expect(criterion(s2, 'item-peer-review').currentStatusId).toBe('DOD_WAIVED');
  });

  it('refuses changes the StatusValidChange table does not allow, before any entry is made', () => {
    const { state } = created('9', DEFAULT_DEFINITION_OF_DONE);
    const done = append(state, tick('item-unit-tests', 'a')(state)).state;
    expect(() => tick('item-unit-tests', 'a')(done)).toThrow('This item is already done.');
    expect(() => untick('item-unit-tests', 'a')(state)).toThrow('This item is already open.');
    expect(() => statusEntry(done, { templateItemId: 'item-unit-tests', statusIdTo: 'DOD_WAIVED', transitionName: 'Waive', actorPartyId: 'a', at: T })).toThrow('Only an open item can be waived.');
    const waived = append(state, [statusEntry(state, { templateItemId: 'item-unit-tests', statusIdTo: 'DOD_WAIVED', transitionName: 'Waive', actorPartyId: 'a', at: T, reason: 'x' })]).state;
    expect(() => tick('item-unit-tests', 'a')(waived)).toThrow('A waived item must be reopened before it can be completed.');
    expect(() => tick('nope', 'a')(state)).toThrow("Checklist item with id 'nope' not found on issue DEMO-9");
  });

  it('the fold rejects a stored status row that breaks the table', () => {
    const { state } = created('9', DEFAULT_DEFINITION_OF_DONE);
    const bad = makeEntry(state, { transitionName: 'Complete', at: T, actorPartyId: 'a', rows: [{ entity: 'WorkEffortStatus', workEffortId: 'crit:9:item-unit-tests', statusId: 'DOD_WAIVED', statusDatetime: T, setByPartyId: 'a' }] });
    expect(() => applyEntry(state, bad)).toThrow('DOD_OPEN to DOD_WAIVED is not a valid Complete');
    const unknown = makeEntry(state, { transitionName: 'Complete', at: T, actorPartyId: 'a', rows: [{ entity: 'WorkEffortStatus', workEffortId: 'crit:9:ghost', statusId: 'DOD_DONE', statusDatetime: T, setByPartyId: 'a' }] });
    expect(() => applyEntry(state, unknown)).toThrow('status for unknown criterion crit:9:ghost');
  });

  it('Reset writes a DOD_OPEN row with a reason for every criterion that is not open', () => {
    const { state } = created('9', DEFAULT_DEFINITION_OF_DONE);
    const s2 = append(state, tick('item-unit-tests', 'a')(state)).state;
    const reset = resetEntry(s2, 'admin', T);
    expect(reset.rows).toEqual([{ entity: 'WorkEffortStatus', workEffortId: 'crit:9:item-unit-tests', statusId: 'DOD_OPEN', statusDatetime: T, setByPartyId: 'admin', reason: 'Checklist reset' }]);
    expect(append(s2, [reset]).state.criteria.every(c => c.currentStatusId === 'DOD_OPEN')).toBe(true);
    expect(resetEntry(state, 'admin', T).rows).toEqual([]);
  });
});

describe('applyEntry checks', () => {
  const { state, entry } = created('9', DEFAULT_DEFINITION_OF_DONE);
  const base = emptyState('9', 'DEMO-9', '10000');

  it('rejects an entry out of sequence, for another issue, or with a broken prevHash', () => {
    expect(() => applyEntry(base, { ...entry, seq: 2 })).toThrow('sequence');
    expect(() => applyEntry(base, { ...entry, issueId: '8' })).toThrow('another issue');
    expect(() => applyEntry(base, { ...entry, prevHash: 'bad' })).toThrow('prevHash');
  });

  it('records the last modifier and head', () => {
    expect(state).toMatchObject({ seq: 1, headHash: entry.hash, lastModifiedByPartyId: 'creator', lastModifiedAt: T });
  });

  it('keeps an existing criterion status when a later entry restates the criterion (Resync)', () => {
    const s2 = append(state, tick('item-unit-tests', 'a')(state)).state;
    const restated = createEntry(s2, toDodTemplate(DEFAULT_DEFINITION_OF_DONE), 'admin', T).rows;
    const s3 = append(s2, [{ transitionName: 'Resync', at: T, actorPartyId: 'admin', rows: restated }]).state;
    expect(criterion(s3, 'item-unit-tests').currentStatusId).toBe('DOD_DONE');
  });
});

describe('legacy (v1) records', () => {
  function legacy(withAccount = true) {
    let l = ChecklistEngine.initializeState('9', 'D-9', DEFAULT_DEFINITION_OF_DONE, 'system', T);
    l = ChecklistEngine.toggleItem(l, { issueId: '9', issueKey: 'D-9', itemId: 'item-unit-tests', isCompleted: true, userId: 'Alice', userAccountId: withAccount ? 'acc-a' : undefined }, T);
    return l;
  }

  it('derives criteria in memory: DONE with the accountId, OPEN for the rest, no display name', () => {
    const st = stateFromLegacy(legacy(), 'p');
    expect(st.seq).toBe(0);
    expect(criterion(st, 'item-unit-tests')).toMatchObject({ currentStatusId: 'DOD_DONE', lastStatusByPartyId: 'acc-a', lastStatusUpdate: T });
    expect(criterion(st, 'item-peer-review').currentStatusId).toBe('DOD_OPEN');
    expect(JSON.stringify(st)).not.toContain('Alice');
  });

  it('keeps a v1 display name only when v1 recorded no accountId', () => {
    const st = stateFromLegacy(legacy(false), 'p');
    expect(criterion(st, 'item-unit-tests')).toMatchObject({ currentStatusId: 'DOD_DONE', legacyName: 'Alice' });
    expect(criterion(st, 'item-unit-tests').lastStatusByPartyId).toBeUndefined();
  });

  it('Migrate carries the structure, the imported statuses and a LegacyImport row', () => {
    const l = legacy();
    const e = migrateEntry(emptyState('9', '', 'p'), l, 'bob', T);
    expect(e.transitionName).toBe('Migrate');
    expect(e.rows.find(r => r.entity === 'LegacyImport')).toEqual({ entity: 'LegacyImport', legacy: legacyRefOf(l) });
    expect(e.rows.filter(r => r.entity === 'WorkEffortStatus')).toHaveLength(1);
    expect(applyEntry(emptyState('9', '', 'p'), e).issue.workEffortName).toBe('D-9');
  });

  it('legacyRefOf defaults a missing version and trail; a missing templateId and completedAt are allowed', () => {
    expect(legacyRefOf({ checklistHash: 'h' } as any)).toEqual({ stateVersion: 1, eventCount: 0, checklistHash: 'h' });
    const bare: any = { issueId: '9', issueKey: 'D-9', items: [{ id: 'a', title: 'A', isMandatory: true, category: 'TESTING', isCompleted: true }], checklistHash: 'h' };
    const st = stateFromLegacy(bare, 'p');
    expect(st.template.workEffortId).toBe('');
    expect(criterion(st, 'a')).toMatchObject({ currentStatusId: 'DOD_DONE', lastStatusByPartyId: undefined });
  });
});

describe('ids, status table, roles and template conversion', () => {
  it('names work efforts by issue and template item', () => {
    expect(issueWorkEffortId('9')).toBe('issue:9');
    expect(criterionWorkEffortId('9', 'x')).toBe('crit:9:x');
  });

  it('has three StatusItems and the documented valid changes', () => {
    expect(Object.keys(STATUS_ITEMS)).toEqual(['DOD_OPEN', 'DOD_DONE', 'DOD_WAIVED']);
    expect(isValidChange('DOD_OPEN', 'DOD_DONE', 'Complete')).toBe(true);
    expect(isValidChange('DOD_DONE', 'DOD_DONE', 'Complete')).toBe(false);
    expect(isValidChange('DOD_WAIVED', 'DOD_OPEN', 'Reset')).toBe(true);
    expect(STATUS_VALID_CHANGES.every(c => c.statusId !== c.statusIdTo)).toBe(true);
    expect(invalidChangeMessage('DOD_OPEN', 'Reopen')).toBe('This item is already open.');
  });

  it('maps roles to Jira permissions and back', () => {
    expect(permissionKeyOf('PROJECT_ADMIN')).toBe('ADMINISTER_PROJECTS');
    expect(permissionKeyOf('JIRA_PERM_RESOLVE_ISSUES')).toBe('RESOLVE_ISSUES');
    expect(() => permissionKeyOf('ASSIGNEE')).toThrow('not granted by a Jira permission');
    expect(roleOfPermission('ADMINISTER_PROJECTS')).toBe('PROJECT_ADMIN');
    expect(roleOfPermission('RESOLVE_ISSUES')).toBe('JIRA_PERM_RESOLVE_ISSUES');
  });

  it('converts the settings payload to a DOD_TEMPLATE WorkEffort and back without loss', () => {
    const payload: any = {
      id: 'project-1-2', name: 'Team DoD', description: 'd', version: 3, waiverPermission: 'RESOLVE_ISSUES',
      items: [
        { id: 'a', title: 'A', isMandatory: true, category: 'SECURITY', description: 'x', evidenceRequired: true, notAssignee: true, requiredPermission: 'RESOLVE_ISSUES' },
        { id: 'b', title: 'B', isMandatory: false, category: 'TESTING' }
      ]
    };
    const dod = toDodTemplate(payload);
    expect(dod).toMatchObject({ workEffortId: 'project-1-2', workEffortTypeId: 'DOD_TEMPLATE', workEffortName: 'Team DoD', revisionNumber: 3, waiverRoleTypeId: 'JIRA_PERM_RESOLVE_ISSUES' });
    expect(dod.criteria[0]).toEqual({ templateItemId: 'a', workEffortName: 'A', description: 'x', sequenceNum: 1, purposeTypeId: 'SECURITY', isMandatory: true, evidenceRequired: true, requiredRoleTypeId: 'JIRA_PERM_RESOLVE_ISSUES', excludedRoleTypeId: 'ASSIGNEE' });
    expect(toTemplateView(dod)).toEqual(payload);
    const plain = toTemplateView(toDodTemplate({ ...payload, waiverPermission: undefined, description: undefined }));
    expect(plain.waiverPermission).toBeUndefined();
    expect(plain.description).toBe('');
  });
});
