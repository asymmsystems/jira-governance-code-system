<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# LedgerSeal regulated build: Phase 1 platform spikes

- **When:** 2026-11-08 (Colombo time; the Forge log and the Jira API answer in UTC, 2026-11-07T20:24Z to 22:31Z).
- **Where:** the development site `asymmsystems.atlassian.net`, Forge environment `development`, the isolated test project LSP (id 10035, its own workflow "Software Simplified Workflow for Project LSP"), issue LSP-4 (id 10072).
- **Build:** development version **6.0.0**, deployed from branch `feature/ledgerseal-regulated` (Phase 0 tree plus the spike code), with `forge deploy -e development --approve MAJOR_VERSION_RULE` (major: new scope) and `forge install --upgrade` on the development site. Forge reported it eligible for Runs on Atlassian.
- **Spike code:** `docs/sdlc/ledgerseal-regulated-2026-11/spike/` (`spike-backend.ts`, `spike-page.tsx`, `sig-edit.tsx`, and `spike-wiring.diff` with the manifest and `src/index.ts` lines). It was removed from `apps/ledgerseal/src` after the spikes; nothing of it ships.
- **Who:** run by the developer in the owner's signed-in browser session (account `712020:0c24...4b771`).
- **Design questions:** spec v4 section 16.7 (S-1 to S-8) and ADR-016 Q-01 (S-8).

## 1. Summary

| Id | Question | Result | Consequence |
|---|---|---|---|
| S-1 | Does the UI Kit edit view of a Forge custom field render on the new transition dialog, call its resolver and submit a value? | **Pass** | ADR-018 option A is built |
| S-2 | Does the validator payload carry the transitioning user and the Forge field in `modifiedFields`? | **Pass** (issue view and board drag) | The validator checks the intent's party against `user.accountId` |
| S-3 | Does Jira's field history show only the submitted value, never what was typed? | **Pass** | The intent id is the only value; the code never enters the field |
| S-4 | Which entry points open the dialog with the field? | Issue view, board drag, list view: **yes**. REST transition: no screen, blocked by the gate. Bulk change: **not tested** | Bulk change and every path without the field fail closed (no intent, the normal gate decides) |
| S-5 | Does `notify` work as the app; what with email off? | **Pass** as the app (204, delivered). Email off: not tested live (the OpenAPI says 403); groups: not tested (no alert email, Q-02) | `CODE_NOT_SENT` for any status other than 204 |
| S-6 | Can UI Kit show an image from an SVG data URI? | **Pass** | Not needed under option B (no enrolment); kept for option C |
| S-7 | Secret store and transactions; TTL | `setSecret` and `getSecret` work; `setSecret` with `FAIL_IF_EXISTS` refuses an existing key (`KEY_CONFLICT`); a transaction has only `set`, `delete`, `check`, `execute` (no secret); TTL works on `set`, `setSecret` and inside a transaction; `query` does not list secret keys; `get` of a secret key returns nothing | The site signing key is created once with `setSecret` `FAIL_IF_EXISTS`; challenge, claim and intent keys use TTL |
| S-8 | The second component (ADR-016 Q-01): can the app email the signer themself whatever the own-changes setting; which scope; latency; is the code kept out of the issue? | **Pass on all four** | **Option B is chosen.** Option C is not built |

## 2. S-8: the emailed single-use code (ADR-016 Q-01)

### 2.1 Method
A spike resolver (`spikeNotify`, `spike/spike-backend.ts`) called `POST /rest/api/3/issue/10072/notify` with `to.users = [the caller]`, a subject "LedgerSeal spike {nonce}" and a body holding a 6-digit code, the nonce and the send time, either as the app (`api.asApp()`) or as the user (`api.asUser()`). The scope in the manifest was `send:notification:jira`. Receipt was read in the owner's mailbox (Gmail; `fahim@asymm.systems` delivers there) by subject nonce. The owner's setting "notify me about my own changes" is the user preference `user.notify.own.changes` (`GET`/`PUT /rest/api/3/mypreferences`); it was `false` before the spike and was set back to `false` after it (PUT 204, read back `false`).

### 2.2 Results

| Setting `user.notify.own.changes` | Caller | Nonce | API answer | Sent (app clock, UTC) | In the mailbox (UTC, whole seconds) | Delay |
|---|---|---|---|---|---|---|
| false (owner's own value) | app | 79db419e | 204 | 20:24:52.087 | 20:24:55 | about 3 s |
| false | user | f4786531 | **400** "No recipients were defined for notification." | 20:24:55.302 | none | not sent |
| true | user | 17513971 | 204 | 20:25:32.746 | 20:25:34 | about 1 s |
| true | app | 72cec080 | 204 | 20:25:38.411 | 20:25:39 | about 1 s |
| true | app | 8f1e211e | 204 | 20:25:44.087 | 20:25:45 | about 1 s |
| true | app | 78ff5c02 | 204 | 20:25:50.265 | 20:25:51 | about 1 s |
| true | app | 15f66b29 | 204 | 20:25:56.369 | 20:25:58 | about 2 s |
| true | app | cda1325c | 204 | 20:26:02.799 | 20:26:04 | about 1 s |

The mailbox time is Gmail's `date` of each message; it includes the hop from the `asymm.systems` mailbox to Gmail, so the delay inside Jira is at most what is shown.

### 2.3 The four conditions

1. **To the signer themself, whatever the setting: pass, as the app.** As the app, every send was accepted (204) and delivered, with the setting off and on. As the user, Jira refused the only recipient while the setting was off (400) and accepted it while it was on. The Jira REST v3 OpenAPI says the same: 400 "if the recipient is the same as the calling user". So LedgerSeal calls `notify` as the app. The email names the app as the sender ("LedgerSeal: Approval Seals and Change Control has a message for you about a work item").
2. **Scope: pass (acceptable for production).** The Jira REST v3 OpenAPI (`https://dac-static.atlassian.com/cloud/jira/platform/swagger-v3.v3.json`, read 2026-11-08) lists for `POST /rest/api/3/issue/{issueIdOrKey}/notify`: classic `write:jira-work` (state Current) and granular `send:notification:jira` (state **Beta**). The scope LedgerSeal already uses in production for its property, `write:issue.property:jira`, is also listed as Beta for `PUT /rest/api/3/issue/{id}/properties/{key}`. `forge lint` and `forge deploy` accepted `send:notification:jira` (only the major-version approval, for a scope change), the install upgrade asked for it, and the deploy stayed eligible for Runs on Atlassian. The narrow Beta scope is chosen: `write:jira-work` is Current but would let the app create and edit issues, which the listing says it never does.
3. **Latency over 5 sends: pass.** 1, 1, 1, 2 and 1 seconds for the five sends as the app with the setting on; 3 seconds for the first send with it off. All far below the 60-second limit.
4. **The code stays out of the issue: pass.** The code is only in the subject and body that the app writes into the email. After 7 notifications on LSP-4: change log total 4 with the newest entry from 2026-11-01, 0 comments, `updated` unchanged (2026-11-01T17:39:01.994+0530), and none of the 7 codes in the change log, comments or issue. The email itself shows the issue key, the summary and links, which the signer can already browse (Jira checks Browse projects for the recipient).

### 2.4 Choice
**Option B.** All conditions of the owner's rule hold: (1) works whatever the user's setting, as the app; (2) the Beta granular scope is accepted for production on the same footing as the scope already in production; (3) delivery in 1 to 3 seconds. Recorded in ADR-016 ("Spike S-8") and spec v4 sections 14 and 18.

What option B does not give, stated in spec v4 section 17: the Atlassian session is component 1 and is not re-entered at each signing, so 11.200(a)(1) is "partly met"; a shared or delegated mailbox defeats component 2; when Jira outgoing email is off, nobody can sign in a Part 11 project (fail closed).

## 3. S-1 to S-4: the signature field on the transition screen

### 3.1 Set-up (LSP only; undone afterwards)
- The spike deploy added `jira:customField` `ledgerseal-signature` (type `string`, edit view UI Kit `render: native`, resolver `resolver`). Jira created `customfield_10080` with a global context. Its `schema.custom` is `ari:cloud:ecosystem::extension/7489a645-7c96-400a-b289-eb36f2701a00/ace7a105-325a-4156-851f-dc12a6c6cdda/static/ledgerseal-signature`: the app id, the **environment id**, then `static/<module key>`. Canonical form 2.3.0 must match on the app id and the module key, not on the environment id.
- The bundled manifest schema (`@forge/manifest` 13.8.0 inside `@forge/cli` 15.0.0) allows edit `experience` values `csm-create-request`, `issue-bulk-edit`, `issue-create`, `issue-view`, `list-view`, `portal-request`: **no `issue-transition`**. The field was declared with no `experience`, and it showed on the transition dialog (S-1).
- Screen 10055 "LSP LedgerSeal signing screen (spike 2026-11-08)" with only the field, set as the transition screen of LSP transition 41 (to Done) through `POST /rest/api/3/workflows/update` (validation answered no errors). The existing Require Valid LedgerSeal validator on transition 41 was kept.
- The spike validator (`spikeValidator`) logged the payload shape (field ids and booleans only) and, only when a field held a spike intent of the same user and issue, let the transition pass.
- **Undone:** transition 41 again has no screen (`hasScreen: false`; validator kept), screen 10055 deleted (204), LSP-4 back in In Progress, spike code removed.
- **Left on the development site:** LSP-4's `customfield_10080` holds the intent id `lsi_8eb05c...` of the last spike signature, with history entries (see 3.3). The field disappears when a later deploy has no module of that key, and comes back with the same key in Phase 3. One dummy secret `ls3:spike:secret` (value "not-a-real-seed") is in the development secret store; it holds no real secret.

### 3.2 S-1 and S-2 results

| Entry point | Dialog with the field | Field resolver call (`invoke`) | Validator log (`forge logs`, development) | Outcome |
|---|---|---|---|---|
| Issue view, status menu, Done | yes ("Welcome to the new transition experience"); Jira adds a Comment box to the dialog | yes: `issueKnown=true type=jira:customField` | 22:28:42Z `payloadKeys=context,contextToken,issue,modifiedFields,transition,user userPresent=true modifiedFieldIds=customfield_10080 topLevel=1 nested=0 intentKnown=true intentMatchesUser=true to=10001 from=3` | moved to Done |
| REST `POST /issue/LSP-4/transitions` id 41 (no screen) | none | no | 22:29:12Z `userPresent=true modifiedFieldIds= ` | blocked by the real gate: "LedgerSeal: 2 fields changed after approval (Description, LedgerSeal signature)..." |
| Board (LSP board, id 37), drag to Done, Update without signing | yes, same dialog | not used | 22:29:51Z `userPresent=true modifiedFieldIds= ` | blocked; Jira showed the gate message inside the dialog and kept it open |
| Board, same dialog, Sign then Update | yes | yes | 22:30:18Z `userPresent=true modifiedFieldIds=customfield_10080 topLevel=1 intentKnown=true intentMatchesUser=true` | moved to Done |
| List view, status cell, Done | yes, same dialog | not used | none (cancelled) | cancelled |
| Bulk change | not tested | | | fails closed by design: without an intent the normal gate decides |

- `user` was present in every validator payload, including the REST call (it names the REST caller). `modifiedFields` was at the top level; `transition.modifiedFields` was empty.
- The REST block also shows Q-12 live: under canonical form 2.2.0 the signature field is covered, so setting it on a sealed issue makes the seal CHANGED. 2.3.0 excludes it.

### 3.3 S-3 result
LSP-4's change log after the first signed transition: one entry (2026-11-08T03:58:42.853+0530) with items `LedgerSeal signature` (`customfield_10080`) from null to `lsi_d38957883d15c6ed671e78e9b1169b69`, `resolution` to Done, `status` In Progress to Done. The text typed into the field's code box ("SPIKECODE-424242") appears nowhere in the change log or the issue. So only the submitted value is kept.

## 4. S-5 to S-7

- **S-5:** see section 2: as the app, 204 and delivery. A 403 with outgoing email off is taken from the OpenAPI ("Returned if outgoing emails are disabled; no SMTP server is configured"); it was not provoked on the shared development site. Group recipients were not tested: under Q-02 no alert is emailed.
- **S-6:** the spike page rendered a 21 x 21 grid from `data:image/svg+xml;base64,...` through UI Kit `Image`. Not needed under option B.
- **S-7** (`spikeSecret`, one run at 20:25:00Z):

| Step | Result |
|---|---|
| `kvs.setSecret(key, value)` then `kvs.getSecret(key)` | ok; the value read back |
| `kvs.get(<secret key>)` | nothing: the secret store is separate |
| `kvs.setSecret` on an existing key with `keyPolicy: 'FAIL_IF_EXISTS'` | refused: `ForgeKvsError` `KEY_CONFLICT` |
| `kvs.setSecret` with `ttl` 2 minutes; `getSecret` with `metadataFields` | ok; `expireTime` 2 minutes later |
| `kvs.set` with `ttl`; `kvs.transact().set(..., ttl)` | ok; `expireTime` set in both |
| methods of a transaction | `set`, `delete`, `check`, `execute`: a secret cannot join a transaction |
| `kvs.query()` on the prefix | lists only the two plain keys, not the secrets |

## 5. Decisions taken from the spikes

| Decision | Where |
|---|---|
| Option B for the second component; notify called as the app; scope `send:notification:jira` | ADR-016, spec v4 section 14 |
| ADR-018 option A built (field plus validator intent), with the panel and the issue action as the fallback for every other entry point | ADR-018, spec v4 section 16 |
| The field is declared without `experience` (schema has no `issue-transition`) | spec v4 section 16.2 |
| Canonical form 2.3.0 matches the field by app id and module key (`.../static/ledgerseal-signature`), any environment | spec v4 section 16.3 |
| Site signing key: `setSecret` with `FAIL_IF_EXISTS`; claim and challenge keys with TTL | spec v4 section 14.5 |
| No fallback was needed; nothing stopped the build | |
