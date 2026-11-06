# Distribution kit claims merge review

- Date: 2026-11-06. Reviewer: independent merge review session.
- Branch: `feature/distribution-kit-claims` at `8446387` (one commit, 13 lines), cut from master `52edbc6`.
- Purpose: fix L-30, L-32 and L-31 of `docs/sdlc/merge-reviews-2026-11/distribution-kit-ledgerseal-post-merge-review.md` in every post of `docs/launch/distribution-kit.md`. The owner approved these kinds of fix.
- Scope: all of `docs/launch/distribution-kit.md`: section 1 (Hacker News), section 2 (Reddit), section 3 (LinkedIn), section 4 (Atlassian Community) and section 5 (LinkedIn outreach templates). I checked each LedgerSeal claim against `docs/marketplace/ledgerseal-listing.md`, `tools/verifier/README.md` and, where a claim is about behaviour, the code. I did not check claims about DefinitionGuard or claims about Jira itself.
- Rule from the coordinator: where a line makes the same kind of claim that the owner already approved fixing, fix the wording. Report anything else as a finding.

## 1. Verdict

**Merge**, with one reviewer commit on top (`253545d`, section 2). The 13 lines of `8446387` are correct. Four more lines made claims of an approved kind, and I fixed them with the approved wording. Six other claims are findings (section 4). They need the owner's wording, so I did not edit them. None of them is Critical or High, and this branch makes none of them worse.

## 2. Reviewer commit `253545d` (same kinds as the approved fixes)

| Line | Before | After | Approved kind |
|---|---|---|---|
| `:120` r/compliance | "..., meaning you don't have to rely on an app vendor during an audit." | "..., so auditors can check evidence files themselves, offline." | "verify independently" becomes "check themselves, offline" |
| `:182` Community | "the transition blocks and displays the exact difference." | "the transition is blocked and the panel shows what changed." | the r/devops fix of "shows the exact diff" (`:61`) |
| `:221` outreach B | "blocks the release transition if anything changed post-approval." | "... if a covered field, comment or attachment changed after approval." | "single byte/character changed" becomes covered fields, comments and attachments |
| `:237` outreach C | "tamper-evident approval seals and independent verification" | "tamper-evident approval seals and offline evidence checks" | "verify independently" |

I committed this on the branch in my clone and merged that. I did not push it to `origin/feature/distribution-kit-claims`, so the coordinator's branch is unchanged.

## 3. The 13 lines of `8446387`

All correct against the listing and the verifier README:
- Blocking now names covered fields, comments and attachments (`:31`, `:61`, `:149`).
- "Until another approver approves the change" (`:31`, `:149`) matches the Separation of Duties row in the listing.
- "The message names the changed fields" (`:31`) matches `changedItemsMessage` in `apps/ledgerseal/src/validator/workflow-validator.ts`.
- "Atlassian Forge storage" (`:60`, `:122`, `:150`, `:223`) and "runs entirely on Atlassian Forge" (`:32`, `:205`) match the listing's Data Privacy section.
- "Node.js standard library" (`:33`, `:63`) and "check ... themselves, offline" (`:33`, `:63`, `:152`, `:239`) match the README.

## 4. Findings

### Critical, High

None.

### Medium

- **M-13. The r/jira post says adding a comment does not affect the seal. It does.** `:94`: "If they only added a comment or updated an uncovered field, it transitions smoothly." Comments are covered:
  - The listing's Content Snapshot row covers comments.
  - `apps/ledgerseal/src/domain/tamper-detector.ts:229` reports added, edited and removed comments.
  - `apps/ledgerseal/test/tamper-detector.test.ts:165` is "detects comment changes as tamper".
  - Listing screenshot 02 shows a new comment as a changed item.

  A Jira admin who reads this post and then tries the app sees the opposite on the first comment. Possible owner wording: "If someone edited a covered field, comment or attachment, the transition blocks and the panel shows what changed. If they only updated an uncovered field, it transitions smoothly." `:89` also lists the covered items without comments.

### Low

- **L-33. Point 4 now says "no external servers" twice** (`:32`): "zero external servers, runs entirely on Atlassian Forge, with no external servers." This commit introduced it. Possible fix: delete ", with no external servers".
- **L-34. The r/jira post says the app is "live on the Atlassian Marketplace"** (`:96`), and two posts link `https://marketplace.atlassian.com/apps/ledgerseal` (`:99`, `:185`). On 2026-11-06, a Marketplace search for "ledgerseal" (`/rest/2/addons?text=ledgerseal`) returns no LedgerSeal app. The URL returns HTTP 200, but so does a made-up path, and Marketplace app URLs usually carry a numeric id. Post these only after the listing is live, and copy the real URL from it.
- **L-35. The r/compliance title says "Eliminating 'post-approval change risk'"** (`:108`). The listing says LedgerSeal detects changes to covered items and blocks the release transition. Uncovered fields, and comments or work logs the app cannot read, stay outside it. Possible owner wording: "Catching post-approval changes in Jira for SOC 2 and GxP audits".
- **L-36. The LinkedIn post promises the verifier but links the LedgerSeal page** (`:152` to `:153`). "We also open-sourced the offline verifier ...:" is followed by `.../user-guide/ledgerseal.html`. The other posts link `.../user-guide/open-verifier.html`.
- **L-37. The r/devops post labels a documentation page as the "Verifier repo"** (`:66`). The link is `.../user-guide/open-verifier.html`. The repository is `https://github.com/asymmsystems/ledgerseal-verifier` (public, Apache-2.0).

### Considered, no finding

- `:203` "hard-blocks the Done transition if any covered field was modified": limited to covered fields, so it is not wider than the listing.
- `:118` "Gated workflow transitions reject release if the hash diverges": matches the validator.
- `:237` "addressing FDA 21 CFR Part 11 (§ 11.10e audit trails)": the listing says it "supports the audit trail (21 CFR 11.10(e))".
- Links checked on 2026-11-06 (HTTP 200): `.../compliance.html` (redirects to `.../compliance`), and the four links from the previous review.
- Not checked: claims about Jira itself (for example what `jira.issue.editable = false` blocks), and the DefinitionGuard line `:119`.

## 5. Gate

| Check | Result |
|---|---|
| Changed files | `docs/launch/distribution-kit.md` only (`8446387` and `253545d`) |
| `apps/`, `packages/`, `tools/`, `.github/` | Identical to `52edbc6`, where all four app suites passed |
| Tests that read the changed file | None |
| Em or en dashes in added lines | None |
