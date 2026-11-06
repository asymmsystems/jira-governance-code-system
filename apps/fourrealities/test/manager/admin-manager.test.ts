/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the admin page use cases, Jira administrators only (ADR-011, permission standard 2.2).
 */

import { DEFAULT_SOURCE_SETTINGS } from '../../src/contract/data/models';
import { DefaultAdminManager, NOT_ADMIN_MESSAGE } from '../../src/manager/default-admin-manager';
import { DefaultSourcePolicyEngine } from '../../src/engine/default-source-policy-engine';
import { DefaultKvsSettingsAccessor } from '../../src/accessor/default-kvs-settings-accessor';
import { MemoryStorage } from '../storage/memory-storage';

const NOW = () => new Date('2026-11-06T10:00:00.000Z');
const CONFIG = { devFieldId: 'customfield_10000', siteHost: 's', statusCategories: {}, pullRequestsSeen: true, readAt: 't' };

function setup(o: { admin?: boolean; search?: any; names?: any; configFails?: boolean } = {}) {
  const storage = new MemoryStorage();
  const directory: any = {
    serviceType: 'accessor',
    isJiraAdmin: jest.fn().mockResolvedValue(o.admin ?? true),
    searchGroups: jest.fn().mockResolvedValue(o.search || { status: 200, groups: [{ groupId: 'g1', name: 'release-managers' }] }),
    groupNames: jest.fn().mockImplementation(async (ids: string[]) => ids.map(id => ({ groupId: id, name: `name-${id}` })))
  };
  const siteConfig: any = { serviceType: 'accessor', get: o.configFails ? jest.fn().mockRejectedValue(new Error('403')) : jest.fn().mockResolvedValue(CONFIG) };
  const manager = new DefaultAdminManager({ directory, settings: new DefaultKvsSettingsAccessor(storage), siteConfig, sources: new DefaultSourcePolicyEngine(), now: NOW });
  return { manager, storage, directory };
}

describe('DefaultAdminManager', () => {
  it('refuses every call from a user who is not a Jira administrator, and writes nothing', async () => {
    const { manager, storage, directory } = setup({ admin: false });
    expect(manager.serviceType).toBe('manager');
    const refused = { ok: false, code: 'NOT_ADMIN', message: NOT_ADMIN_MESSAGE };
    expect(await manager.view()).toEqual(refused);
    expect(await manager.saveSources({ intent: 'on' })).toEqual(refused);
    expect(await manager.searchGroups({ query: 'a' })).toEqual(refused);
    expect(await manager.saveApprovers({ groupIds: ['g1'] })).toEqual(refused);
    expect(storage.count('set')).toBe(0);
    expect(directory.searchGroups).not.toHaveBeenCalled();
  });

  it('shows the default settings, the checks in use and no approver group', async () => {
    const res: any = await setup().manager.view();
    expect(res).toMatchObject({ ok: true, settings: DEFAULT_SOURCE_SETTINGS, detected: {}, policy: { parties: [] } });
    expect(res.sources).toMatchObject({ intent: true, process: null, code: true, audit: false });
    expect(res.defaultDecisionIssueTypes).toContain('adr');
  });

  it('saves valid evidence sources and refuses invalid ones', async () => {
    const { manager, storage } = setup();
    const saved: any = await manager.saveSources({ intent: 'on', process: 'herocoders', code: 'off', audit: 'ledgerseal', decisionIssueTypes: ['ADR', 'RFC'] });
    expect(saved.ok).toBe(true);
    expect(saved.settings).toEqual({ schemaVersion: 1, intent: 'on', process: 'herocoders', code: 'off', audit: 'ledgerseal', decisionIssueTypes: ['adr', 'rfc'], updatedAt: '2026-11-06T10:00:00.000Z' });
    expect(saved.sources).toMatchObject({ process: 'herocoders', code: false, audit: true });
    expect(await manager.saveSources({ intent: 'maybe' })).toEqual({ ok: false, code: 'INVALID_INPUT', message: 'Choose a valid Intent source.' });
    expect(storage.count('set')).toBe(1);
  });

  it('searches groups and reports a failed search', async () => {
    expect(await setup().manager.searchGroups({ query: 'rel' })).toEqual({ ok: true, groups: [{ groupId: 'g1', name: 'release-managers' }] });
    expect(await setup().manager.searchGroups(undefined)).toMatchObject({ ok: true });
    expect(await setup().manager.searchGroups({ query: 'x'.repeat(101) })).toEqual({ ok: false, code: 'INVALID_INPUT', message: 'Search with at most 100 characters.' });
    expect(await setup({ search: { status: 500, groups: [] } }).manager.searchGroups({ query: 'a' })).toEqual({ ok: false, code: 'JIRA_ERROR', message: 'FourRealities could not search groups in Jira. Try again.' });
  });

  it('saves at most 20 approver groups by id and name, with no account id', async () => {
    const { manager, storage } = setup();
    const res: any = await manager.saveApprovers({ groupIds: ['g1', 'g1', 'g2', ''] });
    expect(res.policy).toEqual({ parties: [{ partyId: 'g1', name: 'name-g1' }, { partyId: 'g2', name: 'name-g2' }] });
    expect(storage.store.get('fr:cfg:approver_policy')).toEqual({ roleTypeId: 'FR_APPROVER', parties: [{ partyId: 'g1', partyTypeId: 'GROUP', name: 'name-g1' }, { partyId: 'g2', partyTypeId: 'GROUP', name: 'name-g2' }], fromDate: '2026-11-06T10:00:00.000Z' });
    expect(await manager.saveApprovers({ groupIds: 'g1' })).toEqual({ ok: false, code: 'INVALID_INPUT', message: 'Give the approver groups as a list.' });
    expect(await manager.saveApprovers({ groupIds: Array.from({ length: 21 }, (_, i) => `g${i}`) })).toEqual({ ok: false, code: 'INVALID_INPUT', message: 'Choose at most 20 groups.' });
  });

  it('reports a site configuration it cannot read', async () => {
    expect(await setup({ configFails: true }).manager.view()).toEqual({ ok: false, code: 'JIRA_ERROR', message: 'FourRealities could not read the site configuration from Jira. Try again.' });
  });

  it('uses the clock when no clock is given', async () => {
    const storage = new MemoryStorage();
    const m = new DefaultAdminManager({
      directory: { serviceType: 'accessor', isJiraAdmin: async () => true } as any,
      settings: new DefaultKvsSettingsAccessor(storage),
      siteConfig: { serviceType: 'accessor', get: async () => CONFIG } as any,
      sources: new DefaultSourcePolicyEngine()
    });
    const res: any = await m.saveSources({ intent: 'on', process: 'auto', code: 'auto', audit: 'auto', decisionIssueTypes: ['adr'] });
    expect(Date.parse(res.settings.updatedAt)).not.toBeNaN();
  });
});
