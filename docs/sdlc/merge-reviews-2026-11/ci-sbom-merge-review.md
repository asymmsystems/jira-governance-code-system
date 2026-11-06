# CI SBOM merge review

- Date: 2026-11-06. Reviewer: independent merge review session.
- Branch: `feature/ci-sbom` at `47bf133` (one commit). Its base is master `c58b197`, not `ba1a3e6` as the request said. It changes only `.github/workflows/apps-ci.yml` (18 added lines), so it merges onto master `ba1a3e6` without conflict, and the merged workflow file equals the branch's.
- Change, for each app of the matrix:
  - a CycloneDX step: `npx --yes @cyclonedx/cyclonedx-npm@4.0.0 --ignore-npm-errors --omit dev --output-format JSON`;
  - a `node -e` check that `bomFormat` is `CycloneDX` and that `components` is not empty;
  - `actions/upload-artifact@v4` with `retention-days: 90`.
- Output, not committed: `/home/fahimfarookme/.cache/jira-suite-merge-review/ci-sbom/` (local SBOM, `npm ls` output, the downloaded CI artifact).

## 1. Verdict

**Merge.** The SBOM lists every production package of LedgerSeal, and no other package. The CI run passed for all four apps, and their artifacts exist. Permissions stay `contents: read`. One Low finding (section 4).

## 2. Can `--ignore-npm-errors` hide a missing component?

In `apps/ledgerseal`, after `npm ci` (with the shared package first, as CI does):

| Source | Unique `name@version` |
|---|---|
| `npm ls --omit dev --all --json` | 286 (0 missing; 23 entries flagged `invalid`, all `react@18.3.1`, the peer range of Atlassian's UI packages) |
| Local `cyclonedx-npm@4.0.0` SBOM, the same flags | 286, CycloneDX 1.6 |
| CI artifact `sbom-ledgerseal-47bf133...` from run 42258416598 | 286, CycloneDX 1.6 |

- In `npm ls` but not in the SBOM: 0. In the SBOM but not in `npm ls`: 0. Local SBOM against the CI artifact: identical sets.
- `npm ls` exits 1 only with `ELSPROBLEMS`, "invalid: react@18.3.1". That is the error the flag exists for, and the SBOM still lists `react`.

## 3. Pinning and permissions

- `@cyclonedx/cyclonedx-npm@4.0.0` is an exact version, like `@forge/cli@15.0.0` in the same file.
- `actions/upload-artifact@v4` uses a major tag, like `actions/checkout@v4` and `actions/setup-node@v4` already in the file. Pinning actions to a commit SHA would be stricter. That would apply to all three actions and is not a new gap.
- Workflow permissions: `permissions: contents: read` (line 23) is unchanged, and no job adds permissions. `upload-artifact` needs no extra permission.
- Run 42258416598 on `47bf133`: success for `app (cascadeplan)`, `app (definitionguard)`, `app (ledgerseal)` and `app (fourrealities)`. Its four artifacts (62 to 70 KB each) expire on 2027-02-04, 90 days on.

## 4. Findings

### Critical, High, Medium

None.

### Low

- **L-54. The check would not catch a package that is missing from the install.** With `--ignore-npm-errors`, a missing package is left out of the SBOM silently, and the `node -e` check only asks for at least one component. Today nothing is missing (section 2), and the earlier `npm ci` step installs the whole lock file. A stronger check, if wanted: fail when `npm ls --omit dev --all --json` reports any `"missing": true`, so that `invalid` (the known peer range) stays allowed.

### Considered, no finding

- `npx --yes` resolves the CLI's own dependencies at run time. The same is true of the existing `@forge/cli` steps.

## 5. Gate

| Check | Result |
|---|---|
| Changed files | `.github/workflows/apps-ci.yml` only |
| Apps CI | run 42258416598 on `47bf133`: success, 4 of 4 apps |
| Local reproduction | as section 2 |
