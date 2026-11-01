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
    const order = r.root.findAll((n: any) => (n.type === 'ui-Heading' && ['Intent', 'Audit'].includes(String(n.props.children))) || (n.type === 'ui-Text' && String(n.props.children).startsWith('RAI ')));
    expect(order.map((n: any) => String(n.props.children).slice(0, 3))).toEqual(['Int', 'Aud', 'RAI']);
    const text = textOf(r.toJSON());
    expect(text).toContain('33% evidence found');
    expect(text).toContain('1 of 3 rated issues');
    expect(text).toContain('0% evidence found');
    expect(text).toContain('across 3 rated issues (1 unrated)');
    expect(text).toContain('Read 2026-11-01 08:30 UTC');
    expect(tableKeys(r)).toEqual(['DEMO-2', 'DEMO-3', 'DEMO-1', 'DEMO-4']);
  });

  it('B-21: puts no sprint name next to the project score and offers no way to rank people', async () => {
    const r = await mount(dashboard([row('DEMO-1', { intent: F, process: F, code: NA, audit: F }, { sprintNames: ['Sprint 12'] })]));
    const score = findAll(r.root, 'Text').map((t: any) => String(t.props.children)).filter(t => t.startsWith('RAI '));
    expect(score).toHaveLength(1);
    expect(score[0]).not.toContain('Sprint');
    const heading = findAll(r.root, 'Heading').map((h: any) => (Array.isArray(h.props.children) ? h.props.children.join('') : String(h.props.children)));
    expect(heading.filter(h => h.includes('Sprint'))).toEqual([]);
    const head = findAll(r.root, 'DynamicTable')[0].props.head.cells;
    expect(head.find((c: any) => c.key === 'assignee').isSortable).toBeFalsy();
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
    await act(async () => { findButton(r.root, 'Remove filter: Intent missing').props.onClick(); });
    expect(tableKeys(r)).toHaveLength(4);
  });

  const select = (r: any, id: string) => findAll(r.root, 'Select', p => p.id === id)[0];

  it('B-18: filters by assignee, sprint and gate with labelled selects, and removes each filter on its own', async () => {
    const sprintRows = [
      row('DEMO-1', { intent: F, process: F, code: NA, audit: F }, { sprintNames: ['Sprint 1'] }),
      row('DEMO-2', { intent: M_INTENT, process: M_DOD, code: M_CODE, audit: M_SEAL }, { assigneeName: undefined, sprintNames: ['Sprint 2'] }),
      row('DEMO-3', { intent: M_INTENT, process: F, code: NA, audit: NA }, { assigneeName: 'Bo Chen', sprintNames: ['Sprint 2'] })
    ];
    const r = await mount(dashboard(sprintRows));
    expect(findAll(r.root, 'Label').map((l: any) => l.props.labelFor)).toEqual(['fr-search', 'fr-filter-assignee', 'fr-filter-sprint', 'fr-filter-gate']);
    expect(select(r, 'fr-filter-assignee').props.options.map((o: any) => o.label)).toEqual(['Ana Silva', 'Bo Chen', 'Unassigned']);
    expect(select(r, 'fr-filter-sprint').props.options.map((o: any) => o.label)).toEqual(['Sprint 1', 'Sprint 2']);
    expect(select(r, 'fr-filter-gate').props.options.map((o: any) => o.label)).toEqual(['Intent missing', 'Process missing', 'Code missing', 'Audit missing']);

    await act(async () => { select(r, 'fr-filter-sprint').props.onChange({ label: 'Sprint 2', value: 'Sprint 2' }); });
    expect(tableKeys(r)).toEqual(['DEMO-2', 'DEMO-3']);
    await act(async () => { select(r, 'fr-filter-assignee').props.onChange({ label: 'Unassigned', value: 'Unassigned' }); });
    expect(tableKeys(r)).toEqual(['DEMO-2']);
    await act(async () => { select(r, 'fr-filter-gate').props.onChange({ label: 'Code missing', value: 'code' }); });
    expect(tableKeys(r)).toEqual(['DEMO-2']);
    expect(select(r, 'fr-filter-assignee').props.value).toEqual({ label: 'Unassigned', value: 'Unassigned' });
    const text = textOf(r.toJSON());
    expect(text).toContain('Showing 1 of 3 issues');

    await act(async () => { findButton(r.root, 'Remove filter: Assignee: Unassigned').props.onClick(); });
    expect(tableKeys(r)).toEqual(['DEMO-2']);
    await act(async () => { findButton(r.root, 'Remove filter: Code missing').props.onClick(); });
    expect(tableKeys(r)).toEqual(['DEMO-2', 'DEMO-3']);
    await act(async () => { select(r, 'fr-filter-sprint').props.onChange(null); });
    expect(tableKeys(r)).toHaveLength(3);

    await act(async () => { select(r, 'fr-filter-gate').props.onChange({ label: 'Intent missing', value: 'intent' }); });
    await act(async () => { select(r, 'fr-filter-sprint').props.onChange({ label: 'Sprint 1', value: 'Sprint 1' }); });
    expect(tableKeys(r)).toEqual([]);
    expect(textOf(TestRenderer.create(findAll(r.root, 'DynamicTable')[0].props.emptyView).toJSON())).toBe('No issues match the filters.');
    await act(async () => { findButton(r.root, 'Clear all filters').props.onClick(); });
    expect(tableKeys(r)).toHaveLength(3);
    expect(() => findButton(r.root, 'Clear all filters')).toThrow('No button');
  });

  const point = (weekStart: string, found: number, missing: number) => ({
    weekStart, generatedAt: `${weekStart}T06:00:00.000Z`, ratedIssues: found + missing, averageRAI: Math.round((found * 100) / (found + missing)),
    gates: { intent: { found, missing }, process: { found, missing }, code: { found: 0, missing: 0 }, audit: { found, missing } },
    startedIssues: found + missing, reworkIssues: 0
  });

  it('B-19: shows the four-week trend as a text table first, then a line chart, labelled project-wide', async () => {
    const trend = [point('2026-10-05', 1, 9), point('2026-10-12', 2, 8), point('2026-10-19', 3, 7), point('2026-10-26', 4, 6), point('2026-11-02', 5, 5)];
    const r = await mount(dashboard(rows, { trend }));
    const text = textOf(r.toJSON());
    expect(text).toContain('Trend: last 4 weeks (whole project)');
    expect(text).toContain('Week of 2026-10-12');
    expect(text).not.toContain('Week of 2026-10-05');
    expect(text).toContain('Intent 5 of 10 rated (50%)');
    expect(text).toContain('Code n/a (0 rated)');
    const chart = findAll(r.root, 'LineChart')[0];
    expect(chart.props).toEqual(expect.objectContaining({ xAccessor: 'week', yAccessor: 'percent', colorAccessor: 'series', title: 'Evidence found, percent of rated' }));
    expect(chart.props.data.filter((d: any) => d.series === 'Intent')).toHaveLength(4);
    // Tree order: the text table comes before the chart.
    const order = r.root.findAll((n: any) => n.type === 'ui-LineChart' || (n.type === 'ui-Text' && String(n.props.children).startsWith('Week of 2026-10-12')));
    expect(order.map((n: any) => n.type)).toEqual(['ui-Text', 'ui-LineChart']);
  });

  it('B-19: says when the trend starts and draws no chart with fewer than two weeks', async () => {
    const r = await mount(dashboard(rows, { trend: [point('2026-10-26', 1, 1)] }));
    expect(textOf(r.toJSON())).toContain('Trend starts after two weekly snapshots. Next snapshot: 2026-11-02.');
    expect(findAll(r.root, 'LineChart')).toHaveLength(0);
  });

  it('B-18: hides the Sprint filter, not empty, for a project without sprints', async () => {
    const r = await mount(dashboard(rows));
    expect(findAll(r.root, 'Select', p => p.id === 'fr-filter-sprint')).toHaveLength(0);
    expect(findAll(r.root, 'Label').map((l: any) => l.props.labelFor)).toEqual(['fr-search', 'fr-filter-assignee', 'fr-filter-gate']);
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

