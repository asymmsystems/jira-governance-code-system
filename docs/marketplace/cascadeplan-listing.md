# Atlassian Marketplace Listing: CascadePlan

## App Information
* **App Title:** CascadePlan: Timeline and Dependencies
* **Tagline:** Jira timeline with percent-trigger links, block moves, baselines and undo.
* **Categories:** Project Management, Planning, Gantt Charts

---

## Short Highlight Description (Max 250 chars)
A timeline inside Jira where work can start at a percent of its predecessor, dependent work moves for you, and every date, link and parent change is a Jira write you see first and can undo. Baselines track scope. (212 characters)

---

## The Unaddressed Native Problem

Most Jira timeline tools know one kind of dependency: finish to start. Real work overlaps. An API integration can begin when the database design is 30% done, and a team that plans with finish-to-start links either pads the plan or ignores the tool.

Planning tools also lose trust in three ways:
1. A planner drags a task two weeks later, five dependent tasks move, and nobody can see which Jira fields changed or why a task now starts on a given day.
2. The tool keeps its own copy of links, parents and dates, so the plan and Jira disagree.
3. Scope grows quietly: work is added and estimates rise after the team committed, and nobody can show what the commitment was.

CascadePlan keeps Jira as the record of every relationship (links are Jira "Blocks" links, parents are Jira parents, contributors are Jira sub-tasks). It lets work start at a percent of its predecessor, explains every start date, shows every Jira write before it happens, and freezes baselines so a change of scope is visible and reviewed.

---

## Key Capabilities & Verifiable Proof

| Capability | Underlying Mechanism | Verifiable Proof in Code & Tests |
|---|---|---|
| **Percent-Trigger Dependencies** | A successor can start when its predecessor reaches any percent of its work. The link is a Jira "Blocks" link; the percent is the issue property `cascadeplan.links`. A task can have several predecessors, each with its own arrow and label. With **Enforce deps** on, a bar cannot be dropped too early; otherwise a dialog offers fixes. | `apps/cascadeplan/src/domain/schedule-engine.ts`, `apps/cascadeplan/src/domain/work-effort-links.ts`, `apps/cascadeplan/src/ui/dependency-edit.ts`, `apps/cascadeplan/test/domain/schedule-engine.test.ts`, `apps/cascadeplan/test/ui/dependency-edit.test.ts`, `apps/cascadeplan/test/dependency-removal.test.ts` |
| **Why-Explanations** | **Why this date?** (the row's ❓ button, or `?`) names the link that sets a work item's earliest start and whether it waits. | `apps/cascadeplan/src/ui/why.ts`, `apps/cascadeplan/src/frontend/why-popup.ts`, `apps/cascadeplan/test/ui/why.test.ts` |
| **Moves That Carry Their Consequences** | Moving a work item moves the work that depends on it (the cascade). A task or story moves with its sub-tasks: not started moves, in progress keeps its start, done stays; the parent's Jira due date follows. Large blocks continue in calls of 25. | `apps/cascadeplan/src/domain/block-move.ts`, `apps/cascadeplan/src/server/block-moves.ts`, `apps/cascadeplan/test/block-move.test.ts` |
| **Hierarchy Changes in Jira** | Drag a row onto another to move it under that work item, or change a task into a sub-task and back (a Jira bulk move job). CascadePlan asks first and checks Jira's rules. | `apps/cascadeplan/src/server/hierarchy.ts`, `apps/cascadeplan/test/hierarchy-changes.test.ts`, `apps/cascadeplan/test/hierarchy.test.ts` |
| **Transparent Jira Writes** | Before a drop, a line lists every due date and start date the drop will change. Only values the user chose are written, as the user, after a Jira permission check. The **Changes** panel lists every Jira write of the session with old value, new value and result. | `apps/cascadeplan/src/ui/change-log.ts`, `apps/cascadeplan/src/frontend/changes-panel.ts`, `apps/cascadeplan/src/security/write-permissions.ts`, `apps/cascadeplan/test/write-transparency.test.ts`, `apps/cascadeplan/test/no-unrequested-writes.test.ts`, `apps/cascadeplan/test/write-permissions.test.ts` |
| **Undo and Redo** | Each write shows a Jira message with **Undo** that stays until you close it; Ctrl+Z and Ctrl+Shift+Z cover the last 20 changes, links included. | `apps/cascadeplan/src/ui/undo-stack.ts`, `apps/cascadeplan/src/ui/undo-plan.ts`, `apps/cascadeplan/test/ui/undo-stack.test.ts`, `apps/cascadeplan/test/ui/undo-plan.test.ts` |
| **Baselines and Scope Reviews** | A plan approver freezes the plan as a baseline (estimate, start and end of each work item, with a SHA-256 digest). The toolbar shows the change since the freeze. Anyone in the project can request acceptance of new scope; a plan approver other than the requester accepts or rejects it. Versions can be compared and exported as CSV. | `apps/cascadeplan/src/domain/baseline.ts`, `apps/cascadeplan/src/storage/baseline-store.ts`, `apps/cascadeplan/src/frontend/baseline-panel.ts`, `apps/cascadeplan/src/domain/sha256.ts`, `apps/cascadeplan/test/baseline.test.ts` |
| **Plans and Plan Filters** | Scenario plans keep their own row order, columns and milestones; dates, links and the hierarchy are Jira's, so every plan shows the same. A plan can read only the work items matching a JQL filter, checked by Jira first. | `apps/cascadeplan/src/server/plans.ts`, `apps/cascadeplan/src/storage/plan-store.ts`, `apps/cascadeplan/src/domain/plan-filter.ts`, `apps/cascadeplan/test/plan-filter.test.ts`, `apps/cascadeplan/test/plan-isolation.test.ts` |
| **Contributors as Jira Sub-Tasks** | **+ Allocate Resource** creates a Jira sub-task assigned to each extra contributor; **Create sub-task in Jira** creates a plain one. A repeated create after a lost answer returns the first issue. | `apps/cascadeplan/src/ui/second-person.ts`, `apps/cascadeplan/src/server/jira-write.ts`, `apps/cascadeplan/test/second-person.test.ts`, `apps/cascadeplan/test/create-once.test.ts` |
| **Timeline, Table and Utilization Views** | Canvas timeline with Day, Week, Month, Quarter and Year zoom and a Compact view; a **Table** view; a **Utilization** view of estimated hours per person per week (no capacity assumed). | `apps/cascadeplan/src/frontend/canvas-timeline.ts`, `apps/cascadeplan/src/ui/table-view.ts`, `apps/cascadeplan/src/ui/weekly-hours.ts`, `apps/cascadeplan/test/ui/table-view.test.ts`, `apps/cascadeplan/test/ui/weekly-hours.test.ts` |
| **Keyboard Control and Search** | Arrow keys move between rows; Space enters move mode on a bar; Ctrl+F searches by key or summary. | `apps/cascadeplan/src/ui/keyboard-grid.ts`, `apps/cascadeplan/src/ui/in-app-search.ts`, `apps/cascadeplan/test/ui/keyboard-grid.test.ts` |
| **Estimation Units** | Each task can use Hours, Story Points (1 point = 8 hours) or a T-shirt size, converted to hours for scheduling. | `apps/cascadeplan/src/domain/models.ts`, `apps/cascadeplan/test/estimation-unit.test.ts` |

---

## Enterprise Compliance Grounding

CascadePlan is a planning tool. It can support compliance with change-management controls in two narrow ways:

- **SOC 2 (CC8.1) and ISO/IEC 27001:2022 (A.8.32 Change management):** every Jira write is a normal Jira edit by the signed-in user, after a check of that user's Jira permissions, so it appears in Jira's own issue history. CascadePlan writes only values the user chose.
- **Scope baselines:** a frozen baseline records the committed scope with a SHA-256 digest, and a change of scope needs a plan approver other than the requester.

*Honest Compliance Boundary:* CascadePlan does not certify your organization. Your auditor decides whether your controls meet a standard.

---

## Data Privacy & "Runs on Atlassian" Architecture

- **Forge native:** CascadePlan runs entirely on Atlassian Forge. The manifest declares no external endpoint, and no data leaves your Atlassian site.
- **Storage:** plans, row order, columns, milestones, plan filters, baselines, scope-change requests and approver groups are in Forge storage of your site. Shared start dates, trigger percents and create ids are issue properties of your Jira issues.
- **Reads and writes as the user:** Jira is read and written as the signed-in user (`asUser`), and every write is checked against that user's Jira permissions first.
- **Personal data:** Atlassian account ids: of who froze a baseline, of who requested or reviewed a scope change, of each person who works on a task through a Jira sub-task, and of the Jira administrator who last saved the approver groups. CascadePlan reads its stored records in steps every hour and reports each of these ids to Atlassian's personal data reporting service once every 7 days; the id of a closed account is removed from every record. A contributor name that matches no account (for example a placeholder role) is kept as typed.
- **Scopes:** `read:jira-work`, `write:jira-work`, `read:jira-user`, `storage:app`, `report:personal-data`. No content permissions (no inline scripts or styles).

---

## Transparent Pricing

| Tier | Monthly Price | Annual Price (2 Months Free) |
|---|---|---|
| **1 to 10 Users** | **Free** | **Free** |
| **11 to 100 Users** | $1.50 per user / month | $15.00 per user / year |
| **101 to 250 Users** | $1.20 per user / month | $12.00 per user / year |
| **251 to 1,000 Users** | $0.90 per user / month | $9.00 per user / year |
| **1,001+ Users** | $0.90 per user / month | $9.00 per user / year |

*All billing is handled natively through Atlassian.*

---

## Highlights (images 1840 x 900: the Marketplace form needs at least 920 x 450, so the matching screenshots are used; `highlight-1.png` to `highlight-3.png` in `docs/marketplace/assets/cascadeplan/` are too small)

1. **Start at 30%, not 100%.** A successor can start when its predecessor reaches a percent of its work. "Why this date?" names the link that sets the earliest start.
2. **Move a story with its sub-tasks.** Work not started moves, work in progress keeps its start, finished work stays. Before you drop, CascadePlan lists every Jira change the drop will make.
3. **Freeze a baseline, review scope changes.** The toolbar shows the change since the baseline in hours, added work and later ends. A plan approver accepts or rejects a scope change.

---

## Retina Screenshot Gallery Manifest (1840 x 900, captured from the planner only)

1. `01-timeline.png` - **A plan on the timeline.** Epics, stories, tasks and sub-tasks with their progress, and links that start at 30% or 50% of their predecessor.
2. `02-why-this-date.png` - **Why this date?** The planner names the link that sets a work item's start, and whether it waits.
3. `03-move-preview.png` - **See every Jira change before you drop.** Moving a story moves its sub-tasks and the work that depends on it; the line above lists each due date and start date that will change.
4. `04-baseline.png` - **Baselines and scope reviews.** The change since the frozen baseline: hours, added work and changed estimates, with a request for approval.
5. `05-link-editor.png` - **Change a link.** Click an arrow or its label to set the percent, swap the direction or remove the Jira link.

---

## Support, Documentation & Legal Links

- **Documentation Portal:** https://asymm.systems/product/jira-governance/user-guide/cascadeplan.html
- **Privacy Policy:** https://asymm.systems/privacy
- **Terms of Service:** https://asymm.systems/terms
- **Support Portal & SLA:** https://asymm.systems/support
- **Direct Support Contact:** `support@asymm.systems`
