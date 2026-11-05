#!/usr/bin/env node
/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal open verifier (spec v2 section 11). Checks a LedgerSeal evidence export without access to the app:
 * the snapshot hash, the history chain, the attestation's certificate and the Ed25519 signature.
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

  let sigOk = false;
  try {
    sigOk = typeof att.sig === 'string' && verify(null, Buffer.from(canonicalJson(without(att, 'sig')), 'utf8'), createPublicKey(publicKeyPem), Buffer.from(att.sig, 'base64'));
  } catch {
    sigOk = false;
  }
  check(sigOk, `signature (${att.keyId ?? 'no key id'})`);

  for (const line of results) console.log(line);
  return results.every(line => line.startsWith('PASS'));
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
