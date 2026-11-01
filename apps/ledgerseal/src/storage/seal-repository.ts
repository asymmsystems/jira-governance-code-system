/**
 * LedgerSeal: Forge Storage Repository Abstraction
 * Stores seals on the Silverston WorkEffort, Party and Status patterns (spec v2 sections 3.2 and 6, ADR-01).
 * Status rows are created once and never rewritten. v1 certificates are read as legacy only.
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
}

export const HISTORY_PAGE_SIZE = 50;

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
