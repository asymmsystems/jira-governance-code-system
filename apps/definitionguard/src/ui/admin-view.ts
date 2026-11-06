/**
 * Wording and outcomes for the DefinitionGuard approvers admin page. No UI and no Forge calls.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */

/** What approvers can do in the code (M-3): src/index.ts waive, reopen a waiver, reset. */
export const APPROVER_ROLE_DESCRIPTION = 'waive items with a reason, reopen waived items and reset checklists';

export const ADMIN_LOAD_FAILED = 'DefinitionGuard could not load the approver groups. Refresh the page and try again.';
export const ADMIN_SAVE_FAILED = 'DefinitionGuard could not save the approver groups. Try again.';
export const ADMIN_SAVED = 'Saved. The approver groups apply to every project on this site.';

/** The policy response, or an error response when the call fails, so the page never spins forever (M-7). */
export async function loadPolicy(call: () => Promise<any>): Promise<any> {
  try {
    const res = await call();
    return res ?? { ok: false, message: ADMIN_LOAD_FAILED };
  } catch {
    return { ok: false, message: ADMIN_LOAD_FAILED };
  }
}

/** The notice or the error to show after a save (M-7). */
export async function saveOutcome(call: () => Promise<any>): Promise<{ notice: string | null; error: string | null }> {
  try {
    const res = await call();
    if (res?.ok) return { notice: ADMIN_SAVED, error: null };
    return { notice: null, error: typeof res?.message === 'string' && res.message ? res.message : ADMIN_SAVE_FAILED };
  } catch {
    return { notice: null, error: ADMIN_SAVE_FAILED };
  }
}
