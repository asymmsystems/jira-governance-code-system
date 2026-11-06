/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: words for the checks in use and the admin page (ADR-013).
 */

import { DEFAULT_SOURCE_SETTINGS, SourcesInUse } from '../../src/contract/data/models';
import { AUDIT_OPTIONS, CODE_OPTIONS, INTENT_OPTIONS, PROCESS_OPTIONS, detectionLine, gateInUse, inUseWord, optionOf, parseIssueTypes, sourcesLine, withSetting } from '../../src/ui/sources-text';

const none: SourcesInUse = { intent: true, process: null, code: false, audit: false, decisionIssueTypes: ['adr'], detected: { process: false, code: false, audit: false } };
const all: SourcesInUse = { intent: true, process: 'definitionguard', code: true, audit: true, decisionIssueTypes: ['adr'], detected: { process: true, code: true, audit: false } };

describe('checks in use', () => {
  it('says which checks are in use and which are not', () => {
    expect(sourcesLine(none)).toBe('Checks in use on this site: Intent. Not used on this site: Process, Code, Audit.');
    expect(sourcesLine(all)).toBe('Checks in use on this site: Intent; Process (DefinitionGuard, detected); Code (Jira Development field, detected); Audit (LedgerSeal).');
    expect(sourcesLine({ ...none, intent: false })).toBe('No check is in use on this site. Not used on this site: Intent, Process, Code, Audit.');
    expect(sourcesLine({ ...all, process: 'herocoders', detected: { process: false, code: false, audit: true } }))
      .toBe('Checks in use on this site: Intent; Process (Checklists for Jira); Code (Jira Development field); Audit (LedgerSeal, detected).');
  });

  it('knows whether one gate is in use, and treats a view without sources as all in use', () => {
    expect(gateInUse(none, 'process')).toBe(false);
    expect(gateInUse(all, 'process')).toBe(true);
    expect(gateInUse(none, 'code')).toBe(false);
    expect(gateInUse(undefined, 'audit')).toBe(true);
    expect(inUseWord(none, 'audit')).toBe('Audit: not used on this site');
    expect(inUseWord(all, 'audit')).toBe('Audit: in use');
  });
});

describe('admin page words', () => {
  it('offers the modes of each check, with Detect first where it exists', () => {
    expect(INTENT_OPTIONS.map(o => o.value)).toEqual(['on', 'off']);
    expect(PROCESS_OPTIONS.map(o => o.value)).toEqual(['auto', 'definitionguard', 'herocoders', 'off']);
    expect(CODE_OPTIONS.map(o => o.value)).toEqual(['auto', 'on', 'off']);
    expect(AUDIT_OPTIONS.map(o => o.value)).toEqual(['auto', 'ledgerseal', 'off']);
    expect(optionOf(PROCESS_OPTIONS, 'herocoders').label).toBe('Checklists for Jira (HeroCoders)');
    expect(optionOf(PROCESS_OPTIONS, 'x' as never).value).toBe('auto');
  });

  it('says what was seen of each source', () => {
    expect(detectionLine('intent', {})).toBe('Jira issue links and remote links are always available.');
    expect(detectionLine('process', {})).toBe('No Definition of Done record seen on this site yet.');
    expect(detectionLine('process', { definitionguard: { seenAt: '2026-11-01T00:00:00Z' }, herocoders: { seenAt: '2026-11-02T00:00:00Z' } }))
      .toBe('Seen on this site: DefinitionGuard records found since 2026-11-01, none verified yet; Checklists for Jira checklists found since 2026-11-02.');
    expect(detectionLine('process', { definitionguard: { seenAt: 'a', verifiedAt: '2026-11-03T00:00:00Z' } })).toBe('Seen on this site: signed DefinitionGuard records found since 2026-11-03.');
    expect(detectionLine('code', {})).toBe('No pull request data seen on this site yet.');
    expect(detectionLine('code', { pullRequests: { seenAt: '2026-11-04T00:00:00Z' } })).toBe('Pull request data found since 2026-11-04.');
    expect(detectionLine('audit', {})).toBe('No LedgerSeal record seen on this site yet.');
    expect(detectionLine('audit', { ledgerseal: { seenAt: '2026-11-05T00:00:00Z' } })).toBe('LedgerSeal records found since 2026-11-05, none verified yet.');
    expect(detectionLine('audit', { ledgerseal: { seenAt: 'a', verifiedAt: '2026-11-06T00:00:00Z' } })).toBe('Signed LedgerSeal records found since 2026-11-06.');
  });

  it('reads issue types from one line and changes one setting', () => {
    expect(parseIssueTypes(' ADR, RFC ,, Design ')).toEqual(['ADR', 'RFC', 'Design']);
    expect(withSetting(DEFAULT_SOURCE_SETTINGS, 'audit', 'off')).toEqual({ ...DEFAULT_SOURCE_SETTINGS, audit: 'off' });
  });
});
