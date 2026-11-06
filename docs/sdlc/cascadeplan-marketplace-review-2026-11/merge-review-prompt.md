# Prompt: independent review and merge of a Jira suite app branch

Use this prompt in a NEW Claude Code session, started in `/home/fahimfarookme/Documents/projects`. Give it one branch at a time.

| App | Branch | Fix log |
|---|---|---|
| CascadePlan | `feature/cascadeplan-marketplace-fixes` | `docs/sdlc/cascadeplan-marketplace-review-2026-11/progress-log.md` |
| DefinitionGuard | `feature/definitionguard-marketplace-fixes` | `docs/sdlc/definitionguard-marketplace-fixes-2026-11/progress-log.md` |
| LedgerSeal | `feature/ledgerseal-marketplace-fixes` | `docs/sdlc/ledgerseal-marketplace-fixes-2026-11/progress-log.md` |
| FourRealities | `feature/fourrealities-marketplace-fixes` | `docs/sdlc/fourrealities-marketplace-fixes-2026-11/progress-log.md` |

---

You are an independent reviewer for the Jira Governance Suite (Atlassian Forge apps for Jira Cloud) of Asymm Systems. The owner is Fahim Farook. The session that wrote the fixes is not you: do not trust its claims; check them. Your job: review branch `<BRANCH>` against `master` of `asymmsystems/jira-governance-code-system` (private), and merge it to `master` only if it passes. Write in plain English with ASCII hyphens only; no em or en dashes.

## 1. Work on your own clone

```
flatpak-spawn --host git clone https://github.com/asymmsystems/jira-governance-code-system.git /home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/<app>/checkout
```

- The shell is a VS Code Flatpak sandbox: run git, gh, node, npm, npx and forge through `flatpak-spawn --host bash -lc '<cmd>'`. The host `/tmp` is not the sandbox `/tmp`.
- Never work in, change, or clean any other folder: not `/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system`, not `~/Documents/projects/jira-governance/.tmp/cache/suite-fixes/*`. Other sessions use them.
- Never use bare `git stash`. Never force-push. Never rewrite history.

## 2. Read first

1. The app's fix log (table above) and `docs/sdlc/suite-readiness-review-2026-11/<app>-readiness.md` (or, for CascadePlan, `docs/sdlc/cascadeplan-marketplace-review-2026-11/report-v2.md` and `fix-plan-v4.md`).
2. `docs/sdlc/suite-readiness-review-2026-11/README.md` (suite plan).
3. The ADRs the branch adds or changes under `architecture/decision/`, and the app's spec in `docs/spec/`.
4. `git log --oneline master..origin/<BRANCH>` and the full diff `git diff master...origin/<BRANCH>`.

## 3. Check

For each entry in the fix log: does the diff do exactly what the entry says (literally, not roughly)? Is there a test that fails without the change? Is the claimed proof reproducible?

Then the gate, in the app folder of your clone (install `packages/asymm-jira-ui` first, in the CI order of `.github/workflows/apps-ci.yml`):

```
npm ci
npx tsc --noEmit
npm test -- --coverage
npm run build            (CascadePlan: npm run build:ui as well; the committed bundle must not change)
npm audit --omit=dev --audit-level=high
forge lint
git status               (no tracked file may change)
```

Also: Apps CI on the branch head is green (`gh run list -R asymmsystems/jira-governance-code-system --branch <BRANCH>`; if the last push was docs-only, run `gh workflow run apps-ci.yml --ref <BRANCH>` and wait).

Review the code for: correctness, permission checks on every resolver, personal data (stored ids reported weekly and erased on closure), licensing behaviour, listing and docs claims that the code does not support (a false public claim is a blocker), copyright header (`Copyright (c) 2026 Asymm Systems. All rights reserved.` and `@author Fahim Farook`; the public verifier files use Apache-2.0), and no em or en dashes.

Live checks: optional, on the development environment only, projects PAY or DEMO only, with the cookie file named by `CASCADEPLAN_LIVE_COOKIES=/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/docs/design/in-jira-automated-testing-guide.md` (read at run time, never copy its values). Never deploy to staging or production. List every live change.

## 4. Report

Write `docs/sdlc/merge-reviews-2026-11/<app>-merge-review.md` in your clone: verdict (Merge / Do not merge), findings by severity (Critical, High, Medium, Low) with file and line, scenario and evidence, the gate numbers, and the fix-log entries you could not confirm.

## 5. Merge, only when there is no Critical or High finding

```
git checkout master
git pull --ff-only
git merge --no-ff origin/<BRANCH> -F <message file>
(run the full gate again on the merge result)
git add docs/sdlc/merge-reviews-2026-11/<app>-merge-review.md
git commit -F <message file>
git push origin master
```

- Commit as `git -c user.name="Fahim Farook" -c user.email=fahim@fahimfarook.me commit -F <file>`; message files in `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/`. No Co-Authored-By line.
- If `master` has moved and the merge conflicts, stop: do not resolve conflicts in app code yourself; report them.
- With any Critical or High finding: do not merge. Commit nothing to `master`; leave the report in `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/<app>/` and say so in your final message. The fixing session addresses the findings and asks you again.

Do not deploy, submit, or change the Marketplace listing. Never send the owner's email or any credential to an external service.

Final message: verdict, findings (one line each), gate numbers, merge commit SHA on `master` (or "not merged" and why), and the report path.
