# FourRealities permission checks merge review

- Date: 2026-11-06. Reviewer: independent merge review session.
- Branch: `feature/fourrealities-permission-checks` at `f165d73` (one commit), cut from master `6c19fa4`. Merged onto master `1ed5136`, with one reviewer commit on top (`491587a`, questionnaire evidence only).
- Purpose: make question 3 of the Forge app security questionnaire true for the FourRealities project dashboard:
  - a Browse projects check first;
  - counts, rows, summary and coverage from the viewer's own search;
  - the trend only for a viewer who can browse every issue it counts;
  - Confluence only as the viewer.
- Read: the full source diff; `src/accessor/jira-search.ts` (`searchProjectIssues`, `visibleIssueIds`); `hasAnyPermission` (`src/accessor/default-forge-jira-issue-accessor.ts`); the dashboard resolvers and `compose` (`src/index.ts`); `test/manager/viewer-permissions.test.ts`; `docs/marketplace/submission/fourrealities-security-questionnaires.md`; and the new progress log section.
- Gate output and mutation script (not committed): `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/fourrealities-permission-checks/`.
- **No live smoke test.** The fixing session deployed 5.3.0 to development, but the saved Jira session had expired (`/rest/api/3/myself` answered 401), so the dashboard was not opened. I did not run one either. Owner action: open the PAY dashboard on the development app once.
- Nothing deployed by this review.

## 1. Verdict

**Merge.**
- Each of the four points holds in the code and is pinned by a test.
- All 16 mutations of the guards are caught.
- The gate passes on the branch, and the tests pass on the merge result.

The behaviour change is accepted by the suite owner, as relayed by the coordinator: no trend for projects over 2,000 issues, and every trend restarts once. One Low finding stays open (section 5).

## 2. The four points

| Point | Code | Result |
|---|---|---|
| Browse check first | `view` (`default-snapshot-manager.ts`) calls `viewerJira.hasAnyPermission(projectKey, ['BROWSE_PROJECTS'])` (`GET /rest/api/3/mypermissions?projectKey=&permissions=BROWSE_PROJECTS`, as the user) before `registerProject`, the snapshot read, the settings read or a build as the app. A non-200 answer or a thrown call gives `BROWSE_CHECK_FAILED`; no grant gives `FORBIDDEN`. The two resolvers (`getProjectDashboard`, `refreshProjectSnapshot`) check only the licence before `view`, and `compose` reads nothing. | Holds |
| Counts from the viewer's search | Rows are the stored rows filtered to `visibleIssueIds` (as the user, so issue security applies). `summary` is `metrics.summarize(rows)`. Coverage is `shown: rows.length`, and `totalKnown` is `rows.length`, or `null` for a capped read. `meta` (project-wide counts) is no longer returned. The other fields hold no counts of hidden issues: assignee names (read as the viewer), the site's list of checks in use, warnings. | Holds |
| Trend only for a viewer who sees every counted issue | `seesTrend = trendIds && every trend id in visible.ids`; the viewer search is asked for the trend ids too. Points are recorded only for an uncapped read. A timed-out read is always capped (`timedOut = capped && seen < ISSUE_CAP`, `jira-search.ts:65`). `continuesTrend` restarts the trend when a stored id is missing from the new read. So each point's issue set contains the one before it, and the newest point's ids (stored as `trend-ids`) cover every point. A trend stored before 2.1 (no ids) is shown to nobody and restarts at the next build. If the viewer search stops early or times out, the trend is withheld (fail closed). | Holds |
| Confluence only as the viewer | `src/` has one `requestConfluence` call, `api.asUser().requestConfluence` (`default-forge-confluence-search-accessor.ts:52`). The constructor has no app mode, and `compose` has no app Confluence accessor. The build no longer checks pages. The view checks the pages of the rows the viewer is shown, and verifies only what the viewer's search returns. A test fails if any source file reads Confluence as the app. | Holds |

## 3. Mutations (each applied alone; full jest run)

| Mutation | Tests failing |
|---|---|
| No Browse check / ignore a denial / fail open on an error / check after `registerProject` / check asked as the app | 7 / 1 / 3 / 4 / 39 |
| Summary from all stored rows / coverage shown from the project read / coverage total from the project count | 2 / 1 / 4 |
| Trend shown without the per-issue check / legacy trend shown / viewer search asked only for the snapshot rows | 2 / 1 / 1 |
| Trend never restarts / a capped read records a trend point | 3 / 2 |
| Confluence asked as the app / page verified without the viewer check / page check on all stored rows | 3 / 4 / 1 |

All 16 caught.

## 4. Questionnaire

The answers match the code:
- Q3, with the dashboard, the exception decision and the scheduled jobs as section 2.1 lists them.
- Q6: only `requestJira` and `requestConfluence`.
- Q7: scopes unchanged. `forge lint -e production` reports no approval, so this is a minor version, as stated.
- Q8: four log lines, all in `src/index.ts`.
- Q13: no `process.env` in `src/`.

Reviewer commit `491587a` fixes two dated points, as for DefinitionGuard:
- question 10 now cites Apps CI run 42252210748 on `f165d73` (success) and my local audit (0 critical, 0 high, 7 moderate), instead of run 42242271357 "(no app change since)";
- question 16 no longer says the vendor assessment gives 24 hours.

Question 13 cites no `git log -S` search, so L-39 does not apply.

## 5. Findings

### Critical, High, Medium

None.

### Low

- **L-51. The personal data job's failure line writes the error's message** (`src/index.ts:187`). This is the same point as L-49 for DefinitionGuard. The questionnaire states it (question 8). Its "no account id" rests on what Forge storage and the personal data reporting API put in their errors.

### Considered, no finding

- `hasAnyPermission` asks at project level. With an issue security scheme, a viewer can hold Browse projects and still not see some issues. The per-issue filter by the viewer's own search covers that, which is why the counts use it.
- The trend id list (at most 2,000 ids) is one KVS value of a few tens of KiB, well under the Forge value limit.

## 6. Gate

| Check | Result |
|---|---|
| `npm ci` | exit 0 |
| `npx tsc --noEmit` | 0 errors |
| `npm test` (jest with coverage), branch `f165d73` | 47 suites, 570 tests pass; statements 99.37%, branches 96.62%, functions 99.2%, lines 99.75% |
| `npm test` on the merge result | 47 suites, 570 tests pass. `apps/fourrealities` equals the branch, but some tests read published key files and the listing outside it. |
| `npm run build` | exit 0 |
| `npm audit --omit=dev --audit-level=high` | exit 0 (7 moderate) |
| `forge lint`, `forge lint -e production` | No issues found (no scope change, minor version) |
| Apps CI | run 42252210748 on `f165d73`: success |
| Live smoke test | not run (expired Jira session) |

The merge had one conflict, in `docs/marketplace/submission/fourrealities-security-questionnaires.md` (both sides added it). It was resolved with this branch's version, as instructed.
