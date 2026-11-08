/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * The LedgerSeal admin page: a Jira admin chooses the approver groups, and sets up code signing (ADR-016).
 * Adheres to the Uniform Permission Management Standard using AdminPolicyPanel from @asymm/jira-ui.
 *
 * @author Fahim Farook
 */

import React, { useState, useEffect } from 'react';
import ForgeReconciler, { Tab, TabList, TabPanel, Tabs } from '@forge/react';
import { SecurityAlertsTab, SigningCodesTab } from './admin-signing';
import { ApprovalRoutesTab } from './admin-routes';
import { invoke } from '@forge/bridge';
import { logFailure } from '../service/log';
import {
  AdminPolicyPanel,
  buildAdminPolicyView,
  GroupChoice,
  savedGroups
} from '@asymm/jira-ui';

export const ApproverGroupsTab: React.FC = () => {
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
      logFailure('could not load the approver groups', err);
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
    appName: 'LedgerSeal',
    roleDescription: 'seal, reseal, and revoke approval seals'
  });

  const search = async () => {
    setNotice(null);
    const r = (await invoke('approver-group-search-api', { query })) as any;
    if (r?.ok) setResults(r.groups);
    else setNotice(r?.message || 'LedgerSeal could not search the groups. Try again.');
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
        setNotice(r?.message || 'LedgerSeal could not save. Nothing was saved.');
      }
    } catch (err) {
      logFailure('could not save the approver groups', err);
      setNotice('LedgerSeal could not save. Nothing was saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPolicyPanel
      appName="LedgerSeal"
      roleTitle="Approver groups"
      roleDescription="seal, reseal, and revoke approval seals"
      view={view}
      saving={saving}
      notice={notice}
      onSearchChange={setQuery}
      onSearch={search}
      onAddGroup={g => setChosen(prev => (prev.some(x => x.groupId === g.groupId) ? prev : [...prev, g]))}
      onRemoveGroup={id => setChosen(prev => prev.filter(g => g.groupId !== id))}
      onSave={save}
    />
  );
};

/** The admin page: one tab per setting. */
export const LedgerSealAdmin: React.FC = () => (
  <Tabs id="ledgerseal-admin-tabs">
    <TabList>
      <Tab>Approver groups</Tab>
      <Tab>Signing codes</Tab>
      <Tab>Security alerts</Tab>
      <Tab>Approval routes</Tab>
    </TabList>
    <TabPanel>
      <ApproverGroupsTab />
    </TabPanel>
    <TabPanel>
      <SigningCodesTab />
    </TabPanel>
    <TabPanel>
      <SecurityAlertsTab />
    </TabPanel>
    <TabPanel>
      <ApprovalRoutesTab />
    </TabPanel>
  </Tabs>
);

export default LedgerSealAdmin;

ForgeReconciler.render(
  <React.StrictMode>
    <LedgerSealAdmin />
  </React.StrictMode>
);
