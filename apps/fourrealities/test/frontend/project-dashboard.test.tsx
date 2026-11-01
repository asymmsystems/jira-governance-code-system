/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: project dashboard render tests (rates, triage, filters, inspect, empty state)
 */

import * as React from 'react';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
import { bridgeState, findAll, findButton, textOf } from './forge-mocks';
import { F, M_CODE, M_DOD, M_INTENT, M_SEAL, NA, dashboard, row } from './rows';

jest.mock('@forge/react', () => require('./forge-mocks').reactMock());
jest.mock('@forge/bridge', () => require('./forge-mocks').bridgeMock());

import { ProjectDashboard, triageOrder } from '../../src/frontend/project-dashboard';

const rows = [
  row('DEMO-1', { intent: F, process: F, code: NA, audit: F }),
  row('DEMO-2', { intent: M_INTENT, process: M_DOD, code: M_CODE, audit: M_SEAL }, { assigneeName: undefined }),
  row('DEMO-3', { intent: M_INTENT, process: F, code: NA, audit: NA }),
  row('DEMO-4', { intent: NA, process: NA, code: NA, audit: NA }, { statusCategory: 'new', statusChanges: 0 })
];

async function mount(view: any, onRefresh = jest.fn()) {
  let renderer: any;
  await act(async () => { renderer = TestRenderer.create(<ProjectDashboard view={view} onRefresh={onRefresh} />); });
  return renderer;
}

function tableKeys(renderer: any): string[] {
  return findAll(renderer.root, 'DynamicTable')[0].props.rows.map((r: any) => r.cells[0].key);
}

describe('ProjectDashboard', () => {
  beforeEach(() => bridgeState.routerOpen.mockClear());

  it('orders triage by missing evidence, then risk', () => {
    expect(triageOrder(rows).map(r => r.issueKey)).toEqual(['DEMO-2', 'DEMO-3', 'DEMO-1', 'DEMO-4']);
  });

  it('shows gate rates with counts first, then RAI with its rated count', async () => {
    const r = await mount(dashboard(rows));
    const text = textOf(r.toJSON());
    expect(text).toContain('33% evidence found');
    expect(text).toContain('1 of 3 rated issues');
    expect(text).toContain('0% evidence found');
    expect(text).toContain('across 3 rated issues (1 unrated)');
    expect(text).toContain('Read 2026-11-01 08:30 UTC');
    expect(tableKeys(r)).toEqual(['DEMO-2', 'DEMO-3', 'DEMO-1', 'DEMO-4']);
  });

  it('shows RAI n/a when nothing is rated', async () => {
    const r = await mount(dashboard([rows[3]]));
    expect(textOf(r.toJSON())).toContain('RAI: n/a. No issue is rated yet (1 unrated).');
  });

  it('filters by a missing gate and by search text, and clears the filter', async () => {
    const r = await mount(dashboard(rows));
    await act(async () => { findButton(r.root, 'Show Intent missing (2)').props.onClick(); });
    expect(tableKeys(r)).toEqual(['DEMO-2', 'DEMO-3']);
    expect(textOf(r.toJSON())).toContain('Showing 2 of 4 issues');
    await act(async () => { findAll(r.root, 'Textfield', p => p.id === 'fr-search')[0].props.onChange({ target: { value: 'demo-3' } }); });
    expect(tableKeys(r)).toEqual(['DEMO-3']);
    await act(async () => { findAll(r.root, 'Textfield', p => p.id === 'fr-search')[0].props.onChange({ target: {} }); });
    await act(async () => { findButton(r.root, 'Clear filter: Intent missing').props.onClick(); });
    expect(tableKeys(r)).toHaveLength(4);
  });

  it('opens Inspect with gate rows and only an Open issue action', async () => {
    const r = await mount(dashboard(rows));
    const inspect = findAll(r.root, 'DynamicTable')[0].props.rows[0].cells[5].content;
    await act(async () => { inspect.props.onClick(); });
    const modal = findAll(r.root, 'Modal')[0];
    const modalText = JSON.stringify(TestRenderer.create(modal.props.children[1]).toJSON());
    expect(modalText).toContain('Intent: Evidence missing');
    const buttons = findAll(r.root, 'Button').filter((b: any) => ['Open issue', 'Close'].includes(String(b.props.children)));
    expect(buttons).toHaveLength(2);
    await act(async () => { findButton(r.root, 'Open issue').props.onClick(); });
    expect(bridgeState.routerOpen).toHaveBeenCalledWith('/browse/DEMO-2');
    await act(async () => { findButton(r.root, 'Close').props.onClick(); });
    expect(findAll(r.root, 'Modal')).toHaveLength(0);
  });

  it('shows a sync warning and unassigned rows', async () => {
    const r = await mount(dashboard(rows, { warning: 'Snapshot is 8 days old.' }));
    const text = textOf(r.toJSON());
    expect(text).toContain('Snapshot is 8 days old.');
    const assignees = findAll(r.root, 'DynamicTable')[0].props.rows.map((x: any) => x.cells[4].key);
    expect(assignees).toContain('Unassigned');
  });

  it('shows an empty state with a Refresh action', async () => {
    const onRefresh = jest.fn();
    const r = await mount(dashboard([]), onRefresh);
    const empty = findAll(r.root, 'EmptyState')[0];
    expect(empty.props.header).toBe('No issues to rate yet');
    empty.props.primaryAction.props.onClick();
    expect(onRefresh).toHaveBeenCalled();
  });

  it('breaks ties by risk, RAI (UNRATED last) and key', () => {
    const a = row('T-2', { intent: F, process: NA, code: NA, audit: NA });
    const b = row('T-1', { intent: F, process: NA, code: NA, audit: NA });
    const c = row('T-3', { intent: NA, process: NA, code: NA, audit: NA });
    const d = row('T-4', { intent: M_INTENT, process: F, code: F, audit: F });
    expect(triageOrder([c, a, b, d]).map(r => r.issueKey)).toEqual(['T-4', 'T-1', 'T-2', 'T-3']);
  });

  it('renders the gate chips with text names in each row', async () => {
    const r = await mount(dashboard(rows));
    const chips = findAll(r.root, 'DynamicTable')[0].props.rows[0].cells[2].content;
    const json = JSON.stringify(TestRenderer.create(chips).toJSON());
    expect(json).toContain('Intent: evidence missing');
    expect(json).toContain('Audit: evidence missing');
    const raiKeys = findAll(r.root, 'DynamicTable')[0].props.rows.map((x: any) => x.cells[3].key);
    expect(raiKeys).toContain('999');
  });

  it('says when the read stopped at the cap (B-09)', async () => {
    const capped = await mount(dashboard(rows, { coverage: { shown: 2000, totalKnown: 2310, capped: true } }));
    expect(textOf(capped.toJSON())).toContain('Showing 2000 of about 2310 issues. FourRealities reads at most 2000 issues per project, newest first.');
    const unknown = await mount(dashboard(rows, { coverage: { shown: 2000, totalKnown: null, capped: true } }));
    expect(textOf(unknown.toJSON())).toContain('Showing 2000 of an unknown number of issues.');
    const full = await mount(dashboard(rows));
    expect(textOf(full.toJSON())).not.toContain('Partial read');
  });

  it('B-11: every dashboard button has a visible effect or opens a page, and none writes', async () => {
    const onRefresh = jest.fn();
    const r = await mount(dashboard(rows), onRefresh);
    const labels = findAll(r.root, 'Button').map((b: any) => JSON.stringify(b.props.children));
    const signature = (t: any) => [textOf(t.toJSON()), findAll(t.root, 'Modal').length, tableKeys(t).join(',')].join('|');
    for (const label of labels) {
      const fresh = await mount(dashboard(rows), onRefresh);
      const before = signature(fresh);
      const button = findAll(fresh.root, 'Button').find((b: any) => JSON.stringify(b.props.children) === label);
      onRefresh.mockClear();
      bridgeState.routerOpen.mockClear();
      await act(async () => { button.props.onClick(); });
      const changed = signature(fresh) !== before;
      expect(changed || onRefresh.mock.calls.length > 0 || bridgeState.routerOpen.mock.calls.length > 0).toBe(true);
    }
    expect(bridgeState.invoke).not.toHaveBeenCalled();
  });

  it('B-11: the Inspect modal offers no remediation action', async () => {
    const r = await mount(dashboard(rows));
    await act(async () => { findAll(r.root, 'DynamicTable')[0].props.rows[0].cells[5].content.props.onClick(); });
    const modal = findAll(r.root, 'Modal')[0];
    const modalButtons = modal.findAll((n: any) => n.type === 'ui-Button').map((b: any) => String(b.props.children));
    expect(modalButtons.sort()).toEqual(['Close', 'Open issue']);
  });
});

