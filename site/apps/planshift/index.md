# PlanShift

**PlanShift** provides visual sprint baseline control, scope creep detection, and Work Breakdown Structure (WBS) planning for Jira Cloud. It enables engineering leaders and release managers to freeze sprint commitments, detect scope drift in real time, and enforce a formal approval workflow for scope additions.

![PlanShift WBS Tree and Hierarchy](/assets/planshift/01-wbs-tree.png)

---

## 1. The Core Problem: Silent Scope Creep in Jira

Jira allows anyone with edit permissions to add issues to an active sprint, modify story point estimates mid-sprint, or quietly remove delayed tasks without formal change control:

- **Invisible Commitment Inflation:** A sprint committed at 40 story points quietly expands to 65 points over two weeks, leading to missed deadlines and burnout.
- **Lost Baseline History:** Once estimates are edited or tasks inserted, native Jira loses the original committed baseline. Sprint reports show velocity without explaining why commitments were breached.
- **No Governance Over In-Flight Changes:** Stakeholders add "urgent requests" directly to active sprints without engineering lead approval, bypassing sprint planning discipline.

---

## 2. Key Capabilities

### 1. Visual Work Breakdown Structure (WBS)
PlanShift organizes complex deliverables into a visual hierarchical tree: Initiatives, Epics, Stories, Tasks, and Subtasks. Drag-and-drop planning lets leads sequence work, set dependencies, and inspect schedule horizons without switching between disconnected Jira boards.

### 2. Sprint & Plan Baseline Freezing
At the conclusion of sprint planning, administrators or release managers freeze the plan baseline with a single click. PlanShift captures a cryptographic snapshot of all committed issues, original estimates, assigned personnel, and target milestones.

### 3. Real-Time Scope Creep Detection
Any divergence from the frozen baseline is detected automatically:
- **Added Scope:** New issues injected into the active sprint.
- **Estimate Expansion:** Existing tasks where estimates or story points increased after baseline freeze.
- **Removed Scope:** Unfinished issues removed from the sprint without formal review.
- **Commitment Variance (%):** Instant visibility into net delta hours and scope expansion percentage.

![Scope Creep Alert and Commitment Delta](/assets/planshift/03-scope-creep-alert.png)

### 4. Controlled Scope Shift Approval Workflow
When unexpected work arises, team members submit a **Scope Shift Request** detailing added tasks, hours, and business justification. Designated baseline authorities approve or reject the shift, maintaining an immutable record of authorized scope modifications.

![Scope Shift Approval Modal](/assets/planshift/05-shift-approval.png)

### 5. Resource Allocation Utilization Grid *(New in this release)*
A multi-week capacity grid visualizes team workload across the project timeline:
- **Weekly Capacity Balancing:** Flags weeks where team members exceed standard 40-hour capacity.
- **Bottleneck Detection:** Identifies overallocation spikes across dependencies before sprint execution begins.

![Resource Allocation Grid](/assets/planshift/02-resource-heatmap.png)

---

## 3. Data Privacy and Zero-Egress Architecture

- **100% Atlassian Forge Native:** All computation executes inside Atlassian's secure execution environment.
- **Zero External Network Calls:** PlanShift makes no outbound HTTP requests to external servers.
- **Tenant Data Residency:** Baselines, shift requests, and utilization metrics reside in customer Forge Key-Value Storage (KVS) within your Atlassian site.

---

## 4. Next Steps

- [Admin Guide](/apps/planshift/admin-guide): Configure baseline authorities and permission schemes.
- [User Guide](/apps/planshift/user-guide): Freeze baselines, build WBS trees, and request scope shifts.
- [Scope Creep Auditing](/apps/planshift/scope-creep-audit): Conduct sprint post-mortems and audit variance history.
