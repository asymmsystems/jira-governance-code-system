/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/* Harness stub of @forge/api: every Jira call goes to the fixture in setup.ts. */
export function route(strings: TemplateStringsArray, ...values: any[]): string {
  return strings.reduce((acc, s, i) => acc + s + (values[i] !== undefined ? values[i] : ''), '');
}
const requestJira = (url: any, opts?: any) => (globalThis as any).__jira(String(url), opts || {});
export default { asApp: () => ({ requestJira }), asUser: () => ({ requestJira }) };
/** The personal data report is a weekly server job; the harness never runs it. */
export const privacy = { reportPersonalData: async () => [] as Array<{ accountId: string; status: string }> };
