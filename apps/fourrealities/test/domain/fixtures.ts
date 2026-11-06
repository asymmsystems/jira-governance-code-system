/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: shared test fixtures for issue facts and gate results
 */

import { GateResult, IssueFacts, IssueGates, NO_PULL_REQUEST } from '../../src/contract/data/models';

export function makeFacts(overrides: Partial<IssueFacts> = {}): IssueFacts {
  const base: IssueFacts = {
    issueId: '10001',
    issueKey: 'DEMO-1',
    summary: 'Deliver the settlement flow',
    statusName: 'Done',
    statusCategory: 'done',
    assigneeAccountId: 'acc-ana',
    sprintNames: [],
    started: true,
    statusChanges: 2,
    reworkLoops: 0,
    issueLinks: [],
    remoteLinks: [],
    devField: { present: true, summary: NO_PULL_REQUEST },
    properties: {},
    ...overrides
  };
  // Started is derived from Jira data unless a test sets it.
  return 'started' in overrides ? base : { ...base, started: base.statusCategory !== 'new' || base.statusChanges > 0 };
}

/** The judgement of a gate, without the observation fields (method, evidenceRef) that B-31 added. */
export function judged(result: GateResult): GateResult {
  const { method, evidenceRef, ...rest } = result;
  return rest;
}

export const FOUND_V: GateResult = { state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK' };
export const MISSING: GateResult = { state: 'MISSING', reason: 'INTENT_NONE' };
export const NA: GateResult = { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };
export const EXCEPTED: GateResult = { state: 'EXCEPTED', reason: 'CODE_EXCEPTED' };
export const RECHECK: GateResult = { state: 'NEEDS_RECHECK', reason: 'INTENT_LINKS_NOT_READ' };

export function gates(intent: GateResult, process: GateResult, code: GateResult, audit: GateResult): IssueGates {
  return { intent, process, code, audit };
}
