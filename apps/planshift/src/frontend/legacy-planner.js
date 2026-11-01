/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: planner UI logic, moved out of the inline script in index.html (B-01).
 * Parts are replaced by the canvas timeline and the pure modules in later items.
 */

import { callResolver as rawCallResolver, openIssueInNewTab } from './bridge';
import { showFlag } from './flag';
import { classifyResult } from '../ui/result';
import { UndoStack } from '../ui/undo-stack';
import { snapshotPlan, buildUndoEntry, actionLabel } from '../ui/undo-plan';
import { initErrorBanner } from './banner';
import { enableTheme, onThemeChange } from './theme';
import { openWhyPopup, closeWhyPopup, isWhyPopupOpen, initWhyPopup } from './why-popup';
import { initChangesPanel, isChangesPanelOpen, closeChangesPanel } from './changes-panel';
import { describePendingWrites } from '../ui/change-log';
import { html } from '../ui/safe-html';
import { CanvasTimeline, ROW_H, BAR_H } from './canvas-timeline';
import { barRect, daysBetween, visibleRange, handleOffsets, snapDays, previewMoves, xForDate } from '../ui/timeline-geometry';
import { GRID_COLUMNS, navigate, rowCells, rowLevel, moveKey, moveAnnouncement } from '../ui/keyboard-grid';
import { shouldAutoCompact, ZOOMS, zoomById, zoomStep, mondayOf, initialRange, rangeDays, extendRange, edgeToExtend, headerCells, gridLines, anchorScroll, dateAt } from '../ui/time-scale';

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
    console.warn('Forge router.open failed, using window.open fallback:', err);
  }

  const baseUrl = getJiraBaseUrl();
  const fullUrl = `${baseUrl}/browse/${issueKey}`;
  if (!event || !event.target || (event.target.tagName !== 'A' && !event.target.closest('a'))) {
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
  }
}

// Undo (B-14): every undoable write is recorded with its inverse when the next plan arrives.
const UNDOABLE = new Set(['updateWbsTask', 'unscheduleTask', 'scheduleBacklogTask']);
const undoStack = new UndoStack(20);
let pendingUndo = null;
let replayingUndo = false;

async function callResolver(fn, payload = {}) {
  if (!UNDOABLE.has(fn) || replayingUndo) return rawCallResolver(fn, payload);
  if (!pendingUndo) pendingUndo = { before: snapshotPlan(currentPlan), fn, payload };
  const res = await rawCallResolver(fn, payload);
  const verdict = classifyResult(res);
  if (verdict.failed) {
    pendingUndo = null;
    // A failed write stays on screen until the user closes it (UP-46, UP-69).
    showFlag({ text: verdict.message || 'The change was not saved.', error: true });
  } else {
    pendingUndo.done = true;
  }
  return res;
}

/** Called when a new plan is shown: records the finished write and offers Undo in a Flag. */
function settleUndo() {
  const p = pendingUndo;
  if (!p || !p.done || !currentPlan) return;
  pendingUndo = null;
  const entry = buildUndoEntry(p.before, snapshotPlan(currentPlan), p.payload.taskId);
  if (!entry) return;
  entry.label = actionLabel(p.fn, p.payload, entry);
  undoStack.push(entry);
  showFlag({ text: `${entry.label}.`, action: { label: 'Undo', run: undoLast } });
}

function findAnyTask(key) {
  return findTask(key) || (currentPlan?.backlogTasks || []).find(t => t.key === key);
}

/** Applies undo or redo operations in order, with each task's current version. */
async function replayUndo(ops) {
  replayingUndo = true;
  let ok = true;
  try {
    for (const op of ops) {
      let res;
      if (op.kind === 'unschedule') {
        res = await rawCallResolver('unscheduleTask', { taskId: op.key });
      } else if (op.kind === 'schedule') {
        res = await rawCallResolver('scheduleBacklogTask', { taskId: op.key, startWeek: op.updates.startWeek, spanWeeks: op.updates.spanWeeks || 1 });
        if (!classifyResult(res).failed && op.updates.startDate) {
          res = await rawCallResolver('updateWbsTask', { taskId: op.key, updates: { startDate: op.updates.startDate, endDate: op.updates.endDate } });
        }
      } else {
        const t = findAnyTask(op.key);
        res = await rawCallResolver('updateWbsTask', { taskId: op.key, updates: op.updates, expectedVersion: (t && t.version) || 0 });
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
let columnWidths = { epic: 110, story: 100, task: 260, resource: 130, effort: 65, progress: 65, target: 65, status: 95 };
const DEFAULT_COLUMN_WIDTHS = { epic: 110, story: 100, task: 260, resource: 130, effort: 65, progress: 65, target: 65, status: 95 };
let hiddenColumns = new Set();
const ALL_COLUMNS = [
  { key: 'epic', label: 'Epic', icon: '🟪', defaultWidth: 110, description: 'Parent Epic roadmap category' },
  { key: 'story', label: 'Story', icon: '🔷', defaultWidth: 100, description: 'Issue type (Story, Task, Subtask)' },
  { key: 'task', label: 'Task', icon: '📝', defaultWidth: 260, locked: true, description: 'Issue key and summary (Required)' },
  { key: 'resource', label: 'Resource', icon: '👥', defaultWidth: 130, description: 'Assigned team member' },
  { key: 'effort', label: 'Hrs', icon: '⏱️', defaultWidth: 65, description: 'Estimated effort in hours' },
  { key: 'progress', label: 'Progress', icon: '📈', defaultWidth: 65, description: 'Actual completion %' },
  { key: 'target', label: 'Target', icon: '🎯', defaultWidth: 65, description: 'Planned target completion %' },
  { key: 'status', label: 'Status', icon: '🏷️', defaultWidth: 95, description: 'Workflow status' }
];
function getVisibleColKeys() {
  // Compact mode shows only Key and Summary, so the timeline gets the width (B-27).
  if (compactColumns) return ['task'];
  return ALL_COLUMNS.map(c => c.key).filter(k => !hiddenColumns.has(k));
}
const COL_KEYS = ALL_COLUMNS.map(c => c.key);
// Time axis (B-27): zoom level, an open-ended range computed in the browser, and compact columns.
const ZOOM_KEY = 'cascadeplan_zoom';
const COMPACT_KEY = 'cascadeplan_compact_columns';
const COMPACT_TASK_WIDTH = 220;
const EXTEND_WEEKS = 26;
function readPref(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
}
function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}
let zoomId = readPref(ZOOM_KEY, 'week');
let compactColumns = readPref(COMPACT_KEY, 'off') === 'on';
let compactDecided = false;
let timeRange = null;
function dayPx() {
  return zoomById(zoomId).dayPx;
}
function trackWidth() {
  return timeRange ? rangeDays(timeRange) * dayPx() : 0;
}
function colWidth(k) {
  return compactColumns && k === 'task' ? COMPACT_TASK_WIDTH : columnWidths[k];
}
/** Left offset of each frozen data column. */
function frozenOffsets() {
  const out = {};
  let x = 0;
  getVisibleColKeys().forEach(k => { out[k] = x; x += colWidth(k); });
  return out;
}
const expandedTasks = new Set();
let currentHierarchyView = 'all'; // 'all' | 'epics' | 'stories'

// Initialization with immediate readiness check
async function initApp() {
  initErrorBanner();
  initWhyPopup();
  initChangesPanel();
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
    wrapper.addEventListener('scroll', scheduleVirtualRows, { passive: true });
  }
  document.addEventListener('cp:drivers', (e) => {
    if (timeline) timeline.driverKeys = e.detail || [];
    drawTimeline(true);
  });
  setupEventListeners();
  initKeyboard();
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
  const hierSwitcher = document.getElementById('hierarchySwitcher');
  if (hierSwitcher) {
    hierSwitcher.addEventListener('change', (e) => {
      currentHierarchyView = e.target.value;
      renderTimelineRows();
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
    const inField = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT' || e.target.isContentEditable);
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
    if (e.key === 'Escape' && isChangesPanelOpen()) {
      closeChangesPanel();
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
    if (pinnedDependencyTaskId && !e.target.closest('.bar-hit')) {
      pinnedDependencyTaskId = null;
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
      if (!activeProgressTaskKey) return;
      await callResolver('updateWbsTask', {
        taskId: activeProgressTaskKey,
        updates: { progress: pct, manualProgress: true }
      });
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
      if (!activeProgressTaskKey) return;
      await callResolver('updateWbsTask', {
        taskId: activeProgressTaskKey,
        updates: { progress: Math.max(0, Math.min(100, val)), manualProgress: true }
      });
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
  const wrapper = document.getElementById('ganttWrapper');
  const topScroll = document.getElementById('ganttTopScrollbar');
  const topInner = document.getElementById('ganttTopScrollbarInner');
  if (!wrapper || !topScroll || !topInner) return;

  topInner.style.width = wrapper.scrollWidth + 'px';
  if (!isSyncingGanttScroll) {
    topScroll.scrollLeft = wrapper.scrollLeft;
  }
}

function initGanttScrollSync() {
  const wrapper = document.getElementById('ganttWrapper');
  const topScroll = document.getElementById('ganttTopScrollbar');
  if (!wrapper || !topScroll) return;

  topScroll.addEventListener('scroll', () => {
    if (isSyncingGanttScroll) return;
    isSyncingGanttScroll = true;
    wrapper.scrollLeft = topScroll.scrollLeft;
    requestAnimationFrame(() => { isSyncingGanttScroll = false; });
  });

  wrapper.addEventListener('scroll', () => {
    closeAllPopovers();
    if (isSyncingGanttScroll) return;
    isSyncingGanttScroll = true;
    topScroll.scrollLeft = wrapper.scrollLeft;
    requestAnimationFrame(() => { isSyncingGanttScroll = false; });
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

    // Skip interactive elements
    if (e.target.closest('.bar-hit, .bar-handle, .btn, button, input, select, a, .resizer, .row-drag-handle, .inline-edit-input, .resource-chip-btn, .editable-badge-chip, .epic-link-chip, .th-col-menu-btn, .row-action-btn, .tree-toggle-btn')) {
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

function switchView(viewName) {
  document.getElementById('timelineViewSection').style.display = viewName === 'timeline' ? 'flex' : 'none';
  document.getElementById('utilizationViewSection').style.display = viewName === 'utilization' ? 'block' : 'none';
  document.getElementById('heatmapViewSection').style.display = viewName === 'heatmap' ? 'block' : 'none';

  if (viewName === 'timeline') {
    setTimeout(updateVirtualRows, 100);
  } else if (viewName === 'utilization') {
    renderUtilizationView();
  } else if (viewName === 'heatmap') {
    renderHeatmapView();
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
  setTimeout(syncGanttScrollWidth, 50);
}

function updateColumnManagerUI() {
  const visibleKeys = getVisibleColKeys();
  const badge = document.getElementById('colCountBadge');
  if (badge) {
    if (hiddenColumns.size > 0) {
      badge.textContent = `${visibleKeys.length}/${ALL_COLUMNS.length} (${hiddenColumns.size} hidden)`;
      badge.classList.add('has-hidden');
    } else {
      badge.textContent = `${visibleKeys.length}/${ALL_COLUMNS.length}`;
      badge.classList.remove('has-hidden');
    }
  }

  // Update Alert Bar above table
  const alertBar = document.getElementById('hiddenColsAlertBar');
  const alertText = document.getElementById('hiddenColsText');
  if (alertBar && alertText) {
    if (hiddenColumns.size > 0) {
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
        <label for="col_chk_${col.key}" class="col-option-label" style="cursor:${col.locked ? 'default' : 'pointer'};">
          <span>${col.icon}</span>
          <span>${col.label}</span>
          ${col.locked ? html`<span class="badge badge-neutral" style="font-size:9px; padding:1px 4px;">Required</span>` : ''}
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

  const menu = document.createElement('div');
  menu.id = 'columnHeaderContextMenu';
  menu.className = 'column-manager-popover';
  menu.style.width = '190px';
  menu.style.position = 'fixed';
  menu.style.left = Math.min(window.innerWidth - 210, e.clientX) + 'px';
  menu.style.top = (e.clientY + 12) + 'px';
  menu.style.zIndex = '1200';

  menu.innerHTML = html`
    <div style="font-weight:700; font-size:11px; color: var(--cp-text-subtle); margin-bottom:4px;">Column: ${colLabel}</div>
    <button class="btn btn-outline btn-sm" id="btnHideThisCol" style="text-align:left; justify-content:flex-start; width:100%; font-size:12px; margin-bottom:4px;">
      🚫 Hide "${colLabel}"
    </button>
    <button class="btn btn-subtle btn-sm" id="btnManageAllFromHeader" style="text-align:left; justify-content:flex-start; width:100%; font-size:12px;">
      ⚙ Manage All Columns...
    </button>
  `;

  document.body.appendChild(menu);

  const hideBtn = menu.querySelector('#btnHideThisCol');
  if (hideBtn) {
    hideBtn.addEventListener('click', () => {
      menu.remove();
      toggleColumnVisibility(colKey);
    });
  }
  const manageBtn = menu.querySelector('#btnManageAllFromHeader');
  if (manageBtn) {
    manageBtn.addEventListener('click', () => {
      menu.remove();
      const pop = document.getElementById('columnManagerPopover');
      if (pop) pop.style.display = 'flex';
    });
  }

  function onDocClick(ev) {
    if (!menu.contains(ev.target)) {
      menu.remove();
      document.removeEventListener('click', onDocClick);
    }
  }
  setTimeout(() => document.addEventListener('click', onDocClick), 10);
}

async function loadProjectPlan() {
  const loader = document.getElementById('plannerLoadingIndicator');
  const errBanner = document.getElementById('plannerErrorBanner');
  if (loader) loader.style.display = 'flex';
  if (errBanner) errBanner.style.display = 'none';

  const plan = await callResolver('getProjectPlan', {});
  if (loader) loader.style.display = 'none';

  if (plan && Array.isArray(plan.tasks)) {
    currentPlan = plan;
    if (plan.columnWidths) {
      columnWidths = { ...columnWidths, ...plan.columnWidths };
    }
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
  } else {
    if (errBanner) {
      errBanner.style.display = 'flex';
      const msg = document.getElementById('plannerErrorMsg');
      if (msg) msg.textContent = 'Unable to synchronize with Jira. Please verify your connection or click Retry.';
    }
  }
}

function renderPlan() {
  if (!currentPlan) return;
  renderPlanSummary();

  if (currentPlan.tasks) {
    currentPlan.tasks.forEach(t => {
      if (t.isEpic || t.childrenCount || (t.subtasks && t.subtasks.length > 0)) {
        expandedTasks.add(t.key);
      }
    });
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
}

/** Header badges, backlog count, truncation note and legend. */
function renderPlanSummary() {
  document.getElementById('projectBadge').textContent = `Project: ${currentPlan.projectKey}`;
  document.getElementById('completionBadge').textContent = `Completion: ${currentPlan.overallProjectCompletion}% | Target: ${currentPlan.overallTargetCompletion}%`;
  document.getElementById('backlogCount').textContent = currentPlan.backlogTasks ? currentPlan.backlogTasks.length : 0;
  const truncatedNote = document.getElementById('truncatedNote');
  if (truncatedNote) {
    // More issues exist than one plan reads (B-10).
    truncatedNote.hidden = !currentPlan.truncated;
    truncatedNote.textContent = currentPlan.truncated
      ? `Showing the newest ${currentPlan.truncated.shown} of about ${currentPlan.truncated.total} issues`
      : '';
  }

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
    el.innerHTML = html`<span class="milestone-icon">🔷</span><span>${m.title}</span><span style="color: var(--cp-text-subtle);">(${m.weekKey})</span>`;
    strip.appendChild(el);
  });
}

function renderBacklogTray() {
  const container = document.getElementById('backlogCardsList');
  container.innerHTML = '';

  const backlog = currentPlan.backlogTasks || [];
  if (backlog.length === 0) {
    container.innerHTML = '<div style="color: var(--cp-text-subtle); font-size:12px; text-align:center; padding:20px;">No unmapped backlog issues. Drag from timeline to unmap.</div>';
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
      </div>
    `;
    const bKeyLink = card.querySelector('.backlog-key-link');
    if (bKeyLink) {
      bKeyLink.addEventListener('click', (e) => {
        openJiraIssueInNewTab(item.key, e);
      });
    }
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: item.key, effortHours: item.effortHours }));
    });
    container.appendChild(card);
  });
}

function renderTimelineHeader() {
  const tr = document.getElementById('ganttHeaderRow');
  tr.innerHTML = '';
  const offsets = frozenOffsets();

  getVisibleColKeys().forEach(k => {
    const colDef = ALL_COLUMNS.find(c => c.key === k) || { label: k, locked: false };
    const th = document.createElement('th');
    th.className = 'th-col th-frozen';
    th.style.width = colWidth(k) + 'px';
    th.style.minWidth = colWidth(k) + 'px';
    th.style.left = offsets[k] + 'px';

    th.innerHTML = html`
      <div class="th-content-wrap">
        <span class="th-label-text">${colDef.label}</span>
        ${!colDef.locked ? html`<button class="th-col-menu-btn" data-col-key="${k}" title="Column options (Hide ${colDef.label})">▾</button>` : ''}
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
    resizer.className = 'resizer';
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

/** At first render, compact columns follow the user's choice, or turn on when the timeline would be narrow. */
function decideCompactColumns() {
  if (compactDecided) return false;
  compactDecided = true;
  const wrapper = document.getElementById('ganttWrapper');
  const track = document.querySelector('#ganttHeaderRow .timeline-header-cell');
  if (!wrapper || !wrapper.clientWidth || !track) return false;
  let choice = null;
  try { choice = localStorage.getItem(COMPACT_KEY); } catch (e) {}
  // The rendered width of the data columns, padding and borders included.
  const next = shouldAutoCompact(wrapper.clientWidth, track.offsetLeft, 7 * dayPx(), choice);
  const changed = next !== compactColumns;
  compactColumns = next;
  updateZoomButtons();
  return changed;
}

/** Makes the range cover every scheduled date with a margin, before the first render. */
function coverPlanDates() {
  if (!timeRange) timeRange = initialRange(todayIso());
  const dates = (currentPlan?.tasks || []).flatMap(t => [t.startDate, t.endDate]).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d || ''));
  if (!dates.length) return;
  const min = dates.reduce((m, d) => (d < m ? d : m));
  const max = dates.reduce((m, d) => (d > m ? d : m));
  while (daysBetween(timeRange.start, min) < 28) timeRange = extendRange(timeRange, 'before', EXTEND_WEEKS);
  while (daysBetween(max, timeRange.end) < 28) timeRange = extendRange(timeRange, 'after', EXTEND_WEEKS);
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
  syncGanttScrollWidth();
}

/** Sets the timeline scroll position and the top scrollbar together, so the mirror cannot undo it. */
function setTimelineScrollLeft(x) {
  const w = document.getElementById('ganttWrapper');
  const top = document.getElementById('ganttTopScrollbar');
  w.scrollLeft = x;
  if (top) top.scrollLeft = w.scrollLeft;
}

/** Scrolling near either edge adds time there; the view does not jump (B-27 criterion 2). */
function maybeExtendRange() {
  const w = document.getElementById('ganttWrapper');
  if (!w || !timeRange) return;
  const edge = edgeToExtend(w.scrollLeft, w.clientWidth - layout.trackLeft, trackWidth());
  if (edge === 'before') {
    const shift = EXTEND_WEEKS * 7 * dayPx();
    timeRange = extendRange(timeRange, 'before', EXTEND_WEEKS);
    const x = w.scrollLeft + shift;
    applyTimeAxis();
    setTimelineScrollLeft(x);
  } else if (edge === 'after') {
    timeRange = extendRange(timeRange, 'after', EXTEND_WEEKS);
    applyTimeAxis();
  }
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
  if (compact) compact.setAttribute('aria-pressed', String(compactColumns));
}

function setCompactColumns(on) {
  compactColumns = on;
  writePref(COMPACT_KEY, on ? 'on' : 'off');
  updateZoomButtons();
  renderTimelineHeader();
  renderTimelineRows();
  applyTimeAxis();
}

function setupColumnResizer(resizer, colKey) {
  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[colKey];

    function onMouseMove(moveEvent) {
      const newWidth = Math.max(50, startWidth + (moveEvent.clientX - startX));
      columnWidths[colKey] = newWidth;
      renderTimelineHeader();
      renderTimelineRows();
      syncGanttScrollWidth();
    }

    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      syncGanttScrollWidth();
      callResolver('saveColumnWidths', { columnWidths });
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
    currentContainer.innerHTML = '<div style="width:100%; font-size:10px; font-weight:700; color: var(--cp-text-subtle); text-transform:uppercase; margin-bottom:2px;">Assigned Team:</div>';

    assignedResources.forEach(res => {
      const chip = document.createElement('div');
      chip.className = 'resource-current-chip' + (res.isParent ? ' is-lead' : '');
      const initials = getInitials(res.name);
      chip.innerHTML = html`
        <span class="resource-option-avatar" style="width:16px; height:16px; font-size:9px;">${initials}</span>
        <span>${res.name}</span>
        <span style="font-size:9px; opacity:0.8;">${res.isParent ? '(Lead)' : ''}</span>
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

  async function syncTaskResources() {
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

    const updates = { resource: primaryName, resourceAccountId: primaryAccountId };
    if (ids.every(Boolean)) updates.contributors = ids.map(accountId => ({ accountId }));
    else updates.contributingResources = contributingList;
    await callResolver('updateWbsTask', { taskId: curTask.key, updates });

    renderTimelineRows();
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
        <span style="flex:1;">Unassigned</span>
      `;
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        clearAllResources();
      });
      listEl.appendChild(opt);
    }

    const users = (currentPlan?.availableUsers || []).filter(u =>
      u.displayName && u.displayName.toLowerCase().includes(q)
    );

    if (users.length === 0 && q && !'unassigned'.includes(q)) {
      listEl.innerHTML = '<div style="padding:10px; font-size:11px; color: var(--cp-text-subtle); text-align:center;">No matching team members</div>';
      return;
    }

    users.forEach(u => {
      const assignedEntry = assignedResources.find(r => r.name === u.displayName);
      const isAssigned = Boolean(assignedEntry);
      const isLead = assignedEntry?.isParent;

      const opt = document.createElement('div');
      opt.className = 'resource-option' + (isAssigned ? ' is-selected' : '');
      const initials = getInitials(u.displayName);
      const isPlaceholder = u.isPlaceholder ? html` <span style="font-size:10px; color: var(--cp-text-subtlest);">(Placeholder)</span>` : '';

      let badgeHtml = html``;
      if (isAssigned) {
        badgeHtml = isLead
          ? html`<span class="resource-badge-lead">Lead</span>`
          : html`<span class="resource-badge-contrib">Contributor</span>`;
      }

      opt.innerHTML = html`
        <input type="checkbox" class="resource-option-checkbox" ${isAssigned ? 'checked' : ''} />
        <span class="resource-option-avatar">${initials}</span>
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${u.displayName}${isPlaceholder}</span>
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
      opt.innerHTML = html`<span style="color: var(--cp-text-subtle); font-size:11px;">✕ (None / Standalone Task)</span>`;
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
      listEl.innerHTML = '<div style="padding:10px; font-size:11px; color: var(--cp-text-subtle); text-align:center;">No matching epics</div>';
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

  titleEl.textContent = `Target: ${task.key}`;
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
      <td class="td-data td-epic-cell" style="width:${columnWidths.epic}px;">
        <span class="epic-link-chip new-task-epic-chip ${inheritedEpic ? 'has-epic' : 'no-epic'}" title="Choose Epic">${epicDisplay} ▾</span>
      </td>
    `;
  }
  if (visibleKeys.includes('story')) {
    cellsHtml = html`${cellsHtml}<td class="td-data" style="width:${columnWidths.story}px; color: var(--cp-text-brand); font-weight:700;">🔷 Task</td>`;
  }
  // task is always visible (locked)
  cellsHtml = html`${cellsHtml}
    <td class="td-data td-task-summary" style="width:${colWidth('task')}px;">
      <div style="display:flex; align-items:center; gap:6px; padding-left:14px;">
        <input type="text" class="inline-create-input" placeholder="Type new task summary & press Enter to save..." autocomplete="off" />
        <button class="btn-inline-save">Add</button>
        <button class="btn-inline-cancel" title="Cancel (Esc)">✕</button>
      </div>
    </td>
  `;
  if (visibleKeys.includes('resource')) {
    cellsHtml = html`${cellsHtml}
      <td class="td-data td-resource-cell" style="width:${columnWidths.resource}px;">
        <div class="resource-chip-btn new-task-resource-btn" title="Assign team member">
          <span class="resource-option-avatar">U</span>
          <span class="new-task-resource-name" style="flex:1; overflow:hidden; text-overflow:ellipsis;">Unassigned</span>
          <span style="font-size:10px; color: var(--cp-text-subtle);">▾</span>
        </div>
      </td>
    `;
  }
  if (visibleKeys.includes('effort')) {
    cellsHtml = html`${cellsHtml}
      <td class="td-data td-effort-cell" style="width:${columnWidths.effort}px; text-align:center;">
        <input type="number" class="inline-edit-input new-task-hours" style="width:50px; text-align:center;" placeholder="h" min="0" />
      </td>
    `;
  }
  if (visibleKeys.includes('progress')) {
    cellsHtml = html`${cellsHtml}<td class="td-data" style="width:${columnWidths.progress}px; text-align:center; color: var(--cp-text-subtle); font-weight:600;">0%</td>`;
  }
  if (visibleKeys.includes('target')) {
    cellsHtml = html`${cellsHtml}<td class="td-data" style="width:${columnWidths.target}px; text-align:center; color: var(--cp-text-subtle); font-weight:600;">0%</td>`;
  }
  if (visibleKeys.includes('status')) {
    cellsHtml = html`${cellsHtml}<td class="td-data" style="width:${columnWidths.status}px; text-align:center;"><span class="badge badge-neutral">NOT_STARTED</span></td>`;
  }
  cellsHtml = html`${cellsHtml}
    <td class="timeline-track-cell">
      <div class="ghost-timeline-bar" style="left:${barLeft}px; width:${barWidth}px;">
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
        epic: selectedEpic || 'General',
        epicKey: selectedEpicKey || undefined,
        resource: selectedResource,
        resourceAccountId: selectedAccountId,
        effortHours: hours,
        startWeek: defaultStartWk,
        spanWeeks: 3,
        targetIndex: insertIndex
      });

      if (res && res.success === false) {
        showFlag({ text: res.error || 'Failed to create task in Jira.', error: true });
        input.disabled = false;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Add';
        isSubmitting = false;
        return;
      }

      await loadProjectPlan();
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
  const firstWeek = document.querySelector('#ganttHeaderRow .timeline-header-cell');
  layout.headerH = table && table.tHead ? table.tHead.offsetHeight : 0;
  layout.trackLeft = firstWeek ? firstWeek.offsetLeft : 0;
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
  timeline.activeKey = hoveredTaskId || pinnedDependencyTaskId;
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
  const planKeys = new Set(currentPlan.tasks.map(t => t.key));
  const out = [];
  tasksToRender.forEach((task, rowIdx) => {
    // A subtask under a collapsed parent, or a story under a collapsed epic on the timeline, is hidden.
    if (task.isSubtask && task.parentKey && !expandedTasks.has(task.parentKey)) return;
    if (!task.isEpic && task.epicKey && task.epicKey !== task.key && planKeys.has(task.epicKey) && !expandedTasks.has(task.epicKey)) return;
    out.push({ task, rowIdx });
  });
  return { rows: out, total: tasksToRender.length };
}

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
    tbody.innerHTML = html`<tr><td colspan="${cols}" style="text-align:center; padding:30px; color: var(--cp-text-subtle);">No scheduled tasks in project. Drag issues from the Backlog Tray or click "+ Add Task / Issue" to schedule.</td></tr>`;
    drawTimeline();
    return;
  }

  // Top Drop Target Row (Index 0)
  topDropRowEl = document.createElement('tr');
  topDropRowEl.className = 'drop-target-row';
  topDropRowEl.innerHTML = html`<td colspan="${cols}">+ Drop here to place task at top of schedule</td>`;
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
  btmDropRow.innerHTML = html`<td colspan="${cols}">+ Drop here to place task at bottom of schedule</td>`;
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
function applyPlanInPlace(plan) {
  const before = rowTaskList.map(t => t.key).join('\n');
  currentPlan = plan;
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
  settleUndo();
}


/** Data cells stay in place while the timeline scrolls (B-27 criterion 5). */
function applyFrozen(tr) {
  const offsets = frozenOffsets();
  const keys = getVisibleColKeys();
  [...tr.children].filter(td => !td.classList.contains('timeline-track-cell')).forEach((td, i) => {
    if (keys[i] === undefined) return;
    td.classList.add('td-frozen');
    td.style.left = offsets[keys[i]] + 'px';
  });
}

/** Builds one task row: data cells plus the timeline cell with the bar hit element. */
function buildTaskRow(task, rowIdx) {
  const isEpic = Boolean(task.isEpic || task.hierarchyLevel === 1);
  const isSub = Boolean(task.isSubtask || task.hierarchyLevel === -1);

  const tr = document.createElement('tr');
  tr.className = 'task-row' + (isEpic ? ' is-epic-row' : (isSub ? ' is-subtask' : ' is-story-row'));
  tr.dataset.taskId = task.key;

  // Has children check
  const hasChildren = Boolean(
    (task.childrenCount && task.childrenCount > 0) ||
    (task.subtasks && task.subtasks.length > 0) ||
    currentPlan.tasks.some(t => (t.parentKey === task.key || t.parentId === task.id || (isEpic && t.epicKey === task.key)) && t.key !== task.key)
  );

  // Expand/collapse icon & Indentation
  let expandToggleHtml = html``;
  if (hasChildren && !isSub) {
    const isExp = expandedTasks.has(task.key);
    expandToggleHtml = html`<button class="tree-toggle-btn" data-parent-key="${task.key}" title="${isExp ? 'Collapse children' : 'Expand children'}">${isExp ? '▼' : '▶'}</button>`;
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
    <div style="display:flex; align-items:center; width:100%; padding-left:${indentPx}px;">
      <div class="row-insert-affordance" title="Insert task below (Row ${rowIdx + 2})">
        <button class="row-insert-plus-btn" title="Insert new task below">＋</button>
      </div>
      <span class="row-drag-handle" draggable="true" title="Drag to reorder row">⠿</span>
      ${expandToggleHtml}
      ${badgeHtml}
      <a href="${siteUrl}/browse/${task.key}" target="_blank" rel="noopener noreferrer" class="task-key-link" title="Open ${task.key} in native Jira (new tab)">${task.key} ↗</a>
      <span class="task-summary-text" style="cursor:pointer; margin-left:6px; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="Click or double-click to edit summary">
        : ${task.summary}
      </span>
      <div class="row-action-toolbar">
        <button class="row-action-btn quick-insert-below-btn" title="Insert task below (Row ${rowIdx + 2})">➕ Add below</button>
        <button class="row-action-btn quick-progress-btn" title="Set actual progress">📈 Progress</button>
        <button class="row-action-btn edit-modal-btn" title="Open full detail modal">✏️ Edit</button>
        <button class="row-action-btn why-date-btn" title="Why this date?">❓ Why?</button>
        <button class="row-action-btn quick-subtask-btn" title="Add Jira subtask">↳ Subtask</button>
        <button class="row-action-btn quick-resource-btn" title="Allocate team member">👥 Team</button>
        <button class="row-action-btn open-jira-row-btn" title="Open ${task.key} in native Jira (new tab)">↗ Jira</button>
        <button class="row-action-btn unschedule-row-btn" title="Remove from planner (Move to backlog)">📤 Backlog</button>
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
    if (epicLabel) {
      epicHtml = html`<span class="epic-link-chip has-epic" title="Click to change epic">🟪 ${epicLabel} ▾</span>`;
    } else {
      epicHtml = html`<span class="epic-link-chip no-epic" title="Click to link epic">+ Link Epic</span>`;
    }
  }

  // Data Columns (Dynamic based on visible columns)
  const visibleKeys = getVisibleColKeys();
  let rowColsHtml = html``;
  if (visibleKeys.includes('epic')) {
    rowColsHtml = html`${rowColsHtml}<td class="td-data td-epic-cell" style="width:${columnWidths.epic}px;">${epicHtml}</td>`;
  }
  if (visibleKeys.includes('story')) {
    rowColsHtml = html`${rowColsHtml}<td class="td-data td-story-cell" style="width:${columnWidths.story}px;" title="${task.story || ''}">${task.story || (isEpic ? 'Epic' : (isSub ? 'Subtask' : 'Task'))}</td>`;
  }
  if (visibleKeys.includes('task')) {
    rowColsHtml = html`${rowColsHtml}<td class="td-data td-task-summary" style="width:${colWidth('task')}px;">${summaryHtml}</td>`;
  }
  if (visibleKeys.includes('resource')) {
    rowColsHtml = html`${rowColsHtml}<td class="td-data td-resource-cell" style="width:${columnWidths.resource}px;"></td>`;
  }
  if (visibleKeys.includes('effort')) {
    rowColsHtml = html`${rowColsHtml}
      <td class="td-data td-effort-cell" style="width:${columnWidths.effort}px; text-align:center; cursor:pointer;" title="Click to edit effort hours">
        <span class="effort-text" style="font-weight:700;">${formatEffort(task.effortHours)}</span>
      </td>
    `;
  }
  if (visibleKeys.includes('progress')) {
    const isProgRollup = isEpic || (task.childrenCount && task.childrenCount > 0);
    const progTitle = isProgRollup
      ? `Actual progress: ${task.progress}% (Rollup from children: click to edit or override)`
      : `Click to set actual progress (${task.progress}%)`;
    rowColsHtml = html`${rowColsHtml}
      <td class="td-data td-progress-cell" style="width:${columnWidths.progress}px; text-align:center; cursor:pointer;" title="${progTitle}">
        <div class="progress-chip-cell ${task.progress === 100 ? 'is-complete' : (task.progress > 0 ? 'is-active' : 'is-zero')}">
          <span class="progress-chip-fill" style="width:${task.progress}%;"></span>
          <span class="progress-chip-text">${task.progress}% ▾</span>
        </div>
      </td>
    `;
  }
  if (visibleKeys.includes('target')) {
    rowColsHtml = html`${rowColsHtml}
      <td class="td-data td-target-cell" style="width:${columnWidths.target}px; text-align:center; cursor:pointer;" title="Click to set target progress (${task.targetProgress}%)">
        <div class="target-chip-cell">
          <span class="target-chip-text">🎯 ${task.targetProgress}% ▾</span>
        </div>
      </td>
    `;
  }
  if (visibleKeys.includes('status')) {
    rowColsHtml = html`${rowColsHtml}
      <td class="td-data td-status-cell" style="width:${columnWidths.status}px; text-align:center;">
        <span class="badge editable-badge-chip ${task.status === 'COMPLETED' ? 'badge-success' : task.status === 'IN_PROGRESS' ? 'badge-primary' : 'badge-neutral'}" title="Click to change status">
          ${task.status} ▾
        </span>
      </td>
    `;
  }
  tr.innerHTML = html`${rowColsHtml}`;
  applyFrozen(tr);

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
          avatarHtml = html`${avatarHtml}<span class="resource-option-avatar" style="background:${bg}; color:${color}; z-index:${10 - aIdx};" title="${res.name}">${initials}</span>`;
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
          <span class="resource-names-wrap" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${labelText}</span>
          ${isMultiple ? html`<span class="res-count-badge">${contributing.length}</span>` : ''}
          <span style="font-size:10px; color: var(--cp-text-subtle);">▾</span>
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
          effortTd.innerHTML = html`<span class="effort-text" style="font-weight:700;">${formatEffort(origHours)}</span>`;
        }
      }

      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') {
          ke.preventDefault();
          saveInlineEffort();
        } else if (ke.key === 'Escape') {
          saved = true;
          effortTd.innerHTML = html`<span class="effort-text" style="font-weight:700;">${formatEffort(origHours)}</span>`;
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
      if (expandedTasks.has(task.key)) {
        expandedTasks.delete(task.key);
      } else {
        expandedTasks.add(task.key);
      }
      renderTimelineRows();
    });
  }

  // Row Drag Handle for Reordering
  const dragHandle = tr.querySelector('.row-drag-handle');
  if (dragHandle) {
    dragHandle.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: task.key, fromReorder: true, origIndex: rowIdx }));
    });
  }

  // Between-Row Drag & Drop (Middle of Plan insertion)
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
    const rect = tr.getBoundingClientRect();
    const isTop = (e.clientY - rect.top) < (rect.height / 2);
    tr.classList.remove('drop-insert-top');
    tr.classList.remove('drop-insert-bottom');

    const dataStr = e.dataTransfer.getData('text/plain');
    if (!dataStr) return;
    try {
      const data = JSON.parse(dataStr);
      const targetIndex = isTop ? rowIdx : rowIdx + 1;
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
      console.error('Error handling row drop:', err);
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
  hit.setAttribute('aria-label', `${task.key}: ${task.summary || ''}, ${task.startDate} to ${task.endDate || task.startDate}, ${task.progress || 0}% done`);
}

/** Transparent element over a bar: it has no background; the canvas draws the bar. */
function createBarHit(task, isEpic) {
  if (!task.startDate) return null;
  const key = task.key;
  const hit = document.createElement('div');
  hit.className = 'bar-hit' + (isEpic || task.datesFromChildren ? ' is-epic' : '');
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
      if (e.button !== 0 || e.target.classList.contains('bar-handle')) return;
      e.preventDefault();
      startBarPointerEdit(e, key, 'move', hit);
    });
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
    if (!e.defaultPrevented && !isDraggingBar) {
      pinnedDependencyTaskId = pinnedDependencyTaskId === key ? null : key;
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
    const moves = previewMoves(currentPlan.tasks, key, mode === 'right' ? 0 : s, mode === 'left' ? 0 : s, today);
    const mine = moves.get(key);
    const sign = s > 0 ? `+${s}` : `${s}`;
    timeline.drag = { key, moves, label: mode === 'move' ? `${key} ➔ ${mine.start} (${sign}d)` : `${key} ${mine.start} to ${mine.end}` };
    positionBarHit(hit, { ...task, startDate: mine.start, endDate: mine.end });
    wrapper.dataset.preview = JSON.stringify(Object.fromEntries(moves));
    // Name every issue and field the drop will change before the user lets go (B-23, INV-11).
    const strip = document.getElementById('writePreview');
    if (strip) {
      strip.textContent = describePendingWrites(currentPlan.tasks, moves, key).text;
      strip.hidden = false;
    }
    timeline.requestDraw();
  }

  async function onUp() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    setTimeout(() => { isDraggingBar = false; }, 80);
    delete wrapper.dataset.preview;
    const strip = document.getElementById('writePreview');
    if (strip) strip.hidden = true;
    const mine = timeline.drag && timeline.drag.moves.get(key);
    if (!moved || shift === 0 || !mine) {
      timeline.drag = null;
      positionBarHit(hit, task);
      drawTimeline();
      return;
    }
    const updates = { startDate: mine.start, endDate: mine.end };
    // A resize changes dates only. The estimate changes only when the user ticked the option (B-03).
    const autoScale = mode !== 'move' && document.getElementById('autoScaleEffortCheckbox')?.checked === true;
    if (autoScale && task.effortHours > 0) {
      const oldDays = daysBetween(task.startDate, task.endDate || task.startDate) + 1;
      const newDays = daysBetween(mine.start, mine.end) + 1;
      updates.effortHours = Math.max(1, Math.round((task.effortHours * newDays) / oldDays));
    }
    const res = await callResolver('updateWbsTask', { taskId: key, updates, expectedVersion: task.version || 0 });
    timeline.drag = null;
    if (res && Array.isArray(res.tasks)) {
      applyPlanInPlace(res);
    } else {
      // A refused or failed write shows the banner; reload so the bars show what is stored.
      await loadProjectPlan();
    }
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
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
    if (expandedTasks.has(t.key) && (t.isEpic || t.childrenCount)) row.setAttribute('aria-expanded', 'true');
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
  if (hadFocus) focusGridCell();
}

function viewportFirstRow() {
  const wrapper = document.getElementById('ganttWrapper');
  if (!wrapper) return 0;
  return Math.max(0, Math.min(rowTasks.length - 1, Math.ceil((wrapper.scrollTop + layout.headerH - layout.bodyStart) / ROW_H)));
}

function focusGridCell() {
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
  if (e.key === ' ' && task.startDate && !(task.isEpic || task.hierarchyLevel === 1)) {
    if (task.datesFromChildren) {
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

/** Shows the live preview for day shifts of a task, as a drag does (B-13, B-23). */
function showShiftPreview(key, startShift, endShift, label) {
  const moves = previewMoves(currentPlan.tasks, key, startShift, endShift, todayIso());
  const mine = moves.get(key);
  timeline.drag = { key, moves, label: label(mine) };
  const strip = document.getElementById('writePreview');
  if (strip) {
    strip.textContent = describePendingWrites(currentPlan.tasks, moves, key).text;
    strip.hidden = false;
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
async function commitDates(key, start, end) {
  const task = findTask(key);
  const res = await callResolver('updateWbsTask', { taskId: key, updates: { startDate: start, endDate: end }, expectedVersion: (task && task.version) || 0 });
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
  await commitDates(key, mine.start, mine.end);
  announce(`Saved. ${key}: ${mine.start} to ${mine.end}.`);
  focusGridCell();
}

// Single-pointer path (WCAG 2.5.7): a click on a bar opens a toolbar with the drag actions.
function openBarToolbar(key, anchor) {
  const bar = document.getElementById('barToolbar');
  if (!bar) return;
  bar.dataset.key = key;
  bar.setAttribute('aria-label', `Actions for ${key}`);
  const r = anchor.getBoundingClientRect();
  bar.hidden = false;
  bar.style.top = `${Math.min(window.innerHeight - bar.offsetHeight - 8, r.bottom + 6)}px`;
  bar.style.left = `${Math.max(8, Math.min(window.innerWidth - bar.offsetWidth - 8, r.left))}px`;
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

async function toolbarAction(action, key, btn) {
  const task = findTask(key);
  if (!task) return;
  closeBarToolbar();
  if ((action === 'earlier' || action === 'later') && task.datesFromChildren) {
    showFlag({ text: `${key} follows the dates of its children. Move a child instead.` });
    return;
  }
  if (action === 'earlier' || action === 'later') {
    const days = action === 'later' ? 7 : -7;
    const mine = showShiftPreview(key, days, days, (m) => `${key} ➔ ${m.start}`);
    await commitDates(key, mine.start, mine.end);
  } else if (action === 'dates') {
    openTaskDetailModal(key);
    setTimeout(() => document.getElementById('editStartDateInput')?.focus(), 50);
  } else if (action === 'dependency') {
    openDependencyPopup(key, btn);
  } else if (action === 'progress') {
    const row = rowCache.get(key);
    openProgressPicker(row ? row.querySelector('.td-progress-cell') || btn : btn, key);
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
  depState = { key, active: -1, options: [], chosen: null, anchor };
  document.getElementById('depTitle').textContent = `${key} starts when`;
  document.getElementById('depSearch').value = '';
  document.getElementById('depTrigger').value = '100';
  document.getElementById('depChosen').textContent = 'No issue chosen';
  renderDependencyOptions();
  pop.hidden = false;
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { bottom: 120, left: 120 };
  pop.style.top = `${Math.max(8, Math.min(window.innerHeight - pop.offsetHeight - 8, r.bottom + 6))}px`;
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.left))}px`;
  document.getElementById('depSearch').focus();
}

function closeDependencyPopup() {
  const pop = document.getElementById('depPopup');
  if (pop) pop.hidden = true;
  depState = null;
  focusGridCell();
}

function chooseDependency(i) {
  const t = depState.options[i];
  if (!t) return;
  depState.chosen = t.key;
  document.getElementById('depChosen').textContent = `Waits for ${t.key}`;
  const trig = document.getElementById('depTrigger');
  trig.focus();
  trig.select();
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

function initKeyboard() {
  initGrid();
  document.querySelectorAll('#zoomGroup [data-zoom]').forEach(b => b.addEventListener('click', () => setZoom(b.dataset.zoom)));
  document.getElementById('btnCompactColumns')?.addEventListener('click', () => setCompactColumns(!compactColumns));
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
      if (btn) toolbarAction(btn.dataset.action, bar.dataset.key, btn);
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
    if (e.key === 'Enter') { e.preventDefault(); saveDependency(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeDependencyPopup(); }
  });
  document.getElementById('btnDepSave')?.addEventListener('click', saveDependency);
  document.getElementById('btnDepCancel')?.addEventListener('click', closeDependencyPopup);
  document.addEventListener('click', (e) => {
    const tb = document.getElementById('barToolbar');
    if (tb && !tb.hidden && !tb.contains(e.target) && !e.target.closest('.bar-hit')) closeBarToolbar();
  });
  document.getElementById('ganttWrapper')?.addEventListener('scroll', followBarToolbar, { passive: true });
}

/** Single-letter shortcuts: only while focus is in the planner outside text fields, and only when on (WCAG 2.1.4). */
function onShortcut(e, inField) {
  if (inField || e.ctrlKey || e.metaKey || e.altKey || !shortcutsOn() || openModal()) return false;
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

// Rich Tooltip Helpers
/** The tooltip has a dark background: every line uses inverse text (contrast); a warning has a sign, not a colour. */
function showTaskTooltip(e, task) {
  const tip = document.getElementById('globalTooltip');
  const isEpic = task.isEpic || task.hierarchyLevel === 1;
  const isSub = task.isSubtask || task.hierarchyLevel === -1;
  const levelTitle = isEpic ? '🟪 Epic Roadmap Level' : (isSub ? '↳ Subtask Execution Level' : '🔷 Story / Task Plan Level');

  const dep = task.dependency;
  const depInfo = dep && dep.predecessorKey
    ? html`<div style="margin-top:4px;">🔗 ${dep.earliestStartReason || `Waits for ${dep.predecessorKey} at ${dep.triggerPercent}%`}</div>${dep.isViolated ? html`<div style="font-weight:700;">⚠ ${dep.fixSuggestion || dep.violationReason || 'Starts too early'}</div>` : ''}`
    : '';
  const rollupInfo = (isEpic && task.rollupStats)
    ? html`<div style="font-weight:600;">Rollup: ${task.childrenCount || 0} child items | Total ${task.effortHours}h</div>`
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
    <div style="font-size:10px; font-weight:700; margin-bottom:2px;">${levelTitle}</div>
    <div><strong><a href="${siteUrl}/browse/${task.key}" target="_blank" rel="noopener noreferrer" style="color: var(--cp-text-inverse); text-decoration:underline;">${task.key} ↗</a>: ${task.summary}</strong></div>
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
    if (u.displayName === task.resource) opt.selected = true;
    assSelect.appendChild(opt);
  });

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
  document.getElementById('editEstimateUnitSelect').value = 'HOURS';
  document.getElementById('editEstimateValueInput').value = task.effortHours || 0;
  document.getElementById('reconciledHoursBadge').textContent = `Total: ${task.effortHours || 0} hrs`;
  handleEstimateUnitChange();

  // Subtasks
  renderModalSubtasks(task);

  document.getElementById('taskDetailModal').style.display = 'flex';
}

function renderModalSubtasks(task) {
  const list = document.getElementById('subtasksList');
  list.innerHTML = '';
  const subs = task.subtasks || [];
  if (subs.length === 0) {
    list.innerHTML = '<div style="font-size:11px; color: var(--cp-text-subtle);">No subtasks added yet.</div>';
  } else {
    subs.forEach((s, idx) => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.fontSize = '12px';
      item.innerHTML = html`<span>• ${s.summary}</span><span style="font-weight:700;">${s.normalizedHours}h</span>`;
      list.appendChild(item);
    });
  }
}

async function handleAddSubtask() {
  const summary = document.getElementById('newSubtaskSummary').value.trim();
  const hours = parseInt(document.getElementById('newSubtaskHours').value, 10) || 8;
  if (!summary || !activeTaskId) return;

  await callResolver('addSubtaskToTask', {
    parentTaskId: activeTaskId,
    subtask: { summary, estimateValue: hours, estimateUnit: 'HOURS' },
    bufferType: document.getElementById('editBufferTypeSelect').value,
    bufferValue: parseFloat(document.getElementById('editBufferValueInput').value) || 0
  });

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
  const hours = parseInt(document.getElementById('multiResourceHours').value, 10) || 20;

  const statusEl = document.getElementById('multiResourceStatus');
  const addBtn = document.getElementById('btnAddResourceSubtaskBtn');
  if (addBtn) { addBtn.disabled = true; addBtn.textContent = 'Allocating...'; }

  try {
    const res = await callResolver('createSubtaskForResource', {
      parentTaskId: activeTaskId,
      assigneeAccountId,
      assigneeName,
      effortHours: hours
    });
    if (!res || res.success !== true) {
      // Only a confirmed create shows success; a null or failed result is an error (B-07).
      if (statusEl) {
        statusEl.textContent = (res && (res.message || res.error)) || 'Jira did not create the subtask.';
        statusEl.style.color = 'var(--cp-text-danger)';
        statusEl.style.display = 'block';
      }
    } else {
      if (statusEl) {
        statusEl.textContent = `✓ Created Jira subtask for ${assigneeName} (${hours}h)`;
        statusEl.style.color = 'var(--cp-text-success)';
        statusEl.style.display = 'block';
      }
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
    console.error('Failed to unschedule task:', err);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📤 Move to Backlog'; }
  }
}

function handleEstimateUnitChange() {
  const unit = document.getElementById('editEstimateUnitSelect').value;
  document.getElementById('rawEstimateGroup').style.display = unit === 'TSHIRT' ? 'none' : 'block';
  document.getElementById('tshirtSizeGroup').style.display = unit === 'TSHIRT' ? 'block' : 'none';
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
  if (unit === 'HOURS') {
    const val = parseFloat(document.getElementById('editEstimateValueInput').value);
    if (!isNaN(val)) effortHours = val;
  } else if (unit === 'STORY_POINTS') {
    const pts = parseFloat(document.getElementById('editEstimateValueInput').value);
    if (!isNaN(pts)) effortHours = pts * 8;
  } else if (unit === 'TSHIRT') {
    const sz = document.getElementById('editTshirtSelect').value;
    const tshirtMap = { XS: 4, S: 8, M: 16, L: 32, XL: 64 };
    effortHours = tshirtMap[sz] || 16;
  }

  // Only fields the user changed are sent (B-04, INV-03).
  const curTask = (currentPlan?.tasks || []).find(t => t.key === activeTaskId) || {};
  const updates = {};
  if (summary && summary !== curTask.summary) updates.summary = summary;
  if (resource !== (curTask.resource || 'Unassigned')) {
    updates.resource = resource;
    if (resourceAccountId) updates.resourceAccountId = resourceAccountId;
  }
  if (status !== curTask.status) updates.status = status;
  if (effortHours !== undefined && effortHours !== (curTask.effortHours || 0)) updates.effortHours = effortHours;

  // Progress and Target Progress Inputs
  const progInput = document.getElementById('editProgressInput');
  if (progInput && progInput.value !== '') {
    const prog = Math.max(0, Math.min(100, parseInt(progInput.value, 10)));
    if (!isNaN(prog) && (prog !== (curTask.progress || 0) || modalUseRollupProgressFlag)) {
      updates.progress = prog;
      updates.manualProgress = !modalUseRollupProgressFlag;
      const effectiveStatus = updates.status || curTask.status;
      if (prog === 100 && effectiveStatus !== 'COMPLETED') {
        updates.status = 'COMPLETED';
      } else if (prog > 0 && effectiveStatus === 'NOT_STARTED') {
        updates.status = 'IN_PROGRESS';
      }
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
    opt.textContent = `${ep.key}: ${ep.summary}`;
    epicSelect.appendChild(opt);
  });

  const assSelect = document.getElementById('createAssigneeSelect');
  assSelect.innerHTML = '';
  (currentPlan?.availableUsers || []).forEach(u => {
    const opt = document.createElement('option');
    opt.value = u.displayName;
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
  const epic = document.getElementById('createEpicSelect').value || 'Prerequisites';
  const resource = document.getElementById('createAssigneeSelect').value || 'Unassigned';
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
      summary, epic, resource, effortHours, startWeek, spanWeeks: 3
    });

    if (res && res.success === false) {
      if (errEl) {
        errEl.textContent = res.error || 'Failed to create task in Jira.';
        errEl.style.display = 'block';
      }
      return;
    }

    summaryInput.value = '';
    closeModal('createTaskModal');
    await loadProjectPlan();
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
    if (res && res.success === false) {
      if (errEl) {
        errEl.textContent = res.error || 'Failed to create epic in Jira.';
        errEl.style.display = 'block';
      }
      return;
    }

    summaryInput.value = '';
    closeModal('createEpicModal');
    await loadProjectPlan();
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

// Utilization & Heatmap Views
async function renderUtilizationView() {
  const cont = document.getElementById('utilizationProfilesContent');
  cont.innerHTML = '<div style="color: var(--cp-text-subtle);">Loading utilization profiles...</div>';
  const res = await callResolver('getPortfolioResourceHeatmap', {});
  if (!res || !res.rows) {
    cont.innerHTML = '<div>No resource allocation data available.</div>';
    return;
  }

  let markup = html`<div style="display:flex; flex-direction:column; gap:16px;">`;
  res.rows.forEach(r => {
    markup = html`${markup}
      <div style="background: var(--cp-surface); border: 1px solid var(--cp-border); border-radius:6px; padding:12px;">
        <div style="font-weight:700; font-size:13px; margin-bottom:4px;">👤 ${r.resourceName} <span style="font-weight:500; color: var(--cp-text-subtle);">(${r.coe} • ${r.vertical})</span></div>
        <div style="display:flex; gap:6px; overflow-x:auto; margin-top:8px;">
    `;
    res.weeks.forEach(w => {
      const pct = r.weeklyUtilization[w.weekKey] || 0;
      const bg = pct > 100 ? 'var(--cp-bg-danger)' : pct === 100 ? 'var(--cp-bg-success)' : pct > 0 ? 'var(--cp-bg-selected)' : 'var(--cp-surface-sunken)';
      const fg = pct > 100 ? 'var(--cp-text-danger)' : pct === 100 ? 'var(--cp-text-success)' : pct > 0 ? 'var(--cp-text-brand)' : 'var(--cp-text-subtle)';
      markup = html`${markup}
        <div style="background:${bg}; color:${fg}; border-radius:4px; padding:4px 8px; text-align:center; min-width:60px;">
          <div style="font-size:10px; font-weight:600;">${w.weekKey}</div>
          <div style="font-size:12px; font-weight:700;">${pct}%</div>
        </div>
      `;
    });
    markup = html`${markup}</div></div>`;
  });
  markup = html`${markup}</div>`;
  cont.innerHTML = html`${markup}`;
}

async function renderHeatmapView() {
  const cont = document.getElementById('heatmapContent');
  cont.innerHTML = '<div style="color: var(--cp-text-subtle);">Loading capacity heatmap...</div>';
  const res = await callResolver('getPortfolioResourceHeatmap', {});
  if (!res || !res.rows) {
    cont.innerHTML = '<div>No capacity data available.</div>';
    return;
  }

  let markup = html`<table class="heatmap-table"><thead><tr><th class="heatmap-th">Resource</th><th class="heatmap-th">COE</th><th class="heatmap-th">Vertical</th>`;
  res.weeks.forEach(w => {
    markup = html`${markup}<th class="heatmap-th">${w.weekKey}</th>`;
  });
  markup = html`${markup}</tr></thead><tbody>`;

  res.rows.forEach(r => {
    markup = html`${markup}<tr>
      <td class="heatmap-td" style="text-align:left; font-weight:700;">${r.resourceName}</td>
      <td class="heatmap-td" style="color: var(--cp-text-subtle);">${r.coe}</td>
      <td class="heatmap-td" style="color: var(--cp-text-subtle);">${r.vertical}</td>
    `;
    res.weeks.forEach(w => {
      const pct = r.weeklyUtilization[w.weekKey] || 0;
      const bg = pct > 100 ? 'var(--cp-bg-danger)' : pct === 100 ? 'var(--cp-bg-success)' : pct > 0 ? 'var(--cp-bg-selected)' : 'var(--cp-bg-warning)';
      const fg = pct > 100 ? 'var(--cp-text-danger)' : pct === 100 ? 'var(--cp-text-success)' : pct > 0 ? 'var(--cp-text-brand)' : 'var(--cp-text)';
      markup = html`${markup}<td class="heatmap-td" style="background:${bg}; color:${fg};">${pct}%</td>`;
    });
    markup = html`${markup}</tr>`;
  });
  markup = html`${markup}</tbody></table>`;
  cont.innerHTML = html`${markup}`;
}
