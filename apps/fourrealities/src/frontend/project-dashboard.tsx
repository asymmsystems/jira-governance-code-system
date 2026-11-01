/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: project dashboard. Triage and deep links only; remediation lives in the issue panel.
 */

import React, { useMemo, useState } from 'react';
import {
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
  ProgressBar,
  SectionMessage,
  Select,
  Stack,
  Text,
  Textfield,
  Tooltip,
  Badge
} from '@forge/react';
import { router } from '@forge/bridge';
import { GATE_NAMES, GateCount, GateName, IssueRow, ProjectDashboardView, RiskLevel } from '../contract/data/models';
import { GATE_LABEL, raiText, rateText, riskAppearance } from '../ui/gate-text';
import { DashboardFilters, FilterField, GATE_FILTER_OPTIONS, PRESETS, RISK_WORD, presetFilters, toggleRisk, NO_FILTERS, activeFilters, applyFilters, filterOptions, missingGateLabel } from '../ui/filters';
import { priorityActions, triageOrder } from '../ui/triage';
import { TREND_WEEKS, chartData, recentWeeks, trendNotice, trendTableRows } from '../ui/trend';
import { GatePipeline, GateRow } from './gate-row';
import { GATE_QUESTION, auditReadiness, driftText, heroDelta, weakestGate } from '../ui/pipeline';
import { AppSurface, Card, Column, StatusBanner, SubSection } from '../brand/layout';
import { TextChange } from './modals';

type Option<T extends string = string> = { label: string; value: T };
const asOption = (value: string | null): Option | null => (value === null ? null : { label: value, value });

const METRIC: Record<GateName, string> = {
  intent: 'Metric M11: share of rated issues traced to a decision record.',
  process: 'Metric DoD rate: share of rated done issues with a complete Definition of Done.',
  code: 'Metric M29: share of rated done issues with a merged pull request.',
  audit: 'Metric seal rate: share of rated done issues with a LedgerSeal record.'
};

const RISK_BUTTONS: Array<[RiskLevel, 'critical' | 'high' | 'medium' | 'low']> = [['CRITICAL', 'critical'], ['HIGH', 'high'], ['MEDIUM', 'medium'], ['LOW', 'low']];

function rateAppearance(rate: number | null): 'success' | 'moved' | 'removed' | 'default' {
  if (rate === null) return 'default';
  return rate >= 80 ? 'success' : rate >= 50 ? 'moved' : 'removed';
}

/** One reality card: question, rate, labelled progress bar, plain count, and an action only when something is missing (B-35). */
export const RealityCard: React.FC<{ gate: GateName; count: GateCount; onShowMissing: () => void }> = ({ gate, count, onShowMissing }) => {
  const of = count.found + count.missing;
  const rate = of === 0 ? null : Math.round((count.found * 100) / of);
  const counted = of === 0 ? 'No issue is rated for this gate yet.' : `${count.found} of ${of} rated issues have evidence`;
  return (
    <Card>
      <Stack space="space.100" alignInline="start">
        <Inline space="space.100" alignBlock="center" shouldWrap>
          <Tooltip content={METRIC[gate]}>
            <Heading as="h4">{GATE_LABEL[gate]}</Heading>
          </Tooltip>
          <Lozenge maxWidth="100%" appearance={rateAppearance(rate)}>{rateText(rate)}</Lozenge>
        </Inline>
        <Text>{GATE_QUESTION[gate]}</Text>
        {of > 0 ? <ProgressBar value={count.found / of} ariaLabel={`${GATE_LABEL[gate]}: ${counted}`} /> : null}
        <Text>{counted}</Text>
        {count.missing > 0 ? <Button appearance="subtle" onClick={onShowMissing}>{`Show ${count.missing} missing ${GATE_LABEL[gate]}`}</Button> : null}
      </Stack>
    </Card>
  );
};

/**
 * Weekly trend for the whole project (spec v2, D-4): a text table first, so the numbers are
 * readable in order, then a line chart of the same numbers.
 */
export const TrendPanel: React.FC<{ view: ProjectDashboardView }> = ({ view }) => {
  const points = recentWeeks(view.trend);
  const notice = trendNotice(points, view.generatedAt);
  return (
    <Card>
      <Stack space="space.100" alignInline="start">
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
    </Card>
  );
};

export const ProjectDashboard: React.FC<{ view: ProjectDashboardView; onRefresh: () => void; viewerAccountId?: string }> = ({ view, onRefresh, viewerAccountId }) => {
  const [filters, setFilters] = useState<DashboardFilters>(NO_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const options = useMemo(() => filterOptions(view.rows), [view.rows]);
  const visible = useMemo(() => applyFilters(triageOrder(view.rows), filters), [view.rows, filters]);
  const set = (patch: Partial<DashboardFilters>) => setFilters(f => ({ ...f, ...patch }));
  const remove = (field: FilterField) => set(field === 'risks' ? { risks: [] } : { [field]: null });
  const active = activeFilters(filters);
  const position = visible.findIndex(r => r.issueId === selectedId);
  const selected = position >= 0 ? visible[position] : view.rows.find(r => r.issueId === selectedId) || null;

  const { summary } = view;
  const readiness = auditReadiness(view.rows);
  const topActions = priorityActions(visible, 5);

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
      { key: 'key', content: 'Issue', isSortable: true, width: 7 },
      { key: 'summary', content: 'Summary', width: 18 },
      { key: 'gates', content: 'Gates', width: 34 },
      { key: 'rai', content: 'Alignment', isSortable: true, width: 9 },
      { key: 'finding', content: 'Top finding', width: 18 },
      // Not sortable: the table never orders people next to a score (B-21, H5). Use the Assignee filter.
      { key: 'assignee', content: 'Assignee', width: 8 },
      { key: 'action', content: 'Action', width: 6 }
    ]
  };

  const rows = visible.map(r => ({
    key: r.issueId,
    cells: [
      { key: r.issueKey, content: <Text>{r.issueKey}</Text> },
      { key: r.summary, content: <Text>{r.summary}</Text> },
      { key: 'gates', content: <GatePipeline gates={r.gates} /> },
      { key: r.rai === null ? '999' : String(r.rai).padStart(3, '0'), content: <Lozenge maxWidth="100%" appearance={riskAppearance(r.risk)}>{raiText(r)}</Lozenge> },
      { key: 'finding', content: <Text>{driftText(r)}</Text> },
      { key: r.assigneeName || 'Unassigned', content: <Text>{r.assigneeName || 'Unassigned'}</Text> },
      { key: 'action', content: <Button appearance="subtle" onClick={() => setSelectedId(r.issueId)}>Inspect</Button> }
    ]
  }));

  return (
    <AppSurface>
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

        <StatusBanner
          status={readiness.status}
          statusWord={readiness.statusWord}
          summary={readiness.summary}
          nextStep={readiness.nextStep}
        />

        <Inline space="space.150" shouldWrap>
          {GATE_NAMES.map(g => <RealityCard key={g} gate={g} count={summary.gates[g]} onShowMissing={() => set({ missingGate: g })} />)}
        </Inline>

        <Inline space="space.150" alignBlock="start" spread="space-between" shouldWrap>
          <Column>
            <Card>
              <Stack space="space.100" alignInline="start">
                <Inline alignBlock="center" space="space.100" shouldWrap>
                  <Heading as="h4">Priority actions</Heading>
                  <Badge>{topActions.length}</Badge>
                </Inline>
                {topActions.length === 0 ? (
                  <Text>All issues have complete gate evidence.</Text>
                ) : (
                  topActions.map((act, i) => (
                    <Stack key={act.issueKey} space="space.025" alignInline="start">
                      <Inline space="space.050" alignBlock="center" shouldWrap>
                        <Text>{`${i + 1}. ${act.issueKey}: ${act.nextStep}`}</Text>
                        <Button appearance="subtle" spacing="compact" onClick={() => setSelectedId(act.issueId)}>
                          Inspect
                        </Button>
                      </Inline>
                      {act.summary ? (
                        <SubSection>
                          <Text>{act.summary}</Text>
                        </SubSection>
                      ) : null}
                    </Stack>
                  ))
                )}
              </Stack>
            </Card>
          </Column>

          <Column>
            {/* B-21 (H5): the gate rates come first, the score after them. */}
            <Card>
              <Stack space="space.100" alignInline="start">
                <Inline space="space.150" alignBlock="center" shouldWrap>
                  <Heading as="h2">{summary.averageRAI === null ? 'Alignment: not rated yet' : `Alignment ${summary.averageRAI}%`}</Heading>
                  <Text>{`across ${summary.ratedIssues} rated issues (${summary.unratedIssues} unrated)`}</Text>
                </Inline>
                <Text>{heroDelta(view.trend)}</Text>
                {weakestGate(summary) ? <Text>{weakestGate(summary)}</Text> : null}
                <Inline space="space.100" alignBlock="center" shouldWrap>
                  <Text>Risk:</Text>
                  {RISK_BUTTONS.map(([level, key]) => (
                    <Button key={level} appearance={filters.risks.includes(level) ? 'primary' : 'default'} onClick={() => set({ risks: toggleRisk(filters.risks, level) })}>
                      {`${RISK_WORD[level]} ${summary.riskDistribution[key]}`}
                    </Button>
                  ))}
                </Inline>
                <Text>Alignment is the share of rated gates with evidence found, averaged over rated issues.</Text>
              </Stack>
            </Card>
          </Column>
        </Inline>

        <TrendPanel view={view} />

        <Card>
          <Stack space="space.100">
            <Inline space="space.100" alignBlock="end" shouldWrap>
              <Stack space="space.050">
                <Label labelFor="fr-search">Search key or summary</Label>
                <Textfield id="fr-search" onChange={(e: TextChange) => set({ search: e.target?.value || '' })} />
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

            <Inline space="space.100" alignBlock="center" spread="space-between" shouldWrap>
              <Inline space="space.050" alignBlock="center" shouldWrap>
                <Text>Views:</Text>
                {PRESETS.filter(p => p.name !== 'mine' || viewerAccountId).map(p => (
                  <Button key={p.name} appearance="default" onClick={() => setFilters(f => presetFilters(p.name, viewerAccountId || '', f.search))}>{p.label}</Button>
                ))}
              </Inline>
              <Inline space="space.050" alignBlock="center" shouldWrap>
                {active.map(a => (
                  <Button key={a.field} appearance="subtle" onClick={() => remove(a.field)}>{`Remove filter: ${a.label}`}</Button>
                ))}
                {active.length > 1 ? <Button appearance="subtle" onClick={() => setFilters(f => ({ ...NO_FILTERS, search: f.search }))}>Clear all filters</Button> : null}
                <Text>{`Showing ${visible.length} of ${view.rows.length} issues`}</Text>
              </Inline>
            </Inline>
          </Stack>
        </Card>

        <DynamicTable head={head} rows={rows} rowsPerPage={25} emptyView={<Text>No issues match the filters.</Text>} />

        <Text>Alignment is calculated across rated gates only.</Text>

        {selected ? (
          <Modal onClose={() => setSelectedId(null)} width="large">
            <ModalHeader>
              <ModalTitle>{`${selected.issueKey}: ${selected.summary}`}</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <Stack space="space.150">
                <GatePipeline gates={selected.gates} />
              <Text>{driftText(selected)}</Text>
              {GATE_NAMES.map(g => <GateRow key={g} gate={g} result={selected.gates[g]} />)}
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button appearance="subtle" isDisabled={position <= 0} onClick={() => setSelectedId(visible[position - 1].issueId)}>Previous issue</Button>
            <Button appearance="subtle" isDisabled={position < 0 || position >= visible.length - 1} onClick={() => setSelectedId(visible[position + 1].issueId)}>Next issue</Button>
            <Button appearance="subtle" onClick={() => setSelectedId(null)}>Close</Button>
            <Button appearance="primary" onClick={() => router.open(`/browse/${selected.issueKey}`)}>Open issue</Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </Stack>
  </AppSurface>
  );
};
