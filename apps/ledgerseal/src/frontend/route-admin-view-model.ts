/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: view model of the "Approval routes" admin tab (ADR-017). Pure logic, no React. A route is edited as JSON;
 * the server checks every field and takes group and status names from Jira.
 *
 * @author Fahim Farook
 */

export const ROUTE_EXAMPLE = JSON.stringify(
  {
    name: 'QA then Regulatory',
    stages: [
      { stageId: 'qa', name: 'QA', orderGroup: 1, roleTypeId: 'LS_REVIEWER', approverGroupIds: ['<group id>'], quorum: 'ANY', gatesStatusIds: [] },
      { stageId: 'regulatory', name: 'Regulatory', orderGroup: 2, roleTypeId: 'LS_APPROVER', approverGroupIds: ['<group id>'], quorum: { kind: 'N', n: 2 }, gatesStatusIds: [] }
    ],
    reapprovalStageIds: null
  },
  null,
  2
);

/** The route text as a save payload, or the reason it cannot be read. */
export function parseRouteText(text: string, routeId: string | null): { ok: true; payload: any } | { ok: false; message: string } {
  let value: any;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, message: 'The route is not valid JSON. Start from the example.' };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, message: 'The route is a JSON object with name, stages and reapprovalStageIds.' };
  return { ok: true, payload: { ...(routeId ? { routeId } : {}), name: value.name, stages: value.stages, reapprovalStageIds: value.reapprovalStageIds ?? null } };
}

/** The editable text of a stored route version (group ids, not names). */
export function routeText(route: any): string {
  return JSON.stringify(
    {
      name: route.name,
      stages: (route.stages ?? []).map((s: any) => ({
        stageId: s.stageId,
        name: s.name,
        orderGroup: s.orderGroup,
        roleTypeId: s.roleTypeId,
        approverGroupIds: (s.approverGroups ?? []).map((g: any) => g.id),
        quorum: s.quorum,
        gatesStatusIds: s.gatesStatusIds
      })),
      reapprovalStageIds: route.reapprovalStageIds ?? null
    },
    null,
    2
  );
}

export interface RouteRow {
  routeId: string;
  title: string;
  stagesText: string;
  bindings: string[];
}

/** One line per route: its stages in order and where it is bound. */
export function buildRouteRows(response: any): RouteRow[] {
  const bindings: any[] = response?.bindings ?? [];
  return ((response?.routes ?? []) as any[]).map(r => ({
    routeId: String(r.routeId),
    title: `${r.name} (version ${r.version})`,
    stagesText: [...(r.stages ?? [])]
      .sort((a: any, b: any) => a.orderGroup - b.orderGroup)
      .map((s: any) => `${s.orderGroup}. ${s.name} (${s.quorum?.kind === 'N' ? `${s.quorum.n} of` : 'any one of'} ${(s.approverGroups ?? []).map((g: any) => g.name).join(', ')})`)
      .join('; '),
    bindings: bindings.filter(b => b.routeId === r.routeId).map(b => `project ${b.projectId}, ${b.issueTypeId === '*' ? 'every issue type' : `issue type ${b.issueTypeId}`}`)
  }));
}
