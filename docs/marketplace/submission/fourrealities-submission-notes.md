# Atlassian Marketplace Reviewer Notes: FourRealities

## App Overview
- **App Name:** FourRealities
- **App ID:** `ari:cloud:ecosystem::app/974e4981-7626-4b1c-a41f-7eaccb7f3605`
- **Publisher:** Asymm Systems (`https://asymm.systems`)
- **Support Contact:** `support@asymm.systems`
- **Documentation:** `https://asymm.systems/product/jira-governance/user-guide/fourrealities.html`

---

## 1. OAuth Scopes Justification

Every scope declared in `manifest.yml` and its real use in the code:

| Scope | User-Facing Capability | Justification |
|---|---|---|
| `read:jira-work` | Gate evaluation, project dashboard | Reads issues (fields, changelog, issue properties, remote links, issue links), the Jira Development field for pull request count and state, statuses, fields, server info and the user's permissions (`/rest/api/3/mypermissions`). Used to evaluate the four gates and build the dashboard. |
| `write:jira-work` | Link decision record, Code exceptions, retrospective review | Adds a Jira remote link to a Confluence page (`/rest/api/3/issue/{id}/remotelink`), writes the `fourrealities-exception` issue property, and posts a comment for **Request retrospective review**. All writes run as the acting user. FourRealities never writes LedgerSeal or DefinitionGuard data. |
| `read:jira-user` | Names on exception and rework records | Shows the names of the users who requested, approved, rejected or revoked a Code exception, or recorded a rework reason (UI Kit User component, from stored account IDs). |
| `storage:app` | Snapshots, exception events, rework reasons, site settings | Stores daily project snapshots, Code exception events, rework reasons and site configuration in Forge KVS. |
| `search:confluence` | Confluence search in the Link decision record dialog | Searches Confluence pages by title (`/wiki/rest/api/content/search`) on the customer's own Atlassian site, as the user. |
| `read:confluence-content.summary` | Confluence search results | Reads the page title, space and link returned by the search so the user can select a page. |

---

## 2. Architecture & Data Residency Statement

- **Zero External Egress:** The manifest declares no external egress endpoints. FourRealities calls no external (non-Atlassian) APIs.
- **Data Sources:** Pull request data comes from the Jira Development field, which the customer's GitHub, GitLab or Bitbucket integration for Jira populates. FourRealities cannot read pull request approvals. Confluence page search uses the Confluence REST API of the customer's own Atlassian site, as the user, through Forge (`requestConfluence`).
- **Tenant Storage:** Snapshots, exception events, rework reasons and site settings reside in customer Atlassian Forge KVS (`storage:app`).
- **Data Residency:** All data remains within the customer's Atlassian Cloud site.

---

## 3. Test Credentials & Reviewer Environment Guidance

> **Publisher Note for Submission:** Ensure the review instance (`asymmsystems.atlassian.net`) has project `AUDT` populated with test issues `AUDT-1` (gates evaluated, Intent found) and `AUDT-2` (no decision record linked). A Confluence site with at least one page is needed for the search step.

### Sample Test Issues
- **Issue with gates evaluated:** `AUDT-1`.
- **Issue without a decision record:** `AUDT-2`.

---

## 4. Reviewer Test Plan Steps

### Test Step 1: Issue Panel
1. Open issue `AUDT-1`.
2. Find the **Four Realities** issue panel (also available as **Four Realities** in the issue context area on the right).
3. Observe the four gate statuses (Intent, Process, Code, Audit), the next step and the **Refresh** button.
4. Expand **Gate findings** to see each gate with its source, the RAI lozenge and the **Why N%?** button.

### Test Step 2: Link a Confluence Decision Record
1. Open issue `AUDT-2` and find the **Four Realities** panel.
2. Click **Link decision record**.
3. Type at least two characters of a page title in **Search Confluence pages** and click **Search**. Click **Select** on a result. You can also enter a **Page address** and **Page title** by hand.
4. Click **Add link**. The Intent gate updates to evidence found, and a remote link appears under the issue's web links.

### Test Step 3: Project Dashboard
1. In project `AUDT`, open the **Four Realities** project page from the project navigation.
2. Observe Audit readiness, the four gate cards, **Priority actions**, **Coverage at a glance** and **Issue triage** with the Assignee, Sprint and Gate filters.
3. Click **Inspect** on an issue to see its gates. Click **Refresh** to rebuild the snapshot.

---

## 5. Known Review Risks & Technical Mitigations

1. **Development Field:** FourRealities reads pull request count and state from the Jira Development field on the issue. If no development tool is connected, the Code gate shows "Not applicable" and nothing fails.
2. **Confluence Access:** Search runs as the user. If the user cannot search Confluence, the dialog shows "You do not have permission to search Confluence." and the user can still enter a page address by hand.
3. **Third-Party Integrations:** FourRealities does not connect to any server outside Atlassian. All data flows through Jira and Confluence APIs of the customer's own site within Forge.
