/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: render tests for the UI Kit root component (loading, loaded, error, refresh)
 */

import * as React from 'react';
// react-test-renderer ships without type declarations; the shared node_modules has no @types package for it.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
import { bridgeState, textOf, findButton, findAll, flatText, settle } from './forge-mocks';
import { dashboard, row, F, M_INTENT, M_SEAL, NA } from './rows';

jest.mock('@forge/react', () => require('./forge-mocks').reactMock());
jest.mock('@forge/bridge', () => require('./forge-mocks').bridgeMock());

import { FourRealitiesApp } from '../../src/frontend/index';
import { errorText } from '../../src/ui/triage';

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
    bridgeState.routerOpen.mockClear();
  });

  afterEach(() => errorSpy.mockRestore());

  it('renders loading, then the loaded project dashboard, with no hook error', async () => {
    bridgeState.context = { extension: { project: { key: 'DEMO' } } };
    let resolveInvoke: (v: any) => void = () => undefined;
    bridgeState.invoke.mockReturnValue(new Promise(r => { resolveInvoke = r; }));

    let renderer: any;
    await act(async () => { renderer = TestRenderer.create(<FourRealitiesApp />); });
    expect(textOf(renderer.toJSON())).toContain('Evaluating delivery evidence');

    await act(async () => { resolveInvoke({ ok: true, ...dashboard([row('DEMO-1', { intent: F, process: NA, code: NA, audit: NA })]) }); });
    await settle(act);

    expect(hookErrors).toEqual([]);
    expect(bridgeState.invoke).toHaveBeenCalledWith('getProjectDashboard', {});
    expect(textOf(renderer.toJSON())).toContain('Four Realities DEMO');
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
    expect(text).not.toContain('Four Realities DEMO');
  });

  it('B-17: keeps the issue panel mounted after an action, so its message stays, and shows the new row', async () => {
    bridgeState.context = { extension: { issue: { id: '7', key: 'DEMO-7' } } };
    const before = row('DEMO-7', { intent: M_INTENT, process: NA, code: NA, audit: NA });
    const after = row('DEMO-7', { intent: F, process: NA, code: NA, audit: NA });
    bridgeState.invoke.mockResolvedValueOnce({ ok: true, row: before });
    let renderer: any;
    await act(async () => { renderer = TestRenderer.create(<FourRealitiesApp />); });
    await settle(act);

    await act(async () => { findButton(renderer.root, 'Link decision record').props.onClick(); });
    bridgeState.invoke.mockResolvedValueOnce({ success: true, row: after });
    await act(async () => { findButton(renderer.root, 'Add link').props.onClick(); });
    await settle(act);

    const text = textOf(renderer.toJSON());
    expect(text).toContain('Link added. Intent: Evidence found.');
    expect(text).not.toContain('Link decision record');
    expect(text).not.toContain('Evaluating delivery evidence');
    expect(bridgeState.invoke).toHaveBeenCalledTimes(2);
    expect(hookErrors).toEqual([]);
  });

  it('B-23: shows an inactive licence as its own warning message, not as a Jira error', async () => {
    bridgeState.context = { extension: { project: { key: 'DEMO' } } };
    bridgeState.invoke.mockResolvedValue({ ok: false, error: { code: 'LICENSE_INACTIVE', message: 'The FourRealities licence for this site is not active.' } });
    let renderer: any;
    await act(async () => { renderer = TestRenderer.create(<FourRealitiesApp />); });
    await settle(act);
    const message = renderer.root.findAll((n: any) => n.type === 'ui-SectionMessage')[0];
    expect(message.props).toEqual(expect.objectContaining({ appearance: 'warning', title: 'Licence not active' }));
    expect(textOf(renderer.toJSON())).toContain('The FourRealities licence for this site is not active.');
  });

  it('B-38: renders the compact panel in the issue context module, and passes the viewer to the dashboard', async () => {
    bridgeState.context = { moduleKey: 'fourrealities-issue-context', extension: { issue: { id: '7', key: 'DEMO-7' } } };
    bridgeState.invoke.mockResolvedValueOnce({ ok: true, row: row('DEMO-7', { intent: M_INTENT, process: NA, code: NA, audit: NA }) });
    let renderer: any;
    await act(async () => { renderer = TestRenderer.create(<FourRealitiesApp />); });
    await settle(act);
    expect(renderer.root.findAll((n: any) => n.props && n.props.compact === true).length).toBeGreaterThan(0);
    findButton(renderer.root, 'See all findings');

    bridgeState.context = { accountId: 'acc-9', extension: { project: { key: 'DEMO' } } };
    bridgeState.invoke.mockResolvedValueOnce({ ok: true, ...dashboard([row('DEMO-1', { intent: F, process: NA, code: NA, audit: NA })]) });
    await act(async () => { renderer = TestRenderer.create(<FourRealitiesApp />); });
    await settle(act);
    expect(renderer.root.findAll((n: any) => n.props && n.props.viewerAccountId === 'acc-9').length).toBeGreaterThan(0);
  });

  it('shows the resolver error message from an error envelope', async () => {
    bridgeState.context = { extension: { project: { key: 'DEMO' } } };
    bridgeState.invoke.mockResolvedValue({ ok: false, error: { code: 'FORBIDDEN', message: 'Live Jira sync failed (HTTP 403).' } });

    let renderer: any;
    await act(async () => { renderer = TestRenderer.create(<FourRealitiesApp />); });
    await settle(act);
    expect(textOf(renderer.toJSON())).toContain('Live Jira sync failed (HTTP 403).');
  });

  it('reloads after Refresh without a hook error', async () => {
    bridgeState.context = { extension: { project: { key: 'DEMO' } } };
    bridgeState.invoke.mockResolvedValue({ ok: true, ...dashboard([row('DEMO-1', { intent: F, process: NA, code: NA, audit: NA })]) });

    let renderer: any;
    await act(async () => { renderer = TestRenderer.create(<FourRealitiesApp />); });
    await settle(act);

    await act(async () => { findButton(renderer.root, 'Refresh').props.onClick(); });
    await settle(act);

    expect(hookErrors).toEqual([]);
    expect(bridgeState.invoke).toHaveBeenCalledTimes(2);
    expect(bridgeState.invoke).toHaveBeenLastCalledWith('refreshProjectSnapshot', {});
    expect(textOf(renderer.toJSON())).toContain('Four Realities DEMO');
  });

  it('offers no seal or DoD action and no button that only reopens the issue (B-02, BL-4)', async () => {
    bridgeState.context = { extension: { issue: { id: '10001', key: 'DEMO-1' } } };
    bridgeState.invoke.mockResolvedValue({ ok: true, row: row('DEMO-1', { intent: M_INTENT, process: F, code: NA, audit: M_SEAL }) });

    let renderer: any;
    await act(async () => { renderer = TestRenderer.create(<FourRealitiesApp />); });
    await settle(act);

    const text = textOf(renderer.toJSON());
    expect(text).not.toContain('Seal Issue');
    expect(text).not.toContain('Complete DoD');

    expect(() => findButton(renderer.root, 'LedgerSeal Audit Gate')).toThrow('No button');
    expect(() => findButton(renderer.root, 'DefinitionGuard Checklist')).toThrow('No button');
    expect(text).toContain('Next: link the decision record.');
  });

  it('passes the approval from the resolver to the panel (ADR-013)', async () => {
    bridgeState.context = { extension: { issue: { id: '10001', key: 'DEMO-1' } } };
    const state = { status: 'REQUESTED', issueKey: 'DEMO-1', requestedBy: 'dev-1', requestedAt: '2026-11-01T00:00:00Z', reason: 'Configuration change only' };
    bridgeState.invoke.mockResolvedValue({ ok: true, row: row('DEMO-1', { intent: F, process: NA, code: { state: 'MISSING', reason: 'PR_NONE' }, audit: NA }, { codeException: state }), approval: { canDecide: false, isRequester: true, note: 'You requested this exception, so another approver must decide.' } });
    let renderer: any;
    await act(async () => { renderer = TestRenderer.create(<FourRealitiesApp />); });
    await settle(act);
    await act(async () => { findAll(renderer.root, 'Button', p => flatText(p.children) === 'Show details')[0]?.props.onClick(); });
    expect(textOf(renderer.toJSON())).toContain('You requested this exception, so another approver must decide.');
    findButton(renderer.root, 'Withdraw request');
  });

  it('falls back to a generic error text', () => {
    expect(errorText(undefined, 'fallback')).toBe('fallback');
    expect(errorText({ message: 'm' }, 'fallback')).toBe('m');
  });

  it('treats an unreadable context as the project page', async () => {
    bridgeState.context = new Error('no context');
    bridgeState.invoke.mockResolvedValue({ ok: false, error: { code: 'INVALID_INPUT', message: 'FourRealities: open this page from a Jira project.' } });
    let renderer: any;
    await act(async () => { renderer = TestRenderer.create(<FourRealitiesApp />); });
    await settle(act);
    expect(bridgeState.invoke).toHaveBeenCalledWith('getProjectDashboard', {});
    expect(textOf(renderer.toJSON())).toContain('open this page from a Jira project');
  });

  it('reloads the issue panel with getIssueAlignment', async () => {
    bridgeState.context = { extension: { issue: { id: '10001', key: 'DEMO-1' } } };
    bridgeState.invoke.mockResolvedValue({ ok: true, row: row('DEMO-1', { intent: F, process: NA, code: NA, audit: NA }) });
    let renderer: any;
    await act(async () => { renderer = TestRenderer.create(<FourRealitiesApp />); });
    await settle(act);
    await act(async () => { findButton(renderer.root, 'Refresh').props.onClick(); });
    await settle(act);
    expect(bridgeState.invoke.mock.calls.map((c: any) => c[0])).toEqual(['getIssueAlignment', 'getIssueAlignment']);
  });
});

