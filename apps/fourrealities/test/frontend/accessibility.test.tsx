/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: accessibility and narrow-width rules on every rendered view (B-20, FR-23, NF-04)
 */

import * as React from 'react';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
import { bridgeState, findAll, findButton, settle, textOf } from './forge-mocks';
import { F, M_CODE, M_DOD, M_INTENT, M_SEAL, NA, dashboard, row } from './rows';

jest.mock('@forge/react', () => require('./forge-mocks').reactMock());
jest.mock('@forge/bridge', () => require('./forge-mocks').bridgeMock());

import { ProjectDashboard } from '../../src/frontend/project-dashboard';
import { IssuePanel } from '../../src/frontend/issue-panel';
import { FourRealitiesApp } from '../../src/frontend/index';

const CONTROLS = ['Textfield', 'Select', 'TextArea'];
/** Em dash, box-drawing arrows, the black right-pointing triangle and the middle dot (NF-04, FR-23). */
const FORBIDDEN = /[—─-╿▶·]/;

const flat = (children: any): string => (Array.isArray(children) ? children.map(flat).join('') : children === null || children === undefined || typeof children === 'boolean' ? '' : String(children));

function hasAncestor(node: any, predicate: (ancestor: any) => boolean): boolean {
  let cur = node?.parent;
  while (cur) {
    if (predicate(cur)) return true;
    cur = cur.parent;
  }
  return false;
}

const isBorderedBox = (n: any): boolean => n?.type === 'ui-Box' && n.props?.xcss?.props?.borderStyle === 'solid';

/** Every rule, checked on one rendered tree. */
function checkTree(renderer: any, where: string) {
  const root = renderer.root;
  for (const inline of findAll(root, 'Inline')) {
    expect({ where, shouldWrap: inline.props.shouldWrap }).toEqual({ where, shouldWrap: true });
  }
  // UX standard (B-48): Jira Cloud applies margin-top: 12px to non-first <p> elements. Every Text inside
  // Inline or Stack renders as="span" (or inline "strong") so flex gap owns spacing and baselines never shift.
  for (const textNode of findAll(root, 'Text')) {
    if (hasAncestor(textNode, a => a.type === 'ui-Inline' || a.type === 'ui-Stack')) {
      expect({ where, text: flat(textNode.props.children), spanOrStrong: textNode.props.as === 'span' || textNode.props.as === 'strong' })
        .toEqual({ where, text: flat(textNode.props.children), spanOrStrong: true });
    }
  }
  const labels = new Set(findAll(root, 'Label').map((l: any) => l.props.labelFor));
  for (const type of CONTROLS) {
    for (const control of findAll(root, type)) {
      expect({ where, type, id: control.props.id, labelled: labels.has(control.props.id) }).toEqual({ where, type, id: control.props.id, labelled: true });
    }
  }
  // Loop 3 (live): a controlled Textfield drops typed characters across the UI Kit bridge, so
  // every text field is uncontrolled (no value prop); state follows onChange only.
  for (const field of findAll(root, 'Textfield')) {
    expect({ where, id: field.props.id, controlled: 'value' in field.props }).toEqual({ where, id: field.props.id, controlled: false });
  }
  // Loop 3 (live): a Stack stretches its children, which drew each gate lozenge as a full-width bar.
  for (const stack of findAll(root, 'Stack').filter((st: any) => findAll(st, 'Lozenge').some((l: any) => l.parent?.parent === st))) {
    expect({ where, alignInline: stack.props.alignInline }).toEqual({ where, alignInline: 'start' });
  }
  for (const lozenge of findAll(root, 'Lozenge')) {
    expect({ where, text: flat(lozenge.props.children), maxWidth: lozenge.props.maxWidth }).toEqual({ where, text: flat(lozenge.props.children), maxWidth: '100%' });
  }
  for (const button of findAll(root, 'Button')) {
    expect(flat(button.props.children).trim()).not.toBe('');
  }
  // UX standard (B-43): at most one primary button per panel surface, and at most one per modal.
  const panelPrimary = findAll(root, 'Button', p => p.appearance === 'primary').filter((b: any) => !hasAncestor(b, a => a.type === 'ui-Modal'));
  expect({ where, atMostOnePrimaryInPanel: panelPrimary.length <= 1 }).toEqual({ where, atMostOnePrimaryInPanel: true });
  for (const modal of findAll(root, 'Modal')) {
    expect(typeof modal.props.onClose).toBe('function');
    const modalPrimary = findAll(modal, 'Button', p => p.appearance === 'primary');
    expect({ where, atMostOnePrimaryInModal: modalPrimary.length <= 1 }).toEqual({ where, atMostOnePrimaryInModal: true });
  }
  // UX standard (B-43): strict one-border rule (no bordered Box nested inside another bordered Box).
  for (const box of findAll(root, 'Box').filter(isBorderedBox)) {
    expect({ where, nestedBorder: hasAncestor(box, isBorderedBox) }).toEqual({ where, nestedBorder: false });
  }
  // UX standard (B-43): ActionRow contains at most 3 buttons.
  for (const actionRow of root.findAll((n: any) => n.type?.name === 'ActionRow')) {
    expect({ where, atMostThreeInActionRow: findAll(actionRow, 'Button').length <= 3 }).toEqual({ where, atMostThreeInActionRow: true });
  }
  expect(textOf(renderer.toJSON())).not.toMatch(FORBIDDEN);
  // Table cells and the empty view are props, not children: render each one and check it too.
  for (const table of findAll(root, 'DynamicTable')) {
    const parts = [table.props.emptyView, ...table.props.rows.flatMap((tr: any) => tr.cells.map((c: any) => c.content))];
    for (const part of parts.filter((p: any) => React.isValidElement(p))) {
      checkTree(TestRenderer.create(part), `${where}, table cell`);
    }
  }
}

const rows = [
  row('DEMO-1', { intent: F, process: F, code: NA, audit: F }, { sprintNames: ['Sprint 1'] }),
  row('DEMO-2', { intent: M_INTENT, process: M_DOD, code: M_CODE, audit: M_SEAL }, { assigneeName: undefined, reworkLoops: 1 }),
  row('DEMO-3', { intent: M_INTENT, process: F, code: { state: 'EXCEPTED', reason: 'CODE_EXCEPTED' }, audit: NA })
];

describe('B-20: accessibility on every view', () => {
  beforeEach(() => bridgeState.invoke.mockReset());

  it('the project dashboard, its filters, trend and Inspect modal', async () => {
    const trend = ['2026-10-19', '2026-10-26'].map(weekStart => ({
      weekStart, generatedAt: `${weekStart}T06:00:00.000Z`, ratedIssues: 3, averageRAI: 50,
      gates: { intent: { found: 1, missing: 2 }, process: { found: 2, missing: 1 }, code: { found: 0, missing: 1 }, audit: { found: 1, missing: 0 } },
      startedIssues: 3, reworkIssues: 1
    }));
    let r: any;
    await act(async () => { r = TestRenderer.create(<ProjectDashboard view={dashboard(rows, { trend, warning: 'Sync notice text' })} onRefresh={jest.fn()} />); });
    checkTree(r, 'dashboard');
    await act(async () => { findAll(r.root, 'Select', p => p.id === 'fr-filter-gate')[0].props.onChange({ label: 'Intent missing', value: 'intent' }); });
    await act(async () => { findAll(r.root, 'Select', p => p.id === 'fr-filter-sprint')[0].props.onChange({ label: 'Sprint 1', value: 'Sprint 1' }); });
    checkTree(r, 'dashboard with filters');
    await act(async () => { findButton(r.root, 'Clear all filters').props.onClick(); });
    await act(async () => { findAll(r.root, 'DynamicTable')[0].props.rows[0].cells[6].content.props.onClick(); });
    checkTree(r, 'inspect modal');
  });

  it('the issue panel starts with summary visible and detail sections collapsed, and checks every modal', async () => {
    const state = { status: 'REQUESTED' as const, issueKey: 'DEMO-2', requestedBy: 'dev-1', requestedAt: '2026-11-01T00:00:00Z', reason: 'Configuration change only' };
    let collapsedPanel: any;
    await act(async () => { collapsedPanel = TestRenderer.create(<IssuePanel row={row('DEMO-2', { intent: M_INTENT, process: M_DOD, code: M_CODE, audit: M_SEAL }, { reworkLoops: 1, codeException: state })} onReload={jest.fn()} onRow={jest.fn()} />); });
    checkTree(collapsedPanel, 'issue panel default collapsed');
    expect(textOf(collapsedPanel.toJSON())).toContain('No decision record is linked.');
    expect(textOf(collapsedPanel.toJSON())).toContain('Show details');
    expect(textOf(collapsedPanel.toJSON())).not.toContain('Source: Jira issue links and remote links.');

    let r: any;
    await act(async () => { r = TestRenderer.create(<IssuePanel row={row('DEMO-2', { intent: M_INTENT, process: M_DOD, code: M_CODE, audit: M_SEAL }, { reworkLoops: 1, codeException: state })} approval={{ canDecide: true, isRequester: true }} onReload={jest.fn()} onRow={jest.fn()} defaultCollapsed={false} />); });
    checkTree(r, 'issue panel');
    for (const open of ['Link decision record', 'Add rework reason', 'Approve exception', 'Reject exception', 'Withdraw request']) {
      await act(async () => { findButton(r.root, open).props.onClick(); });
      checkTree(r, open);
      await act(async () => { findButton(r.root, 'Cancel').props.onClick(); });
    }
    await act(async () => {
      r = TestRenderer.create(<IssuePanel row={row('DEMO-3', { intent: F, process: F, code: { state: 'FOUND', verification: 'HEURISTIC', reason: 'PR_MERGED' }, audit: NA })} onReload={jest.fn()} onRow={jest.fn()} defaultCollapsed={false} />);
    });
    await act(async () => { findButton(r.root, 'Request retrospective review').props.onClick(); });
    checkTree(r, 'Request retrospective review');
    await act(async () => { findButton(r.root, 'Cancel').props.onClick(); });
  });

  it('the loading, error and empty states', async () => {
    bridgeState.context = { extension: { project: { key: 'DEMO' } } };
    let resolve: (v: any) => void = () => undefined;
    bridgeState.invoke.mockImplementationOnce(() => new Promise(res => { resolve = res; }));
    let r: any;
    await act(async () => { r = TestRenderer.create(<FourRealitiesApp />); });
    checkTree(r, 'loading');
    await act(async () => { resolve({ ok: true, ...dashboard([]) }); });
    await settle(act);
    checkTree(r, 'empty');
    bridgeState.invoke.mockResolvedValueOnce({ ok: false, error: { message: 'Live Jira sync failed (HTTP 403).' } });
    const empty = findAll(r.root, 'EmptyState')[0];
    expect(flat(empty.props.primaryAction.props.children)).toBe('Refresh');
    await act(async () => { empty.props.primaryAction.props.onClick(); });
    await settle(act);
    checkTree(r, 'error');
  });

  it('keeps forbidden characters out of every UI, brand, and text source file', () => {
    const fs = require('fs');
    const path = require('path');
    const dirs = ['frontend', 'ui', 'brand'].map(d => path.join(__dirname, '..', '..', 'src', d));
    const bad = dirs.flatMap((d: string) => fs.readdirSync(d).filter((f: string) => /\.tsx?$/.test(f)).map((f: string) => path.join(d, f)))
      .filter((f: string) => FORBIDDEN.test(fs.readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});

