"""Creates the Marketplace screenshot project on the development site: "Payments Platform" (PAY).

A company-managed software project with a realistic plan: 3 epics, 11 stories and tasks, 4 sub-tasks,
estimates, due dates, start dates (the issue property cascadeplan.dates, as the planner writes it),
"Blocks" links with trigger percents (cascadeplan.links), some work done or in progress, and logged
time for partial progress. The owner asked for this project (2026-11-06). Run once; it stops if PAY
exists. The created keys go to shots/pay-project.json.

Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json

from playwright.sync_api import sync_playwright

from live_common import open_browser, SITE, OUT

# (ref, type, summary, parent ref, start, due, estimate hours, status, logged hours)
PLAN = [
    ('E1', 'Epic', 'Checkout v2', None, None, None, None, 'In Progress', 0),
    ('E2', 'Epic', 'Fraud and risk controls', None, None, None, None, 'In Progress', 0),
    ('E3', 'Epic', 'Launch and merchant migration', None, None, None, None, 'To Do', 0),
    ('S1', 'Story', 'Card payment form', 'E1', '2026-10-19', '2026-11-06', 40, 'Done', 40),
    ('S1a', 'Sub-task', 'Form layout and field validation', 'S1', '2026-10-19', '2026-10-28', 16, 'Done', 16),
    ('S1b', 'Sub-task', '3-D Secure challenge flow', 'S1', '2026-10-26', '2026-11-06', 24, 'Done', 24),
    ('S2', 'Story', 'Saved cards and digital wallets', 'E1', '2026-11-02', '2026-11-27', 48, 'In Progress', 14),
    ('S2a', 'Sub-task', 'Tokenise saved cards', 'S2', '2026-11-02', '2026-11-13', 24, 'In Progress', 14),
    ('S2b', 'Sub-task', 'Apple Pay and Google Pay buttons', 'S2', '2026-11-16', '2026-11-27', 24, 'To Do', 0),
    ('T1', 'Task', 'Checkout analytics events', 'E1', '2026-11-23', '2026-12-04', 16, 'To Do', 0),
    ('S3', 'Story', 'Risk scoring service', 'E2', '2026-10-26', '2026-11-20', 56, 'In Progress', 30),
    ('T2', 'Task', 'Velocity rules for new cards', 'E2', '2026-11-16', '2026-12-04', 32, 'To Do', 0),
    ('T3', 'Task', 'Manual review queue for flagged orders', 'E2', '2026-12-07', '2026-12-18', 40, 'To Do', 0),
    ('T4', 'Task', 'Merchant migration runbook', 'E3', '2026-11-09', '2026-11-27', 24, 'In Progress', 6),
    ('T5', 'Task', 'Load test checkout at 3x peak traffic', 'E3', '2026-12-07', '2026-12-15', 24, 'To Do', 0),
    ('T6', 'Task', 'Release notes and go-live checklist', 'E3', '2026-12-16', '2026-12-18', 8, 'To Do', 0),
    ('T7', 'Task', 'Go-live: switch merchant traffic', 'E3', '2026-12-21', '2026-12-23', 8, 'To Do', 0),
]
# (predecessor ref, successor ref, trigger percent)
LINKS = [('S2', 'T1', 50), ('S3', 'T2', 30), ('T2', 'T3', 100), ('T1', 'T5', 100), ('T5', 'T6', 100), ('T6', 'T7', 100), ('T4', 'T7', 100)]

JS = r"""async ({ plan, links }) => {
  const log = [];
  const call = async (method, url, body) => {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-Atlassian-Token': 'no-check' }, body: body ? JSON.stringify(body) : undefined });
    let b = null; try { b = await r.json(); } catch (e) {}
    if (r.status >= 300) log.push(method + ' ' + url + ' -> ' + r.status + ' ' + JSON.stringify(b).slice(0, 300));
    return { s: r.status, b };
  };
  const exists = await call('GET', '/rest/api/3/project/PAY');
  if (exists.s === 200) return { error: 'PAY exists', log };
  const me = (await call('GET', '/rest/api/3/myself')).b.accountId;
  const proj = await call('POST', '/rest/api/3/project', { key: 'PAY', name: 'Payments Platform', projectTypeKey: 'software',
    projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-scrum-classic', leadAccountId: me, assigneeType: 'UNASSIGNED',
    description: 'Demo plan for CascadePlan screenshots.' });
  if (proj.s >= 300) return { error: 'project', log };
  const keys = {}, ids = {};
  for (const [ref, type, summary, parent, start, due, hours] of plan) {
    const fields = { project: { key: 'PAY' }, summary, issuetype: { name: type } };
    if (parent) fields.parent = { key: keys[parent] };
    if (due) fields.duedate = due;
    if (type !== 'Epic') fields.assignee = { accountId: me };
    if (hours) fields.timetracking = { originalEstimate: hours + 'h' };
    let r = await call('POST', '/rest/api/3/issue', { fields });
    if (r.s >= 300 && fields.timetracking) { delete fields.timetracking; r = await call('POST', '/rest/api/3/issue', { fields }); if (r.s < 300) log.push('no estimate field on create for ' + ref); }
    if (r.s >= 300) return { error: 'create ' + ref, log, keys };
    keys[ref] = r.b.key; ids[ref] = r.b.id;
    if (hours && !fields.timetracking) await call('PUT', '/rest/api/3/issue/' + r.b.key, { fields: { timetracking: { originalEstimate: hours + 'h' } } });
    if (start) await call('PUT', '/rest/api/3/issue/' + r.b.key + '/properties/cascadeplan.dates', { startDate: start, endDate: due, v: 1 });
  }
  const percents = {};
  for (const [pred, succ, pct] of links) {
    await call('POST', '/rest/api/3/issueLink', { type: { name: 'Blocks' }, inwardIssue: { key: keys[pred] }, outwardIssue: { key: keys[succ] } });
    percents[succ] = Object.assign(percents[succ] || {}, { [ids[pred]]: pct });
  }
  for (const [succ, m] of Object.entries(percents)) await call('PUT', '/rest/api/3/issue/' + keys[succ] + '/properties/cascadeplan.links', { v: 1, links: m });
  for (const [ref, , , , , , , status, logged] of plan) {
    if (logged) await call('POST', '/rest/api/3/issue/' + keys[ref] + '/worklog', { timeSpentSeconds: logged * 3600, started: '2026-11-02T09:00:00.000+0000' });
    if (status === 'To Do') continue;
    const t = (await call('GET', '/rest/api/3/issue/' + keys[ref] + '/transitions')).b.transitions || [];
    const want = status === 'Done' ? 'done' : 'indeterminate';
    const tr = t.find(x => x.to && x.to.statusCategory && x.to.statusCategory.key === want);
    if (tr) await call('POST', '/rest/api/3/issue/' + keys[ref] + '/transitions', { transition: { id: tr.id } });
    else log.push('no transition to ' + status + ' for ' + ref);
  }
  return { keys, log };
}"""

with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(SITE + '/jira/your-work', wait_until='domcontentloaded', timeout=150000)
    pg.wait_for_timeout(5000)
    res = pg.evaluate(JS, {'plan': PLAN, 'links': LINKS})
    b.close()
(OUT / 'pay-project.json').write_text(json.dumps(res, indent=1))
print(json.dumps(res, indent=1))
