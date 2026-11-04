# The Uniform Permission Management Standard

> Consistent, auditable role-based access control across all Asymm Systems Jira apps.

The **Uniform Permission Management Standard** establishes a single, predictable permission architecture for configuring approvers, review authorities, and administrative privileges across the Asymm Systems suite (**LedgerSeal**, **DefinitionGuard**, **FourRealities**, **PlanShift**).

---

## 1. Principles of the Standard

1. **Jira-Native Groups:** Permissions are granted to standard Jira user groups (e.g. `jira-administrators`, `release-managers`, `tech-leads`), not hardcoded user lists or proprietary external directories.
2. **Deterministic Fallback:** If an administrator has not configured a custom group policy, authority defaults safely to `jira-administrators` and project administrators.
3. **Audited Changes:** Every update to an approver policy records who made the change, when, and the previous policy in a tamper-evident audit log.
4. **Separation of Duties:** Enforces that ticket editors cannot approve their own changes or sign off on their own peer reviews, regardless of group membership.

---

## 2. Policy Storage Data Model

Each app persists its permission configuration in Forge KVS using a standardized data structure:

```typescript
export interface ApproverPolicy {
  roleTypeId: 'LS_APPROVER' | 'DG_APPROVER' | 'PS_APPROVER' | 'FR_APPROVER';
  parties: Array<{
    partyId: string;
    partyTypeId: 'GROUP';
    name: string;
  }>;
  fromDate: string;     // ISO 8601 timestamp
  setByPartyId: string; // Atlassian accountId of administrator
}
```

### Storage Keys
- LedgerSeal: `ledgerseal:cfg:approver_policy`
- DefinitionGuard: `definitionguard:cfg:approver_policy`
- PlanShift: `cascadeplan:cfg:approver_policy` (or `planshift:cfg:approver_policy`)
- FourRealities: `fourrealities:cfg:approver_policy`

---

## 3. Administrative Interface (`jira:adminPage`)

Administrators configure authorized approver groups via dedicated settings pages located under **Jira Settings** -> **Apps**:

- **LedgerSeal:** `LedgerSeal approvers`
- **DefinitionGuard:** `DefinitionGuard approvers`
- **PlanShift:** `PlanShift approvers`
- **FourRealities:** `FourRealities approvers`

### Configuration Workflow
1. Navigate to the app admin page.
2. Type 2 or more characters into the group search input.
3. Select authorized Jira groups from the real-time search results.
4. Click **Save Policy**.
5. The interface immediately validates that the current user has Jira administration privileges and commits the change.

---

## 4. Enforcement Mechanics in Action

| App | Controlled Action | Enforcement Rule |
|---|---|---|
| **LedgerSeal** | Sealing, Resealing, or Revoking an Issue | User must belong to an authorized approver group. User must NOT be the author of the most recent ticket change. |
| **DefinitionGuard** | Granting an Audited Waiver | User must have waiver authority. User must enter an obligatory justification comment. |
| **PlanShift** | Freezing a Baseline or Approving a Scope Shift | User must belong to the authorized baseline authority group. |
| **FourRealities** | Overriding an Architectural Drift Alert | User must belong to the authorized architecture decision group. |
