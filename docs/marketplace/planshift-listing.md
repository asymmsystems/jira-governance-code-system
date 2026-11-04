# Atlassian Marketplace Listing: PlanShift

## App Information
* **App Title:** PlanShift
* **Tagline:** Visual sprint baseline control, scope creep detection, and WBS planning for Jira
* **Categories:** Project Management, Workflow & Automation, Security

---

## Short Highlight Description (Max 250 chars)
Protect sprint commitments with visual baseline freezing. PlanShift detects mid-sprint scope creep, audits commitment variance, visualizes team capacity bottlenecks, and enforces formal scope shift approval workflows. (219 characters)

---

## The Unaddressed Native Problem

In agile delivery, the most common cause of missed deadlines and burnout is **silent scope creep**:

1. **Unfrozen Commitments:** Sprints start with an agreed commitment, but native Jira does not freeze a baseline snapshot. As tickets are added or estimates increase mid-sprint, the original commitment is erased.
2. **Invisible Variance:** Project managers and engineering leads cannot easily see the delta between what was promised at sprint planning versus what is being delivered today.
3. **Hidden Resource Overload:** Individual engineers become over-allocated across multiple epics without visual capacity visibility, causing downstream bottlenecks.
4. **Informal Scope Changes:** Scope is expanded informally without structured review or recorded approval authority.

PlanShift introduces rigorous **sprint baseline governance**: freeze your sprint commitment snapshot with one click, detect mid-cycle additions and estimate inflation, audit variance, and govern scope changes through formal shift approvals.

---

## Key Capabilities & Verifiable Proof

| Capability | Underlying Mechanism | Verifiable Proof in Code & Tests |
|---|---|---|
| **Sprint Baseline Freezing** | Freezes a complete snapshot of task commitments, estimates, and schedules at sprint planning. | `apps/planshift/src/domain/scope-creep.ts`, `apps/planshift/test/domain/scope-creep.test.ts` |
| **Scope Creep Detection** | Audits live plan against frozen baselines, tracking net added tasks, expanded hours, and variance percentage. | `apps/planshift/src/domain/scope-creep.ts`, `apps/planshift/test/domain/scope-creep.test.ts` |
| **Formal Shift Approval Workflow** | Governs baseline changes through structured shift requests reviewed by authorized authorities. | `apps/planshift/src/domain/scope-creep.ts`, `apps/planshift/src/storage/baseline-repository.ts` |
| **Resource Utilization Grid** | Aggregates weekly workloads across engineers, highlighting over-allocations and bottleneck weeks. | `apps/planshift/src/domain/resource-utilization.ts`, `apps/planshift/test/domain/resource-utilization.test.ts` |
| **Interactive WBS Planning** | Multi-tier Work Breakdown Structure (Epic -> Story -> Subtask) with timeline canvas and dependency linking. | `apps/planshift/src/domain/planner-engine.ts`, `apps/planshift/test/domain/planner-engine.test.ts` |
| **Uniform Permission Standard** | Configurable approver policies stored under `ps:cfg:approver_policy` with Jira group search. | `apps/planshift/src/security/policy-admin.ts`, `apps/planshift/test/ui/admin.test.tsx` |

---

## Enterprise Compliance Grounding

PlanShift provides structured governance for delivery commitments:

- **SOC 2 Type II (CC8.1 Change Authorization):** Enforces formal authorization and approval records for scope and milestone shifts.
- **ISO/IEC 27001:2022 (Control A.8.32):** Tracks and audits project scope variance, ensuring production delivery aligns with authorized planning.
- **GxP / Medical Software Project Controls:** Documents baseline commitment history and justification for schedule changes during regulated development lifecycles.

*Honest SDLC Boundary:* PlanShift provides visual planning, baseline comparison, and shift approval records. It assists project governance but does not replace formal organizational change management policies.

---

## Data Privacy & "Runs on Atlassian" Architecture Guarantee

- **100% Forge Native Execution:** Runs entirely within Atlassian Cloud infrastructure.
- **Zero External Egress:** Contains zero outbound fetch endpoints. No project schedules or resource names leave your Atlassian tenant.
- **Customer Tenant Storage:** Baselines, shift approval records, and WBS allocations reside strictly in your Atlassian Forge Key-Value Storage (KVS).
- **Tenant Data Residency:** Complies with your Jira Cloud geographic data residency boundaries.

---

## Transparent Pricing

| Tier | Monthly Price | Annual Price (2 Months Free) |
|---|---|---|
| **1 to 10 Users** | **Free** | **Free** |
| **11 to 100 Users** | $1.50 per user / month | $15.00 per user / year |
| **101 to 250 Users** | $1.20 per user / month | $12.00 per user / year |
| **251 to 1,000 Users** | $0.90 per user / month | $9.00 per user / year |

*Billed seamlessly through your Atlassian Cloud invoice.*

---

## Retina Screenshot Gallery Manifest

1. `01-wbs-tree.png` - **Visual WBS Planning:** Interactive task breakdown tree with timeline canvas, dependencies, and sprint columns.
2. `02-resource-heatmap.png` - **Resource Utilization Grid:** Team workload distribution grid highlighting over-allocated engineers and capacity bottlenecks.
3. `03-scope-creep-alert.png` - **Scope Creep Alert:** Clear banner displaying commitment variance (+14.3%), added tasks, and expanded estimates.
4. `04-baseline-settings.png` - **Approver Governance:** Admin page managing authorized baseline shift approvers under the Uniform Permission Standard.
5. `05-shift-approval.png` - **Formal Shift Approval:** Review modal recording justification, delta hours, and authorized sign-off.

---

## Support, Documentation & Legal Links

- **Documentation Portal:** https://docs.asymm.systems/apps/planshift/
- **Privacy Policy:** https://asymm.systems/privacy
- **Terms of Service:** https://asymm.systems/terms
- **Support Portal & SLA:** https://asymm.systems/support
- **Direct Support Contact:** `support@asymm.systems`
