# Regulated migration page, DefinitionGuard row, merge review

- Date: 2026-11-08. Reviewer: independent merge review session.
- Repository: `asymmsystems/asymm-corporate-code-pfw` (the website).
- Branch: `feature/regulated-page-dg-wording` at `6c5f3f6` (one commit, one line), cut from `develop` `0df0c1e`. Merged into `develop` as `9a90c44`. `main` and the tags are not touched, and nothing is deployed.
- Change: `src/main/jbake/content/product/jira-governance/regulated-migration.html`, line 102, the "SOC 2 CC8.1: testing evidence" row. This fixes L-66 (`regulated-migration-site-merge-review.md`).

## 1. Verdict

**Merge.** The row now states both conditions, and each matches the DefinitionGuard listing and the code. No finding.

## 2. Claims

| Claim on the page | Listing (`docs/marketplace/definitionguard-listing-v2.md`) | Code (master `fbc843e`) | Result |
|---|---|---|---|
| Evidence (a link or a note) is needed only on items an admin marks "Evidence required" | "Evidence on Items" row: items marked "Evidence required" can only be ticked with a link, a note, or both | `criterionCountsAsDone` in `apps/definitionguard/src/domain/gate-rule.ts` asks for evidence only when `evidenceRequired` is set. Templates are saved by `saveTemplate`, which checks `ADMINISTER_PROJECTS` (`src/settings/settings-resolvers.ts`), so the admin is a project admin | Match |
| The move into Done is blocked only after a Jira admin adds the validator | "How the gate works": a Jira admin adds the validator to each transition, and the app cannot add it | `jira:workflowValidator` `definitionguard-workflow-validator` in `apps/definitionguard/manifest.yml` | Match |
| An issue with an open mandatory item cannot move into Done | "Move-to-Done Gate": blocks while a mandatory item is open and not waived | `evaluateGate`: a mandatory item that is open, or ticked without required evidence, blocks; a waived item does not | Match. "Open" here means not done and not waived, as the listing uses it |
| It checks the link format, not the content | Same sentence | `src/domain/evidence.ts`: `^https?://\S+$` | Match |

The row leaves out two listing details: exempt statuses are let through, and the gate is off when the licence is not active. A one-row summary that names the conditions does not need them. The listing and the user guide state both.

## 3. Gate

| Check | Result |
|---|---|
| `JAVA_HOME=/opt/eliya ./mvnw -o clean process-resources` on the merge result | exit 0 |
| Built `target/site/product/jira-governance/regulated-migration.html` | holds the new row text |
| Changed files | the one page, one line |
| Em or en dashes in added lines | None |
