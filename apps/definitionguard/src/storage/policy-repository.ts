/**
 * DefinitionGuard approver policy repository.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Stores the designated authority groups under key dg:cfg:approver_policy.
 * Adheres to the Uniform Permission Management Standard.
 */
import { ApproverPolicy } from '../domain/models';
import { StorageProvider } from './checklist-repository';

export const APPROVER_POLICY_KEY = 'dg:cfg:approver_policy';

export class PolicyRepository {
  constructor(private readonly storage: StorageProvider) {}

  /** Reads the approver policy from storage. Returns null when not found. */
  async getApproverPolicy(): Promise<ApproverPolicy | null> {
    const raw = await this.storage.get(APPROVER_POLICY_KEY);
    if (!raw || typeof raw !== 'object') return null;
    return raw as ApproverPolicy;
  }

  /** Saves the approver policy in storage. */
  async saveApproverPolicy(policy: ApproverPolicy): Promise<void> {
    await this.storage.set(APPROVER_POLICY_KEY, policy);
  }
}
