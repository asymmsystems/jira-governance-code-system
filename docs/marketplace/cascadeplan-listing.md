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

## Runs entirely on Atlassian Forge
* No external servers and no calls outside your Atlassian site.
* Planning data is stored in Forge storage of your site; the shared start dates and trigger percents are issue properties of your Jira issues.

---

## Security and Permissions
* **Your own permissions:** every write is made as you and checked against your Jira permissions first (Edit issues, Schedule issues, Link issues, Create issues, and for type changes Move issues and Make bulk changes).
* **Plan approvers:** project administrators, Jira administrators, and members of groups named on the app's admin page manage plans and baselines.
* **Personal data:** the only personal data stored is the Atlassian account id of who froze a baseline and who requested or reviewed a scope change. These ids are reported weekly to Atlassian's personal data reporting service.
* **Scopes:** `read:jira-work`, `write:jira-work`, `read:jira-user`, `storage:app`, `report:personal-data`. No egress.

---

## Pricing
CascadePlan offers simple, tiered user-based pricing with automated Atlassian billing:
* **Free Tier:** Free forever for small teams up to 10 users.
* **Standard Tier (11 to 100 users):** $1.50 / user / month.
* **Growth Tier (101 to 250 users):** $1.20 / user / month.
* **Enterprise Tier (251+ users):** Volume pricing down to $0.60 / user / month.
* **Annual Subscriptions:** 2 months free with an annual plan.

---

## Support, Documentation & Legal Links

- **Documentation Portal:** https://asymm.systems/product/jira-governance/user-guide/cascadeplan.html
- **Privacy Policy:** https://asymm.systems/privacy
- **Terms of Service:** https://asymm.systems/terms
- **Support Portal & SLA:** https://asymm.systems/support
- **Direct Support Contact:** `support@asymm.systems`
