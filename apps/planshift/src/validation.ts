/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: resolver payload validation (spec section 6, INV-15).
 * Every check runs before any KVS or Jira write and throws ValidationError naming the field.
 */

export class ValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface ValidationResult {
  ok: false;
  success: false;
  error: 'validation';
  field: string;
  message: string;
}

const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACCOUNT_ID = /^[A-Za-z0-9:_-]{1,128}$/;
const MAX_TEXT = 255;
const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];
const MILESTONE_TYPES = ['GATE', 'RELEASE', 'TARGET'];
export const COLUMN_KEYS = ['epic', 'story', 'task', 'resource', 'effort', 'progress', 'target', 'status'];
const HIDEABLE_COLUMNS = COLUMN_KEYS.filter(k => k !== 'task');

function fail(field: string, message: string): never {
  throw new ValidationError(field, message);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function text(field: string, v: unknown, max = MAX_TEXT): void {
  if (typeof v !== 'string' || v.length > max) fail(field, `${field} must be text of at most ${max} characters`);
}

function numberIn(field: string, v: unknown, min: number, max: number): void {
  if (typeof v !== 'number' || isNaN(v) || v < min || v > max) fail(field, `${field} must be a number from ${min} to ${max}`);
}

function isoDate(field: string, v: unknown): void {
  if (typeof v !== 'string' || !ISO_DATE.test(v)) fail(field, `${field} must be a date in YYYY-MM-DD form`);
  const d = new Date(`${v}T00:00:00Z`);
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) fail(field, `${field} is not a real calendar date`);
}

/**
 * Throws unless the value is a Jira issue key such as TEST-12.
 */
export function assertIssueKey(key: unknown, field: string): asserts key is string {
  if (typeof key !== 'string' || key.length > 50 || !ISSUE_KEY.test(key)) fail(field, `${field} must be a Jira issue key`);
}

export function validateDependencyPayload(dep: { predecessorKey: string; triggerPercent: number }): void {
  if (!isObject(dep)) fail('dependency', 'dependency must be an object');
  assertIssueKey(dep.predecessorKey, 'dependency.predecessorKey');
  numberIn('dependency.triggerPercent', dep.triggerPercent, 0, 100);
}

/**
 * Checks the type and size of every field that updateWbsTask allows.
 */
export function validateTaskUpdates(updates: Record<string, unknown>): void {
  if (!isObject(updates)) fail('updates', 'updates must be an object');
  const u = updates;
  for (const f of ['summary', 'epic', 'story', 'resource']) if (u[f] !== undefined) text(f, u[f]);
  if (u.epicKey !== undefined && u.epicKey !== '') assertIssueKey(u.epicKey, 'epicKey');
  if (u.resourceAccountId !== undefined && (typeof u.resourceAccountId !== 'string' || !ACCOUNT_ID.test(u.resourceAccountId))) {
    fail('resourceAccountId', 'resourceAccountId must be a Jira account id');
  }
  if (u.contributingResources !== undefined) {
    const c = u.contributingResources;
    if (!Array.isArray(c) || c.length > 20) fail('contributingResources', 'contributingResources must be a list of at most 20 names');
    c.forEach(n => text('contributingResources', n));
  }
  if (u.contributors !== undefined) {
    const c = u.contributors;
    if (!Array.isArray(c) || c.length > 20) fail('contributors', 'contributors must be a list of at most 20 people');
    c.forEach(p => {
      if (!isObject(p) || typeof p.accountId !== 'string' || !ACCOUNT_ID.test(p.accountId)) fail('contributors', 'each contributor needs a Jira account id');
    });
  }
  if (u.effortHours !== undefined) numberIn('effortHours', u.effortHours, 0, 10000);
  // Progress values outside 0 to 100 are clamped by the resolver; only the type is checked here.
  if (u.progress !== undefined) numberIn('progress', u.progress, -Infinity, Infinity);
  if (u.targetProgress !== undefined) numberIn('targetProgress', u.targetProgress, -Infinity, Infinity);
  if (u.manualProgress !== undefined && typeof u.manualProgress !== 'boolean') fail('manualProgress', 'manualProgress must be true or false');
  if (u.status !== undefined && !STATUSES.includes(u.status as string)) fail('status', 'status is not a known status');
  if (u.startDate !== undefined) isoDate('startDate', u.startDate);
  if (u.endDate !== undefined) isoDate('endDate', u.endDate);
  for (const f of ['startWeek', 'endWeek']) if (u[f] !== undefined) text(f, u[f], 10);
  if (u.spanWeeks !== undefined && (!Number.isInteger(u.spanWeeks) || (u.spanWeeks as number) < 1 || (u.spanWeeks as number) > 104)) {
    fail('spanWeeks', 'spanWeeks must be a whole number from 1 to 104');
  }
  if (u.weeklyAllocations !== undefined) {
    const w = u.weeklyAllocations;
    if (!isObject(w) || Object.keys(w).length > 104) fail('weeklyAllocations', 'weeklyAllocations must map at most 104 weeks to percents');
    Object.entries(w).forEach(([k, v]) => { text('weeklyAllocations', k, 10); numberIn('weeklyAllocations', v, 0, 100); });
  }
  if (u.subtasks !== undefined) {
    const s = u.subtasks;
    if (!Array.isArray(s) || s.length > 50) fail('subtasks', 'subtasks must be a list of at most 50 items');
    s.forEach(item => {
      if (!isObject(item)) fail('subtasks', 'each subtask must be an object');
      if (item.summary !== undefined) text('subtasks', item.summary);
    });
  }
  if (u.dependency !== undefined && u.dependency !== null) {
    if (!isObject(u.dependency)) fail('dependency', 'dependency must be an object or null');
    // An object with no predecessor clears the dependency.
    if (u.dependency.predecessorKey !== undefined && u.dependency.predecessorKey !== '') {
      assertIssueKey(u.dependency.predecessorKey, 'dependency.predecessorKey');
      // A link needs its trigger; there is no silent default (B-11).
      numberIn('dependency.triggerPercent', u.dependency.triggerPercent, 0, 100);
    }
  }
  if (u.effortConfig !== undefined && !isObject(u.effortConfig)) fail('effortConfig', 'effortConfig must be an object');
}

export function validateColumnWidths(widths: Record<string, unknown>): void {
  if (!isObject(widths)) fail('columnWidths', 'columnWidths must be an object');
  for (const [k, v] of Object.entries(widths)) {
    if (!COLUMN_KEYS.includes(k)) fail('columnWidths', `unknown column ${k}`);
    if (!Number.isInteger(v) || (v as number) < 40 || (v as number) > 800) fail('columnWidths', 'column widths must be whole numbers from 40 to 800');
  }
}

export function validateHiddenColumns(cols: unknown): void {
  if (cols === undefined) return;
  if (!Array.isArray(cols) || cols.some(c => !HIDEABLE_COLUMNS.includes(c))) fail('hiddenColumns', 'hiddenColumns must list hideable column keys');
}

export function validateMilestone(m: Record<string, unknown>): void {
  if (!isObject(m)) fail('milestone', 'milestone must be an object');
  text('milestone.id', m.id, 64);
  if ((m.id as string).length === 0) fail('milestone.id', 'milestone.id must not be empty');
  text('milestone.title', m.title);
  isoDate('milestone.date', m.date);
  text('milestone.weekKey', m.weekKey, 10);
  if (!MILESTONE_TYPES.includes(m.type as string)) fail('milestone.type', 'milestone.type is not a known type');
}

/**
 * Maps a ValidationError to the resolver result shape; other errors give undefined.
 */
export function toValidationResult(err: unknown): ValidationResult | undefined {
  if (err instanceof ValidationError) return { ok: false, success: false, error: 'validation', field: err.field, message: err.message };
  return undefined;
}
