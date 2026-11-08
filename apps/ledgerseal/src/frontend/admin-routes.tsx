/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal admin page tab "Approval routes" (ADR-017): Jira admins define routes and bind them to a project and issue
 * types. Every resolver checks Administer Jira as the user. The view logic is in route-admin-view-model.ts.
 *
 * @author Fahim Farook
 */

import React, { useEffect, useState } from 'react';
import { Box, Button, Heading, Inline, SectionMessage, Spinner, Stack, Text, TextArea, Textfield } from '@forge/react';
import { invoke } from '@forge/bridge';
import { ListRow, SPACE, TEXT_ROLE } from '@asymm/jira-ui';
import { logFailure } from '../service/log';
import { buildRouteRows, parseRouteText, ROUTE_EXAMPLE, routeText } from './route-admin-view-model';

export const ApprovalRoutesTab: React.FC = () => {
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [editing, setEditing] = useState<{ routeId: string | null; text: string } | null>(null);
  const [bind, setBind] = useState<{ routeId: string; projectKey: string; issueTypeId: string }>({ routeId: '', projectKey: '', issueTypeId: '*' });
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setResponse(await invoke('route-list-api', {}));
    } catch (err) {
      logFailure('could not load the routes', err);
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (name: string, payload: any) => {
    setNotice(null);
    try {
      const r = (await invoke(name, payload)) as any;
      setNotice(r?.ok ? 'Saved.' : r?.message || 'LedgerSeal could not save. Nothing was saved.');
      if (r?.ok) {
        setEditing(null);
        await load();
      }
    } catch (err) {
      logFailure('route action failed', err);
      setNotice('LedgerSeal could not save. Nothing was saved. Try again.');
    }
  };

  const save = async () => {
    if (!editing) return;
    const parsed = parseRouteText(editing.text, editing.routeId);
    if (!parsed.ok) {
      setNotice(parsed.message);
      return;
    }
    await act('route-save-api', parsed.payload);
  };

  if (loading) return <Spinner size="small" />;
  if (!response || response.ok === false) {
    return (
      <SectionMessage appearance="warning">
        <Text as="span">{response?.message || 'LedgerSeal could not load the routes. Try again.'}</Text>
      </SectionMessage>
    );
  }
  const rows = buildRouteRows(response);
  return (
    <Stack space={SPACE.group}>
      <Heading size="small">Approval routes</Heading>
      <Text as="span" size="small" color={TEXT_ROLE.secondary}>
        A route is ordered groups of stages. Each stage names approver groups and how many distinct people must sign. The last stage to sign seals the issue. A person signs at most one stage of an approval. Saving makes a new version; an approval already running keeps the version it started with.
      </Text>
      {notice && <Text as="span">{notice}</Text>}
      {rows.map(row => (
        <ListRow key={row.routeId} divided>
          <Stack space={SPACE.sub}>
            <Text as="span" weight="bold">{row.title}</Text>
            <Text as="span" size="small" color={TEXT_ROLE.secondary}>Route id: {row.routeId}</Text>
            <Text as="span" size="small">{row.stagesText}</Text>
            <Text as="span" size="small" color={TEXT_ROLE.secondary}>{row.bindings.length > 0 ? `Bound to: ${row.bindings.join('; ')}` : 'Not bound to any project.'}</Text>
            <Inline space={SPACE.item}>
              <Button appearance="subtle" spacing="compact" onClick={() => setEditing({ routeId: row.routeId, text: routeText(response.routes.find((r: any) => r.routeId === row.routeId)) })}>
                Edit
              </Button>
              <Button appearance="subtle" spacing="compact" onClick={() => setBind({ ...bind, routeId: row.routeId })}>
                Bind this route
              </Button>
            </Inline>
          </Stack>
        </ListRow>
      ))}
      {!editing && (
        <Box>
          <Button appearance="default" onClick={() => setEditing({ routeId: null, text: ROUTE_EXAMPLE })}>
            New route
          </Button>
        </Box>
      )}
      {editing && (
        <Stack space={SPACE.sub}>
          <Text as="span" size="small" weight="medium">{editing.routeId ? 'Edit the route (JSON)' : 'New route (JSON)'}</Text>
          <Text as="span" size="small" color={TEXT_ROLE.secondary}>
            Group ids come from Jira's group admin; gatesStatusIds are target status ids a stage gates (a move to such a status passes once that stage and every earlier group are signed).
          </Text>
          <TextArea key={`route-${editing.routeId ?? 'new'}`} name="route" defaultValue={editing.text} onChange={(e: any) => setEditing({ ...editing, text: e.target.value })} />
          <Inline space={SPACE.item}>
            <Button appearance="primary" onClick={save}>
              Save
            </Button>
            <Button appearance="subtle" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </Inline>
        </Stack>
      )}
      <Heading size="small">Bind a route</Heading>
      <Stack space={SPACE.sub}>
        <Text as="span" size="small">
          {bind.routeId ? `Route: ${rows.find(r => r.routeId === bind.routeId)?.title ?? bind.routeId}` : 'Choose "Bind this route" on a route above.'}
        </Text>
        <Text as="span" size="small" weight="medium">Project key</Text>
        <Textfield name="bind-project" onChange={(e: any) => setBind({ ...bind, projectKey: e.target.value.trim() })} />
        <Text as="span" size="small" weight="medium">Issue type id, or * for every issue type of the project</Text>
        <Textfield name="bind-type" defaultValue="*" onChange={(e: any) => setBind({ ...bind, issueTypeId: e.target.value.trim() })} />
        <Inline space={SPACE.item}>
          <Button appearance="primary" isDisabled={!bind.routeId} onClick={() => act('route-bind-api', bind)}>
            Bind
          </Button>
        </Inline>
      </Stack>
      <Heading size="small">Bindings</Heading>
      {(response.bindings ?? []).length === 0 && <Text as="span" size="small" color={TEXT_ROLE.secondary}>No route is bound.</Text>}
      {(response.bindings ?? []).map((b: any) => (
        <Inline key={`${b.projectId}-${b.issueTypeId}`} space={SPACE.item} alignBlock="center" shouldWrap>
          <Text as="span" size="small">
            {rows.find(r => r.routeId === b.routeId)?.title ?? b.routeId}: project {b.projectId}, {b.issueTypeId === '*' ? 'every issue type' : `issue type ${b.issueTypeId}`}
          </Text>
          <Button appearance="subtle" spacing="compact" onClick={() => act('route-unbind-api', { projectId: b.projectId, issueTypeId: b.issueTypeId })}>
            Unbind
          </Button>
        </Inline>
      ))}
    </Stack>
  );
};
