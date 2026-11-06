# LedgerSeal Compliance Mapping

> Mapping LedgerSeal cryptographic controls to SOC 2 Type II, ISO/IEC 27001:2022, and FDA 21 CFR Part 11 standards.

---

## 1. Compliance Matrix

| Regulatory Standard | Control Requirement | LedgerSeal Technical Control | Evidence Provided |
|---|---|---|---|
| **SOC 2 Type II** | **CC8.1:** The entity authorizes, designs, develops or acquires, configures, tests, approves, and implements changes to infrastructure, data, software, and procedures. | Cryptographic approval seals bind approval to content. Workflow validator prevents unapproved releases. | Exported evidence JSON showing SHA-256 snapshot hash, approver account ID, and workflow validator logs. |
| **ISO/IEC 27001:2022** | **Control A.8.32 Change Management:** Changes to information processing facilities and systems shall be subject to change management procedures. | Separation of duties enforcement. Editors cannot approve their own changes. Tamper detection on covered fields. | Hash-chained audit history recording every edit, seal, reseal, and revocation event. |
| **FDA 21 CFR Part 11** | **Section 11.10(e):** Use of secure, computer-generated, time-stamped audit trails to independently record the date and time of operator entries and actions. | Hash-chained history linking each entry to previous entry hash (`prevEntryHash`). | Offline verifier verifies history continuity from genesis (`0000...0000`). |
| **FDA 21 CFR Part 11** | **Section 11.50:** Electronic signature manifestations must contain the printed name of the signer, date/time, and meaning (review, approval, responsibility). | Partly met. Each seal records the date, time and meaning of the signature. The signer's name is shown from their Atlassian account while it exists; after the account is closed, it is shown as a deleted user, so a printed name is not kept in the record. | The seal details in the panel (signer, time, sign-off role); the evidence record names the signer by a pseudonymous token. |
| **FDA 21 CFR Part 11** | **Section 11.70:** Signature linking: Electronic signatures shall be linked to their respective electronic records to ensure signatures cannot be excised, copied, or transferred. | Ed25519 signature signs the canonical hash of the ticket snapshot and attestation metadata. | Ed25519 cryptographic verification against published vendor public key. |

---

## 2. Honest Compliance Boundaries

> **Important Disclaimer:** LedgerSeal provides automated technical enforcement controls. The software itself does not certify your organization. Regulatory compliance is determined by your external auditors based on your company's formal Standard Operating Procedures (SOPs), employee training, and Computerized System Validation (CSV).
