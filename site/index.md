# Asymm Systems Jira Governance Suite

> The Zero-Trust Governance & Change Control Platform for Jira Cloud.

Welcome to the official technical and compliance documentation portal for the **Asymm Systems Jira Governance Suite**: **LedgerSeal**, **DefinitionGuard**, **FourRealities**, and **CascadePlan**.

---

## The Core Problem: Why Native Jira Isn't Change Control

In regulated industries (FinTech, HealthTech, MedTech, and SOC 2 Type II / ISO 27001 organizations), software releases must meet strict compliance and change authorization criteria. 

While Jira Cloud provides issue tracking and audit logs, native Jira fails three critical governance requirements:
1. **The Approved Ticket Problem:** Jira tracks that edits occurred, but native Jira cannot prove whether ticket acceptance criteria or attachments were modified after leadership approval.
2. **The Ungated Done Gate:** Native Definition of Done checklists rely on honor-system tick boxes without mandatory proof, peer-review enforcement, or audited waivers.
3. **The Disjoint Realities:** Confluence specifications, Jira issue statuses, and Git pull requests diverge silently without real-time architectural drift detection.
4. **The Silent Scope Creep:** Sprint commitments expand mid-flight without baseline freezing or formal change approval authority.

---

## The Four Governance Pillars

```
+-----------------------------------------------------------------------------------+
|                        ASYMM SYSTEMS JIRA GOVERNANCE SUITE                        |
+--------------------------+--------------------------------+-----------------------+
| App                      | Primary Function               | Enforcement Gate      |
+--------------------------+--------------------------------+-----------------------+
| LedgerSeal               | Tamper-Evident Approval Seals  | Workflow Transition   |
| DefinitionGuard          | Enforceable Definition of Done | Move-to-Done Gate     |
| FourRealities            | Multi-Perspective Alignment    | Reality Alignment     |
| CascadePlan              | Sprint Baseline Control        | Shift Approval Flow   |
+--------------------------+--------------------------------+-----------------------+
```

### 1. LedgerSeal
Cryptographic approval seals and post-approval change control. Computes SHA-256 snapshot hashes of covered fields, comments, and attachments, records Ed25519 digital signatures, and blocks unapproved releases at Jira workflow transition gates. Includes an open-source offline verifier.

### 2. DefinitionGuard
Workflow-enforced Definition of Done (DoD). Enforces per-issue-type DoD criteria, mandatory URL evidence links, non-assignee peer review sign-offs, and audited waiver reasons before issues can transition into Done.

### 3. FourRealities
Cross-reality delivery integrity dashboard. Audits delivery alignment across four distinct perspectives: Intent (Confluence ADRs), Process (Jira Workflows), Code (Git PRs), and Audit (Logs), computing an objective Reality Alignment Index (RAI).

### 4. CascadePlan
Visual sprint baseline control and scope governance. Freezes commitment snapshots at sprint planning, tracks commitment variance and scope creep (+%), and enforces formal shift approval authorities under the Uniform Permission Standard.

---

## The Zero-Egress Architecture Guarantee

Every app in the Asymm Systems suite is **100% Atlassian Forge Native**:
- **Zero External Egress:** Declares zero external egress endpoints. No ticket data, employee names, or code snippets ever leave your Atlassian tenant.
- **Tenant Data Residency:** All data is persisted exclusively in Atlassian Forge Key-Value Storage (KVS) within your designated Cloud region.
- **No Third-Party AI Inference:** All cryptographic hashing, verification algorithms, and scoring execute deterministically on local Forge compute.

---

## Next Steps

- [5-Minute Quickstart Guide](./quickstart) - Install and evaluate any suite app in under 5 minutes.
- [Architecture & Zero-Egress Security](./architecture-and-security) - Deep dive into Forge isolation and tenant data storage.
- [Vendor Security Assessment (CAIQ)](./vendor-security-assessment) - Pre-filled security review answers for enterprise InfoSec teams.
