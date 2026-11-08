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
function makeReport(dir, name, privateKey, previous, keyId = 'test-key', environment = 'development', notReadable = [], counted = notReadable.length) {
  const header = {
    format: 'fourrealities-evidence-report/1', reportId: `${name}-0000-4000-8000-000000000000`, siteHost: 'example.atlassian.net', environment,
    projectId: '10000', projectKey: 'PAY', range: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' }, filters: { fieldIds: [], actors: [] },
    trigger: 'user', requestedBy: 'pty_' + 'a'.repeat(32), generatedAt: '2026-11-08T00:00:00.000Z', gatesObservedAt: '2026-11-08T00:00:00.000Z',
    counts: { issues: 1, changes: 1, missingSincePrevious: 0, notReadable: counted },
    previous: previous ? { reportId: JSON.parse(previous).reportId, manifestSha256: sha256(previous) } : null
  };
  const json = canonicalJson({ format: 'fourrealities-evidence-report-data/1', header, issues: [{ issueId: '1', issueKey: 'PAY-1', changes: [{ changelogId: '9', fieldId: 'status' }] }], missingSincePrevious: [], notReadable, warnings: [] });
  const csv = '"reportId","rowType"\r\n"r","CHANGE"\r\n';
  const unsigned = { ...header, files: [
    { name: 'report.json', mediaType: 'application/json', bytes: Buffer.byteLength(json), sha256: sha256(json) },
    { name: 'report.csv', mediaType: 'text/csv; charset=utf-8', bytes: Buffer.byteLength(csv), sha256: sha256(csv) }
  ], keyId };
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
    assert.match(res.stdout, /NOTE period 2026-10-01 to 2026-10-31, both days included \(UTC\); range\.to in the manifest is the exclusive end 2026-11-01\./);
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

  it('names each issue that is not in the report, and fails when the list and the signed count differ', () => {
    const gaps = [{ issueId: '12', issueKey: 'PAY-12', reason: 'NOT_READABLE' }, { issueId: '13', issueKey: 'PAY-13', reason: 'MOVED' }];
    const r = makeReport(dir, 'eeeeeeee-5555', privateKey, undefined, 'test-key', 'development', gaps);
    const res = run([r.paths.manifest, r.paths.json, r.paths.csv, key]);
    assert.strictEqual(res.status, 0);
    assert.match(res.stdout, /WARN 2 issue\(s\) of the scope are NOT in this report/);
    assert.match(res.stdout, /WARN   not in the report: PAY-12 \(id 12\): FourRealities could not read it/);
    assert.match(res.stdout, /WARN   not in the report: PAY-13 \(id 13\): in another project/);
    const bad = makeReport(dir, 'ffffffff-6666', privateKey, undefined, 'test-key', 'development', gaps, 3);
    const out = run([bad.paths.manifest, bad.paths.json, bad.paths.csv, key]);
    assert.strictEqual(out.status, 1);
    assert.match(out.stdout, /FAIL report\.json lists the 3 issues/);
    assert.doesNotMatch(run([first.paths.manifest, first.paths.json, first.paths.csv, key]).stdout, /NOT in this report/);
  });

  it('prints FAIL lines and exits 1 for a malformed range or a manifest of another shape, never a stack trace', () => {
    const bad = join(dir, 'bad-range-manifest.json');
    writeFileSync(bad, first.manifest.replace('"to":"2026-11-01T00:00:00.000Z"', '"to":"not-a-date"'));
    const res = run([bad, first.paths.json, first.paths.csv, key]);
    assert.strictEqual(res.status, 1);
    assert.match(res.stdout, /FAIL manifest range is two UTC dates, from before to/);
    assert.doesNotMatch(res.stdout + res.stderr, /RangeError|at .*\.mjs/);
    const reversed = join(dir, 'reversed-manifest.json');
    writeFileSync(reversed, first.manifest.replace('"from":"2026-10-01T00:00:00.000Z"', '"from":"2026-12-01T00:00:00.000Z"'));
    assert.match(run([reversed, first.paths.json, first.paths.csv, key]).stdout, /FAIL manifest range is two UTC dates/);
    const nul = join(dir, 'null-manifest.json');
    writeFileSync(nul, 'null');
    const out = run([nul, first.paths.json, first.paths.csv, key]);
    assert.strictEqual(out.status, 1);
    assert.match(out.stdout, /FAIL the files have a shape this verifier cannot read/);
    assert.doesNotMatch(out.stderr, /TypeError/);
  });

  it('warns for a development key, and fails a production report signed with one', () => {
    const dev = makeReport(dir, 'cccccccc-3333', privateKey, undefined, 'fr-dev-2026-11', 'development');
    const ok = run([dev.paths.manifest, dev.paths.json, dev.paths.csv, key]);
    assert.strictEqual(ok.status, 0);
    assert.match(ok.stdout, /WARN signed with the development key fr-dev-2026-11: this is a test report/);
    const prod = makeReport(dir, 'dddddddd-4444', privateKey, undefined, 'fr-dev-2026-11', 'production');
    const bad = run([prod.paths.manifest, prod.paths.json, prod.paths.csv, key]);
    assert.strictEqual(bad.status, 1);
    assert.match(bad.stdout, /FAIL signing key fr-dev-2026-11 is a development key/);
  });

  it('reads the key named by keyId from keys/ when no key file is given', () => {
    const res = run([first.paths.manifest, first.paths.json, first.paths.csv]);
    assert.match(res.stderr, /No public key file: .*test-key\.pub\.pem/);
  });
});
