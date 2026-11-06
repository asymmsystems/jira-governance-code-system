/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: progress and Jira status (pure; owner decision 2026-11-06, INV-03).
 *
 * The state of a work item comes only from its Jira status category. Progress measures how far an
 * item in progress has got. A progress edit never changes the status by itself: when the new
 * progress and the status disagree, the planner offers the matching status change in the same
 * action, and the user chooses.
 */

export type PlanStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

/** One progress edit: the item, its current status, the new progress, and a status the user already chose in the same action. */
export interface ProgressEdit {
  key: string;
  status?: string;
  progress: number;
  chosenStatus?: string;
}

/** A status change the planner offers for one item. */
export interface StatusOffer {
  key: string;
  from: PlanStatus;
  to: 'IN_PROGRESS' | 'COMPLETED';
}

/** The question shown to the user, with the two button labels. */
export interface OfferPrompt {
  question: string;
  lines: string[];
  move: string;
  keep: string;
}

const LABEL: Record<PlanStatus, string> = { NOT_STARTED: 'To Do', IN_PROGRESS: 'In Progress', COMPLETED: 'Done' };

function planStatus(status?: string): PlanStatus {
  return status === 'COMPLETED' || status === 'IN_PROGRESS' ? status : 'NOT_STARTED';
}

/** The Jira status category name of a planner status. */
export function statusLabel(status?: string): string {
  return LABEL[planStatus(status)];
}

/** True when the item is Done in Jira. */
export function isDone(status?: string): boolean {
  return status === 'COMPLETED';
}

/**
 * The status changes to offer for a set of progress edits.
 * - 100% on an item that is not Done: offer Done.
 * - Above 0% on a To Do item: offer In Progress.
 * - 0%, a Done item, or an edit whose status the user already chose: nothing.
 */
export function statusOffers(edits: ProgressEdit[]): StatusOffer[] {
  const out: StatusOffer[] = [];
  for (const e of edits) {
    if (e.chosenStatus !== undefined) continue;
    const from = planStatus(e.status);
    if (from === 'COMPLETED') continue;
    const p = Number(e.progress);
    if (!Number.isFinite(p) || p <= 0) continue;
    if (p >= 100) out.push({ key: e.key, from, to: 'COMPLETED' });
    else if (from === 'NOT_STARTED') out.push({ key: e.key, from, to: 'IN_PROGRESS' });
  }
  return out;
}

/** The text of the question for the offers: one item names it; several are listed. */
export function offerPrompt(offers: StatusOffer[]): OfferPrompt | null {
  if (!offers.length) return null;
  if (offers.length === 1) {
    const o = offers[0];
    return {
      question: `${o.key} is ${LABEL[o.from]} in Jira. Also move it to ${LABEL[o.to]}?`,
      lines: [],
      move: `Move to ${LABEL[o.to]}`,
      keep: `Keep ${LABEL[o.from]}`
    };
  }
  return {
    question: `The new progress does not match the Jira status of ${offers.length} work items. Also change their status in Jira?`,
    lines: offers.map(o => `${o.key}: ${LABEL[o.from]} to ${LABEL[o.to]}`),
    move: 'Change the statuses',
    keep: 'Keep the statuses'
  };
}

/** Why the progress of an item cannot be edited, or null when it can. */
export function progressLockReason(t: { key: string; status?: string }): string | null {
  return isDone(t.status) ? `${t.key} is Done in Jira, so its progress is 100%. Change its status to reopen it.` : null;
}

/** The progress as text, with a note when 100% disagrees with the Jira status. */
export function progressText(t: { progress?: number; status?: string }): string {
  const p = Math.max(0, Math.min(100, Math.round(Number(t.progress) || 0)));
  return p === 100 && !isDone(t.status) ? '100%, not Done in Jira' : `${p}%`;
}

/** The progress shown for an item: Done is always 100%; otherwise the manual value when set, else the measured one. */
export function shownProgress(status: string | undefined, manual: number | undefined, measured: number): number {
  if (isDone(status)) return 100;
  return manual !== undefined ? manual : measured;
}
