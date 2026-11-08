/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Marketplace security questionnaire question 8: a backend log line about a failure holds only the error's name,
 * code and status. Each of the seven places that log a caught error is made to fail with an error whose message
 * holds a secret; no log call may receive that message, the error object or its stack. The seven frontend
 * places log through the same logFailure, and a source rule checks every console call in src/.
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';
import { onIssueChanged, onIssueDeleted, personalDataReport, sealIssue, verifyIssue } from '../src/index';
import { convertAll } from '../src/service/conversion';
import { errorSummary, logFailure } from '../src/service/log';
import { consoleViolations } from './support/console-rule';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '', privacy: { reportPersonalData: jest.fn() } }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));

const SECRET = 'SECRET-LOG ann@example.com summary text';
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
afterEach(() => jest.restoreAllMocks());

/** Every log call so far has only text arguments and none holds the secret; returns the failure lines. */
function failureLines(): string[] {
  for (const args of calls) {
    for (const arg of args) expect(typeof arg).toBe('string');
    expect(args.join(' ')).not.toContain('SECRET-LOG');
  }
  return calls.map(args => args.join(' ')).filter(line => line.endsWith('Error code=KVS_DOWN'));
}

function setup() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann']);
  const storage = new MemoryStore();
  const as = (user: string | null) => {
    jira.currentUser = user;
    return { jira, storage };
  };
  return { jira, storage, as };
}

describe('Q8 the seven failure log lines', () => {
  it('onIssueDeleted', async () => {
    const broken = new MemoryStore();
    broken.query = async () => Promise.reject(secretError());
    await onIssueDeleted({ issue: { id: '1' } }, {}, broken);
    expect(failureLines()).toEqual(['LedgerSeal: could not delete the records of deleted issue 1: Error code=KVS_DOWN']);
  });

  it('personalDataReport', async () => {
    const { storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    await personalDataReport({}, {}, { jira: as(null).jira, storage }, async () => Promise.reject(secretError()));
    expect(failureLines()).toEqual(['LedgerSeal: the personal data report failed: Error code=KVS_DOWN']);
  });

  it('the seal deletes the replaced snapshot', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.edit('bob', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    const real = storage.delete.bind(storage);
    storage.delete = async (key: string) => (key.startsWith('ls3:content:') ? Promise.reject(secretError()) : real(key));
    await sealIssue({ signature: validSignature({ reason: 'Agreed' }) }, panelContext('ann'), as('ann'));
    expect(failureLines()).toEqual([expect.stringMatching(/^LedgerSeal: could not delete the replaced snapshot of issue 10001: Error code=KVS_DOWN$/)]);
  });

  it('verify, when the party key cannot be read', async () => {
    const { storage, as } = setup();
    storage.get = async () => Promise.reject(secretError());
    await expect(verifyIssue({}, panelContext('viewer'), as('viewer'))).resolves.toMatchObject({ status: 'ERROR', errorReason: 'STORAGE' });
    expect(failureLines()).toEqual(['LedgerSeal: verify failed: Error code=KVS_DOWN']);
  });

  it('verify, when the seal record cannot be read', async () => {
    const { storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    const real = storage.get.bind(storage);
    storage.get = async (key: string) => (key.startsWith('ls3:we:') ? Promise.reject(secretError()) : real(key));
    await expect(verifyIssue({}, panelContext('viewer'), as('viewer'))).resolves.toMatchObject({ status: 'ERROR', errorReason: 'STORAGE' });
    expect(failureLines()).toEqual(['LedgerSeal: verify failed: Error code=KVS_DOWN']);
  });

  it('issue event handling', async () => {
    const { storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    const real = storage.get.bind(storage);
    storage.get = async (key: string) => (key.startsWith('ls3:we:') ? Promise.reject(secretError()) : real(key));
    await onIssueChanged({ eventType: 'avi:jira:updated:issue', selfGenerated: false, issue: { id: '10001', key: 'CHG-1' }, atlassianId: 'mallory' }, {}, as(null));
    expect(failureLines()).toEqual(['LedgerSeal: issue event handling failed: Error code=KVS_DOWN']);
  });

  it('the weekly conversion of an old record', async () => {
    const storage = new MemoryStore();
    storage.query = async () => [{ key: 'ls3:we:10001', value: {} }];
    storage.get = async () => Promise.reject(secretError());
    await convertAll({ jira: new FakeJira(sampleIssue()), storage }, 1000);
    expect(failureLines()).toEqual(['LedgerSeal: could not convert the record of issue 10001: Error code=KVS_DOWN']);
  });
});

describe('Q8 errorSummary', () => {
  it('keeps only a plain name, a plain code and a whole-number status', () => {
    expect(errorSummary(new TypeError(SECRET))).toBe('TypeError');
    expect(errorSummary(Object.assign(new Error(SECRET), { status: 503 }))).toBe('Error status=503');
    expect(errorSummary({ statusCode: 429, message: SECRET })).toBe('Error status=429');
    expect(errorSummary({ name: SECRET, code: SECRET })).toBe('Error');
    expect(errorSummary({ name: 'Error', code: 42 })).toBe('Error code=42');
    expect(errorSummary(SECRET)).toBe('string');
    expect(errorSummary(undefined)).toBe('undefined');
    expect(errorSummary(null)).toBe('object');
  });
});

const APP = path.join(__dirname, '..');

describe('Q8 the frontend failure log lines', () => {
  const sites: Array<[string, string]> = [
    ['context.tsx', "logFailure('seal state failed', err);"],
    ['admin.tsx', "logFailure('could not load the approver groups', err);"],
    ['admin.tsx', "logFailure('could not save the approver groups', err);"],
    ['index.tsx', "logFailure('could not load the seal state', err);"],
    ['index.tsx', "logFailure('action failed', err);"],
    ['index.tsx', "logFailure('history failed', err);"],
    ['index.tsx', "logFailure('evidence failed', err);"],
    ['index.tsx', "logFailure('code request failed', err);"],
    ['admin-signing.tsx', "logFailure('could not load code signing', err);"],
    ['admin-signing.tsx', "logFailure('could not save code signing', err);"],
    ['admin-signing.tsx', "logFailure('could not load the alerts', err);"],
    ['admin-signing.tsx', "logFailure('alert action failed', err);"],
    ['signature-field.tsx', "logFailure('signature field could not load', err);"],
    ['signature-field.tsx', "logFailure('signature field code request failed', err);"],
    ['signature-field.tsx', "logFailure('signature field sign failed', err);"],
    ['admin-routes.tsx', "logFailure('could not load the routes', err);"],
    ['admin-routes.tsx', "logFailure('route action failed', err);"]
  ];

  it.each(sites)('src/frontend/%s: %s drops the secret', (file, call) => {
    const text = fs.readFileSync(path.join(APP, 'src/frontend', file), 'utf8');
    expect(text).toContain("import { logFailure } from '../service/log';");
    expect(text).toContain(call);
    const what = /logFailure\('([^']+)'/.exec(call)![1];
    logFailure(what, secretError());
    expect(failureLines()).toEqual([`LedgerSeal: ${what}: Error code=KVS_DOWN`]);
  });

  it('no frontend file logs any other way', () => {
    for (const file of ['context.tsx', 'admin.tsx', 'index.tsx', 'admin-signing.tsx', 'signature-field.tsx', 'admin-routes.tsx']) {
      const text = fs.readFileSync(path.join(APP, 'src/frontend', file), 'utf8');
      expect(text).not.toMatch(/console\./);
      expect((text.match(/logFailure\(/g) || []).length).toBe(sites.filter(([f]) => f === file).length);
    }
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

  it('finds an unsafe call', () => {
    expect(consoleViolations("try { x(); } catch (oops) { console.error('failed', oops); }")).toEqual(['line 1: console.error is given the error oops']);
    expect(consoleViolations('console.error(`failed: ${(err as Error)?.message}`);')).toEqual(["line 1: console.error is given an error's message", 'line 1: console.error is given the error err']);
    expect(consoleViolations("console.warn('failed', String(x));")).toEqual(['line 1: console.warn is given String(...)']);
    expect(consoleViolations('console.error(`x ${errorSummary(err)}`);')).toEqual([]);
  });

  it('is the same file in every app', () => {
    const mine = fs.readFileSync(path.join(__dirname, 'support/console-rule.ts'), 'utf8');
    for (const app of ['cascadeplan', 'definitionguard', 'ledgerseal', 'fourrealities']) {
      expect(fs.readFileSync(path.join(APP, '..', app, 'test/support/console-rule.ts'), 'utf8')).toBe(mine);
    }
  });
});
