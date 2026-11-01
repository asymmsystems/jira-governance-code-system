/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate text unit tests
 */

import { GateReason, GateResult } from '../../src/contract/data/models';
import { afterActionText, appearanceOf, chipText, detailText, glyphOf, raiText, rateText, recoveryText, riskAppearance, sourceLine, stateLabel } from '../../src/ui/gate-text';

const ALL_REASONS: GateReason[] = [
  'NOT_STARTED', 'NOT_DONE', 'INTENT_CONFLUENCE_LINK', 'INTENT_DECISION_ISSUE', 'INTENT_LINKS_NOT_READ',
  'INTENT_NONE', 'DOD_COMPLETE_DG', 'DOD_OPEN_DG', 'DOD_SHAPE_UNKNOWN', 'DOD_COMPLETE_HC', 'DOD_OPEN_HC', 'DOD_NONE',
  'CODE_EXCEPTED', 'PR_MERGED', 'PR_OPEN', 'PR_OPEN_AT_DONE', 'PR_NONE', 'NO_DEV_TOOL', 'SEAL_VALID_LS',
  'SEAL_BROKEN_LS', 'SEAL_OTHER_LS', 'SEAL_SHAPE_UNKNOWN', 'SEAL_NONE', 'CHANGED_SINCE_ATTESTATION'
];

describe('state labels, appearance and glyphs', () => {
  const cases: Array<[GateResult, string, string, string]> = [
    [{ state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK' }, 'Evidence found', 'success', '●'],
    [{ state: 'FOUND', verification: 'NOT_VERIFIED', reason: 'SEAL_VALID_LS' }, 'Evidence found (not verified)', 'inprogress', '●'],
    [{ state: 'FOUND', verification: 'HEURISTIC', reason: 'PR_MERGED' }, 'Evidence found (heuristic)', 'inprogress', '●'],
    [{ state: 'MISSING', reason: 'SEAL_NONE' }, 'Evidence missing', 'removed', '✕'],
    [{ state: 'EXCEPTED', reason: 'CODE_EXCEPTED' }, 'Excepted', 'moved', '◆'],
    [{ state: 'NEEDS_RECHECK', reason: 'CHANGED_SINCE_ATTESTATION' }, 'Needs re-check', 'moved', '◐'],
    [{ state: 'NOT_APPLICABLE', reason: 'NOT_DONE' }, 'Not applicable', 'default', '○']
  ];
  it.each(cases)('%j', (result, label, appearance, glyph) => {
    expect(stateLabel(result)).toBe(label);
    expect(appearanceOf(result)).toBe(appearance);
    expect(glyphOf(result)).toBe(glyph);
  });

  it('shows only VERIFIED evidence in green', () => {
    expect(appearanceOf({ state: 'FOUND', verification: 'NOT_VERIFIED', reason: 'SEAL_VALID_LS' })).not.toBe('success');
  });

  it('names the gate in table chips', () => {
    expect(chipText('intent', { state: 'MISSING', reason: 'INTENT_NONE' })).toBe('Intent: evidence missing');
    expect(chipText('audit', { state: 'FOUND', verification: 'NOT_VERIFIED', reason: 'SEAL_VALID_LS' })).toBe('Audit: evidence found (not verified)');
  });
});

describe('source line and detail text', () => {
  it('names the source and how FourRealities knows it', () => {
    expect(sourceLine({ state: 'FOUND', verification: 'NOT_VERIFIED', reason: 'SEAL_VALID_LS' }))
      .toBe('Source: LedgerSeal property ledgerseal-cert, not verified by FourRealities.');
    expect(sourceLine({ state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK' }))
      .toBe('Source: Jira remote link to Confluence, verified by FourRealities.');
    expect(sourceLine({ state: 'MISSING', reason: 'DOD_NONE' })).toBe('Source: DefinitionGuard property definitionguard-dod.');
  });

  it('has a source and a sentence for every reason code, with no em dash', () => {
    for (const reason of ALL_REASONS) {
      const r: GateResult = { state: 'MISSING', reason, args: { title: 'T', key: 'K', type: 'Decision', completed: 4, total: 5, open: 2, status: 'SEAL_REVOKED', sealedAt: '2026-10-30T10:29:00Z' } };
      expect(sourceLine(r)).not.toContain('undefined');
      expect(detailText(r).length).toBeGreaterThan(10);
      expect(detailText(r)).not.toMatch(/\u2014/);
    }
  });

  it('fills arguments into the sentence', () => {
    expect(detailText({ state: 'FOUND', reason: 'DOD_COMPLETE_DG', args: { completed: 5, total: 5 } })).toContain('5 of 5 items');
    expect(detailText({ state: 'FOUND', reason: 'SEAL_VALID_LS', args: { sealedAt: '2026-10-30T10:29:00Z' } })).toContain('(2026-10-30)');
    expect(detailText({ state: 'FOUND', reason: 'SEAL_VALID_LS' })).toBe('LedgerSeal reports the issue is sealed.');
  });
});

describe('rates and RAI text', () => {
  it('shows n/a for an empty denominator', () => {
    expect(rateText(null)).toBe('n/a');
    expect(rateText(42)).toBe('42%');
    expect(raiText({ rai: null, risk: 'UNRATED' })).toBe('UNRATED');
    expect(raiText({ rai: 62, risk: 'HIGH' })).toBe('62% (HIGH)');
  });

  it('maps risk to lozenge appearance', () => {
    expect(riskAppearance('LOW')).toBe('success');
    expect(riskAppearance('MEDIUM')).toBe('moved');
    expect(riskAppearance('HIGH')).toBe('removed');
    expect(riskAppearance('CRITICAL')).toBe('removed');
    expect(riskAppearance('UNRATED')).toBe('default');
  });
});

describe('recoveryText', () => {
  const NA: GateResult = { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
  it('names the first missing gate in the order Intent, Code, Process, Audit', () => {
    const gates = { intent: NA, process: { state: 'MISSING', reason: 'DOD_NONE' } as GateResult, code: { state: 'MISSING', reason: 'PR_NONE' } as GateResult, audit: NA };
    expect(recoveryText({ gates, recoverablePoints: 33 })).toBe("Adding Code evidence raises this issue's RAI by 33 points.");
    expect(recoveryText({ gates, recoverablePoints: 0 })).toBeUndefined();
    expect(recoveryText({ gates: { intent: NA, process: NA, code: NA, audit: NA }, recoverablePoints: 10 })).toBeUndefined();
  });
});

describe('B-17: afterActionText (feedback from the re-evaluated state, FR-20)', () => {
  const found: GateResult = { state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK' };
  const missing: GateResult = { state: 'MISSING', reason: 'PR_NONE' };
  const excepted: GateResult = { state: 'EXCEPTED', reason: 'CODE_EXCEPTED' };
  const row = (intent: GateResult, code: GateResult) => ({ gates: { intent, process: missing, code, audit: missing } });

  it('names the gate state that Jira returned after the write', () => {
    expect(afterActionText('link', row(found, missing))).toBe('Link added. Intent: Evidence found.');
    expect(afterActionText('link', row({ state: 'MISSING', reason: 'INTENT_NONE' }, missing))).toBe('Link added. Intent: Evidence missing.');
    expect(afterActionText('code', row(found, missing))).toBe('Exception requested. A project administrator must approve it. Code: Evidence missing.');
    expect(afterActionText('decision', row(found, excepted))).toBe('Decision recorded. Code: Excepted.');
    expect(afterActionText('rework', row(found, missing))).toBe('Rework reason recorded. It does not change any gate.');
  });

  it('says so when the gates could not be read again, and never claims a state', () => {
    expect(afterActionText('link')).toBe('Link added. The gates could not be read again. Use Refresh.');
    expect(afterActionText('decision')).toBe('Decision recorded. The gates could not be read again. Use Refresh.');
    expect(afterActionText('rework')).toBe('Rework reason recorded. It does not change any gate.');
  });
});
