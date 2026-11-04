# CascadePlan Admin Guide

This guide describes how Jira administrators and project leads configure baseline governance policies, define shift approval authorities, and set resource utilization thresholds in CascadePlan.

![CascadePlan Baseline Settings](/assets/cascadeplan/04-baseline-settings.png)

---

## 1. Configuring Baseline Shift Authorities

CascadePlan adheres to the [Uniform Permission Management Standard](/permissions-standard) to ensure role-based separation of duties:

| Role | Permitted Actions | Configuration Location |
| :--- | :--- | :--- |
| **Viewer** | View WBS hierarchy, inspect frozen baselines, check resource grid. | Jira **Browse Projects** permission. |
| **Contributor** | Reorder WBS tasks during draft planning, submit Scope Shift requests. | Jira **Edit Issues** or **Schedule Issues** permission. |
| **Baseline Authority** | Freeze initial sprint baselines, approve or reject Scope Shift requests. | Configured in **Project Settings > CascadePlan Baseline Settings**. |
| **Project Admin** | Configure baseline policies, change capacity hours, manage authorities. | Jira **Administer Projects** permission. |

### Assigning Baseline Authorities
1. Navigate to **Project Settings > CascadePlan > Baseline Settings**.
2. Under **Baseline Shift Approvers**, designate authorized Atlassian groups or project roles (for example: `Engineering Leads`, `Release Managers`, or `Scrum Masters`).
3. Only members of designated groups can freeze baselines or review submitted shift requests.

---

## 2. Baseline Freeze Policies

CascadePlan supports two operational governance models:

### 1. Alert-Only Governance (Recommended for Agile Teams)
- Team members can add tasks or adjust estimates mid-sprint.
- Any change relative to the frozen baseline triggers visible scope creep warnings and delta metrics on the planner and sprint reports.
- Ideal for teams transitioning from unmanaged Jira backlogs to disciplined sprint baselines.

### 2. Strict Shift-Approval Governance (Recommended for Regulated & Agency Teams)
- When a baseline is frozen, mid-sprint scope changes require a submitted and approved **Scope Shift Request**.
- The CascadePlan workflow validator can be placed on sprint transition workflows to block sprint completion until all unapproved scope variances are resolved.

---

## 3. Resource Allocation Grid Configuration

Under **Project Settings > CascadePlan > Resource Settings**, administrators can customize capacity modeling:

- **Standard Weekly Capacity:** Default is `40 hours` per contributor per week.
- **Over-Allocation Threshold:** Percentage threshold at which the utilization grid flags overallocation (default: `100%` / 40 hours).
- **Working Days:** Select active working days for scheduling calculations (Monday through Friday by default).
- **Default Issue Estimation:** Choose whether to base capacity metrics on Jira's **Original Estimate** field (hours) or converted **Story Points**.

---

## 4. Storage and Data Retention

All baselines, frozen snapshots, and shift request audit records are stored in Atlassian Forge Key-Value Storage (KVS) within your Jira Cloud site:
- Baselines are retained permanently for project retrospectives and compliance audits.
- Baseline records can be exported as structured JSON at any time from the administration console.
