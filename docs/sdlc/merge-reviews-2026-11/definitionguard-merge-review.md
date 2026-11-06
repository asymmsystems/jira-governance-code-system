# DefinitionGuard merge review: feature/definitionguard-marketplace-fixes

- Date: 2026-11-06
- Reviewer: independent review session (not the session that wrote the fixes)
- Branch: `feature/definitionguard-marketplace-fixes` at `f54f215` (12 DefinitionGuard commits over `7f87747`)
- `master`: `907ccd7` during the review; `1c54b6d` at the merge (CascadePlan merged in `e1b0192`, its review in `1c54b6d`)
- Merge: `32e86ca` (`git merge --no-ff` of `f54f215` onto `1c54b6d`, no conflict, only DefinitionGuard files changed)
- Clone: `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/definitionguard/checkout` (local branch `review` at `f54f215`)
- Brief: `docs/sdlc/cascadeplan-marketplace-review-2026-11/merge-review-prompt.md` (on the CascadePlan branch)
- Read: the fix log `docs/sdlc/definitionguard-marketplace-fixes-2026-11/progress-log.md`, the readiness review `docs/sdlc/suite-readiness-review-2026-11/definitionguard-readiness.md`, ADR-010 `architecture/decision/adr-00010-definitionguard-personal-data-pseudonyms.org`, and the full diff `7f87747..f54f215` (69 files).
- No live check was run. Nothing was deployed. No live site was changed.

## Verdict: Merge

Update at merge time: CascadePlan reached `master` in `e1b0192`, so HM-1 below is resolved. The merge of this branch onto `1c54b6d` changed only DefinitionGuard files, and the full gate on the merge result was green (section 3). No Critical or High finding remains. The Medium and Low findings below are open for the fixing session.

The first verdict, kept as a record, follows.

**First verdict: Do not merge now (merge right after the CascadePlan branch is on master).** The DefinitionGuard code has no Critical or High finding. Every fix-log entry that I could check matches the diff, and each code fix has a test that fails without it (section 4). The gate is green.

The one High finding is about the merge itself, not about the DefinitionGuard code. The branch was cut from `7f87747`, so it also carries 76 CascadePlan commits as they stood at `7f87747`. That CascadePlan state has the round 1 High findings H1 and H2 of the CascadePlan merge review. They were fixed later, in `7551e2f` and `ebb490a`, which are not on this branch. A merge of this branch into `master` now would put that unfixed CascadePlan code on `master`. The brief allows no merge while a High finding is open.

The CascadePlan round 2 review (`/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/cascadeplan-r2/cascadeplan-merge-review.md`) says "Merge" for `e9e85e8`. When `master` holds that branch, this branch merges with no conflict. I checked this with a local trial merge: `origin/master` + `origin/feature/cascadeplan-marketplace-fixes` (`e9e85e8`) + this branch. The trial merge changed only the 69 DefinitionGuard files, and the full gate on it was green (section 3). The trial was local only, and I deleted its branch.

## 1. Findings

### Critical

None.

### High

- **HM-1 (resolved: CascadePlan merged to master in `e1b0192` before this merge) A merge now would put CascadePlan code with open High findings on master.** `git log 7f87747..origin/feature/cascadeplan-marketplace-fixes` lists 21 commits that this branch does not have. Among them are `7551e2f` "fix(cascadeplan): baseline items reach only users who can browse their issues" and `ebb490a` "fix(cascadeplan): the server holds a parent's links on its sub-tasks when dependencies are enforced". These are the fixes for the round 1 High findings H1 and H2 (`/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/cascadeplan/cascadeplan-merge-review.md`, verdict "Do not merge" at `935c399`). This branch holds CascadePlan at `7f87747`, which is before both fixes. **Fix:** merge the CascadePlan branch to `master` first. Then merge this branch (no app-code change is needed). Or merge `origin/feature/cascadeplan-marketplace-fixes` into this branch first. No change to the DefinitionGuard code is needed.

### Medium

- **M-A The not-the-assignee window restarts when an item is reopened, and a former assignee can do the reopen.** `src/domain/event-log.ts:273` sets `openedAt` on Reopen and Reset. `src/index.ts:395` and `:197` count only assignees after `openedAt`. Scenario: developer A works the issue and then assigns it to B. Reviewer B ticks "Code review approved". A (or an approver who was A) reopens the item, or resets the checklist, then ticks it again as A and moves the issue to Done. The validator passes, because A was the assignee only before the new `openedAt`. This is the stated rule ("An assignee from before the item was opened may still tick it", fix log H-1/H-2 decision; listing row "Not-the-Assignee Rule"). The test "lets someone tick who was the assignee only before the item was reopened" (`test/resolvers/roles-waivers.test.ts:186`) asserts it. The bypass needs someone else to close the item first, and every step is in the hash-chained history. So it is Medium, not High. **Fix (suggested):** do not let a Reopen or Reset restart the window for the person who did it. Or always count the whole assignee history.
- **M-B The signing-key page that the listing and the panel name does not exist.** `https://asymm.systems/product/jira-governance/signing-keys.html` returns 404 (`curl`, 2026-11-06). The listing (`docs/marketplace/definitionguard-listing-v2.md:103`), the reviewer notes and the panel note (`src/integrity/attestation.ts`, `signedNote`) name it. On development the panel already shows this URL (screenshot 05). The fix log lists the page as "Site changes needed" item 6. It is not public yet, so it does not block the merge. **It must be published before the listing is submitted and before the production deploy.**

### Low

- **L-A A claimed test does not test what it says.** The fix log says the test "a rewritten event that is changed again, or a Redact row for a later event, fails the check" covers both cases. Removing the guard `r.seq >= e.seq` (`src/domain/event-log.ts`, `redactionsOf`) leaves all 18 tests in `test/privacy/personal-data.test.ts` passing. The test's "self row" case expects `ok: true` and does not exercise the guard. The guard is correct, but no test covers it.
- **L-B The weekly report runs after the one-time pass in the same invocation.** `src/privacy/personal-data.ts:331-354`. The pass checks the time left only between pages of 20 issues (reserve 15 s). On a site with many records from before 6.0.0, one page can use up the rest of the invocation, so the report is skipped that week. Only sites with pre-6.0.0 data are affected (development; the ADR says production holds no customer data). **Fix:** report first, then run the pass. Or check the time per issue.
- **L-C `signatureStatus()` says "Property signed" when both variables are set but the key cannot be used.** `src/integrity/attestation.ts`, `signatureStatus` checks only that the variables exist. `signIfConfigured` then writes `sig: null` with a warning. **Fix:** try the key once in `signatureStatus`.
- **L-D Screenshots.** All five are real captures of this branch's UI. They show the new approver line, the "Property signed" note and the new block message, and each is 1840 x 900. But they show the owner's real name ("Fahim Farook"; the fix log notes this limit), and 05 shows the development key id and the 404 URL (M-B). The caption of 04 says "an extra permission", but every row in the image shows "No extra permission".
- **L-E Shared files are still open** (fix log, "Left for the main session"): the CI audit step runs only for CascadePlan (`.github/workflows/apps-ci.yml`); `developer-console-checklist.md` step 2.3 has no DefinitionGuard price, and line 19 still points to `<app>-listing.md`; the site changes 1 to 9 are not made. These do not block the merge, but they must be done before submission.

## 2. Focus items

| Item | Result | Evidence |
|---|---|---|
| ADR-010 pseudonyms | Confirmed | Every write path stores `PartyStore.pseudonymFor(...)`: tick, waive, reset (`src/index.ts`), template, exemptions, re-sync (`settings-resolvers.ts`), approver policy (`policy-admin.ts`). A new checklist is created by `'system'`. The only account ids left in storage are `dg:pty:` and `dg:pid:`. |
| Redaction event, chain still verifies | Confirmed | `verifyChain` accepts a changed event only when a later Redact row names both hashes. Mutation: dropping that check fails 5 tests. A crash between the Redact append and the rewrites leaves a chain that still verifies (the Redact is written first). Residual risks are stated in ADR-010. |
| Erasure on closed accounts | Confirmed | `reportPersonalData` erases each `closed` account (`erase` deletes both map keys). The panel then shows "A deleted user" and the chain is intact (test). Mutations "erase is a no-op" and "closed not erased" each fail 4 tests. |
| Weekly report | Confirmed in code | `manifest.yml` `scheduledTrigger` `interval: week`, scope `report:personal-data`. `privacy.reportPersonalData` in `@forge/api` 8.4.0 sends batches of 90 (read in `node_modules/@forge/api/out/privacy`). Not run live (fix log says why); see L-B. |
| Issue property without personal data | Confirmed | Schema 3 has no `lastModifiedByAccountId`; a mutation that adds it back fails the attestation test. |
| Signing key behaviour | Confirmed | Both `DG_SIGNING_KEY` and `DG_SIGNING_KEY_ID` are required; the `dg-default` fallback is gone; a missing variable is logged by name; an unusable key gives `sig: null` with a warning. Mutations fail 1 to 2 tests. See M-B and L-C. |
| Inactive licence lets moves through | Confirmed | `evaluateTransition` returns `{ result: true }` before any read. Writes are refused. Reads work: `getIssueChecklist`, `getChecklistHistory` and `getItemEvidence` have no licence check. The panel and settings get the notice. H-3: `getAppContext().license` is the fallback, and `AppContext.license` exists in `@forge/api` 8.4.0 (`out/api/runtime.d.ts:144`). The licence state was not checked live (fix log: needs a reinstall). |
| H-1 waiver by the assignee | Confirmed | The waive resolver refuses the current or a former assignee. The gate counts a waived not-the-assignee item as open when the waiver came from an excluded assignee. Mutations fail 1 to 2 tests. |
| H-2 former assignees | Confirmed, with M-A | The changelog is read as the user (resolvers) and as the app (validator); a failed read blocks. A never-reopened item counts the whole history (`dca26d0`): the mutation that restores the old window fails the live-found test. |
| Screenshots from the shipped app | Confirmed | Viewed all five. They show 6.x-only text (approver line with groups, "Property signed" note, new block message). `file`: 1840 x 900 each. See L-D. |
| Listing claims vs code | Confirmed except M-B | Not-the-assignee row, waivers, export and settings (Administer projects or Jira admin), licence, personal data, property fields, the 6 scopes = manifest, SOC 2 CC8.1 only, GxP wording is not an electronic signature. The old listing is deleted. |
| Prices $0.95 / $0.75 / $0.24 | Confirmed | `listing-v2.md:115-118` (annual $9.50 / $7.50 / $2.40; custom above 1,000); the listing test forbids the old prices. |

## 3. Gate

Host Node 26.13.0 (CI uses 22). The order follows `.github/workflows/apps-ci.yml`: shared UI package first, then the app.

| Check | Branch head `f54f215` | Trial merge (master + CascadePlan `e9e85e8` + this branch) |
|---|---|---|
| `npm ci` (shared UI, then app) | exit 0; `@asymm/jira-ui/dist/index.js` present | exit 0 |
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npm test -- --coverage` | 33 suites, 421 of 421 passed; statements 98.94%, branches 96.10%, functions 96.41%, lines 99.18%; lowest branch `src/index.ts` 92.34% | same |
| `npm run build` | exit 0 | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 (7 moderate) | exit 0 (7 moderate) |
| `forge lint` | "No issues found." | "No issues found." |
| `git status` | clean | clean |
| Apps CI on `f54f215` | run `42152379747`: success for all four apps | n/a |
| Em and en dash scan of the changed text files | 0 | n/a |
| Copyright header in new `.ts`, `.tsx`, `.py` files | all present | n/a |

Merge result `32e86ca` (onto `1c54b6d`): `npm ci` exit 0, `tsc` exit 0, 33 suites and 421 of 421 tests passed (statements 98.94%, branches 96.10%, functions 96.41%, lines 99.18%), build exit 0, audit exit 0 (7 moderate), `forge lint` "No issues found.", `git status` clean.

Logs: `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/definitionguard/gate-branch.log`, `gate-trial-merge.log` and `gate-merge.log`.

The fix log's last count is 420 tests at `dca26d0`. 421 at `f54f215` includes the BL-3 screenshot test added in that commit.

## 4. Do the tests fail without each fix (mutation run)

Each line removes one fix from `f54f215`, runs the named tests, and restores the file (`tools/mutate.py`; `git status` was clean afterwards).

| Fix removed | Result |
|---|---|
| BL-4 validator blocks on an inactive licence | 2 failed |
| H-3 licence only from the call context | 1 failed |
| BL-4 panel notice | 1 failed |
| BL-1 Redact not accepted by `verifyChain` | 5 failed |
| BL-1 Redact row for a later event accepted | **0 failed** (L-A) |
| BL-1 raw account id stored | 27 failed |
| BL-1 erase does nothing | 4 failed |
| BL-1 closed accounts not erased | 4 failed |
| BL-1 property keeps the account id | 1 failed |
| H-1 gate counts a waiver by the assignee | 1 failed |
| H-1 waive resolver allows the assignee | 2 failed |
| H-2 resolver checks the current assignee only | 3 failed |
| H-2 validator checks the current assignee only | 1 failed |
| H-2 history read fails open | 3 failed |
| `dca26d0` window from the template link date | 1 failed |
| BL-2 unnamed-key fallback | 2 failed |
| BL-2 silent unsigned property | 1 failed |
| M-4 deleted issue keeps its records | 2 failed |
| M-8 page of 25 | 1 failed |
| Jira admin fix (`ADMIN_KEYS`) | 2 failed |
| M-1 approver groups not sent | 1 failed |
| M-7 admin load error spins | 1 failed |
| M-5 old block message | 2 failed |
| BL-5 override removed | 1 failed |
| UI bundle imports a Forge server module | 1 failed |

## 5. Fix-log entries not confirmed

- "a Redact row for a later event, fails the check": no test covers it (L-A).
- All live checks (versions 6.0.0 to 6.4.0 on development, PAY-15 to PAY-27, the workflow validator changes, signature verification with `verify_property.py`): not repeated. The fix log records them with scripts in `apps/definitionguard/test/live/`. I did not need a live check for the verdict.
- Licence inactive and the weekly report live: the fix log itself says "Not run".
- Live change 8 (pending): the first weekly run on development will rewrite DefinitionGuard records and the property on DEMO-3, 9, 10, 12, 15, 16, 17, 18, 22, 26, 35 and TEST-1. TEST is outside PAY and DEMO. The owner should know this before the run, or deploy a build without the trigger to development.

## 6. Next step

1. Done: CascadePlan merged (`e1b0192`), then this branch (`32e86ca`).
2. Before submission: publish the signing-keys page (M-B), and do the shared-file and site changes (L-E). Consider M-A.
