# DefinitionGuard: Definition of Done gate for Jira

DefinitionGuard is an Atlassian Forge app for Jira Cloud. It puts a Definition of Done checklist on each issue and a workflow validator that blocks a move into a Done-category status while a mandatory item is open.

What the code does is described in `docs/spec/definitionguard-spec-v3.md` (domain model) and `docs/spec/definitionguard-spec-v2.md` (everything else). The Marketplace text is `docs/marketplace/definitionguard-listing-v2.md`. The build record is `docs/sdlc/definitionguard-usp-ux-research-2026-11/round-log.md`.

## Platform: Forge

- Runtime `nodejs22.x`, UI Kit (`render: native`). No egress is declared, so the app sends no data outside the Atlassian site.
- Atlassian decides whether an app gets the Runs on Atlassian badge; this README does not claim it.
- Storage: Forge KVS through `@forge/kvs`. Each change is an append-only change-log entry (`dg:evt:<issueId>:<seq>`) with a small state cache (`dg:state:<issueId>`).

## Scopes

| Scope | Why |
|---|---|
| `read:jira-work` | Read issues, statuses and the user's Jira permissions |
| `write:jira-work` | Write the `definitionguard-dod` issue property |
| `storage:app` | Keep checklists, history and templates in Forge storage |
| `read:workflow:jira` | Read workflows for the gate coverage check (read only) |

## Modules

- `jira:issuePanel` `definitionguard-issue-panel`: the checklist.
- `jira:projectSettingsPage` `definitionguard-project-settings`: templates per issue type, exempt statuses, re-sync, gate coverage. Project admins only.
- `jira:workflowValidator` `definitionguard-workflow-validator`: the gate. A Jira admin adds it to each transition in the workflow editor; the app cannot add it.

## Build and test

Host tools run through `flatpak-spawn --host` in this environment. `node_modules` is a link to the shared `apps/ledgerseal/node_modules`; do not run `npm install` here.

```bash
npx tsc --noEmit
npx jest --coverage        # 90% branch per source file is enforced in jest.config.js
forge lint
forge deploy -e development
```

Every source file starts with the Asymm Systems copyright header and `@author Fahim Farook`.
