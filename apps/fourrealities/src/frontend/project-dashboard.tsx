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
  Lozenge,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  SectionMessage,
  Stack,
  Text,
  Textfield
} from '@forge/react';
import { router } from '@forge/bridge';
import { GATE_NAMES, GateName, IssueRow, ProjectDashboardView } from '../domain/models';
import { GATE_LABEL, raiText, rateText, riskAppearance } from '../ui/gate-text';
import { GateChips, GateRow } from './gate-row';

const RATE_OF: Record<GateName, (v: ProjectDashboardView) => number | null> = {
  intent: v => v.summary.m11IntentRate,
  process: v => v.summary.dodRate,
  code: v => v.summary.m29PullRequestRate,
  audit: v => v.summary.sealRate
};

const RISK_RANK: Record<IssueRow['risk'], number> = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4, UNRATED: 5 };

/** Rows sorted for triage: most missing evidence first, then lowest RAI. */
export function triageOrder(rows: IssueRow[]): IssueRow[] {
  const missing = (r: IssueRow) => GATE_NAMES.filter(g => r.gates[g].state === 'MISSING').length;
  return [...rows].sort((a, b) =>
    missing(b) - missing(a) || RISK_RANK[a.risk] - RISK_RANK[b.risk] || (a.rai ?? 101) - (b.rai ?? 101) || a.issueKey.localeCompare(b.issueKey));
}

export const ProjectDashboard: React.FC<{ view: ProjectDashboardView; onRefresh: () => void }> = ({ view, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [missingGate, setMissingGate] = useState<GateName | 'ALL'>('ALL');
  const [selected, setSelected] = useState<IssueRow | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return triageOrder(view.rows).filter(r =>
      (missingGate === 'ALL' || r.gates[missingGate].state === 'MISSING') &&
      (!q || r.issueKey.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q)));
  }, [view.rows, search, missingGate]);

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
      { key: 'assignee', content: 'Assignee', isSortable: true },
      { key: 'action', content: 'Action' }
    ]
  };

  const rows = visible.map(r => ({
    key: r.issueId,
    cells: [
      { key: r.issueKey, content: <Text>{r.issueKey}</Text> },
      { key: r.summary, content: <Text>{r.summary}</Text> },
      { key: 'gates', content: <GateChips gates={r.gates} /> },
      { key: r.rai === null ? '999' : String(r.rai).padStart(3, '0'), content: <Lozenge appearance={riskAppearance(r.risk)}>{raiText(r)}</Lozenge> },
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
                <Button appearance="subtle" onClick={() => setMissingGate(g)}>{`Show ${GATE_LABEL[g]} missing (${c.missing})`}</Button>
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

      <Inline space="space.100" alignBlock="center" shouldWrap>
        <Label labelFor="fr-search">Search key or summary</Label>
        <Textfield id="fr-search" value={search} onChange={(e: any) => setSearch(e.target?.value || '')} />
        {missingGate !== 'ALL' ? (
          <Button appearance="subtle" onClick={() => setMissingGate('ALL')}>{`Clear filter: ${GATE_LABEL[missingGate]} missing`}</Button>
        ) : null}
        <Text>{`Showing ${visible.length} of ${view.rows.length} issues`}</Text>
      </Inline>

      <DynamicTable head={head} rows={rows} rowsPerPage={25} emptyView={<Text>No issues match the filter.</Text>} />

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
