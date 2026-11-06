/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: UI Kit root. Chooses the issue panel or the project dashboard from the Forge context.
 */

import React, { useEffect, useState } from 'react';
import { Inline, SectionMessage, Spinner, Text } from '@forge/react';
import { invoke, view } from '@forge/bridge';
import { ApprovalView, ForgeContext, IssueRow, ProjectDashboardView, ResolverError } from '../contract/data/models';
import { SPACE, TEXT_ROLE } from '../brand/brand';
import { AppSurface } from '../brand/layout';
import { IssuePanel } from './issue-panel';
import { ProjectDashboard } from './project-dashboard';
import { errorText } from '../ui/triage';

/** What the load resolvers return: an error envelope, an issue row, or a dashboard view. */
type LoadResult = { ok?: boolean; row?: IssueRow; approval?: ApprovalView; error?: ResolverError } & Partial<ProjectDashboardView>;

export const FourRealitiesApp: React.FC = () => {
  // All hooks run on every render, before any early return (React rules of hooks, FR-01).
  const [isIssueView, setIsIssueView] = useState<boolean>(false);
  const [row, setRow] = useState<IssueRow | null>(null);
  const [approval, setApproval] = useState<ApprovalView | undefined>(undefined);
  const [dashboard, setDashboard] = useState<ProjectDashboardView | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [licenceInactive, setLicenceInactive] = useState<boolean>(false);
  const [compact, setCompact] = useState<boolean>(false);
  const [viewerAccountId, setViewerAccountId] = useState<string | undefined>(undefined);

  const load = async (refresh = false) => {
    setLoading(true);
    setErrorMessage(null);
    setLicenceInactive(false);
    try {
      const context = (await view.getContext().catch(() => null)) as ForgeContext | null;
      const issueView = Boolean(context?.extension?.issue);
      setIsIssueView(issueView);
      setCompact(context?.moduleKey === 'fourrealities-issue-context');
      setViewerAccountId(context?.accountId);
      const resolver = issueView ? 'getIssueAlignment' : refresh ? 'refreshProjectSnapshot' : 'getProjectDashboard';
      const res = (await invoke<Record<string, never>, LoadResult>(resolver, {})) as LoadResult | undefined;
      if (!res?.ok) {
        setLicenceInactive(res?.error?.code === 'LICENSE_INACTIVE');
        setErrorMessage(errorText(res, 'Failed to load delivery evidence.'));
      } else if (issueView) {
        setRow(res.row || null);
        setApproval(res.approval);
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
      <AppSurface compact={compact}>
        <Inline space={SPACE.item} alignBlock="center" shouldWrap>
          <Spinner size="small" label="Loading" />
          <Text as="span" color={TEXT_ROLE.secondary}>Evaluating delivery evidence...</Text>
        </Inline>
      </AppSurface>
    );
  }

  if (licenceInactive) {
    return (
      <AppSurface compact={compact}>
        <SectionMessage appearance="warning" title="Licence not active">
          <Text as="span">{errorMessage}</Text>
        </SectionMessage>
      </AppSurface>
    );
  }

  if (errorMessage || (isIssueView ? !row : !dashboard)) {
    return (
      <AppSurface compact={compact}>
        <SectionMessage appearance="error" title="Delivery evidence unavailable">
          <Text as="span">{errorMessage || 'Failed to load delivery evidence.'}</Text>
        </SectionMessage>
      </AppSurface>
    );
  }

  return isIssueView
    ? (
      <IssuePanel
        row={row as IssueRow}
        approval={approval}
        onReload={() => load()}
        onRow={(next, nextApproval) => { setRow(next); setApproval(nextApproval); }}
        compact={compact}
      />
    )
    : <ProjectDashboard view={dashboard as ProjectDashboardView} onRefresh={() => load(true)} viewerAccountId={viewerAccountId} />;
};
