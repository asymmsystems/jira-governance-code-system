/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: project dashboard. Triage and deep links only; remediation lives in the issue panel.
 */

import React, { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  DynamicTable,
  EmptyState,
  Heading,
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
  Tooltip
} from '@forge/react';
import { router } from '@forge/bridge';
import { GATE_NAMES, GateCount, GateName, IssueRow, ProjectDashboardView, RiskLevel } from '../contract/data/models';
import { GATE_LABEL, raiText, rateText, riskAppearance } from '../ui/gate-text';
import {
  DashboardFilters,
  FilterField,
  GATE_FILTER_OPTIONS,
  NO_FILTERS,
  PRESETS,
  RISK_WORD,
  activeFilters,
  applyFilters,
  filterOptions,
  missingGateLabel,
  presetFilters,
  toggleRisk
} from '../ui/filters';
import { priorityActions, triageOrder } from '../ui/triage';
import { TREND_WEEKS, chartData, recentWeeks, trendNotice, trendTableRows } from '../ui/trend';
import { GatePipeline, GateRow } from './gate-row';
import {
  GATE_QUESTION,
  auditReadiness,
  driftText,
  evidencedRatioText,
  heroDelta,
  issueGapsText,
  weakestGate
} from '../ui/pipeline';
import { SPACE, TEXT_ROLE } from '../brand/brand';
import {
  ActionRow,
  AppSurface,
  Card,
  FormField,
  FourColumnGrid,
  GateCard,
  ListRow,
  ModalContent,
  NoteBox,
  PageHeader,
  StatTile,
  StatusBanner,
  TableCard,
  ThreeColumnGrid,
  TwoColumnGrid
} from '../brand/layout';
import { TextChange } from './modals';

type Option<T extends string = string> = { label: string; value: T };
const asOption = (value: string | null): Option | null => (value === null ? null : { label: value, value });

const METRIC: Record<GateName, string> = {
  intent: 'Metric M11: share of rated issues traced to a decision record.',
  process: 'Metric DoD rate: share of rated done issues with a complete Definition of Done.',
  code: 'Metric M29: share of rated done issues with a merged pull request.',
  audit: 'Metric seal rate: share of rated done issues with a LedgerSeal record.'
};

const RISK_BUTTONS: Array<[RiskLevel, 'critical' | 'high' | 'medium' | 'low']> = [
  ['CRITICAL', 'critical'],
  ['HIGH', 'high'],
  ['MEDIUM', 'medium'],
  ['LOW', 'low']
];

const BALANCED_WIDTHS = { key: 9, summary: 19, gates: 32, rai: 11, finding: 15, assignee: 7, action: 7 } as const;
const WIDE_TEXT_WIDTHS = { key: 8, summary: 28, gates: 24, rai: 10, finding: 18, assignee: 6, action: 6 } as const;

function rateAppearance(rate: number | null): 'success' | 'moved' | 'removed' | 'default' {
  if (rate === null) return 'default';
  return rate >= 80 ? 'success' : rate >= 50 ? 'moved' : 'removed';
}

/** One reality card: full-width header with bold rate, muted question, progress bar, count, and clear action button (B-35). */
export const RealityCard: React.FC<{ gate: GateName; count: GateCount; onShowMissing: () => void }> = ({ gate, count, onShowMissing }) => {
  const of = count.found + count.missing;
  const rate = of === 0 ? null : Math.round((count.found * 100) / of);
  const counted = of === 0 ? 'No issue is rated for this gate yet.' : `${count.found} of ${of} rated issues have evidence`;
  return (
    <GateCard gate={gate}>
      <Stack space={SPACE.item}>
        <Inline spread="space-between" space={SPACE.item} alignBlock="center" shouldWrap>
          <Tooltip content={METRIC[gate]}>
            <Heading size="small" as="h4">{GATE_LABEL[gate]}</Heading>
          </Tooltip>
          <Lozenge maxWidth="100%" appearance={rateAppearance(rate)} isBold>{rateText(rate)}</Lozenge>
        </Inline>
        <Text size="small" color={TEXT_ROLE.secondary}>{GATE_QUESTION[gate]}</Text>
      </Stack>
      {of > 0 ? <ProgressBar value={count.found / of} ariaLabel={`${GATE_LABEL[gate]}: ${counted}`} /> : null}
      <Text size="small" weight="medium">{counted}</Text>
      {count.missing > 0 ? (
        <ActionRow>
          <Button appearance="default" spacing="compact" iconAfter="arrow-right" onClick={onShowMissing}>
            {`Show ${count.missing} missing ${GATE_LABEL[gate]}`}
          </Button>
        </ActionRow>
      ) : null}
    </GateCard>
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
      <Heading size="small" as="h4">{`Trend: last ${TREND_WEEKS} weeks (whole project)`}</Heading>
      {notice ? (
        <Text color={TEXT_ROLE.secondary}>{notice}</Text>
      ) : (
        <>
          <NoteBox>
            {trendTableRows(points).map(t => (
              <Text key={t.week} size="small" color={TEXT_ROLE.secondary}>{`${t.week}: ${t.rai}; ${t.intent}; ${t.process}; ${t.code}; ${t.audit}.`}</Text>
            ))}
          </NoteBox>
          <LineChart data={chartData(points)} xAccessor="week" yAccessor="percent" colorAccessor="series" title="Evidence found, percent of rated" />
        </>
      )}
    </Card>
  );
};

export const ProjectDashboard: React.FC<{ view: ProjectDashboardView; onRefresh: () => void; viewerAccountId?: string }> = ({ view, onRefresh, viewerAccountId }) => {
  const [filters, setFilters] = useState<DashboardFilters>(NO_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wideColumns, setWideColumns] = useState<boolean>(false);

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
  const widths = wideColumns ? WIDE_TEXT_WIDTHS : BALANCED_WIDTHS;

  if (view.rows.length === 0) {
    return (
      <AppSurface>
        <EmptyState
          header="No issues to rate yet"
          description="This project has no issues that FourRealities can read. Create or start work, then refresh."
          primaryAction={<Button appearance="primary" onClick={onRefresh}>Refresh</Button>}
        />
      </AppSurface>
    );
  }

  const head = {
    cells: [
      { key: 'key', content: 'Issue', isSortable: true, width: widths.key },
      { key: 'summary', content: 'Summary', width: widths.summary },
      { key: 'gates', content: 'Gates', width: widths.gates },
      { key: 'rai', content: 'Alignment', isSortable: true, width: widths.rai },
      { key: 'finding', content: 'Top finding', width: widths.finding },
      // Not sortable: the table never orders people next to a score (B-21, H5). Use the Assignee filter.
      { key: 'assignee', content: 'Assignee', width: widths.assignee },
      { key: 'action', content: 'Action', width: widths.action }
    ]
  };

  const rows = visible.map(r => ({
    key: r.issueId,
    cells: [
      {
        key: r.issueKey,
        content: (
          <Stack space={SPACE.tight} alignInline="start">
            <Text weight="semibold">{r.issueKey}</Text>
            {r.updated ? <Text size="small" color={TEXT_ROLE.muted}>{r.updated.slice(0, 10)}</Text> : null}
          </Stack>
        )
      },
      { key: r.summary, content: <Text>{r.summary}</Text> },
      { key: 'gates', content: <GatePipeline gates={r.gates} /> },
      {
        key: r.rai === null ? '999' : String(r.rai).padStart(3, '0'),
        content: (
          <Stack space={SPACE.tight} alignInline="start">
            <Lozenge maxWidth="100%" appearance={riskAppearance(r.risk)} isBold>{raiText(r)}</Lozenge>
            <Text size="small" color={TEXT_ROLE.muted}>{evidencedRatioText(r.gates)}</Text>
          </Stack>
        )
      },
      {
        key: 'finding',
        content: (
          <Stack space={SPACE.tight} alignInline="start">
            <Text size="small" weight="semibold">{issueGapsText(r.gates)}</Text>
            <Text size="small" color={TEXT_ROLE.secondary}>{driftText(r)}</Text>
          </Stack>
        )
      },
      {
        key: r.assigneeName || 'Unassigned',
        content: <Text size="small" color={r.assigneeName ? TEXT_ROLE.primary : TEXT_ROLE.muted}>{r.assigneeName || 'Unassigned'}</Text>
      },
      {
        key: 'action',
        content: <Button appearance="default" spacing="compact" onClick={() => setSelectedId(r.issueId)}>Inspect</Button>
      }
    ]
  }));

  const filterToolbar = (
    <Stack space={SPACE.group}>
      <FourColumnGrid>
        <FormField id="fr-search" label="Search key or summary">
          <Textfield id="fr-search" onChange={(e: TextChange) => set({ search: e.target?.value || '' })} />
        </FormField>
        <FormField id="fr-filter-assignee" label="Assignee">
          <Select
            id="fr-filter-assignee"
            isClearable
            placeholder="Any assignee"
            options={options.assignees.map(a => ({ label: a, value: a }))}
            value={asOption(filters.assignee)}
            onChange={(o: Option | null) => set({ assignee: o?.value ?? null })}
          />
        </FormField>
        {options.sprints.length > 0 ? (
          <FormField id="fr-filter-sprint" label="Sprint">
            <Select
              id="fr-filter-sprint"
              isClearable
              placeholder="Any sprint"
              options={options.sprints.map(s => ({ label: s, value: s }))}
              value={asOption(filters.sprint)}
              onChange={(o: Option | null) => set({ sprint: o?.value ?? null })}
            />
          </FormField>
        ) : null}
        <FormField id="fr-filter-gate" label="Gate">
          <Select
            id="fr-filter-gate"
            isClearable
            placeholder="Any gate"
            options={GATE_FILTER_OPTIONS}
            value={filters.missingGate ? { label: missingGateLabel(filters.missingGate), value: filters.missingGate } : null}
            onChange={(o: Option<GateName> | null) => set({ missingGate: o?.value ?? null })}
          />
        </FormField>
      </FourColumnGrid>

      <Inline space={SPACE.item} alignBlock="center" spread="space-between" shouldWrap>
        <Inline space={SPACE.sub} alignBlock="center" shouldWrap>
          <Text size="small" weight="semibold" color={TEXT_ROLE.secondary}>Views:</Text>
          {PRESETS.filter(p => p.name !== 'mine' || viewerAccountId).map(p => (
            <Button
              key={p.name}
              appearance="default"
              spacing="compact"
              onClick={() => setFilters(f => presetFilters(p.name, viewerAccountId || '', f.search))}
            >
              {p.label}
            </Button>
          ))}
        </Inline>
        {active.length > 0 ? (
          <Inline space={SPACE.sub} alignBlock="center" shouldWrap>
            {active.map(a => (
              <Button key={a.field} appearance="subtle" spacing="compact" iconAfter="cross" onClick={() => remove(a.field)}>
                {`Remove filter: ${a.label}`}
              </Button>
            ))}
            {active.length > 1 ? (
              <Button appearance="subtle" spacing="compact" onClick={() => setFilters(f => ({ ...NO_FILTERS, search: f.search }))}>
                Clear all filters
              </Button>
            ) : null}
          </Inline>
        ) : null}
      </Inline>
    </Stack>
  );

  return (
    <AppSurface>
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

      <PageHeader
        title="Four Realities"
        scopeBadge={view.projectKey}
        subtitle="Delivery assurance and audit readiness"
        metaText={`Read ${view.generatedAt.slice(0, 16).replace('T', ' ')} UTC`}
        action={
          <Button appearance="default" iconBefore="refresh" onClick={onRefresh}>
            Refresh
          </Button>
        }
      />

      <StatusBanner
        status={readiness.status}
        statusWord={readiness.statusWord}
        appearance={readiness.appearance}
        summary={readiness.summary}
        nextStep={readiness.nextStep}
      />

      <FourColumnGrid>
        {GATE_NAMES.map(g => (
          <RealityCard key={g} gate={g} count={summary.gates[g]} onShowMissing={() => set({ missingGate: g })} />
        ))}
      </FourColumnGrid>

      <TwoColumnGrid>
        <Card>
          <Inline spread="space-between" alignBlock="center" space={SPACE.item} shouldWrap>
            <Inline alignBlock="center" space={SPACE.item} shouldWrap>
              <Heading size="small" as="h4">Priority actions</Heading>
              <Badge>{topActions.length}</Badge>
            </Inline>
            <Text size="small" color={TEXT_ROLE.muted}>Highest-impact gaps</Text>
          </Inline>
          {topActions.length === 0 ? (
            <NoteBox>
              <Text color={TEXT_ROLE.secondary}>All issues have complete gate evidence.</Text>
            </NoteBox>
          ) : (
            <Stack space={SPACE.none}>
              {topActions.map((act, i) => (
                <ListRow
                  key={act.issueKey}
                  divided={i < topActions.length - 1}
                  action={
                    <Button appearance="default" spacing="compact" onClick={() => setSelectedId(act.issueId)}>
                      Inspect
                    </Button>
                  }
                >
                  <Stack space={SPACE.tight}>
                    <Inline space={SPACE.sub} alignBlock="center" shouldWrap>
                      <Text weight="semibold">{`${i + 1}. ${act.issueKey}:`}</Text>
                      <Text>{act.nextStep}</Text>
                    </Inline>
                    {act.summary ? (
                      <Text size="small" color={TEXT_ROLE.secondary}>{act.summary}</Text>
                    ) : null}
                  </Stack>
                </ListRow>
              ))}
            </Stack>
          )}
        </Card>

        {/* B-21 (H5): the gate rates come first, Coverage at a glance and Alignment after them. */}
        <Card>
          <Stack space={SPACE.tight}>
            <Heading size="small" as="h4">Coverage at a glance</Heading>
            <Text size="small" color={TEXT_ROLE.secondary}>Rated scope, alignment average, and risk distribution</Text>
          </Stack>
          <ThreeColumnGrid>
            <StatTile
              label="Rated average"
              value={
                <Heading size="small" as="h3">
                  {summary.averageRAI === null ? 'Alignment: not rated yet' : `Alignment ${summary.averageRAI}%`}
                </Heading>
              }
              caption={`across ${summary.ratedIssues} rated issues (${summary.unratedIssues} unrated)`}
            />
            <StatTile
              label="Rated scope"
              value={<Text size="large" weight="bold">{`${summary.ratedIssues} of ${summary.totalIssues}`}</Text>}
              caption={`${summary.unratedIssues} unrated`}
            />
            <StatTile
              label="Weekly change"
              value={<Text size="small" weight="semibold">{heroDelta(view.trend)}</Text>}
            />
          </ThreeColumnGrid>
          {weakestGate(summary) ? (
            <NoteBox>
              <Text size="small" weight="medium">{weakestGate(summary)}</Text>
            </NoteBox>
          ) : null}
          <Inline space={SPACE.item} alignBlock="center" shouldWrap>
            <Text size="small" weight="semibold" color={TEXT_ROLE.secondary}>Risk:</Text>
            {RISK_BUTTONS.map(([level, key]) => (
              <Button
                key={level}
                appearance="default"
                spacing="compact"
                isSelected={filters.risks.includes(level)}
                onClick={() => set({ risks: toggleRisk(filters.risks, level) })}
              >
                {`${RISK_WORD[level]} ${summary.riskDistribution[key]}`}
              </Button>
            ))}
          </Inline>
        </Card>
      </TwoColumnGrid>

      <TableCard
        title="Issue triage"
        count={visible.length}
        metaText={`Showing ${visible.length} of ${view.rows.length} issues`}
        headerAction={
          <Button
            appearance="default"
            spacing="compact"
            isSelected={wideColumns}
            onClick={() => setWideColumns(w => !w)}
          >
            {wideColumns ? 'Balanced columns' : 'Wide text columns'}
          </Button>
        }
        toolbar={filterToolbar}
      >
        <DynamicTable
          head={head}
          rows={rows}
          rowsPerPage={25}
          emptyView={<Text color={TEXT_ROLE.secondary}>No issues match the filters.</Text>}
        />
      </TableCard>

      <TrendPanel view={view} />

      <Text size="small" color={TEXT_ROLE.muted}>Alignment is calculated across rated gates only.</Text>

      {selected ? (
        <Modal onClose={() => setSelectedId(null)} width="large">
          <ModalHeader>
            <ModalTitle>{`${selected.issueKey}: ${selected.summary}`}</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <ModalContent>
              <NoteBox>
                <GatePipeline gates={selected.gates} />
                <Inline space={SPACE.item} alignBlock="center" shouldWrap>
                  <Lozenge maxWidth="100%" appearance={riskAppearance(selected.risk)} isBold>{raiText(selected)}</Lozenge>
                  <Text size="small" weight="semibold">{issueGapsText(selected.gates)}</Text>
                </Inline>
                <Text weight="medium">{driftText(selected)}</Text>
              </NoteBox>
              <Stack space={SPACE.none}>
                {GATE_NAMES.map((g, idx) => (
                  <ListRow key={g} divided={idx < GATE_NAMES.length - 1}>
                    <GateRow gate={g} result={selected.gates[g]} />
                  </ListRow>
                ))}
              </Stack>
            </ModalContent>
          </ModalBody>
          <ModalFooter>
            <Button appearance="default" isDisabled={position <= 0} onClick={() => setSelectedId(visible[position - 1].issueId)}>
              Previous issue
            </Button>
            <Button appearance="default" isDisabled={position < 0 || position >= visible.length - 1} onClick={() => setSelectedId(visible[position + 1].issueId)}>
              Next issue
            </Button>
            <Button appearance="subtle" onClick={() => setSelectedId(null)}>
              Close
            </Button>
            <Button appearance="primary" iconAfter="shortcut" onClick={() => router.open(`/browse/${selected.issueKey}`)}>
              Open issue
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </AppSurface>
  );
};
