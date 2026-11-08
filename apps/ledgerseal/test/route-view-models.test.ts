/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * ADR-017: what the panel and the "Approval routes" admin tab show for a route.
 *
 * @author Fahim Farook
 */

import { buildRouteView } from '../src/frontend/route-view-model';
import { buildRouteRows, parseRouteText, ROUTE_EXAMPLE, routeText } from '../src/frontend/route-admin-view-model';
import { buildPanelView, ROUTE_ASK } from '../src/frontend/view-model';

const ROUTE = {
  name: 'QA then Regulatory',
  routeHash: 'h',
  runState: 'OPEN',
  open: true,
  stages: [
    { stageId: 'qa', name: 'QA', orderGroup: 1, meaning: 'REVIEW', quorum: 1, signed: [{ accountId: 'a', seq: 1 }], open: false, canSign: false, canReject: false },
    { stageId: 'reg', name: 'Regulatory', orderGroup: 2, meaning: 'APPROVAL', quorum: 2, signed: [], open: true, canSign: true, canReject: true }
  ],
  rejection: null
};

describe('panel route section', () => {
  it('shows the stages, their progress, who signed, and what the viewer may do', () => {
    const view = buildRouteView(ROUTE)!;
    expect(view.title).toBe('Approval route: QA then Regulatory');
    expect(view.stateText).toBe('In approval: 1 of 2 stages complete.');
    expect(view.stages.map(s => [s.name, s.meaningLabel, s.progress, s.signedAccountIds, s.canSign, s.canReject, s.done])).toEqual([
      ['QA', 'Reviewed', '1 of 1 signed', ['a'], false, false, true],
      ['Regulatory', 'Approved', '0 of 2 signed', [], true, true, false]
    ]);
    expect(buildRouteView(null)).toBeNull();
  });

  it('names each run state and a rejection', () => {
    expect(buildRouteView({ ...ROUTE, open: false, runState: 'COMPLETE' })!.stateText).toBe('Approved through every stage.');
    expect(buildRouteView({ ...ROUTE, open: false, runState: 'VOIDED' })!.stateText).toMatch(/changed during approval/);
    expect(buildRouteView({ ...ROUTE, open: false, runState: null })!.stateText).toMatch(/Not started/);
    const rejected = buildRouteView({ ...ROUTE, open: false, runState: 'REJECTED', rejection: { at: '2026-11-08T10:00:00.000Z', reason: 'No tests', stageId: 'reg' } })!;
    expect(rejected.stateText).toMatch(/^Rejected/);
    expect(rejected.rejectionText).toMatch(/^Regulatory rejected on .*\. Reason: No tests$/);
    expect(buildRouteView({ ...ROUTE, rejection: { at: null, reason: 'x', stageId: 'gone' } })!.rejectionText).toMatch(/^A stage rejected/);
    expect(buildRouteView({ invalid: true })).toMatchObject({ invalid: true, stages: [] });
    expect(buildRouteView({ ...ROUTE, stages: [{ stageId: 's', name: 'S', meaning: 'OTHER', quorum: 1 }] })!.stages[0]).toMatchObject({ meaningLabel: 'OTHER', progress: '0 of 1 signed' });
  });

  it('hides the plain seal and approval on a routed issue and says why', () => {
    const rights = { canSeal: true, canApproveChanges: true, canRevoke: true, blockedBySelfChange: false };
    const unsealed = { status: 'NO_SEAL', tamperedFields: [], tamperedAttachments: [], rights, route: ROUTE };
    const view = buildPanelView({ loading: false, error: false, result: unsealed });
    expect(view.actions.seal).toBeUndefined();
    expect(view.askText).toBe(ROUTE_ASK);
    const plain = buildPanelView({ loading: false, error: false, result: { ...unsealed, route: null } });
    expect(plain.actions.seal).toBeDefined();
    const invalid = buildPanelView({ loading: false, error: false, result: { ...unsealed, route: { invalid: true } } });
    expect(invalid.actions.seal).toBeDefined();
  });
});

describe('admin routes tab', () => {
  it('parses the route text, and refuses text that is not a JSON object', () => {
    const ok = parseRouteText(ROUTE_EXAMPLE, 'rte_1');
    expect(ok).toMatchObject({ ok: true, payload: { routeId: 'rte_1', name: 'QA then Regulatory', reapprovalStageIds: null } });
    expect(parseRouteText(ROUTE_EXAMPLE, null)).toMatchObject({ ok: true, payload: expect.not.objectContaining({ routeId: expect.anything() }) });
    expect(parseRouteText('{', null)).toEqual({ ok: false, message: expect.stringMatching(/not valid JSON/) });
    expect(parseRouteText('[1]', null)).toEqual({ ok: false, message: expect.stringMatching(/JSON object/) });
  });

  it('turns a stored route into editable text with group ids, and lists routes with their bindings', () => {
    const stored = {
      routeId: 'rte_1',
      version: 3,
      name: 'R',
      stages: [
        { stageId: 'b', name: 'B', orderGroup: 2, roleTypeId: 'LS_APPROVER', approverGroups: [{ id: 'g2', name: 'two' }], quorum: { kind: 'N', n: 2 }, gatesStatusIds: ['1'] },
        { stageId: 'a', name: 'A', orderGroup: 1, roleTypeId: 'LS_REVIEWER', approverGroups: [{ id: 'g1', name: 'one' }], quorum: { kind: 'ANY' }, gatesStatusIds: [] }
      ],
      reapprovalStageIds: ['b']
    };
    expect(JSON.parse(routeText(stored)).stages[0]).toMatchObject({ stageId: 'b', approverGroupIds: ['g2'] });
    expect(JSON.parse(routeText({ name: 'x' }))).toEqual({ name: 'x', stages: [], reapprovalStageIds: null });
    const rows = buildRouteRows({ routes: [stored], bindings: [{ routeId: 'rte_1', projectId: '100', issueTypeId: '*' }, { routeId: 'rte_1', projectId: '200', issueTypeId: '3' }] });
    expect(rows).toEqual([{ routeId: 'rte_1', title: 'R (version 3)', stagesText: '1. A (any one of one); 2. B (2 of two)', bindings: ['project 100, every issue type', 'project 200, issue type 3'] }]);
    expect(buildRouteRows(null)).toEqual([]);
    expect(buildRouteRows({ routes: [{ routeId: 'x', name: 'N', version: 1 }] })[0]).toMatchObject({ stagesText: '', bindings: [] });
  });
});
