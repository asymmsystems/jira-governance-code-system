/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the admin page "FourRealities gate authority" (ADR-013).
 */

import * as React from 'react';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
import { bridgeState, findAll, findButton, settle, textOf } from './forge-mocks';
import { DEFAULT_SOURCE_SETTINGS } from '../../src/contract/data/models';

jest.mock('@forge/react', () => require('./forge-mocks').reactMock());
jest.mock('@forge/bridge', () => require('./forge-mocks').bridgeMock());
// The evidence report section has its own resolvers and tests (test/frontend/report-settings.test.tsx).
jest.mock('../../src/frontend/report-settings', () => ({ ReportSettingsSection: () => null }));

import { FourRealitiesAdmin } from '../../src/frontend/admin';

const VIEW = {
  ok: true,
  settings: DEFAULT_SOURCE_SETTINGS,
  detected: { ledgerseal: { seenAt: '2026-11-05T00:00:00Z' } },
  sources: { intent: true, process: null, code: false, audit: false, decisionIssueTypes: DEFAULT_SOURCE_SETTINGS.decisionIssueTypes, detected: { process: false, code: false, audit: false } },
  policy: { parties: [{ partyId: 'g1', name: 'release-managers' }] },
  defaultDecisionIssueTypes: DEFAULT_SOURCE_SETTINGS.decisionIssueTypes
};

async function mount(): Promise<any> {
  let r: any;
  await act(async () => { r = TestRenderer.create(<FourRealitiesAdmin />); });
  await settle(act);
  return r;
}

describe('FourRealitiesAdmin', () => {
  beforeEach(() => bridgeState.invoke.mockReset());

  it('shows the standard note to a user who is not a Jira administrator', async () => {
    bridgeState.invoke.mockResolvedValue({ ok: false, code: 'NOT_ADMIN', message: 'FourRealities: you do not have permission to view or manage authorization settings. Contact your Jira site administrator.' });
    const r = await mount();
    expect(findAll(r.root, 'SectionMessage')[0].props.appearance).toBe('information');
    expect(textOf(r.toJSON())).toContain('you do not have permission to view or manage authorization settings');
  });

  it('shows a warning when the settings cannot be loaded', async () => {
    bridgeState.invoke.mockRejectedValue(new Error('down'));
    const r = await mount();
    expect(findAll(r.root, 'SectionMessage')[0].props.appearance).toBe('warning');
    expect(textOf(r.toJSON())).toContain('FourRealities could not load its settings. Try again.');
  });

  it('shows each source with what was seen and whether it is in use, and saves the choices', async () => {
    bridgeState.invoke.mockResolvedValueOnce(VIEW);
    const r = await mount();
    const text = textOf(r.toJSON());
    expect(text).toContain('FourRealities gate authority');
    expect(text).toContain('Now: Audit: not used on this site.');
    expect(findAll(r.root, 'FormField').length + findAll(r.root, 'Select').length).toBeGreaterThan(0);
    const audit = findAll(r.root, 'Select', p => p.id === 'fr-source-audit')[0];
    await act(async () => { audit.props.onChange({ label: 'LedgerSeal', value: 'ledgerseal' }); });
    await act(async () => { findAll(r.root, 'Select', p => p.id === 'fr-source-process')[0].props.onChange(null); });
    for (const id of ['fr-source-intent', 'fr-source-code']) {
      await act(async () => { findAll(r.root, 'Select', p => p.id === id)[0].props.onChange({ value: 'off' }); });
    }
    await act(async () => { findAll(r.root, 'Textfield', p => p.id === 'fr-decision-types')[0].props.onChange({ target: { value: 'ADR, RFC' } }); });
    bridgeState.invoke.mockResolvedValueOnce({ ...VIEW, settings: { ...VIEW.settings, audit: 'ledgerseal' } });
    await act(async () => { findButton(r.root, 'Save evidence sources').props.onClick(); });
    expect(bridgeState.invoke).toHaveBeenLastCalledWith('fr-admin-save-sources', expect.objectContaining({ audit: 'ledgerseal', process: 'auto', intent: 'off', code: 'off', decisionIssueTypes: ['ADR', 'RFC'] }));
    expect(textOf(r.toJSON())).toContain('Saved. Dashboards build their snapshot again on the next view.');

    bridgeState.invoke.mockResolvedValueOnce({ ok: false, code: 'INVALID_INPUT', message: 'Name at least one decision issue type.' });
    await act(async () => { findButton(r.root, 'Save evidence sources').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('Name at least one decision issue type.');
    bridgeState.invoke.mockRejectedValueOnce(new Error('down'));
    await act(async () => { findButton(r.root, 'Save evidence sources').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('FourRealities could not save. Nothing was saved. Try again.');
    bridgeState.invoke.mockResolvedValueOnce(null);
    await act(async () => { findButton(r.root, 'Save evidence sources').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('FourRealities could not save. Nothing was saved.');
  });

  it('searches, adds, removes and saves approver groups through the shared panel', async () => {
    bridgeState.invoke.mockResolvedValueOnce(VIEW);
    const r = await mount();
    // The shared panel's callbacks, read again after each render so they see the latest state.
    const panelProps = () => r.root.findAll((n: any) => n.props && n.props.onSearch && n.props.onSave)[0].props;
    await act(async () => { panelProps().onSearchChange('arch'); });
    const props = new Proxy({}, { get: (_t, k: string) => panelProps()[k] }) as any;
    bridgeState.invoke.mockResolvedValueOnce({ ok: true, groups: [{ groupId: 'g2', name: 'architecture-board' }] });
    await act(async () => { await props.onSearch(); });
    expect(bridgeState.invoke).toHaveBeenLastCalledWith('fr-admin-search-groups', { query: 'arch' });
    bridgeState.invoke.mockResolvedValueOnce({ ok: false, code: 'JIRA_ERROR', message: 'FourRealities could not search groups in Jira. Try again.' });
    await act(async () => { await props.onSearch(); });
    bridgeState.invoke.mockRejectedValueOnce(new Error('down'));
    await act(async () => { await props.onSearch(); });
    await act(async () => { props.onAddGroup({ groupId: 'g2', name: 'architecture-board' }); });
    await act(async () => { props.onAddGroup({ groupId: 'g2', name: 'architecture-board' }); });
    await act(async () => { props.onRemoveGroup('g1'); });
    bridgeState.invoke.mockResolvedValueOnce({ ...VIEW, policy: { parties: [{ partyId: 'g2', name: 'architecture-board' }] } });
    await act(async () => { await r.root.findAll((n: any) => n.props && n.props.onSave)[0].props.onSave(); });
    expect(bridgeState.invoke).toHaveBeenLastCalledWith('fr-admin-save-approvers', { groupIds: ['g2'] });
    bridgeState.invoke.mockResolvedValueOnce({ ok: false, code: 'INVALID_INPUT', message: 'Choose at most 20 groups.' });
    await act(async () => { await r.root.findAll((n: any) => n.props && n.props.onSave)[0].props.onSave(); });
    expect(textOf(r.toJSON())).toContain('Choose at most 20 groups.');
    bridgeState.invoke.mockRejectedValueOnce(new Error('down'));
    await act(async () => { await r.root.findAll((n: any) => n.props && n.props.onSave)[0].props.onSave(); });
    expect(textOf(r.toJSON())).toContain('FourRealities could not save. Nothing was saved. Try again.');
  });
});
