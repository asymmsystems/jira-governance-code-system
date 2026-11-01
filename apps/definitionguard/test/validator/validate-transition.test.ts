/**
 * B-01: the validator fails closed on any error and never writes.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { jira, makeRequester, routeImpl, CountingStorage } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return { __esModule: true, default: { asApp: () => asApp, asUser: () => asUser }, route: m.routeImpl };
});
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

import { validateTransition } from '../../src/index';
import { ChecklistEngine, BUG_DEFINITION_OF_DONE, DEFAULT_DEFINITION_OF_DONE } from '../../src/domain/checklist-engine';

void makeRequester; void routeImpl;

const BLOCKED_ON_ERROR = 'could not check the Definition of Done, so this move is blocked';

describe('B-01 validator fails closed and never writes', () => {
  let storage: CountingStorage;

  beforeEach(() => {
    jira.reset();
    storage = new CountingStorage();
  });

  it('returns result false with a next step when the storage read throws', async () => {
    storage.failGet = () => true;
    const res = await validateTransition({ issue: { id: '10001', key: 'DEMO-1' } }, {}, storage);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain(BLOCKED_ON_ERROR);
    expect(res.errorMessage).toContain('Try again');
  });

  it('returns result false when the Jira issue lookup returns a non-200', async () => {
    jira.handler = () => ({ status: 503 });
    const res = await validateTransition({ issue: { key: 'DEMO-2' } }, {}, storage);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain(BLOCKED_ON_ERROR);
  });

  it('returns result false when the Jira issue lookup throws', async () => {
    jira.handler = () => ({ status: 0, throws: 'network down' } as any);
    const res = await validateTransition({ issue: { key: 'DEMO-3' } }, {}, storage);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain(BLOCKED_ON_ERROR);
  });

  it('(V-a, V-b) blocks a missing record, names every open mandatory item, and writes nothing', async () => {
    jira.handler = () => ({ status: 200, body: { id: '10004', key: 'DEMO-4', fields: { issuetype: { name: 'Task' } } } });
    const res = await validateTransition({ issue: { id: '10004', key: 'DEMO-4' } }, {}, storage);
    expect(res.result).toBe(false);
    const mandatory = DEFAULT_DEFINITION_OF_DONE.items.filter(i => i.isMandatory);
    for (const item of mandatory) expect(res.errorMessage).toContain(item.title);
    expect(storage.sets).toEqual([]);
  });

  it('resolves the numeric id from a key-only payload, applies the issue-type template, and never uses the key as a storage id', async () => {
    jira.handler = () => ({ status: 200, body: { id: '10005', key: 'DEMO-5', fields: { issuetype: { name: 'Bug' } } } });
    const res = await validateTransition({ issue: { key: 'DEMO-5' } }, {}, storage);
    expect(res.result).toBe(false);
    for (const item of BUG_DEFINITION_OF_DONE.items) expect(res.errorMessage).toContain(item.title);
    expect(storage.gets.every(k => !k.includes('DEMO-5'))).toBe(true);
    expect(storage.gets).toContain('dg:checklist:10005');
    expect(storage.sets).toEqual([]);
  });

  it('allows a complete checklist and writes nothing', async () => {
    let st = ChecklistEngine.initializeState('10006', 'DEMO-6', DEFAULT_DEFINITION_OF_DONE, 'system', '2026-11-01T00:00:00.000Z');
    for (const item of st.items.filter(i => i.isMandatory)) {
      st = ChecklistEngine.toggleItem(st, { issueId: '10006', issueKey: 'DEMO-6', itemId: item.id, isCompleted: true, userId: 'a', userAccountId: 'acc-a' });
    }
    storage.put('dg:checklist:10006', st);
    const res = await validateTransition({ issue: { id: '10006', key: 'DEMO-6' } }, {}, storage);
    expect(res).toEqual({ result: true });
    expect(storage.sets).toEqual([]);
  });

  it('never reads the definitionguard-dod entity property', async () => {
    jira.handler = () => ({ status: 200, body: { id: '10007', key: 'DEMO-7', fields: { issuetype: { name: 'Task' } } } });
    await validateTransition({ issue: { key: 'DEMO-7' } }, {}, storage);
    expect(jira.callsTo('/properties/')).toEqual([]);
  });

  it('blocks with the failure message when the key lookup returns 200 but no id', async () => {
    jira.handler = () => ({ status: 200, body: { key: 'DEMO-8' } });
    const res = await validateTransition({ issue: { key: 'DEMO-8' } }, {}, storage);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain(BLOCKED_ON_ERROR);
  });

  it('uses the issue type and project ids from the context and makes no Jira call', async () => {
    const res = await validateTransition({ issue: { id: '10009', key: 'DEMO-9' } }, { extension: { issue: { type: 'Bug', typeId: '10005' }, project: { id: '10000' } } }, storage);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain(BUG_DEFINITION_OF_DONE.items[0].title);
    expect(jira.calls).toEqual([]);
  });

  it('falls back to the Task template when Jira returns no issue type', async () => {
    jira.handler = () => ({ status: 200, body: { id: '10010', fields: {} } });
    const res = await validateTransition({ issue: { id: '10010' } }, {}, storage);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain(DEFAULT_DEFINITION_OF_DONE.items[0].title);
  });

  it('blocks with the missing-context message when the payload has no issue', async () => {
    const res = await validateTransition({}, {}, storage);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain('Missing issue context');
  });
});
