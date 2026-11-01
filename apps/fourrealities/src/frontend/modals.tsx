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

interface ModalProps {
  issueId: string;
  issueKey: string;
  onClose: () => void;
  onDone: () => void;
}

export const LinkDecisionModal: React.FC<ModalProps> = ({ issueId, issueKey, onClose, onDone }) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const res: any = await invoke('linkDecision', { issueId, issueKey, url, title });
      if (res?.success) {
        onDone();
      } else {
        setError(res?.error || 'The link was not added.');
      }
    } catch (err: any) {
      setError(err?.message || 'The link was not added.');
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
          <Textfield id="fr-link-url" value={url} onChange={(e: any) => setUrl(e.target?.value || '')} />
          <Label labelFor="fr-link-title">Page title</Label>
          <Textfield id="fr-link-title" value={title} onChange={(e: any) => setTitle(e.target?.value || '')} />
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
      const res: any = await invoke('recordException', { issueId, issueKey, type, reason, notes });
      if (res?.success) {
        onDone();
      } else {
        setError(res?.error || 'The exception was not recorded.');
      }
    } catch (err: any) {
      setError(err?.message || 'The exception was not recorded.');
    }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader>
        <ModalTitle>{type === 'CODE' ? `Record a Code exception for ${issueKey}` : `Record a rework reason for ${issueKey}`}</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <Stack space="space.100">
          <Text>
            {type === 'CODE'
              ? 'Say why this work needs no pull request. The gate shows "Excepted" with your name and reason. It never shows as passed.'
              : 'Say what caused the rework. This note does not change any gate.'}
          </Text>
          {error ? (
            <SectionMessage appearance="error" title="Not recorded">
              <Text>{error}</Text>
            </SectionMessage>
          ) : null}
          <Label labelFor="fr-exception-reason">Reason</Label>
          <Textfield id="fr-exception-reason" value={reason} onChange={(e: any) => setReason(e.target?.value || '')} />
          <Label labelFor="fr-exception-notes">Notes (optional)</Label>
          <Textfield id="fr-exception-notes" value={notes} onChange={(e: any) => setNotes(e.target?.value || '')} />
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button appearance="subtle" onClick={onClose}>Cancel</Button>
        <Button appearance="primary" onClick={submit}>{type === 'CODE' ? 'Save exception' : 'Save reason'}</Button>
      </ModalFooter>
    </Modal>
  );
};
