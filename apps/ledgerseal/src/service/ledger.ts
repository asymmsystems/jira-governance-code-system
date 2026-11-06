/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: seal, verify and incident flows (spec v2 section 7).
 * Decisions use app storage only. The `ledgerseal-cert` property is an output, never an input.
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';
import { CANONICALIZER_VERSION, canonicalizeIssueState, FieldSchema, isExcludedField, PSEUDONYMOUS_VERSIONS } from '../domain/canonicalizer';
import { canonicalForm, computeSnapshotHash } from '../domain/crypto';
import { buildStatusRow, verifyChain } from '../domain/history';
import { CanonicalIssueSnapshot, FieldDiff, SealedWorkEffort, SealSummary, WorkEffortPartyAssignment, WorkEffortStatus, TamperAnalysis } from '../domain/models';
import { changeAuthorsSince, itemAuthorsSince } from '../domain/policy';
import { assignmentHash, isConsistent, LoadedSeal, summarise, withRecordHash } from '../domain/seal-record';
import { canChange, LedgerSealStatusId, roleForMeaning } from '../domain/status';
import { compareToSeal, SealedState } from '../domain/tamper-detector';
import { capped, LONG_VALUE_CHARS, richTextSummary } from '../domain/display';
import { AttestationSource, AttestationStatus, buildAttestation, Signer } from '../domain/attestation';
import { DECLARATION, isMeaning, matchesDeclaration, validReason } from '../domain/declaration';
import { ChangelogEntry, JiraClient } from '../jira/jira-client';
import { isPartyToken, partyFunction, PartyFn, PartySeen, pseudonymise, TOKEN_IN_TEXT } from '../domain/party';
import { newSiteKey, PartyRepository, PartyResolver } from '../storage/party-repository';
import { approverGroupNames, isApprover } from './approver';
import { convertRecord, hasConversionJournal } from './conversion';
import { HISTORY_PAGE_SIZE, MAX_CONTENT_PARTS, MAX_PART_BYTES, SealRepository, splitUtf8, StorageProvider } from '../storage/seal-repository';

export interface LedgerSealDeps {
  jira: JiraClient;
  storage: StorageProvider;
  /** Signs the ledgerseal-cert attestation. Absent or null: the attestation is written unsigned. */
  signer?: Signer | null;
}

export type SealErrorCode =
  | 'NO_IDENTITY'
  | 'MISSING_ISSUE'
  | 'NOT_APPROVER'
  | 'SELF_APPROVAL'
  | 'JIRA_UNREACHABLE'
  | 'INVALID_REQUEST'
  | 'DECLARATION_MISMATCH'
  | 'REASON_REQUIRED'
  | 'CONFLICT'
  | 'NOT_SEALED'
  | 'SNAPSHOT_TOO_LARGE'
  | 'LICENSE_INACTIVE'
  | 'NOT_ADMIN'
  | 'ISSUE_CHANGED'
  | 'RESTRICTED_EVIDENCE';

export interface SealFailure {
  ok: false;
  code: SealErrorCode;
  message: string;
}

const MESSAGES: Record<SealErrorCode, string> = {
  NO_IDENTITY: 'LedgerSeal could not identify you. Reload the page and try again.',
  MISSING_ISSUE: 'LedgerSeal could not tell which issue this is.',
  NOT_APPROVER: 'You cannot seal this issue. Ask a project admin.',
  SELF_APPROVAL: 'You changed this issue, so another approver must approve it.',
  JIRA_UNREACHABLE: 'LedgerSeal could not read the issue from Jira. Nothing was saved. Try again.',
  INVALID_REQUEST: 'LedgerSeal: invalid seal request.',
  DECLARATION_MISMATCH: 'The declaration changed since this form opened. Reload the page and try again.',
  REASON_REQUIRED: 'Give a reason for approving these changes (1 to 500 characters).',
  CONFLICT: 'Someone else sealed this issue a moment ago. Reload to see the new seal.',
  NOT_SEALED: 'This issue is not sealed, so there is no evidence to export.',
  SNAPSHOT_TOO_LARGE: 'This issue is too large to seal (over about 2.6 MB of content). Nothing was saved.',
  LICENSE_INACTIVE: 'The LedgerSeal licence is not active. Ask your Jira admin to renew it.',
  NOT_ADMIN: 'Only a Jira admin can change who can seal.',
  ISSUE_CHANGED: 'The issue changed since you opened it. Nothing was saved. Refresh, review the issue, and seal again.',
  RESTRICTED_EVIDENCE:
    'This seal covers comments or work logs that are restricted to a role or group you are not in, or that LedgerSeal can no longer read (deleted or restricted since), so LedgerSeal does not export its evidence. If a covered comment or work log was deleted, approving the changes makes a new seal whose evidence can be exported.'
};

const isEmptySide = (value: unknown) => value === null || value === undefined || value === '(empty)';

/** F-06: shown in place of a changed comment that the viewer cannot see in Jira. */
export const RESTRICTED_COMMENT_TEXT = 'A restricted comment that you cannot see in Jira';

/**
 * The hash of the issue as the viewer saw it (F-05): the current canonical form of the live issue as Jira returned
 * it. It does not depend on the site key, so the panel and the seal compute it the same way.
 */
export function viewHash(live: LiveRead, at: string): string {
  return computeSnapshotHash(canonicalizeIssueState(live.raw, at, live.fields, CANONICALIZER_VERSION));
}

export const SELF_REVOKE_MESSAGE = 'You changed this issue after it was sealed, so another approver must revoke the seal.';

export function fail(code: SealErrorCode, message: string = MESSAGES[code]): SealFailure {
  return { ok: false, code, message };
}

/**
 * True when Forge reports an inactive Marketplace licence (B-19). No licence object, as in development
 * installs, counts as active. `isActive` is the deprecated name of `active`.
 */
export function licenseInactive(context: any): boolean {
  const license = context?.license;
  if (!license) return false;
  return license.active === false || (license.active === undefined && license.isActive === false);
}

/** The issue comes from the trusted Forge context only, never from the payload. */
export function contextIssue(context: any): { id: string; key: string } | null {
  const issue = context?.extension?.issue;
  if (!issue?.id) return null;
  return { id: String(issue.id), key: String(issue.key || issue.id) };
}

const MAX_INCIDENT_CHANGES = 50;

/** The live comments as Jira returned them (readLiveSnapshot puts them on the issue). */
export function rawComments(raw: any): any[] {
  return Array.isArray(raw?.fields?.comment?.comments) ? raw.fields.comment.comments : [];
}

/**
 * One read of the live issue: the issue as Jira returned it, the same issue with every person replaced by a
 * party token (ADR-011), the field list, and its snapshot in the current canonical form.
 */
export interface LiveRead {
  raw: any;
  /** The issue with party tokens; equal to `raw` when the site has no key yet (no record holds a token then). */
  tokenisedRaw: any;
  tokenised: boolean;
  /** The people the issue names, by token, with the name Jira gave (for display only). */
  seen: Map<string, PartySeen>;
  fields: FieldSchema[];
  snapshot: CanonicalIssueSnapshot;
}

export interface LiveReadOptions {
  /** The site's party function; null when the site has no key yet. */
  party?: PartyFn | null;
  /** Applies transition-screen values to the issue before it is canonicalised (the validator). */
  apply?: (raw: any) => any;
}

/**
 * Reads the live issue and the field list, then canonicalises. Returns null when either read fails.
 */
export async function readLiveSnapshot(jira: JiraClient, issueIdOrKey: string, at: string, options: LiveReadOptions = {}): Promise<LiveRead | null> {
  const apply = options.apply ?? ((raw: any) => raw);
  const live = await jira.getIssue(issueIdOrKey);
  if (!live.ok) return null;
  const fields = await jira.getFields();
  if (!fields.ok) return null;
  const issueId = String(live.value?.id || issueIdOrKey);
  const comments = await jira.getComments(issueId);
  if (!comments.ok) return null;
  const issueFields = { ...(live.value?.fields || {}), comment: { comments: comments.value, total: comments.value.length } };
  // The issue body holds only the first work log page; read the rest when there are more
  const worklog = issueFields.worklog;
  if (worklog && Array.isArray(worklog.worklogs) && Number(worklog.total) > worklog.worklogs.length) {
    const all = await jira.getWorklogs(issueId);
    if (!all.ok) return null;
    issueFields.worklog = { ...worklog, worklogs: all.value, total: all.value.length };
  }
  const raw = apply({ ...live.value, fields: issueFields });
  const schemas = fields.value as FieldSchema[];
  const tokens = options.party ? pseudonymise(raw, options.party) : { value: raw, seen: new Map<string, PartySeen>() };
  return {
    raw,
    tokenisedRaw: tokens.value,
    tokenised: Boolean(options.party),
    seen: tokens.seen,
    fields: schemas,
    snapshot: canonicalizeIssueState(tokens.value, at, schemas, CANONICALIZER_VERSION)
  };
}

/** The same live read with every person replaced by a token of this party function. */
export function withParty(live: LiveRead, party: PartyFn, at: string): LiveRead {
  const tokens = pseudonymise(live.raw, party);
  return {
    ...live,
    tokenisedRaw: tokens.value,
    tokenised: true,
    seen: tokens.seen,
    snapshot: canonicalizeIssueState(tokens.value, at, live.fields, CANONICALIZER_VERSION)
  };
}

/** True when a sealed issue's records name people by party token (ADR-011 decisions 6 and 7). */
export function recordUsesTokens(we: SealedWorkEffort): boolean {
  return PSEUDONYMOUS_VERSIONS.has(we.attributes.canonicalizerVersion) || we.attributes.parties === 'TOKEN';
}

/** The live issue in the canonical form, and the party form, a seal was made with. */
function liveSnapshotFor(live: LiveRead, we: SealedWorkEffort, at: string): CanonicalIssueSnapshot {
  const version = we.attributes.canonicalizerVersion;
  const tokens = recordUsesTokens(we) && live.tokenised;
  if (version === live.snapshot.canonicalizerVersion && tokens === live.tokenised) return live.snapshot;
  return canonicalizeIssueState(tokens ? live.tokenisedRaw : live.raw, at, live.fields, version);
}

/**
 * Runs the transaction that follows a claimed status row. If it fails, the claimed row is removed again,
 * so the chain head and the newest row never disagree, and the error is passed on.
 */
async function commitAfterClaim(repo: SealRepository, row: WorkEffortStatus, commit: () => Promise<void>): Promise<void> {
  try {
    await commit();
  } catch (err) {
    await repo.removeStatus(row);
    throw err;
  }
}

/**
 * Writes the signed ledgerseal-cert attestation. Called on seal, reseal, revoke and each new incident only.
 * The property is an output for other tools; LedgerSeal itself never reads it.
 */
export const UNSIGNED_LOG =
  'LedgerSeal: LEDGERSEAL_SIGNING_KEY or LEDGERSEAL_KEY_ID is not set for this Forge environment, so this attestation is unsigned and the offline verifier will fail its signature check.';

async function writeAttestation(deps: LedgerSealDeps, seal: LoadedSeal, status: AttestationStatus, at: string): Promise<void> {
  const issueId = seal.workEffort.workEffortId;
  // B5: an unsigned attestation is never written silently
  if (!deps.signer) console.error(`${UNSIGNED_LOG} Issue ${issueId}.`);
  const written = await deps.jira.putSealProperty(issueId, buildAttestation(attestationSource(seal), status, at, deps.signer ?? null));
  if (!written) console.error(`LedgerSeal: could not write the ledgerseal-cert property on issue ${issueId}`);
}

function attestationSource(seal: LoadedSeal): AttestationSource {
  const we = seal.workEffort;
  return {
    issueId: we.workEffortId,
    certificateId: we.currentContentId,
    snapshotHash: we.attributes.snapshotHash,
    canonicalizerVersion: we.attributes.canonicalizerVersion,
    sealedAt: seal.assignment.fromDate,
    everCompromised: we.everCompromised,
    incidentCount: we.incidentCount
  };
}

/** Turns stored values into short display text, so the panel never receives the snapshot. */
function compact(analysis: TamperAnalysis): TamperAnalysis {
  return {
    ...analysis,
    tamperedFields: analysis.tamperedFields.map(diff => {
      const was = capped(diff.sealedValue);
      const now = capped(diff.liveValue);
      const detail = richTextSummary(diff.sealedValue, diff.liveValue);
      return {
        ...diff,
        sealedValue: was.text,
        liveValue: now.text,
        sealedTruncated: was.truncated,
        liveTruncated: now.truncated,
        sealedLong: was.text.length > LONG_VALUE_CHARS,
        liveLong: now.text.length > LONG_VALUE_CHARS,
        ...(detail ? { detail } : {})
      };
    })
  };
}

export interface SealEvaluation {
  kind: 'SEAL';
  seal: LoadedSeal;
  sealedSnapshot: CanonicalIssueSnapshot;
  analysis: TamperAnalysis;
  /** The live issue in the canonical form the seal was made with; every comparison uses this one. */
  liveSnapshot: CanonicalIssueSnapshot;
  /** The live comments as Jira returned them, to name who added or edited each comment. */
  liveComments: any[];
  /** The live issue as Jira returned it, to name who added or edited a work log. */
  liveRaw?: any;
}

/** RECORD_INVALID carries the work effort when it could be read, so a reseal can continue its chain. */
export type Evaluation =
  | { kind: 'NONE' }
  | { kind: 'LEGACY' }
  | { kind: 'RECORD_INVALID'; workEffort: SealedWorkEffort | null }
  | SealEvaluation;

/**
 * Compares the live issue with the stored seal. Reads only.
 */
export async function evaluate(repo: SealRepository, issueId: string, live: LiveRead, at: string): Promise<Evaluation> {
  const seal = await repo.getSeal(issueId);
  if (!seal) {
    return (await repo.getLegacyCertificate(issueId)) ? { kind: 'LEGACY' } : { kind: 'NONE' };
  }
  if (seal === 'missing') return { kind: 'RECORD_INVALID', workEffort: await repo.getWorkEffort(issueId) };
  // Check the stored work effort, assignment, sealing row and content on every read (LS-10)
  const we = seal.workEffort;
  if (!isConsistent(seal)) return { kind: 'RECORD_INVALID', workEffort: we };
  const sealedSnapshot = await repo.getContent(we);
  if (!sealedSnapshot || computeSnapshotHash(sealedSnapshot) !== we.attributes.snapshotHash) return { kind: 'RECORD_INVALID', workEffort: we };
  // Compare under the canonical form, and the party form, the seal was made with (spec v2 section 4.1, ADR-011)
  let liveSnapshot: CanonicalIssueSnapshot;
  try {
    liveSnapshot = liveSnapshotFor(live, we, at);
  } catch {
    // Rules this app does not have cannot check the seal, so it is not shown as valid
    return { kind: 'RECORD_INVALID', workEffort: we };
  }
  const sealed: SealedState = {
    snapshotHash: we.attributes.snapshotHash,
    snapshot: sealedSnapshot,
    revoked: we.currentStatusId === 'LS_REVOKED',
    compromised: we.currentStatusId === 'LS_CHANGED'
  };
  const analysis = { ...compareToSeal(sealed, liveSnapshot, at), seal: summarise(seal) };
  return { kind: 'SEAL', seal, sealedSnapshot, analysis, liveSnapshot, liveComments: rawComments(live.raw), liveRaw: live.raw };
}

/** Who changed each item after the seal: comments from the comment itself, fields from the change log. */
function attribute(diffs: FieldDiff[], changelog: ChangelogEntry[], sinceIso: string, liveComments: any[] = [], liveRaw: any = null) {
  const since = Date.parse(sinceIso);
  const comments = new Map(liveComments.map(c => [`comment:${c.id}`, c]));
  return diffs.slice(0, MAX_INCIDENT_CHANGES).map(diff => {
    const comment = comments.get(diff.fieldId);
    if (comment) {
      const by = comment.updated ? comment.updateAuthor?.accountId : comment.author?.accountId;
      return { fieldId: diff.fieldId, fieldName: diff.fieldName, changedBy: by ? [String(by)] : [], changedAt: comment.updated ?? comment.created ?? null };
    }
    if (diff.fieldId === 'worklog') {
      // Jira's change log does not name work log authors, so they come from the work logs (F-01)
      const worklogs = { fields: { worklog: liveRaw?.fields?.worklog } };
      return { fieldId: diff.fieldId, fieldName: diff.fieldName, changedBy: [...itemAuthorsSince(worklogs, sinceIso)], changedAt: null };
    }
    const entries = changelog.filter(
      e => !(Date.parse(e.created) <= since) && e.items.some(item => item.fieldId === diff.fieldId || item.field === diff.fieldId)
    );
    const changedBy = [...new Set(entries.map(e => e.author?.accountId).filter((a): a is string => Boolean(a)))];
    const changedAt = entries.length > 0 ? entries[entries.length - 1].created : null;
    return { fieldId: diff.fieldId, fieldName: diff.fieldName, changedBy, changedAt };
  });
}

/**
 * Records a change incident when the live hash is new for the current seal (invariant 4).
 * Writes nothing when the issue is unchanged or the same change was already recorded.
 */
export async function recordIncidentIfNew(
  deps: LedgerSealDeps,
  repo: SealRepository,
  evaluation: SealEvaluation,
  at: string,
  knownParty?: PartyFn
): Promise<{ seal: LoadedSeal; recorded: boolean }> {
  const { seal, analysis } = evaluation;
  const we = seal.workEffort;
  const liveHash = analysis.liveHash;
  const transitionName = canChange(we.currentStatusId, 'LS_CHANGED');
  if (!transitionName || analysis.status !== 'SEAL_BROKEN' || !liveHash || liveHash === we.lastIncidentHash) {
    return { seal, recorded: false };
  }
  const changelog = await deps.jira.getChangelog(we.workEffortId);
  const attributed = attribute(analysis.tamperedFields, changelog.ok ? changelog.value : [], seal.assignment.fromDate, evaluation.liveComments, evaluation.liveRaw);
  // History rows name people by party token, never by account id (ADR-011 decision 1)
  const parties = new PartyRepository(deps.storage);
  const party = knownParty ?? (await parties.partyForWrite());
  // M-2: a closed account is never stored again; L-8: an account that exists keeps its name
  await parties.register(attributed.flatMap(c => c.changedBy), party, at, id => deps.jira.accountState(id));
  const changes = attributed.map(c => ({ ...c, changedBy: c.changedBy.map(party) }));
  const row = buildStatusRow(we.statusHead, {
    workEffortId: we.workEffortId,
    statusId: 'LS_CHANGED',
    statusDatetime: at,
    setByPartyId: null,
    reason: null,
    transitionName,
    data: { liveHash, certificateId: we.currentContentId, changes, attachmentChanges: analysis.tamperedAttachments.length }
  });
  if (!(await repo.appendStatus(row))) {
    // Another writer recorded this change first.
    return { seal, recorded: false };
  }
  const updated: LoadedSeal = {
    ...seal,
    workEffort: withRecordHash({
      ...we,
      currentStatusId: 'LS_CHANGED',
      lastStatusUpdate: at,
      revisionNumber: row.seq,
      statusHead: { seq: row.seq, entryHash: row.entryHash },
      everCompromised: true,
      incidentCount: we.incidentCount + 1,
      lastIncidentHash: liveHash
    })
  };
  await commitAfterClaim(repo, row, () => repo.saveWorkEffort(updated.workEffort));
  await writeAttestation(deps, updated, 'SEAL_BROKEN', at);
  return { seal: updated, recorded: true };
}

export async function sealIssueFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const accountId = context?.accountId ? String(context.accountId) : '';
  if (!accountId) return fail('NO_IDENTITY');
  if (licenseInactive(context)) return fail('LICENSE_INACTIVE');
  const issue = contextIssue(context);
  if (!issue) return fail('MISSING_ISSUE');
  const signature = payload?.signature;
  if (!signature) return fail('INVALID_REQUEST');

  const permission = await isApprover(deps.jira, deps.storage, issue.id);
  if (!permission.ok) return fail(permission.error === 'FORBIDDEN' ? 'NOT_APPROVER' : 'JIRA_UNREACHABLE');
  if (!permission.value) return fail('NOT_APPROVER');

  // The signer agrees to the one declaration the panel shows (LS-09)
  if (!matchesDeclaration(signature.declarationVersion, signature.declarationText)) return fail('DECLARATION_MISMATCH');
  const meaning = signature.meaning === undefined ? 'APPROVAL' : signature.meaning;
  if (!isMeaning(meaning)) return fail('INVALID_REQUEST');

  // Fetch real live Jira issue. Never fall back to client-supplied payload.
  const now = new Date().toISOString();
  const parties = new PartyRepository(deps.storage);
  const read = await readLiveSnapshot(deps.jira, issue.id, now, { party: await parties.partyForRead() });
  if (!read) return fail('JIRA_UNREACHABLE');
  // F-05: the seal covers what the approver reviewed; a change since the panel loaded refuses the seal
  if (typeof payload?.viewHash === 'string' && payload.viewHash !== viewHash(read, now)) return fail('ISSUE_CHANGED');
  const repo = new SealRepository(deps.storage);
  // A record written before ADR-011 is converted first, so the new seal continues a record with tokens only
  const conversion = await convertIfNeeded(deps, repo, issue.id);
  if (conversion === 'JIRA_UNREACHABLE') return fail('JIRA_UNREACHABLE');
  if (conversion === 'BUSY') return fail('CONFLICT');
  const known = await parties.partyForRead();
  // The first seal of a site makes the site key. It is held in memory and stored just before the first write,
  // so a refused seal writes nothing (invariant 8)
  const candidate = known ? null : newSiteKey();
  const party = known ?? partyFunction(candidate as Buffer);
  const live = withParty(read, party, now);
  let keyStored = !candidate;
  const storeKey = async () => {
    if (!keyStored) keyStored = await parties.storeKey(candidate as Buffer);
    return keyStored;
  };

  const snapshot = live.snapshot;

  let previous: LoadedSeal | null = null;
  let previousWorkEffort: SealedWorkEffort | null = null;
  let previousState: LedgerSealStatusId | 'RECORD_INVALID' | null = null;
  const evaluation = await evaluate(repo, issue.id, live, now);
  if (evaluation.kind === 'SEAL') {
    previous = evaluation.seal;
    previousWorkEffort = previous.workEffort;
    previousState = previousWorkEffort.currentStatusId;
    const status = evaluation.analysis.status;
    if (status === 'SEAL_BROKEN' || status === 'SEAL_COMPROMISED') {
      // Separation of duties: the author of a change since the last seal cannot approve it
      const self = await changedSince(deps, issue.id, live, previous, accountId);
      if (self === null) return fail('JIRA_UNREACHABLE');
      if (self) return fail('SELF_APPROVAL');
      if (!validReason(signature.reason)) return fail('REASON_REQUIRED');
      // Record the change before the reseal, so the history shows it even if no one viewed the issue
      if (!(await storeKey())) return fail('CONFLICT');
      previous = (await recordIncidentIfNew(deps, repo, evaluation, now, party)).seal;
      previousWorkEffort = previous.workEffort;
    }
    if (status === 'SEAL_REVOKED') {
      // A revoke must not open a way around separation of duties (live, DEMO-34)
      const self = await changedSince(deps, issue.id, live, previous, accountId);
      if (self === null) return fail('JIRA_UNREACHABLE');
      if (self) return fail('SELF_APPROVAL');
      const changed = computeSnapshotHash(evaluation.liveSnapshot) !== previousWorkEffort.attributes.snapshotHash;
      if (changed && !validReason(signature.reason)) return fail('REASON_REQUIRED');
    }
  }
  if (evaluation.kind === 'RECORD_INVALID') {
    // The stored counts cannot be trusted, so the new seal says the issue was compromised
    previousWorkEffort = evaluation.workEffort ? { ...evaluation.workEffort, everCompromised: true } : null;
    previousState = 'RECORD_INVALID';
  }

  // The state change must be allowed (StatusValidChange). An invalid record may always be resealed.
  const fromStatus = previousState === 'RECORD_INVALID' ? 'LS_CHANGED' : previousState;
  const transitionName = canChange(fromStatus, 'LS_SEALED');
  if (!transitionName) return fail('INVALID_REQUEST');

  const signer = party(accountId);
  const reason = previousState ? validReason(signature.reason) : null;
  const certificateId = crypto.randomUUID();
  const snapshotHash = computeSnapshotHash(snapshot);
  // Bounded values (B-17): each part under half the KVS limit, all parts in one transaction
  const contentParts = splitUtf8(JSON.stringify(snapshot), MAX_PART_BYTES);
  if (contentParts.length > MAX_CONTENT_PARTS) return fail('SNAPSHOT_TOO_LARGE');

  if (!(await storeKey())) return fail('CONFLICT');
  const row = buildStatusRow(previousWorkEffort ? previousWorkEffort.statusHead : null, {
    workEffortId: issue.id,
    statusId: 'LS_SEALED',
    statusDatetime: now,
    setByPartyId: signer,
    reason,
    transitionName,
    data: {
      certificateId,
      snapshotHash,
      meaning,
      declarationVersion: DECLARATION.version,
      previousCertificateId: previousWorkEffort ? previousWorkEffort.currentContentId : null,
      previousState
    }
  });
  if (!(await repo.appendStatus(row))) return fail('CONFLICT');
  await parties.register([accountId], party, now);

  const assignment: WorkEffortPartyAssignment = {
    workEffortId: issue.id,
    partyId: signer,
    roleTypeId: roleForMeaning(meaning),
    fromDate: now,
    thruDate: null,
    comments: reason,
    contentId: certificateId,
    declaration: { version: DECLARATION.version, text: DECLARATION.text }
  };
  const workEffort = withRecordHash({
    schemaVersion: 3,
    workEffortId: issue.id,
    workEffortTypeId: 'JIRA_ISSUE',
    sourceReferenceId: String(live.raw.key || issue.key),
    currentStatusId: 'LS_SEALED',
    lastStatusUpdate: now,
    revisionNumber: row.seq,
    statusHead: { seq: row.seq, entryHash: row.entryHash },
    currentAssignment: {
      partyId: signer,
      roleTypeId: assignment.roleTypeId,
      fromDate: now,
      assignmentHash: assignmentHash(assignment),
      sealingSeq: row.seq,
      sealingEntryHash: row.entryHash
    },
    currentContentId: certificateId,
    attributes: {
      snapshotHash,
      canonicalizerVersion: CANONICALIZER_VERSION,
      declarationVersion: DECLARATION.version,
      statusAtSeal: snapshot.status,
      snapshotParts: contentParts.length,
      ...(conversion === 'TOO_LARGE' ? {} : { parties: 'TOKEN' as const })
    },
    everCompromised: previousWorkEffort ? previousWorkEffort.everCompromised : false,
    incidentCount: previousWorkEffort ? previousWorkEffort.incidentCount : 0,
    lastIncidentHash: null
  });
  // A reseal ends the previous assignment at this time (Silverston thruDate)
  // A revoked seal already ended at the revoke time; keep that date
  const ended = previous && previous.assignment.thruDate === null ? { ...previous.assignment, thruDate: now } : null;
  await commitAfterClaim(repo, row, () => repo.saveSeal(workEffort, assignment, contentParts, ended));
  // The snapshot of the seal this one replaces is read by nothing, so it is deleted (F-11)
  if (previousWorkEffort?.currentContentId && previousWorkEffort.currentContentId !== certificateId) {
    try {
      await repo.deleteContent(previousWorkEffort.currentContentId);
    } catch (err) {
      console.error(`LedgerSeal: could not delete the replaced snapshot of issue ${issue.id}`, err);
    }
  }

  // The ledgerseal-cert property names no person (ADR-011 decision 8)
  await writeAttestation(deps, { workEffort, assignment, sealingRow: row }, 'SEAL_VALID', now);

  return { ok: true as const, certificateId, snapshotHash, sealedAt: now };
}

/** Converts the issue's record when it was written before ADR-011 (decision 7). */
async function convertIfNeeded(deps: LedgerSealDeps, repo: SealRepository, issueId: string) {
  const we = await repo.getWorkEffort(issueId);
  if (!we) return 'ALREADY' as const;
  // M-1: a journal means a conversion that has not finished, as the weekly job also treats it
  if (we.attributes.parties === 'TOKEN' && !(await hasConversionJournal(deps.storage, issueId))) return 'ALREADY' as const;
  return convertRecord({ storage: deps.storage, jira: deps.jira }, issueId);
}

/**
 * Writes the ledgerseal-cert property again from the stored record, without a live read (after a conversion, so
 * the property of an old record no longer names the signer). Returns false when the record cannot be read.
 */
export async function republishAttestation(deps: LedgerSealDeps, issueId: string): Promise<boolean> {
  const seal = await new SealRepository(deps.storage).getSeal(issueId);
  if (!seal || seal === 'missing' || !isConsistent(seal)) return false;
  await writeAttestation(deps, seal, STORED_STATUS[seal.workEffort.currentStatusId], new Date().toISOString());
  return true;
}

function errorResult(errorReason: 'JIRA_UNREACHABLE' | 'STORAGE', at: string): TamperAnalysis {
  return { status: 'ERROR', errorReason, tamperedFields: [], tamperedAttachments: [], verifiedAt: at };
}

export async function verifyIssueFlow(payload: any, context: any, deps: LedgerSealDeps) {
  if (!context?.accountId) return fail('NO_IDENTITY');
  if (licenseInactive(context)) return fail('LICENSE_INACTIVE');
  const issue = contextIssue(context);
  if (!issue) return fail('MISSING_ISSUE');

  const now = new Date().toISOString();
  let party: PartyFn | null;
  try {
    party = await new PartyRepository(deps.storage).partyForRead();
  } catch (err) {
    console.error('LedgerSeal: verify failed', err);
    return errorResult('STORAGE', now);
  }
  const live = await readLiveSnapshot(deps.jira, issue.id, now, { party });
  // A read failure is reported as an error, never as "not sealed" (invariant 8)
  if (!live) return errorResult('JIRA_UNREACHABLE', now);
  let result: TamperAnalysis;
  try {
    result = await verifyAgainstSeal(deps, issue.id, live, now);
  } catch (err) {
    console.error('LedgerSeal: verify failed', err);
    return errorResult('STORAGE', now);
  }
  return {
    ...result,
    issueKey: issue.key,
    rights: await viewerRights(deps, issue.id, String(context.accountId), result, live),
    approverGroups: await approverGroupNames(deps.storage),
    viewHash: viewHash(live, now),
    // B5: the panel says so when this installation writes unsigned attestations
    signing: { signed: Boolean(deps.signer), keyId: deps.signer?.keyId ?? null }
  };
}

const CHANGED_STATES = new Set(['SEAL_BROKEN', 'SEAL_COMPROMISED']);
const SEALED_STATES = new Set(['SEAL_VALID', 'SEAL_BROKEN', 'SEAL_COMPROMISED']);

/**
 * What the viewer may do, so the panel shows only those actions (G-10). Reads only.
 * A failed permission check gives no rights; a failed change log read blocks approving changes.
 */
async function viewerRights(deps: LedgerSealDeps, issueId: string, accountId: string, result: TamperAnalysis, live: LiveRead) {
  const permission = await isApprover(deps.jira, deps.storage, issueId);
  const permitted = permission.ok && permission.value;
  const changed = CHANGED_STATES.has(result.status);
  let blockedBySelfChange = false;
  // Anyone who changed covered content since the seal may not approve, revoke or seal again (B2); a failed read blocks
  if (permitted && result.seal) {
    const self = await authorOfChange(deps, issueId, live, result.seal.sealedAt, result.seal.canonicalizerVersion, accountId);
    blockedBySelfChange = self !== false;
  }
  return {
    canSeal: permitted && !changed && !(result.status === 'SEAL_REVOKED' && blockedBySelfChange),
    canApproveChanges: permitted && !blockedBySelfChange,
    canRevoke: permitted && SEALED_STATES.has(result.status) && !blockedBySelfChange,
    blockedBySelfChange
  };
}

/**
 * True when the account changed covered content of the issue after `sinceIso` (B2, F-01, F-13): a change log item
 * of a field the seal covers, or a comment, work log or attachment it added or edited. Null when the change log
 * cannot be read.
 */
async function authorOfChange(deps: LedgerSealDeps, issueId: string, live: LiveRead, sinceIso: string, version: string, accountId: string): Promise<boolean | null> {
  const changelog = await deps.jira.getChangelog(issueId);
  if (!changelog.ok) return null;
  const counts = (fieldId: string) => !isExcludedField(version, fieldId, live.fields);
  return changeAuthorsSince(changelog.value, live.raw, sinceIso, counts).has(accountId);
}

function changedSince(deps: LedgerSealDeps, issueId: string, live: LiveRead, seal: LoadedSeal, accountId: string) {
  return authorOfChange(deps, issueId, live, seal.assignment.fromDate, seal.workEffort.attributes.canonicalizerVersion, accountId);
}

async function verifyAgainstSeal(
  deps: LedgerSealDeps,
  issueId: string,
  live: LiveRead,
  now: string
): Promise<TamperAnalysis> {
  const repo = new SealRepository(deps.storage);
  const evaluation = await evaluate(repo, issueId, live, now);

  if (evaluation.kind === 'NONE') return compareToSeal(null, live.snapshot, now);
  if (evaluation.kind === 'LEGACY' || evaluation.kind === 'RECORD_INVALID') {
    return { status: evaluation.kind, tamperedFields: [], tamperedAttachments: [], verifiedAt: now };
  }

  // Writes only when this change is new (invariant 3); the property is updated inside.
  const { seal } = await recordIncidentIfNew(deps, repo, evaluation, now);
  const sealed = evaluation.sealedSnapshot;
  const analysis = compact({ ...evaluation.analysis, seal: summarise(seal) });
  // Who changed each item and when, from the recorded incident, so every later view shows the same names
  const we = seal.workEffort;
  const incident = we.currentStatusId === 'LS_CHANGED' ? await repo.getCurrentStatusRow(we) : null;
  const recorded = new Map(((incident?.data?.changes as any[]) || []).map(c => [c.fieldId, c]));
  // Party tokens become account ids, and names in the change text, only for display (ADR-011 decision 4)
  const resolver = new PartyResolver(new PartyRepository(deps.storage));
  const names = await tokenNames(analysis.tamperedFields.flatMap(d => [String(d.sealedValue ?? ''), String(d.liveValue ?? '')]), live, resolver, deps.jira);
  const closedTokens = new Set<string>();
  for (const token of new Set(analysis.tamperedFields.flatMap(d => `${d.sealedValue ?? ''} ${d.liveValue ?? ''}`.match(TOKEN_IN_TEXT) ?? []))) {
    if (!names.has(token) && (await resolver.isClosed(token))) closedTokens.add(token);
  }
  const named = (text: any) =>
    typeof text === 'string' ? text.replace(TOKEN_IN_TEXT, token => names.get(token) ?? (closedTokens.has(token) ? DELETED_USER : UNNAMED_PERSON)) : text;
  analysis.tamperedFields = await Promise.all(
    analysis.tamperedFields.map(async diff => {
      const stored = (recorded.get(diff.fieldId)?.changedBy as string[]) ?? [];
      const ids = await Promise.all(stored.map(id => resolver.resolve(id)));
      const unresolved = stored.filter((_, i) => !ids[i]);
      const closed = (await Promise.all(unresolved.map(id => resolver.isClosed(id)))).filter(Boolean).length;
      const unknown = unresolved.length - closed;
      return {
        ...diff,
        sealedValue: named(diff.sealedValue),
        liveValue: named(diff.liveValue),
        changedBy: ids.filter((id): id is string => Boolean(id)),
        ...(closed > 0 ? { changedByClosed: closed } : {}),
        ...(unknown > 0 ? { changedByUnknown: unknown } : {}),
        changedAt: recorded.get(diff.fieldId)?.changedAt ?? null
      };
    })
  );
  analysis.seal = await resolveSummary(analysis.seal, resolver);
  // F-06: a changed comment restricted to a role or group shows its text only to a viewer who can see it in Jira
  const commentIds = analysis.tamperedFields.filter(d => d.fieldId.startsWith('comment:')).map(d => d.fieldId.slice('comment:'.length));
  const hidden = await hiddenComments(deps, issueId, sealed, live.raw, commentIds);
  analysis.tamperedFields = analysis.tamperedFields.map(diff => {
    if (!hidden.has(diff.fieldId.slice('comment:'.length)) || !diff.fieldId.startsWith('comment:')) return diff;
    // L-18: Jira hides a restricted comment entirely from such a viewer, its author and time included, so the row
    // says only that a comment changed
    const { detail: _detail, changedByClosed: _closed, changedByUnknown: _unknown, ...rest } = diff;
    return {
      ...rest,
      changedBy: [],
      changedAt: null,
      // An empty side (no comment before, or none now) stays empty
      sealedValue: isEmptySide(diff.sealedValue) ? diff.sealedValue : RESTRICTED_COMMENT_TEXT,
      liveValue: isEmptySide(diff.liveValue) ? diff.liveValue : RESTRICTED_COMMENT_TEXT,
      sealedTruncated: false,
      liveTruncated: false,
      sealedLong: false,
      liveLong: false
    };
  });
  return {
    ...analysis,
    coveredFields: sealed.fields.map(f => ({ id: f.id, name: f.name })),
    excludedFields: sealed.excluded || []
  };
}

/**
 * Shown in a changed value for a person LedgerSeal cannot name: no longer on the issue and not someone who
 * sealed, changed or revoked (only those are in the map), or a closed account (ADR-011).
 */
export const UNNAMED_PERSON = 'a user no longer on this issue';
/**
 * F-06, H-2: of these comment ids, the ones this viewer must not see: every comment the app can no longer read
 * (deleted, or restricted to a role or group the app user is not in), and a readable comment restricted at the seal or
 * now that is not in the viewer's own comment list (read as the user). A failed read hides every restricted one.
 */
async function hiddenComments(deps: LedgerSealDeps, issueId: string, sealed: CanonicalIssueSnapshot, liveRaw: any, commentIds: string[]): Promise<Set<string>> {
  if (commentIds.length === 0) return new Set();
  const live = rawComments(liveRaw);
  const liveIds = new Set(live.map(c => String(c?.id)));
  // H-2 (owner decision 2026-11-06, fail closed): a comment the app can no longer read may have been deleted, or
  // restricted to a role or group the app user is not in. Its sealed text is hidden from everyone.
  const gone = commentIds.filter(id => !liveIds.has(id));
  const restricted = new Set([...(sealed.restrictedComments ?? []).map(c => c.id), ...live.filter(c => c?.visibility).map(c => String(c.id))]);
  const candidates = commentIds.filter(id => liveIds.has(id) && restricted.has(id));
  if (candidates.length === 0) return new Set(gone);
  const visible = await deps.jira.getVisibleCommentIds(issueId);
  const seen = new Set(visible.ok ? visible.value : []);
  return new Set([...gone, ...candidates.filter(id => !seen.has(id))]);
}

/** Shown for a person whose account was closed (the 11.50 wording, owner decision 2026-11-06). */
export const DELETED_USER = 'a deleted user';

/** The display name of each party token found in the texts: from the live issue, else from the map and Jira. */
async function tokenNames(texts: string[], live: LiveRead, resolver: PartyResolver, jira: JiraClient): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const tokens = new Set(texts.flatMap(text => text.match(TOKEN_IN_TEXT) ?? []));
  for (const token of tokens) {
    const seen = live.seen.get(token)?.displayName;
    if (seen) {
      names.set(token, seen);
      continue;
    }
    const accountId = await resolver.resolve(token);
    const name = accountId ? await jira.getUserName(accountId) : null;
    if (name) names.set(token, name);
  }
  return names;
}

/** The seal summary with account ids in place of party tokens; a closed account gives an empty id and a flag. */
async function resolveSummary(summary: SealSummary | undefined, resolver: PartyResolver): Promise<SealSummary | undefined> {
  if (!summary) return summary;
  // L-8: "closed" only for a closed mark; a token with no entry is unknown and shown neutrally
  const flags = async (id: string, resolved: string | null, closedKey: string, unknownKey: string) =>
    resolved ? {} : (await resolver.isClosed(id)) ? { [closedKey]: true } : { [unknownKey]: true };
  const sealedBy = await resolver.resolve(summary.sealedByAccountId);
  const revokedBy = summary.revocation ? await resolver.resolve(summary.revocation.revokedByAccountId) : null;
  return {
    ...summary,
    sealedByAccountId: sealedBy ?? '',
    ...(await flags(summary.sealedByAccountId, sealedBy, 'sealedByClosed', 'sealedByUnknown')),
    revocation: summary.revocation
      ? {
          ...summary.revocation,
          revokedByAccountId: revokedBy ?? '',
          ...(await flags(summary.revocation.revokedByAccountId, revokedBy, 'revokedByClosed', 'revokedByUnknown'))
        }
      : null
  };
}

/**
 * History entries, oldest first, one page at a time, with a chain check over the page.
 */
export async function historyFlow(payload: any, context: any, deps: LedgerSealDeps) {
  if (!context?.accountId) return fail('NO_IDENTITY');
  if (licenseInactive(context)) return fail('LICENSE_INACTIVE');
  const issue = contextIssue(context);
  if (!issue) return fail('MISSING_ISSUE');
  const repo = new SealRepository(deps.storage);
  const we = await repo.getWorkEffort(issue.id);
  if (!we) return { ok: true as const, entries: [] as WorkEffortStatus[], chainValid: true, nextFromSeq: null };

  const head = we.statusHead;
  const fromSeq = Math.min(head.seq, Math.max(1, Math.floor(Number(payload?.fromSeq) || 1)));
  const toSeq = Math.min(head.seq, fromSeq + HISTORY_PAGE_SIZE - 1);
  const page = await repo.getStatusRows(issue.id, fromSeq, toSeq);
  const before = fromSeq > 1 ? (await repo.getStatusRow(issue.id, fromSeq - 1)) || undefined : undefined;
  const check = verifyChain(page, before ? before.entryHash : undefined, head);
  // A missing entry anywhere in the page, or a missing predecessor, breaks the chain.
  const complete = page.length === toSeq - fromSeq + 1 && (fromSeq === 1 || Boolean(before));
  // Who acted, as an account id for the UI Kit User component; empty for the app itself or a closed account (F-15)
  const resolver = new PartyResolver(new PartyRepository(deps.storage));
  const actors = await Promise.all(page.map(row => resolver.resolve(row.setByPartyId)));
  const closed = await Promise.all(page.map((row, i) => (actors[i] ? false : resolver.isClosed(row.setByPartyId))));
  return {
    ok: true as const,
    entries: page.map((row, i) => ({
      ...row,
      actorAccountId: actors[i] ?? '',
      actorClosed: closed[i],
      actorUnknown: Boolean(row.setByPartyId) && !actors[i] && !closed[i]
    })),
    chainValid: check.valid && complete,
    nextFromSeq: toSeq < head.seq ? toSeq + 1 : null
  };
}

/** The issue an event is about: issue events carry `issue`, attachment and work log events carry `issueId`. */
function eventIssueId(event: any): string | null {
  const id = event?.issue?.id ?? event?.attachment?.issueId ?? event?.worklog?.issueId;
  return id ? String(id) : null;
}

/**
 * Records a change as soon as Jira reports it (spec v2 section 7.4), so a change that is reverted before anyone
 * opens the panel is still on record. It writes only for a new change to a covered field, and never throws:
 * the validator checks the live issue at every transition anyway, because events can arrive late.
 */
export async function issueChangedFlow(event: any, deps: LedgerSealDeps): Promise<{ recorded: boolean }> {
  const issueId = eventIssueId(event);
  if (!issueId || event?.selfGenerated === true) return { recorded: false };
  try {
    const repo = new SealRepository(deps.storage);
    const now = new Date().toISOString();
    if (!(await repo.getWorkEffort(issueId))) return { recorded: false };
    const party = await new PartyRepository(deps.storage).partyForRead();
    const live = await readLiveSnapshot(deps.jira, issueId, now, { party });
    if (!live) return { recorded: false };
    const evaluation = await evaluate(repo, issueId, live, now);
    if (evaluation.kind !== 'SEAL') return { recorded: false };
    const { recorded } = await recordIncidentIfNew(deps, repo, evaluation, now);
    return { recorded };
  } catch (err) {
    console.error('LedgerSeal: issue event handling failed', err);
    return { recorded: false };
  }
}

/** The attestation status that the stored state supports, without a live read. */
const STORED_STATUS: Record<LedgerSealStatusId, AttestationStatus> = {
  LS_SEALED: 'SEAL_VALID',
  LS_CHANGED: 'SEAL_BROKEN',
  LS_REVOKED: 'SEAL_REVOKED'
};

const VERIFICATION_STEPS = [
  'Compute the canonical JSON of "snapshot": keys sorted by UTF-16 code unit at every level, no whitespace (spec v2 section 4.1).',
  'Check that the SHA-256 of that text, in lowercase hex, equals attestation.snapshotHash.',
  'Check the history: each entry\'s entryHash is the SHA-256 of the canonical JSON of the entry without entryHash, and each prevEntryHash equals the entryHash before it (64 zeros for the first).',
  'Check that the newest LS_SEALED entry names attestation.certificateId.',
  'Check that attestation.status is the state of the newest entry that is not LS_REDACTED: SEAL_VALID for LS_SEALED, SEAL_BROKEN for LS_CHANGED, SEAL_REVOKED for LS_REVOKED.',
  'Check the Ed25519 signature attestation.sig over the canonical JSON of the attestation without sig, with the public key named by attestation.keyId.',
  'Run: node verify-evidence.mjs <this file> <public key file>. It performs every step and exits 0 only when all pass.',
  'Records name people by party token (pty_...). "parties" maps each token in the history to its account id, or null when the account was closed. It is not signed and is not part of any hash.'
];

export const UNSIGNED_EVIDENCE =
  'This installation has no LedgerSeal signing key, so this evidence is unsigned and the offline verifier fails its signature check. Contact support@asymm.systems.';

/** Every party token named in the history, for the unsigned parties map of the evidence (ADR-011 decision 10). */
function historyTokens(history: WorkEffortStatus[]): string[] {
  const ids = history.flatMap(row => [
    row.setByPartyId,
    ...(((row.data?.changes as any[]) ?? []).flatMap(c => (Array.isArray(c?.changedBy) ? c.changedBy : [])) as string[])
  ]);
  return [...new Set(ids.filter(isPartyToken))].sort();
}

/**
 * M-11 (owner decision 2026-11-06, fail closed, the comment rule): a covered work log's comment is in the snapshot.
 * A sealed work log the app can no longer read refuses the export to everyone; one restricted at the seal or now
 * refuses it to a viewer whose own work log list (read as the user) does not contain it. Null when the export may go.
 */
async function checkSealedWorklogs(snapshot: CanonicalIssueSnapshot, issueId: string, deps: LedgerSealDeps) {
  const field = (snapshot.fields ?? []).find(f => f.id === 'worklog');
  const sealedIds = Array.isArray(field?.value) ? (field!.value as any[]).map(w => String(w?.id ?? '')) : [];
  if (sealedIds.length === 0) return null;
  const live = await deps.jira.getWorklogs(issueId);
  if (!live.ok) return fail('JIRA_UNREACHABLE');
  const liveIds = new Set(live.value.map(w => String(w?.id)));
  if (sealedIds.some(id => !liveIds.has(id))) return fail('RESTRICTED_EVIDENCE');
  const restrictedNow = new Set(live.value.filter(w => w?.visibility).map(w => String(w.id)));
  const restricted = new Set([...(snapshot.restrictedWorklogs ?? []).map(w => w.id), ...sealedIds.filter(id => restrictedNow.has(id))]);
  if (restricted.size === 0) return null;
  const visible = await deps.jira.getVisibleWorklogIds(issueId);
  if (!visible.ok) return fail('JIRA_UNREACHABLE');
  const seen = new Set(visible.value);
  return [...restricted].some(id => !seen.has(id)) ? fail('RESTRICTED_EVIDENCE') : null;
}

/**
 * Evidence for an auditor (spec v2 section 11): a signed attestation of the stored state, the canonical
 * snapshot that was hashed, and the full status history. Reads only.
 */
export async function evidenceFlow(payload: any, context: any, deps: LedgerSealDeps) {
  if (!context?.accountId) return fail('NO_IDENTITY');
  if (licenseInactive(context)) return fail('LICENSE_INACTIVE');
  const issue = contextIssue(context);
  if (!issue) return fail('MISSING_ISSUE');
  const repo = new SealRepository(deps.storage);
  const seal = await repo.getSeal(issue.id);
  if (!seal) return fail('NOT_SEALED');
  if (seal === 'missing' || !isConsistent(seal)) return fail('INVALID_REQUEST', 'The seal record failed its integrity check, so no evidence can be exported.');
  const snapshot = await repo.getContent(seal.workEffort);
  if (!snapshot) return fail('INVALID_REQUEST', 'The sealed snapshot could not be read.');
  // F-06, H-1: the snapshot holds the text of every comment it covers, and that text is hashed, so it cannot be cut
  // out. The evidence goes only to a viewer who can see every sealed comment that is restricted, by the same rule as
  // the panel: restricted at the seal, or restricted now, or (a seal made before F-06) removed since.
  const live = await deps.jira.getComments(issue.id);
  if (!live.ok) return fail('JIRA_UNREACHABLE');
  const sealedIds = (snapshot.comments ?? []).map(c => c.id);
  const liveIds = new Set(live.value.map(c => String(c?.id)));
  const restrictedNow = new Set(live.value.filter(c => c?.visibility).map(c => String(c.id)));
  // H-2 (owner decision 2026-11-06, fail closed): a sealed comment the app can no longer read may be deleted or
  // restricted to a role or group the app user is not in; no one's list can prove the viewer may see it
  if (sealedIds.some(id => !liveIds.has(id))) return fail('RESTRICTED_EVIDENCE');
  const restricted = new Set([
    ...(snapshot.restrictedComments ?? []).map(c => c.id).filter(id => liveIds.has(id)),
    ...sealedIds.filter(id => restrictedNow.has(id))
  ]);
  if (restricted.size > 0) {
    const visible = await deps.jira.getVisibleCommentIds(issue.id);
    if (!visible.ok) return fail('JIRA_UNREACHABLE');
    const seen = new Set(visible.value);
    if ([...restricted].some(id => !seen.has(id))) return fail('RESTRICTED_EVIDENCE');
  }
  const worklogs = await checkSealedWorklogs(snapshot, issue.id, deps);
  if (worklogs) return worklogs;
  const history: WorkEffortStatus[] = [];
  for (let from = 1; from <= seal.workEffort.statusHead.seq; from += HISTORY_PAGE_SIZE) {
    history.push(...(await repo.getStatusRows(issue.id, from, seal.workEffort.statusHead.seq)));
  }
  const now = new Date().toISOString();
  const resolver = new PartyResolver(new PartyRepository(deps.storage));
  const parties: Record<string, string | null> = {};
  for (const token of historyTokens(history)) {
    const accountId = await resolver.resolve(token);
    // null means a closed account; a token the app cannot name is left out (L-8)
    if (accountId) parties[token] = accountId;
    else if (await resolver.isClosed(token)) parties[token] = null;
  }
  if (!deps.signer) console.error(`${UNSIGNED_LOG} Evidence of issue ${issue.id}.`);
  return {
    format: 'ledgerseal-evidence/1',
    exportedAt: now,
    publicKeyId: deps.signer?.keyId ?? null,
    ...(deps.signer ? {} : { warning: UNSIGNED_EVIDENCE }),
    attestation: buildAttestation(attestationSource(seal), STORED_STATUS[seal.workEffort.currentStatusId], now, deps.signer ?? null),
    snapshot: canonicalForm(snapshot),
    history,
    parties,
    verification: VERIFICATION_STEPS
  };
}

/**
 * Revokes the current seal (spec v2 section 7.5): an approver gives a reason, the seal ends, and the gate closes.
 */
export async function revokeFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const accountId = context?.accountId ? String(context.accountId) : '';
  if (!accountId) return fail('NO_IDENTITY');
  if (licenseInactive(context)) return fail('LICENSE_INACTIVE');
  const issue = contextIssue(context);
  if (!issue) return fail('MISSING_ISSUE');
  const reason = validReason(payload?.reason);
  if (!reason) return fail('REASON_REQUIRED', 'Give a reason for revoking the seal (1 to 500 characters).');

  const permission = await isApprover(deps.jira, deps.storage, issue.id);
  if (!permission.ok) return fail(permission.error === 'FORBIDDEN' ? 'NOT_APPROVER' : 'JIRA_UNREACHABLE');
  if (!permission.value) return fail('NOT_APPROVER');

  const repo = new SealRepository(deps.storage);
  const conversion = await convertIfNeeded(deps, repo, issue.id);
  if (conversion === 'JIRA_UNREACHABLE') return fail('JIRA_UNREACHABLE');
  if (conversion === 'BUSY') return fail('CONFLICT');
  const seal = await repo.getSeal(issue.id);
  if (!seal) return fail('NOT_SEALED', 'This issue is not sealed, so there is nothing to revoke.');
  if (seal === 'missing' || !isConsistent(seal)) return fail('INVALID_REQUEST', 'The seal record failed its integrity check, so it cannot be revoked. Seal the issue again.');
  const we = seal.workEffort;
  const transitionName = canChange(we.currentStatusId, 'LS_REVOKED');
  if (!transitionName) return fail('INVALID_REQUEST', 'This seal is already revoked.');

  // Separation of duties (B2): a user who changed the issue after the seal cannot revoke it
  const live = await readLiveSnapshot(deps.jira, issue.id, new Date().toISOString(), { party: await new PartyRepository(deps.storage).partyForRead() });
  if (!live) return fail('JIRA_UNREACHABLE');
  const self = await changedSince(deps, issue.id, live, seal, accountId);
  if (self === null) return fail('JIRA_UNREACHABLE');
  if (self) return fail('SELF_APPROVAL', SELF_REVOKE_MESSAGE);

  const now = new Date().toISOString();
  const parties = new PartyRepository(deps.storage);
  const party = await parties.partyForWrite();
  const row = buildStatusRow(we.statusHead, {
    workEffortId: we.workEffortId,
    statusId: 'LS_REVOKED',
    statusDatetime: now,
    setByPartyId: party(accountId),
    reason,
    transitionName,
    data: { certificateId: we.currentContentId }
  });
  if (!(await repo.appendStatus(row))) return fail('CONFLICT');
  await parties.register([accountId], party, now);

  const ended = { ...seal.assignment, thruDate: now };
  const updated: LoadedSeal = {
    assignment: ended,
    sealingRow: seal.sealingRow,
    headRow: row,
    workEffort: withRecordHash({
      ...we,
      currentStatusId: 'LS_REVOKED',
      lastStatusUpdate: now,
      revisionNumber: row.seq,
      statusHead: { seq: row.seq, entryHash: row.entryHash },
      currentAssignment: { ...we.currentAssignment, assignmentHash: assignmentHash(ended) }
    })
  };
  await commitAfterClaim(repo, row, () => repo.saveRevocation(updated.workEffort, ended));
  await writeAttestation(deps, updated, 'SEAL_REVOKED', now);
  return { ok: true as const, revokedAt: now };
}
