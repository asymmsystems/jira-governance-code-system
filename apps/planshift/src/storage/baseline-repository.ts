/**
 * PlanShift: Baseline and Scope Shift Storage Repository Layer
 * Manages persistence for frozen commitment baselines and scope shift approval records.
 */

import { StorageProvider } from './plan-repository';
import { PlanBaseline, ScopeShiftRequest } from '../domain/scope-creep';

export class BaselineRepository {
  private storage: StorageProvider;

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  private getBaselineKey(projectKey: string, planId: string, baselineId: string): string {
    return `ps:baseline:${projectKey}:${planId}:${baselineId}`;
  }

  private getBaselineIndexKey(projectKey: string, planId: string): string {
    return `ps:baselines_idx:${projectKey}:${planId}`;
  }

  private getActiveBaselineKey(projectKey: string, planId: string): string {
    return `ps:active_baseline:${projectKey}:${planId}`;
  }

  private getShiftsKey(projectKey: string, planId: string): string {
    return `ps:shifts:${projectKey}:${planId}`;
  }

  public async saveBaseline(baseline: PlanBaseline): Promise<void> {
    const key = this.getBaselineKey(baseline.projectKey, baseline.planId, baseline.baselineId);
    await this.storage.set(key, baseline);

    // Update index of baselines
    const indexKey = this.getBaselineIndexKey(baseline.projectKey, baseline.planId);
    const existingIndex = (await this.storage.get<string[]>(indexKey)) || [];
    if (!existingIndex.includes(baseline.baselineId)) {
      existingIndex.push(baseline.baselineId);
      await this.storage.set(indexKey, existingIndex);
    }

    // Set as active baseline
    await this.storage.set(this.getActiveBaselineKey(baseline.projectKey, baseline.planId), baseline.baselineId);
  }

  public async getBaseline(projectKey: string, planId: string, baselineId: string): Promise<PlanBaseline | undefined> {
    const key = this.getBaselineKey(projectKey, planId, baselineId);
    return await this.storage.get<PlanBaseline>(key);
  }

  public async getActiveBaseline(projectKey: string, planId: string): Promise<PlanBaseline | undefined> {
    const activeId = await this.storage.get<string>(this.getActiveBaselineKey(projectKey, planId));
    if (!activeId) return undefined;
    return await this.getBaseline(projectKey, planId, activeId);
  }

  public async listBaselines(projectKey: string, planId: string): Promise<PlanBaseline[]> {
    const indexKey = this.getBaselineIndexKey(projectKey, planId);
    const ids = (await this.storage.get<string[]>(indexKey)) || [];
    const results: PlanBaseline[] = [];

    for (const id of ids) {
      const b = await this.getBaseline(projectKey, planId, id);
      if (b) {
        results.push(b);
      }
    }

    return results;
  }

  public async getShiftRequests(projectKey: string, planId: string): Promise<ScopeShiftRequest[]> {
    const key = this.getShiftsKey(projectKey, planId);
    return (await this.storage.get<ScopeShiftRequest[]>(key)) || [];
  }

  public async saveShiftRequest(request: ScopeShiftRequest): Promise<void> {
    const key = this.getShiftsKey(request.projectKey, request.planId);
    const requests = (await this.storage.get<ScopeShiftRequest[]>(key)) || [];
    const idx = requests.findIndex(r => r.shiftId === request.shiftId);
    if (idx >= 0) {
      requests[idx] = request;
    } else {
      requests.push(request);
    }
    await this.storage.set(key, requests);
  }
}
