"""F-11 harness check: saving the task form without a change writes no assignee to Jira, also when
the issue's assignee is not among the assignable users Jira listed.

Copyright (c) 2026 Asymm Systems. All rights reserved.
@author Fahim Farook
"""
import json
import sys
from playwright.sync_api import sync_playwright
from e2e import serve, wait_rows, CHROME

srv = serve()
base = f'http://127.0.0.1:{srv.server_address[1]}/index.html'
ok = True
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': 1600, 'height': 900}).new_page()
    pg.goto(base); pg.evaluate('localStorage.clear()'); pg.reload(); wait_rows(pg)
    hit = pg.locator('.bar-hit[data-task-id="DEMO-40"]')
    hit.scroll_into_view_if_needed()
    hit.dblclick()
    pg.wait_for_selector('#editAssigneeSelect', state='visible', timeout=10000)
    selected = pg.evaluate("(() => { const s = document.getElementById('editAssigneeSelect'); const o = s.options[s.selectedIndex]; return { text: o && o.textContent, id: o && o.dataset.accountId }; })()")
    before = pg.evaluate("window.__jiraWrites()")
    pg.click('#btnSaveTaskModal')
    pg.wait_for_timeout(1500)
    after = pg.evaluate("window.__jiraWrites()")
    new_writes = after[len(before):]
    assignee_writes = [w for w in new_writes if 'assignee' in w]
    print(json.dumps({'selected': selected, 'newWrites': new_writes}))
    if selected.get('id') != 'acc-ann':
        print('FAIL the form does not show the current assignee'); ok = False
    if assignee_writes:
        print('FAIL saving without a change wrote an assignee'); ok = False
    if ok:
        print('PASS F-11 the current assignee is shown, and a save without a change writes no assignee')
    b.close()
srv.shutdown()
sys.exit(0 if ok else 1)
