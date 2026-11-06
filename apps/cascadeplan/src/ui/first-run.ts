/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: first run without setup (pure; B-25). An empty plan shows one primary action, and a
 * one-time hint shows how to make the first percent-trigger link.
 */

interface PlanLike { tasks?: Array<{ key: string; startDate?: string; dependency?: { predecessorKey?: string } | null }>; backlogTasks?: Array<{ key: string }>; jqlFilter?: string }

export interface EmptyState { title: string; text: string; action: { id: 'schedule' | 'create'; label: string } }

/** The empty state for a plan with nothing scheduled, or null when the timeline has tasks. */
export function emptyState(plan: PlanLike | null): EmptyState | null {
  if (!plan || (plan.tasks && plan.tasks.length > 0)) return null;
  const waiting = (plan.backlogTasks || []).length;
  if (waiting > 0) {
    return {
      title: 'Nothing is scheduled yet',
      text: `${waiting === 1 ? '1 issue is' : `${waiting} issues are`} waiting in the backlog. Drag issues onto the timeline to plan them.`,
      action: { id: 'schedule', label: 'Schedule your first issues' }
    };
  }
  // With a plan filter, an empty plan means that no work item matches the filter (F-27).
  if (plan.jqlFilter) {
    return { title: 'No work items match this plan\'s filter', text: `The filter is: ${plan.jqlFilter}. A plan approver can change or clear it in the plan list.`, action: { id: 'create', label: 'Create an issue' } };
  }
  return { title: 'This project has no issues yet', text: 'Create an issue to start the plan. It is created in Jira.', action: { id: 'create', label: 'Create an issue' } };
}

/** The first-link hint: two scheduled tasks, no link yet, and the user has not linked or dismissed it. */
export function showLinkHint(plan: PlanLike | null, stored: string | null): boolean {
  if (!plan || stored === 'done') return false;
  const scheduled = (plan.tasks || []).filter(t => t.startDate);
  return scheduled.length >= 2 && !scheduled.some(t => t.dependency && t.dependency.predecessorKey);
}
