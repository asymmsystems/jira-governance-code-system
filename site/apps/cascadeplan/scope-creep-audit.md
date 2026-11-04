# Scope Creep Auditing & Sprint Retrospectives

Scope creep is one of the leading causes of missed software release dates, budget overruns, and engineering team burnout. CascadePlan provides structured auditing and metrics export capabilities to help engineering leadership analyze commitment variance across sprints and delivery quarters.

---

## 1. Scope Variance Metrics

CascadePlan quantifies delivery stability using three standardized metrics:

### 1. Scope Creep Percentage (Expansion Ratio)
The total net increase in committed effort after baseline freezing:
$$\text{Scope Creep \%} = \frac{\text{Net Added Hours}}{\text{Original Baseline Hours}} \times 100\%$$

- **Healthy Sprint (< 5%):** Minor discoveries handled within natural team slack.
- **Moderate Variance (5% to 15%):** Noticeable scope expansion; requires trade-off evaluation during sprint retrospectives.
- **Critical Instability (> 15%):** Substantial scope creep indicating incomplete planning, volatile requirements, or unauthorized task injection.

### 2. Scope Churn Rate
The gross volume of changes (both added and removed work) relative to initial plan commitments:
$$\text{Scope Churn Rate} = \frac{\text{Added Hours} + \text{Removed Hours}}{\text{Original Baseline Hours}} \times 100\%$$

A high churn rate with a low net creep percentage often signals shifting priorities mid-sprint, where developers are forced to abandon partially finished tasks to address new urgent items.

### 3. Shift Approval Compliance Rate
The proportion of scope expansions that followed formal shift approval procedures versus unmanaged direct injections:
$$\text{Approval Compliance} = \frac{\text{Formally Approved Shift Hours}}{\text{Total Added Hours}} \times 100\%$$

Regulated organizations and client services agencies target a 100% compliance rate.

---

## 2. Conducting a Sprint Scope Retrospective

During your sprint retrospective or milestone post-mortem:

1. Open the **CascadePlan Planner** and select the completed sprint.
2. In the baseline selector, choose **Baseline Comparison View**.
3. Inspect the side-by-side delta table:
   - **Original Baseline:** Displays the committed snapshot as frozen at sprint launch.
   - **Terminal State:** Displays all issues completed or remaining at sprint close.
   - **Variance Log:** Chronological list of every ticket added, removed, or re-estimated during the sprint.

### Key Retrospective Questions
- Did scope creep originate from internal technical discoveries (e.g., refactoring or legacy defects) or external stakeholder requests?
- Were scope additions accompanied by de-scoping lower-priority work, or was the team expected to absorb the delta?
- Did any single epic account for the majority of estimate growth?

---

## 3. Auditing for Client Services & Fixed-Fee Projects

For software agencies, consulting firms, and defense contractors operating under fixed-fee or milestone-based contracts, unrecorded scope expansion represents direct revenue loss:

1. **Client Sign-off Verification:** When clients request modifications mid-milestone, submit a formal Scope Shift Request and attach client email confirmation or change order reference in the justification.
2. **Immutable Audit Trail:** CascadePlan records the exact Atlassian Account ID, timestamp, and justification for every approved baseline version (`v1.0`, `v1.1`, `v1.2`).
3. **Change Order Export:** Export the complete baseline audit trail as a signed PDF or JSON artifact to support client invoicing and change order negotiations.

---

## 4. Exporting Audit Reports

Administrators and leads can export complete baseline audit data:
1. In CascadePlan, click **Export Report** in the top navigation.
2. Choose your export format:
   - **JSON (Machine Readable):** Contains full ticket snapshots, SHA-256 baseline hashes, and shift request logs for ingestion into enterprise data lakes or compliance archives.
   - **CSV (Tabular):** Summary table of all sprint issues, original hours, final hours, and delta percentages for executive review.
