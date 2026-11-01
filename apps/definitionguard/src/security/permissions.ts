/**
 * Jira permission checks for DefinitionGuard resolvers.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Every check runs as the user, with the issue key, because a project-level answer can
 * report EDIT_ISSUES for a user who lacks it on a given issue. Any failure denies (fail closed).
 */
import api, { route } from '@forge/api';

export type JiraPermissionKey = string;

export class PermissionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

export const PERMISSION_CHECK_FAILED =
  'DefinitionGuard could not check your Jira permissions, so the change was not saved. Try again.';

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
    res = await api.asUser().requestJira(route`/rest/api/3/mypermissions?issueKey=${issueKey}&permissions=${keys.join(',')}`);
  } catch {
    throw new PermissionDeniedError(PERMISSION_CHECK_FAILED);
  }
  if (res.status !== 200) {
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
 * Throws PermissionDeniedError unless the calling user has every listed permission on the issue.
 */
export async function checkIssuePermissions(issueKey: string, keys: JiraPermissionKey[], deniedMessage?: string): Promise<void> {
  const granted = await getIssuePermissions(issueKey, keys);
  if (!keys.every(k => granted[k])) {
    throw new PermissionDeniedError(deniedMessage || 'You do not have the Jira permission for this change.');
  }
}

export const EDIT_DENIED = 'You need Edit issues permission to change this checklist.';
export const RESET_DENIED = 'Only a project admin can reset this checklist.';
