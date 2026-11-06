/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: the always-visible "Approval seal" entry in the issue's details column (readiness finding F-12).
 * It shows the seal state without opening the panel, and points to the panel for every action. It has no button; like
 * a panel load, its verify call records a new change it finds (a history row and the ledgerseal-cert property).
 *
 * @author Fahim Farook
 */

import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Lozenge, Spinner, Stack, Text } from '@forge/react';
import { invoke } from '@forge/bridge';
import { SPACE, TEXT_ROLE } from '@asymm/jira-ui';
import { buildContextView } from './view-model';

export const LedgerSealContext: React.FC = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        setResult(await invoke('verify-issue-api', {}));
      } catch (err) {
        console.error('LedgerSeal: seal state failed', err);
        setFailed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner size="small" />;
  const view = buildContextView({ loading: false, result, error: failed });
  return (
    <Stack space={SPACE.sub}>
      {view.lozenge && <Lozenge appearance={view.lozenge.appearance}>{view.lozenge.text}</Lozenge>}
      <Text as="span">{view.sentence}</Text>
      <Text as="span" size="small" color={TEXT_ROLE.secondary}>{view.hint}</Text>
    </Stack>
  );
};

export default LedgerSealContext;

ForgeReconciler.render(
  <React.StrictMode>
    <LedgerSealContext />
  </React.StrictMode>
);
