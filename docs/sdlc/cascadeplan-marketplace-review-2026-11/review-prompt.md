# CascadePlan: Full Review and Marketplace Readiness Verdict

You are an independent senior reviewer. Your job is to review the CascadePlan Forge app in full and
to decide, with evidence, whether it is ready to publish on the Atlassian Marketplace. You must test
what you claim. You must not change the product. You report; the owner (Fahim Farook) decides.

Write every file you produce in plain English with ASCII hyphens only. Do not use em dashes or en dashes.

---

## 1. What you are reviewing

- Repository: `https://github.com/asymmsystems/jira-governance-code-system`, branch `master`.
- Review commit: the `master` HEAD at the time you start. Record the SHA in your report. At the time of
  writing it is `db08009`.
- App folder: `apps/cascadeplan`.
- Forge app id: `ari:cloud:ecosystem::app/cac8499e-e92e-4ba6-95cc-af398b1be791`.
- Test site: `asymmsystems.atlassian.net`, project `DEMO`.

### 1.1 Work on your own checkout

Do not work in any existing worktree. Other sessions use them. Make your own clone:

```
git clone https://github.com/asymmsystems/jira-governance-code-system.git \
  /home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/cascadeplan-marketplace-review/checkout
cd /home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/cascadeplan-marketplace-review/checkout
git checkout <review SHA>
```

Put all your output in `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/cascadeplan-marketplace-review/`.
Do not write anywhere else. Do not commit, push, merge, or open pull requests.

### 1.2 Tool rules

- The shell may run in a VS Code Flatpak sandbox. If `node` or `npm` is missing, run host tools
  through `flatpak-spawn --host bash -lc '<command>'`. The host `/tmp` is not the sandbox `/tmp`;
  keep files under the output folder above.
- Install dependencies only inside your own checkout: `apps/cascadeplan` and `apps/cascadeplan/tools`
  (the esbuild tool). Never create a `node_modules` folder anywhere else, and never install at the
  repository root.
- Do not send the owner's email address or any credential to any external API or website.
- The live-testing guide `docs/design/in-jira-automated-testing-guide.md` describes how to sign in to
  the test site. Never copy the session values in it into your report.

### 1.3 What you may and may not do on the live site

- You may run `forge deploy` to the **development** environment and test in project `DEMO`.
- You may create, edit and delete issues **only in project `DEMO`**. List every issue you created or
  changed in your report, so the owner can clean up.
- You must **not** deploy to the `staging` or `production` environment, change the Marketplace
  listing, submit the app, or change site or app settings outside `DEMO`.
- If a check needs something you are not allowed to do, write down the exact step and the reason,
  and mark the check "Not run (needs owner)". Do not mark it as passed.

---

## 2. Read these first, in full

Read each file completely before you judge it. Do not skim. Where a document and the code disagree,
the code is what ships; report the difference.

1. `docs/spec/cascadeplan-spec.md`: the product specification.
2. `docs/sdlc/cascadeplan-usp-ux-research-2026-11/`, every file: `research-brief.md`, `ux-spec.md`,
   `backlog.md` (the B-xx items), `round-log.md`, `silverston-conformance.md`, `handover-gemini.md`.
3. `docs/marketplace/cascadeplan-listing.md`: the public listing text.
4. `docs/marketplace/submission/cascadeplan-submission-notes.md` and
   `docs/marketplace/submission/developer-console-checklist.md`.
5. `site/apps/cascadeplan/*.md`: the public user guide, admin guide, scope-creep audit page and index.
6. `docs/design/asymm-jira-ui-standard.md` and `docs/design/uniform-permission-management-standard.md`.
7. `apps/cascadeplan/manifest.yml`, `package.json`, `tsconfig.json` and `jest.config.js`.
8. All source under `apps/cascadeplan/src/`, and all tests under `apps/cascadeplan/test/`.
9. Git history of the app: `git log --oneline -- apps/cascadeplan` and the recent `fix(planner)` commits.

---

## 3. Decisions to verify

These decisions are recorded in the documents above or in the last commits. For each one, say whether
the code does what the decision says, prove it with a test or a file and line, and say whether the
decision itself is sound. A standard or a competitor is not proof; give the trade-off.

| ID | Decision | Where |
|---|---|---|
| D1 | Every resolver reads and writes only the plan named by `planId`. A write to a deleted plan is refused. A read of an unknown plan falls back to the Main Plan. | `src/index.ts` (`writablePlanId`, `getProjectPlan`); `test/plan-isolation.test.ts` |
| D2 | **Jira is the single source of truth for a task (owner decision, 2026-11-05).** Every field edit (summary, estimate, assignee, status, parent and due date) goes to Jira from whichever plan it was made in. | `updateWbsTask`, `scheduleBacklogTask`, `createInlineTask`, `continueCascade`, `createSubtaskForResource` in `src/index.ts`; commits `9185814`, `db08009` |
| D3 | **One set of dates per task (owner decision, 2026-11-05).** A date change in any plan, a cascade included, writes the Jira due date and copies the same dates to that task in every other plan (`shareTaskDates`, `SHARED_DATE_FIELDS`). Each time a plan loads, a scheduled task ends on its Jira due date, so a change made directly in Jira shows in every plan (`mapLiveIssues`). The start date has no standard Jira field, so the shared start date lives in KVS and moves only when it would fall after the end. Scheduling and unscheduling apply to every plan. Order, columns, milestones and dependency settings stay per plan. Test it in full (Sections 4.3 and 5.3). Known edge cases to judge: (a) if a Jira screen rejects the due date and Jira still holds an old one, the next load shows the old date, so the move appears to undo itself; (b) copying to other plans is not atomic across plans, and a task that fails after 3 tries is only reported; (c) a Jira due date change does not cascade to successors on read; (d) unscheduling leaves the Jira due date in place; (e) the KVS cost of each date write grows with the number of plans; (f) the dependency settings and contributors stay per plan, although the dates they drive are shared. | `src/index.ts`; commit `db08009`; `test/plan-isolation.test.ts` |
| D4 | The open plan is saved per project in the browser (`localStorage` key `cp_active_plan_<cloudId>:<projectKey>`), not in the backend. | `src/ui/plan-view-state.ts`, `src/frontend/legacy-planner.js` |
| D5 | Collapsed parents stay collapsed across renders and hide all descendants. A toggle appears only when a row has child rows in the view. | `src/ui/plan-view-state.ts` |
| D6 | Optimistic concurrency: each KVS record has a `version`; a write with a stale version is refused and the client refreshes. | `src/storage/plan-store.ts` (`putEntry`) |
| D7 | Storage model: one WorkEffort record per issue (Silverston-style), keys `cp:<projectId>:we:<issueId>` and `cp:<projectId>:plan:<planId>:we:<issueId>`. | `src/domain/models.ts`, `silverston-conformance.md` |
| D8 | Writes to Jira happen only after the KVS write succeeds, and each write is reported in the Changes panel with old and new values. Opening, hovering and scrolling write nothing. | B-23, UR-13 in the research documents; `test/no-unrequested-writes.test.ts` |
| D9 | Cascades move at most 25 successors per call; the client calls again until none remain. | `CASCADE_BATCH_LIMIT` |
| D10 | Canvas timeline with an accessible treegrid mirror. | `ux-spec.md` section 5.4 (R1 to R7) |
| D11 | Reads run as the user, writes as the user where possible (permission inheritance). | `test/reads-as-user.test.ts`, the permission standard |
| D12 | Licensing is enforced for paid use. | `manifest.yml` `licensing`, `test/licensing.test.ts` |

Add any other decision you find in the code or documents.

---

## 4. Code review

Review all of `src/`, not only the diff. For every finding give: file and line, what goes wrong,
a concrete scenario (inputs and state, then the wrong result), severity, and how you confirmed it.

### 4.1 Data model and storage

- Map every KVS key the app writes. For each key: owner, shape, who writes it, who reads it, when it
  is deleted. Include plan list `cp:<projectId>:plans`, per-plan settings, baselines, scope-shift
  requests, approvers, and any legacy keys (`scheduleMap:<key>`, `taskOrder:<key>`, `ps:*`).
- Check `toWorkEffortRecord` and `fromWorkEffortRecord` in `src/domain/models.ts`: is every field
  written also read back? Is any field silently dropped? Is the model-1 to model-2 migration
  (`migrateIfNeeded`, `PlanStore.ensureMigrated`) safe to run twice, and safe when it fails halfway?
- Which fields are Jira-owned and must never be stored (`JIRA_OWNED_FIELDS`)? Prove none of them is
  persisted.
- What happens to KVS records when an issue is deleted, moved to another project, or converted to
  another issue type? When a plan is deleted, are all its keys removed?
- Check Forge KVS limits that apply: key length, value size, query page size, and rate limits. Will
  a project with 1,000, 5,000 and 10,000 issues stay inside them? Show your arithmetic.
- Does a cloned plan copy everything it should and nothing it should not?

### 4.2 Correctness

- Scheduling: week computation (`getTimelineWeeks`, `gridFor`, `clampedWeekIndex`), span, allocations,
  dates outside the timeline window, time zones (the site's time zone vs UTC), daylight saving, and
  the change of year.
- Cascade engine (`src/domain/`): finish-to-start and trigger-percent links, cycles, a task that
  depends on its own descendant, a predecessor in the backlog, and a predecessor in another project.
- Parent dates derived from children (B-28), and what happens when a child is unscheduled.
- Hierarchy: epics, stories, tasks, subtasks, team-managed vs company-managed projects, and issues
  whose parent is not in the view.
- Jira sync: due date rejected by the screen (the retry without `duedate`), assignee fallback,
  status transitions (`syncTaskFields`), a transition that does not exist in the workflow, and an
  estimate of 0.
- Undo and redo across plan switches, and after a conflict.
- Observed live on 2026-11-05: right after a one-week drag of DEMO-29, the bar was drawn shorter
  than the saved dates; after a reload it showed the correct dates. Find the cause (the optimistic
  render after a drag, compared with the plan the resolver returns).
- Input validation (`src/validation.ts`): every resolver argument. Try oversized, empty, wrong-type,
  and hostile values (script tags, very long strings, unicode, issue keys from another project).

### 4.3 Concurrency and consistency

Treat this section as high priority. For each case, describe the interleaving, the expected result,
and the actual result. Prove it with a test where you can.

- Two users move the same task in the same plan at the same time.
- Two users move the same task in different plans at the same time (relevant to D3).
- A user edits an issue in Jira while another user moves it in the planner.
- A cascade batch runs while another user moves one of the successors.
- `putEntry` uses read, then version check, then `swap`, then restore on mismatch. Is this atomic
  under Forge KVS semantics? Can the restore overwrite a third writer? Can a lost update happen?
- KVS write succeeds and the Jira write then fails (network, 429, 5xx, permission). Is the state
  reported honestly? Can KVS and Jira stay different with no message to the user?
- Jira write succeeds and the function then times out (Forge invocation time limit). What does the
  user see? Is a retry safe (idempotent)?
- Two browser tabs on different plans; one tab deletes the plan the other has open.
- `batchUpdateTasks` with 50 items: partial failure, retry of items changed by the same batch.
- Rate limiting: many writes in a row from a drag sequence or a large cascade. Does the app handle
  Jira `429` with `Retry-After`?

### 4.4 Security and privacy

- Every resolver: does it check that the caller may see and edit the project and issue it touches?
  Can a user change an issue in a project they cannot edit, through `asApp` calls?
- `requestJira` routes: are all paths built with the `route` template tag? Any string concatenation?
- XSS in the Custom UI: is any Jira text (summary, epic name, user name) inserted as HTML? Check
  `src/frontend/legacy-planner.js` for `innerHTML` and similar. The manifest allows `'unsafe-inline'`
  styles; is that needed, and is it a review risk?
- Scopes: are `read:jira-work`, `write:jira-work`, `read:jira-user` and `storage:app` all needed and
  enough? Is any call made that needs a scope not declared?
- Egress: confirm the app makes no external network calls, as the submission notes claim.
- Personal data: what user data is stored in KVS (account ids, names)? Is it needed? Does the app
  handle the Atlassian personal data reporting (account closure) requirement?
- Licensing: can an unlicensed site use paid features?

### 4.5 Non-functional

- Performance: time to first render and time for one move with 100, 1,000 and 5,000 issues (use the
  local harness for large sizes). Count Jira and KVS calls per user action.
- Forge limits: invocation time, memory, payload size of resolver responses for large projects.
- Accessibility: keyboard-only use (move, resize, link bars), screen reader output of the treegrid,
  focus order, contrast in light and dark themes, 24 px targets. Check against WCAG 2.2 AA.
- Usability: error messages, empty states, the conflict notice, the Changes panel, onboarding.
- Compatibility: current Chrome, Firefox, Safari and Edge; small screens; Jira light and dark theme.
- Reliability: behaviour when Jira is slow or down; no data loss on refresh.
- Maintainability: size and structure of `src/index.ts` and `src/frontend/legacy-planner.js`,
  dead code, duplicated logic, type safety (`any`), test quality (do tests assert behaviour or only
  that code runs?).
- Compliance rules of the repository: every source file has the Asymm Systems copyright header and
  `@author Fahim Farook`; no em or en dashes in authored files.

---

## 5. Testing you must do

Record every command you run and its output summary in `test-log.md`.

### 5.1 Static and unit gate

In `apps/cascadeplan` of your checkout:

```
npm ci
(cd tools && npm ci)
npx tsc --noEmit
npm test -- --coverage
npm run build
```

Expected: zero TypeScript errors, all suites pass, coverage at or above the thresholds in
`jest.config.js`, the build succeeds. Report the exact numbers. Then run `git status` and confirm the
build did not change any tracked file. If `static/frontend/build/app.js` changes, report it: the
committed bundle does not match the source.

### 5.2 Tests you add (in your checkout only)

Write extra tests for the gaps you find, especially concurrency (Section 4.3) and data model
round-trips (Section 4.1). Keep them in your checkout under `test/review/`. Put a copy and the result
in the output folder. Do not commit them.

### 5.3 Local browser test

The previous session built a browser harness at
`/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/cascadeplan-bugfix/harness/` (Forge stubs, a DEMO Jira
fixture whose due dates persist, and `e2e.py`, a Python Playwright script with 30 checks). Read it in
full first. Copy it into your output folder and change the two absolute import paths in `entry.ts`
and `setup.ts` to your checkout. Build the bundle from the harness folder with:

```
<checkout>/apps/cascadeplan/tools/node_modules/.bin/esbuild entry.ts --bundle --format=iife \
  --target=es2020 --outfile=site/app.js '--banner:js=var process={env:{}};' \
  --alias:@forge/api=./stubs/forge-api.ts --alias:@forge/kvs=./stubs/forge-kvs.ts \
  --alias:@forge/resolver=./stubs/forge-resolver.ts --alias:@forge/bridge=./stubs/forge-bridge.ts
```

The harness needs Chrome at `/opt/google/chrome/chrome`. Then:

- Run the 30 existing checks and report the result.
- Add checks for: undo and redo across plans; conflict handling with two browser contexts at once;
  collapse at every level after a plan switch; a cascade started in Plan B, seen in the Main Plan; a
  due date that the fake Jira rejects (simulate the screen error); and three or more plans.
- Take screenshots of each key state and keep them in the output folder.

### 5.4 Live test on the test site

Deploy to the development environment only (`forge deploy -e development`), then install or upgrade
on `asymmsystems.atlassian.net` if needed. In project `DEMO`, test every user-facing feature in the
user guide and the listing, one by one. For each, record: steps, expected, actual, screenshot, and the
Jira issue history that proves what was written. Include the moves, cascades, plans, baselines,
scope-shift approval, resource grid, admin page, and licensing behaviour. Check the Forge logs
(`forge logs -e development`) for errors during your test.

---

## 6. Marketplace readiness

Check each item against Atlassian's current published requirements. Fetch the current pages; do not
rely on memory. Give the source URL for each requirement.

- Forge app requirements for Marketplace listing, including "Runs on Atlassian" eligibility
  (no egress, data residency).
- Security requirements for cloud apps and the security self-assessment.
- Privacy and data handling: privacy policy URL, data processing, personal data reporting API.
- Legal and support: EULA or terms, support URL and contact, documentation URL. Check every URL in the
  listing and the submission notes and report its HTTP status.
- Listing content: is **every claim** in `docs/marketplace/cascadeplan-listing.md`,
  `site/apps/cascadeplan/*.md` and the submission notes true in the code? Examples to check: a
  "cryptographic snapshot" of baselines, a "signed PDF" export, an "immutable audit trail", "zero
  external egress", the scope justifications. A claim the code does not support is a blocker.
- App name: `forge deploy` reports the registered app name as "PlanShift", while the manifest module
  title, listing and documents say "CascadePlan". Check the name the Developer Console and the
  Marketplace will show, and report any mismatch.
- Media: icon (local resource, not a raw URL), screenshots, highlights.
- Licensing and pricing configuration.
- The open items in `developer-console-checklist.md` (for example the "Fix Needed" icon row).

---

## 7. Your report

Write `report.md` in the output folder with these sections:

1. **Verdict:** one of "Ready", "Ready after the listed fixes", or "Not ready". One paragraph why.
2. **Blockers:** items that must be fixed before submission. Each with evidence and a proposed fix.
3. **Decisions table:** D1 to D12 (and any you added): implemented yes or no, evidence, sound yes or
   no, trade-off.
4. **Findings:** all findings ranked by severity (Critical, High, Medium, Low). Each with file and
   line, scenario, evidence, and proposed fix. Mark each as "Confirmed" (you reproduced it) or
   "Plausible" (reasoned, not reproduced).
5. **Data model map:** the key and field table from Section 4.1.
6. **Concurrency matrix:** each case from Section 4.3 with expected and actual results.
7. **Test results:** numbers from 5.1, the tests you added, the browser checks, and the live checks.
8. **Marketplace checklist:** each requirement, source URL, status (Pass, Fail, Not run), evidence.
9. **Listing claims audit:** each public claim, true or false, evidence.
10. **Live site changes:** every `DEMO` issue you created or changed, and every deploy you ran.
11. **Not run:** every check you could not run, and why.

Rules for the report:

- Every claim must have evidence: a file and line, a command and its output, or a screenshot. If you
  are not sure, say so.
- Do not soften a finding because a document says the behaviour was intended. Documented intent is
  not design.
- Do not claim that the app is ready to publish unless every blocker is closed and every Section 6
  item passes. "Ready after the listed fixes" is the most you may say otherwise.
- Do not fix the product. Propose fixes; the owner decides.
