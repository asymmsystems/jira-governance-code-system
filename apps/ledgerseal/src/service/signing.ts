/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: code signing flows, option B (ADR-016, spec v4 section 14). A signer asks for a code; the app
 * emails it, as the app, to the signer's own Atlassian address; the signing flow checks it once, after every other
 * check and before its first write. Every request, failure, lock and unlock is recorded in hash-chained histories.
 * The code is never logged, returned or stored in clear.
 *
 * @author Fahim Farook
 */

import {
  ALERT_KINDS,
  ChainEntry,
  ChainKind,
  CODE_LIFETIME_SECONDS,
  codeEmail,
  codeMac,
  hasValidPolicyHash,
  isPart11Project,
  isSigningAction,
  LOCKOUT_DEFAULT,
  macEquals,
  MAX_PART11_PROJECTS,
  newChallengeId,
  newCode,
  nextPolicy,
  normaliseCode,
  REQUEST_MIN_INTERVAL_SECONDS,
  requestWindow,
  SIGNING_METHOD,
  SigningAction,
  SigningEvidence,
  SigningPolicy,
  validLockout
} from '../domain/signing';
import { DECLARATION_V2, isDeclarationV2Approved, validReason } from '../domain/declaration';
import { PartyRepository, PartyResolver } from '../storage/party-repository';
import { SigningRepository } from '../storage/signing-repository';
import { browseDenied, contextIssue, fail, LedgerSealDeps, licenseInactive, SealFailure } from './ledger';
import { adminCaller } from './policy-admin';
import { isApprover } from './approver';
import { openStageFor, routeFor } from './routes';


function repoOf(deps: LedgerSealDeps): SigningRepository {
  return new SigningRepository(deps.storage, deps.secrets ?? null);
}

/** The code-signing status of a project: off, on with the policy in force, or a stored policy that fails its hash (fail closed). */
export async function part11For(deps: LedgerSealDeps, projectId: string | null): Promise<{ on: false } | { on: true; policy: SigningPolicy } | { invalid: true }> {
  const policy = await repoOf(deps).getPolicy();
  if (!policy) return { on: false };
  if (!hasValidPolicyHash(policy)) return { invalid: true };
  return isPart11Project(policy, projectId) ? { on: true, policy } : { on: false };
}

/** True when any code-signing policy is on (a cheap storage read, so flows outside code signing make no extra Jira call). */
export async function anyPart11(deps: LedgerSealDeps): Promise<boolean> {
  const policy = await repoOf(deps).getPolicy();
  return Boolean(policy && (policy.enabled || !hasValidPolicyHash(policy)));
}

/** Records an event in the person's history and, for an alert kind, in the site alert log. */
async function record(repo: SigningRepository, partyId: string, kind: ChainKind, at: string, extra: Partial<ChainEntry> = {}): Promise<void> {
  await repo.appendEvent(partyId, { at, kind, byPartyId: partyId, ...extra });
  if (ALERT_KINDS.includes(kind)) await repo.appendAlert({ at, kind, partyId, byPartyId: null, ...extra });
}

/**
 * Review L-7: who may ask for a code, checked directly in the flow (no callback): an approver for seal, approval of
 * changes, revoke and the transition signature; a member of a group of an open stage of the issue's route for stage
 * signatures and rejections. The caller's groups are read as the user before the route is read as the app.
 */
export async function codeRequestRight(deps: LedgerSealDeps, issueId: string, action: SigningAction, stageId: string | null): Promise<SealFailure | null> {
  if (action === 'SIGN_STAGE' || action === 'REJECT') {
    const groups = await deps.jira.getMyGroupIds();
    if (!groups.ok) return fail(groups.error === 'FORBIDDEN' ? 'NOT_APPROVER' : 'JIRA_UNREACHABLE');
    const stage = await openStageFor(deps, issueId, stageId);
    if (stage === 'unreachable') return fail('JIRA_UNREACHABLE');
    if (stage === null) return fail('NOT_APPROVER');
    if (stage === 'closed') return fail('STAGE_NOT_OPEN');
    return stage.approverGroups.some(g => groups.value.includes(g.id)) ? null : fail('NOT_APPROVER');
  }
  if (action === 'REVOKE') {
    // ADR-017 decision 8: on a routed issue the revoker is a member of a group of the route's last order group (the
    // revoke flow's own rule; review round 3 found the code request still asked for the approver right)
    const groups = await deps.jira.getMyGroupIds();
    if (!groups.ok) return fail(groups.error === 'FORBIDDEN' ? 'NOT_APPROVER' : 'JIRA_UNREACHABLE');
    const ctx = await routeFor(deps, issueId);
    if (ctx === 'unreachable') return fail('JIRA_UNREACHABLE');
    if (ctx === 'invalid') return fail('NOT_APPROVER');
    if (ctx) {
      const last = Math.max(...ctx.route.stages.map(s => s.orderGroup));
      const mine = new Set(groups.value);
      return ctx.route.stages.filter(s => s.orderGroup === last).some(s => s.approverGroups.some(g => mine.has(g.id))) ? null : fail('NOT_APPROVER');
    }
  }
  const permission = await isApprover(deps.jira, deps.storage, issueId);
  if (!permission.ok) return fail(permission.error === 'FORBIDDEN' ? 'NOT_APPROVER' : 'JIRA_UNREACHABLE');
  return permission.value ? null : fail('NOT_APPROVER');
}

/**
 * `signing-code-request-api` (spec v4 section 14.2). Sends a code only to a person who may perform the action, who is
 * not locked out and within the rate limits.
 */
export async function requestCodeFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const accountId = context?.accountId ? String(context.accountId) : '';
  if (!accountId) return fail('NO_IDENTITY');
  if (licenseInactive(context)) return fail('LICENSE_INACTIVE');
  const issue = contextIssue(context);
  if (!issue) return fail('MISSING_ISSUE');
  const action = payload?.action;
  if (!isSigningAction(action)) return fail('INVALID_REQUEST');
  const stageId = action === 'SIGN_STAGE' || action === 'REJECT' ? (typeof payload?.stageId === 'string' && /^[a-z0-9-]{1,32}$/.test(payload.stageId) ? payload.stageId : null) : null;
  if ((action === 'SIGN_STAGE' || action === 'REJECT') && !stageId) return fail('INVALID_REQUEST');
  const denied = await browseDenied(deps, issue.id);
  if (denied) return denied;

  const scope = await deps.jira.getIssueScope(issue.id);
  if (!scope.ok) return fail('JIRA_UNREACHABLE');
  const part11 = await part11For(deps, scope.value.projectId);
  if ('invalid' in part11) return fail('POLICY_INVALID');
  if (!part11.on) return fail('NOT_PART11');
  if (!isDeclarationV2Approved()) return fail('DECLARATION_PENDING');
  const refused = await codeRequestRight(deps, issue.id, action, stageId);
  if (refused) return refused;

  const repo = repoOf(deps);
  const parties = new PartyRepository(deps.storage);
  const partyFn = await parties.partyForWrite();
  const party = partyFn(accountId);
  const now = new Date();
  const at = now.toISOString();
  // The weekly personal data report covers everyone named in the signing records (ADR-011)
  await parties.register([accountId], partyFn, at);
  const state = await repo.getState(party);
  if (state.locked) return fail('SIGNING_LOCKED');
  // Review H-2: the 30-second rule and the 15-minute window are claims (create-once keys), not reads
  const tooSoon = !(await repo.claimRequestSlot(party, now.getTime(), at));
  if (tooSoon || !(await repo.claimRequest(party, requestWindow(now.getTime()), at))) {
    // Review L-8: every refusal is in the person's history; the admin alert is raised once per rule and window, so a
    // burst of refused requests cannot grow the alert log
    await repo.appendEvent(party, { at, kind: 'RATE_LIMITED', byPartyId: party, issueId: issue.id, action });
    if (await repo.claimAlertOnce(`${party}:${tooSoon ? 'interval' : 'window'}:${requestWindow(now.getTime())}`, at)) {
      await repo.appendAlert({ at, kind: 'RATE_LIMITED', partyId: party, byPartyId: null, issueId: issue.id, action });
    }
    return fail('RATE_LIMITED');
  }

  const key = await repo.siteKey();
  const challengeId = newChallengeId();
  const code = newCode();
  const expiresAt = new Date(now.getTime() + CODE_LIFETIME_SECONDS * 1000).toISOString();
  await repo.saveChallenge({ challengeId, partyId: party, issueId: issue.id, action, stageId, codeMac: codeMac(key, challengeId, code), createdAt: at, expiresAt });
  await repo.saveState({ ...state, lastRequestAt: at });
  const status = await deps.jira.notifyUser(issue.id, accountId, codeEmail(code, scope.value.issueKey, action));
  if (status !== 204) {
    await repo.deleteChallenge(challengeId);
    await record(repo, party, 'CODE_NOT_SENT', at, { issueId: issue.id, action, challengeId, reason: `HTTP ${status}` });
    return fail('CODE_NOT_SENT');
  }
  await record(repo, party, 'CODE_SENT', at, { issueId: issue.id, action, challengeId });
  return { ok: true as const, challengeId, expiresAt };
}

export interface SigningCheck {
  accountId: string;
  /** The caller's party token (ADR-011). */
  partyId: string;
  issueId: string;
  action: SigningAction;
  stageId: string | null;
  policy: SigningPolicy;
  /** The `signing` object of the payload: `{ challengeId, code }`. */
  signing: unknown;
}

/**
 * The code check of spec v4 section 14.3, run by a signing flow after every other check and before its first write.
 * On success the challenge is used up and the evidence for the status row is returned. The flow then records
 * SIGN_OK once its row is written (`recordSignOk`), or gives the code back when it writes nothing (`giveBackCode`):
 * review round 2, R2-2.
 */
export async function checkSigningCode(deps: LedgerSealDeps, check: SigningCheck): Promise<{ ok: true; evidence: SigningEvidence } | SealFailure> {
  if (!isDeclarationV2Approved()) return fail('DECLARATION_PENDING');
  const repo = repoOf(deps);
  const at = new Date().toISOString();
  // Review H-2: every limit below is a create-once claim taken BEFORE the code is compared, so parallel attempts
  // cannot compare more codes than the sequential rules allow
  const series = await repo.currentSeries(check.partyId);
  if (await repo.lockOf(check.partyId, series)) return fail('SIGNING_LOCKED');
  const given = check.signing as { challengeId?: unknown; code?: unknown } | undefined;
  if (!given || typeof given !== 'object') return fail('SIGNING_REQUIRED');
  const challengeId = typeof given.challengeId === 'string' ? given.challengeId : '';
  const code = normaliseCode(given.code);
  const extra = { issueId: check.issueId, action: check.action, challengeId: challengeId || null };
  const threshold = check.policy.lockoutThreshold;

  const lockNow = async (reason: string) => {
    if (await repo.lock(check.partyId, series, at)) await record(repo, check.partyId, 'LOCKED', at, { ...extra, reason });
    return fail('SIGNING_LOCKED');
  };
  /** Counts a failure in the person's series: in the slot already taken, or in a new one. */
  const failure = async (answer: 'SIGNING_FAILED', reason: string, slot?: number | null) => {
    const n = slot === undefined ? await repo.claimFailureSlot(check.partyId, series, threshold, at, check.issueId) : slot;
    await record(repo, check.partyId, 'SIGN_FAIL', at, { ...extra, reason });
    if (n === null || n >= threshold) return lockNow(`${threshold} failed attempts in a row`);
    return fail(answer);
  };

  const challenge = challengeId ? await repo.getChallenge(challengeId) : null;
  // Review L-4: a code asked for to seal also approves changes and the other way round (the issue may change
  // between the request and the signature); revoke, stage and transition codes stay bound to their action
  const sameAction = (a: string, b: string) => a === b || (['SEAL', 'RESEAL'].includes(a) && ['SEAL', 'RESEAL'].includes(b));
  const matches =
    challenge &&
    challenge.partyId === check.partyId &&
    challenge.issueId === check.issueId &&
    sameAction(challenge.action, check.action) &&
    (challenge.stageId ?? null) === (check.stageId ?? null);
  if (!challenge || !matches) return failure('SIGNING_FAILED', 'unknown or foreign request');
  if (Date.parse(challenge.expiresAt) <= Date.parse(at)) {
    // An expired code is recorded but does not count towards the lockout: waiting is not an attack
    await repo.appendEvent(check.partyId, { at, kind: 'SIGN_FAIL', byPartyId: check.partyId, ...extra, reason: 'expired' });
    return fail('CODE_EXPIRED');
  }
  // At most 3 answers per request (spec v4 section 14.3 step 3): the slot is claimed before the comparison
  const attempt = await repo.claimAttempt(challengeId, at);
  if (attempt === null) return failure('SIGNING_FAILED', 'request used up after 3 answers');
  // One failure slot of the series is taken before the comparison; a person with no slot left is locked
  const slot = await repo.claimFailureSlot(check.partyId, series, threshold, at, check.issueId);
  if (slot === null) return lockNow(`${threshold} failed attempts in a row`);
  const key = await repo.siteKey();
  if (!code || !macEquals(codeMac(key, challengeId, code), challenge.codeMac)) return failure('SIGNING_FAILED', 'wrong code', slot);
  // A parallel failure may have locked the series while this code was compared
  if (await repo.lockOf(check.partyId, series)) {
    await repo.releaseFailureSlot(check.partyId, series, slot);
    return fail('SIGNING_LOCKED');
  }
  if (!(await repo.claimUse(challengeId, at))) {
    // Review L-4: the right code sent twice (a double submit) is recorded and alerted, but is not a failed attempt
    await repo.releaseFailureSlot(check.partyId, series, slot);
    await record(repo, check.partyId, 'CODE_REUSED', at, { ...extra, reason: 'code used before' });
    return fail('CODE_REUSED');
  }
  // A success ends the run of failures in a row. It races a parallel lock for the one key that decides how the
  // series ended (review round 2, R2-3): a lock that won refuses this success, and gives the code back
  await repo.releaseFailureSlot(check.partyId, series, slot);
  if (!(await repo.endSeries(check.partyId, series, 'OK', at)) && (await repo.seriesEnd(check.partyId, series))?.kind === 'LOCK') {
    await repo.releaseUse(challengeId);
    return fail('SIGNING_LOCKED');
  }
  await repo.advanceSeries(check.partyId, series, at);
  return {
    ok: true,
    evidence: { method: SIGNING_METHOD, components: 2, mode: 'PART11', challengeId, policyVersion: check.policy.version, policyHash: check.policy.policyHash }
  };
}

/** Review round 2 (R2-2): the SIGN_OK event, written only after the signature's row is stored. */
export async function recordSignOk(deps: LedgerSealDeps, partyId: string, fields: { issueId: string; action: string; challengeId: string }): Promise<void> {
  await repoOf(deps).appendEvent(partyId, { at: new Date().toISOString(), kind: 'SIGN_OK', byPartyId: partyId, ...fields });
}

/** Review round 2 (R2-2): a checked code whose signature was not written is given back, so the person can use it again. */
export async function giveBackCode(deps: LedgerSealDeps, evidence: SigningEvidence | null): Promise<void> {
  if (evidence) await repoOf(deps).releaseUse(evidence.challengeId);
}

// ---------------------------------------------------------------------------------------------------------------
// Admin page flows (Jira admins only, checked as the user first)
// ---------------------------------------------------------------------------------------------------------------

const MAX_KEY_CHARS = 64;

/** `signing-policy-get-api`: the current policy with project names, and the declaration's approval state. */
export async function getSigningPolicyFlow(context: any, deps: LedgerSealDeps) {
  const caller = await adminCaller(context, deps);
  if (typeof caller !== 'string') return caller;
  const policy = await repoOf(deps).getPolicy();
  let projects: { id: string; key: string; name: string }[] = [];
  if (policy && policy.projectIds.length > 0) {
    const found = await deps.jira.getProjects(policy.projectIds);
    if (found.ok) projects = found.value;
  }
  return {
    ok: true as const,
    policy,
    policyValid: policy ? hasValidPolicyHash(policy) : true,
    projects,
    declaration: { version: DECLARATION_V2.version, text: DECLARATION_V2.text, approved: isDeclarationV2Approved() },
    lockoutDefault: LOCKOUT_DEFAULT
  };
}

/** A stored policy version older than this, and not in force, belongs to a save that died (Forge limit: 25 seconds). */
export const POLICY_SAVE_STALE_MS = 60_000;

/** `signing-policy-set-api`: saves a new policy version. Turning the mode on needs the approved declaration (Q-03). */
export async function setSigningPolicyFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const caller = await adminCaller(context, deps);
  if (typeof caller !== 'string') return caller;
  const enabled = payload?.enabled;
  const keys = payload?.projectKeys;
  const lockout = validLockout(payload?.lockoutThreshold ?? LOCKOUT_DEFAULT);
  const validKey = (k: unknown) => typeof k === 'string' && k.length > 0 && k.length <= MAX_KEY_CHARS && /^[A-Za-z0-9_]+$/.test(k);
  if (typeof enabled !== 'boolean' || !Array.isArray(keys) || !keys.every(validKey) || keys.length > MAX_PART11_PROJECTS || lockout === null) {
    return fail('INVALID_REQUEST', 'LedgerSeal: give the code-signing projects (at most 100 project keys) and a lockout of 3 to 10 failed attempts.');
  }
  if (enabled && keys.length === 0) return fail('INVALID_REQUEST', 'LedgerSeal: name at least one code-signing project to turn code signing on.');
  if (enabled && !isDeclarationV2Approved()) return fail('DECLARATION_PENDING');
  const unique = [...new Set(keys as string[])];
  let projectIds: string[] = [];
  if (unique.length > 0) {
    const found = await deps.jira.getProjects(unique);
    if (!found.ok) return fail('JIRA_UNREACHABLE', 'LedgerSeal could not read the projects from Jira. Nothing was saved. Try again.');
    if (found.value.length !== unique.length) return fail('INVALID_REQUEST', 'A project was not found in Jira. Nothing was saved.');
    projectIds = found.value.map(p => p.id);
  }
  const parties = new PartyRepository(deps.storage);
  const party = await parties.partyForWrite();
  const at = new Date().toISOString();
  await parties.register([caller], party, at);
  const repo = repoOf(deps);
  // Review round 3 (P-1): a save that died after storing its version (and its alert) never brought it into force; it
  // is removed here, once it is older than any running save could be, and the alert log says so
  const recovered = await repo.recoverPolicy(Date.parse(at), POLICY_SAVE_STALE_MS);
  if (recovered === 'busy') return fail('CONFLICT', 'Another admin saved code signing a moment ago. Reload and try again.');
  for (const lost of recovered.dropped) {
    if (await repo.claimAlertOnce(`policylost:${lost.policyHash}`, at)) {
      await repo.appendAlert({ at, kind: 'POLICY_CHANGED', partyId: party(caller), byPartyId: party(caller), reason: `policy version ${lost.version} never came into force (its save did not finish)` });
    }
  }
  const previous = recovered.current;
  const policy = nextPolicy(previous, { enabled, projectIds, lockoutThreshold: lockout, declarationVersion: DECLARATION_V2.version, setByPartyId: party(caller), fromDate: at });
  // Review L-5: every policy change (on, off, projects, lockout) is an alert for the other admins to see and acknowledge.
  // It is written before the version comes into force; when it cannot be written, the save fails (review round 2)
  const alert = () => repo.appendAlert({ at, kind: 'POLICY_CHANGED', partyId: party(caller), byPartyId: party(caller), reason: `policy version ${policy.version}: ${policy.enabled ? 'on' : 'off'}` });
  if (!(await repo.savePolicy(policy, alert))) return fail('CONFLICT', 'Another admin saved code signing a moment ago. Reload and try again.');
  return { ok: true as const, policy };
}

/** `signing-alerts-api`: alerts not yet acknowledged, newest first, and the people locked out. */
export async function signingAlertsFlow(context: any, deps: LedgerSealDeps) {
  const caller = await adminCaller(context, deps);
  if (typeof caller !== 'string') return caller;
  const repo = repoOf(deps);
  // Review L-8: the page reads the open alerts only (an index kept with the log), not the whole log
  const openAll = await repo.openAlerts();
  const open = openAll.slice().reverse().slice(0, 100);
  const resolver = new PartyResolver(new PartyRepository(deps.storage));
  const alerts = await Promise.all(
    open.map(async e => ({ seq: e.seq, at: e.at, kind: e.kind, accountId: (await resolver.resolve(e.partyId)) ?? '', issueId: e.issueId, action: e.action, reason: e.reason }))
  );
  const lockedStates = await repo.lockedStates();
  const locked = await Promise.all(lockedStates.map(async s => ({ accountId: (await resolver.resolve(s.partyId)) ?? '', lockedAt: s.lockedAt })));
  return { ok: true as const, alerts, locked, openCount: openAll.length };
}

/** `signing-alert-ack-api`: a Jira admin acknowledges one alert; the acknowledgement is a new chained entry. */
export async function ackAlertFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const caller = await adminCaller(context, deps);
  if (typeof caller !== 'string') return caller;
  const seq = Number(payload?.seq);
  if (!Number.isInteger(seq) || seq < 1) return fail('INVALID_REQUEST');
  const repo = repoOf(deps);
  const alert = await repo.alert(seq);
  if (!alert || !ALERT_KINDS.includes(alert.kind)) return fail('INVALID_REQUEST', 'LedgerSeal: no such alert.');
  if (!(await repo.isAlertOpen(seq))) return { ok: true as const, already: true };
  const parties = new PartyRepository(deps.storage);
  const party = await parties.partyForWrite();
  const at = new Date().toISOString();
  await parties.register([caller], party, at);
  await repo.appendAlert({ at, kind: 'ACK', partyId: alert.partyId, byPartyId: party(caller), ackSeq: seq });
  return { ok: true as const };
}

/** `signing-unlock-api`: a Jira admin who is not the locked person unlocks them, with a reason. */
export async function unlockFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const caller = await adminCaller(context, deps);
  if (typeof caller !== 'string') return caller;
  const accountId = typeof payload?.accountId === 'string' && payload.accountId.length <= 128 ? payload.accountId : '';
  const reason = validReason(payload?.reason);
  if (!accountId) return fail('INVALID_REQUEST');
  if (!reason) return fail('REASON_REQUIRED', 'Give a reason for unlocking (1 to 500 characters).');
  if (accountId === caller) return fail('SELF_UNLOCK');
  const parties = new PartyRepository(deps.storage);
  const party = await parties.partyForWrite();
  const repo = repoOf(deps);
  const target = party(accountId);
  const state = await repo.getState(target);
  if (!state.locked) return fail('INVALID_REQUEST', 'LedgerSeal: this person is not locked out.');
  const at = new Date().toISOString();
  await parties.register([caller], party, at);
  // The lock stays on its series as a record; the unlock starts the next series (once)
  if (!(await repo.advanceSeries(target, state.series, at))) return fail('CONFLICT', 'Another admin unlocked this person a moment ago.');
  await repo.appendEvent(target, { at, kind: 'UNLOCKED', byPartyId: party(caller), reason });
  await repo.appendAlert({ at, kind: 'UNLOCKED', partyId: target, byPartyId: party(caller), reason });
  return { ok: true as const };
}
