/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * Tests for shared admin policy view model and component in @asymm/jira-ui
 */

import * as React from 'react';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer');
import { findAll, textOf } from '../frontend/forge-mocks';

jest.mock('@forge/react', () => require('../frontend/forge-mocks').reactMock());

import {
  addGroup,
  buildAdminPolicyView,
  formatPolicySummary,
  GroupChoice,
  removeGroup,
  savedGroups,
  AdminPolicyPanel
} from '@asymm/jira-ui';

describe('Admin policy view model (@asymm/jira-ui)', () => {
  it('extracts saved groups from policy response', () => {
    const res = {
      ok: true,
      policy: {
        parties: [
          { partyId: 'g-1', name: 'dev-leads' },
          { partyId: 'g-2', name: 'architects' }
        ]
      }
    };
    expect(savedGroups(res)).toEqual([
      { groupId: 'g-1', name: 'dev-leads' },
      { groupId: 'g-2', name: 'architects' }
    ]);
    expect(savedGroups(null)).toEqual([]);
    expect(savedGroups({ policy: {} })).toEqual([]);
  });

  it('adds and removes groups immutably without duplicates', () => {
    const initial: GroupChoice[] = [{ groupId: 'g-1', name: 'dev-leads' }];
    const next = addGroup(initial, { groupId: 'g-2', name: 'architects' });
    expect(next.length).toBe(2);

    const dup = addGroup(next, { groupId: 'g-1', name: 'dev-leads' });
    expect(dup.length).toBe(2);

    const removed = removeGroup(next, 'g-1');
    expect(removed).toEqual([{ groupId: 'g-2', name: 'architects' }]);
  });

  it('formats policy summary for 0, 1, and multiple groups', () => {
    expect(formatPolicySummary('FourRealities', [])).toBe(
      'FourRealities: only Jira administrators and project administrators can perform authorized actions.'
    );
    expect(formatPolicySummary('FourRealities', ['dev-leads'])).toBe(
      'FourRealities: Jira administrators, project administrators, and members of dev-leads can perform authorized actions.'
    );
    expect(formatPolicySummary('FourRealities', ['architects', 'dev-leads', 'release-managers'])).toBe(
      'FourRealities: Jira administrators, project administrators, and members of architects, dev-leads and release-managers can perform authorized actions.'
    );
  });

  it('builds state LOADING, ERROR, NOT_ADMIN, and READY', () => {
    const loadingView = buildAdminPolicyView({
      loading: true,
      response: null,
      chosen: [],
      results: [],
      appName: 'LedgerSeal'
    });
    expect(loadingView.state).toBe('LOADING');
    expect(loadingView.message).toContain('Loading LedgerSeal');

    const errorView = buildAdminPolicyView({
      loading: false,
      response: null,
      chosen: [],
      results: [],
      appName: 'LedgerSeal'
    });
    expect(errorView.state).toBe('ERROR');

    const notAdminView = buildAdminPolicyView({
      loading: false,
      response: { ok: false, code: 'NOT_ADMIN', message: 'You must be a Jira admin.' },
      chosen: [],
      results: [],
      appName: 'LedgerSeal'
    });
    expect(notAdminView.state).toBe('NOT_ADMIN');
    expect(notAdminView.message).toBe('You must be a Jira admin.');

    const readyView = buildAdminPolicyView({
      loading: false,
      response: {
        ok: true,
        policy: { parties: [{ partyId: 'g-1', name: 'qa-leads' }] }
      },
      chosen: [{ groupId: 'g-1', name: 'qa-leads' }, { groupId: 'g-2', name: 'dev-leads' }],
      results: [{ groupId: 'g-1', name: 'qa-leads' }, { groupId: 'g-3', name: 'security' }],
      appName: 'LedgerSeal'
    });
    expect(readyView.state).toBe('READY');
    expect(readyView.canSave).toBe(true);
    expect(readyView.results).toEqual([{ groupId: 'g-3', name: 'security' }]);
  });

  it('renders AdminPolicyPanel in ready state', () => {
    let saved = false;
    let removedId: string | null = null;
    let addedGroup: GroupChoice | null = null;
    let queryChanged: string | null = null;
    let searched = false;

    const view = buildAdminPolicyView({
      loading: false,
      response: { ok: true, policy: { parties: [] } },
      chosen: [{ groupId: 'g-1', name: 'qa-leads' }],
      results: [{ groupId: 'g-2', name: 'security' }],
      appName: 'DefinitionGuard'
    });

    const rendered = TestRenderer.create(
      <AdminPolicyPanel
        appName="DefinitionGuard"
        roleTitle="Approver groups"
        roleDescription="approve baseline modifications"
        view={view}
        saving={false}
        notice="Policy saved successfully."
        onSearchChange={(q: string) => { queryChanged = q; }}
        onSearch={() => { searched = true; }}
        onAddGroup={(g: GroupChoice) => { addedGroup = g; }}
        onRemoveGroup={(id: string) => { removedId = id; }}
        onSave={() => { saved = true; }}
      />
    );

    expect(findAll(rendered.root, 'Heading')).toHaveLength(2);
    expect(textOf(rendered.toJSON())).toContain('DefinitionGuard');
    expect(textOf(rendered.toJSON())).toContain('Policy saved successfully.');
  });
});
