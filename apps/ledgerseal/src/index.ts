/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import api from '@forge/api';
import Resolver from '@forge/resolver';
import { kvs, WhereConditions } from '@forge/kvs';
import { validateTransitionGate } from './validator/workflow-validator';
import { SealRepository, SecretStore, StorageProvider, WriteOptions } from './storage/seal-repository';
import { PartyRepository } from './storage/party-repository';
import { createJiraClient } from './jira/jira-client';
import { signerFromEnvironment } from './domain/attestation';
import {
  evaluate,
  evidenceFlow,
  licenseInactive,
  historyFlow,
  issueChangedFlow,
  LedgerSealDeps,
  readLiveSnapshot,
  recordIncidentIfNew,
  revokeFlow,
  sealIssueFlow,
  verifyIssueFlow
} from './service/ledger';
import { getPolicyFlow, searchGroupsFlow, setPolicyFlow } from './service/policy-admin';
import { ackAlertFlow, getSigningPolicyFlow, requestCodeFlow, setSigningPolicyFlow, signingAlertsFlow, SigningAuthority, unlockFlow } from './service/signing';
import { isApprover } from './service/approver';
import { completeIntent, createIntentFlow } from './service/transition-signing';
import { fail } from './service/ledger';
import { deleteIssueRecords, ReportFn, weeklyPersonalDataJob } from './service/personal-data';
import { privacy } from '@forge/api';
import { logFailure } from './service/log';

export { LedgerSealDeps } from './service/ledger';

/** Forge KVS `ttl` from a number of seconds. */
function ttlOf(options?: WriteOptions) {
  return options?.ttlSeconds ? { ttl: { value: options.ttlSeconds, unit: 'SECONDS' as const } } : {};
}

class ForgeKvsProvider implements StorageProvider, SecretStore {
  async get<T>(key: string): Promise<T | undefined> {
    const val = await kvs.get(key);
    return val as T;
  }

  async set(key: string, value: any, options?: WriteOptions): Promise<void> {
    if (options?.ttlSeconds) await kvs.set(key, value, ttlOf(options));
    else await kvs.set(key, value);
  }

  async getSecret(key: string): Promise<any> {
    return kvs.getSecret(key);
  }

  async createSecretIfAbsent(key: string, value: any): Promise<boolean> {
    try {
      await kvs.setSecret(key, value, { keyPolicy: 'FAIL_IF_EXISTS' });
      return true;
    } catch (err) {
      // Spike S-7: an existing secret answers KEY_CONFLICT; that is a lost race, not an error
      if ((await kvs.getSecret(key)) !== undefined) return false;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await kvs.delete(key);
  }

  async createIfAbsent(key: string, value: any, options?: WriteOptions): Promise<boolean> {
    try {
      await kvs.set(key, value, { keyPolicy: 'FAIL_IF_EXISTS', ...ttlOf(options) });
      return true;
    } catch (err) {
      // A failed create on an existing key is a lost race, not an error.
      if ((await kvs.get(key)) !== undefined) return false;
      throw err;
    }
  }

  async commit(items: { key: string; value: any }[]): Promise<void> {
    const tx = kvs.transact();
    for (const item of items) {
      tx.set(item.key, item.value);
    }
    await tx.execute();
  }

  async query(prefix: string): Promise<{ key: string; value: any }[]> {
    const out: { key: string; value: any }[] = [];
    let cursor: string | undefined;
    do {
      let q = kvs.query().where('key', WhereConditions.beginsWith(prefix)).limit(100);
      if (cursor) q = q.cursor(cursor);
      const page = await q.getMany<any>();
      for (const r of page.results) out.push({ key: r.key, value: r.value });
      cursor = page.nextCursor;
    } while (cursor);
    return out;
  }
}

export function forgeDeps(asUser: boolean): LedgerSealDeps {
  const store = new ForgeKvsProvider();
  return {
    jira: createJiraClient(api.asApp(), asUser ? api.asUser() : null),
    storage: store,
    secrets: store,
    signer: signerFromEnvironment(process.env)
  };
}

/**
 * The values typed on the transition screen. Forge documents `modifiedFields` at the top level of the validator
 * payload; an older source names `transition.modifiedFields`. Both are read, and the top level wins (F-03).
 */
export function transitionScreenValues(payload: any): Record<string, any> {
  const nested = payload?.transition?.modifiedFields;
  const top = payload?.modifiedFields;
  const asObject = (v: any) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  return { ...asObject(nested), ...asObject(top) };
}

/** The body of a comment typed on the transition screen, in any shape Jira may send; null when empty. */
function transitionComment(value: any): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() ? value : null;
  if (Array.isArray(value)) return value.map(v => transitionComment(v?.add?.body ?? v?.body ?? v)).find(Boolean) ?? null;
  if (typeof value === 'object') {
    if (value.type === 'doc') return Array.isArray(value.content) && value.content.length > 0 ? value : null;
    if ('body' in value) return transitionComment(value.body);
    if (Array.isArray(value.comments)) return null;
    return Object.keys(value).length > 0 ? JSON.stringify(value) : null;
  }
  return String(value);
}

/**
 * Applies the transition-screen values to the live issue (F-02). A comment typed there is added to the comment
 * list as a new comment, so it shows as "Comment added"; it never replaces the list. Attachments and work logs
 * come only from Jira.
 */
export function applyTransitionScreen(raw: any, values: Record<string, any>, at: string): any {
  if (!raw?.fields || Object.keys(values).length === 0) return raw;
  const fields = { ...raw.fields };
  for (const [key, value] of Object.entries(values)) {
    if (key === 'comment' || key === 'attachment' || key === 'worklog') continue;
    fields[key] = value;
  }
  const body = transitionComment(values.comment);
  if (body !== null) {
    const comments = Array.isArray(fields.comment?.comments) ? fields.comment.comments : [];
    fields.comment = { ...(fields.comment || {}), comments: [...comments, { id: 'transition-screen', created: at, body }] };
  }
  return { ...raw, fields };
}

export const LICENCE_INACTIVE_GATE_MESSAGE =
  'LedgerSeal: the LedgerSeal licence is not active, so this issue cannot be sealed or approved. Ask your Jira admin to renew the licence or to remove the Require Valid LedgerSeal validator from this workflow.';

/**
 * F-08: a lapsed licence does not change what the gate decides (spec D-8), but sealing and approving need a licence,
 * so a blocked transition says how to get out instead of pointing at a panel that cannot act.
 */
function withLicenceNote(result: { result: boolean; errorMessage?: string }, payload: any, context: any) {
  if (result.result || !licenseInactive(context?.license ? context : payload?.context)) return result;
  return { result: false, errorMessage: LICENCE_INACTIVE_GATE_MESSAGE };
}

export const JIRA_UNREACHABLE_MESSAGE =
  'LedgerSeal could not read the issue from Jira, so this transition is blocked. Try again in a minute.';

/**
 * Handles workflow transition validation:
 * Reads the seal from app storage and verifies it against the live issue before allowing the transition.
 * Supports both documented Forge validator payloads: { issue: { key } } and { issue: { id } }.
 * Applies the values typed on the transition screen (modifiedFields) before the check, so they cannot bypass it.
 */
export async function validateTransition(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(false)) {
  return withLicenceNote(await gate(payload, deps), payload, context);
}

async function gate(payload: any, deps: LedgerSealDeps): Promise<{ result: boolean; errorMessage?: string }> {
  const issueKey = payload?.issue?.key || payload?.issueKey;
  let issueId = String(payload?.issue?.id || payload?.issueId || '');

  if (!issueId && !issueKey) {
    return {
      result: false,
      errorMessage: 'LedgerSeal Validator: Missing issue context.'
    };
  }

  const repository = new SealRepository(deps.storage);
  const now = new Date().toISOString();

  // Read the live issue and apply the transition-screen values (F-02, F-03)
  const screen = transitionScreenValues(payload);
  // ADR-018: a signature made in the LedgerSeal field on this screen is written first, then the gate decides as usual
  const signed = await completeIntent(payload, screen, deps, raw => applyTransitionScreen(raw, screen, now));
  if (signed && !signed.ok) return { result: false, errorMessage: signed.message };
  const party = await new PartyRepository(deps.storage).partyForRead();
  const live = await readLiveSnapshot(deps.jira, issueId || issueKey, now, {
    party,
    apply: raw => applyTransitionScreen(raw, screen, now)
  });
  // Fail closed, name the real cause, and write nothing (LS-08, LS-19)
  if (!live) {
    return { result: false, errorMessage: JIRA_UNREACHABLE_MESSAGE };
  }
  issueId = String(live.raw.id || issueId);
  const evaluation = await evaluate(repository, issueId, live, now);

  if (evaluation.kind === 'LEGACY') {
    return {
      result: false,
      errorMessage: 'LedgerSeal: this issue has an old-format seal. Ask a project admin to seal it again in the LedgerSeal panel.'
    };
  }
  if (evaluation.kind === 'RECORD_INVALID') {
    return {
      result: false,
      errorMessage: 'LedgerSeal: the seal record failed its integrity check. Contact your Jira admin.'
    };
  }

  if (evaluation.kind === 'NONE') {
    const unsealed = validateTransitionGate(null, live.snapshot);
    return { result: false, errorMessage: unsealed.errorMessage };
  }

  const we = evaluation.seal.workEffort;
  const summary = evaluation.analysis.seal;
  const validation = validateTransitionGate(
    {
      snapshotHash: we.attributes.snapshotHash,
      snapshot: evaluation.sealedSnapshot,
      revoked: we.currentStatusId === 'LS_REVOKED',
      compromised: we.currentStatusId === 'LS_CHANGED'
    },
    evaluation.liveSnapshot,
    {
      certificateId: we.currentContentId,
      sealedAt: summary?.sealedAt,
      revocationReason: summary?.revocation?.reason,
      revokedAt: summary?.revocation?.revokedAt
    }
  );

  // A new change is recorded once, and the property is updated with the real count (Fixes C-3). Values typed on
  // the transition screen are not in Jira yet, and a blocked transition never saves them, so they record nothing.
  if (!validation.isValid && Object.keys(screen).length === 0) {
    await recordIncidentIfNew(deps, repository, evaluation, now);
  }

  // Strictly conform to Atlassian Forge validator schema (Fixes C-1)
  if (validation.isValid) {
    return {
      result: true
    };
  }

  return {
    result: false,
    errorMessage: validation.errorMessage || 'LedgerSeal Validator: Issue validation failed.'
  };
}

/**
 * API handler to seal an issue with an electronic signature (spec v2 section 7.3).
 */
export async function sealIssue(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  return sealIssueFlow(payload, context, deps);
}

/**
 * API handler to verify the live tamper state of an issue. Records a change incident only when the change is new.
 */
export async function verifyIssue(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  return verifyIssueFlow(payload, context, deps);
}

/**
 * API handler for the seal history, oldest first, 50 entries per page.
 */
export async function getSealHistory(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  return historyFlow(payload, context, deps);
}

/**
 * API handler to revoke a seal with a reason (spec v2 section 7.5).
 */
export async function revokeSeal(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  return revokeFlow(payload, context, deps);
}

/**
 * API handler for the auditor evidence export (spec v2 section 11).
 */
export async function getSealEvidence(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  return evidenceFlow(payload, context, deps);
}

/**
 * Admin page handlers for the approver groups (spec v2 section 7.1). Jira admins only.
 */
export async function getApproverPolicy(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  return getPolicyFlow(context, deps);
}

export async function setApproverPolicy(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  return setPolicyFlow(payload, context, deps);
}

export async function searchApproverGroups(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  return searchGroupsFlow(payload, context, deps);
}

/**
 * Product event trigger: issue updated, commented, attachment and work log events.
 */
export async function onIssueChanged(event: any, context?: any, deps: LedgerSealDeps = forgeDeps(false)) {
  return issueChangedFlow(event, deps);
}

/**
 * Product event trigger: a deleted issue's LedgerSeal records are deleted with it (ADR-011 decision 9).
 */
export async function onIssueDeleted(event: any, context?: any, storage: StorageProvider = new ForgeKvsProvider()) {
  const issueId = event?.issue?.id ? String(event.issue.id) : '';
  if (!issueId) return { deleted: 0 };
  try {
    const deleted = await deleteIssueRecords(storage, issueId);
    console.log(`LedgerSeal: issue ${issueId} deleted, ${deleted} record key(s) deleted`);
    return { deleted };
  } catch (err) {
    logFailure(`could not delete the records of deleted issue ${issueId}`, err);
    return { deleted: 0 };
  }
}

/**
 * Weekly scheduled trigger: the personal data report (ADR-011 decision 5).
 */
export async function personalDataReport(
  event?: any,
  context?: any,
  deps: LedgerSealDeps = forgeDeps(false),
  report: ReportFn = accounts => privacy.reportPersonalData(accounts)
) {
  try {
    // The function may run 300 s (manifest); conversions stop after 200 s and continue next week
    const result = await weeklyPersonalDataJob(deps, report, 200000);
    console.log(
      `LedgerSeal: personal data report: ${result.reported} account(s) reported, ${result.closed.length} closed and erased; ` +
        `${result.conversions.CONVERTED} record(s) converted, ${result.legacyStubbed} old-format record(s) cleared`
    );
    return result;
  } catch (err) {
    logFailure('the personal data report failed', err);
    return { reported: 0, closed: [] };
  }
}

/**
 * Who may ask for a signing code (ADR-016): an approver for seal, approval of changes, revoke and the transition
 * signature. Stage actions are decided by the route (ADR-017).
 */
export const signingAuthority: SigningAuthority = async (deps, issueId, action) => {
  if (action === 'SIGN_STAGE' || action === 'REJECT') return fail('NOT_APPROVER');
  const permission = await isApprover(deps.jira, deps.storage, issueId);
  if (!permission.ok) return fail(permission.error === 'FORBIDDEN' ? 'NOT_APPROVER' : 'JIRA_UNREACHABLE');
  return permission.value ? null : fail('NOT_APPROVER');
};

/** ADR-018: the signature field on the transition screen asks for a single-use signing intent. */
export async function createSigningIntent(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  return createIntentFlow(payload, context, deps);
}

/** Code signing (ADR-016): the code request, and the admin page flows. */
export async function requestSigningCode(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  return requestCodeFlow(payload, context, deps, signingAuthority);
}

export async function getSigningPolicy(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  return getSigningPolicyFlow(context, deps);
}

export async function setSigningPolicy(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  return setSigningPolicyFlow(payload, context, deps);
}

export async function getSigningAlerts(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  return signingAlertsFlow(context, deps);
}

export async function ackSigningAlert(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  return ackAlertFlow(payload, context, deps);
}

export async function unlockSigning(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  return unlockFlow(payload, context, deps);
}

// Register Forge Resolver for UI Kit 2 bridge invocations
const resolver = new Resolver();

resolver.define('verify-issue-api', async (req) => {
  return await verifyIssue(req.payload, req.context);
});

resolver.define('seal-issue-api', async (req) => {
  return await sealIssue(req.payload, req.context);
});

resolver.define('seal-history-api', async (req) => {
  return await getSealHistory(req.payload, req.context);
});

resolver.define('revoke-seal-api', async (req) => {
  return await revokeSeal(req.payload, req.context);
});

resolver.define('seal-evidence-api', async (req) => {
  return await getSealEvidence(req.payload, req.context);
});

resolver.define('approver-policy-get-api', async (req) => {
  return await getApproverPolicy(req.payload, req.context);
});

resolver.define('approver-policy-set-api', async (req) => {
  return await setApproverPolicy(req.payload, req.context);
});

resolver.define('approver-group-search-api', async (req) => {
  return await searchApproverGroups(req.payload, req.context);
});

resolver.define('transition-sign-intent-api', async (req) => {
  return await createSigningIntent(req.payload, req.context);
});

resolver.define('signing-code-request-api', async (req) => {
  return await requestSigningCode(req.payload, req.context);
});

resolver.define('signing-policy-get-api', async (req) => {
  return await getSigningPolicy(req.payload, req.context);
});

resolver.define('signing-policy-set-api', async (req) => {
  return await setSigningPolicy(req.payload, req.context);
});

resolver.define('signing-alerts-api', async (req) => {
  return await getSigningAlerts(req.payload, req.context);
});

resolver.define('signing-alert-ack-api', async (req) => {
  return await ackSigningAlert(req.payload, req.context);
});

resolver.define('signing-unlock-api', async (req) => {
  return await unlockSigning(req.payload, req.context);
});

export const handler = resolver.getDefinitions();
