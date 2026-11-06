/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: evidence catalog as data and observation method and reference (ADR-001 Patterns 2, 4; B-31).
 */

import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_CATALOG, EVIDENCE_REF_MAX, EvidenceCatalog } from '../../src/contract/data/catalog';
import { GateResult, IssueGates } from '../../src/contract/data/models';
import { DefaultGateEngine, evaluateGates } from '../../src/engine/default-gate-engine';
import { makeFacts } from '../domain/fixtures';

const HASH = 'a'.repeat(64);
const CERT = '123e4567-e89b-42d3-a456-426614174000';
const DOD = { isFullySatisfied: true, completedCount: 3, totalCount: 3, checklistHash: HASH };
const SEAL = { status: 'SEAL_VALID', certificateId: CERT, snapshotHash: HASH, sealedAt: '2026-10-01T10:00:00Z' };
const PAGE = { url: 'https://demo.atlassian.net/wiki/spaces/A/pages/1', title: 'ADR 7', applicationType: 'com.atlassian.confluence', pageId: '1', pageExists: true };

const allResults = (g: IssueGates): GateResult[] => Object.values(g);

describe('DEFAULT_CATALOG', () => {
  it('names a gate and a verification class for every evidence source', () => {
    for (const [id, source] of Object.entries(DEFAULT_CATALOG.sources)) {
      expect(['intent', 'process', 'code', 'audit']).toContain(source.gate);
      expect(['VERIFIED', 'NOT_VERIFIED', 'HEURISTIC', undefined]).toContain(source.verification);
      expect(id).toMatch(/^[A-Z_]+$/);
    }
  });

  it('holds the intent rule that the gate engine used to hard-code', () => {
    expect(DEFAULT_CATALOG.intent.contentApplicationTypes).toEqual(['com.atlassian.confluence']);
    expect(DEFAULT_CATALOG.intent.issueTypes).toEqual(expect.arrayContaining(['adr', 'decision', 'specification']));
    expect(DEFAULT_CATALOG.intent.sameSiteContentPath).toBe('/wiki/');
  });
});

describe('observation method and evidence reference', () => {
  it('records the source and what was seen for each kind of found evidence', () => {
    const g = evaluateGates(makeFacts({ siteHost: 'demo.atlassian.net', remoteLinks: [PAGE], attestations: { dod: 'VERIFIED', ledgerseal: 'VERIFIED' }, properties: { dod: DOD, ledgerseal: SEAL }, devField: { present: true, summary: { count: 2, openCount: 0, mergedCount: 2, state: 'MERGED', declinedCount: 0 } } }));
    expect(g.intent).toMatchObject({ method: 'CONFLUENCE_PAGE_LINK', evidenceRef: PAGE.url });
    expect(g.process).toMatchObject({ method: 'DEFINITIONGUARD_PROPERTY', evidenceRef: HASH });
    expect(g.audit).toMatchObject({ method: 'LEDGERSEAL_PROPERTY', evidenceRef: CERT });
    expect(g.code).toMatchObject({ method: 'DEVELOPMENT_FIELD', evidenceRef: 'pull requests: 2' });
  });

  it('records the decision issue key and the approved exception', () => {
    const intent = evaluateGates(makeFacts({ remoteLinks: [], issueLinks: [{ key: 'DEMO-9', typeName: 'ADR' }] })).intent;
    expect(intent).toMatchObject({ method: 'DECISION_ISSUE_LINK', evidenceRef: 'DEMO-9' });
    const code = evaluateGates(makeFacts({
      codeException: { status: 'APPROVED', reason: 'Config only change', requestedBy: 'u1', requestedAt: '2026-10-02T00:00:00Z', decidedBy: 'u2', decidedAt: '2026-10-03T00:00:00Z' } as any
    })).code;
    expect(code).toMatchObject({ state: 'EXCEPTED', method: 'GATE_EXCEPTION', evidenceRef: 'approved 2026-10-03T00:00:00Z' });
  });

  it('records the source when a record was read but does not count', () => {
    const g = evaluateGates(makeFacts({ attestations: { dod: 'VERIFIED' }, properties: { dod: { ...DOD, isFullySatisfied: false, completedCount: 1 }, ledgerseal: { valid: true } } }));
    expect(g.process).toMatchObject({ state: 'MISSING', method: 'DEFINITIONGUARD_PROPERTY' });
    expect(g.audit).toMatchObject({ state: 'MISSING', reason: 'SEAL_SHAPE_UNKNOWN', method: 'LEDGERSEAL_PROPERTY' });
    expect(g.audit.evidenceRef).toBeUndefined();
  });

  it('records no method when no evidence record exists', () => {
    const g = evaluateGates(makeFacts({ remoteLinks: [] }));
    for (const r of allResults(g)) expect(r.method).toBeUndefined();
  });

  it('takes the verification class from the catalog source', () => {
    const g = evaluateGates(makeFacts({ siteHost: 'demo.atlassian.net', remoteLinks: [PAGE], attestations: { dod: 'VERIFIED', ledgerseal: 'VERIFIED' }, properties: { dod: DOD, ledgerseal: SEAL }, devField: { present: true, summary: { count: 1, openCount: 0, mergedCount: 1, state: 'MERGED', declinedCount: 0 } } }));
    for (const r of allResults(g).filter(x => x.state === 'FOUND')) {
      expect(r.verification).toBe(DEFAULT_CATALOG.sources[r.method as string].verification);
    }
  });

  it('cuts a long reference to the stored maximum', () => {
    const url = `https://demo.atlassian.net/wiki/${'x'.repeat(500)}`;
    const intent = evaluateGates(makeFacts({ remoteLinks: [{ ...PAGE, url }] })).intent;
    expect(intent.evidenceRef).toHaveLength(EVIDENCE_REF_MAX);
  });
});

describe('the gate engine reads the catalog', () => {
  const custom: EvidenceCatalog = {
    ...DEFAULT_CATALOG,
    intent: { issueTypes: ['design note'], contentApplicationTypes: ['com.example.wiki'], sameSiteContentPath: '/docs/' }
  };

  it('uses the issue types of the catalog it is given', () => {
    const engine = new DefaultGateEngine(custom);
    expect(engine.evaluate(makeFacts({ remoteLinks: [], issueLinks: [{ key: 'DEMO-2', typeName: 'Design Note' }] })).intent.state).toBe('FOUND');
    expect(engine.evaluate(makeFacts({ remoteLinks: [], issueLinks: [{ key: 'DEMO-3', typeName: 'ADR' }] })).intent.state).toBe('MISSING');
  });

  it('uses the content application types and site path of the catalog it is given', () => {
    const engine = new DefaultGateEngine(custom);
    expect(engine.evaluate(makeFacts({ remoteLinks: [{ url: 'https://x.example/p', applicationType: 'com.example.wiki' }] })).intent.state).toBe('FOUND');
    expect(engine.evaluate(makeFacts({ siteHost: 'demo.atlassian.net', remoteLinks: [{ url: 'https://demo.atlassian.net/docs/p' }] })).intent.state).toBe('FOUND');
    expect(engine.evaluate(makeFacts({ remoteLinks: [PAGE] })).intent.state).toBe('MISSING');
  });

  it('holds no lists of names in the gate engine source', () => {
    const text = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'engine', 'default-gate-engine.ts'), 'utf8');
    expect(text).not.toMatch(/com\.atlassian\.confluence|'adr'|'\/wiki\/'/);
  });
});
