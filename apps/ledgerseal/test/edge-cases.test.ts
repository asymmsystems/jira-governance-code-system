import { canonicalizeIssueState, canonicalizeValue } from '../src/domain/canonicalizer';
import { analyzeTamperState } from '../src/domain/tamper-detector';
import { generateSealCertificate } from '../src/domain/crypto';
import { validateTransition, sealIssue, setGlobalStorageProvider, handler, renderIssuePanel, resolveStorage } from '../src/index';
import { CanonicalIssueSnapshot, ElectronicSignature } from '../src/domain/models';
import { SealRepository } from '../src/storage/seal-repository';

class EmptyStorage {
  async get(key: string) { return null; }
  async set(key: string, val: any) {}
  async delete(key: string) {}
}

class MemoryStorage {
  private map = new Map<string, any>();
  async get(key: string) { return this.map.has(key) ? this.map.get(key) : null; }
  async set(key: string, val: any) { this.map.set(key, val); }
  async delete(key: string) { this.map.delete(key); }
}

const mockRequestJira = jest.fn().mockImplementation(async (path: string) => {
  if (path && path.includes('/user')) {
    return {
      status: 200,
      json: async () => ({ displayName: 'Default User', emailAddress: 'user@example.com' })
    };
  }
  return {
    status: 200,
    json: async () => ({ id: '10001', key: 'PROJ-1', fields: { summary: 'Mock Issue' } })
  };
});

jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({
      requestJira: mockRequestJira
    })
  },
  route: (strings: any, ...values: any[]) =>
    strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));

jest.mock('@forge/kvs', () => ({
  kvs: {
    get: jest.fn().mockResolvedValue('mock-val'),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('Edge Cases and Branch Coverage', () => {
  it('handles functions and symbols in canonicalizeValue returning null', () => {
    expect(canonicalizeValue(() => {})).toBeNull();
    expect(canonicalizeValue(Symbol('sym'))).toBeNull();
  });

  it('handles excluded fields like comment and worklog in canonicalizer', () => {
    const rawIssue = {
      id: '100',
      key: 'TEST-1',
      fields: {
        comment: { comments: [] },
        worklog: { worklogs: [] },
        summary: 'Test issue'
      }
    };
    const snapshot = canonicalizeIssueState(rawIssue, '2026-10-28T00:00:00Z');
    expect(snapshot.fields.some(f => f.id === 'comment')).toBe(false);
    expect(snapshot.fields.some(f => f.id === 'worklog')).toBe(false);
  });

  it('handles field deletion in live snapshot where field existed in sealed state', () => {
    const baseSnapshot: CanonicalIssueSnapshot = {
      issueId: '1',
      issueKey: 'T-1',
      projectKey: 'T',
      issueType: 'Bug',
      status: 'Open',
      fields: [
        { id: 'custom_1', name: 'Custom One', type: 'string', value: 'Value 1' },
        { id: 'custom_2', name: 'Custom Two', type: 'string', value: 'Value 2' }
      ],
      attachments: [],
      capturedAt: '2026-10-28T00:00:00Z'
    };

    const sig: ElectronicSignature = {
      signerAccountId: '1',
      signerDisplayName: 'Lead',
      signedAt: '2026-10-28T00:00:00Z',
      meaning: 'Approve',
      reasonCode: 'APPROVAL',
      declarationText: 'Legal statement'
    };

    const cert = generateSealCertificate(baseSnapshot, sig);

    // Live snapshot is missing custom_2 completely
    const liveSnapshot: CanonicalIssueSnapshot = {
      ...baseSnapshot,
      fields: [
        { id: 'custom_1', name: 'Custom One', type: 'string', value: 'Value 1' }
      ]
    };

    const analysis = analyzeTamperState(cert, liveSnapshot, '2026-10-28T00:05:00Z');
    expect(analysis.status).toBe('SEAL_BROKEN');
    expect(analysis.tamperedFields.some(f => f.fieldId === 'custom_2' && f.liveValue === null)).toBe(true);
  });

  it('handles index.ts resolveStorage throwing error when no provider is set', async () => {
    setGlobalStorageProvider(null as any);
    await expect(validateTransition({ issue: { id: '123' } })).rejects.toThrow('StorageProvider must be initialized');
  });

  it('handles validateTransition with custom storageProvider passed directly and payload.issueId', async () => {
    const storage = new EmptyStorage();
    const res = await validateTransition({ issueId: '999', issue: { id: '999' } }, {}, storage);
    expect(res.result).toBe(false);
  });

  it('handles sealIssue with minimal signature exercising all default values', async () => {
    const storage = new EmptyStorage();
    const issue = { id: '123', key: 'TEST-123' };
    const minimalSig = {
      signerAccountId: 'acc-minimal',
      signerDisplayName: 'Minimal Signer'
    };
    const res = await sealIssue({ issue, signature: minimalSig }, {}, storage);
    expect(res.success).toBe(true);
  });

  it('handles getCertificateHistory returning empty array when no history exists', async () => {
    const storage = new EmptyStorage();
    const repo = new SealRepository(storage);
    const history = await repo.getCertificateHistory('non-existent');
    expect(history).toEqual([]);
  });

  it('exercises resolver handler functions', async () => {
    const storage = new EmptyStorage();
    setGlobalStorageProvider(storage);
    const issue = { id: '456', key: 'TEST-456' };

    // verify-issue-api via handler
    const verifyRes: any = await handler({
      call: { functionKey: 'verify-issue-api', payload: { issue } }
    } as any);
    expect(verifyRes.status).toBe('NO_SEAL');

    // seal-issue-api via handler
    const sealRes: any = await handler({
      call: {
        functionKey: 'seal-issue-api',
        payload: {
          issue,
          signature: { signerAccountId: 'user-1' }
        }
      }
    } as any);
    expect(sealRes.success).toBe(true);

    // renderIssuePanel
    const panel = await renderIssuePanel({ test: true });
    expect(panel.moduleKey).toBe('ledgerseal-panel');
  });

  it('exercises ForgeKvsProvider in production runtime mode', async () => {
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      setGlobalStorageProvider(null);
      const storage = resolveStorage();
      expect(storage).toBeDefined();
      await storage.set('key-1', { test: true });
      await storage.get('key-1');
      await storage.delete('key-1');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('propagates ForgeKvsProvider kvs get error without swallowing', async () => {
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      setGlobalStorageProvider(null);
      const { kvs } = require('@forge/kvs');
      (kvs.get as jest.Mock).mockRejectedValueOnce(new Error('KVS fail'));
      const storage = resolveStorage();
      await expect(storage.get('fail-key')).rejects.toThrow('KVS fail');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('handles resolver with context fallback for issue and accountId', async () => {
    const storage = new EmptyStorage();
    setGlobalStorageProvider(storage);
    const context = {
      extension: { issue: { id: 'ctx-1', key: 'CTX-1' } },
      accountId: 'ctx-user'
    };
    const verifyRes: any = await handler({
      call: { functionKey: 'verify-issue-api' },
      context
    } as any);
    expect(verifyRes.status).toBe('NO_SEAL');

    const sealRes: any = await handler({
      call: { functionKey: 'seal-issue-api', payload: { signature: {} } },
      context
    } as any);
    expect(sealRes.success).toBe(true);

    await expect(
      handler({
        call: { functionKey: 'verify-issue-api' },
        context: {}
      } as any)
    ).rejects.toThrow('Missing issue context');
  });

  describe('Jira API Integration & Key Resolution', () => {
    it('resolves issue and user via Jira API when present', async () => {
      mockRequestJira.mockImplementation(async (path: string) => {
        if (path.includes('/user')) {
          return {
            status: 200,
            json: async () => ({ displayName: 'Fahim Farook', emailAddress: 'fahim@asymm.systems' })
          };
        }
        if (path.includes('/issue/PROJ-10') || path.includes('/issue/10010')) {
          return {
            status: 200,
            json: async () => ({ id: '10010', key: 'PROJ-10', fields: { summary: 'Sample Issue' } })
          };
        }
        return { status: 404 };
      });

      const storage = new EmptyStorage();
      setGlobalStorageProvider(storage);

      const valResult = await validateTransition(
        { issue: { key: 'PROJ-10' } },
        {},
        storage
      );
      expect(valResult.result).toBe(false);
      expect(valResult.errorMessage).toContain('cryptographically sealed');

      const sealResult = await sealIssue(
        { signature: { meaning: 'Testing' } },
        { extension: { issue: { id: '10010', key: 'PROJ-10' } }, accountId: 'user-acc-1' },
        storage
      );
      expect(sealResult.success).toBe(true);
    });

    it('handles Jira API 404 or failure gracefully', async () => {
      mockRequestJira.mockRejectedValueOnce(new Error('Network error'));
      const storage = new EmptyStorage();
      setGlobalStorageProvider(storage);

      const valResult = await validateTransition(
        { issue: { key: 'FAIL-99' } },
        {},
        storage
      );
      expect(valResult.result).toBe(false);

      mockRequestJira.mockResolvedValueOnce({
        status: 200,
        json: async () => ({})
      });
      const user = await (require('../src/index').fetchJiraUser('user-no-name'));
      expect(user.displayName).toBe('Authorized User');
    });

    it('covers issuelinks, subtasks, priority, labels, components, and undefined values in canonicalizer', () => {
      const complexIssue = {
        id: '2000',
        key: 'PROJ-2000',
        fields: {
          summary: 'Complex summary',
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Hello   world' }]
              }
            ]
          },
          priority: { name: 'High' },
          labels: ['backend', 'security'],
          components: [{ name: 'Auth' }, { name: 'Audit' }],
          assignee: { accountId: 'acc-123', displayName: 'Jane Doe' },
          issuelinks: [
            { type: { name: 'blocks' }, outwardIssue: { key: 'PROJ-2' } },
            { type: { name: 'relates' }, inwardIssue: { key: 'PROJ-1' } }
          ],
          subtasks: [
            { key: 'PROJ-2002' },
            { id: 'sub-2001' }
          ],
          customfield_null: null,
          customfield_undef: undefined
        }
      };

      const snapshot = canonicalizeIssueState(complexIssue, '2026-10-29T10:00:00Z');
      expect(snapshot.fields.some(f => f.name === 'Priority')).toBe(true);
      expect(snapshot.fields.some(f => f.name === 'Labels')).toBe(true);
      expect(snapshot.fields.some(f => f.name === 'Components')).toBe(true);
      expect(snapshot.fields.some(f => f.name === 'Assignee')).toBe(true);
      expect(snapshot.fields.some(f => f.name === 'Linked Issues')).toBe(true);
      expect(snapshot.fields.some(f => f.name === 'Subtasks')).toBe(true);
      expect(snapshot.fields.some(f => f.id === 'customfield_null')).toBe(false);
      expect(snapshot.fields.some(f => f.id === 'customfield_undef')).toBe(false);
    });

    it('covers validateTransition with transition.modifiedFields', async () => {
      mockRequestJira.mockImplementation(async (path: string) => {
        if (path.includes('/user')) {
          return { status: 200, json: async () => ({ displayName: 'Signer' }) };
        }
        return {
          status: 200,
          json: async () => ({
            id: '5001',
            key: 'PROJ-5001',
            fields: { summary: 'Original Summary' }
          })
        };
      });

      const storage = new MemoryStorage();
      setGlobalStorageProvider(storage);

      // Seal issue first
      const sealRes = await sealIssue(
        { signature: { meaning: 'Testing' } },
        { extension: { issue: { id: '5001', key: 'PROJ-5001' } }, accountId: 'user-acc-1' },
        storage
      );
      expect(sealRes.success).toBe(true);

      // Transition payload with modifiedFields altering summary
      const tamperedTransition = await validateTransition(
        {
          issue: { id: '5001', key: 'PROJ-5001' },
          transition: {
            modifiedFields: {
              summary: 'Tampered Summary on Transition Screen'
            }
          }
        },
        {},
        storage
      );
      expect(tamperedTransition.result).toBe(false);
      expect(tamperedTransition.errorMessage).toContain('modified');
    });

    it('covers verifyIssue property update error handling and missing issue state', async () => {
      const { verifyIssue } = require('../src/index');

      // Test property update res.status >= 400
      mockRequestJira.mockImplementation(async (path: string, options?: any) => {
        if (path.includes('/properties/ledgerseal-cert')) {
          return { status: 500 };
        }
        return {
          status: 200,
          json: async () => ({ id: '6001', key: 'PROJ-6001', fields: { summary: 'Issue 6001' } })
        };
      });

      const storage = new MemoryStorage();
      setGlobalStorageProvider(storage);

      // Seal issue
      await sealIssue(
        { signature: { meaning: 'Testing' } },
        { extension: { issue: { id: '6001', key: 'PROJ-6001' } }, accountId: 'user-acc-1' },
        storage
      );

      // verifyIssue with status >= 400
      const verifyRes = await verifyIssue(
        {},
        { extension: { issue: { id: '6001', key: 'PROJ-6001' } } },
        storage
      );
      expect(verifyRes.status).toBe('SEAL_VALID');

      // Test property update throwing error
      mockRequestJira.mockImplementation(async (path: string) => {
        if (path.includes('/properties/ledgerseal-cert')) {
          throw new Error('Network error on property update');
        }
        return {
          status: 200,
          json: async () => ({ id: '6001', key: 'PROJ-6001', fields: { summary: 'Issue 6001' } })
        };
      });

      const verifyRes2 = await verifyIssue(
        {},
        { extension: { issue: { id: '6001', key: 'PROJ-6001' } } },
        storage
      );
      expect(verifyRes2.status).toBe('SEAL_VALID');

      // Test failure to fetch live issue
      mockRequestJira.mockImplementation(async () => ({ status: 404 }));
      await expect(
        verifyIssue({}, { extension: { issue: { id: '9999' } } }, storage)
      ).rejects.toThrow('Unable to retrieve authentic issue state');
    });
  });
});

