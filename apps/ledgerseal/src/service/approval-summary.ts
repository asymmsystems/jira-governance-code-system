/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: the approval summary of a routed issue for the ledgerseal-cert property (ADR-017 decision 12). Null for
 * an issue that never had a route run, so its property stays schema 3.
 *
 * @author Fahim Farook
 */

import { ApprovalSummary } from '../domain/attestation';
import { isStageComplete, requiredStages, stageCounts } from '../domain/route';
import { RouteRepository } from '../storage/route-repository';
import { StorageProvider } from '../storage/seal-repository';

export async function approvalSummary(storage: StorageProvider, issueId: string): Promise<ApprovalSummary | null> {
  const repo = new RouteRepository(storage);
  const run = await repo.run(issueId);
  if (!run || run === 'invalid') return null;
  const route = await repo.version(run.routeId, run.routeVersion);
  const required = route ? requiredStages(route, run.requiredStageIds) : [];
  const counts = stageCounts(run);
  return {
    runState: run.state,
    stagesComplete: required.filter(s => isStageComplete(s, counts)).length,
    stagesTotal: run.requiredStageIds.length,
    routeHash: run.routeHash
  };
}
