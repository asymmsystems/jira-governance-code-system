/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * CascadePlan: the approver policy repository.
 * Stores designated authority groups under key cascadeplan:cfg:approver_policy.
 * Adheres to the Uniform Permission Management Standard across the Jira suite.
 */

import { ApproverPolicy } from '../domain/models';
import { StorageProvider } from './plan-repository';

export const APPROVER_POLICY_KEY = 'cascadeplan:cfg:approver_policy';
export const LEGACY_APPROVER_POLICY_KEY = 'planshift:cfg:approver_policy';

export class PolicyRepository {
  constructor(private readonly storage: StorageProvider) {}

  async getApproverPolicy(): Promise<ApproverPolicy | null> {
    const val = await this.storage.get<ApproverPolicy>(APPROVER_POLICY_KEY);
    if (val) return val;
    const legacy = await this.storage.get<ApproverPolicy>(LEGACY_APPROVER_POLICY_KEY);
    return legacy || null;
  }

  async saveApproverPolicy(policy: ApproverPolicy): Promise<void> {
    await this.storage.set(APPROVER_POLICY_KEY, policy);
  }
}
