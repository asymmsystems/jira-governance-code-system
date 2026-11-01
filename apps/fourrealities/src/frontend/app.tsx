/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: UI Kit root. Chooses the issue panel or the project dashboard from the Forge context.
 */

import React, { useEffect, useState } from 'react';
import { Inline, SectionMessage, Spinner, Text } from '@forge/react';
import { invoke, view } from '@forge/bridge';
import { IssueRow, ProjectDashboardView } from '../domain/models';
import { IssuePanel } from './issue-panel';
import { ProjectDashboard } from './project-dashboard';

/** Error text from a resolver envelope or a thrown error. */
export function errorText(res: any, fallback: string): string {
  return res?.error?.message || res?.message || fallback;
}

export const FourRealitiesApp: React.FC = () => {
  // All hooks run on every render, before any early return (React rules of hooks, FR-01).
  const [isIssueView, setIsIssueView] = useState<boolean>(false);
  const [row, setRow] = useState<IssueRow | null>(null);
  const [dashboard, setDashboard] = useState<ProjectDashboardView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = async (refresh = false) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const context: any = await view.getContext().catch(() => null);
      const issueView = Boolean(context?.extension?.issue);
      setIsIssueView(issueView);
      const resolver = issueView ? 'getIssueAlignment' : refresh ? 'refreshProjectSnapshot' : 'getProjectDashboard';
      const res: any = await invoke(resolver, {});
      if (!res?.ok) {
        setErrorMessage(errorText(res, 'Failed to load delivery evidence.'));
      } else if (issueView) {
        setRow(res.row);
      } else {
        setDashboard(res as ProjectDashboardView);
      }
    } catch (err: any) {
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
      <Inline space="space.100" alignBlock="center">
        <Spinner size="small" label="Loading" />
        <Text>Evaluating delivery evidence...</Text>
      </Inline>
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
    ? <IssuePanel row={row as IssueRow} onReload={() => load()} />
    : <ProjectDashboard view={dashboard as ProjectDashboardView} onRefresh={() => load(true)} />;
};
