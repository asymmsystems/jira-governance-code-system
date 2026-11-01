/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: issue panel render tests (gate rows, sources, remediation modals)
 */

import * as React from 'react';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
import { bridgeState, findAll, findButton, settle, textOf } from './forge-mocks';
import { F, M_CODE, M_DOD, M_INTENT, NA, row } from './rows';

jest.mock('@forge/react', () => require('./forge-mocks').reactMock());
jest.mock('@forge/bridge', () => require('./forge-mocks').bridgeMock());

import { IssuePanel } from '../../src/frontend/issue-panel';

async function mount(r: any, onReload = jest.fn()) {
  let renderer: any;
  await act(async () => { renderer = TestRenderer.create(<IssuePanel row={r} onReload={onReload} />); });
  return renderer;
}

function type(renderer: any, id: string, value: string) {
  findAll(renderer.root, 'Textfield', p => p.id === id)[0].props.onChange({ target: { value } });
}

describe('IssuePanel', () => {
  beforeEach(() => {
    bridgeState.invoke.mockReset();
    bridgeState.routerOpen.mockClear();
  });

  it('shows each gate with state, source and missing evidence in words (B-16)', async () => {
    const r = await mount(row('DEMO-5', { intent: M_INTENT, process: F, code: NA, audit: { state: 'FOUND', verification: 'NOT_VERIFIED', reason: 'SEAL_VALID_LS' } }));
    const text = textOf(r.toJSON());
    expect(text).toContain('Intent: Evidence missing');
    expect(text).toContain('No Confluence page or decision issue is linked.');
    expect(text).toContain('Code: Not applicable');
    expect(text).toContain('Audit: Evidence found (not verified)');
    expect(text).toContain('Source: LedgerSeal property ledgerseal-cert, not verified by FourRealities.');
    expect(text).toContain('67% (HIGH)');
    expect(text).toContain('3 of 4 gates rated');
  });

  it('shows UNRATED when no gate is rated', async () => {
    const r = await mount(row('DEMO-6', { intent: NA, process: NA, code: NA, audit: NA }));
    expect(textOf(r.toJSON())).toContain('UNRATED');
  });

  it('opens the decision link modal with empty fields and reloads after a successful link', async () => {
    const onReload = jest.fn();
    const r = await mount(row('DEMO-7', { intent: M_INTENT, process: NA, code: NA, audit: NA }), onReload);
    await act(async () => { findButton(r.root, 'Link decision record').props.onClick(); });
    const fields = findAll(r.root, 'Textfield');
    expect(fields.map((f: any) => f.props.value)).toEqual(['', '']);
    expect(findAll(r.root, 'Label').map((l: any) => l.props.labelFor)).toEqual(['fr-link-url', 'fr-link-title']);

    await act(async () => { type(r, 'fr-link-url', 'https://s.atlassian.net/wiki/x'); type(r, 'fr-link-title', 'ADR-7'); });
    bridgeState.invoke.mockResolvedValue({ success: true });
    await act(async () => { findButton(r.root, 'Add link').props.onClick(); });
    await settle(act);

    expect(bridgeState.invoke).toHaveBeenCalledWith('linkDecision', { issueId: '7', issueKey: 'DEMO-7', url: 'https://s.atlassian.net/wiki/x', title: 'ADR-7' });
    expect(onReload).toHaveBeenCalled();
    expect(textOf(r.toJSON())).toContain('Link added.');
    expect(findAll(r.root, 'Modal')).toHaveLength(0);
  });

  it('keeps the modal open and shows the error when the link fails', async () => {
    const r = await mount(row('DEMO-8', { intent: M_INTENT, process: NA, code: NA, audit: NA }));
    await act(async () => { findButton(r.root, 'Link decision record').props.onClick(); });
    bridgeState.invoke.mockResolvedValueOnce({ success: false, error: 'You need the Edit issues permission on DEMO-8 to add a link.' });
    await act(async () => { findButton(r.root, 'Add link').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('You need the Edit issues permission on DEMO-8 to add a link.');
    bridgeState.invoke.mockRejectedValueOnce(new Error('network down'));
    await act(async () => { findButton(r.root, 'Add link').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('network down');
    bridgeState.invoke.mockResolvedValueOnce({});
    await act(async () => { findButton(r.root, 'Add link').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('The link was not added.');
    await act(async () => { findButton(r.root, 'Cancel').props.onClick(); });
    expect(findAll(r.root, 'Modal')).toHaveLength(0);
  });

  it('records a Code exception and a rework reason through the exception modal', async () => {
    const onReload = jest.fn();
    const r = await mount(row('DEMO-9', { intent: F, process: M_DOD, code: M_CODE, audit: NA }, { reworkLoops: 2 }), onReload);
    expect(textOf(r.toJSON())).toContain('Rework loops: 2.');

    await act(async () => { findButton(r.root, 'Record Code exception').props.onClick(); });
    expect(findAll(r.root, 'Textfield').map((f: any) => f.props.value)).toEqual(['', '']);
    await act(async () => { type(r, 'fr-exception-reason', 'Configuration change only'); type(r, 'fr-exception-notes', 'CHG-1'); });
    bridgeState.invoke.mockResolvedValueOnce({ success: false, error: 'Reason too short' });
    await act(async () => { findButton(r.root, 'Save exception').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('Reason too short');
    bridgeState.invoke.mockRejectedValueOnce({});
    await act(async () => { findButton(r.root, 'Save exception').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('The exception was not recorded.');
    bridgeState.invoke.mockResolvedValueOnce({ success: true });
    await act(async () => { findButton(r.root, 'Save exception').props.onClick(); });
    expect(bridgeState.invoke).toHaveBeenLastCalledWith('recordException', { issueId: '9', issueKey: 'DEMO-9', type: 'CODE', reason: 'Configuration change only', notes: 'CHG-1' });
    expect(textOf(r.toJSON())).toContain('Exception recorded.');

    await act(async () => { findButton(r.root, 'Add rework reason').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('This note does not change any gate.');
    bridgeState.invoke.mockResolvedValueOnce({ success: true });
    await act(async () => { findButton(r.root, 'Save reason').props.onClick(); });
    expect(bridgeState.invoke).toHaveBeenLastCalledWith('recordException', expect.objectContaining({ type: 'REWORK' }));
    expect(textOf(r.toJSON())).toContain('Rework reason recorded.');
    await act(async () => { findButton(r.root, 'Record Code exception').props.onClick(); });
    await act(async () => { findButton(r.root, 'Cancel').props.onClick(); });
    expect(onReload).toHaveBeenCalledTimes(2);
  });

  it('shows who and why for an exception and a rework reason', async () => {
    const n = { reason: 'Configuration change only', recordedBy: 'acc-1', recordedAt: '2026-11-01T09:00:00Z' };
    const r = await mount(row('DEMO-10', { intent: F, process: F, code: { state: 'EXCEPTED', reason: 'CODE_EXCEPTED' }, audit: NA },
      { reworkLoops: 1, exception: { schemaVersion: 2, issueId: '10', issueKey: 'DEMO-10', code: n, rework: n } }));
    const text = textOf(r.toJSON());
    expect(text).toMatch(/Excepted\s+by/);
    expect(text).toContain('on 2026-11-01: Configuration change only');
    expect(text).toContain('Rework loops: 1.');
    expect(text).toMatch(/Rework reason\s+by/);
    const users = findAll(r.root, 'User');
    expect(users.map((u: any) => u.props.accountId)).toEqual(['acc-1', 'acc-1']);
    expect(text).toContain('Code: Excepted');
    expect(text).not.toContain('Code: Evidence found');
  });

  it('treats an empty change event as an empty field', async () => {
    const r = await mount(row('DEMO-11', { intent: M_INTENT, process: NA, code: M_CODE, audit: NA }));
    await act(async () => { findButton(r.root, 'Link decision record').props.onClick(); });
    await act(async () => { type(r, 'fr-link-url', 'x'); });
    await act(async () => {
      findAll(r.root, 'Textfield', p => p.id === 'fr-link-url')[0].props.onChange({});
      findAll(r.root, 'Textfield', p => p.id === 'fr-link-title')[0].props.onChange({});
    });
    expect(findAll(r.root, 'Textfield').map((f: any) => f.props.value)).toEqual(['', '']);
    await act(async () => { findButton(r.root, 'Cancel').props.onClick(); });
    await act(async () => { findButton(r.root, 'Record Code exception').props.onClick(); });
    await act(async () => {
      findAll(r.root, 'Textfield', p => p.id === 'fr-exception-reason')[0].props.onChange({});
      findAll(r.root, 'Textfield', p => p.id === 'fr-exception-notes')[0].props.onChange({});
    });
    bridgeState.invoke.mockResolvedValueOnce({ success: false });
    await act(async () => { findButton(r.root, 'Save exception').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('The exception was not recorded.');
    bridgeState.invoke.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { findButton(r.root, 'Save exception').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('offline');
  });

  it('reports a link failure that has no message', async () => {
    const r = await mount(row('DEMO-12', { intent: M_INTENT, process: NA, code: NA, audit: NA }));
    await act(async () => { findButton(r.root, 'Link decision record').props.onClick(); });
    bridgeState.invoke.mockRejectedValueOnce({});
    await act(async () => { findButton(r.root, 'Add link').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('The link was not added.');
  });

  it('offers no Code exception when a pull request exists (FR-10)', async () => {
    const r = await mount(row('DEMO-13', { intent: F, process: NA, code: { state: 'MISSING', reason: 'PR_OPEN_AT_DONE' }, audit: NA }));
    expect(() => findButton(r.root, 'Record Code exception')).toThrow('No button');
  });
});
