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
| `read:jira-work` | Checks, project dashboard, permission checks | Reads issues (fields, changelog, issue properties, remote links, issue links), the Jira Development field for pull request count and state, statuses, fields, server info, a JQL probe for pull request data (`development[pullrequests].all > 0`), and the user's permissions (`/rest/api/3/mypermissions`). |
| `write:jira-work` | Link decision record, Code exceptions, retrospective review | Adds a Jira remote link to a Confluence page (`/rest/api/3/issue/{id}/remotelink`) as the user, writes the `fourrealities-exception` issue property (as the user for a request, a rework reason or a withdrawal; as the app after an approver's decision has passed the approver check), and posts a comment for **Request retrospective review** as the user. FourRealities never writes LedgerSeal or DefinitionGuard data. |
| `read:jira-user` | Names, approver groups | Reads the caller's groups for the approver check (`/rest/api/3/myself?expand=groups`), searches and names groups on the admin page (`/rest/api/3/groups/picker`, `/rest/api/3/group/bulk`), and reads assignee display names for the dashboard (`/rest/api/3/user/bulk`); names are shown, never stored. The UI Kit User component shows the people on exception and rework records. |
| `storage:app` | Snapshots, exception events, rework reasons, settings | Stores daily project snapshots, Code exception events, rework reasons, the admin settings, the approver groups and the dates sources were first detected, in Forge KVS. |
| `search:confluence` | Confluence search and page check | Searches Confluence pages by title in the Link decision record dialog, as the user, and checks by page id that a linked page exists (CQL `id in (...)` on `/wiki/rest/api/content/search`). |
| `read:confluence-content.summary` | Confluence search results | Reads the page id, title, space and link returned by the search. |
| `report:personal-data` | Personal data reporting | A weekly scheduled trigger reports every stored account id with Forge's personal data reporting API and erases the ids of closed accounts. |

---

## 2. Architecture & Data Residency Statement

- **Zero External Egress:** The manifest declares no external egress endpoints. FourRealities calls no external (non-Atlassian) APIs.
- **Data Sources:** Pull request data comes from the Jira Development field, which the customer's GitHub, GitLab or Bitbucket integration for Jira populates. FourRealities cannot read pull request approvals. Confluence search and the page check use the Confluence REST API of the customer's own Atlassian site through Forge (`requestConfluence`).
- **Signed records:** The records of DefinitionGuard and LedgerSeal are checked with Ed25519 public keys bundled in the app (`src/accessor/attestation-keys.ts`); no key is fetched from anywhere.
- **Tenant Storage:** Snapshots, exception events, rework reasons and settings reside in Forge KVS (`storage:app`).
- **Personal data:** Account ids only where a rule needs them; no names stored; weekly report and erasure (`report:personal-data`).

---

## 3. Reviewer Environment

Install FourRealities on your own review site; nothing depends on the publisher's site. The steps use any Jira project with a few issues, one of them in a Done status. A Confluence page on the same site is needed for step 3. FourRealities needs no other app. DefinitionGuard, LedgerSeal, Checklists for Jira and a Git integration are optional; without them the Process, Audit and Code checks show "Not used on this site".

---

## 4. Reviewer Test Plan Steps

### Test Step 1: Admin page
1. Go to **Jira settings > Apps > FourRealities gate authority** (Jira administrators only).
2. Observe the evidence source of each check (Intent, Process, Code, Audit), what was detected on the site, the decision issue types and the approver groups. Leave the defaults and click **Save evidence sources**.

### Test Step 2: Issue Panel
1. Open a Done issue and open **Four Realities** from the issue's app actions (also available as **Four Realities** in the issue context area on the right).
2. Observe the four checks as a chain, the next step and the **Refresh** button. On a site without the optional apps, Process and Audit show "Not used on this site".
3. Expand **Gate findings** to see each check with its source, the RAI and **Why N%?**.

### Test Step 3: Link a Confluence Decision Record
1. On an issue whose Intent shows "Evidence missing", click **Link decision record**.
2. Click **Search Confluence...**, type at least two characters of a page title in **Search Confluence pages** and click **Search**. Click **Select** on a result. You can also enter a **Page address** and **Page title** by hand.
3. Click **Add link**. The message says "Link added. Intent: Evidence found." and a remote link appears under the issue's web links.

### Test Step 4: Project Dashboard
1. In the same project, open **Four Realities** from the project navigation.
2. Observe Audit readiness, the four check cards, the checks in use, **Priority actions**, **Coverage at a glance** and **Issue triage** with its filters.
3. Click **Inspect** on an issue to see its checks. Click **Refresh** to rebuild the snapshot.

---

## 5. Known Review Risks & Technical Mitigations

1. **Development Field:** Jira Software sites have a Development field even without a Git integration. FourRealities uses the Code check only when pull request data exists on the site (or an administrator turns it on); otherwise Code shows "Not used on this site". On a site with no Development field at all, Code shows "No development tool is connected to this site."
2. **Confluence Access:** Search runs as the user. If Confluence refuses the search, the dialog says "Confluence refused the search (HTTP n). Either you cannot search Confluence, or FourRealities has no access to Confluence on this site. You can still enter the page address and title by hand." A link whose page cannot be checked shows "Evidence found (link only)".
3. **Third-Party Integrations:** FourRealities does not connect to any server outside Atlassian.
