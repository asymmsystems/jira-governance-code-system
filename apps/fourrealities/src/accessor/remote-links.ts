/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: reads issue remote links with bounded concurrency inside a time budget.
 */

import { route } from '@forge/api';
import { JiraRequest } from './jira-request';

export const REMOTE_LINK_CONCURRENCY = 8;

/**
 * Returns remote links per issue id. An issue is absent from the map when its read failed or
 * the deadline passed; the Intent gate then shows "Needs re-check" for it.
 */
export async function readRemoteLinks(
  issueIds: string[],
  request: JiraRequest,
  deadline: number,
  concurrency: number = REMOTE_LINK_CONCURRENCY
): Promise<Map<string, any[]>> {
  const result = new Map<string, any[]>();
  let next = 0;
  const worker = async () => {
    while (next < issueIds.length && Date.now() < deadline) {
      const id = issueIds[next++];
      try {
        const res = await request(route`/rest/api/3/issue/${id}/remotelink`);
        if (res.status === 200) {
          const body = await res.json();
          result.set(id, Array.isArray(body) ? body : []);
        }
      } catch {
        // Unread: the gate shows "Needs re-check" for this issue.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, issueIds.length) }, worker));
  return result;
}
