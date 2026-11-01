# LedgerSeal: tamper-evident approval seal for Jira

LedgerSeal lets a project admin seal a Jira issue. A seal records a SHA-256 hash of the issue's covered fields, comments and attachments, who sealed it, when, the meaning (Approved, Reviewed or Verified) and the declaration text they agreed to.

After that, LedgerSeal:
- shows which covered fields changed since the seal, with the old and the new value and who changed them;
- keeps every seal, change incident and reseal in a hash-chained history that a reseal cannot hide;
- lets only an approver who did not make a change approve it, with a reason;
- can block a workflow transition until the issue is sealed and unchanged, when a Jira admin adds the validator to the workflow;
- writes an Ed25519-signed summary to the `ledgerseal-cert` issue property, which other tools can check with the public key in `keys/`.

LedgerSeal is tamper-evident, not tamper-proof: it detects changes, it does not stop them. Where a status lock fits, also set the workflow property `jira.issue.editable` to `false`. LedgerSeal does not provide regulated electronic signatures by itself, and it does not ask the signer to log in again. Your own validation and procedures decide whether it fits a regulated process.

Built on Atlassian Forge. The app backend makes no outbound network calls.

## How it decides

- **Covered fields** are chosen by field type from the site field list (`/rest/api/3/field`). Rank, Sprint, SLA timers, satisfaction, request participants, approvals, development summary, status and Jira's own timestamps are left out, and the panel lists each with the reason. Every other field with a value is covered.
- **Trust:** the panel and the validator decide only from app storage, which only the app can read and write. The `ledgerseal-cert` property is an output for other tools. Any user who can edit an issue can change its properties, so a reader must check the signature.
- **Integrity check:** every read recomputes the hash of the stored seal record and the stored snapshot. A mismatch shows "the seal record failed its integrity check".
- **Limits:** the vendor holds the signing key, so a valid signature shows that LedgerSeal wrote the attestation, not that the vendor could not. Changes are recorded from Jira issue, comment, attachment and work log events, which can arrive up to 3 minutes late, and are checked again whenever someone opens the panel or runs a transition.

## Modules and scopes

| Module | Purpose |
|---|---|
| `jira:issuePanel` `ledgerseal-panel` | UI Kit panel: seal, approve changes, history |
| `jira:workflowValidator` `ledgerseal-validator` | Blocks a transition unless the issue is sealed and unchanged |

| Scope | Why |
|---|---|
| `read:jira-work` | Read the issue, comments, change log, field list and the user's own permissions |
| `write:jira-work` | Write the app's own `ledgerseal-cert` issue property. The app never edits issue fields |
| `read:jira-user` | Read the signer's display name |
| `storage:app` | Keep seal records and history |

## Storage (Forge KVS)

| Key | Value |
|---|---|
| `ls2:seal:{issueId}` | The current seal record, with its record hash |
| `ls2:entry:{issueId}:{seq}` | One history entry, created once, holding the hash of the entry before it |
| `ls2:snap:{certificateId}:{part}` | The sealed snapshot, in parts |
| `cert:active:{issueId}` | Old-format records, read only |

The full design is in `docs/spec/ledgerseal-spec-v2.md`.

## Tests

Measured on the last change to this file:

| Measure | Value |
|---|---|
| Tests | 177 in 22 suites |
| Branch coverage (all files in `src/` except the UI Kit view) | 97.39% |

```bash
npm install
npm test
npm run build
```
