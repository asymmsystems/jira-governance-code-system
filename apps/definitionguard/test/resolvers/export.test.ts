/**
 * B-15: audit history view and export with the verification result.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { jira, CountingStorage, JiraCall, pseudonymOf, storedOutsideMap } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return { __esModule: true, default: { asApp: () => asApp, asUser: () => asUser }, route: m.routeImpl };
});
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));

import { exportChecklistHistory, toggleChecklistItem, waiveChecklistItem, handler, setGlobalStorageProvider } from '../../src/index';
import { historyRows, formatLocal } from '../../src/ui/panel-view-model';
import { CHAIN_LIMIT_NOTE, createEntry, emptyState, applyEntry, makeEntry, statusEntry } from '../../src/domain/event-log';
import { toDodTemplate } from '../../src/domain/dod-template';
import { eventKey, stateKey } from '../../src/storage/checklist-store';
import { retryPolicy } from '../../src/integrity/attestation';
import { DEFAULT_DEFINITION_OF_DONE } from '../../src/domain/checklist-engine';

const project = { id: '10000', key: 'DEMO' };
const issue = { id: '96001', key: 'DEMO-96001', type: 'Task', typeId: '10004' };
const as = (accountId: string) => ({ accountId, extension: { issue, project } });
let admin = true;

describe('B-15 export', () => {
  let storage: CountingStorage;

  beforeEach(() => {
    jira.reset();
    admin = true;
    retryPolicy.sleep = async () => {};
    jira.handler = (c: JiraCall) => (c.path.includes('/mypermissions')
      ? { status: 200, body: { permissions: { EDIT_ISSUES: { havePermission: true }, ADMINISTER_PROJECTS: { havePermission: admin } } } }
      : { status: 204 });
    storage = new CountingStorage();
  });

  it('refuses a non-admin and reads nothing', async () => {
    admin = false;
    await expect(exportChecklistHistory({}, as('dev'), storage)).rejects.toThrow('Only a project admin can export this history.');
    expect(storage.gets).toEqual([]);
  });

  it('exports every event, the state summary, the chain result and its limit, as JSON text', async () => {
    await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true, evidence: { url: 'https://ci.example/1' } }, as('712020:dev'), storage);
    await waiveChecklistItem({ itemId: 'item-peer-review', reason: 'Pair-programmed and reviewed live.' }, as('712020:lead'), storage);
    const res: any = await exportChecklistHistory({}, as('712020:lead'), storage);
    const doc = JSON.parse(res.text);
    expect(doc).toMatchObject({
      format: 'definitionguard-history-export',
      formatVersion: 2,
      issueId: '96001',
      issueKey: 'DEMO-96001',
      exportedByAccountId: '712020:lead',
      state: { stateVersion: 3, templateId: DEFAULT_DEFINITION_OF_DONE.id, headHash: storage.read(stateKey('96001')).headHash },
      chain: { ok: true, checked: 3, message: 'History checked: 3 events, chain intact.' },
      limit: CHAIN_LIMIT_NOTE
    });
    expect(doc.events.map((e: any) => e.transitionName)).toEqual(['Create', 'Complete', 'Waive']);
    expect(doc.events[1].rows).toContainEqual(expect.objectContaining({ entity: 'Content', contentTypeId: 'DOD_EVIDENCE', objectInfo: 'https://ci.example/1' }));
    expect(doc.events[1].rows).toContainEqual(expect.objectContaining({ entity: 'WorkEffortContent', workEffortContentTypeId: 'DOD_EVIDENCE' }));
    const lead = pseudonymOf(storage, '712020:lead');
    expect(doc.events[2].rows[0]).toMatchObject({ entity: 'WorkEffortStatus', statusId: 'DOD_WAIVED', reason: 'Pair-programmed and reviewed live.', setByPartyId: lead });
    // ADR-010: events hold pseudonyms; the export maps each one to the account while it exists.
    expect(doc.parties).toEqual({ [lead]: '712020:lead', [pseudonymOf(storage, '712020:dev')]: '712020:dev' });
    expect(JSON.stringify(doc.events)).not.toContain('712020:');
    expect(res.fileName).toBe('DEMO-96001-definitionguard-history.json');
  });

  it('reports a broken chain in the export', async () => {
    await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, as('712020:dev'), storage);
    storage.put(eventKey('96001', 2), { ...storage.read(eventKey('96001', 2)), actorPartyId: 'mallory' });
    const doc = JSON.parse((await exportChecklistHistory({}, as('712020:lead'), storage) as any).text);
    expect(doc.chain).toMatchObject({ ok: false, brokenAt: 2 });
  });

  it('exports 1,000 events, reading them in pages of at most 100', async () => {
    let st = emptyState('96001', 'DEMO-96001', '10000');
    const e1 = createEntry(st, toDodTemplate(DEFAULT_DEFINITION_OF_DONE), 'a', 't');
    st = applyEntry(st, e1); storage.put(eventKey('96001', 1), e1);
    for (let n = 2; n <= 1000; n++) {
      const done = n % 2 === 0;
      const e = makeEntry(st, statusEntry(st, { templateItemId: 'item-unit-tests', statusIdTo: done ? 'DOD_DONE' : 'DOD_OPEN', transitionName: done ? 'Complete' : 'Reopen', actorPartyId: 'a', at: 't' }));
      st = applyEntry(st, e); storage.put(eventKey('96001', n), e);
    }
    storage.put(stateKey('96001'), st);
    const pages: Array<number | undefined> = [];
    const orig = storage.listByPrefix.bind(storage);
    storage.listByPrefix = async (p, c, l) => { pages.push(l); return orig(p, c, l); };
    const started = Date.now();
    const doc = JSON.parse((await exportChecklistHistory({}, as('712020:lead'), storage) as any).text);
    expect(doc.events).toHaveLength(1000);
    expect(doc.chain).toMatchObject({ ok: true, checked: 1000 });
    expect(pages.every(l => l === 100)).toBe(true);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('returns an empty export for an issue with no record', async () => {
    const doc = JSON.parse((await exportChecklistHistory({}, as('712020:lead'), storage) as any).text);
    expect(doc).toMatchObject({ events: [], state: null, chain: { ok: true, checked: 0 } });
  });

  it('dispatches exportHistory through the panel handler', async () => {
    setGlobalStorageProvider(storage);
    const res: any = await handler({ call: { functionKey: 'exportHistory', payload: {} }, context: as('712020:lead') } as any);
    expect(JSON.parse(res.text).issueId).toBe('96001');
  });
});

describe('B-15 historyRows', () => {
  const fmt = (iso?: string) => formatLocal(iso, 'en-GB', 'UTC');

  it('lists title, action in words, user, local time, evidence and reason', () => {
    const rows = historyRows([
      { id: 'evt-1', timestamp: '2026-11-01T09:30:00.000Z', eventType: 'TEMPLATE_CONFIGURED', actorName: 'a', actorAccountId: 'a' },
      { id: 'evt-2', timestamp: '2026-11-01T09:31:00.000Z', eventType: 'CHECK', actorName: 'b', actorAccountId: 'b', itemTitle: 'Docs', evidence: { note: 'done' } },
      { id: 'evt-3', timestamp: '2026-11-01T09:32:00.000Z', eventType: 'WAIVE', actorName: 'c', actorAccountId: 'c', itemTitle: 'Scan', details: 'No code' },
      { id: 'evt-4', timestamp: '2026-11-01T09:33:00.000Z', eventType: 'UNCHECK', actorName: 'd', actorAccountId: 'd', itemTitle: 'Docs' },
      { id: 'evt-5', timestamp: '2026-11-01T09:34:00.000Z', eventType: 'RESET', actorName: 'e', actorAccountId: 'e' }
    ], fmt);
    expect(rows.map(r => r.text)).toEqual([
      'Checklist created',
      'Completed: Docs',
      'Waived: Scan (reason: No code)',
      'Reopened: Docs',
      'Checklist reset'
    ]);
    expect(rows[0]).toMatchObject({ key: 'evt-1', when: '1 Nov 2026, 09:30', accountId: 'a', actionText: 'Checklist created', eventType: 'TEMPLATE_CONFIGURED', actionVerb: 'Checklist created', itemTitle: undefined });
    expect(rows[1]).toMatchObject({ key: 'evt-2', when: '1 Nov 2026, 09:31', accountId: 'b', actionText: 'Completed: Docs', eventType: 'CHECK', actionVerb: 'Completed', itemTitle: 'Docs', evidence: { note: 'done' } });
    expect(rows[2]).toMatchObject({ key: 'evt-3', when: '1 Nov 2026, 09:32', accountId: 'c', actionText: 'Waived: Scan', eventType: 'WAIVE', actionVerb: 'Waived', itemTitle: 'Scan', reason: 'No code' });
    expect(historyRows(undefined, fmt)).toEqual([]);
  });
});
