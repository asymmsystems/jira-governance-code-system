/**
 * Tests for DefinitionGuard Two-Tier Fail-Closed Authorization.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { jira, CountingStorage, JiraCall, JiraReply } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return { __esModule: true, default: { asApp: () => asApp, asUser: () => asUser }, route: m.routeImpl };
});

import {
  isJiraAdmin,
  hasTier1AdminPermission,
  getCallerGroupIds,
  hasApproverPermission,
  checkApproverPermission,
  approverGroupNames,
  APPROVER_REQUIRED_MESSAGE
} from '../../src/security/approver';
import { PolicyRepository } from '../../src/storage/policy-repository';
import { ApproverPolicy } from '../../src/domain/models';

describe('Two-Tier Approver Authorization', () => {
  let storage: CountingStorage;

  beforeEach(() => {
    jira.reset();
    storage = new CountingStorage();
  });

  describe('isJiraAdmin', () => {
    it('returns true when caller has global ADMINISTER permission', async () => {
      jira.handler = (c: JiraCall) => ({
        status: 200,
        body: { permissions: { ADMINISTER: { havePermission: true } } }
      });
      expect(await isJiraAdmin()).toBe(true);
    });

    it('returns false when caller lacks ADMINISTER permission', async () => {
      jira.handler = (c: JiraCall) => ({
        status: 200,
        body: { permissions: { ADMINISTER: { havePermission: false } } }
      });
      expect(await isJiraAdmin()).toBe(false);
    });

    it('returns false when Jira call returns non-200', async () => {
      jira.handler = () => ({ status: 500, body: {} });
      expect(await isJiraAdmin()).toBe(false);
    });

    it('returns false when Jira call throws', async () => {
      jira.handler = () => {
        throw new Error('Network error');
      };
      expect(await isJiraAdmin()).toBe(false);
    });
  });

  describe('hasTier1AdminPermission', () => {
    it('returns false when issueIdOrKey is empty', async () => {
      expect(await hasTier1AdminPermission('')).toBe(false);
    });

    it('queries using issueId for numeric strings and returns true if ADMINISTER_PROJECTS is held', async () => {
      jira.handler = (c: JiraCall) => {
        expect(c.path).toContain('issueId=10067');
        return {
          status: 200,
          body: {
            permissions: {
              ADMINISTER_PROJECTS: { havePermission: true },
              ADMINISTER: { havePermission: false }
            }
          }
        };
      };
      expect(await hasTier1AdminPermission('10067')).toBe(true);
    });

    it('queries using issueKey for alphanumeric keys and returns true if ADMINISTER is held', async () => {
      jira.handler = (c: JiraCall) => {
        expect(c.path).toContain('issueKey=DEMO-35');
        return {
          status: 200,
          body: {
            permissions: {
              ADMINISTER_PROJECTS: { havePermission: false },
              ADMINISTER: { havePermission: true }
            }
          }
        };
      };
      expect(await hasTier1AdminPermission('DEMO-35')).toBe(true);
    });

    it('returns false when neither admin permission is held', async () => {
      jira.handler = () => ({
        status: 200,
        body: {
          permissions: {
            ADMINISTER_PROJECTS: { havePermission: false },
            ADMINISTER: { havePermission: false }
          }
        }
      });
      expect(await hasTier1AdminPermission('DEMO-35')).toBe(false);
    });

    it('returns false when body has no permissions object', async () => {
      jira.handler = () => ({ status: 200, body: {} });
      expect(await hasTier1AdminPermission('DEMO-35')).toBe(false);
    });

    it('returns false on non-200 response', async () => {
      jira.handler = () => ({ status: 403, body: {} });
      expect(await hasTier1AdminPermission('DEMO-35')).toBe(false);
    });

    it('returns false when Jira call throws an exception', async () => {
      jira.handler = () => {
        throw new Error('Timeout');
      };
      expect(await hasTier1AdminPermission('DEMO-35')).toBe(false);
    });
  });

  describe('getCallerGroupIds', () => {
    it('returns empty array when groups items is not an array or has empty items', async () => {
      jira.handler = () => ({
        status: 200,
        body: { groups: { items: [{}, { groupId: '' }] } }
      });
      expect(await getCallerGroupIds()).toEqual([]);

      jira.handler = () => ({
        status: 200,
        body: { groups: null }
      });
      expect(await getCallerGroupIds()).toEqual([]);
    });

    it('returns group ids and names from myself endpoint', async () => {
      jira.handler = (c: JiraCall) => {
        expect(c.path).toContain('/rest/api/3/myself?expand=groups');
        return {
          status: 200,
          body: {
            groups: {
              items: [
                { groupId: 'grp-1', name: 'product-owners' },
                { name: 'lead-architects' }
              ]
            }
          }
        };
      };
      const groups = await getCallerGroupIds();
      expect(groups).toEqual(['grp-1', 'lead-architects']);
    });

    it('returns null when endpoint returns non-200', async () => {
      jira.handler = () => ({ status: 500, body: {} });
      expect(await getCallerGroupIds()).toBeNull();
    });

    it('returns null when endpoint throws an exception', async () => {
      jira.handler = () => {
        throw new Error('Unreachable');
      };
      expect(await getCallerGroupIds()).toBeNull();
    });
  });

  describe('hasApproverPermission and checkApproverPermission', () => {
    it('grants access when Tier 1 admin permission is held without consulting policy storage', async () => {
      jira.handler = () => ({
        status: 200,
        body: { permissions: { ADMINISTER_PROJECTS: { havePermission: true } } }
      });
      const allowed = await hasApproverPermission('DEMO-35', storage);
      expect(allowed).toBe(true);
      expect(storage.gets).toEqual([]);
      await expect(checkApproverPermission('DEMO-35', storage)).resolves.toBeUndefined();
    });

    it('denies access when caller is not Tier 1 and no policy is stored', async () => {
      jira.handler = () => ({
        status: 200,
        body: { permissions: { ADMINISTER_PROJECTS: { havePermission: false }, ADMINISTER: { havePermission: false } } }
      });
      expect(await hasApproverPermission('DEMO-35', storage)).toBe(false);
      await expect(checkApproverPermission('DEMO-35', storage)).rejects.toThrow(APPROVER_REQUIRED_MESSAGE);
    });

    it('denies access when policy has 0 parties', async () => {
      jira.handler = () => ({
        status: 200,
        body: { permissions: { ADMINISTER_PROJECTS: { havePermission: false }, ADMINISTER: { havePermission: false } } }
      });
      await new PolicyRepository(storage).saveApproverPolicy({
        roleTypeId: 'DG_APPROVER',
        parties: [],
        fromDate: '2026-11-03T00:00:00.000Z',
        setByPartyId: '712020:admin'
      });
      expect(await hasApproverPermission('DEMO-35', storage)).toBe(false);
    });

    it('denies access when group lookup fails closed', async () => {
      jira.handler = (c: JiraCall) => {
        if (c.path.includes('/mypermissions')) {
          return { status: 200, body: { permissions: {} } };
        }
        return { status: 500, body: {} };
      };
      await new PolicyRepository(storage).saveApproverPolicy({
        roleTypeId: 'DG_APPROVER',
        parties: [{ partyId: 'grp-1', partyTypeId: 'GROUP', name: 'product-owners' }],
        fromDate: '2026-11-03T00:00:00.000Z',
        setByPartyId: '712020:admin'
      });
      expect(await hasApproverPermission('DEMO-35', storage)).toBe(false);
    });

    it('grants access when user belongs to an authorized group by groupId', async () => {
      jira.handler = (c: JiraCall) => {
        if (c.path.includes('/mypermissions')) {
          return { status: 200, body: { permissions: {} } };
        }
        if (c.path.includes('/myself')) {
          return {
            status: 200,
            body: { groups: { items: [{ groupId: 'grp-1', name: 'product-owners' }] } }
          };
        }
        return { status: 404, body: {} };
      };
      await new PolicyRepository(storage).saveApproverPolicy({
        roleTypeId: 'DG_APPROVER',
        parties: [{ partyId: 'grp-1', partyTypeId: 'GROUP', name: 'product-owners' }],
        fromDate: '2026-11-03T00:00:00.000Z',
        setByPartyId: '712020:admin'
      });
      expect(await hasApproverPermission('DEMO-35', storage)).toBe(true);
    });

    it('grants access when user belongs to an authorized group by name', async () => {
      jira.handler = (c: JiraCall) => {
        if (c.path.includes('/mypermissions')) {
          return { status: 200, body: { permissions: {} } };
        }
        if (c.path.includes('/myself')) {
          return {
            status: 200,
            body: { groups: { items: [{ name: 'lead-architects' }] } }
          };
        }
        return { status: 404, body: {} };
      };
      await new PolicyRepository(storage).saveApproverPolicy({
        roleTypeId: 'DG_APPROVER',
        parties: [{ partyId: 'id-arch', partyTypeId: 'GROUP', name: 'lead-architects' }],
        fromDate: '2026-11-03T00:00:00.000Z',
        setByPartyId: '712020:admin'
      });
      expect(await hasApproverPermission('DEMO-35', storage)).toBe(true);
    });

    it('denies access with custom message when user is not in any designated group', async () => {
      jira.handler = (c: JiraCall) => {
        if (c.path.includes('/mypermissions')) {
          return { status: 200, body: { permissions: {} } };
        }
        if (c.path.includes('/myself')) {
          return {
            status: 200,
            body: { groups: { items: [{ groupId: 'grp-other', name: 'devs' }] } }
          };
        }
        return { status: 404, body: {} };
      };
      await new PolicyRepository(storage).saveApproverPolicy({
        roleTypeId: 'DG_APPROVER',
        parties: [{ partyId: 'grp-1', partyTypeId: 'GROUP', name: 'product-owners' }],
        fromDate: '2026-11-03T00:00:00.000Z',
        setByPartyId: '712020:admin'
      });
      expect(await hasApproverPermission('DEMO-35', storage)).toBe(false);
      await expect(checkApproverPermission('DEMO-35', storage, 'Custom denied.'))
        .rejects.toThrow('Custom denied.');
    });
  });

  describe('approverGroupNames', () => {
    it('returns empty array when no policy exists', async () => {
      expect(await approverGroupNames(storage)).toEqual([]);
    });

    it('returns sorted group names when policy exists', async () => {
      await new PolicyRepository(storage).saveApproverPolicy({
        roleTypeId: 'DG_APPROVER',
        parties: [
          { partyId: 'b', partyTypeId: 'GROUP', name: 'qa-leads' },
          { partyId: 'a', partyTypeId: 'GROUP', name: 'architects' }
        ],
        fromDate: '2026-11-03T00:00:00.000Z',
        setByPartyId: '712020:admin'
      });
      expect(await approverGroupNames(storage)).toEqual(['architects', 'qa-leads']);
    });
  });
});
