/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * CascadePlan: Admin policy configuration page.
 * Renders the admin page for Jira administrators to manage authorized approver groups.
 * Adheres to the Uniform Permission Management Standard using shared @asymm/jira-ui.
 */

import React, { useState, useEffect } from 'react';
import ForgeReconciler from '@forge/react';
import { invoke } from '@forge/bridge';
import {
  AdminPolicyPanel,
  buildAdminPolicyView,
  GroupChoice,
  savedGroups
} from '@asymm/jira-ui';

export const CascadePlanAdmin: React.FC = () => {
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [chosen, setChosen] = useState<GroupChoice[]>([]);
  const [results, setResults] = useState<GroupChoice[]>([]);
  const [query, setQuery] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = (await invoke('approver-policy-get-api', {})) as any;
      setResponse(r);
      setChosen(savedGroups(r));
    } catch (err) {
      console.error('Failed to load approver groups', err);
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const view = buildAdminPolicyView({
    loading,
    response,
    chosen,
    results,
    appName: 'CascadePlan',
    roleDescription: 'freeze delivery baseline, approve milestone variance, and manage plans'
  });

  const search = async () => {
    setNotice(null);
    try {
      const r = (await invoke('approver-group-search-api', { query })) as any;
      if (r?.ok) {
        setResults(r.groups);
      } else {
        setNotice(r?.message || 'CascadePlan could not search groups in Jira. Try again.');
      }
    } catch (err) {
      setNotice('CascadePlan could not search groups in Jira. Try again.');
    }
  };

  const save = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const r = (await invoke('approver-policy-set-api', { groupIds: chosen.map(g => g.groupId) })) as any;
      if (r?.ok) {
        setResponse(r);
        setChosen(savedGroups(r));
        setNotice('Saved.');
      } else {
        setNotice(r?.message || 'CascadePlan could not save. Nothing was saved.');
      }
    } catch (err) {
      console.error('Failed to save approver groups', err);
      setNotice('CascadePlan could not save. Nothing was saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPolicyPanel
      appName="CascadePlan"
      roleTitle="CascadePlan approvers"
      roleDescription="create, rename and delete plans, freeze baselines, and accept or reject scope changes"
      view={view}
      saving={saving}
      notice={notice}
      onSearchChange={setQuery}
      onSearch={search}
      onAddGroup={(g: GroupChoice) => setChosen(prev => (prev.some(x => x.groupId === g.groupId) ? prev : [...prev, g]))}
      onRemoveGroup={(id: string) => setChosen(prev => prev.filter(g => g.groupId !== id))}
      onSave={save}
    />
  );
};

export default CascadePlanAdmin;

ForgeReconciler.render(
  <React.StrictMode>
    <CascadePlanAdmin />
  </React.StrictMode>
);
