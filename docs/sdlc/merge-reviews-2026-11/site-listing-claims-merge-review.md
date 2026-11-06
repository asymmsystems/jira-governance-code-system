# Site listing claims merge review

- Date: 2026-11-07. Reviewer: independent merge review session.
- Repository: `asymmsystems/asymm-corporate-code-pfw` (corporate website).
- Source branch: `feature/marketplace-live-links` at `b3b80d5`, from `develop` `784f151`. Six commits:
  - `9a3f876`: six site claims;
  - `6dab75f`, `8061270`, `5591db5`, `f32e165`: one Marketplace button per app;
  - `b3b80d5`: FAQ links to the four listings.
- **Only `9a3f876` was merged.** It was cherry-picked alone (`git cherry-pick -x`) onto a new branch `feature/site-listing-claims` from `develop`, as `d399540`. That branch was merged into `develop` with `--no-ff` as `23226e3` and pushed.
- The five link commits stay on `feature/marketplace-live-links` for launch day; `git log origin/develop` contains none of them.
- `main` (`72e1ba0`) and the tags are untouched.
- Build log, not committed: `/home/fahimfarookme/.cache/jira-suite-merge-review/site-listing-claims/build.txt`.

## 1. Verdict

**Merged into `develop`** (`23226e3`). The six changes match the app code and the listings. The cherry-pick carries exactly the change of `9a3f876` (the `+` and `-` lines of both diffs are equal). The build passes, and its output has no Marketplace link. No finding.

## 2. The six changes

| Page | Change | Checked against | Result |
|---|---|---|---|
| FourRealities guide (`user-guide/fourrealities.html`) | No "Reported, not verified" state. A record FourRealities cannot verify counts exactly like no record: Evidence missing on a Done issue, Not applicable before Done. A record changed after signing, copied from another issue, or older than one already seen counts as Evidence missing, also before Done. The RAI list no longer names "Reported". | `apps/fourrealities/src/engine/default-gate-engine.ts`: `stated()` returns FOUND or MISSING for a verified record, and for an unverified one NOT_APPLICABLE before Done or MISSING (`NOT_VERIFIED`). `trustOf` and `trustWithHistory` make a bad signature, a wrong issue or an older record `invalid`, and `evaluateProcess` returns MISSING for `invalid` whatever the status. No code in `src/` sets the state `REPORTED`; only an unused label in `ui/gate-text.ts` remains. Listing row "Signed Records Are Verified". | Match |
| Suite page, FourRealities card | A Checklists for Jira checklist is "shown but never counted as evidence" | The same engine: the Checklists for Jira record has trust `reported` ("not signed"), so `stated()` never returns FOUND for it. Listing, "Works with, and works alone". | Match |
| Suite page, data storage | "Persisted in Atlassian Forge Key-Value Storage (KVS) ... and as Jira issue properties on the customer's own issues" (was "exclusively in ... KVS") | Each app writes an issue property: `ledgerseal-cert`, `definitionguard-dod`, `cascadeplan.dates`, `.links`, `.create`, `fourrealities-exception` (manifests, security questionnaires) | Match |
| FAQ, CascadePlan personal data | Adds "the Jira administrator who last saved the approver groups" | CascadePlan questionnaire, Privacy & Security tab (`setByPartyId`); `privacy.html` on `develop` | Match |
| FAQ, response SLA | "A first answer within 24 business hours (Monday through Friday) for general questions and defects; within 4 hours for a defect that blocks your production work" | `support.html` on `develop` (same wording) | Match |
| LedgerSeal guide | The evidence record follows "section 2 ... for restricted comments and work logs" | LedgerSeal listing, row "Content Snapshot"; `restricted-comments` and `restricted-worklogs` tests (merge reviews of those branches) | Match |

## 3. Build

| Check | Result |
|---|---|
| `./mvnw -o clean process-resources`, `JAVA_HOME=/opt/eliya` | exit 0, no SEVERE or ERROR line |
| Rendered text | Each of the six changes is in `target/site`, and "Reported, not verified" is gone from the FourRealities guide |
| Marketplace links in the build | none (`marketplace.atlassian.com/apps/` is in no rendered file), as it must be before launch |

## 4. Note for launch day

`feature/marketplace-live-links` still contains `9a3f876`. When it is merged into `develop` on launch day, git applies the same change a second time with no conflict, because `develop` already has the identical lines. The runbook's steps (`docs/launch/launch-day-runbook.md`, step 3) need no change.
