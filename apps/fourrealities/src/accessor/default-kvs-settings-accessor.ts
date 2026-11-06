/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: admin settings, approver policy and source detection in Forge KVS (ADR-011).
 * None of these values holds an account id (ADR-012).
 */

import { ApproverPolicy, DEFAULT_SOURCE_SETTINGS, DetectedSources, EvidenceSourceSettings } from '../contract/data/models';
import { SettingsAccessor, StorageProvider } from '../contract/accessors';

export const SETTINGS_KEY = 'fr:cfg:sources';
export const DETECTED_KEY = 'fr:cfg:detected';
export const APPROVER_POLICY_KEY = 'fr:cfg:approver_policy';

export class DefaultKvsSettingsAccessor implements SettingsAccessor {
  readonly serviceType = 'accessor' as const;

  constructor(private readonly storage: StorageProvider) {}

  async getSettings(): Promise<EvidenceSourceSettings> {
    const saved = await this.storage.get<EvidenceSourceSettings>(SETTINGS_KEY);
    return saved && saved.schemaVersion === 1 ? { ...DEFAULT_SOURCE_SETTINGS, ...saved } : DEFAULT_SOURCE_SETTINGS;
  }

  saveSettings(settings: EvidenceSourceSettings): Promise<void> {
    return this.storage.set(SETTINGS_KEY, settings);
  }

  async getDetected(): Promise<DetectedSources> {
    return (await this.storage.get<DetectedSources>(DETECTED_KEY)) || {};
  }

  saveDetected(detected: DetectedSources): Promise<void> {
    return this.storage.set(DETECTED_KEY, detected);
  }

  getApproverPolicy(): Promise<ApproverPolicy | undefined> {
    return this.storage.get<ApproverPolicy>(APPROVER_POLICY_KEY);
  }

  saveApproverPolicy(policy: ApproverPolicy): Promise<void> {
    return this.storage.set(APPROVER_POLICY_KEY, policy);
  }
}
