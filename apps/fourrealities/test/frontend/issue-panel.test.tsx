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
import { GateResult } from '../../src/contract/data/models';

jest.mock('@forge/react', () => require('./forge-mocks').reactMock());
jest.mock('@forge/bridge', () => require('./forge-mocks').bridgeMock());

import { IssuePanel } from '../../src/frontend/issue-panel';

async function mount(r: any, onReload = jest.fn(), onRow = jest.fn()) {
  let renderer: any;
  await act(async () => { renderer = TestRenderer.create(<IssuePanel row={r} onReload={onReload} onRow={onRow} />); });
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
    expect(text).toContain('RAI 67% (HIGH): 2 of 3 rated gates have evidence found. 3 of 4 gates apply to this issue.');
  });

  it('B-33, B-36: opens with the pipeline, the drift sentence and the next action', async () => {
    const r = await mount(row('DEMO-5', { intent: M_INTENT, process: F, code: M_CODE, audit: NA }));
    const pipeline = findAll(r.root, 'Inline').find((n: any) => findAll(n, 'Tooltip').length === 4);
    expect(findAll(pipeline, 'Lozenge').map((l: any) => String(l.props.children))).toEqual(['✕ Intent: missing', '● Process: found', '✕ Code: missing', '○ Audit: n/a']);
    expect(findAll(pipeline, 'Text')).toHaveLength(0);
    const text = textOf(r.toJSON());
    expect(text).toContain('No decision record is linked.');
    expect(text).toContain('Next: link the decision record.');
  });

  it('B-37: "Why n%?" shows what each gate adds and what the first fix recovers, and hides again', async () => {
    const r = await mount(row('DEMO-5', { intent: M_INTENT, process: F, code: NA, audit: F }));
    expect(textOf(r.toJSON())).not.toContain('Intent: 0 (evidence missing)');
    await act(async () => { findButton(r.root, 'Why 67%?').props.onClick(); });
    const text = textOf(r.toJSON());
    expect(text).toContain('Intent: 0 (evidence missing)');
    expect(text).toContain('Process: +33 (evidence found)');
    expect(text).toContain('Fix Intent to reach 100%.');
    await act(async () => { findButton(r.root, 'Hide the score parts').props.onClick(); });
    expect(textOf(r.toJSON())).not.toContain('Intent: 0 (evidence missing)');
    const unrated = await mount(row('DEMO-6', { intent: NA, process: NA, code: NA, audit: NA }));
    expect(() => findButton(unrated.root, 'Why')).toThrow('No button');
  });

  it('B-38: the compact view shows the pipeline, alignment and next action, and opens the findings on demand', async () => {
    let r: any;
    await act(async () => { r = TestRenderer.create(<IssuePanel row={row('DEMO-5', { intent: M_INTENT, process: F, code: NA, audit: F })} onReload={jest.fn()} onRow={jest.fn()} compact />); });
    const text = textOf(r.toJSON());
    expect(text).toContain('Alignment 67%');
    expect(text).toContain('Next: link the decision record.');
    expect(findAll(r.root, 'Tooltip')).toHaveLength(4);
    expect(text).not.toContain('Source: Jira issue links and remote links.');
    expect(() => findButton(r.root, 'Link decision record')).toThrow('No button');
    await act(async () => { findButton(r.root, 'See all findings').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('Source: Jira issue links and remote links.');
    findButton(r.root, 'Link decision record');
    await act(async () => { findButton(r.root, 'Hide findings').props.onClick(); });
    expect(textOf(r.toJSON())).not.toContain('Source: Jira issue links and remote links.');
  });

  it('B-21: shows the four gates first and RAI after them, with no RAI in the heading', async () => {
    const r = await mount(row('DEMO-5', { intent: M_INTENT, process: F, code: NA, audit: F }));
    const lozenges = findAll(r.root, 'Lozenge').map((l: any) => String(l.props.children));
    // Pipeline chips, then the four gate rows, then the RAI lozenge last.
    expect(lozenges.slice(4, 8).map(t => t.split(': ')[0].slice(2))).toEqual(['Intent', 'Process', 'Code', 'Audit']);
    expect(lozenges).toHaveLength(9);
    expect(lozenges[8]).toBe('67% (HIGH)');
    expect(r.root.findAll((n: any) => n.type === 'ui-Heading' || n.type === 'ui-Lozenge')[0].type).toBe('ui-Heading');
  });

  it('shows UNRATED when no gate is rated', async () => {
    const r = await mount(row('DEMO-6', { intent: NA, process: NA, code: NA, audit: NA }));
    expect(textOf(r.toJSON())).toContain('UNRATED');
  });

  it('opens the decision link modal with empty fields, and shows the re-evaluated state after a link (B-17)', async () => {
    const onReload = jest.fn();
    const onRow = jest.fn();
    const r = await mount(row('DEMO-7', { intent: M_INTENT, process: NA, code: NA, audit: NA }), onReload, onRow);
    await act(async () => { findButton(r.root, 'Link decision record').props.onClick(); });
    const fields = findAll(r.root, 'Textfield');
    expect(fields.map((f: any) => ['value' in f.props, f.props.defaultValue])).toEqual([[false, undefined], [false, undefined]]);
    expect(findAll(r.root, 'Label').map((l: any) => l.props.labelFor)).toEqual(['fr-link-url', 'fr-link-title']);

    await act(async () => { type(r, 'fr-link-url', 'https://s.atlassian.net/wiki/x'); type(r, 'fr-link-title', 'ADR-7'); });
    const after = row('DEMO-7', { intent: F, process: NA, code: NA, audit: NA });
    bridgeState.invoke.mockResolvedValue({ success: true, row: after });
    await act(async () => { findButton(r.root, 'Add link').props.onClick(); });
    await settle(act);

    expect(bridgeState.invoke).toHaveBeenCalledWith('linkDecision', { issueId: '7', issueKey: 'DEMO-7', url: 'https://s.atlassian.net/wiki/x', title: 'ADR-7' });
    expect(onRow).toHaveBeenCalledWith(after);
    expect(onReload).not.toHaveBeenCalled();
    expect(textOf(r.toJSON())).toContain('Link added. Intent: Evidence found.');
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

    await act(async () => { findButton(r.root, 'Request Code exception').props.onClick(); });
    expect(findAll(r.root, 'ModalTitle').map((t: any) => String(t.props.children))).toEqual(['Request a Code exception for DEMO-9']);
    expect(findAll(r.root, 'Textfield').map((f: any) => f.props.defaultValue)).toEqual([undefined, undefined]);
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
    expect(textOf(r.toJSON())).toContain('Exception requested. The gates could not be read again. Use Refresh.');

    await act(async () => { findButton(r.root, 'Add rework reason').props.onClick(); });
    expect(textOf(r.toJSON())).toContain('This note does not change any gate.');
    bridgeState.invoke.mockResolvedValueOnce({ success: true });
    await act(async () => { findButton(r.root, 'Save reason').props.onClick(); });
    expect(bridgeState.invoke).toHaveBeenLastCalledWith('recordException', expect.objectContaining({ type: 'REWORK' }));
    expect(textOf(r.toJSON())).toContain('Rework reason recorded. It does not change any gate.');
    await act(async () => { findButton(r.root, 'Request Code exception').props.onClick(); });
    await act(async () => { findButton(r.root, 'Cancel').props.onClick(); });
    expect(onReload).not.toHaveBeenCalled();
  });

  it('shows who and why for an approved exception and a rework reason', async () => {
    const n = { reason: 'Configuration change only', recordedBy: 'acc-1', recordedAt: '2026-11-01T09:00:00Z' };
    const state = { status: 'APPROVED' as const, issueKey: 'DEMO-10', requestedBy: 'dev-1', requestedAt: '2026-11-01T09:00:00Z', reason: 'Configuration change only', decidedBy: 'admin-1', decidedAt: '2026-11-02T08:00:00Z' };
    const r = await mount(row('DEMO-10', { intent: F, process: F, code: { state: 'EXCEPTED', reason: 'CODE_EXCEPTED' }, audit: NA },
      { reworkLoops: 1, codeException: state, reworkNotes: [n] }));
    const text = textOf(r.toJSON());
    expect(text).toMatch(/Requested by\s+on 2026-11-01: Configuration change only/);
    expect(text).toMatch(/Approved by\s+on 2026-11-02/);
    expect(text).toContain('Rework loops: 1.');
    expect(text).toMatch(/Rework reason\s+by/);
    expect(text).not.toContain('rework reasons recorded');
    expect(findAll(r.root, 'User').map((u: any) => u.props.accountId)).toEqual(['acc-1', 'dev-1', 'admin-1']);
    expect(text).toContain('Code: Excepted');
    expect(() => findButton(r.root, 'Request Code exception')).toThrow('No button');
    findButton(r.root, 'Revoke exception');
  });

  it('B-32: says how many rework reasons exist and shows the latest', async () => {
    const older = { reason: 'Earlier rework reason', recordedBy: 'acc-2', recordedAt: '2026-10-01T09:00:00Z' };
    const latest = { reason: 'Requirement changed after review', recordedBy: 'acc-1', recordedAt: '2026-11-01T09:00:00Z' };
    const r = await mount(row('DEMO-12', { intent: F, process: F, code: F, audit: NA }, { reworkLoops: 2, reworkNotes: [older, latest] }));
    const text = textOf(r.toJSON());
    expect(text).toContain('2 rework reasons recorded. The latest is shown.');
    expect(text).toContain('Requirement changed after review');
    expect(text).not.toContain('Earlier rework reason');
  });

  it('treats an empty change event as an empty field', async () => {
    const r = await mount(row('DEMO-11', { intent: M_INTENT, process: NA, code: M_CODE, audit: NA }));
    await act(async () => { findButton(r.root, 'Link decision record').props.onClick(); });
    await act(async () => { type(r, 'fr-link-url', 'x'); });
    await act(async () => {
      findAll(r.root, 'Textfield', p => p.id === 'fr-link-url')[0].props.onChange({});
      findAll(r.root, 'Textfield', p => p.id === 'fr-link-title')[0].props.onChange({});
    });
    bridgeState.invoke.mockResolvedValueOnce({ success: false, error: 'Invalid specification URL provided.' });
    await act(async () => { findButton(r.root, 'Add link').props.onClick(); });
    expect(bridgeState.invoke).toHaveBeenLastCalledWith('linkDecision', { issueId: '11', issueKey: 'DEMO-11', url: '', title: '' });
    await act(async () => { findButton(r.root, 'Cancel').props.onClick(); });
    await act(async () => { findButton(r.root, 'Request Code exception').props.onClick(); });
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
    expect(() => findButton(r.root, 'Request Code exception')).toThrow('No button');
  });

  it('says how many RAI points the first missing gate would recover (B-14)', async () => {
    const r = await mount(row('DEMO-14', { intent: M_INTENT, process: F, code: NA, audit: NA }));
    expect(textOf(r.toJSON())).toContain('Adding Intent evidence raises this issue\'s RAI by 50 points.');
    const full = await mount(row('DEMO-15', { intent: F, process: F, code: NA, audit: NA }));
    expect(textOf(full.toJSON())).not.toContain('raises this issue');
  });

  describe('B-30: exception lifecycle in the panel', () => {
    const base = { issueKey: 'DEMO-20', requestedBy: 'dev-1', requestedAt: '2026-11-01T09:00:00Z', reason: 'Configuration change only' };
    const missingCode = { intent: F, process: NA, code: M_CODE, audit: NA };

    it('shows a waiting request with approve, reject and withdraw, and no new request', async () => {
      const r = await mount(row('DEMO-20', missingCode, { codeException: { ...base, status: 'REQUESTED' } }));
      const text = textOf(r.toJSON());
      expect(text).toContain('Code: Evidence missing');
      expect(text).toContain('Waiting for a project or Jira administrator who is not the requester or the assignee.');
      for (const label of ['Approve exception', 'Reject exception', 'Withdraw request']) findButton(r.root, label);
      expect(() => findButton(r.root, 'Request Code exception')).toThrow('No button');
    });

    it('sends each decision with the issue and the reason, and shows a refusal', async () => {
      const onReload = jest.fn();
      const r = await mount(row('DEMO-20', missingCode, { codeException: { ...base, status: 'REQUESTED' } }), onReload);
      await act(async () => { findButton(r.root, 'Approve exception').props.onClick(); });
      expect(textOf(r.toJSON())).toContain('Approve the Code exception for DEMO-20');
      bridgeState.invoke.mockResolvedValueOnce({ success: false, error: 'Only a project administrator or a Jira administrator can approve, reject or revoke an exception.' });
      await act(async () => { findButton(r.root, 'Approve').props.onClick(); });
      expect(textOf(r.toJSON())).toContain('Only a project administrator or a Jira administrator can approve, reject or revoke an exception.');
      bridgeState.invoke.mockRejectedValueOnce({});
      await act(async () => { findButton(r.root, 'Approve').props.onClick(); });
      expect(textOf(r.toJSON())).toContain('The decision was not recorded.');
      bridgeState.invoke.mockResolvedValueOnce({});
      await act(async () => { findButton(r.root, 'Approve').props.onClick(); });
      expect(textOf(r.toJSON())).toContain('The decision was not recorded.');
      await act(async () => { findButton(r.root, 'Cancel').props.onClick(); });

      await act(async () => { findButton(r.root, 'Reject exception').props.onClick(); });
      expect(textOf(r.toJSON())).toContain('Reason (15 to 500 characters)');
      await act(async () => {
        findAll(r.root, 'Textfield', p => p.id === 'fr-decision-reason')[0].props.onChange({ target: { value: 'Code changed in the config repo' } });
      });
      bridgeState.invoke.mockResolvedValueOnce({ success: true });
      await act(async () => { findButton(r.root, 'Reject').props.onClick(); });
      expect(bridgeState.invoke).toHaveBeenLastCalledWith('decideException', { issueId: '20', issueKey: 'DEMO-20', decision: 'REJECT', reason: 'Code changed in the config repo' });
      expect(textOf(r.toJSON())).toContain('Decision recorded. The gates could not be read again. Use Refresh.');
      expect(onReload).not.toHaveBeenCalled();

      await act(async () => { findButton(r.root, 'Withdraw request').props.onClick(); });
      await act(async () => { findAll(r.root, 'Textfield', p => p.id === 'fr-decision-reason')[0].props.onChange({}); });
      bridgeState.invoke.mockResolvedValueOnce({ success: true });
      await act(async () => { findButton(r.root, 'Withdraw').props.onClick(); });
      expect(bridgeState.invoke).toHaveBeenLastCalledWith('decideException', expect.objectContaining({ decision: 'WITHDRAW', reason: '' }));
    });

    it('offers Revoke on an approved exception, and shows a migrated approval', async () => {
      const state = { ...base, status: 'APPROVED' as const, decidedBy: 'dev-1', decidedAt: '2026-10-01T00:00:00Z', migrated: true };
      const r = await mount(row('DEMO-21', { intent: F, process: NA, code: { state: 'EXCEPTED', reason: 'CODE_EXCEPTED' }, audit: NA }, { codeException: state }));
      expect(textOf(r.toJSON())).toContain('Approved before administrator approval was required.');
      await act(async () => { findButton(r.root, 'Revoke exception').props.onClick(); });
      bridgeState.invoke.mockResolvedValueOnce({ success: true });
      await act(async () => { findButton(r.root, 'Revoke').props.onClick(); });
      expect(bridgeState.invoke).toHaveBeenLastCalledWith('decideException', expect.objectContaining({ decision: 'REVOKE' }));
    });

    it('shows how an ended request ended, and allows a new request', async () => {
      for (const [status, label] of [['REJECTED', 'Exception rejected by'], ['WITHDRAWN', 'Exception withdrawn by'], ['REVOKED', 'Exception revoked by']] as const) {
        const state = { ...base, status, decidedBy: 'admin-1', decidedAt: '2026-11-02T00:00:00Z', decisionReason: 'Needs a pull request after all' };
        const r = await mount(row('DEMO-22', missingCode, { codeException: state }));
        const text = textOf(r.toJSON());
        expect(text).toContain(label);
        expect(text).toContain('on 2026-11-02: Needs a pull request after all');
        findButton(r.root, 'Request Code exception');
      }
      const noDecider = await mount(row('DEMO-23', missingCode, { codeException: { ...base, status: 'WITHDRAWN' } }));
      expect(textOf(noDecider.toJSON())).not.toContain('Exception withdrawn by');
    });
  });

  describe('B-42: Request retrospective review', () => {
    it('offers Request retrospective review when Code is FOUND with PR_MERGED', async () => {
      const onRow = jest.fn();
      const codeMerged: GateResult = { state: 'FOUND', verification: 'HEURISTIC', reason: 'PR_MERGED' };
      const r = await mount(row('DEMO-30', { intent: F, process: F, code: codeMerged, audit: NA }), jest.fn(), onRow);
      findButton(r.root, 'Request retrospective review');

      await act(async () => { findButton(r.root, 'Request retrospective review').props.onClick(); });
      expect(findAll(r.root, 'ModalTitle').map((t: any) => String(t.props.children))).toEqual(['Request retrospective review for DEMO-30']);
      expect(findAll(r.root, 'Label').map((l: any) => l.props.labelFor)).toContain('fr-review-comment');

      await act(async () => { type(r, 'fr-review-comment', 'Please conduct a retrospective code review for this change.'); });

      bridgeState.invoke.mockResolvedValueOnce({ success: false, error: 'Review comment required.' });
      await act(async () => { findButton(r.root, 'Request review').props.onClick(); });
      expect(textOf(r.toJSON())).toContain('Review comment required.');

      bridgeState.invoke.mockRejectedValueOnce(new Error('connection reset'));
      await act(async () => { findButton(r.root, 'Request review').props.onClick(); });
      expect(textOf(r.toJSON())).toContain('connection reset');

      bridgeState.invoke.mockResolvedValueOnce({});
      await act(async () => { findButton(r.root, 'Request review').props.onClick(); });
      expect(textOf(r.toJSON())).toContain('The review request was not added.');

      const after = row('DEMO-30', { intent: F, process: F, code: codeMerged, audit: NA });
      bridgeState.invoke.mockResolvedValueOnce({ success: true, row: after });
      await act(async () => { findButton(r.root, 'Request review').props.onClick(); });
      expect(bridgeState.invoke).toHaveBeenLastCalledWith('requestReview', { issueId: '30', issueKey: 'DEMO-30', comment: 'Please conduct a retrospective code review for this change.' });
      expect(onRow).toHaveBeenCalledWith(after);
      expect(textOf(r.toJSON())).toContain('Review requested. It does not change any gate.');
    });

    it('does not offer Request retrospective review when Code is not PR_MERGED', async () => {
      const r = await mount(row('DEMO-31', { intent: F, process: F, code: M_CODE, audit: NA }));
      expect(() => findButton(r.root, 'Request retrospective review')).toThrow('No button');
    });
  });
});

