import { BaselineRepository } from '../../src/storage/baseline-repository';
import { StorageProvider } from '../../src/storage/plan-repository';
import { PlanBaseline, ScopeShiftRequest } from '../../src/domain/scope-creep';

class MemoryStorageProvider implements StorageProvider {
  private data = new Map<string, any>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

describe('BaselineRepository', () => {
  let storage: StorageProvider;
  let repo: BaselineRepository;

  beforeEach(() => {
    storage = new MemoryStorageProvider();
    repo = new BaselineRepository(storage);
  });

  it('saves and retrieves baselines, setting active baseline', async () => {
    const baseline: PlanBaseline = {
      baselineId: 'bl-1',
      planId: 'plan-default',
      projectKey: 'PROJ',
      name: 'Baseline Q4',
      frozenAt: new Date().toISOString(),
      frozenBy: 'user-1',
      tasks: {},
      totalCommitmentHours: 100,
      totalTaskCount: 10
    };

    await repo.saveBaseline(baseline);

    const retrieved = await repo.getBaseline('PROJ', 'plan-default', 'bl-1');
    expect(retrieved).toEqual(baseline);

    const active = await repo.getActiveBaseline('PROJ', 'plan-default');
    expect(active).toEqual(baseline);

    const list = await repo.listBaselines('PROJ', 'plan-default');
    expect(list.length).toBe(1);
    expect(list[0].baselineId).toBe('bl-1');
  });

  it('saves and lists shift requests', async () => {
    const shift: ScopeShiftRequest = {
      shiftId: 'shift-1',
      planId: 'plan-default',
      baselineId: 'bl-1',
      projectKey: 'PROJ',
      requestedBy: 'user-1',
      requestedAt: new Date().toISOString(),
      status: 'PENDING',
      deltaHours: 20,
      reason: 'Extra scope',
      addedTaskKeys: ['PROJ-10'],
      removedTaskKeys: [],
      modifiedTaskKeys: []
    };

    await repo.saveShiftRequest(shift);

    const requests = await repo.getShiftRequests('PROJ', 'plan-default');
    expect(requests.length).toBe(1);
    expect(requests[0].shiftId).toBe('shift-1');

    shift.status = 'APPROVED';
    shift.reviewedBy = 'manager-1';
    await repo.saveShiftRequest(shift);

    const updated = await repo.getShiftRequests('PROJ', 'plan-default');
    expect(updated.length).toBe(1);
    expect(updated[0].status).toBe('APPROVED');
  });
});
