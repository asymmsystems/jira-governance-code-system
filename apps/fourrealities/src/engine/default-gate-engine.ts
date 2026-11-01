/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate evaluation. Pure functions from issue facts to gate results (spec v2, Gates).
 */

import { GateResult, IssueFacts, IssueGates } from '../contract/data/models';
import { DEFAULT_CATALOG, EVIDENCE_REF_MAX, EvidenceCatalog } from '../contract/data/catalog';
import { GateEngine } from '../contract/engines';

/** Started is a fact parsed from Jira (status category not "new", or a status change). */
export function isStarted(f: IssueFacts): boolean {
  return f.started;
}

export function isDone(f: IssueFacts): boolean {
  return f.statusCategory === 'done';
}

/** An observation of one catalog source: verification from the catalog, reference cut to size. */
function observed(c: EvidenceCatalog, method: string, result: GateResult, ref?: unknown): GateResult {
  const verification = c.sources[method]?.verification;
  return {
    ...result,
    ...(result.state === 'FOUND' && verification ? { verification } : {}),
    method,
    ...(ref === undefined || ref === null || ref === '' ? {} : { evidenceRef: String(ref).slice(0, EVIDENCE_REF_MAX) })
  };
}

function isSameSiteContentPage(url: string | undefined, siteHost: string | undefined, prefix: string): boolean {
  if (!url || !siteHost) return false;
  try {
    const parsed = new URL(url);
    return parsed.host === siteHost && parsed.pathname.startsWith(prefix);
  } catch {
    return false;
  }
}

/**
 * Intent: a Confluence page on this site, or an issue of a decision or specification type,
 * is linked. FourRealities reads the link itself (VERIFIED) and does not read the page.
 * Title keywords never count (FR-13).
 */
export function evaluateIntent(f: IssueFacts, c: EvidenceCatalog = DEFAULT_CATALOG): GateResult {
  const rule = c.intent;
  const page = (f.remoteLinks || []).find(rl =>
    rule.contentApplicationTypes.includes(String(rl.applicationType || '')) || isSameSiteContentPage(rl.url, f.siteHost, rule.sameSiteContentPath));
  if (page) {
    return observed(c, 'CONFLUENCE_PAGE_LINK', { state: 'FOUND', reason: 'INTENT_CONFLUENCE_LINK', args: { title: String(page.title || page.url || '') } }, page.url || page.title);
  }
  const decision = f.issueLinks.find(l => rule.issueTypes.includes(String(l.typeName || '').trim().toLowerCase()));
  if (decision) {
    return observed(c, 'DECISION_ISSUE_LINK', { state: 'FOUND', reason: 'INTENT_DECISION_ISSUE', args: { key: String(decision.key || ''), type: String(decision.typeName) } }, decision.key);
  }
  if (!isStarted(f)) {
    return { state: 'NOT_APPLICABLE', reason: 'NOT_STARTED' };
  }
  return f.remoteLinks === undefined
    ? { state: 'NEEDS_RECHECK', reason: 'INTENT_LINKS_NOT_READ' }
    : { state: 'MISSING', reason: 'INTENT_NONE' };
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
export function evaluateProcess(f: IssueFacts, c: EvidenceCatalog = DEFAULT_CATALOG): GateResult {
  const dod = f.properties.dod;
  if (dod !== undefined && dod !== null) {
    const seen = (result: GateResult, ref?: unknown) => observed(c, 'DEFINITIONGUARD_PROPERTY', result, ref);
    if (!isDefinitionGuardShape(dod)) {
      return seen({ state: 'MISSING', reason: 'DOD_SHAPE_UNKNOWN' });
    }
    const args = { completed: dod.completedCount, total: dod.totalCount };
    if (dod.isFullySatisfied) {
      return isStale(dod, f)
        ? seen({ state: 'NEEDS_RECHECK', reason: 'CHANGED_SINCE_ATTESTATION' }, dod.checklistHash)
        : seen({ state: 'FOUND', reason: 'DOD_COMPLETE_DG', args }, dod.checklistHash);
    }
    return isDone(f) ? seen({ state: 'MISSING', reason: 'DOD_OPEN_DG', args }, dod.checklistHash) : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
  }
  return isDone(f)
    ? { state: 'MISSING', reason: 'DOD_NONE' }
    : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
}

/**
 * Code: pull request state from the Jira Development field, labelled HEURISTIC. Apps cannot
 * read review approvals (research H11), so a merged pull request is never shown as approved.
 * A Code exception applies only to work with no pull request (FR-10).
 */
export function evaluateCode(f: IssueFacts, c: EvidenceCatalog = DEFAULT_CATALOG): GateResult {
  if (!f.devField.present) {
    return { state: 'NOT_APPLICABLE', reason: 'NO_DEV_TOOL' };
  }
  const pr = f.devField.summary;
  const merged = pr.mergedCount > 0 || (pr.state === 'MERGED' && pr.count > 0);
  const open = !merged && (pr.openCount > 0 || (pr.state === 'OPEN' && pr.count > 0));
  // Only an approved exception counts (ADR-001: a waiting request leaves the evidence missing).
  if (f.codeException?.status === 'APPROVED' && pr.count === 0) {
    return observed(c, 'GATE_EXCEPTION', { state: 'EXCEPTED', reason: 'CODE_EXCEPTED' }, `approved ${f.codeException.decidedAt || f.codeException.requestedAt}`);
  }
  const prs = `pull requests: ${pr.count}`;
  if (merged) {
    return observed(c, 'DEVELOPMENT_FIELD', { state: 'FOUND', reason: 'PR_MERGED', args: { count: pr.count } }, prs);
  }
  if (open) {
    return isDone(f)
      ? observed(c, 'DEVELOPMENT_FIELD', { state: 'MISSING', reason: 'PR_OPEN_AT_DONE' }, prs)
      : observed(c, 'DEVELOPMENT_FIELD', { state: 'FOUND', reason: 'PR_OPEN' }, prs);
  }
  return isDone(f)
    ? { state: 'MISSING', reason: 'PR_NONE' }
    : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
}

/**
 * Audit: the LedgerSeal record, read as a hint only. Shapes that LedgerSeal does not write,
 * such as {valid: true}, are evidence missing (spec v2, Audit; FR-04).
 */
export function evaluateAudit(f: IssueFacts, c: EvidenceCatalog = DEFAULT_CATALOG): GateResult {
  const cert = f.properties.ledgerseal;
  if (cert !== undefined && cert !== null) {
    const seen = (result: GateResult) => observed(c, 'LEDGERSEAL_PROPERTY', result, isLedgerSealShape(cert) ? cert.certificateId : undefined);
    if (!isLedgerSealShape(cert)) {
      return seen({ state: 'MISSING', reason: 'SEAL_SHAPE_UNKNOWN' });
    }
    if (cert.status === 'SEAL_BROKEN' || cert.status === 'SEAL_COMPROMISED' || cert.isCompromised === true) {
      return seen({ state: 'MISSING', reason: 'SEAL_BROKEN_LS' });
    }
    if (cert.status === 'SEAL_VALID') {
      return isStale(cert, f)
        ? seen({ state: 'NEEDS_RECHECK', reason: 'CHANGED_SINCE_ATTESTATION' })
        : seen({ state: 'FOUND', reason: 'SEAL_VALID_LS', args: { sealedAt: cert.sealedAt } });
    }
    return isDone(f)
      ? seen({ state: 'MISSING', reason: 'SEAL_OTHER_LS', args: { status: cert.status } })
      : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
  }
  return isDone(f)
    ? { state: 'MISSING', reason: 'SEAL_NONE' }
    : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
}

export function evaluateGates(f: IssueFacts, c: EvidenceCatalog = DEFAULT_CATALOG): IssueGates {
  return {
    intent: evaluateIntent(f, c),
    process: evaluateProcess(f, c),
    code: evaluateCode(f, c),
    audit: evaluateAudit(f, c)
  };
}

export class DefaultGateEngine implements GateEngine {
  readonly serviceType = 'engine' as const;

  constructor(private readonly catalog: EvidenceCatalog = DEFAULT_CATALOG) {}

  evaluate(facts: IssueFacts): IssueGates {
    return evaluateGates(facts, this.catalog);
  }
}
