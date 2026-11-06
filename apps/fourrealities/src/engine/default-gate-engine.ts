/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate evaluation. Pure functions from issue facts to gate results (spec v2, Gates).
 */

import { AttestationCheck, AttestationHistory, AttestationVersion, DefinitionGuardRecord, GateResult, HeroCodersChecklistRecord, IssueFacts, IssueGates, LedgerSealRecord, SourcesInUse } from '../contract/data/models';
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
  // "Not done yet" rests on the Jira status, not on a record: the same result as no record.
  if (result.state === 'NOT_APPLICABLE' && result.reason === 'NOT_DONE') return result;
  const verification = c.sources[method]?.verification;
  return {
    ...result,
    ...(result.state === 'FOUND' && verification && !result.verification ? { verification } : {}),
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

/** A check the site does not use: not scored, shown as "Not used on this site" (ADR-013). */
const NOT_IN_USE: GateResult = { state: 'NOT_APPLICABLE', reason: 'SOURCE_NOT_IN_USE' };

/**
 * Intent: a Confluence page on this site, or an issue of a decision or specification type,
 * is linked. FourRealities reads the link itself (VERIFIED) and does not read the page.
 * Title keywords never count (FR-13). The decision issue types come from the settings (F-M6).
 * Without `sources` every check is in use (the rules before ADR-013).
 */
export function evaluateIntent(f: IssueFacts, c: EvidenceCatalog = DEFAULT_CATALOG, sources?: SourcesInUse): GateResult {
  if (sources && !sources.intent) return NOT_IN_USE;
  const rule = sources ? { ...c.intent, issueTypes: sources.decisionIssueTypes.map(t => t.trim().toLowerCase()) } : c.intent;
  const pages = (f.remoteLinks || []).filter(rl =>
    rule.contentApplicationTypes.includes(String(rl.applicationType || '')) || isSameSiteContentPage(rl.url, f.siteHost, rule.sameSiteContentPath));
  const page = pages[0];
  if (page) {
    // VERIFIED only when Confluence returned the page by its id; else the link alone (F-H4).
    // The page Confluence returned, and the link's address on this site (merge review L-2).
    const checked = pages.find(p => p.pageExists === true && (!p.url || isSameSiteContentPage(p.url, f.siteHost, rule.sameSiteContentPath)));
    const shown = checked || page;
    return observed(c, 'CONFLUENCE_PAGE_LINK', {
      state: 'FOUND', reason: 'INTENT_CONFLUENCE_LINK', args: { title: String(shown.title || shown.url || '') },
      ...(checked ? {} : { verification: 'LINK_ONLY' as const })
    }, shown.url || shown.title);
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

/**
 * Reads a DefinitionGuard record: schema v2 (mandatoryCompleted, mandatoryTotal, headHash) or the
 * older shape (completedCount, totalCount, checklistHash). Other fields, and missing account id
 * fields, are allowed. Undefined when the value is neither shape (ADR-012).
 */
export function parseDefinitionGuardRecord(value: unknown): DefinitionGuardRecord | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.isFullySatisfied !== 'boolean') return undefined;
  const v2 = v.mandatoryTotal !== undefined || v.mandatoryCompleted !== undefined || v.headHash !== undefined;
  const completed = v2 ? v.mandatoryCompleted : v.completedCount;
  const total = v2 ? v.mandatoryTotal : v.totalCount;
  const reference = v2 ? v.headHash : v.checklistHash;
  if (!isCount(completed) || !isCount(total) || completed > total || typeof reference !== 'string' || !HEX64.test(reference)) return undefined;
  return { isFullySatisfied: v.isFullySatisfied, completed, total, reference, ...(isIsoDate(v.issuedAt) ? { issuedAt: v.issuedAt as string } : {}) };
}

/** True when the value is a record shape DefinitionGuard writes (either version). */
export function isDefinitionGuardShape(value: unknown): boolean {
  return parseDefinitionGuardRecord(value) !== undefined;
}

/** The HeroCoders checklist property with a usable count of open mandatory items. */
export function isHeroCodersChecklistShape(value: unknown): value is HeroCodersChecklistRecord {
  return Boolean(value) && typeof value === 'object' && isCount((value as { uncheckedMandatoryItems?: unknown }).uncheckedMandatoryItems);
}

/** The shape LedgerSeal writes: status, UUID certificate id, SHA-256 hex hash, ISO seal date. */
export function isLedgerSealShape(value: unknown): value is LedgerSealRecord {
  const cert = (value || {}) as Partial<Record<keyof LedgerSealRecord, unknown>>;
  return Boolean(value) && typeof cert.status === 'string'
    && typeof cert.certificateId === 'string' && UUID.test(cert.certificateId)
    && typeof cert.snapshotHash === 'string' && HEX64.test(cert.snapshotHash)
    && isIsoDate(cert.sealedAt);
}

/** Plain words for why a record was not verified; the UI shows them. */
const UNVERIFIED_WHY: Record<Exclude<AttestationCheck, 'VERIFIED'>, string> = {
  UNSIGNED: 'unsigned',
  UNKNOWN_KEY: 'unknown key',
  WRONG_ISSUE: 'signed for another issue',
  BAD_SIGNATURE: 'signature does not match'
};

/**
 * What a sibling record's signature check means for its gate (ADR-012): verified records are
 * scored; unsigned records and records signed with a key FourRealities does not trust are
 * REPORTED (shown, not scored); a bad signature or a record signed for another issue is MISSING.
 */
type Trust = { kind: 'verified' } | { kind: 'reported'; why: string } | { kind: 'invalid'; why: string };

function trustOf(check: AttestationCheck | undefined): Trust {
  const c = check || 'UNSIGNED';
  if (c === 'VERIFIED') return { kind: 'verified' };
  if (c === 'BAD_SIGNATURE' || c === 'WRONG_ISSUE') return { kind: 'invalid', why: UNVERIFIED_WHY[c] };
  return { kind: 'reported', why: UNVERIFIED_WHY[c] };
}

/**
 * A sibling record's statement as a gate result. Verified: FOUND or MISSING. Not verified: scored
 * exactly like no record (ADR-012, merge review H-1): MISSING on a Done issue, not applicable
 * before Done; the text still says what the record reports and why it was not verified.
 */
function stated(trust: Trust, positive: boolean, done: boolean, result: Omit<GateResult, 'state'>): GateResult {
  if (trust.kind === 'verified') {
    return { ...result, state: positive ? 'FOUND' : 'MISSING', ...(positive ? { verification: 'VERIFIED' as const } : {}) };
  }
  if (!done) return { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
  return { ...result, state: 'MISSING', verification: 'NOT_VERIFIED', args: { ...(result.args || {}), why: trust.kind === 'reported' ? trust.why : '' } };
}

/** True when a record is older than the newest verified record already seen on the issue (a rollback). */
export function isOlder(record: AttestationVersion, seen: AttestationVersion | undefined): boolean {
  if (!seen) return false;
  // A put-back record was always issued earlier. A lower DefinitionGuard stateVersion with a later
  // issuedAt is a genuine new record after DefinitionGuard started counting again, for example
  // after a reinstall (merge review N-2), so issuedAt decides when both records carry it.
  if (record.issuedAt && seen.issuedAt) return record.issuedAt < seen.issuedAt;
  if (typeof record.stateVersion === 'number' && typeof seen.stateVersion === 'number') {
    return record.stateVersion < seen.stateVersion;
  }
  return false;
}

/** The version fields of a record, read defensively. */
function versionOf(value: unknown): AttestationVersion {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    ...(typeof v.stateVersion === 'number' && Number.isFinite(v.stateVersion) ? { stateVersion: v.stateVersion } : {}),
    ...(isIsoDate(v.issuedAt) ? { issuedAt: v.issuedAt as string } : {})
  };
}

/** The trust of a record, with a verified record older than one already seen treated as a rollback. */
function trustWithHistory(check: AttestationCheck | undefined, record: unknown, seen: AttestationVersion | undefined): Trust {
  const trust = trustOf(check);
  return trust.kind === 'verified' && isOlder(versionOf(record), seen) ? { kind: 'invalid', why: 'older than a record already seen' } : trust;
}

/**
 * The versions of this issue's sibling records that are verified and not a rollback, for the
 * history the managers keep (ADR-012).
 */
export function verifiedVersions(f: IssueFacts): AttestationHistory {
  const out: AttestationHistory = {};
  if (f.properties.dod && trustWithHistory(f.attestations?.dod, f.properties.dod, f.attestationHistory?.dod).kind === 'verified') out.dod = versionOf(f.properties.dod);
  if (f.properties.ledgerseal && trustWithHistory(f.attestations?.ledgerseal, f.properties.ledgerseal, f.attestationHistory?.ledgerseal).kind === 'verified') out.ledgerseal = versionOf(f.properties.ledgerseal);
  return out;
}

/**
 * Process: the Definition of Done record from DefinitionGuard, else the HeroCoders checklist
 * property. A verified DefinitionGuard record is scored; any record FourRealities cannot verify,
 * including every HeroCoders record, is REPORTED and not scored (ADR-012, spec v3, Process).
 */
export function evaluateProcess(f: IssueFacts, c: EvidenceCatalog = DEFAULT_CATALOG, sources?: SourcesInUse): GateResult {
  if (sources && sources.process === null) return NOT_IN_USE;
  const dod = sources?.process === 'herocoders' ? undefined : f.properties.dod;
  if (dod !== undefined && dod !== null) {
    const record = parseDefinitionGuardRecord(dod);
    if (!record) {
      return observed(c, 'DEFINITIONGUARD_PROPERTY', { state: 'MISSING', reason: 'DOD_SHAPE_UNKNOWN' });
    }
    const seen = (result: GateResult) => observed(c, 'DEFINITIONGUARD_PROPERTY', result, record.reference);
    const trust = trustWithHistory(f.attestations?.dod, dod, f.attestationHistory?.dod);
    if (trust.kind === 'invalid') {
      return seen({ state: 'MISSING', reason: 'DOD_SIGNATURE_INVALID', args: { why: trust.why } });
    }
    const args = { completed: record.completed, total: record.total };
    if (record.isFullySatisfied) {
      return seen(stated(trust, true, isDone(f), { reason: 'DOD_COMPLETE_DG', args }));
    }
    return isDone(f) ? seen(stated(trust, false, true, { reason: 'DOD_OPEN_DG', args })) : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
  }
  const checklist = sources?.process === 'definitionguard' ? undefined : f.properties.checklist;
  if (isHeroCodersChecklistShape(checklist)) {
    const open = checklist.uncheckedMandatoryItems;
    const seen = (result: GateResult) => observed(c, 'HEROCODERS_CHECKLIST_PROPERTY', result, checklist.progressText);
    const unverifiable: Trust = { kind: 'reported', why: 'Checklists for Jira records are not signed' };
    if (open === 0) return seen(stated(unverifiable, true, isDone(f), { reason: 'DOD_COMPLETE_HC' }));
    return isDone(f) ? seen(stated(unverifiable, false, true, { reason: 'DOD_OPEN_HC', args: { open } })) : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
  }
  return isDone(f)
    ? { state: 'MISSING', reason: sources?.process === 'herocoders' ? 'CHECKLIST_NONE' : 'DOD_NONE' }
    : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
}

/**
 * Code: pull request state from the Jira Development field, labelled HEURISTIC. Apps cannot
 * read review approvals (research H11), so a merged pull request is never shown as approved.
 * A Code exception applies only to work with no pull request (FR-10).
 */
export function evaluateCode(f: IssueFacts, c: EvidenceCatalog = DEFAULT_CATALOG, sources?: SourcesInUse): GateResult {
  if (!f.devField.present) {
    return { state: 'NOT_APPLICABLE', reason: 'NO_DEV_TOOL' };
  }
  if (sources && !sources.code) return NOT_IN_USE;
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
 * Audit: the LedgerSeal record. A verified record is scored; LedgerSeal's own status decides
 * whether the seal still holds (it writes SEAL_BROKEN when sealed content changes), so the issue's
 * update time is not compared (ADR-012, F-M3). Shapes LedgerSeal does not write, such as
 * {valid: true}, are evidence missing.
 */
export function evaluateAudit(f: IssueFacts, c: EvidenceCatalog = DEFAULT_CATALOG, sources?: SourcesInUse): GateResult {
  if (sources && !sources.audit) return NOT_IN_USE;
  const cert = f.properties.ledgerseal;
  if (cert !== undefined && cert !== null) {
    if (!isLedgerSealShape(cert)) {
      return observed(c, 'LEDGERSEAL_PROPERTY', { state: 'MISSING', reason: 'SEAL_SHAPE_UNKNOWN' });
    }
    const seen = (result: GateResult) => observed(c, 'LEDGERSEAL_PROPERTY', result, cert.certificateId);
    const trust = trustWithHistory(f.attestations?.ledgerseal, cert, f.attestationHistory?.ledgerseal);
    if (trust.kind === 'invalid') {
      return seen({ state: 'MISSING', reason: 'SEAL_SIGNATURE_INVALID', args: { why: trust.why } });
    }
    if (cert.status === 'SEAL_BROKEN' || cert.status === 'SEAL_COMPROMISED' || cert.isCompromised === true) {
      return isDone(f) || trust.kind === 'verified' ? seen(stated(trust, false, true, { reason: 'SEAL_BROKEN_LS' })) : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
    }
    if (cert.status === 'SEAL_VALID') {
      return seen(stated(trust, true, isDone(f), { reason: 'SEAL_VALID_LS', args: { sealedAt: cert.sealedAt } }));
    }
    return isDone(f)
      ? seen(stated(trust, false, true, { reason: 'SEAL_OTHER_LS', args: { status: cert.status } }))
      : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
  }
  return isDone(f)
    ? { state: 'MISSING', reason: 'SEAL_NONE' }
    : { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
}

export function evaluateGates(f: IssueFacts, c: EvidenceCatalog = DEFAULT_CATALOG, sources?: SourcesInUse): IssueGates {
  return {
    intent: evaluateIntent(f, c, sources),
    process: evaluateProcess(f, c, sources),
    code: evaluateCode(f, c, sources),
    audit: evaluateAudit(f, c, sources)
  };
}

export class DefaultGateEngine implements GateEngine {
  readonly serviceType = 'engine' as const;

  constructor(private readonly catalog: EvidenceCatalog = DEFAULT_CATALOG) {}

  evaluate(facts: IssueFacts, sources?: SourcesInUse): IssueGates {
    return evaluateGates(facts, this.catalog, sources);
  }

  verifiedVersions(facts: IssueFacts): AttestationHistory {
    return verifiedVersions(facts);
  }
}
