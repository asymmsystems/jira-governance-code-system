/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: helpers for second person subtasks and contributor changes (pure; B-19).
 */

import type { Contributor } from '../domain/work-effort-links';

/**
 * Finds contributors in the updated list who do not have a subtask yet.
 */
export function findNewContributors(prev: Contributor[] = [], next: Contributor[] = []): Contributor[] {
  return next.filter(n => {
    const match = prev.find(p => p.accountId === n.accountId);
    return !match || !match.subtaskKey;
  });
}

/**
 * Finds contributors removed in the updated list who have an existing Jira subtask.
 */
export function findRemovedContributorsWithSubtask(prev: Contributor[] = [], next: Contributor[] = []): Contributor[] {
  return prev.filter(p => Boolean(p.subtaskKey) && !next.some(n => n.accountId === p.accountId));
}

/**
 * Formats the summary text for a second person Jira subtask.
 */
export function formatSubtaskSummary(_parentSummary: string, contributorName: string): string {
  return `Subtask: ${contributorName || 'Contributor'}`;
}

/**
 * The hours typed in the "+ Allocate Resource" field, or undefined when the field is empty or holds
 * no positive whole number. Undefined sends no estimate: CascadePlan never writes a default (INV-03).
 */
export function enteredAllocationHours(raw: string | null | undefined): number | undefined {
  const hours = parseInt(String(raw ?? '').trim(), 10);
  return Number.isFinite(hours) && hours > 0 ? hours : undefined;
}

/**
 * The status line after "+ Allocate Resource" created the sub-task. It names the estimate only when
 * one was sent.
 */
export function allocationCreatedText(assigneeName: string, hours: number | undefined): string {
  const who = assigneeName || 'Unassigned';
  return hours === undefined
    ? `✓ Created Jira subtask for ${who}, with no estimate`
    : `✓ Created Jira subtask for ${who} (${hours}h)`;
}

/**
 * Formats the in-form prompt when removing a contributor who has an assigned Jira subtask.
 */
export function formatRemovalPrompt(contributorName: string, subtaskKey: string): string {
  return `Remove ${contributorName}? Do you want to delete or unassign Jira subtask ${subtaskKey}?`;
}
