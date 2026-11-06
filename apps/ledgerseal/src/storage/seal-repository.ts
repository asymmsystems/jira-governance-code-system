/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: Forge Storage Repository Abstraction
 * Stores seals on the Silverston WorkEffort, Party and Status patterns (spec v2 sections 3.2 and 6, ADR-01).
 * Status rows are created once and never rewritten. v1 certificates are read as legacy only.
 *
 * @author Fahim Farook
 */

import { CanonicalIssueSnapshot, SealCertificate, SealedWorkEffort, WorkEffortPartyAssignment, WorkEffortStatus } from '../domain/models';
import { LoadedSeal } from '../domain/seal-record';

export interface StorageProvider {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  /** Writes `value` only if `key` does not exist yet. Returns false when the key already exists. */
  createIfAbsent(key: string, value: any): Promise<boolean>;
  /** Writes all items together, or none of them (one KVS transaction). */
  commit(items: { key: string; value: any }[]): Promise<void>;
  /** Every key that starts with `prefix`, with its value, read page by page. */
  query(prefix: string): Promise<{ key: string; value: any }[]>;
}

export const HISTORY_PAGE_SIZE = 50;

/** Largest snapshot part in UTF-8 bytes: half the 240 KiB KVS value limit (spec v2 section 6, B-17). */
export const MAX_PART_BYTES = 120000;
/** A seal transaction holds the parts, two assignments and the work effort, within 25 operations. */
export const MAX_CONTENT_PARTS = 22;

/** UTF-8 bytes of one character inside a JSON string, from its code point (no JSON.stringify per character). */
function storedBytes(char: string): number {
  const code = char.codePointAt(0) as number;
  if (code === 0x22 || code === 0x5c) return 2; // \" and \\
  if (code < 0x20) return code === 0x08 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d ? 2 : 6;
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code >= 0xd800 && code <= 0xdfff) return 6; // a lone surrogate is written as \uXXXX
  return code > 0xffff ? 4 : 3;
}

/**
 * Splits text into parts of at most `maxBytes` UTF-8 bytes as stored, never inside a character.
 * KVS stores each part as a JSON string, so a character counts at its JSON-escaped size (a quote counts 2).
 */
export function splitUtf8(text: string, maxBytes: number): string[] {
  const parts: string[] = [];
  let current = '';
  let size = 2; // the two quotes around a stored JSON string
  for (const char of text) {
    const bytes = storedBytes(char);
    if (size + bytes > maxBytes && current.length > 0) {
      parts.push(current);
      current = '';
      size = 2;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts;
}

export class SealRepository {
  constructor(private storage: StorageProvider) {}

  private getWorkEffortKey(workEffortId: string): string {
    return `ls3:we:${workEffortId}`;
  }

  private getStatusKey(workEffortId: string, seq: number): string {
    return `ls3:wes:${workEffortId}:${String(seq).padStart(6, '0')}`;
  }

  private getAssignmentKey(workEffortId: string, fromDate: string): string {
    return `ls3:wepa:${workEffortId}:${fromDate}`;
  }

  private getContentKey(contentId: string, part: number): string {
    return `ls3:content:${contentId}:${part}`;
  }

  private getLegacyCertKey(issueId: string): string {
    return `cert:active:${issueId}`;
  }

  async getWorkEffort(workEffortId: string): Promise<SealedWorkEffort | null> {
    return (await this.storage.get(this.getWorkEffortKey(workEffortId))) || null;
  }

  /**
   * Reads the work effort with its current assignment and sealing row. Returns `missing` when a part the
   * work effort points to does not exist, so the caller can report the record as invalid.
   */
  async getSeal(workEffortId: string): Promise<LoadedSeal | 'missing' | null> {
    const workEffort = await this.getWorkEffort(workEffortId);
    if (!workEffort) return null;
    const current = workEffort.currentAssignment;
    const assignment = await this.getAssignment(workEffortId, current?.fromDate);
    const sealingRow = await this.getStatusRow(workEffortId, current?.sealingSeq);
    if (!assignment || !sealingRow) return 'missing';
    const seal: LoadedSeal = { workEffort, assignment, sealingRow };
    if (workEffort.currentStatusId === 'LS_REVOKED') {
      seal.headRow = (await this.getStatusRow(workEffortId, workEffort.statusHead.seq)) || undefined;
    }
    return seal;
  }

  async getAssignment(workEffortId: string, fromDate: string): Promise<WorkEffortPartyAssignment | null> {
    return (await this.storage.get(this.getAssignmentKey(workEffortId, fromDate))) || null;
  }

  async getStatusRow(workEffortId: string, seq: number): Promise<WorkEffortStatus | null> {
    return (await this.storage.get(this.getStatusKey(workEffortId, seq))) || null;
  }

  /**
   * Retrieves a v1 certificate, if one exists. The app never writes or deletes v1 keys.
   */
  async getLegacyCertificate(issueId: string): Promise<SealCertificate | null> {
    return (await this.storage.get(this.getLegacyCertKey(issueId))) || null;
  }

  /**
   * Reads the sealed snapshot content from its parts.
   */
  async getContent(workEffort: SealedWorkEffort): Promise<CanonicalIssueSnapshot | null> {
    let text = '';
    for (let part = 0; part < workEffort.attributes.snapshotParts; part++) {
      const chunk = await this.storage.get(this.getContentKey(workEffort.currentContentId, part));
      if (typeof chunk !== 'string') return null;
      text += chunk;
    }
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  /**
   * Creates the next status row. Returns false if a row with that number exists,
   * which means another writer changed the seal first.
   */
  async appendStatus(row: WorkEffortStatus): Promise<boolean> {
    return this.storage.createIfAbsent(this.getStatusKey(row.workEffortId, row.seq), row);
  }

  /**
   * Saves a new seal in one transaction: the snapshot content parts, the new assignment,
   * the ended previous assignment (if any) and the work effort.
   */
  async saveSeal(
    workEffort: SealedWorkEffort,
    assignment: WorkEffortPartyAssignment,
    contentParts: string[],
    endedAssignment: WorkEffortPartyAssignment | null = null
  ): Promise<void> {
    const items: { key: string; value: unknown }[] = contentParts.map((value, part) => ({
      key: this.getContentKey(workEffort.currentContentId, part),
      value
    }));
    if (endedAssignment) {
      items.push({ key: this.getAssignmentKey(endedAssignment.workEffortId, endedAssignment.fromDate), value: endedAssignment });
    }
    items.push({ key: this.getAssignmentKey(assignment.workEffortId, assignment.fromDate), value: assignment });
    items.push({ key: this.getWorkEffortKey(workEffort.workEffortId), value: workEffort });
    await this.storage.commit(items);
  }

  /**
   * Removes a status row this writer created when the transaction that should follow it failed.
   * Without this, the orphan row would make every later write return CONFLICT.
   */
  async removeStatus(row: WorkEffortStatus): Promise<void> {
    await this.storage.delete(this.getStatusKey(row.workEffortId, row.seq));
  }

  /** Saves a revoke in one transaction: the ended assignment and the work effort. */
  async saveRevocation(workEffort: SealedWorkEffort, endedAssignment: WorkEffortPartyAssignment): Promise<void> {
    await this.storage.commit([
      { key: this.getAssignmentKey(endedAssignment.workEffortId, endedAssignment.fromDate), value: endedAssignment },
      { key: this.getWorkEffortKey(workEffort.workEffortId), value: workEffort }
    ]);
  }

  /** Deletes every part of one sealed snapshot (a superseded seal's snapshot, which nothing reads). */
  async deleteContent(contentId: string): Promise<void> {
    for (const row of await this.storage.query(`ls3:content:${contentId}:`)) await this.storage.delete(row.key);
  }

  /** Saves the work effort alone (a change incident updates only its current values). */
  async saveWorkEffort(workEffort: SealedWorkEffort): Promise<void> {
    await this.storage.commit([{ key: this.getWorkEffortKey(workEffort.workEffortId), value: workEffort }]);
  }

  /**
   * Retrieves status rows, oldest first, from `fromSeq` up to `toSeq`, at most one page.
   */
  async getStatusRows(workEffortId: string, fromSeq: number, toSeq: number): Promise<WorkEffortStatus[]> {
    const rows: WorkEffortStatus[] = [];
    const last = Math.min(toSeq, fromSeq + HISTORY_PAGE_SIZE - 1);
    for (let seq = Math.max(1, fromSeq); seq <= last; seq++) {
      const row = await this.getStatusRow(workEffortId, seq);
      if (row) rows.push(row);
    }
    return rows;
  }
}
