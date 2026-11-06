"""N-08 harness check: drag a sub-task onto the middle of another task row to move it under that task.

DEMO-29 (a sub-task of DEMO-9) is dragged onto DEMO-26. The planner asks first ("Move"), then
changes the parent in Jira through the edit endpoint; DEMO-29 shows under DEMO-26 and both parent
bars change. Undo moves it back under DEMO-9. A drop of DEMO-26 (which has sub-tasks) onto DEMO-40
is refused with Jira's rule.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, bar_dates, jira_writes, CHROME

srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
out = {}


def drag_row_into(pg, key, target):
    src = pg.locator(f'#ganttBody tr.task-row[data-task-id="{key}"] td.td-data').nth(1).bounding_box()
    dst = pg.locator(f'#ganttBody tr.task-row[data-task-id="{target}"]').bounding_box()
    pg.mouse.move(src['x'] + 20, src['y'] + src['height'] / 2)
    pg.mouse.down()
    ty = dst['y'] + dst['height'] / 2
    for i in range(1, 16):
        pg.mouse.move(src['x'] + 20, src['y'] + src['height'] / 2 + (ty - src['y'] - src['height'] / 2) * i / 15)
        pg.wait_for_timeout(20)
    hint = pg.evaluate("(document.querySelector('.row-drag-ghost') || {}).dataset?.hint || ''")
    pg.mouse.up()
    pg.wait_for_timeout(400)
    return hint


def parent_of(pg, key):
    return pg.evaluate(f"(JSON.parse(localStorage.getItem('__harness_jira_parents') || '{{}}'))['{key}']")


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)
    out['parents_before'] = {'DEMO-9': bar_dates(pg, 'DEMO-9'), 'DEMO-26': bar_dates(pg, 'DEMO-26')}
    w0 = len(jira_writes(pg))
    out['hint'] = drag_row_into(pg, 'DEMO-29', 'DEMO-26')
    out['asked'] = pg.evaluate("[...document.querySelectorAll('.flag')].map(f => f.textContent.trim())")
    out['writes_before_confirm'] = len(jira_writes(pg)) - w0
    pg.locator('.flag button', has_text='Move').first.click()
    pg.wait_for_timeout(1500)
    out['parent_after'] = parent_of(pg, 'DEMO-29')
    out['parents_after'] = {'DEMO-9': bar_dates(pg, 'DEMO-9'), 'DEMO-26': bar_dates(pg, 'DEMO-26')}
    pg.locator('.flag button', has_text='Undo').first.click()
    pg.wait_for_timeout(1500)
    out['parent_after_undo'] = parent_of(pg, 'DEMO-29')
    out['refused_hint'] = drag_row_into(pg, 'DEMO-26', 'DEMO-40')
    out['refused_flags'] = pg.evaluate("[...document.querySelectorAll('.flag')].map(f => f.textContent.trim())")[-1:]
    b.close()
srv.shutdown()
ok = (out['hint'] == 'Move under DEMO-26' and out['writes_before_confirm'] == 0 and any('Move DEMO-29 under DEMO-26?' in f for f in out['asked'])
      and out['parent_after'] == 'DEMO-26' and out['parents_after']['DEMO-26'] != out['parents_before']['DEMO-26']
      and out['parent_after_undo'] == 'DEMO-9' and 'has sub-tasks' in out['refused_hint'])
print(('PASS' if ok else 'FAIL') + ' N-08 drag a sub-task under another task, confirm, undo: ' + json.dumps(out))
sys.exit(0 if ok else 1)
