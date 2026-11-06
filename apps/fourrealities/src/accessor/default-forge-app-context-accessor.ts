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
      const isActive = getAppContext()?.license?.isActive;
      return typeof isActive === 'boolean' ? isActive : undefined;
    } catch {
      return undefined;
    }
  }

  /** DEVELOPMENT, STAGING or PRODUCTION; undefined outside the Forge runtime (ADR-010 treats that as production). */
  environmentType(): string | undefined {
    try {
      const env = getAppContext()?.environmentType;
      return typeof env === 'string' ? env : undefined;
    } catch {
      return undefined;
    }
  }
}
