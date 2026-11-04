# Atlassian Marketplace Listing: CascadePlan

## App Information
* **Name:** CascadePlan: Timeline, Dependencies and Fast Planning
* **Tagline:** Fast project timelines with percent-trigger dependencies, transparent Jira updates, and keyboard control. Runs on Atlassian.
* **Badges:** Runs on Atlassian | Cloud Fortified | 100% Data Residency Compliant
* **Categories:** Project Management, Planning, Gantt Charts

---

## Short Description
A fast timeline for Jira teams that need dependencies with percent triggers, clear explanations of why tasks start when they do, and honest Jira writes. Built on Atlassian Forge with zero external servers.

---

## Detailed Description

### Fast, Honest Project Planning in Jira
Many Jira teams struggle with rigid timeline tools that only support finish-to-start dependencies, write unwanted estimates to Jira tickets, or freeze when plans grow large.

CascadePlan is designed from the ground up for speed, clarity, and trust:

### Key Capabilities

1. **Percent-Trigger Dependencies with Clear Reasons**
   Link tasks to start when a predecessor reaches a specific progress milestone rather than waiting for 100% completion (for example, start API integration when database design reaches 30%).
   Hover over any bar or press `?` to see the driving task, trigger percentage, and driving dates. When a conflict occurs, CascadePlan names the driving item and suggests exact fixes (such as shifting the successor or adjusting the trigger threshold).

2. **Transparent Jira Writes and 20-Step Undo**
   CascadePlan never writes values to Jira that you did not enter. Only fields you explicitly change (such as due dates, assignees, summaries, or work estimates) are sent to Jira.
   During a drag, an on-screen preview shows every planned Jira update before you release the mouse. Routine edits apply immediately and offer a 10-second undo toast, with full Ctrl+Z and Ctrl+Shift+Z undo/redo support. An in-app Changes panel lets you review every Jira write performed during your session.

3. **Multi-Person Assignment via Native Jira Sub-Tasks**
   Assign additional contributors to a task without leaving the timeline. CascadePlan creates native Jira sub-tasks assigned to each contributor, ensuring work appears directly in team members' personal queues and boards. When removing a contributor, CascadePlan prompts you inside the form to either unassign or delete the sub-task.

4. **High-Performance Canvas Timeline**
   The timeline renders on HTML5 canvas with day-level snapping, zoom controls from Day to Year, sticky headers, frozen data columns, and live ghost previews of dependent tasks during drags. It delivers smooth 60 fps interactions on plans with thousands of tasks.

5. **Full Keyboard Accessibility and Table View**
   Control the entire timeline without a mouse. Navigate tasks with arrow keys, press Space to enter move mode, shift dates with arrow keys or bracket shortcuts, and add dependencies in seconds. For users who prefer a non-canvas layout, a Table view toggle presents all tasks and dates in a clean DOM table with zero accessibility violations. In-app search (Ctrl+F) lets you find and jump to any task instantly.

6. **Flexible Estimation Units**
   Track effort in Hours, Story Points, or T-shirt sizes per task. CascadePlan preserves your chosen unit and converts values into hours for timeline scheduling without altering Jira fields you did not change.

---

## Runs on Atlassian
CascadePlan is built exclusively on Atlassian Forge:
* Zero customer data leaves your Atlassian site.
* No external servers, no third-party databases, and no cloud egress.
* Inherits enterprise SOC 2, ISO 27001, and GDPR compliance natively from Atlassian Cloud.

---

## Security and Permissions
* **Data Storage:** Project planning settings, milestone links, and contributors are stored in Atlassian Forge key-value storage.
* **Jira Integration:** Reads Jira fields live as the logged-in user (`asUser`) and writes only user-approved edits.
* **Least Privilege:** Manifest permissions are restricted strictly to required Jira read/write scopes and app licensing.
* **Zero Egress:** The application manifest contains zero external fetch or egress permissions.

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
