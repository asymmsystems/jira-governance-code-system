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
- **Declaration version 2** (`src/domain/declaration.ts`): drafted, `approved: false`. **Pending the owner's approval (Q-03).** Text: "I am signing this record electronically. My electronic signature is the legally binding equivalent of my handwritten signature. I approve this issue as it is now, with the meaning shown above, and I agree that this signature records my approval of its covered fields, comments and attachments."
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
