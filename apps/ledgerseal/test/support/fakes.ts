/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal test support: an in-memory Jira client and a recording store.
 *
 * @author Fahim Farook
 */

import { ChangelogEntry, JiraClient, JiraResult } from '../../src/jira/jira-client';
import { StorageProvider } from '../../src/storage/seal-repository';

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

  async getComments(): Promise<JiraResult<any[]>> {
    if (this.failComments) return { ok: false, error: 'UNREACHABLE' };
    const list = this.comments ?? this.issue.fields?.comment?.comments ?? [];
    return { ok: true, value: JSON.parse(JSON.stringify(list)) };
  }

  worklogs: any[] = [];
  failWorklogs = false;

  async getWorklogs(): Promise<JiraResult<any[]>> {
    if (this.failWorklogs) return { ok: false, error: 'UNREACHABLE' };
    return { ok: true, value: JSON.parse(JSON.stringify(this.worklogs)) };
  }

  async getChangelog(): Promise<JiraResult<ChangelogEntry[]>> {
    if (this.failChangelog) return { ok: false, error: 'UNREACHABLE' };
    return { ok: true, value: JSON.parse(JSON.stringify(this.changelog)) };
  }

  async getUserName(accountId: string): Promise<string | null> {
    return this.users[accountId] ?? null;
  }

  async hasApproverPermission(issueId: string): Promise<JiraResult<boolean>> {
    this.permissionChecks.push(issueId);
    if (this.permissionError) return { ok: false, error: this.permissionError };
    return { ok: true, value: this.currentUser !== null && this.approvers.has(this.currentUser) };
  }

  async putSealProperty(issueId: string, body: any): Promise<boolean> {
    this.propertyWrites.push({ issueId, body: JSON.parse(JSON.stringify(body)) });
    return true;
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

export class MemoryStore implements StorageProvider {
  map = new Map<string, any>();
  sets: string[] = [];

  async get(key: string) {
    return this.map.has(key) ? JSON.parse(JSON.stringify(this.map.get(key))) : null;
  }

  async set(key: string, value: any) {
    this.sets.push(key);
    this.map.set(key, JSON.parse(JSON.stringify(value)));
  }

  async delete(key: string) {
    this.map.delete(key);
  }

  async createIfAbsent(key: string, value: any) {
    if (this.map.has(key)) return false;
    await this.set(key, value);
    return true;
  }

  commits: string[][] = [];

  async commit(items: { key: string; value: any }[]) {
    this.commits.push(items.map(i => i.key));
    for (const item of items) await this.set(item.key, item.value);
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
