# LedgerSeal: UX specification and benchmark

- **Date:** 2026-11-01
- **Scope:** the LedgerSeal issue panel (UI Kit, `src/frontend/index.tsx`), the workflow validator messages, and the resolver contracts behind them.
- **Code reviewed:** `apps/ledgerseal` in the working tree at repo HEAD `423b9b2`. Every LedgerSeal file is byte-identical to the audit snapshot (`docs/sdlc/portfolio-audit-2026-10-31/snapshot-md5.txt`). File:line references are valid for both.
- **Source IDs:** the same as `research-brief.md` section 9. MP = Marketplace apps, NJ = native Jira, JAC = jira.atlassian.com tickets, FG = Forge platform, REG = regulation, T = tests run in this research.
- **Tests:** T-01 = `measure.probe.ts`, T-02 = `adversarial.probe.ts`, T-03 = `coverage.probe.ts`. All three live in `docs/sdlc/ledgerseal-usp-ux-research-2026-11/evidence/probes/`. They import the app source read-only and mock the Forge APIs. `round-log.md` gives the command.
- **Limit:** Part A opened no live issue page and no LedgerSeal panel (brief section 14). LedgerSeal click counts come from the code. Competitor counts come from vendor documents only. No competitor video was readable (MP section 7).

## 1. Benchmark table

Counts are clicks (C) and keystrokes (K) inside the panel or app, after the issue is open. "Who" is the person who may do the task. "Unknown" means no readable source shows it.

| # | Task | LedgerSeal today | Native Jira | eSign (686 installs) | Electronic Signatures, Appfire (297) | Ketryx (292) | Approval Path (251) / Group Sign-Off (206) | Issue History, SaaSJet (3,007) |
|---|---|---|---|---|---|---|---|---|
| 1 | Sign and seal an approved issue | 3 C + at least 1 K (7 K for the suggested "CONFIRM"). Inline form, no modal, no confirm step. Who: anyone who can view the issue (LS-01). Any text passes the "re-authentication" (T-02 A6). Observed-code `index.tsx:172-242` | Approve in an approval step: help center, email, Slack or Teams (NJ-14). Native approvals need Premium or Enterprise (NJ-18). No signature meaning or re-authentication found | Sign button, dialog, PIN, Meaning, "Execute Signature": about 4 actions (MP-13). Who: invited users or groups (MP-02, MP-10). First use needs a PIN set by email (MP-13) | Re-enter credentials (MP-18). Steps Unknown (docs not read, MP section 7) | Part 11 signature in Jira (MP-22). Steps Unknown (docs behind login) | Approve per configured step; approvers by user, group, role or field (MP-34, MP-38). Clicks Unknown | Not a signing app |
| 2 | See which fields the seal covers, and which it excludes | 1 C ("Inspect Certificate Metadata") shows only a count, for example "Canonical Fields Sealed: 11". No field names. Excluded fields never shown. Observed-code `index.tsx:191-199`. In T-03, 7 of 22 present fields are silently outside the hash (status, reporter, resolution and 4 custom fields) | Not applicable (no seal) | Default covered set is documented: summary, description, attachments; extra fields configurable (MP-06, MP-12). In-app view Unknown | Unknown | Unknown | Not applicable | Not applicable |
| 3 | Find a change after approval: field, old and new value, who, when | 0 C: diff shown on load for hashed fields, values cut at 80 characters (`index.tsx:21`). Rich text shows only "Rich text description updated" (`index.tsx:27`). Comments show only a count (`tamper-detector.ts:152-157`). No who or when (no changelog read, LS-16). An issue-type change breaks the seal with no field named (T-03 C05) | History tab: field, old, new, who, when (NJ-19, NJ-20). Not linked to any approval | Verification certificate marks which signatures failed; no field named (MP-11) | Unknown | New version on every edit (MP-25); diff view Unknown | Unknown | About 3 C plus hover: Activity, More, Issue History, hover for from and to (MP-44). Not linked to an approval |
| 4 | Approve a legitimate change: different approver, reason, earlier tamper record visible | Same 3 C + K as task 1, by anyone, including the person who made the change (T-02 A1). No reason field. The earlier tamper record disappears from the active record and the panel (T-02 A2) | Not applicable | Re-execute signature; old one "voided but remains visible" (MP-13). Different approver or reason: not stated | Unknown | Unknown | Unknown; four-eyes named as a use case only (MP-38) | Not applicable |
| 5 | Be blocked at a transition, understand why, know how to fix it | Jira shows the validator message (FG-17). Message names fields but not who may reseal or how (`workflow-validator.ts:38`). Unsealed message says "authorized electronic signature", which no check enforces (LS-01). On a Jira read failure the message is wrong (T-02 A5) | `jira.issue.editable=false` stops the edit itself, not the transition (NJ-01). Message Unknown | Validator exists (MP-08). Message Unknown | Validator exists (MP-19). Message Unknown | Gates release on approval (MP-23). Message Unknown | Unknown | Not applicable |
| 6 | Export evidence; auditor checks the hash without the app | Not possible. No export. The canonical snapshot is in app-private storage (FG-12), and no canonical form is published (LS appendix section 6) | History export is not native in the UI (JAC-14, JAC-15). Bulk changelog API exists (NJ-21) | PDF Signature Archive and verification certificate (MP-09). Outside verification Unknown | Unknown | Validation documents (MP-24). Outside verification Unknown | Unknown | Excel, CSV, PDF in the paid version (MP-44). No integrity proof (MP-45) |
| 7 | List every broken or unsealed issue in a project | Not possible. No `jira:entityProperty` index (`manifest.yml:1-20`), so no JQL. The property is not authoritative anyway (PX-04, T-02 A4) | Not applicable | JQL for pending signatures (MP-04). Invalidated list Unknown | Unknown | Unknown | Pending approvals by JQL or dashboard (MP-34, MP-39) | JQL report of changes (MP-42) |
| 8 | Revoke an approval | Not possible. No resolver (T-02 A10) | Unknown | Decline with reason; admin clear (MP-10, MP-13) | Unknown | Unknown | Unknown | Not applicable |
| 9 | Recover when Jira is unreachable during seal or verify | Panel shows "Issue Not Sealed" and offers "Seal Issue" (`index.tsx:64-71`, LS-12). A failed seal leaves the form open with no message (`index.tsx:94-96`). The validator blames real fields or says "must be sealed" (T-02 A5) | Not applicable | Unknown | Unknown | Unknown | Unknown | Not applicable |

**Reading the table.** No competitor documents a full answer to tasks 3, 4 and 6 together. LedgerSeal is closest on task 3 for the fields it hashes (the audit saw a clear diff live on DEMO-22). But it fails tasks 2, 4, 6, 7, 8 and 9 today.

## 2. Target interactions

Rules for all tasks:
- Identity comes from Forge context only (LS-03). The panel never shows an email address (LS-17). It shows the user with the UI Kit `User` component (FG-40).
- Each panel load is a read. It never writes KVS or the entity property unless the live hash differs from the last recorded incident (LS-06).
- Every action button is a UI Kit `Button`. Every input has a `Label`. Each state has a title text and a lozenge text, so colour is never the only signal.
- Times show in the viewer's locale with the time zone, for example "1 Nov 2026, 14:05 (UTC+05:30)". The full value is in the certificate view (LS-21).

### Task 1. Sign and seal
1. The panel shows "Not sealed" (lozenge "NOT SEALED") and the approver policy in one line, for example "Who can seal: project role Change Approvers".
2. A permitted user sees "Seal this issue". Other users see "You cannot seal this issue. Ask a member of Change Approvers." No button (LS-01).
3. Click "Seal this issue". An inline form opens (no modal). It shows:
   - "Meaning" (select: Approved for release, Reviewed, Verified). Default "Approved for release".
   - "Fields covered by this seal": the sealed field names, and a collapsed "Not covered (n)" list with a reason per field, for example "Rank: changes on every board drag" (LS-05).
   - The declaration text, exactly as it will be stored, with its version: "I approve this issue as it is now. (Declaration v1)" (LS-09).
   - A checkbox "I agree to the declaration above".
4. Click "Sign and seal". The button text changes to "Sealing...". On success the panel shows the sealed state and a toast-free inline success message.
5. Steps: 3 C (open form, tick, sign), 0 K. The free-text "re-authentication" box is removed. LedgerSeal must not call it re-authentication (LS-09; 11.200 row in `research-brief.md` section 6.1).
6. Error path: "LedgerSeal could not read the issue from Jira. Nothing was saved. Try again." with a "Try again" button (LS-08, LS-12). A KVS conflict says "Someone else sealed this issue a moment ago. Reload to see the new seal." (LS-07).
7. Keyboard: Tab reaches Meaning, the "Not covered" toggle, the checkbox and the two buttons in that order. Space ticks the checkbox. Enter on "Sign and seal" submits.

### Task 2. See covered and excluded fields
- The sealed state has a "Covered fields (n)" section, collapsed by default, listing field names in Jira's display names (from `/rest/api/3/field`, LS-05). A "Not covered (m)" section follows, with the reason per field.
- The certificate view shows the canonical form version, for example "Canonical form v2" (LS-11, LS-22).
- 1 C to expand each list. Keyboard: Enter on the toggle.

### Task 3. Find a change after approval
- The broken state title reads "Changed after approval". Lozenge "CHANGED".
- One row per changed field: field name, "Was", "Now", "Changed by" (UI Kit `User`), "When" (local time). The data comes from the changelog since `sealedAt` (NJ-20) or the issue-updated event (FG-32) (LS-16).
- Long values show the first 200 characters and a "Show full value" toggle. Rich text shows a paragraph-level summary, for example "Paragraph 3 changed", plus the full old and new text on expand.
- Comment rows name the comment author and time. Attachment rows say "Added", "Removed" or "Changed".
- A change with no field (issue type, project move) says "Issue type changed from Change to Bug" (T-03 C05).
- 0 C to see the list. 1 C per "Show full value".

### Task 4. Approve a legitimate change (reseal)
- Only a permitted user who did not make any of the listed changes sees "Approve these changes". The person who made a change sees "You changed this issue, so another approver must approve it." (LS-01, separation of duties).
- The form adds a required "Reason" text box (1 to 500 characters).
- After the reseal the panel shows "Sealed" plus a note: "Resealed after 1 change incident on 1 Nov 2026. See history." The history section lists every seal, every incident and every reseal, oldest first, with who and when (LS-02, LS-13).
- Steps: 3 C + the reason text.

### Task 5. Blocked at a transition
Validator messages (exact text, each under 250 characters):
- Not sealed: "LedgerSeal: this issue is not sealed. Ask a member of Change Approvers to seal it in the LedgerSeal panel, then try again."
- Changed: "LedgerSeal: 2 fields changed after approval (Summary, Due Date). Ask a member of Change Approvers who did not make the change to approve it in the LedgerSeal panel."
- Revoked: "LedgerSeal: the seal was revoked on 1 Nov 2026 (reason: scope withdrawn). Seal it again to continue."
- Jira unreachable: "LedgerSeal could not read the issue from Jira, so this transition is blocked. Try again in a minute." (LS-08, LS-19).

### Task 6. Export evidence for an auditor
- "Download evidence (JSON)" in the certificate view. The file holds the signed attestation (audit section 5.1), the canonical snapshot, the canonical form version and the verification steps. Forge has a 5 MB front-end response limit (FG-04).
- The auditor recomputes the hash and checks the Ed25519 signature with the published public key and an open verifier. This needs no LedgerSeal access. Item B-14 in `backlog.md` depends on owner approval for the signing key.
- PDF is out of scope for this round (no PDF library without a new dependency).

### Task 7. List broken or unsealed issues
- A `jira:entityProperty` index on `status` and `everCompromised` (FG-26) makes this JQL work: `issue.property[ledgerseal-cert].status = SEAL_BROKEN`.
- The panel help text gives the JQL. The listing must say the property is a claim that any editor can change (NJ-30). Only the panel and the validator are authoritative, because they check app storage (FG-12).

### Task 8. Revoke an approval
- A permitted user sees "Revoke seal" in the sealed state. A required "Reason" box and a "Revoke" button follow. 2 C + reason.
- The revoked state title reads "Seal revoked", lozenge "REVOKED", with who, when and the reason (LS-13).

### Task 9. Jira unreachable
- Panel: an ERROR state with SectionMessage "warning": "LedgerSeal could not check this issue. Jira did not answer. The seal state is unknown. Try again." and a "Try again" button. It never shows "Not sealed" on an error (LS-12).
- Seal: the form stays open with the same warning above the button, and the typed reason is kept.
- Validator: the Jira-unreachable message in task 5. No property write (LS-08).

## 3. Size and time: baseline and budget

Measured by T-01 on 2026-11-01 (host Node v26.13.0, 25 runs each, mocked Forge APIs, so no network time). Times are in-process compute only. Real resolver time adds Jira REST calls, which this research did not measure. The baseline ran the v1 app (Part A); the "After" column ran the built app (Part B, branch `feature/ledgerseal-research-build`), through its real Jira client over a mocked REST layer (`results-after.json`).

Fixtures: small = 765-byte issue. desc400 = a 400-paragraph description (107,190-byte issue JSON). comments100 = 100 comments (40,266 bytes). combined = both (146,691 bytes).

| Measure | small | desc400 | comments100 | combined | Budget | After (Part B) |
|---|---|---|---|---|---|---|
| Seal compute, median / p95 (ms) | 0.14 / 0.34 | 3.0 / 4.4 | 1.3 / 2.2 | 3.9 / 6.0 | p95 at most 50 ms compute; end-to-end under 5 s, well inside the 25 s limit (FG-01) | small 0.39 / 0.72; desc400 7.6 / 10.6; comments100 4.1 / 5.0; combined 10.2 / 16.7. Met |
| Largest KVS value after seal (bytes) | 1,614 | 108,039 | 43,013 | 149,438 | No single value above 120 KiB (half of 240 KiB, FG-07) for the combined fixture | 1,795; 120,000; 43,994; 120,000 (combined in 3 parts). Met |
| Verify (unchanged issue), median (ms) | 0.09 | 2.5 | 1.4 | 3.4 | p95 at most 50 ms compute | 0.31; 6.1; 3.4; 9.4 (p95 at most 10.0). Met |
| Verify (unchanged): KVS writes / property writes | 0 / 1 | 0 / 1 | 0 / 1 | 0 / 1 | 0 / 0 (LS-06). Each write spends the shared 65,000-point hourly REST pool (FG-30) | 0 / 0 in every fixture. Met |
| Verify response sent to the panel (bytes) | 1,917 | 108,342 | 43,316 | 149,741 | At most 16 KiB: send the view model, not the snapshot or the email (LS-17) | 1,192 in every fixture (1,556 when changed). Met |
| Validator (unchanged), median (ms) | 0.11 | 3.0 | 1.5 | 4.2 | p95 at most 50 ms compute | 0.32; 7.8; 4.4; 12.2 (p95 at most 13.2). Met |
| Property body on seal (bytes) | 287 | 287 | 287 | 287 | At most 2 KiB with signature (32,768-byte limit, FG-25) | 380 unsigned (probe); the signed body is under 2 KiB (`attestation.test.ts`). Met |
| After 500 views of a tampered issue: active certificate (bytes) | 154,653 | 261,078 | 196,052 | 302,477 | Same size as after the first incident (growth 0) | Work effort 1,055 in every fixture; it grows 62 bytes at the first incident and not after. Met |
| After 500 tampered views: history rows / incidents | 500 / 500 | 500 / 500 | 500 / 500 | 500 / 500 | 1 / 1 (one incident per distinct live hash) | 2 status rows (seal and one change) / 1 incident. Met |
| After 500 tampered views: KVS writes / property writes | 1,500 / 500 | 1,500 / 500 | 1,500 / 500 | 1,500 / 500 | 1 / 1 in total | 2 / 1 in total (the change row and the work effort; one signed property write). Met |
| First view at which the active value passes 240 KiB | 798 | 450 | above 500 | 315 | Never | Never. The largest value stays at 120,000 bytes or less. Met |
| Verify time, first 25 vs last 25 tampered views, median (ms) | 0.24 vs 4.0 | 4.8 vs 7.7 | 2.0 vs 5.3 | 5.9 vs 9.7 | Flat (no growth with views) | 0.33 vs 0.27; 6.1 vs 7.0; 4.8 vs 4.8; 10.5 vs 10.6. Flat. Met |

What the numbers mean:
- Past the 240 KiB limit, `kvs.set` fails. Verify then throws, and the panel shows "Issue Not Sealed" (LS-06, LS-12). For the combined fixture this happens on the 315th view of a tampered issue.
- The combined fixture fits in one value today (149,438 bytes), but only because the limit is 240 KiB. A 600-paragraph description would not fit. Inferred from the linear growth of desc400.
- Each verify sends the full snapshot and the signer email to the browser (149,741 bytes for the combined fixture).

## 4. ADS, UI Kit and WCAG 2.2 gaps

Grades: Observed-code unless marked. WCAG references are to WCAG 2.2 success criteria. This research did not run an assistive-technology test, because the UI is UI Kit and needs a live site (brief section 11.3).

| ID | Gap | Evidence | WCAG / ADS | LS finding |
|---|---|---|---|---|
| G-01 | No error state. A load failure shows "Issue Not Sealed" and offers a seal | `index.tsx:64-71` | 3.3.1 Error Identification; ADS error pattern | LS-12 |
| G-02 | A failed seal shows nothing; the form stays open | `index.tsx:94-96` | 3.3.1; 4.1.3 Status Messages | LS-12 |
| G-03 | "Sign" button stays disabled with no text that says why | `index.tsx:238` | 3.3.2 Labels or Instructions (Inferred) | none (new, G-03) |
| G-04 | "Signer Re-Authentication Challenge" accepts any text, so the label tells the user something false | `index.tsx:221-228`; T-02 A6 | 3.3.2; honest wording | LS-09 |
| G-05 | Stored declaration differs from the checkbox text | `index.tsx:87` vs `:233`; T-02 A6 | 3.3.2 | LS-09 |
| G-06 | Diff values cut at 80 characters; rich text shown only as "Rich text description updated"; comments only as a count | `index.tsx:21, 27`; `tamper-detector.ts:152-157` | 1.3.1 Info and Relationships (Inferred) | LS-11 (adjacent) |
| G-07 | Change with no field named (issue type, project move) shows a red alert with no reason | T-03 C05 | 3.3.1 | new (NF-01 in `research-brief.md`) |
| G-08 | Raw ISO-8601 times; 16-character hash prefix with no copy action | `index.tsx:120, 123, 146` | ADS content guidance | LS-21 |
| G-09 | Signer email shown to every viewer | `index.tsx:185-187` | Privacy; FG-40 `User` component | LS-17 |
| G-10 | Reseal and seal buttons shown to every viewer | `index.tsx:136, 161, 172` | ADS: hide actions the user cannot take | LS-01 |
| G-11 | No REVOKED state and no history view | `index.tsx:114-176` | ADS empty and status patterns | LS-13 |
| G-12 | All-caps claims in lozenges: "UNTAMPERED & AUDIT READY", "PREVIOUSLY TAMPERED / COMPROMISED" | `index.tsx:125, 135` | ADS lozenge text: short status words | PX-02 |
| G-13 | The diff uses a "→" character between quoted values; screen readers read "rightwards arrow" | `index.tsx:155` | 1.3.1 (Inferred) | none |
| G-14 | No UI test at all; `src/frontend/**` is outside coverage | `jest.config.js:9` | n/a | PX-03 |
| PASS | States differ by title and lozenge text, not by colour alone | `index.tsx:114-176` | 1.4.1 Use of Color | n/a |
| PASS | Inputs have `Label` with `labelFor` | `index.tsx:213-228` | 1.3.1, 3.3.2 | n/a |
| PASS | ADS space tokens, UI Kit only, no hex colours, no modal | audit appendix section 4 | ADS | n/a |

## 5. Wording table (UI, manifest and validator)

Each text is tested against the "Claims to drop" rules in `research-brief.md` section 7.

| Location | Text today | Problem | Replacement |
|---|---|---|---|
| `index.tsx:105` | "Verifying cryptographic seal..." | "cryptographic" over-claims a plain digest (LS-10) | "Checking the seal..." |
| `index.tsx:112` | "LedgerSeal: Cryptographic Sign-Off & Change Gate" | Same | "LedgerSeal" |
| `index.tsx:115` | "Cryptographic Seal Verified" | Same; also shown after an undetected reseal (LS-02) | "Sealed. No change since approval." |
| `index.tsx:125` | "UNTAMPERED & AUDIT READY" | "Audit ready" is not supported (H4, H5); fields outside the hash can change (LS-04) | Lozenge "SEALED" |
| `index.tsx:130` | "CRITICAL: Previous Unauthorized Modification Detected" | The app cannot know a change was unauthorised | "Changed after approval, then changed back" |
| `index.tsx:132-133` | "Non-Monotonic Audit Alert ... does not heal a cryptographic seal" | Jargon | "This issue changed after approval and was later changed back. An approver must approve it again." |
| `index.tsx:135` | "PREVIOUSLY TAMPERED / COMPROMISED" | Accusing; all caps | Lozenge "CHANGED" |
| `index.tsx:137, 162` | "Re-Authorize and Reseal" | No re-authentication exists (LS-09) | "Approve these changes" |
| `index.tsx:143` | "CRITICAL: Cryptographic Seal Broken" | Over-claim | "Changed after approval" |
| `index.tsx:148` | "TAMPER DETECTED" | Accusing; many changes are legitimate (PX-04) | Lozenge "CHANGED" |
| `index.tsx:170` | "A seal is required to pass compliance workflow gates." | True only if an admin attached the validator | "Seal this issue to record approval of its current content." |
| `index.tsx:173` | "Seal Issue with Cryptographic Sign-Off" | Over-claim | "Seal this issue" |
| `index.tsx:212` | "Cryptographic Sign-Off & Seal" | Over-claim | "Seal this issue" |
| `index.tsx:213` | "Sign-Off Meaning / Regulatory Purpose" | Implies a regulatory use the app does not support | "Meaning" |
| `index.tsx:221` | "Signer Re-Authentication Challenge" | False (LS-09) | Remove the field |
| `index.tsx:241` | "Sign & Cryptographically Seal" | Over-claim | "Sign and seal" |
| `index.tsx:87` | "I electronically sign and seal this issue per compliance guidelines." | Not the text shown; names no guideline | Store the text shown: "I approve this issue as it is now." with a version |
| `index.tsx:233` | "I certify that I am the authorized signer and this record is complete, accurate, and ready for release." | "Authorized" is not checked (LS-01) | "I agree to the declaration above." |
| `manifest.yml:14` | "Blocks issue transition if issue is unsealed or has a broken cryptographic seal." | Over-claim | "Blocks the transition unless the issue is sealed and unchanged since approval." |
| `workflow-validator.ts:22` | "must be cryptographically sealed with an authorized electronic signature" | "authorized" not enforced; "electronic signature" implies Part 11 | Task 5 "Not sealed" text |
| `workflow-validator.ts:38` and `tamper-detector.ts:181` | "Cryptographic seal broken! ... Re-authorization required." | Over-claim; wrong on a Jira read failure (LS-08) | Task 5 "Changed" text |
| `tamper-detector.ts:60` | "Cryptographic integrity compromised!" | Over-claim | Task 5 "Changed" text, with "changed back" |
