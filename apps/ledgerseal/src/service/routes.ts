/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: approval routes (ADR-017 option A, spec v4 section 15). A Jira admin defines routes and binds them to a
 * project and issue types. Approvers sign stages; every stage of a run signs the same snapshot; the stage that
 * completes the route writes the seal. A person signs at most one stage of a run; the author of a covered change
 * cannot sign any stage that approves it; a rejection or a covered change ends the run.
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';
import { computeSnapshotHash } from '../domain/crypto';
import { declarationFor, declarationHash, isDeclarationV2Approved, validReason } from '../domain/declaration';
import { buildStatusRow } from '../domain/history';
import {
  ApprovalRun,
  gateFor,
  isRouteComplete,
  openStages,
  parseStages,
  requiredStages,
  RouteStage,
  RouteVersion,
  signedOtherStage,
  stageCounts,
  stagesForNewRun,
  withRouteHash,
  withRunHash
} from '../domain/route';
import { withRecordHash } from '../domain/seal-record';
import { meaningForRole } from '../domain/status';
import { SigningEvidence, SigningPolicy } from '../domain/signing';
import { PartyRepository, PartyResolver } from '../storage/party-repository';
import { RouteRepository, StoredRun } from '../storage/route-repository';
import { MAX_CONTENT_PARTS, MAX_PART_BYTES, SealRepository, splitUtf8 } from '../storage/seal-repository';
import {
  browseDenied,
  contextIssue,
  evaluate,
  fail,
  LedgerSealDeps,
  licenseInactive,
  LiveRead,
  part11Policy,
  readLiveSnapshot,
  SealFailure,
  policyReference,
  sealIssueFlow,
  viewHash,
  withParty,
  writeIssueAttestation
} from './ledger';
import { changeAuthorsSince } from '../domain/policy';
import { isExcludedField } from '../domain/canonicalizer';
import { adminCaller } from './policy-admin';
import { checkSigningCode, giveBackCode, recordSignOk } from './signing';

const MAX_ROUTES = 50;
/** Tries to take a busy run lock before the flow answers "try again" (about 4 seconds in all). */
const RUN_LOCK_TRIES = 20;
export const RUN_BUSY_MESSAGE = 'Someone else is signing this issue at this moment. Try again in a few seconds.';
const MAX_NAME = 60;

// ---------------------------------------------------------------------------------------------------------------
// Admin flows (Jira admins only, Q-08)
// ---------------------------------------------------------------------------------------------------------------

/** `route-list-api`: the routes, their current versions and the bindings. */
export async function listRoutesFlow(context: any, deps: LedgerSealDeps) {
  const caller = await adminCaller(context, deps);
  if (typeof caller !== 'string') return caller;
  const repo = new RouteRepository(deps.storage);
  const routes = await Promise.all((await repo.heads()).map(h => repo.current(h.routeId)));
  return { ok: true as const, routes: routes.filter(Boolean), bindings: await repo.bindings() };
}

/**
 * `route-save-api`: a new route, or a new version of one. Group ids must exist in Jira (their names are Jira's) and
 * target status ids must exist. Running runs keep the version they started with (Q-07).
 */
export async function saveRouteFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const caller = await adminCaller(context, deps);
  if (typeof caller !== 'string') return caller;
  const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
  if (name.length < 1 || name.length > MAX_NAME) return fail('INVALID_REQUEST', `LedgerSeal: give the route a name of 1 to ${MAX_NAME} characters.`);
  const stages = parseStages(payload?.stages);
  if (typeof stages === 'string') return fail('INVALID_REQUEST', `LedgerSeal: ${stages}`);
  const reapproval = payload?.reapprovalStageIds;
  if (reapproval !== undefined && reapproval !== null && (!Array.isArray(reapproval) || reapproval.length === 0 || !reapproval.every((id: unknown) => stages.some(s => s.stageId === id)))) {
    return fail('INVALID_REQUEST', 'LedgerSeal: the re-approval stages must be stages of this route.');
  }
  const groupIds = [...new Set(stages.flatMap(s => s.approverGroups.map(g => g.id)))];
  const found = await deps.jira.getGroups(groupIds);
  if (!found.ok) return fail('JIRA_UNREACHABLE', 'LedgerSeal could not read the groups from Jira. Nothing was saved. Try again.');
  const names = new Map(found.value.map(g => [g.groupId, g.name]));
  if (groupIds.some(id => !names.has(id))) return fail('INVALID_REQUEST', 'A chosen group was not found in Jira. Nothing was saved.');
  const statusIds = [...new Set(stages.flatMap(s => s.gatesStatusIds))];
  if (statusIds.length > 0) {
    const statuses = await deps.jira.getStatuses(statusIds);
    if (!statuses.ok) return fail('JIRA_UNREACHABLE', 'LedgerSeal could not read the statuses from Jira. Nothing was saved. Try again.');
    if (statuses.value.length !== statusIds.length) return fail('INVALID_REQUEST', 'A target status was not found in Jira. Nothing was saved.');
  }
  const repo = new RouteRepository(deps.storage);
  const existingId = typeof payload?.routeId === 'string' ? payload.routeId : null;
  const head = existingId ? await repo.head(existingId) : null;
  if (existingId && !head) return fail('INVALID_REQUEST', 'LedgerSeal: no such route.');
  if (!existingId && (await repo.heads()).length >= MAX_ROUTES) return fail('INVALID_REQUEST', `LedgerSeal: at most ${MAX_ROUTES} routes.`);
  const parties = new PartyRepository(deps.storage);
  const party = await parties.partyForWrite();
  const at = new Date().toISOString();
  await parties.register([caller], party, at);
  const route = withRouteHash({
    schemaVersion: 1,
    routeId: head?.routeId ?? 'rte_' + crypto.randomBytes(8).toString('hex'),
    version: (head?.currentVersion ?? 0) + 1,
    name,
    stages: stages.map(s => ({ ...s, approverGroups: s.approverGroups.map(g => ({ id: g.id, name: names.get(g.id) as string })) })),
    reapprovalStageIds: reapproval ?? null,
    setByPartyId: party(caller),
    fromDate: at
  });
  if (!(await repo.saveVersion(route))) return fail('CONFLICT', 'Another admin saved this route a moment ago. Reload and try again.');
  return { ok: true as const, route };
}

/** `route-bind-api`: binds a route to a project and an issue type id (or "*" for all of the project's types). */
export async function bindRouteFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const caller = await adminCaller(context, deps);
  if (typeof caller !== 'string') return caller;
  const key = typeof payload?.projectKey === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(payload.projectKey) ? payload.projectKey : '';
  const issueTypeId = payload?.issueTypeId === '*' || (typeof payload?.issueTypeId === 'string' && /^[0-9]{1,18}$/.test(payload.issueTypeId)) ? payload.issueTypeId : '';
  const routeId = typeof payload?.routeId === 'string' ? payload.routeId : '';
  if (!key || !issueTypeId) return fail('INVALID_REQUEST', 'LedgerSeal: give a project key and an issue type id, or * for every issue type.');
  const repo = new RouteRepository(deps.storage);
  if (!(await repo.head(routeId))) return fail('INVALID_REQUEST', 'LedgerSeal: no such route.');
  const projects = await deps.jira.getProjects([key]);
  if (!projects.ok) return fail('JIRA_UNREACHABLE');
  if (projects.value.length !== 1) return fail('INVALID_REQUEST', 'The project was not found in Jira. Nothing was saved.');
  const parties = new PartyRepository(deps.storage);
  const party = await parties.partyForWrite();
  const at = new Date().toISOString();
  await parties.register([caller], party, at);
  const binding = { routeId, projectId: projects.value[0].id, issueTypeId, setByPartyId: party(caller), fromDate: at };
  await repo.bind(binding);
  return { ok: true as const, binding };
}

/** `route-unbind-api`. A running run keeps its route version; the next run follows the bindings. */
export async function unbindRouteFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const caller = await adminCaller(context, deps);
  if (typeof caller !== 'string') return caller;
  const projectId = typeof payload?.projectId === 'string' && /^[0-9]{1,18}$/.test(payload.projectId) ? payload.projectId : '';
  const issueTypeId = payload?.issueTypeId === '*' || (typeof payload?.issueTypeId === 'string' && /^[0-9]{1,18}$/.test(payload.issueTypeId)) ? payload.issueTypeId : '';
  if (!projectId || !issueTypeId) return fail('INVALID_REQUEST');
  await new RouteRepository(deps.storage).unbind(projectId, issueTypeId);
  return { ok: true as const };
}

// ---------------------------------------------------------------------------------------------------------------
// Resolution and run state
// ---------------------------------------------------------------------------------------------------------------

export interface RouteContext {
  route: RouteVersion;
  run: StoredRun | null;
  /** The run is open; otherwise a new run starts at the next signature. */
  open: boolean;
}

/**
 * The route that applies to the issue: the open run's pinned version (Q-07), or the bound route. Null when no route
 * applies (spec v3 behaviour). 'invalid' when a stored record fails its hash (fail closed).
 */
export async function routeFor(deps: LedgerSealDeps, issueId: string, scope?: { projectId: string; issueTypeId: string }): Promise<RouteContext | null | 'invalid' | 'unreachable'> {
  const repo = new RouteRepository(deps.storage);
  const run = await repo.run(issueId);
  if (run === 'invalid') return 'invalid';
  if (run && run.state === 'OPEN') {
    const pinned = await repo.version(run.routeId, run.routeVersion);
    return pinned ? { route: pinned, run, open: true } : 'invalid';
  }
  const bindings = await repo.bindings();
  if (bindings.length === 0) return run ? await closedRunContext(repo, run) : null;
  let where = scope;
  if (!where) {
    const read = await deps.jira.getIssueScope(issueId);
    if (!read.ok) return 'unreachable';
    where = read.value;
  }
  const binding = await repo.binding(where.projectId, where.issueTypeId);
  if (!binding) return run ? await closedRunContext(repo, run) : null;
  const route = await repo.current(binding.routeId);
  return route ? { route, run, open: false } : 'invalid';
}

/** A finished run whose route is no longer bound still describes the issue's last approval. */
async function closedRunContext(repo: RouteRepository, run: StoredRun): Promise<RouteContext | null> {
  const route = await repo.version(run.routeId, run.routeVersion);
  return route ? { route, run, open: false } : null;
}

/**
 * Review H-1: runs `fn` while holding the issue's run lock, so the run it reads is the run it writes over. A call
 * that already holds the lock runs `fn` at once. 'busy' when the lock stays taken.
 */
export async function withRunLock<T>(deps: LedgerSealDeps, issueId: string, fn: (locked: LedgerSealDeps) => Promise<T>): Promise<T | 'busy'> {
  if (deps.heldRunLocks?.has(issueId)) return fn(deps);
  const repo = new RouteRepository(deps.storage);
  const owner = crypto.randomUUID();
  for (let attempt = 0; attempt < RUN_LOCK_TRIES; attempt++) {
    if (await repo.acquireRunLock(issueId, owner, Date.now())) {
      try {
        return await fn({ ...deps, heldRunLocks: new Map([...(deps.heldRunLocks ?? new Map<string, string>()), [issueId, owner]]) });
      } finally {
        await repo.releaseRunLock(issueId, owner);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100 + Math.floor(Math.random() * 150)));
  }
  return 'busy';
}

/**
 * Review round 2 (R2-5): the fencing check before a run write. False when the call holds the issue's run lock in
 * name but the stored lock names another owner (it was taken over), so the write must not happen.
 */
export async function stillHoldsRunLock(deps: LedgerSealDeps, issueId: string): Promise<boolean> {
  const mine = deps.heldRunLocks?.get(issueId);
  if (!mine) return true;
  return (await new RouteRepository(deps.storage).runLockOwner(issueId)) === mine;
}

/** True when a route is bound to the issue, so a seal must go through its stages (not the plain panel seal). */
export async function routeGovernsSeal(deps: LedgerSealDeps, issueId: string): Promise<boolean | SealFailure> {
  const repo = new RouteRepository(deps.storage);
  const run = await repo.run(issueId);
  if (run === 'invalid') return fail('INVALID_REQUEST', 'The approval record failed its integrity check. Contact your Jira admin.');
  if (run && run.state === 'OPEN') return true;
  if ((await repo.bindings()).length === 0) return false;
  const scope = await deps.jira.getIssueScope(issueId);
  if (!scope.ok) return fail('JIRA_UNREACHABLE');
  return Boolean(await repo.binding(scope.value.projectId, scope.value.issueTypeId));
}

/** The chain head the next row continues: the sealed work effort's, or the run's while there is no seal. */
async function chainHead(deps: LedgerSealDeps, issueId: string, run: StoredRun | null) {
  const we = await new SealRepository(deps.storage).getWorkEffort(issueId);
  if (we) return { we, head: we.statusHead };
  return { we: null, head: run && run.chainHead.seq > 0 ? run.chainHead : null };
}

/** Appends a run row and moves the head of the sealed work effort, if any, so the chain stays one chain. */
async function appendRunRow(deps: LedgerSealDeps, issueId: string, run: StoredRun | null, fields: Parameters<typeof buildStatusRow>[1]) {
  const repo = new SealRepository(deps.storage);
  if (!(await stillHoldsRunLock(deps, issueId))) return null;
  const { we, head } = await chainHead(deps, issueId, run);
  const row = buildStatusRow(head, fields);
  if (!(await repo.appendStatus(row))) return null;
  if (we) {
    try {
      await repo.saveWorkEffort(withRecordHash({ ...we, revisionNumber: row.seq, statusHead: { seq: row.seq, entryHash: row.entryHash } }));
    } catch (err) {
      await repo.removeStatus(row);
      throw err;
    }
  }
  return row;
}

async function saveRun(deps: LedgerSealDeps, run: Omit<ApprovalRun, 'recordHash'>, head: { seq: number; entryHash: string }): Promise<StoredRun> {
  const stored: StoredRun = { ...withRunHash(run), chainHead: head };
  if (!(await stillHoldsRunLock(deps, run.issueId))) throw new Error('LedgerSeal: the run lock was taken over; the run record was not written.');
  await new RouteRepository(deps.storage).saveRun(stored);
  return stored;
}

/**
 * Voids an open run whose snapshot differs from the live issue (ADR-017 decision 6): a "run voided" row, not an
 * incident. Writes nothing when there is no open run or the issue did not change. Returns true when it voided.
 */
export async function voidRunIfChanged(deps: LedgerSealDeps, issueId: string, live: LiveRead, at: string): Promise<boolean> {
  // A cheap read first (the panel calls this on every load); the void itself re-reads the run under the run lock
  const first = await new RouteRepository(deps.storage).run(issueId);
  if (!first || first === 'invalid' || first.state !== 'OPEN') return false;
  const liveHash = computeSnapshotHash(live.snapshot);
  if (liveHash === first.snapshotHash) return false;
  const done = await withRunLock(deps, issueId, locked => voidLocked(locked, issueId, liveHash, at));
  return done === true;
}

async function voidLocked(deps: LedgerSealDeps, issueId: string, liveHash: string, at: string): Promise<boolean> {
  const run = await new RouteRepository(deps.storage).run(issueId);
  if (!run || run === 'invalid' || run.state !== 'OPEN' || liveHash === run.snapshotHash) return false;
  const row = await appendRunRow(deps, issueId, run, {
    workEffortId: issueId,
    statusId: 'LS_RUN_VOIDED',
    statusDatetime: at,
    setByPartyId: null,
    reason: null,
    transitionName: 'VOID',
    data: { runId: run.runId, liveHash }
  });
  if (!row) return false;
  const { chainHead: _h, recordHash: _r, ...rest } = run;
  await saveRun(deps, { ...rest, state: 'VOIDED', endedAt: at }, { seq: row.seq, entryHash: row.entryHash });
  const seal = await new SealRepository(deps.storage).getSeal(issueId);
  await writeIssueAttestation(deps, issueId, seal && seal !== 'missing' ? seal : null, seal && seal !== 'missing' ? sealStatus(seal.workEffort.currentStatusId) : null, at);
  return true;
}

function sealStatus(id: string) {
  return id === 'LS_SEALED' ? ('SEAL_VALID' as const) : id === 'LS_CHANGED' ? ('SEAL_BROKEN' as const) : ('SEAL_REVOKED' as const);
}

// ---------------------------------------------------------------------------------------------------------------
// Stage signing and rejection
// ---------------------------------------------------------------------------------------------------------------

/** The stage group that qualifies the caller, read as the user; null when none does. */
async function qualifyingGroup(deps: LedgerSealDeps, stage: RouteStage): Promise<string | null | SealFailure> {
  const groups = await deps.jira.getMyGroupIds();
  if (!groups.ok) return fail(groups.error === 'FORBIDDEN' ? 'NOT_APPROVER' : 'JIRA_UNREACHABLE');
  const mine = new Set(groups.value);
  return stage.approverGroups.map(g => g.id).find(id => mine.has(id)) ?? null;
}

/** True when the person changed covered content since `sinceIso` (the spec v3 section 7.2 rule, for every stage). */
async function changedSince(deps: LedgerSealDeps, issueId: string, live: LiveRead, sinceIso: string, version: string, accountId: string): Promise<boolean | null> {
  const changelog = await deps.jira.getChangelog(issueId);
  if (!changelog.ok) return null;
  return changeAuthorsSince(changelog.value, live.raw, sinceIso, id => !isExcludedField(version, id, live.fields)).has(accountId);
}

/**
 * The stage a code request names (review L-7): the stage, null when no route applies or the record fails its hash,
 * 'closed' when the stage is not open now. Reads as the app; the caller reads the person's groups as the user first.
 */
export async function openStageFor(deps: LedgerSealDeps, issueId: string, stageId: string | null): Promise<RouteStage | null | 'closed' | 'unreachable'> {
  const ctx = await routeFor(deps, issueId);
  if (ctx === 'unreachable') return 'unreachable';
  if (!ctx || ctx === 'invalid') return null;
  const sealExists = Boolean(await new SealRepository(deps.storage).getWorkEffort(issueId));
  const required = ctx.open && ctx.run ? ctx.run.requiredStageIds : stagesForNewRun(ctx.route, sealExists);
  return openStages(ctx.route, required, stageCounts(ctx.open ? ctx.run : null)).find(s => s.stageId === stageId) ?? 'closed';
}

/**
 * The run-dependent decisions of a stage action: the route, an open stage, and whether a seal exists. Made in the
 * checks, and made again under the run lock just before the write (review H-1), from a fresh read of the run.
 */
async function runDecision(deps: LedgerSealDeps, issueId: string, live: LiveRead, stageId: string): Promise<{ ctx: RouteContext; stage: RouteStage; sealExists: boolean } | SealFailure> {
  const scope = { projectId: String(live.raw?.fields?.project?.id ?? ''), issueTypeId: String(live.raw?.fields?.issuetype?.id ?? '') };
  const ctx = await routeFor(deps, issueId, scope);
  if (ctx === 'invalid') return fail('INVALID_REQUEST', 'The approval record failed its integrity check. Contact your Jira admin.');
  if (ctx === 'unreachable') return fail('JIRA_UNREACHABLE');
  if (!ctx) return fail('NOT_ROUTED');
  const stage = ctx.route.stages.find(s => s.stageId === stageId);
  if (!stage) return fail('STAGE_NOT_OPEN');
  const sealExists = Boolean(await new SealRepository(deps.storage).getWorkEffort(issueId));
  const required = ctx.open && ctx.run ? ctx.run.requiredStageIds : stagesForNewRun(ctx.route, sealExists);
  if (!openStages(ctx.route, required, stageCounts(ctx.open ? ctx.run : null)).some(s => s.stageId === stageId)) return fail('STAGE_NOT_OPEN');
  return { ctx, stage, sealExists };
}

/**
 * Review H-1: the decisions made again under the run lock. The run may have changed since the checks (another tab,
 * another signer, a void): the stage must still be open, the person must not have signed another stage of the run,
 * and an open run must still hold the snapshot this person signs.
 */
async function lockedStep(deps: LedgerSealDeps, step: StageStep): Promise<StageStep | SealFailure> {
  const decided = await runDecision(deps, step.issue.id, step.live, step.stage.stageId);
  if ('code' in decided) return decided;
  const { ctx, stage, sealExists } = decided;
  if (ctx.open && signedOtherStage(ctx.run, step.party(step.accountId))) return fail('SAME_PERSON_STAGE');
  if (ctx.open && ctx.run && ctx.run.snapshotHash !== computeSnapshotHash(step.live.snapshot)) return fail('ISSUE_CHANGED');
  // The run ended (voided, rejected, revoked or completed) since the checks: the person signs it again on a fresh view
  if (step.ctx.open && step.ctx.run && ctx.run?.runId === step.ctx.run.runId && !ctx.open) return fail('ISSUE_CHANGED');
  // Review round 2 (R2-1): the seal changed state (a revoke, a new seal) since the checks
  if ((await sealState(deps, step.issue.id)) !== step.sealState) return fail('ISSUE_CHANGED');
  // Review round 2 (R2-2): the code is checked under the lock, after every decision, so a busy issue or a refused
  // decision leaves the person's code unused
  let signingEvidence: SigningEvidence | null = null;
  if (step.policy) {
    const checked = await checkSigningCode(deps, { accountId: step.accountId, partyId: step.party(step.accountId), issueId: step.issue.id, action: step.action, stageId: step.stage.stageId, policy: step.policy, signing: step.signing });
    if (!checked.ok) return checked;
    signingEvidence = checked.evidence;
  }
  return { ...step, ctx, stage, sealExists, signingEvidence };
}

/** The seal's state and certificate, to see whether it changed between the checks and the write. */
async function sealState(deps: LedgerSealDeps, issueId: string): Promise<string> {
  const we = await new SealRepository(deps.storage).getWorkEffort(issueId);
  return we ? `${we.currentStatusId}:${we.currentContentId}` : 'none';
}

/** Records SIGN_OK after a written signature, or gives the code back when nothing was written (review round 2, R2-2). */
async function settleCode<T extends { ok: boolean }>(deps: LedgerSealDeps, step: StageStep, result: T): Promise<T> {
  if (!step.signingEvidence) return result;
  if (result.ok) await recordSignOk(deps, step.party(step.accountId), { issueId: step.issue.id, action: step.action, challengeId: step.signingEvidence.challengeId });
  else await giveBackCode(deps, step.signingEvidence);
  return result;
}

interface StageStep {
  accountId: string;
  issue: { id: string; key: string };
  stage: RouteStage;
  ctx: RouteContext;
  live: LiveRead;
  party: (accountId: string) => string;
  policy: SigningPolicy | null;
  signingEvidence: SigningEvidence | null;
  qualifyingGroupId: string;
  sealExists: boolean;
  action: 'SIGN_STAGE' | 'REJECT';
  signing: unknown;
  sealState: string;
  declaration: { version: string; text: string };
}

/**
 * The checks shared by stage signing and rejection: identity, licence, Browse (as the user), a route, an open stage,
 * stage group membership (as the user), one stage per person, the shown hash, separation of duties, and in a
 * code-signing project the code. The run is voided first when the issue changed since its snapshot.
 */
async function stageChecks(payload: any, context: any, deps: LedgerSealDeps, action: 'SIGN_STAGE' | 'REJECT'): Promise<StageStep | SealFailure> {
  const accountId = context?.accountId ? String(context.accountId) : '';
  if (!accountId) return fail('NO_IDENTITY');
  if (licenseInactive(context)) return fail('LICENSE_INACTIVE');
  const issue = contextIssue(context);
  if (!issue) return fail('MISSING_ISSUE');
  const stageId = typeof payload?.stageId === 'string' ? payload.stageId : '';
  if (!/^[a-z0-9-]{1,32}$/.test(stageId)) return fail('INVALID_REQUEST');
  const denied = await browseDenied(deps, issue.id);
  if (denied) return denied;

  const now = new Date().toISOString();
  const parties = new PartyRepository(deps.storage);
  const read = await readLiveSnapshot(deps.jira, issue.id, now, { party: await parties.partyForRead() });
  if (!read) return fail('JIRA_UNREACHABLE');
  if (typeof payload?.viewHash !== 'string') return fail('INVALID_REQUEST');
  if (payload.viewHash !== viewHash(read, now)) return fail('ISSUE_CHANGED');
  const party = await parties.partyForWrite();
  const live = withParty(read, party, now);
  // A covered change since the run's snapshot ends it before anyone signs again (ADR-017 decision 6)
  await voidRunIfChanged(deps, issue.id, live, now);

  const decided = await runDecision(deps, issue.id, live, stageId);
  if ('code' in decided) return decided;
  const { ctx, stage, sealExists } = decided;
  const group = await qualifyingGroup(deps, stage);
  if (group === null) return fail('NOT_APPROVER', `You are not in a group of the ${stage.name} stage.`);
  if (typeof group !== 'string') return group;
  const token = party(accountId);
  if (ctx.open && signedOtherStage(ctx.run, token)) return fail('SAME_PERSON_STAGE');
  const seals = new SealRepository(deps.storage);
  const sealed = await seals.getSeal(issue.id);

  // Separation of duties: the author of a covered change since the last seal signs no stage that approves it
  if (sealed && sealed !== 'missing') {
    const evaluation = await evaluate(seals, issue.id, live, now);
    if (evaluation.kind === 'SEAL' && evaluation.analysis.status !== 'SEAL_VALID') {
      const self = await changedSince(deps, issue.id, live, sealed.assignment.fromDate, sealed.workEffort.attributes.canonicalizerVersion, accountId);
      if (self === null) return fail('JIRA_UNREACHABLE');
      if (self) return fail('SELF_APPROVAL');
    }
  }

  const part11 = await part11Policy(deps, issue.id);
  if (part11 && 'code' in part11) return part11;
  const policy = part11 as SigningPolicy | null;
  const declaration = declarationFor(Boolean(policy));
  const signature = payload?.signature ?? {};
  // Review round 2 (D-1): a rejection is a signature too; its signer agrees to the declaration shown, as a stage signer does
  if (signature.declarationVersion !== declaration.version || signature.declarationText !== declaration.text) return fail('DECLARATION_MISMATCH');
  if (policy && !isDeclarationV2Approved()) return fail('DECLARATION_PENDING');
  return {
    accountId,
    issue,
    stage,
    ctx,
    live,
    party,
    policy,
    signingEvidence: null,
    qualifyingGroupId: group,
    sealExists,
    action,
    signing: payload?.signing,
    sealState: await sealState(deps, issue.id),
    declaration
  };
}

/**
 * `stage-sign-api` (spec v4 section 15.3): signs one open stage. The stage that completes the route writes the seal
 * itself, naming every stage signature of the run; any other stage writes an LS_RUN_SIGNED row.
 */
export async function signStageFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const checked = await stageChecks(payload, context, deps, 'SIGN_STAGE');
  if ('ok' in checked) return checked;
  const done = await withRunLock(deps, checked.issue.id, async locked => {
    const step = await lockedStep(locked, checked);
    return 'ok' in step ? step : settleCode(locked, step, await signLocked(payload, locked, step));
  });
  return done === 'busy' ? fail('CONFLICT', RUN_BUSY_MESSAGE) : done;
}

async function signLocked(payload: any, deps: LedgerSealDeps, step: StageStep) {
  const { accountId, issue, stage, ctx, live, party, policy, signingEvidence, qualifyingGroupId, sealExists } = step;
  const now = new Date().toISOString();
  const token = party(accountId);
  const runs = new RouteRepository(deps.storage);
  const liveHash = computeSnapshotHash(live.snapshot);

  // A new run pins the route version and stores the snapshot every stage signs (invariant 17)
  let run: Omit<ApprovalRun, 'recordHash'>;
  if (ctx.open && ctx.run) {
    const { chainHead: _h, recordHash: _r, ...rest } = ctx.run;
    run = rest;
  } else {
    const contentId = crypto.randomUUID();
    const parts = splitUtf8(JSON.stringify(live.snapshot), MAX_PART_BYTES);
    if (parts.length > MAX_CONTENT_PARTS) return fail('SNAPSHOT_TOO_LARGE');
    await deps.storage.commit(parts.map((value, part) => ({ key: `ls3:runcontent:${contentId}:${part}`, value })));
    run = {
      schemaVersion: 1,
      issueId: issue.id,
      runId: crypto.randomUUID(),
      routeId: ctx.route.routeId,
      routeVersion: ctx.route.version,
      routeHash: ctx.route.routeHash,
      state: 'OPEN',
      snapshotHash: liveHash,
      contentId,
      signatures: [],
      requiredStageIds: stagesForNewRun(ctx.route, sealExists),
      startedAt: now,
      endedAt: null
    };
  }
  const counts = stageCounts({ signatures: [...run.signatures, { seq: 0, entryHash: '', stageId: stage.stageId, partyId: token }] });
  const completes = isRouteComplete(ctx.route, run.requiredStageIds, counts);
  const runData = { runId: run.runId, routeId: run.routeId, routeVersion: run.routeVersion, routeHash: run.routeHash, stageId: stage.stageId, qualifyingGroupId, snapshotHash: run.snapshotHash };

  if (!completes) {
    const policyRef = await policyReference(deps, String(live.snapshot.projectId ?? ''), policy);
    if (policyRef === 'changed') return fail('POLICY_CHANGED');
    // The chain continues from the previous run's head even when that run ended (rejected or voided)
    const row = await appendRunRow(deps, issue.id, ctx.run, {
      workEffortId: issue.id,
      statusId: 'LS_RUN_SIGNED',
      statusDatetime: now,
      setByPartyId: token,
      reason: null,
      transitionName: 'SIGN_STAGE',
      data: {
        ...runData,
        declarationVersion: step.declaration.version,
        declarationHash: declarationHash(step.declaration.text),
        ...(signingEvidence ? { signing: signingEvidence } : {}),
        ...(policyRef ? { signingPolicy: policyRef } : {})
      }
    });
    if (!row) return fail('CONFLICT');
    await new PartyRepository(deps.storage).register([accountId], party, now);
    await saveRun(deps, { ...run, signatures: [...run.signatures, { seq: row.seq, entryHash: row.entryHash, stageId: stage.stageId, partyId: token }] }, { seq: row.seq, entryHash: row.entryHash });
    const seal = await new SealRepository(deps.storage).getSeal(issue.id);
    const loaded = seal && seal !== 'missing' ? seal : null;
    await writeIssueAttestation(deps, issue.id, loaded, loaded ? sealStatus(loaded.workEffort.currentStatusId) : null, now);
    return { ok: true as const, runState: 'OPEN' as const, stageId: stage.stageId };
  }

  // The completing stage writes the seal through the seal flow, with the route data and the run's chain head
  if (!(await stillHoldsRunLock(deps, issue.id))) return fail('CONFLICT');
  const { head } = await chainHead(deps, issue.id, ctx.run);
  const sealed: any = await sealIssueFlow(
    { viewHash: payload.viewHash, signature: { ...(payload.signature ?? {}), meaning: meaningForRole(stage.roleTypeId) } },
    { accountId, extension: { issue } },
    deps,
    {
      complete: {
        policy,
        signingEvidence,
        transitionToStatusId: null,
        chainHead: head,
        extraData: { ...runData, stageSignatures: run.signatures.map(s => s.entryHash), requiredStageIds: run.requiredStageIds },
        beforeAttestation: async (row: { seq: number; entryHash: string }) => {
          await saveRun(deps, { ...run, state: 'COMPLETE', endedAt: now, signatures: [...run.signatures, { seq: row.seq, entryHash: row.entryHash, stageId: stage.stageId, partyId: token }] }, row);
        }
      }
    }
  );
  if (!sealed.ok) return sealed;
  await runs.deleteRunContent(run.contentId, deps.storage);
  return { ok: true as const, runState: 'COMPLETE' as const, stageId: stage.stageId, certificateId: sealed.certificateId };
}

/** `stage-reject-api`: a person allowed to sign an open stage rejects, with a reason; the run ends (decision 5). */
export async function rejectStageFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const reason = validReason(payload?.reason);
  if (context?.accountId && !reason) return fail('REASON_REQUIRED', 'Give a reason for rejecting (1 to 500 characters).');
  const checked = await stageChecks(payload, context, deps, 'REJECT');
  if ('ok' in checked) return checked;
  const done = await withRunLock(deps, checked.issue.id, async locked => {
    const step = await lockedStep(locked, checked);
    return 'ok' in step ? step : settleCode(locked, step, await rejectLocked(reason as string, locked, step));
  });
  return done === 'busy' ? fail('CONFLICT', RUN_BUSY_MESSAGE) : done;
}

async function rejectLocked(reason: string, deps: LedgerSealDeps, step: StageStep) {
  const { accountId, issue, stage, ctx, live, party, signingEvidence } = step;
  const now = new Date().toISOString();
  const token = party(accountId);
  const run = ctx.open && ctx.run ? ctx.run : null;
  const runId = run?.runId ?? crypto.randomUUID();
  const policyRef = await policyReference(deps, String(live.snapshot.projectId ?? ''), step.policy);
  if (policyRef === 'changed') return fail('POLICY_CHANGED');
  const row = await appendRunRow(deps, issue.id, ctx.run, {
    workEffortId: issue.id,
    statusId: 'LS_RUN_REJECTED',
    statusDatetime: now,
    setByPartyId: token,
    reason,
    transitionName: 'REJECT',
    data: { runId, stageId: stage.stageId, snapshotHash: run?.snapshotHash ?? computeSnapshotHash(live.snapshot), routeHash: ctx.route.routeHash,
      declarationVersion: step.declaration.version,
      declarationHash: declarationHash(step.declaration.text),
      ...(signingEvidence ? { signing: signingEvidence } : {}),
      ...(policyRef ? { signingPolicy: policyRef } : {})
    }
  });
  if (!row) return fail('CONFLICT');
  await new PartyRepository(deps.storage).register([accountId], party, now);
  const base: Omit<ApprovalRun, 'recordHash'> = run
    ? (({ chainHead: _h, recordHash: _r, ...rest }) => rest)(run)
    : {
        schemaVersion: 1,
        issueId: issue.id,
        runId,
        routeId: ctx.route.routeId,
        routeVersion: ctx.route.version,
        routeHash: ctx.route.routeHash,
        state: 'OPEN',
        snapshotHash: computeSnapshotHash(live.snapshot),
        contentId: '',
        signatures: [],
        requiredStageIds: stagesForNewRun(ctx.route, step.sealExists),
        startedAt: now,
        endedAt: null
      };
  await saveRun(deps, { ...base, state: 'REJECTED', endedAt: now }, { seq: row.seq, entryHash: row.entryHash });
  if (base.contentId) await new RouteRepository(deps.storage).deleteRunContent(base.contentId, deps.storage);
  const seal = await new SealRepository(deps.storage).getSeal(issue.id);
  const loaded = seal && seal !== 'missing' ? seal : null;
  await writeIssueAttestation(deps, issue.id, loaded, loaded ? sealStatus(loaded.workEffort.currentStatusId) : null, now);
  return { ok: true as const, runState: 'REJECTED' as const };
}

// ---------------------------------------------------------------------------------------------------------------
// Panel and validator
// ---------------------------------------------------------------------------------------------------------------

/** What the panel shows for a routed issue (spec v4 section 15.6 `PanelData.route`). Reads only. */
export async function panelRoute(deps: LedgerSealDeps, issueId: string, live: LiveRead, accountId: string) {
  const scope = { projectId: String(live.raw?.fields?.project?.id ?? ''), issueTypeId: String(live.raw?.fields?.issuetype?.id ?? '') };
  const ctx = await routeFor(deps, issueId, scope);
  if (!ctx || ctx === 'unreachable') return null;
  if (ctx === 'invalid') return { invalid: true };
  const sealExists = Boolean(await new SealRepository(deps.storage).getWorkEffort(issueId));
  const required = ctx.open && ctx.run ? ctx.run.requiredStageIds : stagesForNewRun(ctx.route, sealExists);
  const runForCounts = ctx.open ? ctx.run : ctx.run?.state === 'COMPLETE' ? ctx.run : null;
  const counts = stageCounts(runForCounts);
  const open = new Set(ctx.run?.state === 'COMPLETE' && !ctx.open ? openStages(ctx.route, required, new Map()).map(s => s.stageId) : openStages(ctx.route, required, ctx.open ? counts : new Map()).map(s => s.stageId));
  const groups = await deps.jira.getMyGroupIds();
  const mine = new Set(groups.ok ? groups.value : []);
  const party = await new PartyRepository(deps.storage).partyForRead();
  const token = party ? party(accountId) : '';
  const resolver = new PartyResolver(new PartyRepository(deps.storage));
  const signedByMe = ctx.open && signedOtherStage(ctx.run, token);
  const stages = await Promise.all(
    requiredStages(ctx.route, required).map(async s => {
      const signers = (runForCounts?.signatures ?? []).filter(x => x.stageId === s.stageId);
      const inGroup = s.approverGroups.some(g => mine.has(g.id));
      return {
        stageId: s.stageId,
        name: s.name,
        orderGroup: s.orderGroup,
        meaning: meaningForRole(s.roleTypeId),
        quorum: s.quorum.kind === 'ANY' ? 1 : s.quorum.n,
        signed: await Promise.all(signers.map(async x => ({ accountId: (await resolver.resolve(x.partyId)) ?? '', seq: x.seq }))),
        open: open.has(s.stageId),
        canSign: open.has(s.stageId) && inGroup && !signedByMe,
        // Review L-6: "one person, one stage" holds for a rejection too (stageChecks refuses it)
        canReject: open.has(s.stageId) && inGroup && !signedByMe
      };
    })
  );
  const last = ctx.run;
  return {
    name: ctx.route.name,
    routeHash: ctx.route.routeHash,
    runState: last ? last.state : null,
    open: ctx.open,
    stages,
    rejection: last?.state === 'REJECTED' ? await lastRejection(deps, issueId, last) : null
  };
}

async function lastRejection(deps: LedgerSealDeps, issueId: string, run: StoredRun) {
  const row = await new SealRepository(deps.storage).getStatusRow(issueId, run.chainHead.seq);
  return row && row.statusId === 'LS_RUN_REJECTED' ? { at: row.statusDatetime, reason: row.reason, stageId: String(row.data?.stageId ?? '') } : null;
}

export const STAGE_GATE_RUN_REJECTED = (stage: string, date: string, reason: string) =>
  `LedgerSeal: ${stage} rejected this issue on ${date} (reason: ${reason}). Start the approval again in the LedgerSeal panel.`.slice(0, 250);

/**
 * The stage gate of the validator (spec v4 section 15.5). Null when the issue has no route or the target status is
 * not gated by a stage: then the normal gate decides. Reads only (the validator voids a changed run before).
 */
export async function stageGate(deps: LedgerSealDeps, issueId: string, live: LiveRead, toStatusId: string): Promise<{ result: boolean; errorMessage?: string } | null> {
  const scope = { projectId: String(live.raw?.fields?.project?.id ?? ''), issueTypeId: String(live.raw?.fields?.issuetype?.id ?? '') };
  const ctx = await routeFor(deps, issueId, scope);
  if (ctx === 'invalid') return { result: false, errorMessage: 'LedgerSeal: the approval record failed its integrity check. Contact your Jira admin.' };
  if (ctx === 'unreachable') return { result: false, errorMessage: 'LedgerSeal could not read the issue from Jira, so this transition is blocked. Try again in a minute.' };
  if (!ctx) return null;
  if (ctx.run?.state === 'REJECTED' && !ctx.open) {
    const rejection = await lastRejection(deps, issueId, ctx.run);
    const stage = ctx.route.stages.find(s => s.stageId === rejection?.stageId)?.name ?? 'A stage';
    return { result: false, errorMessage: STAGE_GATE_RUN_REJECTED(stage, (rejection?.at ?? '').slice(0, 10), rejection?.reason ?? '') };
  }
  const run = ctx.open ? ctx.run : null;
  const required = run ? run.requiredStageIds : ctx.route.stages.map(s => s.stageId);
  const gate = gateFor(ctx.route, required, stageCounts(run), toStatusId);
  if (!gate) return null;
  if (gate.met && run && run.snapshotHash === computeSnapshotHash(live.snapshot)) return { result: true };
  // A completed seal covers every stage: the normal gate decides whether it still holds
  if (!run) return null;
  const k = stageCounts(run).get(gate.stage.stageId)?.size ?? 0;
  const n = gate.stage.quorum.kind === 'ANY' ? 1 : gate.stage.quorum.n;
  return { result: false, errorMessage: `LedgerSeal: this move needs the ${gate.stage.name} approval (${k} of ${n} signed). Sign in the LedgerSeal panel.`.slice(0, 250) };
}

/** True when the route's revoke rule holds: the caller can sign a stage of the route's last order group (decision 8). */
export async function mayRevokeRouted(deps: LedgerSealDeps, ctx: RouteContext): Promise<boolean | SealFailure> {
  const last = Math.max(...ctx.route.stages.map(s => s.orderGroup));
  const groups = await deps.jira.getMyGroupIds();
  if (!groups.ok) return fail('JIRA_UNREACHABLE');
  const mine = new Set(groups.value);
  return ctx.route.stages.filter(s => s.orderGroup === last).some(s => s.approverGroups.some(g => mine.has(g.id)));
}

/** Ends an open run because its seal was revoked (decision 8): the revoke row carries `endsRun`. */
export async function endRunOnRevoke(deps: LedgerSealDeps, issueId: string, at: string, head: { seq: number; entryHash: string }): Promise<boolean> {
  const done = await withRunLock(deps, issueId, locked => endRunLocked(locked, issueId, at, head));
  return done === true;
}

async function endRunLocked(deps: LedgerSealDeps, issueId: string, at: string, head: { seq: number; entryHash: string }): Promise<boolean> {
  const repo = new RouteRepository(deps.storage);
  const run = await repo.run(issueId);
  if (!run || run === 'invalid' || run.state !== 'OPEN') return false;
  const { chainHead: _h, recordHash: _r, ...rest } = run;
  await saveRun(deps, { ...rest, state: 'VOIDED', endedAt: at }, head);
  if (rest.contentId) await repo.deleteRunContent(rest.contentId, deps.storage);
  return true;
}

