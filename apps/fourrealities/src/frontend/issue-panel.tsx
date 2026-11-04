/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: issue panel. Shows the four gates with sources; remediation links or records, never writes evidence.
 */

import React, { useState } from 'react';
import { Button, Inline, Lozenge, SectionMessage, Stack, Text } from '@forge/react';
import { router } from '@forge/bridge';
import { ExceptionDecision, ExceptionNote, GATE_NAMES, GateExceptionState, GateName, IssueRow } from '../contract/data/models';
import { PanelAction, afterActionText, raiPartsText, raiText, recoveryText, riskAppearance } from '../ui/gate-text';
import { GatePipeline, GateRow } from './gate-row';
import { alignmentText, driftText, issueReadiness, nextActionText, scoreParts } from '../ui/pipeline';
import { SPACE, TEXT_ROLE } from '../brand/brand';
import { ActionRow, AppSurface, AttributionLine, ListRow, NoteBox, PanelHeader, Section, SubSection, SummaryBlock } from '../brand/layout';
import { DecisionModal, ExceptionModal, LinkDecisionModal, ReviewModal } from './modals';

/**
 * Opens the issue so the user can act in the producer app's own panel.
 * FourRealities never writes seal or Definition of Done evidence itself.
 */
export const openProducerPanel = (issueKey: string): Promise<void> => router.open(`/browse/${issueKey}`);

export const ProducerLinks: React.FC<{ issueKey: string }> = ({ issueKey }) => (
  <>
    <Button appearance="subtle" spacing="compact" iconAfter="shortcut" onClick={() => openProducerPanel(issueKey)}>
      Open {issueKey}: LedgerSeal Audit Gate panel
    </Button>
    <Button appearance="subtle" spacing="compact" iconAfter="shortcut" onClick={() => openProducerPanel(issueKey)}>
      Open {issueKey}: DefinitionGuard Checklist panel
    </Button>
  </>
);

/** Who and why for an exception or a rework reason. The name comes from the UI Kit User component. */
export const NoteLine: React.FC<{ label: string; note: ExceptionNote }> = ({ label, note }) => (
  <AttributionLine
    prefix={`${label} by`}
    accountId={note.recordedBy}
    suffix={`on ${note.recordedAt.slice(0, 10)}: ${note.reason}`}
  />
);

const ENDED: Record<string, string> = { REJECTED: 'Exception rejected', WITHDRAWN: 'Exception withdrawn', REVOKED: 'Exception revoked' };

/** The Code exception in words: who asked, who decided, when and why (ADR-001, Option C). */
export const ExceptionStateLine: React.FC<{ state: GateExceptionState }> = ({ state }) => {
  const requested = (
    <AttributionLine
      prefix="Requested by"
      accountId={state.requestedBy}
      suffix={`on ${state.requestedAt.slice(0, 10)}: ${state.reason}`}
    />
  );
  if (state.status === 'REQUESTED') {
    return (
      <Stack space={SPACE.sub}>
        {requested}
        <Text as="span" size="small" color={TEXT_ROLE.secondary}>
          Waiting for a project or Jira administrator who is not the requester or the assignee.
        </Text>
      </Stack>
    );
  }
  const decided = state.decidedBy ? (
    <AttributionLine
      prefix={state.status === 'APPROVED' ? 'Approved by' : `${ENDED[state.status]} by`}
      accountId={state.decidedBy}
      suffix={`on ${String(state.decidedAt).slice(0, 10)}${state.status === 'APPROVED' ? '' : `: ${state.decisionReason}`}`}
    />
  ) : null;
  return (
    <Stack space={SPACE.sub}>
      {requested}
      {decided}
      {state.migrated ? (
        <Text as="span" size="small" color={TEXT_ROLE.muted}>
          Approved before administrator approval was required.
        </Text>
      ) : null}
    </Stack>
  );
};

function gateNote(gate: GateName, row: IssueRow, onOpen: (m: OpenModal) => void): React.ReactNode {
  if (gate === 'code' && row.codeException) {
    return (
      <NoteBox>
        <ExceptionStateLine state={row.codeException} />
        {row.codeException.status === 'REQUESTED' ? (
          <ActionRow>
            <Button appearance="default" spacing="compact" onClick={() => onOpen('APPROVE')}>Approve exception</Button>
            <Button appearance="default" spacing="compact" onClick={() => onOpen('REJECT')}>Reject exception</Button>
            <Button appearance="subtle" spacing="compact" onClick={() => onOpen('WITHDRAW')}>Withdraw request</Button>
          </ActionRow>
        ) : row.codeException.status === 'APPROVED' ? (
          <ActionRow>
            <Button appearance="default" spacing="compact" onClick={() => onOpen('REVOKE')}>Revoke exception</Button>
          </ActionRow>
        ) : null}
      </NoteBox>
    );
  }
  if (gate === 'process' && row.reworkLoops > 0) {
    return (
      <NoteBox>
        <Stack space={SPACE.sub}>
          <Text as="span" size="small" weight="medium">{`Rework loops: ${row.reworkLoops}.`}</Text>
          {(row.reworkNoteCount || 0) > 1 ? (
            <Text as="span" size="small" color={TEXT_ROLE.muted}>{`${row.reworkNoteCount} rework reasons recorded. The latest is shown.`}</Text>
          ) : null}
          {row.reworkNote ? <NoteLine label="Rework reason" note={row.reworkNote} /> : null}
          <ActionRow>
            <Button appearance="default" spacing="compact" onClick={() => onOpen('rework')}>Add rework reason</Button>
          </ActionRow>
        </Stack>
      </NoteBox>
    );
  }
  return undefined;
}

type OpenModal = 'none' | 'link' | 'code' | 'rework' | 'review' | ExceptionDecision;

export interface IssuePanelProps {
  readonly row: IssueRow;
  readonly onReload: () => void;
  readonly onRow: (row: IssueRow) => void;
  readonly compact?: boolean;
  readonly defaultCollapsed?: boolean;
}

/**
 * onRow replaces the row in place after a write, so the panel stays mounted and its message
 * stays visible (B-17). onReload is the Refresh button only.
 */
export const IssuePanel: React.FC<IssuePanelProps> = ({
  row,
  onReload,
  onRow,
  compact = false,
  defaultCollapsed = true
}) => {
  const [open, setOpen] = useState<OpenModal>('none');
  const [message, setMessage] = useState<string | null>(null);
  const [why, setWhy] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(!compact);

  const done = (action: PanelAction) => (after?: IssueRow) => {
    setOpen('none');
    setMessage(afterActionText(action, after));
    if (after) onRow(after);
  };

  const needsProducer = row.gates.audit.state === 'MISSING' || row.gates.process.state === 'MISSING';
  const readiness = issueReadiness(row);
  const canLinkIntent = row.gates.intent.state === 'MISSING';
  const canRequestCodeException = row.gates.code.state === 'MISSING' && row.gates.code.reason === 'PR_NONE' && row.codeException?.status !== 'REQUESTED';
  const hasSummaryActions = canLinkIntent || canRequestCodeException || needsProducer;

  const hasDetailActions =
    (canLinkIntent && canRequestCodeException) ||
    (row.gates.code.state === 'FOUND' && row.gates.code.reason === 'PR_MERGED');

  // Compact view for the issue context sidebar (B-38): the summary block only, findings on demand.
  if (!expanded) {
    return (
      <AppSurface compact>
        {message ? (
          <SectionMessage appearance="information" title="Recorded">
            <Text as="span">{message}</Text>
          </SectionMessage>
        ) : null}
        <SummaryBlock>
          <GatePipeline gates={row.gates} />
          <Inline space={SPACE.item} alignBlock="center" shouldWrap>
            <Text as="span" weight="semibold">{alignmentText(row)}</Text>
            {row.rai !== null ? (
              <Lozenge maxWidth="100%" appearance={riskAppearance(row.risk)} isBold>{`${row.risk} risk`}</Lozenge>
            ) : null}
          </Inline>
          <Text as="span" size="small" color={TEXT_ROLE.secondary}>{nextActionText(row) || driftText(row)}</Text>
          <ActionRow>
            <Button appearance="default" spacing="compact" onClick={() => setExpanded(true)}>See all findings</Button>
          </ActionRow>
        </SummaryBlock>
      </AppSurface>
    );
  }

  return (
    <AppSurface compact={compact}>
      {message ? (
        <SectionMessage appearance="information" title="Recorded">
          <Text as="span">{message}</Text>
        </SectionMessage>
      ) : null}

      <PanelHeader
        title="Four Realities"
        statusText={readiness.statusWord}
        statusAppearance={readiness.appearance}
        action={
          <Inline space={SPACE.sub} alignBlock="center" shouldWrap>
            <Button appearance="default" spacing="compact" iconBefore="refresh" onClick={onReload}>Refresh</Button>
            {compact ? <Button appearance="subtle" spacing="compact" onClick={() => setExpanded(false)}>Hide findings</Button> : null}
          </Inline>
        }
      />

      <SummaryBlock>
        <GatePipeline gates={row.gates} />
        <Stack space={SPACE.sub}>
          <Text as="span" weight="medium">{driftText(row)}</Text>
          {nextActionText(row) ? (
            <Text as="span" weight="semibold" color={TEXT_ROLE.accentTeal}>{nextActionText(row)}</Text>
          ) : null}
          {recoveryText(row) ? (
            <Text as="span" size="small" color={TEXT_ROLE.secondary}>{recoveryText(row)}</Text>
          ) : null}
        </Stack>

        {hasSummaryActions ? (
          <ActionRow>
            {canLinkIntent ? (
              <Button appearance="primary" onClick={() => setOpen('link')}>Link decision record</Button>
            ) : canRequestCodeException ? (
              <Button appearance="primary" onClick={() => setOpen('code')}>Request Code exception</Button>
            ) : null}
            {needsProducer ? <ProducerLinks issueKey={row.issueKey} /> : null}
          </ActionRow>
        ) : null}
      </SummaryBlock>

      <Section title="Gate findings" count={4} defaultCollapsed={compact ? false : defaultCollapsed}>
        <Stack space={SPACE.none}>
          {GATE_NAMES.map((g, idx) => (
            <ListRow key={g} divided={idx < GATE_NAMES.length - 1}>
              <GateRow gate={g} result={row.gates[g]} note={gateNote(g, row, setOpen)} />
            </ListRow>
          ))}
        </Stack>

        <NoteBox>
          <Inline space={SPACE.item} alignBlock="center" shouldWrap>
            <Lozenge maxWidth="100%" appearance={riskAppearance(row.risk)} isBold>{raiText(row)}</Lozenge>
            <Text as="span" size="small" color={TEXT_ROLE.secondary}>{raiPartsText(row)}</Text>
            {row.rai !== null ? (
              <Button appearance="subtle" spacing="compact" onClick={() => setWhy(!why)}>
                {why ? 'Hide the score parts' : `Why ${row.rai}%?`}
              </Button>
            ) : null}
          </Inline>
          {why ? (
            <SubSection>
              {scoreParts(row).map(line => (
                <Text as="span" key={line} size="small" color={TEXT_ROLE.secondary}>{line}</Text>
              ))}
            </SubSection>
          ) : null}
        </NoteBox>

        {hasDetailActions ? (
          <ActionRow>
            {canLinkIntent && canRequestCodeException ? (
              <Button appearance="default" onClick={() => setOpen('code')}>Request Code exception</Button>
            ) : null}
            {row.gates.code.state === 'FOUND' && row.gates.code.reason === 'PR_MERGED' ? (
              <Button appearance="default" onClick={() => setOpen('review')}>Request retrospective review</Button>
            ) : null}
          </ActionRow>
        ) : null}
      </Section>

      {open === 'link' ? (
        <LinkDecisionModal issueId={row.issueId} issueKey={row.issueKey} onClose={() => setOpen('none')} onDone={done('link')} />
      ) : null}
      {open === 'review' ? (
        <ReviewModal issueId={row.issueId} issueKey={row.issueKey} onClose={() => setOpen('none')} onDone={done('review')} />
      ) : null}
      {open === 'code' || open === 'rework' ? (
        <ExceptionModal
          issueId={row.issueId}
          issueKey={row.issueKey}
          type={open === 'code' ? 'CODE' : 'REWORK'}
          onClose={() => setOpen('none')}
          onDone={done(open === 'code' ? 'code' : 'rework')}
        />
      ) : null}
      {open === 'APPROVE' || open === 'REJECT' || open === 'REVOKE' || open === 'WITHDRAW' ? (
        <DecisionModal
          issueId={row.issueId}
          issueKey={row.issueKey}
          decision={open}
          onClose={() => setOpen('none')}
          onDone={done('decision')}
        />
      ) : null}
    </AppSurface>
  );
};
