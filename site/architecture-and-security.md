# Architecture & Zero-Egress Security

> Enterprise-grade data privacy by design: runs entirely within the customer Atlassian tenant.

This document describes the security architecture, data storage model, and isolation guarantees implemented across the Asymm Systems Jira Governance Suite (**LedgerSeal**, **DefinitionGuard**, **FourRealities**, **CascadePlan**).

---

## 1. The 100% Forge Native Architecture

Most Jira Marketplace apps operate under the legacy **Atlassian Connect** model, requiring vendors to host external application servers, databases, and message queues in AWS, GCP, or Azure. Under Connect, every ticket viewed or edited transmits customer data across the public internet to third-party vendor servers.

The Asymm Systems suite was designed from inception as **100% Atlassian Forge Native**:

```
+-------------------------------------------------------------------------+
|                  CUSTOMER ATLASSIAN CLOUD TENANT                        |
|                                                                         |
|   +-----------------------+              +--------------------------+   |
|   |   Jira Cloud Core     |              |    Atlassian Forge       |   |
|   |                       |              |    Serverless Runtime    |   |
|   |  - Issues & Fields    | <----------> |                          |   |
|   |  - Workflow Engine    |  Local API   |  - LedgerSeal            |   |
|   |  - User Permissions   |              |  - DefinitionGuard       |   |
|   +-----------------------+              |  - FourRealities         |   |
|                                          |  - CascadePlan           |   |
|                                          +--------------------------+   |
|                                                       |                 |
|                                                       v                 |
|                                          +--------------------------+   |
|                                          |  Customer Forge Storage  |   |
|                                          |  - Audit Chains          |   |
|                                          |  - Baselines & Templates |   |
|                                          +--------------------------+   |
+-------------------------------------------------------------------------+
                                     |
                          [ NO EXTERNAL EGRESS ]
                                     |
                                     x (Blocked by Forge Security Sandbox)
```

---

## 2. The Zero-Egress Guarantee

In Atlassian Forge, external network access is blocked by the platform security sandbox unless explicitly declared and justified in the app's `manifest.yml` under `permissions.external.fetch.backend`.

### Verification Proof
Inspect the manifests across all four suite apps:
- `apps/ledgerseal/manifest.yml`: Zero `permissions.external` declarations.
- `apps/definitionguard/manifest.yml`: Zero `permissions.external` declarations.
- `apps/fourrealities/manifest.yml`: Zero `permissions.external` declarations.
- `apps/cascadeplan/manifest.yml`: Zero `permissions.external` declarations.

**Result:** The Forge platform physically blocks any attempt by the suite code to make an outbound HTTP/HTTPS request, open a WebSocket, or connect to an external server. Customer data cannot leak outside Atlassian Cloud.

---

## 3. Storage Architecture: Tenant-Isolated KVS

All persistent state is stored in **Atlassian Forge Key-Value Storage (KVS)**:

- **Isolated Partitioning:** Storage is bound to the customer's installation context (`storage:app`). One Atlassian tenant cannot read, query, or overwrite another tenant's stored data.
- **Data Residency Compliance:** Because data is stored in Atlassian Forge KVS, it automatically inherits the customer's designated Atlassian Cloud data residency region (e.g. EU, US, Germany, Australia, Singapore).
- **Encryption at Rest and in Transit:** Managed directly by Atlassian Cloud using standard AES-256 encryption at rest and TLS 1.3 in transit.

---

## 4. Cryptographic Integrity Mechanics

Where cryptographic attestation is required (such as LedgerSeal approval seals and DefinitionGuard summaries):
1. **Deterministic Canonicalization:** The app serializes fields, comments, and attachments into Canonical JSON (sorted UTF-16 code units, zero whitespace, strict type handling) matching LedgerSeal specification v2.
2. **SHA-256 Snapshot Hashing:** Computes a lowercase hex SHA-256 digest of the canonical bytes.
3. **Ed25519 Digital Signatures:** Signs the attestation payload using asymmetric Ed25519 cryptography.
4. **Offline Open Verification:** Customers can export the evidence JSON and verify it completely offline using our open-source, zero-dependency Node.js verifier.

---

## 5. Why This Eliminates InfoSec Friction

For corporate InfoSec teams, evaluating third-party Jira apps typically requires weeks of vendor risk assessments (SOC 2 reports, penetration test reviews, subprocessor agreements, and data transfer assessments).

Because Asymm Systems has **zero external infrastructure**, your security review is fast-tracked:
- **Zero Third-Party Subprocessors:** Asymm Systems does not store customer data on AWS, GCP, or third-party databases.
- **Zero Ingress / Egress Attack Surface:** There are no open API ports or external webhooks to attack.
- **Atlassian Shared Responsibility:** The security posture is anchored directly in Atlassian's SOC 2, ISO 27001, and FedRAMP certified cloud platform.
