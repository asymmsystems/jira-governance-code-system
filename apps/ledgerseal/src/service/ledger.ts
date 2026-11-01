/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: seal, verify and incident flows (spec v2 section 7).
 * Decisions use app storage only. The `ledgerseal-cert` property is an output, never an input.
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';
import { canonicalizeIssueState, FieldSchema } from '../domain/canonicalizer';
import { computeSnapshotHash } from '../domain/crypto';
import { buildEntry, verifyChain } from '../domain/history';
import { CanonicalIssueSnapshot, FieldDiff, HistoryEntry, SealRecord, TamperAnalysis } from '../domain/models';
import { authorsSince } from '../domain/policy';
import { hasValidRecordHash, summarise, withRecordHash } from '../domain/seal-record';
import { compareToSeal, SealedState } from '../domain/tamper-detector';
import { capped } from '../domain/display';
import { AttestationStatus, buildAttestation, Signer } from '../domain/attestation';
import { DECLARATION, isMeaning, matchesDeclaration, validReason } from '../domain/declaration';
import { ChangelogEntry, JiraClient } from '../jira/jira-client';
import { HISTORY_PAGE_SIZE, SealRepository, StorageProvider } from '../storage/seal-repository';

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
  | 'CONFLICT';

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
  CONFLICT: 'Someone else sealed this issue a moment ago. Reload to see the new seal.'
};

export function fail(code: SealErrorCode, message: string = MESSAGES[code]): SealFailure {
  return { ok: false, code, message };
}

/** The issue comes from the trusted Forge context only, never from the payload. */
export function contextIssue(context: any): { id: string; key: string } | null {
  const issue = context?.extension?.issue;
  if (!issue?.id) return null;
  return { id: String(issue.id), key: String(issue.key || issue.id) };
}

const MAX_INCIDENT_CHANGES = 50;

/**
 * Reads the live issue and the field list, then canonicalises. Returns null when either read fails.
 */
export async function readLiveSnapshot(
  jira: JiraClient,
  issueIdOrKey: string,
  at: string,
  apply: (raw: any) => any = raw => raw
): Promise<{ raw: any; snapshot: CanonicalIssueSnapshot } | null> {
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
  return { raw, snapshot: canonicalizeIssueState(raw, at, fields.value as FieldSchema[]) };
}

/**
 * Writes the signed ledgerseal-cert attestation. Called on seal, reseal, revoke and each new incident only.
 * The property is an output for other tools; LedgerSeal itself never reads it.
 */
async function writeAttestation(deps: LedgerSealDeps, record: SealRecord, status: AttestationStatus, at: string): Promise<void> {
  const written = await deps.jira.putSealProperty(record.issueId, buildAttestation(record, status, at, deps.signer ?? null));
  if (!written) console.error(`LedgerSeal: could not write the ledgerseal-cert property on issue ${record.issueId}`);
}

/** Turns stored values into short display text, so the panel never receives the snapshot. */
function compact(analysis: TamperAnalysis): TamperAnalysis {
  return {
    ...analysis,
    tamperedFields: analysis.tamperedFields.map(diff => {
      const was = capped(diff.sealedValue);
      const now = capped(diff.liveValue);
      return { ...diff, sealedValue: was.text, liveValue: now.text, sealedTruncated: was.truncated, liveTruncated: now.truncated };
    })
  };
}

export interface SealEvaluation {
  kind: 'SEAL';
  record: SealRecord;
  sealedSnapshot: CanonicalIssueSnapshot;
  analysis: TamperAnalysis;
}

export type Evaluation = { kind: 'NONE' } | { kind: 'LEGACY' } | { kind: 'RECORD_INVALID'; record: SealRecord } | SealEvaluation;

/**
 * Compares the live issue with the stored seal. Reads only.
 */
export async function evaluate(repo: SealRepository, issueId: string, live: CanonicalIssueSnapshot, at: string): Promise<Evaluation> {
  const record = await repo.getSeal(issueId);
  if (!record) {
    return (await repo.getLegacyCertificate(issueId)) ? { kind: 'LEGACY' } : { kind: 'NONE' };
  }
  // Check the stored record and snapshot on every read (LS-10): a rewritten value fails its hash
  if (!hasValidRecordHash(record)) return { kind: 'RECORD_INVALID', record };
  const sealedSnapshot = await repo.getSnapshot(record);
  if (!sealedSnapshot || computeSnapshotHash(sealedSnapshot) !== record.snapshotHash) return { kind: 'RECORD_INVALID', record };
  const sealed: SealedState = {
    snapshotHash: record.snapshotHash,
    snapshot: sealedSnapshot,
    revoked: record.state === 'REVOKED',
    compromised: record.lastIncidentHash !== null
  };
  const analysis = { ...compareToSeal(sealed, live, at), seal: summarise(record) };
  return { kind: 'SEAL', record, sealedSnapshot, analysis };
}

/** Who changed each field after the seal, from the change log. */
function attribute(diffs: FieldDiff[], changelog: ChangelogEntry[], sinceIso: string) {
  const since = Date.parse(sinceIso);
  return diffs.slice(0, MAX_INCIDENT_CHANGES).map(diff => {
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
): Promise<{ record: SealRecord; recorded: boolean }> {
  const { record, analysis } = evaluation;
  const liveHash = analysis.liveHash;
  if (record.state !== 'ACTIVE' || analysis.status !== 'SEAL_BROKEN' || !liveHash || liveHash === record.lastIncidentHash) {
    return { record, recorded: false };
  }
  const changelog = await deps.jira.getChangelog(record.issueId);
  const changes = attribute(analysis.tamperedFields, changelog.ok ? changelog.value : [], record.sealedAt);
  const entry = buildEntry(record.head, {
    type: 'INCIDENT',
    at,
    actorAccountId: null,
    certificateId: record.certificateId,
    data: { liveHash, changes, attachmentChanges: analysis.tamperedAttachments.length }
  });
  if (!(await repo.appendEntry(record.issueId, entry))) {
    // Another writer recorded this change first.
    return { record, recorded: false };
  }
  const updated = withRecordHash({
    ...record,
    everCompromised: true,
    incidentCount: record.incidentCount + 1,
    lastIncidentHash: liveHash,
    head: { seq: entry.seq, entryHash: entry.entryHash }
  });
  await repo.saveSeal(updated);
  await writeAttestation(deps, updated, 'SEAL_BROKEN', at);
  return { record: updated, recorded: true };
}

export async function sealIssueFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const accountId = context?.accountId ? String(context.accountId) : '';
  if (!accountId) return fail('NO_IDENTITY');
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

  let previous: SealRecord | null = null;
  let previousState: string | null = null;
  const evaluation = await evaluate(repo, issue.id, snapshot, now);
  if (evaluation.kind === 'SEAL') {
    previous = evaluation.record;
    previousState = previous.state;
  }
  if (evaluation.kind === 'RECORD_INVALID') {
    // The stored counts cannot be trusted, so the new seal says the issue was compromised
    previous = { ...evaluation.record, everCompromised: true };
    previousState = 'RECORD_INVALID';
  }
  if (evaluation.kind === 'SEAL') {
    const status = evaluation.analysis.status;
    if (status === 'SEAL_BROKEN' || status === 'SEAL_COMPROMISED') {
      // Separation of duties: the author of a change since the last seal cannot approve it
      const changelog = await deps.jira.getChangelog(issue.id);
      if (!changelog.ok) return fail('JIRA_UNREACHABLE');
      if (authorsSince(changelog.value, previous!.sealedAt).has(accountId)) return fail('SELF_APPROVAL');
      if (!validReason(signature.reason)) return fail('REASON_REQUIRED');
      // Record the change before the reseal, so the history shows it even if no one viewed the issue
      const incident = await recordIncidentIfNew(deps, repo, evaluation, now);
      previous = incident.record;
    }
  }

  const signerDisplayName = (await deps.jira.getUserName(accountId)) || accountId;
  const reason = previous ? validReason(signature.reason) : null;
  const certificateId = crypto.randomUUID();
  const snapshotHash = computeSnapshotHash(snapshot);

  const entry = buildEntry(previous ? previous.head : null, {
    type: previous ? 'RESEALED' : 'SEALED',
    at: now,
    actorAccountId: accountId,
    certificateId,
    data: {
      snapshotHash,
      meaning,
      reason,
      declarationVersion: DECLARATION.version,
      signerName: signerDisplayName,
      previousCertificateId: previous ? previous.certificateId : null,
      previousState
    }
  });
  if (!(await repo.appendEntry(issue.id, entry))) return fail('CONFLICT');

  const record = withRecordHash({
    schemaVersion: 2,
    issueId: issue.id,
    issueKey: String(live.raw.key || issue.key),
    certificateId,
    state: 'ACTIVE',
    sealedAt: now,
    sealedBy: { accountId, displayName: signerDisplayName },
    meaning,
    declaration: { version: DECLARATION.version, text: DECLARATION.text },
    reason,
    statusAtSeal: snapshot.status,
    snapshotHash,
    canonicalizerVersion: '1.0.0',
    coveredFields: snapshot.fields.map(f => ({ id: f.id, name: f.name })),
    excludedFields: snapshot.excluded || [],
    snapshotChunks: 1,
    everCompromised: previous ? previous.everCompromised : false,
    incidentCount: previous ? previous.incidentCount : 0,
    lastIncidentHash: null,
    head: { seq: entry.seq, entryHash: entry.entryHash },
    revocation: null
  });
  await repo.saveSeal(record, [JSON.stringify(snapshot)]);

  // Publish public audit property to Jira issue without PII
  await writeAttestation(deps, record, 'SEAL_VALID', now);

  return { ok: true as const, certificateId, snapshotHash, sealedAt: now };
}

function errorResult(errorReason: 'JIRA_UNREACHABLE' | 'STORAGE', at: string): TamperAnalysis {
  return { status: 'ERROR', errorReason, tamperedFields: [], tamperedAttachments: [], verifiedAt: at };
}

export async function verifyIssueFlow(payload: any, context: any, deps: LedgerSealDeps) {
  if (!context?.accountId) return fail('NO_IDENTITY');
  const issue = contextIssue(context);
  if (!issue) return fail('MISSING_ISSUE');

  const now = new Date().toISOString();
  const live = await readLiveSnapshot(deps.jira, issue.id, now);
  // A read failure is reported as an error, never as "not sealed" (invariant 8)
  if (!live) return errorResult('JIRA_UNREACHABLE', now);
  try {
    return await verifyAgainstSeal(deps, issue.id, live.snapshot, now);
  } catch (err) {
    console.error('LedgerSeal: verify failed', err);
    return errorResult('STORAGE', now);
  }
}

async function verifyAgainstSeal(deps: LedgerSealDeps, issueId: string, liveSnapshot: CanonicalIssueSnapshot, now: string) {
  const issue = { id: issueId };

  const repo = new SealRepository(deps.storage);
  const evaluation = await evaluate(repo, issue.id, liveSnapshot, now);

  if (evaluation.kind === 'NONE') return compareToSeal(null, liveSnapshot, now);
  if (evaluation.kind === 'LEGACY' || evaluation.kind === 'RECORD_INVALID') {
    return { status: evaluation.kind, tamperedFields: [], tamperedAttachments: [], verifiedAt: now };
  }

  // Writes only when this change is new (invariant 3); the property is updated inside.
  const { record } = await recordIncidentIfNew(deps, repo, evaluation, now);
  return {
    ...compact({ ...evaluation.analysis, seal: summarise(record) }),
    coveredFields: record.coveredFields,
    excludedFields: record.excludedFields
  };
}

/**
 * History entries, oldest first, one page at a time, with a chain check over the page.
 */
export async function historyFlow(payload: any, context: any, deps: LedgerSealDeps) {
  if (!context?.accountId) return fail('NO_IDENTITY');
  const issue = contextIssue(context);
  if (!issue) return fail('MISSING_ISSUE');
  const repo = new SealRepository(deps.storage);
  const record = await repo.getSeal(issue.id);
  if (!record) return { ok: true as const, entries: [] as HistoryEntry[], chainValid: true, nextFromSeq: null };

  const fromSeq = Math.min(record.head.seq, Math.max(1, Math.floor(Number(payload?.fromSeq) || 1)));
  const toSeq = Math.min(record.head.seq, fromSeq + HISTORY_PAGE_SIZE - 1);
  const page = await repo.getEntries(issue.id, fromSeq, toSeq);
  const before = fromSeq > 1 ? (await repo.getEntries(issue.id, fromSeq - 1, fromSeq - 1))[0] : undefined;
  const check = verifyChain(page, before ? before.entryHash : undefined, record.head);
  // A missing entry anywhere in the page, or a missing predecessor, breaks the chain.
  const complete = page.length === toSeq - fromSeq + 1 && (fromSeq === 1 || Boolean(before));
  return {
    ok: true as const,
    entries: page,
    chainValid: check.valid && complete,
    nextFromSeq: toSeq < record.head.seq ? toSeq + 1 : null
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
    if (!(await repo.getSeal(issueId))) return { recorded: false };
    const live = await readLiveSnapshot(deps.jira, issueId, now);
    if (!live) return { recorded: false };
    const evaluation = await evaluate(repo, issueId, live.snapshot, now);
    if (evaluation.kind !== 'SEAL') return { recorded: false };
    const { recorded } = await recordIncidentIfNew(deps, repo, evaluation, now);
    return { recorded };
  } catch (err) {
    console.error('LedgerSeal: issue event handling failed', err);
    return { recorded: false };
  }
}
