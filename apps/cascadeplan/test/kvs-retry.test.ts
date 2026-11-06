/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * C10: Forge storage rate limits are retried, then reported plainly.
 */
import { withKvsRetry, isRateLimited, StorageBusyError, setSleepForTests, withValidation } from '../src/index';

jest.mock('@forge/api', () => ({ __esModule: true, default: { asApp: jest.fn(), asUser: jest.fn() }, route: jest.fn() }));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

const limited = () => Object.assign(new Error('limit'), { code: 'RATE_LIMIT_EXCEEDED', responseDetails: { status: 429 } });

describe('C10: storage rate limits', () => {
  const waits: number[] = [];
  beforeEach(() => { waits.length = 0; setSleepForTests(async ms => { waits.push(ms); }); });

  it('recognises the codes and the status, not the class', () => {
    expect(isRateLimited(limited())).toBe(true);
    expect(isRateLimited({ code: 'TOO_MANY_REQUESTS' })).toBe(true);
    expect(isRateLimited({ status: 429 })).toBe(true);
    expect(isRateLimited(new Error('other'))).toBe(false);
  });

  it('retries twice and then succeeds', async () => {
    let n = 0;
    const res = await withKvsRetry(async () => { if (n++ < 2) throw limited(); return 'ok'; });
    expect(res).toBe('ok');
    expect(waits).toEqual([1000, 2000]);
  });

  it('gives up after three retries with a plain "busy" result, and runs nothing more', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    let n = 0;
    await expect(withKvsRetry(async () => { n++; throw limited(); })).rejects.toBeInstanceOf(StorageBusyError);
    expect(n).toBe(4);
    expect(waits).toEqual([1000, 2000, 4000]);
    const res: any = await withValidation(async () => { throw new StorageBusyError(); });
    expect(res).toEqual({ ok: false, success: false, error: 'busy', message: 'CascadePlan is busy. Try again in a minute.' });
  });

  it('does not retry other errors', async () => {
    await expect(withKvsRetry(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(waits).toEqual([]);
  });
});
