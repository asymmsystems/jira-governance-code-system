/**
 * M-4: a deleted Jira issue's records are deleted with it.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import * as fs from 'fs';
import * as path from 'path';
import { CountingStorage } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));

import { deleteIssueRecords, issueDeletedTrigger, MAX_DELETE_PAGES } from '../../src/privacy/issue-deleted';
import { eventKey, stateKey, legacyKey } from '../../src/storage/checklist-store';

describe('M-4 issue deleted', () => {
  let storage: CountingStorage;

  beforeEach(() => {
    storage = new CountingStorage();
  });

  it('deletes the state, every event in pages and the v1 record of that issue only', async () => {
    for (let n = 1; n <= 250; n++) storage.put(eventKey('70001', n), { seq: n });
    storage.put(stateKey('70001'), { seq: 250 });
    storage.put(legacyKey('70001'), { items: [] });
    storage.put(eventKey('700011', 1), { seq: 1 });
    storage.put(stateKey('70002'), { seq: 1 });
    storage.put('dg:pty:712020:a', { pseudonym: 'dgp-1' });
    expect(await deleteIssueRecords(storage, '70001')).toBe(252);
    expect([...storage.store.keys()].sort()).toEqual(['dg:evt:700011:00000001', 'dg:pty:712020:a', 'dg:state:70002']);
    expect(await deleteIssueRecords(storage, '70001')).toBe(0);
  });

  it('ignores an event without a numeric issue id', async () => {
    storage.put(stateKey('x'), {});
    expect(await deleteIssueRecords(storage, '')).toBe(0);
    expect(await deleteIssueRecords(storage, 'x')).toBe(0);
    expect(storage.read(stateKey('x'))).toEqual({});
  });

  it('treats a provider page without keys as empty', async () => {
    (storage as any).listByPrefix = async () => ({ values: [] });
    expect(await deleteIssueRecords(storage, '70005')).toBe(0);
  });

  it('stops after MAX_DELETE_PAGES pages', async () => {
    storage.listByPrefix = async () => ({ values: [1], keys: ['dg:evt:70003:00000001'] });
    storage.delete = async () => {};
    expect(await deleteIssueRecords(storage, '70003')).toBe(MAX_DELETE_PAGES);
  });

  it('the trigger logs a count and never throws', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      storage.put(stateKey('70004'), {});
      await issueDeletedTrigger({ issue: { id: '70004', key: 'DEMO-4' } }, {}, storage);
      expect(log.mock.calls[0][0]).toBe('DefinitionGuard issue deleted: 1 record(s) removed.');
      storage.failGet = () => true;
      await expect(issueDeletedTrigger({ issue: { id: '70004' } }, {}, storage)).resolves.toBeUndefined();
      expect(err.mock.calls[0][0]).toContain('could not remove the records of a deleted issue');
      await issueDeletedTrigger(undefined, {}, new CountingStorage());
      expect(log.mock.calls[1][0]).toBe('DefinitionGuard issue deleted: 0 record(s) removed.');
    } finally {
      log.mockRestore();
      err.mockRestore();
    }
  });

  it('is declared in the manifest on avi:jira:deleted:issue', () => {
    const manifest = fs.readFileSync(path.join(__dirname, '../../manifest.yml'), 'utf8');
    expect(manifest).toMatch(/trigger:\n(?:\s+#.*\n)*\s+- key: issue-deleted\n\s+function: issue-deleted-fn\n\s+events:\n\s+- avi:jira:deleted:issue/);
    expect(manifest).toMatch(/- key: issue-deleted-fn\n\s+handler: index\.issueDeletedTrigger/);
  });
});
