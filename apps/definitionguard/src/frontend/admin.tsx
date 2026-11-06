/**
 * DefinitionGuard: Admin policy configuration page.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Renders the admin page for Jira administrators to manage authorized approver groups.
 * Adheres to the Uniform Permission Management Standard using shared @asymm/jira-ui.
 */
import React, { useState, useEffect } from 'react';
import ForgeReconciler, { SectionMessage, Stack, Text } from '@forge/react';
import { invoke } from '@forge/bridge';
import { AdminPolicyPanel, buildAdminPolicyView, GroupChoice, savedGroups, SPACE } from '@asymm/jira-ui';
import { APPROVER_ROLE_DESCRIPTION, loadPolicy, saveOutcome } from '../ui/admin-view';

export const DefinitionGuardAdmin: React.FC = () => {
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState<GroupChoice[]>([]);
  const [results, setResults] = useState<GroupChoice[]>([]);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPolicy(() => invoke('authority-policy-get', {})).then((r: any) => {
      setResponse(r);
      setChosen(r?.ok ? savedGroups(r) : []);
      setLoading(false);
    });
  }, []);

  const view = buildAdminPolicyView({
    loading,
    response,
    chosen,
    results,
    appName: 'DefinitionGuard',
    roleDescription: APPROVER_ROLE_DESCRIPTION
  });

  return (
    <Stack space={SPACE.item}>
    {error ? (
      <SectionMessage appearance="error" title="Not saved">
        <Text as="span">{error}</Text>
      </SectionMessage>
    ) : null}
    <AdminPolicyPanel
      appName="DefinitionGuard"
      roleTitle="DefinitionGuard approvers"
      roleDescription={APPROVER_ROLE_DESCRIPTION}
      view={view}
      saving={saving}
      notice={notice}
      onSearchChange={setQuery}
      onSearch={async () => {
        setError(null);
        try {
          const res: any = await invoke('authority-group-search', { query });
          if (res?.ok) setResults(res.groups);
          else setError(String(res?.message || 'DefinitionGuard could not search groups in Jira. Try again.'));
        } catch {
          setError('DefinitionGuard could not search groups in Jira. Try again.');
        }
      }}
      onAddGroup={g => setChosen(prev => (prev.some(x => x.groupId === g.groupId) ? prev : [...prev, g]))}
      onRemoveGroup={id => setChosen(prev => prev.filter(g => g.groupId !== id))}
      onSave={async () => {
        setSaving(true);
        const outcome = await saveOutcome(() => invoke('authority-policy-set', { groupIds: chosen.map(g => g.groupId) }));
        setNotice(outcome.notice);
        setError(outcome.error);
        if (outcome.notice) setResponse((await loadPolicy(() => invoke('authority-policy-get', {}))));
        setSaving(false);
      }}
    />
    </Stack>
  );
};

export default DefinitionGuardAdmin;

ForgeReconciler.render(
  <React.StrictMode>
    <DefinitionGuardAdmin />
  </React.StrictMode>
);
