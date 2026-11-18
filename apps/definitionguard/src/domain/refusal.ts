/**
 * DefinitionGuard: expected outcomes that a resolver answers with, instead of a fault (TASK-00006).
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Each carries fixed app text for the user, which never holds issue content. The resolver
 * boundary (src/resolver-boundary.ts) returns it as a typed result, so the Forge runtime never
 * logs it. A plain Error stays a fault: the boundary logs its name only.
 */

export type RefusalKind = 'PERMISSION' | 'CONFLICT' | 'VALIDATION' | 'NOT_FOUND' | 'LICENCE' | 'UNAVAILABLE';

/** A refusal: the user may not do this, or the input or the state does not allow it. Not logged. */
export class RefusalError extends Error {
  constructor(readonly kind: RefusalKind, message: string) {
    super(message);
    this.name = 'RefusalError';
  }
}

/** Jira or storage could not be used, and the user is told so in fixed app text. Logged by name. */
export class UnavailableError extends RefusalError {
  constructor(message: string) {
    super('UNAVAILABLE', message);
    this.name = 'UnavailableError';
  }
}
