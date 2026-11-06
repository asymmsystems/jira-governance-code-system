# FourRealities fixes: progress log

Branch `feature/fourrealities-marketplace-fixes`, from `master` at `7f87747`. One entry per fix, in the order built, with the commit and the proof. The review is `docs/sdlc/suite-readiness-review-2026-11/fourrealities-readiness.md` (blockers BL-1 to BL-5, findings F-H1 to F-L7). The owner's instruction (2026-11-06) was "do NOW": every recommendation of the review is adopted, and each adopted decision is recorded here and in its ADR.

Gate for every fix: `npx tsc --noEmit` with no errors, `npm test` green with the per-file coverage thresholds in `jest.config.js`, `npm run build` clean, `forge lint` clean. Node v26.13.0 and npm 11.20.0 on the host.

## 2026-11-06

### BL-5. No high or critical advisory in the production dependencies

- **What changed:** `apps/fourrealities/package.json` has `"overrides": { "prosemirror-view": "^1.42.3" }`, the same override CascadePlan uses; `package-lock.json` regenerated (`prosemirror-view` 1.42.9, deduped under `@atlaskit/editor-prosemirror`).
- **Proof:** `npm audit --omit=dev --audit-level=high`: exit 1 before (13 advisories, 8 high), exit 0 after (7 moderate, none high or critical). `tsc --noEmit` no errors; `npm test` 403 of 403 passed, thresholds met.
- **Not done here:** the CI audit step runs for CascadePlan only (`if: matrix.app == 'cascadeplan'` in `.github/workflows/apps-ci.yml`). That file is shared with the sessions that fix DefinitionGuard and LedgerSeal, so this session does not edit it. See "Owner commands".

### ADRs for the blockers

- **Commit:** `fb2e78b`. ADR-010 (sibling records and signatures), ADR-011 (evidence sources in use, admin page, approver groups), ADR-012 (personal data), each marked "[ADOPTED: owner instruction 'do NOW', 2026-11-06]" in `architecture/decision/`.
- **Adopted decisions** (the review's recommendation, taken as written unless noted):
  - D1 (BL-1, F-H1): accept DefinitionGuard schema v2 and the older shape; verify Ed25519 signatures with keys bundled per Forge environment; development keys only in development and staging; production trusts no key until the producers publish production keys.
  - D2 (F-H1): an unverified record is a new state, "Reported, not verified", and is not scored in either direction. Chosen over "a separate reported count inside the score" (the review's second option), because a forged record must not move the score.
  - D3 (F-M3): the producer's own status decides freshness; FourRealities no longer compares `issuedAt` with the issue's `updated` time.
  - D4 (BL-2): one admin page `fourrealities-admin`, titled "FourRealities gate authority" (the permission standard's title), with the evidence source per check, the decision issue types and the approver groups; "Detect" turns Process and Audit on only after a verified record, and Code only after pull request data, is seen on the site.
  - D5 (BL-3): no names and no exception or note text in snapshot rows; names read as the viewer per view; weekly personal data report; closed accounts replaced by `erased-account`.

### Owner pricing (coordinator message, 2026-11-06)

- **What changed:** `docs/marketplace/fourrealities-listing.md` pricing table: free for 1 to 10 users; $1.40 (annual $14.00) for 11 to 100; $1.10 ($11.00) for 101 to 250; $0.80 ($8.00) for 251 to 1,000; custom above 1,000. The annual column keeps the listing's "2 months free" rule (10 times the monthly price). The submission notes state no price. A listing test that checks these prices comes with BL-4.

### BL-1, F-H1, F-M3. DefinitionGuard and LedgerSeal records are read, verified, and scored only when verified (ADR-010)

- **What changed:**
  - `src/engine/default-gate-engine.ts`: `parseDefinitionGuardRecord` reads schema v2 (`mandatoryCompleted`, `mandatoryTotal`, `headHash`) and the older shape; extra fields and missing account id fields are allowed. Process and Audit: a verified record gives FOUND (verified) or MISSING; an unsigned record or one signed with an untrusted key gives REPORTED (not scored); a bad signature or a record signed for another issue gives MISSING with the reason (`DOD_SIGNATURE_INVALID`, `SEAL_SIGNATURE_INVALID`). The HeroCoders checklist is always REPORTED. The `issuedAt` against `updated` comparison is gone.
  - `src/accessor/attestation-verifier.ts` (canonical JSON, Ed25519 check), `src/accessor/attestation-keys.ts` (dev keys `dg-dev-2026-11` and `ls-dev-2026-11`, development and staging only), `issue-facts.ts` records the check per record, `index.ts` picks the keys from the Forge environment (`getAppContext().environmentType`; unknown means production).
  - Metrics: REPORTED is not scored and is counted in `GateCount.reported`. UI text: "Reported, not verified" with the reason; audit readiness names how many records are reported. F-L5: the recovery text now uses the chain order (Intent, Process, Code, Audit) like the next step, and "Why n%?" parts add up to the score (+34 +33 for 67%).
  - `test/architecture.test.ts` allows Node `crypto` in Accessors only.
- **Proof:**
  - New contract test `test/contract/sibling-attestations.test.ts` runs the real writers, `buildAttestation()` of `apps/definitionguard/src/integrity/attestation.ts` and of `apps/ledgerseal/src/domain/attestation.ts`, signs with a generated key, sends the JSON through `factsFromIssue` and the gate engine: DefinitionGuard complete gives FOUND verified with `2 of 2`; open items MISSING; unsigned REPORTED; the record without account id fields FOUND; a record changed after signing MISSING. LedgerSeal SEAL_VALID FOUND verified; SEAL_BROKEN and SEAL_REVOKED MISSING; unsigned REPORTED; a seal copied to another issue MISSING. 9 of 9 pass.
  - `test/accessor-attestation-verifier.test.ts` (canonical JSON, the five check results, keys per environment, bundled keys are Ed25519), new gate, metrics, text and index tests (signed record FOUND with a trusted key, REPORTED with an untrusted key in development and outside the runtime).
  - `tsc --noEmit` no errors; `npm test` 438 of 438 passed, every per-file threshold met; `npm run build` clean; `forge lint` "No issues found."

### BL-2, F-H5, F-M1, F-M4, F-M5, F-M6. Standalone behaviour: only the checks in use are scored; admin page with sources, decision issue types and approver groups (ADR-011)

- **What changed:**
  - New admin page `jira:adminPage` `fourrealities-admin`, "FourRealities gate authority" (`src/frontend/admin.tsx`, function `admin-resolver`, resolvers `fr-admin-get`, `fr-admin-save-sources`, `fr-admin-search-groups`, `fr-admin-save-approvers`). Every call checks global ADMINISTER as the user and fails closed with the standard's NOT_ADMIN text (`DefaultAdminManager`).
  - Per check: Intent In use / Not in use; Process Detect / DefinitionGuard / Checklists for Jira / Not in use; Code Detect / In use / Not in use; Audit Detect / LedgerSeal / Not in use. Stored at `fr:cfg:sources`, no account id. Detection at `fr:cfg:detected` (dates only), written when a read first shows a source. "Detect" turns Process and Audit on only after a verified signed record, and Code only when the site has a Development field and pull request data (JQL probe `development[pullrequests].all > 0` in the site configuration, cached 24 hours, or a pull request seen in a read).
  - A check not in use: NOT_APPLICABLE with reason `SOURCE_NOT_IN_USE`, "Not used on this site", not scored, no next step, no "Show missing" button. The dashboard lists the checks in use ("Checks in use on this site: ...") and notes sources found but not in use. A snapshot built before the last settings change is built again on the next view.
  - The two buttons that only reopened the issue ("LedgerSeal Audit Gate panel", "DefinitionGuard Checklist panel") are removed. The next step names the real panels: "the Definition of Done panel on this issue (DefinitionGuard)", "its Approval Seal panel (LedgerSeal)", or "Checklists for Jira" when that is the Process source (F-M5). Audit question: "Is the finished work sealed?".
  - Decision issue types are a setting (F-M6), default as before.
  - Approvers (F-M4): Tier 1 (ADMINISTER_PROJECTS or ADMINISTER) or Tier 2 (member of a group at `fr:cfg:approver_policy`, `GET /rest/api/3/myself?expand=groups` as the user), never the requester or the assignee. The panel gets an `approval` from the server and shows Approve, Reject and Revoke disabled with the standard note when the viewer may not decide; Withdraw only to the requester. `read:jira-user` is now used (groups, group names, user names), which answers F-L4.
  - F-M1: after the approver check, the decision's `fourrealities-exception` projection is written as the app; a withdrawal and a request stay the user's.
- **Proof:** new `test/engine/source-policy-engine.test.ts` (16 tests, including the review's section 4.2 matrix with the checks in use: a finished issue with a decision record on a FourRealities-only site is 100%, the same as while in progress; with DefinitionGuard and LedgerSeal turned on, missing records still count), `test/manager/admin-manager.test.ts`, `test/accessor-settings-and-directory.test.ts`, `test/frontend/admin.test.tsx`, `test/ui/sources-text.test.ts`, Tier 2 and approval tests in `test/manager/exception-manager.test.ts`, panel tests (disabled buttons with the note, Withdraw only for the requester), dashboard and index tests (admin resolvers as the user only, licence block, a settings change rebuilds the snapshot and turns Audit off). `tsc` no errors; `npm test` 490 of 490 passed, thresholds met; build clean; `forge lint` "No issues found."
- **Live finding behind F-H5** (development site, 2026-11-06, read only): field `customfield_10000` "Development" (`devsummarycf`) exists; JQL `development[pullrequests].all > 0` returns 0 issues; an invalid `development[...]` JQL returns 400, so the probe is a real query.
