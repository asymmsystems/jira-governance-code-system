<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# Static analysis (SAST)

Atlassian's Government Cloud vendor rules and the Marketplace security questionnaire ask for
static application security testing. This page states the tool, the rules, how to run the scan,
and the results.

## 1. Setup

| Item | Value |
|---|---|
| Tool | Semgrep Community Edition (open source, LGPL-2.1-or-later), installed from PyPI |
| Version | `semgrep==1.182.1`, pinned in `.github/workflows/sast.yml` (`SEMGREP_VERSION`) |
| Rule packs | Semgrep Registry stock packs `p/typescript`, `p/javascript`, `p/nodejs`, `p/secrets`. No custom rules. |
| Scope | `apps/*/src` and `packages/*/src`, files tracked by git (196 files on 2026-11-08) |
| Gate | `--error`: any finding fails the job, whatever its severity |
| Report | raw JSON report kept as the artifact `semgrep-<commit>` for 90 days |
| Workflow | `.github/workflows/sast.yml`, one job, `permissions: contents: read`, metrics off |
| When it runs | on each push and pull request that changes `apps/**`, `packages/**` or the workflow; weekly on master (`schedule`, Mondays 03:17 UTC); by hand (`workflow_dispatch`) |

The rule packs are not versioned. Semgrep fetches the current pack from the registry on each run,
so a later run can report a finding that an earlier run of the same code did not. The weekly run on
master shows such a finding within a week of the rule's release, in a run of its own, not first on
an unrelated push. Triage it as section 3 says: fix the code, or allowlist a false positive.

FSRT (`.github/workflows/fsrt.yml`, `docs/security/fsrt-scan-2026-11-07.md`) covers the
Forge-specific risk of `asApp()` calls without an authorization check. Semgrep does not repeat it.

Semgrep Community Edition runs on a private repository with no account, no server, no cost and no
upload of the source. The common alternatives each need more:

| Tool | Why not |
|---|---|
| SonarQube Cloud (formerly SonarCloud) | The scanner uploads the source code to Sonar's service (EU or US hosting) for analysis, so the private source goes to a third party. It needs a Sonar account and an organization set up for the repository. Its free plan covers private projects only up to 50k lines of code for the whole organization (about 39,300 lines are scanned today) and analyses only the main branch; above the cap it does not analyse at all, and the apps will outgrow it. |
| SonarQube Server | Needs a self-hosted server |
| CodeQL | Code scanning on a private repository needs a paid GitHub Code Security licence (one of the GitHub Advanced Security products) |

Sources, read 2026-11-08: <https://www.sonarsource.com/plans-and-pricing/> ("free for your private
projects up to 50k LOC"); <https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-subscription/subscription-plans/>
(Free plan: up to 50k LOC per organization, 5 members, main branch analysis only; "You cannot exceed
your LOC limit"); <https://www.sonarsource.com/trust-center/> ("your scan report containing your
source code needs to be pushed to the SonarQube Cloud server"); the line count is
`git ls-files 'apps/*/src/*' 'packages/*/src/*'` (TypeScript, TSX and JavaScript), 39,273 lines on
master fd52e8b.

## 2. Run it locally

```sh
python3 -m venv ~/.cache/semgrep-1.182.1
~/.cache/semgrep-1.182.1/bin/pip install semgrep==1.182.1
cd <checkout of jira-governance-code-system>
~/.cache/semgrep-1.182.1/bin/semgrep scan --metrics=off \
  --config p/typescript --config p/javascript --config p/nodejs --config p/secrets \
  --error --json-output=semgrep.json \
  apps/*/src packages/*/src
```

Exit code 0 means no findings. Exit code 1 means at least one finding; the text output and
`semgrep.json` name the rule, the file and the line.

## 3. False positives (allowlist)

A false positive is suppressed in the code with a Semgrep comment on the reported line,
`// nosemgrep: <rule id>`, and it gets a row in this table in the same change. The row names the
file, the rule and the evidence that the finding is not real. A suppression without a row here is a
review failure. `git grep -n nosemgrep -- apps packages` lists every suppression.

| File and line | Rule id | Why it is a false positive (evidence) |
|---|---|---|
| (none) | | |

The allowlist is empty. On 2026-11-08 `git grep nosemgrep -- apps packages` finds nothing.

## 4. Results

### 4.1 Local scan, 2026-11-08

Commit: `origin/master` 762f109. Semgrep 1.182.1, 110 rules, 196 files scanned, 0 parse errors.

| Findings | Count |
|---|---|
| ERROR | 0 |
| WARNING | 0 |
| INFO | 0 |

There were no findings, so there was nothing to fix and nothing to allowlist.

### 4.2 The gate fails on a bad line

To show that the gate fails, a throwaway commit (not merged, branch deleted after the run) added
this function to `apps/cascadeplan/src/frontend/flag.ts`:

```ts
export function sastPlanted(): void {
  const q = new URLSearchParams(window.location.search).get('q');
  eval(q as string);
}
```

Locally, Semgrep reported
`javascript.lang.security.detect-eval-with-expression.detect-eval-with-expression` (WARNING) at
that line and exited with code 1.

### 4.3 CI runs

Both runs on 2026-11-07 (UTC), workflow "SAST (Semgrep)", Semgrep 1.182.1, 110 rules, 196 files.

| Run | Branch and commit | Result |
|---|---|---|
| 42402321552 | `feature/ci-sast` 757dddc (this workflow on master 762f109) | success: 0 findings |
| 42402331210 | `throwaway/sast-gate-proof` f6dfc5c (757dddc plus the planted function) | failure, as intended: 1 finding (`detect-eval-with-expression`, 1 blocking), exit code 1 |

Each run kept its raw report as an artifact (`semgrep-<commit>`). The throwaway branch was
deleted after the run; its commit was never merged.

The throwaway commit touched `apps/**`, so the other workflows ran on it too. FSRT run 42402331200
passed. Apps CI run 42402331115 failed in job "app (cascadeplan)", step "Rebuild the UI bundle and
compare with the committed one", because the planted function changed the frontend bundle; the
other three app jobs passed. That failure was a side effect of the test, not a problem on master.
Prove later gate changes locally (section 2, with a planted line that is not committed), so that no
failing branch is pushed.
