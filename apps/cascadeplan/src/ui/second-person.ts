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
 * Formats the in-form prompt when removing a contributor who has an assigned Jira subtask.
 */
export function formatRemovalPrompt(contributorName: string, subtaskKey: string): string {
  return `Remove ${contributorName}? Do you want to delete or unassign Jira subtask ${subtaskKey}?`;
}
