/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: seal states and the allowed changes between them, on the Silverston Status pattern
 * (StatusType LEDGERSEAL_STATUS, StatusItem, StatusValidChange; spec v2 section 3.2, ADR-01).
 *
 * @author Fahim Farook
 */

import { Meaning } from './declaration';

export type LedgerSealStatusId = 'LS_SEALED' | 'LS_CHANGED' | 'LS_REVOKED';
export type TransitionName = 'SEAL' | 'RESEAL' | 'CHANGE' | 'REVOKE' | 'REDACT';
export type LedgerSealRoleTypeId = 'LS_APPROVER' | 'LS_REVIEWER' | 'LS_VERIFIER';

export interface StatusValidChange {
  statusId: LedgerSealStatusId | null;
  statusIdTo: LedgerSealStatusId;
  transitionName: TransitionName;
}

/** Every allowed state change. Any change not listed is refused. */
export const ALLOWED_CHANGES: readonly StatusValidChange[] = [
  { statusId: null, statusIdTo: 'LS_SEALED', transitionName: 'SEAL' },
  { statusId: 'LS_SEALED', statusIdTo: 'LS_SEALED', transitionName: 'RESEAL' },
  { statusId: 'LS_SEALED', statusIdTo: 'LS_CHANGED', transitionName: 'CHANGE' },
  { statusId: 'LS_SEALED', statusIdTo: 'LS_REVOKED', transitionName: 'REVOKE' },
  { statusId: 'LS_CHANGED', statusIdTo: 'LS_CHANGED', transitionName: 'CHANGE' },
  { statusId: 'LS_CHANGED', statusIdTo: 'LS_SEALED', transitionName: 'RESEAL' },
  { statusId: 'LS_CHANGED', statusIdTo: 'LS_REVOKED', transitionName: 'REVOKE' },
  { statusId: 'LS_REVOKED', statusIdTo: 'LS_SEALED', transitionName: 'RESEAL' }
];

/** The transition name for an allowed change, or null when the change is not allowed. */
export function canChange(from: LedgerSealStatusId | null, to: LedgerSealStatusId): TransitionName | null {
  return ALLOWED_CHANGES.find(c => c.statusId === from && c.statusIdTo === to)?.transitionName ?? null;
}

const ROLES: Record<Meaning, LedgerSealRoleTypeId> = {
  APPROVAL: 'LS_APPROVER',
  REVIEW: 'LS_REVIEWER',
  VERIFICATION: 'LS_VERIFIER'
};

/** The meaning of a signature is the role the party plays in the work effort (ADR-01 A-2). */
export function roleForMeaning(meaning: Meaning): LedgerSealRoleTypeId {
  return ROLES[meaning];
}

export function meaningForRole(role: LedgerSealRoleTypeId): Meaning {
  return (Object.keys(ROLES) as Meaning[]).find(m => ROLES[m] === role) as Meaning;
}
