# CascadePlan User Guide

This guide shows how to plan work in CascadePlan: the timeline, dependencies, moves, the hierarchy, plans and baselines.

---

## 1. Open the planner

In the project's left navigation, select **CascadePlan Planner**. The planner shows the project's work items in a grid on the left and a timeline on the right. Work items without dates are in the **Backlog** tray; drag one onto the timeline to schedule it.

Every change you make is a Jira write made as you. If your Jira role does not allow a change (for example, you lack "Edit issues" or "Schedule issues"), CascadePlan refuses it and names the missing permission.

---

## 2. Move and resize bars

- **Drag** a bar to move it, or drag an end to change its start or end. The bar snaps to days or weeks, depending on the zoom.
- Before you drop, a line at the bottom of the screen lists every Jira change the drop will make, including the work that moves with it.
- **Keyboard:** select a row, put the focus on its Start or Due cell, press **Space**, use the arrow keys, then **Enter** to save or **Escape** to cancel.
- **Undo and Redo:** each change offers **Undo** in a message; **Ctrl+Z** and **Ctrl+Shift+Z** also work, for the last 20 changes.
- The **Changes** button lists every Jira write of this session, with the old and new value, and whether Jira accepted it.

A bar's end is the issue's Jira due date. Its start is stored on the issue as the property `cascadeplan.dates`, so every plan shows the same dates.

---

## 3. Dependencies

1. Hover a bar: link arrows appear at its ends. Drag from one bar to another to link them, or use **Add dependency** on the bar's toolbar.
2. Choose when the successor may start: when the predecessor reaches 0%, 30%, 50%, 100% or any percent of its work.

The link is a Jira "Blocks" link; the percent is stored on the successor as the issue property `cascadeplan.links`. When a move would start a successor too early, CascadePlan moves it (the cascade). With **Enforce dependencies** on, a bar cannot be dropped before the earliest day its links allow; otherwise a dialog offers the fixes. **Why this date?** on a row explains what sets its earliest start.

A parent's links also apply to its sub-tasks. A link between an issue and its own parent or sub-task is refused, because the parent's dates come from its sub-tasks.

Remove a link from its badge on the timeline: **Remove Link** deletes exactly that Jira link.

---

## 4. Parents, sub-tasks and moving a block

- A task or story with sub-tasks shows the span of its sub-tasks. Dragging it moves the whole block: sub-tasks not started move by the same days; a sub-task in progress keeps its start and moves its end (never before today); a finished sub-task stays. The parent's Jira due date follows its new end.
- **Create sub-task in Jira** in the task dialog creates a real Jira sub-task, with an estimate only if you type one.
- **Move under another work item:** drag a row onto the middle of another row (the target is outlined, and a label says what will happen), or use **Parent in Jira** in the task dialog. CascadePlan asks first, then changes the parent in Jira. Changing a task into a sub-task, or a sub-task into a task, uses a Jira bulk move job; the planner shows its progress. Jira's rules apply: for example, a task with sub-tasks cannot become a sub-task, and a sub-task cannot have children. Undo makes the reverse change.

---

## 5. Plans

The **plan selector** in the toolbar lists the Main Plan and your scenario plans. A plan approver can create a plan (empty or as a copy of the open plan), rename it and delete it. Each plan keeps its own row order, columns and milestones. Dates, links and the hierarchy are Jira's, so a change in any plan shows in every plan.

---

## 6. Baselines and scope changes

1. A plan approver opens **Baseline** in the toolbar, enters a name, for example "Sprint 7 commitment", and chooses **Freeze the plan as a baseline**. The baseline records, for each work item on the timeline, its Jira estimate, start and end.
2. The **Baseline** button then shows the change since the freeze, for example `Baseline: Sprint 7 · +12 h (+25%), 1 added, 2 later`. It is marked when the scope grew.
3. The panel lists each work item added, removed or changed (estimate, start, end).
4. Anyone in the project can write a reason and choose **Request approval of this scope**. A plan approver other than the requester chooses **Accept** or **Reject**. Accepting freezes a new baseline version from the current plan, which becomes the active one.
5. Under **Baseline versions**: **Compare with now**, **Compare with active**, **Export CSV** and, for plan approvers, **Make active**.

Each read of a baseline checks its SHA-256 digest. If a stored baseline no longer matches what was frozen, the panel says so.

---

## 7. Views

- **Table view** shows the tasks and dates as a table.
- **Utilization view** shows the work of each person per week, from the dates and the Jira estimates.
- **Ctrl+F** searches the tasks by key or summary.
