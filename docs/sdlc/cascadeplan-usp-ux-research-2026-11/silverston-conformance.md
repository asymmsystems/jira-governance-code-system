# CascadePlan: WorkEffort model conformance audit (Silverston pattern)

Date: 2026-11-01. Requested by the owner after B-15 ("Did you check if the model follows Silverston patterns?").

## 1. Reference and limits

- **Book not read.** I do not have *The Data Model Resource Book* (Len Silverston). The reference is Apache OFBiz, whose data model was built from that book: "finding The Data Model Resource Book, Revised Edition, Volumes 1 and 2 by Len Silverston" (RS-13, `sources/team-size-silverston-forge.md`).
- **Files read in full** (downloaded 2026-11-01, kept in `~/.cache/gemini-earning-cascadeplan-research/sources/ofbiz/`):
  - `ofbiz-framework` trunk `applications/datamodel/entitydef/workeffort-entitymodel.xml`;
  - `applications/datamodel/data/seed/WorkEffortSeedData.xml`;
  - `applications/workeffort/data/WorkEffortTypeData.xml`;
  - `ofbiz-plugins` trunk `projectmgr/data/ProjectMgrTypeData.xml`.
- **Our side:** `apps/planshift/src/domain/models.ts` (WorkEffort section), `src/storage/plan-store.ts`, `src/index.ts`, and spec section 3.1.
- **Where the book could differ from OFBiz,** I say so. Each such point is marked "OFBiz only".

## 2. The reference pattern (OFBiz)

| Element | OFBiz definition |
|---|---|
| `WorkEffort` | Key `workEffortId`. Fields include `workEffortTypeId`, `currentStatusId`, `workEffortParentId`, `percentComplete`, `estimatedStartDate`, `estimatedCompletionDate`, `actualStartDate`, `actualCompletionDate` and `estimatedMilliSeconds`. |
| `WorkEffortAssoc` | Key `workEffortIdFrom` + `workEffortIdTo` + `workEffortAssocTypeId` + `fromDate`. Other fields: `sequenceNum`, `thruDate`. An association is time-bound and is ended by setting `thruDate`. |
| `WorkEffortAssocType` | `WORK_EFF_BREAKDOWN` (Breakdown/Detail) and `WORK_EFF_DEPENDENCY`, with the subtypes `WORK_EFF_PRECEDENCY` and `WORK_EFF_CONCURRENCY`. Also `WORK_EFF_TEMPLATE` and `ROUTING_COMPONENT`. |
| `WorkEffortAssocAttribute` | `attrName`, `attrValue` and `attrDescription` per association. This is the pattern's place for extra facts about a link. |
| `WorkEffortPartyAssignment` | Key `workEffortId` + `partyId` + `roleTypeId` + `fromDate`. Other fields: `thruDate`, `statusId` (`PRTYASGN_OFFERED`, `PRTYASGN_ASSIGNED`, `PRTYASGN_UNASSIGNED`). |
| `WorkEffortType` | `PROGRAM`, `PROJECT`, `PHASE`, `TASK`, `MILESTONE`, `ACTIVITY` ("Workflow Activity"), `WORK_FLOW`, `TEMPLATE` and others. There is no `EPIC`. |
| Status | Project: `WEPR_PLANNING`, `WEPR_IN_PROGRESS`, `WEPR_ON_HOLD`, `WEPR_COMPLETE`, `WEPR_CANCELLED`. Project task: `PTS_CREATED*`, `PTS_ON_HOLD`, `PTS_COMPLETED`, `PTS_CANCELLED`. |
| Estimate | No separate estimate entity. The estimate is a set of fields on `WorkEffort` (`estimatedMilliSeconds`, `estimateCalcMethod`), plus `WorkEffortSkillStandard` (OFBiz only). |

## 3. Findings

**Legend:**
- **Error**: breaks the pattern with no recorded reason, or stores something the pattern says not to store.
- **Extension**: adds to the pattern in the pattern's own way. Keep it, and document it.
- **Deliberate**: a recorded decision, such as INV-04 (Jira owns this data).

| # | Area | Our model | Pattern | Verdict |
|---|---|---|---|---|
| F1 | Hierarchy | Not stored. Taken live from Jira `parentKey` and `epicKey`. `WORK_BREAKDOWN` and `workEffortParentId` are declared but used 0 times in `src/`. | `workEffortParentId` and `WORK_EFF_BREAKDOWN` associations. | **Deliberate** for the hierarchy (Jira owns it, INV-04), but it is not written down. **Error** in one place: `updateWbsTask` stores the parent's rolled-up dates in KVS. A roll-up derived from the breakdown should be computed on load, not stored (INV-04, "computed progress is not stored"). |
| F2 | Link type | One flat type `FRACTIONAL_MILESTONE`. `PRECEDENCE` and `DEPENDENCY` are declared but never used. | `WORK_EFF_DEPENDENCY` with the subtypes `WORK_EFF_PRECEDENCY` (finish-to-start) and `WORK_EFF_CONCURRENCY` (start together). | **Error** in naming and hierarchy. The percent trigger is a real extension: X = 100 is precedency, X = 0 is concurrency, and anything between is a partial precedency. The pattern-conformant form is `WORK_EFF_PRECEDENCY` with the trigger stored as an association attribute (F3). |
| F3 | Link facts | `triggerPercent`, `jiraLinkId`, `isTriggerSatisfied`, `isViolated`, `violationReason` and `lagTimeDays` are fields on the association. The stored record always writes `isTriggerSatisfied: false`. | Extra facts go in `WorkEffortAssocAttribute` (`attrName`/`attrValue`). | **Extension** for `triggerPercent` and `jiraLinkId`: keep them, as attributes. **Error** for `isTriggerSatisfied`, `isViolated` and `violationReason`: these are engine outputs, computed on every load (INV-09), and should not be part of the stored entity. `lagTimeDays` is unused. |
| F4 | Link lifetime | No `fromDate`/`thruDate`. A removed link is deleted, and the separate flag `precedenceRemoved` stops a Jira link from bringing it back. | `fromDate` is part of the key; a link ends by setting `thruDate`. | **Error.** The pattern already solves the problem that `precedenceRemoved` works around: an ended link (with `thruDate`) stays as a record, so it is not re-imported. It also gives history for undo and audit. |
| F5 | Several predecessors | The view model has one `dependency`. `fromWorkEffortRecord` takes the first association only (`.find`). | Any number of associations into one effort. The engine already handles several predecessors (spec 3.3 item 5). | **Error** (a gap between layers). The model and the engine allow many links; the stored-to-view conversion silently drops all but one. |
| F6 | Second people | `parties` entries have `partyId: ''` and only a `displayName`. Spec 3.1 says `partyId` is the account id, with `subtaskKey`. | Key `partyId` + `roleTypeId` + `fromDate`. | **Error.** A party identified only by display name breaks when a name changes or two people share a name. B-19 ("second person" through a Jira sub-task) depends on this. |
| F7 | Role types | `PRIMARY_ASSIGNEE`, `CONTRIBUTOR`, `QA_LEAD`, `REVIEWER`, `STAKEHOLDER`. Only `CONTRIBUTOR` is ever written. | `RoleType` can be extended; OFBiz adds `PROJECT_TEAM` and its subtypes. | **Extension** for `CONTRIBUTOR`. The 4 unused roles are dead values. The primary assignee is Jira-owned and correctly not stored. |
| F8 | Estimate | A separate `WorkEffortEstimate` (`estimateUnit`, `rawEstimate`, `normalizedHours`, buffer), plus `estimateExtras`. | Estimate fields on `WorkEffort` (OFBiz only). | **Extension.** Mixed units (story points, T-shirt sizes) have no home in the pattern. A separate estimate record is a reasonable extension. I have not checked whether the book has one. B-20 decides whether this claim stays. |
| F9 | Effort types and status | `EPIC` type; invented status codes (`WE_PLANNED` and others). Used only by `toWorkEffort`/`fromWorkEffort`, which production code never calls (0 uses in `src/`; tests only). | No `EPIC`; `WEPR_*` / `PTS_*` status codes. | **Error (dead code).** Status and type are Jira-owned and never stored (INV-04), so nothing depends on these values. The converters and the invented values should be removed or aligned. Spec 3.2 claims they round-trip the stored fields; in fact the stored form uses `toWorkEffortRecord`. |
| F10 | Row order | `sequenceNum` is on the effort. | `sequenceNum` is on the association: the order of children within a breakdown. | **Deliberate** consequence of F1, since no breakdown association is stored. Document it. |
| F11 | View data in the record | `grid` (`startWeek`, `spanWeeks`, `weeklyAllocations`, `isBacklog`, `localSubtasks`) is stored with the effort. | Not part of the pattern. Allocation of people over time belongs to party assignment and time entry. | **Extension** for `isBacklog` (plan membership). **Error** for the week fields: they repeat what the exact dates already say (B-13 moved to exact dates), and `localSubtasks` are the KVS-only sub-tasks that B-18 removes. |

## 4. What follows for the remaining backlog

- **B-19 (second person)** needs F6. The work should not be built on display names.
- **B-18 (cleanup)** naturally takes F9 (dead converters and values), F11 (week fields, `localSubtasks`) and F7 (unused roles).
- **B-20 (estimation unit)** is where F8 is decided.
- **F1 (stored roll-up), F2 to F5 (link model)** change the stored KVS record. Under the brief, that is a `[MIGRATE]` change and needs owner approval. The approved `[MIGRATE]` flag covered the B-09 per-issue migration, not this one.

## 5. Proposed target, if approved

1. **Links.** Use `workEffortAssocTypeId: 'WORK_EFF_PRECEDENCY'` (a subtype of `WORK_EFF_DEPENDENCY`). Store `attrs: { triggerPercent, jiraLinkId }` as association attributes, plus `fromDate` and an optional `thruDate`. Do not store engine outputs. A removal sets `thruDate`, and `precedenceRemoved` goes away.
2. **Several predecessors.** The view model gets `dependencies[]`, keeping `dependency` as the first entry for the existing UI until the UI shows several.
3. **Parties.** `partyId` = Atlassian account id, `roleTypeId: 'CONTRIBUTOR'`, `fromDate`, and an optional `subtaskKey`.
4. **Roll-up.** Parent dates are derived on load from the children (breakdown from Jira), never stored.
5. **Migration.** A one-time, idempotent migration of existing `cp:<projectId>:we:<issueId>` records to the new shape, under the version check, with a test that reads old records unchanged. It deletes nothing until the new record is written.
6. **Cleanup.** Remove `toWorkEffort`/`fromWorkEffort`, the unused types, statuses and roles, and correct spec 3.1 and 3.2 to match.
