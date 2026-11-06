"""Live N-08 check through the planner on the development site, project DEMO.

Creates throw-away issues as the user: tasks X and Y, and a sub-task S of X with a due date and a
start property (so it is on the timeline). In the planner's task dialog for S:
  1. "Parent in Jira": under Y, Apply, confirm "Move"; Jira must show Y as the parent.
  2. "Undo" in the message; Jira must show X again.
  3. "No parent: make it a task", Apply, confirm "Convert"; after Jira's job, S must be a Task.
Deletes X, Y and S at the end. Prints one JSON object.

Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import time

from playwright.sync_api import sync_playwright

from live_common import open_browser, SITE, OUT, planner_frame

URL = SITE + '/jira/servicedesk/projects/DEMO/apps/cac8499e-e92e-4ba6-95cc-af398b1be791/5dfcdd60-51aa-4ea9-a5e2-c94d7e294677'
H = {'Accept': 'application/json', 'Content-Type': 'application/json', 'X-Atlassian-Token': 'no-check', 'User-Agent': 'cascadeplan-live-check'}
out = {}
created = []

with sync_playwright() as p:
    b, ctx = open_browser(p)
    api = ctx.request
    try:
        types = api.get(f'{SITE}/rest/api/3/issue/createmeta/DEMO/issuetypes', headers=H).json()
        types = types.get('issueTypes', types.get('values', []))
        task_t = next(t for t in types if t['name'] == 'Task')
        sub_t = next(t for t in types if t.get('subtask'))

        def create(summary, type_id, parent=None):
            f = {'project': {'key': 'DEMO'}, 'issuetype': {'id': type_id}, 'summary': f'CascadePlan live N-08: {summary} (deleted at once)'}
            if parent:
                f['parent'] = {'key': parent}
            r = api.post(f'{SITE}/rest/api/3/issue', headers=H, data=json.dumps({'fields': f}))
            j = r.json()
            created.append(j['key'])
            return j['key']

        def jira(key):
            j = api.get(f'{SITE}/rest/api/3/issue/{key}?fields=parent,issuetype,duedate', headers=H).json()['fields']
            return {'type': j['issuetype']['name'], 'parent': (j.get('parent') or {}).get('key'), 'due': j.get('duedate')}

        x = create('X', task_t['id'])
        y = create('Y', task_t['id'])
        s = create('S', sub_t['id'], x)
        api.put(f'{SITE}/rest/api/3/issue/{s}', headers=H, data=json.dumps({'fields': {'duedate': '2026-12-11'}}))
        api.put(f'{SITE}/rest/api/3/issue/{s}/properties/cascadeplan.dates', headers=H, data=json.dumps({'startDate': '2026-12-07', 'endDate': '2026-12-11', 'v': 1}))
        out['issues'] = {'X': x, 'Y': y, 'S': s}

        pg = ctx.new_page()
        f = None
        for _ in range(12):
            pg.goto(URL, wait_until='domcontentloaded', timeout=60000)
            f = planner_frame(pg, 90000)
            f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
            pg.wait_for_timeout(2000)
            if f.locator(f'#ganttBody tr.task-row[data-task-id="{s}"]').count():
                break
            time.sleep(5)
        out['row_found'] = f.locator(f'#ganttBody tr.task-row[data-task-id="{s}"]').count() > 0

        def open_dialog():
            row = f.locator(f'#ganttBody tr.task-row[data-task-id="{s}"]')
            row.scroll_into_view_if_needed()
            row.hover()
            row.locator('.row-more-actions-btn').first.click(force=True)
            f.locator('.quick-menu-item[data-action="edit"]').first.click()
            pg.wait_for_timeout(800)

        def flags():
            return f.evaluate("[...document.querySelectorAll('.flag')].map(x => x.textContent.trim())")

        open_dialog()
        out['options'] = f.evaluate("[...document.querySelectorAll('#parentSelect option')].map(o => o.value)")
        f.select_option('#parentSelect', f'parent:{y}')
        f.click('#btnApplyParent')
        pg.wait_for_timeout(600)
        f.locator('.flag button', has_text='Move').first.click()
        pg.wait_for_timeout(8000)
        out['after_move'] = jira(s)
        out['flags_move'] = flags()[-2:]
        f.locator('.flag button', has_text='Undo').first.click()
        pg.wait_for_timeout(8000)
        out['after_undo'] = jira(s)
        f.locator('#btnCloseModal, .modal-close, [aria-label="Close"]').first.click(force=True) if f.locator('#btnCloseModal').count() else None
        pg.reload(wait_until='domcontentloaded')
        f = planner_frame(pg, 90000)
        f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
        pg.wait_for_timeout(2500)
        open_dialog()
        f.select_option('#parentSelect', 'task:')
        f.click('#btnApplyParent')
        pg.wait_for_timeout(600)
        f.locator('.flag button', has_text='Convert').first.click()
        for _ in range(40):
            pg.wait_for_timeout(1500)
            if jira(s)['type'] == 'Task':
                break
        pg.wait_for_timeout(3000)
        out['after_convert'] = jira(s)
        out['flags_convert'] = flags()[-2:]
        pg.screenshot(path=str(OUT / 'N08-live-after-convert.png'))
    finally:
        out['deleted'] = {k: api.delete(f'{SITE}/rest/api/3/issue/{k}?deleteSubtasks=true', headers=H).status for k in reversed(created)}
        b.close()
print(json.dumps(out, indent=1))
