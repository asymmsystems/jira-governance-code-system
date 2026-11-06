# LedgerSeal finish merge review

- Date: 2026-11-06. Reviewer: independent merge review session (not the session that wrote the fixes).
- Branch: `feature/ledgerseal-finish` at `a15694d` (7 commits plus one merge of master). Target: `master` at `daa6cb0`, which is the merge base, so there is no conflict.
- Read: the "Finish" entries of `docs/sdlc/ledgerseal-marketplace-fixes-2026-11/progress-log.md`, the previous review `docs/sdlc/merge-reviews-2026-11/ledgerseal-followups-4-merge-review.md` (M-10, L-16, L-17), the full diff (24 files), `verifyIssueFlow`, `verifyAgainstSeal`, `hiddenComments`, `evidenceFlow`, `recordIncidentIfNew` and `writeAttestation` in `apps/ledgerseal/src/service/ledger.ts`, `convertRecord` and `convertHeld` in `src/service/conversion.ts`, `canonicalForm` in `src/domain/crypto.ts`, every Jira call in `src/jira/jira-client.ts`, the validator message in `src/validator/workflow-validator.ts`, and the new frontend `src/frontend/context.tsx`.
- Probes and scripts (not committed), in `/home/fahimfarookme/.cache/jira-suite-merge-review/ledgerseal-finish/`: `probes/zz-probe-f06.test.ts` (P2, P3), `scripts/mutate.py` with `mutation-results.txt` and `mutation-g12.txt` (16 guard mutations), `scripts/gate.sh` with `gate-branch.txt`.
- Clone: `/home/fahimfarookme/Documents/projects/gemini-earning-cp-fixes/.tmp/review-ls-finish`. Every mutation and probe was undone; `git status` is clean.
- No live check, no deploy, no change to any Jira site.

## 1. Verdict

**Round 1: do not merge** (final verdict after round 3: **Merge**, see section R3). One High finding (H-1): the evidence export gives the text of a restricted comment to a viewer who cannot see that comment in Jira, in two cases that the export check does not cover. The listing, the reviewer notes, the README and the spec v3 say the evidence is exported "only to a user who can see the comment in Jira", so this is a public claim that the code does not support.

The rest is in good order. M-10 is fixed as the previous review proposed, and every guard that the fix log names has a test that fails when the guard is removed (section 3). F-20 is correct: the only Jira write in the app is the `ledgerseal-cert` property. F-12 adds the context entry with no button. L-17 is done. The gate passes.

## 2. Findings

### Critical

None.

### High

**H-1. The evidence export ignores a comment that is restricted now, and a removed comment of a seal made before F-06.** `apps/ledgerseal/src/service/ledger.ts:922-934` (`evidenceFlow`).

- The check takes its list of restricted comments from `snapshot.restrictedComments`, that is, the visibility at the time of the seal. Only for a snapshot made before F-06 does it read the live comments, and then it counts only sealed comments that still exist and are restricted now.
- The panel uses a wider rule (`hiddenComments`, `ledger.ts:752-763`): a comment restricted at the seal OR restricted now, and, for a snapshot made before F-06, every sealed comment that no longer exists. So the panel and the export disagree, and the export is the weaker one.
- Probe P3 (`probes/zz-probe-f06.test.ts`): a seal made by this branch covers an open comment "SECRET-P3". Later someone edits the comment in Jira and restricts it to the Developers role (Jira allows a change of visibility on edit). A viewer who is not in the role exports the evidence: the result is `ledgerseal-evidence/1` and it holds "SECRET-P3". This case is not limited to old data: it applies to every new seal.
- Probe P2: a seal made before F-06 (no `restrictedComments`) covers a comment "SECRET-P2" restricted to a role. The comment is deleted. A viewer who is not in the role sees "A restricted comment that you cannot see in Jira" in the panel, but the export gives the full text. Production 2.0.0 holds seals made before F-06, so this case is reachable on production data after the next deploy.
- Why High: it discloses comment text that Jira denies to the viewer, and the listing (`docs/marketplace/ledgerseal-listing.md:34`), `docs/marketplace/submission/ledgerseal-submission-notes.md:32`, `apps/ledgerseal/README.md:21` and `docs/spec/ledgerseal-spec-v3.md:234` state the opposite. It is not a regression (master exports to every viewer), but the branch makes the public claim.
- Suggested fix: in `evidenceFlow`, build the restricted set the same way as `hiddenComments` does: the ids in `snapshot.restrictedComments`, plus every sealed comment that is restricted in the live read (one `getComments` as the app for every snapshot, not only an old one), plus, for a snapshot made before F-06, every sealed comment that is no longer in the live list. Then refuse when any of them is missing from the viewer's own list. Add P2 and P3 as tests; both must fail with the code of `a15694d`.

### Medium

None.

### Low

- **L-18. A hidden comment row still names its author and time.** `ledger.ts:721-734` replaces both values and removes `detail`, but keeps `changedBy` and `changedAt` (the spread of `rest`). A viewer outside the role sees "Comment added by X at T". Jira hides a restricted comment from such a viewer entirely, author included. Probably acceptable (the panel must say that something changed), but the docs do not say that the author is shown. Decide and state it.
- **L-19. The spec keeps the old scope reasoning.** `docs/spec/ledgerseal-spec-v3.md:277`: "The app cannot publish its property without `write:jira-work` (FG-27). LedgerSeal keeps the scope and states it." The table above it now says the granular scope replaces `write:jira-work`. Internal document only.
- **L-20. "Reads only" for the context entry is not exact.** `src/frontend/context.tsx:4-5` and the fix log say the entry reads only. It calls `verify-issue-api`, which writes a change row and the `ledgerseal-cert` property when it finds a new change (`verifyAgainstSeal` calls `recordIncidentIfNew`, `ledger.ts:683`). That is the same as a panel load, and `appendStatus` makes two concurrent loads safe, but the claim is literally wrong. The test "the entry reads only" checks only that the source has no button and no seal or revoke call. Internal text only.
- **L-21. Two invalid-branch guards are now defensive only.** With the new second check before the record write, removing the first `heldAndUnchanged()` call (`conversion.ts:284`) fails no test (G3), and comparing only `recordHash` inside `heldAndUnchanged` (`:278`) fails no test (G6). I find both defensive: without the first check, the rows, assignments and content are rewritten with tokens and the run still ends BUSY before the record write; inside the lease, no writer can change the record and keep its `recordHash`. The fix log does not claim tests for these two, so this is not a false claim.
- Cosmetic: `test/support/fakes.ts:64`, `getComments` is indented by 4 spaces instead of 2.

## 3. Fix-log entries checked

| Entry | Diff does what it says | Test fails without the fix | Notes |
|---|---|---|---|
| M-10 whole-record compare after the lease (`eba2778`) | Yes: `conversion.ts:231`, `canonicalJson(weNow) !== canonicalJson(we)` | Yes: back to `recordHash` (G1), P1 fails | |
| M-10 invalid branch checks again before the record write | Yes: `:294-296` | Yes: second check removed (G4), "writes no record when a row follows the head" fails | First check untested now (L-21) |
| M-10 next-row part of `heldAndUnchanged` | Yes: `:279` | Yes (G5), same test fails | Lease part removed (G7): the M-9 invalid-branch test fails |
| L-16 journal compare | Yes, test added | Yes (G2), "journal compare" test fails | |
| L-16 next-row check in `stillCurrent` | Yes, test added | Yes (G8), "next-row check" test fails | The row is placed directly, as the log says |
| L-16 attempt limit | Yes, test title fixed, test counts 3 lease claims | Yes (limit 10, G9) | |
| L-17 open-verifier exit 1 (`ace581b`) | Yes: `site/apps/ledgerseal/open-verifier.md:63` | n/a (docs) | Site page outside the repository: item 21 |
| F-06 snapshot records restricted comments (`9e00bd7`) | Yes: `canonicalizer.ts:397-402`; `canonicalForm` is an allow-list, so the field is neither hashed nor exported (`crypto.ts:18-29`) | Yes (G15), 3 tests fail | |
| F-06 panel masking | Yes: `ledger.ts:718-734`, `:752-763` | Yes: masking removed (G10) 4 fail; restricted-now part (G14) 2 fail; old-snapshot removed part (G13) 1 fails; failed read shows text (G16) 1 fails | History rows hold only field ids and token ids, and the validator only field names, so no other panel path shows comment text. L-18 |
| F-06 export check | Partly: refuses when a comment recorded as restricted at the seal is not in the viewer's list | Yes: check removed (G11) 2 fail; old-snapshot fallback removed (G12) 1 fails | H-1: restricted-now and removed old comments are not checked |
| F-06 docs | Text present in listing, notes, README, spec v3 | n/a | H-1 makes the export part of the sentence false |
| F-12 context entry (`e445058`) | Yes: `jira:issueContext` `ledgerseal-context`, resource `context`, no button, shared resolver, licence check through `verify-issue-api` | Tests check the manifest text, the view model and the source; no render test | L-20. Expanded view not proven live (log says so) |
| F-20 scope (`5a3afa2`) | Yes: manifest, README, notes, spec table, manifest and listing tests | n/a (`forge lint` does not check scope coverage, as the log says) | Every Jira call checked: the only non-GET call is `PUT /rest/api/3/issue/{id}/properties/ledgerseal-cert` (`jira-client.ts:275-281`), the granular `write:issue.property:jira` operation. No comment, link, issue edit or transition is written anywhere in `src` (all `requestJira` calls go through `jira-client.ts`; the frontends use only `invoke`). Personal data uses `report:personal-data`, KVS uses `storage:app`. L-19 |

Could not confirm (not re-run, live): the development 5.0.0 and 5.1.0 deploys, the install upgrade with the new scope, the PAY-10 revoke and reseal that rewrote the property under `write:issue.property:jira`, the LSP-5 role test (comment 10042) and the clean-up of the role membership. The code supports the F-20 result: no other write exists that the narrow scope would miss.

## 4. Gate (branch head `a15694d`)

| Check | Result |
|---|---|
| `npm ci` (shared UI package, then the app) | exit 0 |
| `npx tsc --noEmit` | 0 errors |
| `npm test -- --coverage` | 49 suites, 531 tests pass; statements 98.06%, branches 94.15%, functions 96.97%, lines 98.71% |
| `npm run build` | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 (7 moderate, none high or critical) |
| `npx --yes @forge/cli@15.0.0 lint` | No issues found (host Node 26, CLI warns that it supports 22 and 24) |
| `git status` | clean |
| Em or en dashes in changed files | none |
| Copyright header and `@author` in new source and test files | present (7 of 7) |

Apps CI on the branch head: run 42230401582 (push, `a15694d`) success. The fix-log gate numbers match mine.

## 5. Not merged

With a High finding, nothing was merged or committed to `master`. The fixing session addresses H-1 (and, at its choice, the Low findings) and asks again.

---

## Round 2 (branch at `0ec66bc`)

- Date: 2026-11-06. Same reviewer. New commits: `22cc3e1` (export rule, L-18), `e14667f` (L-19, L-20, L-21 docs), `0ec66bc` (fix log only). Master still at `daa6cb0`, the merge base.
- Probes (not committed): `probes/zz-probe-f06.test.ts` (P2, P3) and the new `probes/zz-probe-f06-r2.test.ts` (P4). New tests against the old code: `round2-new-tests-at-a15694d.txt`. Gate: `gate-branch-0ec66bc.txt`. All in `/home/fahimfarookme/.cache/jira-suite-merge-review/ledgerseal-finish/`.

### R2.1 Verdict

**Do not merge.** P2 and P3 are fixed and L-18 to L-21 are done, but one case of the same kind remains (H-2). The H-1 fix finds a comment that was "restricted later" only when the app can still read that comment. The fix log's own live check (LSP-5, comment 10042) shows that Jira does not return a comment to the app when the comment is restricted to a role the app user is not in. That is the usual setup, so in practice the most common way to restrict a comment after the seal is not caught.

### R2.2 Findings

#### Critical

None.

#### High

**H-2. A comment that was open at the seal and is later restricted to a role or group that the app user is not in looks deleted, so the panel and the export show its sealed text to everyone.** `apps/ledgerseal/src/service/ledger.ts` `hiddenComments` (`:756-767`) and `evidenceFlow` (`:927-937`).

- Both rules treat a sealed comment that is missing from the app's live read as restricted only for a snapshot made before F-06 (`!recorded && !liveIds.has(id)`). For a snapshot made by this branch, a missing comment counts as deleted and open.
- Probe P4 (`probes/zz-probe-f06-r2.test.ts`): a seal by this branch covers the open comment "SECRET-P4". The comment is then restricted to a role the app user is not in. The app's read no longer returns it, an insider's list still has it, and an outsider's list does not. Result at `0ec66bc`: the outsider's panel shows a "Comment removed" row with sealed value "SECRET-P4", and the outsider's export is `ledgerseal-evidence/1` and contains "SECRET-P4".
- The listing (`docs/marketplace/ledgerseal-listing.md:34`), the notes, the README and spec v3 now say: "A covered comment that is restricted, at the seal or now, is shown in the panel only to a user who can see it in Jira ... The evidence is exported only to a user who can see every such comment." P4 breaks both parts of that sentence. Severity is the same as H-1: a false public claim and comment text that Jira denies to this viewer. It is not a regression (`a15694d` and master behave the same way).
- Fix options (owner decision; I recommend the first):
  1. Fail closed for every snapshot, as the branch already does for a snapshot made before F-06. A sealed comment that is missing from the app's live read counts as possibly restricted. The panel hides its text unless the viewer's own list has it. The export is refused unless the viewer's own list has it. Consequence: after any covered comment is deleted, nobody can export the evidence of that seal until the changes are approved. This is the same trade-off as for pre-F-06 seals below, but it applies to all seals.
  2. Keep the code and narrow the claim. State that a comment restricted after the seal to a role or group the LedgerSeal app user is not in looks deleted to LedgerSeal, and that its sealed text stays in the panel and in the evidence for every viewer.
- Add P4 as a test. With option 1 it must fail at `0ec66bc`.

#### Medium

None.

#### Low

- **L-22. "Seal the issue again to export its evidence" promises more than it gives.** The listing, notes, README and site item 25 say this for a seal made before F-06 that covers a since-deleted comment. A deleted comment makes the seal CHANGED, so the action is "Approve these changes", which makes a new seal. That new seal's evidence can be exported, and its history keeps the old rows. But the old seal's snapshot, which is what an auditor of that approval needs, can never be exported again. Suggested wording: "Its evidence is not exported to anyone; approving the changes makes a new seal whose evidence can be exported."

### R2.3 The fail-closed rule for seals made before F-06 (asked by the coordinator)

**Acceptable, and the docs mostly state it** (wording: L-22).
- The rule: evidence of a seal made before F-06 that covers a since-deleted comment is refused to everyone. Such a snapshot never recorded the comment's visibility, and after the deletion no one's Jira comment list can show that the viewer was allowed to see it. Exporting it could disclose a restricted comment (P2), and refusing it discloses nothing. Without a way to learn the old visibility, fail closed is the only rule that keeps the public claim true.
- What this costs: production 2.0.0 seals made before F-06 lose their evidence export when a covered comment is deleted. The panel still shows the state and the history, and the history rows are exported with the next seal's evidence. Only the old snapshot is lost from export. A deleted comment already breaks the seal, so the approver must act anyway.
- Option 1 of H-2 would apply the same cost to new seals. That is the owner's call, but it is consistent with this rule.

### R2.4 Round-1 entries checked again

| Entry | Diff does what it says | Test fails without the fix | Notes |
|---|---|---|---|
| H-1 export follows the panel's rule (`22cc3e1`) | Yes for the cases it names: restricted at the seal, restricted now in the app's read, or removed from a snapshot made before F-06; live read as the app; fails closed | Yes: at the `src` of `a15694d`, P3, P2 and "fails closed" fail (4 of 14 in the file fail, with L-18) | P2 and P3 probes now give RESTRICTED_EVIDENCE and no leak. H-2 remains |
| L-18 hidden row has no author and no time | Yes: `changedBy: []`, `changedAt: null`, closed and unknown counts dropped | Yes, the L-18 test fails at `a15694d` | Separation of duties reads Jira, not the row: unchanged |
| L-19 spec scope note | Yes, `ledgerseal-spec-v3.md:277` | n/a | |
| L-20 context entry wording | Yes: code comment, test name, fix log | n/a | |
| L-21 defensive guards | Recorded in the fix log, as found | n/a | |
| Cosmetic `fakes.ts` indent | Fixed | n/a | |

Could not confirm (live): the development 5.2.0 deploy and the PAY-10 export with 5 of 5 PASS.

### R2.5 Gate (branch head `0ec66bc`)

| Check | Result |
|---|---|
| `npm ci` (shared UI package, then the app) | exit 0 |
| `npx tsc --noEmit` | 0 errors |
| `npm test -- --coverage` | 49 suites, 536 tests pass; statements 98.06%, branches 94.15%, functions 96.99%, lines 98.71% |
| `npm run build` | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 |
| `npx --yes @forge/cli@15.0.0 lint` | No issues found |
| `git status` | clean (only this uncommitted report) |

Apps CI: run 42232583106 on `e14667f` was a success. `0ec66bc` changes only the fix log. The fix-log gate numbers match mine.

### R2.6 Not merged

With H-2 open, nothing was merged or committed to `master`.

---

## Round 3 (branch at `28907f6`)

- Date: 2026-11-06. Same reviewer. New commits: `9aeb3ef` (H-2 fail closed), `e493a8a` (L-22, decision recorded), `28907f6` (fix log only). Master still at `daa6cb0`.
- The H-2 choice (option 1, fail closed) was passed to me by the coordinating session as the suite owner's decision. It is recorded as such in spec v3 section 4.4 and in the fix log. I did not see it from the owner directly.
- Probes (not committed): P2, P3, P4 as before, and the new `probes/zz-probe-r3-worklog.test.ts` (P5). New tests against the old code: `round3-new-tests-at-0ec66bc.txt`. Mutations: `mutation-r3.txt`. Gate: `gate-branch-28907f6.txt`. All in `/home/fahimfarookme/.cache/jira-suite-merge-review/ledgerseal-finish/`.

### R3.1 Verdict

**Merge.** H-2 is fixed as decided and no Critical or High finding remains. One Medium finding (M-11, restricted work log text in the evidence) existed before this branch, and no document claims otherwise. It should be fixed or accepted before the next production deploy.

### R3.2 H-2 and L-22 checked

| Entry | Diff does what it says | Test fails without the fix | Notes |
|---|---|---|---|
| H-2 panel (`9aeb3ef`) | Yes: `hiddenComments` (`ledger.ts:756-769`) hides every sealed comment that is missing from the app's live read, for every seal, without asking Jira; the readable restricted ones keep the per-viewer rule | Yes: at the `src` of `0ec66bc`, P4 and the changed change-list test fail. Mutation G17 (no `gone`): 5 tests fail | P4 probe: no sealed text for an outsider or an insider |
| H-2 export | Yes: `evidenceFlow` (`:936`) refuses when any sealed comment is missing from the app's live read | Yes: at `0ec66bc`, "a sealed comment the app can no longer read stops the export for everyone" and P4 fail. Mutation G18 (refusal removed): 3 tests fail | The test also shows that approving the changes makes exportable evidence again |
| H-2 message | `RESTRICTED_EVIDENCE` text names both causes and the way out | n/a | |
| L-22 | Yes: listing, notes, README, spec v3 and site item 25: "its evidence is not exported to anyone; approving the changes makes a new seal whose evidence can be exported" | n/a | |

Probes at `28907f6`: P2, P3 and P4 give RESTRICTED_EVIDENCE, and the secret appears in no panel and no export.

Cost of the decision: after any covered comment is deleted, nobody can export that seal's evidence until the changes are approved, and the old snapshot is never exported again. The listing, notes, README and spec state this. It is consistent with the pre-F-06 rule I found acceptable in round 2.

### R3.3 Other paths to a sealed comment's text

| Path | Result |
|---|---|
| Panel change list (`verify-issue-api`) | Every `comment:{id}` row passes the masking: value text, `detail`, author and time. Field rows show display text; the work log field shows only "N work log entries" (`canonicalizer.ts:292`) |
| Panel details | `coveredFields` and `excludedFields` carry only field ids, names and reasons. The seal summary holds no content |
| History rows (`seal-history-api`, and the history in the export) | `LS_CHANGED` rows store `fieldId`, `fieldName`, `changedBy` tokens and `changedAt` only (`ledger.ts:365-373`). No text |
| Context entry | Same resolver as the panel; shows only the lozenge, the status sentence and a fixed hint |
| Workflow validator | Error text lists field names only (`workflow-validator.ts:59-63`) |
| `ledgerseal-cert` property | Attestation fields only (hashes, ids, counts) |
| Evidence export | The snapshot is exported only after the comment checks. The restricted list is outside the hashed and exported form (`crypto.ts:18-29`) |
| Work log comments in the snapshot | See M-11 |

### R3.4 Findings

#### Critical

None.

#### High

None.

#### Medium

**M-11. A work log restricted to a role or group is exported with its comment text to any viewer.** Work logs are a covered field. Their canonical value includes each work log's `comment` (`canonicalizer.ts:262-272`). The evidence exports that snapshot, and the F-06 checks look only at issue comments.
- Probe P5 (`probes/zz-probe-r3-worklog.test.ts`): a work log restricted to the Developers role, with comment "SECRET-P5", is covered by the seal. A viewer outside the role exports the evidence: `ledgerseal-evidence/1` with "SECRET-P5". The panel does not leak it (it shows only the count).
- Why Medium and not High: no document claims that work logs follow the F-06 rule (the listing, notes, README and spec speak only of comments). The behaviour is the same on master. And the app can read a restricted work log only when its user is in that role or group, the same narrowing as for comments.
- Suggested fix (follow-up branch): record restricted work logs as `restrictedComments` does, and apply the same panel and export rule. Or state in the listing that the evidence includes work log comments, restricted ones included. Fix or accept before the next production deploy.

#### Low

None new.

### R3.5 Gate (branch head `28907f6`, and the merge result)

| Check | Branch head | Merge result |
|---|---|---|
| `npm ci` (shared UI package, then the app) | exit 0 | exit 0 |
| `npx tsc --noEmit` | 0 errors | 0 errors |
| `npm test -- --coverage` | 49 suites, 537 tests pass; statements 98.06%, branches 94.13%, functions 97.01%, lines 98.71% | same |
| `npm run build` | exit 0 | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 | exit 0 |
| `npx --yes @forge/cli@15.0.0 lint` | No issues found | No issues found |
| `git status` | clean (only this report) | clean |
| `tools/verifier` `node --test` | not run | 12 of 12 |
| Em or en dashes in changed files | none | none |

Apps CI: run 42235737803 (push, `28907f6`) success. The fix-log gate numbers match mine.

Could not confirm (live): the development 5.3.0 deploy and the PAY-10 export with 5 of 5 PASS.

### R3.6 Merge

Merged `--no-ff` into `master` as `a6288a4` (parents `daa6cb0` and `28907f6`). Master had not moved, so there was no conflict, and the merge tree equals the branch head. The gate on the merge result is in the table above (`gate-merge-a6288a4.txt`). This report is committed after the merge.
