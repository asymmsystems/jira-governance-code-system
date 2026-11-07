/**
 * ADR-010 and BL-1: the weekly personal data report, erasure of closed accounts, and the
 * one-time pass that rewrites records written before pseudonyms.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { jira, CountingStorage, JiraCall, pseudonymOf, storedOutsideMap } from '../helpers/forge-mocks';

let mockRemaining: (() => number) | undefined;
const mockReport = jest.fn();
jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return {
    __esModule: true,
    default: { asApp: () => asApp, asUser: () => asUser },
    route: m.routeImpl,
    getAppContext: () => {
      if (!mockRemaining) throw new Error('no runtime');
      return { invocationRemainingTimeInMillis: mockRemaining };
    },
    privacy: { reportPersonalData: (a: any) => mockReport(a) }
  };
});
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));

import {
  reportPersonalData, migrateLegacyPersonalData, pseudonymiseIssue, personalDataTrigger, invocationClock, MIGRATION_KEY, RESERVE_MS
} from '../../src/privacy/personal-data';
import { toggleChecklistItem, waiveChecklistItem, getIssueChecklist, getChecklistHistory, exportChecklistHistory, setGlobalStorageProvider } from '../../src/index';
import { ChecklistStore, eventKey, stateKey, legacyKey } from '../../src/storage/checklist-store';
import { applyEntry, createEntry, emptyState, makeEntry, statusEntry, verifyChain, hashEntry, redactEntries, REDACTIONS_PER_EVENT } from '../../src/domain/event-log';
import { toDodTemplate } from '../../src/domain/dod-template';
import { ChecklistEngine, DEFAULT_DEFINITION_OF_DONE } from '../../src/domain/checklist-engine';
import { templateKey } from '../../src/settings/template-store';
import { projectConfigKey } from '../../src/settings/project-config';
import { APPROVER_POLICY_KEY } from '../../src/storage/policy-repository';
import { DELETED_USER } from '../../src/storage/party-store';
import { DodState, ChangeEntry } from '../../src/domain/models';

const T = '2026-11-01T00:00:00.000Z';
const project = { id: '10000', key: 'DEMO' };
const ctx = (accountId: string, id = '97001') => ({ accountId, extension: { issue: { id, key: `DEMO-${id}`, type: 'Task', typeId: '10004' }, project } });
const plenty = () => 60000;

function grantAll() {
  jira.handler = (c: JiraCall) => {
    if (c.path.includes('/mypermissions')) return { status: 200, body: { permissions: { EDIT_ISSUES: { havePermission: true }, ADMINISTER_PROJECTS: { havePermission: true } } } };
    if (c.path.includes('fields=assignee')) return { status: 200, body: { fields: { assignee: null } } };
    return { status: 204 };
  };
}

/** A history written before ADR-010: raw account ids in the events and the state cache. */
function legacyHistory(storage: CountingStorage, issueId: string): DodState {
  let st = emptyState(issueId, `DEMO-${issueId}`, '10000');
  const events: ChangeEntry[] = [];
  const add = (e: ChangeEntry) => { st = applyEntry(st, e); events.push(e); };
  add(createEntry(st, toDodTemplate(DEFAULT_DEFINITION_OF_DONE), '712020:old-dev', T));
  add(makeEntry(st, statusEntry(st, { templateItemId: 'item-unit-tests', statusIdTo: 'DOD_DONE', transitionName: 'Complete', actorPartyId: '712020:old-dev', at: T })));
  add(makeEntry(st, statusEntry(st, { templateItemId: 'item-peer-review', statusIdTo: 'DOD_WAIVED', transitionName: 'Waive', actorPartyId: '712020:old-lead', at: T, reason: 'Reviewed in the pairing session.' })));
  for (const e of events) storage.put(eventKey(issueId, e.seq), e);
  storage.put(stateKey(issueId), st);
  return st;
}

describe('BL-1 weekly personal data report and erasure', () => {
  let storage: CountingStorage;

  beforeEach(() => {
    jira.reset();
    grantAll();
    storage = new CountingStorage();
    setGlobalStorageProvider(storage);
    mockRemaining = undefined;
    mockReport.mockReset();
  });

  afterEach(() => setGlobalStorageProvider(null));

  it('reports every recorded account with its updatedAt, and erases the closed ones', async () => {
    await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx('712020:alice'), storage);
    await waiveChecklistItem({ itemId: 'item-peer-review', reason: 'Reviewed in the pairing session.' }, ctx('712020:bob'), storage);
    const alice = pseudonymOf(storage, '712020:alice');
    const report = jest.fn(async (accounts: any[]) => [{ accountId: '712020:alice', status: 'closed' }, { accountId: '712020:bob', status: 'updated' }]);
    const res = await reportPersonalData(storage, report, plenty);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0][0].map((a: any) => a.accountId).sort()).toEqual(['712020:alice', '712020:bob']);
    expect(report.mock.calls[0][0].every((a: any) => !Number.isNaN(Date.parse(a.updatedAt)))).toBe(true);
    expect(res).toEqual({ reported: 2, closed: 1, migration: 'done' });
    // Nothing links alice to her pseudonym any more; her account id is stored nowhere.
    expect(storage.read(`dg:pty:712020:alice`)).toBeUndefined();
    expect(storage.read(`dg:pid:${alice}`)).toBeUndefined();
    expect([...storage.store.values()].some(v => v.includes('712020:alice'))).toBe(false);
    expect(pseudonymOf(storage, '712020:bob')).toMatch(/^dgp-/);
  });

  it('keeps the history check intact after erasure, and the panel shows "A deleted user"', async () => {
    await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx('712020:alice'), storage);
    await reportPersonalData(storage, async () => [{ accountId: '712020:alice', status: 'closed' }], plenty);
    expect(await new ChecklistStore(storage).verify('97001')).toEqual({ ok: true, checked: 2 });
    const panel = await getIssueChecklist({}, ctx('712020:bob'), storage);
    const item = panel.items.find(i => i.id === 'item-unit-tests')!;
    expect(item).toMatchObject({ isCompleted: true, completedByAccountId: undefined, completedByLegacyName: DELETED_USER });
    const history: any = await getChecklistHistory({}, ctx('712020:bob'), storage);
    expect(history.chain).toMatchObject({ ok: true, checked: 2 });
    expect(history.auditTrail[1]).toMatchObject({ actorAccountId: '', actorName: DELETED_USER });
    const doc = JSON.parse((await exportChecklistHistory({}, ctx('712020:bob'), storage) as any).text);
    expect(doc.parties).toEqual({});
    expect(doc.chain.ok).toBe(true);
  });

  it('sends no report when nobody is recorded, and uses the Forge privacy API by default', async () => {
    expect(await reportPersonalData(storage, undefined, plenty)).toEqual({ reported: 0, closed: 0, migration: 'done' });
    expect(mockReport).not.toHaveBeenCalled();
    await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx('712020:alice'), storage);
    mockReport.mockResolvedValue([]);
    expect(await reportPersonalData(storage, undefined, plenty)).toMatchObject({ reported: 1, closed: 0 });
    expect(mockReport).toHaveBeenCalledWith([expect.objectContaining({ accountId: '712020:alice' })]);
  });

  it('a closed account the app no longer holds is not counted', async () => {
    await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx('712020:alice'), storage);
    expect(await reportPersonalData(storage, async () => [{ accountId: '712020:other', status: 'closed' }], plenty)).toMatchObject({ closed: 0 });
  });

  it('the trigger logs counts only and never throws', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx('712020:alice'), storage);
      mockReport.mockResolvedValue([{ accountId: '712020:alice', status: 'closed' }]);
      mockRemaining = plenty;
      await personalDataTrigger();
      expect(log.mock.calls[0][0]).toBe('DefinitionGuard personal data report: 1 account(s) reported, 1 closed and erased, pass done.');
      mockReport.mockRejectedValue(new Error('report endpoint down'));
      await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: false }, ctx('712020:carol'), storage);
      await expect(personalDataTrigger()).resolves.toBeUndefined();
      expect(err.mock.calls[0][0]).toBe('DefinitionGuard: the personal data report failed: Error');
      expect(JSON.stringify([...log.mock.calls, ...err.mock.calls])).not.toContain('712020:');
    } finally {
      log.mockRestore();
      err.mockRestore();
    }
  });

  it('still reports when the one-time pass fails, and says so', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx('712020:alice'), storage);
      storage.failGet = key => key === MIGRATION_KEY;
      const res = await reportPersonalData(storage, async () => [], plenty);
      expect(res).toEqual({ reported: 1, closed: 0, migration: 'failed' });
      expect(err.mock.calls[0][0]).toContain('the personal data pass stopped');
    } finally {
      err.mockRestore();
    }
  });
});

describe('BL-1 one-time pass over records written before ADR-010 (redaction event)', () => {
  let storage: CountingStorage;

  beforeEach(() => {
    jira.reset();
    grantAll();
    storage = new CountingStorage();
  });

  it('rewrites a history to pseudonyms with a Redact event, and the history check still passes', async () => {
    const before = legacyHistory(storage, '97101');
    expect(verifyChain('97101', [1, 2, 3].map(n => storage.read(eventKey('97101', n))), before).ok).toBe(true);
    const progress = await migrateLegacyPersonalData(storage, plenty, T);
    expect(progress).toMatchObject({ phase: 'done', issuesRewritten: 1 });
    expect(storedOutsideMap(storage, '712020:old-dev')).toEqual([]);
    expect(storedOutsideMap(storage, '712020:old-lead')).toEqual([]);
    const redact = storage.read(eventKey('97101', 4));
    expect(redact).toMatchObject({ transitionName: 'Redact', actorPartyId: 'system' });
    expect(redact.rows.map((r: any) => r.seq)).toEqual([1, 2, 3]);
    expect(redact.rows[0].originalHash).toBe(storage.read(eventKey('97101', 1)).hash);
    expect(redact.rows[0].redactedHash).toBe(hashEntry(storage.read(eventKey('97101', 1))));
    const store = new ChecklistStore(storage);
    expect(await store.verify('97101')).toEqual({ ok: true, checked: 4 });
    const state = storage.read(stateKey('97101'));
    expect(state.seq).toBe(4);
    expect(state.criteria.find((c: any) => c.templateItemId === 'item-peer-review').lastStatusByPartyId).toBe(pseudonymOf(storage, '712020:old-lead'));
    // The issue property is written again, without any account id.
    const put = jira.callsTo('/properties/definitionguard-dod', 'app').pop()!;
    expect(put.body).toMatchObject({ schemaVersion: 3, stateVersion: 4 });
    expect(JSON.stringify(put.body)).not.toContain('712020:');
  });

  it('the panel shows the same people after the pass, and a change made later keeps the chain intact', async () => {
    legacyHistory(storage, '97102');
    await migrateLegacyPersonalData(storage, plenty, T);
    const panel = await getIssueChecklist({}, ctx('712020:x', '97102'), storage);
    expect(panel.items.find(i => i.id === 'item-unit-tests')!.completedByAccountId).toBe('712020:old-dev');
    const history: any = await getChecklistHistory({}, ctx('712020:x', '97102'), storage);
    expect(history.auditTrail.map((r: any) => r.eventType)).toEqual(['TEMPLATE_CONFIGURED', 'CHECK', 'WAIVE', 'REDACT']);
    expect(history.auditTrail[3]).toMatchObject({ actorAccountId: '', actorName: 'DefinitionGuard' });
    await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: false }, ctx('712020:old-dev', '97102'), storage);
    expect(await new ChecklistStore(storage).verify('97102')).toEqual({ ok: true, checked: 5 });
  });

  it('erasing a rewritten account after the pass keeps the chain intact', async () => {
    legacyHistory(storage, '97103');
    await reportPersonalData(storage, async () => [{ accountId: '712020:old-dev', status: 'closed' }], plenty);
    expect([...storage.store.values()].some(v => v.includes('712020:old-dev'))).toBe(false);
    expect(await new ChecklistStore(storage).verify('97103')).toMatchObject({ ok: true });
  });

  it('a rewritten event that is changed again, or a Redact row for a later event, fails the check', async () => {
    legacyHistory(storage, '97104');
    await migrateLegacyPersonalData(storage, plenty, T);
    const e2 = storage.read(eventKey('97104', 2));
    storage.put(eventKey('97104', 2), { ...e2, at: '2026-11-02T00:00:00.000Z' });
    expect(await new ChecklistStore(storage).verify('97104')).toMatchObject({ ok: false, brokenAt: 2, reason: 'content changed' });

    // A Redact row counts only for an event before it.
    let st = emptyState('97105', 'DEMO-97105', '10000');
    const e1 = createEntry(st, toDodTemplate(DEFAULT_DEFINITION_OF_DONE), 'a', T);
    st = applyEntry(st, e1);
    const forged = { ...e1, at: 'changed' };
    const tail = makeEntry(st, redactEntries([{ seq: 1, originalHash: e1.hash, redactedHash: hashEntry(forged) }], T)[0]);
    expect(verifyChain('97105', [forged, tail]).ok).toBe(true);
    const selfRow = { ...tail, rows: [{ entity: 'Redaction' as const, seq: 2, originalHash: 'x', redactedHash: 'y' }] };
    expect(verifyChain('97105', [e1, { ...selfRow, hash: hashEntry(selfRow) }]).ok).toBe(true);
    expect(verifyChain('97105', [{ ...forged, at: 'again' }, tail])).toMatchObject({ ok: false, brokenAt: 1 });
  });

  it('splits a long redaction into Redact events of at most 50 rows', () => {
    const rows = Array.from({ length: 120 }, (_, i) => ({ seq: i + 1, originalHash: 'o', redactedHash: 'r' }));
    expect(redactEntries(rows, T).map(e => e.rows.length)).toEqual([REDACTIONS_PER_EVENT, REDACTIONS_PER_EVENT, 20]);
  });

  it('changes nothing on a second run, or on an issue written with pseudonyms', async () => {
    legacyHistory(storage, '97106');
    await migrateLegacyPersonalData(storage, plenty, T);
    storage.sets = [];
    expect(await pseudonymiseIssue(storage, '97106', T)).toBe(0);
    expect(await pseudonymiseIssue(storage, 'none', T)).toBe(0);
    expect(storage.sets).toEqual([]);
    expect(await migrateLegacyPersonalData(storage, plenty, T)).toMatchObject({ phase: 'done' });
    expect(storage.sets).toEqual([]);
  });

  it('rebuilds a state cache that still names a person even when the events are clean', async () => {
    await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx('712020:alice', '97107'), storage);
    const st = storage.read(stateKey('97107'));
    storage.put(stateKey('97107'), { ...st, lastModifiedByPartyId: '712020:alice' });
    expect(await pseudonymiseIssue(storage, '97107', T)).toBe(0);
    expect(storage.read(stateKey('97107')).lastModifiedByPartyId).toBe(pseudonymOf(storage, '712020:alice'));
  });

  it('migrates a v1 record, removes its display names, and deletes it', async () => {
    let legacy = ChecklistEngine.initializeState('97108', 'DEMO-97108', DEFAULT_DEFINITION_OF_DONE, 'system', T);
    legacy = ChecklistEngine.toggleItem(legacy, { issueId: '97108', issueKey: 'DEMO-97108', itemId: 'item-unit-tests', isCompleted: true, userId: 'Alice Smith', userAccountId: '712020:alice' }, T);
    legacy = ChecklistEngine.toggleItem(legacy, { issueId: '97108', issueKey: 'DEMO-97108', itemId: 'item-peer-review', isCompleted: true, userId: 'Bob Jones' }, T);
    storage.put(legacyKey('97108'), legacy);
    // A second v1 record that the panel had already migrated.
    let legacy2 = ChecklistEngine.initializeState('97109', 'DEMO-97109', DEFAULT_DEFINITION_OF_DONE, 'system', T);
    legacy2 = ChecklistEngine.toggleItem(legacy2, { issueId: '97109', issueKey: 'DEMO-97109', itemId: 'item-unit-tests', isCompleted: true, userId: 'Carol', userAccountId: '712020:carol' }, T);
    storage.put(legacyKey('97109'), legacy2);
    await toggleChecklistItem({ itemId: 'item-peer-review', isCompleted: true }, ctx('712020:dave', '97109'), storage);

    await migrateLegacyPersonalData(storage, plenty, T);
    expect(storage.read(legacyKey('97108'))).toBeUndefined();
    expect(storage.read(legacyKey('97109'))).toBeUndefined();
    for (const text of ['712020:alice', '712020:carol', 'Alice Smith', 'Bob Jones', 'Carol']) expect(storedOutsideMap(storage, text)).toEqual([]);
    expect(storage.read(eventKey('97108', 1))).toMatchObject({ transitionName: 'Migrate', actorPartyId: 'system' });
    expect(storage.read(stateKey('97108')).issue.workEffortName).toBe('DEMO-97108');
    for (const id of ['97108', '97109']) expect(await new ChecklistStore(storage).verify(id)).toMatchObject({ ok: true });
  });

  it('replaces the account id in templates, project settings and the approver policy', async () => {
    storage.put(templateKey('10000', '10004'), { projectId: '10000', issueTypeId: '10004', workEffortId: 'project-10000-10004', lastModifiedByPartyId: '712020:admin' });
    storage.put(templateKey('10000', '10005'), { projectId: '10000', issueTypeId: '10005', workEffortId: 'project-10000-10005', lastModifiedByPartyId: 'dgp-already' });
    storage.put(projectConfigKey('10000'), { exemptStatusIds: ['6'], updatedAt: T, updatedByAccountId: '712020:admin' });
    storage.put(projectConfigKey('10001'), { exemptStatusIds: [], updatedAt: T, updatedByPartyId: 'dgp-x' });
    storage.put(APPROVER_POLICY_KEY, { roleTypeId: 'DG_APPROVER', parties: [], fromDate: T, setByPartyId: '712020:jira-admin' });
    await migrateLegacyPersonalData(storage, plenty, T);
    const admin = pseudonymOf(storage, '712020:admin');
    expect(storage.read(templateKey('10000', '10004')).lastModifiedByPartyId).toBe(admin);
    expect(storage.read(templateKey('10000', '10005')).lastModifiedByPartyId).toBe('dgp-already');
    expect(storage.read(projectConfigKey('10000'))).toEqual({ exemptStatusIds: ['6'], updatedAt: T, updatedByPartyId: admin });
    expect(storage.read(projectConfigKey('10001')).updatedByPartyId).toBe('dgp-x');
    expect(storage.read(APPROVER_POLICY_KEY).setByPartyId).toBe(pseudonymOf(storage, '712020:jira-admin'));
    for (const text of ['712020:admin', '712020:jira-admin']) expect(storedOutsideMap(storage, text)).toEqual([]);
  });

  it('stops while time is short, keeps its place, and continues in the next run', async () => {
    for (let i = 0; i < 45; i++) legacyHistory(storage, String(98000 + i));
    let calls = 0;
    // Enough time for the v1 phase and one page of issues only.
    const shortRun = () => (++calls <= 2 ? RESERVE_MS + 1 : RESERVE_MS);
    const first = await migrateLegacyPersonalData(storage, shortRun, T);
    expect(first.phase).toBe('issues');
    expect(first.cursor).toBeDefined();
    expect(storage.read(MIGRATION_KEY)).toMatchObject({ phase: 'issues', issuesRewritten: 20 });
    expect(await migrateLegacyPersonalData(storage, () => RESERVE_MS, T)).toMatchObject({ phase: 'issues', issuesRewritten: 20 });
    const done = await migrateLegacyPersonalData(storage, plenty, T);
    expect(done).toMatchObject({ phase: 'done', issuesRewritten: 45 });
    expect(storedOutsideMap(storage, '712020:old-dev')).toEqual([]);
  });

  it('handles more than one page of v1 records', async () => {
    for (let i = 0; i < 25; i++) {
      const id = String(99000 + i);
      storage.put(legacyKey(id), ChecklistEngine.initializeState(id, `DEMO-${id}`, DEFAULT_DEFINITION_OF_DONE, 'system', T));
    }
    expect(await migrateLegacyPersonalData(storage, plenty, T)).toMatchObject({ phase: 'done' });
    expect([...storage.store.keys()].filter(k => k.startsWith('dg:checklist:'))).toEqual([]);
  });

  it('reads the time left from the Forge runtime, else from a fixed budget', () => {
    mockRemaining = () => 42000;
    expect(invocationClock()()).toBe(42000);
    mockRemaining = undefined;
    const left = invocationClock(20000)();
    expect(left).toBeGreaterThan(19000);
    expect(left).toBeLessThanOrEqual(20000);
  });
});
