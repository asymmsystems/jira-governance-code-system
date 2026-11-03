/**
 * Tests for DefinitionGuard policy admin flows and resolvers.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { jira, CountingStorage, JiraCall } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return { __esModule: true, default: { asApp: () => asApp, asUser: () => asUser }, route: m.routeImpl };
});

import {
  getApproverPolicyFlow,
  searchGroupsFlow,
  setApproverPolicyFlow,
  NOT_ADMIN_MESSAGE
} from '../../src/security/policy-admin';
import { adminHandler, setGlobalStorageProvider } from '../../src/index';
import { PolicyRepository } from '../../src/storage/policy-repository';

describe('DefinitionGuard Policy Admin', () => {
  let storage: CountingStorage;
  const adminCtx = { accountId: '712020:admin' };

  beforeEach(() => {
    jira.reset();
    storage = new CountingStorage();
    setGlobalStorageProvider(storage);
  });

  describe('getApproverPolicyFlow', () => {
    it('returns NOT_ADMIN when caller lacks global ADMINISTER permission', async () => {
      jira.handler = () => ({
        status: 200,
        body: { permissions: { ADMINISTER: { havePermission: false } } }
      });
      const res = await getApproverPolicyFlow(storage, adminCtx);
      expect(res).toEqual({ ok: false, code: 'NOT_ADMIN', message: NOT_ADMIN_MESSAGE });
    });

    it('returns policy when caller is Jira admin', async () => {
      jira.handler = () => ({
        status: 200,
        body: { permissions: { ADMINISTER: { havePermission: true } } }
      });
      await new PolicyRepository(storage).saveApproverPolicy({
        roleTypeId: 'DG_APPROVER',
        parties: [{ partyId: 'g1', partyTypeId: 'GROUP', name: 'product-owners' }],
        fromDate: '2026-11-03T00:00:00.000Z',
        setByPartyId: '712020:admin'
      });
      const res = await getApproverPolicyFlow(storage, adminCtx);
      expect(res.ok).toBe(true);
      expect(res.policy?.parties).toHaveLength(1);
    });
  });

  describe('searchGroupsFlow', () => {
    it('returns NOT_ADMIN when caller is not Jira admin', async () => {
      jira.handler = () => ({
        status: 200,
        body: { permissions: { ADMINISTER: { havePermission: false } } }
      });
      const res = await searchGroupsFlow({ query: 'prod' }, adminCtx);
      expect(res).toEqual({ ok: false, code: 'NOT_ADMIN', message: NOT_ADMIN_MESSAGE });
    });

    it('rejects query that exceeds 100 characters', async () => {
      jira.handler = () => ({
        status: 200,
        body: { permissions: { ADMINISTER: { havePermission: true } } }
      });
      const res = await searchGroupsFlow({ query: 'a'.repeat(101) }, adminCtx);
      expect(res.ok).toBe(false);
      expect(res.message).toContain('must not exceed 100 characters');
    });

    it('handles missing or non-string query gracefully', async () => {
      jira.handler = (c: JiraCall) => {
        if (c.path.includes('/mypermissions')) {
          return { status: 200, body: { permissions: { ADMINISTER: { havePermission: true } } } };
        }
        if (c.path.includes('/groups/picker')) {
          expect(c.path).toContain('query=&');
          return { status: 200, body: {} };
        }
        return { status: 404, body: {} };
      };
      const res = await searchGroupsFlow({}, adminCtx);
      expect(res.ok).toBe(true);
      expect(res.groups).toEqual([]);
    });

    it('searches groups and maps items on success', async () => {
      jira.handler = (c: JiraCall) => {
        if (c.path.includes('/mypermissions')) {
          return { status: 200, body: { permissions: { ADMINISTER: { havePermission: true } } } };
        }
        if (c.path.includes('/groups/picker')) {
          expect(c.path).toContain('query=owners');
          return {
            status: 200,
            body: {
              groups: [
                { groupId: 'grp-1', name: 'product-owners' },
                { name: 'business-analysts' },
                { groupId: 'grp-3' },
                {}
              ]
            }
          };
        }
        return { status: 404, body: {} };
      };
      const res = await searchGroupsFlow({ query: 'owners' }, adminCtx);
      expect(res.ok).toBe(true);
      expect(res.groups).toEqual([
        { groupId: 'grp-1', name: 'product-owners' },
        { groupId: 'business-analysts', name: 'business-analysts' },
        { groupId: 'grp-3', name: 'grp-3' }
      ]);
    });

    it('returns failure when Jira picker returns non-200', async () => {
      jira.handler = (c: JiraCall) => {
        if (c.path.includes('/mypermissions')) {
          return { status: 200, body: { permissions: { ADMINISTER: { havePermission: true } } } };
        }
        return { status: 500, body: {} };
      };
      const res = await searchGroupsFlow({ query: 'test' }, adminCtx);
      expect(res.ok).toBe(false);
      expect(res.message).toContain('could not search groups');
    });

    it('returns failure when Jira call throws an exception', async () => {
      jira.handler = (c: JiraCall) => {
        if (c.path.includes('/mypermissions')) {
          return { status: 200, body: { permissions: { ADMINISTER: { havePermission: true } } } };
        }
        throw new Error('Connection refused');
      };
      const res = await searchGroupsFlow({ query: 'test' }, adminCtx);
      expect(res.ok).toBe(false);
      expect(res.message).toContain('could not search groups');
    });
  });

  describe('setApproverPolicyFlow', () => {
    it('returns NOT_ADMIN when caller is not Jira admin', async () => {
      jira.handler = () => ({
        status: 200,
        body: { permissions: { ADMINISTER: { havePermission: false } } }
      });
      const res = await setApproverPolicyFlow({ groupIds: [] }, storage, adminCtx);
      expect(res).toEqual({ ok: false, code: 'NOT_ADMIN', message: NOT_ADMIN_MESSAGE });
    });

    it('rejects invalid group list payload', async () => {
      jira.handler = () => ({
        status: 200,
        body: { permissions: { ADMINISTER: { havePermission: true } } }
      });
      const res = await setApproverPolicyFlow({ groupIds: 'not-array' }, storage, adminCtx);
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Invalid group list');
    });

    it('rejects more than 20 groups', async () => {
      jira.handler = () => ({
        status: 200,
        body: { permissions: { ADMINISTER: { havePermission: true } } }
      });
      const ids = Array.from({ length: 21 }, (_, i) => `grp-${i}`);
      const res = await setApproverPolicyFlow({ groupIds: ids }, storage, adminCtx);
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Choose at most 20 groups');
    });

    it('saves empty group policy and clears groups', async () => {
      jira.handler = () => ({
        status: 200,
        body: { permissions: { ADMINISTER: { havePermission: true } } }
      });
      const res = await setApproverPolicyFlow({ groupIds: [] }, storage, adminCtx);
      expect(res.ok).toBe(true);
      expect(res.policy.parties).toEqual([]);
      const saved = await new PolicyRepository(storage).getApproverPolicy();
      expect(saved?.parties).toEqual([]);
    });

    it('looks up group names in Jira and saves policy', async () => {
      jira.handler = (c: JiraCall) => {
        if (c.path.includes('/mypermissions')) {
          return { status: 200, body: { permissions: { ADMINISTER: { havePermission: true } } } };
        }
        if (c.path.includes('/group/bulk?groupId=grp-1')) {
          return { status: 200, body: { values: [{ name: 'product-owners' }] } };
        }
        if (c.path.includes('/group/bulk?groupId=grp-2')) {
          // Bulk lookup returns 200 with empty values, fall back to id
          return { status: 200, body: { values: [] } };
        }
        if (c.path.includes('/group/bulk?groupId=grp-3')) {
          // Bulk lookup returns non-200, fall back to id
          return { status: 404, body: {} };
        }
        if (c.path.includes('/group/bulk?groupId=grp-4')) {
          // Bulk lookup throws, fall back to id
          throw new Error('Not found');
        }
        return { status: 404, body: {} };
      };

      const res = await setApproverPolicyFlow({ groupIds: ['grp-1', 'grp-2', 'grp-3', 'grp-4'] }, storage, adminCtx);
      expect(res.ok).toBe(true);
      expect(res.policy.roleTypeId).toBe('DG_APPROVER');
      expect(res.policy.parties).toEqual([
        { partyId: 'grp-1', partyTypeId: 'GROUP', name: 'product-owners' },
        { partyId: 'grp-2', partyTypeId: 'GROUP', name: 'grp-2' },
        { partyId: 'grp-3', partyTypeId: 'GROUP', name: 'grp-3' },
        { partyId: 'grp-4', partyTypeId: 'GROUP', name: 'grp-4' }
      ]);
    });
  });

  describe('adminHandler resolver dispatch', () => {
    it('dispatches authority-policy-get, authority-group-search, and authority-policy-set', async () => {
      jira.handler = () => ({
        status: 200,
        body: { permissions: { ADMINISTER: { havePermission: true } } }
      });

      const getRes: any = await adminHandler({
        call: { functionKey: 'authority-policy-get', payload: {} },
        context: adminCtx
      } as any);
      expect(getRes.ok).toBe(true);

      const searchRes: any = await adminHandler({
        call: { functionKey: 'authority-group-search', payload: { query: 'test' } },
        context: adminCtx
      } as any);
      expect(searchRes.ok).toBe(true);

      const setRes: any = await adminHandler({
        call: { functionKey: 'authority-policy-set', payload: { groupIds: [] } },
        context: adminCtx
      } as any);
      expect(setRes.ok).toBe(true);
    });
  });
});
