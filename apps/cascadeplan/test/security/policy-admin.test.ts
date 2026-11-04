/**
 * Tests for CascadePlan policy admin flows and two-tier authorization model.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */

import { MemStorage } from '../helpers/mem-storage';
import { PolicyRepository } from '../../src/storage/policy-repository';

let mockAsUserRequest = jest.fn();
let mockAsAppRequest = jest.fn();

jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asUser: () => ({ requestJira: (...args: any[]) => mockAsUserRequest(...args) }),
    asApp: () => ({ requestJira: (...args: any[]) => mockAsAppRequest(...args) })
  },
  route: (strings: TemplateStringsArray, ...values: any[]) =>
    strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
  }));

import {
  isJiraAdmin,
  hasTier1AdminPermission,
  isPlanApprover,
  getApproverPolicyFlow,
  searchGroupsFlow,
  setApproverPolicyFlow,
  NOT_ADMIN_MESSAGE,
  MAX_QUERY_CHARS,
  MAX_APPROVER_GROUPS
} from '../../src/security/policy-admin';

describe('CascadePlan Policy Admin and Authorization', () => {
  let storage: MemStorage;
  const adminContext = { accountId: '712020:admin-user' };

  beforeEach(() => {
    jest.clearAllMocks();
    storage = new MemStorage();
  });

  describe('isJiraAdmin', () => {
    it('returns true when caller holds global ADMINISTER permission', async () => {
      mockAsUserRequest.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ permissions: { ADMINISTER: { havePermission: true } } })
      });
      const result = await isJiraAdmin();
      expect(result).toBe(true);
    });

    it('returns false when caller lacks ADMINISTER permission', async () => {
      mockAsUserRequest.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ permissions: { ADMINISTER: { havePermission: false } } })
      });
      const result = await isJiraAdmin();
      expect(result).toBe(false);
    });

    it('returns false when Jira API returns non-200 status', async () => {
      mockAsUserRequest.mockResolvedValueOnce({ status: 403 });
      const result = await isJiraAdmin();
      expect(result).toBe(false);
    });

    it('returns false when Jira API call throws (fail-closed)', async () => {
      mockAsUserRequest.mockRejectedValueOnce(new Error('Network timeout'));
      const result = await isJiraAdmin();
      expect(result).toBe(false);
    });
  });

  describe('hasTier1AdminPermission', () => {
    it('checks permission with numeric issueId', async () => {
      mockAsUserRequest.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ permissions: { ADMINISTER_PROJECTS: { havePermission: true } } })
      });
      const result = await hasTier1AdminPermission('10001');
      expect(result).toBe(true);
    });

    it('checks permission with issueKey', async () => {
      mockAsUserRequest.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ permissions: { ADMINISTER: { havePermission: true } } })
      });
      const result = await hasTier1AdminPermission('PROJ-123');
      expect(result).toBe(true);
    });

    it('checks permission without issue identifier', async () => {
      mockAsUserRequest.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ permissions: { ADMINISTER: { havePermission: false }, ADMINISTER_PROJECTS: { havePermission: false } } })
      });
      const result = await hasTier1AdminPermission();
      expect(result).toBe(false);
    });

    it('returns false when Jira permissions missing in response', async () => {
      mockAsUserRequest.mockResolvedValueOnce({
        status: 200,
        json: async () => ({})
      });
      const result = await hasTier1AdminPermission('TEST-1');
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      mockAsUserRequest.mockRejectedValueOnce(new Error('Connection reset'));
      const result = await hasTier1AdminPermission('TEST-1');
      expect(result).toBe(false);
    });
  });

  describe('isPlanApprover', () => {
    it('returns true when caller is Tier 1 admin', async () => {
      mockAsUserRequest.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ permissions: { ADMINISTER: { havePermission: true } } })
      });
      const result = await isPlanApprover(storage, 'PROJ-1');
      expect(result).toBe(true);
    });

    it('returns false when not Tier 1 and no policy configured', async () => {
      mockAsUserRequest.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ permissions: { ADMINISTER: { havePermission: false } } })
      });
      const result = await isPlanApprover(storage, 'PROJ-1');
      expect(result).toBe(false);
    });

    it('returns true when caller belongs to configured approver group by ID', async () => {
      mockAsUserRequest
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ permissions: { ADMINISTER: { havePermission: false } } })
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({
            groups: {
              items: [{ groupId: 'target-group-id', name: 'Delivery Leads' }]
            }
          })
        });

      await new PolicyRepository(storage).saveApproverPolicy({
        roleTypeId: 'PS_APPROVER',
        parties: [{ partyId: 'target-group-id', partyTypeId: 'GROUP', name: 'Delivery Leads' }],
        fromDate: '2026-11-03T00:00:00Z',
        setByPartyId: 'admin'
      });

      const result = await isPlanApprover(storage, 'PROJ-1');
      expect(result).toBe(true);
    });

    it('returns true when caller belongs to configured approver group by name', async () => {
      mockAsUserRequest
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ permissions: { ADMINISTER: { havePermission: false } } })
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({
            groups: {
              items: [{ groupId: 'diff-id', name: 'Program Managers' }]
            }
          })
        });

      await new PolicyRepository(storage).saveApproverPolicy({
        roleTypeId: 'PS_APPROVER',
        parties: [{ partyId: 'some-id', partyTypeId: 'GROUP', name: 'Program Managers' }],
        fromDate: '2026-11-03T00:00:00Z',
        setByPartyId: 'admin'
      });

      const result = await isPlanApprover(storage, 'PROJ-1');
      expect(result).toBe(true);
    });

    it('returns false when caller does not belong to any configured group', async () => {
      mockAsUserRequest
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ permissions: { ADMINISTER: { havePermission: false } } })
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({
            groups: {
              items: [{ groupId: 'other-group', name: 'Other Group' }]
            }
          })
        });

      await new PolicyRepository(storage).saveApproverPolicy({
        roleTypeId: 'PS_APPROVER',
        parties: [{ partyId: 'target-group-id', partyTypeId: 'GROUP', name: 'Delivery Leads' }],
        fromDate: '2026-11-03T00:00:00Z',
        setByPartyId: 'admin'
      });

      const result = await isPlanApprover(storage, 'PROJ-1');
      expect(result).toBe(false);
    });

    it('returns false when myself endpoint fails or throws', async () => {
      mockAsUserRequest
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ permissions: { ADMINISTER: { havePermission: false } } })
        })
        .mockResolvedValueOnce({
          status: 500
        });

      await new PolicyRepository(storage).saveApproverPolicy({
        roleTypeId: 'PS_APPROVER',
        parties: [{ partyId: 'target-group-id', partyTypeId: 'GROUP', name: 'Delivery Leads' }],
        fromDate: '2026-11-03T00:00:00Z',
        setByPartyId: 'admin'
      });

      const result = await isPlanApprover(storage, 'PROJ-1');
      expect(result).toBe(false);

      // Rejection test for fail-closed catch
      mockAsUserRequest
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ permissions: { ADMINISTER: { havePermission: false } } })
        })
        .mockRejectedValueOnce(new Error('Myself network timeout'));

      const resultThrown = await isPlanApprover(storage, 'PROJ-1');
      expect(resultThrown).toBe(false);
    });
  });

  describe('getApproverPolicyFlow', () => {
    it('returns NOT_ADMIN error when caller is not Jira admin', async () => {
      mockAsUserRequest.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ permissions: { ADMINISTER: { havePermission: false } } })
      });

      const res = await getApproverPolicyFlow(storage, adminContext);
      expect(res).toEqual({ ok: false, code: 'NOT_ADMIN', message: NOT_ADMIN_MESSAGE });
    });

    it('returns policy when caller is Jira admin', async () => {
      mockAsUserRequest.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ permissions: { ADMINISTER: { havePermission: true } } })
      });

      await new PolicyRepository(storage).saveApproverPolicy({
        roleTypeId: 'PS_APPROVER',
        parties: [{ partyId: 'group-1', partyTypeId: 'GROUP', name: 'Delivery Leads' }],
        fromDate: '2026-11-03T00:00:00Z',
        setByPartyId: 'admin'
      });

      const res = await getApproverPolicyFlow(storage, adminContext);
      expect(res.ok).toBe(true);
      expect(res.policy?.parties).toHaveLength(1);
    });
  });

  describe('searchGroupsFlow', () => {
    it('returns NOT_ADMIN when caller is not Jira admin', async () => {
      mockAsUserRequest.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ permissions: { ADMINISTER: { havePermission: false } } })
      });

      const res = await searchGroupsFlow({ query: 'dev' }, adminContext);
      expect(res).toEqual({ ok: false, code: 'NOT_ADMIN', message: NOT_ADMIN_MESSAGE });
    });

    it('returns error when query exceeds max character limit', async () => {
      mockAsUserRequest.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ permissions: { ADMINISTER: { havePermission: true } } })
      });

      const longQuery = 'a'.repeat(MAX_QUERY_CHARS + 1);
      const res = await searchGroupsFlow({ query: longQuery }, adminContext);
      expect(res.ok).toBe(false);
      expect(res.message).toContain('Search query must not exceed');
    });

    it('searches groups in Jira and returns mapped results', async () => {
      mockAsUserRequest
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ permissions: { ADMINISTER: { havePermission: true } } })
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({
            groups: [
              { groupId: 'g1', name: 'delivery-leads' },
              { groupId: 'g2', name: 'pmo-team' }
            ]
          })
        });

      const res = await searchGroupsFlow({ query: 'delivery' }, adminContext);
      expect(res.ok).toBe(true);
      expect(res.groups).toEqual([
        { groupId: 'g1', name: 'delivery-leads' },
        { groupId: 'g2', name: 'pmo-team' }
      ]);
    });

    it('handles Jira search API error', async () => {
      mockAsUserRequest
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ permissions: { ADMINISTER: { havePermission: true } } })
        })
        .mockResolvedValueOnce({
          status: 500
        });

      const res = await searchGroupsFlow({ query: 'leads' }, adminContext);
      expect(res.ok).toBe(false);
      expect(res.message).toContain('could not search groups');

      // Rejection test for fail-closed catch
      mockAsUserRequest
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ permissions: { ADMINISTER: { havePermission: true } } })
        })
        .mockRejectedValueOnce(new Error('Search network failure'));

      const resThrown = await searchGroupsFlow({ query: 'leads' }, adminContext);
      expect(resThrown.ok).toBe(false);
      expect(resThrown.message).toContain('could not search groups');
    });
  });

  describe('setApproverPolicyFlow', () => {
    it('returns NOT_ADMIN when caller is not Jira admin', async () => {
      mockAsUserRequest.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ permissions: { ADMINISTER: { havePermission: false } } })
      });

      const res = await setApproverPolicyFlow({ groupIds: ['g1'] }, storage, adminContext);
      expect(res).toEqual({ ok: false, code: 'NOT_ADMIN', message: NOT_ADMIN_MESSAGE });
    });

    it('returns error when groupIds is not an array', async () => {
      mockAsUserRequest.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ permissions: { ADMINISTER: { havePermission: true } } })
      });

      const res = await setApproverPolicyFlow({ groupIds: 'not-array' }, storage, adminContext);
      expect(res.ok).toBe(false);
      expect(res.message).toBe('Invalid group list provided.');
    });

    it('returns error when exceeding max group limit', async () => {
      mockAsUserRequest.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ permissions: { ADMINISTER: { havePermission: true } } })
      });

      const groupIds = Array.from({ length: MAX_APPROVER_GROUPS + 1 }, (_, i) => `group-${i}`);
      const res = await setApproverPolicyFlow({ groupIds }, storage, adminContext);
      expect(res.ok).toBe(false);
      expect(res.message).toContain(`Choose at most ${MAX_APPROVER_GROUPS} groups.`);
    });

    it('resolves group names and saves policy successfully', async () => {
      mockAsUserRequest
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ permissions: { ADMINISTER: { havePermission: true } } })
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({
            values: [{ groupId: 'g1', name: 'Delivery Leads' }]
          })
        });

      const res = await setApproverPolicyFlow({ groupIds: ['g1'] }, storage, adminContext);
      expect(res.ok).toBe(true);
      expect(res.policy.roleTypeId).toBe('CP_APPROVER');
      expect(res.policy.parties).toEqual([
        { partyId: 'g1', partyTypeId: 'GROUP', name: 'Delivery Leads' }
      ]);
      expect(res.policy.setByPartyId).toBe('712020:admin-user');

      const saved = await new PolicyRepository(storage).getApproverPolicy();
      expect(saved?.parties).toEqual([
        { partyId: 'g1', partyTypeId: 'GROUP', name: 'Delivery Leads' }
      ]);
    });

    it('falls back to groupId if bulk endpoint fails or returns no name', async () => {
      mockAsUserRequest
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({ permissions: { ADMINISTER: { havePermission: true } } })
        })
        .mockResolvedValueOnce({
          status: 404
        });

      const res = await setApproverPolicyFlow({ groupIds: ['g2'] }, storage, adminContext);
      expect(res.ok).toBe(true);
      expect(res.policy.parties).toEqual([
        { partyId: 'g2', partyTypeId: 'GROUP', name: 'g2' }
      ]);
    });
  });
});
