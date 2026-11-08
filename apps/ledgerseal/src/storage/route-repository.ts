/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: storage of approval routes (ADR-017, spec v4 section 15.6). Each route version is created once; a run
 * record holds the issue's current approval run and the chain head while the issue has no seal yet.
 *
 * @author Fahim Farook
 */

import { ApprovalRun, hasValidRouteHash, hasValidRunHash, RouteVersion } from '../domain/route';
import { StorageProvider } from './seal-repository';

const pad = (n: number) => String(n).padStart(6, '0');
/** "*" (every issue type) is not a valid KVS key character (live, development, 2026-11-08), so the key says "all". */
const typeKey = (issueTypeId: string) => (issueTypeId === '*' ? 'all' : issueTypeId);

export interface RouteHead {
  routeId: string;
  currentVersion: number;
  name: string;
}

export interface RouteBinding {
  routeId: string;
  projectId: string;
  issueTypeId: string;
  setByPartyId: string;
  fromDate: string;
}

/** The run record with the chain head it last wrote (used while the issue has no sealed work effort). */
export interface StoredRun extends ApprovalRun {
  chainHead: { seq: number; entryHash: string };
}

export class RouteRepository {
  constructor(private readonly storage: StorageProvider) {}

  async heads(): Promise<RouteHead[]> {
    return (await this.storage.query('ls3:route:')).map(r => r.value as RouteHead).sort((a, b) => (a.name < b.name ? -1 : 1));
  }

  async head(routeId: string): Promise<RouteHead | null> {
    return (await this.storage.get(`ls3:route:${routeId}`)) || null;
  }

  async version(routeId: string, version: number): Promise<RouteVersion | null> {
    const v: RouteVersion | null = (await this.storage.get(`ls3:routever:${routeId}:${pad(version)}`)) || null;
    return v && hasValidRouteHash(v) ? v : null;
  }

  async current(routeId: string): Promise<RouteVersion | null> {
    const head = await this.head(routeId);
    return head ? this.version(routeId, head.currentVersion) : null;
  }

  /** Every stored version of a route, oldest first. */
  async versions(routeId: string): Promise<RouteVersion[]> {
    return (await this.storage.query(`ls3:routever:${routeId}:`)).map(r => r.value as RouteVersion).sort((a, b) => a.version - b.version);
  }

  /** Creates the version once (a concurrent save of the same number loses), then moves the head. */
  async saveVersion(route: RouteVersion): Promise<boolean> {
    if (!hasValidRouteHash(route)) throw new Error('LedgerSeal: refusing to store a route with a wrong hash.');
    if (!(await this.storage.createIfAbsent(`ls3:routever:${route.routeId}:${pad(route.version)}`, route))) return false;
    await this.storage.set(`ls3:route:${route.routeId}`, { routeId: route.routeId, currentVersion: route.version, name: route.name } as RouteHead);
    return true;
  }

  /** The most specific binding: the issue type, then every issue type of the project (ADR-017 decision 2). */
  async binding(projectId: string, issueTypeId: string): Promise<RouteBinding | null> {
    return (await this.storage.get(`ls3:routebind:${projectId}:${typeKey(issueTypeId)}`)) || (await this.storage.get(`ls3:routebind:${projectId}:all`)) || null;
  }

  async bindings(): Promise<RouteBinding[]> {
    return (await this.storage.query('ls3:routebind:')).map(r => r.value as RouteBinding);
  }

  async bind(binding: RouteBinding): Promise<void> {
    await this.storage.set(`ls3:routebind:${binding.projectId}:${typeKey(binding.issueTypeId)}`, binding);
  }

  async unbind(projectId: string, issueTypeId: string): Promise<void> {
    await this.storage.delete(`ls3:routebind:${projectId}:${typeKey(issueTypeId)}`);
  }

  /** The issue's run, or 'invalid' when its record hash does not match (fail closed). */
  async run(issueId: string): Promise<StoredRun | null | 'invalid'> {
    const run: StoredRun | null = (await this.storage.get(`ls3:run:${issueId}`)) || null;
    if (!run) return null;
    const { chainHead: _head, ...rest } = run;
    return hasValidRunHash(rest as ApprovalRun) ? run : 'invalid';
  }

  async saveRun(run: StoredRun): Promise<void> {
    await this.storage.set(`ls3:run:${run.issueId}`, run);
  }

  /** The snapshot parts a run stored for its stages; deleted when the run ends. */
  async deleteRunContent(contentId: string, storage: StorageProvider = this.storage): Promise<void> {
    if (!contentId) return;
    for (const row of await storage.query(`ls3:runcontent:${contentId}:`)) await storage.delete(row.key);
  }

  async deleteRun(issueId: string): Promise<void> {
    await this.storage.delete(`ls3:run:${issueId}`);
  }
}
