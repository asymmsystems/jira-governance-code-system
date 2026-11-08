/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: approval routes (ADR-017, spec v4 section 15). A route is ordered groups of stages; each stage has
 * approver groups and a quorum. A run collects stage signatures over one snapshot; the last one writes the seal.
 * Pure logic: validation, the route hash, quorum, which stages are open, and separation of duties across stages.
 *
 * @author Fahim Farook
 */

import { canonicalJson, hashWithout } from './canonical-json';
import { LedgerSealRoleTypeId } from './status';

export const MAX_STAGES = 8;
export const MAX_ORDER_GROUP = 8;
export const MAX_STAGE_GROUPS = 10;
export const MAX_QUORUM = 10;
export const MAX_GATES = 10;
export const MAX_SIGNATURES_PER_RUN = 80;
const STAGE_ID = /^[a-z0-9-]{1,32}$/;
const ROLES: LedgerSealRoleTypeId[] = ['LS_APPROVER', 'LS_REVIEWER', 'LS_VERIFIER'];

export type Quorum = { kind: 'ANY' } | { kind: 'N'; n: number };

export interface RouteStage {
  stageId: string;
  name: string;
  orderGroup: number;
  roleTypeId: LedgerSealRoleTypeId;
  approverGroups: { id: string; name: string }[];
  quorum: Quorum;
  gatesStatusIds: string[];
}

export interface RouteVersion {
  schemaVersion: 1;
  routeId: string;
  version: number;
  name: string;
  stages: RouteStage[];
  /** null: approving changes after a seal needs the full route (Q-06 default). */
  reapprovalStageIds: string[] | null;
  setByPartyId: string;
  fromDate: string;
  routeHash: string;
}

export type RunState = 'OPEN' | 'REJECTED' | 'VOIDED' | 'COMPLETE';

export interface RunSignature {
  seq: number;
  entryHash: string;
  stageId: string;
  partyId: string;
}

export interface ApprovalRun {
  schemaVersion: 1;
  issueId: string;
  runId: string;
  routeId: string;
  routeVersion: number;
  routeHash: string;
  state: RunState;
  snapshotHash: string;
  contentId: string;
  /** The status rows of this run's stage signatures, oldest first (the final one is the seal row). */
  signatures: RunSignature[];
  /** The stages this run needs: the full route, or the re-approval list after a seal (Q-06). */
  requiredStageIds: string[];
  startedAt: string;
  endedAt: string | null;
  recordHash: string;
}

/** Ids sorted, so a route's hash does not depend on the order an admin picked groups or statuses in. */
function normalisedStages(stages: RouteStage[]): RouteStage[] {
  return stages.map(s => ({
    ...s,
    approverGroups: [...s.approverGroups].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    gatesStatusIds: [...s.gatesStatusIds].sort()
  }));
}

/** The route hash: SHA-256 of the canonical JSON of every other field (spec v4 section 15.6). */
export function withRouteHash(route: Omit<RouteVersion, 'routeHash'> & { routeHash?: string }): RouteVersion {
  const draft = { ...route, stages: normalisedStages(route.stages), routeHash: '' } as RouteVersion;
  return { ...draft, routeHash: hashWithout(draft, 'routeHash') };
}

export function hasValidRouteHash(route: RouteVersion): boolean {
  return typeof route?.routeHash === 'string' && hashWithout(route, 'routeHash') === route.routeHash;
}

export function withRunHash(run: Omit<ApprovalRun, 'recordHash'> & { recordHash?: string }): ApprovalRun {
  const draft = { ...run, recordHash: '' } as ApprovalRun;
  return { ...draft, recordHash: hashWithout(draft, 'recordHash') };
}

export function hasValidRunHash(run: ApprovalRun): boolean {
  return typeof run?.recordHash === 'string' && hashWithout(run, 'recordHash') === run.recordHash;
}

/** The stages input of an admin, checked; group names are filled in later from Jira. Returns an error text or the stages. */
export function parseStages(input: unknown): RouteStage[] | string {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_STAGES) return `A route has 1 to ${MAX_STAGES} stages.`;
  const seen = new Set<string>();
  const stages: RouteStage[] = [];
  for (const raw of input as any[]) {
    const stageId = typeof raw?.stageId === 'string' ? raw.stageId : '';
    if (!STAGE_ID.test(stageId) || seen.has(stageId)) return 'Each stage needs its own id of 1 to 32 lower-case letters, digits or hyphens.';
    seen.add(stageId);
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (name.length < 1 || name.length > 60) return `Stage ${stageId}: give a name of 1 to 60 characters.`;
    const orderGroup = raw?.orderGroup;
    if (!Number.isInteger(orderGroup) || orderGroup < 1 || orderGroup > MAX_ORDER_GROUP) return `Stage ${stageId}: the order group is a whole number from 1 to ${MAX_ORDER_GROUP}.`;
    const roleTypeId = raw?.roleTypeId ?? 'LS_APPROVER';
    if (!ROLES.includes(roleTypeId)) return `Stage ${stageId}: the meaning is LS_APPROVER, LS_REVIEWER or LS_VERIFIER.`;
    const groups = raw?.approverGroupIds;
    if (!Array.isArray(groups) || groups.length < 1 || groups.length > MAX_STAGE_GROUPS || !groups.every((g: unknown) => typeof g === 'string' && g.length > 0 && g.length <= 128)) {
      return `Stage ${stageId}: choose 1 to ${MAX_STAGE_GROUPS} approver groups.`;
    }
    const q = raw?.quorum;
    let quorum: Quorum;
    if (q === undefined || q === 'ANY' || q?.kind === 'ANY') quorum = { kind: 'ANY' };
    else if (q?.kind === 'N' && Number.isInteger(q.n) && q.n >= 1 && q.n <= MAX_QUORUM) quorum = { kind: 'N', n: q.n };
    else return `Stage ${stageId}: the quorum is "any one" or N from 1 to ${MAX_QUORUM}.`;
    const gates = raw?.gatesStatusIds ?? [];
    if (!Array.isArray(gates) || gates.length > MAX_GATES || !gates.every((g: unknown) => typeof g === 'string' && /^[0-9]{1,18}$/.test(g))) {
      return `Stage ${stageId}: name at most ${MAX_GATES} target status ids.`;
    }
    stages.push({ stageId, name, orderGroup, roleTypeId, approverGroups: [...new Set(groups as string[])].map(id => ({ id, name: '' })), quorum, gatesStatusIds: [...new Set(gates as string[])] });
  }
  // Order groups are used in order: 1, then 2, with no gap
  const groups = [...new Set(stages.map(s => s.orderGroup))].sort((a, b) => a - b);
  if (groups.some((g, i) => g !== i + 1)) return 'Order groups start at 1 and have no gap.';
  return stages;
}

/** How many distinct people a stage needs. */
export function quorumOf(stage: RouteStage): number {
  return stage.quorum.kind === 'ANY' ? 1 : stage.quorum.n;
}

/** Distinct signers per stage in a run. */
export function stageCounts(run: Pick<ApprovalRun, 'signatures'> | null): Map<string, Set<string>> {
  const counts = new Map<string, Set<string>>();
  for (const s of run?.signatures ?? []) {
    if (!counts.has(s.stageId)) counts.set(s.stageId, new Set());
    counts.get(s.stageId)!.add(s.partyId);
  }
  return counts;
}

export function requiredStages(route: RouteVersion, requiredStageIds: string[] | null): RouteStage[] {
  return requiredStageIds ? route.stages.filter(s => requiredStageIds.includes(s.stageId)) : route.stages;
}

/** The stages a new run needs: the full route, or its re-approval list once a seal exists (Q-06). */
export function stagesForNewRun(route: RouteVersion, sealExists: boolean): string[] {
  const list = sealExists && route.reapprovalStageIds && route.reapprovalStageIds.length > 0 ? route.reapprovalStageIds : route.stages.map(s => s.stageId);
  return route.stages.filter(s => list.includes(s.stageId)).map(s => s.stageId);
}

export function isStageComplete(stage: RouteStage, counts: Map<string, Set<string>>): boolean {
  return (counts.get(stage.stageId)?.size ?? 0) >= quorumOf(stage);
}

/** The stages that may be signed now: the incomplete stages of the lowest order group that has one. */
export function openStages(route: RouteVersion, required: string[], counts: Map<string, Set<string>>): RouteStage[] {
  const stages = requiredStages(route, required);
  const incomplete = stages.filter(s => !isStageComplete(s, counts));
  if (incomplete.length === 0) return [];
  const group = Math.min(...incomplete.map(s => s.orderGroup));
  return incomplete.filter(s => s.orderGroup === group);
}

export function isRouteComplete(route: RouteVersion, required: string[], counts: Map<string, Set<string>>): boolean {
  return requiredStages(route, required).every(s => isStageComplete(s, counts));
}

/** True when the person signed a stage of this run already (one person, one stage, invariant 16). */
export function signedOtherStage(run: Pick<ApprovalRun, 'signatures'> | null, partyId: string): boolean {
  return (run?.signatures ?? []).some(s => s.partyId === partyId);
}

/**
 * The stage gate (ADR-017 decision 11): a move to a status that a stage gates passes when that stage and every stage of
 * an earlier order group have their quorum. Null when no stage gates the status.
 */
export function gateFor(route: RouteVersion, required: string[], counts: Map<string, Set<string>>, toStatusId: string): { stage: RouteStage; met: boolean } | null {
  const stage = requiredStages(route, required).find(s => s.gatesStatusIds.includes(String(toStatusId)));
  if (!stage) return null;
  const needed = requiredStages(route, required).filter(s => s.orderGroup < stage.orderGroup || s.stageId === stage.stageId);
  return { stage, met: needed.every(s => isStageComplete(s, counts)) };
}

/** The canonical JSON of a route version without its hash, the text a verifier hashes. */
export function routeCanonicalText(route: RouteVersion): string {
  const { routeHash: _h, ...rest } = route;
  return canonicalJson(rest);
}
