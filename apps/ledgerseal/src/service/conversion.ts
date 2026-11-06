/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: the recorded redaction event (ADR-011 decision 7). A record written before ADR-011 holds account
 * ids and a display name inside hashed data. It is converted once: every account id becomes its party token, the
 * name is removed, the hashes and the chain are computed again, and an LS_REDACTED row records the head hash
 * before the conversion, the number of values replaced and the tokens. The conversion never makes a record that
 * failed its integrity check look valid: such a record gets its ids replaced in place and stays invalid.
 *
 * @author Fahim Farook
 */

import { canonicalJson, hashWithout } from '../domain/canonical-json';
import { canonicalizeIssueState } from '../domain/canonicalizer';
import { computeSnapshotHash } from '../domain/crypto';
import { plainText } from '../domain/display';
import { buildStatusRow, GENESIS_HASH } from '../domain/history';
import { CanonicalIssueSnapshot, SealedWorkEffort, WorkEffortPartyAssignment, WorkEffortStatus } from '../domain/models';
import { isPartyToken, PartyFn, pseudonymise } from '../domain/party';
import { assignmentHash, isConsistent, withRecordHash } from '../domain/seal-record';
import { JiraClient } from '../jira/jira-client';
import { PartyRepository } from '../storage/party-repository';
import { MAX_CONTENT_PARTS, MAX_PART_BYTES, SealRepository, splitUtf8, StorageProvider } from '../storage/seal-repository';

export type ConversionResult = 'NO_RECORD' | 'ALREADY' | 'CONVERTED' | 'REDACTED_INVALID' | 'BUSY' | 'JIRA_UNREACHABLE' | 'TOO_LARGE';

export const JOURNAL_PREFIX = 'ls3:convert:';

/**
 * How long a conversion journal means "running": the weekly function's limit (300 s, manifest) plus a margin.
 * A seal or revoke that meets a running conversion answers CONFLICT, and the user tries again.
 */
export const CONVERSION_LEASE_MS = 10 * 60 * 1000;

/** True while a conversion of this issue's record has not finished (its journal key exists). */
export async function hasConversionJournal(storage: StorageProvider, issueId: string): Promise<boolean> {
  return Boolean(await storage.get(JOURNAL_PREFIX + issueId));
}

/** The parts of one conversion that a retry must reuse, so a crash midway ends in the same record. */
interface Journal {
  startedAt: string;
  previousHead: { seq: number; entryHash: string };
  redactedValues: number;
  parties: string[];
  lastIncidentHash: string | null;
}

/** Counts and replaces account ids with tokens. Raw ids met are collected, so the actors can be registered. */
class Redactor {
  count = 0;
  readonly tokens = new Set<string>();
  readonly actors = new Set<string>();

  constructor(private readonly party: PartyFn) {}

  id(value: string | null | undefined, actor = false): string | null {
    if (typeof value !== 'string' || value.length === 0 || isPartyToken(value)) return value ?? null;
    this.count++;
    if (actor) this.actors.add(value);
    const token = this.party(value);
    this.tokens.add(token);
    return token;
  }

  /** A stored snapshot value: `accountId` and `authorAccountId` strings and mention nodes are replaced. */
  value(value: any): any {
    if (Array.isArray(value)) {
      const items = value.map(item => this.value(item));
      // A list of people is a set: it is sorted again, as the canonical form sorts the live list
      const people = items.length > 1 && items.every(i => i && typeof i === 'object' && !Array.isArray(i) && Object.keys(i).join() === 'accountId');
      return people ? items.sort((a, b) => (canonicalJson(a) < canonicalJson(b) ? -1 : canonicalJson(a) > canonicalJson(b) ? 1 : 0)) : items;
    }
    if (!value || typeof value !== 'object') return value;
    const copy: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      copy[key] = (key === 'accountId' || key === 'authorAccountId') && typeof value[key] === 'string' ? this.id(value[key]) : this.value(value[key]);
    }
    if (value.type === 'mention' && value.attrs && typeof value.attrs.id === 'string' && value.attrs.id.length > 0) {
      const token = this.id(value.attrs.id) as string;
      if (copy.attrs.text !== token) this.count++;
      copy.attrs = { ...copy.attrs, id: token, text: token };
    }
    return copy;
  }
}

/** Display text of a stored value whose people are tokens. Not hashed. */
function tokenText(value: any): string {
  if (Array.isArray(value)) return value.map(tokenText).join(', ');
  if (value && typeof value === 'object' && typeof value.accountId === 'string') return value.accountId;
  return plainText(value);
}

function redactSnapshot(snapshot: CanonicalIssueSnapshot, r: Redactor): CanonicalIssueSnapshot {
  return {
    ...snapshot,
    fields: snapshot.fields.map(f => {
      const before = r.count;
      const value = r.value(f.value);
      return r.count === before ? f : { ...f, value, display: tokenText(value) };
    }),
    attachments: snapshot.attachments.map(a => ({ ...a, authorAccountId: r.id(a.authorAccountId) as string })),
    comments: (snapshot.comments || []).map(c => ({ ...c, authorAccountId: r.id(c.authorAccountId) as string, body: r.value(c.body) }))
  };
}

function redactRow(row: WorkEffortStatus, r: Redactor): WorkEffortStatus {
  const data: Record<string, unknown> = { ...row.data };
  if ('signerName' in data) {
    delete data.signerName;
    r.count++;
  }
  if (Array.isArray(data.changes)) {
    data.changes = (data.changes as any[]).map(c => (Array.isArray(c?.changedBy) ? { ...c, changedBy: c.changedBy.map((id: string) => r.id(id, true)) } : c));
  }
  return { ...row, setByPartyId: r.id(row.setByPartyId, true), data };
}

function rechain(rows: WorkEffortStatus[]): WorkEffortStatus[] {
  let prev = GENESIS_HASH;
  return rows.map(row => {
    const draft = { ...row, prevEntryHash: prev, entryHash: '' };
    const chained = { ...draft, entryHash: hashWithout(draft, 'entryHash') };
    prev = chained.entryHash;
    return chained;
  });
}

function chainIsValid(rows: WorkEffortStatus[], head: { seq: number; entryHash: string }): boolean {
  if (rows.length !== head.seq) return false;
  let prev = GENESIS_HASH;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.seq !== i + 1 || row.prevEntryHash !== prev || hashWithout(row, 'entryHash') !== row.entryHash) return false;
    prev = row.entryHash;
  }
  return rows.length === 0 || prev === head.entryHash;
}

export interface ConversionDeps {
  storage: StorageProvider;
  jira: JiraClient;
}

async function allRows(repo: SealRepository, issueId: string, head: number): Promise<WorkEffortStatus[]> {
  const rows: WorkEffortStatus[] = [];
  for (let from = 1; from <= head; from += 50) rows.push(...(await repo.getStatusRows(issueId, from, head)));
  return rows;
}

/**
 * The live hash an LS_CHANGED record must remember after the conversion: the same live state seen with tokens,
 * when it is still the state of the last recorded incident; otherwise the old value, so the newer change is
 * recorded as a new incident. Null when Jira cannot be read.
 */
async function convertedIncidentHash(deps: ConversionDeps, we: SealedWorkEffort, party: PartyFn): Promise<string | null | undefined> {
  if (we.currentStatusId !== 'LS_CHANGED' || !we.lastIncidentHash) return we.lastIncidentHash;
  const issue = await deps.jira.getIssue(we.workEffortId);
  const fields = await deps.jira.getFields();
  const comments = issue.ok ? await deps.jira.getComments(we.workEffortId) : null;
  if (!issue.ok || !fields.ok || !comments || !comments.ok) return undefined;
  const raw = { ...issue.value, fields: { ...(issue.value?.fields || {}), comment: { comments: comments.value } } };
  const version = we.attributes.canonicalizerVersion;
  const oldHash = computeSnapshotHash(canonicalizeIssueState(raw, '', fields.value, version));
  if (oldHash !== we.lastIncidentHash) return we.lastIncidentHash;
  return computeSnapshotHash(canonicalizeIssueState(pseudonymise(raw, party).value, '', fields.value, version));
}

/**
 * Converts one issue's record (ADR-011 decision 7). Safe to run again: a finished record gives ALREADY, and a
 * conversion stopped midway is finished from its journal.
 */
export async function convertRecord(deps: ConversionDeps, issueId: string, now: string = new Date().toISOString()): Promise<ConversionResult> {
  const { storage } = deps;
  const repo = new SealRepository(storage);
  const we = await repo.getWorkEffort(issueId);
  if (!we) return 'NO_RECORD';
  const journalKey = JOURNAL_PREFIX + issueId;
  let journal: Journal | null = (await storage.get(journalKey)) || null;
  if (we.attributes.parties === 'TOKEN' && !journal) return 'ALREADY';
  if (we.attributes.parties === 'TOKEN' && journal) {
    // M-1: the conversion committed, and only its clean-up stopped. Later rows (a revoke, a seal) may follow the
    // redaction row, so the record is never written again from the journal: the clean-up is finished instead.
    await finishCleanup(storage, repo, we, journalKey);
    return 'ALREADY';
  }
  // M-5: a journal younger than the lease belongs to a conversion that may still be running; only an older one is
  // a stopped run to finish. Two conversions of one record never run at the same time.
  if (journal && Date.parse(now) - Date.parse(journal.startedAt) < CONVERSION_LEASE_MS) return 'BUSY';

  const parties = new PartyRepository(storage);
  const party = await parties.partyForWrite();
  const r = new Redactor(party);
  const head = we.statusHead;
  const rows = await allRows(repo, issueId, head.seq);
  const assignmentRows = await storage.query(`ls3:wepa:${issueId}:`);
  const seal = await repo.getSeal(issueId);
  const content = await repo.getContent(we);

  // Integrity first: a record that fails its checks is never made to look valid (invariant 8)
  const valid =
    Boolean(journal) ||
    (seal !== null && seal !== 'missing' && isConsistent(seal) && content !== null && computeSnapshotHash(content) === we.attributes.snapshotHash && chainIsValid(rows, head));

  const newRows = rows.map(row => redactRow(row, r));
  const newAssignments = assignmentRows.map(a => ({ key: a.key, value: { ...a.value, partyId: r.id(a.value.partyId, true) } as WorkEffortPartyAssignment }));
  const newContent = content ? redactSnapshot(content, r) : null;
  const currentParty = r.id(we.currentAssignment.partyId, true) as string;

  if (!valid) {
    // Replace the ids where they are, without new hashes: the record stays invalid, and no id remains
    if (r.count === 0) return 'ALREADY';
    await parties.register([...r.actors], party, now, id => deps.jira.accountState(id));
    for (const row of newRows) await storage.set(`ls3:wes:${issueId}:${String(row.seq).padStart(6, '0')}`, row);
    for (const a of newAssignments) await storage.set(a.key, a.value);
    if (newContent) {
      const parts = splitUtf8(JSON.stringify(newContent), MAX_PART_BYTES);
      if (parts.length === we.attributes.snapshotParts) {
        for (let i = 0; i < parts.length; i++) await storage.set(`ls3:content:${we.currentContentId}:${i}`, parts[i]);
      }
    }
    await storage.set(`ls3:we:${issueId}`, { ...we, currentAssignment: { ...we.currentAssignment, partyId: currentParty } });
    return 'REDACTED_INVALID';
  }

  if (!journal) {
    const incidentHash = await convertedIncidentHash(deps, we, party);
    if (incidentHash === undefined) return 'JIRA_UNREACHABLE';
    journal = { startedAt: now, previousHead: head, redactedValues: r.count, parties: [...r.tokens].sort(), lastIncidentHash: incidentHash };
    if (!(await storage.createIfAbsent(journalKey, journal))) return 'BUSY';
  }

  const contentParts = splitUtf8(JSON.stringify(newContent), MAX_PART_BYTES);
  if (contentParts.length > MAX_CONTENT_PARTS) {
    await storage.delete(journalKey);
    return 'TOO_LARGE';
  }
  // The rows before the redaction row are the history up to the old head, with ids replaced and the chain redone
  const history = rechain(newRows.filter(row => row.seq <= journal!.previousHead.seq));
  const last = history[history.length - 1];
  const redaction = buildStatusRow(
    { seq: last.seq, entryHash: last.entryHash },
    {
      workEffortId: issueId,
      statusId: 'LS_REDACTED',
      statusDatetime: journal.startedAt,
      setByPartyId: null,
      reason: 'Account ids replaced by party tokens (ADR-011)',
      transitionName: 'REDACT',
      data: {
        previousHeadSeq: journal.previousHead.seq,
        previousHeadHash: journal.previousHead.entryHash,
        redactedValues: journal.redactedValues,
        parties: journal.parties,
        certificateId: we.currentContentId
      }
    }
  );
  const claimed = await repo.getStatusRow(issueId, redaction.seq);
  if (claimed && claimed.statusId !== 'LS_REDACTED') {
    // Another writer added a row; the next run converts the record again
    await storage.delete(journalKey);
    return 'BUSY';
  }
  if (!claimed && !(await repo.appendStatus(redaction))) {
    await storage.delete(journalKey);
    return 'BUSY';
  }

  // Rows and seals are rewritten one by one; a retry rewrites them the same way. The snapshot, the redaction
  // row and the sealed issue follow in one transaction, so the snapshot is never half old and half new.
  await parties.register([...r.actors], party, now, id => deps.jira.accountState(id));
  for (const row of history) await storage.set(`ls3:wes:${issueId}:${String(row.seq).padStart(6, '0')}`, row);
  for (const a of newAssignments) await storage.set(a.key, a.value);

  const current = newAssignments.find(a => a.value.fromDate === we.currentAssignment.fromDate)?.value;
  const sealing = history.find(row => row.seq === we.currentAssignment.sealingSeq);
  const converted = withRecordHash({
    ...we,
    revisionNumber: redaction.seq,
    statusHead: { seq: redaction.seq, entryHash: redaction.entryHash },
    currentAssignment: {
      ...we.currentAssignment,
      partyId: currentParty,
      assignmentHash: current ? assignmentHash(current) : we.currentAssignment.assignmentHash,
      sealingEntryHash: sealing ? sealing.entryHash : we.currentAssignment.sealingEntryHash
    },
    attributes: { ...we.attributes, snapshotHash: computeSnapshotHash(newContent as CanonicalIssueSnapshot), snapshotParts: contentParts.length, parties: 'TOKEN' },
    lastIncidentHash: journal.lastIncidentHash
  });
  // M-5: another writer (a seal or revoke converts first, then adds its row) may have moved the record on since it
  // was read. Then this run writes nothing more and stops; the next run finds the record converted.
  const latest = await repo.getWorkEffort(issueId);
  if (!latest || latest.recordHash !== we.recordHash || (await repo.getStatusRow(issueId, redaction.seq + 1))) return 'BUSY';
  await storage.commit([
    ...contentParts.map((value, i) => ({ key: `ls3:content:${we.currentContentId}:${i}`, value })),
    { key: `ls3:wes:${issueId}:${String(redaction.seq).padStart(6, '0')}`, value: redaction },
    { key: `ls3:we:${issueId}`, value: converted }
  ]);
  for (let i = contentParts.length; i < we.attributes.snapshotParts; i++) await storage.delete(`ls3:content:${we.currentContentId}:${i}`);
  // Snapshots of superseded seals are read by nothing and hold ids, so they are deleted
  for (const id of new Set(rows.map(row => row.data?.certificateId).filter((id): id is string => typeof id === 'string' && id !== we.currentContentId))) {
    await repo.deleteContent(id);
  }
  await storage.delete(journalKey);
  return 'CONVERTED';
}

/** Deletes the snapshots of superseded seals and the journal of a conversion that has committed. */
async function finishCleanup(storage: StorageProvider, repo: SealRepository, we: SealedWorkEffort, journalKey: string): Promise<void> {
  const rows = await allRows(repo, we.workEffortId, we.statusHead.seq);
  for (const id of new Set(rows.map(row => row.data?.certificateId).filter((id): id is string => typeof id === 'string' && id !== we.currentContentId))) {
    await repo.deleteContent(id);
  }
  await storage.delete(journalKey);
}

/**
 * Old-format records of the development site (cert:active:) hold a signer id, name and email. They are replaced
 * by a stub with no personal data; the panel still shows them as old-format seals.
 */
export async function stubLegacyRecords(storage: StorageProvider, now: string = new Date().toISOString()): Promise<number> {
  let stubbed = 0;
  for (const row of await storage.query('cert:active:')) {
    if (row.value && row.value.legacy === true) continue;
    await storage.set(row.key, { schemaVersion: '1.0', legacy: true, personalDataRemovedAt: now });
    stubbed++;
  }
  return stubbed;
}

/** Converts every record that is not converted yet, within a time budget; the next run continues. */
export async function convertAll(
  deps: ConversionDeps,
  budgetMs: number,
  clock: () => number = Date.now,
  onConverted: (issueId: string) => Promise<unknown> = async () => undefined
): Promise<Record<ConversionResult, number>> {
  const started = clock();
  const counts = { NO_RECORD: 0, ALREADY: 0, CONVERTED: 0, REDACTED_INVALID: 0, BUSY: 0, JIRA_UNREACHABLE: 0, TOO_LARGE: 0 };
  for (const row of await deps.storage.query('ls3:we:')) {
    if (clock() - started > budgetMs) break;
    const issueId = row.key.slice('ls3:we:'.length);
    if (row.value?.attributes?.parties === 'TOKEN' && !(await deps.storage.get(JOURNAL_PREFIX + issueId))) {
      counts.ALREADY++;
      continue;
    }
    try {
      const result = await convertRecord(deps, issueId);
      counts[result]++;
      if (result === 'CONVERTED') await onConverted(issueId);
    } catch (err) {
      console.error(`LedgerSeal: could not convert the record of issue ${issueId}`, err);
    }
  }
  return counts;
}
