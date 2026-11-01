/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: seal, verify and incident flows (spec v2 section 7).
 * Decisions use app storage only. The `ledgerseal-cert` property is an output, never an input.
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';
import { CANONICALIZER_VERSION, canonicalizeIssueState, FieldSchema } from '../domain/canonicalizer';
import { canonicalForm, computeSnapshotHash } from '../domain/crypto';
import { buildStatusRow, verifyChain } from '../domain/history';
import { CanonicalIssueSnapshot, FieldDiff, SealedWorkEffort, WorkEffortPartyAssignment, WorkEffortStatus, TamperAnalysis } from '../domain/models';
import { authorsSince } from '../domain/policy';
import { assignmentHash, isConsistent, LoadedSeal, summarise, withRecordHash } from '../domain/seal-record';
import { canChange, LedgerSealStatusId, roleForMeaning } from '../domain/status';
import { compareToSeal, SealedState } from '../domain/tamper-detector';
import { capped, LONG_VALUE_CHARS, richTextSummary } from '../domain/display';
import { AttestationSource, AttestationStatus, buildAttestation, Signer } from '../domain/attestation';
import { DECLARATION, isMeaning, matchesDeclaration, validReason } from '../domain/declaration';
import { ChangelogEntry, JiraClient } from '../jira/jira-client';
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
  | 'LICENSE_INACTIVE';

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
  LICENSE_INACTIVE: 'The LedgerSeal licence is not active. Ask your Jira admin to renew it.'
};

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

/** One read of the live issue: the raw issue, the field list, and its snapshot in the current canonical form. */
export interface LiveRead {
  raw: any;
  fields: FieldSchema[];
  snapshot: CanonicalIssueSnapshot;
}

/**
 * Reads the live issue and the field list, then canonicalises. Returns null when either read fails.
 */
export async function readLiveSnapshot(
  jira: JiraClient,
  issueIdOrKey: string,
  at: string,
  apply: (raw: any) => any = raw => raw
): Promise<LiveRead | null> {
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
  return { raw, fields: schemas, snapshot: canonicalizeIssueState(raw, at, schemas, CANONICALIZER_VERSION) };
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
async function writeAttestation(deps: LedgerSealDeps, seal: LoadedSeal, status: AttestationStatus, at: string): Promise<void> {
  const issueId = seal.workEffort.workEffortId;
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
    sealedByAccountId: seal.assignment.partyId,
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
  // Compare under the canonical form the seal was made with (spec v2 section 4.1)
  const version = we.attributes.canonicalizerVersion;
  let liveSnapshot = live.snapshot;
  if (version !== liveSnapshot.canonicalizerVersion) {
    try {
      liveSnapshot = canonicalizeIssueState(live.raw, at, live.fields, version);
    } catch {
      // Rules this app does not have cannot check the seal, so it is not shown as valid
      return { kind: 'RECORD_INVALID', workEffort: we };
    }
  }
  const sealed: SealedState = {
    snapshotHash: we.attributes.snapshotHash,
    snapshot: sealedSnapshot,
    revoked: we.currentStatusId === 'LS_REVOKED',
    compromised: we.currentStatusId === 'LS_CHANGED'
  };
  const analysis = { ...compareToSeal(sealed, liveSnapshot, at), seal: summarise(seal) };
  return { kind: 'SEAL', seal, sealedSnapshot, analysis, liveSnapshot, liveComments: rawComments(live.raw) };
}

/** Who changed each item after the seal: comments from the comment itself, fields from the change log. */
function attribute(diffs: FieldDiff[], changelog: ChangelogEntry[], sinceIso: string, liveComments: any[] = []) {
  const since = Date.parse(sinceIso);
  const comments = new Map(liveComments.map(c => [`comment:${c.id}`, c]));
  return diffs.slice(0, MAX_INCIDENT_CHANGES).map(diff => {
    const comment = comments.get(diff.fieldId);
    if (comment) {
      const by = comment.updated ? comment.updateAuthor?.accountId : comment.author?.accountId;
      return { fieldId: diff.fieldId, fieldName: diff.fieldName, changedBy: by ? [String(by)] : [], changedAt: comment.updated ?? comment.created ?? null };
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
  at: string
): Promise<{ seal: LoadedSeal; recorded: boolean }> {
  const { seal, analysis } = evaluation;
  const we = seal.workEffort;
  const liveHash = analysis.liveHash;
  const transitionName = canChange(we.currentStatusId, 'LS_CHANGED');
  if (!transitionName || analysis.status !== 'SEAL_BROKEN' || !liveHash || liveHash === we.lastIncidentHash) {
    return { seal, recorded: false };
  }
  const changelog = await deps.jira.getChangelog(we.workEffortId);
  const changes = attribute(analysis.tamperedFields, changelog.ok ? changelog.value : [], seal.assignment.fromDate, evaluation.liveComments);
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

  const permission = await deps.jira.hasApproverPermission(issue.id);
  if (!permission.ok) return fail(permission.error === 'FORBIDDEN' ? 'NOT_APPROVER' : 'JIRA_UNREACHABLE');
  if (!permission.value) return fail('NOT_APPROVER');

  // The signer agrees to the one declaration the panel shows (LS-09)
  if (!matchesDeclaration(signature.declarationVersion, signature.declarationText)) return fail('DECLARATION_MISMATCH');
  const meaning = signature.meaning === undefined ? 'APPROVAL' : signature.meaning;
  if (!isMeaning(meaning)) return fail('INVALID_REQUEST');

  // Fetch real live Jira issue. Never fall back to client-supplied payload.
  const now = new Date().toISOString();
  const live = await readLiveSnapshot(deps.jira, issue.id, now);
  if (!live) return fail('JIRA_UNREACHABLE');

  const repo = new SealRepository(deps.storage);
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
      const changelog = await deps.jira.getChangelog(issue.id);
      if (!changelog.ok) return fail('JIRA_UNREACHABLE');
      if (authorsSince(changelog.value, previous.assignment.fromDate).has(accountId)) return fail('SELF_APPROVAL');
      if (!validReason(signature.reason)) return fail('REASON_REQUIRED');
      // Record the change before the reseal, so the history shows it even if no one viewed the issue
      previous = (await recordIncidentIfNew(deps, repo, evaluation, now)).seal;
      previousWorkEffort = previous.workEffort;
    }
    if (status === 'SEAL_REVOKED') {
      // A revoke must not open a way around separation of duties (live, DEMO-34)
      const changelog = await deps.jira.getChangelog(issue.id);
      if (!changelog.ok) return fail('JIRA_UNREACHABLE');
      if (authorsSince(changelog.value, previous.assignment.fromDate).has(accountId)) return fail('SELF_APPROVAL');
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

  const signerDisplayName = (await deps.jira.getUserName(accountId)) || accountId;
  const reason = previousState ? validReason(signature.reason) : null;
  const certificateId = crypto.randomUUID();
  const snapshotHash = computeSnapshotHash(snapshot);
  // Bounded values (B-17): each part under half the KVS limit, all parts in one transaction
  const contentParts = splitUtf8(JSON.stringify(snapshot), MAX_PART_BYTES);
  if (contentParts.length > MAX_CONTENT_PARTS) return fail('SNAPSHOT_TOO_LARGE');

  const row = buildStatusRow(previousWorkEffort ? previousWorkEffort.statusHead : null, {
    workEffortId: issue.id,
    statusId: 'LS_SEALED',
    statusDatetime: now,
    setByPartyId: accountId,
    reason,
    transitionName,
    data: {
      certificateId,
      snapshotHash,
      meaning,
      declarationVersion: DECLARATION.version,
      signerName: signerDisplayName,
      previousCertificateId: previousWorkEffort ? previousWorkEffort.currentContentId : null,
      previousState
    }
  });
  if (!(await repo.appendStatus(row))) return fail('CONFLICT');

  const assignment: WorkEffortPartyAssignment = {
    workEffortId: issue.id,
    partyId: accountId,
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
      partyId: accountId,
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
      snapshotParts: contentParts.length
    },
    everCompromised: previousWorkEffort ? previousWorkEffort.everCompromised : false,
    incidentCount: previousWorkEffort ? previousWorkEffort.incidentCount : 0,
    lastIncidentHash: null
  });
  // A reseal ends the previous assignment at this time (Silverston thruDate)
  // A revoked seal already ended at the revoke time; keep that date
  const ended = previous && previous.assignment.thruDate === null ? { ...previous.assignment, thruDate: now } : null;
  await commitAfterClaim(repo, row, () => repo.saveSeal(workEffort, assignment, contentParts, ended));

  // Publish public audit property to Jira issue without PII
  await writeAttestation(deps, { workEffort, assignment, sealingRow: row }, 'SEAL_VALID', now);

  return { ok: true as const, certificateId, snapshotHash, sealedAt: now };
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
  const live = await readLiveSnapshot(deps.jira, issue.id, now);
  // A read failure is reported as an error, never as "not sealed" (invariant 8)
  if (!live) return errorResult('JIRA_UNREACHABLE', now);
  let result: TamperAnalysis;
  try {
    result = await verifyAgainstSeal(deps, issue.id, live, now);
  } catch (err) {
    console.error('LedgerSeal: verify failed', err);
    return errorResult('STORAGE', now);
  }
  return { ...result, rights: await viewerRights(deps, issue.id, String(context.accountId), result) };
}

const CHANGED_STATES = new Set(['SEAL_BROKEN', 'SEAL_COMPROMISED']);
const SEALED_STATES = new Set(['SEAL_VALID', 'SEAL_BROKEN', 'SEAL_COMPROMISED']);

/**
 * What the viewer may do, so the panel shows only those actions (G-10). Reads only.
 * A failed permission check gives no rights; a failed change log read blocks approving changes.
 */
async function viewerRights(deps: LedgerSealDeps, issueId: string, accountId: string, result: TamperAnalysis) {
  const permission = await deps.jira.hasApproverPermission(issueId);
  const permitted = permission.ok && permission.value;
  const changed = CHANGED_STATES.has(result.status);
  let blockedBySelfChange = false;
  if (permitted && changed && result.seal) {
    const changelog = await deps.jira.getChangelog(issueId);
    blockedBySelfChange = !changelog.ok || authorsSince(changelog.value, result.seal.sealedAt).has(accountId);
  }
  return {
    canSeal: permitted && !changed,
    canApproveChanges: permitted && !blockedBySelfChange,
    canRevoke: permitted && SEALED_STATES.has(result.status),
    blockedBySelfChange
  };
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
  const incident = we.currentStatusId === 'LS_CHANGED' ? await repo.getStatusRow(we.workEffortId, we.statusHead.seq) : null;
  const recorded = new Map(((incident?.data?.changes as any[]) || []).map(c => [c.fieldId, c]));
  analysis.tamperedFields = analysis.tamperedFields.map(diff => ({
    ...diff,
    changedBy: recorded.get(diff.fieldId)?.changedBy ?? [],
    changedAt: recorded.get(diff.fieldId)?.changedAt ?? null
  }));
  return {
    ...analysis,
    coveredFields: sealed.fields.map(f => ({ id: f.id, name: f.name })),
    excludedFields: sealed.excluded || []
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
  return {
    ok: true as const,
    entries: page,
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
    const live = await readLiveSnapshot(deps.jira, issueId, now);
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
  'Check the Ed25519 signature attestation.sig over the canonical JSON of the attestation without sig, with the public key named by attestation.keyId.',
  'Run: node verify-evidence.mjs <this file> <public key file>. It performs every step and exits 0 only when all pass.'
];

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
  const history: WorkEffortStatus[] = [];
  for (let from = 1; from <= seal.workEffort.statusHead.seq; from += HISTORY_PAGE_SIZE) {
    history.push(...(await repo.getStatusRows(issue.id, from, seal.workEffort.statusHead.seq)));
  }
  const now = new Date().toISOString();
  return {
    format: 'ledgerseal-evidence/1',
    exportedAt: now,
    publicKeyId: deps.signer?.keyId ?? null,
    attestation: buildAttestation(attestationSource(seal), STORED_STATUS[seal.workEffort.currentStatusId], now, deps.signer ?? null),
    snapshot: canonicalForm(snapshot),
    history,
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

  const permission = await deps.jira.hasApproverPermission(issue.id);
  if (!permission.ok) return fail(permission.error === 'FORBIDDEN' ? 'NOT_APPROVER' : 'JIRA_UNREACHABLE');
  if (!permission.value) return fail('NOT_APPROVER');

  const repo = new SealRepository(deps.storage);
  const seal = await repo.getSeal(issue.id);
  if (!seal) return fail('NOT_SEALED', 'This issue is not sealed, so there is nothing to revoke.');
  if (seal === 'missing' || !isConsistent(seal)) return fail('INVALID_REQUEST', 'The seal record failed its integrity check, so it cannot be revoked. Seal the issue again.');
  const we = seal.workEffort;
  const transitionName = canChange(we.currentStatusId, 'LS_REVOKED');
  if (!transitionName) return fail('INVALID_REQUEST', 'This seal is already revoked.');

  const now = new Date().toISOString();
  const row = buildStatusRow(we.statusHead, {
    workEffortId: we.workEffortId,
    statusId: 'LS_REVOKED',
    statusDatetime: now,
    setByPartyId: accountId,
    reason,
    transitionName,
    data: { certificateId: we.currentContentId }
  });
  if (!(await repo.appendStatus(row))) return fail('CONFLICT');

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
