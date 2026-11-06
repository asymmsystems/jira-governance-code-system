# CI FSRT merge review

- Date: 2026-11-07. Reviewer: independent merge review session.
- Branch: `feature/ci-fsrt` at `caf43aa` (one commit), cut from master `e5b574c`. Merged after `feature/definitionguard-fsrt-authorization` (merge `9673c8c`), so master stays green. `feature/ci-fsrt-with-dg-fix` is a proof branch and is not merged.
- Change:
  - `.github/workflows/fsrt.yml`: build FSRT once at a pinned commit, scan each app with the default scanners and with `secret-logging`, keep the raw JSON for 90 days, and gate the result;
  - `tools/ci/fsrt_gate.py`;
  - `docs/security/fsrt-allowlist.txt` (empty).
- Test cases and outputs, not committed: `/home/fahimfarookme/.cache/jira-suite-merge-review/ci-fsrt/`.

## 1. Verdict

**Merge.** All five checks the coordinator asked for hold: pinning, cache key, permissions, failure on an incomplete scan as FSRT reports it, and a justification per allowlist entry. The cited runs behave as described. One Low finding: the gate cannot see a scan that analysed nothing, because FSRT reports that as a clean scan (section 3).

## 2. Checks

| Check | Result |
|---|---|
| FSRT pinned to a commit SHA | `FSRT_SHA: 6c821bd199fd7e4801384c2eaf9c3100bca0f57e` (full SHA). The checkout uses `ref: FSRT_SHA`, and the build first runs `test "$(git rev-parse HEAD)" = "$FSRT_SHA"`, then `cargo build --release --locked`. The binary carries a `FSRT_SHA` marker that is checked before use. |
| Cache key | Binary: `fsrt-bin-<os>-<FSRT_SHA>`. Cargo: `fsrt-cargo-<os>-<FSRT_SHA>`. A new FSRT commit gives a new key, so no stale binary. The scan jobs use `actions/cache/restore` with `fail-on-cache-miss: true`, after `needs: build`. GitHub cache scoping means a branch writes only its own scope, and master's entry is written only by runs on master. |
| Permissions and secrets | `permissions: contents: read` at workflow level, with no job override. No `secrets.` reference in the file. Both checkouts use `persist-credentials: false`. |
| Fails on an incomplete scan | `fsrt_gate.py` exits 1 when the report has `errors: true`, is missing, or is not valid JSON (tested; table below). FSRT sets `errors: true` for a missing manifest: `Could not find manifest.yml ...`. If FSRT itself fails, the Run step fails first, and the gate step does not run. |
| Allowlist needs a justification | An entry `<app> <check_name>` without text exits 2. With text it is accepted for that app only. An entry for another app does not cover this app. |
| Runs | 42267835873 (`caf43aa`, `feature/ci-fsrt`): failure, with `FSRT definitionguard` failed and the other three apps passing. 42269282280 (`d65de6b`, `feature/ci-fsrt-with-dg-fix`): success for all four apps. As stated. |

Gate tests (`python3 fsrt_gate.py definitionguard <report> <allowlist>`):

| Report | Allowlist | Exit |
|---|---|---|
| no findings, `errors: false` | empty | 0 |
| one finding | empty | 1 |
| `errors: true` | empty | 1 |
| missing file / truncated JSON | empty | 1 / 1 |
| one finding | entry without justification | 2 |
| one finding | entry with justification | 0 (printed as ALLOWED) |
| one finding | entry for `ledgerseal` | 1 |
| `{}` | empty | **0** |
| no findings, `scanned: []` | empty | **0** |

## 3. Findings

### Critical, High, Medium

None.

### Low

- **L-55. A scan that analysed nothing passes.** I ran my own build of FSRT at the pinned commit on a folder with `manifest.yml` but no `src/`. It wrote `{"vulns":[],"scanned":["systems.asymm.definitionguard"],"errors":false}` and exited 0, so FSRT itself does not flag it. The gate also passes `{}` and `scanned: []`. Today each `apps/<app>` has its `src/`, and the DefinitionGuard run on master failed as intended, so the scans do analyse code. A move of `src/` or of a handler file would turn the job green silently. Suggested guard:
  - Require `vulns` and `scanned` in the report, with `systems.asymm.<app>` in `scanned`.
  - Add a positive control: a small fixture app under `tools/ci/` with one unchecked `api.asApp().requestJira(...)` in a resolver, scanned in the same job, that must produce a `Custom-Check-Authorization` finding.

### Considered, no finding

- The build uses `rustup toolchain install stable`, which is not pinned. With `--locked`, only the compiler changes when the cache is cold. The binary is cached per FSRT commit.
- Actions are pinned to major tags (`@v4`), as in `apps-ci.yml`.

## 4. After the merge

FSRT on master after both merges: run 42272599802 on `d1958c8` (push), <https://github.com/asymmsystems/jira-governance-code-system/actions/runs/42272599802>, **success**. It built FSRT at the pinned commit (cache miss on master, so the cache entry now exists for every branch). `FSRT cascadeplan`, `FSRT definitionguard`, `FSRT fourrealities` and `FSRT ledgerseal` all passed.
