# FourRealities

**FourRealities** is a delivery integrity dashboard and alignment engine for Jira Cloud. It continuously monitors the four perspectives of modern software engineering: **Intent**, **Process**, **Code**, and **Audit**, detecting divergence, unlinked pull requests, skipped code reviews, and chronic rework loops before release.

![FourRealities Project Dashboard](/assets/fourrealities/01-dashboard.png)

---

## 1. The Core Problem: Delivery Drift

In fast-paced engineering organizations, what is planned, what is tracked, what is coded, and what is tested frequently diverge:

- **Intent vs Code:** Architectural Decision Records (ADRs) and Confluence specifications dictate one design, but pull requests implement another without documentation updates.
- **Process vs Code:** Jira tickets are marked "In Progress" or "Done" without corresponding branches or merged pull requests, or code is merged directly to production without an open Jira issue.
- **Code vs Audit:** Pull requests are merged with failing automated checks or unapproved reviews, yet the ticket sails through to release.
- **Rework Churn:** Tickets cycle repeatedly between "In Review" and "In Progress", masking delivery risks and schedule erosion.

Traditional Jira boards show only ticket status columns. They cannot inform leadership whether the code actually reflects the requirements, or whether the release passed requisite quality criteria.

---

## 2. The Four Realities

FourRealities models software delivery as four interconnected realities:

| Reality | Source of Truth | Verification Data |
| :--- | :--- | :--- |
| **1. Intent** | Confluence & Jira Specs | Remote links to Confluence documentation, architectural decision records, and acceptance criteria. |
| **2. Process** | Jira Issue Metadata | Ticket statuses, workflow transitions, assignee history, time estimates, and resolution stamps. |
| **3. Code** | Connected Version Control | Branches, commits, pull requests, and peer review sign-offs via Jira's native development status. |
| **4. Audit** | Verification & Rework History | Transition count, bounce-backs between review and development, automated checks, and compliance seals. |

---

## 3. The Reality Alignment Index (RAI)

FourRealities computes a composite **Reality Alignment Index (RAI)** ranging from `0` to `100` for every active sprint, version, and project.

![Reality Alignment Index Glance](/assets/fourrealities/02-rai-glance.png)

- **90 to 100 (Aligned):** Tickets have linked specifications, clean 1:1 branch and pull request linkage, verified peer reviews, and low transition bounce rates.
- **70 to 89 (Moderate Drift):** Minor delivery discrepancies, such as missing documentation links or isolated review skips.
- **Under 70 (Severe Divergence):** Substantial delivery drift, including unlinked pull requests, code merged without peer approvals, or frequent ticket rework loops.

---

## 4. Architectural Guarantee: 100% Forge Native

Unlike external project analytics tools that require granting third-party servers full read/write access to your source code and Jira databases:

- **Zero External Network Egress:** FourRealities makes zero outbound HTTP requests to external servers.
- **Uses Native Jira Integrations:** FourRealities does not store third-party Git tokens or Confluence passwords. It queries Jira's built-in remote links and Jira's native development status endpoint for already-connected repositories.
- **Zero Third-Party Storage:** All aggregated metrics and historical scores reside exclusively within Atlassian Forge Key-Value Storage (KVS) inside your tenant.

---

## 5. Next Steps

- [Admin Guide](/apps/fourrealities/admin-guide): Connect your Git providers to Jira and configure alignment thresholds.
- [User Guide](/apps/fourrealities/user-guide): Inspect project dashboards, interpret RAI scores, and monitor drift.
- [Resolving Delivery Drift](/apps/fourrealities/resolving-drift): Actionable steps to remediate common alignment alerts.
