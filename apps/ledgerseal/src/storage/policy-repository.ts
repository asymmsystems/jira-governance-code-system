/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: the approver policy, stored as the LS_APPROVER party role (spec v2 sections 6 and 7.1).
 *
 * @author Fahim Farook
 */

import { ApproverPolicy } from '../domain/models';
import { StorageProvider } from './seal-repository';

export const APPROVER_ROLE_KEY = 'ls3:partyrole:LS_APPROVER';

export class PolicyRepository {
  constructor(private readonly storage: StorageProvider) {}

  async getApproverPolicy(): Promise<ApproverPolicy | null> {
    return (await this.storage.get(APPROVER_ROLE_KEY)) || null;
  }

  async saveApproverPolicy(policy: ApproverPolicy): Promise<void> {
    await this.storage.set(APPROVER_ROLE_KEY, policy);
  }
}
