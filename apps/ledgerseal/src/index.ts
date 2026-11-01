import api from '@forge/api';
import Resolver from '@forge/resolver';
import { kvs } from '@forge/kvs';
import { validateTransitionGate } from './validator/workflow-validator';
import { SealRepository, StorageProvider } from './storage/seal-repository';
import { createJiraClient } from './jira/jira-client';
import { signerFromEnvironment } from './domain/attestation';
import {
  evaluate,
  historyFlow,
  issueChangedFlow,
  LedgerSealDeps,
  readLiveSnapshot,
  recordIncidentIfNew,
  sealIssueFlow,
  verifyIssueFlow
} from './service/ledger';

export { LedgerSealDeps } from './service/ledger';

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

  async createIfAbsent(key: string, value: any): Promise<boolean> {
    try {
      await kvs.set(key, value, { keyPolicy: 'FAIL_IF_EXISTS' });
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
}

export function forgeDeps(asUser: boolean): LedgerSealDeps {
  return {
    jira: createJiraClient(api.asApp(), asUser ? api.asUser() : null),
    storage: new ForgeKvsProvider(),
    signer: signerFromEnvironment(process.env)
  };
}

export const JIRA_UNREACHABLE_MESSAGE =
  'LedgerSeal could not read the issue from Jira, so this transition is blocked. Try again in a minute.';

/**
 * Handles workflow transition validation:
 * Reads the seal from app storage and verifies it against the live issue before allowing the transition.
 * Supports both documented Forge validator payloads: { issue: { key } } and { issue: { id } }.
 * Evaluates transition.modifiedFields to prevent transition-screen bypasses.
 */
export async function validateTransition(payload: any, context?: any, deps: LedgerSealDeps = forgeDeps(false)) {
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

  // Read the live issue and apply transition-screen modifiedFields if present
  const modifiedFields = payload?.transition?.modifiedFields;
  const live = await readLiveSnapshot(deps.jira, issueId || issueKey, now, raw =>
    modifiedFields && typeof modifiedFields === 'object' && raw?.fields ? { ...raw, fields: { ...raw.fields, ...modifiedFields } } : raw
  );
  // Fail closed, name the real cause, and write nothing (LS-08, LS-19)
  if (!live) {
    return { result: false, errorMessage: JIRA_UNREACHABLE_MESSAGE };
  }
  issueId = String(live.raw.id || issueId);
  const liveSnapshot = live.snapshot;
  const evaluation = await evaluate(repository, issueId, liveSnapshot, now);

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
    const unsealed = validateTransitionGate(null, liveSnapshot);
    return { result: false, errorMessage: unsealed.errorMessage };
  }

  const record = evaluation.record;
  const validation = validateTransitionGate(
    {
      snapshotHash: record.snapshotHash,
      snapshot: evaluation.sealedSnapshot,
      revoked: record.state === 'REVOKED',
      compromised: record.lastIncidentHash !== null
    },
    liveSnapshot,
    {
      certificateId: record.certificateId,
      sealedAt: record.sealedAt,
      signerName: record.sealedBy.displayName,
      revocationReason: record.revocation?.reason,
      revokedAt: record.revocation?.revokedAt
    }
  );

  if (!validation.isValid) {
    // A new change is recorded once, and the property is updated with the real count (Fixes C-3)
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
 * Product event trigger: issue updated, commented, attachment and work log events.
 */
export async function onIssueChanged(event: any, context?: any, deps: LedgerSealDeps = forgeDeps(false)) {
  return issueChangedFlow(event, deps);
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

resolver.define('seal-history-api', async (req) => {
  return await getSealHistory(req.payload, req.context);
});

export const handler = resolver.getDefinitions();
