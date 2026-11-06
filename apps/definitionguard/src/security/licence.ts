/**
 * Marketplace licence state from the Forge context.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Forge sets the licence only for paid apps in production. When it is absent (development,
 * free installs), behaviour is unchanged. Resolvers get it as context.license from
 * @forge/resolver. A function such as the workflow validator may not get it in its second
 * argument, so the runtime's app context (getAppContext().license) is the fallback (H-3).
 *
 * With an inactive licence (BL-4): writes are refused, reads still work, and the workflow
 * validator lets every move through. The customer stopped paying for enforcement, so the
 * enforcement stops; nobody is kept from closing work. The panel and the settings page say so.
 */
import { getAppContext } from '@forge/api';

export const LICENCE_INACTIVE = 'Your DefinitionGuard licence is not active. Ask your Jira admin.';

/** Shown in the panel and on the settings page while the licence is inactive. */
export const LICENCE_GATE_OFF =
  'DefinitionGuard is not licensed on this site, so the Definition of Done gate is off: moves to Done are not blocked ' +
  'and checklist changes cannot be saved. Ask your Jira admin to renew the licence.';

type LicenceLike = { isActive?: boolean; active?: boolean } | undefined;

/** The licence from the call's context, else from the Forge runtime. Undefined when neither has one. */
export function licenceOf(context: any): LicenceLike {
  if (context?.license) return context.license;
  try {
    return typeof getAppContext === 'function' ? getAppContext()?.license : undefined;
  } catch {
    // Outside the Forge runtime (tests, local tools) there is no app context.
    return undefined;
  }
}

/** True only when a licence is present and says it is not active. */
export function isLicenceInactive(context: any): boolean {
  const licence = licenceOf(context);
  if (!licence) return false;
  if (typeof licence.isActive === 'boolean') return licence.isActive === false;
  return licence.active === false;
}

/** Throws for write resolvers when the licence is present and inactive. */
export function assertLicensed(context: any): void {
  if (isLicenceInactive(context)) {
    throw new Error(LICENCE_INACTIVE);
  }
}
