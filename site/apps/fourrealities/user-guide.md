# FourRealities User Guide

This guide explains how engineering managers, tech leads, and developers can use FourRealities to monitor delivery health, identify alignment drift, and inspect rework bottlenecks.

---

## 1. Navigating the Project Dashboard

To view the suite-wide delivery integrity overview for your project:
1. In Jira's project sidebar, select **FourRealities Dashboard**.
2. Select your active sprint or release version from the filter selector.

![FourRealities Project Dashboard](/assets/fourrealities/01-dashboard.png)

The dashboard presents:
- **Project RAI Score:** Overall delivery alignment composite score (0 to 100).
- **Reality Breakdown Grid:** Visual score cards for **Intent**, **Process**, **Code**, and **Audit**.
- **Drift Hotspots:** List of tickets displaying the highest divergence across the four realities.
- **Rework Loop Watchlist:** Issues with repetitive status bounce-backs.

---

## 2. The Issue Glance & Panel

When viewing an individual Jira issue, FourRealities provides two interface entry points:

### The Issue Glance
Located in the issue details sidebar, the glance shows the issue's individual alignment state at a glance:
- **Green Badge (90-100):** Fully aligned.
- **Yellow Badge (70-89):** Minor drift detected.
- **Red Badge (<70):** Divergence detected.

![FourRealities Issue Glance](/assets/fourrealities/02-rai-glance.png)

### The Issue Panel
Clicking the glance opens the expanded FourRealities panel, revealing detailed telemetry for each reality:

![FourRealities Drift Breakdown](/assets/fourrealities/05-drift-breakdown.png)

1. **Intent Reality:**
   - Displays linked Confluence specification pages, Product Requirement Documents (PRDs), and Architectural Decision Records (ADRs).
   - Alerts if a story has transitioned to "In Progress" without acceptance criteria or design links.
2. **Process Reality:**
   - Evaluates transition velocity, estimation accuracy, and workflow adherence.
   - Highlights skipped workflow stages or missing assignees.
3. **Code Reality:**
   - Lists connected branches, commit counts, open pull requests, and merged pull requests.
   - Shows code review approvals, rejected reviews, and unreviewed pull requests.
4. **Audit Reality:**
   - Summarizes automated testing passes, compliance gates, and transition count.

---

## 3. Detecting and Understanding Rework Loops

A primary cause of delivery schedule delays is hidden rework: tickets that bounce repeatedly between QA/Review and Development because requirements were incomplete or tests failed.

![Rework Loop Alert](/assets/fourrealities/03-rework-alert.png)

When an issue bounces between review and development more than the configured threshold:
- A prominent **Rework Loop Warning** banner appears on the issue panel.
- The banner displays the exact transition history, identifying which transitions caused the cycle.
- The issue's Audit Reality score is penalized, immediately signaling risk on the main dashboard.

---

## 4. Best Practices for Developers

- **Include Ticket Keys in Branch Names:** Always name branches with the Jira key (e.g., `feature/PROJ-123-auth`) so Jira and FourRealities automatically associate commits.
- **Link Design Docs Early:** Add Confluence or ADR links to the ticket before moving it from Backlog to In Progress.
- **Require Peer Approval:** Ensure pull requests receive at least one approved code review before merging to maintain Code Reality health.
