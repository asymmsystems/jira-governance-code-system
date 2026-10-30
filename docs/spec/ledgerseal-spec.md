# LedgerSeal: Technical Specification and Architecture Contract
**Product:** LedgerSeal - Immutable Audit Seal & Sign-Off Gate for Jira
**Platform:** Atlassian Forge (Cloud-Native, "Runs on Atlassian")
**Version:** 1.0.0-draft
**Status:** In Review (Loop 1: Specification & Contract Loop)

---

## 1. Executive Summary

Native Jira is a mutable system. Any user with edit permissions can modify issue descriptions, custom fields, acceptance criteria, or attached files after a ticket is marked "Approved" or "Done". This violates fundamental audit and compliance requirements in regulated industries (SOC 2, ISO 27001, FDA 21 CFR Part 11, and Sarbanes-Oxley).

**LedgerSeal** transforms Jira into an audit-grade **System of Record (SoR)**. It allows authorized users to electronically sign and cryptographically seal a Jira issue. Any modification to the issue post-approval breaks the cryptographic seal, immediately notifying auditors and project leads.

---

## 2. Core Architectural Invariants

* **Invariant 1 (Zero External Egress):** 100% of data processing, cryptographic hashing, and certificate storage executes within Atlassian's secure AWS multi-tenant cloud via Forge serverless functions. No customer data or issue content ever leaves Atlassian infrastructure.
* **Invariant 2 (Deterministic Canonicalization):** Given identical issue field values, attachments, and approver details, the canonical serialization function must produce byte-for-byte identical output across all environments:
  $$\text{SHA256}(\text{Canonicalize}(\text{IssueState}_A)) = \text{SHA256}(\text{Canonicalize}(\text{IssueState}_B)) \iff \text{IssueState}_A \equiv \text{IssueState}_B$$
* **Invariant 3 (Immutability of Sealed Certificates):** Once a seal certificate is written to Forge storage, it cannot be overwritten or modified in-place. Resealing an issue appends to an append-only audit history log.
* **Invariant 4 (Least Privilege Scopes):** The app requests only `read:jira-work` and `storage:app`. It never requests write access to user issues or external network egress (`no external domains in manifest`).

---

## 3. Domain Model and Data Structures

### 3.1. Canonical Issue Snapshot (`CanonicalIssueSnapshot`)
Captures the complete state of a Jira issue to be sealed:

```typescript
export interface CanonicalField {
  id: string;              // e.g., "summary", "description", "customfield_10014"
  name: string;            // Human-readable field name
  type: string;            // "string", "number", "array", "object"
  value: any;              // Canonicalized JSON value
}

export interface CanonicalAttachment {
  id: string;              // Jira attachment ID
  filename: string;        // Filename
  size: number;            // File size in bytes
  created: string;         // ISO-8601 timestamp
  authorAccountId: string; // Account ID of uploader
}

export interface CanonicalIssueSnapshot {
  issueId: string;
  issueKey: string;
  projectKey: string;
  issueType: string;
  status: string;
  fields: CanonicalField[];       // Sorted deterministically by field id
  attachments: CanonicalAttachment[]; // Sorted deterministically by attachment id
  capturedAt: string;            // ISO-8601 UTC timestamp of snapshot
}
```

### 3.2. Electronic Signature (`ElectronicSignature`)
Compliant with FDA 21 CFR Part 11 and SOX sign-off mandates:

```typescript
export interface ElectronicSignature {
  signerAccountId: string;       // Atlassian Account ID
  signerDisplayName: string;     // Full name of signer
  signerEmail?: string;          // Email (if permitted by privacy settings)
  signedAt: string;              // ISO-8601 UTC timestamp
  meaning: string;               // e.g., "I approve this change for production deployment"
  reasonCode: 'APPROVAL' | 'REVIEW' | 'VERIFICATION' | 'RELEASE_GATE';
  declarationText: string;       // Legal sign-off statement agreed to by user
}
```

### 3.3. Seal Certificate (`SealCertificate`)
The permanent cryptographic record stored in Forge Storage:

```typescript
export interface SealCertificate {
  certificateId: string;         // UUIDv4
  issueId: string;
  issueKey: string;
  snapshotHash: string;          // Hex-encoded SHA-256 of CanonicalIssueSnapshot
  certificateHash: string;       // Hex-encoded SHA-256 of (snapshotHash + signature + salt)
  algorithm: 'SHA-256';
  schemaVersion: '1.0';
  sealedAt: string;              // ISO-8601 UTC timestamp
  sealedBy: ElectronicSignature;
  snapshot: CanonicalIssueSnapshot;
  status: 'ACTIVE' | 'SUPERSEDED' | 'REVOKED';
  revocation?: {
    revokedAt: string;
    revokedByAccountId: string;
    revocationReason: string;
  };
}
```

### 3.4. Verification and Tamper Result (`TamperAnalysis`)

```typescript
export interface FieldDiff {
  fieldId: string;
  fieldName: string;
  sealedValue: any;
  liveValue: any;
}

export interface AttachmentDiff {
  type: 'ADDED' | 'REMOVED' | 'MODIFIED';
  attachmentId: string;
  filename: string;
}

export interface TamperAnalysis {
  status: 'SEAL_VALID' | 'SEAL_BROKEN' | 'NO_SEAL' | 'SEAL_REVOKED';
  certificate?: SealCertificate;
  liveHash?: string;
  sealedHash?: string;
  tamperedFields: FieldDiff[];
  tamperedAttachments: AttachmentDiff[];
  verifiedAt: string;
}
```

---

## 4. Deterministic Canonicalization Algorithm

To ensure stable SHA-256 hashing across platforms and runtime versions, the snapshot normalization must adhere to:

1. **Key Sorting:** All JSON object keys must be sorted lexicographically by Unicode code point at all nesting levels.
2. **Whitespace Normalization:** Strings in text fields have trailing whitespace trimmed, and newline sequences (`\r\n` or `\r`) normalized to standard `\n`.
3. **Empty Values:** Null, undefined, empty strings `""`, and empty arrays `[]` are normalized to a consistent `null` representation to prevent phantom hash changes when Jira schema adds empty fields.
4. **Float / Number Handling:** Numeric fields are formatted as standard IEEE 754 decimal strings without trailing zeros after decimal points.
5. **Array Ordering:** Field arrays with deterministic semantics (e.g. labels, components, attachments) are sorted alphabetically by ID/value before serialization.

---

## 5. Forge App Modules and Manifest

The application declares the following Forge extension points in `manifest.yml`:

```yaml
modules:
  jira:issuePanel:
    - key: ledgerseal-panel
      title: LedgerSeal Compliance Gate
      icon: https://developer.atlassian.com/platform/forge/images/icons/issue-panel.svg
      function: render-issue-panel
  jira:workflowValidator:
    - key: ledgerseal-workflow-validator
      name: Require Valid LedgerSeal
      description: Blocks issue transition if issue is unsealed or has a broken cryptographic seal.
      function: validate-transition
  function:
    - key: render-issue-panel
      handler: index.renderIssuePanel
    - key: validate-transition
      handler: index.validateTransition
    - key: seal-issue-api
      handler: index.sealIssue
    - key: verify-issue-api
      handler: index.verifyIssue

app:
  id: ari:cloud:ecosystem::app/ledgerseal-jira
  runtime:
    name: nodejs20.x

permissions:
  scopes:
    - read:jira-work
    - storage:app
```

---

## 6. Storage Schema (Forge K/V Storage)

Forge Key-Value storage enforces a 32 KB limit per entry. 
To stay strictly within limits:

1. **Active Certificate Key:** `cert:active:issue:{issueId}`
   Stores the current active `SealCertificate`.
2. **Audit History Key:** `cert:history:issue:{issueId}`
   Stores an array of summary pointers (`certificateId`, `sealedAt`, `sealedByAccountId`, `status`). Full historical snapshots are stored individually under `cert:archive:{certificateId}`.
3. **Indexing:** `cert:index:project:{projectKey}`
   Stores an array of sealed issue keys for project-level audit export.

---

## 7. Workflow Transition Validator Logic

When an issue transition is triggered (e.g., transition to "Closed", "Ready for Deployment"):

```
[Issue Transition Triggered]
            |
            v
[Validator: Read cert:active:issue:{issueId}]
            |
   +--------+--------+
   |                 |
(No Seal Found)  (Seal Exists)
   |                 |
   v                 v
[REJECT: "Issue     [Fetch Live Issue Data from Jira API]
 must be sealed"]    |
                     v
             [Canonicalize Live Data]
                     |
                     v
             [Compute Live Hash == Snapshot Hash?]
                     |
           +---------+---------+
           |                   |
        (True)              (False)
           |                   |
           v                   v
     [ALLOW TRANSITION]   [REJECT: "Cryptographic Seal Broken!
                           Fields modified since approval."]
```

---

## 8. Verifiable Audit Certificate Export (PDF/A)

For compliance auditors (SOC 2 / ISO 27001), the app provides a one-click export generating an audit document containing:
1. Certificate ID and timestamp.
2. Signer name, Atlassian Account ID, and recorded legal declaration.
3. Complete table of sealed fields and attachment checksums.
4. Cryptographic SHA-256 seal hash.
5. Independent verification instructions allowing third-party auditors to verify the hash using standard command-line tools (`sha256sum`).

---

## 9. Quality & Verification Gates (Loop Exit Criteria)

To exit Loop 1 and enter Loop 2 (TDD Implementation):
* [x] Specification defines all domain interfaces.
* [x] Canonicalization rules explicitly prevent hash divergence.
* [x] Forge manifest restricts scopes to `read:jira-work` and `storage:app` (zero egress).
* [x] Workflow validator logic defines deterministic pass/fail rules.
* [x] Storage strategy adheres to Forge 32 KB per-item constraints.
