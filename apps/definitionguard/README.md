# DefinitionGuard: Definition of Done gate for Jira

DefinitionGuard is an Atlassian Forge app for Jira Cloud. It puts a Definition of Done checklist on each issue and a workflow validator that blocks a move into a Done-category status while a mandatory item is open.

What the code does is described in `docs/spec/definitionguard-spec-v3.md` (domain model) and `docs/spec/definitionguard-spec-v2.md` (everything else). The Marketplace text is `docs/marketplace/definitionguard-listing-v2.md`. The build record is `docs/sdlc/definitionguard-usp-ux-research-2026-11/round-log.md`.

## Platform: Forge

- Runtime `nodejs22.x`, UI Kit (`render: native`). No egress is declared, so the app sends no data outside the Atlassian site.
- Atlassian decides whether an app gets the Runs on Atlassian badge; this README does not claim it.
- Storage: Forge KVS through `@forge/kvs`. Each change is an append-only change-log entry (`dg:evt:<issueId>:<seq>`) with a small state cache (`dg:state:<issueId>`).
- People are stored as random pseudonyms; the account id is only in `dg:pty:<accountId>` and `dg:pid:<pseudonym>`, reported weekly and erased for closed accounts (`architecture/decision/adr-00010-definitionguard-personal-data-pseudonyms.org`).
- The `definitionguard-dod` issue property (schema 3) is signed with Ed25519 when the Forge variables `DG_SIGNING_KEY` and `DG_SIGNING_KEY_ID` are set; otherwise it is written unsigned, a warning is logged and the panel says so.

## Scopes

| Scope | Why |
|---|---|
| `read:jira-work` | Read issues, their changelog, statuses and the user's Jira permissions |
| `write:issue.property:jira` | Write the app's own `definitionguard-dod` issue property (the granular scope for issue properties). The app never edits issue fields |
| `read:jira-user` | Read the user's groups and search groups for approver authority |
| `storage:app` | Keep checklists, history, templates and approver groups in Forge storage |
| `read:workflow:jira` | Read workflows for the gate coverage check (read only) |
| `report:personal-data` | Weekly personal data report and erasure of closed accounts |

## Modules

- `jira:issuePanel` `definitionguard-issue-panel`: the checklist.
- `jira:projectSettingsPage` `definitionguard-project-settings`: templates per issue type (each with its waiver permission), exempt statuses, re-sync, gate coverage. Project admins only.
- `jira:adminPage` `definitionguard-admin`: "DefinitionGuard approvers", the Jira groups whose members may waive, reopen waived items and reset. Jira admins only.
- `jira:workflowValidator` `definitionguard-workflow-validator`: the gate. A Jira admin adds it to each transition in the workflow editor; the app cannot add it.
- `trigger` `issue-deleted` (`avi:jira:deleted:issue`) and `scheduledTrigger` `personal-data-report` (weekly).

## Build and test

Host tools run through `flatpak-spawn --host` in this environment. Install `packages/asymm-jira-ui` first, then the app (the CI order in `.github/workflows/apps-ci.yml`).

```bash
(cd ../../packages/asymm-jira-ui && npm ci)
npm ci
npm audit --omit=dev --audit-level=high
npx tsc --noEmit
npx jest --coverage        # 90% branch per source file is enforced in jest.config.js
forge lint
forge deploy -e development
```

Every source file starts with the Asymm Systems copyright header and `@author Fahim Farook`.
