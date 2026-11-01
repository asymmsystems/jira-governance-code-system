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
  Textfield
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

type Settings = {
  projectKey: string;
  issueTypes: Array<{ id: string; name: string }>;
  templates: Record<string, any>;
  doneStatuses: Array<{ id: string; name: string }>;
  exemptStatusIds: string[];
};

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [issueTypeId, setIssueTypeId] = useState<string>('');
  const [editor, setEditor] = useState<EditorState>(editorFromTemplate());
  const [newTitle, setNewTitle] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [exempt, setExempt] = useState<string[]>([]);

  const load = async () => {
    setError(null);
    try {
      const s = (await invoke('getSettings', {})) as unknown as Settings;
      setSettings(s);
      setExempt(s.exemptStatusIds || []);
      const first = issueTypeId || s.issueTypes[0]?.id || '';
      setIssueTypeId(first);
      setEditor(editorFromTemplate(s.templates[first]));
    } catch (err: any) {
      setError(err?.message || 'DefinitionGuard could not load the settings. Refresh the page.');
    }
  };

  useEffect(() => {
    load();
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
      setNotice(`Template "${res.template.name}" version ${res.template.version} saved. New checklists for this issue type use it.`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'The template was not saved. Try again.');
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
    } catch (err: any) {
      setError(err?.message || 'The statuses were not saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!settings && !error) {
    return (
      <Inline alignBlock="center" space="space.100">
        <Spinner size="small" />
        <Text>Loading DefinitionGuard settings...</Text>
      </Inline>
    );
  }

  const typeOptions = (settings?.issueTypes || []).map(t => ({ label: t.name, value: t.id }));

  return (
    <Stack space="space.200">
      <Heading as="h2">Definition of Done templates</Heading>
      <Text>Choose an issue type, list its Definition of Done items, and save. Issues that already have a checklist keep their items.</Text>

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
        id="dg-template-name"
        placeholder="Template name, for example Team DoD"
        value={editor.name}
        onChange={(e: any) => setEditor({ ...editor, name: e.target.value })}
      />

      <Stack space="space.100">
        {editor.items.map((item, idx) => (
          <Box key={item.key} padding="space.100">
            <Stack space="space.050">
              <Textfield
                id={`dg-title-${item.key}`}
                value={item.title}
                onChange={(e: any) => setEditor(updateItem(editor, item.key, { title: e.target.value }))}
              />
              <Inline space="space.150" alignBlock="center" shouldWrap>
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

      <Inline space="space.100" alignBlock="center">
        <Textfield id="dg-new-item" placeholder="New item title" value={newTitle} onChange={(e: any) => setNewTitle(e.target.value)} />
        <Button
          isDisabled={newTitle.trim().length === 0}
          onClick={() => {
            setEditor(addItem(editor, newTitle.trim()));
            setNewTitle('');
          }}
        >
          Add item
        </Button>
      </Inline>

      <Inline space="space.100">
        <Button appearance="primary" isDisabled={saving || !issueTypeId} onClick={save}>
          Save template
        </Button>
      </Inline>

      <Heading as="h3">Statuses the gate lets through</Heading>
      <Text>The gate blocks moves into Done-category statuses while mandatory items are open. Tick statuses that are not completions, such as Canceled or Declined.</Text>
      <Stack space="space.050">
        {(settings?.doneStatuses || []).map(st => (
          <Checkbox
            key={st.id}
            label={st.name}
            isChecked={exempt.includes(st.id)}
            onChange={() => setExempt(exempt.includes(st.id) ? exempt.filter(x => x !== st.id) : [...exempt, st.id])}
          />
        ))}
      </Stack>
      <Inline space="space.100">
        <Button isDisabled={saving} onClick={saveExempt}>Save statuses</Button>
      </Inline>
    </Stack>
  );
};

export default SettingsPage;

ForgeReconciler.render(
  <React.StrictMode>
    <SettingsPage />
  </React.StrictMode>
);
