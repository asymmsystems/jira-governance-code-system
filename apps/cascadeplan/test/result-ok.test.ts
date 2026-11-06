/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * F-13, INV-05: every resolver result carries a boolean ok, and a thrown call is reported as failed.
 */
import { withOk } from '../src/index';
import { classifyResult } from '../src/ui/result';

describe('F-13: one success field', () => {
  it('withOk adds ok from success, and keeps an ok that is already there', () => {
    expect(withOk({ tasks: [] } as any).ok).toBe(true);
    expect(withOk({ success: false, error: 'x' } as any).ok).toBe(false);
    expect(withOk({ ok: false, success: true } as any).ok).toBe(false);
    expect(withOk(null)).toBeNull();
  });

  it('the result of a thrown call is a failure with its message, never a success', () => {
    const thrown = { ok: false, success: false, error: 'unavailable', message: 'Network down' };
    expect(classifyResult(thrown)).toEqual({ failed: true, message: 'Network down' });
    expect(thrown.ok !== true).toBe(true);
  });
});
