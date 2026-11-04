# LedgerSeal: Tamper-Evident Approval Seals for Jira

> Cryptographic approval seals, post-approval change control, and offline evidence verification.

LedgerSeal provides cryptographic proof that the exact ticket content deployed to production is identical to what engineering leadership and compliance officers approved.

---

## The Approved Ticket Problem

In standard Jira workflows, a ticket can be approved by release managers at 10:00 AM, edited by a developer at 2:00 PM (changing requirements, environment flags, or acceptance criteria), and moved to **Done** at 4:00 PM without re-review. Jira change logs record edits, but standard Jira workflows cannot prevent unapproved changes from advancing to production.

```
10:00 AM                  02:00 PM                   04:00 PM
[ Approved by Lead ] ---> [ Ticket Description  ] -> [ Moved to Done & Released ]
                          [ Silently Modified   ]
                          ^
                          | LedgerSeal Detects Hash Mismatch
                          | Blocks Transition at Workflow Gate
```

---

## How LedgerSeal Works

1. **Canonical Snapshot Hashing:** When an authorized approver seals a ticket, LedgerSeal serializes covered fields, comments, and attachments into Canonical JSON and computes a cryptographic SHA-256 snapshot hash.
2. **Ed25519 Digital Signatures:** LedgerSeal generates a tamper-evident attestation certificate signed with an Ed25519 private key.
3. **Continuous Tamper Detection:** When any covered field or attachment is edited post-approval, LedgerSeal immediately detects the SHA-256 hash mismatch and updates the issue panel to amber `[CHANGED]` or red `[COMPROMISED]`.
4. **Automated Transition Gate:** The LedgerSeal workflow transition validator blocks issues from moving to Done status if unsealed, broken, or tampered with.
5. **Open Offline Verifier:** Anyone can export the evidence JSON and verify the SHA-256 hash, history chain, and Ed25519 signature offline using our open-source verifier.

---

## Visual Tour

![LedgerSeal Issue Panel](/assets/ledgerseal/01-sealed-panel.png)

*Figure 1: Issue panel in verified `[SEALED]` state showing SHA-256 snapshot hash, approver account, and attestation certificate.*

---

## Documentation Sections

- [Admin Guide](./admin-guide) - Configuring approver groups and workflow transition validators.
- [User Guide](./user-guide) - Sealing, resealing, revoking, and viewing post-approval diffs.
- [Compliance Mapping](./compliance-mapping) - SOC 2 CC8.1, ISO 27001 A.8.32, and FDA 21 CFR Part 11 mapping.
- [Offline Open Verifier](./open-verifier) - Using the standalone Node.js offline verification script.
