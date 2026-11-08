<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# LedgerSeal regulated build: progress log

Branch `feature/ledgerseal-regulated`, clone `jira-governance/repository/tmp/ls-build`. Every deploy
went to the Forge **development** environment only. Production was not touched. Nothing was merged.

## Phase 0: ADRs accepted, spec v4 (commit `7793b25`)

- ADRs renumbered because FourRealities already owns ADR-015: `adr-00015` to `adr-00016`
  (Part 11 signing), `adr-00016` to `adr-00017` (approval routes), `adr-00017` to `adr-00018`
  (transition signing). Every reference in the three ADRs and the draft delta was changed in reverse
  order (017 to 018 first), so no number was changed twice. No other file named them.
- Status Accepted, with the owner's decisions of 2026-11-08 (Q-01 changed, Q-02, Q-03, Q-05, Q-09)
  and the spec defaults for the other open questions (Q-04, Q-06, Q-07, Q-08, Q-10 to Q-14), each
  recorded in its ADR.
- `docs/spec/ledgerseal-spec-v4.md`: v3 with the accepted deltas, sections 14 to 19 new. v3 frozen
  (md5 `b922d63b4cfbdc356129ffe459bd975e`), the draft delta frozen (md5 `85eb9e70b09c22af03be54a4842939eb`).

## Phase 1: platform spikes (report to the owner)

Full evidence: `spike-results.md`. Development version **6.0.0** (spike build; scope
`send:notification:jira` added, so a major version; installed on the development site with
`forge install --upgrade`).

**Option B/C decision: B (emailed single-use code through Jira's notify API).**

| Owner's condition | Result |
|---|---|
| (1) Reaches the signer themself whatever "notify me about my own changes" says | Pass, as the app: 204 and delivered with the setting off and on. As the user: 400 "No recipients were defined" with it off, 204 with it on, so LedgerSeal calls it as the app |
| (2) Scope not Beta, or acceptable | `send:notification:jira` is Beta in the OpenAPI; accepted as for `write:issue.property:jira`, which is also Beta and already in production; lint, deploy and the Runs on Atlassian check accepted it. `write:jira-work` (Current) not used: it would allow issue edits |
| (3) About 60 s | 1, 1, 1, 2, 1 s over 5 sends (3 s for the first, setting off) |
| (4) Code not in issue history or comments | None of 7 codes in the change log, comments or issue; `updated` unchanged |

Other spikes: S-1 pass (UI Kit field edit view renders and calls its resolver on the new
transition dialog); S-2 pass (`user` and the field in top-level `modifiedFields`, on the issue view
and the board); S-3 pass (history keeps only the intent id); S-4 issue view, board and list view open
the dialog, REST is blocked by the gate, bulk change not tested (fails closed); S-5 pass as the app;
S-6 pass (SVG data URI); S-7 secrets cannot join a transaction, `setSecret` honours `FAIL_IF_EXISTS`,
TTL works on plain keys, secrets and inside transactions.

No spike failed, so no fallback was used and nothing stopped the build.

Live changes and their undo (development site only): LSP workflow transition 41 got a spike screen
(10055) and lost it again; screen 10055 deleted; LSP-4 moved to Done twice by the spike and back to In
Progress; LSP-4's `customfield_10080` keeps the last spike intent id; the owner's preference
`user.notify.own.changes` set to true for the test and back to false; 8 spike emails sent to the
owner's own address; one dummy secret `ls3:spike:secret` in the development secret store.

## Phase 2: code signing, option B (ADR-016)

### What was built
- **Domain** `src/domain/signing.ts`: policy versions with a hash chain (`nextPolicy`, `withPolicyHash`), 6-digit codes (`crypto.randomInt`), `codeMac` = HMAC-SHA-256(site key, `challengeId:code`), constant-time `macEquals`, `normaliseCode`, rate-limit window, lockout range 3 to 10, chained entries (`buildChainEntry`, `verifyEntries`), the email text (`codeEmail`; issue key cleaned to `[A-Za-z0-9_-]`).
- **Storage** `src/storage/signing-repository.ts`: site key in the Forge secret store (`setSecret` with `FAIL_IF_EXISTS`, spike S-7); challenges, use and failure claims with TTL; per-person state; per-person signing history and site alert log, both hash-chained, appended by claiming the next seq once.
- **Service** `src/service/signing.ts`: `requestCodeFlow` (identity, licence, Browse as the user, project scope, code-signing project, declaration approved, approver, lockout, 30-second and 5-per-15-minute limits, then the code by notify as the app); `checkSigningCode` (lockout, request bound to person, issue, action and stage, expiry not counted, 3 wrong codes void a request, single use, N failures in a row lock, a success restarts the count); admin flows: policy get and set (turning it on refused while declaration 2 is pending), alerts and acknowledgement (a new chained entry), unlock (not for oneself, with a reason).
- **Seal and revoke** (`src/service/ledger.ts`): in a code-signing project the declaration must be version 2 and the code is checked after every other check and before the first write; the row gains `data.signing` (`LS_ATL_EMAIL_OTP_1`, components 2, challenge id, policy version and hash; never the code). Outside such projects nothing changes, and when no policy is on no extra Jira call is made.
- **Evidence:** `ledgerseal-evidence/2` with `signingPolicies` when a row is code-signed; otherwise format 1, unchanged.
- **Verifier** (`tools/verifier/verify-evidence.mjs`): for format 2 only, "signing policies" (hash and chain) and "code signing on every signature that needs it" (check 10). Format 1 output is byte-identical to 1.3.0 for every fixture and key (`test/format2.test.mjs`, 12 golden outputs captured from 1.3.0 before the change).
- **Declaration version 2** (`src/domain/declaration.ts`): drafted, `approved: false`, pending the owner's approval (Q-03). The draft's second sentence was replaced on approval; see "Declaration v2 approved" below for the approved text.
- **UI:** panel forms ask "Send me a code" and take the code (one paste-able field, no timer); admin page "LedgerSeal settings" with tabs Approver groups, Signing codes, Security alerts.
- **Manifest:** scope `send:notification:jira`; admin page title "LedgerSeal settings".
- **Naming in the app:** the B-10 rule (`test/claims.test.ts`) bans "Part 11" and "21 CFR" in app files, so the app calls the mode "code signing". The ADR and spec keep the regulatory names.

### Tests (rules)
`test/signing.test.ts` (37): domain; code request refusals (identity, licence, issue, action, stage, Browse first with no app read, not approver, failed checks, not a code-signing project, declaration pending, tampered policy, lockout); rate limits; send failure (403); seal with code (evidence row, no code anywhere); code required and declaration 2 required; v3 behaviour outside; single use; wrong code; void after 3; binding to person, issue and action; expiry not counted; lockout and refusal of the right code while locked; reset after success; RESEAL and REVOKE actions; tampered policy fails closed; panel flags; admin refusals (non-admin, failed check); declaration gate on the admin page; policy validation and versions and a lost race; alerts, acknowledgement and locked list; unlock rules; chain tampering; lagging chain head; site key race; evidence format 2 and 1; no code in logs. `test/signing-view-model.test.ts` (8). `test/evidence.test.ts`: app format-2 export through the real verifier passes, and with the signing data removed fails both the chain and check 10. `test/permission-checks.test.ts`: the code request is in the Q3 Browse-first list. `test/index.test.ts`: resolver registration, entry points, KVS TTL and secret store. `test/jira-client.test.ts`: notify as the app, issue scope, projects as the user. Verifier: `tools/verifier/test/format2.test.mjs` (18).

### Gate (code of the Phase 2 commit)
| Step | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx jest --coverage` | 54 suites, 660 tests passed; all files: statements 98.38%, branches 94.55%, functions 97.5%, lines 98.99%; changed files' branches: signing (domain) 100%, signing (service) 93.75%, signing-repository 90%, signing-view-model 97.77%, ledger 91.46%, jira-client 94.94%, declaration 100%, index 93.33% |
| `npm run build` | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 (7 moderate, unchanged; inside Atlassian's packages) |
| `npx --yes @forge/cli@15.0.0 lint` | No issues found |
| FSRT `6c821bd` (cached), default scanners and `secret-logging` | 0 findings each, `scanned: systems.asymm.ledgerseal` |
| Semgrep 1.182.1 (`p/typescript p/javascript p/nodejs p/secrets`, `apps/*/src packages/*/src`) | 0 findings, exit 0, 202 files; one rule timeout warning on `apps/cascadeplan/src/frontend/legacy-planner.js` (not LedgerSeal) |
| `forge eligibility -e development` | 6.1.0 eligible for Runs on Atlassian |
| Verifier `npm test` | 30 tests passed |

### Deploy and live check
- `forge deploy -e development`: **6.1.0** (minor; the scope arrived with the 6.0.0 spike deploy). Production not touched.
- Admin page: "LedgerSeal settings" with three tabs; Signing codes shows the draft declaration, the checkbox disabled and "Code signing cannot be turned on yet: the text of declaration version 2 is waiting for the owner's approval"; Security alerts shows 0 locked, 0 open alerts. LSP-1's panel unchanged ("Approval seal: Changed after approval. 1 item modified.").
- Not live-tested by design: a real code-signed seal. Code signing cannot be turned on until the owner approves declaration 2 (Q-03). The notify path itself was proven by spike S-8; the full flow is proven by the tests above.

### Questionnaire, listing, site
- `docs/marketplace/submission/ledgerseal-security-questionnaires.md`: Q7 (new scope), Q8 (codes never logged, test), Q9 (new inputs), Q13 (second secret: the site key in the Forge secret store; no per-user secret), section 2.1 (`getIssueScope`, `notifyUser`, `getProjects`), all marked "(code signing)", to enter only after production.
- `docs/marketplace/submission/ledgerseal-submission-notes.md`: scope table row for `send:notification:jira`.
- `docs/marketplace/ledgerseal-listing.md`: "Post-approval copy: code signing", held until release, live probes and the owner's approval.
- Site: `site-items.md` R-1 to R-6.

### Major version
Yes: the scope `send:notification:jira` makes the next production deploy a major version (site admins consent on upgrade).

## Phase 3: signing on the transition screen (ADR-018 option A)

### What was built
- **Canonical form 2.3.0** (`src/domain/canonicalizer.ts`): the rules of 2.2.0 plus LedgerSeal's own signature field, matched by `ari:cloud:ecosystem::extension/7489a645-.../<any environment>/static/ledgerseal-signature` (spike S-1 showed the environment id in the type). New seals use 2.3.0; 2.0.0 to 2.2.0 unchanged. Hand-written vectors `test/fixtures/vectors-2.3.0.json` (4) and `test/canonical-v23.test.ts`.
- **Seal modes** (`sealIssueFlow`, `src/service/ledger.ts`): `prepare` (every check as the user, including the code with action `TRANSITION` in a code-signing project; stops before the first seal write) and `complete` (the validator; Browse, approver and code results come from the intent; the issue is read with the screen's values). The row of a transition signature adds `via: "TRANSITION_SCREEN"` and `transitionToStatusId`.
- **Intent** (`src/service/transition-signing.ts`): `transition-sign-intent-api` stores `ls3:intent:{lsi_...}` (party token, issue, hash shown, signature, code-check result; 120 seconds; TTL 1 day) and returns only the id. The validator (`completeIntent`, called first in `gate`) finds an intent value in LedgerSeal's own field (by field type; any `lsi_` value when the field list cannot be read, fail closed), checks it exists, is unexpired and unclaimed, that `user.accountId`'s token is the intent's party and the issue matches, claims `ls3:intentuse:{id}` once, then seals. A changed covered field or a typed comment on the screen gives "LedgerSeal: fields on this screen changed the approved content..." (Q-10). Then the normal gate decides.
- **UI:** `src/frontend/signature-field.tsx` (UI Kit field edit view: the seal or approval form, the code in code-signing projects, Sign, then `view.submit(intentId)`), `src/frontend/signature-field-view-model.ts`.
- **Manifest:** `jira:customField` `ledgerseal-signature` (string, edit `sigedit`, no `view`, no `experience`), `jira:issueAction` `ledgerseal-sign-action` "Sign with LedgerSeal" (the panel resource). No new scope.

### Tests (rules)
`test/transition-signing.test.ts` (19): intent checks (identity, Browse, approver, shown hash required and current, separation of duties and reason); no seal written by an intent; 120-second life; validator seals for the signer and records the transition; single use; expired and unknown; another user or no user (intent kept); another issue; screen changes (comment, covered field); a seal failure passed back within 250 characters; another app's look-alike field ignored and an unreadable field list treated as ours; no intent leaves the normal gate; approval of changes with a reason; the claim race; missing issue key and target status; code signing needs a TRANSITION code, stores only its evidence and writes it into the row; completion without a code check refused; the field view model. `test/canonical-v23.test.ts` (6). `test/manifest.test.ts`: the field has no `view` and no `experience` (live finding), the issue action. `test/permission-checks.test.ts` and `test/index.test.ts`: the intent resolver is Browse-first and registered.

### Gate (code of the Phase 3 commit)
| Step | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx jest --coverage` | 56 suites, 699 tests passed; all files: statements 98.37%, branches 94.54%, functions 97.57%, lines 99.03%; branches: transition-signing 90.47%, signature-field-view-model 93.33%, canonicalizer 95.29%, ledger 91.66% |
| `npm run build` | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 (7 moderate, unchanged) |
| `forge lint` | No issues found |
| FSRT `6c821bd`, default and `secret-logging` | 0 findings each |
| Semgrep 1.182.1 | 0 findings, 205 files |
| `forge eligibility -e development` | 6.6.0 eligible for Runs on Atlassian |

### Deploy and live check (development only)
- Versions: 6.2.0 (Phase 3 code), 6.3.0 (view without `experience`), 6.4.0 (no `view`), 6.5.0 (`view.submit` on sign), 6.6.0 (final Phase 3 code). Production not touched.
- LSP transition 41 got screen 10056 with only the field, for the probe, and lost it again (`hasScreen: false`, validator kept; screen deleted).
- Probe issue **LSP-6** (created for this probe, labels `ls-probe`, `ls-probe-regulated`): signed in the field on the new transition dialog, Update: moved to Done; change log `LedgerSeal signature: lsi_20ffe6ca...`, resolution, status; property `ledgerseal-cert` schema 3, `SEAL_VALID`, signed `ls-dev-2026-11`; the context entry shows "Sealed. No change detected since approval" with the field set. LSP-6 stays Done as the probe record.
- Live findings (spike-results section 6): a field `view` hides the edit view on the dialog; the field must call `view.submit` itself.

### Listing and site
- Site items R-7 to R-9. Listing: `docs/marketplace/ledgerseal-listing.md` "Post-approval copy: code signing" gains a transition-screen line, held until release and live probes (Q-14).

### Major version
No new scope in Phase 3. The next production deploy is major because of Phase 2's scope.

## Phase 4: approval routes (ADR-017) and verifier 1.4.0

### What was built
- **Domain** `src/domain/route.ts`: route stages (order groups 1 to 8, 1 to 10 groups, "any one" or N of 1 to 10, gated target statuses), validation (`parseStages`), the route hash (groups and gates sorted), quorum, open stages, re-approval list (Q-06), one person one stage, the stage gate.
- **Storage** `src/storage/route-repository.ts`: route versions created once and hash-checked; bindings by project and issue type (`*` stored as `all`, live finding); the run record with its own hash and the chain head while there is no seal; run content parts.
- **Service** `src/service/routes.ts`: admin flows (list, save a new version, bind, unbind; Jira admins only, Q-08; groups and statuses checked in Jira); `routeFor` (open run pinned to its version, Q-07; else the binding); stage signing (Browse, open stage, stage group as the user, one stage per person, shown hash, separation of duties, declaration, code in code-signing projects; a new run stores its snapshot; the completing stage writes the seal through the seal flow with the run's chain head, `stageSignatures` and `requiredStageIds`); rejection with a reason; voiding on change (when the panel loads, in the validator, and at the next stage signature; the issue-change trigger does not void runs); the routed revoke rule (decision 8) with `endsRun`; panel data; the stage gate in the validator with the spec 15.5 messages.
- **Attestation schema 4** (`buildRoutedAttestation`): `approval` on routed issues; no `status` and no `certificateId` before the first seal; index path `approval.runState` (`ledgersealApproval`). Issues with no route keep schema 3.
- **Evidence format 2** with `routes` (every version the history names). **Verifier 1.4.0**: checks 6 to 9, check 4 skips run entries, route vectors in `--self-test`; format 1 output unchanged (golden test).
- **UI:** the panel's route section ("Sign as {stage}", "Reject", who signed, progress, rejection reason) and stage and reject forms; the plain seal and approval are hidden on a routed issue; admin tab "Approval routes" (JSON editor, "Bind this route", Unbind); the transition field points to the panel on a routed issue.
- **FourRealities** (`apps/fourrealities/src/engine/default-gate-engine.ts`): a `ledgerseal-cert` of schema 4 with no `status` reads as "not sealed" (`SEAL_NONE`); other shapes without a status stay `SEAL_SHAPE_UNKNOWN`. Test in `test/domain/gates.test.ts`. This is a two-line change (a typed alias and the condition): the FourRealities rule B-24 forbids `any`.

### Tests (rules)
`test/routes.test.ts` (22): domain validation, hash order independence, order groups, quorum, gates; admin refusals and validation; bindings, issue type over all, plain seal refused when bound; the full QA then Regulatory (2 of the group) run with one seal naming every stage signature, schema 4 before and after the seal, format 2 through the real verifier (all route checks PASS); stage not open, outside the group, same person; identity, Browse, hash, declaration, licence; no route; pinned version; rejection and restart with the gate message; reject before any signature; voiding on change (one row per change) and in the validator; stage gates with counts; separation of duties and the re-approval list; the routed revoke rule and `endsRun`; panel flags; stage codes in code-signing projects; tampered run record fails closed; a tampered route version fails the verifier. `test/routes-edge.test.ts` (15): storage, admin inputs, resolution failures, lost races (stage, completing stage, rejection, void), failed reads, gate messages, revoke edge cases, stage-code authority, the approval summary, and the `*` key regression. `test/route-view-models.test.ts` (5). Verifier `test/format2.test.mjs` route group (7): valid run; checks 6, 7 (names and snapshot), 8 (quorum and order), 9; check 4 skipping a later run entry; a format 2 file without a routed seal. Q3 list and registration tests include the stage and route resolvers. The test store now refuses KVS keys with characters Forge refuses.

### Gate (code of the Phase 4 commit)
| Step | Result |
|---|---|
| `npx tsc --noEmit` (LedgerSeal, FourRealities) | 0 errors |
| `npx jest --coverage` LedgerSeal | 59 suites, 765 tests; statements 98.15%, branches 93.98%, functions 97.96%, lines 98.83%; every file at or above 90% branches |
| `npx jest --coverage` FourRealities | 48 suites, 577 tests; branches 96.65% |
| `npm run build` (both) | exit 0 |
| `npm audit --omit=dev --audit-level=high` (both) | exit 0 (LedgerSeal 7 moderate, unchanged) |
| `forge lint` (LedgerSeal) | No issues found |
| FSRT `6c821bd` LedgerSeal default and `secret-logging`, FourRealities default | 0 findings each |
| Semgrep 1.182.1 | 0 findings, 212 files |
| Verifier `npm test`, `--self-test` | 37 tests; 10 of 10 vectors, 3 of 3 route vectors |
| `forge eligibility -e development` | 6.12.0 eligible for Runs on Atlassian |

### Deploy and live check (development only)
- Versions 6.7.0 to 6.12.0 (6.8.0 route id shown, 6.9.0 bind button, 6.10.0 `all` key fix, 6.11.0 Unbind buttons, 6.12.0 routed field text). Production not touched. FourRealities was not deployed (its change is covered by tests; deploy it with its next development build).
- Route "LSP probe route (regulated build)" (one stage, any one of `jira-admins-asymmsystems`) saved on the admin page and bound to LSP, every issue type. The first bind failed live with KVS `INVALID_KEY` (`*` in the key); fixed, then bound.
- Probe issue **LSP-7** (labels `ls-probe`, `ls-probe-regulated`): "Reject" with a reason, the panel showed the rejection; then "Sign as Probe approval": sealed; property schema 4, `SEAL_VALID`, `approval.runState` `COMPLETE`, signed `ls-dev-2026-11`; panel "Approved through every stage." The exported evidence (format 2, rows `LS_RUN_REJECTED/REJECT`, `LS_SEALED/SEAL`) passed snapshot hash, chain, newest seal, status, Ed25519 signature (published dev key), route version, stage signatures, same snapshot and quorum, checked in the browser with a port of the verifier's code (the browser tool would not return the raw file, so the verifier file itself was not run on this export).
- Then unbound ("No route is bound"). The route itself stays in development storage (there is no delete); LSP-7 stays sealed as the probe record.

### Not built, and why (follow-ups)
- Signing a route stage in the transition-screen field (ADR-018 intent with `stageId`): the field points to the panel on a routed issue.
- A form-per-stage route editor: routes are edited as checked JSON.
- Deleting a route: none (versions are kept; unbinding stops its use).
- The weekly personal data job does not yet list route or signing records separately; they name people only by party token, which the existing party map and report cover.

### Major version
No new scope in Phase 4. The next production deploy is major because of Phase 2's scope.

## Declaration v2 approved (owner, 2026-11-08)

- **Decision (Q-03 resolved):** option A, the developer's draft with the second sentence replaced. Approved text, verbatim: "I am signing this record electronically. I understand that my organisation treats this electronic signature as the legally binding equivalent of my handwritten signature. I approve this issue as it is now, with the meaning shown above, and I agree that this signature records my approval of its covered fields, comments and attachments." Reason: under 21 CFR 11.100(c) the customer organisation certifies to FDA that its staff's signatures are legally binding; the app cannot assert it.
- **Code:** `apps/ledgerseal/src/domain/declaration.ts`: `DECLARATION_V2.text` set to the approved text, `approved: true`. The approval gate stays for later versions. The version stays `2`: the mode could not be turned on before the approval, so no record holds the earlier draft.
- **Records updated:** spec v4 section 10 and the Q-03 row of section 18; ADR-016 (Q-03 bullet, decision 11, and the superseded recommendation's line); this log's Phase 2 entry no longer quotes the draft. A search for the earlier wording ("is the legally binding equivalent", "My electronic signature is", and the same across line breaks) finds no file in the repository, frozen files included. The eCFR quotes in `docs/sdlc/ledgerseal-usp-ux-research-2026-11/research-brief.md` (REG-01, REG-23) are the regulation's own words and do not match.
- **What the hashes cover (checked):** the seal's status row (hash-chained, exported in the evidence, checked by the open verifier) holds `declarationVersion`; the work effort's `attributes.declarationVersion` is in its `recordHash`; the declaration's version and full text are in the seal's assignment record, whose hash is in the work effort's `currentAssignment.assignmentHash`, checked on every read (a changed text shows RECORD_INVALID). The exported evidence names the version, not the text: an outside verifier proves which version was signed, and the text of each version is fixed in the published code and spec. Existing version 1 seals keep their stored text and version and still verify. New tests in `test/signing.test.ts`: a v2 seal stores the approved text and a changed text fails the integrity check; a v1 seal stays valid; the earlier draft text is refused (`DECLARATION_MISMATCH`). `test/declaration.test.ts` checks the approved text verbatim.

### Gate (this change)
tsc 0 errors; 59 suites, 768 tests; coverage statements 98.15%, branches 93.98%, every file at or above 90% branches; build exit 0; `npm audit --omit=dev --audit-level=high` exit 0; `forge lint` no issues; FSRT default and `secret-logging` 0 findings; Semgrep 1.182.1 0 findings (212 files); verifier 37 tests; `forge eligibility -e development`: **6.13.0** eligible for Runs on Atlassian.

### Live: one full code-signed seal with a real emailed code (development 6.13.0)
- Admin page, Signing codes: the approved text shown, the checkbox enabled; code signing turned on for LSP (policy version 1).
- Probe issue **LSP-8** (labels `ls-probe`, `ls-probe-regulated`): panel "Seal this issue"; the form showed declaration version 2 with the approved text; "Send me a code"; the email "[JIRA] LedgerSeal signing code for LSP-8" reached the owner's mailbox (Gmail time 02:32:53Z); the 6-digit code from that email was typed and "Sign and seal" pressed.
- Result: panel "Approval seal: Sealed. No change detected since approval."; property schema 3, `SEAL_VALID`, signed with `ls-dev-2026-11`.
- Evidence (format 2) checked in the browser with a port of the verifier's checks, against the published development public key: snapshot hash, history chain, newest seal, status, Ed25519 signature, signing policies (1 version), code signing on the seal row (`LS_ATL_EMAIL_OTP_1`, 2 components, policy version and hash), `declarationVersion` 2; the code does not appear in the evidence. All pass.
- Afterwards code signing was turned off for LSP (policy version 2, off), so LSP behaves as before. LSP-8 stays sealed as the probe record.

## Fix round 1: independent review of 427f6c9 (2026-11-08)

The review is `repository/tmp/ls-regulated-review/REVIEW.md` (read in full). The reviewer's probe is now `apps/ledgerseal/test/zz-review-races.test.ts`, with assertions for the fixed behaviour and four more real races. All 7 of its tests fail on 427f6c9 (checked in a temporary worktree, since removed) and pass now. `test/fix-round-claims.test.ts` (12) tests each claim key and the run lock on its own, with `Promise.all` where it matters.

| Finding | What changed | Tests |
|---|---|---|
| H-1 (two stage signatures at once) | A per-issue run lock (`ls3:runlock:{issueId}`, created once; stale after 60 s, taken over by one caller through a create-once break key; retried about 4 s, then `CONFLICT`). Signing, rejection, void and the end of a run on revoke hold it. Under the lock the flow reads the run again and repeats the decisions: the stage is open, the person signed no other stage, an open run holds the person's snapshot, and the run has not ended since the checks (`ISSUE_CHANGED`). Void reads first without the lock, so the panel stays cheap. | Probe race: the second tab gets `SAME_PERSON_STAGE`, the run record and the chain agree, the finished seal passes verifier 1.4.0 (exit 0) and the validator. Two people on two stages of a new run at once: both kept. Three QA signers for a quorum of 2: exactly two in. A signature in flight while the run is voided: `ISSUE_CHANGED`. Two readers voiding at once: one void row. Busy lock for signing and rejection. |
| H-2 (limits under parallel attempts) | Every limit is a create-once claim taken before the compare: 3 answer slots per request (`ls3:sig:attempt:`), the next failure slot of the series (`ls3:sig:fail:`), the lock (`ls3:sig:lock:{party}:{series}`), the series start (`ls3:sig:series:`). A match checks the lock again before it is used. The 30-second rule claims 7 slots of 5 seconds, so two requests under 30 s apart always collide. The state key is only a hint and cannot clear a lock. | 49 wrong codes and the right one in parallel: no OK, exactly 3 compared, person locked. A right code with the failure that reaches the threshold: refused, locked. 10 parallel requests: 1 email. Slot counts under `Promise.all`. |
| M-1 (verifier format and policy) | Every signature row names the policy in force (`data.signingPolicy` = version and hash, on or off) once any policy was saved; a policy saved during the signature refuses it (`POLICY_CHANGED`). Export: such a row makes format 2. Verifier 1.4.0 runs the format 2 checks when the content needs them (attestation schema 4, `LS_RUN_*`, `runId`, `routeId`, `signing`, `signingPolicy`), whatever `format` says; check 10 reads the policy the row names (must be in the list with the same hash); routed content without `routes` fails check 6. README "What a PASS means" rewritten (only the attestation is signed; the rest is bound by hashes; `format`, `exportedAt`, `parties`, `verification` are not checked); the same text on `site/apps/ledgerseal/open-verifier.md`. | Verifier: a downgraded format, a swapped (self-consistent, off) policy list, an emptied list, a removed `routes` list all FAIL; an honest off policy passes; the named policy wins over dates (L-9). App: its own exports downgraded or swapped fail the real verifier. Format 1 golden outputs unchanged (all 12 fixture and key pairs). |
| M-2 (notify recipients) | `reporter`, `assignee`, `watchers`, `voters` `false`; `groups` and `groupIds` empty. | Client test of the exact body. Live: see below. |
| M-3 (validator throws) | `validateTransition` wraps the gate: any error gives `{ result: false }` with "LedgerSeal could not complete its check, so this transition is blocked. Try again in a minute." and a log line. | A store that throws on read. |
| L-1 | Completing an intent re-reads the policy and the route binding; any difference refuses (`POLICY_CHANGED`, `ROUTED`). | Policy turned on, then a route bound, after the intent was made: both refused, nothing written. |
| L-2 | Written answer (spec 18A, ADR-018): open by design; the intent is not bound to one transition; the row records the real target. | None (no code change). |
| L-3 | The intent stores the issue key; a payload with only a key must match it. | Key of another issue refused; same key passes. |
| L-4 | A `SEAL` code also approves changes and the other way round; a double submit of the right code is `CODE_REUSED` (recorded, alerted) and gives its failure slot back. | Two parallel submits of one right code: one OK, one `CODE_REUSED`, not locked, no failure slot left. A SEAL code approving changes; a REVOKE code refused for a seal. |
| L-5 | Written answer plus a fix: every policy save is a `POLICY_CHANGED` alert naming the admin; with M-1 the verifier shows the policy in force per signature, so off-then-on is visible in the record and on the admin page. | Admin page lists it; acknowledgement works. |
| L-6 | `canReject` now also needs "has not signed another stage". The gate blocking after a rejection with a valid seal is by spec 15.5 (written answer in spec 18A and ADR-017). | Existing panel tests; the flow already refused. |
| L-7 | The authority callback is gone: `requestCodeFlow` calls `codeRequestRight` directly (approver check, or groups read as the user first, then `openStageFor`). | Existing code-request tests, now without the callback. |
| L-8 | The admin page reads an open-alert index (`ls3:sig:open:`), built once from the log on first use; acknowledgement reads one key. A rate refusal is always a history event, but an alert once per rule and 15-minute window. | Index built from an older log; 10 refusals give 10 events and 1 alert. |
| L-9 | Fixed by M-1 (the row names its policy; a save during signing refuses). | See M-1. |

Spec v4 sections 14.2 to 14.6, 15.3, 15.7 and a new 18A; ADR-016, ADR-017 and ADR-018 each have a "Fix round 1" section (decisions unchanged). Spec 14.2 step 3 now says TRANSITION needs the approver right; the code always did this (the earlier text said "either").

### Gate (this change)
tsc 0 errors; 61 suites, 795 tests; coverage statements 98%, branches 93.87%, every file at or above 90% branches (`routes.ts` 91.62%, `signing-repository.ts` 98.41%); build exit 0; `npm audit --omit=dev --audit-level=high` exit 0; `forge lint` no issues; FSRT default and `secret-logging` 0 findings; Semgrep 1.182.1 0 findings (212 files); verifier 41 tests, `--self-test` 10 of 10 and 3 of 3; `forge eligibility -e development`: **6.14.0** eligible for Runs on Atlassian. FourRealities not touched.

### Live (development 6.14.0)
- M-2: the site has one other Atlassian user. Adding them as a watcher of probe **LSP-9** returned 403 (they cannot see project LSP, and changing the project's permissions was not in scope), so the live test with a second watcher was **not run**. Their mailbox is not readable from here in any case. What was checked: with the new notify body, Jira accepted the call and the code email for LSP-9 reached the owner's mailbox (03:08:57Z), addressed to the owner only.
- Code signing turned on for LSP (policy version 3); LSP-9 sealed with the emailed code: property schema 3, `SEAL_VALID`, signed `ls-dev-2026-11`. Code signing turned off again (policy version 4). The admin page shows two open `POLICY_CHANGED` alerts (versions 3 and 4), left for the owner to acknowledge.

## Fix round 2: independent review of f537067 (2026-11-08)

The review is `repository/tmp/ls-regulated-review/REVIEW-round2.md` (read in full). It confirms H-1, H-2 and M-1 to M-3 closed. The reviewer's probe is now `apps/ledgerseal/test/zz-review-r2.test.ts`: on f537067 it fails at the point where the revoke row is stored while the completing stage still holds the run lock (checked in a temporary worktree, since removed); it passes now. `test/fix-round2.test.ts` (9) covers the other items.

| Finding | What changed | Tests |
|---|---|---|
| R2-1 (revoke during a completing stage) | The revoke checks its right before the lock (a refused person writes nothing), then, under the run lock, checks the right again, reads the route, checks the code, writes its row (`endsRun` when a run is open) and ends the run. A stage signature or rejection refuses (`ISSUE_CHANGED`) when the seal's state or certificate changed since its checks. Verifier check 12: no entry of a run after the entry that ended it. | Probe: the revoke waits for the lock; the chain ends `LS_SEALED/RESEAL`, `LS_REVOKED/REVOKE` (no `endsRun`); the gate is closed; the export passes the verifier with check 12. Verifier: a run entry after an `endsRun` entry fails. |
| D-1 (declaration of each signer) | Stage signature and rejection rows chain `declarationVersion` and `declarationHash` (SHA-256 of the exact text); a seal row does too when the record is format 2 anyway (a policy exists, or a route's stage writes the seal). A rejection needs the declaration (the panel shows it on the reject form). The export carries `declarations` (version to text). Verifier check 11 checks each hash and prints each text with its entries. A plain seal keeps format 1 (byte identity), and a revoke records no declaration (it shows none). | Stage, rejection and routed seal rows carry the hash; a rejection without the declaration is refused before the code is touched; the export holds the text; verifier: missing text, changed text and a downgraded format fail. |
| D-2 (ADR-016 record) | Item 12 of "The recommendation before the owner's change (kept for the record)" restored to its text at 427f6c9; the note is in a new dated section "Fix round 2". | None (document). |
| R2-2 (code used before the lock) | Stage signature, rejection and revoke check the code under the run lock, after every run decision. `SIGN_OK` is written only after the row is stored (an intent: when the validator writes the seal). A code whose signature was not written is given back. | Busy lock: `CONFLICT`, code unused, no `SIGN_OK`, then the same code signs. A refused row write: code given back, no `SIGN_OK`; the retry signs. |
| R2-3 (success against a lock) | A success and a lock race for one create-once key, `ls3:sig:end:{party}:{series}`. A lock that won refuses the success and gives its code back. | 20 parallel lock-and-success pairs: exactly one wins each time. |
| R2-4 (slot leak on a timeout) | Written answer (spec 18B): one failure for that person only, cleared by an admin unlock. | None. |
| R2-5 (two holders of the run lock) | The take-over checks that the key still names the stale holder, deletes it, then creates its own once. Every run write (run row, run record, completing seal, revoke row) first checks that the lock names its holder (fencing), else `CONFLICT`. | A fresh lock made between the stale read and the take-over is kept; a holder whose lock was taken over cannot write. |
| R2-6 (held up by a slow call) | Written answer (spec 18B, ADR-017): at most the 25-second Forge limit, then 60 seconds for a dead holder; others get "try again" after about 4 seconds and keep their code. | None. |
| L-5 | The `POLICY_CHANGED` alert is written after the version is created and before it comes into force; if it fails, the version is removed and the save fails. | An alert that throws: no policy in force, no version stored; the next save is version 1 with its alert. |
| L-8 | After the one-time index build, acknowledgements are applied again from a fresh read. | An acknowledgement written during the build stays applied. |
| V-2 (moved issue) | `data.signingPolicy` names the row's `projectId`; check 10 uses it. | A row signed in another project, issue later in a code-signing project: PASS; the reverse without a code: FAIL. |
| V-1 | Unchanged: rows from before fix round 1 (development data only) still use the policy dates. | None. |

### Verifier release number and the rebase
FourRealities released its report verifier as 1.4.0 (master 9a7c005, public CLI PR #3). This branch was rebased onto origin/master 9a7c005 as **`feature/ledgerseal-regulated-v2`**; the old `feature/ledgerseal-regulated` (f537067) is left as it was. In `tools/verifier` the FourRealities files are kept with the LedgerSeal changes; `package.json` is **1.5.0** and `npm test` runs the LedgerSeal and FourRealities tests. The LedgerSeal mentions of the verifier release are 1.5.0 in the README, spec v4 (Q-09 notes the owner's 1.4.0 and why it is 1.5.0), ADR-017, the app README, the listing draft, `site-items.md` and `cli-sync.md`. The phase entries above keep the number they were written with.

### Gate (fix round 2, on the rebased branch)
LedgerSeal: tsc 0 errors; 63 suites, 808 tests; coverage statements 97.71%, branches 93.66%, every file at or above 90% branches; build exit 0; `npm audit --omit=dev --audit-level=high` exit 0; `forge lint` no issues; FSRT default and `secret-logging` 0 findings. FourRealities (changed only by master, rebuilt after `npm ci`): tsc 0 errors; 59 suites, 826 tests; build and audit exit 0. Semgrep 1.182.1: 0 findings (233 files). Verifier `npm test`: 53 tests (LedgerSeal and FourRealities), 0 failures; `--self-test` 10 of 10 and 3 of 3. `forge eligibility -e development`: **6.15.0** eligible for Runs on Atlassian. The first deploy attempt failed to bundle (the panel imports `declaration.ts`, so the hash moved to a server-only `declaration-hash.ts`); the second deployed. Production not touched; FourRealities not deployed.

## Fix round 3: build, gates and live run (2026-11-08)

**Built** (commit `feat(ledgerseal): record the declaration of each signing's own action`):
- D-5, the owner decision: every signing records the declaration for its own action, with id, version and hash: `approve/2`, `reject/1`, `revoke/1` (`approve/1` outside code signing). The reject and revoke forms show their own texts; the export map is keyed `id/version`; verifier check 11 also checks the action.
- D-3, D-4 and P-1 are fixed. V-3: the README now says "about 330 lines". A revoke code on a routed issue follows the route's revoke rule. Spec 18C and the ADR-016 and ADR-017 decision sections hold the verbatim texts; the 11.50 row is updated.
- Gates on 17c1c04: LedgerSeal tsc 0; 64 suites, 813 tests; branches 93.61%, every file at or above 90%; build, audit and lint clean; FSRT 0 and 0; Semgrep 0 (233 files); verifier 54 tests, self-test 10/10 and 3/3. Deployed to development as **6.16.0** (eligible for Runs on Atlassian).
- Live on probe **LSP-10**, with the probe route bound to LSP and code signing on (admin page):
  - Rejection: the form showed the `reject/1` text; the emailed code worked (04:09:04Z); the run was REJECTED.
  - Stage signature: the form showed the `approve/2` text; the code was emailed at 04:09:52Z; the issue was sealed.
  - Revoke: the form showed the `revoke/1` text with its checkbox; the code was emailed at 04:10:50Z.
  - Property after all three: schema 4, `SEAL_REVOKED`, `approval.runState` COMPLETE, signed with `ls-dev-2026-11`.

### Fix round 3: revoke, export check and restore
- The revoke on LSP-10 was signed with its emailed code. Property: schema 4, `SEAL_REVOKED`, `approval.runState` COMPLETE, signed with `ls-dev-2026-11`.
- The evidence (format 2, 3 entries) was read in the panel. The browser tool refused to return the raw file, so it was checked in the page by a port of the verifier's checks (WebCrypto, Ed25519 against the published `ls-dev-2026-11` key). All passed:
  - snapshot hash, history chain, newest seal, status `SEAL_REVOKED`, signature;
  - signing policies (5 versions in force);
  - code signing on every signature (all 3 entries code-signed);
  - declaration texts: entry 1 REJECT with `reject/1`, entry 2 SEAL with `approve/2`, entry 3 REVOKE with `revoke/1`, each hash matching the exported text;
  - no run continues after it ended;
  - route version hash.
- `declarations` held exactly `approve/2`, `reject/1` and `revoke/1`.
- Restored: the probe route is unbound ("No route is bound"), and code signing for LSP is off (policy version 6). LSP-10 stays revoked as the probe record. Production not touched.
