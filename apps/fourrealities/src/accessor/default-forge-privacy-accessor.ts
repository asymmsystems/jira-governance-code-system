/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the Forge personal data reporting API (scope report:personal-data, ADR-014).
 * The platform sends at most 90 accounts per call; @forge/api pages longer lists itself.
 */

import { privacy } from '@forge/api';
import { PrivacyReportAccessor } from '../contract/accessors';

export class DefaultForgePrivacyAccessor implements PrivacyReportAccessor {
  readonly serviceType = 'accessor' as const;

  report(accounts: Array<{ accountId: string; updatedAt: string }>): Promise<Array<{ accountId: string; status: string }>> {
    return privacy.reportPersonalData(accounts);
  }
}
