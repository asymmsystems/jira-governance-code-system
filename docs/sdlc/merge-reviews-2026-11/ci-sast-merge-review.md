# CI SAST merge review

- Date: 2026-11-08. Reviewer: independent merge review session.
- Branch: `feature/ci-sast` at `5122e11` (three commits), cut from master `762f109`. Master had not moved, so the merge result has the same tree as `5122e11`.
- Change:
  - `.github/workflows/sast.yml`: Semgrep Community Edition 1.182.1 with the stock packs `p/typescript`, `p/javascript`, `p/nodejs` and `p/secrets`, run with `--error` over `apps/*/src` and `packages/*/src`, keeping the JSON report for 90 days;
  - `docs/security/sast.md`.
- Clone, venv and scan output, not committed: `jira-governance/repository/tmp/` (`review-cli-package-name`, `semgrep-1.182.1`, `review-sast-out`).

## 1. Verdict

**Merge.** The pinning, permissions and scope are as stated, and the scan reproduces exactly. One Low finding on the "why not" table (section 4).

## 2. Pinning and permissions

| Item | Result |
|---|---|
| Semgrep | `pip install "semgrep==1.182.1"` from `SEMGREP_VERSION`. The version exists on PyPI: installed and reports 1.182.1. Its own dependencies resolve at install time, as `npx` does in the other workflows. |
| Actions | `actions/checkout@v4` (`persist-credentials: false`), `actions/upload-artifact@v4`: major tags, as in `apps-ci.yml` and `fsrt.yml` |
| Permissions | `contents: read` at workflow level; no job override; no `secrets.` reference |
| Metrics | `--metrics=off` and `SEMGREP_SEND_METRICS=off` |
| Gate | `--error`: any finding fails the job |

## 3. Scope and results (reproduced)

- **Scope.** `git ls-files 'apps/*/src/**' 'packages/*/src/**'` gives 196 files. Semgrep scans files tracked by git, and reports "Targets scanned: 196", with 0 skipped.
- **Local run** with the same command on `5122e11`: "Ran 110 rules on 196 files: 0 findings.", 0 errors, exit 0.
- **Out of scope by design:** the built bundles under `apps/*/static`, the live scripts and tests, and `tools/verifier`. The verifier is public code with its own tests.
- **CI:**
  - run 42402321552 (`feature/ci-sast` `757dddc`): success;
  - run 42402331210 (`throwaway/sast-gate-proof` `f6dfc5c`): failure, as intended.
  - `git ls-remote` finds no `throwaway/sast-gate-proof` branch.
- **Allowlist.** The process needs evidence: a `// nosemgrep: <rule id>` comment must come with a table row naming the file, the rule and why it is not real, and a suppression without a row is a review failure. It is a review rule, not a CI check. `git grep nosemgrep -- apps packages` finds nothing today.

## 4. "Why not Sonar or CodeQL" table

Sources fetched 2026-11-08: https://www.sonarsource.com/plans-and-pricing/, https://www.sonarsource.com/products/sonarqube/, https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning, https://docs.github.com/en/get-started/learning-about-github/about-github-advanced-security, https://github.com/github/codeql-cli-binaries/blob/main/LICENSE.md.

| Row | Result |
|---|---|
| SonarQube Server: needs a self-hosted server | Accurate ("self-managed static analysis solution", "Runs on your infrastructure") |
| CodeQL: needs paid GitHub Advanced Security on a private repository | Accurate in substance. GitHub: "If you want to use code scanning on private repositories, you need a GitHub Code Security license." The product is now named GitHub Code Security, one of the GitHub Advanced Security products. The CodeQL CLI terms also do not allow use on a codebase that is not open source without that licence. |
| SonarCloud: paid for private repositories | **Not accurate** (L-63) |

- **L-63 (Low).** SonarQube Cloud (formerly SonarCloud) has a free plan for private projects: "free for your private projects up to 50k LOC. No card, no expiry." The scanned code is about 39,300 lines today (TypeScript, TSX and JavaScript under `apps/*/src` and `packages/*/src`), so it fits that plan. Semgrep can still be the better choice, but the stated reason is wrong. Possible reasons that hold:
  - SonarQube Cloud uploads the private source to Sonar's service;
  - it needs an account and a project setup;
  - the 50k-line cap will be reached as the apps grow.

  Suggested row: "SonarQube Cloud: free for private projects only up to 50k lines (39k today), needs an account, and analyses the code on Sonar's service".

## 5. Unversioned rule packs

**Acceptable, and I would not vendor them now.**
- The registry packs grow, so a new rule can fail a later run on unchanged code. That is the point of a security gate: it shows new known patterns.
- Vendoring freezes the rules, so they go stale. It also means copying Semgrep's rules into the repository, under the Semgrep Rules License, which limits how they may be used and shared.
- What to add instead: a weekly `schedule:` run on master. A new finding then shows up in that run, not as a surprise on an unrelated push, and `sast.md` section 3 already says how to triage it.
- When an audit needs to reproduce a past run exactly, the 90-day artifact holds the report, and Semgrep's output names each rule id.
