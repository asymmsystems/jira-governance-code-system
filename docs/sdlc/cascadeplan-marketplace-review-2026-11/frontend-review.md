# CascadePlan frontend review

Scope: read in full, every line:
- src/frontend/legacy-planner.js (6,478 lines), main.ts, bridge.ts, flag.ts, banner.ts, theme.ts, changes-panel.ts, canvas-timeline.ts, why-popup.ts, admin.tsx
- src/ui/*.ts (all 22 files)
- static/frontend/build/index.html (inline style and script check, modal and popover markup), head of static/frontend/build/style.css, manifest.yml permissions block
- Backend reference, read only where a UI conclusion needed it: src/index.ts (resolver table 2583-2670, scheduleBacklogTask 989-1036, createInlineTask 1085-1217, updateWbsTask conflict path, pruneStaleEntries 1837-1858, batchUpdateTasks 1860-1908, continueCascade 1909-1935, createSubtaskForResource 2036-2160, addSubtaskToTask 2163-2210, requestScopeShift and reviewScopeShift 2514-2564, licence helpers 2430-2455, writablePlanId 394-402, getProjectPlan 869-985, fetchProjectUsers 508-527, loadLive 575-605), src/validation.ts 167-187.

All paths below are relative to apps/cascadeplan/. Nothing was edited, installed, built or run.

Severity counts in this report: Critical 0, High 9, Medium 17, Low 14.

---

## Summary of the most important findings

| # | Sev | Where | One-line scenario |
|---|-----|-------|-------------------|
| H1 | High | legacy-planner.js:1835-1839, 3166-3171, 3890-3895, 4109-4114, 4163, 5582-5588; index.ts:1024, 1033-1036 | Every backlog schedule action sends spanWeeks: 3 that the user never entered; the backend writes a Jira due date of start + 20 days (INV-03). |
| H2 | High | legacy-planner.js:2899, 6289; index.ts:1186-1207 | createInlineTask (row "+" and New Task modal) sends spanWeeks: 3; the backend writes a Jira due date the user never chose (INV-03). |
| H3 | High | legacy-planner.js:5974, 5985; index.ts:2046, 2146-2151 | "Allocate resource" with an empty hours field sends effortHours: 20; the backend writes a 20h estimate to the new Jira subtask (INV-03). |
| H4 | High | legacy-planner.js:2903-2938, 6292-6328, 6386-6403; bridge.ts:26-29 | When invoke throws (timeout, network), the result is { ok: false } with no success field; create flows test only success === false, so they close the form, clear the summary and show "Task created and scheduled." next to the red error banner. |
| H5 | High | legacy-planner.js:4534-4537, 4559-4567, 4647-4654 | Mouse drag into a dependency conflict, then "Cancel" in the conflict dialog: the captured task object was already mutated to the new dates, so Cancel writes the NEW dates again and announces "Reverted". |
| H6 | High | legacy-planner.js:1672-1674; index.ts:145-150, 1837-1858 | pruneStaleEntries runs automatically on every plan load, as the current user; an issue the user cannot see (issue security) returns 404 and its plan entry (dates, links) is deleted for everyone. No confirmation, no Changes-panel record. |
| H7 | High | legacy-planner.js:5852-5861, 6062-6065, 6100-6103; index.ts:511 | Task detail modal on a task whose assignee is not in the first 50 assignable users (or is deactivated): the select falls back to "Unassigned", and Save (even with no other change) unassigns the issue in Jira. |
| H8 | High | legacy-planner.js:5383-5392, 6345, 6401; static/frontend/build/app.js | addDays, showErrorBanner and populateEpicDropdowns are not defined in the module (esbuild renamed the real ones to addDays2 / showErrorBanner2). The +/- 1 week buttons in the date popover throw ReferenceError; after a successful epic create the UI shows no success and the user may create a duplicate. |
| H9 | High | legacy-planner.js:2903-2904, 6292-6294; index.ts:1101-1179 | createInlineTask on a plan deleted in another tab: the Jira issue is created first, then writablePlanId throws validation; the UI shows the raw code "validation" and the issue exists in Jira but not on any plan (user retries and duplicates it). |
| M1 | Medium | legacy-planner.js:4882-4951, 4642-4645 | Keyboard move into a dependency conflict: the dialog opens without saving; "Keep" only closes it and announces "Kept schedule with dependency violation", but nothing was saved. Keyboard users can never save a violating move. |
| M2 | Medium | index.ts:584, 593, 845, 977; legacy-planner.js:1639, 3119-3133; first-run.ts:27 | Jira search fails (non-200): backend returns tasks [] with isLiveSynced false; the UI ignores isLiveSynced and shows "This project has no issues yet. Create an issue". |
| M3 | Medium | bridge.ts:37-42 | The MAX_CASCADE_ROUNDS = 40 cap is per recursion level; each nested callResolver starts its own counter, so the cap never bounds anything. A cascade that never empties would loop without limit (backend convergence not proven either way). |
| M4 | Medium | legacy-planner.js:5902-5912, 6159-6165 | Modal predecessor list holds only scheduled tasks; a task whose predecessor is a backlog task opens with "None", and Save silently removes the dependency. |
| M5 | Medium | index.ts:1907; legacy-planner.js:5688-5701 | Multi-select move: batchUpdateTasks overwrites cascadeRemaining with []; dependents beyond 25 per item are never moved and the user is not told. |
| M6 | Medium | legacy-planner.js:1841-1847, 3173-3179, 5589-5595 | Backlog schedule (card button, empty-state drop, wrapper drop) always shows "Scheduled X to timeline." even after a conflict, licence or validation failure. |
| M7 | Medium | legacy-planner.js:6177-6180, 2904, 6294, 6388; result.ts:24 | Raw codes "conflict", "validation", "license_required" are shown as the error text in the task modal and create flows; the useful message field is ignored. |
| M8 | Medium | legacy-planner.js:200-201, 197 | Undo replays with the CURRENT version of each task, so it silently overwrites a colleague's later edit of the same task (no conflict check). |
| M9 | Medium | legacy-planner.js:203-208; undo-stack.ts:29-33 | Undo of a cascade stops at the first failed op; the entry has already moved to the redo stack, so the target is restored and later successors stay moved, with no retry. |

The full list, by question, follows.

---

## 1. XSS (INV-01)

Result: Confirmed by reading. No Jira-sourced text reaches an HTML sink unescaped. INV-01 holds for the files in scope.

Method: every innerHTML, outerHTML, insertAdjacentHTML, document.write, on* attribute, href/src assignment, eval and new Function in src/frontend and src/ui (grep, then each hit read in context).

- outerHTML, insertAdjacentHTML, document.write, eval, new Function, setAttribute('on...'): none.
- innerHTML: 52 sites, all in legacy-planner.js. Each is either a constant string (for example 1312, 1794, 2263, 2509, 2630, 5903, 5937, 6204, 6470) or a value of the html tagged template from src/ui/safe-html.ts:42-48, which escapes & < > " ' in every interpolation unless the value is already a SafeHtml (safe-html.ts:23-37). No innerHTML is assigned from a plain template string. No attribute interpolation is unquoted (grep for `=${` found none).
- Jira text that reaches html`` and is escaped: summary (1815, 3336, 3449, 5197-5198, 5781, 5944), epic name (2637, 2765, 3471), user displayName (2271, 2533, 3576, 3602, 5773-5775, 6475), status (3526), story/issue type (1813, 3484), milestone title (1783), resource (1818, 5771), dependency reasons and fix suggestions from the server (5761).
- Jira text that goes through textContent, value, title property or setAttribute (safe sinks): table view (1040-1055), plan names (1412, 1421, 1478, 1466), option lists (1412, 5858, 5891, 5908, 6209, 6219, 5730), error messages (flag.ts:30, banner.ts:15, changes-panel.ts:17-21, legacy-planner.js:1679, 5990, 6179, 6294, 6388), why popup (why-popup.ts:71-98), bar aria-label (4186), dependency list (5084), canvas text (canvas-timeline.ts:302, fillText only).
- Plan name, baseline name, scope shift reason and comment: plan names only via textContent; baselines and scope shifts are not rendered anywhere in the frontend.
- href from data: `${siteUrl}/browse/${task.key}` at 1812, 3447, 5781 (escaped) and 5808 (property). siteUrl is currentPlan.siteUrl from the Forge context (index.ts:2416-2421), else ancestorOrigins/referrer, else a hard-coded fallback (see 13). The value always starts with the base URL, so a javascript: URL cannot be formed from an issue key. Low residual risk, Confirmed by reading.
- One CSS-context interpolation: `style="width:${task.progress}%;"` (3507). Escaping stops attribute break-out but not CSS injection; progress is a server-computed number, not Jira text. Low, Confirmed by reading.

## 2. Inline styles and 'unsafe-inline'

manifest.yml:26-29 grants `content.styles: 'unsafe-inline'`.

CSP style-src 'unsafe-inline' is needed for style attributes in markup and for <style> elements. It is not needed for CSSOM writes (element.style.x = ..., style.cssText, style.setProperty).

Count (Confirmed by reading and grep):
- static/frontend/build/index.html: 1 inline <style> block (lines 8-10, one @keyframes rule) and 120 style="..." attributes.
- legacy-planner.js: 62 style="..." attributes inside innerHTML markup (lines 1320, 1323, 1359, 1360, 1363, 1783, 1794, 1819, 2263, 2270, 2272, 2337-2341, 2495, 2509, 2521, 2533, 2607, 2630, 2764, 2770, 2774, 2775, 2784, 2787, 2788, 2795, 2796, 2801, 2804, 2807, 2811, 3126, 3335, 3345, 3440, 3448, 3481, 3484, 3487, 3490, 3494, 3495, 3505, 3507, 3515, 3524, 3576, 3602, 3604, 3694, 3704, 5761, 5764, 5780, 5781, 5937, 5944).
- CSSOM writes (do not need 'unsafe-inline'): 226 `.style.x` uses plus 1 cssText (2335) plus setProperty (1870, 1979, 2043) across legacy-planner.js, canvas-timeline.ts and why-popup.ts.

Conclusion: with the current markup 'unsafe-inline' is needed (183 markup sites). All 183 could move to classes; the 230 CSSOM writes could stay. Low.

## 3. Every invoke call

All planner calls go through bridge.ts:22-44 (callResolver). legacy-planner.js wraps it (151-165): it adds planId: activePlanId unless the payload has one, and for UNDOABLE resolvers (updateWbsTask, unscheduleTask, scheduleBacklogTask, batchUpdateTasks) records undo and shows an error Flag on failure.

Shared handling (bridge.ts:30-35, result.ts:19-36): for every resolver whose name does not start with "get", a failed result (null, ok false, success false, or jiraSync.ok false) shows the error banner with message, else error (except 'validation'), else "The change failed."; jiraSync.writes go to the Changes panel. A thrown invoke becomes { ok: false, error: message } (bridge.ts:26-29).

| Resolver | Call sites (legacy-planner.js) | Payload | Result handling |
|---|---|---|---|
| getProjectPlan | 1636 | { planId } | tasks array: render; else "Unable to synchronize with Jira..." (1676-1680). No banner (name starts with get). |
| pruneStaleEntries | 1673 | { planId, keys: staleEntries.slice(0,200) } | Not awaited; result ignored; banner only if it fails. See 4. |
| updateWbsTask | 252, 690, 706, 721, 763, 778, 800, 2317, 2568, 2616, 2646, 3639, 3688, 4543, 4624, 4869, 5134, 5289, 5313, 6176; undo 197, 201 | { taskId, updates, expectedVersion? } | Banner + error Flag on failure, then reload. expectedVersion is MISSING at 690, 706, 721, 763, 778, 800, 2317, 2568, 2616, 2646, 3639, 3688, 197, so those are last-writer-wins (Medium, Confirmed by reading; server only checks when expectedVersion is given, index.ts:1529, 1547). |
| scheduleBacklogTask | 1835, 3166, 3890, 4109, 4163, 5582; undo 195 | { taskId, startWeek: '' or current week, startDate: today or drop day, spanWeeks: 3, targetIndex } | See H1, M6. |
| unscheduleTask | 472 (dead), 3376, 3816 (dead), 6020; undo 193 | { taskId } | Banner + Flag, reload. |
| batchUpdateTasks | 5690 | { items: [{ taskId, updates, expectedVersion }] } | ok false if any item conflicted, and result.ts then shows only "The change failed." though other items were saved; per-item results are never shown; the partial success gets no undo (158). Medium, Confirmed by reading (index.ts:1892, 1907). |
| createInlineTask | 2889, 6279 | see 9 | Only success === false is treated as failure. See H2, H4, H9, M7. |
| createJiraEpic | 6385 | { summary } | Only success === false; then calls undefined populateEpicDropdowns (H8). |
| addSubtaskToTask | 5955 | { parentTaskId, subtask: { summary, estimateValue: hours or 8, estimateUnit: 'HOURS' }, bufferType, bufferValue } | Result not inspected at all; reload follows. Banner only. |
| createSubtaskForResource | 5981 | { parentTaskId, assigneeAccountId, assigneeName, effortHours: hours or 20 } | Correct: anything but success === true shows message or error in the form (5987-5993). |
| createProjectPlan | 1503, 5538 | { name, cloneFromPlanId } | ok and plan: switch; else Flag with message. |
| renameProjectPlan | 1542 | { planId, name } | ok: reload; else Flag. No client validation (validateNewPlanName is used only for create). |
| deleteProjectPlan | 1571 | { planId } | ok: Flag, switch to Main if it was active; else Flag. |
| reorderWbsTasks | 3887 (dead), 4081, 4106 (dead), 4161 (dead) | { taskId, targetIndex } | Banner only, reload. |
| saveColumnWidths | 1267, 2101 | { columnWidths } | Banner only. |
| saveHiddenColumns | 1276 | { hiddenColumns } | Banner only. |
| continueCascade | bridge.ts:41 | { taskId, planId } (from first payload) | Loop until cascadeRemaining is empty. See M3. |
| approver-policy-get-api | admin.tsx:32 | {} | Load failure: console only, response null. |
| approver-group-search-api | admin.tsx:59 | { query } | Notice on failure. |
| approver-policy-set-api | admin.tsx:74 | { groupIds } | Notice on failure. |

Never called from any frontend file: checkPlanApprover, authority-check, requestScopeShift, reviewScopeShift, freezePlanBaseline, getPlanBaselines, getScopeCreepReport, previewCascade, saveTaskDependency, saveProjectMilestone, getResourceUtilizationGrid, getProjectPlans, authority-policy-get/set, authority-group-search.

Specific answers:
- jiraSync.writes failures: shown. Banner "Saved in CascadePlan, but Jira rejected part of it: ..." (result.ts:27-33) and Changes panel rows "Not written: ..." (change-log.ts:32, changes-panel.ts:41). Confirmed by reading.
- conflict: index.ts:451-456 returns ok false, success false, error 'conflict', message "Someone else changed X...". The banner and Flag show the message. The task modal shows the raw word "conflict" (6177-6180). M7.
- error 'validation': banner shows message (result.ts:24). Create flows show the raw "validation" (2904, 6294, 6388). M7.
- error 'license_required': on writes the banner shows "Licence required" (index.ts:2436-2443). Create flows show raw "license_required". On load, getProjectPlan returns ok false and the UI says "Unable to synchronize with Jira..." which hides the real cause (1676-1680). Medium, Confirmed by reading.
- thrown exceptions: bridge converts to { ok: false, error }. Create flows miss it (H4). The try/catch blocks around callResolver at 1834-1850, 2888-2945, 4542-4555, 6019-6027, 6175-6193, 6278-6340, 6384-6415 are dead code because callResolver never throws. Low.
- Write paths whose failure the user never sees, or sees contradicted: H4, M6 (success Flag after failure); pruneStaleEntries success deletes are never shown (H6); batch partial failures not itemised; the populateEpicDropdowns crash hides a successful epic create (H8); M1 (keyboard Keep claims a save that never happened); H5 (Cancel claims a revert that never happened).

## 4. pruneStaleEntries

Automatic, not user-confirmed. Confirmed by reading.

legacy-planner.js:1671-1674:
```
    // Entries Jira did not return: the resolver deletes those Jira confirms are gone (B-18).
    if (Array.isArray(plan.staleEntries) && plan.staleEntries.length) {
      rawCallResolver('pruneStaleEntries', { planId: activePlanId, keys: plan.staleEntries.slice(0, 200) });
    }
```
It runs after every successful getProjectPlan (every open, refresh, plan switch and every write that reloads). It is not awaited. It bypasses the undo wrapper. The backend (index.ts:1837-1858) deletes each KVS entry whose GET /issue/{key} returns 404. staleEntries is empty when the search was not live or was truncated (index.ts:910), which is good.

Problem (H6, High, Confirmed by reading; the 404 for a hidden issue is standard Jira behaviour): getJiraCaller uses api.asUser() (index.ts:145-150). A user who cannot see an issue (issue security level, restricted project role) gets it missing from the live search, so it is listed as stale, and GET returns 404 for that user, so the entry is deleted for everyone. Dates, dependency and contributors in KVS are lost. No confirmation, no Changes-panel row (jiraSync is noJiraWrites), no undo. This also breaks "opening causes no write" (see 10).

## 5. Plan state and localStorage

- Key: `cp_active_plan_` + `<cloudId>:<projectKey>` (plan-view-state.ts:21-26, bridge.ts:52-61). Matches the expected form. When view.getContext fails, the scope falls back to the project key alone (legacy-planner.js:1641-1642), which is a different key, so a plan saved under the normal key is not reopened in that session. Low.
- try/catch: every localStorage access is wrapped: 134, 302, 305, 1271-1275, 1663-1666, 4353-4355, 5330, 5332, 5451, 5453, plan-view-state.ts:31-35, 41-45. Confirmed by reading.
- Other keys are not site-scoped: `cascadeplan_hidden_cols_<projectKey>` (1273, 1664), `cascadeplan_zoom` (299), `cascadeplan_enforce_deps` (4354), `cascadeplan_shortcuts` (4666), `cascadeplan_hint_link` (1727). The Custom UI origin is shared by all sites that install the app, so a user of two sites with project key ABC shares these. Low. The hidden-columns cache is effectively dead because the server always returns an array (index.ts:896 `settings.hiddenColumns || []`, read at 1660).
- Stored plan id no longer exists: the server reads the Main Plan and returns planId 'default' (index.ts:881-883). The UI shows the Flag "The plan you had open no longer exists. Showing the Main Plan." and saves Main (1649-1658). Confirmed by reading.
- Stored plan id malformed (not matching `^[A-Za-z0-9_-]{1,64}$`): validatePlanId throws before the fallback (index.ts:879, validation.ts:167-171). The load fails with the generic "Unable to synchronize" and the bad id is never cleared, so every reload fails until storage is cleared. Low (needs corrupted storage).
- One tab deletes a plan another tab has open: there is no `storage` event listener. The other tab keeps planId X. Its next write fails server-side in writablePlanId with validation "This plan no longer exists. Reload..." (index.ts:394-401), shown in the banner; most handlers then reload, and the reload falls back to Main with the Flag above. No write goes to the wrong plan. Exception: createInlineTask creates the Jira issue before the plan check (H9). Confirmed by reading.

## 6. Undo and redo

How it works: legacy-planner.js:123-230. A snapshot of the plan before the first undoable write is kept in pendingUndo (154). When the next plan is shown (settleUndo at 1670 and 3286/3302), a diff becomes an entry with restore and reapply ops (undo-plan.ts:87-111), pushed to a 20-entry stack (125). Undo replays ops with rawCallResolver into the active plan (184-218).

- Plan switch: setActivePlan clears the stack and pendingUndo when the id changes (141-149). Replay uses the plan active at replay start (188). Undo cannot write to a different plan in the same tab. Confirmed by reading.
- Wrong action, same plan (Medium, Confirmed by reading): the Flag "Undo" button calls the global undoLast (176), not its own entry. Flags stay at least 10 s and while hovered (flag.ts:52-64). Do action A (Flag A shown), then action B, then click Undo on Flag A: B is undone, not A.
- After a conflict: a failed write clears pendingUndo (157-160), so no entry. Correct. But see M8: undo always sends the current version (201), so undo overwrites a colleague's later change without a conflict.
- Merged entries (Medium, Confirmed by reading): `if (!pendingUndo)` (154) reuses an existing done-but-unsettled snapshot. Paths that show a result without settleUndo (1842-1843, 3174-3175, 5590-5591) leave pendingUndo done; the next write then shares the old "before" snapshot, fn and label, and one Undo reverts both actions.
- Cascade: the entry is built from the final plan after all continueCascade rounds (bridge returns the last result), so it includes all moved dependents. Restore ops put the target first (undo-plan.ts:93). If any op fails, replay stops (203-208); the entry has already moved to the redo stack (undo-stack.ts:29-33); the target is restored, later successors stay moved, and Undo cannot be retried (M9).
- Possible miss (Uncertain): a changed task that is also the parentKey of another changed task is treated as roll-up only and gets no date restore (undo-plan.ts:89, 103, 68). If a cascaded successor is also a Jira parent of another moved task and its dates are its own (not datesFromChildren), undo leaves it moved. Depends on whether such a parent's dates are always roll-ups; not proven.
- Redo/undo of a schedule op calls scheduleBacklogTask with spanWeeks || 1 (195), which writes a Jira due date of start + 6 days, then updateWbsTask writes the real dates (197) without expectedVersion. Two Jira due-date writes; the first is a default value. Low.
- replayingUndo is global (127): any write the user makes while a multi-op undo is still running is not recorded for undo. Low.

## 7. Collapse and expand (D5)

- Kept across re-renders: yes, module-level Set collapsedTasks (328), read in computeRowTasks (3093). Confirmed by reading.
- Across plan switches: only partly. renderPlan deletes collapsed keys that are not in the new plan's tasks (1700-1703). Collapse P in plan A, switch to plan B where P is not scheduled, switch back: P is expanded. Low, Confirmed by reading. Not kept across a page reload (no storage). Low.
- Hides all descendants: yes. isHiddenByCollapse walks every ancestor in the view (plan-view-state.ts:102-113, called from visibleRows 118-125). Confirmed by reading.
- Toggle only for rows with child rows in the view: yes. rowParentKeys = parentKeysOf(tasksToRender) (3091), used at 3413 and 4733. The childrenCount-based hasChildRows (plan-view-state.ts:82-85) is not used by the planner, so a row with only unscheduled Jira children gets no toggle. Confirmed by reading.
- Focus stays on the rebuilt toggle (3843-3845). The treegrid sets aria-expanded (4733) but has no keyboard expand or collapse (ArrowRight/Left move between cells, keyboard-grid.ts:24-25). See 11.

## 8. Scope-shift approval UI

There is none. Confirmed by reading.
- No frontend file calls checkPlanApprover, authority-check, requestScopeShift or reviewScopeShift (grep of src/frontend, src/ui and index.html). No approval button exists, so none is shown to everyone.
- The admin page (admin.tsx) only edits the approver group list; it says approvers "freeze delivery baseline, approve milestone variance, and manage plans" (admin.tsx:53, 94).
- Cross-reference, backend, Confirmed by reading: reviewScopeShift (index.ts:2541-2564) and freezePlanBaseline (index.ts:2455-2470) check no approver; createProjectPlan, deleteProjectPlan, renameProjectPlan (index.ts:2340-2400) check no approver; the planner shows rename and delete to every user (legacy-planner.js:1519-1593). Any user can call reviewScopeShift through invoke. High for the backend review (not a frontend defect; listed so it is not lost).

## 9. Create and schedule payloads (INV-03)

| Call | Value the user did not enter | Goes to Jira? | Evidence |
|---|---|---|---|
| scheduleBacklogTask | spanWeeks: 3; startDate: today (card "+ Schedule" 1838, empty-state drop 3169) or startWeek: current week (row drop 3889-3893, drop rows 4108-4112) | Yes: due date = start + 20 days (index.ts:1024, 1033-1036) | H1, Confirmed |
| createInlineTask (inline row) | spanWeeks: 3 (2899); startWeek: anchor's startWeek or current week (2751, 2898); resource: 'Unassigned' (2822) | Yes: due date from week span (index.ts:1186-1207). resource is ignored (index.ts:1198) | H2, Confirmed |
| createInlineTask (modal) | spanWeeks: 3 (6289); startWeek: current week preselected (6230) | Yes, as above | H2, Confirmed |
| createSubtaskForResource | effortHours: 20 when the hours field is empty (5974); spanWeeks not sent, server default 2 (index.ts:2048) | Yes: estimate 20h and due date (index.ts:2146-2151) | H3, Confirmed |
| addSubtaskToTask | estimateValue: 8 when empty (5952) | No, KVS only (index.ts:2185-2209) | Low |
| createJiraEpic | none, summary only | n/a | OK |
| Task modal save | progress 100 forces status COMPLETED; progress > 0 on NOT_STARTED forces IN_PROGRESS (6134-6139) | Yes, a status the user did not pick | Medium, Confirmed |
| Task modal save | assignee falls back to Unassigned when the current assignee is not in the list | Yes, unassigns | H7, Confirmed |
| Task modal save | trigger 30 when the field is empty and a predecessor is chosen (5913, 6070) | No, plan only | Low |
| Bar resize | effortHours rescaled only when the user ticks the box (4527-4532) | Yes, but opt-in | OK |

Number parsing: inline hours use parseInt, so "1.5" becomes 1 (2885, 3685, 6254); the modal uses Math.round, so 1.5 becomes 2 (6079). Both write to Jira. Low/Medium, Confirmed by reading.

## 10. Drag, resize, link and passive actions

- Bar drag and resize (4365-4575): mousemove only computes a preview (previewMoves, client side) and skips work while the snapped shift is unchanged (4385). One updateWbsTask on mouseup (4543), plus continueCascade rounds from the bridge. No resolver call per mouse move. Confirmed by reading.
- Link drag (4282-4345): no call during the drag; the popover saves once (5289).
- Row reorder (3913-4088): one reorderWbsTasks on mouseup.
- Column resize (2066-2108): one saveColumnWidths per mouseup.
- Hover: draws only (4240-4250, 367-381). Scroll: closes popovers, redraws (893-895, 5620-5625, 363). No writes. Confirmed by reading.
- Opening: yes, a write. pruneStaleEntries deletes KVS entries on load with no user action (1672-1674; H6). This conflicts with D8 and "open causes no write". Cross-reference (Uncertain, backend): getProjectPlan calls migrateIfNeeded for the Main Plan (index.ts:885), which may write KVS on first open.
- Keyboard move mode commits once on Enter (4948).

## 11. Keyboard and accessibility

Good, Confirmed by reading: treegrid in the canvas fallback (4678-4749) with role=treegrid, aria-rowcount, aria-rowindex, aria-level, aria-colindex, aria-multiselectable, aria-selected, roving tabindex, drawFocusIfNeeded (canvas-timeline.ts:372-375); keyboard move mode with live announcements (keyboard-grid.ts:59-78, 4876-4951); single-pointer toolbar for drag actions (4954-4969); dependency popup listbox with aria-activedescendant (5073-5090); shortcuts can be turned off (4668-4671, WCAG 2.1.4); non-modal Flags that persist while hovered or focused.

Gaps:
- Modals (index.html:414, 615, 656) have no role="dialog", no aria-modal, no aria-labelledby; opening does not move focus into them (openTaskDetailModal 5799-5930 focuses nothing); there is no focus trap and no focus return on close (6418-6427). WCAG 2.4.3, 4.1.2. Medium, Confirmed by reading.
- Treegrid rows expose aria-expanded but the grid has no key to expand or collapse (ARIA treegrid pattern). Medium.
- Keyboard can move a bar and change the due date ([ and ]) but cannot change the start alone; it must go through Enter (modal) or the date popover. The bar toolbar opens only on a pointer click (4251-4266). Low.
- Keyboard cannot save a move that violates a dependency (M1).
- Target sizes below 24 x 24 CSS px (style.css): .tree-toggle-btn 18 x 18 (599-601), .row-insert-plus-btn 18 x 18 (1162-1163), .row-action-btn 22 x 22 (1061-1063), .btn-xs height 22 (126), .bar-link-port 20 x 20 (1547-1552). WCAG 2.5.8 may still pass through the spacing exception; not measured. Medium, Uncertain.
- Mouse-only edit affordances: summary span (3618-3660), effort cell (3663-3709), progress and target cells (3712-3727), status and epic chips (3730-3745), epic picker options are divs (2605, 2635). The modal (Enter on the grid) is the keyboard alternative. Low.
- Resource picker checkboxes have no associated label (2493, 2531). Low.
- plannerErrorBanner (index.html:141) has no role="alert"; screen readers are not told the load failed. Low.
- Icon-only plan buttons (1494-1567) rely on title only. Low.
- Delete confirmation reverts after 4 s (1585-1589). Low.
- 8 :focus rules in style.css and 10 `outline: none` declarations; not checked rule by rule whether each has a replacement focus style. Uncertain.

## 12. Error messages and empty states

- Jira unreachable, resolver throws: "Unable to synchronize with Jira. Please verify your connection or click Retry." with Retry (1676-1680). OK.
- Jira search fails (non-200) but the resolver succeeds: empty plan, "This project has no issues yet. Create an issue to start the plan." (M2). Misleading.
- Licence inactive: on load the same "Unable to synchronize" text (wrong cause); on writes the banner says "Licence required"; on create flows the raw code "license_required". Medium.
- Empty plan with backlog: "Nothing is scheduled yet" and "Schedule your first issues" (first-run.ts:20-25, 3121-3141). OK. Backlog empty: "No unmapped backlog issues. Drag from timeline to unmap." (1794), which promises a feature that does not work (see 15).
- Conflict: banner and Flag "Someone else changed X a moment ago. Reload..." then auto reload. The task modal shows only "conflict". M7.
- Truncated plan: "Showing the newest N of about M issues" (1762-1768). OK.

## 13. Egress

- No fetch, XMLHttpRequest, WebSocket, EventSource or sendBeacon in src/frontend or src/ui. index.html loads only ./style.css and ./app.js; style.css has no url() or @import. Avatars are not loaded (initials only). Confirmed by reading.
- One external URL: legacy-planner.js:99 returns 'https://asymmsystems.atlassian.net' when the plan has no siteUrl and the referrer and ancestorOrigins are not *.atlassian.net. It is used in href values (1812, 3447, 5781, 5808) and in window.open (116-120) when router.open throws. A customer's middle-click or Ctrl-click would open the vendor's own Jira site. Medium, Confirmed by reading. Also the issue key is not URL-encoded at 117 (bridge.ts:67 does encode). Low.
- getJiraBaseUrl reads window.location.ancestorOrigins and document.referrer (89-97). Not egress, noted.

## 14. Copyright header and dashes

- Copyright "Copyright (c) 2026 Asymm Systems" and "@author Fahim Farook": present in all 32 files in scope (10 in src/frontend, 22 in src/ui); admin.tsx has them in a /** block (admin.tsx:1-3). Absent in static/frontend/build/index.html and style.css. Confirmed by grep.
- U+2013 and U+2014: zero hits in src/frontend/*, src/ui/*, static/frontend/build/index.html and style.css (grep -nP '[\x{2013}\x{2014}]'). Confirmed.

## 15. Dead code, duplication, any, size

Undefined references (H8, Confirmed by reading and by the bundle): addDays (5383, 5384, 5391, 5392), showErrorBanner (6345, not imported; only initErrorBanner is, line 18), populateEpicDropdowns (6401, defined nowhere). In static/frontend/build/app.js the real functions are renamed addDays2 and showErrorBanner2, so the bare names are globals that do not exist.

Dead code (Confirmed by reading):
- `fromTimeline` (471) and `fromReorder` (3886, 4105, 4160, 5576): no dragstart sets them (the only setData is 1854). The backlog-tray "drop to unschedule" and the HTML5 reorder branches never run.
- Handlers for elements never rendered: .quick-progress-btn, .quick-subtask-btn, .quick-resource-btn, .unschedule-row-btn, .open-jira-row-btn (3762-3831).
- updateDynamicParentRollups (2959-3001) never called. No-op functions: syncGanttScrollWidth (885-887, called 7 times), maybeExtendRange (2001-2004), decideCompactColumns (1932-1935). isSyncingGanttScroll (883) unused; compactDecided write-only.
- Unused imports: ZOOMS, shouldAutoCompact, initialRange, edgeToExtend (49).
- Unused exports (outside tests): hasChildRows, canDeletePlan, formatPlanOptionText, resolveNextActivePlanAfterDelete, findNewContributors, findRemovedContributorsWithSubtask, formatSubtaskSummary, frozenColumnsWidth, hideErrorBanner, FLAG_MS. Some may be used by tests; not checked.
- try/catch around callResolver that can never throw (see 3).

Duplication: four copies of the schedule-from-backlog drop handler (1830-1851, 3156-3184, 3871-3901, 5569-5600) and two more in setupDropTargetRow and setupTrackDrop; near-identical progress and target pickers (665-806, 2670-2741); the "is focus in a text field" test three times (539-542, 4758, 5630); popover positioning logic about ten times.

any: no `any` in .js (untyped JS). In TS: bridge.ts 22, 23, 26, 54; canvas-timeline.ts 38, 161, 164, 232, 237, 291; changes-panel.ts 47; why-popup.ts 65; admin.tsx 21, 32, 59, 74; result.ts 19; dependency-edit.ts 130; keyboard-grid.ts 44, 50; undo-plan.ts 49, 58, 114. Low.

Size and structure: legacy-planner.js is 6,478 lines of untyped JavaScript with about 60 module-level mutable variables, global callbacks on window (__onResourceSelectedForDraft 2859, __onEpicSelectedForDraft 2846), and an exported function (isEnforceDepsEnabled 4350) from a side-effect module. The well-tested pure modules in src/ui are good, but most behaviour, including all the bugs above, sits in the untyped file that type checking cannot reach. Medium.

## 16. Other bugs, with scenarios

1. (M3) bridge.ts:37-42. Each continueCascade call is itself callResolver with its own `rounds = 0`, so recursion goes as deep as the cascade needs and the 40 cap never applies. If continueCascade ever keeps returning keys (for example an entry that conflicts on every round, index.ts:1929), the client calls without end. Cap ineffective: Confirmed by reading. Non-convergence: Uncertain.
2. (H5) Mouse drag conflict, Cancel writes the new dates. Scenario: B depends on A at 100%; drag B before A's end with Enforce off; dialog "Cancel": B stays at the new dates; screen reader hears "Reverted B to original schedule." Confirmed.
3. (M1) Keyboard move conflict, Keep saves nothing (see 6, 11).
4. The conflict dialog after a mouse drag opens even when the write failed (4557 is not gated on the result). Low.
5. (M4) Modal save drops a dependency on a backlog predecessor.
6. (H7) Modal save unassigns a user beyond the first 50 assignable users. Also people are matched by displayName (2232, 2302, 2305, 5859), so two users with the same name get mixed up. Medium.
7. syncTaskResources mutates the task in memory before the call (2307-2309) and never rolls back on failure; the row shows an assignment that Jira rejected until the next reload. Low.
8. Plan rename: Enter calls finish(true) with no guard, and blur also calls finish(true) (1555-1559). Clicking away while the first call is in flight sends a second rename. If the browser fires blur when the focused input is removed, Escape (finish(false) replaces the input) would also save. Low, Uncertain (browser dependent).
9. JSON.parse of dataTransfer text without try/catch (4104, 4159): dropping external text throws an unhandled rejection. Low.
10. openInlineCreationRow reads currentPlan.weeks.find without a guard (2751); a plan without weeks throws. Low.
11. moveKey '[' can make the due date earlier than the start (keyboard-grid.ts:65); previewMoves clamps end to start (timeline-geometry.ts:81), so the result is a 1-day bar the user did not ask for. Low.
12. plan-manager.ts:20-27 calls any plan whose name contains "main", "actual" or "baseline" a Baseline (for example "Domain rework" contains "main"). The badge and the tab counts are wrong. Low.
13. Batch progress via digits (5743-5749) announces "Saved progress on N issues" even when the batch failed. Low.
14. Licence failure on load is reported as a connection problem (see 3, 12). Medium.
