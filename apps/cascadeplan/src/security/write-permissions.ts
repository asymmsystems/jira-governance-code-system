/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * BL-2, INV-16: every write is checked against the user's own Jira permissions before any KVS or
 * Jira write. One bulk call (POST /rest/api/3/permissions/check, as the user) answers for many
 * issues. The answer lists only the issue ids the user holds a permission for, so an id missing
 * from the answer is denied. Any error in the check refuses the write (fail closed).
 */
import api, { route } from '@forge/api';

export type IssuePermission = 'EDIT_ISSUES' | 'SCHEDULE_ISSUES' | 'LINK_ISSUES' | 'CREATE_ISSUES' | 'MOVE_ISSUES' | 'BROWSE_PROJECTS';

/** For each permission, the issue ids the user holds it for. */
export type PermissionChecker = (issueIds: string[], permissions: IssuePermission[]) => Promise<Map<IssuePermission, Set<string>>>;

export class PermissionCheckError extends Error {
  constructor() {
    super('CascadePlan could not check your Jira permissions, so nothing was changed. Try again.');
    this.name = 'PermissionCheckError';
  }
}

const MAX_ISSUES_PER_CHECK = 1000;

/** The real check: Jira's bulk permission check, as the user. */
export const jiraPermissionChecker: PermissionChecker = async (issueIds, permissions) => {
  const out = new Map<IssuePermission, Set<string>>(permissions.map(p => [p, new Set<string>()]));
  const ids = [...new Set(issueIds.filter(id => /^\d+$/.test(id)))];
  for (let i = 0; i < ids.length; i += MAX_ISSUES_PER_CHECK) {
    const chunk = ids.slice(i, i + MAX_ISSUES_PER_CHECK);
    let res: any;
    try {
      res = await api.asUser().requestJira(route`/rest/api/3/permissions/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectPermissions: [{ permissions, issues: chunk.map(Number) }] })
      });
    } catch {
      throw new PermissionCheckError();
    }
    if (!res || res.status !== 200) throw new PermissionCheckError();
    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new PermissionCheckError();
    }
    for (const granted of data?.projectPermissions || []) {
      const set = out.get(granted?.permission);
      if (!set) continue;
      for (const id of granted?.issues || []) set.add(String(id));
    }
  }
  return out;
};

let checker: PermissionChecker = jiraPermissionChecker;

/** Tests install a fake checker; with no argument the real Jira check is restored. */
export function setPermissionCheckerForTests(fake?: PermissionChecker): void {
  checker = fake || jiraPermissionChecker;
}

/** A checker that grants everything: for tests that do not exercise permissions. */
export const allowAllPermissions: PermissionChecker = async (issueIds, permissions) =>
  new Map(permissions.map(p => [p, new Set(issueIds)]));

/**
 * The issues (by key) for which the user lacks any of the permissions, with the missing ones.
 * An issue without a numeric id cannot be checked by Jira, so the real checker denies it.
 */
export async function deniedIssues(
  issues: Array<{ key: string; id?: string }>, permissions: IssuePermission[]
): Promise<Array<{ key: string; missing: IssuePermission[] }>> {
  if (issues.length === 0 || permissions.length === 0) return [];
  // The real checker answers only for numeric issue ids; anything else is never granted (fail closed).
  const ref = (i: { key: string; id?: string }) => String(i.id || i.key);
  const granted = await checker(issues.map(ref), permissions);
  const denied: Array<{ key: string; missing: IssuePermission[] }> = [];
  for (const issue of issues) {
    const missing = permissions.filter(p => !granted.get(p)?.has(ref(issue)));
    if (missing.length) denied.push({ key: issue.key, missing });
  }
  return denied;
}

const PERMISSION_NAMES: Record<IssuePermission, string> = {
  EDIT_ISSUES: 'Edit issues',
  SCHEDULE_ISSUES: 'Schedule issues',
  LINK_ISSUES: 'Link issues',
  CREATE_ISSUES: 'Create issues',
  MOVE_ISSUES: 'Move issues',
  BROWSE_PROJECTS: 'Browse projects'
};

/** Plain text naming the Jira permissions a user lacks. */
export function describeMissing(missing: IssuePermission[]): string {
  return missing.map(p => PERMISSION_NAMES[p]).join(', ');
}

/** The result of a refused write: nothing was written. */
export function forbiddenResult(message: string): any {
  return { ok: false, success: false, error: 'forbidden', message, jiraSync: { ok: true, writes: [] } };
}

/** A write the user's Jira permissions do not allow. withValidation turns it into forbiddenResult. */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** Throws ForbiddenError unless the user holds every permission on every issue. */
export async function requireIssuePermissions(issues: Array<{ key: string; id?: string }>, permissions: IssuePermission[]): Promise<void> {
  const denied = await deniedIssues(issues, permissions);
  if (denied.length) {
    throw new ForbiddenError(`You cannot change ${denied.map(d => d.key).join(', ')}: your Jira role lacks ${describeMissing(denied[0].missing)}.`);
  }
}
