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
import { summarise, withRecordHash } from '../domain/seal-record';
import { compareToSeal, SealedState } from '../domain/tamper-detector';
import { capped } from '../domain/display';
import { ChangelogEntry, JiraClient } from '../jira/jira-client';
import { HISTORY_PAGE_SIZE, SealRepository, StorageProvider } from '../storage/seal-repository';

export interface LedgerSealDeps {
  jira: JiraClient;
  storage: StorageProvider;
}

export type SealErrorCode =
  | 'NO_IDENTITY'
  | 'MISSING_ISSUE'
  | 'NOT_APPROVER'
  | 'SELF_APPROVAL'
  | 'JIRA_UNREACHABLE'
  | 'INVALID_REQUEST'
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
  const raw = apply(live.value);
  return { raw, snapshot: canonicalizeIssueState(raw, at, fields.value as FieldSchema[]) };
}

/** The public `ledgerseal-cert` summary. Written on seal, reseal, revoke and each new incident only. */
function propertyBody(record: SealRecord, status: string, tamperedFieldCount: number, at: string) {
  return {
    status,
    certificateId: record.certificateId,
    snapshotHash: record.snapshotHash,
    sealedAt: record.sealedAt,
    tamperedFieldCount,
    isCompromised: record.everCompromised,
    lastVerifiedAt: at
  };
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
  const sealedSnapshot = await repo.getSnapshot(record);
  if (!sealedSnapshot) return { kind: 'RECORD_INVALID', record };
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
  await deps.jira.putSealProperty(record.issueId, propertyBody(updated, 'SEAL_BROKEN', analysis.tamperedFields.length + analysis.tamperedAttachments.length, at));
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

  // Require explicit re-authentication confirmation phrase (Fixes D-01)
  const reauthConfirmation = String(signature.reauthConfirmation || '').trim();
  if (!reauthConfirmation) {
    return fail('INVALID_REQUEST', 'LedgerSeal: Signer authentication challenge required to execute sign-off.');
  }

  // Fetch real live Jira issue. Never fall back to client-supplied payload.
  const now = new Date().toISOString();
  const live = await readLiveSnapshot(deps.jira, issue.id, now);
  if (!live) return fail('JIRA_UNREACHABLE');

  const repo = new SealRepository(deps.storage);
  const snapshot = live.snapshot;

  let previous: SealRecord | null = null;
  const evaluation = await evaluate(repo, issue.id, snapshot, now);
  if (evaluation.kind === 'SEAL' || evaluation.kind === 'RECORD_INVALID') {
    previous = evaluation.record;
  }
  if (evaluation.kind === 'SEAL') {
    const status = evaluation.analysis.status;
    if (status === 'SEAL_BROKEN' || status === 'SEAL_COMPROMISED') {
      // Separation of duties: the author of a change since the last seal cannot approve it
      const changelog = await deps.jira.getChangelog(issue.id);
      if (!changelog.ok) return fail('JIRA_UNREACHABLE');
      if (authorsSince(changelog.value, previous!.sealedAt).has(accountId)) return fail('SELF_APPROVAL');
      // Record the change before the reseal, so the history shows it even if no one viewed the issue
      const incident = await recordIncidentIfNew(deps, repo, evaluation, now);
      previous = incident.record;
    }
  }

  const signerDisplayName = (await deps.jira.getUserName(accountId)) || accountId;
  // Cap meaning length to prevent storage bloat (Fixes D-15)
  const safeMeaning = String(signature.meaning || 'Approved for production release').trim().slice(0, 255);
  const certificateId = crypto.randomUUID();
  const snapshotHash = computeSnapshotHash(snapshot);

  const entry = buildEntry(previous ? previous.head : null, {
    type: previous ? 'RESEALED' : 'SEALED',
    at: now,
    actorAccountId: accountId,
    certificateId,
    data: {
      snapshotHash,
      meaning: safeMeaning,
      signerName: signerDisplayName,
      previousCertificateId: previous ? previous.certificateId : null,
      previousState: previous ? previous.state : null
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
    meaning: safeMeaning,
    declaration: { version: 'unversioned', text: String(signature.declarationText || '') },
    reason: null,
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
  await deps.jira.putSealProperty(issue.id, propertyBody(record, 'SEAL_VALID', 0, now));

  return { ok: true as const, certificateId, snapshotHash, sealedAt: now };
}

export async function verifyIssueFlow(payload: any, context: any, deps: LedgerSealDeps) {
  if (!context?.accountId) return fail('NO_IDENTITY');
  const issue = contextIssue(context);
  if (!issue) {
    throw new Error('LedgerSeal: Missing issue context.');
  }

  const now = new Date().toISOString();
  const live = await readLiveSnapshot(deps.jira, issue.id, now);
  if (!live) {
    throw new Error('LedgerSeal: Unable to retrieve authentic issue state from Jira.');
  }

  const repo = new SealRepository(deps.storage);
  const liveSnapshot = live.snapshot;
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
