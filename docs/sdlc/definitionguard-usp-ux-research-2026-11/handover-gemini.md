# Handover prompt: continue DefinitionGuard (for Gemini)

Copy everything below the line into Gemini as its first message.

---

You are taking over the DefinitionGuard app from a previous AI session. DefinitionGuard is an Atlassian Forge app for Jira Cloud, owned by Fahim Farook (Asymm Systems). The research (Part A), the build (Part B) and the live checks are done and merged into `master`. Your job is to finish the few open items below, carefully, without breaking anything that works, and without touching the other apps.

Read this whole prompt before you act. When this prompt and a file disagree, the file is newer; say so and follow the file.

## 1. Where things are

- Repository: `/home/fahimfarookme/Documents/projects/gemini-earning` (git). It has NO git remote. Nothing can be pushed. Do not add a remote.
- Worktrees (one per app session; other people's work is in progress in them):
  - `/home/fahimfarookme/Documents/projects/gemini-earning` on `feature/cascadeplan-research-build`: CascadePlan, actively developed by another session. Do not edit, stash, reset or check out anything there.
  - `/home/fahimfarookme/Documents/projects/gemini-earning-fr-build` on `feature/fourrealities-research-build`: FourRealities. Not yours.
  - `/home/fahimfarookme/Documents/projects/gemini-earning-ls-build` on `feature/ledgerseal-research-build`: LedgerSeal. Not yours.
  - `/home/fahimfarookme/Documents/projects/gemini-earning-dg-build`: DefinitionGuard. YOURS. Work only here.
- Restore point: the tag `definitionguard-handover-2026-11-01` and the branch `snapshot/definitionguard-handover-2026-11-01` mark the state you start from. Never move, delete, rebase or force-update either of them, and never rewrite any commit they contain.
- Never change any file under `apps/planshift`, `apps/fourrealities` or `apps/ledgerseal`, and never run `git stash`, `git reset`, `git checkout` or `git clean` in a worktree that is not yours. The stash stack is shared by all worktrees.
- App: `apps/definitionguard`. `node_modules` there is a symbolic link to `/home/fahimfarookme/Documents/projects/gemini-earning/apps/ledgerseal/node_modules`, shared with LedgerSeal and CascadePlan. Never run `npm install`, `npm update` or anything that changes it. Ask the owner first if a dependency seems needed.
- Your shell runs inside a VS Code Flatpak sandbox. Run host tools (node, npx, jest, tsc, forge) through `flatpak-spawn --host sh -c 'cd <absolute path> && <command>'`. Use absolute paths; never chain `cd ..`.

## 2. Read these first, in this order

1. `docs/sdlc/definitionguard-usp-ux-research-2026-11/round-log.md`: the full record of every item, commit, test, deviation, live check and live write. This is the source of truth.
2. `docs/sdlc/definitionguard-usp-ux-research-2026-11/backlog.md`: line 1 is the owner's approval line. Items B-01 to B-21 are done.
3. `docs/spec/definitionguard-spec-v3.md` (the domain model, approved) and `docs/spec/definitionguard-spec-v2.md` (frozen; still valid for everything v3 does not replace).
4. `docs/sdlc/definitionguard-usp-ux-research-2026-11/ux-spec.md` and `research-brief.md`.
5. `loop-engine/agents/definitionguard_usp_ux_research.md`: the original brief, with the hard rules in section 14 and the report format in section 15.
6. `apps/definitionguard/README.md`.

## 3. What the code is now (version 4, deployed to the Forge development environment)

- Domain model follows the Silverston patterns as Apache OFBiz implements them (owner decision): the Jira issue is a WorkEffort of type ISSUE (by reference); each checklist item is a child WorkEffort of type DOD_CRITERION linked by WorkEffortAssoc WORK_EFF_BREAKDOWN; the template is a DOD_TEMPLATE WorkEffort linked by WORK_EFF_TEMPLATE with revisionNumber; item states are StatusItems DOD_OPEN, DOD_DONE, DOD_WAIVED with an enforced StatusValidChange table (`src/domain/dod-status.ts`); history is WorkEffortStatus rows; evidence is Content linked by WorkEffortContent. Roles are read live from Jira. People who act are stored as pseudonyms (since 2026-11-06, ADR-010; see `docs/sdlc/definitionguard-marketplace-fixes-2026-11/progress-log.md`).
- Storage: append-only change-log entries `dg:evt:<issueId>:<seq 8 digits>` written with KVS `keyPolicy: FAIL_IF_EXISTS` as the lock, plus a state cache `dg:state:<issueId>`. v1 records `dg:checklist:<issueId>` are read only and migrated on first change. A hash chain covers every entry.
- Gate: `src/domain/gate-rule.ts` is the only rule; the validator and the panel both use it. The validator fails closed on any error, never writes, never reads the `definitionguard-dod` property, and names every open mandatory item. Only moves into Done-category statuses are gated; admins can exempt statuses.
- The `definitionguard-dod` issue property is schema v2 (schema 3 since 2026-11-06, without the account id), signed with Ed25519. The private key is the encrypted Forge variable `DG_SIGNING_KEY` in the development environment only (keyId `dg-dev-2026-11`). The development public key is `docs/marketplace/definitionguard-public-key.pem`; it is not for customers (the production key `dg-prod-2026-11` is published on asymm.systems).
- UI: `src/frontend/index.tsx` (issue panel) and `src/frontend/settings.tsx` (project settings) only render pure view models in `src/ui/`. All rules and wording live in `src/ui/panel-view-model.ts` and `src/ui/template-editor.ts`, which are unit-tested.
- Scopes (at the time of this handover): `read:jira-work`, `write:jira-work`, `storage:app`, `read:workflow:jira`. Since then also `read:jira-user` and `report:personal-data` (see `manifest.yml`).
- Tests: 300 pass; 90% branch per source file is enforced in `jest.config.js`.

## 4. How to check your work (run all of these for every change)

```
flatpak-spawn --host sh ~/.cache/gemini-earning-definitionguard-research/check_item.sh <commit before your change>
```

It runs `tsc --noEmit`, Jest with coverage, the 90% branch check on each changed source file, `loop-engine/graders/grade_tdd.py`, `grade_security.py`, `grade_ui.py`, and an em dash scan. All must pass. Also run `flatpak-spawn --host sh -c 'cd /home/fahimfarookme/Documents/projects/gemini-earning-dg-build/apps/definitionguard && forge lint'` before any deploy.

The scale harness is `~/.cache/gemini-earning-definitionguard-research/harness/` (run it with `HARNESS_APP=<app path> HARNESS_LABEL=<label> npx jest -c <harness>/jest.config.js` from the app folder). Results go to `harness/results/<label>.json`.

## 5. Rules you must follow (from the owner)

- Test-driven: write the test first, run it, and see it fail for the right reason before you write code. Say so in the round log if you ever skip this.
- One backlog item per commit. Commit with `git commit -F <file>`. Message: `type(definitionguard): summary`, a body that describes the final state (not what was wrong), and a `Refs: B-NN, DG-NN` trailer. NEVER add a `Co-Authored-By` line for any AI.
- Branch: start a new branch from `master` in your worktree, named `feature/definitionguard-<descriptor>` (no date). Do not commit to `master` directly. Do not merge, tag or release without asking the owner.
- Every new source file starts with:
  ```
  /**
   * <one-line purpose>
   *
   * Copyright (c) 2026 Asymm Systems. All rights reserved.
   * @author Fahim Farook
   */
  ```
- Never use the em dash character (U+2014) in any file or message. Use commas, colons or full stops.
- Write for the owner in plain English: short sentences (about 20 words or fewer), active voice, no contractions. No jargon clumps. When you mention a file, give its full path; when you mention a class, give its file.
- Never edit a file you did not create unless the task is to change it. Never "freeze and replace" an approved spec: if a spec must change, copy it to the next `-vN` file and change the copy.
- Record every item in `round-log.md`: date, what changed, tests added, results, commit SHA, deviations.
- Do not claim anything you have not checked. Mark claims Observed-code, Observed-test, Observed-live, Reported or Inferred, as the round log does. Say "Unknown" rather than guess.
- Ask the owner for exactly one decision per message, with options, trade-offs and your recommendation. Do all unblocked work first.

## 6. Live site rules (https://asymmsystems.atlassian.net)

- Deploy only to the Forge development environment: `forge deploy -e development --non-interactive`. Never staging or production. Never publish to the Marketplace or change licensing or the listing on the Marketplace.
- A scope change makes a major version: `forge deploy` then needs `--approve MAJOR_VERSION_RULE`, and the site installation then needs `forge install --upgrade -e development --site asymmsystems.atlassian.net --product jira`. The upgrade grants permissions on the live site: ask the owner first, every time.
- Write only to probe issues you create with the summary prefix `[DG-PROBE]` and the label `dg-probe`. The existing probe issue is DEMO-35 (id 10067, now Done). Record every write in the round log: issue, field or property, old value, new value.
- Do not change any workflow unless the owner says so in chat for that test. If you add the validator for a test, remove it afterwards and check with `GET /rest/api/3/workflows/search?projectId=10001&expand=values.transitions` that no DefinitionGuard rule remains. The DEMO default workflow is now at version 10 with no Forge validator.
- Never open a LedgerSeal panel: viewing it rewrites its property. Do not change other apps' data.
- Do not delete issues. Do not sign up for anything. Do not send the owner's email address or any credential to any service.
- On the settings page, do not save templates or exemptions on DEMO: they are project-wide settings. View only, unless the owner allows a test.

## 7. Known pitfalls

- UI Kit text fields: a controlled `Textfield` (`value` plus `onChange`) loses keystrokes over the bridge. Use uncontrolled fields: `onChange` only, `defaultValue` for a start value, and remount with `key` to clear. A test in `test/ui/panel-view-model.test.ts` fails if a controlled field returns. The other apps may have the same defect; tell the owner, do not fix their code.
- Jira stores a Forge function validator as `ruleKey: forge:expression-validator` with the module key in `parameters.key`. The coverage check matches on the module key `definitionguard-workflow-validator`.
- The validator payload carries `issue.key` and `transition.to.id`, not the issue id. The validator resolves the id with one issue read.
- KVS transactions cannot carry `keyPolicy`; only a single `kvs.set` can. Conditional writes in transactions exist only for Custom Entities.
- The Forge CLI warns that host node 26 is outside its supported 22 and 24. It works; ignore the warning.
- `git diff master..HEAD` can show other apps' files when `master` has moved. Use `git diff $(git merge-base HEAD master) HEAD` to see only your branch.

## 8. Open work, in order

1. **Keyboard and screen reader check (UX task 9).** On a `[DG-PROBE]` issue in DEMO, check that the panel can be used with the keyboard only (Tab to each checkbox, Space to tick, the evidence and waiver forms) and that each checkbox's accessible name includes "mandatory" or "optional" and its state. Record the result in `ux-spec.md` (task 9, After column) and the round log. Fix any defect test-first.
2. **Report the open items to the owner, one decision at a time.** None of these may be done without the owner:
   - Team-managed projects (B-20): the site has no team-managed project, so the `projectTypes` change is not tested live. The owner may create one for a test.
   - A live test of the validator when it throws (DG-08): it would need a deliberately broken build. Unit tests already prove it blocks. Recommend leaving it.
   - Production: a separate signing key pair for production, its public key, and the production deploy are the owner's decisions.
   - FourRealities reads `definitionguard-dod`. It should verify the signature with the public key and treat an unsigned or failing value as unknown. That is FourRealities work for its own session; tell the owner, do not change it.
   - The listing `docs/marketplace/definitionguard-listing-v2.md` needs the owner's review before any Marketplace use. Price (owner decision, 2026-11-06): free for 1 to 10 users, $0.95 per user per month for 11 to 100, $0.75 for 101 to 250, $0.24 for 251 to 1,000, custom above 1,000.
3. **Final report** in the format of section 15 of the brief: each file you created or changed with its full path and commit SHA; test and coverage summary; `forge lint` and `forge deploy` output if you deployed; every live write.

## 9. If something goes wrong

- If a check fails after five honest attempts, stop, mark the item BLOCKED in `backlog.md` with the last error, and report it.
- If you find uncommitted changes in `apps/definitionguard` that you did not make, stop and report them. Do not discard them.
- If anything would touch another app, the shared `node_modules`, a workflow, or the live site beyond probe issues, stop and ask the owner first.
