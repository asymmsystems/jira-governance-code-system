// LedgerSeal research harness: fixtures, a mocked Jira REST layer, and a byte-counting store.
// Copyright (c) 2026 Asymm Systems. @author Fahim Farook
// Part B (Loop 3) version: the probes go through the app's real createJiraClient over this mocked HTTP layer.

export const APP_SRC = '/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/apps/ledgerseal/src';

export interface JiraWrite { path: string; body: any; bytes: number; }

export class JiraMock {
  issue: any;
  failIssueGet = false;
  approvers = new Set<string>();
  users: Record<string, { displayName: string; emailAddress?: string }> = {};
  changelog: any[] = [];
  writes: JiraWrite[] = [];
  gets = 0;
  constructor(issue: any) { this.issue = issue; }

  /** Records a field edit the way Jira does: the value changes and a change log entry is added. */
  edit(accountId: string, fieldId: string, value: any, at = new Date(Date.now() + 1000).toISOString()) {
    this.issue.fields[fieldId] = value;
    this.changelog.push({ id: String(this.changelog.length + 1), author: { accountId }, created: at, items: [{ field: fieldId, fieldId }] });
  }

  async requestJira(path: string, opt: any, user: string | null) {
    const ok = (body: any) => ({ status: 200, json: async () => JSON.parse(JSON.stringify(body)), headers: { get: () => null } });
    if (path.includes('/properties/')) {
      const body = JSON.parse(opt.body);
      this.writes.push({ path, body, bytes: Buffer.byteLength(opt.body, 'utf8') });
      return { status: 204, json: async () => ({}), headers: { get: () => null } };
    }
    if (path.startsWith('/rest/api/3/mypermissions')) {
      const have = user !== null && this.approvers.has(user);
      return ok({ permissions: { ADMINISTER_PROJECTS: { havePermission: have }, ADMINISTER: { havePermission: false } } });
    }
    if (path.startsWith('/rest/api/3/user')) {
      const id = decodeURIComponent(path.split('accountId=')[1] || '');
      return ok(this.users[id] || { displayName: 'User ' + id });
    }
    if (path.startsWith('/rest/api/3/field')) return ok([]);
    this.gets++;
    if (this.failIssueGet) throw new Error('timeout');
    if (path.includes('/changelog')) return ok({ values: this.changelog, isLast: true });
    if (path.includes('/comment')) {
      const comments = this.issue.fields.comment?.comments || [];
      return ok({ startAt: 0, maxResults: comments.length, total: comments.length, comments });
    }
    return ok(this.issue);
  }

  /** Dependencies for the app: the real Jira client, as the app or as one user. */
  deps(createJiraClient: any, storage: any, user: string | null, signer: any = null) {
    const asApp = { requestJira: (p: any, o?: any) => this.requestJira(String(p), o, null) };
    const asUser = user ? { requestJira: (p: any, o?: any) => this.requestJira(String(p), o, user) } : null;
    return { jira: createJiraClient(asApp, asUser, { maxRetries: 0 }), storage, signer };
  }
}

export class CountingStore {
  map = new Map<string, any>();
  sets: { key: string; bytes: number }[] = [];
  commits = 0;
  maxCommitOps = 0;
  async get(k: string) { return this.map.has(k) ? JSON.parse(JSON.stringify(this.map.get(k))) : null; }
  async set(k: string, v: any) {
    const s = JSON.stringify(v);
    this.sets.push({ key: k, bytes: Buffer.byteLength(s, 'utf8') });
    this.map.set(k, JSON.parse(s));
  }
  async delete(k: string) { this.map.delete(k); }
  async createIfAbsent(k: string, v: any) {
    if (this.map.has(k)) return false;
    await this.set(k, v);
    return true;
  }
  async commit(items: { key: string; value: any }[]) {
    this.commits++;
    this.maxCommitOps = Math.max(this.maxCommitOps, items.length);
    for (const i of items) await this.set(i.key, i.value);
  }
  bytes(k: string) { return this.map.has(k) ? Buffer.byteLength(JSON.stringify(this.map.get(k)), 'utf8') : 0; }
  largest() { return Math.max(0, ...[...this.map.keys()].map(k => this.bytes(k))); }
  keys() { return [...this.map.keys()]; }
}

const para = (n: number) => ({ type: 'paragraph', content: [{ type: 'text', text: 'Line ' + n + ' '.padEnd(200, 'x') }] });
const doc = (paras: number) => ({ type: 'doc', version: 1, content: Array.from({ length: paras }, (_, n) => para(n)) });

export function smallIssue(): any {
  return {
    id: '10001', key: 'P-1',
    fields: {
      project: { id: '100', key: 'P' }, issuetype: { id: '3', name: 'Change' }, status: { name: 'Approved' },
      summary: 'Release v1', description: doc(1), reporter: { accountId: 'r1' },
      labels: ['release'], priority: { id: '2', name: 'High' },
      assignee: { accountId: 'a1', displayName: 'Alice' },
      attachment: [{ id: '5', filename: 'evidence.pdf', size: 100, created: '2026-10-30T00:00:00.000+0000', author: { accountId: 'u' } }],
      comment: { comments: [], total: 0 }
    }
  };
}

export function bigDescriptionIssue(): any {
  const i = smallIssue(); i.fields.description = doc(400); return i;
}

export function hundredCommentsIssue(): any {
  const i = smallIssue();
  i.fields.comment = {
    total: 100,
    comments: Array.from({ length: 100 }, (_, n) => ({
      id: String(20000 + n), author: { accountId: 'c' + (n % 5) }, body: doc(1), created: '2026-10-30T00:00:00.000+0000'
    }))
  };
  return i;
}

export function combinedIssue(): any {
  const i = hundredCommentsIssue(); i.fields.description = doc(400); return i;
}

export function median(xs: number[]) { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
export function p95(xs: number[]) { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]; }
