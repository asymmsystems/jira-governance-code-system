/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import api from '@forge/api';
import Resolver from '@forge/resolver';
import { kvs, WhereConditions } from '@forge/kvs';
import { validateTransitionGate } from './validator/workflow-validator';
import { SealRepository, StorageProvider } from './storage/seal-repository';
import { PartyRepository } from './storage/party-repository';
import { createJiraClient } from './jira/jira-client';
import { signerFromEnvironment } from './domain/attestation';
import {
  evaluate,
  evidenceFlow,
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
  const party = await new PartyRepository(deps.storage).partyForRead();
  const live = await readLiveSnapshot(deps.jira, issueId || issueKey, now, {
    party,
    apply: raw =>
      modifiedFields && typeof modifiedFields === 'object' && raw?.fields ? { ...raw, fields: { ...raw.fields, ...modifiedFields } } : raw
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

export const handler = resolver.getDefinitions();
