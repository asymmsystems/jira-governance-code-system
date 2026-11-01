/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Jira request type and 429 retry for the Jira Accessors.
 */

import { Route } from '@forge/api';
import { JiraRequestInit } from './jira-types';

const MAX_RETRIES = 3;
const MAX_WAIT_MS = 5000;

/**
 * Sends one request as a chosen principal. Callers build the route with the @forge/api route tag,
 * which rejects interpolated values that contain '/', '?' or '#'.
 */
export type JiraRequest = (path: Route, init?: JiraRequestInit) => Promise<{ status: number; json: () => Promise<unknown>; headers?: { get: (name: string) => string | null } }>;

const defaultSleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Wraps a request so that a 429 is retried at most 3 times, waiting Retry-After seconds
 * (default 1, at most 5) while the wait still ends before the deadline. Then the 429 is returned.
 */
export function withRetry(send: JiraRequest, deadline: () => number, sleep: (ms: number) => Promise<void> = defaultSleep): JiraRequest {
  return async (r: Route, init?: JiraRequestInit) => {
    let res = await send(r, init);
    for (let attempt = 0; attempt < MAX_RETRIES && res.status === 429; attempt++) {
      const header = res.headers?.get('Retry-After');
      const seconds = header !== null && header !== undefined && header !== '' && Number(header) >= 0 ? Number(header) : 1;
      const wait = Math.min(seconds, MAX_WAIT_MS / 1000) * 1000;
      if (Date.now() + wait > deadline()) {
        break;
      }
      await sleep(wait);
      res = await send(r, init);
    }
    return res;
  };
}

