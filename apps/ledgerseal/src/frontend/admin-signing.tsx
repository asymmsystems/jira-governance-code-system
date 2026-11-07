/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal admin page tabs for code signing (ADR-016): "Signing codes" (the projects and the lockout) and
 * "Security alerts" (failed attempts, lockouts and their acknowledgement, and unlocking a person). Jira admins only;
 * every resolver checks that as the user. The view logic is in signing-view-model.ts.
 *
 * @author Fahim Farook
 */

import React, { useEffect, useState } from 'react';
import { Box, Button, Checkbox, Heading, Inline, SectionMessage, Spinner, Stack, Text, Textfield, User } from '@forge/react';
import { invoke } from '@forge/bridge';
import { NoteBox, SPACE, TEXT_ROLE } from '@asymm/jira-ui';
import { logFailure } from '../service/log';
import { buildAlertRows, buildSigningAdminView, parseProjectKeys } from './signing-view-model';
import { formatTime } from './view-model';

export const SigningCodesTab: React.FC = () => {
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [keys, setKeys] = useState<string>('');
  const [lockout, setLockout] = useState<string>('5');
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = (await invoke('signing-policy-get-api', {})) as any;
      setResponse(r);
      const v = buildSigningAdminView(false, r);
      setEnabled(v.enabled);
      setKeys(v.projectKeys);
      setLockout(v.lockout);
    } catch (err) {
      logFailure('could not load code signing', err);
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const view = buildSigningAdminView(loading, response);

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const r = (await invoke('signing-policy-set-api', { enabled, projectKeys: parseProjectKeys(keys), lockoutThreshold: Number(lockout) })) as any;
      setNotice(r?.ok ? 'Saved.' : r?.message || 'LedgerSeal could not save. Nothing was saved.');
      if (r?.ok) await load();
    } catch (err) {
      logFailure('could not save code signing', err);
      setNotice('LedgerSeal could not save. Nothing was saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (view.state === 'LOADING') return <Spinner size="small" />;
  if (view.state !== 'READY') {
    return (
      <SectionMessage appearance={view.state === 'NOT_ADMIN' ? 'warning' : 'error'}>
        <Text as="span">{view.message}</Text>
      </SectionMessage>
    );
  }
  return (
    <Stack space={SPACE.group}>
      <Heading size="small">Signing codes</Heading>
      <SectionMessage appearance={view.declarationPending ? 'warning' : 'information'}>
        <Text as="span">{view.message}</Text>
      </SectionMessage>
      <NoteBox>
        <Text as="span" size="small" weight="medium">
          Declaration version 2{view.declarationPending ? ' (draft, waiting for the owner\'s approval)' : ''}
        </Text>
        <Text as="span" size="small" color={TEXT_ROLE.secondary}>{view.declarationText}</Text>
      </NoteBox>
      <Checkbox
        value="enabled"
        isChecked={enabled}
        isDisabled={view.declarationPending}
        onChange={(e: any) => setEnabled(e.target.checked)}
        label="Code signing on in these projects"
      />
      <Stack space={SPACE.sub}>
        <Text as="span" size="small" weight="medium">Project keys (comma separated, at most 100)</Text>
        <Textfield name="projects" defaultValue={view.projectKeys} onChange={(e: any) => setKeys(e.target.value)} />
      </Stack>
      <Stack space={SPACE.sub}>
        <Text as="span" size="small" weight="medium">Lock a person out after this many failed attempts in a row (3 to 10)</Text>
        <Textfield name="lockout" type="number" defaultValue={view.lockout} onChange={(e: any) => setLockout(e.target.value)} />
      </Stack>
      <Text as="span" size="small" color={TEXT_ROLE.muted}>
        A code works once, for 5 minutes. LedgerSeal sends it through Jira, so Jira outgoing email must be on. {view.policyNote}
      </Text>
      {notice && <Text as="span">{notice}</Text>}
      <Box>
        <Button appearance="primary" isDisabled={saving} onClick={save}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>
    </Stack>
  );
};

export const SecurityAlertsTab: React.FC = () => {
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [reason, setReason] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setResponse(await invoke('signing-alerts-api', {}));
    } catch (err) {
      logFailure('could not load the alerts', err);
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (name: string, payload: any) => {
    setNotice(null);
    try {
      const r = (await invoke(name, payload)) as any;
      setNotice(r?.ok ? 'Done.' : r?.message || 'LedgerSeal could not do this. Nothing was saved.');
      if (r?.ok) await load();
    } catch (err) {
      logFailure('alert action failed', err);
      setNotice('LedgerSeal could not do this. Nothing was saved. Try again.');
    }
  };

  if (loading) return <Spinner size="small" />;
  if (!response || response.ok === false) {
    return (
      <SectionMessage appearance="warning">
        <Text as="span">{response?.message || 'LedgerSeal could not load the alerts. Try again.'}</Text>
      </SectionMessage>
    );
  }
  const rows = buildAlertRows(response);
  return (
    <Stack space={SPACE.group}>
      <Heading size="small">Security alerts</Heading>
      <Text as="span" size="small" color={TEXT_ROLE.secondary}>
        No email is sent for these alerts. Check this page. Each alert and each acknowledgement is kept in a hash-chained record.
      </Text>
      {notice && <Text as="span">{notice}</Text>}
      <Text as="span" weight="semibold">People locked out ({response.locked.length})</Text>
      <Stack space={SPACE.sub}>
        <Text as="span" size="small" weight="medium">Reason for unlocking (required)</Text>
        <Textfield name="unlock-reason" onChange={(e: any) => setReason(e.target.value)} />
      </Stack>
      {response.locked.map((p: any) => (
        <Inline key={p.accountId} space={SPACE.item} alignBlock="center" shouldWrap>
          {p.accountId ? <User accountId={p.accountId} /> : <Text as="span">an unknown user</Text>}
          <Text as="span" size="small" color={TEXT_ROLE.secondary}>since {formatTime(p.lockedAt)}</Text>
          <Button appearance="default" spacing="compact" isDisabled={!reason.trim() || !p.accountId} onClick={() => act('signing-unlock-api', { accountId: p.accountId, reason: reason.trim() })}>
            Unlock
          </Button>
        </Inline>
      ))}
      <Text as="span" weight="semibold">Open alerts ({rows.length})</Text>
      {rows.map(row => (
        <Inline key={String(row.seq)} space={SPACE.item} alignBlock="center" shouldWrap>
          <Text as="span" weight="medium">{row.title}</Text>
          {row.accountId && <User accountId={row.accountId} />}
          <Text as="span" size="small" color={TEXT_ROLE.secondary}>{row.at}{row.detail ? `, ${row.detail}` : ''}</Text>
          <Button appearance="subtle" spacing="compact" onClick={() => act('signing-alert-ack-api', { seq: row.seq })}>
            Acknowledge
          </Button>
        </Inline>
      ))}
    </Stack>
  );
};
