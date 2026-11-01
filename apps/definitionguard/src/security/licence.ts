/**
 * Marketplace licence state from the Forge context.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Forge sets context.license only for paid apps in production. When it is absent
 * (development, free installs), behaviour is unchanged.
 */
export const LICENCE_INACTIVE = 'Your DefinitionGuard licence is not active. Ask your Jira admin.';

export const VALIDATOR_LICENCE_INACTIVE =
  'DefinitionGuard is not licensed on this site, so this move is blocked. ' +
  'Ask your Jira admin to renew the licence or remove the DefinitionGuard validator from this workflow.';

export function isLicenceInactive(context: any): boolean {
  return context?.license?.isActive === false;
}

/** Throws for write resolvers when the licence is present and inactive. */
export function assertLicensed(context: any): void {
  if (isLicenceInactive(context)) {
    throw new Error(LICENCE_INACTIVE);
  }
}
