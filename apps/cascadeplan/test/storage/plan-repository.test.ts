/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import { PlanRepository, StorageProvider } from '../../src/storage/plan-repository';
import { ProjectPlanState, TaskDependency } from '../../src/domain/models';

class MockStorage implements StorageProvider {
  private store = new Map<string, any>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('PlanRepository Storage Tests', () => {
  let storage: MockStorage;
  let repo: PlanRepository;

  beforeEach(() => {
    storage = new MockStorage();
    repo = new PlanRepository(storage);
  });

  it('saves and retrieves a project plan', async () => {
    const plan: ProjectPlanState = {
      planId: 'plan-1',
      projectKey: 'PROJ',
      projectName: 'Alpha',
      overallProjectCompletion: 40,
      overallTargetCompletion: 45,
      weeks: [],
      tasks: [],
      lastUpdated: '2026-10-30T00:00:00Z'
    };

    await repo.saveProjectPlan(plan);
    const retrieved = await repo.getProjectPlan('PROJ');
    expect(retrieved).toEqual(plan);

    await repo.deleteProjectPlan('PROJ');
    const afterDelete = await repo.getProjectPlan('PROJ');
    expect(afterDelete).toBeUndefined();
  });

  it('saves and retrieves task dependencies', async () => {
    const dep: TaskDependency = {
      predecessorId: 'T-1',
      predecessorKey: 'PROJ-1',
      triggerPercent: 30,
      isTriggerSatisfied: true,
      notes: 'Testing dependency'
    };

    await repo.saveTaskDependency('T-2', dep);
    const retrieved = await repo.getTaskDependency('T-2');
    expect(retrieved).toEqual(dep);
  });

  it('saves and retrieves resource metadata', async () => {
    const meta = {
      'Resource 1': { coe: 'Frontend', vertical: 'Fintech', project: 'Project 1' }
    };

    await repo.saveResourceMetadata('PROJ', meta);
    const retrieved = await repo.getResourceMetadata('PROJ');
    expect(retrieved).toEqual(meta);
  });
});
