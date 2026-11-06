# DefinitionGuard permission checks merge review

- Date: 2026-11-06. Reviewer: independent merge review session.
- Branch: `feature/definitionguard-permission-checks` at `a4ef407` (one commit), cut from master `6c19fa4`. Merged onto master `e93c0b7`, with one reviewer commit on top (`4aa5835`, questionnaire evidence only).
- Purpose: make questions 3, 7 and 9 of the Forge app security questionnaire true for DefinitionGuard.
  - Q3: a Browse projects check as the user before any storage read or `asApp()` read.
  - Q7: `write:jira-work` replaced by `write:issue.property:jira`.
  - Q9: limits on payload ids and cursors.
- Read: the full source diff; every resolver in `src/index.ts` and `src/settings/settings-resolvers.ts`; `src/settings/coverage.ts`; `manifest.yml`; `test/security/browse-check.test.ts`; `test/manifest.test.ts`; and `docs/marketplace/submission/definitionguard-security-questionnaires.md`.
- Gate output and mutation script (not committed): `/home/fahimfarookme/.cache/jira-suite-merge-review/definitionguard-permission-checks/`.
- **No live smoke test.** The fixing session deployed 7.0.0 to development and upgraded the installation, but could not open the panel, because the saved Jira session had expired (`/rest/api/3/myself` answered 401). I did not run one either. Owner action: the smoke script named in the questionnaire, Open issue 1.
- Nothing deployed by this review.

## 1. Verdict

**Merge.**
- Every issue panel resolver checks Browse projects as the user before any storage read or app read, and fails closed.
- The only non-GET Jira call is the issue property PUT, so the new scope is enough.
- The payload rules hold.
- All 17 mutations of the guards are caught, and the gate passes.

The scope change makes the next production deploy a major version: `forge lint -e production` reports `MAJOR_VERSION_RULE`, and each site administrator must accept the upgrade. Two Low findings stay open (section 5).

## 2. Q3: every resolver

| Resolver (module) | First call after context and payload checks | Result |
|---|---|---|
| `getChecklist`, `getHistory`, `getEvidence`, `exportHistory` (issue panel) | `issueContext`, then `requireBrowseIssue` | Covered |
| `toggleItem`, `waiveItem`, `resetChecklist` (issue panel) | `assertLicensed` (context only), then `requireBrowseIssue` | Covered |
| `authority-policy-get`, `-set`, `-group-search` (panel and admin page) | `isJiraAdmin` as the user | Rightly exempt: site-wide, no issue data |
| `getAvailableTemplates` | none | Rightly exempt: returns the built-in list `ALL_TEMPLATES`, with no read |
| `getSettings`, `saveTemplate`, `saveExemptions`, `resyncIssues`, `gateCoverage` (project settings) | `requireProjectAdmin` as the user (`checkAnyProjectPermission`, project admin or Jira admin) | Rightly exempt from the Browse check: a project-level admin check comes first. `resyncIssues` searches as the app but returns only counts. |
| `validateTransition`, `issueDeletedTrigger`, `personalDataTrigger` | none | Rightly exempt: no calling user |

`requireBrowseIssue` calls `GET /rest/api/3/mypermissions?issueId=<context id>&permissions=BROWSE_PROJECTS` as the user. A missing id, an error or a non-200 answer gives `BROWSE_CHECK_FAILED`; no grant gives `BROWSE_DENIED`. The test file checks, for each of the seven resolvers:
- the first call is this check;
- after a refusal there are no storage reads (`storage.gets`), no storage writes and no app call;
- the template read as the app (`fetchLiveJiraIssue`) comes only after a granted check.

A further test fails if a new panel resolver is not classified.

## 3. Q7: only one write

- `src/` has 20 `requestJira` calls. Only one passes an options object: `publishAttestation` (`src/integrity/attestation.ts:142`), `PUT /rest/api/3/issue/{id}/properties/definitionguard-dod`. All the others are GETs.
- No `requestConfluence` or `fetch` call, and the UI Kit frontend makes no `requestJira` call.
- `test/manifest.test.ts` pins this. It fails on any second `method:` in `src/`, and if the scope goes back to `write:jira-work`.

## 4. Mutations (each applied alone; full jest run)

| Mutation | Result |
|---|---|
| Remove the Browse check from each of the 7 resolvers | Each caught: 4 to 17 tests fail |
| `requireBrowseIssue` ignores a denial / passes a failed check / asks as the app | Caught: 10 / 9 / 114 tests fail |
| `toggleItem` loads storage before the Browse check | Caught: 2 tests fail |
| `itemIdOf` accepts any text; `cursorOf` drops the length limit; `isGroupId` drops the length limit; `setApproverPolicyFlow` skips `isGroupId` | Each caught: 1 to 4 tests fail |
| Scope back to `write:jira-work` | Caught: 2 tests fail |
| A second write (`method: 'POST'` on the re-sync search) | Caught: 1 test fails |

All 17 caught.

## 5. Findings

### Critical, High, Medium

None.

### Low

- **L-49. Three log lines write an error's message.** They are `src/privacy/personal-data.ts:199` and `:219`, and `src/privacy/issue-deleted.ts:48`. The questionnaire says so (question 8, section 2.2). Its claim that none of these messages carries an account id rests on what Forge storage and the personal data reporting API put in their errors. That is not under the app's control, and no test covers it. LedgerSeal writes only an error's name, code and status (`logFailure`, `apps/ledgerseal/src/service/log.ts`). The same change here would make question 8 hold whatever those APIs report.
- **L-50. Questionnaire evidence was dated.** Fixed in reviewer commit `4aa5835` (the same points as L-39, L-40 and L-43 for LedgerSeal):
  - question 10 cited run 42242271357 "(no app change since)"; it now cites Apps CI run 42249669133 on `a4ef407` (success) and my local audit (0 critical, 0 high, 7 moderate);
  - question 13's `git log -S"BEGIN PRIVATE KEY"` matches the questionnaire files themselves; it now uses `git log --all -G'^-----BEGIN PRIVATE KEY-----$'`, which I ran and which finds no commit;
  - question 16 no longer says the vendor assessment gives 24 hours;
  - the major version note now names `forge lint -e production`. Plain `forge lint` prints "No issues found".

### Considered, no finding

- The settings resolvers are not in the Browse test's classification, which reads only the panel `Resolver`. Each starts with `requireProjectAdmin`, as listed in the questionnaire, section 2.1.
- Q1, Q2, Q4 to Q6 and Q13 facts in the questionnaire match `manifest.yml` and `src/`.

## 6. Gate

| Check | Branch `a4ef407` (the merge result's `apps/definitionguard`, `packages` and `.github` are identical) |
|---|---|
| `npm ci` (shared package, then app) | exit 0 |
| `npx tsc --noEmit` | 0 errors |
| `npm test` (jest with coverage) | 34 suites, 461 tests pass; statements 99.07%, branches 96.36%, functions 97.01%, lines 99.32% |
| `npm run build` | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 (7 moderate) |
| `forge lint` | No issues found. With `-e production`: 1 approval, `MAJOR_VERSION_RULE` (scope change). |
| Apps CI | run 42249669133 on `a4ef407`: success |
| Live smoke test | not run (expired Jira session) |

The merge had one conflict, in `docs/marketplace/submission/definitionguard-security-questionnaires.md` (both sides added it). It was resolved with this branch's version, as instructed.
