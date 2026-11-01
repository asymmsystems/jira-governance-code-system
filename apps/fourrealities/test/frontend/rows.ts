/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: row and dashboard fixtures for render tests
 */

import { MetricsEngine } from '../../src/domain/metrics-engine';
import { GateResult, IssueRow, ProjectDashboardView } from '../../src/domain/models';
import { makeFacts } from '../domain/fixtures';

export const F: GateResult = { state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK' };
export const M_INTENT: GateResult = { state: 'MISSING', reason: 'INTENT_NONE' };
export const M_DOD: GateResult = { state: 'MISSING', reason: 'DOD_NONE' };
export const M_CODE: GateResult = { state: 'MISSING', reason: 'PR_NONE' };
export const M_SEAL: GateResult = { state: 'MISSING', reason: 'SEAL_NONE' };
export const NA: GateResult = { state: 'NOT_APPLICABLE', reason: 'NOT_DONE' };

export function row(key: string, gates: { intent: GateResult; process: GateResult; code: GateResult; audit: GateResult }, extra: any = {}): IssueRow {
  return MetricsEngine.buildRow(makeFacts({ issueId: key.replace(/\D/g, ''), issueKey: key, summary: `Work ${key}`, ...extra }), gates);
}

export function dashboard(rows: IssueRow[], extra: Partial<ProjectDashboardView> = {}): ProjectDashboardView {
  return { projectKey: 'DEMO', generatedAt: '2026-11-01T08:30:00.000Z', summary: MetricsEngine.summarize(rows), rows, trend: [], coverage: { shown: rows.length, totalKnown: rows.length, capped: false }, ...extra };
}
