/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: UI Kit root. Chooses the issue panel or the project dashboard from the Forge context.
 */

import React, { useEffect, useState } from 'react';
import { Inline, SectionMessage, Spinner, Text } from '@forge/react';
import { invoke, view } from '@forge/bridge';
import { ForgeContext, IssueRow, ProjectDashboardView, ResolverError } from '../contract/data/models';

/** What the load resolvers return: an error envelope, an issue row, or a dashboard view. */
type LoadResult = { ok?: boolean; row?: IssueRow; error?: ResolverError } & Partial<ProjectDashboardView>;
import { IssuePanel } from './issue-panel';
import { ProjectDashboard } from './project-dashboard';
import { errorText } from '../ui/triage';

export const FourRealitiesApp: React.FC = () => {
  // All hooks run on every render, before any early return (React rules of hooks, FR-01).
  const [isIssueView, setIsIssueView] = useState<boolean>(false);
  const [row, setRow] = useState<IssueRow | null>(null);
  const [dashboard, setDashboard] = useState<ProjectDashboardView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [licenceInactive, setLicenceInactive] = useState<boolean>(false);

  const load = async (refresh = false) => {
    setLoading(true);
    setErrorMessage(null);
    setLicenceInactive(false);
    try {
      const context = (await view.getContext().catch(() => null)) as ForgeContext | null;
      const issueView = Boolean(context?.extension?.issue);
      setIsIssueView(issueView);
      const resolver = issueView ? 'getIssueAlignment' : refresh ? 'refreshProjectSnapshot' : 'getProjectDashboard';
      const res = (await invoke<Record<string, never>, LoadResult>(resolver, {})) as LoadResult | undefined;
      if (!res?.ok) {
        setLicenceInactive(res?.error?.code === 'LICENSE_INACTIVE');
        setErrorMessage(errorText(res, 'Failed to load delivery evidence.'));
      } else if (issueView) {
        setRow(res.row || null);
      } else {
        setDashboard(res as ProjectDashboardView);
      }
    } catch (err) {
      setErrorMessage(errorText(err, 'Failed to load delivery evidence.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <Inline space="space.100" alignBlock="center" shouldWrap>
        <Spinner size="small" label="Loading" />
        <Text>Evaluating delivery evidence...</Text>
      </Inline>
    );
  }

  if (licenceInactive) {
    return (
      <SectionMessage appearance="warning" title="Licence not active">
        <Text>{errorMessage}</Text>
      </SectionMessage>
    );
  }

  if (errorMessage || (isIssueView ? !row : !dashboard)) {
    return (
      <SectionMessage appearance="error" title="Delivery evidence unavailable">
        <Text>{errorMessage || 'Failed to load delivery evidence.'}</Text>
      </SectionMessage>
    );
  }

  return isIssueView
    ? <IssuePanel row={row as IssueRow} onReload={() => load()} onRow={setRow} />
    : <ProjectDashboard view={dashboard as ProjectDashboardView} onRefresh={() => load(true)} />;
};
