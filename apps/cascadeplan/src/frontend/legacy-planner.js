/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: planner UI logic, moved out of the inline script in index.html (B-01).
 * Parts are replaced by the canvas timeline and the pure modules in later items.
 */

import { callResolver as rawCallResolver, openIssueInNewTab, getProjectScope } from './bridge';
import { MAIN_PLAN_ID, getSavedPlanId, setSavedPlanId, chooseActivePlan, parentKeysOf, visibleRows } from '../ui/plan-view-state';
import { showFlag } from './flag';
import { logFailure } from '../logger';
import { classifyResult } from '../ui/result';
import { UndoStack } from '../ui/undo-stack';
import { snapshotPlan, buildUndoEntry, actionLabel, withWrittenStatuses } from '../ui/undo-plan';
import { initErrorBanner, showErrorBanner } from './banner';
import { enableTheme, onThemeChange } from './theme';
import { openWhyPopup, closeWhyPopup, isWhyPopupOpen, initWhyPopup } from './why-popup';
import { initChangesPanel, isChangesPanelOpen, closeChangesPanel } from './changes-panel';
import { initBaselinePanel, closeBaselinePanel, isBaselinePanelOpen, statusText as baselineStatusText } from './baseline-panel';
import { describePendingWrites } from '../ui/change-log';
import { html } from '../ui/safe-html';
import { CanvasTimeline, ROW_H, BAR_H } from './canvas-timeline';
import {
  clampTriggerPercent,
  dependencyPopoverTitle,
  computeDependencyPreview,
  checkDependencyConflict,
  clampToEarliestStart,
  suggestTriggerToFit,
  buildDraggedDependencyLink,
  swapDependencyDirection,
  isEnforceDepsActive
} from '../ui/dependency-edit';
import {
  DEFAULT_COLUMN_WIDTHS,
  COMPACT_TASK_DEFAULT_WIDTH,
  sanitizeLoadedColumnWidths,
  clampColumnResize,
  computeFrozenLayout
} from '../ui/column-layout';
import { barRect, daysBetween, visibleRange, handleOffsets, portOffsets, nearestArrow, snapDays, shiftDates, xForDate } from '../ui/timeline-geometry';
import { GRID_COLUMNS, navigate, rowCells, rowLevel, moveKey, moveAnnouncement } from '../ui/keyboard-grid';
import { weeklyHours } from '../ui/weekly-hours';
import { emptyState, showLinkHint } from '../ui/first-run';
import { applyDynamicStyles } from './dynamic-style';
import { toggleKey, rangeKeys, moveSelectionBy, selectedBlockParents, progressFromDigit } from '../ui/selection';
import { addDays as addDaysIso } from '../domain/schedule-engine';
import { planBlockMove } from '../domain/block-move';
import { previewSingleMove, previewBlockMove } from '../domain/drop-plan';
import { baselineItems, compareItems } from '../domain/baseline';
import { shouldAutoCompact, ZOOMS, zoomById, zoomStep, mondayOf, initialRange, rangeDays, extendRange, edgeToExtend, headerCells, gridLines, anchorScroll, dateAt } from '../ui/time-scale';
import { buildTableViewRows, toggleTableView } from '../ui/table-view';
import { findMatchingTasks, findNextMatch, formatMatchCount, isSearchShortcut } from '../ui/in-app-search';
import { formatRemovalPrompt, enteredAllocationHours, allocationCreatedText } from '../ui/second-person';
import { statusOffers, offerPrompt, progressLockReason, progressText, isDone } from '../ui/progress-status';
import {
  categorizePlan,
  suggestCloneName,
  validateNewPlanName,
  buildPlanListViewModel,
  filterPlans
} from '../ui/plan-manager';

const optimisticTasks = new Map();

function registerOptimisticTask(task) {
  if (!task || !task.key) return;
  optimisticTasks.set(task.key, { task, timestamp: Date.now() });
}

function mergeOptimisticTasks(plan) {
  if (!plan || !Array.isArray(plan.tasks)) return;
  const now = Date.now();
  for (const [key, entry] of optimisticTasks.entries()) {
    if (now - entry.timestamp > 60000) {
      optimisticTasks.delete(key);
      continue;
    }
    const exists = plan.tasks.some(t => t.key === key);
    if (!exists) {
      plan.tasks.push(entry.task);
    } else {
      optimisticTasks.delete(key);
    }
  }
}

function getJiraBaseUrl() {
  if (currentPlan && currentPlan.siteUrl) {
    return currentPlan.siteUrl.replace(/\/+$/, '');
  }
  try {
    if (window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
      const orig = window.location.ancestorOrigins[0];
      if (orig && orig.includes('atlassian.net')) return orig.replace(/\/+$/, '');
    }
    if (document.referrer) {
      const refOrig = new URL(document.referrer).origin;
      if (refOrig && refOrig.includes('atlassian.net')) return refOrig.replace(/\/+$/, '');
    }
  } catch (e) {}
  return 'https://asymmsystems.atlassian.net';
}

function openJiraIssueInNewTab(issueKey, event) {
  if (event) {
    event.stopPropagation();
  }
  if (!issueKey) return;

  try {
    openIssueInNewTab(issueKey);
    if (event) event.preventDefault();
    return;
  } catch (err) {
    logFailure('router.open failed, using window.open', err);
  }

  const baseUrl = getJiraBaseUrl();
  const fullUrl = `${baseUrl}/browse/${issueKey}`;
  if (!event || !event.target || (event.target.tagName !== 'A' && !event.target.closest('a'))) {
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
  }
}

// Undo (B-14): every undoable write is recorded with its inverse when the next plan arrives.
const UNDOABLE = new Set(['updateWbsTask', 'unscheduleTask', 'scheduleBacklogTask', 'batchUpdateTasks', 'moveTaskGroup']);
const undoStack = new UndoStack(20);
let pendingUndo = null;
let replayingUndo = false;

let activePlanId = MAIN_PLAN_ID;
// Browser-storage scope of the open project; set from the Forge context, else from the first plan load.
let planScope;

function browserStore() {
  try { return window.localStorage; } catch (e) { return undefined; }
}

/**
 * Makes a plan the active one and remembers it for this project, so a refresh reopens it.
 * Another plan's undo history does not apply here, so it is dropped on a switch.
 */
function setActivePlan(planId) {
  const next = planId || MAIN_PLAN_ID;
  if (next !== activePlanId) {
    undoStack.clear();
    pendingUndo = null;
  }
  activePlanId = next;
  setSavedPlanId(browserStore(), planScope, activePlanId);
}

// opts.before: a snapshot taken before an optimistic change on screen, so Undo restores the dates the
// user saw before the action, not the optimistic ones (F-04).
async function callResolver(fn, payload = {}, opts = {}) {
  const mergedPayload = { planId: activePlanId, ...payload };
  if (!UNDOABLE.has(fn) || replayingUndo) return rawCallResolver(fn, mergedPayload);
  if (!pendingUndo) pendingUndo = { before: opts.before || snapshotPlan(currentPlan), fn, payload: mergedPayload };
  const res = await rawCallResolver(fn, mergedPayload);
  const verdict = classifyResult(res);
  if (verdict.failed) {
    pendingUndo = null;
    // A failed write stays on screen until the user closes it (UP-46, UP-69).
    showFlag({ text: verdict.message || 'The change was not saved.', error: true });
  } else {
    pendingUndo.done = true;
    pendingUndo.jiraSync = res && res.jiraSync;
  }
  return res;
}

/** Called when a new plan is shown: records the finished write and offers Undo in a Flag. */
function settleUndo() {
  const p = pendingUndo;
  if (!p || !p.done || !currentPlan) return;
  pendingUndo = null;
  const after = withWrittenStatuses(snapshotPlan(currentPlan), p.payload, p.jiraSync);
  const entry = buildUndoEntry(p.before, after, p.payload.taskId || (p.payload.items && p.payload.items[0] && p.payload.items[0].taskId));
  if (!entry) return;
  entry.label = actionLabel(p.fn, p.payload, entry);
  undoStack.push(entry);
  showFlag({ text: `${entry.label}.`, action: { label: 'Undo', run: undoLast } });
}

function findAnyTask(key) {
  return findTask(key) || (currentPlan?.backlogTasks || []).find(t => t.key === key);
}

// Links stored only in a plan record (before ADR-006) are listed once per plan and load.
const planOnlyNoted = new Set();
function notePlanOnlyLinks(plan) {
  const all = (plan.tasks || []).concat(plan.backlogTasks || []);
  const found = [];
  for (const t of all) for (const d of (t.dependencies || [])) if (d && d.planOnly) found.push(`${d.predecessorKey} ➔ ${t.key}`);
  const scope = `${activePlanId}:${found.join(',')}`;
  if (!found.length || planOnlyNoted.has(scope)) return;
  planOnlyNoted.add(scope);
  showFlag({ text: `${found.length} link${found.length === 1 ? '' : 's'} exist only in this plan, not in Jira (${found.slice(0, 5).join(', ')}${found.length > 5 ? ', ...' : ''}). They still schedule. Open a link marked "not in Jira" to create it in Jira or remove it.` });
}

// ---- Hierarchy changes (N-08, ADR-005): every change is a Jira write, so every plan shows it. ----

function levelOf(t) { return t.isEpic ? 1 : (t.isSubtask ? -1 : (t.hierarchyLevel ?? 0)); }

/**
 * What dropping `dragged` onto the middle of `target` means, by Jira's rules: a change, or a refusal
 * with the rule as the reason (shown while dragging and on the drop).
 */
function hierarchyActionFor(dragged, target) {
  if (!dragged || !target || dragged.key === target.key) return null;
  const all = (currentPlan.tasks || []).concat(currentPlan.backlogTasks || []);
  const byKey = new Map(all.map(t => [t.key, t]));
  for (let k = target.parentKey; k; k = byKey.get(k)?.parentKey) if (k === dragged.key) return { refuse: `${target.key} is below ${dragged.key}.` };
  const dl = levelOf(dragged), tl = levelOf(target);
  if (dl >= 1) return { refuse: `${dragged.key} is an epic. An epic cannot move under another work item.` };
  if (tl === -1) return { refuse: `${target.key} is a sub-task. A sub-task cannot have children in Jira.` };
  if (dragged.parentKey === target.key) return { refuse: `${dragged.key} is already under ${target.key}.` };
  if (dl === -1 && tl === 0) return { kind: 'parent', parentKey: target.key, label: `Move under ${target.key}` };
  if (dl === -1) return { refuse: `${dragged.key} is a sub-task: its parent must be a task or story.` };
  if (tl >= 1) return { kind: 'parent', parentKey: target.key, label: `Move under epic ${target.key}` };
  if (all.some(t => t.parentKey === dragged.key)) return { refuse: `${dragged.key} has sub-tasks, so Jira cannot make it a sub-task.` };
  return { kind: 'subtask', parentKey: target.key, label: `Make ${dragged.key} a sub-task of ${target.key}` };
}

/** Asks first, then makes the change in Jira; a type conversion follows Jira's job. Offers Undo. */
function requestHierarchyChange(key, action, undoOf) {
  if (!action || action.refuse) { if (action) showFlag({ text: action.refuse, error: true }); return; }
  const question = action.kind === 'parent'
    ? `Move ${key} under ${action.parentKey || 'no parent'}? This changes the parent in Jira, so every plan shows it.`
    : action.kind === 'subtask'
      ? `Make ${key} a sub-task of ${action.parentKey}? Jira changes its work type. If the types use different workflows, Jira may change its status.`
      : `Make ${key} a task? Jira changes its work type. If the types use different workflows, Jira may change its status.`;
  const run = async () => {
    const before = findAnyTask(key);
    const oldParent = before ? (before.parentKey || null) : null;
    const wasSub = before ? levelOf(before) === -1 : false;
    let res;
    if (action.kind === 'parent') {
      res = await callResolver('changeParent', { taskId: key, newParentKey: action.parentKey || null });
    } else {
      const started = await callResolver('convertIssueType', action.kind === 'subtask' ? { taskId: key, toSubtaskOf: action.parentKey } : { taskId: key, toTypeName: 'Task' });
      if (!started || started.ok !== true || !started.jobId) return;
      res = null;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, i === 0 ? 800 : 1500));
        const c = await callResolver('checkConversion', { jobId: started.jobId, taskId: key, oldParentKey: started.oldParentKey, newParentKey: started.newParentKey });
        if (!c || c.done || c.ok === false) { res = c; break; }
        showFlag({ text: `Jira is converting ${key}: ${c.progress || 0}%.` });
      }
      if (!res) { showFlag({ text: `Jira has not finished converting ${key}. Reload in a minute to see it.`, error: true }); return; }
    }
    if (res && Array.isArray(res.tasks)) applyPlanInPlace(res); else await loadProjectPlan();
    if (res && res.ok !== false && !undoOf) {
      // Undo makes the reverse change through the same route (N-08 interaction 5).
      const back = action.kind === 'parent' ? { kind: 'parent', parentKey: oldParent }
        : action.kind === 'subtask' ? { kind: 'task' }
          : (wasSub && oldParent ? { kind: 'subtask', parentKey: oldParent } : null);
      showFlag({ text: `${action.label || 'Changed'}: done in Jira.`, ...(back ? { action: { label: 'Undo', run: () => requestHierarchyChange(key, back, true) } } : {}) });
    }
  };
  if (undoOf) { run(); return; }
  showFlag({ text: question, action: { label: action.kind === 'parent' ? 'Move' : 'Convert', run } });
}

/** The keyboard route (N-08 interaction 4): the parent choices Jira allows for this row. */
function renderParentControl(task) {
  const sel = document.getElementById('parentSelect');
  const btn = document.getElementById('btnApplyParent');
  if (!sel || !btn) return;
  const all = (currentPlan.tasks || []).concat(currentPlan.backlogTasks || []);
  const lvl = levelOf(task);
  const opts = [];
  if (lvl === -1) {
    opts.push({ value: 'task:', text: 'No parent: make it a task' });
    for (const t of all) if (levelOf(t) === 0 && t.key !== task.parentKey) opts.push({ value: `parent:${t.key}`, text: `Under ${t.key}: ${t.summary}` });
  } else if (lvl === 0) {
    if (task.parentKey) opts.push({ value: 'parent:', text: 'No epic' });
    for (const t of all) {
      if (t.key === task.key || t.key === task.parentKey) continue;
      const a = hierarchyActionFor(task, t);
      if (a && !a.refuse) opts.push({ value: `${a.kind}:${t.key}`, text: a.kind === 'parent' ? `Under epic ${t.key}: ${t.summary}` : `Sub-task of ${t.key}: ${t.summary}` });
    }
  }
  sel.replaceChildren(...[{ value: '', text: task.parentKey ? `Now: under ${task.parentKey}` : 'Now: no parent' }, ...opts].map(o => {
    const el = document.createElement('option');
    el.value = o.value; el.textContent = o.text;
    return el;
  }));
  sel.disabled = btn.disabled = lvl >= 1 || opts.length === 0;
  btn.onclick = () => {
    const [kind, parentKey] = String(sel.value).split(':');
    if (!kind) return;
    const label = kind === 'task' ? `Make ${task.key} a task` : kind === 'subtask' ? `Make ${task.key} a sub-task of ${parentKey}` : `Move under ${parentKey || 'no parent'}`;
    requestHierarchyChange(task.key, { kind, parentKey: parentKey || null, label });
  };
}

/** A task or story whose bar is the roll-up of its sub-tasks: it moves as a block (ADR-003, N-05). */
function isBlockParent(task) {
  return !!task && task.datesFromChildren === true && !task.isEpic && (task.hierarchyLevel ?? 0) === 0;
}

/** The planned block move of a parent by `days`: each sub-task by its state (src/domain/block-move.ts). */
function blockPlan(key, days) {
  const members = (currentPlan.tasks || []).concat(currentPlan.backlogTasks || []).filter(t => t.parentKey === key);
  return planBlockMove(members, days, todayIso());
}

/**
 * The link that most limits a block move: each moving, not-started sub-task is bound by its own
 * links and by its parent's (N-06 rule 5). Returns the extra days the block needs, or null.
 */
function blockConflict(plan) {
  const all = (currentPlan.tasks || []).concat(currentPlan.backlogTasks || []);
  let worst = null;
  for (const c of plan.changes) {
    if (c.state !== 'not-started') continue;
    const r = checkDependencyConflict({ key: c.key, startDate: c.toStart }, all, todayIso());
    if (!r.hasConflict) continue;
    const need = daysBetween(c.toStart, r.earliestDate);
    if (!worst || need > worst.need) worst = { ...r, need, key: c.key };
  }
  return worst;
}

/**
 * The days a block move of `key` by `days` will use: with "Enforce dependencies" on, the whole block
 * stops at the earliest day every link allows (ADR-003 section 6), as moveBlock does.
 */
function effectiveBlockDays(key, days) {
  if (!days || !isEnforceDepsEnabled()) return days;
  const conflict = blockConflict(blockPlan(key, days));
  return conflict ? days + conflict.need : days;
}

/**
 * Every Jira write of a drop, from the same computation the server applies (src/domain/drop-plan.ts,
 * INV-03): `moves` for drawing (the moved bar included), `text` for the preview line.
 */
function dropPreview(key, start, end, blockDays) {
  const plan = { tasks: currentPlan.tasks || [], backlogTasks: currentPlan.backlogTasks || [] };
  const all = plan.tasks.concat(plan.backlogTasks);
  const p = blockDays !== undefined ? previewBlockMove(plan, key, blockDays, todayIso()) : previewSingleMove(plan, key, start, end, todayIso());
  const text = describePendingWrites(all, p.moves, key, { parentDue: p.parentDue, epics: p.epics }).text;
  const moves = new Map(p.moves);
  moves.set(key, { start, end });
  return { moves, text };
}

/** Moves a parent and its sub-tasks as one block; one Undo restores them all. */
async function moveBlock(key, days) {
  if (!days) return;
  let plan = blockPlan(key, days);
  const conflict = blockConflict(plan);
  const enforce = isEnforceDepsEnabled();
  if (conflict && enforce) {
    // Enforce dependencies: the whole block stops at the earliest day every link allows (ADR-003 section 6).
    days += conflict.need;
    if (!days) {
      announce(`Enforce dependencies: ${key} cannot move earlier; ${conflict.key} cannot start before ${conflict.earliestDate} (dependency on ${conflict.predKey}).`);
      drawTimeline(true);
      return;
    }
    plan = blockPlan(key, days);
  }
  if (plan.changes.length === 0) {
    showFlag({ text: `Nothing in ${key} can move: ${plan.fixed.map(f => `${f.key} ${f.reason}`).join('; ')}.` });
    drawTimeline(true);
    return;
  }
  const expectedVersions = {};
  for (const c of plan.changes) expectedVersions[c.key] = (findAnyTask(c.key) && findAnyTask(c.key).version) || 0;
  let res = await callResolver('moveTaskGroup', { taskId: key, days, expectedVersions, enforceDependencies: enforce });
  // A block of more than 25 sub-tasks continues in batches of 25; the last batch runs the cascade.
  const rest = (res && Array.isArray(res.blockRemaining)) ? res.blockRemaining : [];
  for (let i = 0; i < rest.length; i += 25) {
    const items = rest.slice(i, i + 25);
    const last = i + 25 >= rest.length;
    showFlag({ text: `Moving the sub-tasks of ${key}: ${Math.min(i + 25, rest.length) + 25} of ${rest.length + 25}.` });
    const next = await rawCallResolver('continueBlockMove', { planId: activePlanId, taskId: key, items, last });
    if (next && Array.isArray(next.tasks)) res = next;
    if (!next || next.ok === false) break;
  }
  if (res && Array.isArray(res.tasks)) applyPlanInPlace(res);
  else await loadProjectPlan();
  if (res && res.ok && plan.fixed.length) {
    announce(`Moved ${key} by ${days} days. Kept: ${plan.fixed.map(f => `${f.key} (${f.reason})`).join(', ')}.`);
  }
  if (res && res.ok && conflict) {
    const via = conflict.viaParent ? ` (a link of ${conflict.viaParent})` : '';
    if (enforce) announce(`Enforce dependencies: moved ${key} so ${conflict.key} starts on ${conflict.earliestDate}, after ${conflict.predKey}${via}.`);
    else showFlag({ text: `${conflict.key} now starts before ${conflict.earliestDate}, the earliest day its dependency on ${conflict.predKey}${via} allows.` });
  }
}

/** Applies undo or redo operations in order, with each task's current version. */
async function replayUndo(ops) {
  replayingUndo = true;
  let ok = true;
  // Undo writes go to the plan the action was made in, like every other write.
  const planId = activePlanId;
  try {
    for (const op of ops) {
      let res;
      if (op.kind === 'unschedule') {
        res = await rawCallResolver('unscheduleTask', { planId, taskId: op.key });
      } else if (op.kind === 'schedule') {
        res = await rawCallResolver('scheduleBacklogTask', { planId, taskId: op.key, startWeek: op.updates.startWeek, spanWeeks: op.updates.spanWeeks || 1 });
        if (!classifyResult(res).failed && op.updates.startDate) {
          res = await rawCallResolver('updateWbsTask', { planId, taskId: op.key, updates: { startDate: op.updates.startDate, endDate: op.updates.endDate } });
        }
      } else {
        const t = findAnyTask(op.key);
        // restore: the exact dates of each changed task, with no new cascade (B-14).
        res = await rawCallResolver('updateWbsTask', { planId, taskId: op.key, updates: op.updates, expectedVersion: (t && t.version) || 0, restore: true });
      }
      const verdict = classifyResult(res);
      if (verdict.failed) {
        showFlag({ text: verdict.message || 'The undo was not saved.', error: true });
        ok = false;
        break;
      }
      // The next operation needs the new version of each record.
      if (res && Array.isArray(res.tasks)) currentPlan = res;
      else if (res && res.plan && Array.isArray(res.plan.tasks)) currentPlan = res.plan;
    }
  } finally {
    replayingUndo = false;
  }
  await loadProjectPlan();
  return ok;
}

async function undoLast() {
  const entry = undoStack.undo();
  if (!entry) return;
  if (await replayUndo(entry.restore)) showFlag({ text: `Undone: ${entry.label}.`, action: { label: 'Redo', run: redoLast } });
}

async function redoLast() {
  const entry = undoStack.redo();
  if (!entry) return;
  if (await replayUndo(entry.reapply)) showFlag({ text: `Redone: ${entry.label}.`, action: { label: 'Undo', run: undoLast } });
}

/** Shows an estimate in hours, or "Unestimated" when Jira has none (B-03). */
function formatEffort(hours) {
  return hours > 0 ? `${hours}h` : 'Unestimated';
}

function syncPinnedBarHit() {
  document.querySelectorAll('.bar-hit.is-pinned').forEach(el => {
    if (el.dataset.taskId !== pinnedDependencyTaskId) el.classList.remove('is-pinned');
  });
  if (pinnedDependencyTaskId) {
    const el = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(pinnedDependencyTaskId)}"]`);
    if (el) el.classList.add('is-pinned');
  }
}

/** Opens "Why this date?" for a task (B-12); fixes are applied with a version check. */
function showWhy(taskKey, anchorRect) {
  openWhyPopup(currentPlan?.tasks || [], taskKey, anchorRect, {
    apply: async (key, updates) => {
      const t = (currentPlan?.tasks || []).find(x => x.key === key);
      await callResolver('updateWbsTask', { taskId: key, updates, expectedVersion: (t && t.version) || 0 });
      await loadProjectPlan();
    },
    focusTask: (key) => {
      const row = scrollRowIntoView(key);
      if (row) {
        row.setAttribute('tabindex', '-1');
        row.scrollIntoView({ block: 'center' });
        row.focus();
      }
      pinnedDependencyTaskId = key;
      syncPinnedBarHit();
      drawTimeline(true);
    }
  });
}

// State Variables
let currentPlan = null;
let activeTaskId = null;
let hoveredTaskId = null;
let pinnedDependencyTaskId = null;
let isDraggingBar = false;
let modalUseRollupProgressFlag = false;
let popoverOpenedAt = 0;
let columnWidths = { ...DEFAULT_COLUMN_WIDTHS };
let compactTaskWidth = COMPACT_TASK_DEFAULT_WIDTH;
let hiddenColumns = new Set();
const ALL_COLUMNS = [
  { key: 'epic', label: 'Epic', icon: '🟪', defaultWidth: DEFAULT_COLUMN_WIDTHS.epic, description: 'Parent Epic roadmap category' },
  { key: 'story', label: 'Story', icon: '🔷', defaultWidth: DEFAULT_COLUMN_WIDTHS.story, description: 'Issue type (Story, Task, Subtask)' },
  { key: 'task', label: 'Task', icon: '📝', defaultWidth: DEFAULT_COLUMN_WIDTHS.task, locked: true, description: 'Issue key and summary (Required)' },
  { key: 'resource', label: 'Resource', icon: '👥', defaultWidth: DEFAULT_COLUMN_WIDTHS.resource, description: 'Assigned team member' },
  { key: 'effort', label: 'Hrs', icon: '⏱️', defaultWidth: DEFAULT_COLUMN_WIDTHS.effort, description: 'Estimated effort in hours' },
  { key: 'progress', label: 'Progress', icon: '📈', defaultWidth: DEFAULT_COLUMN_WIDTHS.progress, description: 'Actual completion %' },
  { key: 'target', label: 'Target', icon: '🎯', defaultWidth: DEFAULT_COLUMN_WIDTHS.target, description: 'Planned target completion %' },
  { key: 'status', label: 'Status', icon: '🏷️', defaultWidth: DEFAULT_COLUMN_WIDTHS.status, description: 'Workflow status' }
];
function getVisibleColKeys() {
  return ALL_COLUMNS.map(c => c.key).filter(k => !hiddenColumns.has(k));
}
function isCompactMode() {
  const visible = getVisibleColKeys();
  return visible.length === 1 && visible[0] === 'task';
}
const COL_KEYS = ALL_COLUMNS.map(c => c.key);
// Time axis (B-27): zoom level, bounded time range computed in browser, and compact columns.
const ZOOM_KEY = 'cascadeplan_zoom';
const EXTEND_WEEKS = 4;
function readPref(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
}
function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}
let zoomId = readPref(ZOOM_KEY, 'week');
let compactDecided = false;
let timeRange = null;
function dayPx() {
  return zoomById(zoomId).dayPx;
}
function trackWidth() {
  return timeRange ? rangeDays(timeRange) * dayPx() : 0;
}
function getFrozenLayout() {
  return computeFrozenLayout(getVisibleColKeys(), columnWidths, isCompactMode(), compactTaskWidth);
}
function colWidth(k) {
  const fl = getFrozenLayout();
  return fl.widths[k] !== undefined ? fl.widths[k] : (isCompactMode() && k === 'task' ? compactTaskWidth : columnWidths[k]);
}
/** Left offset of each frozen data column. */
function frozenOffsets() {
  return getFrozenLayout().offsets;
}
// Parent rows the user collapsed. Every parent starts expanded; a re-render keeps the user's choice.
const collapsedTasks = new Set();

/** Expands every collapsed row above a task (parent, epic, grandparent, ...). True when one was expanded. */
function expandAncestors(task) {
  let changed = false;
  const seen = new Set();
  let cur = task;
  while (cur && !seen.has(cur.key)) {
    seen.add(cur.key);
    for (const k of [cur.parentKey, cur.epicKey]) {
      if (k && k !== cur.key && collapsedTasks.delete(k)) changed = true;
    }
    const upKey = cur.parentKey && cur.parentKey !== cur.key ? cur.parentKey : cur.epicKey;
    cur = upKey && upKey !== cur.key ? findTask(upKey) : null;
  }
  return changed;
}
let currentHierarchyView = 'all'; // 'all' | 'epics' | 'stories'

// Initialization with immediate readiness check
async function initApp() {
  initErrorBanner();
  initWhyPopup();
  initChangesPanel();
  initBaselinePanel({
    call: (fn, payload = {}) => rawCallResolver(fn, { planId: activePlanId, ...payload }),
    flag: showFlag,
    isApprover: () => planApprover,
    reloadPlan: () => loadProjectPlan()
  });
  // Theme first, so the first paint already uses the Jira theme (B-17).
  await enableTheme();
  // The canvas reads token colours at draw time; a theme change repaints it (B-17).
  onThemeChange(() => {
    if (timeline) timeline.invalidateColours();
    drawTimeline(true);
  });
  const wrapper = document.getElementById('ganttWrapper');
  if (wrapper) {
    timeline = new CanvasTimeline(wrapper);
    timeline.onDraw = (links) => renderDependencyBadges(links);
    initArrowLineClicks(wrapper);
    wrapper.addEventListener('scroll', scheduleVirtualRows, { passive: true });
  }
  const tbody = document.getElementById('ganttBody');
  if (tbody) {
    tbody.addEventListener('mouseover', (e) => {
      if (!timeline) return;
      const tr = e.target.closest('tr.task-row');
      const nextKey = tr ? (tr.dataset.taskId || null) : null;
      if (timeline.hoveredRowKey !== nextKey) {
        timeline.hoveredRowKey = nextKey;
        timeline.requestDraw();
      }
    });
    tbody.addEventListener('mouseleave', () => {
      if (timeline && timeline.hoveredRowKey !== null) {
        timeline.hoveredRowKey = null;
        timeline.requestDraw();
      }
    });
  }
  document.addEventListener('cp:drivers', (e) => {
    if (timeline) timeline.driverKeys = e.detail || [];
    drawTimeline(true);
  });
  setupEventListeners();
  initKeyboard();
  // A refresh reopens the plan this project had open (saved per project in browser storage).
  planScope = await getProjectScope();
  activePlanId = getSavedPlanId(browserStore(), planScope);
  loadProjectPlan();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function setupEventListeners() {
  document.getElementById('viewSwitcher').addEventListener('change', (e) => {
    switchView(e.target.value);
  });
  const toggleTableBtn = document.getElementById('toggleTableViewBtn');
  if (toggleTableBtn) {
    toggleTableBtn.addEventListener('click', () => {
      switchView(toggleTableView(currentView));
    });
  }
  initInAppSearch();
  const hierSwitcher = document.getElementById('hierarchySwitcher');
  if (hierSwitcher) {
    hierSwitcher.addEventListener('change', (e) => {
      currentHierarchyView = e.target.value;
      if (currentView === 'table') {
        renderTableView();
      } else {
        renderTimelineRows();
      }
    });
  }
  document.getElementById('toggleBacklogBtn').addEventListener('click', toggleBacklogTray);
  document.getElementById('closeTrayBtn').addEventListener('click', () => {
    document.getElementById('backlogTray').classList.add('collapsed');
  });
  document.getElementById('refreshBtn').addEventListener('click', loadProjectPlan);
  document.getElementById('newTaskBtn').addEventListener('click', openCreateTaskModal);
  document.getElementById('newEpicBtn').addEventListener('click', openCreateEpicModal);

  // Task Detail Modal Listeners
  document.getElementById('btnCloseTaskDetail').addEventListener('click', () => closeModal('taskDetailModal'));
  document.getElementById('btnCancelTaskDetail').addEventListener('click', () => closeModal('taskDetailModal'));
  document.getElementById('btnSaveTaskModal').addEventListener('click', saveTaskModalChanges);
  const unschedBtn = document.getElementById('btnUnscheduleTaskModal');
  if (unschedBtn) unschedBtn.addEventListener('click', handleUnscheduleFromModal);
  document.getElementById('btnAddSubtaskBtn').addEventListener('click', handleAddSubtask);
  const addResBtn = document.getElementById('btnAddResourceSubtaskBtn');
  if (addResBtn) addResBtn.addEventListener('click', handleAddResourceSubtask);
  document.getElementById('editEstimateUnitSelect').addEventListener('change', handleEstimateUnitChange);
  const estValInput = document.getElementById('editEstimateValueInput');
  if (estValInput) estValInput.addEventListener('input', updateReconciledHoursBadge);
  const tshirtSel = document.getElementById('editTshirtSelect');
  if (tshirtSel) tshirtSel.addEventListener('change', updateReconciledHoursBadge);

  // Create Task Modal Listeners
  document.getElementById('btnCloseCreateTask').addEventListener('click', () => closeModal('createTaskModal'));
  document.getElementById('btnCancelCreateTask').addEventListener('click', () => closeModal('createTaskModal'));
  document.getElementById('btnSubmitCreateTask').addEventListener('click', executeCreateTask);

  // Create Epic Modal Listeners
  document.getElementById('btnCloseCreateEpic').addEventListener('click', () => closeModal('createEpicModal'));
  document.getElementById('btnCancelCreateEpic').addEventListener('click', () => closeModal('createEpicModal'));
  document.getElementById('btnSubmitCreateEpic').addEventListener('click', executeCreateEpic);

  // Backlog Tray Drop to Unschedule
  const backlogTray = document.getElementById('backlogTray');
  backlogTray.addEventListener('dragover', (e) => {
    e.preventDefault();
    backlogTray.classList.add('drag-over');
  });
  backlogTray.addEventListener('dragleave', () => {
    backlogTray.classList.remove('drag-over');
  });
  backlogTray.addEventListener('drop', async (e) => {
    e.preventDefault();
    backlogTray.classList.remove('drag-over');
    const dataStr = e.dataTransfer.getData('text/plain');
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        if (data.fromTimeline && data.taskId) {
          await callResolver('unscheduleTask', { taskId: data.taskId });
          await loadProjectPlan();
        }
      } catch {}
    }
  });

  // Column Manager Popover Listeners
  const btnManageCols = document.getElementById('btnManageColumns');
  const colPopover = document.getElementById('columnManagerPopover');
  if (btnManageCols && colPopover) {
    btnManageCols.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = colPopover.style.display === 'flex';
      colPopover.style.display = isVisible ? 'none' : 'flex';
    });
  }
  const btnCloseCol = document.getElementById('btnCloseColPopover');
  if (btnCloseCol && colPopover) {
    btnCloseCol.addEventListener('click', (e) => {
      e.stopPropagation();
      colPopover.style.display = 'none';
    });
  }
  const btnShowAll = document.getElementById('btnShowAllColumns');
  if (btnShowAll) {
    btnShowAll.addEventListener('click', () => {
      showAllColumns();
    });
  }
  const btnResetCols = document.getElementById('btnResetColumns');
  if (btnResetCols) {
    btnResetCols.addEventListener('click', () => {
      resetColumnDefaults();
    });
  }
  const btnUnhideBanner = document.getElementById('btnUnhideAllBanner');
  if (btnUnhideBanner) {
    btnUnhideBanner.addEventListener('click', () => {
      showAllColumns();
    });
  }
  const btnOpenManagerBanner = document.getElementById('btnOpenManagerFromBanner');
  if (btnOpenManagerBanner && colPopover) {
    btnOpenManagerBanner.addEventListener('click', (e) => {
      e.stopPropagation();
      colPopover.style.display = 'flex';
    });
  }

  // Retry Button
  const retryBtn = document.getElementById('btnRetryLoad');
  if (retryBtn) retryBtn.addEventListener('click', loadProjectPlan);

  // Dismiss Modals on Backdrop Click
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModalAsking(modal);
    });
    // Any edit in a form marks it unsaved until it closes (B-14 criterion 7).
    // Only the user's own edits count; the code that fills a form fires synthetic change events.
    modal.addEventListener('input', (e) => { if (e.isTrusted) modal.dataset.dirty = '1'; });
    modal.addEventListener('change', (e) => { if (e.isTrusted) modal.dataset.dirty = '1'; });
  });

  // Dismiss Modals and Popovers on Escape Key
  window.addEventListener('keydown', (e) => {
    const inField = Boolean(
      (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable)) ||
      (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT' || document.activeElement.isContentEditable))
    );
    // Ctrl or Cmd with plus or minus zooms the timeline while focus is in the planner (B-27).
    if ((e.ctrlKey || e.metaKey) && !e.altKey && ['=', '+', '-', '_'].includes(e.key) && !inField && !openModal()) {
      e.preventDefault();
      setZoom(zoomStep(zoomId, e.key === '-' || e.key === '_' ? -1 : 1));
      return;
    }
    // Ctrl+Z / Ctrl+Shift+Z (Cmd on macOS) in the planner; text fields keep their own undo (WCAG 2.1.4).
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'z' || e.key === 'Z') && !inField && !openModal()) {
      e.preventDefault();
      if (e.shiftKey) redoLast(); else undoLast();
      return;
    }
    // Ctrl+F or Cmd+F while focus is in the planner: open in-app search (B-26)
    if (isSearchShortcut(e) && !openModal()) {
      e.preventDefault();
      focusInAppSearch();
      return;
    }
    if (e.key.length === 1 && e.key !== '?' && onShortcut(e, inField)) {
      e.preventDefault();
      return;
    }
    if (e.key === '?' && !inField) {
      const key = (gridRoot && gridRoot.contains(document.activeElement) ? rowTasks[gridFocus.row]?.task.key : null) || pinnedDependencyTaskId || hoveredTaskId;
      const bar = key && document.querySelector(`.bar-hit[data-task-id="${CSS.escape(key)}"]`);
      if (key) { e.preventDefault(); showWhy(key, bar ? bar.getBoundingClientRect() : null); }
      return;
    }
    if (e.key === 'Escape' && isWhyPopupOpen()) {
      closeWhyPopup();
      return;
    }
    if (e.key === 'Escape' && !openModal() && !document.getElementById('barToolbar')?.hidden) {
      closeBarToolbar();
      return;
    }
    if (e.key === 'Escape' && !document.getElementById('helpPopup')?.hidden) {
      closeHelp();
      return;
    }
    if (e.key === 'Escape' && isChangesPanelOpen()) {
      closeChangesPanel();
      return;
    }
    if (e.key === 'Escape' && isBaselinePanelOpen()) {
      closeBaselinePanel();
      return;
    }
    if (e.key === 'Escape') {
      const modal = openModal();
      if (modal) {
        closeModalAsking(modal);
        return;
      }
      closeAllPopovers();
      if (colPopover) colPopover.style.display = 'none';
      if (pinnedDependencyTaskId) {
        pinnedDependencyTaskId = null;
        drawTimeline(true);
      }
      if (selectedKeys.size && !pendingProgress.size) clearSelection();
      const inlineRow = document.querySelector('.inline-creation-row');
      if (inlineRow) {
        inlineRow.remove();
        updateVirtualRows();
      }
    }
  });

  // Dismiss Popovers on Outside Click
  document.addEventListener('click', (e) => {
    const resPopover = document.getElementById('resourcePickerPopover');
    const statPopover = document.getElementById('statusPickerPopover');
    const epicPopover = document.getElementById('epicPickerPopover');

    if (resPopover && resPopover.style.display === 'flex' && !resPopover.contains(e.target) && !e.target.closest('.resource-chip-btn')) {
      resPopover.style.display = 'none';
    }
    if (statPopover && statPopover.style.display === 'flex' && !statPopover.contains(e.target) && !e.target.closest('.editable-badge-chip')) {
      statPopover.style.display = 'none';
    }
    if (epicPopover && epicPopover.style.display === 'flex' && !epicPopover.contains(e.target) && !e.target.closest('.epic-link-chip')) {
      epicPopover.style.display = 'none';
    }
    const progPopover = document.getElementById('progressPickerPopover');
    if (progPopover && progPopover.style.display === 'flex' && !progPopover.contains(e.target) && !e.target.closest('.td-progress-cell') && !e.target.closest('.quick-progress-btn') && !e.target.closest('#barToolbar')) {
      progPopover.style.display = 'none';
    }
    const targetPopover = document.getElementById('targetPickerPopover');
    if (targetPopover && targetPopover.style.display === 'flex' && !targetPopover.contains(e.target) && !e.target.closest('.td-target-cell')) {
      targetPopover.style.display = 'none';
    }
    const colPopover = document.getElementById('columnManagerPopover');
    if (colPopover && colPopover.style.display === 'flex' && !colPopover.contains(e.target) && !e.target.closest('#btnManageColumns') && !e.target.closest('#btnOpenManagerFromBanner')) {
      colPopover.style.display = 'none';
    }
    if (pinnedDependencyTaskId && !e.target.closest('.bar-hit') && !e.target.closest('#barToolbar')) {
      pinnedDependencyTaskId = null;
      syncPinnedBarHit();
      drawTimeline(true);
    }
  });

  // Horizontal Timeline Navigation Controls
  const btnEarlier = document.getElementById('btnScrollEarlier');
  if (btnEarlier) {
    btnEarlier.addEventListener('click', () => {
      const wrapper = document.getElementById('ganttWrapper');
      if (wrapper) setTimelineScrollLeft(wrapper.scrollLeft - (wrapper.clientWidth - layout.trackLeft) / 2);
    });
  }
  const btnLater = document.getElementById('btnScrollLater');
  if (btnLater) {
    btnLater.addEventListener('click', () => {
      const wrapper = document.getElementById('ganttWrapper');
      if (wrapper) setTimelineScrollLeft(wrapper.scrollLeft + (wrapper.clientWidth - layout.trackLeft) / 2);
    });
  }
  const btnToday = document.getElementById('btnScrollToday');
  if (btnToday) {
    btnToday.addEventListener('click', () => {
      scrollToToday();
    });
  }

  // Quick Progress Popover Event Handlers
  const progSlider = document.getElementById('progressPickerSlider');
  const progNumInput = document.getElementById('progressPickerNumberInput');
  const progValLabel = document.getElementById('progressPickerValLabel');
  const progPopover = document.getElementById('progressPickerPopover');

  if (progSlider && progNumInput && progValLabel) {
    progSlider.addEventListener('input', (e) => {
      progNumInput.value = e.target.value;
      progValLabel.textContent = `${e.target.value}%`;
    });
    progNumInput.addEventListener('input', (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val)) val = 0;
      val = Math.max(0, Math.min(100, val));
      progSlider.value = val;
      progValLabel.textContent = `${val}%`;
    });
  }

  document.querySelectorAll('.progress-preset-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const pct = parseInt(btn.dataset.pct, 10);
      if (progPopover) progPopover.style.display = 'none';
      const key = activeProgressTaskKey;
      if (!key) return;
      const updates = { progress: pct, manualProgress: true };
      if (!(await withStatusChoice([{ key, progress: pct, updates }]))) return;
      await callResolver('updateWbsTask', { taskId: key, updates });
      await loadProjectPlan();
    });
  });

  const btnApplyRollup = document.getElementById('btnApplyRollupProgress');
  if (btnApplyRollup) {
    btnApplyRollup.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (progPopover) progPopover.style.display = 'none';
      if (!activeProgressTaskKey) return;
      const task = (currentPlan?.tasks || []).find(t => t.key === activeProgressTaskKey);
      const rollupPct = task?.rollupStats ? task.rollupStats.progressPct : 0;
      await callResolver('updateWbsTask', {
        taskId: activeProgressTaskKey,
        updates: { progress: rollupPct, manualProgress: false }
      });
      await loadProjectPlan();
    });
  }

  const btnSaveProg = document.getElementById('btnSaveProgressPicker');
  if (btnSaveProg) {
    btnSaveProg.addEventListener('click', async (e) => {
      e.stopPropagation();
      const val = parseInt(progNumInput?.value || progSlider?.value || '0', 10);
      if (progPopover) progPopover.style.display = 'none';
      const key = activeProgressTaskKey;
      if (!key) return;
      const pct = Math.max(0, Math.min(100, val));
      const updates = { progress: pct, manualProgress: true };
      if (!(await withStatusChoice([{ key, progress: pct, updates }]))) return;
      await callResolver('updateWbsTask', { taskId: key, updates });
      await loadProjectPlan();
    });
  }

  const btnCancelProg = document.getElementById('btnCancelProgressPicker');
  if (btnCancelProg) {
    btnCancelProg.addEventListener('click', (e) => {
      e.stopPropagation();
      if (progPopover) progPopover.style.display = 'none';
    });
  }

  // Quick Target Progress Popover Event Handlers
  const targetSlider = document.getElementById('targetPickerSlider');
  const targetNumInput = document.getElementById('targetPickerNumberInput');
  const targetValLabel = document.getElementById('targetPickerValLabel');
  const targetPopover = document.getElementById('targetPickerPopover');

  if (targetSlider && targetNumInput && targetValLabel) {
    targetSlider.addEventListener('input', (e) => {
      targetNumInput.value = e.target.value;
      targetValLabel.textContent = `${e.target.value}%`;
    });
    targetNumInput.addEventListener('input', (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val)) val = 0;
      val = Math.max(0, Math.min(100, val));
      targetSlider.value = val;
      targetValLabel.textContent = `${val}%`;
    });
  }

  document.querySelectorAll('.target-preset-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const pct = parseInt(btn.dataset.pct, 10);
      if (targetPopover) targetPopover.style.display = 'none';
      if (!activeTargetTaskKey) return;
      await callResolver('updateWbsTask', {
        taskId: activeTargetTaskKey,
        updates: { targetProgress: pct }
      });
      await loadProjectPlan();
    });
  });

  const btnSaveTarget = document.getElementById('btnSaveTargetPicker');
  if (btnSaveTarget) {
    btnSaveTarget.addEventListener('click', async (e) => {
      e.stopPropagation();
      const val = parseInt(targetNumInput?.value || targetSlider?.value || '0', 10);
      if (targetPopover) targetPopover.style.display = 'none';
      if (!activeTargetTaskKey) return;
      await callResolver('updateWbsTask', {
        taskId: activeTargetTaskKey,
        updates: { targetProgress: Math.max(0, Math.min(100, val)) }
      });
      await loadProjectPlan();
    });
  }

  const btnCancelTarget = document.getElementById('btnCancelTargetPicker');
  if (btnCancelTarget) {
    btnCancelTarget.addEventListener('click', (e) => {
      e.stopPropagation();
      if (targetPopover) targetPopover.style.display = 'none';
    });
  }

  const btnAutoTarget = document.getElementById('btnAutoTargetPicker');
  if (btnAutoTarget) {
    btnAutoTarget.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (targetPopover) targetPopover.style.display = 'none';
      if (!activeTargetTaskKey) return;
      await callResolver('updateWbsTask', {
        taskId: activeTargetTaskKey,
        updates: { manualTargetProgress: false }
      });
      await loadProjectPlan();
    });
  }

  // Modal Progress & Target Slider syncing and Presets
  const editProgInput = document.getElementById('editProgressInput');
  const editProgSlider = document.getElementById('editProgressSlider');
  const editProgValLabel = document.getElementById('modalProgressValLabel');
  if (editProgInput && editProgSlider && editProgValLabel) {
    editProgSlider.addEventListener('input', (e) => {
      editProgInput.value = e.target.value;
      editProgValLabel.textContent = `${e.target.value}%`;
    });
    editProgInput.addEventListener('input', (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val)) val = 0;
      val = Math.max(0, Math.min(100, val));
      editProgSlider.value = val;
      editProgValLabel.textContent = `${val}%`;
    });
  }

  document.querySelectorAll('.modal-prog-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const pct = btn.dataset.pct;
      if (editProgInput) editProgInput.value = pct;
      if (editProgSlider) editProgSlider.value = pct;
      if (editProgValLabel) editProgValLabel.textContent = `${pct}%`;
    });
  });

  const editTargetInput = document.getElementById('editTargetProgressInput');
  const editTargetSlider = document.getElementById('editTargetProgressSlider');
  const editTargetValLabel = document.getElementById('modalTargetValLabel');
  if (editTargetInput && editTargetSlider && editTargetValLabel) {
    editTargetSlider.addEventListener('input', (e) => {
      editTargetInput.value = e.target.value;
      editTargetValLabel.textContent = `${e.target.value}%`;
    });
    editTargetInput.addEventListener('input', (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val)) val = 0;
      val = Math.max(0, Math.min(100, val));
      editTargetSlider.value = val;
      editTargetValLabel.textContent = `${val}%`;
    });
  }

  document.querySelectorAll('.modal-target-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const pct = btn.dataset.pct;
      if (editTargetInput) editTargetInput.value = pct;
      if (editTargetSlider) editTargetSlider.value = pct;
      if (editTargetValLabel) editTargetValLabel.textContent = `${pct}%`;
    });
  });

  // Changing a Done item's status in the dialog unlocks its progress (2026-11-06).
  document.getElementById('editStatusSelect')?.addEventListener('change', (e) => setDialogProgressLock(activeTaskId, e.target.value));
  document.getElementById('btnStatusOfferMove')?.addEventListener('click', () => { if (statusOfferResolve) statusOfferResolve('move'); });
  document.getElementById('btnStatusOfferKeep')?.addEventListener('click', () => { if (statusOfferResolve) statusOfferResolve('keep'); });

  const btnModalRollup = document.getElementById('btnModalUseRollup');
  if (btnModalRollup) {
    btnModalRollup.addEventListener('click', () => {
      const curTask = (currentPlan?.tasks || []).find(t => t.key === activeTaskId);
      const rollupPct = curTask?.rollupStats ? curTask.rollupStats.progressPct : 0;
      if (editProgInput) editProgInput.value = rollupPct;
      if (editProgSlider) editProgSlider.value = rollupPct;
      if (editProgValLabel) editProgValLabel.textContent = `${rollupPct}%`;
      modalUseRollupProgressFlag = true;
    });
  }

  initGanttScrollSync();
  initGanttPan();

  window.addEventListener('resize', () => {
    syncGanttScrollWidth();
    scheduleVirtualRows();
  });
}

let hasInitialScrolledToToday = false;
let isSyncingGanttScroll = false;

function syncGanttScrollWidth() {
  // ganttWrapper is the sole native horizontal scrollbar.
}

function initGanttScrollSync() {
  const wrapper = document.getElementById('ganttWrapper');
  if (!wrapper) return;

  wrapper.addEventListener('scroll', () => {
    closeAllPopovers();
  });

  // Shift + Wheel horizontal scroll support
  wrapper.addEventListener('wheel', (e) => {
    if (e.shiftKey) {
      e.preventDefault();
      wrapper.scrollLeft += (e.deltaY || e.deltaX);
    }
  }, { passive: false });
}

function scrollToToday() {
  const wrapper = document.getElementById('ganttWrapper');
  if (!wrapper || !timeRange) return;
  const vw = wrapper.clientWidth - layout.trackLeft;
  // A direct jump: a smooth scroll is cut short by the top scrollbar mirror (B-27).
  setTimelineScrollLeft(Math.max(0, anchorScroll(todayIso(), vw / 2, timeRange.start, dayPx())));
}

function initGanttPan() {
  const wrapper = document.getElementById('ganttWrapper');
  if (!wrapper) return;

  let isPanning = false;
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;
  let hasMoved = false;

  wrapper.addEventListener('mousedown', (e) => {
    // Only trigger on left-click (0) or middle-click (1)
    if (e.button !== 0 && e.button !== 1) return;

    // Left-button drag inside frozen data columns is reserved for row interactions and press-hold reordering
    if (e.button === 0 && (e.clientX - wrapper.getBoundingClientRect().left) < (layout.trackLeft || 0)) {
      return;
    }

    // Skip interactive elements
    if (e.target.closest('.bar-hit, .bar-handle, .bar-link-port, .dep-link-badge, .btn, button, input, select, a, .resizer, .row-drag-handle, .inline-edit-input, .resource-chip-btn, .editable-badge-chip, .epic-link-chip, .th-col-menu-btn, .row-action-btn, .tree-toggle-btn')) {
      return;
    }

    isPanning = true;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;
    startScrollLeft = wrapper.scrollLeft;
    startScrollTop = wrapper.scrollTop;

    function onMouseMove(moveEvent) {
      if (!isPanning) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      if (!hasMoved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        hasMoved = true;
        wrapper.classList.add('is-panning');
      }

      if (hasMoved) {
        wrapper.scrollLeft = startScrollLeft - dx;
        wrapper.scrollTop = startScrollTop - dy;
      }
    }

    function onMouseUp() {
      if (isPanning) {
        isPanning = false;
        wrapper.classList.remove('is-panning');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}

let currentView = 'timeline';

function switchView(viewName) {
  currentView = viewName;
  const isTimeline = viewName === 'timeline';
  const isTable = viewName === 'table';
  const isUtil = viewName === 'utilization';

  const timelineSec = document.getElementById('timelineViewSection');
  const utilSec = document.getElementById('utilizationViewSection');
  const tableSec = document.getElementById('tableViewSection');
  const toggleBtn = document.getElementById('toggleTableViewBtn');
  const switcher = document.getElementById('viewSwitcher');

  if (timelineSec) timelineSec.style.display = isTimeline ? 'flex' : 'none';
  if (utilSec) utilSec.style.display = isUtil ? 'block' : 'none';
  if (tableSec) tableSec.style.display = isTable ? 'flex' : 'none';

  if (toggleBtn) {
    toggleBtn.setAttribute('aria-pressed', isTable ? 'true' : 'false');
  }
  if (switcher && switcher.value !== viewName) {
    switcher.value = viewName;
  }

  if (isTimeline) {
    setTimeout(updateVirtualRows, 100);
  } else if (isUtil) {
    renderUtilizationView();
  } else if (isTable) {
    renderTableView();
  }
}

function renderTableView() {
  const tbody = document.getElementById('plainDataTableBody');
  const countEl = document.getElementById('tableRowCount');
  if (!tbody) return;

  const tasks = (rowTasks && rowTasks.length > 0 ? rowTasks.map(r => r.task) : (currentPlan?.tasks || []));
  const rows = buildTableViewRows(tasks);

  if (countEl) {
    countEl.textContent = `${rows.length} ${rows.length === 1 ? 'issue' : 'issues'}`;
  }

  const trs = rows.map(r => {
    const tr = document.createElement('tr');
    tr.dataset.taskKey = r.key;
    tr.tabIndex = -1;

    const cells = [
      r.key,
      r.summary,
      r.issueType,
      r.epic,
      r.assignee,
      r.startDate,
      r.dueDate,
      r.progress,
      r.status,
      r.dependencies
    ];

    cells.forEach((val, idx) => {
      const td = document.createElement('td');
      if (idx === 0) {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = val;
        link.style.color = 'var(--cp-link)';
        link.style.textDecoration = 'none';
        link.style.fontWeight = '600';
        link.addEventListener('click', (e) => openJiraIssueInNewTab(val, e));
        td.appendChild(link);
      } else {
        td.textContent = val;
      }
      tr.appendChild(td);
    });

    return tr;
  });

  tbody.replaceChildren(...trs);
}

let searchMatches = [];
let currentSearchMatchPos = -1;

function updateSearchHighlights() {
  const matchKeys = new Set(searchMatches.map(m => m.task.key));
  const activeKey = (currentSearchMatchPos >= 0 && currentSearchMatchPos < searchMatches.length)
    ? searchMatches[currentSearchMatchPos].task.key
    : null;

  // 1. Planner rows cached in rowCache
  if (rowCache) {
    for (const [key, tr] of rowCache.entries()) {
      if (matchKeys.has(key)) {
        tr.classList.add('is-search-match');
        if (key === activeKey) {
          tr.classList.add('is-search-active');
        } else {
          tr.classList.remove('is-search-active');
        }
      } else {
        tr.classList.remove('is-search-match', 'is-search-active');
      }
    }
  }

  // 2. Planner rows in DOM
  const plannerTbody = document.querySelector('#plannerTable tbody');
  if (plannerTbody) {
    plannerTbody.querySelectorAll('.task-row').forEach(tr => {
      const key = tr.dataset.taskId;
      if (key && matchKeys.has(key)) {
        tr.classList.add('is-search-match');
        if (key === activeKey) {
          tr.classList.add('is-search-active');
        } else {
          tr.classList.remove('is-search-active');
        }
      } else {
        tr.classList.remove('is-search-match', 'is-search-active');
      }
    });
  }

  // 3. Table View rows
  const tableTbody = document.getElementById('plainDataTableBody');
  if (tableTbody) {
    tableTbody.querySelectorAll('tr').forEach(tr => {
      const key = tr.dataset.taskKey;
      if (key && matchKeys.has(key)) {
        tr.classList.add('is-search-match');
        if (key === activeKey) {
          tr.classList.add('is-search-active');
        } else {
          tr.classList.remove('is-search-active');
        }
      } else {
        tr.classList.remove('is-search-match', 'is-search-active');
      }
    });
  }

  // 4. Redraw timeline to reflect matching status
  drawTimeline(true);
}

function scrollToSearchMatch(pos, takeFocus = false) {
  if (pos < 0 || pos >= searchMatches.length) return;
  const match = searchMatches[pos];
  const key = match.task.key;
  if (!key) return;

  // If the task sits under a collapsed parent or epic (at any level), expand them so it is visible in rowTasks
  if (expandAncestors(match.task)) {
    const computed = computeRowTasks();
    rowTasks = computed.rows;
    rowTaskList = rowTasks.map(r => r.task);
    updateVirtualRows();
  }

  if (currentView === 'table') {
    const tbody = document.getElementById('plainDataTableBody');
    if (tbody) {
      const tr = tbody.querySelector(`tr[data-task-key="${CSS.escape(key)}"]`);
      if (tr) {
        tr.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (takeFocus) tr.focus();
      }
    }
  } else {
    scrollRowIntoView(key);
    const rIdx = rowTasks.findIndex(r => r.task.key === key);
    if (rIdx >= 0) {
      gridFocus = { row: rIdx, col: 0 };
      if (takeFocus) {
        setGridFocus(rIdx, 0);
      }
    }
  }
}

function initInAppSearch() {
  const input = document.getElementById('inAppSearchInput');
  const count = document.getElementById('searchMatchCount');
  if (!input) return;

  input.addEventListener('input', () => {
    const query = input.value;
    const tasks = (currentPlan?.tasks && currentPlan.tasks.length > 0 ? currentPlan.tasks : (rowTasks || []).map(r => r.task));
    searchMatches = findMatchingTasks(tasks, query);
    currentSearchMatchPos = searchMatches.length > 0 ? 0 : -1;
    if (count) {
      count.textContent = formatMatchCount(query, searchMatches.length, currentSearchMatchPos);
    }
    updateSearchHighlights();
    if (searchMatches.length > 0) {
      scrollToSearchMatch(currentSearchMatchPos, false);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchMatches.length > 0) {
        const dir = e.shiftKey ? -1 : 1;
        currentSearchMatchPos = findNextMatch(searchMatches.map(m => m.index), currentSearchMatchPos, dir);
        if (count) {
          count.textContent = formatMatchCount(input.value, searchMatches.length, currentSearchMatchPos);
        }
        updateSearchHighlights();
        scrollToSearchMatch(currentSearchMatchPos, false);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (searchMatches.length > 0) {
        currentSearchMatchPos = findNextMatch(searchMatches.map(m => m.index), currentSearchMatchPos, 1);
        if (count) {
          count.textContent = formatMatchCount(input.value, searchMatches.length, currentSearchMatchPos);
        }
        updateSearchHighlights();
        scrollToSearchMatch(currentSearchMatchPos, false);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (searchMatches.length > 0) {
        currentSearchMatchPos = findNextMatch(searchMatches.map(m => m.index), currentSearchMatchPos, -1);
        if (count) {
          count.textContent = formatMatchCount(input.value, searchMatches.length, currentSearchMatchPos);
        }
        updateSearchHighlights();
        scrollToSearchMatch(currentSearchMatchPos, false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      input.value = '';
      searchMatches = [];
      currentSearchMatchPos = -1;
      if (count) count.textContent = '';
      updateSearchHighlights();
      input.blur();
      if (currentView === 'table') {
        const table = document.getElementById('plainDataTable');
        if (table) table.focus();
      } else {
        focusGridCell();
      }
    }
  });
}

function focusInAppSearch() {
  const input = document.getElementById('inAppSearchInput');
  if (input) {
    input.focus();
    input.select();
  }
}

function toggleBacklogTray() {
  const tray = document.getElementById('backlogTray');
  tray.classList.toggle('collapsed');
  setTimeout(syncGanttScrollWidth, 250);
  setTimeout(updateVirtualRows, 250);
}

function toggleColumnVisibility(colKey) {
  if (colKey === 'task') return; // Cannot hide required task identity column
  if (hiddenColumns.has(colKey)) {
    hiddenColumns.delete(colKey);
  } else {
    hiddenColumns.add(colKey);
  }
  onColumnsChanged();
}

function showAllColumns() {
  hiddenColumns.clear();
  onColumnsChanged();
}

function resetColumnDefaults() {
  hiddenColumns.clear();
  columnWidths = { ...DEFAULT_COLUMN_WIDTHS };
  compactTaskWidth = COMPACT_TASK_DEFAULT_WIDTH;
  onColumnsChanged();
  callResolver('saveColumnWidths', { columnWidths });
}

function onColumnsChanged() {
  try {
    if (currentPlan && currentPlan.projectKey) {
      localStorage.setItem('cascadeplan_hidden_cols_' + currentPlan.projectKey, JSON.stringify(Array.from(hiddenColumns)));
    }
  } catch (e) {}
  callResolver('saveHiddenColumns', { hiddenColumns: Array.from(hiddenColumns) });
  updateColumnManagerUI();
  renderTimelineHeader();
  renderTimelineRows();
  applyTimeAxis();
  setTimeout(syncGanttScrollWidth, 50);
}

function updateColumnManagerUI() {
  const visibleKeys = getVisibleColKeys();
  const badge = document.getElementById('colCountBadge');
  if (badge) {
    badge.textContent = `${visibleKeys.length}/${ALL_COLUMNS.length}`;
    if (hiddenColumns.size > 0) {
      badge.classList.add('has-hidden');
    } else {
      badge.classList.remove('has-hidden');
    }
  }

  // Update Alert Bar above table
  const alertBar = document.getElementById('hiddenColsAlertBar');
  const alertText = document.getElementById('hiddenColsText');
  if (alertBar && alertText) {
    // Compact (Key and Summary only) is a view the user chose with its own toggle, so it needs no warning.
    if (hiddenColumns.size > 0 && !isCompactMode()) {
      alertBar.style.display = 'flex';
      const hiddenNames = ALL_COLUMNS.filter(c => hiddenColumns.has(c.key)).map(c => c.label).join(', ');
      alertText.textContent = `${hiddenColumns.size} column${hiddenColumns.size > 1 ? 's' : ''} hidden (${hiddenNames}). Click Unhide All to restore them.`;
    } else {
      alertBar.style.display = 'none';
    }
  }

  // Render Checkbox List inside Popover
  const listContainer = document.getElementById('columnOptionsList');
  if (listContainer) {
    listContainer.innerHTML = '';
    ALL_COLUMNS.forEach(col => {
      const row = document.createElement('div');
      row.className = 'col-option-row' + (col.locked ? ' locked' : '');
      const isChecked = !hiddenColumns.has(col.key);

      row.innerHTML = html`
        <input type="checkbox" id="col_chk_${col.key}" ${isChecked ? 'checked' : ''} ${col.locked ? 'disabled' : ''} />
        <label for="col_chk_${col.key}" class="col-option-label ${col.locked ? 'is-locked' : ''}">
          <span>${col.icon}</span>
          <span>${col.label}</span>
          ${col.locked ? html`<span class="badge badge-neutral jx-badge-tiny">Required</span>` : ''}
        </label>
      `;

      if (!col.locked) {
        row.addEventListener('click', (e) => {
          if (e.target.tagName !== 'INPUT') {
            const chk = row.querySelector('input');
            if (chk) chk.checked = !chk.checked;
          }
          toggleColumnVisibility(col.key);
        });
      }
      listContainer.appendChild(row);
    });
  }
}

function openColumnHeaderMenu(e, colKey, colLabel) {
  const old = document.getElementById('columnHeaderContextMenu');
  if (old) old.remove();
  document.querySelectorAll('.th-col.is-menu-open').forEach(th => th.classList.remove('is-menu-open'));

  const activeTh = document.querySelector(`.th-col[data-col-key="${CSS.escape(colKey)}"]`);
  if (activeTh) activeTh.classList.add('is-menu-open');

  const menu = document.createElement('div');
  menu.id = 'columnHeaderContextMenu';
  menu.className = 'column-manager-popover';
  menu.style.width = '190px';
  menu.style.position = 'fixed';
  menu.style.left = Math.min(window.innerWidth - 210, e.clientX) + 'px';
  menu.style.top = (e.clientY + 12) + 'px';
  menu.style.zIndex = '1200';

  menu.innerHTML = html`
    <div class="jx-menu-caption">Column: ${colLabel}</div>
    <button class="btn btn-outline btn-sm jx-menu-btn-mb4" id="btnHideThisCol">
      🚫 Hide "${colLabel}"
    </button>
    <button class="btn btn-subtle btn-sm jx-menu-btn" id="btnManageAllFromHeader">
      ⚙ Manage All Columns...
    </button>
  `;

  document.body.appendChild(menu);

  const hideBtn = menu.querySelector('#btnHideThisCol');
  if (hideBtn) {
    hideBtn.addEventListener('click', () => {
      menu.remove();
      if (activeTh) activeTh.classList.remove('is-menu-open');
      toggleColumnVisibility(colKey);
    });
  }
  const manageBtn = menu.querySelector('#btnManageAllFromHeader');
  if (manageBtn) {
    manageBtn.addEventListener('click', () => {
      menu.remove();
      if (activeTh) activeTh.classList.remove('is-menu-open');
      const pop = document.getElementById('columnManagerPopover');
      if (pop) pop.style.display = 'flex';
    });
  }

  function onDocClick(ev) {
    if (!menu.contains(ev.target)) {
      menu.remove();
      if (activeTh) activeTh.classList.remove('is-menu-open');
      document.removeEventListener('click', onDocClick);
    }
  }
  setTimeout(() => document.addEventListener('click', onDocClick), 10);
}

/**
 * Runs a paged plan copy or delete to the end (N-02): each call does one page on the server.
 * Returns the last answer; `done` is true only when every page ran.
 */
async function finishPlanWork(resolverName, planId, label) {
  let res = null;
  for (let i = 0; i < 200; i++) {
    res = await callResolver(resolverName, { planId });
    if (!res || res.ok !== true || res.done === true) break;
    showFlag({ text: `${label}: ${res.remaining} records left.` });
  }
  return res;
}

// Deletes stopped earlier (a closed tab, a timeout) are finished once per load, by a plan approver.
const finishingDeletes = new Set();
function finishStoppedDeletes(plans) {
  if (planApprover !== true || !Array.isArray(plans)) return;
  for (const p of plans) {
    if (p.state !== 'deleting' || finishingDeletes.has(p.id)) continue;
    finishingDeletes.add(p.id);
    finishPlanWork('continuePlanDelete', p.id, `Deleting plan ${p.name}`).finally(() => finishingDeletes.delete(p.id));
  }
}

let currentPlanCategoryFilter = 'all';
let currentPlanSearchQuery = '';

function updatePlansUI(availablePlans = [], currentId = 'default') {
  const switcher = document.getElementById('planSwitcher');
  const listed = Array.isArray(availablePlans) ? availablePlans.filter(p => p.state !== 'deleting') : [];
  const plans = listed.length > 0 ? listed : [{ id: 'default', name: 'Main Plan', isDefault: true }];
  finishStoppedDeletes(availablePlans);

  if (switcher) {
    switcher.innerHTML = '';
    for (const p of plans) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === currentId) opt.selected = true;
      switcher.appendChild(opt);
    }
  }

  const activePlan = plans.find(p => p.id === currentId) || plans[0];
  const labelEl = document.getElementById('planSelectorLabel');
  if (labelEl) {
    labelEl.textContent = activePlan ? activePlan.name : 'Main Plan';
  }

  const allCount = plans.length;
  const scenarioCount = plans.filter(p => categorizePlan(p) === 'scenario').length;

  const countAllEl = document.getElementById('planTabCountAll');
  if (countAllEl) countAllEl.textContent = String(allCount);
  const countScenariosEl = document.getElementById('planTabCountScenarios');
  if (countScenariosEl) countScenariosEl.textContent = String(scenarioCount);

  renderFilteredPlansList(plans, currentId);
}

// Plan approver rights decide whether plan management is offered (BL-2 step 8). The server checks
// every plan write again; this only avoids offering actions that would be refused.
let planApprover = null;
async function loadPlanApprover() {
  if (planApprover !== null) return planApprover;
  const res = await rawCallResolver('checkPlanApprover', { planId: activePlanId });
  planApprover = !!(res && res.ok === true && res.isApprover === true);
  applyPlanApproverToCreateForm();
  // The list may have been drawn before the answer arrived.
  if (currentPlan && Array.isArray(currentPlan.availablePlans)) renderFilteredPlansList(currentPlan.availablePlans, activePlanId);
  return planApprover;
}

function applyPlanApproverToCreateForm() {
  const nameInp = document.getElementById('newPlanNameInput');
  const btn = document.getElementById('btnCreatePlan');
  const allowed = planApprover === true;
  for (const el of [nameInp, btn]) {
    if (!el) continue;
    el.disabled = !allowed;
    el.title = allowed ? '' : 'Only plan approvers (project or Jira administrators, or an approver group) create plans.';
  }
  renderPlanFilter();
}

// The JQL filter of the open plan (F-27): everyone sees it, plan approvers change it.
function renderPlanFilter() {
  const inp = document.getElementById('planJqlInput');
  const btn = document.getElementById('btnSavePlanJql');
  if (!inp || !btn) return;
  if (document.activeElement !== inp) inp.value = (currentPlan && currentPlan.jqlFilter) || '';
  const allowed = planApprover === true;
  inp.readOnly = !allowed;
  btn.hidden = !allowed;
  inp.title = allowed ? '' : 'Only plan approvers change the filter of a plan.';
}

async function savePlanFilter() {
  const inp = document.getElementById('planJqlInput');
  const btn = document.getElementById('btnSavePlanJql');
  if (!inp || !btn || planApprover !== true) return;
  btn.disabled = true;
  const res = await callResolver('setPlanFilter', { filter: inp.value });
  btn.disabled = false;
  if (res && res.ok) {
    const text = res.filter
      ? `Filter saved. About ${res.count ?? 'an unknown number of'} work items match it.`
      : 'Filter removed. The plan reads the whole project.';
    showFlag({ text });
    await loadProjectPlan();
  } else {
    showFlag({ text: res?.message || 'The filter was not saved.', error: true });
  }
}

function renderFilteredPlansList(plans, currentId) {
  const container = document.getElementById('plansListContainer');
  if (!container) return;
  container.innerHTML = '';

  const viewModels = buildPlanListViewModel(plans, currentId);
  const filtered = filterPlans(viewModels, currentPlanSearchQuery, currentPlanCategoryFilter);

  if (filtered.length === 0) {
    const emptyRow = document.createElement('div');
    emptyRow.style.padding = '16px';
    emptyRow.style.textAlign = 'center';
    emptyRow.style.color = 'var(--cp-text-subtle)';
    emptyRow.style.fontSize = '12px';
    emptyRow.textContent = currentPlanSearchQuery
      ? `No plans matching "${currentPlanSearchQuery}"`
      : 'No plans in this category';
    container.appendChild(emptyRow);
    return;
  }

  const allNames = plans.map(p => p.name);

  for (const p of filtered) {
    const row = document.createElement('div');
    row.className = 'plan-item-row' + (p.isActive ? ' is-active' : '');
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.title = p.isActive ? `${p.name} (Active plan)` : `Switch to ${p.name}`;

    const mainDiv = document.createElement('div');
    mainDiv.className = 'plan-item-main';

    const catBadge = document.createElement('span');
    catBadge.className = 'plan-category-badge ' + (p.category === 'main' ? 'is-baseline' : 'is-scenario');
    catBadge.textContent = p.category === 'main' ? 'Main' : 'Scenario';
    mainDiv.appendChild(catBadge);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'plan-item-name';
    nameSpan.textContent = p.name;
    mainDiv.appendChild(nameSpan);
    if (p.copying) {
      const note = document.createElement('span');
      note.className = 'plan-item-note';
      note.textContent = 'copy not finished';
      mainDiv.appendChild(note);
    }

    if (p.isActive) {
      const activeCheck = document.createElement('span');
      activeCheck.style.fontSize = '12px';
      activeCheck.style.color = 'var(--cp-text-brand)';
      activeCheck.textContent = '✓';
      mainDiv.appendChild(activeCheck);
    }

    row.appendChild(mainDiv);

    const actions = document.createElement('div');
    actions.className = 'plan-item-actions';

    const btnClone = document.createElement('button');
    btnClone.className = 'btn btn-subtle btn-xs';
    btnClone.textContent = '📑';
    btnClone.title = 'Duplicate / Clone this plan';
    btnClone.type = 'button';
    btnClone.addEventListener('click', async (e) => {
      e.stopPropagation();
      const cloneName = suggestCloneName(p.name, allNames);
      btnClone.disabled = true;
      const res = await callResolver('createProjectPlan', {
        name: cloneName,
        cloneFromPlanId: p.id
      });
      const copied = res && res.ok && res.plan && res.done === false
        ? await finishPlanWork('continuePlanCopy', res.plan.id, `Copying to ${res.plan.name}`) : res;
      if (res && res.ok && res.plan && !(copied && copied.ok && copied.done !== false)) {
        showFlag({ text: `The copy to ${res.plan.name} stopped. Pick it in the plan list to finish it.`, error: true });
        btnClone.disabled = false;
        await loadProjectPlan();
      } else if (res && res.ok && res.plan) {
        setActivePlan(res.plan.id);
        showFlag({ text: `Cloned plan to ${res.plan.name}.` });
        closePlansPopover();
        await loadProjectPlan();
      } else {
        showFlag({ text: res?.message || 'Failed to clone plan.', error: true });
        btnClone.disabled = false;
      }
    });
    // Clone, rename and delete are plan management: only plan approvers see them (BL-2 step 8).
    if (planApprover === true) actions.appendChild(btnClone);

    if (p.canDelete && planApprover === true) {
      const btnRename = document.createElement('button');
      btnRename.className = 'btn btn-subtle btn-xs';
      btnRename.textContent = '✏️';
      btnRename.title = 'Rename plan';
      btnRename.type = 'button';
      btnRename.addEventListener('click', (e) => {
        e.stopPropagation();
        if (row.querySelector('.plan-rename-input')) return;
        const origName = p.name;
        const renameInp = document.createElement('input');
        renameInp.type = 'text';
        renameInp.className = 'in-app-search-input plan-rename-input';
        renameInp.value = origName;
        renameInp.style.flex = '1';
        renameInp.style.fontSize = '12px';
        nameSpan.replaceWith(renameInp);
        renameInp.focus();
        renameInp.select();

        const finish = async (save) => {
          const newName = renameInp.value.trim();
          if (save && newName && newName !== origName) {
            const res = await callResolver('renameProjectPlan', { planId: p.id, name: newName });
            if (res && res.ok) {
              showFlag({ text: `Renamed plan to ${newName}.` });
              await loadProjectPlan();
            } else {
              showFlag({ text: res?.message || 'Failed to rename plan.', error: true });
              renameInp.replaceWith(nameSpan);
            }
          } else {
            renameInp.replaceWith(nameSpan);
          }
        };

        renameInp.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') finish(true);
          if (ke.key === 'Escape') finish(false);
        });
        renameInp.addEventListener('blur', () => finish(true));
      });
      actions.appendChild(btnRename);

      const btnDel = document.createElement('button');
      btnDel.className = 'btn btn-subtle btn-xs';
      btnDel.textContent = '🗑️';
      btnDel.title = 'Delete plan';
      btnDel.type = 'button';
      btnDel.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (btnDel.dataset.confirming === 'true') {
          const first = await callResolver('deleteProjectPlan', { planId: p.id });
          const res = first && first.ok && first.done === false
            ? await finishPlanWork('continuePlanDelete', p.id, `Deleting plan ${p.name}`) : first;
          if (res && res.ok) {
            showFlag({ text: `Deleted plan ${p.name}.` });
            if (activePlanId === p.id) {
              setActivePlan(MAIN_PLAN_ID);
            }
            await loadProjectPlan();
          } else {
            showFlag({ text: res?.message || 'Failed to delete plan.', error: true });
          }
        } else {
          btnDel.dataset.confirming = 'true';
          btnDel.textContent = 'Confirm?';
          btnDel.className = 'btn btn-danger btn-xs';
          setTimeout(() => {
            btnDel.dataset.confirming = 'false';
            btnDel.textContent = '🗑️';
            btnDel.className = 'btn btn-subtle btn-xs';
          }, 4000);
        }
      });
      actions.appendChild(btnDel);
    }

    row.appendChild(actions);

    row.addEventListener('click', async (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      if (p.copying) {
        if (planApprover !== true) { showFlag({ text: `${p.name} is still being copied. A plan approver can finish the copy.` }); return; }
        const done = await finishPlanWork('continuePlanCopy', p.id, `Copying to ${p.name}`);
        if (!(done && done.ok && done.done !== false)) { showFlag({ text: done?.message || `The copy to ${p.name} stopped. Try again.`, error: true }); return; }
      }
      if (p.id !== currentId) {
        setActivePlan(p.id);
        closePlansPopover();
        await loadProjectPlan();
        showFlag({ text: `Switched to plan ${p.name}.` });
      }
    });

    // The keyboard does what a click does, an unfinished copy included.
    row.addEventListener('keydown', (ke) => {
      if (ke.target !== row) return;
      if (ke.key === 'Enter' || ke.key === ' ') {
        ke.preventDefault();
        row.click();
      }
    });

    container.appendChild(row);
  }
}

function closePlansPopover() {
  const pop = document.getElementById('plansManagerPopover');
  if (pop) pop.style.display = 'none';
  const trigger = document.getElementById('planSelectorBtn');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

async function loadProjectPlan() {
  const loader = document.getElementById('plannerLoadingIndicator');
  const errBanner = document.getElementById('plannerErrorBanner');
  if (loader) loader.style.display = 'flex';
  if (errBanner) errBanner.style.display = 'none';

  const plan = await callResolver('getProjectPlan', { planId: activePlanId });
  if (loader) loader.style.display = 'none';

  // The Jira search failed: say why instead of showing an empty project (F-21).
  if (plan && Array.isArray(plan.tasks) && plan.isLiveSynced === false) {
    if (errBanner) {
      errBanner.style.display = 'flex';
      const msg = document.getElementById('plannerErrorMsg');
      if (msg) msg.textContent = (plan.jiraStatus === 401 || plan.jiraStatus === 403)
        ? 'You cannot browse this project in Jira, so CascadePlan cannot show its plan.'
        : 'Jira is not reachable right now, so the plan cannot be shown. Click Retry in a moment.';
    }
    return;
  }

  if (plan && Array.isArray(plan.tasks)) {
    // The Forge context could not be read at start-up: scope by project key and reopen the saved plan once.
    if (!planScope && plan.projectKey) {
      planScope = String(plan.projectKey);
      const saved = chooseActivePlan(getSavedPlanId(browserStore(), planScope), plan.availablePlans);
      if (saved !== (plan.planId || MAIN_PLAN_ID)) {
        activePlanId = saved;
        return loadProjectPlan();
      }
    }
    // The server answers with the plan it read; a plan deleted elsewhere falls back to the Main Plan.
    const requested = activePlanId;
    const served = chooseActivePlan(plan.planId || MAIN_PLAN_ID, plan.availablePlans);
    if (requested !== MAIN_PLAN_ID && served !== requested) {
      showFlag({ text: 'The plan you had open no longer exists. Showing the Main Plan.' });
    }
    mergeOptimisticTasks(plan);
    currentPlan = plan;
    setActivePlan(served);
    updatePlansUI(plan.availablePlans, activePlanId);
    notePlanOnlyLinks(plan);
    // The active baseline comes with the plan load (ADR-009); the status follows every later change.
    if (plan.baselineStatus !== undefined) baselineState = plan.baselineStatus;
    updateBaselineButton();
    columnWidths = sanitizeLoadedColumnWidths(plan.columnWidths);
    if (Array.isArray(plan.hiddenColumns)) {
      hiddenColumns = new Set(plan.hiddenColumns);
    } else {
      try {
        const cached = localStorage.getItem('cascadeplan_hidden_cols_' + plan.projectKey);
        if (cached) hiddenColumns = new Set(JSON.parse(cached));
      } catch (e) {}
    }
    updateColumnManagerUI();
    renderPlan();
    settleUndo();
    // Opening the planner writes and deletes nothing. Records of deleted issues are removed by the
    // issue-deleted trigger on the server (BL-9).
    void loadPlanApprover();
  } else {
    if (errBanner) {
      errBanner.style.display = 'flex';
      const msg = document.getElementById('plannerErrorMsg');
      // The real cause, not a generic connection message (F-21).
      if (msg) msg.textContent = plan && plan.error === 'license_required'
        ? 'A CascadePlan licence is required on this site. Ask your Jira administrator.'
        : (plan && plan.message) || 'Unable to synchronize with Jira. Please verify your connection or click Retry.';
    }
  }
}

function renderPlan() {
  if (!currentPlan) return;
  renderPlanSummary();

  const newEpicBtn = document.getElementById('newEpicBtn');
  if (newEpicBtn) {
    if (currentPlan.hasEpic === false) {
      newEpicBtn.style.display = 'none';
      newEpicBtn.title = 'Epics are not enabled in this project type';
    } else {
      newEpicBtn.style.display = '';
      newEpicBtn.title = '';
    }
  }

  // Collapsed parents stay collapsed across renders; keys no longer in the plan are forgotten.
  if (currentPlan.tasks && collapsedTasks.size) {
    const keys = new Set(currentPlan.tasks.map(t => t.key));
    for (const k of [...collapsedTasks]) if (!keys.has(k)) collapsedTasks.delete(k);
  }

  renderMilestones();
  renderBacklogTray();
  coverPlanDates();
  renderTimelineHeader();
  renderTimelineRows();
  applyTimeAxis();
  // Measured once the rows are in: the rendered data columns, padding and borders included.
  if (decideCompactColumns()) {
    renderTimelineHeader();
    renderTimelineRows();
    applyTimeAxis();
  }
  setTimeout(syncGanttScrollWidth, 50);
  if (!hasInitialScrolledToToday) {
    hasInitialScrolledToToday = true;
    setTimeout(scrollToToday, 250);
  }
  if (currentView === 'table') {
    renderTableView();
  }
}

const HINT_KEY = 'cascadeplan_hint_link';

/** The first-link hint (B-25): shown until the plan has a link or the user dismisses it. */
function updateLinkHint() {
  const hint = document.getElementById('linkHint');
  if (!hint || !currentPlan) return;
  if ((currentPlan.tasks || []).some(t => t.dependency && t.dependency.predecessorKey)) writePref(HINT_KEY, 'done');
  hint.hidden = !showLinkHint(currentPlan, readPref(HINT_KEY, null));
}

function openHelp() {
  const pop = document.getElementById('helpPopup');
  if (!pop) return;
  pop.hidden = false;
  document.getElementById('btnCloseHelp')?.focus();
}

function closeHelp() {
  const pop = document.getElementById('helpPopup');
  if (pop) pop.hidden = true;
}

/** Header badges, backlog count, truncation note and legend. */
function renderPlanSummary() {
  updateLinkHint();
  fillAssigneeOptions();
  // Badges are empty and hidden until real values arrive (B-18: no fixed text before load).
  const projectBadge = document.getElementById('projectBadge');
  projectBadge.textContent = currentPlan.projectKey;
  projectBadge.hidden = false;
  const completionBadge = document.getElementById('completionBadge');
  completionBadge.textContent = `${currentPlan.overallProjectCompletion}% (${currentPlan.overallTargetCompletion}%)`;
  completionBadge.hidden = false;
  document.getElementById('backlogCount').textContent = currentPlan.backlogTasks ? currentPlan.backlogTasks.length : 0;
  const truncatedNote = document.getElementById('truncatedNote');
  if (truncatedNote) {
    // More issues exist than one plan reads (B-10).
    // With a plan filter, the count is of the work items that match it (F-27).
    truncatedNote.hidden = !currentPlan.truncated;
    truncatedNote.textContent = currentPlan.truncated
      ? `Showing the newest ${currentPlan.truncated.shown} of about ${currentPlan.truncated.total} issues${currentPlan.jqlFilter ? ' that match this plan\'s filter' : '. A plan approver can narrow the plan with a JQL filter in the plan list'}`
      : '';
  }
  renderPlanFilter();

  const curWk = (currentPlan.weeks || []).find(w => w.isCurrentWeek);
  if (curWk) {
    const el = document.getElementById('legendCurrentWeek');
    if (el) el.textContent = `Current Week (${curWk.weekKey})`;
  }
}

function renderMilestones() {
  const strip = document.getElementById('milestonesStrip');
  strip.innerHTML = '';
  (currentPlan.milestones || []).forEach(m => {
    const el = document.createElement('div');
    el.className = 'milestone-pill';
    el.innerHTML = html`<span class="milestone-icon">🔷</span><span>${m.title}</span><span class="jx-subtle">(${m.weekKey})</span>`;
    strip.appendChild(el);
  });
}

function renderBacklogTray() {
  const container = document.getElementById('backlogCardsList');
  container.innerHTML = '';

  const backlog = currentPlan.backlogTasks || [];
  if (backlog.length === 0) {
    container.innerHTML = '<div class="jx-empty-tray">No unmapped backlog issues. Drag from timeline to unmap.</div>';
    return;
  }

  backlog.forEach(item => {
    const card = document.createElement('div');
    card.className = 'backlog-card';
    card.draggable = true;

    const isEpicCard = item.isEpic || item.hierarchyLevel === 1;
    const isSubCard = item.isSubtask || item.hierarchyLevel === -1;
    const badgeLabel = isEpicCard ? '🟪 EPIC' : (isSubCard ? '↳ Subtask' : (item.story || 'Task'));
    const badgeClass = isEpicCard ? 'badge-primary' : 'badge-neutral';
    const effortDisplay = formatEffort(item.effortHours);

    const siteUrl = getJiraBaseUrl();
    card.innerHTML = html`
      <div class="backlog-card-header">
        <a href="${siteUrl}/browse/${item.key}" target="_blank" rel="noopener noreferrer" class="backlog-key-link" title="Open ${item.key} in native Jira (new tab)">${item.key} ↗</a>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="backlog-summary" title="${item.summary}">${item.summary}</div>
      <div class="backlog-footer">
        <span>⏱️ ${effortDisplay}</span>
        <span>👤 ${item.resource || 'Unassigned'}</span>
        <button type="button" class="btn btn-outline btn-sm btn-schedule-backlog jx-schedule-btn" title="Schedule onto timeline">+ Schedule</button>
      </div>
    `;
    const bKeyLink = card.querySelector('.backlog-key-link');
    if (bKeyLink) {
      bKeyLink.addEventListener('click', (e) => {
        openJiraIssueInNewTab(item.key, e);
      });
    }
    const btnSched = card.querySelector('.btn-schedule-backlog');
    if (btnSched) {
      btnSched.addEventListener('click', async (e) => {
        e.stopPropagation();
        btnSched.disabled = true;
        btnSched.textContent = 'Scheduling...';
        try {
          const res = await callResolver('scheduleBacklogTask', {
            taskId: item.key,
            startWeek: '',
            startDate: todayIso(),
            spanWeeks: 3
          });
          if (res && Array.isArray(res.tasks)) {
            currentPlan = res;
            renderPlan();
          } else {
            await loadProjectPlan();
          }
          if (res && res.ok === true) showFlag({ text: 'Scheduled ' + item.key + ' to timeline.' });
        } catch (err) {
          showFlag({ text: 'Failed to schedule ' + item.key, error: true });
        }
      });
    }
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: item.key, effortHours: item.effortHours }));
      document.body.classList.add('is-dragging-backlog');
      updateVirtualRows();
    });
    card.addEventListener('dragend', () => {
      document.body.classList.remove('is-dragging-backlog');
      updateVirtualRows();
    });
    container.appendChild(card);
  });
}

function renderTimelineHeader() {
  const tr = document.getElementById('ganttHeaderRow');
  tr.innerHTML = '';
  const frozen = getFrozenLayout();
  try { document.documentElement.style.setProperty('--cp-frozen-w', frozen.totalWidth + 'px'); } catch (e) {}

  frozen.visibleKeys.forEach(k => {
    const colDef = ALL_COLUMNS.find(c => c.key === k) || { label: k, locked: false };
    const th = document.createElement('th');
    th.className = 'th-col th-frozen' + (k === frozen.lastKey ? ' is-last-frozen' : '');
    th.setAttribute('data-col-key', k);
    const w = frozen.widths[k];
    th.style.width = w + 'px';
    th.style.minWidth = w + 'px';
    th.style.maxWidth = w + 'px';
    th.style.left = frozen.offsets[k] + 'px';

    th.innerHTML = html`
      <div class="th-content-wrap">
        <span class="th-label-text">${colDef.label}</span>
        ${!colDef.locked ? html`<button class="th-col-menu-btn" data-col-key="${k}" title="Column options (Hide ${colDef.label})" aria-label="Column options for ${colDef.label}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg></button>` : ''}
      </div>
    `;

    const menuBtn = th.querySelector('.th-col-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openColumnHeaderMenu(e, k, colDef.label);
      });
    }

    // Resizer Handle
    const resizer = document.createElement('div');
    resizer.className = 'resizer col-resizer';
    setupColumnResizer(resizer, k);
    th.appendChild(resizer);
    tr.appendChild(th);
  });

  // One timeline column; its cells come from the time scale of the current zoom (B-27).
  const th = document.createElement('th');
  th.className = 'timeline-header-cell';
  const strip = document.createElement('div');
  strip.className = 'time-strip';
  th.appendChild(strip);
  tr.appendChild(th);
  renderTimeStrip();
}

function renderTimeStrip() {
  const strip = document.querySelector('#ganttHeaderRow .time-strip');
  if (!strip || !timeRange) return;
  const cells = headerCells(timeRange, zoomById(zoomId), todayIso()).map(c => {
    const el = document.createElement('div');
    el.className = 'time-cell' + (c.current ? ' current' : '');
    el.style.left = c.x + 'px';
    el.style.width = c.w + 'px';
    el.textContent = c.label;
    el.title = c.key;
    return el;
  });
  strip.replaceChildren(...cells);
}

/** At first render, keep all columns visible by default unless explicitly hidden by user. */
function decideCompactColumns() {
  compactDecided = true;
  return false;
}

/** Calculates a bounded time range with 1 month buffer before earliest date, 1 month buffer after latest date, and fills the screen width */
function computeBoundedTimeRange() {
  const today = todayIso();
  const dates = (currentPlan?.tasks || [])
    .flatMap(t => [t.startDate, t.endDate])
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d || ''));

  dates.push(today);
  const minDate = dates.reduce((m, d) => (d < m ? d : m));
  const maxDate = dates.reduce((m, d) => (d > m ? d : m));

  // Exactly 1 month buffer (28 days / 4 weeks) before earliest date, snapped to Monday
  const start = mondayOf(addDaysIso(minDate, -28));

  // Exactly 1 month buffer (28 days / 4 weeks) after latest date, snapped to Sunday
  let end = addDaysIso(mondayOf(addDaysIso(maxDate, 28)), 6);

  // Fills screen width requirement (no horizontal blank voids)
  const wrapper = document.getElementById('ganttWrapper');
  const trackLeft = (layout && layout.trackLeft) || 300;
  const viewportTrackWidth = wrapper && wrapper.clientWidth ? Math.max(400, wrapper.clientWidth - trackLeft) : 800;
  const currentPx = rangeDays({ start, end }) * dayPx();

  if (currentPx < viewportTrackWidth) {
    const missingPx = viewportTrackWidth - currentPx;
    const missingDays = Math.ceil(missingPx / dayPx());
    const missingWeeks = Math.ceil(missingDays / 7);
    end = addDaysIso(end, missingWeeks * 7);
  }

  return { start, end };
}

function coverPlanDates() {
  timeRange = computeBoundedTimeRange();
}

/** Width, header, bar hit positions and canvas after a zoom or range change. */
function applyTimeAxis() {
  const table = document.getElementById('ganttTable');
  const wrapper = document.getElementById('ganttWrapper');
  if (!table || !timeRange) return;
  table.style.setProperty('--cp-track-w', trackWidth() + 'px');
  if (wrapper) {
    wrapper.dataset.origin = timeRange.start;
    wrapper.dataset.dayPx = String(dayPx());
  }
  renderTimeStrip();
  for (const [key, tr] of rowCache) {
    const hit = tr.querySelector('.bar-hit');
    const t = findTask(key);
    if (hit && t) positionBarHit(hit, t);
  }
  measureLayout();
  drawTimeline(true);
}

/** Sets the timeline scroll position directly on ganttWrapper */
function setTimelineScrollLeft(x) {
  const w = document.getElementById('ganttWrapper');
  if (w) w.scrollLeft = x;
}

/** Passive scrolling is strictly bounded to the 1-month buffered timeline; no infinite whitespace extension. */
function maybeExtendRange() {
  // Bounded timeline navigation: no infinite auto-extension during passive scrolling
  return;
}

/** Changes the zoom and keeps the focused issue (or the date in the middle) in view (B-27 criterion 1). */
function setZoom(id) {
  const w = document.getElementById('ganttWrapper');
  if (!w || !timeRange || id === zoomId) return;
  const vw = w.clientWidth - layout.trackLeft;
  const key = lastGridKey || pinnedDependencyTaskId;
  const t = key && findTask(key);
  const vx = t && t.startDate ? vw / 3 : vw / 2;
  const anchor = t && t.startDate ? t.startDate : dateAt(w.scrollLeft + vx, timeRange.start, dayPx());
  zoomId = id;
  writePref(ZOOM_KEY, id);
  const need = Math.ceil(vw / dayPx()) + 7;
  while (daysBetween(timeRange.start, anchor) < need) timeRange = extendRange(timeRange, 'before', EXTEND_WEEKS);
  while (daysBetween(anchor, timeRange.end) < need) timeRange = extendRange(timeRange, 'after', EXTEND_WEEKS);
  applyTimeAxis();
  setTimelineScrollLeft(Math.max(0, anchorScroll(anchor, vx, timeRange.start, dayPx())));
  updateZoomButtons();
  drawTimeline(true);
}

function updateZoomButtons() {
  document.querySelectorAll('#zoomGroup [data-zoom]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.zoom === zoomId)));
  const compact = document.getElementById('btnCompactColumns');
  if (compact) compact.setAttribute('aria-pressed', String(isCompactMode()));
}

function setCompactColumns(on) {
  if (on) {
    hiddenColumns = new Set(ALL_COLUMNS.filter(c => c.key !== 'task').map(c => c.key));
  } else {
    hiddenColumns.clear();
  }
  onColumnsChanged();
}

function applyColumnWidthsToDom() {
  const frozen = getFrozenLayout();
  try { document.documentElement.style.setProperty('--cp-frozen-w', frozen.totalWidth + 'px'); } catch (e) {}
  const thList = document.querySelectorAll('#ganttHeaderRow .th-col');
  thList.forEach((th, i) => {
    const k = frozen.visibleKeys[i];
    if (!k) return;
    const w = frozen.widths[k];
    th.classList.toggle('is-last-frozen', k === frozen.lastKey);
    th.style.width = w + 'px';
    th.style.minWidth = w + 'px';
    th.style.maxWidth = w + 'px';
    th.style.left = frozen.offsets[k] + 'px';
  });

  const visited = new Set();
  for (const tr of rowCache.values()) {
    visited.add(tr);
    applyFrozen(tr);
  }
  document.querySelectorAll('#ganttBody tr.task-row, #ganttBody tr.inline-creation-row').forEach(tr => {
    if (!visited.has(tr)) applyFrozen(tr);
  });
}

function setupColumnResizer(resizer, colKey) {
  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidth(colKey);
    resizer.classList.add('is-resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(moveEvent) {
      const nextWidth = clampColumnResize(colKey, startWidth + (moveEvent.clientX - startX));
      if (isCompactMode() && colKey === 'task') {
        compactTaskWidth = nextWidth;
      } else {
        columnWidths[colKey] = nextWidth;
      }
      applyColumnWidthsToDom();
      measureLayout();
      drawTimeline(true);
      syncGanttScrollWidth();
    }

    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      resizer.classList.remove('is-resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      applyColumnWidthsToDom();
      measureLayout();
      drawTimeline(true);
      syncGanttScrollWidth();
      if (!(isCompactMode() && colKey === 'task')) {
        callResolver('saveColumnWidths', { columnWidths });
      }
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}

let activePickerTaskKey = null;

function getInitials(name) {
  if (!name || name === 'Unassigned') return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Resolves all unique contributing resources for a task (parent assignee + subtask assignees)
function getTaskContributingResources(task) {
  if (!task) return [];
  const resMap = new Map(); // name -> { name: string, isParent: boolean, subtasks: string[] }

  // 1. Parent issue assignee
  if (task.resource && task.resource !== 'Unassigned' && task.resource !== 'Unallocated') {
    resMap.set(task.resource, { name: task.resource, isParent: true, subtasks: [] });
  }

  // 2. Child subtasks in currentPlan.tasks (WbsHierarchy children)
  if (currentPlan && Array.isArray(currentPlan.tasks)) {
    currentPlan.tasks.forEach(t => {
      if (t.parentKey === task.key && t.isSubtask && t.resource && t.resource !== 'Unassigned' && t.resource !== 'Unallocated') {
        if (!resMap.has(t.resource)) {
          resMap.set(t.resource, { name: t.resource, isParent: false, subtasks: [t.key] });
        } else {
          const entry = resMap.get(t.resource);
          if (!entry.subtasks.includes(t.key)) entry.subtasks.push(t.key);
        }
      }
    });
  }

  // 3. Embedded subtasks array on task
  if (Array.isArray(task.subtasks)) {
    task.subtasks.forEach(s => {
      if (s.assignee && s.assignee !== 'Unassigned' && s.assignee !== 'Unallocated') {
        const subIdent = s.key || s.summary || 'Subtask';
        if (!resMap.has(s.assignee)) {
          resMap.set(s.assignee, { name: s.assignee, isParent: false, subtasks: [subIdent] });
        } else {
          const entry = resMap.get(s.assignee);
          if (!entry.subtasks.includes(subIdent)) entry.subtasks.push(subIdent);
        }
      }
    });
  }

  // 4. Backend calculated contributingResources list
  if (Array.isArray(task.contributingResources)) {
    task.contributingResources.forEach(name => {
      if (name && name !== 'Unassigned' && name !== 'Unallocated' && !resMap.has(name)) {
        resMap.set(name, { name, isParent: false, subtasks: [] });
      }
    });
  }

  return Array.from(resMap.values());
}

function closeAllPopovers() {
  const resPopover = document.getElementById('resourcePickerPopover');
  if (resPopover) resPopover.style.display = 'none';
  const statPopover = document.getElementById('statusPickerPopover');
  if (statPopover) statPopover.style.display = 'none';
  const epicPopover = document.getElementById('epicPickerPopover');
  if (epicPopover) epicPopover.style.display = 'none';
  const progPopover = document.getElementById('progressPickerPopover');
  if (progPopover) progPopover.style.display = 'none';
  const targetPopover = document.getElementById('targetPickerPopover');
  if (targetPopover) targetPopover.style.display = 'none';
  const colMenu = document.getElementById('columnHeaderContextMenu');
  if (colMenu) colMenu.remove();
  document.querySelectorAll('.th-col.is-menu-open').forEach(th => th.classList.remove('is-menu-open'));
  if (typeof closeDependencyEditPopover === 'function') closeDependencyEditPopover();
  if (typeof closeDependencyConflictDialog === 'function') closeDependencyConflictDialog();
  const plansPop = document.getElementById('plansManagerPopover');
  if (plansPop) plansPop.style.display = 'none';
  const rowMore = document.getElementById('rowMoreMenu');
  if (rowMore) rowMore.style.display = 'none';
}

function openResourcePicker(targetEl, taskKey) {
  closeAllPopovers();
  activePickerTaskKey = taskKey;
  const popover = document.getElementById('resourcePickerPopover');
  const searchInput = document.getElementById('resourcePickerSearch');
  const listEl = document.getElementById('resourcePickerList');
  const currentContainer = document.getElementById('resourcePickerCurrent');
  const titleText = document.getElementById('resourcePickerTitleText');
  const badge = document.getElementById('resourcePickerBadge');
  const btnDone = document.getElementById('btnResourceDone');
  const btnClearAll = document.getElementById('btnResourceClearAll');

  const isInlineDraft = (activePickerTaskKey === 'NEW_INLINE_TASK');
  const curTask = !isInlineDraft
    ? (currentPlan?.tasks || []).find(t => t.key === activePickerTaskKey)
    : null;

  // Position the popover
  const rect = targetEl.getBoundingClientRect();
  popover.style.display = 'flex';
  const popoverHeight = 320;
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
    popover.style.top = Math.max(10, rect.top - popoverHeight) + 'px';
  } else {
    popover.style.top = (rect.bottom + 4) + 'px';
  }
  popover.style.left = Math.min(window.innerWidth - 340, Math.max(10, rect.left)) + 'px';

  if (titleText) {
    titleText.textContent = isInlineDraft ? 'Assign Resource' : `Assign Team (${taskKey})`;
  }

  // Track contributing resources for current task
  let assignedResources = []; // array of { name: string, isParent: boolean, accountId?: string }
  if (curTask) {
    const contributing = getTaskContributingResources(curTask);
    assignedResources = contributing.map(c => ({
      name: c.name,
      isParent: Boolean(c.isParent),
      accountId: (currentPlan?.availableUsers || []).find(u => u.displayName === c.name)?.accountId
    }));
  }

  function updateHeaderBadge() {
    if (!badge) return;
    if (isInlineDraft) {
      badge.style.display = 'none';
    } else {
      badge.style.display = 'inline-flex';
      const count = assignedResources.length;
      badge.textContent = `${count} assigned`;
      if (count === 0) {
        badge.className = 'badge badge-neutral';
      } else if (count === 1) {
        badge.className = 'badge badge-primary';
      } else {
        badge.className = 'badge badge-success';
      }
    }
  }

  function renderCurrentChips() {
    if (!currentContainer) return;
    if (isInlineDraft || assignedResources.length === 0) {
      currentContainer.style.display = 'none';
      currentContainer.innerHTML = '';
      return;
    }

    currentContainer.style.display = 'flex';
    currentContainer.innerHTML = '<div class="jx-picker-caption">Assigned Team:</div>';

    assignedResources.forEach(res => {
      const chip = document.createElement('div');
      chip.className = 'resource-current-chip' + (res.isParent ? ' is-lead' : '');
      const initials = getInitials(res.name);
      chip.innerHTML = html`
        <span class="resource-option-avatar jx-avatar-small">${initials}</span>
        <span>${res.name}</span>
        <span class="jx-lead-note">${res.isParent ? '(Lead)' : ''}</span>
        ${!res.isParent ? html`<button class="resource-btn-make-lead" title="Make primary Jira assignee">★ Lead</button>` : ''}
        <span class="resource-current-chip-remove" title="Remove ${res.name}">✕</span>
      `;

      const removeBtn = chip.querySelector('.resource-current-chip-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await removeResource(res.name);
        });
      }

      const makeLeadBtn = chip.querySelector('.resource-btn-make-lead');
      if (makeLeadBtn) {
        makeLeadBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await makeLeadResource(res.name);
        });
      }

      currentContainer.appendChild(chip);
    });
  }

  async function syncTaskResources(extraUpdates) {
    if (isInlineDraft || !curTask) return;

    const lead = assignedResources.find(r => r.isParent) || assignedResources[0];
    const primaryName = lead ? lead.name : 'Unassigned';
    const primaryAccountId = lead ? (lead.accountId || (currentPlan?.availableUsers || []).find(u => u.displayName === lead.name)?.accountId) : 'unassigned';
    const contributingList = assignedResources.map(r => r.name);
    // People are stored by account id (B-28); names go only when an id is unknown.
    const ids = assignedResources.map(r => r.accountId || (currentPlan?.availableUsers || []).find(u => u.displayName === r.name)?.accountId);

    curTask.resource = primaryName;
    curTask.resourceAccountId = primaryAccountId;
    curTask.contributingResources = contributingList;

    const updates = { resource: primaryName, resourceAccountId: primaryAccountId, ...extraUpdates };
    if (ids.every(Boolean)) updates.contributors = ids.map(accountId => {
      const existing = curTask.contributors?.find(c => c.accountId === accountId);
      return existing?.subtaskKey ? { accountId, subtaskKey: existing.subtaskKey } : { accountId };
    });
    else updates.contributingResources = contributingList;
    const res = await callResolver('updateWbsTask', { taskId: curTask.key, updates });
    if (res && res.ok && res.tasks) {
      const refreshed = res.tasks.find(t => t.key === curTask.key);
      if (refreshed && refreshed.contributors) {
        curTask.contributors = refreshed.contributors;
      }
    }

    renderTimelineRows();
  }

  function showRemovalPrompt(removing, subtaskKey, idx) {
    if (!currentContainer) return;
    const existingPrompt = currentContainer.querySelector('.resource-removal-prompt');
    if (existingPrompt) existingPrompt.remove();

    const promptContainer = document.createElement('div');
    promptContainer.className = 'resource-removal-prompt';
    promptContainer.style.cssText = 'width: 100%; padding: 8px; border: 1px solid var(--cp-border); border-radius: 4px; background: var(--cp-surface); margin-top: 4px; box-sizing: border-box;';
    promptContainer.innerHTML = html`
      <div class="jx-remove-prompt">${formatRemovalPrompt(removing.name, subtaskKey)}</div>
      <div class="jx-row-6">
        <button type="button" class="btn btn-danger btn-sm btn-delete-subtask jx-btn-tiny">Delete sub-task</button>
        <button type="button" class="btn btn-secondary btn-sm btn-unassign-subtask jx-btn-tiny">Unassign sub-task</button>
        <button type="button" class="btn btn-subtle btn-sm btn-cancel-remove jx-btn-tiny">Cancel</button>
      </div>
    `;

    promptContainer.querySelector('.btn-delete-subtask').addEventListener('click', async (e) => {
      e.stopPropagation();
      assignedResources.splice(idx, 1);
      if (assignedResources.length > 0 && !assignedResources.some(r => r.isParent)) {
        assignedResources[0].isParent = true;
      }
      updateHeaderBadge();
      renderCurrentChips();
      renderUserList(searchInput.value);
      await syncTaskResources({ removeSubtaskAction: { subtaskKey, action: 'delete' } });
    });

    promptContainer.querySelector('.btn-unassign-subtask').addEventListener('click', async (e) => {
      e.stopPropagation();
      assignedResources.splice(idx, 1);
      if (assignedResources.length > 0 && !assignedResources.some(r => r.isParent)) {
        assignedResources[0].isParent = true;
      }
      updateHeaderBadge();
      renderCurrentChips();
      renderUserList(searchInput.value);
      await syncTaskResources({ removeSubtaskAction: { subtaskKey, action: 'unassign' } });
    });

    promptContainer.querySelector('.btn-cancel-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      renderCurrentChips();
    });

    currentContainer.appendChild(promptContainer);
  }

  async function toggleResource(user) {
    if (isInlineDraft) {
      popover.style.display = 'none';
      if (typeof window.__onResourceSelectedForDraft === 'function') {
        window.__onResourceSelectedForDraft(user.displayName, user.accountId || undefined);
      }
      return;
    }

    const existingIdx = assignedResources.findIndex(r => r.name === user.displayName);
    if (existingIdx >= 0) {
      const removing = assignedResources[existingIdx];
      const contributorRec = curTask?.contributors?.find(c => c.accountId === removing.accountId) ||
        curTask?.contributors?.find(c => (currentPlan?.availableUsers || []).find(u => u.displayName === removing.name)?.accountId === c.accountId);
      const subtaskKey = contributorRec?.subtaskKey;
      if (subtaskKey) {
        showRemovalPrompt(removing, subtaskKey, existingIdx);
        return;
      }
      assignedResources.splice(existingIdx, 1);
      if (assignedResources.length > 0 && !assignedResources.some(r => r.isParent)) {
        assignedResources[0].isParent = true;
      }
    } else {
      const isFirst = (assignedResources.length === 0);
      assignedResources.push({
        name: user.displayName,
        isParent: isFirst,
        accountId: user.accountId || undefined
      });
    }

    updateHeaderBadge();
    renderCurrentChips();
    renderUserList(searchInput.value);
    await syncTaskResources();
  }

  async function removeResource(userName) {
    const idx = assignedResources.findIndex(r => r.name === userName);
    if (idx >= 0) {
      const removing = assignedResources[idx];
      const contributorRec = curTask?.contributors?.find(c => c.accountId === removing.accountId) ||
        curTask?.contributors?.find(c => (currentPlan?.availableUsers || []).find(u => u.displayName === removing.name)?.accountId === c.accountId);
      const subtaskKey = contributorRec?.subtaskKey;
      if (subtaskKey) {
        showRemovalPrompt(removing, subtaskKey, idx);
        return;
      }
      assignedResources.splice(idx, 1);
      if (assignedResources.length > 0 && !assignedResources.some(r => r.isParent)) {
        assignedResources[0].isParent = true;
      }
      updateHeaderBadge();
      renderCurrentChips();
      renderUserList(searchInput.value);
      await syncTaskResources();
    }
  }

  async function makeLeadResource(userName) {
    assignedResources.forEach(r => {
      r.isParent = (r.name === userName);
    });
    updateHeaderBadge();
    renderCurrentChips();
    renderUserList(searchInput.value);
    await syncTaskResources();
  }

  async function clearAllResources() {
    if (isInlineDraft) {
      popover.style.display = 'none';
      if (typeof window.__onResourceSelectedForDraft === 'function') {
        window.__onResourceSelectedForDraft('Unassigned', undefined);
      }
      return;
    }

    assignedResources = [];
    updateHeaderBadge();
    renderCurrentChips();
    renderUserList(searchInput.value);
    await syncTaskResources();
  }

  if (btnClearAll) {
    btnClearAll.onclick = (e) => {
      e.stopPropagation();
      clearAllResources();
    };
  }

  if (btnDone) {
    btnDone.onclick = (e) => {
      e.stopPropagation();
      popover.style.display = 'none';
    };
  }

  updateHeaderBadge();
  renderCurrentChips();
  searchInput.value = '';
  renderUserList('');
  setTimeout(() => searchInput.focus(), 50);

  function renderUserList(query) {
    listEl.innerHTML = '';
    const q = (query || '').toLowerCase().trim();

    // Option: Unassigned
    if (!q || 'unassigned'.includes(q)) {
      const isUnassignedSelected = (assignedResources.length === 0);
      const opt = document.createElement('div');
      opt.className = 'resource-option' + (isUnassignedSelected ? ' is-selected' : '');
      opt.innerHTML = html`
        <input type="checkbox" class="resource-option-checkbox" ${isUnassignedSelected ? 'checked' : ''} />
        <span class="resource-option-avatar">U</span>
        <span class="jx-fill">Unassigned</span>
      `;
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        clearAllResources();
      });
      listEl.appendChild(opt);
    }

    // The Unassigned row above stands for the server's "unassigned" entry, so it is listed once.
    const users = (currentPlan?.availableUsers || []).filter(u =>
      u.accountId !== 'unassigned' && u.displayName && u.displayName.toLowerCase().includes(q)
    );

    if (users.length === 0 && q && !'unassigned'.includes(q)) {
      listEl.innerHTML = '<div class="jx-empty-list">No matching team members</div>';
      return;
    }

    users.forEach(u => {
      const assignedEntry = assignedResources.find(r => r.name === u.displayName);
      const isAssigned = Boolean(assignedEntry);
      const isLead = assignedEntry?.isParent;

      const opt = document.createElement('div');
      opt.className = 'resource-option' + (isAssigned ? ' is-selected' : '');
      const initials = getInitials(u.displayName);
      const isPlaceholder = u.isPlaceholder ? html` <span class="jx-placeholder-note">(Placeholder)</span>` : '';

      let badgeHtml = html``;
      if (isAssigned) {
        badgeHtml = isLead
          ? html`<span class="resource-badge-lead">Lead</span>`
          : html`<span class="resource-badge-contrib">Contributor</span>`;
      }

      opt.innerHTML = html`
        <input type="checkbox" class="resource-option-checkbox" ${isAssigned ? 'checked' : ''} />
        <span class="resource-option-avatar">${initials}</span>
        <span class="jx-ellipsis-fill">${u.displayName}${isPlaceholder}</span>
        ${badgeHtml}
      `;

      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleResource(u);
      });

      listEl.appendChild(opt);
    });
  }

  searchInput.oninput = (e) => renderUserList(e.target.value);
  searchInput.onkeydown = (e) => {
    if (e.key === 'Escape') {
      popover.style.display = 'none';
    }
  };
}

function openStatusPicker(targetEl, taskKey) {
  closeAllPopovers();
  activePickerTaskKey = taskKey;
  const popover = document.getElementById('statusPickerPopover');
  const rect = targetEl.getBoundingClientRect();
  popover.style.display = 'flex';
  popover.style.top = (rect.bottom + 4) + 'px';
  popover.style.left = Math.min(window.innerWidth - 180, Math.max(10, rect.left)) + 'px';

  popover.querySelectorAll('.quick-menu-item').forEach(item => {
    item.onclick = async (e) => {
      e.stopPropagation();
      popover.style.display = 'none';
      const status = item.dataset.status;
      await callResolver('updateWbsTask', {
        taskId: activePickerTaskKey,
        updates: { status }
      });
      await loadProjectPlan();
    };
  });
}

function openEpicPicker(targetEl, taskKey) {
  closeAllPopovers();
  activePickerTaskKey = taskKey;
  const popover = document.getElementById('epicPickerPopover');
  const searchInput = document.getElementById('epicPickerSearch');
  const listEl = document.getElementById('epicPickerList');

  const rect = targetEl.getBoundingClientRect();
  popover.style.display = 'flex';
  const popoverHeight = 220;
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
    popover.style.top = Math.max(10, rect.top - popoverHeight) + 'px';
  } else {
    popover.style.top = (rect.bottom + 4) + 'px';
  }
  popover.style.left = Math.min(window.innerWidth - 240, Math.max(10, rect.left)) + 'px';

  searchInput.value = '';
  renderEpicList('');
  setTimeout(() => searchInput.focus(), 50);

  function renderEpicList(query) {
    listEl.innerHTML = '';
    const q = (query || '').toLowerCase().trim();

    // Option: None / Standalone
    if (!q || 'none standalone'.includes(q)) {
      const opt = document.createElement('div');
      opt.className = 'resource-option';
      opt.innerHTML = html`<span class="jx-subtle-11">✕ (None / Standalone Task)</span>`;
      opt.addEventListener('click', async () => {
        popover.style.display = 'none';
        if (activePickerTaskKey === 'NEW_INLINE_TASK') {
          if (typeof window.__onEpicSelectedForDraft === 'function') {
            window.__onEpicSelectedForDraft('', '');
          }
          return;
        }
        await callResolver('updateWbsTask', {
          taskId: activePickerTaskKey,
          updates: { epic: '', epicKey: '' }
        });
        await loadProjectPlan();
      });
      listEl.appendChild(opt);
    }

    const epics = (currentPlan?.availableEpics || []).filter(e => 
      (e.summary && e.summary.toLowerCase().includes(q)) || (e.key && e.key.toLowerCase().includes(q))
    );

    if (epics.length === 0 && q) {
      listEl.innerHTML = '<div class="jx-empty-list">No matching epics</div>';
      return;
    }

    epics.forEach(ep => {
      const opt = document.createElement('div');
      opt.className = 'resource-option';
      opt.innerHTML = html`<span>🟪 <strong>${ep.key}</strong>: ${ep.summary}</span>`;
      opt.addEventListener('click', async () => {
        popover.style.display = 'none';
        if (activePickerTaskKey === 'NEW_INLINE_TASK') {
          if (typeof window.__onEpicSelectedForDraft === 'function') {
            window.__onEpicSelectedForDraft(ep.summary, ep.key);
          }
          return;
        }
        await callResolver('updateWbsTask', {
          taskId: activePickerTaskKey,
          updates: { epic: ep.summary, epicKey: ep.key }
        });
        await loadProjectPlan();
      });
      listEl.appendChild(opt);
    });
  }

  searchInput.oninput = (e) => renderEpicList(e.target.value);
  searchInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const firstOpt = listEl.querySelector('.resource-option');
      if (firstOpt) firstOpt.click();
    } else if (e.key === 'Escape') {
      popover.style.display = 'none';
    }
  };
}

let activeProgressTaskKey = null;
let activeTargetTaskKey = null;

function openProgressPicker(targetEl, taskKey) {
  closeAllPopovers();
  activeProgressTaskKey = taskKey;
  const task = (currentPlan?.tasks || []).find(t => t.key === taskKey);
  if (!task) return;
  const locked = progressLockReason(task);
  if (locked) {
    showFlag({ text: locked });
    announce(locked);
    return;
  }

  const popover = document.getElementById('progressPickerPopover');
  const titleEl = document.getElementById('progressPickerTitle');
  const valLabel = document.getElementById('progressPickerValLabel');
  const slider = document.getElementById('progressPickerSlider');
  const numInput = document.getElementById('progressPickerNumberInput');
  const rollupSection = document.getElementById('progressPickerRollupSection');
  const rollupLabel = document.getElementById('progressPickerRollupLabel');

  titleEl.textContent = `Progress: ${task.key}`;
  const curProg = task.progress !== undefined ? task.progress : 0;
  slider.value = curProg;
  numInput.value = curProg;
  valLabel.textContent = `${curProg}%`;

  const isRollupTask = task.isEpic || (task.childrenCount && task.childrenCount > 0);
  const rollupPct = task.rollupStats ? task.rollupStats.progressPct : (task.progress || 0);

  if (isRollupTask) {
    rollupSection.style.display = 'block';
    rollupLabel.textContent = `Child Rollup: ${rollupPct}%`;
  } else {
    rollupSection.style.display = 'none';
  }

  // Position popover
  const rect = targetEl.getBoundingClientRect();
  popover.style.display = 'flex';
  const popoverHeight = isRollupTask ? 210 : 170;
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
    popover.style.top = Math.max(10, rect.top - popoverHeight) + 'px';
  } else {
    popover.style.top = (rect.bottom + 4) + 'px';
  }
  popover.style.left = Math.min(window.innerWidth - 260, Math.max(10, rect.left)) + 'px';
}

function openTargetPicker(targetEl, taskKey) {
  closeAllPopovers();
  activeTargetTaskKey = taskKey;
  const task = (currentPlan?.tasks || []).find(t => t.key === taskKey);
  if (!task) return;

  const popover = document.getElementById('targetPickerPopover');
  const titleEl = document.getElementById('targetPickerTitle');
  const valLabel = document.getElementById('targetPickerValLabel');
  const slider = document.getElementById('targetPickerSlider');
  const numInput = document.getElementById('targetPickerNumberInput');

  titleEl.textContent = `Target: ${task.key}${task.manualTargetProgress ? ' (Manual)' : ' (Auto)'}`;
  const curTarget = task.targetProgress !== undefined ? task.targetProgress : 0;
  slider.value = curTarget;
  numInput.value = curTarget;
  valLabel.textContent = `${curTarget}%`;

  const rect = targetEl.getBoundingClientRect();
  popover.style.display = 'flex';
  const popoverHeight = 160;
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
    popover.style.top = Math.max(10, rect.top - popoverHeight) + 'px';
  } else {
    popover.style.top = (rect.bottom + 4) + 'px';
  }
  popover.style.left = Math.min(window.innerWidth - 250, Math.max(10, rect.left)) + 'px';
}

function openInlineCreationRow(rowElement, anchorTask, rowIdx) {
  const existing = document.querySelector('.inline-creation-row');
  if (existing) existing.remove();

  const insertIndex = rowIdx + 1;
  const isAnchorEpic = anchorTask.isEpic || anchorTask.hierarchyLevel === 1;
  let inheritedEpic = isAnchorEpic ? anchorTask.summary : (anchorTask.epic || '');
  let inheritedEpicKey = isAnchorEpic ? anchorTask.key : (anchorTask.epicKey || '');
  const defaultStartWk = anchorTask.startWeek || (currentPlan.weeks.find(w => w.isCurrentWeek)?.weekKey || currentPlan.weeks[0]?.weekKey);
  const barLeft = xForDate(anchorTask.startDate || todayIso(), originIso(), dayPx());
  const barWidth = 21 * dayPx();

  const creationTr = document.createElement('tr');
  creationTr.className = 'inline-creation-row';

  let epicDisplay = inheritedEpic ? `🟪 ${inheritedEpic}` : '+ Link Epic';

  const visibleKeys = getVisibleColKeys();
  let cellsHtml = html``;
  if (visibleKeys.includes('epic')) {
    cellsHtml = html`${cellsHtml}
      <td class="td-data td-epic-cell" data-css-w="${columnWidths.epic}px">
        <span class="epic-link-chip new-task-epic-chip ${inheritedEpic ? 'has-epic' : 'no-epic'}" title="Choose Epic">${epicDisplay} ▾</span>
      </td>
    `;
  }
  if (visibleKeys.includes('story')) {
    cellsHtml = html`${cellsHtml}<td class="td-data jx-brand-bold" data-css-w="${columnWidths.story}px">🔷 Task</td>`;
  }
  // task is always visible (locked)
  cellsHtml = html`${cellsHtml}
    <td class="td-data td-task-summary" data-css-w="${colWidth('task')}px">
      <div class="jx-create-row">
        <input type="text" class="inline-create-input" placeholder="Type new task summary & press Enter to save..." autocomplete="off" />
        <button class="btn-inline-save">Add</button>
        <button class="btn-inline-cancel" title="Cancel (Esc)">✕</button>
      </div>
    </td>
  `;
  if (visibleKeys.includes('resource')) {
    cellsHtml = html`${cellsHtml}
      <td class="td-data td-resource-cell" data-css-w="${columnWidths.resource}px">
        <div class="resource-chip-btn new-task-resource-btn" title="Assign team member">
          <span class="resource-option-avatar">U</span>
          <span class="new-task-resource-name jx-ellipsis">Unassigned</span>
          <span class="jx-caret">▾</span>
        </div>
      </td>
    `;
  }
  if (visibleKeys.includes('effort')) {
    cellsHtml = html`${cellsHtml}
      <td class="td-data td-effort-cell jx-center" data-css-w="${columnWidths.effort}px">
        <input type="number" class="inline-edit-input new-task-hours jx-hours-input" placeholder="h" min="0" />
      </td>
    `;
  }
  if (visibleKeys.includes('progress')) {
    cellsHtml = html`${cellsHtml}<td class="td-data jx-center-subtle" data-css-w="${columnWidths.progress}px">0%</td>`;
  }
  if (visibleKeys.includes('target')) {
    cellsHtml = html`${cellsHtml}<td class="td-data jx-center-subtle" data-css-w="${columnWidths.target}px">0%</td>`;
  }
  if (visibleKeys.includes('status')) {
    cellsHtml = html`${cellsHtml}<td class="td-data jx-center" data-css-w="${columnWidths.status}px"><span class="badge badge-neutral">NOT_STARTED</span></td>`;
  }
  cellsHtml = html`${cellsHtml}
    <td class="timeline-track-cell">
      <div class="ghost-timeline-bar" data-css-left="${barLeft}px" data-css-w="${barWidth}px">
        <span>➕ New Task Preview (3 wks)</span>
      </div>
    </td>
  `;
  creationTr.innerHTML = html`${cellsHtml}`;
  applyFrozen(creationTr);

  rowElement.after(creationTr);
  updateVirtualRows();

  let selectedResource = 'Unassigned';
  let selectedAccountId = undefined;
  let selectedEpic = inheritedEpic;
  let selectedEpicKey = inheritedEpicKey;

  const input = creationTr.querySelector('.inline-create-input');
  const saveBtn = creationTr.querySelector('.btn-inline-save');
  const cancelBtn = creationTr.querySelector('.btn-inline-cancel');
  const resBtn = creationTr.querySelector('.new-task-resource-btn');
  const epicBtn = creationTr.querySelector('.new-task-epic-chip');
  const hoursInput = creationTr.querySelector('.new-task-hours');

  setTimeout(() => input.focus(), 50);

  function cancelCreation() {
    creationTr.remove();
    updateVirtualRows();
  }
  cancelBtn.addEventListener('click', cancelCreation);

  if (epicBtn) {
    epicBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEpicPicker(epicBtn, 'NEW_INLINE_TASK');
      window.__onEpicSelectedForDraft = (epSummary, epKey) => {
        selectedEpic = epSummary;
        selectedEpicKey = epKey;
        epicBtn.textContent = epSummary ? `🟪 ${epSummary} ▾` : '+ Link Epic';
        epicBtn.className = `epic-link-chip new-task-epic-chip ${epSummary ? 'has-epic' : 'no-epic'}`;
      };
    });
  }

  if (resBtn) {
    resBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openResourcePicker(resBtn, 'NEW_INLINE_TASK');
      window.__onResourceSelectedForDraft = (displayName, accountId) => {
        selectedResource = displayName;
        selectedAccountId = accountId;
        const avatar = resBtn.querySelector('.resource-option-avatar');
        const nameEl = resBtn.querySelector('.new-task-resource-name');
        if (avatar) avatar.textContent = getInitials(displayName);
        if (nameEl) nameEl.textContent = displayName;
      };
    });
  }

  let isSubmitting = false;
  async function submitNewTask() {
    if (isSubmitting) return;
    const summary = input.value.trim();
    if (!summary) {
      input.style.borderColor = 'var(--cp-border-danger)';
      input.focus();
      return;
    }

    isSubmitting = true;
    input.disabled = true;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Adding...';

    const parsedHours = parseInt(hoursInput.value, 10);
    const hours = isNaN(parsedHours) ? undefined : parsedHours;

    try {
      const res = await callResolver('createInlineTask', {
        summary,
        epic: selectedEpic || undefined,
        epicKey: selectedEpicKey || undefined,
        parentKey: selectedEpicKey || undefined,
        resource: selectedResource,
        resourceAccountId: selectedAccountId,
        assigneeAccountId: selectedAccountId || undefined,
        effortHours: hours,
        startWeek: defaultStartWk,
        spanWeeks: 3,
        targetIndex: insertIndex
      });

      // Only a result with ok: true is a success; a thrown call or a refused create is not (F-13).
      if (!res || res.ok !== true) {
        showFlag({ text: (res && (res.message || res.error)) || 'Failed to create task in Jira.', error: true });
        input.disabled = false;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Add';
        isSubmitting = false;
        return;
      }

      if (res && res.task) {
        expandAncestors(res.task);
        registerOptimisticTask(res.task);
      }
      if (currentHierarchyView === 'epics') {
        currentHierarchyView = 'all';
        const hierSwitcher = document.getElementById('hierarchySwitcher');
        if (hierSwitcher) hierSwitcher.value = 'all';
      }
      if (res && res.plan && Array.isArray(res.plan.tasks)) {
        mergeOptimisticTasks(res.plan);
        currentPlan = res.plan;
        renderPlan();
      } else if (res && res.task && currentPlan && Array.isArray(currentPlan.tasks)) {
        if (!currentPlan.tasks.some(t => t.key === res.task.key)) {
          currentPlan.tasks.splice(insertIndex, 0, res.task);
        }
        renderPlan();
      } else {
        await loadProjectPlan();
      }
      if (res?.task?.key) {
        setTimeout(() => {
          scrollRowIntoView(res.task.key);
        }, 120);
      }
      showFlag({ text: 'Task ' + (res?.task?.key || '') + ' created and scheduled.' });
    } catch (err) {
      showFlag({ text: err?.message || 'Error creating task.', error: true });
      input.disabled = false;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Add';
      isSubmitting = false;
    }
  }

  saveBtn.addEventListener('click', submitNewTask);
  input.addEventListener('keydown', (ke) => {
    if (ke.key === 'Enter') {
      ke.preventDefault();
      submitNewTask();
    } else if (ke.key === 'Escape') {
      cancelCreation();
    }
  });
}

function updateDynamicParentRollups(changedKey) {
  if (!currentPlan || !currentPlan.tasks || !currentPlan.weeks) return;
  const changedTask = currentPlan.tasks.find(t => t.key === changedKey);
  if (!changedTask) return;

  const parentKey = changedTask.parentKey || changedTask.epicKey;
  if (!parentKey || parentKey === changedKey) return;
  const parentTask = currentPlan.tasks.find(t => t.key === parentKey || t.id === parentKey);
  if (!parentTask) return;

  const children = currentPlan.tasks.filter(t => 
    t.key !== parentTask.key && (
      t.parentKey === parentTask.key ||
      t.parentId === parentTask.id ||
      t.epicKey === parentTask.key
    )
  );
  if (children.length === 0) return;

  const weekKeys = currentPlan.weeks.map(w => w.weekKey);
  let minStart = Infinity;
  let maxEnd = -1;
  let totalEffort = 0;
  let weightedProgressSum = 0;

  children.forEach(c => {
    const sIdx = Math.max(0, weekKeys.indexOf(c.startWeek));
    const cSpan = c.spanWeeks || 1;
    const eIdx = sIdx + cSpan - 1;
    if (sIdx < minStart) minStart = sIdx;
    if (eIdx > maxEnd) maxEnd = eIdx;
    const eff = c.effortHours || 1;
    totalEffort += eff;
    weightedProgressSum += (c.progress || 0) * eff;
  });

  if (minStart < Infinity && maxEnd >= minStart) {
    parentTask.startWeek = weekKeys[minStart];
    parentTask.endWeek = weekKeys[Math.min(weekKeys.length - 1, maxEnd)];
    parentTask.spanWeeks = Math.max(1, maxEnd - minStart + 1);
    parentTask.progress = totalEffort > 0 ? Math.round(weightedProgressSum / totalEffort) : 0;
  }
}

// Canvas timeline (B-13). Only the rows in the viewport plus a buffer are DOM rows; bars, arrows,
// the grid and the today line are drawn on one canvas; each visible bar has a transparent hit
// element that takes focus, hover, drag and resize.
const ROW_BUFFER = 10;
let timeline = null;
let rowTasks = [];        // { task, rowIdx } in display order
let rowTaskList = [];     // the same tasks, for the canvas
let rowCache = new Map(); // task key -> built <tr>
let renderedRange = { first: 0, last: -1 };
let layout = { trackLeft: 0, headerH: 0, bodyStart: 0, inlineAfter: -1, inlineH: 0 };
let topDropRowEl = null;
let topSpacer = null;
let bottomSpacer = null;

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function findTask(key) {
  return (currentPlan?.tasks || []).find(t => t.key === key);
}

function originIso() {
  return timeRange ? timeRange.start : todayIso();
}

/** Content y of the top of display row i (rows are ROW_H high; an open inline row adds its height). */
function rowTop(i) {
  return layout.bodyStart + i * ROW_H + (layout.inlineAfter >= 0 && i > layout.inlineAfter ? layout.inlineH : 0);
}

function measureLayout() {
  const table = document.getElementById('ganttTable');
  layout.headerH = table && table.tHead ? table.tHead.offsetHeight : 0;
  const visibleKeys = getVisibleColKeys();
  const frozenWidth = visibleKeys.reduce((sum, k) => sum + colWidth(k), 0);
  layout.trackLeft = frozenWidth;
  layout.bodyStart = topDropRowEl ? table.offsetTop + topDropRowEl.offsetTop + topDropRowEl.offsetHeight : 0;
  const inline = document.querySelector('.inline-creation-row');
  layout.inlineAfter = -1;
  layout.inlineH = 0;
  if (inline && inline.previousElementSibling) {
    const k = inline.previousElementSibling.dataset.taskId;
    layout.inlineAfter = rowTasks.findIndex(r => r.task.key === k);
    layout.inlineH = inline.offsetHeight;
  }
}

// Unit boundaries are computed once per range and zoom; a draw only filters them (B-27).
let gridCache = { key: '', xs: [] };
function gridXBetween(fromX, toX) {
  const key = `${timeRange.start}|${timeRange.end}|${zoomId}`;
  if (gridCache.key !== key) gridCache = { key, xs: gridLines(timeRange, zoomById(zoomId), -Infinity, Infinity) };
  return gridCache.xs.filter(x => x >= fromX && x <= toX);
}

function drawTimeline(sync) {
  if (!timeline || !currentPlan) return;
  const activeSearchKey = (currentSearchMatchPos >= 0 && currentSearchMatchPos < searchMatches.length)
    ? searchMatches[currentSearchMatchPos].task.key
    : null;
  timeline.activeKey = hoveredTaskId || pinnedDependencyTaskId || activeSearchKey;
  timeline.setModel({
    tasks: rowTaskList,
    first: renderedRange.first,
    last: renderedRange.last,
    rowTop,
    originIso: originIso(),
    dayPx: dayPx(),
    trackLeft: layout.trackLeft,
    trackWidth: trackWidth(),
    headerH: layout.headerH,
    todayIso: todayIso(),
    gridX: gridXBetween
  });
  if (sync) timeline.draw(); else timeline.requestDraw();
}

/** Rows the current view shows, in order: hierarchy filter, then collapsed parents. */
function computeRowTasks() {
  let tasksToRender = currentPlan.tasks;
  if (currentHierarchyView === 'epics') {
    tasksToRender = currentPlan.tasks.filter(t => t.isEpic || t.hierarchyLevel === 1);
  } else if (currentHierarchyView === 'stories') {
    tasksToRender = currentPlan.tasks.filter(t => !t.isEpic && t.hierarchyLevel !== 1);
  }
  // Rows that have child rows in this view get the expand toggle (computed once per render).
  rowParentKeys = parentKeysOf(tasksToRender);
  // Every descendant of a collapsed parent or epic (at any depth) is hidden.
  return { rows: visibleRows(tasksToRender, collapsedTasks), total: tasksToRender.length };
}
let rowParentKeys = new Set();

function makeSpacer(cols) {
  const tr = document.createElement('tr');
  tr.className = 'spacer-row';
  tr.setAttribute('aria-hidden', 'true');
  const td = document.createElement('td');
  td.colSpan = cols;
  tr.appendChild(td);
  return tr;
}

function renderTimelineRows() {
  if (globalThis.__cpPerf) performance.mark('cp:rows:start');
  const tbody = document.getElementById('ganttBody');
  tbody.innerHTML = '';
  rowCache = new Map();
  rowTasks = [];
  rowTaskList = [];
  renderedRange = { first: 0, last: -1 };
  topDropRowEl = topSpacer = bottomSpacer = null;
  if (gridRoot) gridRoot.replaceChildren();
  const cols = getVisibleColKeys().length + 1;

  if (!currentPlan.tasks || currentPlan.tasks.length === 0) {
    // First run: one primary action and a link to help, no setup step (B-25).
    const es = emptyState(currentPlan);
    tbody.innerHTML = html`<tr><td colspan="${cols}" class="empty-state-cell">
      <div class="empty-state" id="emptyStateDropZone" role="region" aria-labelledby="emptyStateTitle">
        <h2 id="emptyStateTitle">${es.title}</h2>
        <p>${es.text}</p>
        <div class="empty-state-drop-hint jx-drop-hint">
          📥 Drop backlog issues here to schedule, or click below
        </div>
        <div class="empty-state-actions">
          <button class="btn btn-primary" id="emptyStateAction" type="button" data-action="${es.action.id}">${es.action.label}</button>
          <button class="btn btn-link help-link" id="emptyStateHelp" type="button">How CascadePlan works</button>
        </div>
      </div></td></tr>`;
    tbody.querySelector('#emptyStateAction').addEventListener('click', (e) => {
      if (e.currentTarget.dataset.action === 'schedule') {
        document.getElementById('backlogTray').classList.remove('collapsed');
        document.querySelector('.backlog-card')?.focus();
      } else {
        openCreateTaskModal();
      }
    });
    tbody.querySelector('#emptyStateHelp').addEventListener('click', openHelp);

    const dropZone = tbody.querySelector('#emptyStateDropZone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        dropZone.classList.add('drop-active');
      });
      dropZone.addEventListener('dragleave', (e) => {
        if (!dropZone.contains(e.relatedTarget)) {
          dropZone.classList.remove('drop-active');
        }
      });
      dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drop-active');
        document.body.classList.remove('is-dragging-backlog');
        const dataStr = e.dataTransfer.getData('text/plain');
        if (!dataStr) return;
        try {
          const data = JSON.parse(dataStr);
          if (data && data.taskId) {
            const res = await callResolver('scheduleBacklogTask', {
              taskId: data.taskId,
              startWeek: '',
              startDate: todayIso(),
              spanWeeks: 3,
              targetIndex: 0
            });
            if (res && Array.isArray(res.tasks)) {
              currentPlan = res;
              renderPlan();
            } else {
              await loadProjectPlan();
            }
            if (res && res.ok === true) showFlag({ text: 'Scheduled ' + data.taskId + ' to timeline.' });
          }
        } catch (err) {
          logFailure('empty state drop', err);
        }
      });
    }
    drawTimeline();
    return;
  }

  // Top Drop Target Row (Index 0)
  topDropRowEl = document.createElement('tr');
  topDropRowEl.className = 'drop-target-row';
  topDropRowEl.innerHTML = html`<td colspan="${cols}"><span class="drop-target-label">+ Drop here to place task at top of schedule</span></td>`;
  setupDropTargetRow(topDropRowEl, 0);
  tbody.appendChild(topDropRowEl);

  const computed = computeRowTasks();
  rowTasks = computed.rows;
  rowTaskList = rowTasks.map(r => r.task);
  topSpacer = makeSpacer(cols);
  bottomSpacer = makeSpacer(cols);
  tbody.appendChild(topSpacer);
  tbody.appendChild(bottomSpacer);

  // Bottom Drop Target Row
  const btmDropRow = document.createElement('tr');
  btmDropRow.className = 'drop-target-row';
  btmDropRow.innerHTML = html`<td colspan="${cols}"><span class="drop-target-label">+ Drop here to place task at bottom of schedule</span></td>`;
  setupDropTargetRow(btmDropRow, computed.total);
  tbody.appendChild(btmDropRow);
  updateVirtualRows();
  if (globalThis.__cpPerf) performance.measure('cp:rows', 'cp:rows:start');
}

function removeRow(tr) {
  if (!tr) return;
  const next = tr.nextElementSibling;
  if (next && next.classList.contains('inline-creation-row')) next.remove();
  tr.remove();
}

/** Shows the rows in the viewport plus a buffer. Rows that stay in view are not rebuilt (B-13). */
function updateVirtualRows() {
  const wrapper = document.getElementById('ganttWrapper');
  if (!wrapper || !topSpacer) {
    drawTimeline(true);
    return;
  }
  measureLayout();
  const offset = Math.max(0, wrapper.scrollTop + layout.headerH - layout.bodyStart);
  const next = visibleRange(offset, Math.max(ROW_H, wrapper.clientHeight - layout.headerH), ROW_H, rowTasks.length, ROW_BUFFER);
  const prev = renderedRange;
  if (next.first !== prev.first || next.last !== prev.last) {
    for (let i = prev.first; i <= prev.last; i++) {
      if (i < next.first || i > next.last) removeRow(rowCache.get(rowTasks[i].task.key));
    }
    let cursor = topSpacer;
    for (let i = next.first; i <= next.last; i++) {
      const { task, rowIdx } = rowTasks[i];
      let tr = rowCache.get(task.key);
      if (!tr) {
        tr = buildTaskRow(task, rowIdx);
        rowCache.set(task.key, tr);
      }
      if (!tr.isConnected) cursor.after(tr);
      cursor = tr;
      const after = tr.nextElementSibling;
      if (after && after.classList.contains('inline-creation-row')) cursor = after;
    }
    topSpacer.firstChild.style.height = (next.first * ROW_H) + 'px';
    bottomSpacer.firstChild.style.height = (Math.max(0, rowTasks.length - 1 - next.last) * ROW_H) + 'px';
    renderedRange = next;
    measureLayout();
    renderGrid();
  }
  drawTimeline(true);
}

let virtualFrame = 0;
function scheduleVirtualRows() {
  if (virtualFrame) return;
  virtualFrame = requestAnimationFrame(() => {
    virtualFrame = 0;
    maybeExtendRange();
    updateVirtualRows();
  });
}

/** Scrolls a row into view (it may not be a DOM row yet) and returns its <tr>. */
function scrollRowIntoView(key) {
  const wrapper = document.getElementById('ganttWrapper');
  const i = rowTasks.findIndex(r => r.task.key === key);
  if (!wrapper || i < 0) return null;
  wrapper.scrollTop = Math.max(0, rowTop(i) - layout.headerH - (wrapper.clientHeight - layout.headerH) / 2);
  updateVirtualRows();
  return rowCache.get(key) || null;
}

/** Uses the plan a write returned: bars move, rows that are still shown are kept (B-13). */
// The active baseline of the open plan, from the last plan load (ADR-009).
let baselineState = null;
function updateBaselineButton() {
  const btn = document.getElementById('btnBaseline');
  if (!btn || !baselineState || !currentPlan) return;
  const report = baselineState.ok
    ? { ok: true, baseline: baselineState.baseline, intact: baselineState.intact, comparison: compareItems(baselineState.items || [], baselineItems(currentPlan.tasks || [])) }
    : { ok: false };
  btn.textContent = baselineStatusText(report);
  btn.classList.toggle('is-warning', !!(report.ok && (report.comparison.grew || !report.intact)));
}

function applyPlanInPlace(plan) {
  const before = rowTaskList.map(t => t.key).join('\n');
  currentPlan = plan;
  updateBaselineButton();
  const computed = computeRowTasks();
  if (computed.rows.map(r => r.task.key).join('\n') !== before) {
    renderPlan();
    settleUndo();
    return;
  }
  rowTasks = computed.rows;
  rowTaskList = rowTasks.map(r => r.task);
  renderPlanSummary();
  renderGrid();
  const byKey = new Map(rowTaskList.map(t => [t.key, t]));
  for (const [key, tr] of rowCache) {
    const hit = tr.querySelector('.bar-hit');
    if (hit && byKey.has(key)) positionBarHit(hit, byKey.get(key));
  }
  drawTimeline(true);
  if (currentView === 'table') {
    renderTableView();
  }
  settleUndo();
}


/** Data cells stay in place while the timeline scrolls (B-27 criterion 5). */
function applyFrozen(tr) {
  // Widths, positions and indents computed in the row template (MK-09: no inline style attributes).
  applyDynamicStyles(tr);
  const frozen = getFrozenLayout();
  const keys = frozen.visibleKeys;
  const cells = [...tr.children].filter(td => !td.classList.contains('timeline-track-cell'));
  if (cells.length !== keys.length) return;
  cells.forEach((td, i) => {
    const k = keys[i];
    const w = frozen.widths[k];
    td.classList.add('td-frozen');
    td.classList.toggle('is-last-frozen', k === frozen.lastKey);
    td.style.width = w + 'px';
    td.style.minWidth = w + 'px';
    td.style.maxWidth = w + 'px';
    td.style.left = frozen.offsets[k] + 'px';
  });
}

/** Opens the floating More Actions menu for a task row */
function openRowMoreMenu(anchorBtn, task, rowIdx, tr) {
  let menu = document.getElementById('rowMoreMenu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'rowMoreMenu';
    menu.className = 'quick-menu-popover row-more-menu-popover';
    document.body.appendChild(menu);
  }

  menu.innerHTML = html`
    <div class="menu-item-header jx-menu-header">
      ${task.key}: ${task.summary}
    </div>
    <button class="quick-menu-item" data-action="insert"><span>➕</span><span>Insert task below</span></button>
    <button class="quick-menu-item" data-action="subtask"><span>↳</span><span>Add subtask</span></button>
    <button class="quick-menu-item" data-action="progress"><span>📈</span><span>Set actual progress (${task.progress}%)</span></button>
    <button class="quick-menu-item" data-action="why"><span>❓</span><span>Why this date?</span></button>
    <button class="quick-menu-item" data-action="team"><span>👥</span><span>Assign team member</span></button>
    <button class="quick-menu-item" data-action="edit"><span>✏️</span><span>Edit task details</span></button>
    <button class="quick-menu-item" data-action="jira"><span>↗</span><span>Open in native Jira</span></button>
    <div class="jx-menu-divider"></div>
    <button class="quick-menu-item item-danger" data-action="backlog"><span>📤</span><span>Move to backlog</span></button>
  `;

  const rect = anchorBtn.getBoundingClientRect();
  menu.style.display = 'flex';
  menu.style.position = 'fixed';
  menu.style.background = 'var(--cp-surface-overlay)';
  menu.style.zIndex = '2500';
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.min(window.innerWidth - 225, Math.max(10, rect.left - 80))}px`;

  menu.onclick = async (e) => {
    const item = e.target.closest('.quick-menu-item');
    if (!item) return;
    const action = item.dataset.action;
    menu.style.display = 'none';
    if (action === 'insert') openInlineCreationRow(tr, task, rowIdx);
    else if (action === 'subtask') {
      openTaskDetailModal(task.key);
      setTimeout(() => { document.getElementById('newSubtaskSummaryInput')?.focus(); }, 100);
    }
    else if (action === 'progress') openProgressPicker(anchorBtn, task.key);
    else if (action === 'why') showWhy(task.key, anchorBtn.getBoundingClientRect());
    else if (action === 'team') {
      openTaskDetailModal(task.key);
      setTimeout(() => { document.getElementById('multiResourceSelect')?.focus(); }, 100);
    }
    else if (action === 'edit') openTaskDetailModal(task.key);
    else if (action === 'jira') openJiraIssueInNewTab(task.key, e);
    else if (action === 'backlog') {
      await callResolver('unscheduleTask', { taskId: task.key });
      await loadProjectPlan();
    }
  };

  const closeListener = (ev) => {
    if (!menu.contains(ev.target) && ev.target !== anchorBtn) {
      menu.style.display = 'none';
      window.removeEventListener('click', closeListener, true);
    }
  };
  setTimeout(() => window.addEventListener('click', closeListener, true), 20);
}

/** Builds one task row: data cells plus the timeline cell with the bar hit element. */
function buildTaskRow(task, rowIdx) {
  const isEpic = Boolean(task.isEpic || task.hierarchyLevel === 1);
  const isSub = Boolean(task.isSubtask || task.hierarchyLevel === -1);

  const tr = document.createElement('tr');
  tr.className = 'task-row' + (isEpic ? ' is-epic-row' : (isSub ? ' is-subtask' : ' is-story-row'));
  tr.dataset.taskId = task.key;
  tr.addEventListener('mouseenter', () => { tr.classList.add('is-hovered'); });
  tr.addEventListener('mouseleave', () => { tr.classList.remove('is-hovered'); });

  if (searchMatches && searchMatches.length > 0) {
    const isMatch = searchMatches.some(m => m.task.key === task.key);
    if (isMatch) {
      tr.classList.add('is-search-match');
      const activeKey = (currentSearchMatchPos >= 0 && currentSearchMatchPos < searchMatches.length)
        ? searchMatches[currentSearchMatchPos].task.key
        : null;
      if (activeKey === task.key) tr.classList.add('is-search-active');
    }
  }

  // Any row with child rows in this view (epic, story or task) can be collapsed.
  const hasChildren = rowParentKeys.has(task.key);

  // Expand/collapse icon & Indentation
  let expandToggleHtml = html``;
  if (hasChildren) {
    const isExp = !collapsedTasks.has(task.key);
    expandToggleHtml = html`<button class="tree-toggle-btn" type="button" data-parent-key="${task.key}" aria-expanded="${isExp ? 'true' : 'false'}" aria-label="${isExp ? 'Collapse' : 'Expand'} children of ${task.key}" title="${isExp ? 'Collapse children' : 'Expand children'}">${isExp ? '▼' : '▶'}</button>`;
  }

  let badgeHtml = html``;
  let indentPx = 0;
  if (isEpic) {
    badgeHtml = html`<span class="epic-badge" title="Epic Roadmap Level">🟪 EPIC</span>`;
    indentPx = 0;
  } else if (isSub) {
    badgeHtml = html`<span class="subtask-tree-icon" title="Subtask Execution Level">↳</span>`;
    indentPx = 28;
  } else {
    badgeHtml = html`<span class="story-badge" title="Story / Task Plan Level">🔷</span>`;
    if (task.epicKey && currentPlan.tasks.some(t => t.key === task.epicKey && t.key !== task.key)) {
      indentPx = 16;
    }
  }

  const siteUrl = getJiraBaseUrl();
  // Summary column content with clean hover action toolbar and in-place addition affordance
  const summaryHtml = html`
    <div class="jx-summary-row" data-css-pl="${indentPx}px">
      <div class="row-insert-affordance" title="Insert task below (Row ${rowIdx + 2})">
        <button class="row-insert-plus-btn" title="Insert new task below">＋</button>
      </div>
      <span class="row-drag-handle" title="Drag handle or press and hold row to reorder">⠿</span>
      ${expandToggleHtml}
      ${badgeHtml}
      <a href="${siteUrl}/browse/${task.key}" target="_blank" rel="noopener noreferrer" class="task-key-link" title="Open ${task.key} in native Jira (new tab)">${task.key} ↗</a>
      <span class="task-summary-text jx-summary-text" title="Click to edit summary, or press and hold row to reorder">
        : ${task.summary}
      </span>
      <div class="row-action-toolbar" role="toolbar" aria-label="Row actions for ${task.key}">
        <button class="row-action-btn quick-insert-below-btn" title="Insert task below (Row ${rowIdx + 2})" aria-label="Insert task below">➕</button>
        <button class="row-action-btn edit-modal-btn" title="Open full detail modal" aria-label="Open task details">✏️</button>
        <button class="row-action-btn why-date-btn" title="Why this date?" aria-label="Why this date?">❓</button>
        <button class="row-action-btn row-more-actions-btn" title="More task actions (Subtask, Progress, Team, Jira, Backlog)" aria-label="More actions">•••</button>
      </div>
    </div>
  `;

  // Epic Column Display
  let epicHtml = html``;
  if (isEpic) {
    epicHtml = html`<span class="epic-badge" title="Epic Roadmap Level">🟪 EPIC</span>`;
  } else {
    let epicLabel = task.epic || '';
    if (!epicLabel && task.epicKey) {
      const epObj = (currentPlan.availableEpics || []).find(e => e.key === task.epicKey);
      epicLabel = epObj ? epObj.summary : task.epicKey;
    }
    if (task.isSubtask || task.hierarchyLevel === -1) {
      // A sub-task's epic comes from its parent: read-only, no picker (N-07). Moving it under another
      // parent is a hierarchy change, not an epic change.
      epicHtml = epicLabel
        ? html`<span class="epic-inherited" title="Epic of the parent work item">🟪 ${epicLabel}</span>`
        : html``;
    } else if (epicLabel) {
      epicHtml = html`<span class="epic-link-chip has-epic" title="Click to change epic">🟪 ${epicLabel} ▾</span>`;
    } else {
      epicHtml = html`<span class="epic-link-chip no-epic" title="Click to link epic">+ Link Epic</span>`;
    }
  }

  // Data Columns (Dynamic based on visible columns)
  const visibleKeys = getVisibleColKeys();
  let rowColsHtml = html``;
  if (visibleKeys.includes('epic')) {
    rowColsHtml = html`${rowColsHtml}<td class="td-data td-epic-cell" data-css-w="${columnWidths.epic}px">${epicHtml}</td>`;
  }
  if (visibleKeys.includes('story')) {
    rowColsHtml = html`${rowColsHtml}<td class="td-data td-story-cell" data-css-w="${columnWidths.story}px" title="${task.story || ''}">${task.story || (isEpic ? 'Epic' : (isSub ? 'Subtask' : 'Task'))}</td>`;
  }
  if (visibleKeys.includes('task')) {
    rowColsHtml = html`${rowColsHtml}<td class="td-data td-task-summary" data-css-w="${colWidth('task')}px">${summaryHtml}</td>`;
  }
  if (visibleKeys.includes('resource')) {
    rowColsHtml = html`${rowColsHtml}<td class="td-data td-resource-cell" data-css-w="${columnWidths.resource}px"></td>`;
  }
  if (visibleKeys.includes('effort')) {
    rowColsHtml = html`${rowColsHtml}
      <td class="td-data td-effort-cell jx-center-pointer" data-css-w="${columnWidths.effort}px" title="Click to edit effort hours">
        <span class="effort-text jx-bold">${formatEffort(task.effortHours)}</span>
      </td>
    `;
  }
  if (visibleKeys.includes('progress')) {
    const isProgRollup = isEpic || (task.childrenCount && task.childrenCount > 0);
    const lockText = progressLockReason(task);
    const progTitle = lockText || (isProgRollup
      ? `Actual progress: ${progressText(task)} (Rollup from children: click to edit or override)`
      : `Click to set actual progress (${progressText(task)})`);
    rowColsHtml = html`${rowColsHtml}
      <td class="td-data td-progress-cell jx-center-pointer" data-css-w="${columnWidths.progress}px" title="${progTitle}">
        <div class="progress-chip-cell ${isDone(task.status) ? 'is-complete' : (task.progress > 0 ? 'is-active' : 'is-zero')}">
          <span class="progress-chip-fill" data-css-w="${task.progress}%"></span>
          <span class="progress-chip-text">${task.progress}% ▾</span>
        </div>
      </td>
    `;
  }
  if (visibleKeys.includes('target')) {
    rowColsHtml = html`${rowColsHtml}
      <td class="td-data td-target-cell jx-center-pointer" data-css-w="${columnWidths.target}px" title="Click to set target progress (${task.targetProgress}%)">
        <div class="target-chip-cell">
          <span class="target-chip-text">🎯 ${task.targetProgress}% ▾</span>
        </div>
      </td>
    `;
  }
  if (visibleKeys.includes('status')) {
    rowColsHtml = html`${rowColsHtml}
      <td class="td-data td-status-cell jx-center" data-css-w="${columnWidths.status}px">
        <span class="badge editable-badge-chip ${task.status === 'COMPLETED' ? 'badge-success' : task.status === 'IN_PROGRESS' ? 'badge-primary' : 'badge-neutral'}" title="Click to change status">
          ${task.status} ▾
        </span>
      </td>
    `;
  }
  tr.innerHTML = html`${rowColsHtml}`;
  applyFrozen(tr);
  if (selectedKeys.has(task.key)) tr.classList.add('is-selected');
  // Ctrl/Cmd+click toggles the row, Shift+click selects a range; nothing else on the row reacts (B-16).
  tr.addEventListener('click', (e) => {
    if (!(e.ctrlKey || e.metaKey || e.shiftKey)) return;
    e.preventDefault();
    e.stopPropagation();
    selectRow(task.key, e);
  }, true);

  // Interactive Scalable Resource Selection (Typeahead Picker & Subtask Rollup)
  if (visibleKeys.includes('resource')) {
    const resourceTd = tr.querySelector('.td-resource-cell');
    if (resourceTd) {
      const contributing = getTaskContributingResources(task);
      let avatarHtml = html``;
      let labelText = '';
      let titleText = '';
      let isMultiple = false;

      if (contributing.length === 0) {
        avatarHtml = html`<span class="resource-option-avatar">U</span>`;
        labelText = 'Unassigned';
        titleText = 'Unassigned. Click to assign team member.';
      } else if (contributing.length === 1) {
        const res = contributing[0];
        const initials = getInitials(res.name);
        avatarHtml = html`<span class="resource-option-avatar">${initials}</span>`;
        labelText = res.name;
        if (res.isParent) {
          titleText = `${res.name} (Task Assignee)`;
        } else {
          titleText = `${res.name} (Assigned via subtask: ${res.subtasks.join(', ') || 'subtask'})`;
          labelText = html`${labelText} <span class="resource-via-subtask-label">(subtask)</span>`;
        }
      } else {
        isMultiple = true;
        // Multi-avatar stack (up to 3 avatars)
        const maxAvatars = 3;
        avatarHtml = html`<div class="avatar-stack">`;
        contributing.slice(0, maxAvatars).forEach((res, aIdx) => {
          const initials = getInitials(res.name);
          const bg = aIdx === 0 ? 'var(--cp-bg-neutral)' : aIdx === 1 ? 'var(--cp-bg-selected)' : 'var(--cp-bg-discovery)';
          const color = aIdx === 0 ? 'var(--cp-text)' : aIdx === 1 ? 'var(--cp-text-brand)' : 'var(--cp-text-discovery)';
          avatarHtml = html`${avatarHtml}<span class="resource-option-avatar jx-avatar-${aIdx + 1}" title="${res.name}">${initials}</span>`;
        });
        avatarHtml = html`${avatarHtml}</div>`;

        const names = contributing.map(c => c.name);
        if (contributing.length === 2) {
          labelText = `${names[0]}, ${names[1]}`;
        } else {
          labelText = `${names[0]}, ${names[1]} +${contributing.length - 2}`;
        }

        const breakdownLines = contributing.map(c => {
          if (c.isParent && c.subtasks.length > 0) {
            return `• ${c.name} (Lead & subtasks: ${c.subtasks.join(', ')})`;
          } else if (c.isParent) {
            return `• ${c.name} (Lead / Parent Assignee)`;
          } else {
            return `• ${c.name} (Subtask: ${c.subtasks.join(', ') || 'subtask'})`;
          }
        });
        titleText = `Assigned Resources (${contributing.length}):\n` + breakdownLines.join('\n') + `\nClick to manage or assign.`;
      }

      resourceTd.innerHTML = html`
        <div class="resource-chip-btn ${isMultiple ? 'has-multiple-resources' : ''}" title="${titleText}">
          ${avatarHtml}
          <span class="resource-names-wrap jx-ellipsis-fill">${labelText}</span>
          ${isMultiple ? html`<span class="res-count-badge">${contributing.length}</span>` : ''}
          <span class="jx-caret">▾</span>
        </div>
      `;
      const resChip = resourceTd.querySelector('.resource-chip-btn');
      if (resChip) {
        resChip.addEventListener('click', (e) => {
          e.stopPropagation();
          openResourcePicker(resChip, task.key);
        });
      }
    }
  }

  // Inline Edit for Summary
  const sumText = tr.querySelector('.task-summary-text');
  if (sumText) {
    sumText.addEventListener('click', (e) => {
      e.stopPropagation();
      if (tr.querySelector('.inline-edit-input')) return;
      const origSummary = task.summary;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'inline-edit-input';
      input.value = origSummary;
      sumText.replaceWith(input);
      input.focus();
      input.select();

      let saved = false;
      async function saveInlineSummary() {
        if (saved) return;
        saved = true;
        const newSummary = input.value.trim();
        if (newSummary && newSummary !== origSummary) {
          task.summary = newSummary;
          await callResolver('updateWbsTask', {
            taskId: task.key,
            updates: { summary: newSummary }
          });
          await loadProjectPlan();
        } else {
          input.replaceWith(sumText);
        }
      }

      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') {
          ke.preventDefault();
          saveInlineSummary();
        } else if (ke.key === 'Escape') {
          saved = true;
          input.replaceWith(sumText);
        }
      });
      input.addEventListener('blur', saveInlineSummary);
    });
  }

  // Inline Edit for Effort (Hours)
  const effortTd = tr.querySelector('.td-effort-cell');
  if (effortTd) {
    effortTd.addEventListener('click', (e) => {
      e.stopPropagation();
      if (effortTd.querySelector('.inline-edit-input')) return;
      const origHours = task.effortHours || 0;
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'inline-edit-input';
      input.style.width = '55px';
      input.style.textAlign = 'center';
      input.min = '0';
      input.value = origHours;
      effortTd.innerHTML = '';
      effortTd.appendChild(input);
      input.focus();
      input.select();

      let saved = false;
      async function saveInlineEffort() {
        if (saved) return;
        saved = true;
        const val = parseInt(input.value, 10);
        if (!isNaN(val) && val >= 0 && val !== origHours) {
          task.effortHours = val;
          await callResolver('updateWbsTask', {
            taskId: task.key,
            updates: { effortHours: val }
          });
          await loadProjectPlan();
        } else {
          effortTd.innerHTML = html`<span class="effort-text jx-bold">${formatEffort(origHours)}</span>`;
        }
      }

      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') {
          ke.preventDefault();
          saveInlineEffort();
        } else if (ke.key === 'Escape') {
          saved = true;
          effortTd.innerHTML = html`<span class="effort-text jx-bold">${formatEffort(origHours)}</span>`;
        }
      });
      input.addEventListener('blur', saveInlineEffort);
    });
  }

  // Interactive Progress Cell Click -> opens Quick Progress Popover
  const progTd = tr.querySelector('.td-progress-cell');
  if (progTd) {
    progTd.addEventListener('click', (e) => {
      e.stopPropagation();
      openProgressPicker(progTd, task.key);
    });
  }

  // Interactive Target Cell Click -> opens Quick Target Popover
  const targetTd = tr.querySelector('.td-target-cell');
  if (targetTd) {
    targetTd.addEventListener('click', (e) => {
      e.stopPropagation();
      openTargetPicker(targetTd, task.key);
    });
  }

  // Inline Status Picker
  const statusChip = tr.querySelector('.editable-badge-chip');
  if (statusChip) {
    statusChip.addEventListener('click', (e) => {
      e.stopPropagation();
      openStatusPicker(statusChip, task.key);
    });
  }

  // Inline Epic Picker
  const epicChip = tr.querySelector('.epic-link-chip');
  if (epicChip) {
    epicChip.addEventListener('click', (e) => {
      e.stopPropagation();
      openEpicPicker(epicChip, task.key);
    });
  }

  // Row Action Toolbar Handlers
  const quickInsertBtn = tr.querySelector('.quick-insert-below-btn');
  if (quickInsertBtn) {
    quickInsertBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openInlineCreationRow(tr, task, rowIdx);
    });
  }
  const rowPlusBtn = tr.querySelector('.row-insert-plus-btn');
  if (rowPlusBtn) {
    rowPlusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openInlineCreationRow(tr, task, rowIdx);
    });
  }
  const quickProgBtn = tr.querySelector('.quick-progress-btn');
  if (quickProgBtn) {
    quickProgBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openProgressPicker(quickProgBtn, task.key);
    });
  }
  const editModalBtn = tr.querySelector('.edit-modal-btn');
  if (editModalBtn) {
    editModalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openTaskDetailModal(task.key);
    });
  }
  const whyBtn = tr.querySelector('.why-date-btn');
  if (whyBtn) {
    whyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showWhy(task.key, whyBtn.getBoundingClientRect());
    });
  }
  const rowMoreBtn = tr.querySelector('.row-more-actions-btn');
  if (rowMoreBtn) {
    rowMoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openRowMoreMenu(rowMoreBtn, task, rowIdx, tr);
    });
  }
  const quickSubBtn = tr.querySelector('.quick-subtask-btn');
  if (quickSubBtn) {
    quickSubBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openTaskDetailModal(task.key);
      setTimeout(() => {
        const inp = document.getElementById('newSubtaskSummaryInput');
        if (inp) { inp.focus(); inp.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      }, 100);
    });
  }
  const quickResBtn = tr.querySelector('.quick-resource-btn');
  if (quickResBtn) {
    quickResBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openTaskDetailModal(task.key);
      setTimeout(() => {
        const sel = document.getElementById('multiResourceSelect');
        if (sel) { sel.focus(); sel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      }, 100);
    });
  }
  const unschedBtn = tr.querySelector('.unschedule-row-btn');
  if (unschedBtn) {
    unschedBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await callResolver('unscheduleTask', { taskId: task.key });
      await loadProjectPlan();
    });
  }
  const openJiraBtn = tr.querySelector('.open-jira-row-btn');
  if (openJiraBtn) {
    openJiraBtn.addEventListener('click', (e) => {
      openJiraIssueInNewTab(task.key, e);
    });
  }
  const taskKeyLink = tr.querySelector('.task-key-link');
  if (taskKeyLink) {
    taskKeyLink.addEventListener('click', (e) => {
      openJiraIssueInNewTab(task.key, e);
    });
  }

  // Tree Toggle Handler
  const treeToggle = tr.querySelector('.tree-toggle-btn');
  if (treeToggle) {
    treeToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (collapsedTasks.has(task.key)) {
        collapsedTasks.delete(task.key);
      } else {
        collapsedTasks.add(task.key);
      }
      renderTimelineRows();
      // The rebuilt row is a new element: keep keyboard focus on its toggle.
      document.querySelector(`.tree-toggle-btn[data-parent-key="${CSS.escape(task.key)}"]`)?.focus();
    });
  }

  // Intuitive row reordering: drag handle immediately, or press-and-hold / drag vertically from anywhere on row
  setupRowPointerReorder(tr, task);

  // Between-Row Drag & Drop (Backlog card insertion into middle of plan)
  tr.addEventListener('dragover', (e) => {
    e.preventDefault();
    const rect = tr.getBoundingClientRect();
    const isTop = (e.clientY - rect.top) < (rect.height / 2);
    if (isTop) {
      tr.classList.add('drop-insert-top');
      tr.classList.remove('drop-insert-bottom');
    } else {
      tr.classList.add('drop-insert-bottom');
      tr.classList.remove('drop-insert-top');
    }
  });
  tr.addEventListener('dragleave', (e) => {
    if (!tr.contains(e.relatedTarget)) {
      tr.classList.remove('drop-insert-top');
      tr.classList.remove('drop-insert-bottom');
    }
  });
  tr.addEventListener('drop', async (e) => {
    e.preventDefault();
    document.body.classList.remove('is-dragging-backlog');
    const rect = tr.getBoundingClientRect();
    const isTop = (e.clientY - rect.top) < (rect.height / 2);
    tr.classList.remove('drop-insert-top');
    tr.classList.remove('drop-insert-bottom');

    const dataStr = e.dataTransfer.getData('text/plain');
    if (!dataStr) return;
    try {
      const data = JSON.parse(dataStr);
      const entry = rowTasks.find(r => r.task.key === task.key);
      const baseIdx = entry ? entry.rowIdx : rowIdx;
      const targetIndex = isTop ? baseIdx : baseIdx + 1;
      if (data.fromReorder) {
        await callResolver('reorderWbsTasks', { taskId: data.taskId, targetIndex });
      } else if (data.taskId) {
        const curWk = (currentPlan?.weeks || []).find(w => w.isCurrentWeek)?.weekKey || currentPlan?.weeks[0]?.weekKey;
        await callResolver('scheduleBacklogTask', {
          taskId: data.taskId,
          startWeek: curWk,
          spanWeeks: 3,
          targetIndex
        });
      }
      await loadProjectPlan();
    } catch (err) {
      logFailure('row drop', err);
    }
  });

  // Timeline cell: drops land on the week under the pointer; the bar itself is drawn on the canvas.
  const trackTd = document.createElement('td');
  trackTd.className = 'timeline-track-cell';
  setupTrackDrop(trackTd, rowIdx);
  const hit = createBarHit(task, isEpic);
  if (hit) trackTd.appendChild(hit);
  tr.appendChild(trackTd);
  return tr;
}

function setupRowPointerReorder(tr, task) {
  tr.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const td = e.target.closest('td.td-data');
    if (!td) return;
    const onHandle = Boolean(e.target.closest('.row-drag-handle'));
    if (!onHandle && e.target.closest('button, a, input, select, textarea, .resource-chip-btn, .editable-badge-chip, .epic-link-chip, .progress-chip-cell, .target-chip-cell, .tree-toggle-btn, .row-action-btn, .row-insert-plus-btn')) {
      return;
    }
    if (onHandle) {
      e.preventDefault();
    }

    const startX = e.clientX;
    const startY = e.clientY;
    let lastX = startX;
    let lastY = startY;
    let active = false;
    let ghost = null;
    let grabOffsetY = ROW_H / 2;
    let hoveredTr = null;
    let dropTargetIndex = null;
    let hierarchyDrop = null;

    function clearHoveredIndicator() {
      if (hoveredTr) {
        hoveredTr.classList.remove('drop-insert-top', 'drop-insert-bottom', 'drop-into', 'drop-into-refused');
        hoveredTr = null;
      }
    }

    function activateDrag(curX, curY) {
      if (active) return;
      active = true;
      clearTimeout(holdTimer);
      try { window.getSelection()?.removeAllRanges?.(); } catch {}
      hideTooltip();

      const trRect = tr.getBoundingClientRect();
      grabOffsetY = Math.max(8, Math.min(ROW_H - 8, startY - trRect.top));
      const frozen = getFrozenLayout();

      ghost = document.createElement('div');
      ghost.className = 'row-drag-ghost';
      ghost.style.left = `${Math.max(4, trRect.left)}px`;
      ghost.style.top = `${curY - grabOffsetY}px`;
      ghost.style.width = `${Math.min(frozen.totalWidth, window.innerWidth - 16)}px`;

      const dataCells = [...tr.children].filter(c => !c.classList.contains('timeline-track-cell'));
      dataCells.forEach((cell, idx) => {
        const k = frozen.visibleKeys[idx];
        if (!k) return;
        const clone = document.createElement('div');
        clone.className = 'row-drag-ghost-cell';
        const w = frozen.widths[k];
        clone.style.width = `${w}px`;
        clone.style.minWidth = `${w}px`;
        clone.style.maxWidth = `${w}px`;
        for (const child of cell.childNodes) {
          clone.appendChild(child.cloneNode(true));
        }
        clone.querySelectorAll('.row-action-toolbar, .row-insert-affordance').forEach(n => n.remove());
        ghost.appendChild(clone);
      });

      document.body.appendChild(ghost);
      tr.classList.add('is-row-dragging');
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      updateDropTarget(curX, curY);
    }

    function updateDropTarget(curX, curY) {
      if (!active || !ghost) return;
      ghost.style.top = `${curY - grabOffsetY}px`;

      const wrapper = document.getElementById('ganttWrapper');
      if (wrapper) {
        const wRect = wrapper.getBoundingClientRect();
        const topEdge = wRect.top + (layout.headerH || 40) + 28;
        const bottomEdge = wRect.bottom - 28;
        if (curY < topEdge && wrapper.scrollTop > 0) {
          wrapper.scrollTop = Math.max(0, wrapper.scrollTop - 14);
        } else if (curY > bottomEdge) {
          wrapper.scrollTop += 14;
        }
      }

      clearHoveredIndicator();
      dropTargetIndex = null;
      const under = document.elementFromPoint(curX, curY);
      const overTr = under ? under.closest('tr.task-row') : null;
      if (overTr && overTr !== tr) {
        const r = overTr.getBoundingClientRect();
        const rel = (curY - r.top) / r.height;
        // The middle third means "move under this row" (N-08); the outer thirds reorder.
        if (rel > 1 / 3 && rel < 2 / 3) {
          hierarchyDrop = { target: overTr.dataset.taskId, action: hierarchyActionFor(task, findAnyTask(overTr.dataset.taskId)) };
          overTr.classList.add('drop-into');
          overTr.classList.toggle('drop-into-refused', !!(hierarchyDrop.action && hierarchyDrop.action.refuse));
          if (ghost) ghost.dataset.hint = hierarchyDrop.action ? (hierarchyDrop.action.refuse || hierarchyDrop.action.label) : '';
          hoveredTr = overTr;
          return;
        }
        hierarchyDrop = null;
        if (ghost) ghost.dataset.hint = '';
        const isTop = rel < 0.5;
        overTr.classList.toggle('drop-insert-top', isTop);
        overTr.classList.toggle('drop-insert-bottom', !isTop);
        hoveredTr = overTr;
        const overEntry = rowTasks.find(x => x.task.key === overTr.dataset.taskId);
        if (overEntry) {
          dropTargetIndex = isTop ? overEntry.rowIdx : overEntry.rowIdx + 1;
        }
      }
    }

    const holdTimer = !onHandle
      ? setTimeout(() => activateDrag(lastX, lastY), 180)
      : null;

    function onMove(ev) {
      lastX = ev.clientX;
      lastY = ev.clientY;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!active) {
        if (onHandle) {
          if (Math.abs(dx) >= 3 || Math.abs(dy) >= 3) {
            activateDrag(ev.clientX, ev.clientY);
          }
          return;
        }
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          cleanup();
          return;
        }
        if (Math.abs(dy) >= 6) {
          activateDrag(ev.clientX, ev.clientY);
        }
        return;
      }

      ev.preventDefault();
      updateDropTarget(ev.clientX, ev.clientY);
    }

    function cleanup() {
      if (holdTimer) clearTimeout(holdTimer);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      clearHoveredIndicator();
      if (ghost) {
        ghost.remove();
        ghost = null;
      }
      tr.classList.remove('is-row-dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    async function onUp() {
      const wasActive = active;
      const targetIdx = dropTargetIndex;
      const into = hierarchyDrop;
      cleanup();
      if (!wasActive) return;
      if (into) {
        requestHierarchyChange(task.key, into.action);
        return;
      }

      const suppressClick = (ce) => {
        ce.stopPropagation();
        ce.preventDefault();
        window.removeEventListener('click', suppressClick, true);
      };
      window.addEventListener('click', suppressClick, true);
      setTimeout(() => window.removeEventListener('click', suppressClick, true), 80);

      if (targetIdx === null) return;
      const ownEntry = rowTasks.find(x => x.task.key === task.key);
      if (ownEntry && (targetIdx === ownEntry.rowIdx || targetIdx === ownEntry.rowIdx + 1)) {
        return;
      }
      await callResolver('reorderWbsTasks', { taskId: task.key, targetIndex: targetIdx });
      await loadProjectPlan();
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

function setupDropTargetRow(rowEl, targetIndex) {
  rowEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    rowEl.classList.add('drag-over');
  });
  rowEl.addEventListener('dragleave', () => {
    rowEl.classList.remove('drag-over');
  });
  rowEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    document.body.classList.remove('is-dragging-backlog');
    rowEl.classList.remove('drag-over');
    const dataStr = e.dataTransfer.getData('text/plain');
    if (dataStr) {
      const data = JSON.parse(dataStr);
      if (data.fromReorder) {
        await callResolver('reorderWbsTasks', { taskId: data.taskId, targetIndex });
      } else {
        const curWk = (currentPlan?.weeks || []).find(w => w.isCurrentWeek)?.weekKey || currentPlan?.weeks[0]?.weekKey;
        await callResolver('scheduleBacklogTask', {
          taskId: data.taskId,
          startWeek: curWk,
          spanWeeks: 3,
          targetIndex
        });
      }
      await loadProjectPlan();
    }
  });
}


/** Drop from the backlog or a row drag onto the timeline: the week comes from the pointer x (B-03). */
function setupTrackDrop(trackTd, rowIdx) {
  let badge = null;
  // The day under the pointer; at Month zoom and above it snaps to the Monday (B-27).
  const dayAt = (e) => {
    const d = dateAt(e.clientX - trackTd.getBoundingClientRect().left, originIso(), dayPx());
    return zoomById(zoomId).snap === 'week' ? mondayOf(d) : d;
  };
  const clear = () => {
    trackTd.classList.remove('drag-over-cell');
    if (badge) badge.remove();
    badge = null;
  };
  trackTd.addEventListener('dragover', (e) => {
    e.preventDefault();
    const d = dayAt(e);
    trackTd.classList.add('drag-over-cell');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'drop-slot-badge';
      trackTd.appendChild(badge);
    }
    badge.style.left = (xForDate(d, originIso(), dayPx()) + 4) + 'px';
    badge.textContent = `📅 ${d}`;
  });
  trackTd.addEventListener('dragleave', (e) => {
    if (!trackTd.contains(e.relatedTarget)) clear();
  });
  trackTd.addEventListener('drop', async (e) => {
    e.preventDefault();
    // The row also listens for drops; one drop must send exactly one schedule call (B-03).
    e.stopPropagation();
    document.body.classList.remove('is-dragging-backlog');
    const d = dayAt(e);
    clear();
    const dataStr = e.dataTransfer.getData('text/plain');
    if (!dataStr) return;
    const data = JSON.parse(dataStr);
    if (data.fromReorder) {
      await callResolver('reorderWbsTasks', { taskId: data.taskId, targetIndex: rowIdx });
    } else {
      await callResolver('scheduleBacklogTask', { taskId: data.taskId, startWeek: '', startDate: d, spanWeeks: 3, targetIndex: rowIdx });
    }
    await loadProjectPlan();
  });
}

/** Places a hit element over its bar and names it for assistive technology. */
function positionBarHit(hit, task) {
  const r = barRect(task, originIso(), dayPx(), 0, ROW_H, BAR_H);
  if (!r) {
    hit.hidden = true;
    return;
  }
  hit.hidden = false;
  hit.style.left = r.x + 'px';
  hit.style.top = r.y + 'px';
  hit.style.width = r.w + 'px';
  hit.style.height = r.h + 'px';
  const h = handleOffsets(r.w);
  const left = hit.querySelector('.bar-handle-left');
  const right = hit.querySelector('.bar-handle-right');
  if (left) left.style.left = h.left + 'px';
  if (right) right.style.left = h.right + 'px';
  // The link ports sit outside the resize handles, so the bar's edges stay free for resizing.
  const p = portOffsets(r.w);
  const portL = hit.querySelector('.bar-link-port-left');
  const portR = hit.querySelector('.bar-link-port-right');
  if (portL) portL.style.left = p.left + 'px';
  if (portR) portR.style.left = p.right + 'px';
  hit.setAttribute('aria-label', `${task.key}: ${task.summary || ''}, ${task.startDate} to ${task.endDate || task.startDate}, ${task.progress || 0}% done`);
}

/** Transparent element over a bar: it has no background; the canvas draws the bar. */
function createBarHit(task, isEpic) {
  if (!task.startDate) return null;
  const key = task.key;
  const hit = document.createElement('div');
  hit.className = 'bar-hit' + (isEpic || task.datesFromChildren ? ' is-epic' : '') + (pinnedDependencyTaskId === key ? ' is-pinned' : '');
  hit.dataset.taskId = key;
  // Pointer only: keyboard and screen readers use the treegrid in the canvas (one tab stop, B-15).
  hit.setAttribute('aria-hidden', 'true');

  // Resize handles and drag (not on epics, and not on a parent whose dates follow its children, B-28).
  if (!isEpic && !task.datesFromChildren) {
    for (const edge of ['left', 'right']) {
      const handle = document.createElement('div');
      handle.className = `bar-handle bar-handle-${edge}`;
      handle.setAttribute('aria-hidden', 'true');
      handle.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        startBarPointerEdit(e, key, edge, hit);
      });
      hit.appendChild(handle);
    }
    hit.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.classList.contains('bar-handle') || e.target.closest('.bar-link-port')) return;
      e.preventDefault();
      startBarPointerEdit(e, key, 'move', hit);
    });
  } else if (!isEpic && isBlockParent(task)) {
    // A roll-up parent moves with its sub-tasks; it is never resized (ADR-003 section 7).
    hit.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('.bar-link-port')) return;
      e.preventDefault();
      startBarPointerEdit(e, key, 'move', hit);
    });
  }
  if (!isEpic) {
    for (const side of ['right', 'left']) {
      const port = document.createElement('div');
      port.className = `bar-link-port bar-link-port-${side}`;
      port.textContent = '➔';
      port.title = side === 'right'
        ? `Drag arrow to successor task (which will depend on ${task.key})`
        : `Drag arrow to predecessor task (which ${task.key} will depend on)`;
      port.setAttribute('aria-hidden', 'true');
      port.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        startVisualLinkDrag(e, key, hit, side);
      });
      hit.appendChild(port);
    }
  }
  positionBarHit(hit, task);

  // Hover shows the tooltip and highlights the dependency chain: one canvas draw, no DOM rebuild.
  hit.addEventListener('mouseenter', (e) => {
    const t = findTask(key);
    if (t) showTaskTooltip(e, t);
    hoveredTaskId = key;
    drawTimeline(true);
  });
  hit.addEventListener('mouseleave', () => {
    hideTooltip();
    hoveredTaskId = null;
    drawTimeline(true);
  });
  hit.addEventListener('click', (e) => {
    if (!e.defaultPrevented && !isDraggingBar && !e.target.closest('.bar-link-port')) {
      pinnedDependencyTaskId = pinnedDependencyTaskId === key ? null : key;
      syncPinnedBarHit();
      // The clicked bar's row takes grid focus in the same frame, and the toolbar opens (B-15).
      const i = rowTasks.findIndex(r => r.task.key === key);
      if (i >= 0 && gridRoot) {
        gridFocus = { row: i, col: 2 };
        renderGrid();
        focusGridCell();
      }
      drawTimeline(true);
      // A double-click opens the form instead; the toolbar waits until that is ruled out.
      clearTimeout(toolbarTimer);
      toolbarTimer = setTimeout(() => openBarToolbar(key, hit), DOUBLE_CLICK_MS);
    }
  });
  hit.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    clearTimeout(toolbarTimer);
    closeBarToolbar();
    openTaskDetailModal(key);
  });
  hit.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openProgressPicker(hit, key);
  });
  return hit;
}

function startVisualLinkDrag(e, sourceKey, hit, side = 'right') {
  const sourceTask = findTask(sourceKey);
  if (!sourceTask || !sourceTask.startDate || !timeline) return;
  const wrapper = document.getElementById('ganttWrapper');
  if (!wrapper) return;
  closeBarToolbar();
  hideTooltip();

  const hitRect = hit.getBoundingClientRect();
  const initWRect = wrapper.getBoundingClientRect();
  const x1 = (side === 'left' ? hitRect.left : hitRect.right) - initWRect.left + wrapper.scrollLeft;
  const y1 = (hitRect.top + hitRect.height / 2) - initWRect.top + wrapper.scrollTop;

  document.body.style.cursor = 'crosshair';
  document.body.style.userSelect = 'none';

  function onMove(ev) {
    const wRect = wrapper.getBoundingClientRect();
    const curX = ev.clientX - wRect.left + wrapper.scrollLeft;
    const curY = ev.clientY - wRect.top + wrapper.scrollTop;

    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    let targetHit = el ? el.closest('.bar-hit') : null;
    let targetKey = targetHit && targetHit.dataset.taskId !== sourceKey ? targetHit.dataset.taskId : null;
    if (!targetKey && el) {
      const row = el.closest('tr[data-task-id]');
      if (row && row.getAttribute('data-task-id') !== sourceKey) {
        targetKey = row.getAttribute('data-task-id');
        targetHit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(targetKey)}"]`);
      }
    }

    const predKey = side === 'right' ? sourceKey : targetKey;
    const succKey = side === 'right' ? targetKey : sourceKey;

    timeline.activeLinking = { sourceKey, x1, y1, curX, curY, targetKey, predKey, succKey };
    timeline.requestDraw();
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    const active = timeline.activeLinking;
    const targetKey = active ? active.targetKey : null;
    timeline.activeLinking = null;
    timeline.requestDraw();

    if (targetKey) {
      const targetHit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(targetKey)}"]`);
      const anchorEl = targetHit || hit;
      const rect = anchorEl.getBoundingClientRect();
      openDependencyEditPopover(
        buildDraggedDependencyLink(sourceKey, targetKey, 100, side),
        { getBoundingClientRect: () => rect }
      );
    }
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

/**
 * Returns whether dependency enforcement is active (auto-snapping moves to respect predecessor milestones).
 */
export function isEnforceDepsEnabled() {
  const enforceBox = document.getElementById('enforceDependenciesCheckbox');
  let storageVal = null;
  try {
    storageVal = localStorage.getItem('cascadeplan_enforce_deps');
  } catch (e) {}
  return isEnforceDepsActive(enforceBox, storageVal);
}

/**
 * Drag (move) or resize (left, right) of a bar. Snaps to days at Day and Week zoom and to weeks above
 * that; hold Alt for days at any zoom (B-27). Dependents
 * move live as a preview from the same schedule engine as the server, with dashed outlines at their
 * old positions. A drop sends one updateWbsTask call with exact dates and uses the plan it returns.
 */
function startBarPointerEdit(e, key, mode, hit) {
  const task = findTask(key);
  if (!task || !task.startDate || !timeline) return;
  const wrapper = document.getElementById('ganttWrapper');
  const startX = e.clientX;
  const today = todayIso();
  let shift = 0;
  let moved = false;
  document.body.style.cursor = mode === 'move' ? 'grabbing' : 'col-resize';
  document.body.style.userSelect = 'none';
  hideTooltip();

  function onMove(ev) {
    const dx = ev.clientX - startX;
    if (!moved && Math.abs(dx) > 4) {
      moved = true;
      isDraggingBar = true;
    }
    if (!moved) return;
    const s = snapDays(dx, dayPx(), ev.altKey ? 'day' : zoomById(zoomId).snap);
    if (s === shift && timeline.drag) return;
    shift = s;
    const mine = shiftDates(task, mode === 'right' ? 0 : s, mode === 'left' ? 0 : s);
    if (!mine) return;
    const moves = new Map([[key, mine]]);

    const conflict = checkDependencyConflict({ key, startDate: mine.start }, currentPlan.tasks, today);
    const isConflict = conflict.hasConflict;
    const enforceDeps = isEnforceDepsEnabled();
    const sign = s > 0 ? `+${s}` : `${s}`;
    let label = mode === 'move' ? `${key} ➔ ${mine.start} (${sign}d)` : `${key} ${mine.start} to ${mine.end}`;
    let wasSnapped = false;

    if (isConflict) {
      if (enforceDeps) {
        const clampedDates = clampToEarliestStart(mine.start, mine.end, conflict.earliestDate);
        wasSnapped = true;
        label = mode === 'move'
          ? `${key} ➔ ${clampedDates.startDate} (Enforced: ${conflict.predKey})`
          : `${key} ${clampedDates.startDate} to ${clampedDates.endDate} (Enforced: ${conflict.predKey})`;
        moves.set(key, { start: clampedDates.startDate, end: clampedDates.endDate });
      } else {
        label += ` · ⚠️ Conflict: ${conflict.predKey} (${conflict.triggerPercent}%)`;
      }
    }

    let currentMine = moves.get(key) || mine;
    // The preview lists every Jira write of the drop, computed as the server will (INV-03, H2).
    let preview;
    if (isBlockParent(task)) {
      const days = s !== 0 ? effectiveBlockDays(key, s) : 0;
      currentMine = { start: addDaysIso(task.startDate, days), end: addDaysIso(task.endDate || task.startDate, days) };
      preview = dropPreview(key, currentMine.start, currentMine.end, days);
    } else {
      preview = dropPreview(key, currentMine.start, currentMine.end);
    }
    timeline.drag = {
      key,
      moves: preview.moves,
      label,
      isConflict: enforceDeps ? false : isConflict,
      wasSnapped,
      earliestDate: conflict.earliestDate,
      predKey: conflict.predKey
    };
    positionBarHit(hit, { ...task, startDate: currentMine.start, endDate: currentMine.end });
    wrapper.dataset.preview = JSON.stringify(Object.fromEntries(preview.moves));

    // Auto-expand time range dynamically when dragging/resizing beyond current boundaries
    if (timeRange && mine) {
      if (mine.start < timeRange.start) {
        const diffDays = daysBetween(mine.start, timeRange.start);
        const addWeeks = Math.max(2, Math.ceil(diffDays / 7) + 2);
        const oldStart = timeRange.start;
        timeRange = { start: addDaysIso(timeRange.start, -addWeeks * 7), end: timeRange.end };
        const shiftPx = daysBetween(timeRange.start, oldStart) * dayPx();
        applyTimeAxis();
        wrapper.scrollLeft += shiftPx;
      } else if (mine.end > timeRange.end) {
        const diffDays = daysBetween(timeRange.end, mine.end);
        const addWeeks = Math.max(2, Math.ceil(diffDays / 7) + 2);
        timeRange = { start: timeRange.start, end: addDaysIso(timeRange.end, addWeeks * 7) };
        applyTimeAxis();
      }

      // Auto-scroll when cursor drags near edges of ganttWrapper
      const wrapRect = wrapper.getBoundingClientRect();
      const edgeBuffer = 50;
      const trackLeftPx = (layout && layout.trackLeft) || 300;
      if (ev.clientX > wrapRect.right - edgeBuffer) {
        wrapper.scrollLeft += 15;
      } else if (ev.clientX < wrapRect.left + trackLeftPx + edgeBuffer) {
        wrapper.scrollLeft = Math.max(0, wrapper.scrollLeft - 15);
      }
    }

    // Name every issue and field the drop will change before the user lets go (B-23, INV-11).
    const strip = document.getElementById('writePreview');
    if (strip) {
      let desc = preview.text;
      if (isConflict) {
        if (enforceDeps) {
          desc = `🔒 Enforce dependencies: will snap ${key} to ${conflict.earliestDate} to satisfy dependency on ${conflict.predKey}. ${desc}`;
        } else {
          desc = `⚠️ Conflict: ${key} scheduled before ${conflict.predKey} reaches ${conflict.triggerPercent}% on ${conflict.triggerDate || conflict.earliestDate}. ${desc}`;
        }
      }
      strip.textContent = desc;
      strip.hidden = false;
      placeStripNear(strip, key);
    }
    timeline.requestDraw();
  }

  async function onUp() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (moved) {
      const swallowTimer = setTimeout(() => {
        window.removeEventListener('click', swallowClick, true);
        isDraggingBar = false;
      }, 150);
      const swallowClick = (ev) => {
        clearTimeout(swallowTimer);
        ev.stopPropagation();
        ev.preventDefault();
        window.removeEventListener('click', swallowClick, true);
        setTimeout(() => { isDraggingBar = false; }, 40);
      };
      window.addEventListener('click', swallowClick, true);
    } else {
      isDraggingBar = false;
    }
    delete wrapper.dataset.preview;
    const strip = document.getElementById('writePreview');
    if (strip) strip.hidden = true;
    const dragInfo = timeline.drag;
    const mine = dragInfo && dragInfo.moves && dragInfo.moves.get(key);
    if (!moved || shift === 0 || !mine) {
      timeline.drag = null;
      positionBarHit(hit, task);
      drawTimeline();
      return;
    }
    if (isBlockParent(task)) {
      timeline.drag = null;
      await moveBlock(key, shift);
      return;
    }

    const enforceDeps = isEnforceDepsEnabled();
    let finalStart = mine.start;
    let finalEnd = mine.end;
    let conflict = checkDependencyConflict({ key, startDate: finalStart }, currentPlan.tasks, today);
    const wasSnapped = Boolean(dragInfo && dragInfo.wasSnapped);
    const earliestDate = (dragInfo && dragInfo.earliestDate) || conflict.earliestDate;
    const predKey = (dragInfo && dragInfo.predKey) || conflict.predKey;

    if (conflict.hasConflict && enforceDeps) {
      const clamped = clampToEarliestStart(finalStart, finalEnd, conflict.earliestDate);
      finalStart = clamped.startDate;
      finalEnd = clamped.endDate;
    }

    if (finalStart === task.startDate && finalEnd === (task.endDate || task.startDate)) {
      timeline.drag = null;
      positionBarHit(hit, task);
      drawTimeline(true);
      if (wasSnapped || (conflict.hasConflict && enforceDeps)) {
        announce(`Enforce dependencies: ${key} cannot start before ${earliestDate} (dependency on ${predKey}).`);
      }
      return;
    }

    const updates = { startDate: finalStart, endDate: finalEnd };
    // A resize changes dates only. The estimate changes only when the user ticked the option (B-03).
    const autoScale = mode !== 'move' && document.getElementById('autoScaleEffortCheckbox')?.checked === true;
    if (autoScale && task.effortHours > 0) {
      const oldDays = daysBetween(task.startDate, task.endDate || task.startDate) + 1;
      const newDays = daysBetween(finalStart, finalEnd) + 1;
      updates.effortHours = Math.max(1, Math.round((task.effortHours * newDays) / oldDays));
    }
    // The Undo snapshot is taken before the optimistic change below (F-04).
    const undoBefore = snapshotPlan(currentPlan);
    // Optimistically update in-memory task dates immediately so the bar does not flicker or snap back while the network request is in flight
    const prevStart = task.startDate;
    const prevEnd = task.endDate;
    task.startDate = finalStart;
    task.endDate = finalEnd;
    timeline.drag = null;
    positionBarHit(hit, task);
    drawTimeline(true);

    try {
      // C3: the Jira due date this user saw; the server refuses the move when Jira changed it since.
      // With "Enforce dependencies" on, the server checks the same links again before any write (L5).
      const res = await callResolver('updateWbsTask', { taskId: key, updates, expectedVersion: task.version || 0,
        expectedDueDate: task.jiraDueDate ? String(task.jiraDueDate).slice(0, 10) : null, enforceDependencies: enforceDeps }, { before: undoBefore });
      if (res && Array.isArray(res.tasks)) {
        applyPlanInPlace(res);
      } else {
        await loadProjectPlan();
      }
    } catch (err) {
      task.startDate = prevStart;
      task.endDate = prevEnd;
      positionBarHit(hit, task);
      drawTimeline(true);
      showFlag({ text: 'Failed to update dates: ' + String(err), error: true });
    }

    if (conflict.hasConflict && !enforceDeps) {
      const updatedHit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(key)}"]`) || hit;
      showDependencyConflictDialog({
        key,
        candidateStart: finalStart,
        candidateEnd: finalEnd,
        conflict,
        task,
        prevStart,
        prevEnd,
        hit: updatedHit,
        mode
      });
    } else if (wasSnapped || (conflict.hasConflict && enforceDeps)) {
      announce(`Enforce dependencies: snapped ${key} start to ${earliestDate} to satisfy dependency on ${predKey}.`);
    }
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

let conflictState = null;

function showDependencyConflictDialog(state) {
  const banner = document.getElementById('depConflictBanner');
  if (!banner) return;
  popoverOpenedAt = performance.now();
  conflictState = state;
  const { key, candidateStart, conflict } = state;
  const pred = findTask(conflict.predKey);
  const msgEl = document.getElementById('depConflictMessage');
  if (msgEl) {
    msgEl.textContent = `${key} is scheduled to start on ${candidateStart}, but depends on ${conflict.predKey} reaching ${conflict.triggerPercent}% on ${conflict.triggerDate || conflict.earliestDate}.`;
  }
  const snapBtn = document.getElementById('btnConflictSnap');
  if (snapBtn) snapBtn.textContent = `Snap to Earliest Start (${conflict.earliestDate})`;

  const suggestedPct = pred ? suggestTriggerToFit(pred, candidateStart) : 0;
  const adjustBtn = document.getElementById('btnConflictAdjust');
  if (adjustBtn) adjustBtn.textContent = `Adjust Trigger to ${suggestedPct}%`;

  banner.hidden = false;
  const r = state.hit && state.hit.getBoundingClientRect ? state.hit.getBoundingClientRect() : { bottom: 200, left: 200 };
  banner.style.top = `${Math.max(8, Math.min(window.innerHeight - banner.offsetHeight - 8, r.bottom + 6))}px`;
  banner.style.left = `${Math.max(8, Math.min(window.innerWidth - banner.offsetWidth - 8, r.left))}px`;
}

function closeDependencyConflictDialog() {
  const banner = document.getElementById('depConflictBanner');
  if (banner) banner.hidden = true;
  conflictState = null;
}

async function applyConflictSnap() {
  if (!conflictState) return;
  const { key, candidateStart, candidateEnd, conflict } = conflictState;
  const clamped = clampToEarliestStart(candidateStart, candidateEnd, conflict.earliestDate);
  closeDependencyConflictDialog();
  await commitDates(key, clamped.startDate, clamped.endDate);
}

async function applyConflictAdjust() {
  if (!conflictState) return;
  const { key, candidateStart, candidateEnd, conflict } = conflictState;
  const pred = findTask(conflict.predKey);
  const suggestedPct = pred ? suggestTriggerToFit(pred, candidateStart) : 0;
  closeDependencyConflictDialog();
  const task = findTask(key);
  await callResolver('updateWbsTask', {
    taskId: key,
    updates: {
      startDate: candidateStart,
      endDate: candidateEnd,
      dependency: {
        predecessorKey: conflict.predKey,
        predecessorId: conflict.predKey,
        triggerPercent: suggestedPct,
        isTriggerSatisfied: false
      }
    },
    expectedVersion: (task && task.version) || 0
  });
  await loadProjectPlan();
  announce(`Adjusted trigger on ${conflict.predKey} to ${suggestedPct}% and moved ${key} to ${candidateStart}.`);
}

function applyConflictKeep() {
  closeDependencyConflictDialog();
  announce('Kept schedule with dependency violation.');
}

async function applyConflictCancel() {
  if (!conflictState) return;
  // The dates before the drag: the task object already holds the new ones (F-04).
  const { key, prevStart, prevEnd } = conflictState;
  closeDependencyConflictDialog();
  if (!prevStart) {
    announce(`${key} had no dates before the move, so there is nothing to revert to.`);
    return;
  }
  const res = await commitDates(key, prevStart, prevEnd || prevStart);
  announce(classifyResult(res).failed ? `${key} could not be reverted.` : `Reverted ${key} to ${prevStart}.`);
}


// Keyboard and single-pointer scheduling (B-15). The treegrid lives in the canvas fallback content:
// focusable and accessible, no visual box, and drawFocusIfNeeded draws the native focus ring.
let gridRoot = null;
let lastGridKey = null; // issue that last had grid focus; a toolbar click does not clear it (B-27)
let toolbarTimer = 0;
const DOUBLE_CLICK_MS = 250;
let gridFocus = { row: 0, col: 0 };
let moveState = null;
const SHORTCUT_KEY = 'cascadeplan_shortcuts';

function shortcutsOn() {
  const box = document.getElementById('shortcutsToggle');
  return !box || box.checked;
}

function announce(text) {
  const live = document.getElementById('cpLive');
  if (live) live.textContent = text;
}

function initGrid() {
  if (!timeline || gridRoot) return;
  gridRoot = document.createElement('div');
  gridRoot.setAttribute('role', 'treegrid');
  gridRoot.setAttribute('aria-label', 'Schedule');
  gridRoot.setAttribute('aria-colcount', String(GRID_COLUMNS.length));
  timeline.root.appendChild(gridRoot);
  gridRoot.addEventListener('keydown', onGridKey);
  gridRoot.addEventListener('focusin', (e) => {
    const cell = e.target.closest('[role="gridcell"]');
    if (!cell) return;
    gridFocus = { row: Number(cell.parentElement.dataset.row), col: Number(cell.dataset.col) };
    const key = rowTasks[gridFocus.row]?.task.key || null;
    lastGridKey = key;
    timeline.focusKey = key;
    timeline.focusElement = cell;
    document.querySelectorAll('#ganttBody tr.is-grid-focused').forEach(r => r.classList.remove('is-grid-focused'));
    const tr = key && rowCache.get(key);
    if (tr) tr.classList.add('is-grid-focused');
    drawTimeline(true);
  });
  gridRoot.addEventListener('focusout', (e) => {
    if (gridRoot.contains(e.relatedTarget)) return;
    timeline.focusKey = null;
    timeline.focusElement = null;
    document.querySelectorAll('#ganttBody tr.is-grid-focused').forEach(r => r.classList.remove('is-grid-focused'));
    drawTimeline(true);
  });
}

/** Rows of the treegrid for the DOM row range, with absolute aria-rowindex (header is row 1). */
function renderGrid() {
  if (!gridRoot) return;
  const hadFocus = gridRoot.contains(document.activeElement);
  const planKeys = new Set((currentPlan?.tasks || []).map(t => t.key));
  gridRoot.setAttribute('aria-rowcount', String(rowTasks.length + 1));
  const header = document.createElement('div');
  header.setAttribute('role', 'row');
  header.setAttribute('aria-rowindex', '1');
  GRID_COLUMNS.forEach((name, c) => {
    const h = document.createElement('span');
    h.setAttribute('role', 'columnheader');
    h.setAttribute('aria-colindex', String(c + 1));
    h.textContent = name;
    header.appendChild(h);
  });
  const rows = [header];
  const { first, last } = renderedRange;
  if (gridFocus.row < first || gridFocus.row > last) gridFocus = { row: Math.max(first, viewportFirstRow()), col: gridFocus.col };
  for (let i = first; i <= last; i++) {
    const t = rowTasks[i].task;
    const row = document.createElement('div');
    row.setAttribute('role', 'row');
    row.setAttribute('aria-rowindex', String(i + 2));
    row.setAttribute('aria-level', String(rowLevel(t, planKeys)));
    if (rowParentKeys.has(t.key)) row.setAttribute('aria-expanded', collapsedTasks.has(t.key) ? 'false' : 'true');
    row.dataset.row = String(i);
    rowCells(t).forEach((text, c) => {
      const cell = document.createElement('span');
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-colindex', String(c + 1));
      cell.dataset.col = String(c);
      cell.tabIndex = i === gridFocus.row && c === gridFocus.col ? 0 : -1;
      cell.textContent = text;
      row.appendChild(cell);
    });
    rows.push(row);
  }
  gridRoot.replaceChildren(...rows);
  applySelection();
  if (hadFocus) focusGridCell();
}

function viewportFirstRow() {
  const wrapper = document.getElementById('ganttWrapper');
  if (!wrapper) return 0;
  return Math.max(0, Math.min(rowTasks.length - 1, Math.ceil((wrapper.scrollTop + layout.headerH - layout.bodyStart) / ROW_H)));
}

function focusGridCell() {
  const inField = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT' || document.activeElement.isContentEditable);
  if (inField) return;
  const cell = gridRoot && gridRoot.querySelector(`[role="row"][data-row="${gridFocus.row}"] [data-col="${gridFocus.col}"]`);
  if (cell) {
    gridRoot.querySelectorAll('[role="gridcell"][tabindex="0"]').forEach(c => { c.tabIndex = -1; });
    cell.tabIndex = 0;
    cell.focus({ preventScroll: true });
  }
}

/** Keeps a row clear of the sticky header, the viewport edges and any Flag (WCAG 2.4.11). */
function ensureRowVisible(i) {
  const wrapper = document.getElementById('ganttWrapper');
  if (!wrapper) return;
  const top = rowTop(i);
  const flags = document.getElementById('flagGroup');
  const flagH = flags && flags.children.length ? flags.getBoundingClientRect().height + 16 : 8;
  const viewTop = wrapper.scrollTop + layout.headerH;
  const viewBottom = wrapper.scrollTop + wrapper.clientHeight - flagH;
  if (top < viewTop) wrapper.scrollTop = top - layout.headerH - 8;
  else if (top + ROW_H > viewBottom) wrapper.scrollTop = top + ROW_H - wrapper.clientHeight + flagH;
  const t = rowTasks[i] && rowTasks[i].task;
  if (t && t.startDate) {
    const x = layout.trackLeft + xForDate(t.startDate, originIso(), dayPx());
    if (x < wrapper.scrollLeft + layout.trackLeft + 40 || x > wrapper.scrollLeft + wrapper.clientWidth - 80) wrapper.scrollLeft = Math.max(0, x - layout.trackLeft - 120);
  }
}

function setGridFocus(row, col) {
  gridFocus = { row, col };
  ensureRowVisible(row);
  updateVirtualRows();
  focusGridCell();
}

function onGridKey(e) {
  if (moveState) {
    onMoveKey(e);
    return;
  }
  const task = rowTasks[gridFocus.row]?.task;
  const page = Math.max(1, Math.floor((document.getElementById('ganttWrapper').clientHeight - layout.headerH) / ROW_H) - 1);
  const next = navigate(gridFocus, e, rowTasks.length, GRID_COLUMNS.length, page);
  if (next) {
    e.preventDefault();
    setGridFocus(next.row, next.col);
    return;
  }
  if (!task) return;
  const digit = progressFromDigit(e.key);
  if (digit !== null && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    setPendingProgress(task.key, digit);
    return;
  }
  if (e.key === 'Enter' && pendingProgress.size) {
    e.preventDefault();
    commitPendingProgress();
    return;
  }
  if (e.key === 'Escape' && pendingProgress.size) {
    pendingProgress.clear();
    renderTimelineRows();
    announce('Progress changes discarded.');
    return;
  }
  // Space moves the bar on the Start or Due cell; on any other cell it selects the row (B-15, B-16).
  if (e.key === ' ' && gridFocus.col !== 2 && gridFocus.col !== 3) {
    e.preventDefault();
    selectRow(task.key, { shiftKey: false });
    announce(`${task.key} ${selectedKeys.has(task.key) ? 'selected' : 'not selected'}. ${selectedKeys.size} selected.`);
    return;
  }
  if (e.key === ' ' && task.startDate && !(task.isEpic || task.hierarchyLevel === 1)) {
    if (task.datesFromChildren && !isBlockParent(task)) {
      e.preventDefault();
      announce(`${task.key} follows the dates of its children. Move a child instead.`);
      return;
    }
    e.preventDefault();
    startMoveMode(task);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    openTaskDetailModal(task.key);
  }
}

/**
 * Puts the preview line just above the moved bar's row. The planner's frame grows with its content, so a
 * line fixed to the bottom of the frame can be below the window (owner report); the bar being moved
 * is always where the user is looking.
 */
function placeStripNear(strip, key) {
  const row = document.querySelector(`#ganttBody tr.task-row[data-task-id="${CSS.escape(key)}"]`);
  if (!row) return;
  const r = row.getBoundingClientRect();
  const h = strip.offsetHeight || 32;
  strip.style.top = `${Math.max(8, r.top - h - 6)}px`;
  strip.style.bottom = 'auto';
}

/** Shows the live preview for day shifts of a task, as a drag does (B-13, B-23). */
function showShiftPreview(key, startShift, endShift, label) {
  const task = findTask(key);
  const block = isBlockParent(task) && startShift === endShift && startShift !== 0;
  // A block parent's preview shows where each sub-task goes (ADR-003); either way the line lists every
  // Jira write of the drop, computed as the server will (INV-03, H2).
  const days = block ? effectiveBlockDays(key, startShift) : undefined;
  const shifted = task && shiftDates(task, block ? days : startShift, block ? days : endShift);
  if (!shifted) return undefined;
  const preview = dropPreview(key, shifted.start, shifted.end, days);
  const mine = preview.moves.get(key);
  timeline.drag = { key, moves: preview.moves, label: label(mine) };
  const strip = document.getElementById('writePreview');
  if (strip) {
    strip.textContent = preview.text;
    strip.hidden = false;
    placeStripNear(strip, key);
  }
  timeline.requestDraw();
  return mine;
}

function clearShiftPreview() {
  timeline.drag = null;
  const strip = document.getElementById('writePreview');
  if (strip) strip.hidden = true;
  drawTimeline();
}

/** One updateWbsTask call with exact dates and the version; the returned plan is used (B-13, B-14). */
async function commitDates(key, start, end, opts = {}) {
  const task = findTask(key);
  // C3: the Jira due date this user saw; the server refuses the move when Jira changed it since.
  // A move with "Enforce dependencies" on asks the server to check the links again (L5).
  const res = await callResolver('updateWbsTask', { taskId: key, updates: { startDate: start, endDate: end }, expectedVersion: (task && task.version) || 0,
    expectedDueDate: (task && task.jiraDueDate) ? String(task.jiraDueDate).slice(0, 10) : null,
    ...(opts.enforce ? { enforceDependencies: true } : {}) });
  timeline.drag = null;
  if (res && Array.isArray(res.tasks)) applyPlanInPlace(res);
  else await loadProjectPlan();
  return res;
}

function startMoveMode(task) {
  moveState = { key: task.key, start: 0, end: 0 };
  const mine = showShiftPreview(task.key, 0, 0, () => `${task.key} (move mode)`);
  announce(moveAnnouncement(task.key, mine.start, mine.end, true));
}

async function onMoveKey(e) {
  const { state, action } = moveKey(moveState, e);
  if (!action) return;
  e.preventDefault();
  e.stopPropagation();
  const key = state.key;
  if (action === 'cancel') {
    moveState = null;
    clearShiftPreview();
    announce(`Move cancelled. ${key} keeps its dates.`);
    return;
  }
  if (action === 'move') {
    moveState = state;
    const mine = showShiftPreview(key, state.start, state.end, (m) => `${key} ➔ ${m.start}`);
    announce(moveAnnouncement(key, mine.start, mine.end, false));
    return;
  }
  const mine = timeline.drag && timeline.drag.moves.get(key);
  moveState = null;
  if (!mine || (state.start === 0 && state.end === 0)) {
    clearShiftPreview();
    announce(`No change to ${key}.`);
    return;
  }
  const strip = document.getElementById('writePreview');
  if (strip) strip.hidden = true;

  const task = findTask(key);
  if (isBlockParent(task)) {
    // A roll-up parent moves as a block and is never resized (ADR-003 section 7).
    clearShiftPreview();
    if (state.start !== state.end) announce(`${key} takes its dates from its sub-tasks, so it cannot be resized. Move it instead.`);
    else await moveBlock(key, state.start);
    focusGridCell();
    return;
  }
  const enforceDeps = isEnforceDepsEnabled();
  let finalStart = mine.start;
  let finalEnd = mine.end;
  const conflict = checkDependencyConflict({ key, startDate: finalStart }, currentPlan.tasks, todayIso());

  if (conflict.hasConflict) {
    if (enforceDeps) {
      const clamped = clampToEarliestStart(finalStart, finalEnd, conflict.earliestDate);
      finalStart = clamped.startDate;
      finalEnd = clamped.endDate;
      if (task && finalStart === task.startDate && finalEnd === (task.endDate || task.startDate)) {
        clearShiftPreview();
        announce(`Enforce dependencies: ${key} cannot start before ${conflict.earliestDate} (dependency on ${conflict.predKey}).`);
        focusGridCell();
        return;
      }
      await commitDates(key, finalStart, finalEnd, { enforce: true });
      announce(`Enforce dependencies: snapped ${key} start to ${conflict.earliestDate} to satisfy dependency on ${conflict.predKey}.`);
      focusGridCell();
      return;
    } else {
      clearShiftPreview();
      const updatedHit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(key)}"]`);
      showDependencyConflictDialog({
        key,
        candidateStart: finalStart,
        candidateEnd: finalEnd,
        conflict,
        task,
        hit: updatedHit,
        mode: 'move'
      });
      focusGridCell();
      return;
    }
  }

  await commitDates(key, finalStart, finalEnd, { enforce: isEnforceDepsEnabled() });
  announce(`Saved. ${key}: ${finalStart} to ${finalEnd}.`);
  focusGridCell();
}

// Single-pointer path (WCAG 2.5.7): a click on a bar opens a toolbar with the drag actions.
function openBarToolbar(key, anchor) {
  const bar = document.getElementById('barToolbar');
  if (!bar) return;
  const currentHit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(key)}"]`) || anchor;
  if (!currentHit) return;
  bar.dataset.key = key;
  bar.setAttribute('aria-label', `Actions for ${key}`);
  const r = currentHit.getBoundingClientRect();
  popoverOpenedAt = performance.now();
  bar.hidden = false;
  const barH = bar.offsetHeight || 38;
  const spaceBelow = window.innerHeight - r.bottom;
  const top = spaceBelow >= barH + 10 ? r.bottom + 6 : Math.max(8, r.top - barH - 6);
  bar.style.top = `${top}px`;
  bar.style.left = `${Math.max(8, Math.min(window.innerWidth - (bar.offsetWidth || 340) - 8, r.left))}px`;
}

/** On scroll the toolbar follows its bar, and closes when the bar leaves the view. */
function followBarToolbar() {
  const bar = document.getElementById('barToolbar');
  if (!bar || bar.hidden) return;
  const hit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(bar.dataset.key || '')}"]`);
  const wrapper = document.getElementById('ganttWrapper');
  if (!hit || !wrapper) return closeBarToolbar();
  const r = hit.getBoundingClientRect();
  const w = wrapper.getBoundingClientRect();
  if (r.bottom < w.top || r.top > w.bottom || r.right < w.left || r.left > w.right) return closeBarToolbar();
  openBarToolbar(bar.dataset.key, hit);
}

function closeBarToolbar() {
  const bar = document.getElementById('barToolbar');
  if (bar) bar.hidden = true;
}

let dateEditKey = null;

function openDateEditPopover(key, anchor) {
  const task = findTask(key);
  if (!task) return;
  dateEditKey = key;
  const pop = document.getElementById('dateEditPopover');
  if (!pop) return;
  popoverOpenedAt = performance.now();
  pop.hidden = false;

  document.getElementById('dateEditTitle').textContent = `Edit Dates: ${key}`;
  const startInp = document.getElementById('dateEditStart');
  const endInp = document.getElementById('dateEditEnd');
  startInp.value = task.startDate || '';
  endInp.value = task.endDate || task.startDate || '';

  const updateDuration = () => {
    const s = startInp.value;
    const e = endInp.value;
    const durEl = document.getElementById('dateEditDuration');
    if (s && e && s <= e) {
      const days = daysBetween(s, e) + 1;
      const wks = (days / 7).toFixed(1).replace(/\.0$/, '');
      durEl.textContent = `${days}d (${wks} wks)`;
    } else {
      durEl.textContent = '';
    }
  };
  startInp.oninput = updateDuration;
  endInp.oninput = updateDuration;
  updateDuration();

  const currentHit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(key)}"]`) || anchor;
  const r = currentHit && currentHit.getBoundingClientRect ? currentHit.getBoundingClientRect() : { top: 120, bottom: 160, left: 140 };
  const popH = pop.offsetHeight || 190;
  const spaceBelow = window.innerHeight - r.bottom;
  const top = spaceBelow >= popH + 10 ? r.bottom + 6 : Math.max(8, r.top - popH - 6);
  pop.style.top = `${top}px`;
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - (pop.offsetWidth || 340) - 8, r.left))}px`;
  startInp.focus();
}

function closeDateEditPopover() {
  const pop = document.getElementById('dateEditPopover');
  if (pop) pop.hidden = true;
  dateEditKey = null;
  focusGridCell();
}

async function toolbarAction(action, key, btn) {
  const task = findTask(key);
  if (!task) return;
  const barHit = document.querySelector(`.bar-hit[data-task-id="${CSS.escape(key)}"]`);
  const anchorRect = (barHit || btn).getBoundingClientRect();
  const barAnchor = { getBoundingClientRect: () => anchorRect };
  closeBarToolbar();
  if ((action === 'earlier' || action === 'later') && isBlockParent(task)) {
    await moveBlock(key, action === 'later' ? 7 : -7);
    return;
  }
  if ((action === 'earlier' || action === 'later') && task.datesFromChildren) {
    showFlag({ text: `${key} follows the dates of its children. Move a child instead.` });
    return;
  }
  if (action === 'earlier' || action === 'later') {
    const days = action === 'later' ? 7 : -7;
    const mine = showShiftPreview(key, days, days, (m) => `${key} ➔ ${m.start}`);
    await commitDates(key, mine.start, mine.end);
  } else if (action === 'dates') {
    openDateEditPopover(key, barAnchor);
  } else if (action === 'dependency') {
    openDependencyPopup(key, barAnchor);
  } else if (action === 'progress') {
    openProgressPicker(barAnchor, key);
  }
}

// "Add dependency" popup (UP-48): searchable issue list and a trigger percent field.
let depState = null;

function dependencyCandidates(key) {
  const idx = rowTasks.findIndex(r => r.task.key === key);
  const others = rowTasks.map((r, i) => ({ t: r.task, d: i < idx ? idx - i : 1000 + i - idx })).filter(x => x.t.key !== key);
  // Rows just above the task come first: the usual predecessor is one or two rows up.
  return others.sort((a, b) => a.d - b.d).map(x => x.t);
}

function renderDependencyOptions() {
  const list = document.getElementById('depList');
  const search = document.getElementById('depSearch');
  const q = search.value.trim().toLowerCase();
  depState.options = dependencyCandidates(depState.key).filter(t => !q || t.key.toLowerCase().includes(q) || (t.summary || '').toLowerCase().includes(q)).slice(0, 50);
  depState.active = Math.min(depState.active, depState.options.length - 1);
  list.replaceChildren(...depState.options.map((t, i) => {
    const li = document.createElement('li');
    li.id = `dep-opt-${i}`;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(i === depState.active));
    li.textContent = `${t.key}: ${t.summary || ''}`;
    li.addEventListener('click', () => chooseDependency(i));
    return li;
  }));
  if (depState.active >= 0) search.setAttribute('aria-activedescendant', `dep-opt-${depState.active}`);
  else search.removeAttribute('aria-activedescendant');
}

function openDependencyPopup(key, anchor) {
  const pop = document.getElementById('depPopup');
  if (!pop) return;
  popoverOpenedAt = performance.now();
  depState = { key, active: -1, options: [], chosen: null, anchor };
  document.getElementById('depTitle').textContent = `${key} starts when`;
  document.getElementById('depSearch').value = '';
  document.getElementById('depTrigger').value = '100';
  renderDependencyOptions();
  pop.hidden = false;
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { top: 120, bottom: 120, left: 120 };
  const popH = pop.offsetHeight || 260;
  const spaceBelow = window.innerHeight - r.bottom;
  const top = spaceBelow >= popH + 10 ? r.bottom + 6 : Math.max(8, r.top - popH - 6);
  pop.style.top = `${top}px`;
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - (pop.offsetWidth || 340) - 8, r.left))}px`;
  const trig = document.getElementById('depTrigger');
  trig.focus();
  trig.select();
}

function closeDependencyPopup() {
  const pop = document.getElementById('depPopup');
  if (pop) pop.hidden = true;
  depState = null;
  focusGridCell();
}

/** Choosing an issue creates the link with the trigger percent above the list (B-25: 3 actions). */
function chooseDependency(i) {
  const t = depState && depState.options[i];
  if (!t) return;
  depState.chosen = t.key;
  saveDependency();
}

async function saveDependency() {
  if (!depState || !depState.chosen) return;
  const pct = Math.max(0, Math.min(100, parseInt(document.getElementById('depTrigger').value, 10) || 0));
  const { key, chosen } = depState;
  const task = findTask(key);
  closeDependencyPopup();
  await callResolver('updateWbsTask', { taskId: key, updates: { dependency: { predecessorKey: chosen, predecessorId: chosen, triggerPercent: pct, isTriggerSatisfied: false } },
    expectedVersion: (task && task.version) || 0 });
  await loadProjectPlan();
  announce(`${key} now starts when ${chosen} reaches ${pct}%.`);
}

let depEditState = null;
let lastDepBadgeSignature = '';

function renderDependencyBadges(links) {
  const layer = document.getElementById('depLinksLayer');
  const wrapper = document.getElementById('ganttWrapper');
  if (!layer || !wrapper) return;

  const viewLeft = wrapper.scrollLeft + (layout.trackLeft || 0);
  const viewRight = wrapper.scrollLeft + wrapper.clientWidth;
  const viewTop = wrapper.scrollTop + (layout.headerH || 0);
  const viewBottom = wrapper.scrollTop + wrapper.clientHeight;

  // A label gets its button when its centre is in the visible timeline (a label cut by the edge too).
  const visibleLinks = (links || []).filter(link =>
    link.x >= viewLeft && link.x <= viewRight && link.y >= viewTop && link.y <= viewBottom);

  const sig = visibleLinks
    .map(l => `${l.predecessorKey}>${l.successorKey}@${Math.round(l.x)},${Math.round(l.y)}:${l.triggerPercent}:${l.isViolated ? 1 : 0}`)
    .join('|');
  if (sig === lastDepBadgeSignature) return;
  lastDepBadgeSignature = sig;

  layer.replaceChildren(...visibleLinks.map(link => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dep-link-badge' + (link.isViolated ? ' is-violated' : '');
    btn.dataset.pred = link.predecessorKey;
    btn.dataset.succ = link.successorKey;
    btn.style.left = `${link.x}px`;
    btn.style.top = `${link.y}px`;
    btn.style.width = `${Math.max(26, Math.round((link.width || 28) + 6))}px`;
    btn.style.height = `${Math.max(20, Math.round((link.height || 18) + 6))}px`;
    btn.title = `Click to edit dependency: ${link.successorKey} depends on ${link.predecessorKey} (${link.text})`;
    btn.setAttribute('aria-label', `Dependency link: ${link.successorKey} depends on ${link.predecessorKey}, ${link.text}`);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      openDependencyEditPopover(link, btn);
    });
    return btn;
  }));
}

/**
 * A click on a dependency arrow's line opens the same editor as its label. The canvas keeps the points
 * of each drawn line; a pointer within 6 px of one is on that arrow (the pointer shows it).
 */
function arrowAt(wrapper, e) {
  if (!timeline) return null;
  if (e.target.closest('.bar-hit, .dep-link-badge, .btn, button, input, select, a, .resizer, .row-drag-handle, .th-col-menu-btn')) return null;
  const rect = wrapper.getBoundingClientRect();
  const vx = e.clientX - rect.left;
  if (vx < (layout.trackLeft || 0)) return null;
  const x = vx + wrapper.scrollLeft;
  const y = e.clientY - rect.top + wrapper.scrollTop;
  return nearestArrow(timeline.getArrowLinks(), x, y, 6);
}

function initArrowLineClicks(wrapper) {
  let raf = 0;
  wrapper.addEventListener('mousemove', (e) => {
    if (raf || isDraggingBar) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      wrapper.classList.toggle('is-over-arrow', Boolean(arrowAt(wrapper, e)));
    });
  });
  wrapper.addEventListener('mouseleave', () => wrapper.classList.remove('is-over-arrow'));
  // Capture phase, so the click on a line does not also start a pan or select a row.
  wrapper.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const link = arrowAt(wrapper, e);
    if (!link) return;
    e.stopPropagation();
    e.preventDefault();
    const badge = [...document.querySelectorAll('#depLinksLayer .dep-link-badge')]
      .find(b => b.dataset.pred === link.predecessorKey && b.dataset.succ === link.successorKey);
    openDependencyEditPopover(link, badge || wrapper);
  }, true);
}

function refreshDepEditPopoverFields() {
  if (!depEditState) return;
  const { link } = depEditState;
  const predTask = findTask(link.predecessorKey);
  const succTask = findTask(link.successorKey);

  const titleEl = document.getElementById('depEditTitle');
  if (titleEl) titleEl.textContent = dependencyPopoverTitle(link.predecessorKey, link.successorKey);

  const partiesEl = document.getElementById('depEditParties');
  if (partiesEl) {
    partiesEl.innerHTML = html`
      <div><strong>${link.successorKey} depends on ${link.predecessorKey}</strong></div>
      <div>Predecessor: ${link.predecessorKey} (${predTask ? predTask.summary || '' : ''})</div>
      <div>Successor: ${link.successorKey} (${succTask ? succTask.summary || '' : ''})</div>
    `;
  }

  const labelEl = document.getElementById('depEditTriggerLabel');
  if (labelEl) {
    labelEl.textContent = `${link.successorKey} starts when ${link.predecessorKey} reaches (percent)`;
  }

  const removeBtn = document.getElementById('btnRemoveDepLink');
  if (removeBtn) {
    removeBtn.hidden = Boolean(link.isNew);
  }
  const saveBtn = document.getElementById('btnSaveDepEdit');
  if (saveBtn) {
    saveBtn.textContent = link.isNew ? 'Add Dependency' : 'Save';
  }

  updateDepEditPreview();
}

function openDependencyEditPopover(link, anchor) {
  const pop = document.getElementById('depEditPopover');
  if (!pop) return;
  popoverOpenedAt = performance.now();
  depEditState = { link: { ...link }, anchor };

  const triggerInput = document.getElementById('depEditTrigger');
  if (triggerInput) {
    triggerInput.value = String(link.triggerPercent);
  }
  // A link from before ADR-006, stored only in this plan: Save creates it in Jira, Remove drops it.
  const planOnlyNote = document.getElementById('depEditPlanOnly');
  if (planOnlyNote) planOnlyNote.hidden = !link.planOnly;

  refreshDepEditPopoverFields();

  pop.hidden = false;
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { bottom: 120, left: 120 };
  pop.style.top = `${Math.max(8, Math.min(window.innerHeight - pop.offsetHeight - 8, r.bottom + 6))}px`;
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.left))}px`;

  if (triggerInput) {
    triggerInput.focus();
    triggerInput.select();
  }
}

function updateDepEditPreview() {
  if (!depEditState) return;
  const triggerInput = document.getElementById('depEditTrigger');
  const previewEl = document.getElementById('depEditPreview');
  if (!triggerInput || !previewEl) return;

  const pct = clampTriggerPercent(triggerInput.value);
  const predTask = findTask(depEditState.link.predecessorKey);
  const succTask = findTask(depEditState.link.successorKey);
  if (!predTask) {
    previewEl.textContent = 'Predecessor details unavailable.';
    previewEl.classList.remove('is-violated');
    return;
  }

  const preview = computeDependencyPreview(predTask, pct, todayIso());
  let violated = false;
  let text = preview.summary;
  if (preview.earliestStartDate && succTask && succTask.startDate && succTask.startDate < preview.earliestStartDate) {
    violated = true;
    text += ` | Warning: ${succTask.key} is scheduled on ${succTask.startDate}, before earliest start ${preview.earliestStartDate}.`;
  }
  previewEl.textContent = text;
  if (violated) previewEl.classList.add('is-violated');
  else previewEl.classList.remove('is-violated');
}

function closeDependencyEditPopover() {
  const pop = document.getElementById('depEditPopover');
  if (pop) pop.hidden = true;
  if (depEditState && depEditState.anchor && typeof depEditState.anchor.focus === 'function') {
    depEditState.anchor.focus();
  }
  depEditState = null;
}

async function saveDependencyEdit() {
  if (!depEditState) return;
  const { link } = depEditState;
  const triggerInput = document.getElementById('depEditTrigger');
  const pct = clampTriggerPercent(triggerInput ? triggerInput.value : link.triggerPercent);
  const succKey = link.successorKey;
  const predKey = link.predecessorKey;
  const succTask = findTask(succKey);

  closeDependencyEditPopover();
  await callResolver('updateWbsTask', {
    taskId: succKey,
    updates: {
      dependency: {
        predecessorKey: predKey,
        predecessorId: predKey,
        triggerPercent: pct,
        isTriggerSatisfied: false
      }
    },
    expectedVersion: (succTask && succTask.version) || 0
  });
  await loadProjectPlan();
  announce(`Updated link: ${succKey} now starts when ${predKey} reaches ${pct}%.`);
}

async function removeDependencyLink() {
  if (!depEditState) return;
  const { link } = depEditState;
  const succKey = link.successorKey;
  const predKey = link.predecessorKey;
  const succTask = findTask(succKey);

  closeDependencyEditPopover();
  // Exactly this link is removed, in Jira too, whoever created it (ADR-006, N-11 L3).
  await callResolver('updateWbsTask', {
    taskId: succKey,
    updates: { removeDependency: { predecessorKey: predKey } },
    expectedVersion: (succTask && succTask.version) || 0
  });
  await loadProjectPlan();
  announce(`Removed dependency link between ${predKey} and ${succKey}.`);
}

function initKeyboard() {
  initGrid();
  initSelectionBar();
  document.querySelectorAll('#zoomGroup [data-zoom]').forEach(b => b.addEventListener('click', () => setZoom(b.dataset.zoom)));
  document.getElementById('btnCompactColumns')?.addEventListener('click', () => setCompactColumns(!isCompactMode()));
  updateZoomButtons();
  const box = document.getElementById('shortcutsToggle');
  if (box) {
    try { box.checked = localStorage.getItem(SHORTCUT_KEY) !== 'off'; } catch (e) {}
    box.addEventListener('change', () => {
      try { localStorage.setItem(SHORTCUT_KEY, box.checked ? 'on' : 'off'); } catch (e) {}
    });
  }
  const bar = document.getElementById('barToolbar');
  if (bar) {
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (btn) {
        e.stopPropagation();
        toolbarAction(btn.dataset.action, bar.dataset.key, btn);
      }
    });
    bar.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeBarToolbar(); focusGridCell(); } });
  }
  const search = document.getElementById('depSearch');
  if (search) {
    search.addEventListener('input', () => { depState.active = -1; renderDependencyOptions(); });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const n = depState.options.length;
        if (n) depState.active = (depState.active + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
        renderDependencyOptions();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        chooseDependency(Math.max(0, depState.active));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDependencyPopup();
      }
    });
  }
  const trig = document.getElementById('depTrigger');
  if (trig) trig.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('depSearch').focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeDependencyPopup(); }
  });
  document.getElementById('btnDepSave')?.addEventListener('click', () => chooseDependency(Math.max(0, depState ? depState.active : 0)));
  document.getElementById('btnCloseHelp')?.addEventListener('click', closeHelp);
  document.getElementById('btnHintHelp')?.addEventListener('click', openHelp);
  document.getElementById('btnHintDismiss')?.addEventListener('click', () => {
    writePref(HINT_KEY, 'done');
    document.getElementById('linkHint').hidden = true;
  });
  document.getElementById('btnDepCancel')?.addEventListener('click', closeDependencyPopup);

  document.getElementById('btnCloseDateEdit')?.addEventListener('click', closeDateEditPopover);
  document.getElementById('btnDateEditMinusWk')?.addEventListener('click', () => {
    const sInp = document.getElementById('dateEditStart');
    const eInp = document.getElementById('dateEditEnd');
    if (!sInp || !eInp) return;
    if (sInp.value) sInp.value = addDaysIso(sInp.value, -7);
    if (eInp.value) eInp.value = addDaysIso(eInp.value, -7);
    sInp.dispatchEvent(new Event('input'));
  });
  document.getElementById('btnDateEditPlusWk')?.addEventListener('click', () => {
    const sInp = document.getElementById('dateEditStart');
    const eInp = document.getElementById('dateEditEnd');
    if (!sInp || !eInp) return;
    if (sInp.value) sInp.value = addDaysIso(sInp.value, 7);
    if (eInp.value) eInp.value = addDaysIso(eInp.value, 7);
    sInp.dispatchEvent(new Event('input'));
  });
  document.getElementById('btnOpenFullTaskDetail')?.addEventListener('click', () => {
    const k = dateEditKey;
    closeDateEditPopover();
    if (k) openTaskDetailModal(k);
  });
  document.getElementById('btnSaveDateEdit')?.addEventListener('click', async () => {
    const k = dateEditKey;
    const s = document.getElementById('dateEditStart')?.value;
    const e = document.getElementById('dateEditEnd')?.value;
    closeDateEditPopover();
    if (k && s) {
      await commitDates(k, s, e || s);
    }
  });
  document.getElementById('dateEditPopover')?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeDateEditPopover();
    }
  });

  document.getElementById('btnSwapDepDirection')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!depEditState) return;
    depEditState.link = swapDependencyDirection(depEditState.link);
    refreshDepEditPopoverFields();
  });
  document.getElementById('btnCloseDepEdit')?.addEventListener('click', closeDependencyEditPopover);
  document.getElementById('btnCancelDepEdit')?.addEventListener('click', closeDependencyEditPopover);
  document.getElementById('btnSaveDepEdit')?.addEventListener('click', saveDependencyEdit);
  document.getElementById('btnRemoveDepLink')?.addEventListener('click', removeDependencyLink);
  document.querySelectorAll('#depEditPopover .dep-preset-group button[data-pct]').forEach(b => {
    b.addEventListener('click', () => {
      const inp = document.getElementById('depEditTrigger');
      if (inp) {
        inp.value = b.dataset.pct;
        updateDepEditPreview();
      }
    });
  });
  const depEditTrig = document.getElementById('depEditTrigger');
  if (depEditTrig) {
    depEditTrig.addEventListener('input', updateDepEditPreview);
    depEditTrig.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveDependencyEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeDependencyEditPopover();
      }
    });
  }

  const enforceBox = document.getElementById('enforceDependenciesCheckbox');
  if (enforceBox) {
    try { enforceBox.checked = localStorage.getItem('cascadeplan_enforce_deps') === 'on'; } catch (e) {}
    enforceBox.addEventListener('change', () => {
      try { localStorage.setItem('cascadeplan_enforce_deps', enforceBox.checked ? 'on' : 'off'); } catch (e) {}
      announce(enforceBox.checked
        ? 'Enforce dependencies enabled. Moving tasks will automatically snap to respect predecessor milestones.'
        : 'Enforce dependencies disabled.');
    });
  }

  document.getElementById('btnCloseDepConflict')?.addEventListener('click', closeDependencyConflictDialog);
  document.getElementById('btnConflictCancel')?.addEventListener('click', applyConflictCancel);
  document.getElementById('btnConflictSnap')?.addEventListener('click', applyConflictSnap);
  document.getElementById('btnConflictAdjust')?.addEventListener('click', applyConflictAdjust);
  document.getElementById('btnConflictKeep')?.addEventListener('click', applyConflictKeep);

  document.getElementById('planSwitcher')?.addEventListener('change', async (e) => {
    setActivePlan(e.target.value);
    await loadProjectPlan();
    announce(`Switched to plan ${e.target.selectedOptions[0]?.textContent || activePlanId}.`);
  });

  const trigger = document.getElementById('planSelectorBtn');
  const pop = document.getElementById('plansManagerPopover');
  if (trigger && pop) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      // The stylesheet hides the list at first (MK-09), so the computed display is read.
      const isClosed = getComputedStyle(pop).display === 'none';
      pop.style.display = isClosed ? 'flex' : 'none';
      trigger.setAttribute('aria-expanded', isClosed ? 'true' : 'false');
      if (isClosed) {
        const searchInp = document.getElementById('planSearchInput');
        if (searchInp) {
          searchInp.value = currentPlanSearchQuery;
          setTimeout(() => searchInp.focus(), 50);
        }
      }
    });
  }

  document.getElementById('btnManagePlans')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pop) {
      pop.style.display = getComputedStyle(pop).display === 'none' ? 'flex' : 'none';
    }
  });

  document.getElementById('btnClosePlansPopover')?.addEventListener('click', () => {
    closePlansPopover();
  });

  const searchInp = document.getElementById('planSearchInput');
  if (searchInp) {
    searchInp.addEventListener('input', (e) => {
      currentPlanSearchQuery = e.target.value;
      if (currentPlan && currentPlan.availablePlans) {
        renderFilteredPlansList(currentPlan.availablePlans, activePlanId);
      }
    });
  }

  const tabs = document.querySelectorAll('.plan-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      currentPlanCategoryFilter = tab.dataset.category || 'all';
      if (currentPlan && currentPlan.availablePlans) {
        renderFilteredPlansList(currentPlan.availablePlans, activePlanId);
      }
    });
  });

  const submitCreatePlan = async () => {
    const nameInp = document.getElementById('newPlanNameInput');
    const valResult = validateNewPlanName(nameInp ? nameInp.value : '');
    if (!valResult.valid) {
      showFlag({ text: valResult.error || 'Please enter a valid plan name.', error: true });
      nameInp?.focus();
      return;
    }
    const name = valResult.cleanName;
    const clone = document.getElementById('cloneCurrentPlanCheckbox')?.checked === true;
    const res = await callResolver('createProjectPlan', {
      name,
      cloneFromPlanId: clone ? activePlanId : undefined
    });
    const copied = res && res.ok && res.plan && res.done === false
      ? await finishPlanWork('continuePlanCopy', res.plan.id, `Copying to ${res.plan.name}`) : res;
    if (res && res.ok && res.plan && !(copied && copied.ok && copied.done !== false)) {
      showFlag({ text: `The copy to ${res.plan.name} stopped. Pick it in the plan list to finish it.`, error: true });
      await loadProjectPlan();
    } else if (res && res.ok && res.plan) {
      if (nameInp) nameInp.value = '';
      closePlansPopover();
      setActivePlan(res.plan.id);
      showFlag({ text: `Created and switched to plan ${res.plan.name}.` });
      await loadProjectPlan();
    } else {
      showFlag({ text: res?.message || 'Failed to create plan.', error: true });
    }
  };

  document.getElementById('btnCreatePlan')?.addEventListener('click', submitCreatePlan);
  document.getElementById('btnSavePlanJql')?.addEventListener('click', savePlanFilter);
  document.getElementById('planJqlInput')?.addEventListener('keydown', (ke) => {
    if (ke.key === 'Enter') {
      ke.preventDefault();
      savePlanFilter();
    }
  });
  document.getElementById('newPlanNameInput')?.addEventListener('keydown', (ke) => {
    if (ke.key === 'Enter') {
      ke.preventDefault();
      submitCreatePlan();
    }
  });

  const wrapper = document.getElementById('ganttWrapper');
  if (wrapper) {
    wrapper.addEventListener('dragover', (e) => {
      if (document.body.classList.contains('is-dragging-backlog')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    wrapper.addEventListener('drop', async (e) => {
      if (!document.body.classList.contains('is-dragging-backlog')) return;
      document.body.classList.remove('is-dragging-backlog');
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      try {
        const data = JSON.parse(dataStr);
        if (data && data.taskId && !data.fromReorder) {
          e.preventDefault();
          const rect = wrapper.getBoundingClientRect();
          const relX = e.clientX - rect.left + wrapper.scrollLeft;
          const d = dateAt(relX, originIso(), dayPx());
          const snapped = zoomById(zoomId).snap === 'week' ? mondayOf(d) : d;
          const res = await callResolver('scheduleBacklogTask', {
            taskId: data.taskId,
            startWeek: '',
            startDate: snapped,
            spanWeeks: 3,
            targetIndex: currentPlan?.tasks ? currentPlan.tasks.length : 0
          });
          if (res && Array.isArray(res.tasks)) {
            currentPlan = res;
            renderPlan();
          } else {
            await loadProjectPlan();
          }
          if (res && res.ok === true) showFlag({ text: 'Scheduled ' + data.taskId + ' to timeline.' });
        }
      } catch (err) {
        logFailure('wrapper drop', err);
      }
    });
  }

  document.addEventListener('click', (e) => {
    const recentlyOpened = (performance.now() - popoverOpenedAt) < 180;
    const tb = document.getElementById('barToolbar');
    if (tb && !tb.hidden && !tb.contains(e.target) && !e.target.closest('.bar-hit')) closeBarToolbar();
    const depPop = document.getElementById('depPopup');
    if (!recentlyOpened && depPop && !depPop.hidden && !depPop.contains(e.target) && !e.target.closest('#barToolbar')) closeDependencyPopup();
    const datePop = document.getElementById('dateEditPopover');
    if (!recentlyOpened && datePop && !datePop.hidden && !datePop.contains(e.target) && !e.target.closest('#barToolbar')) closeDateEditPopover();
    const depEditPop = document.getElementById('depEditPopover');
    if (!recentlyOpened && depEditPop && !depEditPop.hidden && !depEditPop.contains(e.target) && !e.target.closest('.dep-link-badge')) closeDependencyEditPopover();
    const conflictBanner = document.getElementById('depConflictBanner');
    if (!recentlyOpened && conflictBanner && !conflictBanner.hidden && !conflictBanner.contains(e.target)) closeDependencyConflictDialog();
    const plansPop = document.getElementById('plansManagerPopover');
    if (plansPop && getComputedStyle(plansPop).display !== 'none' && !plansPop.contains(e.target) && !e.target.closest('#planSelectorBtn') && !e.target.closest('#btnManagePlans')) {
      closePlansPopover();
    }
  });
  document.getElementById('ganttWrapper')?.addEventListener('scroll', () => {
    followBarToolbar();
    closeDateEditPopover();
    if (depEditState) closeDependencyEditPopover();
    if (conflictState) closeDependencyConflictDialog();
  }, { passive: true });
}

/** Single-letter shortcuts: only while focus is in the planner outside text fields, and only when on (WCAG 2.1.4). */
function onShortcut(e, inField) {
  const activeInput = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT' || document.activeElement.isContentEditable);
  if (inField || activeInput || e.ctrlKey || e.metaKey || e.altKey || !shortcutsOn() || openModal()) return false;
  const key = gridRoot && gridRoot.contains(document.activeElement) ? rowTasks[gridFocus.row]?.task.key : (pinnedDependencyTaskId || hoveredTaskId);
  if (e.key === 't') {
    scrollToToday();
    return true;
  }
  if (!key) return false;
  if (e.key === 'd') {
    openDependencyPopup(key, document.activeElement);
    return true;
  }
  if (e.key === 'e') {
    openTaskDetailModal(key);
    return true;
  }
  return false;
}

// Standup flow (B-16): multi-select, a selection bar, digit progress, one call and one undo per batch.
let selectedKeys = new Set();
let selectionAnchor = null;
const pendingProgress = new Map();

function applySelection() {
  for (const [key, tr] of rowCache) tr.classList.toggle('is-selected', selectedKeys.has(key));
  if (gridRoot) {
    gridRoot.setAttribute('aria-multiselectable', 'true');
    gridRoot.querySelectorAll('[role="row"][data-row]').forEach(r => {
      const t = rowTasks[Number(r.dataset.row)];
      r.setAttribute('aria-selected', String(!!t && selectedKeys.has(t.task.key)));
    });
  }
  const bar = document.getElementById('selectionBar');
  if (bar) {
    bar.hidden = selectedKeys.size === 0;
    document.getElementById('selectionCount').textContent = `${selectedKeys.size} selected`;
  }
}

function selectRow(key, e) {
  if (e.shiftKey) {
    const order = rowTasks.map(r => r.task.key);
    selectedKeys = new Set([...selectedKeys, ...rangeKeys(order, selectionAnchor, key)]);
  } else {
    selectedKeys = toggleKey(selectedKeys, key);
    selectionAnchor = key;
  }
  applySelection();
}

function clearSelection() {
  selectedKeys = new Set();
  selectionAnchor = null;
  applySelection();
}

/** One batchUpdateTasks call; a move keeps the rows, other edits re-render them (no extra call). */
async function runBatch(items, kind) {
  if (!items.length) return;
  const res = await callResolver('batchUpdateTasks', { items });
  // C9: the items another user changed first are named; the others are saved.
  const skipped = res && Array.isArray(res.results) ? res.results.filter(r => r && r.ok === false).map(r => r.taskId) : [];
  if (skipped.length) {
    showFlag({ text: `Not saved, because someone else changed ${skipped.length === 1 ? 'it' : 'them'} a moment ago: ${skipped.join(', ')}. The other ${items.length - skipped.length} saved. Reload and try those again.`, error: true });
  }
  if (res && Array.isArray(res.tasks)) {
    if (kind === 'move') applyPlanInPlace(res);
    else {
      currentPlan = res;
      renderPlan();
      settleUndo();
    }
  } else {
    await loadProjectPlan();
  }
}

function versionOf(key) {
  return findTask(key)?.version || 0;
}

function initSelectionBar() {
  document.getElementById('btnSelProgress')?.addEventListener('click', async () => {
    const p = Math.max(0, Math.min(100, parseInt(document.getElementById('selProgress').value, 10) || 0));
    // A Done item keeps 100%; the others may offer a status change (2026-11-06).
    const done = [...selectedKeys].filter(k => isDone(findTask(k)?.status));
    if (done.length) showFlag({ text: `Not changed: ${done.join(', ')} ${done.length === 1 ? 'is' : 'are'} Done in Jira, so the progress stays 100%.` });
    const items = [...selectedKeys].filter(k => !done.includes(k)).map(k => ({ taskId: k, updates: { progress: p }, expectedVersion: versionOf(k) }));
    if (!items.length) return;
    if (!(await withStatusChoice(items.map(i => ({ key: i.taskId, progress: p, updates: i.updates }))))) return;
    runBatch(items, 'progress');
  });
  document.getElementById('btnSelMove')?.addEventListener('click', async () => {
    const days = parseInt(document.getElementById('selDays').value, 10) || 0;
    // Leaves move in one batch; each selected task or story parent then moves as a block, and its
    // selected sub-tasks move only with it (each issue once, ADR-003).
    const blocks = selectedBlockParents(currentPlan.tasks, selectedKeys);
    await runBatch(moveSelectionBy(currentPlan.tasks, selectedKeys, days), 'move');
    for (const key of blocks) await moveBlock(key, days);
  });
  document.getElementById('btnSelAssign')?.addEventListener('click', () => {
    const sel = document.getElementById('selAssignee');
    const name = sel.options[sel.selectedIndex]?.textContent || '';
    runBatch([...selectedKeys].map(k => ({ taskId: k, updates: { resourceAccountId: sel.value, resource: name }, expectedVersion: versionOf(k) })), 'assign');
  });
  document.getElementById('btnSelClear')?.addEventListener('click', clearSelection);
}

function fillAssigneeOptions() {
  const sel = document.getElementById('selAssignee');
  if (!sel || !currentPlan) return;
  sel.replaceChildren(...(currentPlan.availableUsers || []).map(u => {
    const o = document.createElement('option');
    o.value = u.accountId;
    o.textContent = u.displayName;
    return o;
  }));
}

/** Digits set a pending progress on the focused row; Enter saves every pending value in one call. */
function setPendingProgress(key, pct) {
  const locked = progressLockReason(findTask(key) || { key });
  if (locked) {
    announce(locked);
    return;
  }
  pendingProgress.set(key, pct);
  const chip = rowCache.get(key)?.querySelector('.progress-chip-text');
  if (chip) chip.textContent = `${pct}% (not saved)`;
  announce(`${key} progress ${pct}%, not saved. Down for the next row, Enter saves all ${pendingProgress.size}.`);
}

async function commitPendingProgress() {
  const items = [...pendingProgress].map(([k, p]) => ({ taskId: k, updates: { progress: p }, expectedVersion: versionOf(k) }));
  // One question for the whole batch when progress and Jira status disagree (2026-11-06).
  if (!(await withStatusChoice(items.map(i => ({ key: i.taskId, progress: i.updates.progress, updates: i.updates }))))) {
    announce(`Progress not saved yet. Enter saves the ${pendingProgress.size} changes, Escape drops them.`);
    focusGridCell();
    return;
  }
  pendingProgress.clear();
  await runBatch(items, 'progress');
  announce(`Saved progress on ${items.length} issue${items.length === 1 ? '' : 's'}.`);
  focusGridCell();
}

// Rich Tooltip Helpers
/** The tooltip has a dark background: every line uses inverse text (contrast); a warning has a sign, not a colour. */
function showTaskTooltip(e, task) {
  const tip = document.getElementById('globalTooltip');
  const isEpic = task.isEpic || task.hierarchyLevel === 1;
  const isSub = task.isSubtask || task.hierarchyLevel === -1;
  const levelTitle = isEpic ? '🟪 Epic Roadmap Level' : (isSub ? '↳ Subtask Execution Level' : '🔷 Story / Task Plan Level');

  const dep = task.dependency;
  const depInfo = dep && dep.predecessorKey
    ? html`<div class="jx-mt-4">🔗 ${dep.earliestStartReason || `Waits for ${dep.predecessorKey} at ${dep.triggerPercent}%`}</div>${dep.isViolated ? html`<div class="jx-bold">⚠ ${dep.fixSuggestion || dep.violationReason || 'Starts too early'}</div>` : ''}`
    : '';
  const rollupInfo = (isEpic && task.rollupStats)
    ? html`<div class="jx-semibold">Rollup: ${task.childrenCount || 0} child items | Total ${task.effortHours}h</div>`
    : '';
  const subInfo = (!isEpic && task.subtasks && task.subtasks.length > 0)
    ? html`<div>Subtasks: ${task.subtasks.length} items (${task.effortHours}h total)</div>`
    : '';

  const contributing = getTaskContributingResources(task);
  let assigneeHtml = html`<div>${isEpic ? 'Epic Lead' : 'Assignee'}: ${task.resource || 'Unassigned'}</div>`;
  if (contributing.length > 1) {
    assigneeHtml = html`<div>${isEpic ? 'Epic Team' : 'Team'}: <strong>${contributing.map(c => c.name).join(', ')}</strong> (${contributing.length} resources)</div>`;
  } else if (contributing.length === 1 && !contributing[0].isParent) {
    assigneeHtml = html`<div>Assignee: <strong>${contributing[0].name}</strong> (via subtask)</div>`;
  }

  const siteUrl = getJiraBaseUrl();
  tip.innerHTML = html`
    <div class="jx-tip-level">${levelTitle}</div>
    <div><strong><a class="jx-tip-link" href="${siteUrl}/browse/${task.key}" target="_blank" rel="noopener noreferrer">${task.key} ↗</a>: ${task.summary}</strong></div>
    ${assigneeHtml}
    <div>Effort: ${formatEffort(task.effortHours)} | Progress: ${task.progress}% (Target: ${task.targetProgress}%)</div>
    <div>Dates: ${task.startDate} to ${task.endDate}</div>
    ${rollupInfo}
    ${subInfo}
    ${depInfo}
  `;
  tip.style.display = 'block';
  tip.style.left = (e.clientX + 14) + 'px';
  tip.style.top = (e.clientY + 14) + 'px';
}

function hideTooltip() {
  document.getElementById('globalTooltip').style.display = 'none';
}

// Modals Handling
function openTaskDetailModal(taskKey) {
  const task = (currentPlan.tasks || []).find(t => t.key === taskKey);
  if (!task) return;
  activeTaskId = task.key;

  document.getElementById('modalTaskKey').textContent = `Edit Task: ${task.key}`;
  const jiraBtn = document.getElementById('btnOpenModalInJiraNative');
  if (jiraBtn) {
    const siteUrl = getJiraBaseUrl();
    jiraBtn.href = `${siteUrl}/browse/${task.key}`;
    jiraBtn.textContent = `Open ${task.key} in Jira ↗`;
    jiraBtn.onclick = (e) => {
      openJiraIssueInNewTab(task.key, e);
    };
  }
  document.getElementById('editSummaryInput').value = task.summary;
  document.getElementById('editStatusSelect').value = task.status;

  // Progress and Target Progress Inputs
  modalUseRollupProgressFlag = false;
  const isProgRollup = task.isEpic || (task.childrenCount && task.childrenCount > 0);
  const progInput = document.getElementById('editProgressInput');
  const progSlider = document.getElementById('editProgressSlider');
  const progValLabel = document.getElementById('modalProgressValLabel');
  const progNote = document.getElementById('editProgressRollupNote');
  const rollupPctText = document.getElementById('modalRollupPctText');
  const curProg = task.progress !== undefined ? task.progress : 0;
  if (progInput) {
    progInput.value = curProg;
    progInput.disabled = false;
  }
  if (progSlider) progSlider.value = curProg;
  if (progValLabel) progValLabel.textContent = `${curProg}%`;
  setDialogProgressLock(task.key, task.status);
  if (progNote) {
    progNote.style.display = isProgRollup ? 'block' : 'none';
    if (rollupPctText) {
      const rollPct = task.rollupStats ? task.rollupStats.progressPct : 0;
      rollupPctText.textContent = `${rollPct}%`;
    }
  }
  const targetInput = document.getElementById('editTargetProgressInput');
  const targetSlider = document.getElementById('editTargetProgressSlider');
  const targetValLabel = document.getElementById('modalTargetValLabel');
  const curTarget = task.targetProgress !== undefined ? task.targetProgress : 0;
  if (targetInput) targetInput.value = curTarget;
  if (targetSlider) targetSlider.value = curTarget;
  if (targetValLabel) targetValLabel.textContent = `${curTarget}%`;

  // Clear error display
  const errEl = document.getElementById('taskDetailError');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

  // Assignee Select
  const assSelect = document.getElementById('editAssigneeSelect');
  assSelect.innerHTML = '';
  (currentPlan.availableUsers || []).forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.displayName;
    opt.dataset.accountId = u.accountId || '';
    opt.textContent = u.displayName + (u.isPlaceholder ? ' [Placeholder]' : '');
    assSelect.appendChild(opt);
  });
  // The current assignee is always offered and selected by account id, also when Jira did not list
  // them among the first assignable users, so a save never unassigns by accident (F-11).
  const curAccountId = task.resourceAccountId && task.resourceAccountId !== 'unassigned' ? task.resourceAccountId : '';
  let curOption = [...assSelect.options].find(o => (curAccountId ? o.dataset.accountId === curAccountId : o.value === (task.resource || 'Unassigned')));
  if (!curOption && curAccountId) {
    curOption = document.createElement('option');
    curOption.value = task.resource || curAccountId;
    curOption.dataset.accountId = curAccountId;
    curOption.textContent = task.resource || curAccountId;
    assSelect.insertBefore(curOption, assSelect.firstChild);
  }
  if (curOption) curOption.selected = true;
  assSelect.dataset.touched = '';
  assSelect.dataset.originalAccountId = curAccountId || 'unassigned';
  assSelect.onchange = () => { assSelect.dataset.touched = '1'; };

  // Start & End Date Inputs
  const startInput = document.getElementById('editStartDateInput');
  const endInput = document.getElementById('editEndDateInput');
  if (startInput) {
    if (task.startDate) {
      startInput.value = task.startDate.split('T')[0];
    } else {
      const wk = (currentPlan.weeks || []).find(w => w.weekKey === task.startWeek);
      startInput.value = wk?.startDate ? wk.startDate.split('T')[0] : '';
    }
  }
  if (endInput) {
    if (task.endDate) {
      endInput.value = task.endDate.split('T')[0];
    } else {
      const wk = (currentPlan.weeks || []).find(w => w.weekKey === task.endWeek);
      endInput.value = wk?.endDate ? wk.endDate.split('T')[0] : '';
    }
  }

  // Populate Multi-Resource Allocation
  const multiResSelect = document.getElementById('multiResourceSelect');
  if (multiResSelect) {
    multiResSelect.innerHTML = '';
    (currentPlan.availableUsers || []).forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.displayName;
      opt.dataset.accountId = u.accountId || '';
      opt.textContent = u.displayName + (u.isPlaceholder ? ' [Placeholder]' : '');
      multiResSelect.appendChild(opt);
    });
  }
  const multiResStatus = document.getElementById('multiResourceStatus');
  if (multiResStatus) {
    multiResStatus.textContent = '';
    multiResStatus.style.display = 'none';
  }
  // The hours field starts empty for every task: an empty field writes no estimate (INV-03).
  const multiResHours = document.getElementById('multiResourceHours');
  if (multiResHours) multiResHours.value = '';

  // Predecessor Select
  const predSelect = document.getElementById('editPredecessorSelect');
  predSelect.innerHTML = '<option value="">None (No Dependency)</option>';
  (currentPlan.tasks || []).forEach(t => {
    if (t.key !== task.key) {
      const opt = document.createElement('option');
      opt.value = t.key;
      opt.textContent = `${t.key}: ${t.summary}`;
      if (task.dependency && task.dependency.predecessorKey === t.key) opt.selected = true;
      predSelect.appendChild(opt);
    }
  });
  document.getElementById('editTriggerPercentInput').value = task.dependency?.triggerPercent !== undefined ? task.dependency.triggerPercent : 30;

  // Multi-unit Estimation Section
  const effortCfg = task.effortConfig;
  const savedUnit = (effortCfg && effortCfg.unit) || 'HOURS';
  document.getElementById('editEstimateUnitSelect').value = savedUnit;
  if (savedUnit === 'TSHIRT') {
    document.getElementById('editTshirtSelect').value = (effortCfg && effortCfg.tshirtSize) || 'M';
  } else {
    document.getElementById('editEstimateValueInput').value = (effortCfg && effortCfg.rawEstimate !== undefined) ? effortCfg.rawEstimate : (task.effortHours || 0);
  }
  handleEstimateUnitChange();

  // Subtasks
  renderModalSubtasks(task);
  renderParentControl(task);

  document.getElementById('taskDetailModal').style.display = 'flex';
}

function renderModalSubtasks(task) {
  const list = document.getElementById('subtasksList');
  list.innerHTML = '';
  // The Jira sub-tasks of the issue (ADR-004); hours show only when Jira has an estimate.
  const subs = task.subtasks || [];
  if (subs.length === 0) {
    list.innerHTML = '<div class="jx-subtle-11">No sub-tasks in Jira yet.</div>';
  } else {
    subs.forEach((s) => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.fontSize = '12px';
      item.innerHTML = html`<span>• ${s.key ? s.key + ': ' : ''}${s.summary}</span><span class="jx-bold">${s.normalizedHours ? s.normalizedHours + 'h' : ''}</span>`;
      list.appendChild(item);
    });
  }
  // Sub-tasks an earlier build kept only in the planner: created in Jira or removed only on request (F-23).
  const local = task.localSubtasks || [];
  if (local.length) {
    const box = document.createElement('div');
    box.className = 'local-subtasks';
    const note = document.createElement('p');
    note.textContent = `${local.length} sub-task${local.length === 1 ? '' : 's'} exist only in the planner, not in Jira: ${local.map(s => s.summary).join(', ')}.`;
    box.appendChild(note);
    for (const [action, label] of [['create', 'Create in Jira'], ['drop', 'Remove']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = action === 'create' ? 'btn btn-primary btn-xs' : 'btn btn-outline btn-xs';
      b.textContent = label;
      b.addEventListener('click', async () => {
        b.disabled = true;
        const res = await callResolver('resolveLocalSubtasks', { parentTaskId: task.key, action });
        if (res && res.ok !== false) showFlag({ text: action === 'create' ? `Created the sub-tasks of ${task.key} in Jira.` : `Removed the planner-only sub-tasks of ${task.key}.` });
        await loadProjectPlan();
        const updated = findAnyTask(task.key);
        if (updated) renderModalSubtasks(updated);
      });
      box.appendChild(b);
    }
    list.appendChild(box);
  }
}

async function handleAddSubtask() {
  const summary = document.getElementById('newSubtaskSummary').value.trim();
  // Only an estimate the user typed goes to Jira; an empty field sends none (F-23, BL-3).
  const hours = parseFloat(document.getElementById('newSubtaskHours').value);
  if (!summary || !activeTaskId) return;

  const res = await callResolver('addSubtaskToTask', {
    parentTaskId: activeTaskId,
    subtask: { summary, ...(hours > 0 ? { estimateValue: hours, estimateUnit: 'HOURS' } : {}) }
  });
  if (res && res.ok && res.createdKey) showFlag({ text: `Created sub-task ${res.createdKey} in Jira.` });

  document.getElementById('newSubtaskSummary').value = '';
  await loadProjectPlan();
  const updated = currentPlan.tasks.find(t => t.key === activeTaskId);
  if (updated) renderModalSubtasks(updated);
}

async function handleAddResourceSubtask() {
  if (!activeTaskId) return;
  const resSelect = document.getElementById('multiResourceSelect');
  const selected = resSelect.options[resSelect.selectedIndex];
  const assigneeName = selected ? selected.value : 'Unassigned';
  const assigneeAccountId = selected?.dataset?.accountId || undefined;
  // An empty hours field sends no estimate (F-06, INV-03).
  const hoursInput = document.getElementById('multiResourceHours');
  const hours = enteredAllocationHours(hoursInput && hoursInput.value);

  const statusEl = document.getElementById('multiResourceStatus');
  const addBtn = document.getElementById('btnAddResourceSubtaskBtn');
  if (addBtn) { addBtn.disabled = true; addBtn.textContent = 'Allocating...'; }

  try {
    const res = await callResolver('createSubtaskForResource', {
      parentTaskId: activeTaskId,
      assigneeAccountId,
      assigneeName,
      ...(hours !== undefined ? { effortHours: hours } : {})
    });
    if (!res || res.ok !== true) {
      // Only a confirmed create shows success; a null or failed result is an error (B-07).
      if (statusEl) {
        statusEl.textContent = (res && (res.message || res.error)) || 'Jira did not create the subtask.';
        statusEl.style.color = 'var(--cp-text-danger)';
        statusEl.style.display = 'block';
      }
    } else {
      if (statusEl) {
        statusEl.textContent = allocationCreatedText(assigneeName, hours);
        statusEl.style.color = 'var(--cp-text-success)';
        statusEl.style.display = 'block';
      }
      // The next allocation starts empty again, so no earlier value becomes its estimate.
      if (hoursInput) hoursInput.value = '';
      await loadProjectPlan();
      const updated = currentPlan.tasks.find(t => t.key === activeTaskId);
      if (updated) renderModalSubtasks(updated);
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = err?.message || 'Failed to allocate resource subtask.';
      statusEl.style.color = 'var(--cp-text-danger)';
      statusEl.style.display = 'block';
    }
  } finally {
    if (addBtn) { addBtn.disabled = false; addBtn.textContent = '+ Allocate Resource'; }
  }
}

async function handleUnscheduleFromModal() {
  if (!activeTaskId) return;
  const btn = document.getElementById('btnUnscheduleTaskModal');
  if (btn) { btn.disabled = true; btn.textContent = 'Moving to Backlog...'; }
  try {
    await callResolver('unscheduleTask', { taskId: activeTaskId });
    closeModal('taskDetailModal');
    await loadProjectPlan();
  } catch (err) {
    logFailure('unschedule task', err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📤 Move to Backlog'; }
  }
}

function updateReconciledHoursBadge() {
  const unit = document.getElementById('editEstimateUnitSelect').value;
  let hrs = 0;
  if (unit === 'HOURS') {
    const val = parseFloat(document.getElementById('editEstimateValueInput').value);
    hrs = isNaN(val) ? 0 : Math.max(0, Math.round(val));
  } else if (unit === 'STORY_POINTS') {
    const pts = parseFloat(document.getElementById('editEstimateValueInput').value);
    hrs = isNaN(pts) ? 0 : Math.max(0, Math.round(pts * 8));
  } else if (unit === 'TSHIRT') {
    const sz = document.getElementById('editTshirtSelect').value;
    const tshirtMap = { XS: 4, S: 8, M: 16, L: 32, XL: 64 };
    hrs = tshirtMap[sz] || 16;
  }
  const badge = document.getElementById('reconciledHoursBadge');
  if (badge) badge.textContent = `Total: ${hrs} hrs`;
  return hrs;
}

function handleEstimateUnitChange() {
  const unit = document.getElementById('editEstimateUnitSelect').value;
  document.getElementById('rawEstimateGroup').style.display = unit === 'TSHIRT' ? 'none' : 'block';
  document.getElementById('tshirtSizeGroup').style.display = unit === 'TSHIRT' ? 'block' : 'none';
  updateReconciledHoursBadge();
}

async function saveTaskModalChanges() {
  if (!activeTaskId) return;
  const errEl = document.getElementById('taskDetailError');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

  const summary = document.getElementById('editSummaryInput').value.trim();
  const assSelect = document.getElementById('editAssigneeSelect');
  const selectedAss = assSelect.options[assSelect.selectedIndex];
  const resource = selectedAss ? selectedAss.value : 'Unassigned';
  const resourceAccountId = selectedAss?.dataset?.accountId || (resource === 'Unassigned' ? 'unassigned' : undefined);
  const status = document.getElementById('editStatusSelect').value;

  const predKey = document.getElementById('editPredecessorSelect').value;
  const rawTrigger = parseInt(document.getElementById('editTriggerPercentInput').value, 10);
  const triggerPercent = isNaN(rawTrigger) ? 30 : Math.max(0, Math.min(100, rawTrigger));

  const unit = document.getElementById('editEstimateUnitSelect').value;
  let effortHours = undefined;
  let rawEstimate = undefined;
  let tshirtSize = undefined;
  if (unit === 'HOURS') {
    const val = parseFloat(document.getElementById('editEstimateValueInput').value);
    if (!isNaN(val)) {
      rawEstimate = Math.max(0, Math.round(val));
      effortHours = rawEstimate;
    }
  } else if (unit === 'STORY_POINTS') {
    const pts = parseFloat(document.getElementById('editEstimateValueInput').value);
    if (!isNaN(pts)) {
      rawEstimate = pts;
      effortHours = Math.max(0, Math.round(pts * 8));
    }
  } else if (unit === 'TSHIRT') {
    const sz = document.getElementById('editTshirtSelect').value;
    const tshirtMap = { XS: 4, S: 8, M: 16, L: 32, XL: 64 };
    tshirtSize = sz;
    effortHours = tshirtMap[sz] || 16;
    rawEstimate = effortHours;
  }

  // Only fields the user changed are sent (B-04, INV-03).
  const curTask = (currentPlan?.tasks || []).find(t => t.key === activeTaskId) || {};
  const updates = {};
  if (summary && summary !== curTask.summary) updates.summary = summary;
  // The assignee goes to Jira only when the user changed the field to another person (F-11).
  if (assSelect.dataset.touched === '1' && (resourceAccountId || 'unassigned') !== assSelect.dataset.originalAccountId) {
    updates.resource = resource;
    if (resourceAccountId) updates.resourceAccountId = resourceAccountId;
  }
  if (status !== curTask.status) updates.status = status;

  const curCfg = curTask.effortConfig;
  const curUnit = curCfg?.unit || 'HOURS';
  const curRaw = curCfg?.rawEstimate !== undefined ? curCfg.rawEstimate : (curTask.effortHours || 0);
  const curTshirt = curCfg?.tshirtSize || 'M';

  const estimateChanged =
    unit !== curUnit ||
    (unit === 'TSHIRT' ? tshirtSize !== curTshirt : rawEstimate !== curRaw);

  if (estimateChanged && effortHours !== undefined) {
    updates.effortConfig = {
      unit,
      rawEstimate: unit === 'TSHIRT' ? undefined : rawEstimate,
      tshirtSize: unit === 'TSHIRT' ? tshirtSize : undefined,
      totalCalculatedHours: effortHours
    };
    if (effortHours !== (curTask.effortHours || 0)) {
      updates.effortHours = effortHours;
    }
  }

  // Progress and Target Progress Inputs
  const progInput = document.getElementById('editProgressInput');
  if (progInput && progInput.value !== '') {
    const prog = Math.max(0, Math.min(100, parseInt(progInput.value, 10)));
    if (!isNaN(prog) && (prog !== (curTask.progress || 0) || modalUseRollupProgressFlag)) {
      updates.progress = prog;
      updates.manualProgress = !modalUseRollupProgressFlag;
      // The status changes only through the status field (F-06, INV-03).
    }
  }
  const targetInput = document.getElementById('editTargetProgressInput');
  if (targetInput && targetInput.value !== '') {
    const target = Math.max(0, Math.min(100, parseInt(targetInput.value, 10)));
    if (!isNaN(target) && target !== (curTask.targetProgress || 0)) updates.targetProgress = target;
  }

  // Start & End Date Inputs: the resolver keeps the exact dates and derives the week position.
  const startVal = document.getElementById('editStartDateInput')?.value || '';
  const endVal = document.getElementById('editEndDateInput')?.value || '';
  const origStart = (curTask.startDate || '').slice(0, 10);
  const origEnd = (curTask.endDate || '').slice(0, 10);
  if ((startVal && startVal !== origStart) || (endVal && endVal !== origEnd)) {
    if (startVal) updates.startDate = startVal;
    if (endVal) updates.endDate = endVal;
  }

  // Dependency: the resolver moves the bar to the earliest allowed week when needed.
  const origPred = curTask.dependency?.predecessorKey || '';
  const origTrigger = curTask.dependency?.triggerPercent;
  if (predKey !== origPred || (predKey && triggerPercent !== origTrigger)) {
    updates.dependency = predKey
      ? { predecessorId: predKey, predecessorKey: predKey, triggerPercent, isTriggerSatisfied: false }
      : null;
  }

  if (Object.keys(updates).length === 0) {
    closeModal('taskDetailModal');
    return;
  }
  // A progress that disagrees with the Jira status offers the status change; the user chooses (INV-03).
  if (updates.progress !== undefined && !(await withStatusChoice([{ key: activeTaskId, progress: updates.progress, updates }]))) return;

  const btn = document.getElementById('btnSaveTaskModal');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const res = await callResolver('updateWbsTask', { taskId: activeTaskId, updates, expectedVersion: curTask.version || 0 });
    if (res && res.error) {
      if (errEl) {
        errEl.textContent = res.error;
        errEl.style.display = 'block';
      }
      return;
    }
    closeModal('taskDetailModal');
    await loadProjectPlan();
  } catch (err) {
    if (errEl) {
      errEl.textContent = err?.message || 'Failed to save task updates.';
      errEl.style.display = 'block';
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
  }
}

function openCreateTaskModal() {
  const summaryInput = document.getElementById('createSummaryInput');
  summaryInput.value = '';
  summaryInput.style.borderColor = '';
  const errEl = document.getElementById('createTaskError');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }

  const epicSelect = document.getElementById('createEpicSelect');
  epicSelect.innerHTML = '<option value="">(None / Standalone Task)</option>';
  (currentPlan?.availableEpics || []).forEach(ep => {
    const opt = document.createElement('option');
    opt.value = ep.summary;
    opt.dataset.key = ep.key;
    opt.textContent = `${ep.key}: ${ep.summary}`;
    epicSelect.appendChild(opt);
  });

  const assSelect = document.getElementById('createAssigneeSelect');
  assSelect.innerHTML = '';
  (currentPlan?.availableUsers || []).forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.displayName;
    opt.dataset.accountId = (u.accountId && u.accountId !== 'unassigned') ? u.accountId : '';
    opt.textContent = u.displayName + (u.isPlaceholder ? ' [Placeholder]' : '');
    assSelect.appendChild(opt);
  });

  const startWeekSelect = document.getElementById('createStartWeekSelect');
  startWeekSelect.innerHTML = '';
  const curWk = (currentPlan?.weeks || []).find(w => w.isCurrentWeek);
  (currentPlan?.weeks || []).forEach(w => {
    const opt = document.createElement('option');
    opt.value = w.weekKey;
    opt.textContent = `${w.weekKey} (${w.sprintName})`;
    if (curWk && w.weekKey === curWk.weekKey) opt.selected = true;
    startWeekSelect.appendChild(opt);
  });

  document.getElementById('createTaskModal').style.display = 'flex';
  setTimeout(() => summaryInput.focus(), 50);
}

let isCreatingTask = false;
async function executeCreateTask() {
  if (isCreatingTask) return;
  const btn = document.getElementById('btnSubmitCreateTask');
  const summaryInput = document.getElementById('createSummaryInput');
  const summary = summaryInput.value.trim();
  const epicSelect = document.getElementById('createEpicSelect');
  const selectedEpicOpt = epicSelect ? epicSelect.options[epicSelect.selectedIndex] : null;
  const epic = epicSelect?.value || undefined;
  const parentKey = selectedEpicOpt?.dataset?.key || undefined;

  const assSelect = document.getElementById('createAssigneeSelect');
  const selectedAssOpt = assSelect ? assSelect.options[assSelect.selectedIndex] : null;
  const resource = assSelect?.value || 'Unassigned';
  const assigneeAccountId = selectedAssOpt?.dataset?.accountId || undefined;

  const parsedEffort = parseInt(document.getElementById('createEffortInput').value, 10);
  const effortHours = isNaN(parsedEffort) ? undefined : parsedEffort;
  const startWeek = document.getElementById('createStartWeekSelect').value;
  const errEl = document.getElementById('createTaskError');

  if (!summary) {
    summaryInput.style.borderColor = 'var(--cp-border-danger)';
    summaryInput.focus();
    if (errEl) {
      errEl.textContent = 'Please enter a task summary.';
      errEl.style.display = 'block';
    }
    return;
  }

  summaryInput.style.borderColor = '';
  if (errEl) errEl.style.display = 'none';

  isCreatingTask = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Creating in Jira...';
  }

  try {
    const res = await callResolver('createInlineTask', {
      summary,
      epic,
      epicKey: parentKey,
      parentKey,
      resource,
      resourceAccountId: assigneeAccountId,
      assigneeAccountId,
      effortHours,
      startWeek,
      spanWeeks: 3
    });

    if (!res || res.ok !== true) {
      if (errEl) {
        errEl.textContent = (res && (res.message || res.error)) || 'Failed to create task in Jira.';
        errEl.style.display = 'block';
      }
      return;
    }

    summaryInput.value = '';
    closeModal('createTaskModal');
    if (res && res.task) {
      expandAncestors(res.task);
      registerOptimisticTask(res.task);
    }
    if (currentHierarchyView === 'epics') {
      currentHierarchyView = 'all';
      const hierSwitcher = document.getElementById('hierarchySwitcher');
      if (hierSwitcher) hierSwitcher.value = 'all';
    }
    if (res && res.plan && Array.isArray(res.plan.tasks)) {
      mergeOptimisticTasks(res.plan);
      currentPlan = res.plan;
      renderPlan();
    } else if (res && res.task && currentPlan && Array.isArray(currentPlan.tasks)) {
      if (!currentPlan.tasks.some(t => t.key === res.task.key)) {
        currentPlan.tasks.push(res.task);
      }
      renderPlan();
    } else {
      await loadProjectPlan();
    }
    if (res?.task?.key) {
      setTimeout(() => {
        scrollRowIntoView(res.task.key);
      }, 120);
    }
    showFlag({ text: 'Task ' + (res?.task?.key || '') + ' created and scheduled.' });
  } catch (err) {
    if (errEl) {
      errEl.textContent = 'An unexpected network error occurred.';
      errEl.style.display = 'block';
    }
  } finally {
    isCreatingTask = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Create & Schedule';
    }
  }
}

function openCreateEpicModal() {
  if (currentPlan && currentPlan.hasEpic === false) {
    showErrorBanner('Epics are not enabled in this project type.');
    return;
  }
  const summaryInput = document.getElementById('newEpicSummaryInput');
  summaryInput.value = '';
  summaryInput.style.borderColor = '';
  const errEl = document.getElementById('createEpicError');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  document.getElementById('createEpicModal').style.display = 'flex';
  setTimeout(() => summaryInput.focus(), 50);
}

let isCreatingEpic = false;
async function executeCreateEpic() {
  if (isCreatingEpic) return;
  const btn = document.getElementById('btnSubmitCreateEpic');
  const summaryInput = document.getElementById('newEpicSummaryInput');
  const summary = summaryInput.value.trim();
  const errEl = document.getElementById('createEpicError');

  if (!summary) {
    summaryInput.style.borderColor = 'var(--cp-border-danger)';
    summaryInput.focus();
    if (errEl) {
      errEl.textContent = 'Please enter an epic summary.';
      errEl.style.display = 'block';
    }
    return;
  }

  summaryInput.style.borderColor = '';
  if (errEl) errEl.style.display = 'none';

  isCreatingEpic = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Creating Epic...';
  }

  try {
    const res = await callResolver('createJiraEpic', { summary });
    if (!res || res.ok !== true) {
      if (errEl) {
        errEl.textContent = (res && (res.message || res.error)) || 'Failed to create epic in Jira.';
        errEl.style.display = 'block';
      }
      return;
    }

    summaryInput.value = '';
    closeModal('createEpicModal');
    if (res && res.epic && currentPlan) {
      if (!Array.isArray(currentPlan.availableEpics)) currentPlan.availableEpics = [];
      if (!currentPlan.availableEpics.some(e => e.key === res.epic.key)) {
        currentPlan.availableEpics.push(res.epic);
      }
      // The epic picker and the create form rebuild their lists from availableEpics when opened.
    }
    showFlag({ text: 'Epic ' + (res?.epic?.key || '') + ' created.' });
  } catch (err) {
    if (errEl) {
      errEl.textContent = 'An unexpected network error occurred.';
      errEl.style.display = 'block';
    }
  } finally {
    isCreatingEpic = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Create Epic';
    }
  }
}

function closeModal(id) {
  hideModal(document.getElementById(id));
}

function hideModal(modal) {
  modal.style.display = 'none';
  modal.dataset.dirty = '';
  const prompt = modal.querySelector('.discard-prompt');
  if (prompt) prompt.remove();
  // Escape or a backdrop click on the status question cancels the whole action.
  if (modal.id === 'statusOfferModal' && statusOfferResolve) statusOfferResolve('cancel');
}

// Progress and Jira status (owner decision 2026-11-06, INV-03): the planner never changes a status by
// itself. When a new progress disagrees with the status, it asks once, and the user chooses.
let statusOfferResolve = null;

/** Shows the status question. Resolves 'move', 'keep' or 'cancel'. */
function askStatusOffers(offers) {
  const prompt = offerPrompt(offers);
  const modal = document.getElementById('statusOfferModal');
  if (!prompt || !modal) return Promise.resolve('keep');
  document.getElementById('statusOfferQuestion').textContent = prompt.question;
  const list = document.getElementById('statusOfferList');
  list.replaceChildren(...prompt.lines.map(line => {
    const li = document.createElement('li');
    li.textContent = line;
    return li;
  }));
  list.hidden = prompt.lines.length === 0;
  const move = document.getElementById('btnStatusOfferMove');
  const keep = document.getElementById('btnStatusOfferKeep');
  move.textContent = prompt.move;
  keep.textContent = prompt.keep;
  const opener = document.activeElement;
  modal.style.display = 'flex';
  move.focus();
  announce(prompt.question);
  return new Promise(resolve => {
    statusOfferResolve = (choice) => {
      statusOfferResolve = null;
      hideModal(modal);
      if (opener && typeof opener.focus === 'function') opener.focus();
      resolve(choice);
    };
  });
}

/**
 * Adds the status the user chooses to progress edits ({key, progress, updates}); false when the user
 * cancelled, so nothing is written.
 */
async function withStatusChoice(edits) {
  const offers = statusOffers(edits.map(e => ({ key: e.key, status: findTask(e.key)?.status, progress: e.progress, chosenStatus: e.updates.status })));
  if (!offers.length) return true;
  const choice = await askStatusOffers(offers);
  if (choice === 'cancel') return false;
  if (choice === 'move') {
    for (const o of offers) {
      const edit = edits.find(e => e.key === o.key);
      if (edit) edit.updates.status = o.to;
    }
  }
  return true;
}

/** A Done item's progress is 100% and locked in the dialog; choosing another status there unlocks it. */
function setDialogProgressLock(key, status) {
  const reason = progressLockReason({ key, status });
  for (const id of ['editProgressInput', 'editProgressSlider', 'btnModalUseRollup']) {
    const el = document.getElementById(id);
    if (el) el.disabled = !!reason;
  }
  document.querySelectorAll('.modal-prog-preset').forEach(b => { b.disabled = !!reason; });
  const note = document.getElementById('editProgressLockNote');
  if (note) {
    note.textContent = reason || '';
    note.hidden = !reason;
  }
}

function openModal() {
  return [...document.querySelectorAll('.modal-backdrop')].find(m => m.style.display === 'flex' || m.style.display === 'block') || null;
}

/** Escape or a backdrop click: a form with unsaved edits asks first, inside the form (no browser dialog). */
function closeModalAsking(modal) {
  if (!modal.dataset.dirty) {
    hideModal(modal);
    return;
  }
  const card = modal.querySelector('.modal-card') || modal;
  let prompt = card.querySelector('.discard-prompt');
  if (!prompt) {
    prompt = document.createElement('div');
    prompt.className = 'discard-prompt';
    prompt.setAttribute('role', 'alertdialog');
    prompt.setAttribute('aria-label', 'Unsaved changes');
    const text = document.createElement('span');
    text.textContent = 'Discard unsaved changes?';
    const discard = document.createElement('button');
    discard.type = 'button';
    discard.className = 'btn btn-outline btn-sm';
    discard.textContent = 'Discard';
    discard.addEventListener('click', () => hideModal(modal));
    const keep = document.createElement('button');
    keep.type = 'button';
    keep.className = 'btn btn-primary btn-sm';
    keep.textContent = 'Keep editing';
    keep.addEventListener('click', () => prompt.remove());
    prompt.append(text, discard, keep);
    card.prepend(prompt);
  }
  prompt.querySelector('.btn-primary').focus();
}

// Hours per person per week from the Jira estimates on the plan (D-10).
function renderUtilizationView() {
  const cont = document.getElementById('utilizationProfilesContent');
  const weekStarts = Array.from({ length: 8 }, (_, i) => addDaysIso(mondayOf(todayIso()), i * 7));
  const rows = weeklyHours(currentPlan?.tasks || [], weekStarts);
  if (rows.length === 0) {
    cont.innerHTML = '<div>No assigned, estimated tasks with dates on the plan.</div>';
    return;
  }
  cont.innerHTML = html`<table class="hours-table">
    <thead><tr><th scope="col">Person</th>${weekStarts.map(w => html`<th scope="col">${w}</th>`)}</tr></thead>
    <tbody>${rows.map(r => html`<tr><th scope="row">${r.name}</th>${r.hours.map(h => html`<td>${h} h</td>`)}</tr>`)}</tbody>
  </table>`;
}

