# Asymm Systems: Uniform Permission Management Standard

- **Status:** Approved Architecture Standard
- **Date:** 2026-11-03
- **Scope:** Uniform authorization, permission checking, admin pages, and in-app guidance across the Asymm Systems Jira Suite (LedgerSeal, FourRealities, DefinitionGuard, CascadePlan).
- **Author:** Fahim Farook

---

## 1. Executive Summary & Core Architectural Invariants

Across the Asymm Systems Jira Suite, governance actions (such as sealing an audit record in LedgerSeal, approving a Code gate exception in FourRealities, baselining acceptance criteria in DefinitionGuard, or locking a delivery baseline in CascadePlan) require strict, verifiable authorization.

To provide a consistent enterprise experience for Jira site administrators and project teams, all four apps adhere to a **Uniform Two-Tier Fail-Closed Authorization Model**.

### Core Invariants:
1. **Zero Escalation:** All permission checks run strictly as the user (`asUser`) against Jira's native permissions API (`/rest/api/3/mypermissions`). The app never escalates to app-level credentials to bypass Jira ACLs.
2. **Fail-Closed Security:** If any Jira permission check or group lookup fails (HTTP 401, 403, 500, rate limit, or network timeout), authorization immediately evaluates to **DENIED**. Access is never granted on error.
3. **Zero External Tokens:** No external IAM systems, API tokens, or OAuth secrets are stored or queried. Authorization relies 100% on Jira's native user, group, and project roles.
4. **Standard Administrative Surface:** Every app declares a native `jira:adminPage` in `manifest.yml`, accessible only to Jira Administrators, allowing designated authority groups to be chosen without modifying Jira global permission schemes.

---

## 2. Navigation, Links, and UI Surfaces

### 2.1 Where Permissions Are Managed (Admin Entry Point)
Administrators configure app permissions through Jira's native administrative navigation:
- **Location:** Jira Settings (Gear icon) -> Apps -> Manage apps -> `[App Name] Permissions` (or Approvers).
- **Forge Module:** Declared as `jira:adminPage` in each app's `manifest.yml`.
- **Route Titles & Keys:**
  - **LedgerSeal:** Module key `ledgerseal-admin`, title `LedgerSeal approvers`
  - **FourRealities:** Module key `fourrealities-admin`, title `FourRealities gate authority`
  - **DefinitionGuard:** Module key `definitionguard-admin`, title `DefinitionGuard approvers`
  - **CascadePlan:** Module key `cascadeplan-admin`, title `CascadePlan approvers`

### 2.2 Access Control on the Admin Page
The admin configuration page is strictly restricted to Jira Administrators holding the global `ADMINISTER` permission.
- **Server-Side Enforcement:** Every resolver call (`getPolicy`, `searchGroups`, `setPolicy`) invokes `isJiraAdmin()` (`GET /rest/api/3/mypermissions?permissions=ADMINISTER` as user). If not granted, the resolver fails closed with `NOT_ADMIN`.
- **Frontend Presentation:** If a non-administrator attempts to load the page, UI Kit renders an informational `SectionMessage` stating:
  *"[App Name]: you do not have permission to view or manage authorization settings. Contact your Jira site administrator."*

### 2.3 Contextual In-App Guidance (Issue Panels & Dashboards)
On issue panels and project dashboards, users see clear contextual cues regarding authorization:
- **Authorized Users:** The primary action button (e.g., "Approve exception", "Seal issue", "Baseline DoD") is enabled and clickable.
- **Unauthorized Users:** The action button is either disabled with a subtle explanatory tooltip, or accompanied by an informational note:
  *"Requires Project Admin, Jira Admin, or membership in an authorized group. Configured by your Jira administrator in Jira Settings > Apps > [App Name]."*
- **Audit Line:** The panel displays the group names authorized to act (e.g., *"Authorized approvers: release-managers, security-leads, and project administrators."*).

---

## 3. Two-Tier Authorization Model

Every privileged operation across the suite evaluates authorization in two sequential steps:

```
                  [User attempts privileged action]
                                  │
                                  ▼
             [Step 1: Does user hold ADMINISTER or ADMINISTER_PROJECTS?]
                                  │
                   ┌──────────────┴──────────────┐
                  YES                            NO
                   │                             │
                   ▼                             ▼
            [ACCESS GRANTED]        [Step 2: Is user in designated group?]
                                                 │
                                  ┌──────────────┴──────────────┐
                                 YES                            NO / ERROR
                                  │                             │
                                  ▼                             ▼
                           [ACCESS GRANTED]              [ACCESS DENIED]
```

### Tier 1: Built-In Administrative Roles (Always Permitted)
Any user holding either of the following standard Jira permissions is automatically authorized:
- **Jira Global Administrator:** `ADMINISTER` permission.
- **Project Administrator:** `ADMINISTER_PROJECTS` permission on the issue's project.

Checked dynamically via Jira REST API:
`GET /rest/api/3/mypermissions?issueId=${issueId}&permissions=ADMINISTER_PROJECTS,ADMINISTER` (run as the caller).

### Tier 2: Designated Authority Groups (Configurable Policy)
For enterprises where technical leads, compliance officers, or release managers must approve actions without holding broad Jira project administration rights:
- A Jira Administrator selects up to 20 Jira user groups in the app's `jira:adminPage`.
- The selection is stored in Forge KVS storage under key `[appPrefix]:cfg:approver_policy`.
- When a non-administrator attempts an action, the app reads the user's groups via:
  `GET /rest/api/3/myself?expand=groups` (run as the caller).
- If the caller belongs to any configured group, access is granted.

---

## 4. Suite Authorization Matrix

| App | Privileged Operations | Policy Role ID | Default Authorized Roles | Typical Configurable Groups |
| :--- | :--- | :--- | :--- | :--- |
| **LedgerSeal** | Seal issue, reseal issue, revoke seal | `LS_APPROVER` | Jira Admin, Project Admin | `qa-leads`, `compliance-officers`, `security-auditors` |
| **FourRealities** | Decide Code exceptions (Approve, Reject, Revoke), override gate thresholds | `FR_APPROVER` | Jira Admin, Project Admin | `architecture-board`, `release-managers`, `tech-leads` |
| **DefinitionGuard** | Baseline criteria, sign off Definition of Done, authorize deviations | `DG_APPROVER` | Jira Admin, Project Admin | `product-owners`, `business-analysts`, `lead-architects` |
| **CascadePlan** | Freeze delivery baseline, approve milestone variance / shift | `CP_APPROVER` | Jira Admin, Project Admin | `program-managers`, `pmo-directors`, `delivery-leads` |

---

## 5. Manifest & Scope Requirements

Every app in the suite requires exactly the following four scopes in `manifest.yml`:

```yaml
permissions:
  scopes:
    - read:jira-work     # Read issue details, project permissions, and changelogs
    - write:jira-work    # Write issue properties, comments, and remote links
    - read:jira-user    # Read myself groups (/rest/api/3/myself?expand=groups) and search groups (/rest/api/3/groups/picker)
    - storage:app       # Store policy in Forge KVS storage
```

**Security Invariant:** Manifest contains zero external network declarations (`external:`, `fetch:`, `endpoints:`).

---

## 6. Shared Monorepo Package Integration (`@asymm/jira-ui`)

To eliminate code duplication across sibling apps, the shared monorepo package `@asymm/jira-ui` exports the complete admin page layout and pure view model:

- **Location:** `packages/asymm-jira-ui/src/admin.tsx`
- **Exports:**
  - `AdminPolicyPanel`: React component rendering the card-based admin page using Forge UI Kit.
  - `buildAdminPolicyView`: Pure state builder handling `LOADING`, `ERROR`, `NOT_ADMIN`, and `READY` states.
  - `savedGroups`, `addGroup`, `removeGroup`: Immutable group selection utilities.
  - `formatPolicySummary`: Formatter generating natural language policy descriptions.

### Sibling App Adoption Example (`src/frontend/admin.tsx`):
```tsx
import React, { useState, useEffect } from 'react';
import ForgeReconciler from '@forge/react';
import { invoke } from '@forge/bridge';
import { AdminPolicyPanel, buildAdminPolicyView, GroupChoice, savedGroups } from '@asymm/jira-ui';

export const AppAdmin: React.FC = () => {
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState<GroupChoice[]>([]);
  const [results, setResults] = useState<GroupChoice[]>([]);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load policy on mount
  useEffect(() => {
    invoke('authority-policy-get', {}).then((r: any) => {
      setResponse(r);
      setChosen(savedGroups(r));
      setLoading(false);
    });
  }, []);

  const view = buildAdminPolicyView({ loading, response, chosen, results, appName: 'FourRealities' });

  return (
    <AdminPolicyPanel
      appName="FourRealities"
      roleTitle="Gate approver groups"
      roleDescription="approve Code exceptions and gate overrides"
      view={view}
      saving={saving}
      notice={notice}
      onSearchChange={setQuery}
      onSearch={async () => {
        const res: any = await invoke('authority-group-search', { query });
        if (res?.ok) setResults(res.groups);
      }}
      onAddGroup={g => setChosen(prev => [...prev, g])}
      onRemoveGroup={id => setChosen(prev => prev.filter(g => g.groupId !== id))}
      onSave={async () => {
        setSaving(true);
        const res: any = await invoke('authority-policy-set', { groupIds: chosen.map(g => g.groupId) });
        if (res?.ok) setNotice('Saved.');
        setSaving(false);
      }}
    />
  );
};
```
