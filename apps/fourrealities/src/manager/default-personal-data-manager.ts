/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the weekly personal data run (ADR-014). Reports every stored account id to
 * Atlassian, erases the accounts Atlassian reports as closed, and writes the fourrealities-exception
 * projection of each affected issue again as the app, so it no longer names the closed account.
 */

import { ExceptionProperty, PersonalDataRunResult } from '../contract/data/models';
import { ExceptionEventAccessor, JiraIssueAccessor, PersonalDataAccessor, PrivacyReportAccessor, ReworkNoteAccessor } from '../contract/accessors';
import { ExceptionPolicyEngine } from '../contract/engines';
import { PersonalDataManager } from '../contract/managers';

export interface PersonalDataManagerDeps {
  data: PersonalDataAccessor;
  privacy: PrivacyReportAccessor;
  events: ExceptionEventAccessor;
  notes: ReworkNoteAccessor;
  lifecycle: ExceptionPolicyEngine;
  /** Jira as the app: the scheduled run has no user. */
  appJira: JiraIssueAccessor;
  now?: () => Date;
}

export class DefaultPersonalDataManager implements PersonalDataManager {
  readonly serviceType = 'manager' as const;

  constructor(private readonly d: PersonalDataManagerDeps) {}

  async run(): Promise<PersonalDataRunResult> {
    const now = (this.d.now || (() => new Date()))().toISOString();
    await this.d.data.minimiseMeta();
    const accounts = await this.d.data.accounts(now);
    if (accounts.length === 0) return { reported: 0, closed: 0, propertiesRewritten: 0 };
    const updates = await this.d.privacy.report(accounts.map(a => ({ accountId: a.accountId, updatedAt: a.updatedAt })));
    const closed = new Set(updates.filter(u => u.status === 'closed').map(u => u.accountId));
    if (closed.size === 0) return { reported: accounts.length, closed: 0, propertiesRewritten: 0 };
    await this.d.data.erase(Array.from(closed));
    const issueIds = Array.from(new Set(accounts.filter(a => closed.has(a.accountId)).flatMap(a => a.issueIds)));
    let rewritten = 0;
    for (const issueId of issueIds) {
      if (await this.rewriteProperty(issueId)) rewritten++;
    }
    return { reported: accounts.length, closed: closed.size, propertiesRewritten: rewritten };
  }

  /** The projection from the erased records, written as the app; false when the write failed or there is nothing to write. */
  private async rewriteProperty(issueId: string): Promise<boolean> {
    const events = await this.d.events.list(issueId);
    const notes = await this.d.notes.list(issueId);
    const issueKey = events[0]?.issueKey || notes[0]?.issueKey;
    if (!issueKey) return false;
    const latest = notes[notes.length - 1];
    const property: ExceptionProperty = {
      schemaVersion: 3,
      issueId,
      issueKey,
      code: this.d.lifecycle.currentState(events),
      ...(latest
        ? { rework: { reason: latest.reason, ...(latest.notes ? { notes: latest.notes } : {}), recordedBy: latest.recordedBy, recordedAt: latest.recordedAt }, reworkNoteCount: notes.length }
        : {})
    };
    try {
      const status = await this.d.appJira.putExceptionProperty(issueId, property);
      return status >= 200 && status < 300;
    } catch {
      return false;
    }
  }
}
