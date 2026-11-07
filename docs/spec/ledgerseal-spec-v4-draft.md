# LedgerSeal: Technical Specification v4 (DRAFT, delta from v3)

> **DRAFT, PENDING THE OWNER'S APPROVAL.** Nothing in this file is built or deployed. It states only what changes from `docs/spec/ledgerseal-spec-v3.md`; everything not named here stays as in v3. Each feature has its own ADR, status Proposed:
> - ADR-016 `architecture/decision/adr-00016-ledgerseal-part11-signing-credential.org` (section 2)
> - ADR-017 `architecture/decision/adr-00017-ledgerseal-approval-routes.org` (section 3)
> - ADR-018 `architecture/decision/adr-00018-ledgerseal-sign-on-transition.org` (section 4)
>
> When the owner approves, v3 is frozen and this delta is merged into a full `ledgerseal-spec-v4.md`.

- **Base:** spec v3 (version 3.0.0, canonical form 2.2.0, attestation schema 3), master `a66c172`.
- **Proposed versions:** canonical form 2.3.0 (feature 3 only), attestation schema 4 (feature 2 only), evidence format `ledgerseal-evidence/2` (features 1 and 2), open verifier 1.4.0 (current release v1.3.0).
- **Why:** the Data Center to cloud gap research, `docs/launch/research/dc-migration-gap-2026-11.md`, section 4 ranks 1 to 3.

---

## 1. Summary of the delta

| v3 section | Change | Feature |
|---|---|---|
| 1 Executive summary | "does not perform the two-component signing of 11.200" becomes true only while Part 11 signing mode is off | 1 |
| 2 Invariants | New invariants 14 to 18 (section 5) | 1, 2, 3 |
| 3.2 Domain model | New run rows, route, credential and intent types | 1, 2, 3 |
| 4 Canonical form | 2.3.0 excludes LedgerSeal's signature field; route canonical JSON | 2, 3 |
| 5 Manifest | New `jira:customField`; new scope for alerts; new index path | 1, 2, 3 |
| 6 Storage | New key families `ls3:sig:*`, `ls3:route*`, `ls3:intent*` | 1, 2, 3 |
| 7 Seal flows | Credential check step; stage signing, reject, void | 1, 2 |
| 8 Attestation | Schema 4 adds `approval`; `status` unchanged | 2 |
| 9 Validator | Stage gates; signing intents | 2, 3 |
| 10 Declaration | Version 2 for Part 11 mode (owner's wording) | 1 |
| 11 Evidence and verifier | Format 2; verifier 1.4.0 checks 6 to 10 | 1, 2 |
| 13 Decisions | D-12 to D-14 | 1, 2, 3 |

---

## 2. Feature 1: signing credential for 21 CFR 11.200 and 11.300 (ADR-016)

### 2.1 Behaviour
- A Jira admin turns on **Part 11 signing** on the admin page and names: the signing administrator groups (party role `LS_SIGNING_ADMIN`), the alert issue, the credential lifetime (default 365 days, 30 to 730) and the lockout threshold (default 5, fixed range 3 to 10).
- While the mode is on, seal, reseal, revoke, stage signature and rejection need the signing ID and a current TOTP code. While it is off, v3 behaviour is unchanged.
- A user without an active credential sees "You need a LedgerSeal signing credential. Ask a signing administrator." and no signing button.

### 2.2 Credential lifecycle

| State | Entered by | Leaves to |
|---|---|---|
| `ISSUED` | A signing administrator, for another person, with a signing ID; makes a one-time enrolment code (24 hours) | `ACTIVE` (enrolled), `REVOKED`, `EXPIRED` (code not used) |
| `ACTIVE` | The user enters the enrolment code and confirms two consecutive codes | `LOCKED`, `REVOKED`, `LOST`, `EXPIRED` |
| `LOCKED` | N failed attempts in a row | `ACTIVE` (a signing administrator unlocks, with a reason), `REVOKED` |
| `LOST` | The user reports the device lost or compromised | terminal; replacement is a new issuance under the same signing ID |
| `REVOKED` | A signing administrator (reason), or account closure (ADR-011 job) | terminal |
| `EXPIRED` | Lifetime reached (checked at use and weekly) | terminal; renewal is a new issuance under the same signing ID |

A signing administrator cannot issue, unlock or revoke their own credential.

### 2.3 Seal flow change (v3 section 7.3)
New step 3a, after the permission check, when the mode is on: verify the credential. Payload gains `signing: { signingId, code }`. Failure codes: `NO_CREDENTIAL`, `CREDENTIAL_LOCKED`, `CREDENTIAL_EXPIRED`, `SIGNING_FAILED` (wrong ID or code; the message never says which), `CODE_REUSED`. The code and the ID are never logged, stored or returned.

### 2.4 Verification algorithm
1. Normalise the typed ID (trim, Unicode NFC, lowercase). Compare `HMAC-SHA-256(siteKey, id)` with the stored `idHash` using `timingSafeEqual`.
2. Read the seed with `kvs.getSecret`. Compute TOTP (RFC 6238, HMAC-SHA-1, 6 digits, 30 s) for steps T and T-1. Compare with `timingSafeEqual`.
3. On a match at step S: claim `ls3:sig:step:{credentialId}:{S}` with `FAIL_IF_EXISTS`. If it exists, answer `CODE_REUSED` (counts as a failure).
4. On failure: claim `ls3:sig:fail:{credentialId}:{revision}:{n}` for the next free n (`FAIL_IF_EXISTS`, so concurrent failures take distinct n). When n reaches the threshold, move to `LOCKED`. Write an event and an alert.
5. On success: the failure count resets (a new `revision` of the failure series), and an event `SIGN_OK` names the issue and the history seq.

### 2.5 Signature row data (v3 section 3.2, `WorkEffortStatus.data`)
```typescript
signing?: {
  method: 'LS_ID_TOTP_1';
  credentialId: string;        // random 128-bit id, base64url; not an account id
  credentialRevision: number;  // increases at each issuance under the same signing ID
  components: 2;
  mode: 'PART11';
}
```
Absent when the mode is off. The verifier (section 3.7) requires it on rows signed after the mode was turned on, as stated by the site policy row (below).

### 2.6 High-level design

**Data model**
```typescript
interface SigningCredential {          // ls3:sig:cred:{partyToken}
  schemaVersion: 1;
  credentialId: string;
  partyId: string;                     // party token (ADR-011)
  signingIdHash: string;               // HMAC-SHA-256(site key, normalised ID)
  signingIdText: string | null;        // shown to the user and admins; null after account closure
  state: 'ISSUED' | 'ACTIVE' | 'LOCKED' | 'LOST' | 'REVOKED' | 'EXPIRED';
  revision: number;
  issuedByPartyId: string; issuedAt: string;
  enrolmentCodeHash: string | null;    // scrypt hash of the one-time enrolment code, null once used
  enrolmentExpiresAt: string | null;
  activatedAt: string | null; expiresAt: string | null;
  failSeries: number;                  // which ls3:sig:fail series is current
  eventHead: { seq: number; entryHash: string };
  recordHash: string;
}
interface SigningEvent {               // ls3:sig:ev:{partyToken}:{seq}, created once, chained
  seq: number; at: string;
  kind: 'ISSUED' | 'ENROLLED' | 'TESTED' | 'SIGN_OK' | 'SIGN_FAIL' | 'LOCKED' | 'UNLOCKED' | 'LOST' | 'REVOKED' | 'EXPIRED';
  byPartyId: string | null;            // the actor; null for the app
  issueId?: string; historySeq?: number; reason?: string;
  prevEntryHash: string; entryHash: string;
}
interface SigningPolicy {              // ls3:sig:policy, chained versions in ls3:sig:policyver:{n}
  enabled: boolean; adminGroups: { id: string; name: string }[];
  alertIssueId: string | null; lifetimeDays: number; lockoutThreshold: number;
  declarationVersion: string; setByPartyId: string; fromDate: string;
}
```

**Storage keys** (new; all under `storage:app`)

| Key | Value | Notes |
|---|---|---|
| `ls3:sig:secret:{credentialId}` | TOTP seed, base32 | `kvs.setSecret`; deleted on `LOST`, `REVOKED`, `EXPIRED` |
| `ls3:sig:cred:{partyToken}` | `SigningCredential` | one current credential per person |
| `ls3:sig:id:{signingIdHash}` | `{ partyId, firstIssuedAt }` | created once, never deleted: no reuse (11.100(a)) |
| `ls3:sig:ev:{partyToken}:{seq}` | `SigningEvent` | append-only chain, as v3 history |
| `ls3:sig:step:{credentialId}:{step}` | `{ at }` | replay guard; removed by the weekly job after 1 day |
| `ls3:sig:fail:{credentialId}:{series}:{n}` | `{ at, issueId? }` | failure counter without compare-and-set |
| `ls3:sig:alert:{at}:{id}` | `{ kind, partyId, issueId?, notified: boolean, ackBy?, ackAt? }` | admin page alert list |
| `ls3:sig:policy`, `ls3:sig:policyver:{n}` | `SigningPolicy` | each version created once |

A secret write cannot be shown to join a `kvs.transact()` (not documented, spike S-7). So enrolment writes the secret first, then the credential state in a transaction; an orphan secret of a credential still `ISSUED` is harmless and is removed by the weekly job.

**Resolvers** (each starts with the v3 identity, licence and Browse checks where an issue is involved)

| Resolver | Who | Does |
|---|---|---|
| `signing-policy-get-api`, `signing-policy-set-api` | Jira admin | read and save the mode and settings |
| `signing-credential-issue-api` | signing admin, not for self | create `ISSUED`, return the enrolment code once |
| `signing-credential-list-api` | signing admin | list credentials (state, ID text, dates), never secrets |
| `signing-credential-unlock-api`, `signing-credential-revoke-api` | signing admin, not for self | change state, with a reason |
| `signing-enrol-start-api` | the user | check the enrolment code; create the seed; return the `otpauth://` URI and the seed text once |
| `signing-enrol-confirm-api` | the user | two consecutive codes; `ACTIVE` |
| `signing-test-api` | the user | verify a code; event `TESTED`; signs nothing |
| `signing-report-lost-api` | the user | `LOST` at once |
| `signing-alerts-api` | signing admin | list and acknowledge alerts |
| `seal-issue-api`, `revoke-seal-api` (changed) | approver | step 3a |

**UI surfaces** (UI Kit)
- Admin page `ledgerseal-admin`: new tabs "Part 11 signing" (Jira admin) and "Signing credentials" and "Security alerts" (signing admins).
- Issue panel: the seal, approve, revoke and stage forms gain "Signing ID" and "Code from your authenticator" fields (one paste-able field, `autocomplete="one-time-code"` where UI Kit allows it, no timer). A "My signing credential" section: enrol, test, report lost.
- Enrolment lives in the panel and in a new `jira:globalPage` "LedgerSeal signing", so a user can enrol without opening an issue (open question Q-04 covers the QR rendering).

**Alerts**
- `POST /rest/api/3/issue/{alertIssueId}/notify` as the app, `to.groupIds` = the signing admin groups, subject "LedgerSeal: failed signing attempt", body with the issue key, the time and the party token. No ID text, no code.
- 403 (outgoing email off) or any failure: the alert keeps `notified: false`, and every signing admin sees a banner "LedgerSeal could not email this alert" on the admin page and in the panel.

**Personal data (ADR-011 addition)**
- The weekly job revokes the credential of a closed account, deletes its seed, sets `signingIdText` to null, and keeps `ls3:sig:id:{hash}` and the events (party tokens only).
- The weekly report adds the account ids behind `issuedByPartyId` and alert acknowledgers through the existing party map; no new account id store.

**Runtime and dependencies**
- `node:crypto` only (`createHmac`, `randomBytes`, `timingSafeEqual`, `scrypt` for the enrolment code). Stays on `nodejs22.x`.
- QR code: a small encoder in `src/domain/` or a dependency (open question Q-04). A seed in text is always shown as well.

### 2.7 Security questionnaire changes (`docs/marketplace/submission/ledgerseal-security-questionnaires.md`)
- Q11 (Atlassian credentials): stays **No**.
- Q12 (third-party credentials): stays **No**.
- Q13 (secrets): becomes "The app holds its attestation key (encrypted Forge variable) and, when Part 11 signing is on, one TOTP seed per enrolled user in Forge secret storage (`kvs.setSecret`)".
- Q8 (logging): add the signing ID and the code to the list of values never logged, with a test.
- Q7 (scopes): add the alert scope (Q-02).

---

## 3. Feature 2: multi-step approval routes (ADR-017)

### 3.1 Behaviour
- A Jira admin defines routes on the admin page and binds each to a project and issue types.
- The panel shows the route: each stage, its quorum, who signed, and which stages are open. A person sees "Sign as {stage}" only for open stages they qualify for; "Reject" next to it.
- With no binding, LedgerSeal behaves as in v3.

### 3.2 Run state machine (new; the seal state machine of v3 section 3.2 is unchanged)

| From | Event | To | Row written |
|---|---|---|---|
| no run | first stage signature | `OPEN` | `LS_RUN_SIGNED` / `SIGN_STAGE` |
| no run | first signature completes a one-stage route | `COMPLETE` | `LS_SEALED` / `SEAL` or `RESEAL` (as v3) |
| `OPEN` | stage signature, route not complete | `OPEN` | `LS_RUN_SIGNED` / `SIGN_STAGE` |
| `OPEN` | stage signature completes the last order group | `COMPLETE` | `LS_SEALED` / `SEAL` or `RESEAL` |
| `OPEN` | rejection | `REJECTED` | `LS_RUN_REJECTED` / `REJECT` |
| `OPEN` | covered change | `VOIDED` | `LS_RUN_VOIDED` / `VOID` |
| `OPEN`, while an earlier seal exists | revoke of that seal | `VOIDED` | `LS_REVOKED` / `REVOKE` (as v3, data `endsRun: true`); with no seal, a run ends only by rejection or change |
| `REJECTED`, `VOIDED`, `COMPLETE` | next stage signature | `OPEN` (new run) | `LS_RUN_SIGNED` |

### 3.3 Stage signing contract (`seal-issue-api`, extended)
Payload adds `stageId`. Steps after v3 step 6: resolve the route (binding, then pinned version of the open run); check the stage is open; check the caller is in a stage group (as user) and has not signed another stage of this run; check the separation of duties of v3 section 7.2 for every stage; check `viewHash` equals the run's snapshot hash (a new run takes the live hash); write the row. The first row of a run stores the snapshot content (`ls3:content:`), so every stage signs the same stored content.

`reject-stage-api`: payload `{ stageId, reason, signing? }`; same checks; writes `LS_RUN_REJECTED`.

### 3.4 Attestation schema 4 (v3 section 8)
Adds, only for an issue with a bound route:
```json
"approval": { "runState": "OPEN | REJECTED | VOIDED | COMPLETE", "stagesComplete": 1, "stagesTotal": 2, "routeHash": "64 hex" }
```
`status`, `certificateId`, `snapshotHash`, `sealedAt` keep their schema 3 names, types and meanings. Before the first seal the property has `schemaVersion`, `issueId`, `approval`, `issuedAt`, `keyId`, `sig` only. New index path `approval.runState` (string, alias `ledgersealApproval`). Issues with no route keep schema 3.

### 3.5 Validator (v3 section 9)
New rows:

| Case | `result` | `errorMessage` |
|---|---|---|
| The target status is gated by stage S, and S and every earlier group have their quorum in the open run or the seal | true | none |
| The target status is gated by stage S, which lacks its quorum | false | "LedgerSeal: this move needs the {stage} approval ({k} of {n} signed). Sign in the LedgerSeal panel." |
| The route is not complete, at a fully gated transition | false | "LedgerSeal: approval is in progress ({done} of {total} stages). The last stage must sign before this move." |
| The last run was rejected | false | "LedgerSeal: {stage} rejected this issue on {date} (reason: {reason}). Start the approval again in the LedgerSeal panel." |

### 3.6 High-level design

**Data model**
```typescript
interface RouteStage {
  stageId: string;                     // stable within a route, [a-z0-9-]{1,32}
  name: string;                        // 1 to 60 characters
  orderGroup: number;                  // 1 to 8
  roleTypeId: 'LS_APPROVER' | 'LS_REVIEWER' | 'LS_VERIFIER';
  approverGroups: { id: string; name: string }[];   // 1 to 10, ids checked in Jira
  quorum: { kind: 'ANY' } | { kind: 'N'; n: number }; // n 1 to 10
  gatesStatusIds: string[];            // target statuses this stage gates, at most 10
}
interface RouteVersion {               // ls3:routever:{routeId}:{version}, created once
  schemaVersion: 1; routeId: string; version: number; name: string;
  stages: RouteStage[];                // 1 to 8
  reapprovalStageIds: string[] | null; // null: the full route (Q-06)
  setByPartyId: string; fromDate: string;
  routeHash: string;                   // SHA-256 of canonical JSON of every other field
}
interface ApprovalRun {                // on SealedWorkEffort.run
  runId: string; routeId: string; routeVersion: number; routeHash: string;
  state: 'OPEN' | 'REJECTED' | 'VOIDED' | 'COMPLETE';
  snapshotHash: string; contentId: string; startedSeq: number;
  stageCounts: Record<string, number>; // distinct signers per stage
  signatureRows: { seq: number; entryHash: string; stageId: string; partyId: string }[]; // at most 80
}
```
`SealedWorkEffort` gains `run?: ApprovalRun` (covered by `recordHash`); its size budget moves from under 4 KiB to under 16 KiB. `WorkEffortPartyAssignment` gains `stageId?` and `runId?`.

Row data:
- `LS_RUN_SIGNED`: `{ runId, routeId, routeVersion, routeHash, stageId, qualifyingGroupId, snapshotHash, signing? }`
- `LS_SEALED` at the end of a run: as v3 plus `{ runId, routeHash, routeVersion, stageId, stageSignatures: [entryHash...] }`
- `LS_RUN_REJECTED`: `{ runId, stageId, snapshotHash, signing? }` with `reason`
- `LS_RUN_VOIDED`: `{ runId, liveHash, changes }` (as an incident's data, without changing `everCompromised`)

**Storage keys** (new)

| Key | Value |
|---|---|
| `ls3:route:{routeId}` | `{ routeId, currentVersion, name }` |
| `ls3:routever:{routeId}:{version}` | `RouteVersion`, created once |
| `ls3:routebind:{projectId}:{issueTypeId or *}` | `{ routeId, setByPartyId, fromDate }` |

The binding lookup is two direct reads (issue type, then `*`), no query.

**Resolvers**: `route-list-api`, `route-get-api`, `route-save-api` (new version), `route-bind-api`, `route-unbind-api` (all Jira admin, as v3 section 7.1 admin checks; group ids checked by `/rest/api/3/group/bulk`; status ids by `/rest/api/3/statuses/search`, `read:jira-work`); `reject-stage-api` (new); `seal-issue-api`, `verify-issue-api`, `seal-history-api`, `seal-evidence-api` (extended). `PanelData` gains `route?: { name, stages: [{ stageId, name, quorum, signed: [{ partyId, at }], open, canSign, canReject }], runState }`; the 16 KiB budget stays.

**UI surfaces**: admin page tab "Approval routes" (list, edit stages, bind to project and issue types); the panel's seal section becomes a stage list when a route applies; the issue context entry shows "In approval: 1 of 2".

**Canonical form of a route**: canonical JSON as v3 section 4.1 of the `RouteVersion` without `routeHash`; arrays keep their order except `approverGroups` and `gatesStatusIds`, sorted by id. New vectors in `tools/verifier/vectors-route-1.json`.

### 3.7 Evidence format 2 and verifier 1.4.0 (v3 section 11)
- `seal-evidence-api` returns `format: "ledgerseal-evidence/2"` when the history holds a run row, a stage-signed seal or a `signing` object, and `ledgerseal-evidence/1` otherwise (unchanged bytes for every existing issue).
- Format 2 adds `routes: RouteVersion[]` (each version named by the history) and `signingPolicies: SigningPolicy[]` (versions in force, without group names if the owner prefers, Q-11).
- Verifier 1.4.0, for format 2 only, adds:
  6. each route version's hash recomputes;
  7. every `LS_RUN_SIGNED` row of the sealing run, and the `LS_SEALED` row, carry the attestation's `snapshotHash`, and `stageSignatures` equals the run's signature rows;
  8. quorum per stage (distinct `setByPartyId`) and order groups signed in order;
  9. no party signs two stages of one run;
  10. a row after a Part 11 policy version came into force carries `signing` with `components: 2`.
- Check 4 skips `LS_RUN_SIGNED`, `LS_RUN_REJECTED` and `LS_RUN_VOIDED` rows, as it skips `LS_REDACTED`.
- A format-1 file gives the same output and exit code as v1.3.0 (tested with every existing fixture).
- Compatibility of v1.3.0 with format 2: a finished routed seal passes checks 1 to 5 but its route is not checked; an issue still in approval fails check 3 or 4. v1.3.0 never passes a record that is not sealed. The verifier README and the user guide say "use 1.4.0 or later for format 2". Version number: 1.4.0, because no existing result changes (Q-09).

### 3.8 Migration
None of the stored data changes. Existing seals have no `run` and are read as the implicit route. Binding a route affects the next signature on each issue. The weekly conversion job of ADR-011 is untouched.

---

## 4. Feature 3: signing while transitioning (ADR-018)

### 4.1 Behaviour
- A Jira admin adds the "LedgerSeal signature" field to a transition screen and the Require Valid LedgerSeal validator to that transition.
- In the transition dialog the field shows the declaration, the stage (or meaning), and "Signing ID" and "Code" inputs, with a "Sign" button inside the field. After a good signature it shows "Signed. Select Transition to finish." and holds only the intent id.
- The panel and an issue action modal "Sign with LedgerSeal" stay available for every case the field cannot serve.

### 4.2 Manifest (v3 section 5)
```yaml
jira:customField:
  - key: ledgerseal-signature
    name: LedgerSeal signature
    type: string
    edit: { resource: signature-edit, render: native, experience: [issue-transition] }
    view: { resource: signature-view, render: native, experience: [issue-view] }
    resolver: { function: resolver }
jira:issueAction:
  - key: ledgerseal-sign-action
    title: Sign with LedgerSeal
    resource: main
    render: native
```
The YAML is indicative; key names are checked by `forge lint` when built.

### 4.3 Canonical form 2.3.0 (v3 section 4)
The rules of 2.2.0, plus one exclusion: a field whose `schema.custom` is LedgerSeal's own `ledgerseal-signature` field type (matched by the app id and the module key, in both development and production) is excluded, with the reason "LedgerSeal's own signature field". New seals use 2.3.0. 2.0.0 to 2.2.0 are unchanged. New vectors `apps/ledgerseal/test/fixtures/vectors-2.3.0.json` and verifier self-test cases. The verifier recomputes the snapshot hash from the exported canonical form, so it needs no rule change.

### 4.4 Validator (v3 section 9), new rows

| Case | `result` | `errorMessage` |
|---|---|---|
| Field holds an intent; intent valid, user matches, hash matches | signature written, then the normal gate | per gate |
| Intent expired or used | false | "LedgerSeal: this signature expired or was already used. Sign again in the LedgerSeal field." |
| Payload has no user, or a different user | false | "LedgerSeal: the person moving the issue is not the person who signed. Sign again." |
| The screen changed covered content | false | "LedgerSeal: fields on this screen changed the approved content. Use a screen with only the LedgerSeal signature field, or sign in the panel." |

### 4.5 Intent contract
`transition-sign-intent-api`, payload `{ viewHash, stageId?, meaning, declarationVersion, declarationText, signing: { signingId, code } }`. It runs v3 steps 1 to 7 and feature 1 step 3a, but instead of writing the seal it writes `ls3:intent:{intentId}` = `{ partyId, issueId, viewHash, stageId, meaning, declaration, signingEvidence, expiresAt (now + 120 s) }` and returns `{ intentId }` (random, 128 bits). The edit view then calls `view.submit(intentId)`. The validator claims `ls3:intentuse:{intentId}` with `FAIL_IF_EXISTS` before it writes the signature.

### 4.6 High-level design
- **Data model:** `SigningIntent` (above); signature rows add `via: 'PANEL' | 'ISSUE_ACTION' | 'TRANSITION_SCREEN'` and, for the last, `transitionToStatusId`.
- **Storage keys:** `ls3:intent:{intentId}` (deleted by the weekly job after 1 day), `ls3:intentuse:{intentId}`.
- **Resolvers:** `transition-sign-context-api` (what the field shows), `transition-sign-intent-api`; the validator function `validate-transition` gains the intent branch; shared service code with `seal-issue-api` so both paths write the same rows.
- **UI surfaces:** the field edit view (UI Kit), the field issue-view (shows "Signed by ... at ..." from the panel data, not from the field value), the issue action modal.
- **Verifier:** no change beyond 2.3.0 vectors; `via` is in the hashed row, so it is covered by the chain check.
- **Migration:** none; the field is new. Seals made before 2.3.0 keep their version, so adding the field to a screen does not break them unless someone sets the field on an issue sealed under 2.2.0 or earlier. Then that seal shows CHANGED (the field is covered under 2.2.0). The admin guide says to approve once after adding the field, or the app treats a change of only this field type as a non-content change for older versions too (open question Q-12).

### 4.7 Platform spikes (before any build; on the development site, isolated project LSP)
| Id | Question | Pass condition | If it fails |
|---|---|---|---|
| S-1 | Does a Forge custom field's UI Kit edit view render and call its resolver on the new transition dialog? (Docs list `issue-transition` but the limitations section names only view and create screens.) | Field renders, `invoke` works, `view.submit` sets the value | Build ADR-018 fallback only |
| S-2 | Does the function validator payload carry the transitioning user and the Forge field in `modifiedFields`? (Spec v3 saw `user` live on 2026-11-06; docs do not list it.) | Both present on board drag and issue view transitions | Fallback only |
| S-3 | Does Jira field history show only the intent id, never the typed code? | Only the submitted value appears | Redesign the edit view |
| S-4 | Which entry points open the dialog with the field (issue view, board drag, list view, bulk change)? | Recorded per entry point | Documented as limits |
| S-5 | Does `POST /issue/{id}/notify` work as the app, to groups, and what does it return with email off? | 204 and an email arrives | Alerts on the admin page only; 11.300(d) row stays weaker |
| S-6 | Can UI Kit show a QR code (an `Image` with a data URI or an SVG)? | It renders | Text seed only, or a Custom UI enrolment page |
| S-7 | Can `kvs.setSecret` join `kvs.transact()`? TTL support for the step and intent keys? | Recorded | The ordered writes of section 2.6 already cover a "no" |

---

## 5. New invariants (v3 section 2)
14. **Credential at signing.** In Part 11 mode no signature, revoke or rejection row is written unless the signing ID and a fresh TOTP code were verified in the same invocation (or in the intent it consumes, ADR-018), and each code step is used once.
15. **No secret leaves the app.** The seed, the code and the signing ID text are never logged, put in a hashed row, the property or the evidence.
16. **One person, one stage.** No party signs two stages of one run.
17. **Same content for every stage.** Every signature of a run signs the run's snapshot hash; a covered change voids the run.
18. **Format stability.** Evidence of an issue with no route and no Part 11 signature stays `ledgerseal-evidence/1` with the same bytes as v3.

## 6. Compliance mapping, proposed (the site page changes only after the features ship and pass live probes)

Current rows: `asymmsystems/asymm-corporate-code-pfw`, `src/main/jbake/content/product/jira-governance/compliance.html`, origin/develop `7fcd97a`.

| Section | Today on the site | Proposed after features 1 to 3 | Why, and what stays with the customer |
|---|---|---|---|
| 11.10(e) audit trails | Supported, with the stated limit | Unchanged; adds credential events and run rows to the chained records | The vendor-rewrite limit stays |
| 11.10(f) operational checks (no row today) | not listed | **Supports** (new row): routes enforce the order of approval stages | Customer configures routes and workflows |
| 11.10(g) authority checks (no row today) | not listed | **Supports** (new row): only stage groups, approvers and credential holders sign | Customer chooses the groups |
| 11.50 manifestation | Partly met | **Unchanged: partly met** | The printed name after account closure is the ADR-011 trade-off (Q-05) |
| 11.70 linking | App signature; "auditor decides" | Unchanged wording, plus: "each signature row records the credential used; the row is in the hash chain covered by the signed attestation" | Still an app signature, not the signer's own key |
| 11.100(a) unique, not reused (no row today) | not listed | **Met by design** (new row): one credential per person; signing IDs never reassigned | Customer forbids sharing |
| 11.100(b), (c) | not listed | Customer's responsibility (stated); the app records the issuer of each credential | Identity checks; letter to FDA |
| 11.200(a)(1) two components | Not met | **Met by the technical control**: signing ID and TOTP code at every signing | Customer validation |
| 11.200(a)(2), (a)(3) | Not met | **Partly met**: the issuer never sees the seed; misuse needs the user's device and Atlassian session | Device policy; keep signing admins apart from Atlassian org admins |
| 11.200(b) biometrics | Not met | Not applicable (no biometrics) | |
| 11.300(a) uniqueness | Not met | **Met** | |
| 11.300(b) periodic revision | Not met | **Met** (expiry and re-enrolment) | Choose the period |
| 11.300(c) loss management | Not met | **Partly met**: immediate deauthorisation and controlled re-issue | Loss reporting procedure |
| 11.300(d) transaction safeguards | Not met | **Partly met**: lockout, one use per code, recorded alerts, Jira email (if S-5 passes and email is on) | The security unit's response |
| 11.300(e) device testing | Not met | **Partly met**: tested at enrolment and each use | Periodic testing procedure |

Overall wording for the listing's "Honest Compliance Boundary", proposed: "With Part 11 signing on, each signature needs the signer's LedgerSeal signing ID and a code from their own authenticator (21 CFR 11.200(a)(1)), with the 11.300 controls listed on the compliance page. Your identity checks, procedures and validation decide whether this meets your predicate rules." The owner approves the exact text (his prose).

## 7. Effort estimate (one developer with AI assistance; days include tests at the v3 quality gates, docs, live probes on the development site; not review rounds)

| Work | Days (likely) | Range |
|---|---|---|
| Spikes S-1 to S-7 | 2 | 1.5 to 3 |
| Feature 1: TOTP and credential domain, storage, events | 5 | 4 to 6 |
| Feature 1: resolvers, admin tabs, panel forms, enrolment page | 5 | 4 to 7 |
| Feature 1: alerts, personal data job, questionnaire updates | 2 | 1.5 to 3 |
| Feature 1: verifier check 10, evidence format 2 part, probes | 2.5 | 2 to 3 |
| **Feature 1 total** | **14.5** | **11.5 to 19** |
| Feature 2: route model, versions, route hash, vectors | 2.5 | 2 to 3 |
| Feature 2: admin route editor and bindings | 4 | 3 to 5 |
| Feature 2: stage signing, quorum, separation of duties, reject, void | 5 | 4 to 6 |
| Feature 2: validator stage gates; attestation schema 4; FourRealities "no status" change | 2.5 | 2 to 3 |
| Feature 2: verifier 1.4.0 checks 6 to 9, release in the public repository | 2.5 | 2 to 3 |
| Feature 2: panel stage list, context entry, probes, docs | 3.5 | 3 to 5 |
| **Feature 2 total** | **20** | **16 to 25** |
| Feature 3: custom field module, edit and view, issue action | 3 | 2.5 to 4 |
| Feature 3: intent resolver, validator branch, canonical 2.3.0 and vectors | 3.5 | 3 to 4 |
| Feature 3: probes on every entry point, admin guide | 2 | 1.5 to 3 |
| **Feature 3 total** | **8.5** | **7 to 11** |
| **All, with spikes** | **45** | **36 to 58** |

Order: spikes, then feature 1, then feature 2, then feature 3 (feature 3 needs the credential, and uses stages).

## 8. Decisions (v3 section 13, new rows)

| ID | Decision | Options considered | Choice and reason |
|---|---|---|---|
| D-12 | Two-component signing in Forge | (a) signing ID + TOTP; (b) signing ID + passphrase; (c) Atlassian session + one component | (a), ADR-016. Meets 11.200(a)(1) at every signing; the device case of 11.300(c), (e); no egress |
| D-13 | Multi-step approval | A stages on one seal; B one seal per stage; C workflow statuses; D JSM approvals | A, ADR-017. One certificate; quorum and separation of duties checkable offline |
| D-14 | Sign while transitioning | A Forge field + validator intent; B issue view then transition; C REST transition; D UIM; E post function; F condition | A with B as fallback, ADR-018. No new write scope; fails closed |

## 9. Open questions for the owner

| Id | Question | Options | Recommendation |
|---|---|---|---|
| Q-01 | Is a second device (authenticator) acceptable for your target customers? | TOTP (ADR-016); passphrase only; both as an admin choice | TOTP; add passphrase later only if customers ask |
| Q-02 | Which scope for alert emails? | `send:notification:jira` (granular, Beta); `write:jira-work` (classic, broad); no email (admin page only) | `send:notification:jira`, after spike S-5; it needs the site admin's consent at upgrade |
| Q-03 | Wording of the Part 11 declaration (version 2) | Your text | You write it; I can propose a draft in chat |
| Q-04 | QR code for enrolment | Hand-written encoder in `src/domain/` (no dependency, about 400 lines); an npm QR library; text seed only | Hand-written, if S-6 shows UI Kit can render it |
| Q-05 | 11.50: keep the printed name of the signer after account closure in Part 11 mode? | Keep ADR-011 (name not kept: 11.50 partly met); keep a name record under a legal-retention basis | Separate ADR if you want it; not in this scope |
| Q-06 | Approval of changes after a routed seal | Full route again; a configured re-approval subset | Full route by default, subset optional per route |
| Q-07 | Route edited while a run is open | Pin the run to its version; void the run | Pin |
| Q-08 | Who may edit routes? | Jira admins only; also project admins for their project | Jira admins only first |
| Q-09 | Verifier version for format 2 | 1.4.0 (no old result changes); 2.0.0 (new format) | 1.4.0 |
| Q-10 | Transition screens with covered fields or a comment | Block (ADR-018 decision 4); seal the screen's values | Block |
| Q-11 | Group names in evidence | Include (readable); ids only (less data) | Include; they are not personal data |
| Q-12 | Adding the signature field to an issue sealed before 2.3.0 | Seal shows CHANGED until approved; treat changes of only this field as non-content for older versions | Show CHANGED, and say so in the admin guide; the other choice edits old version rules, which v3 section 4.1 forbids |
| Q-13 | Lockout threshold and lifetime defaults | 5 and 365 days; other values | 5 and 365 |
| Q-14 | Listing and site copy | Change only after release and live probes; announce as "coming" earlier | After release only |

## 10. Sources
Each ADR lists its sources with URLs. The main ones:
- eCFR 21 CFR Part 11, https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11 (Title 21 up to date as of 2026-11-05)
- FDA Scope and Application (2003), https://www.fda.gov/regulatory-information/search-fda-guidance-documents/part-11-electronic-records-electronic-signatures-scope-and-application
- FDA Q&A (October 2024), https://www.fda.gov/regulatory-information/search-fda-guidance-documents/electronic-systems-electronic-records-and-electronic-signatures-clinical-investigations-questions
- 62 FR 13430 preamble, https://www.govinfo.gov/content/pkg/FR-1997-03-20/html/97-6833.htm
- Forge: resolver context, secret storage, runtime, limits, Runs on Atlassian, custom field, UI modifications, validator, post function, condition, issue action (URLs in ADR-016 and ADR-018)
- Jira REST v3 OpenAPI, https://developer.atlassian.com/cloud/jira/platform/swagger-v3.v3.json
- RFC 6238, https://www.rfc-editor.org/rfc/rfc6238 ; NIST SP 800-63B-4, https://pages.nist.gov/800-63-4/sp800-63b.html ; WCAG 2.2 SC 3.3.8, https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html
- Appfire ES cloud FAQ, https://support.appfire.com/space/ESF/17498212/ES+cloud+-+FAQ
