import { ProjectAuditSnapshot, RealitySignals } from '../domain/models';

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

  private getIssueKey(issueId: string): string {
    return `fr:issue:${issueId}:signals`;
  }

  public async saveProjectSnapshot(snapshot: ProjectAuditSnapshot): Promise<void> {
    await this.storage.set(this.getProjectKey(snapshot.projectKey), snapshot);
  }

  public async getLatestProjectSnapshot(projectKey: string): Promise<ProjectAuditSnapshot | undefined> {
    return await this.storage.get<ProjectAuditSnapshot>(this.getProjectKey(projectKey));
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
}
