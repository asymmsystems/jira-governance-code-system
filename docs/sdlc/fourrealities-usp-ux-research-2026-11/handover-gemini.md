# Handover: FourRealities build, for the next agent (Gemini)

You continue a build that a previous agent (Claude) ran on 2026-11-01. Read this whole file before you change anything. The owner is Fahim Farook. He wants the agent to do every step it can (code, development deploys, browser checks), to give exact URLs and button names whenever a step is handed back, and to explain in short, plain sentences. Never use the em dash character anywhere.

## 1. Where everything is

| Thing | Location |
|---|---|
| Git worktree (work only here) | `/home/fahimfarookme/Documents/projects/gemini-earning-fr-build` |
| Branch | `feature/fourrealities-research-build` (latest commit: run `git log --oneline -1`) |
| App | `apps/fourrealities` (Atlassian Forge, UI Kit, TypeScript) |
| Research, backlog, round log, final report | `docs/sdlc/fourrealities-usp-ux-research-2026-11/` (`research-brief.md`, `ux-spec.md`, `backlog.md`, `round-log.md`, `final-report.md`, this file) |
| Spec (working copy; v1 is frozen) | `docs/spec/fourrealities-spec-v2.md` |
| ADRs and HLD | `architecture/decision/adr-00001-fourrealities-evidence-data-model.org`, `adr-00002-fourrealities-volatility-layering.org`, `architecture/model/fourrealities-domain-model.org` |
| Listing draft (v1 and the live listing are unchanged) | `docs/marketplace/fourrealities-listing-v2.md` |
| Harness, graders, sources | `~/.cache/gemini-earning-fourrealities-research/` (`run.sh`, `graders.sh`, `harness/resolver-after.test.ts`, `sources/`) |
| Jira site | `https://asymmsystems.atlassian.net` |
| Dashboard on DEMO | `https://asymmsystems.atlassian.net/jira/servicedesk/projects/DEMO/apps/974e4981-7626-4b1c-a41f-7eaccb7f3605/c9d5ad8b-0b9e-41eb-9bca-a0384f708c20` |
| Probe issue (the only issue you may write to) | `https://asymmsystems.atlassian.net/browse/AUDT-1` (label `fr-probe`, project AUDT, software) |

Checkpoint at the handover: branch `feature/fourrealities-claude-checkpoint` and annotated tag `fourrealities-claude-checkpoint` (commit `a31c554`). Never move, reset or delete them; keep working on `feature/fourrealities-research-build`.

The worktree has no git remote. You cannot push. Do not touch the main checkout `gemini-earning/`; other sessions have uncommitted work there.

## 2. Hard rules (from the owner's agent definition; do not break them)

1. Never write a property key that LedgerSeal (`ledgerseal-cert`) or DefinitionGuard (`definitionguard-dod`) owns, on any issue. Never click "Seal Issue", "Complete DoD", "Explain: No Code Change" or "Link Decision" in those apps.
2. Do not change `apps/ledgerseal` or `apps/definitionguard`. Do not create `packages/integrity-contract`.
3. Deploy only with `forge deploy -e development`. Never staging, never production. Never publish to the Marketplace. Never change the live listing.
4. Live writes go only to `[FR-PROBE]` issues labelled `fr-probe` (today: AUDT-1). Do not open sealed issues for writing. Do not repair DEMO-26. Record every write (time, action, result) in `round-log.md`.
5. Never delete data (issues, keys, files) permanently. Ask the owner instead.
6. Do not add an npm dependency, change a manifest scope, or migrate KVS data without the owner's approval on the backlog item. Do not run `npm install` (`apps/fourrealities/node_modules` is a link to `../ledgerseal/node_modules`). If a test needs `jest-environment-jsdom` or `@testing-library`, stop and ask.
7. Do not send the owner's email address or any credential to any service. Do not sign up for trials that ask for payment details. Do not post in forums or contact vendors.
8. Git: `git commit -F <file>`; message `type(fourrealities): summary`, a body that describes the final state (not what was wrong), and a `Refs:` trailer. Never add a `Co-Authored-By` line. Do not merge, do not push master, do not force-push, do not tag.
9. Every source file starts with the Asymm Systems copyright and `@author Fahim Farook` (the architecture test checks it).
10. Plain English, no marketing words, no em dashes, in code text, docs and messages.

## 3. How to build, test and deploy

The shell runs inside a VS Code Flatpak sandbox. Node, npx and forge run on the host through `flatpak-spawn --host`.

- Type check and tests: `~/.cache/gemini-earning-fourrealities-research/run.sh --coverage` (runs `npx tsc --noEmit` and jest on the host). Expect `TSC_OK` and all tests passing.
- Graders: `~/.cache/gemini-earning-fourrealities-research/graders.sh` (tdd, security, ui must PASS).
- Coverage: `jest.config.js` enforces 90% per file on every metric. Keep it.
- Harness: `flatpak-spawn --host bash -c "cd ~/.cache/gemini-earning-fourrealities-research/harness && FR_OUT=<name>.json /home/fahimfarookme/Documents/projects/gemini-earning/apps/ledgerseal/node_modules/.bin/jest -c jest.config.js resolver-after"`; results in `harness/results/`.
- Lint: `cd apps/fourrealities && flatpak-spawn --host bash -lc "cd $PWD && forge lint"`.
- Deploy: `cd apps/fourrealities && flatpak-spawn --host bash -lc "cd $PWD && forge deploy -e development --non-interactive"`. The CLI warns about the host Node version; it still works.
- Work test-first: write the test, run it and see it fail, then implement. Record each item in `round-log.md` (tests, result, coverage, graders, commit) and mark it DONE in `backlog.md`.

## 4. Architecture you must keep (ADR-002, checked by `test/architecture.test.ts`)

- `src/contract` (interfaces and data types), `src/engine` (pure rules), `src/accessor` (Jira, KVS and Forge platform access; the only place that imports `@forge/api` or `@forge/kvs`), `src/manager` (use cases, call only contracts), `src/index.ts` (resolvers and the one `compose()` wiring point; the only file that imports `default-*` implementations).
- `src/ui` holds pure UI logic (no React); `src/frontend` holds React components only (no exported logic functions).
- No `any` type in `src`. No `NODE_ENV` branch.

## 5. Current state (2026-11-01, end of the Claude session)

- All 346 tests pass; coverage at least 90% per file (about 99.7% of statements overall); graders PASS; `forge lint` clean.
- Development deploy: version 3.8.0.
- Done: B-01 to B-25, B-29 to B-32, B-23 (licensing, owner chose "B"), L3-1 (a Jira administrator may also approve, owner chose "1B"), L3-4 (lozenge width), open point 8 (the daily snapshot checks the licence), open point 7 (harness timing), B-33 to B-40 (UX redesign from the approved consultation review), and the fixes found live. Details per item are in `round-log.md`.
- Blocked: B-26 to B-28 (they need signed v2 properties from LedgerSeal and DefinitionGuard, which this app must not change).
- AUDT-1 is Done, label `fr-probe`, with a remote link, withdrawn exception events and one rework note. Ten writes are listed in `round-log.md`.

## 6. Remaining work, in order

### 6.1 Update spec v2 for B-33 to B-40 (DONE in `d6aab3b`; review it only)
`docs/spec/fourrealities-spec-v2.md` has no text for the pipeline, the cards, the alignment box, the risk and preset filters, the compact issue-context view, Inspect navigation or "Why n%?". Add a "Dashboard and panel layout (B-33 to B-40)" section that states what `src/ui/pipeline.ts`, `src/ui/filters.ts`, `src/frontend/project-dashboard.tsx`, `src/frontend/issue-panel.tsx` and `src/frontend/gate-row.tsx` do. State the H5 decision: gate cards come before the alignment box. Remove or update the line "The count reads Showing n of m issues" only if it changed (it did not). Grep the spec for "RAI" and "Show Intent missing" and fix stale text.

### 6.2 Update `final-report.md` (DONE, section 6; keep it current)
Add the post-report work (see the last two sections of `round-log.md`) and the current open points (section 7 below).

### 6.3 B-42: "Request retrospective review" (approved)
In the issue panel, when Code is FOUND with reason `PR_MERGED`, offer "Request retrospective review". It opens a dialog with a comment text field (15 to 1,000 characters) and posts a Jira comment as the user: `POST /rest/api/3/issue/{issueId}/comment` with an ADF body. Scope `write:jira-work` is already granted. Put the call in `DefaultForgeJiraIssueAccessor`, the input rule in `DefaultPolicyEngine`, the use case in a Manager, a resolver `requestReview` in `src/index.ts` (with the licence check and `withRow`). Never claim a review happened. Test it in jest, then live on AUDT-1 only (record the write).

### 6.4 B-41: Confluence page search in the link dialog (approved, but it changes a scope)
It needs a Confluence read scope (check the current Forge scope name for "search Confluence content", for example `read:confluence-content.summary` or `search:confluence`, in the Forge docs) and `requestConfluence` from `@forge/api`. Steps: add the scope to `manifest.yml` (the manifest test checks scopes; update it), add a Confluence Accessor, add a resolver that searches pages by title as the user, and show the results as a `Select` in `LinkDecisionModal` that fills the address and title. After deploy, the development install needs `forge install --upgrade` to accept the new scope; that is a consent on the owner's site, so ask the owner before you run it, and say exactly what scope it adds.

### 6.5 Checks that need a person or another account (hand back with exact steps)
- Fast human typing in a dialog text field: the browser tool cannot type at human speed. Ask the owner to open `https://asymmsystems.atlassian.net/browse/AUDT-1`, open the "Reality Alignment" panel, click "Request Code exception", type a sentence quickly into "Reason", and say whether every character appears. Then click Cancel.
- A real approval: a second person who holds "Administer projects" on AUDT, or is a Jira administrator, must click "Approve exception" on a request the owner made.
- HeroCoders checklist (B-25): needs the "Checklists for Jira" app installed on a test site. Installing an app accepts its terms; ask the owner first.

### 6.6 Owner decisions still open
- Merge to master and push (no remote exists).
- Production deploy and the Marketplace listing (forbidden for agents).
- D-7 in the spec: a move inside one status category is not a rework loop.

## 7. Pitfalls already found (save yourself the time)

1. The `@forge/api` `route` tag rejects interpolated values that contain `/`, `?` or `#`. Build routes at the call site; query values are URL-encoded (a comma becomes `%2C`).
2. UI Kit `Stack` stretches its children: wrap lozenges in a `Stack` with `alignInline="start"` or they become full-width bars.
3. Browser automation typing into Forge UI Kit text fields keeps only the last character of a burst. Fill a field with one input event instead: in the page, take the `input` element (its id ends with the field id, for example `fr-link-url`), call the native `HTMLInputElement.prototype.value` setter, then dispatch `new Event('input', { bubbles: true })`.
4. `navigator.clipboard.writeText` from the page hangs the browser tool (permission prompt). Do not use it.
5. In tests, `JSON.stringify(renderer.toJSON())` fails on a circular tree. Use `textOf()` from `test/frontend/forge-mocks.ts`, or `renderer.root.findAll` for order checks.
6. The UI Kit mock renders `ui-<Component>` host nodes under a function component, so a host node's parent is the function instance: use `node.parent.parent` to reach the enclosing host.
7. `DynamicTable` cells, `emptyView` and `EmptyState.primaryAction` are props, not children: render them separately in tests.
8. Changelog items carry status ids; categories come from `GET /rest/api/3/status`, cached in `fr:cfg:site`. A cached config without `statusCategories` is read again.
9. The owner is a Jira administrator but not a project administrator on AUDT; the app accepts either permission.
10. Software-project issues do not open the "Reality Alignment" panel by default: use the issue's "View app actions" button, then "Reality Alignment". The compact view is the "Delivery Integrity" item in the issue's right sidebar.

## 8. When you finish
Run tests, graders and lint; deploy to development; check the change live on DEMO (read-only) or AUDT-1 (writes recorded); add rows to `round-log.md`; update `final-report.md`; commit. Then tell the owner, in short plain sentences: what changed, the commit, the deployed version, what you checked live, and anything left with exact steps.
