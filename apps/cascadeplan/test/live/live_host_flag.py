"""Live check of the owner report "messages below the window": a drag of DEMO-29 shows its message
as a Jira flag in the Jira page (outside the planner frame), inside the browser window; its Undo
puts DEMO-29 back. Writes only DEMO-29 (moved and put back).

Needs CASCADEPLAN_LIVE_COOKIES (see live_common.py).

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import re

from playwright.sync_api import sync_playwright

from live_common import open_browser, SITE, OUT, planner_frame

URL = SITE + '/jira/servicedesk/projects/DEMO/apps/cac8499e-e92e-4ba6-95cc-af398b1be791/5dfcdd60-51aa-4ea9-a5e2-c94d7e294677'
KEY = 'DEMO-29'
out = {}
with sync_playwright() as p:
    b, ctx = open_browser(p)
    pg = ctx.new_page()
    pg.goto(URL, wait_until='domcontentloaded', timeout=150000)
    f = planner_frame(pg, 150000)
    f.wait_for_function("document.querySelectorAll('#ganttBody tr.task-row').length > 0", timeout=90000)
    pg.wait_for_timeout(3000)
    due = lambda: pg.evaluate(f"fetch('/rest/api/3/issue/{KEY}?fields=duedate').then(r => r.json()).then(j => j.fields.duedate)")
    out['due_before'] = due()
    label = f.locator(f'.bar-hit[data-task-id="{KEY}"]').get_attribute('aria-label') or ''
    s, e = re.findall(r'(\d{4}-\d{2}-\d{2})', label)[:2]
    import datetime
    days = (datetime.date.fromisoformat(e) - datetime.date.fromisoformat(s)).days + 1
    hit = f.locator(f'.bar-hit[data-task-id="{KEY}"]')
    hit.scroll_into_view_if_needed()
    box = hit.bounding_box()
    dx = box['width'] / days * 7
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    pg.mouse.move(x, y); pg.mouse.down()
    for i in range(1, 11):
        pg.mouse.move(x + dx * i / 10, y)
    pg.mouse.up()
    flag = pg.locator('[role="alert"], [data-testid*="flag"], div[id^="cascadeplan-"]').filter(has_text=f'Moved {KEY}')
    flag.first.wait_for(timeout=30000)
    fb = flag.first.bounding_box()
    vp = pg.viewport_size
    out['flag_text'] = flag.first.inner_text()[:120]
    out['flag_in_window'] = bool(fb) and fb['y'] >= 0 and fb['y'] + fb['height'] <= vp['height']
    out['flag_in_frame'] = f.locator('.flag').count() > 0
    out['due_after_move'] = due()
    pg.screenshot(path=str(OUT / 'host-flag.png'))
    pg.locator('button', has_text='Undo').first.click()
    pg.wait_for_timeout(10000)
    out['due_after_undo'] = due()
    b.close()
print(json.dumps(out, indent=1))
