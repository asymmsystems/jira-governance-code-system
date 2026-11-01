/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: request validation and access rules for user actions. Pure, no I/O.
 */

import { PolicyEngine } from '../contract/engines';

export class DefaultPolicyEngine implements PolicyEngine {
  readonly serviceType = 'engine' as const;

  /**
   * Issue view: the id must equal the context issue. Project page: the issue's project must
   * equal the context project (FR-06). The caller has already read the issue's project as the user.
   */
  scopeError(target: { issueId: string; issueKey?: string; projectKey?: string }, caller: { issueId?: string; projectKey?: string }): string | undefined {
    if (caller.issueId) {
      return String(caller.issueId) === String(target.issueId) ? undefined : 'Unauthorized: issue is outside this issue view.';
    }
    if (!caller.projectKey) {
      return 'Forbidden: no Jira project or issue context.';
    }
    return target.projectKey === caller.projectKey
      ? undefined
      : `Forbidden: issue ${target.issueKey || target.issueId} is not in project ${caller.projectKey}.`;
  }

  linkInputError(url: string, title: string): string | undefined {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return 'Invalid URL protocol. HTTP or HTTPS required.';
      }
    } catch {
      return 'Invalid specification URL provided.';
    }
    return title ? undefined : 'Document title or ADR identifier required.';
  }

  exceptionInputError(reason: string, notes?: string): string | undefined {
    if (!reason) {
      return 'Exception reason required.';
    }
    if (reason.length < 15 || reason.length > 500) {
      return 'Give a reason of 15 to 500 characters.';
    }
    if (notes && notes.length > 1000) {
      return 'Notes can be at most 1,000 characters.';
    }
    return undefined;
  }
}
