/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Asymm Systems Team
 * FourRealities: Forge Resolvers & Handlers Unit Tests
 */

import {
  getProjectDashboard,
  getIssueAlignment,
  recordIssueSignals,
  renderProjectPage,
  renderIssuePanel,
  renderIssueContext,
  handler,
  setGlobalStorageProvider,
  resolveStorage,
  fetchLiveProjectAudit,
  linkDecision,
  recordException,
  analyzeIssueChangelog,
  evaluateDocumentedIntent,
  extractSignalsFromIssue
} from '../src/index';
import { StorageProvider, MetricsRepository } from '../src/storage/metrics-repository';
import { RealitySignals, IssueExceptionRecord } from '../src/domain/models';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({
      requestJira: mockRequestJira
    }),
    asUser: () => ({
      requestJira: mockRequestJira
    })
  },
  route: (strings: any, ...values: any[]) => strings.join('')
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
    mockRequestJira.mockResolvedValue({
      status: 200,
      json: async () => ({ issues: [] })
    });
  });

  describe('fetchLiveProjectAudit', () => {
    it('queries Jira and parses issues with entity properties and pagination', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          total: 2,
          issues: [
            {
              id: '1001',
              key: 'PROJ-1',
              fields: {
                summary: 'Feature one',
                status: { name: 'Done', statusCategory: { name: 'Done' } },
                issuelinks: [{ id: 'link-1' }],
                sprint: { name: 'Sprint 10' }
              },
              properties: {
                'ledgerseal-cert': { status: 'SEAL_VALID', certificateId: 'LS-ABCD1234', snapshotHash: 'hash-abc' },
                'definitionguard-dod': { isFullySatisfied: true }
              }
            },
            {
              id: '1002',
              key: 'PROJ-2',
              fields: {
                summary: 'Task two',
                status: { name: 'In Progress', statusCategory: { name: 'In Progress' } },
                issuelinks: []
              },
              properties: {}
            }
          ]
        })
      });

      const repo = new MetricsRepository(mockStorage);
      const { signals, error } = await fetchLiveProjectAudit('PROJ', repo);
      expect(error).toBeUndefined();
      expect(signals.length).toBe(2);
      expect(signals[0].issueKey).toBe('PROJ-1');
      expect(signals[0].hasCryptographicSeal).toBe(true);
      expect(signals[0].isDoDSatisfied).toBe(true);
      expect(signals[0].sprintName).toBe('Sprint 10');
      expect(signals[1].issueKey).toBe('PROJ-2');
      expect(signals[1].hasCryptographicSeal).toBe(false);
    });

    it('returns error when Jira search returns non-200 status', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 502,
        json: async () => ({ errorMessages: ['Gateway error'] })
      });

      const { signals, error } = await fetchLiveProjectAudit('ERR');
      expect(signals).toHaveLength(0);
      expect(error).toContain('Jira search/jql failed with HTTP 502');
    });

    it('catches and returns network errors', async () => {
      mockRequestJira.mockRejectedValueOnce(new Error('Connection timeout'));

      const { signals, error } = await fetchLiveProjectAudit('TIMEOUT');
      expect(signals).toHaveLength(0);
      expect(error).toBe('Connection timeout');
    });
  });

  describe('getProjectDashboard', () => {
    it('returns live audit snapshot with summary and stores in repository', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          total: 1,
          issues: [
            {
              id: '2001',
              key: 'DEMO-1',
              fields: {
                summary: 'Core item',
                status: { name: 'Done', statusCategory: { name: 'Done' } },
                issuelinks: []
              },
              properties: {
                'ledgerseal-cert': { status: 'SEAL_VALID', certificateId: 'LS-999', snapshotHash: 'sha-999' },
                'definitionguard-dod': { isFullySatisfied: true }
              }
            }
          ]
        })
      });

      const snapshot = await getProjectDashboard({ projectKey: 'DEMO' }, {}, mockStorage);

      expect(snapshot.projectKey).toBe('DEMO');
      expect(snapshot.summary.totalAuditedIssues).toBe(1);
      expect(snapshot.issueScores.length).toBe(1);
      expect(snapshot.warning).toBeUndefined();
    });

    it('falls back to cached snapshot when live Jira query fails', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      });

      const cachedSnapshot = {
        snapshotId: 'cached-1',
        projectKey: 'FAIL-PROJ',
        generatedAt: '2026-10-29T10:00:00Z',
        generatedBy: 'admin',
        summary: {
          m11TraceabilityRate: 100,
          m29ReviewComplianceRate: 100,
          m30ReworkLoopRate: 0,
          m40AuditComplianceRate: 100,
          averageRAI: 100,
          totalAuditedIssues: 1,
          doneCount: 1,
          sealedDoneCount: 1,
          healthyIssueCount: 1,
          atRiskIssueCount: 0,
          highRiskIssueKeys: [],
          gateBreakdown: {
            intent: { passed: 1, attention: 0, blocked: 0, hollow: 0 },
            process: { passed: 1, attention: 0, blocked: 0, hollow: 0 },
            code: { passed: 1, attention: 0, blocked: 0, hollow: 0 },
            audit: { passed: 1, attention: 0, blocked: 0, hollow: 0 }
          },
          weakestGate: 'audit' as const,
          sprintName: 'Sprint 1',
          hasTrendHistory: false,
          riskDistribution: { low: 1, medium: 0, high: 0, critical: 0 }
        },
        issueScores: []
      };

      await mockStorage.set('fr:project:FAIL-PROJ:latest', cachedSnapshot);

      const snapshot = await getProjectDashboard({ projectKey: 'FAIL-PROJ' }, {}, mockStorage);

      expect(snapshot.snapshotId).toBe('cached-1');
      expect(snapshot.warning).toContain('Live Jira sync failed');
    });

    it('returns empty fallback snapshot with warning when live fails and no cache exists', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 500,
        json: async () => ({ error: 'Fail' })
      });

      const snap = await getProjectDashboard({ projectKey: 'PROJ-FRESH-FAIL' }, {}, mockStorage);
      expect(snap.projectKey).toBe('PROJ-FRESH-FAIL');
      expect(snap.warning).toContain('No cached snapshot available');
    });

    it('falls back to context project key or DEFAULT when payload projectKey missing', async () => {
      const snap = await getProjectDashboard(
        {},
        { extension: { project: { key: 'FALLBACK' } } },
        mockStorage
      );
      expect(snap.projectKey).toBe('FALLBACK');

      const snapDefault = await getProjectDashboard({}, {}, mockStorage);
      expect(snapDefault.projectKey).toBe('DEFAULT');
    });
  });

  describe('getIssueAlignment', () => {
    it('throws error when issueId is missing', async () => {
      await expect(getIssueAlignment({}, {}, mockStorage)).rejects.toThrow('Missing issueId');
    });

    it('evaluates stored signals when available in repository', async () => {
      const storedSignals: RealitySignals = {
        issueId: 'stored-1',
        issueKey: 'STORED-1',
        hasDocumentedIntent: true,
        transitionCount: 1,
        regressionCount: 0,
        prCount: 1,
        hasApprovedReview: true,
        hasCryptographicSeal: true,
        isDoDSatisfied: true
      };
      await mockStorage.set('fr:issue:stored-1:signals', storedSignals);

      const score = await getIssueAlignment({ issueId: 'stored-1', issueKey: 'STORED-1' }, {}, mockStorage);
      expect(score.issueKey).toBe('STORED-1');
      expect(score.realityAlignmentIndex).toBe(100);
      expect(score.riskLevel).toBe('LOW');
    });

    it('throws error when Jira query fails and no stored signals exist', async () => {
      mockRequestJira.mockResolvedValueOnce({ status: 404 });
      await expect(
        getIssueAlignment({ issueId: 'not-found', issueKey: 'NF-1' }, {}, mockStorage)
      ).rejects.toThrow("Failed to query Jira for issue 'NF-1'");
    });

    it('fetches live Jira issue and parses authentic PR reviews in getIssueAlignment', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          id: 'live-iss-1',
          key: 'LIVE-1',
          fields: {
            summary: 'Live Issue',
            status: { name: 'Done', statusCategory: { name: 'Done' } },
            issuelinks: [
              {
                id: '1',
                type: { outward: 'is documented by' },
                outwardIssue: { fields: { summary: '[ADR] System Architecture' } }
              }
            ],
            customfield_10000: '{pullrequest={dataType=pullrequest, state=MERGED, reviewStatus=APPROVED}}'
          },
          properties: {
            'ledgerseal-cert': { status: 'SEAL_VALID', certificateId: 'LS-LIVE1', snapshotHash: 'hash-live' },
            'definitionguard-dod': { isFullySatisfied: true }
          }
        })
      });

      const score = await getIssueAlignment({ issueId: 'live-iss-1' }, {}, mockStorage);
      expect(score.intentScore).toBe(100);
      expect(score.codeScore).toBe(100);
      expect(score.auditScore).toBe(100);
      expect(score.realityAlignmentIndex).toBe(100);
    });

    it('penalizes PRs that are merged without verified approval', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          id: 'unreviewed-1',
          key: 'UNREV-1',
          fields: {
            summary: 'Unreviewed Merge',
            status: { name: 'Done', statusCategory: { name: 'Done' } },
            issuelinks: [{ outwardIssue: { fields: { summary: '[ADR] Spec' } } }],
            customfield_10000: '{pullrequest={dataType=pullrequest, state=MERGED}}' // Merged without APPROVED
          },
          properties: {
            'ledgerseal-cert': { status: 'SEAL_VALID', certificateId: 'LS-1', snapshotHash: 'hash-1' },
            'definitionguard-dod': { isFullySatisfied: true }
          }
        })
      });

      const score = await getIssueAlignment({ issueId: 'unreviewed-1' }, {}, mockStorage);
      expect(score.codeScore).toBe(40); // Merged without review approval
      expect(score.gates.code).toBe('BLOCKED');
      expect(score.synthesizedFinding).toContain('without verified peer review approval');
    });

    it('fetches pullRequests from dev-status in getIssueAlignment', async () => {
      mockRequestJira
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({
            id: 'dev-iss-1',
            key: 'DEV-1',
            fields: { summary: 'Dev item', status: { name: 'Done', statusCategory: { name: 'Done' } }, issuelinks: [] },
            properties: {}
          })
        })
        .mockResolvedValueOnce({ status: 200, json: async () => ([]) }) // remotelink
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({
            detail: [
              {
                pullRequests: [
                  { id: 'pr-1', status: 'APPROVED', reviewers: [{ approvalStatus: 'APPROVED' }] }
                ]
              }
            ]
          })
        }) // stash
        .mockResolvedValueOnce({ status: 404 }) // github
        .mockResolvedValueOnce({ status: 404 }); // bitbucket

      const score = await getIssueAlignment({ issueId: 'dev-iss-1' }, {}, mockStorage);
      expect(score.codeScore).toBe(100);
      expect(score.gates.code).toBe('PASSED');
    });
  });

  describe('recordIssueSignals', () => {
    it('prevents cross-project poisoning when contextProject mismatches targetProject', async () => {
      await expect(
        recordIssueSignals(
          { signals: { issueId: '1', issueKey: 'ATTACK-1' }, projectKey: 'PROJ_B' },
          { extension: { project: { key: 'PROJ_A' } } },
          mockStorage
        )
      ).rejects.toThrow("Cannot record signals for project 'PROJ_B' from context 'PROJ_A'.");
    });

    it('throws error when signals payload is missing', async () => {
      await expect(
        recordIssueSignals({ projectKey: 'PROJ' }, {}, mockStorage)
      ).rejects.toThrow('Valid issue signals required.');
    });

    it('throws error when project key cannot be determined from signals', async () => {
      await expect(
        recordIssueSignals({ signals: { issueId: '99', issueKey: 'NOPROJECT' } }, {}, mockStorage)
      ).rejects.toThrow('Project key required.');
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
    it('dispatches getProjectDashboard', async () => {
      const res: any = await handler({
        call: {
          functionKey: 'getProjectDashboard',
          payload: { projectKey: 'DISP-PROJ' }
        }
      } as any);
      expect(res.projectKey).toBe('DISP-PROJ');
    });

    it('dispatches recordIssueSignals', async () => {
      const res: any = await handler({
        call: {
          functionKey: 'recordIssueSignals',
          payload: {
            signals: {
              issueId: 'issue-66',
              issueKey: 'TEST-66',
              hasDocumentedIntent: true,
              transitionCount: 1,
              regressionCount: 0,
              prCount: 1,
              hasApprovedReview: true,
              hasCryptographicSeal: true,
              isDoDSatisfied: true
            }
          }
        }
      } as any);
      expect(res.issueKey).toBe('TEST-66');
    });

    it('throws on unsupported call', async () => {
      await expect(
        handler({
          call: { functionKey: 'unsupportedCall' }
        } as any)
      ).rejects.toThrow("Resolver has no definition for 'unsupportedCall'");
    });

    it('falls back to context in resolver when payload fields missing', async () => {
      const resProj: any = await handler({
        call: { functionKey: 'getProjectDashboard' },
        context: { extension: { project: { key: 'CTX-P' } } }
      } as any);
      expect(resProj.projectKey).toBe('CTX-P');

      await mockStorage.set('fr:issue:ctx-i:signals', {
        issueId: 'ctx-i',
        issueKey: 'CTX-I',
        hasDocumentedIntent: true,
        transitionCount: 1,
        regressionCount: 0,
        prCount: 1,
        hasApprovedReview: true,
        hasCryptographicSeal: true,
        isDoDSatisfied: true
      });
      const resIssue: any = await handler({
        call: { functionKey: 'getIssueAlignment' },
        context: { extension: { issue: { id: 'ctx-i', key: 'CTX-I' } } }
      } as any);
      expect(resIssue.issueKey).toBe('CTX-I');
    });

    it('dispatches linkDecision and recordException via handler', async () => {
      mockRequestJira.mockResolvedValue({ status: 200, json: async () => ({}) });

      const resLink: any = await handler({
        call: {
          functionKey: 'linkDecision',
          payload: { issueId: 'iss-h1', url: 'https://confluence.example.com/adr', title: 'ADR' }
        }
      } as any);
      expect(resLink.success).toBe(true);

      const resException: any = await handler({
        call: {
          functionKey: 'recordException',
          payload: { issueId: 'iss-h4', type: 'CODE', reason: 'Configuration only' }
        }
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

    it('covers analyzeIssueChangelog and rework loops', () => {
      expect(analyzeIssueChangelog(null)).toEqual({ transitionCount: 1, regressionCount: 0 });
      expect(analyzeIssueChangelog({})).toEqual({ transitionCount: 1, regressionCount: 0 });
      expect(analyzeIssueChangelog({ histories: [{ items: null }] })).toEqual({ transitionCount: 1, regressionCount: 0 });

      // Forward progression
      const forwardChangelog = {
        histories: [
          { items: [{ field: 'status', fromString: 'Open', toString: 'In Progress' }] },
          { items: [{ field: 'status', fromString: 'In Progress', toString: 'In Review' }] },
          { items: [{ field: 'status', fromString: 'In Review', toString: 'Done' }] }
        ]
      };
      expect(analyzeIssueChangelog(forwardChangelog)).toEqual({ transitionCount: 3, regressionCount: 0 });

      // Rework loop from In Review back to In Progress
      const reviewBounce = {
        histories: [
          { items: [{ field: 'status', fromString: 'In Progress', toString: 'In Review' }] },
          { items: [{ field: 'status', fromString: 'In Review', toString: 'In Progress' }] }
        ]
      };
      expect(analyzeIssueChangelog(reviewBounce)).toEqual({ transitionCount: 2, regressionCount: 1 });

      // Reopening from Done
      const doneBounce = {
        histories: [
          { items: [{ field: 'status', fromString: 'Done', toString: 'Reopened' }] }
        ]
      };
      expect(analyzeIssueChangelog(doneBounce)).toEqual({ transitionCount: 1, regressionCount: 1 });
    });

    it('covers evaluateDocumentedIntent with strict ADR criteria', () => {
      expect(evaluateDocumentedIntent(null)).toBe(false);
      expect(evaluateDocumentedIntent([])).toBe(false);

      // Remote links with explicit ADR / architecture titles
      expect(evaluateDocumentedIntent([], [{ title: 'ADR-042: System Architecture' }])).toBe(true);
      expect(evaluateDocumentedIntent([], [{ url: 'https://confluence.example.com/wiki/spaces/ARCH/pages/ADR-01' }])).toBe(true);
      expect(evaluateDocumentedIntent([], [{ url: 'https://notion.so/rfc-event-sourcing' }])).toBe(true);
      expect(evaluateDocumentedIntent([], [{ url: 'https://google.com', title: 'Search' }])).toBe(false);

      // Issue links
      expect(evaluateDocumentedIntent([{ inwardIssue: { fields: { summary: '[ADR] Database Sharding' } } }])).toBe(true);
      expect(evaluateDocumentedIntent([{ outwardIssue: { fields: { summary: '[SPEC] Payment API' } } }])).toBe(true);
      expect(evaluateDocumentedIntent([{ outwardIssue: { fields: { summary: '[ARCH] Event Mesh' } } }])).toBe(true);
      expect(evaluateDocumentedIntent([{ inwardIssue: { fields: { summary: '[RFC] Auth Flow' } } }])).toBe(true);
      expect(evaluateDocumentedIntent([{ type: { outward: 'specifies requirement' } }])).toBe(true);
      expect(evaluateDocumentedIntent([{ inwardIssue: { fields: { issuetype: { name: 'Architecture Decision' } } } }])).toBe(true);
      expect(evaluateDocumentedIntent([{ inwardIssue: { fields: { summary: 'Random bug fix' } } }])).toBe(false);
    });

    it('covers extractSignalsFromIssue with remoteLinks and devStatus pullRequests', () => {
      const rawIssue = {
        id: '123',
        key: 'KEY-123',
        fields: {
          summary: 'Item',
          status: { name: 'Done', statusCategory: { name: 'Done' } },
          issuelinks: [],
          sprint: { name: 'Sprint 5' }
        },
        properties: {
          'ledgerseal-cert': { status: 'SEAL_VALID', certificateId: 'LS-TEST', snapshotHash: 'hash-xyz' },
          'definitionguard-dod': { isFullySatisfied: true, completedCount: 5, totalCount: 5 }
        }
      };

      const remoteLinks = [{ object: { url: 'https://wiki.example.com/adr-01', title: 'ADR-01 Spec' } }];
      const pullRequests = [{ id: 'pr-1', status: 'APPROVED', reviewers: [{ approvalStatus: 'APPROVED' }] }];
      const exception: IssueExceptionRecord = {
        issueId: '123',
        issueKey: 'KEY-123',
        type: 'CODE',
        reason: 'No code change: Documentation only',
        recordedBy: 'user',
        recordedAt: '2026-10-30T10:00:00Z'
      };

      const signals = extractSignalsFromIssue(rawIssue, remoteLinks, pullRequests, exception);
      expect(signals.hasDocumentedIntent).toBe(true);
      expect(signals.hasApprovedReview).toBe(true);
      expect(signals.hasCryptographicSeal).toBe(true);
      expect(signals.isDoDSatisfied).toBe(true);
      expect(signals.codeExceptionReason).toBe('No code change: Documentation only');
      expect(signals.sprintName).toBe('Sprint 5');
    });
  });

  describe('Remediation Resolvers', () => {
    it('executes linkDecision with validated URL and title', async () => {
      mockRequestJira.mockResolvedValueOnce({ status: 201 });
      const res = await linkDecision({
        issueId: 'iss-1',
        url: 'https://confluence.example.com/wiki/spaces/ARCH/pages/ADR-014',
        title: 'ADR-014: Architecture Decision'
      });
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
      const failHttp = await linkDecision({ issueId: 'iss-1', url: 'https://confluence.com/adr', title: 'ADR' });
      expect(failHttp.success).toBe(false);
      expect(failHttp.error).toContain('Jira returned status 400');
    });

    it('executes recordException for code and rework reasons and handles validations', async () => {
      mockRequestJira.mockResolvedValue({ status: 200 });
      const resCode = await recordException(
        { issueId: 'ex-1', issueKey: 'EX-1', type: 'CODE', reason: 'No code change: Documentation only', notes: 'Readme fix' },
        {},
        mockStorage
      );
      expect(resCode.success).toBe(true);
      expect(resCode.record?.reason).toBe('No code change: Documentation only');
      expect(resCode.record?.notes).toBe('Readme fix');

      const resRework = await recordException(
        { issueId: 'ex-2', issueKey: 'EX-2', type: 'REWORK', reason: 'Requirement scope expansion' },
        {},
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

      // Falls back to asApp when asUser fails to persist exception
      mockRequestJira
        .mockRejectedValueOnce(new Error('User forbidden'))
        .mockResolvedValueOnce({ status: 200 });

      const resFallback = await recordException(
        { issueId: 'ex-fb', type: 'CODE', reason: 'Technical Spike' },
        {},
        mockStorage
      );
      expect(resFallback.success).toBe(true);
    });

    it('handles network error in linkDecision', async () => {
      mockRequestJira.mockRejectedValueOnce(new Error('Connection dropped'));
      const res = await linkDecision({
        issueId: 'iss-1',
        url: 'https://confluence.com/adr',
        title: 'ADR'
      });
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

    const score = await getIssueAlignment({ issueId: 'sec-1' }, {}, storage);
    expect(score.issueKey).toBe('SEC-1');
    expect(score.gates.intent).toBe('BLOCKED');
    expect(score.codeScore).toBe(0);
  });
});
