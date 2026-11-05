/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/* Harness stub of @forge/bridge: invoke runs the real resolver in the page. */
export const CTX = { cloudId: 'harness-cloud', siteUrl: 'https://harness.atlassian.net', extension: { project: { key: 'DEMO', id: '10000' } } };
export async function invoke(fn: string, payload: any): Promise<any> {
  const w: any = globalThis;
  w.__calls = w.__calls || [];
  w.__calls.push({ fn, planId: payload && payload.planId });
  const def = w.__resolvers[fn];
  if (!def) throw new Error('no resolver ' + fn);
  return JSON.parse(JSON.stringify(await def({ payload, context: CTX })));
}
export const view = { getContext: async () => CTX, theme: { enable: async () => undefined } };
export const router = { open: async () => undefined };
