// LedgerSeal research harness (Part A baseline copy): fixtures, a mocked Jira, and a byte-counting store.
// Copyright (c) 2026 Asymm Systems. @author Fahim Farook
// Restored copy of the Part A harness. It ran against the v1 app at /home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/apps/ledgerseal/src (repo HEAD 423b9b2).

export const APP_SRC = '/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/apps/ledgerseal/src';

export interface JiraWrite { path: string; body: any; bytes: number; }

export class JiraMock {
  issue: any;
  failIssueGet = false;
  users: Record<string, { displayName: string; emailAddress?: string }> = {};
  writes: JiraWrite[] = [];
  gets = 0;
  constructor(issue: any) { this.issue = issue; }
  async requestJira(path: string, opt?: any) {
    if (path.includes('/properties/')) {
      const body = JSON.parse(opt.body);
      this.writes.push({ path, body, bytes: Buffer.byteLength(opt.body, 'utf8') });
      return { status: 200, json: async () => ({}) };
    }
    if (path.includes('/user')) {
      const id = decodeURIComponent(path.split('accountId=')[1] || '');
      const u = this.users[id] || { displayName: 'User ' + id };
      return { status: 200, json: async () => u };
    }
    this.gets++;
    if (this.failIssueGet) throw new Error('timeout');
    return { status: 200, json: async () => JSON.parse(JSON.stringify(this.issue)) };
  }
}

export class CountingStore {
  map = new Map<string, any>();
  sets: { key: string; bytes: number }[] = [];
  async get(k: string) { return this.map.has(k) ? JSON.parse(JSON.stringify(this.map.get(k))) : null; }
  async set(k: string, v: any) {
    const s = JSON.stringify(v);
    this.sets.push({ key: k, bytes: Buffer.byteLength(s, 'utf8') });
    this.map.set(k, JSON.parse(s));
  }
  async delete(k: string) { this.map.delete(k); }
  bytes(k: string) { return this.map.has(k) ? Buffer.byteLength(JSON.stringify(this.map.get(k)), 'utf8') : 0; }
  keys() { return [...this.map.keys()]; }
}

const para = (n: number) => ({ type: 'paragraph', content: [{ type: 'text', text: 'Line ' + n + ' '.padEnd(200, 'x') }] });
const doc = (paras: number) => ({ type: 'doc', version: 1, content: Array.from({ length: paras }, (_, n) => para(n)) });

export function smallIssue(): any {
  return {
    id: '10001', key: 'P-1',
    fields: {
      project: { key: 'P' }, issuetype: { name: 'Change' }, status: { name: 'Approved' },
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
