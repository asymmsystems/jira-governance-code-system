/**
 * The definitionguard-dod issue property, schema v2: a signed summary for other tools.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * The property is informational. The gate never reads it, because any editor or app can write
 * an issue property. A valid Ed25519 signature shows that this app wrote the value. The vendor
 * holds the private key, so a signature does not protect against the vendor.
 *
 * Key: DG_SIGNING_KEY (base64 of a PKCS#8 PEM Ed25519 private key) and DG_SIGNING_KEY_ID,
 * set as encrypted Forge variables. Without them the property is written with sig null.
 */
import * as crypto from 'crypto';
import api, { route } from '@forge/api';
import { canonicalJson } from '../domain/event-log';
import { evaluateGate } from '../domain/gate-rule';
import { DodState } from '../domain/models';

export const PROPERTY_KEY = 'definitionguard-dod';
export const MAX_TRIES = 3;

export interface Attestation {
  schemaVersion: 2;
  issueId: string;
  templateId: string;
  templateVersion: number;
  stateVersion: number;
  mandatoryTotal: number;
  mandatoryCompleted: number;
  openMandatoryItemIds: string[];
  isFullySatisfied: boolean;
  lastModifiedByAccountId: string;
  headHash: string;
  issuedAt: string;
}

export interface SignedAttestation extends Attestation {
  keyId: string | null;
  sig: string | null;
}

export function buildAttestation(state: DodState, issuedAt: string): Attestation {
  const gate = evaluateGate(state);
  const mandatory = state.criteria.filter(c => c.isMandatory);
  return {
    schemaVersion: 2,
    issueId: state.issue.sourceReferenceId,
    templateId: state.template.workEffortId,
    templateVersion: state.template.revisionNumber,
    stateVersion: state.seq,
    mandatoryTotal: mandatory.length,
    mandatoryCompleted: mandatory.length - gate.openMandatory.length,
    openMandatoryItemIds: gate.openMandatory.map(c => c.templateItemId),
    isFullySatisfied: gate.satisfied,
    lastModifiedByAccountId: state.lastModifiedByPartyId || '',
    headHash: state.headHash,
    issuedAt
  };
}

/** Ed25519 over the canonical JSON of every field except sig. */
export function signAttestation(att: Attestation, privateKeyPem: string, keyId: string): SignedAttestation {
  const unsigned = { ...att, keyId };
  const sig = crypto.sign(null, Buffer.from(canonicalJson(unsigned), 'utf8'), privateKeyPem).toString('base64');
  return { ...unsigned, sig };
}

export function verifyAttestation(signed: SignedAttestation, publicKeyPem: string): boolean {
  if (!signed.sig) return false;
  const { sig, ...unsigned } = signed;
  try {
    return crypto.verify(null, Buffer.from(canonicalJson(unsigned), 'utf8'), publicKeyPem, Buffer.from(sig, 'base64'));
  } catch {
    return false;
  }
}

function signIfConfigured(att: Attestation): SignedAttestation {
  const encoded = process.env.DG_SIGNING_KEY;
  if (encoded) {
    try {
      return signAttestation(att, Buffer.from(encoded, 'base64').toString('utf8'), process.env.DG_SIGNING_KEY_ID || 'dg-default');
    } catch {
      console.warn('DefinitionGuard: DG_SIGNING_KEY is not a usable Ed25519 key; writing an unsigned property.');
    }
  }
  return { ...att, keyId: null, sig: null };
}

export { retryPolicy } from '../jira/jira-client';
import { retryPolicy, backoffMs } from '../jira/jira-client';

/**
 * Writes the property as the app. Retries on 429 and 5xx (Retry-After honoured, else 1 s, 2 s),
 * up to MAX_TRIES. Never throws: a failed write leaves app storage authoritative.
 */
export async function publishAttestation(state: DodState, issuedAt: string): Promise<{ ok: boolean; attempts: number; status?: number }> {
  const body = JSON.stringify(signIfConfigured(buildAttestation(state, issuedAt)));
  let status = 0;
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    let res: any;
    try {
      res = await api.asApp().requestJira(route`/rest/api/3/issue/${state.issue.sourceReferenceId}/properties/${PROPERTY_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      status = res.status;
    } catch {
      status = 0;
    }
    if (status >= 200 && status < 300) return { ok: true, attempts: attempt };
    const retryable = status === 0 || status === 429 || status >= 500;
    if (!retryable || attempt === MAX_TRIES) {
      console.warn(`DefinitionGuard: issue property write failed with status ${status} after ${attempt} tries.`);
      return { ok: false, attempts: attempt, status };
    }
    await retryPolicy.sleep(backoffMs(res, attempt));
  }
  /* istanbul ignore next: the loop always returns */
  return { ok: false, attempts: MAX_TRIES, status };
}
