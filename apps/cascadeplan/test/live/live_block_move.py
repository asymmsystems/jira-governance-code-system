"""Live N-05 check on the development site, project DEMO: drag a parent bar one week (block move),
read the Jira due dates of its sub-tasks and of the parent, then Undo from the flag and read them
again. Finally the parent's Jira due date is set back to its value before the check, because DEC-6
leaves it at the roll-up end after the Undo.

Usage: python3 live_block_move.py DEMO-23. Writes only issues of project DEMO.
Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import datetime
import json
import re
import sys

from playwright.sync_api import sync_playwright

from live_common import open_browser, SITE, OUT, planner_frame

URL = SITE + '/jira/servicedesk/projects/DEMO/apps/cac8499e-e92e-4ba6-95cc-af398b1be791/5dfcdd60-51aa-4ea9-a5e2-c94d7e294677'
PARENT = sys.argv[1] if len(sys.argv) > 1 else 'DEMO-23'
log = {}


def dues(pg):
    js = f"""fetch('/rest/api/3/search/jql?jql=' + encodeURIComponent('key = {PARENT} OR parent = {PARENT}') + '&fields=duedate')
      .then(r => r.json()).then(j => Object.fromEntries(j.issues.map(i => [i.key, i.fields.duedate])))"""
    return pg.evaluate(js)


def bar_dates(f, key):
    label = f.locator(f'.bar-hit[data-task-id="{key}"]').get_attribute('aria-label') or ''
    m = re.search(r'(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})', label)
    return (m.group(1), m.group(2)) if m else (None, None)


def load(pg):
    pg.goto(URL, wait_until='domcontentloaded', timeout=60000)
    f = planner_frame(pg, 90000)
    f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
    pg.wait_for_timeout(2500)
    return f


with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    f = load(pg)
    log['jira_before'] = dues(pg)
    log['bar_before'] = bar_dates(f, PARENT)
    s, e = [datetime.date.fromisoformat(x) for x in log['bar_before']]
    hit = f.locator(f'.bar-hit[data-task-id="{PARENT}"]')
    hit.scroll_into_view_if_needed()
    box = hit.bounding_box()
    dx = box['width'] / ((e - s).days + 1) * 7
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    pg.mouse.move(x, y); pg.mouse.down()
    for i in range(1, 11):
        pg.mouse.move(x + dx * i / 10, y)
    pg.mouse.up()
    pg.wait_for_timeout(9000)
    log['bar_after'] = bar_dates(f, PARENT)
    log['flags'] = f.evaluate("[...document.querySelectorAll('.flag')].map(x => x.textContent.trim())")
    log['changes'] = f.evaluate("[...document.querySelectorAll('#changesBody tr')].map(r => [...r.children].map(c => c.textContent.trim()).join(' | '))")
    log['jira_after_move'] = dues(pg)
    pg.screenshot(path=str(OUT / 'N05-live-after-move.png'))
    f.get_by_role('button', name='Undo').first.click()
    pg.wait_for_timeout(12000)
    log['bar_after_undo'] = bar_dates(f, PARENT)
    log['jira_after_undo'] = dues(pg)
    # DEC-6 leaves the parent at its roll-up end; put back the value it had before this check.
    before_parent = log['jira_before'].get(PARENT)
    if before_parent and log['jira_after_undo'].get(PARENT) != before_parent:
        res = pg.evaluate(f"""fetch('/rest/api/3/issue/{PARENT}', {{ method: 'PUT', headers: {{ 'Content-Type': 'application/json', 'X-Atlassian-Token': 'no-check' }},
          body: JSON.stringify({{ fields: {{ duedate: '{before_parent}' }} }}) }}).then(r => r.status)""")
        log['parent_restore_status'] = res
    log['jira_final'] = dues(pg)
    b.close()
print(json.dumps(log, indent=1))
