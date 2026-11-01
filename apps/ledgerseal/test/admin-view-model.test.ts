/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * The admin page view model: pure logic for choosing approver groups.
 *
 * @author Fahim Farook
 */

import { addGroup, buildAdminView, removeGroup } from '../src/frontend/admin-view-model';

const QA = { groupId: 'g-qa', name: 'qa-approvers' };
const OPS = { groupId: 'g-ops', name: 'ops' };
const policy = (groups: { groupId: string; name: string }[]) => ({
  roleTypeId: 'LS_APPROVER',
  parties: groups.map(g => ({ partyId: g.groupId, partyTypeId: 'GROUP', name: g.name })),
  fromDate: '2026-11-01T09:00:00.000Z',
  setByPartyId: 'root'
});

describe('admin view model', () => {
  it('LOADING, ERROR and NOT_ADMIN states', () => {
    expect(buildAdminView({ loading: true, response: null, chosen: [], results: [] })).toMatchObject({ state: 'LOADING', canSave: false });
    expect(buildAdminView({ loading: false, response: null, chosen: [], results: [] })).toMatchObject({
      state: 'ERROR',
      message: 'LedgerSeal could not load the approver groups. Try again.'
    });
    expect(buildAdminView({ loading: false, response: { ok: false, code: 'NOT_ADMIN', message: 'Only a Jira admin can change who can seal.' }, chosen: [], results: [] })).toMatchObject({
      state: 'NOT_ADMIN',
      message: 'Only a Jira admin can change who can seal.'
    });
    expect(buildAdminView({ loading: false, response: { ok: false, code: 'JIRA_UNREACHABLE', message: 'Try again.' }, chosen: [], results: [] })).toMatchObject({
      state: 'ERROR',
      message: 'Try again.'
    });
  });

  it('READY: the saved groups, search results without the chosen ones, and save only after a change', () => {
    const response = { ok: true, policy: policy([QA]) };
    const same = buildAdminView({ loading: false, response, chosen: [QA], results: [QA, OPS] });
    expect(same).toMatchObject({ state: 'READY', chosen: [QA], results: [OPS], canSave: false });
    expect(same.message).toBe('Who can seal: project admins, Jira admins and members of qa-approvers.');

    const changed = buildAdminView({ loading: false, response, chosen: [QA, OPS], results: [] });
    expect(changed.canSave).toBe(true);
    expect(buildAdminView({ loading: false, response: { ok: true, policy: null }, chosen: [], results: [] })).toMatchObject({
      canSave: false,
      message: 'Who can seal: project admins and Jira admins.'
    });
  });

  it('adds a group once and removes it by id', () => {
    expect(addGroup([QA], QA)).toEqual([QA]);
    expect(addGroup([QA], OPS)).toEqual([QA, OPS]);
    expect(removeGroup([QA, OPS], 'g-qa')).toEqual([OPS]);
  });
});
