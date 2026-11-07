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
 * Tests of the FourRealities evidence report verifier, run with the Node test runner. Each test builds a
 * report the way FourRealities does (canonical JSON, SHA-256, Ed25519 over the manifest without sig) with a
 * key made for the test, so no fixture holds a real report.
 *
 * @author Fahim Farook
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from '../verify-evidence.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFIER = join(HERE, '..', 'verify-fourrealities-report.mjs');
const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');

function run(args) {
  return spawnSync(process.execPath, [VERIFIER, ...args], { encoding: 'utf8' });
}

/** A signed report of one project, linked to `previous` (a manifest text) when given. */
function makeReport(dir, name, privateKey, previous) {
  const header = {
    format: 'fourrealities-evidence-report/1', reportId: `${name}-0000-4000-8000-000000000000`, siteHost: 'example.atlassian.net', environment: 'development',
    projectId: '10000', projectKey: 'PAY', range: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' }, filters: { fieldIds: [], actors: [] },
    trigger: 'user', requestedBy: 'pty_' + 'a'.repeat(32), generatedAt: '2026-11-08T00:00:00.000Z', gatesObservedAt: '2026-11-08T00:00:00.000Z',
    counts: { issues: 1, changes: 1, missingSincePrevious: 0 },
    previous: previous ? { reportId: JSON.parse(previous).reportId, manifestSha256: sha256(previous) } : null
  };
  const json = canonicalJson({ format: 'fourrealities-evidence-report-data/1', header, issues: [{ issueId: '1', issueKey: 'PAY-1', changes: [{ changelogId: '9', fieldId: 'status' }] }], missingSincePrevious: [], warnings: [] });
  const csv = '"reportId","rowType"\r\n"r","CHANGE"\r\n';
  const unsigned = { ...header, files: [
    { name: 'report.json', mediaType: 'application/json', bytes: Buffer.byteLength(json), sha256: sha256(json) },
    { name: 'report.csv', mediaType: 'text/csv; charset=utf-8', bytes: Buffer.byteLength(csv), sha256: sha256(csv) }
  ], keyId: 'test-key' };
  const manifest = canonicalJson({ ...unsigned, sig: sign(null, Buffer.from(canonicalJson(unsigned)), privateKey).toString('base64') });
  const paths = { manifest: join(dir, `${name}-manifest.json`), json: join(dir, `${name}.json`), csv: join(dir, `${name}.csv`) };
  writeFileSync(paths.manifest, manifest);
  writeFileSync(paths.json, json);
  writeFileSync(paths.csv, csv);
  return { paths, manifest };
}

describe('FourRealities evidence report verifier', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fr-verify-'));
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const key = join(dir, 'test-key.pub.pem');
  writeFileSync(key, publicKey.export({ format: 'pem', type: 'spki' }));
  const first = makeReport(dir, 'aaaaaaaa-1111', privateKey);
  const second = makeReport(dir, 'bbbbbbbb-2222', privateKey, first.manifest);

  it('passes an untouched report and its chain link', () => {
    const res = run([second.paths.manifest, second.paths.json, second.paths.csv, key, '--previous', first.paths.manifest]);
    assert.strictEqual(res.status, 0, res.stdout);
    assert.match(res.stdout, /PASS report\.json hash and size/);
    assert.match(res.stdout, /PASS report\.csv hash and size/);
    assert.match(res.stdout, /PASS manifest signature \(test-key\)/);
    assert.match(res.stdout, /PASS report\.json header matches the manifest/);
    assert.match(res.stdout, /PASS chain: previous report aaaaaaaa-1111/);
  });

  it('fails a changed CSV with exit code 1', () => {
    const csv = join(dir, 'changed.csv');
    writeFileSync(csv, '"reportId","rowType"\r\n"r","ISSUE"\r\n');
    const res = run([first.paths.manifest, first.paths.json, csv, key]);
    assert.strictEqual(res.status, 1);
    assert.match(res.stdout, /FAIL report\.csv hash and size/);
  });

  it('fails a changed manifest, and a chain to the wrong previous report', () => {
    const changed = join(dir, 'changed-manifest.json');
    writeFileSync(changed, first.manifest.replace('"PAY"', '"PAZ"'));
    assert.strictEqual(run([changed, first.paths.json, first.paths.csv, key]).status, 1);
    const res = run([second.paths.manifest, second.paths.json, second.paths.csv, key, '--previous', second.paths.manifest]);
    assert.strictEqual(res.status, 1);
    assert.match(res.stdout, /FAIL chain/);
  });

  it('notes the first report of a project, and exits 2 for a missing argument or file', () => {
    assert.match(run([first.paths.manifest, first.paths.json, first.paths.csv, key]).stdout, /NOTE this is the first report/);
    assert.strictEqual(run([first.paths.manifest]).status, 2);
    assert.strictEqual(run([first.paths.manifest, first.paths.json, join(dir, 'none.csv')]).status, 2);
    assert.strictEqual(run([first.paths.manifest, first.paths.json, first.paths.csv]).status, 2);
  });

  it('reads the key named by keyId from keys/ when no key file is given', () => {
    const res = run([first.paths.manifest, first.paths.json, first.paths.csv]);
    assert.match(res.stderr, /No public key file: .*test-key\.pub\.pem/);
  });
});
