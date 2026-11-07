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

/** Decides whether the caller may perform the action on the issue (approver, or a stage group for stage actions). */
export type SigningAuthority = (deps: LedgerSealDeps, issueId: string, action: SigningAction, stageId: string | null, accountId: string) => Promise<SealFailure | null>;

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
 * `signing-code-request-api` (spec v4 section 14.2). Sends a code only to a person who may perform the action, who is
 * not locked out and within the rate limits.
 */
export async function requestCodeFlow(payload: any, context: any, deps: LedgerSealDeps, authority: SigningAuthority) {
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
  const refused = await authority(deps, issue.id, action, stageId, accountId);
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
  const recent = state.lastRequestAt && now.getTime() - Date.parse(state.lastRequestAt) < REQUEST_MIN_INTERVAL_SECONDS * 1000;
  if (recent || !(await repo.claimRequest(party, requestWindow(now.getTime()), at))) {
    await record(repo, party, 'RATE_LIMITED', at, { issueId: issue.id, action });
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
 * On success the challenge is used up and the evidence for the status row is returned.
 */
export async function checkSigningCode(deps: LedgerSealDeps, check: SigningCheck): Promise<{ ok: true; evidence: SigningEvidence } | SealFailure> {
  if (!isDeclarationV2Approved()) return fail('DECLARATION_PENDING');
  const repo = repoOf(deps);
  const at = new Date().toISOString();
  const state = await repo.getState(check.partyId);
  if (state.locked) return fail('SIGNING_LOCKED');
  const given = check.signing as { challengeId?: unknown; code?: unknown } | undefined;
  if (!given || typeof given !== 'object') return fail('SIGNING_REQUIRED');
  const challengeId = typeof given.challengeId === 'string' ? given.challengeId : '';
  const code = normaliseCode(given.code);
  const extra = { issueId: check.issueId, action: check.action, challengeId: challengeId || null };

  const failure = async (kind: 'SIGN_FAIL' | 'CODE_REUSED', answer: 'SIGNING_FAILED' | 'CODE_REUSED', reason: string) => {
    const n = await repo.claimFailure(check.partyId, state.series, at, check.issueId);
    await record(repo, check.partyId, kind, at, { ...extra, reason });
    if (n >= check.policy.lockoutThreshold) {
      await repo.saveState({ ...state, locked: true, lockedAt: at });
      await record(repo, check.partyId, 'LOCKED', at, { ...extra, reason: `${n} failed attempts in a row` });
      return fail('SIGNING_LOCKED');
    }
    return fail(answer);
  };

  const challenge = challengeId ? await repo.getChallenge(challengeId) : null;
  const matches =
    challenge &&
    challenge.partyId === check.partyId &&
    challenge.issueId === check.issueId &&
    challenge.action === check.action &&
    (challenge.stageId ?? null) === (check.stageId ?? null);
  if (!challenge || !matches) return failure('SIGN_FAIL', 'SIGNING_FAILED', 'unknown or foreign request');
  if (Date.parse(challenge.expiresAt) <= Date.parse(at)) {
    // An expired code is recorded but does not count towards the lockout: waiting is not an attack
    await repo.appendEvent(check.partyId, { at, kind: 'SIGN_FAIL', byPartyId: check.partyId, ...extra, reason: 'expired' });
    return fail('CODE_EXPIRED');
  }
  // After 3 wrong codes the request is void: the fourth answer fails whatever the code (spec v4 section 14.3 step 3)
  if (await repo.challengeVoid(challengeId)) return failure('SIGN_FAIL', 'SIGNING_FAILED', 'request void after wrong codes');
  const key = await repo.siteKey();
  if (!code || !macEquals(codeMac(key, challengeId, code), challenge.codeMac)) {
    await repo.claimChallengeFailure(challengeId, at);
    return failure('SIGN_FAIL', 'SIGNING_FAILED', 'wrong code');
  }
  if (!(await repo.claimUse(challengeId, at))) return failure('CODE_REUSED', 'CODE_REUSED', 'code used before');
  // A success ends the run of failures in a row
  await repo.saveState({ ...state, series: state.series + 1 });
  await repo.appendEvent(check.partyId, { at, kind: 'SIGN_OK', byPartyId: check.partyId, ...extra });
  return {
    ok: true,
    evidence: { method: SIGNING_METHOD, components: 2, mode: 'PART11', challengeId, policyVersion: check.policy.version, policyHash: check.policy.policyHash }
  };
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
  const previous = await repo.getPolicy();
  const policy = nextPolicy(previous, { enabled, projectIds, lockoutThreshold: lockout, declarationVersion: DECLARATION_V2.version, setByPartyId: party(caller), fromDate: at });
  if (!(await repo.savePolicy(policy))) return fail('CONFLICT', 'Another admin saved code signing a moment ago. Reload and try again.');
  return { ok: true as const, policy };
}

/** `signing-alerts-api`: alerts not yet acknowledged, newest first, and the people locked out. */
export async function signingAlertsFlow(context: any, deps: LedgerSealDeps) {
  const caller = await adminCaller(context, deps);
  if (typeof caller !== 'string') return caller;
  const repo = repoOf(deps);
  const all = await repo.alerts();
  const acked = new Set(all.filter(e => e.kind === 'ACK').map(e => e.ackSeq));
  const open = all.filter(e => ALERT_KINDS.includes(e.kind) && !acked.has(e.seq)).reverse().slice(0, 100);
  const resolver = new PartyResolver(new PartyRepository(deps.storage));
  const alerts = await Promise.all(
    open.map(async e => ({ seq: e.seq, at: e.at, kind: e.kind, accountId: (await resolver.resolve(e.partyId)) ?? '', issueId: e.issueId, action: e.action, reason: e.reason }))
  );
  const lockedStates = (await repo.allStates()).filter(s => s.locked);
  const locked = await Promise.all(lockedStates.map(async s => ({ accountId: (await resolver.resolve(s.partyId)) ?? '', lockedAt: s.lockedAt })));
  return { ok: true as const, alerts, locked, openCount: alerts.length };
}

/** `signing-alert-ack-api`: a Jira admin acknowledges one alert; the acknowledgement is a new chained entry. */
export async function ackAlertFlow(payload: any, context: any, deps: LedgerSealDeps) {
  const caller = await adminCaller(context, deps);
  if (typeof caller !== 'string') return caller;
  const seq = Number(payload?.seq);
  if (!Number.isInteger(seq) || seq < 1) return fail('INVALID_REQUEST');
  const repo = repoOf(deps);
  const all = await repo.alerts();
  const alert = all.find(e => e.seq === seq && ALERT_KINDS.includes(e.kind));
  if (!alert) return fail('INVALID_REQUEST', 'LedgerSeal: no such alert.');
  if (all.some(e => e.kind === 'ACK' && e.ackSeq === seq)) return { ok: true as const, already: true };
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
  await repo.saveState({ ...state, locked: false, lockedAt: null, series: state.series + 1 });
  await repo.appendEvent(target, { at, kind: 'UNLOCKED', byPartyId: party(caller), reason });
  await repo.appendAlert({ at, kind: 'UNLOCKED', partyId: target, byPartyId: party(caller), reason });
  return { ok: true as const };
}
