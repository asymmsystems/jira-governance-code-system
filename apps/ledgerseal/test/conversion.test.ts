/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * ADR-010 decision 7 (readiness review B1): a record written before ADR-010 is converted once by a recorded
 * redaction event. Afterwards no record holds an account id or a name, the seal still matches the live issue,
 * the chain is valid, and both the old and the new evidence verify with the open verifier.
 *
 * @author Fahim Farook
 */

import { spawnSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createSigner } from '../src/domain/attestation';
import { verifyChain } from '../src/domain/history';
import { convertAll, convertRecord, stubLegacyRecords } from '../src/service/conversion';
import { getSealEvidence, personalDataReport, revokeSeal, sealIssue, validateTransition, verifyIssue } from '../src/index';
import { SealRepository } from '../src/storage/seal-repository';
import { isConsistent } from '../src/domain/seal-record';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';
import { writeOldRecord } from './support/old-record';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '', privacy: {} }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));

const VERIFIER = path.resolve(__dirname, '../../../tools/verifier/verify-evidence.mjs');
const pair = crypto.generateKeyPairSync('ed25519');
const signer = createSigner(pair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'), 'ls-test-1');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-conversion-'));
const keyFile = path.join(dir, 'ls-test-1.pub.pem');
fs.writeFileSync(keyFile, pair.publicKey.export({ format: 'pem', type: 'spki' }));

function verify(evidence: any) {
  const file = path.join(dir, `e-${crypto.randomUUID()}.json`);
  fs.writeFileSync(file, JSON.stringify(evidence));
  const run = spawnSync(process.execPath, [VERIFIER, file, keyFile], { encoding: 'utf8' });
  return { status: run.status, out: run.stdout + run.stderr };
}

/** An issue that names people in a user field, a set of users, a comment, an attachment and a mention. */
function peopleIssue() {
  const issue = sampleIssue();
  issue.fields.assignee = { accountId: 'dev-1', displayName: 'Dana Developer', emailAddress: 'dana@example.com' };
  issue.fields.customfield_5 = [
    { accountId: 'zed-9', displayName: 'Zed' },
    { accountId: 'abe-0', displayName: 'Abe' }
  ];
  issue.fields.description = {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ask ' }, { type: 'mention', attrs: { id: 'dev-1', text: '@Dana Developer', localId: 'm1' } }] }]
  };
  issue.fields.comment = { comments: [{ id: '7', author: { accountId: 'dev-1', displayName: 'Dana Developer' }, created: '2026-09-30T00:00:00.000Z', body: 'Ready' }] };
  issue.fields.attachment = [{ id: '3', filename: 'plan.txt', size: 4, mimeType: 'text/plain', created: '2026-09-30T00:00:00.000Z', author: { accountId: 'rep-1' } }];
  return issue;
}
const FIELDS = [{ id: 'customfield_5', name: 'Reviewers', schema: { type: 'array', items: 'user', custom: 'x:multiuserpicker' } }];

function setup(issue: any = peopleIssue()) {
  const jira = new FakeJira(issue);
  jira.fields = FIELDS;
  jira.approvers = new Set(['ann', 'bob']);
  const storage = new MemoryStore();
  const as = (user: string | null) => {
    jira.currentUser = user;
    return { jira, storage, signer };
  };
  return { jira, storage, as };
}

const RAW = /"(ann|bob|dev-1|zed-9|abe-0|rep-1|mallory)"|Ann Approver|Dana|Zed|Abe|example\.com/;
const recordsText = (storage: MemoryStore) => JSON.stringify([...storage.map.entries()].filter(([k]) => !k.startsWith('ls3:party')));
const quiet = () => jest.spyOn(console, 'log').mockImplementation(() => undefined);

describe('ADR-010 conversion of an old record', () => {
  it('an old record is read as before, and its old evidence verifies', async () => {
    const { storage, as } = setup();
    await writeOldRecord(storage, peopleIssue(), { fields: FIELDS });
    const view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(view.status).toBe('SEAL_VALID');
    expect(view.seal.sealedByAccountId).toBe('ann');
    const evidence = await getSealEvidence({}, panelContext('viewer'), as('viewer'));
    expect(verify(evidence)).toMatchObject({ status: 0 });
  });

  it('converts the record: no account id or name remains, a redaction row is chained on, and the seal still matches', async () => {
    const { jira, storage, as } = setup();
    const { we: old } = await writeOldRecord(storage, peopleIssue(), { fields: FIELDS });
    expect(recordsText(storage)).toMatch(RAW);
    const log = quiet();
    const result: any = await personalDataReport({}, {}, as(null), async accounts => accounts.map(a => ({ accountId: a.accountId, status: 'updated' })));
    log.mockRestore();
    expect(result).toMatchObject({ reported: 1, conversions: { CONVERTED: 1 } });
    expect(recordsText(storage)).not.toMatch(RAW);

    const rows = model.statusRows(storage);
    expect(rows.map(r => r.statusId)).toEqual(['LS_SEALED', 'LS_REDACTED']);
    expect(verifyChain(rows).valid).toBe(true);
    expect(rows[1]).toMatchObject({ transitionName: 'REDACT', setByPartyId: null });
    expect(rows[1].data).toMatchObject({ previousHeadSeq: 1, previousHeadHash: old.statusHead.entryHash });
    expect(rows[1].data.redactedValues).toBeGreaterThanOrEqual(8);
    expect(rows[1].data.parties).toContain(await model.token(storage, 'dev-1'));
    const we = await model.workEffort(storage);
    expect(we.attributes).toMatchObject({ canonicalizerVersion: '2.1.0', parties: 'TOKEN' });
    expect(we.statusHead).toEqual({ seq: 2, entryHash: rows[1].entryHash });
    const seal = await new SealRepository(storage).getSeal('10001');
    expect(seal !== null && seal !== 'missing' && isConsistent(seal)).toBe(true);

    // The live issue still names the same people in Jira, and matches the converted seal
    const view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(view.status).toBe('SEAL_VALID');
    expect(view.seal.sealedByAccountId).toBe('ann');
    await expect(validateTransition({ issue: { key: 'CHG-1' } }, {}, as(null))).resolves.toEqual({ result: true });
    // The property was written again without the account id
    const property = jira.propertyWrites[jira.propertyWrites.length - 1].body;
    expect(property).toMatchObject({ schemaVersion: 3, status: 'SEAL_VALID' });
    expect(JSON.stringify(property)).not.toContain('ann');
    // A change is still found, by field
    jira.edit('bob', '2099-01-01T00:00:00.000Z', 'assignee', { accountId: 'new-1', displayName: 'Nina' });
    const changed: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(changed.status).toBe('SEAL_BROKEN');
    expect(changed.tamperedFields.map((f: any) => f.fieldId)).toEqual(['assignee']);
  });

  it('the converted evidence verifies with the open verifier, which names the redaction', async () => {
    const { storage, as } = setup();
    await writeOldRecord(storage, peopleIssue(), { fields: FIELDS });
    await convertRecord(as(null), '10001');
    const evidence: any = await getSealEvidence({}, panelContext('viewer'), as('viewer'));
    expect(JSON.stringify(evidence.snapshot)).not.toMatch(RAW);
    const run = verify(evidence);
    expect(run.status).toBe(0);
    expect(run.out).toContain('PASS history chain (2 entries)');
    expect(run.out).toContain('NOTE entry 2 is a redaction');
  });

  it('runs once: a second run finds nothing to convert and changes nothing', async () => {
    const { storage, as } = setup();
    await writeOldRecord(storage, peopleIssue(), { fields: FIELDS });
    expect(await convertRecord(as(null), '10001')).toBe('CONVERTED');
    const after = recordsText(storage);
    expect(await convertRecord(as(null), '10001')).toBe('ALREADY');
    expect(await convertAll(as(null), 1000)).toMatchObject({ ALREADY: 1, CONVERTED: 0 });
    expect(recordsText(storage)).toBe(after);
    expect(await convertRecord(as(null), 'no-such-issue')).toBe('NO_RECORD');
  });

  it('keeps a recorded change as one incident: viewing after the conversion records no second incident', async () => {
    const changedIssue = peopleIssue();
    changedIssue.fields.summary = 'Edited after approval';
    const { jira, storage, as } = setup();
    await writeOldRecord(storage, peopleIssue(), { fields: FIELDS, changedTo: { issue: changedIssue, by: 'mallory', at: '2026-10-02T00:00:00.000Z' } });
    jira.issue = changedIssue;
    expect(await convertRecord(as(null), '10001')).toBe('CONVERTED');
    expect(recordsText(storage)).not.toMatch(RAW);
    const before = model.statusRows(storage).length;
    const view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(view.status).toBe('SEAL_BROKEN');
    expect(model.statusRows(storage)).toHaveLength(before);
    expect(view.tamperedFields[0]).toMatchObject({ fieldId: 'summary', changedBy: ['mallory'] });
    // A newer change after the old incident is a new incident
    const { jira: j2, storage: s2, as: as2 } = setup();
    await writeOldRecord(s2, peopleIssue(), { fields: FIELDS, changedTo: { issue: changedIssue, by: 'mallory', at: '2026-10-02T00:00:00.000Z' } });
    const newer = JSON.parse(JSON.stringify(changedIssue));
    newer.fields.summary = 'Edited again';
    j2.issue = newer;
    expect(await convertRecord(as2(null), '10001')).toBe('CONVERTED');
    await verifyIssue({}, panelContext('viewer'), as2('viewer'));
    expect(model.statusRows(s2).map(r => r.statusId)).toEqual(['LS_SEALED', 'LS_CHANGED', 'LS_REDACTED', 'LS_CHANGED']);
  });

  it('does not convert a changed record while Jira cannot be read, and tries again later', async () => {
    const changedIssue = peopleIssue();
    changedIssue.fields.summary = 'Edited after approval';
    const { jira, storage, as } = setup();
    await writeOldRecord(storage, peopleIssue(), { fields: FIELDS, changedTo: { issue: changedIssue, by: 'mallory', at: '2026-10-02T00:00:00.000Z' } });
    jira.failIssueGet = true;
    const before = recordsText(storage);
    expect(await convertRecord(as(null), '10001')).toBe('JIRA_UNREACHABLE');
    expect(recordsText(storage)).toBe(before);
    await expect(revokeSeal({ reason: 'Wrong release' }, panelContext('bob'), as('bob'))).resolves.toMatchObject({ ok: false, code: 'JIRA_UNREACHABLE' });
    jira.failIssueGet = false;
    jira.issue = changedIssue;
    expect(await convertRecord(as(null), '10001')).toBe('CONVERTED');
  });

  it('finishes a conversion stopped midway from its journal, with the same result', async () => {
    const reference = setup();
    await writeOldRecord(reference.storage, peopleIssue(), { fields: FIELDS });
    reference.storage.map.set('ls3:partykey', { key: Buffer.alloc(32, 3).toString('base64') });
    await convertRecord(reference.as(null), '10001', '2026-11-06T00:00:00.000Z');

    const { storage, as } = setup();
    await writeOldRecord(storage, peopleIssue(), { fields: FIELDS });
    storage.map.set('ls3:partykey', { key: Buffer.alloc(32, 3).toString('base64') });
    const commit = storage.commit.bind(storage);
    storage.commit = async () => Promise.reject(new Error('KVS down'));
    await expect(convertRecord(as(null), '10001', '2026-11-06T00:00:00.000Z')).rejects.toThrow('KVS down');
    expect(storage.map.has('ls3:convert:10001')).toBe(true);
    // Midway the record does not pass its check, so nothing is shown as valid
    expect(((await verifyIssue({}, panelContext('viewer'), as('viewer'))) as any).status).toBe('RECORD_INVALID');
    storage.commit = commit;
    expect(await convertRecord(as(null), '10001', '2026-11-07T00:00:00.000Z')).toBe('CONVERTED');
    expect(storage.map.has('ls3:convert:10001')).toBe(false);
    const strip = (s: MemoryStore) => JSON.stringify([...s.map.entries()].filter(([k]) => !k.startsWith('ls3:party:')).sort());
    expect(strip(storage)).toBe(strip(reference.storage));
  });

  it('never makes a record that failed its check look valid: the ids are replaced and it stays invalid', async () => {
    const { storage, as } = setup();
    const { we } = await writeOldRecord(storage, peopleIssue(), { fields: FIELDS });
    storage.map.set('ls3:we:10001', { ...we, incidentCount: 0, everCompromised: false, recordHash: 'f'.repeat(64) });
    expect(await convertRecord(as(null), '10001')).toBe('REDACTED_INVALID');
    expect(recordsText(storage)).not.toMatch(/"(ann|dev-1|rep-1)"|Ann Approver/);
    expect(((await verifyIssue({}, panelContext('viewer'), as('viewer'))) as any).status).toBe('RECORD_INVALID');
    expect(await convertRecord(as(null), '10001')).toBe('ALREADY');
  });

  it('waits when another writer added a row first', async () => {
    const { storage, as } = setup();
    const { we } = await writeOldRecord(storage, peopleIssue(), { fields: FIELDS });
    storage.map.set('ls3:wes:10001:000002', { statusId: 'LS_CHANGED', seq: 2 });
    expect(await convertRecord(as(null), '10001')).toBe('BUSY');
    expect(storage.map.has('ls3:convert:10001')).toBe(false);
    expect((await model.workEffort(storage)).recordHash).toBe(we.recordHash);
    storage.map.set('ls3:convert:10001', { other: true });
    storage.map.delete('ls3:wes:10001:000002');
  });

  it('a seal or a revoke on an old record converts it first', async () => {
    const { jira, storage, as } = setup();
    await writeOldRecord(storage, peopleIssue(), { fields: FIELDS });
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    await expect(sealIssue({ signature: validSignature({ reason: 'Agreed' }) }, panelContext('bob'), as('bob'))).resolves.toMatchObject({ ok: true });
    expect(recordsText(storage)).not.toMatch(RAW);
    expect(model.statusRows(storage).map(r => r.transitionName)).toEqual(['SEAL', 'REDACT', 'CHANGE', 'RESEAL']);
    expect((await model.workEffort(storage)).attributes).toMatchObject({ canonicalizerVersion: '2.2.0', parties: 'TOKEN' });

    const other = setup();
    await writeOldRecord(other.storage, peopleIssue(), { fields: FIELDS });
    await expect(revokeSeal({ reason: 'Wrong release' }, panelContext('bob'), other.as('bob'))).resolves.toMatchObject({ ok: true });
    expect(recordsText(other.storage)).not.toMatch(RAW);
    const view: any = await verifyIssue({}, panelContext('viewer'), other.as('viewer'));
    expect(view.status).toBe('SEAL_REVOKED');
    expect(view.seal.revocation).toMatchObject({ revokedByAccountId: 'bob', reason: 'Wrong release' });
  });

  it('skips the rest of the records when the time budget is spent, and logs a record that fails', async () => {
    const { storage, as } = setup();
    await writeOldRecord(storage, peopleIssue(), { fields: FIELDS });
    await writeOldRecord(storage, { ...peopleIssue(), id: '10002', key: 'CHG-2' }, { fields: FIELDS, certificateId: '22222222-2222-4222-8222-222222222222' });
    let t = 0;
    expect(await convertAll(as(null), 5, () => (t += 10))).toMatchObject({ CONVERTED: 0 });
    const broken = new MemoryStore();
    broken.map = new Map(storage.map);
    broken.createIfAbsent = async () => Promise.reject(new Error('KVS down'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await convertAll({ jira: as(null).jira, storage: broken }, 1000)).toMatchObject({ CONVERTED: 0 });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('clears the personal data of old-format records and keeps them read as old-format seals', async () => {
    const { storage, as } = setup();
    storage.map.set('cert:active:10001', { certificateId: 'c', sealedBy: { signerAccountId: 'ann', signerDisplayName: 'Ann', signerEmail: 'ann@example.com' } });
    storage.map.set('cert:active:10002', { legacy: true });
    expect(await stubLegacyRecords(storage, '2026-11-06T00:00:00.000Z')).toBe(1);
    expect(storage.map.get('cert:active:10001')).toEqual({ schemaVersion: '1.0', legacy: true, personalDataRemovedAt: '2026-11-06T00:00:00.000Z' });
    expect(((await verifyIssue({}, panelContext('viewer'), as('viewer'))) as any).status).toBe('LEGACY');
  });
});
