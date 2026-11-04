/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the old and new value of each Jira field a write sends, in words a user reads.
 * Shown in the Changes panel next to the result of the write (B-23).
 */

export interface JiraFieldChange {
  field: string;
  from: string | null;
  to: string | null;
}

export interface ChangeValues {
  summary?: string;
  endDate?: string;
  /** Due date as Jira holds it; the old value of a due date write. */
  jiraDueDate?: string;
  effortHours?: number;
  epicKey?: string;
  resource?: string;
  resourceAccountId?: string;
  status?: string;
}

const hours = (h?: number) => (typeof h === 'number' && h > 0 ? `${h}h` : null);
const text = (v?: string) => (v && v.trim() ? v.trim() : null);
const person = (name?: string) => (name && name !== 'Unassigned' ? name : null);

/** One entry per field sent to Jira, in the order sent. */
export function describeJiraChanges(sent: string[], before: ChangeValues, after: ChangeValues): JiraFieldChange[] {
  return sent.map(field => {
    switch (field) {
      case 'summary':
        return { field, from: text(before.summary), to: text(after.summary) };
      case 'duedate':
        return { field: 'due date', from: text(before.jiraDueDate), to: after.endDate ? after.endDate.slice(0, 10) : null };
      case 'timetracking':
        return { field: 'estimate', from: hours(before.effortHours), to: hours(after.effortHours) };
      case 'parent':
        return { field: 'epic', from: text(before.epicKey), to: text(after.epicKey) };
      case 'assignee':
        return { field: 'assignee', from: person(before.resource),
          to: after.resourceAccountId === 'unassigned' ? null : person(after.resource) || text(after.resourceAccountId) };
      case 'status':
        return { field, from: text(before.status), to: text(after.status) };
      default:
        return { field, from: null, to: null };
    }
  });
}
