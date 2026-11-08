/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the admin page "FourRealities gate authority" (ADR-013). Jira administrators set
 * the evidence source of each check, the decision issue types, and the approver groups (Uniform
 * Permission Management Standard, with the shared AdminPolicyPanel). The server checks every call.
 */

import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Button, Heading, SectionMessage, Select, Spinner, Stack, Text, Textfield } from '@forge/react';
import { invoke } from '@forge/bridge';
import { AdminPolicyPanel, GroupChoice, buildAdminPolicyView, savedGroups } from '@asymm/jira-ui';
import { AdminResult, AdminView, EvidenceSourceSettings, GateName } from '../contract/data/models';
import {
  AUDIT_OPTIONS,
  INTENT_OPTIONS,
  Option,
  PROCESS_OPTIONS,
  codeOptions,
  optionOf,
  parseIssueTypes,
  sourceHelper,
  sourceNowLine,
  withSetting
} from '../ui/sources-text';
import { SPACE, TEXT_ROLE } from '../brand/brand';
import { ActionRow, AppSurface, Card, CardHeader, FormField, NoteBox, PageHeader } from '../brand/layout';
import { TextChange } from './modals';
import { ReportSettingsSection } from './report-settings';

type AdminResponse = AdminResult<AdminView> | null;
type GroupResponse = AdminResult<{ groups: GroupChoice[] }> | null;

/** The error text of a failed admin call, or the fallback. */
const failure = (r: { ok: boolean; message?: string } | null | undefined, fallback: string): string => (r && !r.ok && r.message) || fallback;

const ROLE = 'approve, reject and revoke Code exceptions';
/** One evidence source control: the select, what FourRealities has seen, and whether the check is in use. */
const SourceField: React.FC<{
  gate: GateName;
  label: string;
  options: Array<Option<string>>;
  value: string;
  view: AdminView;
  onChange: (value: string) => void;
}> = ({ gate, label, options, value, view, onChange }) => (
  <FormField id={`fr-source-${gate}`} label={label} helper={sourceHelper(gate, view.detected, view.devFieldId)}>
    <Select
      id={`fr-source-${gate}`}
      options={options}
      value={optionOf(options, value)}
      onChange={(o: Option<string> | null) => onChange(o?.value || options[0].value)}
    />
    <Text as="span" size="small" color={TEXT_ROLE.muted}>{sourceNowLine(view.sources, gate, view.devFieldId)}</Text>
  </FormField>
);

export const FourRealitiesAdmin: React.FC = () => {
  const [response, setResponse] = useState<AdminResponse>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [form, setForm] = useState<EvidenceSourceSettings | null>(null);
  const [typesText, setTypesText] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [chosen, setChosen] = useState<GroupChoice[]>([]);
  const [results, setResults] = useState<GroupChoice[]>([]);
  const [query, setQuery] = useState<string>('');
  const [groupNotice, setGroupNotice] = useState<string | null>(null);
  const [savingGroups, setSavingGroups] = useState<boolean>(false);

  const accept = (r: AdminResponse) => {
    setResponse(r);
    if (r && r.ok) {
      setForm(r.settings);
      setTypesText(r.settings.decisionIssueTypes.join(', '));
      setChosen(savedGroups(r));
    }
  };

  useEffect(() => {
    invoke('fr-admin-get', {})
      .then(r => accept((r as AdminResponse) || null))
      .catch(() => accept(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppSurface>
        <Spinner size="small" label="Loading" />
        <Text as="span" color={TEXT_ROLE.secondary}>Loading FourRealities settings...</Text>
      </AppSurface>
    );
  }

  if (!response || !response.ok || !form) {
    const notAdmin = Boolean(response && !response.ok && response.code === 'NOT_ADMIN');
    return (
      <AppSurface>
        <SectionMessage appearance={notAdmin ? 'information' : 'warning'} title="FourRealities gate authority">
          <Text as="span">{failure(response, 'FourRealities could not load its settings. Try again.')}</Text>
        </SectionMessage>
      </AppSurface>
    );
  }

  const view = response;
  const set = <K extends keyof EvidenceSourceSettings>(key: K, value: EvidenceSourceSettings[K]) => setForm(withSetting(form, key, value));

  const saveSources = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const r = (await invoke('fr-admin-save-sources', { ...form, decisionIssueTypes: parseIssueTypes(typesText) })) as AdminResponse;
      if (r?.ok) {
        accept(r);
        setNotice('Saved. Dashboards build their snapshot again on the next view.');
      } else {
        setNotice(failure(r, 'FourRealities could not save. Nothing was saved.'));
      }
    } catch {
      setNotice('FourRealities could not save. Nothing was saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const policyView = buildAdminPolicyView({ loading: false, response: { ok: true, policy: view.policy }, chosen, results, appName: 'FourRealities', roleDescription: ROLE });

  return (
    <AppSurface>
      <PageHeader title="FourRealities gate authority" subtitle="Evidence sources, decision issue types and approver groups for this site" />

      <Card>
        <CardHeader title="Evidence sources" subtitle="A check that is not in use is not scored and shows as Not used on this site." />
        <Stack space={SPACE.group}>
          <SourceField gate="intent" label="Intent (decision records)" options={INTENT_OPTIONS} value={form.intent} view={view} onChange={v => set('intent', v as EvidenceSourceSettings['intent'])} />
          <SourceField gate="process" label="Process (Definition of Done)" options={PROCESS_OPTIONS} value={form.process} view={view} onChange={v => set('process', v as EvidenceSourceSettings['process'])} />
          <SourceField gate="code" label="Code (pull requests from the Jira Development field)" options={codeOptions(view.devFieldId)} value={form.code} view={view} onChange={v => set('code', v as EvidenceSourceSettings['code'])} />
          <SourceField gate="audit" label="Audit (approval seal)" options={AUDIT_OPTIONS} value={form.audit} view={view} onChange={v => set('audit', v as EvidenceSourceSettings['audit'])} />
          <FormField id="fr-decision-types" label="Decision issue types" helper={`Issue type names that count as a decision record for Intent, separated by commas. Default: ${view.defaultDecisionIssueTypes.join(', ')}.`}>
            <Textfield id="fr-decision-types" value={typesText} onChange={(e: TextChange) => setTypesText(e.target?.value || '')} />
          </FormField>
          {notice ? (
            <NoteBox>
              <Text as="span" size="small">{notice}</Text>
            </NoteBox>
          ) : null}
          <ActionRow>
            <Button appearance="primary" isDisabled={saving} onClick={saveSources}>Save evidence sources</Button>
          </ActionRow>
        </Stack>
      </Card>

      <Card>
        <Heading size="small" as="h3">Approver groups</Heading>
        <AdminPolicyPanel
          appName="FourRealities"
          roleTitle="Code exception approvers"
          roleDescription={ROLE}
          view={policyView}
          saving={savingGroups}
          notice={groupNotice}
          onSearchChange={setQuery}
          onSearch={async () => {
            setGroupNotice(null);
            try {
              const r = (await invoke('fr-admin-search-groups', { query })) as GroupResponse;
              if (r?.ok) setResults(r.groups);
              else setGroupNotice(failure(r, 'FourRealities could not search groups in Jira. Try again.'));
            } catch {
              setGroupNotice('FourRealities could not search groups in Jira. Try again.');
            }
          }}
          onAddGroup={(g: GroupChoice) => setChosen(prev => (prev.some(x => x.groupId === g.groupId) ? prev : [...prev, g]))}
          onRemoveGroup={(id: string) => setChosen(prev => prev.filter(g => g.groupId !== id))}
          onSave={async () => {
            setSavingGroups(true);
            setGroupNotice(null);
            try {
              const r = (await invoke('fr-admin-save-approvers', { groupIds: chosen.map(g => g.groupId) })) as AdminResponse;
              if (r?.ok) {
                accept(r);
                setGroupNotice('Saved.');
              } else {
                setGroupNotice(failure(r, 'FourRealities could not save. Nothing was saved.'));
              }
            } catch {
              setGroupNotice('FourRealities could not save. Nothing was saved. Try again.');
            } finally {
              setSavingGroups(false);
            }
          }}
        />
      </Card>

      <ReportSettingsSection />
    </AppSurface>
  );
};

export default FourRealitiesAdmin;

ForgeReconciler.render(
  <React.StrictMode>
    <FourRealitiesAdmin />
  </React.StrictMode>
);
