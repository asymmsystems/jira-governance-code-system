# DefinitionGuard: UX specification

- **Date:** 2026-11-01
- **Source:** `research-brief.md` in this folder (source IDs M-, N-, R-, L-, T-). Finding IDs DG-01 to DG-16 and PX-01 to PX-04 come from `docs/sdlc/portfolio-audit-2026-10-31/`.
- **Method for counts:** DefinitionGuard counts come from the code (Observed-code) and the live workflow data (Observed-live). The live panel was not opened, because a first panel load writes KVS and the entity property (Observed-code `index.ts:153-168`). Competitor counts come from vendor documentation (Reported) as counted by the research notes. A click count from documentation is Inferred: docs rarely show every click. No free trial was used.
- **Part B** added an "After" column to sections 1 and 3 (2026-11-01). After counts come from the built code and its tests; live checks are recorded in `round-log.md`.

## 1. Benchmark (baseline)

Legend: **C** clicks, **K** keystrokes (typing excluded unless stated), **Adm** admin needed, **Mod** modal or confirm step. "Not possible" means the product has no feature for the task (source given).

| # | Task | DefinitionGuard baseline | DefinitionGuard after build (B-01 to B-21; counts from the code, live check in round-log) | TitanApps Pro | HeroCoders Pro / Ent | Appbox | SolDevelo | Native Jira |
|---|---|---|---|---|---|---|---|---|
| 1 | Install and get the first blocked transition | About 12 C (install about 3, attach validator about 8, one transition attempt 1), Adm yes, Mod no. No template step. Inferred from Observed-code `manifest.yml:11-15` and N-30. Live: no workflow has the validator (L-01) | About 3 C to install plus about 8 C per transition to attach (still manual: no supported API, H11). The settings page lists which completion transitions lack the gate (B-17). No template step needed. Adm yes | About 14 steps, needs Pro (M-50, M-31, M-30). Adm yes | About 8 to 9 steps; items mandatory by default (M-60, M-63). Adm yes | About 7 steps (M-80). Adm yes | About 7 steps, global admin (M-90). Adm yes | Not possible for "all mandatory items" (N-38) |
| 2 | Team DoD with mandatory and optional items for one issue type | Not possible (DG-04). Only 6 fixed templates chosen by issue-type name (Observed-code `checklist-engine.ts:266-301`) | Settings page (B-06): choose issue type 1 C, name (typing), per item: type title + 1 C "Add item", then Mandatory, Evidence required, Not the assignee, permission, category as needed; "Save template" 1 C. About 4 C per item. Project admin only | Template per project and issue type, admin (M-38, M-36). Count Unknown | Space admin sets defaults (M-66, M-77). Count Unknown | JQL auto-assign, project admin (M-83, M-84). Count Unknown | Issue type or JQL, admins (M-94, M-93). Count Unknown | Not possible (N-36) |
| 3 | Attach the gate to every move into Done, and find the ones without it | Manual, per transition: 8 transitions in 3 workflows on DEMO (L-06), so about 8 x 8 = 64 C. No check for missing ones (DG-07). Adm yes | Attach: manual, about 8 C per transition. Find the gaps: 0 C, the settings page shows "N of M completion transitions are gated" and lists each missing one, exempt statuses excluded (B-10, B-17) | Manual per transition (M-30). No check found (Unknown) | Manual per transition (M-60). No check found (Unknown) | Manual (M-80). Unknown | Manual (M-90). Unknown | Manual (N-30) |
| 4 | Tick a mandatory item and attach evidence | Tick: 1 C. Evidence: not possible (DG-11) | Evidence-required item: 1 C on the checkbox opens the form, type a link or note, 1 C "Save and tick" = 2 C. Other items: "Tick with evidence" 1 C, type, 1 C. No modal (B-11) | Links and details in items (M-05, M-100). Count Unknown | Description and URLs (M-63). Count Unknown | Links (M-87). Count Unknown | Unknown | Action items in text fields (N-33) |
| 5 | Move to Done with one open mandatory item: what the user sees | Jira shows the validator message, which names the items: "Definition of Done incomplete: 1 mandatory item(s) must be satisfied before transition. Pending items: ..." (T-05, Observed-code `transition-validator.ts:44-51`). Live: not seen, no validator attached (L-01). Panel shows a count only (DG-15) | Validator message names every open mandatory item and says to open the DefinitionGuard panel; moves into non-Done or exempt statuses pass; any error blocks (B-01, B-10). Panel shows the same rule and names the items (B-13). Live on DEMO-35: blocked with 3 named items, then allowed after they were done (round-log, Loop 3) | Error message, custom text possible (M-30). Names items: Unknown | Unknown | Unknown | Probably generic (M-90, Inferred) | Validator message (N-01); a condition hides the transition with no reason (N-47) |
| 6 | Waive an item with a reason, authorised role only | Not possible (Observed-code `models.ts:35`) | "Waive" 1 C, reason (10 to 500 characters), "Waive item" 1 C = 2 C. Needs the template waiver permission (default Administer projects); reason kept in history (B-12) | Unknown; "Skipped" status (M-32) | Unknown; "skipped" (M-72) | Unknown | Unknown | Not possible (Inferred, N-30) |
| 7 | Prove later who ticked what, when, with what evidence; export | Panel: 1 C "Audit Trail". Shows rewritten names (T-12), item ids not titles, UTC times (DG-15). No evidence. No export | "History" 1 C: each change with item title, user (UI Kit User), local time, evidence, waiver reason, and the chain check with its limit (B-05, B-15). "Export history" 1 C: JSON to copy, project admins only | History tab (M-35). Acting user in Jira history "Coming soon" (M-48) | History tab, PDF export; admins can clear it (M-68) | History must be switched on (M-82) | Hover shows last action only (M-91, M-92) | Issue history; Action items Unknown |
| 8 | Change the template; effect on open issues | Not possible; open issues never change (DG-12) | Save a new template revision: open issues keep their revision; "Re-sync open issues" 1 C updates them, keeping ticks on unchanged items (B-16) | Snapshot; Linked Templates propagate (M-39) | Pro: copy (M-67). Ent: global checklists reach open issues, not Done ones (M-67) | Unknown | No effect on existing issues (M-95) | Not applicable |
| 9 | Tasks 4 and 5 by keyboard only, and with a screen reader | Tab to the UI Kit Checkbox, Space to tick (Inferred: ADS checkbox). The MANDATORY lozenge is outside the checkbox label, so a screen reader reads the title without "mandatory" (Inferred, Observed-code `index.tsx:167-179`). Not tested live | Each checkbox accessible name includes mandatory or optional and its state, for example "Peer review approved (mandatory, open)" (B-13). Keyboard and screen reader not yet checked live | Keyboard shortcuts (M-45) | "screen-reader compatible" listing claim (M-13) | Unknown | Unknown | Jira transition dialog keyboard support: Unknown |

## 2. Target interactions

Rules for every task: the validator decides from app storage only, never from the `definitionguard-dod` property. It fails closed and names pending items on any error. Names are rendered from accountIds at view time with the UI Kit `User` component (R-06). Times show in the viewer's locale.

| # | Task | Who | Target steps | Message text | Keyboard path |
|---|---|---|---|---|---|
| 1 | First blocked transition | Jira admin | (1) Install. (2) The project settings page shows "Gate coverage: 0 of 5 completion transitions are gated" with a list and a "How to add" link per transition. (3) Admin adds the validator in the workflow editor (manual: H11, N-05). (4) Page shows "5 of 5 gated". First block: user moves the issue to Done. Target: install plus 8 C per transition, no guessing which ones | Settings: "DefinitionGuard is not on these transitions yet. Issues can reach Done through them without the checklist." | Settings page list is a table; each row link is reachable by Tab |
| 2 | Team DoD template | Project admin (ADMINISTER_PROJECTS, checked with `asUser()`) | Settings page, "Templates" tab: pick issue type, add item (title, mandatory yes or no, evidence required yes or no, required role, "not the assignee"), Save. Target: 4 C per item plus typing | On save: "Template 'Bug DoD' version 3 saved. 12 open issues use version 2. Re-sync them?" | Form fields in DOM order; Enter submits; Escape cancels |
| 3 | Gate coverage | Jira admin | Same page as task 1. Coverage is recomputed on each view (read only) | "2 transitions into Done have no DefinitionGuard gate: 'Close' in Service Request workflow ..." | Table rows by Tab |
| 4 | Tick with evidence | Anyone with Edit issues on the issue, plus the item's required role | Click the checkbox. If the item needs evidence, an inline field opens: link or note (max 500 characters), Save. Target: 2 C plus typing. No modal | If evidence is missing: "Add a link or a note. This item needs evidence before it counts as done." | Tab to checkbox, Space; focus moves to the evidence field; Enter saves; Escape cancels and leaves the item open |
| 5 | Blocked move | Any user | Move to Done. Jira shows the validator message. The panel shows the same rule (shared module, DG-14) | Jira: "Definition of Done is not complete. Open mandatory items: Peer review approved; Security scan clear. Open the DefinitionGuard panel on this issue to finish them." Panel: SectionMessage warning "2 mandatory items are open: Peer review approved, Security scan clear." On storage error: "DefinitionGuard could not read the checklist, so this move is blocked. Try again. If it keeps failing, ask your Jira admin." | Not applicable (Jira dialog) |
| 6 | Waive with a reason | Role named in the template (default: project admin) | Item menu "Waive", inline reason field (required, 10 to 500 characters), Confirm. The item shows "Waived" with who, when and why. A waiver counts as done for the gate. Target: 3 C plus typing | "Only a project admin can waive this item." for others | Tab to the item menu button, Enter, type reason, Enter |
| 7 | Prove later | Anyone who can view the issue; export for project admins | Panel "History" (1 C): each event shows item title, action, `User`, local time, evidence, and the chain check result. "Export" (1 C) gives a JSON record with the verification result | Chain check: "History checked: 37 events, chain intact." or "History check failed at event 12. Contact your admin." | Tab to History, Enter; events are a list |
| 8 | Template change | Project admin | Save a new version (task 2). Open issues keep their version until an admin runs "Re-sync". Re-sync keeps ticks on unchanged item ids and writes one audit event per issue | "Re-synced 12 issues to version 3. Ticks kept on unchanged items." | As task 2 |
| 9 | Keyboard and screen reader | All | Each checkbox label includes the state words: "Peer review approved (mandatory, open)". Lozenges repeat the state visually only | Not applicable | Tab order: status message, items in order, History, Refresh. No keyboard trap |

## 3. Scale baseline and budgets

Harness: `~/.cache/gemini-earning-definitionguard-research/harness/` (T-01 to T-13), mocked `asApp()` and `asUser()` as separate mocks, storage mock that serialises on every call. Bytes are UTF-8 JSON bytes of the stored value. Real KVS rejects any value above 240 KiB (N-11), so values above that line are what the code would try to write.

### 3.1 Largest stored value (bytes)

Baseline: the v1 record `dg:checklist:<issueId>`, no notes. After: the largest single value of the v3 layout, which is the state cache or one change-log entry (`harness/results/after-all.json`). The Create entry carries every criterion, so it sets the size; toggles no longer grow any value.

| Items | Baseline 10 / 100 / 1,000 toggles | Baseline toggles to pass 32 KiB / 240 KiB | After 10 / 100 / 1,000 toggles | After toggles to pass 32 KiB / 240 KiB |
|---|---|---|---|---|
| 6 | 5,657 / 42,998 / 296,501 (over the limit) | 76 / 817 | 3,766 / 3,766 / 3,766 | never / never |
| 20 | 8,873 / 47,423 / 347,095 (over the limit) | 67 / 623 | 10,662 / 10,662 / 10,662 | never / never |
| 50 | 13,439 / 49,780 / 421,301 (over the limit) | 45 / 564 | 25,458 / 25,458 / 25,458 | never / never |

With 500-character notes and evidence, 6 items: baseline 8,859 / 45,940 / 299,441 bytes; after 3,766 at every count (evidence lives in its own change entry, 2 KiB or less, B-11). The size-budget test with 50 items and 200-character titles keeps every value at 32 KiB or less (`test/storage/size-budget.test.ts`).

### 3.2 Calls per operation

| Operation | Baseline Jira calls | Baseline KVS | After Jira calls | After KVS | Source |
|---|---|---|---|---|---|
| Panel load, existing record, names resolve | 0 | 1 get | 0 | 2 gets (state and head probe), 0 sets | T-02, after-all |
| Panel load, user lookup failing, 6 items after 200 toggles | 154 user lookups (every load) | 1 get | 0 (no user lookup exists) | 2 gets | T-03, after-all |
| First panel load, new issue | 2 (issue, property PUT) | 1 set | 1 (issue lookup, only when the context lacks the ids) | 0 sets | T-02, after-all |
| Toggle | 2 (user lookup, property PUT) | 1 get, 1 set | 2 (permission check as the user, property PUT); +1 assignee read for a not-the-assignee item | 3 gets, 1 FAIL_IF_EXISTS set, 1 set | after-all, `test/jira/jira-client.test.ts` |
| Validator, record exists | 0 | 1 get | 0 when satisfied; 1 status lookup when not; +1 issue read for a not-the-assignee item | 2 gets | gate-rule and validator tests |
| Validator, no record | 1 (issue) | 1 get, 1 set | 0 to 2 (issue ids when the context lacks them, then the status) | 3 gets, 0 sets | T-05, after-all |
| Two concurrent ticks | 1 of 2 kept | | 2 of 2 kept | | T-09, after-all |

### 3.3 Budgets for Part B (all met in the harness and the tests)

| Measure | Budget | Why |
|---|---|---|
| Largest single KVS value, any number of toggles, 50 items | 32 KiB or less | 240 KiB hard limit (N-11), with margin |
| One audit event value | Change events: 2 KiB or less (500-character evidence included). CREATED, MIGRATED and RESYNC events carry the item list: 32 KiB or less (corrected in B-04) | Many events per transaction (25 operations, N-12) |
| Panel load Jira calls | 0 user lookups; 1 or fewer calls in total | Names come from `User` (R-06); point quota (N-22) |
| Panel load KVS reads | 1 state get plus 1 query page of at most 100 events (N-14) | Query maximum 100 |
| Toggle Jira calls | 2 or fewer: 1 permission check, 1 property PUT | `/mypermissions` with the issue key (N-20) |
| Validator | 0 KVS writes; Jira calls 1 or fewer (status category); blocks on every error | DG-08; runtime limit 25 s (N-10) |
| Concurrent ticks | 2 of 2 kept, 2 events, in the T-09 harness | DG-05 |
| Entity property | 32,768 characters or less (N-21); written on every change | DG-10 |

## 4. ADS and WCAG 2.2 AA gaps

| ID | Gap | Standard | Finding | Evidence |
|---|---|---|---|---|
| UX-01 | GATE LOCKED uses `inprogress` (blue); a blocked state needs `removed` (red) or `moved` with a clear label | ADS lozenge semantics | DG-15, audit verdict row 17 | Observed-code `index.tsx:128` |
| UX-02 | MANDATORY uses `moved` (yellow), which ADS uses for change, not for importance | ADS lozenge semantics | DG-15 | Observed-code `index.tsx:176` |
| UX-03 | The panel shows internal text: "(D-13)", "v3", a 16-character hash fragment | Clutter | DG-15 | Observed-code `index.tsx:134,159,237` |
| UX-04 | The warning gives a count, not the open item names | WCAG 3.3.1 Error Identification (Inferred applicability) | DG-15 | Observed-code `index.tsx:125` |
| UX-05 | "Workflow transitions are blocked" shows when no validator exists | Honest status | DG-07 | Observed-code `index.tsx:125`, L-01 |
| UX-06 | Mandatory state is not part of the checkbox's accessible name | WCAG 1.3.1 Info and Relationships, 4.1.2 Name, Role, Value | new | Observed-code `index.tsx:167-179`, Inferred |
| UX-07 | Audit trail shows item ids, not titles, and UTC ISO times | Readability | DG-15 | Observed-code `index.tsx:86,228` |
| UX-08 | Errors show raw `err.message` with no next step | WCAG 3.3.3 Error Suggestion | DG-15 | Observed-code `index.tsx:40,59,76` |
| UX-09 | Audit trail is a list of bullet strings in `Text`, not a list structure | WCAG 1.3.1 | DG-15 | Observed-code `index.tsx:226-230`, Inferred |
| UX-10 | Focus order and contrast: UI Kit components and `space.*` tokens only, no hex | ADS tokens, WCAG 1.4.3 | none (pass, Inferred) | Observed-code `index.tsx` (no hex literal) |
| UX-11 | Panel and validator disagree with zero mandatory items | One rule | DG-14 | T-08 |
| UX-12 | The UI has no tests; coverage excludes `src/frontend/**` | Testability | PX-03 | Observed-code `jest.config.js:9` |
