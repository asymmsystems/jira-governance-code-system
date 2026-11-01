import { IssueChecklistState, ChecklistTemplate } from '../domain/models';

export interface StorageProvider {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  /** Writes only when the key is absent. Returns false when another writer already wrote it. */
  setIfAbsent(key: string, value: any): Promise<boolean>;
  /** One page of values whose keys start with the prefix (eventually consistent in Forge KVS). */
  listByPrefix(prefix: string, cursor?: string, limit?: number): Promise<{ values: any[]; nextCursor?: string }>;
}

export class ChecklistRepository {
  private storage: StorageProvider;

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  private getIssueKey(issueId: string): string {
    return `dg:checklist:${issueId}`;
  }

  private getTemplateKey(templateId: string): string {
    return `dg:template:${templateId}`;
  }

  public async getIssueChecklist(issueId: string): Promise<IssueChecklistState | undefined> {
    return await this.storage.get<IssueChecklistState>(this.getIssueKey(issueId));
  }

  public async saveIssueChecklist(state: IssueChecklistState): Promise<void> {
    await this.storage.set(this.getIssueKey(state.issueId), state);
  }

  public async deleteIssueChecklist(issueId: string): Promise<void> {
    await this.storage.delete(this.getIssueKey(issueId));
  }

  public async getTemplate(templateId: string): Promise<ChecklistTemplate | undefined> {
    return await this.storage.get<ChecklistTemplate>(this.getTemplateKey(templateId));
  }

  public async saveTemplate(template: ChecklistTemplate): Promise<void> {
    await this.storage.set(this.getTemplateKey(template.id), template);
  }
}
