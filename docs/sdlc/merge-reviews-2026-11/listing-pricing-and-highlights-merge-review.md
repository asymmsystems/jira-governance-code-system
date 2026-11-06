# Listing pricing and highlights merge review

- Date: 2026-11-06. Reviewer: independent merge review session.
- Branch: `feature/listing-pricing-and-highlights` at `a043f83`, rebased on master `fc8ca40`. It has two commits: `166f473` (the round 1 change, re-applied) and `a043f83` (the fixes).
- Round 1 reviewed `1830d92` and said "do not merge" (H-3). That report was not committed. It is at `/home/fahimfarookme/.cache/jira-suite-merge-review/listing-pricing-and-highlights/listing-pricing-and-highlights-merge-review.md`.
- Read: the full diff from `fc8ca40` (12 files), section 4 "Price" of `docs/sdlc/suite-readiness-review-2026-11/README.md`, step 2.3 of `docs/marketplace/submission/developer-console-checklist.md`, `site/faq.md`, `docs/marketplace/suite-launch-and-first-sale-playbook.md`, the pricing parts of `docs/launch/manual-actions-checklist.md` and `docs/launch/first-sale-playbook.md`, and the listing tests of three apps.
- Gate output (not committed): `/home/fahimfarookme/.cache/jira-suite-merge-review/listing-pricing-and-highlights/gate-merge-round2.txt`.
- No live check. I did not open the Marketplace drafts or the developer console.

## 1. Verdict

**Merge.** H-3 and M-12 are fixed. The full test suites of all four apps pass on the merge result. Three Low findings stay open, and none of them changes a listing.

## 2. Round 1 findings

| ID | Round 1 | Round 2 |
|---|---|---|
| H-3 | Three listing tests expected "Custom" above 1,000 users | Fixed. The DefinitionGuard, FourRealities and LedgerSeal assertions expect the 251 to 1,000 row values, and the LedgerSeal test title no longer says "custom". All three suites pass. |
| M-12 | Decision not recorded; console checklist said "Custom enterprise tier" | Fixed. README section 4 (`:62`) records option A and marks the old single-price plan as replaced (`:73`). Console checklist step 2.3 gives prices for each app and the rule above 1,000 users. |
| L-24 | Four documents gave one price for all four apps | Partly fixed. `site/faq.md` (public) and `docs/marketplace/suite-launch-and-first-sale-playbook.md` are fixed. Two documents are still open (L-26). `docs/marketplace/master-suite-launch-prompt.md:160` is a prompt file, so it stays unchanged until the owner approves an edit: accepted, not fixed. |
| L-25 | Highlights did not name their screenshots | Fixed. Each listing names one screenshot per highlight, and all 12 files are in `docs/marketplace/assets/<app>/` on the branch. |

## 3. New findings

### Critical, High, Medium

None.

### Low

- **L-26. Two more single-price lists, one in a document the owner uses at the console.** `docs/launch/manual-actions-checklist.md:31-35` ("Configure user tiers") and `docs/launch/first-sale-playbook.md:16-18` still give $1.50 / $1.20 / $0.90 for every app. Round 1 named both (L-24). The fix changed `docs/marketplace/suite-launch-and-first-sale-playbook.md`, which is a different playbook. Suggested fix: replace both lists with the per-app sentence now used in that playbook.
- **L-27. The recorded decision date is one day ahead.** README section 4 (`:62`) says the owner chose option A "on 2026-11-07". This review ran on 2026-11-06 (local time +05:30). The coordinator should confirm the date with the owner and correct it, because this line is the record that M-12 asked for.
- **L-28. "Up to 100,000 users" is not traced to a source.** README `:62` and console checklist step 2.3 say the price applies "up to 100,000 users". This is probably the top Marketplace tier, but the commit cites no source. I did not check it, because I had no console access.

## 4. Checks

| Check | Result |
|---|---|
| Every tier above 1,000 users at the 251 to 1,000 price | Yes: CascadePlan $0.90 / $9.00, FourRealities $0.80 / $8.00, DefinitionGuard $0.24 / $2.40, LedgerSeal $0.24 / $2.40. Annual is 10 times monthly. |
| Listings, FAQ table, console checklist and README table agree | Yes, for all four apps and all tiers |
| Branch rebased on master | Yes, `fc8ca40` is an ancestor of `a043f83` |
| Em or en dashes in the changed lines | None |

## 5. Gate (merge result of `a043f83` on `fc8ca40`)

Apps CI does not run for this branch in a reliable way, so I ran every suite locally after `npm ci` (shared package `packages/asymm-jira-ui` first).

| App | `npm test` (jest with coverage) | Coverage: statements / branches / functions / lines |
|---|---|---|
| LedgerSeal | 50 suites, 547 tests pass | 98.09 / 94.19 / 97.12 / 98.73 |
| FourRealities | 46 suites, 549 tests pass | 99.39 / 96.55 / 99.18 / 99.79 |
| DefinitionGuard | 33 suites, 421 tests pass | 98.94 / 96.1 / 96.41 / 99.18 |
| CascadePlan | 84 suites, 977 tests pass (no listing test; no file of this app changed) | 96.88 / 90.9 / 94.48 / 98.54 |

The test counts are one more than in round 1 for FourRealities (548 + 1) and DefinitionGuard (420 + 1), and the same total for LedgerSeal (546 + 1 = 547): the test that failed in round 1 now passes in each.

## 6. Housekeeping

The `/home` disk was full during round 1. I deleted the `node_modules` and `coverage` folders after each suite ran, in my own clone only.
