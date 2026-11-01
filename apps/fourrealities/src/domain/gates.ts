/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate evaluation. Pure functions from issue facts to gate results (spec v2, Gates).
 */

import { GateResult, IssueFacts, IssueGates } from './models';

/** Started: the status category is not "new", or the status has changed at least once. */
export function isStarted(f: IssueFacts): boolean {
  return f.statusCategory !== 'new' || f.statusChanges > 0;
}

export function isDone(f: IssueFacts): boolean {
  return f.statusCategory === 'done';
}

const INTENT_TITLE_WORDS = ['adr', 'rfc', 'spec', 'decision', 'architecture', 'blueprint', 'design doc', 'tech spec', 'requirement'];
const INTENT_URL_WORDS = ['/adr', '/rfc', '/spec', 'architecture', 'decision', 'blueprint', 'design-doc'];
const INTENT_LINK_TYPE_WORDS = ['document', 'specif', 'implement', 'verif', 'satisf', 'decision', 'design'];
const INTENT_ISSUE_TYPE_WORDS = ['architecture', 'adr', 'spec', 'rfc', 'requirement', 'documentation', 'decision'];

/**
 * Intent: keyword rule carried over from v1, labelled HEURISTIC. Backlog B-15 replaces it
 * with the link-structure rule.
 */
export function evaluateIntent(f: IssueFacts): GateResult {
  const remoteHit = (f.remoteLinks || []).some(rl => {
    const title = String(rl.title || '').toLowerCase();
    const url = String(rl.url || '').toLowerCase();
    return INTENT_TITLE_WORDS.some(w => title.includes(w)) || INTENT_URL_WORDS.some(w => url.includes(w));
  });
  const linkHit = f.issueLinks.some(l => {
    const inward = String(l.linkInward || '').toLowerCase();
    const outward = String(l.linkOutward || '').toLowerCase();
    const summary = String(l.summary || '').toLowerCase();
    const typeName = String(l.typeName || '').toLowerCase();
    return INTENT_LINK_TYPE_WORDS.some(w => inward.includes(w) || outward.includes(w))
      || ['[adr]', '[spec]', '[arch]', '[rfc]'].some(p => summary.startsWith(p))
      || ['architecture decision', 'software design', 'design document'].some(p => summary.includes(p))
      || INTENT_ISSUE_TYPE_WORDS.some(w => typeName.includes(w));
  });
  if (remoteHit || linkHit) {
    return { state: 'FOUND', verification: 'HEURISTIC', reason: 'INTENT_KEYWORD_LINK' };
  }
  return isStarted(f)
    ? { state: 'MISSING', reason: 'INTENT_NONE' }
    : { state: 'NOT_APPLICABLE', reason: 'NOT_STARTED' };
}

const HEX64 = /^[0-9a-f]{64}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isIsoDate(value: unknown): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** The shape DefinitionGuard writes: {isFullySatisfied, completedCount, totalCount, checklistHash}. */
export function isDefinitionGuardShape(dod: any): boolean {
  return Boolean(dod) && typeof dod.isFullySatisfied === 'boolean'
    && isCount(dod.completedCount) && isCount(dod.totalCount) && dod.completedCount <= dod.totalCount
    && typeof dod.checklistHash === 'string' && HEX64.test(dod.checklistHash);
}

/** The shape LedgerSeal writes: status, UUID certificate id, SHA-256 hex hash, ISO seal date. */
export function isLedgerSealShape(cert: any): boolean {
  return Boolean(cert) && typeof cert.status === 'string'
    && typeof cert.certificateId === 'string' && UUID.test(cert.certificateId)
    && typeof cert.snapshotHash === 'string' && HEX64.test(cert.snapshotHash)
    && isIsoDate(cert.sealedAt);
}

/**
 * An attestation that carries issuedAt (sibling schema v2) is stale when the issue changed after it.
 * Records without issuedAt cannot be checked for freshness.
 */
function isStale(record: any, f: IssueFacts): boolean {
  return isIsoDate(record?.issuedAt) && isIsoDate(f.updated) && Date.parse(f.updated as string) > Date.parse(record.issuedAt);
}

/**
 * Process: the Definition of Done record from DefinitionGuard, read as a hint only.
 * FourRealities never verifies it, so it never shows as verified (spec v2, Process).
 */
export function evaluateProcess(f: IssueFacts): GateResult {
  const dod = f.properties.dod;
  if (dod !== undefined && dod !== null) {
    if (!isDefinitionGuardShape(dod)) {
      return { state: 'MISSING', reason: 'DOD_SHAPE_UNKNOWN' };
    }
    const args = { completed: dod.completedCount, total: dod.totalCount };
    if (dod.isFullySatisfied) {
      return isStale(dod, f)
        ? { state: 'NEEDS_RECHECK', reason: 'CHANGED_SINCE_ATTESTATION' }
        : { state: 'FOUND', verification: 'NOT_VERIFIED', reason: 'DOD_COMPLETE_DG', args };
    }
    return isDone(f) ? { state: 'MISSING', reason: 'DOD_OPEN_DG', args } : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
  }
  return isDone(f)
    ? { state: 'MISSING', reason: 'DOD_NONE' }
    : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
}

/**
 * Code: a recorded exception is its own state, never a pass. The pull request rule is the
 * v1 approval heuristic until backlog B-10.
 */
export function evaluateCode(f: IssueFacts): GateResult {
  if (f.exception?.code) {
    return { state: 'EXCEPTED', reason: 'CODE_EXCEPTED' };
  }
  const prs = f.pullRequests || [];
  let prCount = prs.length;
  let approved = prs.some(pr =>
    (Array.isArray(pr.reviewers) && pr.reviewers.some((r: any) => r.approvalStatus === 'APPROVED')) || pr.status === 'APPROVED');
  if (prCount === 0 && typeof f.devField.raw === 'string' && f.devField.raw.includes('pullrequest')) {
    prCount = 1;
    approved = f.devField.raw.includes('APPROVED');
  }
  if (prCount > 0) {
    return approved
      ? { state: 'FOUND', verification: 'HEURISTIC', reason: 'PR_APPROVED' }
      : { state: 'MISSING', reason: 'PR_OPEN_AT_DONE' };
  }
  return isDone(f)
    ? { state: 'MISSING', reason: 'PR_NONE' }
    : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
}

/**
 * Audit: the LedgerSeal record, read as a hint only. Shapes that LedgerSeal does not write,
 * such as {valid: true}, are evidence missing (spec v2, Audit; FR-04).
 */
export function evaluateAudit(f: IssueFacts): GateResult {
  const cert = f.properties.ledgerseal;
  if (cert !== undefined && cert !== null) {
    if (!isLedgerSealShape(cert)) {
      return { state: 'MISSING', reason: 'SEAL_SHAPE_UNKNOWN' };
    }
    if (cert.status === 'SEAL_BROKEN' || cert.status === 'SEAL_COMPROMISED' || cert.isCompromised === true) {
      return { state: 'MISSING', reason: 'SEAL_BROKEN_LS' };
    }
    if (cert.status === 'SEAL_VALID') {
      return isStale(cert, f)
        ? { state: 'NEEDS_RECHECK', reason: 'CHANGED_SINCE_ATTESTATION' }
        : { state: 'FOUND', verification: 'NOT_VERIFIED', reason: 'SEAL_VALID_LS', args: { sealedAt: cert.sealedAt } };
    }
    return isDone(f)
      ? { state: 'MISSING', reason: 'SEAL_OTHER_LS', args: { status: cert.status } }
      : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
  }
  return isDone(f)
    ? { state: 'MISSING', reason: 'SEAL_NONE' }
    : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
}

export function evaluateGates(f: IssueFacts): IssueGates {
  return {
    intent: evaluateIntent(f),
    process: evaluateProcess(f),
    code: evaluateCode(f),
    audit: evaluateAudit(f)
  };
}
