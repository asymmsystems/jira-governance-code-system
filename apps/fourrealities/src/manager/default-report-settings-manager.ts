/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the admin page section "Evidence reports" (ADR-015, owner decisions Q2 and Q3): the
 * retention of the reports and the evidence report groups. Every call first checks, as the user, that the
 * caller is a Jira administrator, and fails closed. The settings hold group ids and names, no account id.
 */

import { AdminResult } from '../contract/data/models';
import { RETENTION_DAYS, ReportSettingsView } from '../contract/data/reports';
import { JiraDirectoryAccessor } from '../contract/accessors';
import { ReportCryptoAccessor, ReportPolicyEngine, ReportSettingsManager, ReportStoreAccessor } from '../contract/reports';

export interface ReportSettingsManagerDeps {
  directory: JiraDirectoryAccessor;
  store: ReportStoreAccessor;
  crypto: ReportCryptoAccessor;
  policy: ReportPolicyEngine;
  now?: () => Date;
}

/** The same text as the other admin page sections (DefaultAdminManager). */
export const REPORT_NOT_ADMIN_MESSAGE =
  'FourRealities: you do not have permission to view or manage authorization settings. Contact your Jira site administrator.';

const NOT_ADMIN = { ok: false as const, code: 'NOT_ADMIN' as const, message: REPORT_NOT_ADMIN_MESSAGE };

export class DefaultReportSettingsManager implements ReportSettingsManager {
  readonly serviceType = 'manager' as const;

  constructor(private readonly d: ReportSettingsManagerDeps) {}

  async view(): Promise<AdminResult<ReportSettingsView>> {
    if (!(await this.d.directory.isJiraAdmin())) return NOT_ADMIN;
    return this.current();
  }

  async save(input: unknown): Promise<AdminResult<ReportSettingsView>> {
    if (!(await this.d.directory.isJiraAdmin())) return NOT_ADMIN;
    const checked = this.d.policy.validateSettings(input);
    if ('error' in checked) return { ok: false, code: 'INVALID_INPUT', message: checked.error };
    const named = await this.d.directory.groupNames(checked.groupIds);
    await this.d.store.saveSettings({
      schemaVersion: 1,
      retentionDays: checked.retentionDays,
      reportGroups: named.map(g => ({ partyId: g.groupId, partyTypeId: 'GROUP' as const, name: g.name })),
      fromDate: (this.d.now || (() => new Date()))().toISOString()
    });
    return this.current();
  }

  private async current(): Promise<AdminResult<ReportSettingsView>> {
    const settings = await this.d.store.getSettings();
    return {
      ok: true,
      retentionDays: settings.retentionDays,
      allowedRetentionDays: [...RETENTION_DAYS],
      policy: { parties: settings.reportGroups.map(g => ({ partyId: g.partyId, name: g.name })) },
      signingKeyId: this.d.crypto.keyId()
    };
  }
}
