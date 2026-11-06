/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: evidence sources in use, detection and the standalone matrix (ADR-013, BL-2, F-H5).
 */

import { DEFAULT_SOURCE_SETTINGS, EvidenceSourceSettings, NO_PULL_REQUEST, SiteConfig } from '../../src/contract/data/models';
import { DefaultSourcePolicyEngine } from '../../src/engine/default-source-policy-engine';
import { evaluateGates } from '../../src/engine/default-gate-engine';
import { DefaultMetricsEngine } from '../../src/engine/default-metrics-engine';
import { DEFAULT_CATALOG } from '../../src/contract/data/catalog';
import { makeFacts } from '../domain/fixtures';

const engine = new DefaultSourcePolicyEngine();
const metrics = new DefaultMetricsEngine();
const CONFIG: SiteConfig = { devFieldId: 'customfield_10000', siteHost: 'asymmsystems.atlassian.net', statusCategories: {}, pullRequestsSeen: false, readAt: 't' };
const settings = (o: Partial<EvidenceSourceSettings> = {}): EvidenceSourceSettings => ({ ...DEFAULT_SOURCE_SETTINGS, ...o });
const AT = '2026-11-06T10:00:00.000Z';
const HASH = 'a'.repeat(64);
const PAGE = { url: 'https://asymmsystems.atlassian.net/wiki/spaces/ENG/pages/1/ADR', title: 'ADR-1', applicationType: 'com.atlassian.confluence' };

describe('resolve: Detect turns a check on only after its source is seen', () => {
  it('uses Intent and nothing else on a site with FourRealities alone and no Git integration', () => {
    expect(engine.resolve(settings(), {}, CONFIG)).toEqual({
      intent: true, process: null, code: false, audit: false, decisionIssueTypes: DEFAULT_SOURCE_SETTINGS.decisionIssueTypes,
      detected: { process: false, code: false, audit: false }
    });
  });

  it('turns Process and Audit on after a verified record, and not after an unverified one', () => {
    const seenOnly = engine.resolve(settings(), { definitionguard: { seenAt: AT }, ledgerseal: { seenAt: AT } }, CONFIG);
    expect([seenOnly.process, seenOnly.audit]).toEqual([null, false]);
    const verified = engine.resolve(settings(), { definitionguard: { seenAt: AT, verifiedAt: AT }, ledgerseal: { seenAt: AT, verifiedAt: AT } }, CONFIG);
    expect([verified.process, verified.audit, verified.detected]).toEqual(['definitionguard', true, { process: true, code: false, audit: true }]);
  });

  it('turns Code on after the pull request probe or a sighting, only with a Development field (F-H5)', () => {
    expect(engine.resolve(settings(), {}, { ...CONFIG, pullRequestsSeen: true }).code).toBe(true);
    expect(engine.resolve(settings(), { pullRequests: { seenAt: AT } }, CONFIG).code).toBe(true);
    expect(engine.resolve(settings(), { pullRequests: { seenAt: AT } }, { ...CONFIG, devFieldId: null, pullRequestsSeen: true }).code).toBe(false);
    expect(engine.resolve(settings(), {}, { ...CONFIG, pullRequestsSeen: null }).code).toBe(false);
  });

  it('follows an explicit choice over detection', () => {
    const on = engine.resolve(settings({ process: 'herocoders', code: 'on', audit: 'ledgerseal', intent: 'off', decisionIssueTypes: ['rfc'] }), {}, CONFIG);
    expect(on).toEqual({ intent: false, process: 'herocoders', code: true, audit: true, decisionIssueTypes: ['rfc'], detected: { process: false, code: false, audit: false } });
    const off = engine.resolve(settings({ process: 'off', code: 'off', audit: 'off' }), { definitionguard: { seenAt: AT, verifiedAt: AT }, ledgerseal: { seenAt: AT, verifiedAt: AT }, pullRequests: { seenAt: AT } }, { ...CONFIG, pullRequestsSeen: true });
    expect([off.process, off.code, off.audit]).toEqual([null, false, false]);
    expect(engine.resolve(settings({ decisionIssueTypes: [] }), {}, CONFIG).decisionIssueTypes).toEqual(DEFAULT_SOURCE_SETTINGS.decisionIssueTypes);
  });
});

describe('sightings and merge', () => {
  it('records each source seen in a read, with verification', () => {
    const facts = [
      makeFacts({ properties: { dod: { a: 1 } } }),
      makeFacts({ properties: { dod: { a: 1 }, ledgerseal: { b: 1 }, checklist: { c: 1 } }, attestations: { dod: 'VERIFIED', ledgerseal: 'UNSIGNED' } }),
      makeFacts({ properties: { dod: { a: 1 } } }),
      makeFacts({ devField: { present: true, summary: { ...NO_PULL_REQUEST, count: 1 } } })
    ];
    expect(engine.sightings(facts, AT)).toEqual({
      definitionguard: { seenAt: AT, verifiedAt: AT },
      ledgerseal: { seenAt: AT },
      herocoders: { seenAt: AT },
      pullRequests: { seenAt: AT }
    });
    expect(engine.sightings([makeFacts()], AT)).toEqual({});
  });

  it('keeps the earliest dates and says whether anything changed', () => {
    const before = { definitionguard: { seenAt: '2026-11-01T00:00:00.000Z' }, pullRequests: { seenAt: '2026-11-01T00:00:00.000Z' } };
    const r = engine.merge(before, { definitionguard: { seenAt: AT, verifiedAt: AT }, ledgerseal: { seenAt: AT }, herocoders: { seenAt: AT }, pullRequests: { seenAt: AT } });
    expect(r.detected).toEqual({
      definitionguard: { seenAt: '2026-11-01T00:00:00.000Z', verifiedAt: AT },
      ledgerseal: { seenAt: AT },
      herocoders: { seenAt: AT },
      pullRequests: { seenAt: '2026-11-01T00:00:00.000Z' }
    });
    expect(r.changed).toBe(true);
    expect(engine.merge(r.detected, { pullRequests: { seenAt: AT } }).changed).toBe(false);
    expect(engine.merge({}, {}).changed).toBe(false);
    expect(engine.merge({ ledgerseal: { seenAt: AT, verifiedAt: '2026-11-01T00:00:00.000Z' } }, { ledgerseal: { seenAt: '2026-10-01T00:00:00.000Z' } }).detected)
      .toEqual({ ledgerseal: { seenAt: '2026-10-01T00:00:00.000Z', verifiedAt: '2026-11-01T00:00:00.000Z' } });
  });
});

describe('notes for the dashboard', () => {
  it('names sources found but not in use, and says nothing when the admin turned the check off', () => {
    const none = engine.resolve(settings(), {}, CONFIG);
    expect(engine.notes(settings(), { definitionguard: { seenAt: AT }, ledgerseal: { seenAt: AT } }, none)).toEqual([
      'DefinitionGuard records were found on this site, but none could be verified, so the Process check is not used. A Jira administrator can turn it on in Jira settings > Apps > FourRealities gate authority.',
      'LedgerSeal records were found on this site, but none could be verified, so the Audit check is not used. A Jira administrator can turn it on in Jira settings > Apps > FourRealities gate authority.'
    ]);
    expect(engine.notes(settings(), { herocoders: { seenAt: AT } }, none)[0]).toContain('Checklists for Jira checklists were found on this site.');
    expect(engine.notes(settings({ process: 'off', audit: 'off' }), { definitionguard: { seenAt: AT }, ledgerseal: { seenAt: AT } }, none)).toEqual([]);
    expect(engine.notes(settings(), {}, none)).toEqual([]);
  });
});

describe('validate admin input', () => {
  const ok = { intent: 'on', process: 'auto', code: 'auto', audit: 'ledgerseal', decisionIssueTypes: [' ADR ', 'RFC', 'rfc', ''] };

  it('normalises the issue types and stamps the time', () => {
    expect(engine.validate(ok, AT)).toEqual({ settings: { schemaVersion: 1, intent: 'on', process: 'auto', code: 'auto', audit: 'ledgerseal', decisionIssueTypes: ['adr', 'rfc'], updatedAt: AT } });
  });

  it('refuses unknown modes and bad issue type lists', () => {
    expect(engine.validate({ ...ok, process: 'jira' }, AT).error).toBe('Choose a valid Process source.');
    expect(engine.validate({ ...ok, intent: 'auto' }, AT).error).toBe('Choose a valid Intent source.');
    expect(engine.validate({ ...ok, code: 1 }, AT).error).toBe('Choose a valid Code source.');
    expect(engine.validate({ ...ok, audit: 'definitionguard' }, AT).error).toBe('Choose a valid Audit source.');
    expect(engine.validate({ ...ok, decisionIssueTypes: 'adr' }, AT).error).toBe('Give the decision issue types as a list.');
    expect(engine.validate({ ...ok, decisionIssueTypes: ['  '] }, AT).error).toBe('Name at least one decision issue type.');
    expect(engine.validate({ ...ok, decisionIssueTypes: Array.from({ length: 21 }, (_, i) => `t${i}`) }, AT).error).toBe('Name at most 20 decision issue types.');
    expect(engine.validate({ ...ok, decisionIssueTypes: ['x'.repeat(61)] }, AT).error).toBe('Each decision issue type has at most 60 characters.');
    expect(engine.validate(null, AT).error).toBe('Choose a valid Intent source.');
  });
});

describe('BL-2: the standalone matrix (readiness review section 4.2) with the checks in use', () => {
  const standalone = engine.resolve(settings(), {}, CONFIG);
  const done = (o: Parameters<typeof makeFacts>[0] = {}) => makeFacts({ remoteLinks: [PAGE], siteHost: 'asymmsystems.atlassian.net', ...o });
  const rai = (f: ReturnType<typeof makeFacts>, s = standalone) => metrics.rai(evaluateGates(f, DEFAULT_CATALOG, s));

  it('rates a finished issue with a decision record 100%, not 33% or 50%', () => {
    const gates = evaluateGates(done(), DEFAULT_CATALOG, standalone);
    expect([gates.process.reason, gates.code.reason, gates.audit.reason]).toEqual(['SOURCE_NOT_IN_USE', 'SOURCE_NOT_IN_USE', 'SOURCE_NOT_IN_USE']);
    expect(rai(done())).toBe(100);
  });

  it('never lowers the score when an issue is finished', () => {
    expect(rai(done({ statusCategory: 'indeterminate' }))).toBe(rai(done()));
  });

  it('with pull request data, Code counts and the merged pull request keeps the score', () => {
    const withCode = engine.resolve(settings(), {}, { ...CONFIG, pullRequestsSeen: true });
    const merged = done({ devField: { present: true, summary: { count: 1, state: 'MERGED', openCount: 0, mergedCount: 1, declinedCount: 0 } } });
    expect(rai(merged, withCode)).toBe(100);
    expect(rai(done(), withCode)).toBe(50);
  });

  it('with DefinitionGuard and LedgerSeal in use, a missing record still counts as missing', () => {
    const suite = engine.resolve(settings({ process: 'definitionguard', audit: 'ledgerseal' }), {}, CONFIG);
    expect(rai(done(), suite)).toBe(33);
    const sealed = done({ properties: { dod: { isFullySatisfied: true, completedCount: 1, totalCount: 1, checklistHash: HASH } }, attestations: { dod: 'VERIFIED' } });
    expect(rai(sealed, suite)).toBe(67);
  });

  it('reads only the chosen Process source and names Checklists for Jira when it is missing', () => {
    const hc = engine.resolve(settings({ process: 'herocoders' }), {}, CONFIG);
    const f = done({ properties: { dod: { isFullySatisfied: true, completedCount: 1, totalCount: 1, checklistHash: HASH } }, attestations: { dod: 'VERIFIED' } });
    expect(evaluateGates(f, DEFAULT_CATALOG, hc).process).toEqual({ state: 'MISSING', reason: 'CHECKLIST_NONE' });
    const dg = engine.resolve(settings({ process: 'definitionguard' }), {}, CONFIG);
    expect(evaluateGates(done({ properties: { checklist: { uncheckedMandatoryItems: 0 } } }), DEFAULT_CATALOG, dg).process).toEqual({ state: 'MISSING', reason: 'DOD_NONE' });
  });

  it('uses the decision issue types of the settings (F-M6)', () => {
    const rfc = engine.resolve(settings({ decisionIssueTypes: ['RFC'] }), {}, CONFIG);
    const linked = done({ remoteLinks: [], issueLinks: [{ key: 'ARCH-1', typeName: 'RFC' }] });
    expect(evaluateGates(linked, DEFAULT_CATALOG, rfc).intent.state).toBe('FOUND');
    expect(evaluateGates(linked, DEFAULT_CATALOG, standalone).intent.state).toBe('MISSING');
    const off = engine.resolve(settings({ intent: 'off' }), {}, CONFIG);
    expect(evaluateGates(linked, DEFAULT_CATALOG, off).intent.reason).toBe('SOURCE_NOT_IN_USE');
  });

  it('keeps "no development tool" when the site has no Development field', () => {
    expect(evaluateGates(done({ devField: { present: false, summary: NO_PULL_REQUEST } }), DEFAULT_CATALOG, standalone).code.reason).toBe('NO_DEV_TOOL');
  });
});
