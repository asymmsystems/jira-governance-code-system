# Atlassian Marketplace Listing: CascadePlan

## App Information
* **Name:** CascadePlan: Timeline, Dependencies and Fast Planning
* **Tagline:** A Jira timeline with percent-trigger dependencies, block moves, baselines, and Jira as the record of every change.
* **Categories:** Project Management, Planning, Gantt Charts

---

## Short Description
A timeline inside Jira Cloud. Dependencies can start at a percent of their predecessor, dependent work moves for you, and every date, link and parent change is a Jira write you can see and undo. Plan approvers freeze baselines and review scope changes. Runs entirely on Atlassian Forge.

---

## Detailed Description

### Planning that keeps Jira as the record
CascadePlan schedules your project's epics, stories, tasks and sub-tasks on a timeline. Every relationship it shows exists in Jira: dependencies are Jira "Blocks" links, parents are Jira parents, sub-tasks are Jira sub-tasks. It writes only the values you chose in the action you took, as you, with your Jira permissions.

### Key Capabilities

1. **Percent-trigger dependencies with reasons.** A successor can start when its predecessor reaches 30%, 50% or any percent of its work, not only at 100%. "Why this date?" names the link that sets a work item's earliest start and offers fixes. With "Enforce dependencies" on, a bar cannot be dropped too early.

2. **Moves that carry their consequences.** Moving a work item moves the work that depends on it. A task or story moves with its sub-tasks: work not started moves, work in progress keeps its start, finished work stays. Before you drop a bar, a line lists every Jira change the drop will make.

3. **Hierarchy changes in Jira.** Drag a row onto another to move it under that work item, or change a task into a sub-task and back. CascadePlan asks first, checks Jira's rules, and makes the change in Jira.

4. **See and undo every write.** The Changes panel lists each Jira write of your session with the old and new value. Undo and Redo cover the last 20 changes.

5. **Scenario plans.** Try a different row order, columns and milestones in a scenario plan. Dates, links and the hierarchy are Jira's, so they are the same in every plan.

6. **Baselines and scope reviews.** A plan approver freezes the plan as a baseline. The toolbar then shows the change since that moment: hours, work items added, removed or ending later. Anyone in the project can ask for the new scope to be accepted; a plan approver other than the requester accepts or rejects it, and accepting freezes a new version. Compare versions, export one as CSV with its SHA-256 digest, and see if a stored baseline no longer matches what was frozen.

7. **Keyboard and views.** Move bars with the keyboard, search with Ctrl+F, and switch to a Table view or a Utilization view of each person's hours per week.

---

## Highlights (images 580 x 330: `docs/marketplace/assets/cascadeplan/highlight-1.png` to `highlight-3.png`)

1. **Start at 30%, not 100%.** A successor can start when its predecessor reaches a percent of its work. "Why this date?" names the link that sets the earliest start.
2. **Move a story with its sub-tasks.** Work not started moves, work in progress keeps its start, finished work stays. Before you drop, CascadePlan lists every Jira change the drop will make.
3. **Freeze a baseline, review scope changes.** The toolbar shows the change since the baseline in hours, added work and later ends. A plan approver accepts or rejects a scope change.

---

## Screenshots (1840 x 900: `docs/marketplace/assets/cascadeplan/01-timeline.png` to `05-link-editor.png`)

1. **A plan on the timeline.** Epics, stories, tasks and sub-tasks with their progress, and links that start at 30% or 50% of their predecessor.
2. **Why this date?** The planner names the link that sets a work item's start, and whether it waits.
3. **See every Jira change before you drop.** Moving a story moves its sub-tasks and the work that depends on it; the line above lists each due date and start date that will change.
4. **Baselines and scope reviews.** The change since the frozen baseline: hours, added work and changed estimates, with a request for approval.
5. **Change a link.** Click an arrow or its label to set the percent, swap the direction or remove the Jira link.

---

## Runs entirely on Atlassian Forge
* No external servers and no calls outside your Atlassian site.
* Planning data is stored in Forge storage of your site; the shared start dates and trigger percents are issue properties of your Jira issues.

---

## Security and Permissions
* **Your own permissions:** every write is made as you and checked against your Jira permissions first (Edit issues, Schedule issues, Link issues, Create issues, and for type changes Move issues and Make bulk changes).
* **Plan approvers:** project administrators, Jira administrators, and members of groups named on the app's admin page manage plans and baselines.
* **Personal data:** Atlassian account ids: of who froze a baseline, of who requested or reviewed a scope change, and of each person who works on a task through a Jira sub-task. These ids are reported weekly to Atlassian's personal data reporting service, and the id of a closed account is removed. A contributor name that matches no account (for example a placeholder role) is kept as typed.
* **Scopes:** `read:jira-work`, `write:jira-work`, `read:jira-user`, `storage:app`, `report:personal-data`. No egress, and no content permissions (no inline scripts or styles).

---

## Pricing
CascadePlan is billed through your Atlassian invoice, per user, with the same tiers as the other Asymm Systems apps:

| Tier | Monthly Price | Annual Price (2 Months Free) |
|---|---|---|
| **1 to 10 Users** | **Free** | **Free** |
| **11 to 100 Users** | $1.50 per user / month | $15.00 per user / year |
| **101 to 250 Users** | $1.20 per user / month | $12.00 per user / year |
| **251 to 1,000 Users** | $0.90 per user / month | $9.00 per user / year |
| **1,001+ Users** | Custom | Custom |

---

## Support, Documentation & Legal Links

- **Documentation Portal:** https://asymm.systems/product/jira-governance/user-guide/cascadeplan.html
- **Privacy Policy:** https://asymm.systems/privacy
- **Terms of Service:** https://asymm.systems/terms
- **Support Portal & SLA:** https://asymm.systems/support
- **Direct Support Contact:** `support@asymm.systems`
