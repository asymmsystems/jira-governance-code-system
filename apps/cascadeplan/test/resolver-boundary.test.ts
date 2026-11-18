/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * TASK-00006: a resolver never lets an error reach the Forge runtime, which would log its message and
 * stack. A refusal comes back as its typed result and writes no log line; a real failure is logged by
 * name only and comes back as INTERNAL_FAILURE, which the UI raises again on the client, so the screen
 * text is the same as when the call threw.
 */

const mockRequestJira = jest.fn();
const mockInvoke = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({ requestJira: (...a: any[]) => mockRequestJira(...a) }),
    asUser: () => ({ requestJira: (...a: any[]) => mockRequestJira(...a) })
  },
  route: (strings: any, ...values: any[]) => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));
jest.mock('@forge/bridge', () => ({ invoke: (...a: any[]) => mockInvoke(...a), router: {}, view: {} }));

import { adminHandler, guardResolver, handler, setGlobalStorageProvider } from '../src/index';
import { internalFailure, isInternalFailure, ResolverFailure } from '../src/ui/result';
import { callResolver } from '../src/frontend/bridge';
import { MemStorage } from './helpers/mem-storage';

const SECRET = 'TEST-7 Confidential release plan';
const PROJECT = { extension: { project: { key: 'TEST', id: 'TEST' } } };

class FailingStorage extends MemStorage {
  async get<T>(): Promise<T | undefined> {
    throw new Error(`storage down while reading ${SECRET}`);
  }
}

describe('TASK-00006 resolver boundary', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    mockRequestJira.mockReset();
    mockRequestJira.mockResolvedValue({ status: 200, json: async () => ({ permissions: { ADMINISTER: { havePermission: true } }, issues: [], values: [], groups: [] }) });
    mockInvoke.mockReset();
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
    setGlobalStorageProvider(new MemStorage());
  });

  it('returns a refusal as its typed result and writes no log line', async () => {
    setGlobalStorageProvider(new MemStorage());
    const res: any = await handler({ call: { functionKey: 'getProjectPlan' }, context: {} } as any);
    expect(res).toMatchObject({ ok: false, error: 'validation' });
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('returns a storage failure of a planner resolver as INTERNAL_FAILURE instead of throwing, and logs its name only', async () => {
    setGlobalStorageProvider(new FailingStorage());
    const res = await handler({ call: { functionKey: 'getProjectPlan', payload: {} }, context: PROJECT } as any);
    expect(isInternalFailure(res)).toBe(true);
    const lines = JSON.stringify([...warn.mock.calls, ...error.mock.calls]);
    expect(lines).toContain('cascadeplan resolver getProjectPlan: Error');
    expect(lines).not.toContain(SECRET);
  });

  it('does the same for the admin page resolvers', async () => {
    setGlobalStorageProvider(new FailingStorage());
    const res = await adminHandler({ call: { functionKey: 'approver-policy-get-api', payload: {} }, context: {} } as any, { principal: { accountId: 'admin' } });
    expect(res).toEqual(internalFailure());
    expect(JSON.stringify(warn.mock.calls)).toContain('cascadeplan resolver approver-policy-get-api: Error');
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SECRET);
  });

  it('passes a result through unchanged and turns a throw into the typed failure', async () => {
    const ok = { ok: true };
    await expect(guardResolver('x', async () => ok)({})).resolves.toBe(ok);
    await expect(guardResolver('x', async () => { throw Object.assign(new TypeError(SECRET), { status: 503 }); })({})).resolves.toEqual(internalFailure());
    expect(warn.mock.calls).toEqual([['cascadeplan resolver x: HTTP 503']]);
    expect(isInternalFailure(null)).toBe(false);
    expect(isInternalFailure({ ok: false, error: 'validation' })).toBe(false);
    expect(new ResolverFailure('x').message).toBe('');
  });

  it('UI: an INTERNAL_FAILURE takes the path of a thrown call, with the same fallback text', async () => {
    mockInvoke.mockResolvedValueOnce(internalFailure());
    const res = await callResolver('getProjectPlan', {});
    expect(res).toEqual({ ok: false, success: false, error: 'unavailable', message: 'The planner could not reach Jira.' });
  });
});
