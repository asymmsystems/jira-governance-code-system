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
import ForgeReconciler from '@forge/react';
import { invoke } from '@forge/bridge';
import { AdminPolicyPanel, buildAdminPolicyView, GroupChoice, savedGroups } from '@asymm/jira-ui';

export const DefinitionGuardAdmin: React.FC = () => {
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState<GroupChoice[]>([]);
  const [results, setResults] = useState<GroupChoice[]>([]);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    invoke('authority-policy-get', {}).then((r: any) => {
      setResponse(r);
      setChosen(savedGroups(r));
      setLoading(false);
    });
  }, []);

  const view = buildAdminPolicyView({
    loading,
    response,
    chosen,
    results,
    appName: 'DefinitionGuard',
    roleDescription: 'baseline criteria, sign off Definition of Done, and authorize deviations'
  });

  return (
    <AdminPolicyPanel
      appName="DefinitionGuard"
      roleTitle="DefinitionGuard approvers"
      roleDescription="baseline criteria, sign off Definition of Done, and authorize deviations"
      view={view}
      saving={saving}
      notice={notice}
      onSearchChange={setQuery}
      onSearch={async () => {
        const res: any = await invoke('authority-group-search', { query });
        if (res?.ok) setResults(res.groups);
      }}
      onAddGroup={g => setChosen(prev => (prev.some(x => x.groupId === g.groupId) ? prev : [...prev, g]))}
      onRemoveGroup={id => setChosen(prev => prev.filter(g => g.groupId !== id))}
      onSave={async () => {
        setSaving(true);
        const res: any = await invoke('authority-policy-set', { groupIds: chosen.map(g => g.groupId) });
        if (res?.ok) setNotice('Saved.');
        setSaving(false);
      }}
    />
  );
};

export default DefinitionGuardAdmin;

ForgeReconciler.render(
  <React.StrictMode>
    <DefinitionGuardAdmin />
  </React.StrictMode>
);
