# LedgerSeal User Guide

This guide describes how to seal Jira issues, view post-approval change diffs, reseal modified tickets with recorded justifications, and export audit evidence for compliance reviews.

---

## 1. Sealing an Issue

1. Open the Jira issue you wish to approve.
2. In the right issue panel sidebar, locate the **LedgerSeal Audit Gate** panel.
3. Review the covered fields listed under the panel (Summary, Description, Acceptance Criteria, Attachments).
4. Click **Seal Issue**.
5. Select the declaration meaning (e.g. `Approved for Release`, `Reviewed`, `Verified`).
6. Click **Confirm & Seal**.

The panel immediately transitions to green `[SEALED]`, displaying the approver account ID, timestamp, and unique certificate ID.

---

## 2. Detecting Post-Approval Modifications

If any user edits a covered field, posts a comment, or updates an attachment after the seal is applied:
1. The LedgerSeal issue panel lozenge immediately changes to amber `[CHANGED]` or red `[COMPROMISED]`.
2. The panel displays:
   - Name of the modified field (e.g. `description`, `summary`).
   - The user who made the edit.
   - The exact timestamp of the modification.
   - A diff view comparing the approved snapshot against the current ticket state.

![Tamper Detection](/assets/ledgerseal/02-tamper-detected.png)

*Figure: Tamper detection alert attributing post-approval edits.*

---

## 3. Resealing with Justification

When post-approval changes are intentional and legitimate:
1. An authorized approver (who was **not** the author of the edit) reviews the diff.
2. Click **Reseal Issue**.
3. In the justification text box, enter an obligatory explanation for the change (e.g. `Approved updated environment configuration per CAB review`).
4. Click **Confirm Reseal**.
5. LedgerSeal records a new seal in the hash-chained history, linking the previous seal, the change incident, and the reseal event.

---

## 4. Exporting Audit Evidence (JSON)

For SOC 2, ISO 27001, or FDA auditors:
1. In the LedgerSeal issue panel, click **Show details** to open the certificate view.
2. Click **Export Audit Evidence (JSON)**.
3. Save the JSON evidence file locally.
4. The exported file contains the canonical snapshot, the complete hash chain history, and the Ed25519 digital signature.

![Certificate View](/assets/ledgerseal/05-certificate.png)

*Figure: Cryptographic attestation certificate and evidence export view.*
