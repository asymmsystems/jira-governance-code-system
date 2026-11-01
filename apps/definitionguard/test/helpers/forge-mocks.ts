/**
 * Shared test doubles for DefinitionGuard.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * - asApp() and asUser() are separate mocks, so a test can tell which identity made a call.
 * - route`` interpolates values, so a test can assert the real path.
 * - CountingStorage serialises on every call, like a remote store, and counts operations.
 */
import { StorageProvider } from '../../src/storage/checklist-repository';

export type JiraReply = { status: number; body?: any };
export type JiraCall = { who: 'app' | 'user'; method: string; path: string; body?: any };

export const jira = {
  calls: [] as JiraCall[],
  handler: (_call: JiraCall): JiraReply => ({ status: 200, body: {} }),
  reset() {
    this.calls = [];
    this.handler = () => ({ status: 200, body: {} });
  },
  callsTo(fragment: string, who?: 'app' | 'user') {
    return this.calls.filter(c => c.path.includes(fragment) && (!who || c.who === who));
  }
};

export function makeRequester(who: 'app' | 'user') {
  return jest.fn(async (path: string, opts?: any) => {
    const call: JiraCall = { who, method: opts?.method || 'GET', path, body: opts?.body ? JSON.parse(opts.body) : undefined };
    jira.calls.push(call);
    const reply = jira.handler(call);
    if ((reply as any).throws) throw new Error(String((reply as any).throws));
    const retryAfter = (reply as any).retryAfter;
    return {
      status: reply.status,
      ok: reply.status >= 200 && reply.status < 300,
      json: async () => reply.body ?? {},
      headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' && retryAfter !== undefined ? String(retryAfter) : null) }
    };
  });
}

export function routeImpl(strings: TemplateStringsArray, ...values: any[]): string {
  return strings.reduce((acc, s, i) => acc + s + (i < values.length ? encodeURIComponent(String(values[i])) : ''), '');
}

export class CountingStorage implements StorageProvider {
  store = new Map<string, string>();
  gets: string[] = [];
  sets: string[] = [];
  deletes: string[] = [];
  failGet: ((key: string) => boolean) | null = null;
  failSet: ((key: string) => boolean) | null = null;
  getDelayMs = 0;

  async get<T>(key: string): Promise<T | undefined> {
    this.gets.push(key);
    if (this.failGet && this.failGet(key)) throw new Error('KVS read failed (test)');
    const snap = this.store.get(key);
    if (this.getDelayMs) await new Promise(r => setTimeout(r, this.getDelayMs));
    return snap === undefined ? undefined : JSON.parse(snap);
  }

  async set(key: string, value: any): Promise<void> {
    if (this.failSet && this.failSet(key)) throw new Error('KVS write failed (test)');
    this.sets.push(key);
    this.store.set(key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    this.deletes.push(key);
    this.store.delete(key);
  }

  // Atomic in this single-threaded mock, like KVS set with keyPolicy FAIL_IF_EXISTS.
  async setIfAbsent(key: string, value: any): Promise<boolean> {
    if (this.failSet && this.failSet(key)) throw new Error('KVS write failed (test)');
    if (this.store.has(key)) return false;
    this.sets.push(key);
    this.store.set(key, JSON.stringify(value));
    return true;
  }

  async listByPrefix(prefix: string, cursor?: string, limit = 100): Promise<{ values: any[]; nextCursor?: string }> {
    const keys = [...this.store.keys()].filter(k => k.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const page = keys.slice(start, start + limit);
    const next = start + limit < keys.length ? String(start + limit) : undefined;
    return { values: page.map(k => JSON.parse(this.store.get(k)!)), nextCursor: next };
  }

  put(key: string, value: any): void {
    this.store.set(key, JSON.stringify(value));
  }

  read(key: string): any {
    const s = this.store.get(key);
    return s === undefined ? undefined : JSON.parse(s);
  }
}
