/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: security questionnaire question 8 (L-51). The personal data job's failure line holds only a
 * fixed text and the error's name, code and status. The job is made to fail with an error whose message
 * holds a secret; no log call may receive that message, the error object or its stack. A source rule then
 * checks every console call in src/.
 */

import * as fs from 'fs';
import * as path from 'path';
import { StorageProvider } from '../src/contract/accessors';
import { consoleViolations } from './support/console-rule';

const mockReport = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  getAppContext: () => ({}),
  default: { asApp: () => ({ requestJira: jest.fn() }), asUser: () => ({ requestJira: jest.fn() }) },
  route: (strings: TemplateStringsArray, ...values: unknown[]) => strings.reduce((acc, part, i) => acc + part + (i < values.length ? String(values[i]) : ''), ''),
  assumeTrustedRoute: (p: string) => p,
  privacy: { reportPersonalData: (a: unknown) => mockReport(a) }
}));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (value: string) => value } }));

import { personalData, setGlobalStorageProvider } from '../src/index';
import { errorSummary } from '../src/contract/data/errors';

const APP = path.join(__dirname, '..');
const SECRET = 'SECRET-LOG 712020:alice ann@example.com summary text';
const secretError = () => Object.assign(new Error(SECRET), { code: 'KVS_DOWN' });

/** A storage that holds one exception note recorded by an account, or fails every call with the secret. */
class NoteStorage implements StorageProvider {
  constructor(private readonly broken: boolean) {}
  private store = new Map<string, unknown>([['fr:note:7:t:a', { schemaVersion: 1, issueId: '7', issueKey: 'DEMO-7', reason: 'Requirement changed', recordedBy: '712020:alice', recordedAt: '2026-11-01T00:00:00.000Z' }]]);
  async get<T>(key: string): Promise<T | undefined> {
    if (this.broken) throw secretError();
    return this.store.get(key) as T | undefined;
  }
  async set(key: string, value: unknown): Promise<void> {
    if (this.broken) throw secretError();
    this.store.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
  async queryPrefix<T>(prefix: string): Promise<{ results: Array<{ key: string; value: T }>; nextCursor?: string }> {
    if (this.broken) throw secretError();
    return { results: Array.from(this.store.entries()).filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value: value as T })) };
  }
}

let calls: unknown[][] = [];
beforeEach(() => {
  calls = [];
  for (const level of ['error', 'warn', 'log', 'info'] as const) {
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      calls.push(args);
    });
  }
});
afterEach(() => {
  jest.restoreAllMocks();
  setGlobalStorageProvider(null);
  mockReport.mockReset();
});

/** Every log call so far has only text arguments and none holds the secret; returns the failure lines. */
function failureLines(): string[] {
  for (const args of calls) {
    for (const arg of args) expect(typeof arg).toBe('string');
    expect(args.join(' ')).not.toContain('SECRET-LOG');
    expect(args.join(' ')).not.toContain('712020:');
  }
  return calls.map(args => args.join(' ')).filter(line => line.endsWith('Error code=KVS_DOWN'));
}

describe('Q8 (L-51) the personal data failure log line', () => {
  it('when storage fails', async () => {
    setGlobalStorageProvider(new NoteStorage(true));
    await expect(personalData()).resolves.toBeUndefined();
    expect(failureLines()).toEqual(['FourRealities: personal data report failed: Error code=KVS_DOWN']);
  });

  it('when the personal data reporting API fails', async () => {
    setGlobalStorageProvider(new NoteStorage(false));
    mockReport.mockRejectedValue(secretError());
    await expect(personalData()).resolves.toBeUndefined();
    expect(mockReport).toHaveBeenCalled();
    expect(failureLines()).toEqual(['FourRealities: personal data report failed: Error code=KVS_DOWN']);
  });
});

describe('Q8 errorSummary', () => {
  it('keeps only a plain name, a plain code and a whole-number status', () => {
    expect(errorSummary(new TypeError(SECRET))).toBe('TypeError');
    expect(errorSummary(Object.assign(new Error(SECRET), { status: 503 }))).toBe('Error status=503');
    expect(errorSummary({ statusCode: 429, message: SECRET })).toBe('Error status=429');
    expect(errorSummary({ name: SECRET, code: SECRET })).toBe('Error');
    expect(errorSummary({ name: 'Error', code: 42, status: 1.5 })).toBe('Error code=42');
    expect(errorSummary(SECRET)).toBe('string');
    expect(errorSummary(undefined)).toBe('undefined');
    expect(errorSummary(null)).toBe('object');
  });
});

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir).flatMap(name => {
    const p = path.join(dir, name);
    return fs.statSync(p).isDirectory() ? sourceFiles(p) : /\.(tsx?|jsx?)$/.test(name) ? [p] : [];
  });
}

describe('Q8 source rule: no console call is given an error message, String(...) or an error object', () => {
  it('holds for every source file in src/', () => {
    const faults = sourceFiles(path.join(APP, 'src')).flatMap(f => consoleViolations(fs.readFileSync(f, 'utf8')).map(v => `${path.relative(APP, f)} ${v}`));
    expect(faults).toEqual([]);
  });

  it('finds an unsafe call', () => {
    expect(consoleViolations("try { x(); } catch (oops) { console.error('failed', oops); }")).toEqual(['line 1: console.error is given the error oops']);
    expect(consoleViolations("console.error('failed', err instanceof Error ? err.message : String(err));")).toEqual([
      "line 1: console.error is given an error's message",
      'line 1: console.error is given String(...)',
      'line 1: console.error is given the error err',
      'line 1: console.error is given the error err',
      'line 1: console.error is given the error err'
    ]);
    expect(consoleViolations('console.error(`x ${errorSummary(err)}`);')).toEqual([]);
  });

  it('is the same file in every app', () => {
    const mine = fs.readFileSync(path.join(__dirname, 'support/console-rule.ts'), 'utf8');
    for (const app of ['cascadeplan', 'definitionguard', 'ledgerseal', 'fourrealities']) {
      expect(fs.readFileSync(path.join(APP, '..', app, 'test/support/console-rule.ts'), 'utf8')).toBe(mine);
    }
  });
});
