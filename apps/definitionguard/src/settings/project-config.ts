/**
 * Per-project DefinitionGuard settings: the Done-category statuses the gate lets through.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Key: dg:proj:<projectId>.
 */
import { StorageProvider } from '../storage/checklist-repository';

export const projectConfigKey = (projectId: string) => `dg:proj:${projectId}`;

export interface ProjectConfig {
  exemptStatusIds: string[];
  updatedAt: string;
  updatedByAccountId: string;
}

export class ProjectConfigStore {
  constructor(private readonly storage: StorageProvider) {}

  public async get(projectId: string): Promise<ProjectConfig | undefined> {
    if (!projectId) return undefined;
    return await this.storage.get<ProjectConfig>(projectConfigKey(projectId));
  }

  public async saveExemptions(projectId: string, exemptStatusIds: string[], actorAccountId: string): Promise<ProjectConfig> {
    const config: ProjectConfig = { exemptStatusIds: [...new Set(exemptStatusIds)], updatedAt: new Date().toISOString(), updatedByAccountId: actorAccountId };
    await this.storage.set(projectConfigKey(projectId), config);
    return config;
  }
}
