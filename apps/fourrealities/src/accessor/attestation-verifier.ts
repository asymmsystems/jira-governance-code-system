/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: checks the Ed25519 signature of a DefinitionGuard or LedgerSeal record (ADR-010).
 * Both producers sign the canonical JSON (keys sorted at every level, no white space) of every
 * field except sig, with the key named by keyId.
 */

import * as crypto from 'crypto';
import { AttestationCheck, SiblingProducer } from '../contract/data/models';
import { ForgeEnvironment, TRUSTED_KEYS, TrustedKey } from './attestation-keys';

/** Checks one sibling record for one issue; the result is a fact for the gate engine. */
export type AttestationCheckFn = (producer: SiblingProducer, record: unknown, issueId: string) => AttestationCheck;

/** Canonical JSON of a value read from JSON: the same bytes both producers sign. */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** The keys trusted in a Forge environment; an unknown environment is treated as production. */
export function trustedKeysFor(environment: string | undefined, all: readonly TrustedKey[] = TRUSTED_KEYS): TrustedKey[] {
  const env: ForgeEnvironment = environment === 'DEVELOPMENT' || environment === 'STAGING' ? environment : 'PRODUCTION';
  return all.filter(k => k.environments.includes(env));
}

/** Checks the record's signature against the trusted keys of its producer and the issue read. */
export function verifyAttestation(producer: SiblingProducer, record: unknown, issueId: string, keys: readonly TrustedKey[]): AttestationCheck {
  const r = (record && typeof record === 'object' ? record : {}) as Record<string, unknown>;
  if (typeof r.sig !== 'string' || !r.sig || typeof r.keyId !== 'string') return 'UNSIGNED';
  const key = keys.find(k => k.producer === producer && k.keyId === r.keyId);
  if (!key) return 'UNKNOWN_KEY';
  if (String(r.issueId) !== String(issueId)) return 'WRONG_ISSUE';
  const { sig, ...signed } = r;
  try {
    const ok = crypto.verify(null, Buffer.from(canonicalJson(signed), 'utf8'), crypto.createPublicKey(key.pem), Buffer.from(String(sig), 'base64'));
    return ok ? 'VERIFIED' : 'BAD_SIGNATURE';
  } catch {
    return 'BAD_SIGNATURE';
  }
}

/** A check function bound to a set of trusted keys. */
export function attestationChecker(keys: readonly TrustedKey[]): AttestationCheckFn {
  return (producer, record, issueId) => verifyAttestation(producer, record, issueId, keys);
}
