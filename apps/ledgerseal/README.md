# LedgerSeal: tamper-evident approval seal for Jira

LedgerSeal lets an approver seal a Jira issue. Approvers are project admins, Jira admins, and members of the approver groups a Jira admin chooses on the "LedgerSeal approvers" admin page. A seal records a SHA-256 hash of the issue's covered fields, comments and attachments, who sealed it, when, the meaning (Approved, Reviewed or Verified) and the declaration text they agreed to.

After that, LedgerSeal:
- shows which covered fields changed since the seal, with the old and the new value and who changed them;
- keeps every seal, change incident and reseal in a hash-chained history that a reseal cannot hide;
- lets only an approver who did not make a change approve it, with a reason, or revoke the seal;
- can block a workflow transition until the issue is sealed and unchanged, when a Jira admin adds the validator to the workflow;
- writes an Ed25519-signed summary to the `ledgerseal-cert` issue property, which other tools can check with the public key in `keys/`; the property holds no account id;
- names people in its records by a pseudonymous party token, reports the account ids it holds every week, and erases a closed account's link (ADR-011).

**Code signing (ADR-016):** a Jira admin can name projects in which every seal, approval of changes and revoke also needs a single-use 6-digit code. LedgerSeal emails the code, through Jira, to the signer's own Atlassian address; it works once, for 5 minutes, for that person, issue and action. Requests are rate limited, a person is locked out after 5 failed attempts in a row (3 to 10) until another Jira admin unlocks them, and every request, failure, lock and unlock is kept in hash-chained records shown on the admin page. The signer's identity stays their Atlassian account. Code signing cannot be turned on until the owner approves the text of declaration version 2.

**Approval routes (ADR-017):** a Jira admin defines routes on the admin page (stages in order groups; each stage has approver groups and "any one" or "N of the group") and binds a route to a project and issue types. On a routed issue every stage signs the same snapshot; the stage that completes the route writes the seal. A person signs at most one stage of an approval; the author of a covered change signs no stage that approves it; a rejection (with a reason) or a covered change ends the approval, and the next signature starts again at the first stage. A stage may gate target statuses: the validator lets a move to such a status pass once that stage and every earlier group are signed. Issues with no route keep the plain seal.

LedgerSeal is tamper-evident, not tamper-proof: it detects changes, it does not stop them. Where a status lock fits, also set the workflow property `jira.issue.editable` to `false`. LedgerSeal does not provide regulated electronic signatures by itself, and it does not ask the signer to log in again. Your own validation and procedures decide whether it fits a regulated process.

Built on Atlassian Forge. The app backend makes no outbound network calls, and the panel icon is bundled with the app.

## How it decides

- **Separation of duties:** a user who changed covered content after the last seal (a covered field in Jira's change log, a comment or work log they added or edited, an attachment they added) cannot approve the changes, revoke the seal, or seal again after another approver revokes it. Status, Rank and Sprint changes do not count. Jira does not record who deleted a comment or a work log, so a deletion cannot be attributed.
- **What was seen is what is sealed:** the panel sends the hash of the issue as it showed it; a seal is refused if the issue changed since. On the transition screen the same rule applies with the screen's values: a covered field or a comment typed on the signing screen blocks the transition, so use a screen with only the LedgerSeal signature field (canonical form 2.3.0 leaves that field out of the hash; a seal made before 2.3.0 shows a change when the field is first set, and must be approved again).
- **Restricted comments and work logs (F-06, M-11):** Comments and work logs restricted to a project role or group are covered only when Jira lets the LedgerSeal app read them, that is when the app's user is in that role or group; otherwise a change to such a comment or work log is not detected. A covered comment that is restricted, at the seal or now, is shown in the panel only to a user who can see it in Jira; others see that a comment changed, without its text, author or time. The panel shows only the number of work logs, never their text. The evidence is exported only to a user who can see every such comment and work log. If LedgerSeal can no longer read a covered comment or work log (it was deleted, or restricted since to a role or group the app's user is not in), the panel shows that comment's sealed text to no one, and for that seal: its evidence is not exported to anyone; approving the changes makes a new seal whose evidence can be exported.
- **Covered fields** are chosen by field type from the site field list (`/rest/api/3/field`). Rank, Sprint, SLA timers, satisfaction, request participants, approvals, development summary, Sentiment, forms counts, Agent Sessions, status, resolution and Jira's own timestamps are left out, and the panel lists each with the reason. Every other field with a value is covered.
- **Trust:** the panel and the validator decide only from app storage, which only the app can read and write. The `ledgerseal-cert` property is an output for other tools. Any user who can edit an issue can change its properties, so a reader must check the signature.
- **Integrity check:** every read recomputes the hash of the stored seal record and the stored snapshot. A mismatch shows "the seal record failed its integrity check".
- **Limits:** the vendor holds the signing key, so a valid signature shows that LedgerSeal wrote the attestation, not that the vendor could not. Changes are recorded from Jira issue, comment, attachment and work log events, which can arrive up to 3 minutes late, and are checked again whenever someone opens the panel or runs a transition.

## Modules and scopes

| Module | Purpose |
|---|---|
| `jira:issuePanel` `ledgerseal-panel` | UI Kit panel: seal, approve changes, history |
| `jira:issueContext` `ledgerseal-context` | "Approval seal" entry in the issue details column: the seal state without opening the panel (F-12) |
| `jira:workflowValidator` `ledgerseal-validator` | Blocks a transition unless the issue is sealed and unchanged; seals the issue first when the LedgerSeal signature field on the transition screen holds the transitioning user's own signing intent (ADR-018) |
| `jira:customField` `ledgerseal-signature` | "LedgerSeal signature": a Jira admin adds it to a transition screen; the person signs in it during the transition. Its value is only a single-use intent id, never a code; the issue view shows that id (who signed and when is in the panel) |
| `jira:issueAction` `ledgerseal-sign-action` | "Sign with LedgerSeal" in the issue's actions menu: the panel, for any transition without the field |
| `jira:adminPage` `ledgerseal-admin` | "LedgerSeal settings": Jira admins choose the approver groups, set up code signing, see and acknowledge security alerts, and define and bind approval routes |
| `trigger` `ledgerseal-issue-changed`, `ledgerseal-issue-deleted` | Record a change when Jira reports it; delete a deleted issue's records |
| `scheduledTrigger` `ledgerseal-personal-data-report` | Weekly personal data report; converts records made before ADR-011 |

| Scope | Why |
|---|---|
| `read:jira-work` | Read the issue, comments, change log, field list and the user's own permissions |
| `write:issue.property:jira` | Write the app's own `ledgerseal-cert` issue property (the granular scope for issue properties). The app never edits issue fields |
| `read:jira-user` | Read display names to show who changed an item (never stored), the caller's own groups, and groups for the admin page |
| `storage:app` | Keep seal records, history and the token-to-account map |
| `report:personal-data` | Report the account ids the app holds every week, and erase closed accounts (ADR-011) |
| `send:notification:jira` | Email a signer their own single-use signing code, only in code-signing projects (ADR-016). The app emails nothing else |

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
| `ls3:sig:policy`, `ls3:sig:policyver:{n}` | Code-signing settings, each version created once and hash-chained |
| `ls3:sig:key` (Forge secret store) | The site key that hashes signing codes |
| `ls3:sig:chal:*`, `ls3:sig:used:*`, `ls3:sig:chalfail:*`, `ls3:sig:fail:*`, `ls3:sig:req:*` | Code requests (keyed hash only) and the claims for single use, failures and rate limits; they expire |
| `ls3:sig:state:{token}`, `ls3:sig:ev:{token}:{seq}`, `ls3:sig:alert:{seq}` | Lockout state, each person's signing history, and the site alert log (hash-chained) |
| `ls3:route:{routeId}`, `ls3:routever:{routeId}:{version}`, `ls3:routebind:{projectId}:{issueTypeId or all}` | Approval routes (each version created once, hash-checked) and their bindings |
| `ls3:run:{issueId}`, `ls3:runcontent:{contentId}:{part}` | The issue's approval run (hash-checked) and the snapshot its stages sign, while it runs |
| `ls3:intent:{id}`, `ls3:intentuse:{id}` | A signing intent from the transition screen (party token, issue, the hash shown, the signature; valid 120 seconds) and its single-use claim; they expire after a day |

## Find issues by seal state (JQL)

The app indexes the `ledgerseal-cert` property, so filters and dashboards can use:

```
issue.property[ledgerseal-cert].status = "SEAL_BROKEN"
ledgersealStatus = "SEAL_BROKEN"
ledgersealEverCompromised = "true"
ledgersealIncidents > 0
ledgersealApproval = "OPEN"
```

A routed issue's property is schema 4: schema 3 plus `approval` (`runState`, `stagesComplete`, `stagesTotal`, `routeHash`); before its first seal it has no `status` and no `certificateId`.

The property is a summary for searching. Any user who can edit an issue can change its properties, so check the signature (see below) before relying on a value.

## Evidence for an auditor

The `seal-evidence-api` resolver returns a JSON export: a signed attestation of the stored seal, the canonical snapshot that was hashed, and the full history. An auditor checks it without access to LedgerSeal:

```bash
node ../../tools/verifier/verify-evidence.mjs evidence.json keys/ls-dev-2026-11.pub.pem    # development install
node ../../tools/verifier/verify-evidence.mjs evidence.json keys/ls-prod-2026-11.pub.pem   # production (Marketplace) install
node ../../tools/verifier/verify-evidence.mjs --self-test
```

`tools/verifier` is the one copy of the open verifier in this repository. It is identical to the public repository https://github.com/asymmsystems/jira-governance-code-cli (Apache-2.0), where auditors download it.

The verifier uses the Node standard library only. It exits 0 only when the snapshot hash, the history chain, the certificate and the signature all pass. Evidence with code-signed rows or an approval route has `format: "ledgerseal-evidence/2"`; use verifier 1.4.0 or later for it.

The full design is in `docs/spec/ledgerseal-spec-v4.md` (v3 frozen).

## Tests

Measured on the last change to this file (2026-11-08, regulated build Phase 4):

| Measure | Value |
|---|---|
| Tests | 765 in 59 suites |
| Coverage (all files in `src/` except the UI Kit component files; the view models are included) | statements 98.15%, branches 93.98%, functions 97.96%, lines 98.83% |

Install the shared UI package first; its `prepare` step builds it with its own TypeScript:

```bash
cd ../../packages/asymm-jira-ui && npm ci
cd ../../apps/ledgerseal && npm ci
npm test
npm run build
npm audit --omit=dev --audit-level=high
```
