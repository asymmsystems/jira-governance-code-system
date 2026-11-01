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

/** Starts with a cached site configuration, so tests do not need a field-list call. */
class MockStorage implements StorageProvider {
  private store: Map<string, any> = new Map([['fr:cfg:site', { devFieldId: 'customfield_10000', siteHost: 'asymmsystems.atlassian.net', readAt: new Date().toISOString() }]]);

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
        mockRequestJira.mockReset();
        mockRequestJira.mockResolvedValue({ status, headers: { get: () => '0' }, json: async () => ({}) });
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
          payload: { issueId: 'iss-h4', type: 'CODE', reason: 'Configuration change only' }
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
      mockRequestJira.mockResolvedValue({ status: 200, json: async () => ({ fields: {} }) });
      const resCode = await recordException(
        { issueId: 'ex-1', issueKey: 'EX-1', type: 'CODE', reason: 'No code change: Documentation only', notes: 'Readme fix' },
        { extension: { issue: { id: 'ex-1' } } },
        mockStorage
      );
      expect(resCode.success).toBe(true);
      expect(resCode.record?.code?.reason).toBe('No code change: Documentation only');
      expect(resCode.record?.code?.notes).toBe('Readme fix');

      const resRework = await recordException(
        { issueId: 'ex-2', issueKey: 'EX-2', type: 'REWORK', reason: 'Requirement scope expansion' },
        { extension: { issue: { id: 'ex-2' } } },
        mockStorage
      );
      expect(resRework.success).toBe(true);
      expect(resRework.record?.rework?.reason).toBe('Requirement scope expansion');

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
  it('scores the issue from the issue read when the remote link read rejects', async () => {
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
      .mockRejectedValueOnce(new Error('remote link failure'));

    const res: any = await getIssueAlignment({}, { extension: { issue: { id: 'sec-1', key: 'SEC-1' } } }, storage);
    expect(res.row.issueKey).toBe('SEC-1');
    expect(res.row.gates.intent.state).toBe('MISSING');
    expect(res.row.gates.code.state).toBe('NOT_APPLICABLE');
  });
});

const NO_PR = { status: 200, json: async () => ({ fields: {} }) };

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
    mockRequestJira.mockResolvedValueOnce(NO_PR).mockResolvedValueOnce({ status: 403 });
    const res = await recordException({ issueId: '10001', issueKey: 'DEMO-1', type: 'CODE', reason: 'Configuration change only, no code' }, { extension: { issue: { id: '10001' } } }, storage);
    expect(res.success).toBe(false);
    expect(res.error).toBe('You need the Edit issues permission on DEMO-1 to record an exception.');
    expect(mockAppRequestJira).not.toHaveBeenCalled();
    expect(await storage.get('fr:issue:10001:exception')).toBeUndefined();
  });

  it('recordException reports a rejected request and stores nothing', async () => {
    const storage = new MockStorage();
    mockRequestJira.mockResolvedValueOnce(NO_PR).mockRejectedValueOnce(new Error('socket hang up'));
    const res = await recordException({ issueId: '10002', issueKey: 'DEMO-2', type: 'CODE', reason: 'Configuration change only, no code' }, { extension: { issue: { id: '10002' } } }, storage);
    expect(res.success).toBe(false);
    expect(res.error).toBe('socket hang up');
    expect(mockAppRequestJira).not.toHaveBeenCalled();
    expect(await storage.get('fr:issue:10002:exception')).toBeUndefined();
  });

  it('recordException reports a non-2xx status and stores nothing', async () => {
    const storage = new MockStorage();
    mockRequestJira.mockResolvedValueOnce(NO_PR).mockResolvedValueOnce({ status: 500 });
    const res = await recordException({ issueId: '10003', issueKey: 'DEMO-3', type: 'CODE', reason: 'Configuration change only, no code' }, { extension: { issue: { id: '10003' } } }, storage);
    expect(res.success).toBe(false);
    expect(res.error).toBe('Jira returned status 500 recording the exception.');
    expect(await storage.get('fr:issue:10003:exception')).toBeUndefined();
  });

  it('recordException writes the property as the user, then stores the record', async () => {
    const storage = new MockStorage();
    mockRequestJira.mockResolvedValueOnce(NO_PR).mockResolvedValueOnce({ status: 200 });
    const res = await recordException({ issueId: '10004', issueKey: 'DEMO-4', type: 'CODE', reason: 'Configuration change only, no code' }, { accountId: 'acc-9', extension: { issue: { id: '10004' } } }, storage);
    expect(res.success).toBe(true);
    expect(mockUserRequestJira).toHaveBeenCalledTimes(2);
    expect(mockUserRequestJira.mock.calls[0][0]).toBe('/rest/api/3/issue/10004?fields=customfield_10000');
    const [path, init] = mockUserRequestJira.mock.calls[1];
    expect(path).toBe('/rest/api/3/issue/10004/properties/fourrealities-exception');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body).code.recordedBy).toBe('acc-9');
    expect(mockAppRequestJira).not.toHaveBeenCalled();
    expect((await storage.get<any>('fr:issue:10004:exception')).code.reason).toBe('Configuration change only, no code');
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


describe('B-06: a Code exception is its own state, with who and why', () => {
  const ctx = { extension: { issue: { id: '30001' } }, accountId: 'acc-7' };
  beforeEach(() => {
    mockRequestJira.mockReset();
    mockAppRequestJira.mockClear();
    mockUserRequestJira.mockClear();
  });

  it('rejects a reason shorter than 15 or longer than 500 characters, and notes over 1,000', async () => {
    for (const reason of ['  too short   ', 'x'.repeat(501)]) {
      const res = await recordException({ issueId: '30001', type: 'CODE', reason }, ctx, new MockStorage());
      expect(res).toEqual({ success: false, error: 'Give a reason of 15 to 500 characters.' });
    }
    const res = await recordException({ issueId: '30001', type: 'CODE', reason: 'Configuration change only', notes: 'n'.repeat(1001) }, ctx, new MockStorage());
    expect(res).toEqual({ success: false, error: 'Notes can be at most 1,000 characters.' });
    expect(mockUserRequestJira).not.toHaveBeenCalled();
  });

  it('rejects a Code exception when a pull request exists, and writes nothing', async () => {
    const storage = new MockStorage();
    mockRequestJira.mockResolvedValueOnce({ status: 200, json: async () => ({ key: 'DEMO-30', fields: { customfield_10000: '{pullrequest={dataType=pullrequest, state=MERGED, stateCount=1}}' } }) });
    const res = await recordException({ issueId: '30001', issueKey: 'DEMO-30', type: 'CODE', reason: 'Configuration change only' }, ctx, storage);
    expect(res).toEqual({ success: false, error: 'A pull request is linked to DEMO-30. A Code exception applies only to work with no pull request.' });
    expect(mockUserRequestJira).toHaveBeenCalledTimes(1);
    expect(await storage.get('fr:issue:30001:exception')).toBeUndefined();
  });

  it('reports a failed Development field read', async () => {
    mockRequestJira.mockResolvedValueOnce({ status: 403 });
    const res = await recordException({ issueId: '30001', type: 'CODE', reason: 'Configuration change only' }, ctx, new MockStorage());
    expect(res).toEqual({ success: false, error: 'Jira returned HTTP 403 reading issue 30001.' });
  });

  it('keeps a Code exception and a rework reason in one v2 record, and writes the property as the user', async () => {
    const storage = new MockStorage();
    mockRequestJira.mockResolvedValueOnce(NO_PR).mockResolvedValueOnce({ status: 200 });
    await recordException({ issueId: '30001', issueKey: 'DEMO-30', type: 'CODE', reason: 'Configuration change only' }, ctx, storage);
    mockRequestJira.mockResolvedValueOnce({ status: 200 });
    const res = await recordException({ issueId: '30001', issueKey: 'DEMO-30', type: 'REWORK', reason: 'Requirement changed after review', notes: 'PO request' }, ctx, storage);
    expect(res.success).toBe(true);
    const stored = await storage.get<any>('fr:issue:30001:exception');
    expect(stored.schemaVersion).toBe(2);
    expect(stored.code.reason).toBe('Configuration change only');
    expect(stored.rework).toEqual(expect.objectContaining({ reason: 'Requirement changed after review', notes: 'PO request', recordedBy: 'acc-7' }));
    const lastPut = mockUserRequestJira.mock.calls[mockUserRequestJira.mock.calls.length - 1];
    expect(lastPut[0]).toBe('/rest/api/3/issue/30001/properties/fourrealities-exception');
    expect(JSON.parse(lastPut[1].body)).toEqual(stored);
    expect(mockAppRequestJira).not.toHaveBeenCalled();
  });

  it('reads a v1 record and rewrites it in v2 form', async () => {
    const storage = new MockStorage();
    await storage.set('fr:issue:30001:exception', { issueId: '30001', issueKey: 'DEMO-30', type: 'CODE', reason: 'Old v1 reason text', recordedBy: 'u', recordedAt: '2026-10-01T00:00:00Z' });
    mockRequestJira.mockResolvedValueOnce({ status: 200 });
    await recordException({ issueId: '30001', issueKey: 'DEMO-30', type: 'REWORK', reason: 'Requirement changed after review' }, ctx, storage);
    const stored = await storage.get<any>('fr:issue:30001:exception');
    expect(stored.code.reason).toBe('Old v1 reason text');
    expect(stored.type).toBeUndefined();
  });
});

describe('B-06: recordException fallbacks', () => {
  beforeEach(() => {
    mockRequestJira.mockReset();
    mockUserRequestJira.mockClear();
  });

  it('records with an unknown user, keeps the payload key when Jira omits it, and ignores a non-string Development field', async () => {
    const storage = new MockStorage();
    mockRequestJira
      .mockResolvedValueOnce({ status: 200, json: async () => ({ fields: { customfield_10000: { not: 'a string' } } }) })
      .mockResolvedValueOnce({ status: 204 });
    const res = await recordException({ issueId: '30002', issueKey: 'DEMO-31', type: 'CODE', reason: 'Configuration change only' }, { extension: { issue: { id: '30002' } } }, storage);
    expect(res.success).toBe(true);
    expect(res.record?.issueKey).toBe('DEMO-31');
    expect(res.record?.code?.recordedBy).toBe('unknown-user');
  });

  it('keeps an existing rework note when a Code exception is added', async () => {
    const storage = new MockStorage();
    const rework = { reason: 'Requirement changed after review', recordedBy: 'u', recordedAt: '2026-10-01T00:00:00Z' };
    await storage.set('fr:issue:30003:exception', { schemaVersion: 2, issueId: '30003', issueKey: 'DEMO-32', rework });
    mockRequestJira.mockResolvedValueOnce({ status: 200, json: async () => ({ key: 'DEMO-32', fields: {} }) }).mockResolvedValueOnce({ status: 200 });
    const res = await recordException({ issueId: '30003', type: 'CODE', reason: 'Configuration change only' }, { extension: { issue: { id: '30003' } }, accountId: 'a' }, storage);
    expect(res.record?.rework).toEqual(rework);
    expect(res.record?.code?.reason).toBe('Configuration change only');
  });

  it('reports a thrown error without a message during the checks', async () => {
    mockRequestJira.mockRejectedValueOnce({});
    const res = await recordException({ issueId: '30004', type: 'CODE', reason: 'Configuration change only' }, { extension: { issue: { id: '30004' } } }, new MockStorage());
    expect(res).toEqual({ success: false, error: 'Failed to check the issue.' });
  });
});

describe('B-10: one Code-gate path from the Development field', () => {
  const merged = '{pullrequest={dataType=pullrequest, state=MERGED, stateCount=1}}';
  const issue = { id: '40001', key: 'DEMO-40', fields: { summary: 'S', status: { name: 'Done', statusCategory: { key: 'done' } }, customfield_10000: merged }, properties: {} };
  beforeEach(() => {
    mockRequestJira.mockReset();
    mockAppRequestJira.mockClear();
    mockUserRequestJira.mockClear();
  });

  it('reads the issue and its remote links as the user, with no dev-status call', async () => {
    mockRequestJira.mockResolvedValueOnce({ status: 200, json: async () => issue }).mockResolvedValueOnce({ status: 200, json: async () => [] });
    const res: any = await getIssueAlignment({}, { extension: { issue: { id: '40001', key: 'DEMO-40' } } }, new MockStorage());
    expect(res.row.gates.code).toEqual({ state: 'FOUND', verification: 'HEURISTIC', reason: 'PR_MERGED', args: { count: 1 } });
    const paths = mockUserRequestJira.mock.calls.map(c => String(c[0]));
    expect(paths).toHaveLength(2);
    expect(paths[0]).toContain('/rest/api/3/issue/40001?fields=');
    expect(paths[0]).toContain('customfield_10000');
    expect(paths[1]).toBe('/rest/api/3/issue/40001/remotelink');
    expect(paths.some(p => p.includes('dev-status'))).toBe(false);
    expect(mockAppRequestJira).not.toHaveBeenCalled();
  });

  it('looks up the Development field by name when it is not cached', async () => {
    const storage = new MockStorage();
    await storage.delete('fr:cfg:site');
    mockRequestJira
      .mockResolvedValueOnce({ status: 200, json: async () => [{ id: 'customfield_10042', name: 'Development' }] })
      .mockResolvedValueOnce({ status: 200, json: async () => ({ baseUrl: 'https://asymmsystems.atlassian.net' }) })
      .mockResolvedValueOnce({ status: 200, json: async () => ({ ...issue, fields: { ...issue.fields, customfield_10042: merged } }) })
      .mockResolvedValueOnce({ status: 200, json: async () => [] });
    const res: any = await getIssueAlignment({}, { extension: { issue: { id: '40001', key: 'DEMO-40' } } }, storage);
    expect(mockUserRequestJira.mock.calls[0][0]).toBe('/rest/api/3/field');
    expect(mockUserRequestJira.mock.calls[1][0]).toBe('/rest/api/3/serverInfo');
    expect(String(mockUserRequestJira.mock.calls[2][0])).toContain('customfield_10042');
    expect(res.row.gates.code.reason).toBe('PR_MERGED');
  });

  it('shows Not applicable when the site has no Development field', async () => {
    const storage = new MockStorage();
    await storage.set('fr:cfg:site', { devFieldId: null, readAt: new Date().toISOString() });
    mockRequestJira.mockResolvedValueOnce({ status: 200, json: async () => issue }).mockResolvedValueOnce({ status: 200, json: async () => [] });
    const res: any = await getIssueAlignment({}, { extension: { issue: { id: '40001', key: 'DEMO-40' } } }, storage);
    expect(res.row.gates.code).toEqual({ state: 'NOT_APPLICABLE', reason: 'NO_DEV_TOOL' });
    expect(String(mockUserRequestJira.mock.calls[0][0])).not.toContain('customfield_10000');
  });

  it('returns a Jira error when the field list cannot be read', async () => {
    const storage = new MockStorage();
    await storage.delete('fr:cfg:site');
    mockRequestJira.mockResolvedValueOnce({ status: 500, json: async () => ({}) });
    const res: any = await getIssueAlignment({}, { extension: { issue: { id: '40001', key: 'DEMO-40' } } }, storage);
    expect(res.ok).toBe(false);
    expect(res.error.message).toContain('Jira returned HTTP 500 reading the field list.');
  });

  it('gives the same Code state on the dashboard and in the issue panel', async () => {
    mockRequestJira.mockResolvedValueOnce({ status: 200, json: async () => ({ issues: [issue] }) });
    const dash: any = await getProjectDashboard({}, { extension: { project: { key: 'DEMO' } } }, new MockStorage());
    expect(String(mockAppRequestJira.mock.calls[0][0])).toContain('customfield_10000');
    mockRequestJira.mockResolvedValueOnce({ status: 200, json: async () => issue }).mockResolvedValueOnce({ status: 200, json: async () => [] });
    const panel: any = await getIssueAlignment({}, { extension: { issue: { id: '40001', key: 'DEMO-40' } } }, new MockStorage());
    expect(dash.rows[0].gates.code).toEqual(panel.row.gates.code);
  });

  it('checks the discovered Development field before recording a Code exception', async () => {
    const storage = new MockStorage();
    await storage.set('fr:cfg:site', { devFieldId: 'customfield_10042', readAt: new Date().toISOString() });
    mockRequestJira.mockResolvedValueOnce({ status: 200, json: async () => ({ key: 'DEMO-40', fields: { customfield_10042: merged } }) });
    const res = await recordException({ issueId: '40001', type: 'CODE', reason: 'Configuration change only' }, { extension: { issue: { id: '40001' } } }, storage);
    expect(mockUserRequestJira.mock.calls[0][0]).toBe('/rest/api/3/issue/40001?fields=customfield_10042');
    expect(res.error).toContain('A pull request is linked to DEMO-40');
  });

  it('records a Code exception without a field read when the site has no Development field', async () => {
    const storage = new MockStorage();
    await storage.set('fr:cfg:site', { devFieldId: null, readAt: new Date().toISOString() });
    mockRequestJira.mockResolvedValueOnce({ status: 200 });
    const res = await recordException({ issueId: '40001', type: 'CODE', reason: 'Configuration change only' }, { extension: { issue: { id: '40001' } } }, storage);
    expect(res.success).toBe(true);
    expect(mockUserRequestJira).toHaveBeenCalledTimes(1);
  });

  it('returns a Jira error on the dashboard when the field list cannot be read', async () => {
    const storage = new MockStorage();
    await storage.delete('fr:cfg:site');
    mockRequestJira.mockResolvedValueOnce({ status: 503, json: async () => ({}) });
    const res: any = await getProjectDashboard({}, { extension: { project: { key: 'DEMO' } } }, storage);
    expect(res).toEqual({ ok: false, error: { code: 'JIRA_ERROR', message: 'Live Jira sync failed (Jira returned HTTP 503 reading the field list.).', status: undefined } });
    expect(mockAppRequestJira.mock.calls[0][0]).toBe('/rest/api/3/field');
  });
});


describe('B-15: Intent from link structure on both views', () => {
  const page = [{ object: { url: 'https://asymmsystems.atlassian.net/wiki/spaces/ARCH/pages/1', title: 'ADR-7 Settlement' } }];
  const started = { id: '50001', key: 'DEMO-50', fields: { summary: 'S', status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } } }, properties: {} };
  const todo = { id: '50002', key: 'DEMO-51', fields: { summary: 'T', status: { name: 'To Do', statusCategory: { key: 'new' } } }, properties: {}, changelog: { histories: [] } };
  beforeEach(() => {
    mockRequestJira.mockReset();
    mockAppRequestJira.mockClear();
    mockUserRequestJira.mockClear();
  });

  it('reads remote links for started issues only and agrees with the issue panel', async () => {
    mockRequestJira.mockImplementation(async (path: string) => {
      if (path.startsWith('/rest/api/3/search/jql')) return { status: 200, json: async () => ({ issues: [started, todo] }) };
      if (path === '/rest/api/3/issue/50001/remotelink') return { status: 200, json: async () => page };
      if (path.startsWith('/rest/api/3/issue/50001?')) return { status: 200, json: async () => started };
      return { status: 404, json: async () => ({}) };
    });
    const dash: any = await getProjectDashboard({}, { extension: { project: { key: 'DEMO' } } }, new MockStorage());
    const remoteCalls = mockAppRequestJira.mock.calls.map(c => String(c[0])).filter(p => p.endsWith('/remotelink'));
    expect(remoteCalls).toEqual(['/rest/api/3/issue/50001/remotelink']);
    const byKey = Object.fromEntries(dash.rows.map((r: any) => [r.issueKey, r.gates.intent]));
    expect(byKey['DEMO-50']).toEqual({ state: 'FOUND', verification: 'VERIFIED', reason: 'INTENT_CONFLUENCE_LINK', args: { title: 'ADR-7 Settlement' } });
    expect(byKey['DEMO-51']).toEqual({ state: 'NOT_APPLICABLE', reason: 'NOT_STARTED' });

    const panel: any = await getIssueAlignment({}, { extension: { issue: { id: '50001', key: 'DEMO-50' } } }, new MockStorage());
    expect(panel.row.gates.intent).toEqual(byKey['DEMO-50']);
  });

  it('shows Needs re-check on the dashboard when a remote link read fails', async () => {
    mockRequestJira.mockImplementation(async (path: string) => {
      if (path.startsWith('/rest/api/3/search/jql')) return { status: 200, json: async () => ({ issues: [started] }) };
      return { status: 500, json: async () => ({}) };
    });
    const dash: any = await getProjectDashboard({}, { extension: { project: { key: 'DEMO' } } }, new MockStorage());
    expect(dash.rows[0].gates.intent).toEqual({ state: 'NEEDS_RECHECK', reason: 'INTENT_LINKS_NOT_READ' });
  });
});

describe('B-09: the dashboard reads every issue once, up to the cap', () => {
  beforeEach(() => {
    mockRequestJira.mockReset();
    mockAppRequestJira.mockClear();
  });

  function pagedJira(total: number) {
    const issues = Array.from({ length: total }, (_, i) => ({ id: String(70000 + i), key: `P-${i + 1}`, fields: { summary: 'x', status: { name: 'To Do', statusCategory: { key: 'new' } } }, properties: {} }));
    mockRequestJira.mockImplementation(async (path: string, init?: any) => {
      if (path === '/rest/api/3/search/approximate-count') return { status: 200, json: async () => ({ count: total }) };
      if (path.startsWith('/rest/api/3/search/jql')) {
        const url = new URL('https://x' + path);
        const start = Number(url.searchParams.get('nextPageToken') || 0);
        const batch = issues.slice(start, start + 100);
        const next = start + 100 < total ? String(start + 100) : undefined;
        return { status: 200, json: async () => ({ issues: batch, nextPageToken: next, isLast: !next }) };
      }
      return { status: 404, json: async () => ({}) };
    });
  }

  it('shows 300 unique rows for 300 issues', async () => {
    pagedJira(300);
    const res: any = await getProjectDashboard({}, { extension: { project: { key: 'DEMO' } } }, new MockStorage());
    expect(res.rows).toHaveLength(300);
    expect(new Set(res.rows.map((r: any) => r.issueId)).size).toBe(300);
    expect(res.coverage).toEqual({ shown: 300, totalKnown: 300, capped: false });
  });

  it('reports the cap and the approximate total above 2,000 issues', async () => {
    pagedJira(2050);
    const res: any = await getProjectDashboard({}, { extension: { project: { key: 'DEMO' } } }, new MockStorage());
    expect(res.coverage).toEqual({ shown: 2000, totalKnown: 2050, capped: true });
  });

  it('retries a 429 from the search and then succeeds', async () => {
    mockRequestJira
      .mockResolvedValueOnce({ status: 429, headers: { get: () => '0' }, json: async () => ({}) })
      .mockResolvedValueOnce({ status: 200, json: async () => ({ issues: [], isLast: true }) });
    const res: any = await getProjectDashboard({}, { extension: { project: { key: 'DEMO' } } }, new MockStorage());
    expect(res.ok).toBe(true);
    expect(mockAppRequestJira).toHaveBeenCalledTimes(2);
  });
});
