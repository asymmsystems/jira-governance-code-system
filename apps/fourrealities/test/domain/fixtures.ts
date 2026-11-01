/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: shared test fixtures for issue facts and gate results
 */

import { GateResult, IssueFacts, IssueGates } from '../../src/domain/models';

export function makeFacts(overrides: Partial<IssueFacts> = {}): IssueFacts {
  return {
    issueId: '10001',
    issueKey: 'DEMO-1',
    summary: 'Deliver the settlement flow',
    statusName: 'Done',
    statusCategory: 'done',
    assigneeName: 'Ana Silva',
    sprintNames: [],
    statusChanges: 2,
    reworkLoops: 0,
    issueLinks: [],
    remoteLinks: [],
    devField: { present: true },
    properties: {},
    ...overrides
  };
}

export const FOUND_V: GateResult = { state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK' };
export const MISSING: GateResult = { state: 'MISSING', reason: 'INTENT_NONE' };
export const NA: GateResult = { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
export const EXCEPTED: GateResult = { state: 'EXCEPTED', reason: 'CODE_EXCEPTED' };
export const RECHECK: GateResult = { state: 'NEEDS_RECHECK', reason: 'INTENT_LINKS_NOT_READ' };

export function gates(intent: GateResult, process: GateResult, code: GateResult, audit: GateResult): IssueGates {
  return { intent, process, code, audit };
}
