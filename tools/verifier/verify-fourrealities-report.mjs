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
 * FourRealities evidence report verifier (FourRealities spec v4 section 11.3, ADR-015). Checks a report
 * offline, without access to Jira or the app: (1) the SHA-256 and byte count of report.json and report.csv
 * against the manifest; (2) the Ed25519 signature of the manifest with the public key named by keyId;
 * (3) that the header of report.json equals the manifest without files, keyId and sig; (4) with --previous,
 * that the manifest's previous.manifestSha256 is the SHA-256 of the previous manifest. The people file is
 * not signed and is not needed. Uses the Node standard library only.
 *
 * Usage:
 *   node verify-fourrealities-report.mjs <manifest.json> <report.json> <report.csv> [public-key.pem] [--previous <manifest.json>]
 * Exit 0 when every check passes, 1 when one fails, 2 for a missing argument or file.
 * Without a key file, the key is read from keys/<keyId>.pub.pem next to this script, then from ../keys/.
 *
 * @author Fahim Farook
 */

import { createHash, createPublicKey, verify } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from './verify-evidence.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FORMAT = 'fourrealities-evidence-report/1';
const DATA_FORMAT = 'fourrealities-evidence-report-data/1';

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
const without = (obj, fields) => Object.fromEntries(Object.entries(obj).filter(([k]) => !fields.includes(k)));

/** The checks of one report; each result line starts with PASS or FAIL. */
export function verifyReport({ manifestText, reportJson, reportCsv, publicKeyPem, previousText }) {
  const results = [];
  const check = (ok, text) => results.push(`${ok ? 'PASS' : 'FAIL'} ${text}`) && ok;
  let manifest;
  try {
    manifest = JSON.parse(manifestText.toString('utf8'));
  } catch {
    check(false, 'manifest is JSON');
    return results;
  }
  check(manifest.format === FORMAT, `manifest format (${manifest.format ?? 'none'})`);

  const files = Array.isArray(manifest.files) ? manifest.files : [];
  for (const [name, bytes] of [['report.json', reportJson], ['report.csv', reportCsv]]) {
    const entry = files.find(f => f && f.name === name);
    check(Boolean(entry) && entry.bytes === bytes.length && entry.sha256 === sha256(bytes), `${name} hash and size`);
  }

  let sigOk = false;
  if (typeof manifest.sig === 'string' && typeof manifest.keyId === 'string' && publicKeyPem) {
    try {
      sigOk = verify(null, Buffer.from(canonicalJson(without(manifest, ['sig'])), 'utf8'), createPublicKey(publicKeyPem), Buffer.from(manifest.sig, 'base64'));
    } catch {
      sigOk = false;
    }
  }
  check(sigOk, manifest.sig ? `manifest signature (${manifest.keyId ?? 'no key id'})` : 'manifest signature (the report is not signed)');

  let headerOk = false;
  try {
    const data = JSON.parse(reportJson.toString('utf8'));
    headerOk = data.format === DATA_FORMAT && canonicalJson(data.header) === canonicalJson(without(manifest, ['files', 'keyId', 'sig']));
  } catch {
    headerOk = false;
  }
  check(headerOk, 'report.json header matches the manifest');

  if (previousText !== undefined) {
    let prev = null;
    try {
      prev = JSON.parse(previousText.toString('utf8'));
    } catch {
      prev = null;
    }
    const link = manifest.previous;
    const ok = Boolean(prev && link) && link.reportId === prev.reportId && link.manifestSha256 === sha256(Buffer.from(canonicalJson(prev), 'utf8')) && prev.projectId === manifest.projectId;
    check(ok, `chain: previous report ${link?.reportId ?? 'none'}`);
  } else if (manifest.previous) {
    results.push(`NOTE the previous report is ${manifest.previous.reportId}; check it with --previous <its manifest.json>.`);
  } else {
    results.push('NOTE this is the first report of the project (previous is null).');
  }
  return results;
}

function main(args) {
  const positional = [];
  let previousPath;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--previous' && args[i + 1]) previousPath = args[++i];
    else if (!args[i].startsWith('--')) positional.push(args[i]);
  }
  const [manifestPath, jsonPath, csvPath, keyArg] = positional;
  if (!manifestPath || !jsonPath || !csvPath) {
    console.error('Usage: node verify-fourrealities-report.mjs <manifest.json> <report.json> <report.csv> [public-key.pem] [--previous <manifest.json>]');
    return 2;
  }
  for (const p of [manifestPath, jsonPath, csvPath, ...(previousPath ? [previousPath] : [])]) {
    if (!existsSync(p)) {
      console.error(`No file: ${p}`);
      return 2;
    }
  }
  const manifestText = readFileSync(manifestPath);
  let keyId;
  try {
    keyId = JSON.parse(manifestText.toString('utf8')).keyId;
  } catch {
    keyId = undefined;
  }
  let publicKeyPem;
  if (keyArg) {
    if (!existsSync(keyArg)) {
      console.error(`No public key file: ${keyArg}`);
      return 2;
    }
    publicKeyPem = readFileSync(keyArg, 'utf8');
  } else if (typeof keyId === 'string' && /^[a-z0-9-]{1,40}$/.test(keyId)) {
    const local = join(HERE, 'keys', `${keyId}.pub.pem`);
    const parent = join(HERE, '..', 'keys', `${keyId}.pub.pem`);
    const file = existsSync(local) ? local : parent;
    if (!existsSync(file)) {
      console.error(`No public key file: ${file}`);
      return 2;
    }
    publicKeyPem = readFileSync(file, 'utf8');
  }
  const lines = verifyReport({
    manifestText,
    reportJson: readFileSync(jsonPath),
    reportCsv: readFileSync(csvPath),
    publicKeyPem,
    previousText: previousPath ? readFileSync(previousPath) : undefined
  });
  for (const line of lines) console.log(line);
  return lines.some(l => l.startsWith('FAIL')) ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
