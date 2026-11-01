/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: render tests for the UI Kit entry component (loading, loaded, error, refresh)
 */

import * as React from 'react';
// react-test-renderer ships without type declarations; the shared node_modules has no @types package for it.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
import { bridgeState, textOf, findButton, settle } from './forge-mocks';

jest.mock('@forge/react', () => require('./forge-mocks').reactMock());
jest.mock('@forge/bridge', () => require('./forge-mocks').bridgeMock());

import { FourRealitiesApp } from '../../src/frontend/index';

const emptySummary = {
  m11TraceabilityRate: 0, m29ReviewComplianceRate: 0, m30ReworkLoopRate: 0, m40AuditComplianceRate: 0,
  averageRAI: 0, totalAuditedIssues: 0, doneCount: 0, sealedDoneCount: 0, healthyIssueCount: 0,
  atRiskIssueCount: 0, highRiskIssueKeys: [],
  gateBreakdown: {
    intent: { passed: 0, attention: 0, blocked: 0, hollow: 0 },
    process: { passed: 0, attention: 0, blocked: 0, hollow: 0 },
    code: { passed: 0, attention: 0, blocked: 0, hollow: 0 },
    audit: { passed: 0, attention: 0, blocked: 0, hollow: 0 }
  },
  weakestGate: 'audit', sprintName: 'Active Delivery', hasTrendHistory: false,
  riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 }
};

const snapshot = { snapshotId: 's1', projectKey: 'DEMO', generatedAt: '2026-11-01T00:00:00Z', generatedBy: 'acc', summary: emptySummary, issueScores: [] };

describe('FourRealitiesApp rendering', () => {
  let hookErrors: string[];
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    hookErrors = [];
    errorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      const text = String(args[0]);
      if (/order of Hooks|Rendered (more|fewer) hooks|error occurred/.test(text)) hookErrors.push(text);
    });
    bridgeState.invoke.mockReset();
  });

  afterEach(() => errorSpy.mockRestore());

  it('renders loading, then the loaded project dashboard, with no hook error', async () => {
    bridgeState.context = { extension: { project: { key: 'DEMO' } } };
    let resolveInvoke: (v: any) => void = () => undefined;
    bridgeState.invoke.mockReturnValue(new Promise(r => { resolveInvoke = r; }));

    let renderer: any;
    await act(async () => { renderer = TestRenderer.create(<FourRealitiesApp />); });
    expect(textOf(renderer.toJSON())).toContain('Evaluating');

    await act(async () => { resolveInvoke(snapshot); });
    await settle(act);

    expect(hookErrors).toEqual([]);
    expect(renderer.toJSON()).not.toBeNull();
    expect(textOf(renderer.toJSON())).toContain('Delivery Alignment Index');
  });

  it('shows an error in the issue panel when getIssueAlignment fails, not the dashboard', async () => {
    bridgeState.context = { extension: { issue: { id: '10001', key: 'DEMO-1' } } };
    bridgeState.invoke.mockRejectedValue(new Error('Failed to query Jira for issue DEMO-1'));

    let renderer: any;
    await act(async () => { renderer = TestRenderer.create(<FourRealitiesApp />); });
    await settle(act);

    expect(hookErrors).toEqual([]);
    const text = textOf(renderer.toJSON());
    expect(text).toContain('Failed to query Jira for issue DEMO-1');
    expect(text).not.toContain('Delivery Alignment Index');
  });

  it('reloads after Refresh without a hook error', async () => {
    bridgeState.context = { extension: { project: { key: 'DEMO' } } };
    bridgeState.invoke.mockResolvedValue(snapshot);

    let renderer: any;
    await act(async () => { renderer = TestRenderer.create(<FourRealitiesApp />); });
    await settle(act);

    await act(async () => { findButton(renderer.root, 'Refresh').props.onClick(); });
    await settle(act);

    expect(hookErrors).toEqual([]);
    expect(bridgeState.invoke).toHaveBeenCalledTimes(2);
    expect(textOf(renderer.toJSON())).toContain('Delivery Alignment Index');
  });

  it('links to the producer panels and offers no seal or DoD action (B-02)', async () => {
    bridgeState.context = { extension: { issue: { id: '10001', key: 'DEMO-1' } } };
    bridgeState.invoke.mockResolvedValue({
      issueId: '10001', issueKey: 'DEMO-1', summary: 'Done work', status: 'Done', statusCategory: 'Done',
      isEvaluated: true, applicableGateCount: 4, intentScore: 0, processScore: 100, codeScore: 0, auditScore: 0,
      realityAlignmentIndex: 25, riskLevel: 'CRITICAL',
      gates: { intent: 'BLOCKED', process: 'PASSED', code: 'BLOCKED', audit: 'BLOCKED' },
      synthesizedFinding: 'x', recoverablePoints: 25, findings: [], whyScoreExplanation: 'Why'
    });
    bridgeState.routerOpen.mockClear();

    let renderer: any;
    await act(async () => { renderer = TestRenderer.create(<FourRealitiesApp />); });
    await settle(act);

    const text = textOf(renderer.toJSON());
    expect(text).not.toContain('Seal Issue');
    expect(text).not.toContain('Complete DoD');

    await act(async () => { findButton(renderer.root, 'LedgerSeal Audit Gate').props.onClick(); });
    expect(bridgeState.routerOpen).toHaveBeenLastCalledWith('/browse/DEMO-1');
    await act(async () => { findButton(renderer.root, 'DefinitionGuard Checklist').props.onClick(); });
    expect(bridgeState.routerOpen).toHaveBeenLastCalledWith('/browse/DEMO-1');
  });
});
