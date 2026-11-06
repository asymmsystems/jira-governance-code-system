/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import { SealRepository } from '../src/storage/seal-repository';
import { buildStatusRow } from '../src/domain/history';
import { assignmentHash, hasValidRecordHash, isConsistent, withRecordHash } from '../src/domain/seal-record';
import { SealedWorkEffort, WorkEffortPartyAssignment } from '../src/domain/models';
import { MemoryStore } from './support/fakes';

const sealingRow = buildStatusRow(null, {
  workEffortId: '10001',
  statusId: 'LS_SEALED',
  statusDatetime: '2026-11-01T10:00:00.000Z',
  setByPartyId: 'acc-1',
  reason: null,
  transitionName: 'SEAL',
  data: { signerName: 'Lead Auditor' }
});

const assignment: WorkEffortPartyAssignment = {
  workEffortId: '10001',
  partyId: 'acc-1',
  roleTypeId: 'LS_APPROVER',
  fromDate: '2026-11-01T10:00:00.000Z',
  thruDate: null,
  comments: null,
  contentId: 'cert-1',
  declaration: { version: '1', text: 'I approve.' }
};

function workEffort(overrides: Partial<SealedWorkEffort> = {}): SealedWorkEffort {
  return withRecordHash({
    schemaVersion: 3,
    workEffortId: '10001',
    workEffortTypeId: 'JIRA_ISSUE',
    sourceReferenceId: 'AUDIT-1',
    currentStatusId: 'LS_SEALED',
    lastStatusUpdate: '2026-11-01T10:00:00.000Z',
    revisionNumber: 1,
    statusHead: { seq: 1, entryHash: sealingRow.entryHash },
    currentAssignment: {
      partyId: 'acc-1',
      roleTypeId: 'LS_APPROVER',
      fromDate: assignment.fromDate,
      assignmentHash: assignmentHash(assignment),
      sealingSeq: 1,
      sealingEntryHash: sealingRow.entryHash
    },
    currentContentId: 'cert-1',
    attributes: { snapshotHash: 'a'.repeat(64), canonicalizerVersion: '1.0.0', declarationVersion: '1', statusAtSeal: 'Done', snapshotParts: 2 },
    everCompromised: false,
    incidentCount: 0,
    lastIncidentHash: null,
    ...overrides
  });
}

describe('Seal Repository (Silverston model)', () => {
  let storage: MemoryStore;
  let repo: SealRepository;

  beforeEach(() => {
    storage = new MemoryStore();
    repo = new SealRepository(storage);
  });

  it('saves content, assignment and work effort in one transaction and reads the seal back', async () => {
    const snapshot = { issueId: '10001', fields: [{ id: 'summary', value: 'First build' }] };
    const text = JSON.stringify(snapshot);
    await repo.appendStatus(sealingRow);
    await repo.saveSeal(workEffort(), assignment, [text.slice(0, 10), text.slice(10)]);
    expect(storage.commits).toEqual([
      ['ls3:content:cert-1:0', 'ls3:content:cert-1:1', 'ls3:wepa:10001:2026-11-01T10:00:00.000Z', 'ls3:we:10001']
    ]);
    const seal = await repo.getSeal('10001');
    expect(seal).not.toBe('missing');
    if (seal && seal !== 'missing') {
      expect(seal.assignment).toEqual(assignment);
      expect(isConsistent(seal)).toBe(true);
      await expect(repo.getContent(seal.workEffort)).resolves.toEqual(snapshot);
    }
  });

  it('writes the ended previous assignment in the same transaction as a reseal', async () => {
    const ended = { ...assignment, thruDate: '2026-11-02T00:00:00.000Z' };
    const next = { ...assignment, partyId: 'acc-2', fromDate: '2026-11-02T00:00:00.000Z' };
    await repo.saveSeal(workEffort(), next, ['{}'], ended);
    expect(storage.commits[0]).toEqual([
      'ls3:content:cert-1:0',
      'ls3:wepa:10001:2026-11-01T10:00:00.000Z',
      'ls3:wepa:10001:2026-11-02T00:00:00.000Z',
      'ls3:we:10001'
    ]);
  });

  it('returns null for no seal, "missing" for a broken link, and null for unreadable content', async () => {
    await expect(repo.getSeal('nope')).resolves.toBeNull();
    await expect(repo.getLegacyCertificate('nope')).resolves.toBeNull();
    await repo.saveWorkEffort(workEffort());
    await expect(repo.getSeal('10001')).resolves.toBe('missing');
    await expect(repo.getContent(workEffort())).resolves.toBeNull();
    await storage.set('ls3:content:cert-1:0', '{"broken');
    await storage.set('ls3:content:cert-1:1', '');
    await expect(repo.getContent(workEffort())).resolves.toBeNull();
  });

  it('reads the newest status row for a revoked seal', async () => {
    const revoke = buildStatusRow(
      { seq: 1, entryHash: sealingRow.entryHash },
      { workEffortId: '10001', statusId: 'LS_REVOKED', statusDatetime: 't2', setByPartyId: 'acc-1', reason: 'withdrawn', transitionName: 'REVOKE', data: {} }
    );
    await repo.appendStatus(sealingRow);
    await repo.appendStatus(revoke);
    await repo.saveSeal(workEffort({ currentStatusId: 'LS_REVOKED', statusHead: { seq: 2, entryHash: revoke.entryHash } }), assignment, ['{}']);
    const seal = await repo.getSeal('10001');
    expect(seal !== 'missing' && seal?.headRow?.reason).toBe('withdrawn');
  });

  it('creates each status row once', async () => {
    await expect(repo.appendStatus(sealingRow)).resolves.toBe(true);
    await expect(repo.appendStatus({ ...sealingRow, data: { forged: true } })).resolves.toBe(false);
    await expect(repo.getStatusRows('10001', 1, 1)).resolves.toEqual([sealingRow]);
  });

  it('reads a v1 certificate without writing', async () => {
    await storage.set('cert:active:10001', { certificateId: 'v1' });
    storage.sets = [];
    await expect(repo.getLegacyCertificate('10001')).resolves.toEqual({ certificateId: 'v1' });
    expect(storage.sets).toEqual([]);
  });

  it('detects a work effort whose fields no longer match its hash', () => {
    const we = workEffort();
    expect(hasValidRecordHash(we)).toBe(true);
    expect(hasValidRecordHash({ ...we, incidentCount: 0, everCompromised: true })).toBe(false);
    expect(hasValidRecordHash({ ...we, recordHash: undefined as any })).toBe(false);
  });
});

describe('Seal summary and consistency', () => {
  const { summarise } = require('../src/domain/seal-record');
  const seal = () => ({ workEffort: workEffort(), assignment, sealingRow });

  it('reports each broken binding as inconsistent', () => {
    expect(isConsistent(seal())).toBe(true);
    expect(isConsistent({ ...seal(), assignment: { ...assignment, partyId: 'x' } })).toBe(false);
    expect(isConsistent({ ...seal(), sealingRow: { ...sealingRow, reason: 'edited' } })).toBe(false);
    expect(isConsistent({ ...seal(), workEffort: workEffort({ currentAssignment: { ...workEffort().currentAssignment, sealingSeq: 2 } }) })).toBe(false);
    expect(isConsistent({ ...seal(), workEffort: { ...workEffort(), incidentCount: 5 } })).toBe(false);
  });

  it('summarises an active seal with the stored party id and no name', () => {
    expect(summarise(seal())).toMatchObject({ state: 'ACTIVE', sealedByAccountId: 'acc-1', meaning: 'APPROVAL', revocation: null, historyLength: 1 });
    expect(summarise(seal())).not.toHaveProperty('sealedByName');
  });

  it('summarises a revoked seal from its newest status row', () => {
    const head = { ...sealingRow, statusId: 'LS_REVOKED', statusDatetime: 't2', setByPartyId: 'acc-9', reason: 'withdrawn' };
    const revoked = { ...seal(), workEffort: workEffort({ currentStatusId: 'LS_REVOKED' }), headRow: head };
    expect(summarise(revoked)).toMatchObject({ state: 'REVOKED', revocation: { revokedAt: 't2', revokedByAccountId: 'acc-9', reason: 'withdrawn' } });
    const blank = { ...revoked, headRow: { ...head, setByPartyId: null, reason: null } };
    expect(summarise(blank).revocation).toEqual({ revokedAt: 't2', revokedByAccountId: '', reason: '' });
    expect(summarise({ ...revoked, headRow: undefined }).revocation).toBeNull();
  });
});
