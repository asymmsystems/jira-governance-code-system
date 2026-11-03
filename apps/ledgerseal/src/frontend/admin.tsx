/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * The LedgerSeal admin page: a Jira admin chooses the approver groups. Every decision about what to show
 * comes from the admin view model (admin-view-model.ts); this component only maps it to UI Kit components.
 *
 * @author Fahim Farook
 */

import React, { useState, useEffect } from 'react';
import ForgeReconciler, { Text, Button, SectionMessage, Stack, Inline, Heading, Label, Textfield, Spinner } from '@forge/react';
import { invoke } from '@forge/bridge';
import { SPACE, TEXT_ROLE } from '@asymm/jira-ui';
import { addGroup, buildAdminView, GroupChoice, removeGroup, savedGroups } from './admin-view-model';

export const LedgerSealAdmin: React.FC = () => {
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
      const r = await invoke('approver-policy-get-api', {});
      setResponse(r);
      setChosen(savedGroups(r));
    } catch (err) {
      console.error('Failed to load the approver groups', err);
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const view = buildAdminView({ loading, response, chosen, results });

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
      console.error('Failed to save the approver groups', err);
      setNotice('LedgerSeal could not save. Nothing was saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (view.state === 'LOADING') {
    return (
      <Inline alignBlock="center">
        <Spinner size="small" />
        <Text>{view.message}</Text>
      </Inline>
    );
  }

  return (
    <Stack space={SPACE.group}>
      {view.state !== 'READY' ? (
        <SectionMessage appearance={view.state === 'NOT_ADMIN' ? 'information' : 'warning'}>
          <Text>{view.message}</Text>
        </SectionMessage>
      ) : (
        <>
          <SectionMessage appearance="information">
            <Text>{view.message}</Text>
          </SectionMessage>
          <Text>Project admins and Jira admins can always seal. Members of the groups below can also seal, reseal and revoke.</Text>
          <Stack space={SPACE.item}>
            <Heading as="h4">Approver groups ({view.chosen.length})</Heading>
            {view.chosen.length === 0 && <Text>No approver groups configured.</Text>}
            {view.chosen.map(g => (
              <Inline key={g.groupId} space={SPACE.item} alignBlock="center">
                <Text weight="medium">{g.name}</Text>
                <Button appearance="subtle" onClick={() => setChosen(removeGroup(chosen, g.groupId))}>
                  Remove
                </Button>
              </Inline>
            ))}
            <Inline space={SPACE.item}>
              <Button appearance="primary" isDisabled={!view.canSave || saving} onClick={save}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
            </Inline>
          </Stack>
          {notice && (
            <SectionMessage appearance="success">
              <Text>{notice}</Text>
            </SectionMessage>
          )}
          <Stack space={SPACE.item}>
            <Label labelFor="group-search">Find a group to add</Label>
            <Inline space={SPACE.item} alignBlock="center">
              {/* Uncontrolled on purpose: a controlled value lost typed characters over the UI Kit bridge (live, DEMO-34) */}
              <Textfield id="group-search" name="group-search" onChange={(e: any) => setQuery(e.target.value)} />
              <Button onClick={search}>Search</Button>
            </Inline>
            {view.results.length > 0 && (
              <Stack space={SPACE.sub}>
                <Text color={TEXT_ROLE.secondary}>Search results:</Text>
                {view.results.map(g => (
                  <Inline key={g.groupId} space={SPACE.item} alignBlock="center">
                    <Text>{g.name}</Text>
                    <Button appearance="subtle" onClick={() => setChosen(addGroup(chosen, g))}>
                      Add
                    </Button>
                  </Inline>
                ))}
              </Stack>
            )}
          </Stack>
        </>
      )}
    </Stack>
  );
};

export default LedgerSealAdmin;

ForgeReconciler.render(
  <React.StrictMode>
    <LedgerSealAdmin />
  </React.StrictMode>
);
