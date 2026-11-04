# PlanShift User Guide

This guide explains how engineering leads, scrum masters, and developers use PlanShift for hierarchical project scheduling, sprint baseline freezing, scope change approvals, and capacity management.

---

## 1. Accessing the Project Planner

In Jira's left-hand project navigation menu, select **PlanShift Planner** (or **CascadePlan Planner**).

![PlanShift WBS Tree and Hierarchy](/assets/planshift/01-wbs-tree.png)

The planner interface displays:
- **Hierarchical WBS View:** Interactive breakdown of Epics, Stories, and Subtasks.
- **Schedule Timeline:** Gantt-style timeline showing task start and end dates.
- **Baseline Status Bar:** Displays whether the current sprint baseline is **DRAFT**, **FROZEN**, or **SHIFT_REQUESTED**.
- **Scope Delta Metric:** Live counter showing net scope change since baseline freeze.

---

## 2. Freezing a Sprint Baseline

Once sprint planning or milestone scoping is finalized:

1. Click the **Freeze Baseline** button in the planner toolbar.
2. In the confirmation dialog, review:
   - Total committed issues count.
   - Total committed hours or story points.
   - Baseline name (e.g., `Sprint 24 - Initial Commitment`).
3. Click **Confirm & Freeze**.

![Baseline Settings and Freeze Confirmation](/assets/planshift/04-baseline-settings.png)

PlanShift takes an immutable snapshot of all ticket estimates, assignees, and dependencies at this exact moment.

---

## 3. Detecting Scope Creep & Viewing Alerts

Once a baseline is frozen, PlanShift monitors all changes in the active sprint:

![Scope Creep Alert and Commitment Delta](/assets/planshift/03-scope-creep-alert.png)

- **Added Task Warning:** Any ticket added to the sprint after freeze displays an **[ADDED]** tag with the injected hours.
- **Estimate Increase Alert:** Tickets where original estimates increased display a **[RE-ESTIMATED]** badge showing the delta (e.g., `+12h`).
- **Commitment Delta Summary:** The header prominently displays total variance:
  ```
  Baseline: 160h  |  Current: 188h  |  Scope Creep: +28h (+17.5%)
  ```

---

## 4. Submitting a Scope Shift Request

When critical new requirements or architectural discoveries require adding scope mid-sprint:

1. Click **Request Scope Shift** in the planner header.
2. The modal pre-populates all detected delta items (added issues, increased estimates).
3. Select which issues are included in the request.
4. Provide a formal **Business Justification** explaining why this scope addition is necessary and how schedule trade-offs will be handled.
5. Click **Submit Request**.

The sprint enters a **SHIFT_REQUESTED** state, notifying designated baseline authorities.

---

## 5. Reviewing & Approving Scope Shifts

Designated Baseline Authorities review submitted shift requests:

![Scope Shift Approval Modal](/assets/planshift/05-shift-approval.png)

1. Open the pending Scope Shift notification in the planner.
2. Inspect the proposed delta hours, impacted assignees, and justification notes.
3. Choose an action:
   - **Approve Shift:** PlanShift generates a new baseline version (`v1.1`), incorporating the approved tasks into the authorized commitment and resetting the scope creep delta.
   - **Reject Shift:** The shift is denied. Team members must remove the unauthorized tasks from the active sprint to clear the alert.

---

## 6. Resource Allocation Utilization Grid *(New)*

Click the **Resource Grid** toggle on the planner toolbar to inspect team workload:

![Resource Allocation Grid](/assets/planshift/02-resource-heatmap.png)

- **Weekly Columns:** Work is distributed across calendar weeks based on issue start dates, due dates, and remaining estimates.
- **Over-Capacity Highlighting:** Cells exceeding 40 hours per week turn amber or red, highlighting overallocation before burnout occurs.
- **Under-Allocated Capacity:** Identify team members with available bandwidth to balance sprint workloads effectively.
