/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: view model of an approval route in the panel (ADR-017, spec v4 section 15.1). Pure logic, no React.
 *
 * @author Fahim Farook
 */

import { MEANINGS } from '../domain/declaration';
import { formatTime } from './view-model';

export interface StageRowView {
  stageId: string;
  name: string;
  meaning: string;
  meaningLabel: string;
  progress: string;
  signedAccountIds: string[];
  open: boolean;
  canSign: boolean;
  canReject: boolean;
  /** The stage has its quorum in the run shown. */
  done: boolean;
}

export interface RouteView {
  title: string;
  stateText: string;
  stages: StageRowView[];
  rejectionText: string | null;
  invalid: boolean;
}

/** The route section, or null when the issue has no route. */
export function buildRouteView(route: any, locale?: string, timeZone?: string): RouteView | null {
  if (!route) return null;
  if (route.invalid) return { title: 'Approval route', stateText: 'The approval record failed its integrity check. Contact your Jira admin.', stages: [], rejectionText: null, invalid: true };
  const stages: StageRowView[] = (route.stages ?? []).map((s: any) => ({
    stageId: String(s.stageId),
    name: String(s.name),
    meaning: String(s.meaning),
    meaningLabel: MEANINGS.find(m => m.value === s.meaning)?.label ?? String(s.meaning),
    progress: `${(s.signed ?? []).length} of ${s.quorum} signed`,
    signedAccountIds: (s.signed ?? []).map((x: any) => String(x.accountId)).filter(Boolean),
    open: Boolean(s.open),
    canSign: Boolean(s.canSign),
    canReject: Boolean(s.canReject),
    done: (s.signed ?? []).length >= Number(s.quorum)
  }));
  const complete = stages.filter(s => s.done);
  let stateText: string;
  if (route.open) stateText = `In approval: ${complete.length} of ${stages.length} stages complete.`;
  else if (route.runState === 'COMPLETE') stateText = 'Approved through every stage.';
  else if (route.runState === 'REJECTED') stateText = 'Rejected. The next signature starts the approval again.';
  else if (route.runState === 'VOIDED') stateText = 'The issue changed during approval, so the approval starts again.';
  else stateText = 'Not started. The first stage signs first.';
  const rejection = route.rejection;
  const stageName = rejection ? stages.find(s => s.stageId === rejection.stageId)?.name ?? 'A stage' : '';
  return {
    title: `Approval route: ${route.name}`,
    stateText,
    stages,
    rejectionText: rejection ? `${stageName} rejected on ${formatTime(rejection.at, locale, timeZone)}. Reason: ${rejection.reason}` : null,
    invalid: false
  };
}
