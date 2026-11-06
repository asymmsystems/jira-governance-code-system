/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: admin settings in KVS and the Jira directory reads as the user (ADR-013, ADR-014).
 */

jest.mock('@forge/api', () => {
  const actual = jest.requireActual('@forge/api');
  return { ...actual, __esModule: true };
});

import { DEFAULT_SOURCE_SETTINGS } from '../src/contract/data/models';
import { APPROVER_POLICY_KEY, DETECTED_KEY, DefaultKvsSettingsAccessor, SETTINGS_KEY } from '../src/accessor/default-kvs-settings-accessor';
import { DefaultForgeJiraDirectoryAccessor } from '../src/accessor/default-forge-jira-directory-accessor';
import { MemoryStorage } from './storage/memory-storage';

const pathOf = (r: any): string => (typeof r === 'string' ? r : r.value);
const ok = (body: unknown) => ({ status: 200, json: async () => body });

describe('DefaultKvsSettingsAccessor', () => {
  it('returns the defaults until settings are saved, then the saved values', async () => {
    const storage = new MemoryStorage();
    const a = new DefaultKvsSettingsAccessor(storage);
    expect(a.serviceType).toBe('accessor');
    expect(await a.getSettings()).toEqual(DEFAULT_SOURCE_SETTINGS);
    await a.saveSettings({ ...DEFAULT_SOURCE_SETTINGS, audit: 'off', updatedAt: 't' });
    expect((await a.getSettings()).audit).toBe('off');
    expect(storage.store.has(SETTINGS_KEY)).toBe(true);
    await storage.set(SETTINGS_KEY, { schemaVersion: 9 });
    expect(await a.getSettings()).toEqual(DEFAULT_SOURCE_SETTINGS);
  });

  it('keeps the detection and the approver policy under their own keys, with no account id', async () => {
    const storage = new MemoryStorage();
    const a = new DefaultKvsSettingsAccessor(storage);
    expect(await a.getDetected()).toEqual({});
    await a.saveDetected({ ledgerseal: { seenAt: 't' } });
    expect(storage.store.get(DETECTED_KEY)).toEqual({ ledgerseal: { seenAt: 't' } });
    expect(await a.getApproverPolicy()).toBeUndefined();
    const policy = { roleTypeId: 'FR_APPROVER' as const, parties: [{ partyId: 'g1', partyTypeId: 'GROUP' as const, name: 'release-managers' }], fromDate: 't' };
    await a.saveApproverPolicy(policy);
    expect(await a.getApproverPolicy()).toEqual(policy);
    expect(JSON.stringify(storage.store.get(APPROVER_POLICY_KEY))).not.toMatch(/accountId|setBy/);
  });
});

describe('DefaultForgeJiraDirectoryAccessor', () => {
  it('checks the global ADMINISTER permission and fails closed', async () => {
    const yes = new DefaultForgeJiraDirectoryAccessor(jest.fn().mockResolvedValue(ok({ permissions: { ADMINISTER: { havePermission: true } } })));
    expect(yes.serviceType).toBe('accessor');
    expect(await yes.isJiraAdmin()).toBe(true);
    expect(await new DefaultForgeJiraDirectoryAccessor(jest.fn().mockResolvedValue(ok({ permissions: {} }))).isJiraAdmin()).toBe(false);
    expect(await new DefaultForgeJiraDirectoryAccessor(jest.fn().mockResolvedValue({ status: 403, json: async () => ({}) })).isJiraAdmin()).toBe(false);
    expect(await new DefaultForgeJiraDirectoryAccessor(jest.fn().mockRejectedValue(new Error('net'))).isJiraAdmin()).toBe(false);
    const request = jest.fn().mockResolvedValue(ok(null));
    expect(await new DefaultForgeJiraDirectoryAccessor(request).isJiraAdmin()).toBe(false);
    expect(pathOf(request.mock.calls[0][0])).toBe('/rest/api/3/mypermissions?permissions=ADMINISTER');
  });

  it('reads the caller\'s groups, and reports a failure', async () => {
    const request = jest.fn().mockResolvedValue(ok({ groups: { items: [{ groupId: 'g1', name: 'release-managers' }, { name: 'legacy' }, {}] } }));
    const d = new DefaultForgeJiraDirectoryAccessor(request);
    expect(await d.myGroups()).toEqual({ status: 200, groups: [{ groupId: 'g1', name: 'release-managers' }, { groupId: 'legacy', name: 'legacy' }] });
    expect(pathOf(request.mock.calls[0][0])).toBe('/rest/api/3/myself?expand=groups');
    expect(await new DefaultForgeJiraDirectoryAccessor(jest.fn().mockResolvedValue({ status: 401, json: async () => ({}) })).myGroups()).toEqual({ status: 401, groups: [] });
    expect(await new DefaultForgeJiraDirectoryAccessor(jest.fn().mockRejectedValue(new Error('net'))).myGroups()).toEqual({ status: 0, groups: [] });
    expect(await new DefaultForgeJiraDirectoryAccessor(jest.fn().mockResolvedValue(ok(null))).myGroups()).toEqual({ status: 200, groups: [] });
  });

  it('searches groups by name, with the query cut to 100 characters', async () => {
    const request = jest.fn().mockResolvedValue(ok({ groups: [{ groupId: 'g2', name: 'architecture-board' }] }));
    const d = new DefaultForgeJiraDirectoryAccessor(request);
    expect(await d.searchGroups(' arch ')).toEqual({ status: 200, groups: [{ groupId: 'g2', name: 'architecture-board' }] });
    expect(pathOf(request.mock.calls[0][0])).toBe('/rest/api/3/groups/picker?query=arch&maxResults=20');
    await d.searchGroups('x'.repeat(150));
    expect(pathOf(request.mock.calls[1][0])).toContain(`query=${'x'.repeat(100)}&`);
    expect(await new DefaultForgeJiraDirectoryAccessor(jest.fn().mockResolvedValue({ status: 500, json: async () => ({}) })).searchGroups('a')).toEqual({ status: 500, groups: [] });
    expect(await new DefaultForgeJiraDirectoryAccessor(jest.fn().mockRejectedValue(new Error('net'))).searchGroups('a')).toEqual({ status: 0, groups: [] });
    expect(await new DefaultForgeJiraDirectoryAccessor(jest.fn().mockResolvedValue(ok(null))).searchGroups('a')).toEqual({ status: 200, groups: [] });
  });

  it('names groups by id, and keeps the id when a name cannot be read', async () => {
    const request = jest.fn()
      .mockResolvedValueOnce(ok({ values: [{ groupId: 'g1', name: 'release-managers' }] }))
      .mockResolvedValueOnce({ status: 404, json: async () => ({}) })
      .mockRejectedValueOnce(new Error('net'))
      .mockResolvedValueOnce(ok(null));
    const d = new DefaultForgeJiraDirectoryAccessor(request);
    expect(await d.groupNames(['g1', 'g2', 'g3', 'g4'])).toEqual([
      { groupId: 'g1', name: 'release-managers' }, { groupId: 'g2', name: 'g2' }, { groupId: 'g3', name: 'g3' }, { groupId: 'g4', name: 'g4' }
    ]);
    expect(pathOf(request.mock.calls[0][0])).toBe('/rest/api/3/group/bulk?groupId=g1');
  });

  it('reads display names in batches of 50, encoded, and leaves out what it cannot read', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `id:${i}`);
    const request = jest.fn()
      .mockResolvedValueOnce(ok({ values: [{ accountId: 'id:0', displayName: 'Ana Silva' }, { accountId: 'id:1' }] }))
      .mockResolvedValueOnce({ status: 500, json: async () => ({}) });
    const d = new DefaultForgeJiraDirectoryAccessor(request);
    expect(await d.userNames([...ids, 'id:0', ''])).toEqual({ 'id:0': 'Ana Silva' });
    expect(request).toHaveBeenCalledTimes(2);
    expect(pathOf(request.mock.calls[0][0])).toMatch(/^\/rest\/api\/3\/user\/bulk\?maxResults=50&accountId=id%3A0&accountId=id%3A1&/);
    expect(await new DefaultForgeJiraDirectoryAccessor(jest.fn().mockRejectedValue(new Error('net'))).userNames(['a'])).toEqual({});
    expect(await new DefaultForgeJiraDirectoryAccessor(jest.fn().mockResolvedValue(ok(null))).userNames(['a'])).toEqual({});
    expect(await d.userNames([])).toEqual({});
  });
});
