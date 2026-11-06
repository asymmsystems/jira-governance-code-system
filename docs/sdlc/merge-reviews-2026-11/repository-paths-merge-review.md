# Repository paths merge review

- Date: 2026-11-07. Reviewer: independent merge review session.
- Branch: `feature/repository-paths` at `b86f033` (one commit, 272 files: 164 added, 108 modified), cut from master `e74297f`. Master had not moved, so no rebase or conflict resolution was needed.
- Merged with one reviewer commit on top (`f972ca9`, 5 lines in 4 files; section 4).
- Purpose: housekeeping after the repository move:
  - the new parent is `asymmsystems/jira-governance`;
  - the verifier repository is renamed `asymmsystems/jira-governance-code-cli`;
  - old paths (the earlier checkout folders, the suite's home-directory cache folders, and the verifier's old repository links) become repo-relative paths, `jira-governance/.tmp/cache` or `jira-governance/.tmp/secrets`;
  - cited harnesses are copied into `docs/sdlc/<round>/evidence/`;
  - frozen records get path edits only, plus a "Paths updated 2026-11-07" line;
  - 10 one-line READMEs are added.
- Test output, not committed: `jira-governance/.tmp/cache/merge-review/repository-paths/tests.txt`.

## 1. Verdict

**Merge**, with the reviewer commit.
- No old path form is left outside quoted historical text and the allowed package name.
- The 164 added evidence files hold no secret and no real personal data.
- The word diff of the 108 modified files shows only path, repository-name and checkout-name changes, the relative links of one design note, and the two "Paths updated" lines.
- One kind of change did alter recorded facts: five quoted mentions of a wrong repository name. The reviewer commit restores them (section 4).
- The four test suites, Apps CI and FSRT pass.

## 2. Old path forms (merge result)

| Form | Hits |
|---|---|
| The earlier checkout name (the coordinator's first search string) | 0 |
| The suite fixes cache folder name (the second) | 0 |
| The merge review cache folder name (the third) | 0 |
| `ledgerseal-verifier` | 6: the npm package name `@asymm/ledgerseal-verifier` in `tools/verifier/package.json` (kept by the coordinator's decision), and the five quoted historical lines of section 4 |

Other forms, searched for completeness:
- `jira-suite-`: only `com.googlecode.jira-suite-utilities`, a Marketplace app key in the pricing research.
- `~/.cache/`: three shortened historical commands (`~/.cache/.../probes/build`).
- `/tmp/claude-...` scratchpad paths: 7 lines in two research records. They are temporary paths quoted as history.

The rewritten targets exist on disk: `jira-governance/.tmp/cache/{merge-review,suite-fixes,cp-fixes-scratch}` and `.tmp/secrets`.

## 3. Evidence files (164 added)

42 `.txt`, 40 `.ts`, 31 `.json`, 23 `.js`, 12 `.md`, 6 `.sh`, 5 `.py`, and a few others. I scanned every file:

| Pattern | Result |
|---|---|
| PEM private key header, Atlassian API token (`ATATT...`), bearer or basic authorization, JWT, session cookie names, `_authToken`, password, api-key or secret assignments | 0 |
| Email addresses | `a@x.test`, `cfo@victim.example` (test fixtures) and `i@izs.me` (npm's public deprecation notice, copied in a log) |
| Atlassian account ids | only the synthetic `712020:0123456789abcdef01234567` |
| `displayName`, cookie or storage-state files, environment dumps | 0 |
| Sites | only `perf.atlassian.net`, a test fixture |
| `npmrc-used` | `install-links=true` only |

No real secret or personal data.

## 4. Frozen records: did any fact change?

- **Method.** Word-level diff of all 108 modified files against `e74297f`. I normalised the paths, the repository rename and the checkout rename, and listed every change that remained.
- **What remained:**
  - repo-relative evidence paths in place of absolute ones;
  - relative links in place of `file:///home/...` links (`docs/design/prompt-other-apps-ui-adoption.md`);
  - the two "Paths updated 2026-11-07 for the repository move." lines;
  - one group of real fact changes, below.
- **Fact changes, restored by `f972ca9`.** Five lines quote the name `asymm-systems/ledgerseal-verifier`. The hyphenated organisation does not exist (GitHub API: 404), so this was a wrong name, quoted as what a playbook said or what returned 404:
  - `suite-readiness-review-2026-11/ledgerseal-readiness.md:19`: "The playbook's `asymm-systems/ledgerseal-verifier` also returns 404."
  - `ledgerseal-readiness.md:67`: F-21 "verifier repo `asymm-systems/ledgerseal-verifier` (404)".
  - `ledgerseal-marketplace-fixes-2026-11/progress-log.md:180`: the record of an edit, "`asymm-systems/ledgerseal-verifier` -> `asymmsystems/ledgerseal-verifier`".
  - `docs/marketplace/master-suite-launch-prompt.md:145` and `suite-launch-and-first-sale-playbook.md:115`: the superseded playbooks' own text.

  The branch rewrote these to `asymm-systems/jira-governance-code-cli`, so the records said that name returned 404 and that the playbook named it. Neither ever happened. `f972ca9` restores the five lines to master's text, as quoted historical text. For each file, the lines that contain `asymm-systems/` now equal master's.
- **Correct renames.** The other `asymmsystems/ledgerseal-verifier` rewrites name the real repository. GitHub renamed it and redirects the old name, so those records still describe the same repository.

## 5. Changes outside `docs/`

All path or repository-name text:
- comments in `apps/fourrealities/src/accessor/attestation-keys.ts`, `apps/ledgerseal/test/evidence.test.ts` and the ADRs;
- the expected URL in `apps/ledgerseal/test/listing.test.ts`;
- default output paths in two live scripts (`dg_live.py`, `marketplace_shots.py`);
- the repository URL in `tools/verifier/package.json`;
- the paths in `loop-engine/agents/fourrealities_usp_ux_research.md`.

That last file is an agent prompt. Its change is paths only, which fits the housekeeping the coordinator describes. `tools/verifier` equals the public repository's `feature/repository-rename` head byte for byte (`diff -r`), so the copy and the public repository stay identical after both merges.

## 6. Gate

| Check | Result |
|---|---|
| `npm test` on the branch with `f972ca9` (shared package installed first) | LedgerSeal 52 suites, 575 tests; DefinitionGuard 35, 484; FourRealities 47, 570; CascadePlan 85, 987; all pass |
| Apps CI | run 42291681883 on `b86f033`: success |
| FSRT | run 42291681943 on `b86f033`: success |
| `f972ca9` | four Markdown files in `docs/`; no test reads them |
