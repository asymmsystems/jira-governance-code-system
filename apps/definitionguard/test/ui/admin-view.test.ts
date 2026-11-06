/**
 * M-3 and M-7: the approvers admin page says what approvers can do, and shows every failure.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { APPROVER_ROLE_DESCRIPTION, ADMIN_LOAD_FAILED, ADMIN_SAVE_FAILED, ADMIN_SAVED, loadPolicy, saveOutcome } from '../../src/ui/admin-view';

describe('M-3 and M-7 admin page', () => {
  it('describes the approver powers the code grants: waive, reopen a waiver, reset', () => {
    expect(APPROVER_ROLE_DESCRIPTION).toBe('waive items with a reason, reopen waived items and reset checklists');
  });

  it('returns the policy, or an error response instead of spinning when the load fails', async () => {
    expect(await loadPolicy(async () => ({ ok: true, policy: null }))).toEqual({ ok: true, policy: null });
    expect(await loadPolicy(async () => { throw new Error('bridge down'); })).toEqual({ ok: false, message: ADMIN_LOAD_FAILED });
    expect(await loadPolicy(async () => undefined)).toEqual({ ok: false, message: ADMIN_LOAD_FAILED });
  });

  it('shows a notice on a saved policy and an error on a refused or failed save', async () => {
    expect(await saveOutcome(async () => ({ ok: true }))).toEqual({ notice: ADMIN_SAVED, error: null });
    expect(await saveOutcome(async () => ({ ok: false, message: 'Choose at most 20 groups.' }))).toEqual({ notice: null, error: 'Choose at most 20 groups.' });
    expect(await saveOutcome(async () => ({ ok: false }))).toEqual({ notice: null, error: ADMIN_SAVE_FAILED });
    expect(await saveOutcome(async () => { throw new Error('x'); })).toEqual({ notice: null, error: ADMIN_SAVE_FAILED });
  });
});
