/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the Forge runtime facts that a report header names (environment, app version) and the
 * licence state of a run without a resolver context (the queue consumer and the daily run).
 */

import { getAppContext } from '@forge/api';
import { ReportRuntimeAccessor } from '../contract/reports';

type Context = { environmentType?: unknown; appVersion?: unknown; license?: { isActive?: unknown } };

export class DefaultForgeReportRuntimeAccessor implements ReportRuntimeAccessor {
  readonly serviceType = 'accessor' as const;

  constructor(private readonly context: () => Context | undefined = () => getAppContext() as unknown as Context) {}

  private read(): Context {
    try {
      return this.context() || {};
    } catch {
      return {};
    }
  }

  environment(): string {
    const env = this.read().environmentType;
    return typeof env === 'string' ? env.toLowerCase() : 'production';
  }

  appVersion(): string | undefined {
    const v = this.read().appVersion;
    return typeof v === 'string' ? v : undefined;
  }

  licenceActive(): boolean | undefined {
    const v = this.read().license?.isActive;
    return typeof v === 'boolean' ? v : undefined;
  }
}
