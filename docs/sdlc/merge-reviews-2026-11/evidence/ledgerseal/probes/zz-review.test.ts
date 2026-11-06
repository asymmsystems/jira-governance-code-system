/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Merge review probe (not committed): master writes an old record, the branch reads, converts and erases.
 *
 * @author Fahim Farook
 */

import { spawnSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '', privacy: {} }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));

// master code
import * as oldIndex from '../zzmaster/src/index';
import { createSigner as oldCreateSigner } from '../zzmaster/src/domain/attestation';
import * as oldFakes from '../zzmaster/test/support/fakes';
// branch code
import * as newIndex from '../src/index';
import { createSigner } from '../src/domain/attestation';
import * as fakes from './support/fakes';
import { convertRecord } from '../src/service/conversion';

const OUT = '/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/ledgerseal/probe-out';
const VERIFIER = path.resolve(__dirname, '../../../tools/verifier/verify-evidence.mjs');
const pair = crypto.generateKeyPairSync('ed25519');
const b64 = pair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
const keyFile = path.join(OUT, 'probe-key.pub.pem');
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(keyFile, pair.publicKey.export({ format: 'pem', type: 'spki' }));

function verify(name: string, evidence: any) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, JSON.stringify(evidence, null, 2));
  const run = spawnSync(process.execPath, [VERIFIER, file, keyFile], { encoding: 'utf8' });
  return { status: run.status, out: run.stdout + run.stderr };
}

const PEOPLE = ['acc-ann', 'acc-bob', 'acc-mallory', 'acc-assignee', 'acc-mention', 'acc-commenter'];
const NAMES = ['Ann Approver', 'Bob Second', 'Assignee Person', 'Mentioned Person', 'Commenter Person'];

function richIssue(base: any) {
  base.fields.assignee = { accountId: 'acc-assignee', displayName: 'Assignee Person', emailAddress: 'a@x.test', active: true };
  base.fields.description = {
    type: 'doc', version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ask ' }, { type: 'mention', attrs: { id: 'acc-mention', text: '@Mentioned Person' } }] }]
  };
  base.fields.comment = {
    comments: [{ id: '501', author: { accountId: 'acc-commenter', displayName: 'Commenter Person' }, created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', body: 'looks fine' }]
  };
  return base;
}

describe('review: master record, branch reads it', () => {
  it('old evidence verifies; converted and new evidence verify; no id remains; closure erases', async () => {
    // ---- master writes ----
    const oldSigner = oldCreateSigner(b64, 'probe-key');
    const ojira = new oldFakes.FakeJira(richIssue(oldFakes.sampleIssue()));
    ojira.approvers = new Set(['acc-ann', 'acc-bob']);
    (ojira as any).users = { 'acc-ann': 'Ann Approver', 'acc-bob': 'Bob Second' };
    const ostore = new oldFakes.MemoryStore();
    const odeps = { jira: ojira, storage: ostore, signer: oldSigner } as any;
    ojira.currentUser = 'acc-ann';
    const s1 = await oldIndex.sealIssue({ signature: oldFakes.validSignature() }, oldFakes.panelContext('acc-ann'), odeps);
    expect(s1).toMatchObject({ ok: true });
    ojira.edit('acc-mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed by mallory');
    ojira.currentUser = 'acc-viewer';
    await oldIndex.verifyIssue({}, oldFakes.panelContext('acc-viewer'), odeps);
    ojira.currentUser = 'acc-bob';
    const s2 = await oldIndex.sealIssue({ signature: oldFakes.validSignature({ reason: 'CAB ok' }) }, oldFakes.panelContext('acc-bob'), odeps);
    expect(s2).toMatchObject({ ok: true });
    ojira.currentUser = 'acc-auditor';
    const oldEvidence = await oldIndex.getSealEvidence({}, oldFakes.panelContext('acc-auditor'), odeps);
    const oldRun = verify('old-evidence.json', oldEvidence);
    expect(oldRun.out).toContain('PASS signature');
    expect(oldRun.status).toBe(0);
    expect(JSON.stringify(oldEvidence)).toContain('acc-bob');
    expect((oldEvidence as any).snapshot.canonicalizerVersion).toBe('2.1.0');

    // ---- branch reads the same storage ----
    const store = new fakes.MemoryStore();
    for (const [k, v] of ostore.map) store.map.set(k, JSON.parse(JSON.stringify(v)));
    const jira = new fakes.FakeJira(JSON.parse(JSON.stringify(ojira.issue)));
    jira.changelog = JSON.parse(JSON.stringify(ojira.changelog));
    jira.approvers = new Set(['acc-ann', 'acc-bob', 'acc-carol']);
    jira.users = { 'acc-ann': 'Ann Approver', 'acc-bob': 'Bob Second', 'acc-carol': 'Carol' };
    const deps = { jira, storage: store, signer: createSigner(b64, 'probe-key') } as any;
    jira.currentUser = 'acc-viewer';
    const v1: any = await newIndex.verifyIssue({}, fakes.panelContext('acc-viewer'), deps);
    expect(v1.status).toBe('SEAL_VALID');

    // evidence of the unconverted old record, exported by the branch
    const e0 = await newIndex.getSealEvidence({}, fakes.panelContext('acc-viewer'), deps);
    expect(verify('branch-export-unconverted.json', e0).status).toBe(0);

    // the weekly job converts, reports, and nothing is closed yet
    const reported: any[] = [];
    const r1: any = await newIndex.personalDataReport({}, {}, deps, async (accounts: any[]) => { reported.push(...accounts); return []; });
    expect(r1.conversions.CONVERTED).toBe(1);
    const dump = JSON.stringify([...store.map.entries()].filter(([k]) => !k.startsWith('ls3:party:')));
    for (const id of PEOPLE) expect(dump).not.toContain(id);
    for (const n of NAMES) expect(dump).not.toContain(n);
    const v2: any = await newIndex.verifyIssue({}, fakes.panelContext('acc-viewer'), deps);
    expect(v2.status).toBe('SEAL_VALID');
    const e1: any = await newIndex.getSealEvidence({}, fakes.panelContext('acc-viewer'), deps);
    const run1 = verify('converted-evidence.json', e1);
    expect(run1.out).toContain('NOTE entry 4 is a redaction');
    expect(run1.status).toBe(0);
    expect(e1.attestation.schemaVersion).toBe(3);
    expect(JSON.stringify(e1.attestation)).not.toContain('acc-');
    // the last property write has no account id
    const lastProp = jira.propertyWrites[jira.propertyWrites.length - 1].body;
    expect(JSON.stringify(lastProp)).not.toContain('acc-');
    // old evidence still verifies after the conversion (it is a file)
    expect(verify('old-evidence-again.json', oldEvidence).status).toBe(0);

    // a new change, SoD, approve by carol in 2.2.0
    jira.edit('acc-carol', '2099-02-01T00:00:00.000Z', 'summary', 'changed by carol');
    jira.currentUser = 'acc-carol';
    const self: any = await newIndex.sealIssue({ signature: fakes.validSignature({ reason: 'mine' }) }, fakes.panelContext('acc-carol'), deps);
    expect(self).toMatchObject({ ok: false, code: 'SELF_APPROVAL' });
    const selfRevoke: any = await newIndex.revokeSeal({ reason: 'x' }, fakes.panelContext('acc-carol'), deps);
    expect(selfRevoke).toMatchObject({ ok: false, code: 'SELF_APPROVAL' });
    jira.currentUser = 'acc-ann';
    const ok: any = await newIndex.sealIssue({ signature: fakes.validSignature({ reason: 'ok by ann' }) }, fakes.panelContext('acc-ann'), deps);
    expect(ok).toMatchObject({ ok: true });
    const e2: any = await newIndex.getSealEvidence({}, fakes.panelContext('acc-viewer'), deps);
    expect(e2.snapshot.canonicalizerVersion).toBe('2.2.0');
    expect(verify('new-evidence.json', e2).status).toBe(0);

    // closure of acc-ann: map key gone, seal still valid, evidence still verifies, parties null
    const r2: any = await newIndex.personalDataReport({}, {}, deps, async (accounts: any[]) =>
      accounts.filter(a => a.accountId === 'acc-ann').map(a => ({ accountId: a.accountId, status: 'closed' })));
    expect(r2.closed).toEqual(['acc-ann']);
    const all = JSON.stringify([...store.map.entries()]);
    expect(all).not.toContain('acc-ann');
    const v3: any = await newIndex.verifyIssue({}, fakes.panelContext('acc-viewer'), deps);
    expect(v3.status).toBe('SEAL_VALID');
    expect(v3.seal.sealedByClosed).toBe(true);
    const e3: any = await newIndex.getSealEvidence({}, fakes.panelContext('acc-viewer'), deps);
    expect(Object.values(e3.parties)).toContain(null);
    expect(verify('closed-evidence.json', e3).status).toBe(0);
    fs.writeFileSync(path.join(OUT, 'final-store.json'), JSON.stringify([...store.map.entries()], null, 1));
  });
});
