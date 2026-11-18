/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: calls a resolver from the UI (TASK-00006). A failure the resolver caught and logged comes back as
 * an INTERNAL_FAILURE value instead of a thrown error. It is raised here again, on the client, so each caller's own
 * catch shows the same text as when the resolver threw. Every other result passes through unchanged.
 */

import { invoke } from '@forge/bridge';
import { isInternalFailure } from '../contract/data/errors';

export class ResolverFailure extends Error {
  constructor(readonly resolver: string) {
    super(`FourRealities: ${resolver} failed`);
    this.name = 'ResolverFailure';
  }
}

export const callResolver = async <T = unknown>(name: string, payload: object = {}): Promise<T> => {
  const result: unknown = await invoke(name, payload as Record<string, never>);
  if (isInternalFailure(result)) throw new ResolverFailure(name);
  return result as T;
};
