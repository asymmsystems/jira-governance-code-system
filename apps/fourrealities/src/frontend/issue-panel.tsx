/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: issue panel. Shows the four gates with sources; remediation links or records, never writes evidence.
 */

import React, { useState } from 'react';
import { Box, Button, Heading, Inline, Lozenge, SectionMessage, Stack, Text, User } from '@forge/react';
import { router } from '@forge/bridge';
import { ExceptionNote, GATE_NAMES, GateName, IssueRow } from '../contract/data/models';
import { raiText, recoveryText, riskAppearance } from '../ui/gate-text';
import { GateRow } from './gate-row';
import { ExceptionModal, LinkDecisionModal } from './modals';

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

function gateNote(gate: GateName, row: IssueRow): React.ReactNode {
  if (gate === 'code' && row.exception) {
    return <NoteLine label="Excepted" note={row.exception} />;
  }
  if (gate === 'process' && row.reworkLoops > 0) {
    return (
      <Stack space="space.050">
        <Text>{`Rework loops: ${row.reworkLoops}.`}</Text>
        {row.reworkNote ? <NoteLine label="Rework reason" note={row.reworkNote} /> : null}
      </Stack>
    );
  }
  return undefined;
}

type OpenModal = 'none' | 'link' | 'code' | 'rework';

export const IssuePanel: React.FC<{ row: IssueRow; onReload: () => void }> = ({ row, onReload }) => {
  const [open, setOpen] = useState<OpenModal>('none');
  const [message, setMessage] = useState<string | null>(null);

  const done = (text: string) => {
    setOpen('none');
    setMessage(text);
    onReload();
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
        <Lozenge appearance={riskAppearance(row.risk)}>{raiText(row)}</Lozenge>
        <Text>{`${row.applicableGates} of 4 gates rated`}</Text>
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
        {row.gates.intent.state === 'MISSING' ? (
          <Button appearance="primary" onClick={() => setOpen('link')}>Link decision record</Button>
        ) : null}
        {row.gates.code.state === 'MISSING' && row.gates.code.reason === 'PR_NONE' ? (
          <Button appearance="default" onClick={() => setOpen('code')}>Record Code exception</Button>
        ) : null}
        {row.reworkLoops > 0 ? (
          <Button appearance="default" onClick={() => setOpen('rework')}>Add rework reason</Button>
        ) : null}
        {needsProducer ? <ProducerLinks issueKey={row.issueKey} /> : null}
      </Inline>

      {open === 'link' ? (
        <LinkDecisionModal issueId={row.issueId} issueKey={row.issueKey} onClose={() => setOpen('none')} onDone={() => done('Link added. The gates were read again.')} />
      ) : null}
      {open === 'code' || open === 'rework' ? (
        <ExceptionModal
          issueId={row.issueId}
          issueKey={row.issueKey}
          type={open === 'code' ? 'CODE' : 'REWORK'}
          onClose={() => setOpen('none')}
          onDone={() => done(open === 'code' ? 'Exception recorded. The gates were read again.' : 'Rework reason recorded.')}
        />
      ) : null}
    </Stack>
  );
};
