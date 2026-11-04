/**
 * Tests for CascadePlan PolicyRepository.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */

import { MemStorage } from '../helpers/mem-storage';
import {
  PolicyRepository,
  APPROVER_POLICY_KEY,
  LEGACY_APPROVER_POLICY_KEY
} from '../../src/storage/policy-repository';
import { ApproverPolicy } from '../../src/domain/models';

describe('PolicyRepository', () => {
  let storage: MemStorage;
  let repo: PolicyRepository;

  beforeEach(() => {
    storage = new MemStorage();
    repo = new PolicyRepository(storage);
  });

  it('returns null when no policy is stored', async () => {
    const policy = await repo.getApproverPolicy();
    expect(policy).toBeNull();
  });

  it('saves and retrieves approver policy under cascadeplan:cfg:approver_policy', async () => {
    const policy: ApproverPolicy = {
      roleTypeId: 'CP_APPROVER',
      parties: [
        { partyId: 'group-1', partyTypeId: 'GROUP', name: 'delivery-leads' },
        { partyId: 'group-2', partyTypeId: 'GROUP', name: 'pmo-directors' }
      ],
      fromDate: '2026-11-03T12:00:00.000Z',
      setByPartyId: '712020:admin'
    };

    await repo.saveApproverPolicy(policy);
    const retrieved = await repo.getApproverPolicy();

    expect(retrieved).toEqual(policy);
    expect(storage.store.get(APPROVER_POLICY_KEY)).toEqual(policy);
    expect(APPROVER_POLICY_KEY).toBe('cascadeplan:cfg:approver_policy');
  });

  it('falls back to legacy planshift:cfg:approver_policy when new key is not set', async () => {
    const legacyPolicy: ApproverPolicy = {
      roleTypeId: 'PS_APPROVER',
      parties: [{ partyId: 'legacy-g', partyTypeId: 'GROUP', name: 'legacy-leads' }],
      fromDate: '2026-11-01T00:00:00.000Z',
      setByPartyId: '712020:legacy-admin'
    };

    await storage.set(LEGACY_APPROVER_POLICY_KEY, legacyPolicy);
    const retrieved = await repo.getApproverPolicy();

    expect(retrieved).toEqual(legacyPolicy);
  });
});
