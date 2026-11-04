# Resolving Delivery Drift

When FourRealities detects divergence across the delivery pipeline, it surfaces targeted remediation recommendations. This operational guide provides step-by-step procedures to resolve common drift scenarios and restore your Reality Alignment Index (RAI) score.

---

## 1. Drift Type: Unlinked Pull Requests (Code vs Process)

### Symptom
The Jira ticket is marked **In Progress** or **Done**, but the Code Reality indicator reports `0 Linked Branches` or `0 Pull Requests`, while code is known to be running in staging.

### Root Cause
Developers created a Git branch without referencing the Jira issue key in the branch name or commit message, preventing Jira's native development status integration from associating the code with the ticket.

### Remediation Steps
1. In your Git client or terminal, inspect the branch or commit history for the change.
2. If the pull request is still open:
   - Edit the pull request title in GitHub, Bitbucket, or GitLab to include the issue key (for example: `PROJ-104: Add biometric authentication`).
3. If the pull request is already merged:
   - On the Jira issue, open the **Development** panel on the right sidebar.
   - Click the development link to force a sync, or add a comment referencing the commit SHA.
4. Refresh the FourRealities panel. The Code Reality score will update immediately once the pull request is linked.

---

## 2. Drift Type: Skipped Code Review (Code vs Audit)

### Symptom
Code Reality displays a yellow or red warning: `Pull Request Merged Without Peer Approval`.

### Root Cause
A pull request was merged directly to the primary branch using administrative override, without meeting the minimum peer review threshold, or before approvals were recorded.

### Remediation Steps
1. Navigate to the linked pull request in your version control platform.
2. Review the commit log to determine if an emergency hotfix bypass occurred.
3. Conduct a post-merge peer review:
   - Have an independent engineer review the PR diff.
   - Leave an explicit approval comment and sign-off in the PR discussion.
4. On the Jira issue, record a retrospective review note or attach a peer sign-off waiver in DefinitionGuard or LedgerSeal.
5. In FourRealities project settings, ensure branch protection rules in GitHub/Bitbucket are configured to disallow unapproved merges.

---

## 3. Drift Type: Architectural Drift (Intent vs Code)

### Symptom
Intent Reality displays `No Linked Design Specification or ADR`, while Code Reality shows high complexity with 500+ lines changed across multiple services.

### Root Cause
Developers implemented major structural or interface changes without an agreed Architectural Decision Record (ADR) or technical design document.

### Remediation Steps
1. Create or update an Architectural Decision Record in Confluence or your repository documentation folder.
2. On the Jira issue:
   - Click **Link issue** > **Confluence page** (or **Web link** if your ADRs are stored in Markdown in Git).
   - Paste the URL of the approved design document.
3. Once linked, the FourRealities Intent scanner will detect the documentation reference and restore Intent Reality points.

---

## 4. Drift Type: Chronic Rework Loop (Process vs Audit)

### Symptom
A high-priority warning banner indicates: `Critical Rework Loop: 3 status bounce-backs detected`.

### Root Cause
The ticket moved to QA or Code Review and was repeatedly rejected back to In Progress due to defects, missed requirements, or failing integration tests.

### Remediation Steps
1. Inspect the ticket's transition history to determine the exact stages where rejection occurred.
2. Conduct a brief blocker alignment:
   - Are acceptance criteria ambiguous? Update the Jira description with explicit verification criteria.
   - Are unit or integration tests failing locally? Fix tests before initiating another review.
3. Once the issue is properly remediated, complete the review and transition the ticket to Done.
4. The ticket will remain marked in history as having incurred rework, but resolving the issue halts further RAI degradation for the sprint.

---

## 5. Drift Recovery & Recalculation

FourRealities recalculates the Reality Alignment Index automatically. After completing any of the remediation steps above:
1. Reload the Jira issue or project dashboard.
2. Verify that the relevant reality card turns green.
3. The sprint-level RAI score will reflect the restored alignment immediately.
