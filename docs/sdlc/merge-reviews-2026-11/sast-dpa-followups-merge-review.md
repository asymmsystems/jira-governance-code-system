# SAST and DPA follow-ups merge review

- Date: 2026-11-08. Reviewer: independent merge review session.
- Branch: `feature/sast-dpa-followups` at `9ace76e` (one commit, 4 files), cut from master `fd52e8b`. Merged after `feature/safe-error-logging`, onto master `322d72f`, without conflict, as `e48f374`. One reviewer follow-up commit on top (section 4).
- Change:
  - `docs/security/sast.md`: the "why not" rows, with sources; a "When it runs" row;
  - `.github/workflows/sast.yml`: a weekly `schedule`;
  - `docs/legal/README.md` and `docs/legal/dpa-template.md`: README item 3 closed, L-64 listed, the Logs row worded as "the questionnaire answers state".
- Pages, not committed: `jira-governance/repository/tmp/review-safe-logging-out/sonar-*.txt`.

## 1. Verdict

**Merge.** L-63 (`ci-sast-merge-review.md`) is fixed with sourced rows. The weekly run is correct. The DPA follow-ups are accurate. After the safe-logging merge, the Logs row now states the fact (section 4). No finding.

## 2. `sast.md`

| Claim | Source, fetched 2026-11-08 | Result |
|---|---|---|
| SonarQube Cloud free plan: private projects up to 50k lines of code | sonarsource.com/plans-and-pricing: "free for your private projects up to 50k LOC" | Match |
| 50k per organization; 5 members; main branch only; "You cannot exceed your LOC limit" | docs.sonarsource.com subscription plans: "Analysis of private projects Up to 50k LOC", "Maximum number of organization members 5", "Only main branch analysis", "You cannot exceed your LOC limit in SonarQube Cloud" | Match |
| The source code is uploaded | sonarsource.com/trust-center: "your scan report containing your source code needs to be pushed to the SonarQube Cloud server" | Match |
| 39,273 scanned lines | counted for `ci-sast-merge-review.md` (39,273) | Match |
| SonarQube Server self-hosted; CodeQL on a private repository needs a paid GitHub Code Security licence | as checked in `ci-sast-merge-review.md` | Match |

## 3. Weekly run

- `schedule: - cron: '17 3 * * 1'` is Mondays 03:17 UTC, as documented.
- Scheduled runs use the default branch (master) and ignore `paths`.
- Permissions are unchanged (`contents: read`).

## 4. DPA and legal README

- **README item 3 (closed).** It records the production deploy times after the permission-check merges, as `dpa-template-merge-review.md` section 3 found them. The Annex II "Access control" `[CONFIRM]` is removed, as that review allowed.
- **README L-64.** It is listed as the second site inconsistency.
- **Reviewer follow-up on master**, as the request asked, after both merges. `feature/safe-error-logging` (`f896fae`) makes every caught error in the four apps log only its name, code and status (`safe-error-logging-merge-review.md`), so the fact now holds:
  - **Annex II, "Logs"** now states it: "Backend log lines hold no account id, name, email, issue text, token or key. A caught error is logged only by its name, code and HTTP status, never its message, stack or the object." The evidence is "questionnaire question 8 for each App; `apps/*/test/log-safety.test.ts`".
  - **README item 9** says it is closed and names the merge, so it no longer tells the lawyer the row is pending.
  - **README L-64** now says the fix is on the site's `develop` branch (merge `0df0c1e`), public when the owner releases `develop`. It used to say "in progress".

## 5. Gate

| Check | Result |
|---|---|
| Changed files | `.github/workflows/sast.yml`, `docs/security/sast.md`, `docs/legal/*`; the follow-up changes `docs/legal/*` only |
| `apps/`, `packages/` | Unchanged |
| Em or en dashes in added lines | None |
