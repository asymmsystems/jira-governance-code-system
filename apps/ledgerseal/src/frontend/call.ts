/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: calls a resolver from the UI (TASK-00006). A failure the resolver caught and logged comes back as an
 * INTERNAL_FAILURE result instead of a thrown error. It is raised here again, on the client, so each caller's own
 * catch block shows the same text it showed when the resolver threw. Typed refusals pass through unchanged.
 *
 * @author Fahim Farook
 */

import { invoke } from '@forge/bridge';
import { isInternalFailure } from '../service/resolver-boundary';

export class ResolverFailure extends Error {
  constructor(readonly resolver: string) {
    super(`LedgerSeal: ${resolver} failed`);
    this.name = 'ResolverFailure';
  }
}

export async function callResolver<T = any>(name: string, payload: Record<string, any> = {}): Promise<T> {
  const result: unknown = await invoke(name, payload);
  if (isInternalFailure(result)) throw new ResolverFailure(name);
  return result as T;
}
