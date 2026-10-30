# Atlassian Marketplace Listing: LedgerSeal

## App Information
* **Name:** LedgerSeal: Immutable Audit Seal & Compliance Gate
* **Tagline:** Cryptographically seal Jira issues upon approval. Detect post-approval tampering and gate releases.
* **Badges:** Runs on Atlassian | Cloud Fortified | 100% Data Residency Compliant
* **Categories:** Compliance & Auditing, Workflow & Automation, Security

---

## Short Description (Highlight)
Turn Jira into a true compliance System of Record. LedgerSeal computes a cryptographic SHA-256 hash of issue fields and attachments upon sign-off, instantly detects if anyone changes requirements post-approval, and enforces 21 CFR Part 11 electronic signatures on workflow transitions.

---

## Detailed Description

### Why Regulated Teams Need LedgerSeal
In standard Jira, any user with edit permissions can modify ticket descriptions, alter acceptance criteria, change custom fields, or swap attachments *after* approval. For engineering teams subject to SOC 2, ISO 27001, FDA 21 CFR Part 11, or SOX audits, this mutability causes audit findings.

LedgerSeal solves this with zero-egress cryptographic sealing:

### Key Capabilities
1. **Cryptographic State Freeze:**
   When an authorized user signs off on a ticket, LedgerSeal captures a canonical snapshot of all issue fields and attachments, hashes it with SHA-256, and stores an immutable certificate inside Atlassian Forge secure storage.
2. **Instant Tamper Detection & Diff Viewer:**
   If any user modifies a sealed ticket, LedgerSeal displays a prominent `SEAL BROKEN` alert showing exactly which fields or files were altered.
3. **Workflow Transition Validator (Release Gate):**
   Prevent issues from transitioning to "Done", "Released", or "Closed" unless an active, untampered seal exists.
4. **FDA 21 CFR Part 11 & SOX Electronic Signatures:**
   Record signer identity, timestamp, meaning statement, and legal declaration on every sign-off.
5. **Zero External Data Egress:**
   Runs 100% serverless within Atlassian's secure AWS cloud ("Runs on Atlassian"). No external servers, no third-party databases, no data privacy risks.

---

## Pricing Strategy (Monthly per Instance)

LedgerSeal uses Atlassian Cloud's standard tiered pricing:

* **1 to 10 Users:** Free forever (Atlassian Starter Tier)
* **11 to 100 Users:** \$1.50 per user/month (\$15 to \$150/month)
* **101 to 250 Users:** \$1.20 per user/month (\$150 to \$300/month)
* **251 to 1,000 Users:** \$0.90 per user/month (\$300 to \$900/month)
* **1,001+ Users:** Custom Enterprise Tier

*Unit Economics:* Reaching \$10,000/month requires approximately **40 to 55 mid-market and enterprise paying instances**.

---

## Security & Compliance Self-Assessment
* **Data Storage:** Atlassian Forge Key-Value & Entity Storage (hosted entirely by Atlassian).
* **Data Egress:** 0 KB outbound network traffic. The app manifest contains zero external fetch permissions.
* **Authentication:** Atlassian Cloud OAuth 2.0 (3LO) via Forge runtime.
* **Encryption:** AES-256 at rest (Atlassian AWS), TLS 1.3 in transit.
