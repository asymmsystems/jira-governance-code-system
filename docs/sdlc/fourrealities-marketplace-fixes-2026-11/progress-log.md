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
