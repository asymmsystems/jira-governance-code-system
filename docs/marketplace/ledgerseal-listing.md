# Atlassian Marketplace Listing: LedgerSeal

## App Information
* **App Title:** LedgerSeal
* **Tagline:** Tamper-evident approval seals and post-approval change control for Jira.
* **Categories:** Security, Workflow & Automation, Project Management

---

## Short Highlight Description (Max 250 chars)
Seal Jira issues at approval with a SHA-256 snapshot. LedgerSeal detects edits made after approval, names who changed what, blocks moves with a workflow validator, and shows evidence you can check with an offline verifier. (222 characters)

---

## The Unaddressed Native Problem

Standard Jira records when issue changes happen in its change history, but native Jira workflows cannot show whether an approved ticket stayed the same before release.

Consider the standard release trap:
1. At 10:00 AM, QA and compliance leadership formally approve ticket `DEMO-101` for production deployment.
2. At 2:00 PM, a developer edits the ticket description, modifies acceptance criteria, or changes an attached configuration script.
3. At 4:00 PM, the ticket moves cleanly to **Done** and deploys to production.

Standard Jira permission schemes cannot prevent this without locking the entire project into read-only mode, which breaks active sprint execution. Jira's history shows an edit occurred, but native Jira does not answer the auditor's question: **"Is the ticket that reached Done the same ticket that was approved?"**

LedgerSeal addresses this by binding the approval to the issue content with a SHA-256 snapshot hash, a tamper-evident seal history, a workflow transition validator, and an offline verifier.

---

## Key Capabilities & Verifiable Proof

| Capability | Underlying Mechanism | Verifiable Proof in Code & Tests |
|---|---|---|
| **Content Snapshot** | Computes a SHA-256 digest over the canonical JSON of covered fields, comments, and attachments. Comments and work logs restricted to a project role or group are covered only when Jira lets the LedgerSeal app read them, that is when the app's user is in that role or group; otherwise a change to such a comment or work log is not detected. A covered comment that is restricted, at the seal or now, is shown in the panel only to a user who can see it in Jira; others see that a comment changed, without its text, author or time. The panel shows only the number of work logs, never their text. The evidence is exported only to a user who can see every such comment and work log. If LedgerSeal can no longer read a covered comment or work log (it was deleted, or restricted since to a role or group the app's user is not in), the panel shows that comment's sealed text to no one, and for that seal: its evidence is not exported to anyone; approving the changes makes a new seal whose evidence can be exported. | `apps/ledgerseal/src/domain/canonicalizer.ts`, `apps/ledgerseal/test/canonicalizer.test.ts` |
| **Always-Visible Seal State** | An "Approval seal" entry in the details column of every issue shows the seal state (SEALED, CHANGED, REVOKED, NOT SEALED) without opening the panel, and points to the Approval Seal panel for every action. | `apps/ledgerseal/src/frontend/context.tsx`, `apps/ledgerseal/test/context-entry.test.ts` |
| **Post-Approval Change Detection** | Detects changes through issue, comment, attachment, and work log events and when the panel loads. The panel lists each changed item with its value at approval, its current value, and who changed it. | `apps/ledgerseal/src/domain/tamper-detector.ts`, `apps/ledgerseal/src/service/ledger.ts`, `apps/ledgerseal/test/tamper-detector.test.ts` |
| **Separation of Duties** | A user who changed the issue's covered content after the last seal cannot approve those changes, revoke the seal, or seal it again after another approver revokes it. Covered changes are edits of covered fields (from Jira's change log), comments and work logs the user added or edited, and attachments the user added. A status move, Rank or Sprint change does not count. Jira does not record who deleted a comment or a work log, so a deletion cannot be attributed. | `apps/ledgerseal/src/domain/policy.ts`, `apps/ledgerseal/src/service/ledger.ts`, `apps/ledgerseal/test/separation-of-duties.test.ts` |
| **Tamper-Evident History Chain** | Hash-chained history starting from a genesis hash of 64 zeros. Every seal, detected change, approval of changes, and revocation is linked to the entry before it. | `apps/ledgerseal/src/domain/history.ts`, `apps/ledgerseal/test/seal-history.test.ts` |
| **Workflow Transition Gate** | The **Require Valid LedgerSeal** workflow validator blocks the transition when the issue is not sealed, was changed after approval, or the seal was revoked. It also blocks when Jira cannot be read. | `apps/ledgerseal/src/validator/workflow-validator.ts`, `apps/ledgerseal/src/index.ts`, `apps/ledgerseal/test/workflow-validator.test.ts` |
| **Ed25519 Signed Attestation** | Every seal attestation and evidence export is signed with Ed25519 by the Asymm Systems signing key of the app's production environment (`ls-prod-2026-11`, public key in the open verifier repository). Asymm Systems holds the private key, so a valid signature shows that LedgerSeal wrote the attestation; it does not protect against the vendor. If a key were ever missing, the panel shows a warning and the evidence is marked unsigned. | `apps/ledgerseal/src/domain/attestation.ts`, `apps/ledgerseal/test/attestation.test.ts`, `apps/ledgerseal/test/panel-notes.test.ts` |
| **Approver Groups Admin Page** | Jira administrators choose the Jira groups whose members may seal, approve changes, and revoke. Project administrators and Jira administrators always may. | `apps/ledgerseal/src/frontend/admin.tsx`, `apps/ledgerseal/src/service/policy-admin.ts`, `apps/ledgerseal/test/approver-policy.test.ts` |
| **Offline Verifier** | Open-source (Apache-2.0) Node.js script, https://github.com/asymmsystems/jira-governance-code-cli, that checks an evidence record offline with the Node standard library only: the snapshot hash, the history chain, the newest seal, the seal status and the signature. Exit code 0 when every check passes, 1 when a check fails, 2 for a usage error or a missing file. A pass shows the record was not changed after export and was signed with the published key; it does not show that nobody could have written a different, consistent record. | https://github.com/asymmsystems/jira-governance-code-cli (`verify-evidence.mjs`, `test/verify.test.mjs`) |
| **Personal Data** | Seal records name people by a pseudonymous party token (a keyed hash of the account id), not by account id; the issue property holds no account id. The app keeps the account id in one link record per person who sealed, revoked or changed a sealed issue, and keeps the account id of the Jira administrator who last saved the approver groups. It reports these account ids to Atlassian every week; when Atlassian reports an account as closed, it deletes the link from the token to the account and the administrator id. No email address and no display name is stored. | `architecture/decision/adr-00011-ledgerseal-personal-data.org`, `apps/ledgerseal/src/storage/party-repository.ts`, `apps/ledgerseal/src/service/policy-admin.ts`, `apps/ledgerseal/src/service/personal-data.ts`, `apps/ledgerseal/test/personal-data.test.ts` |

---

## Enterprise Compliance Grounding

LedgerSeal provides technical controls that support compliance in regulated industries:

- **SOC 2 Type II (Trust Services Criteria CC8.1):** Supports compliance with change authorization controls by recording who approved a Jira issue and detecting changes to that issue after approval.
- **ISO/IEC 27001:2022 (Control A.8.32 Change Management):** Supports compliance with change management through separation of duties and change detection on change tickets.
- **FDA 21 CFR Part 11 (Electronic Records & Signatures):** Supports the audit trail (21 CFR 11.10(e)). Signature manifestation (21 CFR 11.50) is partly met: Each seal records the date, time and meaning of the signature. The signer's name is shown from their Atlassian account while it exists; after the account is closed, it is shown as a deleted user, so a printed name is not kept in the record.

*Honest Compliance Boundary:* LedgerSeal provides technical tools. It does not certify your organization. Your auditor decides whether your procedures and system validation meet these frameworks. LedgerSeal does not provide 21 CFR Part 11 electronic signatures by itself: it does not perform the two-component signing of 11.200 (the signer does not log in again when sealing), and it does not meet 11.300.

---

## Data Privacy & "Runs on Atlassian" Architecture

- **Forge Native Execution:** LedgerSeal runs on Atlassian Forge.
- **No External Egress:** The app manifest declares no external fetch permissions (`permissions.external` is absent). The app calls only the Jira REST API of your site.
- **Forge Storage:** Seal records, history chains, and approver groups are kept in Atlassian Forge key-value storage for your site. Hashed records name people by a pseudonymous party token; the link from token to account id is kept in one key per account, reported to Atlassian's personal data reporting API every week, and deleted when the account is closed. Forge deletes the app's storage 28 days after uninstall; the `ledgerseal-cert` issue property (no personal data) stays on the issues.
- **Data Residency:** Data residency follows Atlassian's rules for Forge app storage.

---

## Transparent Pricing

| Tier | Monthly Price | Annual Price (2 Months Free) |
|---|---|---|
| **1 to 10 Users** | **Free** | **Free** |
| **11 to 100 Users** | $0.95 per user / month | $9.50 per user / year |
| **101 to 250 Users** | $0.75 per user / month | $7.50 per user / year |
| **251 to 1,000 Users** | $0.24 per user / month | $2.40 per user / year |
| **More than 1,000 Users** | $0.24 per user / month | $2.40 per user / year |

*All billing is handled natively through your existing Atlassian invoice.*

---

## Highlights (images 1840 x 900: the Marketplace form needs at least 920 x 450, so the matching screenshots are used; `highlight-1.png` to `highlight-3.png` in `docs/marketplace/assets/ledgerseal/` are too small)

Images used: highlight 1 `01-sealed-panel.png`, highlight 2 `02-tamper-detected.png`, highlight 3 `03-transition-blocked.png`.

1. **Sealed at approval.** Sealing stores a SHA-256 hash of the covered fields, comments and attachments, who signed and the sign-off role, in a hash-chained history.
2. **Changes after approval, named.** Each changed item shows its value at approval, its value now and who changed it. The person who made the changes cannot approve them; another approver must.
3. **The move waits for approval.** The Require Valid LedgerSeal workflow validator blocks a transition when the issue is not sealed, was changed after approval, or the seal was revoked.

---

## Banner (1120 x 548: `docs/marketplace/assets/ledgerseal/banner.png`)

Sources of the banner and highlights: `docs/marketplace/assets/ledgerseal/media-src/` (rendered by `render.py`).

---

## Screenshot Gallery Manifest (1840 x 900)

Real captures of LedgerSeal 4.1.0 on the development site (project PAY "Payments Platform"; 03 in project LSP, the project with the LedgerSeal validator on a transition), 2026-11-06. Each image is cropped to the app (no Jira header, no DEV badge), 1840 x 900 px. Script: `apps/ledgerseal/test/live/shots.py`, `shot_admin.py`, `shot_blocked.py`.

1. `01-sealed-panel.png` - **Sealed issue:** the green SEALED lozenge, "Approval seal: Sealed. No change detected since approval.", Revoke seal, and the expanded "Certificate & attestation details": signer, sign-off role, hash, covered and not covered fields.
2. `02-tamper-detected.png` - **Changed after approval:** the red CHANGED lozenge and "Changed items" with Was (at approval), Now (current edit) and Changed by, for a summary edit and a new comment. The person who made the changes is told that another approver must approve them.
3. `03-transition-blocked.png` - **Workflow gate:** Jira's "Transition failed" message from the Require Valid LedgerSeal validator, over the panel of the changed issue.
4. `04-admin-approvers.png` - **Approver groups:** the LedgerSeal approvers admin page with the approver group list, Save changes, and a group search.
5. `05-seal-history.png` - **Seal history:** the seal details with the hash-chained history, naming who sealed.

---

## Support, Documentation & Legal Links

- **Documentation Portal:** https://asymm.systems/product/jira-governance/user-guide/ledgerseal.html
- **Offline Verifier Documentation:** https://asymm.systems/product/jira-governance/user-guide/open-verifier
- **Offline Verifier Source (Apache-2.0):** https://github.com/asymmsystems/jira-governance-code-cli
- **Privacy Policy:** https://asymm.systems/privacy
- **Terms of Service:** https://asymm.systems/terms
- **Support Portal & SLA:** https://asymm.systems/support
- **Direct Support Contact:** `support@asymm.systems`


---

## Post-approval copy: regulated migration

Added 2026-11-08. For use **after** Atlassian approves this listing: a listing cannot be edited while it is pending. Facts only, from the sections above. Do not name another vendor or app in the listing. Do not mention Isolated Cloud or Government Cloud until those listings exist. Strategy: `docs/launch/regulated-enterprise-playbook.md`.

- **Tagline (75 characters):** Approval seals and change control for teams moving regulated Jira to cloud.
- **Highlight (206 characters):** Moving from Data Center? LedgerSeal seals Jira issues at approval, names every later change and who made it, and blocks the release transition until another approver approves. Forge app, no external egress.
- **Description lines:**
  - Moving regulated Jira from Data Center to cloud? Keep the approval step your auditor tests: the approved ticket is the ticket that ships.
  - LedgerSeal seals an issue at approval with a SHA-256 snapshot of the covered fields, comments and attachments.
  - Each later change is shown with its value at approval, its value now and who changed it. The person who made the changes cannot approve them.
  - The Require Valid LedgerSeal validator blocks the transition until another approver approves the changes. A Jira admin adds it to each transition.
  - Supports SOC 2 CC8.1, ISO/IEC 27001:2022 A.8.32 and the 21 CFR 11.10(e) audit trail. It does not provide Part 11 electronic signatures by itself: it does not meet 11.200 or 11.300.
  - Runs on Atlassian Forge. The manifest declares no external egress; data stays in Forge storage for your site, under Atlassian's data residency rules.
- **Search words to keep in the text:** approval, sign-off, electronic signature, change control, audit trail, 21 CFR Part 11, SOC 2, ISO 27001.

## Post-approval copy: code signing (ADR-016)

Added 2026-11-08 by the regulated build (`feature/ledgerseal-regulated`). **Use only after code signing is released to production, live probes pass, and the owner approved declaration version 2 and this wording (Q-03, Q-14; his prose).** Until then the existing line "It does not provide Part 11 electronic signatures by itself: it does not meet 11.200 or 11.300" stays.

- **Replace the description line about Part 11 with (proposed):** "With code signing on, each signature also needs a single-use code that LedgerSeal emails to the signer's own Atlassian address, with lockout and a recorded history of every attempt. LedgerSeal does not re-enter your Jira login at each signature, so it partly meets 21 CFR 11.200(a)(1); your identity provider's controls, procedures and validation decide whether this meets your predicate rules."
- **Scope line for the Privacy & Security tab:** `send:notification:jira`: emails a signer their own single-use signing code, only in projects where a Jira admin turned code signing on. The app emails nothing else.
- **Limits to state:** a shared or delegated mailbox defeats the code; when Jira outgoing email is off, nobody can sign in a code-signing project; security alerts are shown on the admin page and are not emailed.
- **Search words:** electronic signature, signing code, two-step signing.
- **Transition screen (ADR-018), proposed line:** "Sign on the transition screen: a Jira admin adds the LedgerSeal signature field to a transition screen, and the person signs in the dialog before the move. Transitions without the field (REST, automation, bulk changes) are blocked by the validator until the issue is sealed."
