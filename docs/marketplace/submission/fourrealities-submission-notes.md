# Atlassian Marketplace Reviewer Notes: FourRealities

## App Overview
- **App Name:** FourRealities
- **App ID:** `ari:cloud:ecosystem::app/974e4981-7626-4b1c-a41f-7eaccb7f3605`
- **Publisher:** Asymm Systems (`https://asymm.systems`)
- **Support Contact:** `support@asymm.systems`
- **Documentation:** `https://docs.asymm.systems/apps/fourrealities/`

---

## 1. OAuth Scopes Justification

Every scope declared in `manifest.yml` directly corresponds to user-facing capabilities:

| Scope | User-Facing Capability | Justification |
|---|---|---|
| `read:jira-work` | Architectural Intent & Dev Status Analysis | Required to read issue remote links (Confluence ADRs/RFCs) and native Jira development information (pull requests, commit branches) to calculate the Reality Alignment Index (RAI). |
| `write:jira-work` | Alignment Index Property Summary | Required to store the computed alignment index and drift status on the issue property for dashboard querying. |
| `storage:app` | Project Dashboard Configuration & Metrics Persistence | Required to persist project-level delivery integrity metrics, rework loop history, and dashboard settings in Forge KVS. |

---

## 2. Architecture & Data Residency Statement

- **Zero External Egress:** FourRealities declares zero external network endpoints. It makes no direct external requests to GitHub, GitLab, or third-party servers. All development information is read exclusively through Jira's native development status integration.
- **Tenant Storage:** All metrics, scores, and history reside strictly in customer Atlassian Forge KVS (`storage:app`).
- **Data Residency:** All data remains strictly within the customer's Atlassian Cloud data region.

---

## 3. Test Credentials & Reviewer Environment Guidance

> **Publisher Note for Submission:** Ensure the review instance (`asymmsystems.atlassian.net`) has project `AUDT` populated with test issues `AUDT-1` (Issue Glance) and `AUDT-2` (Confluence ADR link test).

### Sample Test Issues
- **Issue with Reality Alignment Index:** `AUDT-1` (Displays multi-perspective delivery integrity glance).
- **Issue with Intent Link:** `AUDT-2` (Demonstrates linking Confluence architectural specifications).

---

## 4. Reviewer Test Plan Steps

### Test Step 1: Reality Alignment Issue Glance
1. Open issue `AUDT-1`.
2. Locate the **Delivery Integrity** issue glance in the right sidebar.
3. Observe the calculated Reality Alignment Index (RAI) score (0-100) and the four reality statuses: Intent, Process, Code, and Audit.

### Test Step 2: Confluence Intent Specification Linking
1. Open issue `AUDT-2`.
2. In the FourRealities panel, click **Connect ADR / Spec**.
3. Enter or search for an architectural document URL (e.g. `https://asymmsystems.atlassian.net/wiki/spaces/ARCH/pages/ADR-042`).
4. Observe that the Intent perspective updates from Missing to Documented.

### Test Step 3: Cross-Reality Project Dashboard
1. Navigate to the left project sidebar of project `AUDT` and click **FourRealities Audit Dashboard**.
2. Observe the project-level dashboard summarizing average RAI, reality drift breakdown, and high-risk issues requiring architectural decisions or peer review sign-offs.

---

## 5. Known Review Risks & Technical Mitigations

1. **Jira Development Status Integration (`/rest/dev-status`):**
   - *Technical Rationale:* FourRealities queries Jira's internal development status endpoint (`/rest/dev-status/latest/issue/detail`) solely to inspect PR review states from Git integrations (GitHub, Bitbucket) *already connected to Jira by the customer*.
   - *Privacy Benefit:* This prevents the app from needing external OAuth credentials or making outbound network calls to third-party Git hosts.
   - *Graceful Fallback:* If the endpoint returns no data or fails, the metrics engine falls back gracefully and handles missing PR data without throwing runtime exceptions.
2. **Third-Party Integrations:** FourRealities does not connect to external servers; all data flows strictly through native Jira APIs within Forge.
