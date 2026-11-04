/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: Table view data formatting and toggle logic (pure; B-26).
 */

export interface TableViewTask {
  key: string;
  summary?: string;
  issueType?: string;
  epic?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  progress?: number;
  status?: string;
  dependencies?: Array<{ predecessorKey?: string; triggerPercent?: number }>;
  dependency?: { predecessorKey?: string; triggerPercent?: number };
}

export interface TableViewRow {
  key: string;
  summary: string;
  issueType: string;
  epic: string;
  assignee: string;
  startDate: string;
  dueDate: string;
  progress: string;
  status: string;
  dependencies: string;
}

export function formatTableDate(iso?: string): string {
  if (!iso) return '-';
  const trimmed = iso.trim();
  return trimmed ? trimmed : '-';
}

export function formatTableProgress(progress?: number): string {
  if (typeof progress !== 'number' || !Number.isFinite(progress)) return '0%';
  const p = Math.max(0, Math.min(100, Math.round(progress)));
  return `${p}%`;
}

export function formatTableDependencies(task: {
  dependencies?: Array<{ predecessorKey?: string; triggerPercent?: number }>;
  dependency?: { predecessorKey?: string; triggerPercent?: number };
}): string {
  const list = task.dependencies && task.dependencies.length > 0
    ? task.dependencies
    : task.dependency
    ? [task.dependency]
    : [];
  if (list.length === 0) return '-';
  const valid = list.filter(d => Boolean(d.predecessorKey && d.predecessorKey.trim()));
  if (valid.length === 0) return '-';
  return valid
    .map(d => `${d.predecessorKey} (${d.triggerPercent !== undefined ? d.triggerPercent : 100}%)`)
    .join(', ');
}

export function buildTableViewRows(tasks: TableViewTask[]): TableViewRow[] {
  return tasks.map(t => ({
    key: t.key,
    summary: t.summary || '',
    issueType: t.issueType || 'Task',
    epic: t.epic || '-',
    assignee: t.resource || 'Unassigned',
    startDate: formatTableDate(t.startDate),
    dueDate: formatTableDate(t.endDate),
    progress: formatTableProgress(t.progress),
    status: t.status || 'To Do',
    dependencies: formatTableDependencies(t)
  }));
}

export function toggleTableView(currentView: string): 'table' | 'timeline' {
  return currentView === 'table' ? 'timeline' : 'table';
}
