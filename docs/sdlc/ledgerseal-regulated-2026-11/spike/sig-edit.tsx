/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal Phase 1 spike S-1/S-3: the signature field's edit view (development only, removed after the spikes).
 * The typed code never becomes the field value; only the intent id is submitted.
 *
 * @author Fahim Farook
 */

import React, { useState } from 'react';
import ForgeReconciler, { Button, Stack, Text, Textfield } from '@forge/react';
// The @forge/react/jira export is this host tag; imported by name it needs moduleResolution node16
const CustomFieldEdit: any = 'CustomFieldEdit';
import { invoke, view } from '@forge/bridge';

const SignatureEdit: React.FC = () => {
  const [intentId, setIntentId] = useState<string>('');
  const [note, setNote] = useState<string>('Type any code, then Sign.');
  const sign = async () => {
    try {
      const r: any = await invoke('spike-intent', {});
      setIntentId(r?.intentId ?? '');
      setNote(`Signed (spike). Intent ${String(r?.intentId ?? '').slice(0, 10)}... issueKnown=${r?.issueKnown} type=${r?.extensionType}. Now submit.`);
    } catch (err: any) {
      setNote(`Sign failed: ${err?.name ?? 'Error'}`);
    }
  };
  return (
    <CustomFieldEdit onSubmit={() => view.submit(intentId)} hideActionButtons={false}>
      <Stack space="space.100">
        <Text>LedgerSeal signature (spike). {note}</Text>
        <Textfield name="spike-code" placeholder="Code (spike, not stored)" />
        <Button onClick={sign}>Sign</Button>
      </Stack>
    </CustomFieldEdit>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <SignatureEdit />
  </React.StrictMode>
);
