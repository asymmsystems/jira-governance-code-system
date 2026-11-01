/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: remediation modals. Fields open empty; nothing that counts as evidence is pre-filled.
 */

import React, { useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Label,
  SectionMessage,
  Stack,
  Text,
  Textfield
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { DecideExceptionPayload, ExceptionDecision, IssueRow, LinkDecisionPayload, RecordExceptionPayload, WriteResult } from '../contract/data/models';
import { messageOf } from '../contract/data/errors';

/** The change event a UI Kit Textfield sends. */
export type TextChange = { target?: { value?: string } };

interface ModalProps {
  issueId: string;
  issueKey: string;
  onClose: () => void;
  /** Called with the re-evaluated row when the resolver returns one. */
  onDone: (row?: IssueRow) => void;
}

export const LinkDecisionModal: React.FC<ModalProps> = ({ issueId, issueKey, onClose, onDone }) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const res = (await invoke<LinkDecisionPayload, WriteResult>('linkDecision', { issueId, issueKey, url, title })) as WriteResult | undefined;
      if (res?.success) {
        onDone(res.row);
      } else {
        setError(res?.error || 'The link was not added.');
      }
    } catch (err) {
      setError(messageOf(err, 'The link was not added.'));
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader>
        <ModalTitle>Link a decision record to {issueKey}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <Stack space="space.100">
          <Text>Add the address of a Confluence page on this site that records the decision.</Text>
          {error ? (
            <SectionMessage appearance="error" title="Not added">
              <Text>{error}</Text>
            </SectionMessage>
          ) : null}
          <Label labelFor="fr-link-url">Page address</Label>
          <Textfield id="fr-link-url" onChange={(e: TextChange) => setUrl(e.target?.value || '')} />
          <Label labelFor="fr-link-title">Page title</Label>
          <Textfield id="fr-link-title" onChange={(e: TextChange) => setTitle(e.target?.value || '')} />
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button appearance="subtle" onClick={onClose}>Cancel</Button>
        <Button appearance="primary" onClick={submit}>Add link</Button>
      </ModalFooter>
    </Modal>
  );
};

export const ExceptionModal: React.FC<ModalProps & { type: 'CODE' | 'REWORK' }> = ({ issueId, issueKey, type, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const res = (await invoke<RecordExceptionPayload, WriteResult>('recordException', { issueId, issueKey, type, reason, notes })) as WriteResult | undefined;
      if (res?.success) {
        onDone(res.row);
      } else {
        setError(res?.error || 'The exception was not recorded.');
      }
    } catch (err) {
      setError(messageOf(err, 'The exception was not recorded.'));
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader>
        <ModalTitle>{type === 'CODE' ? `Request a Code exception for ${issueKey}` : `Record a rework reason for ${issueKey}`}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <Stack space="space.100">
          <Text>
            {type === 'CODE'
              ? 'Say why this work needs no pull request. A project administrator who is not you or the assignee must approve the request. Until then the Code gate stays "Evidence missing".'
              : 'Say what caused the rework. This note does not change any gate.'}
          </Text>
          {error ? (
            <SectionMessage appearance="error" title="Not recorded">
              <Text>{error}</Text>
            </SectionMessage>
          ) : null}
          <Label labelFor="fr-exception-reason">Reason</Label>
          <Textfield id="fr-exception-reason" onChange={(e: TextChange) => setReason(e.target?.value || '')} />
          <Label labelFor="fr-exception-notes">Notes (optional)</Label>
          <Textfield id="fr-exception-notes" onChange={(e: TextChange) => setNotes(e.target?.value || '')} />
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button appearance="subtle" onClick={onClose}>Cancel</Button>
        <Button appearance="primary" onClick={submit}>{type === 'CODE' ? 'Save exception' : 'Save reason'}</Button>
      </ModalFooter>
    </Modal>
  );
};

const DECISION_TEXT: Record<ExceptionDecision, { title: string; button: string; field: string }> = {
  APPROVE: { title: 'Approve the Code exception for', button: 'Approve', field: 'Comment (optional)' },
  REJECT: { title: 'Reject the Code exception for', button: 'Reject', field: 'Reason (15 to 500 characters)' },
  REVOKE: { title: 'Revoke the Code exception for', button: 'Revoke', field: 'Reason (15 to 500 characters)' },
  WITHDRAW: { title: 'Withdraw your exception request for', button: 'Withdraw', field: 'Comment (optional)' }
};

/** Approve, reject, revoke or withdraw. FourRealities checks the rules on the server. */
export const DecisionModal: React.FC<ModalProps & { decision: ExceptionDecision }> = ({ issueId, issueKey, decision, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const text = DECISION_TEXT[decision];

  const submit = async () => {
    setError(null);
    try {
      const res = (await invoke<DecideExceptionPayload, WriteResult>('decideException', { issueId, issueKey, decision, reason })) as WriteResult | undefined;
      if (res?.success) {
        onDone(res.row);
      } else {
        setError(res?.error || 'The decision was not recorded.');
      }
    } catch (err) {
      setError(messageOf(err, 'The decision was not recorded.'));
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader>
        <ModalTitle>{`${text.title} ${issueKey}`}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <Stack space="space.100">
          {error ? (
            <SectionMessage appearance="error" title="Not recorded">
              <Text>{error}</Text>
            </SectionMessage>
          ) : null}
          <Label labelFor="fr-decision-reason">{text.field}</Label>
          <Textfield id="fr-decision-reason" onChange={(e: TextChange) => setReason(e.target?.value || '')} />
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button appearance="subtle" onClick={onClose}>Cancel</Button>
        <Button appearance="primary" onClick={submit}>{text.button}</Button>
      </ModalFooter>
    </Modal>
  );
};
