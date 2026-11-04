# Atlassian Marketplace Reviewer Notes: CascadePlan

## App Overview
- **App Name:** CascadePlan
- **App ID:** `ari:cloud:ecosystem::app/cac8499e-e92e-4ba6-95cc-af398b1be791`
- **Publisher:** Asymm Systems (`https://asymm.systems`)
- **Support Contact:** `support@asymm.systems`
- **Documentation:** `https://docs.asymm.systems/apps/cascadeplan/`

---

## 1. OAuth Scopes Justification

Every scope declared in `manifest.yml` directly maps to user-facing capabilities:

| Scope | User-Facing Capability | Justification |
|---|---|---|
| `read:jira-work` | WBS Ingestion, Timeline Scheduling, & Baseline Freezing | Required to read project issues, epics, estimates, and assignees to construct the visual Work Breakdown Structure and freeze commitment baselines. |
| `write:jira-work` | Two-Way Schedule & Estimate Synchronization | Required to write scheduled dates and estimates back to Jira issues when the user explicitly schedules work on the planner. |
| `read:jira-user` | Resource Assignment & Approver Governance | Required to search assignees for resource allocation tracking and search Jira user groups for baseline shift approval authorities. |
| `storage:app` | Baselines, Shift Approvals, & WBS Hierarchy Persistence | Required to persist frozen sprint commitment snapshots, formal shift approval requests, and WBS custom schedules in Forge KVS. |

---

## 2. Architecture & Data Residency Statement

- **Zero External Egress:** CascadePlan declares zero external network endpoints. It makes no outbound network calls.
- **Tenant Storage:** All baselines, task snapshots, shift approval records, and WBS custom schedules reside strictly in customer Atlassian Forge KVS (`storage:app`).
- **Data Residency:** All data remains strictly within the customer's Atlassian Cloud data region.

---

## 3. Test Credentials & Reviewer Environment Guidance

> **Publisher Note for Submission:** Ensure the review instance (`asymmsystems.atlassian.net`) has project `DEMO` populated with sample tasks and milestones.

### Sample Test Project
- **Project Key:** `DEMO` or `TEST`
- **Planner Page URL:** Accessible from the left project sidebar under **CascadePlan Planner**.

---

## 4. Reviewer Test Plan Steps

### Test Step 1: Visual WBS Planner Navigation
1. Navigate to project `DEMO` and click the planner page in the left project sidebar.
2. Observe the interactive WBS hierarchy (Epic -> Story -> Subtask) and timeline canvas.
3. Verify that task duration bars, rolling sprint columns, and dependency links render smoothly.

### Test Step 2: Sprint Baseline Freezing
1. In the planner toolbar, click **Freeze Baseline**.
2. Enter a baseline name (e.g. `Sprint 1 Commitment`) and confirm.
3. Observe that CascadePlan records an immutable snapshot of all committed tasks and total hours.

### Test Step 3: Scope Creep Detection
1. Create a new task or edit an existing task's estimate on the schedule.
2. Open the **Scope Creep** indicator in the toolbar.
3. Observe that the app displays the commitment delta, highlights added tasks, and calculates the scope variance percentage.

### Test Step 4: Formal Shift Approval Workflow
1. In the scope creep view, click **Request Scope Shift**.
2. Enter a justification reason and submit.
3. As an authorized approver, review and approve the shift request to update the baseline.

### Test Step 5: Resource Utilization Grid
1. Switch to the **Resource Allocation** view.
2. Observe the weekly workload distribution across team members, with clear indicators for balanced allocations and over-allocated capacity bottlenecks.

---

## 5. Known Review Risks & Technical Mitigations

1. **Manifest Key Naming:** The project page module key in `manifest.yml` is `cascadeplan-project-planner`, matching the commercial brand **CascadePlan**.
2. **Native Jira Synchronization:** CascadePlan only writes to Jira when an unestimated or rescheduled task is updated by the user, preserving Jira data integrity.
