"""Live check of F-27 and C7 on the development site, project DEMO.

F-27: in the plan list, the Main Plan of DEMO gets the filter "key in (DEMO-29, DEMO-30)". Jira
accepts it, the planner says how many work items match, and only those rows are shown. A filter
Jira refuses shows Jira's message. The filter is then cleared, and every row is back.

C7: the jira:entityProperty module indexes cascadeplan.create. The property is set on DEMO-30,
the JQL issue.property[cascadeplan.create].id search finds DEMO-30, and the property is removed.

Live writes: the filter setting of the DEMO Main Plan (set, then cleared); the property
cascadeplan.create on DEMO-30 (set, then removed). Nothing else.

Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import time
import uuid

from playwright.sync_api import sync_playwright

from live_common import open_browser, SITE, OUT, planner_frame

URL = SITE + '/jira/servicedesk/projects/DEMO/apps/cac8499e-e92e-4ba6-95cc-af398b1be791/5dfcdd60-51aa-4ea9-a5e2-c94d7e294677'
FILTER = 'key in (DEMO-29, DEMO-30)'
out = {}


def rows(f):
    return sorted(set(f.evaluate("[...document.querySelectorAll('#ganttBody tr.task-row')].map(r => r.dataset.taskId)")))


def host_flag(pg, text, timeout=60000):
    loc = pg.locator('[role="alert"], [data-testid*="flag"], div[id^="cascadeplan-"]').filter(has_text=text)
    loc.first.wait_for(timeout=timeout)
    return loc.first.inner_text()[:200]


def save_filter(pg, f, text):
    if not f.is_visible('#planJqlInput'):
        f.click('#planSelectorBtn'); pg.wait_for_timeout(800)
    f.fill('#planJqlInput', text)
    f.click('#btnSavePlanJql')


with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(URL, wait_until='domcontentloaded', timeout=150000)
    f = planner_frame(pg, 150000)
    f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
    pg.wait_for_timeout(3000)
    out['rows_before'] = rows(f)
    out['filter_before'] = f.input_value('#planJqlInput')

    # F-27: a filter Jira accepts.
    save_filter(pg, f, FILTER)
    out['flag_saved'] = host_flag(pg, 'Filter saved')
    f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0 && document.querySelectorAll('#ganttBody tr.task-row').length < %d" % len(out['rows_before']), timeout=90000)
    pg.wait_for_timeout(2000)
    out['rows_filtered'] = rows(f)
    pg.screenshot(path=str(OUT / 'plan-filter.png'))

    # A filter Jira refuses.
    save_filter(pg, f, 'nofieldxyz = 1')
    out['flag_refused'] = host_flag(pg, 'Jira did not accept the filter')

    # Cleared: the whole project again.
    save_filter(pg, f, '')
    out['flag_cleared'] = host_flag(pg, 'Filter removed')
    f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length >= %d" % len(out['rows_before']), timeout=90000)
    pg.wait_for_timeout(2000)
    out['rows_cleared'] = rows(f)

    # C7: the create property is indexed for JQL.
    cid = str(uuid.uuid4())
    put = pg.evaluate("""(cid) => fetch('/rest/api/3/issue/DEMO-30/properties/cascadeplan.create', {method: 'PUT',
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: cid, v: 1})}).then(r => r.status)""", cid)
    out['property_put_status'] = put
    jql = f'project = "DEMO" AND issue.property[cascadeplan.create].id = "{cid}"'
    found = []
    for _ in range(12):
        found = pg.evaluate("""(jql) => fetch('/rest/api/3/search/jql?fields=summary&maxResults=5&jql=' + encodeURIComponent(jql))
          .then(r => r.json()).then(j => (j.issues || []).map(i => i.key))""", jql)
        if found:
            break
        time.sleep(5)
    out['property_search_found'] = found
    out['property_delete_status'] = pg.evaluate("() => fetch('/rest/api/3/issue/DEMO-30/properties/cascadeplan.create', {method: 'DELETE'}).then(r => r.status)")
    b.close()

ok = (out['rows_filtered'] and set(out['rows_filtered']) <= {'DEMO-29', 'DEMO-30'} and 'About 2 work items match' in out['flag_saved']
      and 'nofieldxyz' in out['flag_refused'] and out['rows_cleared'] == out['rows_before']
      and out['property_search_found'] == ['DEMO-30'] and out['property_delete_status'] == 204)
print(('PASS' if ok else 'FAIL') + ' live F-27 and C7: ' + json.dumps(out, indent=1))
