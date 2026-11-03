/**
 * Tests for DefinitionGuard PolicyRepository.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { CountingStorage } from '../helpers/forge-mocks';
import { PolicyRepository, APPROVER_POLICY_KEY } from '../../src/storage/policy-repository';
import { ApproverPolicy } from '../../src/domain/models';

describe('PolicyRepository', () => {
  let storage: CountingStorage;
  let repo: PolicyRepository;

  beforeEach(() => {
    storage = new CountingStorage();
    repo = new PolicyRepository(storage);
  });

  it('returns null when no policy is stored', async () => {
    const policy = await repo.getApproverPolicy();
    expect(policy).toBeNull();
  });

  it('returns null when stored value is not an object', async () => {
    storage.put(APPROVER_POLICY_KEY, 'not-an-object');
    expect(await repo.getApproverPolicy()).toBeNull();
  });

  it('saves and retrieves the approver policy', async () => {
    const policy: ApproverPolicy = {
      roleTypeId: 'DG_APPROVER',
      parties: [
        { partyId: 'group-1', partyTypeId: 'GROUP', name: 'product-owners' },
        { partyId: 'group-2', partyTypeId: 'GROUP', name: 'lead-architects' }
      ],
      fromDate: '2026-11-03T00:00:00.000Z',
      setByPartyId: '712020:admin'
    };

    await repo.saveApproverPolicy(policy);
    expect(storage.sets).toContain(APPROVER_POLICY_KEY);

    const loaded = await repo.getApproverPolicy();
    expect(loaded).toEqual(policy);
  });
});
