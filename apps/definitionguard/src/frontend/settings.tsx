/**
 * DefinitionGuard project settings page (jira:projectSettingsPage): Definition of Done templates.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Renders only. Editing rules live in src/ui/template-editor.ts; checks run in the resolver.
 */
import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  Checkbox,
  Heading,
  Inline,
  Select,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  Textfield,
  List,
  ListItem,
  Lozenge
} from '@forge/react';
import { invoke } from '@forge/bridge';
import {
  CATEGORY_OPTIONS,
  PERMISSION_OPTIONS,
  EditorState,
  addItem,
  editorFromTemplate,
  moveItem,
  removeItem,
  toTemplatePayload,
  updateItem
} from '../ui/template-editor';
import { panelErrorText } from '../ui/panel-view-model';
import { SPACE } from '@asymm/jira-ui';

type Settings = {
  projectKey: string;
  issueTypes: Array<{ id: string; name: string }>;
  templates: Record<string, any>;
  doneStatuses: Array<{ id: string; name: string }>;
  exemptStatusIds: string[];
  licenceNotice?: string;
};

// Text fields are uncontrolled (defaultValue, remounted by key): a controlled UI Kit Textfield
// loses keystrokes, because each key makes a round trip through the bridge (seen live, 2026-11-01).
export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [issueTypeId, setIssueTypeId] = useState<string>('');
  const [editor, setEditor] = useState<EditorState>(editorFromTemplate());
  const [newTitle, setNewTitle] = useState<string>('');
  const [newItemRound, setNewItemRound] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [exempt, setExempt] = useState<string[]>([]);
  const [coverage, setCoverage] = useState<{ summary: string; missing: number; transitions: Array<{ workflow: string; transition: string; toStatus: string; gated: boolean; exempt: boolean }> } | null>(null);
  const [coverageError, setCoverageError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const s = (await invoke('getSettings', {})) as unknown as Settings;
      setSettings(s);
      setExempt(s.exemptStatusIds || []);
      const first = issueTypeId || s.issueTypes[0]?.id || '';
      setIssueTypeId(first);
      setEditor(editorFromTemplate(s.templates[first]));
    } catch (err) {
      setError(panelErrorText(err, 'load the settings'));
    }
  };

  const loadCoverage = async () => {
    setCoverageError(null);
    try {
      setCoverage((await invoke('gateCoverage', {})) as any);
    } catch (err) {
      setCoverageError(panelErrorText(err, 'read the workflows'));
    }
  };

  useEffect(() => {
    load();
    loadCoverage();
  }, []);

  const chooseIssueType = (id: string) => {
    setIssueTypeId(id);
    setNotice(null);
    setEditor(editorFromTemplate(settings?.templates[id]));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = (await invoke('saveTemplate', { issueTypeId, template: toTemplatePayload(editor) })) as unknown as { template: any };
      setNotice(`Template "${res.template.name}" version ${res.template.version} saved. New checklists for this issue type use it. Open issues keep their version until you re-sync them.`);
      await load();
    } catch (err) {
      setError(panelErrorText(err, 'save the template'));
    } finally {
      setSaving(false);
    }
  };

  const saveExempt = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await invoke('saveExemptions', { exemptStatusIds: exempt });
      setNotice('Saved. Moves into the ticked statuses are not gated, for example Canceled or Declined.');
      await load();
      await loadCoverage();
    } catch (err) {
      setError(panelErrorText(err, 'save the statuses'));
    } finally {
      setSaving(false);
    }
  };

  const resync = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      let cursor: string | undefined;
      let updated = 0;
      let version = 0;
      do {
        const page = (await invoke('resyncIssues', { issueTypeId, cursor })) as unknown as { updated: number; nextCursor?: string; templateVersion: number };
        updated += page.updated;
        version = page.templateVersion;
        cursor = page.nextCursor;
      } while (cursor);
      setNotice(`Re-synced ${updated} open issues to version ${version}. Ticks on unchanged items were kept.`);
    } catch (err) {
      setError(panelErrorText(err, 're-sync the open issues'));
    } finally {
      setSaving(false);
    }
  };

  if (!settings && !error) {
    return (
      <Inline alignBlock="center" space={SPACE.item}>
        <Spinner size="small" />
        <Text>Loading DefinitionGuard settings...</Text>
      </Inline>
    );
  }

  const typeOptions = (settings?.issueTypes || []).map(t => ({ label: t.name, value: t.id }));

  return (
    <Stack space={SPACE.section}>
      <Heading as="h2">Definition of Done templates</Heading>
      <Text>Choose an issue type, list its Definition of Done items, and save. Issues that already have a checklist keep their items.</Text>

      {settings?.licenceNotice && (
        <SectionMessage appearance="warning" title="Licence not active">
          <Text>{settings.licenceNotice}</Text>
        </SectionMessage>
      )}
      {error && (
        <SectionMessage appearance="error" title="Not saved">
          <Text>{error}</Text>
        </SectionMessage>
      )}
      {notice && (
        <SectionMessage appearance="success">
          <Text>{notice}</Text>
        </SectionMessage>
      )}

      <Select
        inputId="dg-issue-type"
        options={typeOptions}
        value={typeOptions.find(o => o.value === issueTypeId)}
        onChange={(o: any) => chooseIssueType(o?.value || '')}
      />

      <Textfield
        key={`dg-template-name-${issueTypeId}`}
        id="dg-template-name"
        placeholder="Template name, for example Team DoD"
        defaultValue={editor.name}
        onChange={(e: any) => setEditor({ ...editor, name: e.target.value })}
      />

      <Stack space={SPACE.item}>
        {editor.items.map((item, idx) => (
          <Box key={item.key} padding={SPACE.item}>
            <Stack space={SPACE.sub}>
              <Textfield
                id={`dg-title-${item.key}`}
                defaultValue={item.title}
                onChange={(e: any) => setEditor(updateItem(editor, item.key, { title: e.target.value }))}
              />
              <Inline space={SPACE.group} alignBlock="center" shouldWrap>
                <Checkbox
                  label="Mandatory"
                  isChecked={item.isMandatory}
                  onChange={() => setEditor(updateItem(editor, item.key, { isMandatory: !item.isMandatory }))}
                />
                <Checkbox
                  label="Evidence required"
                  isChecked={Boolean(item.evidenceRequired)}
                  onChange={() => setEditor(updateItem(editor, item.key, { evidenceRequired: !item.evidenceRequired }))}
                />
                <Checkbox
                  label="Not the assignee"
                  isChecked={Boolean(item.notAssignee)}
                  onChange={() => setEditor(updateItem(editor, item.key, { notAssignee: !item.notAssignee }))}
                />
                <Box>
                  <Select
                    inputId={`dg-permission-${item.key}`}
                    options={PERMISSION_OPTIONS}
                    value={PERMISSION_OPTIONS.find(o => o.value === (item.requiredPermission || ''))}
                    onChange={(o: any) => setEditor(updateItem(editor, item.key, { requiredPermission: o?.value || undefined }))}
                  />
                </Box>
                <Box>
                  <Select
                    inputId={`dg-category-${item.key}`}
                    options={CATEGORY_OPTIONS}
                    value={CATEGORY_OPTIONS.find(o => o.value === item.category)}
                    onChange={(o: any) => setEditor(updateItem(editor, item.key, { category: o.value }))}
                  />
                </Box>
                <Button appearance="subtle" isDisabled={idx === 0} onClick={() => setEditor(moveItem(editor, item.key, -1))}>Move up</Button>
                <Button appearance="subtle" isDisabled={idx === editor.items.length - 1} onClick={() => setEditor(moveItem(editor, item.key, 1))}>Move down</Button>
                <Button appearance="subtle" onClick={() => setEditor(removeItem(editor, item.key))}>Remove</Button>
              </Inline>
            </Stack>
          </Box>
        ))}
      </Stack>

      <Inline space={SPACE.item} alignBlock="center">
        <Textfield key={`dg-new-item-${newItemRound}`} id="dg-new-item" placeholder="New item title" onChange={(e: any) => setNewTitle(e.target.value)} />
        <Button
          isDisabled={newTitle.trim().length === 0}
          onClick={() => {
            setEditor(addItem(editor, newTitle.trim()));
            setNewTitle('');
            setNewItemRound(newItemRound + 1); // remounts the uncontrolled field empty
          }}
        >
          Add item
        </Button>
      </Inline>

      <Inline space={SPACE.item}>
        <Button appearance="primary" isDisabled={saving || !issueTypeId} onClick={save}>
          Save template
        </Button>
        <Button isDisabled={saving || !settings?.templates[issueTypeId]} onClick={resync}>
          Re-sync open issues
        </Button>
      </Inline>

      <Heading as="h3">Statuses the gate lets through</Heading>
      <Text>The gate blocks moves into Done-category statuses while mandatory items are open. Tick statuses that are not completions, such as Canceled or Declined.</Text>
      <Stack space={SPACE.sub}>
        {(settings?.doneStatuses || []).map(st => (
          <Checkbox
            key={st.id}
            label={st.name}
            isChecked={exempt.includes(st.id)}
            onChange={() => setExempt(exempt.includes(st.id) ? exempt.filter(x => x !== st.id) : [...exempt, st.id])}
          />
        ))}
      </Stack>
      <Inline space={SPACE.item}>
        <Button isDisabled={saving} onClick={saveExempt}>Save statuses</Button>
      </Inline>

      <Heading as="h3">Gate coverage</Heading>
      <Text>DefinitionGuard blocks a move only on transitions where a Jira admin added the "DefinitionGuard DoD Enforcement" validator in the workflow editor. The app cannot add it for you.</Text>
      {coverageError && (
        <SectionMessage appearance="error">
          <Text>{coverageError}</Text>
        </SectionMessage>
      )}
      {coverage && (
        <Stack space={SPACE.item}>
          <SectionMessage appearance={coverage.missing === 0 ? 'success' : 'warning'}>
            <Text>{coverage.summary}</Text>
          </SectionMessage>
          <List type="unordered">
            {coverage.transitions.map(t => (
              <ListItem key={`${t.workflow}/${t.transition}/${t.toStatus}`}>
                <Inline space={SPACE.item} alignBlock="center" shouldWrap>
                  <Lozenge appearance={t.exempt ? 'default' : t.gated ? 'success' : 'removed'}>{t.exempt ? 'Exempt' : t.gated ? 'Gated' : 'Not gated'}</Lozenge>
                  <Text>{t.workflow}: {t.transition} (to {t.toStatus})</Text>
                </Inline>
              </ListItem>
            ))}
          </List>
          <Button appearance="subtle" onClick={loadCoverage}>Check again</Button>
        </Stack>
      )}
    </Stack>
  );
};

export default SettingsPage;

ForgeReconciler.render(
  <React.StrictMode>
    <SettingsPage />
  </React.StrictMode>
);
