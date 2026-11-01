/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: project dashboard. Triage and deep links only; remediation lives in the issue panel.
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  DynamicTable,
  EmptyState,
  Heading,
  Label,
  Inline,
  LineChart,
  Lozenge,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  SectionMessage,
  Select,
  Stack,
  Text,
  Textfield
} from '@forge/react';
import { router } from '@forge/bridge';
import { GATE_NAMES, GateName, IssueRow, ProjectDashboardView } from '../contract/data/models';
import { GATE_LABEL, raiText, rateText, riskAppearance } from '../ui/gate-text';
import { DashboardFilters, FilterField, GATE_FILTER_OPTIONS, NO_FILTERS, activeFilters, applyFilters, filterOptions, missingGateLabel } from '../ui/filters';
import { TREND_WEEKS, chartData, recentWeeks, trendNotice, trendTableRows } from '../ui/trend';
import { GateChips, GateRow } from './gate-row';

type Option<T extends string = string> = { label: string; value: T };
const asOption = (value: string | null): Option | null => (value === null ? null : { label: value, value });

const RATE_OF: Record<GateName, (v: ProjectDashboardView) => number | null> = {
  intent: v => v.summary.m11IntentRate,
  process: v => v.summary.dodRate,
  code: v => v.summary.m29PullRequestRate,
  audit: v => v.summary.sealRate
};

const RISK_RANK: Record<IssueRow['risk'], number> = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4, UNRATED: 5 };

/**
 * Weekly trend for the whole project (spec v2, D-4): a text table first, so the numbers are
 * readable in order, then a line chart of the same numbers.
 */
export const TrendPanel: React.FC<{ view: ProjectDashboardView }> = ({ view }) => {
  const points = recentWeeks(view.trend);
  const notice = trendNotice(points, view.generatedAt);
  return (
    <Stack space="space.100">
      <Heading as="h4">{`Trend: last ${TREND_WEEKS} weeks (whole project)`}</Heading>
      {notice ? <Text>{notice}</Text> : (
        <>
          {trendTableRows(points).map(t => (
            <Text key={t.week}>{`${t.week}: ${t.rai}; ${t.intent}; ${t.process}; ${t.code}; ${t.audit}.`}</Text>
          ))}
          <LineChart data={chartData(points)} xAccessor="week" yAccessor="percent" colorAccessor="series" title="Evidence found, percent of rated" />
        </>
      )}
    </Stack>
  );
};

/** Rows sorted for triage: most missing evidence first, then lowest RAI. */
export function triageOrder(rows: IssueRow[]): IssueRow[] {
  const missing = (r: IssueRow) => GATE_NAMES.filter(g => r.gates[g].state === 'MISSING').length;
  return [...rows].sort((a, b) =>
    missing(b) - missing(a) || RISK_RANK[a.risk] - RISK_RANK[b.risk] || (a.rai ?? 101) - (b.rai ?? 101) || a.issueKey.localeCompare(b.issueKey));
}

export const ProjectDashboard: React.FC<{ view: ProjectDashboardView; onRefresh: () => void }> = ({ view, onRefresh }) => {
  const [filters, setFilters] = useState<DashboardFilters>(NO_FILTERS);
  const [selected, setSelected] = useState<IssueRow | null>(null);

  const options = useMemo(() => filterOptions(view.rows), [view.rows]);
  const visible = useMemo(() => applyFilters(triageOrder(view.rows), filters), [view.rows, filters]);
  const set = (patch: Partial<DashboardFilters>) => setFilters(f => ({ ...f, ...patch }));
  const remove = (field: FilterField) => set({ [field]: null });
  const active = activeFilters(filters);

  const { summary } = view;

  if (view.rows.length === 0) {
    return (
      <EmptyState
        header="No issues to rate yet"
        description="This project has no issues that FourRealities can read. Create or start work, then refresh."
        primaryAction={<Button appearance="primary" onClick={onRefresh}>Refresh</Button>}
      />
    );
  }

  const head = {
    cells: [
      { key: 'key', content: 'Issue', isSortable: true },
      { key: 'summary', content: 'Summary' },
      { key: 'gates', content: 'Gates' },
      { key: 'rai', content: 'RAI', isSortable: true },
      // Not sortable: the table never orders people next to a score (B-21, H5). Use the Assignee filter.
      { key: 'assignee', content: 'Assignee' },
      { key: 'action', content: 'Action' }
    ]
  };

  const rows = visible.map(r => ({
    key: r.issueId,
    cells: [
      { key: r.issueKey, content: <Text>{r.issueKey}</Text> },
      { key: r.summary, content: <Text>{r.summary}</Text> },
      { key: 'gates', content: <GateChips gates={r.gates} /> },
      { key: r.rai === null ? '999' : String(r.rai).padStart(3, '0'), content: <Lozenge maxWidth="100%" appearance={riskAppearance(r.risk)}>{raiText(r)}</Lozenge> },
      { key: r.assigneeName || 'Unassigned', content: <Text>{r.assigneeName || 'Unassigned'}</Text> },
      { key: 'action', content: <Button appearance="subtle" onClick={() => setSelected(r)}>Inspect</Button> }
    ]
  }));

  return (
    <Stack space="space.200">
      {view.coverage?.capped ? (
        <SectionMessage appearance="information" title="Partial read">
          <Text>
            {`Showing ${view.coverage.shown} of ${view.coverage.totalKnown === null ? 'an unknown number of' : `about ${view.coverage.totalKnown}`} issues. FourRealities reads at most ${view.coverage.shown} issues per project, newest first.`}
          </Text>
        </SectionMessage>
      ) : null}

      {view.warning ? (
        <SectionMessage appearance="warning" title="Sync notice">
          <Text>{view.warning}</Text>
        </SectionMessage>
      ) : null}

      <Inline space="space.150" alignBlock="center" shouldWrap>
        <Heading as="h3">Delivery evidence: {view.projectKey}</Heading>
        <Text>{`Read ${view.generatedAt.slice(0, 16).replace('T', ' ')} UTC`}</Text>
        <Button appearance="subtle" onClick={onRefresh}>Refresh</Button>
      </Inline>

      <Inline space="space.150" shouldWrap>
        {GATE_NAMES.map(g => {
          const c = summary.gates[g];
          return (
            <Box key={g} padding="space.100">
              <Stack space="space.050">
                <Heading as="h4">{GATE_LABEL[g]}</Heading>
                <Text>{`${rateText(RATE_OF[g](view))} evidence found`}</Text>
                <Text>{`${c.found} of ${c.found + c.missing} rated issues`}</Text>
                <Button appearance="subtle" onClick={() => set({ missingGate: g })}>{`Show ${GATE_LABEL[g]} missing (${c.missing})`}</Button>
              </Stack>
            </Box>
          );
        })}
      </Inline>

      <Text>
        {summary.averageRAI === null
          ? `RAI: n/a. No issue is rated yet (${summary.unratedIssues} unrated).`
          : `RAI ${summary.averageRAI}% across ${summary.ratedIssues} rated issues (${summary.unratedIssues} unrated). RAI is the share of rated gates with evidence found.`}
      </Text>

      <TrendPanel view={view} />

      <Inline space="space.100" alignBlock="end" shouldWrap>
        <Stack space="space.050">
          <Label labelFor="fr-search">Search key or summary</Label>
          <Textfield id="fr-search" value={filters.search} onChange={(e: any) => set({ search: e.target?.value || '' })} />
        </Stack>
        <Stack space="space.050">
          <Label labelFor="fr-filter-assignee">Assignee</Label>
          <Select id="fr-filter-assignee" isClearable placeholder="Any assignee" options={options.assignees.map(a => ({ label: a, value: a }))}
            value={asOption(filters.assignee)} onChange={(o: Option | null) => set({ assignee: o?.value ?? null })} />
        </Stack>
        {options.sprints.length > 0 ? (
          <Stack space="space.050">
            <Label labelFor="fr-filter-sprint">Sprint</Label>
            <Select id="fr-filter-sprint" isClearable placeholder="Any sprint" options={options.sprints.map(s => ({ label: s, value: s }))}
              value={asOption(filters.sprint)} onChange={(o: Option | null) => set({ sprint: o?.value ?? null })} />
          </Stack>
        ) : null}
        <Stack space="space.050">
          <Label labelFor="fr-filter-gate">Gate</Label>
          <Select id="fr-filter-gate" isClearable placeholder="Any gate" options={GATE_FILTER_OPTIONS}
            value={filters.missingGate ? { label: missingGateLabel(filters.missingGate), value: filters.missingGate } : null}
            onChange={(o: Option<GateName> | null) => set({ missingGate: o?.value ?? null })} />
        </Stack>
      </Inline>

      <Inline space="space.100" alignBlock="center" shouldWrap>
        {active.map(a => (
          <Button key={a.field} appearance="subtle" onClick={() => remove(a.field)}>{`Remove filter: ${a.label}`}</Button>
        ))}
        {active.length > 1 ? <Button appearance="subtle" onClick={() => setFilters(f => ({ ...NO_FILTERS, search: f.search }))}>Clear all filters</Button> : null}
        <Text>{`Showing ${visible.length} of ${view.rows.length} issues`}</Text>
      </Inline>

      <DynamicTable head={head} rows={rows} rowsPerPage={25} emptyView={<Text>No issues match the filters.</Text>} />

      {selected ? (
        <Modal onClose={() => setSelected(null)} width="large">
          <ModalHeader>
            <ModalTitle>{`${selected.issueKey}: ${selected.summary}`}</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <Stack space="space.150">
              {GATE_NAMES.map(g => <GateRow key={g} gate={g} result={selected.gates[g]} />)}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button appearance="subtle" onClick={() => setSelected(null)}>Close</Button>
            <Button appearance="primary" onClick={() => router.open(`/browse/${selected.issueKey}`)}>Open issue</Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </Stack>
  );
};
