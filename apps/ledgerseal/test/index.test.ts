import { validateTransition, sealIssue, verifyIssue, renderIssuePanel, setGlobalStorageProvider } from '../src/index';

const sampleIssue = {
  id: '10001',
  key: 'PROD-10',
  fields: {
    project: { key: 'PROD' },
    issuetype: { name: 'Bug' },
    status: { name: 'Done' },
    summary: 'Critical security fix'
  }
};

const mockRequestJira = jest.fn().mockImplementation(async (path: string) => {
  if (path && path.includes('/user')) {
    return {
      status: 200,
      json: async () => ({ displayName: 'Lead Engineer', emailAddress: 'lead@example.com' })
    };
  }
  return {
    status: 200,
    json: async () => sampleIssue
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

class MockStorage {
  private data = new Map<string, any>();
  async get(key: string) { return this.data.get(key) || null; }
  async set(key: string, val: any) { this.data.set(key, JSON.parse(JSON.stringify(val))); }
  async delete(key: string) { this.data.delete(key); }
}

describe('Forge Function Entry Points (index.ts)', () => {
  let storage: MockStorage;

  const sampleSig = {
    signerAccountId: 'acc-1',
    signerDisplayName: 'Lead Engineer',
    signedAt: '2026-10-28T12:00:00Z',
    meaning: 'Approved for deployment',
    reasonCode: 'APPROVAL' as const,
    declarationText: 'Code reviewed and verified.'
  };

  beforeEach(() => {
    storage = new MockStorage();
    setGlobalStorageProvider(storage);
  });

  describe('sealIssue', () => {
    it('successfully seals an issue and stores certificate', async () => {
      const result = await sealIssue({ issue: sampleIssue, signature: sampleSig });
      expect(result.success).toBe(true);
      expect(result.certificateId).toBeDefined();
      expect(result.snapshotHash).toHaveLength(64);

      const storedCert = await storage.get('cert:active:10001');
      expect(storedCert).not.toBeNull();
      expect(storedCert.snapshotHash).toBe(result.snapshotHash);
    });

    it('throws error if issue or signature is missing', async () => {
      await expect(sealIssue({ issue: null, signature: sampleSig })).rejects.toThrow('Invalid seal request');
      await expect(sealIssue({ issue: sampleIssue, signature: null })).rejects.toThrow('Invalid seal request');
    });

    it('enforces reauth confirmation outside test mode', async () => {
      const prevEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        await expect(sealIssue({ issue: sampleIssue, signature: { ...sampleSig, reauthConfirmation: '' } })).rejects.toThrow(
          'Signer authentication challenge required'
        );
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });
  });

  describe('verifyIssue', () => {
    it('returns SEAL_VALID when live issue matches sealed state', async () => {
      await sealIssue({ issue: sampleIssue, signature: sampleSig });
      const analysis = await verifyIssue({ issue: sampleIssue });
      expect(analysis.status).toBe('SEAL_VALID');
    });

    it('returns SEAL_COMPROMISED when issue was previously tampered and reverted', async () => {
      await sealIssue({ issue: sampleIssue, signature: sampleSig });
      const storedCert = await storage.get('cert:active:10001');
      storedCert.isCompromised = true;
      storedCert.tamperHistory = [{ detectedAt: '2026-10-30T00:00:00Z', alteredFields: ['Summary'], liveHash: 'x', sealedHash: 'y', incidentType: 'ACTIVE_TAMPER' }];
      await storage.set('cert:active:10001', storedCert);

      const analysis = await verifyIssue({ issue: sampleIssue });
      expect(analysis.status).toBe('SEAL_COMPROMISED');
      expect(analysis.isCompromised).toBe(true);
    });

    it('returns SEAL_BROKEN when live issue has been modified', async () => {
      await sealIssue({ issue: sampleIssue, signature: sampleSig });

      const modifiedIssue = {
        ...sampleIssue,
        fields: {
          ...sampleIssue.fields,
          summary: 'Tampered summary'
        }
      };

      mockRequestJira.mockImplementationOnce(async () => ({
        status: 200,
        json: async () => modifiedIssue
      }));

      const analysis = await verifyIssue({ issue: modifiedIssue });
      expect(analysis.status).toBe('SEAL_BROKEN');
      expect(analysis.tamperedFields).toHaveLength(1);
    });

    it('throws error if issue is missing', async () => {
      await expect(verifyIssue({ issue: null })).rejects.toThrow('Missing issue');
    });
  });

  describe('validateTransition', () => {
    it('returns result=true when seal is valid and untampered', async () => {
      await sealIssue({ issue: sampleIssue, signature: sampleSig });
      const res = await validateTransition({ issue: sampleIssue });
      expect(res.result).toBe(true);
      expect((res as any).details).toBeUndefined();
    });

    it('returns result=false when issue is not sealed', async () => {
      const res = await validateTransition({ issue: sampleIssue });
      expect(res.result).toBe(false);
      expect(res.errorMessage).toContain('must be cryptographically sealed');
    });

    it('returns result=false when issueId is missing', async () => {
      const res = await validateTransition({});
      expect(res.result).toBe(false);
      expect(res.errorMessage).toContain('Missing issue context');
    });
  });

  describe('renderIssuePanel', () => {
    it('returns panel configuration', async () => {
      const res = await renderIssuePanel({ platformContext: { issueId: '10001' } });
      expect(res.moduleKey).toBe('ledgerseal-panel');
      expect(res.context).toBeDefined();
    });
  });
});
