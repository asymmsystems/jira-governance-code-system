"""Arranges the "Payments Platform" (PAY) screenshot project in the planner, as a user would.

Gives the three epics their dates (the span of their work), then moves rows with the planner's own
row drag (press the drag handle, drop on the top edge of a row) until the plan reads in order: each
epic with its stories, tasks and sub-tasks. Writes only in PAY. Run after demo_project_setup.py.

Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json

from playwright.sync_api import sync_playwright

from live_common import cookies, SITE, OUT, CHROME, planner_frame

URL = SITE + '/jira/software/projects/PAY/apps/cac8499e-e92e-4ba6-95cc-af398b1be791/5dfcdd60-51aa-4ea9-a5e2-c94d7e294677'
EPIC_DATES = {'PAY-1': ('2026-10-19', '2026-12-04'), 'PAY-2': ('2026-10-26', '2026-12-18'), 'PAY-3': ('2026-11-09', '2026-12-23')}
ORDER = ['PAY-1', 'PAY-4', 'PAY-5', 'PAY-6', 'PAY-7', 'PAY-8', 'PAY-9', 'PAY-10',
         'PAY-2', 'PAY-11', 'PAY-12', 'PAY-13', 'PAY-3', 'PAY-14', 'PAY-15', 'PAY-16', 'PAY-17']


def rows(f):
    return f.evaluate("[...document.querySelectorAll('#ganttBody tr.task-row')].map(r => r.dataset.taskId)")


def wait_rows(f, pg):
    f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
    pg.wait_for_timeout(2500)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1310, 'height': 1400}, bypass_csp=True)
    ctx.add_cookies(cookies())
    pg = ctx.new_page()
    pg.goto(SITE + '/jira/your-work', wait_until='domcontentloaded', timeout=150000)
    pg.wait_for_timeout(4000)
    for key, (start, due) in EPIC_DATES.items():
        pg.evaluate("""async ([key, start, due]) => {
          await fetch('/rest/api/3/issue/' + key + '/properties/cascadeplan.dates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startDate: start, endDate: due, v: 1 }) });
          await fetch('/rest/api/3/issue/' + key, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { duedate: due } }) });
        }""", [key, start, due])
    pg.goto(URL, wait_until='domcontentloaded', timeout=150000)
    f = planner_frame(pg, 150000)
    wait_rows(f, pg)
    moves = []
    for i, want in enumerate(ORDER):
        cur = rows(f)
        if i >= len(cur) or cur[i] == want:
            continue
        src = f.locator(f'#ganttBody tr.task-row[data-task-id="{want}"] .row-drag-handle').first
        dst = f.locator(f'#ganttBody tr.task-row[data-task-id="{cur[i]}"]').first
        src.scroll_into_view_if_needed()
        sb, db = src.bounding_box(), dst.bounding_box()
        x, y = sb['x'] + sb['width'] / 2, sb['y'] + sb['height'] / 2
        ty = db['y'] + db['height'] * 0.12
        pg.mouse.move(x, y)
        pg.mouse.down()
        for k in range(1, 16):
            pg.mouse.move(x, y + (ty - y) * k / 15)
            pg.wait_for_timeout(30)
        pg.wait_for_timeout(300)
        pg.mouse.up()
        pg.wait_for_timeout(5000)
        wait_rows(f, pg)
        moves.append(f'{want} before {cur[i]}')
    out = {'moves': moves, 'order': rows(f), 'ok': rows(f) == ORDER}
    pg.screenshot(path=str(OUT / 'pay-arranged.png'))
    b.close()
print(json.dumps(out, indent=1))
