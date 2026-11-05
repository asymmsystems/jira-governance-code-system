/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * F-21: a failed Jira search carries its status to the client, and failures are logged without names.
 */
import { getProjectPlan, setGlobalStorageProvider } from '../src/index';
import { logFailure } from '../src/logger';
import { MemStorage } from './helpers/mem-storage';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asApp: () => ({ requestJira: mockRequestJira }), asUser: () => ({ requestJira: mockRequestJira }) },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

describe('F-21: failure states', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined); setGlobalStorageProvider(new MemStorage()); });
  afterEach(() => warn.mockRestore());

  it('a refused search is not shown as an empty project: the plan says Jira answered 403, and the failure is logged', async () => {
    mockRequestJira.mockImplementation(async (r: any) => (String(r).includes('/search/jql') ? { status: 403, json: async () => ({}) } : { status: 200, json: async () => [] }));
    const plan: any = await getProjectPlan('TEST', new MemStorage());
    expect(plan).toMatchObject({ isLiveSynced: false, jiraStatus: 403 });
    expect(warn).toHaveBeenCalledWith('cascadeplan fetchRawIssues: HTTP 403');
  });

  it('no answer at all is status 0', async () => {
    mockRequestJira.mockImplementation(async (r: any) => { if (String(r).includes('/search/jql')) throw new Error('socket'); return { status: 200, json: async () => [] }; });
    const plan: any = await getProjectPlan('TEST', new MemStorage());
    expect(plan.jiraStatus).toBe(0);
  });

  it('the log line names the place and the error type only', () => {
    logFailure('x', Object.assign(new Error('Summary: secret text'), { code: 'RATE_LIMIT_EXCEEDED' }));
    expect(warn).toHaveBeenCalledWith('cascadeplan x: Error RATE_LIMIT_EXCEEDED');
  });
});
