# CascadePlan CSV injection merge review

- Date: 2026-11-06. Reviewer: independent merge review session.
- Branch: `feature/cascadeplan-csv-injection` at `0627abe` (one commit), cut from master `a5e834a`. Master had not moved, so the merge result has the same tree as `0627abe`.
- Purpose: fix pentest finding ASYMM-SEC-04 (CSV formula injection, CWE-1236) in the baseline export. The finding is in `docs/security/pentest-report-2026-11-06.md`.
- Read:
  - `src/domain/csv.ts` (new);
  - the `baselineCsv` change in `src/domain/baseline.ts`;
  - `baselineItems` (how each cell's value is made);
  - `exportBaseline` (`src/server/baselines.ts`);
  - the export button (`src/frontend/baseline-panel.ts`);
  - `test/csv-injection.test.ts` and the progress log entry.
- Output and scripts (not committed): `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/cascadeplan-csv-injection/` (`gate-branch.txt`, `old-code.txt`, `payloads.txt`).
- No live check: no exported file was opened in Excel, LibreOffice Calc or Google Sheets. The fixing session says the same.
- Nothing deployed by this review. CascadePlan production is 2.0.0 (`c8be4c9`). This branch changes no scope (`forge lint -e production`: no approval), so its production deploy is a minor version.

## 1. Verdict

**Merge.**
- The baseline export is the only CSV that CascadePlan produces, and every cell of it now goes through `csvCell`.
- The new tests fail on the old code for a real reason.
- My own payloads give the expected cells.
- The gate passes.

No finding.

## 2. Only CSV path

- `git grep -i "csv|text/csv|createObjectURL|download="` over `apps/cascadeplan/src` and `static` finds one producer and one consumer:
  - `baselineCsv` (`src/domain/baseline.ts`) builds the file, and `exportBaseline` (`src/server/baselines.ts:173`) returns it;
  - `baseline-panel.ts` downloads it as `text/csv`, or shows it to copy.
- The only text that `exportBaseline` adds is its own line: "# <n> item(s) of issues you cannot browse are left out; the SHA-256 covers the whole baseline." It holds a count and fixed text.
- The `join(', ')` hits in `legacy-planner.js` and `write-permissions.ts` build UI messages, not files.
- No CSV in LedgerSeal, DefinitionGuard or FourRealities `src/`.

## 3. The values in the cells

| Column | Source (`baselineItems`) | Treatment |
|---|---|---|
| `issue_id`, `issue_key` | `String(t.id)`, `t.key` | Text: neutralised and quoted |
| `estimate_hours` | `round1(t.effortHours)`, only when `typeof === 'number'` and above 0 | Number: written as is |
| `start`, `end` | the first 10 characters of the plan dates | Text: neutralised |
| `done` | `yes` or `no` | Text |
| Comment line | `# <name>`, `frozen <ISO time>`, `SHA-256 <hex>`, joined by `, ` | The name is user text, but always after `# `, so its cell never starts a formula. The cell is quoted when the name holds a comma, a quote or a line break. |

## 4. Old code fails for a real reason

I put back `src/domain/baseline.ts` from `a5e834a` and ran `test/csv-injection.test.ts`. 5 of the 6 tests failed:
- every test of `baselineCsv`;
- the end-to-end `exportBaseline` test.

The old code wrote `=HYPERLINK(...)`, `+1+1`, `-2+3` and `@SUM(...)` cells unchanged. A spreadsheet runs such a cell as a formula, quoted or not. The one test that passed is the `csvCell` unit test, which tests only the new file.

## 5. My own payloads (temporary test, removed)

23 of 23 gave the expected cell:
- `=1+1`, `+cmd`, `-2`, `@SUM(A1)`, `\t=1`, `\r=1`, `=HYPERLINK("http://x","y")` and the DDE form `=cmd|' /C calc'!A0` all get a leading `'`, with RFC 4180 quoting where needed.
- `a,b`, `"q"` and `x\ny` are quoted correctly.
- The numbers `-3.5` and `0` stay numeric.
- `null` and `undefined` give an empty cell.
- A whole baseline with a hostile name, id, key and dates gives no row whose first cell starts a formula.

Considered, no finding:
- A cell that starts with a space or a line feed before `=` (` =1+1`, `\n=1+1`) is not prefixed. Neither is a full-width `＝`. OWASP's list does not include these. In this export, user text reaches a cell start only through the issue key and id (Jira formats) and the dates; the baseline name is always behind `# `.

## 6. Gate

| Check | Branch `0627abe` (equals the merge result) |
|---|---|
| `npm ci` (shared package, app, `tools`) | exit 0 |
| `npx tsc --noEmit` | 0 errors |
| `npm test` (jest with coverage) | 85 suites, 983 tests pass; statements 96.89%, branches 90.91%, functions 94.48%, lines 98.54% |
| `npm run build`, then compare the UI bundle | exit 0; `static/frontend/build` unchanged, as CI requires |
| `npm audit --omit=dev --audit-level=high` | exit 0 (7 moderate, ASYMM-SEC-07) |
| `forge lint`, `forge lint -e production` | No issues found (no scope change, minor version) |
| Apps CI | run 42256965331 on `0627abe`: success |
| Live check in a spreadsheet | not run |
