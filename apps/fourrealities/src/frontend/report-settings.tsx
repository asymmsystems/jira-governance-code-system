/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the admin page section "Evidence reports" (ADR-015, HLD section 8.2): the retention of the
 * reports, the evidence report groups (shared AdminPolicyPanel) and the signing key id. The server checks
 * that the caller is a Jira administrator on every call.
 */

import React, { useEffect, useState } from 'react';
import { Button, Select, Stack, Text } from '@forge/react';
import { invoke } from '@forge/bridge';
import { AdminPolicyPanel, GroupChoice, buildAdminPolicyView, savedGroups } from '@asymm/jira-ui';
import { AdminResult } from '../contract/data/models';
import { ReportSettingsView } from '../contract/data/reports';
import { Option, optionOf } from '../ui/sources-text';
import { ADMIN_TEXT, SHORTER_RETENTION_TEXT, signingText } from '../ui/report-text';
import { SPACE, TEXT_ROLE } from '../brand/brand';
import { ActionRow, Card, CardHeader, FormField } from '../brand/layout';

type GroupResponse = AdminResult<{ groups: GroupChoice[] }> | null;

/** The error text of a failed admin call, or the fallback. */
const failure = (r: { ok: boolean; message?: string } | null | undefined, fallback: string): string => (r && !r.ok && r.message) || fallback;

const REPORT_ROLE = 'make evidence reports for change-management audits';

type ReportSettingsResponse = AdminResult<ReportSettingsView> | null;

/** The section "Evidence reports" (HLD 8.2): retention, the report groups and the signing key id. */
export const ReportSettingsSection: React.FC = () => {
  const [response, setResponse] = useState<ReportSettingsResponse>(null);
  const [days, setDays] = useState<number>(400);
  const [chosen, setChosen] = useState<GroupChoice[]>([]);
  const [results, setResults] = useState<GroupChoice[]>([]);
  const [query, setQuery] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const accept = (r: ReportSettingsResponse) => {
    setResponse(r);
    if (r && r.ok) {
      setDays(r.retentionDays);
      setChosen(savedGroups(r));
    }
  };
  useEffect(() => {
    Promise.resolve()
      .then(() => invoke('fr-admin-reports-get', {}))
      .then(r => accept((r as ReportSettingsResponse) || null))
      .catch(() => accept(null));
  }, []);
  if (!response || !response.ok) {
    return (
      <Card>
        <CardHeader title="Evidence reports" />
        <Text as="span">{failure(response, 'FourRealities could not load the report settings. Try again.')}</Text>
      </Card>
    );
  }
  const options: Array<Option<string>> = response.allowedRetentionDays.map(d => ({ label: `${d} days`, value: String(d) }));
  const save = async (groupIds: string[]) => {
    setSaving(true);
    setNotice(null);
    try {
      const r = (await invoke('fr-admin-reports-save', { retentionDays: days, reportGroupIds: groupIds })) as ReportSettingsResponse;
      if (r?.ok) {
        accept(r);
        setNotice('Saved.');
      } else {
        setNotice(failure(r, 'FourRealities could not save. Nothing was saved.'));
      }
    } catch {
      setNotice('FourRealities could not save. Nothing was saved. Try again.');
    } finally {
      setSaving(false);
    }
  };
  const policyView = buildAdminPolicyView({ loading: false, response: { ok: true, policy: response.policy }, chosen, results, appName: 'FourRealities', roleDescription: REPORT_ROLE });
  return (
    <Card>
      <CardHeader title="Evidence reports" subtitle={ADMIN_TEXT} />
      <Stack space={SPACE.group}>
        <FormField id="fr-report-retention" label="Keep reports for" helper={days < response.retentionDays ? SHORTER_RETENTION_TEXT : 'From 90 days to 7 years. The default is 400 days.'}>
          <Select id="fr-report-retention" options={options} value={optionOf(options, String(days))} onChange={(o: Option<string> | null) => setDays(Number(o?.value || response.retentionDays))} />
        </FormField>
        <Text as="span" size="small" color={TEXT_ROLE.muted}>{signingText(response.signingKeyId)}</Text>
        <ActionRow>
          <Button appearance="primary" isDisabled={saving} onClick={() => save(chosen.map(g => g.groupId))}>Save retention</Button>
        </ActionRow>
        <AdminPolicyPanel
          appName="FourRealities"
          roleTitle="Evidence report groups"
          roleDescription={REPORT_ROLE}
          view={policyView}
          saving={saving}
          notice={notice}
          onSearchChange={setQuery}
          onSearch={async () => {
            setNotice(null);
            try {
              const r = (await invoke('fr-admin-search-groups', { query })) as GroupResponse;
              if (r?.ok) setResults(r.groups);
              else setNotice(failure(r, 'FourRealities could not search groups in Jira. Try again.'));
            } catch {
              setNotice('FourRealities could not search groups in Jira. Try again.');
            }
          }}
          onAddGroup={(g: GroupChoice) => setChosen(prev => (prev.some(x => x.groupId === g.groupId) ? prev : [...prev, g]))}
          onRemoveGroup={(id: string) => setChosen(prev => prev.filter(g => g.groupId !== id))}
          onSave={() => save(chosen.map(g => g.groupId))}
        />
      </Stack>
    </Card>
  );
};
