#!/usr/bin/env node
/**
 * Copyright (c) 2026 Asymm Systems.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * LedgerSeal open verifier (LedgerSeal spec v2 section 11, spec v4 section 15.7). Checks a LedgerSeal evidence export without
 * access to the app: the snapshot hash, the history chain, the attestation's certificate, the attestation's status and the
 * Ed25519 signature. For format 2 (ledgerseal-evidence/2) it also checks the signing policies and that every signature
 * made under a code-signing policy carries its code check.
 * It also names each redaction entry (LS_REDACTED) in the history, where account ids were replaced by party tokens.
 * Uses the Node standard library only.
 *
 * Usage:
 *   node verify-evidence.mjs <evidence.json> [public-key.pem]   exit 0 when every check passes, 1 when one fails
 *   node verify-evidence.mjs --evidence <evidence.json> [--public-key <public-key.pem>]   same, with named flags
 *   node verify-evidence.mjs --self-test                         checks the canonical JSON against vectors.json
 * Exit 2 means a missing argument or file.
 * Without a key file, the key is read from keys/<keyId>.pub.pem next to this script, then from ../keys/.
 *
 * @author Fahim Farook
 */

import { createHash, createPublicKey, verify } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GENESIS = '0'.repeat(64);

/** Canonical JSON: keys sorted by UTF-16 code unit at every level, no whitespace (spec v2 section 4.1). */
export function canonicalJson(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter(k => value[k] !== undefined).sort((a, b) => (a < b ? -1 : 1));
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  }
  return 'null';
}

const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
const without = (obj, field) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== field));

function selfTest() {
  const { vectors } = JSON.parse(readFileSync(join(HERE, 'vectors.json'), 'utf8'));
  const failed = vectors.filter(v => canonicalJson(JSON.parse(v.canonical)) !== v.canonical);
  for (const v of failed) console.log(`FAIL ${v.name}`);
  console.log(`${failed.length === 0 ? 'PASS' : 'FAIL'} ${vectors.length - failed.length} of ${vectors.length} vectors`);
  return failed.length === 0;
}

function verifyEvidence(evidence, publicKeyPem) {
  const results = [];
  const check = (ok, text) => results.push(`${ok ? 'PASS' : 'FAIL'} ${text}`) && ok;
  const att = evidence.attestation || {};

  check(sha256(canonicalJson(evidence.snapshot)) === att.snapshotHash, 'snapshot hash');

  const history = [...(evidence.history || [])].sort((a, b) => a.seq - b.seq);
  let prev = GENESIS;
  let chainOk = history.length > 0;
  history.forEach((row, i) => {
    if (row.seq !== i + 1 || row.prevEntryHash !== prev || sha256(canonicalJson(without(row, 'entryHash'))) !== row.entryHash) chainOk = false;
    prev = row.entryHash;
  });
  check(chainOk, `history chain (${history.length} entries)`);

  const newestSeal = [...history].reverse().find(row => row.statusId === 'LS_SEALED');
  check(Boolean(newestSeal) && newestSeal.data?.certificateId === att.certificateId, 'attestation names the newest seal');

  // The attestation's status must be the state of the newest entry that is not a redaction
  const STATUS = { LS_SEALED: 'SEAL_VALID', LS_CHANGED: 'SEAL_BROKEN', LS_REVOKED: 'SEAL_REVOKED' };
  const newestState = [...history].reverse().find(row => row.statusId !== 'LS_REDACTED');
  check(Boolean(newestState) && STATUS[newestState.statusId] === att.status, `attestation status matches the history (${att.status ?? 'none'})`);

  let sigOk = false;
  try {
    sigOk = typeof att.sig === 'string' && verify(null, Buffer.from(canonicalJson(without(att, 'sig')), 'utf8'), createPublicKey(publicKeyPem), Buffer.from(att.sig, 'base64'));
  } catch {
    sigOk = false;
  }
  check(sigOk, `signature (${att.keyId ?? 'no key id'})`);

  // Format 2 only (LedgerSeal spec v4 section 15.7); format 1 output is unchanged
  if (evidence.format === 'ledgerseal-evidence/2') verifyFormat2(evidence, history, check);

  // A redaction entry is part of the chain, so the checks above cover it; it is named so a reader sees it
  const notes = history
    .filter(row => row.statusId === 'LS_REDACTED')
    .map(row => `NOTE entry ${row.seq} is a redaction: ${row.data?.redactedValues ?? 'some'} account ids and names were replaced by party tokens, and the entries before it were rewritten (head hash before: ${row.data?.previousHeadHash ?? 'not given'}).`);
  if (evidence.parties) notes.push('NOTE "parties" maps party tokens to account ids (null: a closed account). It is not signed and no check uses it.');
  for (const line of [...results, ...notes]) console.log(line);
  return results.every(line => line.startsWith('PASS'));
}

const SIGNING_METHOD = 'LS_ATL_EMAIL_OTP_1';
const SIGNED_TRANSITIONS = new Set(['SEAL', 'RESEAL', 'REVOKE', 'SIGN_STAGE', 'REJECT']);

/** The policy versions, oldest first, each hashing to its policyHash and naming the one before (check 10a). */
function checkPolicies(policies) {
  let prev = GENESIS;
  return policies.every((p, i) => {
    const ok = p.version === i + 1 && p.prevPolicyHash === prev && sha256(canonicalJson(without(p, 'policyHash'))) === p.policyHash;
    prev = p.policyHash;
    return ok;
  });
}

/**
 * Check 10: every seal, reseal, revoke, stage signature and rejection made while a code-signing policy that names the
 * snapshot's project was on carries data.signing with two components and that policy's version and hash. A row that
 * claims code signing must name a policy of the evidence.
 */
function checkCodeSigning(history, policies, projectId) {
  const bad = [];
  for (const row of history) {
    if (!SIGNED_TRANSITIONS.has(row.transitionName)) continue;
    const inForce = [...policies].reverse().find(p => String(p.fromDate) <= String(row.statusDatetime));
    const required = Boolean(inForce && inForce.enabled && Array.isArray(inForce.projectIds) && inForce.projectIds.includes(projectId));
    const s = row.data?.signing;
    const named = s ? policies.find(p => p.version === s.policyVersion) : null;
    const wellFormed = s && s.method === SIGNING_METHOD && s.components === 2 && named && named.policyHash === s.policyHash;
    if (required ? !wellFormed || s.policyVersion !== inForce.version : s && !wellFormed) bad.push(row.seq);
  }
  return bad;
}

function verifyFormat2(evidence, history, check) {
  const policies = [...(evidence.signingPolicies || [])].sort((a, b) => a.version - b.version);
  check(checkPolicies(policies), `signing policies (${policies.length} versions)`);
  const bad = checkCodeSigning(history, policies, String(evidence.snapshot?.projectId ?? ''));
  check(bad.length === 0, `code signing on every signature that needs it${bad.length ? ` (entries ${bad.join(', ')})` : ''}`);
}

function main(args) {
  if (args.includes('--self-test')) return selfTest() ? 0 : 1;
  let evidencePath = null;
  let keyPath = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--evidence' && args[i + 1]) {
      evidencePath = args[++i];
    } else if (args[i] === '--public-key' && args[i + 1]) {
      keyPath = args[++i];
    } else if (!args[i].startsWith('--')) {
      if (!evidencePath) evidencePath = args[i];
      else if (!keyPath) keyPath = args[i];
    }
  }
  if (!evidencePath) {
    console.error('Usage: node verify-evidence.mjs [--evidence] <evidence.json> [--public-key] [public-key.pem] | --self-test');
    return 2;
  }
  if (!existsSync(evidencePath)) {
    console.error(`No evidence file: ${evidencePath}`);
    return 2;
  }
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  const localKey = join(HERE, 'keys', `${evidence.attestation?.keyId}.pub.pem`);
  const parentKey = join(HERE, '..', 'keys', `${evidence.attestation?.keyId}.pub.pem`);
  const keyFile = keyPath || (existsSync(localKey) ? localKey : parentKey);
  if (!existsSync(keyFile)) {
    console.error(`No public key file: ${keyFile}`);
    return 2;
  }
  return verifyEvidence(evidence, readFileSync(keyFile, 'utf8')) ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
