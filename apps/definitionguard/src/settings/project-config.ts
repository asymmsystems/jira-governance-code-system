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
  updatedByPartyId: string;               // pseudonym of the project admin (ADR-010)
  updatedByAccountId?: string;            // written before ADR-010; replaced by the personal data pass
}

export class ProjectConfigStore {
  constructor(private readonly storage: StorageProvider) {}

  public async get(projectId: string): Promise<ProjectConfig | undefined> {
    if (!projectId) return undefined;
    return await this.storage.get<ProjectConfig>(projectConfigKey(projectId));
  }

  public async saveExemptions(projectId: string, exemptStatusIds: string[], actorPartyId: string): Promise<ProjectConfig> {
    const config: ProjectConfig = { exemptStatusIds: [...new Set(exemptStatusIds)], updatedAt: new Date().toISOString(), updatedByPartyId: actorPartyId };
    await this.storage.set(projectConfigKey(projectId), config);
    return config;
  }
}
