/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * Asymm Systems: shared admin page view model and layout primitives for authority policy configuration.
 * Adheres to the Uniform Permission Management Standard across all Jira suite apps.
 */

import React from 'react';
import {
  Button,
  Heading,
  Inline,
  Label,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  Textfield
} from '@forge/react';
import { SPACE, TEXT_ROLE } from './brand';
import { CardHeader, ListRow, NoteBox } from './layout';

export interface GroupChoice {
  groupId: string;
  name: string;
}

export type AdminViewState = 'LOADING' | 'ERROR' | 'NOT_ADMIN' | 'READY';

export interface AdminPolicyInput {
  loading: boolean;
  /** Resolver response for the get policy query. */
  response: { ok?: boolean; code?: string; message?: string; policy?: { parties?: Array<{ partyId: string; name: string }> } } | null;
  chosen: GroupChoice[];
  results: GroupChoice[];
  appName: string;
  roleDescription?: string;
}

export interface AdminPolicyView {
  state: AdminViewState;
  message: string;
  chosen: GroupChoice[];
  results: GroupChoice[];
  canSave: boolean;
}

export function savedGroups(response: { policy?: { parties?: Array<{ partyId: string; name: string }> } } | null): GroupChoice[] {
  const parties = response?.policy?.parties ?? [];
  return parties.map(p => ({ groupId: String(p.partyId), name: String(p.name) }));
}

export function addGroup(chosen: GroupChoice[], group: GroupChoice): GroupChoice[] {
  return chosen.some(g => g.groupId === group.groupId) ? chosen : [...chosen, group];
}

export function removeGroup(chosen: GroupChoice[], groupId: string): GroupChoice[] {
  return chosen.filter(g => g.groupId !== groupId);
}

const serializeGroupIds = (groups: GroupChoice[]): string =>
  groups.map(g => g.groupId).sort().join('\n');

export function formatPolicySummary(appName: string, groupNames: string[], roleDescription?: string): string {
  const role = roleDescription || 'perform authorized actions';
  if (groupNames.length === 0) {
    return `${appName}: only Jira administrators and project administrators can ${role}.`;
  }
  if (groupNames.length === 1) {
    return `${appName}: Jira administrators, project administrators, and members of ${groupNames[0]} can ${role}.`;
  }
  const allExceptLast = groupNames.slice(0, -1).join(', ');
  const last = groupNames[groupNames.length - 1];
  return `${appName}: Jira administrators, project administrators, and members of ${allExceptLast} and ${last} can ${role}.`;
}

export function buildAdminPolicyView(input: AdminPolicyInput): AdminPolicyView {
  const empty = { chosen: [], results: [], canSave: false };
  if (input.loading) {
    return { state: 'LOADING', message: `Loading ${input.appName} authorization settings...`, ...empty };
  }
  const r = input.response;
  if (!r) {
    return { state: 'ERROR', message: `${input.appName} could not load the authority policy. Try again.`, ...empty };
  }
  if (r.ok === false) {
    return {
      state: r.code === 'NOT_ADMIN' ? 'NOT_ADMIN' : 'ERROR',
      message: String(r.message || `${input.appName}: you do not have permission to view or manage settings.`),
      ...empty
    };
  }
  const saved = savedGroups(r);
  const chosenIds = new Set(input.chosen.map(g => g.groupId));
  const sortedNames = saved.map(g => g.name).sort();
  return {
    state: 'READY',
    message: formatPolicySummary(input.appName, sortedNames, input.roleDescription),
    chosen: input.chosen,
    results: input.results.filter(g => !chosenIds.has(g.groupId)),
    canSave: serializeGroupIds(input.chosen) !== serializeGroupIds(saved)
  };
}

export interface AdminPolicyPanelProps {
  appName: string;
  roleTitle: string;
  roleDescription: string;
  view: AdminPolicyView;
  saving: boolean;
  notice: string | null;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  onAddGroup: (group: GroupChoice) => void;
  onRemoveGroup: (groupId: string) => void;
  onSave: () => void;
}

export const AdminPolicyPanel: React.FC<AdminPolicyPanelProps> = ({
  appName,
  roleTitle,
  roleDescription,
  view,
  saving,
  notice,
  onSearchChange,
  onSearch,
  onAddGroup,
  onRemoveGroup,
  onSave
}) => {
  if (view.state === 'LOADING') {
    return (
      <Inline alignBlock="center" space={SPACE.item}>
        <Spinner size="small" />
        <Text as="span">{view.message}</Text>
      </Inline>
    );
  }

  if (view.state !== 'READY') {
    return (
      <SectionMessage appearance={view.state === 'NOT_ADMIN' ? 'information' : 'warning'}>
        <Text as="span">{view.message}</Text>
      </SectionMessage>
    );
  }

  return (
    <Stack space={SPACE.section}>
      <CardHeader
        title={`${appName} Authority Policy`}
        count={view.chosen.length}
      />

      <SectionMessage appearance="information">
        <Text as="span">{view.message}</Text>
      </SectionMessage>

      <NoteBox>
        <Text as="span" color={TEXT_ROLE.secondary}>
          Project administrators and Jira administrators always hold authority. Members of the groups below can also {roleDescription}.
        </Text>
      </NoteBox>

      <Stack space={SPACE.item}>
        <Heading as="h4">{roleTitle} ({view.chosen.length})</Heading>
        {view.chosen.length === 0 ? (
          <Text as="span" color={TEXT_ROLE.secondary}>No designated groups configured. Built-in administrators only.</Text>
        ) : (
          <Stack space={SPACE.sub}>
            {view.chosen.map(g => (
              <ListRow key={g.groupId}>
                <Inline space={SPACE.item} alignBlock="center" spread="space-between">
                  <Text as="span" weight="medium">{g.name}</Text>
                  <Button appearance="subtle" onClick={() => onRemoveGroup(g.groupId)}>
                    Remove
                  </Button>
                </Inline>
              </ListRow>
            ))}
          </Stack>
        )}

        <Inline space={SPACE.item}>
          <Button appearance="primary" isDisabled={!view.canSave || saving} onClick={onSave}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </Inline>
      </Stack>

      {notice ? (
        <SectionMessage appearance="success">
          <Text as="span">{notice}</Text>
        </SectionMessage>
      ) : null}

      <Stack space={SPACE.item}>
        <Label labelFor="asymm-group-search">Find Jira groups to grant authority</Label>
        <Inline space={SPACE.item} alignBlock="center">
          <Textfield
            id="asymm-group-search"
            name="asymm-group-search"
            placeholder="Type group name..."
            onChange={(e: { target?: { value?: string } }) => onSearchChange(e.target?.value || '')}
          />
          <Button onClick={onSearch}>Search</Button>
        </Inline>

        {view.results.length > 0 ? (
          <Stack space={SPACE.sub}>
            <Text as="span" color={TEXT_ROLE.secondary}>Search results:</Text>
            {view.results.map(g => (
              <ListRow key={g.groupId}>
                <Inline space={SPACE.item} alignBlock="center" spread="space-between">
                  <Text as="span">{g.name}</Text>
                  <Button appearance="subtle" onClick={() => onAddGroup(g)}>
                    Add
                  </Button>
                </Inline>
              </ListRow>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Stack>
  );
};
