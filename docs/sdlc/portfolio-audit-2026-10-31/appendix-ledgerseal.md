# LedgerSeal commercial-readiness audit (reviewer 1 of 4)

App: /home/fahimfarookme/Documents/projects/gemini-earning/apps/ledgerseal (Forge UI Kit). Repo HEAD 5097bf5. Audit date 2026-10-31. Read-only on the repo.

## 1. Header

### 1.1 Files read in full (md5sum)

| md5 | file |
|---|---|
| 4912f810cecc156a3aa5f9b68e7f7d0b | manifest.yml |
| fc9472171cddb546c2caefded2efe919 | package.json |
| cb00b66f256c375c3fba8f3ee535e42b | tsconfig.json |
| b4867e2c3c4d5c1d066f606ef4fa8294 | jest.config.js |
| a8349fba7ac3a88e94d211eb6655fda5 | src/index.ts |
| 313edabcfb99c1c53ddb90a7be16996f | src/domain/canonicalizer.ts |
| 3dab929eb4abaf50aaa387648fb8b569 | src/domain/crypto.ts |
| d0ef81d2190a0a700043acdbe3d39a71 | src/domain/models.ts |
| 6a1db8a332a1fd776fda34277e696d3b | src/domain/tamper-detector.ts |
| 51aef034177b70b43aaf0366218075c7 | src/storage/seal-repository.ts |
| 8e542a90e1c3a0dfea0b2b352af4fe97 | src/validator/workflow-validator.ts |
| 5f86bcd00e17d1a6328514bdf3e14e41 | src/frontend/index.tsx |
| b776b02a1a6d95aa77344cfc5a09b701 | test/canonicalizer.test.ts |
| dbdc3574a9aebda4ff9b7b5fab95022a | test/crypto.test.ts |
| 7df6aba1895dbcfa4430f5584f0fc76c | test/edge-cases.test.ts |
| 23b40c0f95510cbf25c977afc9a0a364 | test/index.test.ts |
| 41e06213ef47d1197ae409278b55cc61 | test/seal-repository.test.ts |
| bbd6160cfc7f0f67bf1ccdd632e57342 | test/security-adversarial.test.ts |
| 00211f6f5a21d93b1c769d85012106b5 | test/tamper-detector.test.ts |
| 36a1c7cb06dc082edc0389db552238c2 | test/workflow-validator.test.ts |
| 01c1c4059f83b45d4dde275abae22908 | README.md (claims only) |
| e022e8e72a5e922808d7dcb1fdad3c17 | docs/spec/ledgerseal-spec.md (claims only) |
| 387f28ed5221e64fb5d31a84c3cb5c16 | docs/marketplace/ledgerseal-listing.md (claims only) |

Not used as evidence: the committed `dist/` and `coverage/` folders (build artifacts). All empirical tests compile `src/` fresh into the scratch folder.

### 1.2 Commands and results

| Command | Result |
|---|---|
| `npx tsc --noEmit -p .` (host) | Exit 0. No errors. |
| `npx jest --coverage --coverageDirectory=.../cov-ledgerseal` (host) | 8 of 8 suites pass. 77 of 77 tests pass. Exit 0. |
| `npx tsc -p . --outDir .../ledgerseal-scratch/build --declaration false` | Exit 0 (compile for probes, outside repo). |
| `node ledgerseal-scratch/probe.js` | Canonicalizer and hash probes. Output in finding text. |
| `NODE_ENV=production node ledgerseal-scratch/flow.js` | End-to-end seal, tamper, reseal flow with mocked Forge APIs. Output in finding text. |

Coverage table (jest output, verbatim):

```
File                    | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files               |   98.01 |    90.24 |     100 |   98.41 |
 src/index.ts           |   95.71 |     90.9 |     100 |   95.71 | 72,145,185,188,250,282
 canonicalizer.ts       |   98.67 |     87.7 |     100 |     100 | 12,51,53,80-81,88,93,99,103-104,110,115,121-124,311-315,323-326
 crypto.ts              |     100 |      100 |     100 |     100 |
 tamper-detector.ts     |     100 |      100 |     100 |     100 |
 seal-repository.ts     |     100 |      100 |     100 |     100 |
 workflow-validator.ts  |     100 |       90 |     100 |     100 | 52
```

Coverage exclusions (jest.config.js:6-10): `src/**/*.d.ts` and `src/frontend/**`. The whole UI (src/frontend/index.tsx, 260 lines) has zero tests and is outside the coverage number. Global branch coverage is 90.24%, which passes the 90% gate by 0.24 points. canonicalizer.ts branch coverage is 87.7%, below 90%.

Scratch scripts: /home/fahimfarookme/.cache/gemini-earning-portfolio-audit/ledgerseal-scratch/probe.js and flow.js.

## 2. Verdict table

| # | Question | Verdict | One-line reason |
|---|---|---|---|
| 1 | Tenant isolation | PARTIAL | Issue id comes from `context.extension.issue` first (index.ts:168-170). But any viewer of the panel can seal or reseal any issue they see (LS-01). |
| 2 | asUser vs asApp, real accountId | PARTIAL | All Jira calls are asApp. accountId comes from context. Email and display name fall back to payload values (LS-03). |
| 3 | Manifest | PARTIAL | nodejs22.x, real modules. Scopes are acceptable but contradict the spec. External icon URL. No entity-property index. |
| 4 | KVS | FAIL | Unbounded growth per panel view, history pollution, read-modify-write races (LS-06, LS-07). |
| 5 | Jira REST hygiene | FAIL | No retry, no timeout, no `fields` filter, every error swallowed to `null` (index.ts:48-56). |
| 6 | UI Kit safety, invoke errors | PARTIAL | No XSS surface in UI Kit. Errors only go to console. Load failure shows "Issue Not Sealed" (LS-12). |
| 7 | Type safety | PARTIAL | tsc exit 0 with `strict`. 27 uses of `any` in src. |
| 8 | Tests | PARTIAL | 77 of 77 pass. 90.24% branch. UI excluded. Production code has `NODE_ENV==='test'` bypass paths that tests rely on (LS-14). |
| 9 | Determinism | PARTIAL | Key order and label order: stable (Observed-test). Ordered arrays lose order. Dates not normalised. |
| 10 | Seal coverage | FAIL | Status, reporter, resolution, worklog, time tracking, 13 hard-coded custom field ids and heuristic-matched fields are outside the hash (LS-04, LS-05). |
| 11 | Change triggers SEAL_BROKEN | FAIL | 11 of the probed changes give the same hash and SEAL_VALID (Observed-test). |
| 12 | Crypto | FAIL | node:crypto SHA-256, correct primitive. Plain unkeyed hash, no signature, no key. Any panel viewer can reseal. Verifier trusts KVS, not the entity property (correct). |
| 13 | Tamper history | FAIL | Reseal drops all tamper history from the active record. History list gets one bogus SUPERSEDED row per tamper view. No hash chain (LS-02, LS-06). |
| 14 | Workflow validator | PARTIAL | Wiring real. Fails closed. On Jira fetch failure it blames "Summary" and writes SEAL_BROKEN to the issue (LS-08). |
| 15 | Synthetic data | PARTIAL | Stored declaration text differs from the text the user agrees to (LS-09). Defaults such as "Authorized Signer" can be persisted. |
| 16 | Certificate UI trust | PARTIAL | Shows hash, signer, time, counts. No sealed field list. States differ by title text and lozenge text, not colour only. "AUDIT READY" over-claim. |
| 17 | Destructive actions, errors | FAIL | Reseal is gated by checkbox plus text. Seal failure is silent. No "why and how to fix". |
| 18 | ADS fidelity | PASS | Uses ADS space tokens and UI Kit components. No hex colours. Inline form, no modal. |

## 3. Findings

### LS-01 Critical. Any user who can view the issue can seal or reseal it. This defeats the gate.
- Evidence: Observed-code index.ts:167-229 and index.ts:344-346. Observed-test flow.js step 3.
- Detail: `sealIssue` checks no permission, project role, group or approver list. The resolver accepts any invoke from the panel. The panel is visible to anyone with Browse permission.
- Failure scenario: User Mallory edits the summary of an approved issue. The validator blocks the transition. Mallory opens the panel, clicks "Re-Authorize and Reseal", types any text, ticks the box. flow.js output: `3 mallory reseals; validator: true | signer: mallory-9`. The release gate passes. The original approver is not notified.
- Fix: Add an approver policy (project role, group, or per-issue user picker field). Check it server side with `asUser()` permission checks or a stored policy. Block self-approval of own edits. Require a different signer than the last editor, or require two signers for reseal after tamper.

### LS-02 Critical. Reseal erases tamper evidence from the active record and from the visible history.
- Evidence: Observed-code index.ts:228-229, seal-repository.ts:46-66. Observed-test flow.js steps 3 and 4.
- Detail: A reseal writes a new certificate with no `isCompromised` and no `tamperHistory`. The history summary row (seal-repository.ts:54-61) records only certificateId, signer, hash and "SUPERSEDED". It does not record that the old seal was broken. The archive copy keeps the tamper history, but no code path or UI reads `cert:archive:*` or `cert:history:*`.
- Failure scenario: After LS-01, an auditor opens the panel. It shows "Cryptographic Seal Verified" and "UNTAMPERED & AUDIT READY". Nothing shows that tampering happened. flow.js: `active isCompromised: undefined | tamperHistory: undefined`.
- Fix: Carry tamper incidents forward into the new certificate. Record `previousCertificateId`, `previousStatus` and incident count in the history row. Show the full seal history in the panel. Add hash chaining (each entry includes the hash of the previous entry).

### LS-03 High. Signer email and name can be spoofed from the client payload.
- Evidence: Observed-code index.ts:194-206; frontend/index.tsx:185-187. Observed-test flow.js step 3.
- Detail: `signerEmail` starts as `signature.signerEmail` from the payload. It is replaced only if the Jira user API returns an email. Jira hides email for most users by profile privacy. `signerAccountId` falls back to the payload when `context.accountId` is missing.
- Failure scenario: Mallory calls `invoke('seal-issue-api', { signature: { signerEmail: 'cfo@victim.example', reauthConfirmation: 'x' } })` from the browser console. flow.js records `Mallory cfo@victim.example`. The panel prints "Signer: Mallory (cfo@victim.example)". An auditor reads it as the CFO's signature.
- Fix: Never read identity fields from the payload. Remove `signerEmail`, `signerDisplayName` and `signerAccountId` from the accepted payload. Fail when `context.accountId` is absent.

### LS-04 High. Many material fields are outside the hash. Changes to them keep SEAL_VALID.
- Evidence: Observed-code canonicalizer.ts:226-258 (exclusion list), crypto.ts:14-22 (hash omits `status`). Observed-test probe.js.
- Detail: probe.js results, each with SEAL_VALID after the change: status changed; reporter changed; resolution set; worklog added; `timeoriginalestimate` changed. Excluded and not hashed: project (key only), issuetype name only, status, statusCategory, resolution, resolutiondate, reporter, creator, worklog, all time tracking, watches, votes. Attachments are hashed by id, filename, size, created, author (no content hash; acceptable because Jira attachments are immutable by id). Issue links keep only type name and keys. Components and fix versions keep only names. Comments are hashed (good).
- Failure scenario: A requester changes the reporter field to blame another person after a SOX sign-off. Or an admin sets resolution to "Won't Do" on a sealed issue. The seal stays valid.
- Fix: Hash reporter and resolution. Keep status out of the gate hash only if documented, and record it in the certificate. Publish the exact field list in the certificate and in the panel.

### LS-05 High. Hard-coded custom field ids and value heuristics silently drop real business fields.
- Evidence: Observed-code canonicalizer.ts:25-43 (13 fixed ids such as `customfield_10001`, `customfield_10050`), canonicalizer.ts:45-66 (substring and value heuristics). Observed-test probe.js.
- Detail: Custom field ids differ per Jira site. On one site `customfield_10001` is Team. On another it is a customer field such as "Approved budget". The heuristics also drop any string that contains `pullrequest` or `branch={` or starts with `0|`, any object with keys `participants`, `approvers`, `rating`, and any array whose first item has a `state` property.
- probe.js output: `SAME-HASH SEAL_VALID customfield_10001 (hardcoded volatile id) changed` (value "Approved budget 1000" to "9999999"); `SAME-HASH SEAL_VALID customfield_10050 ... changed`; `SAME-HASH SEAL_VALID string field containing "pullrequest" changed`; `SAME-HASH SEAL_VALID array of objects with .state changed`.
- Failure scenario: A customer seals a change request. An editor raises the approved budget in `customfield_10001`. The gate passes.
- Fix: Resolve field types through `/rest/api/3/field` schema (`schema.custom` such as `com.pyxis.greenhopper.jira:gh-sprint`, `com.atlassian.servicedesk:sd-sla-field`). Exclude by schema type, never by id or value. Let admins choose the sealed field set. Show excluded fields to the signer.

### LS-06 High. Every panel view on a tampered issue rewrites the certificate and pollutes history without bound.
- Evidence: Observed-code index.ts:292-298, seal-repository.ts:46-62, tamper-detector.ts:169. Observed-test flow.js step 2 and 4; probe.js.
- Detail: `verifyIssue` calls `saveCertificate(activeCert)`. That function treats the same certificate as "existing", marks it SUPERSEDED, overwrites its archive, and appends a history row. It also appends one tamper incident per view.
- flow.js after 3 views: `history entries: 3 | active tamperHistory: 3`, and step 4 shows four identical SUPERSEDED rows for one certificate id. probe.js: 500 verifies give 500 incidents and a 152,441-byte certificate.
- Failure scenario: A broken seal on a busy issue reaches the Forge KVS per-value limit (Inferred: 240 KiB per current Forge docs; the brief and the spec state 32 KB). Then `kvs.set` throws, verify throws, and the panel shows "Issue Not Sealed" (LS-12). The audit trail also falsely reports many supersessions.
- Fix: Persist an incident only when the live hash differs from the last recorded incident hash. Add a separate update method that does not archive. Cap and page incidents under their own keys.

### LS-07 Medium. Full snapshot stored in one KVS value. Large issues cannot be sealed. No concurrency control.
- Evidence: Observed-code crypto.ts:59 (`snapshot` inside certificate), seal-repository.ts:46-66. Observed-test probe.js: a 400-paragraph description gives a 108,197-byte certificate.
- Failure scenario: An issue with a long description and 100 comments exceeds the per-value limit. `saveCertificate` throws and the user sees nothing (LS-12). Two approvers who seal at the same time both read the same "existing" record and one history row is lost.
- Fix: Store snapshot parts under separate keys or in Forge SQL / custom entities. Use KVS transactions or a version check.

### LS-08 High. Validator blames "Summary" and publishes SEAL_BROKEN when Jira is unreachable.
- Evidence: Observed-code index.ts:109-147 (fallback to `{id,key}`), index.ts:140 (`tamperedFieldCount: 1` fixed). Observed-test flow.js step 6: `false | Cryptographic seal broken! 1 item(s) modified after sign-off (Summary) | property written: SEAL_BROKEN`.
- Detail: The gate fails closed, which is correct. But the error text accuses a real field. The validator also writes SEAL_BROKEN to the public entity property, without `isCompromised`, so other tools and JQL consumers see a false alarm.
- Failure scenario: A Jira 429 or timeout during a release transition. The release manager reads "Summary modified after sign-off" and starts an incident.
- Fix: When the live fetch fails, return `result:false` with "LedgerSeal could not read the issue. Try again." Do not write the property. Write the real tampered count.

### LS-09 High. The stored legal declaration is not the text the signer agreed to. The "re-authentication" is a free text box.
- Evidence: Observed-code frontend/index.tsx:87 vs frontend/index.tsx:233; index.ts:209-212, 225; frontend/index.tsx:225.
- Detail: The checkbox says "I certify that I am the authorized signer and this record is complete, accurate, and ready for release." The certificate stores "I electronically sign and seal this issue per compliance guidelines." The re-authentication challenge accepts any non-empty string. It does not verify a password, a second factor or a session. 21 CFR Part 11 §11.200 requires two distinct identification components at signing (Inferred from the regulation text; not legal advice).
- Failure scenario: An auditor compares the declaration on file with the UI and finds a mismatch. The e-signature claim fails review.
- Fix: Store the exact displayed text and a version. Drop the Part 11 claim, or integrate a real re-authentication step outside the app.

### LS-10 High. Unkeyed hash. No signature. Integrity check never runs.
- Evidence: Observed-code crypto.ts:24-25, 47; crypto.ts:67 `verifyCertificateIntegrity` has no caller in src (grep). Observed-test probe.js: `outside recompute equals app hash -> true`.
- Detail: SHA-256 comes from Node `crypto` (correct; not hand-rolled). It is a plain digest, not HMAC or a signature. No key exists. So the app is tamper-evident only against users who cannot write app storage. That holds for normal users (KVS is app-private). It gives no evidence against the app vendor, a Forge deploy of modified code, or LS-01. `certificateHash` proves nothing because anyone who rewrites the certificate recomputes it.
- Failure scenario: A support engineer with deploy rights pushes a version that rewrites `cert:active:*`. No external party can detect it.
- Fix: Call `verifyCertificateIntegrity` on every read. For real evidence, anchor hashes outside the app: post the hash as an issue comment by the signer (`asUser`), or to a customer-controlled log, or sign with a key held in customer infrastructure. Rename the feature "tamper-evident".

### LS-11 Medium. Canonicalizer collapses distinct values and loses meaningful order.
- Evidence: Observed-code canonicalizer.ts:149-153 (trim), 164-187 (sort all non-ADF arrays), 165-166 and 177 (empty array to null). Observed-test probe.js.
- probe.js: `ordered custom array [b,a] vs [a,b] -> SAME (order lost)`; `SAME-HASH SEAL_VALID ordered list reordered (step3,step1,step2)`; `SAME-HASH SEAL_VALID summary trailing whitespace added`; `SAME-HASH SEAL_VALID field set to [] from absent`.
- Also false positives: `DIFF-HASH SEAL_BROKEN assignee displayName changed only (profile rename)` (canonicalizer.ts:78-83); `DIFF-HASH SEAL_BROKEN date same instant other tz (+0530)` (no date normalisation). Labels are not trimmed or de-duplicated (canonicalizer.ts:97-100): `label duplicated -> DIFF`.
- Failure scenario: A cascading or ranked list field (approval order, rollout order) is reordered after sign-off. The seal stays valid. A user changes their display name and every issue they are assigned to shows SEAL_BROKEN.
- Fix: Sort only known set-valued fields by schema. Hash `accountId` only. Normalise datetimes to UTC ISO. Do not trim text that a human typed; normalise only line endings.

### LS-12 Medium. UI hides errors. A load failure looks like "Issue Not Sealed".
- Evidence: Observed-code frontend/index.tsx:64-71, 94-96.
- Failure scenario: KVS throws (LS-06) or Jira times out. The panel tells a viewer the issue is not sealed and offers "Seal Issue". A seal failure leaves the form open with no message.
- Fix: Add an ERROR state with SectionMessage "warning", the cause, and a Retry button. Show seal errors inline.

### LS-13 Medium. Revocation and history exist in code but are unreachable.
- Evidence: Observed-code seal-repository.ts:72-99 (no caller in src); index.ts:340-346 (only two resolvers); frontend has no SEAL_REVOKED branch (frontend/index.tsx:114-176).
- Failure scenario: A compliance lead needs to withdraw an approval. No action exists. If a REVOKED record ever appears, the panel shows no status block.
- Fix: Add a revoke resolver with permission check and a SEAL_REVOKED view. Add a history view.

### LS-14 Medium. Test-only bypasses live in production code.
- Evidence: Observed-code index.ts:39, 183-186, 210, 281-283.
- Detail: Under `NODE_ENV==='test'`, seal and verify accept the client payload as the issue, and re-authentication is skipped. Most index tests exercise these paths, so coverage measures bypass code, not the production path.
- Failure scenario: Any runtime where `NODE_ENV` is set to `test` (Inferred: misconfigured CI deploy or tunnel) seals a client-supplied issue.
- Fix: Inject a Jira client interface and mock it in tests. Delete the environment branches.

### LS-15 Medium. Jira REST calls lack retry, timeout, field selection and error detail.
- Evidence: Observed-code index.ts:48-56, 61-73.
- Detail: Any status other than 200, including 429, returns null. Errors are swallowed by `catch {}`. No `fields=` filter, so the full issue (with rendered and all custom fields) is fetched. Comments embedded in the issue GET may be capped (Inferred; verify against Jira docs), so comments past the cap are outside the hash.
- Fix: Retry 429 and 5xx with backoff and `Retry-After`. Request explicit fields. Fetch comments with pagination from `/issue/{id}/comment`.

### LS-16 Medium. Tamper-then-revert detection needs someone to look in between.
- Evidence: Observed-code index.ts:292-298 (incident persisted only on verify), tamper-detector.ts:46-74. No changelog read anywhere in src.
- Failure scenario: An editor changes the scope, a deploy uses it, and the editor reverts it before anyone opens the panel or runs a transition. The seal shows VALID.
- Fix: Read `/rest/api/3/issue/{id}/changelog` since `sealedAt` during verify and validate. Or subscribe to `avi:jira:updated:issue` and record incidents on every edit.

### LS-17 Medium. Signer email is personal data stored and shown to every viewer.
- Evidence: Observed-code index.ts:203-205, 220; frontend/index.tsx:185-187.
- Failure scenario: A viewer sees an email that the user's Atlassian profile hides from them. There is no personal data reporting handling for account closure.
- Fix: Store accountId only. Render the name with the UI Kit `User` component. Implement the Atlassian personal data reporting API.

### LS-18 Medium. Validator merges transition-screen fields in raw form.
- Evidence: Observed-code index.ts:115-124.
- Detail: The code reads `payload.transition.modifiedFields`. Inferred: the Forge validator payload may place `modifiedFields` elsewhere and in a shape that differs from REST GET (for example ids instead of objects). Not verified against the Forge docs (network forbidden in this audit). If the location is wrong, transition-screen edits are not checked. If the shape differs, every transition with a screen shows SEAL_BROKEN.
- Fix: Verify against the Forge `jira:workflowValidator` docs and add a test from a captured real payload.

### LS-19 Low. Validator falls back to using the issue key as the KVS id.
- Evidence: Observed-code index.ts:86-93.
- Failure scenario: Jira fetch fails, so lookup uses `cert:active:PROJ-1`, which never exists. The gate blocks with "must be sealed" on a sealed issue. It fails closed, but the message is wrong.
- Fix: Return a "could not read issue" message.

### LS-20 Low. Manifest and packaging polish.
- Evidence: Observed-code manifest.yml:6 (icon on raw.githubusercontent.com); manifest.yml:31-36 (no `jira:entityProperty` module, so `ledgerseal-cert` is not JQL-searchable); index.ts:330-335 (`renderIssuePanel` is dead code).
- Fix: Bundle the icon as a resource. Add an entity property index if JQL search is a feature. Remove dead code.

### LS-21 Low. Issue panel shows raw ISO timestamps and a 16-character hash prefix.
- Evidence: Observed-code frontend/index.tsx:120, 123, 146.
- Fix: Format dates in the viewer's locale with timezone. Add a copy action for the full hash.

## 4. What is correct

- SHA-256 comes from Node `crypto`, not a hand-rolled implementation (crypto.ts:6, 25).
- The issue id comes from the trusted `context.extension.issue` before the payload (index.ts:168-170, 266-268). Cross-project access through the panel is not possible in normal use.
- `signerAccountId` comes from `context.accountId` when present (index.ts:194).
- The seal is computed from a live server-side Jira fetch, not from the client (index.ts:182-189), except the test-only path (LS-14).
- The verifier and validator trust KVS, not the writable entity property (index.ts:105, 277). This is the right trust boundary.
- Object key order is canonicalised. Observed-test: `key order reversed -> SAME`. Label and component order are stable. ADF content order is preserved and `localId` is stripped (canonicalizer.ts:181-184, 193).
- Comments are inside the hash (crypto.ts:21). Observed-test: `comment added -> SEAL_BROKEN`.
- The validator fails closed on every non-valid state and returns the documented `{result, errorMessage}` shape (index.ts:150-159).
- A broken seal stays blocked after a revert until reseal (tamper-detector.ts:41-62), once an incident is recorded.
- UI Kit components and ADS space tokens only. No raw HTML. No hex colours. States differ by title and lozenge text, not colour alone.
- `tsc --noEmit` passes under `strict`.

## 5. Listing, spec and README over-claims

| Claim | Source | Reality |
|---|---|---|
| "Immutable Audit Seal" | listing.md:4, package.json:4, README.md:1 | The active certificate is rewritten on every tampered view (LS-06) and replaced by any viewer (LS-01). |
| "Cryptographically seal", "cryptographic integrity" | listing.md:5, frontend/index.tsx:60, 112 | Plain unkeyed SHA-256 digest in app storage. No signature or key (LS-10). "Hash-based tamper evidence" is accurate. |
| "Captures a canonical snapshot of all issue fields and attachments" | listing.md:25, README.md:12 | Many fields excluded (LS-04, LS-05). Attachment content not hashed. |
| "If any user modifies a sealed ticket ... shows exactly which fields" | listing.md:27 | False for excluded fields. Attachment changes are not named in the validator message (workflow-validator.ts:38 says "attachments" only when no field changed). |
| "Continuously verifies" | README.md:14 | Verifies only on panel view or transition (LS-16). |
| "Enforces 21 CFR Part 11 electronic signatures", "FDA 21 CFR Part 11 compliant" | listing.md:12, 30; README.md:3, 17; package.json:21 | No real re-authentication, declaration mismatch, identity spoofable (LS-03, LS-09). This is a regulatory claim the code cannot support. |
| "SOC 2, ISO 27001, SOX" | listing.md:19, package.json:18-19 | No control mapping exists. Keywords imply certification. |
| "Audit-grade System of Record", "UNTAMPERED & AUDIT READY" | README.md:3, spec.md:13, frontend/index.tsx:125 | Not supported (LS-01, LS-02). |
| "Cloud Fortified", "100% Data Residency Compliant" badges | listing.md:6 | Cloud Fortified is an Atlassian program with requirements this repo does not show. No data residency configuration exists. Inferred: both badges are unearned. |
| "Authentication: OAuth 2.0 (3LO)", "TLS 1.3", "AES-256" | listing.md:54-55 | Forge apps do not use 3LO here. Encryption claims are platform claims and need Atlassian wording. |
| "0 KB outbound" | listing.md:53 | Backend egress is zero (correct). The panel icon loads from GitHub (manifest.yml:6). |
| Scopes "only read:jira-work and storage:app"; "never requests write access" | spec.md:23, 172-174, 243 | Manifest has `write:jira-work` and `read:jira-user` (manifest.yml:33-35). The manifest is reasonable; the spec is wrong. |
| Key names `cert:active:issue:{id}`, project index `cert:index:project:{key}` | spec.md:184-189, README.md:38 | Code uses `cert:active:{id}` (seal-repository.ts:18). No project index exists. |
| Invariant 2: hash equal iff states equal | spec.md:20-21 | False both ways (LS-11 probes). |
| Invariant 3: certificate never modified in place | spec.md:22 | Modified in place (index.ts:292-297). |
| Number formatting rule | spec.md:135 | Not implemented. |
| PDF/A audit export with sha256sum instructions | spec.md:227-234 | Not implemented. |
| "52 tests", "93.26% branches" | README.md:49-50 | Measured 77 tests and 90.24% branches. |
| "Forge 32 KB limit" test | security-adversarial.test.ts:107-115 | Test uses a 2-field snapshot. Real issues reach 108 KB+ (LS-07). |

## 6. Integration facts

Entity property key: `ledgerseal-cert` on `/rest/api/3/issue/{issueId}/properties/ledgerseal-cert`. Written with `asApp()`.

Shape written on seal (index.ts:233-244):

```json
{ "status": "SEAL_VALID", "certificateId": "<uuid>", "snapshotHash": "<64 hex>",
  "sealedAt": "<ISO-8601 UTC>", "tamperedFieldCount": 0, "isCompromised": false,
  "lastVerifiedAt": "<ISO-8601 UTC>" }
```

Shape written on verify (index.ts:303-314): same keys. `status` is one of `SEAL_VALID`, `SEAL_BROKEN`, `SEAL_COMPROMISED`, `SEAL_REVOKED`. `tamperedFieldCount` is the real field diff count. Not written when there is no active certificate.

Shape written by the validator on a failed check (index.ts:132-143): `status` is always `"SEAL_BROKEN"` (even for COMPROMISED or REVOKED), `tamperedFieldCount` is always `1`, and `isCompromised` is absent.

Observed-test example (flow.js step 5): `{"status":"SEAL_VALID","certificateId":"0a481750-...","snapshotHash":"cd02d479...","sealedAt":"2026-10-30T22:06:57.174Z","tamperedFieldCount":0,"isCompromised":false,"lastVerifiedAt":"..."}`.

Can an outside app verify a seal?
- The property is writable by any user or app with edit permission on the issue. An outside app must not trust it. Nothing signs it.
- The property has no `schemaVersion` or canonicalizer version.
- An outside app can recompute the hash only if it reimplements canonicalizer.ts exactly: the exclusion list (226-258), the 13 hard-coded ids and heuristics (25-66), the field-name mapping (286-297), the `type` derived from the raw JS value (302), and the JSON.stringify key order of crypto.ts:14-22. Observed-test: given the same canonical snapshot, a plain `sha256(JSON.stringify({issueId, issueKey, projectKey, issueType, fields, attachments, comments}))` equals the app hash. The canonical snapshot itself sits in app-private KVS, so outside apps cannot read it. Any drift in the Jira REST response shape (for example a new `fields` key) changes the hash.

## 7. Suggestions

### Quick wins
1. Remove `signerEmail`, `signerDisplayName`, `signerAccountId` from accepted payload (LS-03).
2. Store the exact declaration text shown in the UI (LS-09).
3. Stop `verifyIssue` from calling `saveCertificate`; persist an incident only on a new live hash (LS-06).
4. On Jira fetch failure, say so; do not blame "Summary"; do not write the property (LS-08, LS-19).
5. Add an ERROR UI state and show seal errors (LS-12).
6. Hash reporter and resolution; hash assignee by accountId only (LS-04, LS-11).
7. Call `verifyCertificateIntegrity` on read (LS-10).
8. Remove Part 11, SOC 2, Cloud Fortified, data residency, 3LO and "immutable" claims until supported. Fix README numbers.

### Hardening
1. Approver authorization policy and separation of duties for reseal (LS-01).
2. Schema-based field exclusion through `/rest/api/3/field`; admin-chosen sealed field set (LS-05).
3. Carry tamper history across reseals; hash-chained history; history and revoke UI (LS-02, LS-13).
4. Changelog-based or event-trigger-based tamper detection (LS-16).
5. Split storage, use transactions, cap growth (LS-06, LS-07).
6. Retry and backoff, explicit fields, paginated comments (LS-15).
7. Remove `NODE_ENV` branches; inject a Jira client; test the frontend (LS-14).
8. Publish a versioned canonical-form spec and an open-source verifier so customers can recompute hashes.

### Strategic UX
1. Certificate view with the sealed field list, excluded fields, signer (UI Kit `User`), local time, full hash with copy.
2. Side-by-side diff for every changed field and attachment, plus "who changed it, when" from the changelog.
3. Reseal flow that names the tamper, requires an approver who did not make the change, and notifies the original signer.
4. Optional external anchor (signer-authored comment or customer webhook) for evidence beyond app storage.

## 8. Readiness score: 25 / 100

Rationale. The code compiles cleanly, tests pass, the Forge wiring is real, and the trust boundary between KVS and the entity property is right. The core promise fails. Any viewer can reseal and pass the gate (LS-01). Reseal hides prior tampering (LS-02). The signer email is spoofable (LS-03). Material fields fall outside the hash through fixed ids and heuristics that differ per site (LS-04, LS-05). Storage grows on every view (LS-06). The listing makes regulatory claims (21 CFR Part 11, SOC 2, Cloud Fortified) that the code cannot support. Two Critical findings block any release. Seven High findings (LS-03, 04, 05, 06, 08, 09, 10) block a paid listing.
