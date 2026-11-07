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
