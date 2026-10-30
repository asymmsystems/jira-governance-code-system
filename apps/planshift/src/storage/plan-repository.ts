/**
 * PlanShift: Storage Repository Layer
 * Manages persistence for project plans, tasks, allocations, and partial completion dependencies.
 */

import { ProjectPlanState, TaskDependency, PortfolioResourceHeatmapRow } from '../domain/models';

export interface StorageProvider {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
}

export class PlanRepository {
  private storage: StorageProvider;

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  private getPlanKey(projectKey: string): string {
    return `ps:plan:${projectKey}`;
  }

  private getDependencyKey(taskId: string): string {
    return `ps:dep:${taskId}`;
  }

  private getMetadataKey(projectKey: string): string {
    return `ps:resmeta:${projectKey}`;
  }

  public async getProjectPlan(projectKey: string): Promise<ProjectPlanState | undefined> {
    return await this.storage.get<ProjectPlanState>(this.getPlanKey(projectKey));
  }

  public async saveProjectPlan(plan: ProjectPlanState): Promise<void> {
    await this.storage.set(this.getPlanKey(plan.projectKey), plan);
  }

  public async deleteProjectPlan(projectKey: string): Promise<void> {
    await this.storage.delete(this.getPlanKey(projectKey));
  }

  public async getTaskDependency(taskId: string): Promise<TaskDependency | undefined> {
    return await this.storage.get<TaskDependency>(this.getDependencyKey(taskId));
  }

  public async saveTaskDependency(taskId: string, dependency: TaskDependency): Promise<void> {
    await this.storage.set(this.getDependencyKey(taskId), dependency);
  }

  public async getResourceMetadata(projectKey: string): Promise<Record<string, { coe: string; vertical: string; project: string }> | undefined> {
    return await this.storage.get(this.getMetadataKey(projectKey));
  }

  public async saveResourceMetadata(projectKey: string, metadata: Record<string, { coe: string; vertical: string; project: string }>): Promise<void> {
    await this.storage.set(this.getMetadataKey(projectKey), metadata);
  }
}
