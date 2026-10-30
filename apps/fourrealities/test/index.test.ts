import {
  getProjectDashboard,
  getIssueAlignment,
  recordIssueSignals,
  renderProjectPage,
  renderIssuePanel,
  handler,
  setGlobalStorageProvider,
  resolveStorage,
  fetchLiveProjectAudit
} from '../src/index';
import { StorageProvider } from '../src/storage/metrics-repository';
import { RealitySignals } from '../src/domain/models';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({
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
    it('queries Jira and parses issues with entity properties', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          issues: [
            {
              id: '1001',
              key: 'PROJ-1',
              fields: {
                summary: 'Feature one',
                status: { statusCategory: { key: 'done' } },
                issuelinks: [{ id: 'link-1' }]
              },
              properties: {
                'ledgerseal-cert': { status: 'SEAL_VALID' },
                'definitionguard-dod': { isFullySatisfied: true }
              }
            },
            {
              id: '1002',
              key: 'PROJ-2',
              fields: {
                summary: 'Task two',
                status: { statusCategory: { key: 'indeterminate' } },
                issuelinks: []
              },
              properties: {}
            }
          ]
        })
      });

      const { signals } = await fetchLiveProjectAudit('PROJ');
      expect(signals.length).toBe(2);
      expect(signals[0].hasCryptographicSeal).toBe(true);
      expect(signals[0].isDoDSatisfied).toBe(true);
      expect(signals[1].hasCryptographicSeal).toBe(false);
      expect(signals[1].isDoDSatisfied).toBe(false);
    });

    it('queries Jira with pullrequest data and parses PR review status', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          issues: [
            {
              id: '1005',
              key: 'PROJ-5',
              fields: {
                summary: 'PR issue',
                issuelinks: [{ id: 'link-5' }],
                customfield_10000: '{pullrequest={dataType=pullrequest, state=MERGED}}'
              },
              properties: {}
            }
          ]
        })
      });

      const { signals } = await fetchLiveProjectAudit('PROJ');
      expect(signals.length).toBe(1);
      expect(signals[0].prCount).toBe(1);
      expect(signals[0].hasApprovedReview).toBe(true);
    });

    it('returns error on Jira fetch non-200 or failure', async () => {
      mockRequestJira.mockResolvedValueOnce({ status: 500 });
      const { signals, error } = await fetchLiveProjectAudit('ERR');
      expect(signals).toEqual([]);
      expect(error).toContain('HTTP 500');

      mockRequestJira.mockRejectedValueOnce(new Error('Network failure'));
      const signalsErr = await fetchLiveProjectAudit('ERR2');
      expect(signalsErr.signals).toEqual([]);
      expect(signalsErr.error).toContain('Network failure');
    });
  });

  describe('Storage resolution', () => {
    it('throws error when storage provider is not set', async () => {
      setGlobalStorageProvider(null as any);
      await expect(getProjectDashboard({ projectKey: 'FAIL' })).rejects.toThrow(
        'FourRealities: StorageProvider must be initialized.'
      );
      setGlobalStorageProvider(mockStorage);
    });
  });

  describe('getProjectDashboard', () => {
    it('computes live snapshot when Jira returns issues', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          issues: [
            {
              id: '1001',
              key: 'PROJ-1',
              fields: {
                summary: 'Feature one',
                status: { statusCategory: { key: 'done' } },
                issuelinks: [{ id: 'link-1' }]
              },
              properties: {
                'ledgerseal-cert': { status: 'SEAL_VALID' },
                'definitionguard-dod': { isFullySatisfied: true }
              }
            }
          ]
        })
      });

      const snap = await getProjectDashboard({ projectKey: 'PROJ' }, { accountId: 'user-live' }, mockStorage);
      expect(snap.projectKey).toBe('PROJ');
      expect(snap.issueScores.length).toBe(1);
      expect(snap.summary.totalAuditedIssues).toBe(1);
    });

    it('initializes baseline snapshot on first request when empty and returns existing on second', async () => {
      mockRequestJira.mockRejectedValue(new Error('Jira unavailable'));
      const snap1 = await getProjectDashboard({ projectKey: 'PROJ' }, { accountId: 'user-1' }, mockStorage);
      expect(snap1.projectKey).toBe('PROJ');
      expect(snap1.summary.totalAuditedIssues).toBe(0);

      const snap2 = await getProjectDashboard({ projectKey: 'PROJ' }, {}, mockStorage);
      expect(snap2.snapshotId).toBe(snap1.snapshotId);
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

    it('returns default alignment score when issue signals not yet recorded', async () => {
      const score = await getIssueAlignment({ issueId: 'issue-10', issueKey: 'TEST-10' }, {}, mockStorage);
      expect(score.issueKey).toBe('TEST-10');
      expect(score.riskLevel).toBe('CRITICAL');
    });

    it('returns evaluated score when issue signals exist', async () => {
      const signals: RealitySignals = {
        issueId: 'issue-20',
        issueKey: 'TEST-20',
        hasDocumentedIntent: true,
        transitionCount: 1,
        regressionCount: 0,
        prCount: 1,
        hasApprovedReview: true,
        hasCryptographicSeal: true,
        isDoDSatisfied: true
      };

      await recordIssueSignals({ signals, projectKey: 'TEST' }, {}, mockStorage);
      const score = await getIssueAlignment({ issueId: 'issue-20' }, {}, mockStorage);
      expect(score.issueKey).toBe('TEST-20');
      expect(score.realityAlignmentIndex).toBe(100);
      expect(score.riskLevel).toBe('LOW');
    });
  });

  describe('recordIssueSignals', () => {
    it('throws error when signals are missing or invalid', async () => {
      await expect(recordIssueSignals({}, {}, mockStorage)).rejects.toThrow('Valid issue signals required.');
      await expect(recordIssueSignals({ signals: { issueId: '' } }, {}, mockStorage)).rejects.toThrow(
        'Valid issue signals required.'
      );
    });

    it('records signals and updates project snapshot when projectKey is supplied', async () => {
      const signals: RealitySignals = {
        issueId: 'issue-30',
        issueKey: 'TEST-30',
        hasDocumentedIntent: true,
        transitionCount: 1,
        regressionCount: 0,
        prCount: 1,
        hasApprovedReview: true,
        hasCryptographicSeal: false,
        isDoDSatisfied: true
      };

      const score = await recordIssueSignals({ signals, projectKey: 'PROJ-REC' }, { accountId: 'recorder' }, mockStorage);
      expect(score.issueKey).toBe('TEST-30');

      // Update same issue to trigger replacing in snapshot
      const updatedSignals: RealitySignals = {
        ...signals,
        hasCryptographicSeal: true
      };
      const score2 = await recordIssueSignals({ signals: updatedSignals, projectKey: 'PROJ-REC' }, {}, mockStorage);
      expect(score2.realityAlignmentIndex).toBe(100);
    });

    it('rejects cross-project modification to prevent poisoning (H3)', async () => {
      await expect(
        recordIssueSignals(
          { signals: { issueId: '9', issueKey: 'FIN-9' }, projectKey: 'FIN' },
          { extension: { project: { key: 'PROJ' } } },
          mockStorage
        )
      ).rejects.toThrow('Forbidden. Cannot record signals for project');
    });

    it('returns cached snapshot with warning when Jira fails after initial success', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ issues: [] })
      });
      const snap1 = await getProjectDashboard({ projectKey: 'PROJ-CACHED' }, {}, mockStorage);

      mockRequestJira.mockResolvedValueOnce({ status: 503 });
      const snap2 = await getProjectDashboard({ projectKey: 'PROJ-CACHED' }, {}, mockStorage);
      expect(snap2.snapshotId).toBe(snap1.snapshotId);
      expect(snap2.warning).toContain('HTTP 503');
    });

    it('creates initial baseline snapshot with warning when Jira fails on first attempt', async () => {
      mockRequestJira.mockResolvedValueOnce({ status: 500 });
      const snap = await getProjectDashboard({ projectKey: 'PROJ-FRESH-FAIL' }, {}, mockStorage);
      expect(snap.projectKey).toBe('PROJ-FRESH-FAIL');
      expect(snap.warning).toContain('No cached snapshot available');
    });

    it('throws error when project key cannot be determined from signals', async () => {
      await expect(
        recordIssueSignals({ signals: { issueId: '99', issueKey: 'NOPROJECT' } }, {}, mockStorage)
      ).rejects.toThrow('Project key required.');
    });

    it('fetches live Jira issue and parses PR data in getIssueAlignment', async () => {
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          id: 'live-iss-1',
          key: 'LIVE-1',
          fields: {
            summary: 'Live Issue',
            issuelinks: [
              {
                id: '1',
                type: { outward: 'is documented by' },
                outwardIssue: { fields: { summary: '[ADR] System Architecture' } }
              }
            ],
            customfield_10000: '{pullrequest={dataType=pullrequest, state=MERGED}}'
          },
          properties: {
            'ledgerseal-cert': { status: 'SEAL_VALID' },
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
  });

  describe('renderProjectPage and renderIssuePanel', () => {
    it('returns project page module metadata', async () => {
      const res = await renderProjectPage({ some: 'context' });
      expect(res.moduleKey).toBe('fourrealities-project-dashboard');
    });

    it('returns issue panel module metadata', async () => {
      const res = await renderIssuePanel({ some: 'context' });
      expect(res.moduleKey).toBe('fourrealities-issue-panel');
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

    it('dispatches getIssueAlignment', async () => {
      const res: any = await handler({
        call: {
          functionKey: 'getIssueAlignment',
          payload: { issueId: 'disp-issue', issueKey: 'DISP-1' }
        }
      } as any);
      expect(res.issueKey).toBe('DISP-1');
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

      const resIssue: any = await handler({
        call: { functionKey: 'getIssueAlignment' },
        context: { extension: { issue: { id: 'ctx-i', key: 'CTX-I' } } }
      } as any);
      expect(resIssue.issueKey).toBe('CTX-I');
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

    it('covers analyzeIssueChangelog and evaluateDocumentedIntent', () => {
      const { analyzeIssueChangelog, evaluateDocumentedIntent } = require('../src/index');

      // analyzeIssueChangelog
      expect(analyzeIssueChangelog(null)).toEqual({ transitionCount: 1, regressionCount: 0 });
      expect(analyzeIssueChangelog({})).toEqual({ transitionCount: 1, regressionCount: 0 });
      expect(analyzeIssueChangelog({ histories: [{ items: null }] })).toEqual({ transitionCount: 1, regressionCount: 0 });

      // Forward progression
      const forwardChangelog = {
        histories: [
          { items: [{ field: 'status', fromString: 'Open', toString: 'In Progress' }] },
          { items: [{ field: 'status', fromString: 'In Progress', toString: 'Done' }] }
        ]
      };
      expect(analyzeIssueChangelog(forwardChangelog)).toEqual({ transitionCount: 2, regressionCount: 0 });

      // Backward rework loop
      const reworkChangelog = {
        histories: [
          { items: [{ field: 'status', fromString: 'In Progress', toString: 'Done' }] },
          { items: [{ field: 'status', fromString: 'Done', toString: 'Reopened' }] }
        ]
      };
      expect(analyzeIssueChangelog(reworkChangelog)).toEqual({ transitionCount: 2, regressionCount: 1 });

      // evaluateDocumentedIntent
      expect(evaluateDocumentedIntent(null)).toBe(false);
      expect(evaluateDocumentedIntent([])).toBe(false);

      // Remote links
      expect(evaluateDocumentedIntent([], [{ url: 'https://confluence.example.com/pages/1' }])).toBe(true);
      expect(evaluateDocumentedIntent([], [{ title: 'System Architecture Specification' }])).toBe(true);
      expect(evaluateDocumentedIntent([], [{ url: 'https://google.com', title: 'Search Engine' }])).toBe(false);

      // Generic issue links (no ADR)
      expect(evaluateDocumentedIntent([{ type: { inward: 'relates to' }, inwardIssue: { fields: { summary: 'Fix typo' } } }])).toBe(false);

      // Link type doc keyword
      expect(evaluateDocumentedIntent([{ type: { outward: 'specifies requirement' } }])).toBe(true);

      // Issue summary keywords
      expect(evaluateDocumentedIntent([{ inwardIssue: { fields: { summary: '[SPEC] Payment API' } } }])).toBe(true);
      expect(evaluateDocumentedIntent([{ outwardIssue: { fields: { summary: '[ARCH] Event Mesh' } } }])).toBe(true);
      expect(evaluateDocumentedIntent([{ inwardIssue: { fields: { summary: '[RFC] Auth Flow' } } }])).toBe(true);
      expect(evaluateDocumentedIntent([{ outwardIssue: { fields: { summary: 'Software Design Document' } } }])).toBe(true);

      // Issue type keyword
      expect(evaluateDocumentedIntent([{ inwardIssue: { fields: { issuetype: { name: 'Architecture Decision' } } } }])).toBe(true);
    });

    it('covers fetchLiveProjectAudit and getIssueAlignment fallbacks and camelCase properties', async () => {
      // camelCase entity properties and compromised certificates
      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          issues: [
            {
              id: 'comp-1',
              key: 'COMP-1',
              fields: { summary: 'Compromised Seal Issue' },
              properties: {
                ledgersealCert: { status: 'SEAL_VALID', isCompromised: true },
                definitionguardDod: { satisfied: true }
              }
            }
          ]
        })
      });

      const { signals } = await fetchLiveProjectAudit('COMP');
      expect(signals.length).toBe(1);
      expect(signals[0].hasCryptographicSeal).toBe(false); // Compromised seal is not valid
      expect(signals[0].isDoDSatisfied).toBe(true);

      // getProjectDashboard sync failure with existing cached snapshot
      mockRequestJira.mockResolvedValueOnce({ status: 500 });
      await mockStorage.set('fr:project:SYNC-FAIL:latest', {
        snapshotId: 'cached-snap',
        projectKey: 'SYNC-FAIL',
        summary: { totalAuditedIssues: 5 }
      });

      const cachedDashboard = await getProjectDashboard({ projectKey: 'SYNC-FAIL' }, {}, mockStorage);
      expect(cachedDashboard.warning).toContain('Live Jira sync failed');
      expect(cachedDashboard.snapshotId).toBe('cached-snap');

      // getProjectDashboard sync failure with no cached snapshot
      mockRequestJira.mockResolvedValueOnce({ status: 500 });
      const freshFallback = await getProjectDashboard({ projectKey: 'NO-CACHE' }, {}, mockStorage);
      expect(freshFallback.warning).toContain('Live Jira sync failed');
      expect(freshFallback.summary.totalAuditedIssues).toBe(0);

      // getIssueAlignment with remotelink
      mockRequestJira
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ({
            id: 'remote-iss-1',
            key: 'REM-1',
            fields: { summary: 'Issue with remote link' },
            properties: {}
          })
        })
        .mockResolvedValueOnce({
          status: 200,
          json: async () => ([{ object: { url: 'https://asymm.atlassian.net/wiki/spaces/ARCH' } }])
        });

      const alignRes = await getIssueAlignment({ issueId: 'remote-iss-1' }, {}, mockStorage);
      expect(alignRes.intentScore).toBe(100);
    });
  });
});
