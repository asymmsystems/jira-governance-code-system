/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the permission check of every evidence report resolver (HLD section 7.1). It is one direct
 * call as the user with a literal route, in this function's own body, so FSRT sees it as the authorization
 * check (docs/security/fsrt-scan-2026-11-07.md, section 4.4). Each resolver calls it before any storage read
 * and before any call as the app. It fails closed on any error.
 */

import api, { route } from '@forge/api';
import { NO_REPORT_PERMISSIONS, ReportPermissions } from '../contract/data/reports';

const PROJECT_KEY = /^[A-Z][A-Z0-9_]{0,99}$/;
const RETRIES = 3;

type PermissionsJson = { permissions?: Record<string, { havePermission?: boolean }> } | null;

/** The Retry-After wait of a 429, at most 5 s. */
export function retryWaitMs(res: { headers?: { get: (name: string) => string | null } }): number {
  const header = res.headers?.get('Retry-After');
  const seconds = header === null || header === undefined || header === '' ? NaN : Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds, 5) * 1000 : 1000;
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
let pause = sleep;

/** Replaces the wait between 429 retries (tests); null restores the real wait. */
export function setPermissionPause(fn: ((ms: number) => Promise<void>) | null): void {
  pause = fn || sleep;
}

/**
 * Browse projects, Administer projects and Administer Jira of the caller in the project, as the caller.
 * Any answer other than 200, or a thrown call, gives no permission.
 */
export async function reportPermissionsAsUser(projectKey: string | undefined): Promise<ReportPermissions> {
  if (!projectKey || !PROJECT_KEY.test(projectKey)) return { ...NO_REPORT_PERMISSIONS, status: 400 };
  try {
    let res = await api.asUser().requestJira(route`/rest/api/3/mypermissions?projectKey=${projectKey}&permissions=BROWSE_PROJECTS,ADMINISTER_PROJECTS,ADMINISTER`);
    for (let attempt = 0; attempt < RETRIES && res.status === 429; attempt++) {
      await pause(retryWaitMs(res));
      res = await api.asUser().requestJira(route`/rest/api/3/mypermissions?projectKey=${projectKey}&permissions=BROWSE_PROJECTS,ADMINISTER_PROJECTS,ADMINISTER`);
    }
    if (res.status !== 200) return { ...NO_REPORT_PERMISSIONS, status: res.status };
    const body = (await res.json()) as PermissionsJson;
    const has = (key: string) => body?.permissions?.[key]?.havePermission === true;
    return { status: 200, browse: has('BROWSE_PROJECTS'), administerProjects: has('ADMINISTER_PROJECTS'), administerJira: has('ADMINISTER') };
  } catch {
    return { ...NO_REPORT_PERMISSIONS };
  }
}
