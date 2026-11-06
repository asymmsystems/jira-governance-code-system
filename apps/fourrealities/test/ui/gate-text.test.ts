/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: gate text unit tests
 */

import { GateReason, GateResult } from '../../src/contract/data/models';
import { afterActionText, appearanceOf, chipText, detailText, glyphOf, raiPartsText, raiText, rateText, recoveryText, riskAppearance, sourceLine, stateLabel } from '../../src/ui/gate-text';

const ALL_REASONS: GateReason[] = [
  'NOT_STARTED', 'NOT_DONE', 'INTENT_CONFLUENCE_LINK', 'INTENT_DECISION_ISSUE', 'INTENT_LINKS_NOT_READ',
  'INTENT_NONE', 'DOD_COMPLETE_DG', 'DOD_OPEN_DG', 'DOD_SHAPE_UNKNOWN', 'DOD_COMPLETE_HC', 'DOD_OPEN_HC', 'DOD_NONE',
  'CODE_EXCEPTED', 'PR_MERGED', 'PR_OPEN', 'PR_OPEN_AT_DONE', 'PR_NONE', 'NO_DEV_TOOL', 'SEAL_VALID_LS',
  'SEAL_BROKEN_LS', 'SEAL_OTHER_LS', 'SEAL_SHAPE_UNKNOWN', 'SEAL_NONE', 'CHANGED_SINCE_ATTESTATION',
  'DOD_SIGNATURE_INVALID', 'SEAL_SIGNATURE_INVALID'
];

describe('state labels, appearance and glyphs', () => {
  const cases: Array<[GateResult, string, string, string]> = [
    [{ state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK' }, 'Evidence found', 'success', '●'],
    [{ state: 'FOUND', verification: 'NOT_VERIFIED', reason: 'SEAL_VALID_LS' }, 'Evidence found (not verified)', 'inprogress', '●'],
    [{ state: 'REPORTED', verification: 'NOT_VERIFIED', reason: 'SEAL_VALID_LS' }, 'Reported, not verified', 'inprogress', '◑'],
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

  it('B-33: names the gate and a short state in pipeline chips, so the chip stays small', () => {
    expect(chipText('intent', { state: 'MISSING', reason: 'INTENT_NONE' })).toBe('Intent: missing');
    expect(chipText('intent', { state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK' })).toBe('Intent: found');
    expect(chipText('audit', { state: 'FOUND', verification: 'NOT_VERIFIED', reason: 'SEAL_VALID_LS' })).toBe('Audit: found, not verified');
    expect(chipText('code', { state: 'FOUND', verification: 'HEURISTIC', reason: 'PR_MERGED' })).toBe('Code: found, heuristic');
    expect(chipText('code', { state: 'EXCEPTED', reason: 'CODE_EXCEPTED' })).toBe('Code: excepted');
    expect(chipText('intent', { state: 'NEEDS_RECHECK', reason: 'INTENT_LINKS_NOT_READ' })).toBe('Intent: re-check');
    expect(chipText('process', { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' })).toBe('Process: n/a');
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

describe('B-21: raiPartsText', () => {
  const found: GateResult = { state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK' };
  const missing: GateResult = { state: 'MISSING', reason: 'PR_NONE' };
  const na: GateResult = { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };

  it('gives RAI with its parts: gates with evidence, rated gates, and applicable gates', () => {
    expect(raiPartsText({ rai: 67, risk: 'HIGH', applicableGates: 3, gates: { intent: found, process: found, code: missing, audit: na } }))
      .toBe('Reality Alignment Index (RAI) 67% (HIGH): 2 of 3 rated gates have evidence found. 3 of 4 gates apply to this issue.');
    expect(raiPartsText({ rai: null, risk: 'UNRATED', applicableGates: 0, gates: { intent: na, process: na, code: na, audit: na } }))
      .toBe('Reality Alignment Index (RAI): not rated. No gate applies to this issue yet.');
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
  it('names the first missing gate in chain order Intent, Process, Code, Audit, like the next step (F-L5)', () => {
    const gates = { intent: NA, process: { state: 'MISSING', reason: 'DOD_NONE' } as GateResult, code: { state: 'MISSING', reason: 'PR_NONE' } as GateResult, audit: NA };
    expect(recoveryText({ gates, recoverablePoints: 33 })).toBe("Adding Process evidence raises this issue's RAI by 33 points.");
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
    expect(afterActionText('code', row(found, missing))).toBe('Exception requested. A project or Jira administrator must approve it. Code: Evidence missing.');
    expect(afterActionText('decision', row(found, excepted))).toBe('Decision recorded. Code: Excepted.');
    expect(afterActionText('rework', row(found, missing))).toBe('Rework reason recorded. It does not change any gate.');
    expect(afterActionText('review' as any, row(found, missing))).toBe('Review requested. It does not change any gate.');
  });

  it('says so when the gates could not be read again, and never claims a state', () => {
    expect(afterActionText('link')).toBe('Link added. The gates could not be read again. Use Refresh.');
    expect(afterActionText('decision')).toBe('Decision recorded. The gates could not be read again. Use Refresh.');
    expect(afterActionText('rework')).toBe('Rework reason recorded. It does not change any gate.');
    expect(afterActionText('review' as any)).toBe('Review requested. It does not change any gate.');
  });
});

describe('ADR-012: text for reported and signature-failed records', () => {
  const reported: GateResult = { state: 'REPORTED', verification: 'NOT_VERIFIED', reason: 'DOD_COMPLETE_DG', args: { completed: 2, total: 3, why: 'unknown key' } };

  it('says what the record reports and why it is not scored', () => {
    expect(detailText(reported)).toBe('DefinitionGuard reports the Definition of Done is complete (2 of 3 items). FourRealities could not verify this record (unknown key), so it is not scored.');
    expect(detailText({ ...reported, args: { completed: 2, total: 3 } })).toContain('could not verify this record, so it is not scored.');
    expect(chipText('process', reported)).toBe('Process: reported, not verified');
    expect(sourceLine(reported)).toBe('Source: DefinitionGuard property definitionguard-dod, not verified by FourRealities.');
  });

  it('explains a failed signature check', () => {
    expect(detailText({ state: 'MISSING', reason: 'DOD_SIGNATURE_INVALID', args: { why: 'signature does not match' } }))
      .toBe('The Definition of Done record failed its signature check (signature does not match). It was changed after DefinitionGuard wrote it, or copied from another issue.');
    expect(detailText({ state: 'MISSING', reason: 'SEAL_SIGNATURE_INVALID', args: { why: 'signed for another issue' } })).toContain('The LedgerSeal record failed its signature check (signed for another issue).');
    expect(sourceLine({ state: 'FOUND', verification: 'VERIFIED', reason: 'SEAL_VALID_LS' })).toBe('Source: LedgerSeal property ledgerseal-cert, verified by FourRealities.');
  });
});

describe('ADR-013: text for a check that is not in use and a missing checklist', () => {
  const notUsed: GateResult = { state: 'NOT_APPLICABLE', reason: 'SOURCE_NOT_IN_USE' };
  it('says the check is not used on this site and where to turn it on', () => {
    expect(stateLabel(notUsed)).toBe('Not used on this site');
    expect(chipText('audit', notUsed)).toBe('Audit: not used');
    expect(detailText(notUsed)).toBe('This check is not used on this site, so it is not scored. A Jira administrator can turn it on in Jira settings > Apps > FourRealities gate authority.');
    expect(sourceLine(notUsed)).toBe('Source: FourRealities gate authority settings.');
    expect(detailText({ state: 'MISSING', reason: 'CHECKLIST_NONE' })).toBe('No Checklists for Jira checklist on this issue.');
  });
});
