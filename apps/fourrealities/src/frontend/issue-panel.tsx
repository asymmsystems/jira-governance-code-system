/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: issue panel. Shows the four gates with sources; remediation links or records, never writes evidence.
 */

import React, { useState } from 'react';
import { Box, Button, Heading, Inline, Lozenge, SectionMessage, Stack, Text, User } from '@forge/react';
import { router } from '@forge/bridge';
import { ExceptionDecision, ExceptionNote, GATE_NAMES, GateExceptionState, GateName, IssueRow } from '../contract/data/models';
import { PanelAction, afterActionText, raiPartsText, raiText, recoveryText, riskAppearance } from '../ui/gate-text';
import { GateRow } from './gate-row';
import { DecisionModal, ExceptionModal, LinkDecisionModal } from './modals';

/**
 * Opens the issue so the user can act in the producer app's own panel.
 * FourRealities never writes seal or Definition of Done evidence itself.
 */
export const openProducerPanel = (issueKey: string): Promise<void> => router.open(`/browse/${issueKey}`);

export const ProducerLinks: React.FC<{ issueKey: string }> = ({ issueKey }) => (
  <>
    <Button appearance="default" onClick={() => openProducerPanel(issueKey)}>
      Open {issueKey}: LedgerSeal Audit Gate panel
    </Button>
    <Button appearance="default" onClick={() => openProducerPanel(issueKey)}>
      Open {issueKey}: DefinitionGuard Checklist panel
    </Button>
  </>
);

/** Who and why for an exception or a rework reason. The name comes from the UI Kit User component. */
export const NoteLine: React.FC<{ label: string; note: ExceptionNote }> = ({ label, note }) => (
  <Inline space="space.050" alignBlock="center" shouldWrap>
    <Text>{label} by</Text>
    <User accountId={note.recordedBy} />
    <Text>{`on ${note.recordedAt.slice(0, 10)}: ${note.reason}`}</Text>
  </Inline>
);

const ENDED: Record<string, string> = { REJECTED: 'Exception rejected', WITHDRAWN: 'Exception withdrawn', REVOKED: 'Exception revoked' };

/** The Code exception in words: who asked, who decided, when and why (ADR-001, Option C). */
export const ExceptionStateLine: React.FC<{ state: GateExceptionState }> = ({ state }) => {
  const requested = (
    <Inline space="space.050" alignBlock="center" shouldWrap>
      <Text>Requested by</Text>
      <User accountId={state.requestedBy} />
      <Text>{`on ${state.requestedAt.slice(0, 10)}: ${state.reason}`}</Text>
    </Inline>
  );
  if (state.status === 'REQUESTED') {
    return (
      <Stack space="space.050">
        {requested}
        <Text>Waiting for a project administrator who is not the requester or the assignee.</Text>
      </Stack>
    );
  }
  const decided = state.decidedBy ? (
    <Inline space="space.050" alignBlock="center" shouldWrap>
      <Text>{state.status === 'APPROVED' ? 'Approved by' : `${ENDED[state.status]} by`}</Text>
      <User accountId={state.decidedBy} />
      <Text>{`on ${String(state.decidedAt).slice(0, 10)}${state.status === 'APPROVED' ? '' : `: ${state.decisionReason}`}`}</Text>
    </Inline>
  ) : null;
  return (
    <Stack space="space.050">
      {requested}
      {decided}
      {state.migrated ? <Text>Approved before administrator approval was required.</Text> : null}
    </Stack>
  );
};

function gateNote(gate: GateName, row: IssueRow): React.ReactNode {
  if (gate === 'code' && row.codeException) {
    return <ExceptionStateLine state={row.codeException} />;
  }
  if (gate === 'process' && row.reworkLoops > 0) {
    return (
      <Stack space="space.050">
        <Text>{`Rework loops: ${row.reworkLoops}.`}</Text>
        {(row.reworkNoteCount || 0) > 1 ? <Text>{`${row.reworkNoteCount} rework reasons recorded. The latest is shown.`}</Text> : null}
        {row.reworkNote ? <NoteLine label="Rework reason" note={row.reworkNote} /> : null}
      </Stack>
    );
  }
  return undefined;
}

type OpenModal = 'none' | 'link' | 'code' | 'rework' | ExceptionDecision;

/**
 * onRow replaces the row in place after a write, so the panel stays mounted and its message
 * stays visible (B-17). onReload is the Refresh button only.
 */
export const IssuePanel: React.FC<{ row: IssueRow; onReload: () => void; onRow: (row: IssueRow) => void }> = ({ row, onReload, onRow }) => {
  const [open, setOpen] = useState<OpenModal>('none');
  const [message, setMessage] = useState<string | null>(null);

  const done = (action: PanelAction) => (after?: IssueRow) => {
    setOpen('none');
    setMessage(afterActionText(action, after));
    if (after) onRow(after);
  };

  const needsProducer = row.gates.audit.state === 'MISSING' || row.gates.process.state === 'MISSING';

  return (
    <Stack space="space.150">
      {message ? (
        <SectionMessage appearance="information" title="Recorded">
          <Text>{message}</Text>
        </SectionMessage>
      ) : null}

      <Inline space="space.100" alignBlock="center" shouldWrap>
        <Heading as="h4">Delivery evidence: {row.issueKey}</Heading>
        <Button appearance="subtle" onClick={onReload}>Refresh</Button>
      </Inline>

      {recoveryText(row) ? <Text>{recoveryText(row)}</Text> : null}

      <Box padding="space.100">
        <Stack space="space.150">
          {GATE_NAMES.map(g => (
            <GateRow key={g} gate={g} result={row.gates[g]} note={gateNote(g, row)} />
          ))}
        </Stack>
      </Box>

      <Inline space="space.100" alignBlock="center" shouldWrap>
        <Lozenge maxWidth="100%" appearance={riskAppearance(row.risk)}>{raiText(row)}</Lozenge>
        <Text>{raiPartsText(row)}</Text>
      </Inline>

      <Inline space="space.100" alignBlock="center" shouldWrap>
        {row.gates.intent.state === 'MISSING' ? (
          <Button appearance="primary" onClick={() => setOpen('link')}>Link decision record</Button>
        ) : null}
        {row.gates.code.state === 'MISSING' && row.gates.code.reason === 'PR_NONE' && row.codeException?.status !== 'REQUESTED' ? (
          <Button appearance="default" onClick={() => setOpen('code')}>Request Code exception</Button>
        ) : null}
        {row.codeException?.status === 'REQUESTED' ? (
          <>
            <Button appearance="default" onClick={() => setOpen('APPROVE')}>Approve exception</Button>
            <Button appearance="default" onClick={() => setOpen('REJECT')}>Reject exception</Button>
            <Button appearance="subtle" onClick={() => setOpen('WITHDRAW')}>Withdraw request</Button>
          </>
        ) : null}
        {row.codeException?.status === 'APPROVED' ? (
          <Button appearance="default" onClick={() => setOpen('REVOKE')}>Revoke exception</Button>
        ) : null}
        {row.reworkLoops > 0 ? (
          <Button appearance="default" onClick={() => setOpen('rework')}>Add rework reason</Button>
        ) : null}
        {needsProducer ? <ProducerLinks issueKey={row.issueKey} /> : null}
      </Inline>

      {open === 'link' ? (
        <LinkDecisionModal issueId={row.issueId} issueKey={row.issueKey} onClose={() => setOpen('none')} onDone={done('link')} />
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
    </Stack>
  );
};
