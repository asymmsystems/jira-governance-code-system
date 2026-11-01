# ADR-01: LedgerSeal data model on the Silverston WorkEffort, Party and Status patterns

- **Date:** 2026-11-01
- **Status:** Approved by the owner on 2026-11-01 (in chat: "approve"). Built as B-21 before B-12.
- **Context owner:** Fahim Farook
- **Applies to:** `apps/ledgerseal` storage and domain model, `docs/spec/ledgerseal-spec-v2.md` sections 3 and 6 (decision D-10)

## 1. Context

The owner asked whether the LedgerSeal model follows Silverston patterns. It does not.

B-02 to B-11 built an event-history design of my own:
- one current seal record per issue (`ls2:seal:{issueId}`, type `SealRecord`);
- one history entry per event, created once and chained by hash (`ls2:entry:{issueId}:{seq}`, type `HistoryEntry`);
- the sealed snapshot, stored in parts (`ls2:snap:{certificateId}:{part}`).

CascadePlan, in the same repository, stores its data as Silverston WorkEffort records by owner decision. Its types are `WorkEffort`, `WorkEffortAssoc`, `WorkEffortPartyAssignment` and `WorkEffortEstimate` (`apps/planshift/src/domain/models.ts:310-375`, commit `97779fc`). The two apps describe the same Jira issue, so they should use one vocabulary.

Three remaining items would fix the current model in place:
- B-14 publishes it as the evidence export format.
- B-17 splits it across KVS keys.
- B-13 defines the canonical form an outside verifier rechecks.

So the decision is needed now.

No v2 record exists on any Jira site yet. The deployed app is still v1. A model change now needs no migration of v2 data. v1 records stay read-only (D-3).

## 2. Sources

| ID | Source | What it gives |
|---|---|---|
| SV-01 | Apache OFBiz `applications/datamodel/entitydef/workeffort-entitymodel.xml`, trunk commit `f1865809bb72b79f93caaff2dd91b0532b43f5e6`, read 2026-11-01 | `WorkEffort`, `WorkEffortStatus`, `WorkEffortPartyAssignment`, `WorkEffortContent`, `WorkEffortAttribute`, `WorkEffortReview` |
| SV-02 | Same commit, `party-entitymodel.xml` | `Party`, `PartyRole`, `RoleType` |
| SV-03 | Same commit, `framework/common/entitydef/entitymodel.xml` | `StatusItem`, `StatusType`, `StatusValidChange` |
| SV-04 | Same commit, `content-entitymodel.xml` | `Content`, `ContentRevision` |
| RS-13 | OFBiz project overview (CascadePlan research) | OFBiz chose its data model after "finding The Data Model Resource Book ... by Len Silverston" |

- **Grade:** Reported (secondary). OFBiz is a Silverston-derived implementation. The book itself is paywalled and was not read.
- The entity and field names below are taken from SV-01 to SV-04, not from memory.

## 3. The entities that fit (from SV-01 to SV-04)

| OFBiz entity | Primary key | Fields used here |
|---|---|---|
| `WorkEffort` | `workEffortId` | `workEffortTypeId`, `currentStatusId`, `lastStatusUpdate`, `sourceReferenceId`, `revisionNumber` |
| `WorkEffortStatus` | `workEffortId`, `statusId`, `statusDatetime` | `setByUserLogin`, `reason` |
| `WorkEffortPartyAssignment` | `workEffortId`, `partyId`, `roleTypeId`, `fromDate` | `thruDate`, `statusId`, `comments` |
| `WorkEffortContent` | `workEffortId`, `contentId`, `workEffortContentTypeId`, `fromDate` | `thruDate` |
| `WorkEffortAttribute` | `workEffortId`, `attrName` | `attrValue` |
| `Party`, `PartyRole`, `RoleType` | `partyId`; `partyId` + `roleTypeId` | `RoleType.description` |
| `StatusItem`, `StatusType`, `StatusValidChange` | `statusId`; `statusId` + `statusIdTo` | `transitionName` |

## 4. Proposed mapping

| LedgerSeal concept today | Silverston entity | How |
|---|---|---|
| The sealed Jira issue | `WorkEffort` | `workEffortId` = Jira issue id, `workEffortTypeId` = `JIRA_ISSUE`, `sourceReferenceId` = issue key. Jira-owned fields are not stored, the same rule CascadePlan follows. `currentStatusId` and `lastStatusUpdate` hold the current seal state, as OFBiz keeps them on `WorkEffort` |
| Seal states (not sealed, sealed, changed, revoked) | `StatusType` `LEDGERSEAL_STATUS` with `StatusItem`s `LS_SEALED`, `LS_CHANGED`, `LS_REVOKED` | "Changed back" stays derived: the live hash equals the sealed hash while the current seal has an `LS_CHANGED` row |
| Allowed state changes, now spread through the code | `StatusValidChange` | A table in code: `LS_SEALED` to `LS_CHANGED` or `LS_REVOKED`; `LS_CHANGED` to `LS_SEALED` (reseal) or `LS_REVOKED`; `LS_REVOKED` to `LS_SEALED`. Any other change is refused. This makes the state machine explicit and testable |
| History entry (seal, incident, reseal, revoke) | `WorkEffortStatus` | One row per change: `statusId`, `statusDatetime`, `setByPartyId` (the Atlassian account id; null for a change the app found) and `reason`. LedgerSeal adds `seq`, `prevEntryHash` and `entryHash` for the chain, and `data` for the hashes and changed fields |
| Signer and the meaning of the signature | `Party` + `PartyRole` + `WorkEffortPartyAssignment` | `partyId` = Atlassian account id. The meaning becomes the `roleTypeId`: `LS_APPROVER`, `LS_REVIEWER`, `LS_VERIFIER`. Each seal is one assignment with `fromDate` = seal time, and `thruDate` = the time a reseal or revoke ends it. `comments` holds the reseal reason. The signer's display name is not stored as a `Party` field |
| Revoker and change authors | `WorkEffortStatus.setByPartyId`; change authors in the status row `data` | No new role is needed. Authors are facts of the change, not assignments |
| Sealed snapshot | `Content` linked by `WorkEffortContent` (`workEffortContentTypeId` = `LS_SEALED_SNAPSHOT`) | One content per seal, stored in parts. `fromDate` and `thruDate` follow the seal |
| Snapshot hash, canonical form version, covered and excluded fields, declaration version | `WorkEffortAttribute` per seal, or fields on the assignment | Attribute names: `snapshotHash`, `canonicalizerVersion`, `declarationVersion`. The covered and excluded field lists stay with the snapshot content |
| `everCompromised`, `incidentCount` | Derived from `WorkEffortStatus` rows, kept on `WorkEffort` as current values | The same rule OFBiz uses for `currentStatusId`. The record hash covers them |

Proposed KVS keys (replacing `ls2:`, which was never deployed):

| Key | Value |
|---|---|
| `ls3:we:{issueId}` | `WorkEffort` with its current values and the current assignment and content ids, plus `recordHash` |
| `ls3:wes:{issueId}:{seq}` | `WorkEffortStatus` row with the chain fields, created once |
| `ls3:wepa:{issueId}:{fromDate}` | `WorkEffortPartyAssignment` for one seal |
| `ls3:content:{contentId}:{part}` | Snapshot content part |

## 5. What does not change

- Behaviour proven by the 177 passing tests: who may seal, separation of duties, a read that never writes, one incident per change, the integrity check, the signed attestation, honest Jira failures, and the trigger.
- The `ledgerseal-cert` attestation (schema v2). It is a published summary, not the store.
- Canonical form rules (B-05, B-13) and the panel response shape.
- The trust boundary: decisions come from app storage only.

## 6. Decisions

| ID | Decision | Options | Proposal and reason |
|---|---|---|---|
| A-1 | Adopt the Silverston WorkEffort, Party and Status patterns for LedgerSeal storage | (a) adopt, as CascadePlan did; (b) keep the current model and only document a mapping | (a). The two apps describe the same Jira issue. One vocabulary lets FourRealities and CascadePlan read LedgerSeal facts without a translation layer. The cost is lowest now, because no v2 data exists |
| A-2 | Where the meaning lives | (a) `roleTypeId` of the assignment (`LS_APPROVER`, `LS_REVIEWER`, `LS_VERIFIER`); (b) an attribute | (a). In Silverston the role a party plays in a work effort is the role type, and it gives one assignment per signer and role |
| A-3 | State machine | (a) `StatusValidChange` table in code; (b) keep the current `if` branches | (a). It makes every allowed change explicit, and a test can list all pairs |
| A-4 | Hash chain on status rows | (a) keep `seq`, `prevEntryHash` and `entryHash` as LedgerSeal extensions on `WorkEffortStatus`; (b) drop the chain | (a). OFBiz has no tamper evidence. The chain is the product's reason to exist, so it stays as a stated extension |
| A-5 | Display names | (a) store only `partyId`; the panel shows names with the UI Kit `User` component; (b) store a name copy | (a). It matches B-04, and a name copy goes stale when a profile changes. The history row keeps the name at signing time as a fact of that event |

## 7. Considered and excluded

| Pattern | Why excluded |
|---|---|
| `WorkEffortReview` (SV-01) | It is a rating and text review by a `UserLogin` (`rating`, `reviewText`), not an approval with a role and a time window |
| `Agreement` and `AgreementTerm` for the declaration | The declaration is one fixed text with a version. A versioned constant plus `declarationVersion` on the assignment is enough. An agreement model would add entities with no behaviour |
| `ContentRevision` (SV-04) for reseals | Each seal is a new content with its own dates. Revisions of one content would hide which content a given seal covered |
| `WorkEffortAssoc` | LedgerSeal relates no work efforts to each other. CascadePlan owns dependencies |
| `PartyRelationship` | No party-to-party relationship is needed. Separation of duties compares account ids of change authors and the approver |

## 8. Consequences

- **Rework:**
  - B-02, B-03, B-08, B-09 and B-11: the storage layer and record type change.
  - `src/domain/models.ts`, `src/storage/seal-repository.ts`, `src/service/ledger.ts` and `src/domain/seal-record.ts` change.
  - Tests that read `ls2:` keys directly change their keys. The behaviour assertions stay.
  - Estimate: one item of size L before B-12, recorded as B-21 in `backlog.md`.
- **Spec:** spec v2 sections 3 and 6 and decision D-10 are updated. The v1 spec stays frozen.
- **B-12 to B-20 continue after B-21.** B-13, B-14 and B-17 then build on this model, not on `ls2:`.
- **Risk:** the refactor touches every resolver. The 177 behaviour tests and the T-02 probes are the safety net, and they must all pass before B-12 starts.
