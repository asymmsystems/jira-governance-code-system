import { ChecklistRepository, StorageProvider } from '../../src/storage/checklist-repository';
import { IssueChecklistState, ChecklistTemplate } from '../../src/domain/models';

class MockStorageProvider implements StorageProvider {
  private store: Map<string, any> = new Map();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  // Not used by ChecklistRepository; present to satisfy the v2 StorageProvider interface.
  async setIfAbsent(key: string, value: any): Promise<boolean> {
    if (this.store.has(key)) return false;
    this.store.set(key, value);
    return true;
  }

  async listByPrefix(): Promise<{ values: any[] }> {
    return { values: [] };
  }
}

describe('ChecklistRepository', () => {
  let mockStorage: MockStorageProvider;
  let repository: ChecklistRepository;

  beforeEach(() => {
    mockStorage = new MockStorageProvider();
    repository = new ChecklistRepository(mockStorage);
  });

  const sampleState: IssueChecklistState = {
    issueId: '10001',
    issueKey: 'SEC-101',
    templateId: 'template-1',
    items: [],
    lastModifiedAt: '2026-10-29T10:00:00Z',
    lastModifiedBy: 'user-abc',
    isFullySatisfied: true,
    checklistHash: 'mock-hash'
  };

  const sampleTemplate: ChecklistTemplate = {
    id: 'tmpl-qa',
    name: 'QA Checklist',
    description: 'QA signoff',
    items: []
  };

  it('saves and retrieves issue checklist state', async () => {
    await repository.saveIssueChecklist(sampleState);
    const retrieved = await repository.getIssueChecklist('10001');

    expect(retrieved).toEqual(sampleState);
  });

  it('returns undefined when checklist state is not found', async () => {
    const retrieved = await repository.getIssueChecklist('non-existent');
    expect(retrieved).toBeUndefined();
  });

  it('deletes issue checklist state', async () => {
    await repository.saveIssueChecklist(sampleState);
    await repository.deleteIssueChecklist('10001');

    const retrieved = await repository.getIssueChecklist('10001');
    expect(retrieved).toBeUndefined();
  });

  it('saves and retrieves checklist template', async () => {
    await repository.saveTemplate(sampleTemplate);
    const retrieved = await repository.getTemplate('tmpl-qa');

    expect(retrieved).toEqual(sampleTemplate);
  });
});
