/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate evaluation unit tests (spec v2, Gates)
 */

import { evaluateAudit, evaluateCode, evaluateGates, evaluateIntent, evaluateProcess, isDone, isStarted } from '../../src/engine/default-gate-engine';
import { judged, makeFacts } from './fixtures';
import { parseDevField } from '../../src/accessor/dev-field';

const note = { reason: 'Configuration change only', recordedBy: 'acc-1', recordedAt: '2026-11-01T00:00:00Z' };
const approvedState = { status: 'APPROVED' as const, issueKey: 'A-1', requestedBy: 'dev-1', requestedAt: 't1', reason: 'Configuration change only', decidedBy: 'admin-1', decidedAt: 't2' };

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

describe('B-15: Intent from link structure, never title keywords', () => {
  const SITE = 'asymmsystems.atlassian.net';
  const intent = (o: any) => evaluateIntent(makeFacts({ siteHost: SITE, ...o }));

  it('finds a Confluence app link, verified by FourRealities, with its title', () => {
    expect(judged(intent({ remoteLinks: [{ url: 'https://other.example/x', title: 'Payment flow', applicationType: 'com.atlassian.confluence' }] })))
      .toEqual({ state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK', args: { title: 'Payment flow' } });
  });

  it('finds a web link to a Confluence page on this site', () => {
    expect(intent({ remoteLinks: [{ url: `https://${SITE}/wiki/spaces/ARCH/pages/123`, title: 'Settlement' }] }).reason).toBe('INTENT_CONFLUENCE_LINK');
  });

  it('rejects the DEMO-26 placeholder on another host, and keyword titles anywhere', () => {
    expect(intent({ remoteLinks: [{ url: 'https://confluence.atlassian.net/wiki/spaces/ARCH/pages/ADR-014', title: 'ADR-014: Architecture Decision Record' }] }).state).toBe('MISSING');
    expect(intent({ remoteLinks: [{ url: 'https://example.com', title: 'ADR: Architecture Decision for DEMO-1' }] }).state).toBe('MISSING');
    expect(intent({ remoteLinks: [{ url: 'https://example.com/spec', title: 'Inspection report' }] }).state).toBe('MISSING');
    expect(intent({ remoteLinks: [{ url: `https://${SITE}/browse/DEMO-1`, title: 'Decision' }] }).state).toBe('MISSING');
    expect(intent({ remoteLinks: [{ url: 'not a url', title: 'x' }] }).state).toBe('MISSING');
  });

  it('finds an issue link to a decision or specification issue type, matched exactly', () => {
    expect(judged(intent({ issueLinks: [{ key: 'DEMO-2', typeName: 'Architecture Decision' }] })))
      .toEqual({ state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_DECISION_ISSUE', args: { key: 'DEMO-2', type: 'Architecture Decision' } });
    expect(intent({ issueLinks: [{ key: 'DEMO-3', typeName: 'adr' }] }).state).toBe('FOUND');
    expect(intent({ issueLinks: [{ key: 'DEMO-4', typeName: 'Story', summary: '[ADR] Sharding', linkOutward: 'implements' }] }).state).toBe('MISSING');
    expect(intent({ issueLinks: [{ key: 'DEMO-5', typeName: 'Specification Review' }] }).state).toBe('MISSING');
  });

  it('needs a re-check when remote links were not read and no issue link qualifies', () => {
    expect(intent({ remoteLinks: undefined })).toEqual({ state: 'NEEDS_RECHECK', reason: 'INTENT_LINKS_NOT_READ' });
    expect(intent({ remoteLinks: undefined, issueLinks: [{ key: 'DEMO-2', typeName: 'Decision' }] }).state).toBe('FOUND');
  });

  it('is not applicable before work starts, unless a decision is already linked', () => {
    expect(intent({ statusCategory: 'new', statusChanges: 0, remoteLinks: undefined })).toEqual({ state: 'NOT_APPLICABLE', reason: 'NOT_STARTED' });
    expect(intent({ statusCategory: 'new', statusChanges: 0, issueLinks: [{ key: 'DEMO-2', typeName: 'Decision' }] }).state).toBe('FOUND');
  });

  it('counts only app links when the site host is unknown', () => {
    expect(evaluateIntent(makeFacts({ remoteLinks: [{ url: 'https://x.atlassian.net/wiki/a', title: 't' }] })).state).toBe('MISSING');
  });
});

describe('Code', () => {
  it('shows an approved exception as EXCEPTED, never FOUND', () => {
    const r = evaluateCode(makeFacts({ codeException: approvedState }));
    expect(judged(r)).toEqual({ state: 'EXCEPTED', reason: 'CODE_EXCEPTED' });
  });

  it('B-30: a waiting, rejected, withdrawn or revoked exception leaves the gate missing', () => {
    for (const status of ['REQUESTED', 'REJECTED', 'WITHDRAWN', 'REVOKED'] as const) {
      expect(evaluateCode(makeFacts({ codeException: { ...approvedState, status } }))).toEqual({ state: 'MISSING', reason: 'PR_NONE' });
    }
  });

  it('B-30, B-32: only an approved exception excepts the gate; a rework note never does', () => {
    expect(evaluateCode(makeFacts({ reworkNotes: [note] })).state).toBe('MISSING');
  });

  it('is MISSING with no PR when done, NOT_APPLICABLE before done', () => {
    expect(evaluateCode(makeFacts())).toEqual({ state: 'MISSING', reason: 'PR_NONE' });
    expect(evaluateCode(makeFacts({ statusCategory: 'indeterminate' })).state).toBe('NOT_APPLICABLE');
  });
});

const HASH = 'a'.repeat(64);
const UUID = '3f2b8c1e-9d4a-4e7b-8c2d-1a2b3c4d5e6f';
const lsCert = (extra: any = {}) => ({ status: 'SEAL_VALID', certificateId: UUID, snapshotHash: HASH, sealedAt: '2026-10-30T10:29:00.000Z', tamperedFieldCount: 0, isCompromised: false, ...extra });
const dgDod = (extra: any = {}) => ({ isFullySatisfied: true, completedCount: 5, totalCount: 5, checklistHash: HASH, ...extra });

// Shapes observed live on DEMO-26 (T-05). Neither producer writes these.
const DEMO26_CERT = { status: 'SEAL_VALID', valid: true, sealedAt: '2026-10-30T16:12:35.631Z', isCompromised: false };
const DEMO26_DOD = { isFullySatisfied: true, satisfied: true, completedAt: '2026-10-30T16:12:22.188Z' };

describe('B-04: Audit reads ledgerseal-cert as a hint, with LedgerSeal\'s shape', () => {
  it('ignores the valid alias: {valid: true, snapshotHash: "x"} is evidence missing', () => {
    expect(judged(evaluateAudit(makeFacts({ properties: { ledgerseal: { valid: true, snapshotHash: 'x' } } }))))
      .toEqual({ state: 'MISSING', reason: 'SEAL_SHAPE_UNKNOWN' });
  });

  it('reads a well-formed SEAL_VALID as found, not verified, with the seal date', () => {
    expect(judged(evaluateAudit(makeFacts({ properties: { ledgerseal: lsCert() } }))))
      .toEqual({ state: 'FOUND', verification: 'NOT_VERIFIED', reason: 'SEAL_VALID_LS', args: { sealedAt: '2026-10-30T10:29:00.000Z' } });
  });

  it('reads SEAL_BROKEN and SEAL_COMPROMISED as missing: seal broken', () => {
    expect(judged(evaluateAudit(makeFacts({ properties: { ledgerseal: lsCert({ status: 'SEAL_BROKEN' }) } })))).toEqual({ state: 'MISSING', reason: 'SEAL_BROKEN_LS' });
    expect(judged(evaluateAudit(makeFacts({ properties: { ledgerseal: lsCert({ status: 'SEAL_COMPROMISED' }) } })))).toEqual({ state: 'MISSING', reason: 'SEAL_BROKEN_LS' });
    expect(judged(evaluateAudit(makeFacts({ properties: { ledgerseal: lsCert({ isCompromised: true }) } })))).toEqual({ state: 'MISSING', reason: 'SEAL_BROKEN_LS' });
  });

  it('names other statuses, and they apply only when done', () => {
    expect(judged(evaluateAudit(makeFacts({ properties: { ledgerseal: lsCert({ status: 'UNSEALED' }) } }))))
      .toEqual({ state: 'MISSING', reason: 'SEAL_OTHER_LS', args: { status: 'UNSEALED' } });
    expect(evaluateAudit(makeFacts({ statusCategory: 'indeterminate', properties: { ledgerseal: lsCert({ status: 'UNSEALED' }) } })).state).toBe('NOT_APPLICABLE');
  });

  it('rejects the DEMO-26 shape: record shape not written by LedgerSeal', () => {
    expect(judged(evaluateAudit(makeFacts({ statusCategory: 'indeterminate', properties: { ledgerseal: DEMO26_CERT } }))))
      .toEqual({ state: 'MISSING', reason: 'SEAL_SHAPE_UNKNOWN' });
  });

  it('rejects malformed fields: hash, certificate id, date, status type', () => {
    for (const bad of [{ snapshotHash: 'abc' }, { certificateId: 'LS-1234ABCD' }, { sealedAt: 'yesterday' }, { status: 7 }]) {
      expect(evaluateAudit(makeFacts({ properties: { ledgerseal: lsCert(bad) } })).reason).toBe('SEAL_SHAPE_UNKNOWN');
    }
  });

  it('is missing when done with no record, not applicable before done, found before done when sealed', () => {
    expect(evaluateAudit(makeFacts())).toEqual({ state: 'MISSING', reason: 'SEAL_NONE' });
    expect(evaluateAudit(makeFacts({ statusCategory: 'indeterminate' }))).toEqual({ state: 'NOT_APPLICABLE', reason: 'NOT_DONE' });
    expect(evaluateAudit(makeFacts({ statusCategory: 'indeterminate', properties: { ledgerseal: lsCert() } })).state).toBe('FOUND');
  });

  it('needs a re-check when the record carries issuedAt older than the issue update', () => {
    expect(judged(evaluateAudit(makeFacts({ updated: '2026-10-31T00:00:00.000Z', properties: { ledgerseal: lsCert({ issuedAt: '2026-10-30T00:00:00.000Z' }) } }))))
      .toEqual({ state: 'NEEDS_RECHECK', reason: 'CHANGED_SINCE_ATTESTATION' });
    expect(evaluateAudit(makeFacts({ updated: '2026-10-29T00:00:00.000Z', properties: { ledgerseal: lsCert({ issuedAt: '2026-10-30T00:00:00.000Z' }) } })).state).toBe('FOUND');
  });
});

describe('B-04: Process reads definitionguard-dod as a hint, with DefinitionGuard\'s shape', () => {
  it('ignores the satisfied alias', () => {
    expect(judged(evaluateProcess(makeFacts({ properties: { dod: { satisfied: true } } })))).toEqual({ state: 'MISSING', reason: 'DOD_SHAPE_UNKNOWN' });
  });

  it('reads a complete record as found, not verified, with counts', () => {
    expect(judged(evaluateProcess(makeFacts({ properties: { dod: dgDod() } }))))
      .toEqual({ state: 'FOUND', verification: 'NOT_VERIFIED', reason: 'DOD_COMPLETE_DG', args: { completed: 5, total: 5 } });
  });

  it('reads open items as missing when done and not applicable before', () => {
    const open = dgDod({ isFullySatisfied: false, completedCount: 3 });
    expect(judged(evaluateProcess(makeFacts({ properties: { dod: open } })))).toEqual({ state: 'MISSING', reason: 'DOD_OPEN_DG', args: { completed: 3, total: 5 } });
    expect(evaluateProcess(makeFacts({ statusCategory: 'indeterminate', properties: { dod: open } })).state).toBe('NOT_APPLICABLE');
  });

  it('rejects the DEMO-26 shape and malformed counts or hash', () => {
    expect(judged(evaluateProcess(makeFacts({ statusCategory: 'indeterminate', properties: { dod: DEMO26_DOD } })))).toEqual({ state: 'MISSING', reason: 'DOD_SHAPE_UNKNOWN' });
    for (const bad of [{ completedCount: 6 }, { totalCount: -1 }, { completedCount: 1.5 }, { checklistHash: 'x' }, { isFullySatisfied: 'yes' }]) {
      expect(evaluateProcess(makeFacts({ properties: { dod: dgDod(bad) } })).reason).toBe('DOD_SHAPE_UNKNOWN');
    }
  });

  it('is missing when done with no record and not applicable before done', () => {
    expect(evaluateProcess(makeFacts())).toEqual({ state: 'MISSING', reason: 'DOD_NONE' });
    expect(evaluateProcess(makeFacts({ statusCategory: 'indeterminate' }))).toEqual({ state: 'NOT_APPLICABLE', reason: 'NOT_DONE' });
  });

  it('needs a re-check when issuedAt is older than the issue update', () => {
    expect(evaluateProcess(makeFacts({ updated: '2026-10-31T00:00:00.000Z', properties: { dod: dgDod({ issuedAt: '2026-10-30T00:00:00.000Z' }) } })).state).toBe('NEEDS_RECHECK');
  });
});

describe('B-04: no sibling property is ever shown as verified', () => {
  it('never returns VERIFIED or text "verified by FourRealities" for Audit or Process', () => {
    const { sourceLine } = require('../../src/ui/gate-text');
    const certs = [undefined, lsCert(), lsCert({ status: 'SEAL_BROKEN' }), lsCert({ status: 'UNSEALED' }), DEMO26_CERT, { valid: true }];
    const dods = [undefined, dgDod(), dgDod({ isFullySatisfied: false, completedCount: 1 }), DEMO26_DOD, { satisfied: true }];
    for (const statusCategory of ['new', 'indeterminate', 'done'] as const) {
      for (const ledgerseal of certs) {
        for (const dod of dods) {
          const f = makeFacts({ statusCategory, properties: { ledgerseal, dod } });
          for (const r of [evaluateAudit(f), evaluateProcess(f)]) {
            expect(r.verification).not.toBe('VERIFIED');
            expect(sourceLine(r)).not.toContain(', verified by FourRealities.');
          }
        }
      }
    }
  });
});

describe('B-06: exceptions and rework notes', () => {
  it('ignores a Code exception once a pull request exists', () => {
    const f = makeFacts({ codeException: approvedState, devField: { present: true, summary: parseDevField('{pullrequest={dataType=pullrequest, state=MERGED, stateCount=1}}') } });
    expect(evaluateCode(f).state).not.toBe('EXCEPTED');
  });

  it('a rework note changes no gate', () => {
    const base = evaluateGates(makeFacts({ reworkLoops: 2 }));
    const withNote = evaluateGates(makeFacts({ reworkLoops: 2, reworkNotes: [note] }));
    expect(withNote).toEqual(base);
  });
});

describe('B-10: Code gate from the Development field, labelled heuristic', () => {
  const dev = (state: string, count = 1) => ({ present: true, summary: parseDevField(`{pullrequest={dataType=pullrequest, state=${state}, stateCount=${count}}}`) });

  it('reads a merged pull request as found (heuristic), never approved', () => {
    expect(judged(evaluateCode(makeFacts({ devField: dev('MERGED', 2) }))))
      .toEqual({ state: 'FOUND', verification: 'HEURISTIC', reason: 'PR_MERGED', args: { count: 2 } });
    expect(evaluateCode(makeFacts({ statusCategory: 'indeterminate', devField: dev('MERGED') })).reason).toBe('PR_MERGED');
  });

  it('reads an open pull request as missing at done and found (heuristic) before done', () => {
    expect(judged(evaluateCode(makeFacts({ devField: dev('OPEN') })))).toEqual({ state: 'MISSING', reason: 'PR_OPEN_AT_DONE' });
    expect(judged(evaluateCode(makeFacts({ statusCategory: 'indeterminate', devField: dev('OPEN') }))))
      .toEqual({ state: 'FOUND', verification: 'HEURISTIC', reason: 'PR_OPEN' });
  });

  it('treats only declined pull requests, or none, as no pull request', () => {
    expect(evaluateCode(makeFacts({ devField: dev('DECLINED') }))).toEqual({ state: 'MISSING', reason: 'PR_NONE' });
    expect(evaluateCode(makeFacts({ devField: { present: true, summary: parseDevField(undefined) } }))).toEqual({ state: 'MISSING', reason: 'PR_NONE' });
    expect(evaluateCode(makeFacts({ statusCategory: 'indeterminate', devField: dev('DECLINED') }))).toEqual({ state: 'NOT_APPLICABLE', reason: 'NOT_DONE' });
  });

  it('is not applicable when the site has no Development field', () => {
    expect(evaluateCode(makeFacts({ devField: { present: false, summary: parseDevField(undefined) } }))).toEqual({ state: 'NOT_APPLICABLE', reason: 'NO_DEV_TOOL' });
  });

  it('never returns VERIFIED for the Code gate', () => {
    for (const s of ['MERGED', 'OPEN', 'DECLINED']) {
      for (const statusCategory of ['indeterminate', 'done'] as const) {
        expect(evaluateCode(makeFacts({ statusCategory, devField: dev(s) })).verification).not.toBe('VERIFIED');
      }
    }
  });
});
