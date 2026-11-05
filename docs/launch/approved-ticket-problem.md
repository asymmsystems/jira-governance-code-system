# Why Jira's Change Log Isn't Change Control: The Approved Ticket Problem

*By the Asymm Systems Engineering & Compliance Research Group*

---

## The Scenario Every Release Manager Knows

It is 10:00 AM on release day.

Jira issue `PAY-1402`, representing a mission-critical update to an automated clearing house payment processing pipeline, reaches the **Approved** workflow state. The Quality Assurance Director and the Lead Security Engineer have conducted an extensive review:
- The specification is unambiguous.
- Test execution logs show 100% automated regression passing.
- The destination database schema migration script has been inspected.
- The compliance requirements for SOC 2 Common Criteria 8.1 and PCI-DSS 6.4 have been satisfied.

Both approvers sign off on the ticket and record their approvals in the workflow. The ticket sits in the release candidate queue, awaiting the scheduled 4:00 PM production deployment window.

At 2:15 PM, a senior engineer on the integration team discovers an edge-case configuration issue while preparing the staging deployment. The database connection timeout in the staging environment threw a transient socket error. Intending to be helpful, the engineer opens `PAY-1402` and updates the issue description, increasing the default database connection pool size from 10 to 50 and changing the failover endpoint hostname to an internal secondary proxy.

At 4:00 PM, the automated deployment pipeline triggers. The deployment script queries Jira's REST API for all tickets marked "Approved" in the current fix version, reads `PAY-1402`, extracts the deployment metadata, deploys the updated configuration, and transitions the ticket to **Done**.

At 4:45 PM, production payment volume surges. The unverified connection pool configuration exhausts available connection handles on the primary database cluster, triggering cascading service degradation across checkout flows.

During the subsequent incident post-mortem and external compliance audit, the auditors ask a deceptively simple question:

> *"Who approved the database pool sizing and proxy hostname changes that were deployed to production at 4:00 PM?"*

The answer is chilling to any compliance officer: **Nobody.**

The ticket had been formally approved at 10:00 AM. But the ticket deployed at 4:00 PM was fundamentally different from the ticket approved six hours earlier. The change log recorded every keystroke, yet Jira permitted the tampered ticket to sail directly into production.

This vulnerability is known as **The Approved Ticket Problem**.

---

## The Fallacy: Equating an Audit Log with Change Control

Many engineering organizations assume that because Atlassian Jira Cloud maintains a detailed issue history log, they have satisfied enterprise change control requirements.

This assumption confuses **forensic logging** with **change enforcement**:

1. **Jira's Change History is Post-Hoc:** When an issue field is modified, Jira records an entry in the issue history: who modified the field, the prior value, the new value, and the timestamp. However, Jira does not evaluate whether that issue was already approved. It does not flag the approval as invalid, nor does it alert the original approvers that the approved baseline was modified.
2. **Jira Cannot Distinguish Between Safe and Unsafe Edits:** To native Jira, correcting a spelling typo in an issue summary is structurally identical to altering an API payload schema, adding a high-risk database migration script, or swapping an artifact download URL.
3. **The Workflow Gate Has No Memory:** Standard Jira workflow validators can check whether an issue has an approval recorded in an approval custom field or whether an issue is assigned to an authorized user. But standard validators cannot answer the cryptographic question: *Is this issue in the exact same state it was in when approval was granted?*

An audit log records what went wrong after an incident occurs. **Change control** prevents the unauthorized change from deploying in the first place.

---

## Why Native Jira Permission Schemes Cannot Solve This

When organizations encounter the Approved Ticket Problem, their first impulse is to tighten Jira permission schemes. However, Jira's native permission architecture creates an intractable dilemma between operational paralysis and security exposure:

### The "All or Nothing" Dilemma
In Jira's permission scheme, the capability to edit issues is governed by the single **Edit Issues** permission:
- If you grant developers **Edit Issues**, they can edit tickets at any point in the workflow, including after formal approvals have been granted.
- If you revoke **Edit Issues** from developers, they cannot log work, cannot add retrospective comments, cannot update sprint estimates, and cannot attach troubleshooting logs to unapproved tickets.

### The Problem with Workflow Property Locks (`jira.issue.editable = false`)
Jira administrators often attempt to freeze approved tickets by placing the workflow property `jira.issue.editable = false` on the "Approved" workflow step.

While this prevents edits while the ticket remains in that step, it introduces severe operational breakdowns:
1. **Total Freezing:** Team members cannot add operational comments, cannot upload deployment release verification screenshots, cannot link related post-release monitoring alerts, and cannot adjust subtask statuses.
2. **Workflow State Duplication:** Maintaining separate "Approved (Locked)", "Deploying", and "Released" workflow states for dozens of project workflows introduces severe administrative maintenance overhead.
3. **API and Integration Failures:** CI/CD build agents and release orchestrators that update build status metadata on tickets fail with HTTP 400 errors when attempting to write to issues in uneditable workflow states.

What engineering organizations actually require is **field-level state integrity**: the capability to allow team collaboration and status progression while mathematically proving that the critical specification has not been altered since sign-off.

---

## The Technical Solution: Deterministic Snapshot Hashing & Cryptographic Seals

To solve the Approved Ticket Problem without locking down Jira, Asymm Systems developed **LedgerSeal**, an Atlassian Forge-native change governance app that applies cryptographic integrity verification to Jira issues.

The core mechanism operates on four mathematical principles:

```
[ Jira Issue State ]
       │
       ▼
1. Canonicalization: Deterministic RFC 8785 JSON normalization
       │
       ▼
2. Snapshot Hash: SHA-256 digest over covered fields, attachments & comments
       │
       ▼
3. Digital Attestation: Ed25519 signature & hash-chained seal in Forge KVS
       │
       ▼
4. Transition Validator: SHA-256(current_state) === SHA-256(sealed_state)
```

### 1. Deterministic JSON Canonicalization (RFC 8785)
A Jira issue is a complex, dynamic object containing nested fields, user objects, markdown formatting, attachment lists, and comment threads.

To compute an unambiguous cryptographic digest, LedgerSeal passes the issue through a deterministic canonicalization engine adhering to RFC 8785 (JSON Canonicalization Scheme). This process:
- Normalizes covered fields (Summary, Description, Issue Type, Components, Fix Versions, and configured Custom Fields).
- Sorts JSON keys lexicographically.
- Normalizes Unicode representations and whitespace.
- Computes SHA-256 hashes of all attached binary files.
- Formats sign-off comments and author identities.

### 2. The SHA-256 State Hash
From the canonical payload, LedgerSeal generates a single 256-bit cryptographic digest representing the precise state of the approved specification:
$$\text{Snapshot Hash} = \text{SHA-256}(\text{CanonicalPayload})$$

If a single character, punctuation mark, or file attachment is modified, the resulting SHA-256 hash diverges completely due to the avalanche effect of cryptographic hash functions.

### 3. Cryptographic Sealing & Chaining
When an authorized approver reviews the ticket:
1. LedgerSeal verifies that the user belongs to the designated Approver Group (enforcing strict separation of duties: the ticket assignee cannot approve their own work).
2. LedgerSeal generates a **Seal Record** containing:
   - The ticket issue key and project ID.
   - The SHA-256 snapshot hash.
   - The approver's Atlassian Account ID and display name.
   - The exact UTC timestamp.
   - The previous seal hash (forming an unbroken cryptographic hash chain).
3. The seal is digitally signed using an Ed25519 private key and committed to Atlassian Forge Key-Value Storage (KVS) within the customer's cloud site.

### 4. The Workflow Transition Gate
The decisive control is the **LedgerSeal Workflow Transition Validator** (`ledgerseal-validator`).

When an issue attempts to transition from "Approved" to "In Deployment" or "Done":
1. The validator dynamically reads the current issue state from Jira's REST API.
2. It canonicalizes the current issue state and recalculates the SHA-256 snapshot hash.
3. It compares the freshly calculated hash against the hash recorded in the active Seal.
4. **If the hashes match:** The ticket is verified intact, and the transition succeeds.
5. **If the hashes differ:** The transition is hard-blocked. A detailed error dialog alerts the user that post-approval tampering has occurred, displaying the exact fields that were modified since sign-off.

The ticket cannot deploy until an authorized approver either reverts the unauthorized modification or reviews the changes and formally reseals the ticket.

---

## Verifiable Compliance: The Offline Open Verifier

In regulated industries (pharmaceutical GxP, medical devices under FDA 21 CFR Part 11, financial infrastructure under SOC 2 CC8.1, and aerospace ISO 27001), auditors cannot simply take an app vendor's word that data was not altered.

If an audit tool operates as a "black box" hosted on a third-party server, auditors must audit the tool itself, creating vendor risk.

LedgerSeal resolves this through an **open-source, zero-dependency offline verification engine**:

1. **Evidence Record:** In the LedgerSeal issue panel, users click **Show evidence (JSON)** and copy the full evidence record into a standalone JSON file (`evidence.json`).
2. **Published Public Keys:** Asymm Systems publishes official Ed25519 verification public keys on public repositories and in documentation.
3. **Standard Tooling Verification:** Anyone can verify the integrity of an approval seal using standard command-line tools without network access or Jira credentials:

```bash
# Verify approval integrity completely offline using Node.js standard library
node verify-evidence.mjs --evidence evidence.json --public-key ls-dev-2026-11.pub.pem
```

The script executes four independent mathematical checks:
1. **Snapshot Hash Verification:** Recalculates the SHA-256 digest of the canonical snapshot payload and matches it against the hash in the attestation.
2. **Chain Continuity Verification:** Validates that every entry in the ticket's history points to its predecessor's hash, starting from the all-zero genesis value, with no gaps in the sequence.
3. **Newest Seal:** Confirms that the attestation names the certificate of the newest seal in the history.
4. **Digital Signature Verification:** Validates the Ed25519 signature over the attestation using the vendor public key.

If all four checks succeed, the script prints four `PASS` lines and exits with code `0`. If any check fails, it prints `FAIL` for that check and exits with code `1`.

---

## Enterprise Compliance Mapping

| Regulatory Standard | Requirement | How LedgerSeal Satisfies the Standard |
| :--- | :--- | :--- |
| **SOC 2 Type II (CC8.1)** | Changes to software, data, and infrastructure are authorized, tested, and approved prior to production release. | Cryptographic seals bind approvals to explicit issue state snapshots. Workflow gates block unapproved or tampered changes from reaching terminal states. |
| **ISO/IEC 27001:2022 (A.8.32)** | Change management rules ensure modifications are documented, verified, and authorized. | Full audit history and hash-chained records prove that deployed tickets were verified by authorized approvers without intervening modifications. |
| **FDA 21 CFR Part 11 (§ 11.10e)** | Time-stamped, tamper-evident audit trails recording the date, time, and operator of record modifications. | Append-only hash chain records actor Atlassian Account ID, UTC timestamp, and signed cryptographic hash in tenant Forge storage. |
| **FDA 21 CFR Part 11 (§ 11.50/70)** | Electronic signatures linked to records to prevent falsification, duplication, or repudiation. | Ed25519 signature binds reviewer identity directly to the specific issue state snapshot digest. |

---

## Conclusion: From Passive Logs to Active Governance

Jira is an exceptional tracking platform, but tracking is not governance. As software systems grow in complexity and regulatory scrutiny intensifies, relying on post-hoc change logs to prove software integrity is an untenable compliance risk.

The Approved Ticket Problem is not solved by adding more administrative meetings, writing longer policy documents, or locking down developer permissions until engineering velocity grinds to a halt.

It is solved by **cryptographic immutability at the workflow transition gate**:
- Developers retain the freedom to collaborate, comment, and adjust non-critical metadata.
- Critical specifications, configurations, and test evidence are cryptographically sealed upon approval.
- The deployment gate permits only verified, untampered tickets to enter production.

Change control should be mathematical, verifiable, and transparent.

---

*For technical documentation, compliance audit guides, and the open-source offline verifier, visit the [Asymm Systems Jira Governance Portal](https://asymm.systems/product/jira-governance/).*
