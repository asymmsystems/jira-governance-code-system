/**
 * Security questionnaire question 8 (L-49): a log line about a failure holds only a fixed place name and the
 * error's name, code and status. Each place that logs a caught error is made to fail with an error whose
 * message holds a secret; no log call may receive that message, the error object or its stack. A source
 * rule then checks every console call in src/.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import * as fs from 'fs';
import * as path from 'path';
import { CountingStorage } from './helpers/forge-mocks';
import { consoleViolations } from './support/console-rule';

const mockReport = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {},
  route: () => '',
  getAppContext: () => ({ invocationRemainingTimeInMillis: () => 60000 }),
  privacy: { reportPersonalData: (a: unknown) => mockReport(a) }
}));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));

import { errorSummary, logFailure } from '../src/log';
import { issueDeletedTrigger } from '../src/privacy/issue-deleted';
import { personalDataTrigger, reportPersonalData } from '../src/privacy/personal-data';
import { setGlobalStorageProvider } from '../src/storage/forge-storage';

const APP = path.join(__dirname, '..');
const SECRET = 'SECRET-LOG 712020:alice ann@example.com summary text';
const secretError = () => Object.assign(new Error(SECRET), { code: 'KVS_DOWN' });

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

/** A storage whose every call fails with the secret error. */
function brokenStorage(): CountingStorage {
  const s = new CountingStorage();
  s.get = async () => Promise.reject(secretError());
  s.listByPrefix = async () => Promise.reject(secretError());
  return s;
}

describe('Q8 (L-49) the failure log lines', () => {
  it('issueDeletedTrigger', async () => {
    await issueDeletedTrigger({ issue: { id: '70004' } }, {}, brokenStorage());
    expect(failureLines()).toEqual(['DefinitionGuard: could not remove the records of a deleted issue: Error code=KVS_DOWN']);
  });

  it('reportPersonalData, when the one-time pass stops', async () => {
    const storage = brokenStorage();
    storage.listByPrefix = async () => ({ values: [], keys: [] });
    await expect(reportPersonalData(storage, async () => [], () => 60000)).resolves.toMatchObject({ migration: 'failed' });
    expect(failureLines()).toEqual(['DefinitionGuard: the personal data pass stopped: Error code=KVS_DOWN']);
  });

  it('personalDataTrigger, when the report fails', async () => {
    const storage = new CountingStorage();
    storage.put('dg:pty:712020:alice', { accountId: '712020:alice', pseudonym: 'dgp-1', firstSeen: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' });
    setGlobalStorageProvider(storage);
    mockReport.mockRejectedValue(secretError());
    await expect(personalDataTrigger()).resolves.toBeUndefined();
    expect(failureLines()).toEqual(['DefinitionGuard: the personal data report failed: Error code=KVS_DOWN']);
  });

  it('personalDataTrigger, when storage fails: the pass line and the report line, both without the secret', async () => {
    setGlobalStorageProvider(brokenStorage());
    await expect(personalDataTrigger()).resolves.toBeUndefined();
    expect(failureLines()).toEqual([
      'DefinitionGuard: the personal data pass stopped: Error code=KVS_DOWN',
      'DefinitionGuard: the personal data report failed: Error code=KVS_DOWN'
    ]);
  });

  it('the panel (src/frontend/index.tsx) logs a failed action through logFailure, which drops the secret', () => {
    const panel = fs.readFileSync(path.join(APP, 'src/frontend/index.tsx'), 'utf8');
    expect(panel).toContain("import { logFailure } from '../log';");
    expect(panel).toContain('logFailure(`${action} failed`, err);');
    logFailure('load the checklist failed', secretError());
    expect(failureLines()).toEqual(['DefinitionGuard: load the checklist failed: Error code=KVS_DOWN']);
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

const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => (f.isDirectory() ? walk(path.join(d, f.name)) : [path.join(d, f.name)]));

describe('Q8 source rule: no console call is given an error message, String(...) or an error object', () => {
  it('holds for every source file in src/', () => {
    const faults = walk(path.join(APP, 'src'))
      .filter(f => /\.(tsx?|jsx?)$/.test(f))
      .flatMap(f => consoleViolations(fs.readFileSync(f, 'utf8')).map(v => `${path.relative(APP, f)} ${v}`));
    expect(faults).toEqual([]);
  });

  it('finds each kind of unsafe call, and passes errorSummary', () => {
    expect(consoleViolations("try { x(); } catch (oops) { console.error('failed', oops); }")).toEqual(['line 1: console.error is given the error oops']);
    expect(consoleViolations('console.error(`failed: ${(err as Error)?.message}`);')).toEqual(["line 1: console.error is given an error's message", 'line 1: console.error is given the error err']);
    expect(consoleViolations("console.warn('failed', String(x));")).toEqual(['line 1: console.warn is given String(...)']);
    expect(consoleViolations("p.catch(problem => console.log(problem.stack));")).toEqual(["line 1: console.log is given an error's stack", 'line 1: console.log is given the error problem']);
    expect(consoleViolations('const log = console.error;')).toEqual(['line 1: console is used other than as console.<method>(...)']);
    expect(consoleViolations("console['error'](err);")).toEqual(['line 1: console is used other than as console.<method>(...)']);
    expect(consoleViolations("console.error(\n  'a',\n  JSON.stringify(e)\n);")).toEqual(['line 1: console.error is given the error e']);
    expect(consoleViolations('console.error(`x ${errorSummary(err)}`);')).toEqual([]);
    expect(consoleViolations("// console.error(err);\n/* console.error(err) */\nconsole.log('a // b', 'error', `the err ${n}`);")).toEqual([]);
    expect(consoleViolations("console.log('it is (not) closed: ' + r.error + ')');")).toEqual([]);
  });

  it('is the same file in every app', () => {
    const mine = fs.readFileSync(path.join(__dirname, 'support/console-rule.ts'), 'utf8');
    for (const app of ['cascadeplan', 'definitionguard', 'ledgerseal', 'fourrealities']) {
      expect(fs.readFileSync(path.join(APP, '..', app, 'test/support/console-rule.ts'), 'utf8')).toBe(mine);
    }
  });
});
