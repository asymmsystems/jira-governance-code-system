/**
 * RoleType ids and how a party holds them through Jira (spec v3 section 6).
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Roles are not stored as PartyRole rows. Jira is the system of record: ASSIGNEE is the
 * current Jira assignee; JIRA_PERM_<KEY> and PROJECT_ADMIN are Jira permissions on the issue.
 */
import { RoleTypeId } from './models';

export const DEFAULT_WAIVER_ROLE: RoleTypeId = 'PROJECT_ADMIN';

/** The Jira permission key that grants a permission-based role. */
export function permissionKeyOf(role: RoleTypeId): string {
  if (role === 'PROJECT_ADMIN') return 'ADMINISTER_PROJECTS';
  if (role.startsWith('JIRA_PERM_')) return role.slice('JIRA_PERM_'.length);
  throw new Error(`DefinitionGuard: role ${role} is not granted by a Jira permission`);
}

/** The role that a Jira permission key grants. */
export function roleOfPermission(key: string): RoleTypeId {
  return key === 'ADMINISTER_PROJECTS' ? 'PROJECT_ADMIN' : `JIRA_PERM_${key}`;
}
