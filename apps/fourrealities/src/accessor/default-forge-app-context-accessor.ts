/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the Forge app context of the current invocation. Scheduled triggers have no
 * resolver context, so the licence comes from here (B-23, open point 8).
 */

import { getAppContext } from '@forge/api';
import { AppContextAccessor } from '../contract/accessors';

export class DefaultForgeAppContextAccessor implements AppContextAccessor {
  readonly serviceType = 'accessor' as const;

  /** False only when Forge says the licence is inactive; undefined when there is no licence or no context. */
  licenceActive(): boolean | undefined {
    try {
      // `active` is the current field and `isActive` is deprecated (Forge app context API page, read 2026-11-08).
      const license = getAppContext()?.license as { active?: unknown; isActive?: unknown } | undefined;
      const state = typeof license?.active === 'boolean' ? license.active : license?.isActive;
      return typeof state === 'boolean' ? state : undefined;
    } catch {
      return undefined;
    }
  }

  /** DEVELOPMENT, STAGING or PRODUCTION; undefined outside the Forge runtime (ADR-012 treats that as production). */
  environmentType(): string | undefined {
    try {
      const env = getAppContext()?.environmentType;
      return typeof env === 'string' ? env : undefined;
    } catch {
      return undefined;
    }
  }
}
