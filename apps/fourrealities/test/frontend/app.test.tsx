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
import { bridgeState, textOf, findButton, settle } from './forge-mocks';
import { dashboard, row, F, M_INTENT, M_SEAL, NA } from './rows';

jest.mock('@forge/react', () => require('./forge-mocks').reactMock());
jest.mock('@forge/bridge', () => require('./forge-mocks').bridgeMock());

import { FourRealitiesApp } from '../../src/frontend/index';
import { errorText } from '../../src/frontend/app';

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
    expect(textOf(renderer.toJSON())).toMatch(/Delivery evidence:\s+DEMO/);
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
    expect(text).not.toMatch(/Delivery evidence:\s+DEMO/);
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
    expect(textOf(renderer.toJSON())).toMatch(/Delivery evidence:\s+DEMO/);
  });

  it('links to the producer panels and offers no seal or DoD action (B-02)', async () => {
    bridgeState.context = { extension: { issue: { id: '10001', key: 'DEMO-1' } } };
    bridgeState.invoke.mockResolvedValue({ ok: true, row: row('DEMO-1', { intent: M_INTENT, process: F, code: NA, audit: M_SEAL }) });

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

