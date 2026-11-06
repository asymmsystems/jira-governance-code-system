# Code CLI repository rename merge review

- Date: 2026-11-07. Reviewer: independent merge review session.
- Repository: `asymmsystems/jira-governance-code-cli` (public; renamed from `ledgerseal-verifier`). Branch `feature/repository-rename` at `3f1d4fb` (one commit), from `main` `870988f`. Merged into `main` with `--no-ff` as `2b061df` and pushed: the owner-approved rename follow-up.
- No tag and no release were created; the latest release is still v1.3.0.
- **Timing.** After this merge was pushed, the coordinator withdrew the item, to do it together with the owner-ordered package rename to `@asymm/jira-governance-code-cli`. The merge `2b061df` is on the public `main`. It was not reverted, because a revert or force-push of a public `main` is the owner's decision. It changes only the repository URL, which the package rename branch will build on.
- Change: `package.json` `repository.url` becomes `git+https://github.com/asymmsystems/jira-governance-code-cli.git`. The package name `@asymm/ledgerseal-verifier` is unchanged, by decision.

## 1. Verdict

**Merged into `main`.** The repository holds no private path or note. No finding.

## 2. Checks

| Check | Result |
|---|---|
| Tree at `3f1d4fb` (18 files: verifier, tests, fixtures, keys, README, SECURITY, LICENSE, workflow) | No `/home/`, `fahimfarookme`, earlier checkout name, `.cache/`, `.tmp/`, `jira-governance-code-system`, `docs/sdlc`, scratchpad path, private key header, Atlassian token, site name, TODO, FIXME or "confidential" text. The only email address is `security@asymm.systems`. |
| Full history (every added or removed line of every commit) | The same patterns: none. Commit author and committer: the owner's public address only. |
| Same as the Jira repository's copy | `diff -r` of this branch head against `tools/verifier` on the Jira branch `feature/repository-paths`: identical |
| Tests | `node --test test/verify.test.mjs`: 12 of 12 pass; `node verify-evidence.mjs --self-test`: "PASS 10 of 10 vectors" |
| CI | The workflow runs on `main` and pull requests only. Run 42294828262 on `2b061df` (`main`, after the merge): success |
