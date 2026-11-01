/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate evaluation unit tests (spec v2, Gates)
 */

import { evaluateAudit, evaluateCode, evaluateGates, evaluateIntent, evaluateProcess, isDone, isStarted } from '../../src/domain/gates';
import { makeFacts } from './fixtures';

const note = { reason: 'Configuration change only', recordedBy: 'acc-1', recordedAt: '2026-11-01T00:00:00Z' };

describe('started and done', () => {
  it('treats a status change as started even in a new category', () => {
    expect(isStarted(makeFacts({ statusCategory: 'new', statusChanges: 1 }))).toBe(true);
    expect(isStarted(makeFacts({ statusCategory: 'new', statusChanges: 0 }))).toBe(false);
    expect(isDone(makeFacts({ statusCategory: 'indeterminate' }))).toBe(false);
  });
});

describe('every gate result carries a state and a reason', () => {
  it('returns four results', () => {
    const g = evaluateGates(makeFacts());
    expect(Object.keys(g)).toEqual(['intent', 'process', 'code', 'audit']);
    for (const r of Object.values(g)) {
      expect(['FOUND', 'MISSING', 'EXCEPTED', 'NEEDS_RECHECK', 'NOT_APPLICABLE']).toContain(r.state);
      expect(typeof r.reason).toBe('string');
    }
  });
});

describe('Intent (keyword heuristic until B-15)', () => {
  it('labels a keyword match as HEURISTIC, never VERIFIED', () => {
    const r = evaluateIntent(makeFacts({ remoteLinks: [{ title: 'ADR-1 Settlement', url: 'https://x.example/doc' }] }));
    expect(r).toEqual({ state: 'FOUND', verification: 'HEURISTIC', reason: 'INTENT_KEYWORD_LINK' });
  });

  it('matches link types, summaries and issue types', () => {
    expect(evaluateIntent(makeFacts({ issueLinks: [{ linkOutward: 'implements' }] })).state).toBe('FOUND');
    expect(evaluateIntent(makeFacts({ issueLinks: [{ summary: '[ADR] Sharding' }] })).state).toBe('FOUND');
    expect(evaluateIntent(makeFacts({ issueLinks: [{ typeName: 'Architecture Decision' }] })).state).toBe('FOUND');
    expect(evaluateIntent(makeFacts({ remoteLinks: [{ url: 'https://x.example/rfc/9' }] })).state).toBe('FOUND');
  });

  it('is MISSING once started and NOT_APPLICABLE before', () => {
    expect(evaluateIntent(makeFacts({ remoteLinks: undefined })).state).toBe('MISSING');
    expect(evaluateIntent(makeFacts({ statusCategory: 'new', statusChanges: 0 }))).toEqual({ state: 'NOT_APPLICABLE', reason: 'NOT_STARTED' });
  });
});

describe('Process (DoD hint until B-04)', () => {
  it('reads a complete DoD as FOUND, not verified', () => {
    expect(evaluateProcess(makeFacts({ properties: { dod: { isFullySatisfied: true } } })))
      .toEqual({ state: 'FOUND', verification: 'NOT_VERIFIED', reason: 'DOD_COMPLETE_DG' });
  });

  it('is MISSING when done and NOT_APPLICABLE before done', () => {
    expect(evaluateProcess(makeFacts()).state).toBe('MISSING');
    expect(evaluateProcess(makeFacts({ statusCategory: 'indeterminate' })).state).toBe('NOT_APPLICABLE');
  });
});

describe('Code', () => {
  it('shows an exception as EXCEPTED, never FOUND', () => {
    const r = evaluateCode(makeFacts({ exception: { schemaVersion: 2, issueId: '1', issueKey: 'A-1', code: note } }));
    expect(r).toEqual({ state: 'EXCEPTED', reason: 'CODE_EXCEPTED' });
  });

  it('reads approvals from pull request data and the Development field', () => {
    expect(evaluateCode(makeFacts({ pullRequests: [{ reviewers: [{ approvalStatus: 'APPROVED' }] }] })).state).toBe('FOUND');
    expect(evaluateCode(makeFacts({ pullRequests: [{ status: 'APPROVED' }] })).verification).toBe('HEURISTIC');
    expect(evaluateCode(makeFacts({ pullRequests: [{ reviewers: [] }] })).state).toBe('MISSING');
    expect(evaluateCode(makeFacts({ devField: { present: true, raw: '{pullrequest={state=MERGED}, APPROVED}' } })).state).toBe('FOUND');
    expect(evaluateCode(makeFacts({ devField: { present: true, raw: '{pullrequest={state=MERGED}}' } })).state).toBe('MISSING');
  });

  it('is MISSING with no PR when done, NOT_APPLICABLE before done', () => {
    expect(evaluateCode(makeFacts())).toEqual({ state: 'MISSING', reason: 'PR_NONE' });
    expect(evaluateCode(makeFacts({ statusCategory: 'indeterminate' })).state).toBe('NOT_APPLICABLE');
  });
});

describe('Audit (seal hint until B-04)', () => {
  it('reads a valid seal as FOUND, not verified', () => {
    expect(evaluateAudit(makeFacts({ properties: { ledgerseal: { status: 'SEAL_VALID', snapshotHash: 'h' } } })))
      .toEqual({ state: 'FOUND', verification: 'NOT_VERIFIED', reason: 'SEAL_VALID_LS' });
  });

  it('rejects a compromised seal and is NOT_APPLICABLE before done', () => {
    expect(evaluateAudit(makeFacts({ properties: { ledgerseal: { status: 'SEAL_VALID', snapshotHash: 'h', isCompromised: true } } })).state).toBe('MISSING');
    expect(evaluateAudit(makeFacts({ statusCategory: 'indeterminate' })).state).toBe('NOT_APPLICABLE');
  });
});
