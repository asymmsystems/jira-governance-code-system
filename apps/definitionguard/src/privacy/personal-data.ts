/**
 * Personal data: the weekly report to Atlassian, erasure of closed accounts, and the one-time
 * pass that rewrites records written before ADR-010 to hold pseudonyms.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * ADR-010 (architecture/decision/adr-00010-definitionguard-personal-data-pseudonyms.org).
 * Logs hold counts only, never an account id.
 */
import { getAppContext, privacy } from '@forge/api';
import { StorageProvider } from '../storage/checklist-repository';
import { resolveStorage } from '../storage/forge-storage';
import { ChecklistStore, eventKey, legacyKey, stateKey } from '../storage/checklist-store';
import { PartyStore, isRawAccountId } from '../storage/party-store';
import { canonicalJson, hashEntry, redactEntries } from '../domain/event-log';
import { ChangeEntry, DodRow, DodState, IssueChecklistState } from '../domain/models';
import { publishAttestation } from '../integrity/attestation';
import { templateKey, StoredTemplate } from '../settings/template-store';
import { projectConfigKey, ProjectConfig } from '../settings/project-config';
import { APPROVER_POLICY_KEY } from '../storage/policy-repository';
import { logFailure } from '../log';

export const MIGRATION_KEY = 'dg:pd:migration';
const PAGE = 20;
/** The pass stops while at least this much time is left, so the report still runs. */
export const RESERVE_MS = 15000;

export type Phase = 'v1' | 'issues' | 'templates' | 'projects' | 'policy' | 'done';
const PHASES: Phase[] = ['v1', 'issues', 'templates', 'projects', 'policy', 'done'];

export interface MigrationProgress {
  phase: Phase;
  cursor?: string;
  issuesRewritten: number;
  updatedAt: string;
}

/** Milliseconds left in this invocation: from the Forge runtime, else a fixed budget. */
export function invocationClock(budgetMs = 20000): () => number {
  const start = Date.now();
  return () => {
    try {
      const left = getAppContext().invocationRemainingTimeInMillis();
      if (typeof left === 'number' && Number.isFinite(left)) return left;
    } catch {
      // Outside the Forge runtime: use the budget.
    }
    return budgetMs - (Date.now() - start);
  };
}

/** One event with every account id replaced by its pseudonym and any v1 display name removed. */
async function rewriteEntry(e: ChangeEntry, parties: PartyStore): Promise<ChangeEntry> {
  const map = async (id: string) => (isRawAccountId(id) ? parties.pseudonymFor(id) : id);
  const rows: DodRow[] = [];
  for (const r of e.rows) {
    if (r.entity !== 'WorkEffortStatus') {
      rows.push(r);
      continue;
    }
    const { setByLegacyName: _gone, ...rest } = r;
    rows.push({ ...rest, setByPartyId: await map(r.setByPartyId) });
  }
  return { ...e, actorPartyId: await map(e.actorPartyId), rows };
}

const stateHoldsPeople = (st: DodState) =>
  isRawAccountId(st.lastModifiedByPartyId) || st.criteria.some(c => isRawAccountId(c.lastStatusByPartyId) || Boolean(c.legacyName));

/**
 * Rewrites one issue's history to hold pseudonyms (ADR-010 decision 6). Appends Redact events
 * first, so a crash leaves events that still verify; then rewrites the events in place, rebuilds
 * the state cache from them and writes the issue property again. Returns the number of rewritten
 * events. Running it again on a clean issue changes nothing.
 */
export async function pseudonymiseIssue(storage: StorageProvider, issueId: string, at: string): Promise<number> {
  const store = new ChecklistStore(storage);
  const parties = new PartyStore(storage);
  const state = await store.load(issueId);
  if (!state) return 0;
  const events = await store.allEvents(issueId, state);
  const rewritten: ChangeEntry[] = [];
  const redactions: Array<{ seq: number; originalHash: string; redactedHash: string }> = [];
  for (const e of events) {
    const r = await rewriteEntry(e, parties);
    if (canonicalJson(r) === canonicalJson(e)) continue;
    rewritten.push(r);
    redactions.push({ seq: e.seq, originalHash: e.hash, redactedHash: hashEntry(r) });
  }
  if (redactions.length === 0 && !stateHoldsPeople(state)) return 0;
  if (redactions.length > 0) {
    await store.mutate(issueId, async () => { throw new Error('DefinitionGuard: the record disappeared during the personal data pass'); },
      () => redactEntries(redactions, at));
    for (const r of rewritten) await storage.set(eventKey(issueId, r.seq), r);
  }
  const rebuilt = await store.rebuild(issueId);
  /* istanbul ignore else: load() found a state above, so the events exist */
  if (rebuilt) {
    // A newer state written meanwhile is not lost: load() folds forward from any cached seq.
    await storage.set(stateKey(issueId), rebuilt);
    await publishAttestation(rebuilt, at);
  }
  return rewritten.length;
}

/** A v1 record (development only): migrated into the history if needed, rewritten, then deleted. */
async function retireV1Record(storage: StorageProvider, issueId: string, at: string): Promise<void> {
  const store = new ChecklistStore(storage);
  if (!(await store.load(issueId))) {
    const legacy = await storage.get<IssueChecklistState>(legacyKey(issueId));
    if (legacy) {
      await store.mutate(issueId, base => store.initFromLegacyOr(base, async () => { throw new Error('DefinitionGuard: v1 record vanished'); }, 'system', at),
        () => [], { issueKey: legacy.issueKey || issueId, projectId: '' });
    }
  }
  await pseudonymiseIssue(storage, issueId, at);
  await storage.delete(legacyKey(issueId));
}

/**
 * The one-time pass over records written before ADR-010, in pages, until timeLeft() drops under
 * RESERVE_MS. Its place is kept in dg:pd:migration, so the next run continues there.
 */
export async function migrateLegacyPersonalData(storage: StorageProvider, timeLeft: () => number, at = new Date().toISOString()): Promise<MigrationProgress> {
  const parties = new PartyStore(storage);
  let progress: MigrationProgress = (await storage.get<MigrationProgress>(MIGRATION_KEY)) || { phase: 'v1', issuesRewritten: 0, updatedAt: at };
  const save = async () => {
    progress = { ...progress, updatedAt: at };
    await storage.set(MIGRATION_KEY, progress);
  };
  const next = async () => {
    progress = { ...progress, phase: PHASES[PHASES.indexOf(progress.phase) + 1], cursor: undefined };
    await save();
  };

  while (progress.phase !== 'done' && timeLeft() > RESERVE_MS) {
    if (progress.phase === 'policy') {
      const policy = await storage.get<any>(APPROVER_POLICY_KEY);
      if (policy && isRawAccountId(policy.setByPartyId)) {
        await storage.set(APPROVER_POLICY_KEY, { ...policy, setByPartyId: await parties.pseudonymFor(policy.setByPartyId) });
      }
      await next();
      continue;
    }
    const prefix = { v1: 'dg:checklist:', issues: 'dg:state:', templates: 'dg:tmpl:', projects: 'dg:proj:' }[progress.phase];
    // v1 records are deleted as they are handled, so that phase always reads the first page.
    const page = await storage.listByPrefix(prefix, progress.phase === 'v1' ? undefined : progress.cursor, PAGE);
    const keys = page.keys || [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = page.values[i];
      if (progress.phase === 'v1') {
        await retireV1Record(storage, key.slice(prefix.length), at);
      } else if (progress.phase === 'issues') {
        if ((await pseudonymiseIssue(storage, key.slice(prefix.length), at)) > 0) progress.issuesRewritten++;
      } else if (progress.phase === 'templates') {
        const t = value as StoredTemplate;
        if (isRawAccountId(t?.lastModifiedByPartyId)) {
          await storage.set(templateKey(t.projectId, t.issueTypeId), { ...t, lastModifiedByPartyId: await parties.pseudonymFor(t.lastModifiedByPartyId) });
        }
      } else {
        const p = value as ProjectConfig;
        if (p && p.updatedByAccountId !== undefined) {
          const { updatedByAccountId, ...rest } = p;
          await storage.set(key, { ...rest, updatedByPartyId: await parties.pseudonymFor(updatedByAccountId) });
        }
      }
    }
    if (progress.phase === 'v1') {
      // Handled v1 records are deleted, so a full page means: read the first page again.
      if (keys.length < PAGE) await next();
    } else if (page.nextCursor) {
      progress = { ...progress, cursor: page.nextCursor };
      await save();
    } else {
      await next();
    }
  }
  return progress;
}

export type ReportFn = (accounts: Array<{ accountId: string; updatedAt: string }>) => Promise<Array<{ accountId: string; status: string }>>;

/**
 * The weekly job (ADR-010 decisions 5 and 6): continues the one-time pass, then reports every
 * recorded account to Atlassian and erases each account reported as closed.
 */
export async function reportPersonalData(
  storageProvider?: StorageProvider,
  report?: ReportFn,
  timeLeft: () => number = invocationClock()
): Promise<{ reported: number; closed: number; migration: Phase | 'failed' }> {
  const storage = resolveStorage(storageProvider);
  let migration: Phase | 'failed';
  try {
    migration = (await migrateLegacyPersonalData(storage, timeLeft)).phase;
  } catch (err) {
    // The report must still run; the pass continues next week from its saved place.
    logFailure('the personal data pass stopped', err);
    migration = 'failed';
  }
  const parties = new PartyStore(storage);
  const records = await parties.all();
  if (records.length === 0) return { reported: 0, closed: 0, migration };
  const updates = await (report || privacy.reportPersonalData)(records.map(r => ({ accountId: r.accountId, updatedAt: r.updatedAt })));
  let closed = 0;
  for (const u of updates) {
    if (u.status === 'closed' && (await parties.erase(u.accountId))) closed++;
  }
  return { reported: records.length, closed, migration };
}

/** Scheduled trigger handler (manifest: personal-data-report, interval week). */
export const personalDataTrigger = async (): Promise<void> => {
  try {
    const r = await reportPersonalData();
    console.log(`DefinitionGuard personal data report: ${r.reported} account(s) reported, ${r.closed} closed and erased, pass ${r.migration}.`);
  } catch (err) {
    logFailure('the personal data report failed', err);
  }
};
