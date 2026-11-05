/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan server: The Forge request: project, site and licence, and the resolver result wrappers.
 * Split from src/index.ts without changes to any statement (F-31).
 */

import { ValidationError, toValidationResult } from '../validation';
import { withValidation } from './core';

/**
 * Helper to extract projectKey from trusted Jira Forge context first, with payload fallback.
 */
export function extractProjectKey(req: any): string {
  // The project comes only from the Forge context of a project page, never from the payload (N-01).
  const contextKey = req?.context?.extension?.project?.key;
  if (contextKey && typeof contextKey === 'string' && contextKey.trim().length > 0) {
    return contextKey.trim();
  }
  throw new ValidationError('project', 'CascadePlan works only from a Jira project page.');
}

/**
 * Project id from the trusted Forge context; records are keyed by it (B-09).
 */
export function extractProjectId(req: any): string {
  const id = req?.context?.extension?.project?.id;
  if (id !== undefined && id !== null && String(id).trim().length > 0) return String(id);
  // Records are keyed by the project id; a call without it is refused, so nothing lands under a key (N-01, FX-04).
  throw new ValidationError('project', 'CascadePlan works only from a Jira project page.');
}

export function extractSiteUrl(req: any): string | undefined {
  const contextUrl = req?.context?.siteUrl;
  if (contextUrl && typeof contextUrl === 'string' && contextUrl.trim().length > 0) {
    return contextUrl.trim();
  }
  return undefined;
}

/**
 * Checks whether the request comes from an active licensed installation (B-21).
 * When licensing is enabled, Forge provides context.license with active/isActive.
 * If context.license is missing (free apps, dev/test environments), access is permitted.
 */
export function isLicenseActive(context: any): boolean {
  if (!context || !context.license) return true;
  const lic = context.license;
  if (lic.isActive === false || lic.active === false) return false;
  return true;
}

export function licenceRequiredResult(): { ok: false; success: false; error: 'license_required'; message: string } {
  return {
    ok: false,
    success: false,
    error: 'license_required',
    message: 'Licence required'
  };
}

/**
 * Runs a resolver function with licensing check and validation mapping (B-21).
 */
export async function withResolverHandler<T>(req: any, fn: () => Promise<T>): Promise<T | ReturnType<typeof licenceRequiredResult> | ReturnType<typeof toValidationResult>> {
  if (!isLicenseActive(req?.context)) {
    return licenceRequiredResult();
  }
  return withOk(await withValidation(fn));
}

/**
 * Every resolver result carries a boolean ok, so the client tests one field (F-13, INV-05). A result
 * that has none takes it from success, and is ok when success is not false.
 */
export function withOk<T>(result: T): T {
  if (result && typeof result === 'object' && typeof (result as any).ok !== 'boolean') {
    (result as any).ok = (result as any).success !== false;
  }
  return result;
}
