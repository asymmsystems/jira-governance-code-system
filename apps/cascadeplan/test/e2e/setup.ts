/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/* Browser harness setup: KVS in localStorage (survives reload) and a DEMO Jira fixture. */
import { setGlobalStorageProvider, getTimelineWeeks } from '../../src/index';

const KEY = '__harness_kvs';
const load = (): Record<string, any> => JSON.parse(localStorage.getItem(KEY) || '{}');
const save = (m: Record<string, any>) => localStorage.setItem(KEY, JSON.stringify(m));
const clone = (v: any) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
setGlobalStorageProvider({
  async get(k: string) { return clone(load()[k]); },
  async set(k: string, v: any) { const m = load(); m[k] = clone(v); save(m); },
  async delete(k: string) { const m = load(); delete m[k]; save(m); },
  async query(prefix: string) { const m = load(); return Object.keys(m).filter(k => k.startsWith(prefix)).sort().map(key => ({ key, value: clone(m[key]) })); },
  async swap(k: string, v: any) { const m = load(); const prev = m[k]; m[k] = clone(v); save(m); return clone(prev); }
} as any);

const st = (k: string) => ({ statusCategory: { key: k }, name: k === 'done' ? 'Done' : 'To Do' });
const type = (name: string, level: number) => ({ name, hierarchyLevel: level, subtask: level === -1 });
const epic = { id: '1', key: 'DEMO-1', fields: { summary: 'Checkout revamp', issuetype: type('Epic', 1), status: st('new') } };
const ref = (i: any) => ({ id: i.id, key: i.key, fields: { summary: i.fields.summary, issuetype: i.fields.issuetype, status: i.fields.status } });
const sub = (n: number, parent: any) => ({ id: String(n), key: `DEMO-${n}`, fields: { summary: `Subtask ${n}`, issuetype: type('Subtask', -1), status: st('new'), parent: ref(parent), timeoriginalestimate: 8 * 3600 } });
const story9: any = { id: '9', key: 'DEMO-9', fields: { summary: 'Payment form', issuetype: type('Story', 0), status: st('new'), parent: ref(epic), timeoriginalestimate: 16 * 3600 } };
const task26: any = { id: '26', key: 'DEMO-26', fields: { summary: 'Fraud checks', issuetype: type('Task', 0), status: st('new'), timeoriginalestimate: 16 * 3600 } };
const s30 = sub(30, story9), s29 = sub(29, story9), s28 = sub(28, task26), s31 = sub(31, task26);
story9.fields.subtasks = [ref(s30), ref(s29)];
task26.fields.subtasks = [ref(s28), ref(s31)];
// DEMO-40's assignee is not among the assignable users the fixture returns (F-11).
const task40 = { id: '40', key: 'DEMO-40', fields: { summary: 'Release notes', issuetype: type('Task', 0), status: st('new'), timeoriginalestimate: 8 * 3600,
  assignee: { accountId: 'acc-ann', displayName: 'Ann Lee' } } };
const task41 = { id: '41', key: 'DEMO-41', fields: { summary: 'Unplanned task', issuetype: type('Task', 0), status: st('new') } };
const ISSUES = [epic, story9, s30, s29, task26, s28, s31, task40, task41];

const w: any = globalThis;
const writes = (): string[] => JSON.parse(localStorage.getItem('__harness_jira_writes') || '[]');
w.__jiraWrites = writes;
const ok = (body: any, status = 200) => ({ status, json: async () => body, clone() { return this; } });
// Due dates the fake Jira holds: a PUT with a due date changes it, and every search returns it.
const dues = (): Record<string, string> => JSON.parse(localStorage.getItem('__harness_jira_due') || '{}');
// Issue properties the fake Jira holds (ADR-008: the shared start is the property cascadeplan.dates).
const props = (): Record<string, Record<string, any>> => JSON.parse(localStorage.getItem('__harness_jira_props') || '{}');
const withDue = (i: any) => ({ ...i, fields: { ...i.fields, duedate: dues()[i.key] || null }, properties: props()[i.key] || {} });
w.__jira = async (url: string, opts: any) => {
  const method = (opts && opts.method) || 'GET';
  if (method !== 'GET' && /\/rest\/api\/3\/issue\//.test(url)) {
    localStorage.setItem('__harness_jira_writes', JSON.stringify([...writes(), `${method} ${url} ${opts.body || ''}`]));
    const pm = url.match(/\/rest\/api\/3\/issue\/(DEMO-\d+)\/properties\/([^/?]+)$/);
    if (pm) {
      const all = props();
      const forIssue = { ...(all[pm[1]] || {}) };
      if (method === 'PUT') forIssue[pm[2]] = JSON.parse(opts.body || '{}');
      if (method === 'DELETE') delete forIssue[pm[2]];
      localStorage.setItem('__harness_jira_props', JSON.stringify({ ...all, [pm[1]]: forIssue }));
      return ok({}, method === 'PUT' ? 200 : 204);
    }
    const m = method === 'PUT' ? url.match(/\/rest\/api\/3\/issue\/(DEMO-\d+)$/) : null;
    // Review addition: keys listed in __harness_reject_due get the screen error for a due date.
    const reject: string[] = JSON.parse(localStorage.getItem('__harness_reject_due') || '[]');
    if (m && reject.includes(m[1]) && /"duedate"/.test(opts.body || '')) {
      return ok({ errors: { duedate: 'Field duedate cannot be set. It is not on the appropriate screen, or unknown.' } }, 400);
    }
    // Review addition: an optional delay so a test can see the screen before the resolver returns.
    const delay = Number(localStorage.getItem('__harness_put_delay_ms') || '0');
    if (delay > 0) await new Promise(r => setTimeout(r, delay));
    if (m) {
      try {
        const f = JSON.parse(opts.body || '{}').fields || {};
        if (f.duedate) localStorage.setItem('__harness_jira_due', JSON.stringify({ ...dues(), [m[1]]: f.duedate }));
      } catch {}
    }
    return ok({}, 204);
  }
  // Jira creates an issue link with 201 (a dependency exists only as a Jira link, ADR-004).
  if (method === 'POST' && url.endsWith('/rest/api/3/issueLink')) {
    localStorage.setItem('__harness_jira_writes', JSON.stringify([...writes(), `${method} ${url} ${opts.body || ''}`]));
    return ok({}, 201);
  }
  // The harness user is a project administrator, so a plan approver (BL-2).
  // Review switch __harness_not_approver: the user is not a plan approver (BL-2 step 8 check).
  if (url.includes('/rest/api/3/mypermissions')) {
    const approver = localStorage.getItem('__harness_not_approver') !== '1';
    return ok({ permissions: { ADMINISTER_PROJECTS: { havePermission: approver }, ADMINISTER: { havePermission: false } } });
  }
  if (url.includes('/rest/api/3/myself')) return ok({ groups: { items: [] } });
  // The harness user holds every permission on every issue (BL-2 bulk permission check).
  if (method === 'POST' && url.endsWith('/permissions/check')) {
    const pp = JSON.parse(opts.body || '{}').projectPermissions?.[0] || {};
    return ok({ projectPermissions: (pp.permissions || []).map((permission: string) => ({ permission, issues: pp.issues || [] })) });
  }
  if (url.includes('/search/jql')) return ok({ issues: url.includes('Epic') ? [withDue(epic)] : ISSUES.map(withDue), isLast: true });
  if (url.includes('/user/assignable')) return ok([]);
  if (/\/issue\/DEMO-\d+\?fields=project/.test(url)) return ok({ id: url.match(/DEMO-(\d+)/)![1], fields: { project: { key: 'DEMO' } } });
  const gp = url.match(/\/rest\/api\/3\/issue\/(DEMO-\d+)\/properties\/([^/?]+)$/);
  if (gp) {
    const v = props()[gp[1]]?.[gp[2]];
    return v === undefined ? ok({ errorMessages: ['not found'] }, 404) : ok({ key: gp[2], value: v });
  }
  if (url.includes('fields=issuelinks')) return ok({ fields: { issuelinks: [] } });
  if (url.includes('/transitions')) return ok({ transitions: [] });
  return ok({});
};

// First boot: the Main Plan schedules every issue except DEMO-41 (legacy map, migrated by the app).
if (!localStorage.getItem(KEY)) {
  const monday = (() => { const d = new Date(); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); })();
  const add = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  const weeks = getTimelineWeeks().weeks;
  const wk = (iso: string) => (weeks.find(x => x.startDate <= iso && x.endDate >= iso) || weeks[0]).weekKey;
  const e = (off: number, days: number) => ({ startDate: add(monday, off), endDate: add(monday, off + days - 1), startWeek: wk(add(monday, off)), spanWeeks: Math.max(1, Math.ceil(days / 7)) });
  const map: any = { 'DEMO-1': e(0, 21), 'DEMO-9': e(0, 10), 'DEMO-30': e(0, 5), 'DEMO-29': e(5, 5), 'DEMO-26': e(7, 10), 'DEMO-28': e(7, 5), 'DEMO-31': e(12, 5), 'DEMO-40': e(14, 5) };
  const m: any = {}; m['scheduleMap:DEMO'] = map; save(m);
}
