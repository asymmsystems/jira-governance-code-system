/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: TASK-00006. A resolver never lets an error reach the Forge runtime, which would log its message and
 * stack. A refusal comes back as its typed result and writes nothing to the error log; a real failure is logged by
 * name only and comes back as INTERNAL_FAILURE, which the UI raises again on the client, so the screen text is the
 * same as before.
 */

const mockUser = jest.fn();
const mockInvoke = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  getAppContext: () => ({}),
  default: { asUser: () => ({ requestJira: (...a: unknown[]) => mockUser(...a) }), asApp: () => ({ requestJira: (...a: unknown[]) => mockUser(...a) }) },
  route: (strings: TemplateStringsArray, ...values: unknown[]) => strings.reduce((acc, part, i) => acc + part + (i < values.length ? String(values[i]) : ''), ''),
  assumeTrustedRoute: (p: string) => p
}));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));
jest.mock('@forge/object-store', () => ({ __esModule: true, default: {} }));
jest.mock('@forge/events', () => ({ Queue: class { push = jest.fn(); } }));
jest.mock('@forge/bridge', () => ({ invoke: (...a: unknown[]) => mockInvoke(...a) }));

import { adminHandler, guardResolver, setGlobalStorageProvider } from '../src/index';
import { internalFailure, isInternalFailure, INTERNAL_FAILURE_CODE } from '../src/contract/data/errors';
import { callResolver, ResolverFailure } from '../src/frontend/call';
import { MemoryStorage } from './storage/memory-storage';

const SECRET = 'PAY-7 Saved cards and digital wallets';
const json = (status: number, body: unknown) => ({ status, json: async () => body, headers: { get: () => null } });
const ADMIN = { permissions: { ADMINISTER: { havePermission: true } } };
const NOT_ADMIN = { permissions: { ADMINISTER: { havePermission: false } } };
const RUNTIME = { principal: { accountId: '712020:admin' }, license: { isActive: true } };
const call = (functionKey: string) => (adminHandler as (e: unknown, r: unknown) => Promise<unknown>)({ call: { functionKey, payload: {} }, context: {} }, RUNTIME);

class FailingStorage extends MemoryStorage {
  async get<T>(): Promise<T | undefined> {
    throw new Error(`storage down while reading ${SECRET}`);
  }
}

describe('TASK-00006 resolver boundary', () => {
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    mockUser.mockReset();
    mockInvoke.mockReset();
    errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorLog.mockRestore();
    setGlobalStorageProvider(null);
  });

  it('returns a refusal as its typed result and writes nothing to the error log', async () => {
    setGlobalStorageProvider(new MemoryStorage());
    mockUser.mockResolvedValue(json(200, NOT_ADMIN));
    const res = (await call('fr-admin-get')) as { ok: boolean; error?: { code: string } };
    expect(res.ok).toBe(false);
    expect(res.error?.code).not.toBe(INTERNAL_FAILURE_CODE);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('returns a storage failure as INTERNAL_FAILURE instead of throwing, and logs its name only', async () => {
    setGlobalStorageProvider(new FailingStorage());
    mockUser.mockResolvedValue(json(200, ADMIN));
    const res = await call('fr-admin-get');
    expect(res).toEqual(internalFailure());
    expect(errorLog.mock.calls).toEqual([['FourRealities: resolver fr-admin-get failed: Error']]);
    expect(JSON.stringify(res)).not.toContain(SECRET);
  });

  it('passes a result through unchanged and turns a throw into the typed failure', async () => {
    const ok = { ok: true };
    await expect(guardResolver('x', async () => ok)({} as never)).resolves.toBe(ok);
    await expect(guardResolver('x', async () => { throw Object.assign(new TypeError(SECRET), { status: 503 }); })({} as never)).resolves.toEqual(internalFailure());
    expect(errorLog.mock.calls).toEqual([['FourRealities: resolver x failed: TypeError status=503']]);
    expect(isInternalFailure(null)).toBe(false);
    expect(isInternalFailure({ ok: false, error: { code: 'FORBIDDEN' } })).toBe(false);
  });

  it('UI: raises INTERNAL_FAILURE again on the client, so the caller shows its own failure text', async () => {
    mockInvoke.mockResolvedValueOnce(internalFailure());
    const err = await callResolver('fr-admin-get').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ResolverFailure);
    expect((err as Error).message).toBe('FourRealities: fr-admin-get failed');
  });

  it('UI: passes a refusal through, so the caller shows its message as before', async () => {
    const refusal = { ok: false, error: { code: 'FORBIDDEN', message: 'Only a Jira admin can change these settings.' } };
    mockInvoke.mockResolvedValueOnce(refusal);
    await expect(callResolver('fr-admin-save-sources', { sources: {} })).resolves.toBe(refusal);
    expect(mockInvoke).toHaveBeenCalledWith('fr-admin-save-sources', { sources: {} });
  });
});
