# CascadePlan: Marketplace readiness review, November 2026

- **Review commit:** `db080096007208d2cad97f79c620d49964aa05c9` (`master`, 2026-11-05).
- **Brief:** `review-prompt.md` (the owner's prompt for the review).
- **Verdict:** Not ready. The blockers are BL-1 to BL-9 in the report.

## Current documents

| File | Content |
|---|---|
| `report-v2.md` | The review report (11 sections). |
| `fix-plan-v4.md` | The recommended fix for every problem, with the owner's decisions so far. |
| `test-log.md` | Every command the review ran, with its result. |
| `frontend-review.md` | The line-by-line frontend review (H1 to H9, M1 to M9). |
| `marketplace-research.md` | Atlassian Marketplace requirements, with source URLs (fetched 2026-11-05). |
| `reparent-research.md` | Jira's rules for parent changes and issue type conversion, with source URLs (fetched 2026-11-05). |
| `independent-review/fixplan-review.md` | The independent review of fix plan v1, its test log and its BL-8 recipe trial (`bl8/`). |

Frozen versions, kept as the record: `report.md`, `fix-plan.md`, `fix-plan-v2.md`, `fix-plan-v3.md`.

The frozen files were written before they moved into this repository. Their paths under
`/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/cascadeplan-marketplace-review/` map as follows:

| Old path | Repository path |
|---|---|
| `checkout/` | the repository root |
| `review-tests/review-findings.test.ts`, `checkout/apps/cascadeplan/test/review/*.test.ts` | `apps/cascadeplan/test/review/` |
| `harness/` | `apps/cascadeplan/test/e2e/` (build the page with `build_site.py`) |
| `harness/results-review/*.png` | `evidence/screenshots/harness/` |
| `live/*.py` | `apps/cascadeplan/test/live/` |
| `live/shots/*.png`, `live/*.json` | `evidence/screenshots/live/`, `evidence/live/` |
| `logs/` | `evidence/logs/` (text logs under 100 KB; the large bundle copies are not kept) |
| `~/Documents/projects/jira-governance/.tmp/cache/cascadeplan-fixplan-review/` | `independent-review/` |
| `.../checkout/architecture/decision/adr-00003-*.org` | `architecture/decision/` |

## Tests from the review

`apps/cascadeplan/test/review/` holds three test files:
- `review-findings.test.ts`: R-01 to R-31;
- `fixplan-gaps.test.ts`: FX-01 to FX-05 (from the independent review);
- `parent-move.test.ts`: PM-00 to PM-04.

A test named "FINDING" or "GAP" passes while its defect is present. When a fix lands, its test
fails. The fix then rewrites it as a regression test with the same number. The release gate
(fix plan section 10) fails while any test name still contains "FINDING" or "GAP".

## Decision records

Owner decisions from this review are recorded as ADRs in `architecture/decision/`, starting at
ADR-003. `fix-plan-v4.md` section 2 lists every decision and its state.

Paths updated 2026-11-07 for the repository move.
