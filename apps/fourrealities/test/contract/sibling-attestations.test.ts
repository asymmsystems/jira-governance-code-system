/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: contract test with the real writers of the sibling apps (BL-1, ADR-012). The
 * records come from buildAttestation() of DefinitionGuard and LedgerSeal in this repository, signed
 * with a key generated here, and go through the same path as a Jira read: factsFromIssue with the
 * signature check, then the gate engine.
 */

import * as crypto from 'crypto';
import { factsFromIssue } from '../../src/accessor/issue-facts';
import { attestationChecker } from '../../src/accessor/attestation-verifier';
import { TrustedKey } from '../../src/accessor/attestation-keys';
import { evaluateAudit, evaluateProcess } from '../../src/engine/default-gate-engine';
import { detailText } from '../../src/ui/gate-text';
import * as dg from '../../../definitionguard/src/integrity/attestation';
import * as ls from '../../../ledgerseal/src/domain/attestation';

const ISSUE_ID = '10042';
const HASH = 'b'.repeat(64);
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const PRIVATE_DER_B64 = (privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer).toString('base64');

const KEYS: TrustedKey[] = [
  { producer: 'definitionguard', keyId: 'dg-contract', environments: ['DEVELOPMENT'], pem: PUBLIC_PEM },
  { producer: 'ledgerseal', keyId: 'ls-contract', environments: ['DEVELOPMENT'], pem: PUBLIC_PEM }
];
const verify = attestationChecker(KEYS);

function criterion(id: string, status: string): Record<string, unknown> {
  return { workEffortId: `crit:${ISSUE_ID}:${id}`, templateItemId: id, workEffortName: `Item ${id}`, isMandatory: true, evidenceRequired: false, currentStatusId: status };
}

function dodState(statuses: string[]): Record<string, unknown> {
  return {
    schemaVersion: 3,
    issue: { workEffortId: `issue:${ISSUE_ID}`, workEffortTypeId: 'ISSUE', sourceReferenceId: ISSUE_ID, workEffortName: 'PAY-1', projectId: '10000' },
    template: { workEffortId: 'tpl-1', revisionNumber: 2, waiverRoleTypeId: 'PROJECT_ADMIN' },
    criteria: statuses.map((s, i) => criterion(`i${i}`, s)),
    seq: 7,
    headHash: HASH,
    lastModifiedByPartyId: 'someone'
  };
}

/** A Jira issue read with the property as Jira returns it (JSON round trip). */
function issueWith(key: string, value: unknown, statusCategory = 'done') {
  return { id: ISSUE_ID, key: 'PAY-1', fields: { status: { statusCategory: { key: statusCategory } } }, properties: { [key]: JSON.parse(JSON.stringify(value)) } };
}

const withoutAccountIds = (record: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(record).filter(([k]) => !/AccountId$/.test(k)));

describe('BL-1: DefinitionGuard records from its own writer', () => {
  const dgApi = dg as unknown as {
    buildAttestation: (state: unknown, issuedAt: string) => Record<string, unknown>;
    signAttestation: (att: Record<string, unknown>, pem: string, keyId: string) => Record<string, unknown>;
  };

  it('reads a complete, signed record as found and verified, with the mandatory counts', () => {
    const att = dgApi.signAttestation(dgApi.buildAttestation(dodState(['DOD_DONE', 'DOD_WAIVED']), '2026-11-06T10:00:00.000Z'), PRIVATE_PEM, 'dg-contract');
    const facts = factsFromIssue(issueWith('definitionguard-dod', att), { verify });
    expect(facts.attestations?.dod).toBe('VERIFIED');
    expect(evaluateProcess(facts)).toMatchObject({ state: 'FOUND', verification: 'VERIFIED', reason: 'DOD_COMPLETE_DG', args: { completed: 2, total: 2 }, evidenceRef: HASH });
  });

  it('reads open mandatory items as missing on a Done issue', () => {
    const att = dgApi.signAttestation(dgApi.buildAttestation(dodState(['DOD_DONE', 'DOD_OPEN']), '2026-11-06T10:00:00.000Z'), PRIVATE_PEM, 'dg-contract');
    const r = evaluateProcess(factsFromIssue(issueWith('definitionguard-dod', att), { verify }));
    expect(r).toMatchObject({ state: 'MISSING', reason: 'DOD_OPEN_DG', args: { completed: 1, total: 2 } });
  });

  it('reads the unsigned record (no signing key set) as reported, not verified', () => {
    const att = { ...dgApi.buildAttestation(dodState(['DOD_DONE']), '2026-11-06T10:00:00.000Z'), keyId: null, sig: null };
    const r = evaluateProcess(factsFromIssue(issueWith('definitionguard-dod', att), { verify }));
    expect(r).toMatchObject({ state: 'REPORTED', verification: 'NOT_VERIFIED', reason: 'DOD_COMPLETE_DG' });
    expect(detailText(r)).toContain('could not verify this record (unsigned), so it is not scored');
  });

  it('accepts the same record without account id fields, as the DefinitionGuard fix writes it', () => {
    const att = dgApi.signAttestation(withoutAccountIds(dgApi.buildAttestation(dodState(['DOD_DONE']), '2026-11-06T10:00:00.000Z')), PRIVATE_PEM, 'dg-contract');
    expect(evaluateProcess(factsFromIssue(issueWith('definitionguard-dod', att), { verify })).state).toBe('FOUND');
  });

  it('reads a record changed after signing as missing (F-H1)', () => {
    const att = dgApi.signAttestation(dgApi.buildAttestation(dodState(['DOD_OPEN']), '2026-11-06T10:00:00.000Z'), PRIVATE_PEM, 'dg-contract');
    const forged = { ...att, isFullySatisfied: true, mandatoryCompleted: 1 };
    expect(evaluateProcess(factsFromIssue(issueWith('definitionguard-dod', forged), { verify }))).toMatchObject({ state: 'MISSING', reason: 'DOD_SIGNATURE_INVALID' });
  });
});

describe('BL-1: LedgerSeal records from its own writer', () => {
  const lsApi = ls as unknown as {
    createSigner: (der: string, keyId: string) => unknown;
    buildAttestation: (source: Record<string, unknown>, status: string, issuedAt: string, signer: unknown) => Record<string, unknown>;
  };
  const source = {
    issueId: ISSUE_ID,
    certificateId: '3f0c2a52-7d1b-4c47-9a51-0d6e3b8a9f10',
    snapshotHash: HASH,
    canonicalizerVersion: '2.0.0',
    sealedAt: '2026-11-06T09:00:00.000Z',
    sealedByAccountId: 'someone',
    everCompromised: false,
    incidentCount: 0
  };

  it('reads a signed SEAL_VALID as found and verified', () => {
    const att = lsApi.buildAttestation(source, 'SEAL_VALID', '2026-11-06T09:00:01.000Z', lsApi.createSigner(PRIVATE_DER_B64, 'ls-contract'));
    expect(evaluateAudit(factsFromIssue(issueWith('ledgerseal-cert', att), { verify })))
      .toMatchObject({ state: 'FOUND', verification: 'VERIFIED', reason: 'SEAL_VALID_LS', evidenceRef: source.certificateId });
  });

  it('reads a signed SEAL_BROKEN as missing, and SEAL_REVOKED as missing on a Done issue', () => {
    const signer = lsApi.createSigner(PRIVATE_DER_B64, 'ls-contract');
    expect(evaluateAudit(factsFromIssue(issueWith('ledgerseal-cert', lsApi.buildAttestation(source, 'SEAL_BROKEN', '2026-11-06T09:30:00.000Z', signer)), { verify })).reason).toBe('SEAL_BROKEN_LS');
    expect(evaluateAudit(factsFromIssue(issueWith('ledgerseal-cert', lsApi.buildAttestation(source, 'SEAL_REVOKED', '2026-11-06T09:30:00.000Z', signer)), { verify })))
      .toMatchObject({ state: 'MISSING', reason: 'SEAL_OTHER_LS', args: { status: 'SEAL_REVOKED' } });
  });

  it('reads the unsigned record as reported, and a record with no account id field as verified', () => {
    expect(evaluateAudit(factsFromIssue(issueWith('ledgerseal-cert', lsApi.buildAttestation(source, 'SEAL_VALID', '2026-11-06T09:00:01.000Z', null)), { verify })).state).toBe('REPORTED');
    const { sealedByAccountId: _gone, ...noIds } = source;
    const att = lsApi.buildAttestation(noIds, 'SEAL_VALID', '2026-11-06T09:00:01.000Z', lsApi.createSigner(PRIVATE_DER_B64, 'ls-contract'));
    expect(evaluateAudit(factsFromIssue(issueWith('ledgerseal-cert', att), { verify })).state).toBe('FOUND');
  });

  it('reads a seal copied onto another issue as missing (F-H1)', () => {
    const att = lsApi.buildAttestation(source, 'SEAL_VALID', '2026-11-06T09:00:01.000Z', lsApi.createSigner(PRIVATE_DER_B64, 'ls-contract'));
    const copied = { ...issueWith('ledgerseal-cert', att), id: '10043' };
    expect(evaluateAudit(factsFromIssue(copied, { verify }))).toMatchObject({ state: 'MISSING', reason: 'SEAL_SIGNATURE_INVALID', args: { why: 'signed for another issue' } });
  });
});
