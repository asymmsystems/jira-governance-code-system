/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: status sync picks the Jira transition by category or, failing that, by name.
 */

import { syncTaskToJira } from '../src/index';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({ requestJira: mockRequestJira }),
    asUser: () => ({ requestJira: mockRequestJira })
  },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

function withTransitions(transitions: any[]) {
  mockRequestJira.mockReset();
  mockRequestJira.mockImplementation(async (url: string, options?: any) => {
    if (String(url).endsWith('/transitions') && !options) return { status: 200, json: async () => ({ transitions }) };
    return { status: 204, json: async () => ({}) };
  });
}

function postedTransitionId(): string | undefined {
  const call = mockRequestJira.mock.calls.find(c => String(c[0]).endsWith('/transitions') && c[1]?.method === 'POST');
  return call ? JSON.parse(call[1].body).transition.id : undefined;
}

describe('syncTaskToJira status transitions', () => {
  it.each([
    ['IN_PROGRESS', [{ id: '1', name: 'Start progress', to: {} }], '1'],
    ['NOT_STARTED', [{ id: '2', name: 'Back', to: { statusCategory: { key: 'undefined' } } }], '2'],
    ['NOT_STARTED', [{ id: '3', name: 'Move to To Do', to: {} }], '3'],
    ['NOT_STARTED', [{ id: '4', name: 'Open', to: {} }], '4'],
    ['NOT_STARTED', [{ id: '5', name: 'Reopen issue', to: {} }], '5'],
    ['COMPLETED', [{ id: '6', name: 'Resolve', to: {} }], '6'],
    ['COMPLETED', [{ id: '7', name: 'Close', to: {} }], '7']
  ])('maps %s by name or category to the right transition', async (status, transitions, expected) => {
    withTransitions(transitions);
    await syncTaskToJira('TEST-1', { status: status as any });
    expect(postedTransitionId()).toBe(expected);
  });

  it('sends no transition when none matches, including a transition with no name', async () => {
    withTransitions([{ id: '9', to: {} }]);
    await syncTaskToJira('TEST-1', { status: 'IN_PROGRESS' });
    expect(postedTransitionId()).toBeUndefined();
  });
});
