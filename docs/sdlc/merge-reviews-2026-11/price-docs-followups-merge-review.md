# Price docs followups merge review

- Date: 2026-11-06. Reviewer: independent merge review session.
- Branch: `feature/price-docs-followups` at `c09ec08` (one commit), cut from master `1709054`.
- Purpose: fix L-26, L-27 and L-28 of `docs/sdlc/merge-reviews-2026-11/listing-pricing-and-highlights-merge-review.md`.
- Read: the full diff (4 files, 4 insertions, 8 deletions), section 4 "Price" of `docs/sdlc/suite-readiness-review-2026-11/README.md`, and the changed parts of `docs/launch/manual-actions-checklist.md`, `docs/launch/first-sale-playbook.md` and `docs/marketplace/submission/developer-console-checklist.md`.
- No live check. I did not open the developer console.

## 1. Verdict

**Merge.** L-26 and L-27 are fixed. L-28 now names a source, which is the coordinator's direct observation (see section 2). Every price on the branch matches README section 4. The grep of `docs/` and `site/` found one more single-price line, in a draft post (L-29, Low). It does not block the merge.

## 2. Findings from the previous review

| ID | Result |
|---|---|
| L-26 | Fixed. `docs/launch/manual-actions-checklist.md:32` and `docs/launch/first-sale-playbook.md:16` give each app its own prices. The checklist also says that the 251 to 1,000 price is repeated in every larger tier. |
| L-27 | Fixed. README `:62` says option A was chosen on 2026-11-06. |
| L-28 | Fixed, but the source is not one I could check. README `:62` and console checklist step 2.3 name the last tier of the Marketplace pricing form, 90,001 to 100,000 users. The coordinator saw that form in the developer console on 2026-11-06 and reported it to me. I did not have console access. The console checklist names the tier, but not when it was seen. |

## 3. Numbers against README section 4

| App | README (11 to 100 / 101 to 250 / 251 to 1,000) | Manual actions checklist `:32` | First sale playbook `:16` | Console checklist step 2.3 |
|---|---|---|---|---|
| CascadePlan | $1.50 / $1.20 / $0.90 | Match | Match | Match |
| FourRealities | $1.40 / $1.10 / $0.80 | Match | Match | Match |
| DefinitionGuard | $0.95 / $0.75 / $0.24 | Match | Match | Match |
| LedgerSeal | $0.95 / $0.75 / $0.24 | Match | Match | Match |

The free tier (1 to 10 users) and "annual is 10 times monthly" are unchanged and agree with the README.

## 4. Search for other one-price-for-all text

- I searched `docs/` and `site/` for `$1.50`, `$1.20`, `$0.90`, "custom", "1,001", "above 1,000", "every app" and "same price". I left out `docs/marketplace/master-suite-launch-prompt.md` (a prompt file, accepted as not fixed).
- `site/`: no single-price text. `site/faq.md` has the per-app table.
- The listings, the console checklist and both launch checklists agree.
- The `docs/sdlc/` hits are progress logs, research briefs, readiness notes and fix plans. They record what was true when they were written. They are not instructions, so I did not change them. README `:73` marks the old plan as replaced.
- One more hit, L-29 below.

## 5. New findings

### Critical, High, Medium

None.

### Low

- **L-29. The draft LedgerSeal post states the CascadePlan price.** `docs/launch/distribution-kit.md:35` says "Pricing: Free up to 10 users, then $1.50/user/month on the Marketplace." The post is about LedgerSeal, which costs $0.95, $0.75 and $0.24 (README section 4). If it is posted as written, it states a price 58% above the real one. This branch did not cause it. Suggested text: "Pricing: Free up to 10 users, then $0.95/user/month (11 to 100 users), $0.75 (101 to 250) and $0.24 above 250, on the Marketplace."

## 6. Gate

| Check | Result |
|---|---|
| Changed files | 4 files, all under `docs/` |
| Files under `apps/`, `packages/`, `.github/` | Identical to `1709054`, where all four app suites passed (LedgerSeal 547, FourRealities 549, DefinitionGuard 421, CascadePlan 977 tests). |
| Tests that read the changed files | None. I searched `apps/`, `packages/` and `.github/` for the four file names. The only hit is a screenshot name in `apps/cascadeplan/test/live/names2.py`. |
| Suites run again | No. No input of any test changed. |
| Em or en dashes in the added lines | None |
