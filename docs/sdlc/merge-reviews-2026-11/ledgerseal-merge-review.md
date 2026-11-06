# LedgerSeal merge review

- Date: 2026-11-06. Reviewer: independent merge review session (not the session that wrote the fixes).
- Branch: `feature/ledgerseal-marketplace-fixes` at `6b6e996`, cut from `7f87747`. Master at review end: `8666cad` (holds CascadePlan `e1b0192`, DefinitionGuard `32e86ca`, the CI change `8666cad`).
- Public verifier: `asymmsystems/jira-governance-code-cli` `main` `2504985`, release `v1.1.0`.
- Read: the fix log `docs/sdlc/ledgerseal-marketplace-fixes-2026-11/progress-log.md`, the readiness review `docs/sdlc/suite-readiness-review-2026-11/ledgerseal-readiness.md`, the suite plan `README.md`, ADR-00011, spec v3, the full diff (103 files), and every changed `src/` file in full.
- Probes (not committed): `docs/sdlc/merge-reviews-2026-11/evidence/ledgerseal/probes/zz-review.test.ts` and `zz-review2.test.ts`. They import master's own LedgerSeal code (extracted with `git archive origin/master`) next to the branch code. Output files: `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/ledgerseal/probe-out/`.
- No live check and no deploy: the probes cover the questions without the site.

## 1. Verdict

**Merge.** No Critical or High finding. The ADR-011 design is built as written and holds up across versions: a record written by master's code is read by the branch as SEAL_VALID, converted by the weekly job with no account id or name left outside the token map, and every export (old, unconverted, converted, new 2.2.0, after a closure) passes the public verifier. Separation of duties now covers comments, work logs, attachments, revoke and re-seal. Every fix commit's tests fail without the fix. Four Medium findings remain; two of them must be settled before the Marketplace submission (M-3, M-4), not before the merge.

## 2. Findings

### Critical
None.

### High
None.

### Medium

**M-1. An interrupted conversion followed by a seal or revoke rolls the record back at the next weekly run.** `apps/ledgerseal/src/service/ledger.ts:560-564` (`convertIfNeeded` returns ALREADY when `attributes.parties === 'TOKEN'`, without looking at the journal) and `apps/ledgerseal/src/service/conversion.ts:169-170, 259-276` (with a journal present, `convertRecord` writes `ls3:we:` again with `statusHead` = the redaction row). Scenario (probe R1): the conversion commits (`conversion.ts:272`), then the invocation stops while deleting superseded snapshots (`:279-281`), so the journal `ls3:convert:{issue}` stays. A user revokes (the conversion check says ALREADY). The weekly job finds the journal and writes the work effort back with head seq 4 while row 5 (the revoke) exists. Evidence: the panel shows the revocation reason as "CAB ok" (the reseal reason); the evidence history ends at the REDACT row, so the revoke entry is missing, and the verifier still passes; every later seal returns CONFLICT (`appendStatus` on seq 5), so the issue stays revoked and blocked with no way out in the app. A concurrent weekly run and seal on the same old record has the same window. Scope: only records written before ADR-011, which exist only on the development site (LSP-1, LSP-2, LSP-4, DEMO-34; production was never deployed), hence Medium. Fix: `convertIfNeeded` treats a journal as "not finished" (as `convertAll` does, `conversion.ts:312`), and `convertRecord` with a journal refuses to write `ls3:we:` when the stored head is past the redaction row.

**M-2. A closed account's id is written back to the token map by a later incident.** `ledger.ts:350-355` (`recordIncidentIfNew` registers every change log author since the seal). Scenario (probe R2): mallory edits a sealed issue; the weekly report gets "closed" for mallory and deletes `ls3:party:<token>`; carol then edits the same field; the next view records a new incident and `attribute` names mallory again from Jira's change log, so `register` stores mallory's account id again. The next weekly report removes it again, so the id is held up to a week each time. The listing (line 42) says the app "erases a closed account's link to its token". Fix: register only accounts that Jira reports as active (`/user` `active`), or do not register change log authors who were already attributed in an earlier row.

**M-3. The listing and the notes claim a production key that does not exist yet.** `docs/marketplace/ledgerseal-listing.md:39` ("signed ... by ... `ls-prod-2026-11`, public key in the open verifier repository"), `docs/marketplace/submission/ledgerseal-submission-notes.md` section 2 "Signing", and step 1.5 (`node verify-evidence.mjs <file>` without a key file, which reads `keys/<keyId>.pub.pem`). Today `apps/ledgerseal/keys/`, `tools/verifier/keys/` and the verifier release hold only `ls-dev-2026-11`. The code supports the claim (`attestation.ts`, environment variables); the fix log lists it as owner commands 1 to 6. Not a merge blocker, since merging publishes nothing, but a submission blocker: the owner commands and a verifier release with the production key come first.

**M-4. Part 11 11.50 wording.** `ledgerseal-listing.md:52` says LedgerSeal supports "signature manifestation (21 CFR 11.50) by recording the approver". 11.50(a)(1) asks for the printed name of the signer in the record. Since ADR-011 the record holds a party token and no name; the name is shown only while the token map links it to a live account, and after a closure it is "a closed account". The 11.200 / 11.300 boundary sentence (line 54) is correct. Suggested wording: "records a pseudonymous signer, the time and the meaning of the sign-off with each seal; the panel shows the signer's Jira name while the account exists; the stored record does not hold a printed name". Owner decision (it is a compliance claim).

**M-5. Carried open: F-06 restricted comments shown to every viewer.** Listed as open in the fix log ("Left open"). Not confirmed or refuted here (needs a second user with a role-restricted comment). Recorded so it is not lost.

### Low

- **L-1.** The verifier does not compare `attestation.status` with the history head (`tools/verifier/verify-evidence.mjs:80-81`). In M-1 an attestation `SEAL_REVOKED` passed with a history whose newest entry is REDACT. Consider a fifth check: the newest non-redaction entry matches the attestation status.
- **L-2.** `deleteIssueRecords` (`apps/ledgerseal/src/service/personal-data.ts:81-100`) leaves a conversion journal `ls3:convert:{issueId}` (tokens and hashes only, no account id).
- **L-3.** `ledgerseal-submission-notes.md` section 5 is numbered 1, 3, 2.
- **L-4.** Screenshot `03-transition-blocked.png` shows the test title "[LS-PROBE] LedgerSeal validator live check". Real, but it reads as test data.
- **L-5.** A comment typed on the transition screen of a gated transition on a sealed issue always blocks it ("Comment added", `src/index.ts:119-132`). This follows from F-02 and is safe, but the user guide should say so.
- **L-6.** Token map holds only people who sealed, changed or revoked; people only named in the snapshot (assignee, mentions, commenters) are tokens with no map entry and are not reported. This matches ADR-011 decision 4; a pseudonymous token is still personal data under GDPR, so the privacy text should describe it as such (the proposed text in the fix log does).
- **L-7.** `.github/workflows/test.yml` in the verifier repository has no Apache-2.0 header (the `.mjs` files have it).

## 3. Fix-log entries checked

| Entry | Diff does what it says | Test fails without the fix | Notes |
|---|---|---|---|
| ADR-011 | Yes; decisions 1 to 11 match the code | n/a | Probe: master record converted, ids gone, evidence verifies |
| F-18 headers (`7808bd3`) | Yes | Yes: 8 of 142 fail with parent src | |
| MK-02 audit (`8581fdb`) | Yes, `overrides` | n/a | `npm audit --omit=dev --audit-level=high` exit 0, 7 moderate |
| B1 part 1 tokens, 2.2.0, schema 3, prices (`54f0ea2`) | Yes | Yes: 17 of 18 suites fail | Prices $0.95 / $0.75 / $0.24 in the listing and `test/listing.test.ts` |
| B1 part 2 report, closure, deleted issues (`b14e19f`) | Yes; Forge `reportPersonalData` batches by 90 itself | Yes: 2 suites fail | |
| B1 part 3 conversion (`4a2eb72`) | Yes | Yes: both suites fail (module missing) | M-1 |
| B3, F-17 verifier (`8d8f969`) | Yes; `tools/verifier` = public repo (`diff -r`, empty) | Verifier tests 10 of 10 pass | Release assets match `SHA256SUMS` and the repo |
| B2, F-01, F-13 SoD (`0b64023`) | Yes: approve, revoke, re-seal after revoke | Yes: 3 suites fail | Probe: author's approve and revoke refused |
| F-02, F-03 (`3f09cfa`) | Yes | Yes: suite fails | Live payload shape from the log not re-run |
| B5, F-04, F-08, F-14, F-15 (`cd6794b`) | Yes; unsigned log, panel warning, evidence `warning` | Yes: 2 suites fail | |
| F-05, F-10 (`5e385d2`) | Yes | Yes: 5 of 16 fail | |
| B6 screenshots | Five files, 1840 x 900, real captures (01 to 05 viewed: 02, 03, 05) | `listing.test.ts` | L-4 |
| Docs (`6b6e996`) | Yes; Part 11 boundary restored | Yes: 10 of 12 fail with parent docs | M-3, M-4 |

Could not confirm: the live checks of the fix log (not re-run; development site), the weekly report on the live site (no run yet, per the log), F-08 live (no licence object on a development install).

## 4. Public verifier

`asymmsystems/jira-governance-code-cli` is public, Apache-2.0 (`LICENSE`, the headers of `verify-evidence.mjs` and `test/verify.test.mjs`, `package.json`). It is identical to `tools/verifier` at `6b6e996`. No "without trusting", "independence" or similar claim (grep over the repository); the README says what a PASS does not show. No em or en dash. Old evidence (exported by master's code, canonical form 2.1.0, account ids) and redacted evidence (with the LS_REDACTED NOTE) both pass with exit 0.

## 5. Gate

| Check | Branch head `6b6e996` | Merge result |
|---|---|---|
| `npm ci` (shared UI package, then the app) | exit 0 | exit 0 |
| `npx tsc --noEmit` | 0 errors | 0 errors |
| `npm test -- --coverage` | 46 suites, 484 tests pass; statements 97.88%, branches 94.26%, functions 96.61%, lines 98.67% | same |
| `npm run build` | exit 0 | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 (7 moderate) | exit 0 |
| `forge lint` | No issues found | No issues found |
| `git status` | clean | clean |
| `tools/verifier` `node --test test/` | 10 of 10 | 10 of 10 |

Apps CI on `6b6e996` (run 42193282589): the LedgerSeal job is green; the DefinitionGuard and FourRealities jobs failed only on `forge lint` MAJOR_VERSION approval notices, which master's CI change `78247e3` no longer treats as failures.
