/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: a test harness for the evidence report Manager: the real KVS records, Engines, signer and
 * party tokens over memory storage, with an in-memory Object Store, queue and Jira (user and app views).
 */

import * as crypto from 'crypto';
import { DefaultEvidenceReportManager } from '../../src/manager/default-evidence-report-manager';
import { DefaultKvsReportStoreAccessor } from '../../src/accessor/default-kvs-report-store-accessor';
import { DefaultReportCryptoAccessor } from '../../src/accessor/default-report-crypto-accessor';
import { DefaultKvsPartyTokenAccessor } from '../../src/accessor/default-kvs-party-token-accessor';
import { DefaultKvsSettingsAccessor } from '../../src/accessor/default-kvs-settings-accessor';
import { DefaultKvsExceptionEventAccessor } from '../../src/accessor/default-kvs-exception-event-accessor';
import { DefaultKvsReworkNoteAccessor } from '../../src/accessor/default-kvs-rework-note-accessor';
import { DefaultKvsAttestationHistoryAccessor } from '../../src/accessor/default-kvs-attestation-history-accessor';
import { DefaultReportEngine } from '../../src/engine/default-report-engine';
import { DefaultReportPolicyEngine } from '../../src/engine/default-report-policy-engine';
import { DefaultSourcePolicyEngine } from '../../src/engine/default-source-policy-engine';
import { DefaultGateEngine } from '../../src/engine/default-gate-engine';
import { DefaultMetricsEngine } from '../../src/engine/default-metrics-engine';
import { DefaultExceptionPolicyEngine } from '../../src/engine/default-exception-policy-engine';
import { ChangelogEntry, FieldInfo, ReportCaller, ReportPermissions } from '../../src/contract/data/reports';
import { JiraReportAccessor, ObjectStoreAccessor, ReportPolicyEngine } from '../../src/contract/reports';
import { MemoryStorage } from '../storage/memory-storage';
import { makeFacts } from '../domain/fixtures';

export const PROJECT = { projectKey: 'PAY', projectId: '10000' };
export const ADMIN: ReportPermissions = { status: 200, browse: true, administerProjects: true, administerJira: true };
export const PROJECT_ADMIN: ReportPermissions = { status: 200, browse: true, administerProjects: true, administerJira: false };
export const BROWSER: ReportPermissions = { status: 200, browse: true, administerProjects: false, administerJira: false };
export const NOBODY: ReportPermissions = { status: 200, browse: false, administerProjects: false, administerJira: false };
export const caller = (accountId = 'acc-admin', licenceActive = true): ReportCaller => ({ accountId, ...PROJECT, licenceActive });

export const FIELDS: FieldInfo[] = [
  { id: 'status', name: 'Status', schemaType: 'status' },
  { id: 'assignee', name: 'Assignee', schemaType: 'user' },
  { id: 'description', name: 'Description', schemaType: 'string' }
];

/** An in-memory Object Store with the app's "written once" rule. */
export class MemoryObjects implements ObjectStoreAccessor {
  readonly serviceType = 'accessor' as const;
  objects = new Map<string, string>();
  writes: string[] = [];
  failWrites: RegExp | null = null;
  async putOnce(key: string, body: string): Promise<boolean> {
    if (this.objects.has(key) || (this.failWrites && this.failWrites.test(key))) return false;
    this.objects.set(key, body);
    this.writes.push(key);
    return true;
  }
  async readText(key: string): Promise<string | undefined> {
    return this.objects.get(key);
  }
  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }
  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
  async downloadUrl(key: string): Promise<string | undefined> {
    return this.objects.has(key) ? `https://os.test/${key}` : undefined;
  }
}

export interface IssueSpec {
  id: string;
  created?: string;
  changes?: ChangelogEntry[];
  /** The user cannot see it (issue security). */
  hidden?: boolean;
  /** Deleted after the report was made: neither the user nor the app finds it. */
  deleted?: boolean;
  properties?: Record<string, unknown>;
}

export const change = (id: string, at: string, author: string | null, fieldId: string, from: string | null, to: string | null, fromString = from, toString = to): ChangelogEntry =>
  ({ changelogId: id, at, authorAccountId: author, items: [{ fieldId, field: fieldId, from, to, fromString, toString }] });

/** Jira as one principal over the issue list; `user` hides the hidden issues. */
export class FakeJira implements JiraReportAccessor {
  readonly serviceType = 'accessor' as const;
  calls: string[] = [];
  failFacts = 0;
  searchStatus = 200;
  fieldsStatus = 200;
  extraIds: string[] = [];
  onFacts: (() => void) | null = null;
  presentFails = false;
  /** Ids that the batch read does not return (a short page, or an issue deleted during the job: review H-1). */
  dropIds = new Set<string>();
  /** Ids that are in another project now. */
  movedIds = new Set<string>();
  changelogStatus = 200;
  constructor(private readonly issues: () => IssueSpec[], private readonly principal: 'user' | 'app') {}
  private visible(): IssueSpec[] {
    return this.issues().filter(i => !i.deleted && (this.principal === 'app' || !i.hidden));
  }
  async searchIds(jql: string, limit: number): Promise<{ status: number; ids: string[] }> {
    this.calls.push(`search:${jql}`);
    if (this.searchStatus !== 200) return { status: this.searchStatus, ids: [] };
    return { status: 200, ids: [...this.visible().map(i => i.id), ...this.extraIds].slice(0, limit + 1) };
  }
  async presentAmong(ids: string[]): Promise<Set<string> | null> {
    this.calls.push(`present:${ids.length}`);
    if (this.presentFails) return null;
    const have = new Set(this.visible().map(i => i.id));
    return new Set(ids.filter(id => have.has(id)));
  }
  async factsByIds(ids: string[]) {
    this.calls.push(`facts:${ids.join(',')}`);
    this.onFacts?.();
    if (this.failFacts > 0) {
      this.failFacts--;
      return { status: 500, issues: [] };
    }
    const byId = new Map(this.visible().map(i => [i.id, i]));
    return {
      status: 200,
      issues: ids.filter(id => byId.has(id) && !this.dropIds.has(id)).map(id => {
        const spec = byId.get(id)!;
        return {
          facts: makeFacts({ issueId: id, issueKey: `PAY-${id}`, summary: `Summary of ${id} with private words`, statusCategory: 'done', properties: spec.properties || {} }),
          basics: { issueId: id, issueKey: `PAY-${id}`, issueTypeName: 'Story', created: spec.created || '2026-10-05T00:00:00.000Z', statusId: '3', projectKey: this.movedIds.has(id) ? 'OTHER' : 'PAY' }
        };
      })
    };
  }
  async changelogs(ids: string[]) {
    this.calls.push(`changelog:${ids.length}`);
    if (this.changelogStatus !== 200) return { status: this.changelogStatus, byIssue: new Map() };
    const byId = new Map(this.visible().map(i => [i.id, i]));
    return { status: 200, byIssue: new Map(ids.filter(id => byId.has(id)).map(id => [id, byId.get(id)!.changes || []])) };
  }
  async fields() {
    this.calls.push('fields');
    return this.fieldsStatus === 200 ? { status: 200, fields: FIELDS } : { status: this.fieldsStatus, fields: [] };
  }
}

export function harness(o: { keys?: boolean; policy?: ReportPolicyEngine; now?: () => Date } = {}) {
  const storage = new MemoryStorage();
  const issues: IssueSpec[] = [];
  const objects = new MemoryObjects();
  const pushes: Array<{ reportId: string; delay?: number }> = [];
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const env = o.keys === false ? {} : { FOURREALITIES_SIGNING_KEY: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'), FOURREALITIES_KEY_ID: 'fr-test-key' };
  const userJira = new FakeJira(() => issues, 'user');
  const appJira = new FakeJira(() => issues, 'app');
  const groups = { status: 200, groupIds: [] as string[] };
  const names: Record<string, { displayName: string; active: boolean }> = {};
  const people = { serviceType: 'accessor' as const, people: jest.fn(async (ids: string[]) => Object.fromEntries(ids.filter(id => names[id]).map(id => [id, names[id]]))), myGroupIds: jest.fn(async () => groups) };
  const links = new Map<string, unknown>();
  const appIssues = { remoteLinks: jest.fn(async (ids: string[]) => new Map(ids.filter(id => !links.has(`miss:${id}`)).map(id => [id, []]))) };
  const runtime = { serviceType: 'accessor' as const, environment: () => 'development', appVersion: () => '9.0.0', licenceActive: () => true };
  const store = new DefaultKvsReportStoreAccessor(storage);
  const manager = new DefaultEvidenceReportManager({
    store,
    objects,
    queue: { serviceType: 'accessor', push: async (reportId: string, delay?: number) => { pushes.push({ reportId, ...(delay ? { delay } : {}) }); } },
    crypto: new DefaultReportCryptoAccessor(env),
    tokens: new DefaultKvsPartyTokenAccessor(storage),
    runtime,
    userJira,
    appJira,
    appIssues: appIssues as never,
    people,
    siteConfig: { serviceType: 'accessor', get: async () => ({ devFieldId: null, siteHost: 'example.atlassian.net', statusCategories: {}, pullRequestsSeen: false, readAt: 't' }) },
    settings: new DefaultKvsSettingsAccessor(storage),
    sources: new DefaultSourcePolicyEngine(),
    gates: new DefaultGateEngine(),
    metrics: new DefaultMetricsEngine(),
    events: new DefaultKvsExceptionEventAccessor(storage),
    notes: new DefaultKvsReworkNoteAccessor(storage),
    lifecycle: new DefaultExceptionPolicyEngine(),
    history: new DefaultKvsAttestationHistoryAccessor(storage),
    engine: new DefaultReportEngine(),
    policy: o.policy || new DefaultReportPolicyEngine(),
    deadline: Date.now() + 20_000,
    ...(o.now ? { now: o.now } : {})
  });
  /** Runs queued events until none is left (each with a full budget). */
  const drain = async (limit = 20) => {
    for (let i = 0; i < limit && pushes.length; i++) {
      const next = pushes.shift()!;
      await manager.work(next.reportId, Date.now() + 780_000);
    }
  };
  return { storage, store, issues, objects, pushes, publicKey, userJira, appJira, people, groups, names, links, appIssues, runtime, manager, drain };
}
