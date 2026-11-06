/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: project dashboard render tests (rates, triage, filters, inspect, empty state)
 */

import * as React from 'react';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
import { bridgeState, findAll, findButton, flatText, textOf } from './forge-mocks';
import { F, M_CODE, M_DOD, M_INTENT, M_SEAL, NA, dashboard, row } from './rows';

jest.mock('@forge/react', () => require('./forge-mocks').reactMock());
jest.mock('@forge/bridge', () => require('./forge-mocks').bridgeMock());

import { ProjectDashboard } from '../../src/frontend/project-dashboard';
import { triageOrder } from '../../src/ui/triage';

const rows = [
  row('DEMO-1', { intent: F, process: F, code: NA, audit: F }),
  row('DEMO-2', { intent: M_INTENT, process: M_DOD, code: M_CODE, audit: M_SEAL }, { assigneeAccountId: undefined }),
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

  it('shows Four Realities header, readiness lozenge, gate rates with counts first, then Coverage at a glance and RAI', async () => {
    const r = await mount(dashboard(rows));
    const order = r.root.findAll((n: any) => n.type === 'ui-Heading' && /^(Intent|Audit|Alignment)/.test(flatText(n.props.children)));
    expect(order.map((n: any) => flatText(n.props.children).slice(0, 3))).toEqual(['Int', 'Aud', 'Ali']);
    const text = textOf(r.toJSON());
    expect(text).toContain('Four Realities DEMO');
    expect(text).toContain('Coverage at a glance');
    expect(text).toContain('1 of 3 rated issues have evidence');
    expect(findAll(r.root, 'Lozenge').map((l: any) => flatText(l.props.children)).slice(0, 6)).toEqual(['DEMO', 'Incomplete', '33%', '67%', '0%', '50%']);
    expect(text).toContain('across 3 rated issues (1 unrated)');
    expect(text).toContain('Read 2026-11-01 08:30 UTC');
    expect(tableKeys(r)).toEqual(['DEMO-2', 'DEMO-3', 'DEMO-1', 'DEMO-4']);
  });

  it('B-21: puts no sprint name next to the project score and offers no way to rank people', async () => {
    const r = await mount(dashboard([row('DEMO-1', { intent: F, process: F, code: NA, audit: F }, { sprintNames: ['Sprint 12'] })]));
    const score = findAll(r.root, 'Heading').map((h: any) => flatText(h.props.children)).filter(t => t.startsWith('Alignment'));
    expect(score).toEqual(['Alignment 100%']);
    expect(textOf(r.toJSON()).match(/Alignment[^.]*Sprint/)).toBeNull();
    const heading = findAll(r.root, 'Heading').map((h: any) => (Array.isArray(h.props.children) ? h.props.children.join('') : String(h.props.children)));
    expect(heading.filter(h => h.includes('Sprint'))).toEqual([]);
    const head = findAll(r.root, 'DynamicTable')[0].props.head.cells;
    expect(head.find((c: any) => c.key === 'assignee').isSortable).toBeFalsy();
  });

  it('shows no score and no card action when nothing is rated', async () => {
    const r = await mount(dashboard([rows[3]]));
    const text = textOf(r.toJSON());
    expect(text).toContain('across 0 rated issues (1 unrated)');
    expect(text).toContain('No issue is rated for this gate yet.');
    expect(findAll(r.root, 'ProgressBar')).toHaveLength(0);
  });

  it('filters by a missing gate and by search text, and clears the filter', async () => {
    const r = await mount(dashboard(rows));
    await act(async () => { findButton(r.root, 'Show 2 missing Intent').props.onClick(); });
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
      row('DEMO-2', { intent: M_INTENT, process: M_DOD, code: M_CODE, audit: M_SEAL }, { assigneeAccountId: undefined, sprintNames: ['Sprint 2'] }),
      row('DEMO-3', { intent: M_INTENT, process: F, code: NA, audit: NA }, { assigneeAccountId: 'acc-bo', sprintNames: ['Sprint 2'] })
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

  it('B-37: leads with Alignment, the change since last week and the weakest gate', async () => {
    const r = await mount(dashboard(rows));
    const headings = findAll(r.root, 'Heading').map((h: any) => flatText(h.props.children));
    expect(headings).toContain('Alignment 50%');
    const text = textOf(r.toJSON());
    expect(text).toContain('across 3 rated issues (1 unrated)');
    expect(text).toContain('Not enough data for a trend yet.');
    expect(text).toContain('Weakest gate: Code, 0% (0 of 1 rated issues).');
    const unrated = await mount(dashboard([rows[3]]));
    expect(findAll(unrated.root, 'Heading').map((h: any) => flatText(h.props.children))).toContain('Alignment: not rated yet');
  });

  it('B-35: shows one card per gate with a question, a labelled progress bar, a count, and an action only when something is missing', async () => {
    const r = await mount(dashboard(rows));
    const cards = findAll(r.root, 'Box').filter((b: any) => b.props.xcss?.props?.borderStyle === 'solid' && findAll(b, 'Tooltip').some((t: any) => String(t.props.content).startsWith('Metric ')) && findAll(b, 'Tooltip').length === 1);
    expect(cards).toHaveLength(4);
    const intent = textOf(TestRenderer.create(cards[0].props.children).toJSON());
    expect(intent).toContain('Is the work traced to a decision record?');
    expect(intent).toContain('1 of 3 rated issues have evidence');
    expect(findAll(cards[0], 'ProgressBar')[0].props).toEqual(expect.objectContaining({ value: 1 / 3, ariaLabel: 'Intent: 1 of 3 rated issues have evidence' }));
    expect(findAll(cards[0], 'Tooltip')[0].props.content).toBe('Metric M11: share of rated issues traced to a decision record.');
    const audit = textOf(TestRenderer.create(cards[3].props.children).toJSON());
    expect(audit).toContain('Is the finished work sealed?');
    const intentButton = findButton(r.root, 'Show 2 missing Intent');
    expect(intentButton.props.appearance).toBe('subtle');
    expect(intentButton.props.iconAfter).toBe('arrow-down');
    expect(intentButton.props.isSelected).toBe(false);
    await act(async () => { intentButton.props.onClick(); });
    expect(tableKeys(r)).toEqual(['DEMO-2', 'DEMO-3']);
    expect(findButton(r.root, 'Show 2 missing Intent').props.isSelected).toBe(true);

    // Toggle off by clicking again
    await act(async () => { findButton(r.root, 'Show 2 missing Intent').props.onClick(); });
    expect(tableKeys(r)).toEqual(['DEMO-2', 'DEMO-3', 'DEMO-1', 'DEMO-4']);
    expect(findButton(r.root, 'Show 2 missing Intent').props.isSelected).toBe(false);

    const none = await mount(dashboard([rows[0]]));
    expect(() => findButton(none.root, 'missing Intent')).toThrow('No button');
  });

  it('B-39: shows the risk counts as buttons that filter the table', async () => {
    const r = await mount(dashboard(rows));
    const risk = findAll(r.root, 'Button').map((b: any) => flatText(b.props.children)).filter((t: string) => /^(Critical|High|Medium|Low) \d+$/.test(t));
    expect(risk).toEqual(['Critical 1', 'High 1', 'Medium 0', 'Low 1']);
    await act(async () => { findButton(r.root, 'Critical 1').props.onClick(); });
    expect(tableKeys(r)).toEqual(['DEMO-2']);
    await act(async () => { findButton(r.root, 'High 1').props.onClick(); });
    expect(tableKeys(r)).toEqual(['DEMO-2', 'DEMO-3']);
    expect(textOf(r.toJSON())).toContain('Remove filter: Risk: Critical, High');
  });

  it('B-34: gives the Gates column the most width by default and toggles wide text columns on demand', async () => {
    const r = await mount(dashboard(rows));
    const widths = () => Object.fromEntries(findAll(r.root, 'DynamicTable')[0].props.head.cells.map((c: any) => [c.key, c.width]));
    expect(widths()).toEqual({ key: 9, summary: 19, gates: 32, rai: 11, finding: 15, assignee: 7, action: 7 });
    await act(async () => { findButton(r.root, 'Wide text columns').props.onClick(); });
    expect(widths()).toEqual({ key: 8, summary: 28, gates: 24, rai: 10, finding: 18, assignee: 6, action: 6 });
    await act(async () => { findButton(r.root, 'Balanced columns').props.onClick(); });
    expect(widths().gates).toBe(32);
  });

  it('B-40: preset views set isSelected, toggle off on second click, and My issues uses the viewer account', async () => {
    const mineRows = [row('DEMO-1', { intent: F, process: F, code: NA, audit: F }, { assigneeAccountId: 'acc-1', updated: '2026-11-01T10:00:00Z' }), ...rows.slice(1)];
    let r: any;
    await act(async () => { r = TestRenderer.create(<ProjectDashboard view={dashboard(mineRows)} onRefresh={jest.fn()} viewerAccountId="acc-1" />); });
    expect(findButton(r.root, 'My issues').props.isSelected).toBe(false);
    await act(async () => { findButton(r.root, 'My issues').props.onClick(); });
    expect(findButton(r.root, 'My issues').props.isSelected).toBe(true);
    expect(tableKeys(r)).toEqual(['DEMO-1']);
    const issueCell = TestRenderer.create(findAll(r.root, 'DynamicTable')[0].props.rows[0].cells[0].content);
    expect(textOf(issueCell.toJSON())).toContain('2026-11-01');
    await act(async () => { findButton(r.root, 'My issues').props.onClick(); });
    expect(findButton(r.root, 'My issues').props.isSelected).toBe(false);
    expect(tableKeys(r)).toHaveLength(4);
    await act(async () => { findButton(r.root, 'Needs a decision link').props.onClick(); });
    expect(findButton(r.root, 'Needs a decision link').props.isSelected).toBe(true);
    expect(tableKeys(r)).toEqual(['DEMO-2', 'DEMO-3']);
    const anonymous = await mount(dashboard(rows));
    expect(() => findButton(anonymous.root, 'My issues')).toThrow('No button');
  });

  it('B-40: Inspect shows the pipeline, step position, and drift sentence, and steps through the visible rows', async () => {
    const r = await mount(dashboard(rows));
    await act(async () => { findAll(r.root, 'DynamicTable')[0].props.rows[0].cells[6].content.props.onClick(); });
    const title = () => flatText(findAll(r.root, 'ModalTitle')[0].props.children);
    const bodyText = () => textOf(TestRenderer.create(findAll(r.root, 'Modal')[0].props.children[1]).toJSON());
    expect(title()).toBe('DEMO-2: Work DEMO-2');
    expect(bodyText()).toContain('No decision record is linked.');
    expect(bodyText()).toContain('Issue 1 of 4');
    expect(findButton(r.root, 'Previous issue').props.isDisabled).toBe(true);
    await act(async () => { findButton(r.root, 'Next issue').props.onClick(); });
    expect(title()).toBe('DEMO-3: Work DEMO-3');
    expect(bodyText()).toContain('Issue 2 of 4');
    await act(async () => { findButton(r.root, 'Next issue').props.onClick(); });
    await act(async () => { findButton(r.root, 'Next issue').props.onClick(); });
    expect(title()).toBe('DEMO-4: Work DEMO-4');
    expect(bodyText()).toContain('Issue 4 of 4');
    expect(findButton(r.root, 'Next issue').props.isDisabled).toBe(true);
    await act(async () => { findButton(r.root, 'Previous issue').props.onClick(); });
    expect(title()).toBe('DEMO-1: Work DEMO-1');
    expect(bodyText()).toContain('Issue 3 of 4');
  });

  it('B-34: shows each issue as a compact pipeline, evidenced ratio, gaps summary, and top finding', async () => {
    const r = await mount(dashboard(rows));
    expect(findAll(r.root, 'DynamicTable')[0].props.head.cells.map((c: any) => c.content)).toEqual(['Issue', 'Summary', 'Gates', 'Alignment', 'Top finding', 'Assignee', 'Action']);
    const first = findAll(r.root, 'DynamicTable')[0].props.rows[0];
    const gatesCell = TestRenderer.create(first.cells[2].content);
    expect(findAll(gatesCell.root, 'Lozenge').map((l: any) => String(l.props.children))).toEqual(['✕ Intent: missing', '✕ Process: missing', '✕ Code: missing', '✕ Audit: missing']);
    expect(findAll(gatesCell.root, 'Tooltip')[0].props.content).toBe('Intent: Evidence missing. Source: Jira issue links and remote links.');
    expect(textOf(TestRenderer.create(first.cells[3].content).toJSON())).toContain('0 / 4 evidenced');
    expect(textOf(TestRenderer.create(first.cells[4].content).toJSON())).toBe('4 gaps: Intent, Process, Code, Audit No decision record is linked.');
  });

  it('opens Inspect with gate rows and only an Open issue action', async () => {
    const r = await mount(dashboard(rows));
    const inspect = findAll(r.root, 'DynamicTable')[0].props.rows[0].cells[6].content;
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
    const assignees = findAll(r.root, 'DynamicTable')[0].props.rows.map((x: any) => x.cells[5].key);
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
    expect(json).toContain('Intent: missing');
    expect(json).toContain('Audit: missing');
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
    await act(async () => { findAll(r.root, 'DynamicTable')[0].props.rows[0].cells[6].content.props.onClick(); });
    const modal = findAll(r.root, 'Modal')[0];
    const modalButtons = modal.findAll((n: any) => n.type === 'ui-Button').map((b: any) => String(b.props.children));
    expect(modalButtons.sort()).toEqual(['Close', 'Next issue', 'Open issue', 'Previous issue']);
  });

  it('B-46: shows status banner, priority actions respecting filters, and quiet footnote', async () => {
    const r = await mount(dashboard(rows));
    const text = textOf(r.toJSON());
    expect(text).toContain('Audit readiness: Incomplete');
    expect(text).toContain('Priority actions');
    expect(text).toContain('1. DEMO-2: Next: link the decision record.');
    expect(text).toContain('Alignment (Reality Alignment Index, RAI) is calculated across rated gates only.');

    // Respects active filters
    await act(async () => { select(r, 'fr-filter-gate').props.onChange({ label: 'Code missing', value: 'code' }); });
    const filteredText = textOf(r.toJSON());
    expect(filteredText).toContain('1. DEMO-2: Next: link the decision record.');
    expect(filteredText).not.toContain('DEMO-3:');
  });
});



describe('ADR-011, ADR-010: checks in use and reported records on the dashboard', () => {
  it('shows a check that is not in use as not used, with no rate and no missing button, and lists the checks in use', async () => {
    const NOT_USED = { state: 'NOT_APPLICABLE', reason: 'SOURCE_NOT_IN_USE' } as const;
    const REP = { state: 'REPORTED', verification: 'NOT_VERIFIED', reason: 'DOD_COMPLETE_DG' } as const;
    const rows = [row('DEMO-1', { intent: F, process: REP, code: NOT_USED, audit: NOT_USED })];
    const sources = { intent: true, process: 'definitionguard' as const, code: false, audit: false, decisionIssueTypes: ['adr'], detected: { process: true, code: false, audit: false } };
    let r: any;
    await act(async () => { r = TestRenderer.create(<ProjectDashboard view={dashboard(rows, { sources, sourceNotes: ['LedgerSeal records were found on this site.'] })} onRefresh={jest.fn()} />); });
    const text = textOf(r.toJSON());
    expect(text).toContain('Not used on this site, so not scored.');
    expect(text).toContain('Checks in use on this site: Intent; Process (DefinitionGuard, detected). Not used on this site: Code, Audit.');
    expect(text).toContain('LedgerSeal records were found on this site.');
    expect(text).toContain('1 more reported, not verified (not scored)');
    expect(() => findButton(r.root, 'Show 1 missing Audit')).toThrow('No button');
  });
});

describe('F-H2: a page view that ran out of time says so', () => {
  it('names the time limit and the daily snapshot instead of the cap', async () => {
    const rows = [row('DEMO-1', { intent: F, process: NA, code: NA, audit: NA })];
    let r: any;
    await act(async () => { r = TestRenderer.create(<ProjectDashboard view={dashboard(rows, { coverage: { shown: 1, totalKnown: 3000, capped: true, timedOut: true } })} onRefresh={jest.fn()} />); });
    expect(textOf(r.toJSON())).toContain('Showing 1 of about 3000 issues: the newest issues FourRealities could read in the time one page view has. The daily snapshot reads up to 2,000 issues; Refresh tries again now.');
    await act(async () => { r = TestRenderer.create(<ProjectDashboard view={dashboard(rows, { coverage: { shown: 1, totalKnown: null, capped: true, timedOut: true } })} onRefresh={jest.fn()} />); });
    expect(textOf(r.toJSON())).toContain('Showing 1 of an unknown number of issues: the newest');
  });
});
