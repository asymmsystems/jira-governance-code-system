/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the Forge runtime facts that a report header names (environment, app version) and the
 * licence state of a run without a resolver context (the queue consumer and the daily run).
 */

import api, { getAppContext, route } from '@forge/api';
import { ReportRuntimeAccessor } from '../contract/reports';

type Context = { environmentType?: unknown; appVersion?: unknown; license?: { isActive?: unknown; active?: unknown } };

/** The License REST API, as the app: GET /forge/app/v1/license (no scope; 1 call per 5 minutes per installation). */
export type LicenceFetch = () => Promise<{ status: number; json: () => Promise<unknown> }>;

const licenceApi: LicenceFetch = () => api.asApp().requestAtlassian(route`/forge/app/v1/license`, { headers: { 'Content-Type': 'application/json' } }) as ReturnType<LicenceFetch>;

export class DefaultForgeReportRuntimeAccessor implements ReportRuntimeAccessor {
  readonly serviceType = 'accessor' as const;

  private readonly fetchLicence: LicenceFetch;

  /** fetchLicence replaces the License REST API call (tests). */
  constructor(private readonly context: () => Context | undefined = () => getAppContext() as unknown as Context, fetchLicence?: LicenceFetch) {
    this.fetchLicence = fetchLicence || licenceApi;
  }

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

  /** The licence from the app context: `active`, else the deprecated `isActive`; undefined when absent. */
  licenceActive(): boolean | undefined {
    const license = this.read().license;
    const v = typeof license?.active === 'boolean' ? license.active : license?.isActive;
    return typeof v === 'boolean' ? v : undefined;
  }

  /**
   * The licence for a run with no resolver context (the daily run). The Forge docs do not say that a scheduled
   * trigger's app context carries the licence (app context API and scheduled trigger pages, read 2026-11-08), so
   * when the context has none in production, the License REST API is asked; undefined when that fails too.
   */
  async licenceState(): Promise<boolean | undefined> {
    const fromContext = this.licenceActive();
    if (fromContext !== undefined || this.environment() !== 'production') return fromContext;
    try {
      const res = await this.fetchLicence();
      if (res.status !== 200) return undefined;
      const body = (await res.json()) as { results?: Array<{ data?: { active?: unknown } }> } | null;
      const active = body?.results?.[0]?.data?.active;
      return typeof active === 'boolean' ? active : undefined;
    } catch {
      return undefined;
    }
  }
}
