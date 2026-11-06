/**
 * Jira permission checks for DefinitionGuard resolvers.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Every check runs as the user, with the issue key or id, because a project-level answer can
 * report EDIT_ISSUES for a user who lacks it on a given issue. Any failure denies (fail closed).
 */
import api, { route } from '@forge/api';
import { retryAfter } from '../jira/jira-client';

export type JiraPermissionKey = string;

export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

export const PERMISSION_CHECK_FAILED =
  'DefinitionGuard could not check your Jira permissions, so the change was not saved. Try again.';

/*
 * Each check below calls /rest/api/3/mypermissions as the user directly in its own body, in a
 * retry loop (retryAfter), not inside a closure. Atlassian's FSRT authorization check (AMS-76722)
 * recognises a permissions call only where it is made directly; a call inside a closure given to a
 * helper is invisible to it, and the asApp() work after the check is then reported as unauthorised.
 */

/** Reads the requested keys from a /mypermissions response. Any failure denies. */
async function grantedIn(res: any, keys: JiraPermissionKey[]): Promise<Record<string, boolean>> {
  if (res?.status !== 200) {
    throw new PermissionDeniedError(PERMISSION_CHECK_FAILED);
  }
  const body = await res.json();
  const granted: Record<string, boolean> = {};
  for (const key of keys) {
    granted[key] = body?.permissions?.[key]?.havePermission === true;
  }
  return granted;
}

/**
 * Returns the granted state of each requested permission on the issue, as the calling user.
 * Throws PermissionDeniedError when the check itself fails.
 */
export async function getIssuePermissions(issueKey: string, keys: JiraPermissionKey[]): Promise<Record<string, boolean>> {
  if (!issueKey || keys.length === 0) {
    throw new PermissionDeniedError(PERMISSION_CHECK_FAILED);
  }
  let res: any;
  try {
    for (let attempt = 1; ; attempt++) {
      res = await api.asUser().requestJira(route`/rest/api/3/mypermissions?issueKey=${issueKey}&permissions=${keys.join(',')}`);
      if (!(await retryAfter(res, attempt))) break;
    }
  } catch {
    throw new PermissionDeniedError(PERMISSION_CHECK_FAILED);
  }
  return grantedIn(res, keys);
}

/**
 * Project-level permissions for the calling user (settings page). Same fail-closed rules.
 */
export async function getProjectPermissions(projectKey: string, keys: JiraPermissionKey[]): Promise<Record<string, boolean>> {
  if (!projectKey || keys.length === 0) {
    throw new PermissionDeniedError(PERMISSION_CHECK_FAILED);
  }
  let res: any;
  try {
    for (let attempt = 1; ; attempt++) {
      res = await api.asUser().requestJira(route`/rest/api/3/mypermissions?projectKey=${projectKey}&permissions=${keys.join(',')}`);
      if (!(await retryAfter(res, attempt))) break;
    }
  } catch {
    throw new PermissionDeniedError(PERMISSION_CHECK_FAILED);
  }
  return grantedIn(res, keys);
}

/**
 * Project admin or Jira admin. Jira lets a Jira admin change any project's settings without the
 * Administer projects permission, so DefinitionGuard does the same (found live on PAY, 2026-11-06).
 */
export const ADMIN_KEYS: JiraPermissionKey[] = ['ADMINISTER_PROJECTS', 'ADMINISTER'];

/** Throws PermissionDeniedError unless the user has at least one of the keys on the project. */
export async function checkAnyProjectPermission(projectKey: string, keys: JiraPermissionKey[], deniedMessage: string): Promise<void> {
  const granted = await getProjectPermissions(projectKey, keys);
  if (!keys.some(k => granted[k])) {
    throw new PermissionDeniedError(deniedMessage);
  }
}

/** Throws PermissionDeniedError unless the user has at least one of the keys on the issue. */
export async function checkAnyIssuePermission(issueKey: string, keys: JiraPermissionKey[], deniedMessage: string): Promise<void> {
  const granted = await getIssuePermissions(issueKey, keys);
  if (!keys.some(k => granted[k])) {
    throw new PermissionDeniedError(deniedMessage);
  }
}

export async function checkProjectPermissions(projectKey: string, keys: JiraPermissionKey[], deniedMessage: string): Promise<void> {
  const granted = await getProjectPermissions(projectKey, keys);
  if (!keys.every(k => granted[k])) {
    throw new PermissionDeniedError(deniedMessage);
  }
}

/**
 * Throws PermissionDeniedError unless the calling user has every listed permission on the issue.
 */
export async function checkIssuePermissions(issueKey: string, keys: JiraPermissionKey[], deniedMessage?: string): Promise<void> {
  const granted = await getIssuePermissions(issueKey, keys);
  if (!keys.every(k => granted[k])) {
    throw new PermissionDeniedError(deniedMessage || 'You do not have the Jira permission for this change.');
  }
}

export const BROWSE_DENIED =
  'You need the Browse projects Jira permission on this issue to see its Definition of Done.';
export const BROWSE_CHECK_FAILED =
  'DefinitionGuard could not check that you can see this issue in Jira, so it shows nothing. Try again.';

/**
 * Throws PermissionDeniedError unless the calling user can browse the issue (Browse projects,
 * which Jira also applies with issue security). Every issue panel resolver calls this first,
 * before it reads app storage or Jira as the app. Asked by issue id, which the Forge context
 * always holds. Fails closed: an error from Jira or a missing id denies.
 */
export async function requireBrowseIssue(issueId: string): Promise<void> {
  let granted: Record<string, boolean>;
  try {
    if (!issueId) throw new Error('no issue id');
    let res: any;
    for (let attempt = 1; ; attempt++) {
      res = await api.asUser().requestJira(route`/rest/api/3/mypermissions?issueId=${issueId}&permissions=BROWSE_PROJECTS`);
      if (!(await retryAfter(res, attempt))) break;
    }
    granted = await grantedIn(res, ['BROWSE_PROJECTS']);
  } catch {
    throw new PermissionDeniedError(BROWSE_CHECK_FAILED);
  }
  if (!granted.BROWSE_PROJECTS) {
    throw new PermissionDeniedError(BROWSE_DENIED);
  }
}

export const EDIT_DENIED ='You need Edit issues permission to change this checklist.';
export const RESET_DENIED = 'Only a project admin can reset this checklist.';

/** A Jira permission key in plain words, for messages: RESOLVE_ISSUES becomes "Resolve issues". */
export function permissionLabel(key: JiraPermissionKey): string {
  const words = key.toLowerCase().split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
