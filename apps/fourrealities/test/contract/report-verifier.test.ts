/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: contract test of the evidence report and the open verifier (HLD 13): the verifier
 * (tools/verifier/verify-fourrealities-report.mjs) accepts a report made by the real engine and signer with a
 * generated key, rejects one changed byte in each file, a changed header, a wrong key and an unsigned report,
 * and checks the hash chain to the previous manifest, so a removed report shows as a break.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { ADMIN, caller, change, harness } from '../manager/report-harness';
import { objectKey } from '../../src/manager/default-evidence-report-manager';

const VERIFIER = path.join(__dirname, '..', '..', '..', '..', 'tools', 'verifier', 'verify-fourrealities-report.mjs');
const RANGE = { from: '2026-10-01', to: '2026-11-01' };

function verify(args: string[]) {
  const r = spawnSync(process.execPath, [VERIFIER, ...args], { encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

async function report(h: ReturnType<typeof harness>) {
  const created = await h.manager.create(caller(), ADMIN, RANGE);
  if (!created.ok) throw new Error('not created');
  await h.drain();
  return created.reportId;
}

/** Writes the report files of one report to a fresh folder; returns their paths. */
function files(h: ReturnType<typeof harness>, reportId: string, dir: string) {
  const out: Record<string, string> = {};
  for (const name of ['manifest.json', 'report.json', 'report.csv'] as const) {
    out[name] = path.join(dir, `${reportId}-${name}`);
    fs.writeFileSync(out[name], h.objects.objects.get(objectKey('10000', reportId, name)) as string);
  }
  return out;
}

/** The file with one byte changed in the middle. */
function flip(file: string): string {
  const bytes = fs.readFileSync(file);
  const i = Math.floor(bytes.length / 2);
  bytes[i] = bytes[i] === 0x41 ? 0x42 : 0x41;
  const out = `${file}.tampered`;
  fs.writeFileSync(out, bytes);
  return out;
}

describe('the open verifier and a real report', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fr-report-'));
  let h: ReturnType<typeof harness>;
  let first: Record<string, string>;
  let second: Record<string, string>;
  let key: string;

  beforeAll(async () => {
    h = harness();
    h.issues.push(
      { id: '201', created: '2026-09-01T00:00:00.000Z', changes: [change('1', '2026-10-03T10:00:00.000Z', 'acc-ana', 'status', '1', '3', 'To Do', 'Done')] },
      { id: '202', created: '2026-10-09T00:00:00.000Z' }
    );
    const a = await report(h);
    const b = await report(h);
    first = files(h, a, dir);
    second = files(h, b, dir);
    key = path.join(dir, 'key.pub.pem');
    fs.writeFileSync(key, h.publicKey.export({ format: 'pem', type: 'spki' }) as string);
  });

  it('passes every check of an untouched report, and notes the first report of the chain', () => {
    const r = verify([first['manifest.json'], first['report.json'], first['report.csv'], key]);
    expect(r.out).toContain('PASS report.json hash and size');
    expect(r.out).toContain('PASS report.csv hash and size');
    expect(r.out).toContain('PASS manifest signature (fr-test-key)');
    expect(r.out).toContain('PASS report.json header matches the manifest');
    expect(r.out).toContain('NOTE this is the first report of the project');
    expect(r.status).toBe(0);
  });

  it.each(['report.json', 'report.csv', 'manifest.json'])('fails when one byte of %s changes', name => {
    const args = [first['manifest.json'], first['report.json'], first['report.csv']];
    const index = ['manifest.json', 'report.json', 'report.csv'].indexOf(name);
    args[index] = flip(first[name]);
    const r = verify([...args, key]);
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/FAIL/);
  });

  it('fails a manifest whose header no longer matches report.json, even with a fresh hash', () => {
    const data = JSON.parse(fs.readFileSync(first['report.json'], 'utf8'));
    data.header.range.from = '2026-09-01T00:00:00.000Z';
    const changed = path.join(dir, 'header-changed.json');
    fs.writeFileSync(changed, JSON.stringify(data));
    const r = verify([first['manifest.json'], changed, first['report.csv'], key]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('FAIL report.json hash and size');
    expect(r.out).toContain('FAIL report.json header matches the manifest');
  });

  it('fails with a key that did not sign the report', () => {
    const other = path.join(dir, 'other.pub.pem');
    fs.writeFileSync(other, require('crypto').generateKeyPairSync('ed25519').publicKey.export({ format: 'pem', type: 'spki' }));
    const r = verify([first['manifest.json'], first['report.json'], first['report.csv'], other]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('FAIL manifest signature (fr-test-key)');
  });

  it('checks the hash chain: the second report names the first manifest; another manifest breaks the chain', () => {
    expect(verify([second['manifest.json'], second['report.json'], second['report.csv'], key, '--previous', first['manifest.json']]).status).toBe(0);
    const broken = verify([second['manifest.json'], second['report.json'], second['report.csv'], key, '--previous', flip(first['manifest.json'])]);
    expect(broken.status).toBe(1);
    expect(broken.out).toMatch(/FAIL chain: previous report/);
    const self = verify([second['manifest.json'], second['report.json'], second['report.csv'], key, '--previous', second['manifest.json']]);
    expect(self.status).toBe(1);
    expect(verify([second['manifest.json'], second['report.json'], second['report.csv'], key]).out).toContain('NOTE the previous report is');
  });

  it('fails the signature check of an unsigned report, and refuses missing files with exit 2', async () => {
    const u = harness({ keys: false });
    u.issues.push({ id: '1', created: '2026-10-09T00:00:00.000Z' });
    const id = await report(u);
    const f = files(u, id, dir);
    const r = verify([f['manifest.json'], f['report.json'], f['report.csv'], key]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('FAIL manifest signature (the report is not signed)');
    expect(verify([f['manifest.json']]).status).toBe(2);
    expect(verify([f['manifest.json'], f['report.json'], path.join(dir, 'none.csv')]).status).toBe(2);
    expect(verify([f['manifest.json'], f['report.json'], f['report.csv'], path.join(dir, 'none.pem')]).status).toBe(2);
  });
});
