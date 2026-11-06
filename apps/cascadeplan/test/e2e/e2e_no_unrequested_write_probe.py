"""BL-3 harness check: no unrequested Jira write.

A scripted session of actions; every Jira write it causes is recorded by the fake Jira, and each one
must be a value the script chose:
  1. drag DEMO-40 one week later        -> due date and start property of DEMO-40 only
  2. Ctrl+Z, then Ctrl+Shift+Z           -> the old dates, then the new ones, of DEMO-40 only
  3. select DEMO-40 and DEMO-28, set progress 50 -> no Jira write at all (progress is the planner's)
  4. open DEMO-40's dialog and save with no change -> no Jira write
  5. select DEMO-40 alone, move by 3 days -> due date and start property of DEMO-40 only
No write may carry an estimate, an assignee, a summary, a status transition or another issue.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import re
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, drag_bar, jira_writes, CHROME

srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
steps = {}


def writes_since(pg, n):
    return jira_writes(pg)[n:]


def classify(w):
    """'due', 'start' or the unexpected write itself."""
    m = re.match(r'^PUT /rest/api/3/issue/(DEMO-\d+)/properties/cascadeplan\.dates ', w)
    if m:
        return ('start', m.group(1))
    m = re.match(r'^PUT /rest/api/3/issue/(DEMO-\d+) (.*)$', w)
    if m:
        fields = json.loads(m.group(2)).get('fields', {})
        if list(fields.keys()) == ['duedate']:
            return ('due', m.group(1))
    return ('UNEXPECTED', w[:160])


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg); pg.wait_for_timeout(500)

    n = len(jira_writes(pg))
    w = pg.locator('.bar-hit[data-task-id="DEMO-40"]').bounding_box()['width']
    drag_bar(pg, 'DEMO-40', w / 5 * 7)
    steps['1 drag'] = [classify(x) for x in writes_since(pg, n)]

    n = len(jira_writes(pg))
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(1500)
    pg.keyboard.press('Control+Shift+z'); pg.wait_for_timeout(1500)
    steps['2 undo redo'] = [classify(x) for x in writes_since(pg, n)]

    n = len(jira_writes(pg))
    for key in ('DEMO-40', 'DEMO-28'):
        pg.locator(f'#ganttBody tr.task-row[data-task-id="{key}"] td').nth(1).click(modifiers=['Control'])
    pg.fill('#selProgress', '50')
    pg.click('#btnSelProgress'); pg.wait_for_timeout(400)
    # Both rows are To Do: the planner asks about the status (2026-11-06); Keep sends no status.
    if pg.evaluate("document.getElementById('statusOfferModal').style.display === 'flex'"):
        pg.click('#btnStatusOfferKeep')
    pg.wait_for_timeout(1500)
    steps['3 progress'] = [classify(x) for x in writes_since(pg, n)]
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)

    n = len(jira_writes(pg))
    row = pg.locator('#ganttBody tr.task-row[data-task-id="DEMO-40"]')
    row.hover()
    row.locator('.row-more-actions-btn').first.click(force=True)
    pg.locator('.quick-menu-item[data-action="edit"]').first.click()
    pg.wait_for_timeout(500)
    pg.click('#btnSaveTaskModal'); pg.wait_for_timeout(1500)
    steps['4 save unchanged'] = [classify(x) for x in writes_since(pg, n)]

    n = len(jira_writes(pg))
    sel = pg.evaluate("[...document.querySelectorAll('#ganttBody tr.is-selected')].map(r => r.dataset.taskId)")
    for key in sel:
        pg.locator(f'#ganttBody tr.task-row[data-task-id="{key}"] td').nth(1).click(modifiers=['Control'])
    pg.locator('#ganttBody tr.task-row[data-task-id="DEMO-40"] td').nth(1).click(modifiers=['Control'])
    pg.fill('#selDays', '3')
    pg.click('#btnSelMove'); pg.wait_for_timeout(1500)
    steps['5 select move'] = [classify(x) for x in writes_since(pg, n)]
    b.close()
srv.shutdown()

only_40 = lambda s: all(k == 'DEMO-40' for _, k in s) and all(t in ('due', 'start') for t, _ in s)
ok = (only_40(steps['1 drag']) and len(steps['1 drag']) == 2
      and only_40(steps['2 undo redo']) and len(steps['2 undo redo']) == 4
      and steps['3 progress'] == [] and steps['4 save unchanged'] == []
      and only_40(steps['5 select move']) and len(steps['5 select move']) == 2)
print(('PASS' if ok else 'FAIL') + ' BL-3 no unrequested Jira write in a scripted session: ' + json.dumps(steps))
sys.exit(0 if ok else 1)
