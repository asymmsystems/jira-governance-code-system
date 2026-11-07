/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import { validateTransition, sealIssue, verifyIssue, handler } from '../src/index';
import { FakeJira, MemoryStore, panelContext, sampleIssue as fakeIssue, validSignature, model } from './support/fakes';

jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asApp: jest.fn(), asUser: jest.fn() },
  route: (strings: any, ...values: any[]) =>
    strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => ({ condition: 'BEGINS_WITH', value: v }) } }));

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

describe('Forge Function Entry Points (index.ts)', () => {
  let storage: MemoryStore;
  let jira: FakeJira;
  const deps = () => ({ jira, storage });
  const ctx = panelContext('lead');

  const sampleSig = validSignature();

  beforeEach(() => {
    storage = new MemoryStore();
    jira = new FakeJira(JSON.parse(JSON.stringify(sampleIssue)));
    jira.approvers = new Set(['lead']);
    jira.currentUser = 'lead';
    jira.users = { lead: 'Lead Engineer' };
  });

  describe('sealIssue', () => {
    it('successfully seals an issue and stores certificate', async () => {
      const result: any = await sealIssue({ signature: sampleSig }, ctx, deps());
      expect(result.ok).toBe(true);
      expect(result.snapshotHash).toHaveLength(64);

      const stored = await model.workEffort(storage);
      expect(stored.attributes.snapshotHash).toBe(result.snapshotHash);
      // The seal names the signer by party token, and stores no account id and no name (ADR-011)
      expect(model.assignments(storage)[0].partyId).toBe(await model.token(storage, 'lead'));
      expect(JSON.stringify([...storage.map.entries()].filter(([k]) => !k.startsWith('ls3:party:')))).not.toMatch(/"lead"|Lead Engineer/);
      expect(jira.propertyWrites[0].body).toMatchObject({ status: 'SEAL_VALID', snapshotHash: result.snapshotHash });
    });

    it('returns an error result if signature or issue context is missing', async () => {
      await expect(sealIssue({ signature: null }, ctx, deps())).resolves.toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
      await expect(sealIssue({ signature: sampleSig }, { accountId: 'lead' }, deps())).resolves.toMatchObject({
        ok: false,
        code: 'MISSING_ISSUE'
      });
    });

    it('requires the declaration shown in the panel', async () => {
      await expect(sealIssue({ signature: { ...sampleSig, declarationText: 'Code reviewed and verified.' } }, ctx, deps())).resolves.toMatchObject({
        ok: false,
        code: 'DECLARATION_MISMATCH'
      });
    });

    it('writes nothing when Jira cannot be read', async () => {
      jira.failIssueGet = true;
      await expect(sealIssue({ signature: sampleSig }, ctx, deps())).resolves.toMatchObject({ ok: false, code: 'JIRA_UNREACHABLE' });
      expect(storage.sets).toEqual([]);
    });

    it('stores no signer name, and maps the token to the account in one key outside the records', async () => {
      await sealIssue({ signature: sampleSig }, ctx, deps());
      expect(model.statusRows(storage)[0].data).not.toHaveProperty('signerName');
      expect(storage.map.get(`ls3:party:${await model.token(storage, 'lead')}`)).toMatchObject({ accountId: 'lead' });
    });
  });

  describe('verifyIssue', () => {
    it('returns SEAL_VALID when live issue matches sealed state', async () => {
      await sealIssue({ signature: sampleSig }, ctx, deps());
      const analysis: any = await verifyIssue({}, ctx, deps());
      expect(analysis.status).toBe('SEAL_VALID');
    });

    it('returns SEAL_COMPROMISED when issue was previously tampered and reverted', async () => {
      await sealIssue({ signature: sampleSig }, ctx, deps());
      const original = jira.issue.fields.summary;
      jira.issue.fields.summary = 'Tampered summary';
      await verifyIssue({}, ctx, deps());
      jira.issue.fields.summary = original;

      const analysis: any = await verifyIssue({}, ctx, deps());
      expect(analysis.status).toBe('SEAL_COMPROMISED');
      expect(analysis.isCompromised).toBe(true);
    });

    it('returns SEAL_BROKEN when live issue has been modified', async () => {
      await sealIssue({ signature: sampleSig }, ctx, deps());
      jira.issue.fields.summary = 'Tampered summary';
      const analysis: any = await verifyIssue({}, ctx, deps());
      expect(analysis.status).toBe('SEAL_BROKEN');
      expect(analysis.tamperedFields).toHaveLength(1);
    });

    it('returns typed results if issue context is missing or Jira cannot be read', async () => {
      await expect(verifyIssue({}, { accountId: 'lead' }, deps())).resolves.toMatchObject({ ok: false, code: 'MISSING_ISSUE' });
      jira.failIssueGet = true;
      await expect(verifyIssue({}, ctx, deps())).resolves.toMatchObject({ status: 'ERROR', errorReason: 'JIRA_UNREACHABLE' });
    });
  });

  describe('validateTransition', () => {
    it('returns result=true when seal is valid and untampered', async () => {
      await sealIssue({ signature: sampleSig }, ctx, deps());
      const res = await validateTransition({ issue: { key: 'PROD-10' } }, {}, deps());
      expect(res).toEqual({ result: true });
    });

    it('returns result=false when issue is not sealed', async () => {
      const res = await validateTransition({ issue: { key: 'PROD-10' } }, {}, deps());
      expect(res.result).toBe(false);
      expect(res.errorMessage).toContain('this issue is not sealed');
    });

    it('returns result=false when issueId is missing', async () => {
      const res = await validateTransition({}, {}, deps());
      expect(res.result).toBe(false);
      expect(res.errorMessage).toContain('Missing issue context');
    });

    it('applies transition-screen modifiedFields before comparing', async () => {
      await sealIssue({ signature: sampleSig }, ctx, deps());
      const res = await validateTransition(
        { issue: { key: 'PROD-10' }, transition: { modifiedFields: { summary: 'Changed on the transition screen' } } },
        {},
        deps()
      );
      expect(res.result).toBe(false);
      expect(res.errorMessage).toContain('Summary');
    });
  });

  describe('resolver', () => {
    it('registers the panel resolvers', async () => {
      await expect(handler({ call: { functionKey: 'unknown-api', payload: {} }, context: ctx } as any)).rejects.toThrow('unknown-api');
      const noUser = { extension: { issue: { id: '10001' } } };
      await expect(handler({ call: { functionKey: 'verify-issue-api', payload: {} }, context: noUser } as any)).resolves.toMatchObject({
        code: 'NO_IDENTITY'
      });
      await expect(handler({ call: { functionKey: 'seal-issue-api', payload: {} }, context: noUser } as any)).resolves.toMatchObject({
        code: 'NO_IDENTITY'
      });
    });
  });

  describe('code signing resolvers (ADR-016)', () => {
    it.each(['signing-code-request-api', 'signing-policy-get-api', 'signing-policy-set-api', 'signing-alerts-api', 'signing-alert-ack-api', 'signing-unlock-api'])(
      'registers %s, which refuses a call without identity',
      async key => {
        const noUser = { extension: { issue: { id: '10001' } } };
        await expect(handler({ call: { functionKey: key, payload: {} }, context: noUser } as any)).resolves.toMatchObject({ ok: false, code: 'NO_IDENTITY' });
      }
    );
  });

  describe('code signing entry points', () => {
    it('pass the payload, context and deps to the flows', async () => {
      const { requestSigningCode, getSigningPolicy, setSigningPolicy, getSigningAlerts, ackSigningAlert, unlockSigning } = require('../src/index');
      const jira = new FakeJira(fakeIssue());
      const storage = new MemoryStore();
      const d = { jira, storage, secrets: storage };
      jira.currentUser = 'u';
      for (const call of [getSigningPolicy, setSigningPolicy, getSigningAlerts, ackSigningAlert, unlockSigning]) {
        await expect(call({}, { accountId: 'u' }, d)).resolves.toMatchObject({ ok: false, code: 'NOT_ADMIN' });
      }
      await expect(requestSigningCode({ action: 'SEAL' }, panelContext('u'), d)).resolves.toMatchObject({ ok: false, code: 'NOT_PART11' });
    });
  });

  describe('forgeDeps', () => {
    it('uses Forge KVS for storage and builds the Jira client with or without a user', async () => {
      const { kvs } = require('@forge/kvs');
      kvs.get = jest.fn().mockResolvedValue({ a: 1 });
      kvs.set = jest.fn().mockResolvedValue(undefined);
      kvs.delete = jest.fn().mockResolvedValue(undefined);
      const { forgeDeps } = require('../src/index');
      const withUser = forgeDeps(true);
      await expect(withUser.storage.get('k')).resolves.toEqual({ a: 1 });
      await withUser.storage.set('k', { b: 2 });
      await withUser.storage.delete('k');
      expect(kvs.set).toHaveBeenCalledWith('k', { b: 2 });
      expect(kvs.delete).toHaveBeenCalledWith('k');
      const api = require('@forge/api').default;
      expect(api.asUser).toHaveBeenCalled();
      api.asUser.mockClear();
      kvs.set = jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('exists')).mockRejectedValueOnce(new Error('kvs down'));
      kvs.get = jest.fn().mockResolvedValueOnce({ taken: true }).mockResolvedValueOnce(undefined);
      await expect(withUser.storage.createIfAbsent('e', 1)).resolves.toBe(true);
      expect(kvs.set).toHaveBeenCalledWith('e', 1, { keyPolicy: 'FAIL_IF_EXISTS' });
      await expect(withUser.storage.createIfAbsent('e', 1)).resolves.toBe(false);
      await expect(withUser.storage.createIfAbsent('e', 1)).rejects.toThrow('kvs down');
      const tx = { set: jest.fn(), execute: jest.fn().mockResolvedValue(undefined) };
      kvs.transact = jest.fn(() => tx);
      await withUser.storage.commit([{ key: 'a', value: 1 }, { key: 'b', value: 2 }]);
      expect(tx.set.mock.calls).toEqual([['a', 1], ['b', 2]]);
      expect(tx.execute).toHaveBeenCalledTimes(1);
      // query reads page after page with the cursor until there is none
      const builder: any = { where: jest.fn(() => builder), limit: jest.fn(() => builder), cursor: jest.fn(() => builder), getMany: jest.fn() };
      builder.getMany
        .mockResolvedValueOnce({ results: [{ key: 'p:1', value: 1 }], nextCursor: 'c2' })
        .mockResolvedValueOnce({ results: [{ key: 'p:2', value: 2 }] });
      kvs.query = jest.fn(() => builder);
      await expect(withUser.storage.query('p:')).resolves.toEqual([{ key: 'p:1', value: 1 }, { key: 'p:2', value: 2 }]);
      expect(builder.cursor).toHaveBeenCalledWith('c2');
      const appOnly = forgeDeps(false);
      await expect(appOnly.jira.hasApproverPermission('1')).resolves.toEqual({ ok: false, error: 'FORBIDDEN' });
      expect(api.asUser).not.toHaveBeenCalled();
    });

    it('passes a time to live to KVS and keeps secrets in the secret store (ADR-016, spike S-7)', async () => {
      const { kvs } = require('@forge/kvs');
      kvs.set = jest.fn().mockResolvedValue(undefined);
      const { forgeDeps } = require('../src/index');
      const deps = forgeDeps(false);
      expect(deps.secrets).toBe(deps.storage);
      await deps.storage.set('t', 1, { ttlSeconds: 60 });
      expect(kvs.set).toHaveBeenCalledWith('t', 1, { ttl: { value: 60, unit: 'SECONDS' } });
      await deps.storage.createIfAbsent('c', 2, { ttlSeconds: 5 });
      expect(kvs.set).toHaveBeenCalledWith('c', 2, { keyPolicy: 'FAIL_IF_EXISTS', ttl: { value: 5, unit: 'SECONDS' } });
      kvs.getSecret = jest.fn().mockResolvedValueOnce('s').mockResolvedValueOnce({ key: 'x' }).mockResolvedValueOnce(undefined);
      kvs.setSecret = jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('KEY_CONFLICT')).mockRejectedValueOnce(new Error('down'));
      await expect(deps.secrets.getSecret('k')).resolves.toBe('s');
      await expect(deps.secrets.createSecretIfAbsent('k', { key: 'x' })).resolves.toBe(true);
      expect(kvs.setSecret).toHaveBeenCalledWith('k', { key: 'x' }, { keyPolicy: 'FAIL_IF_EXISTS' });
      await expect(deps.secrets.createSecretIfAbsent('k', { key: 'y' })).resolves.toBe(false);
      await expect(deps.secrets.createSecretIfAbsent('k', { key: 'z' })).rejects.toThrow('down');
    });
  });
});
