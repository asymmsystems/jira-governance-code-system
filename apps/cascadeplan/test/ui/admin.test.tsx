/**
 * Tests for CascadePlan Admin Policy View Model using @asymm/jira-ui.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */

jest.mock('@forge/bridge', () => ({
  __esModule: true,
  invoke: jest.fn()
}));

jest.mock('@forge/react', () => ({
  __esModule: true,
  default: { render: jest.fn() },
  Text: ({ children }: any) => children,
  Stack: ({ children }: any) => children,
  Inline: ({ children }: any) => children,
  Button: ({ children }: any) => children,
  Heading: ({ children }: any) => children,
  SectionMessage: ({ children }: any) => children,
  Spinner: () => null,
  Textfield: () => null,
  Label: ({ children }: any) => children,
  Box: ({ children }: any) => children,
  Badge: ({ children }: any) => children,
  Lozenge: ({ children }: any) => children,
  User: () => null,
  xcss: () => ({})
}));

import {
  buildAdminPolicyView,
  formatPolicySummary,
  savedGroups,
  addGroup,
  removeGroup,
  GroupChoice
} from '@asymm/jira-ui';


describe('CascadePlan Admin UI View Model (@asymm/jira-ui)', () => {
  const appName = 'CascadePlan';
  const roleDescription = 'freeze delivery baseline, approve milestone variance, and manage plans';

  it('builds LOADING state correctly', () => {
    const view = buildAdminPolicyView({
      loading: true,
      response: null,
      chosen: [],
      results: [],
      appName,
      roleDescription
    });

    expect(view.state).toBe('LOADING');
    expect(view.message).toContain('Loading CascadePlan authorization settings');
    expect(view.canSave).toBe(false);
  });

  it('builds ERROR state when response is null and loading is false', () => {
    const view = buildAdminPolicyView({
      loading: false,
      response: null,
      chosen: [],
      results: [],
      appName,
      roleDescription
    });

    expect(view.state).toBe('ERROR');
    expect(view.message).toContain('CascadePlan could not load the authority policy');
    expect(view.canSave).toBe(false);
  });

  it('builds NOT_ADMIN state when resolver returns code NOT_ADMIN', () => {
    const view = buildAdminPolicyView({
      loading: false,
      response: {
        ok: false,
        code: 'NOT_ADMIN',
        message: 'CascadePlan: you do not have permission to view or manage authorization settings.'
      },
      chosen: [],
      results: [],
      appName,
      roleDescription
    });

    expect(view.state).toBe('NOT_ADMIN');
    expect(view.message).toContain('you do not have permission');
    expect(view.canSave).toBe(false);
  });

  it('builds READY state with no designated groups', () => {
    const response = {
      ok: true,
      policy: { parties: [] }
    };
    const view = buildAdminPolicyView({
      loading: false,
      response,
      chosen: [],
      results: [],
      appName,
      roleDescription
    });

    expect(view.state).toBe('READY');
    expect(view.message).toContain('only Jira administrators and project administrators can');
    expect(view.canSave).toBe(false);
  });

  it('builds READY state with 1 group', () => {
    const response = {
      ok: true,
      policy: { parties: [{ partyId: 'g1', name: 'delivery-leads' }] }
    };
    const chosen: GroupChoice[] = [{ groupId: 'g1', name: 'delivery-leads' }];
    const view = buildAdminPolicyView({
      loading: false,
      response,
      chosen,
      results: [],
      appName,
      roleDescription
    });

    expect(view.state).toBe('READY');
    expect(view.message).toContain('and members of delivery-leads can');
    expect(view.canSave).toBe(false);
  });

  it('builds READY state with multiple groups and formats correctly', () => {
    const response = {
      ok: true,
      policy: {
        parties: [
          { partyId: 'g1', name: 'delivery-leads' },
          { partyId: 'g2', name: 'pmo-directors' }
        ]
      }
    };
    const chosen: GroupChoice[] = [
      { groupId: 'g1', name: 'delivery-leads' },
      { groupId: 'g2', name: 'pmo-directors' }
    ];
    const view = buildAdminPolicyView({
      loading: false,
      response,
      chosen,
      results: [],
      appName,
      roleDescription
    });

    expect(view.state).toBe('READY');
    expect(view.message).toContain('delivery-leads and pmo-directors can');
    expect(view.canSave).toBe(false);
  });

  it('detects canSave when chosen groups differ from saved groups', () => {
    const response = {
      ok: true,
      policy: {
        parties: [{ partyId: 'g1', name: 'delivery-leads' }]
      }
    };
    const chosen: GroupChoice[] = [
      { groupId: 'g1', name: 'delivery-leads' },
      { groupId: 'g2', name: 'new-group' }
    ];
    const view = buildAdminPolicyView({
      loading: false,
      response,
      chosen,
      results: [],
      appName,
      roleDescription
    });

    expect(view.state).toBe('READY');
    expect(view.canSave).toBe(true);
  });

  it('extracts saved groups correctly from response', () => {
    const response = {
      policy: {
        parties: [
          { partyId: 'g1', name: 'Alpha' },
          { partyId: 'g2', name: 'Beta' }
        ]
      }
    };
    expect(savedGroups(response)).toEqual([
      { groupId: 'g1', name: 'Alpha' },
      { groupId: 'g2', name: 'Beta' }
    ]);
    expect(savedGroups(null)).toEqual([]);
  });

  it('adds and removes groups immutably', () => {
    const initial: GroupChoice[] = [{ groupId: 'g1', name: 'Alpha' }];
    const newGroup: GroupChoice = { groupId: 'g2', name: 'Beta' };

    const withAdded = addGroup(initial, newGroup);
    expect(withAdded).toHaveLength(2);

    // Duplicate add does not add again
    const withDuplicate = addGroup(withAdded, newGroup);
    expect(withDuplicate).toHaveLength(2);

    const withRemoved = removeGroup(withAdded, 'g1');
    expect(withRemoved).toEqual([newGroup]);
  });

  it('formatPolicySummary handles empty, single, and multiple group arrays', () => {
    expect(formatPolicySummary(appName, [])).toContain('only Jira administrators and project administrators');
    expect(formatPolicySummary(appName, ['team-a'])).toContain('and members of team-a can');
    expect(formatPolicySummary(appName, ['team-a', 'team-b', 'team-c'])).toContain('team-a, team-b and team-c can');
  });
});
