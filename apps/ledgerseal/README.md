# LedgerSeal: tamper-evident approval seal for Jira

LedgerSeal lets an approver seal a Jira issue. Approvers are project admins, Jira admins, and members of the approver groups a Jira admin chooses on the "LedgerSeal approvers" admin page. A seal records a SHA-256 hash of the issue's covered fields, comments and attachments, who sealed it, when, the meaning (Approved, Reviewed or Verified) and the declaration text they agreed to.

After that, LedgerSeal:
- shows which covered fields changed since the seal, with the old and the new value and who changed them;
- keeps every seal, change incident and reseal in a hash-chained history that a reseal cannot hide;
- lets only an approver who did not make a change approve it, with a reason, or revoke the seal;
- can block a workflow transition until the issue is sealed and unchanged, when a Jira admin adds the validator to the workflow;
- writes an Ed25519-signed summary to the `ledgerseal-cert` issue property, which other tools can check with the public key in `keys/`; the property holds no account id;
- names people in its records by a pseudonymous party token, reports the account ids it holds every week, and erases a closed account's link (ADR-011).

LedgerSeal is tamper-evident, not tamper-proof: it detects changes, it does not stop them. Where a status lock fits, also set the workflow property `jira.issue.editable` to `false`. LedgerSeal does not provide regulated electronic signatures by itself, and it does not ask the signer to log in again. Your own validation and procedures decide whether it fits a regulated process.

Built on Atlassian Forge. The app backend makes no outbound network calls, and the panel icon is bundled with the app.

## How it decides

- **Separation of duties:** a user who changed covered content after the last seal (a covered field in Jira's change log, a comment or work log they added or edited, an attachment they added) cannot approve the changes, revoke the seal, or seal again after another approver revokes it. Status, Rank and Sprint changes do not count. Jira does not record who deleted a comment or a work log, so a deletion cannot be attributed.
- **What was seen is what is sealed:** the panel sends the hash of the issue as it showed it; a seal is refused if the issue changed since.
- **Restricted comments (F-06):** Comments restricted to a project role or group are covered only when Jira lets the LedgerSeal app read them, that is when the app's user is in that role or group; otherwise a change to such a comment is not detected. A covered restricted comment's text is shown in the panel, and the evidence is exported, only to a user who can see the comment in Jira.
- **Covered fields** are chosen by field type from the site field list (`/rest/api/3/field`). Rank, Sprint, SLA timers, satisfaction, request participants, approvals, development summary, Sentiment, forms counts, Agent Sessions, status, resolution and Jira's own timestamps are left out, and the panel lists each with the reason. Every other field with a value is covered.
- **Trust:** the panel and the validator decide only from app storage, which only the app can read and write. The `ledgerseal-cert` property is an output for other tools. Any user who can edit an issue can change its properties, so a reader must check the signature.
- **Integrity check:** every read recomputes the hash of the stored seal record and the stored snapshot. A mismatch shows "the seal record failed its integrity check".
- **Limits:** the vendor holds the signing key, so a valid signature shows that LedgerSeal wrote the attestation, not that the vendor could not. Changes are recorded from Jira issue, comment, attachment and work log events, which can arrive up to 3 minutes late, and are checked again whenever someone opens the panel or runs a transition.

## Modules and scopes

| Module | Purpose |
|---|---|
| `jira:issuePanel` `ledgerseal-panel` | UI Kit panel: seal, approve changes, history |
| `jira:issueContext` `ledgerseal-context` | "Approval seal" entry in the issue details column: the seal state without opening the panel (F-12) |
| `jira:workflowValidator` `ledgerseal-validator` | Blocks a transition unless the issue is sealed and unchanged |
| `jira:adminPage` `ledgerseal-admin` | Jira admins choose the approver groups |
| `trigger` `ledgerseal-issue-changed`, `ledgerseal-issue-deleted` | Record a change when Jira reports it; delete a deleted issue's records |
| `scheduledTrigger` `ledgerseal-personal-data-report` | Weekly personal data report; converts records made before ADR-011 |

| Scope | Why |
|---|---|
| `read:jira-work` | Read the issue, comments, change log, field list and the user's own permissions |
| `write:issue.property:jira` | Write the app's own `ledgerseal-cert` issue property (the granular scope for issue properties). The app never edits issue fields |
| `read:jira-user` | Read display names to show who changed an item (never stored), the caller's own groups, and groups for the admin page |
| `storage:app` | Keep seal records, history and the token-to-account map |
| `report:personal-data` | Report the account ids the app holds every week, and erase closed accounts (ADR-011) |

## Storage (Forge KVS)

Seals are stored on the Silverston WorkEffort, Party and Status patterns (ADR-01):

| Key | Value |
|---|---|
| `ls3:we:{issueId}` | The sealed issue as a WorkEffort: current state, counts and record hash |
| `ls3:wepa:{issueId}:{fromDate}` | One seal: the signer (party), the meaning (role) and the time window |
| `ls3:wes:{issueId}:{seq}` | One state change, created once, holding the hash of the row before it |
| `ls3:content:{contentId}:{part}` | The sealed snapshot, in parts |
| `ls3:partyrole:LS_APPROVER` | The approver groups (party role), set on the admin page |
| `ls3:partykey` | The site key of the party tokens (ADR-011) |
| `ls3:party:{token}` | One account behind a party token; deleted when the account is closed |
| `ls3:convert:{issueId}` | Journal of a conversion of an old record, while it runs |
| `cert:active:{issueId}` | Old-format records, read only; their personal data is replaced by a stub |

## Find issues by seal state (JQL)

The app indexes the `ledgerseal-cert` property, so filters and dashboards can use:

```
issue.property[ledgerseal-cert].status = "SEAL_BROKEN"
ledgersealStatus = "SEAL_BROKEN"
ledgersealEverCompromised = "true"
ledgersealIncidents > 0
```

The property is a summary for searching. Any user who can edit an issue can change its properties, so check the signature (see below) before relying on a value.

## Evidence for an auditor

The `seal-evidence-api` resolver returns a JSON export: a signed attestation of the stored seal, the canonical snapshot that was hashed, and the full history. An auditor checks it without access to LedgerSeal:

```bash
node ../../tools/verifier/verify-evidence.mjs evidence.json keys/ls-dev-2026-11.pub.pem    # development install
node ../../tools/verifier/verify-evidence.mjs evidence.json keys/ls-prod-2026-11.pub.pem   # production (Marketplace) install
node ../../tools/verifier/verify-evidence.mjs --self-test
```

`tools/verifier` is the one copy of the open verifier in this repository. It is identical to the public repository https://github.com/asymmsystems/ledgerseal-verifier (Apache-2.0), where auditors download it.

The verifier uses the Node standard library only. It exits 0 only when the snapshot hash, the history chain, the certificate and the signature all pass.

The full design is in `docs/spec/ledgerseal-spec-v3.md`.

## Tests

Measured on the last change to this file (2026-11-06):

| Measure | Value |
|---|---|
| Tests | 484 in 46 suites |
| Coverage (all files in `src/` except the UI Kit component files; both view models are included) | statements 97.88%, branches 94.26%, functions 96.61%, lines 98.67% |

Install the shared UI package first; its `prepare` step builds it with its own TypeScript:

```bash
cd ../../packages/asymm-jira-ui && npm ci
cd ../../apps/ledgerseal && npm ci
npm test
npm run build
npm audit --omit=dev --audit-level=high
```
