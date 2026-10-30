/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Asymm Systems Team
 * FourRealities: Metrics & Audit Snapshot Storage Repository
 */

import { ProjectAuditSnapshot, RealitySignals, IssueExceptionRecord } from '../domain/models';

export interface StorageProvider {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
}

export class MetricsRepository {
  private storage: StorageProvider;

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  private getProjectKey(projectKey: string): string {
    return `fr:project:${projectKey}:latest`;
  }

  private getProjectHistoryKey(projectKey: string): string {
    return `fr:project:${projectKey}:history`;
  }

  private getIssueKey(issueId: string): string {
    return `fr:issue:${issueId}:signals`;
  }

  private getExceptionKey(issueId: string): string {
    return `fr:issue:${issueId}:exception`;
  }

  public async saveProjectSnapshot(snapshot: ProjectAuditSnapshot): Promise<void> {
    await this.storage.set(this.getProjectKey(snapshot.projectKey), snapshot);

    // Maintain historical snapshots for authentic trend calculation (capped at 10)
    const history = (await this.storage.get<ProjectAuditSnapshot[]>(this.getProjectHistoryKey(snapshot.projectKey))) || [];
    history.push(snapshot);
    if (history.length > 10) {
      history.shift();
    }
    await this.storage.set(this.getProjectHistoryKey(snapshot.projectKey), history);
  }

  public async getLatestProjectSnapshot(projectKey: string): Promise<ProjectAuditSnapshot | undefined> {
    return await this.storage.get<ProjectAuditSnapshot>(this.getProjectKey(projectKey));
  }

  public async getPreviousProjectSnapshot(projectKey: string): Promise<ProjectAuditSnapshot | undefined> {
    const history = await this.storage.get<ProjectAuditSnapshot[]>(this.getProjectHistoryKey(projectKey));
    if (!history || history.length < 2) {
      return undefined;
    }
    // Second-to-last snapshot represents the previous baseline
    return history[history.length - 2];
  }

  public async saveIssueSignals(signals: RealitySignals): Promise<void> {
    await this.storage.set(this.getIssueKey(signals.issueId), signals);
  }

  public async getIssueSignals(issueId: string): Promise<RealitySignals | undefined> {
    return await this.storage.get<RealitySignals>(this.getIssueKey(issueId));
  }

  public async deleteIssueSignals(issueId: string): Promise<void> {
    await this.storage.delete(this.getIssueKey(issueId));
  }

  public async saveIssueException(record: IssueExceptionRecord): Promise<void> {
    await this.storage.set(this.getExceptionKey(record.issueId), record);
  }

  public async getIssueException(issueId: string): Promise<IssueExceptionRecord | undefined> {
    return await this.storage.get<IssueExceptionRecord>(this.getExceptionKey(issueId));
  }
}
