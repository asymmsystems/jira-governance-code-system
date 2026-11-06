# Distribution kit claims 2 merge review

- Date: 2026-11-06. Reviewer: independent merge review session.
- Branch: `feature/distribution-kit-claims-2` at `ce9e10e` (one commit, 8 insertions, 10 deletions), cut from master `bda60e4`.
- Purpose: fix M-13 and L-33 to L-37 of `docs/sdlc/merge-reviews-2026-11/distribution-kit-claims-merge-review.md` in `docs/launch/distribution-kit.md`, with wording the owner approved.
- Checked against: `docs/marketplace/ledgerseal-listing.md`, `tools/verifier/README.md`, `apps/ledgerseal/src/domain/canonicalizer.ts`, `apps/ledgerseal/src/domain/tamper-detector.ts` and the LedgerSeal tests.

## 1. Verdict

**Merge.** All six findings are fixed, and the new wording agrees with the code and the listing. I have no new findings.

## 2. Findings from the previous review

| ID | Line | Result |
|---|---|---|
| M-13 | `:89`, `:94` r/jira | Fixed. `:89` names covered fields, comments, attachments and work logs. `:94` says only an uncovered field such as Rank or Sprint passes. Evidence: comments are compared one by one (`tamper-detector.ts:229`, test `tamper-detector.test.ts:165`); work logs are the covered `worklog` field (`canonicalizer.ts:262`, test `field-selection.test.ts:79` "reporter, work log and the old blind-spot fields now break the seal"); Rank and Sprint are excluded (`canonicalizer.ts:63-64`). |
| L-33 | `:32` | Fixed. "Zero external servers" appears once. |
| L-34 | `:96`, `:183` | Fixed. Both say "coming soon to the Atlassian Marketplace". No `marketplace.atlassian.com` link is left in the file. |
| L-35 | `:107` | Fixed. The title says "Detecting post-approval changes in Jira for SOC 2 and GxP audits". This matches the listing ("detects edits made after approval"). |
| L-36 | `:152` | Fixed. The LinkedIn verifier sentence links `https://github.com/asymmsystems/jira-governance-code-cli`. |
| L-37 | `:66` | Fixed. "Verifier repo" links the repository. It returns HTTP 200 and is public under Apache-2.0. |

## 3. Considered, no finding

- `:94` says "edited a covered field, comment or attachment". An added comment or work log also blocks. The sentence does not say otherwise, and the next sentence limits what passes to uncovered fields.
- `:89` does not mention that comments and work logs the app cannot read are not covered (the listing's Content Snapshot row). Earlier reviews accepted the same approved wording without this limit, and the posts link the documentation.
- `:33`, `:38`, `:119` and `:238` still link `.../user-guide/open-verifier.html`. Each one names it as the verifier's documentation or the "Offline Verifier" page, not as the repository, so that is correct.

## 4. Gate

| Check | Result |
|---|---|
| Changed files | `docs/launch/distribution-kit.md` only |
| `apps/`, `packages/`, `tools/`, `.github/` | Identical to `bda60e4`, where all four app suites passed |
| Tests that read the changed file | None |
| Em or en dashes, or an ellipsis character, in added lines | None |
