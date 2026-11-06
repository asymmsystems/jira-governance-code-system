/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Marketplace security questionnaire question 8: a backend log line about a failure holds only the error's name,
 * code and status. Each of the seven places that log a caught error is made to fail with an error whose message
 * holds a secret; no log call may receive that message, the error object or its stack.
 *
 * @author Fahim Farook
 */

import { onIssueChanged, onIssueDeleted, personalDataReport, sealIssue, verifyIssue } from '../src/index';
import { convertAll } from '../src/service/conversion';
import { errorSummary } from '../src/service/log';
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
