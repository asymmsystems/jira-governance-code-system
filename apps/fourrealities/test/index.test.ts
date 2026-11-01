/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Forge Resolvers & Handlers Unit Tests
 */

import {
  getProjectDashboard,
  getIssueAlignment,
  renderProjectPage,
  renderIssuePanel,
  renderIssueContext,
  handler,
  setGlobalStorageProvider,
  resolveStorage,
  fetchProjectIssues,
  linkDecision,
  recordException
} from '../src/index';
import { StorageProvider, MetricsRepository } from '../src/storage/metrics-repository';

// One response queue (mockRequestJira) and one recording mock per principal,
// so a test can assert which principal made each call (FR-22).
const mockRequestJira = jest.fn();
const mockAppRequestJira = jest.fn((...args: any[]) => mockRequestJira(...args));
const mockUserRequestJira = jest.fn((...args: any[]) => mockRequestJira(...args));
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({
      requestJira: mockAppRequestJira
    }),
    asUser: () => ({
      requestJira: mockUserRequestJira
    })
  },
  route: (strings: any, ...values: any[]) =>
    strings.reduce((acc: string, part: string, i: number) => acc + part + (i < values.length ? String(values[i]) : ''), '')
}));

jest.mock('@forge/kvs', () => ({
  kvs: {
    get: jest.fn().mockResolvedValue({ dummy: 'val' }),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined)
  }
}));

class MockStorage implements StorageProvider {
  private store: Map<string, any> = new Map();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('FourRealities Index / Forge Handlers', () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    setGlobalStorageProvider(mockStorage);
    mockRequestJira.mockReset();
    mockAppRequestJira.mockClear();
    mockUserRequestJira.mockClear();
    mockRequestJira.mockResolvedValue({
      status: 200,
      json: async () => ({ issues: [] })
    });
  });

  const doneIssue = (id: string, key: string, extra: any = {}) => ({
    id, key,
    fields: { summary: 'Done work', status: { name: 'Done', statusCategory: { key: 'done', name: 'Done' } }, issuelinks: [], ...extra.fields },
    properties: extra.properties || {},
    changelog: { histories: [] }
  });

  describe('fetchProjectIssues', () => {
    it('returns raw issues with the producers\' properties', async () => {
      mockRequestJira.mockResolvedValueOnce({ status: 200, json: async () => ({ issues: [doneIssue('1', 'P-1'), doneIssue('2', 'P-2')] }) });
      const { issues, error } = await fetchProjectIssues('PROJ');
      expect(error).toBeUndefined();
      expect(issues.map(i => i.key)).toEqual(['P-1', 'P-2']);
      expect(mockAppRequestJira.mock.calls[0][0]).toContain('properties=ledgerseal-cert,definitionguard-dod,checklist');
      expect(mockAppRequestJira.mock.calls[0][0]).not.toContain('ledgersealCert');
    });

    it('returns the HTTP status and network errors', async () => {
      mockRequestJira.mockResolvedValueOnce({ status: 502, json: async () => ({}) });
      expect(await fetchProjectIssues('ERR')).toEqual({ issues: [], status: 502, error: 'Jira search/jql failed with HTTP 502' });
      mockRequestJira.mockRejectedValueOnce(new Error('Connection timeout'));
      expect((await fetchProjectIssues('T')).error).toBe('Connection timeout');
      mockRequestJira.mockRejectedValueOnce({});
      expect((await fetchProjectIssues('T')).error).toBe('Network error querying Jira search/jql');
    });
  });

  describe('getProjectDashboard', () => {
    it('returns rows and a summary for the context project, and stores nothing', async () => {
      const setSpy = jest.spyOn(mockStorage, 'set');
      mockRequestJira.mockResolvedValueOnce({ status: 200, json: async () => ({ issues: [doneIssue('2001', 'DEMO-1')] }) });
      const res: any = await getProjectDashboard({}, { extension: { project: { key: 'DEMO' } } }, mockStorage);
      expect(res.ok).toBe(true);
      expect(res.projectKey).toBe('DEMO');
      expect(res.rows.map((r: any) => r.issueKey)).toEqual(['DEMO-1']);
      expect(res.summary.totalIssues).toBe(1);
      expect(res.trend).toEqual([]);
      expect(setSpy).not.toHaveBeenCalled();
    });

    it('reads stored exceptions, v1 shape included', async () => {
      await mockStorage.set('fr:issue:2002:exception', { issueId: '2002', issueKey: 'DEMO-2', type: 'CODE', reason: 'Configuration only, no code', recordedBy: 'u', recordedAt: '2026-11-01T00:00:00Z' });
      mockRequestJira.mockResolvedValueOnce({ status: 200, json: async () => ({ issues: [doneIssue('2002', 'DEMO-2')] }) });
      const res: any = await getProjectDashboard({}, { extension: { project: { key: 'DEMO' } } }, mockStorage);
      expect(res.rows[0].gates.code.state).toBe('EXCEPTED');
    });

    it('ignores a payload project key and needs a project context', async () => {
      const res: any = await getProjectDashboard({ projectKey: 'OTHER' }, {}, mockStorage);
      expect(res).toEqual({ ok: false, error: { code: 'INVALID_INPUT', message: 'FourRealities: open this page from a Jira project.' } });
      expect(mockRequestJira).not.toHaveBeenCalled();
    });

    it('maps Jira failures to error codes', async () => {
      const ctx = { extension: { project: { key: 'DEMO' } } };
      for (const [status, code] of [[403, 'FORBIDDEN'], [404, 'NOT_FOUND'], [429, 'RATE_LIMITED'], [500, 'JIRA_ERROR']] as Array<[number, string]>) {
        mockRequestJira.mockResolvedValueOnce({ status, json: async () => ({}) });
        const res: any = await getProjectDashboard({}, ctx, mockStorage);
        expect(res.ok).toBe(false);
        expect(res.error.code).toBe(code);
        expect(res.error.status).toBe(status);
      }
    });
  });

  describe('getIssueAlignment', () => {
    const ctx = (id: string, key: string) => ({ extension: { issue: { id, key } } });

    it('needs an issue context', async () => {
      const res: any = await getIssueAlignment({ issueId: 'x' }, {}, mockStorage);
      expect(res.ok).toBe(false);
      expect(res.error.code).toBe('INVALID_INPUT');
    });

    it('never returns stored signals when the Jira read fails (B-03)', async () => {
      await mockStorage.set('fr:issue:stored-1:signals', { issueId: 'stored-1', issueKey: 'STORED-1', hasDocumentedIntent: true });
      mockRequestJira.mockResolvedValueOnce({ status: 404 });
      const res: any = await getIssueAlignment({}, ctx('stored-1', 'STORED-1'), mockStorage);
      expect(res.ok).toBe(false);
      expect(res.error.code).toBe('NOT_FOUND');
      expect(res.error.message).toBe("FourRealities: Jira returned HTTP 404 for issue 'STORED-1'.");
    });

    it('writes no signals key after a successful read (B-03)', async () => {
      const setSpy = jest.spyOn(mockStorage, 'set');
      mockRequestJira.mockResolvedValueOnce({ status: 200, json: async () => doneIssue('w-1', 'W-1') });
      const res: any = await getIssueAlignment({}, ctx('w-1', 'W-1'), mockStorage);
      expect(res.ok).toBe(true);
      expect(res.row.issueKey).toBe('W-1');
      expect(setSpy).not.toHaveBeenCalled();
    });

    it('scores pull requests from dev-status data', async () => {
      mockRequestJira
        .mockResolvedValueOnce({ status: 200, json: async () => doneIssue('dev-1', 'DEV-1') })
        .mockResolvedValueOnce({ status: 200, json: async () => ([]) })
        .mockResolvedValueOnce({ status: 200, json: async () => ({ detail: [{ pullRequests: [{ id: 'pr-1', reviewers: [{ approvalStatus: 'APPROVED' }] }] }, {}] }) })
        .mockResolvedValueOnce({ status: 200, json: async () => { throw new Error('bad json'); } })
        .mockResolvedValueOnce({ status: 404 });
      const res: any = await getIssueAlignment({}, ctx('dev-1', 'DEV-1'), mockStorage);
      expect(res.row.gates.code.state).toBe('FOUND');
      expect(res.row.gates.code.verification).toBe('HEURISTIC');
    });

    it('keeps going when the remote link body is not JSON', async () => {
      mockRequestJira
        .mockResolvedValueOnce({ status: 200, json: async () => doneIssue('rl-1', 'RL-1') })
        .mockResolvedValueOnce({ status: 200, json: async () => { throw new Error('bad json'); } })
        .mockResolvedValue({ status: 404 });
      const res: any = await getIssueAlignment({}, ctx('rl-1', 'RL-1'), mockStorage);
      expect(res.row.gates.intent.state).toBe('MISSING');
    });
  });

  describe('render functions', () => {
    it('returns module metadata for all views', async () => {
      expect((await renderProjectPage({})).moduleKey).toBe('fourrealities-project-dashboard');
      expect((await renderIssuePanel({})).moduleKey).toBe('fourrealities-issue-panel');
      expect((await renderIssueContext({})).moduleKey).toBe('fourrealities-issue-context');
    });
  });

  describe('handler (Forge resolver dispatcher)', () => {
    it('dispatches getProjectDashboard with the context project', async () => {
      const res: any = await handler({
        call: { functionKey: 'getProjectDashboard', payload: { projectKey: 'IGNORED' } },
        context: { extension: { project: { key: 'DISP-PROJ' } } }
      } as any);
      expect(res.ok).toBe(true);
      expect(res.projectKey).toBe('DISP-PROJ');
    });

    it('has no recordIssueSignals resolver (B-03)', async () => {
      await expect(handler({ call: { functionKey: 'recordIssueSignals', payload: { signals: { issueId: '1', issueKey: 'A-1' } } } } as any))
        .rejects.toThrow("Resolver has no definition for 'recordIssueSignals'");
    });

    it('throws on unsupported call', async () => {
      await expect(
        handler({
          call: { functionKey: 'unsupportedCall' }
        } as any)
      ).rejects.toThrow("Resolver has no definition for 'unsupportedCall'");
    });

    it('dispatches getIssueAlignment with the context issue', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ id: 'ctx-i', key: 'CTX-I', fields: { status: { name: 'Done', statusCategory: { name: 'Done' } } }, properties: {} })
      });
      const resIssue: any = await handler({
        call: { functionKey: 'getIssueAlignment' },
        context: { extension: { issue: { id: 'ctx-i', key: 'CTX-I' } } }
      } as any);
      expect(resIssue.row.issueKey).toBe('CTX-I');
    });

    it('dispatches linkDecision and recordException via handler', async () => {
      mockRequestJira.mockResolvedValue({ status: 200, json: async () => ({}) });

      const resLink: any = await handler({
        call: {
          functionKey: 'linkDecision',
          payload: { issueId: 'iss-h1', url: 'https://confluence.example.com/adr', title: 'ADR' }
        },
        context: { extension: { issue: { id: 'iss-h1' } } }
      } as any);
      expect(resLink.success).toBe(true);

      const resException: any = await handler({
        call: {
          functionKey: 'recordException',
          payload: { issueId: 'iss-h4', type: 'CODE', reason: 'Configuration only' }
        },
        context: { extension: { issue: { id: 'iss-h4' } } }
      } as any);
      expect(resException.success).toBe(true);
    });
  });

  describe('Storage Resolution and Edge Cases', () => {
    it('uses ForgeKvsProvider in non-test mode and handles operations and kvs errors', async () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        setGlobalStorageProvider(null);
        const { kvs } = require('@forge/kvs');
        const storage = resolveStorage();
        expect(storage).toBeDefined();

        await storage.set('test-key', { a: 1 });
        expect(kvs.set).toHaveBeenCalledWith('test-key', { a: 1 });

        const val = await storage.get('test-key');
        expect(val).toEqual({ dummy: 'val' });

        await storage.delete('test-key');
        expect(kvs.delete).toHaveBeenCalledWith('test-key');

        (kvs.get as jest.Mock).mockRejectedValueOnce(new Error('KVS get failed'));
        await expect(storage.get('error-key')).rejects.toThrow('KVS get failed');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  describe('Remediation Resolvers', () => {
    it('executes linkDecision with validated URL and title', async () => {
      mockRequestJira.mockResolvedValueOnce({ status: 201 });
      const res = await linkDecision({
        issueId: 'iss-1',
        url: 'https://confluence.example.com/wiki/spaces/ARCH/pages/ADR-014',
        title: 'ADR-014: Architecture Decision'
      }, { extension: { issue: { id: 'iss-1' } } });
      expect(res.success).toBe(true);
      expect(res.remoteLink.title).toBe('ADR-014: Architecture Decision');

      // Fails on missing issueId
      const failNoId = await linkDecision({});
      expect(failNoId.success).toBe(false);
      expect(failNoId.error).toContain('Missing issueId');

      // Fails on invalid URL
      const failUrl = await linkDecision({ issueId: 'iss-1', url: 'not-a-url', title: 'ADR' });
      expect(failUrl.success).toBe(false);
      expect(failUrl.error).toContain('Invalid specification URL');

      // Fails on missing title
      const failTitle = await linkDecision({ issueId: 'iss-1', url: 'https://example.com' });
      expect(failTitle.success).toBe(false);
      expect(failTitle.error).toContain('title or ADR identifier required');

      // Fails when context issueId mismatches payload issueId
      const failAuth = await linkDecision({ issueId: 'external-id' }, { extension: { issue: { id: 'context-id' } } });
      expect(failAuth.success).toBe(false);
      expect(failAuth.error).toContain('Unauthorized');

      // Fails on non-HTTP/HTTPS protocol
      const failProto = await linkDecision({ issueId: 'iss-1', url: 'ftp://bad.com', title: 'ADR' });
      expect(failProto.success).toBe(false);
      expect(failProto.error).toContain('Invalid URL protocol');

      // Fails when Jira returns non-200
      mockRequestJira.mockResolvedValueOnce({ status: 400 });
      const failHttp = await linkDecision({ issueId: 'iss-1', url: 'https://confluence.com/adr', title: 'ADR' }, { extension: { issue: { id: 'iss-1' } } });
      expect(failHttp.success).toBe(false);
      expect(failHttp.error).toContain('Jira returned status 400');
    });

    it('executes recordException for code and rework reasons and handles validations', async () => {
      mockRequestJira.mockResolvedValue({ status: 200 });
      const resCode = await recordException(
        { issueId: 'ex-1', issueKey: 'EX-1', type: 'CODE', reason: 'No code change: Documentation only', notes: 'Readme fix' },
        { extension: { issue: { id: 'ex-1' } } },
        mockStorage
      );
      expect(resCode.success).toBe(true);
      expect(resCode.record?.reason).toBe('No code change: Documentation only');
      expect(resCode.record?.notes).toBe('Readme fix');

      const resRework = await recordException(
        { issueId: 'ex-2', issueKey: 'EX-2', type: 'REWORK', reason: 'Requirement scope expansion' },
        { extension: { issue: { id: 'ex-2' } } },
        mockStorage
      );
      expect(resRework.success).toBe(true);
      expect(resRework.record?.type).toBe('REWORK');

      // Fails on missing issueId
      const failNoId = await recordException({});
      expect(failNoId.success).toBe(false);
      expect(failNoId.error).toContain('Missing issueId');

      // Fails on context mismatch
      const failAuth = await recordException({ issueId: 'other' }, { extension: { issue: { id: 'ctx' } } });
      expect(failAuth.success).toBe(false);
      expect(failAuth.error).toContain('Unauthorized');

      // Fails on missing reason
      const failNoReason = await recordException({ issueId: 'ex-3' });
      expect(failNoReason.success).toBe(false);
      expect(failNoReason.error).toContain('Exception reason required');

    });

    it('handles network error in linkDecision', async () => {
      mockRequestJira.mockRejectedValueOnce(new Error('Connection dropped'));
      const res = await linkDecision({
        issueId: 'iss-1',
        url: 'https://confluence.com/adr',
        title: 'ADR'
      }, { extension: { issue: { id: 'iss-1' } } });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Connection dropped');
    });
  });
});

describe('B-02: no writes into sibling app keys', () => {
  it('has no sealIssue or completeDod resolver', async () => {
    await expect(handler({ call: { functionKey: 'sealIssue', payload: { issueId: '1' } } } as any))
      .rejects.toThrow("Resolver has no definition for 'sealIssue'");
    await expect(handler({ call: { functionKey: 'completeDod', payload: { issueId: '1', items: [] } } } as any))
      .rejects.toThrow("Resolver has no definition for 'completeDod'");
  });

  it('contains no write path to ledgerseal-cert or definitionguard-dod in src', () => {
    const fs = require('fs');
    const path = require('path');
    const files: string[] = [];
    const walk = (dir: string) => fs.readdirSync(dir).forEach((f: string) => {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p);
    });
    walk(path.join(__dirname, '..', 'src'));
    const offenders = files.filter(f => /properties\/(ledgerseal-cert|definitionguard-dod)/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('getIssueAlignment with failing secondary calls', () => {
  it('scores the issue from the issue read when remote links and dev-status reject', async () => {
    const storage = new MockStorage();
    mockRequestJira.mockReset();
    mockRequestJira
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          id: 'sec-1', key: 'SEC-1',
          fields: { summary: 'S', status: { name: 'In Progress', statusCategory: { name: 'In Progress' } }, issuelinks: [] },
          properties: {}
        })
      })
      .mockRejectedValueOnce(new Error('remote link failure'))
      .mockRejectedValueOnce(new Error('stash failure'))
      .mockRejectedValueOnce(new Error('github failure'))
      .mockRejectedValueOnce(new Error('bitbucket failure'));

    const res: any = await getIssueAlignment({}, { extension: { issue: { id: 'sec-1', key: 'SEC-1' } } }, storage);
    expect(res.row.issueKey).toBe('SEC-1');
    expect(res.row.gates.intent.state).toBe('MISSING');
    expect(res.row.gates.code.state).toBe('NOT_APPLICABLE');
  });
});

describe('B-05: user actions run as the user only', () => {
  beforeEach(() => {
    mockRequestJira.mockReset();
    mockAppRequestJira.mockClear();
    mockUserRequestJira.mockClear();
  });

  it('linkDecision returns the permission error on 403 and never calls asApp', async () => {
    mockRequestJira.mockResolvedValueOnce({ status: 403 });
    const res = await linkDecision({ issueId: '10001', issueKey: 'DEMO-1', url: 'https://example.atlassian.net/wiki/x', title: 'ADR-1' }, { extension: { issue: { id: '10001' } } });
    expect(res.success).toBe(false);
    expect(res.error).toBe('You need the Edit issues permission on DEMO-1 to add a link.');
    expect(mockUserRequestJira).toHaveBeenCalledTimes(1);
    expect(mockAppRequestJira).not.toHaveBeenCalled();
  });

  it('recordException returns the permission error on 403, never calls asApp, and stores nothing', async () => {
    const storage = new MockStorage();
    mockRequestJira.mockResolvedValueOnce({ status: 403 });
    const res = await recordException({ issueId: '10001', issueKey: 'DEMO-1', type: 'CODE', reason: 'Configuration change only, no code' }, { extension: { issue: { id: '10001' } } }, storage);
    expect(res.success).toBe(false);
    expect(res.error).toBe('You need the Edit issues permission on DEMO-1 to record an exception.');
    expect(mockAppRequestJira).not.toHaveBeenCalled();
    expect(await storage.get('fr:issue:10001:exception')).toBeUndefined();
  });

  it('recordException reports a rejected request and stores nothing', async () => {
    const storage = new MockStorage();
    mockRequestJira.mockRejectedValueOnce(new Error('socket hang up'));
    const res = await recordException({ issueId: '10002', issueKey: 'DEMO-2', type: 'CODE', reason: 'Configuration change only, no code' }, { extension: { issue: { id: '10002' } } }, storage);
    expect(res.success).toBe(false);
    expect(res.error).toBe('socket hang up');
    expect(mockAppRequestJira).not.toHaveBeenCalled();
    expect(await storage.get('fr:issue:10002:exception')).toBeUndefined();
  });

  it('recordException reports a non-2xx status and stores nothing', async () => {
    const storage = new MockStorage();
    mockRequestJira.mockResolvedValueOnce({ status: 500 });
    const res = await recordException({ issueId: '10003', issueKey: 'DEMO-3', type: 'CODE', reason: 'Configuration change only, no code' }, { extension: { issue: { id: '10003' } } }, storage);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Jira returned status 500 recording the exception.');
    expect(await storage.get('fr:issue:10003:exception')).toBeUndefined();
  });

  it('recordException writes the property as the user, then stores the record', async () => {
    const storage = new MockStorage();
    mockRequestJira.mockResolvedValueOnce({ status: 200 });
    const res = await recordException({ issueId: '10004', issueKey: 'DEMO-4', type: 'CODE', reason: 'Configuration change only, no code' }, { accountId: 'acc-9', extension: { issue: { id: '10004' } } }, storage);
    expect(res.success).toBe(true);
    expect(mockUserRequestJira).toHaveBeenCalledTimes(1);
    const [path, init] = mockUserRequestJira.mock.calls[0];
    expect(path).toBe('/rest/api/3/issue/10004/properties/fourrealities-exception');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body).recordedBy).toBe('acc-9');
    expect(mockAppRequestJira).not.toHaveBeenCalled();
    expect((await storage.get<any>('fr:issue:10004:exception')).reason).toBe('Configuration change only, no code');
  });
});

describe('B-07: every payload issue id is checked against the context', () => {
  const body = { url: 'https://example.atlassian.net/wiki/spaces/A/pages/1', title: 'ADR-7: Settlement' };
  beforeEach(() => {
    mockRequestJira.mockReset();
    mockAppRequestJira.mockClear();
    mockUserRequestJira.mockClear();
  });

  it('rejects an issue from another project on the project page and makes no write', async () => {
    mockRequestJira.mockResolvedValueOnce({ status: 200, json: async () => ({ key: 'TEST-9', fields: { project: { key: 'TEST' } } }) });
    const res = await linkDecision({ issueId: '20009', ...body }, { extension: { project: { key: 'DEMO' } } });
    expect(res.success).toBe(false);
    expect(res.error).toBe('Forbidden: issue TEST-9 is not in project DEMO.');
    expect(mockUserRequestJira).toHaveBeenCalledTimes(1);
    expect(mockUserRequestJira.mock.calls[0][0]).toBe('/rest/api/3/issue/20009?fields=project');
    expect(mockUserRequestJira.mock.calls[0][1]).toBeUndefined();
  });

  it('rejects when the user cannot read the issue', async () => {
    const storage = new MockStorage();
    mockRequestJira.mockResolvedValueOnce({ status: 404 });
    const res = await recordException({ issueId: '20010', type: 'CODE', reason: 'Configuration change only, no code' }, { extension: { project: { key: 'DEMO' } } }, storage);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Jira returned HTTP 404 reading issue 20010.');
    expect(mockUserRequestJira).toHaveBeenCalledTimes(1);
    expect(await storage.get('fr:issue:20010:exception')).toBeUndefined();
  });

  it('allows an issue from the context project', async () => {
    mockRequestJira
      .mockResolvedValueOnce({ status: 200, json: async () => ({ key: 'DEMO-11', fields: { project: { key: 'DEMO' } } }) })
      .mockResolvedValueOnce({ status: 201 });
    const res = await linkDecision({ issueId: '20011', ...body }, { extension: { project: { key: 'DEMO' } } });
    expect(res.success).toBe(true);
    expect(mockUserRequestJira).toHaveBeenCalledTimes(2);
    expect(mockUserRequestJira.mock.calls[1][1].method).toBe('POST');
    expect(mockAppRequestJira).not.toHaveBeenCalled();
  });

  it('rejects a call with neither an issue nor a project context', async () => {
    const res = await linkDecision({ issueId: '20012', ...body }, {});
    expect(res.success).toBe(false);
    expect(res.error).toBe('Forbidden: no Jira project or issue context.');
    expect(mockUserRequestJira).not.toHaveBeenCalled();
  });

  it('reports a failed scope read in recordException and stores nothing', async () => {
    const storage = new MockStorage();
    mockRequestJira.mockRejectedValueOnce(new Error('scope read failed'));
    const res = await recordException({ issueId: '20013', type: 'CODE', reason: 'Configuration change only, no code' }, { extension: { project: { key: 'DEMO' } } }, storage);
    expect(res.success).toBe(false);
    expect(res.error).toBe('scope read failed');
    expect(await storage.get('fr:issue:20013:exception')).toBeUndefined();
  });

  it('rejects an issue id that differs from the issue view', async () => {
    const res = await linkDecision({ issueId: '20014', url: 'https://example.atlassian.net/wiki/x', title: 'ADR-8' }, { extension: { issue: { id: '20015' } } });
    expect(res.success).toBe(false);
    expect(mockUserRequestJira).not.toHaveBeenCalled();
  });

  it('names the issue id when Jira returns no key on a project mismatch', async () => {
    mockRequestJira.mockResolvedValueOnce({ status: 200, json: async () => ({ fields: { project: { key: 'TEST' } } }) });
    const res = await linkDecision({ issueId: '20016', url: 'https://example.atlassian.net/wiki/x', title: 'ADR-9' }, { extension: { project: { key: 'DEMO' } } });
    expect(res.error).toBe('Forbidden: issue 20016 is not in project DEMO.');
  });

  it('reports a network failure without a message on the issue read', async () => {
    mockRequestJira.mockResolvedValue({ status: 404 });
    mockRequestJira.mockRejectedValueOnce({});
    const res: any = await getIssueAlignment({}, { extension: { issue: { id: 'n-1', key: 'N-1' } } }, new MockStorage());
    expect(res.error).toEqual({ code: 'JIRA_ERROR', message: "FourRealities: Failed to query Jira for issue 'N-1': network error", status: undefined });
  });
});

