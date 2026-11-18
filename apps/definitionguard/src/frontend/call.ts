/**
 * DefinitionGuard: calls a resolver from the UI (TASK-00006).
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * A resolver answers a refusal or a failure with `{ ok: false, error: { kind, message } }` instead
 * of throwing. It is raised here again, on the client, as an Error with that message, so each
 * caller's own catch block and `panelErrorText` show the same text as when the resolver threw.
 */
import { invoke } from '@forge/bridge';
import { isResolverFailure } from '../resolver-boundary';

export class ResolverCallError extends Error {
  constructor(readonly kind: string, message: string) {
    super(message);
    this.name = 'ResolverCallError';
  }
}

export async function callResolver<T = any>(name: string, payload: Record<string, any> = {}): Promise<T> {
  const result: unknown = await invoke(name, payload);
  if (isResolverFailure(result)) throw new ResolverCallError(result.error.kind, result.error.message);
  return result as T;
}
