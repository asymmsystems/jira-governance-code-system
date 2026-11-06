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
 * Tests of the LedgerSeal open verifier, run with the Node test runner.
 *
 * @author Fahim Farook
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFIER = join(HERE, '..', 'verify-evidence.mjs');
const FIXTURES = join(HERE, 'fixtures');

function run(args) {
  return spawnSync(process.execPath, [VERIFIER, ...args], { encoding: 'utf8' });
}

describe('LedgerSeal Offline Verifier', () => {
  it('passes canonical JSON self-test against vectors.json', () => {
    const res = run(['--self-test']);
    assert.strictEqual(res.status, 0);
    assert.match(res.stdout, /PASS \d+ of \d+ vectors/);
  });

  it('validates authentic evidence export with published public key', () => {
    const res = run([
      join(FIXTURES, 'valid-evidence.json'),
      join(FIXTURES, 'test-key.pub.pem')
    ]);
    assert.strictEqual(res.status, 0);
    assert.match(res.stdout, /PASS snapshot hash/);
    assert.match(res.stdout, /PASS history chain/);
    assert.match(res.stdout, /PASS attestation names the newest seal/);
    assert.match(res.stdout, /PASS signature/);
  });

  it('rejects tampered ticket snapshot with exit code 1', () => {
    const res = run([
      join(FIXTURES, 'tampered-snapshot.json'),
      join(FIXTURES, 'test-key.pub.pem')
    ]);
    assert.strictEqual(res.status, 1);
    assert.match(res.stdout, /FAIL snapshot hash/);
  });

  it('rejects broken history hash chain with exit code 1', () => {
    const res = run([
      join(FIXTURES, 'broken-chain.json'),
      join(FIXTURES, 'test-key.pub.pem')
    ]);
    assert.strictEqual(res.status, 1);
    assert.match(res.stdout, /FAIL history chain/);
  });

  it('rejects evidence signed with an untrusted or mismatched key with exit code 1', () => {
    const res = run([
      join(FIXTURES, 'valid-evidence.json'),
      join(FIXTURES, 'wrong-key.pub.pem')
    ]);
    assert.strictEqual(res.status, 1);
    assert.match(res.stdout, /FAIL signature/);
  });

  it('accepts named --evidence and --public-key flags in either order', () => {
    const valid = run([
      '--public-key', join(FIXTURES, 'test-key.pub.pem'),
      '--evidence', join(FIXTURES, 'valid-evidence.json')
    ]);
    assert.strictEqual(valid.status, 0);
    assert.match(valid.stdout, /PASS signature/);

    const tampered = run([
      '--evidence', join(FIXTURES, 'tampered-snapshot.json'),
      '--public-key', join(FIXTURES, 'test-key.pub.pem')
    ]);
    assert.strictEqual(tampered.status, 1);
    assert.match(tampered.stdout, /FAIL snapshot hash/);

    const wrongKey = run([
      '--evidence', join(FIXTURES, 'valid-evidence.json'),
      '--public-key', join(FIXTURES, 'wrong-key.pub.pem')
    ]);
    assert.strictEqual(wrongKey.status, 1);
    assert.match(wrongKey.stdout, /FAIL signature/);
  });

  it('passes evidence with a redaction entry (LedgerSeal ADR-010) and names the redaction', () => {
    const res = run([join(FIXTURES, 'redacted-evidence.json'), join(FIXTURES, 'redaction-key.pub.pem')]);
    assert.strictEqual(res.status, 0);
    assert.match(res.stdout, /PASS history chain \(2 entries\)/);
    assert.match(res.stdout, /NOTE entry 2 is a redaction: 5 account ids and names were replaced by party tokens/);
    assert.match(res.stdout, /NOTE "parties" maps party tokens to account ids/);
  });

  it('fails evidence whose redaction entry was edited, with exit code 1', () => {
    const evidence = JSON.parse(readFileSync(join(FIXTURES, 'redacted-evidence.json'), 'utf8'));
    evidence.history[1].data.redactedValues = 0;
    const dir = mkdtempSync(join(tmpdir(), 'lsv-'));
    const file = join(dir, 'edited.json');
    writeFileSync(file, JSON.stringify(evidence));
    const res = run([file, join(FIXTURES, 'redaction-key.pub.pem')]);
    assert.strictEqual(res.status, 1);
    assert.match(res.stdout, /FAIL history chain/);
  });

  it('prints no note for evidence without a redaction entry', () => {
    const res = run([join(FIXTURES, 'valid-evidence.json'), join(FIXTURES, 'test-key.pub.pem')]);
    assert.doesNotMatch(res.stdout, /NOTE/);
  });

  it('fails cleanly with exit code 2 when arguments or files are missing', () => {
    const noArgs = run([]);
    assert.strictEqual(noArgs.status, 2);

    const missingKey = run([
      join(FIXTURES, 'valid-evidence.json'),
      join(FIXTURES, 'nonexistent-key.pem')
    ]);
    assert.strictEqual(missingKey.status, 2);
  });
});
