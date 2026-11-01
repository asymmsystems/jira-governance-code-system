/**
 * StatusType DOD_CRITERION_STATUS: its StatusItems and the StatusValidChange table (spec v3 section 5).
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { DodStatusId, TransitionName } from './models';

export interface StatusValidChange {
  statusId: DodStatusId;
  statusIdTo: DodStatusId;
  transitionName: TransitionName;
}

export const STATUS_ITEMS: Record<DodStatusId, { sequenceId: string; description: string }> = {
  DOD_OPEN: { sequenceId: '01', description: 'Open' },
  DOD_DONE: { sequenceId: '02', description: 'Done' },
  DOD_WAIVED: { sequenceId: '03', description: 'Waived' }
};

export const STATUS_VALID_CHANGES: StatusValidChange[] = [
  { statusId: 'DOD_OPEN', statusIdTo: 'DOD_DONE', transitionName: 'Complete' },
  { statusId: 'DOD_OPEN', statusIdTo: 'DOD_WAIVED', transitionName: 'Waive' },
  { statusId: 'DOD_DONE', statusIdTo: 'DOD_OPEN', transitionName: 'Reopen' },
  { statusId: 'DOD_WAIVED', statusIdTo: 'DOD_OPEN', transitionName: 'Reopen' },
  { statusId: 'DOD_DONE', statusIdTo: 'DOD_OPEN', transitionName: 'Reset' },
  { statusId: 'DOD_WAIVED', statusIdTo: 'DOD_OPEN', transitionName: 'Reset' },
  // Resync re-opens a criterion whose definition changed (B-16).
  { statusId: 'DOD_DONE', statusIdTo: 'DOD_OPEN', transitionName: 'Resync' },
  { statusId: 'DOD_WAIVED', statusIdTo: 'DOD_OPEN', transitionName: 'Resync' }
];

export function isValidChange(from: DodStatusId, to: DodStatusId, transitionName: TransitionName): boolean {
  return STATUS_VALID_CHANGES.some(c => c.statusId === from && c.statusIdTo === to && c.transitionName === transitionName);
}

/** The message for a refused change, before anything is written. */
export function invalidChangeMessage(from: DodStatusId, transitionName: TransitionName): string {
  if (transitionName === 'Complete') return from === 'DOD_DONE' ? 'This item is already done.' : 'A waived item must be reopened before it can be completed.';
  if (transitionName === 'Waive') return 'Only an open item can be waived.';
  return 'This item is already open.';
}
