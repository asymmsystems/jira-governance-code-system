/**
 * Gate coverage check (B-17): which transitions into a Done-category status carry the
 * DefinitionGuard validator. Read only: the app cannot attach the validator itself (H11).
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Reads GET /rest/api/3/workflows/search?projectId=<id>&expand=values.transitions as the app,
 * with the read-only granular scope read:workflow:jira. The projectId filter returns the
 * workflows the project uses (checked live on DEMO, 2026-11-01).
 */
import api, { route } from '@forge/api';
import { StorageProvider } from '../storage/checklist-repository';
import { resolveStorage } from '../storage/forge-storage';
import { ProjectConfigStore } from './project-config';
import { requireProjectAdmin } from './settings-resolvers';
import { withRetry } from '../jira/jira-client';

/** The validator module key from manifest.yml. */
export const VALIDATOR_MODULE_KEY = 'definitionguard-workflow-validator';
const PAGE = 50;
const MAX_PAGES = 20;

export interface CoverageRow {
  workflow: string;
  transition: string;
  toStatus: string;
  gated: boolean;
  exempt: boolean;
}

export interface Coverage {
  transitions: CoverageRow[];
  gated: number;
  needed: number;
  missing: number;
  summary: string;
}

/**
 * True when a workflow rule is the DefinitionGuard validator. The rule is matched by the module
 * key anywhere in the rule, because no workflow on the site carries the rule yet to show its
 * exact shape (Inferred, spec v2 D-12).
 */
export function isDefinitionGuardRule(rule: unknown): boolean {
  return rule !== null && rule !== undefined && JSON.stringify(rule).includes(VALIDATOR_MODULE_KEY);
}

export function coverageFromWorkflows(pages: any[], exemptStatusIds: string[]): Coverage {
  const transitions: CoverageRow[] = [];
  for (const page of pages) {
    const statuses = new Map<string, { name: string; category: string }>(
      (page.statuses || []).map((s: any) => [String(s.statusReference), { name: String(s.name), category: String(s.statusCategory) }])
    );
    for (const wf of page.values || []) {
      for (const t of wf.transitions || []) {
        const target = statuses.get(String(t.toStatusReference));
        if (t.type === 'INITIAL' || target?.category !== 'DONE') continue;
        transitions.push({
          workflow: String(wf.name),
          transition: String(t.name),
          toStatus: target.name,
          gated: (t.validators || []).some(isDefinitionGuardRule),
          exempt: exemptStatusIds.includes(String(t.toStatusReference))
        });
      }
    }
  }
  const needed = transitions.filter(t => !t.exempt);
  const gated = needed.filter(t => t.gated).length;
  const missing = needed.length - gated;
  let summary: string;
  if (transitions.length === 0) summary = 'This project has no transition into a Done-category status.';
  else if (missing === 0) summary = `All ${needed.length} completion transitions are gated.`;
  else summary = `${gated} of ${needed.length} completion transitions are gated. DefinitionGuard is not on ${missing} of them yet: issues can reach Done through them without the checklist.`;
  return { transitions, gated, needed: needed.length, missing, summary };
}

export async function gateCoverage(_payload: any, context?: any, storageProvider?: StorageProvider): Promise<Coverage> {
  const c = await requireProjectAdmin(context);
  const pages: any[] = [];
  for (let startAt = 0, n = 0; n < MAX_PAGES; n++, startAt += PAGE) {
    const res = await withRetry(() => api.asApp().requestJira(route`/rest/api/3/workflows/search?projectId=${c.projectId}&expand=values.transitions&startAt=${startAt}&maxResults=${PAGE}`));
    if (res.status !== 200) {
      throw new Error('DefinitionGuard could not read the project workflows. Ask a Jira admin to check that DefinitionGuard has workflow read access.');
    }
    const page = await res.json();
    pages.push(page);
    if (page.isLast !== false) break;
  }
  const config = await new ProjectConfigStore(resolveStorage(storageProvider)).get(c.projectId);
  return coverageFromWorkflows(pages, config?.exemptStatusIds || []);
}
