# FSRT canary exact match merge review

- Date: 2026-11-07. Reviewer: independent merge review session.
- Branch: `feature/fsrt-canary-exact-match` at `1afce7d` (one commit), cut from master `fd75917`. Master had not moved, so the merge result has the same tree as `1afce7d`.
- Purpose: fix L-56 of `fsrt-gate-empty-scan-merge-review.md`. In `tools/ci/fsrt_gate.py` the canary now uses `re.compile(r"through " + re.escape("handler.readIssue") + r" in ")` instead of a substring test.
- Cases and outputs, not committed: `/home/fahimfarookme/.cache/jira-suite-merge-review/fsrt-canary-exact-match/`.

## 1. Verdict

**Merge.** L-56 is fixed. No finding.

## 2. Tests (`fsrt_gate.py --canary fsrt-canary`, FSRT at `6c821bd`)

| Case | Exit |
|---|---|
| Real scan of `tools/ci/fsrt-canary`. Description: `Authorization bypass detected through handler.readIssue in "tools/ci/fsrt-canary/src/index.js".` | 0 |
| Real scan with the resolver renamed `readIssueAll` (`... through handler.readIssueAll in ...`) | 1 |
| Crafted `through handler.readIssueAll in` | 1 |
| Crafted bare `handler.readIssue` (no `through ... in`) | 1 |
| Crafted `through handlerXreadIssue in` (the dot is escaped) | 1 |
| Crafted `through handler.readIssue in` | 0 |

The real FSRT description has the form `through <entry> in "<file>"`, so the pattern matches FSRT's output.

## 3. Gate

| Check | Result |
|---|---|
| Changed files | `tools/ci/fsrt_gate.py` only |
| FSRT workflow | run 42279462845 on `1afce7d`: success (build, canary, four apps). The run on master after the merge is recorded in the coordinator report. |
