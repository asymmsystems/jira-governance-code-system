import api from '@forge/api';
import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';
import { canonicalizeIssueState } from './domain/canonicalizer';
import { generateSealCertificate } from './domain/crypto';
import { analyzeTamperState } from './domain/tamper-detector';
import { authorsSince } from './domain/policy';
import { validateTransitionGate } from './validator/workflow-validator';
import { SealRepository, StorageProvider } from './storage/seal-repository';
import { ElectronicSignature } from './domain/models';
import { createJiraClient, JiraClient } from './jira/jira-client';

class ForgeKvsProvider implements StorageProvider {
  async get<T>(key: string): Promise<T | undefined> {
    const val = await kvs.get(key);
    return val as T;
  }

  async set(key: string, value: any): Promise<void> {
    await kvs.set(key, value);
  }

  async delete(key: string): Promise<void> {
    await kvs.delete(key);
  }
}

/**
 * Everything a handler needs from the outside world. Tests pass their own; Forge uses the defaults.
 */
export interface LedgerSealDeps {
  jira: JiraClient;
  storage: StorageProvider;
}

export function forgeDeps(asUser: boolean): LedgerSealDeps {
  return {
    jira: createJiraClient(api.asApp(), asUser ? api.asUser() : null),
    storage: new ForgeKvsProvider()
  };
}

export type SealErrorCode = 'NO_IDENTITY' | 'MISSING_ISSUE' | 'NOT_APPROVER' | 'SELF_APPROVAL' | 'JIRA_UNREACHABLE' | 'INVALID_REQUEST';

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
  INVALID_REQUEST: 'LedgerSeal: invalid seal request.'
};

function fail(code: SealErrorCode): SealFailure {
  return { ok: false, code, message: MESSAGES[code] };
}

/** The issue comes from the trusted Forge context only, never from the payload. */
function contextIssue(context: any): { id: string; key: string } | null {
  const issue = context?.extension?.issue;
  if (!issue?.id) return null;
  return { id: String(issue.id), key: String(issue.key || issue.id) };
}

/**
 * Handles workflow transition validation:
 * Reads active seal and verifies against live issue state before allowing transition.
 * Supports both documented Forge validator payloads: { issue: { key } } and { issue: { id } }.
 * Evaluates transition.modifiedFields to prevent transition-screen bypasses.
 */
export async function validateTransition(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(false)) {
  const issueKey = payload?.issue?.key || payload?.issueKey;
  let issueId = String(payload?.issue?.id || payload?.issueId || '');

  // If only key is provided (Atlassian documented standard), resolve to ID
  let rawIssue: any = null;
  if (issueId || issueKey) {
    const live = await deps.jira.getIssue(issueId || issueKey);
    if (live.ok) {
      rawIssue = live.value;
      issueId = String(live.value.id || issueId);
    } else if (!issueId) {
      issueId = String(issueKey);
    }
  }

  if (!issueId) {
    return {
      result: false,
      errorMessage: 'LedgerSeal Validator: Missing issue context.'
    };
  }

  const repository = new SealRepository(deps.storage);

  const activeCert = await repository.getActiveCertificate(issueId);
  const now = new Date().toISOString();

  // Apply transition-screen modifiedFields if present
  const modifiedFields = payload?.transition?.modifiedFields;
  if (modifiedFields && typeof modifiedFields === 'object' && rawIssue?.fields) {
    rawIssue = {
      ...rawIssue,
      fields: {
        ...rawIssue.fields,
        ...modifiedFields
      }
    };
  }

  const liveSnapshot = canonicalizeIssueState(rawIssue || { id: issueId, key: issueKey || issueId }, now);
  const validation = validateTransitionGate(activeCert, liveSnapshot);

  // If activeCert exists and is tampered, update entity property to SEAL_BROKEN (Fixes C-3)
  if (activeCert && !validation.isValid) {
    await deps.jira.putSealProperty(issueId, {
      status: 'SEAL_BROKEN',
      certificateId: activeCert.certificateId,
      snapshotHash: activeCert.snapshotHash,
      sealedAt: activeCert.sealedAt,
      tamperedFieldCount: 1,
      lastVerifiedAt: now
    });
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
 * API handler to seal an issue with an electronic signature.
 * Identity and issue come from the Forge context only. Only an approver may seal (spec v2 section 7.1),
 * and a user who changed the issue since the last seal cannot approve that change (section 7.2).
 * Fails closed, without writing, if the live Jira issue cannot be retrieved.
 */
export async function sealIssue(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  const accountId = context?.accountId ? String(context.accountId) : '';
  if (!accountId) return fail('NO_IDENTITY');
  const issue = contextIssue(context);
  if (!issue) return fail('MISSING_ISSUE');
  const signature = payload?.signature;
  if (!signature) return fail('INVALID_REQUEST');

  const permission = await deps.jira.hasApproverPermission(issue.id);
  if (!permission.ok) return fail(permission.error === 'FORBIDDEN' ? 'NOT_APPROVER' : 'JIRA_UNREACHABLE');
  if (!permission.value) return fail('NOT_APPROVER');

  // Fetch real live Jira issue. Never fall back to client-supplied payload.
  const live = await deps.jira.getIssue(issue.id);
  if (!live.ok) return fail('JIRA_UNREACHABLE');

  const repository = new SealRepository(deps.storage);
  const now = new Date().toISOString();
  const snapshot = canonicalizeIssueState(live.value, now);

  // Separation of duties: the author of a change since the last seal cannot approve it
  const activeCert = await repository.getActiveCertificate(issue.id);
  if (activeCert) {
    const state = analyzeTamperState(activeCert, snapshot, now).status;
    if (state === 'SEAL_BROKEN' || state === 'SEAL_COMPROMISED') {
      const changelog = await deps.jira.getChangelog(issue.id);
      if (!changelog.ok) return fail('JIRA_UNREACHABLE');
      if (authorsSince(changelog.value, activeCert.sealedAt).has(accountId)) return fail('SELF_APPROVAL');
    }
  }

  const signerDisplayName = (await deps.jira.getUserName(accountId)) || accountId;
  const signerEmail: string | undefined = signature.signerEmail;

  // Require explicit re-authentication confirmation phrase (Fixes D-01)
  const reauthConfirmation = String(signature.reauthConfirmation || '').trim();
  if (!reauthConfirmation) {
    return { ok: false, code: 'INVALID_REQUEST', message: 'LedgerSeal: Signer authentication challenge required to execute sign-off.' };
  }

  // Cap meaning length to prevent storage bloat (Fixes D-15)
  const safeMeaning = String(signature.meaning || 'Approved for production release').trim().slice(0, 255);

  const elecSignature: ElectronicSignature = {
    signerAccountId: accountId,
    signerDisplayName,
    signerEmail: signerEmail || undefined,
    signedAt: now,
    meaning: safeMeaning,
    reasonCode: signature.reasonCode || 'APPROVAL',
    declarationText: signature.declarationText || 'I confirm this record is complete and accurate.',
    reauthConfirmation
  };

  const certificate = generateSealCertificate(snapshot, elecSignature);
  await repository.saveCertificate(certificate);

  // Publish public audit property to Jira issue without PII
  await deps.jira.putSealProperty(issue.id, {
    status: 'SEAL_VALID',
    certificateId: certificate.certificateId,
    snapshotHash: certificate.snapshotHash,
    sealedAt: certificate.sealedAt,
    tamperedFieldCount: 0,
    isCompromised: false,
    lastVerifiedAt: now
  });

  return {
    ok: true as const,
    certificateId: certificate.certificateId,
    snapshotHash: certificate.snapshotHash,
    sealedAt: certificate.sealedAt
  };
}

/**
 * API handler to verify the live tamper state of an issue.
 * Updates entity property to SEAL_BROKEN or SEAL_COMPROMISED if tamper is detected.
 */
export async function verifyIssue(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(true)) {
  if (!context?.accountId) return fail('NO_IDENTITY');
  const issue = contextIssue(context);
  if (!issue) {
    throw new Error('LedgerSeal: Missing issue context.');
  }
  const issueId = issue.id;

  const repository = new SealRepository(deps.storage);

  const activeCert = await repository.getActiveCertificate(issueId);
  const now = new Date().toISOString();

  const live = await deps.jira.getIssue(issueId);
  if (!live.ok) {
    throw new Error('LedgerSeal: Unable to retrieve authentic issue state from Jira.');
  }

  const liveSnapshot = canonicalizeIssueState(live.value, now);
  const analysis = analyzeTamperState(activeCert, liveSnapshot, now);

  // If tamper detected or compromised, persist compromise state into certificate (Fixes D-02)
  if (activeCert && (analysis.status === 'SEAL_BROKEN' || analysis.status === 'SEAL_COMPROMISED')) {
    activeCert.isCompromised = true;
    if (analysis.tamperHistory) {
      activeCert.tamperHistory = analysis.tamperHistory;
    }
    await repository.saveCertificate(activeCert);
  }

  // Keep public entity property synchronized if active certificate exists
  if (activeCert) {
    await deps.jira.putSealProperty(issueId, {
      status: analysis.status,
      certificateId: activeCert.certificateId,
      snapshotHash: activeCert.snapshotHash,
      sealedAt: activeCert.sealedAt,
      tamperedFieldCount: analysis.tamperedFields.length,
      isCompromised: Boolean(activeCert.isCompromised),
      lastVerifiedAt: now
    });
  }

  return analysis;
}

/**
 * Issue panel rendering function.
 */
export async function renderIssuePanel(context: any) {
  return {
    moduleKey: 'ledgerseal-panel',
    context
  };
}

// Register Forge Resolver for UI Kit 2 bridge invocations
const resolver = new Resolver();

resolver.define('verify-issue-api', async (req) => {
  return await verifyIssue(req.payload, req.context);
});

resolver.define('seal-issue-api', async (req) => {
  return await sealIssue(req.payload, req.context);
});

export const handler = resolver.getDefinitions();
