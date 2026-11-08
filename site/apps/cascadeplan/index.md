# CascadePlan

**CascadePlan** is a timeline planner inside Jira Cloud. It schedules work items with dependencies that can start at a percent of their predecessor, moves the dependent work for you, and keeps every date, link and parent change in Jira itself. Plan approvers can freeze a plan as a baseline and see how the scope changed since then.

---

## 1. What CascadePlan does

### Timeline and dependencies
- A timeline of the project's epics, stories, tasks and sub-tasks, with zoom from Day to Year.
- Dependencies are Jira "Blocks" links. A link can start its successor when the predecessor reaches a percent of its work, for example 30%, not only at 100%.
- When you move a work item, CascadePlan moves the work that depends on it (the cascade), and shows each Jira change before you drop the bar.
- "Why this date?" names the link that sets a work item's earliest start and offers fixes.
- A task or story moves together with its sub-tasks: work not started moves, work in progress keeps its start, finished work stays.
- You can move a work item under another one, or change a task into a sub-task and back. CascadePlan makes the change in Jira after you confirm it.

### Jira stays the record
- Every date, link, parent and sub-task you see exists in Jira. CascadePlan writes only values you chose in the action you took, as you, with your Jira permissions.
- The Changes panel lists every Jira write of your session, with the old and the new value. Undo and Redo cover the last 20 date, field and link changes.

### Plans and baselines
- Scenario plans next to the Main Plan: each plan has its own row order, columns and milestones; dates, links and the hierarchy are the same in every plan, because they are Jira's.
- Baselines: a plan approver freezes the plan. The toolbar then shows the scope change since that moment: hours, items added, removed or ending later. Anyone in the project can ask a plan approver to accept the new scope; accepting freezes a new baseline version. Versions can be compared and exported as CSV.

### Keyboard and views
- Arrow keys move around the grid; Space starts a keyboard move of a bar; Ctrl+F searches tasks.
- A Table view and a Utilization view (work per person and week).

---

## 2. Data and privacy

- CascadePlan runs entirely on Atlassian Forge. It has no external servers and makes no calls outside your Atlassian site.
- Planning data (row order, columns, milestones, plans and baselines) is stored in Forge storage of your site. The shared start date and the trigger percents are Jira issue properties of the issues they belong to.
- The personal data CascadePlan stores is the Atlassian account id of who froze a baseline, of who requested or reviewed a scope change, of each person who works on a task through a Jira sub-task, and of the Jira administrator who last saved the approver groups. Each id is reported to Atlassian's personal data reporting service once every 7 days, and the records of a closed account are changed to name no one. A contributor name that matches no account (for example a placeholder role) is kept as typed.

---

## 3. Next steps

- [User Guide](/apps/cascadeplan/user-guide): plan, link, move and baseline your work.
- [Admin Guide](/apps/cascadeplan/admin-guide): permissions, plan approvers, data and uninstall.
- [Baselines and Scope Reviews](/apps/cascadeplan/scope-creep-audit): use baselines in reviews and retrospectives.
