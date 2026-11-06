# FSRT gate empty scan merge review

- Date: 2026-11-07. Reviewer: independent merge review session.
- Branch: `feature/fsrt-gate-empty-scan` at `5238b46`, cut from master `d1e7127`. Merged onto master `0702fde`, without conflict. Two commits:
  - `d32d8b8`: `tools/ci/fsrt_gate.py`, `.github/workflows/fsrt.yml`, and the new `tools/ci/fsrt-canary`;
  - `5238b46`: a paragraph and a run row in `docs/security/fsrt-scan-2026-11-07.md`.
- Purpose: fix L-55 of `ci-fsrt-merge-review.md` (a scan that analysed nothing passed).
- Tests used my own FSRT build of the pinned commit `6c821bd`. Cases and outputs, not committed: `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/fsrt-gate-empty-scan/`.

## 1. Verdict

**Merge.** L-55 is fixed: every failure mode the branch claims fails in practice, permissions stay `contents: read`, and the canary fails when its finding is gone or comes from another resolver. One Low finding: a resolver whose name starts with `readIssue` also satisfies the canary (section 3).

## 2. Failure modes, with real FSRT scans

| Case | Gate exit |
|---|---|
| DefinitionGuard, normal scan with `FORGE_LOG=info,fsrt=debug` (36 files parsed, 7 functions checked) | 0 |
| Manifest without `src/` (0 files parsed; FSRT itself says `errors: false`, 0 findings) | **1** |
| Log file missing | 1 |
| Report file missing | 1 |
| No manifest (FSRT `errors: true`) | 1 |
| Report for another app key (`ledgerseal` gate on a DefinitionGuard report) | 1 |
| Report `{}` | 1 |
| FSRT run without `FORGE_LOG` (empty log) | 1 |

In the workflow, each app scan sends stderr to a log with `FORGE_LOG: info,fsrt=debug`, and the gate gets both files. The scan jobs `need: [build, canary]`, so no app is scanned unless the canary passes.

## 3. Canary

| Variant of `tools/ci/fsrt-canary` | FSRT finding | Canary gate |
|---|---|---|
| As committed | `Custom-Check-Authorization-11773629804881483617` through `handler.readIssue` | 0 (pass) |
| `readIssue` checks `mypermissions` as the user first | none | 1 |
| `readIssue` fixed; another resolver `other` with an unchecked `asApp()` call | through `handler.other` | 1: another finding does not satisfy it |
| `readIssue` renamed `readIssueAll` (unchecked) | through `handler.readIssueAll` | **0** |

- **L-56 (Low).** The canary test is `"handler.readIssue" in description`, a substring match. So a finding through a resolver whose name starts with `readIssue` satisfies it. That finding still shows that FSRT reports an unchecked `asApp()` call, so the scanner check holds. It just does not tie the canary to its own resolver. Suggested fix: match `"through handler.readIssue in "`, or check the proof's call stack. The fixture says "Do not fix it", and it is a one-resolver test app, so the risk is low.

## 4. Permissions and other checks

- `permissions: contents: read` (line 35) is unchanged. No `secrets.` reference, and the canary job adds no permission.
- The canary is a test fixture only. Its manifest has a zero app id, and it is never deployed.
- `docs/security/fsrt-scan-2026-11-07.md`: the added paragraph and run row match the code and run 42276042684.
- CI: run 42276042684 on `d32d8b8`: success for `Build FSRT (pinned)`, `FSRT canary` and the four apps.

## 5. Gate

| Check | Result |
|---|---|
| Changed files | `.github/workflows/fsrt.yml`, `tools/ci/fsrt_gate.py`, `tools/ci/fsrt-canary/**`, `docs/security/fsrt-scan-2026-11-07.md` |
| `apps/`, `packages/` | Unchanged |
| FSRT workflow | run 42276042684: success. The run on master after the merge is recorded in the coordinator report. |
