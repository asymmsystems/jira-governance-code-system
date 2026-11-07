/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal test support: an in-memory Jira client and a recording store.
 *
 * @author Fahim Farook
 */

import { ChangelogEntry, JiraClient, JiraResult } from '../../src/jira/jira-client';
import { SecretStore, StorageProvider, WriteOptions } from '../../src/storage/seal-repository';
import { DECLARATION } from '../../src/domain/declaration';
import { partyFunction } from '../../src/domain/party';

/** A seal payload signature that the resolver accepts. */
export function validSignature(extra: Record<string, unknown> = {}) {
  return { meaning: 'APPROVAL', declarationVersion: DECLARATION.version, declarationText: DECLARATION.text, reason: 'Approved change', ...extra };
}

export class FakeJira implements JiraClient {
  issue: any;
  changelog: ChangelogEntry[] = [];
  approvers = new Set<string>();
  users: Record<string, string> = {};
  failIssueGet = false;
  failChangelog = false;
  failFields = false;
  failComments = false;
  /** Comments as the comment endpoint returns them. Null means: use the issue body. */
  comments: any[] | null = null;
  fields: any[] = [];
  fieldCalls = 0;
  permissionError: 'UNREACHABLE' | 'FORBIDDEN' | null = null;
  propertyWrites: { issueId: string; body: any }[] = [];
  permissionChecks: string[] = [];
  /** Account id of the user the asUser() calls run as. */
  currentUser: string | null = null;

  constructor(issue: any) {
    this.issue = issue;
  }

  async getIssue(): Promise<JiraResult<any>> {
    if (this.failIssueGet) return { ok: false, error: 'UNREACHABLE' };
    return { ok: true, value: JSON.parse(JSON.stringify(this.issue)) };
  }

  async getFields(): Promise<JiraResult<any[]>> {
    this.fieldCalls++;
    if (this.failFields) return { ok: false, error: 'UNREACHABLE' };
    return { ok: true, value: JSON.parse(JSON.stringify(this.fields)) };
  }

  /** F-06, M-11: comment and work log ids each user cannot see (a restricted comment outside their role or group). */
  hiddenFrom: Record<string, string[]> = {};
  failVisibleComments = false;

  async getVisibleCommentIds(): Promise<JiraResult<string[]>> {
    if (this.failVisibleComments) return { ok: false, error: 'UNREACHABLE' };
    const list = this.comments ?? this.issue.fields?.comment?.comments ?? [];
    const hidden = new Set(this.hiddenFrom[this.currentUser ?? ''] ?? []);
    return { ok: true, value: list.map((c: any) => String(c.id)).filter((id: string) => !hidden.has(id)) };
  }

  async getComments(): Promise<JiraResult<any[]>> {
    if (this.failComments) return { ok: false, error: 'UNREACHABLE' };
    const list = this.comments ?? this.issue.fields?.comment?.comments ?? [];
    return { ok: true, value: JSON.parse(JSON.stringify(list)) };
  }

  /** All work logs the app reads; null means the work logs in the issue body. */
  worklogs: any[] | null = null;
  failWorklogs = false;
  failVisibleWorklogs = false;

  async getWorklogs(): Promise<JiraResult<any[]>> {
    if (this.failWorklogs) return { ok: false, error: 'UNREACHABLE' };
    return { ok: true, value: JSON.parse(JSON.stringify(this.worklogs ?? this.issue.fields?.worklog?.worklogs ?? [])) };
  }

  async getVisibleWorklogIds(): Promise<JiraResult<string[]>> {
    if (this.failVisibleWorklogs) return { ok: false, error: 'UNREACHABLE' };
    const list = this.worklogs ?? this.issue.fields?.worklog?.worklogs ?? [];
    const hidden = new Set(this.hiddenFrom[this.currentUser ?? ''] ?? []);
    return { ok: true, value: list.map((w: any) => String(w.id)).filter((id: string) => !hidden.has(id)) };
  }

  async getChangelog(): Promise<JiraResult<ChangelogEntry[]>> {
    if (this.failChangelog) return { ok: false, error: 'UNREACHABLE' };
    return { ok: true, value: JSON.parse(JSON.stringify(this.changelog)) };
  }

  async getUserName(accountId: string): Promise<string | null> {
    return this.users[accountId] ?? null;
  }

  /** Accounts Jira reports deactivated (`inactive`), gone (404) or cannot read (`unknownUsers`). */
  inactive = new Set<string>();
  gone = new Set<string>();
  unknownUsers = new Set<string>();

  async accountState(accountId: string): Promise<'active' | 'inactive' | 'gone' | null> {
    if (this.unknownUsers.has(accountId)) return null;
    if (this.gone.has(accountId)) return 'gone';
    return this.inactive.has(accountId) ? 'inactive' : 'active';
  }

  /** Q3: users without Browse projects on the issue, and a failure of the permission check. */
  cannotBrowse = new Set<string>();
  browseError: 'UNREACHABLE' | 'FORBIDDEN' | 'NOT_FOUND' | null = null;
  browseChecks: string[] = [];

  async canBrowseIssue(issueId: string): Promise<JiraResult<boolean>> {
    this.browseChecks.push(issueId);
    if (this.browseError) return { ok: false, error: this.browseError };
    return { ok: true, value: !this.cannotBrowse.has(this.currentUser ?? '') };
  }

  async hasApproverPermission(issueId: string): Promise<JiraResult<boolean>> {
    this.permissionChecks.push(issueId);
    if (this.permissionError) return { ok: false, error: this.permissionError };
    return { ok: true, value: this.currentUser !== null && this.approvers.has(this.currentUser) };
  }

  /** Jira admins (global ADMINISTER), site groups, and each user's group ids. */
  jiraAdmins = new Set<string>();
  siteGroups: { groupId: string; name: string }[] = [];
  memberships: Record<string, string[]> = {};
  failGroups = false;
  failAdminCheck = false;
  groupReads = 0;

  async getMyGroupIds(): Promise<JiraResult<string[]>> {
    this.groupReads++;
    if (this.failGroups) return { ok: false, error: 'UNREACHABLE' };
    return { ok: true, value: [...(this.memberships[this.currentUser ?? ''] ?? [])] };
  }

  async isJiraAdmin(): Promise<JiraResult<boolean>> {
    if (this.failAdminCheck) return { ok: false, error: 'UNREACHABLE' };
    return { ok: true, value: this.currentUser !== null && this.jiraAdmins.has(this.currentUser) };
  }

  async findGroups(query: string): Promise<JiraResult<{ groupId: string; name: string }[]>> {
    if (this.failGroups) return { ok: false, error: 'UNREACHABLE' };
    return { ok: true, value: this.siteGroups.filter(g => g.name.includes(query)) };
  }

  async getGroups(groupIds: string[]): Promise<JiraResult<{ groupId: string; name: string }[]>> {
    if (this.failGroups) return { ok: false, error: 'UNREACHABLE' };
    return { ok: true, value: this.siteGroups.filter(g => groupIds.includes(g.groupId)) };
  }

  async putSealProperty(issueId: string, body: any): Promise<boolean> {
    this.propertyWrites.push({ issueId, body: JSON.parse(JSON.stringify(body)) });
    return true;
  }

  /** ADR-016: emails sent through notify (as the app), the status Jira answers, and the projects Jira knows. */
  notifications: { issueId: string; accountId: string; email: { subject: string; textBody: string; htmlBody: string } }[] = [];
  notifyStatus = 204;
  failScope = false;
  projects: { id: string; key: string; name: string }[] = [{ id: '100', key: 'CHG', name: 'Change' }];
  failProjects = false;

  async notifyUser(issueId: string, accountId: string, email: { subject: string; textBody: string; htmlBody: string }): Promise<number> {
    if (this.notifyStatus === 204) this.notifications.push({ issueId, accountId, email });
    return this.notifyStatus;
  }

  async getIssueScope(issueId: string): Promise<JiraResult<{ projectId: string; issueTypeId: string; issueKey: string }>> {
    if (this.failScope || this.failIssueGet) return { ok: false, error: 'UNREACHABLE' };
    return { ok: true, value: { projectId: String(this.issue.fields?.project?.id ?? ''), issueTypeId: String(this.issue.fields?.issuetype?.id ?? ''), issueKey: String(this.issue.key ?? issueId) } };
  }

  async getProjects(keysOrIds: string[]): Promise<JiraResult<{ id: string; key: string; name: string }[]>> {
    if (this.failProjects) return { ok: false, error: 'UNREACHABLE' };
    return { ok: true, value: this.projects.filter(p => keysOrIds.includes(p.key) || keysOrIds.includes(p.id)) };
  }

  /** The newest code emailed to an account (tests read it as the signer would, from the email). */
  lastCode(accountId?: string): string {
    const mail = [...this.notifications].reverse().find(n => !accountId || n.accountId === accountId);
    const match = mail?.email.textBody.match(/ is (\d{6})\./);
    if (!match) throw new Error('No code was emailed');
    return match[1];
  }

  /** Records a field change in the change log, the way Jira does after an edit. */
  edit(accountId: string, at: string, fieldId: string, value: any) {
    const from = this.issue.fields[fieldId];
    this.issue.fields[fieldId] = value;
    this.changelog.push({
      id: String(this.changelog.length + 1),
      author: { accountId },
      created: at,
      items: [{ field: fieldId, fieldId, fromString: String(from ?? ''), toString: String(value ?? '') }]
    });
  }
}

export class MemoryStore implements StorageProvider, SecretStore {
  map = new Map<string, any>();
  sets: string[] = [];
  /** Time to live given for each key, in seconds. */
  ttls = new Map<string, number>();
  /** The secret store, kept apart from the plain keys as in Forge. */
  secrets = new Map<string, any>();

  async getSecret(key: string) {
    return this.secrets.has(key) ? JSON.parse(JSON.stringify(this.secrets.get(key))) : undefined;
  }

  async createSecretIfAbsent(key: string, value: any) {
    if (this.secrets.has(key)) return false;
    this.secrets.set(key, JSON.parse(JSON.stringify(value)));
    return true;
  }

  async get(key: string) {
    return this.map.has(key) ? JSON.parse(JSON.stringify(this.map.get(key))) : null;
  }

  async set(key: string, value: any, options?: WriteOptions) {
    this.sets.push(key);
    this.map.set(key, JSON.parse(JSON.stringify(value)));
    if (options?.ttlSeconds) this.ttls.set(key, options.ttlSeconds);
  }

  async delete(key: string) {
    this.map.delete(key);
  }

  async createIfAbsent(key: string, value: any, options?: WriteOptions) {
    if (this.map.has(key)) return false;
    await this.set(key, value, options);
    return true;
  }

  commits: string[][] = [];

  async commit(items: { key: string; value: any }[]) {
    this.commits.push(items.map(i => i.key));
    for (const item of items) await this.set(item.key, item.value);
  }

  async query(prefix: string) {
    return [...this.map.keys()]
      .filter(k => k.startsWith(prefix))
      .sort()
      .map(key => ({ key, value: JSON.parse(JSON.stringify(this.map.get(key))) }));
  }

  bytes(key: string) {
    return this.map.has(key) ? Buffer.byteLength(JSON.stringify(this.map.get(key)), 'utf8') : 0;
  }
}

export function sampleIssue(): any {
  return {
    id: '10001',
    key: 'CHG-1',
    fields: {
      project: { id: '100', key: 'CHG' },
      issuetype: { id: '3', name: 'Change' },
      status: { name: 'Approved' },
      summary: 'Rotate production database credentials'
    }
  };
}

export function panelContext(accountId?: string) {
  return { ...(accountId ? { accountId } : {}), extension: { issue: { id: '10001', key: 'CHG-1' } } };
}

/** Model helpers: tests read storage through the Silverston model (spec v2 section 3.2), not raw keys. */
export const model = {
  async workEffort(storage: MemoryStore, issueId = '10001') {
    return storage.get(`ls3:we:${issueId}`);
  },
  statusRows(storage: MemoryStore, issueId = '10001'): any[] {
    return [...storage.map.entries()]
      .filter(([k]) => k.startsWith(`ls3:wes:${issueId}:`))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, v]) => JSON.parse(JSON.stringify(v)));
  },
  assignments(storage: MemoryStore, issueId = '10001'): any[] {
    return [...storage.map.entries()]
      .filter(([k]) => k.startsWith(`ls3:wepa:${issueId}:`))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, v]) => JSON.parse(JSON.stringify(v)));
  },
  async sealedSnapshot(storage: MemoryStore, issueId = '10001') {
    const we = await storage.get(`ls3:we:${issueId}`);
    let text = '';
    for (let part = 0; part < we.attributes.snapshotParts; part++) text += storage.map.get(`ls3:content:${we.currentContentId}:${part}`);
    return JSON.parse(text);
  },
  contentKey(we: any, part = 0) {
    return `ls3:content:${we.currentContentId}:${part}`;
  },
  workEffortKey(issueId = '10001') {
    return `ls3:we:${issueId}`;
  },
  /** The party token of an account on this site (ADR-011): records hold it in place of the account id. */
  async token(storage: MemoryStore, accountId: string): Promise<string> {
    const site = await storage.get('ls3:partykey');
    if (!site) throw new Error('No site key: nothing was sealed yet');
    return partyFunction(Buffer.from(site.key, 'base64'))(accountId);
  },
  statusKey(seq: number, issueId = '10001') {
    return `ls3:wes:${issueId}:${String(seq).padStart(6, '0')}`;
  }
};
