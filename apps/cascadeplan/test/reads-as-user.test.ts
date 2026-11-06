/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: every Jira call runs as the user, so issue security applies (B-08, INV-06). No code
 * path calls Jira as the app: the source never names asApp, getJiraCaller fails without a user, and
 * the two entry points without a user (the issue-deleted trigger and the personal data report) make
 * no Jira call.
 */

import * as fs from 'fs';
import * as path from 'path';
import api from '@forge/api';
import { getProjectPlan, fetchLiveJiraIssues, fetchProjectEpics, fetchProjectUsers, setGlobalStorageProvider, getJiraCaller, issueDeletedTrigger, personalDataTrigger } from '../src/index';
import { MemStorage, entryOf } from './helpers/mem-storage';

const mockAsUserRequest = jest.fn();
const mockAsAppRequest = jest.fn();
const mockAsApp = jest.fn(() => ({ requestJira: mockAsAppRequest }));
const mockReportPersonalData = jest.fn(async (..._args: any[]): Promise<any[]> => []);
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: (...a: any[]) => (mockAsApp as any)(...a),
    asUser: () => ({ requestJira: mockAsUserRequest })
  },
  privacy: { reportPersonalData: (...a: any[]) => mockReportPersonalData(...a) },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));


describe('reads as the user (B-08)', () => {
  beforeEach(() => {
    setGlobalStorageProvider(new MemStorage());
    mockAsApp.mockClear();
    mockAsAppRequest.mockReset();
    mockAsUserRequest.mockReset();
    mockAsAppRequest.mockImplementation(async () => { throw new Error('asApp must not be used for reads'); });
    mockAsUserRequest.mockImplementation(async (url: string) => {
      if (String(url).includes('/user/assignable')) return { status: 200, json: async () => [{ accountId: 'a1', displayName: 'Ann' }] };
      if (String(url).includes('issuetype in (Epic')) return { status: 200, json: async () => ({ issues: [{ id: '9', key: 'TEST-9', fields: { summary: 'Epic' } }] }) };
      return { status: 200, json: async () => ({ issues: [{ id: '1', key: 'TEST-1', fields: { summary: 'Visible to me', issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'new' } } } }] }) };
    });
  });

  it('issues, epics and users are read through asUser', async () => {
    const live = await fetchLiveJiraIssues('TEST');
    const epics = await fetchProjectEpics('TEST');
    const users = await fetchProjectUsers('TEST');
    expect(live.backlogTasks.map(t => t.summary)).toEqual(['Visible to me']);
    expect(epics.map(e => e.key)).toEqual(['TEST-9']);
    expect(users.some(u => u.displayName === 'Ann')).toBe(true);
    expect(mockAsAppRequest).not.toHaveBeenCalled();
  });

  it('a full plan load makes no asApp call', async () => {
    const plan = await getProjectPlan('TEST');
    expect(plan.isLiveSynced).toBe(true);
    expect(mockAsAppRequest).not.toHaveBeenCalled();
    expect(mockAsUserRequest).toHaveBeenCalled();
  });
});

describe('no code path calls Jira as the app', () => {
  const srcRoot = path.join(__dirname, '..', 'src');
  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return sourceFiles(p);
      return /\.(ts|tsx|js|jsx)$/.test(e.name) ? [p] : [];
    });
  }

  beforeEach(() => {
    setGlobalStorageProvider(new MemStorage());
    mockAsApp.mockClear();
    mockAsAppRequest.mockReset();
    mockAsUserRequest.mockReset();
    mockReportPersonalData.mockClear();
  });

  it('no source file names asApp', () => {
    const files = sourceFiles(srcRoot);
    expect(files.length).toBeGreaterThan(10);
    const offenders = files.filter(f => /\basApp\b/.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(srcRoot, f));
    expect(offenders).toEqual([]);
  });

  it('getJiraCaller calls Jira as the user', async () => {
    mockAsUserRequest.mockResolvedValue({ status: 200, json: async () => ({}) });
    await getJiraCaller().requestJira('/rest/api/3/myself' as any);
    expect(mockAsUserRequest).toHaveBeenCalledTimes(1);
    expect(mockAsApp).not.toHaveBeenCalled();
  });

  it('getJiraCaller fails, and does not fall back to asApp, without a user context', () => {
    const origAsUser = (api as any).asUser;
    try {
      delete (api as any).asUser;
      expect(() => getJiraCaller()).toThrow('CascadePlan calls Jira only as the user, and no user context is available');
      expect(mockAsApp).not.toHaveBeenCalled();
    } finally {
      (api as any).asUser = origAsUser;
    }
  });

  it('the issue-deleted trigger works without a user and makes no Jira call', async () => {
    const origAsUser = (api as any).asUser;
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      delete (api as any).asUser;
      const res = await issueDeletedTrigger({ issue: { id: '9', key: 'TEST-9', fields: { project: { id: '10000', key: 'TEST' } } } });
      expect(res.deleted).toEqual([]);
      expect(log).toHaveBeenCalledWith(expect.stringContaining('issue-deleted TEST-9'));
    } finally {
      (api as any).asUser = origAsUser;
      log.mockRestore();
    }
    expect(mockAsApp).not.toHaveBeenCalled();
    expect(mockAsUserRequest).not.toHaveBeenCalled();
  });

  it('the personal data report works without a user and makes no Jira call', async () => {
    const origAsUser = (api as any).asUser;
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      delete (api as any).asUser;
      await personalDataTrigger();
      expect(log).toHaveBeenCalledWith(expect.stringContaining('personal data report:'));
    } finally {
      (api as any).asUser = origAsUser;
      log.mockRestore();
    }
    expect(mockAsApp).not.toHaveBeenCalled();
    expect(mockAsUserRequest).not.toHaveBeenCalled();
  });
});
