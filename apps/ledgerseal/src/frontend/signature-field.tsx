/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * The LedgerSeal signature field on the transition screen (ADR-018 option A). It shows the same seal or approval form
 * as the panel, asks the server for a single-use signing intent, and submits only the intent id as the field value.
 * The validator writes the seal when the transition is submitted. A code (code signing) never becomes the value.
 *
 * @author Fahim Farook
 */

import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Box, Button, Checkbox, RadioGroup, SectionMessage, Spinner, Stack, Text, TextArea, Textfield } from '@forge/react';
import { invoke, view } from '@forge/bridge';
import { MEANINGS } from '../domain/declaration';
import { logFailure } from '../service/log';
import { buildSignatureFieldView } from './signature-field-view-model';
import { buildSigningForm } from './signing-view-model';
import { SPACE } from '@asymm/jira-ui';

// The @forge/react/jira export is this host tag; importing it by name needs moduleResolution node16 (spike S-1)
const CustomFieldEdit: any = 'CustomFieldEdit';

export const SignatureField: React.FC = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [meaning, setMeaning] = useState<string>('APPROVAL');
  const [reason, setReason] = useState<string>('');
  const [agreed, setAgreed] = useState<boolean>(false);
  const [challenge, setChallenge] = useState<{ challengeId: string; expiresAt: string } | null>(null);
  const [code, setCode] = useState<string>('');
  const [intentId, setIntentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        setResult(await invoke('verify-issue-api', {}));
      } catch (err) {
        logFailure('signature field could not load', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const field = buildSignatureFieldView({ loading, result, error, intentId });
  const signing = buildSigningForm(result, { challengeId: challenge?.challengeId ?? null, expiresAt: challenge?.expiresAt ?? null, code });
  const reasonMissing = field.needsReason && reason.trim().length === 0;

  const sendCode = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const r = (await invoke('signing-code-request-api', { action: 'TRANSITION' })) as any;
      if (r?.ok) setChallenge({ challengeId: r.challengeId, expiresAt: r.expiresAt });
      else setNotice(r?.message || 'LedgerSeal could not send a code. Try again.');
    } catch (err) {
      logFailure('signature field code request failed', err);
      setNotice('LedgerSeal could not send a code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const sign = async () => {
    if (reasonMissing || !agreed || !signing.canSubmit) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = (await invoke('transition-sign-intent-api', {
        viewHash: result?.viewHash,
        signature: {
          meaning,
          declarationVersion: signing.declaration.version,
          declarationText: signing.declaration.text,
          reason: field.needsReason ? reason.trim() : undefined
        },
        signing: signing.needsCode && challenge ? { challengeId: challenge.challengeId, code: code.trim() } : undefined
      })) as any;
      if (r?.ok) {
        setIntentId(r.intentId);
        // Submit the value now: the dialog may not blur the field before the transition button (live, LSP-6)
        await view.submit(r.intentId);
      } else {
        setNotice(r?.message || 'LedgerSeal could not sign. Nothing was saved.');
      }
    } catch (err) {
      logFailure('signature field sign failed', err);
      setNotice('LedgerSeal could not sign. Nothing was saved. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const form = field.mode === 'SEAL' || field.mode === 'APPROVE';
  return (
    <CustomFieldEdit onSubmit={() => view.submit(intentId ?? '')} hideActionButtons={false}>
      <Stack space={SPACE.item}>
        {field.mode === 'LOADING' ? <Spinner size="small" /> : <Text as="span">{field.text}</Text>}
        {form && (
          <Stack space={SPACE.item}>
            <RadioGroup name="meaning" options={MEANINGS.map(m => ({ name: 'meaning', value: m.value, label: m.label }))} value={meaning} onChange={(e: any) => setMeaning(e.target.value)} />
            {field.needsReason && (
              <Stack space={SPACE.sub}>
                <Text as="span" size="small" weight="medium">{field.reasonLabel}</Text>
                <TextArea name="reason" onChange={(e: any) => setReason(e.target.value)} />
              </Stack>
            )}
            <Text as="span" size="small">{signing.declaration.text}</Text>
            <Checkbox value="agreed" isChecked={agreed} onChange={(e: any) => setAgreed(e.target.checked)} label="I agree to the declaration above." />
            {signing.blockedText && (
              <SectionMessage appearance="warning">
                <Text as="span">{signing.blockedText}</Text>
              </SectionMessage>
            )}
            {signing.needsCode && !signing.blockedText && (
              <Stack space={SPACE.sub}>
                <Box>
                  <Button appearance="default" isDisabled={busy} onClick={sendCode}>
                    {challenge ? 'Send a new code' : 'Send me a code'}
                  </Button>
                </Box>
                {signing.sentText && <Text as="span" size="small">{signing.sentText}</Text>}
                {challenge && <Textfield key={`code-${challenge.challengeId}`} name="signing-code" placeholder="Code from the email" onChange={(e: any) => setCode(e.target.value)} />}
              </Stack>
            )}
            <Box>
              <Button appearance="primary" isDisabled={busy || reasonMissing || !agreed || !signing.canSubmit} onClick={sign}>
                {busy ? 'Signing...' : 'Sign'}
              </Button>
            </Box>
          </Stack>
        )}
        {notice && <Text as="span">{notice}</Text>}
      </Stack>
    </CustomFieldEdit>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <SignatureField />
  </React.StrictMode>
);
