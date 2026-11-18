/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * TASK-00006: a resolver never lets an error reach the Forge runtime, which would log its message and stack. A
 * refusal comes back as a typed result and writes nothing to the error log; a real failure is logged by name only
 * and comes back as INTERNAL_FAILURE, which the UI raises again on the client, so the screen text is unchanged.
 *
 * @author Fahim Farook
 */

const requestJira = jest.fn();
const kvsGet = jest.fn();
const invoke = jest.fn();

jest.mock('@forge/api', () => ({
  __esModule: true,
  default: { asApp: () => ({ requestJira }), asUser: () => ({ requestJira }) },
  route: (strings: any, ...values: any[]) =>
    strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] !== undefined ? values[i] : ''), ''),
  privacy: { reportPersonalData: jest.fn() }
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: kvsGet }, WhereConditions: { beginsWith: (v: string) => ({ condition: 'BEGINS_WITH', value: v }) } }));
jest.mock('@forge/bridge', () => ({ invoke }));

import { handler } from '../src/index';
import { guardResolver, internalFailure, isInternalFailure, INTERNAL_FAILURE_CODE } from '../src/service/resolver-boundary';
import { callResolver, ResolverFailure } from '../src/frontend/call';

const SECRET = 'PROD-10 Critical security fix';
const caller = { principal: { accountId: 'admin-1' } };

function permissions(admin: boolean) {
  return { status: 200, headers: { get: () => null }, json: async () => ({ permissions: { ADMINISTER: { havePermission: admin } } }) };
}

/** Calls the registered resolver as the Forge runtime does: the caller comes from the runtime payload. */
const call = (functionKey: string, payload: any = {}) => (handler as any)({ call: { functionKey, payload }, context: {} }, caller);

describe('TASK-00006 resolver boundary', () => {
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    requestJira.mockReset();
    kvsGet.mockReset();
    invoke.mockReset();
    errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => errorLog.mockRestore());

  it('returns a refusal as a typed result and writes nothing to the error log', async () => {
    requestJira.mockResolvedValue(permissions(false));
    await expect(call('approver-policy-get-api')).resolves.toMatchObject({
      ok: false,
      code: 'NOT_ADMIN',
      message: 'Only a Jira admin can change who can seal.'
    });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('returns a storage failure as INTERNAL_FAILURE instead of throwing, and logs its name only', async () => {
    requestJira.mockResolvedValue(permissions(true));
    kvsGet.mockRejectedValue(new Error(`storage down while reading ${SECRET}`));
    const result = await call('approver-policy-get-api');
    expect(isInternalFailure(result)).toBe(true);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalledWith('LedgerSeal: resolver approver-policy-get-api failed: Error');
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(SECRET);
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });

  it('passes a result through unchanged and turns a throw into the typed failure', async () => {
    const ok = { ok: true, value: 1 };
    await expect(guardResolver('x', async () => ok)({})).resolves.toBe(ok);
    await expect(guardResolver('x', async () => { throw Object.assign(new TypeError(SECRET), { status: 503 }); })({})).resolves.toEqual(internalFailure());
    expect(errorLog).toHaveBeenCalledWith('LedgerSeal: resolver x failed: TypeError status=503');
    expect(isInternalFailure({ ok: false, code: 'NOT_ADMIN' })).toBe(false);
    expect(isInternalFailure(null)).toBe(false);
    expect(isInternalFailure({ ok: false, code: INTERNAL_FAILURE_CODE })).toBe(true);
  });

  it('UI: raises INTERNAL_FAILURE again on the client, so the caller shows its own failure text', async () => {
    invoke.mockResolvedValueOnce(internalFailure());
    await expect(callResolver('seal-issue-api', {})).rejects.toBeInstanceOf(ResolverFailure);
    invoke.mockResolvedValueOnce(internalFailure());
    await expect(callResolver('seal-issue-api')).rejects.toThrow('LedgerSeal: seal-issue-api failed');
  });

  it('UI: passes a refusal through, so the caller shows its message as before', async () => {
    const refusal = { ok: false, code: 'ISSUE_CHANGED', message: 'The issue changed since you opened it. Nothing was saved. Refresh, review the issue, and seal again.' };
    invoke.mockResolvedValueOnce(refusal);
    await expect(callResolver('seal-issue-api', { viewHash: 'h' })).resolves.toBe(refusal);
    expect(invoke).toHaveBeenCalledWith('seal-issue-api', { viewHash: 'h' });
  });
});
