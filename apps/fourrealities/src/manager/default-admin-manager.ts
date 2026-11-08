/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the admin page use cases (ADR-013): evidence sources, decision issue types and
 * approver groups. Every call first checks, as the user, that the caller is a Jira administrator
 * (global ADMINISTER), and fails closed (Uniform Permission Management Standard, section 2.2).
 */

import { AdminResult, AdminView, DEFAULT_DECISION_ISSUE_TYPES } from '../contract/data/models';
import { JiraDirectoryAccessor, SettingsAccessor, SiteConfigAccessor } from '../contract/accessors';
import { SourcePolicyEngine } from '../contract/engines';
import { AdminManager } from '../contract/managers';

export const MAX_APPROVER_GROUPS = 20;

export const NOT_ADMIN_MESSAGE =
  'FourRealities: you do not have permission to view or manage authorization settings. Contact your Jira site administrator.';

const NOT_ADMIN = { ok: false as const, code: 'NOT_ADMIN' as const, message: NOT_ADMIN_MESSAGE };

export interface AdminManagerDeps {
  directory: JiraDirectoryAccessor;
  settings: SettingsAccessor;
  siteConfig: SiteConfigAccessor;
  sources: SourcePolicyEngine;
  now?: () => Date;
}

export class DefaultAdminManager implements AdminManager {
  readonly serviceType = 'manager' as const;

  constructor(private readonly d: AdminManagerDeps) {}

  private now(): string {
    return (this.d.now || (() => new Date()))().toISOString();
  }

  async view(): Promise<AdminResult<AdminView>> {
    if (!(await this.d.directory.isJiraAdmin())) return NOT_ADMIN;
    return this.current();
  }

  async saveSources(payload: unknown): Promise<AdminResult<AdminView>> {
    if (!(await this.d.directory.isJiraAdmin())) return NOT_ADMIN;
    const checked = this.d.sources.validate(payload, this.now());
    if (!checked.settings) return { ok: false, code: 'INVALID_INPUT', message: String(checked.error) };
    await this.d.settings.saveSettings(checked.settings);
    return this.current();
  }

  async searchGroups(payload: unknown): Promise<AdminResult<{ groups: Array<{ groupId: string; name: string }> }>> {
    if (!(await this.d.directory.isJiraAdmin())) return NOT_ADMIN;
    const query = typeof (payload as { query?: unknown } | undefined)?.query === 'string' ? String((payload as { query: string }).query) : '';
    if (query.length > 100) return { ok: false, code: 'INVALID_INPUT', message: 'Search with at most 100 characters.' };
    const found = await this.d.directory.searchGroups(query);
    if (found.status !== 200) return { ok: false, code: 'JIRA_ERROR', message: 'FourRealities could not search groups in Jira. Try again.' };
    return { ok: true, groups: found.groups.map(g => ({ groupId: g.groupId, name: g.name })) };
  }

  async saveApprovers(payload: unknown): Promise<AdminResult<AdminView>> {
    if (!(await this.d.directory.isJiraAdmin())) return NOT_ADMIN;
    const raw = (payload as { groupIds?: unknown } | undefined)?.groupIds;
    if (!Array.isArray(raw)) return { ok: false, code: 'INVALID_INPUT', message: 'Give the approver groups as a list.' };
    const groupIds = Array.from(new Set(raw.map(id => String(id)).filter(id => id.length > 0)));
    if (groupIds.length > MAX_APPROVER_GROUPS) return { ok: false, code: 'INVALID_INPUT', message: `Choose at most ${MAX_APPROVER_GROUPS} groups.` };
    const named = await this.d.directory.groupNames(groupIds);
    // No account id is stored: the policy names groups only (ADR-014).
    await this.d.settings.saveApproverPolicy({
      roleTypeId: 'FR_APPROVER',
      parties: named.map(g => ({ partyId: g.groupId, partyTypeId: 'GROUP' as const, name: g.name })),
      fromDate: this.now()
    });
    return this.current();
  }

  private async current(): Promise<AdminResult<AdminView>> {
    const settings = await this.d.settings.getSettings();
    const detected = await this.d.settings.getDetected();
    let config;
    try {
      config = await this.d.siteConfig.get();
    } catch {
      return { ok: false, code: 'JIRA_ERROR', message: 'FourRealities could not read the site configuration from Jira. Try again.' };
    }
    const policy = await this.d.settings.getApproverPolicy();
    return {
      ok: true,
      settings,
      detected,
      sources: this.d.sources.resolve(settings, detected, config),
      devFieldId: config.devFieldId,
      policy: { parties: (policy?.parties || []).map(p => ({ partyId: p.partyId, name: p.name })) },
      defaultDecisionIssueTypes: DEFAULT_DECISION_ISSUE_TYPES
    };
  }
}
