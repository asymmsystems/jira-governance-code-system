# CLI package name merge review

- Date: 2026-11-07. Reviewer: independent merge review session.
- Branch: `feature/cli-package-name` at `46a8d75` (one commit), cut from master `a750a9b`. Master had not moved, so the merge result has the same tree as `46a8d75`.
- Change: `tools/verifier/package.json` `name` becomes `@asymm/jira-governance-code-cli`. This follows the public repository `asymmsystems/jira-governance-code-cli`, whose `main` at `412b64f` builds on `2b061df`.
- Clones: `jira-governance/repository/tmp/review-cli-package-name` and `review-cli-public`.

## 1. Verdict

**Merge.** No finding.

## 2. Checks

| Check | Result |
|---|---|
| Same as the public repository | `diff -r` of `tools/verifier` on the branch against the public `main` at `412b64f`: identical, every file. `verify-evidence.mjs`, `vectors.json` and `package.json` are byte-identical (`cmp`). |
| Live uses of the old package name | `git grep "@asymm/<old name>"` on the branch: only two merge review records that quote it (`code-cli-repository-rename-merge-review.md`, `repository-paths-merge-review.md`). No code, manifest, lock file, workflow, test or site source uses it. The other old-name hits are the five quoted historical lines of `repository-paths-merge-review.md`, section 4, and merge review records, which stay as they are. |
| Verifier tests (`tools/verifier`) | `node --test test/verify.test.mjs`: 12 of 12 pass; `node verify-evidence.mjs --self-test`: "PASS 10 of 10 vectors"; `require('./package.json').name` is `@asymm/jira-governance-code-cli` |
| CI | `tools/**` is not in the Apps CI or FSRT paths, so no run was triggered. No app test reads the verifier package name. |
