/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the admin page section "Evidence reports" (HLD 8.2, owner decisions Q2 and Q3).
 */

import * as React from 'react';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
import { bridgeState, findAll, findButton, settle, textOf } from './forge-mocks';

jest.mock('@forge/react', () => require('./forge-mocks').reactMock());
jest.mock('@forge/bridge', () => require('./forge-mocks').bridgeMock());

import { ReportSettingsSection } from '../../src/frontend/report-settings';
import { AdminPolicyPanel } from '@asymm/jira-ui';
import { CardHeader, FormField } from '../../src/brand/layout';

const VIEW = { ok: true, retentionDays: 400, allowedRetentionDays: [90, 180, 400, 730, 1095, 1825, 2555], policy: { parties: [{ partyId: 'g1', name: 'auditors' }] }, signingKeyId: 'fr-dev-2026-11' };

function answer(map: Record<string, unknown>) {
  bridgeState.invoke.mockImplementation(async (name: string) => {
    const v = map[name];
    if (v instanceof Error) throw v;
    return v;
  });
}
async function mount(): Promise<any> {
  let r: any;
  await act(async () => { r = TestRenderer.create(<ReportSettingsSection />); });
  await settle(act);
  return r;
}

beforeEach(() => bridgeState.invoke.mockReset());

describe('ReportSettingsSection', () => {
  it('shows the retention, the signing key, the boundary text and the saved groups', async () => {
    answer({ 'fr-admin-reports-get': VIEW });
    const r = await mount();
    const text = textOf(r.toJSON());
    expect(text).toContain('Signed with fr-dev-2026-11.');
    expect(r.root.findAllByType(CardHeader)[0].props.subtitle).toBe("Reports are FourRealities records. Jira's own history and audit log keep their own retention.");
    expect(findAll(r.root, 'Select')[0].props.value).toEqual({ label: '400 days', value: '400' });
    expect(r.root.findAllByType(AdminPolicyPanel)[0].props.view.chosen).toEqual([{ groupId: 'g1', name: 'auditors' }]);
  });

  it('warns before a shorter retention, and saves the retention and the groups', async () => {
    answer({ 'fr-admin-reports-get': VIEW, 'fr-admin-reports-save': { ...VIEW, retentionDays: 90 } });
    const r = await mount();
    await act(async () => { findAll(r.root, 'Select')[0].props.onChange({ value: '90' }); });
    expect(r.root.findAllByType(FormField)[0].props.helper).toContain('A shorter retention applies to existing reports from the next daily run');
    await act(async () => { findButton(r.root, 'Save retention').props.onClick(); });
    expect(bridgeState.invoke).toHaveBeenLastCalledWith('fr-admin-reports-save', { retentionDays: 90, reportGroupIds: ['g1'] });
    expect(r.root.findAllByType(AdminPolicyPanel)[0].props.notice).toBe('Saved.');
    await act(async () => { findAll(r.root, 'Select')[0].props.onChange(null); });
  });

  it('searches, adds, removes and saves groups, and reports failures', async () => {
    answer({ 'fr-admin-reports-get': VIEW, 'fr-admin-search-groups': { ok: true, groups: [{ groupId: 'g2', name: 'release' }] }, 'fr-admin-reports-save': { ok: false, code: 'INVALID_INPUT', message: 'Choose at most 20 groups.' } });
    const r = await mount();
    const panel = () => r.root.findAllByType(AdminPolicyPanel)[0].props;
    await act(async () => { panel().onSearchChange('rel'); });
    await act(async () => { await panel().onSearch(); });
    expect(bridgeState.invoke).toHaveBeenLastCalledWith('fr-admin-search-groups', { query: 'rel' });
    await act(async () => { panel().onAddGroup({ groupId: 'g2', name: 'release' }); panel().onAddGroup({ groupId: 'g2', name: 'release' }); });
    await act(async () => { panel().onRemoveGroup('g1'); });
    await act(async () => { await panel().onSave(); });
    expect(bridgeState.invoke).toHaveBeenLastCalledWith('fr-admin-reports-save', { retentionDays: 400, reportGroupIds: ['g2'] });
    expect(panel().notice).toBe('Choose at most 20 groups.');
    answer({ 'fr-admin-reports-get': VIEW, 'fr-admin-search-groups': { ok: false, code: 'JIRA_ERROR', message: 'No search.' }, 'fr-admin-reports-save': new Error('x') });
    await act(async () => { await panel().onSearch(); });
    expect(panel().notice).toBe('No search.');
    await act(async () => { await panel().onSave(); });
    expect(panel().notice).toBe('FourRealities could not save. Nothing was saved. Try again.');
    answer({ 'fr-admin-search-groups': new Error('x') });
    await act(async () => { await panel().onSearch(); });
    expect(panel().notice).toBe('FourRealities could not search groups in Jira. Try again.');
  });

  it('shows the server message, or a fallback, when the settings cannot be loaded', async () => {
    answer({ 'fr-admin-reports-get': { ok: false, code: 'NOT_ADMIN', message: 'Not an administrator.' } });
    expect(textOf((await mount()).toJSON())).toContain('Not an administrator.');
    answer({ 'fr-admin-reports-get': new Error('x') });
    expect(textOf((await mount()).toJSON())).toContain('FourRealities could not load the report settings. Try again.');
    answer({ 'fr-admin-reports-get': undefined });
    expect(textOf((await mount()).toJSON())).toContain('could not load the report settings');
  });
});
